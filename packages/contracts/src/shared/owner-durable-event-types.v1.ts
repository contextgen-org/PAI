import { Type, type TSchema } from "@sinclair/typebox";

import {
  assertDurableEventEnvelopeV1,
  DurableEventEnvelopeV1Schema,
  DurableEventEnvelopeValidationErrorV1,
  type DurableEventEnvelopeV1,
} from "./durable-event-envelope.v1.js";
import { SERVICE_IDS, type ServiceIdV1 } from "./service-id.v1.js";

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
  trigger_processor: Object.freeze([
    "trigger.accepted",
    "trigger.rejected",
    "trigger_process.phase_changed",
    "trigger_process.user_message_retracted",
    "trigger_process.system_interrupted",
    "cooldown.expired",
    "weak_trigger.merged",
    "trigger_process.outcome_finalized",
  ]),
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

export type DurableEventConsumerServiceIdV1 = DurableEventOwnerServiceIdV1;

export interface OwnerDurableEventContractV1 {
  readonly schema_version: string;
  readonly required_payload_keys: readonly [string, ...string[]];
  readonly consumer_services: readonly [
    DurableEventConsumerServiceIdV1,
    ...DurableEventConsumerServiceIdV1[],
  ];
}

type OwnerDurableEventContractMapV1 = {
  readonly [TOwner in DurableEventOwnerServiceIdV1]: Readonly<
    Record<OwnerDurableEventTypeV1<TOwner>, OwnerDurableEventContractV1>
  >;
};

function eventContract(
  schemaVersion: string,
  requiredPayloadKeys: readonly [string, ...string[]],
  consumerServices: readonly [
    DurableEventConsumerServiceIdV1,
    ...DurableEventConsumerServiceIdV1[],
  ],
): OwnerDurableEventContractV1 {
  return Object.freeze({
    schema_version: schemaVersion,
    required_payload_keys: Object.freeze([...requiredPayloadKeys]) as [
      string,
      ...string[],
    ],
    consumer_services: Object.freeze([...consumerServices]) as [
      DurableEventConsumerServiceIdV1,
      ...DurableEventConsumerServiceIdV1[],
    ],
  });
}

const triggerProcessorConsumer = ["trigger_processor"] as const;
const runtimeEventConsumer = ["trigger_processor"] as const;
const metaConsumer = ["meta_cognition"] as const;
const memoryConsumer = ["memory"] as const;
const knowthatConsumer = ["knowthat"] as const;

const triggerEvent = (keys: readonly [string, ...string[]]) =>
  eventContract("trigger_processor_event.v1", keys, metaConsumer);
const runtimeEvent = (keys: readonly [string, ...string[]]) =>
  eventContract("runtime_domain_event.v1", keys, runtimeEventConsumer);
const toolEvent = (keys: readonly [string, ...string[]]) =>
  eventContract("tool_invocation_event.v1", keys, runtimeEventConsumer);
const timerEvent = (keys: readonly [string, ...string[]]) =>
  eventContract("timer_event.v1", keys, triggerProcessorConsumer);
const metaEvent = (
  keys: readonly [string, ...string[]],
  consumers: readonly [
    DurableEventConsumerServiceIdV1,
    ...DurableEventConsumerServiceIdV1[],
  ] = triggerProcessorConsumer,
) => eventContract("meta_cognition_event.v1", keys, consumers);
const skillEvent = (keys: readonly [string, ...string[]]) =>
  eventContract("skill_registry_event.v1", keys, triggerProcessorConsumer);
const knowthatEvent = (keys: readonly [string, ...string[]]) =>
  eventContract("knowthat_event.v1", keys, metaConsumer);
const memoryEvent = (keys: readonly [string, ...string[]]) =>
  eventContract("memory_event.v1", keys, metaConsumer);

export const OWNER_DURABLE_EVENT_CONTRACTS_V1 = Object.freeze({
  trigger_processor: Object.freeze({
    "trigger.accepted": triggerEvent(["trigger_id", "trigger_process_id"]),
    "trigger.rejected": triggerEvent(["trigger_id", "reason"]),
    "trigger_process.phase_changed": triggerEvent(["trigger_process_id", "phase"]),
    "trigger_process.user_message_retracted": triggerEvent([
      "trigger_process_id",
      "reason",
    ]),
    "trigger_process.system_interrupted": triggerEvent([
      "trigger_process_id",
      "reason",
    ]),
    "cooldown.expired": triggerEvent(["trigger_process_id"]),
    "weak_trigger.merged": triggerEvent(["queue_item_id", "trigger_process_id"]),
    "trigger_process.outcome_finalized": triggerEvent([
      "trigger_process_id",
      "outcome",
    ]),
  }),
  action_runtime: Object.freeze({
    "runtime.run.started": runtimeEvent(["runtime_run_id"]),
    "runtime.run.completed": runtimeEvent(["runtime_run_id", "outcome"]),
    "runtime.run.failed": runtimeEvent(["runtime_run_id", "error_code"]),
    "runtime.run.cancelled": runtimeEvent(["runtime_run_id", "reason"]),
    "runtime.run.preempted": runtimeEvent(["runtime_run_id", "reason"]),
    "runtime.tool.requested": toolEvent(["runtime_run_id", "tool_invocation_id"]),
    "runtime.tool.completed": toolEvent(["runtime_run_id", "tool_invocation_id"]),
    "runtime.tool.failed": toolEvent([
      "runtime_run_id",
      "tool_invocation_id",
      "error_code",
    ]),
    "runtime.tool.cancelled": toolEvent([
      "runtime_run_id",
      "tool_invocation_id",
      "reason",
    ]),
    "runtime.artifact.created": runtimeEvent(["runtime_run_id", "artifact_id"]),
    "runtime.artifact.failed": runtimeEvent([
      "runtime_run_id",
      "artifact_id",
      "error_code",
    ]),
    "runtime.control_signal.received": runtimeEvent([
      "runtime_run_id",
      "runtime_signal_id",
    ]),
    "runtime.control_signal.handled": runtimeEvent([
      "runtime_run_id",
      "runtime_signal_id",
    ]),
    "runtime.skill.load.requested": runtimeEvent(["runtime_run_id", "skill_id"]),
    "runtime.skill.load.resolved": runtimeEvent(["runtime_run_id", "skill_id"]),
    "runtime.skill.load.materialized": runtimeEvent([
      "runtime_run_id",
      "skill_id",
    ]),
    "runtime.skill.load.failed": runtimeEvent([
      "runtime_run_id",
      "skill_id",
      "error_code",
    ]),
  }),
  timer_trigger_app: Object.freeze({
    "timer.schedule.created": timerEvent(["schedule_id"]),
    "timer.schedule.updated": timerEvent(["schedule_id"]),
    "timer.schedule.paused": timerEvent(["schedule_id"]),
    "timer.schedule.resumed": timerEvent(["schedule_id"]),
    "timer.schedule.cancelled": timerEvent(["schedule_id", "reason"]),
    "timer.schedule.completed": timerEvent(["schedule_id"]),
    "timer.schedule.expired": timerEvent(["schedule_id"]),
    "timer.schedule.failed": timerEvent(["schedule_id", "error_code"]),
    "timer.occurrence.due": timerEvent(["occurrence_id"]),
    "timer.occurrence.snoozed": timerEvent(["occurrence_id"]),
    "timer.occurrence.dispatched": timerEvent(["occurrence_id"]),
    "timer.occurrence.skipped": timerEvent(["occurrence_id", "reason"]),
    "timer.occurrence.failed": timerEvent(["occurrence_id", "error_code"]),
    "timer.occurrence.cancelled": timerEvent(["occurrence_id", "reason"]),
    "timer.catch_up.batch_created": timerEvent(["catch_up_batch_id"]),
    "timer.catch_up.occurrence_summarized": timerEvent([
      "catch_up_batch_id",
      "occurrence_id",
    ]),
  }),
  meta_cognition: Object.freeze({
    "meta.job.created": metaEvent(["meta_job_id"]),
    "meta.job.started": metaEvent(["meta_job_id"]),
    "meta.job.retry_wait": metaEvent(["meta_job_id", "reason"]),
    "meta.experience.created": metaEvent(["experience_id"]),
    "meta.memory.write_requested": metaEvent(["meta_job_id", "memory_request_id"], memoryConsumer),
    "meta.knowthat.write_requested": metaEvent(["meta_job_id", "knowthat_request_id"], knowthatConsumer),
    "meta.candidate.review_requested": metaEvent(["candidate_id"]),
    "meta.candidate.reviewed": metaEvent(["candidate_id", "decision"]),
    "meta.skill.candidate_application_requested": metaEvent([
      "candidate_application_id",
    ]),
    "meta.feedback.required": metaEvent(["feedback_request_id"]),
    "meta.result.updated": metaEvent(["meta_job_id"]),
    "meta.result.finalized": metaEvent(["meta_job_id", "outcome"]),
    "meta.job.completed": metaEvent(["meta_job_id"]),
    "meta.job.failed": metaEvent(["meta_job_id", "error_code"]),
  }),
  skill_registry: Object.freeze({
    "skill.version.published": skillEvent(["skill_version_id"]),
    "skill.catalog.changed": skillEvent(["catalog_version"]),
    "skill.version.activated": skillEvent(["skill_version_id"]),
    "skill.activation.rolled_back": skillEvent(["skill_version_id", "reason"]),
    "skill.version.deprecated": skillEvent(["skill_version_id", "reason"]),
    "skill.version.revoked": skillEvent(["skill_version_id", "reason"]),
    "skill.permission.granted": skillEvent(["skill_id", "principal_id"]),
    "skill.permission.revoked": skillEvent(["skill_id", "principal_id"]),
    "skill.security_revocation_epoch.changed": skillEvent(["revocation_epoch"]),
    "skill.candidate.application.updated": skillEvent([
      "candidate_application_id",
    ]),
  }),
  knowthat: Object.freeze({
    "knowthat.fact.created": knowthatEvent(["fact_id"]),
    "knowthat.fact.updated": knowthatEvent(["fact_id"]),
    "knowthat.candidate.promoted": knowthatEvent(["candidate_id", "fact_id"]),
    "knowthat.candidate.rejected": knowthatEvent(["candidate_id", "reason"]),
    "knowthat.fact.expired": knowthatEvent(["fact_id"]),
    "knowthat.conflict.detected": knowthatEvent(["conflict_id"]),
    "knowthat.linkage_check.requested": knowthatEvent(["linkage_check_id"]),
  }),
  memory: Object.freeze({
    "memory.point.created": memoryEvent(["memory_point_id"]),
    "memory.point.updated": memoryEvent(["memory_point_id"]),
    "memory.series.created": memoryEvent(["series_id"]),
    "memory.series.updated": memoryEvent(["series_id"]),
    "memory.conflict.detected": memoryEvent(["conflict_id"]),
    "memory.conflict.updated": memoryEvent(["conflict_id"]),
    "memory.integration.finished": memoryEvent(["integration_job_id", "outcome"]),
  }),
} as const satisfies OwnerDurableEventContractMapV1);

const nonEmptyPayloadString = Type.String({ minLength: 1, maxLength: 512 });

function payloadSchema(requiredPayloadKeys: readonly string[]): TSchema {
  return Type.Object(
    Object.fromEntries(
      requiredPayloadKeys.map((key) => [key, nonEmptyPayloadString]),
    ),
    { additionalProperties: false },
  );
}

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
        payload: payloadSchema(contract.required_payload_keys),
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
  if (owner === "observation_gateway") return false;
  return (OWNER_DURABLE_EVENT_TYPES_V1[owner] as readonly string[]).includes(
    eventType,
  );
}

export function ownerDurableEventContractV1(
  owner: ServiceIdV1,
  eventType: string,
): OwnerDurableEventContractV1 | undefined {
  if (owner === "observation_gateway") return undefined;
  return (
    OWNER_DURABLE_EVENT_CONTRACTS_V1[owner] as Readonly<
      Record<string, OwnerDurableEventContractV1>
    >
  )[eventType];
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
    const payload = value.payload;
    const allowedKeys = new Set(contract.required_payload_keys);
    for (const key of contract.required_payload_keys) {
      const payloadValue = payload[key];
      if (typeof payloadValue !== "string" || payloadValue.length === 0) {
        issues.push(`/payload/${key}: required non-empty string`);
      }
    }
    for (const key of Object.keys(payload)) {
      if (!allowedKeys.has(key)) {
        issues.push(`/payload/${key}: undeclared owner event payload field`);
      }
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
    consumer !== "observation_gateway" &&
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
    service === "observation_gateway" ||
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
