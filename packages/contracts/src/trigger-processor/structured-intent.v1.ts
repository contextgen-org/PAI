import { Type, type Static } from "@sinclair/typebox";

import {
  TriggerProcessorIdentifierV1Schema,
  TriggerProcessorStringSetV1Schema,
  TriggerProcessorUtcTimestampV1Schema,
} from "./contract-primitives.v1.js";

export const StructuredIntentActionStepV1Schema = Type.Object(
  {
    step: Type.Integer({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER }),
    action_type: Type.Union([
      Type.Literal("respond"),
      Type.Literal("tool_use"),
      Type.Literal("ask_confirmation"),
      Type.Literal("wait"),
      Type.Literal("no_op"),
    ]),
    action: Type.String({ minLength: 1, maxLength: 16_384 }),
    candidate_tool: Type.Optional(TriggerProcessorIdentifierV1Schema),
    candidate_skill: Type.Optional(TriggerProcessorIdentifierV1Schema),
    capability_scope_required: Type.Optional(
      TriggerProcessorStringSetV1Schema,
    ),
    risk_level: Type.Optional(
      Type.Union([
        Type.Literal("low"),
        Type.Literal("medium"),
        Type.Literal("high"),
      ]),
    ),
    requires_confirmation: Type.Optional(Type.Boolean()),
    depends_on: Type.Optional(
      Type.Integer({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER }),
    ),
    condition: Type.Optional(Type.String({ minLength: 1, maxLength: 4096 })),
    fallback: Type.Optional(Type.String({ minLength: 1, maxLength: 4096 })),
  },
  { additionalProperties: false },
);

export const StructuredIntentV1Schema = Type.Object(
  {
    goal: Type.String({ minLength: 1, maxLength: 16_384 }),
    user_need: Type.String({ minLength: 1, maxLength: 16_384 }),
    response_style: Type.String({ minLength: 1, maxLength: 4096 }),
    action_plan: Type.Array(StructuredIntentActionStepV1Schema, {
      maxItems: 1_000,
    }),
    required_skills: TriggerProcessorStringSetV1Schema,
    memory_followups: Type.Array(
      Type.String({ minLength: 1, maxLength: 4096 }),
      { maxItems: 1_000 },
    ),
    /**
     * A host-normalized parent run which may only create its durable timer.
     * The timer child receives `deferred_instruction` and performs the actual
     * lookup at its due time.  This is deliberately an optional, restrictive
     * execution marker: it can only remove immediate capabilities.
     */
    execution_mode: Type.Optional(Type.Literal("deferred_timer_parent")),
    deferred_instruction: Type.Optional(
      Type.String({ minLength: 1, maxLength: 16_384 }),
    ),
    /**
     * Trigger-owned absolute deadline for a normalized relative reminder.
     * This is derived from the durable ingress timestamp rather than the
     * later Action Runtime start time, so queue and model latency cannot
     * silently extend the user's requested delay.
     */
    deferred_fire_at: Type.Optional(TriggerProcessorUtcTimestampV1Schema),
    safety_notes: Type.Array(
      Type.String({ minLength: 1, maxLength: 4096 }),
      { maxItems: 1_000 },
    ),
    degradation_notes: Type.Optional(
      Type.Array(Type.String({ minLength: 1, maxLength: 4096 }), {
        maxItems: 1_000,
      }),
    ),
    requires_confirmation: Type.Boolean(),
  },
  {
    $id: "urn:pai:trigger-processor:structured-intent:v1",
    additionalProperties: false,
  },
);

export type StructuredIntentActionStepV1 = Static<
  typeof StructuredIntentActionStepV1Schema
>;
export type StructuredIntentV1 = Static<typeof StructuredIntentV1Schema>;

export function assertStructuredIntentSemanticBindingsV1(
  intent: StructuredIntentV1,
): void {
  const deferredParent =
    intent.execution_mode === "deferred_timer_parent";
  if (
    deferredParent !== (intent.deferred_instruction !== undefined) ||
    deferredParent !== (intent.deferred_fire_at !== undefined) ||
    (deferredParent &&
      !Number.isFinite(Date.parse(intent.deferred_fire_at ?? ""))) ||
    (deferredParent &&
      (intent.required_skills.length !== 0 ||
        intent.action_plan.some(
          (step) =>
            step.action_type === "tool_use" &&
            step.candidate_tool !== "timer.remind_after",
        )))
  ) {
    throw new Error("StructuredIntentV1 deferred timer parent is invalid");
  }
  const stepNumbers = new Set<number>();
  for (const [index, step] of intent.action_plan.entries()) {
    const expectedStep = index + 1;
    if (
      step.step !== expectedStep ||
      stepNumbers.has(step.step) ||
      (step.depends_on !== undefined &&
        (!stepNumbers.has(step.depends_on) || step.depends_on >= step.step)) ||
      (step.action_type === "ask_confirmation" &&
        step.requires_confirmation !== true)
    ) {
      throw new Error("StructuredIntentV1 action plan is not a valid ordered DAG");
    }
    stepNumbers.add(step.step);
  }
}

export function structuredIntentRequiresConfirmationV1(
  intent: StructuredIntentV1,
): boolean {
  return (
    intent.requires_confirmation ||
    intent.action_plan.some((step) => step.requires_confirmation === true)
  );
}
