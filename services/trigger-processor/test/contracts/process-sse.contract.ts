import {
  TriggerProcessSummaryV1Schema,
  TriggerProcessSseEventV1Schema,
  TriggerProcessSseRequestV1Schema,
  assertTriggerProcessSummaryBindingsV1,
  assertTriggerProcessSummarySemanticBindingsV1,
  assertTriggerProcessSseEventSemanticBindingsV1,
  parseTriggerProcessSseCursorV1,
  triggerProcessSseEventIdV1,
} from "@pai/contracts";
import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

export const runtimeSseEventFixtureV1 = {
  schema_version: "trigger_process_sse_event.v1",
  trigger_process_id: "tp-1",
  append_sequence_no: 57,
  event_type: "runtime.tool.completed",
  occurred_at: "2026-07-13T12:00:03.000Z",
  trace_id: "trace-tool-1",
  observation_summary: {
    tool_invocation_id: "tool-1",
    tool_name: "lark.im.send_message",
    status: "completed",
    duration_ms: 814,
    reason_code: null,
    error_summary: null,
    artifact_ref: "artifact:tool-1",
  },
} as const;

describe("Trigger Process SSE contract", () => {
  it("uses the path process and append sequence as its sole event identity", () => {
    expect(Value.Check(TriggerProcessSseEventV1Schema, runtimeSseEventFixtureV1)).toBe(true);
    expect(triggerProcessSseEventIdV1(runtimeSseEventFixtureV1)).toBe("tp-1:57");
    expect(
      Value.Check(TriggerProcessSseEventV1Schema, {
        ...runtimeSseEventFixtureV1,
        sequence_no: 57,
      }),
    ).toBe(false);
    expect(
      Value.Check(TriggerProcessSseEventV1Schema, {
        ...runtimeSseEventFixtureV1,
        append_sequence_no: 0,
      }),
    ).toBe(false);
    expect(
      Value.Check(TriggerProcessSseEventV1Schema, {
        ...runtimeSseEventFixtureV1,
        event_type: "runtime.tool.failed",
      }),
    ).toBe(false);
    expect(
      Value.Check(TriggerProcessSseEventV1Schema, {
        ...runtimeSseEventFixtureV1,
        event_type: "runtime.run.completed",
      }),
    ).toBe(false);
  });

  it("projects a durable source-gap marker without pretending it is a Runtime event", () => {
    const marker = {
      schema_version: "trigger_process_sse_event.v1",
      trigger_process_id: "tp-1",
      append_sequence_no: 58,
      event_type: "snapshot_gap_skipped",
      occurred_at: "2026-07-13T12:00:04.000Z",
      trace_id: "trace-gap-1",
      observation_summary: {
        source_service: "action_runtime",
        missing_source_sequence_range: {
          first_source_sequence_no: 4,
          last_source_sequence_no: 7,
        },
        last_contiguous_source_sequence_no: 3,
        source_ref: "runtime-run:run-1",
        repair_status: "pending",
      },
    } as const;
    expect(Value.Check(TriggerProcessSseEventV1Schema, marker)).toBe(true);
    expect(() =>
      assertTriggerProcessSseEventSemanticBindingsV1(marker),
    ).not.toThrow();
    expect(() =>
      assertTriggerProcessSseEventSemanticBindingsV1({
        ...marker,
        observation_summary: {
          ...marker.observation_summary,
          last_contiguous_source_sequence_no: 2,
        },
      }),
    ).toThrow(/gap marker/u);
  });

  it("projects the complete TP observation allowlist with exact process bindings", () => {
    const common = {
      schema_version: "trigger_process_sse_event.v1" as const,
      trigger_process_id: "tp-1",
      occurred_at: "2026-07-13T12:00:04.000Z",
      trace_id: "trace-tp-1",
    };
    const events = [
      {
        ...common,
        append_sequence_no: 59,
        event_type: "trigger.accepted",
        observation_summary: {
          trigger_id: "trigger-1",
          trigger_process_id: "tp-1",
          admission_outcome: "accepted",
          priority: "strong",
          dedupe_key: "dedupe-1",
          request_hash: "request-hash-1",
          reason_code: "admission_accepted",
          source_ref: "trigger_event:submit-1",
        },
      },
      {
        ...common,
        append_sequence_no: 60,
        event_type: "trigger_process.phase_changed",
        observation_summary: {
          trigger_process_id: "tp-1",
          previous_state: {
            phase: "context",
            status: "running",
            wait_reason: null,
            terminal_reason: null,
          },
          next_state: {
            phase: "intent",
            status: "running",
            wait_reason: null,
            terminal_reason: null,
          },
          expected_state_version: 3,
          transition_id: "transition-1",
          reason_code: "context_composed",
          source_ref: "trigger_event:transition-1",
        },
      },
      {
        ...common,
        append_sequence_no: 61,
        event_type: "trigger_process.user_message_retracted",
        observation_summary: {
          trigger_process_id: "tp-1",
          source_message_ref: "trigger_event:message-1",
          boundary_system_event_ref: "system_event:event-1",
          reason_code: "user_retracted",
          source_ref: "trigger_event:transition-2",
        },
      },
      {
        ...common,
        append_sequence_no: 62,
        event_type: "weak_trigger.merged",
        observation_summary: {
          weak_group_id: "weak-group-1",
          canonical_process_id: "tp-canonical",
          merged_process_ids: ["tp-1"],
          merge_window_started_at: "2026-07-13T11:59:00.000Z",
          reason_code: "weak_group_merged",
          source_ref: "trigger_event:weak-group-1",
        },
      },
      {
        ...common,
        append_sequence_no: 63,
        event_type: "trigger_process.system_interrupted",
        observation_summary: {
          trigger_process_id: "tp-1",
          boundary_system_event_ref: "system_event:event-2",
          interrupt_source: "operator",
          reason_code: "system_interrupted",
          source_ref: "trigger_event:transition-3",
        },
      },
    ] as const;
    for (const event of events) {
      expect(Value.Check(TriggerProcessSseEventV1Schema, event)).toBe(true);
      expect(() =>
        assertTriggerProcessSseEventSemanticBindingsV1(event),
      ).not.toThrow();
    }
    expect(() =>
      assertTriggerProcessSseEventSemanticBindingsV1({
        ...events[2],
        observation_summary: {
          ...events[2].observation_summary,
          trigger_process_id: "tp-other",
        },
      }),
    ).toThrow(/process binding/u);
  });

  it("validates a summary as a non-durable owner control frame", () => {
    const summary = {
      schema_version: "trigger_process_sse_event.v1",
      trigger_process_id: "tp-1",
      append_sequence_no: 63,
      event_type: "trigger_process.summary",
      occurred_at: "2026-07-13T12:00:05.000Z",
      trace_id: "trace-summary-1",
      observation_summary: {
        phase: "closed",
        status: "completed",
        reason_code: "execution_completed",
        terminal_outcome: "executed",
        terminal_outcome_finalized_at: "2026-07-13T12:00:05.000Z",
        observation_finalized: true,
      },
    } as const;
    expect(Value.Check(TriggerProcessSummaryV1Schema, summary)).toBe(true);
    expect(() =>
      assertTriggerProcessSummarySemanticBindingsV1(summary),
    ).not.toThrow();
    expect(() =>
      assertTriggerProcessSummaryBindingsV1(summary, {
        trigger_process_id: "tp-1",
        minimum_append_sequence_no: 63,
      }),
    ).not.toThrow();
    expect(() =>
      assertTriggerProcessSummarySemanticBindingsV1({
        ...summary,
        observation_summary: {
          ...summary.observation_summary,
          reason_code: "weak_group_merged",
          terminal_outcome: null,
          terminal_outcome_finalized_at: null,
          observation_finalized: false,
        },
      }),
    ).not.toThrow();
    expect(() =>
      assertTriggerProcessSummarySemanticBindingsV1({
        ...summary,
        observation_summary: {
          ...summary.observation_summary,
          status: "failed",
        },
      }),
    ).toThrow(/terminal binding/u);
    expect(() =>
      assertTriggerProcessSummarySemanticBindingsV1({
        ...summary,
        observation_summary: {
          ...summary.observation_summary,
          terminal_outcome_finalized_at: null,
        },
      }),
    ).toThrow(/semantic binding/u);
    expect(() =>
      assertTriggerProcessSummaryBindingsV1(summary, {
        trigger_process_id: "tp-other",
        minimum_append_sequence_no: 63,
      }),
    ).toThrow(/owner binding/u);
    expect(() =>
      assertTriggerProcessSummaryBindingsV1(summary, {
        trigger_process_id: "tp-1",
        minimum_append_sequence_no: 64,
      }),
    ).toThrow(/owner binding/u);
  });

  it("accepts exactly one replay cursor and rejects process drift", () => {
    const byHeader = {
      schema_version: "trigger_process_sse_request.v1",
      trigger_process_id: "tp-1",
      last_event_id: "tp-1:57",
    } as const;
    expect(Value.Check(TriggerProcessSseRequestV1Schema, byHeader)).toBe(true);
    expect(parseTriggerProcessSseCursorV1(byHeader)).toBe(57);
    expect(() =>
      parseTriggerProcessSseCursorV1({
        ...byHeader,
        start_after_append_sequence_no: 57,
      }),
    ).toThrow("invalid_replay_cursor");
    expect(() =>
      parseTriggerProcessSseCursorV1({
        ...byHeader,
        last_event_id: "tp-other:57",
      }),
    ).toThrow("invalid_replay_cursor");
  });
});
