import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { isProxy } from "node:util/types";

import type {
  ObjectMetadataFailureV1,
  ObjectReconcileClaimV1,
  ObjectReconcileSettlementV1,
  RenewObjectReconcileClaimRequestV1,
  SettleObjectReconcileRequestV1,
} from "../db/metadata-contract.v1.js";
import { OBJECT_STORE_METADATA_CONTRACT_VERSION_V1 } from "../db/metadata-contract.v1.js";
import type {
  ObjectStoreReconciliationPortV1,
  ReconcileObjectStoreRequestV1,
  ReconcileObjectStoreResultV1,
} from "../object-store-port.v1.js";
import type {
  CreatePostgresObjectMetadataRepositoryOptionsV1,
  PostgresObjectMetadataRepositoryV1,
} from "./create-postgres-object-metadata-repository.v1.js";
import {
  createPostgresObjectMetadataRepositoryV1,
  isPostgresObjectMetadataRepositoryV1,
} from "./create-postgres-object-metadata-repository.v1.js";

export interface ObjectMetadataReconcileHandlerV1 {
  readonly kind: "object-metadata-reconcile-handler.v1";
  reconcile(
    claim: ObjectReconcileClaimV1,
    signal?: AbortSignal,
  ): Promise<ObjectReconcileSettlementV1>;
}

export interface CreatePostgresObjectMetadataReconciliationAdapterOptionsV1 {
  readonly repository: PostgresObjectMetadataRepositoryV1;
  readonly handler: ObjectMetadataReconcileHandlerV1;
}

export interface CreatePostgresObjectMetadataRuntimeOptionsV1
  extends CreatePostgresObjectMetadataRepositoryOptionsV1 {
  readonly reconcilerPool: NonNullable<
    CreatePostgresObjectMetadataRepositoryOptionsV1["reconcilerPool"]
  >;
  readonly handler: ObjectMetadataReconcileHandlerV1;
}

export interface PostgresObjectMetadataRuntimeV1 {
  readonly kind: "postgres-object-metadata-runtime.v1";
  readonly repository: PostgresObjectMetadataRepositoryV1;
  readonly reconciliation: ObjectStoreReconciliationPortV1;
}

const reconciliationAdaptersV1 = new WeakSet<object>();

function ownDataValueV1(value: object, key: PropertyKey): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor !== undefined &&
      "value" in descriptor &&
      descriptor.enumerable === true
    ? descriptor.value
    : undefined;
}

function snapshotReconcileRequestV1(
  value: ReconcileObjectStoreRequestV1,
): ReconcileObjectStoreRequestV1 {
  if (typeof value !== "object" || value === null || isProxy(value)) {
    throw new Error("ObjectStore reconciliation request is malformed");
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (
    keys.some((key) => typeof key !== "string") ||
    (keys as string[]).some(
      (key) =>
        !["worker_id", "limit", "lease_seconds", "reservation_id"].includes(
          key,
        ),
    ) ||
    !["worker_id", "limit", "lease_seconds"].every(
      (key) =>
        descriptors[key] !== undefined &&
        "value" in descriptors[key]! &&
        descriptors[key]!.enumerable === true,
    ) ||
    (descriptors.reservation_id !== undefined &&
      (!("value" in descriptors.reservation_id) ||
        descriptors.reservation_id.enumerable !== true))
  ) {
    throw new Error("ObjectStore reconciliation request is malformed");
  }
  const workerId = descriptors.worker_id!.value as unknown;
  const limit = descriptors.limit!.value as unknown;
  const leaseSeconds = descriptors.lease_seconds!.value as unknown;
  const reservationId = descriptors.reservation_id?.value as unknown;
  if (
    typeof workerId !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(workerId) ||
    !Number.isSafeInteger(limit) ||
    (limit as number) < 1 ||
    (limit as number) > 100 ||
    !Number.isSafeInteger(leaseSeconds) ||
    (leaseSeconds as number) < 1 ||
    (leaseSeconds as number) > 3_600 ||
    (reservationId !== undefined &&
      (typeof reservationId !== "string" ||
        reservationId.length < 1 ||
        reservationId.length > 512))
  ) {
    throw new Error("ObjectStore reconciliation request is malformed");
  }
  return Object.freeze({
    worker_id: workerId,
    limit: limit as number,
    lease_seconds: leaseSeconds as number,
    ...(reservationId === undefined
      ? {}
      : { reservation_id: reservationId as string }),
  });
}

function closedFailureV1(error: unknown): ObjectMetadataFailureV1 {
  const label =
    error instanceof Error && error.name.length > 0
      ? error.name.slice(0, 64).toLowerCase().replaceAll(/[^a-z0-9_]+/gu, "_")
      : "unknown_error";
  const errorCode = /^[a-z][a-z0-9_]{0,63}$/u.test(label)
    ? label
    : "unknown_error";
  const digest = createHash("sha256")
    .update(error instanceof Error ? `${error.name}:${error.message}` : typeof error)
    .digest("hex");
  return Object.freeze({
    schema_version: "object_store_failure.v1" as const,
    error_code: errorCode,
    retryable: true,
    failure_hash: `sha256:${digest}` as const,
  });
}

function settlementRequestV1(
  claim: ObjectReconcileClaimV1,
  settlement: ObjectReconcileSettlementV1,
): SettleObjectReconcileRequestV1 {
  return Object.freeze({
    contract_version: OBJECT_STORE_METADATA_CONTRACT_VERSION_V1,
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
    expected_generation: claim.reservation_generation,
    settlement,
  });
}

function renewClaimRequestV1(
  claim: ObjectReconcileClaimV1,
  leaseSeconds: number,
): RenewObjectReconcileClaimRequestV1 {
  return Object.freeze({
    contract_version: OBJECT_STORE_METADATA_CONTRACT_VERSION_V1,
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
    expected_generation: claim.reservation_generation,
    expected_claim_lease_expires_at: claim.claim_lease_expires_at,
    lease_seconds: leaseSeconds,
  });
}

class ObjectReconcileClaimLeaseLostV1 extends Error {
  public constructor(cause: unknown) {
    super("ObjectStore reconcile claim lease was lost", { cause });
    this.name = "ObjectReconcileClaimLeaseLostV1";
  }
}

async function renewClaimWithBudgetV1(
  repository: PostgresObjectMetadataRepositoryV1,
  claim: ObjectReconcileClaimV1,
  leaseSeconds: number,
): Promise<Readonly<{
  claim: ObjectReconcileClaimV1;
  watchdog_ms: number;
}>> {
  const startedAt = performance.now();
  const renewed = await repository.renewObjectReconcileClaim(
    renewClaimRequestV1(claim, leaseSeconds),
  );
  const roundTripMs = Math.max(0, performance.now() - startedAt);
  const databaseNow = Date.parse(renewed.database_now);
  const leaseExpiresAt = Date.parse(renewed.claim_lease_expires_at);
  const databaseLeaseMs = leaseExpiresAt - databaseNow;
  const safetyMs = Math.max(
    100,
    Math.min(5_000, Math.floor(databaseLeaseMs / 10)),
  );
  const watchdogMs = Math.floor(databaseLeaseMs - roundTripMs - safetyMs);
  if (!Number.isSafeInteger(watchdogMs) || watchdogMs < 1) {
    throw new ObjectReconcileClaimLeaseLostV1(
      new Error("renewed claim arrived without a safe execution budget"),
    );
  }
  return Object.freeze({ claim: renewed, watchdog_ms: watchdogMs });
}

function awaitWithAbortV1<T>(
  promise: Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (signal === undefined) return promise;
  signal.throwIfAborted();
  return new Promise<T>((resolve, reject) => {
    const abort = () =>
      reject(signal.reason ?? new Error("ObjectStore reconciliation aborted"));
    signal.addEventListener("abort", abort, { once: true });
    promise.then(resolve, reject).finally(() => {
      signal.removeEventListener("abort", abort);
    });
  });
}

async function executeClaimWithHeartbeatV1(
  repository: PostgresObjectMetadataRepositoryV1,
  reconcileClaim: ObjectMetadataReconcileHandlerV1["reconcile"],
  claimed: ObjectReconcileClaimV1,
  leaseSeconds: number,
  signal?: AbortSignal,
): Promise<Readonly<{
  claim: ObjectReconcileClaimV1;
  settlement: ObjectReconcileSettlementV1;
}>> {
  signal?.throwIfAborted();
  let activeLease = await awaitWithAbortV1(
    renewClaimWithBudgetV1(repository, claimed, leaseSeconds),
    signal,
  );
  let activeClaim = activeLease.claim;
  signal?.throwIfAborted();

  const executionController = new AbortController();
  let stopReason: unknown;
  let rejectStopped!: (reason: unknown) => void;
  const stopped = new Promise<never>((_resolve, reject) => {
    rejectStopped = reject;
  });
  const stop = (reason: unknown) => {
    if (stopReason !== undefined) return;
    stopReason = reason;
    executionController.abort(reason);
    rejectStopped(reason);
  };
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  const armWatchdog = (watchdogMs: number) => {
    if (watchdog !== undefined) clearTimeout(watchdog);
    watchdog = setTimeout(() => {
      stop(
        new ObjectReconcileClaimLeaseLostV1(
          new Error("reconcile claim reached its safety deadline"),
        ),
      );
    }, watchdogMs);
    watchdog.unref();
  };
  armWatchdog(activeLease.watchdog_ms);
  const abortFromCaller = () =>
    stop(signal?.reason ?? new Error("ObjectStore reconciliation aborted"));
  signal?.addEventListener("abort", abortFromCaller, { once: true });

  let renewalInFlight: Promise<void> | undefined;
  const heartbeatIntervalMs = Math.max(
    100,
    Math.floor((leaseSeconds * 1_000) / 3),
  );
  const heartbeat = setInterval(() => {
    if (renewalInFlight !== undefined || stopReason !== undefined) return;
    renewalInFlight = renewClaimWithBudgetV1(
      repository,
      activeClaim,
      leaseSeconds,
    )
      .then((renewed) => {
        if (stopReason !== undefined) return;
        activeLease = renewed;
        activeClaim = renewed.claim;
        armWatchdog(renewed.watchdog_ms);
      })
      .catch((error: unknown) => {
        stop(new ObjectReconcileClaimLeaseLostV1(error));
      })
      .finally(() => {
        renewalInFlight = undefined;
      });
  }, heartbeatIntervalMs);
  heartbeat.unref();

  const handler = Promise.resolve()
    .then(() => reconcileClaim(activeClaim, executionController.signal))
    .catch((error: unknown): ObjectReconcileSettlementV1 => {
      if (executionController.signal.aborted) {
        throw executionController.signal.reason ?? error;
      }
      return Object.freeze({
        kind: "retry_wait" as const,
        retry_delay_seconds: 30,
        error: closedFailureV1(error),
      });
    });
  // A handler is allowed to ignore AbortSignal. The race below stops all DB
  // settlement on lease loss, while this handler sink prevents a late reject
  // from becoming unhandled; its physical operation remains at-least-once.
  void handler.catch(() => undefined);

  let settlement: ObjectReconcileSettlementV1;
  try {
    settlement = await Promise.race([handler, stopped]);
  } finally {
    clearInterval(heartbeat);
    signal?.removeEventListener("abort", abortFromCaller);
    if (renewalInFlight !== undefined) {
      await Promise.race([renewalInFlight, stopped]).catch(() => undefined);
    }
    if (watchdog !== undefined) clearTimeout(watchdog);
  }
  if (stopReason !== undefined) throw stopReason;
  signal?.throwIfAborted();

  // Revalidate with PostgreSQL immediately before the fenced settlement. This
  // also closes the handler-completed-near-expiry window.
  try {
    activeLease = await awaitWithAbortV1(
      renewClaimWithBudgetV1(repository, activeClaim, leaseSeconds),
      signal,
    );
    activeClaim = activeLease.claim;
  } catch (error) {
    throw new ObjectReconcileClaimLeaseLostV1(error);
  }
  signal?.throwIfAborted();
  return Object.freeze({ claim: activeClaim, settlement });
}

/**
 * Executable metadata/reconciliation composition for the shared 0050 schema.
 * It owns no durable state: every restart resumes from a claim returned by
 * PostgreSQL and every ACK is fenced by that claim's generation/token.
 */
export function createPostgresObjectMetadataReconciliationAdapterV1(
  options: CreatePostgresObjectMetadataReconciliationAdapterOptionsV1,
): ObjectStoreReconciliationPortV1 {
  const optionKeys =
    typeof options === "object" && options !== null && !isProxy(options)
      ? Reflect.ownKeys(Object.getOwnPropertyDescriptors(options))
      : [];
  const repositoryValue =
    typeof options === "object" && options !== null
      ? ownDataValueV1(options, "repository")
      : undefined;
  const handlerValue =
    typeof options === "object" && options !== null
      ? ownDataValueV1(options, "handler")
      : undefined;
  const handlerKind =
    typeof handlerValue === "object" && handlerValue !== null
      ? ownDataValueV1(handlerValue, "kind")
      : undefined;
  const handlerReconcile =
    typeof handlerValue === "object" && handlerValue !== null
      ? ownDataValueV1(handlerValue, "reconcile")
      : undefined;
  if (
    typeof options !== "object" ||
    options === null ||
    isProxy(options) ||
    optionKeys.length !== 2 ||
    !optionKeys.includes("repository") ||
    !optionKeys.includes("handler") ||
    !isPostgresObjectMetadataRepositoryV1(repositoryValue) ||
    repositoryValue.reconcilerReady !== true ||
    typeof handlerValue !== "object" ||
    handlerValue === null ||
    isProxy(handlerValue) ||
    handlerKind !== "object-metadata-reconcile-handler.v1" ||
    typeof handlerReconcile !== "function"
  ) {
    throw new Error(
      "PostgreSQL ObjectStore reconciliation requires a branded repository with a separate reconciler pool and an explicit handler",
    );
  }
  const repository = repositoryValue;
  const reconcileClaim = (
    handlerReconcile as ObjectMetadataReconcileHandlerV1["reconcile"]
  ).bind(handlerValue);
  const adapter: ObjectStoreReconciliationPortV1 = Object.freeze({
    async reconcilePending(
      requestValue: ReconcileObjectStoreRequestV1,
      signal?: AbortSignal,
    ): Promise<ReconcileObjectStoreResultV1> {
      signal?.throwIfAborted();
      const request = snapshotReconcileRequestV1(requestValue);
      let claimed = 0;
      let completed = 0;
      let retryScheduled = 0;
      while (claimed < request.limit) {
        signal?.throwIfAborted();
        const claims = await repository.claimExpiredObjectReconcile({
          contract_version: OBJECT_STORE_METADATA_CONTRACT_VERSION_V1,
          worker_id: request.worker_id,
          limit: 1,
          lease_seconds: request.lease_seconds,
          ...(request.reservation_id === undefined
            ? {}
            : { reservation_id: request.reservation_id }),
        });
        const claim = claims[0];
        if (claim === undefined) break;
        claimed += 1;
        const execution = await executeClaimWithHeartbeatV1(
          repository,
          reconcileClaim,
          claim,
          request.lease_seconds,
          signal,
        );
        signal?.throwIfAborted();
        await repository.settleObjectReconcile(
          settlementRequestV1(execution.claim, execution.settlement),
        );
        if (execution.settlement.kind === "retry_wait") retryScheduled += 1;
        else completed += 1;
      }
      return Object.freeze({
        claimed,
        completed,
        retry_scheduled: retryScheduled,
      });
    },
  });
  reconciliationAdaptersV1.add(adapter);
  return adapter;
}

export function isPostgresObjectMetadataReconciliationAdapterV1(
  value: unknown,
): value is ObjectStoreReconciliationPortV1 {
  return (
    typeof value === "object" &&
    value !== null &&
    reconciliationAdaptersV1.has(value)
  );
}

/**
 * Canonical executable wiring for the PostgreSQL metadata half of ObjectStore.
 * The Supabase physical adapter remains a separate, fail-closed boundary until
 * its provider can issue attempt-bound terminal receipts.
 */
export function createPostgresObjectMetadataRuntimeV1(
  options: CreatePostgresObjectMetadataRuntimeOptionsV1,
): PostgresObjectMetadataRuntimeV1 {
  if (typeof options !== "object" || options === null || isProxy(options)) {
    throw new Error("PostgreSQL ObjectStore runtime options are malformed");
  }
  const descriptors = Object.getOwnPropertyDescriptors(options);
  const keys = Reflect.ownKeys(descriptors);
  const required = [
    "pool",
    "reconcilerPool",
    "ownerService",
    "clock",
    "handler",
  ] as const;
  if (
    keys.length !== required.length ||
    keys.some((key) => typeof key !== "string" || !required.includes(key as never)) ||
    required.some(
      (key) =>
        descriptors[key] === undefined ||
        !("value" in descriptors[key]!) ||
        descriptors[key]!.enumerable !== true,
    )
  ) {
    throw new Error("PostgreSQL ObjectStore runtime options are malformed");
  }
  const pool = descriptors.pool!.value as
    CreatePostgresObjectMetadataRepositoryOptionsV1["pool"];
  const reconcilerPool = descriptors.reconcilerPool!.value as NonNullable<
    CreatePostgresObjectMetadataRepositoryOptionsV1["reconcilerPool"]
  >;
  const ownerService = descriptors.ownerService!.value as
    CreatePostgresObjectMetadataRepositoryOptionsV1["ownerService"];
  const clock = descriptors.clock!.value as
    CreatePostgresObjectMetadataRepositoryOptionsV1["clock"];
  const handler = descriptors.handler!.value as ObjectMetadataReconcileHandlerV1;
  const repository = createPostgresObjectMetadataRepositoryV1({
    pool,
    reconcilerPool,
    ownerService,
    clock,
  });
  const reconciliation =
    createPostgresObjectMetadataReconciliationAdapterV1({
      repository,
      handler,
    });
  return Object.freeze({
    kind: "postgres-object-metadata-runtime.v1" as const,
    repository,
    reconciliation,
  });
}
