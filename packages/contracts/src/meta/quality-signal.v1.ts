import { Type, type Static, type TSchema } from "@sinclair/typebox";

import {
  MetaIdentifierV1Schema,
  MetaJsonObjectV1Schema,
  MetaReasonCodeV1Schema,
  MetaServiceIdValueV1Schema,
  MetaTypedEvidenceRefValueV1Schema,
} from "./primitives.v1.js";

export const META_QUALITY_SIGNAL_TYPES_V1 = [
  "snapshot_missing",
  "snapshot_incomplete",
  "snapshot_schema_incompatible",
  "snapshot_hash_mismatch",
  "artifact_unreadable",
  "redaction_incomplete",
  "llm_parse_failed",
  "schema_validation_failed",
  "memory_write_partial_failed",
  "knowthat_conflict_detected",
  "tool_execution_failed",
  "user_dissatisfied",
  "low_confidence_extraction",
  "feedback_required",
  "downstream_operation_failed",
] as const;

export const MetaQualitySignalTypeV1Schema = Type.Union(
  META_QUALITY_SIGNAL_TYPES_V1.map((signalType) => Type.Literal(signalType)),
);

export const MetaQualitySignalSeverityV1Schema = Type.Union([
  Type.Literal("info"),
  Type.Literal("warning"),
  Type.Literal("error"),
  Type.Literal("critical"),
]);

const common = {
  schema_version: Type.Literal("quality_signal.v1"),
  severity: MetaQualitySignalSeverityV1Schema,
  source_ref: MetaIdentifierV1Schema,
  evidence_refs: Type.Array(MetaTypedEvidenceRefValueV1Schema, {
    maxItems: 10_000,
    uniqueItems: true,
  }),
  recommended_action: Type.Union([
    Type.String({ minLength: 1, maxLength: 4_096 }),
    Type.Null(),
  ]),
} as const;

const downstreamFailurePayload = Type.Object(
  {
    target_service: MetaServiceIdValueV1Schema,
    operation: MetaIdentifierV1Schema,
    failure_kind: MetaReasonCodeV1Schema,
    retryable: Type.Boolean(),
    blocking: Type.Boolean(),
    owner_action: Type.Optional(MetaReasonCodeV1Schema),
    downstream_ref: Type.Optional(MetaIdentifierV1Schema),
  },
  { additionalProperties: false },
);

const otherSignalTypes = META_QUALITY_SIGNAL_TYPES_V1.filter(
  (signalType) => signalType !== "downstream_operation_failed",
);

function sourceBranches<TSignalType extends TSchema, TPayload extends TSchema>(
  signalType: TSignalType,
  payload: TPayload,
) {
  return [
    Type.Object(
      {
        ...common,
        signal_type: signalType,
        source_kind: Type.Literal("service"),
        source_service: MetaServiceIdValueV1Schema,
        payload,
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        ...common,
        signal_type: signalType,
        source_kind: Type.Union([
          Type.Literal("manual"),
          Type.Literal("operator"),
          Type.Literal("offline_repair"),
        ]),
        actor_principal: Type.Union([
          MetaIdentifierV1Schema,
          Type.Null(),
        ]),
        actor_role: Type.Union([MetaIdentifierV1Schema, Type.Null()]),
        payload,
      },
      { additionalProperties: false },
    ),
  ] as const;
}

export const QualitySignalV1Schema = Type.Union(
  [
    ...sourceBranches(
      Type.Literal("downstream_operation_failed"),
      downstreamFailurePayload,
    ),
    ...sourceBranches(
      Type.Union(
        otherSignalTypes.map((signalType) => Type.Literal(signalType)),
      ),
      MetaJsonObjectV1Schema,
    ),
  ],
  { $id: "urn:pai:meta:quality-signal:v1" },
);

export type QualitySignalV1 = Static<typeof QualitySignalV1Schema>;

export function assertQualitySignalSemanticBindingsV1(
  signal: QualitySignalV1,
): void {
  if (
    signal.source_kind !== "service" &&
    signal.actor_principal === null &&
    signal.actor_role === null
  ) {
    throw new Error("QualitySignalV1 actor binding mismatch");
  }
  if (
    signal.signal_type === "snapshot_incomplete" &&
    signal.source_kind === "service" &&
    signal.source_service !== "trigger_processor"
  ) {
    throw new Error("QualitySignalV1 snapshot owner binding mismatch");
  }
  if (
    signal.signal_type === "artifact_unreadable" &&
    signal.source_kind === "service" &&
    signal.source_service !== "action_runtime"
  ) {
    throw new Error("QualitySignalV1 artifact owner binding mismatch");
  }
}
