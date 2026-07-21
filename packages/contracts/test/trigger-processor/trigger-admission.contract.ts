import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  TriggerAdmissionDecisionV1Schema,
  TrustedAdmissionFactsV1Schema,
} from "../../src/index.js";

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
  admission_precondition: {
    kind: "idle",
    process_id: null,
    slot_generation: 7,
  },
} as const;

describe("TriggerAdmissionDecisionV1", () => {
  it("rejects malformed trusted-fact discriminants and undeclared fields", () => {
    const idleFacts = {
      source: "chat",
      actor_type: "user",
      bot_state: "active",
      safety_blocked: false,
      trusted_strong_hint: false,
      explicit_interrupt: false,
      is_catch_up: false,
      foreground_slot_generation: 7,
      active_process: "none",
      active_process_id: null,
      active_process_slot_generation: null,
      active_process_updated_at: null,
      foreground_slot_process_id: null,
    } as const;
    expect(Value.Check(TrustedAdmissionFactsV1Schema, idleFacts)).toBe(true);
    expect(
      Value.Check(TrustedAdmissionFactsV1Schema, {
        ...idleFacts,
        active_process: "cooldown_typo",
      }),
    ).toBe(false);
    expect(
      Value.Check(TrustedAdmissionFactsV1Schema, {
        ...idleFacts,
        caller_priority: "strong",
      }),
    ).toBe(false);
  });

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
    const { admission_precondition: _, ...withoutPrecondition } =
      acceptedDecision;
    expect(
      Value.Check(TriggerAdmissionDecisionV1Schema, withoutPrecondition),
    ).toBe(false);
    expect(
      Value.Check(TriggerAdmissionDecisionV1Schema, {
        ...acceptedDecision,
        admission_precondition: {
          kind: "occupied",
          process_id: "process-a",
          slot_generation: -1,
          phase: "execution",
          status: "running",
          process_updated_at: "2026-07-20T08:00:00.000Z",
        },
      }),
    ).toBe(false);
    expect(
      Value.Check(TriggerAdmissionDecisionV1Schema, {
        ...acceptedDecision,
        admission_precondition: {
          kind: "occupied",
          process_id: "process-a",
          slot_generation: Number.MAX_SAFE_INTEGER + 1,
          phase: "execution",
          status: "running",
          process_updated_at: "2026-07-20T08:00:00.000Z",
        },
      }),
    ).toBe(false);
  });

  it("requires an exact active-process phase and version fence", () => {
    expect(
      Value.Check(TriggerAdmissionDecisionV1Schema, {
        ...acceptedDecision,
        admission_precondition: {
          kind: "occupied",
          process_id: "process-a",
          slot_generation: 7,
          phase: "execution",
          status: "running",
          process_updated_at: "2026-07-20T08:00:00.000Z",
        },
      }),
    ).toBe(true);
    expect(
      Value.Check(TriggerAdmissionDecisionV1Schema, {
        ...acceptedDecision,
        admission_precondition: {
          kind: "occupied",
          process_id: "process-a",
          slot_generation: 7,
          phase: "execution",
          status: "waiting",
          process_updated_at: "2026-07-20T08:00:00.000Z",
        },
      }),
    ).toBe(false);

    expect(
      Value.Check(TriggerAdmissionDecisionV1Schema, {
        ...acceptedDecision,
        admission_precondition: {
          kind: "idle",
          process_id: "process-a",
          slot_generation: 7,
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
