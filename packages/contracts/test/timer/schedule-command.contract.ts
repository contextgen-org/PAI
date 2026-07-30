import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  TimerErrorV1Schema,
  TimerScheduleCommandResponseV1Schema,
  TimerScheduleCommandV1Schema,
  assertTimerErrorHttpBindingV1,
  assertTimerScheduleCommandBindingsV1,
  timerCommandIdempotencyKeyV1,
} from "../../src/timer/schedule-command.v1.js";

const identity = {
  workspace_id: "workspace-1",
  bot_id: "bot-1",
  owner_agent_id: "agent-1",
  deployment_environment: "dev",
  release_channel: "stable",
} as const;

function command() {
  return {
    schema_version: "timer.schedule_command.v1",
    ...identity,
    runtime_run_id: "run-1",
    trigger_process_id: "process-1",
    client_request_id: "request-1",
    trace_id: "trace-1",
    method: "timer.remind_at",
    command: "create",
    schedule: {
      name: "Reminder",
      message: "Review the result",
      schedule_type: "once",
      fire_at: "2026-07-30T10:00:00.000Z",
      timezone: "Asia/Shanghai",
      catch_up: true,
      payload: {
        schema_version: "timer.trigger_payload.v1",
        value: { topic_key: "review" },
      },
      priority_hint: "strong",
      intent_hint: "review the result",
    },
  } as const;
}

describe("TimerScheduleCommandV1", () => {
  it("couples every method to its normalized command and schedule shape", () => {
    const value = command();
    expect(Value.Check(TimerScheduleCommandV1Schema, value)).toBe(true);
    expect(() => assertTimerScheduleCommandBindingsV1(value, identity)).not.toThrow();
    expect(
      Value.Check(TimerScheduleCommandV1Schema, {
        ...value,
        method: "timer.cancel",
      }),
    ).toBe(false);
    expect(
      Value.Check(TimerScheduleCommandV1Schema, {
        ...value,
        schedule: {
          ...value.schedule,
          schedule_type: "recurring",
          rrule: "FREQ=DAILY",
        },
      }),
    ).toBe(false);
  });

  it("isolates the same client request by method and binds all business fields", () => {
    const create = command();
    const cancel = {
      ...create,
      method: "timer.cancel",
      command: "cancel",
      schedule_id: "schedule-1",
      expected_schedule_version: 1,
      reason: "user_cancelled",
    } as const;
    expect(timerCommandIdempotencyKeyV1(create)).not.toBe(
      timerCommandIdempotencyKeyV1(cancel),
    );
    expect(JSON.stringify(create)).toContain('"priority_hint":"strong"');
    expect(JSON.stringify(create)).toContain('"intent_hint":"review the result"');
  });

  it("enforces the complete versioned trigger payload 8 KiB boundary", () => {
    const value = command();
    expect(() =>
      assertTimerScheduleCommandBindingsV1({
        ...value,
        schedule: {
          ...value.schedule,
          payload: {
            schema_version: "timer.trigger_payload.v1",
            value: { oversized: "x".repeat(8_192) },
          },
        },
      }),
    ).toThrow(/8192/u);
  });

  it("uses discriminated success responses and a closed retry taxonomy", () => {
    expect(
      Value.Check(TimerScheduleCommandResponseV1Schema, {
        schema_version: "timer.schedule_command.v1",
        timer_command_request_id: "command-1",
        method: "timer.resume",
        command: "resume",
        schedule_id: "schedule-1",
        schedule_version: 2,
        schedule_status: "active",
        duplicate_replayed: false,
      }),
    ).toBe(true);
    expect(
      Value.Check(TimerScheduleCommandResponseV1Schema, {
        schema_version: "timer.schedule_command.v1",
        timer_command_request_id: "command-1",
        method: "timer.pause",
        command: "pause",
        schedule_id: "schedule-1",
        schedule_version: 2,
        schedule_status: "active",
        duplicate_replayed: false,
      }),
    ).toBe(false);
    const retryable = { code: "rate_limited", retryable: true } as const;
    expect(Value.Check(TimerErrorV1Schema, retryable)).toBe(true);
    expect(() => assertTimerErrorHttpBindingV1(retryable, 429)).not.toThrow();
    expect(() => assertTimerErrorHttpBindingV1(retryable, 409)).toThrow(
      /HTTP status/u,
    );
  });
});
