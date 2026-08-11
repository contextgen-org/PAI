import { Type, type Static } from "@sinclair/typebox";

import { canonicalJsonV1 } from "../shared/canonical-json.v1.js";

import {
  TriggerProcessorBotScopeV1Properties,
  TriggerProcessorIdentifierV1Schema,
  TriggerProcessorPositiveVersionV1Schema,
  TriggerProcessorSha256V1Schema,
  TriggerProcessorUtcTimestampV1Schema,
} from "./contract-primitives.v1.js";
import { StructuredIntentV1Schema } from "./structured-intent.v1.js";

const nullableIdentifier = Type.Union([
  TriggerProcessorIdentifierV1Schema,
  Type.Null(),
]);
const nullableHash = Type.Union([
  TriggerProcessorSha256V1Schema,
  Type.Null(),
]);
const nullableTimestamp = Type.Union([
  TriggerProcessorUtcTimestampV1Schema,
  Type.Null(),
]);

export const TriggerConfirmationChallengeV1Schema = Type.Object(
  {
    schema_version: Type.Literal("trigger_confirmation_challenge.v1"),
    challenge_id: TriggerProcessorIdentifierV1Schema,
    trigger_process_id: TriggerProcessorIdentifierV1Schema,
    ...TriggerProcessorBotScopeV1Properties,
    intent_ref: TriggerProcessorIdentifierV1Schema,
    intent_version: TriggerProcessorPositiveVersionV1Schema,
    structured_intent_hash: TriggerProcessorSha256V1Schema,
    policy_input_hash: TriggerProcessorSha256V1Schema,
    action_step_ids: Type.Array(TriggerProcessorIdentifierV1Schema, {
      maxItems: 10_000,
      uniqueItems: true,
    }),
    allowed_principal_type: Type.Union([
      Type.Literal("user"),
      Type.Literal("developer"),
      Type.Literal("operator"),
    ]),
    allowed_principal_id: TriggerProcessorIdentifierV1Schema,
    status: Type.Union([
      Type.Literal("pending"),
      Type.Literal("accepted"),
      Type.Literal("rejected"),
      Type.Literal("expired"),
    ]),
    expires_at: TriggerProcessorUtcTimestampV1Schema,
    request_hash: nullableHash,
    response_hash: nullableHash,
    confirmation_hash: nullableHash,
    stage_execute_work_id: nullableIdentifier,
    idempotency_key: nullableIdentifier,
    responded_by: nullableIdentifier,
    responded_at: nullableTimestamp,
    created_at: TriggerProcessorUtcTimestampV1Schema,
    updated_at: TriggerProcessorUtcTimestampV1Schema,
  },
  {
    $id: "urn:pai:trigger-processor:confirmation-challenge:v1",
    additionalProperties: false,
  },
);

/**
 * The authenticated pending-confirmation read is a view, not the durable
 * challenge itself. The preview is reconstructed from the immutable Runtime
 * Start request and must be hash-bound to the challenge's structured intent.
 * Keeping it separate prevents presentation-only data from changing the
 * durable confirmation proof or its response hash.
 */
export const TriggerConfirmationPendingViewV1Schema = Type.Object(
  {
    ...TriggerConfirmationChallengeV1Schema.properties,
    confirmation_preview: StructuredIntentV1Schema,
  },
  {
    $id: "urn:pai:trigger-processor:confirmation-pending-view:v1",
    additionalProperties: false,
  },
);

export const TriggerConfirmationResponseV1Schema = Type.Object(
  {
    schema_version: Type.Literal("trigger_confirmation_response.v1"),
    decision: Type.Union([Type.Literal("accept"), Type.Literal("reject")]),
    expected_intent_version: TriggerProcessorPositiveVersionV1Schema,
    idempotency_key: TriggerProcessorIdentifierV1Schema,
    response_hash: TriggerProcessorSha256V1Schema,
    trace_id: TriggerProcessorIdentifierV1Schema,
  },
  {
    $id: "urn:pai:trigger-processor:confirmation-response:v1",
    additionalProperties: false,
  },
);

export const TriggerConfirmationRequestHashPreimageV1Schema = Type.Object(
  {
    schema_version: Type.Literal(
      "trigger_confirmation_request_hash_preimage.v1",
    ),
    trigger_process_id: TriggerProcessorIdentifierV1Schema,
    challenge_id: TriggerProcessorIdentifierV1Schema,
    body: Type.Omit(TriggerConfirmationResponseV1Schema, ["trace_id"]),
  },
  { additionalProperties: false },
);

export const TriggerConfirmationResponseHashPreimageV1Schema = Type.Object(
  {
    schema_version: Type.Literal(
      "trigger_confirmation_response_hash_preimage.v1",
    ),
    trigger_process_id: TriggerProcessorIdentifierV1Schema,
    challenge_id: TriggerProcessorIdentifierV1Schema,
    intent_ref: TriggerProcessorIdentifierV1Schema,
    intent_version: TriggerProcessorPositiveVersionV1Schema,
    structured_intent_hash: TriggerProcessorSha256V1Schema,
    policy_input_hash: TriggerProcessorSha256V1Schema,
    action_step_ids: Type.Array(TriggerProcessorIdentifierV1Schema, {
      maxItems: 10_000,
      uniqueItems: true,
    }),
    principal_type: Type.Union([
      Type.Literal("user"),
      Type.Literal("developer"),
      Type.Literal("operator"),
    ]),
    principal_id: TriggerProcessorIdentifierV1Schema,
    decision: Type.Union([Type.Literal("accept"), Type.Literal("reject")]),
  },
  { additionalProperties: false },
);

export const TriggerConfirmationProofV1Schema = Type.Object(
  {
    schema_version: Type.Literal("trigger_confirmation_proof.v1"),
    confirmation_ref: TriggerProcessorIdentifierV1Schema,
    challenge_id: TriggerProcessorIdentifierV1Schema,
    trigger_process_id: TriggerProcessorIdentifierV1Schema,
    intent_ref: TriggerProcessorIdentifierV1Schema,
    intent_version: TriggerProcessorPositiveVersionV1Schema,
    structured_intent_hash: TriggerProcessorSha256V1Schema,
    policy_input_hash: TriggerProcessorSha256V1Schema,
    action_step_ids: Type.Array(TriggerProcessorIdentifierV1Schema, {
      maxItems: 10_000,
      uniqueItems: true,
    }),
    principal_type: Type.Union([
      Type.Literal("user"),
      Type.Literal("developer"),
      Type.Literal("operator"),
    ]),
    principal_id: TriggerProcessorIdentifierV1Schema,
    decision: Type.Literal("accept"),
    request_hash: TriggerProcessorSha256V1Schema,
    response_hash: TriggerProcessorSha256V1Schema,
    accepted_at: TriggerProcessorUtcTimestampV1Schema,
    process_state_version: TriggerProcessorPositiveVersionV1Schema,
    stage_execute_work_id: TriggerProcessorIdentifierV1Schema,
  },
  { additionalProperties: false },
);

export const TriggerConfirmationResponseResultV1Schema = Type.Object(
  {
    schema_version: Type.Literal("trigger_confirmation_result.v1"),
    trigger_process_id: TriggerProcessorIdentifierV1Schema,
    challenge_id: TriggerProcessorIdentifierV1Schema,
    decision: Type.Union([Type.Literal("accept"), Type.Literal("reject")]),
    challenge_status: Type.Union([
      Type.Literal("accepted"),
      Type.Literal("rejected"),
    ]),
    process_state_version: TriggerProcessorPositiveVersionV1Schema,
    request_hash: TriggerProcessorSha256V1Schema,
    response_hash: TriggerProcessorSha256V1Schema,
    confirmation_ref: nullableIdentifier,
    confirmation_hash: nullableHash,
    stage_execute_work_id: nullableIdentifier,
    duplicate_replayed: Type.Boolean(),
    trace_id: TriggerProcessorIdentifierV1Schema,
  },
  { additionalProperties: false },
);

export const TRIGGER_CONFIRMATION_ERROR_CODES_V1 = [
  "confirmation_not_found",
  "confirmation_principal_mismatch",
  "confirmation_intent_version_mismatch",
  "confirmation_response_hash_mismatch",
  "confirmation_expired",
  "confirmation_already_decided",
  "idempotency_conflict",
  "schema_validation_failed",
] as const;

export type TriggerConfirmationChallengeV1 = Static<
  typeof TriggerConfirmationChallengeV1Schema
>;
export type TriggerConfirmationPendingViewV1 = Static<
  typeof TriggerConfirmationPendingViewV1Schema
>;
export type TriggerConfirmationResponseV1 = Static<
  typeof TriggerConfirmationResponseV1Schema
>;
export type TriggerConfirmationRequestHashPreimageV1 = Static<
  typeof TriggerConfirmationRequestHashPreimageV1Schema
>;
export type TriggerConfirmationResponseHashPreimageV1 = Static<
  typeof TriggerConfirmationResponseHashPreimageV1Schema
>;
export type TriggerConfirmationProofV1 = Static<
  typeof TriggerConfirmationProofV1Schema
>;
export type TriggerConfirmationResponseResultV1 = Static<
  typeof TriggerConfirmationResponseResultV1Schema
>;

export function triggerConfirmationChallengeCanonicalBytesV1(
  challenge: TriggerConfirmationChallengeV1,
): string {
  return canonicalJsonV1(challenge, {
    max_bytes: 1_048_576,
    max_depth: 64,
    max_nodes: 50_000,
    max_container_entries: 10_000,
  });
}

export function assertTriggerConfirmationChallengeSemanticBindingsV1(
  challenge: TriggerConfirmationChallengeV1,
): void {
  const createdAt = Date.parse(challenge.created_at);
  const updatedAt = Date.parse(challenge.updated_at);
  const expiresAt = Date.parse(challenge.expires_at);
  const decisionFields = [
    challenge.request_hash,
    challenge.response_hash,
    challenge.idempotency_key,
    challenge.responded_by,
    challenge.responded_at,
  ];
  const acceptanceFields = [
    challenge.confirmation_hash,
    challenge.stage_execute_work_id,
  ];
  const responseFields = [...decisionFields, ...acceptanceFields];
  if (
    !Number.isFinite(createdAt) ||
    !Number.isFinite(updatedAt) ||
    !Number.isFinite(expiresAt) ||
    createdAt > updatedAt ||
    expiresAt <= createdAt ||
    (challenge.status === "pending" &&
      responseFields.some((value) => value !== null)) ||
    (challenge.status === "accepted" &&
      responseFields.some((value) => value === null)) ||
    (challenge.status === "rejected" &&
      (decisionFields.some((value) => value === null) ||
        acceptanceFields.some((value) => value !== null))) ||
    (challenge.status === "expired" &&
      responseFields.some((value) => value !== null)) ||
    (challenge.responded_at !== null &&
      Date.parse(challenge.responded_at) < createdAt)
  ) {
    throw new Error("TriggerConfirmationChallengeV1 semantic binding mismatch");
  }
}
