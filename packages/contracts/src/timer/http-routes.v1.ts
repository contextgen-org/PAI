import { Type, type Static } from "@sinclair/typebox";

import {
  TimerCatchUpBatchV1Schema,
} from "./catch-up-batch.v1.js";
import {
  TimerOccurrenceClaimV1Schema,
  TimerOccurrenceV1Schema,
} from "./occurrence.v1.js";
import {
  TimerIdentifierV1Schema,
  TimerPositiveVersionV1Schema,
} from "./primitives.v1.js";
import { TimerScheduleCursorV1Schema } from "./schedule-query-response.v1.js";

export const TimerIdPathParamsV1Schema = Type.Object(
  { id: TimerIdentifierV1Schema },
  {
    additionalProperties: false,
    $id: "urn:pai:timer:http:id-path-params:v1",
  },
);

const queryBase = {
  runtime_run_id: TimerIdentifierV1Schema,
  trace_id: TimerIdentifierV1Schema,
} as const;

export const TimerScheduleListQueryParamsV1Schema = Type.Object(
  {
    ...queryBase,
    status: Type.Optional(
      Type.Union([
        Type.Literal("active"),
        Type.Literal("paused"),
        Type.Literal("cancelled"),
        Type.Literal("completed"),
        Type.Literal("expired"),
        Type.Literal("failed"),
      ]),
    ),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
    cursor: Type.Optional(TimerScheduleCursorV1Schema),
  },
  {
    additionalProperties: false,
    $id: "urn:pai:timer:http:schedule-list-query:v1",
  },
);

export const TimerScheduleReadQueryParamsV1Schema = Type.Object(
  queryBase,
  {
    additionalProperties: false,
    $id: "urn:pai:timer:http:schedule-read-query:v1",
  },
);

export const TimerScheduleHistoryQueryParamsV1Schema = Type.Object(
  {
    ...queryBase,
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
    cursor: Type.Optional(TimerScheduleCursorV1Schema),
  },
  {
    additionalProperties: false,
    $id: "urn:pai:timer:http:schedule-history-query:v1",
  },
);

export const TimerScanDueRequestV1Schema = Type.Object(
  {
    worker_id: TimerIdentifierV1Schema,
    checkpoint_id: TimerIdentifierV1Schema,
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
    trace_id: TimerIdentifierV1Schema,
  },
  {
    additionalProperties: false,
    $id: "urn:pai:timer:http:scan-due-request:v1",
  },
);

export const TimerScanDueResponseV1Schema = Type.Object(
  {
    code: Type.Literal("timer_scan_completed"),
    occurrences: Type.Array(TimerOccurrenceV1Schema, {
      maxItems: 100,
      uniqueItems: true,
    }),
    trace_id: TimerIdentifierV1Schema,
  },
  {
    additionalProperties: false,
    $id: "urn:pai:timer:http:scan-due-response:v1",
  },
);

export const TimerOccurrenceClaimRequestV1Schema = Type.Object(
  {
    expected_occurrence_version: TimerPositiveVersionV1Schema,
    expected_schedule_version: TimerPositiveVersionV1Schema,
    expected_status: Type.Union([
      Type.Literal("pending"),
      Type.Literal("retry_wait"),
      Type.Literal("dispatching"),
    ]),
    worker_id: TimerIdentifierV1Schema,
    lease_seconds: Type.Optional(
      Type.Integer({ minimum: 1, maximum: 300 }),
    ),
  },
  {
    additionalProperties: false,
    $id: "urn:pai:timer:http:occurrence-claim-request:v1",
  },
);

export const TimerOccurrenceClaimResponseV1Schema =
  TimerOccurrenceClaimV1Schema;

export const TimerCatchUpCreateRequestV1Schema = Type.Object(
  {
    occurrence_ids: Type.Array(TimerIdentifierV1Schema, {
      minItems: 1,
      maxItems: 100,
      uniqueItems: true,
    }),
    trace_id: TimerIdentifierV1Schema,
  },
  {
    additionalProperties: false,
    $id: "urn:pai:timer:http:catch-up-create-request:v1",
  },
);

export const TimerCatchUpCreateResponseV1Schema = TimerCatchUpBatchV1Schema;

export const TimerCatchUpAdvanceRequestV1Schema = Type.Object(
  {
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
    trace_id: TimerIdentifierV1Schema,
  },
  {
    additionalProperties: false,
    $id: "urn:pai:timer:http:catch-up-advance-request:v1",
  },
);

export const TimerCatchUpAdvanceResponseV1Schema = Type.Object(
  {
    schema_version: Type.Literal("timer.catch_up_advance_response.v1"),
    batch: TimerCatchUpBatchV1Schema,
    outcome: Type.Union([
      Type.Literal("ready"),
      Type.Literal("waiting"),
      Type.Literal("completed"),
      Type.Literal("timed_out"),
    ]),
    occurrence: Type.Union([TimerOccurrenceV1Schema, Type.Null()]),
  },
  {
    additionalProperties: false,
    $id: "urn:pai:timer:http:catch-up-advance-response:v1",
  },
);

export type TimerIdPathParamsV1 = Static<
  typeof TimerIdPathParamsV1Schema
>;
export type TimerScheduleListQueryParamsV1 = Static<
  typeof TimerScheduleListQueryParamsV1Schema
>;
export type TimerScheduleReadQueryParamsV1 = Static<
  typeof TimerScheduleReadQueryParamsV1Schema
>;
export type TimerScheduleHistoryQueryParamsV1 = Static<
  typeof TimerScheduleHistoryQueryParamsV1Schema
>;
export type TimerScanDueRequestV1 = Static<
  typeof TimerScanDueRequestV1Schema
>;
export type TimerScanDueResponseV1 = Static<
  typeof TimerScanDueResponseV1Schema
>;
export type TimerOccurrenceClaimRequestV1 = Static<
  typeof TimerOccurrenceClaimRequestV1Schema
>;
export type TimerOccurrenceClaimResponseV1 = Static<
  typeof TimerOccurrenceClaimResponseV1Schema
>;
export type TimerCatchUpCreateRequestV1 = Static<
  typeof TimerCatchUpCreateRequestV1Schema
>;
export type TimerCatchUpCreateResponseV1 = Static<
  typeof TimerCatchUpCreateResponseV1Schema
>;
export type TimerCatchUpAdvanceRequestV1 = Static<
  typeof TimerCatchUpAdvanceRequestV1Schema
>;
export type TimerCatchUpAdvanceResponseV1 = Static<
  typeof TimerCatchUpAdvanceResponseV1Schema
>;

export function assertTimerCatchUpAdvanceRequestBindingsV1(
  request: TimerCatchUpAdvanceRequestV1,
): void {
  if (
    (request.expected_last_occurrence_id === null) !==
    (request.expected_last_trigger_process_id === null) ||
    (request.expected_cursor_occurrence_id === null &&
      request.expected_last_occurrence_id !== null)
  ) {
    throw new TypeError(
      "Timer catch-up HTTP continuation tuple is inconsistent",
    );
  }
}
