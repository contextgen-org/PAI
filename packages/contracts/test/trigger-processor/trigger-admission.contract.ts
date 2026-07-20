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
