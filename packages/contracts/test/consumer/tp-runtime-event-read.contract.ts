import { describe, expect, it } from "vitest";

import {
  assertRuntimeEventReadBindingsV1,
  type RuntimeEventReadContractV1,
} from "../../src/index.js";

const runtimeEventReadRequestFixtureV1 = {
  schema_version: "runtime_event_resolve_request.v1" as const,
  source_event_id: "event-1",
  payload_ref: "runtime_event:event-1",
  runtime_run_id: "run-1",
  trigger_process_id: "process-1",
  source_sequence_no: 1,
  expected_payload_hash: `sha256:${"a".repeat(64)}` as const,
  workspace_id: "workspace-1",
  bot_id: "bot-1",
  owner_agent_id: "agent-1",
  deployment_environment: "dev" as const,
  release_channel: "stable" as const,
  purpose: "trigger_snapshot_append" as const,
  trace_id: "trace-1",
};

const runtimeEventReadEventFixtureV1 = {
  event_id: "event-1",
  event_type: "runtime.run.started" as const,
  schema_version: "runtime_event.v1" as const,
  producer: "action_runtime" as const,
  occurred_at: "2026-07-30T00:00:00.000Z",
  idempotency_key: "run-1:started",
  trace_id: "runtime-trace-1",
  payload: {
    trigger_process_id: "process-1",
    runtime_run_id: "run-1",
    sequence_no: 1,
    workspace_id: "workspace-1",
    bot_id: "bot-1",
    owner_agent_id: "agent-1",
    deployment_environment: "dev" as const,
    release_channel: "stable" as const,
    start_attempt_no: 1,
    start_fence_generation: 1,
    status: "running" as const,
    previous_status: "queued" as const,
    next_status: "running" as const,
    model: "claude-sonnet-4-20250514",
    reason: null,
    duration_ms: null,
    reason_code: null,
    error_summary: null,
    terminal_artifact_ref: null,
  },
};

const response: RuntimeEventReadContractV1 = {
  schema_version: "runtime_event_read.v1",
  source_event_id: "event-1",
  payload_ref: "runtime_event:event-1",
  payload_hash: runtimeEventReadRequestFixtureV1.expected_payload_hash,
  runtime_run_id: "run-1",
  trigger_process_id: "process-1",
  source_sequence_no: 1,
  workspace_id: "workspace-1",
  bot_id: "bot-1",
  owner_agent_id: "agent-1",
  deployment_environment: "dev",
  release_channel: "stable",
  purpose: "trigger_snapshot_append",
  runtime_event: runtimeEventReadEventFixtureV1,
  retention_until: "2026-08-30T00:00:00.000Z",
  redaction_state: "complete",
  resolved_at: "2026-07-30T00:00:00.000Z",
  trace_id: "trace-1",
};

describe("Trigger Processor consumer of RuntimeEventReadContractV1", () => {
  it("binds ref/hash/run/process/sequence/scope and owner payload identity", () => {
    expect(() =>
      assertRuntimeEventReadBindingsV1(
        runtimeEventReadRequestFixtureV1,
        response,
      ),
    ).not.toThrow();
    for (const drift of [
      { runtime_run_id: "run-other" },
      { source_sequence_no: 2 },
      { workspace_id: "workspace-other" },
      { payload_hash: `sha256:${"0".repeat(64)}` },
      { payload_ref: "runtime_event:event-other" },
    ] as const) {
      expect(() =>
        assertRuntimeEventReadBindingsV1(
          runtimeEventReadRequestFixtureV1,
          { ...response, ...drift },
        ),
      ).toThrow(/identity binding/u);
    }
  });
});
