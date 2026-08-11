import { Type, type Static } from "@sinclair/typebox";

import {
  TriggerProcessorBotScopeV1Properties,
  TriggerProcessorIdentifierV1Schema,
  TriggerProcessorSha256V1Schema,
  TriggerProcessorUtcTimestampV1Schema,
} from "../trigger-processor/index-internal.v1.js";

/**
 * The only cross-owner representation of a Runtime's textual terminal
 * artifact.  The object reference is retained for audit binding, but the
 * browser never receives an ObjectStore grant or a storage URL.
 */
export const RuntimeFinalResultReadContractV1Schema = Type.Object(
  {
    schema_version: Type.Literal("runtime_final_result_read.v1"),
    runtime_run_id: TriggerProcessorIdentifierV1Schema,
    trigger_process_id: TriggerProcessorIdentifierV1Schema,
    ...TriggerProcessorBotScopeV1Properties,
    artifact_ref: TriggerProcessorIdentifierV1Schema,
    content_hash: TriggerProcessorSha256V1Schema,
    retention_until: TriggerProcessorUtcTimestampV1Schema,
    content_type: Type.Literal("text/plain"),
    content: Type.String({ minLength: 1, maxLength: 1_048_576 }),
    trace_id: TriggerProcessorIdentifierV1Schema,
  },
  {
    $id: "urn:pai:action-runtime:runtime-final-result-read:v1",
    additionalProperties: false,
  },
);

export type RuntimeFinalResultReadContractV1 = Static<
  typeof RuntimeFinalResultReadContractV1Schema
>;

export function assertRuntimeFinalResultReadBindingsV1(
  request: Readonly<{
    runtime_run_id: string;
    workspace_id: string;
    bot_id: string;
    owner_agent_id: string;
    deployment_environment: "local" | "dev" | "staging" | "prod";
    release_channel: "stable" | "canary";
    trace_id: string;
  }>,
  response: RuntimeFinalResultReadContractV1,
): void {
  if (
    response.runtime_run_id !== request.runtime_run_id ||
    response.workspace_id !== request.workspace_id ||
    response.bot_id !== request.bot_id ||
    response.owner_agent_id !== request.owner_agent_id ||
    response.deployment_environment !== request.deployment_environment ||
    response.release_channel !== request.release_channel ||
    response.trace_id !== request.trace_id ||
    !Number.isFinite(Date.parse(response.retention_until)) ||
    response.content.length === 0
  ) {
    throw new Error("Runtime final result read binding mismatch");
  }
}
