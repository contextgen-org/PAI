import { createHash } from "node:crypto";

import type { VerifiedOwnerPostgresCompositionV1 } from "@pai/persistence";

import type { TIMER_REPOSITORY_CONTRACT_V1 } from "./permission-manifest.v1.js";
import {
  type PostgresTimerStateRepositoryPortV1,
  type TimerDispatchAttemptV1,
  type TimerStateV1,
} from "../timer-application.v1.js";
import { toTimerOwnerOccurrenceV1 } from "../timer-owner-contract-adapter.v1.js";

type TimerPostgresCompositionV1 = VerifiedOwnerPostgresCompositionV1<
  typeof TIMER_REPOSITORY_CONTRACT_V1
>;
type TimerScheduleStateV1 = TimerStateV1["schedules"] extends Map<
  string,
  infer TValue
>
  ? TValue
  : never;
type TimerOccurrenceStateV1 = TimerStateV1["occurrences"] extends Map<
  string,
  infer TValue
>
  ? TValue
  : never;
type TimerBatchStateV1 = TimerStateV1["batches"] extends Map<
  string,
  infer TValue
>
  ? TValue
  : never;
type TimerStoredCommandV1 = TimerStateV1["commandRequests"] extends Map<
  string,
  infer TValue
>
  ? TValue
  : never;

interface JsonRowV1 {
  readonly row: Readonly<Record<string, unknown>>;
  readonly [key: string]: unknown;
}

const EMPTY_EFFECTS_V1 = Object.freeze({
  timer_audit_logs: Object.freeze([]),
  timer_event_outbox: Object.freeze([]),
});

function canonicalJsonV1(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJsonV1).join(",")}]`;
  }
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${canonicalJsonV1(
          (value as Record<string, unknown>)[key],
        )}`,
    )
    .join(",")}}`;
}

function digestV1(value: unknown): string {
  return createHash("sha256").update(canonicalJsonV1(value), "utf8").digest("hex");
}

function sha256V1(value: unknown): string {
  return `sha256:${digestV1(value)}`;
}

function isoV1(value: unknown, label: string): string {
  const parsed =
    value instanceof Date
      ? value
      : typeof value === "string" || typeof value === "number"
        ? new Date(value)
        : null;
  if (parsed === null || !Number.isFinite(parsed.getTime())) {
    throw new Error(`Timer PostgreSQL ${label} is invalid`);
  }
  return parsed.toISOString();
}

function textV1(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Timer PostgreSQL ${label} is invalid`);
  }
  return value;
}

function nullableTextV1(value: unknown, label: string): string | null {
  if (value === null) return null;
  return textV1(value, label);
}

function numberV1(value: unknown, label: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`Timer PostgreSQL ${label} is invalid`);
  }
  return parsed;
}

function recordV1(value: unknown, label: string): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Timer PostgreSQL ${label} is invalid`);
  }
  return value as Readonly<Record<string, unknown>>;
}

function scopeKeyV1(scope: Readonly<{
  workspace_id: string;
  bot_id: string;
  owner_agent_id: string;
  deployment_environment: string;
  release_channel: string;
}>): string {
  return [
    scope.workspace_id,
    scope.bot_id,
    scope.owner_agent_id,
    scope.deployment_environment,
    scope.release_channel,
  ].join("\u001f");
}

function scopeFromRowV1(row: Readonly<Record<string, unknown>>) {
  const deploymentEnvironment = textV1(
    row.deployment_environment,
    "deployment_environment",
  );
  const releaseChannel = textV1(row.release_channel, "release_channel");
  if (!['local', 'dev', 'staging', 'prod'].includes(deploymentEnvironment)) {
    throw new Error("Timer PostgreSQL deployment_environment drifted");
  }
  if (!['stable', 'canary'].includes(releaseChannel)) {
    throw new Error("Timer PostgreSQL release_channel drifted");
  }
  return Object.freeze({
    workspace_id: textV1(row.workspace_id, "workspace_id"),
    bot_id: textV1(row.bot_id, "bot_id"),
    owner_agent_id: textV1(row.owner_agent_id, "owner_agent_id"),
    deployment_environment: deploymentEnvironment,
    release_channel: releaseChannel,
  }) as TimerScheduleStateV1["scope"];
}

function scheduleFromRowV1(
  row: Readonly<Record<string, unknown>>,
): TimerScheduleStateV1 {
  return {
    id: textV1(row.id, "schedule.id"),
    scope: scopeFromRowV1(row),
    name: textV1(row.name, "schedule.name"),
    status: textV1(row.status, "schedule.status") as TimerScheduleStateV1["status"],
    kind: textV1(row.schedule_type, "schedule.schedule_type") as TimerScheduleStateV1["kind"],
    timezone: textV1(row.timezone, "schedule.timezone"),
    message: textV1(row.message, "schedule.message"),
    payload: recordV1(row.payload, "schedule.payload"),
    end_time: row.end_time === null ? null : isoV1(row.end_time, "schedule.end_time"),
    catch_up: row.catch_up === true,
    max_catch_up_window_seconds: numberV1(
      row.max_catch_up_window_seconds,
      "schedule.max_catch_up_window_seconds",
    ),
    max_catch_up_occurrences: numberV1(
      row.max_catch_up_occurrences,
      "schedule.max_catch_up_occurrences",
    ),
    fire_at: row.fire_at === null ? null : isoV1(row.fire_at, "schedule.fire_at"),
    rrule: nullableTextV1(row.rrule, "schedule.rrule"),
    next_fire_at:
      row.next_fire_at === null
        ? null
        : isoV1(row.next_fire_at, "schedule.next_fire_at"),
    schedule_version: numberV1(row.schedule_version, "schedule.schedule_version"),
    created_by_runtime_run_id: textV1(
      row.created_by_runtime_run_id,
      "schedule.created_by_runtime_run_id",
    ),
    created_by_trigger_process_id: textV1(
      row.created_by_trigger_process_id,
      "schedule.created_by_trigger_process_id",
    ),
    client_request_id: textV1(row.client_request_id, "schedule.client_request_id"),
    created_at: isoV1(row.created_at, "schedule.created_at"),
    updated_at: isoV1(row.updated_at, "schedule.updated_at"),
  };
}

function occurrenceFromRowV1(
  row: Readonly<Record<string, unknown>>,
): TimerOccurrenceStateV1 {
  const dispatchPayload = recordV1(row.dispatch_payload, "occurrence.dispatch_payload");
  const triggerPayload = dispatchPayload.trigger_payload;
  const payload =
    triggerPayload === undefined
      ? Object.freeze({})
      : recordV1(
          recordV1(triggerPayload, "occurrence.trigger_payload").value,
          "occurrence.trigger_payload.value",
        );
  const error =
    row.error === null ? undefined : recordV1(row.error, "occurrence.error");
  const applicationState =
    error?.application_state === undefined
      ? undefined
      : recordV1(error.application_state, "occurrence.error.application_state");
  return {
    id: textV1(row.id, "occurrence.id"),
    scope: scopeFromRowV1(row),
    schedule_id: textV1(row.schedule_id, "occurrence.schedule_id"),
    schedule_version: numberV1(row.schedule_version, "occurrence.schedule_version"),
    local_date: textV1(row.local_date, "occurrence.local_date"),
    local_time: textV1(row.local_time, "occurrence.local_time"),
    timezone: textV1(row.timezone, "occurrence.timezone"),
    schedule_end_time:
      row.schedule_end_time === null
        ? null
        : isoV1(row.schedule_end_time, "occurrence.schedule_end_time"),
    scheduled_fire_at: isoV1(row.scheduled_fire_at, "occurrence.scheduled_fire_at"),
    effective_fire_at: isoV1(row.effective_fire_at, "occurrence.effective_fire_at"),
    occurrence_key: textV1(row.occurrence_key, "occurrence.occurrence_key"),
    status: textV1(row.status, "occurrence.status") as TimerOccurrenceStateV1["status"],
    occurrence_version: numberV1(row.occurrence_version, "occurrence.occurrence_version"),
    dispatch_generation: numberV1(row.dispatch_generation, "occurrence.dispatch_generation"),
    claim_token: nullableTextV1(row.claim_token, "occurrence.claim_token"),
    locked_by: nullableTextV1(row.locked_by, "occurrence.locked_by"),
    locked_until:
      row.locked_until === null
        ? null
        : isoV1(row.locked_until, "occurrence.locked_until"),
    attempt_count: numberV1(row.attempt_count, "occurrence.attempt_count"),
    next_retry_at:
      row.next_dispatch_at === null
        ? null
        : isoV1(row.next_dispatch_at, "occurrence.next_dispatch_at"),
    trigger_process_id: nullableTextV1(
      row.trigger_process_id,
      "occurrence.trigger_process_id",
    ),
    trigger_id: nullableTextV1(row.trigger_id, "occurrence.trigger_id"),
    dispatch_error_class:
      typeof error?.classification === "string"
        ? (error.classification as TimerOccurrenceStateV1["dispatch_error_class"])
        : null,
    dispatch_commit_outcome_unknown: error?.commit_outcome_unknown === true,
    message: textV1(dispatchPayload.message, "occurrence.dispatch_payload.message"),
    payload,
    is_catch_up: row.is_catch_up === true,
    catch_up_batch_id: nullableTextV1(
      row.catch_up_batch_id,
      "occurrence.catch_up_batch_id",
    ),
    missed_window_summary:
      dispatchPayload.missed_window_summary === null
        ? null
        : textV1(
            dispatchPayload.missed_window_summary,
            "occurrence.missed_window_summary",
          ),
    dst_shifted: applicationState?.dst_shifted === true,
    cancel_requested_at:
      row.cancel_requested_at === null
        ? null
        : isoV1(row.cancel_requested_at, "occurrence.cancel_requested_at"),
    created_at: isoV1(row.created_at, "occurrence.created_at"),
    updated_at: isoV1(row.updated_at, "occurrence.updated_at"),
  };
}

function batchFromRowV1(
  row: Readonly<Record<string, unknown>>,
  occurrenceIds: readonly string[],
): TimerBatchStateV1 {
  return {
    id: textV1(row.id, "batch.id"),
    scope: scopeFromRowV1(row),
    status: textV1(row.status, "batch.status") as TimerBatchStateV1["status"],
    occurrence_ids: [...occurrenceIds],
    cursor_occurrence_id: nullableTextV1(
      row.cursor_occurrence_id,
      "batch.cursor_occurrence_id",
    ),
    last_occurrence_id: nullableTextV1(
      row.last_occurrence_id,
      "batch.last_occurrence_id",
    ),
    last_trigger_process_id: nullableTextV1(
      row.last_trigger_process_id,
      "batch.last_trigger_process_id",
    ),
    timeout_seconds: numberV1(row.timeout_seconds, "batch.timeout_seconds"),
    deadline_at: isoV1(row.deadline_at, "batch.deadline_at"),
    policy_snapshot: recordV1(
      row.policy_snapshot,
      "batch.policy_snapshot",
    ) as TimerBatchStateV1["policy_snapshot"],
    reason: nullableTextV1(row.reason_code, "batch.reason_code"),
    started_at: isoV1(row.started_at, "batch.started_at"),
    created_at: isoV1(row.created_at, "batch.created_at"),
    updated_at: isoV1(row.updated_at, "batch.updated_at"),
    completed_at:
      row.completed_at === null
        ? null
        : isoV1(row.completed_at, "batch.completed_at"),
  };
}

function scheduleRowV1(schedule: TimerScheduleStateV1) {
  return {
    id: schedule.id,
    ...schedule.scope,
    name: schedule.name,
    message: schedule.message,
    status: schedule.status,
    schedule_type: schedule.kind,
    rrule: schedule.rrule,
    fire_at: schedule.fire_at,
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
    idempotency_key: `timer:${schedule.client_request_id}`,
    created_at: schedule.created_at,
    updated_at: schedule.updated_at,
  };
}

function occurrenceRowV1(occurrence: TimerOccurrenceStateV1) {
  const owner = toTimerOwnerOccurrenceV1(occurrence);
  const error = {
    ...(owner.error ?? {}),
    application_state: { dst_shifted: occurrence.dst_shifted },
  };
  return {
    id: owner.occurrence_id,
    schedule_id: owner.schedule_id,
    workspace_id: owner.workspace_id,
    bot_id: owner.bot_id,
    owner_agent_id: owner.owner_agent_id,
    deployment_environment: owner.deployment_environment,
    release_channel: owner.release_channel,
    occurrence_key: owner.occurrence_key,
    occurrence_version: owner.occurrence_version,
    scheduled_fire_at: owner.scheduled_fire_at,
    effective_fire_at: owner.effective_fire_at,
    local_date: owner.local_date,
    local_time: owner.local_time,
    timezone: owner.timezone,
    schedule_end_time: owner.schedule_end_time,
    schedule_version: owner.schedule_version,
    dispatch_payload: owner.dispatch_payload,
    dispatch_payload_hash: owner.dispatch_payload_hash,
    payload_schema_version: owner.payload_schema_version,
    status: owner.status,
    trigger_id: owner.trigger_id,
    trigger_process_id: owner.trigger_process_id,
    dedupe_key: owner.dedupe_key,
    error,
    attempt_count: owner.attempt_count,
    next_dispatch_at: owner.next_dispatch_at,
    catch_up_batch_id: owner.catch_up_batch_id,
    is_catch_up: owner.is_catch_up,
    locked_by: owner.locked_by,
    locked_until: owner.locked_until,
    created_at: owner.created_at,
    updated_at: owner.updated_at,
    dispatch_generation: owner.dispatch_generation,
    claim_token: owner.claim_token,
    cancel_requested_at: occurrence.cancel_requested_at,
  };
}

function batchRowV1(batch: TimerBatchStateV1) {
  return {
    id: batch.id,
    ...batch.scope,
    status: batch.status,
    cursor_occurrence_id: batch.cursor_occurrence_id,
    last_occurrence_id: batch.last_occurrence_id,
    last_trigger_process_id: batch.last_trigger_process_id,
    deadline_at: batch.deadline_at,
    timeout_seconds: batch.timeout_seconds,
    policy_snapshot: batch.policy_snapshot,
    started_at: batch.started_at,
    completed_at: batch.completed_at,
    reason_code: batch.reason,
    created_at: batch.created_at,
    updated_at: batch.updated_at,
  };
}

function changedEntriesV1<T>(before: Map<string, T>, after: Map<string, T>) {
  return [...after.entries()]
    .filter(([key, value]) => canonicalJsonV1(before.get(key)) !== canonicalJsonV1(value))
    .map(([key, value]) => ({ key, before: before.get(key), after: value }));
}

function commandRowV1(identity: string, stored: TimerStoredCommandV1) {
  const parts = identity.split("\u001f");
  if (parts.length !== 8) throw new Error("Timer command identity is invalid");
  const [
    workspaceId,
    botId,
    ownerAgentId,
    deploymentEnvironment,
    releaseChannel,
    runtimeRunId,
    method,
    clientRequestId,
  ] = parts as [string, string, string, string, string, string, string, string];
  const response = stored.response;
  return {
    id: `timer_command_${digestV1(identity).slice(0, 40)}`,
    workspace_id: workspaceId,
    bot_id: botId,
    owner_agent_id: ownerAgentId,
    deployment_environment: deploymentEnvironment,
    release_channel: releaseChannel,
    runtime_run_id: runtimeRunId,
    trigger_process_id: response.schedule.created_by_trigger_process_id,
    method,
    schedule_id: response.schedule.id,
    client_request_id: clientRequestId,
    idempotency_key: `timer:${method}:${clientRequestId}`,
    request_hash: stored.request_hash,
    status: "completed",
    request: { request_hash: stored.request_hash },
    response,
    error: null,
    created_at: response.schedule.updated_at,
    updated_at: response.schedule.updated_at,
  };
}

function scheduleEventTypeV1(
  before: TimerScheduleStateV1 | undefined,
  after: TimerScheduleStateV1,
) {
  if (before === undefined) return "timer.schedule.created";
  if (before.status !== after.status) return `timer.schedule.${after.status}`;
  return "timer.schedule.updated";
}

function occurrenceEventTypeV1(
  before: TimerOccurrenceStateV1 | undefined,
  after: TimerOccurrenceStateV1,
): string | null {
  if (before === undefined) return "timer.occurrence.due";
  if (before.effective_fire_at !== after.effective_fire_at) {
    return "timer.occurrence.snoozed";
  }
  if (before.status === after.status || after.status === "dispatching") return null;
  if (["dispatched", "skipped", "failed", "cancelled"].includes(after.status)) {
    return `timer.occurrence.${after.status}`;
  }
  return null;
}

function auditRowV1(input: Readonly<{
  idempotency: string;
  scope: TimerScheduleStateV1["scope"];
  schedule_id: string;
  occurrence_id: string | null;
  event_type: string;
  previous_state: string | null;
  next_state: string;
  created_at: string;
}>) {
  return {
    id: `timer_audit_${digestV1(input).slice(0, 40)}`,
    ...input.scope,
    schedule_id: input.schedule_id,
    occurrence_id: input.occurrence_id,
    event_type: input.event_type,
    actor: "timer_trigger_app",
    reason: null,
    source_ref: input.idempotency,
    evidence_refs: [],
    previous_state: input.previous_state,
    next_state: input.next_state,
    schema_version: "timer_audit.v1",
    payload: { idempotency_key: input.idempotency },
    created_at: input.created_at,
  };
}

async function loadStateV1(
  composition: TimerPostgresCompositionV1,
): Promise<TimerStateV1> {
  return composition.read_committed_postgres.withReadCommittedTransaction(
    async (transaction) => {
      const schedulesResult = await transaction.query<JsonRowV1>(
        "SELECT to_jsonb(schedule) AS row FROM timer.timer_schedules AS schedule",
      );
      const occurrencesResult = await transaction.query<JsonRowV1>(
        "SELECT to_jsonb(occurrence) AS row FROM timer.timer_occurrences AS occurrence",
      );
      const commandsResult = await transaction.query<JsonRowV1>(
        "SELECT to_jsonb(command_request) AS row FROM timer.timer_command_requests AS command_request WHERE status = 'completed'",
      );
      const attemptsResult = await transaction.query<JsonRowV1>(
        "SELECT to_jsonb(dispatch_attempt) AS row FROM timer.timer_dispatch_attempts AS dispatch_attempt ORDER BY created_at, id",
      );
      const batchesResult = await transaction.query<JsonRowV1>(
        "SELECT to_jsonb(batch) AS row FROM timer.timer_catch_up_batches AS batch",
      );
      const checkpointsResult = await transaction.query<JsonRowV1>(
        "SELECT to_jsonb(checkpoint) AS row FROM timer.timer_scanner_checkpoints AS checkpoint",
      );
      const schedules = new Map<string, TimerScheduleStateV1>();
      for (const entry of schedulesResult.rows) {
        const schedule = scheduleFromRowV1(entry.row);
        schedules.set(schedule.id, schedule);
      }
      const occurrences = new Map<string, TimerOccurrenceStateV1>();
      const occurrenceIdsByKey = new Map<string, string>();
      for (const entry of occurrencesResult.rows) {
        const occurrence = occurrenceFromRowV1(entry.row);
        occurrences.set(occurrence.id, occurrence);
        occurrenceIdsByKey.set(occurrence.occurrence_key, occurrence.id);
      }
      const commandRequests = new Map<string, TimerStoredCommandV1>();
      for (const entry of commandsResult.rows) {
        const row = entry.row;
        const identity = [
          row.workspace_id,
          row.bot_id,
          row.owner_agent_id,
          row.deployment_environment,
          row.release_channel,
          row.runtime_run_id,
          row.method,
          row.client_request_id,
        ].map(String).join("\u001f");
        commandRequests.set(identity, {
          request_hash: textV1(row.request_hash, "command.request_hash"),
          response: recordV1(
            row.response,
            "command.response",
          ) as unknown as TimerStoredCommandV1["response"],
        });
      }
      const dispatchAttempts: TimerDispatchAttemptV1[] = attemptsResult.rows.map(
        ({ row }) => {
          const request = recordV1(row.request, "dispatch_attempt.request");
          const attempt = recordV1(
            request.application_attempt,
            "dispatch_attempt.request.application_attempt",
          );
          return attempt as unknown as TimerDispatchAttemptV1;
        },
      );
      const batches = new Map<string, TimerBatchStateV1>();
      for (const entry of batchesResult.rows) {
        const batchId = textV1(entry.row.id, "batch.id");
        const occurrenceIds = [...occurrences.values()]
          .filter((occurrence) => occurrence.catch_up_batch_id === batchId)
          .sort(
            (left, right) =>
              Date.parse(left.scheduled_fire_at) - Date.parse(right.scheduled_fire_at) ||
              left.id.localeCompare(right.id),
          )
          .map(({ id }) => id);
        batches.set(batchId, batchFromRowV1(entry.row, occurrenceIds));
      }
      const scannerCheckpoints = new Map<string, string>();
      for (const { row } of checkpointsResult.rows) {
        scannerCheckpoints.set(
          textV1(row.scanner_name, "checkpoint.scanner_name"),
          isoV1(row.last_scanned_until, "checkpoint.last_scanned_until"),
        );
      }
      return {
        schedules,
        occurrences,
        occurrenceIdsByKey,
        commandRequests,
        dispatchAttempts,
        dlq: [],
        batches,
        scannerCheckpoints,
      };
    },
  );
}

function isRetryableFenceV1(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = "code" in error ? error.code : undefined;
  if (code === "40001" || code === "23505") return true;
  return "cause" in error && isRetryableFenceV1(error.cause);
}

export function createPostgresTimerStateRepositoryV1(
  composition: TimerPostgresCompositionV1,
): PostgresTimerStateRepositoryPortV1 {
  let tail: Promise<void> = Promise.resolve();

  const repository: PostgresTimerStateRepositoryPortV1 = {
    persistence_kind: "postgresql",
    deployment: composition.deployment,
    async checkReadiness(signal: AbortSignal): Promise<void> {
      await composition.checkReadiness(signal);
    },
    async transact<T>(
      operation: (state: TimerStateV1) => T | Promise<T>,
    ): Promise<T> {
      let release: (() => void) | undefined;
      const turn = new Promise<void>((resolve) => {
        release = resolve;
      });
      const previous = tail;
      tail = previous.then(() => turn);
      await previous;
      try {
        for (let attempt = 1; attempt <= 3; attempt += 1) {
          const before = await loadStateV1(composition);
          const after = structuredClone(before);
          const result = await operation(after);
          const scheduleChanges = changedEntriesV1(before.schedules, after.schedules);
          const occurrenceChanges = changedEntriesV1(before.occurrences, after.occurrences);
          const commandChanges = changedEntriesV1(
            before.commandRequests,
            after.commandRequests,
          );
          const batchChanges = changedEntriesV1(before.batches, after.batches);
          const checkpointChanges = changedEntriesV1(
            before.scannerCheckpoints,
            after.scannerCheckpoints,
          );
          const newAttempts = after.dispatchAttempts.slice(
            before.dispatchAttempts.length,
          );
          if (
            scheduleChanges.length === 0 &&
            occurrenceChanges.length === 0 &&
            commandChanges.length === 0 &&
            batchChanges.length === 0 &&
            checkpointChanges.length === 0 &&
            newAttempts.length === 0
          ) {
            return result;
          }
          const changeFingerprint = digestV1({
            scheduleChanges,
            occurrenceChanges,
            commandChanges,
            batchChanges,
            checkpointChanges,
            newAttempts,
          });
          const traceId = `timer_repo_${changeFingerprint.slice(0, 40)}`;
          try {
            await composition.unit_of_work.withTransaction(
              {
                operation: "timer_state_transition",
                idempotency_key: `timer:${changeFingerprint}`,
                trace_id: traceId,
                isolation: "serializable",
                retry: "none",
              },
              async (transaction, { owner }) => {
                const execute = async <TWriter extends typeof composition.repository.contract.mutable_writers[number]>(
                  writer: TWriter,
                  args: Record<string, unknown>,
                ) => owner.executeWriter(transaction, {
                  writer,
                  arguments: args as never,
                  expected_rows: 1,
                });

                if (checkpointChanges.length > 0) {
                  if (checkpointChanges.length !== 1) {
                    throw new Error("Timer scan changed more than one checkpoint");
                  }
                  const checkpoint = checkpointChanges[0]!;
                  const parts = checkpoint.key.split("\u001f");
                  if (parts.length !== 6) {
                    throw new Error("Timer scanner checkpoint identity is invalid");
                  }
                  const [workspaceId, botId, ownerAgentId, environment, channel] = parts;
                  const physicalId = `timer_checkpoint_${digestV1(checkpoint.key).slice(0, 40)}`;
                  const audits = [
                    ...scheduleChanges.map(({ before: oldValue, after: value }) =>
                      auditRowV1({
                        idempotency: changeFingerprint,
                        scope: value.scope,
                        schedule_id: value.id,
                        occurrence_id: null,
                        event_type: scheduleEventTypeV1(oldValue, value),
                        previous_state: oldValue?.status ?? null,
                        next_state: value.status,
                        created_at: value.updated_at,
                      }),
                    ),
                    ...occurrenceChanges.flatMap(({ before: oldValue, after: value }) => {
                      const eventType = occurrenceEventTypeV1(oldValue, value);
                      return eventType === null
                        ? []
                        : [auditRowV1({
                            idempotency: `${changeFingerprint}:${value.id}`,
                            scope: value.scope,
                            schedule_id: value.schedule_id,
                            occurrence_id: value.id,
                            event_type: eventType,
                            previous_state: oldValue?.status ?? null,
                            next_state: value.status,
                            created_at: value.updated_at,
                          })];
                    }),
                  ];
                  await execute("advance_timer_scanner_checkpoint_v1", {
                    p_scanner_checkpoint_id: physicalId,
                    p_scanner_name: checkpoint.key,
                    p_expected_scanned_until:
                      checkpoint.before ?? "1970-01-01T00:00:00.000Z",
                    p_next_scanned_until: checkpoint.after,
                    p_lock_token: `timer_scan_${changeFingerprint}`,
                    p_workspace_id: workspaceId,
                    p_bot_id: botId,
                    p_owner_agent_id: ownerAgentId,
                    p_deployment_environment: environment,
                    p_release_channel: channel,
                    p_expected_schedule_versions: scheduleChanges
                      .filter(({ before: value }) => value !== undefined)
                      .map(({ before: value, key }) => ({
                        schedule_id: key,
                        expected_schedule_version: String(value!.schedule_version),
                      }))
                      .sort((left, right) => left.schedule_id.localeCompare(right.schedule_id)),
                    p_schedule_transitions: {
                      timer_schedules: scheduleChanges.map(({ after: value }) => scheduleRowV1(value)),
                    },
                    p_occurrences: {
                      timer_occurrences: occurrenceChanges
                        .filter(({ before: value }) => value === undefined)
                        .map(({ after: value }) => occurrenceRowV1(value)),
                    },
                    p_catch_up_batches: {
                      timer_catch_up_batches: batchChanges
                        .filter(({ before: value }) => value === undefined)
                        .map(({ after: value }) => batchRowV1(value)),
                      timer_audit_logs: audits,
                      timer_event_outbox: [],
                    },
                    p_idempotency_key: `timer:scan:${changeFingerprint}`,
                    p_request_hash: sha256V1({ checkpoint: checkpoint.key, changeFingerprint }),
                    p_trace_id: traceId,
                  });
                  return;
                }

                const newBatch = batchChanges.find(({ before: value }) => value === undefined);
                if (newBatch !== undefined) {
                  const scopeCheckpointName = `${scopeKeyV1(newBatch.after.scope)}\u001fcatch_up`;
                  const checkpointId = `timer_checkpoint_${digestV1(scopeCheckpointName).slice(0, 40)}`;
                  if (!before.scannerCheckpoints.has(scopeCheckpointName)) {
                    await execute("advance_timer_scanner_checkpoint_v1", {
                      p_scanner_checkpoint_id: checkpointId,
                      p_scanner_name: scopeCheckpointName,
                      p_expected_scanned_until: "1970-01-01T00:00:00.000Z",
                      p_next_scanned_until: "1970-01-01T00:00:00.000Z",
                      p_lock_token: `timer_catch_up_bootstrap_${changeFingerprint}`,
                      p_workspace_id: newBatch.after.scope.workspace_id,
                      p_bot_id: newBatch.after.scope.bot_id,
                      p_owner_agent_id: newBatch.after.scope.owner_agent_id,
                      p_deployment_environment: newBatch.after.scope.deployment_environment,
                      p_release_channel: newBatch.after.scope.release_channel,
                      p_expected_schedule_versions: [],
                      p_schedule_transitions: { timer_schedules: [] },
                      p_occurrences: { timer_occurrences: [] },
                      p_catch_up_batches: {
                        timer_catch_up_batches: [],
                        timer_audit_logs: [],
                        timer_event_outbox: [],
                      },
                      p_idempotency_key: `timer:catch_up_bootstrap:${changeFingerprint}`,
                      p_request_hash: sha256V1({ scopeCheckpointName }),
                      p_trace_id: traceId,
                    });
                  }
                  const changedOccurrences = occurrenceChanges.map(({ after: value }) => value);
                  await execute("create_timer_catch_up_batch_v1", {
                    p_scanner_checkpoint_id: checkpointId,
                    p_batch_id: newBatch.after.id,
                    p_batch: {
                      timer_catch_up_batches: batchRowV1(newBatch.after),
                      timer_occurrences: changedOccurrences.map(occurrenceRowV1),
                      timer_audit_logs: [auditRowV1({
                        idempotency: changeFingerprint,
                        scope: newBatch.after.scope,
                        schedule_id: changedOccurrences[0]!.schedule_id,
                        occurrence_id: null,
                        event_type: "timer.catch_up.batch_created",
                        previous_state: null,
                        next_state: "running",
                        created_at: newBatch.after.created_at,
                      })],
                      timer_event_outbox: [],
                    },
                    p_occurrence_ids: newBatch.after.occurrence_ids,
                    p_expected_occurrence_versions: occurrenceChanges.map(
                      ({ key, before: value }) => ({
                        occurrence_id: key,
                        expected_occurrence_version: String(value!.occurrence_version),
                      }),
                    ).sort((left, right) => left.occurrence_id.localeCompare(right.occurrence_id)),
                    p_idempotency_key: `timer:catch_up:${newBatch.after.id}`,
                    p_request_hash: sha256V1(newBatch.after),
                    p_trace_id: traceId,
                  });
                  return;
                }

                const newSchedule = scheduleChanges.find(({ before: value }) => value === undefined);
                if (newSchedule !== undefined) {
                  const command = commandChanges.find(({ before: value }) => value === undefined);
                  if (command === undefined) {
                    throw new Error("Timer schedule creation lost its command record");
                  }
                  const commandRow = commandRowV1(command.key, command.after);
                  await execute("create_timer_schedule_v1", {
                    p_schedule_id: newSchedule.after.id,
                    p_command_request_id: commandRow.id,
                    p_schedule: {
                      timer_schedules: scheduleRowV1(newSchedule.after),
                      timer_audit_logs: [auditRowV1({
                        idempotency: changeFingerprint,
                        scope: newSchedule.after.scope,
                        schedule_id: newSchedule.after.id,
                        occurrence_id: null,
                        event_type: "timer.schedule.created",
                        previous_state: null,
                        next_state: newSchedule.after.status,
                        created_at: newSchedule.after.created_at,
                      })],
                      timer_event_outbox: [],
                    },
                    p_command_request: { timer_command_requests: commandRow },
                    p_idempotency_key: commandRow.idempotency_key,
                    p_request_hash: command.after.request_hash,
                    p_trace_id: traceId,
                  });
                  return;
                }

                for (const change of scheduleChanges) {
                  if (change.before === undefined) continue;
                  await execute("cas_timer_schedule_v1", {
                    p_schedule_id: change.after.id,
                    p_expected_schedule_version: String(change.before.schedule_version),
                    p_schedule_patch: {
                      timer_schedules: scheduleRowV1(change.after),
                      timer_audit_logs: [auditRowV1({
                        idempotency: `${changeFingerprint}:${change.after.id}`,
                        scope: change.after.scope,
                        schedule_id: change.after.id,
                        occurrence_id: null,
                        event_type: scheduleEventTypeV1(change.before, change.after),
                        previous_state: change.before.status,
                        next_state: change.after.status,
                        created_at: change.after.updated_at,
                      })],
                      timer_event_outbox: [],
                    },
                    p_request_hash: sha256V1(change.after),
                    p_trace_id: traceId,
                  });
                }

                for (const change of occurrenceChanges) {
                  if (change.before === undefined) {
                    const schedule = after.schedules.get(change.after.schedule_id);
                    if (schedule === undefined) throw new Error("Timer occurrence schedule is missing");
                    await execute("enqueue_timer_occurrence_v1", {
                      p_occurrence_id: change.after.id,
                      p_schedule_id: schedule.id,
                      p_expected_schedule_version: String(schedule.schedule_version),
                      p_occurrence: {
                        timer_occurrences: occurrenceRowV1(change.after),
                        timer_schedules: [],
                        timer_audit_logs: [auditRowV1({
                          idempotency: `${changeFingerprint}:${change.after.id}`,
                          scope: change.after.scope,
                          schedule_id: change.after.schedule_id,
                          occurrence_id: change.after.id,
                          event_type: "timer.occurrence.due",
                          previous_state: null,
                          next_state: change.after.status,
                          created_at: change.after.created_at,
                        })],
                        timer_event_outbox: [],
                      },
                      p_idempotency_key: `timer:occurrence:${change.after.occurrence_key}`,
                      p_request_hash: sha256V1(change.after),
                      p_trace_id: traceId,
                    });
                    continue;
                  }
                  const attempt = newAttempts.find(
                    (value) => value.occurrence_id === change.after.id,
                  );
                  const dispatchAttempt =
                    attempt === undefined
                      ? []
                      : [{
                          id: `dispatch_${change.after.id}_${attempt.dispatch_generation}`,
                          occurrence_id: change.after.id,
                          attempt_no: attempt.attempt_no,
                          expected_occurrence_version: change.before.occurrence_version,
                          resulting_occurrence_version: change.after.occurrence_version,
                          dispatch_generation: attempt.dispatch_generation,
                          claim_token: change.before.claim_token,
                          status:
                            attempt.classification === "accepted" ||
                            attempt.classification === "idempotency_replayed"
                              ? "success"
                              : change.after.status === "retry_wait"
                                ? "retry_wait"
                                : "failed",
                          request: { application_attempt: attempt },
                          response:
                            attempt.trigger_process_id === null
                              ? null
                              : { trigger_process_id: attempt.trigger_process_id },
                          error:
                            attempt.classification === "accepted" ||
                            attempt.classification === "idempotency_replayed"
                              ? null
                              : { classification: attempt.classification },
                          next_retry_at: change.after.next_retry_at,
                          created_at: attempt.created_at,
                        }];
                  const eventType = occurrenceEventTypeV1(change.before, change.after);
                  await execute("transition_timer_occurrence_v1", {
                    p_occurrence_id: change.after.id,
                    p_expected_occurrence_version: String(change.before.occurrence_version),
                    p_expected_dispatch_generation: String(change.before.dispatch_generation),
                    p_expected_status: change.before.status,
                    p_next_status: change.after.status,
                    p_dispatch: {
                      timer_occurrences: occurrenceRowV1(change.after),
                      timer_dispatch_attempts: dispatchAttempt,
                      timer_schedules: [],
                      timer_catch_up_batches: [],
                      timer_audit_logs:
                        eventType === null
                          ? []
                          : [auditRowV1({
                              idempotency: `${changeFingerprint}:${change.after.id}`,
                              scope: change.after.scope,
                              schedule_id: change.after.schedule_id,
                              occurrence_id: change.after.id,
                              event_type: eventType,
                              previous_state: change.before.status,
                              next_state: change.after.status,
                              created_at: change.after.updated_at,
                            })],
                      timer_event_outbox: [],
                    },
                    p_request_hash: sha256V1(change.after),
                    p_trace_id: traceId,
                  });
                }

                for (const change of batchChanges) {
                  if (change.before === undefined) continue;
                  const relatedOccurrences = occurrenceChanges.filter(
                    ({ after: value }) => value.catch_up_batch_id === change.after.id,
                  );
                  await execute("transition_timer_catch_up_batch_v1", {
                    p_batch_id: change.after.id,
                    p_expected_status: change.before.status,
                    p_expected_continuation: {
                      cursor_occurrence_id: change.before.cursor_occurrence_id,
                      last_occurrence_id: change.before.last_occurrence_id,
                      last_trigger_process_id: change.before.last_trigger_process_id,
                    },
                    p_next_status: change.after.status,
                    p_batch_patch: {
                      timer_catch_up_batches: batchRowV1(change.after),
                      timer_occurrences: relatedOccurrences.map(({ after: value }) => occurrenceRowV1(value)),
                      timer_schedules: [],
                      timer_audit_logs:
                        change.after.status === "timed_out"
                          ? [auditRowV1({
                              idempotency: `${changeFingerprint}:${change.after.id}`,
                              scope: change.after.scope,
                              schedule_id: relatedOccurrences[0]?.after.schedule_id ??
                                after.occurrences.get(change.after.occurrence_ids[0]!)!.schedule_id,
                              occurrence_id: null,
                              event_type: "timer.catch_up.timeout",
                              previous_state: change.before.status,
                              next_state: change.after.status,
                              created_at: change.after.updated_at,
                            })]
                          : [],
                      timer_event_outbox: [],
                    },
                    p_request_hash: sha256V1(change.after),
                    p_trace_id: traceId,
                  });
                }

                for (const command of commandChanges) {
                  if (command.before !== undefined) continue;
                  const row = commandRowV1(command.key, command.after);
                  await execute("record_timer_command_request_v1", {
                    p_command_request_id: row.id,
                    p_command_request: {
                      timer_command_requests: row,
                      timer_event_inbox: [],
                      timer_event_dlq: [],
                      timer_audit_logs: [],
                      timer_event_outbox: [],
                    },
                    p_source_event: {},
                    p_idempotency_key: row.idempotency_key,
                    p_request_hash: row.request_hash,
                    p_payload_hash: sha256V1(row.request),
                    p_semantic_hash: sha256V1({ method: row.method, schedule_id: row.schedule_id }),
                    p_scope_fingerprint: sha256V1({
                      workspace_id: row.workspace_id,
                      bot_id: row.bot_id,
                      owner_agent_id: row.owner_agent_id,
                      deployment_environment: row.deployment_environment,
                      release_channel: row.release_channel,
                    }),
                    p_trace_id: traceId,
                  });
                }
              },
            );
            return result;
          } catch (error) {
            if (attempt < 3 && isRetryableFenceV1(error)) continue;
            throw error;
          }
        }
        throw new Error("Timer PostgreSQL state transition exhausted retries");
      } finally {
        release?.();
      }
    },
  };
  return repository;
}
