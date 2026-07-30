import { Type, type Static } from "@sinclair/typebox";

import {
  IntentPolicyInputSnapshotV1Schema,
  TriggerProcessorBotScopeV1Properties,
  TriggerProcessorIdentifierV1Schema,
  TriggerProcessorPositiveVersionV1Schema,
  TriggerProcessorSha256V1Schema,
  TriggerProcessorUtcTimestampV1Schema,
} from "../trigger-processor/index-internal.v1.js";
import {
  RuntimePolicyInputV1Schema,
  assertRuntimePolicyInputLifetimeV1,
} from "./runtime-policy-input.v1.js";

export const RuntimePolicyInputReadContractV1Schema = Type.Object(
  {
    schema_version: Type.Literal("runtime_policy_input_read_artifact.v1"),
    policy_input_ref: TriggerProcessorIdentifierV1Schema,
    policy_input_hash: TriggerProcessorSha256V1Schema,
    trigger_process_id: TriggerProcessorIdentifierV1Schema,
    runtime_run_id: TriggerProcessorIdentifierV1Schema,
    start_attempt_no: TriggerProcessorPositiveVersionV1Schema,
    ...TriggerProcessorBotScopeV1Properties,
    expected_catalog_version: TriggerProcessorIdentifierV1Schema,
    catalog_as_of: TriggerProcessorUtcTimestampV1Schema,
    intent_policy_snapshot_ref: TriggerProcessorIdentifierV1Schema,
    intent_policy_snapshot_hash: TriggerProcessorSha256V1Schema,
    intent_policy_snapshot: IntentPolicyInputSnapshotV1Schema,
    skill_permission_summary_ref: TriggerProcessorIdentifierV1Schema,
    skill_permission_summary_hash: TriggerProcessorSha256V1Schema,
    policy: RuntimePolicyInputV1Schema,
  },
  {
    $id: "urn:pai:action-runtime:runtime-policy-input-read:v1",
    additionalProperties: false,
  },
);

export type RuntimePolicyInputReadContractV1 = Static<
  typeof RuntimePolicyInputReadContractV1Schema
>;

/**
 * Compatibility aliases for the response artifact carried by the registered
 * owner contract. The Schema Catalog identity remains
 * RuntimePolicyInputReadContractV1.
 */
export const RuntimePolicyInputReadArtifactV1Schema =
  RuntimePolicyInputReadContractV1Schema;
export type RuntimePolicyInputReadArtifactV1 = RuntimePolicyInputReadContractV1;

export function assertRuntimePolicyInputReadArtifactBindingsV1(
  artifact: RuntimePolicyInputReadArtifactV1,
  nowMs = Date.now(),
): void {
  const snapshot = artifact.intent_policy_snapshot;
  if (
    artifact.intent_policy_snapshot_ref !== snapshot.snapshot_ref ||
    artifact.intent_policy_snapshot_hash !== snapshot.snapshot_hash ||
    artifact.policy.intent_policy_snapshot_ref !== snapshot.snapshot_ref ||
    artifact.policy.intent_policy_snapshot_hash !== snapshot.snapshot_hash ||
    artifact.workspace_id !== snapshot.workspace_id ||
    artifact.bot_id !== snapshot.bot_id ||
    artifact.owner_agent_id !== snapshot.owner_agent_id ||
    artifact.deployment_environment !== snapshot.deployment_environment ||
    artifact.release_channel !== snapshot.release_channel ||
    artifact.expected_catalog_version !== snapshot.catalog_version ||
    artifact.catalog_as_of !== snapshot.catalog_as_of ||
    artifact.skill_permission_summary_ref !==
      snapshot.skill_permission_summary_ref ||
    artifact.skill_permission_summary_hash !==
      snapshot.skill_permission_summary_hash
  ) {
    throw new Error("RuntimePolicyInputReadArtifactV1 binding mismatch");
  }
  assertRuntimePolicyInputLifetimeV1(artifact.policy, nowMs);
}
