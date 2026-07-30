import { Type, type Static } from "@sinclair/typebox";

import {
  TriggerProcessorBotScopeV1Properties,
  TriggerProcessorIdentifierV1Schema,
  TriggerProcessorPositiveVersionV1Schema,
  TriggerProcessorSha256V1Schema,
} from "./contract-primitives.v1.js";
import { IntentPolicyInputSnapshotV1Schema } from "./intent-policy-input-snapshot.v1.js";
import { StructuredIntentV1Schema } from "./structured-intent.v1.js";

export const IntentSynthesizeRequestV1Schema = Type.Object(
  {
    schema_version: Type.Literal("intent_synthesize_request.v1"),
    trigger_process_id: TriggerProcessorIdentifierV1Schema,
    ...TriggerProcessorBotScopeV1Properties,
    trigger_ref: TriggerProcessorIdentifierV1Schema,
    intent_version: TriggerProcessorPositiveVersionV1Schema,
    context_snapshot_ref: TriggerProcessorIdentifierV1Schema,
    context_snapshot_version: TriggerProcessorPositiveVersionV1Schema,
    context_snapshot_hash: TriggerProcessorSha256V1Schema,
    intent_policy_snapshot: IntentPolicyInputSnapshotV1Schema,
    idempotency_key: TriggerProcessorIdentifierV1Schema,
    trace_id: TriggerProcessorIdentifierV1Schema,
  },
  { additionalProperties: false },
);

export const IntentSynthesizeResponseV1Schema = Type.Object(
  {
    code: Type.Literal("intent_synthesized"),
    message: Type.String({ minLength: 1, maxLength: 4096 }),
    retryable: Type.Literal(false),
    trace_id: TriggerProcessorIdentifierV1Schema,
    details: Type.Object(
      {
        intent_ref: TriggerProcessorIdentifierV1Schema,
        intent_version: TriggerProcessorPositiveVersionV1Schema,
        intent_schema_version: Type.Literal("structured_intent.v1"),
        structured_intent_hash: TriggerProcessorSha256V1Schema,
        structured_intent: StructuredIntentV1Schema,
        policy_decision: Type.Union([
          Type.Literal("allow"),
          Type.Literal("require_confirmation"),
          Type.Literal("deny"),
        ]),
        intent_policy_snapshot: IntentPolicyInputSnapshotV1Schema,
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

export const IntentSynthesizeContractV1Schema = Type.Union(
  [IntentSynthesizeRequestV1Schema, IntentSynthesizeResponseV1Schema],
  { $id: "urn:pai:trigger-processor:intent-synthesize:v1" },
);

export type IntentSynthesizeRequestV1 = Static<
  typeof IntentSynthesizeRequestV1Schema
>;
export type IntentSynthesizeResponseV1 = Static<
  typeof IntentSynthesizeResponseV1Schema
>;

export function assertIntentSynthesizeRequestBindingsV1(
  request: IntentSynthesizeRequestV1,
): void {
  const policy = request.intent_policy_snapshot;
  if (
    request.idempotency_key !==
      `${request.trigger_process_id}:intent:${request.intent_version}` ||
    request.workspace_id !== policy.workspace_id ||
    request.bot_id !== policy.bot_id ||
    request.owner_agent_id !== policy.owner_agent_id ||
    request.deployment_environment !== policy.deployment_environment ||
    request.release_channel !== policy.release_channel
  ) {
    throw new Error("IntentSynthesizeContractV1 identity binding mismatch");
  }
}
