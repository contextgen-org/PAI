import { Type, type Static, type TLiteral } from "@sinclair/typebox";

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
  "execution/running/-->cooldown/waiting/cooldown_until",
  "execution/preempt_requested/-->cooldown/waiting/cooldown_until",
  "cooldown/waiting/cooldown_until->meta_enqueued/waiting/meta_enqueue_wait",
]);

const retryablePhases = new Set(["admission", "context", "intent", "execution"]);

export function isTriggerProcessTransitionV1Allowed(
  from: TriggerProcessStateV1 | null,
  to: TriggerProcessStateV1,
): boolean {
  if (from === null) return to.phase === "admission";
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

  if (to.phase === "meta_enqueued") {
    return to.wait_reason === "meta_enqueue_wait";
  }

  if (to.phase === "closed") {
    if (from.phase === "meta_enqueued") {
      return to.status === "completed" || to.status === "failed";
    }
    return (
      to.status === "cancelled" ||
      to.status === "failed" ||
      to.status === "preempted"
    );
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
