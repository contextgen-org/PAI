import {
  DeploymentEnvironmentV1Schema,
  ReleaseChannelV1Schema,
  assertCanonicalJsonBoundaryV1,
  type ServiceIdV1,
} from "@pai/contracts";
import { Type, type Static, type TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import type { ObjectScopeV1 } from "../object-store-port.v1.js";

export const OBJECT_STORE_METADATA_CONTRACT_VERSION_V1 =
  "object_store_metadata.v1" as const;

export const OBJECT_METADATA_OWNER_SERVICE_IDS_V1 = Object.freeze([
  "trigger_processor",
  "action_runtime",
  "skill_registry",
] as const satisfies readonly ServiceIdV1[]);

export const ObjectMetadataOwnerServiceV1Schema = Type.Union(
  OBJECT_METADATA_OWNER_SERVICE_IDS_V1.map((ownerService) =>
    Type.Literal(ownerService),
  ),
  { $id: "urn:pai:object-store:metadata-owner-service:v1" },
);

export type ObjectMetadataOwnerServiceV1 = Static<
  typeof ObjectMetadataOwnerServiceV1Schema
>;

export const ObjectMetadataPositiveSafeIntegerV1Schema = Type.Integer({
  minimum: 1,
  maximum: Number.MAX_SAFE_INTEGER,
});

export const ObjectMetadataNonNegativeSafeIntegerV1Schema = Type.Integer({
  minimum: 0,
  maximum: Number.MAX_SAFE_INTEGER,
});

export const ObjectMetadataIdentifierV1Schema = Type.String({
  minLength: 1,
  maxLength: 512,
});

export const ObjectMetadataReasonCodeV1Schema = Type.String({
  minLength: 1,
  maxLength: 128,
  pattern: "^[a-z][a-z0-9_]*(?:[._-][a-z0-9_]+)*$",
});

export const ObjectMetadataHashV1Schema = Type.String({
  minLength: 71,
  maxLength: 71,
  pattern: "^sha256:[a-f0-9]{64}$",
});

export const ObjectMetadataOpaqueRefV1Schema = Type.String({
  minLength: 38,
  maxLength: 134,
  pattern: "^objv1_[a-f0-9]{32,128}$",
});

export const ObjectMetadataTimestampV1Schema = Type.String({
  minLength: 20,
  maxLength: 32,
  pattern:
    "^\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])T(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d{1,6})?(?:Z|[+-](?:[01]\\d|2[0-3]):[0-5]\\d)$",
});

const nullable = <TSchemaValue extends TSchema>(schema: TSchemaValue) =>
  Type.Union([schema, Type.Null()]);

const objectMetadataBotScopePropertiesV1 = {
  scope_kind: Type.Literal("bot"),
  workspace_id: ObjectMetadataIdentifierV1Schema,
  bot_id: ObjectMetadataIdentifierV1Schema,
  owner_agent_id: ObjectMetadataIdentifierV1Schema,
  deployment_environment: DeploymentEnvironmentV1Schema,
  release_channel: ReleaseChannelV1Schema,
} as const;

const objectMetadataGlobalScopeColumnPropertiesV1 = {
  scope_kind: Type.Literal("global"),
  workspace_id: Type.Null(),
  bot_id: Type.Null(),
  owner_agent_id: Type.Null(),
  deployment_environment: Type.Null(),
  release_channel: Type.Null(),
} as const;

export const ObjectMetadataScopeV1Schema = Type.Union(
  [
    Type.Object(objectMetadataBotScopePropertiesV1, {
      additionalProperties: false,
    }),
    Type.Object(
      {
        scope_kind: Type.Literal("global"),
      },
      {
        additionalProperties: false,
      },
    ),
  ],
  { $id: "urn:pai:object-store:metadata-scope:v1" },
);

export const ObjectMetadataScopeColumnsV1Schema = Type.Union(
  [
    Type.Object(objectMetadataBotScopePropertiesV1, {
      additionalProperties: false,
    }),
    Type.Object(objectMetadataGlobalScopeColumnPropertiesV1, {
      additionalProperties: false,
    }),
  ],
  { $id: "urn:pai:object-store:metadata-scope-columns:v1" },
);

export type ObjectMetadataScopeV1 = Static<
  typeof ObjectMetadataScopeV1Schema
> &
  ObjectScopeV1;

export type ObjectMetadataScopeColumnsV1 = Static<
  typeof ObjectMetadataScopeColumnsV1Schema
>;

export const ObjectMetadataFailureV1Schema = Type.Object(
  {
    schema_version: Type.Literal("object_store_failure.v1"),
    error_code: ObjectMetadataReasonCodeV1Schema,
    retryable: Type.Boolean(),
    failure_hash: ObjectMetadataHashV1Schema,
  },
  {
    additionalProperties: false,
    $id: "urn:pai:object-store:metadata-failure:v1",
  },
);

export type ObjectMetadataFailureV1 = Static<
  typeof ObjectMetadataFailureV1Schema
>;

export const ObjectDeleteTombstoneV1Schema = Type.Object(
  {
    schema_version: Type.Literal("object_delete_tombstone.v1"),
    object_fingerprint: ObjectMetadataHashV1Schema,
    deletion_decision_version:
      ObjectMetadataPositiveSafeIntegerV1Schema,
    result: Type.Union([
      Type.Literal("deleted"),
      Type.Literal("already_absent"),
    ]),
    observed_at: ObjectMetadataTimestampV1Schema,
  },
  {
    additionalProperties: false,
    $id: "urn:pai:object-store:delete-tombstone:v1",
  },
);

export type ObjectDeleteTombstoneV1 = Static<
  typeof ObjectDeleteTombstoneV1Schema
>;

export const ObjectMetadataOperationV1Schema = Type.Union([
  Type.Literal("put_immutable"),
  Type.Literal("delete_if_eligible"),
]);

export type ObjectMetadataOperationV1 = Static<
  typeof ObjectMetadataOperationV1Schema
>;

export const ObjectMetadataReservationStatusV1Schema = Type.Union([
  Type.Literal("reserved"),
  Type.Literal("executing"),
  Type.Literal("commit_unknown"),
  Type.Literal("reconcile_required"),
  Type.Literal("succeeded"),
  Type.Literal("failed"),
  Type.Literal("tombstoned"),
  Type.Literal("dlq"),
]);

export type ObjectMetadataReservationStatusV1 = Static<
  typeof ObjectMetadataReservationStatusV1Schema
>;

const objectMetadataReservationBasePropertiesV1 = {
  id: ObjectMetadataIdentifierV1Schema,
  contract_version: Type.Literal(OBJECT_STORE_METADATA_CONTRACT_VERSION_V1),
  operation: ObjectMetadataOperationV1Schema,
  owner_service: ObjectMetadataOwnerServiceV1Schema,
  owner_object_id: ObjectMetadataIdentifierV1Schema,
  owner_state_version: ObjectMetadataPositiveSafeIntegerV1Schema,
  object_class: ObjectMetadataReasonCodeV1Schema,
  idempotency_key: ObjectMetadataIdentifierV1Schema,
  request_hash: ObjectMetadataHashV1Schema,
  object_fingerprint: ObjectMetadataHashV1Schema,
  expected_digest: nullable(ObjectMetadataHashV1Schema),
  expected_size_bytes: nullable(
    ObjectMetadataNonNegativeSafeIntegerV1Schema,
  ),
  media_type: nullable(
    Type.String({ minLength: 1, maxLength: 255 }),
  ),
  retention_until: ObjectMetadataTimestampV1Schema,
  deletion_decision_version: nullable(
    ObjectMetadataPositiveSafeIntegerV1Schema,
  ),
  foreground_lease_token_hash: ObjectMetadataHashV1Schema,
  foreground_lease_expires_at: ObjectMetadataTimestampV1Schema,
  generation: ObjectMetadataPositiveSafeIntegerV1Schema,
  current_attempt_no: ObjectMetadataNonNegativeSafeIntegerV1Schema,
  status: ObjectMetadataReservationStatusV1Schema,
  opaque_ref: nullable(ObjectMetadataOpaqueRefV1Schema),
  physical_object_fingerprint: nullable(ObjectMetadataHashV1Schema),
  terminal_proof_hash: nullable(ObjectMetadataHashV1Schema),
  gc_not_before: ObjectMetadataTimestampV1Schema,
  created_at: ObjectMetadataTimestampV1Schema,
  updated_at: ObjectMetadataTimestampV1Schema,
} as const;

export const ObjectMetadataReservationV1Schema = Type.Union(
  [
    Type.Object(
      {
        ...objectMetadataReservationBasePropertiesV1,
        ...objectMetadataBotScopePropertiesV1,
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        ...objectMetadataReservationBasePropertiesV1,
        ...objectMetadataGlobalScopeColumnPropertiesV1,
      },
      { additionalProperties: false },
    ),
  ],
  { $id: "urn:pai:object-store:metadata-reservation:v1" },
);

export type ObjectMetadataReservationV1 = Static<
  typeof ObjectMetadataReservationV1Schema
>;

export const ObjectOperationAttemptActorKindV1Schema = Type.Union([
  Type.Literal("foreground"),
  Type.Literal("reconciler"),
]);

export const ObjectOperationAttemptStatusV1Schema = Type.Union([
  Type.Literal("started"),
  Type.Literal("commit_unknown"),
  Type.Literal("succeeded"),
  Type.Literal("failed"),
  Type.Literal("stale_rejected"),
]);

export const ObjectOperationAttemptV1Schema = Type.Object(
  {
    id: ObjectMetadataIdentifierV1Schema,
    reservation_id: ObjectMetadataIdentifierV1Schema,
    operation: ObjectMetadataOperationV1Schema,
    attempt_no: ObjectMetadataPositiveSafeIntegerV1Schema,
    actor_kind: ObjectOperationAttemptActorKindV1Schema,
    attempt_token_hash: nullable(ObjectMetadataHashV1Schema),
    claim_token_hash: nullable(ObjectMetadataHashV1Schema),
    claim_generation: nullable(
      ObjectMetadataPositiveSafeIntegerV1Schema,
    ),
    status: ObjectOperationAttemptStatusV1Schema,
    provider_request_id: nullable(ObjectMetadataIdentifierV1Schema),
    provider_receipt_hash: nullable(ObjectMetadataHashV1Schema),
    physical_object_fingerprint: nullable(ObjectMetadataHashV1Schema),
    result_digest: nullable(ObjectMetadataHashV1Schema),
    result_size_bytes: nullable(
      ObjectMetadataNonNegativeSafeIntegerV1Schema,
    ),
    error: nullable(ObjectMetadataFailureV1Schema),
    started_at: ObjectMetadataTimestampV1Schema,
    completed_at: nullable(ObjectMetadataTimestampV1Schema),
  },
  {
    additionalProperties: false,
    $id: "urn:pai:object-store:operation-attempt:v1",
  },
);

export type ObjectOperationAttemptV1 = Static<
  typeof ObjectOperationAttemptV1Schema
>;

export const ObjectTerminalProofKindV1Schema = Type.Union([
  Type.Literal("put_receipt"),
  Type.Literal("delete_tombstone"),
  Type.Literal("terminal_failure"),
]);

export const ObjectProviderTerminalDispositionV1Schema = Type.Union([
  Type.Literal("rejected_before_commit"),
  Type.Literal("verified_absent"),
]);

export type ObjectProviderTerminalDispositionV1 = Static<
  typeof ObjectProviderTerminalDispositionV1Schema
>;

export const ObjectTerminalProofV1Schema = Type.Object(
  {
    id: ObjectMetadataIdentifierV1Schema,
    reservation_id: ObjectMetadataIdentifierV1Schema,
    attempt_id: ObjectMetadataIdentifierV1Schema,
    operation: ObjectMetadataOperationV1Schema,
    proof_kind: ObjectTerminalProofKindV1Schema,
    opaque_ref: nullable(ObjectMetadataOpaqueRefV1Schema),
    provider_receipt_hash: nullable(ObjectMetadataHashV1Schema),
    physical_object_fingerprint: nullable(ObjectMetadataHashV1Schema),
    result_digest: nullable(ObjectMetadataHashV1Schema),
    result_size_bytes: nullable(
      ObjectMetadataNonNegativeSafeIntegerV1Schema,
    ),
    result_media_type: nullable(
      Type.String({ minLength: 1, maxLength: 255 }),
    ),
    provider_terminal_disposition: nullable(
      ObjectProviderTerminalDispositionV1Schema,
    ),
    tombstone: nullable(ObjectDeleteTombstoneV1Schema),
    proof_hash: ObjectMetadataHashV1Schema,
    completed_at: ObjectMetadataTimestampV1Schema,
    created_at: ObjectMetadataTimestampV1Schema,
  },
  {
    additionalProperties: false,
    $id: "urn:pai:object-store:terminal-proof:v1",
  },
);

export type ObjectTerminalProofV1 = Static<
  typeof ObjectTerminalProofV1Schema
>;

export const ObjectReconcileJobStatusV1Schema = Type.Union([
  Type.Literal("pending"),
  Type.Literal("claimed"),
  Type.Literal("retry_wait"),
  Type.Literal("succeeded"),
  Type.Literal("failed"),
  Type.Literal("dlq"),
]);

export const ObjectReconcileJobV1Schema = Type.Object(
  {
    id: ObjectMetadataIdentifierV1Schema,
    reservation_id: ObjectMetadataIdentifierV1Schema,
    status: ObjectReconcileJobStatusV1Schema,
    claim_token_hash: nullable(ObjectMetadataHashV1Schema),
    claim_generation: nullable(
      ObjectMetadataPositiveSafeIntegerV1Schema,
    ),
    claim_lease_expires_at: nullable(ObjectMetadataTimestampV1Schema),
    retry_count: ObjectMetadataNonNegativeSafeIntegerV1Schema,
    next_retry_at: nullable(ObjectMetadataTimestampV1Schema),
    last_error: nullable(ObjectMetadataFailureV1Schema),
    dlq_reason: nullable(ObjectMetadataReasonCodeV1Schema),
    dlq_at: nullable(ObjectMetadataTimestampV1Schema),
    created_at: ObjectMetadataTimestampV1Schema,
    updated_at: ObjectMetadataTimestampV1Schema,
  },
  {
    additionalProperties: false,
    $id: "urn:pai:object-store:reconcile-job:v1",
  },
);

export type ObjectReconcileJobV1 = Static<
  typeof ObjectReconcileJobV1Schema
>;

export const ObjectMetadataGcEligibilityV1Schema = Type.Object(
  {
    reservation_id: ObjectMetadataIdentifierV1Schema,
    owner_service: ObjectMetadataOwnerServiceV1Schema,
    owner_object_id: ObjectMetadataIdentifierV1Schema,
    owner_state_version: ObjectMetadataPositiveSafeIntegerV1Schema,
    object_class: ObjectMetadataReasonCodeV1Schema,
    operation: ObjectMetadataOperationV1Schema,
    scope: ObjectMetadataScopeV1Schema,
    terminal_status: Type.Union([
      Type.Literal("succeeded"),
      Type.Literal("failed"),
      Type.Literal("tombstoned"),
    ]),
    reservation_generation: ObjectMetadataPositiveSafeIntegerV1Schema,
    terminal_proof_hash: nullable(ObjectMetadataHashV1Schema),
    retention_until: ObjectMetadataTimestampV1Schema,
    gc_not_before: ObjectMetadataTimestampV1Schema,
  },
  {
    additionalProperties: false,
    $id: "urn:pai:object-store:gc-eligibility:v1",
  },
);

export type ObjectMetadataGcEligibilityV1 = Static<
  typeof ObjectMetadataGcEligibilityV1Schema
>;

const objectMetadataWriterIdentityPropertiesV1 = {
  contract_version: Type.Literal(OBJECT_STORE_METADATA_CONTRACT_VERSION_V1),
  owner_service: ObjectMetadataOwnerServiceV1Schema,
  owner_object_id: ObjectMetadataIdentifierV1Schema,
  owner_state_version: ObjectMetadataPositiveSafeIntegerV1Schema,
  object_class: ObjectMetadataReasonCodeV1Schema,
  scope: ObjectMetadataScopeV1Schema,
  idempotency_key: ObjectMetadataIdentifierV1Schema,
  request_hash: ObjectMetadataHashV1Schema,
  object_fingerprint: ObjectMetadataHashV1Schema,
} as const;

const objectOperationDurableIdentityPropertiesV1 = {
  ...objectMetadataWriterIdentityPropertiesV1,
  expected_digest: nullable(ObjectMetadataHashV1Schema),
  expected_size_bytes: nullable(
    ObjectMetadataNonNegativeSafeIntegerV1Schema,
  ),
  media_type: nullable(
    Type.String({ minLength: 1, maxLength: 255 }),
  ),
  retention_until: ObjectMetadataTimestampV1Schema,
  deletion_decision_version: nullable(
    ObjectMetadataPositiveSafeIntegerV1Schema,
  ),
  gc_not_before: ObjectMetadataTimestampV1Schema,
} as const;

export const ObjectOperationDurableIdentityV1Schema = Type.Object(
  {
    ...objectOperationDurableIdentityPropertiesV1,
    operation: ObjectMetadataOperationV1Schema,
  },
  {
    additionalProperties: false,
    $id: "urn:pai:object-store:operation-durable-identity:v1",
  },
);

export type ObjectOperationDurableIdentityV1 = Static<
  typeof ObjectOperationDurableIdentityV1Schema
>;

const reserveObjectOperationCommonPropertiesV1 = {
  ...objectMetadataWriterIdentityPropertiesV1,
  retention_until: ObjectMetadataTimestampV1Schema,
  foreground_lease_token: ObjectMetadataIdentifierV1Schema,
  foreground_lease_seconds: Type.Integer({ minimum: 1, maximum: 3_600 }),
  gc_not_before: ObjectMetadataTimestampV1Schema,
} as const;

export const ReserveObjectOperationRequestV1Schema = Type.Union(
  [
    Type.Object(
      {
        ...reserveObjectOperationCommonPropertiesV1,
        operation: Type.Literal("put_immutable"),
        expected_digest: ObjectMetadataHashV1Schema,
        expected_size_bytes: ObjectMetadataNonNegativeSafeIntegerV1Schema,
        media_type: Type.String({ minLength: 1, maxLength: 255 }),
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        ...reserveObjectOperationCommonPropertiesV1,
        operation: Type.Literal("delete_if_eligible"),
        expected_digest: Type.Optional(ObjectMetadataHashV1Schema),
        expected_size_bytes: Type.Optional(
          ObjectMetadataNonNegativeSafeIntegerV1Schema,
        ),
        media_type: Type.Optional(
          Type.String({ minLength: 1, maxLength: 255 }),
        ),
        deletion_decision_version:
          ObjectMetadataPositiveSafeIntegerV1Schema,
      },
      { additionalProperties: false },
    ),
  ],
  { $id: "urn:pai:object-store:reserve-operation-request:v1" },
);

export type ReserveObjectOperationRequestV1 = Static<
  typeof ReserveObjectOperationRequestV1Schema
>;

const reserveObjectOperationReplayResultV1Schema = Type.Object(
  {
    ...objectOperationDurableIdentityPropertiesV1,
    reservation_id: ObjectMetadataIdentifierV1Schema,
    operation: ObjectMetadataOperationV1Schema,
    status: ObjectMetadataReservationStatusV1Schema,
    generation: ObjectMetadataPositiveSafeIntegerV1Schema,
    opaque_ref: nullable(ObjectMetadataOpaqueRefV1Schema),
    terminal_proof: nullable(ObjectTerminalProofV1Schema),
  },
  {
    additionalProperties: false,
    $id: "urn:pai:object-store:reservation-replay-result:v1",
  },
);

export const ReserveObjectOperationResultV1Schema = Type.Union(
  [
    Type.Object(
      {
        ...objectOperationDurableIdentityPropertiesV1,
        kind: Type.Literal("reserved"),
        reservation_id: ObjectMetadataIdentifierV1Schema,
        operation: ObjectMetadataOperationV1Schema,
        status: Type.Literal("reserved"),
        generation: ObjectMetadataPositiveSafeIntegerV1Schema,
        foreground_lease_expires_at: ObjectMetadataTimestampV1Schema,
        opaque_ref: nullable(ObjectMetadataOpaqueRefV1Schema),
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        kind: Type.Literal("replay"),
        result: reserveObjectOperationReplayResultV1Schema,
      },
      { additionalProperties: false },
    ),
  ],
  { $id: "urn:pai:object-store:reserve-operation-result:v1" },
);

export type ReserveObjectOperationResultV1 = Static<
  typeof ReserveObjectOperationResultV1Schema
>;

const objectAttemptFenceV1 = Type.Union([
  Type.Object(
    {
      actor_kind: Type.Literal("foreground"),
      attempt_token: ObjectMetadataIdentifierV1Schema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      actor_kind: Type.Literal("reconciler"),
      claim_token: ObjectMetadataIdentifierV1Schema,
      claim_generation: ObjectMetadataPositiveSafeIntegerV1Schema,
    },
    { additionalProperties: false },
  ),
]);

const operationAttemptIdentityPropertiesV1 = {
  ...objectOperationDurableIdentityPropertiesV1,
  reservation_id: ObjectMetadataIdentifierV1Schema,
  operation: ObjectMetadataOperationV1Schema,
  expected_generation: ObjectMetadataPositiveSafeIntegerV1Schema,
} as const;

export const StartObjectOperationAttemptRequestV1Schema = Type.Object(
  {
    ...operationAttemptIdentityPropertiesV1,
    actor: objectAttemptFenceV1,
  },
  {
    additionalProperties: false,
    $id: "urn:pai:object-store:start-operation-attempt-request:v1",
  },
);

export const StartObjectOperationAttemptResultV1Schema = Type.Object(
  {
    ...objectOperationDurableIdentityPropertiesV1,
    reservation_id: ObjectMetadataIdentifierV1Schema,
    operation: ObjectMetadataOperationV1Schema,
    attempt_id: ObjectMetadataIdentifierV1Schema,
    attempt_no: ObjectMetadataPositiveSafeIntegerV1Schema,
    generation: ObjectMetadataPositiveSafeIntegerV1Schema,
  },
  {
    additionalProperties: false,
    $id: "urn:pai:object-store:start-operation-attempt-result:v1",
  },
);

export type StartObjectOperationAttemptRequestV1 = Static<
  typeof StartObjectOperationAttemptRequestV1Schema
>;
export type StartObjectOperationAttemptResultV1 = Static<
  typeof StartObjectOperationAttemptResultV1Schema
>;

export const MarkObjectOperationCommitUnknownRequestV1Schema = Type.Object(
  {
    ...operationAttemptIdentityPropertiesV1,
    attempt_id: ObjectMetadataIdentifierV1Schema,
    actor: objectAttemptFenceV1,
    provider_request_id: Type.Optional(ObjectMetadataIdentifierV1Schema),
    provider_receipt_hash: Type.Optional(ObjectMetadataHashV1Schema),
    physical_object_fingerprint: Type.Optional(
      ObjectMetadataHashV1Schema,
    ),
    error: Type.Optional(ObjectMetadataFailureV1Schema),
  },
  {
    additionalProperties: false,
    $id: "urn:pai:object-store:mark-operation-commit-unknown-request:v1",
  },
);

export type MarkObjectOperationCommitUnknownRequestV1 = Static<
  typeof MarkObjectOperationCommitUnknownRequestV1Schema
>;

export const ObjectCommitUnknownEvidenceV1Schema = Type.Object(
  {
    attempt_id: ObjectMetadataIdentifierV1Schema,
    expected_generation: ObjectMetadataPositiveSafeIntegerV1Schema,
    provider_request_id: nullable(ObjectMetadataIdentifierV1Schema),
    provider_receipt_hash: nullable(ObjectMetadataHashV1Schema),
    physical_object_fingerprint: nullable(
      ObjectMetadataHashV1Schema,
    ),
    error: nullable(ObjectMetadataFailureV1Schema),
  },
  {
    additionalProperties: false,
    $id: "urn:pai:object-store:commit-unknown-evidence:v1",
  },
);

export type ObjectCommitUnknownEvidenceV1 = Static<
  typeof ObjectCommitUnknownEvidenceV1Schema
>;

const terminalOutcomePutReceiptV1 = Type.Object(
  {
    operation: Type.Literal("put_immutable"),
    proof_kind: Type.Literal("put_receipt"),
    opaque_ref: ObjectMetadataOpaqueRefV1Schema,
    provider_receipt_hash: ObjectMetadataHashV1Schema,
    physical_object_fingerprint: ObjectMetadataHashV1Schema,
    result_digest: ObjectMetadataHashV1Schema,
    result_size_bytes: ObjectMetadataNonNegativeSafeIntegerV1Schema,
    result_media_type: Type.String({ minLength: 1, maxLength: 255 }),
    proof_hash: ObjectMetadataHashV1Schema,
  },
  { additionalProperties: false },
);

const terminalOutcomeDeleteTombstoneV1 = Type.Object(
  {
    operation: Type.Literal("delete_if_eligible"),
    proof_kind: Type.Literal("delete_tombstone"),
    provider_receipt_hash: ObjectMetadataHashV1Schema,
    physical_object_fingerprint: Type.Optional(
      ObjectMetadataHashV1Schema,
    ),
    tombstone: ObjectDeleteTombstoneV1Schema,
    proof_hash: ObjectMetadataHashV1Schema,
  },
  { additionalProperties: false },
);

const terminalOutcomeFailureV1 = Type.Object(
  {
    operation: ObjectMetadataOperationV1Schema,
    proof_kind: Type.Literal("terminal_failure"),
    provider_receipt_hash: ObjectMetadataHashV1Schema,
    provider_terminal_disposition:
      ObjectProviderTerminalDispositionV1Schema,
    error: ObjectMetadataFailureV1Schema,
    proof_hash: ObjectMetadataHashV1Schema,
  },
  { additionalProperties: false },
);

export const ObjectTerminalOutcomeV1Schema = Type.Union(
  [
    terminalOutcomePutReceiptV1,
    terminalOutcomeDeleteTombstoneV1,
    terminalOutcomeFailureV1,
  ],
  { $id: "urn:pai:object-store:terminal-outcome:v1" },
);

export type ObjectTerminalOutcomeV1 = Static<
  typeof ObjectTerminalOutcomeV1Schema
>;

export const FinalizeObjectOperationRequestV1Schema = Type.Object(
  {
    ...operationAttemptIdentityPropertiesV1,
    attempt_id: ObjectMetadataIdentifierV1Schema,
    actor: objectAttemptFenceV1,
    outcome: ObjectTerminalOutcomeV1Schema,
  },
  {
    additionalProperties: false,
    $id: "urn:pai:object-store:finalize-operation-request:v1",
  },
);

export type FinalizeObjectOperationRequestV1 = Static<
  typeof FinalizeObjectOperationRequestV1Schema
>;

export const ClaimExpiredObjectReconcileRequestV1Schema = Type.Object(
  {
    contract_version: Type.Literal(
      OBJECT_STORE_METADATA_CONTRACT_VERSION_V1,
    ),
    worker_id: ObjectMetadataIdentifierV1Schema,
    limit: Type.Integer({ minimum: 1, maximum: 100 }),
    lease_seconds: Type.Integer({ minimum: 1, maximum: 3_600 }),
    reservation_id: Type.Optional(ObjectMetadataIdentifierV1Schema),
  },
  {
    additionalProperties: false,
    $id: "urn:pai:object-store:claim-expired-reconcile-request:v1",
  },
);

export type ClaimExpiredObjectReconcileRequestV1 = Static<
  typeof ClaimExpiredObjectReconcileRequestV1Schema
>;

const objectReconcileClaimPropertiesV1 = {
  ...objectOperationDurableIdentityPropertiesV1,
  reservation_id: ObjectMetadataIdentifierV1Schema,
  claim_token: ObjectMetadataIdentifierV1Schema,
  claim_generation: ObjectMetadataPositiveSafeIntegerV1Schema,
  claim_lease_expires_at: ObjectMetadataTimestampV1Schema,
  database_now: ObjectMetadataTimestampV1Schema,
  reservation_generation: ObjectMetadataPositiveSafeIntegerV1Schema,
} as const;

export const ObjectReconcileClaimV1Schema = Type.Union(
  [
    Type.Object(
      {
        ...objectReconcileClaimPropertiesV1,
        operation: Type.Literal("put_immutable"),
        deletion_decision_version: Type.Null(),
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        ...objectReconcileClaimPropertiesV1,
        operation: Type.Literal("delete_if_eligible"),
        deletion_decision_version:
          ObjectMetadataPositiveSafeIntegerV1Schema,
      },
      { additionalProperties: false },
    ),
  ],
  {
    $id: "urn:pai:object-store:reconcile-claim:v1",
  },
);

export type ObjectReconcileClaimV1 = Static<
  typeof ObjectReconcileClaimV1Schema
>;

export const RenewObjectReconcileClaimRequestV1Schema = Type.Object(
  {
    ...objectOperationDurableIdentityPropertiesV1,
    reservation_id: ObjectMetadataIdentifierV1Schema,
    operation: ObjectMetadataOperationV1Schema,
    claim_token: ObjectMetadataIdentifierV1Schema,
    claim_generation: ObjectMetadataPositiveSafeIntegerV1Schema,
    expected_generation: ObjectMetadataPositiveSafeIntegerV1Schema,
    expected_claim_lease_expires_at: ObjectMetadataTimestampV1Schema,
    lease_seconds: Type.Integer({ minimum: 1, maximum: 3_600 }),
  },
  {
    additionalProperties: false,
    $id: "urn:pai:object-store:renew-reconcile-claim-request:v1",
  },
);

export type RenewObjectReconcileClaimRequestV1 = Static<
  typeof RenewObjectReconcileClaimRequestV1Schema
>;

const objectReconcileRetrySettlementV1 = Type.Object(
  {
    kind: Type.Literal("retry_wait"),
    retry_delay_seconds: Type.Integer({ minimum: 1, maximum: 86_400 }),
    error: ObjectMetadataFailureV1Schema,
  },
  { additionalProperties: false },
);

const objectReconcileDlqSettlementV1 = Type.Object(
  {
    kind: Type.Literal("dlq"),
    reason: ObjectMetadataReasonCodeV1Schema,
    error: ObjectMetadataFailureV1Schema,
  },
  { additionalProperties: false },
);

const objectReconcileTerminalSettlementV1 = Type.Object(
  {
    kind: Type.Literal("terminal"),
    attempt_id: ObjectMetadataIdentifierV1Schema,
    outcome: ObjectTerminalOutcomeV1Schema,
  },
  { additionalProperties: false },
);

export const ObjectReconcileSettlementV1Schema = Type.Union([
  objectReconcileRetrySettlementV1,
  objectReconcileDlqSettlementV1,
  objectReconcileTerminalSettlementV1,
], {
  $id: "urn:pai:object-store:reconcile-settlement:v1",
});

export type ObjectReconcileSettlementV1 = Static<
  typeof ObjectReconcileSettlementV1Schema
>;

export const SettleObjectReconcileRequestV1Schema = Type.Object(
  {
    ...objectOperationDurableIdentityPropertiesV1,
    reservation_id: ObjectMetadataIdentifierV1Schema,
    operation: ObjectMetadataOperationV1Schema,
    claim_token: ObjectMetadataIdentifierV1Schema,
    claim_generation: ObjectMetadataPositiveSafeIntegerV1Schema,
    expected_generation: ObjectMetadataPositiveSafeIntegerV1Schema,
    settlement: ObjectReconcileSettlementV1Schema,
  },
  {
    additionalProperties: false,
    $id: "urn:pai:object-store:settle-reconcile-request:v1",
  },
);

export type SettleObjectReconcileRequestV1 = Static<
  typeof SettleObjectReconcileRequestV1Schema
>;

export const GetObjectOperationResultRequestV1Schema = Type.Union(
  [
    Type.Object(
      {
        ...objectOperationDurableIdentityPropertiesV1,
        caller_kind: Type.Literal("foreground"),
        operation: ObjectMetadataOperationV1Schema,
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        ...objectOperationDurableIdentityPropertiesV1,
        caller_kind: Type.Literal("reconciler"),
        reservation_id: ObjectMetadataIdentifierV1Schema,
        operation: ObjectMetadataOperationV1Schema,
        claim_token: ObjectMetadataIdentifierV1Schema,
        claim_generation: ObjectMetadataPositiveSafeIntegerV1Schema,
      },
      { additionalProperties: false },
    ),
  ],
  { $id: "urn:pai:object-store:get-operation-result-request:v1" },
);

export type GetObjectOperationResultRequestV1 = Static<
  typeof GetObjectOperationResultRequestV1Schema
>;

export const ObjectOperationResultV1Schema = Type.Object(
  {
    ...objectOperationDurableIdentityPropertiesV1,
    reservation_id: ObjectMetadataIdentifierV1Schema,
    operation: ObjectMetadataOperationV1Schema,
    status: ObjectMetadataReservationStatusV1Schema,
    generation: ObjectMetadataPositiveSafeIntegerV1Schema,
    opaque_ref: nullable(ObjectMetadataOpaqueRefV1Schema),
    result_digest: nullable(ObjectMetadataHashV1Schema),
    result_size_bytes: nullable(
      ObjectMetadataNonNegativeSafeIntegerV1Schema,
    ),
    terminal_proof: nullable(ObjectTerminalProofV1Schema),
    commit_unknown_evidence: nullable(
      ObjectCommitUnknownEvidenceV1Schema,
    ),
    reconcile_settlement: nullable(
      ObjectReconcileSettlementV1Schema,
    ),
  },
  {
    additionalProperties: false,
    $id: "urn:pai:object-store:operation-result:v1",
  },
);

export type ObjectOperationResultV1 = Static<
  typeof ObjectOperationResultV1Schema
>;

export const MarkObjectOperationCommitUnknownResultV1Schema = Type.Object(
  {
    result: ObjectOperationResultV1Schema,
    attempt_id: ObjectMetadataIdentifierV1Schema,
    expected_generation: ObjectMetadataPositiveSafeIntegerV1Schema,
    provider_request_id: nullable(ObjectMetadataIdentifierV1Schema),
    provider_receipt_hash: nullable(ObjectMetadataHashV1Schema),
    physical_object_fingerprint: nullable(
      ObjectMetadataHashV1Schema,
    ),
    error: nullable(ObjectMetadataFailureV1Schema),
  },
  {
    additionalProperties: false,
    $id: "urn:pai:object-store:mark-operation-commit-unknown-result:v1",
  },
);

export type MarkObjectOperationCommitUnknownResultV1 = Static<
  typeof MarkObjectOperationCommitUnknownResultV1Schema
>;

export const FinalizeObjectOperationResultV1Schema = Type.Object(
  {
    result: ObjectOperationResultV1Schema,
    attempt_id: ObjectMetadataIdentifierV1Schema,
    expected_generation: ObjectMetadataPositiveSafeIntegerV1Schema,
    outcome: ObjectTerminalOutcomeV1Schema,
  },
  {
    additionalProperties: false,
    $id: "urn:pai:object-store:finalize-operation-result:v1",
  },
);

export type FinalizeObjectOperationResultV1 = Static<
  typeof FinalizeObjectOperationResultV1Schema
>;

export const SettleObjectReconcileResultV1Schema = Type.Object(
  {
    result: ObjectOperationResultV1Schema,
    claim_generation: ObjectMetadataPositiveSafeIntegerV1Schema,
    expected_generation: ObjectMetadataPositiveSafeIntegerV1Schema,
    settlement: ObjectReconcileSettlementV1Schema,
  },
  {
    additionalProperties: false,
    $id: "urn:pai:object-store:settle-reconcile-result:v1",
  },
);

export type SettleObjectReconcileResultV1 = Static<
  typeof SettleObjectReconcileResultV1Schema
>;

export const OBJECT_STORE_METADATA_WRITER_CONTRACTS_V1 = Object.freeze({
  reserve_object_operation_v1: Object.freeze({
    request: ReserveObjectOperationRequestV1Schema,
    response: ReserveObjectOperationResultV1Schema,
    validate_request: isReserveObjectOperationRequestV1,
  }),
  start_object_operation_attempt_v1: Object.freeze({
    request: StartObjectOperationAttemptRequestV1Schema,
    response: StartObjectOperationAttemptResultV1Schema,
    validate_request: isStartObjectOperationAttemptRequestV1,
  }),
  mark_object_operation_commit_unknown_v1: Object.freeze({
    request: MarkObjectOperationCommitUnknownRequestV1Schema,
    response: MarkObjectOperationCommitUnknownResultV1Schema,
    validate_request: isMarkObjectOperationCommitUnknownRequestV1,
  }),
  finalize_object_operation_v1: Object.freeze({
    request: FinalizeObjectOperationRequestV1Schema,
    response: FinalizeObjectOperationResultV1Schema,
    validate_request: isFinalizeObjectOperationRequestV1,
  }),
  claim_expired_object_reconcile_v1: Object.freeze({
    request: ClaimExpiredObjectReconcileRequestV1Schema,
    response: Type.Array(ObjectReconcileClaimV1Schema, {
      maxItems: 100,
      $id: "urn:pai:object-store:reconcile-claim-batch:v1",
    }),
    validate_request: isClaimExpiredObjectReconcileRequestV1,
  }),
  renew_object_reconcile_claim_v1: Object.freeze({
    request: RenewObjectReconcileClaimRequestV1Schema,
    response: ObjectReconcileClaimV1Schema,
    validate_request: isRenewObjectReconcileClaimRequestV1,
  }),
  settle_object_reconcile_v1: Object.freeze({
    request: SettleObjectReconcileRequestV1Schema,
    response: SettleObjectReconcileResultV1Schema,
    validate_request: isSettleObjectReconcileRequestV1,
  }),
  get_object_operation_result_v1: Object.freeze({
    request: GetObjectOperationResultRequestV1Schema,
    response: ObjectOperationResultV1Schema,
    validate_request: isGetObjectOperationResultRequestV1,
  }),
});

const terminalReservationStatusesV1 =
  new Set<ObjectMetadataReservationStatusV1>([
    "succeeded",
    "failed",
    "tombstoned",
  ]);

function finiteTimestamp(value: string): bigint | undefined {
  const fraction = /\.(\d{1,6})(?=Z|[+-]\d{2}:\d{2}$)/u.exec(value)?.[1] ?? "";
  const wholeSecond = value.replace(/\.\d{1,6}(?=Z|[+-]\d{2}:\d{2}$)/u, "");
  const parsedMilliseconds = Date.parse(wholeSecond);
  if (!Number.isFinite(parsedMilliseconds)) return undefined;
  return (
    BigInt(parsedMilliseconds) * 1_000n +
    BigInt(fraction.padEnd(6, "0"))
  );
}

function hasDurableIdentitySemanticsV1(
  value: ObjectOperationDurableIdentityV1,
): boolean {
  const retentionUntil = finiteTimestamp(value.retention_until);
  const gcNotBefore = finiteTimestamp(value.gc_not_before);
  return (
    retentionUntil !== undefined &&
    gcNotBefore !== undefined &&
    gcNotBefore >= retentionUntil &&
    (value.operation === "put_immutable"
      ? value.deletion_decision_version === null &&
        value.expected_digest !== null &&
        value.expected_size_bytes !== null &&
        value.media_type !== null
      : value.deletion_decision_version !== null)
  );
}

function terminalOutcomeMatchesIdentityV1(
  identity: ObjectOperationDurableIdentityV1,
  outcome: ObjectTerminalOutcomeV1,
): boolean {
  if (identity.operation !== outcome.operation) return false;
  if (outcome.proof_kind === "put_receipt") {
    return (
      identity.operation === "put_immutable" &&
      identity.expected_digest !== null &&
      identity.expected_size_bytes !== null &&
      identity.media_type !== null &&
      outcome.result_digest === identity.expected_digest &&
      outcome.result_size_bytes === identity.expected_size_bytes &&
      outcome.result_media_type === identity.media_type &&
      outcome.physical_object_fingerprint === identity.object_fingerprint
    );
  }
  if (outcome.proof_kind === "delete_tombstone") {
    return (
      identity.operation === "delete_if_eligible" &&
      identity.deletion_decision_version !== null &&
      (outcome.physical_object_fingerprint === undefined ||
        outcome.physical_object_fingerprint === identity.object_fingerprint) &&
      outcome.tombstone.object_fingerprint === identity.object_fingerprint &&
      outcome.tombstone.deletion_decision_version ===
        identity.deletion_decision_version
    );
  }
  return outcome.provider_receipt_hash.length > 0;
}

function boundedMetadataContractValueV1(value: unknown): boolean {
  try {
    assertCanonicalJsonBoundaryV1(value, {
      max_bytes: 1_048_576,
      max_depth: 32,
      max_nodes: 10_000,
      max_container_entries: 1_000,
    });
    return true;
  } catch {
    return false;
  }
}

export function isReserveObjectOperationRequestV1(
  value: unknown,
): value is ReserveObjectOperationRequestV1 {
  if (
    !boundedMetadataContractValueV1(value) ||
    !Value.Check(ReserveObjectOperationRequestV1Schema, value)
  ) {
    return false;
  }
  const retentionUntil = finiteTimestamp(value.retention_until);
  const gcNotBefore = finiteTimestamp(value.gc_not_before);
  return (
    retentionUntil !== undefined &&
    gcNotBefore !== undefined &&
    gcNotBefore >= retentionUntil &&
    (value.operation === "put_immutable" ||
      value.deletion_decision_version !== undefined)
  );
}

export function isStartObjectOperationAttemptRequestV1(
  value: unknown,
): value is StartObjectOperationAttemptRequestV1 {
  return (
    boundedMetadataContractValueV1(value) &&
    Value.Check(StartObjectOperationAttemptRequestV1Schema, value) &&
    hasDurableIdentitySemanticsV1(value)
  );
}

export function isMarkObjectOperationCommitUnknownRequestV1(
  value: unknown,
): value is MarkObjectOperationCommitUnknownRequestV1 {
  return (
    boundedMetadataContractValueV1(value) &&
    Value.Check(MarkObjectOperationCommitUnknownRequestV1Schema, value) &&
    hasDurableIdentitySemanticsV1(value)
  );
}

export function isFinalizeObjectOperationRequestV1(
  value: unknown,
): value is FinalizeObjectOperationRequestV1 {
  return (
    boundedMetadataContractValueV1(value) &&
    Value.Check(FinalizeObjectOperationRequestV1Schema, value) &&
    hasDurableIdentitySemanticsV1(value) &&
    terminalOutcomeMatchesIdentityV1(value, value.outcome)
  );
}

export function isClaimExpiredObjectReconcileRequestV1(
  value: unknown,
): value is ClaimExpiredObjectReconcileRequestV1 {
  return (
    boundedMetadataContractValueV1(value) &&
    Value.Check(ClaimExpiredObjectReconcileRequestV1Schema, value)
  );
}

export function isRenewObjectReconcileClaimRequestV1(
  value: unknown,
): value is RenewObjectReconcileClaimRequestV1 {
  return (
    boundedMetadataContractValueV1(value) &&
    Value.Check(RenewObjectReconcileClaimRequestV1Schema, value) &&
    hasDurableIdentitySemanticsV1(value) &&
    finiteTimestamp(value.expected_claim_lease_expires_at) !== undefined
  );
}

export function isSettleObjectReconcileRequestV1(
  value: unknown,
): value is SettleObjectReconcileRequestV1 {
  return (
    boundedMetadataContractValueV1(value) &&
    Value.Check(SettleObjectReconcileRequestV1Schema, value) &&
    hasDurableIdentitySemanticsV1(value) &&
    (value.settlement.kind !== "terminal" ||
      terminalOutcomeMatchesIdentityV1(value, value.settlement.outcome))
  );
}

export function isGetObjectOperationResultRequestV1(
  value: unknown,
): value is GetObjectOperationResultRequestV1 {
  return (
    boundedMetadataContractValueV1(value) &&
    Value.Check(GetObjectOperationResultRequestV1Schema, value) &&
    hasDurableIdentitySemanticsV1(value)
  );
}

export function isObjectReconcileClaimV1(
  value: unknown,
): value is ObjectReconcileClaimV1 {
  if (
    !boundedMetadataContractValueV1(value) ||
    !Value.Check(ObjectReconcileClaimV1Schema, value) ||
    !hasDurableIdentitySemanticsV1(value)
  ) {
    return false;
  }
  const databaseNow = finiteTimestamp(value.database_now);
  const leaseExpiresAt = finiteTimestamp(value.claim_lease_expires_at);
  return (
    databaseNow !== undefined &&
    leaseExpiresAt !== undefined &&
    leaseExpiresAt > databaseNow
  );
}

export function isStartObjectOperationAttemptResultV1(
  value: unknown,
): value is StartObjectOperationAttemptResultV1 {
  return (
    boundedMetadataContractValueV1(value) &&
    Value.Check(StartObjectOperationAttemptResultV1Schema, value) &&
    hasDurableIdentitySemanticsV1(value)
  );
}

export function isObjectMetadataReservationV1(
  value: unknown,
): value is ObjectMetadataReservationV1 {
  if (
    !boundedMetadataContractValueV1(value) ||
    !Value.Check(ObjectMetadataReservationV1Schema, value)
  ) {
    return false;
  }
  const createdAt = finiteTimestamp(value.created_at);
  const foregroundLeaseExpiresAt = finiteTimestamp(
    value.foreground_lease_expires_at,
  );
  const retentionUntil = finiteTimestamp(value.retention_until);
  const gcNotBefore = finiteTimestamp(value.gc_not_before);
  if (
    createdAt === undefined ||
    foregroundLeaseExpiresAt === undefined ||
    retentionUntil === undefined ||
    gcNotBefore === undefined ||
    foregroundLeaseExpiresAt <= createdAt ||
    gcNotBefore < retentionUntil
  ) {
    return false;
  }
  if (
    (value.operation === "put_immutable" &&
      (value.deletion_decision_version !== null ||
        value.expected_digest === null ||
        value.expected_size_bytes === null ||
        value.media_type === null)) ||
    (value.operation === "delete_if_eligible" &&
      value.deletion_decision_version === null)
  ) {
    return false;
  }
  if (
    terminalReservationStatusesV1.has(value.status) !==
    (value.terminal_proof_hash !== null)
  ) {
    return false;
  }
  return !(
    (value.status === "succeeded" && value.opaque_ref === null) ||
    (value.status === "tombstoned" && value.opaque_ref !== null)
  );
}

export function isObjectOperationAttemptV1(
  value: unknown,
): value is ObjectOperationAttemptV1 {
  if (
    !boundedMetadataContractValueV1(value) ||
    !Value.Check(ObjectOperationAttemptV1Schema, value)
  ) {
    return false;
  }
  const terminal = new Set(["succeeded", "failed", "stale_rejected"]).has(
    value.status,
  );
  if (terminal !== (value.completed_at !== null)) return false;
  return value.actor_kind === "foreground"
    ? value.attempt_token_hash !== null &&
        value.claim_token_hash === null &&
        value.claim_generation === null
    : value.attempt_token_hash === null &&
        value.claim_token_hash !== null &&
        value.claim_generation !== null;
}

export function isObjectTerminalProofV1(
  value: unknown,
): value is ObjectTerminalProofV1 {
  if (
    !boundedMetadataContractValueV1(value) ||
    !Value.Check(ObjectTerminalProofV1Schema, value)
  ) {
    return false;
  }
  if (value.proof_kind === "put_receipt") {
    return (
      value.operation === "put_immutable" &&
      value.opaque_ref !== null &&
      value.provider_receipt_hash !== null &&
      value.physical_object_fingerprint !== null &&
      value.result_digest !== null &&
      value.result_size_bytes !== null &&
      value.result_media_type !== null &&
      value.provider_terminal_disposition === null &&
      value.tombstone === null
    );
  }
  if (value.proof_kind === "delete_tombstone") {
    return (
      value.operation === "delete_if_eligible" &&
      value.opaque_ref === null &&
      value.provider_receipt_hash !== null &&
      value.result_digest === null &&
      value.result_size_bytes === null &&
      value.result_media_type === null &&
      value.provider_terminal_disposition === null &&
      value.tombstone !== null
    );
  }
  return (
    value.opaque_ref === null &&
    value.provider_receipt_hash !== null &&
    value.physical_object_fingerprint === null &&
    value.result_digest === null &&
    value.result_size_bytes === null &&
    value.result_media_type === null &&
    value.provider_terminal_disposition !== null &&
    value.tombstone === null
  );
}

export function isObjectReconcileJobV1(
  value: unknown,
): value is ObjectReconcileJobV1 {
  if (
    !boundedMetadataContractValueV1(value) ||
    !Value.Check(ObjectReconcileJobV1Schema, value)
  ) {
    return false;
  }
  const hasClaim =
    value.claim_token_hash !== null &&
    value.claim_generation !== null &&
    value.claim_lease_expires_at !== null;
  const hasNoClaim =
    value.claim_token_hash === null &&
    value.claim_generation === null &&
    value.claim_lease_expires_at === null;
  if (value.status === "claimed" ? !hasClaim : !hasNoClaim) return false;
  if (
    (value.status === "pending" || value.status === "retry_wait") &&
    value.next_retry_at === null
  ) {
    return false;
  }
  return value.status !== "dlq"
    ? value.dlq_reason === null && value.dlq_at === null
    : value.dlq_reason !== null && value.dlq_at !== null;
}

function terminalProofMatchesOutcomeV1(
  proof: ObjectTerminalProofV1,
  attemptId: string,
  outcome: ObjectTerminalOutcomeV1,
): boolean {
  if (
    proof.attempt_id !== attemptId ||
    proof.operation !== outcome.operation ||
    proof.proof_kind !== outcome.proof_kind ||
    proof.proof_hash !== outcome.proof_hash
  ) {
    return false;
  }
  if (outcome.proof_kind === "put_receipt") {
    return (
      proof.opaque_ref === outcome.opaque_ref &&
      proof.provider_receipt_hash === outcome.provider_receipt_hash &&
      proof.physical_object_fingerprint ===
        outcome.physical_object_fingerprint &&
      proof.result_digest === outcome.result_digest &&
      proof.result_size_bytes === outcome.result_size_bytes &&
      proof.result_media_type === outcome.result_media_type &&
      proof.provider_terminal_disposition === null &&
      proof.tombstone === null
    );
  }
  if (outcome.proof_kind === "delete_tombstone") {
    return (
      proof.opaque_ref === null &&
      proof.provider_receipt_hash === outcome.provider_receipt_hash &&
      proof.physical_object_fingerprint ===
        (outcome.physical_object_fingerprint ?? null) &&
      proof.result_media_type === null &&
      proof.provider_terminal_disposition === null &&
      proof.tombstone !== null &&
      proof.tombstone.schema_version === outcome.tombstone.schema_version &&
      proof.tombstone.object_fingerprint ===
        outcome.tombstone.object_fingerprint &&
      proof.tombstone.deletion_decision_version ===
        outcome.tombstone.deletion_decision_version &&
      proof.tombstone.result === outcome.tombstone.result &&
      finiteTimestamp(proof.tombstone.observed_at) ===
        finiteTimestamp(outcome.tombstone.observed_at)
    );
  }
  return (
    proof.opaque_ref === null &&
    proof.proof_kind === "terminal_failure" &&
    proof.provider_receipt_hash === outcome.provider_receipt_hash &&
    proof.provider_terminal_disposition ===
      outcome.provider_terminal_disposition
  );
}

export function isObjectOperationResultV1(
  value: unknown,
): value is ObjectOperationResultV1 {
  if (
    !boundedMetadataContractValueV1(value) ||
    !Value.Check(ObjectOperationResultV1Schema, value) ||
    !hasDurableIdentitySemanticsV1(value)
  ) {
    return false;
  }
  const proof = value.terminal_proof;
  const settlement = value.reconcile_settlement;
  if (proof !== null) {
    if (
      !isObjectTerminalProofV1(proof) ||
      proof.reservation_id !== value.reservation_id ||
      proof.operation !== value.operation ||
      (proof.proof_kind === "put_receipt" &&
        (proof.physical_object_fingerprint !== value.object_fingerprint ||
          proof.result_digest !== value.expected_digest ||
          proof.result_size_bytes !== value.expected_size_bytes ||
          proof.result_media_type !== value.media_type)) ||
      (proof.proof_kind === "delete_tombstone" &&
        ((proof.physical_object_fingerprint !== null &&
          proof.physical_object_fingerprint !== value.object_fingerprint) ||
          proof.tombstone?.object_fingerprint !== value.object_fingerprint ||
          proof.tombstone.deletion_decision_version !==
            value.deletion_decision_version))
    ) {
      return false;
    }
  }
  if (
    settlement !== null &&
    ((settlement.kind === "retry_wait" &&
      (value.status !== "reconcile_required" || proof !== null)) ||
      (settlement.kind === "dlq" &&
        (value.status !== "dlq" || proof !== null)) ||
      (settlement.kind === "terminal" &&
        (proof === null ||
          !terminalProofMatchesOutcomeV1(
            proof,
            settlement.attempt_id,
            settlement.outcome,
          ))))
  ) {
    return false;
  }
  if (value.status === "succeeded") {
    return (
      proof?.proof_kind === "put_receipt" &&
      value.opaque_ref === proof.opaque_ref &&
      value.result_digest === proof.result_digest &&
      value.result_size_bytes === proof.result_size_bytes &&
      value.expected_digest === proof.result_digest &&
      value.expected_size_bytes === proof.result_size_bytes &&
      value.media_type === proof.result_media_type
    );
  }
  if (value.status === "tombstoned") {
    return (
      proof?.proof_kind === "delete_tombstone" &&
      value.opaque_ref === null
    );
  }
  if (value.status === "failed") {
    return proof?.proof_kind === "terminal_failure";
  }
  return proof === null;
}

export function isObjectMetadataGcEligibilityV1(
  value: unknown,
): value is ObjectMetadataGcEligibilityV1 {
  if (
    !boundedMetadataContractValueV1(value) ||
    !Value.Check(ObjectMetadataGcEligibilityV1Schema, value)
  ) {
    return false;
  }
  const retentionUntil = finiteTimestamp(value.retention_until);
  const gcNotBefore = finiteTimestamp(value.gc_not_before);
  return (
    retentionUntil !== undefined &&
    gcNotBefore !== undefined &&
    gcNotBefore >= retentionUntil &&
    value.terminal_proof_hash !== null
  );
}

export const OBJECT_STORE_METADATA_CONTRACT_V1 = Object.freeze({
  contract_version: OBJECT_STORE_METADATA_CONTRACT_VERSION_V1,
  source:
    "packages/object-store/src/db/metadata-contract.v1.ts" as const,
  fresh_migration: "0050_object_store" as const,
  owner_services: OBJECT_METADATA_OWNER_SERVICE_IDS_V1,
  schemas: Object.freeze({
    scope: ObjectMetadataScopeV1Schema,
    scope_columns: ObjectMetadataScopeColumnsV1Schema,
    reservation: ObjectMetadataReservationV1Schema,
    attempt: ObjectOperationAttemptV1Schema,
    terminal_proof: ObjectTerminalProofV1Schema,
    reconcile_job: ObjectReconcileJobV1Schema,
    gc_eligibility: ObjectMetadataGcEligibilityV1Schema,
  }),
  writers: OBJECT_STORE_METADATA_WRITER_CONTRACTS_V1,
});
