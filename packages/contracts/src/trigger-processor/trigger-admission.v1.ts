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

export const TriggerAdmissionDecisionV1Schema = Type.Union(
  [
    Type.Object(
      {
        trigger_status: Type.Literal("accepted"),
        priority: TriggerPriorityV1Schema,
        action: Type.Union([
          Type.Literal("dispatch"),
          Type.Literal("dispatch_or_preempt"),
          Type.Literal("dispatch_catch_up_serial"),
          Type.Literal("enqueue_strong_fifo"),
          Type.Literal("enqueue_weak"),
          Type.Literal("merge_or_enqueue_weak"),
        ]),
        reason_code: Type.String({ minLength: 1 }),
        initial_process_state: Type.Object(
          {
            phase: Type.Literal("admission"),
            status: Type.Union([
              Type.Literal("running"),
              Type.Literal("waiting"),
            ]),
            wait_reason: Type.Union([
              Type.Null(),
              Type.Literal("weak_queue"),
              Type.Literal("preempt_commit"),
              Type.Literal("deferred_strong_queue"),
            ]),
            terminal_reason: Type.Null(),
          },
          { additionalProperties: false },
        ),
      },
      { additionalProperties: false },
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
