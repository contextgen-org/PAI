import { describe, expect, it } from "vitest";

import {
  OWNER_DURABLE_EVENT_CONTRACTS_V1,
  OWNER_DURABLE_EVENT_TYPES_V1,
  assertOwnerDurableEventEnvelopeV1,
  durableEventTargetConsumerV1,
  isDurableEventConsumerAllowedV1,
  isDurableEventTargetAllowedV1,
  SERVICE_IDS,
  isOwnerDurableEventTypeV1,
} from "../../src/index.js";

function botScope() {
  return {
    scope_kind: "bot",
    workspace_id: "workspace_001",
    bot_id: "bot_001",
    owner_agent_id: "owner_agent_001",
    deployment_environment: "dev",
    release_channel: "stable",
  } as const;
}

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

  it("validates owner schema version, bot scope and semantic payload branch", () => {
    const envelope = {
      event_id: "evt_runtime_001",
      event_type: "runtime.run.completed",
      schema_version: "runtime_domain_event.v1",
      producer: "action_runtime",
      occurred_at: "2026-07-21T05:00:00.000Z",
      idempotency_key: "runtime_run_001:completed",
      trace_id: "trace_001",
      payload: {
        ...botScope(),
        runtime_run_id: "runtime_run_001",
        outcome: "completed",
      },
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
    ).toThrow(/payload/u);
    expect(() =>
      assertOwnerDurableEventEnvelopeV1({
        ...envelope,
        payload: {
          ...botScope(),
          runtime_run_id: "runtime_run_001",
          outcome: "attacker",
        },
      }),
    ).toThrow(/payload/u);
  });

  it("requires timer due events to carry the full dispatch identity", () => {
    const envelope = {
      event_id: "evt_timer_001",
      event_type: "timer.occurrence.due",
      schema_version: "timer_event.v1",
      producer: "timer_trigger_app",
      occurred_at: "2026-07-21T05:00:00.000Z",
      idempotency_key: "occurrence_001:due",
      trace_id: "trace_timer_001",
      payload: {
        ...botScope(),
        occurrence_id: "occurrence_001",
        schedule_id: "schedule_001",
        scheduled_fire_at: "2026-07-21T05:00:00.000Z",
        effective_fire_at: "2026-07-21T05:00:00.000Z",
        dedupe_key: "timer:occurrence_001",
        is_catch_up: false,
      },
    } as const;
    expect(() => assertOwnerDurableEventEnvelopeV1(envelope)).not.toThrow();
    expect(() =>
      assertOwnerDurableEventEnvelopeV1({
        ...envelope,
        payload: {
          ...botScope(),
          occurrence_id: "occurrence_001",
        },
      }),
    ).toThrow(/schedule_id/u);
  });

  it("routes security revocation epoch changes to Trigger Processor and Action Runtime", () => {
    const envelope = {
      event_id: "evt_revocation_001",
      event_type: "skill.security_revocation_epoch.changed",
      schema_version: "skill_registry_event.v1",
      producer: "skill_registry",
      occurred_at: "2026-07-21T05:00:00.000Z",
      idempotency_key: "revocation_epoch:42",
      trace_id: "trace_revocation_001",
      payload: {
        scope_kind: "global",
        deployment_environment: "prod",
        release_channel: "stable",
        revocation_epoch: 42,
      },
    } as const;
    assertOwnerDurableEventEnvelopeV1(envelope);
    expect(
      OWNER_DURABLE_EVENT_CONTRACTS_V1.skill_registry[
        "skill.security_revocation_epoch.changed"
      ].consumer_services,
    ).toEqual(["trigger_processor", "action_runtime"]);
    expect(isDurableEventConsumerAllowedV1(envelope, "trigger_processor")).toBe(
      true,
    );
    expect(isDurableEventConsumerAllowedV1(envelope, "action_runtime")).toBe(
      true,
    );
    expect(() =>
      assertOwnerDurableEventEnvelopeV1({
        ...envelope,
        payload: {
          ...envelope.payload,
          revocation_epoch: "42",
        },
      }),
    ).toThrow(/payload/u);
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
      payload: {
        ...botScope(),
        runtime_run_id: "runtime_run_002",
        outcome: "completed",
      },
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
