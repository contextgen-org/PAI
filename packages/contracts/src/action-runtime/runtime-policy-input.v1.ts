import { Type, type Static } from "@sinclair/typebox";

import {
  TriggerProcessorIdentifierV1Schema,
  TriggerProcessorSha256V1Schema,
  TriggerProcessorUtcTimestampV1Schema,
} from "../trigger-processor/index-internal.v1.js";

export const RuntimePolicyInputV1Schema = Type.Object(
  {
    schema_version: Type.Literal("runtime_policy_input.v1"),
    intent_policy_snapshot_ref: TriggerProcessorIdentifierV1Schema,
    intent_policy_snapshot_hash: TriggerProcessorSha256V1Schema,
    created_at: TriggerProcessorUtcTimestampV1Schema,
    expires_at: TriggerProcessorUtcTimestampV1Schema,
  },
  {
    $id: "urn:pai:action-runtime:runtime-policy-input:v1",
    additionalProperties: false,
  },
);

export type RuntimePolicyInputV1 = Static<typeof RuntimePolicyInputV1Schema>;

export function assertRuntimePolicyInputLifetimeV1(
  policy: RuntimePolicyInputV1,
  nowMs = Date.now(),
): void {
  const createdAt = Date.parse(policy.created_at);
  const expiresAt = Date.parse(policy.expires_at);
  if (
    !Number.isFinite(nowMs) ||
    !Number.isFinite(createdAt) ||
    !Number.isFinite(expiresAt) ||
    createdAt > nowMs ||
    expiresAt <= nowMs ||
    expiresAt <= createdAt ||
    expiresAt - createdAt > 86_400_000
  ) {
    throw new Error("RuntimePolicyInputV1 lifetime is invalid");
  }
}
