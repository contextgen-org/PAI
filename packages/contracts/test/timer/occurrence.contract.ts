import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  TimerOccurrenceClaimV1Schema,
  TimerOccurrenceTransitionV1Schema,
  TimerOccurrenceV1Schema,
  assertTimerOccurrenceBindingsV1,
} from "../../src/timer/occurrence.v1.js";
import { timerDispatchPayloadHashV1 } from "../../src/timer/dispatch-request.v1.js";

const identity = {
  workspace_id: "workspace-1",
  bot_id: "bot-1",
  owner_agent_id: "agent-1",
  deployment_environment: "dev",
  release_channel: "stable",
} as const;
const occurrenceKey = `v1:${"a".repeat(43)}`;

function occurrence() {
  const dispatchPayload = {
    ...identity,
    schedule_id: "schedule-1",
    schedule_version: 3,
    occurrence_id: "occurrence-1",
    local_date: "2026-07-30",
    local_time: "18:00:00",
    timezone: "Asia/Shanghai",
    scheduled_for: "2026-07-30T10:00:00.000Z",
    occurrence_key: occurrenceKey,
    message: "Review",
    is_catch_up: false,
    catch_up_batch_id: null,
    missed_window_summary: null,
  } as const;
  return {
    schema_version: "timer.occurrence.v1",
    ...identity,
    occurrence_id: "occurrence-1",
    schedule_id: "schedule-1",
    occurrence_key: occurrenceKey,
    occurrence_version: 1,
    scheduled_fire_at: "2026-07-30T10:00:00.000Z",
    effective_fire_at: "2026-07-30T10:00:00.000Z",
    local_date: "2026-07-30",
    local_time: "18:00:00",
    timezone: "Asia/Shanghai",
    schedule_end_time: null,
    schedule_version: 3,
    dispatch_payload: dispatchPayload,
    dispatch_payload_hash: timerDispatchPayloadHashV1(dispatchPayload),
    payload_schema_version: "timer.trigger_payload.v1",
    status: "pending",
    trigger_id: null,
    trigger_process_id: null,
    dedupe_key: `timer:${occurrenceKey}`,
    error: null,
    attempt_count: 0,
    next_dispatch_at: null,
    catch_up_batch_id: null,
    is_catch_up: false,
    dispatch_generation: 0,
    claim_token: null,
    locked_by: null,
    locked_until: null,
    created_at: "2026-07-30T09:00:00.000Z",
    updated_at: "2026-07-30T09:00:00.000Z",
  } as const;
}

describe("TimerOccurrenceV1", () => {
  it("binds the immutable dispatch snapshot, scope and DST local tuple facts", () => {
    const value = occurrence();
    expect(Value.Check(TimerOccurrenceV1Schema, value)).toBe(true);
    expect(() => assertTimerOccurrenceBindingsV1(value)).not.toThrow();
    expect(() =>
      assertTimerOccurrenceBindingsV1({
        ...value,
        schedule_version: 4,
      }),
    ).toThrow(/dispatch snapshot/u);
    expect(() =>
      assertTimerOccurrenceBindingsV1({
        ...value,
        dedupe_key: `timer:v1:${"b".repeat(43)}`,
      }),
    ).toThrow(/dispatch snapshot/u);
    expect(() =>
      assertTimerOccurrenceBindingsV1({
        ...value,
        dispatch_payload_hash: `sha256:${"f".repeat(64)}`,
      }),
    ).toThrow(/dispatch snapshot/u);
  });

  it("requires a versioned lease fence for every dispatching occurrence", () => {
    const value = occurrence();
    expect(() =>
      assertTimerOccurrenceBindingsV1({
        ...value,
        status: "dispatching",
        occurrence_version: 2,
        dispatch_generation: 1,
        claim_token: "claim-1",
        locked_by: "worker-1",
        locked_until: "2026-07-30T10:01:00.000Z",
      }),
    ).not.toThrow();
    expect(() =>
      assertTimerOccurrenceBindingsV1({
        ...value,
        status: "dispatching",
        occurrence_version: 2,
        dispatch_generation: 1,
        claim_token: null,
      }),
    ).toThrow(/lease state/u);
  });

  it("rejects time drift and partial Trigger Processor identities", () => {
    const value = occurrence();
    const driftedPayload = {
      ...value.dispatch_payload,
      local_time: "19:00:00",
    };
    expect(() =>
      assertTimerOccurrenceBindingsV1({
        ...value,
        local_time: "19:00:00",
        dispatch_payload: driftedPayload,
        dispatch_payload_hash: timerDispatchPayloadHashV1(driftedPayload),
      }),
    ).toThrow(/local date\/time/u);
    expect(() =>
      assertTimerOccurrenceBindingsV1({
        ...value,
        trigger_id: "trigger-1",
      }),
    ).toThrow(/dispatch result/u);
    expect(() =>
      assertTimerOccurrenceBindingsV1({
        ...value,
        effective_fire_at: "2026-07-30T09:59:59.000Z",
      }),
    ).toThrow(/timestamp ordering/u);
  });

  it("models claim and transition CAS inputs explicitly", () => {
    expect(
      Value.Check(TimerOccurrenceClaimV1Schema, {
        schema_version: "timer.occurrence_claim.v1",
        ...identity,
        occurrence_id: "occurrence-1",
        occurrence_version: 2,
        schedule_id: "schedule-1",
        schedule_version: 3,
        previous_status: "pending",
        status: "dispatching",
        dispatch_generation: 1,
        claim_token: "claim-1",
        locked_by: "worker-1",
        locked_until: "2026-07-30T10:01:00.000Z",
        dispatch_payload: occurrence().dispatch_payload,
        dispatch_payload_hash: occurrence().dispatch_payload_hash,
      }),
    ).toBe(true);
    expect(
      Value.Check(TimerOccurrenceTransitionV1Schema, {
        schema_version: "timer.occurrence_transition.v1",
        ...identity,
        occurrence_id: "occurrence-1",
        expected_occurrence_version: 2,
        expected_schedule_version: 3,
        expected_status: "dispatching",
        expected_dispatch_generation: 1,
        expected_claim_token: "claim-1",
        next_status: "dispatched",
        reason_code: null,
        next_retry_at: null,
        trigger_id: "trigger-1",
        trigger_process_id: "process-1",
        trace_id: "trace-1",
      }),
    ).toBe(true);
  });
});
