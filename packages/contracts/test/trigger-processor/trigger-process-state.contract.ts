import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  META_ENQUEUE_REASONS_V1,
  TERMINAL_OUTCOMES_V1,
  TRIGGER_PROCESS_ACTIVE_STATUSES_V1,
  TRIGGER_PROCESS_CLOSED_STATUSES_V1,
  TRIGGER_PROCESS_STATE_V1_DATABASE_CHECK,
  TRIGGER_PROCESS_WAIT_REASONS_V1,
  TriggerProcessStateV1Schema,
  isTriggerProcessTransitionV1Allowed,
  type TriggerProcessTransitionEvidenceV1,
  type TriggerProcessStateV1,
} from "../../src/index.js";

const running = (phase: "admission" | "context" | "intent" | "execution") =>
  ({
    phase,
    status: "running",
    wait_reason: null,
    terminal_reason: null,
  }) as const satisfies TriggerProcessStateV1;

describe("TriggerProcessStateV1", () => {
  it("derives JSON Schema and PostgreSQL enum values from the same state constants", () => {
    const databaseCheck = TRIGGER_PROCESS_STATE_V1_DATABASE_CHECK;
    const canonicalValues = [
      ...Object.values(TRIGGER_PROCESS_ACTIVE_STATUSES_V1).flat(),
      ...Object.values(TRIGGER_PROCESS_WAIT_REASONS_V1).flat(),
      ...TRIGGER_PROCESS_CLOSED_STATUSES_V1,
      ...META_ENQUEUE_REASONS_V1,
    ];

    for (const value of new Set(canonicalValues)) {
      expect(databaseCheck).toContain(`'${value}'`);
    }

    for (const [phase, reasons] of Object.entries(
      TRIGGER_PROCESS_WAIT_REASONS_V1,
    )) {
      for (const waitReason of reasons) {
        expect(
          Value.Check(TriggerProcessStateV1Schema, {
            phase,
            status: "waiting",
            wait_reason: waitReason,
            terminal_reason: null,
            ...(phase === "meta_enqueued"
              ? { meta_enqueue_reason: "cooldown_expired" }
              : {}),
          }),
        ).toBe(true);
      }
    }
  });

  it("enforces waiting iff wait_reason is non-null", () => {
    expect(
      Value.Check(TriggerProcessStateV1Schema, {
        phase: "admission",
        status: "waiting",
        wait_reason: "weak_queue",
        terminal_reason: null,
      }),
    ).toBe(true);
    expect(
      Value.Check(TriggerProcessStateV1Schema, {
        phase: "admission",
        status: "waiting",
        wait_reason: null,
        terminal_reason: null,
      }),
    ).toBe(false);
  });

  it("keeps external confirmation in intent and out of execution", () => {
    expect(
      Value.Check(TriggerProcessStateV1Schema, {
        phase: "intent",
        status: "waiting",
        wait_reason: "external_confirmation",
        terminal_reason: null,
      }),
    ).toBe(true);
    expect(
      Value.Check(TriggerProcessStateV1Schema, {
        phase: "execution",
        status: "waiting",
        wait_reason: "external_confirmation",
        terminal_reason: null,
      }),
    ).toBe(false);
  });

  it("allows only admission states as the creation edge", () => {
    expect(isTriggerProcessTransitionV1Allowed(null, running("admission"))).toBe(
      true,
    );
    expect(isTriggerProcessTransitionV1Allowed(null, running("context"))).toBe(
      false,
    );
    expect(
      isTriggerProcessTransitionV1Allowed(null, {
        phase: "admission",
        status: "waiting",
        wait_reason: "stage_retry_wait",
        terminal_reason: null,
      }),
    ).toBe(false);
  });

  it("requires an atomic queue-head, process-version and slot-generation fence for promotion", () => {
    const contextRunning = running("context");
    const deferredStrong = {
      phase: "admission",
      status: "waiting",
      wait_reason: "deferred_strong_queue",
      terminal_reason: null,
    } as const satisfies TriggerProcessStateV1;
    const promotion = {
      kind: "admission_queue_promotion",
      queue_kind: "strong",
      trigger_process_id: "process-strong-1",
      admission_time: "2026-07-22T08:00:00.000Z",
      expected_process_updated_at: "2026-07-22T08:00:01.000Z",
      expected_strong_fifo_revision: 12,
      strong_fifo_head_process_id: "process-strong-1",
      strong_fifo_head_admission_time: "2026-07-22T08:00:00.000Z",
      strong_fifo_head_lock_ref: "strong-head-lock-1",
      preempt_commit_process_id: null,
      preempt_commit_ref: null,
      process_lock_ref: "process-lock-1",
      foreground_slot_previous_process_id: null,
      foreground_slot_previous_generation: 9,
      foreground_slot_next_generation: 10,
      foreground_slot_transfer_ref: "slot-transfer-1",
      transition_audit_ref: "transition-audit-1",
      command_outbox_ref: "command-outbox-1",
    } as const satisfies TriggerProcessTransitionEvidenceV1;

    expect(isTriggerProcessTransitionV1Allowed(deferredStrong, contextRunning)).toBe(
      false,
    );
    expect(
      isTriggerProcessTransitionV1Allowed(
        deferredStrong,
        contextRunning,
        promotion,
      ),
    ).toBe(true);
    expect(
      isTriggerProcessTransitionV1Allowed(deferredStrong, contextRunning, {
        ...promotion,
        strong_fifo_head_process_id: "later-process",
      }),
    ).toBe(false);
    expect(
      isTriggerProcessTransitionV1Allowed(deferredStrong, contextRunning, {
        ...promotion,
        foreground_slot_next_generation: 11,
      }),
    ).toBe(false);

    const preemptCommit = {
      ...deferredStrong,
      wait_reason: "preempt_commit",
    } as const satisfies TriggerProcessStateV1;
    expect(
      isTriggerProcessTransitionV1Allowed(preemptCommit, contextRunning, {
        ...promotion,
        preempt_commit_process_id: "process-strong-1",
        preempt_commit_ref: "preempt-commit-1",
        foreground_slot_previous_process_id: "process-running-1",
      }),
    ).toBe(true);
    expect(
      isTriggerProcessTransitionV1Allowed(preemptCommit, contextRunning, promotion),
    ).toBe(false);

    const weakQueue = {
      ...deferredStrong,
      wait_reason: "weak_queue",
    } as const satisfies TriggerProcessStateV1;
    expect(
      isTriggerProcessTransitionV1Allowed(weakQueue, contextRunning, {
        kind: "admission_queue_promotion",
        queue_kind: "weak",
        trigger_process_id: "process-weak-1",
        expected_process_updated_at: "2026-07-22T08:00:01.000Z",
        expected_strong_fifo_revision: 12,
        strong_fifo_head_process_id: null,
        strong_fifo_head_admission_time: null,
        preempt_commit_process_id: null,
        strong_fifo_empty_lock_ref: "strong-empty-lock-1",
        queue_claim_ref: "weak-claim-1",
        process_lock_ref: "process-lock-weak-1",
        foreground_slot_previous_process_id: null,
        foreground_slot_previous_generation: 10,
        foreground_slot_next_generation: 11,
        foreground_slot_transfer_ref: "slot-transfer-weak-1",
        transition_audit_ref: "transition-audit-weak-1",
        command_outbox_ref: "command-outbox-weak-1",
      }),
    ).toBe(true);
    expect(
      isTriggerProcessTransitionV1Allowed(weakQueue, contextRunning, {
        kind: "admission_queue_promotion",
        queue_kind: "weak",
        trigger_process_id: "process-weak-1",
        expected_process_updated_at: "2026-07-22T08:00:01.000Z",
        expected_strong_fifo_revision: 12,
        strong_fifo_head_process_id: "process-strong-raced-in",
        strong_fifo_head_admission_time: "2026-07-22T08:00:00.000Z",
        preempt_commit_process_id: null,
        strong_fifo_empty_lock_ref: "strong-empty-lock-1",
        queue_claim_ref: "weak-claim-1",
        process_lock_ref: "process-lock-weak-1",
        foreground_slot_previous_process_id: null,
        foreground_slot_previous_generation: 10,
        foreground_slot_next_generation: 11,
        foreground_slot_transfer_ref: "slot-transfer-weak-1",
        transition_audit_ref: "transition-audit-weak-1",
        command_outbox_ref: "command-outbox-weak-1",
      } as never),
    ).toBe(false);
  });

  it("requires persisted transition evidence and covers the canonical terminal edges", () => {
    const executionRunning = running("execution");
    const metaEnqueued = {
      phase: "meta_enqueued",
      status: "waiting",
      wait_reason: "meta_enqueue_wait",
      terminal_reason: null,
      meta_enqueue_reason: "system_interrupted",
    } as const satisfies TriggerProcessStateV1;
    const cancelled = {
      phase: "closed",
      status: "cancelled",
      wait_reason: null,
      terminal_reason: "explicit_cancel",
    } as const satisfies TriggerProcessStateV1;
    const preempted = {
      phase: "closed",
      status: "preempted",
      wait_reason: null,
      terminal_reason: "safe_point_handoff",
    } as const satisfies TriggerProcessStateV1;
    const metaEvidence = {
      kind: "meta_enqueue",
      enqueue_reason: "system_interrupted",
      boundary_system_event_ref: "system_event:boundary-1",
      snapshot_ref: "snapshot-1",
      snapshot_freeze_ref: "snapshot-freeze-1",
      learnable_snapshot_ready: true,
      transition_audit_ref: "transition-audit-1",
      meta_enqueue_outbox_ref: "outbox-1",
      runtime_state: "stopped_or_isolated",
      runtime_stop_or_isolation_proof_ref: "runtime-proof-1",
    } as const satisfies TriggerProcessTransitionEvidenceV1;

    expect(
      isTriggerProcessTransitionV1Allowed(executionRunning, cancelled),
    ).toBe(false);
    expect(
      isTriggerProcessTransitionV1Allowed(executionRunning, preempted),
    ).toBe(false);
    expect(
      isTriggerProcessTransitionV1Allowed(executionRunning, metaEnqueued),
    ).toBe(false);
    expect(
      isTriggerProcessTransitionV1Allowed(
        executionRunning,
        metaEnqueued,
        metaEvidence,
      ),
    ).toBe(true);
    expect(
      isTriggerProcessTransitionV1Allowed(executionRunning, metaEnqueued, {
        ...metaEvidence,
        boundary_system_event_ref: "trigger_event:not-a-system-boundary",
      }),
    ).toBe(false);
    expect(
      isTriggerProcessTransitionV1Allowed(executionRunning, metaEnqueued, {
        ...metaEvidence,
        runtime_state: "not_running",
        runtime_stop_or_isolation_proof_ref: undefined,
      } as unknown as TriggerProcessTransitionEvidenceV1),
    ).toBe(false);

    const cancelling = {
      phase: "execution",
      status: "cancelling",
      wait_reason: null,
      terminal_reason: null,
    } as const satisfies TriggerProcessStateV1;
    const executionCancelEvidence = {
      kind: "explicit_cancel",
      terminal_outcome: "cancelled_with_reason",
      terminal_outcome_finalized_at: "2026-07-20T04:00:00.000Z",
      canonical_reason_code: "explicit_cancel",
      transition_audit_ref: "transition-audit-2",
      outbox_event_ref: "outbox-2",
      runtime_state: "stopped_or_isolated",
      runtime_stop_or_isolation_proof_ref: "runtime-proof-2",
    } as const satisfies TriggerProcessTransitionEvidenceV1;
    expect(
      isTriggerProcessTransitionV1Allowed(
        cancelling,
        cancelled,
        executionCancelEvidence,
      ),
    ).toBe(true);
    expect(
      isTriggerProcessTransitionV1Allowed(
        running("admission"),
        cancelled,
        { ...executionCancelEvidence, runtime_state: "not_running" },
      ),
    ).toBe(true);
    expect(
      isTriggerProcessTransitionV1Allowed(
        running("admission"),
        cancelled,
        {
          ...executionCancelEvidence,
          runtime_state: "not_running",
          terminal_outcome: "executed",
        } as unknown as TriggerProcessTransitionEvidenceV1,
      ),
    ).toBe(false);

    const preemptRequested = {
      phase: "execution",
      status: "preempt_requested",
      wait_reason: null,
      terminal_reason: null,
    } as const satisfies TriggerProcessStateV1;
    const runningPreemptEvidence = {
      kind: "preempt_handoff",
      terminal_outcome: "preempted_and_handed_off",
      terminal_outcome_finalized_at: "2026-07-20T04:01:00.000Z",
      canonical_reason_code: "safe_point_handoff",
      transition_audit_ref: "transition-audit-3",
      outbox_event_ref: "outbox-3",
      runtime_state: "stopped_or_isolated",
      runtime_stop_or_isolation_proof_ref: "runtime-proof-3",
      snapshot_freeze_ref: "snapshot-freeze-3",
      successor_process_id: "process-successor-3",
      snapshot_transfer_ref: "snapshot-transfer-3",
      foreground_slot_transfer_ref: "slot-transfer-3",
    } as const satisfies TriggerProcessTransitionEvidenceV1;
    expect(
      isTriggerProcessTransitionV1Allowed(
        preemptRequested,
        preempted,
        runningPreemptEvidence,
      ),
    ).toBe(true);
    expect(
      isTriggerProcessTransitionV1Allowed(preemptRequested, metaEnqueued, {
        ...metaEvidence,
        runtime_stop_or_isolation_proof_ref: "",
      }),
    ).toBe(false);

    const cooldown = {
      phase: "cooldown",
      status: "waiting",
      wait_reason: "cooldown_until",
      terminal_reason: null,
    } as const satisfies TriggerProcessStateV1;
    const cooldownMetaEnqueued = {
      ...metaEnqueued,
      meta_enqueue_reason: "cooldown_expired",
    } as const satisfies TriggerProcessStateV1;
    expect(
      isTriggerProcessTransitionV1Allowed(executionRunning, cooldown),
    ).toBe(false);
    expect(
      isTriggerProcessTransitionV1Allowed(executionRunning, cooldown, {
        kind: "execution_completed",
        runtime_terminal_outcome: "completed",
        runtime_terminal_event_ref: "trigger_event:runtime-completed-1",
        snapshot_append_ref: "snapshot-append-1",
        cooldown_until: "2026-07-20T04:10:00.000Z",
        completion_won_preempt_race: false,
        preempt_race_proof_ref: null,
        transition_audit_ref: "transition-audit-completed-1",
        outbox_event_ref: "outbox-completed-1",
      }),
    ).toBe(true);
    expect(
      isTriggerProcessTransitionV1Allowed(preemptRequested, cooldown, {
        kind: "execution_completed",
        runtime_terminal_outcome: "completed",
        runtime_terminal_event_ref: "trigger_event:runtime-completed-2",
        snapshot_append_ref: "snapshot-append-2",
        cooldown_until: "2026-07-20T04:10:00.000Z",
        completion_won_preempt_race: false,
        preempt_race_proof_ref: null,
        transition_audit_ref: "transition-audit-completed-2",
        outbox_event_ref: "outbox-completed-2",
      }),
    ).toBe(false);
    expect(
      isTriggerProcessTransitionV1Allowed(preemptRequested, cooldown, {
        kind: "execution_completed",
        runtime_terminal_outcome: "completed",
        runtime_terminal_event_ref: "trigger_event:runtime-completed-2",
        snapshot_append_ref: "snapshot-append-2",
        cooldown_until: "2026-07-20T04:10:00.000Z",
        completion_won_preempt_race: true,
        preempt_race_proof_ref: "preempt-race-proof-2",
        transition_audit_ref: "transition-audit-completed-2",
        outbox_event_ref: "outbox-completed-2",
      }),
    ).toBe(true);
    expect(isTriggerProcessTransitionV1Allowed(cooldown, cooldownMetaEnqueued)).toBe(
      false,
    );
    expect(
      isTriggerProcessTransitionV1Allowed(cooldown, cooldownMetaEnqueued, {
        kind: "cooldown_expired_meta_enqueue",
        enqueue_reason: "cooldown_expired",
        trigger_process_id: "process-1",
        meta_enqueue_idempotency_key: "process-1",
        process_lock_ref: "process-lock-1",
        cooldown_expired_at: "2026-07-20T04:10:00.000Z",
        snapshot_retention_until: "2026-07-20T04:20:00.000Z",
        preempted_by_process_id: null,
        existing_meta_enqueue_intent_ref: null,
        transition_audit_ref: "transition-audit-meta-1",
        meta_enqueue_outbox_ref: "outbox-meta-1",
      }),
    ).toBe(true);
    expect(
      isTriggerProcessTransitionV1Allowed(cooldown, preempted, {
        ...runningPreemptEvidence,
        runtime_state: "not_running",
      }),
    ).toBe(true);
    expect(
      isTriggerProcessTransitionV1Allowed(cooldown, preempted, {
        ...runningPreemptEvidence,
        runtime_state: "not_running",
        foreground_slot_transfer_ref: "",
      }),
    ).toBe(false);

    const merged = {
      phase: "closed",
      status: "completed",
      wait_reason: null,
      terminal_reason: "merged",
    } as const satisfies TriggerProcessStateV1;
    expect(
      isTriggerProcessTransitionV1Allowed(
        {
          phase: "admission",
          status: "waiting",
          wait_reason: "weak_queue",
          terminal_reason: null,
        },
        merged,
        {
          kind: "weak_merge",
          terminal_outcome: null,
          terminal_outcome_finalized_at: null,
          canonical_process_id: "process-canonical-4",
          merged_into_process_id: "process-canonical-4",
          transition_audit_ref: "transition-audit-4",
          outbox_event_ref: "outbox-4",
        },
      ),
    ).toBe(true);

    const failedNotIsolated = {
      phase: "closed",
      status: "failed",
      wait_reason: null,
      terminal_reason: "failed_not_isolated",
    } as const satisfies TriggerProcessStateV1;
    expect(
      isTriggerProcessTransitionV1Allowed(
        executionRunning,
        failedNotIsolated,
        {
          kind: "unrecoverable_failure",
          terminal_outcome: "failed_with_reason",
          terminal_outcome_finalized_at: "2026-07-20T04:02:00.000Z",
          canonical_reason_code: "failed_not_isolated",
          transition_audit_ref: "transition-audit-5",
          outbox_event_ref: "outbox-5",
          runtime_state: "stopped_or_isolated",
          runtime_stop_or_isolation_proof_ref: "runtime-proof-5",
        },
      ),
    ).toBe(false);

    const completed = {
      phase: "closed",
      status: "completed",
      wait_reason: null,
      terminal_reason: "meta_completed",
    } as const satisfies TriggerProcessStateV1;
    expect(
      isTriggerProcessTransitionV1Allowed(metaEnqueued, completed, {
        kind: "meta_finalization",
        terminal_outcome: "executed",
        terminal_outcome_finalized_at: "2026-07-20T04:03:00.000Z",
        canonical_reason_code: "meta_completed",
        transition_audit_ref: "transition-audit-6",
        outbox_event_ref: "outbox-6",
      }),
    ).toBe(false);
  });

  it("accepts canonical transitions and rejects invented phases", () => {
    expect(
      isTriggerProcessTransitionV1Allowed(running("context"), running("intent")),
    ).toBe(false);
    expect(
      isTriggerProcessTransitionV1Allowed(
        running("context"),
        running("intent"),
        {
          kind: "stage_progression",
          progression: "context_to_intent",
          prerequisite_ref: "context-snapshot:process-1:v2",
          expected_process_updated_at: "2026-07-22T08:00:00.000Z",
          process_lock_ref: "process-lock-1",
          transition_audit_ref: "transition-audit-1",
          outbox_event_ref: "outbox-event-1",
        },
      ),
    ).toBe(true);
    expect(
      isTriggerProcessTransitionV1Allowed(
        {
          phase: "closed",
          status: "completed",
          wait_reason: null,
          terminal_reason: "meta_completed",
        },
        running("admission"),
      ),
    ).toBe(false);
    expect(
      Value.Check(TriggerProcessStateV1Schema, {
        phase: "meta",
        status: "running",
        wait_reason: null,
        terminal_reason: null,
      }),
    ).toBe(false);
    expect(
      Value.Check(TriggerProcessStateV1Schema, {
        phase: "meta_enqueued",
        status: "waiting",
        wait_reason: "meta_enqueue_wait",
        terminal_reason: null,
      }),
    ).toBe(false);
  });

  it("requires persisted coupled facts for confirmation, runtime start, retry, and control edges", () => {
    const intentRunning = running("intent");
    const confirmationWaiting = {
      phase: "intent",
      status: "waiting",
      wait_reason: "external_confirmation",
      terminal_reason: null,
    } as const satisfies TriggerProcessStateV1;
    expect(
      isTriggerProcessTransitionV1Allowed(intentRunning, confirmationWaiting),
    ).toBe(false);
    expect(
      isTriggerProcessTransitionV1Allowed(intentRunning, confirmationWaiting, {
        kind: "confirmation_challenge_created",
        challenge_ref: "challenge-1",
        intent_ref: "intent-1",
        intent_hash: `sha256:${"a".repeat(64)}`,
        policy_hash: `sha256:${"b".repeat(64)}`,
        allowed_principal_binding_ref: "principal-binding-1",
        expected_process_updated_at: "2026-07-22T08:00:00.000Z",
        process_lock_ref: "process-lock-1",
        transition_audit_ref: "transition-audit-1",
        outbox_event_ref: "outbox-event-1",
      }),
    ).toBe(true);
    expect(
      isTriggerProcessTransitionV1Allowed(confirmationWaiting, intentRunning),
    ).toBe(false);

    const retryWaiting = {
      phase: "context",
      status: "waiting",
      wait_reason: "stage_retry_wait",
      terminal_reason: null,
    } as const satisfies TriggerProcessStateV1;
    expect(
      isTriggerProcessTransitionV1Allowed(running("context"), retryWaiting),
    ).toBe(false);
    expect(
      isTriggerProcessTransitionV1Allowed(running("context"), retryWaiting, {
        kind: "stage_retry_scheduled",
        retry_record_ref: "retry-1",
        next_retry_at: "2026-07-22T08:01:00.000Z",
        expected_process_updated_at: "2026-07-22T08:00:00.000Z",
        process_lock_ref: "process-lock-1",
        transition_audit_ref: "transition-audit-1",
        outbox_event_ref: "outbox-event-1",
      }),
    ).toBe(true);

    const executionRunning = running("execution");
    const preemptRequested = {
      phase: "execution",
      status: "preempt_requested",
      wait_reason: null,
      terminal_reason: null,
    } as const satisfies TriggerProcessStateV1;
    expect(
      isTriggerProcessTransitionV1Allowed(executionRunning, preemptRequested),
    ).toBe(false);
    expect(
      isTriggerProcessTransitionV1Allowed(executionRunning, preemptRequested, {
        kind: "runtime_control_requested",
        control: "preempt",
        runtime_signal_ref: "runtime-signal-1",
        command_outbox_ref: "command-outbox-1",
        expected_process_updated_at: "2026-07-22T08:00:00.000Z",
        process_lock_ref: "process-lock-1",
        transition_audit_ref: "transition-audit-1",
        outbox_event_ref: "outbox-event-1",
      }),
    ).toBe(true);
  });

  it.each([
    ["user_retracted", "cancelled_with_reason"],
    ["system_interrupted", "interrupted_with_reason"],
  ] as const)(
    "closes the full %s Meta lifecycle as cancelled",
    (enqueueReason, terminalOutcome) => {
      const execution = running("execution");
      const meta = {
        phase: "meta_enqueued",
        status: "waiting",
        wait_reason: "meta_enqueue_wait",
        terminal_reason: null,
        meta_enqueue_reason: enqueueReason,
      } as const satisfies TriggerProcessStateV1;
      expect(
        isTriggerProcessTransitionV1Allowed(execution, meta, {
          kind: "meta_enqueue",
          enqueue_reason: enqueueReason,
          boundary_system_event_ref: `system_event:${enqueueReason}`,
          snapshot_ref: `snapshot-${enqueueReason}`,
          snapshot_freeze_ref: `freeze-${enqueueReason}`,
          learnable_snapshot_ready: true,
          transition_audit_ref: `audit-${enqueueReason}`,
          meta_enqueue_outbox_ref: `outbox-${enqueueReason}`,
          runtime_state: "stopped_or_isolated",
          runtime_stop_or_isolation_proof_ref: `runtime-${enqueueReason}`,
        }),
      ).toBe(true);
      const closed = {
        phase: "closed",
        status: "cancelled",
        wait_reason: null,
        terminal_reason: enqueueReason,
      } as const satisfies TriggerProcessStateV1;
      expect(
        isTriggerProcessTransitionV1Allowed(meta, closed, {
          kind: "meta_finalization",
          terminal_outcome: terminalOutcome,
          terminal_outcome_finalized_at: "2026-07-20T04:03:00.000Z",
          canonical_reason_code: enqueueReason,
          transition_audit_ref: `close-audit-${enqueueReason}`,
          outbox_event_ref: `close-outbox-${enqueueReason}`,
        }),
      ).toBe(true);
    },
  );

  it("keeps the accountable terminal outcome closed set", () => {
    expect(TERMINAL_OUTCOMES_V1).toEqual([
      "executed",
      "merged_and_executed",
      "superseded_by_later_trigger",
      "deferred_then_executed",
      "expired_with_audit_record",
      "cancelled_with_reason",
      "failed_with_reason",
      "preempted_and_handed_off",
      "interrupted_with_reason",
    ]);
  });

  it.each([
    ["cooldown_expired", "completed", "executed", true],
    ["cooldown_expired", "completed", "failed_with_reason", false],
    ["cooldown_expired", "failed", "failed_with_reason", true],
    ["user_retracted", "cancelled", "cancelled_with_reason", true],
    ["user_retracted", "cancelled", "interrupted_with_reason", false],
    ["system_interrupted", "cancelled", "interrupted_with_reason", true],
    ["system_interrupted", "completed", "executed", false],
    ["failed_with_learnable_snapshot", "failed", "failed_with_reason", true],
  ] as const)(
    "enforces meta reason %s finalization status %s with outcome %s",
    (persistedReason, status, terminalOutcome, expected) => {
      const from = {
        phase: "meta_enqueued",
        status: "waiting",
        wait_reason: "meta_enqueue_wait",
        terminal_reason: null,
        meta_enqueue_reason: persistedReason,
      } as const satisfies TriggerProcessStateV1;
      const to = {
        phase: "closed",
        status,
        wait_reason: null,
        terminal_reason: `meta_${status}`,
      } as const satisfies TriggerProcessStateV1;
      expect(
        isTriggerProcessTransitionV1Allowed(from, to, {
          kind: "meta_finalization",
          terminal_outcome: terminalOutcome,
          terminal_outcome_finalized_at: "2026-07-20T04:03:00.000Z",
          canonical_reason_code: `meta_${status}`,
          transition_audit_ref: "transition-audit-table",
          outbox_event_ref: "outbox-table",
        }),
      ).toBe(expected);
    },
  );
});
