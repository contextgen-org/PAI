import { Type, type Static } from "@sinclair/typebox";

export const EVIDENCE_REF_TYPES = [
  "memory_point",
  "trigger_process",
  "trigger_event",
  "user_feedback",
  "developer_note",
  "system_event",
  "artifact",
  "tool_result",
] as const;

const evidenceTypePattern = EVIDENCE_REF_TYPES.join("|");

export const TypedEvidenceRefV1Schema = Type.String({
  $id: "urn:pai:shared:typed-evidence-ref:v1",
  minLength: 3,
  pattern: `^(${evidenceTypePattern}):[^\\r\\n]+$`,
});

export type TypedEvidenceRefV1 = Static<typeof TypedEvidenceRefV1Schema>;

export function splitTypedEvidenceRef(
  ref: TypedEvidenceRefV1,
): { type: (typeof EVIDENCE_REF_TYPES)[number]; opaqueId: string } {
  const separator = ref.indexOf(":");
  return {
    type: ref.slice(0, separator) as (typeof EVIDENCE_REF_TYPES)[number],
    opaqueId: ref.slice(separator + 1),
  };
}
