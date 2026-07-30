import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  TimerScheduleQueryResponseV1Schema,
  TimerScheduleQueryV1Schema,
  assertTimerQueryIdentityV1,
  assertTimerScheduleCursorScopeV1,
  assertTimerScheduleQueryResponseBindingsV1,
  timerScheduleCursorV1,
} from "../../src/timer/schedule-query-response.v1.js";

const identity = {
  workspace_id: "workspace-1",
  bot_id: "bot-1",
  owner_agent_id: "agent-1",
  deployment_environment: "dev",
  release_channel: "stable",
} as const;
const scopeHash = `sha256:${"a".repeat(64)}` as const;

function schedule() {
  return {
    schema_version: "timer.schedule.v1",
    ...identity,
    schedule_id: "schedule-1",
    name: "Reminder",
    message: "Review",
    status: "active",
    schedule_type: "once",
    fire_at: "2026-07-30T10:00:00.000Z",
    rrule: null,
    timezone: "Asia/Shanghai",
    end_time: null,
    payload: {},
    catch_up: true,
    max_catch_up_window_seconds: 86_400,
    max_catch_up_occurrences: 100,
    next_fire_at: "2026-07-30T10:00:00.000Z",
    schedule_version: 1,
    created_by: "action_runtime",
    created_by_runtime_run_id: "run-1",
    created_by_trigger_process_id: "process-1",
    client_request_id: "request-1",
    created_at: "2026-07-29T10:00:00.000Z",
    updated_at: "2026-07-29T10:00:00.000Z",
  } as const;
}

describe("TimerScheduleQueryResponseV1", () => {
  it("derives query identity from the trusted five-tuple", () => {
    const query = {
      schema_version: "timer.schedule_query.v1",
      ...identity,
      method: "timer.list",
      runtime_run_id: "run-1",
      trace_id: "trace-1",
      limit: 10,
    } as const;
    expect(Value.Check(TimerScheduleQueryV1Schema, query)).toBe(true);
    expect(() => assertTimerQueryIdentityV1(query, identity)).not.toThrow();
    expect(() =>
      assertTimerQueryIdentityV1(
        { ...query, owner_agent_id: "attacker-agent" },
        identity,
      ),
    ).toThrow(/principal/u);
  });

  it("keeps response rows and returned count in the same identity scope", () => {
    const response = {
      schema_version: "timer.schedule_query_response.v1",
      identity,
      schedules: [schedule()],
      returned: 1,
    } as const;
    expect(Value.Check(TimerScheduleQueryResponseV1Schema, response)).toBe(true);
    expect(() =>
      assertTimerScheduleQueryResponseBindingsV1(response, identity),
    ).not.toThrow();
    expect(() =>
      assertTimerScheduleQueryResponseBindingsV1(
        {
          ...response,
          schedules: [
            { ...schedule(), owner_agent_id: "attacker-agent" },
          ],
        },
        identity,
      ),
    ).toThrow(/scope or count/u);
  });

  it("binds pagination cursors to an opaque scope fingerprint", () => {
    const cursor = timerScheduleCursorV1(scopeHash, "schedule_1");
    expect(() =>
      assertTimerScheduleCursorScopeV1(cursor, scopeHash),
    ).not.toThrow();
    expect(() =>
      assertTimerScheduleCursorScopeV1(
        cursor,
        `sha256:${"b".repeat(64)}`,
      ),
    ).toThrow(/another identity scope/u);
    expect(
      Value.Check(TimerScheduleQueryV1Schema, {
        schema_version: "timer.schedule_query.v1",
        ...identity,
        method: "timer.history",
        runtime_run_id: "run-1",
        trace_id: "trace-history",
        schedule_id: "schedule-1",
        limit: 100,
        cursor,
      }),
    ).toBe(true);
  });
});
