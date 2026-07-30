import { Type } from "@sinclair/typebox";

import {
  TriggerProcessorControlTokenV1Schema,
  TriggerProcessorIdentifierV1Schema,
  TriggerProcessorPositiveVersionV1Schema,
  TriggerProcessorReasonCodeV1Schema,
  TriggerProcessorTimestampV1Schema,
} from "../trigger-processor/index-internal.v1.js";

export function runtimeControlRequestV1Schema<const TType extends string>(
  controlType: TType,
) {
  return Type.Object(
    {
      schema_version: Type.Literal(`runtime_${controlType}.v1`),
      runtime_signal_id: TriggerProcessorIdentifierV1Schema,
      runtime_run_id: TriggerProcessorIdentifierV1Schema,
      trigger_process_id: TriggerProcessorIdentifierV1Schema,
      start_attempt_no: TriggerProcessorPositiveVersionV1Schema,
      preempt_token: TriggerProcessorControlTokenV1Schema,
      reason_code: TriggerProcessorReasonCodeV1Schema,
      requested_at: TriggerProcessorTimestampV1Schema,
      idempotency_key: TriggerProcessorIdentifierV1Schema,
      trace_id: TriggerProcessorIdentifierV1Schema,
    },
    { additionalProperties: false },
  );
}
