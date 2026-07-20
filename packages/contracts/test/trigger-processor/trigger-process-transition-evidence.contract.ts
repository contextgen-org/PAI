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
});
