import { createHash } from "node:crypto";

import { Type, type Static } from "@sinclair/typebox";

import {
  KnowThatWriteBatchRequestV1Schema,
  assertKnowThatWriteBatchRequestV1,
  type KnowThatWriteBatchRequestV1,
} from "../knowthat/write-batch.v1.js";
import {
  MemoryWriteBatchRequestV1Schema,
  assertMemoryWriteBatchRequestSemanticBindingsV1,
  type MemoryWriteBatchRequestV1,
} from "../memory/write-batch.v1.js";
import { canonicalJsonV1 } from "../shared/canonical-json.v1.js";
import {
  MetaBotScopeV1Properties,
  MetaIdentifierV1Schema,
  MetaReasonCodeV1Schema,
  MetaSafeCountV1Schema,
  MetaSafeVersionV1Schema,
  MetaSha256V1Schema,
  MetaTimestampV1Schema,
} from "./primitives.v1.js";
import {
  SkillCandidateApplicationRequestV1Schema,
} from "../skill-registry/candidate-application.v1.js";

const nullableIdentifier = Type.Union([
  MetaIdentifierV1Schema,
  Type.Null(),
]);
const nullableTimestamp = Type.Union([
  MetaTimestampV1Schema,
  Type.Null(),
]);
const nullableHash = Type.Union([
  MetaSha256V1Schema,
  Type.Null(),
]);

export const MetaCommandClaimRequestV1Schema = Type.Object(
  {
    worker_id: MetaIdentifierV1Schema,
    limit: Type.Integer({ minimum: 1, maximum: 200 }),
    lease_seconds: Type.Integer({ minimum: 1, maximum: 3_600 }),
    trace_id: MetaIdentifierV1Schema,
  },
  { additionalProperties: false },
);

export const MetaCompensationFailedItemBindingV1Schema = Type.Object(
  {
    client_item_id: MetaIdentifierV1Schema,
    item_hash: MetaSha256V1Schema,
    source_owner_request_hash: MetaSha256V1Schema,
    source_idempotency_key: MetaIdentifierV1Schema,
  },
  { additionalProperties: false },
);

const compensationCommonProperties = {
  schema_version: Type.Literal("meta_compensation_request.v1"),
  item_id: MetaIdentifierV1Schema,
  reason_code: MetaReasonCodeV1Schema,
  retryable: Type.Literal(true),
  dispatch_mode: Type.Union([
    Type.Literal("original_request_replay"),
    Type.Literal("single_item_retry"),
  ]),
  failed_item: MetaCompensationFailedItemBindingV1Schema,
  owner_request_hash: MetaSha256V1Schema,
} as const;

function embeddedSchemaWithoutIdsV1<T extends object>(schema: T): T {
  const clone = (value: unknown): unknown => {
    if (typeof value !== "object" || value === null) return value;
    const copy: Record<PropertyKey, unknown> | unknown[] =
      Array.isArray(value) ? [] : {};
    const target = copy as Record<PropertyKey, unknown>;
    for (const key of Reflect.ownKeys(value)) {
      if (key === "$id") continue;
      target[key] = clone(
        (value as Readonly<Record<PropertyKey, unknown>>)[key],
      );
    }
    return copy;
  };
  return clone(schema) as T;
}

const MemoryCompensationOwnerRequestV1Schema =
  embeddedSchemaWithoutIdsV1(MemoryWriteBatchRequestV1Schema);
const KnowThatCompensationOwnerRequestV1Schema =
  embeddedSchemaWithoutIdsV1(KnowThatWriteBatchRequestV1Schema);

export const MetaCompensationCommandPayloadV1Schema = Type.Union(
  [
    Type.Object(
      {
        ...compensationCommonProperties,
        target_service: Type.Literal("memory"),
        owner_request: MemoryCompensationOwnerRequestV1Schema,
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        ...compensationCommonProperties,
        target_service: Type.Literal("knowthat"),
        owner_request: KnowThatCompensationOwnerRequestV1Schema,
      },
      { additionalProperties: false },
    ),
  ],
  {
    $id: "urn:pai:meta:compensation-command-payload:v1",
  },
);

const durableCommandCommonProperties = {
  command_id: MetaIdentifierV1Schema,
  meta_job_id: MetaIdentifierV1Schema,
  scope: Type.Object(MetaBotScopeV1Properties, {
    additionalProperties: false,
  }),
  payload_hash: MetaSha256V1Schema,
  idempotency_key: MetaIdentifierV1Schema,
  status: Type.Union([
    Type.Literal("pending"),
    Type.Literal("claimed"),
    Type.Literal("retry_wait"),
    Type.Literal("succeeded"),
    Type.Literal("failed"),
  ]),
  attempt_count: MetaSafeCountV1Schema,
  lease_generation: MetaSafeCountV1Schema,
  claimed_by: nullableIdentifier,
  lease_expires_at: nullableTimestamp,
  next_retry_at: nullableTimestamp,
  settlement_id: nullableIdentifier,
  settlement_hash: nullableHash,
  result_ref: nullableIdentifier,
  last_error: Type.Union([
    MetaReasonCodeV1Schema,
    Type.Null(),
  ]),
  trace_id: MetaIdentifierV1Schema,
  created_at: MetaTimestampV1Schema,
  updated_at: MetaTimestampV1Schema,
} as const;

export const MetaDurableCommandV1Schema = Type.Union([
  Type.Object(
    {
      ...durableCommandCommonProperties,
      kind: Type.Literal("skill_candidate_application"),
      target_service: Type.Literal("skill_registry"),
      payload: SkillCandidateApplicationRequestV1Schema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      ...durableCommandCommonProperties,
      kind: Type.Literal("compensation"),
      source_job_lease_generation: MetaSafeVersionV1Schema,
      target_service: Type.Union([
        Type.Literal("memory"),
        Type.Literal("knowthat"),
      ]),
      payload: MetaCompensationCommandPayloadV1Schema,
    },
    { additionalProperties: false },
  ),
]);

export const MetaCommandClaimResponseV1Schema = Type.Array(
  MetaDurableCommandV1Schema,
  { maxItems: 200 },
);

export const MetaCommandClaimContractV1Schema = Type.Union(
  [
    MetaCommandClaimRequestV1Schema,
    MetaCommandClaimResponseV1Schema,
  ],
  { $id: "urn:pai:meta:command-claim:v1" },
);

export const MetaCommandSettlementRequestV1Schema = Type.Object(
  {
    worker_id: MetaIdentifierV1Schema,
    lease_generation: MetaSafeVersionV1Schema,
    settlement_id: MetaIdentifierV1Schema,
    outcome: Type.Union([
      Type.Literal("retry_wait"),
      Type.Literal("failed"),
    ]),
    result_ref: Type.Null(),
    error_code: Type.Union([
      MetaReasonCodeV1Schema,
      Type.Null(),
    ]),
    next_retry_at: nullableTimestamp,
    trace_id: MetaIdentifierV1Schema,
  },
  { additionalProperties: false },
);

export const MetaCommandSettlementResponseV1Schema = Type.Object(
  {
    command_id: MetaIdentifierV1Schema,
    status: Type.Union([
      Type.Literal("retry_wait"),
      Type.Literal("succeeded"),
      Type.Literal("failed"),
    ]),
    duplicate_replayed: Type.Boolean(),
    result_status: Type.Union([
      Type.Literal("complete"),
      Type.Literal("partial_pending"),
      Type.Literal("partial_failed"),
      Type.Null(),
    ]),
    result_version: Type.Union([
      MetaSafeVersionV1Schema,
      Type.Null(),
    ]),
  },
  { additionalProperties: false },
);

export const MetaCommandSettlementContractV1Schema = Type.Union(
  [
    MetaCommandSettlementRequestV1Schema,
    MetaCommandSettlementResponseV1Schema,
  ],
  { $id: "urn:pai:meta:command-settlement:v1" },
);

export type MetaCommandClaimRequestV1 = Static<
  typeof MetaCommandClaimRequestV1Schema
>;
export type MetaCompensationCommandPayloadV1 = Static<
  typeof MetaCompensationCommandPayloadV1Schema
>;
export type MetaDurableCommandV1 = Static<
  typeof MetaDurableCommandV1Schema
>;
export type MetaCommandClaimResponseV1 = Static<
  typeof MetaCommandClaimResponseV1Schema
>;
export type MetaCommandSettlementRequestV1 = Static<
  typeof MetaCommandSettlementRequestV1Schema
>;
export type MetaCommandSettlementResponseV1 = Static<
  typeof MetaCommandSettlementResponseV1Schema
>;

function compensationHashV1(value: unknown): `sha256:${string}` {
  return `sha256:${createHash("sha256")
    .update(
      canonicalJsonV1(value, {
        max_bytes: 2_097_152,
        max_depth: 64,
        max_nodes: 100_000,
        max_container_entries: 10_000,
      }),
      "utf8",
    )
    .digest("hex")}`;
}

export function assertMetaCompensationCommandPayloadSemanticBindingsV1(
  payload: MetaCompensationCommandPayloadV1,
): void {
  const request:
    | MemoryWriteBatchRequestV1
    | KnowThatWriteBatchRequestV1 = payload.owner_request;
  try {
    if (payload.target_service === "memory") {
      assertMemoryWriteBatchRequestSemanticBindingsV1(
        payload.owner_request,
      );
    } else {
      assertKnowThatWriteBatchRequestV1(payload.owner_request);
    }
  } catch {
    throw new Error(
      "MetaCompensationCommandPayloadV1 owner request binding mismatch",
    );
  }
  const failedItem = request.items.find(
    ({ client_item_id }) =>
      client_item_id === payload.failed_item.client_item_id,
  );
  const ownerRequestHash = compensationHashV1(request);
  const itemHash =
    failedItem === undefined ? null : compensationHashV1(failedItem);
  const commitUnknown =
    payload.dispatch_mode === "original_request_replay";
  if (
    payload.item_id !== payload.failed_item.client_item_id ||
    failedItem === undefined ||
    itemHash !== payload.failed_item.item_hash ||
    ownerRequestHash !== payload.owner_request_hash ||
    (commitUnknown &&
      (payload.owner_request_hash !==
        payload.failed_item.source_owner_request_hash ||
        request.idempotency_key !==
          payload.failed_item.source_idempotency_key)) ||
    (!commitUnknown &&
      (request.items.length !== 1 ||
        request.idempotency_key ===
          payload.failed_item.source_idempotency_key ||
        payload.owner_request_hash ===
          payload.failed_item.source_owner_request_hash))
  ) {
    throw new Error(
      "MetaCompensationCommandPayloadV1 semantic binding mismatch",
    );
  }
}

export function assertMetaDurableCommandSemanticBindingsV1(
  command: MetaDurableCommandV1,
): void {
  const pending = command.status === "pending";
  const claimed = command.status === "claimed";
  const retryWait = command.status === "retry_wait";
  const succeeded = command.status === "succeeded";
  const failed = command.status === "failed";
  const createdAt = Date.parse(command.created_at);
  const updatedAt = Date.parse(command.updated_at);
  const leaseExpiresAt =
    command.lease_expires_at === null
      ? null
      : Date.parse(command.lease_expires_at);
  const nextRetryAt =
    command.next_retry_at === null
      ? null
      : Date.parse(command.next_retry_at);
  let payloadBindingValid: boolean;
  if (command.kind === "skill_candidate_application") {
    payloadBindingValid =
      command.target_service === "skill_registry" &&
        command.idempotency_key === command.payload.application_id &&
        command.scope.workspace_id === command.payload.workspace_id &&
        command.scope.bot_id === command.payload.bot_id &&
        command.scope.owner_agent_id === command.payload.owner_agent_id &&
        command.scope.deployment_environment ===
          command.payload.deployment_environment &&
        command.scope.release_channel === command.payload.release_channel &&
        command.trace_id === command.payload.trace_id;
  } else {
    try {
      assertMetaCompensationCommandPayloadSemanticBindingsV1(
        command.payload,
      );
      payloadBindingValid =
        command.target_service === command.payload.target_service &&
        command.scope.bot_id === command.payload.owner_request.bot_id &&
        command.meta_job_id ===
          command.payload.owner_request.source_meta_job_id &&
        (command.payload.target_service === "memory" ||
          (command.scope.workspace_id ===
            command.payload.owner_request.workspace_id &&
            command.scope.owner_agent_id ===
              command.payload.owner_request.owner_agent_id &&
            command.scope.deployment_environment ===
              command.payload.owner_request.deployment_environment &&
            command.scope.release_channel ===
              command.payload.owner_request.release_channel &&
            command.trace_id ===
              command.payload.owner_request.trace_id));
    } catch {
      payloadBindingValid = false;
    }
  }
  if (
    !Number.isFinite(createdAt) ||
    !Number.isFinite(updatedAt) ||
    createdAt > updatedAt ||
    (leaseExpiresAt !== null && !Number.isFinite(leaseExpiresAt)) ||
    (nextRetryAt !== null && !Number.isFinite(nextRetryAt)) ||
    !payloadBindingValid ||
    command.attempt_count !== command.lease_generation ||
    (pending &&
      (command.attempt_count !== 0 ||
        command.claimed_by !== null ||
        command.lease_expires_at !== null ||
        command.next_retry_at !== null ||
        command.settlement_id !== null ||
        command.settlement_hash !== null ||
        command.result_ref !== null ||
        command.last_error !== null)) ||
    (claimed &&
      (command.attempt_count < 1 ||
        command.claimed_by === null ||
        command.lease_expires_at === null ||
        leaseExpiresAt === null ||
        leaseExpiresAt <= updatedAt ||
        command.next_retry_at !== null ||
        command.settlement_id !== null ||
        command.settlement_hash !== null ||
        command.result_ref !== null ||
        command.last_error !== null)) ||
    (retryWait &&
      (command.claimed_by !== null ||
        command.lease_expires_at !== null ||
        command.next_retry_at === null ||
        nextRetryAt === null ||
        nextRetryAt <= updatedAt ||
        command.settlement_id === null ||
        command.settlement_hash === null ||
        command.result_ref !== null ||
        command.last_error === null)) ||
    (succeeded &&
      (command.claimed_by !== null ||
        command.lease_expires_at !== null ||
        command.next_retry_at !== null ||
        command.settlement_id === null ||
        command.settlement_hash === null ||
        command.result_ref === null ||
        command.last_error !== null)) ||
    (failed &&
      (command.claimed_by !== null ||
        command.lease_expires_at !== null ||
        command.next_retry_at !== null ||
        command.settlement_id === null ||
        command.settlement_hash === null ||
        command.result_ref !== null ||
        command.last_error === null))
  ) {
    throw new Error(
      "MetaDurableCommandV1 semantic binding mismatch",
    );
  }
}

export function assertMetaCommandClaimSemanticBindingsV1(
  request: MetaCommandClaimRequestV1,
  response: MetaCommandClaimResponseV1,
): void {
  const commandIds = response.map(({ command_id }) => command_id);
  const idempotencyKeys = response.map(
    ({ idempotency_key }) => idempotency_key,
  );
  if (
    response.length > request.limit ||
    new Set(commandIds).size !== commandIds.length ||
    new Set(idempotencyKeys).size !== idempotencyKeys.length ||
    response.some(
      (command) =>
        command.status !== "claimed" ||
        command.claimed_by !== request.worker_id ||
        command.lease_expires_at === null ||
        Date.parse(command.lease_expires_at) !==
          Date.parse(command.updated_at) +
            request.lease_seconds * 1_000,
    )
  ) {
    throw new Error(
      "MetaCommandClaimContractV1 semantic binding mismatch",
    );
  }
  for (const command of response) {
    assertMetaDurableCommandSemanticBindingsV1(command);
  }
}

export function assertMetaCommandSettlementSemanticBindingsV1(
  pathCommandId: string,
  request: MetaCommandSettlementRequestV1,
  response: MetaCommandSettlementResponseV1,
  nowMs = Date.now(),
): void {
  const requestBindingValid =
    (request.outcome === "retry_wait" &&
      request.result_ref === null &&
      request.error_code !== null &&
      request.next_retry_at !== null &&
      Date.parse(request.next_retry_at) > nowMs) ||
    (request.outcome === "failed" &&
      request.result_ref === null &&
      request.error_code !== null &&
      request.next_retry_at === null);
  if (
    response.command_id !== pathCommandId ||
    !requestBindingValid ||
    (request.outcome !== "retry_wait" &&
      response.status !== request.outcome) ||
    (request.outcome === "retry_wait" &&
      response.status !== "retry_wait" &&
      response.status !== "failed") ||
    (response.result_status === null) !==
      (response.result_version === null)
  ) {
    throw new Error(
      "MetaCommandSettlementContractV1 semantic binding mismatch",
    );
  }
}
