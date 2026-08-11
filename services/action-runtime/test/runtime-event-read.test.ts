import type { VerifiedWorkloadCredential } from "@pai/auth";
import { canonicalJsonV1, canonicalPayloadHashV1 } from "@pai/eventing";
import { describe, expect, it, vi } from "vitest";

import { buildActionRuntimeApp } from "../src/app.js";
import { createPostgresRuntimeEventOwnerRepositoryV1 } from "../src/db/runtime-event-read-repository.v1.js";
import {
  createRuntimeEventReadApplicationV1,
  type RuntimeEventOwnerRowV1,
} from "../src/runtime-event-read.v1.js";

const at = "2026-07-30T00:00:00.000Z";
const token = "aaa.bbb.ccc";
const event = {
  event_id: "event-1",
  event_type: "runtime.run.started" as const,
  schema_version: "runtime_event.v1" as const,
  producer: "action_runtime" as const,
  occurred_at: at,
  idempotency_key: "run-1:started",
  trace_id: "runtime-trace-1",
  payload: {
    trigger_process_id: "process-1",
    runtime_run_id: "run-1",
    sequence_no: 1,
    workspace_id: "workspace-1",
    bot_id: "bot-1",
    owner_agent_id: "agent-1",
    deployment_environment: "dev" as const,
    release_channel: "stable" as const,
    start_attempt_no: 1,
    start_fence_generation: 1,
    status: "running" as const,
    previous_status: "queued" as const,
    next_status: "running" as const,
    model: "claude-sonnet-pinned",
    reason: null,
    duration_ms: null,
    reason_code: null,
    error_summary: null,
    terminal_artifact_ref: null,
  },
};
const eventHash = canonicalPayloadHashV1(event);
const request = {
  schema_version: "runtime_event_resolve_request.v1" as const,
  source_event_id: "event-1",
  payload_ref: "runtime_event:event-1",
  runtime_run_id: "run-1",
  trigger_process_id: "process-1",
  source_sequence_no: 1,
  expected_payload_hash: eventHash,
  workspace_id: "workspace-1",
  bot_id: "bot-1",
  owner_agent_id: "agent-1",
  deployment_environment: "dev" as const,
  release_channel: "stable" as const,
  purpose: "trigger_snapshot_append" as const,
  trace_id: "caller-trace-1",
};

function ownerRow(
  overrides: Partial<RuntimeEventOwnerRowV1> = {},
): RuntimeEventOwnerRowV1 {
  return {
    source_event_id: "event-1",
    payload_ref: "runtime_event:event-1",
    payload_hash: eventHash,
    runtime_run_id: "run-1",
    trigger_process_id: "process-1",
    source_sequence_no: "1",
    workspace_id: "workspace-1",
    bot_id: "bot-1",
    owner_agent_id: "agent-1",
    deployment_environment: "dev",
    release_channel: "stable",
    owner_start_attempt_no: "1",
    owner_start_fence_generation: "1",
    runtime_event: event,
    envelope_canonical_base64: Buffer.from(
      canonicalJsonV1(event),
      "utf8",
    ).toString("base64"),
    retention_until: "2026-08-30T00:00:00.000Z",
    redaction_state: "complete",
    ...overrides,
  };
}

const principal = {
  sub: "trigger_processor" as const,
  aud: "action_runtime" as const,
  capability: ["runtime.event.resolve"],
  scope: {
    workspace_id: "workspace-1",
    bot_id: "bot-1",
    owner_agent_id: "agent-1",
    deployment_environment: "dev" as const,
    release_channel: "stable" as const,
  },
};

function credential(): VerifiedWorkloadCredential {
  return {
    claims: {
      iss: "pai-workload",
      sub: "trigger_processor",
      aud: "action_runtime",
      jti: "credential-1",
      iat: 100,
      nbf: 100,
      exp: 200,
      capability: ["runtime.event.resolve"],
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

describe("Action Runtime owner event resolver", () => {
  it("returns only the immutable owner row after canonical hash and scope checks", async () => {
    const findByOwnerIdentity = vi.fn(async () =>
      ownerRow({ retention_until: "2026-08-30T00:00:00.123456Z" }),
    );
    const application = createRuntimeEventReadApplicationV1(
      { findByOwnerIdentity },
      { now: () => new Date(at) },
    );
    await expect(application.resolve(principal, request)).resolves.toEqual(
      expect.objectContaining({
        schema_version: "runtime_event_read.v1",
        runtime_event: event,
        payload_hash: eventHash,
        retention_until: "2026-08-30T00:00:00.123456Z",
        trace_id: "caller-trace-1",
      }),
    );
    expect(findByOwnerIdentity).toHaveBeenCalledWith(
      "event-1",
      "runtime_event:event-1",
      expect.any(AbortSignal),
    );
  });

  it("canonical-preflights accessor, Proxy, and over-depth owner rows before field traversal", async () => {
    let accessorReads = 0;
    const accessorRow = ownerRow();
    Object.defineProperty(accessorRow, "runtime_event", {
      configurable: true,
      enumerable: true,
      get() {
        accessorReads += 1;
        return event;
      },
    });
    let proxyReads = 0;
    const proxyRow = new Proxy(ownerRow(), {
      get(_target, property) {
        if (property === "then") return undefined;
        proxyReads += 1;
        throw new Error("Proxy property traversal is forbidden");
      },
    });
    let deep: Record<string, unknown> = { leaf: true };
    for (let depth = 0; depth < 130; depth += 1) {
      deep = { nested: deep };
    }
    const deepRow = ownerRow({
      runtime_event: {
        ...event,
        unexpected_deep_value: deep,
      },
    });

    for (const row of [accessorRow, proxyRow, deepRow]) {
      const application = createRuntimeEventReadApplicationV1(
        {
          async findByOwnerIdentity() {
            return row;
          },
        },
        { now: () => new Date(at) },
      );
      await expect(
        application.resolve(principal, request),
      ).rejects.toMatchObject({
        code: "event_schema_incompatible",
      });
    }
    expect(accessorReads).toBe(0);
    expect(proxyReads).toBe(0);
  });

  it.each([
    ["event_not_found", undefined],
    ["event_scope_mismatch", ownerRow({ workspace_id: "workspace-other" })],
    [
      "event_schema_incompatible",
      ownerRow({
        runtime_event: {
          ...event,
          payload: { ...event.payload, workspace_id: "workspace-other" },
        },
      }),
    ],
    ["event_scope_mismatch", ownerRow({ owner_start_fence_generation: "2" })],
    ["event_hash_mismatch", ownerRow({ payload_hash: `sha256:${"0".repeat(64)}` })],
    ["event_schema_incompatible", ownerRow({ envelope_canonical_base64: Buffer.from("{}", "utf8").toString("base64") })],
    ["event_expired", ownerRow({ retention_until: at })],
    ["event_redaction_incomplete", ownerRow({ redaction_state: "pending" })],
  ] as const)("maps durable drift to %s", async (code, row) => {
    const application = createRuntimeEventReadApplicationV1(
      { async findByOwnerIdentity() { return row; } },
      { now: () => new Date(at) },
    );
    await expect(application.resolve(principal, request)).rejects.toMatchObject({
      code,
    });
  });

  it("queries only runtime_events plus runtime_runs and never trusts outbox/body projections", async () => {
    const query = vi.fn(async () => ({ rows: [ownerRow()] }));
    const repository = createPostgresRuntimeEventOwnerRepositoryV1({ query });
    await repository.findByOwnerIdentity(
      "event-1",
      "runtime_event:event-1",
      new AbortController().signal,
    );
    const [sql, values] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain("action_runtime.runtime_events");
    expect(sql).toContain("action_runtime.runtime_runs");
    expect(sql).not.toContain("runtime_event_outbox");
    expect(sql).toContain("pg_catalog.replace");
    expect(sql).toContain("pg_catalog.to_char");
    expect(sql).toContain("YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"");
    expect(sql).toContain("e.id = $1::text");
    expect(sql).toContain("e.payload_ref = $2::text");
    expect(values).toEqual(["event-1", "runtime_event:event-1"]);
  });

  it("enforces workload identity and emits the documented error body", async () => {
    const requirements: unknown[] = [];
    const application = createRuntimeEventReadApplicationV1(
      { async findByOwnerIdentity() { return undefined; } },
      { now: () => new Date(at) },
    );
    const app = buildActionRuntimeApp(
      {
        logger: false,
        auth: {
          verifier: {
            async verify(_value, expected) {
              requirements.push(expected);
              return credential();
            },
          },
        },
      },
      { runtime_event_read: application },
    );
    const response = await app.inject({
      method: "POST",
      url: "/internal/runtime-events:resolve",
      headers: { authorization: `Bearer ${token}` },
      payload: request,
    });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      schema_version: "runtime_event_read_error.v1",
      code: "event_not_found",
      message: "Runtime event was not found",
      retryable: false,
      trace_id: "caller-trace-1",
      details: {
        source_event_id: "event-1",
        payload_ref: "runtime_event:event-1",
        runtime_run_id: "run-1",
        source_sequence_no: 1,
      },
    });
    expect(requirements).toEqual([
      {
        audience: "action_runtime",
        allowedCallers: ["trigger_processor"],
        requiredCapabilities: ["runtime.event.resolve"],
      },
    ]);
    await app.close();
  });

  it("maps malformed canonical resolve bodies to the published 400 error without reading owner state", async () => {
    const findByOwnerIdentity = vi.fn(async () => ownerRow());
    const application = createRuntimeEventReadApplicationV1(
      { findByOwnerIdentity },
      { now: () => new Date(at) },
    );
    const app = buildActionRuntimeApp(
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
      { runtime_event_read: application },
    );
    let deep: Record<string, unknown> = { leaf: true };
    for (let depth = 0; depth < 130; depth += 1) {
      deep = { nested: deep };
    }
    for (const payload of [
      { ...request, trace_id: "\ud800" },
      { ...request, unexpected_deep_value: deep },
      { ...request, unexpected_value: true },
      { ...request, source_sequence_no: "1" },
    ]) {
      const response = await app.inject({
        method: "POST",
        url: "/internal/runtime-events:resolve",
        headers: { authorization: `Bearer ${token}` },
        payload,
      });
      expect(response.statusCode, response.body).toBe(400);
      expect(response.json()).toMatchObject({
        code: "schema_validation_failed",
        retryable: false,
      });
    }
    expect(findByOwnerIdentity).not.toHaveBeenCalled();
    await app.close();
  });

  it("fails production readiness closed until the reader is composed", async () => {
    const app = buildActionRuntimeApp(
      { logger: false },
      {},
      { require_complete_pipeline: true },
    );
    const response = await app.inject({ method: "GET", url: "/ready" });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      checks: [
        { name: "tool_permission_profile_reader", status: "down" },
        { name: "runtime_event_reader", status: "down" },
        { name: "runtime_final_result_reader", status: "down" },
        { name: "runtime_execution", status: "down" },
        { name: "runtime_query", status: "down" },
        { name: "runtime_token_stream", status: "down" },
      ],
    });
    await app.close();
  });
});
