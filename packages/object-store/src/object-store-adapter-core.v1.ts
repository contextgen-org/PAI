import { createHash } from "node:crypto";

import type {
  ObjectMetadataRecordV1,
  ObjectMetadataRepositoryV1,
} from "./object-metadata-repository.v1.js";
import type {
  ObjectAccessOperationV1,
  ObjectAccessPolicyVerifierV1,
  VerifiedObjectAccessDecisionV1,
} from "./object-access-policy.v1.js";
import {
  ObjectStorageBackendErrorV1,
  type BackendObjectHeadV1,
  type ObjectStorageBackendV1,
} from "./object-storage-backend.v1.js";
import type { ObjectClassPolicyV1 } from "./object-store-policy.v1.js";
import { validateObjectClassPoliciesV1 } from "./object-store-policy.v1.js";
import {
  ObjectStoreErrorV1,
  type DeleteIfEligibleRequestV1,
  type DeleteIfEligibleResultV1,
  type IssueReadGrantRequestV1,
  type ObjectAuthorizationV1,
  type ObjectHeadV1,
  type ObjectRangeReadRequestV1,
  type ObjectReadGrantV1,
  type ObjectReadRequestV1,
  type ObjectRefV1,
  type ObjectScopeV1,
  type ObjectStorePortV1,
  type ObjectStreamResultV1,
  type PutImmutableRequestV1,
  type PutImmutableResultV1,
} from "./object-store-port.v1.js";

type ObjectOperationV1 = "put" | ObjectAccessOperationV1;

const sha256Pattern = /^sha256:[0-9a-f]{64}$/;
const tokenPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/;
const mediaTypePattern = /^[^\s/]+\/[^\s/]+$/;

function fail(
  code: ObjectStoreErrorV1["code"],
  message: string,
  retryable = false,
  details: Readonly<Record<string, unknown>> = {},
): never {
  throw new ObjectStoreErrorV1(code, message, retryable, details);
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function objectScopeFingerprintV1(scope: ObjectScopeV1): string {
  const canonical =
    scope.scope_kind === "global"
      ? JSON.stringify(["global"])
      : JSON.stringify([
          "bot",
          scope.workspace_id,
          scope.bot_id,
          scope.owner_agent_id,
          scope.deployment_environment,
          scope.release_channel,
        ]);
  return sha256(canonical);
}

function physicalObjectKey(record: {
  readonly scope: ObjectScopeV1;
  readonly scope_fingerprint: string;
  readonly object_class: string;
  readonly object_ref: ObjectRefV1;
}): string {
  return [
    "v1",
    record.scope.scope_kind,
    record.scope_fingerprint,
    record.object_class,
    record.object_ref,
  ].join("/");
}

function requestFingerprint(
  request: PutImmutableRequestV1,
  scopeFingerprint: string,
): string {
  return sha256(
    JSON.stringify([
      request.owner_service,
      request.object_class,
      scopeFingerprint,
      request.idempotency_key,
      request.expected_sha256,
      request.size_bytes,
      request.media_type,
      request.retention_until,
    ]),
  );
}

function resultFromRecord(
  record: ObjectMetadataRecordV1,
  replayed: boolean,
): PutImmutableResultV1 {
  return {
    object_ref: record.object_ref,
    version: record.version,
    sha256: record.sha256,
    size_bytes: record.size_bytes,
    media_type: record.media_type,
    retention_until: record.retention_until,
    replayed,
  };
}

async function consumeAndVerify(
  body: AsyncIterable<Uint8Array>,
  expectedSha256: string,
  expectedSize: number,
): Promise<Uint8Array> {
  const digest = createHash("sha256");
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for await (const chunk of body) {
      if (!(chunk instanceof Uint8Array)) {
        fail("precondition_failed", "object body must yield Uint8Array chunks");
      }
      total += chunk.byteLength;
      if (total > expectedSize) {
        fail("integrity_mismatch", "object body is larger than declared size");
      }
      digest.update(chunk);
      chunks.push(chunk.slice());
    }
  } catch (error) {
    if (error instanceof ObjectStoreErrorV1) throw error;
    fail("storage_unavailable", "object input stream failed", true);
  }

  const actualSha256 = `sha256:${digest.digest("hex")}`;
  if (total !== expectedSize || actualSha256 !== expectedSha256) {
    fail("integrity_mismatch", "object body does not match declared integrity");
  }
  const value = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    value.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return value;
}

function validatePutRequest(request: PutImmutableRequestV1, now: Date): void {
  if (!tokenPattern.test(request.idempotency_key)) {
    fail("precondition_failed", "invalid idempotency key");
  }
  if (!sha256Pattern.test(request.expected_sha256)) {
    fail("precondition_failed", "expected_sha256 must use canonical sha256:<hex>");
  }
  if (!Number.isSafeInteger(request.size_bytes) || request.size_bytes < 0) {
    fail("precondition_failed", "size_bytes must be a non-negative safe integer");
  }
  if (!mediaTypePattern.test(request.media_type)) {
    fail("precondition_failed", "invalid media type");
  }
  const retention = Date.parse(request.retention_until);
  if (!Number.isFinite(retention) || retention <= now.getTime()) {
    fail("precondition_failed", "retention_until must be a future instant");
  }
}

function validateBackendHead(
  record: ObjectMetadataRecordV1,
  head: BackendObjectHeadV1,
): void {
  if (
    head.version !== record.version ||
    head.sha256 !== record.sha256 ||
    head.size_bytes !== record.size_bytes ||
    head.media_type !== record.media_type
  ) {
    fail("integrity_mismatch", "stored object metadata does not match owner metadata");
  }
}

function publicHead(record: ObjectMetadataRecordV1): ObjectHeadV1 {
  return {
    object_ref: record.object_ref,
    version: record.version,
    sha256: record.sha256,
    size_bytes: record.size_bytes,
    media_type: record.media_type,
    retention_until: record.retention_until,
  };
}

export interface ObjectStoreAdapterOptionsV1 {
  readonly backend: ObjectStorageBackendV1;
  readonly metadataRepository: ObjectMetadataRepositoryV1;
  readonly accessPolicyVerifier: ObjectAccessPolicyVerifierV1;
  readonly policies: readonly ObjectClassPolicyV1[];
  readonly now?: () => Date;
}

function snapshotPolicy(policy: ObjectClassPolicyV1): ObjectClassPolicyV1 {
  return Object.freeze({
    ...policy,
    scope_kinds: Object.freeze([...policy.scope_kinds]),
    media_types: Object.freeze([...policy.media_types]),
    capabilities: Object.freeze({
      put: Object.freeze([...policy.capabilities.put]),
      head: Object.freeze([...policy.capabilities.head]),
      get: Object.freeze([...policy.capabilities.get]),
      grant: Object.freeze([...policy.capabilities.grant]),
      delete: Object.freeze([...policy.capabilities.delete]),
    }),
  });
}

export class ObjectStoreAdapterCoreV1 implements ObjectStorePortV1 {
  readonly #backend: ObjectStorageBackendV1;
  readonly #metadata: ObjectMetadataRepositoryV1;
  readonly #accessPolicyVerifier: ObjectAccessPolicyVerifierV1;
  readonly #policies: ReadonlyMap<string, ObjectClassPolicyV1>;
  readonly #now: () => Date;

  public constructor(options: ObjectStoreAdapterOptionsV1) {
    const policies = options.policies.map(snapshotPolicy);
    validateObjectClassPoliciesV1(policies);
    this.#backend = options.backend;
    this.#metadata = options.metadataRepository;
    this.#accessPolicyVerifier = options.accessPolicyVerifier;
    this.#policies = new Map(
      policies.map((policy) => [
        `${policy.owner_service}:${policy.object_class}`,
        policy,
      ]),
    );
    this.#now = options.now ?? (() => new Date());
  }

  #policy(ownerService: string, objectClass: string): ObjectClassPolicyV1 {
    const policy = this.#policies.get(`${ownerService}:${objectClass}`);
    if (policy === undefined) {
      fail("authorization_scope_mismatch", "object class is not owned by caller");
    }
    return policy;
  }

  #authorize(
    policy: ObjectClassPolicyV1,
    authorization: ObjectAuthorizationV1,
    operation: ObjectOperationV1,
  ): void {
    if (
      authorization.owner_service !== policy.owner_service ||
      !policy.capabilities[operation].includes(authorization.capability)
    ) {
      fail("authorization_scope_mismatch", "object authorization was rejected");
    }
  }

  async #authorizedRecord(
    request: ObjectReadRequestV1,
    operation: ObjectAccessOperationV1,
    allowDeleted = false,
  ): Promise<{ record: ObjectMetadataRecordV1; policy: ObjectClassPolicyV1 }> {
    const scopeFingerprint = objectScopeFingerprintV1(request.scope);
    let accessDecision: VerifiedObjectAccessDecisionV1;
    try {
      accessDecision = await this.#accessPolicyVerifier.verify({
        access_decision_ref: request.access_decision_ref,
        operation,
        object_ref: request.object_ref,
        owner_service: request.owner_service,
        scope: request.scope,
        scope_fingerprint: scopeFingerprint,
        capability: request.capability,
        retention_policy_version: request.retention_policy_version,
        redaction_policy_version: request.redaction_policy_version,
      });
    } catch {
      fail("authorization_scope_mismatch", "object authorization was rejected");
    }
    if (
      accessDecision.authorized !== true ||
      accessDecision.access_decision_ref !== request.access_decision_ref ||
      accessDecision.operation !== operation ||
      accessDecision.object_ref !== request.object_ref ||
      accessDecision.owner_service !== request.owner_service ||
      accessDecision.scope_fingerprint !== scopeFingerprint ||
      accessDecision.capability !== request.capability ||
      accessDecision.retention_policy_version !==
        request.retention_policy_version ||
      accessDecision.redaction_policy_version !== request.redaction_policy_version ||
      !tokenPattern.test(request.access_decision_ref) ||
      !tokenPattern.test(request.retention_policy_version) ||
      !tokenPattern.test(request.redaction_policy_version)
    ) {
      fail("authorization_scope_mismatch", "object authorization was rejected");
    }
    let record: ObjectMetadataRecordV1 | undefined;
    try {
      record = await this.#metadata.findByRef(request.object_ref);
    } catch {
      fail("storage_unavailable", "owner metadata is unavailable", true);
    }
    if (record === undefined || (!allowDeleted && record.state === "deleted")) {
      fail("object_not_found", "object was not found");
    }
    if (record.state !== "available" && !(allowDeleted && record.state === "deleted")) {
      fail("precondition_failed", "object is not available", true);
    }
    const policy = this.#policy(record.owner_service, record.object_class);
    this.#authorize(policy, request, operation);
    if (objectScopeFingerprintV1(record.scope) !== record.scope_fingerprint) {
      fail("integrity_mismatch", "owner object scope metadata is inconsistent");
    }
    if (objectScopeFingerprintV1(request.scope) !== record.scope_fingerprint) {
      fail("authorization_scope_mismatch", "object scope does not match caller");
    }
    if (
      accessDecision.retention_until !== record.retention_until ||
      !Number.isFinite(Date.parse(accessDecision.retention_until))
    ) {
      fail("authorization_scope_mismatch", "object retention decision is stale");
    }
    return { record, policy };
  }

  async #backendHead(
    record: ObjectMetadataRecordV1,
    policy: ObjectClassPolicyV1,
  ): Promise<BackendObjectHeadV1> {
    try {
      const head = await this.#backend.head(policy.bucket, physicalObjectKey(record));
      validateBackendHead(record, head);
      return head;
    } catch (error) {
      if (error instanceof ObjectStoreErrorV1) throw error;
      fail("storage_unavailable", "object storage is unavailable", true);
    }
  }

  public async putImmutable(
    request: PutImmutableRequestV1,
  ): Promise<PutImmutableResultV1> {
    const now = this.#now();
    validatePutRequest(request, now);
    const policy = this.#policy(request.owner_service, request.object_class);
    this.#authorize(policy, request, "put");
    if (
      !policy.scope_kinds.includes(request.scope.scope_kind) ||
      request.size_bytes > policy.max_size_bytes ||
      !policy.media_types.includes(request.media_type)
    ) {
      fail("precondition_failed", "object violates class size or media policy");
    }
    const body = await consumeAndVerify(
      request.body,
      request.expected_sha256,
      request.size_bytes,
    );
    const scopeFingerprint = objectScopeFingerprintV1(request.scope);
    const fingerprint = requestFingerprint(request, scopeFingerprint);

    let reservation;
    try {
      reservation = await this.#metadata.reservePut({
        owner_service: request.owner_service,
        object_class: request.object_class,
        scope: request.scope,
        scope_fingerprint: scopeFingerprint,
        idempotency_key: request.idempotency_key,
        request_fingerprint: fingerprint,
        sha256: request.expected_sha256,
        size_bytes: request.size_bytes,
        media_type: request.media_type,
        retention_until: request.retention_until,
      });
    } catch {
      fail("storage_unavailable", "owner metadata is unavailable", true);
    }
    if (reservation.kind === "conflict") {
      fail("idempotency_conflict", "idempotency key was reused with different input");
    }
    if (reservation.kind === "busy") {
      fail("precondition_failed", "an object transition is already in progress", true);
    }
    if (reservation.kind === "replay") {
      return resultFromRecord(reservation.record, true);
    }

    const key = physicalObjectKey({
      scope: request.scope,
      scope_fingerprint: scopeFingerprint,
      object_class: request.object_class,
      object_ref: reservation.object_ref,
    });
    let head: BackendObjectHeadV1;
    try {
      head = await this.#backend.putIfAbsent({
        bucket: policy.bucket,
        key,
        body,
        media_type: request.media_type,
        sha256: request.expected_sha256,
      });
    } catch (error) {
      await this.#metadata.abortPut(reservation.reservation_id).catch(() => undefined);
      if (
        error instanceof ObjectStorageBackendErrorV1 &&
        error.code === "already_exists"
      ) {
        fail("precondition_failed", "physical object identity already exists");
      }
      fail("storage_unavailable", "object storage is unavailable", true);
    }

    try {
      if (
        head.version.length === 0 ||
        head.sha256 !== request.expected_sha256 ||
        head.size_bytes !== request.size_bytes ||
        head.media_type !== request.media_type
      ) {
        fail("integrity_mismatch", "stored object does not match put request");
      }
      const record = await this.#metadata.completePut({
        reservation_id: reservation.reservation_id,
        version: head.version,
      });
      return resultFromRecord(record, false);
    } catch (error) {
      await this.#backend.delete(policy.bucket, key).catch(() => undefined);
      await this.#metadata.abortPut(reservation.reservation_id).catch(() => undefined);
      if (error instanceof ObjectStoreErrorV1) throw error;
      fail("storage_unavailable", "owner metadata commit failed", true);
    }
  }

  public async head(request: ObjectReadRequestV1): Promise<ObjectHeadV1> {
    const { record, policy } = await this.#authorizedRecord(request, "head");
    await this.#backendHead(record, policy);
    return publicHead(record);
  }

  public async getStream(
    request: ObjectRangeReadRequestV1,
  ): Promise<ObjectStreamResultV1> {
    const { record, policy } = await this.#authorizedRecord(request, "get");
    await this.#backendHead(record, policy);
    let body: Uint8Array;
    try {
      body = await this.#backend.get(policy.bucket, physicalObjectKey(record));
    } catch {
      fail("storage_unavailable", "object storage is unavailable", true);
    }
    if (
      body.byteLength !== record.size_bytes ||
      `sha256:${sha256(body)}` !== record.sha256
    ) {
      fail("integrity_mismatch", "stored object bytes failed integrity verification");
    }

    let selected = body;
    let contentRange: string | undefined;
    if (request.range !== undefined) {
      const { offset, length } = request.range;
      if (
        !Number.isSafeInteger(offset) ||
        !Number.isSafeInteger(length) ||
        offset < 0 ||
        length <= 0 ||
        offset >= body.byteLength
      ) {
        fail("precondition_failed", "invalid object byte range");
      }
      const endExclusive = Math.min(body.byteLength, offset + length);
      selected = body.slice(offset, endExclusive);
      contentRange = `bytes ${offset}-${endExclusive - 1}/${body.byteLength}`;
    }
    const stream = async function* (): AsyncIterable<Uint8Array> {
      yield selected;
    };
    return {
      ...publicHead(record),
      body: stream(),
      ...(contentRange === undefined ? {} : { content_range: contentRange }),
    };
  }

  public async issueReadGrant(
    request: IssueReadGrantRequestV1,
  ): Promise<ObjectReadGrantV1> {
    if (
      !Number.isSafeInteger(request.ttl_seconds) ||
      request.ttl_seconds < 1 ||
      request.ttl_seconds > 300 ||
      !tokenPattern.test(request.redaction_policy_version) ||
      !tokenPattern.test(request.retention_policy_version)
    ) {
      fail("precondition_failed", "invalid read grant constraints");
    }
    const { record, policy } = await this.#authorizedRecord(request, "grant");
    await this.#backendHead(record, policy);
    const issuedAt = this.#now();
    let grant: string;
    try {
      grant = await this.#backend.issueReadGrant(
        policy.bucket,
        physicalObjectKey(record),
        request.ttl_seconds,
      );
    } catch {
      fail("storage_unavailable", "object storage is unavailable", true);
    }
    return {
      grant,
      object_ref: record.object_ref,
      expires_at: new Date(issuedAt.getTime() + request.ttl_seconds * 1_000).toISOString(),
    };
  }

  public async deleteIfEligible(
    request: DeleteIfEligibleRequestV1,
  ): Promise<DeleteIfEligibleResultV1> {
    if (
      !tokenPattern.test(request.deletion_decision_version) ||
      !tokenPattern.test(request.idempotency_key)
    ) {
      fail("precondition_failed", "invalid deletion decision identity");
    }
    const { record, policy } = await this.#authorizedRecord(
      request,
      "delete",
      true,
    );
    let reservation;
    try {
      reservation = await this.#metadata.reserveDelete({
        object_ref: record.object_ref,
        deletion_decision_version: request.deletion_decision_version,
        idempotency_key: request.idempotency_key,
        now: this.#now(),
      });
    } catch {
      fail("storage_unavailable", "owner metadata is unavailable", true);
    }
    if (reservation.kind === "not_found") {
      fail("object_not_found", "object was not found");
    }
    if (reservation.kind === "retention_active") {
      fail("retention_active", "object retention is still active", false, {
        retention_until: reservation.retention_until,
      });
    }
    if (reservation.kind === "hold_active") {
      fail("precondition_failed", "object is protected by a legal hold");
    }
    if (reservation.kind === "conflict") {
      fail("idempotency_conflict", "deletion identity conflicts with prior decision");
    }
    if (reservation.kind === "busy") {
      fail("precondition_failed", "an object transition is already in progress", true);
    }
    if (reservation.kind === "replay") {
      return { object_ref: record.object_ref, deleted: true, replayed: true };
    }

    try {
      await this.#backend.delete(policy.bucket, physicalObjectKey(record));
    } catch (error) {
      if (
        !(error instanceof ObjectStorageBackendErrorV1) ||
        error.code !== "not_found"
      ) {
        await this.#metadata.abortDelete(reservation.reservation_id).catch(() => undefined);
        fail("storage_unavailable", "object storage is unavailable", true);
      }
    }
    try {
      await this.#metadata.completeDelete(reservation.reservation_id);
    } catch {
      await this.#metadata.abortDelete(reservation.reservation_id).catch(() => undefined);
      fail("storage_unavailable", "owner metadata commit failed", true);
    }
    return { object_ref: record.object_ref, deleted: true, replayed: false };
  }
}
