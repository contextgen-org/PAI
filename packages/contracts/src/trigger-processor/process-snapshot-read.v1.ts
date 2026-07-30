import { Type, type Static } from "@sinclair/typebox";

import { ServiceIdV1Schema } from "../shared/service-id.v1.js";
import {
  TriggerProcessorBotScopeV1Properties,
  TriggerProcessorIdentifierV1Schema,
  TriggerProcessorPositiveVersionV1Schema,
  TriggerProcessorSha256V1Schema,
  TriggerProcessorTimestampV1Schema,
} from "./contract-primitives.v1.js";
import {
  TriggerProcessSnapshotV1Schema,
  type TriggerProcessSnapshotV1,
} from "./process-snapshot.v1.js";

export const TRIGGER_PROCESS_SNAPSHOT_RESOLVE_PURPOSES_V1 = [
  "meta_learning",
  "observation_replay",
  "repair",
  "diagnostic",
] as const;

export const TRIGGER_PROCESS_SNAPSHOT_RESOLVE_ERROR_CODES_V1 = [
  "snapshot_not_found",
  "snapshot_expired",
  "snapshot_hash_mismatch",
  "snapshot_scope_mismatch",
  "snapshot_overflow_unreadable",
  "snapshot_range_gap",
  "snapshot_schema_incompatible",
  "snapshot_redaction_incomplete",
] as const;

export const TriggerProcessSnapshotResolveRequestV1Schema = Type.Object(
  {
    schema_version: Type.Literal(
      "trigger_process_snapshot_resolve_request.v1",
    ),
    trigger_process_id: TriggerProcessorIdentifierV1Schema,
    ...TriggerProcessorBotScopeV1Properties,
    snapshot_ref: TriggerProcessorIdentifierV1Schema,
    expected_snapshot_version: TriggerProcessorPositiveVersionV1Schema,
    expected_snapshot_hash: TriggerProcessorSha256V1Schema,
    purpose: Type.Union(
      TRIGGER_PROCESS_SNAPSHOT_RESOLVE_PURPOSES_V1.map((purpose) =>
        Type.Literal(purpose),
      ),
    ),
    trace_id: TriggerProcessorIdentifierV1Schema,
  },
  {
    $id: "urn:pai:trigger-processor:snapshot-resolve-request:v1",
    additionalProperties: false,
  },
);

const snapshotContentChunkBase = {
  source_service: ServiceIdV1Schema,
  first_append_sequence_no: TriggerProcessorPositiveVersionV1Schema,
  last_append_sequence_no: TriggerProcessorPositiveVersionV1Schema,
  checksum_algorithm: Type.Literal("sha256"),
  checksum: TriggerProcessorSha256V1Schema,
  retention_until: TriggerProcessorTimestampV1Schema,
  redaction_state: Type.Union([
    Type.Literal("not_required"),
    Type.Literal("complete"),
  ]),
} as const;

export const TriggerProcessSnapshotContentChunkV1Schema = Type.Union([
  Type.Object(
    {
      ...snapshotContentChunkBase,
      inline_content: Type.Unknown(),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      ...snapshotContentChunkBase,
      owner_content_ref: TriggerProcessorIdentifierV1Schema,
    },
    { additionalProperties: false },
  ),
]);

export const TriggerProcessSnapshotReadContractV1Schema = Type.Object(
  {
    schema_version: Type.Literal("trigger_process_snapshot_read.v1"),
    snapshot_ref: TriggerProcessorIdentifierV1Schema,
    snapshot_manifest: TriggerProcessSnapshotV1Schema,
    content_chunks: Type.Array(TriggerProcessSnapshotContentChunkV1Schema, {
      maxItems: 10_000,
    }),
    resolved_at: TriggerProcessorTimestampV1Schema,
  },
  {
    $id: "urn:pai:trigger-processor:snapshot-read:v1",
    additionalProperties: false,
  },
);

export type TriggerProcessSnapshotResolvePurposeV1 =
  (typeof TRIGGER_PROCESS_SNAPSHOT_RESOLVE_PURPOSES_V1)[number];
export type TriggerProcessSnapshotResolveErrorCodeV1 =
  (typeof TRIGGER_PROCESS_SNAPSHOT_RESOLVE_ERROR_CODES_V1)[number];
export type TriggerProcessSnapshotResolveRequestV1 = Static<
  typeof TriggerProcessSnapshotResolveRequestV1Schema
>;
export type TriggerProcessSnapshotContentChunkV1 = Static<
  typeof TriggerProcessSnapshotContentChunkV1Schema
>;
export type TriggerProcessSnapshotReadContractV1 = Static<
  typeof TriggerProcessSnapshotReadContractV1Schema
>;

function sameScope(
  request: TriggerProcessSnapshotResolveRequestV1,
  snapshot: TriggerProcessSnapshotV1,
): boolean {
  return (
    request.trigger_process_id === snapshot.trigger_process_id &&
    request.workspace_id === snapshot.workspace_id &&
    request.bot_id === snapshot.bot_id &&
    request.owner_agent_id === snapshot.owner_agent_id &&
    request.deployment_environment === snapshot.deployment_environment &&
    request.release_channel === snapshot.release_channel
  );
}

export function assertTriggerProcessSnapshotReadBindingsV1(
  request: TriggerProcessSnapshotResolveRequestV1,
  result: TriggerProcessSnapshotReadContractV1,
): void {
  const snapshot = result.snapshot_manifest;
  if (
    result.snapshot_ref !== request.snapshot_ref ||
    !sameScope(request, snapshot) ||
    snapshot.snapshot_version !== request.expected_snapshot_version ||
    snapshot.snapshot_hash !== request.expected_snapshot_hash
  ) {
    throw new Error("Trigger Process snapshot read identity binding mismatch");
  }

  const range = snapshot.input_event_range;
  const chunks = result.content_chunks;
  if (
    range.last_append_sequence_no === 0 &&
    (range.first_append_sequence_no !== 0 || chunks.length !== 0)
  ) {
    throw new Error("Trigger Process snapshot read append range mismatch");
  }
  if (range.last_append_sequence_no === 0) return;
  let coveredUntil = range.first_append_sequence_no - 1;
  for (const [index, chunk] of chunks.entries()) {
    if (
      chunk.first_append_sequence_no > chunk.last_append_sequence_no ||
      (index === 0 &&
        chunk.first_append_sequence_no !== range.first_append_sequence_no) ||
      (index > 0 && chunk.first_append_sequence_no !== coveredUntil + 1) ||
      chunk.last_append_sequence_no > range.last_append_sequence_no ||
      Date.parse(chunk.retention_until) <
        Date.parse(snapshot.snapshot_retention_until)
    ) {
      throw new Error("Trigger Process snapshot read append range mismatch");
    }
    coveredUntil = chunk.last_append_sequence_no;
  }
  if (coveredUntil !== range.last_append_sequence_no) {
    throw new Error("Trigger Process snapshot read append range mismatch");
  }

  for (const overflow of snapshot.overflow_refs) {
    const chunk = chunks.find(
      (candidate) =>
        "owner_content_ref" in candidate &&
        candidate.owner_content_ref === overflow.object_ref &&
        candidate.source_service === overflow.source_service &&
        candidate.first_append_sequence_no ===
          overflow.first_append_sequence_no &&
        candidate.last_append_sequence_no === overflow.last_append_sequence_no,
    );
    if (
      chunk === undefined ||
      chunk.checksum_algorithm !== overflow.checksum_algorithm ||
      chunk.checksum !== overflow.checksum ||
      chunk.redaction_state !== overflow.redaction_state
    ) {
      throw new Error("Trigger Process snapshot overflow binding mismatch");
    }
  }

  for (const chunk of chunks) {
    if ("owner_content_ref" in chunk) {
      const overflow = snapshot.overflow_refs.find(
        (candidate) =>
          candidate.object_ref === chunk.owner_content_ref &&
          candidate.source_service === chunk.source_service &&
          candidate.first_append_sequence_no ===
            chunk.first_append_sequence_no &&
          candidate.last_append_sequence_no === chunk.last_append_sequence_no,
      );
      if (
        overflow === undefined ||
        overflow.checksum_algorithm !== chunk.checksum_algorithm ||
        overflow.checksum !== chunk.checksum ||
        overflow.retention_until !== chunk.retention_until ||
        overflow.redaction_state !== chunk.redaction_state
      ) {
        throw new Error("Trigger Process snapshot overflow binding mismatch");
      }
      continue;
    }
    const events = snapshot.event_trace.filter(
      (event) =>
        event.append_sequence_no >= chunk.first_append_sequence_no &&
        event.append_sequence_no <= chunk.last_append_sequence_no,
    );
    if (
      events.length !==
        chunk.last_append_sequence_no - chunk.first_append_sequence_no + 1 ||
      events.some((event) => event.source_service !== chunk.source_service)
    ) {
      throw new Error("Trigger Process snapshot inline binding mismatch");
    }
  }
}
