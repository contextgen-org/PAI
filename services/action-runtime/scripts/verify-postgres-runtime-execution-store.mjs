import { createHash } from "node:crypto";

import { canonicalPayloadHashV1 } from "@pai/eventing";
import { openVerifiedOwnerPostgresCompositionV1 } from "@pai/persistence";
import pg from "pg";

import { ACTION_RUNTIME_REPOSITORY_CONTRACT_V1 } from "../dist/db/permission-manifest.v1.js";
import { createPostgresRuntimeExecutionStoreV1 } from "../dist/db/postgres-runtime-execution-store.v1.js";

const databaseUrl = process.env.PAI_VALIDATION_DATABASE_URL;
const adminDatabaseUrl = process.env.PAI_VALIDATION_ADMIN_DATABASE_URL;
if (databaseUrl === undefined || adminDatabaseUrl === undefined) {
  throw new Error(
    "PAI_VALIDATION_DATABASE_URL and PAI_VALIDATION_ADMIN_DATABASE_URL are required",
  );
}

const sha256 = (value) =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
const now = new Date();
const createdAt = now.toISOString();
const expiresAt = new Date(now.getTime() + 3_600_000).toISOString();
const runtimeRunId = `runtime-store-live-${now.getTime()}`;
const triggerProcessId = `process-store-live-${now.getTime()}`;
const scope = Object.freeze({
  workspace_id: "workspace-live",
  bot_id: "bot-live",
  owner_agent_id: "agent-live",
  deployment_environment: "local",
  release_channel: "stable",
});
const intentPolicySnapshot = {
  schema_version: "intent_policy_input_snapshot.v1",
  snapshot_ref: `intent-policy:${runtimeRunId}`,
  ...scope,
  bot_policy_revision_id: "bot-policy:live",
  personality_ref: "personality:live",
  personality_version: 1,
  personality_hash: `sha256:${"b".repeat(64)}`,
  safety_boundaries_ref: "safety:live",
  safety_boundaries_version: 1,
  safety_boundaries_hash: `sha256:${"c".repeat(64)}`,
  tool_permission_profile_ref: "tool-profile:live",
  tool_permission_profile_revision: 1,
  tool_permission_profile_hash: `sha256:${"a".repeat(64)}`,
  tool_policy_epoch: 1,
  catalog_version: "catalog-live",
  catalog_as_of: createdAt,
  security_revocation_epoch: 1,
  skill_permission_summary_ref: "skill-summary:live",
  skill_permission_summary_hash: `sha256:${"d".repeat(64)}`,
};
intentPolicySnapshot.snapshot_hash = canonicalPayloadHashV1(
  intentPolicySnapshot,
);
const policy = Object.freeze({
  schema_version: "runtime_policy_input.v1",
  intent_policy_snapshot_ref: intentPolicySnapshot.snapshot_ref,
  intent_policy_snapshot_hash: intentPolicySnapshot.snapshot_hash,
  created_at: createdAt,
  expires_at: expiresAt,
});
const request = Object.freeze({
  schema_version: "runtime_start.v1.2",
  trigger_process_id: triggerProcessId,
  runtime_run_id: runtimeRunId,
  ...scope,
  start_attempt_no: 1,
  intent_ref: `intent:${triggerProcessId}:1`,
  intent_version: 1,
  structured_intent_hash: `sha256:${"e".repeat(64)}`,
  structured_intent: { goal: "verify the PostgreSQL Runtime execution store" },
  context_snapshot_ref: `context:${triggerProcessId}:1`,
  context_snapshot_version: 1,
  context_snapshot_hash: `sha256:${"f".repeat(64)}`,
  intent_policy_snapshot_ref: intentPolicySnapshot.snapshot_ref,
  intent_policy_snapshot_hash: intentPolicySnapshot.snapshot_hash,
  intent_policy_snapshot: intentPolicySnapshot,
  expected_catalog_version: "catalog-live",
  catalog_as_of: createdAt,
  allowed_tools: ["search"],
  allowed_skills: [],
  planned_skills: [],
  policy_input_ref: `policy-input:${runtimeRunId}:1`,
  policy_input_hash: canonicalPayloadHashV1(policy),
  policy,
  confirmation_ref: null,
  confirmation_hash: null,
  idempotency_key: `${triggerProcessId}:start:1`,
  trace_id: `trace:${runtimeRunId}`,
  start_fence_token_hash: sha256(`fence:${runtimeRunId}`),
  preempt_token_hash: sha256(`preempt:${runtimeRunId}`),
});
const actorBinding = Object.freeze({
  workload_service: "trigger_processor",
  scope,
  delegated_principal: null,
  delegated_principal_hash: null,
});
const actorBindingHash = canonicalPayloadHashV1(actorBinding);
const requestHash = canonicalPayloadHashV1(request);

async function seedToolPermissionProfile() {
  const pool = new pg.Pool({ connectionString: adminDatabaseUrl, max: 1 });
  try {
    const result = await pool.query(
      `INSERT INTO action_runtime.tool_permission_profile_revisions(
         profile_ref, workspace_id, bot_id, owner_agent_id,
         deployment_environment, release_channel, revision,
         allowed_tools, tool_arg_constraints, resource_scopes,
         network_scope, filesystem_scope, timer_scope, memory_scope,
         policy_epoch, profile_hash, effective_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7,
         $8::text[], $9::jsonb, '{}'::jsonb,
         '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
         $10, $11, $12::timestamptz
       )
       ON CONFLICT (profile_ref) DO NOTHING
       RETURNING profile_ref`,
      [
        intentPolicySnapshot.tool_permission_profile_ref,
        scope.workspace_id,
        scope.bot_id,
        scope.owner_agent_id,
        scope.deployment_environment,
        scope.release_channel,
        intentPolicySnapshot.tool_permission_profile_revision,
        request.allowed_tools,
        JSON.stringify({ search: { max_bytes: 2_097_152 } }),
        intentPolicySnapshot.tool_policy_epoch,
        intentPolicySnapshot.tool_permission_profile_hash,
        createdAt,
      ],
    );
    const selected = await pool.query(
      `SELECT workspace_id, bot_id, owner_agent_id,
              deployment_environment, release_channel,
              revision::text, allowed_tools, tool_arg_constraints,
              policy_epoch::text, profile_hash
         FROM action_runtime.tool_permission_profile_revisions
        WHERE profile_ref = $1`,
      [intentPolicySnapshot.tool_permission_profile_ref],
    );
    const profile = selected.rows[0];
    if (
      selected.rows.length !== 1 ||
      profile.workspace_id !== scope.workspace_id ||
      profile.bot_id !== scope.bot_id ||
      profile.owner_agent_id !== scope.owner_agent_id ||
      profile.deployment_environment !== scope.deployment_environment ||
      profile.release_channel !== scope.release_channel ||
      profile.revision !==
        String(intentPolicySnapshot.tool_permission_profile_revision) ||
      profile.policy_epoch !== String(intentPolicySnapshot.tool_policy_epoch) ||
      profile.profile_hash !==
        intentPolicySnapshot.tool_permission_profile_hash ||
      canonicalPayloadHashV1(profile.allowed_tools) !==
        canonicalPayloadHashV1(request.allowed_tools) ||
      canonicalPayloadHashV1(profile.tool_arg_constraints) !==
        canonicalPayloadHashV1({ search: { max_bytes: 2_097_152 } })
    ) {
      throw new Error(
        result.rowCount === 0
          ? "Action Runtime verifier tool permission profile identity conflicts with an existing row"
          : "Action Runtime verifier tool permission profile seed drifted",
      );
    }
  } finally {
    await pool.end();
  }
}

await seedToolPermissionProfile();

const validationCall = (stage, suffix, requestedAt) =>
  Object.freeze({
    validation_call_id: `validation:${runtimeRunId}:${suffix}`,
    validation_stage: stage,
    request_hash: canonicalPayloadHashV1({ runtimeRunId, stage, suffix }),
    trace_id: request.trace_id,
    requested_at: requestedAt,
  });
const validationFact = (stage, call, validatedAt) => {
  const response = Object.freeze({
    schema_version: "runtime_start_reservation_validate_response.v1",
    validation_result: "valid",
    reservation_status:
      stage === "request_received"
        ? "reserved"
        : stage === "preflight_completed"
          ? "dispatching"
          : "queued",
    validated_fence_generation: 7,
    validation_stage: stage,
    duplicate_replayed: false,
    trace_id: request.trace_id,
  });
  return Object.freeze({
    validation_call_id: call.validation_call_id,
    validation_stage: stage,
    validation_result: "valid",
    response_source: "trigger_processor",
    response_schema_version: response.schema_version,
    request_hash: call.request_hash,
    start_fence_token_hash: request.start_fence_token_hash,
    response_hash: canonicalPayloadHashV1(response),
    response,
    validated_at: validatedAt,
  });
};

const toolEvent = ({
  run,
  audit,
  eventType,
  status,
  sequenceNo,
  outputRef = null,
  result,
}) => Object.freeze({
  event_id: `${run.request.runtime_run_id}:${sequenceNo}:${eventType}:${audit.tool_invocation_id}`,
  event_type: eventType,
  schema_version: "runtime_event.v1",
  producer: "action_runtime",
  occurred_at: new Date().toISOString(),
  idempotency_key: `${run.request.runtime_run_id}:tool:${audit.tool_invocation_id}:${status}`,
  trace_id: run.request.trace_id,
  payload: {
    trigger_process_id: run.request.trigger_process_id,
    runtime_run_id: run.request.runtime_run_id,
    workspace_id: run.request.workspace_id,
    bot_id: run.request.bot_id,
    owner_agent_id: run.request.owner_agent_id,
    deployment_environment: run.request.deployment_environment,
    release_channel: run.request.release_channel,
    sequence_no: sequenceNo,
    start_attempt_no: run.request.start_attempt_no,
    start_fence_generation: run.start_fence_generation,
    tool_invocation_id: audit.tool_invocation_id,
    tool_name: audit.tool_name,
    status,
    policy_snapshot_id: run.response.details.policy_snapshot_id,
    capability_token_id: audit.capability_token_id,
    input_ref: audit.input_ref,
    output_ref: outputRef,
    side_effect_status:
      status === "cancelled"
        ? "none"
        : (result?.side_effect_status ?? audit.side_effect_status),
    downstream_idempotency_key: audit.downstream_idempotency_key,
    external_response_ref:
      status === "completed" ? (result?.external_response_ref ?? null) : null,
    external_error_ref:
      status === "failed" ? (result?.external_error_ref ?? null) : null,
    duplicate_replayed: false,
    error:
      status === "failed"
        ? {
            failure_class:
              result?.side_effect_status === "unknown"
                ? "external_outcome_unknown"
                : "tool_execution_failed",
            code:
              result?.side_effect_status === "unknown"
                ? "external_outcome_unknown"
                : "tool_execution_failed",
            message: "Tool execution failed; inspect the durable tool-result artifact",
            retryable: result?.retryable ?? false,
          }
        : null,
    duration_ms: null,
    reason_code:
      status === "failed"
        ? result?.side_effect_status === "unknown"
          ? "external_outcome_unknown"
          : "tool_execution_failed"
        : null,
    error_summary:
      status === "failed"
        ? "Tool execution failed; inspect the durable tool-result artifact"
        : null,
    artifact_ref: outputRef,
  },
});

async function createRunningProofRun(
  store,
  label,
  { leaseSeconds = 30 } = {},
) {
  const proofNow = new Date();
  const proofCreatedAt = proofNow.toISOString();
  const proofExpiresAt = new Date(proofNow.getTime() + 3_600_000).toISOString();
  const proofRunId = `runtime-store-${label}-${proofNow.getTime()}`;
  const proofProcessId = `process-store-${label}-${proofNow.getTime()}`;
  const proofIntentSnapshot = {
    ...intentPolicySnapshot,
    snapshot_ref: `intent-policy:${proofRunId}`,
    catalog_as_of: proofCreatedAt,
  };
  proofIntentSnapshot.snapshot_hash = canonicalPayloadHashV1(
    proofIntentSnapshot,
  );
  const proofPolicy = Object.freeze({
    ...policy,
    intent_policy_snapshot_ref: proofIntentSnapshot.snapshot_ref,
    intent_policy_snapshot_hash: proofIntentSnapshot.snapshot_hash,
    created_at: proofCreatedAt,
    expires_at: proofExpiresAt,
  });
  const proofRequest = Object.freeze({
    ...request,
    trigger_process_id: proofProcessId,
    runtime_run_id: proofRunId,
    intent_ref: `intent:${proofProcessId}:1`,
    context_snapshot_ref: `context:${proofProcessId}:1`,
    intent_policy_snapshot_ref: proofIntentSnapshot.snapshot_ref,
    intent_policy_snapshot_hash: proofIntentSnapshot.snapshot_hash,
    intent_policy_snapshot: proofIntentSnapshot,
    catalog_as_of: proofCreatedAt,
    policy_input_ref: `policy-input:${proofRunId}:1`,
    policy_input_hash: canonicalPayloadHashV1(proofPolicy),
    policy: proofPolicy,
    idempotency_key: `${proofProcessId}:start:1`,
    trace_id: `trace:${proofRunId}`,
    start_fence_token_hash: sha256(`fence:${proofRunId}`),
    preempt_token_hash: sha256(`preempt:${proofRunId}`),
  });
  const proofRequestHash = canonicalPayloadHashV1(proofRequest);
  const proofActorBinding = Object.freeze({
    ...actorBinding,
    scope,
  });
  const proofActorBindingHash = canonicalPayloadHashV1(proofActorBinding);
  const call = (stage, suffix, at) => Object.freeze({
    validation_call_id: `validation:${proofRunId}:${suffix}`,
    validation_stage: stage,
    request_hash: canonicalPayloadHashV1({ proofRunId, stage, suffix }),
    trace_id: proofRequest.trace_id,
    requested_at: at,
  });
  const fact = (stage, validationCall, at) => {
    const response = Object.freeze({
      schema_version: "runtime_start_reservation_validate_response.v1",
      validation_result: "valid",
      reservation_status:
        stage === "request_received"
          ? "reserved"
          : stage === "preflight_completed"
            ? "dispatching"
            : "queued",
      validated_fence_generation: 7,
      validation_stage: stage,
      duplicate_replayed: false,
      trace_id: proofRequest.trace_id,
    });
    return Object.freeze({
      validation_call_id: validationCall.validation_call_id,
      validation_stage: stage,
      validation_result: "valid",
      response_source: "trigger_processor",
      response_schema_version: response.schema_version,
      request_hash: validationCall.request_hash,
      start_fence_token_hash: proofRequest.start_fence_token_hash,
      response_hash: canonicalPayloadHashV1(response),
      response,
      validated_at: at,
    });
  };
  await store.beginStartAttempt(
    proofRequest,
    proofRequestHash,
    proofActorBinding,
    proofActorBindingHash,
    proofCreatedAt,
  );
  const receivedCall = call("request_received", "request", proofCreatedAt);
  await store.beginStartValidationCall({
    runtime_run_id: proofRunId,
    request_hash: proofRequestHash,
    start_fence_token_hash: proofRequest.start_fence_token_hash,
    actor_binding_hash: proofActorBindingHash,
    call: receivedCall,
  });
  await store.appendStartValidation({
    runtime_run_id: proofRunId,
    request_hash: proofRequestHash,
    start_fence_token_hash: proofRequest.start_fence_token_hash,
    actor_binding_hash: proofActorBindingHash,
    fact: fact("request_received", receivedCall, proofCreatedAt),
  });
  const preflightAt = new Date(proofNow.getTime() + 1).toISOString();
  const preflightCall = call("preflight_completed", "preflight", preflightAt);
  await store.beginStartValidationCall({
    runtime_run_id: proofRunId,
    request_hash: proofRequestHash,
    start_fence_token_hash: proofRequest.start_fence_token_hash,
    actor_binding_hash: proofActorBindingHash,
    call: preflightCall,
  });
  const proofResponse = Object.freeze({
    code: "runtime_queued",
    message: "queued",
    retryable: false,
    details: {
      status: "queued",
      runtime_run_id: proofRunId,
      start_attempt_no: 1,
      start_fence_generation: 7,
      policy_snapshot_id: `policy-snapshot:${proofRunId}`,
      policy_snapshot_hash: sha256(`policy-snapshot:${proofRunId}`),
      requested_catalog_version: "catalog-live",
      effective_catalog_version: "catalog-live",
      catalog_as_of: proofCreatedAt,
    },
    trace_id: proofRequest.trace_id,
  });
  await store.acceptStart(
    proofRequest,
    proofRequestHash,
    proofActorBinding,
    proofActorBindingHash,
    proofResponse,
    [],
    {},
    [],
    "claude-test",
    fact("preflight_completed", preflightCall, preflightAt),
  );
  const beforeAt = new Date(proofNow.getTime() + 2).toISOString();
  const beforeCall = call("before_running", "before", beforeAt);
  await store.beginStartValidationCall({
    runtime_run_id: proofRunId,
    request_hash: proofRequestHash,
    start_fence_token_hash: proofRequest.start_fence_token_hash,
    actor_binding_hash: proofActorBindingHash,
    call: beforeCall,
  });
  const run = await store.claimQueuedRun({
    runtime_run_id: proofRunId,
    worker_id: `worker-${label}`,
    expected_start_fence_generation: 7,
    lease_seconds: leaseSeconds,
    now: new Date(beforeAt),
    before_running_validation: fact("before_running", beforeCall, beforeAt),
  });
  return Object.freeze({ run, request: proofRequest });
}

const composition = await openVerifiedOwnerPostgresCompositionV1(
  ACTION_RUNTIME_REPOSITORY_CONTRACT_V1,
  databaseUrl,
);
try {
  const store = createPostgresRuntimeExecutionStoreV1(composition);
  const begun = await store.beginStartAttempt(
    request,
    requestHash,
    actorBinding,
    actorBindingHash,
    createdAt,
  );
  const requestCall = validationCall(
    "request_received",
    "request",
    createdAt,
  );
  await store.beginStartValidationCall({
    runtime_run_id: runtimeRunId,
    request_hash: requestHash,
    start_fence_token_hash: request.start_fence_token_hash,
    actor_binding_hash: actorBindingHash,
    call: requestCall,
  });
  await store.appendStartValidation({
    runtime_run_id: runtimeRunId,
    request_hash: requestHash,
    start_fence_token_hash: request.start_fence_token_hash,
    actor_binding_hash: actorBindingHash,
    fact: validationFact("request_received", requestCall, createdAt),
  });
  const preflightAt = new Date(now.getTime() + 1_000).toISOString();
  const preflightCall = validationCall(
    "preflight_completed",
    "preflight",
    preflightAt,
  );
  await store.beginStartValidationCall({
    runtime_run_id: runtimeRunId,
    request_hash: requestHash,
    start_fence_token_hash: request.start_fence_token_hash,
    actor_binding_hash: actorBindingHash,
    call: preflightCall,
  });
  const response = Object.freeze({
    code: "runtime_queued",
    message: "queued",
    retryable: false,
    details: {
      status: "queued",
      runtime_run_id: runtimeRunId,
      start_attempt_no: 1,
      start_fence_generation: 7,
      policy_snapshot_id: `policy-snapshot:${runtimeRunId}`,
      policy_snapshot_hash: sha256(`policy-snapshot:${runtimeRunId}`),
      requested_catalog_version: "catalog-live",
      effective_catalog_version: "catalog-live",
      catalog_as_of: createdAt,
    },
    trace_id: request.trace_id,
  });
  const frozenToolConstraints = Object.freeze({
    search: Object.freeze({ max_bytes: 4_096 }),
  });
  const accepted = await store.acceptStart(
    request,
    requestHash,
    actorBinding,
    actorBindingHash,
    response,
    [],
    frozenToolConstraints,
    [
      {
        id: `permission:${runtimeRunId}`,
        runtime_run_id: runtimeRunId,
        policy_snapshot_id: response.details.policy_snapshot_id,
        capability: "search.execute",
        actor_binding_hash: actorBindingHash,
        scope: { tool_name: "search" },
        expires_at: expiresAt,
        created_at: preflightAt,
      },
    ],
    "claude-test",
    validationFact("preflight_completed", preflightCall, preflightAt),
  );
  const persistedPolicy = await composition.postgres.query(
    `SELECT tool_arg_constraints
       FROM action_runtime.runtime_policy_snapshots
      WHERE runtime_run_id = $1::text`,
    [runtimeRunId],
  );
  const beforeRunningAt = new Date(now.getTime() + 2_000).toISOString();
  const beforeRunningCall = validationCall(
    "before_running",
    "before-running",
    beforeRunningAt,
  );
  await store.beginStartValidationCall({
    runtime_run_id: runtimeRunId,
    request_hash: requestHash,
    start_fence_token_hash: request.start_fence_token_hash,
    actor_binding_hash: actorBindingHash,
    call: beforeRunningCall,
  });
  const claimed = await store.claimQueuedRun({
    runtime_run_id: runtimeRunId,
    worker_id: "worker-live",
    expected_start_fence_generation: 7,
    lease_seconds: 30,
    now: new Date(beforeRunningAt),
    before_running_validation: validationFact(
      "before_running",
      beforeRunningCall,
      beforeRunningAt,
    ),
  });
  const policyArtifact = await store.readPolicyInputArtifact(runtimeRunId, 1);
  const artifactBody = Buffer.from("runtime artifact live proof", "utf8");
  const artifactId = `artifact:${runtimeRunId}`;
  const artifactRetention = new Date(
    Date.now() + 30 * 60_000,
  ).toISOString();
  const artifactRequest = Object.freeze({
    artifact_id: artifactId,
    artifact_kind: "runtime-proof",
    media_type: "text/plain",
    body: artifactBody,
    expected_sha256: sha256(artifactBody),
    retention_until: artifactRetention,
  });
  const objectStoreIdempotencyKey = `${runtimeRunId}:artifact:${artifactId}`;
  const artifactRequestHash = canonicalPayloadHashV1({
    runtime_run_id: runtimeRunId,
    start_attempt_no: 1,
    start_fence_generation: 7,
    artifact_id: artifactId,
    artifact_kind: artifactRequest.artifact_kind,
    media_type: artifactRequest.media_type,
    content_hash: artifactRequest.expected_sha256,
    size_bytes: artifactBody.byteLength,
    retention_until: artifactRetention,
    object_store_idempotency_key: objectStoreIdempotencyKey,
  });
  const reservedArtifact = await store.reserveArtifact({
    runtime_run_id: runtimeRunId,
    expected_start_fence_generation: 7,
    lease_generation: 1,
    artifact: artifactRequest,
    object_store_idempotency_key: objectStoreIdempotencyKey,
    request_hash: artifactRequestHash,
    created_at: new Date().toISOString(),
  });
  const artifactEvent = Object.freeze({
    event_id: `${runtimeRunId}:2:runtime.artifact.created:${artifactId}`,
    event_type: "runtime.artifact.created",
    schema_version: "runtime_event.v1",
    producer: "action_runtime",
    occurred_at: new Date().toISOString(),
    idempotency_key: `${runtimeRunId}:artifact:${artifactId}:available`,
    trace_id: request.trace_id,
    payload: {
      trigger_process_id: triggerProcessId,
      runtime_run_id: runtimeRunId,
      ...scope,
      sequence_no: 2,
      start_attempt_no: 1,
      start_fence_generation: 7,
      artifact_id: artifactId,
      artifact_ref: `object:${artifactId}`,
      artifact_kind: artifactRequest.artifact_kind,
      content_hash: artifactRequest.expected_sha256,
      size_bytes: artifactBody.byteLength,
      media_type: artifactRequest.media_type,
      retention_until: artifactRetention,
      status: "available",
      artifact_status: "available",
      redaction_status: "complete",
      error: null,
      reason_code: null,
      error_summary: null,
    },
  });
  const finalizedRun = await store.finalizeArtifact({
    runtime_run_id: runtimeRunId,
    artifact_id: artifactId,
    expected_start_fence_generation: 7,
    expected_status: "creating",
    lease_generation: 1,
    terminal_status: "available",
    artifact_ref: `object:${artifactId}`,
    event: artifactEvent,
    request_hash: artifactRequestHash,
    finalized_at: artifactEvent.occurred_at,
  });
  const finalizedArtifact = await store.readArtifact(runtimeRunId, artifactId);
  const artifactRecoveryProof = await createRunningProofRun(
    store,
    "artifact-recovery",
    { leaseSeconds: 1 },
  );
  const recoveryRunId = artifactRecoveryProof.run.request.runtime_run_id;
  const recoveryArtifactBody = Buffer.from(
    "runtime artifact reconciliation proof",
    "utf8",
  );
  const recoveryArtifactId = `artifact:${recoveryRunId}`;
  const recoveryRetention = new Date(
    Date.now() + 30 * 60_000,
  ).toISOString();
  const recoveryArtifactRequest = Object.freeze({
    artifact_id: recoveryArtifactId,
    artifact_kind: "runtime-reconciliation-proof",
    media_type: "text/plain",
    body: recoveryArtifactBody,
    expected_sha256: sha256(recoveryArtifactBody),
    retention_until: recoveryRetention,
  });
  const recoveryObjectStoreKey =
    `${recoveryRunId}:artifact:${recoveryArtifactId}`;
  const recoveryRequestHash = canonicalPayloadHashV1({
    runtime_run_id: recoveryRunId,
    start_attempt_no: 1,
    start_fence_generation: 7,
    artifact_id: recoveryArtifactId,
    artifact_kind: recoveryArtifactRequest.artifact_kind,
    media_type: recoveryArtifactRequest.media_type,
    content_hash: recoveryArtifactRequest.expected_sha256,
    size_bytes: recoveryArtifactBody.byteLength,
    retention_until: recoveryRetention,
    object_store_idempotency_key: recoveryObjectStoreKey,
  });
  await store.reserveArtifact({
    runtime_run_id: recoveryRunId,
    expected_start_fence_generation: 7,
    lease_generation: 1,
    artifact: recoveryArtifactRequest,
    object_store_idempotency_key: recoveryObjectStoreKey,
    request_hash: recoveryRequestHash,
    created_at: new Date().toISOString(),
  });
  await new Promise((resolve) => setTimeout(resolve, 1_100));
  const recoveryWorker = `artifact-recovery-worker:${recoveryRunId}`;
  const recoveryClaims = await store.claimPendingArtifacts({
    worker_id: recoveryWorker,
    limit: 16,
    lease_seconds: 30,
    now: new Date().toISOString(),
  });
  const recoveryClaim = recoveryClaims.find(
    ({ runtime_run_id, artifact_id }) =>
      runtime_run_id === recoveryRunId && artifact_id === recoveryArtifactId,
  );
  if (recoveryClaim === undefined) {
    throw new Error("PostgreSQL Runtime artifact recovery claim returned no row");
  }
  const recoveryArtifactRef = `object:${recoveryArtifactId}`;
  const recoveryEvent = Object.freeze({
    event_id:
      `${recoveryRunId}:2:runtime.artifact.created:${recoveryArtifactId}`,
    event_type: "runtime.artifact.created",
    schema_version: "runtime_event.v1",
    producer: "action_runtime",
    occurred_at: new Date().toISOString(),
    idempotency_key:
      `${recoveryRunId}:artifact:${recoveryArtifactId}:available`,
    trace_id: artifactRecoveryProof.request.trace_id,
    payload: {
      trigger_process_id:
        artifactRecoveryProof.run.request.trigger_process_id,
      runtime_run_id: recoveryRunId,
      ...scope,
      sequence_no: 2,
      start_attempt_no: 1,
      start_fence_generation: 7,
      artifact_id: recoveryArtifactId,
      artifact_ref: recoveryArtifactRef,
      artifact_kind: recoveryArtifactRequest.artifact_kind,
      content_hash: recoveryArtifactRequest.expected_sha256,
      size_bytes: recoveryArtifactBody.byteLength,
      media_type: recoveryArtifactRequest.media_type,
      retention_until: recoveryRetention,
      status: "available",
      artifact_status: "available",
      redaction_status: "complete",
      error: null,
      reason_code: null,
      error_summary: null,
    },
  });
  let staleArtifactReconciliationFenced = false;
  try {
    await store.finalizeArtifact({
      runtime_run_id: recoveryRunId,
      artifact_id: recoveryArtifactId,
      expected_start_fence_generation: 7,
      expected_status: "creating",
      reconciliation_owner: `${recoveryWorker}:stale`,
      reconciliation_generation: recoveryClaim.reconciliation_generation,
      terminal_status: "available",
      artifact_ref: recoveryArtifactRef,
      event: recoveryEvent,
      request_hash: recoveryRequestHash,
      finalized_at: recoveryEvent.occurred_at,
    });
  } catch {
    staleArtifactReconciliationFenced = true;
  }
  const recoveryFinalizeRequest = Object.freeze({
    runtime_run_id: recoveryRunId,
    artifact_id: recoveryArtifactId,
    expected_start_fence_generation: 7,
    expected_status: "creating",
    reconciliation_owner: recoveryWorker,
    reconciliation_generation: recoveryClaim.reconciliation_generation,
    terminal_status: "available",
    artifact_ref: recoveryArtifactRef,
    event: recoveryEvent,
    request_hash: recoveryRequestHash,
    finalized_at: recoveryEvent.occurred_at,
  });
  const recoveryFinalizedRun =
    await store.finalizeArtifact(recoveryFinalizeRequest);
  const recoveryReplayedRun =
    await store.finalizeArtifact(recoveryFinalizeRequest);
  const recoveredArtifact = await store.readArtifact(
    recoveryRunId,
    recoveryArtifactId,
  );
  const firstToolAudit = Object.freeze({
    tool_invocation_id: `tool:${runtimeRunId}:completed`,
    tool_name: "search",
    capability_token_id: `permission:${runtimeRunId}`,
    input_ref: `tool-input:${runtimeRunId}:completed`,
    lease_generation: 1,
    request_hash: canonicalPayloadHashV1({ runtimeRunId, tool: "completed" }),
    normalized_args_hash: canonicalPayloadHashV1({ query: "live proof" }),
    actor_binding_hash: actorBindingHash,
    status: "requested",
    side_effect_status: "none",
    downstream_idempotency_key: `${runtimeRunId}:downstream:completed`,
  });
  const firstRequestedEvent = toolEvent({
    run: finalizedRun,
    audit: firstToolAudit,
    eventType: "runtime.tool.requested",
    status: "requested",
    sequenceNo: 3,
  });
  let toolRun = await store.recordToolRequested({
    runtime_run_id: runtimeRunId,
    lease_generation: 1,
    audit: firstToolAudit,
    event: firstRequestedEvent,
  });
  await store.markToolRunning({
    runtime_run_id: runtimeRunId,
    lease_generation: 1,
    tool_invocation_id: firstToolAudit.tool_invocation_id,
  });
  const completedResult = Object.freeze({
    outcome: "completed",
    retryable: false,
    output: { ok: true },
    side_effect_status: "produced",
    external_response_ref: `tool-response:${runtimeRunId}`,
  });
  const completedOutputRef = `tool-output:${runtimeRunId}:completed`;
  const completedEvent = toolEvent({
    run: { ...toolRun, next_sequence_no: 4 },
    audit: firstToolAudit,
    eventType: "runtime.tool.completed",
    status: "completed",
    sequenceNo: 4,
    outputRef: completedOutputRef,
    result: completedResult,
  });
  toolRun = await store.recordToolResult({
    runtime_run_id: runtimeRunId,
    lease_generation: 1,
    tool_invocation_id: firstToolAudit.tool_invocation_id,
    output_ref: completedOutputRef,
    result: completedResult,
    event: completedEvent,
  });
  const secondToolAudit = Object.freeze({
    ...firstToolAudit,
    tool_invocation_id: `tool:${runtimeRunId}:unknown`,
    input_ref: `tool-input:${runtimeRunId}:unknown`,
    request_hash: canonicalPayloadHashV1({ runtimeRunId, tool: "unknown" }),
    normalized_args_hash: canonicalPayloadHashV1({ query: "unknown proof" }),
    downstream_idempotency_key: `${runtimeRunId}:downstream:unknown`,
  });
  const secondRequestedEvent = toolEvent({
    run: toolRun,
    audit: secondToolAudit,
    eventType: "runtime.tool.requested",
    status: "requested",
    sequenceNo: 5,
  });
  toolRun = await store.recordToolRequested({
    runtime_run_id: runtimeRunId,
    lease_generation: 1,
    audit: secondToolAudit,
    event: secondRequestedEvent,
  });
  await store.markToolRunning({
    runtime_run_id: runtimeRunId,
    lease_generation: 1,
    tool_invocation_id: secondToolAudit.tool_invocation_id,
  });
  const unknownResult = Object.freeze({
    outcome: "failed",
    retryable: false,
    error: { code: "tool_timeout", message: "outcome unknown" },
    side_effect_status: "unknown",
    external_error_ref: `tool-error:${runtimeRunId}`,
  });
  const unknownOutputRef = `tool-output:${runtimeRunId}:unknown`;
  const unknownEvent = toolEvent({
    run: { ...toolRun, next_sequence_no: 6 },
    audit: secondToolAudit,
    eventType: "runtime.tool.failed",
    status: "failed",
    sequenceNo: 6,
    outputRef: unknownOutputRef,
    result: unknownResult,
  });
  const terminalEvent = Object.freeze({
    event_id: `${runtimeRunId}:7:runtime.run.failed`,
    event_type: "runtime.run.failed",
    schema_version: "runtime_event.v1",
    producer: "action_runtime",
    occurred_at: new Date().toISOString(),
    idempotency_key: `${runtimeRunId}:runtime.run.failed:7`,
    trace_id: request.trace_id,
    payload: {
      trigger_process_id: triggerProcessId,
      runtime_run_id: runtimeRunId,
      ...scope,
      sequence_no: 7,
      start_attempt_no: 1,
      start_fence_generation: 7,
      status: "failed",
      previous_status: "running",
      next_status: "failed",
      model: "claude-test",
      reason: "tool_side_effect_unknown",
      duration_ms: null,
      reason_code: "tool_side_effect_unknown",
      error_summary: "Runtime execution failed; inspect the durable error artifact",
      terminal_artifact_ref: null,
    },
  });
  const frozenRun = await store.freezeUnknownSideEffect({
    runtime_run_id: runtimeRunId,
    lease_generation: 1,
    tool_invocation_id: secondToolAudit.tool_invocation_id,
    output_ref: unknownOutputRef,
    result: unknownResult,
    event: unknownEvent,
    terminal_event: terminalEvent,
  });
  const reconciliationResult = Object.freeze({
    outcome: "completed",
    retryable: false,
    output: { observed_committed: true },
    side_effect_status: "produced",
    external_response_ref: `reconciliation-evidence:${runtimeRunId}`,
  });
  const reconciliation = Object.freeze({
    schema_version: "runtime_tool_reconciliation.v1",
    runtime_run_id: runtimeRunId,
    tool_invocation_id: secondToolAudit.tool_invocation_id,
    expected_start_fence_generation: 7,
    expected_invocation_lease_generation: 1,
    expected_request_hash: secondToolAudit.request_hash,
    expected_downstream_idempotency_key:
      secondToolAudit.downstream_idempotency_key,
    evidence_ref: `reconciliation-evidence:${runtimeRunId}`,
    result: reconciliationResult,
    idempotency_key: `${runtimeRunId}:tool:${secondToolAudit.tool_invocation_id}:reconcile`,
    trace_id: `trace:reconcile:${runtimeRunId}`,
  });
  const { trace_id: _reconciliationTraceId, ...reconciliationHashInput } =
    reconciliation;
  const reconciliationRequestHash = canonicalPayloadHashV1(
    reconciliationHashInput,
  );
  const reconciled = await store.reconcileUnknownTool({
    reconciliation,
    reconciliation_request_hash: reconciliationRequestHash,
    reconciled_at: new Date().toISOString(),
  });
  const replayedReconciliation = await store.reconcileUnknownTool({
    reconciliation,
    reconciliation_request_hash: reconciliationRequestHash,
    reconciled_at: new Date().toISOString(),
  });
  const reconciledRun = await store.readRun(runtimeRunId);
  const controlProof = await createRunningProofRun(store, "control");
  const controlRequestedAt = new Date().toISOString();
  const controlValidUntil = new Date(
    Date.parse(controlProof.request.policy.expires_at) + 15 * 60_000,
  ).toISOString();
  const controlRequest = Object.freeze({
    schema_version: "runtime_cancel.v1",
    runtime_signal_id: `control:${controlProof.run.request.runtime_run_id}`,
    runtime_run_id: controlProof.run.request.runtime_run_id,
    trigger_process_id: controlProof.run.request.trigger_process_id,
    start_attempt_no: 1,
    preempt_token_hash: controlProof.request.preempt_token_hash,
    reason_code: "delivery_proof_cancel",
    requested_at: controlRequestedAt,
    idempotency_key: `${controlProof.run.request.runtime_run_id}:control:cancel`,
    trace_id: `trace:control:${controlProof.run.request.runtime_run_id}`,
  });
  const { trace_id: _controlTraceId, ...controlHashInput } = controlRequest;
  const controlRequestHash = canonicalPayloadHashV1(controlHashInput);
  const controlVerification = Object.freeze({
    runtime_run_id: controlProof.run.request.runtime_run_id,
    trigger_process_id: controlProof.run.request.trigger_process_id,
    start_attempt_no: 1,
    start_fence_generation: 7,
    ...scope,
    control_valid_until: controlValidUntil,
  });
  const receivedControl = await store.receiveControl(
    controlRequest,
    controlRequestHash,
    "cancel",
    controlVerification,
  );
  const receivedControlEvent = Object.freeze({
    event_id: `${controlProof.run.request.runtime_run_id}:2:control:${controlRequest.runtime_signal_id}:received`,
    event_type: "runtime.control_signal.received",
    schema_version: "runtime_event.v1",
    producer: "action_runtime",
    occurred_at: new Date().toISOString(),
    idempotency_key: `${controlRequest.idempotency_key}:received`,
    trace_id: controlRequest.trace_id,
    payload: {
      trigger_process_id: controlProof.run.request.trigger_process_id,
      runtime_run_id: controlProof.run.request.runtime_run_id,
      ...scope,
      sequence_no: 2,
      start_attempt_no: 1,
      start_fence_generation: 7,
      runtime_signal_id: controlRequest.runtime_signal_id,
      signal_type: "cancel",
      requested_by: "trigger_processor",
      control_valid_until: controlValidUntil,
      status: "received",
      handled_status: null,
      target_lease_generation: 1,
      handled_lease_generation: null,
      final_fencing_generation: null,
      safe_point_reached: null,
      late_events_isolated: null,
      last_runtime_sequence_no: null,
      safe_point_ref: null,
      isolation_proof_ref: null,
      reason_code: controlRequest.reason_code,
    },
  });
  const controlRunWithReceivedEvent = await store.appendEvent({
    runtime_run_id: controlProof.run.request.runtime_run_id,
    lease_generation: 1,
    event: receivedControlEvent,
  });
  const handledControlEvent = Object.freeze({
    ...receivedControlEvent,
    event_id: `${controlProof.run.request.runtime_run_id}:3:control:${controlRequest.runtime_signal_id}:handled`,
    event_type: "runtime.control_signal.handled",
    occurred_at: new Date().toISOString(),
    idempotency_key: `${controlRequest.idempotency_key}:handled`,
    payload: {
      ...receivedControlEvent.payload,
      sequence_no: 3,
      status: "handled",
      handled_status: "handled_safe_point",
      handled_lease_generation: 1,
      final_fencing_generation: 8,
      safe_point_reached: true,
      late_events_isolated: true,
      last_runtime_sequence_no: 2,
      safe_point_ref:
        `runtime_safe_point:${controlProof.run.request.runtime_run_id}:3`,
      isolation_proof_ref:
        `runtime_isolation:${controlProof.run.request.runtime_run_id}:3`,
    },
  });
  const cancelledRunEvent = Object.freeze({
    event_id: `${controlProof.run.request.runtime_run_id}:4:runtime.run.cancelled`,
    event_type: "runtime.run.cancelled",
    schema_version: "runtime_event.v1",
    producer: "action_runtime",
    occurred_at: new Date().toISOString(),
    idempotency_key:
      `${controlProof.run.request.runtime_run_id}:runtime.run.cancelled:4`,
    trace_id: controlRequest.trace_id,
    payload: {
      trigger_process_id: controlProof.run.request.trigger_process_id,
      runtime_run_id: controlProof.run.request.runtime_run_id,
      ...scope,
      sequence_no: 4,
      start_attempt_no: 1,
      start_fence_generation: 7,
      status: "cancelled",
      previous_status: "cancelling",
      next_status: "cancelled",
      model: "claude-test",
      reason: "cancel",
      duration_ms: null,
      reason_code: "cancel",
      error_summary: null,
      terminal_artifact_ref: null,
    },
  });
  const handledControlRun = await store.handleControl({
    runtime_run_id: controlProof.run.request.runtime_run_id,
    runtime_signal_id: controlRequest.runtime_signal_id,
    lease_generation: 1,
    handled_status: "handled_safe_point",
    handled_event: handledControlEvent,
    terminal_event: cancelledRunEvent,
    terminal_reason: "cancel",
  });
  const tombstonePolicyExpiresAt = new Date(
    Date.now() + 60 * 60_000,
  ).toISOString();
  const tombstoneControlValidUntil = new Date(
    Date.parse(tombstonePolicyExpiresAt) + 15 * 60_000,
  ).toISOString();
  const tombstoneRunId = `runtime-tombstone-live-${Date.now()}`;
  const tombstoneProcessId = `process-tombstone-live-${Date.now()}`;
  const tombstoneRequest = Object.freeze({
    schema_version: "runtime_cancel.v1",
    runtime_signal_id: `control:${tombstoneRunId}`,
    runtime_run_id: tombstoneRunId,
    trigger_process_id: tombstoneProcessId,
    start_attempt_no: 1,
    preempt_token_hash: sha256(`preempt:${tombstoneRunId}`),
    reason_code: "pre_start_cancel",
    requested_at: new Date().toISOString(),
    idempotency_key: `${tombstoneRunId}:control:cancel`,
    trace_id: `trace:${tombstoneRunId}`,
  });
  const { trace_id: _tombstoneTraceId, ...tombstoneHashInput } =
    tombstoneRequest;
  const tombstoneRequestHash = canonicalPayloadHashV1(tombstoneHashInput);
  const tombstoneVerification = Object.freeze({
    runtime_run_id: tombstoneRunId,
    trigger_process_id: tombstoneProcessId,
    start_attempt_no: 1,
    start_fence_generation: 9,
    ...scope,
    control_valid_until: tombstoneControlValidUntil,
  });
  const tombstoned = await store.receiveControlTombstone(
    { scope },
    tombstoneRequest,
    tombstoneRequestHash,
    "cancel",
    tombstoneVerification,
  );
  const tombstoneStartRequest = Object.freeze({
    ...request,
    runtime_run_id: tombstoneRunId,
    trigger_process_id: tombstoneProcessId,
    preempt_token_hash: tombstoneRequest.preempt_token_hash,
    policy: { ...request.policy, expires_at: tombstonePolicyExpiresAt },
  });
  const foundTombstone = await store.findControlTombstone(
    tombstoneStartRequest,
  );
  const outboxClaims = await store.claimOutbox({
    worker_id: "outbox-worker-live",
    limit: 1,
    lease_seconds: 30,
    now: new Date().toISOString(),
    current_transport_epoch: "bootstrap",
    current_transport_generation: 1,
  });
  const outboxClaim = outboxClaims[0];
  if (outboxClaim === undefined) {
    throw new Error("PostgreSQL Runtime outbox claim proof returned no row");
  }
  const claimedRuntimeRunId = outboxClaim.event.payload.runtime_run_id;
  if (typeof claimedRuntimeRunId !== "string") {
    throw new Error("PostgreSQL Runtime outbox claim has no owner identity");
  }
  const outboxAckRequest = Object.freeze({
    outbox_id: outboxClaim.id,
    claim_token: outboxClaim.claim_token,
    outcome: "sent",
    next_retry_at: null,
    error: null,
    transport_ref: `redis-stream:${outboxClaim.event.event_id}`,
    transport_epoch: "bootstrap",
    transport_generation: 1,
    current_transport_epoch: "bootstrap",
    current_transport_generation: 1,
    now: new Date().toISOString(),
    runtime_run_id: claimedRuntimeRunId,
    event_id: outboxClaim.event.event_id,
    event_hash: canonicalPayloadHashV1(outboxClaim.event),
    expected_attempt_count: outboxClaim.attempt_count,
  });
  const outboxAck = await store.acknowledgeOutbox(outboxAckRequest);
  const authoritativeAck =
    await store.readOutboxAcknowledgeState(outboxAckRequest);
  if (
    begun.outcome !== "begun" ||
    accepted.outcome !== "accepted" ||
    claimed.status !== "running" ||
    claimed.lease?.generation !== 1 ||
    claimed.events.length !== 1 ||
    claimed.events[0]?.event_type !== "runtime.run.started" ||
    claimed.outbox.length !== 1 ||
    canonicalPayloadHashV1(persistedPolicy.rows[0]?.tool_arg_constraints) !==
      canonicalPayloadHashV1(frozenToolConstraints) ||
    policyArtifact?.policy_input_hash !== request.policy_input_hash ||
    reservedArtifact.replayed ||
    reservedArtifact.artifact.status !== "creating" ||
    finalizedArtifact?.status !== "available" ||
    finalizedArtifact.artifact_ref !== `object:${artifactId}` ||
    finalizedRun.events.at(-1)?.event_type !== "runtime.artifact.created" ||
    finalizedRun.outbox.length !== 2 ||
    recoveryClaim.reconciliation_owner !== recoveryWorker ||
    recoveryClaim.reconciliation_generation !== 1 ||
    recoveryClaim.reconciliation_expires_at === undefined ||
    !staleArtifactReconciliationFenced ||
    recoveredArtifact?.status !== "available" ||
    recoveredArtifact.artifact_ref !== recoveryArtifactRef ||
    recoveredArtifact.reconciliation_owner !== undefined ||
    recoveredArtifact.reconciliation_expires_at !== undefined ||
    recoveryFinalizedRun.events.length !== 2 ||
    recoveryFinalizedRun.outbox.length !== 2 ||
    recoveryReplayedRun.events.length !== 2 ||
    recoveryReplayedRun.outbox.length !== 2 ||
    toolRun.tools.find(
      ({ tool_invocation_id }) =>
        tool_invocation_id === firstToolAudit.tool_invocation_id,
    )?.status !== "completed" ||
    frozenRun.status !== "failed" ||
    frozenRun.terminal_reason !== "tool_side_effect_unknown" ||
    frozenRun.events.length !== 7 ||
    frozenRun.outbox.length !== 7 ||
    reconciled.replayed ||
    !replayedReconciliation.replayed ||
    reconciled.audit.status !== "completed" ||
    reconciled.audit.reconciliation_evidence_ref !==
      reconciliation.evidence_ref ||
    reconciledRun?.frozen_side_effect !== false ||
    reconciledRun.events.length !== 8 ||
    reconciledRun.outbox.length !== 8 ||
    receivedControl.run.status !== "cancelling" ||
    controlRunWithReceivedEvent.events.length !== 2 ||
    handledControlRun.status !== "cancelled" ||
    handledControlRun.lease?.generation !== 2 ||
    handledControlRun.controls[0]?.handled_status !== "handled_safe_point" ||
    tombstoned.outcome !== "tombstoned" ||
    foundTombstone?.request_hash !== tombstoneRequestHash ||
    !outboxAck.acknowledged ||
    authoritativeAck?.claim_token !== outboxClaim.claim_token ||
    authoritativeAck.record.status !== "sent"
  ) {
    throw new Error("PostgreSQL Runtime execution store proof mismatch");
  }
  process.stdout.write(
    `${JSON.stringify({
      runtime_run_id: runtimeRunId,
      begun: begun.outcome,
      accepted: accepted.outcome,
      status: claimed.status,
      lease_generation: claimed.lease.generation,
      events: claimed.events.map(({ event_type }) => event_type),
      outbox_count: finalizedRun.outbox.length,
      policy_input_read: true,
      tool_arg_constraints_frozen: true,
      artifact_status: finalizedArtifact?.status,
      artifact_event_atomic: finalizedRun.outbox.length === 2,
      artifact_recovery_claimed: recoveryClaim.reconciliation_generation,
      artifact_recovery_fenced: staleArtifactReconciliationFenced,
      artifact_recovery_replayed:
        recoveryReplayedRun.events.length === recoveryFinalizedRun.events.length,
      completed_tool_atomic: toolRun.events.length === 5,
      unknown_tool_frozen: frozenRun.status,
      tool_reconciled: reconciled.audit.status,
      reconciliation_replayed: replayedReconciliation.replayed,
      control_status: handledControlRun.status,
      control_lease_fenced: handledControlRun.lease?.generation,
      prestart_tombstone: tombstoned.outcome,
      durable_outbox_ack: authoritativeAck?.record.status,
    })}\n`,
  );
} finally {
  await composition.close();
}
