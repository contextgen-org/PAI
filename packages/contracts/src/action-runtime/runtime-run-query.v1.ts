import { Type, type Static } from "@sinclair/typebox";

import { DeploymentEnvironmentV1Schema } from "../shared/deployment-environment.v1.js";
import { DurableEventEnvelopeV1Schema } from "../shared/durable-event-envelope.v1.js";
import { ReleaseChannelV1Schema } from "../shared/release-channel.v1.js";

const identifier = Type.String({ minLength: 1, maxLength: 512 });
const nullableIdentifier = Type.Union([identifier, Type.Null()]);
const nullableTimestamp = Type.Union([
  DurableEventEnvelopeV1Schema.properties.occurred_at,
  Type.Null(),
]);

export const RUNTIME_RUN_QUERY_STATUSES_V1 = [
  "queued",
  "running",
  "preempt_requested",
  "cancelling",
  "cancelled",
  "completed",
  "failed",
] as const;

export const RuntimeRunQueryStatusV1Schema = Type.Union(
  RUNTIME_RUN_QUERY_STATUSES_V1.map((status) => Type.Literal(status)),
);

export const RuntimeRunQueryDetailsV1Schema = Type.Object(
  {
    runtime_run: Type.Object(
      {
        runtime_run_id: identifier,
        trigger_process_id: identifier,
        workspace_id: identifier,
        bot_id: identifier,
        owner_agent_id: identifier,
        deployment_environment: DeploymentEnvironmentV1Schema,
        release_channel: ReleaseChannelV1Schema,
        status: RuntimeRunQueryStatusV1Schema,
        start_attempt_no: Type.Integer({
          minimum: 1,
          maximum: Number.MAX_SAFE_INTEGER,
        }),
        policy_snapshot_id: identifier,
        requested_catalog_version: identifier,
        effective_catalog_version: nullableIdentifier,
        created_at: DurableEventEnvelopeV1Schema.properties.occurred_at,
        started_at: nullableTimestamp,
        completed_at: nullableTimestamp,
        terminal_reason: nullableIdentifier,
      },
      { additionalProperties: false },
    ),
  },
  {
    $id: "urn:pai:action-runtime:runtime-run-query:v1",
    additionalProperties: false,
  },
);

export type RuntimeRunQueryStatusV1 = Static<
  typeof RuntimeRunQueryStatusV1Schema
>;
export type RuntimeRunQueryDetailsV1 = Static<
  typeof RuntimeRunQueryDetailsV1Schema
>;

export function assertRuntimeRunQueryDetailsSemanticBindingsV1(
  details: RuntimeRunQueryDetailsV1,
): void {
  const run = details.runtime_run;
  const terminal = new Set<RuntimeRunQueryStatusV1>([
    "cancelled",
    "completed",
    "failed",
  ]).has(run.status);
  const started = run.status !== "queued";
  if (
    terminal !== (run.completed_at !== null) ||
    terminal !== (run.terminal_reason !== null) ||
    started !== (run.started_at !== null) ||
    (run.effective_catalog_version === null && started) ||
    Date.parse(run.created_at) >
      Date.parse(run.started_at ?? run.completed_at ?? run.created_at) ||
    (run.started_at !== null &&
      run.completed_at !== null &&
      Date.parse(run.started_at) > Date.parse(run.completed_at))
  ) {
    throw new Error("RuntimeRunQueryDetailsV1 semantic binding mismatch");
  }
}
