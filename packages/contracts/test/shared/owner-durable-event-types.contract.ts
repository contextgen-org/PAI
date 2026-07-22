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
  TERMINAL_OUTCOMES_V1,
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

function triggerProcessorEventPayloadBase(reasonCode = "admission_accepted") {
  return {
    workspace_id: "workspace_001",
    bot_id: "bot_001",
    owner_agent_id: "owner_agent_001",
    deployment_environment: "dev",
    release_channel: "stable",
    reason_code: reasonCode,
    source_ref: "trigger_event:source_001",
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

  it("uses each owner domain's canonical terminal status union", () => {
    const triggerEnvelope = {
      event_id: "evt_trigger_terminal_001",
      event_type: "trigger_process.outcome_finalized",
      schema_version: "trigger_processor_event.v1",
      producer: "trigger_processor",
      occurred_at: "2026-07-22T04:00:00.000Z",
      idempotency_key: "trigger_process_001:terminal",
      trace_id: "trace_trigger_terminal_001",
      payload: {
        ...triggerProcessorEventPayloadBase("cooldown_expired"),
        trigger_process_id: "trigger_process_001",
        terminal_outcome: "executed",
        canonical_reason_code: "cooldown_expired",
        finalized_at: "2026-07-22T04:00:00.000Z",
      },
    } as const;
    for (const outcome of TERMINAL_OUTCOMES_V1) {
      expect(() =>
        assertOwnerDurableEventEnvelopeV1({
          ...triggerEnvelope,
          payload: { ...triggerEnvelope.payload, terminal_outcome: outcome },
        }),
      ).not.toThrow();
    }
    expect(() =>
      assertOwnerDurableEventEnvelopeV1({
        ...triggerEnvelope,
        payload: { ...triggerEnvelope.payload, terminal_outcome: "completed" },
      }),
    ).toThrow(/payload/u);

    const metaEnvelope = {
      event_id: "evt_meta_terminal_001",
      event_type: "meta.result.finalized",
      schema_version: "meta_cognition_event.v1",
      producer: "meta_cognition",
      occurred_at: "2026-07-22T04:00:00.000Z",
      idempotency_key: "meta_result_001:v3:finalized",
      trace_id: "trace_meta_terminal_001",
      payload: {
        ...botScope(),
        meta_result_id: "meta_result_001",
        meta_job_id: "meta_job_001",
        result_version: 3,
        result_status: "complete",
        finalized_at: "2026-07-22T04:00:00.000Z",
      },
    } as const;
    expect(() => assertOwnerDurableEventEnvelopeV1(metaEnvelope)).not.toThrow();
    expect(() =>
      assertOwnerDurableEventEnvelopeV1({
        ...metaEnvelope,
        payload: { ...metaEnvelope.payload, result_status: "partial_pending" },
      }),
    ).toThrow(/payload/u);

    const memoryEnvelope = {
      event_id: "evt_memory_terminal_001",
      event_type: "memory.integration.finished",
      schema_version: "memory_event.v1",
      producer: "memory",
      occurred_at: "2026-07-22T04:00:00.000Z",
      idempotency_key: "integration_001:v4",
      trace_id: "trace_memory_terminal_001",
      payload: {
        ...botScope(),
        integration_job_id: "integration_001",
        aggregate_id: "integration_001",
        aggregate_version: 4,
        aggregate_type: "integration_job",
        mode: "full",
        status: "partial_failed",
        checkpoint_ref: "checkpoint:integration_001:4",
        applied_counts: { points: 10 },
        failure_refs: ["artifact:failure_001"],
      },
    } as const;
    expect(() => assertOwnerDurableEventEnvelopeV1(memoryEnvelope)).not.toThrow();
    expect(() =>
      assertOwnerDurableEventEnvelopeV1({
        ...memoryEnvelope,
        payload: { ...memoryEnvelope.payload, status: "cancelled" },
      }),
    ).toThrow(/payload/u);
    expect(() =>
      assertOwnerDurableEventEnvelopeV1({
        ...memoryEnvelope,
        payload: {
          ...memoryEnvelope.payload,
          aggregate_type: "memory_series",
        },
      }),
    ).toThrow(/payload/u);
    expect(() =>
      assertOwnerDurableEventEnvelopeV1({
        ...memoryEnvelope,
        payload: {
          ...memoryEnvelope.payload,
          failure_refs: ["untyped_failure"],
        },
      }),
    ).toThrow(/payload/u);
    expect(() =>
      assertOwnerDurableEventEnvelopeV1({
        ...memoryEnvelope,
        payload: {
          ...memoryEnvelope.payload,
          aggregate_id: "another_integration_job",
        },
      }),
    ).toThrow(/aggregate_id/u);
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

    const triggerEnvelope = {
      event_id: "evt_trigger_accepted_001",
      event_type: "trigger.accepted",
      schema_version: "trigger_processor_event.v1",
      producer: "trigger_processor",
      occurred_at: "2026-07-22T04:00:00.000Z",
      idempotency_key: "trigger_accepted_001",
      trace_id: "trace_trigger_accepted_001",
      payload: {
        ...triggerProcessorEventPayloadBase("admission_accepted"),
        trigger_id: "trigger_001",
        trigger_process_id: "process_001",
        admission_outcome: "accepted",
        priority: "strong",
        dedupe_key: "chat:message_001",
        request_hash: "hash_001",
      },
    } as const;
    assertOwnerDurableEventEnvelopeV1(triggerEnvelope);
    expect(
      isDurableEventConsumerAllowedV1(triggerEnvelope, "observation_gateway"),
    ).toBe(true);
    expect(
      durableEventTargetConsumerV1("observation_gateway.trigger_event_append"),
    ).toBe("observation_gateway");
    expect(
      isDurableEventTargetAllowedV1(
        triggerEnvelope,
        "observation_gateway.trigger_event_append",
      ),
    ).toBe(true);
  });
});
