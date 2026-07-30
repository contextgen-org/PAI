import Ajv from "ajv";
import { describe, expect, it } from "vitest";

import { TriggerProcessTransitionEvidenceV1Schema } from "../../src/index.js";

const validate = new Ajv({
  strict: false,
  formats: { "date-time": true },
}).compile(TriggerProcessTransitionEvidenceV1Schema);

const cancellationEvidence = {
  kind: "explicit_cancel",
  terminal_outcome: "cancelled_with_reason",
  terminal_outcome_finalized_at: "2026-07-20T04:00:00.000Z",
  canonical_reason_code: "explicit_cancel",
  transition_audit_ref: "audit-1",
  outbox_event_ref: "outbox-1",
  runtime_state: "stopped_or_isolated",
  runtime_stop_or_isolation_proof_ref: "runtime-proof-1",
} as const;

describe("TriggerProcessTransitionEvidenceV1Schema", () => {
  it("accepts a registered evidence variant", () => {
    expect(validate(cancellationEvidence)).toBe(true);
  });

  it.each([
    { ...cancellationEvidence, kind: "invented_transition" },
    { ...cancellationEvidence, terminal_outcome: "executed" },
    {
      ...cancellationEvidence,
      terminal_outcome: "superseded_by_later_trigger",
    },
    {
      ...cancellationEvidence,
      runtime_state: "stopped_or_isolated",
      runtime_stop_or_isolation_proof_ref: undefined,
    },
    { ...cancellationEvidence, caller_asserted_safe: true },
  ])("rejects evidence outside the closed owner contract", (candidate) => {
    expect(validate(candidate)).toBe(false);
  });

  it("binds Meta provenance to the exact persisted transition references", () => {
    const transaction = {
      terminal_outcome_finalized_at: "2026-07-20T04:00:00.000Z",
      canonical_reason_code: "meta_completed",
      transition_audit_ref: "audit-meta-1",
      outbox_event_ref: "outbox-meta-1",
    } as const;
    expect(
      validate({
        kind: "meta_finalization",
        execution_provenance: "direct_execution",
        execution_transition_ref: "transition-execution-1",
        deferred_transition_ref: null,
        terminal_outcome: "executed",
        ...transaction,
      }),
    ).toBe(true);
    expect(
      validate({
        kind: "meta_finalization",
        execution_provenance: "deferred_execution",
        execution_transition_ref: "transition-execution-1",
        deferred_transition_ref: null,
        terminal_outcome: "deferred_then_executed",
        ...transaction,
      }),
    ).toBe(false);
    expect(
      validate({
        kind: "meta_finalization",
        execution_provenance: "direct_execution",
        execution_transition_ref: "transition-execution-1",
        deferred_transition_ref: null,
        terminal_outcome: "cancelled_with_reason",
        ...transaction,
      }),
    ).toBe(true);
    expect(
      validate({
        kind: "meta_finalization",
        execution_provenance: "deferred_execution",
        execution_transition_ref: "transition-execution-1",
        deferred_transition_ref: "transition-deferred-1",
        terminal_outcome: "interrupted_with_reason",
        ...transaction,
      }),
    ).toBe(true);
    expect(
      validate({
        kind: "meta_finalization",
        execution_provenance: "not_applicable",
        execution_transition_ref: "caller-reported-transition",
        deferred_transition_ref: null,
        terminal_outcome: "cancelled_with_reason",
        ...transaction,
      }),
    ).toBe(false);
  });

  it("requires queue-promotion fencing facts instead of a caller promotion assertion", () => {
    const strongPromotion = {
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
    } as const;
    expect(validate(strongPromotion)).toBe(true);
    expect(validate({ ...strongPromotion, strong_fifo_head_lock_ref: undefined })).toBe(
      false,
    );
    expect(validate({ ...strongPromotion, caller_asserted_head: true })).toBe(false);

    const weakPromotion = {
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
      foreground_slot_previous_generation: 9,
      foreground_slot_next_generation: 10,
      foreground_slot_transfer_ref: "slot-transfer-weak-1",
      transition_audit_ref: "transition-audit-weak-1",
      command_outbox_ref: "command-outbox-weak-1",
    } as const;
    expect(validate(weakPromotion)).toBe(true);
    expect(validate({ ...weakPromotion, strong_fifo_empty_lock_ref: undefined })).toBe(
      false,
    );
    expect(
      validate({
        ...weakPromotion,
        strong_fifo_head_process_id: "process-strong-raced-in",
      }),
    ).toBe(false);
  });

  it("rejects incomplete coupled-transition evidence", () => {
    const progression = {
      kind: "stage_progression",
      progression: "context_to_intent",
      prerequisite_ref: "context-snapshot:process-1:v2",
      expected_process_updated_at: "2026-07-22T08:00:00.000Z",
      process_lock_ref: "process-lock-1",
      transition_audit_ref: "transition-audit-1",
      outbox_event_ref: "outbox-event-1",
    } as const;
    expect(validate(progression)).toBe(true);
    expect(validate({ ...progression, prerequisite_ref: undefined })).toBe(false);
    expect(validate({ ...progression, caller_asserted_complete: true })).toBe(false);
  });
});
