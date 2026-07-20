import { Type, type Static } from "@sinclair/typebox";

export const TriggerSourceV1Schema = Type.Union([
  Type.Literal("chat"),
  Type.Literal("notification"),
  Type.Literal("timer"),
]);

export const TriggerActorTypeV1Schema = Type.Union([
  Type.Literal("super_user"),
  Type.Literal("user"),
  Type.Literal("agent"),
  Type.Literal("developer"),
  Type.Literal("system"),
]);

export const TriggerPriorityV1Schema = Type.Union([
  Type.Literal("strong"),
  Type.Literal("weak"),
]);

export type TriggerSourceV1 = Static<typeof TriggerSourceV1Schema>;
export type TriggerActorTypeV1 = Static<typeof TriggerActorTypeV1Schema>;
export type TriggerPriorityV1 = Static<typeof TriggerPriorityV1Schema>;

export const MAX_SAFE_SLOT_GENERATION_V1 = Number.MAX_SAFE_INTEGER;

export const ACCEPTED_TRIGGER_ADMISSION_REASON_CODES_V1 = [
  "catch_up_foreground_busy",
  "timer_catch_up",
  "timer_due",
  "timer_due_preempt_active",
  "explicit_interrupt",
  "strong_no_active_dispatch",
  "strong_preempt_active",
  "weak_no_active_dispatch",
  "cooldown_merge_candidate",
  "active_process_running",
] as const;

export const AcceptedTriggerAdmissionReasonCodeV1Schema = Type.Union(
  ACCEPTED_TRIGGER_ADMISSION_REASON_CODES_V1.map((reasonCode) =>
    Type.Literal(reasonCode),
  ),
);

const runningAdmissionStateSchema = Type.Object(
  {
    phase: Type.Literal("admission"),
    status: Type.Literal("running"),
    wait_reason: Type.Null(),
    terminal_reason: Type.Null(),
  },
  { additionalProperties: false },
);

const admissionCommitPreconditionSchema = Type.Union([
  Type.Object(
    {
      kind: Type.Literal("idle"),
      process_id: Type.Null(),
      slot_generation: Type.Integer({
        minimum: 0,
        maximum: MAX_SAFE_SLOT_GENERATION_V1,
      }),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Literal("occupied"),
      process_id: Type.String({ minLength: 1 }),
      slot_generation: Type.Integer({
        minimum: 0,
        maximum: MAX_SAFE_SLOT_GENERATION_V1,
      }),
      phase: Type.Literal("execution"),
      status: Type.Literal("running"),
      process_updated_at: Type.String({ minLength: 1 }),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Literal("occupied"),
      process_id: Type.String({ minLength: 1 }),
      slot_generation: Type.Integer({
        minimum: 0,
        maximum: MAX_SAFE_SLOT_GENERATION_V1,
      }),
      phase: Type.Literal("cooldown"),
      status: Type.Literal("waiting"),
      process_updated_at: Type.String({ minLength: 1 }),
    },
    { additionalProperties: false },
  ),
]);

function waitingAdmissionStateSchema<
  const TReason extends "weak_queue" | "preempt_commit" | "deferred_strong_queue",
>(reason: TReason) {
  return Type.Object(
    {
      phase: Type.Literal("admission"),
      status: Type.Literal("waiting"),
      wait_reason: Type.Literal(reason),
      terminal_reason: Type.Null(),
    },
    { additionalProperties: false },
  );
}

function acceptedDecisionSchema<
  const TPriority extends "strong" | "weak",
  const TAction extends
    | "dispatch"
    | "dispatch_or_preempt"
    | "dispatch_catch_up_serial"
    | "enqueue_strong_fifo"
    | "enqueue_weak"
    | "merge_or_enqueue_weak",
  const TReason extends (typeof ACCEPTED_TRIGGER_ADMISSION_REASON_CODES_V1)[number],
>(
  priority: TPriority,
  action: TAction,
  reason: TReason,
  initialProcessState:
    | typeof runningAdmissionStateSchema
    | ReturnType<typeof waitingAdmissionStateSchema>,
) {
  return Type.Object(
    {
      trigger_status: Type.Literal("accepted"),
      priority: Type.Literal(priority),
      action: Type.Literal(action),
      reason_code: Type.Literal(reason),
      initial_process_state: initialProcessState,
      admission_precondition: admissionCommitPreconditionSchema,
    },
    { additionalProperties: false },
  );
}

export const TriggerAdmissionDecisionV1Schema = Type.Union(
  [
    acceptedDecisionSchema(
      "strong",
      "enqueue_strong_fifo",
      "catch_up_foreground_busy",
      waitingAdmissionStateSchema("deferred_strong_queue"),
    ),
    acceptedDecisionSchema(
      "strong",
      "dispatch_catch_up_serial",
      "timer_catch_up",
      runningAdmissionStateSchema,
    ),
    acceptedDecisionSchema(
      "strong",
      "dispatch",
      "timer_due",
      runningAdmissionStateSchema,
    ),
    acceptedDecisionSchema(
      "strong",
      "dispatch_or_preempt",
      "timer_due_preempt_active",
      waitingAdmissionStateSchema("preempt_commit"),
    ),
    acceptedDecisionSchema(
      "strong",
      "dispatch",
      "explicit_interrupt",
      runningAdmissionStateSchema,
    ),
    acceptedDecisionSchema(
      "strong",
      "dispatch_or_preempt",
      "explicit_interrupt",
      waitingAdmissionStateSchema("preempt_commit"),
    ),
    acceptedDecisionSchema(
      "strong",
      "dispatch",
      "strong_no_active_dispatch",
      runningAdmissionStateSchema,
    ),
    acceptedDecisionSchema(
      "strong",
      "dispatch_or_preempt",
      "strong_preempt_active",
      waitingAdmissionStateSchema("preempt_commit"),
    ),
    acceptedDecisionSchema(
      "weak",
      "dispatch",
      "weak_no_active_dispatch",
      runningAdmissionStateSchema,
    ),
    acceptedDecisionSchema(
      "weak",
      "merge_or_enqueue_weak",
      "cooldown_merge_candidate",
      waitingAdmissionStateSchema("weak_queue"),
    ),
    acceptedDecisionSchema(
      "weak",
      "enqueue_weak",
      "active_process_running",
      waitingAdmissionStateSchema("weak_queue"),
    ),
    Type.Object(
      {
        trigger_status: Type.Literal("rejected"),
        priority: TriggerPriorityV1Schema,
        action: Type.Literal("reject"),
        reason_code: Type.Union([
          Type.Literal("bot_disabled"),
          Type.Literal("bot_archived"),
          Type.Literal("safety_blocked"),
        ]),
      },
      { additionalProperties: false },
    ),
  ],
  { $id: "urn:pai:trigger-processor:trigger-admission-decision:v1" },
);

export type TriggerAdmissionDecisionV1 = Static<
  typeof TriggerAdmissionDecisionV1Schema
>;
