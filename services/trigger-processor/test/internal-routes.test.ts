import type { VerifiedWorkloadCredential } from "@pai/auth";
import { OwnerRepositoryTransientErrorV1 } from "@pai/persistence";
import { describe, expect, it, vi } from "vitest";

import { buildTriggerProcessorApp } from "../src/app.js";
import { processDetailsFixtureV1 } from "./contracts/process-query.contract.js";

const token = "aaa.bbb.ccc";
const at = "2026-07-30T00:00:00.000Z";

function credential(
  sub:
    | "trigger_processor"
    | "action_runtime"
    | "observation_gateway"
    | "timer_trigger_app",
  capability: readonly string[],
): VerifiedWorkloadCredential {
  return {
    claims: {
      iss: "pai-workload",
      sub,
      aud: "trigger_processor",
      jti: `credential-${sub}`,
      iat: 100,
      nbf: 100,
      exp: 200,
      capability: [...capability],
      scope_kind: "bot",
      workspace_id: "workspace-1",
      bot_id: "bot-1",
      owner_agent_id: "agent-1",
      deployment_environment: "dev",
      release_channel: "stable",
    },
    protectedHeader: { alg: "EdDSA", kid: "key-1", typ: "JWT" },
  };
}

const contextBody = {
  schema_version: "context_compose_request.v1",
  trigger_process_id: "process-1",
  workspace_id: "workspace-1",
  bot_id: "bot-1",
  owner_agent_id: "agent-1",
  deployment_environment: "dev",
  release_channel: "stable",
  trigger: { trigger_id: "trigger-1", source: "chat", actor_type: "user" },
  context_version: 1,
  source_policy: {
    required_sources: ["environment"],
    allowed_sources: ["knowthat", "memory", "skill", "environment", "history"],
    skip_decisions: [],
  },
  idempotency_key: "process-1:context:1",
  trace_id: "caller-trace",
} as const;

describe("Trigger Processor internal owner routes", () => {
  it("rejects over-depth JSON before Fastify schema recursion or application effects", async () => {
    const composeContext = vi.fn();
    let nested: Record<string, unknown> = {};
    for (let depth = 0; depth < 130; depth += 1) {
      nested = { nested };
    }
    const app = buildTriggerProcessorApp(
      {
        logger: false,
        auth: {
          verifier: {
            async verify() {
              return credential("trigger_processor", [
                "trigger.context.compose",
              ]);
            },
          },
        },
      },
      undefined,
      undefined,
      undefined,
      {
        lifecycle: {
          composeContext,
          async synthesizeIntent() { throw new Error("unused"); },
          async reserveRuntimeStart() { throw new Error("unused"); },
          async appendRuntimeEvent() { throw new Error("unused"); },
          async enqueueMeta() { throw new Error("unused"); },
        },
      },
    );
    const response = await app.inject({
      method: "POST",
      url: "/internal/context/compose",
      headers: { authorization: `Bearer ${token}` },
      payload: { ...contextBody, nested },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: "invalid_request" });
    expect(composeContext).not.toHaveBeenCalled();
    await app.close();
  });

  it("derives Observation snapshot identity grants only from verified workload capabilities", async () => {
    const getProcess = vi.fn(async (
      _principal: unknown,
      _processId: string,
      traceId: string,
    ) => ({
      code: "trigger_process_found" as const,
      message: "trigger process found",
      retryable: false as const,
      trace_id: traceId,
      details: processDetailsFixtureV1,
    }));
    const app = buildTriggerProcessorApp(
      {
        logger: false,
        auth: {
          verifier: {
            async verify() {
              return credential("observation_gateway", [
                "trigger.process.read",
                "trigger.process.snapshot.resolve",
              ]);
            },
          },
        },
      },
      undefined,
      undefined,
      {
        getProcess,
        async streamProcessEvents() {
          throw new Error("unused");
        },
      },
    );
    const response = await app.inject({
      method: "GET",
      url: "/v1/trigger-processes/tp-1",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(200);
    expect(getProcess).toHaveBeenCalledWith(
      expect.objectContaining({
        principal_type: "service",
        principal_id: "observation_gateway",
        process_snapshot_identity_grant: {
          capability: "trigger.process.snapshot.resolve",
          purpose: "observation_replay",
        },
      }),
      "tp-1",
      expect.any(String),
    );
    expect(getProcess.mock.calls[0]?.[0]).not.toHaveProperty(
      "context_snapshot_identity_grant",
    );
    await app.close();
  });

  it("fails production readiness closed when a required pipeline application is absent", async () => {
    const app = buildTriggerProcessorApp(
      { logger: false },
      undefined,
      undefined,
      undefined,
      {},
      { require_complete_pipeline: true },
    );
    const ready = await app.inject({ method: "GET", url: "/ready" });
    expect(ready.statusCode).toBe(503);
    expect(ready.json()).toMatchObject({
      status: "not_ready",
      checks: [
        {
          name: "trigger_pipeline",
          status: "down",
        },
      ],
    });
    await app.close();
  });

  it("starts recovery before readiness and stops it with the service", async () => {
    let state: "idle" | "running" | "stopped" = "idle";
    const runner = {
      get state() { return state; },
      start() { state = "running"; },
      async stop() { state = "stopped"; },
    } as const;
    const app = buildTriggerProcessorApp(
      { logger: false },
      undefined,
      undefined,
      undefined,
      { recovery_runner: runner as never },
    );
    await app.ready();
    expect(state).toBe("running");
    const ready = await app.inject({ method: "GET", url: "/ready" });
    expect(ready.statusCode).toBe(200);
    await app.close();
    expect(state).toBe("stopped");
  });

  it("authenticates Context Compose as the exact self-orchestrator bot scope", async () => {
    const requirements: unknown[] = [];
    const composeContext = vi.fn(async (request: unknown) => ({
      code: "context_composed" as const,
      message: "context composed",
      retryable: false as const,
      trace_id: (request as { trace_id: string }).trace_id,
      details: {
        context_snapshot_ref: "context:1",
        context_snapshot_version: 1,
        context_snapshot_hash: `sha256:${"1".repeat(64)}`,
        source_status: [
          { source: "knowthat", status: "empty", retrieved_at: at, source_as_of: at, source_version: "knowthat.v1", latency_ms: 1, result_count: 0, failure_reason: null },
          { source: "memory", status: "empty", retrieved_at: at, source_as_of: at, source_version: "memory.v1", latency_ms: 1, result_count: 0, failure_reason: null },
          { source: "skill", status: "empty", retrieved_at: at, source_as_of: at, source_version: "cat_1", latency_ms: 1, result_count: 0, failure_reason: null },
          { source: "environment", status: "ok", retrieved_at: at, source_as_of: at, source_version: "environment.v1", latency_ms: 1, result_count: 1, failure_reason: null },
          { source: "history", status: "empty", retrieved_at: at, source_as_of: at, source_version: "history.v1", latency_ms: 1, result_count: 0, failure_reason: null },
        ],
        assembly_notes: [],
      },
    }));
    const app = buildTriggerProcessorApp(
      {
        logger: false,
        auth: {
          verifier: {
            async verify(_token, value) {
              requirements.push(value);
              return credential("trigger_processor", ["trigger.context.compose"]);
            },
          },
        },
      },
      undefined,
      undefined,
      undefined,
      {
        lifecycle: {
          composeContext,
          async synthesizeIntent() { throw new Error("unused"); },
          async reserveRuntimeStart() { throw new Error("unused"); },
          async appendRuntimeEvent() { throw new Error("unused"); },
          async enqueueMeta() { throw new Error("unused"); },
        },
      },
    );

    const response = await app.inject({
      method: "POST",
      url: "/internal/context/compose",
      headers: {
        authorization: `Bearer ${token}`,
        "x-pai-work-item-id": "work-1",
        "x-pai-work-claim-token": "claim-token-1",
        "x-pai-work-lease-owner": "worker-1",
        "x-pai-work-lease-generation": "1",
        "x-pai-work-expected-process-state-version": "1",
        "x-pai-work-payload-hash":
          `sha256:${"a".repeat(64)}`,
      },
      payload: contextBody,
    });
    expect(response.statusCode).toBe(200);
    expect(composeContext).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger_process_id: "process-1",
        trace_id: "caller-trace",
      }),
      {
        work_item_id: "work-1",
        claim_token: "claim-token-1",
        lease_owner: "worker-1",
        lease_generation: 1,
        expected_process_state_version: 1,
        payload_hash: `sha256:${"a".repeat(64)}`,
      },
    );
    expect(requirements).toEqual([
      {
        audience: "trigger_processor",
        allowedCallers: ["trigger_processor"],
        requiredCapabilities: ["trigger.context.compose"],
      },
    ]);
    await app.close();
  });

  it("derives Context snapshot consumer identity from the workload principal", async () => {
    const snapshotHash = `sha256:${"1".repeat(64)}` as const;
    const snapshot = {
      schema_version: "context_snapshot.v1" as const,
      trigger_process_id: "process-1",
      context_version: 1,
      workspace_id: "workspace-1",
      bot_id: "bot-1",
      owner_agent_id: "agent-1",
      deployment_environment: "dev" as const,
      release_channel: "stable" as const,
      pinned_facts: [],
      memory_context: [],
      skill_catalog: null,
      environment: {
        captured_at: at,
        channel: "chat",
        timezone: "Asia/Shanghai",
        capability_summary_ref: "capabilities:1",
      },
      history: [],
      source_status: [
        { source: "knowthat" as const, status: "empty" as const, retrieved_at: at, source_as_of: at, source_version: "knowthat.v1", latency_ms: 1, result_count: 0, failure_reason: null },
        { source: "memory" as const, status: "empty" as const, retrieved_at: at, source_as_of: at, source_version: "memory.v1", latency_ms: 1, result_count: 0, failure_reason: null },
        { source: "skill" as const, status: "failed" as const, retrieved_at: at, source_as_of: null, source_version: null, latency_ms: 1, result_count: 0, failure_reason: "skill_unavailable" },
        { source: "environment" as const, status: "ok" as const, retrieved_at: at, source_as_of: at, source_version: "environment.v1", latency_ms: 1, result_count: 1, failure_reason: null },
        { source: "history" as const, status: "empty" as const, retrieved_at: at, source_as_of: at, source_version: "history.v1", latency_ms: 1, result_count: 0, failure_reason: null },
      ],
      assembly_notes: ["skill_unavailable"],
      snapshot_hash: snapshotHash,
    };
    const resolve = vi.fn(async () => ({
      schema_version: "context_snapshot_read.v1" as const,
      context_snapshot_ref: "context:1",
      context_snapshot_version: 1,
      context_snapshot_hash: snapshotHash,
      canonical_bytes_sha256: `sha256:${"2".repeat(64)}` as const,
      content_length_bytes: 1,
      delivery_mode: "inline" as const,
      context_snapshot: snapshot,
      chunks: null,
      retention_until: "2026-08-30T00:00:00.000Z",
      redaction_state: "complete" as const,
      resolved_at: at,
      trace_id: "server-trace",
    }));
    const app = buildTriggerProcessorApp(
      {
        logger: false,
        auth: {
          verifier: {
            async verify() {
              return credential("action_runtime", [
                "trigger.context_snapshot.resolve",
              ]);
            },
          },
        },
      },
      undefined,
      undefined,
      undefined,
      { context_snapshot_read: { resolve } },
    );
    const response = await app.inject({
      method: "POST",
      url: "/internal/context-snapshots:resolve",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        schema_version: "context_snapshot_resolve_request.v1",
        consumer_service: "action_runtime",
        trigger_process_id: "process-1",
        workspace_id: "workspace-1",
        bot_id: "bot-1",
        owner_agent_id: "agent-1",
        deployment_environment: "dev",
        release_channel: "stable",
        context_snapshot_ref: "context:1",
        context_snapshot_version: 1,
        context_snapshot_hash: snapshotHash,
        purpose: "runtime_start",
        trace_id: "caller-trace",
      },
    });
    expect(response.statusCode).toBe(200);
    expect(resolve).toHaveBeenCalledWith(
      expect.objectContaining({
        service_id: "action_runtime",
        scope: expect.objectContaining({ bot_id: "bot-1" }),
      }),
      expect.objectContaining({
        trigger_process_id: "process-1",
        trace_id: "caller-trace",
      }),
    );
    await app.close();
  });

  it("derives Runtime Append identity from workload claims and rejects path drift", async () => {
    const appendRuntimeEvent = vi.fn(async () => ({
      code: "snapshot_appended" as const,
      message: "snapshot appended",
      retryable: false as const,
      trace_id: "server-trace",
      details: {
        trigger_process_id: "process-1",
        snapshot_version: 2,
        append_sequence_no: 2,
        last_sequence_by_source: { action_runtime: 1 },
        duplicate_replayed: false,
      },
    }));
    const app = buildTriggerProcessorApp(
      {
        logger: false,
        auth: {
          verifier: {
            async verify() {
              return credential("action_runtime", [
                "trigger.process.snapshot.append",
              ]);
            },
          },
        },
      },
      undefined,
      undefined,
      undefined,
      {
        lifecycle: {
          async composeContext() { throw new Error("unused"); },
          async synthesizeIntent() { throw new Error("unused"); },
          async reserveRuntimeStart() { throw new Error("unused"); },
          appendRuntimeEvent,
          async enqueueMeta() { throw new Error("unused"); },
        },
      },
    );
    const body = {
      trigger_process_id: "process-1",
      runtime_run_id: "run-1",
      source_event_id: "event-1",
      source_service: "action_runtime",
      source_sequence_no: 1,
      event_type: "runtime.run.completed",
      schema_version: "runtime_event.v1",
      occurred_at: at,
      trace_id: "caller-trace",
      append_type: "runtime_event",
      payload_ref: "runtime-event:1",
      payload_hash: `sha256:${"2".repeat(64)}`,
      observation_summary: {
        runtime_run_id: "run-1",
        status: "completed",
        duration_ms: 1,
        reason_code: null,
        error_summary: null,
        artifact_ref: null,
      },
      idempotency_key: "action_runtime:event-1",
    } as const;

    const response = await app.inject({
      method: "POST",
      url: "/internal/trigger-processes/process-1/runtime-events",
      headers: { authorization: `Bearer ${token}` },
      payload: body,
    });
    expect(response.statusCode).toBe(200);
    expect(appendRuntimeEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        authenticated_principal: expect.objectContaining({
          sub: "action_runtime",
          workspace_id: "workspace-1",
          bot_id: "bot-1",
        }),
        request: expect.objectContaining({ trace_id: "caller-trace" }),
      }),
    );

    const drift = await app.inject({
      method: "POST",
      url: "/internal/trigger-processes/process-other/runtime-events",
      headers: { authorization: `Bearer ${token}` },
      payload: body,
    });
    expect(drift.statusCode).toBe(400);
    expect(appendRuntimeEvent).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it("binds Runtime Start reservation validation to Action Runtime workload scope and path", async () => {
    const requirements: unknown[] = [];
    const validate = vi.fn(async () => ({
      schema_version: "runtime_start_reservation_validate_response.v1" as const,
      validation_result: "valid" as const,
      reservation_status: "dispatching" as const,
      validated_fence_generation: 7,
      validation_stage: "before_running" as const,
      duplicate_replayed: false,
      trace_id: "server-trace",
    }));
    const app = buildTriggerProcessorApp(
      {
        logger: false,
        auth: {
          verifier: {
            async verify(_token, value) {
              requirements.push(value);
              return credential("action_runtime", [
                "trigger.runtime_start.reservation.validate",
              ]);
            },
          },
        },
      },
      undefined,
      undefined,
      undefined,
      {
        runtime_start_reservation_validation: { validate },
      },
    );
    const response = await app.inject({
      method: "POST",
      url: "/internal/trigger-processes/process-1/runtime-start-reservations/3/validate",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        schema_version: "runtime_start_reservation_validate_request.v1",
        runtime_run_id: "run-1",
        start_fence_token_hash: `sha256:${"b".repeat(64)}`,
        request_hash: `sha256:${"a".repeat(64)}`,
        validation_stage: "before_running",
        trace_id: "caller-trace",
      },
    });
    expect(response.statusCode).toBe(200);
    expect(validate).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: "action_runtime",
        workspace_id: "workspace-1",
        bot_id: "bot-1",
      }),
      { trigger_process_id: "process-1", start_attempt_no: 3 },
      expect.objectContaining({
        runtime_run_id: "run-1",
        trace_id: "caller-trace",
      }),
    );
    expect(requirements).toEqual([
      {
        audience: "trigger_processor",
        allowedCallers: ["action_runtime"],
        requiredCapabilities: [
          "trigger.runtime_start.reservation.validate",
        ],
      },
    ]);

    const mixedFenceProof = await app.inject({
      method: "POST",
      url: "/internal/trigger-processes/process-1/runtime-start-reservations/3/validate",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        schema_version: "runtime_start_reservation_validate_request.v1",
        runtime_run_id: "run-1",
        start_fence_token: "fence-token-1",
        start_fence_token_hash: `sha256:${"b".repeat(64)}`,
        request_hash: `sha256:${"a".repeat(64)}`,
        validation_stage: "before_running",
        trace_id: "caller-trace",
      },
    });
    expect(mixedFenceProof.statusCode).toBe(422);
    expect(mixedFenceProof.json()).toMatchObject({
      schema_version: "runtime_start_reservation_validate_error.v1",
      code: "schema_validation_failed",
      retryable: false,
      trace_id: "caller-trace",
      details: {
        trigger_process_id: "process-1",
        start_attempt_no: 3,
        validation_stage: "before_running",
        field_path: "/body",
        reason: "malformed_request",
      },
    });
    expect(validate).toHaveBeenCalledTimes(1);

    const unsafeAttempt = await app.inject({
      method: "POST",
      url: `/internal/trigger-processes/process-1/runtime-start-reservations/${Number.MAX_SAFE_INTEGER + 1}/validate`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        schema_version: "runtime_start_reservation_validate_request.v1",
        runtime_run_id: "run-1",
        start_fence_token: "fence-token-1",
        request_hash: `sha256:${"a".repeat(64)}`,
        validation_stage: "request_received",
        trace_id: "caller-trace",
      },
    });
    expect(unsafeAttempt.statusCode).toBe(422);
    expect(unsafeAttempt.json()).toMatchObject({
      schema_version: "runtime_start_reservation_validate_error.v1",
      code: "schema_validation_failed",
      retryable: false,
      trace_id: "caller-trace",
      details: {
        trigger_process_id: "process-1",
        start_attempt_no: null,
        validation_stage: "request_received",
        field_path: "/path",
        reason: "malformed_path",
      },
    });
    expect(validate).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it("uses exact fail-closed Runtime Start validation envelopes", async () => {
    const validate = vi
      .fn()
      .mockRejectedValueOnce(
        new OwnerRepositoryTransientErrorV1(
          "transient_database_error",
          "private database hostname",
        ),
      )
      .mockRejectedValueOnce(new Error("private internal detail"));
    const app = buildTriggerProcessorApp(
      {
        logger: false,
        auth: {
          verifier: {
            async verify() {
              return credential("action_runtime", [
                "trigger.runtime_start.reservation.validate",
              ]);
            },
          },
        },
      },
      undefined,
      undefined,
      undefined,
      {
        runtime_start_reservation_validation: { validate },
      },
    );
    const payload = {
      schema_version: "runtime_start_reservation_validate_request.v1",
      runtime_run_id: "run-1",
      start_fence_token: "fence-token-1",
      request_hash: `sha256:${"a".repeat(64)}`,
      validation_stage: "request_received",
      trace_id: "caller-trace",
    } as const;

    const malformedStage = await app.inject({
      method: "POST",
      url: "/internal/trigger-processes/process-1/runtime-start-reservations/3/validate",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        ...payload,
        validation_stage: "invented_stage",
      },
    });
    expect(malformedStage.statusCode).toBe(422);
    expect(malformedStage.json()).toMatchObject({
      schema_version: "runtime_start_reservation_validate_error.v1",
      code: "schema_validation_failed",
      retryable: false,
      trace_id: "caller-trace",
      details: {
        trigger_process_id: "process-1",
        start_attempt_no: 3,
        validation_stage: null,
        field_path: "/body/validation_stage",
        reason: "malformed_request",
      },
    });
    expect(validate).not.toHaveBeenCalled();

    const unavailable = await app.inject({
      method: "POST",
      url: "/internal/trigger-processes/process-1/runtime-start-reservations/3/validate",
      headers: { authorization: `Bearer ${token}` },
      payload,
    });
    expect(unavailable.statusCode).toBe(503);
    expect(unavailable.json()).toEqual({
      schema_version: "runtime_start_reservation_validate_error.v1",
      code: "storage_unavailable",
      message: "Runtime Start reservation validation is unavailable",
      retryable: true,
      trace_id: "caller-trace",
      details: {
        trigger_process_id: "process-1",
        start_attempt_no: 3,
        validation_stage: "request_received",
        diagnostic_ref: "runtime_start_reservation_validation:postgres",
      },
    });
    expect(unavailable.payload).not.toContain("private database hostname");

    const internal = await app.inject({
      method: "POST",
      url: "/internal/trigger-processes/process-1/runtime-start-reservations/3/validate",
      headers: { authorization: `Bearer ${token}` },
      payload,
    });
    expect(internal.statusCode).toBe(500);
    expect(internal.json()).toEqual({
      schema_version: "runtime_start_reservation_validate_error.v1",
      code: "internal_error",
      message: "Runtime Start reservation validation failed internally",
      retryable: false,
      trace_id: "caller-trace",
      details: {
        trigger_process_id: "process-1",
        start_attempt_no: 3,
        validation_stage: "request_received",
        diagnostic_ref: "runtime_start_reservation_validation:internal",
      },
    });
    expect(internal.payload).not.toContain("private internal detail");
    expect(validate).toHaveBeenCalledTimes(2);
    await app.close();
  });
});
