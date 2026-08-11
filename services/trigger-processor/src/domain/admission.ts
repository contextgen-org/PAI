import type {
  TriggerPriorityV1,
} from "@pai/contracts";
import {
  canonicalJsonV1,
  TriggerAdmissionDecisionV1Schema,
  type TriggerAdmissionDecisionV1,
  TrustedAdmissionFactsV1Schema,
  type TrustedAdmissionFactsV1,
} from "@pai/contracts";
import { Value } from "@sinclair/typebox/value";

export type { TrustedAdmissionFactsV1 } from "@pai/contracts";

export class InvalidTrustedAdmissionFactsError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "InvalidTrustedAdmissionFactsError";
  }
}

export class StaleTriggerAdmissionDecisionError extends Error {
  public constructor() {
    super("foreground slot changed before atomic trigger admission commit");
    this.name = "StaleTriggerAdmissionDecisionError";
  }
}

/** Invoked by create_trigger_admission_v1 while holding the owner transaction lock. */
export function assertTriggerAdmissionCommitPreconditionV1(
  decision: Extract<TriggerAdmissionDecisionV1, { trigger_status: "accepted" }>,
  currentSlot: { readonly process_id: string | null; readonly generation: number },
  currentProcess: {
    readonly process_id: string;
    readonly phase: "context" | "intent" | "execution" | "cooldown";
    readonly status:
      | "running"
      | "waiting"
      | "preempt_requested"
      | "cancelling";
    readonly state_version: number;
  } | null,
  currentStrongFifo: {
    readonly revision: number;
    readonly head_process_id: string | null;
    readonly head_admission_time: string | null;
    readonly preempt_commit_process_id: string | null;
  },
): void {
  try {
    canonicalJsonV1(decision);
    canonicalJsonV1(currentSlot);
    canonicalJsonV1(currentProcess);
    canonicalJsonV1(currentStrongFifo);
  } catch (error) {
    throw new InvalidTrustedAdmissionFactsError(
      "admission commit inputs violate the canonical JSON boundary",
      { cause: error },
    );
  }
  const expected = decision.admission_precondition;
  const queueMatches =
    expected.strong_fifo_revision === currentStrongFifo.revision &&
    expected.strong_fifo_head_process_id === currentStrongFifo.head_process_id &&
    expected.strong_fifo_head_admission_time ===
      currentStrongFifo.head_admission_time &&
    expected.strong_fifo_preempt_commit_process_id ===
      currentStrongFifo.preempt_commit_process_id;
  const matches =
    queueMatches &&
    (expected.kind === "idle"
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
        currentProcess.state_version === expected.process_state_version);
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
      facts.active_process_state_version !== null ||
      facts.foreground_slot_process_id !== null);
  const invalidOccupiedShape =
    hasActiveProcess &&
    (typeof facts.active_process_id !== "string" ||
      typeof facts.foreground_slot_process_id !== "string" ||
      !Number.isSafeInteger(facts.active_process_slot_generation) ||
      !Number.isSafeInteger(facts.active_process_state_version));
  const queueHeadShapeMatches =
    (facts.strong_fifo_head_process_id === null) ===
    (facts.strong_fifo_head_admission_time === null);
  const validPreemptHead =
    facts.strong_fifo_preempt_commit_process_id === null ||
    facts.strong_fifo_preempt_commit_process_id ===
      facts.strong_fifo_head_process_id;
  if (
    !Number.isSafeInteger(facts.foreground_slot_generation) ||
    facts.foreground_slot_generation < 0 ||
    !Number.isSafeInteger(facts.strong_fifo_revision) ||
    facts.strong_fifo_revision < 0 ||
    !queueHeadShapeMatches ||
    (facts.strong_fifo_head_admission_time !== null &&
      (!canonicalDateTimePattern.test(
        facts.strong_fifo_head_admission_time,
      ) ||
        !Number.isFinite(
          Date.parse(facts.strong_fifo_head_admission_time),
        ))) ||
    !validPreemptHead ||
    invalidIdleShape ||
    invalidOccupiedShape ||
    facts.active_process_id !== facts.foreground_slot_process_id ||
    (hasActiveProcess &&
      (facts.active_process_slot_generation < 0 ||
        facts.active_process_slot_generation !== facts.foreground_slot_generation ||
        facts.active_process_id.trim().length === 0 ||
        facts.active_process_state_version < 1))
  ) {
    throw new InvalidTrustedAdmissionFactsError(
      "foreground slot, process state, and Strong FIFO head must come from one consistent admission snapshot",
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

type AcceptedAdmissionPreconditionV1 = Extract<
  TriggerAdmissionDecisionV1,
  { trigger_status: "accepted" }
>["admission_precondition"];

/**
 * The foreground slot remains owned across Runtime Start recovery and a
 * preempt handoff. Only an executing Runtime in `running` has the immutable
 * Runtime Start binding required to safely emit a Runtime preempt command.
 */
function admissionPreconditionForFactsV1(
  facts: TrustedAdmissionFactsV1,
): AcceptedAdmissionPreconditionV1 {
  const fifo = {
    strong_fifo_revision: facts.strong_fifo_revision,
    strong_fifo_head_process_id: facts.strong_fifo_head_process_id,
    strong_fifo_head_admission_time: facts.strong_fifo_head_admission_time,
    strong_fifo_preempt_commit_process_id:
      facts.strong_fifo_preempt_commit_process_id,
  } as const;
  switch (facts.active_process) {
    case "none":
      return {
        kind: "idle",
        process_id: null,
        slot_generation: facts.foreground_slot_generation,
        ...fifo,
      };
    case "context_running":
      return occupiedAdmissionPreconditionV1(facts, "context", "running", fifo);
    case "context_waiting":
      return occupiedAdmissionPreconditionV1(facts, "context", "waiting", fifo);
    case "intent_running":
      return occupiedAdmissionPreconditionV1(facts, "intent", "running", fifo);
    case "intent_waiting":
      return occupiedAdmissionPreconditionV1(facts, "intent", "waiting", fifo);
    case "execution_running":
      return occupiedAdmissionPreconditionV1(facts, "execution", "running", fifo);
    case "execution_waiting":
      return occupiedAdmissionPreconditionV1(facts, "execution", "waiting", fifo);
    case "execution_preempt_requested":
      return occupiedAdmissionPreconditionV1(
        facts,
        "execution",
        "preempt_requested",
        fifo,
      );
    case "execution_cancelling":
      return occupiedAdmissionPreconditionV1(facts, "execution", "cancelling", fifo);
    case "cooldown_waiting":
      return occupiedAdmissionPreconditionV1(facts, "cooldown", "waiting", fifo);
  }
}

function occupiedAdmissionPreconditionV1(
  facts: Exclude<TrustedAdmissionFactsV1, { active_process: "none" }>,
  phase: "context" | "intent" | "execution" | "cooldown",
  status: "running" | "waiting" | "preempt_requested" | "cancelling",
  fifo: Pick<
    AcceptedAdmissionPreconditionV1,
    | "strong_fifo_revision"
    | "strong_fifo_head_process_id"
    | "strong_fifo_head_admission_time"
    | "strong_fifo_preempt_commit_process_id"
  >,
): AcceptedAdmissionPreconditionV1 {
  return {
    kind: "occupied",
    process_id: facts.active_process_id,
    slot_generation: facts.foreground_slot_generation,
    phase,
    status,
    process_state_version: facts.active_process_state_version,
    ...fifo,
  } as AcceptedAdmissionPreconditionV1;
}

function isPreemptibleExecutionV1(facts: TrustedAdmissionFactsV1): boolean {
  return facts.active_process === "execution_running";
}

function decideTriggerAdmissionUncheckedV1(
  facts: TrustedAdmissionFactsV1,
): TriggerAdmissionDecisionV1 {
  assertConsistentForegroundState(facts);
  const priority = calculateTriggerPriorityV1(facts);
  const admissionPrecondition = admissionPreconditionForFactsV1(facts);
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

  if (facts.strong_fifo_head_process_id !== null) {
    return priority === "strong"
      ? {
          ...commitPrecondition,
          trigger_status: "accepted",
          priority: "strong",
          action: "enqueue_strong_fifo",
          reason_code: "strong_fifo_waiting",
          initial_process_state: waitingAdmissionState("deferred_strong_queue"),
        }
      : {
          ...commitPrecondition,
          trigger_status: "accepted",
          priority: "weak",
          action: "enqueue_weak",
          reason_code: "strong_fifo_waiting",
          initial_process_state: waitingAdmissionState("weak_queue"),
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
      : facts.active_process === "cooldown_waiting"
        ? {
            ...commitPrecondition,
            trigger_status: "accepted",
            priority: "strong",
            action: "dispatch",
            reason_code: "timer_due_supersede_cooldown",
            initial_process_state: runningAdmissionState,
          }
      : isPreemptibleExecutionV1(facts)
        ? {
          ...commitPrecondition,
          trigger_status: "accepted",
          priority: "strong",
          action: "dispatch_or_preempt",
          reason_code: "timer_due_preempt_active",
          initial_process_state: waitingAdmissionState("preempt_commit"),
        }
        : {
            ...commitPrecondition,
            trigger_status: "accepted",
            priority: "strong",
            action: "enqueue_strong_fifo",
            reason_code: "strong_fifo_waiting",
            initial_process_state: waitingAdmissionState("deferred_strong_queue"),
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
    // Cooldown is post-execution learning, not an executing Runtime. A
    // trusted strong signal may replace it without a meaningless preempt.
    if (facts.active_process === "cooldown_waiting") {
      return {
        ...commitPrecondition,
        trigger_status: "accepted",
        priority: "strong",
        action: "dispatch",
        reason_code: "strong_supersede_cooldown",
        initial_process_state: runningAdmissionState,
      };
    }
    if (isPreemptibleExecutionV1(facts) && facts.explicit_interrupt) {
      return {
        ...commitPrecondition,
        trigger_status: "accepted",
        priority: "strong",
        action: "dispatch_or_preempt",
        reason_code: "explicit_interrupt",
        initial_process_state: waitingAdmissionState("preempt_commit"),
      };
    }
    if (isPreemptibleExecutionV1(facts)) {
      return {
        ...commitPrecondition,
        trigger_status: "accepted",
        priority: "strong",
        action: "dispatch_or_preempt",
        reason_code: "strong_preempt_active",
        initial_process_state: waitingAdmissionState("preempt_commit"),
      };
    }
    return {
      ...commitPrecondition,
      trigger_status: "accepted",
      priority: "strong",
      action: "enqueue_strong_fifo",
      reason_code: "strong_fifo_waiting",
      initial_process_state: waitingAdmissionState("deferred_strong_queue"),
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
  try {
    canonicalJsonV1(facts);
  } catch (error) {
    throw new InvalidTrustedAdmissionFactsError(
      "admission facts violate the canonical JSON boundary",
      { cause: error },
    );
  }
  if (!Value.Check(TrustedAdmissionFactsV1Schema, facts)) {
    throw new InvalidTrustedAdmissionFactsError(
      "admission facts violate TrustedAdmissionFactsV1",
    );
  }
  const decision = decideTriggerAdmissionUncheckedV1(facts);
  try {
    canonicalJsonV1(decision);
  } catch (error) {
    throw new InvalidTrustedAdmissionFactsError(
      "admission facts produced a non-canonical decision",
      { cause: error },
    );
  }
  if (!Value.Check(TriggerAdmissionDecisionV1Schema, decision)) {
    throw new InvalidTrustedAdmissionFactsError(
      "admission facts produced a decision outside TriggerAdmissionDecisionV1",
    );
  }
  return decision;
}
