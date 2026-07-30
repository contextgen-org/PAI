import { Type, type Static } from "@sinclair/typebox";

import { TypedEvidenceRefV1Schema } from "../shared/typed-evidence-ref.v1.js";
import {
  MemoryAppliedCountsV1Schema,
  MemoryBotScopeV1Schema,
  MemoryJsonSummaryV1Schema,
  MemoryTimestampV1Schema,
  assertMemoryJsonSummaryV1,
  assertTimestampOrderV1,
  assertUniqueIdsV1,
} from "./common.v1.js";
import { MemoryIdV1Schema } from "./write-batch.v1.js";

export const MEMORY_INTEGRATION_MODES_V1 = [
  "decay",
  "deduplicate",
  "rekey",
  "rebuild_projection",
  "full",
] as const;

export const MEMORY_INTEGRATION_STATUSES_V1 = [
  "queued",
  "leased",
  "running",
  "completed",
  "partial_failed",
  "failed",
] as const;

export const MemoryIntegrationModeV1Schema = Type.Union(
  MEMORY_INTEGRATION_MODES_V1.map((mode) => Type.Literal(mode)),
);
export const MemoryIntegrationStatusV1Schema = Type.Union(
  MEMORY_INTEGRATION_STATUSES_V1.map((status) => Type.Literal(status)),
);

export const MemoryIntegrationScopeV1Schema = Type.Object(
  {
    topic_family_keys: Type.Optional(
      Type.Array(MemoryIdV1Schema, {
        maxItems: 1_000,
        uniqueItems: true,
      }),
    ),
    series_ids: Type.Optional(
      Type.Array(MemoryIdV1Schema, {
        maxItems: 1_000,
        uniqueItems: true,
      }),
    ),
    before: Type.Optional(MemoryTimestampV1Schema),
  },
  { additionalProperties: false },
);

export const MemoryIntegrationRunRequestV1Schema = Type.Object(
  {
    schema_version: Type.Literal("memory.integration_run.v1"),
    bot_id: MemoryIdV1Schema,
    scope: MemoryIntegrationScopeV1Schema,
    mode: MemoryIntegrationModeV1Schema,
    dry_run: Type.Boolean(),
    idempotency_key: Type.String({
      minLength: 1,
      maxUtf8Bytes: 128,
    }),
    expected_policy_version: MemoryIdV1Schema,
  },
  {
    $id: "urn:pai:memory:integration-run-request:v1",
    additionalProperties: false,
  },
);

export const MemoryIntegrationRunResponseV1Schema = Type.Object(
  {
    schema_version: Type.Literal("memory.integration_run.v1"),
    integration_job_id: MemoryIdV1Schema,
    state_version: Type.Integer({
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    status: MemoryIntegrationStatusV1Schema,
    lease_generation: Type.Optional(
      Type.Integer({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER }),
    ),
    checkpoint_ref: Type.Optional(MemoryIdV1Schema),
    proposed_changes: Type.Optional(
      Type.Array(MemoryJsonSummaryV1Schema, { maxItems: 10_000 }),
    ),
    applied_counts: Type.Optional(MemoryAppliedCountsV1Schema),
    failure_refs: Type.Optional(
      Type.Array(TypedEvidenceRefV1Schema, {
        maxItems: 10_000,
        uniqueByCanonicalIdentity: true,
      }),
    ),
    duplicate_replayed: Type.Boolean(),
  },
  {
    $id: "urn:pai:memory:integration-run-response:v1",
    additionalProperties: false,
  },
);

export const MemoryIntegrationJobDetailsV1Schema = Type.Object(
  {
    id: MemoryIdV1Schema,
    scope: MemoryBotScopeV1Schema,
    mode: MemoryIntegrationModeV1Schema,
    request_scope: MemoryIntegrationScopeV1Schema,
    dry_run: Type.Boolean(),
    idempotency_key: Type.String({
      minLength: 1,
      maxUtf8Bytes: 128,
    }),
    request_hash: Type.String({
      pattern: "^sha256:[0-9a-f]{64}$",
      maxUtf8Bytes: 71,
    }),
    expected_policy_version: MemoryIdV1Schema,
    state_version: Type.Integer({
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    status: MemoryIntegrationStatusV1Schema,
    checkpoint_ref: Type.Union([MemoryIdV1Schema, Type.Null()]),
    proposed_changes: Type.Array(MemoryJsonSummaryV1Schema, {
      maxItems: 10_000,
    }),
    applied_counts: MemoryAppliedCountsV1Schema,
    failure_refs: Type.Array(TypedEvidenceRefV1Schema, {
      maxItems: 10_000,
      uniqueByCanonicalIdentity: true,
    }),
    error: Type.Union([
      Type.String({ minLength: 1, maxUtf8Bytes: 4_096 }),
      Type.Null(),
    ]),
    created_at: MemoryTimestampV1Schema,
    updated_at: MemoryTimestampV1Schema,
  },
  {
    $id: "urn:pai:memory:integration-job-details:v1",
    additionalProperties: false,
  },
);

export const MemoryIntegrationClaimRequestV1Schema = Type.Object(
  {
    bot_id: MemoryIdV1Schema,
    integration_job_id: MemoryIdV1Schema,
    owner_id: MemoryIdV1Schema,
    now: Type.Optional(MemoryTimestampV1Schema),
  },
  { additionalProperties: false },
);

export const MemoryIntegrationClaimV1Schema = Type.Object(
  {
    job: MemoryIntegrationJobDetailsV1Schema,
    lease_id: MemoryIdV1Schema,
    lease_generation: Type.Integer({
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    lease_expires_at: MemoryTimestampV1Schema,
  },
  { additionalProperties: false },
);

const leaseFenceProperties = {
  bot_id: MemoryIdV1Schema,
  integration_job_id: MemoryIdV1Schema,
  lease_id: MemoryIdV1Schema,
  lease_generation: Type.Integer({
    minimum: 1,
    maximum: Number.MAX_SAFE_INTEGER,
  }),
  now: Type.Optional(MemoryTimestampV1Schema),
} as const;

export const MemoryIntegrationCheckpointRequestV1Schema = Type.Object(
  {
    ...leaseFenceProperties,
    checkpoint_ref: MemoryIdV1Schema,
    applied_counts: Type.Optional(MemoryAppliedCountsV1Schema),
    proposed_changes: Type.Optional(
      Type.Array(MemoryJsonSummaryV1Schema, { maxItems: 10_000 }),
    ),
  },
  { additionalProperties: false },
);

export const MemoryIntegrationFinishRequestV1Schema = Type.Object(
  {
    ...leaseFenceProperties,
    status: Type.Union([
      Type.Literal("completed"),
      Type.Literal("partial_failed"),
      Type.Literal("failed"),
    ]),
    failure_refs: Type.Optional(
      Type.Array(TypedEvidenceRefV1Schema, {
        maxItems: 10_000,
        uniqueByCanonicalIdentity: true,
      }),
    ),
    error: Type.Optional(
      Type.String({ minLength: 1, maxUtf8Bytes: 4_096 }),
    ),
  },
  { additionalProperties: false },
);

export const MemoryIntegrationJobV1Schema = Type.Union(
  [
    MemoryIntegrationRunRequestV1Schema,
    MemoryIntegrationRunResponseV1Schema,
    MemoryIntegrationJobDetailsV1Schema,
    MemoryIntegrationClaimRequestV1Schema,
    MemoryIntegrationClaimV1Schema,
    MemoryIntegrationCheckpointRequestV1Schema,
    MemoryIntegrationFinishRequestV1Schema,
  ],
  { $id: "urn:pai:memory:integration-job:v1" },
);

export type MemoryIntegrationModeV1 = Static<
  typeof MemoryIntegrationModeV1Schema
>;
export type MemoryIntegrationStatusV1 = Static<
  typeof MemoryIntegrationStatusV1Schema
>;
export type MemoryIntegrationRunRequestV1 = Static<
  typeof MemoryIntegrationRunRequestV1Schema
>;
export type MemoryIntegrationRunResponseV1 = Static<
  typeof MemoryIntegrationRunResponseV1Schema
>;
export type MemoryIntegrationJobV1 = Static<
  typeof MemoryIntegrationJobDetailsV1Schema
>;
export type MemoryIntegrationClaimRequestV1 = Static<
  typeof MemoryIntegrationClaimRequestV1Schema
>;
export type MemoryIntegrationClaimV1 = Static<
  typeof MemoryIntegrationClaimV1Schema
>;
export type MemoryIntegrationCheckpointRequestV1 = Static<
  typeof MemoryIntegrationCheckpointRequestV1Schema
>;
export type MemoryIntegrationFinishRequestV1 = Static<
  typeof MemoryIntegrationFinishRequestV1Schema
>;

export function assertMemoryIntegrationRunRequestSemanticBindingsV1(
  request: MemoryIntegrationRunRequestV1,
): void {
  assertUniqueIdsV1(
    request.scope.topic_family_keys ?? [],
    "scope.topic_family_keys",
  );
  assertUniqueIdsV1(request.scope.series_ids ?? [], "scope.series_ids");
}

export function assertMemoryIntegrationRunResponseSemanticBindingsV1(
  response: MemoryIntegrationRunResponseV1,
): void {
  if (
    response.lease_generation !== undefined &&
    response.status !== "leased" &&
    response.status !== "running"
  ) {
    throw new Error("integration response lease generation binding mismatch");
  }
  response.proposed_changes?.forEach((change, index) =>
    assertMemoryJsonSummaryV1(change, `proposed_changes/${index}`),
  );
  assertUniqueIdsV1(response.failure_refs ?? [], "failure_refs");
}

export function assertMemoryIntegrationJobSemanticBindingsV1(
  job: MemoryIntegrationJobV1,
): void {
  assertTimestampOrderV1(job.created_at, job.updated_at, "integration job");
  const terminal =
    job.status === "completed" ||
    job.status === "partial_failed" ||
    job.status === "failed";
  if (
    (job.status === "failed") !== (job.error !== null) ||
    (!terminal && job.failure_refs.length > 0) ||
    (!job.dry_run && job.proposed_changes.length > 0)
  ) {
    throw new Error("integration job state binding mismatch");
  }
  job.proposed_changes.forEach((change, index) =>
    assertMemoryJsonSummaryV1(change, `proposed_changes/${index}`),
  );
  assertUniqueIdsV1(job.failure_refs, "failure_refs");
}

export function assertMemoryIntegrationCheckpointRequestSemanticBindingsV1(
  request: MemoryIntegrationCheckpointRequestV1,
): void {
  request.proposed_changes?.forEach((change, index) =>
    assertMemoryJsonSummaryV1(change, `proposed_changes/${index}`),
  );
}

export function assertMemoryIntegrationFinishRequestSemanticBindingsV1(
  request: MemoryIntegrationFinishRequestV1,
): void {
  if ((request.status === "failed") !== (request.error !== undefined)) {
    throw new Error("integration finish error/status binding mismatch");
  }
  assertUniqueIdsV1(request.failure_refs ?? [], "failure_refs");
}
