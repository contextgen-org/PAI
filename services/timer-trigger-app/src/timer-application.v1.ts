import {
  createHash,
  randomUUID,
} from "node:crypto";
import { isProxy } from "node:util/types";

import { Value } from "@sinclair/typebox/value";

import type {
  TimerTriggerSubmitRequestV1,
  TriggerProcessQueryDetailsV1,
  TriggerSubmitResponseV1,
} from "@pai/contracts";
import {
  CanonicalJsonViolationV1,
  TriggerProcessQueryDetailsV1Schema,
  TriggerSubmitResponseV1Schema,
  assertTriggerProcessQueryDetailsV1,
  canonicalJsonV1 as sharedCanonicalJsonV1,
} from "@pai/contracts";
import {
  assertTimerDispatchRequestBindingsV1,
  type TimerDispatchRequestV1 as TimerOwnerDispatchRequestV1,
} from "@pai/contracts/timer/dispatch-request.v1";
import type { TimerCatchUpPolicySnapshotV1 } from "@pai/contracts/timer/catch-up-batch.v1";
import type { VerifiedOwnerRepositoryDeploymentV1 } from "@pai/persistence";

export const TIMER_COMMAND_METHODS_V1 = [
  "timer.create",
  "timer.remind_after",
  "timer.remind_at",
  "timer.create_recurring",
  "timer.update",
  "timer.pause",
  "timer.resume",
  "timer.cancel",
  "timer.snooze",
] as const;

export const TIMER_QUERY_METHODS_V1 = [
  "timer.list",
  "timer.get",
  "timer.history",
] as const;

export type TimerCommandMethodV1 = (typeof TIMER_COMMAND_METHODS_V1)[number];
export type TimerQueryMethodV1 = (typeof TIMER_QUERY_METHODS_V1)[number];

export interface TimerScopeV1 {
  readonly workspace_id: string;
  readonly bot_id: string;
  readonly owner_agent_id: string;
  readonly deployment_environment: "local" | "dev" | "staging" | "prod";
  readonly release_channel: "stable" | "canary";
}

export interface TimerPrincipalV1 {
  readonly caller: "action_runtime" | "timer_trigger_app";
  readonly capabilities: readonly string[];
  readonly scope: TimerScopeV1;
}

export interface TimerCommandV1 {
  readonly schema_version: "timer.schedule_command.v1";
  readonly method: TimerCommandMethodV1;
  readonly runtime_run_id: string;
  readonly trigger_process_id: string;
  readonly client_request_id: string;
  readonly trace_id: string;
  readonly scope: TimerScopeV1;
  readonly schedule_id?: string;
  readonly occurrence_id?: string;
  readonly expected_schedule_version?: number;
  readonly expected_occurrence_version?: number;
  readonly kind?: "once" | "recurring";
  readonly fire_at?: string;
  readonly delay_seconds?: number;
  readonly rrule?: string;
  readonly timezone?: string;
  readonly name?: string;
  readonly message?: string;
  readonly payload?: Readonly<Record<string, unknown>>;
  readonly end_time?: string;
  readonly catch_up?: boolean;
  readonly priority_hint?: "strong" | "weak";
  readonly intent_hint?: string;
  readonly reason?: string;
  readonly snooze_until?: string;
}

export interface TimerQueryV1 {
  readonly method: TimerQueryMethodV1;
  readonly runtime_run_id: string;
  readonly trace_id: string;
  readonly scope: TimerScopeV1;
  readonly schedule_id?: string;
  readonly status?: TimerScheduleStatusV1;
  readonly limit?: number;
  readonly cursor?: string;
}

export type TimerScheduleStatusV1 =
  | "active"
  | "paused"
  | "cancelled"
  | "completed"
  | "expired"
  | "failed";

export type TimerOccurrenceStatusV1 =
  | "pending"
  | "dispatching"
  | "retry_wait"
  | "dispatched"
  | "failed"
  | "skipped"
  | "cancelled";

export interface TimerScheduleV1 {
  readonly id: string;
  readonly scope: TimerScopeV1;
  readonly name: string;
  readonly status: TimerScheduleStatusV1;
  readonly kind: "once" | "recurring";
  readonly timezone: string;
  readonly message: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly end_time: string | null;
  readonly catch_up: boolean;
  readonly max_catch_up_window_seconds: number;
  readonly max_catch_up_occurrences: number;
  readonly fire_at: string | null;
  readonly rrule: string | null;
  readonly next_fire_at: string | null;
  readonly schedule_version: number;
  readonly created_by_runtime_run_id: string;
  readonly created_by_trigger_process_id: string;
  readonly client_request_id: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface TimerOccurrenceV1 {
  readonly id: string;
  readonly scope: TimerScopeV1;
  readonly schedule_id: string;
  readonly schedule_version: number;
  readonly local_date: string;
  readonly local_time: string;
  readonly timezone: string;
  readonly schedule_end_time: string | null;
  readonly scheduled_fire_at: string;
  readonly effective_fire_at: string;
  readonly occurrence_key: string;
  readonly status: TimerOccurrenceStatusV1;
  readonly occurrence_version: number;
  readonly dispatch_generation: number;
  readonly claim_token: string | null;
  readonly locked_by: string | null;
  readonly locked_until: string | null;
  readonly attempt_count: number;
  readonly next_retry_at: string | null;
  readonly trigger_id: string | null;
  readonly trigger_process_id: string | null;
  readonly dispatch_error_class: TimerDispatchClassificationV1 | null;
  readonly dispatch_commit_outcome_unknown: boolean;
  readonly message: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly is_catch_up: boolean;
  readonly catch_up_batch_id: string | null;
  readonly missed_window_summary: string | null;
  readonly dst_shifted: boolean;
  readonly cancel_requested_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface TimerCatchUpBatchV1 {
  readonly id: string;
  readonly scope: TimerScopeV1;
  readonly status: "running" | "completed" | "timed_out" | "cancelled";
  readonly occurrence_ids: readonly string[];
  readonly cursor_occurrence_id: string | null;
  readonly last_occurrence_id: string | null;
  readonly last_trigger_process_id: string | null;
  readonly timeout_seconds: number;
  readonly deadline_at: string;
  readonly policy_snapshot: TimerCatchUpPolicySnapshotV1;
  readonly reason: string | null;
  readonly started_at: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly completed_at: string | null;
}

export interface TimerCommandResponseV1 {
  readonly code:
    | "timer_schedule_created"
    | "timer_schedule_updated"
    | "timer_schedule_paused"
    | "timer_schedule_resumed"
    | "timer_schedule_cancelled"
    | "timer_occurrence_snoozed";
  readonly duplicate_replayed: boolean;
  readonly trace_id: string;
  readonly schedule: TimerScheduleV1;
  readonly occurrence: TimerOccurrenceV1 | null;
}

export type TimerQueryResponseV1 =
  | Readonly<{
      code: "timer_schedules_found";
      trace_id: string;
      schedules: readonly TimerScheduleV1[];
      next_cursor: string | null;
    }>
  | Readonly<{
      code: "timer_schedule_found";
      trace_id: string;
      schedule: TimerScheduleV1;
    }>
  | Readonly<{
      code: "timer_history_found";
      trace_id: string;
      schedule: TimerScheduleV1;
      occurrences: readonly TimerOccurrenceV1[];
      next_cursor: string | null;
    }>;

export type TimerDispatchClassificationV1 =
  | "retryable_transient"
  | "retryable_rate_limited"
  | "idempotency_replayed"
  | "non_retryable_contract"
  | "non_retryable_permission"
  | "non_retryable_cancelled"
  | "downstream_rejected";

export type TimerApplicationErrorCodeV1 =
  | "invalid_request"
  | "forbidden"
  | "schedule_not_found"
  | "occurrence_not_found"
  | "idempotency_conflict"
  | "version_conflict"
  | "invalid_state"
  | "claim_conflict"
  | "payload_too_large"
  | "catch_up_conflict"
  | "catch_up_not_found";

export class TimerApplicationErrorV1 extends Error {
  public constructor(
    public readonly code: TimerApplicationErrorCodeV1,
    message: string,
  ) {
    super(message);
    this.name = "TimerApplicationErrorV1";
  }
}

export class TimerDownstreamErrorV1 extends Error {
  public constructor(
    public readonly classification: Exclude<
      TimerDispatchClassificationV1,
      "idempotency_replayed" | "non_retryable_cancelled"
    >,
    message: string,
  ) {
    super(message);
    this.name = "TimerDownstreamErrorV1";
  }
}

export interface TimerTriggerProcessorPortV1 {
  submit(
    request: TimerTriggerSubmitRequestV1,
    traceId: string,
  ): Promise<TriggerSubmitResponseV1>;
  getProcess(
    processId: string,
    scope: TimerScopeV1,
    traceId: string,
  ): Promise<TriggerProcessQueryDetailsV1>;
  checkReadiness?(signal: AbortSignal): Promise<void>;
}

interface StoredCommandV1 {
  readonly request_hash: string;
  readonly response: TimerCommandResponseV1;
}

export interface TimerDispatchAttemptV1 {
  readonly occurrence_id: string;
  readonly attempt_no: number;
  readonly dispatch_generation: number;
  readonly classification: TimerDispatchClassificationV1 | "accepted";
  readonly commit_outcome_unknown: boolean;
  readonly trigger_process_id: string | null;
  readonly created_at: string;
}

export interface TimerDlqEntryV1 {
  readonly occurrence_id: string;
  readonly dispatch_generation: number;
  readonly classification: TimerDispatchClassificationV1;
  readonly created_at: string;
}

export interface TimerStateV1 {
  readonly schedules: Map<string, MutableTimerScheduleV1>;
  readonly occurrences: Map<string, MutableTimerOccurrenceV1>;
  readonly occurrenceIdsByKey: Map<string, string>;
  readonly commandRequests: Map<string, StoredCommandV1>;
  readonly dispatchAttempts: TimerDispatchAttemptV1[];
  readonly dlq: TimerDlqEntryV1[];
  readonly batches: Map<string, MutableTimerCatchUpBatchV1>;
  readonly scannerCheckpoints: Map<string, string>;
}

export interface TimerStateRepositoryPortV1 {
  transact<T>(
    operation: (state: TimerStateV1) => T | Promise<T>,
  ): Promise<T>;
  checkReadiness?(signal: AbortSignal): Promise<void>;
}

export interface PostgresTimerStateRepositoryPortV1
  extends TimerStateRepositoryPortV1 {
  readonly persistence_kind: "postgresql";
  readonly deployment: VerifiedOwnerRepositoryDeploymentV1<"timer_trigger_app">;
}

/**
 * Reserved for the future PostgreSQL Timer state adapter. This module-private
 * capability deliberately has no public factory today: permission-manifest
 * verification alone cannot turn the in-memory state machine into a durable
 * production repository.
 */
const verifiedDurableTimerRepositoryBrandV1 = Symbol(
  "verifiedDurableTimerRepositoryV1",
);

export class InMemoryTimerStateRepositoryV1
  implements TimerStateRepositoryPortV1
{
  #state: TimerStateV1 = {
    schedules: new Map(),
    occurrences: new Map(),
    occurrenceIdsByKey: new Map(),
    commandRequests: new Map(),
    dispatchAttempts: [],
    dlq: [],
    batches: new Map(),
    scannerCheckpoints: new Map(),
  };

  #tail: Promise<void> = Promise.resolve();

  public async transact<T>(
    operation: (state: TimerStateV1) => T | Promise<T>,
  ): Promise<T> {
    let release: (() => void) | undefined;
    const turn = new Promise<void>((resolve) => {
      release = resolve;
    });
    const previous = this.#tail;
    this.#tail = previous.then(() => turn);
    await previous;
    const rollbackSnapshot = structuredClone(this.#state);
    try {
      return await operation(this.#state);
    } catch (error) {
      this.#state = rollbackSnapshot;
      throw error;
    } finally {
      release?.();
    }
  }

  public async checkReadiness(_signal: AbortSignal): Promise<void> {}
}

interface MutableTimerScheduleV1 {
  id: string;
  scope: TimerScopeV1;
  name: string;
  status: TimerScheduleStatusV1;
  kind: "once" | "recurring";
  timezone: string;
  message: string;
  payload: Readonly<Record<string, unknown>>;
  end_time: string | null;
  catch_up: boolean;
  max_catch_up_window_seconds: number;
  max_catch_up_occurrences: number;
  fire_at: string | null;
  rrule: string | null;
  next_fire_at: string | null;
  schedule_version: number;
  created_by_runtime_run_id: string;
  created_by_trigger_process_id: string;
  client_request_id: string;
  created_at: string;
  updated_at: string;
}

interface MutableTimerOccurrenceV1 {
  id: string;
  scope: TimerScopeV1;
  schedule_id: string;
  schedule_version: number;
  local_date: string;
  local_time: string;
  timezone: string;
  schedule_end_time: string | null;
  scheduled_fire_at: string;
  effective_fire_at: string;
  occurrence_key: string;
  status: TimerOccurrenceStatusV1;
  occurrence_version: number;
  dispatch_generation: number;
  claim_token: string | null;
  locked_by: string | null;
  locked_until: string | null;
  attempt_count: number;
  next_retry_at: string | null;
  trigger_process_id: string | null;
  trigger_id: string | null;
  dispatch_error_class: TimerDispatchClassificationV1 | null;
  dispatch_commit_outcome_unknown: boolean;
  message: string;
  payload: Readonly<Record<string, unknown>>;
  is_catch_up: boolean;
  catch_up_batch_id: string | null;
  missed_window_summary: string | null;
  dst_shifted: boolean;
  cancel_requested_at: string | null;
  created_at: string;
  updated_at: string;
}

interface MutableTimerCatchUpBatchV1 {
  id: string;
  scope: TimerScopeV1;
  status: "running" | "completed" | "timed_out" | "cancelled";
  occurrence_ids: string[];
  cursor_occurrence_id: string | null;
  last_occurrence_id: string | null;
  last_trigger_process_id: string | null;
  timeout_seconds: number;
  deadline_at: string;
  policy_snapshot: TimerCatchUpPolicySnapshotV1;
  reason: string | null;
  started_at: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface TimerClaimV1 {
  readonly occurrence: TimerOccurrenceV1;
  readonly previous_status: "pending" | "retry_wait" | "dispatching";
  readonly claim_token: string;
  readonly dispatch_generation: number;
  readonly occurrence_version: number;
}

export interface TimerScanRequestV1 {
  readonly scope: TimerScopeV1;
  readonly worker_id: string;
  readonly checkpoint_id: string;
  readonly limit?: number;
  readonly now?: string;
}

export interface TimerClaimRequestV1 {
  readonly scope: TimerScopeV1;
  readonly occurrence_id: string;
  readonly expected_occurrence_version: number;
  readonly expected_schedule_version: number;
  readonly expected_status: "pending" | "retry_wait" | "dispatching";
  readonly worker_id: string;
  readonly lease_seconds?: number;
  readonly now?: string;
}

export interface TimerDispatchRequestV1 {
  readonly scope: TimerScopeV1;
  readonly occurrence_id: string;
  readonly expected_occurrence_version: number;
  readonly dispatch_generation: number;
  readonly claim_token: string;
  readonly trace_id: string;
  readonly now?: string;
  readonly owner_request?: TimerOwnerDispatchRequestV1;
}

export interface TimerCatchUpCreateRequestV1 {
  readonly scope: TimerScopeV1;
  readonly occurrence_ids: readonly string[];
  readonly trace_id: string;
  readonly timeout_seconds?: number;
  readonly continue_after_failed?: boolean;
  readonly now?: string;
}

export interface TimerCatchUpAdvanceRequestV1 {
  readonly scope: TimerScopeV1;
  readonly batch_id: string;
  readonly expected_status: "running";
  readonly expected_cursor_occurrence_id: string | null;
  readonly expected_last_occurrence_id: string | null;
  readonly expected_last_trigger_process_id: string | null;
  readonly trace_id: string;
  readonly now?: string;
}

export interface TimerCatchUpAdvanceResponseV1 {
  readonly batch: TimerCatchUpBatchV1;
  readonly outcome: "ready" | "waiting" | "completed" | "timed_out";
  readonly occurrence: TimerOccurrenceV1 | null;
}

export interface TimerApplicationOptionsV1 {
  readonly max_dispatch_attempts?: number;
  readonly base_retry_delay_ms?: number;
  readonly max_retry_delay_ms?: number;
  readonly clock?: () => Date;
}

const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,511}$/u;
const localDatePattern = /^\d{4}-\d{2}-\d{2}$/u;
const localTimePattern = /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/u;
const rfc3339InstantPattern =
  /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/u;
const terminalOccurrenceStatuses = new Set<TimerOccurrenceStatusV1>([
  "dispatched",
  "failed",
  "skipped",
  "cancelled",
]);
const terminalScheduleStatuses = new Set<TimerScheduleStatusV1>([
  "cancelled",
  "completed",
  "expired",
  "failed",
]);

function isCommitUnknownReplayV1(
  occurrence: Pick<
    MutableTimerOccurrenceV1,
    "status" | "dispatch_commit_outcome_unknown"
  >,
): boolean {
  return (
    occurrence.status === "retry_wait" &&
    occurrence.dispatch_commit_outcome_unknown
  );
}

function invalid(message: string): never {
  throw new TimerApplicationErrorV1("invalid_request", message);
}

function assertIdentifier(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !identifierPattern.test(value)) {
    invalid(`${label} is invalid`);
  }
}

function assertSafePositiveInteger(
  value: unknown,
  label: string,
  maximum = Number.MAX_SAFE_INTEGER,
): asserts value is number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > maximum
  ) {
    invalid(`${label} must be a positive safe integer`);
  }
}

function nextSafeCounterV1(value: number, label: string): number {
  if (
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value >= Number.MAX_SAFE_INTEGER
  ) {
    throw new TimerApplicationErrorV1(
      "invalid_state",
      `${label} is exhausted or corrupt`,
    );
  }
  return value + 1;
}

const TIMER_CANONICAL_MAX_DEPTH_V1 = 64;
const TIMER_CANONICAL_MAX_NODES_V1 = 10_000;
const TIMER_CANONICAL_MAX_BYTES_V1 = 64 * 1_024;

type TimerCanonicalJsonValueV1 =
  | null
  | boolean
  | number
  | string
  | TimerCanonicalJsonValueV1[]
  | { [key: string]: TimerCanonicalJsonValueV1 };

type TimerCanonicalTargetV1 =
  | TimerCanonicalJsonValueV1[]
  | { [key: string]: TimerCanonicalJsonValueV1 };

type TimerCanonicalWorkV1 =
  | Readonly<{
      kind: "visit";
      value: unknown;
      depth: number;
      parent: TimerCanonicalTargetV1 | null;
      key: string | number | null;
    }>
  | Readonly<{
      kind: "leave";
      source: object;
      target: TimerCanonicalTargetV1;
    }>;

function snapshotOwnJsonValueV1(value: unknown): TimerCanonicalJsonValueV1 {
  let root: TimerCanonicalJsonValueV1 | undefined;
  let nodeCount = 0;
  let minimumBytes = 0;
  const activePath = new WeakSet<object>();
  const work: TimerCanonicalWorkV1[] = [
    {
      kind: "visit",
      value,
      depth: 0,
      parent: null,
      key: null,
    },
  ];

  const addMinimumBytes = (text: string): void => {
    minimumBytes += Buffer.byteLength(text, "utf8");
    if (minimumBytes > TIMER_CANONICAL_MAX_BYTES_V1) {
      invalid("canonical JSON byte budget exceeded");
    }
  };
  const assign = (
    parent: TimerCanonicalTargetV1 | null,
    key: string | number | null,
    entry: TimerCanonicalJsonValueV1,
  ): void => {
    if (parent === null) {
      root = entry;
      return;
    }
    if (key === null) invalid("canonical JSON destination is invalid");
    if (Array.isArray(parent)) {
      if (typeof key !== "number") {
        invalid("canonical JSON array destination is invalid");
      }
      parent[key] = entry;
      return;
    }
    if (typeof key !== "string") {
      invalid("canonical JSON object destination is invalid");
    }
    parent[key] = entry;
  };

  while (work.length > 0) {
    const current = work.pop();
    if (current === undefined) break;
    if (current.kind === "leave") {
      activePath.delete(current.source);
      Object.freeze(current.target);
      continue;
    }
    nodeCount += 1;
    if (nodeCount > TIMER_CANONICAL_MAX_NODES_V1) {
      invalid("canonical JSON node budget exceeded");
    }
    if (current.depth > TIMER_CANONICAL_MAX_DEPTH_V1) {
      invalid("canonical JSON depth budget exceeded");
    }

    const entry = current.value;
    if (
      entry === null ||
      typeof entry === "boolean" ||
      typeof entry === "string"
    ) {
      if (typeof entry === "string") addMinimumBytes(entry);
      assign(current.parent, current.key, entry);
      continue;
    }
    if (typeof entry === "number") {
      if (!Number.isFinite(entry)) invalid("canonical JSON number must be finite");
      assign(current.parent, current.key, Object.is(entry, -0) ? 0 : entry);
      continue;
    }
    if (typeof entry !== "object") invalid("canonical value must be JSON");
    if (isProxy(entry)) invalid("canonical JSON proxies are not supported");
    if (activePath.has(entry)) invalid("canonical JSON cycle detected");

    let descriptors: PropertyDescriptorMap;
    let prototype: object | null;
    try {
      descriptors = Object.getOwnPropertyDescriptors(entry);
      prototype = Object.getPrototypeOf(entry);
    } catch {
      invalid("canonical JSON object metadata is not inspectable");
    }
    const ownKeys = Reflect.ownKeys(descriptors);
    if (ownKeys.some((key) => typeof key !== "string")) {
      invalid("canonical JSON symbol keys are not supported");
    }

    activePath.add(entry);
    if (Array.isArray(entry)) {
      if (prototype !== Array.prototype) {
        invalid("canonical JSON arrays must use the standard prototype");
      }
      const lengthDescriptor = descriptors.length;
      if (
        lengthDescriptor === undefined ||
        !("value" in lengthDescriptor) ||
        !Number.isSafeInteger(lengthDescriptor.value) ||
        lengthDescriptor.value < 0
      ) {
        invalid("canonical JSON array length is invalid");
      }
      const length = lengthDescriptor.value as number;
      if (
        length > TIMER_CANONICAL_MAX_NODES_V1 ||
        ownKeys.length !== length + 1
      ) {
        invalid("canonical JSON arrays must be dense without extensions");
      }
      const target: TimerCanonicalJsonValueV1[] = new Array(length);
      assign(current.parent, current.key, target);
      work.push({ kind: "leave", source: entry, target });
      for (let index = length - 1; index >= 0; index -= 1) {
        const descriptor = descriptors[String(index)];
        if (
          descriptor === undefined ||
          !("value" in descriptor) ||
          descriptor.enumerable !== true
        ) {
          invalid("canonical JSON array entries must be enumerable data");
        }
        work.push({
          kind: "visit",
          value: descriptor.value,
          depth: current.depth + 1,
          parent: target,
          key: index,
        });
      }
      continue;
    }

    if (prototype !== Object.prototype && prototype !== null) {
      invalid("canonical JSON objects must be plain data");
    }
    const keys = ownKeys as string[];
    if (keys.length > TIMER_CANONICAL_MAX_NODES_V1) {
      invalid("canonical JSON node budget exceeded");
    }
    keys.sort();
    const target: { [key: string]: TimerCanonicalJsonValueV1 } =
      Object.create(null) as { [key: string]: TimerCanonicalJsonValueV1 };
    assign(current.parent, current.key, target);
    work.push({ kind: "leave", source: entry, target });
    for (let index = keys.length - 1; index >= 0; index -= 1) {
      const key = keys[index];
      if (key === undefined) continue;
      const descriptor = descriptors[key];
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        descriptor.enumerable !== true
      ) {
        invalid("canonical JSON properties must be enumerable data");
      }
      addMinimumBytes(key);
      work.push({
        kind: "visit",
        value: descriptor.value,
        depth: current.depth + 1,
        parent: target,
        key,
      });
    }
  }
  if (root === undefined) invalid("canonical JSON root is missing");
  return root;
}

function ownJsonValue(value: unknown): unknown {
  canonicalJsonV1(value);
  const snapshot = snapshotOwnJsonValueV1(value);
  return snapshot;
}

/** RFC 8785 compatible for values accepted by the JSON trust boundary. */
export function canonicalJsonV1(value: unknown): string {
  try {
    return sharedCanonicalJsonV1(value, {
      max_bytes: TIMER_CANONICAL_MAX_BYTES_V1,
      max_depth: TIMER_CANONICAL_MAX_DEPTH_V1,
      max_nodes: TIMER_CANONICAL_MAX_NODES_V1,
      max_container_entries: TIMER_CANONICAL_MAX_NODES_V1,
    });
  } catch (error) {
    if (error instanceof CanonicalJsonViolationV1) {
      invalid(`canonical JSON rejected: ${error.reason}`);
    }
    throw error;
  }
}

function digestBase64Url(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("base64url");
}

function digestHex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function timerOccurrenceKeyV1(input: Readonly<{
  schedule_id: string;
  schedule_version: number;
  local_date: string;
  local_time: string;
  timezone: string;
}>): string {
  assertIdentifier(input.schedule_id, "schedule_id");
  assertSafePositiveInteger(input.schedule_version, "schedule_version");
  if (!localDatePattern.test(input.local_date)) invalid("local_date is invalid");
  dateAtUtc(input.local_date);
  if (!localTimePattern.test(input.local_time)) invalid("local_time is invalid");
  assertIanaTimezone(input.timezone);
  const digest = digestBase64Url(
    canonicalJsonV1({
      schedule_id: input.schedule_id,
      schedule_version: input.schedule_version,
      local_date: input.local_date,
      local_time: input.local_time,
      timezone: input.timezone,
    }),
  );
  return `v1:${digest}`;
}

function assertIanaTimezone(timezone: unknown): asserts timezone is string {
  if (
    typeof timezone !== "string" ||
    timezone.length < 1 ||
    timezone.length > 255
  ) {
    invalid("timezone is invalid");
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(0);
  } catch (error) {
    if (error instanceof RangeError) invalid("timezone must be an IANA timezone");
    throw error;
  }
}

function parseInstant(value: unknown, label: string): Date {
  if (
    typeof value !== "string" ||
    !rfc3339InstantPattern.test(value)
  ) {
    invalid(`${label} must be an RFC3339 instant`);
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) invalid(`${label} is invalid`);
  dateAtUtc(value.slice(0, 10));
  return date;
}

function snapshotInstantV1(value: Date, label: string): Date {
  let milliseconds: number;
  try {
    milliseconds = Date.prototype.getTime.call(value);
  } catch {
    invalid(`${label} is invalid`);
  }
  if (!Number.isFinite(milliseconds)) invalid(`${label} is invalid`);
  return new Date(milliseconds);
}

type TimerHistoryCursorTupleV1 = readonly [
  scheduled_fire_at: string,
  occurrence_id: string,
];

function parseTimerHistoryCursorV1(
  value: string | undefined,
): TimerHistoryCursorTupleV1 | null {
  if (value === undefined) return null;
  let decoded: unknown;
  try {
    decoded = JSON.parse(value);
  } catch {
    invalid("Timer history cursor is invalid");
  }
  if (
    !Array.isArray(decoded) ||
    decoded.length !== 2 ||
    typeof decoded[0] !== "string" ||
    typeof decoded[1] !== "string"
  ) {
    invalid("Timer history cursor is invalid");
  }
  const scheduled = parseInstant(decoded[0], "history cursor timestamp");
  assertIdentifier(decoded[1], "history cursor occurrence_id");
  const tuple = [iso(scheduled), decoded[1]] as const;
  if (canonicalJsonV1(tuple) !== value) {
    invalid("Timer history cursor is not canonical");
  }
  return tuple;
}

function timerHistoryCursorV1(
  occurrence: TimerOccurrenceV1,
): string {
  return canonicalJsonV1([
    occurrence.scheduled_fire_at,
    occurrence.id,
  ]);
}

function iso(date: Date): string {
  return date.toISOString();
}

function localTuple(
  instant: Date,
  timezone: string,
): Readonly<{ local_date: string; local_time: string }> {
  const parts = new Intl.DateTimeFormat("en-US-u-ca-gregory-nu-latn", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes): string => {
    const value = parts.find((part) => part.type === type)?.value;
    if (value === undefined) invalid(`timezone formatter omitted ${type}`);
    return value;
  };
  return {
    local_date: `${get("year")}-${get("month")}-${get("day")}`,
    local_time: `${get("hour")}:${get("minute")}:${get("second")}`,
  };
}

function localTupleValue(tuple: Readonly<{
  local_date: string;
  local_time: string;
}>): string {
  return `${tuple.local_date}T${tuple.local_time}`;
}

function localComponentsAsUtc(instant: Date, timezone: string): number {
  const tuple = localTuple(instant, timezone);
  return Date.parse(`${tuple.local_date}T${tuple.local_time}Z`);
}

/**
 * Resolve a civil time without depending on the host timezone. Repeated times
 * choose the earlier instant; a DST gap shifts to the first valid civil minute.
 */
export function resolveTimerLocalTimeV1(
  localDate: string,
  localTime: string,
  timezone: string,
): Readonly<{ instant: Date; dst_shifted: boolean }> {
  if (!localDatePattern.test(localDate) || !localTimePattern.test(localTime)) {
    invalid("local date/time is invalid");
  }
  dateAtUtc(localDate);
  assertIanaTimezone(timezone);
  const naive = Date.parse(`${localDate}T${localTime}Z`);
  if (!Number.isFinite(naive)) invalid("local date/time is not a real date");
  const exact = new Set<number>();
  for (let hours = -48; hours <= 48; hours += 6) {
    const probe = new Date(naive + hours * 3_600_000);
    const offset = localComponentsAsUtc(probe, timezone) - probe.getTime();
    const candidate = naive - offset;
    const tuple = localTuple(new Date(candidate), timezone);
    if (
      tuple.local_date === localDate &&
      tuple.local_time === localTime
    ) {
      exact.add(candidate);
    }
  }
  if (exact.size > 0) {
    return {
      instant: new Date(Math.min(...exact)),
      dst_shifted: false,
    };
  }

  const target = `${localDate}T${localTime}`;
  let firstAfter: Readonly<{ instant: Date; tuple: string }> | undefined;
  const start =
    Math.floor((naive - 18 * 3_600_000) / 60_000) * 60_000;
  for (let index = 0; index <= 36 * 60; index += 1) {
    const candidate = new Date(start + index * 60_000);
    const tuple = localTupleValue(localTuple(candidate, timezone));
    if (
      tuple > target &&
      (firstAfter === undefined ||
        tuple < firstAfter.tuple ||
        (tuple === firstAfter.tuple &&
          candidate.getTime() < firstAfter.instant.getTime()))
    ) {
      firstAfter = { instant: candidate, tuple };
    }
  }
  if (firstAfter === undefined) invalid("local time cannot be resolved");
  return { instant: firstAfter.instant, dst_shifted: true };
}

function scopeKey(scope: TimerScopeV1): string {
  return [
    scope.workspace_id,
    scope.bot_id,
    scope.owner_agent_id,
    scope.deployment_environment,
    scope.release_channel,
  ].join("\u001f");
}

function sameScope(left: TimerScopeV1, right: TimerScopeV1): boolean {
  return scopeKey(left) === scopeKey(right);
}

function snapshotScope(scope: TimerScopeV1): TimerScopeV1 {
  if (
    typeof scope !== "object" ||
    scope === null ||
    Array.isArray(scope)
  ) {
    invalid("scope must be an object");
  }
  assertIdentifier(scope.workspace_id, "workspace_id");
  assertIdentifier(scope.bot_id, "bot_id");
  assertIdentifier(scope.owner_agent_id, "owner_agent_id");
  if (!["local", "dev", "staging", "prod"].includes(scope.deployment_environment)) {
    invalid("deployment_environment is invalid");
  }
  if (!["stable", "canary"].includes(scope.release_channel)) {
    invalid("release_channel is invalid");
  }
  return Object.freeze({ ...scope });
}

function snapshotSchedule(schedule: MutableTimerScheduleV1): TimerScheduleV1 {
  return Object.freeze({
    ...schedule,
    scope: Object.freeze({ ...schedule.scope }),
    payload: ownJsonValue(schedule.payload) as Readonly<Record<string, unknown>>,
  });
}

function snapshotOccurrence(
  occurrence: MutableTimerOccurrenceV1,
): TimerOccurrenceV1 {
  return Object.freeze({
    ...occurrence,
    scope: Object.freeze({ ...occurrence.scope }),
    payload: ownJsonValue(occurrence.payload) as Readonly<Record<string, unknown>>,
  });
}

function snapshotBatch(batch: MutableTimerCatchUpBatchV1): TimerCatchUpBatchV1 {
  return Object.freeze({
    ...batch,
    scope: Object.freeze({ ...batch.scope }),
    occurrence_ids: Object.freeze([...batch.occurrence_ids]),
    policy_snapshot: Object.freeze({ ...batch.policy_snapshot }),
  });
}

function sameCatchUpContinuation(
  left: Pick<
    TimerCatchUpBatchV1,
    | "cursor_occurrence_id"
    | "last_occurrence_id"
    | "last_trigger_process_id"
  >,
  right: Pick<
    TimerCatchUpBatchV1,
    | "cursor_occurrence_id"
    | "last_occurrence_id"
    | "last_trigger_process_id"
  >,
): boolean {
  return (
    left.cursor_occurrence_id === right.cursor_occurrence_id &&
    left.last_occurrence_id === right.last_occurrence_id &&
    left.last_trigger_process_id === right.last_trigger_process_id
  );
}

function commandIdentity(command: TimerCommandV1): string {
  return [
    scopeKey(command.scope),
    command.runtime_run_id,
    command.method,
    command.client_request_id,
  ].join("\u001f");
}

function commandHash(command: TimerCommandV1): string {
  const { trace_id: _traceId, ...hashable } = command;
  return digestHex(canonicalJsonV1(hashable));
}

function assertCommandEnvelope(
  principal: TimerPrincipalV1,
  command: TimerCommandV1,
): void {
  if (
    typeof command !== "object" ||
    command === null ||
    Array.isArray(command)
  ) {
    invalid("command must be an object");
  }
  const allowedKeys = new Set([
    "schema_version",
    "method",
    "runtime_run_id",
    "trigger_process_id",
    "client_request_id",
    "trace_id",
    "scope",
    "schedule_id",
    "occurrence_id",
    "expected_schedule_version",
    "expected_occurrence_version",
    "kind",
    "fire_at",
    "delay_seconds",
    "rrule",
    "timezone",
    "name",
    "message",
    "payload",
    "end_time",
    "catch_up",
    "priority_hint",
    "intent_hint",
    "reason",
    "snooze_until",
  ]);
  if (Object.keys(command).some((key) => !allowedKeys.has(key))) {
    invalid("command contains an unsupported field");
  }
  if (
    principal.caller !== "action_runtime" ||
    !principal.capabilities.includes("timer.write")
  ) {
    throw new TimerApplicationErrorV1("forbidden", "timer.write is required");
  }
  if (
    command.schema_version !== "timer.schedule_command.v1" ||
    !TIMER_COMMAND_METHODS_V1.includes(command.method)
  ) {
    invalid("unsupported timer command");
  }
  assertIdentifier(command.runtime_run_id, "runtime_run_id");
  assertIdentifier(command.trigger_process_id, "trigger_process_id");
  assertIdentifier(command.client_request_id, "client_request_id");
  assertIdentifier(command.trace_id, "trace_id");
  const scope = snapshotScope(command.scope);
  if (!sameScope(scope, principal.scope)) {
    throw new TimerApplicationErrorV1(
      "forbidden",
      "command scope does not match the verified workload scope",
    );
  }
  const has = (key: keyof TimerCommandV1): boolean =>
    command[key] !== undefined;
  const rejectFields = (keys: readonly (keyof TimerCommandV1)[]): void => {
    if (keys.some(has)) invalid(`${command.method} contains an invalid field`);
  };
  switch (command.method) {
    case "timer.remind_after":
      if (command.kind !== undefined && command.kind !== "once") {
        invalid("timer.remind_after must be once");
      }
      if (!has("fire_at")) invalid("normalized fire_at is required");
      rejectFields(["delay_seconds", "rrule", "schedule_id", "occurrence_id"]);
      break;
    case "timer.remind_at":
      if (command.kind !== undefined && command.kind !== "once") {
        invalid("timer.remind_at must be once");
      }
      if (!has("fire_at")) invalid("fire_at is required");
      rejectFields(["delay_seconds", "rrule", "schedule_id", "occurrence_id"]);
      break;
    case "timer.create_recurring":
      if (command.kind !== undefined && command.kind !== "recurring") {
        invalid("timer.create_recurring must be recurring");
      }
      if (!has("rrule")) invalid("rrule is required");
      rejectFields(["delay_seconds", "fire_at", "schedule_id", "occurrence_id"]);
      break;
    case "timer.create":
      if (command.kind === "once") {
        if (!has("fire_at")) invalid("fire_at is required for a once timer");
        rejectFields(["rrule", "delay_seconds"]);
      } else if (command.kind === "recurring") {
        if (!has("rrule")) invalid("rrule is required for a recurring timer");
        rejectFields(["fire_at", "delay_seconds"]);
      } else {
        invalid("timer.create requires kind");
      }
      rejectFields(["schedule_id", "occurrence_id"]);
      break;
    case "timer.update":
      if (!has("schedule_id") || !has("expected_schedule_version")) {
        invalid("update requires schedule_id and expected_schedule_version");
      }
      rejectFields([
        "delay_seconds",
        "occurrence_id",
        "expected_occurrence_version",
        "snooze_until",
      ]);
      break;
    case "timer.pause":
    case "timer.resume":
    case "timer.cancel":
      if (!has("schedule_id") || !has("expected_schedule_version")) {
        invalid(`${command.method} requires schedule CAS`);
      }
      rejectFields([
        "occurrence_id",
        "expected_occurrence_version",
        "kind",
        "fire_at",
        "delay_seconds",
        "rrule",
        "timezone",
        "name",
        "message",
        "payload",
        "end_time",
        "catch_up",
        "priority_hint",
        "intent_hint",
        "snooze_until",
      ]);
      break;
    case "timer.snooze":
      if (
        !has("schedule_id") ||
        !has("occurrence_id") ||
        !has("expected_schedule_version") ||
        !has("expected_occurrence_version") ||
        !has("snooze_until")
      ) {
        invalid("snooze requires schedule and occurrence CAS");
      }
      rejectFields([
        "kind",
        "fire_at",
        "delay_seconds",
        "rrule",
        "timezone",
        "name",
        "message",
        "payload",
        "end_time",
        "catch_up",
        "priority_hint",
        "intent_hint",
      ]);
      break;
  }
}

function assertQueryEnvelope(
  principal: TimerPrincipalV1,
  query: TimerQueryV1,
): void {
  if (
    typeof query !== "object" ||
    query === null ||
    Array.isArray(query)
  ) {
    invalid("query must be an object");
  }
  const allowedKeys = new Set([
    "method",
    "runtime_run_id",
    "trace_id",
    "scope",
    "schedule_id",
    "status",
    "limit",
    "cursor",
  ]);
  if (Object.keys(query).some((key) => !allowedKeys.has(key))) {
    invalid("query contains an unsupported field");
  }
  if (
    principal.caller !== "action_runtime" ||
    !principal.capabilities.includes("timer.read")
  ) {
    throw new TimerApplicationErrorV1("forbidden", "timer.read is required");
  }
  if (!TIMER_QUERY_METHODS_V1.includes(query.method)) invalid("unsupported query");
  assertIdentifier(query.runtime_run_id, "runtime_run_id");
  assertIdentifier(query.trace_id, "trace_id");
  const scope = snapshotScope(query.scope);
  if (!sameScope(scope, principal.scope)) {
    throw new TimerApplicationErrorV1(
      "forbidden",
      "query scope does not match the verified workload scope",
    );
  }
  if (query.method === "timer.list") {
    if (query.schedule_id !== undefined) {
      invalid("timer.list cannot carry schedule_id");
    }
    if (
      query.status !== undefined &&
      ![
        "active",
        "paused",
        "cancelled",
        "completed",
        "expired",
        "failed",
      ].includes(query.status)
    ) {
      invalid("status is invalid");
    }
    if (query.cursor !== undefined) assertIdentifier(query.cursor, "cursor");
  } else if (query.method === "timer.get") {
    assertIdentifier(query.schedule_id, "schedule_id");
    if (
      query.status !== undefined ||
      query.limit !== undefined ||
      query.cursor !== undefined
    ) {
      invalid(`${query.method} contains a list-only field`);
    }
  } else {
    assertIdentifier(query.schedule_id, "schedule_id");
    if (query.status !== undefined) {
      invalid("timer.history cannot carry status");
    }
    if (query.limit !== undefined) {
      assertSafePositiveInteger(query.limit, "limit", 100);
    }
    if (
      query.cursor !== undefined &&
      (typeof query.cursor !== "string" ||
        query.cursor.length === 0 ||
        Buffer.byteLength(query.cursor, "utf8") > 1_024)
    ) {
      invalid("timer.history cursor is invalid");
    }
  }
}

function assertWorker(
  principal: TimerPrincipalV1,
  capability: string,
  scope: TimerScopeV1,
): void {
  const requestedScope = snapshotScope(scope);
  if (
    principal.caller !== "timer_trigger_app" ||
    !principal.capabilities.includes(capability) ||
    !sameScope(principal.scope, requestedScope)
  ) {
    throw new TimerApplicationErrorV1(
      "forbidden",
      `${capability} and matching scope are required`,
    );
  }
}

interface ParsedRRuleV1 {
  readonly frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  readonly interval: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  readonly byDay: readonly number[] | null;
}

function parseRRule(value: string): ParsedRRuleV1 {
  const entries = new Map<string, string>();
  for (const part of value.split(";")) {
    const [rawKey, rawValue, ...rest] = part.split("=");
    if (
      rawKey === undefined ||
      rawValue === undefined ||
      rest.length > 0 ||
      entries.has(rawKey)
    ) {
      invalid("rrule is invalid");
    }
    entries.set(rawKey.toUpperCase(), rawValue.toUpperCase());
  }
  const allowed = new Set([
    "FREQ",
    "INTERVAL",
    "BYHOUR",
    "BYMINUTE",
    "BYSECOND",
    "BYDAY",
  ]);
  if ([...entries.keys()].some((key) => !allowed.has(key))) {
    invalid("rrule contains an unsupported field");
  }
  const frequency = entries.get("FREQ");
  if (
    frequency !== "DAILY" &&
    frequency !== "WEEKLY" &&
    frequency !== "MONTHLY"
  ) {
    invalid("rrule FREQ must be DAILY, WEEKLY, or MONTHLY");
  }
  const numberField = (
    key: string,
    fallback: number,
    minimum: number,
    maximum: number,
  ): number => {
    const raw = entries.get(key);
    if (raw === undefined) return fallback;
    if (!/^\d+$/u.test(raw)) invalid(`rrule ${key} is invalid`);
    const parsed = Number(raw);
    if (
      !Number.isSafeInteger(parsed) ||
      parsed < minimum ||
      parsed > maximum
    ) {
      invalid(`rrule ${key} is out of range`);
    }
    return parsed;
  };
  const weekdayByName: Readonly<Record<string, number>> = {
    SU: 0,
    MO: 1,
    TU: 2,
    WE: 3,
    TH: 4,
    FR: 5,
    SA: 6,
  };
  const byDayRaw = entries.get("BYDAY");
  if (byDayRaw !== undefined && frequency !== "WEEKLY") {
    invalid("rrule BYDAY is supported only with WEEKLY");
  }
  const byDay =
    byDayRaw === undefined
      ? null
      : Object.freeze(
          byDayRaw.split(",").map((name) => {
            const day = weekdayByName[name];
            if (day === undefined) invalid("rrule BYDAY is invalid");
            return day;
          }),
        );
  return Object.freeze({
    frequency,
    interval: numberField("INTERVAL", 1, 1, 366),
    hour: numberField("BYHOUR", 9, 0, 23),
    minute: numberField("BYMINUTE", 0, 0, 59),
    second: numberField("BYSECOND", 0, 0, 59),
    byDay,
  });
}

function dateAtUtc(localDate: string): Date {
  const date = new Date(`${localDate}T00:00:00Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== localDate
  ) {
    invalid("local date is invalid");
  }
  return date;
}

function nextRecurringInstant(
  rruleValue: string,
  timezone: string,
  after: Date,
  anchorDate: string,
): Readonly<{
  instant: Date;
  local_date: string;
  local_time: string;
  dst_shifted: boolean;
}> {
  const rule = parseRRule(rruleValue);
  const afterLocal = localTuple(after, timezone);
  const firstDate = dateAtUtc(afterLocal.local_date);
  const anchor = dateAtUtc(anchorDate);
  for (let dayOffset = 0; dayOffset <= 3_660; dayOffset += 1) {
    const date = new Date(firstDate.getTime() + dayOffset * 86_400_000);
    const localDate = date.toISOString().slice(0, 10);
    const daysFromAnchor = Math.floor(
      (date.getTime() - anchor.getTime()) / 86_400_000,
    );
    if (daysFromAnchor < 0) continue;
    const matchesFrequency =
      rule.frequency === "DAILY"
        ? daysFromAnchor % rule.interval === 0
        : rule.frequency === "WEEKLY"
          ? Math.floor(daysFromAnchor / 7) % rule.interval === 0 &&
            (rule.byDay ?? [anchor.getUTCDay()]).includes(date.getUTCDay())
          : (date.getUTCFullYear() - anchor.getUTCFullYear()) * 12 +
                date.getUTCMonth() -
                anchor.getUTCMonth() >=
              0 &&
            ((date.getUTCFullYear() - anchor.getUTCFullYear()) * 12 +
              date.getUTCMonth() -
              anchor.getUTCMonth()) %
              rule.interval ===
              0 &&
            date.getUTCDate() === anchor.getUTCDate();
    if (!matchesFrequency) continue;
    const localTime = [rule.hour, rule.minute, rule.second]
      .map((part) => String(part).padStart(2, "0"))
      .join(":");
    const resolved = resolveTimerLocalTimeV1(localDate, localTime, timezone);
    if (resolved.instant.getTime() > after.getTime()) {
      const tuple = localTuple(resolved.instant, timezone);
      return {
        instant: resolved.instant,
        local_date: tuple.local_date,
        local_time: tuple.local_time,
        dst_shifted: resolved.dst_shifted,
      };
    }
  }
  invalid("rrule did not produce an occurrence within ten years");
}

function nextScheduleInstantAfterV1(
  schedule: MutableTimerScheduleV1,
  after: Date,
): Date | null {
  if (schedule.kind !== "recurring" || schedule.rrule === null) return null;
  const anchor = localTuple(
    new Date(schedule.created_at),
    schedule.timezone,
  );
  const next = nextRecurringInstant(
    schedule.rrule,
    schedule.timezone,
    after,
    anchor.local_date,
  ).instant;
  if (
    schedule.end_time !== null &&
    next.getTime() > Date.parse(schedule.end_time)
  ) {
    return null;
  }
  return next;
}

function recurrenceWasDstShiftedV1(
  schedule: MutableTimerScheduleV1,
  scheduled: Date,
): boolean {
  if (schedule.kind !== "recurring" || schedule.rrule === null) return false;
  const rule = parseRRule(schedule.rrule);
  const tuple = localTuple(scheduled, schedule.timezone);
  const intendedTime = [rule.hour, rule.minute, rule.second]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
  const resolved = resolveTimerLocalTimeV1(
    tuple.local_date,
    intendedTime,
    schedule.timezone,
  );
  return (
    resolved.dst_shifted &&
    resolved.instant.getTime() === scheduled.getTime()
  );
}

function scheduleIdFor(command: TimerCommandV1): string {
  return `timer_${digestBase64Url(commandIdentity(command)).slice(0, 32)}`;
}

function occurrenceIdFor(key: string): string {
  return `occ_${digestBase64Url(key).slice(0, 32)}`;
}

function assertPayload(
  payload: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> {
  const snapshot = ownJsonValue(payload ?? {}) as Readonly<
    Record<string, unknown>
  >;
  const bytes = Buffer.byteLength(canonicalJsonV1(snapshot), "utf8");
  if (bytes > 8 * 1_024) {
    throw new TimerApplicationErrorV1(
      "payload_too_large",
      "timer payload exceeds 8 KiB",
    );
  }
  return snapshot;
}

function commandSchedule(
  state: TimerStateV1,
  command: TimerCommandV1,
): MutableTimerScheduleV1 {
  assertIdentifier(command.schedule_id, "schedule_id");
  const schedule = state.schedules.get(command.schedule_id);
  if (schedule === undefined || !sameScope(schedule.scope, command.scope)) {
    throw new TimerApplicationErrorV1(
      "schedule_not_found",
      "timer schedule was not found",
    );
  }
  return schedule;
}

function assertExpectedScheduleVersion(
  schedule: MutableTimerScheduleV1,
  expected: unknown,
): void {
  assertSafePositiveInteger(expected, "expected_schedule_version");
  if (schedule.schedule_version !== expected) {
    throw new TimerApplicationErrorV1(
      "version_conflict",
      "schedule version no longer matches",
    );
  }
}

function createOccurrence(
  state: TimerStateV1,
  schedule: MutableTimerScheduleV1,
  scheduled: Date,
  effective: Date,
  options: Readonly<{
    is_catch_up?: boolean;
    catch_up_batch_id?: string | null;
    missed_window_summary?: string | null;
    dst_shifted?: boolean;
    now?: Date;
  }> = {},
): MutableTimerOccurrenceV1 {
  const tuple = localTuple(scheduled, schedule.timezone);
  const key = timerOccurrenceKeyV1({
    schedule_id: schedule.id,
    schedule_version: schedule.schedule_version,
    local_date: tuple.local_date,
    local_time: tuple.local_time,
    timezone: schedule.timezone,
  });
  const existingId = state.occurrenceIdsByKey.get(key);
  if (existingId !== undefined) {
    const existing = state.occurrences.get(existingId);
    if (existing === undefined) {
      throw new Error("occurrence key index is corrupt");
    }
    return existing;
  }
  const now = iso(options.now ?? new Date());
  const occurrence: MutableTimerOccurrenceV1 = {
    id: occurrenceIdFor(key),
    scope: schedule.scope,
    schedule_id: schedule.id,
    schedule_version: schedule.schedule_version,
    local_date: tuple.local_date,
    local_time: tuple.local_time,
    timezone: schedule.timezone,
    schedule_end_time: schedule.end_time,
    scheduled_fire_at: iso(scheduled),
    effective_fire_at: iso(effective),
    occurrence_key: key,
    status: "pending",
    occurrence_version: 1,
    dispatch_generation: 0,
    claim_token: null,
    locked_by: null,
    locked_until: null,
    attempt_count: 0,
    next_retry_at: null,
    trigger_process_id: null,
    trigger_id: null,
    dispatch_error_class: null,
    dispatch_commit_outcome_unknown: false,
    message: schedule.message,
    payload: schedule.payload,
    is_catch_up: options.is_catch_up ?? false,
    catch_up_batch_id: options.catch_up_batch_id ?? null,
    missed_window_summary: options.missed_window_summary ?? null,
    dst_shifted: options.dst_shifted ?? false,
    cancel_requested_at: null,
    created_at: now,
    updated_at: now,
  };
  state.occurrences.set(occurrence.id, occurrence);
  state.occurrenceIdsByKey.set(key, occurrence.id);
  return occurrence;
}

function createSkippedMissedOccurrenceV1(
  state: TimerStateV1,
  schedule: MutableTimerScheduleV1,
  scheduled: Date,
  now: Date,
): MutableTimerOccurrenceV1 {
  const occurrence = createOccurrence(
    state,
    schedule,
    scheduled,
    scheduled,
    {
      dst_shifted: recurrenceWasDstShiftedV1(schedule, scheduled),
      now,
    },
  );
  if (
    occurrence.status === "pending" ||
    (occurrence.status === "retry_wait" &&
      !isCommitUnknownReplayV1(occurrence))
  ) {
    occurrence.status = "skipped";
    occurrence.next_retry_at = null;
    occurrence.claim_token = null;
    occurrence.locked_by = null;
    occurrence.locked_until = null;
    occurrence.occurrence_version = nextSafeCounterV1(
      occurrence.occurrence_version,
      "occurrence version",
    );
    occurrence.updated_at = iso(now);
  }
  return occurrence;
}

function expireScheduleWithoutOutstandingOccurrenceV1(
  state: TimerStateV1,
  schedule: MutableTimerScheduleV1,
  now: Date,
): void {
  const scheduleOccurrences = [...state.occurrences.values()].filter(
    (occurrence) =>
      occurrence.schedule_id === schedule.id &&
      (occurrence.schedule_version === schedule.schedule_version ||
        isCommitUnknownReplayV1(occurrence)),
  );
  const hasOutstanding = scheduleOccurrences.some(
    (occurrence) => !terminalOccurrenceStatuses.has(occurrence.status),
  );
  if (
    schedule.status !== "active" ||
    hasOutstanding ||
    (schedule.next_fire_at !== null && schedule.kind !== "once")
  ) {
    return;
  }
  schedule.next_fire_at = null;
  schedule.status =
    schedule.kind === "once" &&
    scheduleOccurrences.some((occurrence) => occurrence.status === "dispatched")
      ? "completed"
      : "expired";
  schedule.schedule_version = nextSafeCounterV1(
    schedule.schedule_version,
    "schedule version",
  );
  schedule.updated_at = iso(now);
}

function nextFireAtPreservingOutstandingOnceV1(
  state: TimerStateV1,
  schedule: MutableTimerScheduleV1,
  next: Date | null,
): string | null {
  if (next !== null) return iso(next);
  if (
    schedule.kind === "once" &&
    [...state.occurrences.values()].some(
      (occurrence) =>
        occurrence.schedule_id === schedule.id &&
        occurrence.schedule_version === schedule.schedule_version &&
        !terminalOccurrenceStatuses.has(occurrence.status),
    )
  ) {
    return schedule.next_fire_at;
  }
  return null;
}

function cancelCatchUpBatchAfterFailureV1(
  state: TimerStateV1,
  batch: MutableTimerCatchUpBatchV1,
  now: Date,
  reason: string,
): void {
  batch.status = "cancelled";
  batch.reason = reason;
  batch.completed_at = iso(now);
  batch.updated_at = iso(now);
  for (const id of batch.occurrence_ids) {
    const occurrence = state.occurrences.get(id);
    if (
      occurrence === undefined ||
      isCommitUnknownReplayV1(occurrence) ||
      (occurrence.status !== "pending" &&
        occurrence.status !== "retry_wait")
    ) {
      continue;
    }
    occurrence.status = "skipped";
    occurrence.next_retry_at = null;
    occurrence.occurrence_version = nextSafeCounterV1(
      occurrence.occurrence_version,
      "occurrence version",
    );
    occurrence.updated_at = iso(now);
    const schedule = state.schedules.get(occurrence.schedule_id);
    if (
      schedule !== undefined &&
      schedule.status === "active" &&
      schedule.schedule_version === occurrence.schedule_version
    ) {
      expireScheduleWithoutOutstandingOccurrenceV1(state, schedule, now);
    }
  }
}

function rebindOccurrenceVersion(
  state: TimerStateV1,
  occurrence: MutableTimerOccurrenceV1,
  scheduleVersion: number,
): void {
  const nextKey = timerOccurrenceKeyV1({
    schedule_id: occurrence.schedule_id,
    schedule_version: scheduleVersion,
    local_date: occurrence.local_date,
    local_time: occurrence.local_time,
    timezone: occurrence.timezone,
  });
  const conflictingId = state.occurrenceIdsByKey.get(nextKey);
  if (conflictingId !== undefined && conflictingId !== occurrence.id) {
    throw new TimerApplicationErrorV1(
      "version_conflict",
      "the resumed occurrence identity already exists",
    );
  }
  state.occurrenceIdsByKey.delete(occurrence.occurrence_key);
  state.occurrenceIdsByKey.set(nextKey, occurrence.id);
  occurrence.schedule_version = scheduleVersion;
  occurrence.occurrence_key = nextKey;
}

function scheduleResponse(
  code: TimerCommandResponseV1["code"],
  command: TimerCommandV1,
  schedule: MutableTimerScheduleV1,
  occurrence: MutableTimerOccurrenceV1 | null,
): TimerCommandResponseV1 {
  return Object.freeze({
    code,
    duplicate_replayed: false,
    trace_id: command.trace_id,
    schedule: snapshotSchedule(schedule),
    occurrence:
      occurrence === null ? null : snapshotOccurrence(occurrence),
  });
}

function replayResponse(
  response: TimerCommandResponseV1,
  traceId: string,
): TimerCommandResponseV1 {
  return Object.freeze({
    ...response,
    duplicate_replayed: true,
    trace_id: traceId,
  });
}

function isProcessClosedForCatchUp(
  process: TriggerProcessQueryDetailsV1,
): boolean {
  if (
    process.phase !== "closed" ||
    !["completed", "failed", "preempted", "cancelled"].includes(process.status)
  ) {
    return false;
  }
  if (process.status === "preempted") {
    return process.meta_status === "not_applicable";
  }
  if (process.meta_status === "not_applicable") return true;
  return (
    process.meta_status === "completed" || process.meta_status === "failed"
  );
}

function snapshotTriggerProcessProjectionV1(
  value: unknown,
  boundary: "catch_up" | "dispatch",
): TriggerProcessQueryDetailsV1 {
  const fail = (message: string): never => {
    if (boundary === "catch_up") {
      throw new TimerApplicationErrorV1("catch_up_conflict", message);
    }
    throw new TimerDownstreamErrorV1("non_retryable_contract", message);
  };
  let snapshot: unknown;
  try {
    snapshot = ownJsonValue(value);
  } catch {
    return fail(
      "Trigger Processor process projection is not canonical JSON data",
    );
  }
  if (!Value.Check(TriggerProcessQueryDetailsV1Schema, snapshot)) {
    return fail(
      "Trigger Processor process projection violates its owner schema",
    );
  }
  try {
    assertTriggerProcessQueryDetailsV1(snapshot);
  } catch {
    return fail(
      "Trigger Processor process projection violates semantic bindings",
    );
  }
  return snapshot;
}

function snapshotCatchUpProcessProjectionV1(
  value: unknown,
  expectedProcessId: string,
  expectedScope: TimerScopeV1,
): TriggerProcessQueryDetailsV1 {
  const process = snapshotTriggerProcessProjectionV1(value, "catch_up");
  if (process.id !== expectedProcessId || !sameScope(process, expectedScope)) {
    throw new TimerApplicationErrorV1(
      "catch_up_conflict",
      "Trigger Processor process projection identity drifted",
    );
  }
  return process;
}

function snapshotSubmittedProcessProjectionV1(
  value: unknown,
  expectedProcessId: string,
  expectedTriggerId: string,
  expectedScope: TimerScopeV1,
): TriggerProcessQueryDetailsV1 {
  const process = snapshotTriggerProcessProjectionV1(value, "dispatch");
  if (
    process.id !== expectedProcessId ||
    process.trigger_id !== expectedTriggerId ||
    !sameScope(process, expectedScope)
  ) {
    throw new TimerDownstreamErrorV1(
      "non_retryable_contract",
      "Trigger Processor process projection drifted from the accepted Timer submission",
    );
  }
  return process;
}

function snapshotTriggerSubmitResponseV1(
  value: unknown,
  expectedTraceId: string,
  isCatchUp: boolean,
): TriggerSubmitResponseV1 {
  let snapshot: unknown;
  try {
    snapshot = ownJsonValue(value);
  } catch {
    throw new TimerDownstreamErrorV1(
      "non_retryable_contract",
      "Trigger Processor returned a non-canonical submit response",
    );
  }
  if (!Value.Check(TriggerSubmitResponseV1Schema, snapshot)) {
    throw new TimerDownstreamErrorV1(
      "non_retryable_contract",
      "Trigger Processor submit response violates its owner schema",
    );
  }
  const response = snapshot as TriggerSubmitResponseV1;
  if (response.trace_id !== expectedTraceId) {
    throw new TimerDownstreamErrorV1(
      "non_retryable_contract",
      "Trigger Processor submit response trace identity drifted",
    );
  }
  if (response.details.trigger_status === "accepted") {
    if (response.details.priority !== "strong") {
      throw new TimerDownstreamErrorV1(
        "non_retryable_contract",
        "Trigger Processor downgraded a Timer trigger priority",
      );
    }
    const isDirectCatchUp =
      response.details.action === "dispatch_catch_up_serial" &&
      response.details.reason_code === "timer_catch_up";
    const isQueuedCatchUp =
      response.details.action === "enqueue_strong_fifo" &&
      response.details.reason_code === "catch_up_foreground_busy";
    if (
      (isCatchUp && !isDirectCatchUp && !isQueuedCatchUp) ||
      (!isCatchUp && (isDirectCatchUp || isQueuedCatchUp))
    ) {
      throw new TimerDownstreamErrorV1(
        "non_retryable_contract",
        "Trigger Processor submit response drifted from Timer catch-up semantics",
      );
    }
  }
  return response;
}

export class TimerApplicationV1 {
  readonly #maxDispatchAttempts: number;
  readonly #baseRetryDelayMs: number;
  readonly #maxRetryDelayMs: number;
  readonly #clock: () => Date;

  public constructor(
    private readonly repository: TimerStateRepositoryPortV1,
    private readonly triggerProcessor: TimerTriggerProcessorPortV1,
    options: TimerApplicationOptionsV1 = {},
  ) {
    this.#maxDispatchAttempts = options.max_dispatch_attempts ?? 5;
    this.#baseRetryDelayMs = options.base_retry_delay_ms ?? 1_000;
    this.#maxRetryDelayMs = options.max_retry_delay_ms ?? 60_000;
    this.#clock = options.clock ?? (() => new Date());
    assertSafePositiveInteger(
      this.#maxDispatchAttempts,
      "max_dispatch_attempts",
      100,
    );
    assertSafePositiveInteger(
      this.#baseRetryDelayMs,
      "base_retry_delay_ms",
      86_400_000,
    );
    assertSafePositiveInteger(
      this.#maxRetryDelayMs,
      "max_retry_delay_ms",
      86_400_000,
    );
  }

  public async checkReadiness(signal: AbortSignal): Promise<void> {
    if (
      (
        this.repository as TimerStateRepositoryPortV1 & {
          readonly [verifiedDurableTimerRepositoryBrandV1]?: true;
        }
      )[verifiedDurableTimerRepositoryBrandV1] !== true
    ) {
      throw new Error(
        "Timer production readiness requires the verified durable state adapter",
      );
    }
    if (
      this.repository.checkReadiness === undefined ||
      this.triggerProcessor.checkReadiness === undefined
    ) {
      throw new Error(
        "Timer repository and Trigger Processor readiness probes are required",
      );
    }
    await this.repository.checkReadiness(signal);
    await this.triggerProcessor.checkReadiness(signal);
  }

  public async executeCommand(
    principal: TimerPrincipalV1,
    command: TimerCommandV1,
    now = new Date(),
  ): Promise<TimerCommandResponseV1> {
    command = ownJsonValue(command) as TimerCommandV1;
    now = snapshotInstantV1(now, "now");
    assertCommandEnvelope(principal, command);
    const identity = commandIdentity(command);
    const requestHash = commandHash(command);
    return this.repository.transact((state) => {
      const existing = state.commandRequests.get(identity);
      if (existing !== undefined) {
        if (existing.request_hash !== requestHash) {
          throw new TimerApplicationErrorV1(
            "idempotency_conflict",
            "the client_request_id was reused with a different command",
          );
        }
        return replayResponse(existing.response, command.trace_id);
      }
      const response = this.applyCommand(state, command, now);
      state.commandRequests.set(identity, {
        request_hash: requestHash,
        response,
      });
      return response;
    });
  }

  private applyCommand(
    state: TimerStateV1,
    command: TimerCommandV1,
    now: Date,
  ): TimerCommandResponseV1 {
    switch (command.method) {
      case "timer.create":
      case "timer.remind_after":
      case "timer.remind_at":
      case "timer.create_recurring":
        return this.createSchedule(state, command, now);
      case "timer.update":
        return this.updateSchedule(state, command, now);
      case "timer.pause":
        return this.pauseSchedule(state, command, now);
      case "timer.resume":
        return this.resumeSchedule(state, command, now);
      case "timer.cancel":
        return this.cancelSchedule(state, command, now);
      case "timer.snooze":
        return this.snoozeOccurrence(state, command, now);
    }
  }

  private createSchedule(
    state: TimerStateV1,
    command: TimerCommandV1,
    now: Date,
  ): TimerCommandResponseV1 {
    const timezone = command.timezone;
    assertIanaTimezone(timezone);
    if (typeof command.message !== "string" || command.message.length < 1) {
      invalid("message is required");
    }
    if (Buffer.byteLength(command.message, "utf8") > 8 * 1_024) {
      throw new TimerApplicationErrorV1(
        "payload_too_large",
        "timer message exceeds 8 KiB",
      );
    }
    const name = command.name ?? command.message;
    if (
      typeof name !== "string" ||
      name.length < 1 ||
      name.length > 512
    ) {
      invalid("name is required and must be at most 512 characters");
    }
    const payload = assertPayload(command.payload);
    const kind =
      command.method === "timer.create_recurring"
        ? "recurring"
        : command.kind ??
          (command.rrule === undefined ? "once" : "recurring");
    const onceInstant =
      kind === "once" ? parseInstant(command.fire_at, "fire_at") : null;
    if (onceInstant !== null && onceInstant.getTime() <= now.getTime()) {
      invalid("fire_at must be in the future");
    }
    if (kind === "recurring" && typeof command.rrule !== "string") {
      invalid("rrule is required for a recurring timer");
    }
    if (kind === "once" && command.rrule !== undefined) {
      invalid("once timer cannot carry rrule");
    }
    const anchorTuple = localTuple(now, timezone);
    const recurring =
      kind === "recurring"
        ? nextRecurringInstant(command.rrule as string, timezone, now, anchorTuple.local_date)
        : null;
    const nextFire = onceInstant ?? recurring?.instant ?? null;
    const endTime =
      command.end_time === undefined
        ? null
        : iso(parseInstant(command.end_time, "end_time"));
    if (
      endTime !== null &&
      nextFire !== null &&
      Date.parse(endTime) < nextFire.getTime()
    ) {
      invalid("end_time cannot precede next_fire_at");
    }
    const timestamp = iso(now);
    const schedule: MutableTimerScheduleV1 = {
      id: scheduleIdFor(command),
      scope: snapshotScope(command.scope),
      name,
      status: "active",
      kind,
      timezone,
      message: command.message,
      payload,
      end_time: endTime,
      catch_up: command.catch_up ?? true,
      max_catch_up_window_seconds: 86_400,
      max_catch_up_occurrences: 100,
      fire_at: onceInstant === null ? null : iso(onceInstant),
      rrule: kind === "recurring" ? (command.rrule as string) : null,
      next_fire_at: nextFire === null ? null : iso(nextFire),
      schedule_version: 1,
      created_by_runtime_run_id: command.runtime_run_id,
      created_by_trigger_process_id: command.trigger_process_id,
      client_request_id: command.client_request_id,
      created_at: timestamp,
      updated_at: timestamp,
    };
    if (state.schedules.has(schedule.id)) {
      throw new TimerApplicationErrorV1(
        "idempotency_conflict",
        "deterministic schedule identity already exists",
      );
    }
    state.schedules.set(schedule.id, schedule);
    return scheduleResponse("timer_schedule_created", command, schedule, null);
  }

  private updateSchedule(
    state: TimerStateV1,
    command: TimerCommandV1,
    now: Date,
  ): TimerCommandResponseV1 {
    const schedule = commandSchedule(state, command);
    assertExpectedScheduleVersion(schedule, command.expected_schedule_version);
    if (terminalScheduleStatuses.has(schedule.status)) {
      throw new TimerApplicationErrorV1(
        "invalid_state",
        "terminal schedule cannot be updated",
      );
    }
    const nextKind =
      command.kind ??
      (command.rrule !== undefined
        ? "recurring"
        : command.fire_at !== undefined
          ? "once"
          : schedule.kind);
    const timeRuleChanged =
      nextKind !== schedule.kind ||
      command.fire_at !== undefined ||
      command.rrule !== undefined ||
      command.timezone !== undefined;
    const nextTimezone = command.timezone ?? schedule.timezone;
    assertIanaTimezone(nextTimezone);
    const nextMessage = command.message ?? schedule.message;
    const nextName = command.name ?? schedule.name;
    if (nextName.length < 1 || nextName.length > 512) {
      invalid("name cannot be empty or exceed 512 characters");
    }
    if (nextMessage.length < 1) invalid("message cannot be empty");
    if (Buffer.byteLength(nextMessage, "utf8") > 8 * 1_024) {
      throw new TimerApplicationErrorV1(
        "payload_too_large",
        "timer message exceeds 8 KiB",
      );
    }
    const nextPayload =
      command.payload === undefined ? schedule.payload : assertPayload(command.payload);
    const nextEndTime =
      command.end_time === undefined
        ? schedule.end_time
        : iso(parseInstant(command.end_time, "end_time"));
    if (
      nextEndTime !== null &&
      [...state.occurrences.values()].some(
        (occurrence) =>
          occurrence.schedule_id === schedule.id &&
          occurrence.schedule_version === schedule.schedule_version &&
          !terminalOccurrenceStatuses.has(occurrence.status) &&
          Date.parse(occurrence.scheduled_fire_at) > Date.parse(nextEndTime),
      )
    ) {
      invalid("end_time cannot exclude an existing non-terminal occurrence");
    }
    let nextFireAt = schedule.next_fire_at;
    let fireAt = schedule.fire_at;
    let rrule = schedule.rrule;
    if (timeRuleChanged) {
      if (nextKind === "once") {
        if (command.rrule !== undefined) {
          invalid("once timer cannot carry rrule");
        }
        const requestedFireAt =
          command.fire_at ??
          (schedule.kind === "once" ? schedule.fire_at : undefined);
        const next = parseInstant(requestedFireAt, "fire_at");
        if (next.getTime() <= now.getTime()) invalid("fire_at must be in the future");
        fireAt = iso(next);
        rrule = null;
        nextFireAt = iso(next);
      } else {
        if (command.fire_at !== undefined) {
          invalid("recurring timer cannot carry fire_at");
        }
        const requestedRrule =
          command.rrule ??
          (schedule.kind === "recurring" ? schedule.rrule : undefined);
        if (typeof requestedRrule !== "string") {
          invalid("rrule is required when changing to recurring");
        }
        const anchor = localTuple(
          new Date(schedule.created_at),
          nextTimezone,
        );
        const next = nextRecurringInstant(
          requestedRrule,
          nextTimezone,
          now,
          anchor.local_date,
        );
        fireAt = null;
        rrule = requestedRrule;
        nextFireAt = iso(next.instant);
      }
    }
    const oldVersion = schedule.schedule_version;
    schedule.schedule_version = nextSafeCounterV1(schedule.schedule_version, "schedule version");
    schedule.name = nextName;
    schedule.kind = nextKind;
    schedule.timezone = nextTimezone;
    schedule.message = nextMessage;
    schedule.payload = nextPayload;
    schedule.end_time = nextEndTime;
    schedule.catch_up = command.catch_up ?? schedule.catch_up;
    schedule.fire_at = fireAt;
    schedule.rrule = rrule;
    schedule.next_fire_at = nextFireAt;
    if (
      schedule.end_time !== null &&
      schedule.next_fire_at !== null &&
      Date.parse(schedule.end_time) < Date.parse(schedule.next_fire_at)
    ) {
      invalid("end_time cannot precede next_fire_at");
    }
    schedule.updated_at = iso(now);

    for (const occurrence of state.occurrences.values()) {
      if (
        occurrence.schedule_id !== schedule.id ||
        occurrence.schedule_version !== oldVersion ||
        occurrence.status === "dispatching" ||
        terminalOccurrenceStatuses.has(occurrence.status)
      ) {
        continue;
      }
      if (isCommitUnknownReplayV1(occurrence)) {
        // A schedule edit cannot rewrite the payload/dedupe identity of an
        // outbound call whose TP commit result is still unknown.
        continue;
      }
      if (timeRuleChanged) {
        occurrence.status = "cancelled";
        occurrence.next_retry_at = null;
        occurrence.claim_token = null;
        occurrence.locked_by = null;
        occurrence.locked_until = null;
      } else {
        rebindOccurrenceVersion(state, occurrence, schedule.schedule_version);
        occurrence.message = nextMessage;
        occurrence.payload = nextPayload;
        occurrence.schedule_end_time = nextEndTime;
      }
      occurrence.occurrence_version = nextSafeCounterV1(occurrence.occurrence_version, "occurrence version");
      occurrence.updated_at = iso(now);
    }
    return scheduleResponse("timer_schedule_updated", command, schedule, null);
  }

  private pauseSchedule(
    state: TimerStateV1,
    command: TimerCommandV1,
    now: Date,
  ): TimerCommandResponseV1 {
    const schedule = commandSchedule(state, command);
    assertExpectedScheduleVersion(schedule, command.expected_schedule_version);
    if (schedule.status !== "active") {
      throw new TimerApplicationErrorV1(
        "invalid_state",
        "only an active schedule can be paused",
      );
    }
    const oldVersion = schedule.schedule_version;
    schedule.status = "paused";
    schedule.schedule_version = nextSafeCounterV1(schedule.schedule_version, "schedule version");
    schedule.updated_at = iso(now);
    for (const occurrence of state.occurrences.values()) {
      if (
        occurrence.schedule_id === schedule.id &&
        occurrence.schedule_version === oldVersion &&
        (occurrence.status === "pending" ||
          occurrence.status === "retry_wait") &&
        !isCommitUnknownReplayV1(occurrence)
      ) {
        rebindOccurrenceVersion(state, occurrence, schedule.schedule_version);
        occurrence.occurrence_version = nextSafeCounterV1(occurrence.occurrence_version, "occurrence version");
        occurrence.updated_at = iso(now);
      }
    }
    return scheduleResponse("timer_schedule_paused", command, schedule, null);
  }

  private resumeSchedule(
    state: TimerStateV1,
    command: TimerCommandV1,
    now: Date,
  ): TimerCommandResponseV1 {
    const schedule = commandSchedule(state, command);
    assertExpectedScheduleVersion(schedule, command.expected_schedule_version);
    if (schedule.status !== "paused") {
      throw new TimerApplicationErrorV1(
        "invalid_state",
        "only a paused schedule can be resumed",
      );
    }
    const oldVersion = schedule.schedule_version;
    schedule.status = "active";
    schedule.schedule_version = nextSafeCounterV1(schedule.schedule_version, "schedule version");
    schedule.updated_at = iso(now);
    let resumedOccurrence: MutableTimerOccurrenceV1 | null = null;
    const pending = [...state.occurrences.values()].filter(
      (occurrence) =>
        occurrence.schedule_id === schedule.id &&
        occurrence.schedule_version === oldVersion &&
        (occurrence.status === "pending" || occurrence.status === "retry_wait") &&
        !isCommitUnknownReplayV1(occurrence),
    );
    if (
      schedule.next_fire_at !== null &&
      Date.parse(schedule.next_fire_at) <= now.getTime()
    ) {
      if (schedule.kind === "recurring") {
        for (const occurrence of pending) {
          occurrence.status = "skipped";
          occurrence.next_retry_at = null;
          occurrence.dispatch_error_class = "non_retryable_cancelled";
          occurrence.occurrence_version = nextSafeCounterV1(occurrence.occurrence_version, "occurrence version");
          occurrence.updated_at = iso(now);
        }
        const anchor = localTuple(new Date(schedule.created_at), schedule.timezone);
        const next = nextRecurringInstant(
          schedule.rrule as string,
          schedule.timezone,
          now,
          anchor.local_date,
        );
        if (
          schedule.end_time !== null &&
          next.instant.getTime() > Date.parse(schedule.end_time)
        ) {
          throw new TimerApplicationErrorV1(
            "invalid_state",
            "schedule end_time has elapsed",
          );
        }
        schedule.next_fire_at = iso(next.instant);
      } else {
        const alreadyAdvanced = [...state.occurrences.values()].some(
          (occurrence) =>
            occurrence.schedule_id === schedule.id &&
            occurrence.schedule_version === oldVersion &&
            terminalOccurrenceStatuses.has(occurrence.status),
        );
        if (!alreadyAdvanced) {
          const existing = pending[0];
          if (existing !== undefined) {
            rebindOccurrenceVersion(state, existing, schedule.schedule_version);
            existing.effective_fire_at = iso(now);
            existing.occurrence_version = nextSafeCounterV1(existing.occurrence_version, "occurrence version");
            existing.updated_at = iso(now);
            resumedOccurrence = existing;
          } else {
            resumedOccurrence = createOccurrence(
              state,
              schedule,
              new Date(schedule.fire_at as string),
              now,
              { now },
            );
          }
        }
      }
    } else {
      for (const occurrence of pending) {
        rebindOccurrenceVersion(state, occurrence, schedule.schedule_version);
        occurrence.occurrence_version = nextSafeCounterV1(occurrence.occurrence_version, "occurrence version");
        occurrence.updated_at = iso(now);
      }
    }
    return scheduleResponse(
      "timer_schedule_resumed",
      command,
      schedule,
      resumedOccurrence,
    );
  }

  private cancelSchedule(
    state: TimerStateV1,
    command: TimerCommandV1,
    now: Date,
  ): TimerCommandResponseV1 {
    const schedule = commandSchedule(state, command);
    assertExpectedScheduleVersion(schedule, command.expected_schedule_version);
    if (terminalScheduleStatuses.has(schedule.status)) {
      throw new TimerApplicationErrorV1(
        "invalid_state",
        "terminal schedule cannot be cancelled",
      );
    }
    schedule.status = "cancelled";
    schedule.schedule_version = nextSafeCounterV1(schedule.schedule_version, "schedule version");
    schedule.next_fire_at = null;
    schedule.updated_at = iso(now);
    for (const occurrence of state.occurrences.values()) {
      if (occurrence.schedule_id !== schedule.id) continue;
      if (
        occurrence.status === "retry_wait" &&
        occurrence.dispatch_commit_outcome_unknown
      ) {
        // The prior TP call may already have committed. Cancellation cannot
        // erase that ambiguity; retain the exact dedupe replay work until TP
        // proves whether the occurrence was accepted or rejected.
        occurrence.cancel_requested_at = iso(now);
        occurrence.occurrence_version = nextSafeCounterV1(
          occurrence.occurrence_version,
          "occurrence version",
        );
        occurrence.updated_at = iso(now);
        continue;
      }
      if (
        occurrence.status === "pending" ||
        occurrence.status === "retry_wait"
      ) {
        occurrence.status = "cancelled";
        occurrence.next_retry_at = null;
        occurrence.claim_token = null;
        occurrence.locked_by = null;
        occurrence.locked_until = null;
        occurrence.occurrence_version = nextSafeCounterV1(occurrence.occurrence_version, "occurrence version");
        occurrence.updated_at = iso(now);
      } else if (occurrence.status === "dispatching") {
        occurrence.cancel_requested_at = iso(now);
        occurrence.updated_at = iso(now);
      }
    }
    return scheduleResponse("timer_schedule_cancelled", command, schedule, null);
  }

  private snoozeOccurrence(
    state: TimerStateV1,
    command: TimerCommandV1,
    now: Date,
  ): TimerCommandResponseV1 {
    const schedule = commandSchedule(state, command);
    assertExpectedScheduleVersion(schedule, command.expected_schedule_version);
    assertIdentifier(command.occurrence_id, "occurrence_id");
    const occurrence = state.occurrences.get(command.occurrence_id);
    if (
      occurrence === undefined ||
      !sameScope(occurrence.scope, command.scope) ||
      occurrence.schedule_id !== schedule.id
    ) {
      throw new TimerApplicationErrorV1(
        "occurrence_not_found",
        "timer occurrence was not found",
      );
    }
    assertSafePositiveInteger(
      command.expected_occurrence_version,
      "expected_occurrence_version",
    );
    if (
      occurrence.occurrence_version !== command.expected_occurrence_version
    ) {
      throw new TimerApplicationErrorV1(
        "version_conflict",
        "occurrence version no longer matches",
      );
    }
    const nextPending = [...state.occurrences.values()]
      .filter(
        (candidate) =>
          candidate.schedule_id === schedule.id &&
          candidate.status === "pending",
      )
      .sort(
        (left, right) =>
          Date.parse(left.effective_fire_at) -
            Date.parse(right.effective_fire_at) ||
          left.id.localeCompare(right.id),
      )[0];
    if (nextPending?.id !== occurrence.id) {
      throw new TimerApplicationErrorV1(
        "invalid_state",
        "only the next pending occurrence can be snoozed",
      );
    }
    const snoozeUntil = parseInstant(command.snooze_until, "snooze_until");
    if (
      snoozeUntil.getTime() <= now.getTime() ||
      snoozeUntil.getTime() <= Date.parse(occurrence.effective_fire_at)
    ) {
      invalid("snooze_until must be later than the current effective fire time");
    }
    occurrence.effective_fire_at = iso(snoozeUntil);
    occurrence.occurrence_version = nextSafeCounterV1(occurrence.occurrence_version, "occurrence version");
    occurrence.updated_at = iso(now);
    return scheduleResponse(
      "timer_occurrence_snoozed",
      command,
      schedule,
      occurrence,
    );
  }

  public async query(
    principal: TimerPrincipalV1,
    query: TimerQueryV1,
  ): Promise<TimerQueryResponseV1> {
    query = ownJsonValue(query) as TimerQueryV1;
    assertQueryEnvelope(principal, query);
    return this.repository.transact((state) => {
      if (query.method === "timer.list") {
        const limit = query.limit ?? 50;
        assertSafePositiveInteger(limit, "limit", 100);
        const schedules = [...state.schedules.values()]
          .filter(
            (schedule) =>
              sameScope(schedule.scope, query.scope) &&
              (query.status === undefined || schedule.status === query.status) &&
              (query.cursor === undefined || schedule.id > query.cursor),
          )
          .sort((left, right) => left.id.localeCompare(right.id))
          .slice(0, limit + 1);
        const hasMore = schedules.length > limit;
        const page = schedules.slice(0, limit);
        return Object.freeze({
          code: "timer_schedules_found",
          trace_id: query.trace_id,
          schedules: Object.freeze(page.map(snapshotSchedule)),
          next_cursor:
            hasMore && page.length > 0 ? page[page.length - 1]?.id ?? null : null,
        });
      }
      assertIdentifier(query.schedule_id, "schedule_id");
      const schedule = state.schedules.get(query.schedule_id);
      if (schedule === undefined || !sameScope(schedule.scope, query.scope)) {
        throw new TimerApplicationErrorV1(
          "schedule_not_found",
          "timer schedule was not found",
        );
      }
      if (query.method === "timer.get") {
        return Object.freeze({
          code: "timer_schedule_found",
          trace_id: query.trace_id,
          schedule: snapshotSchedule(schedule),
        });
      }
      const limit = query.limit ?? 100;
      assertSafePositiveInteger(limit, "limit", 100);
      const cursor = parseTimerHistoryCursorV1(query.cursor);
      const occurrences = [...state.occurrences.values()]
        .filter(
          (occurrence) =>
            occurrence.schedule_id === schedule.id &&
            sameScope(occurrence.scope, query.scope) &&
            (cursor === null ||
              occurrence.scheduled_fire_at > cursor[0] ||
              (occurrence.scheduled_fire_at === cursor[0] &&
                occurrence.id > cursor[1])),
        )
        .sort(
          (left, right) =>
            Date.parse(left.scheduled_fire_at) -
              Date.parse(right.scheduled_fire_at) ||
            left.id.localeCompare(right.id),
        )
        .slice(0, limit + 1);
      const hasMore = occurrences.length > limit;
      const page = occurrences.slice(0, limit);
      return Object.freeze({
        code: "timer_history_found",
        trace_id: query.trace_id,
        schedule: snapshotSchedule(schedule),
        occurrences: Object.freeze(page.map(snapshotOccurrence)),
        next_cursor:
          hasMore && page.length > 0
            ? timerHistoryCursorV1(page[page.length - 1]!)
            : null,
      });
    });
  }

  public async scanDue(
    principal: TimerPrincipalV1,
    request: TimerScanRequestV1,
  ): Promise<readonly TimerOccurrenceV1[]> {
    request = ownJsonValue(request) as TimerScanRequestV1;
    assertWorker(principal, "timer.worker.scan", request.scope);
    assertIdentifier(request.worker_id, "worker_id");
    assertIdentifier(request.checkpoint_id, "checkpoint_id");
    const now =
      request.now === undefined
        ? snapshotInstantV1(this.#clock(), "clock")
        : parseInstant(request.now, "now");
    const limit = request.limit ?? 100;
    assertSafePositiveInteger(limit, "limit", 100);
    return this.repository.transact((state) => {
      const due = [...state.schedules.values()]
        .filter(
          (schedule) =>
            sameScope(schedule.scope, request.scope) &&
            schedule.status === "active" &&
            schedule.next_fire_at !== null &&
            Date.parse(schedule.next_fire_at) <= now.getTime(),
        )
        .sort(
          (left, right) =>
            Date.parse(left.next_fire_at as string) -
              Date.parse(right.next_fire_at as string) ||
            left.id.localeCompare(right.id),
        )
        .slice(0, limit);
      const dispatchable: MutableTimerOccurrenceV1[] = [];
      const automaticCatchUp: Array<
        Readonly<{
          occurrence: MutableTimerOccurrenceV1;
          schedule: MutableTimerScheduleV1;
          summary: string;
        }>
      > = [];
      const runningCatchUpBatch = [...state.batches.values()].some(
        (batch) =>
          batch.status === "running" &&
          sameScope(batch.scope, request.scope),
      );
      for (const schedule of due) {
        const scheduled = new Date(schedule.next_fire_at as string);
        if (schedule.kind === "once") {
          const existing = [...state.occurrences.values()].find(
            (occurrence) =>
              occurrence.schedule_id === schedule.id &&
              occurrence.schedule_version === schedule.schedule_version &&
              occurrence.scheduled_fire_at === iso(scheduled),
          );
          if (existing !== undefined) {
            if (terminalOccurrenceStatuses.has(existing.status)) {
              schedule.next_fire_at = null;
              expireScheduleWithoutOutstandingOccurrenceV1(
                state,
                schedule,
                now,
              );
            }
            continue;
          }
        }
        if (scheduled.getTime() === now.getTime()) {
          const occurrence = createOccurrence(
            state,
            schedule,
            scheduled,
            scheduled,
            {
              dst_shifted: recurrenceWasDstShiftedV1(schedule, scheduled),
              now,
            },
          );
          dispatchable.push(occurrence);
          const next = nextScheduleInstantAfterV1(schedule, scheduled);
          schedule.next_fire_at = nextFireAtPreservingOutstandingOnceV1(
            state,
            schedule,
            next,
          );
          schedule.updated_at = iso(now);
          continue;
        }

        if (!schedule.catch_up) {
          createSkippedMissedOccurrenceV1(
            state,
            schedule,
            scheduled,
            now,
          );
          let next =
            schedule.kind === "recurring"
              ? nextScheduleInstantAfterV1(
                  schedule,
                  new Date(now.getTime() - 1),
                )
              : null;
          if (next?.getTime() === now.getTime()) {
            const occurrence = createOccurrence(
              state,
              schedule,
              next,
              next,
              {
                dst_shifted: recurrenceWasDstShiftedV1(schedule, next),
                now,
              },
            );
            dispatchable.push(occurrence);
            next = nextScheduleInstantAfterV1(schedule, next);
          }
          schedule.next_fire_at = nextFireAtPreservingOutstandingOnceV1(
            state,
            schedule,
            next,
          );
          schedule.updated_at = iso(now);
          expireScheduleWithoutOutstandingOccurrenceV1(
            state,
            schedule,
            now,
          );
          continue;
        }

        // A scope has one durable serial catch-up lane. Do not create an
        // ungated occurrence while a previous batch is still running.
        if (runningCatchUpBatch) continue;

        const windowStart = new Date(
          now.getTime() -
            schedule.max_catch_up_window_seconds * 1_000,
        );
        let cursor: Date | null = scheduled;
        let outsideWindowMissed: Date | null = null;
        if (cursor.getTime() < windowStart.getTime()) {
          outsideWindowMissed = cursor;
          cursor =
            schedule.kind === "recurring"
              ? nextScheduleInstantAfterV1(
                  schedule,
                  new Date(windowStart.getTime() - 1),
                )
              : null;
        }
        const eligible: Date[] = [];
        while (cursor !== null && cursor.getTime() < now.getTime()) {
          eligible.push(cursor);
          if (eligible.length > 1_000) {
            throw new TimerApplicationErrorV1(
              "invalid_state",
              "catch-up recurrence exceeded its bounded policy window",
            );
          }
          cursor =
            schedule.kind === "recurring"
              ? nextScheduleInstantAfterV1(schedule, cursor)
              : null;
        }
        const hasCurrentDue = cursor?.getTime() === now.getTime();
        const selectedCount = Math.min(
          eligible.length,
          schedule.max_catch_up_occurrences,
        );
        if (
          selectedCount > 0 &&
          selectedCount > 1_000 - automaticCatchUp.length
        ) {
          // The durable batch contract is bounded to 1000 entries. Leave this
          // whole schedule untouched for the next batch instead of silently
          // dropping occurrences because of a scanner page-size limit.
          continue;
        }
        if (outsideWindowMissed !== null) {
          createSkippedMissedOccurrenceV1(
            state,
            schedule,
            outsideWindowMissed,
            now,
          );
        }
        const selected = eligible.slice(eligible.length - selectedCount);
        const skippedByPolicy = eligible.slice(
          0,
          eligible.length - selectedCount,
        );
        for (const missed of skippedByPolicy) {
          createSkippedMissedOccurrenceV1(
            state,
            schedule,
            missed,
            now,
          );
        }
        const summary =
          `${eligible.length} missed timer occurrence(s); ` +
          `${selected.length} selected by schedule catch-up policy`;
        for (const missed of selected) {
          const occurrence = createOccurrence(
            state,
            schedule,
            missed,
            now,
            {
              is_catch_up: true,
              // The final deterministic batch id is attached below before
              // this transaction can become visible to a claim worker.
              catch_up_batch_id: "catchup_pending",
              missed_window_summary: summary,
              dst_shifted: recurrenceWasDstShiftedV1(schedule, missed),
              now,
            },
          );
          automaticCatchUp.push({ occurrence, schedule, summary });
          dispatchable.push(occurrence);
        }
        if (hasCurrentDue && cursor !== null) {
          const occurrence = createOccurrence(
            state,
            schedule,
            cursor,
            cursor,
            {
              dst_shifted: recurrenceWasDstShiftedV1(schedule, cursor),
              now,
            },
          );
          dispatchable.push(occurrence);
          cursor = nextScheduleInstantAfterV1(schedule, cursor);
        }
        schedule.next_fire_at = nextFireAtPreservingOutstandingOnceV1(
          state,
          schedule,
          cursor,
        );
        schedule.updated_at = iso(now);
        expireScheduleWithoutOutstandingOccurrenceV1(
          state,
          schedule,
          now,
        );
      }

      if (automaticCatchUp.length > 0) {
        automaticCatchUp.sort(
          (left, right) =>
            Date.parse(left.occurrence.scheduled_fire_at) -
              Date.parse(right.occurrence.scheduled_fire_at) ||
            left.occurrence.id.localeCompare(right.occurrence.id),
        );
        const occurrenceIds = automaticCatchUp.map(
          ({ occurrence }) => occurrence.id,
        );
        const schedules = [
          ...new Map(
            automaticCatchUp.map(({ schedule }) => [schedule.id, schedule]),
          ).values(),
        ];
        const batchId = `catchup_${digestBase64Url(
          canonicalJsonV1({
            scope: request.scope,
            occurrence_ids: occurrenceIds,
            started_at: iso(now),
          }),
        ).slice(0, 32)}`;
        for (const entry of automaticCatchUp) {
          entry.occurrence.catch_up_batch_id = batchId;
          entry.occurrence.missed_window_summary = entry.summary;
        }
        const policySnapshot: TimerCatchUpPolicySnapshotV1 = Object.freeze({
          catch_up_timeout_seconds: 300,
          max_catch_up_window_seconds: Math.max(
            ...schedules.map(
              (schedule) => schedule.max_catch_up_window_seconds,
            ),
          ),
          max_catch_up_occurrences: Math.max(
            automaticCatchUp.length,
            Math.min(
              1_000,
              schedules.reduce(
                (sum, schedule) =>
                  sum + schedule.max_catch_up_occurrences,
                0,
              ),
            ),
          ),
          catch_up_continue_after_failed: true,
          config_revision: `timer_scan_${digestBase64Url(
            canonicalJsonV1(
              schedules.map((schedule) => ({
                schedule_id: schedule.id,
                schedule_version: schedule.schedule_version,
                max_catch_up_window_seconds:
                  schedule.max_catch_up_window_seconds,
                max_catch_up_occurrences:
                  schedule.max_catch_up_occurrences,
              })),
            ),
          ).slice(0, 32)}`,
        });
        state.batches.set(batchId, {
          id: batchId,
          scope: snapshotScope(request.scope),
          status: "running",
          occurrence_ids: occurrenceIds,
          cursor_occurrence_id: null,
          last_occurrence_id: null,
          last_trigger_process_id: null,
          timeout_seconds: policySnapshot.catch_up_timeout_seconds,
          deadline_at: iso(
            new Date(
              now.getTime() +
                policySnapshot.catch_up_timeout_seconds * 1_000,
            ),
          ),
          policy_snapshot: policySnapshot,
          reason: null,
          started_at: iso(now),
          created_at: iso(now),
          updated_at: iso(now),
          completed_at: null,
        });
      }
      state.scannerCheckpoints.set(
        `${scopeKey(request.scope)}\u001f${request.checkpoint_id}`,
        iso(now),
      );
      dispatchable.sort(
        (left, right) =>
          Date.parse(left.scheduled_fire_at) -
            Date.parse(right.scheduled_fire_at) ||
          left.id.localeCompare(right.id),
      );
      return Object.freeze(
        dispatchable.slice(0, limit).map(snapshotOccurrence),
      );
    });
  }

  public async claimOccurrence(
    principal: TimerPrincipalV1,
    request: TimerClaimRequestV1,
  ): Promise<TimerClaimV1> {
    request = ownJsonValue(request) as TimerClaimRequestV1;
    assertWorker(principal, "timer.worker.dispatch", request.scope);
    assertIdentifier(request.occurrence_id, "occurrence_id");
    assertIdentifier(request.worker_id, "worker_id");
    assertSafePositiveInteger(
      request.expected_occurrence_version,
      "expected_occurrence_version",
    );
    assertSafePositiveInteger(
      request.expected_schedule_version,
      "expected_schedule_version",
    );
    if (
      !["pending", "retry_wait", "dispatching"].includes(
        request.expected_status,
      )
    ) {
      invalid("expected_status is not claimable");
    }
    const leaseSeconds = request.lease_seconds ?? 30;
    assertSafePositiveInteger(leaseSeconds, "lease_seconds", 300);
    const now =
      request.now === undefined
        ? snapshotInstantV1(this.#clock(), "clock")
        : parseInstant(request.now, "now");
    return this.repository.transact((state) => {
      const occurrence = state.occurrences.get(request.occurrence_id);
      if (
        occurrence === undefined ||
        !sameScope(occurrence.scope, request.scope)
      ) {
        throw new TimerApplicationErrorV1(
          "occurrence_not_found",
          "timer occurrence was not found",
        );
      }
      const schedule = state.schedules.get(occurrence.schedule_id);
      const resolvingCommitUnknown =
        isCommitUnknownReplayV1(occurrence);
      if (
        occurrence.occurrence_version !==
          request.expected_occurrence_version ||
        occurrence.schedule_version !== request.expected_schedule_version ||
        occurrence.status !== request.expected_status
      ) {
        throw new TimerApplicationErrorV1(
          "claim_conflict",
          "occurrence claim precondition no longer matches",
        );
      }
      if (
        occurrence.catch_up_batch_id !== null &&
        !resolvingCommitUnknown
      ) {
        const batch = state.batches.get(occurrence.catch_up_batch_id);
        const anotherDispatching = batch?.occurrence_ids.some((id) => {
          if (id === occurrence.id) return false;
          return state.occurrences.get(id)?.status === "dispatching";
        });
        if (
          batch === undefined ||
          batch.status !== "running" ||
          Date.parse(batch.deadline_at) <= now.getTime() ||
          batch.cursor_occurrence_id !== occurrence.id ||
          anotherDispatching === true
        ) {
          throw new TimerApplicationErrorV1(
            "claim_conflict",
            "catch-up occurrence has not been serially released",
          );
        }
      }
      const leaseExpired =
        occurrence.status === "dispatching" &&
        occurrence.locked_until !== null &&
        Date.parse(occurrence.locked_until) <= now.getTime();
      const dueForRetry =
        occurrence.status !== "retry_wait" ||
        (occurrence.next_retry_at !== null &&
          Date.parse(occurrence.next_retry_at) <= now.getTime());
      if (
        schedule === undefined ||
        (schedule.status !== "active" &&
          !resolvingCommitUnknown) ||
        (occurrence.schedule_version !== schedule.schedule_version &&
          !resolvingCommitUnknown) ||
        (!["pending", "retry_wait"].includes(occurrence.status) &&
          !leaseExpired) ||
        !dueForRetry ||
        Date.parse(occurrence.effective_fire_at) > now.getTime()
      ) {
        throw new TimerApplicationErrorV1(
          "claim_conflict",
          "occurrence is not claimable",
        );
      }
      const previousStatus = occurrence.status;
      occurrence.status = "dispatching";
      occurrence.occurrence_version = nextSafeCounterV1(occurrence.occurrence_version, "occurrence version");
      occurrence.dispatch_generation = nextSafeCounterV1(occurrence.dispatch_generation, "dispatch generation");
      occurrence.claim_token = randomUUID();
      occurrence.locked_by = request.worker_id;
      occurrence.locked_until = iso(
        new Date(now.getTime() + leaseSeconds * 1_000),
      );
      occurrence.next_retry_at = null;
      occurrence.updated_at = iso(now);
      return Object.freeze({
        occurrence: snapshotOccurrence(occurrence),
        previous_status: previousStatus,
        claim_token: occurrence.claim_token,
        dispatch_generation: occurrence.dispatch_generation,
        occurrence_version: occurrence.occurrence_version,
      });
    });
  }

  public async dispatchOccurrence(
    principal: TimerPrincipalV1,
    request: TimerDispatchRequestV1,
  ): Promise<TimerOccurrenceV1> {
    request = ownJsonValue(request) as TimerDispatchRequestV1;
    assertWorker(principal, "timer.worker.dispatch", request.scope);
    assertIdentifier(request.occurrence_id, "occurrence_id");
    assertIdentifier(request.claim_token, "claim_token");
    assertIdentifier(request.trace_id, "trace_id");
    assertSafePositiveInteger(
      request.expected_occurrence_version,
      "expected_occurrence_version",
    );
    assertSafePositiveInteger(
      request.dispatch_generation,
      "dispatch_generation",
    );
    const deterministicNow =
      request.now === undefined ? null : parseInstant(request.now, "now");
    const startedAt =
      deterministicNow ?? snapshotInstantV1(this.#clock(), "clock");
    const frozen = await this.repository.transact((state) => {
      const occurrence = this.exactClaimedOccurrence(
        state,
        request,
        startedAt,
      );
      return snapshotOccurrence(occurrence);
    });
    const submit: TimerTriggerSubmitRequestV1 = {
      workspace_id: frozen.scope.workspace_id,
      bot_id: frozen.scope.bot_id,
      owner_agent_id: frozen.scope.owner_agent_id,
      deployment_environment: frozen.scope.deployment_environment,
      release_channel: frozen.scope.release_channel,
      source: "timer",
      actor_type: "system",
      actor_id: "timer_app",
      payload: {
        workspace_id: frozen.scope.workspace_id,
        bot_id: frozen.scope.bot_id,
        owner_agent_id: frozen.scope.owner_agent_id,
        deployment_environment: frozen.scope.deployment_environment,
        release_channel: frozen.scope.release_channel,
        schedule_id: frozen.schedule_id,
        schedule_version: frozen.schedule_version,
        occurrence_id: frozen.id,
        local_date: frozen.local_date,
        local_time: frozen.local_time,
        timezone: frozen.timezone,
        scheduled_for: frozen.scheduled_fire_at,
        occurrence_key: frozen.occurrence_key,
        message: frozen.message,
        ...(Object.keys(frozen.payload).length === 0
          ? {}
          : {
              trigger_payload: {
                schema_version: "timer.trigger_payload.v1" as const,
                value: frozen.payload,
              },
            }),
        is_catch_up: frozen.is_catch_up,
        catch_up_batch_id: frozen.catch_up_batch_id,
        missed_window_summary: frozen.missed_window_summary,
      } as TimerTriggerSubmitRequestV1["payload"],
      dedupe_key: `timer:${frozen.occurrence_key}`,
    };
    if (request.owner_request !== undefined) {
      assertTimerDispatchRequestBindingsV1(
        request.owner_request,
        frozen.scope,
        startedAt,
      );
      const ownerRequest = request.owner_request;
      const frozenPayloadHash = `sha256:${digestHex(
        canonicalJsonV1(submit.payload),
      )}`;
      if (
        ownerRequest.schedule_id !== frozen.schedule_id ||
        ownerRequest.schedule_version !== frozen.schedule_version ||
        ownerRequest.occurrence_id !== frozen.id ||
        ownerRequest.occurrence_version !== frozen.occurrence_version ||
        ownerRequest.occurrence_key !== frozen.occurrence_key ||
        ownerRequest.scheduled_fire_at !== frozen.scheduled_fire_at ||
        ownerRequest.effective_fire_at !== frozen.effective_fire_at ||
        ownerRequest.local_date !== frozen.local_date ||
        ownerRequest.local_time !== frozen.local_time ||
        ownerRequest.timezone !== frozen.timezone ||
        ownerRequest.locked_until !== frozen.locked_until ||
        ownerRequest.dispatch_payload_hash !== frozenPayloadHash ||
        canonicalJsonV1(ownerRequest.dispatch_payload) !==
          canonicalJsonV1(submit.payload)
      ) {
        throw new TimerApplicationErrorV1(
          "claim_conflict",
          "dispatch request drifted from the claimed occurrence snapshot",
        );
      }
    }
    let responseValue: unknown;
    try {
      responseValue = await this.triggerProcessor.submit(
        submit,
        request.trace_id,
      );
    } catch (error) {
      const completedAt =
        deterministicNow ?? snapshotInstantV1(this.#clock(), "clock");
      return this.finishDispatchFailure(
        request,
        completedAt,
        error instanceof TimerDownstreamErrorV1
          ? error.classification
          : "retryable_transient",
        null,
        !(error instanceof TimerDownstreamErrorV1),
      );
    }
    const response = snapshotTriggerSubmitResponseV1(
      responseValue,
      request.trace_id,
      frozen.is_catch_up,
    );
    const classification: TimerDispatchClassificationV1 =
      response.code === "duplicate_replayed"
        ? "idempotency_replayed"
        : response.code === "trigger_accepted"
          ? "retryable_transient"
          : "downstream_rejected";
    if (
      response.code !== "trigger_accepted" &&
      response.code !== "duplicate_replayed"
    ) {
      const completedAt =
        deterministicNow ?? snapshotInstantV1(this.#clock(), "clock");
      return this.finishDispatchFailure(
        request,
        completedAt,
        classification,
        response.details.trigger_process_id,
      );
    }
    const processId = response.details.trigger_process_id;
    if (processId === null) {
      const completedAt =
        deterministicNow ?? snapshotInstantV1(this.#clock(), "clock");
      return this.finishDispatchFailure(
        request,
        completedAt,
        "downstream_rejected",
        null,
      );
    }
    const processReadStartedAt =
      deterministicNow ?? snapshotInstantV1(this.#clock(), "clock");
    // Do not perform an additional downstream read for a claim that already
    // expired or changed while submit was in flight. The same exact predicate
    // is checked again when the owner transition commits below.
    await this.repository.transact((state) => {
      this.exactClaimedOccurrence(state, request, processReadStartedAt);
    });
    const process = await this.triggerProcessor.getProcess(
      processId,
      request.scope,
      request.trace_id,
    );
    snapshotSubmittedProcessProjectionV1(
      process,
      processId,
      response.details.trigger_id,
      request.scope,
    );
    const completedAt =
      deterministicNow ?? snapshotInstantV1(this.#clock(), "clock");
    return this.repository.transact((state) => {
      const occurrence = this.exactClaimedOccurrence(
        state,
        request,
        completedAt,
      );
      occurrence.status = "dispatched";
      occurrence.attempt_count = nextSafeCounterV1(
        occurrence.attempt_count,
        "dispatch attempt count",
      );
      occurrence.trigger_id = response.details.trigger_id;
      occurrence.trigger_process_id = processId;
      occurrence.dispatch_error_class =
        response.code === "duplicate_replayed"
          ? "idempotency_replayed"
          : null;
      occurrence.dispatch_commit_outcome_unknown = false;
      occurrence.claim_token = null;
      occurrence.locked_by = null;
      occurrence.locked_until = null;
      occurrence.occurrence_version = nextSafeCounterV1(
        occurrence.occurrence_version,
        "occurrence version",
      );
      occurrence.updated_at = iso(completedAt);
      state.dispatchAttempts.push({
        occurrence_id: occurrence.id,
        attempt_no: occurrence.attempt_count,
        dispatch_generation: request.dispatch_generation,
        classification:
          response.code === "duplicate_replayed"
            ? "idempotency_replayed"
            : "accepted",
        commit_outcome_unknown: false,
        trigger_process_id: processId,
        created_at: iso(completedAt),
      });
      if (occurrence.catch_up_batch_id !== null) {
        const batch = state.batches.get(occurrence.catch_up_batch_id);
        if (batch !== undefined && batch.status === "running") {
          batch.last_occurrence_id = occurrence.id;
          batch.last_trigger_process_id = processId;
          batch.cursor_occurrence_id = occurrence.id;
          batch.updated_at = iso(completedAt);
        }
      }
      const schedule = state.schedules.get(occurrence.schedule_id);
      if (
        schedule !== undefined &&
        schedule.status === "active" &&
        schedule.schedule_version === occurrence.schedule_version
      ) {
        expireScheduleWithoutOutstandingOccurrenceV1(
          state,
          schedule,
          completedAt,
        );
      }
      return snapshotOccurrence(occurrence);
    });
  }

  private exactClaimedOccurrence(
    state: TimerStateV1,
    request: TimerDispatchRequestV1,
    now: Date,
  ): MutableTimerOccurrenceV1 {
    const occurrence = state.occurrences.get(request.occurrence_id);
    if (
      occurrence === undefined ||
      !sameScope(occurrence.scope, request.scope)
    ) {
      throw new TimerApplicationErrorV1(
        "occurrence_not_found",
        "timer occurrence was not found",
      );
    }
    if (
      occurrence.status !== "dispatching" ||
      occurrence.occurrence_version !== request.expected_occurrence_version ||
      occurrence.dispatch_generation !== request.dispatch_generation ||
      occurrence.claim_token !== request.claim_token ||
      occurrence.locked_until === null ||
      Date.parse(occurrence.locked_until) <= now.getTime()
    ) {
      throw new TimerApplicationErrorV1(
        "claim_conflict",
        "dispatch claim is stale or expired",
      );
    }
    return occurrence;
  }

  private async finishDispatchFailure(
    request: TimerDispatchRequestV1,
    now: Date,
    classification: TimerDispatchClassificationV1,
    processId: string | null,
    commitOutcomeUnknown = false,
  ): Promise<TimerOccurrenceV1> {
    return this.repository.transact((state) => {
      const occurrence = this.exactClaimedOccurrence(state, request, now);
      const schedule = state.schedules.get(occurrence.schedule_id);
      const effectiveClassification =
        !commitOutcomeUnknown &&
        (schedule?.status === "cancelled" ||
          occurrence.cancel_requested_at !== null)
          ? "non_retryable_cancelled"
          : classification;
      occurrence.attempt_count = nextSafeCounterV1(occurrence.attempt_count, "dispatch attempt count");
      occurrence.trigger_id = null;
      occurrence.trigger_process_id = processId;
      occurrence.dispatch_error_class = effectiveClassification;
      occurrence.dispatch_commit_outcome_unknown = commitOutcomeUnknown;
      const retryable =
        effectiveClassification === "retryable_transient" ||
        effectiveClassification === "retryable_rate_limited";
      if (effectiveClassification === "non_retryable_cancelled") {
        occurrence.status = "cancelled";
        occurrence.next_retry_at = null;
      } else if (
        retryable &&
        (commitOutcomeUnknown ||
          occurrence.attempt_count < this.#maxDispatchAttempts)
      ) {
        const exponential = Math.min(
          this.#maxRetryDelayMs,
          this.#baseRetryDelayMs *
            2 ** Math.min(52, occurrence.attempt_count - 1),
        );
        const deterministicJitter =
          Number.parseInt(
            digestHex(
              `${occurrence.id}:${request.dispatch_generation}:${occurrence.attempt_count}`,
            ).slice(0, 8),
            16,
          ) %
          Math.max(1, Math.floor(exponential / 4));
        occurrence.status = "retry_wait";
        occurrence.next_retry_at = iso(
          new Date(now.getTime() + exponential + deterministicJitter),
        );
      } else {
        occurrence.status = "failed";
        occurrence.next_retry_at = null;
        state.dlq.push({
          occurrence_id: occurrence.id,
          dispatch_generation: request.dispatch_generation,
          classification: effectiveClassification,
          created_at: iso(now),
        });
        if (
          schedule !== undefined &&
          schedule.status === "active" &&
          schedule.schedule_version === occurrence.schedule_version &&
          (schedule.kind === "once" ||
            (schedule.kind === "recurring" &&
              schedule.next_fire_at === null)) &&
          ![...state.occurrences.values()].some(
            (candidate) =>
              candidate.id !== occurrence.id &&
              candidate.schedule_id === schedule.id &&
              candidate.schedule_version === schedule.schedule_version &&
              !terminalOccurrenceStatuses.has(candidate.status),
          )
        ) {
          schedule.status = "failed";
          schedule.next_fire_at = null;
          schedule.schedule_version = nextSafeCounterV1(schedule.schedule_version, "schedule version");
          schedule.updated_at = iso(now);
        }
      }
      occurrence.claim_token = null;
      occurrence.locked_by = null;
      occurrence.locked_until = null;
      occurrence.occurrence_version = nextSafeCounterV1(occurrence.occurrence_version, "occurrence version");
      occurrence.updated_at = iso(now);
      state.dispatchAttempts.push({
        occurrence_id: occurrence.id,
        attempt_no: occurrence.attempt_count,
        dispatch_generation: request.dispatch_generation,
        classification: effectiveClassification,
        commit_outcome_unknown: commitOutcomeUnknown,
        trigger_process_id: processId,
        created_at: iso(now),
      });
      return snapshotOccurrence(occurrence);
    });
  }

  public async createCatchUpBatch(
    principal: TimerPrincipalV1,
    request: TimerCatchUpCreateRequestV1,
  ): Promise<TimerCatchUpBatchV1> {
    request = ownJsonValue(request) as TimerCatchUpCreateRequestV1;
    assertWorker(principal, "timer.worker.catch_up", request.scope);
    assertIdentifier(request.trace_id, "trace_id");
    const timeout = request.timeout_seconds ?? 300;
    assertSafePositiveInteger(timeout, "timeout_seconds", 3_600);
    if (
      request.occurrence_ids.length < 1 ||
      request.occurrence_ids.length > 100
    ) {
      invalid("catch-up batch must contain 1 to 100 occurrences");
    }
    if (new Set(request.occurrence_ids).size !== request.occurrence_ids.length) {
      invalid("catch-up occurrence ids must be unique");
    }
    const now =
      request.now === undefined
        ? snapshotInstantV1(this.#clock(), "clock")
        : parseInstant(request.now, "now");
    return this.repository.transact((state) => {
      if (
        [...state.batches.values()].some(
          (batch) =>
            batch.status === "running" &&
            sameScope(batch.scope, request.scope),
        )
      ) {
        throw new TimerApplicationErrorV1(
          "catch_up_conflict",
          "a catch-up batch is already running for this scope",
        );
      }
      const entries = request.occurrence_ids.map((id) => {
        assertIdentifier(id, "occurrence_id");
        const occurrence = state.occurrences.get(id);
        const schedule =
          occurrence === undefined
            ? undefined
            : state.schedules.get(occurrence.schedule_id);
        if (
          occurrence === undefined ||
          !sameScope(occurrence.scope, request.scope) ||
          terminalOccurrenceStatuses.has(occurrence.status) ||
          occurrence.status === "dispatching" ||
          schedule === undefined ||
          schedule.status !== "active" ||
          !schedule.catch_up ||
          schedule.schedule_version !== occurrence.schedule_version ||
          occurrence.catch_up_batch_id !== null ||
          Date.parse(occurrence.effective_fire_at) > now.getTime()
        ) {
          throw new TimerApplicationErrorV1(
            "occurrence_not_found",
            "catch-up occurrence is unavailable",
          );
        }
        return { occurrence, schedule };
      });
      entries.sort(
        (left, right) =>
          Date.parse(left.occurrence.scheduled_fire_at) -
            Date.parse(right.occurrence.scheduled_fire_at) ||
          left.occurrence.id.localeCompare(right.occurrence.id),
      );
      const occurrenceCountsBySchedule = new Map<string, number>();
      for (const { occurrence, schedule } of entries) {
        const scheduledAt = Date.parse(occurrence.scheduled_fire_at);
        if (
          !Number.isFinite(scheduledAt) ||
          !Number.isSafeInteger(schedule.max_catch_up_window_seconds) ||
          schedule.max_catch_up_window_seconds < 60 ||
          schedule.max_catch_up_window_seconds > 2_592_000 ||
          !Number.isSafeInteger(schedule.max_catch_up_occurrences) ||
          schedule.max_catch_up_occurrences < 1 ||
          schedule.max_catch_up_occurrences > 1_000 ||
          scheduledAt > now.getTime() ||
          now.getTime() - scheduledAt >
            schedule.max_catch_up_window_seconds * 1_000
        ) {
          invalid(
            "catch-up occurrence exceeds its persisted schedule policy",
          );
        }
        occurrenceCountsBySchedule.set(
          schedule.id,
          (occurrenceCountsBySchedule.get(schedule.id) ?? 0) + 1,
        );
      }
      const schedules = [
        ...new Map(
          entries.map(({ schedule }) => [schedule.id, schedule]),
        ).values(),
      ].sort((left, right) => left.id.localeCompare(right.id));
      if (
        schedules.some(
          (schedule) =>
            (occurrenceCountsBySchedule.get(schedule.id) ?? 0) >
            schedule.max_catch_up_occurrences,
        )
      ) {
        invalid(
          "catch-up occurrence count exceeds its persisted schedule policy",
        );
      }
      const occurrences = entries.map(({ occurrence }) => occurrence);
      const id = `catchup_${digestBase64Url(
        canonicalJsonV1({
          scope: request.scope,
          occurrence_ids: occurrences.map((entry) => entry.id),
          started_at: iso(now),
        }),
      ).slice(0, 32)}`;
      const batch: MutableTimerCatchUpBatchV1 = {
        id,
        scope: snapshotScope(request.scope),
        status: "running",
        occurrence_ids: occurrences.map((entry) => entry.id),
        cursor_occurrence_id: null,
        last_occurrence_id: null,
        last_trigger_process_id: null,
        timeout_seconds: timeout,
        deadline_at: iso(new Date(now.getTime() + timeout * 1_000)),
        policy_snapshot: Object.freeze({
          catch_up_timeout_seconds: timeout,
          max_catch_up_window_seconds: Math.max(
            ...schedules.map(
              (schedule) => schedule.max_catch_up_window_seconds,
            ),
          ),
          max_catch_up_occurrences: Math.max(
            occurrences.length,
            Math.min(
              1_000,
              schedules.reduce(
                (sum, schedule) =>
                  sum + schedule.max_catch_up_occurrences,
                0,
              ),
            ),
          ),
          catch_up_continue_after_failed:
            request.continue_after_failed ?? true,
          config_revision: `timer_manual_${digestBase64Url(
            canonicalJsonV1(
              schedules.map((schedule) => ({
                schedule_id: schedule.id,
                schedule_version: schedule.schedule_version,
                max_catch_up_window_seconds:
                  schedule.max_catch_up_window_seconds,
                max_catch_up_occurrences:
                  schedule.max_catch_up_occurrences,
              })),
            ),
          ).slice(0, 32)}`,
        }),
        reason: null,
        started_at: iso(now),
        created_at: iso(now),
        updated_at: iso(now),
        completed_at: null,
      };
      for (const occurrence of occurrences) {
        occurrence.is_catch_up = true;
        occurrence.catch_up_batch_id = id;
        occurrence.missed_window_summary = `${occurrences.length} missed timer occurrence(s)`;
        occurrence.occurrence_version = nextSafeCounterV1(occurrence.occurrence_version, "occurrence version");
        occurrence.updated_at = iso(now);
      }
      state.batches.set(id, batch);
      return snapshotBatch(batch);
    });
  }

  public async advanceCatchUpBatch(
    principal: TimerPrincipalV1,
    request: TimerCatchUpAdvanceRequestV1,
  ): Promise<TimerCatchUpAdvanceResponseV1> {
    request = ownJsonValue(request) as TimerCatchUpAdvanceRequestV1;
    assertWorker(principal, "timer.worker.catch_up", request.scope);
    assertIdentifier(request.batch_id, "batch_id");
    assertIdentifier(request.trace_id, "trace_id");
    if (
      request.expected_status !== "running" ||
      (request.expected_last_occurrence_id === null) !==
        (request.expected_last_trigger_process_id === null) ||
      (request.expected_cursor_occurrence_id === null &&
        request.expected_last_occurrence_id !== null)
    ) {
      invalid("catch-up continuation precondition is invalid");
    }
    const now =
      request.now === undefined
        ? snapshotInstantV1(this.#clock(), "clock")
        : parseInstant(request.now, "now");
    const batchSnapshot = await this.repository.transact((state) => {
      const batch = state.batches.get(request.batch_id);
      if (batch === undefined || !sameScope(batch.scope, request.scope)) {
        throw new TimerApplicationErrorV1(
          "catch_up_not_found",
          "catch-up batch was not found",
        );
      }
      if (
        batch.status !== request.expected_status ||
        batch.cursor_occurrence_id !==
          request.expected_cursor_occurrence_id ||
        batch.last_occurrence_id !== request.expected_last_occurrence_id ||
        batch.last_trigger_process_id !==
          request.expected_last_trigger_process_id
      ) {
        throw new TimerApplicationErrorV1(
          "catch_up_conflict",
          "catch-up continuation precondition no longer matches",
        );
      }
      return snapshotBatch(batch);
    });
    if (batchSnapshot.status !== "running") {
      return Object.freeze({
        batch: batchSnapshot,
        outcome:
          batchSnapshot.status === "timed_out" ? "timed_out" : "completed",
        occurrence: null,
      });
    }
    if (Date.parse(batchSnapshot.deadline_at) <= now.getTime()) {
      return this.timeoutCatchUpBatch(request, batchSnapshot, now);
    }
    if (
      batchSnapshot.cursor_occurrence_id !== null &&
      batchSnapshot.cursor_occurrence_id !== batchSnapshot.last_occurrence_id
    ) {
      const released = await this.repository.transact((state) => {
        const batch = state.batches.get(request.batch_id);
        const occurrence =
          batch?.cursor_occurrence_id === null ||
          batch?.cursor_occurrence_id === undefined
            ? undefined
            : state.occurrences.get(batch.cursor_occurrence_id);
        if (
          batch?.status === "running" &&
          sameCatchUpContinuation(batch, batchSnapshot) &&
          occurrence !== undefined
        ) {
          if (occurrence.status === "dispatching") {
            return Object.freeze({
              batch: snapshotBatch(batch),
              outcome: "waiting" as const,
              occurrence: null,
            });
          }
          if (
            !batch.policy_snapshot.catch_up_continue_after_failed &&
            terminalOccurrenceStatuses.has(occurrence.status) &&
            occurrence.status !== "dispatched"
          ) {
            cancelCatchUpBatchAfterFailureV1(
              state,
              batch,
              now,
              "prior_occurrence_not_dispatched",
            );
            return Object.freeze({
              batch: snapshotBatch(batch),
              outcome: "completed" as const,
              occurrence: null,
            });
          }
          if (
            occurrence.status !== "pending" &&
            occurrence.status !== "retry_wait"
          ) {
            return undefined;
          }
          if (
            occurrence.status === "retry_wait" &&
            (occurrence.next_retry_at === null ||
              Date.parse(occurrence.next_retry_at) > now.getTime())
          ) {
            return Object.freeze({
              batch: snapshotBatch(batch),
              outcome: "waiting" as const,
              occurrence: null,
            });
          }
          return Object.freeze({
            batch: snapshotBatch(batch),
            outcome: "ready" as const,
            occurrence: snapshotOccurrence(occurrence),
          });
        }
        return undefined;
      });
      if (released !== undefined) return released;
    }
    if (batchSnapshot.last_trigger_process_id !== null) {
      const process = snapshotCatchUpProcessProjectionV1(
        await this.triggerProcessor.getProcess(
          batchSnapshot.last_trigger_process_id,
          request.scope,
          request.trace_id,
        ),
        batchSnapshot.last_trigger_process_id,
        request.scope,
      );
      if (!isProcessClosedForCatchUp(process)) {
        return Object.freeze({
          batch: batchSnapshot,
          outcome: "waiting",
          occurrence: null,
        });
      }
      if (
        !batchSnapshot.policy_snapshot.catch_up_continue_after_failed &&
        (process.status !== "completed" ||
          process.meta_status === "failed")
      ) {
        return this.repository.transact((state) => {
          const batch = state.batches.get(request.batch_id);
          if (
            batch === undefined ||
            batch.status !== "running" ||
            !sameCatchUpContinuation(batch, batchSnapshot)
          ) {
            throw new TimerApplicationErrorV1(
              "catch_up_conflict",
              "catch-up batch changed concurrently",
            );
          }
          cancelCatchUpBatchAfterFailureV1(
            state,
            batch,
            now,
            "prior_process_not_completed",
          );
          return Object.freeze({
            batch: snapshotBatch(batch),
            outcome: "completed" as const,
            occurrence: null,
          });
        });
      }
    }
    return this.repository.transact((state) => {
      const batch = state.batches.get(request.batch_id);
      if (
        batch === undefined ||
        batch.status !== "running" ||
        !sameCatchUpContinuation(batch, batchSnapshot)
      ) {
        throw new TimerApplicationErrorV1(
          "catch_up_conflict",
          "catch-up batch changed concurrently",
        );
      }
      const startIndex =
        batch.cursor_occurrence_id === null
          ? 0
          : batch.occurrence_ids.indexOf(batch.cursor_occurrence_id) + 1;
      const nextId = batch.occurrence_ids
        .slice(Math.max(0, startIndex))
        .find((id) => {
          const occurrence = state.occurrences.get(id);
          return (
            occurrence !== undefined &&
            (occurrence.status === "pending" ||
              (occurrence.status === "retry_wait" &&
                !isCommitUnknownReplayV1(occurrence)))
          );
        });
      if (nextId === undefined) {
        batch.status = "completed";
        batch.reason = "all_occurrences_dispatched";
        batch.completed_at = iso(now);
        batch.updated_at = iso(now);
        return Object.freeze({
          batch: snapshotBatch(batch),
          outcome: "completed" as const,
          occurrence: null,
        });
      }
      const occurrence = state.occurrences.get(nextId);
      if (occurrence === undefined) throw new Error("catch-up index is corrupt");
      batch.cursor_occurrence_id = occurrence.id;
      batch.updated_at = iso(now);
      return Object.freeze({
        batch: snapshotBatch(batch),
        outcome: "ready" as const,
        occurrence: snapshotOccurrence(occurrence),
      });
    });
  }

  private async timeoutCatchUpBatch(
    request: TimerCatchUpAdvanceRequestV1,
    expected: TimerCatchUpBatchV1,
    now: Date,
  ): Promise<TimerCatchUpAdvanceResponseV1> {
    return this.repository.transact((state) => {
      const batch = state.batches.get(request.batch_id);
      if (
        batch === undefined ||
        !sameScope(batch.scope, request.scope)
      ) {
        throw new TimerApplicationErrorV1(
          "catch_up_not_found",
          "catch-up batch was not found",
        );
      }
      if (
        batch.status === "running" &&
        batch.deadline_at !== expected.deadline_at
      ) {
        throw new TimerApplicationErrorV1(
          "catch_up_conflict",
          "catch-up deadline changed concurrently",
        );
      }
      if (
        batch.status === "running" &&
        Date.parse(batch.deadline_at) > now.getTime()
      ) {
        throw new TimerApplicationErrorV1(
          "catch_up_conflict",
          "catch-up deadline has not elapsed",
        );
      }
      if (batch.status === "running") {
        batch.status = "timed_out";
        batch.reason = "catch_up_timeout";
        batch.completed_at = iso(now);
        batch.updated_at = iso(now);
        for (const id of batch.occurrence_ids) {
          const occurrence = state.occurrences.get(id);
          if (
            occurrence !== undefined &&
            (occurrence.status === "pending" ||
              (occurrence.status === "retry_wait" &&
                !isCommitUnknownReplayV1(occurrence)))
          ) {
            occurrence.status = "skipped";
            occurrence.next_retry_at = null;
            occurrence.occurrence_version = nextSafeCounterV1(occurrence.occurrence_version, "occurrence version");
            occurrence.updated_at = iso(now);
            const schedule = state.schedules.get(occurrence.schedule_id);
            if (
              schedule !== undefined &&
              schedule.status === "active" &&
              schedule.schedule_version === occurrence.schedule_version
            ) {
              expireScheduleWithoutOutstandingOccurrenceV1(
                state,
                schedule,
                now,
              );
            }
          }
        }
      }
      return Object.freeze({
        batch: snapshotBatch(batch),
        outcome: "timed_out" as const,
        occurrence: null,
      });
    });
  }
}

export function createTimerApplicationWithVerifiedPostgresStateV1(
  repository: PostgresTimerStateRepositoryPortV1,
  deployment: VerifiedOwnerRepositoryDeploymentV1<"timer_trigger_app">,
  triggerProcessor: TimerTriggerProcessorPortV1,
  options: TimerApplicationOptionsV1 = {},
): TimerApplicationV1 {
  if (
    repository.persistence_kind !== "postgresql" ||
    repository.deployment !== deployment ||
    deployment.owner_service !== "timer_trigger_app"
  ) {
    throw new Error(
      "Timer PostgreSQL state repository does not match the verified owner deployment",
    );
  }
  Object.defineProperty(repository, verifiedDurableTimerRepositoryBrandV1, {
    configurable: false,
    enumerable: false,
    writable: false,
    value: true,
  });
  return new TimerApplicationV1(repository, triggerProcessor, options);
}
