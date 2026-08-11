import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { createTimerTriggerProcessorHttpPortV1 } from "../dist/production-trigger-processor.v1.js";

const scope = Object.freeze({
  workspace_id: "workspace_1",
  bot_id: "bot_1",
  owner_agent_id: "agent_1",
  deployment_environment: "dev",
  release_channel: "stable",
});

function accepted(traceId) {
  return {
    code: "trigger_accepted",
    message: "accepted",
    retryable: false,
    trace_id: traceId,
    details: {
      trigger_id: "trigger_1",
      trigger_status: "accepted",
      trigger_process_id: "process_1",
      process_phase: "admission",
      process_status: "running",
      wait_reason: null,
      blocked_by_process_id: null,
      priority: "strong",
      action: "dispatch",
      reason_code: "timer_due",
      duplicate_replayed: false,
    },
  };
}

test("timer submission signs only the exact bot authorization scope", async () => {
  const signed = [];
  const traceId = "timer-dispatch:occurrence_1:1";
  const transportTraceId = createHash("sha256")
    .update("timer-trigger-processor.v1\u0000", "utf8")
    .update(traceId, "utf8")
    .digest("hex")
    .slice(0, 32);
  const port = createTimerTriggerProcessorHttpPortV1({
    trigger_processor_url: "http://127.0.0.1:3001",
    signer: {
      async sign(input) {
        signed.push(input);
        return "header.payload.signature";
      },
    },
    fetch: async (_url, init) => {
      assert.equal(init.method, "POST");
      assert.equal(new Headers(init.headers).get("x-trace-id"), transportTraceId);
      const body = JSON.parse(init.body);
      assert.equal(body.trace_id, undefined);
      assert.deepEqual(Object.keys(body).sort(), [
        "actor_id",
        "actor_type",
        "bot_id",
        "dedupe_key",
        "deployment_environment",
        "owner_agent_id",
        "payload",
        "release_channel",
        "source",
        "workspace_id",
      ]);
      return new Response(JSON.stringify(accepted(transportTraceId)), {
        status: 202,
        headers: { "content-type": "application/json" },
      });
    },
  });

  const response = await port.submit(
    {
      ...scope,
      source: "timer",
      actor_type: "system",
      actor_id: "timer_app",
      payload: { message: "report later" },
      dedupe_key: "timer:occurrence_1",
    },
    traceId,
  );

  assert.equal(signed.length, 1);
  assert.equal(response.trace_id, traceId);
  assert.deepEqual(signed[0], {
    audience: "trigger_processor",
    capabilities: ["trigger.submit.timer"],
    scope: { scope_kind: "bot", ...scope },
  });
});
