import { Type, type TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import {
  assertDurableEventEnvelopeV1,
  DurableEventEnvelopeV1Schema,
  DurableEventEnvelopeValidationErrorV1,
  type DurableEventEnvelopeV1,
} from "./durable-event-envelope.v1.js";
import { SERVICE_IDS, type ServiceIdV1 } from "./service-id.v1.js";
import {
  TRIGGER_PROCESSOR_DOMAIN_EVENT_CONSUMERS_V1,
  TRIGGER_PROCESSOR_DOMAIN_EVENT_PAYLOAD_SCHEMAS_V1,
  TRIGGER_PROCESSOR_DOMAIN_EVENT_TYPES_V1,
  assertTriggerProcessorDomainEventSemanticBindingsV1,
} from "../trigger-processor/events.v1.js";
import {
  ACTION_RUNTIME_DOMAIN_EVENT_BRANCH_SCHEMAS_V1,
  ACTION_RUNTIME_DOMAIN_EVENT_TYPES_V1,
  assertRuntimeDomainEventSemanticBindingsV1,
} from "../action-runtime/runtime-events.v1.js";
import {
  KNOWTHAT_EVENT_CONSUMERS_V1,
  KNOWTHAT_EVENT_PAYLOAD_SCHEMAS_V1,
  assertKnowThatEventEnvelopeV1,
} from "../knowthat/knowthat-event.v1.js";
import {
  MEMORY_EVENT_CONSUMERS_V1,
  MEMORY_EVENT_PAYLOAD_SCHEMAS_V1,
  MEMORY_EVENT_TYPES_V1,
  assertMemoryEventEnvelopeSemanticBindingsV1,
} from "../memory/memory-event.v1.js";
import {
  META_COGNITION_DOMAIN_EVENT_CONSUMERS_V1,
  META_COGNITION_DOMAIN_EVENT_PAYLOAD_SCHEMAS_V1,
  META_COGNITION_DOMAIN_EVENT_TYPES_V1,
  assertMetaCognitionDomainEventSemanticBindingsV1,
} from "../meta/events.v1.js";
import {
  SKILL_REGISTRY_DOMAIN_EVENT_CONSUMERS_V1,
  SKILL_REGISTRY_DOMAIN_EVENT_PAYLOAD_SCHEMAS_V1,
  SKILL_REGISTRY_DOMAIN_EVENT_TYPES_V1,
  assertSkillRegistryDomainEventSemanticBindingsV1,
} from "../skill-registry/events.v1.js";
import {
  TIMER_DURABLE_EVENT_CONSUMERS_V1,
  TIMER_DURABLE_EVENT_PAYLOAD_SCHEMAS_V1,
  TIMER_DURABLE_EVENT_TYPES_V1,
  assertTimerEventEnvelopeBindingsV1,
} from "../timer/timer-event.v1.js";

export type DurableEventOwnerServiceIdV1 = Exclude<
  ServiceIdV1,
  "observation_gateway"
>;

/**
 * Canonical owner event-type unions used by both owner event contracts and
 * PostgreSQL CHECK generation/verification. Observation has no database owner
 * and therefore cannot produce an owner outbox union here.
 */
export const OWNER_DURABLE_EVENT_TYPES_V1 = Object.freeze({
  trigger_processor: TRIGGER_PROCESSOR_DOMAIN_EVENT_TYPES_V1,
  action_runtime: ACTION_RUNTIME_DOMAIN_EVENT_TYPES_V1,
  timer_trigger_app: Object.freeze([
    ...TIMER_DURABLE_EVENT_TYPES_V1,
  ]) as unknown as typeof TIMER_DURABLE_EVENT_TYPES_V1,
  meta_cognition: META_COGNITION_DOMAIN_EVENT_TYPES_V1,
  skill_registry: SKILL_REGISTRY_DOMAIN_EVENT_TYPES_V1,
  knowthat: Object.freeze(
    Object.keys(KNOWTHAT_EVENT_PAYLOAD_SCHEMAS_V1),
  ) as readonly [
    keyof typeof KNOWTHAT_EVENT_PAYLOAD_SCHEMAS_V1,
    ...(keyof typeof KNOWTHAT_EVENT_PAYLOAD_SCHEMAS_V1)[],
  ],
  memory: Object.freeze([
    ...MEMORY_EVENT_TYPES_V1,
  ]) as unknown as typeof MEMORY_EVENT_TYPES_V1,
} as const satisfies Readonly<
  Record<DurableEventOwnerServiceIdV1, readonly [string, ...string[]]>
>);

export type OwnerDurableEventTypeV1<
  TOwner extends DurableEventOwnerServiceIdV1,
> = (typeof OWNER_DURABLE_EVENT_TYPES_V1)[TOwner][number];

/**
 * Kept as a compatibility export. Every non-Observation owner now has a
 * complete wire schema; unresolved logical targets fail closed in the route
 * matrix instead of disabling the owner's event union.
 */
export const PENDING_OWNER_DURABLE_EVENT_TYPES_V1 = Object.freeze({});

/** Complete owner wire unions admitted by validation and dispatch. */
export const ACTIVE_OWNER_DURABLE_EVENT_TYPES_V1 = Object.freeze({
  ...OWNER_DURABLE_EVENT_TYPES_V1,
} as const satisfies Readonly<{
  [TOwner in DurableEventOwnerServiceIdV1]:
    (typeof OWNER_DURABLE_EVENT_TYPES_V1)[TOwner];
}>);

export type DurableEventConsumerServiceIdV1 = ServiceIdV1;

export interface OwnerDurableEventContractV1 {
  readonly schema_version: string;
  readonly payload_schema: TSchema;
  readonly payload_scope: "bot" | "bot_or_global";
  readonly consumer_services: readonly DurableEventConsumerServiceIdV1[];
}

type OwnerDurableEventContractMapV1 = Readonly<{
  [TOwner in DurableEventOwnerServiceIdV1]: Readonly<
    Record<
      OwnerDurableEventTypeV1<TOwner>,
      OwnerDurableEventContractV1
    >
  >;
}>;

function directConsumerServiceV1(value: string): ServiceIdV1 | undefined {
  return (SERVICE_IDS as readonly string[]).includes(value)
    ? (value as ServiceIdV1)
    : undefined;
}

function ownerEventContractsV1(
  eventTypes: readonly string[],
  schemaVersion: string,
  payloadSchemas: Readonly<Record<string, TSchema>>,
  consumers: Readonly<Record<string, readonly string[]>>,
  payloadScope: OwnerDurableEventContractV1["payload_scope"],
  resolveConsumer: (value: string) => ServiceIdV1 | undefined =
    directConsumerServiceV1,
): Readonly<Record<string, OwnerDurableEventContractV1>> {
  return Object.freeze(
    Object.fromEntries(
      eventTypes.map((eventType) => {
        const payloadSchema = payloadSchemas[eventType];
        const declaredConsumers = consumers[eventType];
        if (payloadSchema === undefined || declaredConsumers === undefined) {
          throw new Error(`owner durable event catalog is incomplete: ${eventType}`);
        }
        return [
          eventType,
          Object.freeze({
            schema_version: schemaVersion,
            payload_schema: payloadSchema,
            payload_scope: payloadScope,
            consumer_services: Object.freeze(
              declaredConsumers
                .map(resolveConsumer)
                .filter(
                  (consumer): consumer is ServiceIdV1 =>
                    consumer !== undefined,
                ),
            ),
          } satisfies OwnerDurableEventContractV1),
        ];
      }),
    ),
  );
}

const actionRuntimePayloadSchemasV1 = Object.freeze(
  Object.fromEntries(
    ACTION_RUNTIME_DOMAIN_EVENT_TYPES_V1.map((eventType) => [
      eventType,
      ACTION_RUNTIME_DOMAIN_EVENT_BRANCH_SCHEMAS_V1[eventType].properties
        .payload,
    ]),
  ),
);
const actionRuntimeConsumersV1 = Object.freeze(
  Object.fromEntries(
    ACTION_RUNTIME_DOMAIN_EVENT_TYPES_V1.map((eventType) => [
      eventType,
      Object.freeze(["trigger_processor"]),
    ]),
  ),
);
const memoryConsumerServiceV1 = (consumer: string): ServiceIdV1 | undefined => {
  if (consumer === "meta") return "meta_cognition";
  if (consumer === "memory_projection") return "memory";
  // rev309 names feedback_router/operator_projection but does not assign
  // either alias to a PAI service owner. They stay unroutable fail-closed.
  return undefined;
};

export const OWNER_DURABLE_EVENT_CONTRACTS_V1 = Object.freeze({
  trigger_processor: ownerEventContractsV1(
    TRIGGER_PROCESSOR_DOMAIN_EVENT_TYPES_V1,
    "trigger_processor_event.v1",
    TRIGGER_PROCESSOR_DOMAIN_EVENT_PAYLOAD_SCHEMAS_V1,
    TRIGGER_PROCESSOR_DOMAIN_EVENT_CONSUMERS_V1,
    "bot",
  ),
  action_runtime: ownerEventContractsV1(
    ACTION_RUNTIME_DOMAIN_EVENT_TYPES_V1,
    "runtime_event.v1",
    actionRuntimePayloadSchemasV1,
    actionRuntimeConsumersV1,
    "bot",
  ),
  timer_trigger_app: ownerEventContractsV1(
    TIMER_DURABLE_EVENT_TYPES_V1,
    "timer.event.v1",
    TIMER_DURABLE_EVENT_PAYLOAD_SCHEMAS_V1,
    TIMER_DURABLE_EVENT_CONSUMERS_V1,
    "bot",
  ),
  meta_cognition: ownerEventContractsV1(
    META_COGNITION_DOMAIN_EVENT_TYPES_V1,
    "meta_cognition_event.v1",
    META_COGNITION_DOMAIN_EVENT_PAYLOAD_SCHEMAS_V1,
    META_COGNITION_DOMAIN_EVENT_CONSUMERS_V1,
    "bot",
  ),
  skill_registry: ownerEventContractsV1(
    SKILL_REGISTRY_DOMAIN_EVENT_TYPES_V1,
    "skill_registry_event.v1",
    SKILL_REGISTRY_DOMAIN_EVENT_PAYLOAD_SCHEMAS_V1,
    SKILL_REGISTRY_DOMAIN_EVENT_CONSUMERS_V1,
    "bot_or_global",
  ),
  knowthat: ownerEventContractsV1(
    OWNER_DURABLE_EVENT_TYPES_V1.knowthat,
    "knowthat_event.v1",
    KNOWTHAT_EVENT_PAYLOAD_SCHEMAS_V1,
    KNOWTHAT_EVENT_CONSUMERS_V1,
    "bot",
  ),
  memory: ownerEventContractsV1(
    MEMORY_EVENT_TYPES_V1,
    "memory.event.v1",
    MEMORY_EVENT_PAYLOAD_SCHEMAS_V1,
    MEMORY_EVENT_CONSUMERS_V1,
    "bot",
    memoryConsumerServiceV1,
  ),
} as const satisfies OwnerDurableEventContractMapV1);

const ownerDurableEventBranches = Object.entries(
  OWNER_DURABLE_EVENT_CONTRACTS_V1,
).flatMap(([owner, contracts]) =>
  Object.entries(contracts).map(([eventType, contract]) =>
    Type.Object(
      {
        event_id: DurableEventEnvelopeV1Schema.properties.event_id,
        event_type: Type.Literal(eventType),
        schema_version: Type.Literal(contract.schema_version),
        producer: Type.Literal(owner),
        occurred_at: DurableEventEnvelopeV1Schema.properties.occurred_at,
        idempotency_key:
          DurableEventEnvelopeV1Schema.properties.idempotency_key,
        trace_id: DurableEventEnvelopeV1Schema.properties.trace_id,
        payload: contract.payload_schema,
      },
      { additionalProperties: false },
    ),
  ),
);

export const OwnerDurableEventEnvelopeV1Schema = Type.Union(
  ownerDurableEventBranches,
  { $id: "urn:pai:shared:owner-durable-event-envelope:v1" },
);

export function isOwnerDurableEventTypeV1(
  owner: ServiceIdV1,
  eventType: string,
): boolean {
  return ownerDurableEventContractV1(owner, eventType) !== undefined;
}

export function ownerDurableEventContractV1(
  owner: ServiceIdV1,
  eventType: string,
): OwnerDurableEventContractV1 | undefined {
  if (owner === "observation_gateway") return undefined;
  const contracts = (
    OWNER_DURABLE_EVENT_CONTRACTS_V1 as Readonly<
      Partial<
        Record<
          DurableEventOwnerServiceIdV1,
          Readonly<Record<string, OwnerDurableEventContractV1>>
        >
      >
    >
  )[owner];
  return contracts?.[eventType];
}

export function assertOwnerDurableEventEnvelopeV1(
  value: unknown,
): asserts value is DurableEventEnvelopeV1 {
  assertDurableEventEnvelopeV1(value);
  const contract = ownerDurableEventContractV1(
    value.producer,
    value.event_type,
  );
  const issues: string[] = [];
  if (contract === undefined) {
    issues.push("/event_type: must belong to the producer owner union");
  } else {
    if (value.schema_version !== contract.schema_version) {
      issues.push("/schema_version: must match the owner event branch");
    }
    if (!Value.Check(contract.payload_schema, value.payload)) {
      issues.push(
        ...[...Value.Errors(contract.payload_schema, value.payload)].map(
          (issue) =>
            `/payload${issue.path || ""}: ${issue.message}`,
        ),
      );
    }
  }
  if (issues.length > 0) {
    throw new DurableEventEnvelopeValidationErrorV1(issues);
  }
  try {
    switch (value.producer) {
      case "action_runtime":
        assertRuntimeDomainEventSemanticBindingsV1(value as never);
        break;
      case "timer_trigger_app":
        assertTimerEventEnvelopeBindingsV1(value as never);
        break;
      case "meta_cognition":
        assertMetaCognitionDomainEventSemanticBindingsV1(value as never);
        break;
      case "skill_registry":
        assertSkillRegistryDomainEventSemanticBindingsV1(value as never);
        break;
      case "knowthat":
        assertKnowThatEventEnvelopeV1(value);
        break;
      case "memory":
        assertMemoryEventEnvelopeSemanticBindingsV1(value as never);
        break;
      case "trigger_processor":
        assertTriggerProcessorDomainEventSemanticBindingsV1(value as never);
        break;
      case "observation_gateway":
        throw new Error("Observation Gateway is not an event owner");
    }
  } catch {
    throw new DurableEventEnvelopeValidationErrorV1([
      "/payload: owner event semantic binding mismatch",
    ]);
  }
}

export function isDurableEventConsumerAllowedV1(
  envelope: DurableEventEnvelopeV1,
  consumer: ServiceIdV1,
): consumer is DurableEventConsumerServiceIdV1 {
  const contract = ownerDurableEventContractV1(
    envelope.producer,
    envelope.event_type,
  );
  return (
    contract?.consumer_services.includes(consumer) === true
  );
}

/**
 * Exact logical outbox targets. A syntactically plausible
 * `<service>.<operation>` string is never enough: each target must be a live
 * owner-document target or an explicit internal projection target.
 */
export const DURABLE_EVENT_TARGET_CONSUMERS_V1 = Object.freeze({
  "trigger_processor.admission_audit": "trigger_processor",
  "trigger_processor.trigger_event_append": "trigger_processor",
  "trigger_processor.projection": "trigger_processor",
  "trigger_processor.skill_projection": "trigger_processor",
  "observation_gateway.trigger_event_append": "observation_gateway",
  "action_runtime.skill_projection": "action_runtime",
  "meta_cognition.trigger_process_projection": "meta_cognition",
  "meta_cognition.skill_projection": "meta_cognition",
  "skill_registry.candidate_application": "skill_registry",
  "memory_service.write_batch": "memory",
  "knowthat_service.write_batch": "knowthat",
  "knowthat_service.candidate_review": "knowthat",
  "feedback_request.dispatcher": "meta_cognition",
  "feedback_request.queue_projection": "meta_cognition",
  "knowthat.projection": "knowthat",
  "memory.linkage": "memory",
  meta: "meta_cognition",
  memory_projection: "memory",
} as const satisfies Readonly<
  Record<string, DurableEventConsumerServiceIdV1>
>);

export function durableEventTargetConsumerV1(
  target: string,
): DurableEventConsumerServiceIdV1 | undefined {
  return (
    DURABLE_EVENT_TARGET_CONSUMERS_V1 as Readonly<
      Record<string, DurableEventConsumerServiceIdV1>
    >
  )[target];
}

export function isDurableEventTargetAllowedV1(
  envelope: DurableEventEnvelopeV1,
  target: string,
): boolean {
  const consumer = durableEventTargetConsumerV1(target);
  return (
    consumer !== undefined &&
    isDurableEventConsumerAllowedV1(envelope, consumer)
  );
}
