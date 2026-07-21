import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  assertDurableEventEnvelopeV1,
  DurableEventEnvelopeV1Schema,
} from "../../src/index.js";

const event = {
  event_id: "evt_runtime_001",
  event_type: "runtime.run.completed",
  schema_version: "runtime_domain_event.v1",
  producer: "action_runtime",
  occurred_at: "2026-07-21T05:00:00.123Z",
  idempotency_key: "runtime:run_001:completed",
  trace_id: "trace_001",
  payload: { runtime_run_id: "run_001", outcome: "completed" },
} as const;

describe("DurableEventEnvelopeV1", () => {
  it("accepts exactly the eight owner-authored wire fields", () => {
    expect(Value.Check(DurableEventEnvelopeV1Schema, event)).toBe(true);
    expect(() => assertDurableEventEnvelopeV1(event)).not.toThrow();
    expect(Object.keys(event).sort()).toEqual(
      [
        "event_id",
        "event_type",
        "schema_version",
        "producer",
        "occurred_at",
        "idempotency_key",
        "trace_id",
        "payload",
      ].sort(),
    );
  });

  it("rejects storage-only delivery state and invented producers", () => {
    expect(
      Value.Check(DurableEventEnvelopeV1Schema, {
        ...event,
        status: "pending",
        attempt_count: 1,
      }),
    ).toBe(false);
    expect(
      Value.Check(DurableEventEnvelopeV1Schema, {
        ...event,
        producer: "action-runtime",
      }),
    ).toBe(false);
  });

  it("rejects malformed event types and non-canonical timestamps", () => {
    expect(
      Value.Check(DurableEventEnvelopeV1Schema, {
        ...event,
        event_type: "completed",
      }),
    ).toBe(false);
    expect(
      Value.Check(DurableEventEnvelopeV1Schema, {
        ...event,
        occurred_at: "2026-07-21 05:00:00",
      }),
    ).toBe(false);
    expect(() =>
      assertDurableEventEnvelopeV1({
        ...event,
        occurred_at: "2026-02-30T05:00:00Z",
      }),
    ).toThrow(/real calendar timestamp/);
  });
});
