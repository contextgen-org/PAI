import type {
  TriggerPriorityV1,
} from "@pai/contracts";
import {
  TriggerAdmissionDecisionV1Schema,
  type TriggerAdmissionDecisionV1,
  TrustedAdmissionFactsV1Schema,
  type TrustedAdmissionFactsV1,
} from "@pai/contracts";
import { Value } from "@sinclair/typebox/value";

export type { TrustedAdmissionFactsV1 } from "@pai/contracts";

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
  const expected = decision.admission_precondition;
  const matches =
    expected.kind === "idle"
      ? expected.process_id === null &&
        currentSlot.process_id === null &&
        expected.slot_generation === currentSlot.generation &&
        currentProcess === null
      : currentSlot.process_id === expected.process_id &&
        currentSlot.generation === expected.slot_generation &&
        currentProcess !== null &&
        currentProcess.process_id === expected.process_id &&
        currentProcess.phase === expected.phase &&
        currentProcess.status === expected.status &&
        currentProcess.updated_at === expected.process_updated_at;
  if (!matches) {
    throw new StaleTriggerAdmissionDecisionError();
  }
}

function assertConsistentForegroundState(
  facts: TrustedAdmissionFactsV1,
): void {
  const hasActiveProcess = facts.active_process !== "none";
  const canonicalDateTimePattern =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/u;
  const invalidIdleShape =
    !hasActiveProcess &&
    (facts.active_process_id !== null ||
      facts.active_process_slot_generation !== null ||
      facts.active_process_updated_at !== null ||
      facts.foreground_slot_process_id !== null);
  const invalidOccupiedShape =
    hasActiveProcess &&
    (typeof facts.active_process_id !== "string" ||
      typeof facts.active_process_updated_at !== "string" ||
      typeof facts.foreground_slot_process_id !== "string" ||
      !Number.isSafeInteger(facts.active_process_slot_generation));
  if (
    !Number.isSafeInteger(facts.foreground_slot_generation) ||
    facts.foreground_slot_generation < 0 ||
    invalidIdleShape ||
    invalidOccupiedShape ||
    facts.active_process_id !== facts.foreground_slot_process_id ||
    (hasActiveProcess &&
      (facts.active_process_slot_generation < 0 ||
        facts.active_process_slot_generation !== facts.foreground_slot_generation ||
        facts.active_process_id.trim().length === 0 ||
        facts.active_process_updated_at.trim().length === 0 ||
        !canonicalDateTimePattern.test(facts.active_process_updated_at) ||
        !Number.isFinite(Date.parse(facts.active_process_updated_at))))
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

function decideTriggerAdmissionUncheckedV1(
  facts: TrustedAdmissionFactsV1,
): TriggerAdmissionDecisionV1 {
  assertConsistentForegroundState(facts);
  const priority = calculateTriggerPriorityV1(facts);
  const admissionPrecondition: Extract<
    TriggerAdmissionDecisionV1,
    { trigger_status: "accepted" }
  >["admission_precondition"] =
    facts.active_process === "none"
      ? {
          kind: "idle" as const,
          process_id: null,
          slot_generation: facts.foreground_slot_generation,
        }
      : facts.active_process === "execution_running"
        ? {
            kind: "occupied" as const,
            process_id: facts.active_process_id,
            slot_generation: facts.foreground_slot_generation,
            phase: "execution",
            status: "running",
            process_updated_at: facts.active_process_updated_at,
          }
        : {
            kind: "occupied" as const,
            process_id: facts.active_process_id,
            slot_generation: facts.foreground_slot_generation,
            phase: "cooldown",
            status: "waiting",
            process_updated_at: facts.active_process_updated_at,
          };
  const commitPrecondition = {
    admission_precondition: admissionPrecondition,
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

export function decideTriggerAdmissionV1(
  facts: TrustedAdmissionFactsV1,
): TriggerAdmissionDecisionV1 {
  if (!Value.Check(TrustedAdmissionFactsV1Schema, facts)) {
    throw new InvalidTrustedAdmissionFactsError(
      "admission facts violate TrustedAdmissionFactsV1",
    );
  }
  const decision = decideTriggerAdmissionUncheckedV1(facts);
  if (!Value.Check(TriggerAdmissionDecisionV1Schema, decision)) {
    throw new InvalidTrustedAdmissionFactsError(
      "admission facts produced a decision outside TriggerAdmissionDecisionV1",
    );
  }
  return decision;
}
