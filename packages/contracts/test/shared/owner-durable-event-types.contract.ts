import { describe, expect, it } from "vitest";

import {
  ACTIVE_OWNER_DURABLE_EVENT_TYPES_V1,
  OWNER_DURABLE_EVENT_CONTRACTS_V1,
  OWNER_DURABLE_EVENT_TYPES_V1,
  PENDING_OWNER_DURABLE_EVENT_TYPES_V1,
  SERVICE_IDS,
  TERMINAL_OUTCOMES_V1,
  assertOwnerDurableEventEnvelopeV1,
  durableEventTargetConsumerV1,
  isDurableEventConsumerAllowedV1,
  isDurableEventTargetAllowedV1,
  isOwnerDurableEventTypeV1,
  ownerDurableEventContractV1,
} from "../../src/index.js";

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

function pendingEnvelope(
  producer: string,
  eventType: string,
  schemaVersion: string,
) {
  return {
    event_id: `evt_${producer}_001`,
    event_type: eventType,
    schema_version: schemaVersion,
    producer,
    occurred_at: "2026-07-22T04:00:00.000Z",
    idempotency_key: `${producer}:pending:001`,
    trace_id: `trace_${producer}_001`,
    payload: {
      workspace_id: "workspace_001",
      bot_id: "bot_001",
      owner_agent_id: "owner_agent_001",
      deployment_environment: "dev",
      release_channel: "stable",
    },
  } as const;
}

describe("owner durable event type unions V1", () => {
  it("preserves every database-owner declaration with globally unique event types", () => {
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

  it("partitions declared owner unions into one active owner and explicit pending owners", () => {
    expect(Object.keys(ACTIVE_OWNER_DURABLE_EVENT_TYPES_V1)).toEqual([
      "trigger_processor",
    ]);
    expect(Object.keys(PENDING_OWNER_DURABLE_EVENT_TYPES_V1).sort()).toEqual([
      "action_runtime",
      "knowthat",
      "memory",
      "meta_cognition",
      "skill_registry",
      "timer_trigger_app",
    ]);
    expect(Object.keys(OWNER_DURABLE_EVENT_CONTRACTS_V1)).toEqual([
      "trigger_processor",
    ]);
    expect(
      Object.keys(OWNER_DURABLE_EVENT_CONTRACTS_V1.trigger_processor).sort(),
    ).toEqual([...ACTIVE_OWNER_DURABLE_EVENT_TYPES_V1.trigger_processor].sort());

    expect(Object.isFrozen(OWNER_DURABLE_EVENT_TYPES_V1)).toBe(true);
    expect(Object.isFrozen(ACTIVE_OWNER_DURABLE_EVENT_TYPES_V1)).toBe(true);
    expect(Object.isFrozen(PENDING_OWNER_DURABLE_EVENT_TYPES_V1)).toBe(true);
    expect(
      Object.values(OWNER_DURABLE_EVENT_TYPES_V1).every(Object.isFrozen),
    ).toBe(true);
  });

  it("keeps pending event names available to DB generation but denies active contracts", () => {
    expect(
      OWNER_DURABLE_EVENT_TYPES_V1.timer_trigger_app.includes(
        "timer.occurrence.due",
      ),
    ).toBe(true);
    expect(
      PENDING_OWNER_DURABLE_EVENT_TYPES_V1.timer_trigger_app.includes(
        "timer.occurrence.due",
      ),
    ).toBe(true);
    expect(
      isOwnerDurableEventTypeV1(
        "timer_trigger_app",
        "timer.occurrence.due",
      ),
    ).toBe(false);
    expect(
      ownerDurableEventContractV1(
        "timer_trigger_app",
        "timer.occurrence.due",
      ),
    ).toBeUndefined();
    expect(
      isOwnerDurableEventTypeV1("trigger_processor", "trigger.accepted"),
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
        "trigger.accepted",
      ),
    ).toBe(false);
  });

  it("rejects every pending owner even when a former skeletal schema version is supplied", () => {
    const pendingBranches = [
      ["action_runtime", "runtime.run.completed", "runtime_domain_event.v1"],
      ["timer_trigger_app", "timer.occurrence.due", "timer_event.v1"],
      ["timer_trigger_app", "timer.occurrence.due", "timer.event.v1"],
      ["meta_cognition", "meta.result.finalized", "meta_cognition_event.v1"],
      ["skill_registry", "skill.version.published", "skill_registry_event.v1"],
      ["knowthat", "knowthat.fact.created", "knowthat_event.v1"],
      ["memory", "memory.integration.finished", "memory_event.v1"],
      ["memory", "memory.integration.finished", "memory.event.v1"],
    ] as const;

    for (const [owner, eventType, schemaVersion] of pendingBranches) {
      expect(() =>
        assertOwnerDurableEventEnvelopeV1(
          pendingEnvelope(owner, eventType, schemaVersion),
        ),
      ).toThrow(/event_type.*producer owner union/u);
    }
  });

  it("keeps Meta command-like declarations pending and unroutable", () => {
    const commandLikeTypes = [
      "meta.memory.write_requested",
      "meta.knowthat.write_requested",
      "meta.candidate.review_requested",
      "meta.skill.candidate_application_requested",
    ] as const;

    for (const eventType of commandLikeTypes) {
      expect(OWNER_DURABLE_EVENT_TYPES_V1.meta_cognition).toContain(eventType);
      expect(PENDING_OWNER_DURABLE_EVENT_TYPES_V1.meta_cognition).toContain(
        eventType,
      );
      expect(
        ownerDurableEventContractV1("meta_cognition", eventType),
      ).toBeUndefined();
      const envelope = pendingEnvelope(
        "meta_cognition",
        eventType,
        "meta_cognition_event.v1",
      );
      expect(isDurableEventTargetAllowedV1(envelope, "memory.command")).toBe(
        false,
      );
      expect(() => assertOwnerDurableEventEnvelopeV1(envelope)).toThrow(
        /event_type/u,
      );
    }
  });

  it("validates the complete Trigger Processor terminal branch", () => {
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
    expect(() =>
      assertOwnerDurableEventEnvelopeV1({
        ...triggerEnvelope,
        schema_version: "trigger.processor.event.v1",
      }),
    ).toThrow(/schema_version/u);
  });

  it("routes only a validated Trigger Processor event to its explicit consumer", () => {
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
    expect(
      isDurableEventTargetAllowedV1(
        triggerEnvelope,
        "trigger_processor.trigger_event_append",
      ),
    ).toBe(false);
  });
});
