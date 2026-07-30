import { Type, type Static } from "@sinclair/typebox";

import { ServiceIdV1Schema } from "../shared/service-id.v1.js";
import {
  TriggerProcessorIdentifierV1Schema,
  TriggerProcessorPositiveVersionV1Schema,
  TriggerProcessorSha256V1Schema,
  TriggerProcessorTimestampV1Schema,
} from "./contract-primitives.v1.js";

export const SnapshotOverflowRefV1Schema = Type.Object(
  {
    schema_version: Type.Literal("snapshot_overflow_ref.v1"),
    source_service: ServiceIdV1Schema,
    store_type: Type.Union([
      Type.Literal("runtime_events"),
      Type.Literal("artifact_store"),
      Type.Literal("tp_transition_audit"),
      Type.Literal("tp_event_projection"),
      Type.Literal("tp_meta_projection"),
      Type.Literal("meta_durable_event"),
    ]),
    object_ref: TriggerProcessorIdentifierV1Schema,
    first_append_sequence_no: TriggerProcessorPositiveVersionV1Schema,
    last_append_sequence_no: TriggerProcessorPositiveVersionV1Schema,
    source_sequence_range: Type.Optional(
      Type.Object(
        {
          first_source_sequence_no: TriggerProcessorPositiveVersionV1Schema,
          last_source_sequence_no: TriggerProcessorPositiveVersionV1Schema,
        },
        { additionalProperties: false },
      ),
    ),
    checksum_algorithm: Type.Literal("sha256"),
    checksum: TriggerProcessorSha256V1Schema,
    retention_until: TriggerProcessorTimestampV1Schema,
    redaction_state: Type.Union([
      Type.Literal("not_required"),
      Type.Literal("complete"),
    ]),
  },
  {
    $id: "urn:pai:trigger-processor:snapshot-overflow-ref:v1",
    additionalProperties: false,
  },
);

export type SnapshotOverflowRefV1 = Static<
  typeof SnapshotOverflowRefV1Schema
>;

const SNAPSHOT_OVERFLOW_SOURCE_BY_STORE_V1 = Object.freeze({
  runtime_events: new Set(["action_runtime"]),
  artifact_store: new Set([
    "action_runtime",
    "skill_registry",
    "trigger_processor",
  ]),
  tp_transition_audit: new Set(["trigger_processor"]),
  tp_event_projection: new Set(["trigger_processor"]),
  tp_meta_projection: new Set(["trigger_processor"]),
  meta_durable_event: new Set(["meta_cognition"]),
} satisfies Readonly<
  Record<SnapshotOverflowRefV1["store_type"], ReadonlySet<string>>
>);

export function assertSnapshotOverflowRefSemanticBindingsV1(
  ref: SnapshotOverflowRefV1,
): void {
  if (
    !SNAPSHOT_OVERFLOW_SOURCE_BY_STORE_V1[
      ref.store_type
    ].has(ref.source_service) ||
    ref.first_append_sequence_no > ref.last_append_sequence_no ||
    (ref.source_sequence_range !== undefined &&
      ref.source_sequence_range.first_source_sequence_no >
        ref.source_sequence_range.last_source_sequence_no) ||
    !Number.isFinite(Date.parse(ref.retention_until))
  ) {
    throw new Error("SnapshotOverflowRefV1 semantic binding mismatch");
  }
}
