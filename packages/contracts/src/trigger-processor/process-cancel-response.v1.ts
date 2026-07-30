import { Type, type Static } from "@sinclair/typebox";

import {
  TriggerProcessorIdentifierV1Schema,
  TriggerProcessorReasonCodeV1Schema,
  TriggerProcessorTimestampV1Schema,
} from "./contract-primitives.v1.js";

const cancellationDetailsBase = {
  trigger_process_id: TriggerProcessorIdentifierV1Schema,
  idempotency_key: TriggerProcessorIdentifierV1Schema,
} as const;

export const TriggerProcessCancelResponseV1Schema = Type.Union(
  [
    Type.Object(
      {
        code: Type.Literal("cancel_accepted"),
        message: Type.String({ minLength: 1, maxLength: 4_096 }),
        retryable: Type.Literal(false),
        trace_id: TriggerProcessorIdentifierV1Schema,
        details: Type.Object(
          {
            ...cancellationDetailsBase,
            duplicate_replayed: Type.Literal(false),
            phase: Type.Literal("closed"),
            status: Type.Literal("cancelled"),
            cancellation_status: Type.Literal("completed"),
            cancel_requested_at: TriggerProcessorTimestampV1Schema,
            runtime_signal_id: Type.Null(),
          },
          { additionalProperties: false },
        ),
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        code: Type.Literal("cancel_replayed"),
        message: Type.String({ minLength: 1, maxLength: 4_096 }),
        retryable: Type.Literal(false),
        trace_id: TriggerProcessorIdentifierV1Schema,
        details: Type.Object(
          {
            ...cancellationDetailsBase,
            duplicate_replayed: Type.Literal(true),
            phase: Type.Literal("closed"),
            status: Type.Literal("cancelled"),
            cancellation_status: Type.Literal("completed"),
            cancel_requested_at: TriggerProcessorTimestampV1Schema,
            runtime_signal_id: Type.Null(),
          },
          { additionalProperties: false },
        ),
      },
      { additionalProperties: false },
    ),
    ...(["cancel_pending", "cancel_replayed"] as const).map((code) =>
      Type.Object(
        {
          code: Type.Literal(code),
          message: Type.String({ minLength: 1, maxLength: 4_096 }),
          retryable: Type.Literal(false),
          trace_id: TriggerProcessorIdentifierV1Schema,
          details: Type.Object(
            {
              ...cancellationDetailsBase,
              duplicate_replayed: Type.Literal(code === "cancel_replayed"),
              phase: Type.Literal("execution"),
              status: Type.Literal("cancelling"),
              cancellation_status: Type.Literal("pending"),
              cancel_requested_at: TriggerProcessorTimestampV1Schema,
              runtime_signal_id: TriggerProcessorIdentifierV1Schema,
            },
            { additionalProperties: false },
          ),
        },
        { additionalProperties: false },
      ),
    ),
    Type.Object(
      {
        code: Type.Literal("not_cancellable"),
        message: Type.String({ minLength: 1, maxLength: 4_096 }),
        retryable: Type.Literal(false),
        trace_id: TriggerProcessorIdentifierV1Schema,
        details: Type.Object(
          {
            trigger_process_id: TriggerProcessorIdentifierV1Schema,
            phase: Type.Union([
              Type.Literal("meta_enqueued"),
              Type.Literal("closed"),
            ]),
            status: Type.Union([
              Type.Literal("waiting"),
              Type.Literal("completed"),
              Type.Literal("failed"),
              Type.Literal("preempted"),
              Type.Literal("cancelled"),
            ]),
            terminal_reason: Type.Union([
              TriggerProcessorReasonCodeV1Schema,
              Type.Null(),
            ]),
            terminal_event_id: Type.Union([
              TriggerProcessorIdentifierV1Schema,
              Type.Null(),
            ]),
          },
          { additionalProperties: false },
        ),
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        code: Type.Literal("idempotency_conflict"),
        message: Type.String({ minLength: 1, maxLength: 4_096 }),
        retryable: Type.Literal(false),
        trace_id: TriggerProcessorIdentifierV1Schema,
        details: Type.Object(
          {
            trigger_process_id: TriggerProcessorIdentifierV1Schema,
            idempotency_key: TriggerProcessorIdentifierV1Schema,
          },
          { additionalProperties: false },
        ),
      },
      { additionalProperties: false },
    ),
  ],
  { $id: "urn:pai:trigger-processor:process-cancel-response:v1" },
);

export type TriggerProcessCancelResponseV1 = Static<
  typeof TriggerProcessCancelResponseV1Schema
>;
