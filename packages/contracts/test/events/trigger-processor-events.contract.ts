import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  TRIGGER_PROCESSOR_DOMAIN_EVENT_CONSUMERS_V1,
  TRIGGER_PROCESSOR_DOMAIN_EVENT_TYPES_V1,
  TRIGGER_PROCESSOR_DOMAIN_EVENT_V1_DATABASE_CHECK,
  TRIGGER_PROCESSOR_DOMAIN_EVENT_BRANCH_SCHEMAS_V1,
  TRIGGER_PROCESSOR_SCHEMA_CATALOG,
  TriggerProcessorDomainEventV1Schema,
  assertTriggerProcessorDomainEventSemanticBindingsV1,
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

const runningAdmission = {
  phase: "admission",
  status: "running",
  wait_reason: null,
  terminal_reason: null,
} as const;

const packageRoot = fileURLToPath(new URL("../../", import.meta.url));

async function readGeneratedJson(path: string): Promise<unknown> {
  return JSON.parse(
    await readFile(new URL(path, `file://${packageRoot}/`), "utf8"),
  ) as unknown;
}

function triggerProcessorEventMessageName(eventType: string): string {
  return `TriggerProcessor${eventType
    .split(/[^a-z0-9]+/u)
    .filter(Boolean)
    .map((segment) => `${segment[0]!.toUpperCase()}${segment.slice(1)}`)
    .join("")}EventV1`;
}

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

  it("uses draft 2020-12 strict root schema metadata", () => {
    const schema = TriggerProcessorDomainEventV1Schema as unknown as Readonly<
      Record<string, unknown>
    >;
    expect(schema.$schema).toBe(
      "https://json-schema.org/draft/2020-12/schema",
    );
    expect(schema.unevaluatedProperties).toBe(false);
  });

  it("is registered with generated schema, AsyncAPI, type and column-level DB CHECK outputs", () => {
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
      "schema_version = 'trigger_processor_event.v1'",
    );
    expect(TRIGGER_PROCESSOR_DOMAIN_EVENT_V1_DATABASE_CHECK).toContain(
      "producer = 'trigger_processor'",
    );
    expect(TRIGGER_PROCESSOR_DOMAIN_EVENT_V1_DATABASE_CHECK).toContain(
      "event_type in (",
    );
    expect(TRIGGER_PROCESSOR_DOMAIN_EVENT_V1_DATABASE_CHECK).not.toContain(
      "payload->>",
    );
    expect(TRIGGER_PROCESSOR_DOMAIN_EVENT_V1_DATABASE_CHECK).toContain(
      "drop constraint if exists trigger_event_outbox_event_schema_pair_check",
    );
    expect(TRIGGER_PROCESSOR_DOMAIN_EVENT_V1_DATABASE_CHECK).toContain(
      "drop constraint if exists trigger_event_outbox_schema_version_check",
    );
    expect(TRIGGER_PROCESSOR_DOMAIN_EVENT_V1_DATABASE_CHECK).toContain(
      "add constraint trigger_event_outbox_schema_version_check",
    );
    expect(TRIGGER_PROCESSOR_DOMAIN_EVENT_V1_DATABASE_CHECK).toContain(
      "add constraint trigger_event_outbox_domain_event_v1_check",
    );
  });

  it("exposes one branch schema per AsyncAPI channel discriminator", () => {
    expect(Object.keys(TRIGGER_PROCESSOR_DOMAIN_EVENT_BRANCH_SCHEMAS_V1)).toEqual(
      [...TRIGGER_PROCESSOR_DOMAIN_EVENT_TYPES_V1],
    );
    expect(
      Value.Check(
        TRIGGER_PROCESSOR_DOMAIN_EVENT_BRANCH_SCHEMAS_V1["trigger.accepted"],
        acceptedEvent,
      ),
    ).toBe(true);
    expect(
      Value.Check(
        TRIGGER_PROCESSOR_DOMAIN_EVENT_BRANCH_SCHEMAS_V1["trigger.rejected"],
        acceptedEvent,
      ),
    ).toBe(false);
  });

  it("rejects schema-valid impossible Trigger lifecycle facts", () => {
    const impossibleEvents = [
      {
        ...acceptedEvent,
        event_id: "event_phase_noop_001",
        event_type: "trigger_process.phase_changed",
        idempotency_key: "process_001:phase_noop",
        payload: {
          ...eventPayloadBase,
          trigger_process_id: "process_001",
          previous_state: runningAdmission,
          next_state: runningAdmission,
          expected_state_version: 1,
          transition_id: "transition_001",
        },
      },
      {
        ...acceptedEvent,
        event_id: "event_cooldown_backwards_001",
        event_type: "cooldown.expired",
        idempotency_key: "process_001:cooldown_backwards",
        payload: {
          ...eventPayloadBase,
          trigger_process_id: "process_001",
          cooldown_until: "2026-07-22T05:00:00.000Z",
          expired_at: "2026-07-22T04:59:59.999Z",
        },
      },
      {
        ...acceptedEvent,
        event_id: "event_weak_merge_duplicate_001",
        event_type: "weak_trigger.merged",
        idempotency_key: "weak_group_001:merged",
        payload: {
          ...eventPayloadBase,
          weak_group_id: "weak_group_001",
          canonical_process_id: "process_canonical_001",
          merged_process_ids: [
            "process_canonical_001",
            "process_canonical_001",
          ],
          merge_window_started_at: "2026-07-22T04:00:00.000Z",
        },
      },
      {
        ...acceptedEvent,
        event_id: "event_reason_outcome_mismatch_001",
        event_type: "trigger_process.outcome_finalized",
        idempotency_key: "process_001:outcome_mismatch",
        payload: {
          ...eventPayloadBase,
          reason_code: "cooldown_expired",
          trigger_process_id: "process_001",
          terminal_outcome: "cancelled_with_reason",
          canonical_reason_code: "cooldown_expired",
          finalized_at: "2026-07-22T05:00:00.000Z",
        },
      },
    ] as const;

    for (const impossibleEvent of impossibleEvents) {
      expect(
        Value.Check(TriggerProcessorDomainEventV1Schema, impossibleEvent),
      ).toBe(true);
      expect(() =>
        assertTriggerProcessorDomainEventSemanticBindingsV1(impossibleEvent),
      ).toThrow(/semantic binding/u);
    }

    expect(() =>
      assertTriggerProcessorDomainEventSemanticBindingsV1({
        ...acceptedEvent,
        event_id: "event_reason_outcome_valid_001",
        event_type: "trigger_process.outcome_finalized",
        idempotency_key: "process_001:outcome_valid",
        payload: {
          ...eventPayloadBase,
          reason_code: "cooldown_expired",
          trigger_process_id: "process_001",
          terminal_outcome: "executed",
          canonical_reason_code: "cooldown_expired",
          finalized_at: "2026-07-22T05:00:00.000Z",
        },
      }),
    ).not.toThrow();
  });

  it("generates strict JSON schema metadata and branch-specific AsyncAPI messages", async () => {
    const generatedSchema = await readGeneratedJson(
      "generated/schema/trigger-processor/events.v1.json",
    ) as Readonly<Record<string, unknown>>;
    expect(generatedSchema.$schema).toBe(
      "https://json-schema.org/draft/2020-12/schema",
    );
    expect(generatedSchema.unevaluatedProperties).toBe(false);

    const asyncApi = await readGeneratedJson(
      "generated/asyncapi/trigger-processor.yaml",
    ) as Readonly<{
      channels: Record<
        string,
        Readonly<{ messages: Record<string, Readonly<{ $ref: string }>> }>
      >;
      components: Readonly<{
        messages: Record<string, Readonly<{ payload: unknown }>>;
      }>;
    }>;
    const expectedMessages = TRIGGER_PROCESSOR_DOMAIN_EVENT_TYPES_V1.map(
      triggerProcessorEventMessageName,
    );
    expect(Object.keys(asyncApi.components.messages).sort()).toEqual(
      [...expectedMessages].sort(),
    );
    for (const eventType of TRIGGER_PROCESSOR_DOMAIN_EVENT_TYPES_V1) {
      const messageName = triggerProcessorEventMessageName(eventType);
      expect(
        asyncApi.channels[`trigger_processor.${eventType}`]?.messages[
          messageName
        ]?.$ref,
      ).toBe(`#/components/messages/${messageName}`);
    }
    expect(
      (
        asyncApi.components.messages.TriggerProcessorTriggerAcceptedEventV1
          ?.payload as Readonly<{
          properties?: Readonly<{
            event_type?: Readonly<{ const?: unknown }>;
          }>;
        }>
      ).properties?.event_type?.const,
    ).toBe("trigger.accepted");
    expect(
      (
        asyncApi.components.messages.TriggerProcessorTriggerRejectedEventV1
          ?.payload as Readonly<{
          properties?: Readonly<{
            event_type?: Readonly<{ const?: unknown }>;
          }>;
        }>
      ).properties?.event_type?.const,
    ).toBe("trigger.rejected");
  });
});
