import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  FileObservationAccessAuditSpoolV1,
  createObservationProductionHttpPortsV1,
  parseObservationAllowedCallersV1,
} from "../dist/index.js";

const TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736";
const scope = Object.freeze({
  workspace_id: "workspace-1",
  bot_id: "bot-1",
  owner_agent_id: "agent-1",
  deployment_environment: "local",
  release_channel: "stable",
});
const delegated = Object.freeze({
  principal_type: "operator",
  principal_id: "operator-1",
  roles: ["observation.viewer", "observation.debug_viewer"],
  source_issuer: "test",
  source_subject: "operator-1",
  auth_time: 1,
  scope_kind: "bot",
  ...scope,
});

function auditRecord(auditId) {
  return Object.freeze({
    audit_id: auditId,
    occurred_at: "2026-07-27T00:00:00.000Z",
    actor_identity: "operator:operator-1",
    service_identity: "trigger_processor",
    roles: ["observation.viewer"],
    ...scope,
    resource_type: "trigger_process",
    resource_id: "process-1",
    endpoint: "snapshot",
    include_ephemeral_tokens: false,
    decision: "allowed",
    status_code: 200,
    trace_id: TRACE_ID,
    connection_duration_ms: 0,
    redacted_field_count: 0,
  });
}

test("durable access audit survives restart and deduplicates the stable audit id", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pai-observation-audit-"));
  const path = join(directory, "access-audit.jsonl");
  try {
    const first = new FileObservationAccessAuditSpoolV1({ path });
    await first.checkReadiness();
    assert.equal(await first.enqueue(auditRecord("audit-1")), "durable");
    assert.equal(await first.enqueue(auditRecord("audit-1")), "durable");

    const restarted = new FileObservationAccessAuditSpoolV1({ path });
    await restarted.checkReadiness();
    assert.equal(await restarted.enqueue(auditRecord("audit-1")), "durable");
    assert.equal((await readFile(path, "utf8")).trim().split("\n").length, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("production HTTP ports sign delegated /v1 reads and parse token SSE without durable ids", async () => {
  const signed = [];
  const requests = [];
  const signer = {
    async sign(input) {
      signed.push(input);
      return "header.payload.signature";
    },
  };
  const fetchImpl = async (input, init) => {
    const url = String(input);
    requests.push({ url, init });
    if (url.endsWith("/v1/runtime-runs/run-1")) {
      return new Response(JSON.stringify({
        code: "runtime_run_found",
        message: "runtime run found",
        retryable: false,
        trace_id: TRACE_ID,
        details: { runtime_run: { runtime_run_id: "run-1" } },
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.endsWith("/internal/runtime-runs/run-1/tokens")) {
      return new Response(
        `event: runtime_token\ndata: ${JSON.stringify({
          schema_version: "runtime_token_sse_event.v1",
          runtime_run_id: "run-1",
          trigger_process_id: "process-1",
          token: "hello",
          emitted_at: "2026-07-27T00:00:00.000Z",
        })}\n\n`,
        { status: 200, headers: { "content-type": "text/event-stream; charset=utf-8" } },
      );
    }
    throw new Error(`unexpected request ${url}`);
  };
  const ports = createObservationProductionHttpPortsV1({
    trigger_processor_url: "http://127.0.0.1:3001",
    action_runtime_url: "http://127.0.0.1:3002",
    meta_cognition_url: "http://127.0.0.1:3003",
    signer,
    fetch: fetchImpl,
  });

  const details = await ports.runtime.getRun({
    workload: { sub: "observation_gateway", aud: "action_runtime", capability: "runtime.run.read" },
    delegated_principal: delegated,
    scope,
    trigger_process_id: "process-1",
    runtime_run_id: "run-1",
    trace_id: TRACE_ID,
  });
  assert.equal(details.runtime_run.runtime_run_id, "run-1");

  const tokens = [];
  for await (const token of ports.runtime.streamTokens({
    workload: { sub: "observation_gateway", aud: "action_runtime", capability: "runtime.debug_tokens" },
    delegated_principal: delegated,
    scope,
    trigger_process_id: "process-1",
    runtime_run_id: "run-1",
    trace_id: TRACE_ID,
  }, new AbortController().signal)) {
    tokens.push(token);
  }
  assert.deepEqual(tokens.map((token) => token.token), ["hello"]);
  assert.equal(signed.length, 2);
  assert.deepEqual(signed[0].delegatedPrincipal, delegated);
  assert.equal(requests[0].init.headers.authorization, "Bearer header.payload.signature");
  assert.equal(requests[1].init.redirect, "manual");
});

test("production caller allowlist rejects duplicates, self-calls, and unknown services", () => {
  assert.deepEqual(parseObservationAllowedCallersV1("trigger_processor,action_runtime"), [
    "trigger_processor",
    "action_runtime",
  ]);
  assert.throws(() => parseObservationAllowedCallersV1("trigger_processor,trigger_processor"));
  assert.throws(() => parseObservationAllowedCallersV1("observation_gateway"));
  assert.throws(() => parseObservationAllowedCallersV1("api_gateway"));
});
