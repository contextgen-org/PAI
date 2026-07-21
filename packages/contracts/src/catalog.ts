import type { TSchema } from "@sinclair/typebox";

import { ConflictPolicyV1Schema } from "./policy/conflict-policy.v1.js";
import { DirectActivePolicyV1Schema } from "./policy/direct-active-policy.v1.js";
import { DelegatedPrincipalContextV1Schema } from "./shared/delegated-principal-context.v1.js";
import { DeploymentEnvironmentV1Schema } from "./shared/deployment-environment.v1.js";
import { ReleaseChannelV1Schema } from "./shared/release-channel.v1.js";
import { ResponseEnvelopeV1Schema } from "./shared/response-envelope.v1.js";
import { ServiceIdV1Schema } from "./shared/service-id.v1.js";
import { TypedEvidenceRefV1Schema } from "./shared/typed-evidence-ref.v1.js";
import { WorkloadCredentialClaimsV1Schema } from "./shared/workload-credential-claims.v1.js";
import {
  AdmitTriggerCommandV1Schema,
  AdmitTriggerRequestBodyV1Schema,
  AdmitTriggerResponseV1Schema,
  TriggerAdmissionDecisionV1Schema,
  TrustedAdmissionFactsV1Schema,
} from "./trigger-processor/trigger-admission.v1.js";
import {
  TriggerProcessStateV1Schema,
  TriggerProcessTransitionEvidenceV1Schema,
} from "./trigger-processor/trigger-process-state.v1.js";

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

export interface TriggerProcessorSchemaCatalogEntry
  extends Omit<SharedSchemaCatalogEntry, "owner_service"> {
  readonly owner_service: "trigger_processor";
}

function triggerProcessorEntry(
  schema_name: string,
  schema_id: string,
  source_file: string,
  generated_file: string,
  contract_test: string,
  schema: TSchema,
): TriggerProcessorSchemaCatalogEntry {
  return {
    schema_name,
    schema_id,
    version: "1.0.0",
    owner_service: "trigger_processor",
    source_file,
    generated_outputs: [generated_file, "generated/openapi/shared.yaml"],
    contract_tests: [contract_test],
    schema,
  };
}

export const TRIGGER_PROCESSOR_SCHEMA_CATALOG = [
  triggerProcessorEntry(
    "TriggerProcessStateV1",
    "urn:pai:trigger-processor:trigger-process-state:v1",
    "packages/contracts/src/trigger-processor/trigger-process-state.v1.ts",
    "generated/schema/trigger-processor/trigger-process-state.v1.json",
    "packages/contracts/test/trigger-processor/trigger-process-state.contract.ts",
    TriggerProcessStateV1Schema,
  ),
  triggerProcessorEntry(
    "AdmitTriggerRequestBodyV1",
    "urn:pai:trigger-processor:admit-trigger-request-body:v1",
    "packages/contracts/src/trigger-processor/trigger-admission.v1.ts",
    "generated/schema/trigger-processor/admit-trigger-request-body.v1.json",
    "packages/contracts/test/trigger-processor/trigger-admission.contract.ts",
    AdmitTriggerRequestBodyV1Schema,
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
    "AdmitTriggerResponseV1",
    "urn:pai:trigger-processor:admit-trigger-response:v1",
    "packages/contracts/src/trigger-processor/trigger-admission.v1.ts",
    "generated/schema/trigger-processor/admit-trigger-response.v1.json",
    "packages/contracts/test/trigger-processor/trigger-admission.contract.ts",
    AdmitTriggerResponseV1Schema,
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
] as const satisfies readonly TriggerProcessorSchemaCatalogEntry[];
