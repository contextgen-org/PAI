import { Type, type Static, type TLiteral } from "@sinclair/typebox";

import type { TypedEvidenceRefV1 } from "../shared/typed-evidence-ref.v1.js";

export const TERMINAL_OUTCOMES_V1 = [
  "executed",
  "merged_and_executed",
  "superseded_by_later_trigger",
  "deferred_then_executed",
  "expired_with_audit_record",
  "cancelled_with_reason",
  "failed_with_reason",
  "preempted_and_handed_off",
  "interrupted_with_reason",
] as const;

export const TerminalOutcomeV1Schema = Type.Union(
  TERMINAL_OUTCOMES_V1.map((outcome) => Type.Literal(outcome)),
  { $id: "urn:pai:trigger-processor:terminal-outcome:v1" },
);

export type TerminalOutcomeV1 = Static<typeof TerminalOutcomeV1Schema>;

function activeState<
  const TPhase extends "admission" | "context" | "intent" | "execution",
  const TStatus extends "running" | "preempt_requested" | "cancelling",
>(phase: TPhase, status: TStatus) {
  return Type.Object(
    {
      phase: Type.Literal(phase),
      status: Type.Literal(status),
      wait_reason: Type.Null(),
      terminal_reason: Type.Null(),
    },
    { additionalProperties: false },
  );
}

type LiteralSchemas<TValues extends readonly string[]> = {
  [TIndex in keyof TValues]: TLiteral<TValues[TIndex]>;
};

function waitingState<
  const TPhase extends
    | "admission"
    | "context"
    | "intent"
    | "execution"
    | "cooldown"
    | "meta_enqueued",
  const TReasons extends readonly [string, ...string[]],
>(phase: TPhase, reasons: TReasons) {
  const reasonSchemas = reasons.map((reason) =>
    Type.Literal(reason),
  ) as unknown as LiteralSchemas<TReasons> & [
    TLiteral<TReasons[0]>,
    ...TLiteral<string>[],
  ];
  return Type.Object(
    {
      phase: Type.Literal(phase),
      status: Type.Literal("waiting"),
      wait_reason: Type.Union(reasonSchemas),
      terminal_reason: Type.Null(),
    },
    { additionalProperties: false },
  );
}

export const TriggerProcessStateV1Schema = Type.Union(
  [
    activeState("admission", "running"),
    waitingState("admission", [
      "weak_queue",
      "preempt_commit",
      "deferred_strong_queue",
      "stage_retry_wait",
    ]),
    activeState("context", "running"),
    waitingState("context", ["runtime_start_recompose", "stage_retry_wait"]),
    activeState("intent", "running"),
    waitingState("intent", ["external_confirmation", "stage_retry_wait"]),
    waitingState("execution", [
      "runtime_start",
      "runtime_start_reconcile",
      "stage_retry_wait",
    ]),
    activeState("execution", "running"),
    activeState("execution", "preempt_requested"),
    activeState("execution", "cancelling"),
    waitingState("cooldown", ["cooldown_until"]),
    waitingState("meta_enqueued", ["meta_enqueue_wait"]),
    Type.Object(
      {
        phase: Type.Literal("closed"),
        status: Type.Union([
          Type.Literal("completed"),
          Type.Literal("failed"),
          Type.Literal("preempted"),
          Type.Literal("cancelled"),
        ]),
        wait_reason: Type.Null(),
        terminal_reason: Type.String({ minLength: 1 }),
      },
      { additionalProperties: false },
    ),
  ],
  { $id: "urn:pai:trigger-processor:trigger-process-state:v1" },
);

export type TriggerProcessStateV1 = Static<typeof TriggerProcessStateV1Schema>;

function stateKey(state: TriggerProcessStateV1): string {
  return `${state.phase}/${state.status}/${state.wait_reason ?? "-"}`;
}

const directEdges = new Set([
  "admission/running/-->context/running/-",
  "admission/waiting/weak_queue->context/running/-",
  "admission/waiting/preempt_commit->context/running/-",
  "admission/waiting/deferred_strong_queue->context/running/-",
  "context/running/-->intent/running/-",
  "intent/running/-->intent/waiting/external_confirmation",
  "intent/waiting/external_confirmation->intent/running/-",
  "intent/running/-->execution/waiting/runtime_start",
  "execution/waiting/runtime_start->execution/running/-",
  "execution/waiting/runtime_start->execution/waiting/runtime_start_reconcile",
  "execution/waiting/runtime_start_reconcile->execution/running/-",
  "execution/waiting/runtime_start->context/waiting/runtime_start_recompose",
  "execution/waiting/runtime_start_reconcile->context/waiting/runtime_start_recompose",
  "context/waiting/runtime_start_recompose->context/running/-",
  "execution/running/-->execution/preempt_requested/-",
  "execution/running/-->execution/cancelling/-",
  "execution/preempt_requested/-->execution/cancelling/-",
]);

const retryablePhases = new Set(["admission", "context", "intent", "execution"]);

type RuntimeBoundaryEvidenceV1 =
  | {
      readonly runtime_state: "not_running";
      readonly runtime_stop_or_isolation_proof_ref?: never;
    }
  | {
      readonly runtime_state: "stopped_or_isolated";
      readonly runtime_stop_or_isolation_proof_ref: string;
    };

interface TerminalTransactionEvidenceV1 {
  readonly terminal_outcome: TerminalOutcomeV1;
  readonly terminal_outcome_finalized_at: string;
  readonly canonical_reason_code: string;
  readonly transition_audit_ref: string;
  readonly outbox_event_ref: string;
}

/**
 * Durable facts that must already be part of the same owner transaction as the
 * requested state transition. References are used instead of caller assertions
 * so repository code has to pass the persisted evidence it committed.
 */
export type TriggerProcessTransitionEvidenceV1 =
  | {
      readonly kind: "execution_completed";
      readonly runtime_terminal_outcome: "completed";
      readonly runtime_terminal_event_ref: TypedEvidenceRefV1;
      readonly snapshot_append_ref: string;
      readonly cooldown_until: string;
      readonly completion_won_preempt_race: boolean;
      readonly preempt_race_proof_ref: string | null;
      readonly transition_audit_ref: string;
      readonly outbox_event_ref: string;
    }
  | {
      readonly kind: "cooldown_expired_meta_enqueue";
      readonly enqueue_reason: "cooldown_expired";
      readonly trigger_process_id: string;
      readonly meta_enqueue_idempotency_key: string;
      readonly process_lock_ref: string;
      readonly cooldown_expired_at: string;
      readonly snapshot_retention_until: string;
      readonly preempted_by_process_id: null;
      readonly existing_meta_enqueue_intent_ref: null;
      readonly transition_audit_ref: string;
      readonly meta_enqueue_outbox_ref: string;
    }
  | ({
      readonly kind: "meta_enqueue";
      readonly enqueue_reason:
        | "user_retracted"
        | "system_interrupted"
        | "failed_with_learnable_snapshot";
      readonly boundary_system_event_ref: TypedEvidenceRefV1;
      readonly snapshot_ref: string;
      readonly snapshot_freeze_ref: string;
      readonly learnable_snapshot_ready: true;
      readonly transition_audit_ref: string;
      readonly meta_enqueue_outbox_ref: string;
    } & RuntimeBoundaryEvidenceV1)
  | ({
      readonly kind: "explicit_cancel";
      readonly terminal_outcome:
        | "cancelled_with_reason"
        | "superseded_by_later_trigger";
      readonly superseded_by_process_id?: string;
    } & RuntimeBoundaryEvidenceV1 &
      Omit<TerminalTransactionEvidenceV1, "terminal_outcome">)
  | ({
      readonly kind: "unrecoverable_failure";
      readonly terminal_outcome: "failed_with_reason";
    } & RuntimeBoundaryEvidenceV1 &
      Omit<TerminalTransactionEvidenceV1, "terminal_outcome">)
  | ({
      readonly kind: "preempt_handoff";
      readonly terminal_outcome: "preempted_and_handed_off";
      readonly snapshot_freeze_ref: string;
      readonly successor_process_id: string;
      readonly snapshot_transfer_ref: string;
      readonly foreground_slot_transfer_ref: string;
    } & RuntimeBoundaryEvidenceV1 &
      Omit<TerminalTransactionEvidenceV1, "terminal_outcome">)
  | {
      readonly kind: "weak_merge";
      readonly terminal_outcome: null;
      readonly terminal_outcome_finalized_at: null;
      readonly canonical_process_id: string;
      readonly merged_into_process_id: string;
      readonly transition_audit_ref: string;
      readonly outbox_event_ref: string;
    }
  | ({
      readonly kind: "meta_finalization";
    } & TerminalTransactionEvidenceV1);

function isNonEmptyRef(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !value.includes("\r") &&
    !value.includes("\n")
  );
}

function isSystemEventRef(value: unknown): value is TypedEvidenceRefV1 {
  return typeof value === "string" && /^system_event:[^\r\n]+$/.test(value);
}

function isTriggerEventRef(value: unknown): value is TypedEvidenceRefV1 {
  return typeof value === "string" && /^trigger_event:[^\r\n]+$/.test(value);
}

function isTerminalOutcome(value: unknown): value is TerminalOutcomeV1 {
  return (TERMINAL_OUTCOMES_V1 as readonly unknown[]).includes(value);
}

function isTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !Number.isNaN(Date.parse(value))
  );
}

function hasRuntimeBoundaryEvidence(
  from: TriggerProcessStateV1,
  evidence: RuntimeBoundaryEvidenceV1,
): boolean {
  if (from.phase !== "execution") return evidence.runtime_state === "not_running";
  return (
    evidence.runtime_state === "stopped_or_isolated" &&
    isNonEmptyRef(evidence.runtime_stop_or_isolation_proof_ref)
  );
}

function hasTerminalTransactionEvidence(
  to: Extract<TriggerProcessStateV1, { phase: "closed" }>,
  evidence: TerminalTransactionEvidenceV1,
): boolean {
  return (
    to.terminal_reason !== "merged" &&
    isTerminalOutcome(evidence.terminal_outcome) &&
    evidence.canonical_reason_code === to.terminal_reason &&
    isNonEmptyRef(evidence.canonical_reason_code) &&
    isTimestamp(evidence.terminal_outcome_finalized_at) &&
    isNonEmptyRef(evidence.transition_audit_ref) &&
    isNonEmptyRef(evidence.outbox_event_ref)
  );
}

function isInitialAdmissionState(state: TriggerProcessStateV1): boolean {
  return (
    state.phase === "admission" &&
    (state.status === "running" ||
      (state.status === "waiting" && state.wait_reason !== "stage_retry_wait"))
  );
}

export function isTriggerProcessTransitionV1Allowed(
  from: TriggerProcessStateV1 | null,
  to: TriggerProcessStateV1,
  evidence?: TriggerProcessTransitionEvidenceV1,
): boolean {
  if (from === null) return isInitialAdmissionState(to);
  if (from.phase === "closed") return false;

  if (
    from.phase === to.phase &&
    retryablePhases.has(from.phase) &&
    ((from.status === "running" &&
      to.status === "waiting" &&
      to.wait_reason === "stage_retry_wait") ||
      (from.status === "waiting" &&
        from.wait_reason === "stage_retry_wait" &&
        to.status === "running"))
  ) {
    return true;
  }

  if (directEdges.has(`${stateKey(from)}->${stateKey(to)}`)) return true;

  if (
    to.phase === "cooldown" &&
    to.status === "waiting" &&
    to.wait_reason === "cooldown_until"
  ) {
    return (
      from.phase === "execution" &&
      (from.status === "running" || from.status === "preempt_requested") &&
      evidence?.kind === "execution_completed" &&
      evidence.runtime_terminal_outcome === "completed" &&
      isTriggerEventRef(evidence.runtime_terminal_event_ref) &&
      isNonEmptyRef(evidence.snapshot_append_ref) &&
      isTimestamp(evidence.cooldown_until) &&
      evidence.completion_won_preempt_race ===
        (from.status === "preempt_requested") &&
      (evidence.completion_won_preempt_race
        ? isNonEmptyRef(evidence.preempt_race_proof_ref)
        : evidence.preempt_race_proof_ref === null) &&
      isNonEmptyRef(evidence.transition_audit_ref) &&
      isNonEmptyRef(evidence.outbox_event_ref)
    );
  }

  if (to.phase === "meta_enqueued") {
    if (evidence?.kind === "cooldown_expired_meta_enqueue") {
      const cooldownExpiredAt = Date.parse(evidence.cooldown_expired_at);
      const snapshotRetentionUntil = Date.parse(
        evidence.snapshot_retention_until,
      );
      return (
        from.phase === "cooldown" &&
        from.status === "waiting" &&
        from.wait_reason === "cooldown_until" &&
        to.wait_reason === "meta_enqueue_wait" &&
        isNonEmptyRef(evidence.trigger_process_id) &&
        evidence.meta_enqueue_idempotency_key === evidence.trigger_process_id &&
        isNonEmptyRef(evidence.process_lock_ref) &&
        Number.isFinite(cooldownExpiredAt) &&
        Number.isFinite(snapshotRetentionUntil) &&
        snapshotRetentionUntil > cooldownExpiredAt &&
        evidence.preempted_by_process_id === null &&
        evidence.existing_meta_enqueue_intent_ref === null &&
        isNonEmptyRef(evidence.transition_audit_ref) &&
        isNonEmptyRef(evidence.meta_enqueue_outbox_ref)
      );
    }
    return (
      to.wait_reason === "meta_enqueue_wait" &&
      evidence?.kind === "meta_enqueue" &&
      from.phase !== "meta_enqueued" &&
      from.phase !== "cooldown" &&
      isSystemEventRef(evidence.boundary_system_event_ref) &&
      isNonEmptyRef(evidence.snapshot_ref) &&
      isNonEmptyRef(evidence.snapshot_freeze_ref) &&
      evidence.learnable_snapshot_ready === true &&
      isNonEmptyRef(evidence.transition_audit_ref) &&
      isNonEmptyRef(evidence.meta_enqueue_outbox_ref) &&
      hasRuntimeBoundaryEvidence(from, evidence)
    );
  }

  if (to.phase === "closed") {
    if (
      to.terminal_reason === "failed_not_isolated" ||
      to.terminal_reason === "failed_but_isolated"
    ) {
      return false;
    }

    if (evidence?.kind === "weak_merge") {
      return (
        from.phase === "admission" &&
        from.status === "waiting" &&
        from.wait_reason === "weak_queue" &&
        to.status === "completed" &&
        to.terminal_reason === "merged" &&
        evidence.terminal_outcome === null &&
        evidence.terminal_outcome_finalized_at === null &&
        isNonEmptyRef(evidence.canonical_process_id) &&
        evidence.merged_into_process_id === evidence.canonical_process_id &&
        isNonEmptyRef(evidence.transition_audit_ref) &&
        isNonEmptyRef(evidence.outbox_event_ref)
      );
    }

    if (evidence?.kind === "meta_finalization") {
      return (
        from.phase === "meta_enqueued" &&
        (to.status === "completed" || to.status === "failed") &&
        (to.status !== "failed" ||
          evidence.terminal_outcome === "failed_with_reason") &&
        hasTerminalTransactionEvidence(to, evidence)
      );
    }

    if (evidence?.kind === "explicit_cancel") {
      const superseded =
        evidence.terminal_outcome === "superseded_by_later_trigger";
      const sourceAllowed =
        from.phase === "execution"
          ? from.status === "cancelling"
          : from.phase !== "meta_enqueued";
      return (
        to.status === "cancelled" &&
        (evidence.terminal_outcome === "cancelled_with_reason" || superseded) &&
        sourceAllowed &&
        hasRuntimeBoundaryEvidence(from, evidence) &&
        hasTerminalTransactionEvidence(to, evidence) &&
        (!superseded ||
          (from.phase === "admission" &&
            from.status === "waiting" &&
            isNonEmptyRef(evidence.superseded_by_process_id)))
      );
    }

    if (evidence?.kind === "unrecoverable_failure") {
      return (
        to.status === "failed" &&
        evidence.terminal_outcome === "failed_with_reason" &&
        hasRuntimeBoundaryEvidence(from, evidence) &&
        hasTerminalTransactionEvidence(to, evidence)
      );
    }

    if (evidence?.kind === "preempt_handoff") {
      const sourceAllowed =
        (from.phase === "execution" && from.status === "preempt_requested") ||
        (from.phase === "cooldown" &&
          from.status === "waiting" &&
          from.wait_reason === "cooldown_until");
      return (
        to.status === "preempted" &&
        evidence.terminal_outcome === "preempted_and_handed_off" &&
        sourceAllowed &&
        hasRuntimeBoundaryEvidence(from, evidence) &&
        hasTerminalTransactionEvidence(to, evidence) &&
        isNonEmptyRef(evidence.snapshot_freeze_ref) &&
        isNonEmptyRef(evidence.successor_process_id) &&
        isNonEmptyRef(evidence.snapshot_transfer_ref) &&
        isNonEmptyRef(evidence.foreground_slot_transfer_ref)
      );
    }

    return false;
  }

  return false;
}

export const TRIGGER_PROCESS_STATE_V1_DATABASE_CHECK = String.raw`
CHECK ((status = 'waiting') = (wait_reason IS NOT NULL)),
CHECK ((phase = 'closed') = (terminal_reason IS NOT NULL)),
CHECK (
  (phase = 'admission' AND status = 'running' AND wait_reason IS NULL)
  OR (phase = 'admission' AND status = 'waiting' AND wait_reason IN ('weak_queue', 'preempt_commit', 'deferred_strong_queue', 'stage_retry_wait'))
  OR (phase = 'context' AND status = 'running' AND wait_reason IS NULL)
  OR (phase = 'context' AND status = 'waiting' AND wait_reason IN ('runtime_start_recompose', 'stage_retry_wait'))
  OR (phase = 'intent' AND status = 'running' AND wait_reason IS NULL)
  OR (phase = 'intent' AND status = 'waiting' AND wait_reason IN ('external_confirmation', 'stage_retry_wait'))
  OR (phase = 'execution' AND status = 'waiting' AND wait_reason IN ('runtime_start', 'runtime_start_reconcile', 'stage_retry_wait'))
  OR (phase = 'execution' AND status IN ('running', 'preempt_requested', 'cancelling') AND wait_reason IS NULL)
  OR (phase = 'cooldown' AND status = 'waiting' AND wait_reason = 'cooldown_until')
  OR (phase = 'meta_enqueued' AND status = 'waiting' AND wait_reason = 'meta_enqueue_wait')
  OR (phase = 'closed' AND status IN ('completed', 'failed', 'preempted', 'cancelled') AND wait_reason IS NULL)
)`;
