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
  readonly active_process_id: string | null;
  readonly active_process_slot_generation: number | null;
  readonly active_process_updated_at: string | null;
  readonly trusted_strong_hint: boolean;
  readonly explicit_interrupt: boolean;
  readonly is_catch_up: boolean;
  readonly foreground_slot_process_id: string | null;
  readonly foreground_slot_generation: number;
}

export class InvalidTrustedAdmissionFactsError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "InvalidTrustedAdmissionFactsError";
  }
}

export class StaleTriggerAdmissionDecisionError extends Error {
  public constructor() {
    super("foreground slot changed before atomic trigger admission commit");
    this.name = "StaleTriggerAdmissionDecisionError";
  }
}

/** Invoked by admit_trigger_v1 while holding the owner transaction lock. */
export function assertTriggerAdmissionCommitPreconditionV1(
  decision: Extract<TriggerAdmissionDecisionV1, { trigger_status: "accepted" }>,
  currentSlot: { readonly process_id: string | null; readonly generation: number },
  currentProcess: {
    readonly process_id: string;
    readonly phase: "execution" | "cooldown";
    readonly status: "running" | "waiting";
    readonly updated_at: string;
  } | null,
): void {
  if (
    decision.foreground_slot_precondition.process_id !== currentSlot.process_id ||
    decision.foreground_slot_precondition.generation !== currentSlot.generation ||
    JSON.stringify(decision.process_state_precondition) !==
      JSON.stringify(currentProcess)
  ) {
    throw new StaleTriggerAdmissionDecisionError();
  }
}

function assertConsistentForegroundState(
  facts: TrustedAdmissionFactsV1,
): void {
  const hasActiveProcess = facts.active_process !== "none";
  const hasActiveProcessIdentity = facts.active_process_id !== null;
  const hasForegroundProcess = facts.foreground_slot_process_id !== null;
  const hasProcessVersion = facts.active_process_updated_at !== null;
  if (
    !Number.isSafeInteger(facts.foreground_slot_generation) ||
    facts.foreground_slot_generation < 0 ||
    hasActiveProcess !== hasActiveProcessIdentity ||
    hasActiveProcess !== hasForegroundProcess ||
    hasActiveProcess !== hasProcessVersion ||
    facts.active_process_id !== facts.foreground_slot_process_id ||
    (hasActiveProcess &&
      facts.active_process_slot_generation !== facts.foreground_slot_generation) ||
    (!hasActiveProcess && facts.active_process_slot_generation !== null)
  ) {
    throw new InvalidTrustedAdmissionFactsError(
      "active process identity and foreground slot generation must come from one consistent admission snapshot",
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
  const processStatePrecondition:
    | null
    | {
        readonly process_id: string;
        readonly phase: "execution";
        readonly status: "running";
        readonly updated_at: string;
      }
    | {
        readonly process_id: string;
        readonly phase: "cooldown";
        readonly status: "waiting";
        readonly updated_at: string;
      } =
    facts.active_process === "none"
      ? null
      : facts.active_process === "execution_running"
        ? {
            process_id: facts.active_process_id as string,
            phase: "execution",
            status: "running",
            updated_at: facts.active_process_updated_at as string,
          }
        : {
            process_id: facts.active_process_id as string,
            phase: "cooldown",
            status: "waiting",
            updated_at: facts.active_process_updated_at as string,
          };
  const commitPrecondition = {
    foreground_slot_precondition: {
      process_id: facts.foreground_slot_process_id,
      generation: facts.foreground_slot_generation,
    },
    process_state_precondition: processStatePrecondition,
  } as const;

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
    return facts.foreground_slot_process_id !== null
      ? {
          ...commitPrecondition,
          trigger_status: "accepted",
          priority: "strong",
          action: "enqueue_strong_fifo",
          reason_code: "catch_up_foreground_busy",
          initial_process_state: waitingAdmissionState("deferred_strong_queue"),
        }
      : {
          ...commitPrecondition,
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
          ...commitPrecondition,
          trigger_status: "accepted",
          priority: "strong",
          action: "dispatch",
          reason_code: "timer_due",
          initial_process_state: runningAdmissionState,
        }
      : {
          ...commitPrecondition,
          trigger_status: "accepted",
          priority: "strong",
          action: "dispatch_or_preempt",
          reason_code: "timer_due_preempt_active",
          initial_process_state: waitingAdmissionState("preempt_commit"),
        };
  }

  if (priority === "strong") {
    if (facts.active_process === "none") {
      if (facts.explicit_interrupt) {
        return {
          ...commitPrecondition,
          trigger_status: "accepted",
          priority: "strong",
          action: "dispatch",
          reason_code: "explicit_interrupt",
          initial_process_state: runningAdmissionState,
        };
      }
      return {
        ...commitPrecondition,
        trigger_status: "accepted",
        priority: "strong",
        action: "dispatch",
        reason_code: "strong_no_active_dispatch",
        initial_process_state: runningAdmissionState,
      };
    }
    if (facts.explicit_interrupt) {
      return {
        ...commitPrecondition,
        trigger_status: "accepted",
        priority: "strong",
        action: "dispatch_or_preempt",
        reason_code: "explicit_interrupt",
        initial_process_state: waitingAdmissionState("preempt_commit"),
      };
    }
    return {
      ...commitPrecondition,
      trigger_status: "accepted",
      priority: "strong",
      action: "dispatch_or_preempt",
      reason_code: "strong_preempt_active",
      initial_process_state: waitingAdmissionState("preempt_commit"),
    };
  }

  if (facts.active_process === "none") {
    return {
      ...commitPrecondition,
      trigger_status: "accepted",
      priority: "weak",
      action: "dispatch",
      reason_code: "weak_no_active_dispatch",
      initial_process_state: runningAdmissionState,
    };
  }

  if (facts.active_process === "cooldown_waiting") {
    return {
      ...commitPrecondition,
      trigger_status: "accepted",
      priority: "weak",
      action: "merge_or_enqueue_weak",
      reason_code: "cooldown_merge_candidate",
      initial_process_state: waitingAdmissionState("weak_queue"),
    };
  }
  return {
    ...commitPrecondition,
    trigger_status: "accepted",
    priority: "weak",
    action: "enqueue_weak",
    reason_code: "active_process_running",
    initial_process_state: waitingAdmissionState("weak_queue"),
  };
}
