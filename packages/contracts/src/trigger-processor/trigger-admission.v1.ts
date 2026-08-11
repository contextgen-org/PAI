import {
  Type,
  type Static,
  type TProperties,
  type TSchema,
} from "@sinclair/typebox";

import {
  ChatTriggerSubmitRequestV1Schema,
  NotificationTriggerSubmitRequestV1Schema,
  TimerTriggerSubmitPayloadV1Schema,
  TimerTriggerSubmitRequestV1Schema,
  TriggerSubmitRequestV1Schema,
  type TriggerSubmitRequestV1,
} from "./trigger-submit.v1.js";

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

const canonicalTimestampPattern =
  "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,9})?(?:Z|[+-]\\d{2}:\\d{2})$";
const reasonCodePattern = "^[a-z][a-z0-9_]*(?:[._-][a-z0-9_]+)*$";
const nonEmptyIdentifier = Type.String({ minLength: 1, maxLength: 512 });
/** @deprecated Use the canonical TriggerSubmitRequestV1 schema. */
export const AdmitTriggerRequestBodyV1Schema = TriggerSubmitRequestV1Schema;
/** @deprecated Use TimerTriggerSubmitPayloadV1Schema. */
export const TimerAdmitTriggerPayloadV1Schema =
  TimerTriggerSubmitPayloadV1Schema;
/** @deprecated Use TriggerSubmitRequestV1. */
export type AdmitTriggerRequestBodyV1 = TriggerSubmitRequestV1;

const traceIdSchema = Type.String({ minLength: 1 });

export const ACCEPTED_TRIGGER_ADMISSION_REASON_CODES_V1 = [
  "catch_up_foreground_busy",
  "timer_catch_up",
  "timer_due",
  "timer_due_supersede_cooldown",
  "timer_due_preempt_active",
  "explicit_interrupt",
  "strong_no_active_dispatch",
  "strong_supersede_cooldown",
  "strong_preempt_active",
  "strong_fifo_waiting",
  "weak_no_active_dispatch",
  "cooldown_merge_candidate",
  "active_process_running",
] as const;

export const AcceptedTriggerAdmissionReasonCodeV1Schema = Type.Union(
  ACCEPTED_TRIGGER_ADMISSION_REASON_CODES_V1.map((reasonCode) =>
    Type.Literal(reasonCode),
  ),
);

export const AdmitTriggerCommandV1Schema = Type.Union(
  [
    Type.Object(
      { ...ChatTriggerSubmitRequestV1Schema.properties, trace_id: traceIdSchema },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        ...NotificationTriggerSubmitRequestV1Schema.properties,
        trace_id: traceIdSchema,
      },
      { additionalProperties: false },
    ),
    Type.Object(
      { ...TimerTriggerSubmitRequestV1Schema.properties, trace_id: traceIdSchema },
      { additionalProperties: false },
    ),
  ],
  {
    $id: "urn:pai:trigger-processor:admit-trigger-command:v1",
  },
);

export type AdmitTriggerCommandV1 = Static<typeof AdmitTriggerCommandV1Schema>;

const fieldErrorSchema = Type.Object(
  {
    field_path: Type.String({ minLength: 1 }),
    message: Type.String({ minLength: 1 }),
    expected: Type.String({ minLength: 1 }),
    actual: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

function admitTriggerResponseV1Schema<
  const TCode extends string,
  const TRetryable extends boolean,
  const TDetails extends TSchema,
>(code: TCode, retryable: TRetryable, details: TDetails) {
  return Type.Object(
    {
      code: Type.Literal(code),
      message: Type.String({ minLength: 1 }),
      retryable: Type.Literal(retryable),
      details,
      trace_id: Type.String({ minLength: 1 }),
    },
    { additionalProperties: false },
  );
}

function acceptedAdmissionDetailsFor<
  const TAction extends
    | "dispatch"
    | "dispatch_catch_up_serial"
    | "dispatch_or_preempt"
    | "enqueue_strong_fifo"
    | "enqueue_weak"
    | "merge_or_enqueue_weak",
  const TPriority extends "strong" | "weak",
  const TStatus extends "running" | "waiting",
  const TWaitReason extends
    | null
    | "preempt_commit"
    | "deferred_strong_queue"
    | "weak_queue",
  const TBlocked extends boolean,
  const TReasonCode extends TSchema,
>(
  action: TAction,
  priority: TPriority,
  status: TStatus,
  waitReason: TWaitReason,
  blocked: TBlocked,
  reasonCode: TReasonCode,
  duplicateReplayed: boolean,
) {
  return Type.Object(
    {
      trigger_id: nonEmptyIdentifier,
      trigger_status: Type.Literal("accepted"),
      trigger_process_id: nonEmptyIdentifier,
      process_phase: Type.Literal("admission"),
      process_status: Type.Literal(status),
      wait_reason:
        waitReason === null ? Type.Null() : Type.Literal(waitReason),
      blocked_by_process_id: blocked
        ? nonEmptyIdentifier
        : Type.Null(),
      priority: Type.Literal(priority),
      action: Type.Literal(action),
      reason_code: reasonCode,
      duplicate_replayed: Type.Literal(duplicateReplayed),
    },
    { additionalProperties: false },
  );
}

function mergedAdmissionDetails(duplicateReplayed: boolean) {
  return Type.Object(
    {
      trigger_id: nonEmptyIdentifier,
      trigger_status: Type.Literal("accepted"),
      trigger_process_id: nonEmptyIdentifier,
      process_phase: Type.Literal("closed"),
      process_status: Type.Literal("completed"),
      wait_reason: Type.Null(),
      blocked_by_process_id: Type.Null(),
      priority: Type.Literal("weak"),
      action: Type.Literal("merge_or_enqueue_weak"),
      reason_code: Type.Literal("cooldown_merge_candidate"),
      canonical_process_id: nonEmptyIdentifier,
      terminal_reason: Type.Literal("merged"),
      duplicate_replayed: Type.Literal(duplicateReplayed),
    },
    { additionalProperties: false },
  );
}

function acceptedDetailsSchemaFor(duplicateReplayed: boolean) {
  return Type.Union([
    acceptedAdmissionDetailsFor(
      "dispatch",
      "strong",
      "running",
      null,
      false,
      Type.Union([
        Type.Literal("timer_due"),
        Type.Literal("timer_due_supersede_cooldown"),
        Type.Literal("explicit_interrupt"),
        Type.Literal("strong_no_active_dispatch"),
        Type.Literal("strong_supersede_cooldown"),
      ]),
      duplicateReplayed,
    ),
    acceptedAdmissionDetailsFor(
      "dispatch",
      "weak",
      "running",
      null,
      false,
      Type.Literal("weak_no_active_dispatch"),
      duplicateReplayed,
    ),
    acceptedAdmissionDetailsFor(
      "dispatch_catch_up_serial",
      "strong",
      "running",
      null,
      false,
      Type.Literal("timer_catch_up"),
      duplicateReplayed,
    ),
    acceptedAdmissionDetailsFor(
      "dispatch_or_preempt",
      "strong",
      "waiting",
      "preempt_commit",
      true,
      Type.Union([
        Type.Literal("timer_due_preempt_active"),
        Type.Literal("explicit_interrupt"),
        Type.Literal("strong_preempt_active"),
      ]),
      duplicateReplayed,
    ),
    acceptedAdmissionDetailsFor(
      "enqueue_strong_fifo",
      "strong",
      "waiting",
      "deferred_strong_queue",
      // Strong FIFO admission is fenced by immutable queue order and the
      // queue-head revision, not by a mutable direct blocker edge.
      false,
      Type.Union([
        Type.Literal("catch_up_foreground_busy"),
        Type.Literal("strong_fifo_waiting"),
      ]),
      duplicateReplayed,
    ),
    acceptedAdmissionDetailsFor(
      "enqueue_weak",
      "weak",
      "waiting",
      "weak_queue",
      true,
      Type.Union([
        Type.Literal("active_process_running"),
        Type.Literal("strong_fifo_waiting"),
      ]),
      duplicateReplayed,
    ),
    acceptedAdmissionDetailsFor(
      "merge_or_enqueue_weak",
      "weak",
      "waiting",
      "weak_queue",
      true,
      Type.Literal("cooldown_merge_candidate"),
      duplicateReplayed,
    ),
    mergedAdmissionDetails(duplicateReplayed),
  ]);
}

const acceptedDetailsSchema = acceptedDetailsSchemaFor(false);
const rejectedReasonCodeSchema = Type.Union([
  Type.Literal("bot_disabled"),
  Type.Literal("bot_archived"),
  Type.Literal("safety_blocked"),
]);
const rejectedDetailsSchema = Type.Object(
  {
    trigger_id: nonEmptyIdentifier,
    trigger_status: Type.Literal("rejected"),
    trigger_process_id: Type.Null(),
    process_phase: Type.Null(),
    process_status: Type.Null(),
    priority: TriggerPriorityV1Schema,
    action: Type.Literal("reject"),
    reason_code: rejectedReasonCodeSchema,
    rejected_event_id: nonEmptyIdentifier,
    duplicate_replayed: Type.Literal(false),
  },
  { additionalProperties: false },
);
// Duplicate admission replays the first committed admission facts. It must not
// project the process's current lifecycle state or replace the original action
// with a synthetic "duplicate_replay" action.
const duplicateAcceptedDetailsSchema = acceptedDetailsSchemaFor(true);
const duplicateRejectedDetailsSchema = Type.Object(
  {
    trigger_id: nonEmptyIdentifier,
    trigger_status: Type.Literal("rejected"),
    trigger_process_id: Type.Null(),
    process_phase: Type.Null(),
    process_status: Type.Null(),
    priority: TriggerPriorityV1Schema,
    action: Type.Literal("reject"),
    reason_code: rejectedReasonCodeSchema,
    rejected_event_id: nonEmptyIdentifier,
    duplicate_replayed: Type.Literal(true),
  },
  { additionalProperties: false },
);

export const AdmitTriggerAcceptedResponseV1Schema =
  admitTriggerResponseV1Schema("trigger_accepted", false, acceptedDetailsSchema);
export const AdmitTriggerOkResponseV1Schema = Type.Union(
  [
    admitTriggerResponseV1Schema("trigger_rejected", false, rejectedDetailsSchema),
    admitTriggerResponseV1Schema(
      "duplicate_replayed",
      false,
      Type.Union([duplicateAcceptedDetailsSchema, duplicateRejectedDetailsSchema]),
    ),
  ],
  { $id: "urn:pai:trigger-processor:admit-trigger-ok-response:v1" },
);
export const AdmitTriggerSuccessResponseV1Schema = Type.Union(
  [AdmitTriggerAcceptedResponseV1Schema, AdmitTriggerOkResponseV1Schema],
  { $id: "urn:pai:trigger-processor:admit-trigger-success-response:v1" },
);

export const AdmitTriggerInvalidRequestResponseV1Schema =
  admitTriggerResponseV1Schema(
    "invalid_request",
    false,
    Type.Object(
      {
        schema_version: Type.Literal("trigger_submit_request.v1"),
        field_errors: Type.Array(fieldErrorSchema, { minItems: 1, maxItems: 100 }),
        submit_attempt_id: nonEmptyIdentifier,
      },
      { additionalProperties: false },
    ),
  );

export const AdmitTriggerUnauthenticatedResponseV1Schema =
  admitTriggerResponseV1Schema(
    "unauthenticated",
    false,
    Type.Object({ submit_attempt_id: nonEmptyIdentifier }, { additionalProperties: false }),
  );

export const AdmitTriggerAuthorizationFailureResponseV1Schema = Type.Union(
  [
    admitTriggerResponseV1Schema(
      "bot_permission_denied",
      false,
      Type.Object(
        {
          permission_scope: Type.String({ minLength: 1 }),
          policy: Type.String({ minLength: 1 }),
          reason_code: Type.Literal("bot_permission_denied"),
          submit_attempt_id: nonEmptyIdentifier,
        },
        { additionalProperties: false },
      ),
    ),
    admitTriggerResponseV1Schema(
      "timer_source_caller_denied",
      false,
      Type.Object(
        {
          permission_scope: Type.String({ minLength: 1 }),
          policy: Type.String({ minLength: 1 }),
          reason_code: Type.Literal("timer_source_caller_denied"),
          submit_attempt_id: nonEmptyIdentifier,
        },
        { additionalProperties: false },
      ),
    ),
    admitTriggerResponseV1Schema(
      "timer_owner_binding_mismatch",
      false,
      Type.Object(
        {
          permission_scope: Type.String({ minLength: 1 }),
          policy: Type.String({ minLength: 1 }),
          reason_code: Type.Literal("timer_owner_binding_mismatch"),
          submit_attempt_id: nonEmptyIdentifier,
        },
        { additionalProperties: false },
      ),
    ),
  ],
  {
    $id: "urn:pai:trigger-processor:admit-trigger-authorization-failure-response:v1",
  },
);

export const AdmitTriggerNotFoundResponseV1Schema = admitTriggerResponseV1Schema(
  "bot_not_found",
  false,
  Type.Object(
    { submit_attempt_id: nonEmptyIdentifier },
    { additionalProperties: false },
  ),
);

export const AdmitTriggerConflictResponseV1Schema = Type.Union(
  [
    admitTriggerResponseV1Schema(
      "idempotency_conflict",
      false,
      Type.Object(
        {
          dedupe_key: nonEmptyIdentifier,
          existing_trigger_id: nonEmptyIdentifier,
          existing_process_id: Type.Union([nonEmptyIdentifier, Type.Null()]),
        },
        { additionalProperties: false },
      ),
    ),
    admitTriggerResponseV1Schema(
      "preempt_conflict",
      true,
      Type.Object(
        { trigger_process_id: nonEmptyIdentifier, reason_code: Type.String({ pattern: reasonCodePattern }) },
        { additionalProperties: false },
      ),
    ),
  ],
  { $id: "urn:pai:trigger-processor:admit-trigger-conflict-response:v1" },
);

export const AdmitTriggerRateLimitedResponseV1Schema = admitTriggerResponseV1Schema(
  "rate_limited",
  true,
  Type.Object(
    {
      retry_after_ms: Type.Integer({ minimum: 1, maximum: 3_600_000 }),
      quota_key: nonEmptyIdentifier,
      limit_window_ms: Type.Integer({ minimum: 1, maximum: 86_400_000 }),
      submit_attempt_id: nonEmptyIdentifier,
    },
    { additionalProperties: false },
  ),
);

export const AdmitTriggerInternalErrorResponseV1Schema =
  admitTriggerResponseV1Schema(
    "internal_error",
    false,
    Type.Object(
      { schema_version: Type.Literal("trigger_submit_response.v1") },
      { additionalProperties: false },
    ),
  );

export const AdmitTriggerRetryableFailureResponseV1Schema = Type.Union(
  [
    admitTriggerResponseV1Schema(
      "storage_unavailable",
      true,
      Type.Object(
        { submit_attempt_id: Type.Union([nonEmptyIdentifier, Type.Null()]) },
        { additionalProperties: false },
      ),
    ),
    admitTriggerResponseV1Schema(
      "degraded_mode",
      true,
      Type.Object(
        { submit_attempt_id: Type.Union([nonEmptyIdentifier, Type.Null()]) },
        { additionalProperties: false },
      ),
    ),
  ],
  {
    $id: "urn:pai:trigger-processor:admit-trigger-retryable-failure-response:v1",
  },
);

export const AdmitTriggerWriterResponseV1Schema = Type.Union(
  [
    AdmitTriggerSuccessResponseV1Schema,
    AdmitTriggerAuthorizationFailureResponseV1Schema,
    AdmitTriggerNotFoundResponseV1Schema,
    AdmitTriggerConflictResponseV1Schema,
    AdmitTriggerRateLimitedResponseV1Schema,
    AdmitTriggerRetryableFailureResponseV1Schema,
  ],
  { $id: "urn:pai:trigger-processor:admit-trigger-writer-response:v1" },
);

export const AdmitTriggerResponseV1Schema = Type.Union(
  [
    AdmitTriggerSuccessResponseV1Schema,
    AdmitTriggerInvalidRequestResponseV1Schema,
    AdmitTriggerUnauthenticatedResponseV1Schema,
    AdmitTriggerAuthorizationFailureResponseV1Schema,
    AdmitTriggerNotFoundResponseV1Schema,
    AdmitTriggerConflictResponseV1Schema,
    AdmitTriggerRateLimitedResponseV1Schema,
    AdmitTriggerInternalErrorResponseV1Schema,
    AdmitTriggerRetryableFailureResponseV1Schema,
  ],
  { $id: "urn:pai:trigger-processor:admit-trigger-response:v1" },
);

export type AdmitTriggerResponseV1 = Static<typeof AdmitTriggerResponseV1Schema>;
export type AdmitTriggerWriterResponseV1 = Static<
  typeof AdmitTriggerWriterResponseV1Schema
>;

const trustedAdmissionFactsBaseProperties = {
  source: TriggerSourceV1Schema,
  actor_type: TriggerActorTypeV1Schema,
  bot_state: Type.Union([
    Type.Literal("active"),
    Type.Literal("disabled"),
    Type.Literal("archived"),
  ]),
  safety_blocked: Type.Boolean(),
  trusted_strong_hint: Type.Boolean(),
  explicit_interrupt: Type.Boolean(),
  is_catch_up: Type.Boolean(),
  foreground_slot_generation: Type.Integer({
    minimum: 0,
    maximum: MAX_SAFE_SLOT_GENERATION_V1,
  }),
  strong_fifo_revision: Type.Integer({
    minimum: 0,
    maximum: MAX_SAFE_SLOT_GENERATION_V1,
  }),
};

function trustedAdmissionStateVariants<const TState extends TProperties>(
  state: TState,
) {
  return [
    Type.Object(
      {
        ...trustedAdmissionFactsBaseProperties,
        strong_fifo_head_process_id: Type.Null(),
        strong_fifo_head_admission_time: Type.Null(),
        strong_fifo_preempt_commit_process_id: Type.Null(),
        ...state,
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        ...trustedAdmissionFactsBaseProperties,
        strong_fifo_head_process_id: Type.String({ minLength: 1 }),
        strong_fifo_head_admission_time: Type.String({
          minLength: 1,
          pattern: canonicalTimestampPattern,
        }),
        strong_fifo_preempt_commit_process_id: Type.Null(),
        ...state,
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        ...trustedAdmissionFactsBaseProperties,
        strong_fifo_head_process_id: Type.String({ minLength: 1 }),
        strong_fifo_head_admission_time: Type.String({
          minLength: 1,
          pattern: canonicalTimestampPattern,
        }),
        strong_fifo_preempt_commit_process_id: Type.String({ minLength: 1 }),
        ...state,
      },
      { additionalProperties: false },
    ),
  ] as const;
}

export const TrustedAdmissionFactsV1Schema = Type.Union(
  [
    ...trustedAdmissionStateVariants(
      {
        active_process: Type.Literal("none"),
        active_process_id: Type.Null(),
        active_process_slot_generation: Type.Null(),
        active_process_state_version: Type.Null(),
        foreground_slot_process_id: Type.Null(),
      },
    ),
    ...trustedAdmissionStateVariants(
      {
        active_process: Type.Literal("execution_running"),
        active_process_id: Type.String({ minLength: 1 }),
        active_process_slot_generation: Type.Integer({
          minimum: 0,
          maximum: MAX_SAFE_SLOT_GENERATION_V1,
        }),
        active_process_state_version: Type.Integer({
          minimum: 1,
          maximum: Number.MAX_SAFE_INTEGER,
        }),
        foreground_slot_process_id: Type.String({ minLength: 1 }),
      },
    ),
    ...trustedAdmissionStateVariants(
      {
        // A Runtime Start reservation owns the foreground slot before a
        // Runtime exists. It is occupied, but cannot be preempted because a
        // preempt command has no durable Runtime binding yet.
        active_process: Type.Literal("execution_waiting"),
        active_process_id: Type.String({ minLength: 1 }),
        active_process_slot_generation: Type.Integer({
          minimum: 0,
          maximum: MAX_SAFE_SLOT_GENERATION_V1,
        }),
        active_process_state_version: Type.Integer({
          minimum: 1,
          maximum: Number.MAX_SAFE_INTEGER,
        }),
        foreground_slot_process_id: Type.String({ minLength: 1 }),
      },
    ),
    ...trustedAdmissionStateVariants(
      {
        // The foreground Runtime has already entered a terminal-control
        // transition. A second preempt must queue behind that fenced action.
        active_process: Type.Literal("execution_preempt_requested"),
        active_process_id: Type.String({ minLength: 1 }),
        active_process_slot_generation: Type.Integer({
          minimum: 0,
          maximum: MAX_SAFE_SLOT_GENERATION_V1,
        }),
        active_process_state_version: Type.Integer({
          minimum: 1,
          maximum: Number.MAX_SAFE_INTEGER,
        }),
        foreground_slot_process_id: Type.String({ minLength: 1 }),
      },
    ),
    ...trustedAdmissionStateVariants(
      {
        active_process: Type.Literal("execution_cancelling"),
        active_process_id: Type.String({ minLength: 1 }),
        active_process_slot_generation: Type.Integer({
          minimum: 0,
          maximum: MAX_SAFE_SLOT_GENERATION_V1,
        }),
        active_process_state_version: Type.Integer({
          minimum: 1,
          maximum: Number.MAX_SAFE_INTEGER,
        }),
        foreground_slot_process_id: Type.String({ minLength: 1 }),
      },
    ),
    ...trustedAdmissionStateVariants(
      {
        // A preempt handoff or Runtime Start recompose can retain the slot
        // while Context is rebuilt. It is occupied but has no preempt target.
        active_process: Type.Literal("context_running"),
        active_process_id: Type.String({ minLength: 1 }),
        active_process_slot_generation: Type.Integer({
          minimum: 0,
          maximum: MAX_SAFE_SLOT_GENERATION_V1,
        }),
        active_process_state_version: Type.Integer({
          minimum: 1,
          maximum: Number.MAX_SAFE_INTEGER,
        }),
        foreground_slot_process_id: Type.String({ minLength: 1 }),
      },
    ),
    ...trustedAdmissionStateVariants(
      {
        active_process: Type.Literal("context_waiting"),
        active_process_id: Type.String({ minLength: 1 }),
        active_process_slot_generation: Type.Integer({
          minimum: 0,
          maximum: MAX_SAFE_SLOT_GENERATION_V1,
        }),
        active_process_state_version: Type.Integer({
          minimum: 1,
          maximum: Number.MAX_SAFE_INTEGER,
        }),
        foreground_slot_process_id: Type.String({ minLength: 1 }),
      },
    ),
    ...trustedAdmissionStateVariants(
      {
        active_process: Type.Literal("intent_running"),
        active_process_id: Type.String({ minLength: 1 }),
        active_process_slot_generation: Type.Integer({
          minimum: 0,
          maximum: MAX_SAFE_SLOT_GENERATION_V1,
        }),
        active_process_state_version: Type.Integer({
          minimum: 1,
          maximum: Number.MAX_SAFE_INTEGER,
        }),
        foreground_slot_process_id: Type.String({ minLength: 1 }),
      },
    ),
    ...trustedAdmissionStateVariants(
      {
        active_process: Type.Literal("intent_waiting"),
        active_process_id: Type.String({ minLength: 1 }),
        active_process_slot_generation: Type.Integer({
          minimum: 0,
          maximum: MAX_SAFE_SLOT_GENERATION_V1,
        }),
        active_process_state_version: Type.Integer({
          minimum: 1,
          maximum: Number.MAX_SAFE_INTEGER,
        }),
        foreground_slot_process_id: Type.String({ minLength: 1 }),
      },
    ),
    ...trustedAdmissionStateVariants(
      {
        active_process: Type.Literal("cooldown_waiting"),
        active_process_id: Type.String({ minLength: 1 }),
        active_process_slot_generation: Type.Integer({
          minimum: 0,
          maximum: MAX_SAFE_SLOT_GENERATION_V1,
        }),
        active_process_state_version: Type.Integer({
          minimum: 1,
          maximum: Number.MAX_SAFE_INTEGER,
        }),
        foreground_slot_process_id: Type.String({ minLength: 1 }),
      },
    ),
  ],
  { $id: "urn:pai:trigger-processor:trusted-admission-facts:v1" },
);

export type TrustedAdmissionFactsV1 = Static<
  typeof TrustedAdmissionFactsV1Schema
>;

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
      strong_fifo_revision: Type.Integer({
        minimum: 0,
        maximum: MAX_SAFE_SLOT_GENERATION_V1,
      }),
      strong_fifo_head_process_id: Type.Union([
        Type.String({ minLength: 1 }),
        Type.Null(),
      ]),
      strong_fifo_head_admission_time: Type.Union([
        Type.String({ minLength: 1, pattern: canonicalTimestampPattern }),
        Type.Null(),
      ]),
      strong_fifo_preempt_commit_process_id: Type.Union([
        Type.String({ minLength: 1 }),
        Type.Null(),
      ]),
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
      status: Type.Union([
        Type.Literal("running"),
        Type.Literal("waiting"),
        Type.Literal("preempt_requested"),
        Type.Literal("cancelling"),
      ]),
      process_state_version: Type.Integer({
        minimum: 1,
        maximum: Number.MAX_SAFE_INTEGER,
      }),
      strong_fifo_revision: Type.Integer({
        minimum: 0,
        maximum: MAX_SAFE_SLOT_GENERATION_V1,
      }),
      strong_fifo_head_process_id: Type.Union([
        Type.String({ minLength: 1 }),
        Type.Null(),
      ]),
      strong_fifo_head_admission_time: Type.Union([
        Type.String({ minLength: 1, pattern: canonicalTimestampPattern }),
        Type.Null(),
      ]),
      strong_fifo_preempt_commit_process_id: Type.Union([
        Type.String({ minLength: 1 }),
        Type.Null(),
      ]),
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
      phase: Type.Literal("context"),
      status: Type.Union([Type.Literal("running"), Type.Literal("waiting")]),
      process_state_version: Type.Integer({
        minimum: 1,
        maximum: Number.MAX_SAFE_INTEGER,
      }),
      strong_fifo_revision: Type.Integer({
        minimum: 0,
        maximum: MAX_SAFE_SLOT_GENERATION_V1,
      }),
      strong_fifo_head_process_id: Type.Union([
        Type.String({ minLength: 1 }),
        Type.Null(),
      ]),
      strong_fifo_head_admission_time: Type.Union([
        Type.String({ minLength: 1, pattern: canonicalTimestampPattern }),
        Type.Null(),
      ]),
      strong_fifo_preempt_commit_process_id: Type.Union([
        Type.String({ minLength: 1 }),
        Type.Null(),
      ]),
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
      phase: Type.Literal("intent"),
      status: Type.Union([Type.Literal("running"), Type.Literal("waiting")]),
      process_state_version: Type.Integer({
        minimum: 1,
        maximum: Number.MAX_SAFE_INTEGER,
      }),
      strong_fifo_revision: Type.Integer({
        minimum: 0,
        maximum: MAX_SAFE_SLOT_GENERATION_V1,
      }),
      strong_fifo_head_process_id: Type.Union([
        Type.String({ minLength: 1 }),
        Type.Null(),
      ]),
      strong_fifo_head_admission_time: Type.Union([
        Type.String({ minLength: 1, pattern: canonicalTimestampPattern }),
        Type.Null(),
      ]),
      strong_fifo_preempt_commit_process_id: Type.Union([
        Type.String({ minLength: 1 }),
        Type.Null(),
      ]),
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
      process_state_version: Type.Integer({
        minimum: 1,
        maximum: Number.MAX_SAFE_INTEGER,
      }),
      strong_fifo_revision: Type.Integer({
        minimum: 0,
        maximum: MAX_SAFE_SLOT_GENERATION_V1,
      }),
      strong_fifo_head_process_id: Type.Union([
        Type.String({ minLength: 1 }),
        Type.Null(),
      ]),
      strong_fifo_head_admission_time: Type.Union([
        Type.String({ minLength: 1, pattern: canonicalTimestampPattern }),
        Type.Null(),
      ]),
      strong_fifo_preempt_commit_process_id: Type.Union([
        Type.String({ minLength: 1 }),
        Type.Null(),
      ]),
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
      "enqueue_strong_fifo",
      "strong_fifo_waiting",
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
      "dispatch",
      "timer_due_supersede_cooldown",
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
      "dispatch",
      "strong_supersede_cooldown",
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
    acceptedDecisionSchema(
      "weak",
      "enqueue_weak",
      "strong_fifo_waiting",
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
