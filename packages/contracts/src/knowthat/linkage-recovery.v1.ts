import { Type, type Static } from "@sinclair/typebox";

import {
  KnowThatHashV1Schema,
  KnowThatIdV1Schema,
  KnowThatScopeV1Schema,
  KnowThatTimestampV1Schema,
  KnowThatTraceIdV1Schema,
  assertKnowThatSchemaV1,
} from "./primitives.v1.js";

export const KnowThatLinkageRecoveryV1Schema = Type.Object(
  {
    schema_version: Type.Literal("knowthat.linkage_recovery.v1"),
    ...KnowThatScopeV1Schema.properties,
    linkage_job_id: KnowThatIdV1Schema,
    expected_job_version: Type.Integer({
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    recovery_action: Type.Union([
      Type.Literal("replay"),
      Type.Literal("repair"),
    ]),
    reason: Type.String({ minLength: 1, maxLength: 4_096 }),
    idempotency_key: Type.String({ minLength: 1, maxLength: 512 }),
    request_hash: KnowThatHashV1Schema,
    trace_id: KnowThatTraceIdV1Schema,
  },
  {
    $id: "urn:pai:knowthat:linkage-recovery:v1",
    additionalProperties: false,
  },
);

export type KnowThatLinkageRecoveryV1 = Static<
  typeof KnowThatLinkageRecoveryV1Schema
>;

export const KnowThatLinkageRecoveryJobV1Schema = Type.Object(
  {
    id: KnowThatIdV1Schema,
    fact_id: KnowThatIdV1Schema,
    ...KnowThatScopeV1Schema.properties,
    check_type: Type.Literal("post_promotion_linkage_propagation"),
    target_service: Type.Literal("memory"),
    operation: Type.Union([
      Type.Literal("downgrade"),
      Type.Literal("mark_historical"),
      Type.Literal("append_version"),
      Type.Literal("feedback_required"),
      Type.Literal("no_op"),
    ]),
    status: Type.Union([
      Type.Literal("pending"),
      Type.Literal("running"),
      Type.Literal("retry_wait"),
      Type.Literal("completed"),
      Type.Literal("failed"),
      Type.Literal("skipped"),
    ]),
    attempt_count: Type.Integer({
      minimum: 0,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    next_retry_at: Type.Union([
      KnowThatTimestampV1Schema,
      Type.Null(),
    ]),
    job_version: Type.Integer({
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    updated_at: KnowThatTimestampV1Schema,
  },
  { additionalProperties: false },
);

export const KnowThatLinkageRecoveryResponseV1Schema = Type.Object(
  {
    duplicate_replayed: Type.Boolean(),
    linkage_job: KnowThatLinkageRecoveryJobV1Schema,
  },
  {
    $id: "urn:pai:knowthat:linkage-recovery-response:v1",
    additionalProperties: false,
  },
);

export type KnowThatLinkageRecoveryResponseV1 = Static<
  typeof KnowThatLinkageRecoveryResponseV1Schema
>;

export function assertKnowThatLinkageRecoveryV1(
  value: unknown,
): asserts value is KnowThatLinkageRecoveryV1 {
  assertKnowThatSchemaV1(
    KnowThatLinkageRecoveryV1Schema,
    value,
    "KnowThat linkage recovery request",
  );
}
