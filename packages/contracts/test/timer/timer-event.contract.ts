import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  TIMER_AUDIT_ONLY_EVENT_TYPES_V1,
  TIMER_DURABLE_EVENT_CONSUMERS_V1,
  TIMER_DURABLE_EVENT_PAYLOAD_SCHEMAS_V1,
  TIMER_DURABLE_EVENT_TYPES_V1,
  TimerEventEnvelopeV1Schema,
  assertTimerEventEnvelopeBindingsV1,
} from "../../src/timer/timer-event.v1.js";
import { freezeTimerCatchUpPolicyV1 } from "../../src/timer/catch-up-batch.v1.js";

const identity = {
  workspace_id: "workspace-1",
  bot_id: "bot-1",
  owner_agent_id: "agent-1",
  deployment_environment: "dev",
  release_channel: "stable",
} as const;

function base(eventType: string) {
  return {
    event_id: "event-1",
    schema_version: "timer.event.v1",
    producer: "timer_trigger_app",
    occurred_at: "2026-07-30T10:00:00.000Z",
    idempotency_key: "event-key-1",
    trace_id: "trace-1",
    event_type: eventType,
  };
}

describe("TimerEventEnvelopeV1", () => {
  it("keeps durable and audit-only event sets disjoint and closed", () => {
    expect(
      TIMER_DURABLE_EVENT_TYPES_V1.some((eventType) =>
        TIMER_AUDIT_ONLY_EVENT_TYPES_V1.includes(eventType as never),
      ),
    ).toBe(false);
    expect(TIMER_DURABLE_EVENT_TYPES_V1).not.toContain(
      "timer.catch_up.timeout",
    );
    expect(TIMER_DURABLE_EVENT_TYPES_V1).not.toContain(
      "timer.schedule.snoozed",
    );
    expect(Object.keys(TIMER_DURABLE_EVENT_PAYLOAD_SCHEMAS_V1)).toEqual(
      TIMER_DURABLE_EVENT_TYPES_V1,
    );
    expect(Object.keys(TIMER_DURABLE_EVENT_CONSUMERS_V1)).toEqual(
      TIMER_DURABLE_EVENT_TYPES_V1,
    );
    expect(
      Object.values(TIMER_DURABLE_EVENT_CONSUMERS_V1).every(
        (consumers) => consumers.length === 0,
      ),
    ).toBe(true);
  });

  it("couples schedule event types to exact previous/next statuses", () => {
    const event = {
      ...base("timer.schedule.paused"),
      event_type: "timer.schedule.paused",
      payload: {
        ...identity,
        aggregate_id: "schedule-1",
        schedule_id: "schedule-1",
        schedule_version: 2,
        previous_status: "active",
        next_status: "paused",
        reason_code: "user_paused",
      },
    } as const;
    expect(Value.Check(TimerEventEnvelopeV1Schema, event)).toBe(true);
    expect(() => assertTimerEventEnvelopeBindingsV1(event)).not.toThrow();
    expect(() =>
      assertTimerEventEnvelopeBindingsV1({
        ...event,
        payload: { ...event.payload, next_status: "active" },
      }),
    ).toThrow(/transition binding/u);
  });

  it("owns snooze as an occurrence event with versioned fire-time facts", () => {
    const event = {
      ...base("timer.occurrence.snoozed"),
      event_type: "timer.occurrence.snoozed",
      payload: {
        ...identity,
        aggregate_id: "occurrence-1",
        schedule_id: "schedule-1",
        schedule_version: 2,
        occurrence_id: "occurrence-1",
        occurrence_version: 3,
        scheduled_fire_at: "2026-07-30T10:00:00.000Z",
        previous_effective_fire_at: "2026-07-30T10:00:00.000Z",
        effective_fire_at: "2026-07-30T10:30:00.000Z",
        reason_code: "user_snoozed",
      },
    } as const;
    expect(Value.Check(TimerEventEnvelopeV1Schema, event)).toBe(true);
    expect(() => assertTimerEventEnvelopeBindingsV1(event)).not.toThrow();
    expect(
      Value.Check(TimerEventEnvelopeV1Schema, {
        ...event,
        event_type: "timer.schedule.snoozed",
      }),
    ).toBe(false);
  });

  it("freezes full catch-up policy and rejects forged schedule status fields", () => {
    const event = {
      ...base("timer.catch_up.batch_created"),
      event_type: "timer.catch_up.batch_created",
      payload: {
        ...identity,
        aggregate_id: "batch-1",
        catch_up_batch_id: "batch-1",
        window_start: "2026-07-30T08:00:00.000Z",
        window_end: "2026-07-30T09:59:00.000Z",
        occurrence_count: 2,
        deadline_at: "2026-07-30T10:05:00.000Z",
        policy_snapshot: freezeTimerCatchUpPolicyV1({}, "config-1"),
      },
    } as const;
    expect(Value.Check(TimerEventEnvelopeV1Schema, event)).toBe(true);
    expect(() => assertTimerEventEnvelopeBindingsV1(event)).not.toThrow();
    expect(
      Value.Check(TimerEventEnvelopeV1Schema, {
        ...event,
        payload: {
          ...event.payload,
          previous_status: "active",
          next_status: "paused",
        },
      }),
    ).toBe(false);
  });
});
