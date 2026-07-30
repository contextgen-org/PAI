import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  ToolInvocationEventV1Schema,
  assertToolInvocationEventSemanticBindingsV1,
} from "../../src/action-runtime/tool-events.v1.js";

function requestedToolEventV1() {
  return {
    event_id: "runtime-event-1",
    event_type: "runtime.tool.requested" as const,
    schema_version: "runtime_event.v1" as const,
    producer: "action_runtime" as const,
    occurred_at: "2026-07-27T08:00:00.000Z",
    idempotency_key: "run-1:tool:call-1:requested",
    trace_id: "trace-1",
    payload: {
      trigger_process_id: "process-1",
      runtime_run_id: "run-1",
      sequence_no: 1,
      workspace_id: "workspace-1",
      bot_id: "bot-1",
      owner_agent_id: "owner-1",
      deployment_environment: "dev" as const,
      release_channel: "stable" as const,
      start_attempt_no: 1,
      start_fence_generation: 1,
      tool_invocation_id: "call-1",
      tool_name: "tool-a",
      status: "requested" as const,
      policy_snapshot_id: "policy-1",
      capability_token_id: "capability-1",
      input_ref: "artifact:call-1:input",
      output_ref: null,
      side_effect_status: "none" as const,
      downstream_idempotency_key: "run-1:call-1",
      external_response_ref: null,
      external_error_ref: null,
      duplicate_replayed: false,
      error: null,
      duration_ms: null,
      reason_code: null,
      error_summary: null,
      artifact_ref: null,
    },
  };
}

describe("ToolInvocationEventV1", () => {
  it("owns the exact safe requested projection", () => {
    const event = requestedToolEventV1();
    expect(Value.Check(ToolInvocationEventV1Schema, event)).toBe(true);
    expect(() =>
      assertToolInvocationEventSemanticBindingsV1(event),
    ).not.toThrow();
  });

  it("rejects an output projection before the tool has completed", () => {
    const event = requestedToolEventV1();
    const invalid = {
      ...event,
      payload: {
        ...event.payload,
        output_ref: "artifact:call-1:result",
        artifact_ref: "artifact:call-1:result",
      },
    };
    expect(Value.Check(ToolInvocationEventV1Schema, invalid)).toBe(true);
    expect(() =>
      assertToolInvocationEventSemanticBindingsV1(invalid),
    ).toThrow(/request facts/u);
  });
});
