import {
  RuntimeDomainEventV1Schema,
  RuntimeEventReadContractV1Schema,
  RuntimeEventResolveRequestV1Schema,
  assertRuntimeDomainEventSemanticBindingsV1,
  assertRuntimeEventReadBindingsV1,
  type RuntimeDomainEventV1,
  type RuntimeEventReadContractV1,
  type RuntimeEventReadErrorCodeV1,
  type RuntimeEventResolveRequestV1,
} from "@pai/contracts";
import { canonicalJsonV1, canonicalPayloadHashV1 } from "@pai/eventing";
import { Value } from "@sinclair/typebox/value";

export interface RuntimeEventReadPrincipalV1 {
  readonly sub: "trigger_processor";
  readonly aud: "action_runtime";
  readonly capability: readonly string[];
  readonly scope: Readonly<{
    workspace_id: string;
    bot_id: string;
    owner_agent_id: string;
    deployment_environment: "local" | "dev" | "staging" | "prod";
    release_channel: "stable" | "canary";
  }>;
}

export interface RuntimeEventOwnerRowV1 extends Record<string, unknown> {
  readonly source_event_id: string;
  readonly payload_ref: string;
  readonly payload_hash: string;
  readonly runtime_run_id: string;
  readonly trigger_process_id: string;
  readonly source_sequence_no: string | number;
  readonly workspace_id: string;
  readonly bot_id: string;
  readonly owner_agent_id: string;
  readonly deployment_environment: string;
  readonly release_channel: string;
  readonly owner_start_attempt_no: string | number;
  readonly owner_start_fence_generation: string | number;
  readonly runtime_event: unknown;
  readonly envelope_canonical_base64: string;
  readonly retention_until: string;
  readonly redaction_state: string;
}

export interface RuntimeEventOwnerRepositoryV1 {
  findByOwnerIdentity(
    sourceEventId: string,
    payloadRef: string,
    signal: AbortSignal,
  ): Promise<RuntimeEventOwnerRowV1 | undefined>;
}

export class RuntimeEventReadErrorV1 extends Error {
  public constructor(
    public readonly code: RuntimeEventReadErrorCodeV1,
    public readonly request: RuntimeEventResolveRequestV1,
  ) {
    super(code);
    this.name = "RuntimeEventReadErrorV1";
  }
}

export interface RuntimeEventReadApplicationV1 {
  resolve(
    principal: RuntimeEventReadPrincipalV1,
    request: unknown,
    signal?: AbortSignal,
  ): Promise<RuntimeEventReadContractV1>;
}

function fail(
  code: RuntimeEventReadErrorCodeV1,
  request: RuntimeEventResolveRequestV1,
): never {
  throw new RuntimeEventReadErrorV1(code, request);
}

function safePositiveSequence(
  value: string | number,
  request: RuntimeEventResolveRequestV1,
): number {
  const sequence = typeof value === "string" ? Number(value) : value;
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    fail("event_schema_incompatible", request);
  }
  return sequence;
}

function decodeCanonicalBytes(
  value: string,
  request: RuntimeEventResolveRequestV1,
): string {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value)) {
    fail("event_schema_incompatible", request);
  }
  const bytes = Buffer.from(value, "base64");
  if (bytes.byteLength === 0 || bytes.toString("base64") !== value) {
    fail("event_schema_incompatible", request);
  }
  const text = bytes.toString("utf8");
  if (!Buffer.from(text, "utf8").equals(bytes)) {
    fail("event_schema_incompatible", request);
  }
  return text;
}

function timestampNanoseconds(value: string): bigint | undefined {
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/u.exec(
    value,
  );
  if (match === null) return undefined;
  const wholeSecondMs = Date.parse(`${match[1]}${match[3]}`);
  if (!Number.isFinite(wholeSecondMs)) return undefined;
  const fraction = (match[2] ?? "").padEnd(9, "0");
  return BigInt(wholeSecondMs) * 1_000_000n + BigInt(fraction);
}

function principalMatchesRequest(
  principal: RuntimeEventReadPrincipalV1,
  request: RuntimeEventResolveRequestV1,
): boolean {
  return (
    principal.sub === "trigger_processor" &&
    principal.aud === "action_runtime" &&
    principal.capability.includes("runtime.event.resolve") &&
    principal.scope.workspace_id === request.workspace_id &&
    principal.scope.bot_id === request.bot_id &&
    principal.scope.owner_agent_id === request.owner_agent_id &&
    principal.scope.deployment_environment === request.deployment_environment &&
    principal.scope.release_channel === request.release_channel
  );
}

function rowScopeMatches(
  row: RuntimeEventOwnerRowV1,
  request: RuntimeEventResolveRequestV1,
): boolean {
  return (
    row.runtime_run_id === request.runtime_run_id &&
    row.trigger_process_id === request.trigger_process_id &&
    row.workspace_id === request.workspace_id &&
    row.bot_id === request.bot_id &&
    row.owner_agent_id === request.owner_agent_id &&
    row.deployment_environment === request.deployment_environment &&
    row.release_channel === request.release_channel
  );
}

export function createRuntimeEventReadApplicationV1(
  repository: RuntimeEventOwnerRepositoryV1,
  options: Readonly<{ now?: () => Date }> = {},
): RuntimeEventReadApplicationV1 {
  const now = options.now ?? (() => new Date());
  return Object.freeze({
    async resolve(
      principal: RuntimeEventReadPrincipalV1,
      requestValue: unknown,
      signal = new AbortController().signal,
    ): Promise<RuntimeEventReadContractV1> {
      let canonicalRequest: unknown;
      try {
        canonicalRequest = JSON.parse(canonicalJsonV1(requestValue));
      } catch {
        throw new Error(
          "Runtime event resolve request is not canonical JSON",
        );
      }
      if (!Value.Check(RuntimeEventResolveRequestV1Schema, canonicalRequest)) {
        throw new Error("Runtime event resolve request schema is invalid");
      }
      const request = canonicalRequest as RuntimeEventResolveRequestV1;
      if (!principalMatchesRequest(principal, request)) {
        fail("event_scope_mismatch", request);
      }
      const ownerRow = await repository.findByOwnerIdentity(
        request.source_event_id,
        request.payload_ref,
        signal,
      );
      if (ownerRow === undefined) fail("event_not_found", request);
      let row: RuntimeEventOwnerRowV1;
      try {
        row = JSON.parse(
          canonicalJsonV1(ownerRow),
        ) as RuntimeEventOwnerRowV1;
      } catch {
        fail("event_schema_incompatible", request);
      }
      if (!rowScopeMatches(row, request)) fail("event_scope_mismatch", request);
      const sourceSequenceNo = safePositiveSequence(
        row.source_sequence_no,
        request,
      );
      if (sourceSequenceNo !== request.source_sequence_no) {
        fail("event_scope_mismatch", request);
      }
      if (
        row.source_event_id !== request.source_event_id ||
        row.payload_ref !== request.payload_ref ||
        row.payload_ref !== `runtime_event:${row.source_event_id}`
      ) {
        fail("event_schema_incompatible", request);
      }
      if (
        row.payload_hash !== request.expected_payload_hash ||
        !/^sha256:[0-9a-f]{64}$/u.test(row.payload_hash)
      ) {
        fail("event_hash_mismatch", request);
      }
      if (!Value.Check(RuntimeDomainEventV1Schema, row.runtime_event)) {
        fail("event_schema_incompatible", request);
      }
      const runtimeEvent = row.runtime_event as RuntimeDomainEventV1;
      if (
        safePositiveSequence(row.owner_start_attempt_no, request) !==
          runtimeEvent.payload.start_attempt_no ||
        safePositiveSequence(row.owner_start_fence_generation, request) !==
          runtimeEvent.payload.start_fence_generation
      ) {
        fail("event_scope_mismatch", request);
      }
      try {
        assertRuntimeDomainEventSemanticBindingsV1(runtimeEvent);
      } catch {
        fail("event_schema_incompatible", request);
      }
      const canonical = canonicalJsonV1(runtimeEvent);
      if (decodeCanonicalBytes(row.envelope_canonical_base64, request) !== canonical) {
        fail("event_schema_incompatible", request);
      }
      if (canonicalPayloadHashV1(runtimeEvent) !== row.payload_hash) {
        fail("event_hash_mismatch", request);
      }
      const resolvedAt = now();
      const retentionTimestamp = timestampNanoseconds(row.retention_until);
      if (
        retentionTimestamp === undefined ||
        retentionTimestamp <= BigInt(resolvedAt.getTime()) * 1_000_000n
      ) {
        fail("event_expired", request);
      }
      const retentionUntil = row.retention_until;
      if (
        row.redaction_state !== "not_required" &&
        row.redaction_state !== "complete"
      ) {
        fail("event_redaction_incomplete", request);
      }
      const response: RuntimeEventReadContractV1 = {
        schema_version: "runtime_event_read.v1",
        source_event_id: row.source_event_id,
        payload_ref: row.payload_ref,
        payload_hash: row.payload_hash as `sha256:${string}`,
        runtime_run_id: row.runtime_run_id,
        trigger_process_id: row.trigger_process_id,
        source_sequence_no: sourceSequenceNo,
        workspace_id: row.workspace_id,
        bot_id: row.bot_id,
        owner_agent_id: row.owner_agent_id,
        deployment_environment: row.deployment_environment as RuntimeEventReadContractV1["deployment_environment"],
        release_channel: row.release_channel as RuntimeEventReadContractV1["release_channel"],
        purpose: "trigger_snapshot_append",
        runtime_event: runtimeEvent,
        retention_until: retentionUntil,
        redaction_state: row.redaction_state,
        resolved_at: resolvedAt.toISOString(),
        trace_id: request.trace_id,
      };
      if (
        !Value.Check(
          RuntimeEventReadContractV1Schema,
          [RuntimeDomainEventV1Schema],
          response,
        )
      ) {
        fail("event_schema_incompatible", request);
      }
      try {
        assertRuntimeEventReadBindingsV1(request, response);
      } catch {
        fail("event_scope_mismatch", request);
      }
      return Object.freeze(response);
    },
  });
}
