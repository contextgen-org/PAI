import { Type, type Static } from "@sinclair/typebox";

import { TerminalOutcomeV1Schema } from "./terminal-outcome.v1.js";
import { TypedEvidenceRefV1Schema } from "../shared/typed-evidence-ref.v1.js";
import {
  TriggerProcessorBotScopeV1Properties,
  TriggerProcessorIdentifierV1Schema,
  TriggerProcessorReasonCodeV1Schema,
  TriggerProcessorTimestampV1Schema,
} from "./contract-primitives.v1.js";

const nullableIdentifier = Type.Union([
  TriggerProcessorIdentifierV1Schema,
  Type.Null(),
]);
const nullableReason = Type.Union([
  TriggerProcessorReasonCodeV1Schema,
  Type.Null(),
]);
const nullableTimestamp = Type.Union([
  TriggerProcessorTimestampV1Schema,
  Type.Null(),
]);
const processSnapshotIdentity = Type.Object(
  {
    snapshot_ref: TriggerProcessorIdentifierV1Schema,
    snapshot_version: Type.Integer({
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    snapshot_hash: Type.String({
      pattern: "^sha256:[0-9a-f]{64}$",
    }),
  },
  { additionalProperties: false },
);
const contextSnapshotIdentity = Type.Object(
  {
    context_snapshot_ref: TriggerProcessorIdentifierV1Schema,
    context_snapshot_version: Type.Integer({
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    context_snapshot_hash: Type.String({
      pattern: "^sha256:[0-9a-f]{64}$",
    }),
  },
  { additionalProperties: false },
);

export const TRIGGER_PROCESS_QUERY_META_STATUSES_V1 = [
  "not_enqueued",
  "enqueue_pending",
  "queued",
  "running",
  "retry_wait",
  "completed",
  "failed",
  "not_applicable",
] as const;

export const TriggerProcessQueryMetaStatusV1Schema = Type.Union(
  TRIGGER_PROCESS_QUERY_META_STATUSES_V1.map((status) => Type.Literal(status)),
);

export const TriggerProcessQueryDetailsV1Schema = Type.Object(
  {
    id: TriggerProcessorIdentifierV1Schema,
    trigger_id: TriggerProcessorIdentifierV1Schema,
    ...TriggerProcessorBotScopeV1Properties,
    runtime_run_id: nullableIdentifier,
    phase: Type.Union([
      Type.Literal("admission"),
      Type.Literal("context"),
      Type.Literal("intent"),
      Type.Literal("execution"),
      Type.Literal("cooldown"),
      Type.Literal("meta_enqueued"),
      Type.Literal("closed"),
    ]),
    status: Type.Union([
      Type.Literal("running"),
      Type.Literal("waiting"),
      Type.Literal("preempt_requested"),
      Type.Literal("cancelling"),
      Type.Literal("completed"),
      Type.Literal("failed"),
      Type.Literal("preempted"),
      Type.Literal("cancelled"),
    ]),
    terminal_reason: nullableReason,
    terminal_outcome: Type.Union([TerminalOutcomeV1Schema, Type.Null()]),
    terminal_outcome_finalized_at: nullableTimestamp,
    successor_process_id: nullableIdentifier,
    snapshot_transfer_ref: nullableIdentifier,
    boundary_system_event_ref: Type.Union([
      TypedEvidenceRefV1Schema,
      Type.Null(),
    ]),
    canonical_reason_code: nullableReason,
    reason_code: nullableReason,
    cooldown_until: nullableTimestamp,
    snapshot_retention_until: nullableTimestamp,
    process_snapshot_identity: Type.Union([
      processSnapshotIdentity,
      Type.Null(),
    ]),
    context_snapshot_identity: Type.Union([
      contextSnapshotIdentity,
      Type.Null(),
    ]),
    snapshot_watermark: Type.Integer({
      minimum: 0,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    meta_job_id: nullableIdentifier,
    meta_status: TriggerProcessQueryMetaStatusV1Schema,
    meta_summary_ref: nullableIdentifier,
    observation_finalized: Type.Boolean(),
  },
  {
    $id: "urn:pai:trigger-processor:process-query-details:v1",
    additionalProperties: false,
  },
);

export type TriggerProcessQueryMetaStatusV1 = Static<
  typeof TriggerProcessQueryMetaStatusV1Schema
>;
export type TriggerProcessQueryDetailsV1 = Static<
  typeof TriggerProcessQueryDetailsV1Schema
>;

export function assertTriggerProcessQueryDetailsV1(
  details: TriggerProcessQueryDetailsV1,
): void {
  const closed = details.phase === "closed";
  const terminalStatus = ["completed", "failed", "preempted", "cancelled"].includes(
    details.status,
  );
  const metaHasJob = new Set([
    "queued",
    "running",
    "retry_wait",
    "completed",
    "failed",
  ]).has(details.meta_status);
  if (
    closed !== terminalStatus ||
    (details.terminal_outcome === null) !==
      (details.terminal_outcome_finalized_at === null) ||
    (details.terminal_outcome === null) !==
      (details.canonical_reason_code === null) ||
    (details.terminal_outcome_finalized_at !== null && !closed) ||
    (["not_enqueued", "enqueue_pending", "not_applicable"] as const).includes(
      details.meta_status as "not_enqueued",
    ) && details.meta_job_id !== null ||
    metaHasJob !== (details.meta_job_id !== null)
  ) {
    throw new Error("TriggerProcessQueryDetailsV1 semantic binding mismatch");
  }
}
