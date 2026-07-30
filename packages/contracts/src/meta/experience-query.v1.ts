import { Type, type Static } from "@sinclair/typebox";

import {
  MetaBotScopeV1Properties,
  MetaIdentifierV1Schema,
  MetaTimestampV1Schema,
  MetaTypedEvidenceRefValueV1Schema,
} from "./primitives.v1.js";

export const MetaExperienceQueryRequestV1Schema = Type.Object(
  {
    trigger_process_id: MetaIdentifierV1Schema,
    ...MetaBotScopeV1Properties,
    trace_id: Type.Optional(MetaIdentifierV1Schema),
  },
  { additionalProperties: false },
);

const executionSummary = Type.Object(
  {
    task_stages: Type.Array(MetaIdentifierV1Schema, {
      maxItems: 1_000,
    }),
    major_results: Type.Array(
      Type.String({ minLength: 1, maxLength: 4_096 }),
      { maxItems: 1_000 },
    ),
    failure_summaries: Type.Array(
      Type.String({ minLength: 1, maxLength: 4_096 }),
      { maxItems: 1_000 },
    ),
    artifact_refs: Type.Array(MetaTypedEvidenceRefValueV1Schema, {
      maxItems: 10_000,
      uniqueItems: true,
    }),
  },
  { additionalProperties: false },
);

const responseIdentity = {
  trigger_process_id: MetaIdentifierV1Schema,
  bot_id: MetaIdentifierV1Schema,
  trace_id: MetaIdentifierV1Schema,
} as const;

export const MetaExperienceQueryResponseV1Schema = Type.Union([
  Type.Object(
    {
      ...responseIdentity,
      experience_record_id: MetaIdentifierV1Schema,
      status: Type.Literal("available"),
      summary: Type.String({ minLength: 1, maxLength: 16_384 }),
      execution_summary: executionSummary,
      evidence_refs: Type.Array(MetaTypedEvidenceRefValueV1Schema, {
        maxItems: 10_000,
        uniqueItems: true,
      }),
      quality_score: Type.Union([
        Type.Number({ minimum: 0, maximum: 1 }),
        Type.Null(),
      ]),
      created_at: MetaTimestampV1Schema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      ...responseIdentity,
      experience_record_id: Type.Null(),
      status: Type.Union([
        Type.Literal("pending"),
        Type.Literal("not_found"),
      ]),
      summary: Type.Null(),
      execution_summary: Type.Null(),
      evidence_refs: Type.Array(MetaTypedEvidenceRefValueV1Schema, {
        maxItems: 0,
      }),
      quality_score: Type.Null(),
      created_at: Type.Null(),
    },
    { additionalProperties: false },
  ),
]);

export const MetaExperienceQueryContractV1Schema = Type.Union(
  [
    MetaExperienceQueryRequestV1Schema,
    MetaExperienceQueryResponseV1Schema,
  ],
  { $id: "urn:pai:meta:experience-query:v1" },
);

export type MetaExperienceQueryRequestV1 = Static<
  typeof MetaExperienceQueryRequestV1Schema
>;
export type MetaExperienceQueryResponseV1 = Static<
  typeof MetaExperienceQueryResponseV1Schema
>;
