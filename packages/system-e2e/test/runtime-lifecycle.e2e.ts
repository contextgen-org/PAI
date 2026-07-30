import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import type {
  AdmitTriggerWriterResponseV1,
  ContextSnapshotV1,
  MetaJobCreateRequestV1,
  RuntimeDomainEventV1,
  RuntimeEventAppendRequestV1,
  RuntimeStartRequestV1,
} from "@pai/contracts";
import {
  createInMemoryRuntimeExecutionStoreV1,
  createRuntimeEventReadApplicationV1,
  createRuntimeExecutionApplicationV1,
  RuntimeExecutionErrorV1,
  type RuntimeAdapterTurnV1,
  type RuntimeAdapterContextV1,
  type RuntimeEventOwnerRowV1,
  type RuntimeExecutionDependenciesV1,
  type RuntimeStartPrincipalV1,
} from "@pai/action-runtime";
import {
  canonicalJsonV1,
  canonicalPayloadHashV1,
} from "@pai/eventing";
import type { ObjectRefV1, ObjectStorePortV1 } from "@pai/object-store";
import {
  createRuntimeStartReservationValidationApplicationV1,
  createTriggerAdmissionApplicationV1,
  createTriggerLifecycleApplicationV1,
  type RuntimeStartReservationValidationRowV1,
  type TriggerLifecycleDependenciesV1,
  type TriggerProcessWorkClaimV1,
  type TriggerProcessorOwnerDatabaseV1,
} from "@pai/trigger-processor";

import { runCognitiveOwnerChainV1 } from "./support/cognitive-owner-chain.js";

const at = "2026-07-24T04:00:00.000Z";
const deadline = "2026-07-24T04:30:00.000Z";
const retention = "2026-08-24T04:00:00.000Z";
const fixedHash = `sha256:${"a".repeat(64)}` as const;
const scope = Object.freeze({
  workspace_id: "workspace-system-e2e",
  bot_id: "bot-system-e2e",
  owner_agent_id: "agent-system-e2e",
  deployment_environment: "dev",
  release_channel: "stable",
} as const);
const delegatedPrincipal = Object.freeze({
  principal_type: "developer" as const,
  principal_id: "developer-system-e2e",
  roles: ["developer"],
  source_issuer: "https://system-e2e.supabase.co/auth/v1",
  source_subject: "developer-system-e2e",
  auth_time: 1_784_000_000,
  scope_kind: "bot" as const,
  ...scope,
});

async function admitAuthorizedStrongTrigger() {
  let capturedArguments: Readonly<Record<string, unknown>> | undefined;
  const admission = createTriggerAdmissionApplicationV1(
    {
      repository: {} as never,
      deployment: {} as never,
      unit_of_work: {
        owner_service: "trigger_processor",
        async withTransaction(request: any, work: any) {
          return work(
            {
              owner_service: "trigger_processor",
              transaction_id: `tx:${request.idempotency_key}`,
            },
            {
              owner: {
                async executeWriter(
                  _transaction: unknown,
                  writerRequest: any,
                ) {
                  if (
                    writerRequest.writer !==
                    "create_trigger_admission_v1"
                  ) {
                    throw new Error(
                      `unexpected admission writer ${writerRequest.writer}`,
                    );
                  }
                  capturedArguments = structuredClone(
                    writerRequest.arguments,
                  );
                  const args = writerRequest.arguments as Record<
                    string,
                    unknown
                  >;
                  return {
                    code: "trigger_accepted",
                    message: "accepted",
                    retryable: false,
                    trace_id: String(args["p_trace_id"]),
                    details: {
                      trigger_id: String(args["p_trigger_id"]),
                      trigger_status: "accepted",
                      trigger_process_id: String(args["p_process_id"]),
                      process_phase: "admission",
                      process_status: "running",
                      wait_reason: null,
                      blocked_by_process_id: null,
                      priority: "strong",
                      action: "dispatch",
                      reason_code: "strong_no_active_dispatch",
                      duplicate_replayed: false,
                    },
                  } satisfies AdmitTriggerWriterResponseV1;
                },
              },
            },
          );
        },
      },
    } as unknown as TriggerProcessorOwnerDatabaseV1,
    {
      generateId: (() => {
        const ids = [
          "trigger-system-e2e",
          "process-system-e2e",
        ];
        return () => ids.shift() ?? "unexpected-admission-id";
      })(),
    },
  );
  const response = await admission.admit(
    {
      authentication_kind: "supabase_ingress",
      credential: {
        principal: {
          principal_type: "developer",
          principal_id: "developer-system-e2e",
          roles: ["developer"],
          source_issuer:
            "https://system-e2e.supabase.co/auth/v1",
          source_subject: "developer-system-e2e",
          auth_time: 1_784_000_000,
        },
        claims: {
          iss: "https://system-e2e.supabase.co/auth/v1",
          sub: "developer-system-e2e",
          iat: 1_784_000_000,
          nbf: 1_784_000_000,
          exp: 1_900_000_000,
          aud: "authenticated",
        },
      },
    },
    {
      ...scope,
      source: "chat",
      actor_type: "developer",
      actor_id: "developer-system-e2e",
      payload: {
        message: "run the Day19 authorized Strong flow",
      },
      dedupe_key: "chat:day19-strong-system-e2e",
      priority_hint: "strong",
      trace_id: "trace-system-e2e",
    },
  );
  if (capturedArguments === undefined) {
    throw new Error("Strong admission did not reach the owner writer");
  }
  return { response, captured_arguments: capturedArguments };
}

function sha256Text(value: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

const systemE2eSkillBytes = new TextEncoder().encode(
  "# Skill\n\nSystem E2E bounded search.",
);
const systemE2eSkillDigest = sha256Text(
  Buffer.from(systemE2eSkillBytes).toString("utf8"),
);
const systemE2eManifestBytes = new TextEncoder().encode(
  canonicalJsonV1({
    schema_version: "skill_package_manifest.v1",
    runtime_target: "filesystem_bundle.v1",
    files: [
      {
        path: "SKILL.md",
        mode: "0600",
        size_bytes: systemE2eSkillBytes.byteLength,
        sha256: systemE2eSkillDigest,
      },
    ],
  }),
);
const systemE2eManifestDigest = sha256Text(
  Buffer.from(systemE2eManifestBytes).toString("utf8"),
);

function contextSnapshot(): ContextSnapshotV1 {
  const snapshot = {
    schema_version: "context_snapshot.v1" as const,
    trigger_process_id: "process-system-e2e",
    context_version: 1,
    ...scope,
    pinned_facts: [],
    memory_context: [],
    skill_catalog: {
      catalog_version: "catalog-system-e2e",
      catalog_as_of: at,
      items: [
        {
          skill_key: "skill-system-e2e",
          name: "System E2E Skill",
          description: "Bounded system integration proof skill",
          active_version: "1",
          package_digest: systemE2eSkillDigest,
          manifest_digest: systemE2eManifestDigest,
          runtime_target: "filesystem_bundle.v1",
        },
      ],
    },
    environment: {
      captured_at: at,
      channel: "timer",
      timezone: "UTC",
      capability_summary_ref: "capability-summary:system-e2e",
    },
    history: [],
    source_status: [
      {
        source: "knowthat" as const,
        status: "empty" as const,
        retrieved_at: at,
        source_as_of: at,
        source_version: "knowthat.system-e2e",
        latency_ms: 1,
        result_count: 0,
        failure_reason: null,
      },
      {
        source: "memory" as const,
        status: "empty" as const,
        retrieved_at: at,
        source_as_of: at,
        source_version: "memory.system-e2e",
        latency_ms: 1,
        result_count: 0,
        failure_reason: null,
      },
      {
        source: "skill" as const,
        status: "ok" as const,
        retrieved_at: at,
        source_as_of: at,
        source_version: "catalog-system-e2e",
        latency_ms: 1,
        result_count: 1,
        failure_reason: null,
      },
      {
        source: "environment" as const,
        status: "ok" as const,
        retrieved_at: at,
        source_as_of: at,
        source_version: "environment.system-e2e",
        latency_ms: 1,
        result_count: 1,
        failure_reason: null,
      },
      {
        source: "history" as const,
        status: "empty" as const,
        retrieved_at: at,
        source_as_of: at,
        source_version: "history.system-e2e",
        latency_ms: 1,
        result_count: 0,
        failure_reason: null,
      },
    ],
    assembly_notes: [],
  };
  return Object.freeze({
    ...snapshot,
    snapshot_hash: canonicalPayloadHashV1(snapshot),
  });
}

function runtimeStartRequest(
  snapshot = contextSnapshot(),
): RuntimeStartRequestV1 {
  const structuredIntent = {
    goal: "complete the bounded system integration proof",
    user_need: "durable cross-service execution",
    response_style: "concise",
    action_plan: [
      {
        step: 1,
        action_type: "tool_use" as const,
        action: "invoke the approved search tool",
        candidate_skill: "skill-system-e2e",
      },
    ],
    required_skills: ["skill-system-e2e"],
    memory_followups: [],
    safety_notes: [],
    requires_confirmation: false,
  };
  const policySnapshotWithoutHash = {
    schema_version: "intent_policy_input_snapshot.v1" as const,
    snapshot_ref: "intent-policy:process-system-e2e:1",
    ...scope,
    bot_policy_revision_id: "bot-policy-system-e2e",
    personality_ref: "personality:system-e2e",
    personality_version: 1,
    personality_hash: fixedHash,
    safety_boundaries_ref: "safety:system-e2e",
    safety_boundaries_version: 1,
    safety_boundaries_hash: fixedHash,
    tool_permission_profile_ref: "tool-profile:system-e2e",
    tool_permission_profile_revision: 1,
    tool_permission_profile_hash: fixedHash,
    tool_policy_epoch: 3,
    catalog_version: "catalog-system-e2e",
    catalog_as_of: at,
    security_revocation_epoch: 4,
    skill_permission_summary_ref: "skill-permission:system-e2e",
    skill_permission_summary_hash: fixedHash,
  };
  const policySnapshotHash = canonicalPayloadHashV1(
    policySnapshotWithoutHash,
  );
  const policy = {
    schema_version: "runtime_policy_input.v1" as const,
    intent_policy_snapshot_ref: policySnapshotWithoutHash.snapshot_ref,
    intent_policy_snapshot_hash: policySnapshotHash,
    created_at: at,
    expires_at: "2026-07-25T04:00:00.000Z",
  };
  return Object.freeze({
    schema_version: "runtime_start.v1.2",
    trigger_process_id: snapshot.trigger_process_id,
    runtime_run_id: "run-system-e2e",
    ...scope,
    start_attempt_no: 1,
    start_fence_token: "fence-system-e2e",
    intent_ref: "intent:process-system-e2e:1",
    intent_version: 1,
    structured_intent_hash: canonicalPayloadHashV1(structuredIntent),
    structured_intent: structuredIntent,
    context_snapshot_ref: "context:process-system-e2e:1",
    context_snapshot_version: snapshot.context_version,
    context_snapshot_hash: snapshot.snapshot_hash,
    intent_policy_snapshot_ref: policySnapshotWithoutHash.snapshot_ref,
    intent_policy_snapshot_hash: policySnapshotHash,
    intent_policy_snapshot: {
      ...policySnapshotWithoutHash,
      snapshot_hash: policySnapshotHash,
    },
    expected_catalog_version: policySnapshotWithoutHash.catalog_version,
    catalog_as_of: policySnapshotWithoutHash.catalog_as_of,
    allowed_tools: ["search"],
    allowed_skills: ["skill-system-e2e"],
    planned_skills: ["skill-system-e2e"],
    policy_input_ref: "policy-input:run-system-e2e:1",
    policy_input_hash: canonicalPayloadHashV1(policy),
    policy,
    confirmation_ref: null,
    confirmation_hash: null,
    preempt_token: "preempt-system-e2e",
    idempotency_key: "process-system-e2e:start:1",
    trace_id: "trace-system-e2e",
  });
}

const workClaim = Object.freeze({
  work_item_id: "work-runtime-system-e2e",
  claim_token: "claim-runtime-system-e2e",
  lease_generation: 1,
  lease_owner: "worker-runtime-system-e2e",
  expected_process_state_version: 1,
  payload_hash: fixedHash,
} satisfies TriggerProcessWorkClaimV1);

interface LifecycleOwnerStateV1 {
  reservation?: RuntimeStartReservationValidationRowV1;
  readonly runtime_commands: RuntimeStartRequestV1[];
  readonly append_attempts: RuntimeEventAppendRequestV1[];
  readonly committed_append_by_key: Map<
    string,
    Readonly<{ sequence: number; source_sequence: number }>
  >;
  readonly meta_enqueues: Array<Readonly<Record<string, unknown>>>;
  readonly writer_calls: string[];
}

function lifecycleDatabase(
  state: LifecycleOwnerStateV1,
): TriggerProcessorOwnerDatabaseV1 {
  const database = {
    repository: {},
    deployment: {},
    unit_of_work: {
      owner_service: "trigger_processor",
      async withTransaction(request: any, work: any) {
        return work(
          {
            owner_service: "trigger_processor",
            transaction_id: `tx:${request.idempotency_key}`,
          },
          {
            owner: {
              async executeWriter(
                _transaction: unknown,
                writerRequest: any,
              ) {
                const args = writerRequest.arguments as Record<
                  string,
                  unknown
                >;
                state.writer_calls.push(
                  String(writerRequest.writer),
                );
                if (
                  writerRequest.writer ===
                  "create_runtime_start_reservation_v1"
                ) {
                  const command = structuredClone(
                    args["p_command"],
                  ) as RuntimeStartRequestV1;
                  state.runtime_commands.push(command);
                  state.reservation = Object.freeze({
                    trigger_process_id: command.trigger_process_id,
                    runtime_run_id: command.runtime_run_id,
                    start_attempt_no: command.start_attempt_no,
                    start_fence_generation: 7,
                    start_fence_token_hash: sha256Text(
                      command.start_fence_token,
                    ),
                    request_hash: String(args["p_request_hash"]),
                    status: "dispatching",
                    current_runtime_run_id: null,
                    process_phase: "execution",
                    process_status: "waiting",
                    is_current_fence: true,
                    has_tombstone: false,
                    ...scope,
                  });
                  return {};
                }
                if (
                  writerRequest.writer === "record_runtime_started_v1" ||
                  writerRequest.writer === "enter_trigger_cooldown_v1" ||
                  writerRequest.writer ===
                    "finalize_trigger_runtime_terminal_v1" ||
                  writerRequest.writer ===
                    "apply_runtime_control_handled_v1" ||
                  writerRequest.writer === "append_trigger_snapshot_v1"
                ) {
                  const append = structuredClone(
                    args["p_append_request"],
                  ) as RuntimeEventAppendRequestV1;
                  state.append_attempts.push(append);
                  const existing = state.committed_append_by_key.get(
                    append.idempotency_key,
                  );
                  const committed =
                    existing ??
                    Object.freeze({
                      sequence:
                        state.committed_append_by_key.size + 1,
                      source_sequence: append.source_sequence_no,
                    });
                  state.committed_append_by_key.set(
                    append.idempotency_key,
                    committed,
                  );
                  return {
                    code: "snapshot_appended",
                    message:
                      existing === undefined
                        ? "appended"
                        : "replayed committed append",
                    retryable: false,
                    trace_id: append.trace_id,
                    details: {
                      trigger_process_id: append.trigger_process_id,
                      snapshot_version: committed.sequence,
                      append_sequence_no: committed.sequence,
                      last_sequence_by_source: {
                        action_runtime: committed.source_sequence,
                      },
                      duplicate_replayed: existing !== undefined,
                    },
                  };
                }
                if (
                  writerRequest.writer === "enqueue_trigger_meta_job_v1"
                ) {
                  state.meta_enqueues.push(structuredClone(args));
                  return {};
                }
                throw new Error(
                  `unexpected Trigger lifecycle writer ${writerRequest.writer}`,
                );
              },
            },
          },
        );
      },
    },
  };
  return database as unknown as TriggerProcessorOwnerDatabaseV1;
}

function observationSummary(
  event: RuntimeDomainEventV1,
): RuntimeEventAppendRequestV1["observation_summary"] {
  if (
    event.event_type === "runtime.control_signal.received" ||
    event.event_type === "runtime.control_signal.handled"
  ) {
    return {
      runtime_signal_id: event.payload.runtime_signal_id,
      safe_point_ref: event.payload.safe_point_ref,
      isolation_proof_ref: event.payload.isolation_proof_ref,
      status: event.payload.status,
      duration_ms: null,
      reason_code: event.payload.reason_code,
      error_summary: null,
      artifact_ref: null,
    };
  }
  if (
    event.event_type === "runtime.run.started" ||
    event.event_type === "runtime.run.completed" ||
    event.event_type === "runtime.run.failed" ||
    event.event_type === "runtime.run.cancelled" ||
    event.event_type === "runtime.run.preempted"
  ) {
    return {
      runtime_run_id: event.payload.runtime_run_id,
      status: event.payload.status,
      duration_ms: event.payload.duration_ms,
      reason_code: event.payload.reason_code,
      error_summary: event.payload.error_summary,
      artifact_ref: event.payload.terminal_artifact_ref,
    };
  }
  if (
    event.event_type === "runtime.artifact.created" ||
    event.event_type === "runtime.artifact.failed"
  ) {
    return {
      runtime_run_id: event.payload.runtime_run_id,
      status: event.payload.status,
      duration_ms: null,
      reason_code: event.payload.reason_code,
      error_summary: event.payload.error_summary,
      artifact_ref: event.payload.artifact_ref,
    };
  }
  if (
    event.event_type === "runtime.skill.load.requested" ||
    event.event_type === "runtime.skill.load.resolved" ||
    event.event_type === "runtime.skill.load.materialized" ||
    event.event_type === "runtime.skill.load.failed"
  ) {
    return {
      skill_key: event.payload.skill_key,
      skill_version: event.payload.skill_version,
      status: event.payload.status,
      duration_ms: null,
      reason_code: event.payload.reason_code,
      error_summary: event.payload.error_summary,
      artifact_ref: event.payload.materialized_artifact_ref,
    };
  }
  throw new Error(
    `system E2E callback does not project ${event.event_type}`,
  );
}

function objectStore(): ObjectStorePortV1 {
  return {
    async putImmutable(request) {
      return {
        object_ref: `object:${request.idempotency_key}` as ObjectRefV1,
        version: "1",
        sha256: request.expected_sha256,
        size_bytes: request.size_bytes,
        media_type: request.media_type,
        retention_until: request.retention_until,
        replayed: false,
      };
    },
    async head() {
      throw new Error("not used");
    },
    async getStream() {
      throw new Error("not used");
    },
    async issueReadGrant() {
      throw new Error("not used");
    },
    async deleteIfEligible() {
      throw new Error("not used");
    },
  };
}

function lifecycleDependencies(
  snapshot: ContextSnapshotV1,
  runtimeRows: Map<string, RuntimeEventOwnerRowV1>,
): TriggerLifecycleDependenciesV1 {
  const eventRead = createRuntimeEventReadApplicationV1(
    {
      async findByOwnerIdentity(sourceEventId, payloadRef) {
        const row = runtimeRows.get(sourceEventId);
        return row?.payload_ref === payloadRef ? row : undefined;
      },
    },
    { now: () => new Date(at) },
  );
  const unusedSource = {
    async fetch(): Promise<never> {
      throw new Error("not used");
    },
  };
  return {
    context_sources: {
      knowthat: unusedSource,
      memory: unusedSource,
      skill: unusedSource,
      environment: unusedSource,
      history: unusedSource,
    },
    intent_policy_sources: {
      tool_permissions: {
        async readCurrent(): Promise<never> {
          throw new Error("not used");
        },
      },
      skill_catalog: {
        async readFirstPage(): Promise<never> {
          throw new Error("not used");
        },
      },
    },
    intent_engine: {
      async synthesize(): Promise<never> {
        throw new Error("not used");
      },
    },
    object_store: objectStore(),
    context_snapshots: {
      async resolve() {
        return snapshot;
      },
    },
    runtime_events: {
      async resolve(request, signal) {
        return eventRead.resolve(
          {
            sub: "trigger_processor",
            aud: "action_runtime",
            capability: ["runtime.event.resolve"],
            scope,
          },
          request,
          signal,
        );
      },
    },
    process_snapshot_retention: {
      async readCurrent() {
        return retention;
      },
    },
    now: () => new Date(at),
    context_retention_until: () => retention,
  } as TriggerLifecycleDependenciesV1;
}

interface RuntimeHarnessOptionsV1 {
  readonly adapter_next?: (
    turn: number,
    context: RuntimeAdapterContextV1,
  ) => Promise<RuntimeAdapterTurnV1> | RuntimeAdapterTurnV1;
  readonly disconnect_after_completed_commit?: boolean;
  readonly now?: () => Date;
}

function runtimeHarness(options: RuntimeHarnessOptionsV1 = {}) {
  const now = options.now ?? (() => new Date(at));
  const snapshot = contextSnapshot();
  const startRequest = runtimeStartRequest(snapshot);
  const lifecycleState: LifecycleOwnerStateV1 = {
    runtime_commands: [],
    append_attempts: [],
    committed_append_by_key: new Map(),
    meta_enqueues: [],
    writer_calls: [],
  };
  const runtimeRows = new Map<string, RuntimeEventOwnerRowV1>();
  const lifecycle = createTriggerLifecycleApplicationV1(
    lifecycleDatabase(lifecycleState),
    lifecycleDependencies(snapshot, runtimeRows),
  );
  const reservation =
    createRuntimeStartReservationValidationApplicationV1({
      async withLockedExactReservation(path, inspect) {
        const row = lifecycleState.reservation;
        if (
          row === undefined ||
          row.trigger_process_id !== path.trigger_process_id ||
          row.start_attempt_no !== path.start_attempt_no
        ) {
          return inspect({ outcome: "not_found" });
        }
        return inspect({ outcome: "found", reservation: row });
      },
    });
  const callbackTransportEpoch =
    "trigger-processor-runtime-events.v1";
  const callbackTransportGeneration = 1;
  const store = createInMemoryRuntimeExecutionStoreV1({
    now,
    transport_epoch: callbackTransportEpoch,
    transport_generation: callbackTransportGeneration,
  });
  const skillBytes = systemE2eSkillBytes;
  const skillDigest = systemE2eSkillDigest;
  const manifestBytes = systemE2eManifestBytes;
  const manifestDigest = systemE2eManifestDigest;
  let completedDisconnect =
    options.disconnect_after_completed_commit ?? true;
  const callbackAttempts: string[] = [];
  const sdkSkillEntries: Array<
    Readonly<{ path: string; sha256: string; content: string }>
  > = [];
  const sequenceByRun = new Map<string, number>();
  let adapterTurn = 0;
  const adapterCancelReasons: string[] = [];
  const dependencies: RuntimeExecutionDependenciesV1 = {
    store,
    reservation: {
      async validate(principal, path, request) {
        return reservation.validate(principal, path, request);
      },
    },
    control_tokens: {
      async verify(token, expected) {
        if (token !== "preempt-system-e2e") {
          throw new Error("invalid control token");
        }
        return {
          runtime_run_id: expected.runtime_run_id,
          trigger_process_id: expected.trigger_process_id,
          start_attempt_no: expected.start_attempt_no,
          start_fence_generation: 7,
          ...expected.scope,
          control_valid_until: "2026-07-25T04:15:00.000Z",
        };
      },
    },
    context_snapshots: {
      async resolve(request, signal) {
        if (signal?.aborted === true) throw signal.reason;
        const canonicalBytes = Buffer.from(
          canonicalJsonV1(snapshot),
          "utf8",
        );
        return {
          schema_version: "context_snapshot_read.v1",
          context_snapshot_ref: request.context_snapshot_ref,
          context_snapshot_version:
            request.context_snapshot_version,
          context_snapshot_hash: request.context_snapshot_hash,
          canonical_bytes_sha256: sha256Text(
            canonicalBytes.toString("utf8"),
          ),
          content_length_bytes: canonicalBytes.byteLength,
          context_snapshot: snapshot,
          retention_until: retention,
          redaction_state: "complete",
          resolved_at: at,
          trace_id: request.trace_id,
          delivery_mode: "inline",
          chunks: null,
        };
      },
    },
    policy_checkpoints: {
      async check(request, signal) {
        if (signal?.aborted === true) throw signal.reason;
        return {
          schema_version:
            "runtime_policy_checkpoint_result.v1",
          checkpoint: request.checkpoint,
          runtime_run_id: request.runtime_run_id,
          policy_snapshot_id: request.policy_snapshot_id,
          status:
            Date.parse(request.policy_expires_at) <=
            Date.parse(request.checked_at)
              ? "runtime_policy_expired"
              : "valid",
          expected_security_revocation_epoch:
            request.expected_security_revocation_epoch,
          current_security_revocation_epoch:
            request.expected_security_revocation_epoch,
          checked_at: request.checked_at,
        };
      },
    },
    profiles: {
      async resolveExact() {
        return {
          profile_ref: "tool-profile:system-e2e",
          revision: 1,
          profile_hash: fixedHash,
          policy_epoch: 3,
          allowed_tools: ["search"],
          tool_arg_constraints: {},
          validateArguments: () => true,
        };
      },
    },
    adapter: {
      adapter_id: "ClaudeAgentSdkRuntimeAdapter",
      sdk_package: "@anthropic-ai/claude-agent-sdk",
      sdk_version: "0.3.212",
      model: "claude-sonnet-pinned",
      async start() {
        return { session_id: "session-system-e2e" };
      },
      async next(_session, context): Promise<RuntimeAdapterTurnV1> {
        adapterTurn += 1;
        if (options.adapter_next !== undefined) {
          return options.adapter_next(adapterTurn, context);
        }
        if (adapterTurn === 1) {
          return {
            kind: "skill_load",
            skill_key: "skill-system-e2e",
          };
        }
        const [entry] =
          context.last_skill_materialization?.entries ?? [];
        if (
          context.last_skill?.skill_key !== "skill-system-e2e" ||
          entry === undefined
        ) {
          throw new Error(
            "SDK adapter did not receive the exact materialized skill entry",
          );
        }
        sdkSkillEntries.push({
          path: entry.path,
          sha256: entry.sha256,
          content: Buffer.from(entry.bytes).toString("utf8"),
        });
        return { kind: "complete", terminal_artifact_ref: null };
      },
      async cancel(_session, reason) {
        adapterCancelReasons.push(reason);
      },
    },
    tools: {
      capabilityFor(toolName) {
        if (toolName === "search") return "search.read";
        throw new Error(`No trusted capability mapping for ${toolName}`);
      },
      async invoke() {
        return {
          outcome: "completed",
          retryable: false,
          side_effect_status: "none",
          output: { ok: true },
        };
      },
    },
    skills: {
      async resolve(request) {
        return {
          code: "skill_resolution_succeeded",
          message: "skills resolved",
          retryable: false,
          trace_id: request.trace_id,
          details: {
            schema_version: "skill_resolution_response.v1",
            resolution_attempt_id:
              `resolution-attempt:${request.runtime_run_id}:${request.start_attempt_no}`,
            runtime_run_id: request.runtime_run_id,
            start_attempt_no: request.start_attempt_no,
            workspace_id: request.workspace_id,
            bot_id: request.bot_id,
            owner_agent_id: request.owner_agent_id,
            deployment_environment: request.deployment_environment,
            release_channel: request.release_channel,
            requested_catalog_version: request.expected_catalog_version,
            effective_catalog_version: request.expected_catalog_version,
            catalog_as_of: request.catalog_as_of,
            security_revocation_epoch: 4,
            policy_input_hash: request.policy_input_hash,
            valid_until: startRequest.policy.expires_at,
            resolved_skills: request.skills.map((skill) => ({
              resolution_id: `resolution:${skill.name}:1`,
              skill_id: `skill:${skill.name}`,
              skill_key: skill.name,
              version: "1",
              version_id: `version:${skill.name}:1`,
              package_digest: skillDigest,
              manifest_digest: manifestDigest,
              granted_capability_refs: ["search.read"],
              runtime_target: "filesystem_bundle.v1" as const,
              required: skill.required,
              valid_until: startRequest.policy.expires_at,
            })),
            degradation_notes: [],
            duplicate_replayed: false,
          },
        };
      },
      async load() {
        return {
          source: "skill_registry",
          bytes: skillBytes,
          manifest_bytes: manifestBytes,
          media_type: "application/gzip",
          package_digest: skillDigest,
          manifest_digest: manifestDigest,
          runtime_target: "filesystem_bundle.v1",
          entry_paths: ["SKILL.md"],
          entries: [
            {
              path: "SKILL.md",
              mode: "0600",
              bytes: skillBytes,
              sha256: skillDigest,
            },
          ],
        };
      },
    },
    object_store: objectStore(),
    callback: {
      worker_id: "system-e2e-runtime-event-dispatcher",
      lease_seconds: 30,
      transport_epoch: callbackTransportEpoch,
      transport_generation: callbackTransportGeneration,
      async deliver(event) {
        callbackAttempts.push(event.event_type);
        const runId = event.payload.runtime_run_id;
        const sourceSequence = sequenceByRun.get(runId) ?? 1;
        if (!runtimeRows.has(event.event_id)) {
          sequenceByRun.set(runId, sourceSequence + 1);
          const payloadHash = canonicalPayloadHashV1(event);
          runtimeRows.set(event.event_id, {
            source_event_id: event.event_id,
            payload_ref: `runtime_event:${event.event_id}`,
            payload_hash: payloadHash,
            runtime_run_id: runId,
            trigger_process_id: event.payload.trigger_process_id,
            source_sequence_no: sourceSequence,
            ...scope,
            owner_start_attempt_no: event.payload.start_attempt_no,
            owner_start_fence_generation:
              event.payload.start_fence_generation,
            runtime_event: event,
            envelope_canonical_base64: Buffer.from(
              canonicalJsonV1(event),
              "utf8",
            ).toString("base64"),
            retention_until: retention,
            redaction_state: "complete",
          });
        }
        const row = runtimeRows.get(event.event_id)!;
        await lifecycle.appendRuntimeEvent({
          request: {
            trigger_process_id: event.payload.trigger_process_id,
            runtime_run_id: runId,
            source_event_id: event.event_id,
            source_service: "action_runtime",
            source_sequence_no: Number(row.source_sequence_no),
            event_type: event.event_type,
            schema_version: event.schema_version,
            occurred_at: event.occurred_at,
            trace_id: event.trace_id,
            append_type: "runtime_event",
            payload_ref: row.payload_ref,
            payload_hash: row.payload_hash,
            observation_summary: observationSummary(event),
            idempotency_key: `action_runtime:${event.event_id}`,
          },
          authenticated_principal: {
            sub: "action_runtime",
            aud: "trigger_processor",
            capability: ["trigger.process.snapshot.append"],
            scope_kind: "bot",
            ...scope,
          },
        });
        if (
          event.event_type === "runtime.run.completed" &&
          completedDisconnect
        ) {
          completedDisconnect = false;
          throw new Error(
            "connection closed after Trigger snapshot owner commit",
          );
        }
        return {
          transport_ref: `trigger-snapshot:${event.event_id}`,
        };
      },
    },
  };
  const runtime = createRuntimeExecutionApplicationV1(dependencies, {
    now,
    max_adapter_turns: 10,
    max_retry_attempts: 2,
  });
  const principal: RuntimeStartPrincipalV1 = {
    sub: "trigger_processor",
    aud: "action_runtime",
    capability: ["runtime.start", "runtime.control"],
    delegated_principal: delegatedPrincipal,
    scope,
  };
  return {
    callbackAttempts,
    adapterCancelReasons,
    dependencies,
    lifecycle,
    lifecycleState,
    principal,
    runtime,
    sdkSkillEntries,
    startRequest,
    store,
  };
}

async function reserve(
  harness: ReturnType<typeof runtimeHarness>,
): Promise<void> {
  await harness.lifecycle.reserveRuntimeStart(
    harness.startRequest,
    workClaim,
  );
  expect(harness.lifecycleState.runtime_commands).toEqual([
    harness.startRequest,
  ]);
}

describe("Trigger lifecycle to Action Runtime", () => {
  it("[Day19 P0 #1/#6-outbox, process-internal] dispatches verified Strong ingress through the TP owner boundary and recovers callback replay after app restart", async () => {
    const admitted = await admitAuthorizedStrongTrigger();
    expect(admitted.response).toMatchObject({
      code: "trigger_accepted",
      trace_id: "trace-system-e2e",
      details: {
        trigger_id: "trigger-system-e2e",
        trigger_process_id: "process-system-e2e",
        priority: "strong",
        action: "dispatch",
        reason_code: "strong_no_active_dispatch",
      },
    });
    if (admitted.response.code !== "trigger_accepted") {
      throw new Error("verified Strong admission was not accepted");
    }
    expect(admitted.captured_arguments).toMatchObject({
      p_actor: {
        actor_type: "developer",
        actor_id: "developer-system-e2e",
      },
      p_authenticated_context: {
        authentication_kind: "supabase_ingress",
        permission_scope: "trigger.submit.chat",
        principal_id: "developer-system-e2e",
      },
      p_admission_request: {
        trusted_strong_hint: true,
        priority_hint: "strong",
      },
    });
    const harness = runtimeHarness();
    expect(harness.startRequest.trigger_process_id).toBe(
      admitted.response.details.trigger_process_id,
    );
    expect(harness.startRequest.trace_id).toBe(
      admitted.response.trace_id,
    );
    await reserve(harness);
    const command = harness.lifecycleState.runtime_commands[0]!;
    const first = await harness.runtime.start(
      harness.principal,
      command,
    );
    const duplicate = await harness.runtime.start(
      harness.principal,
      structuredClone(command),
    );
    expect(duplicate).toEqual(first);
    expect(first.details.start_fence_generation).toBe(7);

    const run = await harness.runtime.executeQueued({
      runtime_run_id: command.runtime_run_id,
      worker_id: "action-worker-system-e2e",
      expected_start_fence_generation:
        first.details.start_fence_generation,
      lease_seconds: 600,
      deadline_at: deadline,
    });
    expect(run.status).toBe("completed");
    expect(run.events.map((event) => event.event_type)).toEqual([
      "runtime.run.started",
      "runtime.skill.load.requested",
      "runtime.skill.load.resolved",
      "runtime.skill.load.materialized",
      "runtime.run.completed",
    ]);
    expect(harness.sdkSkillEntries).toEqual([
      {
        path: "SKILL.md",
        sha256: sha256Text(
          "# Skill\n\nSystem E2E bounded search.",
        ),
        content: "# Skill\n\nSystem E2E bounded search.",
      },
    ]);
    expect(
      run.outbox.filter((record) => record.status === "pending"),
    ).toHaveLength(1);
    expect(harness.lifecycleState.committed_append_by_key).toHaveLength(5);

    const restartedRuntime =
      createRuntimeExecutionApplicationV1(harness.dependencies, {
        now: () => new Date(at),
        max_adapter_turns: 10,
        max_retry_attempts: 2,
      });
    await expect(
      restartedRuntime.recoverPendingCallbacks(),
    ).resolves.toEqual({ attempted: 1, sent: 1 });
    expect(
      (await harness.store.readRun(command.runtime_run_id))?.outbox.every(
        (record) => record.status === "sent",
      ),
    ).toBe(true);
    expect(harness.lifecycleState.committed_append_by_key).toHaveLength(5);
    expect(
      harness.lifecycleState.append_attempts.filter(
        (append) => append.event_type === "runtime.run.completed",
      ),
    ).toHaveLength(2);
    expect(
      harness.callbackAttempts.filter(
        (eventType) => eventType === "runtime.run.completed",
      ),
    ).toHaveLength(2);

    const metaRequest: MetaJobCreateRequestV1 = {
      schema_version: "meta_job_create.v1",
      trigger_process_id: command.trigger_process_id,
      ...scope,
      snapshot_ref: "snapshot:process-system-e2e:terminal",
      snapshot_version: 2,
      snapshot_hash: fixedHash,
      snapshot_retention_until: "2026-07-24T05:00:00.000Z",
      cooldown_until: at,
      boundary_system_event_ref: null,
      learnable_snapshot_ready: true,
      enqueue_reason: "cooldown_expired",
      idempotency_key: command.trigger_process_id,
      trace_id: command.trace_id,
    };
    await harness.lifecycle.enqueueMeta(
      {
        request: metaRequest,
        boundary_system_event_ref: null,
      },
      {
        ...workClaim,
        work_item_id: "work-meta-system-e2e",
        claim_token: "claim-meta-system-e2e",
        expected_process_state_version: 3,
      },
    );
    expect(harness.lifecycleState.meta_enqueues).toHaveLength(1);
    expect(
      harness.lifecycleState.meta_enqueues[0],
    ).toMatchObject({
      p_process_id: command.trigger_process_id,
      p_enqueue_reason: "cooldown_expired",
      p_idempotency_key: command.trigger_process_id,
    });
  });

  it("[Day19 P0 #6-runtime, process-internal] takes over an expired Runtime lease after app restart without replaying committed events", async () => {
    let clock = new Date(at);
    let crashedAdapterEntered!: () => void;
    const crashedAdapterEnteredPromise = new Promise<void>(
      (resolve) => {
        crashedAdapterEntered = resolve;
      },
    );
    const harness = runtimeHarness({
      disconnect_after_completed_commit: false,
      now: () => new Date(clock),
      adapter_next(turn, context) {
        if (turn > 1) {
          return {
            kind: "complete",
            terminal_artifact_ref: null,
          };
        }
        crashedAdapterEntered();
        return new Promise<RuntimeAdapterTurnV1>((_resolve, reject) => {
          const failLikeProcessLoss = () =>
            reject(
              context.signal.reason ??
                new Error("simulated Runtime process loss"),
            );
          if (context.signal.aborted) failLikeProcessLoss();
          else {
            context.signal.addEventListener(
              "abort",
              failLikeProcessLoss,
              { once: true },
            );
          }
        });
      },
    });
    await reserve(harness);
    const started = await harness.runtime.start(
      harness.principal,
      harness.startRequest,
    );
    const processLifetime = new AbortController();
    const crashedExecution = harness.runtime.executeQueued(
      {
        runtime_run_id: harness.startRequest.runtime_run_id,
        worker_id: "action-worker-before-crash",
        expected_start_fence_generation:
          started.details.start_fence_generation,
        lease_seconds: 30,
        deadline_at: deadline,
      },
      processLifetime.signal,
    );
    await crashedAdapterEnteredPromise;
    processLifetime.abort(new Error("simulated Runtime process loss"));
    await expect(crashedExecution).rejects.toMatchObject({
      code: "runtime_cancelled",
    } satisfies Partial<RuntimeExecutionErrorV1>);
    const stranded = await harness.store.readRun(
      harness.startRequest.runtime_run_id,
    );
    expect(stranded).toMatchObject({
      status: "running",
      lease: {
        owner_id: "action-worker-before-crash",
        generation: 1,
      },
    });
    expect(
      stranded?.events.filter(
        (event) => event.event_type === "runtime.run.started",
      ),
    ).toHaveLength(1);

    clock = new Date("2026-07-24T04:00:31.000Z");
    const restartedRuntime =
      createRuntimeExecutionApplicationV1(harness.dependencies, {
        now: () => new Date(clock),
        max_adapter_turns: 10,
        max_retry_attempts: 2,
      });
    await expect(
      restartedRuntime.start(
        harness.principal,
        structuredClone(harness.startRequest),
      ),
    ).resolves.toEqual(started);
    const recovered = await restartedRuntime.executeQueued({
      runtime_run_id: harness.startRequest.runtime_run_id,
      worker_id: "action-worker-after-restart",
      expected_start_fence_generation:
        started.details.start_fence_generation,
      lease_seconds: 30,
      deadline_at: deadline,
    });
    expect(recovered.status).toBe("completed");
    expect(recovered.lease?.generation).toBe(2);
    expect(
      recovered.events.filter(
        (event) => event.event_type === "runtime.run.started",
      ),
    ).toHaveLength(1);
    expect(
      recovered.events.filter(
        (event) => event.event_type === "runtime.run.completed",
      ),
    ).toHaveLength(1);
    expect(
      harness.lifecycleState.committed_append_by_key.size,
    ).toBe(2);
  });

  it("[Day19 P0 #4, process-internal] carries an available Runtime artifact through TP evidence into Meta, Memory, and KnowThat owner writes", async () => {
    const artifactContent = JSON.stringify({
      schema_version: "runtime_result_artifact.v1",
      summary: "Day19 owner chain completed",
    });
    const artifactBytes = new TextEncoder().encode(artifactContent);
    const artifactHash = sha256Text(artifactContent);
    const harness = runtimeHarness({
      disconnect_after_completed_commit: false,
      adapter_next(turn, context) {
        if (turn === 1) {
          return {
            kind: "artifact",
            artifact: {
              artifact_id: "artifact-day19-owner-chain",
              artifact_kind: "runtime-result",
              media_type: "application/json",
              body: artifactBytes,
              expected_sha256: artifactHash,
              retention_until: retention,
            },
          };
        }
        if (
          context.last_artifact_id !==
            "artifact-day19-owner-chain" ||
          context.last_artifact_ref === undefined
        ) {
          throw new Error(
            "Runtime adapter did not observe its committed artifact",
          );
        }
        return {
          kind: "complete",
          terminal_artifact_ref: context.last_artifact_ref,
        };
      },
    });
    await reserve(harness);
    const started = await harness.runtime.start(
      harness.principal,
      harness.startRequest,
    );
    const runtimeResult = await harness.runtime.executeQueued({
      runtime_run_id: harness.startRequest.runtime_run_id,
      worker_id: "action-worker-artifact-system-e2e",
      expected_start_fence_generation:
        started.details.start_fence_generation,
      lease_seconds: 600,
      deadline_at: deadline,
    });
    expect(runtimeResult.status).toBe("completed");
    const artifactEvent = runtimeResult.events.find(
      (event) => event.event_type === "runtime.artifact.created",
    );
    if (
      artifactEvent?.event_type !== "runtime.artifact.created" ||
      artifactEvent.payload.artifact_ref === null
    ) {
      throw new Error(
        "Runtime did not commit an available artifact event",
      );
    }
    const artifactRef = artifactEvent.payload.artifact_ref;
    expect(artifactEvent.payload).toMatchObject({
      artifact_id: "artifact-day19-owner-chain",
      artifact_status: "available",
      content_hash: artifactHash,
      size_bytes: artifactBytes.byteLength,
      media_type: "application/json",
      retention_until: retention,
    });
    expect(
      runtimeResult.events.find(
        (event) => event.event_type === "runtime.run.completed",
      ),
    ).toMatchObject({
      payload: { terminal_artifact_ref: artifactRef },
    });
    expect(
      harness.lifecycleState.append_attempts.find(
        (append) =>
          append.event_type === "runtime.artifact.created",
      ),
    ).toMatchObject({
      trigger_process_id:
        harness.startRequest.trigger_process_id,
      runtime_run_id: harness.startRequest.runtime_run_id,
      trace_id: harness.startRequest.trace_id,
      observation_summary: {
        status: "available",
        artifact_ref: artifactRef,
      },
    });

    const cognitive = await runCognitiveOwnerChainV1({
      artifact_ref: artifactRef,
      runtime_run_id: harness.startRequest.runtime_run_id,
      trigger_process_id:
        harness.startRequest.trigger_process_id,
      trace_id: harness.startRequest.trace_id,
      now: at,
      retention_until: retention,
      scope,
    });
    if (cognitive.result.outcome !== "completed") {
      throw new Error(
        `Meta owner chain did not complete: ${JSON.stringify(cognitive.result)}`,
      );
    }
    expect(cognitive.result.outcome).toBe("completed");
    expect(
      cognitive.result.result.payload.memory_write_result.status,
    ).toBe("succeeded");
    expect(
      cognitive.result.result.payload.knowthat_write_result.status,
    ).toBe("succeeded");
    expect(cognitive.provider_calls).toBe(1);
    expect(cognitive.memory_requests).toHaveLength(1);
    expect(cognitive.knowthat_requests).toHaveLength(1);
    expect(cognitive.memory_requests[0]).toMatchObject({
      trigger_process_id:
        harness.startRequest.trigger_process_id,
      items: [
        {
          source_info: {
            source_ref: `artifact:${artifactRef}`,
          },
        },
      ],
    });
    expect(cognitive.knowthat_requests[0]).toMatchObject({
      trigger_process_id:
        harness.startRequest.trigger_process_id,
      items: [
        {
          source_ref: `artifact:${artifactRef}`,
          evidence_refs: [`artifact:${artifactRef}`],
        },
      ],
    });
    expect(
      cognitive.inspection.events.map((event) => event.event_type),
    ).toEqual(
      expect.arrayContaining([
        "meta.memory.write_requested",
        "meta.knowthat.write_requested",
        "meta.result.finalized",
        "meta.job.completed",
      ]),
    );
  });

  it.each([
    ["runtime_cancel.v1", "runtime_cancelled"],
    ["runtime_preempt.v1", "runtime_preempted"],
  ] as const)(
    "[Day19 P0 #5-pre-start, process-internal] persists %s before start and fences the later Runtime command",
    async (schemaVersion, expectedCode) => {
      const harness = runtimeHarness();
      await reserve(harness);
      const command = harness.startRequest;
      const control = {
        schema_version: schemaVersion,
        runtime_signal_id: `signal:${schemaVersion}`,
        runtime_run_id: command.runtime_run_id,
        trigger_process_id: command.trigger_process_id,
        start_attempt_no: command.start_attempt_no,
        preempt_token: command.preempt_token,
        reason_code:
          schemaVersion === "runtime_cancel.v1"
            ? "user_cancelled"
            : "strong_trigger_preempt",
        requested_at: at,
        idempotency_key: `${command.runtime_run_id}:control:${schemaVersion}`,
        trace_id: command.trace_id,
      };
      await expect(
        harness.runtime.receiveControl(harness.principal, control),
      ).resolves.toEqual({ accepted: true, replayed: false });
      await expect(
        harness.runtime.receiveControl(
          harness.principal,
          structuredClone(control),
        ),
      ).resolves.toEqual({ accepted: true, replayed: true });
      await expect(
        harness.runtime.start(harness.principal, command),
      ).rejects.toMatchObject({
        code: expectedCode,
      } satisfies Partial<RuntimeExecutionErrorV1>);
      expect(
        await harness.store.readRun(command.runtime_run_id),
      ).toBeUndefined();
    },
  );

  it.each([
    [
      "runtime_cancel.v1",
      "runtime.run.cancelled",
      "user_cancelled",
    ],
    [
      "runtime_preempt.v1",
      "runtime.run.preempted",
      "strong_trigger_preempt",
    ],
  ] as const)(
    "[Day19 P0 #5, process-internal] converges an in-flight %s through Runtime safe-point handling and the TP owner callback",
    async (schemaVersion, terminalEventType, expectedCancelReason) => {
      let adapterEntered!: () => void;
      const adapterEnteredPromise = new Promise<void>((resolve) => {
        adapterEntered = resolve;
      });
      let releaseAdapter!: () => void;
      const releaseAdapterPromise = new Promise<void>((resolve) => {
        releaseAdapter = resolve;
      });
      const harness = runtimeHarness({
        disconnect_after_completed_commit: false,
        async adapter_next() {
          adapterEntered();
          await releaseAdapterPromise;
          return { kind: "checkpoint" };
        },
      });
      await reserve(harness);
      const started = await harness.runtime.start(
        harness.principal,
        harness.startRequest,
      );
      const execution = harness.runtime.executeQueued({
        runtime_run_id: harness.startRequest.runtime_run_id,
        worker_id: `action-worker-${expectedCancelReason}`,
        expected_start_fence_generation:
          started.details.start_fence_generation,
        lease_seconds: 600,
        deadline_at: deadline,
      });
      await adapterEnteredPromise;

      const control = {
        schema_version: schemaVersion,
        runtime_signal_id: `signal:in-flight:${schemaVersion}`,
        runtime_run_id: harness.startRequest.runtime_run_id,
        trigger_process_id:
          harness.startRequest.trigger_process_id,
        start_attempt_no: harness.startRequest.start_attempt_no,
        preempt_token: harness.startRequest.preempt_token,
        reason_code:
          schemaVersion === "runtime_cancel.v1"
            ? "user_cancelled"
            : "strong_trigger_preempt",
        requested_at: at,
        idempotency_key:
          `${harness.startRequest.runtime_run_id}:in-flight:${schemaVersion}`,
        trace_id: harness.startRequest.trace_id,
      };
      await expect(
        harness.runtime.receiveControl(harness.principal, control),
      ).resolves.toEqual({ accepted: true, replayed: false });
      releaseAdapter();
      const converged = await execution;

      expect(converged.status).toBe("cancelled");
      expect(
        converged.events.map((event) => event.event_type),
      ).toEqual(
        expect.arrayContaining([
          "runtime.run.started",
          "runtime.control_signal.received",
          "runtime.control_signal.handled",
          terminalEventType,
        ]),
      );
      expect(harness.adapterCancelReasons).toContain(
        expectedCancelReason,
      );
      expect(harness.lifecycleState.writer_calls).toContain(
        "apply_runtime_control_handled_v1",
      );
      const handled = harness.lifecycleState.append_attempts.find(
        (append) =>
          append.event_type === "runtime.control_signal.handled",
      );
      expect(handled).toMatchObject({
        trigger_process_id:
          harness.startRequest.trigger_process_id,
        runtime_run_id: harness.startRequest.runtime_run_id,
        trace_id: harness.startRequest.trace_id,
        observation_summary: {
          runtime_signal_id: control.runtime_signal_id,
          status: "handled",
          reason_code: control.reason_code,
        },
      });
      expect(
        harness.lifecycleState.append_attempts.at(-1),
      ).toMatchObject({
        event_type: terminalEventType,
        observation_summary: {
          status: "cancelled",
          reason_code: control.reason_code,
        },
      });
      await expect(
        harness.runtime.receiveControl(
          harness.principal,
          structuredClone(control),
        ),
      ).resolves.toEqual({ accepted: true, replayed: true });
      expect(
        harness.lifecycleState.append_attempts.filter(
          (append) =>
            append.event_type ===
            "runtime.control_signal.handled",
        ),
      ).toHaveLength(1);
    },
  );

  it("[Day19 P0 #7] rejects wrong Runtime audience, missing capability, and cross-scope TP principals before creating a run", async () => {
    const harness = runtimeHarness();
    await reserve(harness);
    for (const principal of [
      {
        ...harness.principal,
        aud: "memory" as const,
      },
      {
        ...harness.principal,
        capability: ["runtime.control"],
      },
      {
        ...harness.principal,
        scope: { ...scope, owner_agent_id: "agent-other" },
      },
    ]) {
      await expect(
        harness.runtime.start(principal as RuntimeStartPrincipalV1, {
          ...harness.startRequest,
          idempotency_key:
            `${harness.startRequest.idempotency_key}:${principal.aud}:${principal.scope.owner_agent_id}:${principal.capability.join(",")}`,
        }),
      ).rejects.toMatchObject({
        code: "authorization_scope_mismatch",
      } satisfies Partial<RuntimeExecutionErrorV1>);
    }
    expect(
      await harness.store.readRun(harness.startRequest.runtime_run_id),
    ).toBeUndefined();
  });
});
