import { Type, type Static } from "@sinclair/typebox";

import {
  RuntimeCancelContractV1Schema,
  RuntimePreemptContractV1Schema,
  RuntimeUserRetractContractV1Schema,
} from "../action-runtime/runtime-control.v1.js";
import { RuntimeStartRequestV1Schema } from "../action-runtime/runtime-start.v1.js";
import { MetaFeedbackAnswerRequestV1Schema } from "../meta/feedback-answer.v1.js";
import { MetaJobCreateRequestV1Schema } from "../meta/meta-job-create.v1.js";
import { MetaSnapshotRepairRequestV1Schema } from "../meta/snapshot-repair-request.v1.js";
import { ServiceIdV1Schema } from "../shared/service-id.v1.js";
import {
  TriggerProcessorIdentifierV1Schema,
  TriggerProcessorSha256V1Schema,
} from "./contract-primitives.v1.js";

function commandEnvelope<TType extends string, TTarget extends string>(
  commandType: TType,
  target: TTarget,
  payload: Parameters<typeof Type.Object>[0][string],
) {
  return Type.Object(
    {
      command_id: TriggerProcessorIdentifierV1Schema,
      aggregate_id: TriggerProcessorIdentifierV1Schema,
      command_type: Type.Literal(commandType),
      schema_version: Type.Literal("trigger_processor_command.v1"),
      producer: Type.Literal("trigger_processor"),
      target: Type.Literal(target),
      idempotency_key: TriggerProcessorIdentifierV1Schema,
      request_hash: TriggerProcessorSha256V1Schema,
      trace_id: TriggerProcessorIdentifierV1Schema,
      payload,
    },
    { additionalProperties: false },
  );
}

export const TriggerProcessorCommandV1Schema = Type.Union(
  [
    commandEnvelope(
      "runtime.start",
      "action_runtime",
      RuntimeStartRequestV1Schema,
    ),
    commandEnvelope(
      "runtime.cancel",
      "action_runtime",
      RuntimeCancelContractV1Schema,
    ),
    commandEnvelope(
      "runtime.preempt",
      "action_runtime",
      RuntimePreemptContractV1Schema,
    ),
    commandEnvelope(
      "runtime.user_retract",
      "action_runtime",
      RuntimeUserRetractContractV1Schema,
    ),
    commandEnvelope(
      "meta.job.create",
      "meta_cognition",
      MetaJobCreateRequestV1Schema,
    ),
    commandEnvelope(
      "meta.snapshot_repair",
      "meta_cognition",
      MetaSnapshotRepairRequestV1Schema,
    ),
    commandEnvelope(
      "meta.feedback_answer",
      "meta_cognition",
      MetaFeedbackAnswerRequestV1Schema,
    ),
  ],
  { $id: "urn:pai:trigger-processor:command:v1" },
);

export const TriggerProcessorCommandTargetV1Schema = ServiceIdV1Schema;

export type TriggerProcessorCommandV1 = Static<
  typeof TriggerProcessorCommandV1Schema
>;

export const TRIGGER_PROCESSOR_COMMAND_V1_DATABASE_CHECK = `CHECK (
  schema_version = 'trigger_processor_command.v1'
  AND producer = 'trigger_processor'
  AND jsonb_typeof(payload) = 'object'
  AND (
    (command_type = 'runtime.start' AND target = 'action_runtime' AND payload->>'schema_version' = 'runtime_start.v1.2')
    OR (command_type = 'runtime.cancel' AND target = 'action_runtime' AND payload->>'schema_version' = 'runtime_cancel.v1')
    OR (command_type = 'runtime.preempt' AND target = 'action_runtime' AND payload->>'schema_version' = 'runtime_preempt.v1')
    OR (command_type = 'runtime.user_retract' AND target = 'action_runtime' AND payload->>'schema_version' = 'runtime_user_retract.v1')
    OR (command_type = 'meta.job.create' AND target = 'meta_cognition' AND payload->>'schema_version' = 'meta_job_create.v1')
    OR (command_type = 'meta.snapshot_repair' AND target = 'meta_cognition' AND payload->>'schema_version' = 'meta_snapshot_repair.v1')
    OR (command_type = 'meta.feedback_answer' AND target = 'meta_cognition' AND payload->>'schema_version' = 'meta_feedback_answer.v1')
  )
)`;
