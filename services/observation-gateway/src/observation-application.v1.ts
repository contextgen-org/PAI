import { createHash, randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

import {
  ContextSnapshotResolveRequestV1Schema,
  MetaJobQueryDetailsV1Schema,
  QUALITY_SIGNAL_TYPES_V1,
  QualitySignalListDetailsV1Schema,
  RUNTIME_TOKEN_SSE_FORBIDDEN_DURABLE_FIELDS_V1,
  RuntimeRunQueryDetailsV1Schema,
  RuntimeTokenSseEventV1Schema,
  ToolInvocationListDetailsV1Schema,
  TOOL_INVOCATION_QUERY_STATUSES_V1,
  TriggerProcessSnapshotReadContractV1Schema,
  TriggerProcessSnapshotResolveRequestV1Schema,
  TriggerProcessQueryDetailsV1Schema,
  TriggerProcessSummaryV1Schema,
  TriggerProcessSseEventV1Schema,
  assertMetaJobQueryDetailsSemanticBindingsV1,
  assertQualitySignalListDetailsSemanticBindingsV1,
  assertRuntimeRunQueryDetailsSemanticBindingsV1,
  assertToolInvocationListDetailsSemanticBindingsV1,
  assertTriggerProcessQueryDetailsV1,
  assertTriggerProcessSnapshotReadBindingsV1,
  assertTriggerProcessSnapshotSemanticBindingsV1,
  assertTriggerProcessSummaryBindingsV1,
  assertTriggerProcessSummarySemanticBindingsV1,
  assertTriggerProcessSseEventSemanticBindingsV1,
  parseTriggerProcessSseCursorV1,
  triggerProcessSseEventIdV1,
  type ContextSnapshotResolveRequestV1,
  type ContextSnapshotV1,
  type DelegatedPrincipalContextV1,
  type MetaJobQueryDetailsV1,
  type QualitySignalListDetailsV1,
  type RuntimeRunQueryDetailsV1,
  type RuntimeTokenSseEventV1,
  type ToolInvocationListDetailsV1,
  type TriggerProcessQueryDetailsV1,
  type TriggerProcessSnapshotReadContractV1,
  type TriggerProcessSnapshotResolveRequestV1,
  type TriggerProcessSseEventV1,
} from "@pai/contracts";
import {
  canonicalJsonV1,
  materializeContextSnapshotReadV1,
} from "@pai/eventing";
import { Value } from "@sinclair/typebox/value";

import type {
  ObservationEventV1,
  ObservationMetaDetailsResponseV1,
  ObservationQualitySignalListV1,
  ObservationRuntimeDetailsResponseV1,
  ObservationSnapshotResponseV1,
  ObservationToolInvocationListV1,
} from "./contracts/observation.v1.js";

export interface ObservationScopeV1 {
  readonly workspace_id: string;
  readonly bot_id: string;
  readonly owner_agent_id: string;
  readonly deployment_environment: "local" | "dev" | "staging" | "prod";
  readonly release_channel: "stable" | "canary";
}

export interface ObservationPrincipalV1 {
  readonly service_id: string;
  readonly actor_id: string;
  readonly roles: readonly (
    | "observation.viewer"
    | "observation.debug_viewer"
  )[];
  readonly capabilities: readonly string[];
  readonly credential_expires_at_epoch_seconds?: number;
  readonly delegated_principal: DelegatedPrincipalContextV1;
  readonly scope: ObservationScopeV1;
}

export type ObservationUpstreamV1 =
  | "trigger_processor"
  | "action_runtime"
  | "meta_cognition";

export class ObservationUpstreamErrorV1 extends Error {
  public constructor(
    public readonly upstream: ObservationUpstreamV1,
    public readonly code:
      | "permission_denied"
      | "not_found"
      | "cursor_ahead"
      | "replay_expired"
      | "rate_limited"
      | "unavailable"
      | "timeout"
      | "schema_mismatch"
      | "resource_mismatch",
    message: string,
  ) {
    super(message);
    this.name = "ObservationUpstreamErrorV1";
  }
}

export type ObservationApplicationErrorCodeV1 =
  | "invalid_request"
  | "bot_permission_denied"
  | "debug_permission_denied"
  | "process_not_found"
  | "runtime_run_mismatch"
  | "replay_cursor_ahead"
  | "replay_expired"
  | "rate_limited"
  | "upstream_schema_mismatch"
  | "upstream_unavailable"
  | "sse_backpressure_exceeded"
  | "audit_unavailable";

export class ObservationApplicationErrorV1 extends Error {
  public constructor(
    public readonly code: ObservationApplicationErrorCodeV1,
    message: string,
    public readonly retryable: boolean,
    public readonly details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = "ObservationApplicationErrorV1";
  }
}

export interface ObservationTriggerProcessorPortV1 {
  checkReadiness(): Promise<void>;
  getProcess(input: Readonly<{
    workload: Readonly<{
      sub: "observation_gateway";
      aud: "trigger_processor";
      capabilities: readonly [
        "trigger.context_snapshot.resolve",
        "trigger.process.read",
        "trigger.process.snapshot.resolve",
      ];
    }>;
    delegated_principal: DelegatedPrincipalContextV1;
    scope: ObservationScopeV1;
    trigger_process_id: string;
    trace_id: string;
  }>, signal?: AbortSignal): Promise<unknown>;
  /**
   * Implementations must settle the iterator after `signal` is aborted.
   * Observation waits for that settlement before it releases the per-request
   * authorization lease.
   */
  streamProcessEvents(input: Readonly<{
    workload: Readonly<{
      sub: "observation_gateway";
      aud: "trigger_processor";
      capability: "trigger.process.events.read";
    }>;
    delegated_principal: DelegatedPrincipalContextV1;
    scope: ObservationScopeV1;
    trigger_process_id: string;
    last_event_id?: string;
    start_after_append_sequence_no?: number;
    trace_id: string;
  }>, signal: AbortSignal): AsyncIterable<
    | Readonly<{ kind: "heartbeat" }>
    | Readonly<{ kind: "event"; event: unknown }>
  >;
}

export interface ObservationTriggerProcessorOwnerReadPortV1 {
  checkReadiness(): Promise<void>;
  resolveProcessSnapshot(
    input: Readonly<{
      workload: Readonly<{
        sub: "observation_gateway";
        aud: "trigger_processor";
        capability: "trigger.process.snapshot.resolve";
      }>;
      delegated_principal: DelegatedPrincipalContextV1;
      request: TriggerProcessSnapshotResolveRequestV1;
    }>,
    signal: AbortSignal,
  ): Promise<unknown>;
  resolveContextSnapshot(
    input: Readonly<{
      workload: Readonly<{
        sub: "observation_gateway";
        aud: "trigger_processor";
        capability: "trigger.context_snapshot.resolve";
      }>;
      delegated_principal: DelegatedPrincipalContextV1;
      request: ContextSnapshotResolveRequestV1;
    }>,
    signal: AbortSignal,
  ): Promise<unknown>;
}

export interface ObservationRuntimePortV1 {
  checkReadiness(): Promise<void>;
  getRun(input: Readonly<{
    workload: Readonly<{
      sub: "observation_gateway";
      aud: "action_runtime";
      capability: "runtime.run.read";
    }>;
    delegated_principal: DelegatedPrincipalContextV1;
    scope: ObservationScopeV1;
    trigger_process_id: string;
    runtime_run_id: string;
    trace_id: string;
  }>, signal?: AbortSignal): Promise<unknown>;
  listToolInvocations(input: Readonly<{
    workload: Readonly<{
      sub: "observation_gateway";
      aud: "action_runtime";
      capability: "runtime.tool_invocations.read";
    }>;
    delegated_principal: DelegatedPrincipalContextV1;
    scope: ObservationScopeV1;
    trigger_process_id: string;
    runtime_run_id: string;
    cursor?: string;
    limit: number;
    status?: string;
    trace_id: string;
  }>): Promise<unknown>;
  streamTokens(
    input: Readonly<{
      workload: Readonly<{
        sub: "observation_gateway";
        aud: "action_runtime";
        capability: "runtime.debug_tokens";
      }>;
      delegated_principal: DelegatedPrincipalContextV1;
      scope: ObservationScopeV1;
      trigger_process_id: string;
      runtime_run_id: string;
      trace_id: string;
    }>,
    signal: AbortSignal,
    /**
     * Implementations must settle the iterator after `signal` is aborted.
     * Observation waits for that settlement before releasing a prepared
     * stream so per-request provider tasks cannot escape their lifecycle.
     */
  ): AsyncIterable<unknown>;
}

export interface ObservationMetaPortV1 {
  checkReadiness(): Promise<void>;
  getJob(input: Readonly<{
    workload: Readonly<{
      sub: "observation_gateway";
      aud: "meta_cognition";
      capability: "meta.job.read";
    }>;
    delegated_principal: DelegatedPrincipalContextV1;
    scope: ObservationScopeV1;
    trigger_process_id: string;
    meta_job_id: string;
    trace_id: string;
  }>): Promise<unknown>;
  listQualitySignals(input: Readonly<{
    workload: Readonly<{
      sub: "observation_gateway";
      aud: "meta_cognition";
      capability: "meta.quality_signals.read";
    }>;
    delegated_principal: DelegatedPrincipalContextV1;
    scope: ObservationScopeV1;
    trigger_process_id: string;
    cursor?: string;
    limit: number;
    severity?: string;
    signal_type?: string;
    trace_id: string;
  }>): Promise<unknown>;
}

export interface ObservationAccessAuditRecordV1 {
  readonly audit_id: string;
  readonly occurred_at: string;
  readonly actor_identity: string;
  readonly service_identity: string;
  readonly roles: readonly string[];
  readonly workspace_id: string;
  readonly bot_id: string;
  readonly owner_agent_id: string;
  readonly deployment_environment: ObservationScopeV1["deployment_environment"];
  readonly release_channel: ObservationScopeV1["release_channel"];
  readonly resource_type: string;
  readonly resource_id: string;
  readonly endpoint: string;
  readonly include_ephemeral_tokens: boolean;
  readonly decision: string;
  readonly status_code: number;
  readonly trace_id: string;
  readonly connection_duration_ms: number;
  readonly redacted_field_count: number;
}

export interface ObservationAccessAuditSpoolPortV1 {
  readonly durability: "memory_reference" | "durable_spool";
  checkReadiness(): Promise<void>;
  /**
   * When a signal is supplied, the enqueue attempt must settle after abort.
   * A debug stream still requires a successful durable handoff before any
   * ephemeral provider stream may start.
   */
  enqueue(
    record: ObservationAccessAuditRecordV1,
    signal?: AbortSignal,
  ): Promise<
    | "durable"
    | "commit_unknown"
    | "unavailable"
    | "capacity_exceeded"
  >;
  replay(): Promise<void>;
}

export interface ObservationAccessAuditSinkPortV1 {
  append(
    record: ObservationAccessAuditRecordV1,
  ): Promise<"acknowledged" | "retry">;
}

export class InMemoryObservationAccessAuditSpoolV1
  implements ObservationAccessAuditSpoolPortV1
{
  public readonly durability = "memory_reference" as const;
  public constructor(
    public readonly records: ObservationAccessAuditRecordV1[] = [],
    private readonly maxRecords = 10_000,
    private available = true,
    private readonly sink?: ObservationAccessAuditSinkPortV1,
  ) {}

  public async checkReadiness(): Promise<void> {
    if (!this.available) throw new Error("audit spool is unavailable");
  }

  public async enqueue(
    record: ObservationAccessAuditRecordV1,
  ): Promise<"durable" | "unavailable" | "capacity_exceeded"> {
    if (!this.available) return "unavailable";
    if (this.records.some((entry) => entry.audit_id === record.audit_id)) {
      return "durable";
    }
    if (this.records.length >= this.maxRecords) return "capacity_exceeded";
    this.records.push(structuredClone(record));
    return "durable";
  }

  public async replay(): Promise<void> {
    if (!this.available || this.sink === undefined) return;
    for (const record of [...this.records]) {
      let outcome: "acknowledged" | "retry";
      try {
        outcome = await this.sink.append(structuredClone(record));
      } catch {
        return;
      }
      if (outcome !== "acknowledged") return;
      const index = this.records.findIndex(
        (candidate) => candidate.audit_id === record.audit_id,
      );
      if (index !== -1) this.records.splice(index, 1);
    }
  }

  public setAvailable(value: boolean): void {
    this.available = value;
  }
}

export interface ObservationStreamFrameV1 {
  readonly id?: string;
  readonly event?: string;
  readonly data?: unknown;
  readonly comment?: "heartbeat";
  readonly durable: boolean;
}

export interface ObservationPreparedEventStreamV1 {
  readonly principal: ObservationPrincipalV1;
  readonly process_id: string;
  readonly process: TriggerProcessQueryDetailsV1;
  readonly input: ObservationEventStreamInputV1;
  readonly start_after: number | undefined;
  readonly debug_requested: boolean;
  readonly include_tokens: boolean;
  readonly runtime_run_id: string | null;
  readonly started_at_monotonic_ms: number;
}

export interface ObservationEventStreamInputV1 {
  readonly last_event_id?: string;
  readonly include_ephemeral_tokens?: boolean;
  readonly runtime_run_id?: string;
  readonly trace_id: string;
}

interface ObservationProcessReadInputV1 {
  readonly trigger_process_id: string;
  readonly trace_id: string;
}

interface ObservationRuntimeDetailsInputV1
  extends ObservationProcessReadInputV1 {
  readonly runtime_run_id: string;
}

interface ObservationMetaDetailsInputV1
  extends ObservationProcessReadInputV1 {
  readonly meta_job_id: string;
}

interface ObservationToolInvocationQueryInputV1 {
  readonly runtime_run_id?: string;
  readonly cursor?: string;
  readonly limit?: number;
  readonly status?: string;
  readonly trace_id: string;
}

interface ObservationQualitySignalQueryInputV1 {
  readonly cursor?: string;
  readonly limit?: number;
  readonly severity?: string;
  readonly signal_type?: string;
  readonly trace_id: string;
}

export class ObservationBoundedBufferV1 {
  readonly #items: ObservationStreamFrameV1[] = [];
  #bytes = 0;

  public constructor(
    private readonly maxEvents = 256,
    private readonly maxBytes = 1_048_576,
  ) {
    if (
      !Number.isSafeInteger(maxEvents) ||
      maxEvents < 1 ||
      !Number.isSafeInteger(maxBytes) ||
      maxBytes < 1
    ) {
      throw new Error("observation buffer bounds are invalid");
    }
  }

  public push(frame: ObservationStreamFrameV1): void {
    let canonicalFrame: string;
    try {
      canonicalFrame = canonicalJsonV1(frame, {
        max_bytes: this.maxBytes,
      });
    } catch {
      throw new ObservationApplicationErrorV1(
        "upstream_schema_mismatch",
        "observation SSE frame is not bounded canonical JSON",
        false,
      );
    }
    const bytes = Buffer.byteLength(canonicalFrame, "utf8");
    if (
      this.#items.length + 1 > this.maxEvents ||
      this.#bytes + bytes > this.maxBytes
    ) {
      throw new ObservationApplicationErrorV1(
        "sse_backpressure_exceeded",
        "observation SSE buffer exceeded its configured bound",
        true,
      );
    }
    this.#items.push(
      JSON.parse(canonicalFrame) as ObservationStreamFrameV1,
    );
    this.#bytes += bytes;
  }

  public shift(): ObservationStreamFrameV1 | undefined {
    const frame = this.#items.shift();
    if (frame !== undefined) {
      this.#bytes -= Buffer.byteLength(canonicalJsonV1(frame), "utf8");
    }
    return frame;
  }

  public clear(): void {
    this.#items.length = 0;
    this.#bytes = 0;
  }

  public get size(): number {
    return this.#items.length;
  }
}

interface RedactionResultV1<T> {
  readonly value: T;
  readonly redacted: number;
}

const sensitivePattern =
  /(?:authorization|cookie|api[_-]?key|password|secret|credential|bearer\s+[a-z0-9._~-]+)/iu;
const signedUrlPattern =
  /[?&](?:x-amz-signature|x-goog-signature|signature|sig|token|access_token|expires)=/iu;
const qualitySeverities = new Set([
  "info",
  "warning",
  "error",
  "critical",
]);

function sanitizeText(value: string): RedactionResultV1<string> {
  if (sensitivePattern.test(value) || signedUrlPattern.test(value)) {
    return { value: "[REDACTED]", redacted: 1 };
  }
  if (value.length > 1_024) {
    return { value: value.slice(0, 1_024), redacted: 1 };
  }
  return {
    value,
    redacted: 0,
  };
}

function sanitizeNullableReference(
  value: string | null,
): RedactionResultV1<string | null> {
  if (value === null) return { value: null, redacted: 0 };
  const sanitized = sanitizeText(value);
  return sanitized.redacted === 0
    ? sanitized
    : { value: null, redacted: sanitized.redacted };
}

function safeSelectedValue(value: unknown): RedactionResultV1<unknown> {
  if (typeof value === "string") return sanitizeText(value);
  if (
    value === null ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return { value, redacted: 0 };
  }
  if (Array.isArray(value)) {
    let redacted = Math.max(0, value.length - 64);
    const result = value.slice(0, 64).map((entry) => {
      const sanitized = safeSelectedValue(entry);
      redacted += sanitized.redacted;
      return sanitized.value;
    });
    return { value: result, redacted };
  }
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value);
    let redacted = Math.max(0, entries.length - 64);
    const result: Record<string, unknown> = {};
    for (const [key, entry] of entries.slice(0, 64)) {
      if (sensitivePattern.test(key)) {
        redacted += 1;
        continue;
      }
      const sanitized = safeSelectedValue(entry);
      result[key] = sanitized.value;
      redacted += sanitized.redacted;
    }
    return { value: result, redacted };
  }
  return { value: null, redacted: 1 };
}

function deepFreezeObservationJsonV1<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const entry of Object.values(value)) {
    deepFreezeObservationJsonV1(entry);
  }
  return Object.freeze(value);
}

function snapshotCanonicalJsonV1<T>(
  value: unknown,
  error: ObservationApplicationErrorV1,
): T {
  try {
    return deepFreezeObservationJsonV1(
      JSON.parse(canonicalJsonV1(value)) as T,
    );
  } catch {
    throw error;
  }
}

function snapshotCanonicalUpstreamValueV1<T>(
  value: unknown,
  upstream: ObservationUpstreamV1,
  label: string,
): T {
  return snapshotCanonicalJsonV1<T>(
    value,
    new ObservationApplicationErrorV1(
      "upstream_schema_mismatch",
      `${label} is not bounded canonical JSON`,
      false,
      { upstream },
    ),
  );
}

function runtimeRunDetails(
  value: unknown,
): RuntimeRunQueryDetailsV1 {
  const snapshot =
    snapshotCanonicalUpstreamValueV1<RuntimeRunQueryDetailsV1>(
    value,
    "action_runtime",
    "action runtime run response",
  );
  if (!Value.Check(RuntimeRunQueryDetailsV1Schema, snapshot)) {
    throw new ObservationApplicationErrorV1(
      "upstream_schema_mismatch",
      "action runtime run response does not match its owner schema",
      false,
      { upstream: "action_runtime" },
    );
  }
  try {
    assertRuntimeRunQueryDetailsSemanticBindingsV1(snapshot);
  } catch {
    throw new ObservationApplicationErrorV1(
      "upstream_schema_mismatch",
      "action runtime run response violates semantic bindings",
      false,
      { upstream: "action_runtime" },
    );
  }
  return snapshot;
}

function toolInvocationListDetails(
  value: unknown,
): ToolInvocationListDetailsV1 {
  const snapshot =
    snapshotCanonicalUpstreamValueV1<ToolInvocationListDetailsV1>(
    value,
    "action_runtime",
    "action runtime tool response",
  );
  if (!Value.Check(ToolInvocationListDetailsV1Schema, snapshot)) {
    throw new ObservationApplicationErrorV1(
      "upstream_schema_mismatch",
      "action runtime tool response does not match its owner schema",
      false,
      { upstream: "action_runtime" },
    );
  }
  try {
    assertToolInvocationListDetailsSemanticBindingsV1(snapshot);
  } catch {
    throw new ObservationApplicationErrorV1(
      "upstream_schema_mismatch",
      "action runtime tool response violates semantic bindings",
      false,
      { upstream: "action_runtime" },
    );
  }
  return snapshot;
}

function metaJobDetails(value: unknown): MetaJobQueryDetailsV1 {
  const snapshot =
    snapshotCanonicalUpstreamValueV1<MetaJobQueryDetailsV1>(
    value,
    "meta_cognition",
    "meta job response",
  );
  if (!Value.Check(MetaJobQueryDetailsV1Schema, snapshot)) {
    throw new ObservationApplicationErrorV1(
      "upstream_schema_mismatch",
      "meta job response does not match its owner schema",
      false,
      { upstream: "meta_cognition" },
    );
  }
  try {
    assertMetaJobQueryDetailsSemanticBindingsV1(snapshot);
  } catch {
    throw new ObservationApplicationErrorV1(
      "upstream_schema_mismatch",
      "meta job response violates semantic bindings",
      false,
      { upstream: "meta_cognition" },
    );
  }
  return snapshot;
}

function qualitySignalListDetails(
  value: unknown,
): QualitySignalListDetailsV1 {
  const snapshot =
    snapshotCanonicalUpstreamValueV1<QualitySignalListDetailsV1>(
    value,
    "meta_cognition",
    "meta quality response",
  );
  if (!Value.Check(QualitySignalListDetailsV1Schema, snapshot)) {
    throw new ObservationApplicationErrorV1(
      "upstream_schema_mismatch",
      "meta quality response does not match its owner schema",
      false,
      { upstream: "meta_cognition" },
    );
  }
  try {
    assertQualitySignalListDetailsSemanticBindingsV1(snapshot);
  } catch {
    throw new ObservationApplicationErrorV1(
      "upstream_schema_mismatch",
      "meta quality response violates semantic bindings",
      false,
      { upstream: "meta_cognition" },
    );
  }
  return snapshot;
}

function sameScope(
  details: TriggerProcessQueryDetailsV1,
  scope: ObservationScopeV1,
): boolean {
  return (
    details.workspace_id === scope.workspace_id &&
    details.bot_id === scope.bot_id &&
    details.owner_agent_id === scope.owner_agent_id &&
    details.deployment_environment === scope.deployment_environment &&
    details.release_channel === scope.release_channel
  );
}

function assertIdentifier(value: string, label: string): void {
  if (
    value.length === 0 ||
    value.length > 512 ||
    /[\r\n]/u.test(value)
  ) {
    throw new ObservationApplicationErrorV1(
      "invalid_request",
      `${label} is invalid`,
      false,
    );
  }
}

function snapshotObservationPrincipalV1(
  value: ObservationPrincipalV1,
): ObservationPrincipalV1 {
  const snapshot = snapshotCanonicalJsonV1<unknown>(
    value,
    new ObservationApplicationErrorV1(
      "bot_permission_denied",
      "observation principal is not a canonical identity snapshot",
      false,
    ),
  );
  if (
    typeof snapshot !== "object" ||
    snapshot === null ||
    Array.isArray(snapshot)
  ) {
    throw new ObservationApplicationErrorV1(
      "bot_permission_denied",
      "observation principal is invalid",
      false,
    );
  }
  const candidate = snapshot as Readonly<Record<string, unknown>>;
  const scope = candidate["scope"];
  const allowedKeys = new Set([
    "service_id",
    "actor_id",
    "roles",
    "capabilities",
    "credential_expires_at_epoch_seconds",
    "delegated_principal",
    "scope",
  ]);
  const allowedScopeKeys = new Set([
    "workspace_id",
    "bot_id",
    "owner_agent_id",
    "deployment_environment",
    "release_channel",
  ]);
  const delegated = candidate["delegated_principal"];
  if (
    Object.keys(candidate).some((key) => !allowedKeys.has(key)) ||
    typeof candidate["service_id"] !== "string" ||
    typeof candidate["actor_id"] !== "string" ||
    !Array.isArray(candidate["roles"]) ||
    !candidate["roles"].every((entry) => typeof entry === "string") ||
    !Array.isArray(candidate["capabilities"]) ||
    !candidate["capabilities"].every(
      (entry) => typeof entry === "string",
    ) ||
    (candidate["credential_expires_at_epoch_seconds"] !== undefined &&
      (typeof candidate["credential_expires_at_epoch_seconds"] !==
        "number" ||
        !Number.isSafeInteger(
          candidate["credential_expires_at_epoch_seconds"],
        ) ||
        (candidate["credential_expires_at_epoch_seconds"] as number) < 0)) ||
    typeof delegated !== "object" ||
    delegated === null ||
    Array.isArray(delegated) ||
    typeof scope !== "object" ||
    scope === null ||
    Array.isArray(scope)
  ) {
    throw new ObservationApplicationErrorV1(
      "bot_permission_denied",
      "observation principal is invalid",
      false,
    );
  }
  const scopeRecord = scope as Readonly<Record<string, unknown>>;
  const delegatedRecord = delegated as Readonly<Record<string, unknown>>;
  const delegatedKeys = [
    "auth_time",
    "bot_id",
    "deployment_environment",
    "owner_agent_id",
    "principal_id",
    "principal_type",
    "release_channel",
    "roles",
    "scope_kind",
    "source_issuer",
    "source_subject",
    "workspace_id",
  ] as const;
  const delegatedRoles = delegatedRecord["roles"];
  if (
    Object.keys(scopeRecord).some((key) => !allowedScopeKeys.has(key)) ||
    typeof scopeRecord["workspace_id"] !== "string" ||
    typeof scopeRecord["bot_id"] !== "string" ||
    typeof scopeRecord["owner_agent_id"] !== "string" ||
    !["local", "dev", "staging", "prod"].includes(
      scopeRecord["deployment_environment"] as string,
    ) ||
    !["stable", "canary"].includes(
      scopeRecord["release_channel"] as string,
    ) ||
    Object.keys(delegatedRecord).sort().join(",") !==
      [...delegatedKeys].sort().join(",") ||
    !["user", "developer", "operator"].includes(
      String(delegatedRecord["principal_type"]),
    ) ||
    typeof delegatedRecord["principal_id"] !== "string" ||
    typeof delegatedRecord["source_issuer"] !== "string" ||
    typeof delegatedRecord["source_subject"] !== "string" ||
    !Number.isSafeInteger(delegatedRecord["auth_time"]) ||
    (delegatedRecord["auth_time"] as number) < 0 ||
    delegatedRecord["scope_kind"] !== "bot" ||
    !Array.isArray(delegatedRoles) ||
    delegatedRoles.some(
      (entry) => typeof entry !== "string" || entry.length === 0,
    ) ||
    delegatedRoles.length !== new Set(delegatedRoles).size ||
    delegatedRecord["workspace_id"] !== scopeRecord["workspace_id"] ||
    delegatedRecord["bot_id"] !== scopeRecord["bot_id"] ||
    delegatedRecord["owner_agent_id"] !== scopeRecord["owner_agent_id"] ||
    delegatedRecord["deployment_environment"] !==
      scopeRecord["deployment_environment"] ||
    delegatedRecord["release_channel"] !== scopeRecord["release_channel"]
  ) {
    throw new ObservationApplicationErrorV1(
      "bot_permission_denied",
      "observation principal scope is invalid",
      false,
    );
  }
  assertIdentifier(candidate["service_id"], "service_id");
  assertIdentifier(candidate["actor_id"], "actor_id");
  assertIdentifier(
    delegatedRecord["principal_id"] as string,
    "delegated_principal.principal_id",
  );
  assertIdentifier(
    delegatedRecord["source_issuer"] as string,
    "delegated_principal.source_issuer",
  );
  assertIdentifier(
    delegatedRecord["source_subject"] as string,
    "delegated_principal.source_subject",
  );
  assertIdentifier(scopeRecord["workspace_id"], "workspace_id");
  assertIdentifier(scopeRecord["bot_id"], "bot_id");
  assertIdentifier(scopeRecord["owner_agent_id"], "owner_agent_id");
  const observationRoles = (delegatedRoles as readonly string[]).filter(
    (
      role,
    ): role is "observation.viewer" | "observation.debug_viewer" =>
      role === "observation.viewer" ||
      role === "observation.debug_viewer",
  );
  if (
    candidate["actor_id"] !==
      `${String(delegatedRecord["principal_type"])}:${String(
        delegatedRecord["principal_id"],
      )}` ||
    canonicalJsonV1([...(candidate["roles"] as readonly string[])].sort()) !==
      canonicalJsonV1([...observationRoles].sort())
  ) {
    throw new ObservationApplicationErrorV1(
      "bot_permission_denied",
      "observation delegated principal binding is invalid",
      false,
    );
  }
  return snapshot as ObservationPrincipalV1;
}

function snapshotObservationEventStreamInputV1(
  value: ObservationEventStreamInputV1,
): ObservationEventStreamInputV1 {
  const snapshot = snapshotCanonicalJsonV1<unknown>(
    value,
    new ObservationApplicationErrorV1(
      "invalid_request",
      "observation stream input is not bounded canonical JSON",
      false,
    ),
  );
  if (
    typeof snapshot !== "object" ||
    snapshot === null ||
    Array.isArray(snapshot)
  ) {
    throw new ObservationApplicationErrorV1(
      "invalid_request",
      "observation stream input is invalid",
      false,
    );
  }
  const candidate = snapshot as Readonly<Record<string, unknown>>;
  const allowedKeys = new Set([
    "last_event_id",
    "include_ephemeral_tokens",
    "runtime_run_id",
    "trace_id",
  ]);
  if (
    Object.keys(candidate).some((key) => !allowedKeys.has(key)) ||
    typeof candidate["trace_id"] !== "string" ||
    (candidate["last_event_id"] !== undefined &&
      typeof candidate["last_event_id"] !== "string") ||
    (candidate["runtime_run_id"] !== undefined &&
      typeof candidate["runtime_run_id"] !== "string") ||
    (candidate["include_ephemeral_tokens"] !== undefined &&
      typeof candidate["include_ephemeral_tokens"] !== "boolean")
  ) {
    throw new ObservationApplicationErrorV1(
      "invalid_request",
      "observation stream input is invalid",
      false,
    );
  }
  assertIdentifier(candidate["trace_id"], "trace_id");
  if (candidate["last_event_id"] !== undefined) {
    assertIdentifier(candidate["last_event_id"], "last_event_id");
  }
  if (candidate["runtime_run_id"] !== undefined) {
    assertIdentifier(candidate["runtime_run_id"], "runtime_run_id");
  }
  return snapshot as ObservationEventStreamInputV1;
}

function snapshotObservationObjectInputV1(
  value: unknown,
  label: string,
): Readonly<Record<string, unknown>> {
  const snapshot = snapshotCanonicalJsonV1<unknown>(
    value,
    new ObservationApplicationErrorV1(
      "invalid_request",
      `${label} is not bounded canonical JSON`,
      false,
    ),
  );
  if (
    typeof snapshot !== "object" ||
    snapshot === null ||
    Array.isArray(snapshot)
  ) {
    throw new ObservationApplicationErrorV1(
      "invalid_request",
      `${label} is invalid`,
      false,
    );
  }
  return snapshot as Readonly<Record<string, unknown>>;
}

function assertExactInputKeysV1(
  value: Readonly<Record<string, unknown>>,
  allowedKeys: readonly string[],
  label: string,
): void {
  const allowed = new Set(allowedKeys);
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw new ObservationApplicationErrorV1(
      "invalid_request",
      `${label} contains an unsupported field`,
      false,
    );
  }
}

function snapshotObservationProcessReadInputV1(
  value: ObservationProcessReadInputV1,
): ObservationProcessReadInputV1 {
  const snapshot = snapshotObservationObjectInputV1(
    value,
    "observation process read input",
  );
  assertExactInputKeysV1(
    snapshot,
    ["trigger_process_id", "trace_id"],
    "observation process read input",
  );
  if (
    typeof snapshot["trigger_process_id"] !== "string" ||
    typeof snapshot["trace_id"] !== "string"
  ) {
    throw new ObservationApplicationErrorV1(
      "invalid_request",
      "observation process read input is invalid",
      false,
    );
  }
  assertIdentifier(snapshot["trigger_process_id"], "trigger_process_id");
  assertIdentifier(snapshot["trace_id"], "trace_id");
  return snapshot as unknown as ObservationProcessReadInputV1;
}

function snapshotObservationRuntimeDetailsInputV1(
  value: ObservationRuntimeDetailsInputV1,
): ObservationRuntimeDetailsInputV1 {
  const snapshot = snapshotObservationObjectInputV1(
    value,
    "observation runtime details input",
  );
  assertExactInputKeysV1(
    snapshot,
    ["trigger_process_id", "runtime_run_id", "trace_id"],
    "observation runtime details input",
  );
  if (
    typeof snapshot["trigger_process_id"] !== "string" ||
    typeof snapshot["runtime_run_id"] !== "string" ||
    typeof snapshot["trace_id"] !== "string"
  ) {
    throw new ObservationApplicationErrorV1(
      "invalid_request",
      "observation runtime details input is invalid",
      false,
    );
  }
  assertIdentifier(snapshot["trigger_process_id"], "trigger_process_id");
  assertIdentifier(snapshot["runtime_run_id"], "runtime_run_id");
  assertIdentifier(snapshot["trace_id"], "trace_id");
  return snapshot as unknown as ObservationRuntimeDetailsInputV1;
}

function snapshotObservationMetaDetailsInputV1(
  value: ObservationMetaDetailsInputV1,
): ObservationMetaDetailsInputV1 {
  const snapshot = snapshotObservationObjectInputV1(
    value,
    "observation meta details input",
  );
  assertExactInputKeysV1(
    snapshot,
    ["trigger_process_id", "meta_job_id", "trace_id"],
    "observation meta details input",
  );
  if (
    typeof snapshot["trigger_process_id"] !== "string" ||
    typeof snapshot["meta_job_id"] !== "string" ||
    typeof snapshot["trace_id"] !== "string"
  ) {
    throw new ObservationApplicationErrorV1(
      "invalid_request",
      "observation meta details input is invalid",
      false,
    );
  }
  assertIdentifier(snapshot["trigger_process_id"], "trigger_process_id");
  assertIdentifier(snapshot["meta_job_id"], "meta_job_id");
  assertIdentifier(snapshot["trace_id"], "trace_id");
  return snapshot as unknown as ObservationMetaDetailsInputV1;
}

function snapshotObservationToolInvocationQueryInputV1(
  value: ObservationToolInvocationQueryInputV1,
): ObservationToolInvocationQueryInputV1 {
  const snapshot = snapshotObservationObjectInputV1(
    value,
    "observation tool invocation query",
  );
  assertExactInputKeysV1(
    snapshot,
    ["runtime_run_id", "cursor", "limit", "status", "trace_id"],
    "observation tool invocation query",
  );
  if (
    typeof snapshot["trace_id"] !== "string" ||
    (snapshot["runtime_run_id"] !== undefined &&
      typeof snapshot["runtime_run_id"] !== "string") ||
    (snapshot["cursor"] !== undefined &&
      typeof snapshot["cursor"] !== "string") ||
    (snapshot["limit"] !== undefined &&
      (typeof snapshot["limit"] !== "number" ||
        !Number.isSafeInteger(snapshot["limit"]) ||
        snapshot["limit"] < 1 ||
        snapshot["limit"] > 200)) ||
    (snapshot["status"] !== undefined &&
      (typeof snapshot["status"] !== "string" ||
        !TOOL_INVOCATION_QUERY_STATUSES_V1.includes(
          snapshot["status"] as (typeof TOOL_INVOCATION_QUERY_STATUSES_V1)[number],
        )))
  ) {
    throw new ObservationApplicationErrorV1(
      "invalid_request",
      "observation tool invocation query is invalid",
      false,
    );
  }
  assertIdentifier(snapshot["trace_id"], "trace_id");
  if (snapshot["runtime_run_id"] !== undefined) {
    assertIdentifier(snapshot["runtime_run_id"], "runtime_run_id");
  }
  if (snapshot["cursor"] !== undefined) {
    assertIdentifier(snapshot["cursor"], "cursor");
  }
  return snapshot as unknown as ObservationToolInvocationQueryInputV1;
}

function snapshotObservationQualitySignalQueryInputV1(
  value: ObservationQualitySignalQueryInputV1,
): ObservationQualitySignalQueryInputV1 {
  const snapshot = snapshotObservationObjectInputV1(
    value,
    "observation quality signal query",
  );
  assertExactInputKeysV1(
    snapshot,
    ["cursor", "limit", "severity", "signal_type", "trace_id"],
    "observation quality signal query",
  );
  if (
    typeof snapshot["trace_id"] !== "string" ||
    (snapshot["cursor"] !== undefined &&
      typeof snapshot["cursor"] !== "string") ||
    (snapshot["limit"] !== undefined &&
      (typeof snapshot["limit"] !== "number" ||
        !Number.isSafeInteger(snapshot["limit"]) ||
        snapshot["limit"] < 1 ||
        snapshot["limit"] > 200)) ||
    (snapshot["severity"] !== undefined &&
      (typeof snapshot["severity"] !== "string" ||
        !qualitySeverities.has(snapshot["severity"]))) ||
    (snapshot["signal_type"] !== undefined &&
      (typeof snapshot["signal_type"] !== "string" ||
        !QUALITY_SIGNAL_TYPES_V1.includes(
          snapshot["signal_type"] as (typeof QUALITY_SIGNAL_TYPES_V1)[number],
        )))
  ) {
    throw new ObservationApplicationErrorV1(
      "invalid_request",
      "observation quality signal query is invalid",
      false,
    );
  }
  assertIdentifier(snapshot["trace_id"], "trace_id");
  if (snapshot["cursor"] !== undefined) {
    assertIdentifier(snapshot["cursor"], "cursor");
  }
  return snapshot as unknown as ObservationQualitySignalQueryInputV1;
}

function assertSignalActiveV1(signal: AbortSignal | undefined): void {
  if (signal?.aborted !== true) return;
  throw signal.reason instanceof Error
    ? signal.reason
    : new ObservationApplicationErrorV1(
        "upstream_unavailable",
        "observation stream preparation was cancelled",
        true,
      );
}

function mapUpstreamError(error: unknown): never {
  if (!(error instanceof ObservationUpstreamErrorV1)) {
    throw new ObservationApplicationErrorV1(
      "upstream_unavailable",
      "observation upstream is unavailable",
      true,
    );
  }
  if (error.code === "permission_denied") {
    throw new ObservationApplicationErrorV1(
      "bot_permission_denied",
      "bot or process access is denied",
      false,
    );
  }
  if (error.code === "not_found") {
    throw new ObservationApplicationErrorV1(
      "process_not_found",
      "trigger process was not found",
      false,
    );
  }
  if (error.code === "replay_expired") {
    throw new ObservationApplicationErrorV1(
      "replay_expired",
      "durable replay cursor is expired",
      false,
    );
  }
  if (error.code === "cursor_ahead") {
    throw new ObservationApplicationErrorV1(
      "replay_cursor_ahead",
      "durable replay cursor is ahead of the owner watermark",
      false,
      { upstream: error.upstream },
    );
  }
  if (error.code === "rate_limited") {
    throw new ObservationApplicationErrorV1(
      "rate_limited",
      "observation request is rate limited",
      true,
    );
  }
  if (error.code === "schema_mismatch") {
    throw new ObservationApplicationErrorV1(
      "upstream_schema_mismatch",
      `${error.upstream} owner response does not match its schema`,
      false,
      { upstream: error.upstream },
    );
  }
  if (error.code === "resource_mismatch") {
    throw new ObservationApplicationErrorV1(
      "runtime_run_mismatch",
      "debug resource does not belong to the authorized process",
      false,
    );
  }
  throw new ObservationApplicationErrorV1(
    "upstream_unavailable",
    `${error.upstream} is unavailable`,
    true,
    { upstream: error.upstream },
  );
}

function mapAuthorizedOwnerError(
  error: unknown,
  upstream: ObservationUpstreamV1,
): never {
  if (
    error instanceof ObservationUpstreamErrorV1 &&
    error.code === "not_found"
  ) {
    throw new ObservationApplicationErrorV1(
      "upstream_unavailable",
      `${upstream} authorized projection is not available`,
      true,
      { upstream },
    );
  }
  mapUpstreamError(error);
}

function sha256CanonicalJson(value: unknown): `sha256:${string}` {
  return `sha256:${createHash("sha256")
    .update(canonicalJsonV1(value), "utf8")
    .digest("hex")}`;
}

function processSnapshotLogicalHash(
  value: TriggerProcessSnapshotReadContractV1["snapshot_manifest"],
): `sha256:${string}` {
  return sha256CanonicalJson(
    Object.fromEntries(
      Object.entries(value).filter(([key]) => key !== "snapshot_hash"),
    ),
  );
}

function validateObservationProcessSnapshotReadV1(
  request: TriggerProcessSnapshotResolveRequestV1,
  readValue: unknown,
  now: Date,
): TriggerProcessSnapshotReadContractV1 {
  try {
    Date.prototype.getTime.call(now);
  } catch {
    throw new ObservationApplicationErrorV1(
      "upstream_unavailable",
      "Observation authoritative clock is unavailable",
      true,
    );
  }
  const nowMs = Date.prototype.getTime.call(now);
  if (!Number.isFinite(nowMs)) {
    throw new ObservationApplicationErrorV1(
      "upstream_unavailable",
      "Observation authoritative clock is unavailable",
      true,
    );
  }
  const read =
    snapshotCanonicalUpstreamValueV1<TriggerProcessSnapshotReadContractV1>(
      readValue,
      "trigger_processor",
      "Trigger Processor snapshot read",
    );
  if (!Value.Check(TriggerProcessSnapshotReadContractV1Schema, read)) {
    throw new ObservationApplicationErrorV1(
      "upstream_schema_mismatch",
      "Trigger Processor snapshot read does not match its owner schema",
      false,
      { upstream: "trigger_processor" },
    );
  }
  try {
    assertTriggerProcessSnapshotSemanticBindingsV1(read.snapshot_manifest);
    assertTriggerProcessSnapshotReadBindingsV1(request, read);
  } catch {
    throw new ObservationApplicationErrorV1(
      "upstream_schema_mismatch",
      "Trigger Processor snapshot read violates owner bindings",
      false,
      { upstream: "trigger_processor" },
    );
  }
  if (
    processSnapshotLogicalHash(read.snapshot_manifest) !==
      request.expected_snapshot_hash ||
    !Number.isFinite(
      Date.parse(read.snapshot_manifest.snapshot_retention_until),
    ) ||
    Date.parse(read.snapshot_manifest.snapshot_retention_until) <= nowMs ||
    read.snapshot_manifest.event_trace.some(
      (event) => event.event_type === "runtime.token",
    ) ||
    read.snapshot_manifest.overflow_refs.some(
      (overflow) =>
        (overflow.redaction_state !== "not_required" &&
          overflow.redaction_state !== "complete") ||
        !Number.isFinite(Date.parse(overflow.retention_until)) ||
        Date.parse(overflow.retention_until) <= nowMs,
    )
  ) {
    throw new ObservationApplicationErrorV1(
      "upstream_schema_mismatch",
      "Trigger Processor snapshot owner facts failed integrity, retention, or redaction validation",
      false,
      { upstream: "trigger_processor" },
    );
  }
  for (const chunk of read.content_chunks) {
    if (
      (chunk.redaction_state !== "not_required" &&
        chunk.redaction_state !== "complete") ||
      !Number.isFinite(Date.parse(chunk.retention_until)) ||
      Date.parse(chunk.retention_until) <= nowMs ||
      ("inline_content" in chunk &&
        sha256CanonicalJson(chunk.inline_content) !== chunk.checksum)
    ) {
      throw new ObservationApplicationErrorV1(
        "upstream_schema_mismatch",
        "Trigger Processor snapshot content failed checksum, retention, or redaction validation",
        false,
        { upstream: "trigger_processor" },
      );
    }
  }
  return read;
}

export interface ObservationApplicationOptionsV1 {
  readonly buffer_max_events?: number;
  readonly buffer_max_bytes?: number;
  readonly on_audit_failure?: (
    failure: Readonly<{
      result:
        | "commit_unknown"
        | "unavailable"
        | "capacity_exceeded";
      audit_id: string;
    }>,
  ) => void;
  readonly owner_reads?: ObservationTriggerProcessorOwnerReadPortV1;
  /** Wall/security clock used for credential leases, audit timestamps and owner retention checks. */
  readonly now?: () => Date;
  /** Monotonic elapsed-time source used only for connection durations. */
  readonly monotonic_now_ms?: () => number;
  readonly require_durable_audit_handoff?: boolean;
}

export class ObservationApplicationV1 {
  readonly #bufferMaxEvents: number;
  readonly #bufferMaxBytes: number;
  readonly #onAuditFailure:
    | ObservationApplicationOptionsV1["on_audit_failure"]
    | undefined;
  readonly #preparedStreams = new WeakSet<object>();
  readonly #ownerReads:
    | ObservationTriggerProcessorOwnerReadPortV1
    | undefined;
  readonly #now: () => Date;
  readonly #monotonicNowMs: () => number;
  #requireDurableAuditHandoff: boolean;

  public constructor(
    private readonly triggerProcessor: ObservationTriggerProcessorPortV1,
    private readonly runtime: ObservationRuntimePortV1,
    private readonly meta: ObservationMetaPortV1,
    private readonly audit: ObservationAccessAuditSpoolPortV1,
    options: ObservationApplicationOptionsV1 = {},
  ) {
    this.#bufferMaxEvents = options.buffer_max_events ?? 256;
    this.#bufferMaxBytes = options.buffer_max_bytes ?? 1_048_576;
    this.#onAuditFailure = options.on_audit_failure;
    this.#ownerReads = options.owner_reads;
    this.#now = options.now ?? (() => new Date());
    this.#monotonicNowMs =
      options.monotonic_now_ms ?? (() => performance.now());
    this.#requireDurableAuditHandoff =
      options.require_durable_audit_handoff ?? false;
  }

  public requireDurableAuditHandoffV1(): void {
    this.#requireDurableAuditHandoff = true;
  }

  private wallClockNow(): Date {
    let value: Date;
    try {
      value = this.#now();
    } catch {
      throw new ObservationApplicationErrorV1(
        "upstream_unavailable",
        "observation security clock is unavailable",
        true,
      );
    }
    const epochMs = value instanceof Date ? value.getTime() : Number.NaN;
    if (!Number.isFinite(epochMs)) {
      throw new ObservationApplicationErrorV1(
        "upstream_unavailable",
        "observation security clock is unavailable",
        true,
      );
    }
    return new Date(epochMs);
  }

  private wallClockNowMs(): number {
    return this.wallClockNow().getTime();
  }

  private monotonicNowMs(): number {
    let value: number;
    try {
      value = this.#monotonicNowMs();
    } catch {
      throw new ObservationApplicationErrorV1(
        "upstream_unavailable",
        "observation monotonic clock is unavailable",
        true,
      );
    }
    if (
      !Number.isFinite(value) ||
      value < 0 ||
      value > Number.MAX_SAFE_INTEGER
    ) {
      throw new ObservationApplicationErrorV1(
        "upstream_unavailable",
        "observation monotonic clock is unavailable",
        true,
      );
    }
    return value;
  }

  private elapsedMs(startedAtMonotonicMs: number): number {
    const elapsed = this.monotonicNowMs() - startedAtMonotonicMs;
    if (!Number.isFinite(elapsed) || elapsed < 0) {
      throw new ObservationApplicationErrorV1(
        "upstream_unavailable",
        "observation monotonic clock regressed",
        true,
      );
    }
    return Math.round(elapsed);
  }

  public async checkReadiness(
    requireDurableAudit = false,
    requireOwnerReads = false,
  ): Promise<void> {
    this.wallClockNow();
    this.monotonicNowMs();
    if (requireDurableAudit) {
      this.requireDurableAuditHandoffV1();
    }
    await Promise.all([
      this.triggerProcessor.checkReadiness(),
      this.runtime.checkReadiness(),
      this.meta.checkReadiness(),
      this.audit.checkReadiness(),
      ...(this.#ownerReads === undefined
        ? []
        : [this.#ownerReads.checkReadiness()]),
    ]);
    await this.audit.replay();
    if (
      requireDurableAudit &&
      this.audit.durability !== "durable_spool"
    ) {
      throw new Error("production requires a durable access-audit spool");
    }
    if (requireOwnerReads && this.#ownerReads === undefined) {
      throw new Error(
        "production requires Trigger Processor snapshot owner-read ports",
      );
    }
  }

  private assertViewer(principal: ObservationPrincipalV1): void {
    if (
      !principal.capabilities.includes("observation.read") ||
      !principal.roles.some(
        (role) =>
          role === "observation.viewer" ||
          role === "observation.debug_viewer",
      )
    ) {
      throw new ObservationApplicationErrorV1(
        "bot_permission_denied",
        "observation viewer permission is required",
        false,
      );
    }
  }

  private assertDebug(principal: ObservationPrincipalV1): void {
    if (
      !principal.roles.includes("observation.debug_viewer")
    ) {
      throw new ObservationApplicationErrorV1(
        "debug_permission_denied",
        "observation debug permission is required",
        false,
      );
    }
    if (this.audit.durability !== "durable_spool") {
      throw new ObservationApplicationErrorV1(
        "audit_unavailable",
        "debug access requires a durable access-audit spool",
        true,
      );
    }
    if (
      principal.credential_expires_at_epoch_seconds !== undefined &&
      principal.credential_expires_at_epoch_seconds * 1_000 <=
        this.wallClockNowMs()
    ) {
      throw new ObservationApplicationErrorV1(
        "debug_permission_denied",
        "workload credential is expired",
        false,
      );
    }
  }

  private assertStreamCredentialActive(
    principal: ObservationPrincipalV1,
    debug: boolean,
  ): void {
    if (
      principal.credential_expires_at_epoch_seconds !== undefined &&
      principal.credential_expires_at_epoch_seconds * 1_000 <=
        this.wallClockNowMs()
    ) {
      throw new ObservationApplicationErrorV1(
        debug ? "debug_permission_denied" : "bot_permission_denied",
        "workload credential is expired",
        false,
      );
    }
  }

  private assertRequestCredentialActive(
    principal: ObservationPrincipalV1,
  ): void {
    const nowEpochSeconds = Math.floor(this.wallClockNowMs() / 1_000);
    const expiresAt = principal.credential_expires_at_epoch_seconds;
    if (
      (expiresAt !== undefined && expiresAt <= nowEpochSeconds) ||
      principal.delegated_principal.auth_time > nowEpochSeconds + 60 ||
      (expiresAt !== undefined &&
        principal.delegated_principal.auth_time >= expiresAt)
    ) {
      throw new ObservationApplicationErrorV1(
        "bot_permission_denied",
        "observation authorization lease is expired or invalid",
        false,
      );
    }
  }

  private async authorizeProcess(
    principal: ObservationPrincipalV1,
    processId: string,
    traceId: string,
    signal?: AbortSignal,
  ): Promise<TriggerProcessQueryDetailsV1> {
    const principalSnapshot = snapshotObservationPrincipalV1(principal);
    this.assertViewer(principalSnapshot);
    this.assertRequestCredentialActive(principalSnapshot);
    assertIdentifier(processId, "trigger_process_id");
    assertIdentifier(traceId, "trace_id");
    assertSignalActiveV1(signal);
    const ownerInput = deepFreezeObservationJsonV1({
      workload: {
        sub: "observation_gateway" as const,
        aud: "trigger_processor" as const,
        capabilities: [
          "trigger.context_snapshot.resolve",
          "trigger.process.read",
          "trigger.process.snapshot.resolve",
        ] as const,
      },
      delegated_principal: principalSnapshot.delegated_principal,
      scope: principalSnapshot.scope,
      trigger_process_id: processId,
      trace_id: traceId,
    });
    let value: unknown;
    try {
      value = await this.triggerProcessor.getProcess(ownerInput, signal);
    } catch (error) {
      assertSignalActiveV1(signal);
      mapUpstreamError(error);
    }
    assertSignalActiveV1(signal);
    const snapshot =
      snapshotCanonicalUpstreamValueV1<TriggerProcessQueryDetailsV1>(
      value,
      "trigger_processor",
      "trigger processor owner response",
    );
    if (!Value.Check(TriggerProcessQueryDetailsV1Schema, snapshot)) {
      throw new ObservationApplicationErrorV1(
        "upstream_schema_mismatch",
        "trigger processor owner response does not match its schema",
        false,
        { upstream: "trigger_processor" },
      );
    }
    try {
      assertTriggerProcessQueryDetailsV1(snapshot);
    } catch {
      throw new ObservationApplicationErrorV1(
        "upstream_schema_mismatch",
        "trigger processor owner response violates semantic bindings",
        false,
        { upstream: "trigger_processor" },
      );
    }
    if (
      snapshot.id !== processId ||
      !sameScope(snapshot, principalSnapshot.scope)
    ) {
      throw new ObservationApplicationErrorV1(
        "bot_permission_denied",
        "bot or process access is denied",
        false,
      );
    }
    return snapshot;
  }

  private ownerReadPort(): ObservationTriggerProcessorOwnerReadPortV1 {
    if (this.#ownerReads === undefined) {
      throw new ObservationApplicationErrorV1(
        "upstream_unavailable",
        "Trigger Processor snapshot owner-read dependency is not composed",
        true,
        { upstream: "trigger_processor" },
      );
    }
    return this.#ownerReads;
  }

  private async resolveReplaySnapshotResult(
    principalSnapshot: ObservationPrincipalV1,
    inputSnapshot: ObservationProcessReadInputV1,
    signal: AbortSignal = new AbortController().signal,
  ): Promise<TriggerProcessSnapshotReadContractV1> {
    assertSignalActiveV1(signal);
    this.assertDebug(principalSnapshot);
    const process = await this.authorizeProcess(
      principalSnapshot,
      inputSnapshot.trigger_process_id,
      inputSnapshot.trace_id,
      signal,
    );
    assertSignalActiveV1(signal);
    const reference = process.process_snapshot_identity;
    if (reference === null) {
      throw new ObservationApplicationErrorV1(
        "upstream_unavailable",
        "Trigger Process has no current snapshot identity",
        true,
        { upstream: "trigger_processor" },
      );
    }
    const request = deepFreezeObservationJsonV1({
      schema_version: "trigger_process_snapshot_resolve_request.v1",
      trigger_process_id: process.id,
      workspace_id: principalSnapshot.scope.workspace_id,
      bot_id: principalSnapshot.scope.bot_id,
      owner_agent_id: principalSnapshot.scope.owner_agent_id,
      deployment_environment:
        principalSnapshot.scope.deployment_environment,
      release_channel: principalSnapshot.scope.release_channel,
      snapshot_ref: reference.snapshot_ref,
      expected_snapshot_version: reference.snapshot_version,
      expected_snapshot_hash: reference.snapshot_hash,
      purpose: "observation_replay",
      trace_id: inputSnapshot.trace_id,
    }) satisfies TriggerProcessSnapshotResolveRequestV1;
    if (!Value.Check(TriggerProcessSnapshotResolveRequestV1Schema, request)) {
      throw new ObservationApplicationErrorV1(
        "invalid_request",
        "Trigger Process snapshot reference is invalid",
        false,
      );
    }
    let read: unknown;
    try {
      read = await this.ownerReadPort().resolveProcessSnapshot(
        deepFreezeObservationJsonV1({
          workload: {
            sub: "observation_gateway",
            aud: "trigger_processor",
            capability: "trigger.process.snapshot.resolve",
          },
          delegated_principal:
            principalSnapshot.delegated_principal,
          request,
        }),
        signal,
      );
    } catch (error) {
      assertSignalActiveV1(signal);
      mapAuthorizedOwnerError(error, "trigger_processor");
    }
    assertSignalActiveV1(signal);
    const result = validateObservationProcessSnapshotReadV1(
      request,
      read,
      this.wallClockNow(),
    );
    this.assertDebug(principalSnapshot);
    await this.enqueueAudit(
      this.auditRecord(principalSnapshot, {
        resource_type: "trigger_process_snapshot",
        resource_id: reference.snapshot_ref,
        endpoint: "snapshot_replay",
        decision: "allowed_debug",
        status_code: 200,
        trace_id: inputSnapshot.trace_id,
      }),
      true,
      signal,
    );
    assertSignalActiveV1(signal);
    return result;
  }

  private async resolveAuditContextSnapshotResult(
    principalSnapshot: ObservationPrincipalV1,
    inputSnapshot: ObservationProcessReadInputV1,
    signal: AbortSignal = new AbortController().signal,
  ): Promise<ContextSnapshotV1> {
    assertSignalActiveV1(signal);
    this.assertDebug(principalSnapshot);
    const process = await this.authorizeProcess(
      principalSnapshot,
      inputSnapshot.trigger_process_id,
      inputSnapshot.trace_id,
      signal,
    );
    assertSignalActiveV1(signal);
    const reference = process.context_snapshot_identity;
    if (reference === null) {
      throw new ObservationApplicationErrorV1(
        "upstream_unavailable",
        "Trigger Process has no current ContextSnapshot identity",
        true,
        { upstream: "trigger_processor" },
      );
    }
    const request = deepFreezeObservationJsonV1({
      schema_version: "context_snapshot_resolve_request.v1",
      consumer_service: "observation_gateway",
      trigger_process_id: process.id,
      workspace_id: principalSnapshot.scope.workspace_id,
      bot_id: principalSnapshot.scope.bot_id,
      owner_agent_id: principalSnapshot.scope.owner_agent_id,
      deployment_environment:
        principalSnapshot.scope.deployment_environment,
      release_channel: principalSnapshot.scope.release_channel,
      context_snapshot_ref: reference.context_snapshot_ref,
      context_snapshot_version: reference.context_snapshot_version,
      context_snapshot_hash: reference.context_snapshot_hash,
      purpose: "audit_replay",
      trace_id: inputSnapshot.trace_id,
    }) satisfies ContextSnapshotResolveRequestV1;
    if (!Value.Check(ContextSnapshotResolveRequestV1Schema, request)) {
      throw new ObservationApplicationErrorV1(
        "invalid_request",
        "Context snapshot reference is invalid",
        false,
      );
    }
    let read: unknown;
    try {
      read = await this.ownerReadPort().resolveContextSnapshot(
        deepFreezeObservationJsonV1({
          workload: {
            sub: "observation_gateway",
            aud: "trigger_processor",
            capability: "trigger.context_snapshot.resolve",
          },
          delegated_principal:
            principalSnapshot.delegated_principal,
          request,
        }),
        signal,
      );
    } catch (error) {
      assertSignalActiveV1(signal);
      mapAuthorizedOwnerError(error, "trigger_processor");
    }
    assertSignalActiveV1(signal);
    try {
      const readSnapshot = snapshotCanonicalUpstreamValueV1<unknown>(
        read,
        "trigger_processor",
        "Trigger Processor ContextSnapshot read",
      );
      const result = deepFreezeObservationJsonV1(
        materializeContextSnapshotReadV1(request, readSnapshot, {
          now: () => this.wallClockNow(),
        }),
      );
      this.assertDebug(principalSnapshot);
      await this.enqueueAudit(
        this.auditRecord(principalSnapshot, {
          resource_type: "context_snapshot",
          resource_id: reference.context_snapshot_ref,
          endpoint: "context_snapshot_audit",
          decision: "allowed_debug",
          status_code: 200,
          trace_id: inputSnapshot.trace_id,
        }),
        true,
        signal,
      );
      assertSignalActiveV1(signal);
      return result;
    } catch (error) {
      if (error instanceof ObservationApplicationErrorV1) throw error;
      throw new ObservationApplicationErrorV1(
        "upstream_schema_mismatch",
        "Trigger Processor ContextSnapshot read failed canonical integrity validation",
        false,
        { upstream: "trigger_processor" },
      );
    }
  }

  private mapProcess(
    value: TriggerProcessQueryDetailsV1,
  ): RedactionResultV1<
    ObservationSnapshotResponseV1["trigger_process"]
  > {
    const allowed = new Set([
      "id",
      "trigger_id",
      "bot_id",
      "phase",
      "status",
      "terminal_reason",
      "terminal_outcome",
      "terminal_outcome_finalized_at",
      "canonical_reason_code",
      "successor_process_id",
      "snapshot_transfer_ref",
      "boundary_system_event_ref",
      "cooldown_until",
      "snapshot_retention_until",
      "runtime_run_id",
      "meta_job_id",
      "meta_status",
      "meta_summary_ref",
      "observation_finalized",
    ]);
    let redacted = Object.keys(value).filter((key) => !allowed.has(key)).length;
    const terminalReason = sanitizeNullableReference(
      value.terminal_reason,
    );
    const canonicalReasonCode = sanitizeNullableReference(
      value.canonical_reason_code,
    );
    const successorProcessId = sanitizeNullableReference(
      value.successor_process_id,
    );
    const snapshotTransferRef = sanitizeNullableReference(
      value.snapshot_transfer_ref,
    );
    const boundarySystemEventRef = sanitizeNullableReference(
      value.boundary_system_event_ref,
    );
    const metaSummaryRef = sanitizeNullableReference(
      value.meta_summary_ref,
    );
    redacted +=
      terminalReason.redacted +
      canonicalReasonCode.redacted +
      successorProcessId.redacted +
      snapshotTransferRef.redacted +
      boundarySystemEventRef.redacted +
      metaSummaryRef.redacted;
    return {
      value: {
        id: value.id,
        trigger_id: value.trigger_id,
        bot_id: value.bot_id,
        phase: value.phase,
        status: value.status,
        terminal_reason: terminalReason.value,
        terminal_outcome: value.terminal_outcome,
        terminal_outcome_finalized_at:
          value.terminal_outcome_finalized_at,
        canonical_reason_code: canonicalReasonCode.value,
        successor_process_id: successorProcessId.value,
        snapshot_transfer_ref: snapshotTransferRef.value,
        boundary_system_event_ref: boundarySystemEventRef.value,
        cooldown_until: value.cooldown_until,
        snapshot_retention_until: value.snapshot_retention_until,
        runtime_run_id: value.runtime_run_id,
        meta_job_id: value.meta_job_id,
        meta_status: value.meta_status,
        meta_summary_ref: metaSummaryRef.value,
        observation_finalized: value.observation_finalized,
      },
      redacted,
    };
  }

  private validateResourceBinding(
    value: Readonly<Record<string, unknown>>,
    principal: ObservationPrincipalV1,
    processId: string,
    resourceField: "runtime_run_id" | "job_id",
    expectedResourceId: string,
  ): void {
    const scope = principal.scope;
    if (
      value["trigger_process_id"] !== processId ||
      value[resourceField] !== expectedResourceId ||
      value["workspace_id"] !== scope.workspace_id ||
      value["bot_id"] !== scope.bot_id ||
      value["owner_agent_id"] !== scope.owner_agent_id ||
      value["deployment_environment"] !== scope.deployment_environment ||
      value["release_channel"] !== scope.release_channel
    ) {
      throw new ObservationApplicationErrorV1(
        resourceField === "runtime_run_id"
          ? "runtime_run_mismatch"
          : "bot_permission_denied",
        "upstream resource binding does not match the authorized process",
        false,
      );
    }
  }

  private mapRuntime(
    value: RuntimeRunQueryDetailsV1["runtime_run"],
  ): RedactionResultV1<
    Exclude<ObservationSnapshotResponseV1["runtime"], null>
  > {
    const allowed = new Set([
      "runtime_run_id",
      "status",
      "started_at",
      "completed_at",
      "terminal_reason",
    ]);
    let redacted = Object.keys(value).filter((key) => !allowed.has(key)).length;
    const terminalReason = sanitizeNullableReference(
      value.terminal_reason,
    );
    redacted += terminalReason.redacted;
    return {
      value: {
        runtime_run_id: value.runtime_run_id,
        status: value.status,
        started_at: value.started_at,
        completed_at: value.completed_at,
        terminal_reason: terminalReason.value,
      },
      redacted,
    };
  }

  private mapMeta(
    value: MetaJobQueryDetailsV1,
  ): RedactionResultV1<
    Exclude<ObservationSnapshotResponseV1["meta"], null>
  > {
    const allowed = new Set([
      "job_id",
      "trigger_process_id",
      "bot_id",
      "status",
      "result_status",
      "summary",
      "error",
      "updated_at",
    ]);
    let redacted = Object.keys(value).filter((key) => !allowed.has(key)).length;
    const error =
      value.error === null
        ? undefined
        : sanitizeText(value.error.message);
    redacted += error?.redacted ?? 0;
    if (value.summary !== null) {
      redacted += Object.keys(value.summary).filter(
        (key) =>
          key !== "quality_signals_count" &&
          key !== "partial_failures_count",
      ).length;
    }
    if (value.error !== null) {
      redacted += Object.keys(value.error).filter(
        (key) => key !== "message",
      ).length;
    }
    const counts =
      value.summary === null
        ? { quality_signals_count: 0, partial_failures_count: 0 }
        : {
            quality_signals_count: value.summary.quality_signals_count,
            partial_failures_count: value.summary.partial_failures_count,
          };
    return {
      value: {
        job_id: value.job_id,
        status: value.status,
        result_status: value.result_status,
        updated_at: value.updated_at,
        ...counts,
        ...(error === undefined ? {} : { error_summary: error.value }),
      },
      redacted,
    };
  }

  private validateMetaBinding(
    value: MetaJobQueryDetailsV1,
    principal: ObservationPrincipalV1,
    processId: string,
    expectedJobId: string,
  ): void {
    if (
      value.trigger_process_id !== processId ||
      value.job_id !== expectedJobId ||
      value.bot_id !== principal.scope.bot_id
    ) {
      throw new ObservationApplicationErrorV1(
        "bot_permission_denied",
        "meta resource binding does not match the authorized process",
        false,
      );
    }
  }

  private validateRuntimeBinding(
    value: RuntimeRunQueryDetailsV1,
    principal: ObservationPrincipalV1,
    processId: string,
    expectedRunId: string,
  ): void {
    this.validateResourceBinding(
      value.runtime_run as unknown as Readonly<Record<string, unknown>>,
      principal,
      processId,
      "runtime_run_id",
      expectedRunId,
    );
  }

  private auditRecord(
    principal: ObservationPrincipalV1,
    input: Readonly<{
      resource_type: string;
      resource_id: string;
      endpoint: string;
      include_ephemeral_tokens?: boolean;
      decision: string;
      status_code: number;
      trace_id: string;
      connection_duration_ms?: number;
      redacted_field_count?: number;
    }>,
  ): ObservationAccessAuditRecordV1 {
    return Object.freeze({
      audit_id: `oa_${randomUUID()}`,
      occurred_at: this.wallClockNow().toISOString(),
      actor_identity: principal.actor_id,
      service_identity: principal.service_id,
      roles: Object.freeze([...principal.roles].sort()),
      ...principal.scope,
      resource_type: input.resource_type,
      resource_id: input.resource_id,
      endpoint: input.endpoint,
      include_ephemeral_tokens:
        input.include_ephemeral_tokens ?? false,
      decision: input.decision,
      status_code: input.status_code,
      trace_id: input.trace_id,
      connection_duration_ms: input.connection_duration_ms ?? 0,
      redacted_field_count: input.redacted_field_count ?? 0,
    });
  }

  private async enqueueAudit(
    recordValue: ObservationAccessAuditRecordV1,
    debug: boolean,
    signal?: AbortSignal,
  ): Promise<void> {
    assertSignalActiveV1(signal);
    if (
      (debug || this.#requireDurableAuditHandoff) &&
      this.audit.durability !== "durable_spool"
    ) {
      throw new ObservationApplicationErrorV1(
        "audit_unavailable",
        "durable access audit queue is not composed",
        true,
      );
    }
    let result:
      | "durable"
      | "commit_unknown"
      | "unavailable"
      | "capacity_exceeded";
    const attempt = async (): Promise<typeof result> => {
      try {
        return await this.audit.enqueue(recordValue, signal);
      } catch {
        assertSignalActiveV1(signal);
        // An adapter exception may happen after its durable commit. Retry the
        // exact same audit_id so a conforming spool can deduplicate or return
        // the already committed record instead of manufacturing a second fact.
        return "commit_unknown";
      }
    };
    result = await attempt();
    if (result === "commit_unknown") {
      result = await attempt();
    }
    assertSignalActiveV1(signal);
    if (result === "durable") {
      return;
    }
    try {
      this.#onAuditFailure?.({
        result,
        audit_id: recordValue.audit_id,
      });
    } catch {
      // Alert delivery is best-effort and must not change access semantics.
    }
    if (debug || this.#requireDurableAuditHandoff) {
      throw new ObservationApplicationErrorV1(
        "audit_unavailable",
        "durable access audit queue is unavailable",
        true,
      );
    }
  }

  private async auditFailedAccess(
    principal: ObservationPrincipalV1,
    input: Readonly<{
      resource_type: string;
      resource_id: string;
      endpoint: string;
      trace_id: string;
      include_ephemeral_tokens?: boolean;
    }>,
    error: unknown,
    requireDurable = false,
  ): Promise<void> {
    if (
      error instanceof ObservationApplicationErrorV1 &&
      error.code === "audit_unavailable"
    ) {
      // The original stable audit_id has already been handed to the spool
      // twice. Creating a second, contradictory "failed" fact here would
      // defeat commit-unknown convergence and can double-record one request.
      return;
    }
    const code =
      error instanceof ObservationApplicationErrorV1
        ? error.code
        : "upstream_unavailable";
    const statusCode =
      code === "invalid_request"
        ? 400
        : code === "bot_permission_denied" ||
            code === "debug_permission_denied"
          ? 403
          : code === "process_not_found"
            ? 404
            : code === "runtime_run_mismatch" ||
                code === "replay_cursor_ahead"
              ? 409
              : code === "replay_expired"
                ? 410
                : code === "rate_limited"
                  ? 429
                  : code === "upstream_schema_mismatch"
                    ? 502
                    : 503;
    const denied =
      statusCode === 403 ||
      statusCode === 404 ||
      statusCode === 409;
    await this.enqueueAudit(
      this.auditRecord(principal, {
        ...input,
        decision: denied ? "denied" : "failed",
        status_code: statusCode,
      }),
      requireDurable,
    );
  }

  private async composeSnapshot(
    principal: ObservationPrincipalV1,
    process: TriggerProcessQueryDetailsV1,
    traceId: string,
  ): Promise<ObservationSnapshotResponseV1> {
    const degraded = new Set<
      ObservationSnapshotResponseV1["degraded_flags"][number]
    >();
    const processProjection = this.mapProcess(process);
    let redacted = processProjection.redacted;
    let runtimeSummary: ObservationSnapshotResponseV1["runtime"] = null;
    let metaSummary: ObservationSnapshotResponseV1["meta"] = null;

    const runtimePromise =
      process.runtime_run_id === null
        ? Promise.resolve()
        : this.runtime
            .getRun(deepFreezeObservationJsonV1({
              workload: {
                sub: "observation_gateway",
                aud: "action_runtime",
                capability: "runtime.run.read",
              },
              delegated_principal: principal.delegated_principal,
              scope: principal.scope,
              trigger_process_id: process.id,
              runtime_run_id: process.runtime_run_id,
              trace_id: traceId,
            }))
            .then((raw) => {
              const validated = runtimeRunDetails(raw);
              this.validateRuntimeBinding(
                validated,
                principal,
                process.id,
                process.runtime_run_id as string,
              );
              const mapped = this.mapRuntime(validated.runtime_run);
              runtimeSummary = mapped.value;
              redacted += mapped.redacted;
            })
            .catch((error: unknown) => {
              if (
                error instanceof ObservationUpstreamErrorV1 &&
                (error.code === "unavailable" ||
                  error.code === "timeout" ||
                  error.code === "not_found")
              ) {
                degraded.add(
                  error.code === "timeout"
                    ? "optional_detail_timeout"
                    : "runtime_unavailable",
                );
                return;
              }
              if (error instanceof ObservationApplicationErrorV1) throw error;
              mapUpstreamError(error);
            });

    const metaPromise =
      process.meta_job_id === null
        ? Promise.resolve()
        : this.meta
            .getJob(deepFreezeObservationJsonV1({
              workload: {
                sub: "observation_gateway",
                aud: "meta_cognition",
                capability: "meta.job.read",
              },
              delegated_principal: principal.delegated_principal,
              scope: principal.scope,
              trigger_process_id: process.id,
              meta_job_id: process.meta_job_id,
              trace_id: traceId,
            }))
            .then((raw) => {
              const validated = metaJobDetails(raw);
              this.validateMetaBinding(
                validated,
                principal,
                process.id,
                process.meta_job_id as string,
              );
              const mapped = this.mapMeta(validated);
              metaSummary = mapped.value;
              redacted += mapped.redacted;
              if (mapped.value.status !== process.meta_status) {
                degraded.add("meta_projection_lag");
              }
            })
            .catch((error: unknown) => {
              if (
                error instanceof ObservationUpstreamErrorV1 &&
                (error.code === "unavailable" ||
                  error.code === "timeout" ||
                  error.code === "not_found")
              ) {
                degraded.add(
                  error.code === "timeout"
                    ? "optional_detail_timeout"
                    : error.code === "not_found"
                      ? "meta_projection_lag"
                      : "meta_unavailable",
                );
                return;
              }
              if (error instanceof ObservationApplicationErrorV1) throw error;
              mapUpstreamError(error);
            });

    await Promise.all([runtimePromise, metaPromise]);
    return {
      schema_version: "1.0.0",
      trigger_process: processProjection.value,
      runtime: runtimeSummary,
      meta: metaSummary,
      snapshot_watermark: process.snapshot_watermark,
      degraded_flags: [...degraded].sort(),
      redacted_field_count: redacted,
      trace_id: traceId,
    };
  }

  private async getSnapshotResult(
    principal: ObservationPrincipalV1,
    processId: string,
    traceId: string,
  ): Promise<ObservationSnapshotResponseV1> {
    const process = await this.authorizeProcess(
      principal,
      processId,
      traceId,
    );
    const response = await this.composeSnapshot(
      principal,
      process,
      traceId,
    );
    await this.enqueueAudit(
      this.auditRecord(principal, {
        resource_type: "trigger_process",
        resource_id: processId,
        endpoint: "snapshot",
        decision: "allowed",
        status_code: 200,
        trace_id: traceId,
        redacted_field_count: response.redacted_field_count,
      }),
      false,
    );
    return response;
  }

  private async getRuntimeDetailsResult(
    principal: ObservationPrincipalV1,
    processId: string,
    runtimeRunId: string,
    traceId: string,
  ): Promise<ObservationRuntimeDetailsResponseV1> {
    const process = await this.authorizeProcess(
      principal,
      processId,
      traceId,
    );
    const resolvedRunId = this.resolveRuntimeRunId(process, runtimeRunId);
    if (resolvedRunId === null) {
      throw new ObservationApplicationErrorV1(
        "runtime_run_mismatch",
        "runtime_run_id does not belong to the authorized process",
        false,
      );
    }
    let raw: unknown;
    try {
      raw = await this.runtime.getRun(deepFreezeObservationJsonV1({
        workload: {
          sub: "observation_gateway",
          aud: "action_runtime",
          capability: "runtime.run.read",
        },
        delegated_principal: principal.delegated_principal,
        scope: principal.scope,
        trigger_process_id: processId,
        runtime_run_id: resolvedRunId,
        trace_id: traceId,
      }));
    } catch (error) {
      mapAuthorizedOwnerError(error, "action_runtime");
    }
    const owner = runtimeRunDetails(raw);
    this.validateRuntimeBinding(
      owner,
      principal,
      processId,
      resolvedRunId,
    );
    const mapped = this.mapRuntime(owner.runtime_run);
    const response: ObservationRuntimeDetailsResponseV1 = {
      schema_version: "1.0.0",
      runtime: mapped.value,
      redacted_field_count: mapped.redacted,
      trace_id: traceId,
    };
    await this.enqueueAudit(
      this.auditRecord(principal, {
        resource_type: "runtime_run",
        resource_id: resolvedRunId,
        endpoint: "runtime_details",
        decision: "allowed",
        status_code: 200,
        trace_id: traceId,
        redacted_field_count: mapped.redacted,
      }),
      false,
    );
    return response;
  }

  private async getMetaDetailsResult(
    principal: ObservationPrincipalV1,
    processId: string,
    metaJobId: string,
    traceId: string,
  ): Promise<ObservationMetaDetailsResponseV1> {
    const process = await this.authorizeProcess(
      principal,
      processId,
      traceId,
    );
    assertIdentifier(metaJobId, "meta_job_id");
    if (process.meta_job_id !== metaJobId) {
      throw new ObservationApplicationErrorV1(
        "bot_permission_denied",
        "meta_job_id does not belong to the authorized process",
        false,
      );
    }
    let raw: unknown;
    try {
      raw = await this.meta.getJob(deepFreezeObservationJsonV1({
        workload: {
          sub: "observation_gateway",
          aud: "meta_cognition",
          capability: "meta.job.read",
        },
        delegated_principal: principal.delegated_principal,
        scope: principal.scope,
        trigger_process_id: processId,
        meta_job_id: metaJobId,
        trace_id: traceId,
      }));
    } catch (error) {
      mapAuthorizedOwnerError(error, "meta_cognition");
    }
    const owner = metaJobDetails(raw);
    this.validateMetaBinding(
      owner,
      principal,
      processId,
      metaJobId,
    );
    const mapped = this.mapMeta(owner);
    const response: ObservationMetaDetailsResponseV1 = {
      schema_version: "1.0.0",
      meta: mapped.value,
      redacted_field_count: mapped.redacted,
      trace_id: traceId,
    };
    await this.enqueueAudit(
      this.auditRecord(principal, {
        resource_type: "meta_job",
        resource_id: metaJobId,
        endpoint: "meta_details",
        decision: "allowed",
        status_code: 200,
        trace_id: traceId,
        redacted_field_count: mapped.redacted,
      }),
      false,
    );
    return response;
  }

  private resolveRuntimeRunId(
    process: TriggerProcessQueryDetailsV1,
    requested: string | undefined,
  ): string | null {
    if (requested !== undefined) {
      assertIdentifier(requested, "runtime_run_id");
    }
    if (requested !== undefined && requested !== process.runtime_run_id) {
      throw new ObservationApplicationErrorV1(
        "runtime_run_mismatch",
        "runtime_run_id does not belong to the authorized process",
        false,
      );
    }
    return requested ?? process.runtime_run_id;
  }

  private async listToolInvocationsResult(
    principal: ObservationPrincipalV1,
    processId: string,
    input: ObservationToolInvocationQueryInputV1,
  ): Promise<ObservationToolInvocationListV1> {
    const process = await this.authorizeProcess(
      principal,
      processId,
      input.trace_id,
    );
    const runId = this.resolveRuntimeRunId(
      process,
      input.runtime_run_id,
    );
    if (runId === null) {
      const response: ObservationToolInvocationListV1 = {
        schema_version: "1.0.0",
        items: [],
        runtime_resolution:
          process.phase === "admission" ? "not_started" : "not_projected",
        degraded_flags: [],
        redacted_field_count: 0,
        trace_id: input.trace_id,
      };
      await this.enqueueAudit(
        this.auditRecord(principal, {
          resource_type: "trigger_process",
          resource_id: processId,
          endpoint: "tool_invocations",
          decision: "allowed",
          status_code: 200,
          trace_id: input.trace_id,
        }),
        false,
      );
      return response;
    }
    const limit = input.limit ?? 50;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200) {
      throw new ObservationApplicationErrorV1(
        "invalid_request",
        "limit must be between 1 and 200",
        false,
      );
    }
    if (input.cursor !== undefined) {
      assertIdentifier(input.cursor, "cursor");
    }
    if (
      input.status !== undefined &&
      !TOOL_INVOCATION_QUERY_STATUSES_V1.includes(
        input.status as (typeof TOOL_INVOCATION_QUERY_STATUSES_V1)[number],
      )
    ) {
      throw new ObservationApplicationErrorV1(
        "invalid_request",
        "status is not a registered tool invocation status",
        false,
      );
    }
    let raw: unknown;
    try {
      raw = await this.runtime.listToolInvocations(deepFreezeObservationJsonV1({
        workload: {
          sub: "observation_gateway",
          aud: "action_runtime",
          capability: "runtime.tool_invocations.read",
        },
        delegated_principal: principal.delegated_principal,
        scope: principal.scope,
        trigger_process_id: processId,
        runtime_run_id: runId,
        ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
        limit,
        ...(input.status === undefined ? {} : { status: input.status }),
        trace_id: input.trace_id,
      }));
    } catch (error) {
      if (
        error instanceof ObservationUpstreamErrorV1 &&
        (error.code === "unavailable" ||
          error.code === "timeout" ||
          error.code === "not_found")
      ) {
        const response: ObservationToolInvocationListV1 = {
          schema_version: "1.0.0",
          items: [],
          runtime_resolution:
            error.code === "not_found" ? "not_projected" : "resolved",
          degraded_flags: [
            error.code === "timeout"
              ? "optional_detail_timeout"
              : "runtime_unavailable",
          ],
          redacted_field_count: 0,
          trace_id: input.trace_id,
        };
        await this.enqueueAudit(
          this.auditRecord(principal, {
            resource_type: "runtime_run",
            resource_id: runId,
            endpoint: "tool_invocations",
            decision: "allowed_degraded",
            status_code: 200,
            trace_id: input.trace_id,
          }),
          false,
        );
        return response;
      }
      mapUpstreamError(error);
    }
    const owner = toolInvocationListDetails(raw);
    if (owner.runtime_run_id !== runId) {
      throw new ObservationApplicationErrorV1(
        "runtime_run_mismatch",
        "tool owner response does not belong to the authorized runtime run",
        false,
      );
    }
    if (
      input.status !== undefined &&
      owner.items.some((item) => item.status !== input.status)
    ) {
      throw new ObservationApplicationErrorV1(
        "upstream_schema_mismatch",
        "tool owner response violates the requested status filter",
        false,
        { upstream: "action_runtime" },
      );
    }
    if (owner.items.length > limit) {
      throw new ObservationApplicationErrorV1(
        "upstream_schema_mismatch",
        "tool owner response exceeded the requested page size",
        false,
        { upstream: "action_runtime" },
      );
    }
    let redacted = 0;
    const items = owner.items.map((item) => {
      const toolName = sanitizeText(item.tool_name);
      const failureClass =
        item.failure_class === null
          ? { value: null, redacted: 0 }
          : sanitizeText(item.failure_class);
      redacted += toolName.redacted + failureClass.redacted;
      if (item.input_ref !== null) redacted += 1;
      if (item.output_ref !== null) redacted += 1;
      return {
        tool_invocation_id: item.tool_invocation_id,
        tool_name: toolName.value,
        status: item.status,
        side_effect_status: item.side_effect_status,
        failure_class: failureClass.value,
        started_at: item.started_at,
        completed_at: item.completed_at,
      };
    });
    const nextCursor = owner.next_cursor ?? undefined;
    const response: ObservationToolInvocationListV1 = {
      schema_version: "1.0.0",
      items,
      ...(nextCursor === undefined ? {} : { next_cursor: nextCursor }),
      runtime_resolution: "resolved",
      degraded_flags: [],
      redacted_field_count: redacted,
      trace_id: input.trace_id,
    };
    await this.enqueueAudit(
      this.auditRecord(principal, {
        resource_type: "runtime_run",
        resource_id: runId,
        endpoint: "tool_invocations",
        decision: "allowed",
        status_code: 200,
        trace_id: input.trace_id,
        redacted_field_count: redacted,
      }),
      false,
    );
    return response;
  }

  private async listQualitySignalsResult(
    principal: ObservationPrincipalV1,
    processId: string,
    input: ObservationQualitySignalQueryInputV1,
  ): Promise<ObservationQualitySignalListV1> {
    await this.authorizeProcess(principal, processId, input.trace_id);
    const limit = input.limit ?? 50;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200) {
      throw new ObservationApplicationErrorV1(
        "invalid_request",
        "limit must be between 1 and 200",
        false,
      );
    }
    if (input.cursor !== undefined) {
      assertIdentifier(input.cursor, "cursor");
    }
    if (
      input.severity !== undefined &&
      !qualitySeverities.has(input.severity)
    ) {
      throw new ObservationApplicationErrorV1(
        "invalid_request",
        "severity is not a registered quality signal severity",
        false,
      );
    }
    if (
      input.signal_type !== undefined &&
      !QUALITY_SIGNAL_TYPES_V1.includes(
        input.signal_type as (typeof QUALITY_SIGNAL_TYPES_V1)[number],
      )
    ) {
      throw new ObservationApplicationErrorV1(
        "invalid_request",
        "signal_type is not a registered quality signal type",
        false,
      );
    }
    let raw: unknown;
    try {
      raw = await this.meta.listQualitySignals(deepFreezeObservationJsonV1({
        workload: {
          sub: "observation_gateway",
          aud: "meta_cognition",
          capability: "meta.quality_signals.read",
        },
        delegated_principal: principal.delegated_principal,
        scope: principal.scope,
        trigger_process_id: processId,
        ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
        limit,
        ...(input.severity === undefined
          ? {}
          : { severity: input.severity }),
        ...(input.signal_type === undefined
          ? {}
          : { signal_type: input.signal_type }),
        trace_id: input.trace_id,
      }));
    } catch (error) {
      if (
        error instanceof ObservationUpstreamErrorV1 &&
        (error.code === "unavailable" ||
          error.code === "timeout" ||
          error.code === "not_found")
      ) {
        const response: ObservationQualitySignalListV1 = {
          schema_version: "1.0.0",
          items: [],
          degraded_flags: [
            error.code === "timeout"
              ? "optional_detail_timeout"
              : error.code === "not_found"
                ? "meta_projection_lag"
                : "meta_unavailable",
          ],
          redacted_field_count: 0,
          trace_id: input.trace_id,
        };
        await this.enqueueAudit(
          this.auditRecord(principal, {
            resource_type: "trigger_process",
            resource_id: processId,
            endpoint: "quality_signals",
            decision: "allowed_degraded",
            status_code: 200,
            trace_id: input.trace_id,
          }),
          false,
        );
        return response;
      }
      mapUpstreamError(error);
    }
    const owner = qualitySignalListDetails(raw);
    if (
      owner.trigger_process_id !== processId ||
      owner.bot_id !== principal.scope.bot_id
    ) {
      throw new ObservationApplicationErrorV1(
        "bot_permission_denied",
        "quality signal binding does not match the authorized process",
        false,
      );
    }
    if (owner.trace_id !== input.trace_id) {
      throw new ObservationApplicationErrorV1(
        "upstream_schema_mismatch",
        "quality owner response trace binding is invalid",
        false,
        { upstream: "meta_cognition" },
      );
    }
    if (
      (input.severity !== undefined &&
        owner.items.some((item) => item.severity !== input.severity)) ||
      (input.signal_type !== undefined &&
        owner.items.some((item) => item.signal_type !== input.signal_type))
    ) {
      throw new ObservationApplicationErrorV1(
        "upstream_schema_mismatch",
        "quality owner response violates the requested filters",
        false,
        { upstream: "meta_cognition" },
      );
    }
    if (owner.items.length > limit) {
      throw new ObservationApplicationErrorV1(
        "upstream_schema_mismatch",
        "quality owner response exceeded the requested page size",
        false,
        { upstream: "meta_cognition" },
      );
    }
    let redacted = 0;
    const items = owner.items.map((item) => {
      const summary = safeSelectedValue(item.payload_summary);
      const action =
        item.recommended_action === null
          ? { value: null, redacted: 0 }
          : sanitizeText(item.recommended_action);
      const sourceRef = sanitizeText(item.source_ref);
      const evidenceRefs = item.evidence_refs.map((ref) => sanitizeText(ref));
      redacted +=
        summary.redacted +
        action.redacted +
        sourceRef.redacted +
        evidenceRefs.reduce((count, ref) => count + ref.redacted, 0);
      if (item.actor_principal !== null) redacted += 1;
      if (item.actor_role !== null) redacted += 1;
      return {
        id: item.id,
        signal_type: item.signal_type,
        severity: item.severity,
        source_kind: item.source_kind,
        source_service: item.source_service,
        source_ref: sourceRef.value,
        evidence_refs: evidenceRefs.map((ref) => ref.value),
        recommended_action: action.value,
        payload_summary:
          typeof summary.value === "object" &&
          summary.value !== null &&
          !Array.isArray(summary.value)
            ? (summary.value as ObservationQualitySignalListV1["items"][number]["payload_summary"])
            : {},
        created_at: item.created_at,
      };
    });
    const nextCursor = owner.next_cursor ?? undefined;
    const response: ObservationQualitySignalListV1 = {
      schema_version: "1.0.0",
      items,
      ...(nextCursor === undefined ? {} : { next_cursor: nextCursor }),
      degraded_flags: [],
      redacted_field_count: redacted,
      trace_id: input.trace_id,
    };
    await this.enqueueAudit(
      this.auditRecord(principal, {
        resource_type: "trigger_process",
        resource_id: processId,
        endpoint: "quality_signals",
        decision: "allowed",
        status_code: 200,
        trace_id: input.trace_id,
        redacted_field_count: redacted,
      }),
      false,
    );
    return response;
  }

  private mapDurableEvent(
    event: TriggerProcessSseEventV1,
  ): ObservationEventV1 | null {
    if (event.event_type === "trigger_process.summary") return null;
    const summary = event.observation_summary as Readonly<
      Record<string, unknown>
    >;
    const safe = safeSelectedValue(summary);
    const payloadSummary =
      typeof safe.value === "object" &&
      safe.value !== null &&
      !Array.isArray(safe.value)
        ? (safe.value as ObservationEventV1["payload_summary"])
        : {};
    return {
      schema_version: "1.0.0",
      event_type: event.event_type,
      producer: event.event_type.startsWith("runtime.")
        ? "action_runtime"
        : "trigger_processor",
      trigger_process_id: event.trigger_process_id,
      append_sequence_no: event.append_sequence_no,
      durable: true,
      occurred_at: event.occurred_at,
      trace_id: event.trace_id,
      payload_summary: payloadSummary,
      redacted_field_count: safe.redacted,
    };
  }

  private validateTokenFrame(
    value: unknown,
    processId: string,
    runId: string,
  ): RuntimeTokenSseEventV1 {
    const snapshot =
      snapshotCanonicalUpstreamValueV1<RuntimeTokenSseEventV1>(
      value,
      "action_runtime",
      "runtime token owner frame",
    );
    if (!Value.Check(RuntimeTokenSseEventV1Schema, snapshot)) {
      throw new ObservationApplicationErrorV1(
        "upstream_schema_mismatch",
        "runtime token owner frame is invalid",
        false,
        { upstream: "action_runtime" },
      );
    }
    const candidate = snapshot as unknown as Record<string, unknown>;
    if (
      RUNTIME_TOKEN_SSE_FORBIDDEN_DURABLE_FIELDS_V1.some(
        (field) => field in candidate,
      ) ||
      snapshot.trigger_process_id !== processId ||
      snapshot.runtime_run_id !== runId
    ) {
      throw new ObservationApplicationErrorV1(
        "runtime_run_mismatch",
        "runtime token frame binding is invalid",
        false,
      );
    }
    return snapshot;
  }

  private async prepareEventStreamResult(
    principal: ObservationPrincipalV1,
    processId: string,
    input: ObservationEventStreamInputV1,
    preparationSignal?: AbortSignal,
  ): Promise<ObservationPreparedEventStreamV1> {
    const startedAtMonotonicMs = this.monotonicNowMs();
    assertSignalActiveV1(preparationSignal);
    const debugRequested = input.include_ephemeral_tokens === true;
    this.assertStreamCredentialActive(principal, debugRequested);
    if (debugRequested) {
      this.assertDebug(principal);
    }
    const process = await this.authorizeProcess(
      principal,
      processId,
      input.trace_id,
      preparationSignal,
    );
    assertSignalActiveV1(preparationSignal);
    let startAfter: number | undefined;
    if (input.last_event_id !== undefined) {
      try {
        const parsed = parseTriggerProcessSseCursorV1({
          schema_version: "trigger_process_sse_request.v1",
          trigger_process_id: processId,
          last_event_id: input.last_event_id,
        });
        startAfter = parsed ?? undefined;
      } catch {
        throw new ObservationApplicationErrorV1(
          "invalid_request",
          "Last-Event-ID is invalid",
          false,
        );
      }
    }
    let includeTokens = debugRequested;
    const runId = this.resolveRuntimeRunId(
      process,
      input.runtime_run_id,
    );
    if (includeTokens) {
      this.assertDebug(principal);
      if (runId === null) {
        throw new ObservationApplicationErrorV1(
          "invalid_request",
          "runtime_run_id is required for ephemeral tokens",
          false,
        );
      }
      let rawRun: unknown;
      try {
        rawRun = await this.runtime.getRun(
          deepFreezeObservationJsonV1({
            workload: {
              sub: "observation_gateway",
              aud: "action_runtime",
              capability: "runtime.run.read",
            },
            delegated_principal: principal.delegated_principal,
            scope: principal.scope,
            trigger_process_id: processId,
            runtime_run_id: runId,
            trace_id: input.trace_id,
          }),
          preparationSignal,
        );
      } catch (error) {
        assertSignalActiveV1(preparationSignal);
        mapAuthorizedOwnerError(error, "action_runtime");
      }
      assertSignalActiveV1(preparationSignal);
      const ownerRun = runtimeRunDetails(rawRun);
      this.validateRuntimeBinding(
        ownerRun,
        principal,
        processId,
        runId,
      );
      includeTokens = ![
        "cancelled",
        "completed",
        "failed",
      ].includes(ownerRun.runtime_run.status) && process.phase !== "closed";
      await this.enqueueAudit(
        this.auditRecord(principal, {
          resource_type: "runtime_run",
          resource_id: runId,
          endpoint: "runtime_tokens",
          include_ephemeral_tokens: true,
          decision: "allowed_debug_start",
          status_code: 200,
          trace_id: input.trace_id,
        }),
        true,
        preparationSignal,
      );
      assertSignalActiveV1(preparationSignal);
      this.assertStreamCredentialActive(principal, true);
    } else {
      this.assertStreamCredentialActive(principal, false);
      await this.enqueueAudit(
        this.auditRecord(principal, {
          resource_type: "trigger_process",
          resource_id: processId,
          endpoint: "events",
          decision: "allowed_stream_start",
          status_code: 200,
          trace_id: input.trace_id,
        }),
        false,
        preparationSignal,
      );
      assertSignalActiveV1(preparationSignal);
      this.assertStreamCredentialActive(principal, false);
    }
    const prepared = Object.freeze({
      principal,
      process_id: processId,
      process,
      input,
      start_after: startAfter,
      debug_requested: debugRequested,
      include_tokens: includeTokens,
      runtime_run_id: runId,
      started_at_monotonic_ms: startedAtMonotonicMs,
    });
    this.#preparedStreams.add(prepared);
    return prepared;
  }

  public async resolveReplaySnapshot(
    principal: ObservationPrincipalV1,
    processId: string,
    traceId: string,
    signal: AbortSignal = new AbortController().signal,
  ): Promise<TriggerProcessSnapshotReadContractV1> {
    let principalSnapshot: ObservationPrincipalV1 | undefined;
    let inputSnapshot: ObservationProcessReadInputV1 | undefined;
    try {
      principalSnapshot = snapshotObservationPrincipalV1(principal);
      inputSnapshot = snapshotObservationProcessReadInputV1({
        trigger_process_id: processId,
        trace_id: traceId,
      });
      return await this.resolveReplaySnapshotResult(
        principalSnapshot,
        inputSnapshot,
        signal,
      );
    } catch (error) {
      if (principalSnapshot !== undefined && inputSnapshot !== undefined) {
        await this.auditFailedAccess(
          principalSnapshot,
          {
            resource_type: "trigger_process_snapshot",
            resource_id: inputSnapshot.trigger_process_id,
            endpoint: "snapshot_replay",
            trace_id: inputSnapshot.trace_id,
          },
          error,
          true,
        );
      }
      throw error;
    }
  }

  public async resolveAuditContextSnapshot(
    principal: ObservationPrincipalV1,
    processId: string,
    traceId: string,
    signal: AbortSignal = new AbortController().signal,
  ): Promise<ContextSnapshotV1> {
    let principalSnapshot: ObservationPrincipalV1 | undefined;
    let inputSnapshot: ObservationProcessReadInputV1 | undefined;
    try {
      principalSnapshot = snapshotObservationPrincipalV1(principal);
      inputSnapshot = snapshotObservationProcessReadInputV1({
        trigger_process_id: processId,
        trace_id: traceId,
      });
      return await this.resolveAuditContextSnapshotResult(
        principalSnapshot,
        inputSnapshot,
        signal,
      );
    } catch (error) {
      if (principalSnapshot !== undefined && inputSnapshot !== undefined) {
        await this.auditFailedAccess(
          principalSnapshot,
          {
            resource_type: "context_snapshot",
            resource_id: inputSnapshot.trigger_process_id,
            endpoint: "context_snapshot_audit",
            trace_id: inputSnapshot.trace_id,
          },
          error,
          true,
        );
      }
      throw error;
    }
  }

  public async getSnapshot(
    principal: ObservationPrincipalV1,
    processId: string,
    traceId: string,
  ): Promise<ObservationSnapshotResponseV1> {
    let principalSnapshot: ObservationPrincipalV1 | undefined;
    let inputSnapshot: ObservationProcessReadInputV1 | undefined;
    try {
      principalSnapshot = snapshotObservationPrincipalV1(principal);
      inputSnapshot = snapshotObservationProcessReadInputV1({
        trigger_process_id: processId,
        trace_id: traceId,
      });
      return await this.getSnapshotResult(
        principalSnapshot,
        inputSnapshot.trigger_process_id,
        inputSnapshot.trace_id,
      );
    } catch (error) {
      if (
        principalSnapshot !== undefined &&
        inputSnapshot !== undefined
      ) {
        await this.auditFailedAccess(
          principalSnapshot,
          {
            resource_type: "trigger_process",
            resource_id: inputSnapshot.trigger_process_id,
            endpoint: "snapshot",
            trace_id: inputSnapshot.trace_id,
          },
          error,
        );
      }
      throw error;
    }
  }

  public async getRuntimeDetails(
    principal: ObservationPrincipalV1,
    processId: string,
    runtimeRunId: string,
    traceId: string,
  ): Promise<ObservationRuntimeDetailsResponseV1> {
    let principalSnapshot: ObservationPrincipalV1 | undefined;
    let inputSnapshot: ObservationRuntimeDetailsInputV1 | undefined;
    try {
      principalSnapshot = snapshotObservationPrincipalV1(principal);
      inputSnapshot = snapshotObservationRuntimeDetailsInputV1({
        trigger_process_id: processId,
        runtime_run_id: runtimeRunId,
        trace_id: traceId,
      });
      return await this.getRuntimeDetailsResult(
        principalSnapshot,
        inputSnapshot.trigger_process_id,
        inputSnapshot.runtime_run_id,
        inputSnapshot.trace_id,
      );
    } catch (error) {
      if (
        principalSnapshot !== undefined &&
        inputSnapshot !== undefined
      ) {
        await this.auditFailedAccess(
          principalSnapshot,
          {
            resource_type: "runtime_run",
            resource_id: inputSnapshot.runtime_run_id,
            endpoint: "runtime_details",
            trace_id: inputSnapshot.trace_id,
          },
          error,
        );
      }
      throw error;
    }
  }

  public async getMetaDetails(
    principal: ObservationPrincipalV1,
    processId: string,
    metaJobId: string,
    traceId: string,
  ): Promise<ObservationMetaDetailsResponseV1> {
    let principalSnapshot: ObservationPrincipalV1 | undefined;
    let inputSnapshot: ObservationMetaDetailsInputV1 | undefined;
    try {
      principalSnapshot = snapshotObservationPrincipalV1(principal);
      inputSnapshot = snapshotObservationMetaDetailsInputV1({
        trigger_process_id: processId,
        meta_job_id: metaJobId,
        trace_id: traceId,
      });
      return await this.getMetaDetailsResult(
        principalSnapshot,
        inputSnapshot.trigger_process_id,
        inputSnapshot.meta_job_id,
        inputSnapshot.trace_id,
      );
    } catch (error) {
      if (principalSnapshot !== undefined && inputSnapshot !== undefined) {
        await this.auditFailedAccess(
          principalSnapshot,
          {
            resource_type: "meta_job",
            resource_id: inputSnapshot.meta_job_id,
            endpoint: "meta_details",
            trace_id: inputSnapshot.trace_id,
          },
          error,
        );
      }
      throw error;
    }
  }

  public async listToolInvocations(
    principal: ObservationPrincipalV1,
    processId: string,
    input: ObservationToolInvocationQueryInputV1,
  ): Promise<ObservationToolInvocationListV1> {
    let principalSnapshot: ObservationPrincipalV1 | undefined;
    let processInputSnapshot: ObservationProcessReadInputV1 | undefined;
    let inputSnapshot: ObservationToolInvocationQueryInputV1 | undefined;
    try {
      principalSnapshot = snapshotObservationPrincipalV1(principal);
      inputSnapshot =
        snapshotObservationToolInvocationQueryInputV1(input);
      processInputSnapshot = snapshotObservationProcessReadInputV1({
        trigger_process_id: processId,
        trace_id: inputSnapshot.trace_id,
      });
      return await this.listToolInvocationsResult(
        principalSnapshot,
        processInputSnapshot.trigger_process_id,
        inputSnapshot,
      );
    } catch (error) {
      if (
        principalSnapshot !== undefined &&
        processInputSnapshot !== undefined &&
        inputSnapshot !== undefined
      ) {
        await this.auditFailedAccess(
          principalSnapshot,
          {
            resource_type:
              inputSnapshot.runtime_run_id === undefined
                ? "trigger_process"
                : "runtime_run",
            resource_id:
              inputSnapshot.runtime_run_id ??
              processInputSnapshot.trigger_process_id,
            endpoint: "tool_invocations",
            trace_id: inputSnapshot.trace_id,
          },
          error,
        );
      }
      throw error;
    }
  }

  public async listQualitySignals(
    principal: ObservationPrincipalV1,
    processId: string,
    input: ObservationQualitySignalQueryInputV1,
  ): Promise<ObservationQualitySignalListV1> {
    let principalSnapshot: ObservationPrincipalV1 | undefined;
    let processInputSnapshot: ObservationProcessReadInputV1 | undefined;
    let inputSnapshot: ObservationQualitySignalQueryInputV1 | undefined;
    try {
      principalSnapshot = snapshotObservationPrincipalV1(principal);
      inputSnapshot =
        snapshotObservationQualitySignalQueryInputV1(input);
      processInputSnapshot = snapshotObservationProcessReadInputV1({
        trigger_process_id: processId,
        trace_id: inputSnapshot.trace_id,
      });
      return await this.listQualitySignalsResult(
        principalSnapshot,
        processInputSnapshot.trigger_process_id,
        inputSnapshot,
      );
    } catch (error) {
      if (
        principalSnapshot !== undefined &&
        processInputSnapshot !== undefined &&
        inputSnapshot !== undefined
      ) {
        await this.auditFailedAccess(
          principalSnapshot,
          {
            resource_type: "trigger_process",
            resource_id: processInputSnapshot.trigger_process_id,
            endpoint: "quality_signals",
            trace_id: inputSnapshot.trace_id,
          },
          error,
        );
      }
      throw error;
    }
  }

  public async prepareEventStream(
    principal: ObservationPrincipalV1,
    processId: string,
    input: ObservationEventStreamInputV1,
    preparationSignal?: AbortSignal,
  ): Promise<ObservationPreparedEventStreamV1> {
    let principalSnapshot: ObservationPrincipalV1 | undefined;
    let processInputSnapshot: ObservationProcessReadInputV1 | undefined;
    let inputSnapshot: ObservationEventStreamInputV1 | undefined;
    try {
      principalSnapshot = snapshotObservationPrincipalV1(principal);
      inputSnapshot = snapshotObservationEventStreamInputV1(input);
      processInputSnapshot = snapshotObservationProcessReadInputV1({
        trigger_process_id: processId,
        trace_id: inputSnapshot.trace_id,
      });
      return await this.prepareEventStreamResult(
        principalSnapshot,
        processInputSnapshot.trigger_process_id,
        inputSnapshot,
        preparationSignal,
      );
    } catch (error) {
      if (
        principalSnapshot !== undefined &&
        processInputSnapshot !== undefined &&
        inputSnapshot !== undefined
      ) {
        await this.auditFailedAccess(
          principalSnapshot,
          {
            resource_type:
              inputSnapshot.runtime_run_id === undefined
                ? "trigger_process"
                : "runtime_run",
            resource_id:
              inputSnapshot.runtime_run_id ??
              processInputSnapshot.trigger_process_id,
            endpoint:
              inputSnapshot.include_ephemeral_tokens === true
                ? "runtime_tokens"
                : "events",
            trace_id: inputSnapshot.trace_id,
            include_ephemeral_tokens:
              inputSnapshot.include_ephemeral_tokens === true,
          },
          error,
          inputSnapshot.include_ephemeral_tokens === true,
        );
      }
      throw error;
    }
  }

  public async *streamPreparedEvents(
    prepared: ObservationPreparedEventStreamV1,
    downstreamSignal?: AbortSignal,
  ): AsyncIterable<ObservationStreamFrameV1> {
    if (!this.#preparedStreams.delete(prepared)) {
      throw new ObservationApplicationErrorV1(
        "invalid_request",
        "prepared observation stream is invalid or already consumed",
        false,
      );
    }
    const {
      principal,
      process,
      input,
      debug_requested: debugRequested,
      include_tokens: includeTokens,
      runtime_run_id: runId,
      process_id: processId,
      started_at_monotonic_ms: startedAtMonotonicMs,
    } = prepared;
    let startAfter = prepared.start_after;
    const buffer = new ObservationBoundedBufferV1(
      this.#bufferMaxEvents,
      this.#bufferMaxBytes,
    );
    const seen = new Map<string, string>();
    let lastSequence = startAfter ?? 0;
    let sequenceBaselineKnown = startAfter !== undefined;
    const tokenAbort = new AbortController();
    const durableAbort = new AbortController();
    let durableDone = false;
    let downstreamClosed = downstreamSignal?.aborted ?? false;
    let leaseExpired = false;
    let producerError: unknown;
    let wake: (() => void) | undefined;
    const credentialExpiresAt =
      principal.credential_expires_at_epoch_seconds;
    const notify = (): void => {
      wake?.();
      wake = undefined;
    };
    const closeForDownstream = (): void => {
      downstreamClosed = true;
      durableDone = true;
      buffer.clear();
      durableAbort.abort(downstreamSignal?.reason);
      tokenAbort.abort(downstreamSignal?.reason);
      notify();
    };
    downstreamSignal?.addEventListener("abort", closeForDownstream, {
      once: true,
    });
    if (downstreamClosed) closeForDownstream();
    const failStream = (
      error: unknown,
      replaceExistingError = false,
    ): void => {
      if (replaceExistingError || producerError === undefined) {
        producerError = error;
      }
      durableDone = true;
      durableAbort.abort(error);
      tokenAbort.abort(error);
      notify();
    };
    const expireAuthorizationLease = (): void => {
      if (leaseExpired || downstreamClosed) return;
      leaseExpired = true;
      buffer.clear();
      failStream(
        new ObservationApplicationErrorV1(
          debugRequested
            ? "debug_permission_denied"
            : "bot_permission_denied",
          "workload credential expired during observation streaming",
          false,
        ),
        true,
      );
    };
    const credentialExpiryDeadlineMs =
      credentialExpiresAt === undefined
        ? undefined
        : credentialExpiresAt * 1_000;
    const expireAuthorizationLeaseIfDue = (): boolean => {
      if (
        leaseExpired ||
        (credentialExpiryDeadlineMs !== undefined &&
          this.wallClockNowMs() >= credentialExpiryDeadlineMs)
      ) {
        expireAuthorizationLease();
        return true;
      }
      return false;
    };
    let credentialExpiryTimer:
      | ReturnType<typeof setTimeout>
      | undefined;
    const armCredentialExpiryTimer = (): void => {
      try {
        if (
          credentialExpiryDeadlineMs === undefined ||
          leaseExpired ||
          downstreamClosed
        ) {
          return;
        }
        const delay =
          credentialExpiryDeadlineMs - this.wallClockNowMs();
        if (delay <= 0) {
          expireAuthorizationLease();
        } else {
          credentialExpiryTimer = setTimeout(
            armCredentialExpiryTimer,
            Math.min(delay, 2_147_483_647),
          );
          credentialExpiryTimer.unref();
        }
      } catch (error) {
        failStream(error, true);
      }
    };
    armCredentialExpiryTimer();
    const degradeTokenStream = (): void => {
      if (leaseExpired || durableAbort.signal.aborted) return;
      try {
        buffer.push({
          event: "observation.degraded",
          data: {
            schema_version: "1.0.0",
            code: "observation.degraded",
            trace_id: input.trace_id,
            details: {
              degraded_flag: "runtime_token_stream_unavailable",
            },
          },
          durable: false,
        });
        notify();
      } catch (error) {
        failStream(error);
      }
    };

    try {
      if (
        !downstreamClosed &&
        !leaseExpired &&
        input.last_event_id === undefined
      ) {
        const snapshot = await this.composeSnapshot(
          principal,
          process,
          input.trace_id,
        );
        if (
          !downstreamClosed &&
          !expireAuthorizationLeaseIfDue() &&
          !durableAbort.signal.aborted
        ) {
          buffer.push({
            event: "observation.snapshot",
            data: {
              ...snapshot,
              snapshot_watermark: process.snapshot_watermark,
            },
            durable: false,
          });
          startAfter = process.snapshot_watermark;
          lastSequence = startAfter;
          sequenceBaselineKnown = true;
        }
      }
    } catch (error) {
      producerError ??= error;
      if (credentialExpiryTimer !== undefined) {
        clearTimeout(credentialExpiryTimer);
      }
      tokenAbort.abort(error);
      durableAbort.abort(error);
      downstreamSignal?.removeEventListener(
        "abort",
        closeForDownstream,
      );
      await this.enqueueAudit(
        this.auditRecord(principal, {
          resource_type: "trigger_process",
          resource_id: processId,
          endpoint: "events_complete",
          include_ephemeral_tokens: debugRequested,
          decision: leaseExpired
            ? "stream_authorization_expired"
            : "stream_failed",
          status_code: leaseExpired ? 403 : 503,
          trace_id: input.trace_id,
          connection_duration_ms: this.elapsedMs(
            startedAtMonotonicMs,
          ),
        }),
        debugRequested,
      );
      throw producerError;
    }

    const durablePump = (async () => {
      try {
        if (downstreamClosed || durableAbort.signal.aborted) return;
        const stream = this.triggerProcessor.streamProcessEvents(
          deepFreezeObservationJsonV1({
            workload: {
              sub: "observation_gateway",
              aud: "trigger_processor",
              capability: "trigger.process.events.read",
            },
            delegated_principal: principal.delegated_principal,
            scope: principal.scope,
            trigger_process_id: processId,
            ...(input.last_event_id === undefined
              ? {
                  start_after_append_sequence_no:
                    process.snapshot_watermark,
                }
              : { last_event_id: input.last_event_id }),
            trace_id: input.trace_id,
          }),
          durableAbort.signal,
        );
        for await (const rawFrame of stream) {
          if (
            durableAbort.signal.aborted ||
            expireAuthorizationLeaseIfDue()
          ) {
            break;
          }
          const frame = snapshotCanonicalUpstreamValueV1<
            | Readonly<{ kind: "heartbeat" }>
            | Readonly<{ kind: "event"; event: unknown }>
          >(
            rawFrame,
            "trigger_processor",
            "trigger processor SSE owner frame",
          );
          if (frame.kind === "heartbeat") {
            buffer.push({ comment: "heartbeat", durable: false });
            notify();
            continue;
          }
          let canonicalFrame: string;
          try {
            canonicalFrame = canonicalJsonV1(frame.event);
          } catch {
            throw new ObservationApplicationErrorV1(
              "upstream_schema_mismatch",
              "trigger processor SSE frame is not bounded canonical JSON",
              false,
              { upstream: "trigger_processor" },
            );
          }
          if (!Value.Check(TriggerProcessSseEventV1Schema, frame.event)) {
            throw new ObservationApplicationErrorV1(
              "upstream_schema_mismatch",
              "trigger processor SSE frame is invalid",
              false,
              { upstream: "trigger_processor" },
            );
          }
          if (frame.event.event_type === "trigger_process.summary") {
            if (!Value.Check(TriggerProcessSummaryV1Schema, frame.event)) {
              throw new ObservationApplicationErrorV1(
                "upstream_schema_mismatch",
                "trigger processor summary frame is invalid",
                false,
                { upstream: "trigger_processor" },
              );
            }
            try {
              assertTriggerProcessSummarySemanticBindingsV1(frame.event);
              assertTriggerProcessSummaryBindingsV1(frame.event, {
                trigger_process_id: processId,
                minimum_append_sequence_no: lastSequence,
              });
            } catch {
              throw new ObservationApplicationErrorV1(
                "upstream_schema_mismatch",
                "trigger processor summary binding is invalid",
                false,
                { upstream: "trigger_processor" },
              );
            }
            continue;
          }
          try {
            assertTriggerProcessSseEventSemanticBindingsV1(frame.event);
          } catch {
            throw new ObservationApplicationErrorV1(
              "upstream_schema_mismatch",
              "trigger processor SSE semantic binding is invalid",
              false,
            );
          }
          if (frame.event.trigger_process_id !== processId) {
            throw new ObservationApplicationErrorV1(
              "bot_permission_denied",
              "SSE frame process binding is invalid",
              false,
            );
          }
          const id = triggerProcessSseEventIdV1(frame.event);
          const previousFrame = seen.get(id);
          if (previousFrame !== undefined) {
            if (previousFrame === canonicalFrame) continue;
            throw new ObservationApplicationErrorV1(
              "upstream_schema_mismatch",
              "trigger processor reused an SSE id for different content",
              false,
              { upstream: "trigger_processor" },
            );
          }
          const expectedSequence =
            lastSequence === Number.MAX_SAFE_INTEGER
              ? null
              : lastSequence + 1;
          if (
            sequenceBaselineKnown &&
            (expectedSequence === null ||
              frame.event.append_sequence_no !== expectedSequence)
          ) {
            throw new ObservationApplicationErrorV1(
              "upstream_schema_mismatch",
              "trigger processor SSE durable sequence is not contiguous",
              false,
              {
                upstream: "trigger_processor",
                expected_append_sequence_no: expectedSequence,
                actual_append_sequence_no:
                  frame.event.append_sequence_no,
              },
            );
          }
          seen.set(id, canonicalFrame);
          if (seen.size > 512) {
            const first = seen.keys().next().value as string | undefined;
            if (first !== undefined) seen.delete(first);
          }
          lastSequence = frame.event.append_sequence_no;
          sequenceBaselineKnown = true;
          const targetRunTerminated =
            (frame.event.event_type === "runtime.run.completed" ||
              frame.event.event_type === "runtime.run.failed" ||
              frame.event.event_type === "runtime.run.cancelled" ||
              frame.event.event_type === "runtime.run.preempted") &&
            frame.event.observation_summary.runtime_run_id === runId;
          const processClosed =
            frame.event.event_type === "trigger_process.phase_changed" &&
            frame.event.observation_summary.next_state.phase === "closed";
          if (targetRunTerminated || processClosed) {
            tokenAbort.abort();
          }
          const mapped = this.mapDurableEvent(frame.event);
          if (mapped !== null) {
            buffer.push({
              id,
              event: "observation.event",
              data: mapped,
              durable: true,
            });
            notify();
          }
        }
      } catch (error) {
        if (!durableAbort.signal.aborted) {
          producerError ??= error;
        }
      } finally {
        durableDone = true;
        tokenAbort.abort();
        notify();
      }
    })();

    const tokenPump =
      includeTokens && runId !== null && !tokenAbort.signal.aborted
        ? (async () => {
        try {
          for await (const raw of this.runtime.streamTokens(
            deepFreezeObservationJsonV1({
              workload: {
                sub: "observation_gateway",
                aud: "action_runtime",
                capability: "runtime.debug_tokens",
              },
              delegated_principal: principal.delegated_principal,
              scope: principal.scope,
              trigger_process_id: processId,
              runtime_run_id: runId,
              trace_id: input.trace_id,
            }),
            tokenAbort.signal,
          )) {
            if (
              durableDone ||
              downstreamClosed ||
              tokenAbort.signal.aborted ||
              expireAuthorizationLeaseIfDue()
            ) {
              break;
            }
            const token = this.validateTokenFrame(raw, processId, runId);
            buffer.push({
              event: "runtime_token",
              data: token,
              durable: false,
            });
            notify();
          }
        } catch (error) {
          if (
            !durableDone &&
            !downstreamClosed &&
            !tokenAbort.signal.aborted
          ) {
            if (
              error instanceof ObservationApplicationErrorV1 ||
              (error instanceof ObservationUpstreamErrorV1 &&
                error.code !== "unavailable" &&
                error.code !== "timeout")
            ) {
              failStream(error);
            } else {
              degradeTokenStream();
            }
          }
        }
          })()
        : undefined;

    try {
      while (!durableDone || buffer.size > 0) {
        if (downstreamClosed) break;
        if (expireAuthorizationLeaseIfDue()) {
          buffer.clear();
          break;
        }
        const frame = buffer.shift();
        if (frame !== undefined) {
          if (expireAuthorizationLeaseIfDue()) {
            buffer.clear();
            break;
          }
          yield frame;
          continue;
        }
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
      }
      await durablePump;
      if (producerError !== undefined) {
        if (producerError instanceof ObservationUpstreamErrorV1) {
          mapUpstreamError(producerError);
        }
        if (!(producerError instanceof ObservationApplicationErrorV1)) {
          mapUpstreamError(producerError);
        }
        throw producerError;
      }
    } finally {
      if (credentialExpiryTimer !== undefined) {
        clearTimeout(credentialExpiryTimer);
      }
      tokenAbort.abort();
      durableAbort.abort();
      downstreamSignal?.removeEventListener(
        "abort",
        closeForDownstream,
      );
      await tokenPump;
      await this.enqueueAudit(
        this.auditRecord(principal, {
          resource_type: "trigger_process",
          resource_id: processId,
          endpoint: "events_complete",
          include_ephemeral_tokens: debugRequested,
          decision:
            leaseExpired
              ? "stream_authorization_expired"
              : producerError === undefined
                ? "stream_closed"
                : "stream_failed",
          status_code:
            leaseExpired
              ? 403
              : producerError === undefined
                ? 200
                : 503,
          trace_id: input.trace_id,
          connection_duration_ms: this.elapsedMs(
            startedAtMonotonicMs,
          ),
        }),
        debugRequested,
      );
    }
  }

  public streamEvents(
    principal: ObservationPrincipalV1,
    processId: string,
    input: ObservationEventStreamInputV1,
    downstreamSignal?: AbortSignal,
  ): AsyncIterable<ObservationStreamFrameV1> {
    const principalSnapshot = snapshotObservationPrincipalV1(principal);
    const inputSnapshot = snapshotObservationEventStreamInputV1(input);
    const processInputSnapshot = snapshotObservationProcessReadInputV1({
      trigger_process_id: processId,
      trace_id: inputSnapshot.trace_id,
    });
    return this.streamEventsFromSnapshots(
      principalSnapshot,
      processInputSnapshot.trigger_process_id,
      inputSnapshot,
      downstreamSignal,
    );
  }

  private async *streamEventsFromSnapshots(
    principal: ObservationPrincipalV1,
    processId: string,
    input: ObservationEventStreamInputV1,
    downstreamSignal?: AbortSignal,
  ): AsyncIterable<ObservationStreamFrameV1> {
    const prepared = await this.prepareEventStream(
      principal,
      processId,
      input,
      downstreamSignal,
    );
    yield* this.streamPreparedEvents(prepared, downstreamSignal);
  }
}
