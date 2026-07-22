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
} from "../trigger-processor/events.v1.js";

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
  action_runtime: Object.freeze([
    "runtime.run.started",
    "runtime.run.completed",
    "runtime.run.failed",
    "runtime.run.cancelled",
    "runtime.run.preempted",
    "runtime.tool.requested",
    "runtime.tool.completed",
    "runtime.tool.failed",
    "runtime.tool.cancelled",
    "runtime.artifact.created",
    "runtime.artifact.failed",
    "runtime.control_signal.received",
    "runtime.control_signal.handled",
    "runtime.skill.load.requested",
    "runtime.skill.load.resolved",
    "runtime.skill.load.materialized",
    "runtime.skill.load.failed",
  ]),
  timer_trigger_app: Object.freeze([
    "timer.schedule.created",
    "timer.schedule.updated",
    "timer.schedule.paused",
    "timer.schedule.resumed",
    "timer.schedule.cancelled",
    "timer.schedule.completed",
    "timer.schedule.expired",
    "timer.schedule.failed",
    "timer.occurrence.due",
    "timer.occurrence.snoozed",
    "timer.occurrence.dispatched",
    "timer.occurrence.skipped",
    "timer.occurrence.failed",
    "timer.occurrence.cancelled",
    "timer.catch_up.batch_created",
    "timer.catch_up.occurrence_summarized",
  ]),
  meta_cognition: Object.freeze([
    "meta.job.created",
    "meta.job.started",
    "meta.job.retry_wait",
    "meta.experience.created",
    "meta.memory.write_requested",
    "meta.knowthat.write_requested",
    "meta.candidate.review_requested",
    "meta.candidate.reviewed",
    "meta.skill.candidate_application_requested",
    "meta.feedback.required",
    "meta.result.updated",
    "meta.result.finalized",
    "meta.job.completed",
    "meta.job.failed",
  ]),
  skill_registry: Object.freeze([
    "skill.version.published",
    "skill.catalog.changed",
    "skill.version.activated",
    "skill.activation.rolled_back",
    "skill.version.deprecated",
    "skill.version.revoked",
    "skill.permission.granted",
    "skill.permission.revoked",
    "skill.security_revocation_epoch.changed",
    "skill.candidate.application.updated",
  ]),
  knowthat: Object.freeze([
    "knowthat.fact.created",
    "knowthat.fact.updated",
    "knowthat.candidate.promoted",
    "knowthat.candidate.rejected",
    "knowthat.fact.expired",
    "knowthat.conflict.detected",
    "knowthat.linkage_check.requested",
  ]),
  memory: Object.freeze([
    "memory.point.created",
    "memory.point.updated",
    "memory.series.created",
    "memory.series.updated",
    "memory.conflict.detected",
    "memory.conflict.updated",
    "memory.integration.finished",
  ]),
} as const satisfies Readonly<
  Record<DurableEventOwnerServiceIdV1, readonly [string, ...string[]]>
>);

export type OwnerDurableEventTypeV1<
  TOwner extends DurableEventOwnerServiceIdV1,
> = (typeof OWNER_DURABLE_EVENT_TYPES_V1)[TOwner][number];

type ActiveDurableEventOwnerServiceIdV1 = "trigger_processor";
type PendingDurableEventOwnerServiceIdV1 = Exclude<
  DurableEventOwnerServiceIdV1,
  ActiveDurableEventOwnerServiceIdV1
>;

/**
 * Owner unions that are declared for PostgreSQL CHECK generation but are not
 * executable wire contracts yet. These owners stay fail-closed until their
 * live owner documents provide complete envelope and payload schemas.
 */
export const PENDING_OWNER_DURABLE_EVENT_TYPES_V1 = Object.freeze({
  action_runtime: OWNER_DURABLE_EVENT_TYPES_V1.action_runtime,
  timer_trigger_app: OWNER_DURABLE_EVENT_TYPES_V1.timer_trigger_app,
  meta_cognition: OWNER_DURABLE_EVENT_TYPES_V1.meta_cognition,
  skill_registry: OWNER_DURABLE_EVENT_TYPES_V1.skill_registry,
  knowthat: OWNER_DURABLE_EVENT_TYPES_V1.knowthat,
  memory: OWNER_DURABLE_EVENT_TYPES_V1.memory,
} as const satisfies Readonly<{
  [TOwner in PendingDurableEventOwnerServiceIdV1]:
    (typeof OWNER_DURABLE_EVENT_TYPES_V1)[TOwner];
}>);

/** Complete owner wire unions admitted by validation and dispatch. */
export const ACTIVE_OWNER_DURABLE_EVENT_TYPES_V1 = Object.freeze({
  trigger_processor: OWNER_DURABLE_EVENT_TYPES_V1.trigger_processor,
} as const satisfies Readonly<{
  [TOwner in ActiveDurableEventOwnerServiceIdV1]:
    (typeof OWNER_DURABLE_EVENT_TYPES_V1)[TOwner];
}>);

export type DurableEventConsumerServiceIdV1 = ServiceIdV1;

export interface OwnerDurableEventContractV1 {
  readonly schema_version: string;
  readonly payload_schema: TSchema;
  readonly payload_scope: "bot" | "bot_or_global";
  readonly consumer_services: readonly [
    DurableEventConsumerServiceIdV1,
    ...DurableEventConsumerServiceIdV1[],
  ];
}

type OwnerDurableEventContractMapV1 = Readonly<{
  trigger_processor: Readonly<
    Record<
      OwnerDurableEventTypeV1<"trigger_processor">,
      OwnerDurableEventContractV1
    >
  >;
}>;

const triggerEvent = (
  eventType: keyof typeof TRIGGER_PROCESSOR_DOMAIN_EVENT_PAYLOAD_SCHEMAS_V1,
) =>
  Object.freeze({
    schema_version: "trigger_processor_event.v1",
    payload_schema:
      TRIGGER_PROCESSOR_DOMAIN_EVENT_PAYLOAD_SCHEMAS_V1[eventType],
    payload_scope: "bot",
    consumer_services: Object.freeze([
      ...TRIGGER_PROCESSOR_DOMAIN_EVENT_CONSUMERS_V1[eventType],
    ]) as unknown as readonly [
      DurableEventConsumerServiceIdV1,
      ...DurableEventConsumerServiceIdV1[],
    ],
  } satisfies OwnerDurableEventContractV1);

export const OWNER_DURABLE_EVENT_CONTRACTS_V1 = Object.freeze({
  trigger_processor: Object.freeze({
    "trigger.accepted": triggerEvent("trigger.accepted"),
    "trigger.rejected": triggerEvent("trigger.rejected"),
    "trigger_process.phase_changed": triggerEvent("trigger_process.phase_changed"),
    "trigger_process.user_message_retracted": triggerEvent(
      "trigger_process.user_message_retracted",
    ),
    "trigger_process.system_interrupted": triggerEvent(
      "trigger_process.system_interrupted",
    ),
    "cooldown.expired": triggerEvent("cooldown.expired"),
    "weak_trigger.merged": triggerEvent("weak_trigger.merged"),
    "trigger_process.outcome_finalized": triggerEvent(
      "trigger_process.outcome_finalized",
    ),
  }),
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

export function durableEventTargetConsumerV1(
  target: string,
): DurableEventConsumerServiceIdV1 | undefined {
  const segments = target.split(".");
  const service = segments[0];
  if (
    segments.length < 2 ||
    segments.some((segment) => !/^[a-z][a-z0-9_]{0,63}$/u.test(segment)) ||
    service === undefined ||
    !(SERVICE_IDS as readonly string[]).includes(service)
  ) {
    return undefined;
  }
  return service as DurableEventConsumerServiceIdV1;
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
