import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  TERMINAL_OUTCOMES_V1,
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

  it("requires persisted transition evidence and covers the canonical terminal edges", () => {
    const executionRunning = running("execution");
    const metaEnqueued = {
      phase: "meta_enqueued",
      status: "waiting",
      wait_reason: "meta_enqueue_wait",
      terminal_reason: null,
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
    expect(isTriggerProcessTransitionV1Allowed(cooldown, metaEnqueued)).toBe(
      false,
    );
    expect(
      isTriggerProcessTransitionV1Allowed(cooldown, metaEnqueued, {
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
    ).toBe(true);
  });

  it("accepts canonical transitions and rejects invented phases", () => {
    expect(
      isTriggerProcessTransitionV1Allowed(running("context"), running("intent")),
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
  });

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
});
