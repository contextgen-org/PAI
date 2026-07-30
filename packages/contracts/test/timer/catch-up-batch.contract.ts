import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  TIMER_CONFIG_DEFAULTS_V1,
  TimerCatchUpBatchAdvanceV1Schema,
  TimerCatchUpBatchCreateV1Schema,
  TimerCatchUpBatchV1Schema,
  TimerConfigV1Schema,
  assertTimerCatchUpAdvanceBindingsV1,
  assertTimerCatchUpBatchBindingsV1,
  assertTimerCatchUpBatchCreateBindingsV1,
  freezeTimerCatchUpPolicyV1,
} from "../../src/timer/catch-up-batch.v1.js";

const identity = {
  workspace_id: "workspace-1",
  bot_id: "bot-1",
  owner_agent_id: "agent-1",
  deployment_environment: "dev",
  release_channel: "stable",
} as const;

describe("TimerCatchUpBatchV1", () => {
  it("freezes all four official config values for each new batch", () => {
    expect(freezeTimerCatchUpPolicyV1({}, "config-1")).toEqual({
      ...TIMER_CONFIG_DEFAULTS_V1,
      config_revision: "config-1",
    });
    expect(Value.Check(TimerConfigV1Schema, { unknown: 1 })).toBe(false);
    expect(
      Value.Check(TimerConfigV1Schema, {
        catch_up_timeout_seconds: 0,
      }),
    ).toBe(false);
  });

  it("enforces window/count policy before atomically creating a batch", () => {
    const create = {
      schema_version: "timer.catch_up_batch_create.v1",
      ...identity,
      catch_up_batch_id: "batch-1",
      occurrence_ids: ["occurrence-1"],
      window_start: "2026-07-30T00:00:00.000Z",
      window_end: "2026-07-30T01:00:00.000Z",
      started_at: "2026-07-30T01:00:01.000Z",
      policy_snapshot: freezeTimerCatchUpPolicyV1({}, "config-1"),
      request_hash: `sha256:${"a".repeat(64)}`,
      trace_id: "trace-1",
    } as const;
    expect(Value.Check(TimerCatchUpBatchCreateV1Schema, create)).toBe(true);
    expect(() => assertTimerCatchUpBatchCreateBindingsV1(create)).not.toThrow();
    expect(() =>
      assertTimerCatchUpBatchCreateBindingsV1({
        ...create,
        window_start: "2026-07-28T00:00:00.000Z",
      }),
    ).toThrow(/window or count/u);
  });

  it("binds deadline and cursor facts to the frozen policy", () => {
    const batch = {
      schema_version: "timer.catch_up_batch.v1",
      catch_up_batch_id: "batch-1",
      ...identity,
      status: "running",
      cursor_occurrence_id: null,
      last_occurrence_id: null,
      last_trigger_process_id: null,
      timeout_seconds: 300,
      deadline_at: "2026-07-30T01:05:00.000Z",
      started_at: "2026-07-30T01:00:00.000Z",
      completed_at: null,
      reason_code: null,
      created_at: "2026-07-30T01:00:00.000Z",
      updated_at: "2026-07-30T01:00:00.000Z",
      policy_snapshot: freezeTimerCatchUpPolicyV1({}, "config-1"),
    } as const;
    expect(Value.Check(TimerCatchUpBatchV1Schema, batch)).toBe(true);
    expect(() => assertTimerCatchUpBatchBindingsV1(batch)).not.toThrow();
    expect(() =>
      assertTimerCatchUpBatchBindingsV1({
        ...batch,
        timeout_seconds: 299,
      }),
    ).toThrow(/policy or time/u);
  });

  it("never advances after only one of TP process/Meta projections is terminal", () => {
    const advance = {
      schema_version: "timer.catch_up_batch_advance.v1",
      ...identity,
      catch_up_batch_id: "batch-1",
      expected_status: "running",
      expected_cursor_occurrence_id: "occurrence-1",
      expected_last_occurrence_id: "occurrence-1",
      expected_last_trigger_process_id: "process-1",
      next_occurrence_id: "occurrence-2",
      previous_process_terminal: true,
      previous_meta_terminal: true,
      trace_id: "trace-1",
    } as const;
    expect(Value.Check(TimerCatchUpBatchAdvanceV1Schema, advance)).toBe(true);
    expect(() => assertTimerCatchUpAdvanceBindingsV1(advance)).not.toThrow();
    expect(() =>
      assertTimerCatchUpAdvanceBindingsV1({
        ...advance,
        previous_meta_terminal: false,
      }),
    ).toThrow(/authority binding/u);
  });
});
