import { Type, type Static } from "@sinclair/typebox";

import {
  MetaIdentifierV1Schema,
  MetaReasonCodeV1Schema,
  MetaSafeCountV1Schema,
  MetaServiceIdValueV1Schema,
  MetaTimestampV1Schema,
} from "./primitives.v1.js";

export const META_PARTIAL_FAILURE_STATUSES_V1 = [
  "pending",
  "retrying",
  "succeeded",
  "failed",
  "abandoned",
  "unknown",
] as const;

export const MetaPartialFailureStatusV1Schema = Type.Union(
  META_PARTIAL_FAILURE_STATUSES_V1.map((status) => Type.Literal(status)),
);

export const PartialFailureV1Schema = Type.Object(
  {
    schema_version: Type.Literal("partial_failure.v1"),
    failure_id: MetaIdentifierV1Schema,
    stage: MetaIdentifierV1Schema,
    target_service: MetaServiceIdValueV1Schema,
    operation: MetaIdentifierV1Schema,
    blocking: Type.Boolean(),
    retryable: Type.Boolean(),
    status: MetaPartialFailureStatusV1Schema,
    attempt_count: MetaSafeCountV1Schema,
    next_retry_at: Type.Optional(MetaTimestampV1Schema),
    compensation_owner: MetaServiceIdValueV1Schema,
    compensation_outbox_id: Type.Optional(MetaIdentifierV1Schema),
    compensation_ref: Type.Optional(MetaIdentifierV1Schema),
    downstream_ref: Type.Optional(MetaIdentifierV1Schema),
    error_ref: MetaIdentifierV1Schema,
    terminal_reason: Type.Optional(MetaReasonCodeV1Schema),
    resolved_at: Type.Optional(MetaTimestampV1Schema),
  },
  {
    $id: "urn:pai:meta:partial-failure:v1",
    additionalProperties: false,
  },
);

export type PartialFailureV1 = Static<typeof PartialFailureV1Schema>;

export function assertPartialFailureSemanticBindingsV1(
  failure: PartialFailureV1,
): void {
  const active =
    failure.status === "pending" || failure.status === "retrying";
  const terminal = !active;
  if (
    (active && failure.compensation_outbox_id === undefined) ||
    (active && failure.resolved_at !== undefined) ||
    (failure.status === "retrying" &&
      (failure.attempt_count < 1 || failure.next_retry_at === undefined)) ||
    (terminal && failure.resolved_at === undefined) ||
    ((failure.status === "failed" ||
      failure.status === "abandoned" ||
      failure.status === "unknown") &&
      failure.terminal_reason === undefined)
  ) {
    throw new Error("PartialFailureV1 semantic binding mismatch");
  }
}
