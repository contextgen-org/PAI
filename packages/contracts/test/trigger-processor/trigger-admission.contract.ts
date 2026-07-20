import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { TriggerAdmissionDecisionV1Schema } from "../../src/index.js";

const acceptedDecision = {
  trigger_status: "accepted",
  priority: "strong",
  action: "dispatch",
  reason_code: "timer_due",
  initial_process_state: {
    phase: "admission",
    status: "running",
    wait_reason: null,
    terminal_reason: null,
  },
  foreground_slot_precondition: { process_id: null, generation: 7 },
  process_state_precondition: null,
} as const;

describe("TriggerAdmissionDecisionV1", () => {
  it("accepts registered reason codes and rejects invented accepted reasons", () => {
    expect(Value.Check(TriggerAdmissionDecisionV1Schema, acceptedDecision)).toBe(
      true,
    );
    expect(
      Value.Check(TriggerAdmissionDecisionV1Schema, {
        ...acceptedDecision,
        reason_code: "invented_future_reason",
      }),
    ).toBe(false);
  });

  it("requires an exact foreground slot identity and generation precondition", () => {
    const { foreground_slot_precondition: _, ...withoutPrecondition } =
      acceptedDecision;
    expect(
      Value.Check(TriggerAdmissionDecisionV1Schema, withoutPrecondition),
    ).toBe(false);
    expect(
      Value.Check(TriggerAdmissionDecisionV1Schema, {
        ...acceptedDecision,
        foreground_slot_precondition: { process_id: "process-a", generation: -1 },
      }),
    ).toBe(false);
    expect(
      Value.Check(TriggerAdmissionDecisionV1Schema, {
        ...acceptedDecision,
        foreground_slot_precondition: {
          process_id: "process-a",
          generation: Number.MAX_SAFE_INTEGER + 1,
        },
      }),
    ).toBe(false);
  });

  it("requires an exact active-process phase and version fence", () => {
    expect(
      Value.Check(TriggerAdmissionDecisionV1Schema, {
        ...acceptedDecision,
        foreground_slot_precondition: { process_id: "process-a", generation: 7 },
        process_state_precondition: {
          process_id: "process-a",
          phase: "execution",
          status: "running",
          updated_at: "2026-07-20T08:00:00.000Z",
        },
      }),
    ).toBe(true);
    expect(
      Value.Check(TriggerAdmissionDecisionV1Schema, {
        ...acceptedDecision,
        process_state_precondition: {
          process_id: "process-a",
          phase: "execution",
          status: "waiting",
          updated_at: "2026-07-20T08:00:00.000Z",
        },
      }),
    ).toBe(false);
  });

  it("rejects cross-field combinations that no admission path can produce", () => {
    expect(
      Value.Check(TriggerAdmissionDecisionV1Schema, {
        ...acceptedDecision,
        priority: "weak",
        action: "enqueue_weak",
        reason_code: "timer_catch_up",
        initial_process_state: {
          phase: "admission",
          status: "running",
          wait_reason: "weak_queue",
          terminal_reason: null,
        },
      }),
    ).toBe(false);
  });
});
