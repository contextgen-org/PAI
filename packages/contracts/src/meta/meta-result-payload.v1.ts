import { Type, type Static } from "@sinclair/typebox";

import {
  KnowThatCandidateReviewResultV1Schema,
  KnowThatFeedbackRequestSuggestionV1Schema,
} from "../knowthat/candidate-review-result.v1.js";
import { KnowThatPromotionSuggestionV1Schema } from "../knowthat/promotion-suggestion.v1.js";
import {
  KnowThatWriteBatchResponseV1Schema,
  KnowThatWriteItemV1Schema,
} from "../knowthat/write-batch.v1.js";
import {
  MemoryWriteItemResultV1Schema,
  MemoryWriteItemV1Schema,
} from "../memory/write-batch.v1.js";
import { PartialFailureV1Schema } from "./partial-failure.v1.js";
import {
  MetaBotScopeV1Properties,
  MetaIdentifierV1Schema,
  MetaJsonObjectV1Schema,
  MetaReasonCodeV1Schema,
  MetaSafeCountV1Schema,
  MetaSafeVersionV1Schema,
  MetaServiceIdValueV1Schema,
  MetaSha256V1Schema,
  MetaTimestampV1Schema,
  MetaTypedEvidenceRefValueV1Schema,
} from "./primitives.v1.js";
import { QualitySignalV1Schema } from "./quality-signal.v1.js";

const identifierArray = Type.Array(MetaIdentifierV1Schema, {
  maxItems: 10_000,
  uniqueItems: true,
});

const appendSequenceRange = Type.Object(
  {
    first_append_sequence_no: MetaSafeCountV1Schema,
    last_append_sequence_no: MetaSafeCountV1Schema,
  },
  { additionalProperties: false },
);

export const MetaSolidifiedEventRefV1Schema = Type.Object(
  {
    event_ref: MetaIdentifierV1Schema,
    event_type: MetaIdentifierV1Schema,
    append_sequence_no: MetaSafeVersionV1Schema,
    source_service: MetaServiceIdValueV1Schema,
    source_event_id: MetaIdentifierV1Schema,
    source_sequence_no: MetaSafeVersionV1Schema,
    occurred_at: MetaTimestampV1Schema,
    payload_ref: Type.Optional(MetaIdentifierV1Schema),
    payload_hash: Type.Optional(MetaSha256V1Schema),
  },
  { additionalProperties: false },
);

export const MetaLinkageCheckRefV1Schema = Type.Object(
  {
    linkage_check_id: MetaIdentifierV1Schema,
    source_stage: Type.Union([
      Type.Literal("knowthat_write_batch"),
      Type.Literal("candidate_review"),
    ]),
    source_fact_id: Type.Optional(MetaIdentifierV1Schema),
    source_candidate_id: Type.Optional(MetaIdentifierV1Schema),
    created_at: Type.Optional(MetaTimestampV1Schema),
  },
  { additionalProperties: false },
);

const memoryWriteBatchIdentity = {
  split_plan_id: MetaIdentifierV1Schema,
  plan_version: MetaSafeVersionV1Schema,
  chunk_no: MetaSafeVersionV1Schema,
  chunk_hash: MetaSha256V1Schema,
  idempotency_key: MetaIdentifierV1Schema,
  memory_write_request_id: MetaIdentifierV1Schema,
  request_payload_ref: MetaIdentifierV1Schema,
  request_payload_hash: MetaSha256V1Schema,
} as const;

export const MetaMemoryWriteBatchResultV1Schema = Type.Union([
  Type.Object(
    {
      ...memoryWriteBatchIdentity,
      status: Type.Literal("superseded"),
      failure_ids: identifierArray,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      ...memoryWriteBatchIdentity,
      status: Type.Union([
        Type.Literal("pending"),
        Type.Literal("dispatching"),
        Type.Literal("retry_wait"),
        Type.Literal("succeeded"),
        Type.Literal("partial_failed"),
        Type.Literal("failed"),
        Type.Literal("unknown"),
      ]),
      compensation_outbox_id: MetaIdentifierV1Schema,
      write_batch_id: Type.Optional(MetaIdentifierV1Schema),
      item_results: Type.Optional(
        Type.Array(MemoryWriteItemResultV1Schema, { maxItems: 100 }),
      ),
      failure_ids: identifierArray,
    },
    { additionalProperties: false },
  ),
]);

export const MetaMemoryWriteStageResultV1Schema = Type.Union([
  Type.Object(
    {
      status: Type.Literal("not_started"),
      reason_code: MetaReasonCodeV1Schema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      status: Type.Literal("noop"),
      reason_code: MetaReasonCodeV1Schema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      status: Type.Literal("pending"),
      split_plan_id: MetaIdentifierV1Schema,
      compensation_outbox_ids: identifierArray,
      batch_results: Type.Array(MetaMemoryWriteBatchResultV1Schema, {
        minItems: 1,
        maxItems: 10_000,
      }),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      status: Type.Literal("succeeded"),
      batch_results: Type.Array(MetaMemoryWriteBatchResultV1Schema, {
        minItems: 1,
        maxItems: 10_000,
      }),
      item_results: Type.Array(MemoryWriteItemResultV1Schema, {
        maxItems: 10_000,
      }),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      status: Type.Literal("partial_failed"),
      batch_results: Type.Array(MetaMemoryWriteBatchResultV1Schema, {
        minItems: 1,
        maxItems: 10_000,
      }),
      item_results: Type.Array(MemoryWriteItemResultV1Schema, {
        maxItems: 10_000,
      }),
      failure_ids: identifierArray,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      status: Type.Union([
        Type.Literal("failed"),
        Type.Literal("unknown"),
      ]),
      batch_results: Type.Array(MetaMemoryWriteBatchResultV1Schema, {
        maxItems: 10_000,
      }),
      failure_ids: identifierArray,
    },
    { additionalProperties: false },
  ),
]);

const knowThatWriteResponseValue = Type.Object(
  KnowThatWriteBatchResponseV1Schema.properties,
  { additionalProperties: false },
);

export const MetaKnowThatWriteStageResultV1Schema = Type.Union([
  Type.Object(
    {
      status: Type.Literal("not_started"),
      reason_code: MetaReasonCodeV1Schema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      status: Type.Literal("noop"),
      reason_code: MetaReasonCodeV1Schema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      status: Type.Literal("pending"),
      write_request_id: MetaIdentifierV1Schema,
      compensation_outbox_id: MetaIdentifierV1Schema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      status: Type.Literal("succeeded"),
      result: knowThatWriteResponseValue,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      status: Type.Literal("partial_failed"),
      result: Type.Optional(knowThatWriteResponseValue),
      failure_ids: identifierArray,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      status: Type.Union([
        Type.Literal("failed"),
        Type.Literal("unknown"),
      ]),
      failure_ids: identifierArray,
      downstream_ref: Type.Optional(MetaIdentifierV1Schema),
    },
    { additionalProperties: false },
  ),
]);

const knowThatPromotionSuggestionValue = Type.Object(
  {
    ...KnowThatPromotionSuggestionV1Schema.properties,
    new_evidence_refs: Type.Array(MetaTypedEvidenceRefValueV1Schema, {
      maxItems: 64,
      uniqueItems: true,
    }),
  },
  { additionalProperties: false },
);

const knowThatFeedbackSuggestionValue = Type.Object(
  {
    ...KnowThatFeedbackRequestSuggestionV1Schema.properties,
    evidence_refs: Type.Array(MetaTypedEvidenceRefValueV1Schema, {
      maxItems: 64,
      uniqueItems: true,
    }),
  },
  { additionalProperties: false },
);

const knowThatCandidateReviewResultValue = Type.Object(
  {
    ...KnowThatCandidateReviewResultV1Schema.properties,
    feedback_request_suggestion: Type.Optional(
      knowThatFeedbackSuggestionValue,
    ),
  },
  { additionalProperties: false },
);

export const MetaSkillCandidateV1Schema = Type.Object(
  {
    candidate_id: MetaIdentifierV1Schema,
    candidate_type: Type.Union([
      Type.Literal("new_skill"),
      Type.Literal("skill_update"),
      Type.Literal("deprecation"),
    ]),
    skill_key: MetaIdentifierV1Schema,
    ...MetaBotScopeV1Properties,
    baseline_catalog_version: MetaIdentifierV1Schema,
    proposal_ref: MetaIdentifierV1Schema,
    proposal_hash: MetaSha256V1Schema,
    evidence_refs: Type.Array(MetaTypedEvidenceRefValueV1Schema, {
      minItems: 1,
      maxItems: 256,
      uniqueItems: true,
    }),
    status: Type.Union([
      Type.Literal("proposed"),
      Type.Literal("accepted"),
      Type.Literal("rejected"),
      Type.Literal("superseded"),
    ]),
    review_version: MetaSafeVersionV1Schema,
    delivery_id: Type.Union([MetaIdentifierV1Schema, Type.Null()]),
    application_id: Type.Union([MetaIdentifierV1Schema, Type.Null()]),
    downstream_ref: Type.Union([MetaIdentifierV1Schema, Type.Null()]),
    downstream_status: Type.Union([
      Type.Literal("pending"),
      Type.Literal("dispatching"),
      Type.Literal("received"),
      Type.Literal("validating"),
      Type.Literal("draft_created"),
      Type.Literal("deprecation_review_created"),
      Type.Literal("rejected"),
      Type.Literal("failed"),
    ]),
    attempt_count: MetaSafeCountV1Schema,
    last_error: Type.Union([MetaJsonObjectV1Schema, Type.Null()]),
  },
  { additionalProperties: false },
);

export const MetaPersonalitySuggestionV1Schema = Type.Object(
  {
    suggestion_id: MetaIdentifierV1Schema,
    personality_ref: MetaIdentifierV1Schema,
    personality_version: MetaSafeVersionV1Schema,
    personality_hash: MetaSha256V1Schema,
    proposed_patch_ref: MetaIdentifierV1Schema,
    proposed_patch_hash: MetaSha256V1Schema,
    evidence_refs: Type.Array(MetaTypedEvidenceRefValueV1Schema, {
      minItems: 1,
      maxItems: 256,
      uniqueItems: true,
    }),
    status: Type.Union([
      Type.Literal("proposed"),
      Type.Literal("accepted"),
      Type.Literal("rejected"),
      Type.Literal("superseded"),
    ]),
    review_version: MetaSafeVersionV1Schema,
    downstream_status: Type.Literal("not_applicable"),
  },
  { additionalProperties: false },
);

export const MetaLlmCallMetadataV1Schema = Type.Object(
  {
    stage: MetaIdentifierV1Schema,
    prompt_version: MetaIdentifierV1Schema,
    model_provider: MetaIdentifierV1Schema,
    model_name: MetaIdentifierV1Schema,
    model_version: Type.Optional(MetaIdentifierV1Schema),
    parser_version: MetaIdentifierV1Schema,
    schema_version: MetaIdentifierV1Schema,
    input_hash: MetaSha256V1Schema,
    output_hash: MetaSha256V1Schema,
    repair_count: MetaSafeCountV1Schema,
    validation_errors: Type.Array(MetaJsonObjectV1Schema, {
      maxItems: 1_000,
    }),
    adapter_version: MetaIdentifierV1Schema,
  },
  { additionalProperties: false },
);

export const MetaLlmRunMetadataV1Schema = Type.Object(
  {
    snapshot_id: MetaIdentifierV1Schema,
    snapshot_ref: MetaIdentifierV1Schema,
    snapshot_hash: MetaSha256V1Schema,
    snapshot_version: MetaSafeVersionV1Schema,
    input_event_range: appendSequenceRange,
    runtime_run_id: Type.Union([MetaIdentifierV1Schema, Type.Null()]),
    context_snapshot_ref: Type.Union([
      MetaIdentifierV1Schema,
      Type.Null(),
    ]),
    intent_ref: Type.Union([MetaIdentifierV1Schema, Type.Null()]),
    runtime_state: Type.Union([MetaIdentifierV1Schema, Type.Null()]),
    cooldown_until: Type.Union([MetaTimestampV1Schema, Type.Null()]),
    policy_snapshot_id: Type.Union([
      MetaIdentifierV1Schema,
      Type.Null(),
    ]),
    solidified_event_range: appendSequenceRange,
    skill_catalog_version: Type.Optional(MetaIdentifierV1Schema),
    skill_catalog_as_of: Type.Optional(MetaTimestampV1Schema),
    calls: Type.Array(MetaLlmCallMetadataV1Schema, { maxItems: 1_000 }),
  },
  { additionalProperties: false },
);

export const MetaResultPayloadV1Schema = Type.Object(
  {
    schema_version: Type.Literal("urn:pai:meta:result-payload:v1"),
    result_status: Type.Union([
      Type.Literal("complete"),
      Type.Literal("partial_pending"),
      Type.Literal("partial_failed"),
    ]),
    experience_summary: Type.Object(
      {
        summary: Type.String({ minLength: 1, maxLength: 16_384 }),
        execution_summary: MetaJsonObjectV1Schema,
        reflection_summary: Type.Optional(
          Type.String({ minLength: 1, maxLength: 16_384 }),
        ),
        evidence_refs: Type.Array(MetaTypedEvidenceRefValueV1Schema, {
          maxItems: 10_000,
          uniqueItems: true,
        }),
      },
      { additionalProperties: false },
    ),
    solidified_event_refs: Type.Array(MetaSolidifiedEventRefV1Schema, {
      maxItems: 10_000,
    }),
    memory_candidates: Type.Array(MemoryWriteItemV1Schema, {
      maxItems: 10_000,
    }),
    memory_write_result: MetaMemoryWriteStageResultV1Schema,
    knowthat_candidates: Type.Array(KnowThatWriteItemV1Schema, {
      maxItems: 10_000,
    }),
    knowthat_write_result: MetaKnowThatWriteStageResultV1Schema,
    candidate_review_suggestions: Type.Array(
      knowThatPromotionSuggestionValue,
      { maxItems: 10_000 },
    ),
    candidate_review_results: Type.Array(
      knowThatCandidateReviewResultValue,
      { maxItems: 10_000 },
    ),
    skill_candidates: Type.Array(MetaSkillCandidateV1Schema, {
      maxItems: 10_000,
    }),
    personality_suggestions: Type.Array(
      MetaPersonalitySuggestionV1Schema,
      { maxItems: 10_000 },
    ),
    quality_signals: Type.Array(QualitySignalV1Schema, {
      maxItems: 10_000,
    }),
    linkage_check_refs: Type.Array(MetaLinkageCheckRefV1Schema, {
      maxItems: 10_000,
    }),
    partial_failures: Type.Array(PartialFailureV1Schema, {
      maxItems: 10_000,
    }),
    llm_run_metadata: MetaLlmRunMetadataV1Schema,
  },
  {
    $id: "urn:pai:meta:result-payload:v1",
    additionalProperties: false,
  },
);

export type MetaResultPayloadV1 = Static<typeof MetaResultPayloadV1Schema>;
export type MetaSolidifiedEventRefV1 = Static<
  typeof MetaSolidifiedEventRefV1Schema
>;
export type MetaLinkageCheckRefV1 = Static<
  typeof MetaLinkageCheckRefV1Schema
>;
export type MetaMemoryWriteBatchResultV1 = Static<
  typeof MetaMemoryWriteBatchResultV1Schema
>;
export type MetaMemoryWriteStageResultV1 = Static<
  typeof MetaMemoryWriteStageResultV1Schema
>;
export type MetaKnowThatWriteStageResultV1 = Static<
  typeof MetaKnowThatWriteStageResultV1Schema
>;
export type MetaSkillCandidateV1 = Static<
  typeof MetaSkillCandidateV1Schema
>;
export type MetaPersonalitySuggestionV1 = Static<
  typeof MetaPersonalitySuggestionV1Schema
>;
export type MetaLlmCallMetadataV1 = Static<
  typeof MetaLlmCallMetadataV1Schema
>;
export type MetaLlmRunMetadataV1 = Static<
  typeof MetaLlmRunMetadataV1Schema
>;

export function assertMetaResultPayloadSemanticBindingsV1(
  payload: MetaResultPayloadV1,
): void {
  const failures = payload.partial_failures;
  const active = failures.filter(
    (failure) =>
      failure.status === "pending" || failure.status === "retrying",
  );
  const unresolvedTerminal = failures.filter(
    (failure) =>
      failure.status === "failed" ||
      failure.status === "abandoned" ||
      failure.status === "unknown",
  );
  const expectedStatus =
    active.length > 0
      ? "partial_pending"
      : unresolvedTerminal.length > 0
        ? "partial_failed"
        : "complete";
  if (
    payload.result_status !== expectedStatus ||
    active.some(
      (failure) => failure.compensation_outbox_id === undefined,
    ) ||
    payload.llm_run_metadata.input_event_range.first_append_sequence_no >
      payload.llm_run_metadata.input_event_range.last_append_sequence_no ||
    payload.llm_run_metadata.solidified_event_range
      .first_append_sequence_no >
      payload.llm_run_metadata.solidified_event_range
        .last_append_sequence_no ||
    (payload.skill_candidates.length > 0 &&
      (payload.llm_run_metadata.skill_catalog_version === undefined ||
        payload.llm_run_metadata.skill_catalog_as_of === undefined))
  ) {
    throw new Error("MetaResultPayloadV1 semantic binding mismatch");
  }
}
