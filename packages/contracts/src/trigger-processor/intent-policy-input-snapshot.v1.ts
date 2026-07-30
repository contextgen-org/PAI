import { Type, type Static } from "@sinclair/typebox";

import {
  TriggerProcessorBotScopeV1Properties,
  TriggerProcessorIdentifierV1Schema,
  TriggerProcessorNonNegativeVersionV1Schema,
  TriggerProcessorPositiveVersionV1Schema,
  TriggerProcessorSha256V1Schema,
  TriggerProcessorUtcTimestampV1Schema,
} from "./contract-primitives.v1.js";

export const IntentPolicyInputSnapshotV1Schema = Type.Object(
  {
    schema_version: Type.Literal("intent_policy_input_snapshot.v1"),
    snapshot_ref: TriggerProcessorIdentifierV1Schema,
    ...TriggerProcessorBotScopeV1Properties,
    bot_policy_revision_id: TriggerProcessorIdentifierV1Schema,
    personality_ref: TriggerProcessorIdentifierV1Schema,
    personality_version: TriggerProcessorPositiveVersionV1Schema,
    personality_hash: TriggerProcessorSha256V1Schema,
    safety_boundaries_ref: TriggerProcessorIdentifierV1Schema,
    safety_boundaries_version: TriggerProcessorPositiveVersionV1Schema,
    safety_boundaries_hash: TriggerProcessorSha256V1Schema,
    tool_permission_profile_ref: TriggerProcessorIdentifierV1Schema,
    tool_permission_profile_revision: TriggerProcessorPositiveVersionV1Schema,
    tool_permission_profile_hash: TriggerProcessorSha256V1Schema,
    tool_policy_epoch: TriggerProcessorNonNegativeVersionV1Schema,
    catalog_version: TriggerProcessorIdentifierV1Schema,
    catalog_as_of: TriggerProcessorUtcTimestampV1Schema,
    security_revocation_epoch: TriggerProcessorNonNegativeVersionV1Schema,
    skill_permission_summary_ref: TriggerProcessorIdentifierV1Schema,
    skill_permission_summary_hash: TriggerProcessorSha256V1Schema,
    snapshot_hash: TriggerProcessorSha256V1Schema,
  },
  {
    $id: "urn:pai:trigger-processor:intent-policy-input-snapshot:v1",
    additionalProperties: false,
  },
);

export type IntentPolicyInputSnapshotV1 = Static<
  typeof IntentPolicyInputSnapshotV1Schema
>;
