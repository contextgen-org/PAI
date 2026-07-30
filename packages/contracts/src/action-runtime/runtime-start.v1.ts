import { Type, type Static } from "@sinclair/typebox";

import {
  IntentPolicyInputSnapshotV1Schema,
  StructuredIntentV1Schema,
  assertStructuredIntentSemanticBindingsV1,
  structuredIntentRequiresConfirmationV1,
  TriggerProcessorBotScopeV1Properties,
  TriggerProcessorControlTokenV1Schema,
  TriggerProcessorIdentifierV1Schema,
  TriggerProcessorPositiveVersionV1Schema,
  TriggerProcessorSha256V1Schema,
  TriggerProcessorUtcTimestampV1Schema,
} from "../trigger-processor/index-internal.v1.js";
import {
  RuntimePolicyInputV1Schema,
  assertRuntimePolicyInputLifetimeV1,
  type RuntimePolicyInputV1,
} from "./runtime-policy-input.v1.js";

export {
  RuntimePolicyInputV1Schema,
  assertRuntimePolicyInputLifetimeV1,
  type RuntimePolicyInputV1,
} from "./runtime-policy-input.v1.js";

const runtimeStartBase = {
  schema_version: Type.Literal("runtime_start.v1.2"),
  trigger_process_id: TriggerProcessorIdentifierV1Schema,
  runtime_run_id: TriggerProcessorIdentifierV1Schema,
  ...TriggerProcessorBotScopeV1Properties,
  start_attempt_no: TriggerProcessorPositiveVersionV1Schema,
  start_fence_token: TriggerProcessorIdentifierV1Schema,
  intent_ref: TriggerProcessorIdentifierV1Schema,
  intent_version: TriggerProcessorPositiveVersionV1Schema,
  structured_intent_hash: TriggerProcessorSha256V1Schema,
  structured_intent: StructuredIntentV1Schema,
  context_snapshot_ref: TriggerProcessorIdentifierV1Schema,
  context_snapshot_version: TriggerProcessorPositiveVersionV1Schema,
  context_snapshot_hash: TriggerProcessorSha256V1Schema,
  intent_policy_snapshot_ref: TriggerProcessorIdentifierV1Schema,
  intent_policy_snapshot_hash: TriggerProcessorSha256V1Schema,
  intent_policy_snapshot: IntentPolicyInputSnapshotV1Schema,
  expected_catalog_version: TriggerProcessorIdentifierV1Schema,
  catalog_as_of: TriggerProcessorUtcTimestampV1Schema,
  allowed_tools: Type.Array(TriggerProcessorIdentifierV1Schema, {
    maxItems: 10_000,
    uniqueItems: true,
  }),
  allowed_skills: Type.Array(TriggerProcessorIdentifierV1Schema, {
    maxItems: 10_000,
    uniqueItems: true,
  }),
  planned_skills: Type.Array(TriggerProcessorIdentifierV1Schema, {
    maxItems: 10_000,
    uniqueItems: true,
  }),
  policy_input_ref: TriggerProcessorIdentifierV1Schema,
  policy_input_hash: TriggerProcessorSha256V1Schema,
  policy: RuntimePolicyInputV1Schema,
  preempt_token: TriggerProcessorControlTokenV1Schema,
  idempotency_key: TriggerProcessorIdentifierV1Schema,
  trace_id: TriggerProcessorIdentifierV1Schema,
} as const;

export const RuntimeStartRequestV1Schema = Type.Union(
  [
    Type.Object(
      {
        ...runtimeStartBase,
        confirmation_ref: Type.Null(),
        confirmation_hash: Type.Null(),
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        ...runtimeStartBase,
        confirmation_ref: TriggerProcessorIdentifierV1Schema,
        confirmation_hash: TriggerProcessorSha256V1Schema,
      },
      { additionalProperties: false },
    ),
  ],
  { $id: "urn:pai:action-runtime:runtime-start-request:v1" },
);

export const RuntimeStartResponseV1Schema = Type.Object(
  {
    code: Type.Literal("runtime_queued"),
    message: Type.String({ minLength: 1, maxLength: 4096 }),
    retryable: Type.Literal(false),
    details: Type.Object(
      {
        status: Type.Literal("queued"),
        runtime_run_id: TriggerProcessorIdentifierV1Schema,
        start_attempt_no: TriggerProcessorPositiveVersionV1Schema,
        start_fence_generation: TriggerProcessorPositiveVersionV1Schema,
        policy_snapshot_id: TriggerProcessorIdentifierV1Schema,
        policy_snapshot_hash: TriggerProcessorSha256V1Schema,
        requested_catalog_version: TriggerProcessorIdentifierV1Schema,
        effective_catalog_version: TriggerProcessorIdentifierV1Schema,
        catalog_as_of: TriggerProcessorUtcTimestampV1Schema,
      },
      { additionalProperties: false },
    ),
    trace_id: TriggerProcessorIdentifierV1Schema,
  },
  { additionalProperties: false },
);

export const RuntimeStartContractV1Schema = Type.Union(
  [RuntimeStartRequestV1Schema, RuntimeStartResponseV1Schema],
  { $id: "urn:pai:action-runtime:runtime-start:v1" },
);

export type RuntimeStartRequestV1 = Static<typeof RuntimeStartRequestV1Schema>;
export type RuntimeStartResponseV1 = Static<
  typeof RuntimeStartResponseV1Schema
>;

export function assertRuntimeStartSemanticBindingsV1(
  request: RuntimeStartRequestV1,
  nowMs = Date.now(),
): void {
  assertStructuredIntentSemanticBindingsV1(request.structured_intent);
  const expectedKey = `${request.trigger_process_id}:start:${request.start_attempt_no}`;
  const planned = new Set(request.planned_skills);
  const allowed = new Set(request.allowed_skills);
  const required = new Set(request.structured_intent.required_skills);
  const candidates = new Set(
    request.structured_intent.action_plan.flatMap((step) =>
      step.candidate_skill === undefined ? [] : [step.candidate_skill],
    ),
  );
  const expectedPlanned = new Set([...required, ...candidates]);
  const needsConfirmation = structuredIntentRequiresConfirmationV1(
    request.structured_intent,
  );
  if (
    request.idempotency_key !== expectedKey ||
    request.intent_policy_snapshot_ref !==
      request.intent_policy_snapshot.snapshot_ref ||
    request.intent_policy_snapshot_hash !==
      request.intent_policy_snapshot.snapshot_hash ||
    request.policy.intent_policy_snapshot_ref !==
      request.intent_policy_snapshot_ref ||
    request.policy.intent_policy_snapshot_hash !==
      request.intent_policy_snapshot_hash ||
    request.expected_catalog_version !==
      request.intent_policy_snapshot.catalog_version ||
    request.catalog_as_of !== request.intent_policy_snapshot.catalog_as_of ||
    request.workspace_id !== request.intent_policy_snapshot.workspace_id ||
    request.bot_id !== request.intent_policy_snapshot.bot_id ||
    request.owner_agent_id !== request.intent_policy_snapshot.owner_agent_id ||
    request.deployment_environment !==
      request.intent_policy_snapshot.deployment_environment ||
    request.release_channel !== request.intent_policy_snapshot.release_channel ||
    planned.size !== expectedPlanned.size ||
    [...planned].some((skill) => !expectedPlanned.has(skill)) ||
    [...planned].some((skill) => !allowed.has(skill)) ||
    (needsConfirmation && request.confirmation_ref === null) ||
    (!needsConfirmation && request.confirmation_ref !== null) ||
    (request.confirmation_ref === null) !==
      (request.confirmation_hash === null)
  ) {
    throw new Error("RuntimeStartContractV1 semantic binding mismatch");
  }
  assertRuntimePolicyInputLifetimeV1(request.policy, nowMs);
}
