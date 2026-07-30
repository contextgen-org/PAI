import { createHash } from "node:crypto";

import { Value } from "@sinclair/typebox/value";
import {
  TimerCatchUpBatchV1Schema,
  type TimerCatchUpBatchV1 as TimerOwnerCatchUpBatchV1,
} from "@pai/contracts/timer/catch-up-batch.v1";
import {
  TimerDispatchRequestV1Schema,
  TimerDispatchResponseV1Schema,
  assertTimerDispatchRequestBindingsV1,
  assertTimerDispatchResponseBindingsV1,
  type TimerDispatchRequestV1 as TimerOwnerDispatchRequestV1,
  type TimerDispatchResponseV1 as TimerOwnerDispatchResponseV1,
} from "@pai/contracts/timer/dispatch-request.v1";
import {
  TimerOccurrenceClaimV1Schema,
  TimerOccurrenceV1Schema,
  TimerScheduleV1Schema,
  assertTimerOccurrenceBindingsV1,
  assertTimerScheduleBindingsV1,
  type TimerOccurrenceV1 as TimerOwnerOccurrenceV1,
  type TimerOccurrenceClaimV1 as TimerOwnerOccurrenceClaimV1,
  type TimerScheduleV1 as TimerOwnerScheduleV1,
} from "@pai/contracts/timer/occurrence.v1";
import {
  TimerScheduleCommandResponseV1Schema,
  TimerScheduleCommandV1Schema,
  assertTimerScheduleCommandBindingsV1,
  assertTimerScheduleCommandResponseBindingsV1,
  type TimerScheduleCommandResponseV1 as TimerOwnerCommandResponseV1,
  type TimerScheduleCommandV1 as TimerOwnerCommandV1,
} from "@pai/contracts/timer/schedule-command.v1";
import {
  TimerScheduleQueryResponseV1Schema,
  TimerScheduleQueryV1Schema,
  assertTimerQueryIdentityV1,
  assertTimerScheduleCursorScopeV1,
  assertTimerScheduleQueryResponseBindingsV1,
  timerScheduleCursorV1,
  type TimerScheduleQueryResponseV1 as TimerOwnerQueryResponseV1,
  type TimerScheduleQueryV1 as TimerOwnerQueryV1,
} from "@pai/contracts/timer/schedule-query-response.v1";
import type { TimerIdentityV1 } from "@pai/contracts/timer/primitives.v1";
import {
  TimerCatchUpAdvanceRequestV1Schema,
  TimerCatchUpAdvanceResponseV1Schema,
  TimerCatchUpCreateRequestV1Schema,
  TimerOccurrenceClaimRequestV1Schema,
  TimerScanDueRequestV1Schema,
  assertTimerCatchUpAdvanceRequestBindingsV1,
  type TimerCatchUpAdvanceRequestV1 as TimerHttpCatchUpAdvanceRequestV1,
  type TimerCatchUpAdvanceResponseV1 as TimerOwnerCatchUpAdvanceResponseV1,
  type TimerCatchUpCreateRequestV1 as TimerHttpCatchUpCreateRequestV1,
  type TimerOccurrenceClaimRequestV1 as TimerHttpOccurrenceClaimRequestV1,
  type TimerScanDueRequestV1 as TimerHttpScanDueRequestV1,
} from "@pai/contracts/timer/http-routes.v1";

import {
  TimerApplicationErrorV1,
  canonicalJsonV1,
  type TimerCommandResponseV1,
  type TimerCommandV1,
  type TimerClaimV1,
  type TimerCatchUpAdvanceResponseV1,
  type TimerCatchUpAdvanceRequestV1,
  type TimerCatchUpBatchV1,
  type TimerCatchUpCreateRequestV1,
  type TimerClaimRequestV1,
  type TimerScanRequestV1,
  type TimerDispatchRequestV1,
  type TimerOccurrenceV1,
  type TimerPrincipalV1,
  type TimerQueryResponseV1,
  type TimerQueryV1,
  type TimerScheduleV1,
  type TimerScopeV1,
} from "./timer-application.v1.js";

function hash(value: unknown): string {
  return `sha256:${createHash("sha256")
    .update(canonicalJsonV1(value), "utf8")
    .digest("hex")}`;
}

function sameOwnerIdentityV1(
  value: TimerIdentityV1,
  expected: TimerIdentityV1,
): boolean {
  return (
    value.workspace_id === expected.workspace_id &&
    value.bot_id === expected.bot_id &&
    value.owner_agent_id === expected.owner_agent_id &&
    value.deployment_environment === expected.deployment_environment &&
    value.release_channel === expected.release_channel
  );
}

function commandRequestId(command: TimerOwnerCommandV1): string {
  return `timer_command_${createHash("sha256")
    .update(
      [
        command.workspace_id,
        command.bot_id,
        command.owner_agent_id,
        command.deployment_environment,
        command.release_channel,
        command.runtime_run_id,
        command.method,
        command.client_request_id,
      ].join("\u001f"),
      "utf8",
    )
    .digest("base64url")
    .slice(0, 32)}`;
}

export function timerOwnerIdentityFromPrincipalV1(
  principal: TimerPrincipalV1,
): TimerIdentityV1 {
  return Object.freeze({ ...principal.scope });
}

function assertStructure<T>(
  schema: Parameters<typeof Value.Check>[0],
  value: unknown,
  label: string,
): asserts value is T {
  canonicalJsonV1(value);
  if (!Value.Check(schema, value)) {
    throw new TimerApplicationErrorV1(
      "invalid_request",
      `${label} does not match the Timer owner contract`,
    );
  }
}

function canonicalProjectionSnapshotV1<T>(
  value: T,
  label: string,
): T {
  try {
    canonicalJsonV1(value);
    return structuredClone(value);
  } catch {
    throw new Error(`${label} is outside the canonical JSON boundary`);
  }
}

function assertCanonicalProjectionV1(
  value: unknown,
  label: string,
): void {
  try {
    canonicalJsonV1(value);
  } catch {
    throw new Error(`${label} is outside the canonical JSON boundary`);
  }
}

export function toTimerApplicationCommandV1(
  value: unknown,
  principal: TimerPrincipalV1,
): Readonly<{
  owner: TimerOwnerCommandV1;
  internal: TimerCommandV1;
}> {
  assertStructure<TimerOwnerCommandV1>(
    TimerScheduleCommandV1Schema,
    value,
    "schedule command",
  );
  const identity = timerOwnerIdentityFromPrincipalV1(principal);
  const identityMismatch = !sameOwnerIdentityV1(value, identity);
  try {
    assertTimerScheduleCommandBindingsV1(value, identity);
  } catch {
    throw new TimerApplicationErrorV1(
      identityMismatch ? "forbidden" : "invalid_request",
      identityMismatch
        ? "Timer command identity does not match the principal"
        : "Timer command semantic bindings are invalid",
    );
  }
  const common = {
    schema_version: value.schema_version,
    method: value.method,
    runtime_run_id: value.runtime_run_id,
    trigger_process_id: value.trigger_process_id,
    client_request_id: value.client_request_id,
    trace_id: value.trace_id,
    scope: Object.freeze({ ...identity }),
  } as const;
  if (value.command === "create") {
    return Object.freeze({
      owner: value,
      internal: Object.freeze({
        ...common,
        kind: value.schedule.schedule_type,
        name: value.schedule.name,
        message: value.schedule.message,
        timezone: value.schedule.timezone,
        ...("fire_at" in value.schedule
          ? { fire_at: value.schedule.fire_at }
          : { rrule: value.schedule.rrule }),
        ...(value.schedule.end_time === undefined
          ? {}
          : { end_time: value.schedule.end_time }),
        catch_up: value.schedule.catch_up,
        ...(value.schedule.payload === undefined
          ? {}
          : { payload: value.schedule.payload.value }),
        ...(value.schedule.priority_hint === undefined
          ? {}
          : { priority_hint: value.schedule.priority_hint }),
        ...(value.schedule.intent_hint === undefined
          ? {}
          : { intent_hint: value.schedule.intent_hint }),
      }),
    });
  }
  if (value.command === "update") {
    return Object.freeze({
      owner: value,
      internal: Object.freeze({
        ...common,
        schedule_id: value.schedule_id,
        expected_schedule_version: value.expected_schedule_version,
        ...(value.patch.name === undefined ? {} : { name: value.patch.name }),
        ...(value.patch.message === undefined
          ? {}
          : { message: value.patch.message }),
        ...(value.patch.fire_at === undefined
          ? {}
          : { fire_at: value.patch.fire_at }),
        ...(value.patch.rrule === undefined ? {} : { rrule: value.patch.rrule }),
        ...(value.patch.timezone === undefined
          ? {}
          : { timezone: value.patch.timezone }),
        ...(value.patch.end_time === undefined
          ? {}
          : { end_time: value.patch.end_time }),
        ...(value.patch.catch_up === undefined
          ? {}
          : { catch_up: value.patch.catch_up }),
        ...(value.patch.payload === undefined
          ? {}
          : { payload: value.patch.payload.value }),
        ...(value.patch.priority_hint === undefined
          ? {}
          : { priority_hint: value.patch.priority_hint }),
        ...(value.patch.intent_hint === undefined
          ? {}
          : { intent_hint: value.patch.intent_hint }),
      }),
    });
  }
  if (value.command === "snooze") {
    return Object.freeze({
      owner: value,
      internal: Object.freeze({
        ...common,
        schedule_id: value.schedule_id,
        occurrence_id: value.occurrence_id,
        expected_schedule_version: value.expected_schedule_version,
        expected_occurrence_version: value.expected_occurrence_version,
        snooze_until: value.effective_fire_at,
        reason: value.reason,
      }),
    });
  }
  return Object.freeze({
    owner: value,
    internal: Object.freeze({
      ...common,
      schedule_id: value.schedule_id,
      expected_schedule_version: value.expected_schedule_version,
      reason: value.reason,
    }),
  });
}

export function toTimerOwnerCommandResponseV1(
  command: TimerOwnerCommandV1,
  result: TimerCommandResponseV1,
): TimerOwnerCommandResponseV1 {
  command = canonicalProjectionSnapshotV1(
    command,
    "Timer owner command",
  );
  result = canonicalProjectionSnapshotV1(
    result,
    "Timer application command response",
  );
  const common = {
    schema_version: "timer.schedule_command.v1" as const,
    timer_command_request_id: commandRequestId(command),
    schedule_id: result.schedule.id,
    schedule_version: result.schedule.schedule_version,
    duplicate_replayed: result.duplicate_replayed,
  };
  let response: TimerOwnerCommandResponseV1;
  if (command.command === "create") {
    response = {
      ...common,
      method: command.method,
      command: "create",
      ...(result.occurrence === null
        ? {}
        : { occurrence_id: result.occurrence.id }),
      schedule_status: "active",
      ...(result.schedule.next_fire_at === null
        ? {}
        : { next_fire_at: result.schedule.next_fire_at }),
      timezone: result.schedule.timezone,
    };
  } else if (command.command === "update") {
    response = {
      ...common,
      method: "timer.update",
      command: "update",
      schedule_status: result.schedule.status as "active" | "paused",
      ...(result.schedule.next_fire_at === null
        ? {}
        : { next_fire_at: result.schedule.next_fire_at }),
      timezone: result.schedule.timezone,
    };
  } else if (command.command === "snooze") {
    if (result.occurrence === null) {
      throw new Error("Timer snooze committed without an occurrence");
    }
    response = {
      ...common,
      method: "timer.snooze",
      command: "snooze",
      occurrence_id: result.occurrence.id,
      occurrence_version: result.occurrence.occurrence_version,
      occurrence_status: "pending",
      effective_fire_at: result.occurrence.effective_fire_at,
    };
  } else if (command.command === "pause") {
    response = {
      ...common,
      method: "timer.pause",
      command: "pause",
      schedule_status: "paused",
    };
  } else if (command.command === "resume") {
    response = {
      ...common,
      method: "timer.resume",
      command: "resume",
      schedule_status: "active",
    };
  } else {
    response = {
      ...common,
      method: "timer.cancel",
      command: "cancel",
      schedule_status: "cancelled",
    };
  }
  assertCanonicalProjectionV1(response, "Timer command response");
  if (!Value.Check(TimerScheduleCommandResponseV1Schema, response)) {
    throw new Error("Timer application returned a non-canonical command response");
  }
  assertTimerScheduleCommandResponseBindingsV1(response);
  return response;
}

function ownerSchedule(schedule: TimerScheduleV1): TimerOwnerScheduleV1 {
  schedule = canonicalProjectionSnapshotV1(
    schedule,
    "Timer schedule projection",
  );
  const result: TimerOwnerScheduleV1 = {
    schema_version: "timer.schedule.v1",
    ...schedule.scope,
    schedule_id: schedule.id,
    name: schedule.name,
    message: schedule.message,
    status: schedule.status,
    schedule_type: schedule.kind,
    fire_at: schedule.fire_at,
    rrule: schedule.rrule,
    timezone: schedule.timezone,
    end_time: schedule.end_time,
    payload: schedule.payload,
    catch_up: schedule.catch_up,
    max_catch_up_window_seconds: schedule.max_catch_up_window_seconds,
    max_catch_up_occurrences: schedule.max_catch_up_occurrences,
    next_fire_at: schedule.next_fire_at,
    schedule_version: schedule.schedule_version,
    created_by: "action_runtime",
    created_by_runtime_run_id: schedule.created_by_runtime_run_id,
    created_by_trigger_process_id: schedule.created_by_trigger_process_id,
    client_request_id: schedule.client_request_id,
    created_at: schedule.created_at,
    updated_at: schedule.updated_at,
  };
  assertCanonicalProjectionV1(result, "Timer schedule owner response");
  if (!Value.Check(TimerScheduleV1Schema, result)) {
    throw new Error("Timer schedule projection violates its owner contract");
  }
  assertTimerScheduleBindingsV1(result);
  return result;
}

function dispatchPayload(occurrence: TimerOccurrenceV1) {
  const common = {
    ...occurrence.scope,
    schedule_id: occurrence.schedule_id,
    schedule_version: occurrence.schedule_version,
    occurrence_id: occurrence.id,
    local_date: occurrence.local_date,
    local_time: occurrence.local_time,
    timezone: occurrence.timezone,
    scheduled_for: occurrence.scheduled_fire_at,
    occurrence_key: occurrence.occurrence_key,
    message: occurrence.message,
    ...(Object.keys(occurrence.payload).length === 0
      ? {}
      : {
          trigger_payload: {
            schema_version: "timer.trigger_payload.v1" as const,
            value: occurrence.payload,
          },
        }),
  };
  if (occurrence.is_catch_up) {
    if (
      occurrence.catch_up_batch_id === null ||
      occurrence.missed_window_summary === null
    ) {
      throw new Error("Timer catch-up occurrence lost its durable batch facts");
    }
    return {
      ...common,
      is_catch_up: true as const,
      catch_up_batch_id: occurrence.catch_up_batch_id,
      missed_window_summary: occurrence.missed_window_summary,
    };
  }
  return {
    ...common,
    is_catch_up: false as const,
    catch_up_batch_id: null,
    missed_window_summary: null,
  };
}

export function toTimerOwnerOccurrenceV1(
  occurrence: TimerOccurrenceV1,
): TimerOwnerOccurrenceV1 {
  occurrence = canonicalProjectionSnapshotV1(
    occurrence,
    "Timer occurrence projection",
  );
  const payload = dispatchPayload(occurrence);
  const result: TimerOwnerOccurrenceV1 = {
    schema_version: "timer.occurrence.v1",
    ...occurrence.scope,
    occurrence_id: occurrence.id,
    schedule_id: occurrence.schedule_id,
    occurrence_key: occurrence.occurrence_key,
    occurrence_version: occurrence.occurrence_version,
    scheduled_fire_at: occurrence.scheduled_fire_at,
    effective_fire_at: occurrence.effective_fire_at,
    local_date: occurrence.local_date,
    local_time: occurrence.local_time,
    timezone: occurrence.timezone,
    schedule_end_time: occurrence.schedule_end_time,
    schedule_version: occurrence.schedule_version,
    dispatch_payload: payload,
    dispatch_payload_hash: hash(payload),
    payload_schema_version: "timer.trigger_payload.v1",
    status: occurrence.status,
    trigger_id: occurrence.trigger_id,
    trigger_process_id: occurrence.trigger_process_id,
    dedupe_key: `timer:${occurrence.occurrence_key}`,
    error:
      occurrence.dispatch_error_class === null
        ? null
        : {
            classification: occurrence.dispatch_error_class,
            ...(occurrence.dispatch_commit_outcome_unknown
              ? { commit_outcome_unknown: true }
              : {}),
          },
    attempt_count: occurrence.attempt_count,
    next_dispatch_at: occurrence.next_retry_at,
    catch_up_batch_id: occurrence.catch_up_batch_id,
    is_catch_up: occurrence.is_catch_up,
    dispatch_generation: occurrence.dispatch_generation,
    claim_token: occurrence.claim_token,
    locked_by: occurrence.locked_by,
    locked_until: occurrence.locked_until,
    created_at: occurrence.created_at,
    updated_at: occurrence.updated_at,
  };
  assertCanonicalProjectionV1(result, "Timer occurrence owner response");
  if (!Value.Check(TimerOccurrenceV1Schema, result)) {
    throw new Error("Timer occurrence projection violates its owner contract");
  }
  assertTimerOccurrenceBindingsV1(result);
  return result;
}

export function toTimerOwnerOccurrenceClaimV1(
  claim: TimerClaimV1,
): TimerOwnerOccurrenceClaimV1 {
  claim = canonicalProjectionSnapshotV1(
    claim,
    "Timer occurrence claim projection",
  );
  const occurrence = toTimerOwnerOccurrenceV1(claim.occurrence);
  if (
    occurrence.claim_token === null ||
    occurrence.locked_by === null ||
    occurrence.locked_until === null
  ) {
    throw new Error("Timer claim committed without a complete lease fence");
  }
  const result: TimerOwnerOccurrenceClaimV1 = {
    schema_version: "timer.occurrence_claim.v1",
    ...claim.occurrence.scope,
    occurrence_id: claim.occurrence.id,
    occurrence_version: claim.occurrence_version,
    schedule_id: claim.occurrence.schedule_id,
    schedule_version: claim.occurrence.schedule_version,
    previous_status: claim.previous_status,
    status: "dispatching",
    dispatch_generation: claim.dispatch_generation,
    claim_token: claim.claim_token,
    locked_by: occurrence.locked_by,
    locked_until: occurrence.locked_until,
    dispatch_payload: occurrence.dispatch_payload,
    dispatch_payload_hash: occurrence.dispatch_payload_hash,
  };
  assertCanonicalProjectionV1(result, "Timer claim owner response");
  if (!Value.Check(TimerOccurrenceClaimV1Schema, result)) {
    throw new Error("Timer claim projection violates its owner contract");
  }
  return result;
}

export function toTimerApplicationScanRequestV1(
  value: unknown,
  principal: TimerPrincipalV1,
): Readonly<{
  http: TimerHttpScanDueRequestV1;
  internal: TimerScanRequestV1;
}> {
  assertStructure<TimerHttpScanDueRequestV1>(
    TimerScanDueRequestV1Schema,
    value,
    "scan request",
  );
  return Object.freeze({
    http: value,
    internal: Object.freeze({
      scope: timerOwnerIdentityFromPrincipalV1(principal),
      worker_id: value.worker_id,
      checkpoint_id: value.checkpoint_id,
      ...(value.limit === undefined ? {} : { limit: value.limit }),
    }),
  });
}

export function toTimerApplicationOccurrenceClaimV1(
  value: unknown,
  occurrenceId: string,
  principal: TimerPrincipalV1,
): Readonly<{
  http: TimerHttpOccurrenceClaimRequestV1;
  internal: TimerClaimRequestV1;
}> {
  assertStructure<TimerHttpOccurrenceClaimRequestV1>(
    TimerOccurrenceClaimRequestV1Schema,
    value,
    "occurrence claim request",
  );
  return Object.freeze({
    http: value,
    internal: Object.freeze({
      scope: timerOwnerIdentityFromPrincipalV1(principal),
      occurrence_id: occurrenceId,
      expected_occurrence_version: value.expected_occurrence_version,
      expected_schedule_version: value.expected_schedule_version,
      expected_status: value.expected_status,
      worker_id: value.worker_id,
      ...(value.lease_seconds === undefined
        ? {}
        : { lease_seconds: value.lease_seconds }),
    }),
  });
}

export function toTimerApplicationCatchUpCreateV1(
  value: unknown,
  principal: TimerPrincipalV1,
): Readonly<{
  http: TimerHttpCatchUpCreateRequestV1;
  internal: TimerCatchUpCreateRequestV1;
}> {
  assertStructure<TimerHttpCatchUpCreateRequestV1>(
    TimerCatchUpCreateRequestV1Schema,
    value,
    "catch-up create request",
  );
  return Object.freeze({
    http: value,
    internal: Object.freeze({
      scope: timerOwnerIdentityFromPrincipalV1(principal),
      occurrence_ids: Object.freeze([...value.occurrence_ids]),
      trace_id: value.trace_id,
    }),
  });
}

export function toTimerApplicationCatchUpAdvanceV1(
  value: unknown,
  batchId: string,
  principal: TimerPrincipalV1,
): Readonly<{
  http: TimerHttpCatchUpAdvanceRequestV1;
  internal: TimerCatchUpAdvanceRequestV1;
}> {
  assertStructure<TimerHttpCatchUpAdvanceRequestV1>(
    TimerCatchUpAdvanceRequestV1Schema,
    value,
    "catch-up advance request",
  );
  try {
    assertTimerCatchUpAdvanceRequestBindingsV1(value);
  } catch {
    throw new TimerApplicationErrorV1(
      "invalid_request",
      "Timer catch-up continuation is invalid",
    );
  }
  return Object.freeze({
    http: value,
    internal: Object.freeze({
      scope: timerOwnerIdentityFromPrincipalV1(principal),
      batch_id: batchId,
      expected_status: value.expected_status,
      expected_cursor_occurrence_id:
        value.expected_cursor_occurrence_id,
      expected_last_occurrence_id: value.expected_last_occurrence_id,
      expected_last_trigger_process_id:
        value.expected_last_trigger_process_id,
      trace_id: value.trace_id,
    }),
  });
}

function scopeFingerprint(scope: TimerScopeV1): string {
  return hash(scope);
}

function decodeCursor(
  cursor: string,
  expectedScopeFingerprint: string,
): string {
  assertTimerScheduleCursorScopeV1(
    cursor,
    expectedScopeFingerprint as `sha256:${string}`,
  );
  const prefix = `v1:${expectedScopeFingerprint}:`;
  try {
    const decoded = Buffer.from(cursor.slice(prefix.length), "base64url").toString(
      "utf8",
    );
    if (decoded.length < 1) throw new Error("empty cursor");
    return decoded;
  } catch {
    throw new TimerApplicationErrorV1(
      "invalid_request",
      "Timer cursor is invalid",
    );
  }
}

export function toTimerApplicationQueryV1(
  value: unknown,
  principal: TimerPrincipalV1,
): Readonly<{ owner: TimerOwnerQueryV1; internal: TimerQueryV1 }> {
  assertStructure<TimerOwnerQueryV1>(
    TimerScheduleQueryV1Schema,
    value,
    "schedule query",
  );
  const identity = timerOwnerIdentityFromPrincipalV1(principal);
  try {
    assertTimerQueryIdentityV1(value, identity);
  } catch {
    throw new TimerApplicationErrorV1(
      "forbidden",
      "Timer query identity does not match the principal",
    );
  }
  const fingerprint = scopeFingerprint(identity);
  return Object.freeze({
    owner: value,
    internal: Object.freeze({
      method: value.method,
      runtime_run_id: value.runtime_run_id,
      trace_id: value.trace_id,
      scope: identity,
      ...("schedule_id" in value ? { schedule_id: value.schedule_id } : {}),
      ...("status" in value && value.status !== undefined
        ? { status: value.status }
        : {}),
      ...("limit" in value && value.limit !== undefined
        ? { limit: value.limit }
        : {}),
      ...("cursor" in value && value.cursor !== undefined
        ? { cursor: decodeCursor(value.cursor, fingerprint) }
        : {}),
    }),
  });
}

export function toTimerOwnerQueryResponseV1(
  query: TimerOwnerQueryV1,
  result: TimerQueryResponseV1,
): TimerOwnerQueryResponseV1 {
  query = canonicalProjectionSnapshotV1(
    query,
    "Timer owner query",
  );
  result = canonicalProjectionSnapshotV1(
    result,
    "Timer application query response",
  );
  const identity: TimerIdentityV1 = {
    workspace_id: query.workspace_id,
    bot_id: query.bot_id,
    owner_agent_id: query.owner_agent_id,
    deployment_environment: query.deployment_environment,
    release_channel: query.release_channel,
  };
  const schedules =
    result.code === "timer_schedules_found"
      ? result.schedules.map(ownerSchedule)
      : [ownerSchedule(result.schedule)];
  const response: TimerOwnerQueryResponseV1 = {
    schema_version: "timer.schedule_query_response.v1",
    identity,
    schedules,
    ...(result.code === "timer_history_found"
      ? { occurrences: result.occurrences.map(toTimerOwnerOccurrenceV1) }
      : {}),
    ...((result.code === "timer_schedules_found" ||
      result.code === "timer_history_found") &&
    result.next_cursor !== null
      ? {
          next_cursor: timerScheduleCursorV1(
            scopeFingerprint(identity) as `sha256:${string}`,
            Buffer.from(result.next_cursor, "utf8").toString("base64url"),
          ),
        }
      : {}),
    returned: schedules.length,
  };
  assertCanonicalProjectionV1(response, "Timer query owner response");
  if (!Value.Check(TimerScheduleQueryResponseV1Schema, response)) {
    throw new Error("Timer query returned a non-canonical owner response");
  }
  assertTimerScheduleQueryResponseBindingsV1(response, identity);
  return response;
}

export function toTimerApplicationDispatchV1(
  value: unknown,
  principal: TimerPrincipalV1,
  now = new Date(),
): Readonly<{
  owner: TimerOwnerDispatchRequestV1;
  internal: TimerDispatchRequestV1;
}> {
  assertStructure<TimerOwnerDispatchRequestV1>(
    TimerDispatchRequestV1Schema,
    value,
    "dispatch request",
  );
  const identity = timerOwnerIdentityFromPrincipalV1(principal);
  try {
    assertTimerDispatchRequestBindingsV1(value, identity, now);
  } catch {
    throw new TimerApplicationErrorV1(
      "forbidden",
      "Timer dispatch request is not bound to the claimed owner scope",
    );
  }
  return Object.freeze({
    owner: value,
    internal: Object.freeze({
      scope: identity,
      occurrence_id: value.occurrence_id,
      expected_occurrence_version: value.occurrence_version,
      dispatch_generation: value.dispatch_generation,
      claim_token: value.claim_token,
      trace_id: value.trace_id,
      owner_request: value,
    }),
  });
}

export function toTimerOwnerDispatchResponseV1(
  request: TimerOwnerDispatchRequestV1,
  occurrence: TimerOccurrenceV1,
): TimerOwnerDispatchResponseV1 {
  request = canonicalProjectionSnapshotV1(
    request,
    "Timer owner dispatch request",
  );
  occurrence = canonicalProjectionSnapshotV1(
    occurrence,
    "Timer dispatch projection",
  );
  const common = {
    schema_version: "timer.dispatch_request.v1" as const,
    occurrence_id: occurrence.id,
    occurrence_version: occurrence.occurrence_version,
    dispatch_attempt_id: `dispatch_${occurrence.id}_${request.dispatch_generation}`,
  };
  let response: TimerOwnerDispatchResponseV1;
  if (occurrence.status === "dispatched") {
    if (occurrence.trigger_process_id === null) {
      throw new Error("Timer dispatched occurrence lost trigger_process_id");
    }
    response = {
      ...common,
      trigger_process_id: occurrence.trigger_process_id,
      status: "dispatched",
      duplicate_replayed:
        occurrence.dispatch_error_class === "idempotency_replayed",
    };
  } else if (occurrence.status === "retry_wait") {
    response = {
      ...common,
      status: "retry_wait",
      duplicate_replayed: false,
    };
  } else {
    response = {
      ...common,
      status: "failed",
      duplicate_replayed: false,
    };
  }
  assertCanonicalProjectionV1(response, "Timer dispatch owner response");
  if (!Value.Check(TimerDispatchResponseV1Schema, response)) {
    throw new Error("Timer dispatch returned a non-canonical owner response");
  }
  assertTimerDispatchResponseBindingsV1(request, response);
  return response;
}

export function toTimerOwnerCatchUpBatchV1(
  batch: TimerCatchUpBatchV1,
): TimerOwnerCatchUpBatchV1 {
  batch = canonicalProjectionSnapshotV1(
    batch,
    "Timer catch-up batch projection",
  );
  const common = {
    schema_version: "timer.catch_up_batch.v1" as const,
    catch_up_batch_id: batch.id,
    ...batch.scope,
    cursor_occurrence_id: batch.cursor_occurrence_id,
    last_occurrence_id: batch.last_occurrence_id,
    last_trigger_process_id: batch.last_trigger_process_id,
    timeout_seconds: batch.timeout_seconds,
    deadline_at: batch.deadline_at,
    started_at: batch.started_at,
    created_at: batch.created_at,
    updated_at: batch.updated_at,
    policy_snapshot: batch.policy_snapshot,
  };
  let result: TimerOwnerCatchUpBatchV1;
  if (batch.status === "running") {
    result = {
      ...common,
      status: "running",
      completed_at: null,
      reason_code: null,
    };
  } else if (batch.status === "completed") {
    if (
      batch.completed_at === null ||
      batch.reason !== "all_occurrences_dispatched" &&
      batch.reason !== "no_dispatchable_occurrences"
    ) {
      throw new Error("Timer completed catch-up batch has no canonical reason");
    }
    result = {
      ...common,
      status: "completed",
      completed_at: batch.completed_at,
      reason_code: batch.reason,
    };
  } else if (batch.status === "timed_out") {
    if (
      batch.completed_at === null ||
      batch.reason !== "catch_up_timeout"
    ) {
      throw new Error("Timer timed-out catch-up batch is incomplete");
    }
    result = {
      ...common,
      status: "timed_out",
      completed_at: batch.completed_at,
      reason_code: "catch_up_timeout",
    };
  } else {
    if (batch.completed_at === null || batch.reason === null) {
      throw new Error("Timer cancelled catch-up batch is incomplete");
    }
    result = {
      ...common,
      status: "cancelled",
      completed_at: batch.completed_at,
      reason_code: batch.reason,
    };
  }
  assertCanonicalProjectionV1(result, "Timer catch-up owner response");
  if (!Value.Check(TimerCatchUpBatchV1Schema, result)) {
    throw new Error("Timer catch-up batch projection violates its owner contract");
  }
  return result;
}

export function toTimerOwnerCatchUpAdvanceResponseV1(
  result: TimerCatchUpAdvanceResponseV1,
): TimerOwnerCatchUpAdvanceResponseV1 {
  result = canonicalProjectionSnapshotV1(
    result,
    "Timer catch-up advance projection",
  );
  const response: TimerOwnerCatchUpAdvanceResponseV1 = {
    schema_version: "timer.catch_up_advance_response.v1",
    batch: toTimerOwnerCatchUpBatchV1(result.batch),
    outcome: result.outcome,
    occurrence:
      result.occurrence === null
        ? null
        : toTimerOwnerOccurrenceV1(result.occurrence),
  };
  assertCanonicalProjectionV1(
    response,
    "Timer catch-up advance owner response",
  );
  if (!Value.Check(TimerCatchUpAdvanceResponseV1Schema, response)) {
    throw new Error(
      "Timer catch-up advance response violates its HTTP contract",
    );
  }
  return response;
}
