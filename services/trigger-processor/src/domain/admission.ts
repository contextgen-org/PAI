import type {
  TriggerActorTypeV1,
  TriggerAdmissionDecisionV1,
  TriggerPriorityV1,
  TriggerSourceV1,
} from "@pai/contracts";

export interface TrustedAdmissionFactsV1 {
  readonly source: TriggerSourceV1;
  readonly actor_type: TriggerActorTypeV1;
  readonly bot_state: "active" | "disabled" | "archived";
  readonly safety_blocked: boolean;
  readonly active_process: "none" | "execution_running" | "cooldown_waiting";
  readonly trusted_strong_hint: boolean;
  readonly explicit_interrupt: boolean;
  readonly is_catch_up: boolean;
  readonly foreground_slot_occupied: boolean;
}

export class InvalidTrustedAdmissionFactsError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "InvalidTrustedAdmissionFactsError";
  }
}

function assertConsistentForegroundState(
  facts: TrustedAdmissionFactsV1,
): void {
  const hasActiveProcess = facts.active_process !== "none";
  if (hasActiveProcess !== facts.foreground_slot_occupied) {
    throw new InvalidTrustedAdmissionFactsError(
      "active_process and foreground_slot_occupied must come from one consistent admission snapshot",
    );
  }
}

export function calculateTriggerPriorityV1(
  facts: Pick<
    TrustedAdmissionFactsV1,
    "source" | "actor_type" | "trusted_strong_hint" | "explicit_interrupt"
  >,
): TriggerPriorityV1 {
  if (facts.source === "timer") {
    if (facts.actor_type !== "system") {
      throw new InvalidTrustedAdmissionFactsError(
        "timer source requires the trusted system actor",
      );
    }
    return "strong";
  }
  if (facts.trusted_strong_hint || facts.explicit_interrupt) return "strong";
  if (facts.source === "notification") return "weak";
  return facts.actor_type === "super_user" || facts.actor_type === "system"
    ? "strong"
    : "weak";
}

const runningAdmissionState = {
  phase: "admission",
  status: "running",
  wait_reason: null,
  terminal_reason: null,
} as const;

const waitingAdmissionState = (
  wait_reason: "weak_queue" | "preempt_commit" | "deferred_strong_queue",
) =>
  ({
    phase: "admission",
    status: "waiting",
    wait_reason,
    terminal_reason: null,
  }) as const;

export function decideTriggerAdmissionV1(
  facts: TrustedAdmissionFactsV1,
): TriggerAdmissionDecisionV1 {
  assertConsistentForegroundState(facts);
  const priority = calculateTriggerPriorityV1(facts);

  if (facts.bot_state !== "active") {
    return {
      trigger_status: "rejected",
      priority,
      action: "reject",
      reason_code:
        facts.bot_state === "disabled" ? "bot_disabled" : "bot_archived",
    };
  }
  if (facts.safety_blocked) {
    return {
      trigger_status: "rejected",
      priority,
      action: "reject",
      reason_code: "safety_blocked",
    };
  }

  if (facts.source === "timer" && facts.is_catch_up) {
    return facts.foreground_slot_occupied
      ? {
          trigger_status: "accepted",
          priority: "strong",
          action: "enqueue_strong_fifo",
          reason_code: "catch_up_foreground_busy",
          initial_process_state: waitingAdmissionState("deferred_strong_queue"),
        }
      : {
          trigger_status: "accepted",
          priority: "strong",
          action: "dispatch_catch_up_serial",
          reason_code: "timer_catch_up",
          initial_process_state: runningAdmissionState,
        };
  }

  if (facts.source === "timer") {
    return facts.active_process === "none"
      ? {
          trigger_status: "accepted",
          priority: "strong",
          action: "dispatch",
          reason_code: "timer_due",
          initial_process_state: runningAdmissionState,
        }
      : {
          trigger_status: "accepted",
          priority: "strong",
          action: "dispatch_or_preempt",
          reason_code: "timer_due_preempt_active",
          initial_process_state: waitingAdmissionState("preempt_commit"),
        };
  }

  if (priority === "strong") {
    if (facts.active_process === "none") {
      return {
        trigger_status: "accepted",
        priority: "strong",
        action: "dispatch",
        reason_code: facts.explicit_interrupt
          ? "explicit_interrupt"
          : "strong_no_active_dispatch",
        initial_process_state: runningAdmissionState,
      };
    }
    return {
      trigger_status: "accepted",
      priority: "strong",
      action: "dispatch_or_preempt",
      reason_code: facts.explicit_interrupt
        ? "explicit_interrupt"
        : "strong_preempt_active",
      initial_process_state: waitingAdmissionState("preempt_commit"),
    };
  }

  if (facts.active_process === "none") {
    return {
      trigger_status: "accepted",
      priority: "weak",
      action: "dispatch",
      reason_code: "weak_no_active_dispatch",
      initial_process_state: runningAdmissionState,
    };
  }

  if (facts.active_process === "cooldown_waiting") {
    return {
      trigger_status: "accepted",
      priority: "weak",
      action: "merge_or_enqueue_weak",
      reason_code: "cooldown_merge_candidate",
      initial_process_state: waitingAdmissionState("weak_queue"),
    };
  }
  return {
    trigger_status: "accepted",
    priority: "weak",
    action: "enqueue_weak",
    reason_code: "active_process_running",
    initial_process_state: waitingAdmissionState("weak_queue"),
  };
}
