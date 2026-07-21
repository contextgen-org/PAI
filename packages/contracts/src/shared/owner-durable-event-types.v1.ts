import type { ServiceIdV1 } from "./service-id.v1.js";

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

export function isOwnerDurableEventTypeV1(
  owner: ServiceIdV1,
  eventType: string,
): boolean {
  if (owner === "observation_gateway") return false;
  return (OWNER_DURABLE_EVENT_TYPES_V1[owner] as readonly string[]).includes(
    eventType,
  );
}
