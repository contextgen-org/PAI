import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  TRIGGER_PROCESSOR_DOMAIN_EVENT_CONSUMERS_V1,
  TRIGGER_PROCESSOR_DOMAIN_EVENT_TYPES_V1,
  TRIGGER_PROCESSOR_DOMAIN_EVENT_V1_DATABASE_CHECK,
  TRIGGER_PROCESSOR_SCHEMA_CATALOG,
  TriggerProcessorDomainEventV1Schema,
} from "../../src/index.js";

const eventPayloadBase = {
  workspace_id: "workspace_001",
  bot_id: "bot_001",
  owner_agent_id: "owner_agent_001",
  deployment_environment: "dev",
  release_channel: "stable",
  reason_code: "admission_accepted",
  source_ref: "trigger_event:submit_001",
} as const;

const acceptedEvent = {
  event_id: "event_001",
  event_type: "trigger.accepted",
  schema_version: "trigger_processor_event.v1",
  producer: "trigger_processor",
  occurred_at: "2026-07-22T04:00:00.000Z",
  idempotency_key: "trigger_001:accepted",
  trace_id: "trace_001",
  payload: {
    ...eventPayloadBase,
    trigger_id: "trigger_001",
    trigger_process_id: "process_001",
    admission_outcome: "accepted",
    priority: "strong",
    dedupe_key: "chat:message_001",
    request_hash: "hash_001",
  },
} as const;

describe("TriggerProcessorDomainEventV1", () => {
  it("validates the canonical trigger accepted envelope and rejects nested-scope payloads", () => {
    expect(Value.Check(TriggerProcessorDomainEventV1Schema, acceptedEvent)).toBe(
      true,
    );
    expect(
      Value.Check(TriggerProcessorDomainEventV1Schema, {
        ...acceptedEvent,
        payload: {
          scope: {
            workspace_id: "workspace_001",
            bot_id: "bot_001",
            owner_agent_id: "owner_agent_001",
            deployment_environment: "dev",
            release_channel: "stable",
          },
          trigger_id: "trigger_001",
          trigger_process_id: "process_001",
          admission_outcome: "accepted",
          priority: "strong",
          dedupe_key: "chat:message_001",
          request_hash: "hash_001",
        },
      }),
    ).toBe(false);
    expect(
      Value.Check(TriggerProcessorDomainEventV1Schema, {
        ...acceptedEvent,
        payload: {
          ...acceptedEvent.payload,
          unregistered_state_blob: {},
        },
      }),
    ).toBe(false);
  });

  it("requires reason_code/source_ref for interrupt and retract events", () => {
    expect(
      Value.Check(TriggerProcessorDomainEventV1Schema, {
        ...acceptedEvent,
        event_id: "event_retract_001",
        event_type: "trigger_process.user_message_retracted",
        idempotency_key: "process_001:user_retracted",
        payload: {
          ...eventPayloadBase,
          reason_code: "user_retracted",
          source_ref: "trigger_event:message_001",
          trigger_process_id: "process_001",
          source_message_ref: "trigger_event:message_001",
          boundary_system_event_ref: "system_event:user_retracted_001",
        },
      }),
    ).toBe(true);
    expect(
      Value.Check(TriggerProcessorDomainEventV1Schema, {
        ...acceptedEvent,
        event_id: "event_interrupt_001",
        event_type: "trigger_process.system_interrupted",
        idempotency_key: "process_001:system_interrupted",
        payload: {
          ...eventPayloadBase,
          source_ref: "message_001",
          trigger_process_id: "process_001",
          boundary_system_event_ref: "system_event:interrupt_001",
          interrupt_source: "operator",
        },
      }),
    ).toBe(false);
  });

  it("publishes an explicit event type to consumer route matrix", () => {
    expect(TRIGGER_PROCESSOR_DOMAIN_EVENT_TYPES_V1).toEqual(
      Object.keys(TRIGGER_PROCESSOR_DOMAIN_EVENT_CONSUMERS_V1),
    );
    expect(
      TRIGGER_PROCESSOR_DOMAIN_EVENT_CONSUMERS_V1["trigger.accepted"],
    ).toEqual(["observation_gateway"]);
    expect(
      TRIGGER_PROCESSOR_DOMAIN_EVENT_CONSUMERS_V1[
        "trigger_process.outcome_finalized"
      ],
    ).toEqual(["observation_gateway", "trigger_processor"]);
    expect(
      TRIGGER_PROCESSOR_DOMAIN_EVENT_CONSUMERS_V1[
        "trigger_process.user_message_retracted"
      ],
    ).not.toContain("action_runtime");
  });

  it("is registered with generated schema, AsyncAPI, type and DB CHECK outputs", () => {
    const eventEntry = TRIGGER_PROCESSOR_SCHEMA_CATALOG.find(
      (entry) => entry.schema_name === "TriggerProcessorDomainEventV1",
    );
    expect(eventEntry).toMatchObject({
      schema_id: "urn:pai:trigger-processor:domain-event:v1",
      source_file: "packages/contracts/src/trigger-processor/events.v1.ts",
      contract_tests: [
        "packages/contracts/test/events/trigger-processor-events.contract.ts",
      ],
      generated_outputs: [
        "generated/schema/trigger-processor/events.v1.json",
        "generated/asyncapi/trigger-processor.yaml",
        "generated/types/trigger-processor-events.d.ts",
        "generated/db/trigger-processor-event-check.sql",
      ],
    });
    for (const eventType of TRIGGER_PROCESSOR_DOMAIN_EVENT_TYPES_V1) {
      expect(TRIGGER_PROCESSOR_DOMAIN_EVENT_V1_DATABASE_CHECK).toContain(
        `'${eventType}'`,
      );
    }
    expect(TRIGGER_PROCESSOR_DOMAIN_EVENT_V1_DATABASE_CHECK).toContain(
      "payload->>'schema_version' = 'trigger_processor_event.v1'",
    );
  });
});
