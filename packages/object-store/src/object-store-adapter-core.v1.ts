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
  type ObjectStoreReconciliationPortV1,
  type ReconcileObjectStoreRequestV1,
  type ReconcileObjectStoreResultV1,
  type ObjectStreamResultV1,
  type PutImmutableRequestV1,
  type PutImmutableResultV1,
} from "./object-store-port.v1.js";

type ObjectOperationV1 = "put" | ObjectAccessOperationV1;

const sha256Pattern = /^sha256:[0-9a-f]{64}$/;
const tokenPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/;
const mediaTypePattern = /^[^\s/]+\/[^\s/]+$/;
const foregroundUploadLeaseMs = 5 * 60_000;
const expiredUploadCleanupGraceMs = 5 * 60_000;

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

function verifyingUploadStream(
  body: AsyncIterable<Uint8Array>,
  expectedSha256: string,
  expectedSize: number,
): {
  readonly body: AsyncIterable<Uint8Array>;
  assertComplete(): void;
  failure(): unknown;
  completed(): boolean;
} {
  const digest = createHash("sha256");
  let total = 0;
  let completed = false;
  let streamFailure: unknown;
  const stream = async function* (): AsyncIterable<Uint8Array> {
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
        yield chunk;
      }
      completed = true;
    } catch (error) {
      streamFailure = error;
      throw error;
    }
  };
  return {
    body: stream(),
    assertComplete() {
      if (streamFailure !== undefined) throw streamFailure;
      const actualSha256 = completed
        ? `sha256:${digest.digest("hex")}`
        : "incomplete";
      if (!completed || total !== expectedSize || actualSha256 !== expectedSha256) {
        streamFailure = new ObjectStoreErrorV1(
          "integrity_mismatch",
          "object body does not match declared integrity",
          false,
        );
        throw streamFailure;
      }
    },
    failure: () => streamFailure,
    completed: () => completed,
  };
}

async function* verifiedReadStream(
  body: AsyncIterable<Uint8Array>,
  expectedLength: number,
  expectedSha256?: string,
): AsyncIterable<Uint8Array> {
  const digest = expectedSha256 === undefined ? undefined : createHash("sha256");
  let total = 0;
  try {
    for await (const chunk of body) {
      total += chunk.byteLength;
      if (total > expectedLength) {
        fail("integrity_mismatch", "object storage returned too many bytes");
      }
      digest?.update(chunk);
      yield chunk;
    }
  } catch (error) {
    if (error instanceof ObjectStoreErrorV1) throw error;
    fail("storage_unavailable", "object storage stream failed", true);
  }
  if (
    total !== expectedLength ||
    (digest !== undefined && `sha256:${digest.digest("hex")}` !== expectedSha256)
  ) {
    fail("integrity_mismatch", "stored object bytes failed integrity verification");
  }
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

export class ObjectStoreAdapterCoreV1
  implements ObjectStorePortV1, ObjectStoreReconciliationPortV1
{
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
    if (
      record.state !== "available" &&
      !(allowDeleted &&
        (record.state === "deleted" || record.state === "delete_pending"))
    ) {
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

  async #readBackVerifiedPhysicalHead(
    record: Pick<
      ObjectMetadataRecordV1,
      "sha256" | "size_bytes" | "media_type"
    >,
    policy: ObjectClassPolicyV1,
    key: string,
  ): Promise<BackendObjectHeadV1> {
    const head = await this.#backend.head(policy.bucket, key);
    const streamed = await this.#backend.get(policy.bucket, key);
    if (
      head.version.length === 0 ||
      head.size_bytes !== record.size_bytes ||
      head.media_type !== record.media_type ||
      streamed.offset !== 0 ||
      streamed.length !== record.size_bytes ||
      streamed.total_size_bytes !== record.size_bytes
    ) {
      fail("integrity_mismatch", "stored object metadata failed read-back verification");
    }
    const digest = createHash("sha256");
    let total = 0;
    for await (const chunk of streamed.body) {
      total += chunk.byteLength;
      if (total > record.size_bytes) {
        fail("integrity_mismatch", "stored object returned too many bytes");
      }
      digest.update(chunk);
    }
    const actualSha256 = `sha256:${digest.digest("hex")}`;
    if (total !== record.size_bytes || actualSha256 !== record.sha256) {
      fail("integrity_mismatch", "stored object bytes failed read-back verification");
    }
    return { ...head, sha256: actualSha256 };
  }

  #startPutForegroundLeaseHeartbeat(input: {
    readonly reservation_id: string;
    readonly foreground_lease_token: string;
  }): Readonly<{ stop(): Promise<unknown> }> {
    let stopped = false;
    let renewalFailure: unknown;
    let inFlight = Promise.resolve();
    const timer = setInterval(() => {
      if (stopped || renewalFailure !== undefined) return;
      inFlight = inFlight.then(async () => {
        const now = this.#now();
        try {
          await this.#metadata.renewPutForegroundLease({
            ...input,
            now,
            foreground_lease_until: new Date(
              now.getTime() + foregroundUploadLeaseMs,
            ),
          });
        } catch (error) {
          renewalFailure = error;
        }
      });
    }, 30_000);
    timer.unref();
    return Object.freeze({
      async stop(): Promise<unknown> {
        if (!stopped) {
          stopped = true;
          clearInterval(timer);
        }
        await inFlight;
        return renewalFailure;
      },
    });
  }

  public async reconcilePending(
    request: ReconcileObjectStoreRequestV1,
  ): Promise<ReconcileObjectStoreResultV1> {
    if (
      !tokenPattern.test(request.worker_id) ||
      !Number.isSafeInteger(request.limit) ||
      request.limit < 1 ||
      request.limit > 100 ||
      !Number.isSafeInteger(request.lease_seconds) ||
      request.lease_seconds < 1 ||
      request.lease_seconds > 300
    ) {
      fail("precondition_failed", "invalid reconciliation claim request");
    }
    const now = this.#now();
    const lockedUntil = new Date(now.getTime() + request.lease_seconds * 1_000);
    let claims;
    try {
      claims = await this.#metadata.claimReconciliation({
        worker_id: request.worker_id,
        now,
        locked_until: lockedUntil,
        limit: request.limit,
        expired_upload_cleanup_not_before: new Date(
          now.getTime() + expiredUploadCleanupGraceMs,
        ),
        ...(request.reservation_id === undefined
          ? {}
          : { reservation_id: request.reservation_id }),
      });
    } catch {
      fail("storage_unavailable", "reconciliation claim is unavailable", true);
    }
    let completed = 0;
    let retryScheduled = 0;
    for (const claim of claims) {
      const policy = this.#policy(
        claim.record.owner_service,
        claim.record.object_class,
      );
      const key = physicalObjectKey(claim.record);
      try {
        if (claim.operation === "put_finalize") {
          let head: BackendObjectHeadV1 | undefined;
          try {
            head = await this.#readBackVerifiedPhysicalHead(
              claim.record,
              policy,
              key,
            );
          } catch (error) {
            if (
              error instanceof ObjectStorageBackendErrorV1 &&
              error.code === "not_found"
            ) {
              await this.#metadata.redirectReconciliation({
                reservation_id: claim.reservation_id,
                claim_token: claim.claim_token,
                operation: "put_cleanup",
                last_error: "pending put was not visible after foreground handoff",
                ...(claim.foreground_upload_may_still_arrive
                  ? {
                      next_retry_at: new Date(
                        now.getTime() + expiredUploadCleanupGraceMs,
                      ),
                    }
                  : {}),
              });
              retryScheduled += 1;
              continue;
            }
            if (
              error instanceof ObjectStoreErrorV1 &&
              error.code === "integrity_mismatch"
            ) {
              await this.#metadata.redirectReconciliation({
                reservation_id: claim.reservation_id,
                claim_token: claim.claim_token,
                operation: "put_cleanup",
                last_error: error.message,
                ...(claim.foreground_upload_may_still_arrive
                  ? {
                      next_retry_at: new Date(
                        now.getTime() + expiredUploadCleanupGraceMs,
                      ),
                    }
                  : {}),
              });
              retryScheduled += 1;
              continue;
            }
            throw error;
          }
          if (
            head.version.length === 0 ||
            head.sha256 !== claim.record.sha256 ||
            head.size_bytes !== claim.record.size_bytes ||
            head.media_type !== claim.record.media_type
          ) {
            await this.#metadata.redirectReconciliation({
              reservation_id: claim.reservation_id,
              claim_token: claim.claim_token,
              operation: "put_cleanup",
              last_error: "pending put physical metadata mismatch",
              ...(claim.foreground_upload_may_still_arrive
                ? {
                    next_retry_at: new Date(
                      now.getTime() + expiredUploadCleanupGraceMs,
                    ),
                  }
                : {}),
            });
            retryScheduled += 1;
            continue;
          }
          await this.#metadata.completeReconciliation({
            reservation_id: claim.reservation_id,
            claim_token: claim.claim_token,
            version: head.version,
          });
        } else {
          if (claim.foreground_upload_may_still_arrive) {
            const terminalAt =
              claim.foreground_upload_terminal_at === undefined
                ? Number.NaN
                : Date.parse(claim.foreground_upload_terminal_at);
            const uploadAttemptToken = claim.upload_attempt_token;
            if (!Number.isFinite(terminalAt) || now.getTime() < terminalAt) {
              await this.#metadata.releaseReconciliation({
                reservation_id: claim.reservation_id,
                claim_token: claim.claim_token,
                last_error:
                  "cleanup retained a tombstone until the foreground upload terminal horizon",
                next_retry_at: new Date(
                  Math.max(
                    now.getTime() + expiredUploadCleanupGraceMs,
                    Number.isFinite(terminalAt) ? terminalAt : now.getTime(),
                  ),
                ),
              });
              retryScheduled += 1;
              continue;
            }
            if (
              uploadAttemptToken === undefined ||
              this.#backend.finalizeAbandonedPutAttempt === undefined
            ) {
              await this.#metadata.releaseReconciliation({
                reservation_id: claim.reservation_id,
                claim_token: claim.claim_token,
                last_error:
                  "cleanup retained tombstone because backend cannot prove the foreground upload attempt is terminal",
                next_retry_at: new Date(
                  now.getTime() + expiredUploadCleanupGraceMs,
                ),
              });
              retryScheduled += 1;
              continue;
            }
            const terminal = await this.#backend.finalizeAbandonedPutAttempt({
              bucket: policy.bucket,
              key,
              upload_attempt_token: uploadAttemptToken,
            });
            if (terminal.kind !== "terminal") {
              await this.#metadata.releaseReconciliation({
                reservation_id: claim.reservation_id,
                claim_token: claim.claim_token,
                last_error:
                  "cleanup retained tombstone because the foreground upload attempt is still active or unknown",
                next_retry_at: new Date(
                  now.getTime() + expiredUploadCleanupGraceMs,
                ),
              });
              retryScheduled += 1;
              continue;
            }
            await this.#metadata.completeReconciliation({
              reservation_id: claim.reservation_id,
              claim_token: claim.claim_token,
              backend_put_terminal_receipt: terminal.receipt,
            });
          } else {
            try {
              await this.#backend.delete(policy.bucket, key);
            } catch (error) {
              if (
                !(error instanceof ObjectStorageBackendErrorV1) ||
                error.code !== "not_found"
              ) {
                throw error;
              }
            }
            await this.#metadata.completeReconciliation({
              reservation_id: claim.reservation_id,
              claim_token: claim.claim_token,
            });
          }
        }
        completed += 1;
      } catch (error) {
        retryScheduled += 1;
        await this.#metadata.releaseReconciliation({
          reservation_id: claim.reservation_id,
          claim_token: claim.claim_token,
          last_error:
            error instanceof Error ? error.message.slice(0, 1_024) : "unknown",
          next_retry_at: new Date(now.getTime() + Math.min(60_000, claim.attempt * 1_000)),
        });
      }
    }
    return {
      claimed: claims.length,
      completed,
      retry_scheduled: retryScheduled,
    };
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
    const upload = verifyingUploadStream(
      request.body,
      request.expected_sha256,
      request.size_bytes,
    );
    const scopeFingerprint = objectScopeFingerprintV1(request.scope);
    const fingerprint = requestFingerprint(request, scopeFingerprint);

    const reservePut = () =>
      this.#metadata.reservePut({
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
        now,
        foreground_lease_until: new Date(
          now.getTime() + foregroundUploadLeaseMs,
        ),
      });
    let reservation;
    try {
      reservation = await reservePut();
    } catch {
      fail("storage_unavailable", "owner metadata is unavailable", true);
    }
    if (reservation.kind === "conflict") {
      fail("idempotency_conflict", "idempotency key was reused with different input");
    }
    if (reservation.kind === "pending") {
      await this.reconcilePending({
        worker_id: "inline-put-retry",
        limit: 1,
        lease_seconds: 30,
        reservation_id: reservation.reservation_id,
      });
      try {
        reservation = await reservePut();
      } catch {
        fail("storage_unavailable", "owner metadata is unavailable", true);
      }
    }
    if (reservation.kind === "pending" || reservation.kind === "busy") {
      fail("precondition_failed", "object reconciliation is still pending", true);
    }
    if (reservation.kind === "conflict") {
      fail("idempotency_conflict", "idempotency key was reused with different input");
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
    const foregroundLeaseHeartbeat =
      this.#startPutForegroundLeaseHeartbeat({
        reservation_id: reservation.reservation_id,
        foreground_lease_token: reservation.foreground_lease_token,
      });
    let head: BackendObjectHeadV1;
    let backendPutCompleted = false;
    try {
      head = await this.#backend.putIfAbsent({
        bucket: policy.bucket,
        key,
        upload_attempt_token: reservation.upload_attempt_token,
        body: upload.body,
        size_bytes: request.size_bytes,
        media_type: request.media_type,
        sha256: request.expected_sha256,
      });
      backendPutCompleted = true;
      upload.assertComplete();
      head = await this.#readBackVerifiedPhysicalHead(
        {
          sha256: request.expected_sha256,
          size_bytes: request.size_bytes,
          media_type: request.media_type,
        },
        policy,
        key,
      );
      const renewalFailure = await foregroundLeaseHeartbeat.stop();
      if (renewalFailure !== undefined) throw renewalFailure;
    } catch (error) {
      await foregroundLeaseHeartbeat.stop();
      if (upload.failure() === undefined && upload.completed()) {
        try {
          upload.assertComplete();
        } catch {
          // The classified integrity failure is handled by the branch below.
        }
      }
      const integrityFailure =
        upload.failure() instanceof ObjectStoreErrorV1
          ? upload.failure()
          : error instanceof ObjectStoreErrorV1 &&
              error.code === "integrity_mismatch"
            ? error
            : undefined;
      if (integrityFailure instanceof ObjectStoreErrorV1) {
        let physicalCleanupComplete = false;
        try {
          await this.#backend.delete(policy.bucket, key);
          physicalCleanupComplete = true;
        } catch (cleanupError) {
          if (
            cleanupError instanceof ObjectStorageBackendErrorV1 &&
            cleanupError.code === "not_found"
          ) {
            physicalCleanupComplete = true;
          }
        }
        if (!physicalCleanupComplete) {
          try {
            await this.#backend.head(policy.bucket, key);
          } catch (cleanupHeadError) {
            if (
              cleanupHeadError instanceof ObjectStorageBackendErrorV1 &&
              cleanupHeadError.code === "not_found"
            ) {
              physicalCleanupComplete = true;
            }
          }
        }
        if (physicalCleanupComplete && backendPutCompleted) {
          await this.#metadata.abortPut(
            reservation.reservation_id,
            reservation.foreground_lease_token,
          );
          throw integrityFailure;
        } else {
          const foregroundUploadMayStillArrive =
            !backendPutCompleted && upload.failure() === undefined;
          await this.#metadata
            .handoffPutReconciliation(
              reservation.reservation_id,
              "put_cleanup",
              reservation.foreground_lease_token,
              foregroundUploadMayStillArrive
                ? new Date(
                    this.#now().getTime() + expiredUploadCleanupGraceMs,
                  )
                : undefined,
              foregroundUploadMayStillArrive,
            )
            .catch(() => undefined);
          fail("storage_unavailable", "integrity cleanup requires reconciliation", true, {
            reconciliation_required: true,
            reservation_id: reservation.reservation_id,
            reconciliation_operation: "put_cleanup",
          });
        }
      }
      if (
        error instanceof ObjectStorageBackendErrorV1 &&
        error.code === "already_exists"
      ) {
        await this.#metadata
          .abortPut(
            reservation.reservation_id,
            reservation.foreground_lease_token,
          )
          .catch(() => undefined);
        fail("precondition_failed", "physical object identity already exists");
      }
      await this.#metadata
        .handoffPutReconciliation(
          reservation.reservation_id,
          "put_finalize",
          reservation.foreground_lease_token,
          new Date(this.#now().getTime() + foregroundUploadLeaseMs),
          !backendPutCompleted,
        )
        .catch(() => undefined);
      fail("storage_unavailable", "object storage outcome requires reconciliation", true, {
        reconciliation_required: true,
        reservation_id: reservation.reservation_id,
      });
    }

    if (
      head.version.length === 0 ||
      head.sha256 !== request.expected_sha256 ||
      head.size_bytes !== request.size_bytes ||
      head.media_type !== request.media_type
    ) {
      try {
        await this.#backend.delete(policy.bucket, key);
        await this.#metadata.abortPut(
          reservation.reservation_id,
          reservation.foreground_lease_token,
        );
        fail("integrity_mismatch", "stored object does not match put request");
      } catch (cleanupError) {
        if (cleanupError instanceof ObjectStoreErrorV1) throw cleanupError;
        await this.#metadata
          .handoffPutReconciliation(
            reservation.reservation_id,
            "put_cleanup",
            reservation.foreground_lease_token,
          )
          .catch(() => undefined);
        fail("storage_unavailable", "integrity cleanup requires reconciliation", true, {
          reconciliation_required: true,
          reservation_id: reservation.reservation_id,
          reconciliation_operation: "put_cleanup",
        });
      }
    }
    try {
      const record = await this.#metadata.completePut({
        reservation_id: reservation.reservation_id,
        foreground_lease_token: reservation.foreground_lease_token,
        version: head.version,
      });
      return resultFromRecord(record, false);
    } catch (error) {
      const finalization = await this.#metadata
        .findPutFinalization(reservation.reservation_id)
        .catch(() => ({ kind: "aborted_or_unknown" as const }));
      if (finalization.kind === "committed") {
        return resultFromRecord(finalization.record, false);
      }
      await this.#metadata
        .handoffPutReconciliation(
          reservation.reservation_id,
          "put_finalize",
          reservation.foreground_lease_token,
        )
        .catch(() => undefined);
      fail("storage_unavailable", "owner metadata finalization requires reconciliation", true, {
        reconciliation_required: true,
        reservation_id: reservation.reservation_id,
        finalization_state: finalization.kind,
      });
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
    let range: { readonly offset: number; readonly length: number } | undefined;
    if (request.range !== undefined) {
      const { offset, length } = request.range;
      if (
        !Number.isSafeInteger(offset) || !Number.isSafeInteger(length) ||
        offset < 0 || length <= 0 || offset >= record.size_bytes
      ) {
        fail("precondition_failed", "invalid object byte range");
      }
      range = { offset, length: Math.min(length, record.size_bytes - offset) };
    }
    let streamed;
    try {
      streamed = await this.#backend.get(
        policy.bucket,
        physicalObjectKey(record),
        range,
      );
    } catch {
      fail("storage_unavailable", "object storage is unavailable", true);
    }
    if (
      streamed.total_size_bytes !== record.size_bytes ||
      streamed.offset !== (range?.offset ?? 0) ||
      streamed.length !== (range?.length ?? record.size_bytes)
    ) {
      fail("integrity_mismatch", "object storage returned inconsistent range metadata");
    }
    const contentRange = range === undefined
      ? undefined
      : `bytes ${range.offset}-${range.offset + range.length - 1}/${record.size_bytes}`;
    return {
      ...publicHead(record),
      body: verifiedReadStream(
        streamed.body,
        streamed.length,
        range === undefined ? record.sha256 : undefined,
      ),
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
    const reserveDelete = () =>
      this.#metadata.reserveDelete({
        object_ref: record.object_ref,
        deletion_decision_version: request.deletion_decision_version,
        idempotency_key: request.idempotency_key,
        now: this.#now(),
      });
    let reservation;
    try {
      reservation = await reserveDelete();
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
    if (reservation.kind === "pending") {
      await this.reconcilePending({
        worker_id: "inline-delete-retry",
        limit: 1,
        lease_seconds: 30,
        reservation_id: reservation.reservation_id,
      });
      try {
        reservation = await reserveDelete();
      } catch {
        fail("storage_unavailable", "owner metadata is unavailable", true);
      }
    }
    if (reservation.kind === "pending" || reservation.kind === "busy") {
      fail("precondition_failed", "object reconciliation is still pending", true);
    }
    if (reservation.kind === "conflict") {
      fail("idempotency_conflict", "deletion identity conflicts with prior decision");
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
        await this.#metadata
          .handoffDeleteReconciliation(reservation.reservation_id)
          .catch(() => undefined);
        fail("storage_unavailable", "object deletion outcome requires reconciliation", true, {
          reconciliation_required: true,
          reservation_id: reservation.reservation_id,
        });
      }
    }
    try {
      await this.#metadata.completeDelete(reservation.reservation_id);
    } catch {
      const finalization = await this.#metadata
        .findDeleteFinalization(reservation.reservation_id)
        .catch(() => ({ kind: "aborted_or_unknown" as const }));
      if (finalization.kind === "committed") {
        return { object_ref: record.object_ref, deleted: true, replayed: false };
      }
      await this.#metadata
        .handoffDeleteReconciliation(reservation.reservation_id)
        .catch(() => undefined);
      fail("storage_unavailable", "owner metadata finalization requires reconciliation", true, {
        reconciliation_required: true,
        reservation_id: reservation.reservation_id,
        finalization_state: finalization.kind,
      });
    }
    return { object_ref: record.object_ref, deleted: true, replayed: false };
  }
}
