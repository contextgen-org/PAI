import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  TimerCatchUpAdvanceRequestV1Schema,
  TimerCatchUpCreateRequestV1Schema,
  TimerOccurrenceClaimRequestV1Schema,
  TimerScanDueRequestV1Schema,
  assertTimerCatchUpAdvanceRequestBindingsV1,
} from "../../src/timer/http-routes.v1.js";
import {
  TimerScheduleCreateCommandV1Schema,
  TimerSchedulePauseCommandV1Schema,
} from "../../src/timer/schedule-command.v1.js";

describe("Timer HTTP route contracts", () => {
  it("separates server-bound worker commands from owner persistence rows", () => {
    expect(
      Value.Check(TimerScanDueRequestV1Schema, {
        worker_id: "scanner-1",
        checkpoint_id: "default",
        trace_id: "trace-1",
      }),
    ).toBe(true);
    expect(
      Value.Check(TimerOccurrenceClaimRequestV1Schema, {
        occurrence_id: "caller-must-not-supply-path-identity",
        expected_occurrence_version: 1,
        expected_schedule_version: 1,
        expected_status: "pending",
        worker_id: "worker-1",
      }),
    ).toBe(false);
    expect(
      Value.Check(TimerCatchUpCreateRequestV1Schema, {
        occurrence_ids: ["occurrence-1"],
        trace_id: "trace-1",
        timeout_seconds: 1,
      }),
    ).toBe(false);
  });

  it("requires the entire serialized catch-up continuation tuple", () => {
    const request = {
      expected_status: "running",
      expected_cursor_occurrence_id: "occurrence-1",
      expected_last_occurrence_id: "occurrence-1",
      expected_last_trigger_process_id: "process-1",
      trace_id: "trace-1",
    } as const;
    expect(Value.Check(TimerCatchUpAdvanceRequestV1Schema, request)).toBe(
      true,
    );
    expect(() =>
      assertTimerCatchUpAdvanceRequestBindingsV1(request),
    ).not.toThrow();
    expect(() =>
      assertTimerCatchUpAdvanceRequestBindingsV1({
        ...request,
        expected_last_trigger_process_id: null,
      }),
    ).toThrow(/continuation tuple/u);
  });

  it("keeps route method branches closed before application dispatch", () => {
    const pause = {
      schema_version: "timer.schedule_command.v1",
      workspace_id: "workspace-1",
      bot_id: "bot-1",
      owner_agent_id: "agent-1",
      deployment_environment: "dev",
      release_channel: "stable",
      runtime_run_id: "runtime-1",
      trigger_process_id: "process-1",
      client_request_id: "request-1",
      trace_id: "trace-1",
      method: "timer.pause",
      command: "pause",
      schedule_id: "schedule-1",
      expected_schedule_version: 1,
      reason: "user_paused",
    } as const;
    expect(Value.Check(TimerSchedulePauseCommandV1Schema, pause)).toBe(
      true,
    );
    expect(Value.Check(TimerScheduleCreateCommandV1Schema, pause)).toBe(
      false,
    );
  });
});
