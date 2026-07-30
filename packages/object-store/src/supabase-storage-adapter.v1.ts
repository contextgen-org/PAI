import type { SupabaseClient } from "@supabase/supabase-js";
import { isProxy } from "node:util/types";

import {
  isPostgresObjectMetadataRepositoryV1,
  type PostgresObjectMetadataRepositoryV1,
} from "./postgres/create-postgres-object-metadata-repository.v1.js";
import type { ObjectAccessPolicyVerifierV1 } from "./object-access-policy.v1.js";
import {
  ObjectStorageBackendErrorV1,
  type BackendObjectHeadV1,
  type BackendObjectRangeV1,
  type BackendObjectStreamV1,
  type ObjectStorageBackendV1,
  type PutBackendObjectV1,
} from "./object-storage-backend.v1.js";
import type {
  ObjectClassPolicyV1,
  ObjectStoreBucketV1,
} from "./object-store-policy.v1.js";
import type {
  ObjectStorePortV1,
  ObjectStoreReconciliationPortV1,
} from "./object-store-port.v1.js";
import { createDurableSupabaseObjectStoreAdapterV1 } from "./supabase-tus-object-store-adapter.v1.js";

interface SupabaseErrorShape {
  readonly message?: unknown;
  readonly status?: unknown;
  readonly statusCode?: unknown;
}

function asErrorShape(error: unknown): SupabaseErrorShape {
  return typeof error === "object" && error !== null
    ? (error as SupabaseErrorShape)
    : {};
}

function backendFailure(error: unknown): ObjectStorageBackendErrorV1 {
  const value = asErrorShape(error);
  const status = typeof value.status === "number" ? value.status : undefined;
  const code = typeof value.statusCode === "string" ? value.statusCode : "";
  const message = typeof value.message === "string" ? value.message : "";
  if (status === 404 || /not.?found/i.test(`${code} ${message}`)) {
    return new ObjectStorageBackendErrorV1(
      "not_found",
      "Supabase object was not found",
      { cause: error },
    );
  }
  if (
    status === 409 ||
    /already.?exists|duplicate|resourcealreadyexists/i.test(`${code} ${message}`)
  ) {
    return new ObjectStorageBackendErrorV1(
      "already_exists",
      "Supabase object already exists",
      { cause: error },
    );
  }
  return new ObjectStorageBackendErrorV1(
    "unavailable",
    "Supabase Storage request failed",
    { cause: error },
  );
}

export class SupabaseObjectStorageBackendV1 implements ObjectStorageBackendV1 {
  public constructor(
    private readonly client: SupabaseClient,
    private readonly url: string,
    private readonly secretKey: string,
    private readonly fetchImpl: typeof fetch,
  ) {}

  public async putIfAbsent(
    request: PutBackendObjectV1,
  ): Promise<BackendObjectHeadV1> {
    const iterator = request.body[Symbol.asyncIterator]();
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const next = await iterator.next();
          if (next.done) controller.close();
          else controller.enqueue(next.value);
        } catch (error) {
          controller.error(error);
        }
      },
      async cancel() {
        await iterator.return?.();
      },
    });
    const { error } = await this.client.storage
      .from(request.bucket)
      .upload(request.key, stream, {
        cacheControl: "3600",
        contentType: request.media_type,
        upsert: false,
        // This is only an expected digest for diagnostics. The adapter never
        // treats caller-controlled custom metadata as proof of stored bytes.
        metadata: { expected_sha256: request.sha256 },
      });
    if (error !== null) throw backendFailure(error);
    return this.head(request.bucket, request.key);
  }

  public async head(
    bucket: ObjectStoreBucketV1,
    key: string,
  ): Promise<BackendObjectHeadV1> {
    const { data, error } = await this.client.storage.from(bucket).info(key);
    if (error !== null) throw backendFailure(error);
    const size = data.size ?? data.metadata?.size;
    const mediaType = data.contentType ?? data.metadata?.mimetype;
    const sha256 = data.metadata?.expected_sha256;
    if (
      data.version.length === 0 ||
      typeof size !== "number" ||
      !Number.isSafeInteger(size) ||
      typeof mediaType !== "string" ||
      typeof sha256 !== "string"
    ) {
      throw new ObjectStorageBackendErrorV1(
        "unavailable",
        "Supabase object metadata is incomplete",
      );
    }
    return {
      version: data.version,
      size_bytes: size,
      media_type: mediaType,
      sha256,
    };
  }

  public async get(
    bucket: ObjectStoreBucketV1,
    key: string,
    range?: BackendObjectRangeV1,
  ): Promise<BackendObjectStreamV1> {
    const encodedKey = key.split("/").map(encodeURIComponent).join("/");
    const response = await this.fetchImpl(
      `${this.url.replace(/\/$/, "")}/storage/v1/object/authenticated/${encodeURIComponent(bucket)}/${encodedKey}`,
      {
        method: "GET",
        // Never forward the service-role apikey header through a storage
        // redirect. Fetch only strips a limited set of credential headers on
        // cross-origin redirects; the Supabase-specific apikey is not one of
        // them.
        redirect: "error",
        headers: {
          authorization: `Bearer ${this.secretKey}`,
          apikey: this.secretKey,
          ...(range === undefined
            ? {}
            : { range: `bytes=${range.offset}-${range.offset + range.length - 1}` }),
        },
      },
    ).catch((error: unknown) => {
      throw backendFailure(error);
    });
    if (!response.ok || response.body === null) {
      throw backendFailure({ status: response.status, message: response.statusText });
    }
    const contentRange = response.headers.get("content-range");
    const parsedRange = contentRange?.match(/^bytes (\d+)-(\d+)\/(\d+)$/);
    const offset = parsedRange === undefined || parsedRange === null
      ? 0
      : Number(parsedRange[1]);
    const totalSize = parsedRange === undefined || parsedRange === null
      ? Number(response.headers.get("content-length"))
      : Number(parsedRange[3]);
    const length = parsedRange === undefined || parsedRange === null
      ? totalSize
      : Number(parsedRange[2]) - offset + 1;
    if (![offset, length, totalSize].every(Number.isSafeInteger)) {
      throw new ObjectStorageBackendErrorV1(
        "unavailable",
        "Supabase range metadata is incomplete",
      );
    }
    const reader = response.body.getReader();
    const body = async function* (): AsyncIterable<Uint8Array> {
      try {
        while (true) {
          const next = await reader.read();
          if (next.done) return;
          yield next.value;
        }
      } finally {
        reader.releaseLock();
      }
    };
    return { body: body(), offset, length, total_size_bytes: totalSize };
  }

  public async issueReadGrant(
    bucket: ObjectStoreBucketV1,
    key: string,
    ttlSeconds: number,
  ): Promise<string> {
    const { data, error } = await this.client.storage
      .from(bucket)
      .createSignedUrl(key, ttlSeconds);
    if (error !== null) throw backendFailure(error);
    return data.signedUrl;
  }

  public async delete(
    bucket: ObjectStoreBucketV1,
    key: string,
  ): Promise<void> {
    const { error } = await this.client.storage.from(bucket).remove([key]);
    if (error !== null) throw backendFailure(error);
  }
}

export interface SupabaseStorageAdapterOptionsV1 {
  readonly url: string;
  readonly secretKey: string;
  /** Explicitly admits only the fixed local Compose Storage edge origin. */
  readonly allow_insecure_local_docker_transport?: boolean;
  readonly metadataRepository: PostgresObjectMetadataRepositoryV1;
  readonly terminalProofReconciler: ObjectStoreTerminalProofReconcilerV1;
  readonly accessPolicyVerifier: ObjectAccessPolicyVerifierV1;
  readonly policies: readonly ObjectClassPolicyV1[];
  readonly now?: () => Date;
  readonly fetch?: typeof fetch;
}

export interface ObjectStoreTerminalProofReconcilerV1 {
  readonly kind: "object-store-terminal-proof-reconciler.v1";
  /**
   * Must reconcile a provider-issued, attempt-bound terminal receipt. Schema
   * migration, function fingerprint, and worker heartbeat checks are readiness
   * prerequisites only; they are not terminal proof.
   */
  reconcileTerminalProofs(): Promise<void>;
}

export type SupabaseStorageAdapterV1 =
  & ObjectStorePortV1
  & ObjectStoreReconciliationPortV1;

function hasTerminalProofReconcilerV1(
  value: unknown,
): value is ObjectStoreTerminalProofReconcilerV1 {
  if (typeof value !== "object" || value === null || isProxy(value)) {
    return false;
  }
  const kind = Object.getOwnPropertyDescriptor(value, "kind");
  let current: object | null = value;
  let reconcile: PropertyDescriptor | undefined;
  while (current !== null && reconcile === undefined) {
    reconcile = Object.getOwnPropertyDescriptor(
      current,
      "reconcileTerminalProofs",
    );
    current = Object.getPrototypeOf(current);
  }
  return (
    kind !== undefined &&
    "value" in kind &&
    kind.value === "object-store-terminal-proof-reconciler.v1" &&
    reconcile !== undefined &&
    "value" in reconcile &&
    typeof reconcile.value === "function"
  );
}

/** Constructs the production TUS + PostgreSQL ObjectStore adapter. */
export function createSupabaseStorageAdapterV1(
  options: SupabaseStorageAdapterOptionsV1,
): SupabaseStorageAdapterV1 {
  if (typeof options !== "object" || options === null || isProxy(options)) {
    throw new Error(
      "createSupabaseStorageAdapterV1 requires own-data production options",
    );
  }
  const descriptors = Object.getOwnPropertyDescriptors(options);
  for (const key of [
    "url",
    "secretKey",
    "metadataRepository",
    "accessPolicyVerifier",
    "policies",
  ] as const) {
    const descriptor = descriptors[key];
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new Error(
        "createSupabaseStorageAdapterV1 requires own-data production options",
      );
    }
  }
  for (const key of ["now", "fetch", "allow_insecure_local_docker_transport"] as const) {
    const descriptor = descriptors[key];
    if (descriptor !== undefined && !("value" in descriptor)) {
      throw new Error(
        "createSupabaseStorageAdapterV1 requires own-data production options",
      );
    }
  }
  const metadataRepositoryDescriptor = descriptors.metadataRepository;
  const terminalProofReconcilerDescriptor =
    descriptors.terminalProofReconciler;
  if (
    metadataRepositoryDescriptor === undefined ||
    !("value" in metadataRepositoryDescriptor)
  ) {
    throw new Error(
      "createSupabaseStorageAdapterV1 requires own-data production options",
    );
  }
  if (terminalProofReconcilerDescriptor === undefined) {
    throw new Error(
      "createSupabaseStorageAdapterV1 requires an explicit terminal-proof reconciler",
    );
  }
  if (!("value" in terminalProofReconcilerDescriptor)) {
    throw new Error(
      "createSupabaseStorageAdapterV1 requires own-data production options",
    );
  }
  const metadataRepository = metadataRepositoryDescriptor.value as unknown;
  const terminalProofReconciler =
    terminalProofReconcilerDescriptor.value as unknown;
  const localDockerTransport = descriptors.allow_insecure_local_docker_transport?.value;
  if (
    localDockerTransport !== undefined &&
    typeof localDockerTransport !== "boolean"
  ) {
    throw new Error(
      "createSupabaseStorageAdapterV1 local Docker transport flag must be boolean",
    );
  }
  if (!isPostgresObjectMetadataRepositoryV1(metadataRepository)) {
    throw new Error(
      "createSupabaseStorageAdapterV1 requires the 0050 postgres.v1 metadata repository",
    );
  }
  if (metadataRepository.reconcilerReady !== true) {
    throw new Error(
      "createSupabaseStorageAdapterV1 requires a separately authenticated PostgreSQL reconciler pool",
    );
  }
  if (!hasTerminalProofReconcilerV1(terminalProofReconciler)) {
    throw new Error(
      "createSupabaseStorageAdapterV1 requires an explicit terminal-proof reconciler",
    );
  }
  return createDurableSupabaseObjectStoreAdapterV1({
    url: descriptors.url!.value as string,
    secretKey: descriptors.secretKey!.value as string,
    metadataRepository,
    terminalProofReadiness: terminalProofReconciler,
    accessPolicyVerifier: descriptors.accessPolicyVerifier!.value as ObjectAccessPolicyVerifierV1,
    policies: descriptors.policies!.value as readonly ObjectClassPolicyV1[],
    ...(descriptors.now === undefined
      ? {}
      : { now: descriptors.now.value as () => Date }),
    ...(descriptors.fetch === undefined
      ? {}
      : { fetch: descriptors.fetch.value as typeof fetch }),
    ...(localDockerTransport === undefined
      ? {}
      : { allow_insecure_local_docker_transport: localDockerTransport }),
  });
}

/** @deprecated Use createSupabaseStorageAdapterV1. */
export class SupabaseStorageAdapter {
  public constructor(options: SupabaseStorageAdapterOptionsV1) {
    createSupabaseStorageAdapterV1(options);
  }
}
