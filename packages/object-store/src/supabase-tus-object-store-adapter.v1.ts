import { createHash, randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type {
  ObjectMetadataFailureV1,
  ObjectOperationDurableIdentityV1,
  ObjectOperationResultV1,
  ObjectReconcileClaimV1,
  ObjectReconcileSettlementV1,
  ReserveObjectOperationResultV1,
  ObjectTerminalOutcomeV1,
} from "./db/metadata-contract.v1.js";
import { OBJECT_STORE_METADATA_CONTRACT_VERSION_V1 } from "./db/metadata-contract.v1.js";
import {
  objectScopeFingerprintV1,
  snapshotAccessDecisionV1,
  snapshotDeleteRequestV1,
  snapshotGrantRequestV1,
  snapshotPutRequestV1,
  snapshotRangeReadRequestV1,
  snapshotReadRequestV1,
} from "./object-store-adapter-core.v1.js";
import type {
  ObjectAccessOperationV1,
  ObjectAccessPolicyVerifierV1,
} from "./object-access-policy.v1.js";
import type {
  ObjectByteStreamV1,
  ObjectHeadV1,
  ObjectRangeReadRequestV1,
  ObjectReadGrantV1,
  ObjectReadRequestV1,
  ObjectRefV1,
  ObjectStorePortV1,
  ObjectStoreReconciliationPortV1,
  ObjectStreamResultV1,
  PutImmutableRequestV1,
  PutImmutableResultV1,
} from "./object-store-port.v1.js";
import { ObjectStoreErrorV1 } from "./object-store-port.v1.js";
import {
  validateObjectClassPoliciesV1,
  type ObjectClassPolicyV1,
  type ObjectStoreBucketV1,
} from "./object-store-policy.v1.js";
import {
  createPostgresObjectMetadataReconciliationAdapterV1,
  type ObjectMetadataReconcileHandlerV1,
} from "./postgres/create-postgres-object-metadata-reconciliation-adapter.v1.js";
import type { PostgresObjectMetadataRepositoryV1 } from "./postgres/create-postgres-object-metadata-repository.v1.js";

const sha256Pattern = /^sha256:[a-f0-9]{64}$/u;
const opaqueRefPattern = /^objv1_[a-f0-9]{66}$/u;
const tokenPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,511}$/u;
const mediaTypePattern = /^[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]{0,126}\/[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]{0,126}$/u;
const tusVersion = "1.0.0";
const tusChunkBytes = 6 * 1024 * 1024;
const foregroundLeaseSeconds = 3_600;

const bucketCodes = Object.freeze({
  "tp-snapshots": "01",
  "ar-artifacts": "02",
  "skill-packages": "03",
} as const satisfies Readonly<Record<ObjectStoreBucketV1, string>>);

const bucketsByCode = Object.freeze(
  Object.fromEntries(
    Object.entries(bucketCodes).map(([bucket, code]) => [code, bucket]),
  ) as Readonly<Record<string, ObjectStoreBucketV1>>,
);

type ProviderMetadataV1 = Readonly<{
  schema_version: "pai_supabase_object.v1";
  object_ref: ObjectRefV1;
  owner_service: string;
  owner_object_id: string;
  owner_state_version: string;
  object_class: string;
  scope_fingerprint: string;
  request_hash: string;
  object_fingerprint: string;
  expected_sha256: string;
  size_bytes: string;
  media_type: string;
  retention_until: string;
  reservation_id: string;
  attempt_id: string;
}>;

interface ProviderObjectHeadV1 {
  readonly bucket: ObjectStoreBucketV1;
  readonly key: string;
  readonly version: string;
  readonly size_bytes: number;
  readonly media_type: string;
  readonly metadata: ProviderMetadataV1;
}

interface DurableSupabaseAdapterOptionsV1 {
  readonly url: string;
  readonly secretKey: string;
  readonly allow_insecure_local_docker_transport?: boolean;
  readonly metadataRepository: PostgresObjectMetadataRepositoryV1;
  readonly terminalProofReadiness: Readonly<{
    reconcileTerminalProofs(): Promise<void>;
  }>;
  readonly accessPolicyVerifier: ObjectAccessPolicyVerifierV1;
  readonly policies: readonly ObjectClassPolicyV1[];
  readonly now?: () => Date;
  readonly fetch?: typeof fetch;
}

function hashV1(value: string | Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function hashJsonV1(value: unknown): `sha256:${string}` {
  return hashV1(JSON.stringify(value));
}

function failV1(
  code: ConstructorParameters<typeof ObjectStoreErrorV1>[0],
  message: string,
  retryable = false,
  details: Readonly<Record<string, unknown>> = {},
): never {
  throw new ObjectStoreErrorV1(code, message, retryable, details);
}

function currentTimeV1(now: () => Date): Date {
  const value = now();
  const milliseconds = value instanceof Date ? value.getTime() : Number.NaN;
  if (!Number.isFinite(milliseconds)) {
    failV1("storage_unavailable", "object store clock is unavailable", true);
  }
  return new Date(milliseconds);
}

function objectFingerprintV1(
  request: Pick<
    PutImmutableRequestV1,
    | "owner_service"
    | "owner_object_id"
    | "owner_state_version"
    | "object_class"
    | "scope"
  >,
): `sha256:${string}` {
  return hashJsonV1([
    "pai_object_fingerprint.v1",
    request.owner_service,
    request.owner_object_id,
    request.owner_state_version,
    request.object_class,
    `sha256:${objectScopeFingerprintV1(request.scope)}`,
  ]);
}

function putRequestHashV1(
  request: PutImmutableRequestV1,
  objectFingerprint: string,
): `sha256:${string}` {
  return hashJsonV1([
    "pai_object_put_request.v1",
    objectFingerprint,
    request.idempotency_key,
    request.expected_sha256,
    request.size_bytes,
    request.media_type,
    request.retention_until,
  ]);
}

function deleteRequestHashV1(input: Readonly<{
  object_ref: ObjectRefV1;
  object_fingerprint: string;
  idempotency_key: string;
  deletion_decision_version: number;
}>): `sha256:${string}` {
  return hashJsonV1([
    "pai_object_delete_request.v1",
    input.object_ref,
    input.object_fingerprint,
    input.idempotency_key,
    input.deletion_decision_version,
  ]);
}

function opaqueRefV1(
  bucket: ObjectStoreBucketV1,
  objectFingerprint: string,
): ObjectRefV1 {
  if (!sha256Pattern.test(objectFingerprint)) {
    failV1("precondition_failed", "object fingerprint is malformed");
  }
  return `objv1_${bucketCodes[bucket]}${objectFingerprint.slice(7)}` as ObjectRefV1;
}

function physicalKeyV1(objectRef: ObjectRefV1): string {
  if (!opaqueRefPattern.test(objectRef)) {
    failV1("object_not_found", "opaque object reference is malformed");
  }
  return `v1/${objectRef}`;
}

function bucketFromRefV1(objectRef: ObjectRefV1): ObjectStoreBucketV1 {
  if (!opaqueRefPattern.test(objectRef)) {
    failV1("object_not_found", "opaque object reference is malformed");
  }
  const bucket = bucketsByCode[objectRef.slice(6, 8)];
  if (bucket === undefined) {
    failV1("object_not_found", "opaque object reference has no registered bucket");
  }
  return bucket;
}

function durableIdentityV1(
  request: PutImmutableRequestV1,
  requestHash: string,
  objectFingerprint: string,
): ObjectOperationDurableIdentityV1 {
  return Object.freeze({
    contract_version: OBJECT_STORE_METADATA_CONTRACT_VERSION_V1,
    operation: "put_immutable" as const,
    owner_service: request.owner_service as ObjectOperationDurableIdentityV1["owner_service"],
    owner_object_id: request.owner_object_id,
    owner_state_version: request.owner_state_version,
    object_class: request.object_class,
    scope: request.scope,
    idempotency_key: request.idempotency_key,
    request_hash: requestHash as ObjectOperationDurableIdentityV1["request_hash"],
    object_fingerprint:
      objectFingerprint as ObjectOperationDurableIdentityV1["object_fingerprint"],
    expected_digest:
      request.expected_sha256 as ObjectOperationDurableIdentityV1["expected_digest"],
    expected_size_bytes: request.size_bytes,
    media_type: request.media_type,
    retention_until: request.retention_until,
    deletion_decision_version: null,
    gc_not_before: request.retention_until,
  });
}

function replayResultV1(
  result: Extract<ReserveObjectOperationResultV1, { kind: "replay" }>["result"] | ObjectOperationResultV1,
): PutImmutableResultV1 | undefined {
  if (
    result.status !== "succeeded" ||
    result.opaque_ref === null ||
    result.expected_digest === null ||
    result.expected_size_bytes === null ||
    result.media_type === null
  ) {
    return undefined;
  }
  return Object.freeze({
    object_ref: result.opaque_ref as ObjectRefV1,
    version: result.terminal_proof?.provider_receipt_hash ?? result.terminal_proof?.proof_hash ?? "",
    sha256: result.expected_digest,
    size_bytes: result.expected_size_bytes,
    media_type: result.media_type,
    retention_until: result.retention_until,
    replayed: true,
  });
}

function terminalFailureV1(
  operation: "put_immutable" | "delete_if_eligible",
  disposition: "rejected_before_commit" | "verified_absent",
  errorCode: string,
  retryable = false,
): ObjectTerminalOutcomeV1 {
  const failure = failureV1(errorCode, retryable);
  const providerReceiptHash = hashJsonV1([
    "pai_provider_terminal_failure.v1",
    operation,
    disposition,
    failure.failure_hash,
  ]);
  const withoutProof = {
    operation,
    proof_kind: "terminal_failure" as const,
    provider_receipt_hash: providerReceiptHash,
    provider_terminal_disposition: disposition,
    error: failure,
  };
  return Object.freeze({
    ...withoutProof,
    proof_hash: hashJsonV1(["pai_terminal_proof.v1", withoutProof]),
  });
}

function failureV1(errorCode: string, retryable: boolean): ObjectMetadataFailureV1 {
  const normalized = errorCode
    .toLowerCase()
    .replaceAll(/[^a-z0-9_]+/gu, "_")
    .replaceAll(/^_+|_+$/gu, "")
    .slice(0, 128);
  const code = /^[a-z][a-z0-9_]{0,127}$/u.test(normalized)
    ? normalized
    : "storage_unavailable";
  return Object.freeze({
    schema_version: "object_store_failure.v1" as const,
    error_code: code,
    retryable,
    failure_hash: hashJsonV1(["pai_object_store_failure.v1", code, retryable]),
  });
}

function retrySettlementV1(errorCode: string): ObjectReconcileSettlementV1 {
  return Object.freeze({
    kind: "retry_wait" as const,
    retry_delay_seconds: 30,
    error: failureV1(errorCode, true),
  });
}

function encodeTusMetadataV1(values: Readonly<Record<string, string>>): string {
  return Object.entries(values)
    .map(([key, value]) => `${key} ${Buffer.from(value, "utf8").toString("base64")}`)
    .join(",");
}

function exactOwnDataRecordV1(value: unknown): Readonly<Record<string, unknown>> | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  let descriptors: PropertyDescriptorMap;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    return undefined;
  }
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some((key) => typeof key !== "string")) return undefined;
  const snapshot: Record<string, unknown> = Object.create(null);
  for (const key of keys as string[]) {
    const descriptor = descriptors[key];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      return undefined;
    }
    snapshot[key] = descriptor.value;
  }
  return Object.freeze(snapshot);
}

function providerMetadataV1(value: unknown): ProviderMetadataV1 {
  const wrapper = exactOwnDataRecordV1(value);
  if (
    wrapper === undefined ||
    Object.keys(wrapper).length !== 1 ||
    typeof wrapper.pai !== "string"
  ) {
    failV1("integrity_mismatch", "Supabase object metadata wrapper is malformed");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(wrapper.pai);
  } catch {
    failV1("integrity_mismatch", "Supabase object metadata wrapper is malformed");
  }
  const data = exactOwnDataRecordV1(parsed);
  const requiredKeys = [
    "schema_version",
    "object_ref",
    "owner_service",
    "owner_object_id",
    "owner_state_version",
    "object_class",
    "scope_fingerprint",
    "request_hash",
    "object_fingerprint",
    "expected_sha256",
    "size_bytes",
    "media_type",
    "retention_until",
    "reservation_id",
    "attempt_id",
  ] as const;
  if (
    data === undefined ||
    Object.keys(data).length !== requiredKeys.length ||
    requiredKeys.some((key) => typeof data[key] !== "string") ||
    data.schema_version !== "pai_supabase_object.v1" ||
    !opaqueRefPattern.test(data.object_ref as string) ||
    !sha256Pattern.test(data.scope_fingerprint as string) ||
    !sha256Pattern.test(data.request_hash as string) ||
    !sha256Pattern.test(data.object_fingerprint as string) ||
    !sha256Pattern.test(data.expected_sha256 as string) ||
    !/^\d+$/u.test(data.owner_state_version as string) ||
    !/^\d+$/u.test(data.size_bytes as string) ||
    !mediaTypePattern.test(data.media_type as string) ||
    !Number.isFinite(Date.parse(data.retention_until as string)) ||
    !tokenPattern.test(data.reservation_id as string) ||
    !tokenPattern.test(data.attempt_id as string)
  ) {
    failV1("integrity_mismatch", "Supabase object metadata is malformed");
  }
  return Object.freeze({
    schema_version: "pai_supabase_object.v1",
    object_ref: data.object_ref as ObjectRefV1,
    owner_service: data.owner_service as string,
    owner_object_id: data.owner_object_id as string,
    owner_state_version: data.owner_state_version as string,
    object_class: data.object_class as string,
    scope_fingerprint: data.scope_fingerprint as string,
    request_hash: data.request_hash as string,
    object_fingerprint: data.object_fingerprint as string,
    expected_sha256: data.expected_sha256 as string,
    size_bytes: data.size_bytes as string,
    media_type: data.media_type as string,
    retention_until: data.retention_until as string,
    reservation_id: data.reservation_id as string,
    attempt_id: data.attempt_id as string,
  });
}

class SupabaseTusProviderV1 {
  readonly #client: SupabaseClient;
  readonly #baseUrl: URL;
  readonly #secretKey: string;
  readonly #fetch: typeof fetch;

  public constructor(
    url: string,
    secretKey: string,
    fetchImpl: typeof fetch,
    allowInsecureLocalDockerTransport = false,
  ) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error("Supabase Storage URL is invalid");
    }
    const loopback =
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "localhost" ||
      parsed.hostname === "[::1]";
    const localDockerStorage =
      allowInsecureLocalDockerTransport === true &&
      parsed.protocol === "http:" &&
      parsed.hostname === "storage-edge-runtime" &&
      parsed.port === "8080";
    if (
      (parsed.protocol !== "https:" && !loopback && !localDockerStorage) ||
      parsed.username.length > 0 ||
      parsed.password.length > 0 ||
      secretKey.length < 1 ||
      /[\r\n]/u.test(secretKey)
    ) {
      throw new Error("Supabase Storage credentials are invalid");
    }
    this.#baseUrl = parsed;
    this.#secretKey = secretKey;
    this.#fetch = fetchImpl;
    this.#client = createClient(parsed.toString().replace(/\/$/u, ""), secretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: { fetch: fetchImpl },
    });
  }

  #headers(extra: Readonly<Record<string, string>> = {}): Headers {
    return new Headers({
      authorization: `Bearer ${this.#secretKey}`,
      apikey: this.#secretKey,
      ...extra,
    });
  }

  #validatedUploadUrl(value: string): URL {
    let parsed: URL;
    try {
      parsed = new URL(value, this.#baseUrl);
    } catch {
      failV1("storage_unavailable", "Supabase TUS upload URL is malformed", true);
    }
    if (
      parsed.origin !== this.#baseUrl.origin ||
      !parsed.pathname.includes("/storage/v1/upload/resumable/") ||
      parsed.username.length > 0 ||
      parsed.password.length > 0 ||
      parsed.hash.length > 0 ||
      parsed.toString().length > 512
    ) {
      failV1("storage_unavailable", "Supabase TUS upload URL crossed its credential boundary", true);
    }
    return parsed;
  }

  async #request(
    url: string | URL,
    init: RequestInit,
    timeoutMs: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(new Error("Supabase Storage request timed out")),
      timeoutMs,
    );
    timeout.unref();
    try {
      return await this.#fetch(url, {
        ...init,
        redirect: "error",
        signal: controller.signal,
      });
    } catch (error) {
      failV1("storage_unavailable", "Supabase Storage request failed", true, {
        provider_error: error instanceof Error ? error.name : "unknown",
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  public async createUpload(
    bucket: ObjectStoreBucketV1,
    key: string,
    sizeBytes: number,
    mediaType: string,
    metadata: ProviderMetadataV1,
  ): Promise<string> {
    const endpoint = new URL(
      "storage/v1/upload/resumable",
      `${this.#baseUrl.toString().replace(/\/$/u, "")}/`,
    );
    const response = await this.#request(
      endpoint,
      {
        method: "POST",
        headers: this.#headers({
          "tus-resumable": tusVersion,
          // A deferred length prevents POST from completing a zero-byte object
          // before the attempt-specific upload URL is durable in PostgreSQL.
          "upload-defer-length": "1",
          "upload-metadata": encodeTusMetadataV1({
            bucketName: bucket,
            objectName: key,
            contentType: mediaType,
            cacheControl: "3600",
            // Supabase JS camel-cases nested response keys. Keeping the
            // canonical metadata JSON in one string preserves exact field names.
            metadata: JSON.stringify({ pai: JSON.stringify(metadata) }),
          }),
          "x-upsert": "false",
        }),
      },
      30_000,
    );
    const location = response.headers.get("location");
    if (response.status !== 201 || location === null) {
      if (response.status === 409 || response.status === 400) {
        failV1("storage_unavailable", "Supabase TUS upload identity already exists", true);
      }
      failV1("storage_unavailable", "Supabase TUS upload creation failed", true, {
        provider_status: response.status,
      });
    }
    return this.#validatedUploadUrl(location).toString();
  }

  public async upload(
    uploadUrl: string,
    body: ObjectByteStreamV1,
    expectedSize: number,
    expectedSha256: string,
    zeroByteFallback: Readonly<{
      bucket: ObjectStoreBucketV1;
      key: string;
      mediaType: string;
      metadata: ProviderMetadataV1;
    }>,
  ): Promise<void> {
    const url = this.#validatedUploadUrl(uploadUrl);
    const digest = createHash("sha256");
    if (expectedSize === 0) {
      for await (const value of body) {
        if (!(value instanceof Uint8Array)) {
          failV1("precondition_failed", "object body must yield Uint8Array chunks");
        }
        if (value.byteLength !== 0) {
          failV1("integrity_mismatch", "object body is larger than declared size");
        }
      }
      if (`sha256:${digest.digest("hex")}` !== expectedSha256) {
        failV1("integrity_mismatch", "object body does not match declared integrity");
      }
      if (!(await this.terminateUpload(uploadUrl))) {
        failV1("storage_unavailable", "Supabase zero-byte TUS session could not be fenced", true);
      }
      const { error } = await this.#client.storage
        .from(zeroByteFallback.bucket)
        .upload(zeroByteFallback.key, new Uint8Array(), {
          cacheControl: "3600",
          contentType: zeroByteFallback.mediaType,
          upsert: false,
          metadata: { pai: JSON.stringify(zeroByteFallback.metadata) },
        });
      if (error !== null) {
        failV1("storage_unavailable", "Supabase zero-byte upload failed", true);
      }
      return;
    }
    let total = 0;
    let offset = 0;
    let buffered = new Uint8Array(tusChunkBytes);
    let bufferedLength = 0;
    let lengthDeclared = false;

    const send = async (chunk: Uint8Array): Promise<void> => {
      const response = await this.#request(
        url,
        {
          method: "PATCH",
          headers: this.#headers({
            "tus-resumable": tusVersion,
            "upload-offset": String(offset),
            "content-type": "application/offset+octet-stream",
            "content-length": String(chunk.byteLength),
            ...(lengthDeclared ? {} : { "upload-length": String(expectedSize) }),
          }),
          body: chunk,
        },
        300_000,
      );
      const nextOffset = Number(response.headers.get("upload-offset"));
      if (
        response.status !== 204 ||
        !Number.isSafeInteger(nextOffset) ||
        nextOffset !== offset + chunk.byteLength
      ) {
        failV1("storage_unavailable", "Supabase TUS chunk outcome is unknown", true, {
          provider_status: response.status,
          upload_offset: offset,
        });
      }
      offset = nextOffset;
      lengthDeclared = true;
    };

    try {
      for await (const value of body) {
        if (!(value instanceof Uint8Array)) {
          failV1("precondition_failed", "object body must yield Uint8Array chunks");
        }
        const chunk = Uint8Array.from(value);
        if (chunk.byteLength === 0) continue;
        if (total + chunk.byteLength > expectedSize) {
          failV1("integrity_mismatch", "object body is larger than declared size");
        }
        total += chunk.byteLength;
        digest.update(chunk);
        let sourceOffset = 0;
        while (sourceOffset < chunk.byteLength) {
          const copied = Math.min(
            tusChunkBytes - bufferedLength,
            chunk.byteLength - sourceOffset,
          );
          buffered.set(chunk.subarray(sourceOffset, sourceOffset + copied), bufferedLength);
          bufferedLength += copied;
          sourceOffset += copied;
          if (bufferedLength === tusChunkBytes) {
            await send(buffered);
            buffered = new Uint8Array(tusChunkBytes);
            bufferedLength = 0;
          }
        }
      }
      if (total !== expectedSize || `sha256:${digest.digest("hex")}` !== expectedSha256) {
        failV1("integrity_mismatch", "object body does not match declared integrity");
      }
      if (bufferedLength > 0) {
        await send(buffered.subarray(0, bufferedLength));
      } else if (!lengthDeclared) {
        await send(new Uint8Array(0));
      }
      if (offset !== expectedSize) {
        failV1("storage_unavailable", "Supabase TUS upload did not reach its terminal offset", true);
      }
    } finally {
      buffered = new Uint8Array();
      bufferedLength = 0;
    }
  }

  public async terminateUpload(uploadUrl: string): Promise<boolean> {
    const url = this.#validatedUploadUrl(uploadUrl);
    const response = await this.#request(
      url,
      {
        method: "DELETE",
        headers: this.#headers({ "tus-resumable": tusVersion }),
      },
      30_000,
    );
    if (response.status === 204 || response.status === 404 || response.status === 410) {
      return true;
    }
    if (response.status >= 500 || response.status === 408 || response.status === 429) {
      return false;
    }
    // Supabase disables termination for a completed upload. The caller must
    // inspect the immutable object before deciding success vs cleanup.
    if (response.status === 400 || response.status === 409) return true;
    return false;
  }

  public async head(
    bucket: ObjectStoreBucketV1,
    key: string,
  ): Promise<ProviderObjectHeadV1 | undefined> {
    const { data, error } = await this.#client.storage.from(bucket).info(key);
    if (error !== null) {
      const status = (error as { status?: number }).status;
      const message = error.message ?? "";
      if (status === 404 || /not.?found|does not exist/i.test(message)) return undefined;
      failV1("storage_unavailable", "Supabase object metadata is unavailable", true);
    }
    if (
      data.name !== key ||
      typeof data.version !== "string" ||
      data.version.length === 0 ||
      !Number.isSafeInteger(data.size) ||
      typeof data.contentType !== "string"
    ) {
      failV1("integrity_mismatch", "Supabase object identity is malformed");
    }
    const metadata = providerMetadataV1(data.metadata);
    if (
      Number(metadata.size_bytes) !== data.size ||
      metadata.media_type !== data.contentType
    ) {
      failV1("integrity_mismatch", "Supabase object metadata drifted from provider facts");
    }
    return Object.freeze({
      bucket,
      key,
      version: data.version,
      size_bytes: data.size,
      media_type: data.contentType,
      metadata,
    });
  }

  public async get(
    head: ProviderObjectHeadV1,
    range?: Readonly<{ offset: number; length: number }>,
  ): Promise<Readonly<{
    body: ObjectByteStreamV1;
    offset: number;
    length: number;
    total_size_bytes: number;
  }>> {
    const encodedKey = head.key.split("/").map(encodeURIComponent).join("/");
    const endpoint = new URL(
      `storage/v1/object/authenticated/${encodeURIComponent(head.bucket)}/${encodedKey}`,
      `${this.#baseUrl.toString().replace(/\/$/u, "")}/`,
    );
    const response = await this.#request(
      endpoint,
      {
        method: "GET",
        headers: this.#headers(
          range === undefined
            ? {}
            : { range: `bytes=${range.offset}-${range.offset + range.length - 1}` },
        ),
      },
      300_000,
    );
    if (!response.ok || response.body === null) {
      if (response.status === 404) failV1("object_not_found", "object was not found");
      failV1("storage_unavailable", "Supabase object bytes are unavailable", true);
    }
    const expectedOffset = range?.offset ?? 0;
    const expectedLength = range?.length ?? head.size_bytes;
    const contentRange = response.headers.get("content-range");
    if (range !== undefined) {
      const parsed = contentRange?.match(/^bytes (\d+)-(\d+)\/(\d+)$/u);
      if (
        parsed === null ||
        parsed === undefined ||
        Number(parsed[1]) !== expectedOffset ||
        Number(parsed[2]) - Number(parsed[1]) + 1 !== expectedLength ||
        Number(parsed[3]) !== head.size_bytes
      ) {
        failV1("integrity_mismatch", "Supabase range response is malformed");
      }
    }
    const reader = response.body.getReader();
    const body = async function* (): ObjectByteStreamV1 {
      try {
        while (true) {
          const next = await reader.read();
          if (next.done) return;
          yield Uint8Array.from(next.value);
        }
      } finally {
        reader.releaseLock();
      }
    };
    return Object.freeze({
      body: body(),
      offset: expectedOffset,
      length: expectedLength,
      total_size_bytes: head.size_bytes,
    });
  }

  public async delete(
    bucket: ObjectStoreBucketV1,
    key: string,
  ): Promise<"deleted" | "already_absent"> {
    const { error } = await this.#client.storage.from(bucket).remove([key]);
    if (error !== null) {
      const status = (error as { status?: number }).status;
      if (status === 404 || /not.?found|does not exist/i.test(error.message ?? "")) {
        return "already_absent";
      }
      failV1("storage_unavailable", "Supabase object deletion outcome is unknown", true);
    }
    return "deleted";
  }

  public async issueReadGrant(
    bucket: ObjectStoreBucketV1,
    key: string,
    ttlSeconds: number,
  ): Promise<string> {
    const { data, error } = await this.#client.storage
      .from(bucket)
      .createSignedUrl(key, ttlSeconds);
    if (error !== null || data.signedUrl.length === 0) {
      failV1("storage_unavailable", "Supabase read grant is unavailable", true);
    }
    return data.signedUrl;
  }
}

export class DurableSupabaseObjectStoreV1 implements ObjectStorePortV1 {
  readonly #repository: PostgresObjectMetadataRepositoryV1;
  readonly #terminalProofReadiness: DurableSupabaseAdapterOptionsV1["terminalProofReadiness"];
  readonly #accessPolicyVerifier: ObjectAccessPolicyVerifierV1;
  readonly #provider: SupabaseTusProviderV1;
  readonly #policies: ReadonlyMap<string, ObjectClassPolicyV1>;
  readonly #now: () => Date;

  public constructor(options: DurableSupabaseAdapterOptionsV1) {
    validateObjectClassPoliciesV1(options.policies);
    this.#repository = options.metadataRepository;
    this.#terminalProofReadiness = options.terminalProofReadiness;
    this.#accessPolicyVerifier = options.accessPolicyVerifier;
    this.#provider = new SupabaseTusProviderV1(
      options.url,
      options.secretKey,
      options.fetch ?? fetch,
      options.allow_insecure_local_docker_transport,
    );
    this.#policies = new Map(
      options.policies.map((policy) => [
        `${policy.owner_service}:${policy.object_class}`,
        policy,
      ]),
    );
    this.#now = options.now ?? (() => new Date());
  }

  #policy(ownerService: string, objectClass: string): ObjectClassPolicyV1 {
    const policy = this.#policies.get(`${ownerService}:${objectClass}`);
    if (policy === undefined) {
      failV1("authorization_scope_mismatch", "object class is not owned by caller");
    }
    return policy;
  }

  #authorizePolicy(
    policy: ObjectClassPolicyV1,
    capability: string,
    operation: "put" | ObjectAccessOperationV1,
  ): void {
    if (!policy.capabilities[operation].includes(capability)) {
      failV1("authorization_scope_mismatch", "object capability was rejected");
    }
  }

  async #verifiedHead(
    request: ObjectReadRequestV1,
    operation: ObjectAccessOperationV1,
    verifyBytes: boolean,
  ): Promise<Readonly<{ head: ProviderObjectHeadV1; policy: ObjectClassPolicyV1 }>> {
    const scopeFingerprint = objectScopeFingerprintV1(request.scope);
    let accessDecision;
    try {
      accessDecision = snapshotAccessDecisionV1(
        await this.#accessPolicyVerifier.verify({
          access_decision_ref: request.access_decision_ref,
          operation,
          object_ref: request.object_ref,
          owner_service: request.owner_service,
          owner_object_id: request.owner_object_id,
          owner_state_version: request.owner_state_version,
          scope: request.scope,
          scope_fingerprint: scopeFingerprint,
          capability: request.capability,
          retention_policy_version: request.retention_policy_version,
          redaction_policy_version: request.redaction_policy_version,
        }),
      );
    } catch {
      failV1("authorization_scope_mismatch", "object authorization was rejected");
    }
    if (
      accessDecision.access_decision_ref !== request.access_decision_ref ||
      accessDecision.operation !== operation ||
      accessDecision.object_ref !== request.object_ref ||
      accessDecision.owner_service !== request.owner_service ||
      accessDecision.owner_object_id !== request.owner_object_id ||
      accessDecision.owner_state_version !== request.owner_state_version ||
      accessDecision.scope_fingerprint !== scopeFingerprint ||
      objectScopeFingerprintV1(accessDecision.scope) !== scopeFingerprint ||
      accessDecision.capability !== request.capability ||
      accessDecision.retention_policy_version !== request.retention_policy_version ||
      accessDecision.redaction_policy_version !== request.redaction_policy_version ||
      !Number.isFinite(Date.parse(accessDecision.retention_until))
    ) {
      failV1("authorization_scope_mismatch", "object authorization was rejected");
    }
    const bucket = bucketFromRefV1(request.object_ref);
    const head = await this.#provider.head(bucket, physicalKeyV1(request.object_ref));
    if (head === undefined) failV1("object_not_found", "object was not found");
    const policy = this.#policy(request.owner_service, head.metadata.object_class);
    if (policy.bucket !== bucket) {
      failV1("authorization_scope_mismatch", "object class bucket is outside the owner policy");
    }
    this.#authorizePolicy(policy, request.capability, operation);
    const metadata = head.metadata;
    if (
      metadata.object_ref !== request.object_ref ||
      metadata.owner_service !== request.owner_service ||
      metadata.owner_object_id !== request.owner_object_id ||
      Number(metadata.owner_state_version) !== request.owner_state_version ||
      metadata.object_class !== policy.object_class ||
      metadata.scope_fingerprint !== `sha256:${scopeFingerprint}` ||
      metadata.retention_until !== accessDecision.retention_until ||
      Number(metadata.size_bytes) !== head.size_bytes ||
      metadata.media_type !== head.media_type
    ) {
      failV1("authorization_scope_mismatch", "object metadata is outside the authorized owner fact");
    }
    if (verifyBytes) await this.#verifyWholeObject(head);
    return Object.freeze({ head, policy });
  }

  async #verifyWholeObject(head: ProviderObjectHeadV1): Promise<void> {
    const streamed = await this.#provider.get(head);
    const digest = createHash("sha256");
    let total = 0;
    for await (const value of streamed.body) {
      if (!(value instanceof Uint8Array)) {
        failV1("integrity_mismatch", "Supabase object returned a malformed byte chunk");
      }
      const chunk = Uint8Array.from(value);
      total += chunk.byteLength;
      if (total > head.size_bytes) {
        failV1("integrity_mismatch", "Supabase object returned excess bytes");
      }
      digest.update(chunk);
    }
    if (
      total !== head.size_bytes ||
      `sha256:${digest.digest("hex")}` !== head.metadata.expected_sha256
    ) {
      failV1("integrity_mismatch", "Supabase object bytes failed digest verification");
    }
  }

  async #resultAfterInlineReconcile(
    identity: ObjectOperationDurableIdentityV1,
    reservationId: string,
  ): Promise<ObjectOperationResultV1> {
    await this.reconcilePending({
      worker_id: "inline-object-store-replay",
      limit: 1,
      lease_seconds: 30,
      reservation_id: reservationId,
    });
    return this.#repository.getObjectOperationResult({
      ...identity,
      caller_kind: "foreground",
    });
  }

  public async putImmutable(
    requestValue: PutImmutableRequestV1,
  ): Promise<PutImmutableResultV1> {
    const request = snapshotPutRequestV1(requestValue);
    const now = currentTimeV1(this.#now);
    if (
      request.owner_service !== this.#repository.ownerService ||
      !tokenPattern.test(request.owner_object_id) ||
      !Number.isSafeInteger(request.owner_state_version) ||
      request.owner_state_version < 1 ||
      !tokenPattern.test(request.idempotency_key) ||
      !sha256Pattern.test(request.expected_sha256) ||
      !Number.isSafeInteger(request.size_bytes) ||
      request.size_bytes < 0 ||
      !mediaTypePattern.test(request.media_type) ||
      !Number.isFinite(Date.parse(request.retention_until)) ||
      Date.parse(request.retention_until) <= now.getTime()
    ) {
      failV1("precondition_failed", "immutable object request is invalid");
    }
    const policy = this.#policy(request.owner_service, request.object_class);
    this.#authorizePolicy(policy, request.capability, "put");
    if (
      !policy.scope_kinds.includes(request.scope.scope_kind) ||
      request.size_bytes > policy.max_size_bytes ||
      !policy.media_types.includes(request.media_type)
    ) {
      failV1("precondition_failed", "object violates class size or media policy");
    }
    const objectFingerprint = objectFingerprintV1(request);
    const requestHash = putRequestHashV1(request, objectFingerprint);
    const identity = durableIdentityV1(request, requestHash, objectFingerprint);
    const {
      deletion_decision_version: _putDeletionDecisionVersion,
      ...putReservationIdentity
    } = identity;
    const foregroundToken = `attempt_${randomUUID()}`;
    let reserved;
    try {
      reserved = await this.#repository.reserveObjectOperation({
        ...putReservationIdentity,
        operation: "put_immutable",
        expected_digest: request.expected_sha256,
        expected_size_bytes: request.size_bytes,
        media_type: request.media_type,
        foreground_lease_token: foregroundToken,
        foreground_lease_seconds: foregroundLeaseSeconds,
      });
    } catch {
      failV1("storage_unavailable", "ObjectStore reservation is unavailable", true);
    }
    if (reserved.kind === "replay") {
      let result = reserved.result;
      if (
        result.status !== "succeeded" &&
        result.status !== "failed" &&
        result.status !== "tombstoned" &&
        result.status !== "dlq"
      ) {
        try {
          result = await this.#resultAfterInlineReconcile(identity, result.reservation_id);
        } catch {
          failV1("storage_unavailable", "ObjectStore reconciliation is pending", true, {
            reconciliation_required: true,
            reservation_id: result.reservation_id,
          });
        }
      }
      const replayed = replayResultV1(result);
      if (replayed === undefined) {
        if (result.status === "failed" || result.status === "dlq") {
          failV1("precondition_failed", "immutable object operation is terminal failed");
        }
        failV1("storage_unavailable", "ObjectStore reconciliation is pending", true, {
          reconciliation_required: true,
          reservation_id: result.reservation_id,
        });
      }
      const policyForReplay = this.#policy(request.owner_service, request.object_class);
      const head = await this.#provider.head(
        policyForReplay.bucket,
        physicalKeyV1(replayed.object_ref),
      );
      if (head === undefined) {
        failV1("integrity_mismatch", "terminal ObjectStore metadata has no physical object");
      }
      await this.#verifyWholeObject(head);
      return Object.freeze({ ...replayed, version: head.version });
    }

    let attempt;
    try {
      attempt = await this.#repository.startObjectOperationAttempt({
        ...identity,
        reservation_id: reserved.reservation_id,
        expected_generation: reserved.generation,
        actor: { actor_kind: "foreground", attempt_token: foregroundToken },
      });
    } catch {
      failV1("storage_unavailable", "ObjectStore attempt could not be fenced", true, {
        reconciliation_required: true,
        reservation_id: reserved.reservation_id,
      });
    }
    const objectRef = opaqueRefV1(policy.bucket, objectFingerprint);
    const key = physicalKeyV1(objectRef);
    const metadata: ProviderMetadataV1 = Object.freeze({
      schema_version: "pai_supabase_object.v1",
      object_ref: objectRef,
      owner_service: request.owner_service,
      owner_object_id: request.owner_object_id,
      owner_state_version: String(request.owner_state_version),
      object_class: request.object_class,
      scope_fingerprint: `sha256:${objectScopeFingerprintV1(request.scope)}`,
      request_hash: requestHash,
      object_fingerprint: objectFingerprint,
      expected_sha256: request.expected_sha256,
      size_bytes: String(request.size_bytes),
      media_type: request.media_type,
      retention_until: request.retention_until,
      reservation_id: reserved.reservation_id,
      attempt_id: attempt.attempt_id,
    });
    let uploadUrl: string;
    try {
      uploadUrl = await this.#provider.createUpload(
        policy.bucket,
        key,
        request.size_bytes,
        request.media_type,
        metadata,
      );
    } catch (error) {
      const outcome = terminalFailureV1(
        "put_immutable",
        "rejected_before_commit",
        "provider_upload_creation_rejected",
      );
      try {
        await this.#repository.finalizeObjectOperation({
          ...identity,
          reservation_id: reserved.reservation_id,
          attempt_id: attempt.attempt_id,
          expected_generation: attempt.generation,
          actor: { actor_kind: "foreground", attempt_token: foregroundToken },
          outcome,
        });
      } catch {
        failV1("storage_unavailable", "ObjectStore terminal failure requires reconciliation", true, {
          reconciliation_required: true,
          reservation_id: reserved.reservation_id,
        });
      }
      throw error;
    }

    let marked: ObjectOperationResultV1;
    try {
      marked = await this.#repository.markObjectOperationCommitUnknown({
        ...identity,
        reservation_id: reserved.reservation_id,
        attempt_id: attempt.attempt_id,
        expected_generation: attempt.generation,
        actor: { actor_kind: "foreground", attempt_token: foregroundToken },
        provider_request_id: uploadUrl,
        physical_object_fingerprint: objectFingerprint,
      });
    } catch {
      await this.#provider.terminateUpload(uploadUrl).catch(() => false);
      failV1("storage_unavailable", "ObjectStore provider attempt was not durably bound", true, {
        reconciliation_required: true,
        reservation_id: reserved.reservation_id,
      });
    }

    try {
      await this.#provider.upload(
        uploadUrl,
        request.body,
        request.size_bytes,
        request.expected_sha256,
        {
          bucket: policy.bucket,
          key,
          mediaType: request.media_type,
          metadata,
        },
      );
      const head = await this.#provider.head(policy.bucket, key);
      if (head === undefined) {
        failV1("storage_unavailable", "Supabase upload completed without a visible object", true);
      }
      if (
        head.metadata.owner_service !== request.owner_service ||
        head.metadata.owner_object_id !== request.owner_object_id ||
        Number(head.metadata.owner_state_version) !== request.owner_state_version ||
        head.metadata.object_class !== request.object_class ||
        head.metadata.scope_fingerprint !== `sha256:${objectScopeFingerprintV1(request.scope)}` ||
        head.metadata.expected_sha256 !== request.expected_sha256 ||
        Number(head.metadata.size_bytes) !== request.size_bytes ||
        head.metadata.media_type !== request.media_type ||
        head.metadata.retention_until !== request.retention_until ||
        head.metadata.reservation_id !== reserved.reservation_id ||
        head.metadata.attempt_id !== attempt.attempt_id ||
        head.metadata.request_hash !== requestHash ||
        head.metadata.object_fingerprint !== objectFingerprint ||
        head.metadata.object_ref !== objectRef
      ) {
        failV1("integrity_mismatch", "Supabase object is not bound to the fenced upload attempt");
      }
      await this.#verifyWholeObject(head);
      const withoutProof = {
        operation: "put_immutable" as const,
        proof_kind: "put_receipt" as const,
        opaque_ref: objectRef,
        provider_receipt_hash: hashJsonV1([
          "pai_supabase_tus_put_receipt.v1",
          uploadUrl,
          head.version,
          head.metadata.attempt_id,
        ]),
        physical_object_fingerprint: objectFingerprint,
        result_digest: request.expected_sha256,
        result_size_bytes: request.size_bytes,
        result_media_type: request.media_type,
      };
      const outcome: ObjectTerminalOutcomeV1 = Object.freeze({
        ...withoutProof,
        proof_hash: hashJsonV1(["pai_terminal_proof.v1", withoutProof]),
      });
      const finalized = await this.#repository.finalizeObjectOperation({
        ...identity,
        reservation_id: reserved.reservation_id,
        attempt_id: attempt.attempt_id,
        expected_generation: marked.generation,
        actor: { actor_kind: "foreground", attempt_token: foregroundToken },
        outcome,
      });
      if (finalized.status !== "succeeded" || finalized.opaque_ref !== objectRef) {
        failV1("integrity_mismatch", "ObjectStore terminal result drifted from its upload receipt");
      }
      return Object.freeze({
        object_ref: objectRef,
        version: head.version,
        sha256: request.expected_sha256,
        size_bytes: request.size_bytes,
        media_type: request.media_type,
        retention_until: request.retention_until,
        replayed: false,
      });
    } catch (error) {
      failV1("storage_unavailable", "Supabase upload outcome requires reconciliation", true, {
        reconciliation_required: true,
        reservation_id: reserved.reservation_id,
        cause_code: error instanceof ObjectStoreErrorV1 ? error.code : "unknown",
      });
    }
  }

  public async head(requestValue: ObjectReadRequestV1): Promise<ObjectHeadV1> {
    const request = snapshotReadRequestV1(requestValue);
    const { head } = await this.#verifiedHead(request, "head", true);
    return Object.freeze({
      object_ref: request.object_ref,
      version: head.version,
      sha256: head.metadata.expected_sha256,
      size_bytes: head.size_bytes,
      media_type: head.media_type,
      retention_until: head.metadata.retention_until,
    });
  }

  public async getStream(
    requestValue: ObjectRangeReadRequestV1,
  ): Promise<ObjectStreamResultV1> {
    const request = snapshotRangeReadRequestV1(requestValue);
    const { head } = await this.#verifiedHead(request, "get", false);
    let range: Readonly<{ offset: number; length: number }> | undefined;
    if (request.range !== undefined) {
      if (
        !Number.isSafeInteger(request.range.offset) ||
        !Number.isSafeInteger(request.range.length) ||
        request.range.offset < 0 ||
        request.range.length < 1 ||
        request.range.offset >= head.size_bytes
      ) {
        failV1("precondition_failed", "invalid object byte range");
      }
      range = Object.freeze({
        offset: request.range.offset,
        length: Math.min(request.range.length, head.size_bytes - request.range.offset),
      });
    }
    const streamed = await this.#provider.get(head, range);
    const expectedDigest = range === undefined ? head.metadata.expected_sha256 : undefined;
    const verified = async function* (): ObjectByteStreamV1 {
      const digest = expectedDigest === undefined ? undefined : createHash("sha256");
      let total = 0;
      for await (const value of streamed.body) {
        if (!(value instanceof Uint8Array)) {
          failV1("integrity_mismatch", "Supabase object returned a malformed byte chunk");
        }
        const chunk = Uint8Array.from(value);
        total += chunk.byteLength;
        if (total > streamed.length) {
          failV1("integrity_mismatch", "Supabase object returned excess bytes");
        }
        digest?.update(chunk);
        yield chunk;
      }
      if (
        total !== streamed.length ||
        (digest !== undefined && `sha256:${digest.digest("hex")}` !== expectedDigest)
      ) {
        failV1("integrity_mismatch", "Supabase object bytes failed digest verification");
      }
    };
    return Object.freeze({
      object_ref: request.object_ref,
      version: head.version,
      sha256: head.metadata.expected_sha256,
      size_bytes: head.size_bytes,
      media_type: head.media_type,
      retention_until: head.metadata.retention_until,
      body: verified(),
      ...(range === undefined
        ? {}
        : {
            content_range: `bytes ${range.offset}-${range.offset + range.length - 1}/${head.size_bytes}`,
          }),
    });
  }

  public async issueReadGrant(
    requestValue: Parameters<ObjectStorePortV1["issueReadGrant"]>[0],
  ): Promise<ObjectReadGrantV1> {
    const request = snapshotGrantRequestV1(requestValue);
    if (
      !Number.isSafeInteger(request.ttl_seconds) ||
      request.ttl_seconds < 1 ||
      request.ttl_seconds > 300
    ) {
      failV1("precondition_failed", "invalid read grant TTL");
    }
    const { head, policy } = await this.#verifiedHead(request, "grant", true);
    const issuedAt = currentTimeV1(this.#now);
    return Object.freeze({
      grant: await this.#provider.issueReadGrant(policy.bucket, head.key, request.ttl_seconds),
      object_ref: request.object_ref,
      expires_at: new Date(issuedAt.getTime() + request.ttl_seconds * 1_000).toISOString(),
    });
  }

  public async deleteIfEligible(
    requestValue: Parameters<ObjectStorePortV1["deleteIfEligible"]>[0],
  ): Promise<Awaited<ReturnType<ObjectStorePortV1["deleteIfEligible"]>>> {
    const request = snapshotDeleteRequestV1(requestValue);
    if (
      request.owner_service !== this.#repository.ownerService ||
      !Number.isSafeInteger(request.deletion_decision_version) ||
      request.deletion_decision_version < 1 ||
      !tokenPattern.test(request.idempotency_key)
    ) {
      failV1("precondition_failed", "invalid deletion decision identity");
    }
    const { head, policy } = await this.#verifiedHead(request, "delete", true);
    const now = currentTimeV1(this.#now);
    if (Date.parse(head.metadata.retention_until) > now.getTime()) {
      failV1("retention_active", "object retention is still active", false, {
        retention_until: head.metadata.retention_until,
      });
    }
    const requestHash = deleteRequestHashV1({
      object_ref: request.object_ref,
      object_fingerprint: head.metadata.object_fingerprint,
      idempotency_key: request.idempotency_key,
      deletion_decision_version: request.deletion_decision_version,
    });
    const identity: ObjectOperationDurableIdentityV1 = Object.freeze({
      contract_version: OBJECT_STORE_METADATA_CONTRACT_VERSION_V1,
      operation: "delete_if_eligible",
      owner_service: request.owner_service as ObjectOperationDurableIdentityV1["owner_service"],
      owner_object_id: request.owner_object_id,
      owner_state_version: request.owner_state_version,
      object_class: head.metadata.object_class,
      scope: request.scope,
      idempotency_key: request.idempotency_key,
      request_hash: requestHash,
      object_fingerprint: head.metadata.object_fingerprint as ObjectOperationDurableIdentityV1["object_fingerprint"],
      expected_digest: head.metadata.expected_sha256 as ObjectOperationDurableIdentityV1["expected_digest"],
      expected_size_bytes: head.size_bytes,
      media_type: head.media_type,
      retention_until: head.metadata.retention_until,
      deletion_decision_version: request.deletion_decision_version,
      gc_not_before: new Date(Math.max(now.getTime(), Date.parse(head.metadata.retention_until))).toISOString(),
    });
    const foregroundToken = `attempt_${randomUUID()}`;
    const reserved = await this.#repository.reserveObjectOperation({
      ...identity,
      operation: "delete_if_eligible",
      expected_digest: head.metadata.expected_sha256,
      expected_size_bytes: head.size_bytes,
      media_type: head.media_type,
      deletion_decision_version: request.deletion_decision_version,
      foreground_lease_token: foregroundToken,
      foreground_lease_seconds: foregroundLeaseSeconds,
    }).catch(() => {
      failV1("storage_unavailable", "ObjectStore deletion reservation is unavailable", true);
    });
    if (reserved.kind === "replay") {
      if (reserved.result.status === "tombstoned") {
        return Object.freeze({ object_ref: request.object_ref, deleted: true, replayed: true });
      }
      failV1("storage_unavailable", "ObjectStore deletion reconciliation is pending", true, {
        reconciliation_required: true,
        reservation_id: reserved.result.reservation_id,
      });
    }
    const attempt = await this.#repository.startObjectOperationAttempt({
      ...identity,
      reservation_id: reserved.reservation_id,
      expected_generation: reserved.generation,
      actor: { actor_kind: "foreground", attempt_token: foregroundToken },
    }).catch(() => {
      failV1("storage_unavailable", "ObjectStore deletion attempt could not be fenced", true, {
        reconciliation_required: true,
        reservation_id: reserved.reservation_id,
      });
    });
    const providerRequestId = `delete:${policy.bucket}:${request.object_ref}`;
    const marked = await this.#repository.markObjectOperationCommitUnknown({
      ...identity,
      reservation_id: reserved.reservation_id,
      attempt_id: attempt.attempt_id,
      expected_generation: attempt.generation,
      actor: { actor_kind: "foreground", attempt_token: foregroundToken },
      provider_request_id: providerRequestId,
      physical_object_fingerprint: head.metadata.object_fingerprint as ObjectOperationDurableIdentityV1["object_fingerprint"],
    }).catch(() => {
      failV1("storage_unavailable", "ObjectStore deletion was not durably bound", true, {
        reconciliation_required: true,
        reservation_id: reserved.reservation_id,
      });
    });
    try {
      const disposition = await this.#provider.delete(policy.bucket, head.key);
      const remaining = await this.#provider.head(policy.bucket, head.key);
      if (remaining !== undefined) {
        failV1("storage_unavailable", "Supabase deletion did not reach verified absence", true);
      }
      const tombstone = Object.freeze({
        schema_version: "object_delete_tombstone.v1" as const,
        object_fingerprint: head.metadata.object_fingerprint as ObjectOperationDurableIdentityV1["object_fingerprint"],
        deletion_decision_version: request.deletion_decision_version,
        result: disposition,
        observed_at: currentTimeV1(this.#now).toISOString(),
      });
      const withoutProof = {
        operation: "delete_if_eligible" as const,
        proof_kind: "delete_tombstone" as const,
        provider_receipt_hash: hashJsonV1([
          "pai_supabase_delete_receipt.v1",
          providerRequestId,
          tombstone,
        ]),
        physical_object_fingerprint: head.metadata.object_fingerprint as ObjectOperationDurableIdentityV1["object_fingerprint"],
        tombstone,
      };
      const outcome: ObjectTerminalOutcomeV1 = Object.freeze({
        ...withoutProof,
        proof_hash: hashJsonV1(["pai_terminal_proof.v1", withoutProof]),
      });
      const finalized = await this.#repository.finalizeObjectOperation({
        ...identity,
        reservation_id: reserved.reservation_id,
        attempt_id: attempt.attempt_id,
        expected_generation: marked.generation,
        actor: { actor_kind: "foreground", attempt_token: foregroundToken },
        outcome,
      });
      if (finalized.status !== "tombstoned") {
        failV1("integrity_mismatch", "ObjectStore deletion proof did not tombstone the reservation");
      }
      return Object.freeze({ object_ref: request.object_ref, deleted: true, replayed: false });
    } catch (error) {
      failV1("storage_unavailable", "Supabase deletion outcome requires reconciliation", true, {
        reconciliation_required: true,
        reservation_id: reserved.reservation_id,
        cause_code: error instanceof ObjectStoreErrorV1 ? error.code : "unknown",
      });
    }
  }

  public async reconcileClaim(
    claim: ObjectReconcileClaimV1,
    signal?: AbortSignal,
  ): Promise<ObjectReconcileSettlementV1> {
    signal?.throwIfAborted();
    let current: ObjectOperationResultV1;
    try {
      current = await this.#repository.getObjectOperationResult({
        contract_version: claim.contract_version,
        caller_kind: "reconciler",
        reservation_id: claim.reservation_id,
        operation: claim.operation,
        owner_service: claim.owner_service,
        owner_object_id: claim.owner_object_id,
        owner_state_version: claim.owner_state_version,
        object_class: claim.object_class,
        scope: claim.scope,
        idempotency_key: claim.idempotency_key,
        request_hash: claim.request_hash,
        object_fingerprint: claim.object_fingerprint,
        expected_digest: claim.expected_digest,
        expected_size_bytes: claim.expected_size_bytes,
        media_type: claim.media_type,
        retention_until: claim.retention_until,
        deletion_decision_version: claim.deletion_decision_version,
        gc_not_before: claim.gc_not_before,
        claim_token: claim.claim_token,
        claim_generation: claim.claim_generation,
      });
    } catch {
      return retrySettlementV1("metadata_result_unavailable");
    }
    const policy = this.#policy(claim.owner_service, claim.object_class);
    const objectRef = opaqueRefV1(policy.bucket, claim.object_fingerprint);
    const key = physicalKeyV1(objectRef);
    const attemptId = `osra_${hashJsonV1([
      claim.reservation_id,
      claim.claim_generation,
      claim.reservation_generation,
    ]).slice(7, 47)}`;
    signal?.throwIfAborted();

    if (claim.operation === "put_immutable") {
      let head: ProviderObjectHeadV1 | undefined;
      try {
        head = await this.#provider.head(policy.bucket, key);
      } catch {
        return retrySettlementV1("physical_object_head_unavailable");
      }
      if (head !== undefined) {
        if (
          claim.expected_digest === null ||
          claim.expected_size_bytes === null ||
          claim.media_type === null ||
          head.metadata.object_ref !== objectRef ||
          head.metadata.owner_service !== claim.owner_service ||
          head.metadata.owner_object_id !== claim.owner_object_id ||
          Number(head.metadata.owner_state_version) !== claim.owner_state_version ||
          head.metadata.object_class !== claim.object_class ||
          head.metadata.scope_fingerprint !== `sha256:${objectScopeFingerprintV1(claim.scope)}` ||
          head.metadata.object_fingerprint !== claim.object_fingerprint ||
          head.metadata.request_hash !== claim.request_hash ||
          head.metadata.expected_sha256 !== claim.expected_digest ||
          head.size_bytes !== claim.expected_size_bytes ||
          head.media_type !== claim.media_type ||
          head.metadata.retention_until !== claim.retention_until ||
          head.metadata.reservation_id !== claim.reservation_id ||
          (current.commit_unknown_evidence !== null &&
            head.metadata.attempt_id !== current.commit_unknown_evidence.attempt_id)
        ) {
          return Object.freeze({
            kind: "dlq" as const,
            reason: "physical_object_fingerprint_drift",
            error: failureV1("physical_object_fingerprint_drift", false),
          });
        }
        try {
          await this.#verifyWholeObject(head);
        } catch {
          return Object.freeze({
            kind: "dlq" as const,
            reason: "physical_object_digest_drift",
            error: failureV1("physical_object_digest_drift", false),
          });
        }
        const withoutProof = {
          operation: "put_immutable" as const,
          proof_kind: "put_receipt" as const,
          opaque_ref: objectRef,
          provider_receipt_hash: hashJsonV1([
            "pai_supabase_reconciled_put_receipt.v1",
            current.commit_unknown_evidence?.provider_request_id,
            head.version,
            head.metadata.attempt_id,
          ]),
          physical_object_fingerprint: claim.object_fingerprint,
          result_digest: claim.expected_digest,
          result_size_bytes: claim.expected_size_bytes,
          result_media_type: claim.media_type,
        };
        return Object.freeze({
          kind: "terminal" as const,
          attempt_id: attemptId,
          outcome: Object.freeze({
            ...withoutProof,
            proof_hash: hashJsonV1(["pai_terminal_proof.v1", withoutProof]),
          }),
        });
      }
      const providerRequestId = current.commit_unknown_evidence?.provider_request_id;
      if (providerRequestId === null || providerRequestId === undefined) {
        return Object.freeze({
          kind: "terminal" as const,
          attempt_id: attemptId,
          outcome: terminalFailureV1(
            "put_immutable",
            "rejected_before_commit",
            "upload_not_started",
          ),
        });
      }
      let terminalized = false;
      try {
        terminalized = await this.#provider.terminateUpload(providerRequestId);
      } catch {
        return retrySettlementV1("upload_termination_unavailable");
      }
      if (!terminalized) return retrySettlementV1("upload_termination_unavailable");
      let afterTermination: ProviderObjectHeadV1 | undefined;
      try {
        afterTermination = await this.#provider.head(policy.bucket, key);
      } catch {
        return retrySettlementV1("post_termination_head_unavailable");
      }
      if (afterTermination !== undefined) {
        return retrySettlementV1("upload_terminal_object_visibility_race");
      }
      return Object.freeze({
        kind: "terminal" as const,
        attempt_id: attemptId,
        outcome: terminalFailureV1(
          "put_immutable",
          "verified_absent",
          "upload_terminal_without_object",
        ),
      });
    }

    let existing: ProviderObjectHeadV1 | undefined;
    try {
      existing = await this.#provider.head(policy.bucket, key);
    } catch {
      return retrySettlementV1("delete_head_unavailable");
    }
    let result: "deleted" | "already_absent" = "already_absent";
    if (existing !== undefined) {
      if (
        existing.metadata.object_fingerprint !== claim.object_fingerprint ||
        existing.metadata.request_hash.length === 0
      ) {
        return Object.freeze({
          kind: "dlq" as const,
          reason: "delete_fingerprint_drift",
          error: failureV1("delete_fingerprint_drift", false),
        });
      }
      try {
        result = await this.#provider.delete(policy.bucket, key);
      } catch {
        return retrySettlementV1("delete_outcome_unknown");
      }
    }
    let remaining: ProviderObjectHeadV1 | undefined;
    try {
      remaining = await this.#provider.head(policy.bucket, key);
    } catch {
      return retrySettlementV1("delete_verification_head_unavailable");
    }
    if (remaining !== undefined) return retrySettlementV1("delete_not_yet_absent");
    if (claim.deletion_decision_version === null) {
      return Object.freeze({
        kind: "dlq" as const,
        reason: "delete_decision_missing",
        error: failureV1("delete_decision_missing", false),
      });
    }
    const tombstone = Object.freeze({
      schema_version: "object_delete_tombstone.v1" as const,
      object_fingerprint: claim.object_fingerprint,
      deletion_decision_version: claim.deletion_decision_version,
      result,
      observed_at: currentTimeV1(this.#now).toISOString(),
    });
    const withoutProof = {
      operation: "delete_if_eligible" as const,
      proof_kind: "delete_tombstone" as const,
      provider_receipt_hash: hashJsonV1([
        "pai_supabase_reconciled_delete_receipt.v1",
        current.commit_unknown_evidence?.provider_request_id,
        tombstone,
      ]),
      physical_object_fingerprint: claim.object_fingerprint,
      tombstone,
    };
    return Object.freeze({
      kind: "terminal" as const,
      attempt_id: attemptId,
      outcome: Object.freeze({
        ...withoutProof,
        proof_hash: hashJsonV1(["pai_terminal_proof.v1", withoutProof]),
      }),
    });
  }

  public async reconcilePending(
    request: Parameters<ObjectStoreReconciliationPortV1["reconcilePending"]>[0],
    signal?: AbortSignal,
  ): Promise<Awaited<ReturnType<ObjectStoreReconciliationPortV1["reconcilePending"]>>> {
    signal?.throwIfAborted();
    await this.#terminalProofReadiness.reconcileTerminalProofs();
    const handler: ObjectMetadataReconcileHandlerV1 = Object.freeze({
      kind: "object-metadata-reconcile-handler.v1" as const,
      reconcile: (claim: ObjectReconcileClaimV1, claimSignal?: AbortSignal) =>
        this.reconcileClaim(claim, claimSignal),
    });
    const reconciliation = createPostgresObjectMetadataReconciliationAdapterV1({
      repository: this.#repository,
      handler,
    });
    return reconciliation.reconcilePending(request, signal);
  }
}

export function createDurableSupabaseObjectStoreAdapterV1(
  options: DurableSupabaseAdapterOptionsV1,
): ObjectStorePortV1 & ObjectStoreReconciliationPortV1 {
  const adapter = new DurableSupabaseObjectStoreV1(options);
  return Object.freeze({
    putImmutable: adapter.putImmutable.bind(adapter),
    head: adapter.head.bind(adapter),
    getStream: adapter.getStream.bind(adapter),
    issueReadGrant: adapter.issueReadGrant.bind(adapter),
    deleteIfEligible: adapter.deleteIfEligible.bind(adapter),
    reconcilePending: adapter.reconcilePending.bind(adapter),
  });
}
