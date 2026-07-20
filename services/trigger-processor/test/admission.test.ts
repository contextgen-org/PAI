import { describe, expect, it } from "vitest";

import {
  calculateTriggerPriorityV1,
  decideTriggerAdmissionV1,
} from "../src/domain/admission.js";

const base = {
  source: "chat" as const,
  actor_type: "user" as const,
  bot_state: "active" as const,
  safety_blocked: false,
  active_process: "none" as const,
  trusted_strong_hint: false,
  explicit_interrupt: false,
  is_catch_up: false,
  foreground_slot_occupied: false,
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

  it("serializes timer catch-up without preempting an occupied foreground slot", () => {
    expect(
      decideTriggerAdmissionV1({
        ...base,
        source: "timer",
        actor_type: "system",
        is_catch_up: true,
        foreground_slot_occupied: true,
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
