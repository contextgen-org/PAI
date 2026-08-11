import type { TSchema } from "@sinclair/typebox";

import { ConflictPolicyV1Schema } from "./policy/conflict-policy.v1.js";
import { DirectActivePolicyV1Schema } from "./policy/direct-active-policy.v1.js";
import { DelegatedPrincipalContextV1Schema } from "./shared/delegated-principal-context.v1.js";
import { DeploymentEnvironmentV1Schema } from "./shared/deployment-environment.v1.js";
import { DurableInboxIdentityV1Schema } from "./shared/durable-inbox-identity.v1.js";
import { DurableEventEnvelopeV1Schema } from "./shared/durable-event-envelope.v1.js";
import { OwnerDurableEventEnvelopeV1Schema } from "./shared/owner-durable-event-types.v1.js";
import { ReleaseChannelV1Schema } from "./shared/release-channel.v1.js";
import { ResponseEnvelopeV1Schema } from "./shared/response-envelope.v1.js";
import { ServiceIdV1Schema } from "./shared/service-id.v1.js";
import { TypedEvidenceRefV1Schema } from "./shared/typed-evidence-ref.v1.js";
import { WorkloadCredentialClaimsV1Schema } from "./shared/workload-credential-claims.v1.js";
import {
  AdmitTriggerCommandV1Schema,
  AdmitTriggerAcceptedResponseV1Schema,
  AdmitTriggerAuthorizationFailureResponseV1Schema,
  AdmitTriggerConflictResponseV1Schema,
  AdmitTriggerInternalErrorResponseV1Schema,
  AdmitTriggerInvalidRequestResponseV1Schema,
  AdmitTriggerNotFoundResponseV1Schema,
  AdmitTriggerOkResponseV1Schema,
  AdmitTriggerRateLimitedResponseV1Schema,
  AdmitTriggerRetryableFailureResponseV1Schema,
  AdmitTriggerUnauthenticatedResponseV1Schema,
  TriggerAdmissionDecisionV1Schema,
  TrustedAdmissionFactsV1Schema,
} from "./trigger-processor/trigger-admission.v1.js";
import { TriggerSubmitRequestV1Schema } from "./trigger-processor/trigger-submit.v1.js";
import { TriggerSubmitResponseV1Schema } from "./trigger-processor/trigger-submit-response.v1.js";
import {
  TriggerProcessStateV1Schema,
  TriggerProcessTransitionEvidenceV1Schema,
} from "./trigger-processor/trigger-process-state.v1.js";
import { TerminalOutcomeV1Schema } from "./trigger-processor/terminal-outcome.v1.js";
import {
  TriggerProcessorDomainEventV1Schema,
} from "./trigger-processor/events.v1.js";
import {
  ContextComposeContractV1Schema,
  ContextSnapshotV1Schema,
} from "./trigger-processor/context-compose.v1.js";
import {
  ContextSnapshotReadContractV1Schema,
  ContextSnapshotReadErrorV1Schema,
  ContextSnapshotResolveRequestV1Schema,
} from "./trigger-processor/context-snapshot-read.v1.js";
import { StructuredIntentV1Schema } from "./trigger-processor/structured-intent.v1.js";
import { IntentPolicyInputSnapshotV1Schema } from "./trigger-processor/intent-policy-input-snapshot.v1.js";
import { IntentSynthesizeContractV1Schema } from "./trigger-processor/intent-synthesize.v1.js";
import {
  TriggerProcessCancelRequestV1Schema,
} from "./trigger-processor/process-cancel.v1.js";
import { TriggerProcessCancelResponseV1Schema } from "./trigger-processor/process-cancel-response.v1.js";
import { TriggerProcessSnapshotV1Schema } from "./trigger-processor/process-snapshot.v1.js";
import {
  TriggerProcessSnapshotReadContractV1Schema,
  TriggerProcessSnapshotResolveRequestV1Schema,
} from "./trigger-processor/process-snapshot-read.v1.js";
import { RuntimeStartReservationValidateContractV1Schema } from "./trigger-processor/runtime-start-reservation-validate.v1.js";
import { SnapshotOverflowRefV1Schema } from "./trigger-processor/snapshot-overflow-ref.v1.js";
import { TriggerProcessQueryDetailsV1Schema } from "./trigger-processor/process-query.v1.js";
import { TriggerProcessGetResponseV1Schema } from "./trigger-processor/process-get-response.v1.js";
import {
  TriggerConfirmationChallengeV1Schema,
  TriggerConfirmationPendingViewV1Schema,
  TriggerConfirmationResponseV1Schema,
} from "./trigger-processor/confirmation.v1.js";
import { TriggerProcessSseEventV1Schema } from "./trigger-processor/process-sse.v1.js";
import { SnapshotAppendContractV1Schema } from "./trigger-processor/snapshot-append.v1.js";
import { TriggerProcessorCommandV1Schema } from "./trigger-processor/commands.v1.js";
import { TriggerProcessWorkPayloadV1Schema } from "./trigger-processor/work-item.v1.js";
import {
  RuntimeStartContractV1Schema,
} from "./action-runtime/runtime-start.v1.js";
import { ToolPermissionProfileV1Schema } from "./action-runtime/tool-permission-profile.v1.js";
import { ToolPermissionProfileCurrentReadContractV1Schema } from "./action-runtime/tool-permission-profile-current-read.v1.js";
import { RuntimeSkillLoadContractV1Schema } from "./action-runtime/skill-load.v1.js";
import { RuntimePolicyInputV1Schema } from "./action-runtime/runtime-policy-input.v1.js";
import { RuntimePolicyInputReadContractV1Schema } from "./action-runtime/runtime-policy-input-read.v1.js";
import { RuntimeCancelContractV1Schema } from "./action-runtime/runtime-cancel.v1.js";
import { RuntimePreemptContractV1Schema } from "./action-runtime/runtime-preempt.v1.js";
import { RuntimeUserRetractContractV1Schema } from "./action-runtime/runtime-user-retract.v1.js";
import {
  RuntimeDomainEventV1Schema,
} from "./action-runtime/runtime-events.v1.js";
import { ToolInvocationEventV1Schema } from "./action-runtime/tool-events.v1.js";
import { RuntimeEventReadContractV1Schema } from "./action-runtime/runtime-event-read.v1.js";
import { RuntimeTokenSseEventV1Schema } from "./action-runtime/runtime-token-sse.v1.js";
import { RuntimeRunQueryDetailsV1Schema } from "./action-runtime/runtime-run-query.v1.js";
import { ToolInvocationListDetailsV1Schema } from "./action-runtime/tool-invocation-query.v1.js";
import { RuntimeToolInvocationRequestV1Schema } from "./action-runtime/tool-invocation-request.v1.js";
import { MetaJobCreateContractV1Schema } from "./meta/meta-job-create.v1.js";
import { MetaJobQueryDetailsV1Schema } from "./meta/meta-job-query.v1.js";
import { QualitySignalListDetailsV1Schema } from "./meta/quality-signal-query.v1.js";
import { MetaCognitionDomainEventV1Schema } from "./meta/events.v1.js";
import { MetaResultPayloadV1Schema } from "./meta/meta-result-payload.v1.js";
import { QualitySignalV1Schema } from "./meta/quality-signal.v1.js";
import { FeedbackRequestV1Schema } from "./meta/feedback-request.v1.js";
import { PartialFailureV1Schema } from "./meta/partial-failure.v1.js";
import { MetaFeedbackAnswerContractV1Schema } from "./meta/feedback-answer.v1.js";
import { MetaExperienceQueryContractV1Schema } from "./meta/experience-query.v1.js";
import { MetaResultAuditQueryContractV1Schema } from "./meta/result-audit-query.v1.js";
import { MetaFeedbackRequestListContractV1Schema } from "./meta/feedback-request-list.v1.js";
import { FeedbackDedupeScopeRefV1Schema } from "./meta/feedback-dedupe-scope-ref.v1.js";
import { MetaFeedbackRequestSuggestionContractV1Schema } from "./meta/feedback-request-suggestion.v1.js";
import { MetaSnapshotRepairRequestV1Schema } from "./meta/snapshot-repair-request.v1.js";
import { MetaSnapshotRepairResponseV1Schema } from "./meta/snapshot-repair-response.v1.js";
import { MetaSkillCandidateReviewContractV1Schema } from "./meta/skill-candidate-review.v1.js";
import {
  MetaCommandClaimContractV1Schema,
  MetaCommandSettlementContractV1Schema,
} from "./meta/command-dispatch.v1.js";
import { MemoryWriteBatchV1Schema } from "./memory/write-batch.v1.js";
import { MemoryFastRecallV1Schema } from "./memory/fast-recall.v1.js";
import { MemoryDeepRecallV1Schema } from "./memory/deep-recall.v1.js";
import { MemoryPrePromotionCheckV1Schema } from "./memory/pre-promotion-check.v1.js";
import { MemoryDirectFeedbackV1Schema } from "./memory/direct-feedback.v1.js";
import { MemoryConflictV1Schema } from "./memory/conflict.v1.js";
import { MemoryIntegrationJobV1Schema } from "./memory/integration-job.v1.js";
import { MemoryEventEnvelopeV1Schema } from "./memory/memory-event.v1.js";
import { MemoryQuerySeriesV1Schema } from "./memory/query-series.v1.js";
import { MemoryGraphBuildV1Schema } from "./memory/graph-build.v1.js";
import { KnowThatWriteBatchV1Schema } from "./knowthat/write-batch.v1.js";
import { KnowThatQueryRequestV1Schema } from "./knowthat/query-request.v1.js";
import { KnowThatQueryResponseV1Schema } from "./knowthat/query-response.v1.js";
import { KnowThatFeedbackRequestV1Schema } from "./knowthat/feedback-request.v1.js";
import { KnowThatPromotionSuggestionV1Schema } from "./knowthat/promotion-suggestion.v1.js";
import { KnowThatCandidateReviewV1Schema } from "./knowthat/candidate-review.v1.js";
import { KnowThatCandidateReviewResultV1Schema } from "./knowthat/candidate-review-result.v1.js";
import { KnowThatLinkageRecoveryV1Schema } from "./knowthat/linkage-recovery.v1.js";
import { KnowThatEventEnvelopeV1Schema } from "./knowthat/knowthat-event.v1.js";
import { TimerScheduleCommandV1Schema } from "./timer/schedule-command.v1.js";
import { TimerScheduleQueryResponseV1Schema } from "./timer/schedule-query-response.v1.js";
import { TimerOccurrenceV1Schema } from "./timer/occurrence.v1.js";
import { TimerDispatchRequestV1Schema } from "./timer/dispatch-request.v1.js";
import { TimerCatchUpBatchV1Schema } from "./timer/catch-up-batch.v1.js";
import { TimerEventEnvelopeV1Schema } from "./timer/timer-event.v1.js";
import { SkillResolveContractV1Schema } from "./skill-registry/resolve.v1.js";
import { SkillContentContractV1Schema } from "./skill-registry/content.v1.js";
import { SkillValidateContractV1Schema } from "./skill-registry/validate.v1.js";
import { SkillPublishContractV1Schema } from "./skill-registry/publish.v1.js";
import { SkillCatalogQueryContractV1Schema } from "./skill-registry/catalog-query.v1.js";
import { SkillContextCatalogContractV1Schema } from "./skill-registry/context-catalog.v1.js";
import { SkillCandidateApplicationContractV1Schema } from "./skill-registry/candidate-application.v1.js";
import { SkillManagementCommandV1Schema } from "./skill-registry/management-commands.v1.js";
import { SkillRegistryDomainEventV1Schema } from "./skill-registry/events.v1.js";
import { SkillPermissionSummaryV1Schema } from "./skill-registry/skill-permission-summary.v1.js";

export interface SharedSchemaCatalogEntry {
  readonly schema_name: string;
  readonly schema_id: string;
  readonly version: "1.0.0";
  readonly owner_service: "architecture-contracts";
  readonly source_file: string;
  readonly generated_outputs: readonly string[];
  readonly contract_tests: readonly string[];
  readonly schema: TSchema;
}

function entry(
  schema_name: string,
  schema_id: string,
  source_file: string,
  generatedBase: string,
  contractTest: string,
  schema: TSchema,
  generatedOutputs?: readonly string[],
): SharedSchemaCatalogEntry {
  return {
    schema_name,
    schema_id,
    version: "1.0.0",
    owner_service: "architecture-contracts",
    source_file,
    generated_outputs: generatedOutputs ?? [
        `generated/schema/${generatedBase}.json`,
        "generated/openapi/shared.yaml",
        "generated/types/shared.d.ts",
      ],
    contract_tests: [contractTest],
    schema,
  };
}

export const SHARED_SCHEMA_CATALOG = [
  entry(
    "ResponseEnvelopeV1",
    "urn:pai:shared:response-envelope:v1",
    "packages/contracts/src/shared/response-envelope.v1.ts",
    "shared/response-envelope.v1",
    "packages/contracts/test/shared/response-envelope.contract.ts",
    ResponseEnvelopeV1Schema,
  ),
  entry(
    "TypedEvidenceRefV1",
    "urn:pai:shared:typed-evidence-ref:v1",
    "packages/contracts/src/shared/typed-evidence-ref.v1.ts",
    "shared/typed-evidence-ref.v1",
    "packages/contracts/test/shared/typed-evidence-ref.contract.ts",
    TypedEvidenceRefV1Schema,
  ),
  entry(
    "ConflictPolicyV1",
    "urn:pai:shared:conflict-policy:v1",
    "packages/contracts/src/policy/conflict-policy.v1.ts",
    "policy/conflict-policy.v1",
    "packages/contracts/test/policy/conflict-policy.contract.ts",
    ConflictPolicyV1Schema,
    [
      "generated/schema/policy/conflict-policy.v1.json",
      "generated/types/shared-policy.d.ts",
      "generated/fixtures/policy/conflict-policy.v1.truth-table.json",
    ],
  ),
  entry(
    "DirectActivePolicyV1",
    "urn:pai:shared:direct-active-policy:v1",
    "packages/contracts/src/policy/direct-active-policy.v1.ts",
    "policy/direct-active-policy.v1",
    "packages/contracts/test/policy/direct-active-policy.contract.ts",
    DirectActivePolicyV1Schema,
    [
      "generated/schema/policy/direct-active-policy.v1.json",
      "generated/types/shared-policy.d.ts",
      "generated/fixtures/policy/direct-active-policy.v1.truth-table.json",
    ],
  ),
  entry(
    "ServiceIdV1",
    "urn:pai:shared:service-id:v1",
    "packages/contracts/src/shared/service-id.v1.ts",
    "shared/service-id.v1",
    "packages/contracts/test/shared/service-id.contract.ts",
    ServiceIdV1Schema,
  ),
  entry(
    "DeploymentEnvironmentV1",
    "urn:pai:shared:deployment-environment:v1",
    "packages/contracts/src/shared/deployment-environment.v1.ts",
    "shared/deployment-environment.v1",
    "packages/contracts/test/shared/deployment-environment.contract.ts",
    DeploymentEnvironmentV1Schema,
  ),
  entry(
    "ReleaseChannelV1",
    "urn:pai:shared:release-channel:v1",
    "packages/contracts/src/shared/release-channel.v1.ts",
    "shared/release-channel.v1",
    "packages/contracts/test/shared/release-channel.contract.ts",
    ReleaseChannelV1Schema,
  ),
  entry(
    "DurableInboxIdentityV1",
    "urn:pai:shared:durable-inbox-identity:v1",
    "packages/contracts/src/shared/durable-inbox-identity.v1.ts",
    "shared/durable-inbox-identity.v1",
    "packages/contracts/test/shared/durable-inbox-identity.contract.ts",
    DurableInboxIdentityV1Schema,
  ),
  entry(
    "WorkloadCredentialClaimsV1",
    "urn:pai:shared:workload-credential-claims:v1",
    "packages/contracts/src/shared/workload-credential-claims.v1.ts",
    "shared/workload-credential-claims.v1",
    "packages/contracts/test/shared/workload-credential-claims.contract.ts",
    WorkloadCredentialClaimsV1Schema,
    [
      "generated/schema/shared/workload-credential-claims.v1.json",
      "generated/openapi/shared.yaml",
      "generated/types/shared-auth.d.ts",
      "generated/fixtures/auth/workload-credential-claims.v1.json",
    ],
  ),
  entry(
    "DelegatedPrincipalContextV1",
    "urn:pai:shared:delegated-principal-context:v1",
    "packages/contracts/src/shared/delegated-principal-context.v1.ts",
    "shared/delegated-principal-context.v1",
    "packages/contracts/test/shared/delegated-principal-context.contract.ts",
    DelegatedPrincipalContextV1Schema,
    [
      "generated/schema/shared/delegated-principal-context.v1.json",
      "generated/openapi/shared.yaml",
      "generated/types/shared-auth.d.ts",
      "generated/fixtures/auth/delegated-principal-context.v1.json",
    ],
  ),
] as const satisfies readonly SharedSchemaCatalogEntry[];

/**
 * Parent-architecture capabilities that already need one canonical TypeBox
 * source, but are not registered Shared schemas until their owner document has
 * the complete seven-column catalog row. Keeping these entries separate makes
 * it impossible for generated Shared artifacts to grant registration by
 * accident.
 */
export interface PendingOwnerSchemaGenerationEntry {
  readonly schema_name: string;
  readonly schema_id: string;
  readonly version: "1.0.0";
  readonly registration_status: "pending_owner_catalog_row";
  readonly source_file: string;
  readonly generated_outputs: readonly string[];
  readonly contract_tests: readonly string[];
  readonly schema: TSchema;
}

export const PENDING_OWNER_SCHEMA_GENERATION = [
  {
    schema_name: "DurableEventEnvelopeV1",
    schema_id: "urn:pai:shared:durable-event-envelope:v1",
    version: "1.0.0",
    registration_status: "pending_owner_catalog_row",
    source_file: "packages/contracts/src/shared/durable-event-envelope.v1.ts",
    generated_outputs: [
      "generated/schema/shared/durable-event-envelope.v1.json",
    ],
    contract_tests: [
      "packages/contracts/test/shared/durable-event-envelope.contract.ts",
    ],
    schema: DurableEventEnvelopeV1Schema,
  },
  {
    schema_name: "OwnerDurableEventEnvelopeV1",
    schema_id: "urn:pai:shared:owner-durable-event-envelope:v1",
    version: "1.0.0",
    registration_status: "pending_owner_catalog_row",
    source_file: "packages/contracts/src/shared/owner-durable-event-types.v1.ts",
    generated_outputs: [
      "generated/schema/shared/owner-durable-event-envelope.v1.json",
    ],
    contract_tests: [
      "packages/contracts/test/shared/owner-durable-event-types.contract.ts",
    ],
    schema: OwnerDurableEventEnvelopeV1Schema,
  },
] as const satisfies readonly PendingOwnerSchemaGenerationEntry[];

export interface TriggerProcessorSchemaCatalogEntry
  extends Omit<SharedSchemaCatalogEntry, "owner_service" | "version"> {
  readonly owner_service: "trigger_processor";
  readonly version: "1.0.0" | "1.1.0";
}

function triggerProcessorEntry(
  schema_name: string,
  schema_id: string,
  source_file: string,
  generated_file: string,
  contract_test: string,
  schema: TSchema,
  generatedOutputs?: readonly string[],
  version: TriggerProcessorSchemaCatalogEntry["version"] = "1.0.0",
): TriggerProcessorSchemaCatalogEntry {
  return {
    schema_name,
    schema_id,
    version,
    owner_service: "trigger_processor",
    source_file,
    generated_outputs: generatedOutputs ?? [
        generated_file,
        "generated/openapi/trigger-processor.yaml",
        "generated/types/trigger-processor.d.ts",
      ],
    contract_tests: [contract_test],
    schema,
  };
}

export const TRIGGER_PROCESSOR_SCHEMA_CATALOG = [
  triggerProcessorEntry(
    "TriggerProcessorDomainEventV1",
    "urn:pai:trigger-processor:domain-event:v1",
    "packages/contracts/src/trigger-processor/events.v1.ts",
    "generated/schema/trigger-processor/events.v1.json",
    "packages/contracts/test/events/trigger-processor-events.contract.ts",
    TriggerProcessorDomainEventV1Schema,
    [
      "generated/schema/trigger-processor/events.v1.json",
      "generated/asyncapi/trigger-processor.yaml",
      "generated/types/trigger-processor-events.d.ts",
      "generated/db/trigger-processor-event-check.sql",
    ],
  ),
  triggerProcessorEntry(
    "TriggerProcessStateV1",
    "urn:pai:trigger-processor:trigger-process-state:v1",
    "packages/contracts/src/trigger-processor/trigger-process-state.v1.ts",
    "generated/schema/trigger-processor/trigger-process-state.v1.json",
    "packages/contracts/test/trigger-processor/trigger-process-state.contract.ts",
    TriggerProcessStateV1Schema,
  ),
  triggerProcessorEntry(
    "TerminalOutcomeV1",
    "urn:pai:trigger-processor:terminal-outcome:v1",
    "packages/contracts/src/trigger-processor/terminal-outcome.v1.ts",
    "generated/schema/trigger-processor/terminal-outcome.v1.json",
    "services/trigger-processor/test/contracts/terminal-outcome.contract.ts",
    TerminalOutcomeV1Schema,
    [
      "generated/schema/trigger-processor/terminal-outcome.v1.json",
      "generated/openapi/trigger-processor.yaml",
      "generated/types/trigger-processor.d.ts",
      "generated/db/trigger-processor-terminal-outcome-check.sql",
    ],
  ),
  triggerProcessorEntry(
    "TriggerSubmitRequestV1",
    "urn:pai:trigger-processor:trigger-submit-request:v1",
    "packages/contracts/src/trigger-processor/trigger-submit.v1.ts",
    "generated/schema/trigger-processor/trigger-submit.v1.json",
    "services/trigger-processor/test/contracts/trigger-submit.contract.ts",
    TriggerSubmitRequestV1Schema,
  ),
  triggerProcessorEntry(
    "AdmitTriggerCommandV1",
    "urn:pai:trigger-processor:admit-trigger-command:v1",
    "packages/contracts/src/trigger-processor/trigger-admission.v1.ts",
    "generated/schema/trigger-processor/admit-trigger-command.v1.json",
    "packages/contracts/test/trigger-processor/trigger-admission.contract.ts",
    AdmitTriggerCommandV1Schema,
  ),
  triggerProcessorEntry(
    "TriggerSubmitResponseV1",
    "urn:pai:trigger-processor:trigger-submit-response:v1",
    "packages/contracts/src/trigger-processor/trigger-submit-response.v1.ts",
    "generated/schema/trigger-processor/trigger-submit-response.v1.json",
    "services/trigger-processor/test/contracts/trigger-submit-response.contract.ts",
    TriggerSubmitResponseV1Schema,
  ),
  triggerProcessorEntry(
    "TrustedAdmissionFactsV1",
    "urn:pai:trigger-processor:trusted-admission-facts:v1",
    "packages/contracts/src/trigger-processor/trigger-admission.v1.ts",
    "generated/schema/trigger-processor/trusted-admission-facts.v1.json",
    "packages/contracts/test/trigger-processor/trigger-admission.contract.ts",
    TrustedAdmissionFactsV1Schema,
  ),
  triggerProcessorEntry(
    "TriggerAdmissionDecisionV1",
    "urn:pai:trigger-processor:trigger-admission-decision:v1",
    "packages/contracts/src/trigger-processor/trigger-admission.v1.ts",
    "generated/schema/trigger-processor/trigger-admission-decision.v1.json",
    "packages/contracts/test/trigger-processor/trigger-admission.contract.ts",
    TriggerAdmissionDecisionV1Schema,
  ),
  triggerProcessorEntry(
    "TriggerProcessTransitionEvidenceV1",
    "urn:pai:trigger-processor:trigger-process-transition-evidence:v1",
    "packages/contracts/src/trigger-processor/trigger-process-state.v1.ts",
    "generated/schema/trigger-processor/trigger-process-transition-evidence.v1.json",
    "packages/contracts/test/trigger-processor/trigger-process-transition-evidence.contract.ts",
    TriggerProcessTransitionEvidenceV1Schema,
  ),
  triggerProcessorEntry(
    "StructuredIntentV1",
    "urn:pai:trigger-processor:structured-intent:v1",
    "packages/contracts/src/trigger-processor/structured-intent.v1.ts",
    "generated/schema/trigger-processor/structured-intent.v1.json",
    "packages/contracts/test/trigger-processor/day11-contracts.contract.ts",
    StructuredIntentV1Schema,
  ),
  triggerProcessorEntry(
    "IntentPolicyInputSnapshotV1",
    "urn:pai:trigger-processor:intent-policy-input-snapshot:v1",
    "packages/contracts/src/trigger-processor/intent-policy-input-snapshot.v1.ts",
    "generated/schema/trigger-processor/intent-policy-input-snapshot.v1.json",
    "packages/contracts/test/trigger-processor/day11-contracts.contract.ts",
    IntentPolicyInputSnapshotV1Schema,
  ),
  triggerProcessorEntry(
    "ContextSnapshotV1",
    "urn:pai:trigger-processor:context-snapshot:v1",
    "packages/contracts/src/trigger-processor/context-compose.v1.ts",
    "generated/schema/trigger-processor/context-snapshot.v1.json",
    "packages/contracts/test/trigger-processor/day11-contracts.contract.ts",
    ContextSnapshotV1Schema,
    [
      "generated/schema/trigger-processor/context-snapshot.v1.json",
      "generated/openapi/trigger-processor-internal.yaml",
      "generated/types/trigger-processor.d.ts",
    ],
  ),
  triggerProcessorEntry(
    "ContextComposeContractV1",
    "urn:pai:trigger-processor:context-compose:v1",
    "packages/contracts/src/trigger-processor/context-compose.v1.ts",
    "generated/schema/trigger-processor/context-compose.v1.json",
    "packages/contracts/test/trigger-processor/day11-contracts.contract.ts",
    ContextComposeContractV1Schema,
    [
      "generated/schema/trigger-processor/context-compose.v1.json",
      "generated/openapi/trigger-processor-internal.yaml",
      "generated/types/trigger-processor.d.ts",
    ],
  ),
  triggerProcessorEntry(
    "ContextSnapshotResolveRequestV1",
    "urn:pai:trigger-processor:context-snapshot-resolve-request:v1",
    "packages/contracts/src/trigger-processor/context-snapshot-read.v1.ts",
    "generated/schema/trigger-processor/context-snapshot-resolve-request.v1.json",
    "packages/contracts/test/consumer/context-snapshot-read.contract.ts",
    ContextSnapshotResolveRequestV1Schema,
    [
      "generated/schema/trigger-processor/context-snapshot-resolve-request.v1.json",
      "generated/openapi/trigger-processor-internal.yaml",
      "generated/types/trigger-processor.d.ts",
    ],
  ),
  triggerProcessorEntry(
    "ContextSnapshotReadContractV1",
    "urn:pai:trigger-processor:context-snapshot-read:v1",
    "packages/contracts/src/trigger-processor/context-snapshot-read.v1.ts",
    "generated/schema/trigger-processor/context-snapshot-read.v1.json",
    "packages/contracts/test/consumer/context-snapshot-read.contract.ts",
    ContextSnapshotReadContractV1Schema,
    [
      "generated/schema/trigger-processor/context-snapshot-read.v1.json",
      "generated/openapi/trigger-processor-internal.yaml",
      "generated/types/trigger-processor.d.ts",
    ],
  ),
  triggerProcessorEntry(
    "ContextSnapshotReadErrorV1",
    "urn:pai:trigger-processor:context-snapshot-read-error:v1",
    "packages/contracts/src/trigger-processor/context-snapshot-read.v1.ts",
    "generated/schema/trigger-processor/context-snapshot-read-error.v1.json",
    "packages/contracts/test/consumer/context-snapshot-read.contract.ts",
    ContextSnapshotReadErrorV1Schema,
    [
      "generated/schema/trigger-processor/context-snapshot-read-error.v1.json",
      "generated/openapi/trigger-processor-internal.yaml",
      "generated/types/trigger-processor.d.ts",
    ],
  ),
  triggerProcessorEntry(
    "IntentSynthesizeContractV1",
    "urn:pai:trigger-processor:intent-synthesize:v1",
    "packages/contracts/src/trigger-processor/intent-synthesize.v1.ts",
    "generated/schema/trigger-processor/intent-synthesize.v1.json",
    "packages/contracts/test/trigger-processor/day11-contracts.contract.ts",
    IntentSynthesizeContractV1Schema,
    [
      "generated/schema/trigger-processor/intent-synthesize.v1.json",
      "generated/openapi/trigger-processor-internal.yaml",
      "generated/types/trigger-processor.d.ts",
    ],
  ),
  triggerProcessorEntry(
    "TriggerProcessCancelRequestV1",
    "urn:pai:trigger-processor:process-cancel-request:v1",
    "packages/contracts/src/trigger-processor/process-cancel.v1.ts",
    "generated/schema/trigger-processor/process-cancel.v1.json",
    "services/trigger-processor/test/contracts/process-cancel.contract.ts",
    TriggerProcessCancelRequestV1Schema,
  ),
  triggerProcessorEntry(
    "TriggerProcessCancelResponseV1",
    "urn:pai:trigger-processor:process-cancel-response:v1",
    "packages/contracts/src/trigger-processor/process-cancel-response.v1.ts",
    "generated/schema/trigger-processor/process-cancel-response.v1.json",
    "services/trigger-processor/test/contracts/process-cancel-response.contract.ts",
    TriggerProcessCancelResponseV1Schema,
  ),
  triggerProcessorEntry(
    "TriggerProcessQueryDetailsV1",
    "urn:pai:trigger-processor:process-query-details:v1",
    "packages/contracts/src/trigger-processor/process-query.v1.ts",
    "generated/schema/trigger-processor/process-query.v1.json",
    "services/trigger-processor/test/contracts/process-query.contract.ts",
    TriggerProcessQueryDetailsV1Schema,
  ),
  triggerProcessorEntry(
    "TriggerProcessGetResponseV1",
    "urn:pai:trigger-processor:process-get-response:v1",
    "packages/contracts/src/trigger-processor/process-get-response.v1.ts",
    "generated/schema/trigger-processor/process-get-response.v1.json",
    "services/trigger-processor/test/contracts/process-get-response.contract.ts",
    TriggerProcessGetResponseV1Schema,
  ),
  triggerProcessorEntry(
    "TriggerConfirmationChallengeV1",
    "urn:pai:trigger-processor:confirmation-challenge:v1",
    "packages/contracts/src/trigger-processor/confirmation.v1.ts",
    "generated/schema/trigger-processor/confirmation-challenge.v1.json",
    "services/trigger-processor/test/contracts/confirmation-challenge.contract.ts",
    TriggerConfirmationChallengeV1Schema,
  ),
  triggerProcessorEntry(
    "TriggerConfirmationPendingViewV1",
    "urn:pai:trigger-processor:confirmation-pending-view:v1",
    "packages/contracts/src/trigger-processor/confirmation.v1.ts",
    "generated/schema/trigger-processor/confirmation-pending-view.v1.json",
    "services/trigger-processor/test/contracts/confirmation-pending-view.contract.ts",
    TriggerConfirmationPendingViewV1Schema,
  ),
  triggerProcessorEntry(
    "TriggerConfirmationResponseV1",
    "urn:pai:trigger-processor:confirmation-response:v1",
    "packages/contracts/src/trigger-processor/confirmation.v1.ts",
    "generated/schema/trigger-processor/confirmation-response.v1.json",
    "services/trigger-processor/test/contracts/confirmation-response.contract.ts",
    TriggerConfirmationResponseV1Schema,
  ),
  triggerProcessorEntry(
    "TriggerProcessSseEventV1",
    "urn:pai:trigger-processor:process-sse-event:v1",
    "packages/contracts/src/trigger-processor/process-sse.v1.ts",
    "generated/schema/trigger-processor/process-sse.v1.json",
    "services/trigger-processor/test/contracts/process-sse.contract.ts",
    TriggerProcessSseEventV1Schema,
  ),
  triggerProcessorEntry(
    "SnapshotOverflowRefV1",
    "urn:pai:trigger-processor:snapshot-overflow-ref:v1",
    "packages/contracts/src/trigger-processor/snapshot-overflow-ref.v1.ts",
    "generated/schema/trigger-processor/snapshot-overflow-ref.v1.json",
    "services/trigger-processor/test/contracts/snapshot-overflow-ref.contract.ts",
    SnapshotOverflowRefV1Schema,
    [
      "generated/schema/trigger-processor/snapshot-overflow-ref.v1.json",
      "generated/openapi/trigger-processor-internal.yaml",
      "generated/types/trigger-processor.d.ts",
    ],
  ),
  triggerProcessorEntry(
    "TriggerProcessSnapshotV1",
    "urn:pai:trigger-processor:process-snapshot:v1",
    "packages/contracts/src/trigger-processor/process-snapshot.v1.ts",
    "generated/schema/trigger-processor/process-snapshot.v1.json",
    "packages/contracts/test/trigger-processor/process-snapshot.contract.ts",
    TriggerProcessSnapshotV1Schema,
    [
      "generated/schema/trigger-processor/process-snapshot.v1.json",
      "generated/openapi/trigger-processor-internal.yaml",
      "generated/types/trigger-processor.d.ts",
    ],
  ),
  triggerProcessorEntry(
    "TriggerProcessSnapshotResolveRequestV1",
    "urn:pai:trigger-processor:snapshot-resolve-request:v1",
    "packages/contracts/src/trigger-processor/process-snapshot-read.v1.ts",
    "generated/schema/trigger-processor/process-snapshot-resolve-request.v1.json",
    "packages/contracts/test/consumer/meta-trigger-process-snapshot-read.contract.ts",
    TriggerProcessSnapshotResolveRequestV1Schema,
    [
      "generated/schema/trigger-processor/process-snapshot-resolve-request.v1.json",
      "generated/openapi/trigger-processor-internal.yaml",
      "generated/types/trigger-processor.d.ts",
    ],
  ),
  triggerProcessorEntry(
    "TriggerProcessSnapshotReadContractV1",
    "urn:pai:trigger-processor:snapshot-read:v1",
    "packages/contracts/src/trigger-processor/process-snapshot-read.v1.ts",
    "generated/schema/trigger-processor/process-snapshot-read.v1.json",
    "packages/contracts/test/consumer/meta-trigger-process-snapshot-read.contract.ts",
    TriggerProcessSnapshotReadContractV1Schema,
    [
      "generated/schema/trigger-processor/process-snapshot-read.v1.json",
      "generated/openapi/trigger-processor-internal.yaml",
      "generated/types/trigger-processor.d.ts",
    ],
  ),
  triggerProcessorEntry(
    "RuntimeStartReservationValidateContractV1",
    "urn:pai:trigger-processor:runtime-start-reservation-validate:v1",
    "packages/contracts/src/trigger-processor/runtime-start-reservation-validate.v1.ts",
    "generated/schema/trigger-processor/runtime-start-reservation-validate.v1.json",
    "packages/contracts/test/consumer/runtime-start-reservation-validate.contract.ts",
    RuntimeStartReservationValidateContractV1Schema,
    [
      "generated/schema/trigger-processor/runtime-start-reservation-validate.v1.json",
      "generated/openapi/trigger-processor-internal.yaml",
      "generated/types/trigger-processor.d.ts",
    ],
    "1.1.0",
  ),
  triggerProcessorEntry(
    "SnapshotAppendContractV1",
    "urn:pai:trigger-processor:snapshot-append:v1",
    "packages/contracts/src/trigger-processor/snapshot-append.v1.ts",
    "generated/schema/trigger-processor/snapshot-append.v1.json",
    "packages/contracts/test/trigger-processor/day11-contracts.contract.ts",
    SnapshotAppendContractV1Schema,
    [
      "generated/schema/trigger-processor/snapshot-append.v1.json",
      "generated/openapi/trigger-processor-internal.yaml",
      "generated/types/trigger-processor.d.ts",
    ],
  ),
  triggerProcessorEntry(
    "TriggerProcessorCommandV1",
    "urn:pai:trigger-processor:command:v1",
    "packages/contracts/src/trigger-processor/commands.v1.ts",
    "generated/schema/trigger-processor/commands.v1.json",
    "packages/contracts/test/trigger-processor/day11-contracts.contract.ts",
    TriggerProcessorCommandV1Schema,
    [
      "generated/schema/trigger-processor/commands.v1.json",
      "generated/openapi/trigger-processor-internal.yaml",
      "generated/types/trigger-processor.d.ts",
      "generated/db/trigger-processor-command-check.sql",
    ],
  ),
  triggerProcessorEntry(
    "TriggerProcessWorkPayloadV1",
    "urn:pai:trigger-processor:work-item:v1",
    "packages/contracts/src/trigger-processor/work-item.v1.ts",
    "generated/schema/trigger-processor/work-item.v1.json",
    "packages/contracts/test/trigger-processor/work-item.contract.ts",
    TriggerProcessWorkPayloadV1Schema,
    [
      "generated/schema/trigger-processor/work-item.v1.json",
      "generated/types/trigger-processor.d.ts",
    ],
  ),
] as const satisfies readonly TriggerProcessorSchemaCatalogEntry[];

export interface RegisteredOwnerSchemaCatalogEntry {
  readonly schema_name: string;
  readonly schema_id: string;
  readonly version: "1.0.0" | "1.1.0" | "1.2.0";
  readonly owner_service:
    | "action-runtime"
    | "meta-cognition"
    | "memory-service"
    | "knowthat"
    | "timer-trigger-app"
    | "skill-registry"
    | "skill_registry";
  readonly source_file: string;
  readonly generated_outputs: readonly string[];
  readonly contract_tests: readonly string[];
  readonly schema: TSchema;
}

function ownerEntry(
  schema_name: string,
  schema_id: string,
  version: RegisteredOwnerSchemaCatalogEntry["version"],
  owner_service: RegisteredOwnerSchemaCatalogEntry["owner_service"],
  source_file: string,
  generated_outputs: readonly string[],
  contract_test: string | readonly string[],
  schema: TSchema,
): RegisteredOwnerSchemaCatalogEntry {
  return {
    schema_name,
    schema_id,
    version,
    owner_service,
    source_file,
    generated_outputs,
    contract_tests:
      typeof contract_test === "string" ? [contract_test] : contract_test,
    schema,
  };
}

export const REGISTERED_OWNER_SCHEMA_CATALOG = [
  ownerEntry(
    "ToolPermissionProfileV1",
    "urn:pai:action-runtime:tool-permission-profile:v1",
    "1.0.0",
    "action-runtime",
    "packages/contracts/src/action-runtime/tool-permission-profile.v1.ts",
    [
      "generated/schema/action-runtime/tool-permission-profile.v1.json",
      "generated/openapi/action-runtime-internal.yaml",
      "generated/types/action-runtime.d.ts",
    ],
    "packages/contracts/test/action-runtime/tool-permission-profile.contract.ts",
    ToolPermissionProfileV1Schema,
  ),
  ownerEntry(
    "ToolPermissionProfileCurrentReadContractV1",
    "urn:pai:action-runtime:tool-permission-profile-current-read:v1",
    "1.0.0",
    "action-runtime",
    "packages/contracts/src/action-runtime/tool-permission-profile-current-read.v1.ts",
    [
      "generated/schema/action-runtime/tool-permission-profile-current-read.v1.json",
      "generated/openapi/action-runtime-internal.yaml",
      "generated/types/action-runtime.d.ts",
    ],
    "packages/contracts/test/consumer/tp-tool-permission-profile.contract.ts",
    ToolPermissionProfileCurrentReadContractV1Schema,
  ),
  ownerEntry(
    "RuntimeStartContractV1",
    "urn:pai:action-runtime:runtime-start:v1",
    "1.2.0",
    "action-runtime",
    "packages/contracts/src/action-runtime/runtime-start.v1.ts",
    [
      "generated/schema/action-runtime/runtime-start.v1.json",
      "generated/openapi/action-runtime-internal.yaml",
      "generated/types/action-runtime.d.ts",
    ],
    "packages/contracts/test/action-runtime/day11-runtime.contract.ts",
    RuntimeStartContractV1Schema,
  ),
  ownerEntry(
    "RuntimePolicyInputV1",
    "urn:pai:action-runtime:runtime-policy-input:v1",
    "1.0.0",
    "action-runtime",
    "packages/contracts/src/action-runtime/runtime-policy-input.v1.ts",
    [
      "generated/schema/action-runtime/runtime-policy-input.v1.json",
      "generated/types/action-runtime.d.ts",
    ],
    "packages/contracts/test/action-runtime/day11-runtime.contract.ts",
    RuntimePolicyInputV1Schema,
  ),
  ownerEntry(
    "RuntimePolicyInputReadContractV1",
    "urn:pai:action-runtime:runtime-policy-input-read:v1",
    "1.0.0",
    "action-runtime",
    "packages/contracts/src/action-runtime/runtime-policy-input-read.v1.ts",
    [
      "generated/schema/action-runtime/runtime-policy-input-read.v1.json",
      "generated/openapi/action-runtime-internal.yaml",
      "generated/types/action-runtime.d.ts",
    ],
    "packages/contracts/test/consumer/registry-runtime-policy-input-read.contract.ts",
    RuntimePolicyInputReadContractV1Schema,
  ),
  ...([
    ["RuntimeCancelContractV1", "runtime-cancel", RuntimeCancelContractV1Schema],
    ["RuntimePreemptContractV1", "runtime-preempt", RuntimePreemptContractV1Schema],
    ["RuntimeUserRetractContractV1", "runtime-user-retract", RuntimeUserRetractContractV1Schema],
  ] as const).map(([schema_name, basename, schema]) =>
    ownerEntry(
      schema_name,
      `urn:pai:action-runtime:${basename}:v1`,
      "1.0.0",
      "action-runtime",
      `packages/contracts/src/action-runtime/${basename}.v1.ts`,
      [
        `generated/schema/action-runtime/${basename}.v1.json`,
        "generated/openapi/action-runtime-internal.yaml",
        "generated/types/action-runtime.d.ts",
      ],
      "packages/contracts/test/action-runtime/day11-runtime.contract.ts",
      schema,
    ),
  ),
  ownerEntry(
    "RuntimeEventReadContractV1",
    "urn:pai:action-runtime:runtime-event-read:v1",
    "1.0.0",
    "action-runtime",
    "packages/contracts/src/action-runtime/runtime-event-read.v1.ts",
    [
      "generated/schema/action-runtime/runtime-event-read.v1.json",
      "generated/openapi/action-runtime-internal.yaml",
      "generated/types/action-runtime.d.ts",
    ],
    [
      "packages/contracts/test/provider/runtime-event-read.contract.ts",
      "packages/contracts/test/consumer/tp-runtime-event-read.contract.ts",
    ],
    RuntimeEventReadContractV1Schema,
  ),
  ownerEntry(
    "RuntimeSkillLoadContractV1",
    "urn:pai:action-runtime:skill-load:v1",
    "1.0.0",
    "action-runtime",
    "packages/contracts/src/action-runtime/skill-load.v1.ts",
    [
      "generated/schema/action-runtime/skill-load.v1.json",
      "generated/openapi/action-runtime-internal.yaml",
      "generated/types/action-runtime.d.ts",
    ],
    "packages/contracts/test/runtime/skill-load.contract.ts",
    RuntimeSkillLoadContractV1Schema,
  ),
  ownerEntry(
    "RuntimeTokenSseEventV1",
    "urn:pai:action-runtime:runtime-token-sse-event:v1",
    "1.0.0",
    "action-runtime",
    "packages/contracts/src/action-runtime/runtime-token-sse.v1.ts",
    [
      "generated/schema/action-runtime/runtime-token-sse.v1.json",
      "generated/openapi/action-runtime-internal.yaml",
      "generated/asyncapi/action-runtime-token-sse.yaml",
      "generated/types/action-runtime-events.d.ts",
    ],
    "packages/contracts/test/runtime/runtime-token-sse.contract.ts",
    RuntimeTokenSseEventV1Schema,
  ),
  ownerEntry(
    "RuntimeRunQueryDetailsV1",
    "urn:pai:action-runtime:runtime-run-query:v1",
    "1.0.0",
    "action-runtime",
    "packages/contracts/src/action-runtime/runtime-run-query.v1.ts",
    [
      "generated/schema/action-runtime/runtime-run-query.v1.json",
      "generated/openapi/action-runtime.yaml",
      "generated/types/action-runtime.d.ts",
    ],
    "packages/contracts/test/runtime/runtime-run-query.contract.ts",
    RuntimeRunQueryDetailsV1Schema,
  ),
  ownerEntry(
    "ToolInvocationListDetailsV1",
    "urn:pai:action-runtime:tool-invocation-list:v1",
    "1.0.0",
    "action-runtime",
    "packages/contracts/src/action-runtime/tool-invocation-query.v1.ts",
    [
      "generated/schema/action-runtime/tool-invocation-query.v1.json",
      "generated/openapi/action-runtime.yaml",
      "generated/types/action-runtime.d.ts",
    ],
    "packages/contracts/test/runtime/tool-invocation-query.contract.ts",
    ToolInvocationListDetailsV1Schema,
  ),
  ownerEntry(
    "RuntimeToolInvocationRequestV1",
    "urn:pai:action-runtime:runtime-tool-invocation-request:v1",
    "1.0.0",
    "action-runtime",
    "packages/contracts/src/action-runtime/tool-invocation-request.v1.ts",
    [
      "generated/schema/action-runtime/runtime-tool-invocation-request.v1.json",
      "generated/types/action-runtime.d.ts",
    ],
    "packages/contracts/test/action-runtime/tool-invocation-request.contract.ts",
    RuntimeToolInvocationRequestV1Schema,
  ),
  ownerEntry(
    "RuntimeDomainEventV1",
    "urn:pai:action-runtime:runtime-event:v1",
    "1.0.0",
    "action-runtime",
    "packages/contracts/src/action-runtime/runtime-events.v1.ts",
    [
      "generated/schema/action-runtime/runtime-events.v1.json",
      "generated/asyncapi/action-runtime.yaml",
      "generated/types/action-runtime-events.d.ts",
    ],
    "packages/contracts/test/action-runtime/day11-runtime.contract.ts",
    RuntimeDomainEventV1Schema,
  ),
  ownerEntry(
    "ToolInvocationEventV1",
    "urn:pai:action-runtime:tool-event:v1",
    "1.0.0",
    "action-runtime",
    "packages/contracts/src/action-runtime/tool-events.v1.ts",
    [
      "generated/schema/action-runtime/tool-events.v1.json",
      "generated/asyncapi/action-runtime.yaml",
      "generated/types/action-runtime-events.d.ts",
    ],
    "packages/contracts/test/events/tool-events.contract.ts",
    ToolInvocationEventV1Schema,
  ),
  ownerEntry(
    "MetaJobCreateContractV1",
    "urn:pai:meta:meta-job-create:v1",
    "1.0.0",
    "meta-cognition",
    "packages/contracts/src/meta/meta-job-create.v1.ts",
    [
      "generated/schema/meta/meta-job-create.v1.json",
      "generated/openapi/meta-internal.yaml",
      "generated/types/meta.d.ts",
    ],
    "packages/contracts/test/meta/meta-job-create.contract.ts",
    MetaJobCreateContractV1Schema,
  ),
  ownerEntry(
    "MetaJobQueryDetailsV1",
    "urn:pai:meta:job-query-details:v1",
    "1.0.0",
    "meta-cognition",
    "packages/contracts/src/meta/meta-job-query.v1.ts",
    [
      "generated/schema/meta/meta-job-query.v1.json",
      "generated/openapi/meta-cognition.yaml",
      "generated/types/meta.d.ts",
    ],
    "packages/contracts/test/meta/meta-job-query.contract.ts",
    MetaJobQueryDetailsV1Schema,
  ),
  ownerEntry(
    "QualitySignalListDetailsV1",
    "urn:pai:meta:quality-signal-list-details:v1",
    "1.0.0",
    "meta-cognition",
    "packages/contracts/src/meta/quality-signal-query.v1.ts",
    [
      "generated/schema/meta/quality-signal-query.v1.json",
      "generated/openapi/meta-cognition.yaml",
      "generated/types/meta.d.ts",
    ],
    "packages/contracts/test/meta/quality-signal-query.contract.ts",
    QualitySignalListDetailsV1Schema,
  ),
  ownerEntry(
    "MetaCognitionDomainEventV1",
    "urn:pai:meta:domain-event:v1",
    "1.0.0",
    "meta-cognition",
    "packages/contracts/src/meta/events.v1.ts",
    [
      "generated/schema/meta/events.v1.json",
      "generated/asyncapi/meta-cognition.yaml",
      "generated/types/meta-cognition-events.d.ts",
    ],
    "packages/contracts/test/events/meta-cognition-events.contract.ts",
    MetaCognitionDomainEventV1Schema,
  ),
  ownerEntry(
    "MetaResultPayload",
    "urn:pai:meta:result-payload:v1",
    "1.0.0",
    "meta-cognition",
    "packages/contracts/src/meta/meta-result-payload.v1.ts",
    [
      "generated/schema/meta/meta-result-payload.v1.json",
      "generated/openapi/meta-internal.yaml",
      "generated/types/meta.d.ts",
    ],
    "packages/contracts/test/meta/meta-result-payload.contract.ts",
    MetaResultPayloadV1Schema,
  ),
  ownerEntry(
    "QualitySignal",
    "urn:pai:meta:quality-signal:v1",
    "1.0.0",
    "meta-cognition",
    "packages/contracts/src/meta/quality-signal.v1.ts",
    [
      "generated/schema/meta/quality-signal.v1.json",
      "generated/openapi/meta-cognition.yaml",
      "generated/types/meta.d.ts",
    ],
    "packages/contracts/test/meta/quality-signal.contract.ts",
    QualitySignalV1Schema,
  ),
  ownerEntry(
    "FeedbackRequest",
    "urn:pai:meta:feedback-request:v1",
    "1.0.0",
    "meta-cognition",
    "packages/contracts/src/meta/feedback-request.v1.ts",
    [
      "generated/schema/meta/feedback-request.v1.json",
      "generated/openapi/meta-internal.yaml",
      "generated/types/meta.d.ts",
    ],
    "packages/contracts/test/meta/feedback-request.contract.ts",
    FeedbackRequestV1Schema,
  ),
  ownerEntry(
    "PartialFailure",
    "urn:pai:meta:partial-failure:v1",
    "1.0.0",
    "meta-cognition",
    "packages/contracts/src/meta/partial-failure.v1.ts",
    [
      "generated/schema/meta/partial-failure.v1.json",
      "generated/openapi/meta-internal.yaml",
      "generated/types/meta.d.ts",
    ],
    "packages/contracts/test/meta/partial-failure.contract.ts",
    PartialFailureV1Schema,
  ),
  ownerEntry(
    "MetaFeedbackAnswerContractV1",
    "urn:pai:meta:feedback-answer:v1",
    "1.0.0",
    "meta-cognition",
    "packages/contracts/src/meta/feedback-answer.v1.ts",
    [
      "generated/schema/meta/feedback-answer.v1.json",
      "generated/openapi/meta-internal.yaml",
      "generated/types/meta.d.ts",
    ],
    "packages/contracts/test/meta/feedback-answer.contract.ts",
    MetaFeedbackAnswerContractV1Schema,
  ),
  ownerEntry(
    "MetaExperienceQueryContractV1",
    "urn:pai:meta:experience-query:v1",
    "1.0.0",
    "meta-cognition",
    "packages/contracts/src/meta/experience-query.v1.ts",
    [
      "generated/schema/meta/experience-query.v1.json",
      "generated/openapi/meta-cognition.yaml",
      "generated/types/meta.d.ts",
    ],
    "packages/contracts/test/meta/experience-query.contract.ts",
    MetaExperienceQueryContractV1Schema,
  ),
  ownerEntry(
    "MetaResultAuditQueryContractV1",
    "urn:pai:meta:result-audit-query:v1",
    "1.0.0",
    "meta-cognition",
    "packages/contracts/src/meta/result-audit-query.v1.ts",
    [
      "generated/schema/meta/result-audit-query.v1.json",
      "generated/openapi/meta-internal.yaml",
      "generated/types/meta.d.ts",
    ],
    "packages/contracts/test/meta/result-audit-query.contract.ts",
    MetaResultAuditQueryContractV1Schema,
  ),
  ownerEntry(
    "MetaFeedbackRequestListContractV1",
    "urn:pai:meta:feedback-request-list:v1",
    "1.0.0",
    "meta-cognition",
    "packages/contracts/src/meta/feedback-request-list.v1.ts",
    [
      "generated/schema/meta/feedback-request-list.v1.json",
      "generated/openapi/meta-internal.yaml",
      "generated/types/meta.d.ts",
    ],
    "packages/contracts/test/meta/feedback-request-list.contract.ts",
    MetaFeedbackRequestListContractV1Schema,
  ),
  ownerEntry(
    "FeedbackDedupeScopeRefV1",
    "urn:pai:meta:feedback-dedupe-scope-ref:v1",
    "1.0.0",
    "meta-cognition",
    "packages/contracts/src/meta/feedback-dedupe-scope-ref.v1.ts",
    [
      "generated/schema/meta/feedback-dedupe-scope-ref.v1.json",
      "generated/types/meta.d.ts",
      "generated/fixtures/meta/feedback-dedupe-scope-ref.v1.json",
    ],
    "packages/contracts/test/meta/feedback-dedupe-scope-ref.contract.ts",
    FeedbackDedupeScopeRefV1Schema,
  ),
  ownerEntry(
    "MetaFeedbackRequestSuggestionContractV1",
    "urn:pai:meta:feedback-request-suggestion:v1",
    "1.0.0",
    "meta-cognition",
    "packages/contracts/src/meta/feedback-request-suggestion.v1.ts",
    [
      "generated/schema/meta/feedback-request-suggestion.v1.json",
      "generated/openapi/meta-internal.yaml",
      "generated/types/meta.d.ts",
    ],
    "packages/contracts/test/meta/feedback-request-suggestion.contract.ts",
    MetaFeedbackRequestSuggestionContractV1Schema,
  ),
  ownerEntry(
    "MetaSnapshotRepairRequestV1",
    "urn:pai:meta:snapshot-repair-request:v1",
    "1.0.0",
    "meta-cognition",
    "packages/contracts/src/meta/snapshot-repair-request.v1.ts",
    [
      "generated/schema/meta/snapshot-repair-request.v1.json",
      "generated/openapi/meta-internal.yaml",
      "generated/types/meta.d.ts",
    ],
    "packages/contracts/test/meta/snapshot-repair-request.contract.ts",
    MetaSnapshotRepairRequestV1Schema,
  ),
  ownerEntry(
    "MetaSnapshotRepairResponseV1",
    "urn:pai:meta:snapshot-repair-response:v1",
    "1.0.0",
    "meta-cognition",
    "packages/contracts/src/meta/snapshot-repair-response.v1.ts",
    [
      "generated/schema/meta/snapshot-repair-response.v1.json",
      "generated/openapi/meta-internal.yaml",
      "generated/types/meta.d.ts",
    ],
    "packages/contracts/test/meta/snapshot-repair-response.contract.ts",
    MetaSnapshotRepairResponseV1Schema,
  ),
  ownerEntry(
    "MetaSkillCandidateReviewContractV1",
    "urn:pai:meta:skill-candidate-review:v1",
    "1.0.0",
    "meta-cognition",
    "packages/contracts/src/meta/skill-candidate-review.v1.ts",
    [
      "generated/schema/meta/skill-candidate-review.v1.json",
      "generated/openapi/meta-internal.yaml",
      "generated/types/meta.d.ts",
    ],
    "packages/contracts/test/meta/skill-candidate-review.contract.ts",
    MetaSkillCandidateReviewContractV1Schema,
  ),
  ownerEntry(
    "MetaCommandClaimContractV1",
    "urn:pai:meta:command-claim:v1",
    "1.0.0",
    "meta-cognition",
    "packages/contracts/src/meta/command-dispatch.v1.ts",
    [
      "generated/schema/meta/command-claim.v1.json",
      "generated/openapi/meta-internal.yaml",
      "generated/types/meta.d.ts",
    ],
    "packages/contracts/test/meta/command-dispatch.contract.ts",
    MetaCommandClaimContractV1Schema,
  ),
  ownerEntry(
    "MetaCommandSettlementContractV1",
    "urn:pai:meta:command-settlement:v1",
    "1.0.0",
    "meta-cognition",
    "packages/contracts/src/meta/command-dispatch.v1.ts",
    [
      "generated/schema/meta/command-settlement.v1.json",
      "generated/openapi/meta-internal.yaml",
      "generated/types/meta.d.ts",
    ],
    "packages/contracts/test/meta/command-dispatch.contract.ts",
    MetaCommandSettlementContractV1Schema,
  ),
  ownerEntry(
    "MemoryWriteBatchV1",
    "urn:pai:memory:write-batch:v1",
    "1.0.0",
    "memory-service",
    "packages/contracts/src/memory/write-batch.v1.ts",
    [
      "generated/schema/memory/write-batch.v1.json",
      "generated/openapi/memory-service.yaml",
      "generated/types/memory.d.ts",
    ],
    "packages/contracts/test/memory/write-batch.contract.ts",
    MemoryWriteBatchV1Schema,
  ),
  ownerEntry(
    "MemoryFastRecallV1",
    "urn:pai:memory:fast-recall:v1",
    "1.0.0",
    "memory-service",
    "packages/contracts/src/memory/fast-recall.v1.ts",
    [
      "generated/schema/memory/fast-recall.v1.json",
      "generated/openapi/memory-service.yaml",
      "generated/types/memory.d.ts",
    ],
    "packages/contracts/test/memory/fast-recall.contract.ts",
    MemoryFastRecallV1Schema,
  ),
  ownerEntry(
    "MemoryDeepRecallV1",
    "urn:pai:memory:deep-recall:v1",
    "1.0.0",
    "memory-service",
    "packages/contracts/src/memory/deep-recall.v1.ts",
    [
      "generated/schema/memory/deep-recall.v1.json",
      "generated/openapi/memory-service.yaml",
      "generated/types/memory.d.ts",
    ],
    "packages/contracts/test/memory/owner-catalog.contract.ts",
    MemoryDeepRecallV1Schema,
  ),
  ownerEntry(
    "MemoryPrePromotionCheckV1",
    "urn:pai:memory:pre-promotion-check:v1",
    "1.0.0",
    "memory-service",
    "packages/contracts/src/memory/pre-promotion-check.v1.ts",
    [
      "generated/schema/memory/pre-promotion-check.v1.json",
      "generated/openapi/memory-service.yaml",
      "generated/types/memory.d.ts",
    ],
    "packages/contracts/test/memory/owner-catalog.contract.ts",
    MemoryPrePromotionCheckV1Schema,
  ),
  ownerEntry(
    "MemoryDirectFeedbackV1",
    "urn:pai:memory:direct-feedback:v1",
    "1.0.0",
    "memory-service",
    "packages/contracts/src/memory/direct-feedback.v1.ts",
    [
      "generated/schema/memory/direct-feedback.v1.json",
      "generated/openapi/memory-service.yaml",
      "generated/types/memory.d.ts",
    ],
    "packages/contracts/test/memory/owner-catalog.contract.ts",
    MemoryDirectFeedbackV1Schema,
  ),
  ownerEntry(
    "MemoryConflictV1",
    "urn:pai:memory:conflict:v1",
    "1.0.0",
    "memory-service",
    "packages/contracts/src/memory/conflict.v1.ts",
    [
      "generated/schema/memory/conflict.v1.json",
      "generated/openapi/memory-service.yaml",
      "generated/types/memory.d.ts",
    ],
    "packages/contracts/test/memory/owner-catalog.contract.ts",
    MemoryConflictV1Schema,
  ),
  ownerEntry(
    "MemoryIntegrationJobV1",
    "urn:pai:memory:integration-job:v1",
    "1.0.0",
    "memory-service",
    "packages/contracts/src/memory/integration-job.v1.ts",
    [
      "generated/schema/memory/integration-job.v1.json",
      "generated/openapi/memory-service.yaml",
      "generated/types/memory.d.ts",
    ],
    "packages/contracts/test/memory/owner-catalog.contract.ts",
    MemoryIntegrationJobV1Schema,
  ),
  ownerEntry(
    "MemoryEventEnvelopeV1",
    "urn:pai:memory:event-envelope:v1",
    "1.0.0",
    "memory-service",
    "packages/contracts/src/memory/memory-event.v1.ts",
    [
      "generated/schema/memory/memory-event.v1.json",
      "generated/openapi/memory-service.yaml",
      "generated/types/memory.d.ts",
    ],
    "packages/contracts/test/memory/owner-catalog.contract.ts",
    MemoryEventEnvelopeV1Schema,
  ),
  ownerEntry(
    "MemoryQuerySeriesContractV1",
    "urn:pai:memory:query-series:v1",
    "1.0.0",
    "memory-service",
    "packages/contracts/src/memory/query-series.v1.ts",
    [
      "generated/schema/memory/query-series.v1.json",
      "generated/openapi/memory-service.yaml",
      "generated/types/memory.d.ts",
    ],
    "packages/contracts/test/memory/owner-catalog.contract.ts",
    MemoryQuerySeriesV1Schema,
  ),
  ownerEntry(
    "MemoryGraphBuildContractV1",
    "urn:pai:memory:graph-build:v1",
    "1.0.0",
    "memory-service",
    "packages/contracts/src/memory/graph-build.v1.ts",
    [
      "generated/schema/memory/graph-build.v1.json",
      "generated/openapi/memory-service.yaml",
      "generated/types/memory.d.ts",
    ],
    "packages/contracts/test/memory/owner-catalog.contract.ts",
    MemoryGraphBuildV1Schema,
  ),
  ownerEntry(
    "KnowThatWriteBatchV1",
    "urn:pai:knowthat:write-batch:v1",
    "1.0.0",
    "knowthat",
    "packages/contracts/src/knowthat/write-batch.v1.ts",
    [
      "generated/schema/knowthat/write-batch.v1.json",
      "generated/openapi/knowthat.yaml",
      "generated/types/knowthat.d.ts",
    ],
    "packages/contracts/test/knowthat/knowthat-owner-contracts.contract.ts",
    KnowThatWriteBatchV1Schema,
  ),
  ownerEntry(
    "KnowThatQueryRequestV1",
    "urn:pai:knowthat:query-request:v1",
    "1.0.0",
    "knowthat",
    "packages/contracts/src/knowthat/query-request.v1.ts",
    [
      "generated/schema/knowthat/query-request.v1.json",
      "generated/openapi/knowthat.yaml",
      "generated/types/knowthat.d.ts",
    ],
    "packages/contracts/test/knowthat/knowthat-owner-contracts.contract.ts",
    KnowThatQueryRequestV1Schema,
  ),
  ownerEntry(
    "KnowThatQueryResponseV1",
    "urn:pai:knowthat:query-response:v1",
    "1.0.0",
    "knowthat",
    "packages/contracts/src/knowthat/query-response.v1.ts",
    [
      "generated/schema/knowthat/query-response.v1.json",
      "generated/openapi/knowthat.yaml",
      "generated/types/knowthat.d.ts",
    ],
    "packages/contracts/test/knowthat/knowthat-owner-contracts.contract.ts",
    KnowThatQueryResponseV1Schema,
  ),
  ownerEntry(
    "KnowThatFeedbackRequestV1",
    "urn:pai:knowthat:feedback-request:v1",
    "1.0.0",
    "knowthat",
    "packages/contracts/src/knowthat/feedback-request.v1.ts",
    [
      "generated/schema/knowthat/feedback-request.v1.json",
      "generated/openapi/knowthat.yaml",
      "generated/types/knowthat.d.ts",
    ],
    "packages/contracts/test/knowthat/feedback-request.contract.ts",
    KnowThatFeedbackRequestV1Schema,
  ),
  ownerEntry(
    "KnowThatPromotionSuggestion",
    "urn:pai:knowthat:promotion-suggestion:v1",
    "1.0.0",
    "knowthat",
    "packages/contracts/src/knowthat/promotion-suggestion.v1.ts",
    [
      "generated/schema/knowthat/promotion-suggestion.v1.json",
      "generated/openapi/knowthat.yaml",
      "generated/types/knowthat.d.ts",
    ],
    "packages/contracts/test/knowthat/knowthat-owner-contracts.contract.ts",
    KnowThatPromotionSuggestionV1Schema,
  ),
  ownerEntry(
    "KnowThatCandidateReviewV1",
    "urn:pai:knowthat:candidate-review:v1",
    "1.0.0",
    "knowthat",
    "packages/contracts/src/knowthat/candidate-review.v1.ts",
    [
      "generated/schema/knowthat/candidate-review.v1.json",
      "generated/openapi/knowthat.yaml",
      "generated/types/knowthat.d.ts",
    ],
    "packages/contracts/test/knowthat/candidate-review.contract.ts",
    KnowThatCandidateReviewV1Schema,
  ),
  ownerEntry(
    "CandidateReviewResult",
    "urn:pai:knowthat:candidate-review-result:v1",
    "1.0.0",
    "knowthat",
    "packages/contracts/src/knowthat/candidate-review-result.v1.ts",
    [
      "generated/schema/knowthat/candidate-review-result.v1.json",
      "generated/openapi/knowthat.yaml",
      "generated/types/knowthat.d.ts",
    ],
    "packages/contracts/test/knowthat/knowthat-owner-contracts.contract.ts",
    KnowThatCandidateReviewResultV1Schema,
  ),
  ownerEntry(
    "KnowThatLinkageRecoveryV1",
    "urn:pai:knowthat:linkage-recovery:v1",
    "1.0.0",
    "knowthat",
    "packages/contracts/src/knowthat/linkage-recovery.v1.ts",
    [
      "generated/schema/knowthat/linkage-recovery.v1.json",
      "generated/openapi/knowthat.yaml",
      "generated/types/knowthat.d.ts",
    ],
    "packages/contracts/test/knowthat/knowthat-owner-contracts.contract.ts",
    KnowThatLinkageRecoveryV1Schema,
  ),
  ownerEntry(
    "KnowThatEventEnvelopeV1",
    "urn:pai:knowthat:event-envelope:v1",
    "1.0.0",
    "knowthat",
    "packages/contracts/src/knowthat/knowthat-event.v1.ts",
    [
      "generated/schema/knowthat/knowthat-event.v1.json",
      "generated/openapi/knowthat.yaml",
      "generated/types/knowthat.d.ts",
    ],
    "packages/contracts/test/knowthat/knowthat-owner-contracts.contract.ts",
    KnowThatEventEnvelopeV1Schema,
  ),
  ownerEntry(
    "TimerScheduleCommandV1",
    "urn:pai:timer:schedule-command:v1",
    "1.0.0",
    "timer-trigger-app",
    "packages/contracts/src/timer/schedule-command.v1.ts",
    [
      "generated/schema/timer/schedule-command.v1.json",
      "generated/openapi/timer-trigger-app.yaml",
      "generated/types/timer.d.ts",
    ],
    "packages/contracts/test/timer/schedule-command.contract.ts",
    TimerScheduleCommandV1Schema,
  ),
  ownerEntry(
    "TimerScheduleQueryResponseV1",
    "urn:pai:timer:schedule-query-response:v1",
    "1.0.0",
    "timer-trigger-app",
    "packages/contracts/src/timer/schedule-query-response.v1.ts",
    [
      "generated/schema/timer/schedule-query-response.v1.json",
      "generated/openapi/timer-trigger-app.yaml",
      "generated/types/timer.d.ts",
    ],
    "packages/contracts/test/timer/schedule-query-response.contract.ts",
    TimerScheduleQueryResponseV1Schema,
  ),
  ownerEntry(
    "TimerOccurrenceV1",
    "urn:pai:timer:occurrence:v1",
    "1.0.0",
    "timer-trigger-app",
    "packages/contracts/src/timer/occurrence.v1.ts",
    [
      "generated/schema/timer/occurrence.v1.json",
      "generated/openapi/timer-trigger-app.yaml",
      "generated/types/timer.d.ts",
    ],
    "packages/contracts/test/timer/occurrence.contract.ts",
    TimerOccurrenceV1Schema,
  ),
  ownerEntry(
    "TimerDispatchRequestV1",
    "urn:pai:timer:dispatch-request:v1",
    "1.0.0",
    "timer-trigger-app",
    "packages/contracts/src/timer/dispatch-request.v1.ts",
    [
      "generated/schema/timer/dispatch-request.v1.json",
      "generated/openapi/timer-trigger-app.yaml",
      "generated/types/timer.d.ts",
    ],
    "packages/contracts/test/timer/dispatch-request.contract.ts",
    TimerDispatchRequestV1Schema,
  ),
  ownerEntry(
    "TimerCatchUpBatchV1",
    "urn:pai:timer:catch-up-batch:v1",
    "1.0.0",
    "timer-trigger-app",
    "packages/contracts/src/timer/catch-up-batch.v1.ts",
    [
      "generated/schema/timer/catch-up-batch.v1.json",
      "generated/openapi/timer-trigger-app.yaml",
      "generated/types/timer.d.ts",
    ],
    "packages/contracts/test/timer/catch-up-batch.contract.ts",
    TimerCatchUpBatchV1Schema,
  ),
  ownerEntry(
    "TimerEventEnvelopeV1",
    "urn:pai:timer:event-envelope:v1",
    "1.0.0",
    "timer-trigger-app",
    "packages/contracts/src/timer/timer-event.v1.ts",
    [
      "generated/schema/timer/timer-event.v1.json",
      "generated/openapi/timer-trigger-app.yaml",
      "generated/types/timer.d.ts",
    ],
    "packages/contracts/test/timer/timer-event.contract.ts",
    TimerEventEnvelopeV1Schema,
  ),
  ownerEntry(
    "SkillResolveContractV1",
    "urn:pai:skill-registry:resolve:v1",
    "1.0.0",
    "skill-registry",
    "packages/contracts/src/skill-registry/resolve.v1.ts",
    [
      "generated/schema/skill-registry/resolve.v1.json",
      "generated/openapi/skill-registry-internal.yaml",
      "generated/types/skill-registry.d.ts",
    ],
    "packages/contracts/test/registry/resolve.contract.ts",
    SkillResolveContractV1Schema,
  ),
  ownerEntry(
    "SkillContentContractV1",
    "urn:pai:skill-registry:content:v1",
    "1.0.0",
    "skill-registry",
    "packages/contracts/src/skill-registry/content.v1.ts",
    [
      "generated/schema/skill-registry/content.v1.json",
      "generated/openapi/skill-registry-internal.yaml",
      "generated/types/skill-registry.d.ts",
    ],
    "packages/contracts/test/registry/content.contract.ts",
    SkillContentContractV1Schema,
  ),
  ownerEntry(
    "SkillValidateContractV1",
    "urn:pai:skill-registry:validate:v1",
    "1.0.0",
    "skill-registry",
    "packages/contracts/src/skill-registry/validate.v1.ts",
    [
      "generated/schema/skill-registry/validate.v1.json",
      "generated/openapi/skill-registry-internal.yaml",
      "generated/types/skill-registry.d.ts",
    ],
    "packages/contracts/test/registry/validate.contract.ts",
    SkillValidateContractV1Schema,
  ),
  ownerEntry(
    "SkillPublishContractV1",
    "urn:pai:skill-registry:publish:v1",
    "1.0.0",
    "skill-registry",
    "packages/contracts/src/skill-registry/publish.v1.ts",
    [
      "generated/schema/skill-registry/publish.v1.json",
      "generated/openapi/skill-registry-internal.yaml",
      "generated/types/skill-registry.d.ts",
    ],
    "packages/contracts/test/registry/publish.contract.ts",
    SkillPublishContractV1Schema,
  ),
  ownerEntry(
    "SkillCatalogQueryContractV1",
    "urn:pai:skill-registry:catalog-query:v1",
    "1.0.0",
    "skill-registry",
    "packages/contracts/src/skill-registry/catalog-query.v1.ts",
    [
      "generated/schema/skill-registry/catalog-query.v1.json",
      "generated/openapi/skill-registry-internal.yaml",
      "generated/types/skill-registry.d.ts",
    ],
    "packages/contracts/test/registry/catalog-query.contract.ts",
    SkillCatalogQueryContractV1Schema,
  ),
  ownerEntry(
    "SkillContextCatalogContractV1",
    "urn:pai:skill-registry:context-catalog:v1",
    "1.0.0",
    "skill-registry",
    "packages/contracts/src/skill-registry/context-catalog.v1.ts",
    [
      "generated/schema/skill-registry/context-catalog.v1.json",
      "generated/openapi/skill-registry-internal.yaml",
      "generated/types/skill-registry.d.ts",
    ],
    "packages/contracts/test/consumer/tp-skill-context-catalog.contract.ts",
    SkillContextCatalogContractV1Schema,
  ),
  ownerEntry(
    "SkillCandidateApplicationContractV1",
    "urn:pai:skill-registry:candidate-application:v1",
    "1.0.0",
    "skill-registry",
    "packages/contracts/src/skill-registry/candidate-application.v1.ts",
    [
      "generated/schema/skill-registry/candidate-application.v1.json",
      "generated/openapi/skill-registry-internal.yaml",
      "generated/types/skill-registry.d.ts",
    ],
    "packages/contracts/test/registry/candidate-application.contract.ts",
    SkillCandidateApplicationContractV1Schema,
  ),
  ownerEntry(
    "SkillManagementCommandV1",
    "urn:pai:skill-registry:management-command:v1",
    "1.1.0",
    "skill-registry",
    "packages/contracts/src/skill-registry/management-commands.v1.ts",
    [
      "generated/schema/skill-registry/management-commands.v1.json",
      "generated/openapi/skill-registry-management.yaml",
      "generated/types/skill-registry-management.d.ts",
    ],
    "packages/contracts/test/registry/management-commands.contract.ts",
    SkillManagementCommandV1Schema,
  ),
  ownerEntry(
    "SkillRegistryDomainEventV1",
    "urn:pai:skill-registry:domain-event:v1",
    "1.1.0",
    "skill-registry",
    "packages/contracts/src/skill-registry/events.v1.ts",
    [
      "generated/schema/skill-registry/events.v1.json",
      "generated/asyncapi/skill-registry.yaml",
      "generated/types/skill-registry-events.d.ts",
    ],
    "packages/contracts/test/events/skill-registry-events.contract.ts",
    SkillRegistryDomainEventV1Schema,
  ),
  ownerEntry(
    "SkillPermissionSummaryV1",
    "urn:pai:skill-registry:permission-summary:v1",
    "1.0.0",
    "skill_registry",
    "packages/contracts/src/skill-registry/skill-permission-summary.v1.ts",
    [
      "generated/schema/skill-registry/skill-permission-summary.v1.json",
      "generated/openapi/skill-registry-internal.yaml",
      "generated/types/skill-registry.d.ts",
      "generated/db/skill-registry-permission-summary.sql",
      "generated/fixtures/skill-registry/skill-permission-summary.v1.canonical.json",
    ],
    "packages/contracts/test/registry/skill-permission-summary.contract.ts",
    SkillPermissionSummaryV1Schema,
  ),
] as const satisfies readonly RegisteredOwnerSchemaCatalogEntry[];

export interface TriggerProcessorHttpOperationV1 {
  readonly operation_id: string;
  readonly method: "post";
  readonly path: "/v1/triggers";
  readonly source_bindings: readonly [
    Readonly<{
      source: "chat";
      authentication: "supabase_ingress";
      allowed_principal_types: readonly ["user", "developer", "bot"];
      actor_derivation: "verified_supabase_principal";
      required_permission_scope: "trigger.submit.chat";
      principal_mapping: Readonly<{
        user: "user_or_signed_super_user";
        developer: "developer";
        bot: "agent";
        operator: "rejected";
      }>;
    }>,
    Readonly<{
      source: "notification";
      authentication: "supabase_ingress";
      allowed_principal_types: readonly ["user", "developer", "bot"];
      actor_derivation: "verified_supabase_principal";
      required_permission_scope: "trigger.submit.notification";
      principal_mapping: Readonly<{
        user: "user_or_signed_super_user";
        developer: "developer";
        bot: "agent";
        operator: "rejected";
      }>;
    }>,
    Readonly<{
      source: "timer";
      authentication: "pai_workload_jwt";
      required_capability: "trigger.submit.timer";
      required_permission_scope: "trigger.submit.timer";
      allowed_caller: "timer_trigger_app";
    }>,
  ];
  readonly request_schema_name: "TriggerSubmitRequestV1";
  readonly response_schema_name: "TriggerSubmitResponseV1";
  readonly responses: readonly [200, 202, 400, 401, 403, 404, 409, 429, 500, 503];
  readonly response_schemas_by_status: Readonly<{
    readonly 200: TSchema;
    readonly 202: TSchema;
    readonly 400: TSchema;
    readonly 401: TSchema;
    readonly 403: TSchema;
    readonly 404: TSchema;
    readonly 409: TSchema;
    readonly 429: TSchema;
    readonly 500: TSchema;
    readonly 503: TSchema;
  }>;
}

const admitTriggerResponseSchemasByStatus = Object.freeze({
  200: AdmitTriggerOkResponseV1Schema,
  202: AdmitTriggerAcceptedResponseV1Schema,
  400: AdmitTriggerInvalidRequestResponseV1Schema,
  401: AdmitTriggerUnauthenticatedResponseV1Schema,
  403: AdmitTriggerAuthorizationFailureResponseV1Schema,
  404: AdmitTriggerNotFoundResponseV1Schema,
  409: AdmitTriggerConflictResponseV1Schema,
  429: AdmitTriggerRateLimitedResponseV1Schema,
  500: AdmitTriggerInternalErrorResponseV1Schema,
  503: AdmitTriggerRetryableFailureResponseV1Schema,
});

export const TRIGGER_PROCESSOR_HTTP_OPERATIONS_V1 = [
  {
    operation_id: "submitTriggerV1",
    method: "post",
    path: "/v1/triggers",
    source_bindings: [
      {
        source: "chat",
        authentication: "supabase_ingress",
        allowed_principal_types: ["user", "developer", "bot"],
        actor_derivation: "verified_supabase_principal",
        required_permission_scope: "trigger.submit.chat",
        principal_mapping: {
          user: "user_or_signed_super_user",
          developer: "developer",
          bot: "agent",
          operator: "rejected",
        },
      },
      {
        source: "notification",
        authentication: "supabase_ingress",
        allowed_principal_types: ["user", "developer", "bot"],
        actor_derivation: "verified_supabase_principal",
        required_permission_scope: "trigger.submit.notification",
        principal_mapping: {
          user: "user_or_signed_super_user",
          developer: "developer",
          bot: "agent",
          operator: "rejected",
        },
      },
      {
        source: "timer",
        authentication: "pai_workload_jwt",
        required_capability: "trigger.submit.timer",
        required_permission_scope: "trigger.submit.timer",
        allowed_caller: "timer_trigger_app",
      },
    ],
    request_schema_name: "TriggerSubmitRequestV1",
    response_schema_name: "TriggerSubmitResponseV1",
    responses: [200, 202, 400, 401, 403, 404, 409, 429, 500, 503],
    response_schemas_by_status: admitTriggerResponseSchemasByStatus,
  },
] as const satisfies readonly TriggerProcessorHttpOperationV1[];
