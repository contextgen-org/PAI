import {
  Type,
  type Static,
  type TLiteral,
  type TProperties,
} from "@sinclair/typebox";

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

export const META_ENQUEUE_REASONS_V1 = [
  "cooldown_expired",
  "user_retracted",
  "system_interrupted",
  "failed_with_learnable_snapshot",
] as const;

export const MetaEnqueueReasonV1Schema = Type.Union(
  META_ENQUEUE_REASONS_V1.map((reason) => Type.Literal(reason)),
);

export type MetaEnqueueReasonV1 = Static<typeof MetaEnqueueReasonV1Schema>;

export const CLOSED_STATUS_TERMINAL_OUTCOMES_V1 = {
  completed: [
    "executed",
    "merged_and_executed",
    "deferred_then_executed",
    "expired_with_audit_record",
  ],
  failed: ["failed_with_reason"],
  preempted: ["preempted_and_handed_off"],
  cancelled: [
    "cancelled_with_reason",
    "superseded_by_later_trigger",
    "interrupted_with_reason",
  ],
} as const satisfies Readonly<
  Record<"completed" | "failed" | "preempted" | "cancelled", readonly TerminalOutcomeV1[]>
>;

export const TRIGGER_PROCESS_ACTIVE_STATUSES_V1 = {
  admission: ["running"],
  context: ["running"],
  intent: ["running"],
  execution: ["running", "preempt_requested", "cancelling"],
} as const;

export const TRIGGER_PROCESS_WAIT_REASONS_V1 = {
  admission: [
    "weak_queue",
    "preempt_commit",
    "deferred_strong_queue",
    "stage_retry_wait",
  ],
  context: ["runtime_start_recompose", "stage_retry_wait"],
  intent: ["external_confirmation", "stage_retry_wait"],
  execution: [
    "runtime_start",
    "runtime_start_reconcile",
    "stage_retry_wait",
  ],
  cooldown: ["cooldown_until"],
  meta_enqueued: ["meta_enqueue_wait"],
} as const;

export const TRIGGER_PROCESS_CLOSED_STATUSES_V1 = [
  "completed",
  "failed",
  "preempted",
  "cancelled",
] as const;

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

const metaEnqueuedStateSchema = Type.Object(
  {
    phase: Type.Literal("meta_enqueued"),
    status: Type.Literal("waiting"),
    wait_reason: Type.Literal("meta_enqueue_wait"),
    terminal_reason: Type.Null(),
    meta_enqueue_reason: MetaEnqueueReasonV1Schema,
  },
  { additionalProperties: false },
);

export const TriggerProcessStateV1Schema = Type.Union(
  [
    activeState("admission", TRIGGER_PROCESS_ACTIVE_STATUSES_V1.admission[0]),
    waitingState("admission", TRIGGER_PROCESS_WAIT_REASONS_V1.admission),
    activeState("context", TRIGGER_PROCESS_ACTIVE_STATUSES_V1.context[0]),
    waitingState("context", TRIGGER_PROCESS_WAIT_REASONS_V1.context),
    activeState("intent", TRIGGER_PROCESS_ACTIVE_STATUSES_V1.intent[0]),
    waitingState("intent", TRIGGER_PROCESS_WAIT_REASONS_V1.intent),
    waitingState("execution", TRIGGER_PROCESS_WAIT_REASONS_V1.execution),
    activeState("execution", TRIGGER_PROCESS_ACTIVE_STATUSES_V1.execution[0]),
    activeState("execution", TRIGGER_PROCESS_ACTIVE_STATUSES_V1.execution[1]),
    activeState("execution", TRIGGER_PROCESS_ACTIVE_STATUSES_V1.execution[2]),
    waitingState("cooldown", TRIGGER_PROCESS_WAIT_REASONS_V1.cooldown),
    metaEnqueuedStateSchema,
    Type.Object(
      {
        phase: Type.Literal("closed"),
        status: Type.Union(
          TRIGGER_PROCESS_CLOSED_STATUSES_V1.map((status) =>
            Type.Literal(status),
          ),
        ),
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

const evidenceRefSchema = Type.String({ minLength: 1, pattern: "^[^\\r\\n]+$" });
const timestampSchema = Type.String({ minLength: 1, format: "date-time" });
const systemEventRefSchema = Type.String({ pattern: "^system_event:[^\\r\\n]+$" });
const triggerEventRefSchema = Type.String({ pattern: "^trigger_event:[^\\r\\n]+$" });

function strictEvidenceObject<const T extends TProperties>(properties: T) {
  return Type.Object(properties, { additionalProperties: false });
}

function withRuntimeBoundary<const T extends TProperties>(properties: T) {
  return Type.Union([
    strictEvidenceObject({ ...properties, runtime_state: Type.Literal("not_running") }),
    strictEvidenceObject({
      ...properties,
      runtime_state: Type.Literal("stopped_or_isolated"),
      runtime_stop_or_isolation_proof_ref: evidenceRefSchema,
    }),
  ]);
}

const terminalTransactionProperties = {
  terminal_outcome: TerminalOutcomeV1Schema,
  terminal_outcome_finalized_at: timestampSchema,
  canonical_reason_code: evidenceRefSchema,
  transition_audit_ref: evidenceRefSchema,
  outbox_event_ref: evidenceRefSchema,
} as const;

/**
 * Durable facts that must already be part of the same owner transaction as the
 * requested state transition. References are used instead of caller assertions
 * so repository code has to pass the persisted evidence it committed.
 */
export const TriggerProcessTransitionEvidenceV1Schema = Type.Union(
  [
    strictEvidenceObject({
      kind: Type.Literal("execution_completed"),
      runtime_terminal_outcome: Type.Literal("completed"),
      runtime_terminal_event_ref: triggerEventRefSchema,
      snapshot_append_ref: evidenceRefSchema,
      cooldown_until: timestampSchema,
      completion_won_preempt_race: Type.Boolean(),
      preempt_race_proof_ref: Type.Union([evidenceRefSchema, Type.Null()]),
      transition_audit_ref: evidenceRefSchema,
      outbox_event_ref: evidenceRefSchema,
    }),
    strictEvidenceObject({
      kind: Type.Literal("cooldown_expired_meta_enqueue"),
      enqueue_reason: Type.Literal("cooldown_expired"),
      trigger_process_id: evidenceRefSchema,
      meta_enqueue_idempotency_key: evidenceRefSchema,
      process_lock_ref: evidenceRefSchema,
      cooldown_expired_at: timestampSchema,
      snapshot_retention_until: timestampSchema,
      preempted_by_process_id: Type.Null(),
      existing_meta_enqueue_intent_ref: Type.Null(),
      transition_audit_ref: evidenceRefSchema,
      meta_enqueue_outbox_ref: evidenceRefSchema,
    }),
    withRuntimeBoundary({
      kind: Type.Literal("meta_enqueue"),
      enqueue_reason: Type.Union([
        Type.Literal("user_retracted"),
        Type.Literal("system_interrupted"),
        Type.Literal("failed_with_learnable_snapshot"),
      ]),
      boundary_system_event_ref: systemEventRefSchema,
      snapshot_ref: evidenceRefSchema,
      snapshot_freeze_ref: evidenceRefSchema,
      learnable_snapshot_ready: Type.Literal(true),
      transition_audit_ref: evidenceRefSchema,
      meta_enqueue_outbox_ref: evidenceRefSchema,
    }),
    withRuntimeBoundary({
      kind: Type.Literal("explicit_cancel"),
      terminal_outcome: Type.Literal("cancelled_with_reason"),
      ...Type.Omit(Type.Object(terminalTransactionProperties), ["terminal_outcome"]).properties,
    }),
    withRuntimeBoundary({
      kind: Type.Literal("explicit_cancel"),
      terminal_outcome: Type.Literal("superseded_by_later_trigger"),
      superseded_by_process_id: evidenceRefSchema,
      ...Type.Omit(Type.Object(terminalTransactionProperties), ["terminal_outcome"]).properties,
    }),
    withRuntimeBoundary({
      kind: Type.Literal("unrecoverable_failure"),
      terminal_outcome: Type.Literal("failed_with_reason"),
      ...Type.Omit(Type.Object(terminalTransactionProperties), ["terminal_outcome"]).properties,
    }),
    withRuntimeBoundary({
      kind: Type.Literal("preempt_handoff"),
      terminal_outcome: Type.Literal("preempted_and_handed_off"),
      snapshot_freeze_ref: evidenceRefSchema,
      successor_process_id: evidenceRefSchema,
      snapshot_transfer_ref: evidenceRefSchema,
      foreground_slot_transfer_ref: evidenceRefSchema,
      ...Type.Omit(Type.Object(terminalTransactionProperties), ["terminal_outcome"]).properties,
    }),
    strictEvidenceObject({
      kind: Type.Literal("weak_merge"),
      terminal_outcome: Type.Null(),
      terminal_outcome_finalized_at: Type.Null(),
      canonical_process_id: evidenceRefSchema,
      merged_into_process_id: evidenceRefSchema,
      transition_audit_ref: evidenceRefSchema,
      outbox_event_ref: evidenceRefSchema,
    }),
    strictEvidenceObject({
      kind: Type.Literal("meta_finalization"),
      ...terminalTransactionProperties,
    }),
  ],
  { $id: "urn:pai:trigger-processor:trigger-process-transition-evidence:v1" },
);

export type TriggerProcessTransitionEvidenceV1 = Static<
  typeof TriggerProcessTransitionEvidenceV1Schema
>;

type RuntimeBoundaryEvidenceV1 = Extract<
  TriggerProcessTransitionEvidenceV1,
  { runtime_state: "not_running" | "stopped_or_isolated" }
>;

type TerminalTransactionEvidenceV1 = Extract<
  TriggerProcessTransitionEvidenceV1,
  { terminal_outcome: TerminalOutcomeV1 }
>;

function isNonEmptyRef(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !value.includes("\r") &&
    !value.includes("\n")
  );
}

function isSystemEventRef(value: unknown): value is string {
  return typeof value === "string" && /^system_event:[^\r\n]+$/.test(value);
}

function isTriggerEventRef(value: unknown): value is string {
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
    (CLOSED_STATUS_TERMINAL_OUTCOMES_V1[to.status] as readonly TerminalOutcomeV1[])
      .includes(evidence.terminal_outcome) &&
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
        to.meta_enqueue_reason === "cooldown_expired" &&
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
      to.meta_enqueue_reason === evidence.enqueue_reason &&
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
      const reasonOutcomeMatches =
        (from.phase === "meta_enqueued" &&
          from.meta_enqueue_reason === "user_retracted" &&
          to.status === "cancelled" &&
          evidence.terminal_outcome === "cancelled_with_reason") ||
        (from.phase === "meta_enqueued" &&
          from.meta_enqueue_reason === "system_interrupted" &&
          to.status === "cancelled" &&
          evidence.terminal_outcome === "interrupted_with_reason") ||
        (from.phase === "meta_enqueued" &&
          from.meta_enqueue_reason ===
            "failed_with_learnable_snapshot" &&
          to.status === "failed" &&
          evidence.terminal_outcome === "failed_with_reason") ||
        (from.phase === "meta_enqueued" &&
          from.meta_enqueue_reason === "cooldown_expired" &&
          (to.status === "completed" || to.status === "failed") &&
          (to.status !== "failed" ||
            evidence.terminal_outcome === "failed_with_reason"));
      return (
        from.phase === "meta_enqueued" &&
        reasonOutcomeMatches &&
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

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function sqlList(values: readonly string[]): string {
  return values.map(sqlLiteral).join(", ");
}

function activeStateSql(
  phase: keyof typeof TRIGGER_PROCESS_ACTIVE_STATUSES_V1,
): string {
  const statuses = TRIGGER_PROCESS_ACTIVE_STATUSES_V1[phase];
  const statusPredicate =
    statuses.length === 1
      ? `status = ${sqlLiteral(statuses[0])}`
      : `status IN (${sqlList(statuses)})`;
  return `(phase = ${sqlLiteral(phase)} AND ${statusPredicate} AND wait_reason IS NULL)`;
}

function waitingStateSql(
  phase: keyof typeof TRIGGER_PROCESS_WAIT_REASONS_V1,
): string {
  const reasons = TRIGGER_PROCESS_WAIT_REASONS_V1[phase];
  const reasonPredicate =
    reasons.length === 1
      ? `wait_reason = ${sqlLiteral(reasons[0])}`
      : `wait_reason IN (${sqlList(reasons)})`;
  return `(phase = ${sqlLiteral(phase)} AND status = 'waiting' AND ${reasonPredicate})`;
}

const triggerProcessStateRowsSql = [
  activeStateSql("admission"),
  waitingStateSql("admission"),
  activeStateSql("context"),
  waitingStateSql("context"),
  activeStateSql("intent"),
  waitingStateSql("intent"),
  waitingStateSql("execution"),
  activeStateSql("execution"),
  waitingStateSql("cooldown"),
  waitingStateSql("meta_enqueued"),
  `(phase = 'closed' AND status IN (${sqlList(TRIGGER_PROCESS_CLOSED_STATUSES_V1)}) AND wait_reason IS NULL)`,
];

export const TRIGGER_PROCESS_STATE_V1_DATABASE_CHECK = [
  "CHECK ((status = 'waiting') = (wait_reason IS NOT NULL))",
  "CHECK ((phase = 'closed') = (terminal_reason IS NOT NULL))",
  `CHECK (meta_enqueue_reason IS NULL OR meta_enqueue_reason IN (${sqlList(META_ENQUEUE_REASONS_V1)}))`,
  "CHECK (phase <> 'meta_enqueued' OR meta_enqueue_reason IS NOT NULL)",
  `CHECK (\n  ${triggerProcessStateRowsSql.join("\n  OR ")}\n)`,
].join(",\n");
