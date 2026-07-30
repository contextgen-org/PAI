import { Type, type Static } from "@sinclair/typebox";

import {
  TimerIdentifierV1Schema,
  TimerIdentityV1Properties,
  TimerPositiveVersionV1Schema,
  TimerReasonCodeV1Schema,
  TimerUtcTimestampV1Schema,
} from "./primitives.v1.js";

export const TimerCatchUpPolicySnapshotV1Schema = Type.Object(
  {
    catch_up_timeout_seconds: Type.Integer({ minimum: 1, maximum: 3_600 }),
    max_catch_up_window_seconds: Type.Integer({
      minimum: 60,
      maximum: 2_592_000,
    }),
    max_catch_up_occurrences: Type.Integer({
      minimum: 1,
      maximum: 1_000,
    }),
    catch_up_continue_after_failed: Type.Boolean(),
    config_revision: TimerIdentifierV1Schema,
  },
  {
    additionalProperties: false,
    $id: "urn:pai:timer:catch-up-policy-snapshot:v1",
  },
);

export const TimerConfigV1Schema = Type.Object(
  {
    catch_up_timeout_seconds: Type.Optional(
      Type.Integer({ minimum: 1, maximum: 3_600, default: 300 }),
    ),
    max_catch_up_window_seconds: Type.Optional(
      Type.Integer({ minimum: 60, maximum: 2_592_000, default: 86_400 }),
    ),
    max_catch_up_occurrences: Type.Optional(
      Type.Integer({ minimum: 1, maximum: 1_000, default: 100 }),
    ),
    catch_up_continue_after_failed: Type.Optional(
      Type.Boolean({ default: true }),
    ),
  },
  {
    additionalProperties: false,
    $id: "urn:pai:timer:config:v1",
  },
);

const batchCommon = {
  schema_version: Type.Literal("timer.catch_up_batch.v1"),
  catch_up_batch_id: TimerIdentifierV1Schema,
  ...TimerIdentityV1Properties,
  cursor_occurrence_id: Type.Union([TimerIdentifierV1Schema, Type.Null()]),
  last_occurrence_id: Type.Union([TimerIdentifierV1Schema, Type.Null()]),
  last_trigger_process_id: Type.Union([
    TimerIdentifierV1Schema,
    Type.Null(),
  ]),
  timeout_seconds: Type.Integer({ minimum: 1, maximum: 3_600 }),
  deadline_at: TimerUtcTimestampV1Schema,
  started_at: TimerUtcTimestampV1Schema,
  created_at: TimerUtcTimestampV1Schema,
  updated_at: TimerUtcTimestampV1Schema,
  policy_snapshot: TimerCatchUpPolicySnapshotV1Schema,
} as const;

export const TimerCatchUpBatchV1Schema = Type.Union(
  [
    Type.Object(
      {
        ...batchCommon,
        status: Type.Literal("running"),
        completed_at: Type.Null(),
        reason_code: Type.Null(),
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        ...batchCommon,
        status: Type.Literal("completed"),
        completed_at: TimerUtcTimestampV1Schema,
        reason_code: Type.Union([
          Type.Literal("all_occurrences_dispatched"),
          Type.Literal("no_dispatchable_occurrences"),
        ]),
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        ...batchCommon,
        status: Type.Literal("timed_out"),
        completed_at: TimerUtcTimestampV1Schema,
        reason_code: Type.Literal("catch_up_timeout"),
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        ...batchCommon,
        status: Type.Literal("cancelled"),
        completed_at: TimerUtcTimestampV1Schema,
        reason_code: TimerReasonCodeV1Schema,
      },
      { additionalProperties: false },
    ),
  ],
  { $id: "urn:pai:timer:catch-up-batch:v1" },
);

export const TimerCatchUpBatchCreateV1Schema = Type.Object(
  {
    schema_version: Type.Literal("timer.catch_up_batch_create.v1"),
    ...TimerIdentityV1Properties,
    catch_up_batch_id: TimerIdentifierV1Schema,
    occurrence_ids: Type.Array(TimerIdentifierV1Schema, {
      minItems: 1,
      maxItems: 1_000,
      uniqueItems: true,
    }),
    window_start: TimerUtcTimestampV1Schema,
    window_end: TimerUtcTimestampV1Schema,
    started_at: TimerUtcTimestampV1Schema,
    policy_snapshot: TimerCatchUpPolicySnapshotV1Schema,
    request_hash: Type.String({
      minLength: 71,
      maxLength: 71,
      pattern: "^sha256:[a-f0-9]{64}$",
    }),
    trace_id: TimerIdentifierV1Schema,
  },
  {
    additionalProperties: false,
    $id: "urn:pai:timer:catch-up-batch-create:v1",
  },
);

export const TimerCatchUpBatchAdvanceV1Schema = Type.Object(
  {
    schema_version: Type.Literal("timer.catch_up_batch_advance.v1"),
    ...TimerIdentityV1Properties,
    catch_up_batch_id: TimerIdentifierV1Schema,
    expected_status: Type.Literal("running"),
    expected_cursor_occurrence_id: Type.Union([
      TimerIdentifierV1Schema,
      Type.Null(),
    ]),
    expected_last_occurrence_id: Type.Union([
      TimerIdentifierV1Schema,
      Type.Null(),
    ]),
    expected_last_trigger_process_id: Type.Union([
      TimerIdentifierV1Schema,
      Type.Null(),
    ]),
    next_occurrence_id: Type.Union([TimerIdentifierV1Schema, Type.Null()]),
    previous_process_terminal: Type.Boolean(),
    previous_meta_terminal: Type.Boolean(),
    trace_id: TimerIdentifierV1Schema,
  },
  {
    additionalProperties: false,
    $id: "urn:pai:timer:catch-up-batch-advance:v1",
  },
);

export const TimerCatchUpBatchTimeoutV1Schema = Type.Object(
  {
    schema_version: Type.Literal("timer.catch_up_batch_timeout.v1"),
    ...TimerIdentityV1Properties,
    catch_up_batch_id: TimerIdentifierV1Schema,
    expected_status: Type.Literal("running"),
    expected_deadline_at: TimerUtcTimestampV1Schema,
    timed_out_at: TimerUtcTimestampV1Schema,
    reason_code: Type.Literal("catch_up_timeout"),
    trace_id: TimerIdentifierV1Schema,
  },
  {
    additionalProperties: false,
    $id: "urn:pai:timer:catch-up-batch-timeout:v1",
  },
);

export type TimerCatchUpPolicySnapshotV1 = Static<
  typeof TimerCatchUpPolicySnapshotV1Schema
>;
export type TimerConfigV1 = Static<typeof TimerConfigV1Schema>;
export type TimerCatchUpBatchV1 = Static<typeof TimerCatchUpBatchV1Schema>;
export type TimerCatchUpBatchCreateV1 = Static<
  typeof TimerCatchUpBatchCreateV1Schema
>;
export type TimerCatchUpBatchAdvanceV1 = Static<
  typeof TimerCatchUpBatchAdvanceV1Schema
>;
export type TimerCatchUpBatchTimeoutV1 = Static<
  typeof TimerCatchUpBatchTimeoutV1Schema
>;

export const TIMER_CONFIG_DEFAULTS_V1 = Object.freeze({
  catch_up_timeout_seconds: 300,
  max_catch_up_window_seconds: 86_400,
  max_catch_up_occurrences: 100,
  catch_up_continue_after_failed: true,
} as const);

export function freezeTimerCatchUpPolicyV1(
  config: TimerConfigV1,
  configRevision: string,
): TimerCatchUpPolicySnapshotV1 {
  return Object.freeze({
    catch_up_timeout_seconds:
      config.catch_up_timeout_seconds ??
      TIMER_CONFIG_DEFAULTS_V1.catch_up_timeout_seconds,
    max_catch_up_window_seconds:
      config.max_catch_up_window_seconds ??
      TIMER_CONFIG_DEFAULTS_V1.max_catch_up_window_seconds,
    max_catch_up_occurrences:
      config.max_catch_up_occurrences ??
      TIMER_CONFIG_DEFAULTS_V1.max_catch_up_occurrences,
    catch_up_continue_after_failed:
      config.catch_up_continue_after_failed ??
      TIMER_CONFIG_DEFAULTS_V1.catch_up_continue_after_failed,
    config_revision: configRevision,
  });
}

export function assertTimerCatchUpBatchCreateBindingsV1(
  command: TimerCatchUpBatchCreateV1,
): void {
  if (
    Date.parse(command.window_start) > Date.parse(command.window_end) ||
    Date.parse(command.started_at) < Date.parse(command.window_end) ||
    Date.parse(command.window_end) - Date.parse(command.window_start) >
      command.policy_snapshot.max_catch_up_window_seconds * 1_000 ||
    command.occurrence_ids.length >
      command.policy_snapshot.max_catch_up_occurrences
  ) {
    throw new TypeError("Timer catch-up batch window or count exceeds policy");
  }
}

export function assertTimerCatchUpBatchBindingsV1(
  batch: TimerCatchUpBatchV1,
): void {
  if (
    batch.timeout_seconds !==
      batch.policy_snapshot.catch_up_timeout_seconds ||
    Date.parse(batch.deadline_at) - Date.parse(batch.started_at) !==
      batch.timeout_seconds * 1_000 ||
    Date.parse(batch.updated_at) < Date.parse(batch.created_at)
  ) {
    throw new TypeError("Timer catch-up batch policy or time binding mismatch");
  }
  if (
    (batch.last_occurrence_id === null) !==
      (batch.last_trigger_process_id === null) ||
    (batch.cursor_occurrence_id === null &&
      batch.last_occurrence_id !== null)
  ) {
    throw new TypeError("Timer catch-up batch cursor binding mismatch");
  }
}

export function assertTimerCatchUpAdvanceBindingsV1(
  advance: TimerCatchUpBatchAdvanceV1,
): void {
  const hasPrevious = advance.expected_last_trigger_process_id !== null;
  if (
    hasPrevious !== (advance.expected_last_occurrence_id !== null) ||
    (hasPrevious &&
      (!advance.previous_process_terminal ||
        !advance.previous_meta_terminal)) ||
    (!hasPrevious &&
      (advance.previous_process_terminal || advance.previous_meta_terminal))
  ) {
    throw new TypeError("Timer catch-up advance authority binding mismatch");
  }
}

export function assertTimerCatchUpTimeoutBindingsV1(
  timeout: TimerCatchUpBatchTimeoutV1,
): void {
  if (
    Date.parse(timeout.timed_out_at) < Date.parse(timeout.expected_deadline_at)
  ) {
    throw new TypeError("Timer catch-up batch cannot time out before deadline");
  }
}
