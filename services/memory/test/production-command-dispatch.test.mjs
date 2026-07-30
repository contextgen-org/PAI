import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { canonicalJsonV1 } from "@pai/contracts";
import { OwnerCommandTransportErrorV1 } from "@pai/eventing";

import {
  createMemoryMetaCommandTransportV1,
} from "../dist/production-command-dispatch.v1.js";

function sha256(value) {
  return `sha256:${createHash("sha256")
    .update(canonicalJsonV1(value), "utf8")
    .digest("hex")}`;
}

function commandFixture() {
  const withoutHash = {
    schema_version: "meta.feedback_request_suggestion.v1",
    source_kind: "service_command",
    source_service: "memory_service",
    source_ref: "memory_conflict:conflict_001",
    command_id: "command_001",
    workspace_id: "workspace_001",
    bot_id: "bot_001",
    owner_agent_id: "agent_001",
    deployment_environment: "local",
    release_channel: "stable",
    dedupe_scope_ref: {
      kind: "conflict",
      ref: "conflict:conflict_001",
    },
    question_key: "memory_conflict_resolution_v1",
    question_ref: "memory_conflict:conflict_001:v2",
    question_hash: sha256({ question: "resolve conflict_001" }),
    trace_id: "memory_trace_001",
  };
  const request = {
    ...withoutHash,
    request_hash: sha256(withoutHash),
  };
  return {
    request,
    record: {
      outbox_id: "outbox_001",
      claim_token: "claim_001",
      attempt_count: 1,
      command_id: request.command_id,
      contract_name: "MetaFeedbackRequestSuggestionContractV1",
      source_service: "memory_service",
      source_ref: request.source_ref,
      workspace_id: request.workspace_id,
      bot_id: request.bot_id,
      owner_agent_id: request.owner_agent_id,
      deployment_environment: request.deployment_environment,
      release_channel: request.release_channel,
      dedupe_scope_ref: request.dedupe_scope_ref.ref,
      request_payload: request,
      request_hash: request.request_hash,
      trace_id: request.trace_id,
    },
  };
}

function envelope(record) {
  return {
    owner_service: "memory",
    outbox_table: "memory_command_outbox",
    record,
    current_transport_epoch: "http_epoch_001",
    current_transport_generation: 1,
  };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("Memory Meta command transport signs the exact bot scope and validates the receipt", async () => {
  const { request, record } = commandFixture();
  const signed = [];
  const calls = [];
  const transport = createMemoryMetaCommandTransportV1({
    meta_cognition_url: "http://127.0.0.1:3404",
    signer: {
      async sign(input) {
        signed.push(input);
        return "header.payload.signature";
      },
    },
    fetch: async (url, init) => {
      calls.push({ url, init });
      return jsonResponse({
        status: "accepted",
        feedback_request_id: "feedback_001",
        command_id: request.command_id,
        request_hash: request.request_hash,
      });
    },
  });

  const receipt = await transport.dispatch(envelope(record));

  assert.deepEqual(receipt, {
    transport_ref: "meta_feedback_request:feedback_001",
  });
  assert.deepEqual(signed, [{
    audience: "meta_cognition",
    capabilities: ["meta.feedback_request_suggestion.create"],
    scope: {
      scope_kind: "bot",
      workspace_id: "workspace_001",
      bot_id: "bot_001",
      owner_agent_id: "agent_001",
      deployment_environment: "local",
      release_channel: "stable",
    },
  }]);
  assert.equal(
    String(calls[0].url),
    "http://127.0.0.1:3404/internal/meta/feedback-request-suggestions",
  );
  assert.deepEqual(JSON.parse(calls[0].init.body), request);
  assert.equal(
    new Headers(calls[0].init.headers).get("authorization"),
    "Bearer header.payload.signature",
  );
});

test("Memory Meta command transport fails deterministically on body drift before I/O", async () => {
  const { record } = commandFixture();
  let signCalls = 0;
  let fetchCalls = 0;
  const transport = createMemoryMetaCommandTransportV1({
    meta_cognition_url: "http://127.0.0.1:3404",
    signer: {
      async sign() {
        signCalls += 1;
        return "unused";
      },
    },
    fetch: async () => {
      fetchCalls += 1;
      throw new Error("must not run");
    },
  });

  await assert.rejects(
    transport.dispatch(envelope({
      ...record,
      request_hash: `sha256:${"0".repeat(64)}`,
    })),
    (error) =>
      error instanceof OwnerCommandTransportErrorV1 &&
      error.code === "command_contract_binding_mismatch" &&
      error.retryable === false &&
      error.outcome_ambiguous === false,
  );
  assert.equal(signCalls, 0);
  assert.equal(fetchCalls, 0);
});

test("Memory Meta command transport preserves Meta conflicts as terminal outcomes", async () => {
  const { record } = commandFixture();
  const transport = createMemoryMetaCommandTransportV1({
    meta_cognition_url: "http://127.0.0.1:3404",
    signer: { async sign() { return "header.payload.signature"; } },
    fetch: async () => jsonResponse({
      status: "conflict",
      code: "idempotency_body_drift",
    }),
  });

  await assert.rejects(
    transport.dispatch(envelope(record)),
    (error) =>
      error instanceof OwnerCommandTransportErrorV1 &&
      error.code === "idempotency_body_drift" &&
      error.retryable === false &&
      error.outcome_ambiguous === false,
  );
});

test("Memory Meta command transport retries an invalid success response as ambiguous", async () => {
  const { record } = commandFixture();
  const transport = createMemoryMetaCommandTransportV1({
    meta_cognition_url: "http://127.0.0.1:3404",
    signer: { async sign() { return "header.payload.signature"; } },
    fetch: async () => jsonResponse({ status: "accepted" }),
  });

  await assert.rejects(
    transport.dispatch(envelope(record)),
    (error) =>
      error instanceof OwnerCommandTransportErrorV1 &&
      error.code === "meta_feedback_suggestion_response_invalid" &&
      error.retryable === true &&
      error.outcome_ambiguous === true,
  );
});
