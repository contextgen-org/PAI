import { createHash, randomUUID } from "node:crypto";

import { canonicalJsonV1 } from "@pai/eventing";
import { Value } from "@sinclair/typebox/value";
import {
  TriggerMetaEnqueueWorkV1Schema,
  TriggerRuntimeStartRecomposeWorkV1Schema,
} from "@pai/contracts";
import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.PAI_TEST_DATABASE_URL;
const describePostgres = databaseUrl === undefined ? describe.skip : describe;

function sha256(value: unknown): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(canonicalJsonV1(value)).digest("hex")}`;
}

function sha256Text(value: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function withoutTrace<T extends Readonly<Record<string, unknown>>>(value: T) {
  const copy = { ...value };
  delete copy.trace_id;
  return copy;
}

describePostgres("Trigger runtime lifecycle owner writers", () => {
  const pool = databaseUrl === undefined
    ? undefined
    : new Pool({ connectionString: databaseUrl, max: 4 });

  beforeAll(async () => {
    if (pool === undefined) throw new Error("PAI_TEST_DATABASE_URL is required");
    await pool.query("SELECT 1");
  });

  afterAll(async () => {
    await pool?.end();
  });

  async function seed(client: PoolClient) {
    const suffix = randomUUID();
    const scope = {
      workspace_id: `workspace:${suffix}`,
      bot_id: `bot:${suffix}`,
      owner_agent_id: `agent:${suffix}`,
      deployment_environment: "local",
      release_channel: "stable",
    } as const;
    const triggerId = `trigger:${suffix}`;
    const processId = `process:${suffix}`;
    const runtimeRunId = `run:${suffix}`;
    const policyRevisionId = `policy-revision:${suffix}`;
    const policySnapshotId = `policy-snapshot:${suffix}`;
    const hash = `sha256:${"a".repeat(64)}`;
    const policyCreatedAt = new Date(Date.now() - 60_000).toISOString();
    const policyExpiresAt = new Date(Date.now() + 60 * 60_000).toISOString();
    const contextSnapshotRetentionUntil = new Date(
      Date.now() + 60 * 60 * 1_000,
    ).toISOString();
    const authenticatedContext = {
      authentication_kind: "supabase_ingress",
      principal_id: "user:test",
      principal_type: "user",
      permission_scope: "trigger.submit.chat",
      delegated_principal: null,
      verified_principal: {
        principal_id: "user:test",
        principal_type: "user",
        roles: ["member"],
        source_issuer: "https://test.invalid/auth/v1",
        source_subject: "user:test",
        auth_time: 0,
        scope_kind: "bot",
        ...scope,
      },
    };

    await client.query(
      `INSERT INTO trigger_processor.bots(
         id, workspace_id, owner_agent_id, deployment_environment,
         release_channel, name, super_user_id, status, timezone, locale
       ) VALUES ($1,$2,$3,$4,$5,'Lifecycle Test','user:test','active','UTC','en')`,
      [scope.bot_id, scope.workspace_id, scope.owner_agent_id,
        scope.deployment_environment, scope.release_channel],
    );
    await client.query(
      `INSERT INTO trigger_processor.triggers(
         id, workspace_id, bot_id, owner_agent_id, deployment_environment,
         release_channel, source, actor_type, actor_id, authenticated_context,
         payload, dedupe_key, request_hash, priority, status
       ) VALUES ($1,$2,$3,$4,$5,$6,'chat','user','user:test',$7,'{}',$8,$9,'strong','accepted')`,
      [triggerId, scope.workspace_id, scope.bot_id, scope.owner_agent_id,
        scope.deployment_environment, scope.release_channel, authenticatedContext,
        `dedupe:${suffix}`, hash],
    );
    await client.query(
      `INSERT INTO trigger_processor.trigger_processes(
         id, trigger_id, workspace_id, bot_id, owner_agent_id,
         deployment_environment, release_channel, phase, status, wait_reason,
         current_runtime_run_id, runtime_start_attempt_no,
         runtime_policy_created_at, runtime_policy_expires_at,
         context_snapshot_ref, context_snapshot_version, context_snapshot_hash,
         context_snapshot_retention_until, intent_ref, current_reason_code,
         state_version, priority, admission_time
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,'execution','waiting','runtime_start',
         $8,1,$9,$10,$11,1,$12,$13,$14,
         'runtime_start_reserved',1,'strong',$9
       )`,
      [processId, triggerId, scope.workspace_id, scope.bot_id,
        scope.owner_agent_id, scope.deployment_environment, scope.release_channel,
        runtimeRunId, policyCreatedAt, policyExpiresAt,
        `context:${suffix}`, hash, contextSnapshotRetentionUntil, `intent:${suffix}`],
    );
    await client.query(
      `INSERT INTO trigger_processor.bot_intent_policy_revisions(
         id, workspace_id, bot_id, owner_agent_id, deployment_environment,
         release_channel, revision_no, personality_ref, personality_version,
         personality_hash, safety_boundaries_ref, safety_boundaries_version,
         safety_boundaries_hash, effective_at, created_by_principal, change_reason
       ) VALUES ($1,$2,$3,$4,$5,$6,1,$7,1,$8,$9,1,$10,$11,'test','test')`,
      [policyRevisionId, scope.workspace_id, scope.bot_id, scope.owner_agent_id,
        scope.deployment_environment, scope.release_channel, `personality:${suffix}`,
        hash, `safety:${suffix}`, hash, policyCreatedAt],
    );
    await client.query(
      `INSERT INTO trigger_processor.intent_policy_snapshots(
         id, schema_version, trigger_process_id, intent_version, workspace_id,
         bot_id, owner_agent_id, deployment_environment, release_channel,
         bot_policy_revision_id, bot_policy_revision_no, personality_ref,
         personality_version, personality_hash, safety_boundaries_ref,
         safety_boundaries_version, safety_boundaries_hash,
         tool_permission_profile_ref, tool_permission_profile_revision,
         tool_permission_profile_hash, tool_policy_epoch, catalog_version,
         catalog_as_of, security_revocation_epoch, skill_permission_summary_ref,
         skill_permission_summary_hash, canonical_bytes, snapshot_hash
       ) VALUES (
         $1,'intent_policy_input_snapshot.v1',$2,1,$3,$4,$5,$6,$7,$8,1,
         $9,1,$10,$11,1,$12,$13,1,$14,1,$15,$16,1,$17,$18,$19,$20
       )`,
      [policySnapshotId, processId, scope.workspace_id, scope.bot_id,
        scope.owner_agent_id, scope.deployment_environment, scope.release_channel,
        policyRevisionId, `personality:${suffix}`, hash, `safety:${suffix}`, hash,
        `tool-profile:${suffix}`, hash, `catalog:${suffix}`, policyCreatedAt,
        `permission-summary:${suffix}`, hash, Buffer.from("{}"), hash],
    );
    await client.query(
      `INSERT INTO trigger_processor.runtime_start_reservations(
         id, trigger_process_id, start_attempt_no, reserved_runtime_run_id,
         start_fence_generation, start_fence_token_hash, request_hash,
         policy_schema_version, policy_input_ref, policy_input_hash,
         policy_canonical_bytes, policy_input_created_at, policy_expires_at,
         status, intent_version, intent_policy_snapshot_ref,
         intent_policy_snapshot_hash
       ) VALUES ($1,$2,1,$3,7,$4,$5,'runtime_policy_input.v1',$6,$7,$8,$9,$10,
         'dispatching',1,$11,$12)`,
      [`reservation:${suffix}`, processId, runtimeRunId, hash, hash,
        `policy-input:${suffix}`, hash, Buffer.from("{}"), policyCreatedAt,
        policyExpiresAt, policySnapshotId, hash],
    );
    await client.query(
      `INSERT INTO trigger_processor.bot_foreground_slots(bot_id,process_id,slot_generation)
       VALUES ($1,$2,1)`,
      [scope.bot_id, processId],
    );
    await client.query(
      `INSERT INTO trigger_processor.trigger_snapshot_append_cursors(trigger_process_id)
       VALUES ($1)`,
      [processId],
    );
    return { suffix, scope, processId, runtimeRunId, policyRevisionId, hash };
  }

  async function seedRuntimeStartCandidate(
    client: PoolClient,
    seeded: Awaited<ReturnType<typeof seed>>,
  ) {
    const suffix = randomUUID();
    const triggerId = `trigger:${suffix}`;
    const processId = `process:${suffix}`;
    const runtimeRunId = `run:${suffix}`;
    const policySnapshotId = `policy-snapshot:${suffix}`;
    const contextSnapshotRef = `context:${suffix}`;
    const contextSnapshotHash = sha256({ context: suffix });
    const intentRef = `intent:${suffix}`;
    const policySnapshotHash = sha256({ policy_snapshot: suffix });
    const policyCreatedAt = new Date(Date.now() - 60_000).toISOString();
    const policyExpiresAt = new Date(Date.now() + 60 * 60_000).toISOString();
    const claimToken = `claim:${suffix}`;
    const leaseOwner = `worker:${suffix}`;
    const workItemId = `work:${suffix}`;
    const traceId = `trace:${suffix}`;
    const idempotencyKey = `${processId}:start:1`;
    const authenticatedContext = {
      authentication_kind: "supabase_ingress",
      principal_id: "user:test",
      principal_type: "user",
      permission_scope: "trigger.submit.chat",
      delegated_principal: null,
      verified_principal: {
        principal_id: "user:test",
        principal_type: "user",
        roles: ["member"],
        source_issuer: "https://test.invalid/auth/v1",
        source_subject: "user:test",
        auth_time: 0,
        scope_kind: "bot",
        ...seeded.scope,
      },
    };
    const intentPolicySnapshot = {
      schema_version: "intent_policy_input_snapshot.v1",
      snapshot_ref: policySnapshotId,
      snapshot_hash: policySnapshotHash,
      trigger_process_id: processId,
      intent_version: 1,
    } as const;
    const policy = {
      schema_version: "runtime_policy_input.v1",
      created_at: policyCreatedAt,
      expires_at: policyExpiresAt,
      intent_policy_snapshot_ref: policySnapshotId,
      intent_policy_snapshot_hash: policySnapshotHash,
    } as const;
    const policyInputRef = `policy-input:${suffix}`;
    const policyInputHash = sha256(policy);
    const command = {
      schema_version: "runtime_start.v1.2",
      trigger_process_id: processId,
      runtime_run_id: runtimeRunId,
      ...seeded.scope,
      start_attempt_no: 1,
      start_fence_token: `fence:${suffix}`,
      context_snapshot_ref: contextSnapshotRef,
      context_snapshot_version: 1,
      context_snapshot_hash: contextSnapshotHash,
      intent_ref: intentRef,
      intent_version: 1,
      intent_policy_snapshot_ref: policySnapshotId,
      intent_policy_snapshot_hash: policySnapshotHash,
      intent_policy_snapshot: intentPolicySnapshot,
      policy_input_ref: policyInputRef,
      policy_input_hash: policyInputHash,
      policy,
      idempotency_key: idempotencyKey,
      trace_id: traceId,
    } as const;
    const reservation = {
      runtime_run_id: runtimeRunId,
      start_fence_token: command.start_fence_token,
      policy_input_ref: policyInputRef,
      policy_input_hash: policyInputHash,
    } as const;
    const contextRequest = {
      schema_version: "context_compose_request.v1",
      trigger_process_id: processId,
      ...seeded.scope,
      trigger: {
        trigger_id: triggerId,
        source: "chat",
        actor_type: "user",
      },
      context_version: 1,
      source_policy: {
        required_sources: [],
        allowed_sources: ["environment"],
        skip_decisions: [],
      },
      idempotency_key: `${processId}:context:1`,
      trace_id: traceId,
    } as const;
    const contextWorkPayload = {
      schema_version: "trigger_stage_execute_work.v1",
      trigger_process_id: processId,
      expected_process_state: {
        phase: "admission",
        status: "running",
        wait_reason: null,
        terminal_reason: null,
      },
      expected_process_state_version: 4,
      immutable_input_hash: sha256(contextRequest),
      trace_id: traceId,
      target_stage: "context",
      request: contextRequest,
    } as const;
    const workPayload = {
      schema_version: "trigger_stage_execute_work.v1",
      trigger_process_id: processId,
      expected_process_state: {
        phase: "intent",
        status: "running",
        wait_reason: null,
        terminal_reason: null,
      },
      expected_process_state_version: 5,
      immutable_input_hash: sha256(command),
      trace_id: traceId,
      target_stage: "runtime_start",
      request: {
        ...command,
        structured_intent_hash: seeded.hash,
      },
    } as const;

    await client.query(
      `INSERT INTO trigger_processor.triggers(
         id, workspace_id, bot_id, owner_agent_id, deployment_environment,
         release_channel, source, actor_type, actor_id, authenticated_context,
         payload, dedupe_key, request_hash, priority, status
       ) VALUES ($1,$2,$3,$4,$5,$6,'chat','user','user:test',$7,'{}',$8,$9,'strong','accepted')`,
      [triggerId, seeded.scope.workspace_id, seeded.scope.bot_id,
        seeded.scope.owner_agent_id, seeded.scope.deployment_environment,
        seeded.scope.release_channel, authenticatedContext, `dedupe:${suffix}`,
        seeded.hash],
    );
    await client.query(
      `INSERT INTO trigger_processor.trigger_processes(
         id, trigger_id, workspace_id, bot_id, owner_agent_id,
         deployment_environment, release_channel, phase, status,
         context_snapshot_ref, context_snapshot_version, context_snapshot_hash,
         context_snapshot_retention_until, intent_ref, current_reason_code,
         state_version, priority, admission_time
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,'intent','running',$8,1,$9,
         $10,$11,'intent_ready',5,'strong',$12)`,
      [processId, triggerId, seeded.scope.workspace_id, seeded.scope.bot_id,
        seeded.scope.owner_agent_id, seeded.scope.deployment_environment,
        seeded.scope.release_channel, contextSnapshotRef, contextSnapshotHash,
        policyExpiresAt, intentRef, policyCreatedAt],
    );
    await client.query(
      `INSERT INTO trigger_processor.intent_policy_snapshots(
         id, schema_version, trigger_process_id, intent_version, workspace_id,
         bot_id, owner_agent_id, deployment_environment, release_channel,
         bot_policy_revision_id, bot_policy_revision_no, personality_ref,
         personality_version, personality_hash, safety_boundaries_ref,
         safety_boundaries_version, safety_boundaries_hash,
         tool_permission_profile_ref, tool_permission_profile_revision,
         tool_permission_profile_hash, tool_policy_epoch, catalog_version,
         catalog_as_of, security_revocation_epoch, skill_permission_summary_ref,
         skill_permission_summary_hash, canonical_bytes, snapshot_hash
       ) VALUES ($1,'intent_policy_input_snapshot.v1',$2,1,$3,$4,$5,$6,$7,$8,1,
         $9,1,$10,$11,1,$12,$13,1,$14,1,$15,$16,1,$17,$18,$19,$20)`,
      [policySnapshotId, processId, seeded.scope.workspace_id,
        seeded.scope.bot_id, seeded.scope.owner_agent_id,
        seeded.scope.deployment_environment, seeded.scope.release_channel,
        seeded.policyRevisionId, `personality:${seeded.suffix}`, seeded.hash,
        `safety:${seeded.suffix}`, seeded.hash, `tool-profile:${suffix}`,
        seeded.hash, `catalog:${suffix}`, policyCreatedAt,
        `permission-summary:${suffix}`, seeded.hash,
        Buffer.from(canonicalJsonV1(intentPolicySnapshot)), policySnapshotHash],
    );
    await client.query(
      `INSERT INTO trigger_processor.trigger_process_work_items(
         id, trigger_process_id, workspace_id, bot_id, owner_agent_id,
         deployment_environment, release_channel, work_kind, schema_version,
         expected_process_state_version, payload, payload_hash, status,
         completed_at, idempotency_key, trace_id
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,'stage_execute',
         'trigger_stage_execute_work.v1',4,$8,$9,'completed',$10,$11,$12)`,
      [`context-work:${suffix}`, processId, seeded.scope.workspace_id,
        seeded.scope.bot_id, seeded.scope.owner_agent_id,
        seeded.scope.deployment_environment, seeded.scope.release_channel,
        contextWorkPayload, sha256(contextWorkPayload), policyCreatedAt,
        contextRequest.idempotency_key, traceId],
    );
    await client.query(
      `INSERT INTO trigger_processor.trigger_process_work_items(
         id, trigger_process_id, workspace_id, bot_id, owner_agent_id,
         deployment_environment, release_channel, work_kind, schema_version,
         expected_process_state_version, payload, payload_hash, status,
         lease_owner, lease_token_hash, lease_generation, lease_until,
         idempotency_key, trace_id
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,'stage_execute',
         'trigger_stage_execute_work.v1',5,$8,$9,'leased',$10,$11,1,$12,$13,$14)`,
      [workItemId, processId, seeded.scope.workspace_id, seeded.scope.bot_id,
        seeded.scope.owner_agent_id, seeded.scope.deployment_environment,
        seeded.scope.release_channel, workPayload, sha256(workPayload), leaseOwner,
        sha256Text(claimToken), policyExpiresAt, idempotencyKey, traceId],
    );
    return {
      processId,
      runtimeRunId,
      workItemId,
      claimToken,
      leaseOwner,
      traceId,
      idempotencyKey,
      command,
      reservation,
      requestHash: sha256(withoutTrace(command)),
      contextRequest,
    };
  }

  async function createRuntimeStartReservation(
    client: PoolClient,
    seeded: Awaited<ReturnType<typeof seed>>,
    candidate: Awaited<ReturnType<typeof seedRuntimeStartCandidate>>,
  ) {
    const result = await client.query<{ result: Readonly<Record<string, unknown>> }>(
      `SELECT trigger_processor.create_runtime_start_reservation_v1(
         $1,$2,1,$3::jsonb,$4::jsonb,$5,$6,$7,1,$8,5,$9,$10,$11
       ) AS result`,
      [candidate.processId, seeded.scope.bot_id, candidate.reservation,
        candidate.command, candidate.idempotencyKey, candidate.workItemId,
        candidate.claimToken, candidate.leaseOwner,
        sha256({ result: candidate.processId }), candidate.requestHash,
        candidate.traceId],
    );
    return result.rows[0]!.result;
  }

  function lifecycleEvent(
    seeded: Awaited<ReturnType<typeof seed>>,
    eventType:
      | "runtime.run.started"
      | "runtime.run.completed"
      | "runtime.run.failed"
      | "runtime.run.cancelled"
      | "runtime.control_signal.handled",
    sequenceNo: number,
    options: Readonly<{
      handled_status?: "handled_safe_point" | "already_terminal";
    }> = {},
  ) {
    const occurredAt = new Date(Date.now() + sequenceNo * 1_000).toISOString();
    const eventId = `${seeded.runtimeRunId}:${sequenceNo}:${eventType}`;
    const identity = {
      trigger_process_id: seeded.processId,
      runtime_run_id: seeded.runtimeRunId,
      ...seeded.scope,
      sequence_no: sequenceNo,
      start_attempt_no: 1,
      start_fence_generation: 7,
    } as const;
    const payload = eventType === "runtime.control_signal.handled"
      ? {
          ...identity,
          runtime_signal_id: `signal:${seeded.suffix}`,
          signal_type: "cancel",
          requested_by: "trigger_processor",
          control_valid_until: new Date(
            Date.parse(occurredAt) + 60 * 60 * 1_000,
          ).toISOString(),
          status: "handled",
          handled_status: options.handled_status ?? "handled_safe_point",
          target_lease_generation: 1,
          handled_lease_generation: 1,
          final_fencing_generation: 2,
          safe_point_reached: true,
          late_events_isolated: true,
          last_runtime_sequence_no: sequenceNo - 1,
          safe_point_ref: `safe-point:${seeded.suffix}`,
          isolation_proof_ref: `isolation:${seeded.suffix}`,
          reason_code: "user_cancelled",
        }
      : {
          ...identity,
          status: eventType === "runtime.run.started"
            ? "running"
            : eventType === "runtime.run.completed"
              ? "completed"
              : eventType === "runtime.run.failed"
                ? "failed"
                : "cancelled",
          previous_status: eventType === "runtime.run.started" ? "queued" : "running",
          next_status: eventType === "runtime.run.started"
            ? "running"
            : eventType === "runtime.run.completed"
              ? "completed"
              : eventType === "runtime.run.failed"
                ? "failed"
                : "cancelled",
          model: "test-model",
          reason: eventType === "runtime.run.started" ? null : "user_cancelled",
          duration_ms: eventType === "runtime.run.started" ? null : 1_000,
          reason_code: eventType === "runtime.run.started"
            ? "runtime_started"
            : eventType === "runtime.run.completed"
              ? "runtime_completed"
              : eventType === "runtime.run.failed"
                ? "runtime_failed"
                : "user_cancelled",
          error_summary: null,
          terminal_artifact_ref: eventType === "runtime.run.started"
            ? null
            : `artifact:${seeded.suffix}`,
        };
    const event = {
      event_id: eventId,
      event_type: eventType,
      schema_version: "runtime_event.v1",
      producer: "action_runtime",
      occurred_at: occurredAt,
      idempotency_key: eventId,
      trace_id: `trace:${seeded.suffix}`,
      payload,
    } as const;
    const append = {
      trigger_process_id: seeded.processId,
      runtime_run_id: seeded.runtimeRunId,
      source_event_id: eventId,
      source_service: "action_runtime",
      source_sequence_no: sequenceNo,
      event_type: eventType,
      schema_version: "runtime_event.v1",
      occurred_at: occurredAt,
      trace_id: event.trace_id,
      append_type: "runtime_event",
      payload_ref: `runtime-event:${eventId}`,
      payload_hash: sha256(event),
      observation_summary: eventType === "runtime.control_signal.handled"
        ? {
            runtime_signal_id: payload.runtime_signal_id,
            safe_point_ref: payload.safe_point_ref,
            isolation_proof_ref: payload.isolation_proof_ref,
            status: payload.status,
            duration_ms: null,
            reason_code: payload.reason_code,
            error_summary: null,
            artifact_ref: null,
          }
        : {
            runtime_run_id: seeded.runtimeRunId,
            status: payload.status,
            duration_ms: payload.duration_ms,
            reason_code: payload.reason_code,
            error_summary: null,
            artifact_ref: payload.terminal_artifact_ref,
          },
      idempotency_key: `action_runtime:${eventId}`,
    } as const;
    return { event, append };
  }

  async function callLifecycle(
    client: PoolClient,
    writer:
      | "record_runtime_started_v1"
      | "enter_trigger_cooldown_v1"
      | "finalize_trigger_runtime_terminal_v1"
      | "apply_runtime_control_handled_v1",
    seeded: Awaited<ReturnType<typeof seed>>,
    value: ReturnType<typeof lifecycleEvent>,
  ) {
    const requestHash = sha256(withoutTrace(value.append));
    const snapshotRetentionUntil = new Date(
      Date.parse(value.event.occurred_at) + 60 * 60 * 1_000,
    ).toISOString();
    const result = await client.query<{ result: Readonly<Record<string, unknown>> }>(
      `SELECT trigger_processor.${writer}(
         $1,$2::jsonb,$3::jsonb,$4::jsonb,$5::timestamptz,$6::bigint,
         $7::jsonb,$8,$9,$10,$11,$12,$13
       ) AS result`,
      [seeded.processId, value.append, value.event,
        { runtime_event: value.event, retention_until: snapshotRetentionUntil },
        value.event.occurred_at, 7,
        { producer: "action_runtime", audience: "trigger_processor",
          capability: ["trigger.process.snapshot.append"], scope_kind: "bot",
          ...seeded.scope },
        value.append.idempotency_key, sha256(value.event), requestHash,
        sha256({ process_id: seeded.processId }), requestHash,
        value.event.trace_id],
    );
    return result.rows[0]!.result;
  }

  async function markCancelling(
    client: PoolClient,
    seeded: Awaited<ReturnType<typeof seed>>,
  ) {
    const signalId = `signal:${seeded.suffix}`;
    await client.query(
      `INSERT INTO trigger_processor.trigger_process_cancel_requests(
         id,trigger_process_id,idempotency_key,request_hash,reason_code,
         actor_principal_id,actor_role,actor_auth_context_ref,status,
         runtime_signal_id,isolation_status,trace_id
       ) VALUES ($1,$2,$3,$4,'user_cancelled','user:test','user',$5,
         'runtime_handling',$6,'pending',$7)`,
      [`cancel:${seeded.suffix}`, seeded.processId, `cancel:${seeded.suffix}`,
        `sha256:${"b".repeat(64)}`, `auth:${seeded.suffix}`, signalId,
        `trace:${seeded.suffix}`],
    );
    await client.query(
      `UPDATE trigger_processor.trigger_processes
          SET status='cancelling', cancellation_status='runtime_handling',
              cancellation_isolation_status='pending',
              runtime_cancel_signal_id=$2, state_version=state_version+1,
              updated_at=clock_timestamp()
        WHERE id=$1`,
      [seeded.processId, signalId],
    );
  }

  it("persists transport uncertainty without fake work and schedules only a no-run-proven recompose", async () => {
    if (pool === undefined) throw new Error("PAI_TEST_DATABASE_URL is required");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const shared = await seed(client);
      await client.query(
        "DELETE FROM trigger_processor.bot_foreground_slots WHERE bot_id=$1",
        [shared.scope.bot_id],
      );
      const candidate = await seedRuntimeStartCandidate(client, shared);
      const created = await createRuntimeStartReservation(client, shared, candidate);
      const reservationId = String(created.reservation_id);
      const fenceGeneration = Number(created.start_fence_generation);
      await client.query(
        `UPDATE trigger_processor.runtime_start_reservations
            SET status='dispatching', claimed_at=clock_timestamp(),
                updated_at=clock_timestamp()
          WHERE id=$1`,
        [reservationId],
      );
      const initial = await client.query<{
        reservation_status: string;
        reservation_updated_at: string;
        phase: string;
        process_status: string;
        wait_reason: string;
        process_updated_at: string;
      }>(
        `SELECT reservation.status AS reservation_status,
                to_char(reservation.updated_at AT TIME ZONE 'UTC',
                  'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS reservation_updated_at,
                process.phase, process.status AS process_status,
                process.wait_reason,
                to_char(process.updated_at AT TIME ZONE 'UTC',
                  'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS process_updated_at
           FROM trigger_processor.runtime_start_reservations AS reservation
           JOIN trigger_processor.trigger_processes AS process
             ON process.id=reservation.trigger_process_id
          WHERE reservation.id=$1`,
        [reservationId],
      );
      const before = initial.rows[0]!;
      const uncertainTransitionId = `trigger-transition:${candidate.processId}:runtime-start-uncertain:${reservationId}`;
      const uncertainEventId = `trigger-event:${candidate.processId}:runtime-start-uncertain:${reservationId}`;
      const uncertaintyEvidence = {
        kind: "runtime_start_uncertain",
        reservation_ref: reservationId,
        transport_uncertainty_ref: `artifact:transport-uncertainty:${candidate.processId}`,
        expected_process_updated_at: before.process_updated_at,
        process_lock_ref: `trigger_process:${candidate.processId}:runtime_start_reservation_lock`,
        transition_audit_ref: uncertainTransitionId,
        outbox_event_ref: uncertainEventId,
      } as const;
      const uncertaintyCall = [
        candidate.processId,
        reservationId,
        before.reservation_status,
        before.reservation_updated_at,
        fenceGeneration,
        before.phase,
        before.process_status,
        before.process_updated_at,
        uncertaintyEvidence.transport_uncertainty_ref,
        uncertaintyEvidence,
        sha256(uncertaintyEvidence),
        candidate.traceId,
      ] as const;
      const uncertain = await client.query<{ result: Record<string, unknown> }>(
        `SELECT trigger_processor.record_runtime_start_uncertain_v1(
           $1,$2,$3,$4::timestamptz,$5::bigint,$6,$7,$8::timestamptz,
           $9,$10::jsonb,$11,$12
         ) AS result`,
        [...uncertaintyCall],
      );
      expect(uncertain.rows[0]!.result).toMatchObject({
        applied: true,
        replayed: false,
        next_wait_reason: "runtime_start_reconcile",
      });
      const afterUncertain = await client.query<{
        reservation_status: string;
        reservation_updated_at: string;
        phase: string;
        process_status: string;
        wait_reason: string;
        process_updated_at: string;
      }>(
        `SELECT reservation.status AS reservation_status,
                to_char(reservation.updated_at AT TIME ZONE 'UTC',
                  'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS reservation_updated_at,
                process.phase, process.status AS process_status,
                process.wait_reason,
                to_char(process.updated_at AT TIME ZONE 'UTC',
                  'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS process_updated_at
           FROM trigger_processor.runtime_start_reservations AS reservation
           JOIN trigger_processor.trigger_processes AS process
             ON process.id=reservation.trigger_process_id
          WHERE reservation.id=$1`,
        [reservationId],
      );
      expect(afterUncertain.rows[0]).toMatchObject({
        reservation_status: "dispatching",
        phase: "execution",
        process_status: "waiting",
        wait_reason: "runtime_start_reconcile",
      });
      const workAfterUncertain = await client.query<{ count: string }>(
        `SELECT count(*)::text AS count
           FROM trigger_processor.trigger_process_work_items
          WHERE trigger_process_id=$1`,
        [candidate.processId],
      );
      expect(workAfterUncertain.rows[0]!.count).toBe("2");
      const uncertaintyReplay = await client.query<{ result: Record<string, unknown> }>(
        `SELECT trigger_processor.record_runtime_start_uncertain_v1(
           $1,$2,$3,$4::timestamptz,$5::bigint,$6,$7,$8::timestamptz,
           $9,$10::jsonb,$11,$12
         ) AS result`,
        [...uncertaintyCall],
      );
      expect(uncertaintyReplay.rows[0]!.result).toMatchObject({
        applied: false,
        replayed: true,
      });

      const reconcile = afterUncertain.rows[0]!;
      const recomposeTransitionId = `trigger-transition:${candidate.processId}:runtime-start-recompose:${reservationId}`;
      const recomposeEventId = `trigger-event:${candidate.processId}:runtime-start-recompose:${reservationId}`;
      const recomposeEvidence = {
        kind: "runtime_start_recompose",
        reservation_ref: reservationId,
        catalog_conflict_ref: `artifact:catalog-conflict:${candidate.processId}`,
        no_run_proof_ref: `artifact:no-run-proof:${candidate.processId}`,
        expected_process_updated_at: reconcile.process_updated_at,
        process_lock_ref: `trigger_process:${candidate.processId}:runtime_start_reservation_lock`,
        transition_audit_ref: recomposeTransitionId,
        outbox_event_ref: recomposeEventId,
      } as const;
      const recomposeCall = [
        candidate.processId,
        reservationId,
        reconcile.reservation_status,
        reconcile.reservation_updated_at,
        fenceGeneration,
        reconcile.phase,
        reconcile.process_status,
        reconcile.process_updated_at,
        recomposeEvidence,
        sha256(recomposeEvidence),
        candidate.traceId,
      ] as const;
      const recompose = await client.query<{ result: Record<string, unknown> }>(
        `SELECT trigger_processor.schedule_runtime_start_recompose_v1(
           $1,$2,$3,$4::timestamptz,$5::bigint,$6,$7,$8::timestamptz,
           $9::jsonb,$10,$11
         ) AS result`,
        [...recomposeCall],
      );
      expect(recompose.rows[0]!.result).toMatchObject({
        applied: true,
        replayed: false,
        reservation_id: reservationId,
      });
      const committed = await client.query<{
        reservation_status: string;
        phase: string;
        process_status: string;
        wait_reason: string;
        work_kind: string;
        work_status: string;
        payload: Record<string, unknown>;
        payload_hash: `sha256:${string}`;
        evidence_refs: string[];
      }>(
        `SELECT reservation.status AS reservation_status,
                process.phase, process.status AS process_status,
                process.wait_reason, work.work_kind,
                work.status AS work_status, work.payload, work.payload_hash,
                transition.evidence_refs
           FROM trigger_processor.runtime_start_reservations AS reservation
           JOIN trigger_processor.trigger_processes AS process
             ON process.id=reservation.trigger_process_id
           JOIN trigger_processor.trigger_process_work_items AS work
             ON work.trigger_process_id=process.id
            AND work.work_kind='runtime_start_recompose'
           JOIN trigger_processor.trigger_process_transitions AS transition
             ON transition.id=$2
          WHERE reservation.id=$1`,
        [reservationId, recomposeTransitionId],
      );
      const durable = committed.rows[0]!;
      expect(durable).toMatchObject({
        reservation_status: "failed",
        phase: "context",
        process_status: "waiting",
        wait_reason: "runtime_start_recompose",
        work_kind: "runtime_start_recompose",
        work_status: "pending",
      });
      expect(Value.Check(TriggerRuntimeStartRecomposeWorkV1Schema, durable.payload)).toBe(true);
      expect(durable.payload_hash).toBe(sha256(durable.payload));
      expect(durable.payload).toMatchObject({
        old_start_attempt_no: 1,
        old_start_fence_generation: fenceGeneration,
        catalog_conflict_ref: recomposeEvidence.catalog_conflict_ref,
        no_run_proof_ref: recomposeEvidence.no_run_proof_ref,
        previous_context_snapshot_ref: candidate.command.context_snapshot_ref,
        previous_context_snapshot_hash: candidate.command.context_snapshot_hash,
        previous_intent_ref: candidate.command.intent_ref,
        previous_intent_hash: shared.hash,
        request: {
          ...candidate.contextRequest,
          context_version: 2,
          idempotency_key: `${candidate.processId}:context:2`,
        },
      });
      expect(durable.evidence_refs).toEqual(expect.arrayContaining([
        recomposeEvidence.catalog_conflict_ref,
        recomposeEvidence.no_run_proof_ref,
      ]));
      const recomposeReplay = await client.query<{ result: Record<string, unknown> }>(
        `SELECT trigger_processor.schedule_runtime_start_recompose_v1(
           $1,$2,$3,$4::timestamptz,$5::bigint,$6,$7,$8::timestamptz,
           $9::jsonb,$10,$11
         ) AS result`,
        [...recomposeCall],
      );
      expect(recomposeReplay.rows[0]!.result).toMatchObject({
        applied: false,
        replayed: true,
      });
      await expect(client.query(
        `SELECT trigger_processor.schedule_runtime_start_recompose_v1(
           $1,$2,$3,$4::timestamptz,$5::bigint,$6,$7,$8::timestamptz,
           $9::jsonb,$10,$11
         )`,
        [...recomposeCall.slice(0, 8), {
          ...recomposeEvidence,
          no_run_proof_ref: "",
        }, ...recomposeCall.slice(9)],
      )).rejects.toMatchObject({ code: "22023" });
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });

  it("commits started and cooldown snapshots atomically and replays exact duplicates", async () => {
    if (pool === undefined) throw new Error("PAI_TEST_DATABASE_URL is required");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const seeded = await seed(client);
      const started = lifecycleEvent(seeded, "runtime.run.started", 1);
      const first = await callLifecycle(client, "record_runtime_started_v1", seeded, started);
      expect(first).toMatchObject({ code: "snapshot_appended", details: { snapshot_version: 1, duplicate_replayed: false } });
      const replay = await callLifecycle(client, "record_runtime_started_v1", seeded, started);
      expect(replay).toMatchObject({ code: "snapshot_appended", details: { snapshot_version: 1, duplicate_replayed: true } });

      const completed = lifecycleEvent(seeded, "runtime.run.completed", 2);
      const cooldown = await callLifecycle(client, "enter_trigger_cooldown_v1", seeded, completed);
      expect(cooldown).toMatchObject({ code: "snapshot_appended", details: { snapshot_version: 2, duplicate_replayed: false } });
      const state = await client.query(
        `SELECT phase,status,wait_reason,state_version,current_snapshot_id,cooldown_until,
                snapshot_retention_until
           FROM trigger_processor.trigger_processes WHERE id=$1`,
        [seeded.processId],
      );
      expect(state.rows[0]).toMatchObject({
        phase: "cooldown",
        status: "waiting",
        wait_reason: "cooldown_until",
        state_version: "3",
      });
      expect(Date.parse(state.rows[0].snapshot_retention_until)).toBeGreaterThan(
        Date.parse(state.rows[0].cooldown_until),
      );
      const work = await client.query<{
        work_kind: string;
        status: string;
        next_retry_at: string;
        payload: unknown;
      }>(
        `SELECT work_kind,status,next_retry_at,payload FROM trigger_processor.trigger_process_work_items
          WHERE trigger_process_id=$1`,
        [seeded.processId],
      );
      expect(work.rows).toEqual([
        expect.objectContaining({ work_kind: "meta_enqueue", status: "pending" }),
      ]);
      // PostgreSQL returns timestamptz JSON values as `+00:00` by default.
      // The work fence deliberately requires canonical UTC `Z`, so validate
      // the exact durable payload rather than only the process state.
      expect(Value.Check(TriggerMetaEnqueueWorkV1Schema, work.rows[0]!.payload)).toBe(true);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });

  it("queues a source gap without consuming the inbox and appends it after the missing event arrives", async () => {
    if (pool === undefined) throw new Error("PAI_TEST_DATABASE_URL is required");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const seeded = await seed(client);
      const outOfOrder = lifecycleEvent(seeded, "runtime.run.completed", 2);
      const pending = await callLifecycle(
        client,
        "enter_trigger_cooldown_v1",
        seeded,
        outOfOrder,
      );
      expect(pending).toMatchObject({
        code: "snapshot_pending_gap",
        retryable: false,
        details: {
          source_sequence_no: 2,
          expected_source_sequence_no: 1,
          duplicate_replayed: false,
        },
      });
      await expect(
        callLifecycle(
          client,
          "enter_trigger_cooldown_v1",
          seeded,
          outOfOrder,
        ),
      ).resolves.toMatchObject({
        code: "snapshot_pending_gap",
        details: { duplicate_replayed: true },
      });
      expect(
        await client.query(
          `SELECT p.phase,p.status,p.state_version,c.last_append_sequence_no,
                  c.last_sequence_by_source
             FROM trigger_processor.trigger_processes AS p
             JOIN trigger_processor.trigger_snapshot_append_cursors AS c
               ON c.trigger_process_id=p.id
            WHERE p.id=$1`,
          [seeded.processId],
        ),
      ).toMatchObject({
        rows: [{
          phase: "execution",
          status: "waiting",
          state_version: "1",
          last_append_sequence_no: "0",
          last_sequence_by_source: {},
        }],
      });
      expect(
        await client.query(
          `SELECT count(*)::int AS count FROM trigger_processor.trigger_event_inbox
            WHERE event_id=$1`,
          [outOfOrder.event.event_id],
        ),
      ).toMatchObject({ rows: [{ count: 0 }] });
      expect(
        await client.query(
          `SELECT status,source_sequence_no,
                  extract(epoch FROM (next_retry_at-created_at))*1000 AS retry_ms
             FROM trigger_processor.trigger_snapshot_pending_events
            WHERE trigger_process_id=$1`,
          [seeded.processId],
        ),
      ).toMatchObject({
        rows: [expect.objectContaining({ status: "pending", source_sequence_no: "2" })],
      });

      await callLifecycle(
        client,
        "record_runtime_started_v1",
        seeded,
        lifecycleEvent(seeded, "runtime.run.started", 1),
      );
      const repaired = await callLifecycle(
        client,
        "enter_trigger_cooldown_v1",
        seeded,
        outOfOrder,
      );
      expect(repaired).toMatchObject({
        code: "snapshot_appended",
        details: {
          snapshot_version: 2,
          append_sequence_no: 2,
          duplicate_replayed: false,
        },
      });
      expect(
        await client.query(
          `SELECT status FROM trigger_processor.trigger_snapshot_pending_events
            WHERE trigger_process_id=$1 AND source_event_id=$2`,
          [seeded.processId, outOfOrder.event.event_id],
        ),
      ).toMatchObject({ rows: [{ status: "appended" }] });
      expect(
        await client.query(
          `SELECT result,source_event_id
             FROM trigger_processor.trigger_snapshot_append_audits
            WHERE trigger_process_id=$1 AND result='repair_appended'`,
          [seeded.processId],
        ),
      ).toMatchObject({
        rows: [{
          result: "repair_appended",
          source_event_id: `${outOfOrder.event.event_id}:repair-appended`,
        }],
      });
      const late = await callLifecycle(
        client,
        "finalize_trigger_runtime_terminal_v1",
        seeded,
        lifecycleEvent(seeded, "runtime.run.failed", 1),
      );
      expect(late).toMatchObject({
        code: "snapshot_late_event_isolated",
        retryable: false,
        details: {
          source_sequence_no: 1,
          last_contiguous_source_sequence_no: 2,
          duplicate_replayed: false,
        },
      });
      expect(
        await client.query(
          `SELECT count(*)::int AS count FROM trigger_processor.trigger_event_dlq
            WHERE source_event_id=$1`,
          [lifecycleEvent(seeded, "runtime.run.failed", 1).event.event_id],
        ),
      ).toMatchObject({ rows: [{ count: 1 }] });
      expect(
        await client.query(
          `SELECT last_append_sequence_no,last_sequence_by_source
             FROM trigger_processor.trigger_snapshot_append_cursors
            WHERE trigger_process_id=$1`,
          [seeded.processId],
        ),
      ).toMatchObject({
        rows: [{
          last_append_sequence_no: "2",
          last_sequence_by_source: { action_runtime: 2 },
        }],
      });
    } finally {
      await client.query("ROLLBACK").catch(() => undefined);
      client.release();
    }
  });

  it("appends a durable gap marker after timeout and then accepts the pending event", async () => {
    if (pool === undefined) throw new Error("PAI_TEST_DATABASE_URL is required");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const seeded = await seed(client);
      const outOfOrder = lifecycleEvent(seeded, "runtime.run.started", 2);
      const pending = await callLifecycle(
        client,
        "record_runtime_started_v1",
        seeded,
        outOfOrder,
      );
      const pendingEventId = (pending.details as Readonly<Record<string, unknown>>)
        .pending_event_id as string;
      const eligible = await client.query<{ updated_at: string }>(
        `UPDATE trigger_processor.trigger_snapshot_pending_events
            SET next_retry_at=clock_timestamp()-interval '1 second',
                updated_at=clock_timestamp()
          WHERE id=$1
        RETURNING updated_at::text`,
        [pendingEventId],
      );
      const transitioned = await client.query<{
        result: Readonly<Record<string, unknown>>;
      }>(
        `SELECT trigger_processor.transition_trigger_snapshot_pending_event_v1(
           $1,'pending',$2::timestamptz,'gap_skipped','gap-worker:test',NULL,
           '{}'::jsonb
         ) AS result`,
        [pendingEventId, eligible.rows[0]!.updated_at],
      );
      expect(transitioned.rows[0]!.result).toMatchObject({
        transitioned: true,
        pending_event_id: pendingEventId,
        status: "ready",
        gap_marker_appended: true,
        append_sequence_no: 1,
        snapshot_version: 1,
      });
      expect(
        await client.query(
          `SELECT last_append_sequence_no,last_sequence_by_source
             FROM trigger_processor.trigger_snapshot_append_cursors
            WHERE trigger_process_id=$1`,
          [seeded.processId],
        ),
      ).toMatchObject({
        rows: [{
          last_append_sequence_no: "1",
          last_sequence_by_source: { action_runtime: 1 },
        }],
      });
      expect(
        await client.query(
          `SELECT event_type,observation_summary
             FROM trigger_processor.trigger_process_event_projections
            WHERE trigger_process_id=$1`,
          [seeded.processId],
        ),
      ).toMatchObject({
        rows: [expect.objectContaining({
          event_type: "snapshot_gap_skipped",
          observation_summary: expect.objectContaining({
            last_contiguous_source_sequence_no: 0,
            repair_status: "pending",
          }),
        })],
      });
      expect(
        await client.query(
          `SELECT result,missing_source_sequence_range::text AS missing_range
             FROM trigger_processor.trigger_snapshot_append_audits
            WHERE trigger_process_id=$1 AND result='gap_skipped'`,
          [seeded.processId],
        ),
      ).toMatchObject({ rows: [{ result: "gap_skipped", missing_range: "[1,2)" }] });
      expect(
        await client.query(
          `SELECT r.status AS repair_status,w.status AS work_status,
                  p.status AS pending_status,d.last_error->>'code' AS dlq_code
             FROM trigger_processor.trigger_snapshot_repair_jobs AS r
             JOIN trigger_processor.trigger_process_work_items AS w
               ON w.trigger_process_id=r.trigger_process_id
              AND w.work_kind='snapshot_repair'
             JOIN trigger_processor.trigger_snapshot_pending_events AS p
               ON p.trigger_process_id=r.trigger_process_id
             JOIN trigger_processor.trigger_event_dlq AS d
               ON d.event_type='snapshot_gap_skipped'
            WHERE r.trigger_process_id=$1`,
          [seeded.processId],
        ),
      ).toMatchObject({
        rows: [{
          repair_status: "queued",
          work_status: "pending",
          pending_status: "ready",
          dlq_code: "source_sequence_gap_timeout",
        }],
      });
      const appended = await callLifecycle(
        client,
        "record_runtime_started_v1",
        seeded,
        outOfOrder,
      );
      expect(appended).toMatchObject({
        code: "snapshot_appended",
        details: { append_sequence_no: 2, snapshot_version: 2 },
      });
      expect(
        await client.query(
          `SELECT c.last_append_sequence_no,c.last_sequence_by_source,p.status
             FROM trigger_processor.trigger_snapshot_append_cursors AS c
             JOIN trigger_processor.trigger_snapshot_pending_events AS p
               ON p.trigger_process_id=c.trigger_process_id
            WHERE c.trigger_process_id=$1`,
          [seeded.processId],
        ),
      ).toMatchObject({
        rows: [{
          last_append_sequence_no: "2",
          last_sequence_by_source: { action_runtime: 2 },
          status: "appended",
        }],
      });
    } finally {
      await client.query("ROLLBACK").catch(() => undefined);
      client.release();
    }
  });

  it.each(["handled_first", "terminal_first"] as const)(
    "converges cancellation when %s",
    async (order) => {
      if (pool === undefined) throw new Error("PAI_TEST_DATABASE_URL is required");
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const seeded = await seed(client);
        await callLifecycle(
          client,
          "record_runtime_started_v1",
          seeded,
          lifecycleEvent(seeded, "runtime.run.started", 1),
        );
        await markCancelling(client, seeded);
        const handled = lifecycleEvent(
          seeded,
          "runtime.control_signal.handled",
          order === "handled_first" ? 2 : 3,
        );
        const terminal = lifecycleEvent(
          seeded,
          "runtime.run.cancelled",
          order === "handled_first" ? 3 : 2,
        );
        if (order === "handled_first") {
          await callLifecycle(client, "apply_runtime_control_handled_v1", seeded, handled);
          await callLifecycle(client, "finalize_trigger_runtime_terminal_v1", seeded, terminal);
        } else {
          await callLifecycle(client, "finalize_trigger_runtime_terminal_v1", seeded, terminal);
          await callLifecycle(client, "apply_runtime_control_handled_v1", seeded, handled);
        }
        const state = await client.query(
          `SELECT phase,status,cancellation_status,cancellation_isolation_status,
                  terminal_outcome,canonical_reason_code
             FROM trigger_processor.trigger_processes WHERE id=$1`,
          [seeded.processId],
        );
        expect(state.rows[0]).toMatchObject({
          phase: "closed",
          status: "cancelled",
          cancellation_status: "completed",
          cancellation_isolation_status: "safe_point",
          terminal_outcome: "cancelled_with_reason",
          canonical_reason_code: "user_cancelled",
        });
        const cancellation = await client.query(
          `SELECT status,isolation_status,stopped_at_safe_point
             FROM trigger_processor.trigger_process_cancel_requests
            WHERE trigger_process_id=$1`,
          [seeded.processId],
        );
        expect(cancellation.rows[0]).toMatchObject({
          status: "completed",
          isolation_status: "safe_point",
          stopped_at_safe_point: true,
        });
        expect(
          await client.query(
            `SELECT count(*)::int AS count FROM trigger_processor.trigger_process_snapshots
              WHERE trigger_process_id=$1`,
            [seeded.processId],
          ),
        ).toMatchObject({ rows: [{ count: 3 }] });
      } finally {
        await client.query("ROLLBACK");
        client.release();
      }
    },
  );

  it("fails closed when a cancellation reaches an already-terminal Runtime after callback history was lost", async () => {
    if (pool === undefined) throw new Error("PAI_TEST_DATABASE_URL is required");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const seeded = await seed(client);
      await callLifecycle(
        client,
        "record_runtime_started_v1",
        seeded,
        lifecycleEvent(seeded, "runtime.run.started", 1),
      );
      await markCancelling(client, seeded);
      await callLifecycle(
        client,
        "apply_runtime_control_handled_v1",
        seeded,
        lifecycleEvent(
          seeded,
          "runtime.control_signal.handled",
          2,
          { handled_status: "already_terminal" },
        ),
      );

      await expect(client.query(
        `SELECT phase,status,terminal_reason,terminal_outcome,
                canonical_reason_code,cancellation_status,
                cancellation_isolation_status
           FROM trigger_processor.trigger_processes
          WHERE id=$1`,
        [seeded.processId],
      )).resolves.toMatchObject({
        rows: [expect.objectContaining({
          phase: "closed",
          status: "failed",
          terminal_reason: "runtime_terminal_unobserved_before_cancel",
          terminal_outcome: "failed_with_reason",
          canonical_reason_code: "runtime_terminal_unobserved_before_cancel",
          cancellation_status: "completed",
          cancellation_isolation_status: "safe_point",
        })],
      });
      await expect(client.query(
        `SELECT status FROM trigger_processor.runtime_start_reservations
          WHERE trigger_process_id=$1`,
        [seeded.processId],
      )).resolves.toMatchObject({
        rows: [{ status: "cancelled_after_dispatch" }],
      });
    } finally {
      await client.query("ROLLBACK").catch(() => undefined);
      client.release();
    }
  });

  it("rejects a handled event without its durable cancellation owner row", async () => {
    if (pool === undefined) throw new Error("PAI_TEST_DATABASE_URL is required");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const seeded = await seed(client);
      await callLifecycle(
        client,
        "record_runtime_started_v1",
        seeded,
        lifecycleEvent(seeded, "runtime.run.started", 1),
      );
      await expect(
        callLifecycle(
          client,
          "apply_runtime_control_handled_v1",
          seeded,
          lifecycleEvent(seeded, "runtime.control_signal.handled", 2),
        ),
      ).rejects.toMatchObject({ code: "40001" });
    } finally {
      await client.query("ROLLBACK").catch(() => undefined);
      client.release();
    }
  });

  it("reassigns a closed foreground-slot tombstone with a monotonic generation", async () => {
    if (pool === undefined) throw new Error("PAI_TEST_DATABASE_URL is required");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const seeded = await seed(client);
      await callLifecycle(
        client,
        "record_runtime_started_v1",
        seeded,
        lifecycleEvent(seeded, "runtime.run.started", 1),
      );
      await callLifecycle(
        client,
        "finalize_trigger_runtime_terminal_v1",
        seeded,
        lifecycleEvent(seeded, "runtime.run.failed", 2),
      );
      const candidate = await seedRuntimeStartCandidate(client, seeded);
      const result = await createRuntimeStartReservation(client, seeded, candidate);
      expect(result).toMatchObject({
        reserved: true,
        runtime_run_id: candidate.runtimeRunId,
        slot_generation: 3,
        status: "reserved",
      });
      expect(
        await client.query(
          `SELECT process_id,slot_generation FROM trigger_processor.bot_foreground_slots
            WHERE bot_id=$1`,
          [seeded.scope.bot_id],
        ),
      ).toMatchObject({
        rows: [{ process_id: candidate.processId, slot_generation: "3" }],
      });
      expect(
        await client.query(
          `SELECT phase,status,wait_reason,state_version
             FROM trigger_processor.trigger_processes WHERE id=$1`,
          [candidate.processId],
        ),
      ).toMatchObject({
        rows: [{
          phase: "execution",
          status: "waiting",
          wait_reason: "runtime_start",
          state_version: "6",
        }],
      });
    } finally {
      await client.query("ROLLBACK").catch(() => undefined);
      client.release();
    }
  });

  it("rejects runtime start while another process still owns the live slot", async () => {
    if (pool === undefined) throw new Error("PAI_TEST_DATABASE_URL is required");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const seeded = await seed(client);
      const candidate = await seedRuntimeStartCandidate(client, seeded);
      await expect(
        createRuntimeStartReservation(client, seeded, candidate),
      ).rejects.toMatchObject({ code: "40001" });
    } finally {
      await client.query("ROLLBACK").catch(() => undefined);
      client.release();
    }
  });

  it("serializes terminal close and the successor runtime start without deadlock", async () => {
    if (pool === undefined) throw new Error("PAI_TEST_DATABASE_URL is required");
    const setup = await pool.connect();
    let seeded: Awaited<ReturnType<typeof seed>> | undefined;
    let candidate: Awaited<ReturnType<typeof seedRuntimeStartCandidate>> | undefined;
    try {
      await setup.query("BEGIN");
      seeded = await seed(setup);
      await callLifecycle(
        setup,
        "record_runtime_started_v1",
        seeded,
        lifecycleEvent(seeded, "runtime.run.started", 1),
      );
      candidate = await seedRuntimeStartCandidate(setup, seeded);
      await setup.query("COMMIT");
    } catch (error) {
      await setup.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      setup.release();
    }

    const terminalClient = await pool.connect();
    const startClient = await pool.connect();
    try {
      await Promise.all([
        terminalClient.query("SET statement_timeout='5s'"),
        startClient.query("SET statement_timeout='5s'"),
      ]);
      const terminal = lifecycleEvent(seeded, "runtime.run.failed", 2);
      const terminalPromise = callLifecycle(
        terminalClient,
        "finalize_trigger_runtime_terminal_v1",
        seeded,
        terminal,
      );
      const firstStart = await createRuntimeStartReservation(
        startClient,
        seeded,
        candidate,
      ).then(
        (result) => ({ result }),
        (error: unknown) => ({ error }),
      );
      const terminalResult = await terminalPromise;
      expect(terminalResult).toMatchObject({ code: "snapshot_appended" });
      if ("error" in firstStart) {
        expect(firstStart.error).toMatchObject({ code: "40001" });
        await expect(
          createRuntimeStartReservation(startClient, seeded, candidate),
        ).resolves.toMatchObject({ reserved: true, slot_generation: 3 });
      } else {
        expect(firstStart.result).toMatchObject({
          reserved: true,
          slot_generation: 3,
        });
      }
      expect(
        await startClient.query(
          `SELECT process_id,slot_generation FROM trigger_processor.bot_foreground_slots
            WHERE bot_id=$1`,
          [seeded.scope.bot_id],
        ),
      ).toMatchObject({
        rows: [{ process_id: candidate.processId, slot_generation: "3" }],
      });
    } finally {
      terminalClient.release();
      startClient.release();
    }
  });
});
