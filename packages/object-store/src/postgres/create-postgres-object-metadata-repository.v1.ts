import { isProxy } from "node:util/types";

import type { Pool, PoolClient, QueryResult } from "pg";
import { Value } from "@sinclair/typebox/value";

import {
  ClaimExpiredObjectReconcileRequestV1Schema,
  FinalizeObjectOperationResultV1Schema,
  GetObjectOperationResultRequestV1Schema,
  MarkObjectOperationCommitUnknownRequestV1Schema,
  MarkObjectOperationCommitUnknownResultV1Schema,
  OBJECT_STORE_METADATA_CONTRACT_VERSION_V1,
  ObjectOperationResultV1Schema,
  ObjectReconcileClaimV1Schema,
  ReserveObjectOperationRequestV1Schema,
  ReserveObjectOperationResultV1Schema,
  RenewObjectReconcileClaimRequestV1Schema,
  SettleObjectReconcileRequestV1Schema,
  SettleObjectReconcileResultV1Schema,
  StartObjectOperationAttemptRequestV1Schema,
  StartObjectOperationAttemptResultV1Schema,
  FinalizeObjectOperationRequestV1Schema,
  isClaimExpiredObjectReconcileRequestV1,
  isFinalizeObjectOperationRequestV1,
  isGetObjectOperationResultRequestV1,
  isMarkObjectOperationCommitUnknownRequestV1,
  isObjectReconcileClaimV1,
  isObjectOperationResultV1,
  isObjectTerminalProofV1,
  isReserveObjectOperationRequestV1,
  isRenewObjectReconcileClaimRequestV1,
  isSettleObjectReconcileRequestV1,
  isStartObjectOperationAttemptRequestV1,
  isStartObjectOperationAttemptResultV1,
  type ClaimExpiredObjectReconcileRequestV1,
  type FinalizeObjectOperationRequestV1,
  type GetObjectOperationResultRequestV1,
  type MarkObjectOperationCommitUnknownRequestV1,
  type MarkObjectOperationCommitUnknownResultV1,
  type ObjectMetadataOwnerServiceV1,
  type ObjectOperationDurableIdentityV1,
  type ObjectOperationResultV1,
  type ObjectReconcileClaimV1,
  type ReserveObjectOperationRequestV1,
  type ReserveObjectOperationResultV1,
  type RenewObjectReconcileClaimRequestV1,
  type SettleObjectReconcileRequestV1,
  type SettleObjectReconcileResultV1,
  type StartObjectOperationAttemptRequestV1,
  type StartObjectOperationAttemptResultV1,
  type FinalizeObjectOperationResultV1,
} from "../db/metadata-contract.v1.js";
import {
  OBJECT_STORE_FUNCTION_MANIFESTS_V1,
  OBJECT_STORE_FOREGROUND_ROLE_BINDINGS_V1,
  OBJECT_STORE_WRITER_NAMES_V1,
  type ObjectStoreWriterNameV1,
  type ObjectStoreForegroundRoleV1,
} from "../db/permission-manifest.v1.js";

const postgresObjectMetadataRepositoriesV1 = new WeakSet<object>();
const maxJsonDepthV1 = 32;
const maxJsonNodesV1 = 10_000;
const maxJsonContainerEntriesV1 = 1_000;

type JsonPrimitiveV1 = string | number | boolean | null;
interface FrozenJsonArrayV1 extends ReadonlyArray<FrozenJsonV1> {}
interface FrozenJsonObjectV1 {
  readonly [key: string]: FrozenJsonV1;
}
type FrozenJsonV1 =
  | JsonPrimitiveV1
  | FrozenJsonArrayV1
  | FrozenJsonObjectV1;

export type ObjectMetadataPostgresPoolV1 = Pool | PoolClient;

export interface CreatePostgresObjectMetadataRepositoryOptionsV1 {
  readonly pool: ObjectMetadataPostgresPoolV1;
  /**
   * A separately authenticated `pai_object_store_reconciler_app` pool. Claim,
   * settle, and reconciler result reads fail closed when it is absent.
   */
  readonly reconcilerPool?: ObjectMetadataPostgresPoolV1;
  readonly ownerService: ObjectMetadataOwnerServiceV1;
  readonly clock: () => Date;
}

export interface PostgresObjectMetadataRepositoryV1 {
  readonly kind: "postgres.v1";
  readonly deploymentReadiness: "unverified_pai_infra";
  readonly ownerService: ObjectMetadataOwnerServiceV1;
  readonly expectedRole: ObjectStoreForegroundRoleV1;
  readonly expectedReconcilerRole: "pai_object_store_reconciler_app";
  readonly reconcilerReady: boolean;
  reserveObjectOperation(
    request: ReserveObjectOperationRequestV1,
  ): Promise<ReserveObjectOperationResultV1>;
  startObjectOperationAttempt(
    request: StartObjectOperationAttemptRequestV1,
  ): Promise<StartObjectOperationAttemptResultV1>;
  markObjectOperationCommitUnknown(
    request: MarkObjectOperationCommitUnknownRequestV1,
  ): Promise<ObjectOperationResultV1>;
  finalizeObjectOperation(
    request: FinalizeObjectOperationRequestV1,
  ): Promise<ObjectOperationResultV1>;
  claimExpiredObjectReconcile(
    request: ClaimExpiredObjectReconcileRequestV1,
  ): Promise<readonly ObjectReconcileClaimV1[]>;
  renewObjectReconcileClaim(
    request: RenewObjectReconcileClaimRequestV1,
  ): Promise<ObjectReconcileClaimV1>;
  settleObjectReconcile(
    request: SettleObjectReconcileRequestV1,
  ): Promise<ObjectOperationResultV1>;
  getObjectOperationResult(
    request: GetObjectOperationResultRequestV1,
  ): Promise<ObjectOperationResultV1>;
}

type DurableIdentityV1 = ObjectOperationDurableIdentityV1;

function failContract(message: string): never {
  throw new Error(`ObjectStore PostgreSQL writer contract violation: ${message}`);
}

function ownDataPropertyV1(
  value: object,
  key: PropertyKey,
): unknown {
  let current: object | null = value;
  while (current !== null) {
    const descriptor = Object.getOwnPropertyDescriptor(current, key);
    if (descriptor !== undefined) {
      if (!("value" in descriptor)) {
        failContract(`${String(key)} must be a data property`);
      }
      return descriptor.value;
    }
    current = Object.getPrototypeOf(current);
  }
  return undefined;
}

function snapshotJsonV1(
  value: unknown,
  state: { nodes: number },
  depth = 0,
): FrozenJsonV1 {
  state.nodes += 1;
  if (state.nodes > maxJsonNodesV1 || depth > maxJsonDepthV1) {
    failContract("JSON value exceeds the bounded metadata contract");
  }
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      failContract("JSON numbers must be finite");
    }
    return value;
  }
  if (typeof value !== "object" || isProxy(value)) {
    failContract("metadata must contain only non-proxied JSON values");
  }

  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some((key) => typeof key !== "string")) {
    failContract("metadata must not contain symbol keys");
  }

  if (Array.isArray(value)) {
    const lengthDescriptor = descriptors.length;
    const length = lengthDescriptor?.value;
    if (
      !("value" in (lengthDescriptor ?? {})) ||
      !Number.isSafeInteger(length) ||
      (length as number) < 0 ||
      (length as number) > maxJsonContainerEntriesV1 ||
      keys.length !== (length as number) + 1
    ) {
      failContract("metadata arrays must be bounded and dense");
    }
    const result: FrozenJsonV1[] = [];
    for (let index = 0; index < (length as number); index += 1) {
      const descriptor = descriptors[String(index)];
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        descriptor.enumerable !== true
      ) {
        failContract("metadata arrays must contain own enumerable data items");
      }
      result.push(snapshotJsonV1(descriptor.value, state, depth + 1));
    }
    return Object.freeze(result);
  }

  const prototype = Object.getPrototypeOf(value);
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    keys.length > maxJsonContainerEntriesV1
  ) {
    failContract("metadata objects must be bounded plain objects");
  }
  const result = Object.create(null) as Record<string, FrozenJsonV1>;
  for (const key of keys as string[]) {
    const descriptor = descriptors[key];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      failContract("metadata objects must contain own enumerable data fields");
    }
    result[key] = snapshotJsonV1(descriptor.value, state, depth + 1);
  }
  return Object.freeze(result);
}

function snapshotRequestV1<T>(
  value: T,
  validate: (candidate: unknown) => candidate is T,
  label: string,
): T {
  const snapshot = snapshotJsonV1(value, { nodes: 0 });
  if (!validate(snapshot)) {
    failContract(`${label} request drift`);
  }
  return snapshot as T;
}

function snapshotOptionsV1(
  value: CreatePostgresObjectMetadataRepositoryOptionsV1,
): Readonly<{
  pool: ObjectMetadataPostgresPoolV1;
  query: ObjectMetadataPostgresPoolV1["query"];
  reconcilerPool?: ObjectMetadataPostgresPoolV1;
  reconcilerQuery?: ObjectMetadataPostgresPoolV1["query"];
  ownerService: ObjectMetadataOwnerServiceV1;
  expectedRole: ObjectStoreForegroundRoleV1;
  clock: () => Date;
}> {
  if (typeof value !== "object" || value === null || isProxy(value)) {
    failContract("factory options must be a non-proxied object");
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (
    keys.some((key) => typeof key !== "string") ||
    !["clock", "ownerService", "pool"].every((key) =>
      Object.hasOwn(descriptors, key)
    ) ||
    (keys as string[]).some(
      (key) =>
        !["clock", "ownerService", "pool", "reconcilerPool"].includes(key),
    )
  ) {
    failContract("factory options have unexpected fields");
  }
  for (const key of ["clock", "ownerService", "pool"] as const) {
    const descriptor = descriptors[key];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      failContract(`factory option ${key} must be an own data field`);
    }
  }
  if (
    descriptors.reconcilerPool !== undefined &&
    (!("value" in descriptors.reconcilerPool) ||
      descriptors.reconcilerPool.enumerable !== true)
  ) {
    failContract("factory option reconcilerPool must be an own data field");
  }
  const pool = descriptors.pool!.value as unknown;
  const reconcilerPool = descriptors.reconcilerPool?.value as unknown;
  const ownerService = descriptors.ownerService!.value as unknown;
  const clock = descriptors.clock!.value as unknown;
  if (
    typeof pool !== "object" ||
    pool === null ||
    isProxy(pool) ||
    typeof clock !== "function"
  ) {
    failContract("factory pool or clock is invalid");
  }
  const query = ownDataPropertyV1(pool, "query");
  if (typeof query !== "function") {
    failContract("factory pool must provide a data-method query");
  }
  const reconcilerQuery =
    reconcilerPool === undefined
      ? undefined
      : typeof reconcilerPool === "object" &&
          reconcilerPool !== null &&
          !isProxy(reconcilerPool)
        ? ownDataPropertyV1(reconcilerPool, "query")
        : undefined;
  if (
    reconcilerPool !== undefined &&
    (reconcilerPool === pool ||
      typeof reconcilerQuery !== "function")
  ) {
    failContract(
      "factory reconcilerPool must be a separate pool with a data-method query",
    );
  }
  const binding = OBJECT_STORE_FOREGROUND_ROLE_BINDINGS_V1.find(
    (candidate) => candidate.owner_service === ownerService,
  );
  if (binding === undefined) {
    failContract("ownerService has no 0050 foreground role binding");
  }
  return Object.freeze({
    pool: pool as ObjectMetadataPostgresPoolV1,
    query: query as ObjectMetadataPostgresPoolV1["query"],
    ...(reconcilerPool === undefined
      ? {}
      : {
          reconcilerPool: reconcilerPool as ObjectMetadataPostgresPoolV1,
          reconcilerQuery:
            reconcilerQuery as ObjectMetadataPostgresPoolV1["query"],
        }),
    ownerService: binding.owner_service,
    expectedRole: binding.role,
    clock: clock as () => Date,
  });
}

function currentTimeV1(clock: () => Date): Date {
  const value = clock();
  const milliseconds = value instanceof Date ? value.getTime() : Number.NaN;
  if (!Number.isFinite(milliseconds)) {
    failContract("clock must return a valid Date");
  }
  return new Date(milliseconds);
}

function scopeArgumentsV1(
  scope: ReserveObjectOperationRequestV1["scope"],
): readonly (string | null)[] {
  return scope.scope_kind === "global"
    ? ["global", null, null, null, null, null]
    : [
        "bot",
        scope.workspace_id,
        scope.bot_id,
        scope.owner_agent_id,
        scope.deployment_environment,
        scope.release_channel,
      ];
}

function actorArgumentsV1(
  actor:
    | StartObjectOperationAttemptRequestV1["actor"]
    | MarkObjectOperationCommitUnknownRequestV1["actor"]
    | FinalizeObjectOperationRequestV1["actor"],
): readonly (string | null)[] {
  return actor.actor_kind === "foreground"
    ? ["foreground", actor.attempt_token, null, null]
    : [
        "reconciler",
        null,
        actor.claim_token,
        String(actor.claim_generation),
      ];
}

function durableIdentityFromReserveV1(
  request: ReserveObjectOperationRequestV1,
): DurableIdentityV1 {
  return Object.freeze({
    contract_version: OBJECT_STORE_METADATA_CONTRACT_VERSION_V1,
    operation: request.operation,
    owner_service: request.owner_service,
    owner_object_id: request.owner_object_id,
    owner_state_version: request.owner_state_version,
    object_class: request.object_class,
    scope: request.scope,
    idempotency_key: request.idempotency_key,
    request_hash: request.request_hash,
    object_fingerprint: request.object_fingerprint,
    expected_digest: request.expected_digest ?? null,
    expected_size_bytes: request.expected_size_bytes ?? null,
    media_type: request.media_type ?? null,
    retention_until: request.retention_until,
    deletion_decision_version:
      request.operation === "delete_if_eligible"
        ? request.deletion_decision_version
        : null,
    gc_not_before: request.gc_not_before,
  });
}

function durableIdentityFromRequestV1(
  request:
    | StartObjectOperationAttemptRequestV1
    | MarkObjectOperationCommitUnknownRequestV1
    | FinalizeObjectOperationRequestV1
    | RenewObjectReconcileClaimRequestV1
    | SettleObjectReconcileRequestV1
    | GetObjectOperationResultRequestV1,
): DurableIdentityV1 {
  return Object.freeze({
    contract_version: request.contract_version,
    operation: request.operation,
    owner_service: request.owner_service,
    owner_object_id: request.owner_object_id,
    owner_state_version: request.owner_state_version,
    object_class: request.object_class,
    scope: request.scope,
    idempotency_key: request.idempotency_key,
    request_hash: request.request_hash,
    object_fingerprint: request.object_fingerprint,
    expected_digest: request.expected_digest,
    expected_size_bytes: request.expected_size_bytes,
    media_type: request.media_type,
    retention_until: request.retention_until,
    deletion_decision_version: request.deletion_decision_version,
    gc_not_before: request.gc_not_before,
  });
}

function sameScopeV1(
  left: ReserveObjectOperationRequestV1["scope"],
  right: ReserveObjectOperationRequestV1["scope"],
): boolean {
  if (left.scope_kind !== right.scope_kind) return false;
  return left.scope_kind === "global" ||
    (right.scope_kind === "bot" &&
      left.workspace_id === right.workspace_id &&
      left.bot_id === right.bot_id &&
      left.owner_agent_id === right.owner_agent_id &&
      left.deployment_environment === right.deployment_environment &&
      left.release_channel === right.release_channel);
}

function timestampInstantMicrosecondsV1(value: string): bigint | undefined {
  const fraction =
    /\.(\d{1,6})(?=Z|[+-]\d{2}:\d{2}$)/u.exec(value)?.[1] ?? "";
  const wholeSecond = value.replace(
    /\.\d{1,6}(?=Z|[+-]\d{2}:\d{2}$)/u,
    "",
  );
  const milliseconds = Date.parse(wholeSecond);
  return Number.isFinite(milliseconds)
    ? BigInt(milliseconds) * 1_000n + BigInt(fraction.padEnd(6, "0"))
    : undefined;
}

function sameTimestampInstantV1(left: string, right: string): boolean {
  const leftMicroseconds = timestampInstantMicrosecondsV1(left);
  return (
    leftMicroseconds !== undefined &&
    leftMicroseconds === timestampInstantMicrosecondsV1(right)
  );
}

function timestampAtOrAfterV1(left: string, right: string): boolean {
  const leftMicroseconds = timestampInstantMicrosecondsV1(left);
  const rightMicroseconds = timestampInstantMicrosecondsV1(right);
  return (
    leftMicroseconds !== undefined &&
    rightMicroseconds !== undefined &&
    leftMicroseconds >= rightMicroseconds
  );
}

function assertResultIdentityV1(
  result: DurableIdentityV1,
  identity: DurableIdentityV1,
): void {
  if (
    result.contract_version !== identity.contract_version ||
    result.operation !== identity.operation ||
    result.owner_service !== identity.owner_service ||
    result.owner_object_id !== identity.owner_object_id ||
    result.owner_state_version !== identity.owner_state_version ||
    result.object_class !== identity.object_class ||
    !sameScopeV1(result.scope, identity.scope) ||
    result.idempotency_key !== identity.idempotency_key ||
    result.request_hash !== identity.request_hash ||
    result.object_fingerprint !== identity.object_fingerprint ||
    result.expected_digest !== identity.expected_digest ||
    result.expected_size_bytes !== identity.expected_size_bytes ||
    result.media_type !== identity.media_type ||
    !sameTimestampInstantV1(
      result.retention_until,
      identity.retention_until,
    ) ||
    result.deletion_decision_version !== identity.deletion_decision_version ||
    !sameTimestampInstantV1(result.gc_not_before, identity.gc_not_before)
  ) {
    failContract("writer response is not bound to the foreground identity");
  }
}

function durableIdentityArgumentsV1(
  identity: DurableIdentityV1,
): readonly unknown[] {
  return [
    identity.owner_service,
    identity.owner_object_id,
    String(identity.owner_state_version),
    identity.object_class,
    ...scopeArgumentsV1(identity.scope),
    identity.idempotency_key,
    identity.request_hash,
    identity.object_fingerprint,
    identity.expected_digest,
    identity.expected_size_bytes === null
      ? null
      : String(identity.expected_size_bytes),
    identity.media_type,
    identity.retention_until,
    identity.deletion_decision_version === null
      ? null
      : String(identity.deletion_decision_version),
    identity.gc_not_before,
  ];
}

function sameJsonV1(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (
    left === null ||
    right === null ||
    typeof left !== "object" ||
    typeof right !== "object" ||
    Array.isArray(left) !== Array.isArray(right)
  ) {
    return false;
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((entry, index) => sameJsonV1(entry, right[index]))
    );
  }
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] &&
        sameJsonV1(leftRecord[key], rightRecord[key]),
    )
  );
}

function sameTerminalOutcomeV1(
  left: FinalizeObjectOperationRequestV1["outcome"],
  right: FinalizeObjectOperationRequestV1["outcome"],
): boolean {
  if (
    left.operation !== right.operation ||
    left.proof_kind !== right.proof_kind ||
    left.proof_hash !== right.proof_hash
  ) {
    return false;
  }
  if (left.proof_kind === "put_receipt") {
    return (
      right.proof_kind === "put_receipt" &&
      left.opaque_ref === right.opaque_ref &&
      left.provider_receipt_hash === right.provider_receipt_hash &&
      left.physical_object_fingerprint ===
        right.physical_object_fingerprint &&
      left.result_digest === right.result_digest &&
      left.result_size_bytes === right.result_size_bytes &&
      left.result_media_type === right.result_media_type
    );
  }
  if (left.proof_kind === "delete_tombstone") {
    return (
      right.proof_kind === "delete_tombstone" &&
      left.provider_receipt_hash === right.provider_receipt_hash &&
      (left.physical_object_fingerprint ?? null) ===
        (right.physical_object_fingerprint ?? null) &&
      left.tombstone.schema_version === right.tombstone.schema_version &&
      left.tombstone.object_fingerprint ===
        right.tombstone.object_fingerprint &&
      left.tombstone.deletion_decision_version ===
        right.tombstone.deletion_decision_version &&
      left.tombstone.result === right.tombstone.result &&
      sameTimestampInstantV1(
        left.tombstone.observed_at,
        right.tombstone.observed_at,
      )
    );
  }
  return (
    right.proof_kind === "terminal_failure" &&
    left.provider_receipt_hash === right.provider_receipt_hash &&
    left.provider_terminal_disposition ===
      right.provider_terminal_disposition &&
    sameJsonV1(left.error, right.error)
  );
}

function sameSettlementV1(
  left: SettleObjectReconcileRequestV1["settlement"],
  right: SettleObjectReconcileRequestV1["settlement"],
): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === "terminal") {
    return (
      right.kind === "terminal" &&
      left.attempt_id === right.attempt_id &&
      sameTerminalOutcomeV1(left.outcome, right.outcome)
    );
  }
  if (left.kind === "retry_wait") {
    return (
      right.kind === "retry_wait" &&
      left.retry_delay_seconds === right.retry_delay_seconds &&
      sameJsonV1(left.error, right.error)
    );
  }
  return (
    right.kind === "dlq" &&
    left.reason === right.reason &&
    sameJsonV1(left.error, right.error)
  );
}

function snapshotQueryRowsV1(value: unknown): readonly FrozenJsonV1[] {
  if (typeof value !== "object" || value === null || isProxy(value)) {
    failContract("PostgreSQL query result is malformed");
  }
  const rowsValue = ownDataPropertyV1(value, "rows");
  const rows = snapshotJsonV1(rowsValue, { nodes: 0 });
  if (!Array.isArray(rows)) {
    failContract("PostgreSQL query rows are malformed");
  }
  return Object.freeze(
    rows.map((row) => {
      if (
        typeof row !== "object" ||
        row === null ||
        Array.isArray(row) ||
        Object.keys(row).length !== 1 ||
        !Object.hasOwn(row, "result")
      ) {
        failContract("PostgreSQL writer row must contain only result");
      }
      return row.result;
    }),
  );
}

function snapshotSingleResponseV1<T>(
  rows: readonly FrozenJsonV1[],
  validate: (value: unknown) => boolean,
  label: string,
): T {
  if (rows.length !== 1 || !validate(rows[0])) {
    failContract(`${label} response drift`);
  }
  return rows[0] as T;
}

async function callWriterV1(
  pool: ObjectMetadataPostgresPoolV1,
  query: ObjectMetadataPostgresPoolV1["query"],
  writer: ObjectStoreWriterNameV1,
  argumentsV1: readonly unknown[],
): Promise<readonly FrozenJsonV1[]> {
  const manifest = OBJECT_STORE_FUNCTION_MANIFESTS_V1.find(
    ({ function_name }) => function_name === writer,
  );
  if (
    manifest === undefined ||
    !OBJECT_STORE_WRITER_NAMES_V1.includes(writer) ||
    argumentsV1.length !== manifest.arguments.length
  ) {
    failContract(`writer ABI argument drift: ${writer}`);
  }
  const placeholders = argumentsV1.map(
    (_argument, index) => `$${index + 1}`,
  );
  const sql =
    `SELECT object_store.${writer}(${placeholders.join(", ")}) AS result`;
  const result = await (
    query as (
      this: ObjectMetadataPostgresPoolV1,
      text: string,
      values: unknown[],
    ) => Promise<QueryResult>
  ).call(pool, sql, [...argumentsV1]);
  return snapshotQueryRowsV1(result);
}

async function recoverForegroundResultV1(
  options: Readonly<{
    pool: ObjectMetadataPostgresPoolV1;
    query: ObjectMetadataPostgresPoolV1["query"];
  }>,
  identity: DurableIdentityV1,
): Promise<ObjectOperationResultV1> {
  const rows = await callWriterV1(
    options.pool,
    options.query,
    "get_object_operation_result_v1",
    [
      "foreground",
      identity.operation,
      ...durableIdentityArgumentsV1(identity),
      null,
      null,
      null,
    ],
  );
  const response = snapshotSingleResponseV1<ObjectOperationResultV1>(
    rows,
    isObjectOperationResultV1,
    "get_object_operation_result_v1",
  );
  assertResultIdentityV1(response, identity);
  return response;
}

async function recoverReconcilerResultV1(
  options: Readonly<{
    pool: ObjectMetadataPostgresPoolV1;
    query: ObjectMetadataPostgresPoolV1["query"];
  }>,
  request: SettleObjectReconcileRequestV1,
): Promise<ObjectOperationResultV1> {
  const rows = await callWriterV1(
    options.pool,
    options.query,
    "get_object_operation_result_v1",
    [
      "reconciler",
      request.operation,
      ...durableIdentityArgumentsV1(durableIdentityFromRequestV1(request)),
      request.reservation_id,
      request.claim_token,
      String(request.claim_generation),
    ],
  );
  const response = snapshotSingleResponseV1<ObjectOperationResultV1>(
    rows,
    isObjectOperationResultV1,
    "get_object_operation_result_v1",
  );
  if (
    response.reservation_id !== request.reservation_id ||
    response.operation !== request.operation
  ) {
    failContract("reconciler result reservation drift");
  }
  assertResultIdentityV1(
    response,
    durableIdentityFromRequestV1(request),
  );
  return response;
}

function assertOwnerServiceV1(
  actual: ObjectMetadataOwnerServiceV1,
  expected: ObjectMetadataOwnerServiceV1,
): void {
  if (actual !== expected) {
    failContract("request owner_service does not match the repository role");
  }
}

function reserveResponseSemanticsV1(
  response: ReserveObjectOperationResultV1,
  request: ReserveObjectOperationRequestV1,
  now: Date,
): void {
  const identity = durableIdentityFromReserveV1(request);
  const replay =
    response.kind === "replay" ? response.result : undefined;
  const reservationId =
    response.kind === "reserved"
      ? response.reservation_id
      : replay!.reservation_id;
  const proof =
    response.kind === "replay" ? response.result.terminal_proof : null;
  assertResultIdentityV1(
    response.kind === "reserved" ? response : response.result,
    identity,
  );
  if (
    (response.kind === "reserved" &&
      (response.operation !== request.operation ||
        response.status !== "reserved")) ||
    (response.kind === "replay" &&
      response.result.operation !== request.operation)
  ) {
    failContract("reserve response operation drift");
  }
  if (
    response.kind === "reserved" &&
    Date.parse(response.foreground_lease_expires_at) <= now.getTime()
  ) {
    failContract("reserve response returned an expired foreground lease");
  }
  if (
    proof !== null &&
    (!isObjectTerminalProofV1(proof) ||
      proof.reservation_id !== reservationId ||
      proof.operation !== request.operation)
  ) {
    failContract("reserve replay terminal proof identity drift");
  }
  if (response.kind === "replay") {
    const { status, opaque_ref: opaqueRef } = response.result;
    const terminal =
      status === "succeeded" ||
      status === "failed" ||
      status === "tombstoned";
    if (
      terminal !== (proof !== null) ||
      (status === "succeeded" &&
        (request.operation !== "put_immutable" ||
          proof?.proof_kind !== "put_receipt" ||
          opaqueRef !== proof.opaque_ref)) ||
      (status === "tombstoned" &&
        (request.operation !== "delete_if_eligible" ||
          proof?.proof_kind !== "delete_tombstone" ||
          opaqueRef !== null)) ||
      (status === "failed" && proof?.proof_kind !== "terminal_failure")
    ) {
      failContract("reserve replay terminal semantics drift");
    }
  }
}

function assertOperationResultBaseV1(
  result: ObjectOperationResultV1,
  request:
    | MarkObjectOperationCommitUnknownRequestV1
    | FinalizeObjectOperationRequestV1
    | SettleObjectReconcileRequestV1,
  exactNextGeneration: boolean,
): void {
  if (
    result.reservation_id !== request.reservation_id ||
    result.operation !== request.operation ||
    result.generation < request.expected_generation + 1 ||
    (exactNextGeneration &&
      result.generation !== request.expected_generation + 1)
  ) {
    failContract("writer response reservation or generation drift");
  }
  assertResultIdentityV1(result, durableIdentityFromRequestV1(request));
}

function assertCommitUnknownResultV1(
  result: ObjectOperationResultV1,
  request: MarkObjectOperationCommitUnknownRequestV1,
  exactNextGeneration = false,
): void {
  assertOperationResultBaseV1(result, request, exactNextGeneration);
  const evidence = result.commit_unknown_evidence;
  if (
    evidence === null ||
    evidence.attempt_id !== request.attempt_id ||
    evidence.expected_generation !== request.expected_generation ||
    evidence.provider_request_id !== (request.provider_request_id ?? null) ||
    evidence.provider_receipt_hash !==
      (request.provider_receipt_hash ?? null) ||
    evidence.physical_object_fingerprint !==
      (request.physical_object_fingerprint ?? null) ||
    !sameJsonV1(evidence.error, request.error ?? null) ||
    (exactNextGeneration &&
      (result.status !== "commit_unknown" &&
        result.status !== "reconcile_required")) ||
    (exactNextGeneration && result.terminal_proof !== null) ||
    (result.status !== "commit_unknown" &&
      result.status !== "reconcile_required" &&
      result.status !== "succeeded" &&
      result.status !== "failed" &&
      result.status !== "tombstoned")
  ) {
    failContract("commit-unknown durable evidence drift");
  }
}

function assertTerminalOutcomeProofV1(
  result: ObjectOperationResultV1,
  attemptId: string,
  outcome: FinalizeObjectOperationRequestV1["outcome"],
  identity: DurableIdentityV1,
): void {
  const proof = result.terminal_proof;
  if (
    proof === null ||
    proof.attempt_id !== attemptId ||
    proof.operation !== outcome.operation ||
    proof.proof_kind !== outcome.proof_kind ||
    proof.proof_hash !== outcome.proof_hash
  ) {
    failContract("terminal proof attempt or outcome drift");
  }
  if (outcome.proof_kind === "put_receipt") {
    if (
      result.status !== "succeeded" ||
      proof.opaque_ref !== outcome.opaque_ref ||
      proof.provider_receipt_hash !== outcome.provider_receipt_hash ||
      proof.physical_object_fingerprint !==
        outcome.physical_object_fingerprint ||
      proof.result_digest !== outcome.result_digest ||
      proof.result_size_bytes !== outcome.result_size_bytes ||
      proof.result_media_type !== outcome.result_media_type ||
      proof.provider_terminal_disposition !== null ||
      outcome.result_digest !== identity.expected_digest ||
      outcome.result_size_bytes !== identity.expected_size_bytes ||
      outcome.result_media_type !== identity.media_type ||
      outcome.physical_object_fingerprint !== identity.object_fingerprint ||
      proof.tombstone !== null
    ) {
      failContract("put terminal proof drift");
    }
    return;
  }
  if (outcome.proof_kind === "delete_tombstone") {
    if (
      result.status !== "tombstoned" ||
      proof.opaque_ref !== null ||
      proof.provider_receipt_hash !== outcome.provider_receipt_hash ||
      proof.physical_object_fingerprint !==
        (outcome.physical_object_fingerprint ?? null) ||
      proof.result_media_type !== null ||
      proof.provider_terminal_disposition !== null ||
      proof.tombstone === null ||
      proof.tombstone.schema_version !== outcome.tombstone.schema_version ||
      proof.tombstone.object_fingerprint !==
        outcome.tombstone.object_fingerprint ||
      proof.tombstone.deletion_decision_version !==
        outcome.tombstone.deletion_decision_version ||
      proof.tombstone.result !== outcome.tombstone.result ||
      !sameTimestampInstantV1(
        proof.tombstone.observed_at,
        outcome.tombstone.observed_at,
      ) ||
      (outcome.physical_object_fingerprint !== undefined &&
        outcome.physical_object_fingerprint !== identity.object_fingerprint) ||
      outcome.tombstone.object_fingerprint !== identity.object_fingerprint ||
      outcome.tombstone.deletion_decision_version !==
        identity.deletion_decision_version
    ) {
      failContract("delete terminal proof drift");
    }
    return;
  }
  if (
    result.status !== "failed" ||
    proof.provider_receipt_hash !== outcome.provider_receipt_hash ||
    proof.provider_terminal_disposition !==
      outcome.provider_terminal_disposition
  ) {
    failContract("terminal failure status drift");
  }
}

function assertFinalizeResultV1(
  result: ObjectOperationResultV1,
  request: FinalizeObjectOperationRequestV1,
  exactNextGeneration = false,
): void {
  assertOperationResultBaseV1(result, request, exactNextGeneration);
  assertTerminalOutcomeProofV1(
    result,
    request.attempt_id,
    request.outcome,
    durableIdentityFromRequestV1(request),
  );
}

function assertSettleResultV1(
  result: ObjectOperationResultV1,
  request: SettleObjectReconcileRequestV1,
  exactNextGeneration = false,
): void {
  assertOperationResultBaseV1(result, request, exactNextGeneration);
  if (
    result.reconcile_settlement === null ||
    !sameSettlementV1(result.reconcile_settlement, request.settlement)
  ) {
    failContract("settle durable evidence drift");
  }
  if (request.settlement.kind === "terminal") {
    assertTerminalOutcomeProofV1(
      result,
      request.settlement.attempt_id,
      request.settlement.outcome,
      durableIdentityFromRequestV1(request),
    );
  } else if (
    (request.settlement.kind === "retry_wait" &&
      result.status !== "reconcile_required") ||
    (request.settlement.kind === "dlq" && result.status !== "dlq")
  ) {
    failContract("settle status drift");
  }
}

function assertClaimLeaseV1(
  claim: ObjectReconcileClaimV1,
  leaseSeconds: number,
  label: string,
): void {
  const databaseNow = Date.parse(claim.database_now);
  const leaseExpiresAt = Date.parse(claim.claim_lease_expires_at);
  if (
    !Number.isFinite(databaseNow) ||
    !Number.isFinite(leaseExpiresAt) ||
    leaseExpiresAt <= databaseNow ||
    Math.abs(
      leaseExpiresAt - databaseNow - leaseSeconds * 1_000,
    ) > 1
  ) {
    failContract(`${label} returned a database-time lease duration drift`);
  }
}

/**
 * Creates the version-pinned 0050 ABI client. It invokes exactly eight writer
 * functions and never issues table DML or ad-hoc metadata reads. Construction
 * does not claim that pai-infra deployed those functions; production Storage
 * remains fail-closed until live catalog/migration/heartbeat verification and
 * an attempt-bound physical terminal receipt are available.
 */
export function createPostgresObjectMetadataRepositoryV1(
  optionsValue: CreatePostgresObjectMetadataRepositoryOptionsV1,
): PostgresObjectMetadataRepositoryV1 {
  const options = snapshotOptionsV1(optionsValue);

  const repository: PostgresObjectMetadataRepositoryV1 = Object.freeze({
    kind: "postgres.v1" as const,
    deploymentReadiness: "unverified_pai_infra" as const,
    ownerService: options.ownerService,
    expectedRole: options.expectedRole,
    expectedReconcilerRole: "pai_object_store_reconciler_app" as const,
    reconcilerReady:
      options.reconcilerPool !== undefined &&
      options.reconcilerQuery !== undefined,

    async reserveObjectOperation(
      requestValue: ReserveObjectOperationRequestV1,
    ) {
      const request = snapshotRequestV1(
        requestValue,
        isReserveObjectOperationRequestV1,
        "reserve_object_operation_v1",
      );
      assertOwnerServiceV1(request.owner_service, options.ownerService);
      const now = currentTimeV1(options.clock);
      const identity = durableIdentityFromReserveV1(request);
      let rows: readonly FrozenJsonV1[];
      try {
        rows = await callWriterV1(
          options.pool,
          options.query,
          "reserve_object_operation_v1",
          [
            request.owner_service,
            request.operation,
            request.owner_object_id,
            String(request.owner_state_version),
            request.object_class,
            ...scopeArgumentsV1(request.scope),
            request.idempotency_key,
            request.request_hash,
            request.object_fingerprint,
            request.expected_digest ?? null,
            request.expected_size_bytes === undefined
              ? null
              : String(request.expected_size_bytes),
            request.media_type ?? null,
            request.retention_until,
            request.operation === "delete_if_eligible"
              ? String(request.deletion_decision_version)
              : null,
            request.foreground_lease_token,
            request.foreground_lease_seconds,
            request.gc_not_before,
          ],
        );
      } catch {
        const recovered = await recoverForegroundResultV1(options, identity);
        return Object.freeze({
          kind: "replay" as const,
          result: Object.freeze({
            contract_version: recovered.contract_version,
            reservation_id: recovered.reservation_id,
            operation: recovered.operation,
            owner_service: recovered.owner_service,
            owner_object_id: recovered.owner_object_id,
            owner_state_version: recovered.owner_state_version,
            object_class: recovered.object_class,
            scope: recovered.scope,
            idempotency_key: recovered.idempotency_key,
            request_hash: recovered.request_hash,
            object_fingerprint: recovered.object_fingerprint,
            expected_digest: recovered.expected_digest,
            expected_size_bytes: recovered.expected_size_bytes,
            media_type: recovered.media_type,
            retention_until: recovered.retention_until,
            deletion_decision_version:
              recovered.deletion_decision_version,
            gc_not_before: recovered.gc_not_before,
            status: recovered.status,
            generation: recovered.generation,
            opaque_ref: recovered.opaque_ref,
            terminal_proof: recovered.terminal_proof,
          }),
        });
      }
      const response = snapshotSingleResponseV1<ReserveObjectOperationResultV1>(
        rows,
        (value) => Value.Check(ReserveObjectOperationResultV1Schema, value),
        "reserve_object_operation_v1",
      );
      reserveResponseSemanticsV1(response, request, now);
      return response;
    },

    async startObjectOperationAttempt(
      requestValue: StartObjectOperationAttemptRequestV1,
    ) {
      const request = snapshotRequestV1(
        requestValue,
        isStartObjectOperationAttemptRequestV1,
        "start_object_operation_attempt_v1",
      );
      currentTimeV1(options.clock);
      assertOwnerServiceV1(request.owner_service, options.ownerService);
      if (request.expected_generation >= Number.MAX_SAFE_INTEGER) {
        failContract("start attempt generation is exhausted");
      }
      const identity = durableIdentityFromRequestV1(request);
      const argumentsV1 = [
        request.reservation_id,
        request.operation,
        String(request.expected_generation),
        ...durableIdentityArgumentsV1(identity),
        ...actorArgumentsV1(request.actor),
      ];
      let rows: readonly FrozenJsonV1[];
      try {
        rows = await callWriterV1(
          options.pool,
          options.query,
          "start_object_operation_attempt_v1",
          argumentsV1,
        );
      } catch {
        // The attempt token/claim fence makes this retry an idempotent
        // commit-unknown convergence, including after a process restart.
        rows = await callWriterV1(
          options.pool,
          options.query,
          "start_object_operation_attempt_v1",
          argumentsV1,
        );
      }
      const response =
        snapshotSingleResponseV1<StartObjectOperationAttemptResultV1>(
          rows,
          isStartObjectOperationAttemptResultV1,
          "start_object_operation_attempt_v1",
        );
      if (
        response.reservation_id !== request.reservation_id ||
        response.operation !== request.operation ||
        response.generation !== request.expected_generation + 1
      ) {
        failContract("start attempt response identity or generation drift");
      }
      assertResultIdentityV1(response, identity);
      return response;
    },

    async markObjectOperationCommitUnknown(
      requestValue: MarkObjectOperationCommitUnknownRequestV1,
    ) {
      const request = snapshotRequestV1(
        requestValue,
        isMarkObjectOperationCommitUnknownRequestV1,
        "mark_object_operation_commit_unknown_v1",
      );
      currentTimeV1(options.clock);
      assertOwnerServiceV1(request.owner_service, options.ownerService);
      if (request.expected_generation >= Number.MAX_SAFE_INTEGER) {
        failContract("commit-unknown generation is exhausted");
      }
      const identity = durableIdentityFromRequestV1(request);
      let rows: readonly FrozenJsonV1[];
      try {
        rows = await callWriterV1(
          options.pool,
          options.query,
          "mark_object_operation_commit_unknown_v1",
          [
            request.reservation_id,
            request.attempt_id,
            request.operation,
            String(request.expected_generation),
            ...durableIdentityArgumentsV1(identity),
            ...actorArgumentsV1(request.actor),
            request.provider_request_id ?? null,
            request.provider_receipt_hash ?? null,
            request.physical_object_fingerprint ?? null,
            request.error ?? null,
          ],
        );
      } catch {
        const recovered = await recoverForegroundResultV1(options, identity);
        assertCommitUnknownResultV1(recovered, request);
        return recovered;
      }
      const response =
        snapshotSingleResponseV1<MarkObjectOperationCommitUnknownResultV1>(
        rows,
        (value) =>
          Value.Check(
            MarkObjectOperationCommitUnknownResultV1Schema,
            value,
          ),
        "mark_object_operation_commit_unknown_v1",
      );
      if (!isObjectOperationResultV1(response.result)) {
        failContract("mark commit-unknown result semantics drift");
      }
      if (
        response.attempt_id !== request.attempt_id ||
        response.expected_generation !== request.expected_generation ||
        response.provider_request_id !==
          (request.provider_request_id ?? null) ||
        response.provider_receipt_hash !==
          (request.provider_receipt_hash ?? null) ||
        response.physical_object_fingerprint !==
          (request.physical_object_fingerprint ?? null) ||
        !sameJsonV1(response.error, request.error ?? null)
      ) {
        failContract("commit-unknown response evidence drift");
      }
      assertCommitUnknownResultV1(response.result, request, true);
      return response.result;
    },

    async finalizeObjectOperation(
      requestValue: FinalizeObjectOperationRequestV1,
    ) {
      const request = snapshotRequestV1(
        requestValue,
        isFinalizeObjectOperationRequestV1,
        "finalize_object_operation_v1",
      );
      currentTimeV1(options.clock);
      assertOwnerServiceV1(request.owner_service, options.ownerService);
      if (request.expected_generation >= Number.MAX_SAFE_INTEGER) {
        failContract("finalize generation is exhausted");
      }
      const identity = durableIdentityFromRequestV1(request);
      let rows: readonly FrozenJsonV1[];
      try {
        rows = await callWriterV1(
          options.pool,
          options.query,
          "finalize_object_operation_v1",
          [
            request.reservation_id,
            request.attempt_id,
            request.operation,
            String(request.expected_generation),
            ...durableIdentityArgumentsV1(identity),
            ...actorArgumentsV1(request.actor),
            request.outcome,
          ],
        );
      } catch {
        const recovered = await recoverForegroundResultV1(options, identity);
        assertFinalizeResultV1(recovered, request);
        return recovered;
      }
      const response = snapshotSingleResponseV1<FinalizeObjectOperationResultV1>(
        rows,
        (value) =>
          Value.Check(FinalizeObjectOperationResultV1Schema, value),
        "finalize_object_operation_v1",
      );
      if (!isObjectOperationResultV1(response.result)) {
        failContract("finalize result semantics drift");
      }
      if (
        response.attempt_id !== request.attempt_id ||
        response.expected_generation !== request.expected_generation ||
        !sameTerminalOutcomeV1(response.outcome, request.outcome)
      ) {
        failContract("finalize response evidence drift");
      }
      assertFinalizeResultV1(response.result, request, true);
      return response.result;
    },

    async claimExpiredObjectReconcile(
      requestValue: ClaimExpiredObjectReconcileRequestV1,
    ) {
      const request = snapshotRequestV1(
        requestValue,
        isClaimExpiredObjectReconcileRequestV1,
        "claim_expired_object_reconcile_v1",
      );
      if (
        options.reconcilerPool === undefined ||
        options.reconcilerQuery === undefined
      ) {
        failContract("reconciler pool is not configured");
      }
      const rows = await callWriterV1(
        options.reconcilerPool,
        options.reconcilerQuery,
        "claim_expired_object_reconcile_v1",
        [
          request.worker_id,
          request.limit,
          request.lease_seconds,
          request.reservation_id ?? null,
        ],
      );
      if (
        rows.length > request.limit ||
        !Value.Check(
          ClaimExpiredObjectReconcileRequestV1Schema,
          request,
        )
      ) {
        failContract("claim_expired_object_reconcile_v1 response size drift");
      }
      const claims = rows.map((row) => {
        if (!isObjectReconcileClaimV1(row)) {
          failContract("claim_expired_object_reconcile_v1 response drift");
        }
        const claim = row as ObjectReconcileClaimV1;
        if (
          (request.reservation_id !== undefined &&
            claim.reservation_id !== request.reservation_id)
        ) {
          failContract("reconcile claim lease or reservation drift");
        }
        assertClaimLeaseV1(
          claim,
          request.lease_seconds,
          "claim_expired_object_reconcile_v1",
        );
        return claim;
      });
      if (
        new Set(claims.map(({ reservation_id }) => reservation_id)).size !==
          claims.length ||
        new Set(claims.map(({ claim_token }) => claim_token)).size !==
          claims.length
      ) {
        failContract("reconcile claims contain duplicate fences");
      }
      return Object.freeze(claims);
    },

    async renewObjectReconcileClaim(
      requestValue: RenewObjectReconcileClaimRequestV1,
    ) {
      const request = snapshotRequestV1(
        requestValue,
        isRenewObjectReconcileClaimRequestV1,
        "renew_object_reconcile_claim_v1",
      );
      if (
        options.reconcilerPool === undefined ||
        options.reconcilerQuery === undefined
      ) {
        failContract("reconciler pool is not configured");
      }
      const identity = durableIdentityFromRequestV1(request);
      const argumentsV1 = [
        request.reservation_id,
        request.operation,
        request.claim_token,
        String(request.claim_generation),
        String(request.expected_generation),
        ...durableIdentityArgumentsV1(identity),
        request.expected_claim_lease_expires_at,
        request.lease_seconds,
      ];
      let rows: readonly FrozenJsonV1[];
      try {
        rows = await callWriterV1(
          options.reconcilerPool,
          options.reconcilerQuery,
          "renew_object_reconcile_claim_v1",
          argumentsV1,
        );
      } catch {
        // Renewal is replayable for the same token/generation and expected
        // prior expiry, so a commit-then-disconnect converges on the live row.
        rows = await callWriterV1(
          options.reconcilerPool,
          options.reconcilerQuery,
          "renew_object_reconcile_claim_v1",
          argumentsV1,
        );
      }
      const claim = snapshotSingleResponseV1<ObjectReconcileClaimV1>(
        rows,
        isObjectReconcileClaimV1,
        "renew_object_reconcile_claim_v1",
      );
      if (
        claim.reservation_id !== request.reservation_id ||
        claim.operation !== request.operation ||
        claim.claim_token !== request.claim_token ||
        claim.claim_generation !== request.claim_generation ||
        claim.reservation_generation !== request.expected_generation ||
        !timestampAtOrAfterV1(
          claim.claim_lease_expires_at,
          request.expected_claim_lease_expires_at,
        )
      ) {
        failContract("renewed reconcile claim fence drift");
      }
      assertResultIdentityV1(claim, identity);
      assertClaimLeaseV1(
        claim,
        request.lease_seconds,
        "renew_object_reconcile_claim_v1",
      );
      return claim;
    },

    async settleObjectReconcile(
      requestValue: SettleObjectReconcileRequestV1,
    ) {
      const request = snapshotRequestV1(
        requestValue,
        isSettleObjectReconcileRequestV1,
        "settle_object_reconcile_v1",
      );
      currentTimeV1(options.clock);
      if (request.expected_generation >= Number.MAX_SAFE_INTEGER) {
        failContract("settle generation is exhausted");
      }
      const identity = durableIdentityFromRequestV1(request);
      if (
        options.reconcilerPool === undefined ||
        options.reconcilerQuery === undefined
      ) {
        failContract("reconciler pool is not configured");
      }
      let rows: readonly FrozenJsonV1[];
      try {
        rows = await callWriterV1(
          options.reconcilerPool,
          options.reconcilerQuery,
          "settle_object_reconcile_v1",
          [
            request.reservation_id,
            request.operation,
            request.claim_token,
            String(request.claim_generation),
            String(request.expected_generation),
            ...durableIdentityArgumentsV1(identity),
            request.settlement,
          ],
        );
      } catch {
        const recovered = await recoverReconcilerResultV1({
          pool: options.reconcilerPool,
          query: options.reconcilerQuery,
        }, request);
        assertSettleResultV1(recovered, request);
        return recovered;
      }
      const response = snapshotSingleResponseV1<SettleObjectReconcileResultV1>(
        rows,
        (value) => Value.Check(SettleObjectReconcileResultV1Schema, value),
        "settle_object_reconcile_v1",
      );
      if (!isObjectOperationResultV1(response.result)) {
        failContract("settle result semantics drift");
      }
      if (
        response.claim_generation !== request.claim_generation ||
        response.expected_generation !== request.expected_generation ||
        !sameSettlementV1(response.settlement, request.settlement)
      ) {
        failContract("settle response evidence drift");
      }
      assertSettleResultV1(response.result, request, true);
      return response.result;
    },

    async getObjectOperationResult(
      requestValue: GetObjectOperationResultRequestV1,
    ) {
      const request = snapshotRequestV1(
        requestValue,
        isGetObjectOperationResultRequestV1,
        "get_object_operation_result_v1",
      );
      currentTimeV1(options.clock);
      if (request.caller_kind === "foreground") {
        assertOwnerServiceV1(request.owner_service, options.ownerService);
      }
      const identity = durableIdentityFromRequestV1(request);
      const execution =
        request.caller_kind === "reconciler"
          ? options.reconcilerPool !== undefined &&
              options.reconcilerQuery !== undefined
            ? {
                pool: options.reconcilerPool,
                query: options.reconcilerQuery,
              }
            : failContract("reconciler pool is not configured")
          : { pool: options.pool, query: options.query };
      const rows = await callWriterV1(
        execution.pool,
        execution.query,
        "get_object_operation_result_v1",
        [
          request.caller_kind,
          request.operation,
          ...durableIdentityArgumentsV1(identity),
          request.caller_kind === "reconciler"
            ? request.reservation_id
            : null,
          request.caller_kind === "reconciler"
            ? request.claim_token
            : null,
          request.caller_kind === "reconciler"
            ? String(request.claim_generation)
            : null,
        ],
      );
      const response = snapshotSingleResponseV1<ObjectOperationResultV1>(
        rows,
        isObjectOperationResultV1,
        "get_object_operation_result_v1",
      );
      if (response.operation !== request.operation) {
        failContract("result operation drift");
      }
      assertResultIdentityV1(response, identity);
      if (
        request.caller_kind === "reconciler" &&
        response.reservation_id !== request.reservation_id
      ) {
        failContract("reconciler result reservation drift");
      }
      return response;
    },
  });

  postgresObjectMetadataRepositoriesV1.add(repository);
  return repository;
}

export function isPostgresObjectMetadataRepositoryV1(
  value: unknown,
): value is PostgresObjectMetadataRepositoryV1 {
  return (
    typeof value === "object" &&
    value !== null &&
    postgresObjectMetadataRepositoriesV1.has(value)
  );
}

// Compile-time guards keep the implementation pinned to the exact published
// writer request/response schemas rather than locally reconstructed shapes.
void ReserveObjectOperationRequestV1Schema;
void StartObjectOperationAttemptRequestV1Schema;
void MarkObjectOperationCommitUnknownRequestV1Schema;
void FinalizeObjectOperationRequestV1Schema;
void SettleObjectReconcileRequestV1Schema;
void GetObjectOperationResultRequestV1Schema;
void ObjectOperationResultV1Schema;
void OBJECT_STORE_METADATA_CONTRACT_VERSION_V1;
