import { createHash } from "node:crypto";

import type { VerifiedWorkloadCredential } from "@pai/auth";
import type { ContextSnapshotV1, RuntimeDomainEventV1 } from "@pai/contracts";
import { canonicalJsonV1, canonicalPayloadHashV1 } from "@pai/eventing";
import {
  ObjectStoreErrorV1,
  type ObjectRefV1,
  type ObjectStorePortV1,
} from "@pai/object-store";
import { InternalClientError } from "@pai/service-kit";
import { describe, expect, it, vi } from "vitest";

import {
  RuntimeExecutionErrorV1,
  createInMemoryRuntimeExecutionStoreV1,
  createRuntimeExecutionApplicationV1,
  type RuntimeAdapterTurnV1,
  type RuntimeExecutionDependenciesV1,
  type RuntimeExecutionStoreV1,
  type RuntimeRunRecordV1,
  type RuntimeStartPrincipalV1,
  type RuntimeStartValidationFactInputV1,
  type RuntimeToolResultV1,
  type RuntimeToolAuditV1,
} from "../src/runtime-execution.v1.js";
import { runtimeEventRetentionUntilV1 } from "../src/db/postgres-runtime-execution-store.v1.js";
import { buildActionRuntimeApp } from "../src/app.js";

const at = "2026-07-23T04:00:00.000Z";
const now = new Date(at);
const deadline = "2026-07-23T04:30:00.000Z";
const hash = `sha256:${"a".repeat(64)}` as const;
const rawSha256 = (bytes: Uint8Array): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const skillPackageBytes = new TextEncoder().encode(
  "# Skill\n\nUse only the granted capability.\n",
);
const skillPackageDigest = rawSha256(skillPackageBytes);
const skillManifestBytes = new TextEncoder().encode(
  canonicalJsonV1({
    schema_version: "skill_package_manifest.v1",
    runtime_target: "filesystem_bundle.v1",
    files: [
      {
        path: "SKILL.md",
        mode: "0600",
        size_bytes: skillPackageBytes.byteLength,
        sha256: skillPackageDigest,
      },
    ],
  }),
);
const skillManifestDigest = rawSha256(skillManifestBytes);
const scope = {
  workspace_id: "workspace-1",
  bot_id: "bot-1",
  owner_agent_id: "agent-1",
  deployment_environment: "dev" as const,
  release_channel: "stable" as const,
};
const delegatedPrincipal = Object.freeze({
  principal_type: "user" as const,
  principal_id: "user-1",
  roles: Object.freeze(["member"]),
  source_issuer: "https://auth.example.test",
  source_subject: "auth-user-1",
  auth_time: 100,
  scope_kind: "bot" as const,
  ...scope,
});

function directToolEvent(
  run: RuntimeRunRecordV1,
  audit: RuntimeToolAuditV1,
  eventType:
    | "runtime.tool.requested"
    | "runtime.tool.completed",
  status: "requested" | "completed",
  result?: RuntimeToolResultV1,
  outputRef: string | null = null,
): RuntimeDomainEventV1 {
  return {
    event_id: `${run.request.runtime_run_id}:${run.next_sequence_no}:${eventType}:${audit.tool_invocation_id}`,
    event_type: eventType,
    schema_version: "runtime_event.v1",
    producer: "action_runtime",
    occurred_at: at,
    idempotency_key: `${run.request.runtime_run_id}:tool:${audit.tool_invocation_id}:${status}`,
    trace_id: run.request.trace_id,
    payload: {
      trigger_process_id: run.request.trigger_process_id,
      runtime_run_id: run.request.runtime_run_id,
      ...scope,
      sequence_no: run.next_sequence_no,
      start_attempt_no: run.request.start_attempt_no,
      start_fence_generation: run.start_fence_generation,
      tool_invocation_id: audit.tool_invocation_id,
      tool_name: audit.tool_name,
      status,
      policy_snapshot_id: run.response.details.policy_snapshot_id,
      capability_token_id: audit.capability_token_id,
      input_ref: audit.input_ref,
      output_ref: outputRef,
      side_effect_status: result?.side_effect_status ?? "none",
      downstream_idempotency_key: audit.downstream_idempotency_key,
      external_response_ref:
        status === "completed"
          ? (result?.external_response_ref ?? outputRef)
          : null,
      external_error_ref: null,
      duplicate_replayed: false,
      error: null,
      duration_ms: null,
      reason_code: null,
      error_summary: null,
      artifact_ref: outputRef,
    },
  } as RuntimeDomainEventV1;
}

async function recordDirectRequestedTool(
  store: RuntimeExecutionStoreV1,
  runtimeRunId: string,
  leaseGeneration: number,
  permission: RuntimeRunRecordV1["permissions"][number],
  toolInvocationId: string,
): Promise<RuntimeToolAuditV1> {
  const run = await store.readRun(runtimeRunId);
  if (run === undefined) throw new Error("runtime run is missing");
  const audit: RuntimeToolAuditV1 = {
    tool_invocation_id: toolInvocationId,
    tool_name: "search",
    capability_token_id: permission.id,
    input_ref: `artifact:${toolInvocationId}:input`,
    lease_generation: leaseGeneration,
    request_hash: hash,
    normalized_args_hash: hash,
    actor_binding_hash: permission.actor_binding_hash,
    status: "requested",
    side_effect_status: "none",
    downstream_idempotency_key: `run-1:tool:${toolInvocationId}`,
  };
  await store.recordToolRequested({
    runtime_run_id: runtimeRunId,
    lease_generation: leaseGeneration,
    audit,
    event: directToolEvent(
      run,
      audit,
      "runtime.tool.requested",
      "requested",
    ),
  });
  return audit;
}

function canonicalContextSnapshot(): ContextSnapshotV1 {
  const partial = {
    schema_version: "context_snapshot.v1" as const,
    trigger_process_id: "process-1",
    context_version: 1,
    ...scope,
    pinned_facts: [],
    memory_context: [],
    skill_catalog: {
      catalog_version: "catalog-184",
      catalog_as_of: at,
      items: [
        {
          skill_key: "skill-a",
          name: "Skill A",
          description: "The exact approved skill for this run.",
          active_version: "1",
          package_digest: skillPackageDigest,
          manifest_digest: skillManifestDigest,
          runtime_target: "filesystem_bundle.v1",
        },
      ],
    },
    environment: {
      captured_at: at,
      channel: "chat",
      timezone: "Asia/Shanghai",
      capability_summary_ref: "capability-summary:1",
    },
    history: [],
    source_status: [
      { source: "knowthat" as const, status: "empty" as const, retrieved_at: at, source_as_of: at, source_version: "knowthat.v1", latency_ms: 1, result_count: 0, failure_reason: null },
      { source: "memory" as const, status: "empty" as const, retrieved_at: at, source_as_of: at, source_version: "memory.v1", latency_ms: 1, result_count: 0, failure_reason: null },
      { source: "skill" as const, status: "ok" as const, retrieved_at: at, source_as_of: at, source_version: "catalog-184", latency_ms: 1, result_count: 1, failure_reason: null },
      { source: "environment" as const, status: "ok" as const, retrieved_at: at, source_as_of: at, source_version: "environment.v1", latency_ms: 1, result_count: 1, failure_reason: null },
      { source: "history" as const, status: "empty" as const, retrieved_at: at, source_as_of: at, source_version: "history.v1", latency_ms: 1, result_count: 0, failure_reason: null },
    ],
    assembly_notes: [],
  };
  return {
    ...partial,
    snapshot_hash: canonicalPayloadHashV1(partial),
  };
}

const contextSnapshot = canonicalContextSnapshot();

function contextSnapshotWithCatalogVersion(
  catalogVersion: string,
): ContextSnapshotV1 {
  const { snapshot_hash: _snapshotHash, ...base } = contextSnapshot;
  const partial = {
    ...base,
    skill_catalog: {
      ...contextSnapshot.skill_catalog!,
      catalog_version: catalogVersion,
    },
    source_status: contextSnapshot.source_status.map((outcome) =>
      outcome.source === "skill"
        ? { ...outcome, source_version: catalogVersion }
        : outcome,
    ),
  };
  return {
    ...partial,
    snapshot_hash: canonicalPayloadHashV1(partial),
  };
}

function contextSnapshotRead(
  request: Readonly<{
    context_snapshot_ref: string;
    context_snapshot_version: number;
    context_snapshot_hash: string;
    trace_id: string;
  }>,
  snapshot: ContextSnapshotV1 = contextSnapshot,
) {
  const bytes = Buffer.from(canonicalJsonV1(snapshot), "utf8");
  return {
    schema_version: "context_snapshot_read.v1" as const,
    context_snapshot_ref: request.context_snapshot_ref,
    context_snapshot_version: request.context_snapshot_version,
    context_snapshot_hash: request.context_snapshot_hash as `sha256:${string}`,
    canonical_bytes_sha256: rawSha256(bytes),
    content_length_bytes: bytes.byteLength,
    delivery_mode: "inline" as const,
    context_snapshot: structuredClone(snapshot),
    chunks: null,
    retention_until: "2026-08-23T04:00:00.000Z",
    redaction_state: "complete" as const,
    resolved_at: at,
    trace_id: request.trace_id,
  };
}

function startRequest(runId = "run-1") {
  const structuredIntent = {
    goal: "perform an exact, bounded action",
    user_need: "a durable answer",
    response_style: "concise",
    action_plan: [
      {
        step: 1,
        action_type: "tool_use",
        action: "invoke the approved search tool",
        candidate_skill: "skill-a",
      },
    ],
    required_skills: ["skill-a"],
    memory_followups: [],
    safety_notes: [],
    requires_confirmation: false,
  };
  const snapshotWithoutHash = {
    schema_version: "intent_policy_input_snapshot.v1" as const,
    snapshot_ref: `intent-policy:${runId}:1`,
    ...scope,
    bot_policy_revision_id: "bot-policy-r1",
    personality_ref: "personality:1",
    personality_version: 1,
    personality_hash: hash,
    safety_boundaries_ref: "safety:1",
    safety_boundaries_version: 1,
    safety_boundaries_hash: hash,
    tool_permission_profile_ref: "tool-profile:1",
    tool_permission_profile_revision: 1,
    tool_permission_profile_hash: hash,
    tool_policy_epoch: 3,
    catalog_version: "catalog-184",
    catalog_as_of: at,
    security_revocation_epoch: 4,
    skill_permission_summary_ref: "skill-permissions:1",
    skill_permission_summary_hash: hash,
  };
  const snapshotHash = canonicalPayloadHashV1(snapshotWithoutHash);
  const policy = {
    schema_version: "runtime_policy_input.v1" as const,
    intent_policy_snapshot_ref: snapshotWithoutHash.snapshot_ref,
    intent_policy_snapshot_hash: snapshotHash,
    created_at: at,
    expires_at: "2026-07-24T04:00:00.000Z",
  };
  return {
    schema_version: "runtime_start.v1.2" as const,
    trigger_process_id: "process-1",
    runtime_run_id: runId,
    ...scope,
    start_attempt_no: 1,
    start_fence_token: "fence-1",
    intent_ref: "intent:process-1:1",
    intent_version: 1,
    structured_intent_hash: canonicalPayloadHashV1(structuredIntent),
    structured_intent: structuredIntent,
    context_snapshot_ref: "context:process-1:1",
    context_snapshot_version: 1,
    context_snapshot_hash: contextSnapshot.snapshot_hash,
    intent_policy_snapshot_ref: snapshotWithoutHash.snapshot_ref,
    intent_policy_snapshot_hash: snapshotHash,
    intent_policy_snapshot: {
      ...snapshotWithoutHash,
      snapshot_hash: snapshotHash,
    },
    expected_catalog_version: snapshotWithoutHash.catalog_version,
    catalog_as_of: snapshotWithoutHash.catalog_as_of,
    allowed_tools: ["search"],
    allowed_skills: ["skill-a"],
    planned_skills: ["skill-a"],
    policy_input_ref: `policy-input:${runId}:1`,
    policy_input_hash: canonicalPayloadHashV1(policy),
    policy,
    confirmation_ref: null,
    confirmation_hash: null,
    preempt_token: `preempt-${runId}`,
    idempotency_key: "process-1:start:1",
    trace_id: `trace-${runId}`,
  };
}

const principal: RuntimeStartPrincipalV1 = {
  sub: "trigger_processor",
  aud: "action_runtime",
  capability: ["runtime.start", "runtime.control"],
  delegated_principal: delegatedPrincipal,
  scope,
};
const reconciliationPrincipal = {
  sub: "action_runtime" as const,
  aud: "action_runtime" as const,
  capability: ["runtime.tool.reconcile"],
  scope,
};

function credential(): VerifiedWorkloadCredential {
  return {
    claims: {
      iss: "pai-workload",
      sub: "trigger_processor",
      aud: "action_runtime",
      jti: "credential-runtime-execution",
      iat: 100,
      nbf: 100,
      exp: 200,
      capability: ["runtime.control", "runtime.start"],
      delegated_principal: delegatedPrincipal,
      scope_kind: "bot",
      ...scope,
    },
    protectedHeader: { alg: "EdDSA", kid: "key-1", typ: "JWT" },
  };
}

function skillRegistryCredential(
  credentialScope = scope,
): VerifiedWorkloadCredential {
  return {
    claims: {
      iss: "pai-workload",
      sub: "skill_registry",
      aud: "action_runtime",
      jti: "credential-runtime-policy-read",
      iat: 100,
      nbf: 100,
      exp: 200,
      capability: ["runtime.policy_input.read"],
      scope_kind: "bot",
      ...credentialScope,
    },
    protectedHeader: { alg: "EdDSA", kid: "key-1", typ: "JWT" },
  };
}

function reconciliationCredential(): VerifiedWorkloadCredential {
  return {
    claims: {
      iss: "pai-workload",
      sub: "action_runtime",
      aud: "action_runtime",
      jti: "credential-runtime-reconciliation",
      iat: 100,
      nbf: 100,
      exp: 200,
      capability: ["runtime.tool.reconcile"],
      scope_kind: "bot",
      ...scope,
    },
    protectedHeader: { alg: "EdDSA", kid: "key-1", typ: "JWT" },
  };
}

function objectStore() {
  const stored = new Map<string, {
    object_ref: ObjectRefV1;
    version: string;
    sha256: string;
    size_bytes: number;
    media_type: string;
    retention_until: string;
  }>();
  return {
    putImmutable: vi.fn(async (request) => {
      const existing = stored.get(request.idempotency_key);
      if (existing !== undefined) {
        return { ...existing, replayed: true };
      }
      const created = {
        object_ref:
          `object:${request.idempotency_key}` as ObjectRefV1,
        version: "1",
        sha256: request.expected_sha256,
        size_bytes: request.size_bytes,
        media_type: request.media_type,
        retention_until: request.retention_until,
      };
      stored.set(request.idempotency_key, created);
      return { ...created, replayed: false };
    }),
    head: vi.fn(),
    getStream: vi.fn(),
    issueReadGrant: vi.fn(),
    deleteIfEligible: vi.fn(),
  } satisfies ObjectStorePortV1;
}

function harness(
  turns: RuntimeAdapterTurnV1[] = [
    { kind: "complete", terminal_artifact_ref: null },
  ],
  toolResult: RuntimeToolResultV1 = {
    outcome: "completed",
    retryable: false,
    side_effect_status: "produced",
    output: { ok: true },
  },
  hooks: Readonly<{
    afterMarkToolRunning?: () => void | Promise<void>;
    heartbeat_interval_ms?: number;
  }> = {},
) {
  let clockMs = now.getTime();
  const clock = () => new Date(clockMs);
  let currentSecurityRevocationEpoch = 4;
  let skillResolutionValidUntil = "2026-07-24T04:00:00.000Z";
  const stages: string[] = [];
  const queue = [...turns];
  const baseStore = createInMemoryRuntimeExecutionStoreV1({
    now: clock,
  });
  const store = {
    ...baseStore,
    finalizeAlreadyTerminalControl: vi.fn(
      (
        request: Parameters<typeof baseStore.finalizeAlreadyTerminalControl>[0],
      ) => baseStore.finalizeAlreadyTerminalControl(request),
    ),
    heartbeat: vi.fn(
      (request: Parameters<typeof baseStore.heartbeat>[0]) =>
        baseStore.heartbeat(request),
    ),
    markToolRunning: async (
      request: Parameters<typeof baseStore.markToolRunning>[0],
    ) => {
      await baseStore.markToolRunning(request);
      await hooks.afterMarkToolRunning?.();
    },
  } satisfies RuntimeExecutionDependenciesV1["store"];
  const dependencies = {
    store,
    reservation: {
      validate: vi.fn(async (_principal, _path, request) => {
        stages.push(request.validation_stage);
        return {
          schema_version:
            "runtime_start_reservation_validate_response.v1" as const,
          validation_result: "valid" as const,
          reservation_status: "dispatching" as const,
          validated_fence_generation: 7,
          validation_stage: request.validation_stage,
          duplicate_replayed: false,
          trace_id: request.trace_id,
        };
      }),
    },
    control_tokens: {
      verify: vi.fn(async (token, expected) => {
        if (token !== `preempt-${expected.runtime_run_id}`) {
          throw new Error("invalid control token");
        }
        return {
          runtime_run_id: expected.runtime_run_id,
          trigger_process_id: expected.trigger_process_id,
          start_attempt_no: expected.start_attempt_no,
          start_fence_generation: 7,
          ...expected.scope,
          control_valid_until: "2026-07-24T04:15:00.000Z",
        };
      }),
    },
    context_snapshots: {
      resolve: vi.fn(async (request) => contextSnapshotRead(request)),
    },
    policy_checkpoints: {
      check: vi.fn(async (request) => {
        const status =
          currentSecurityRevocationEpoch >
          request.expected_security_revocation_epoch
            ? ("security_revocation_epoch_advanced" as const)
            : Date.parse(request.policy_expires_at) <=
                Date.parse(request.checked_at)
              ? ("runtime_policy_expired" as const)
              : ("valid" as const);
        return {
          schema_version:
            "runtime_policy_checkpoint_result.v1" as const,
          checkpoint: request.checkpoint,
          runtime_run_id: request.runtime_run_id,
          policy_snapshot_id: request.policy_snapshot_id,
          status,
          expected_security_revocation_epoch:
            request.expected_security_revocation_epoch,
          current_security_revocation_epoch:
            currentSecurityRevocationEpoch,
          checked_at: request.checked_at,
        };
      }),
    },
    profiles: {
      resolveExact: vi.fn(async () => ({
        profile_ref: "tool-profile:1",
        revision: 1,
        profile_hash: hash,
        policy_epoch: 3,
        allowed_tools: ["search"],
        tool_arg_constraints: {},
        validateArguments: () => true,
      })),
    },
    adapter: {
      adapter_id: "ClaudeAgentSdkRuntimeAdapter" as const,
      sdk_package: "@anthropic-ai/claude-agent-sdk" as const,
      sdk_version: "0.3.212" as const,
      model: "claude-sonnet-pinned",
      start: vi.fn(async () => ({ session_id: "session-1" })),
      next: vi.fn(async () => {
        const turn = queue.shift();
        if (turn === undefined) {
          return { kind: "complete", terminal_artifact_ref: null } as const;
        }
        return turn;
      }),
      cancel: vi.fn(async () => undefined),
    },
    tools: {
      capabilityFor: vi.fn((toolName: string) => {
        if (toolName === "search") return "search.read";
        if (toolName === "memory.deepRecall") return "memory.deep_recall";
        throw new Error(`No trusted capability mapping for ${toolName}`);
      }),
      invoke: vi.fn(async () => toolResult),
    },
    skills: {
      resolve: vi.fn(async (request) => ({
        code: "skill_resolution_succeeded" as const,
        message: "skills resolved",
        retryable: false as const,
        trace_id: request.trace_id,
        details: {
          schema_version: "skill_resolution_response.v1" as const,
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
          valid_until: skillResolutionValidUntil,
          resolved_skills: request.skills.map((item) => ({
            resolution_id: `resolution:${item.name}:1`,
            skill_id: `skill:${item.name}`,
            skill_key: item.name,
            version_id: `version:${item.name}:1`,
            version: "1",
            package_digest: skillPackageDigest,
            manifest_digest: skillManifestDigest,
            runtime_target: "filesystem_bundle.v1" as const,
            granted_capability_refs: ["search.read"],
            required: item.required,
            valid_until: skillResolutionValidUntil,
          })),
          degradation_notes: [],
          duplicate_replayed: false,
        },
      })),
      load: vi.fn(async () => ({
        bytes: skillPackageBytes,
        manifest_bytes: skillManifestBytes,
        media_type: "application/gzip",
        package_digest: skillPackageDigest,
        manifest_digest: skillManifestDigest,
        runtime_target: "filesystem_bundle.v1" as const,
        source: "skill_registry" as const,
        entry_paths: ["SKILL.md"],
        entries: [
          {
            path: "SKILL.md",
            mode: "0600",
            bytes: skillPackageBytes,
            sha256: skillPackageDigest,
          },
        ],
      })),
    },
    object_store: objectStore(),
    callback: {
      worker_id: "runtime-callback-worker-1",
      lease_seconds: 30,
      transport_epoch: "runtime-callback.v1",
      transport_generation: 1,
      deliver: vi.fn(async (_event, claim) => ({
        transport_ref: `callback:${claim.outbox_id}:${claim.attempt_count}`,
      })),
    },
  } satisfies RuntimeExecutionDependenciesV1;
  return {
    store,
    stages,
    dependencies,
    app: createRuntimeExecutionApplicationV1(dependencies, {
      now: clock,
      max_adapter_turns: 20,
      max_retry_attempts: 2,
      ...(hooks.heartbeat_interval_ms === undefined
        ? {}
        : { heartbeat_interval_ms: hooks.heartbeat_interval_ms }),
    }),
    now: clock,
    advance(milliseconds: number) {
      clockMs += milliseconds;
    },
    setSecurityRevocationEpoch(epoch: number) {
      currentSecurityRevocationEpoch = epoch;
    },
    setSkillResolutionValidUntil(value: string) {
      skillResolutionValidUntil = value;
    },
  };
}

async function beforeRunningValidationFact(
  store: RuntimeExecutionStoreV1,
  runtimeRunId: string,
): Promise<RuntimeStartValidationFactInputV1> {
  const [attempt, run] = await Promise.all([
    store.readStartAttempt(runtimeRunId),
    store.readRun(runtimeRunId),
  ]);
  if (attempt === undefined || run === undefined) {
    throw new Error("accepted Runtime Start fact is unavailable");
  }
  const response = {
    schema_version:
      "runtime_start_reservation_validate_response.v1" as const,
    validation_result: "valid" as const,
    reservation_status: "dispatching" as const,
    validated_fence_generation: run.start_fence_generation,
    validation_stage: "before_running" as const,
    duplicate_replayed: false,
    trace_id: run.request.trace_id,
  };
  const ownerRequest = {
    schema_version:
      "runtime_start_reservation_validate_request.v1" as const,
    runtime_run_id: run.request.runtime_run_id,
    start_fence_token_hash:
      attempt.start_fence_token_hash as `sha256:${string}`,
    request_hash: attempt.request_hash as `sha256:${string}`,
    validation_stage: "before_running" as const,
    trace_id: run.request.trace_id,
  };
  const call = {
    validation_call_id: `test-before-running:${canonicalPayloadHashV1({
      runtime_run_id: runtimeRunId,
      call_no: attempt.validation_calls.length + 1,
    }).slice("sha256:".length)}`,
    validation_stage: "before_running" as const,
    request_hash: canonicalPayloadHashV1(ownerRequest),
    trace_id: ownerRequest.trace_id,
    requested_at: at,
  };
  await store.beginStartValidationCall({
    runtime_run_id: runtimeRunId,
    request_hash: attempt.request_hash,
    start_fence_token_hash: attempt.start_fence_token_hash,
    actor_binding_hash: attempt.actor_binding_hash,
    call,
  });
  return {
    validation_call_id: call.validation_call_id,
    validation_stage: "before_running",
    validation_result: "valid",
    response_source: "trigger_processor",
    response_schema_version:
      "runtime_start_reservation_validate_response.v1",
    request_hash: call.request_hash,
    start_fence_token_hash: attempt.start_fence_token_hash,
    response_hash: canonicalPayloadHashV1(response),
    response,
    validated_at: at,
  };
}

async function startAndExecute(
  testHarness: ReturnType<typeof harness>,
  request = startRequest(),
) {
  const response = await testHarness.app.start(principal, request);
  const run = await testHarness.app.executeQueued({
    runtime_run_id: request.runtime_run_id,
    worker_id: "worker-1",
    expected_start_fence_generation:
      response.details.start_fence_generation,
    lease_seconds: 600,
    deadline_at: deadline,
  });
  return { response, run };
}

function cancelRequest(
  request = startRequest(),
  signalId = "signal-1",
  requestedAt = at,
) {
  return {
    schema_version: "runtime_cancel.v1" as const,
    runtime_signal_id: signalId,
    runtime_run_id: request.runtime_run_id,
    trigger_process_id: request.trigger_process_id,
    start_attempt_no: request.start_attempt_no,
    preempt_token: request.preempt_token,
    reason_code: "user_cancelled",
    requested_at: requestedAt,
    idempotency_key: `${request.runtime_run_id}:control:${signalId}`,
    trace_id: request.trace_id,
  };
}

function storedStartRequest(
  request = startRequest(),
) {
  const { start_fence_token, preempt_token, ...stored } = request;
  return {
    ...stored,
    start_fence_token_hash: rawSha256(
      Buffer.from(start_fence_token, "utf8"),
    ),
    preempt_token_hash: rawSha256(
      Buffer.from(preempt_token, "utf8"),
    ),
  };
}

function storedCancelRequest(
  request = startRequest(),
  signalId = "signal-1",
) {
  const { preempt_token, ...stored } = cancelRequest(request, signalId);
  return {
    ...stored,
    preempt_token_hash: rawSha256(
      Buffer.from(preempt_token, "utf8"),
    ),
  };
}

function controlClaims(request = startRequest()) {
  return {
    runtime_run_id: request.runtime_run_id,
    trigger_process_id: request.trigger_process_id,
    start_attempt_no: request.start_attempt_no,
    start_fence_generation: 7,
    ...scope,
    control_valid_until: "2026-07-24T04:15:00.000Z",
  } as const;
}

describe("Day15 Action Runtime execution loop", () => {
  it("keeps a late terminal-control audit event readable through its control window", () => {
    expect(
      runtimeEventRetentionUntilV1(
        "2026-08-07T04:16:03.704Z",
        "2026-08-07T08:46:27.544Z",
      ),
    ).toBe("2026-08-07T09:01:27.544Z");
    expect(
      runtimeEventRetentionUntilV1(
        "2026-08-07T08:46:27.545123Z",
        "2026-08-07T08:46:27.544Z",
      ),
    ).toBe("2026-08-07T08:46:27.545123Z");
  });

  it("rejects any adapter identity outside the pinned Claude Agent SDK contract", () => {
    const testHarness = harness();
    expect(() =>
      createRuntimeExecutionApplicationV1({
        ...testHarness.dependencies,
        adapter: {
          ...testHarness.dependencies.adapter,
          sdk_version: "0.3.211",
        } as unknown as RuntimeExecutionDependenciesV1["adapter"],
      }),
    ).toThrow(/0\.3\.212/u);
  });

  it("canonical-preflights accessor, Proxy, and over-depth Runtime requests before schema or dependency traversal", async () => {
    const testHarness = harness();
    let accessorReads = 0;
    const accessorRequest = startRequest("run-accessor");
    Object.defineProperty(accessorRequest, "runtime_run_id", {
      configurable: true,
      enumerable: true,
      get() {
        accessorReads += 1;
        return "run-accessor";
      },
    });
    await expect(
      testHarness.app.start(principal, accessorRequest),
    ).rejects.toMatchObject({ code: "schema_validation_failed" });
    expect(accessorReads).toBe(0);

    let proxyReads = 0;
    const proxyRequest = new Proxy(startRequest("run-proxy"), {
      get() {
        proxyReads += 1;
        throw new Error("Proxy property traversal is forbidden");
      },
    });
    await expect(
      testHarness.app.start(principal, proxyRequest),
    ).rejects.toMatchObject({ code: "schema_validation_failed" });
    expect(proxyReads).toBe(0);

    let deep: Record<string, unknown> = { leaf: true };
    for (let depth = 0; depth < 130; depth += 1) {
      deep = { nested: deep };
    }
    await expect(
      testHarness.app.start(principal, {
        ...startRequest("run-over-depth"),
        unexpected_deep_value: deep,
      }),
    ).rejects.toMatchObject({ code: "schema_validation_failed" });
    expect(
      testHarness.dependencies.reservation.validate,
    ).not.toHaveBeenCalled();
  });

  it("accepts a system actor without delegation while rejecting scope drift and body injection", async () => {
    const missingHarness = harness();
    const {
      delegated_principal: _delegatedPrincipal,
      ...systemPrincipal
    } = principal;
    const systemRequest = startRequest("run-system-principal");
    await expect(
      missingHarness.app.start(systemPrincipal, systemRequest),
    ).resolves.toMatchObject({
      code: "runtime_queued",
    });
    expect(
      missingHarness.dependencies.reservation.validate,
    ).toHaveBeenCalledTimes(2);
    expect(
      missingHarness.dependencies.context_snapshots.resolve,
    ).toHaveBeenCalledTimes(1);
    expect(missingHarness.dependencies.skills.resolve).toHaveBeenCalledTimes(1);
    expect(missingHarness.dependencies.adapter.start).not.toHaveBeenCalled();
    const systemRun = await missingHarness.store.readRun(
      systemRequest.runtime_run_id,
    );
    expect(systemRun?.actor_binding).toMatchObject({
      workload_service: "trigger_processor",
      scope,
      delegated_principal: null,
      delegated_principal_hash: null,
    });
    const missingControlRequest = startRequest(
      "run-missing-control-principal",
    );
    await expect(
      missingHarness.app.receiveControl(
        systemPrincipal,
        cancelRequest(missingControlRequest),
      ),
    ).resolves.toEqual({
      accepted: true,
      replayed: false,
    });
    expect(
      missingHarness.dependencies.control_tokens.verify,
    ).toHaveBeenCalledTimes(1);
    expect(
      await missingHarness.store.findControlTombstone(
        storedStartRequest(missingControlRequest),
      ),
    ).toBeDefined();

    const driftHarness = harness();
    await expect(
      driftHarness.app.start(
        {
          ...principal,
          delegated_principal: {
            ...delegatedPrincipal,
            bot_id: "different-bot",
          },
        },
        startRequest("run-principal-scope-drift"),
      ),
    ).rejects.toMatchObject({
      code: "authorization_scope_mismatch",
    });
    expect(
      driftHarness.dependencies.reservation.validate,
    ).not.toHaveBeenCalled();
    expect(driftHarness.dependencies.adapter.start).not.toHaveBeenCalled();

    const routeHarness = harness();
    const unsignedCredential = credential();
    const {
      delegated_principal: _routeDelegatedPrincipal,
      ...claimsWithoutDelegation
    } = unsignedCredential.claims;
    let suppliedCredential: VerifiedWorkloadCredential = {
      ...unsignedCredential,
      claims: claimsWithoutDelegation,
    };
    const server = buildActionRuntimeApp(
      {
        logger: false,
        auth: {
          verifier: {
            async verify() {
              return suppliedCredential;
            },
          },
        },
      },
      { runtime_execution: routeHarness.app },
    );
    const missing = await server.inject({
      method: "POST",
      url: "/internal/runtime/runs",
      headers: { authorization: "Bearer aaa.bbb.ccc" },
      payload: startRequest("run-http-missing-principal"),
    });
    expect(missing.statusCode, missing.body).toBe(200);
    expect(routeHarness.dependencies.reservation.validate).toHaveBeenCalledTimes(
      2,
    );

    suppliedCredential = credential();
    const injected = await server.inject({
      method: "POST",
      url: "/internal/runtime/runs",
      headers: { authorization: "Bearer aaa.bbb.ccc" },
      payload: {
        ...startRequest("run-body-injected-principal"),
        delegated_principal: delegatedPrincipal,
      },
    });
    expect(injected.statusCode, injected.body).toBe(400);
    expect(routeHarness.dependencies.reservation.validate).toHaveBeenCalledTimes(
      2,
    );
    expect(routeHarness.dependencies.adapter.start).not.toHaveBeenCalled();
    await server.close();
  });

  it("executes non-user-authority tools for a system actor without delegation", async () => {
    const call = {
      tool_call_id: "tool-call-system-search",
      tool_name: "search",
      capability: "search.read",
      arguments: { query: "system-owned lookup" },
    } as const;
    const testHarness = harness([
      { kind: "tool_call", call },
      { kind: "complete", terminal_artifact_ref: null },
    ]);
    const {
      delegated_principal: _delegatedPrincipal,
      ...systemPrincipal
    } = principal;
    const request = startRequest("run-system-search");
    const response = await testHarness.app.start(
      systemPrincipal,
      request,
    );

    await expect(
      testHarness.app.executeQueued({
        runtime_run_id: request.runtime_run_id,
        worker_id: "worker-1",
        expected_start_fence_generation:
          response.details.start_fence_generation,
        lease_seconds: 600,
        deadline_at: deadline,
      }),
    ).resolves.toMatchObject({ status: "completed" });

    expect(testHarness.dependencies.tools.invoke).toHaveBeenCalledTimes(1);
    expect(
      testHarness.dependencies.tools.invoke.mock.calls[0]?.[1],
    ).toMatchObject({
      actor_binding: {
        delegated_principal: null,
        delegated_principal_hash: null,
      },
    });
  });

  it("exposes the authenticated Runtime Start route with fail-closed scope", async () => {
    const testHarness = harness();
    const requirements: unknown[] = [];
    const server = buildActionRuntimeApp(
      {
        logger: false,
        auth: {
          verifier: {
            async verify(_token, expected) {
              requirements.push(expected);
              return credential();
            },
          },
        },
      },
      { runtime_execution: testHarness.app },
    );

    const response = await server.inject({
      method: "POST",
      url: "/internal/runtime/runs",
      headers: { authorization: "Bearer aaa.bbb.ccc" },
      payload: startRequest(),
    });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toMatchObject({
      code: "runtime_queued",
      details: { start_fence_generation: 7 },
    });
    expect(requirements).toEqual([
      {
        audience: "action_runtime",
        allowedCallers: ["trigger_processor"],
        requiredCapabilities: ["runtime.start"],
      },
    ]);
    const unrelated = await server.inject({
      method: "POST",
      url: "/internal/runtime:start",
      headers: { authorization: "Bearer aaa.bbb.ccc" },
      payload: startRequest("run-unexpected"),
    });
    expect(unrelated.statusCode).not.toBe(200);
    expect(
      testHarness.dependencies.reservation.validate,
    ).toHaveBeenCalledTimes(2);
    await server.close();
  });

  it("maps malformed canonical Runtime Start bodies to the published 400 error without effects", async () => {
    const testHarness = harness();
    const server = buildActionRuntimeApp(
      {
        logger: false,
        auth: {
          verifier: {
            async verify() {
              return credential();
            },
          },
        },
      },
      { runtime_execution: testHarness.app },
    );
    let deep: Record<string, unknown> = { leaf: true };
    for (let depth = 0; depth < 130; depth += 1) {
      deep = { nested: deep };
    }
    for (const payload of [
      {
        ...startRequest("run-malformed-surrogate"),
        trace_id: "\ud800",
      },
      {
        ...startRequest("run-over-depth-http"),
        unexpected_deep_value: deep,
      },
      {
        ...startRequest("run-additional-property"),
        unexpected_value: true,
      },
      {
        ...startRequest("run-string-integer"),
        start_attempt_no: "1",
      },
    ]) {
      const response = await server.inject({
        method: "POST",
        url: "/internal/runtime/runs",
        headers: { authorization: "Bearer aaa.bbb.ccc" },
        payload,
      });
      expect(response.statusCode, response.body).toBe(400);
      expect(response.json()).toMatchObject({
        code: "schema_validation_failed",
        retryable: false,
      });
    }
    expect(
      testHarness.dependencies.reservation.validate,
    ).not.toHaveBeenCalled();
    await server.close();
  });

  it("keeps complete-pipeline readiness closed until execution dependencies expose a live probe", async () => {
    const testHarness = harness();
    const readyQuery = {
      async checkReadiness() {},
    };
    const readyTokenStream = {
      async checkReadiness() {},
    };
    const applications = {
      tool_permission_profile_current_read: {} as never,
      runtime_event_read: {} as never,
      runtime_final_result_read: {} as never,
      runtime_execution: testHarness.app,
      runtime_query: readyQuery as never,
      runtime_token_stream: readyTokenStream as never,
    };
    const missingProbe = buildActionRuntimeApp(
      { logger: false },
      applications,
      { require_complete_pipeline: true },
    );
    const missingProbeResponse = await missingProbe.inject({
      method: "GET",
      url: "/ready",
    });
    expect(missingProbeResponse.statusCode).toBe(503);
    expect(
      missingProbeResponse
        .json()
        .checks.find(
          (check: Readonly<{ name: string }>) =>
            check.name === "runtime_execution",
        ),
    ).toMatchObject({
      name: "runtime_execution",
      status: "down",
    });
    await missingProbe.close();

    const checkReadiness = vi.fn(async (_signal: AbortSignal) => undefined);
    const complete = buildActionRuntimeApp(
      { logger: false },
      {
        ...applications,
        runtime_execution_readiness: { checkReadiness },
      },
      { require_complete_pipeline: true },
    );
    const completeResponse = await complete.inject({
      method: "GET",
      url: "/ready",
    });
    expect(completeResponse.statusCode).toBe(200);
    expect(checkReadiness).toHaveBeenCalledWith(expect.any(AbortSignal));
    await complete.close();
  });

  it("exposes canonical run-scoped control routes and rejects path/body drift", async () => {
    const testHarness = harness();
    const server = buildActionRuntimeApp(
      {
        logger: false,
        auth: {
          verifier: {
            async verify() {
              return credential();
            },
          },
        },
      },
      { runtime_execution: testHarness.app },
    );
    const request = startRequest();
    const control = {
      schema_version: "runtime_cancel.v1",
      runtime_signal_id: "signal-before-start",
      runtime_run_id: request.runtime_run_id,
      trigger_process_id: request.trigger_process_id,
      start_attempt_no: request.start_attempt_no,
      preempt_token: request.preempt_token,
      reason_code: "cancel_before_start",
      requested_at: at,
      idempotency_key: "run-1:control:before-start",
      trace_id: request.trace_id,
    } as const;
    const transportTraceId = "a".repeat(32);

    const mismatch = await server.inject({
      method: "POST",
      url: "/internal/runtime/runs/a-different-run/cancel",
      headers: {
        authorization: "Bearer aaa.bbb.ccc",
        "x-trace-id": transportTraceId,
      },
      payload: control,
    });
    expect(mismatch.statusCode).toBe(400);
    expect(mismatch.json()).toEqual({
      code: "schema_validation_failed",
      message: "runtime_run_id path parameter must match the control body",
      retryable: false,
      details: {},
      trace_id: transportTraceId,
    });
    expect(await testHarness.store.readRun(request.runtime_run_id)).toBeUndefined();

    const callerSelectedFence = await server.inject({
      method: "POST",
      url: `/internal/runtime/runs/${request.runtime_run_id}/cancel`,
      headers: { authorization: "Bearer aaa.bbb.ccc" },
      payload: { ...control, start_fence_generation: 7 },
    });
    expect(callerSelectedFence.statusCode).toBe(400);

    const accepted = await server.inject({
      method: "POST",
      url: `/internal/runtime/runs/${request.runtime_run_id}/cancel`,
      headers: { authorization: "Bearer aaa.bbb.ccc" },
      payload: control,
    });
    expect(accepted.statusCode).toBe(202);
    expect(accepted.json()).toEqual({ accepted: true, replayed: false });

    const legacy = await server.inject({
      method: "POST",
      url: "/internal/runtime:cancel",
      headers: { authorization: "Bearer aaa.bbb.ccc" },
      payload: control,
    });
    expect(legacy.statusCode).not.toBe(202);
    await server.close();
  });

  it("serves the exact owner policy input only to the bound Skill Registry scope", async () => {
    const testHarness = harness();
    const request = startRequest();
    await testHarness.app.start(principal, request);
    let suppliedCredential = skillRegistryCredential();
    const server = buildActionRuntimeApp(
      {
        logger: false,
        auth: {
          verifier: {
            async verify() {
              return suppliedCredential;
            },
          },
        },
      },
      { runtime_execution: testHarness.app },
    );

    const response = await server.inject({
      method: "GET",
      url:
        `/internal/runtime/runs/${request.runtime_run_id}` +
        `/start-attempts/${request.start_attempt_no}/policy-input`,
      headers: { authorization: "Bearer aaa.bbb.ccc" },
    });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toMatchObject({
      schema_version: "runtime_policy_input_read_artifact.v1",
      policy_input_ref: request.policy_input_ref,
      policy_input_hash: request.policy_input_hash,
      runtime_run_id: request.runtime_run_id,
      start_attempt_no: request.start_attempt_no,
      intent_policy_snapshot_ref:
        request.intent_policy_snapshot_ref,
      skill_permission_summary_ref:
        request.intent_policy_snapshot.skill_permission_summary_ref,
      policy: request.policy,
    });

    const byReference = await server.inject({
      method: "GET",
      url: `/internal/runtime/policy-inputs/${encodeURIComponent(request.policy_input_ref)}`,
      headers: { authorization: "Bearer aaa.bbb.ccc" },
    });
    expect(byReference.statusCode, byReference.body).toBe(200);
    expect(byReference.json()).toMatchObject({
      policy_input_ref: request.policy_input_ref,
      runtime_run_id: request.runtime_run_id,
      start_attempt_no: request.start_attempt_no,
    });

    const wrongAttempt = await server.inject({
      method: "GET",
      url:
        `/internal/runtime/runs/${request.runtime_run_id}` +
        "/start-attempts/2/policy-input",
      headers: { authorization: "Bearer aaa.bbb.ccc" },
    });
    expect(wrongAttempt.statusCode).toBe(404);

    suppliedCredential = skillRegistryCredential({
      ...scope,
      owner_agent_id: "other-agent",
    });
    const crossScope = await server.inject({
      method: "GET",
      url:
        `/internal/runtime/runs/${request.runtime_run_id}` +
        `/start-attempts/${request.start_attempt_no}/policy-input`,
      headers: { authorization: "Bearer aaa.bbb.ccc" },
    });
    expect(crossScope.statusCode).toBe(404);
    const crossScopeByReference = await server.inject({
      method: "GET",
      url: `/internal/runtime/policy-inputs/${encodeURIComponent(request.policy_input_ref)}`,
      headers: { authorization: "Bearer aaa.bbb.ccc" },
    });
    expect(crossScopeByReference.statusCode).toBe(404);
    await server.close();
  });

  it("validates all three reservation stages and atomically emits callback outbox events", async () => {
    const testHarness = harness();
    const { run } = await startAndExecute(testHarness);

    expect(testHarness.stages).toEqual([
      "request_received",
      "preflight_completed",
      "before_running",
    ]);
    expect(run.status).toBe("completed");
    expect(run.terminal_reason).toBe("runtime_completed");
    expect(run.events.map(({ event_type }) => event_type)).toEqual([
      "runtime.run.started",
      "runtime.run.completed",
    ]);
    expect(run.outbox).toHaveLength(2);
    expect(run.outbox.every(({ status }) => status === "sent")).toBe(true);
    expect(testHarness.dependencies.adapter.start).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        context_snapshot: contextSnapshot,
      }),
    );
  });

  it("executes an accepted queued run after application restart without Start replay or plaintext fence memory", async () => {
    const testHarness = harness();
    const request = startRequest("run-restart");
    const beginStartAttempt = vi.fn(
      testHarness.store.beginStartAttempt,
    );
    const acceptStart = vi.fn(
      testHarness.store.acceptStart,
    );
    const findControlTombstone = vi.fn(
      testHarness.store.findControlTombstone,
    );
    const capturedStore = Object.freeze({
      ...testHarness.store,
      beginStartAttempt,
      acceptStart,
      findControlTombstone,
    });
    const initial = createRuntimeExecutionApplicationV1(
      {
        ...testHarness.dependencies,
        store: capturedStore,
      },
      {
        now: testHarness.now,
        max_adapter_turns: 20,
        max_retry_attempts: 2,
      },
    );
    const response = await initial.start(principal, request);
    const restarted = createRuntimeExecutionApplicationV1(
      {
        ...testHarness.dependencies,
        store: capturedStore,
      },
      {
        now: testHarness.now,
        max_adapter_turns: 20,
        max_retry_attempts: 2,
      },
    );

    const run = await restarted.executeQueued({
      runtime_run_id: request.runtime_run_id,
      worker_id: "worker-after-restart",
      expected_start_fence_generation:
        response.details.start_fence_generation,
      lease_seconds: 600,
      deadline_at: deadline,
    });

    expect(run.status).toBe("completed");
    expect(testHarness.stages).toEqual([
      "request_received",
      "preflight_completed",
      "before_running",
    ]);
    const beforeRunningRequest =
      testHarness.dependencies.reservation.validate.mock.calls[2]?.[2];
    expect(beforeRunningRequest).toMatchObject({
      validation_stage: "before_running",
      start_fence_token_hash: rawSha256(
        Buffer.from(request.start_fence_token, "utf8"),
      ),
    });
    expect(beforeRunningRequest).not.toHaveProperty(
      "start_fence_token",
    );
    const attempt =
      await testHarness.store.readStartAttempt(request.runtime_run_id);
    expect(attempt?.validation_facts.map(({ validation_stage }) =>
      validation_stage,
    )).toEqual([
      "request_received",
      "preflight_completed",
      "before_running",
    ]);
    expect(JSON.stringify(attempt)).not.toContain(
      request.start_fence_token,
    );
    for (const storeRequest of [
      beginStartAttempt.mock.calls[0]?.[0],
      acceptStart.mock.calls[0]?.[0],
      findControlTombstone.mock.calls[0]?.[0],
    ]) {
      expect(storeRequest).not.toHaveProperty("start_fence_token");
      expect(storeRequest).not.toHaveProperty("preempt_token");
      expect(storeRequest).toMatchObject({
        start_fence_token_hash: rawSha256(
          Buffer.from(request.start_fence_token, "utf8"),
        ),
        preempt_token_hash: rawSha256(
          Buffer.from(request.preempt_token, "utf8"),
        ),
      });
      expect(JSON.stringify(storeRequest)).not.toContain(
        request.start_fence_token,
      );
      expect(JSON.stringify(storeRequest)).not.toContain(
        request.preempt_token,
      );
    }
  });

  it("rejects durable start-fence hash drift atomically before lease or provider effects", async () => {
    const testHarness = harness();
    const request = startRequest("run-fence-hash-drift");
    const response = await testHarness.app.start(principal, request);
    const durableStore = testHarness.store;
    const driftStore: RuntimeExecutionStoreV1 = Object.freeze({
      ...durableStore,
      async readRun(runtimeRunId) {
        const run = await durableStore.readRun(runtimeRunId);
        return run === undefined
          ? undefined
          : {
              ...run,
              request: {
                ...run.request,
                start_fence_token_hash:
                  `sha256:${"f".repeat(64)}`,
              },
            };
      },
    });
    const restarted = createRuntimeExecutionApplicationV1(
      {
        ...testHarness.dependencies,
        store: driftStore,
      },
      {
        now: testHarness.now,
        max_adapter_turns: 20,
        max_retry_attempts: 2,
      },
    );

    await expect(
      restarted.executeQueued({
        runtime_run_id: request.runtime_run_id,
        worker_id: "worker-hash-drift",
        expected_start_fence_generation:
          response.details.start_fence_generation,
        lease_seconds: 600,
        deadline_at: deadline,
      }),
    ).rejects.toMatchObject({ code: "idempotency_conflict" });
    const durableRun = await durableStore.readRun(request.runtime_run_id);
    expect(durableRun).toMatchObject({ status: "queued" });
    expect(durableRun?.lease).toBeUndefined();
    expect(testHarness.dependencies.adapter.start).not.toHaveBeenCalled();
    expect(testHarness.dependencies.adapter.next).not.toHaveBeenCalled();
    expect(testHarness.dependencies.tools.invoke).not.toHaveBeenCalled();
  });

  it("terminalizes deterministic preflight failure without creating a run or provider/tool effects", async () => {
    const testHarness = harness();
    const driftSnapshot = contextSnapshotWithCatalogVersion("catalog-drift");
    const request = {
      ...startRequest("run-preflight-terminal"),
      context_snapshot_hash: driftSnapshot.snapshot_hash,
    };
    testHarness.dependencies.context_snapshots.resolve.mockImplementationOnce(
      async (ownerRequest) => contextSnapshotRead(ownerRequest, driftSnapshot),
    );

    await expect(
      testHarness.app.start(principal, request),
    ).rejects.toMatchObject({ code: "catalog_version_mismatch" });

    await expect(
      testHarness.store.readRun(request.runtime_run_id),
    ).resolves.toBeUndefined();
    await expect(
      testHarness.store.readStartAttempt(request.runtime_run_id),
    ).resolves.toMatchObject({
      status: "terminal",
      failure_code: "catalog_version_mismatch",
      validation_facts: [
        { validation_stage: "request_received" },
      ],
    });
    expect(testHarness.dependencies.adapter.start).not.toHaveBeenCalled();
    expect(testHarness.dependencies.adapter.next).not.toHaveBeenCalled();
    expect(testHarness.dependencies.tools.invoke).not.toHaveBeenCalled();
  });

  it("rejects canonical Context Snapshot drift before claiming a runtime lease", async () => {
    const testHarness = harness();
    const request = startRequest();
    await testHarness.app.start(principal, request);
    testHarness.dependencies.context_snapshots.resolve.mockResolvedValueOnce(
      contextSnapshotRead(request, {
        ...structuredClone(contextSnapshot),
        assembly_notes: ["tampered-after-hash"],
      }),
    );

    await expect(
      testHarness.app.executeQueued({
        runtime_run_id: request.runtime_run_id,
        worker_id: "worker-1",
        expected_start_fence_generation: 7,
        lease_seconds: 600,
        deadline_at: deadline,
      }),
    ).rejects.toMatchObject({ code: "context_snapshot_mismatch" });
    expect(
      (await testHarness.store.readRun(request.runtime_run_id))?.status,
    ).toBe("queued");
    expect(testHarness.dependencies.adapter.start).not.toHaveBeenCalled();
  });

  it("revalidates the Trigger owner fence after the canonical Context Snapshot read", async () => {
    const testHarness = harness();
    const request = startRequest();
    let contextReadCompleted = false;
    const ordinaryRead =
      testHarness.dependencies.context_snapshots.resolve.getMockImplementation()!;
    testHarness.dependencies.context_snapshots.resolve.mockImplementationOnce(
      async (readRequest) => {
        const result = await ordinaryRead(readRequest);
        contextReadCompleted = true;
        return result;
      },
    );
    const ordinaryValidation =
      testHarness.dependencies.reservation.validate.getMockImplementation()!;
    testHarness.dependencies.reservation.validate.mockImplementation(
      async (...args) => {
        const validationRequest = args[2];
        if (
          validationRequest.validation_stage === "before_running" &&
          contextReadCompleted
        ) {
          throw new Error("start_cancelled");
        }
        return ordinaryValidation(...args);
      },
    );

    await testHarness.app.start(principal, request);
    await expect(
      testHarness.app.executeQueued({
        runtime_run_id: request.runtime_run_id,
        worker_id: "worker-1",
        expected_start_fence_generation: 7,
        lease_seconds: 600,
        deadline_at: deadline,
      }),
    ).rejects.toMatchObject({ code: "reservation_unavailable" });
    expect(contextReadCompleted).toBe(true);
    expect(
      (await testHarness.store.readRun(request.runtime_run_id))?.status,
    ).toBe("queued");
    expect(testHarness.dependencies.adapter.start).not.toHaveBeenCalled();
  });

  it.each([
    "authorization_scope_mismatch",
    "stale_start_fence",
    "start_cancelled",
    "reservation_terminal",
    "idempotency_conflict",
    "schema_validation_failed",
  ] as const)(
    "preserves the closed owner reservation error code %s without leaking its message",
    async (code) => {
      const testHarness = harness();
      const request = startRequest(`run-owner-error-${code}`);
      testHarness.dependencies.reservation.validate.mockRejectedValueOnce({
        schema_version:
          "runtime_start_reservation_validate_error.v1",
        code,
        message: "owner-secret-diagnostic",
        retryable: false,
        trace_id: request.trace_id,
        details:
          code === "schema_validation_failed"
            ? {
                trigger_process_id: request.trigger_process_id,
                start_attempt_no: request.start_attempt_no,
                validation_stage: "request_received" as const,
                field_path: "$.request_hash",
                reason: "malformed_request" as const,
              }
            : {
                trigger_process_id: request.trigger_process_id,
                start_attempt_no: request.start_attempt_no,
                validation_stage: "request_received" as const,
              },
      });

      const rejection = await testHarness.app
        .start(principal, request)
        .catch((error: unknown) => error);
      expect(rejection).toMatchObject({
        code,
        retryable: false,
      });
      expect(String((rejection as Error).message)).not.toContain(
        "owner-secret-diagnostic",
      );
      const durableAttempt =
        await testHarness.store.readStartAttempt(
          request.runtime_run_id,
        );
      expect(durableAttempt).toMatchObject({
        status: "terminal",
        failure_code: code,
      });
      expect(durableAttempt?.validation_facts).toHaveLength(1);
      expect(durableAttempt?.validation_facts[0]).toMatchObject({
        validation_sequence_no: 1,
        validation_stage: "request_received",
        validation_result: "error",
        response_source: "trigger_processor",
        response_schema_version:
          "runtime_start_reservation_validate_error.v1",
        request_hash: expect.stringMatching(/^sha256:/u),
        start_fence_token_hash:
          expect.stringMatching(/^sha256:/u),
        response_hash: expect.stringMatching(/^sha256:/u),
        response: {
          code,
          message: "owner-secret-diagnostic",
          trace_id: request.trace_id,
        },
      });
      await expect(
        testHarness.store.readRun(request.runtime_run_id),
      ).resolves.toBeUndefined();
    },
  );

  it("keeps a storage-unavailable owner validation retryable without terminalizing the Start attempt", async () => {
    const testHarness = harness();
    const request = startRequest(
      "run-owner-storage-unavailable",
    );
    testHarness.dependencies.reservation.validate.mockRejectedValueOnce({
      schema_version:
        "runtime_start_reservation_validate_error.v1",
      code: "storage_unavailable",
      message: "owner-secret-storage-diagnostic",
      retryable: true,
      trace_id: request.trace_id,
      details: {
        trigger_process_id: request.trigger_process_id,
        start_attempt_no: request.start_attempt_no,
        validation_stage: "request_received",
        diagnostic_ref:
          "runtime_start_reservation_validation:postgres",
      },
    });
    const appendStartValidation =
      testHarness.store.appendStartValidation.bind(
        testHarness.store,
      );
    let disconnectedAfterEvidenceCommit = false;
    const firstApplication =
      createRuntimeExecutionApplicationV1(
        {
          ...testHarness.dependencies,
          store: Object.freeze({
            ...testHarness.store,
            async appendStartValidation(evidenceRequest) {
              const committed =
                await appendStartValidation(evidenceRequest);
              if (
                evidenceRequest.fact.validation_result ===
                  "error" &&
                !disconnectedAfterEvidenceCommit
              ) {
                disconnectedAfterEvidenceCommit = true;
                throw new Error(
                  "connection closed after validation evidence commit",
                );
              }
              return committed;
            },
          }),
        },
        {
          now: testHarness.now,
          max_adapter_turns: 20,
          max_retry_attempts: 2,
        },
      );

    const rejection = await firstApplication
      .start(principal, request)
      .catch((error: unknown) => error);
    expect(rejection).toMatchObject({
      code: "reservation_unavailable",
      retryable: true,
    });
    expect(String((rejection as Error).message)).not.toContain(
      "owner-secret-storage-diagnostic",
    );
    const durableAttempt =
      await testHarness.store.readStartAttempt(
        request.runtime_run_id,
      );
    expect(durableAttempt).toMatchObject({
      status: "validating",
      validation_calls: [
        {
          validation_stage: "request_received",
          request_hash: expect.stringMatching(/^sha256:/u),
        },
      ],
      validation_facts: [
        {
          validation_sequence_no: 1,
          validation_stage: "request_received",
          validation_result: "error",
          response_source: "trigger_processor",
          response: {
            code: "storage_unavailable",
            details: {
              diagnostic_ref:
                "runtime_start_reservation_validation:postgres",
            },
          },
        },
      ],
    });
    expect(
      durableAttempt?.validation_facts[0]
        ?.validation_call_id,
    ).toBe(
      durableAttempt?.validation_calls[0]
        ?.validation_call_id,
    );
    expect(durableAttempt).not.toHaveProperty("failure_code");

    const restartedApplication =
      createRuntimeExecutionApplicationV1(
        testHarness.dependencies,
        {
          now: testHarness.now,
          max_adapter_turns: 20,
          max_retry_attempts: 2,
        },
      );
    await expect(
      restartedApplication.start(principal, request),
    ).resolves.toMatchObject({
      code: "runtime_queued",
      details: {
        runtime_run_id: request.runtime_run_id,
        status: "queued",
      },
    });
    const recoveredAttempt =
      await testHarness.store.readStartAttempt(
        request.runtime_run_id,
      );
    expect(
      recoveredAttempt?.validation_facts.map((fact) => ({
        call_id: fact.validation_call_id,
        sequence: fact.validation_sequence_no,
        stage: fact.validation_stage,
        result: fact.validation_result,
      })),
    ).toEqual([
      {
        call_id:
          recoveredAttempt?.validation_calls[0]
            ?.validation_call_id,
        sequence: 1,
        stage: "request_received",
        result: "error",
      },
      {
        call_id:
          recoveredAttempt?.validation_calls[1]
            ?.validation_call_id,
        sequence: 2,
        stage: "request_received",
        result: "valid",
      },
      {
        call_id:
          recoveredAttempt?.validation_calls[2]
            ?.validation_call_id,
        sequence: 3,
        stage: "preflight_completed",
        result: "valid",
      },
    ]);
  });

  it("appends two evidence rows when independent owner calls return the same exact envelope", async () => {
    const testHarness = harness();
    const request = startRequest(
      "run-owner-identical-storage-responses",
    );
    const ownerError = {
      schema_version:
        "runtime_start_reservation_validate_error.v1" as const,
      code: "storage_unavailable" as const,
      message: "same owner storage envelope",
      retryable: true as const,
      trace_id: request.trace_id,
      details: {
        trigger_process_id: request.trigger_process_id,
        start_attempt_no: request.start_attempt_no,
        validation_stage: "request_received" as const,
        diagnostic_ref:
          "runtime_start_reservation_validation:postgres",
      },
    };
    const preparedCallIds: string[] = [];
    testHarness.dependencies.reservation.validate.mockImplementation(
      async (_principal, _path, ownerRequest) => {
        const attempt =
          await testHarness.store.readStartAttempt(
            request.runtime_run_id,
          );
        const requestHash =
          canonicalPayloadHashV1(ownerRequest);
        const preparedCall = attempt?.validation_calls
          .filter(
            (call) =>
              call.validation_stage ===
                "request_received" &&
              call.request_hash === requestHash,
          )
          .at(-1);
        expect(preparedCall).toBeDefined();
        expect(
          attempt?.validation_facts.some(
            (fact) =>
              fact.validation_call_id ===
              preparedCall?.validation_call_id,
          ),
        ).toBe(false);
        preparedCallIds.push(
          preparedCall?.validation_call_id ?? "",
        );
        throw ownerError;
      },
    );

    await expect(
      testHarness.app.start(principal, request),
    ).rejects.toMatchObject({
      code: "reservation_unavailable",
      retryable: true,
    });
    await expect(
      testHarness.app.start(principal, request),
    ).rejects.toMatchObject({
      code: "reservation_unavailable",
      retryable: true,
    });

    const attempt =
      await testHarness.store.readStartAttempt(
        request.runtime_run_id,
      );
    expect(preparedCallIds).toHaveLength(2);
    expect(new Set(preparedCallIds).size).toBe(2);
    expect(attempt?.validation_calls).toHaveLength(2);
    expect(attempt?.validation_facts).toHaveLength(2);
    expect(
      attempt?.validation_facts.map((fact) => ({
        call_id: fact.validation_call_id,
        sequence: fact.validation_sequence_no,
        stage: fact.validation_stage,
        response_hash: fact.response_hash,
      })),
    ).toEqual([
      {
        call_id: preparedCallIds[0],
        sequence: 1,
        stage: "request_received",
        response_hash:
          canonicalPayloadHashV1(ownerError),
      },
      {
        call_id: preparedCallIds[1],
        sequence: 2,
        stage: "request_received",
        response_hash:
          canonicalPayloadHashV1(ownerError),
      },
    ]);
  });

  it("restarts from a durable non-retryable owner error without issuing another TP call", async () => {
    const testHarness = harness();
    const request = startRequest(
      "run-owner-terminal-ledger-restart",
    );
    testHarness.dependencies.reservation.validate.mockRejectedValueOnce({
      schema_version:
        "runtime_start_reservation_validate_error.v1",
      code: "start_cancelled",
      message: "owner cancellation persisted before crash",
      retryable: false,
      trace_id: request.trace_id,
      details: {
        trigger_process_id: request.trigger_process_id,
        start_attempt_no: request.start_attempt_no,
        validation_stage: "request_received",
      },
    });
    const firstApplication =
      createRuntimeExecutionApplicationV1(
        {
          ...testHarness.dependencies,
          store: Object.freeze({
            ...testHarness.store,
            async terminalizeStartAttempt() {
              throw new Error(
                "connection closed before terminal transition",
              );
            },
          }),
        },
        {
          now: testHarness.now,
          max_adapter_turns: 20,
          max_retry_attempts: 2,
        },
      );

    await expect(
      firstApplication.start(principal, request),
    ).rejects.toThrow(
      "connection closed before terminal transition",
    );
    await expect(
      testHarness.store.readStartAttempt(
        request.runtime_run_id,
      ),
    ).resolves.toMatchObject({
      status: "validating",
      validation_facts: [
        {
          validation_sequence_no: 1,
          validation_result: "error",
          response: {
            code: "start_cancelled",
          },
        },
      ],
    });

    const restartedApplication =
      createRuntimeExecutionApplicationV1(
        testHarness.dependencies,
        {
          now: testHarness.now,
          max_adapter_turns: 20,
          max_retry_attempts: 2,
        },
      );
    await expect(
      restartedApplication.start(principal, request),
    ).rejects.toMatchObject({
      code: "start_cancelled",
      retryable: false,
    });
    expect(
      testHarness.dependencies.reservation.validate,
    ).toHaveBeenCalledTimes(1);
    await expect(
      testHarness.store.readStartAttempt(
        request.runtime_run_id,
      ),
    ).resolves.toMatchObject({
      status: "terminal",
      failure_code: "start_cancelled",
      validation_facts: [
        {
          validation_sequence_no: 1,
          validation_result: "error",
        },
      ],
    });
  });

  it("maps a bound owner internal error to a non-retryable sanitized terminal failure", async () => {
    const testHarness = harness();
    const request = startRequest("run-owner-internal-error");
    testHarness.dependencies.reservation.validate.mockRejectedValueOnce({
      schema_version:
        "runtime_start_reservation_validate_error.v1",
      code: "internal_error",
      message: "owner-secret-internal-diagnostic",
      retryable: false,
      trace_id: request.trace_id,
      details: {
        trigger_process_id: request.trigger_process_id,
        start_attempt_no: request.start_attempt_no,
        validation_stage: "request_received",
        diagnostic_ref:
          "runtime_start_reservation_validation:internal",
      },
    });

    const rejection = await testHarness.app
      .start(principal, request)
      .catch((error: unknown) => error);
    expect(rejection).toMatchObject({
      code: "reservation_unavailable",
      retryable: false,
    });
    expect(String((rejection as Error).message)).not.toContain(
      "owner-secret-internal-diagnostic",
    );
    const durableAttempt =
      await testHarness.store.readStartAttempt(
        request.runtime_run_id,
      );
    expect(durableAttempt).toMatchObject({
      status: "terminal",
      failure_code: "reservation_unavailable",
      validation_facts: [
        {
          validation_sequence_no: 1,
          validation_result: "error",
          response_source: "trigger_processor",
          response: {
            code: "internal_error",
            message: "owner-secret-internal-diagnostic",
          },
        },
      ],
    });
    await expect(
      testHarness.store.readRun(request.runtime_run_id),
    ).resolves.toBeUndefined();
  });

  it("records exact invalid or nullable-bound owner errors and rejects impossible stage status without owner detail leakage", async () => {
    const identityHarness = harness();
    const identityRequest = startRequest(
      "run-owner-error-binding-drift",
    );
    identityHarness.dependencies.reservation.validate.mockRejectedValueOnce({
      schema_version:
        "runtime_start_reservation_validate_error.v1",
      code: "start_cancelled",
      message: "owner-binding-secret",
      retryable: false,
      trace_id: identityRequest.trace_id,
      details: {
        trigger_process_id: "process-other",
        start_attempt_no: identityRequest.start_attempt_no,
        validation_stage: "request_received",
      },
    });
    const identityError = await identityHarness.app
      .start(principal, identityRequest)
      .catch((error: unknown) => error);
    expect(identityError).toMatchObject({
      code: "reservation_invalid",
      retryable: false,
    });
    expect(String((identityError as Error).message)).not.toContain(
      "owner-binding-secret",
    );
    await expect(
      identityHarness.store.readStartAttempt(
        identityRequest.runtime_run_id,
      ),
    ).resolves.toMatchObject({
      status: "terminal",
      failure_code: "reservation_invalid",
      validation_facts: [
        {
          validation_sequence_no: 1,
          validation_result: "error",
          response: {
            code: "start_cancelled",
            message: "owner-binding-secret",
            details: {
              trigger_process_id: "process-other",
            },
          },
        },
      ],
    });

    const nullableSchemaHarness = harness();
    const nullableSchemaRequest = startRequest(
      "run-owner-schema-null-binding",
    );
    nullableSchemaHarness.dependencies.reservation.validate.mockRejectedValueOnce({
      schema_version:
        "runtime_start_reservation_validate_error.v1",
      code: "schema_validation_failed",
      message: "owner-null-binding-secret",
      retryable: false,
      trace_id: nullableSchemaRequest.trace_id,
      details: {
        trigger_process_id: null,
        start_attempt_no: null,
        validation_stage: null,
        field_path: "/path",
        reason: "malformed_path",
      },
    });
    const nullableSchemaError = await nullableSchemaHarness.app
      .start(principal, nullableSchemaRequest)
      .catch((error: unknown) => error);
    expect(nullableSchemaError).toMatchObject({
      code: "schema_validation_failed",
      retryable: false,
    });
    expect(String((nullableSchemaError as Error).message)).not.toContain(
      "owner-null-binding-secret",
    );
    await expect(
      nullableSchemaHarness.store.readStartAttempt(
        nullableSchemaRequest.runtime_run_id,
      ),
    ).resolves.toMatchObject({
      status: "terminal",
      failure_code: "schema_validation_failed",
      validation_facts: [
        {
          validation_sequence_no: 1,
          validation_result: "error",
          response: {
            code: "schema_validation_failed",
            message: "owner-null-binding-secret",
            details: {
              trigger_process_id: null,
              start_attempt_no: null,
              validation_stage: null,
            },
          },
        },
      ],
    });

    const statusHarness = harness();
    const statusRequest = startRequest("run-owner-status-regression");
    const ordinaryValidation =
      statusHarness.dependencies.reservation.validate.getMockImplementation()!;
    statusHarness.dependencies.reservation.validate.mockImplementation(
      async (...args) => {
        const response = await ordinaryValidation(...args);
        return args[2].validation_stage === "request_received"
          ? { ...response, reservation_status: "dispatching" as const }
          : { ...response, reservation_status: "reserved" as const };
      },
    );
    await expect(
      statusHarness.app.start(principal, statusRequest),
    ).rejects.toMatchObject({
      code: "reservation_invalid",
      retryable: false,
    });
    await expect(
      statusHarness.store.readRun(statusRequest.runtime_run_id),
    ).resolves.toBeUndefined();
    expect(statusHarness.dependencies.adapter.start).not.toHaveBeenCalled();
  });

  it("replays Runtime Start across trace changes and rejects business request drift", async () => {
    const testHarness = harness();
    const request = startRequest();
    const first = await testHarness.app.start(principal, request);
    const replay = await testHarness.app.start(
      principal,
      {
        ...structuredClone(request),
        trace_id: "trace-retry",
      },
    );

    expect(replay).toEqual(first);
    expect(testHarness.dependencies.reservation.validate).toHaveBeenCalledTimes(
      2,
    );
    const durableAttempt =
      await testHarness.store.readStartAttempt(request.runtime_run_id);
    expect(durableAttempt).toMatchObject({
      status: "accepted",
      validation_facts: [
        { validation_stage: "request_received" },
        { validation_stage: "preflight_completed" },
      ],
    });
    expect(JSON.stringify(durableAttempt)).not.toContain(
      request.start_fence_token,
    );

    await expect(
      testHarness.app.start(
        {
          ...principal,
          delegated_principal: {
            ...delegatedPrincipal,
            principal_id: "different-signed-user",
            source_subject: "auth-different-user",
          },
        },
        request,
      ),
    ).rejects.toMatchObject({ code: "idempotency_conflict" });
    expect(testHarness.dependencies.reservation.validate).toHaveBeenCalledTimes(
      2,
    );

    await expect(
      testHarness.app.start(principal, {
        ...request,
        context_snapshot_hash: `sha256:${"b".repeat(64)}`,
      }),
    ).rejects.toMatchObject({ code: "idempotency_conflict" });
  });

  it("converges concurrent same-identity Start validations whose only response drift is trace_id", async () => {
    const testHarness = harness();
    const request = startRequest("run-concurrent-trace");
    const ordinaryValidation =
      testHarness.dependencies.reservation.validate.getMockImplementation()!;
    let arrived = 0;
    let release!: () => void;
    const bothArrived = new Promise<void>((resolve) => {
      release = resolve;
    });
    testHarness.dependencies.reservation.validate.mockImplementation(
      async (...args) => {
        if (args[2].validation_stage === "request_received") {
          arrived += 1;
          if (arrived === 2) release();
          await bothArrived;
        }
        return ordinaryValidation(...args);
      },
    );

    const [first, second] = await Promise.all([
      testHarness.app.start(principal, request),
      testHarness.app.start(principal, {
        ...structuredClone(request),
        trace_id: "trace-concurrent-retry",
      }),
    ]);

    expect(second).toEqual(first);
    const durableAttempt =
      await testHarness.store.readStartAttempt(
        request.runtime_run_id,
      );
    expect(durableAttempt?.status).toBe("accepted");
    expect(
      durableAttempt?.validation_facts.map((fact) => ({
        sequence: fact.validation_sequence_no,
        stage: fact.validation_stage,
        result: fact.validation_result,
        source: fact.response_source,
        trace_id: fact.response.trace_id,
      })),
    ).toEqual([
      {
        sequence: 1,
        stage: "request_received",
        result: "valid",
        source: "trigger_processor",
        trace_id: request.trace_id,
      },
      {
        sequence: 2,
        stage: "request_received",
        result: "valid",
        source: "trigger_processor",
        trace_id: "trace-concurrent-retry",
      },
      {
        sequence: 3,
        stage: "preflight_completed",
        result: "valid",
        source: "trigger_processor",
        trace_id: request.trace_id,
      },
      {
        sequence: 4,
        stage: "preflight_completed",
        result: "valid",
        source: "trigger_processor",
        trace_id: "trace-concurrent-retry",
      },
    ]);
    expect(testHarness.dependencies.adapter.start).not.toHaveBeenCalled();
    expect(testHarness.dependencies.tools.invoke).not.toHaveBeenCalled();
  });

  it("enforces one durable owner for the process start idempotency key", async () => {
    const testHarness = harness();
    await testHarness.app.start(principal, startRequest("run-1"));

    await expect(
      testHarness.app.start(principal, startRequest("run-2")),
    ).rejects.toMatchObject({ code: "idempotency_conflict" });
    expect(await testHarness.store.readRun("run-2")).toBeUndefined();
  });

  it("fails closed on hash drift, catalog drift, and expired policy before durable admission", async () => {
    const policyHarness = harness();
    const request = startRequest();
    await expect(
      policyHarness.app.start(principal, {
        ...request,
        policy_input_hash: hash,
      }),
    ).rejects.toMatchObject({ code: "policy_hash_mismatch" });
    expect(await policyHarness.store.readRun(request.runtime_run_id)).toBeUndefined();
    expect(policyHarness.dependencies.adapter.start).not.toHaveBeenCalled();

    const catalogHarness = harness();
    const driftSnapshot = contextSnapshotWithCatalogVersion("catalog-drift");
    const catalogRequest = {
      ...request,
      context_snapshot_hash: driftSnapshot.snapshot_hash,
    };
    catalogHarness.dependencies.context_snapshots.resolve.mockImplementation(
      async (ownerRequest) => contextSnapshotRead(ownerRequest, driftSnapshot),
    );
    await expect(
      catalogHarness.app.start(principal, catalogRequest),
    ).rejects.toMatchObject({ code: "catalog_version_mismatch" });
    expect(
      await catalogHarness.store.readRun(catalogRequest.runtime_run_id),
    ).toBeUndefined();

    const revokedHarness = harness();
    const defaultResolve =
      revokedHarness.dependencies.skills.resolve.getMockImplementation()!;
    revokedHarness.dependencies.skills.resolve.mockImplementationOnce(
      async (resolveRequest, signal) => {
        const response = await defaultResolve(resolveRequest, signal);
        return {
          ...response,
          details: {
            ...response.details,
            security_revocation_epoch: 5,
          },
        };
      },
    );
    await expect(
      revokedHarness.app.start(principal, request),
    ).rejects.toMatchObject({ code: "catalog_version_mismatch" });
    expect(await revokedHarness.store.readRun(request.runtime_run_id)).toBeUndefined();

    const expiredHarness = harness();
    const expired = startRequest("run-expired");
    expired.policy = {
      ...expired.policy,
      expires_at: "2026-07-23T03:59:59.999Z",
    };
    expired.policy_input_hash = canonicalPayloadHashV1(expired.policy);
    await expect(
      expiredHarness.app.start(principal, expired),
    ).rejects.toMatchObject({ code: "policy_expired" });
    expect(await expiredHarness.store.readRun(expired.runtime_run_id)).toBeUndefined();
  });

  it("snapshots resolver facts without invoking getters or hostile Proxy traps", async () => {
    const contextHarness = harness();
    let contextGetterReads = 0;
    contextHarness.dependencies.context_snapshots.resolve.mockImplementationOnce(
      async (ownerRequest) => {
        const read = contextSnapshotRead(ownerRequest);
        const { context_snapshot: _snapshot, ...withoutSnapshot } = read;
        const readWithGetter = { ...withoutSnapshot };
        Object.defineProperty(readWithGetter, "context_snapshot", {
          enumerable: true,
          get() {
            contextGetterReads += 1;
            return contextSnapshot;
          },
        });
        return readWithGetter as never;
      },
    );
    await expect(
      contextHarness.app.start(principal, startRequest("run-context-getter")),
    ).rejects.toMatchObject({ code: "context_snapshot_mismatch" });
    expect(contextGetterReads).toBe(0);
    expect(
      await contextHarness.store.readRun("run-context-getter"),
    ).toBeUndefined();
    expect(contextHarness.dependencies.adapter.start).not.toHaveBeenCalled();

    const profileHarness = harness();
    let validatorGetterReads = 0;
    const profileWithGetter = {
      profile_ref: "tool-profile:1",
      revision: 1,
      profile_hash: hash,
      policy_epoch: 3,
      allowed_tools: ["search"],
      tool_arg_constraints: {},
    };
    Object.defineProperty(profileWithGetter, "validateArguments", {
      enumerable: true,
      get() {
        validatorGetterReads += 1;
        return () => true;
      },
    });
    profileHarness.dependencies.profiles.resolveExact.mockResolvedValueOnce(
      profileWithGetter as never,
    );
    await expect(
      profileHarness.app.start(principal, startRequest("run-profile-getter")),
    ).rejects.toMatchObject({ code: "tool_policy_denied" });
    expect(validatorGetterReads).toBe(0);
    expect(
      await profileHarness.store.readRun("run-profile-getter"),
    ).toBeUndefined();

    const skillHarness = harness();
    skillHarness.dependencies.skills.resolve.mockResolvedValueOnce(
      new Proxy(
        {},
        {
          ownKeys() {
            throw new Error("hostile skill resolution proxy");
          },
        },
      ) as never,
    );
    await expect(
      skillHarness.app.start(principal, startRequest("run-skill-proxy")),
    ).rejects.toMatchObject({ code: "catalog_version_mismatch" });
    expect(
      await skillHarness.store.readRun("run-skill-proxy"),
    ).toBeUndefined();
  });

  it("captures resolver, adapter, tool, and owner-store methods at application composition", async () => {
    const testHarness = harness([
      {
        kind: "tool_call",
        call: {
          tool_call_id: "tool-call-captured-method",
          tool_name: "search",
          capability: "search.read",
          arguments: { query: "captured" },
        },
      },
    ]);
    const originalSkill = testHarness.dependencies.skills.resolve;
    const originalTool = testHarness.dependencies.tools.invoke;
    const originalAdapterStart = testHarness.dependencies.adapter.start;
    const originalAdapterNext = testHarness.dependencies.adapter.next;
    const originalStoreReadRun = testHarness.dependencies.store.readRun;
    const originalStoreAcceptStart =
      testHarness.dependencies.store.acceptStart;
    const originalReservation =
      testHarness.dependencies.reservation.validate;
    const originalContext =
      testHarness.dependencies.context_snapshots.resolve;
    const originalPolicy =
      testHarness.dependencies.policy_checkpoints.check;
    const originalObjectPut =
      testHarness.dependencies.object_store.putImmutable;
    const swappedSkill = vi.fn(async () => {
      throw new Error("swapped skill resolver");
    });
    const swappedTool = vi.fn(async () => {
      throw new Error("swapped tool method");
    });
    const swappedAdapterStart = vi.fn(async () => {
      throw new Error("swapped adapter start");
    });
    const swappedAdapterNext = vi.fn(async () => {
      throw new Error("swapped adapter next");
    });
    const swappedStoreReadRun = vi.fn(async () => {
      throw new Error("swapped store read");
    });
    const swappedStoreAcceptStart = vi.fn(async () => {
      throw new Error("swapped store writer");
    });
    const swappedReservation = vi.fn(async () => {
      throw new Error("swapped reservation verifier");
    });
    const swappedContext = vi.fn(async () => {
      throw new Error("swapped context resolver");
    });
    const swappedPolicy = vi.fn(async () => {
      throw new Error("swapped policy checkpoint");
    });
    const swappedObjectPut = vi.fn(async () => {
      throw new Error("swapped ObjectStore writer");
    });
    (
      testHarness.dependencies.skills as {
        resolve: typeof originalSkill;
      }
    ).resolve = swappedSkill as typeof originalSkill;
    (
      testHarness.dependencies.tools as {
        invoke: typeof originalTool;
      }
    ).invoke = swappedTool as typeof originalTool;
    (
      testHarness.dependencies.adapter as {
        start: typeof originalAdapterStart;
        next: typeof originalAdapterNext;
      }
    ).start = swappedAdapterStart as typeof originalAdapterStart;
    (
      testHarness.dependencies.adapter as {
        start: typeof originalAdapterStart;
        next: typeof originalAdapterNext;
      }
    ).next = swappedAdapterNext as typeof originalAdapterNext;
    (
      testHarness.dependencies.store as {
        readRun: typeof originalStoreReadRun;
        acceptStart: typeof originalStoreAcceptStart;
      }
    ).readRun = swappedStoreReadRun as typeof originalStoreReadRun;
    (
      testHarness.dependencies.store as {
        readRun: typeof originalStoreReadRun;
        acceptStart: typeof originalStoreAcceptStart;
      }
    ).acceptStart =
      swappedStoreAcceptStart as typeof originalStoreAcceptStart;
    (
      testHarness.dependencies.reservation as {
        validate: typeof originalReservation;
      }
    ).validate = swappedReservation as typeof originalReservation;
    (
      testHarness.dependencies.context_snapshots as {
        resolve: typeof originalContext;
      }
    ).resolve = swappedContext as typeof originalContext;
    (
      testHarness.dependencies.policy_checkpoints as {
        check: typeof originalPolicy;
      }
    ).check = swappedPolicy as typeof originalPolicy;
    (
      testHarness.dependencies.object_store as {
        putImmutable: typeof originalObjectPut;
      }
    ).putImmutable = swappedObjectPut as typeof originalObjectPut;

    await startAndExecute(testHarness);

    expect(originalSkill).toHaveBeenCalled();
    expect(originalAdapterStart).toHaveBeenCalled();
    expect(originalAdapterNext).toHaveBeenCalled();
    expect(originalTool).toHaveBeenCalled();
    expect(originalReservation).toHaveBeenCalled();
    expect(originalContext).toHaveBeenCalled();
    expect(originalPolicy).toHaveBeenCalled();
    expect(originalObjectPut).toHaveBeenCalled();
    expect(swappedSkill).not.toHaveBeenCalled();
    expect(swappedTool).not.toHaveBeenCalled();
    expect(swappedAdapterStart).not.toHaveBeenCalled();
    expect(swappedAdapterNext).not.toHaveBeenCalled();
    expect(swappedStoreReadRun).not.toHaveBeenCalled();
    expect(swappedStoreAcceptStart).not.toHaveBeenCalled();
    expect(swappedReservation).not.toHaveBeenCalled();
    expect(swappedContext).not.toHaveBeenCalled();
    expect(swappedPolicy).not.toHaveBeenCalled();
    expect(swappedObjectPut).not.toHaveBeenCalled();
    await expect(originalStoreReadRun("run-1")).resolves.toMatchObject({
      status: "completed",
    });
  });

  it("rejects dependency accessors and Proxies at composition without invoking traps", () => {
    const testHarness = harness();

    let rootGetterCalls = 0;
    const rootAccessor = { ...testHarness.dependencies };
    Object.defineProperty(rootAccessor, "store", {
      enumerable: true,
      get() {
        rootGetterCalls += 1;
        return testHarness.dependencies.store;
      },
    });
    expect(() =>
      createRuntimeExecutionApplicationV1(rootAccessor),
    ).toThrow(RuntimeExecutionErrorV1);
    expect(rootGetterCalls).toBe(0);

    let rootProxyTraps = 0;
    const rootProxy = new Proxy(testHarness.dependencies, {
      ownKeys() {
        rootProxyTraps += 1;
        return Reflect.ownKeys(testHarness.dependencies);
      },
    });
    expect(() =>
      createRuntimeExecutionApplicationV1(rootProxy),
    ).toThrow(RuntimeExecutionErrorV1);
    expect(rootProxyTraps).toBe(0);

    let portProxyTraps = 0;
    const storeProxy = new Proxy(testHarness.dependencies.store, {
      getOwnPropertyDescriptor(target, property) {
        portProxyTraps += 1;
        return Reflect.getOwnPropertyDescriptor(target, property);
      },
    });
    expect(() =>
      createRuntimeExecutionApplicationV1({
        ...testHarness.dependencies,
        store: storeProxy,
      }),
    ).toThrow(RuntimeExecutionErrorV1);
    expect(portProxyTraps).toBe(0);

    let methodGetterCalls = 0;
    const storeAccessor = { ...testHarness.dependencies.store };
    Object.defineProperty(storeAccessor, "claimQueuedRun", {
      enumerable: true,
      get() {
        methodGetterCalls += 1;
        return testHarness.dependencies.store.claimQueuedRun;
      },
    });
    expect(() =>
      createRuntimeExecutionApplicationV1({
        ...testHarness.dependencies,
        store: storeAccessor,
      }),
    ).toThrow(RuntimeExecutionErrorV1);
    expect(methodGetterCalls).toBe(0);

    let modelGetterCalls = 0;
    const adapterAccessor = { ...testHarness.dependencies.adapter };
    Object.defineProperty(adapterAccessor, "model", {
      enumerable: true,
      get() {
        modelGetterCalls += 1;
        return "claude-sonnet-pinned";
      },
    });
    expect(() =>
      createRuntimeExecutionApplicationV1({
        ...testHarness.dependencies,
        adapter: adapterAccessor,
      }),
    ).toThrow(RuntimeExecutionErrorV1);
    expect(modelGetterCalls).toBe(0);
  });

  it("binds captured prototype data-methods to their original private-state receiver", async () => {
    class PrototypeCallback {
      #delivered = 0;
      public readonly worker_id = "runtime-prototype-worker";
      public readonly lease_seconds = 30;
      public readonly transport_epoch = "runtime-callback.v1";
      public readonly transport_generation = 1;

      public async deliver(): Promise<Readonly<{
        transport_ref: string;
      }>> {
        this.#delivered += 1;
        return { transport_ref: `prototype:${this.#delivered}` };
      }

      public delivered(): number {
        return this.#delivered;
      }
    }

    const testHarness = harness();
    const callback = new PrototypeCallback();
    const application = createRuntimeExecutionApplicationV1(
      {
        ...testHarness.dependencies,
        callback,
      },
      {
        now: testHarness.now,
        max_adapter_turns: 20,
        max_retry_attempts: 2,
      },
    );
    const swappedPrototypeDeliver = vi.fn(async () => ({
      transport_ref: "prototype:swapped",
    }));
    PrototypeCallback.prototype.deliver = swappedPrototypeDeliver;
    const request = startRequest("run-prototype-callback");
    const response = await application.start(principal, request);
    await application.executeQueued({
      runtime_run_id: request.runtime_run_id,
      worker_id: "worker-prototype-callback",
      expected_start_fence_generation:
        response.details.start_fence_generation,
      lease_seconds: 600,
      deadline_at: deadline,
    });

    expect(callback.delivered()).toBeGreaterThan(0);
    expect(swappedPrototypeDeliver).not.toHaveBeenCalled();
  });

  it("does not claim or start the provider when before-running reservation validation fails", async () => {
    const testHarness = harness();
    testHarness.dependencies.reservation.validate.mockImplementation(
      async (_principal, _path, request) => {
        testHarness.stages.push(request.validation_stage);
        if (request.validation_stage === "before_running") {
          throw {
            schema_version:
              "runtime_start_reservation_validate_error.v1",
            code: "start_cancelled",
            message: "owner cancellation detail",
            retryable: false,
            trace_id: request.trace_id,
            details: {
              trigger_process_id: "process-1",
              start_attempt_no: 1,
              validation_stage: "before_running",
            },
          };
        }
        return {
          schema_version:
            "runtime_start_reservation_validate_response.v1" as const,
          validation_result: "valid" as const,
          reservation_status: "dispatching" as const,
          validated_fence_generation: 7,
          validation_stage: request.validation_stage,
          duplicate_replayed: false,
          trace_id: request.trace_id,
        };
      },
    );
    const request = startRequest();
    await testHarness.app.start(principal, request);

    await expect(
      testHarness.app.executeQueued({
        runtime_run_id: request.runtime_run_id,
        worker_id: "worker-1",
        expected_start_fence_generation: 7,
        lease_seconds: 600,
        deadline_at: deadline,
      }),
    ).rejects.toMatchObject({
      code: "start_cancelled",
      retryable: false,
    });
    expect((await testHarness.store.readRun(request.runtime_run_id))?.status).toBe(
      "queued",
    );
    await expect(
      testHarness.store.readStartAttempt(request.runtime_run_id),
    ).resolves.toMatchObject({
      status: "accepted",
      validation_facts: [
        {
          validation_sequence_no: 1,
          validation_stage: "request_received",
          validation_result: "valid",
        },
        {
          validation_sequence_no: 2,
          validation_stage: "preflight_completed",
          validation_result: "valid",
        },
        {
          validation_sequence_no: 3,
          validation_stage: "before_running",
          validation_result: "error",
          response: {
            code: "start_cancelled",
            message: "owner cancellation detail",
          },
        },
      ],
    });
    const validationCallsAfterFailure =
      testHarness.dependencies.reservation.validate.mock.calls.length;
    await expect(
      testHarness.app.executeQueued({
        runtime_run_id: request.runtime_run_id,
        worker_id: "worker-2",
        expected_start_fence_generation: 7,
        lease_seconds: 600,
        deadline_at: deadline,
      }),
    ).rejects.toMatchObject({
      code: "start_cancelled",
      retryable: false,
    });
    expect(
      testHarness.dependencies.reservation.validate,
    ).toHaveBeenCalledTimes(validationCallsAfterFailure);
    expect(testHarness.dependencies.adapter.start).not.toHaveBeenCalled();
  });

  it("enforces capability and argument policy before invoking a tool", async () => {
    const testHarness = harness([
      {
        kind: "tool_call",
        call: {
          tool_call_id: "tool-call-1",
          tool_name: "search",
          capability: "search.write",
          arguments: { query: "bounded" },
        },
      },
    ]);

    await expect(startAndExecute(testHarness)).rejects.toMatchObject({
      code: "tool_policy_denied",
    });
    expect(testHarness.dependencies.tools.invoke).not.toHaveBeenCalled();
    expect((await testHarness.store.readRun("run-1"))?.status).toBe("failed");
  });

  it("rejects accessor and hostile Proxy adapter turns before any tool effect", async () => {
    for (const maliciousTurn of [
      Object.defineProperty({}, "kind", {
        enumerable: true,
        get() {
          throw new Error("adapter getter must never execute");
        },
      }),
      new Proxy(
        {
          kind: "tool_call",
          call: {
            tool_call_id: "tool-call-proxy",
            tool_name: "search",
            capability: "search.read",
            arguments: { query: "proxy" },
          },
        },
        {
          ownKeys() {
            throw new Error("hostile adapter proxy");
          },
        },
      ),
    ]) {
      const testHarness = harness();
      testHarness.dependencies.adapter.next.mockResolvedValueOnce(
        maliciousTurn as RuntimeAdapterTurnV1,
      );

      await expect(startAndExecute(testHarness)).rejects.toMatchObject({
        code: "runtime_adapter_failed",
      });
      expect(testHarness.dependencies.tools.invoke).not.toHaveBeenCalled();
    }
  });

  it("rejects a malformed nested tool-call union before policy validation or effects", async () => {
    const malformedTurn = {
      kind: "tool_call",
      call: {
        tool_call_id: "tool-call-shape-confusion",
        tool_name: "search",
        capability: "search.read",
        unexpected: { query: "must not substitute arguments" },
      },
    } as unknown as RuntimeAdapterTurnV1;
    const testHarness = harness([malformedTurn]);
    const validateArguments = vi.fn(() => true);
    testHarness.dependencies.profiles.resolveExact.mockResolvedValue({
      profile_ref: "tool-profile:1",
      revision: 1,
      profile_hash: hash,
      policy_epoch: 3,
      allowed_tools: ["search"],
      tool_arg_constraints: {},
      validateArguments,
    });

    await expect(startAndExecute(testHarness)).rejects.toMatchObject({
      code: "runtime_adapter_failed",
    });
    expect(validateArguments).not.toHaveBeenCalled();
    expect(testHarness.dependencies.tools.invoke).not.toHaveBeenCalled();
    expect(
      testHarness.dependencies.object_store.putImmutable,
    ).not.toHaveBeenCalled();
  });

  it("dispatches only the frozen adapter-call snapshot after validation mutates the source turn", async () => {
    const mutableTurn = {
      kind: "tool_call" as const,
      call: {
        tool_call_id: "tool-call-snapshot",
        tool_name: "search",
        capability: "search.read",
        arguments: { query: "safe" },
      },
    };
    const testHarness = harness([mutableTurn]);
    testHarness.dependencies.profiles.resolveExact.mockImplementation(
      async () => ({
        profile_ref: "tool-profile:1",
        revision: 1,
        profile_hash: hash,
        policy_epoch: 3,
        allowed_tools: ["search"],
        tool_arg_constraints: {},
        validateArguments() {
          mutableTurn.call.tool_name = "unapproved-tool";
          mutableTurn.call.capability = "admin.write";
          mutableTurn.call.arguments.query = "mutated-after-validation";
          return true;
        },
      }),
    );

    await startAndExecute(testHarness);

    expect(testHarness.dependencies.tools.invoke).toHaveBeenCalledWith(
      {
        tool_call_id: "tool-call-snapshot",
        tool_name: "search",
        capability: "search.read",
        arguments: { query: "safe" },
      },
      expect.any(Object),
    );
  });

  it("keeps policy, artifact, audit, and dispatch on one argument snapshot across an upload await", async () => {
    const mutableTurn = {
      kind: "tool_call" as const,
      call: {
        tool_call_id: "tool-call-gated-snapshot",
        tool_name: "search",
        capability: "search.read",
        arguments: { query: "safe" },
      },
    };
    const testHarness = harness([
      mutableTurn,
      { kind: "complete", terminal_artifact_ref: null },
    ]);
    const originalPut =
      testHarness.dependencies.object_store.putImmutable.getMockImplementation();
    if (originalPut === undefined) throw new Error("ObjectStore mock missing");
    let enteredUpload!: () => void;
    const uploadEntered = new Promise<void>((resolve) => {
      enteredUpload = resolve;
    });
    let releaseUpload!: () => void;
    const uploadGate = new Promise<void>((resolve) => {
      releaseUpload = resolve;
    });
    testHarness.dependencies.object_store.putImmutable.mockImplementation(
      async (request) => {
        if (
          request.idempotency_key.includes(
            "tool_input:tool-call-gated-snapshot",
          )
        ) {
          enteredUpload();
          await uploadGate;
        }
        return originalPut(request);
      },
    );
    const response = await testHarness.app.start(
      principal,
      startRequest(),
    );
    const execution = testHarness.app.executeQueued({
      runtime_run_id: "run-1",
      worker_id: "worker-1",
      expected_start_fence_generation:
        response.details.start_fence_generation,
      lease_seconds: 600,
      deadline_at: deadline,
    });
    await uploadEntered;
    mutableTurn.call.tool_name = "admin";
    mutableTurn.call.capability = "admin.write";
    mutableTurn.call.arguments.query = "admin";
    releaseUpload();
    await execution;

    expect(testHarness.dependencies.tools.invoke).toHaveBeenCalledWith(
      {
        tool_call_id: "tool-call-gated-snapshot",
        tool_name: "search",
        capability: "search.read",
        arguments: { query: "safe" },
      },
      expect.any(Object),
    );
    const audit = (await testHarness.store.readRun("run-1"))?.tools[0];
    expect(audit?.normalized_args_hash).toBe(
      canonicalPayloadHashV1({ query: "safe" }),
    );
  });

  it("binds tool audit hashes to the documented typed request and normalized arguments", async () => {
    const call = {
      tool_call_id: "tool-call-hash",
      tool_name: "search",
      capability: "search.read",
      arguments: { limit: 3, query: "bounded" },
    } as const;
    const testHarness = harness([
      { kind: "tool_call", call },
      { kind: "complete", terminal_artifact_ref: null },
    ]);

    await startAndExecute(testHarness);

    const audit = (await testHarness.store.readRun("run-1"))?.tools[0];
    const actorBindingHash =
      (await testHarness.store.readRun("run-1"))!.actor_binding_hash;
    expect(audit).toMatchObject({
      tool_invocation_id: call.tool_call_id,
      tool_name: call.tool_name,
      normalized_args_hash: canonicalPayloadHashV1(call.arguments),
      actor_binding_hash: actorBindingHash,
      request_hash: canonicalPayloadHashV1({
        invocation: {
          schema_version: "runtime_tool_invocation_request.v1",
          runtime_run_id: "run-1",
          adapter_tool_call_id: call.tool_call_id,
          tool_name: call.tool_name,
          normalized_args: call.arguments,
        },
        runtime_actor_binding_hash: actorBindingHash,
      }),
      downstream_idempotency_key: "run-1:tool:tool-call-hash",
    });
  });

  it("freezes the signed principal into run policy and permissions and supplies it to deepRecall dispatch only", async () => {
    const call = {
      tool_call_id: "tool-call-deep-recall",
      tool_name: "memory.deepRecall",
      capability: "memory.deep_recall",
      arguments: { query: "signed identity context" },
    } as const;
    const testHarness = harness([
      { kind: "tool_call", call },
      { kind: "complete", terminal_artifact_ref: null },
    ]);
    testHarness.dependencies.profiles.resolveExact.mockResolvedValue({
      profile_ref: "tool-profile:1",
      revision: 1,
      profile_hash: hash,
      policy_epoch: 3,
      allowed_tools: ["memory.deepRecall"],
      tool_arg_constraints: {},
      validateArguments: () => true,
    });
    const request = {
      ...startRequest("run-deep-recall"),
      allowed_tools: ["memory.deepRecall"],
    };
    const callerOwnedDelegation = {
      ...delegatedPrincipal,
      roles: [...delegatedPrincipal.roles],
    };
    const callerPrincipal: RuntimeStartPrincipalV1 = {
      ...principal,
      delegated_principal: callerOwnedDelegation,
    };
    const response = await testHarness.app.start(
      callerPrincipal,
      request,
    );
    callerOwnedDelegation.principal_id = "caller-mutated-after-start";

    const queued = await testHarness.store.readRun(
      request.runtime_run_id,
    );
    const expectedPrincipalHash =
      canonicalPayloadHashV1(delegatedPrincipal);
    expect(queued).toMatchObject({
      actor_binding: {
        workload_service: "trigger_processor",
        scope,
        delegated_principal: delegatedPrincipal,
        delegated_principal_hash: expectedPrincipalHash,
      },
      policy_snapshot_hash:
        response.details.policy_snapshot_hash,
    });
    expect(
      queued?.permissions.every(
        (permission) =>
          permission.actor_binding_hash ===
          queued.actor_binding_hash,
      ),
    ).toBe(true);

    await testHarness.app.executeQueued({
      runtime_run_id: request.runtime_run_id,
      worker_id: "worker-1",
      expected_start_fence_generation:
        response.details.start_fence_generation,
      lease_seconds: 600,
      deadline_at: deadline,
    });

    const [dispatchedCall, dispatchedContext] =
      testHarness.dependencies.tools.invoke.mock.calls[0]!;
    expect(dispatchedCall).toEqual(call);
    expect(dispatchedContext).toMatchObject({
      runtime_run_id: request.runtime_run_id,
      actor_binding: {
        delegated_principal: delegatedPrincipal,
        delegated_principal_hash: expectedPrincipalHash,
      },
      actor_binding_hash: queued?.actor_binding_hash,
    });
    expect(Object.isFrozen(dispatchedContext)).toBe(true);
    expect(Object.isFrozen(dispatchedContext.actor_binding)).toBe(
      true,
    );
    expect(
      Object.isFrozen(
        dispatchedContext.actor_binding.delegated_principal?.roles,
      ),
    ).toBe(true);
    expect(
      testHarness.dependencies.adapter.start.mock.calls[0]?.[0],
    ).not.toHaveProperty("delegated_principal");
  });

  it("accepts a system Runtime but denies deepRecall before artifact or external tool effects", async () => {
    const call = {
      tool_call_id: "tool-call-system-deep-recall",
      tool_name: "memory.deepRecall",
      capability: "memory.deep_recall",
      arguments: { query: "must require user authority" },
    } as const;
    const testHarness = harness([{ kind: "tool_call", call }]);
    testHarness.dependencies.profiles.resolveExact.mockResolvedValue({
      profile_ref: "tool-profile:1",
      revision: 1,
      profile_hash: hash,
      policy_epoch: 3,
      allowed_tools: ["memory.deepRecall"],
      tool_arg_constraints: {},
      validateArguments: () => true,
    });
    const request = {
      ...startRequest("run-system-deep-recall"),
      allowed_tools: ["memory.deepRecall"],
    };
    const {
      delegated_principal: _delegatedPrincipal,
      ...systemPrincipal
    } = principal;
    const response = await testHarness.app.start(
      systemPrincipal,
      request,
    );
    const queued = await testHarness.store.readRun(
      request.runtime_run_id,
    );
    expect(queued?.actor_binding.delegated_principal).toBeNull();
    expect(queued?.permissions).toEqual([]);

    await expect(
      testHarness.app.executeQueued({
        runtime_run_id: request.runtime_run_id,
        worker_id: "worker-1",
        expected_start_fence_generation:
          response.details.start_fence_generation,
        lease_seconds: 600,
        deadline_at: deadline,
      }),
    ).rejects.toMatchObject({ code: "tool_policy_denied" });
    expect(testHarness.dependencies.tools.invoke).not.toHaveBeenCalled();
    expect(
      testHarness.dependencies.object_store.putImmutable,
    ).not.toHaveBeenCalled();
    expect(
      (await testHarness.store.readRun(request.runtime_run_id))?.tools,
    ).toEqual([]);
    expect(
      testHarness.dependencies.adapter.start.mock.calls[0]?.[0],
    ).toMatchObject({ allowed_tools: [] });
  });

  it("rejects non-object tool arguments before hashing or dispatch", async () => {
    const testHarness = harness([
      {
        kind: "tool_call",
        call: {
          tool_call_id: "tool-call-invalid-json-shape",
          tool_name: "search",
          capability: "search.read",
          arguments: ["query", "must", "be", "an", "object"],
        },
      },
    ]);

    await expect(startAndExecute(testHarness)).rejects.toMatchObject({
      code: "schema_validation_failed",
    });
    expect(testHarness.dependencies.tools.invoke).not.toHaveBeenCalled();
  });

  it("accepts a durable evidence reference from a completed read-only tool", async () => {
    const testHarness = harness(
      [
        {
          kind: "tool_call",
          call: {
            tool_call_id: "tool-call-read-only",
            tool_name: "search",
            capability: "search.read",
            arguments: { query: "current weather" },
          },
        },
        { kind: "complete", terminal_artifact_ref: null },
      ],
      {
        outcome: "completed",
        retryable: false,
        side_effect_status: "none",
        output: { current: "available" },
        external_response_ref: "evidence:read-only:1",
      },
    );

    const { run } = await startAndExecute(testHarness);
    expect(run.status).toBe("completed");
    expect(run.tools).toEqual([
      expect.objectContaining({
        tool_invocation_id: "tool-call-read-only",
        status: "completed",
        side_effect_status: "none",
      }),
    ]);
  });

  it("accepts the opaque ObjectStore reference it binds to a completed tool result", async () => {
    const objectRef = `objv1_${"a".repeat(64)}` as ObjectRefV1;
    const testHarness = harness(
      [
        {
          kind: "tool_call",
          call: {
            tool_call_id: "tool-call-object-store-evidence",
            tool_name: "search",
            capability: "search.read",
            arguments: { query: "current weather" },
          },
        },
        { kind: "complete", terminal_artifact_ref: null },
      ],
      {
        outcome: "completed",
        retryable: false,
        side_effect_status: "none",
        output: { current: "available" },
        external_response_ref: objectRef,
      },
    );

    const { run } = await startAndExecute(testHarness);
    expect(run.status).toBe("completed");
    expect(run.tools[0]?.result).toMatchObject({
      external_response_ref: objectRef,
    });
  });

  it("applies the documented bounded retry count and exponential backoff only to retryable no-side-effect failures", async () => {
    const testHarness = harness(
      [
        {
          kind: "tool_call",
          call: {
            tool_call_id: "tool-call-retry",
            tool_name: "search",
            capability: "search.read",
            arguments: { query: "bounded" },
          },
        },
      ],
      {
        outcome: "failed",
        retryable: true,
        side_effect_status: "none",
        error: { code: "temporarily_unavailable", message: "retry later" },
        external_error_ref: "evidence:temporary:1",
      },
    );
    const waits: number[] = [];
    const retrying = createRuntimeExecutionApplicationV1(
      testHarness.dependencies,
      {
        now: () => now,
        max_adapter_turns: 20,
        max_retry_attempts: 2,
        retry_base_backoff_ms: 500,
        retry_max_backoff_ms: 30_000,
        retry_jitter: "none",
        sleep: async (milliseconds) => {
          waits.push(milliseconds);
        },
      },
    );
    const request = startRequest();
    const response = await retrying.start(principal, request);

    await retrying.executeQueued({
      runtime_run_id: request.runtime_run_id,
      worker_id: "worker-1",
      expected_start_fence_generation:
        response.details.start_fence_generation,
      lease_seconds: 600,
      deadline_at: deadline,
    });

    expect(testHarness.dependencies.tools.invoke).toHaveBeenCalledTimes(3);
    expect(waits).toEqual([500, 1_000]);
  });

  it("accepts zero configured retries and never retries a retryable failure", async () => {
    const testHarness = harness(
      [
        {
          kind: "tool_call",
          call: {
            tool_call_id: "tool-call-no-retry",
            tool_name: "search",
            capability: "search.read",
            arguments: { query: "bounded" },
          },
        },
      ],
      {
        outcome: "failed",
        retryable: true,
        side_effect_status: "none",
        error: { code: "temporarily_unavailable", message: "retry later" },
      },
    );
    const sleep = vi.fn(async () => undefined);
    const noRetry = createRuntimeExecutionApplicationV1(
      testHarness.dependencies,
      {
        now: () => now,
        max_adapter_turns: 20,
        max_retry_attempts: 0,
        sleep,
      },
    );
    const request = startRequest();
    const response = await noRetry.start(principal, request);

    await noRetry.executeQueued({
      runtime_run_id: request.runtime_run_id,
      worker_id: "worker-1",
      expected_start_fence_generation:
        response.details.start_fence_generation,
      lease_seconds: 600,
      deadline_at: deadline,
    });

    expect(testHarness.dependencies.tools.invoke).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("freezes an unknown tool side effect and never retries it automatically", async () => {
    const testHarness = harness(
      [
        {
          kind: "tool_call",
          call: {
            tool_call_id: "tool-call-unknown",
            tool_name: "search",
            capability: "search.read",
            arguments: { query: "bounded" },
          },
        },
      ],
      {
        outcome: "failed",
        retryable: false,
        side_effect_status: "unknown",
        error: { code: "disconnect", message: "commit may have happened" },
      },
    );

    await expect(startAndExecute(testHarness)).rejects.toMatchObject({
      code: "tool_side_effect_unknown",
    });
    expect(testHarness.dependencies.tools.invoke).toHaveBeenCalledTimes(1);
    const run = await testHarness.store.readRun("run-1");
    expect(run).toMatchObject({
      status: "failed",
      frozen_side_effect: true,
      terminal_reason: "tool_side_effect_unknown",
    });
    expect(run?.tools[0]).toMatchObject({
      status: "failed",
      side_effect_status: "unknown",
    });
    expect(
      run?.events.some(({ event_type }) => event_type === "runtime.tool.failed"),
    ).toBe(true);
    expect(
      run?.events.some(({ event_type }) => event_type === "runtime.run.failed"),
    ).toBe(true);
  });

  it("treats a tool exception as commit-unknown and never invokes it twice", async () => {
    const testHarness = harness([
      {
        kind: "tool_call",
        call: {
          tool_call_id: "tool-call-disconnect",
          tool_name: "search",
          capability: "search.read",
          arguments: { query: "bounded" },
        },
      },
    ]);
    testHarness.dependencies.tools.invoke.mockRejectedValue(
      new Error("connection closed after request upload"),
    );

    await expect(startAndExecute(testHarness)).rejects.toMatchObject({
      code: "tool_side_effect_unknown",
    });
    expect(testHarness.dependencies.tools.invoke).toHaveBeenCalledTimes(1);
    const run = await testHarness.store.readRun("run-1");
    expect(run).toMatchObject({
      status: "failed",
      frozen_side_effect: true,
      terminal_reason: "tool_side_effect_unknown",
      tools: [
        {
          status: "failed",
          side_effect_status: "unknown",
          result: {
            outcome: "failed",
            retryable: false,
            side_effect_status: "unknown",
            error: {
              code: "external_outcome_unknown",
            },
          },
        },
      ],
    });
  });

  it("keeps tool/provider secrets out of run rows and durable event summaries", async () => {
    const secret =
      "sk-secret https://signed.example/result?token=secret prompt-fragment";
    const testHarness = harness(
      [
        {
          kind: "tool_call",
          call: {
            tool_call_id: "tool-secret-redaction",
            tool_name: "search",
            capability: "search.read",
            arguments: { query: "bounded" },
          },
        },
      ],
      {
        outcome: "failed",
        retryable: false,
        side_effect_status: "none",
        error: { code: secret, message: secret },
        external_error_ref: "evidence:tool-secret-redaction",
      },
    );
    const { run } = await startAndExecute(testHarness);
    const serialized = JSON.stringify(run);
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain("signed.example");
    expect(run.tools[0]?.result).toMatchObject({
      error: {
        code: "tool_execution_failed",
        message:
          "Tool execution failed; inspect provider-side redacted diagnostics",
      },
      external_error_ref: "evidence:tool-secret-redaction",
    });
  });

  it("retains callback failures in the owner outbox and recovers them idempotently", async () => {
    const testHarness = harness();
    testHarness.dependencies.callback.deliver.mockRejectedValue(
      new Error("callback unavailable"),
    );

    const { run } = await startAndExecute(testHarness);
    const pendingCount = run.outbox.filter(
      ({ status }) => status === "pending",
    ).length;
    expect(pendingCount).toBeGreaterThan(0);
    testHarness.dependencies.callback.deliver.mockReset();
    testHarness.dependencies.callback.deliver.mockResolvedValue({
      transport_ref: "callback:recovered",
    });

    await expect(testHarness.app.recoverPendingCallbacks()).resolves.toEqual({
      attempted: pendingCount,
      sent: pendingCount,
    });
    const recovered = await testHarness.store.readRun("run-1");
    expect(recovered?.outbox.every(({ status }) => status === "sent")).toBe(
      true,
    );
  });

  it("dead-letters a non-retryable callback failure instead of spinning the owner outbox", async () => {
    const testHarness = harness();
    testHarness.dependencies.callback.deliver.mockRejectedValue(
      new InternalClientError({
        code: "event_expired",
        message: "Runtime event retention has expired",
        retryable: false,
        traceId: "11111111111111111111111111111111",
        status: 410,
      }),
    );

    await startAndExecute(testHarness);

    const run = await testHarness.store.readRun("run-1");
    expect(run?.outbox.every(({ status }) => status === "failed")).toBe(true);
    await expect(testHarness.app.recoverPendingCallbacks()).resolves.toEqual({
      attempted: 0,
      sent: 0,
    });
  });

  it("ACKs the exact snapshotted callback record even when the claimed object is mutated during delivery", async () => {
    const testHarness = harness();
    testHarness.dependencies.callback.deliver.mockRejectedValue(
      new Error("leave every callback pending"),
    );
    await startAndExecute(testHarness);
    const claimed = await testHarness.store.claimOutbox({
      worker_id: "runtime-callback-worker-1",
      limit: 1,
      lease_seconds: 30,
      now: testHarness.now().toISOString(),
      current_transport_epoch: "runtime-callback.v1",
      current_transport_generation: 1,
    });
    const mutableClaim = structuredClone(claimed[0]!);
    const originalId = mutableClaim.id;
    const originalEventId = mutableClaim.event.event_id;
    const acknowledgeOutbox = vi.fn(
      testHarness.store.acknowledgeOutbox.bind(testHarness.store),
    );
    const application = createRuntimeExecutionApplicationV1(
      {
        ...testHarness.dependencies,
        store: Object.freeze({
          ...testHarness.store,
          async claimOutbox() {
            return [mutableClaim];
          },
          acknowledgeOutbox,
        }),
        callback: {
          worker_id: "runtime-callback-worker-1",
          lease_seconds: 30,
          transport_epoch: "runtime-callback.v1",
          transport_generation: 1,
          deliver: vi.fn(async () => {
            (
              mutableClaim as { id: string }
            ).id = "runtime_outbox:another-event";
            (
              mutableClaim.event as { event_id: string }
            ).event_id = "another-event";
            return {
              transport_ref: "callback:mutated-claim",
            };
          }),
        },
      },
      { now: testHarness.now, max_adapter_turns: 20 },
    );

    await expect(
      application.recoverPendingCallbacks(1),
    ).resolves.toEqual({ attempted: 1, sent: 1 });
    expect(acknowledgeOutbox).toHaveBeenCalledWith(
      expect.objectContaining({
        outbox_id: originalId,
        event_id: originalEventId,
        claim_token: claimed[0]?.claim_token,
        outcome: "sent",
        transport_epoch: "runtime-callback.v1",
        transport_generation: 1,
      }),
    );
    await expect(testHarness.store.readRun("run-1")).resolves.toEqual(
      expect.objectContaining({
        outbox: expect.arrayContaining([
          expect.objectContaining({ id: originalId, status: "sent" }),
        ]),
      }),
    );
  });

  it("resolves an outbox ACK commit-then-disconnect from the exact durable record", async () => {
    const testHarness = harness();
    testHarness.dependencies.callback.deliver.mockRejectedValue(
      new Error("callback unavailable"),
    );
    await startAndExecute(testHarness);
    testHarness.dependencies.callback.deliver.mockReset();
    testHarness.dependencies.callback.deliver.mockResolvedValue({
      transport_ref: "callback:commit-unknown",
    });
    const baseAcknowledge =
      testHarness.store.acknowledgeOutbox.bind(testHarness.store);
    const readOutboxAcknowledgeState = vi.fn(
      testHarness.store.readOutboxAcknowledgeState.bind(
        testHarness.store,
      ),
    );
    let disconnected = false;
    const application = createRuntimeExecutionApplicationV1(
      {
        ...testHarness.dependencies,
        store: Object.freeze({
          ...testHarness.store,
          async acknowledgeOutbox(request) {
            const committed = await baseAcknowledge(request);
            if (!disconnected) {
              disconnected = true;
              throw new Error("connection closed after ACK commit");
            }
            return committed;
          },
          readOutboxAcknowledgeState,
        }),
      },
      { now: testHarness.now, max_adapter_turns: 20 },
    );
    const deliveriesBeforeRecovery =
      testHarness.dependencies.callback.deliver.mock.calls.length;
    const pendingBeforeRecovery = (
      await testHarness.store.readRun("run-1")
    )?.outbox.filter(({ status }) => status === "pending").length ?? 0;

    await expect(
      application.recoverPendingCallbacks(),
    ).resolves.toEqual({
      attempted: pendingBeforeRecovery,
      sent: pendingBeforeRecovery,
    });
    expect(testHarness.dependencies.callback.deliver).toHaveBeenCalledTimes(
      deliveriesBeforeRecovery + pendingBeforeRecovery,
    );
    expect(readOutboxAcknowledgeState).toHaveBeenCalledWith(
      expect.objectContaining({
        claim_token: expect.any(String),
        outcome: "sent",
        transport_ref: expect.any(String),
        transport_epoch: "runtime-callback.v1",
        transport_generation: 1,
        current_transport_epoch: "runtime-callback.v1",
        current_transport_generation: 1,
      }),
    );
    await expect(
      application.recoverPendingCallbacks(),
    ).resolves.toEqual({ attempted: 0, sent: 0 });
  });

  it("fences concurrent, expired, wrong-token, and wrong-transport outbox claims", async () => {
    const testHarness = harness();
    testHarness.dependencies.callback.deliver.mockRejectedValue(
      new Error("leave callback rows pending"),
    );
    await startAndExecute(testHarness);
    const claimRequest = {
      worker_id: "callback-worker-a",
      limit: 16,
      lease_seconds: 30,
      now: testHarness.now().toISOString(),
      current_transport_epoch: "runtime-callback.v1",
      current_transport_generation: 1,
    } as const;
    const [claimsA, claimsB] = await Promise.all([
      testHarness.store.claimOutbox(claimRequest),
      testHarness.store.claimOutbox({
        ...claimRequest,
        worker_id: "callback-worker-b",
      }),
    ]);
    expect(claimsA.length).toBeGreaterThan(0);
    expect(claimsB).toEqual([]);
    const first = claimsA[0]!;
    const ack = {
      outbox_id: first.id,
      claim_token: first.claim_token,
      outcome: "sent" as const,
      next_retry_at: null,
      error: null,
      transport_ref: `callback:${first.id}:${first.attempt_count}`,
      transport_epoch: first.transport_epoch,
      transport_generation: first.transport_generation,
      current_transport_epoch: first.transport_epoch,
      current_transport_generation: first.transport_generation,
      now: testHarness.now().toISOString(),
      runtime_run_id:
        (first.event.payload as { runtime_run_id: string })
          .runtime_run_id,
      event_id: first.event.event_id,
      event_hash: canonicalPayloadHashV1(first.event),
      expected_attempt_count: first.attempt_count,
    };
    await expect(
      testHarness.store.acknowledgeOutbox({
        ...ack,
        claim_token: `${first.claim_token}:wrong`,
      }),
    ).rejects.toMatchObject({ code: "idempotency_conflict" });
    await expect(
      testHarness.store.claimOutbox({
        ...claimRequest,
        current_transport_generation: 2,
      }),
    ).rejects.toMatchObject({ code: "idempotency_conflict" });

    testHarness.advance(30_001);
    await expect(
      testHarness.store.acknowledgeOutbox({
        ...ack,
        now: testHarness.now().toISOString(),
      }),
    ).rejects.toMatchObject({ code: "idempotency_conflict" });
    const takeover = await testHarness.store.claimOutbox({
      ...claimRequest,
      worker_id: "callback-worker-b",
      now: testHarness.now().toISOString(),
    });
    const reclaimed = takeover.find(({ id }) => id === first.id);
    expect(reclaimed).toBeDefined();
    expect(reclaimed?.claim_token).not.toBe(first.claim_token);
    expect(reclaimed?.attempt_count).toBe(
      first.attempt_count + 1,
    );
    if (reclaimed === undefined) return;
    const successfulAck = {
      ...ack,
      claim_token: reclaimed.claim_token,
      transport_ref:
        `callback:${reclaimed.id}:${reclaimed.attempt_count}`,
      expected_attempt_count: reclaimed.attempt_count,
      now: testHarness.now().toISOString(),
    };
    await expect(
      testHarness.store.acknowledgeOutbox(successfulAck),
    ).resolves.toEqual({ acknowledged: true });
    await expect(
      testHarness.store.acknowledgeOutbox(successfulAck),
    ).resolves.toEqual({ acknowledged: true });
    for (const identityDrift of [
      {
        ...successfulAck,
        runtime_run_id: `${successfulAck.runtime_run_id}:other`,
      },
      {
        ...successfulAck,
        event_hash: rawSha256(
          new TextEncoder().encode("wrong-event"),
        ),
      },
      {
        ...successfulAck,
        current_transport_generation:
          successfulAck.current_transport_generation + 1,
      },
    ]) {
      await expect(
        testHarness.store.acknowledgeOutbox(identityDrift),
      ).rejects.toMatchObject({ code: "idempotency_conflict" });
    }
    await expect(testHarness.store.readRun("run-1")).resolves.toEqual(
      expect.objectContaining({
        outbox: expect.arrayContaining([
          expect.objectContaining({
            id: first.id,
            status: "sent",
            attempt_count: reclaimed.attempt_count,
          }),
        ]),
      }),
    );
  });

  it("pins worker and artifact reconciliation claims before their first await", async () => {
    const testHarness = harness();
    const request = startRequest("run-worker-claim-snapshot");
    const response = await testHarness.app.start(principal, request);
    const baseReadRun =
      testHarness.store.readRun.bind(testHarness.store);
    let enteredRead!: () => void;
    const readEntered = new Promise<void>((resolve) => {
      enteredRead = resolve;
    });
    let releaseRead!: () => void;
    const readGate = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });
    let gateRead = true;
    const claimQueuedRun = vi.fn(
      testHarness.store.claimQueuedRun.bind(testHarness.store),
    );
    const claimedArtifacts: unknown[] = [];
    const application = createRuntimeExecutionApplicationV1(
      {
        ...testHarness.dependencies,
        store: Object.freeze({
          ...testHarness.store,
          claimQueuedRun,
          async readRun(runtimeRunId) {
            if (gateRead) {
              gateRead = false;
              enteredRead();
              await readGate;
            }
            return baseReadRun(runtimeRunId);
          },
          async claimPendingArtifacts(claim) {
            claimedArtifacts.push(claim);
            return [];
          },
        }),
      },
      { now: testHarness.now, max_adapter_turns: 20 },
    );
    const workerClaim = {
      runtime_run_id: request.runtime_run_id,
      worker_id: "worker-original",
      expected_start_fence_generation:
        response.details.start_fence_generation,
      lease_seconds: 600,
      deadline_at: deadline,
    };
    const execution = application.executeQueued(workerClaim);
    await readEntered;
    workerClaim.runtime_run_id = "run-attacker";
    workerClaim.worker_id = "worker-attacker";
    workerClaim.expected_start_fence_generation = 99;
    releaseRead();
    await execution;
    expect(claimQueuedRun).toHaveBeenCalledWith(
      expect.objectContaining({
        runtime_run_id: request.runtime_run_id,
        worker_id: "worker-original",
        expected_start_fence_generation:
          response.details.start_fence_generation,
      }),
    );

    const artifactClaim = {
      worker_id: "artifact-worker-original",
      limit: 3,
      lease_seconds: 30,
    };
    const recovery = application.recoverPendingArtifacts(artifactClaim);
    artifactClaim.worker_id = "artifact-worker-attacker";
    artifactClaim.limit = 999;
    await expect(recovery).resolves.toEqual({
      attempted: 0,
      available: 0,
      failed: 0,
      pending: 0,
    });
    expect(claimedArtifacts[0]).toMatchObject({
      worker_id: "artifact-worker-original",
      limit: 3,
      lease_seconds: 30,
    });
    expect(Object.isFrozen(claimedArtifacts[0])).toBe(true);
  });

  it("commits policy expiry as an internal durable control before stopping, including commit-disconnect replay", async () => {
    const testHarness = harness();
    const receiveInternalControl =
      testHarness.store.receiveInternalControl.bind(
        testHarness.store,
      );
    const receiveWithDisconnect = vi
      .fn(receiveInternalControl)
      .mockImplementationOnce(async (request) => {
        await receiveInternalControl(request);
        throw new Error("connection closed after internal control commit");
      })
      .mockImplementation(receiveInternalControl);
    const handleControl =
      testHarness.store.handleControl.bind(testHarness.store);
    const handleWithDisconnect = vi
      .fn(handleControl)
      .mockImplementationOnce(async (request) => {
        await handleControl(request);
        throw new Error("connection closed after control fence commit");
      })
      .mockImplementation(handleControl);
    const application = createRuntimeExecutionApplicationV1(
      {
        ...testHarness.dependencies,
        store: Object.freeze({
          ...testHarness.store,
          receiveInternalControl: receiveWithDisconnect,
          handleControl: handleWithDisconnect,
        }),
      },
      {
        now: testHarness.now,
        max_adapter_turns: 20,
        max_retry_attempts: 2,
      },
    );
    const original = startRequest("run-policy-expired");
    const policy = {
      ...original.policy,
      expires_at: new Date(now.getTime() + 1_000).toISOString(),
    };
    const request = {
      ...original,
      policy,
      policy_input_hash: canonicalPayloadHashV1(policy),
    };
    testHarness.setSkillResolutionValidUntil(policy.expires_at);
    const response = await application.start(principal, request);
    testHarness.advance(1_001);

    const run = await application.executeQueued({
      runtime_run_id: request.runtime_run_id,
      worker_id: "worker-policy-expiry",
      expected_start_fence_generation:
        response.details.start_fence_generation,
      lease_seconds: 60,
      deadline_at: deadline,
    });

    expect(run).toMatchObject({
      status: "cancelled",
      terminal_reason: "runtime_policy_expired",
      controls: [
        {
          requested_by: "action_runtime",
          control_type: "cancel",
          control_valid_until: "2026-07-23T04:15:01.001Z",
          status: "handled",
          request: { reason_code: "runtime_policy_expired" },
        },
      ],
    });
    expect(
      run.events
        .filter(({ event_type }) =>
          event_type.startsWith("runtime.control_signal."),
        )
        .map(({ payload }) => ({
          requested_by: payload.requested_by,
          reason_code: payload.reason_code,
        })),
    ).toEqual([
      {
        requested_by: "action_runtime",
        reason_code: "runtime_policy_expired",
      },
      {
        requested_by: "action_runtime",
        reason_code: "runtime_policy_expired",
      },
    ]);
    expect(testHarness.dependencies.adapter.start).not.toHaveBeenCalled();
    expect(testHarness.dependencies.tools.invoke).not.toHaveBeenCalled();
    expect(receiveWithDisconnect).toHaveBeenCalledTimes(1);
    expect(handleWithDisconnect).toHaveBeenCalledTimes(1);
  });

  it("turns a security epoch race before tool dispatch into the same durable control with no external side effect", async () => {
    const testHarness = harness([
      {
        kind: "tool_call",
        call: {
          tool_call_id: "tool-security-race",
          tool_name: "search",
          capability: "search.read",
          arguments: { query: "must-not-dispatch" },
        },
      },
    ]);
    testHarness.dependencies.adapter.next.mockImplementationOnce(
      async () => {
        testHarness.setSecurityRevocationEpoch(5);
        return {
          kind: "tool_call",
          call: {
            tool_call_id: "tool-security-race",
            tool_name: "search",
            capability: "search.read",
            arguments: { query: "must-not-dispatch" },
          },
        };
      },
    );

    const { run } = await startAndExecute(testHarness);
    expect(run).toMatchObject({
      status: "cancelled",
      terminal_reason: "security_revocation_epoch_advanced",
      controls: [
        {
          requested_by: "action_runtime",
          status: "handled",
          request: {
            reason_code:
              "security_revocation_epoch_advanced",
          },
        },
      ],
    });
    expect(testHarness.dependencies.tools.invoke).not.toHaveBeenCalled();
    expect(
      testHarness.dependencies.object_store.putImmutable,
    ).not.toHaveBeenCalled();
    expect(
      testHarness.dependencies.profiles.resolveExact,
    ).toHaveBeenCalledTimes(1);
    expect(
      testHarness.dependencies.policy_checkpoints.check.mock.calls.map(
        ([request]) => request.checkpoint,
      ),
    ).toEqual([
      "worker_claim",
      "worker_claim",
      "tool_dispatch",
    ]);
  });

  it("never persists or returns raw provider and tool exception secrets", async () => {
    const secret =
      "sk-ant-secret https://signed.example/object?token=secret";
    const providerHarness = harness();
    providerHarness.dependencies.adapter.next.mockRejectedValueOnce(
      new Error(secret),
    );
    const providerRequest = startRequest("run-provider-secret");
    const providerResponse =
      await providerHarness.app.start(principal, providerRequest);
    await expect(
      providerHarness.app.executeQueued({
        runtime_run_id: providerRequest.runtime_run_id,
        worker_id: "worker-provider-secret",
        expected_start_fence_generation:
          providerResponse.details.start_fence_generation,
        lease_seconds: 60,
        deadline_at: deadline,
      }),
    ).rejects.toMatchObject({
      code: "runtime_adapter_failed",
      message: "Runtime execution failed at a protected boundary",
    });
    expect(
      JSON.stringify(
        await providerHarness.store.readRun(
          providerRequest.runtime_run_id,
        ),
      ),
    ).not.toContain(secret);

    const toolHarness = harness([
      {
        kind: "tool_call",
        call: {
          tool_call_id: "tool-secret-error",
          tool_name: "search",
          capability: "search.read",
          arguments: { query: "safe" },
        },
      },
    ]);
    toolHarness.dependencies.tools.invoke.mockRejectedValueOnce(
      new Error(secret),
    );
    await expect(startAndExecute(toolHarness)).rejects.toMatchObject({
      code: "tool_side_effect_unknown",
    });
    expect(
      JSON.stringify(await toolHarness.store.readRun("run-1")),
    ).not.toContain(secret);
  });

  it("checks the current epoch again before Skill content fetch and never loads revoked bytes", async () => {
    const testHarness = harness([
      { kind: "skill_load", skill_key: "skill-a" },
    ]);
    const baseCheck =
      testHarness.dependencies.policy_checkpoints.check.getMockImplementation();
    if (baseCheck === undefined) throw new Error("checkpoint fake missing");
    testHarness.dependencies.policy_checkpoints.check.mockImplementation(
      async (request, signal) => {
        if (request.checkpoint === "skill_content_fetch") {
          testHarness.setSecurityRevocationEpoch(5);
        }
        return baseCheck(request, signal);
      },
    );

    const { run } = await startAndExecute(testHarness);
    expect(run).toMatchObject({
      status: "cancelled",
      terminal_reason: "security_revocation_epoch_advanced",
    });
    expect(testHarness.dependencies.skills.load).not.toHaveBeenCalled();
    expect(
      testHarness.dependencies.policy_checkpoints.check.mock.calls.map(
        ([request]) => request.checkpoint,
      ),
    ).toEqual([
      "worker_claim",
      "worker_claim",
      "skill_load",
      "skill_content_fetch",
    ]);
  });

  it("uses exact skills and immutable ObjectStore artifacts", async () => {
    const body = new Uint8Array([7, 8, 9]);
    const testHarness = harness([
      { kind: "skill_load", skill_key: "skill-a" },
      {
        kind: "artifact",
        artifact: {
          artifact_id: "artifact-1",
          artifact_kind: "runtime-output",
          media_type: "application/octet-stream",
          body,
          expected_sha256: rawSha256(body),
          retention_until: "2026-08-23T04:00:00.000Z",
        },
      },
      { kind: "complete", terminal_artifact_ref: null },
    ]);

    const { run } = await startAndExecute(testHarness);
    expect(run.status).toBe("completed");
    expect(run.events.map(({ event_type }) => event_type)).toEqual(
      expect.arrayContaining([
        "runtime.skill.load.requested",
        "runtime.skill.load.resolved",
        "runtime.skill.load.materialized",
        "runtime.artifact.created",
      ]),
    );
    expect(
      testHarness.dependencies.skills.resolve,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        expected_catalog_version: "catalog-184",
        skills: [
          {
            name: "skill-a",
            version_constraint: "catalog_revision",
            required: true,
          },
        ],
      }),
      expect.anything(),
    );
    expect(testHarness.dependencies.skills.load).toHaveBeenCalledTimes(1);
    expect(
      testHarness.dependencies.object_store.putImmutable,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        owner_service: "action_runtime",
        owner_object_id: "artifact-1",
        owner_state_version: run.start_fence_generation,
        object_class: "runtime_artifact",
        capability: "runtime.artifact.write",
        idempotency_key: "run-1:artifact:artifact-1",
      }),
    );
    const created = run.events.find(
      ({ event_type }) =>
        event_type === "runtime.artifact.created",
    );
    expect(created?.payload).toMatchObject({
      artifact_id: "artifact-1",
      artifact_kind: "runtime-output",
      content_hash: rawSha256(body),
      size_bytes: body.byteLength,
      media_type: "application/octet-stream",
      retention_until: "2026-08-23T04:00:00.000Z",
      status: "available",
    });
  });

  it("replays only an artifact event whose immutable identity and metadata exactly match", async () => {
    const body = new Uint8Array([7, 8, 9]);
    const artifactTurn = {
      kind: "artifact" as const,
      artifact: {
        artifact_id: "artifact-exact-replay",
        artifact_kind: "runtime-output",
        media_type: "application/octet-stream",
        body,
        expected_sha256: rawSha256(body),
        retention_until: "2026-08-23T04:00:00.000Z",
      },
    };
    const testHarness = harness([
      artifactTurn,
      artifactTurn,
      {
        kind: "complete",
        terminal_artifact_ref:
          "object:run-1:artifact:artifact-exact-replay",
      },
    ]);

    const { run } = await startAndExecute(testHarness);
    expect(run.status).toBe("completed");
    expect(
      testHarness.dependencies.object_store.putImmutable,
    ).toHaveBeenCalledTimes(1);
    expect(
      run.events.filter(
        ({ event_type }) =>
          event_type === "runtime.artifact.created",
      ),
    ).toHaveLength(1);
    expect(
      run.events.find(
        ({ event_type }) =>
          event_type === "runtime.run.completed",
      )?.payload,
    ).toMatchObject({
      terminal_artifact_ref:
        "object:run-1:artifact:artifact-exact-replay",
    });
  });

  it("resolves artifact finalize commit-then-disconnect from owner facts", async () => {
    const body = new Uint8Array([3, 1, 4]);
    const testHarness = harness([
      {
        kind: "artifact",
        artifact: {
          artifact_id: "artifact-commit-disconnect",
          artifact_kind: "runtime-output",
          media_type: "application/octet-stream",
          body,
          expected_sha256: rawSha256(body),
          retention_until: "2026-08-23T04:00:00.000Z",
        },
      },
      { kind: "complete", terminal_artifact_ref: null },
    ]);
    const finalize =
      testHarness.store.finalizeArtifact.bind(testHarness.store);
    const finalizeArtifact = vi
      .fn(finalize)
      .mockImplementationOnce(async (request) => {
        await finalize(request);
        throw new Error("connection closed after commit");
      })
      .mockImplementation(finalize);
    const application = createRuntimeExecutionApplicationV1(
      {
        ...testHarness.dependencies,
        store: Object.freeze({
          ...testHarness.store,
          finalizeArtifact,
        }),
      },
      {
        now: testHarness.now,
        max_adapter_turns: 20,
        max_retry_attempts: 2,
      },
    );
    const start = startRequest();
    const response = await application.start(principal, start);
    const run = await application.executeQueued({
      runtime_run_id: start.runtime_run_id,
      worker_id: "worker-1",
      expected_start_fence_generation:
        response.details.start_fence_generation,
      lease_seconds: 600,
      deadline_at: deadline,
    });
    expect(run.status).toBe("completed");
    expect(
      await testHarness.store.readArtifact(
        "run-1",
        "artifact-commit-disconnect",
      ),
    ).toMatchObject({
      status: "available",
      artifact_ref:
        "object:run-1:artifact:artifact-commit-disconnect",
    });
    expect(
      run.events.filter(
        ({ event_type }) =>
          event_type === "runtime.artifact.created",
      ),
    ).toHaveLength(1);
  });

  it("recovers a pre-commit artifact finalization failure without SDK bytes", async () => {
    const body = new Uint8Array([2, 7, 1, 8]);
    const testHarness = harness([
      {
        kind: "artifact",
        artifact: {
          artifact_id: "artifact-event-commit-retry",
          artifact_kind: "runtime-output",
          media_type: "application/octet-stream",
          body,
          expected_sha256: rawSha256(body),
          retention_until: "2026-08-23T04:00:00.000Z",
        },
      },
    ]);
    const finalize =
      testHarness.store.finalizeArtifact.bind(testHarness.store);
    const finalizeArtifact = vi
      .fn(finalize)
      .mockRejectedValueOnce(new Error("database unavailable before commit"))
      .mockImplementation(finalize);
    const application = createRuntimeExecutionApplicationV1(
      {
        ...testHarness.dependencies,
        store: Object.freeze({
          ...testHarness.store,
          finalizeArtifact,
        }),
      },
      {
        now: testHarness.now,
        max_adapter_turns: 20,
        max_retry_attempts: 2,
      },
    );
    const start = startRequest();
    const response = await application.start(principal, start);
    await expect(
      application.executeQueued({
        runtime_run_id: start.runtime_run_id,
        worker_id: "worker-1",
        expected_start_fence_generation:
          response.details.start_fence_generation,
        lease_seconds: 600,
        deadline_at: deadline,
      }),
    ).rejects.toMatchObject({
      code: "storage_unavailable",
      details: { reconciliation_required: true },
    });
    expect(
      await testHarness.store.readArtifact(
        "run-1",
        "artifact-event-commit-retry",
      ),
    ).toMatchObject({ status: "creating" });
    expect(
      (await testHarness.store.readRun("run-1"))?.events.some(
        ({ event_type }) =>
          event_type === "runtime.artifact.created",
      ),
    ).toBe(false);

    testHarness.advance(600_001);
    await expect(
      application.recoverPendingArtifacts({
        worker_id: "artifact-reconciler-commit",
      }),
    ).resolves.toEqual({
      attempted: 1,
      available: 1,
      failed: 0,
      pending: 0,
    });
    expect(
      await testHarness.store.readArtifact(
        "run-1",
        "artifact-event-commit-retry",
      ),
    ).toMatchObject({ status: "available" });
  });

  it("fences duplicate artifact reconcilers and permits expired-claim takeover", async () => {
    const body = new Uint8Array([1, 6, 1, 8]);
    const testHarness = harness([
      {
        kind: "artifact",
        artifact: {
          artifact_id: "artifact-claim-fence",
          artifact_kind: "runtime-output",
          media_type: "application/octet-stream",
          body,
          expected_sha256: rawSha256(body),
          retention_until: "2026-08-23T04:00:00.000Z",
        },
      },
    ]);
    const ambiguous = new ObjectStoreErrorV1(
      "storage_unavailable",
      "unknown remote commit",
      true,
      { reconciliation_required: true },
    );
    testHarness.dependencies.object_store.putImmutable.mockRejectedValue(
      ambiguous,
    );
    await expect(startAndExecute(testHarness)).rejects.toBe(ambiguous);

    await expect(
      testHarness.app.recoverPendingArtifacts({
        worker_id: "artifact-reconciler-too-early",
        lease_seconds: 30,
      }),
    ).resolves.toEqual({
      attempted: 0,
      available: 0,
      failed: 0,
      pending: 0,
    });
    expect(
      testHarness.dependencies.object_store.putImmutable,
    ).toHaveBeenCalledTimes(1);

    testHarness.advance(600_001);
    await expect(
      testHarness.app.recoverPendingArtifacts({
        worker_id: "artifact-reconciler-a",
        lease_seconds: 30,
      }),
    ).resolves.toEqual({
      attempted: 1,
      available: 0,
      failed: 0,
      pending: 1,
    });
    await expect(
      testHarness.app.recoverPendingArtifacts({
        worker_id: "artifact-reconciler-b",
        lease_seconds: 30,
      }),
    ).resolves.toEqual({
      attempted: 0,
      available: 0,
      failed: 0,
      pending: 0,
    });

    testHarness.advance(30_001);
    testHarness.dependencies.object_store.putImmutable.mockImplementation(
      async (request) => ({
        object_ref:
          `object:${request.idempotency_key}` as ObjectRefV1,
        version: "1",
        sha256: request.expected_sha256,
        size_bytes: request.size_bytes,
        media_type: request.media_type,
        retention_until: request.retention_until,
        replayed: true,
      }),
    );
    await expect(
      testHarness.app.recoverPendingArtifacts({
        worker_id: "artifact-reconciler-b",
        lease_seconds: 30,
      }),
    ).resolves.toEqual({
      attempted: 1,
      available: 1,
      failed: 0,
      pending: 0,
    });
    expect(
      await testHarness.store.readArtifact(
        "run-1",
        "artifact-claim-fence",
      ),
    ).toMatchObject({
      status: "available",
      reconciliation_generation: 2,
    });
  });

  it("holds the old lease fence in takeover_pending until every creating artifact is reconciled", async () => {
    const body = new Uint8Array([9, 2, 6, 5]);
    const testHarness = harness([
      {
        kind: "artifact",
        artifact: {
          artifact_id: "artifact-takeover-gate",
          artifact_kind: "runtime-output",
          media_type: "application/octet-stream",
          body,
          expected_sha256: rawSha256(body),
          retention_until: "2026-08-23T04:00:00.000Z",
        },
      },
    ]);
    testHarness.dependencies.object_store.putImmutable.mockRejectedValueOnce(
      new ObjectStoreErrorV1(
        "storage_unavailable",
        "upload commit outcome unknown",
        true,
        { reconciliation_required: true },
      ),
    );
    const request = startRequest("run-artifact-takeover");
    const response = await testHarness.app.start(principal, request);
    await expect(
      testHarness.app.executeQueued({
        runtime_run_id: request.runtime_run_id,
        worker_id: "worker-before-crash",
        expected_start_fence_generation:
          response.details.start_fence_generation,
        lease_seconds: 1,
        deadline_at: deadline,
      }),
    ).rejects.toMatchObject({
      code: "storage_unavailable",
      details: { reconciliation_required: true },
    });
    testHarness.advance(1_001);
    await testHarness.app.start(principal, request);

    await expect(
      testHarness.app.executeQueued({
        runtime_run_id: request.runtime_run_id,
        worker_id: "worker-after-crash",
        expected_start_fence_generation:
          response.details.start_fence_generation,
        lease_seconds: 60,
        deadline_at: deadline,
      }),
    ).rejects.toMatchObject({
      code: "artifact_reconciliation_required",
      retryable: true,
    });
    expect(
      await testHarness.store.readRun(request.runtime_run_id),
    ).toMatchObject({
      lease: {
        owner_id: "worker-before-crash",
        generation: 1,
        recovery_state: "takeover_pending",
      },
    });

    await expect(
      testHarness.app.recoverPendingArtifacts({
        worker_id: "artifact-reconciler-takeover",
      }),
    ).resolves.toEqual({
      attempted: 1,
      available: 0,
      failed: 1,
      pending: 0,
    });
    const completed = await testHarness.app.executeQueued({
      runtime_run_id: request.runtime_run_id,
      worker_id: "worker-after-crash",
      expected_start_fence_generation:
        response.details.start_fence_generation,
      lease_seconds: 60,
      deadline_at: deadline,
    });
    expect(completed).toMatchObject({
      status: "completed",
      lease: {
        owner_id: "worker-after-crash",
        generation: 2,
        recovery_state: "active",
      },
    });
    expect(testHarness.dependencies.tools.invoke).not.toHaveBeenCalled();
  });

  it("rejects same-id artifact replay when kind, hash, size, media type, or retention drifts", async () => {
    const body = new Uint8Array([7, 8, 9]);
    const testHarness = harness([
      {
        kind: "artifact",
        artifact: {
          artifact_id: "artifact-drift",
          artifact_kind: "runtime-output",
          media_type: "application/octet-stream",
          body,
          expected_sha256: rawSha256(body),
          retention_until: "2026-08-23T04:00:00.000Z",
        },
      },
      {
        kind: "artifact",
        artifact: {
          artifact_id: "artifact-drift",
          artifact_kind: "runtime-output-different",
          media_type: "application/octet-stream",
          body,
          expected_sha256: rawSha256(body),
          retention_until: "2026-08-23T04:00:00.000Z",
        },
      },
    ]);

    await expect(startAndExecute(testHarness)).rejects.toMatchObject({
      code: "artifact_integrity_mismatch",
    });
    expect(
      testHarness.dependencies.object_store.putImmutable,
    ).toHaveBeenCalledTimes(1);
    expect(await testHarness.store.readRun("run-1")).toMatchObject({
      status: "failed",
      terminal_reason: "artifact_integrity_mismatch",
    });
  });

  it("terminalizes after a durably failed non-retryable final artifact", async () => {
    const body = new Uint8Array([7, 8, 9]);
    const testHarness = harness([
      {
        kind: "artifact",
        artifact: {
          artifact_id: "artifact-rejected",
          artifact_kind: "runtime-final-result",
          media_type: "text/plain",
          body,
          expected_sha256: rawSha256(body),
          retention_until: "2026-08-23T04:00:00.000Z",
        },
      },
    ]);
    testHarness.dependencies.object_store.putImmutable.mockRejectedValueOnce(
      new ObjectStoreErrorV1(
        "precondition_failed",
        "immutable object media type is invalid",
      ),
    );

    await expect(startAndExecute(testHarness)).rejects.toMatchObject({
      code: "artifact_integrity_mismatch",
    });
    const run = await testHarness.store.readRun("run-1");
    expect(run).toMatchObject({
      status: "failed",
      terminal_reason: "artifact_integrity_mismatch",
    });
    expect(run?.events.map(({ event_type }) => event_type)).toEqual(
      expect.arrayContaining([
        "runtime.artifact.failed",
        "runtime.run.failed",
      ]),
    );
    await expect(
      testHarness.store.readArtifact("run-1", "artifact-rejected"),
    ).resolves.toMatchObject({
      status: "failed",
    });
  });

  it("rejects a terminal artifact ref that has no committed available artifact event in this run", async () => {
    const testHarness = harness([
      {
        kind: "complete",
        terminal_artifact_ref: "object:foreign-runtime-artifact",
      },
    ]);

    await expect(startAndExecute(testHarness)).rejects.toMatchObject({
      code: "artifact_integrity_mismatch",
    });
    const run = await testHarness.store.readRun("run-1");
    expect(run).toMatchObject({
      status: "failed",
      terminal_reason: "artifact_integrity_mismatch",
    });
    expect(
      run?.events.some(
        ({ event_type }) =>
          event_type === "runtime.run.completed",
      ),
    ).toBe(false);
  });

  it("fails closed during preflight when the exact skill resolver returns another skill", async () => {
    const testHarness = harness([
      { kind: "skill_load", skill_key: "skill-a" },
    ]);
    const defaultResolve =
      testHarness.dependencies.skills.resolve.getMockImplementation()!;
    testHarness.dependencies.skills.resolve.mockImplementationOnce(
      async (request, signal) => {
        const response = await defaultResolve(request, signal);
        return {
          ...response,
          details: {
            ...response.details,
            resolved_skills: response.details.resolved_skills.map(
              (resolution) => ({
                ...resolution,
                skill_id: "skill:skill-b",
                skill_key: "skill-b",
                version_id: "version:skill-b:1",
              }),
            ),
          },
        };
      },
    );

    await expect(
      testHarness.app.start(principal, startRequest()),
    ).rejects.toMatchObject({
      code: "catalog_version_mismatch",
    });
    expect(testHarness.dependencies.skills.load).not.toHaveBeenCalled();
    expect(await testHarness.store.readRun("run-1")).toBeUndefined();
  });

  it("rejects a materialized skill whose package bytes do not match the frozen digest", async () => {
    const testHarness = harness([
      { kind: "skill_load", skill_key: "skill-a" },
    ]);
    testHarness.dependencies.skills.load.mockResolvedValue({
      bytes: new TextEncoder().encode("tampered package"),
      manifest_bytes: skillManifestBytes,
      media_type: "application/gzip",
      package_digest: skillPackageDigest,
      manifest_digest: skillManifestDigest,
      runtime_target: "filesystem_bundle.v1",
      source: "skill_registry",
      entry_paths: ["SKILL.md"],
      entries: [
        {
          path: "SKILL.md",
          mode: "0600",
          bytes: skillPackageBytes,
          sha256: skillPackageDigest,
        },
      ],
    });

    await expect(startAndExecute(testHarness)).rejects.toMatchObject({
      code: "skill_content_mismatch",
    });
    const run = await testHarness.store.readRun("run-1");
    expect(run?.status).toBe("failed");
    expect(
      run?.events.map(({ event_type }) => event_type),
    ).toEqual(
      expect.arrayContaining([
        "runtime.skill.load.failed",
        "runtime.run.failed",
      ]),
    );
    expect(
      run?.events.some(
        ({ event_type }) =>
          event_type === "runtime.skill.load.materialized",
      ),
    ).toBe(false);
  });

  it("rehashes artifact bytes before upload and never publishes a mismatched artifact", async () => {
    const body = new Uint8Array([7, 8, 9]);
    const testHarness = harness([
      {
        kind: "artifact",
        artifact: {
          artifact_id: "artifact-mismatch",
          artifact_kind: "runtime-output",
          media_type: "application/octet-stream",
          body,
          expected_sha256: rawSha256(new Uint8Array([9, 8, 7])),
          retention_until: "2026-08-23T04:00:00.000Z",
        },
      },
    ]);

    await expect(startAndExecute(testHarness)).rejects.toMatchObject({
      code: "artifact_integrity_mismatch",
    });
    expect(
      testHarness.dependencies.object_store.putImmutable,
    ).not.toHaveBeenCalled();
    expect(
      (await testHarness.store.readRun("run-1"))?.events.some(
        ({ event_type }) => event_type === "runtime.artifact.created",
      ),
    ).toBe(false);
  });

  it("does not publish a false artifact failure while ObjectStore reconciliation is required", async () => {
    const body = new Uint8Array([7, 8, 9]);
    const testHarness = harness([
      {
        kind: "artifact",
        artifact: {
          artifact_id: "artifact-reconcile",
          artifact_kind: "runtime-output",
          media_type: "application/octet-stream",
          body,
          expected_sha256: rawSha256(body),
          retention_until: "2026-08-23T04:00:00.000Z",
        },
      },
    ]);
    testHarness.dependencies.object_store.putImmutable.mockRejectedValueOnce(
      new ObjectStoreErrorV1(
        "storage_unavailable",
        "finalization outcome is ambiguous",
        true,
        { reconciliation_required: true },
      ),
    );

    await expect(startAndExecute(testHarness)).rejects.toMatchObject({
      code: "storage_unavailable",
      details: { reconciliation_required: true },
    });
    const run = await testHarness.store.readRun("run-1");
    expect(run?.status).toBe("running");
    expect(
      run?.events.some(
        ({ event_type }) => event_type === "runtime.artifact.failed",
      ),
    ).toBe(false);
    const pending = await testHarness.store.readArtifact(
      "run-1",
      "artifact-reconcile",
    );
    expect(pending).toMatchObject({
      status: "creating",
      content_hash: rawSha256(body),
      object_store_idempotency_key:
        "run-1:artifact:artifact-reconcile",
    });

    testHarness.dependencies.object_store.putImmutable.mockImplementation(
      async (request) => ({
        object_ref:
          `object:${request.idempotency_key}` as ObjectRefV1,
        version: "1",
        sha256: request.expected_sha256,
        size_bytes: request.size_bytes,
        media_type: request.media_type,
        retention_until: request.retention_until,
        replayed: true,
      }),
    );
    testHarness.advance(600_001);
    const restarted = createRuntimeExecutionApplicationV1(
      testHarness.dependencies,
      {
        now: testHarness.now,
        max_adapter_turns: 20,
        max_retry_attempts: 2,
      },
    );
    await expect(
      restarted.recoverPendingArtifacts({
        worker_id: "artifact-reconciler-1",
      }),
    ).resolves.toEqual({
      attempted: 1,
      available: 1,
      failed: 0,
      pending: 0,
    });
    expect(
      await testHarness.store.readArtifact(
        "run-1",
        "artifact-reconcile",
      ),
    ).toMatchObject({
      status: "available",
      artifact_ref:
        "object:run-1:artifact:artifact-reconcile",
    });
    expect(
      (await testHarness.store.readRun("run-1"))?.events.filter(
        ({ event_type }) =>
          event_type === "runtime.artifact.created",
      ),
    ).toHaveLength(1);
  });

  it("bounds an unresponsive provider call by the runtime deadline", async () => {
    const testHarness = harness();
    testHarness.dependencies.adapter.next.mockImplementation(
      () => new Promise(() => undefined),
    );
    const request = startRequest();
    const response = await testHarness.app.start(principal, request);
    const result = await testHarness.app.executeQueued({
      runtime_run_id: request.runtime_run_id,
      worker_id: "worker-1",
      expected_start_fence_generation:
        response.details.start_fence_generation,
      lease_seconds: 600,
      deadline_at: new Date(now.getTime() + 20).toISOString(),
    });

    expect(result).toMatchObject({
      status: "failed",
      terminal_reason: "deadline_exceeded",
    });
  });

  it("freezes an unresponsive tool at deadline because its side effect is unknown", async () => {
    const testHarness = harness([
      {
        kind: "tool_call",
        call: {
          tool_call_id: "tool-call-timeout",
          tool_name: "search",
          capability: "search.read",
          arguments: { query: "bounded" },
        },
      },
    ]);
    testHarness.dependencies.tools.invoke.mockImplementation(
      () => new Promise(() => undefined),
    );
    const request = startRequest();
    const response = await testHarness.app.start(principal, request);

    await expect(
      testHarness.app.executeQueued({
        runtime_run_id: request.runtime_run_id,
        worker_id: "worker-1",
        expected_start_fence_generation:
          response.details.start_fence_generation,
        lease_seconds: 600,
        deadline_at: new Date(now.getTime() + 20).toISOString(),
      }),
    ).rejects.toMatchObject({ code: "tool_side_effect_unknown" });
    expect(
      await testHarness.store.readRun(request.runtime_run_id),
    ).toMatchObject({
      status: "failed",
      frozen_side_effect: true,
      terminal_reason: "tool_side_effect_unknown",
    });
    expect(testHarness.dependencies.tools.invoke).toHaveBeenCalledTimes(1);
  });

  it("rechecks the owner lease after policy I/O before dispatching an external tool", async () => {
    const testHarness = harness([
      {
        kind: "tool_call",
        call: {
          tool_call_id: "tool-call-stale-before-dispatch",
          tool_name: "search",
          capability: "search.read",
          arguments: { query: "must stay fenced" },
        },
      },
    ]);
    let dispatchChecks = 0;
    let releaseDispatchCheck!: () => void;
    const dispatchCheckGate = new Promise<void>((resolve) => {
      releaseDispatchCheck = resolve;
    });
    let reachedDispatchCheck!: () => void;
    const dispatchCheckReached = new Promise<void>((resolve) => {
      reachedDispatchCheck = resolve;
    });
    testHarness.dependencies.policy_checkpoints.check.mockImplementation(
      async (request) => {
        if (
          request.checkpoint === "tool_dispatch" &&
          ++dispatchChecks === 2
        ) {
          reachedDispatchCheck();
          await dispatchCheckGate;
        }
        return {
          schema_version:
            "runtime_policy_checkpoint_result.v1" as const,
          checkpoint: request.checkpoint,
          runtime_run_id: request.runtime_run_id,
          policy_snapshot_id: request.policy_snapshot_id,
          status: "valid" as const,
          expected_security_revocation_epoch:
            request.expected_security_revocation_epoch,
          current_security_revocation_epoch:
            request.expected_security_revocation_epoch,
          checked_at: request.checked_at,
        };
      },
    );
    const request = startRequest();
    const response = await testHarness.app.start(principal, request);
    const execution = testHarness.app.executeQueued({
      runtime_run_id: request.runtime_run_id,
      worker_id: "worker-1",
      expected_start_fence_generation:
        response.details.start_fence_generation,
      lease_seconds: 1,
      deadline_at: deadline,
    });

    await dispatchCheckReached;
    testHarness.advance(1_000);
    const takeover = await testHarness.store.claimQueuedRun({
      runtime_run_id: request.runtime_run_id,
      worker_id: "worker-2",
      expected_start_fence_generation:
        response.details.start_fence_generation,
      lease_seconds: 600,
      now: testHarness.now(),
      before_running_validation: await beforeRunningValidationFact(
        testHarness.store,
        request.runtime_run_id,
      ),
    });
    releaseDispatchCheck();

    await expect(execution).rejects.toMatchObject({
      code: "stale_lease_generation",
    });
    expect(takeover.lease).toMatchObject({
      owner_id: "worker-2",
      generation: 2,
    });
    expect(testHarness.dependencies.tools.invoke).not.toHaveBeenCalled();
    expect(
      (await testHarness.store.readRun(request.runtime_run_id))?.tools,
    ).toEqual([
      expect.objectContaining({
        tool_invocation_id: "tool-call-stale-before-dispatch",
        status: "requested",
        side_effect_status: "none",
      }),
    ]);
  });

  it("rechecks the owner generation after the running marker commits and before tool I/O", async () => {
    let releaseRunningWriter!: () => void;
    const runningWriterGate = new Promise<void>((resolve) => {
      releaseRunningWriter = resolve;
    });
    let runningWriterCommitted!: () => void;
    const runningWriterCommitObserved = new Promise<void>((resolve) => {
      runningWriterCommitted = resolve;
    });
    const testHarness = harness(
      [
        {
          kind: "tool_call",
          call: {
            tool_call_id: "tool-call-takeover-after-running",
            tool_name: "search",
            capability: "search.read",
            arguments: { query: "fence after writer" },
          },
        },
      ],
      undefined,
      {
        afterMarkToolRunning: async () => {
          runningWriterCommitted();
          await runningWriterGate;
        },
      },
    );
    const request = startRequest();
    const response = await testHarness.app.start(principal, request);
    const execution = testHarness.app.executeQueued({
      runtime_run_id: request.runtime_run_id,
      worker_id: "worker-1",
      expected_start_fence_generation:
        response.details.start_fence_generation,
      lease_seconds: 1,
      deadline_at: deadline,
    });

    await runningWriterCommitObserved;
    testHarness.advance(1_000);
    const takeover = await testHarness.store.claimQueuedRun({
      runtime_run_id: request.runtime_run_id,
      worker_id: "worker-2",
      expected_start_fence_generation:
        response.details.start_fence_generation,
      lease_seconds: 600,
      now: testHarness.now(),
      before_running_validation: await beforeRunningValidationFact(
        testHarness.store,
        request.runtime_run_id,
      ),
    });
    releaseRunningWriter();

    await expect(execution).rejects.toMatchObject({
      code: "stale_lease_generation",
    });
    expect(takeover.lease).toMatchObject({
      owner_id: "worker-2",
      generation: 2,
    });
    expect(testHarness.dependencies.tools.invoke).not.toHaveBeenCalled();
  });

  it("reclaims only an expired running lease and advances the generation", async () => {
    const testHarness = harness();
    const request = startRequest();
    const response = await testHarness.app.start(principal, request);
    const first = await testHarness.store.claimQueuedRun({
      runtime_run_id: request.runtime_run_id,
      worker_id: "worker-1",
      expected_start_fence_generation:
        response.details.start_fence_generation,
      lease_seconds: 10,
      now: new Date(now),
      before_running_validation: await beforeRunningValidationFact(
        testHarness.store,
        request.runtime_run_id,
      ),
    });

    await expect(
      testHarness.store.claimQueuedRun({
        runtime_run_id: request.runtime_run_id,
        worker_id: "worker-2",
        expected_start_fence_generation:
          response.details.start_fence_generation,
        lease_seconds: 10,
        now: new Date(now.getTime() + 9_999),
        before_running_validation: await beforeRunningValidationFact(
          testHarness.store,
          request.runtime_run_id,
        ),
      }),
    ).rejects.toMatchObject({ code: "stale_lease_generation" });

    testHarness.advance(10_000);
    const reclaimed = await testHarness.store.claimQueuedRun({
      runtime_run_id: request.runtime_run_id,
      worker_id: "worker-2",
      expected_start_fence_generation:
        response.details.start_fence_generation,
      lease_seconds: 10,
      now: new Date(now.getTime() + 10_000),
      before_running_validation: await beforeRunningValidationFact(
        testHarness.store,
        request.runtime_run_id,
      ),
    });
    expect(reclaimed.lease).toMatchObject({
      owner_id: "worker-2",
      generation: first.lease!.generation + 1,
    });
  });

  it("freezes a running tool before control handling or a fresh SDK session can start after lease takeover", async () => {
    const testHarness = harness();
    const request = startRequest();
    const response = await testHarness.app.start(principal, request);
    const first = await testHarness.store.claimQueuedRun({
      runtime_run_id: request.runtime_run_id,
      worker_id: "worker-1",
      expected_start_fence_generation:
        response.details.start_fence_generation,
      lease_seconds: 10,
      now: new Date(now),
      before_running_validation: await beforeRunningValidationFact(
        testHarness.store,
        request.runtime_run_id,
      ),
    });
    const permission = (
      await testHarness.store.readRun(request.runtime_run_id)
    )!.permissions[0]!;
    await recordDirectRequestedTool(
      testHarness.store,
      request.runtime_run_id,
      first.lease!.generation,
      permission,
      "tool-takeover-running",
    );
    await testHarness.store.markToolRunning({
      runtime_run_id: request.runtime_run_id,
      lease_generation: first.lease!.generation,
      tool_invocation_id: "tool-takeover-running",
    });
    await testHarness.app.receiveControl(
      principal,
      cancelRequest(request, "signal-during-running-tool"),
    );
    testHarness.advance(10_000);

    await expect(
      testHarness.app.executeQueued({
        runtime_run_id: request.runtime_run_id,
        worker_id: "worker-2",
        expected_start_fence_generation:
          response.details.start_fence_generation,
        lease_seconds: 600,
        deadline_at: deadline,
      }),
    ).rejects.toMatchObject({ code: "tool_side_effect_unknown" });
    expect(testHarness.dependencies.adapter.start).not.toHaveBeenCalled();
    const frozen = await testHarness.store.readRun(
      request.runtime_run_id,
    );
    expect(frozen).toMatchObject({
      status: "failed",
      frozen_side_effect: true,
      terminal_reason: "tool_side_effect_unknown",
      tools: [
        {
          tool_invocation_id: "tool-takeover-running",
          status: "failed",
          side_effect_status: "unknown",
          result: {
            outcome: "failed",
            retryable: false,
            side_effect_status: "unknown",
            external_error_ref:
              "object:run-1:artifact:tool_result:tool-takeover-running",
          },
        },
      ],
      controls: [
        expect.objectContaining({
          status: "received",
        }),
      ],
    });
  });

  it("atomically cancels a requested-but-undispatched tool before safely restarting a taken-over SDK run", async () => {
    const testHarness = harness();
    const request = startRequest();
    const response = await testHarness.app.start(principal, request);
    const first = await testHarness.store.claimQueuedRun({
      runtime_run_id: request.runtime_run_id,
      worker_id: "worker-1",
      expected_start_fence_generation:
        response.details.start_fence_generation,
      lease_seconds: 10,
      now: new Date(now),
      before_running_validation: await beforeRunningValidationFact(
        testHarness.store,
        request.runtime_run_id,
      ),
    });
    const permission = (
      await testHarness.store.readRun(request.runtime_run_id)
    )!.permissions[0]!;
    await recordDirectRequestedTool(
      testHarness.store,
      request.runtime_run_id,
      first.lease!.generation,
      permission,
      "tool-takeover-requested",
    );
    testHarness.advance(10_000);

    const run = await testHarness.app.executeQueued({
      runtime_run_id: request.runtime_run_id,
      worker_id: "worker-2",
      expected_start_fence_generation:
        response.details.start_fence_generation,
      lease_seconds: 600,
      deadline_at: deadline,
    });
    expect(run.status).toBe("completed");
    expect(run.tools).toEqual([
      expect.objectContaining({
        tool_invocation_id: "tool-takeover-requested",
        status: "cancelled",
        side_effect_status: "none",
      }),
    ]);
    expect(
      run.events.some(
        ({ event_type }) =>
          event_type === "runtime.tool.cancelled",
      ),
    ).toBe(true);
    expect(testHarness.dependencies.adapter.start).toHaveBeenCalledTimes(1);
    expect(testHarness.dependencies.tools.invoke).not.toHaveBeenCalled();
  });

  it("fails closed instead of replaying a completed tool into a fresh non-persistent SDK session", async () => {
    const testHarness = harness();
    const request = startRequest();
    const response = await testHarness.app.start(principal, request);
    const first = await testHarness.store.claimQueuedRun({
      runtime_run_id: request.runtime_run_id,
      worker_id: "worker-1",
      expected_start_fence_generation:
        response.details.start_fence_generation,
      lease_seconds: 10,
      now: new Date(now),
      before_running_validation: await beforeRunningValidationFact(
        testHarness.store,
        request.runtime_run_id,
      ),
    });
    const generation = first.lease!.generation;
    const permission = (
      await testHarness.store.readRun(request.runtime_run_id)
    )!.permissions[0]!;
    const completedAudit = await recordDirectRequestedTool(
      testHarness.store,
      request.runtime_run_id,
      generation,
      permission,
      "tool-takeover-completed",
    );
    await testHarness.store.markToolRunning({
      runtime_run_id: request.runtime_run_id,
      lease_generation: generation,
      tool_invocation_id: "tool-takeover-completed",
    });
    const beforeCompleted = await testHarness.store.readRun(
      request.runtime_run_id,
    );
    if (beforeCompleted === undefined) throw new Error("runtime run is missing");
    const completedResult: RuntimeToolResultV1 = {
      outcome: "completed",
      retryable: false,
      side_effect_status: "produced",
      output: { committed: true },
      external_response_ref: "evidence:tool:completed",
    };
    await testHarness.store.recordToolResult({
      runtime_run_id: request.runtime_run_id,
      lease_generation: generation,
      tool_invocation_id: "tool-takeover-completed",
      output_ref: "artifact:tool-takeover-completed:result",
      result: completedResult,
      event: directToolEvent(
        beforeCompleted,
        completedAudit,
        "runtime.tool.completed",
        "completed",
        completedResult,
        "artifact:tool-takeover-completed:result",
      ),
    });
    testHarness.advance(10_000);

    const run = await testHarness.app.executeQueued({
      runtime_run_id: request.runtime_run_id,
      worker_id: "worker-2",
      expected_start_fence_generation:
        response.details.start_fence_generation,
      lease_seconds: 600,
      deadline_at: deadline,
    });
    expect(run).toMatchObject({
      status: "failed",
      terminal_reason: "adapter_session_not_resumable",
    });
    expect(testHarness.dependencies.adapter.start).not.toHaveBeenCalled();
    expect(testHarness.dependencies.tools.invoke).not.toHaveBeenCalled();
  });

  it("converges an unknown tool by strict original fence and evidence CAS, with exact replay only", async () => {
    const testHarness = harness(
      [
        {
          kind: "tool_call",
          call: {
            tool_call_id: "tool-reconcile-1",
            tool_name: "search",
            capability: "search.read",
            arguments: { query: "read-after-write" },
          },
        },
      ],
      {
        outcome: "failed",
        retryable: false,
        side_effect_status: "unknown",
        error: {
          code: "commit_unknown",
          message: "response disconnected after dispatch",
        },
      },
    );
    await expect(startAndExecute(testHarness)).rejects.toMatchObject({
      code: "tool_side_effect_unknown",
    });
    const unknown = await testHarness.store.readRun("run-1");
    const audit = unknown?.tools[0];
    if (audit === undefined) throw new Error("unknown audit missing");
    const reconciliation = {
      schema_version: "runtime_tool_reconciliation.v1" as const,
      runtime_run_id: "run-1",
      tool_invocation_id: audit.tool_invocation_id,
      expected_start_fence_generation:
        unknown.start_fence_generation,
      expected_invocation_lease_generation:
        audit.lease_generation,
      expected_request_hash: audit.request_hash,
      expected_downstream_idempotency_key:
        audit.downstream_idempotency_key,
      evidence_ref: "artifact:tool-reconciliation:1",
      result: {
        outcome: "completed" as const,
        retryable: false,
        side_effect_status: "produced" as const,
        output: { observed_committed: true },
      },
      idempotency_key: "run-1:tool:tool-reconcile-1:reconcile",
      trace_id: "trace-reconcile-1",
    };
    const authRequirements: unknown[] = [];
    const server = buildActionRuntimeApp(
      {
        logger: false,
        auth: {
          verifier: {
            async verify(_token, expected) {
              authRequirements.push(expected);
              return reconciliationCredential();
            },
          },
        },
      },
      { runtime_execution: testHarness.app },
    );
    const pathMismatch = await server.inject({
      method: "POST",
      url:
        "/internal/runtime/runs/run-other/tool-invocations/" +
        `${audit.tool_invocation_id}/reconcile`,
      headers: { authorization: "Bearer aaa.bbb.ccc" },
      payload: reconciliation,
    });
    expect(pathMismatch.statusCode).toBe(400);

    await expect(
      testHarness.app.reconcileUnknownTool(
        reconciliationPrincipal,
        {
          ...reconciliation,
          expected_invocation_lease_generation:
            audit.lease_generation + 1,
          idempotency_key:
            "run-1:tool:tool-reconcile-1:wrong-fence",
        },
      ),
    ).rejects.toMatchObject({ code: "idempotency_conflict" });
    const reconciled = await server.inject({
      method: "POST",
      url:
        `/internal/runtime/runs/run-1/tool-invocations/` +
        `${audit.tool_invocation_id}/reconcile`,
      headers: { authorization: "Bearer aaa.bbb.ccc" },
      payload: reconciliation,
    });
    expect(reconciled.statusCode, reconciled.body).toBe(200);
    expect(reconciled.json()).toMatchObject({
      runtime_run_id: "run-1",
      tool_invocation_id: "tool-reconcile-1",
      side_effect_status: "produced",
      outcome: "completed",
      evidence_ref: "artifact:tool-reconciliation:1",
      reconciled_at: at,
      replayed: false,
    });
    expect(authRequirements).toContainEqual({
      audience: "action_runtime",
      allowedCallers: ["action_runtime"],
      requiredCapabilities: ["runtime.tool.reconcile"],
    });
    await expect(
      testHarness.app.reconcileUnknownTool(
        reconciliationPrincipal,
        {
          ...reconciliation,
          trace_id: "trace-reconcile-retry",
        },
      ),
    ).resolves.toMatchObject({ replayed: true });
    await expect(
      testHarness.app.reconcileUnknownTool(
        reconciliationPrincipal,
        {
          ...reconciliation,
          evidence_ref: "artifact:conflicting-evidence",
        },
      ),
    ).rejects.toMatchObject({ code: "idempotency_conflict" });
    expect(await testHarness.store.readRun("run-1")).toMatchObject({
      frozen_side_effect: false,
      tools: [
        {
          status: "completed",
          side_effect_status: "produced",
          reconciled_at: at,
          reconciliation_evidence_ref:
            "artifact:tool-reconciliation:1",
          result: {
            external_response_ref:
              "artifact:tool-reconciliation:1",
          },
        },
      ],
    });
    await server.close();
  });

  it("observes a durable heartbeat instead of expiring a stale local lease snapshot", async () => {
    const testHarness = harness();
    testHarness.dependencies.adapter.next.mockImplementationOnce(async () => {
      testHarness.advance(590_000);
      await testHarness.app.heartbeat({
        runtime_run_id: "run-1",
        worker_id: "worker-1",
        lease_generation: 1,
        lease_seconds: 600,
      });
      testHarness.advance(20_000);
      return { kind: "checkpoint" };
    });

    const { run } = await startAndExecute(testHarness);
    expect(run.status).toBe("completed");
    expect(run.lease?.heartbeat_at).toBe(
      "2026-07-23T04:09:50.000Z",
    );
  });

  it("renews the durable run lease while the provider turn is still in flight", async () => {
    const testHarness = harness(
      undefined,
      undefined,
      { heartbeat_interval_ms: 1 },
    );
    testHarness.dependencies.adapter.next.mockImplementationOnce(
      async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 20));
        return { kind: "complete", terminal_artifact_ref: null } as const;
      },
    );

    const { run } = await startAndExecute(testHarness);

    expect(run.status).toBe("completed");
    expect(testHarness.store.heartbeat).toHaveBeenCalledWith(
      expect.objectContaining({
        runtime_run_id: "run-1",
        worker_id: "worker-1",
        lease_generation: 1,
        lease_seconds: 600,
      }),
    );
  });

  it("resolves only planned skills while allowed_skills remains an upper bound", async () => {
    const testHarness = harness();
    const request = {
      ...startRequest("run-planned-skills-only"),
      allowed_skills: ["skill-a", "skill-b"],
    };

    await expect(testHarness.app.start(principal, request)).resolves.toMatchObject({
      code: "runtime_queued",
    });
    expect(testHarness.dependencies.skills.resolve).toHaveBeenCalledTimes(1);
    expect(
      testHarness.dependencies.skills.resolve.mock.calls[0]?.[0].skills,
    ).toEqual([
      {
        name: "skill-a",
        version_constraint: "catalog_revision",
        required: true,
      },
    ]);
    expect(await testHarness.store.readRun(request.runtime_run_id)).toMatchObject({
      skill_resolutions: [{ skill_key: "skill-a" }],
    });
  });

  it("handles control only at a safe point and fences the old lease generation", async () => {
    let releaseTurn!: () => void;
    const waitForTurn = new Promise<void>((resolve) => {
      releaseTurn = resolve;
    });
    let enteredTurn!: () => void;
    const turnEntered = new Promise<void>((resolve) => {
      enteredTurn = resolve;
    });
    const testHarness = harness();
    testHarness.dependencies.adapter.cancel.mockRejectedValueOnce(
      new Error("provider cancellation failed after owner fence"),
    );
    testHarness.dependencies.adapter.next.mockImplementationOnce(async () => {
      enteredTurn();
      await waitForTurn;
      return { kind: "checkpoint" };
    });
    const request = startRequest();
    const response = await testHarness.app.start(principal, request);
    const execution = testHarness.app.executeQueued({
      runtime_run_id: request.runtime_run_id,
      worker_id: "worker-1",
      expected_start_fence_generation:
        response.details.start_fence_generation,
      lease_seconds: 600,
      deadline_at: deadline,
    });
    await turnEntered;
    const control = {
      schema_version: "runtime_cancel.v1",
      runtime_signal_id: "signal-1",
      runtime_run_id: request.runtime_run_id,
      trigger_process_id: request.trigger_process_id,
      start_attempt_no: request.start_attempt_no,
      preempt_token: request.preempt_token,
      reason_code: "user_cancelled",
      requested_at: at,
      idempotency_key: "run-1:control:signal-1",
      trace_id: request.trace_id,
    } as const;
    await testHarness.app.receiveControl(principal, control);
    releaseTurn();

    const run = await execution;
    expect(run.status).toBe("cancelled");
    expect(testHarness.dependencies.adapter.cancel).toHaveBeenCalledTimes(1);
    await expect(
      testHarness.app.receiveControl(principal, control),
    ).resolves.toEqual({ accepted: true, replayed: true });
    expect(
      run.events.map(({ event_type }) => event_type),
    ).toEqual(
      expect.arrayContaining([
        "runtime.control_signal.received",
        "runtime.control_signal.handled",
        "runtime.run.cancelled",
      ]),
    );
    await expect(
      testHarness.app.heartbeat({
        runtime_run_id: request.runtime_run_id,
        worker_id: "worker-1",
        lease_generation: 1,
        lease_seconds: 600,
      }),
    ).rejects.toMatchObject({ code: "stale_lease_generation" });
  });

  it("persists a pre-start control tombstone and prevents the later run from starting", async () => {
    const testHarness = harness();
    const request = startRequest();
    const control = {
      schema_version: "runtime_cancel.v1",
      runtime_signal_id: "signal-before-start",
      runtime_run_id: request.runtime_run_id,
      trigger_process_id: request.trigger_process_id,
      start_attempt_no: request.start_attempt_no,
      preempt_token: request.preempt_token,
      reason_code: "cancel_before_start",
      requested_at: at,
      idempotency_key: "run-1:control:before-start",
      trace_id: request.trace_id,
    } as const;

    await expect(
      testHarness.app.receiveControl(principal, control),
    ).resolves.toEqual({ accepted: true, replayed: false });
    await expect(
      testHarness.app.receiveControl(principal, {
        ...control,
        trace_id: "trace-before-start-retry",
      }),
    ).resolves.toEqual({ accepted: true, replayed: true });
    await expect(
      testHarness.app.start(principal, request),
    ).rejects.toMatchObject({ code: "runtime_cancelled" });
    expect(
      testHarness.dependencies.reservation.validate,
    ).toHaveBeenCalledTimes(1);
    expect(testHarness.dependencies.adapter.start).not.toHaveBeenCalled();
    expect(await testHarness.store.readRun(request.runtime_run_id)).toBeUndefined();
  });

  it("never exposes plaintext control credentials to either owner-store control path", async () => {
    const assertSanitized = (
      storeRequest: unknown,
      plaintextToken: string,
    ) => {
      expect(storeRequest).not.toHaveProperty("preempt_token");
      expect(storeRequest).toMatchObject({
        preempt_token_hash: rawSha256(
          Buffer.from(plaintextToken, "utf8"),
        ),
      });
      expect(JSON.stringify(storeRequest)).not.toContain(plaintextToken);
    };

    const tombstoneHarness = harness();
    const tombstoneRequest = startRequest("run-sanitized-tombstone");
    const receiveControlTombstone = vi.fn(
      tombstoneHarness.store.receiveControlTombstone,
    );
    const tombstoneApplication = createRuntimeExecutionApplicationV1(
      {
        ...tombstoneHarness.dependencies,
        store: Object.freeze({
          ...tombstoneHarness.store,
          receiveControlTombstone,
        }),
      },
      {
        now: tombstoneHarness.now,
        max_adapter_turns: 20,
        max_retry_attempts: 2,
      },
    );
    await tombstoneApplication.receiveControl(
      principal,
      cancelRequest(tombstoneRequest, "signal-sanitized-tombstone"),
    );
    assertSanitized(
      receiveControlTombstone.mock.calls[0]?.[1],
      tombstoneRequest.preempt_token,
    );

    const attachedHarness = harness();
    const attachedRequest = startRequest("run-sanitized-attached");
    const receiveControl = vi.fn(attachedHarness.store.receiveControl);
    const attachedApplication = createRuntimeExecutionApplicationV1(
      {
        ...attachedHarness.dependencies,
        store: Object.freeze({
          ...attachedHarness.store,
          receiveControl,
        }),
      },
      {
        now: attachedHarness.now,
        max_adapter_turns: 20,
        max_retry_attempts: 2,
      },
    );
    await attachedApplication.start(principal, attachedRequest);
    await attachedApplication.receiveControl(
      principal,
      cancelRequest(attachedRequest, "signal-sanitized-attached"),
    );
    assertSanitized(
      receiveControl.mock.calls[0]?.[0],
      attachedRequest.preempt_token,
    );
  });

  it("fails closed before persisting a control fence that would exceed the JSON safe-integer boundary", async () => {
    const testHarness = harness();
    testHarness.dependencies.control_tokens.verify.mockImplementation(
      async (_token, expected) => ({
        runtime_run_id: expected.runtime_run_id,
        trigger_process_id: expected.trigger_process_id,
        start_attempt_no: expected.start_attempt_no,
        start_fence_generation: Number.MAX_SAFE_INTEGER,
        ...expected.scope,
        control_valid_until: "2026-07-24T04:15:00.000Z",
      }),
    );
    const request = startRequest("run-safe-integer-boundary");

    await expect(
      testHarness.app.receiveControl(
        principal,
        cancelRequest(request, "signal-safe-integer-boundary"),
      ),
    ).rejects.toMatchObject({
      code: "numeric_boundary_exhausted",
    });
    await expect(
      testHarness.store.readRun(request.runtime_run_id),
    ).resolves.toBeUndefined();
    await expect(
      testHarness.app.recoverPendingCallbacks(),
    ).resolves.toEqual({ attempted: 0, sent: 0 });
    expect(testHarness.dependencies.callback.deliver).not.toHaveBeenCalled();
  });

  it("atomically fences Start when a pre-start control wins the final accept race", async () => {
    const testHarness = harness();
    const request = startRequest();
    let releaseAccept!: () => void;
    const acceptGate = new Promise<void>((resolve) => {
      releaseAccept = resolve;
    });
    let enteredAccept!: () => void;
    const acceptEntered = new Promise<void>((resolve) => {
      enteredAccept = resolve;
    });
    const baseStore = testHarness.store;
    const racingStore = Object.freeze({
      ...baseStore,
      async acceptStart(
        ...args: Parameters<typeof baseStore.acceptStart>
      ) {
        enteredAccept();
        await acceptGate;
        return baseStore.acceptStart(...args);
      },
    });
    const racingApplication = createRuntimeExecutionApplicationV1(
      {
        ...testHarness.dependencies,
        store: racingStore,
      },
      { now: () => now, max_adapter_turns: 20, max_retry_attempts: 2 },
    );
    const start = racingApplication.start(principal, request);
    await acceptEntered;
    const control = {
      schema_version: "runtime_cancel.v1",
      runtime_signal_id: "signal-during-start-accept",
      runtime_run_id: request.runtime_run_id,
      trigger_process_id: request.trigger_process_id,
      start_attempt_no: request.start_attempt_no,
      preempt_token: request.preempt_token,
      reason_code: "cancel_during_start",
      requested_at: at,
      idempotency_key: "run-1:control:during-start",
      trace_id: request.trace_id,
    } as const;
    await expect(
      racingApplication.receiveControl(principal, control),
    ).resolves.toEqual({ accepted: true, replayed: false });
    releaseAccept();

    await expect(start).rejects.toMatchObject({ code: "runtime_cancelled" });
    expect(await baseStore.readRun(request.runtime_run_id)).toBeUndefined();
    expect(testHarness.dependencies.adapter.start).not.toHaveBeenCalled();
  });

  it("atomically attaches control when Start wins after the no-run observation", async () => {
    const testHarness = harness();
    const request = startRequest();
    let releaseTombstone!: () => void;
    const tombstoneGate = new Promise<void>((resolve) => {
      releaseTombstone = resolve;
    });
    let enteredTombstone!: () => void;
    const tombstoneEntered = new Promise<void>((resolve) => {
      enteredTombstone = resolve;
    });
    const baseStore = testHarness.store;
    const racingStore = Object.freeze({
      ...baseStore,
      async receiveControlTombstone(
        ...args: Parameters<typeof baseStore.receiveControlTombstone>
      ) {
        enteredTombstone();
        await tombstoneGate;
        return baseStore.receiveControlTombstone(...args);
      },
    });
    const racingApplication = createRuntimeExecutionApplicationV1(
      {
        ...testHarness.dependencies,
        store: racingStore,
      },
      { now: () => now, max_adapter_turns: 20, max_retry_attempts: 2 },
    );

    const control = racingApplication.receiveControl(
      principal,
      cancelRequest(request, "signal-start-won"),
    );
    await tombstoneEntered;
    const start = await racingApplication.start(principal, request);
    releaseTombstone();

    await expect(control).resolves.toEqual({
      accepted: true,
      replayed: false,
    });
    expect(
      (await baseStore.readRun(request.runtime_run_id))?.controls,
    ).toHaveLength(1);
    const stopped = await racingApplication.executeQueued({
      runtime_run_id: request.runtime_run_id,
      worker_id: "worker-1",
      expected_start_fence_generation:
        start.details.start_fence_generation,
      lease_seconds: 600,
      deadline_at: deadline,
    });
    expect(stopped.status).toBe("cancelled");
    expect(testHarness.dependencies.adapter.start).not.toHaveBeenCalled();
  });

  it("repairs a committed control whose received event callback step crashed", async () => {
    const testHarness = harness();
    const request = startRequest();
    const response = await testHarness.app.start(principal, request);
    await testHarness.store.claimQueuedRun({
      runtime_run_id: request.runtime_run_id,
      worker_id: "worker-1",
      expected_start_fence_generation:
        response.details.start_fence_generation,
      lease_seconds: 600,
      now,
      before_running_validation: await beforeRunningValidationFact(
        testHarness.store,
        request.runtime_run_id,
      ),
    });
    const control = cancelRequest(request, "signal-repair-received");
    const { trace_id: _traceId, ...controlBusinessRequest } = control;
    await testHarness.store.receiveControl(
      storedCancelRequest(request, "signal-repair-received"),
      canonicalPayloadHashV1(controlBusinessRequest),
      "cancel",
      controlClaims(request),
    );
    expect(
      (await testHarness.store.readRun(request.runtime_run_id))?.events,
    ).toHaveLength(0);

    await expect(
      testHarness.app.receiveControl(principal, control),
    ).resolves.toEqual({ accepted: true, replayed: true });
    expect(
      (await testHarness.store.readRun(request.runtime_run_id))?.events.map(
        ({ event_type }) => event_type,
      ),
    ).toContain("runtime.control_signal.received");
  });

  it("durably acknowledges a new control after terminal state without rewriting terminal history", async () => {
    const testHarness = harness();
    const request = startRequest();
    const { response, run } = await startAndExecute(testHarness, request);
    const control = {
      schema_version: "runtime_cancel.v1",
      runtime_signal_id: "signal-late",
      runtime_run_id: request.runtime_run_id,
      trigger_process_id: request.trigger_process_id,
      start_attempt_no: request.start_attempt_no,
      preempt_token: request.preempt_token,
      reason_code: "late_cancel",
      requested_at: at,
      idempotency_key: "run-1:control:signal-late",
      trace_id: request.trace_id,
    } as const;

    await expect(
      testHarness.app.receiveControl(principal, control),
    ).resolves.toEqual({ accepted: true, replayed: false });
    expect(testHarness.dependencies.control_tokens.verify).toHaveBeenLastCalledWith(
      request.preempt_token,
      expect.objectContaining({ allow_expired_terminal_replay: true }),
    );
    await expect(
      testHarness.app.receiveControl(principal, control),
    ).resolves.toEqual({ accepted: true, replayed: true });
    const after = await testHarness.store.readRun(request.runtime_run_id);
    expect(after?.status).toBe("completed");
    expect(after?.terminal_reason).toBe(run.terminal_reason);
    expect(after?.controls).toEqual([
      expect.objectContaining({
        status: "handled",
        handled_status: "already_terminal",
      }),
    ]);
    expect(after?.events.slice(-2).map(({ event_type }) => event_type)).toEqual([
      "runtime.control_signal.received",
      "runtime.control_signal.handled",
    ]);
    expect(after?.outbox.slice(-2).map(({ status }) => status)).toEqual([
      "sent",
      "sent",
    ]);
    expect(after?.events).toHaveLength(response.details.start_attempt_no + 3);
  });

  it("admits a legacy raw preempt secret only for the exact terminal run", async () => {
    const testHarness = harness();
    const request = {
      ...startRequest("run-legacy-terminal-control"),
      preempt_token: "a".repeat(64),
    };
    await startAndExecute(testHarness, request);
    const control = cancelRequest(request, "signal-legacy-terminal-control");

    await expect(
      testHarness.app.receiveControl(principal, control),
    ).resolves.toEqual({ accepted: true, replayed: false });
    await expect(
      testHarness.app.receiveControl(principal, {
        ...control,
        runtime_signal_id: "signal-legacy-terminal-control-wrong-secret",
        preempt_token: "b".repeat(64),
      }),
    ).rejects.toMatchObject({ code: "control_token_invalid" });
    expect(
      (await testHarness.store.readRun(request.runtime_run_id))?.controls,
    ).toEqual([
      expect.objectContaining({ handled_status: "already_terminal" }),
    ]);
  });

  it("marks only an expired terminal control replay for the owner writer", async () => {
    const testHarness = harness();
    const request = startRequest("run-expired-terminal-control");
    await startAndExecute(testHarness, request);
    testHarness.advance(24 * 60 * 60 * 1_000 + 15 * 60 * 1_000 + 1);
    const requestedAt = new Date(now.getTime() + 24 * 60 * 60 * 1_000 + 15 * 60 * 1_000 + 1).toISOString();

    await expect(
      testHarness.app.receiveControl(
        principal,
        cancelRequest(
          request,
          "signal-expired-terminal-control",
          requestedAt,
        ),
      ),
    ).resolves.toEqual({ accepted: true, replayed: false });

    expect(testHarness.store.finalizeAlreadyTerminalControl).toHaveBeenCalledWith(
      expect.objectContaining({
        terminal_replay_compatibility: true,
        request: expect.objectContaining({ requested_at: requestedAt }),
      }),
    );
  });

  it("keeps expiry fail-closed when the target run is not terminal", async () => {
    const testHarness = harness();
    const request = startRequest("run-expired-active-control");
    testHarness.advance(24 * 60 * 60 * 1_000 + 15 * 60 * 1_000 + 1);

    await expect(
      testHarness.app.receiveControl(
        principal,
        cancelRequest(request, "signal-expired-active-control"),
      ),
    ).rejects.toMatchObject({ code: "control_expired" });
    expect(testHarness.dependencies.control_tokens.verify).toHaveBeenLastCalledWith(
      request.preempt_token,
      expect.objectContaining({ allow_expired_terminal_replay: false }),
    );
  });

  it("rejects writes after a terminal event even with the last known generation", async () => {
    const testHarness = harness();
    const { run } = await startAndExecute(testHarness);
    expect(run.status).toBe("completed");

    await expect(
      testHarness.store.appendEvent({
        runtime_run_id: run.request.runtime_run_id,
        lease_generation: run.lease!.generation,
        event: run.events[0]!,
      }),
    ).resolves.toMatchObject({ status: "completed" });

    await expect(
      testHarness.store.appendEvent({
        runtime_run_id: run.request.runtime_run_id,
        lease_generation: run.lease!.generation,
        event: {
          ...run.events[0]!,
          event_id: "late-event",
          idempotency_key: "late-event",
        },
      }),
    ).rejects.toMatchObject({ code: "stale_lease_generation" });
    await expect(
      testHarness.app.heartbeat({
        runtime_run_id: run.request.runtime_run_id,
        worker_id: "worker-1",
        lease_generation: run.lease!.generation,
        lease_seconds: 600,
      }),
    ).rejects.toMatchObject({ code: "stale_lease_generation" });
  });
});
