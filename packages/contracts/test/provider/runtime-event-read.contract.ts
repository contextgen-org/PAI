import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  RUNTIME_EVENT_READ_ERROR_CODES_V1,
  RuntimeDomainEventV1Schema,
  RuntimeEventReadContractV1Schema,
  RuntimeEventReadErrorV1Schema,
  RuntimeEventResolveRequestV1Schema,
} from "../../src/index.js";

const at = "2026-07-30T00:00:00.000Z";
const hash = `sha256:${"a".repeat(64)}`;

export const runtimeEventReadRequestFixtureV1 = Object.freeze({
  schema_version: "runtime_event_resolve_request.v1" as const,
  source_event_id: "event-1",
  payload_ref: "runtime_event:event-1",
  runtime_run_id: "run-1",
  trigger_process_id: "process-1",
  source_sequence_no: 1,
  expected_payload_hash: hash,
  workspace_id: "workspace-1",
  bot_id: "bot-1",
  owner_agent_id: "agent-1",
  deployment_environment: "dev" as const,
  release_channel: "stable" as const,
  purpose: "trigger_snapshot_append" as const,
  trace_id: "trace-1",
});

export const runtimeEventReadEventFixtureV1 = Object.freeze({
  event_id: "event-1",
  event_type: "runtime.run.started" as const,
  schema_version: "runtime_event.v1" as const,
  producer: "action_runtime" as const,
  occurred_at: at,
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
});

describe("RuntimeEventReadContractV1 provider contract", () => {
  it("publishes the exact request and owner response shapes", () => {
    expect(
      Value.Check(
        RuntimeEventResolveRequestV1Schema,
        runtimeEventReadRequestFixtureV1,
      ),
    ).toBe(true);
    const response = {
      schema_version: "runtime_event_read.v1",
      source_event_id: "event-1",
      payload_ref: "runtime_event:event-1",
      payload_hash: hash,
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
      resolved_at: at,
      trace_id: "trace-1",
    };
    expect(
      Value.Check(
        RuntimeEventReadContractV1Schema,
        [RuntimeDomainEventV1Schema],
        response,
      ),
    ).toBe(true);
    expect(
      Value.Check(
        RuntimeEventReadContractV1Schema,
        [RuntimeDomainEventV1Schema],
        { ...response, bucket: "private" },
      ),
    ).toBe(false);
    expect(
      Value.Check(RuntimeEventResolveRequestV1Schema, {
        ...runtimeEventReadRequestFixtureV1,
        source_sequence_no: Number.MAX_SAFE_INTEGER + 1,
      }),
    ).toBe(false);
  });

  it("keeps the six documented fail-closed errors as a closed set", () => {
    expect(RUNTIME_EVENT_READ_ERROR_CODES_V1).toHaveLength(6);
    for (const code of RUNTIME_EVENT_READ_ERROR_CODES_V1) {
      expect(
        Value.Check(RuntimeEventReadErrorV1Schema, {
          schema_version: "runtime_event_read_error.v1",
          code,
          message: code,
          retryable: false,
          trace_id: "trace-1",
          details: {
            source_event_id: "event-1",
            payload_ref: "runtime_event:event-1",
            runtime_run_id: "run-1",
            source_sequence_no: 1,
          },
        }),
      ).toBe(true);
    }
    expect(
      Value.Check(RuntimeEventReadErrorV1Schema, {
        schema_version: "runtime_event_read_error.v1",
        code: "database_unavailable",
        message: "unavailable",
        retryable: true,
        trace_id: "trace-1",
        details: {},
      }),
    ).toBe(false);
  });
});
