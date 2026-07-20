import { describe, expect, it } from "vitest";

import {
  assertTriggerAdmissionCommitPreconditionV1,
  calculateTriggerPriorityV1,
  decideTriggerAdmissionV1,
} from "../src/domain/admission.js";

const base = {
  source: "chat" as const,
  actor_type: "user" as const,
  bot_state: "active" as const,
  safety_blocked: false,
  active_process: "none" as const,
  active_process_id: null,
  active_process_slot_generation: null,
  active_process_updated_at: null,
  trusted_strong_hint: false,
  explicit_interrupt: false,
  is_catch_up: false,
  foreground_slot_process_id: null,
  foreground_slot_generation: 7,
};

describe("Trigger admission", () => {
  it("calculates priority from source and actor instead of accepting caller priority", () => {
    expect(calculateTriggerPriorityV1(base)).toBe("weak");
    expect(
      calculateTriggerPriorityV1({
        ...base,
        actor_type: "super_user",
      }),
    ).toBe("strong");
    expect(
      calculateTriggerPriorityV1({
        ...base,
        source: "timer",
        actor_type: "system",
      }),
    ).toBe("strong");
  });

  it("dispatches a weak trigger without promoting it when no process is active", () => {
    expect(decideTriggerAdmissionV1(base)).toMatchObject({
      trigger_status: "accepted",
      priority: "weak",
      action: "dispatch",
      reason_code: "weak_no_active_dispatch",
      initial_process_state: { phase: "admission", status: "running" },
    });
  });

  it("queues ordinary weak work behind an active runtime", () => {
    expect(
      decideTriggerAdmissionV1({
        ...base,
        active_process: "execution_running",
        active_process_id: "process-active",
        active_process_slot_generation: 7,
        active_process_updated_at: "2026-07-20T08:00:00.000Z",
        foreground_slot_process_id: "process-active",
      }),
    ).toMatchObject({
      priority: "weak",
      action: "enqueue_weak",
      reason_code: "active_process_running",
      initial_process_state: {
        phase: "admission",
        status: "waiting",
        wait_reason: "weak_queue",
      },
    });
  });

  it("does not mislabel a trusted strong hint as an explicit interrupt", () => {
    expect(
      decideTriggerAdmissionV1({
        ...base,
        trusted_strong_hint: true,
      }),
    ).toMatchObject({
      priority: "strong",
      action: "dispatch",
      reason_code: "strong_no_active_dispatch",
    });
  });

  it("serializes timer catch-up without preempting an occupied foreground slot", () => {
    expect(
      decideTriggerAdmissionV1({
        ...base,
        source: "timer",
        actor_type: "system",
        is_catch_up: true,
        active_process: "execution_running",
        active_process_id: "process-active",
        active_process_slot_generation: 7,
        active_process_updated_at: "2026-07-20T08:00:00.000Z",
        foreground_slot_process_id: "process-active",
      }),
    ).toMatchObject({
      trigger_status: "accepted",
      priority: "strong",
      action: "enqueue_strong_fifo",
      reason_code: "catch_up_foreground_busy",
      initial_process_state: {
        phase: "admission",
        status: "waiting",
        wait_reason: "deferred_strong_queue",
      },
    });
  });

  it("rejects admission facts with torn process identity or slot generation", () => {
    expect(() =>
      decideTriggerAdmissionV1({
        ...base,
        source: "timer",
        actor_type: "system",
        foreground_slot_process_id: "process-raced-in",
      }),
    ).toThrow("identity and foreground slot generation");

    expect(() =>
      decideTriggerAdmissionV1({
        ...base,
        source: "timer",
        actor_type: "system",
        is_catch_up: true,
        active_process: "execution_running",
        active_process_id: "process-a",
        active_process_slot_generation: 6,
        active_process_updated_at: "2026-07-20T08:00:00.000Z",
        foreground_slot_process_id: "process-a",
      }),
    ).toThrow("identity and foreground slot generation");

    expect(() =>
      decideTriggerAdmissionV1({
        ...base,
        active_process: "execution_running",
        active_process_id: "process-a",
        active_process_slot_generation: 7,
        active_process_updated_at: "2026-07-20T08:00:00.000Z",
        foreground_slot_process_id: "process-b",
      }),
    ).toThrow("identity and foreground slot generation");
  });

  it("returns the exact slot CAS precondition consumed by admit_trigger_v1", () => {
    expect(decideTriggerAdmissionV1(base)).toMatchObject({
      admission_precondition: {
        kind: "idle",
        process_id: null,
        slot_generation: 7,
      },
    });
    expect(
      decideTriggerAdmissionV1({
        ...base,
        active_process: "cooldown_waiting",
        active_process_id: "process-active",
        active_process_slot_generation: 7,
        active_process_updated_at: "2026-07-20T08:00:00.000Z",
        foreground_slot_process_id: "process-active",
      }),
    ).toMatchObject({
      admission_precondition: {
        kind: "occupied",
        process_id: "process-active",
        slot_generation: 7,
        phase: "cooldown",
        status: "waiting",
        process_updated_at: "2026-07-20T08:00:00.000Z",
      },
    });
  });

  it("rejects commit when a concurrent slot transfer wins after the decision", () => {
    const decision = decideTriggerAdmissionV1(base);
    if (decision.trigger_status !== "accepted") throw new Error("expected accepted");
    expect(() =>
      assertTriggerAdmissionCommitPreconditionV1(decision, {
        process_id: "process-b",
        generation: 8,
      }, null),
    ).toThrow("changed before atomic trigger admission commit");
    expect(() =>
      assertTriggerAdmissionCommitPreconditionV1(decision, {
        process_id: null,
        generation: 7,
      }, null),
    ).not.toThrow();
  });

  it("rejects a same-slot decision after the active process phase changes", () => {
    const decision = decideTriggerAdmissionV1({
      ...base,
      active_process: "execution_running",
      active_process_id: "process-a",
      active_process_slot_generation: 7,
      active_process_updated_at: "2026-07-20T08:00:00.000Z",
      foreground_slot_process_id: "process-a",
    });
    if (decision.trigger_status !== "accepted") throw new Error("expected accepted");
    expect(() =>
      assertTriggerAdmissionCommitPreconditionV1(
        decision,
        { process_id: "process-a", generation: 7 },
        {
          process_id: "process-a",
          phase: "cooldown",
          status: "waiting",
          updated_at: "2026-07-20T08:00:01.000Z",
        },
      ),
    ).toThrow("changed before atomic trigger admission commit");
  });

  it("compares occupied process state semantically, independent of property insertion order", () => {
    const decision = decideTriggerAdmissionV1({
      ...base,
      active_process: "execution_running",
      active_process_id: "process-a",
      active_process_slot_generation: 7,
      active_process_updated_at: "2026-07-20T08:00:00.000Z",
      foreground_slot_process_id: "process-a",
    });
    if (decision.trigger_status !== "accepted") throw new Error("expected accepted");
    const currentProcess = {
      updated_at: "2026-07-20T08:00:00.000Z",
      status: "running" as const,
      phase: "execution" as const,
      process_id: "process-a",
    };
    expect(() =>
      assertTriggerAdmissionCommitPreconditionV1(
        decision,
        { process_id: "process-a", generation: 7 },
        currentProcess,
      ),
    ).not.toThrow();
  });

  it("rejects an inactive bot without producing a process state", () => {
    const decision = decideTriggerAdmissionV1({
      ...base,
      bot_state: "disabled",
    });
    expect(decision).toEqual({
      trigger_status: "rejected",
      priority: "weak",
      action: "reject",
      reason_code: "bot_disabled",
    });
    expect("initial_process_state" in decision).toBe(false);
  });
});
