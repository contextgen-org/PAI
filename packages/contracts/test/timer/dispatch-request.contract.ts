import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  TimerDispatchRequestV1Schema,
  TimerDispatchResponseV1Schema,
  assertTimerDispatchRequestBindingsV1,
  assertTimerDispatchResponseBindingsV1,
  timerDispatchPayloadHashV1,
} from "../../src/timer/dispatch-request.v1.js";

const identity = {
  workspace_id: "workspace-1",
  bot_id: "bot-1",
  owner_agent_id: "agent-1",
  deployment_environment: "dev",
  release_channel: "stable",
} as const;
const occurrenceKey = `v1:${"a".repeat(43)}`;

function request() {
  const dispatchPayload = {
    ...identity,
    schedule_id: "schedule-1",
    schedule_version: 3,
    occurrence_id: "occurrence-1",
    local_date: "2099-07-30",
    local_time: "18:00:00",
    timezone: "Asia/Shanghai",
    scheduled_for: "2099-07-30T10:00:00.000Z",
    occurrence_key: occurrenceKey,
    message: "Review",
    is_catch_up: false,
    catch_up_batch_id: null,
    missed_window_summary: null,
  } as const;
  return {
    schema_version: "timer.dispatch_request.v1",
    ...identity,
    schedule_id: "schedule-1",
    schedule_version: 3,
    occurrence_id: "occurrence-1",
    occurrence_version: 2,
    occurrence_key: occurrenceKey,
    scheduled_fire_at: "2099-07-30T10:00:00.000Z",
    effective_fire_at: "2099-07-30T10:00:00.000Z",
    local_date: "2099-07-30",
    local_time: "18:00:00",
    timezone: "Asia/Shanghai",
    payload_schema_version: "timer.trigger_payload.v1",
    dispatch_payload: dispatchPayload,
    dispatch_payload_hash: timerDispatchPayloadHashV1(dispatchPayload),
    dispatch_generation: 1,
    claim_token: "claim-1",
    locked_until: "2099-07-30T10:01:00.000Z",
    trace_id: "trace-1",
  } as const;
}

describe("TimerDispatchRequestV1", () => {
  it("binds top-level owner facts to the frozen TP payload and claim fence", () => {
    const value = request();
    expect(Value.Check(TimerDispatchRequestV1Schema, value)).toBe(true);
    expect(() => assertTimerDispatchRequestBindingsV1(value, identity)).not.toThrow();
    expect(() =>
      assertTimerDispatchRequestBindingsV1({
        ...value,
        owner_agent_id: "attacker-agent",
      }),
    ).toThrow(/binding mismatch/u);
    expect(() =>
      assertTimerDispatchRequestBindingsV1({
        ...value,
        schedule_version: 4,
      }),
    ).toThrow(/binding mismatch/u);
    expect(() =>
      assertTimerDispatchRequestBindingsV1({
        ...value,
        dispatch_payload_hash: `sha256:${"f".repeat(64)}`,
      }),
    ).toThrow(/binding mismatch/u);
  });

  it("requires successful dispatch responses to retain the original process", () => {
    const value = request();
    const response = {
      schema_version: "timer.dispatch_request.v1",
      occurrence_id: value.occurrence_id,
      occurrence_version: 3,
      dispatch_attempt_id:
        `dispatch_${value.occurrence_id}_${value.dispatch_generation}`,
      trigger_process_id: "process-1",
      status: "dispatched",
      duplicate_replayed: true,
    } as const;
    expect(Value.Check(TimerDispatchResponseV1Schema, response)).toBe(true);
    expect(() =>
      assertTimerDispatchResponseBindingsV1(value, response),
    ).not.toThrow();
    expect(() =>
      assertTimerDispatchResponseBindingsV1(value, {
        ...response,
        occurrence_version: 4,
      }),
    ).toThrow(/CAS or attempt binding/u);
    expect(() =>
      assertTimerDispatchResponseBindingsV1(value, {
        ...response,
        dispatch_attempt_id: "dispatch_occurrence-1_2",
      }),
    ).toThrow(/CAS or attempt binding/u);
  });

  it("rejects a self-consistent but false local tuple and reversed fire time", () => {
    const value = request();
    const driftedPayload = {
      ...value.dispatch_payload,
      local_time: "19:00:00",
    };
    expect(() =>
      assertTimerDispatchRequestBindingsV1({
        ...value,
        local_time: "19:00:00",
        dispatch_payload: driftedPayload,
        dispatch_payload_hash: timerDispatchPayloadHashV1(driftedPayload),
      }),
    ).toThrow(/local date\/time/u);
    expect(() =>
      assertTimerDispatchRequestBindingsV1({
        ...value,
        effective_fire_at: "2099-07-30T09:59:59.000Z",
      }),
    ).toThrow(/invalid lease or fire time/u);
  });

  it("does not let retry/failure responses claim duplicate replay", () => {
    expect(
      Value.Check(TimerDispatchResponseV1Schema, {
        schema_version: "timer.dispatch_request.v1",
        occurrence_id: "occurrence-1",
        occurrence_version: 3,
        dispatch_attempt_id: "attempt-1",
        status: "retry_wait",
        duplicate_replayed: true,
      }),
    ).toBe(false);
  });
});
