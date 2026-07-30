import { TriggerProcessCancelResponseV1Schema } from "@pai/contracts";
import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

const pending = {
  code: "cancel_pending",
  message: "pending",
  retryable: false,
  trace_id: "trace-1",
  details: {
    trigger_process_id: "process-1",
    idempotency_key: "cancel-1",
    duplicate_replayed: false,
    phase: "execution",
    status: "cancelling",
    cancellation_status: "pending",
    cancel_requested_at: "2026-07-29T00:00:00.000Z",
    runtime_signal_id: "signal-1",
  },
} as const;

describe("Trigger Process cancel response contract", () => {
  it("couples replay code to duplicate facts", () => {
    expect(Value.Check(TriggerProcessCancelResponseV1Schema, pending)).toBe(true);
    expect(
      Value.Check(TriggerProcessCancelResponseV1Schema, {
        ...pending,
        code: "cancel_replayed",
      }),
    ).toBe(false);
    expect(
      Value.Check(TriggerProcessCancelResponseV1Schema, {
        ...pending,
        code: "cancel_replayed",
        details: { ...pending.details, duplicate_replayed: true },
      }),
    ).toBe(true);
  });
});
