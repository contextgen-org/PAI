import { describe, expect, it } from "vitest";

import {
  OWNER_DURABLE_EVENT_TYPES_V1,
  assertOwnerDurableEventEnvelopeV1,
  durableEventTargetConsumerV1,
  isDurableEventConsumerAllowedV1,
  isDurableEventTargetAllowedV1,
  SERVICE_IDS,
  isOwnerDurableEventTypeV1,
} from "../../src/index.js";

describe("owner durable event type unions V1", () => {
  it("covers every and only database-owning service with globally unique types", () => {
    expect(Object.keys(OWNER_DURABLE_EVENT_TYPES_V1).sort()).toEqual(
      SERVICE_IDS.filter((service) => service !== "observation_gateway").sort(),
    );
    const eventTypes = Object.values(OWNER_DURABLE_EVENT_TYPES_V1).flat();
    expect(new Set(eventTypes).size).toBe(eventTypes.length);
    expect(
      eventTypes.every((eventType) =>
        /^[a-z][a-z0-9]*(?:[._][a-z0-9]+)+$/u.test(eventType),
      ),
    ).toBe(true);
  });

  it("freezes the union map and every owner list", () => {
    expect(Object.isFrozen(OWNER_DURABLE_EVENT_TYPES_V1)).toBe(true);
    expect(
      Object.values(OWNER_DURABLE_EVENT_TYPES_V1).every(Object.isFrozen),
    ).toBe(true);
  });

  it("binds event types to their producer and rejects Observation as an owner", () => {
    expect(
      isOwnerDurableEventTypeV1(
        "timer_trigger_app",
        "timer.occurrence.due",
      ),
    ).toBe(true);
    expect(
      isOwnerDurableEventTypeV1(
        "trigger_processor",
        "timer.occurrence.due",
      ),
    ).toBe(false);
    expect(
      isOwnerDurableEventTypeV1(
        "observation_gateway",
        "timer.occurrence.due",
      ),
    ).toBe(false);
  });

  it("validates owner schema version and minimum payload branch", () => {
    const envelope = {
      event_id: "evt_runtime_001",
      event_type: "runtime.run.completed",
      schema_version: "runtime_domain_event.v1",
      producer: "action_runtime",
      occurred_at: "2026-07-21T05:00:00.000Z",
      idempotency_key: "runtime_run_001:completed",
      trace_id: "trace_001",
      payload: { runtime_run_id: "runtime_run_001", outcome: "completed" },
    } as const;
    expect(() => assertOwnerDurableEventEnvelopeV1(envelope)).not.toThrow();
    expect(() =>
      assertOwnerDurableEventEnvelopeV1({
        ...envelope,
        schema_version: "attacker.v999",
      }),
    ).toThrow(/schema_version/u);
    expect(() =>
      assertOwnerDurableEventEnvelopeV1({
        ...envelope,
        payload: { arbitrary: "shape" },
      }),
    ).toThrow(/payload\/runtime_run_id/u);
  });

  it("binds durable events to explicit consumer services and route targets", () => {
    const runtimeEnvelope = {
      event_id: "evt_runtime_002",
      event_type: "runtime.run.completed",
      schema_version: "runtime_domain_event.v1",
      producer: "action_runtime",
      occurred_at: "2026-07-21T05:00:00.000Z",
      idempotency_key: "runtime_run_002:completed",
      trace_id: "trace_002",
      payload: { runtime_run_id: "runtime_run_002", outcome: "completed" },
    } as const;
    assertOwnerDurableEventEnvelopeV1(runtimeEnvelope);
    expect(
      isDurableEventConsumerAllowedV1(runtimeEnvelope, "trigger_processor"),
    ).toBe(true);
    expect(isDurableEventConsumerAllowedV1(runtimeEnvelope, "memory")).toBe(
      false,
    );
    expect(durableEventTargetConsumerV1("trigger_processor.runtime_event_append"))
      .toBe("trigger_processor");
    expect(
      isDurableEventTargetAllowedV1(
        runtimeEnvelope,
        "trigger_processor.runtime_event_append",
      ),
    ).toBe(true);
    expect(
      isDurableEventTargetAllowedV1(runtimeEnvelope, "memory.runtime_event_append"),
    ).toBe(false);
  });
});
