import {
  TriggerSubmitRequestV1Schema,
  TriggerSubmitResponseV1Schema,
} from "@pai/contracts";
import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

const occurrenceKey = `v1:${"a".repeat(43)}`;
const timerRequest = {
  workspace_id: "workspace-1",
  bot_id: "bot-1",
  owner_agent_id: "agent-1",
  deployment_environment: "dev",
  release_channel: "stable",
  source: "timer",
  actor_type: "system",
  actor_id: "timer_app",
  payload: {
    workspace_id: "workspace-1",
    bot_id: "bot-1",
    owner_agent_id: "agent-1",
    deployment_environment: "dev",
    release_channel: "stable",
    schedule_id: "schedule-1",
    schedule_version: 1,
    occurrence_id: "occurrence-1",
    local_date: "2026-07-22",
    local_time: "08:30:00",
    timezone: "Asia/Shanghai",
    scheduled_for: "2026-07-22T00:30:00.000Z",
    occurrence_key: occurrenceKey,
    message: "run",
    is_catch_up: false,
    catch_up_batch_id: null,
    missed_window_summary: null,
  },
  dedupe_key: `timer:${occurrenceKey}`,
} as const;

const gatewayRequestBase = {
  workspace_id: "workspace-1",
  bot_id: "bot-1",
  owner_agent_id: "agent-1",
  deployment_environment: "dev",
  release_channel: "stable",
  actor_type: "user",
  actor_id: "user-1",
  payload: { message: "continue" },
} as const;

const chatRequest = {
  ...gatewayRequestBase,
  source: "chat",
  dedupe_key: "chat:message-1",
} as const;

const notificationRequest = {
  ...gatewayRequestBase,
  source: "notification",
  dedupe_key: "notification:event-1",
} as const;

describe("TriggerSubmitRequestV1", () => {
  it("owns the canonical public request id and rejects server-owned fields", () => {
    expect(TriggerSubmitRequestV1Schema.$id).toBe(
      "urn:pai:trigger-processor:trigger-submit-request:v1",
    );
    for (const request of [chatRequest, notificationRequest, timerRequest]) {
      expect(Value.Check(TriggerSubmitRequestV1Schema, request)).toBe(true);
    }
    expect(
      Value.Check(TriggerSubmitRequestV1Schema, {
        ...timerRequest,
        trace_id: "caller-controlled",
      }),
    ).toBe(false);
    expect(
      Value.Check(TriggerSubmitRequestV1Schema, {
        ...chatRequest,
        actor_type: "system",
      }),
    ).toBe(false);
  });

  it("keeps accepted, rejected and duplicate outcomes inline with the request contract", () => {
    const accepted = {
      code: "trigger_accepted",
      message: "accepted",
      retryable: false,
      details: {
        trigger_id: "trigger-1",
        trigger_status: "accepted",
        trigger_process_id: "process-1",
        process_phase: "admission",
        process_status: "running",
        priority: "strong",
        action: "dispatch",
        duplicate_replayed: false,
      },
      trace_id: "trace-1",
    } as const;
    const rejected = {
      code: "trigger_rejected",
      message: "bot disabled",
      retryable: false,
      details: {
        trigger_id: "trigger-2",
        trigger_status: "rejected",
        trigger_process_id: null,
        process_phase: null,
        process_status: null,
        priority: "weak",
        action: "reject",
        reason_code: "bot_disabled",
        rejected_event_id: "event-2",
        duplicate_replayed: false,
      },
      trace_id: "trace-2",
    } as const;
    const duplicate = {
      code: "duplicate_replayed",
      message: "replayed",
      retryable: false,
      details: {
        trigger_id: "trigger-1",
        trigger_status: "accepted",
        trigger_process_id: "process-1",
        process_phase: "closed",
        process_status: "completed",
        priority: "strong",
        action: "duplicate_replay",
        duplicate_replayed: true,
      },
      trace_id: "trace-3",
    } as const;
    for (const response of [accepted, rejected, duplicate]) {
      expect(Value.Check(TriggerSubmitResponseV1Schema, response)).toBe(true);
    }
    expect(
      Value.Check(TriggerSubmitResponseV1Schema, {
        ...accepted,
        details: { ...accepted.details, action: "enqueue_weak" },
      }),
    ).toBe(false);
    expect(
      Value.Check(TriggerSubmitResponseV1Schema, {
        ...duplicate,
        details: { ...duplicate.details, duplicate_replayed: false },
      }),
    ).toBe(false);
    expect(
      Value.Check(TriggerSubmitResponseV1Schema, {
        ...rejected,
        details: { ...rejected.details, reason_code: "invented_reason" },
      }),
    ).toBe(false);
  });
});
