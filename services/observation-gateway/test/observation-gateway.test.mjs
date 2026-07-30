import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { request as httpRequest } from "node:http";
import test from "node:test";

import {
  canonicalJsonV1,
  canonicalPayloadHashV1,
} from "@pai/eventing";

import {
  InMemoryObservationAccessAuditSpoolV1,
  ObservationApplicationErrorV1,
  ObservationApplicationV1,
  ObservationSnapshotResponseV1Schema,
  ObservationUpstreamErrorV1,
  buildObservationGatewayApp,
} from "../dist/index.js";
import { Value } from "@sinclair/typebox/value";

const scope = Object.freeze({
  workspace_id: "workspace-1",
  bot_id: "bot-1",
  owner_agent_id: "owner-1",
  deployment_environment: "dev",
  release_channel: "stable",
});

function delegatedPrincipal(
  principalId = "viewer-1",
  scopeValue = scope,
  roles = ["observation.viewer"],
) {
  return {
    principal_type: "user",
    principal_id: principalId,
    roles: [...roles],
    source_issuer: "https://auth.observation.test",
    source_subject: principalId,
    auth_time: 1_784_678_400,
    scope_kind: "bot",
    ...scopeValue,
  };
}

const viewer = Object.freeze({
  service_id: "action_runtime",
  actor_id: "user:viewer-1",
  roles: Object.freeze(["observation.viewer"]),
  capabilities: Object.freeze(["observation.read"]),
  delegated_principal: Object.freeze(delegatedPrincipal()),
  scope,
});

const debugViewer = Object.freeze({
  ...viewer,
  roles: Object.freeze(["observation.debug_viewer"]),
  delegated_principal: Object.freeze(
    delegatedPrincipal(
      "viewer-1",
      scope,
      ["observation.debug_viewer"],
    ),
  ),
});

function processFixture(overrides = {}) {
  return {
    id: "process-1",
    trigger_id: "trigger-1",
    ...scope,
    runtime_run_id: "run-1",
    phase: "execution",
    status: "running",
    terminal_reason: null,
    terminal_outcome: null,
    terminal_outcome_finalized_at: null,
    successor_process_id: null,
    snapshot_transfer_ref: null,
    boundary_system_event_ref: null,
    canonical_reason_code: null,
    reason_code: null,
    cooldown_until: null,
    snapshot_retention_until: null,
    process_snapshot_identity: null,
    context_snapshot_identity: null,
    snapshot_watermark: 1,
    meta_job_id: "job-1",
    meta_status: "running",
    meta_summary_ref: null,
    observation_finalized: false,
    ...overrides,
  };
}

function runtimeFixture(overrides = {}) {
  return {
    runtime_run: {
      runtime_run_id: "run-1",
      trigger_process_id: "process-1",
      ...scope,
      status: "running",
      start_attempt_no: 1,
      policy_snapshot_id: "policy-1",
      requested_catalog_version: "catalog-1",
      effective_catalog_version: "catalog-1",
      created_at: "2026-07-23T00:00:00.000Z",
      started_at: "2026-07-23T00:00:01.000Z",
      completed_at: null,
      terminal_reason: null,
      ...overrides,
    },
  };
}

function metaFixture(overrides = {}) {
  return {
    job_id: "job-1",
    trigger_process_id: "process-1",
    bot_id: "bot-1",
    status: "running",
    result_status: null,
    attempt_count: 1,
    next_retry_at: null,
    summary: null,
    error: null,
    created_at: "2026-07-23T00:00:00.000Z",
    updated_at: "2026-07-23T00:00:01.000Z",
    trace_id: "trace-meta",
    ...overrides,
  };
}

function eventFixture(overrides = {}) {
  return {
    schema_version: "trigger_process_sse_event.v1",
    trigger_process_id: "process-1",
    append_sequence_no: 2,
    event_type: "snapshot_gap_skipped",
    occurred_at: "2026-07-23T00:00:02.000Z",
    trace_id: "trace-event",
    observation_summary: {
      source_service: "action_runtime",
      missing_source_sequence_range: {
        first_source_sequence_no: 1,
        last_source_sequence_no: 1,
      },
      last_contiguous_source_sequence_no: 0,
      source_ref: "source-1",
      repair_status: "pending",
    },
    ...overrides,
  };
}

function summaryFixture(overrides = {}) {
  return {
    schema_version: "trigger_process_sse_event.v1",
    trigger_process_id: "process-1",
    append_sequence_no: 2,
    event_type: "trigger_process.summary",
    occurred_at: "2026-07-23T00:00:02.000Z",
    trace_id: "trace-summary",
    observation_summary: {
      phase: "execution",
      status: "running",
      reason_code: null,
      terminal_outcome: null,
      terminal_outcome_finalized_at: null,
      observation_finalized: false,
    },
    ...overrides,
  };
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function ownerProcessSnapshotFixture() {
  const withoutHash = {
    schema_version: "trigger_process_snapshot.v1",
    snapshot_id: "snapshot-1",
    snapshot_version: 1,
    trigger_process_id: "process-1",
    ...scope,
    phase: "closed",
    trigger: {
      trigger_id: "trigger-1",
      source: "chat",
      actor_type: "user",
      actor_id: "user-1",
      payload_ref: "trigger-payload:1",
      payload_hash: `sha256:${"a".repeat(64)}`,
      accepted_at: "2026-07-23T00:00:00.000Z",
    },
    context_snapshot: null,
    intent: null,
    runtime_run_id: null,
    policy_snapshot_id: null,
    runtime_state: null,
    action_trace: [],
    tool_results: [],
    event_trace: [],
    input_event_range: {
      first_append_sequence_no: 0,
      last_append_sequence_no: 0,
    },
    overflow_refs: [],
    last_append_sequence_no: 0,
    last_sequence_by_source: {},
    terminal_outcome: "executed",
    terminal_outcome_finalized_at: "2026-07-23T00:00:01.000Z",
    canonical_process_id: null,
    successor_process_id: null,
    superseded_by_process_id: null,
    snapshot_transfer_ref: null,
    boundary_system_event_ref: null,
    canonical_reason_code: "execution_completed",
    open_loops: [],
    created_at: "2026-07-23T00:00:00.000Z",
    updated_at: "2026-07-23T00:00:01.000Z",
    cooldown_until: null,
    snapshot_retention_until: "2026-08-30T00:00:00.000Z",
  };
  return {
    ...withoutHash,
    snapshot_hash: canonicalPayloadHashV1(withoutHash),
  };
}

function ownerContextSnapshotFixture() {
  const withoutHash = {
    schema_version: "context_snapshot.v1",
    trigger_process_id: "process-1",
    context_version: 1,
    ...scope,
    pinned_facts: [],
    memory_context: [],
    skill_catalog: null,
    environment: {
      captured_at: "2026-07-23T00:00:00.000Z",
      channel: "chat",
      timezone: "Asia/Shanghai",
      capability_summary_ref: "capabilities:1",
    },
    history: [],
    source_status: [
      { source: "knowthat", status: "empty", retrieved_at: "2026-07-23T00:00:00.000Z", source_as_of: "2026-07-23T00:00:00.000Z", source_version: "knowthat.v1", latency_ms: 1, result_count: 0, failure_reason: null },
      { source: "memory", status: "empty", retrieved_at: "2026-07-23T00:00:00.000Z", source_as_of: "2026-07-23T00:00:00.000Z", source_version: "memory.v1", latency_ms: 1, result_count: 0, failure_reason: null },
      { source: "skill", status: "failed", retrieved_at: "2026-07-23T00:00:00.000Z", source_as_of: null, source_version: null, latency_ms: 1, result_count: 0, failure_reason: "skill_unavailable" },
      { source: "environment", status: "ok", retrieved_at: "2026-07-23T00:00:00.000Z", source_as_of: "2026-07-23T00:00:00.000Z", source_version: "environment.v1", latency_ms: 1, result_count: 1, failure_reason: null },
      { source: "history", status: "empty", retrieved_at: "2026-07-23T00:00:00.000Z", source_as_of: "2026-07-23T00:00:00.000Z", source_version: "history.v1", latency_ms: 1, result_count: 0, failure_reason: null },
    ],
    assembly_notes: ["skill_unavailable"],
  };
  return {
    ...withoutHash,
    snapshot_hash: canonicalPayloadHashV1(withoutHash),
  };
}

function harness(options = {}) {
  const calls = {
    process: 0,
    processInputs: [],
    processSignals: [],
    runtime: 0,
    runtimeInputs: [],
    runtimeSignals: [],
    meta: 0,
    metaInputs: [],
    toolInputs: [],
    qualityInputs: [],
    stream: [],
    tokens: 0,
    processSnapshotReads: [],
    processSnapshotSignals: [],
    contextSnapshotReads: [],
    contextSnapshotSignals: [],
  };
  const tp = {
    async checkReadiness() {},
    async getProcess(input, signal) {
      calls.process += 1;
      calls.processInputs.push(input);
      calls.processSignals.push(signal);
      if (options.processGate) await options.processGate;
      if (options.processError) throw options.processError;
      return options.process ?? processFixture();
    },
    async *streamProcessEvents(input, signal) {
      calls.stream.push(input);
      for (const frame of options.events ?? []) {
        if (signal.aborted) return;
        yield frame;
      }
      if (options.streamError) throw options.streamError;
      if (options.holdStream && !signal.aborted) {
        await new Promise((resolve) => {
          signal.addEventListener("abort", resolve, { once: true });
        });
      }
    },
  };
  const runtime = {
    async checkReadiness() {},
    async getRun(input, signal) {
      calls.runtime += 1;
      calls.runtimeInputs.push(input);
      calls.runtimeSignals.push(signal);
      if (options.runtimeGate) await options.runtimeGate;
      if (options.runtimeError) throw options.runtimeError;
      return options.runtime ?? runtimeFixture();
    },
    async listToolInvocations(input) {
      calls.runtime += 1;
      calls.toolInputs.push(input);
      return (
        options.tools ?? {
          runtime_run_id: "run-1",
          items: [],
          next_cursor: null,
          has_more: false,
        }
      );
    },
    async *streamTokens(_input, signal) {
      calls.tokens += 1;
      if (options.tokenError) throw options.tokenError;
      if (options.tokenStream) {
        yield* options.tokenStream(signal);
        return;
      }
      for (const token of options.tokens ?? []) {
        if (signal.aborted) return;
        yield token;
      }
    },
  };
  const meta = {
    async checkReadiness() {},
    async getJob(input) {
      calls.meta += 1;
      calls.metaInputs.push(input);
      if (options.metaError) throw options.metaError;
      return options.meta ?? metaFixture();
    },
    async listQualitySignals(input) {
      calls.meta += 1;
      calls.qualityInputs.push(input);
      return (
        options.quality ?? {
          trigger_process_id: "process-1",
          bot_id: "bot-1",
          items: [],
          next_cursor: null,
          has_more: false,
          trace_id: "trace-quality",
        }
      );
    },
  };
  const audit =
    options.audit ?? new InMemoryObservationAccessAuditSpoolV1();
  const ownerReads =
    options.ownerReads === undefined
      ? undefined
      : {
          async checkReadiness() {
            if (options.ownerReadinessError) {
              throw options.ownerReadinessError;
            }
          },
          async resolveProcessSnapshot(input, signal) {
            calls.processSnapshotReads.push(input);
            calls.processSnapshotSignals.push(signal);
            if (options.processSnapshotGate) {
              await options.processSnapshotGate;
            }
            if (options.processSnapshotError) {
              throw options.processSnapshotError;
            }
            return options.processSnapshotRead;
          },
          async resolveContextSnapshot(input, signal) {
            calls.contextSnapshotReads.push(input);
            calls.contextSnapshotSignals.push(signal);
            if (options.contextSnapshotGate) {
              await options.contextSnapshotGate;
            }
            if (options.contextSnapshotError) {
              throw options.contextSnapshotError;
            }
            return options.contextSnapshotRead;
          },
        };
  return {
    calls,
    audit,
    application: new ObservationApplicationV1(
      tp,
      runtime,
      meta,
      audit,
      {
        ...options.applicationOptions,
        ...(ownerReads === undefined ? {} : { owner_reads: ownerReads }),
      },
    ),
  };
}

async function collect(iterable) {
  const frames = [];
  for await (const frame of iterable) frames.push(frame);
  return frames;
}

function durableAudit(options = {}) {
  const reference = new InMemoryObservationAccessAuditSpoolV1(
    options.records,
    options.maxRecords,
    options.available,
    options.sink,
  );
  return {
    durability: "durable_spool",
    get records() {
      return reference.records;
    },
    checkReadiness: () => reference.checkReadiness(),
    enqueue: (record) => reference.enqueue(record),
    replay: () => reference.replay(),
    setAvailable: (value) => reference.setAvailable(value),
  };
}

async function withTimeout(promise, timeoutMs = 500) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("test timed out")),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolveValue, rejectValue) => {
    resolve = resolveValue;
    reject = rejectValue;
  });
  return { promise, resolve, reject };
}

test("snapshot authorizes with TP before fan-out and degrades only optional owner timeout", async () => {
  const { application, calls, audit } = harness({
    runtimeError: new ObservationUpstreamErrorV1(
      "action_runtime",
      "timeout",
      "timeout",
    ),
  });
  const response = await application.getSnapshot(
    viewer,
    "process-1",
    "trace-1",
  );
  assert.equal(calls.process, 1);
  assert.equal(calls.runtime, 1);
  assert.equal(calls.meta, 1);
  assert.deepEqual(response.degraded_flags, ["optional_detail_timeout"]);
  assert.equal(response.meta.job_id, "job-1");
  assert.equal(audit.records.at(-1).decision, "allowed");
  assert.equal(
    Value.Check(ObservationSnapshotResponseV1Schema, {
      ...response,
      redacted_field_count: Number.MAX_SAFE_INTEGER + 1,
    }),
    false,
  );
});

test("an authorized process does not become a false 404 when optional owner projections lag", async () => {
  const snapshot = harness({
    runtimeError: new ObservationUpstreamErrorV1(
      "action_runtime",
      "not_found",
      "runtime projection not created yet",
    ),
    metaError: new ObservationUpstreamErrorV1(
      "meta_cognition",
      "not_found",
      "meta projection not created yet",
    ),
  });
  const response = await snapshot.application.getSnapshot(
    viewer,
    "process-1",
    "trace-owner-projection-lag",
  );
  assert.equal(response.runtime, null);
  assert.equal(response.meta, null);
  assert.deepEqual(response.degraded_flags, [
    "meta_projection_lag",
    "runtime_unavailable",
  ]);

  await assert.rejects(
    snapshot.application.getRuntimeDetails(
      viewer,
      "process-1",
      "run-1",
      "trace-runtime-projection-lag",
    ),
    (error) =>
      error instanceof ObservationApplicationErrorV1 &&
      error.code === "upstream_unavailable" &&
      error.retryable,
  );

  const untypedTransportFailure = harness({
    runtimeError: new Error("socket reset before adapter mapping"),
  });
  await assert.rejects(
    untypedTransportFailure.application.getSnapshot(
      viewer,
      "process-1",
      "trace-untyped-runtime-failure",
    ),
    (error) =>
      error instanceof ObservationApplicationErrorV1 &&
      error.code === "upstream_unavailable" &&
      error.retryable,
  );
});

test("snapshot owner reads bind the fixed Observation workload, purpose and five-tuple", async () => {
  const processSnapshot = ownerProcessSnapshotFixture();
  const contextSnapshot = ownerContextSnapshotFixture();
  const contextBytes = Buffer.from(
    canonicalJsonV1(contextSnapshot),
    "utf8",
  );
  const { application, calls, audit } = harness({
    audit: durableAudit(),
    ownerReads: true,
    process: processFixture({
      process_snapshot_identity: {
        snapshot_ref: "snapshot-ref:1",
        snapshot_version: 1,
        snapshot_hash: processSnapshot.snapshot_hash,
      },
      context_snapshot_identity: {
        context_snapshot_ref: "context-ref:1",
        context_snapshot_version: 1,
        context_snapshot_hash: contextSnapshot.snapshot_hash,
      },
    }),
    processSnapshotRead: {
      schema_version: "trigger_process_snapshot_read.v1",
      snapshot_ref: "snapshot-ref:1",
      snapshot_manifest: processSnapshot,
      content_chunks: [],
      resolved_at: "2026-07-23T00:00:02.000Z",
    },
    contextSnapshotRead: {
      schema_version: "context_snapshot_read.v1",
      context_snapshot_ref: "context-ref:1",
      context_snapshot_version: 1,
      context_snapshot_hash: contextSnapshot.snapshot_hash,
      canonical_bytes_sha256: sha256(contextBytes),
      content_length_bytes: contextBytes.byteLength,
      delivery_mode: "inline",
      context_snapshot: contextSnapshot,
      chunks: null,
      retention_until: "2026-08-30T00:00:00.000Z",
      redaction_state: "complete",
      resolved_at: "2026-07-23T00:00:02.000Z",
      trace_id: "trace-owner-read",
    },
    applicationOptions: {
      now: () => new Date("2026-07-23T00:00:02.000Z"),
    },
  });

  const replay = await application.resolveReplaySnapshot(
    debugViewer,
    "process-1",
    "trace-owner-read",
  );
  assert.equal(replay.snapshot_manifest.snapshot_id, "snapshot-1");
  assert.deepEqual(calls.processSnapshotReads[0].workload, {
    sub: "observation_gateway",
    aud: "trigger_processor",
    capability: "trigger.process.snapshot.resolve",
  });
  assert.equal(
    calls.processSnapshotReads[0].request.purpose,
    "observation_replay",
  );
  assert.deepEqual(
    {
      workspace_id:
        calls.processSnapshotReads[0].request.workspace_id,
      bot_id: calls.processSnapshotReads[0].request.bot_id,
      owner_agent_id:
        calls.processSnapshotReads[0].request.owner_agent_id,
      deployment_environment:
        calls.processSnapshotReads[0].request.deployment_environment,
      release_channel:
        calls.processSnapshotReads[0].request.release_channel,
    },
    scope,
  );

  const context = await application.resolveAuditContextSnapshot(
    debugViewer,
    "process-1",
    "trace-owner-read",
  );
  assert.equal(context.snapshot_hash, contextSnapshot.snapshot_hash);
  assert.deepEqual(calls.contextSnapshotReads[0].workload, {
    sub: "observation_gateway",
    aud: "trigger_processor",
    capability: "trigger.context_snapshot.resolve",
  });
  assert.equal(
    calls.contextSnapshotReads[0].request.consumer_service,
    "observation_gateway",
  );
  assert.equal(
    calls.contextSnapshotReads[0].request.purpose,
    "audit_replay",
  );
  assert.deepEqual(
    audit.records.map(({ endpoint, decision, status_code }) => ({
      endpoint,
      decision,
      status_code,
    })),
    [
      {
        endpoint: "snapshot_replay",
        decision: "allowed_debug",
        status_code: 200,
      },
      {
        endpoint: "context_snapshot_audit",
        decision: "allowed_debug",
        status_code: 200,
      },
    ],
  );
});

test("raw replay owner reads require debug authorization and a durable audit handoff", async () => {
  const durable = durableAudit();
  const denied = harness({
    audit: durable,
    ownerReads: true,
  });
  await assert.rejects(
    denied.application.resolveReplaySnapshot(
      viewer,
      "process-1",
      "trace-owner-debug-denied",
    ),
    (error) =>
      error instanceof ObservationApplicationErrorV1 &&
      error.code === "debug_permission_denied",
  );
  assert.equal(denied.calls.process, 0);
  assert.deepEqual(
    durable.records.map(({ endpoint, decision, status_code }) => ({
      endpoint,
      decision,
      status_code,
    })),
    [
      {
        endpoint: "snapshot_replay",
        decision: "denied",
        status_code: 403,
      },
    ],
  );

  const nonDurable = harness({ ownerReads: true });
  await assert.rejects(
    nonDurable.application.resolveReplaySnapshot(
      debugViewer,
      "process-1",
      "trace-owner-audit-unavailable",
    ),
    (error) =>
      error instanceof ObservationApplicationErrorV1 &&
      error.code === "audit_unavailable",
  );
  assert.equal(nonDurable.calls.process, 0);
});

test("non-SSE entries pin principal, list query, owner-read and audit facts before authorization awaits", async () => {
  const processSnapshot = ownerProcessSnapshotFixture();
  const contextSnapshot = ownerContextSnapshotFixture();
  const contextBytes = Buffer.from(
    canonicalJsonV1(contextSnapshot),
    "utf8",
  );
  const ownerGate = deferred();
  const mutableOwnerPrincipal = {
    service_id: "action_runtime",
    actor_id: "user:original",
    roles: ["observation.debug_viewer"],
    capabilities: ["observation.read"],
    delegated_principal: delegatedPrincipal(
      "original",
      scope,
      ["observation.debug_viewer"],
    ),
    scope: { ...scope },
  };
  const ownerHarness = harness({
    audit: durableAudit(),
    processGate: ownerGate.promise,
    ownerReads: true,
    process: processFixture({
      process_snapshot_identity: {
        snapshot_ref: "snapshot-ref:1",
        snapshot_version: 1,
        snapshot_hash: processSnapshot.snapshot_hash,
      },
      context_snapshot_identity: {
        context_snapshot_ref: "context-ref:1",
        context_snapshot_version: 1,
        context_snapshot_hash: contextSnapshot.snapshot_hash,
      },
    }),
    processSnapshotRead: {
      schema_version: "trigger_process_snapshot_read.v1",
      snapshot_ref: "snapshot-ref:1",
      snapshot_manifest: processSnapshot,
      content_chunks: [],
      resolved_at: "2026-07-23T00:00:02.000Z",
    },
    contextSnapshotRead: {
      schema_version: "context_snapshot_read.v1",
      context_snapshot_ref: "context-ref:1",
      context_snapshot_version: 1,
      context_snapshot_hash: contextSnapshot.snapshot_hash,
      canonical_bytes_sha256: sha256(contextBytes),
      content_length_bytes: contextBytes.byteLength,
      delivery_mode: "inline",
      context_snapshot: contextSnapshot,
      chunks: null,
      retention_until: "2026-08-30T00:00:00.000Z",
      redaction_state: "complete",
      resolved_at: "2026-07-23T00:00:02.000Z",
      trace_id: "trace-owner-pinned",
    },
    applicationOptions: {
      now: () => new Date("2026-07-23T00:00:02.000Z"),
    },
  });
  const replayPending = ownerHarness.application.resolveReplaySnapshot(
    mutableOwnerPrincipal,
    "process-1",
    "trace-owner-pinned",
  );
  const contextPending =
    ownerHarness.application.resolveAuditContextSnapshot(
      mutableOwnerPrincipal,
      "process-1",
      "trace-owner-pinned",
    );
  while (ownerHarness.calls.process < 2) {
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  mutableOwnerPrincipal.actor_id = "user:attacker";
  mutableOwnerPrincipal.scope.bot_id = "bot-attacker";
  ownerGate.resolve();
  await Promise.all([replayPending, contextPending]);
  assert.equal(
    ownerHarness.calls.processSnapshotReads[0].request.bot_id,
    "bot-1",
  );
  assert.equal(
    ownerHarness.calls.contextSnapshotReads[0].request.bot_id,
    "bot-1",
  );
  assert.equal(
    Object.isFrozen(ownerHarness.calls.processSnapshotReads[0]),
    true,
  );
  assert.equal(
    Object.isFrozen(ownerHarness.calls.contextSnapshotReads[0].request),
    true,
  );

  const listGate = deferred();
  const mutableListPrincipal = {
    service_id: "action_runtime",
    actor_id: "user:list-original",
    roles: ["observation.viewer"],
    capabilities: ["observation.read"],
    delegated_principal: delegatedPrincipal("list-original"),
    scope: { ...scope },
  };
  const mutableListInput = {
    runtime_run_id: "run-1",
    cursor: "cursor-original",
    limit: 10,
    status: "completed",
    trace_id: "trace-list-original",
  };
  const listHarness = harness({
    processGate: listGate.promise,
    tools: {
      runtime_run_id: "run-1",
      items: [],
      next_cursor: null,
      has_more: false,
    },
  });
  const listPending = listHarness.application.listToolInvocations(
    mutableListPrincipal,
    "process-1",
    mutableListInput,
  );
  while (listHarness.calls.process === 0) {
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  mutableListPrincipal.actor_id = "user:list-attacker";
  mutableListPrincipal.scope.bot_id = "bot-attacker";
  mutableListInput.cursor = "cursor-attacker";
  mutableListInput.trace_id = "trace-list-attacker";
  listGate.resolve();
  await listPending;
  assert.equal(listHarness.calls.toolInputs[0].scope.bot_id, "bot-1");
  assert.equal(listHarness.calls.toolInputs[0].cursor, "cursor-original");
  assert.equal(listHarness.calls.toolInputs[0].trace_id, "trace-list-original");
  assert.equal(Object.isFrozen(listHarness.calls.toolInputs[0]), true);
  assert.equal(
    listHarness.audit.records.at(-1).actor_identity,
    "user:list-original",
  );
  assert.equal(
    listHarness.audit.records.at(-1).trace_id,
    "trace-list-original",
  );
});

test("replay owner reads cannot complete after their cancellation lease is aborted", async () => {
  const processSnapshot = ownerProcessSnapshotFixture();
  const contextSnapshot = ownerContextSnapshotFixture();
  const contextBytes = Buffer.from(
    canonicalJsonV1(contextSnapshot),
    "utf8",
  );
  const processSnapshotGate = deferred();
  const contextSnapshotGate = deferred();
  const { application, calls } = harness({
    audit: durableAudit(),
    ownerReads: true,
    process: processFixture({
      process_snapshot_identity: {
        snapshot_ref: "snapshot-ref:1",
        snapshot_version: 1,
        snapshot_hash: processSnapshot.snapshot_hash,
      },
      context_snapshot_identity: {
        context_snapshot_ref: "context-ref:1",
        context_snapshot_version: 1,
        context_snapshot_hash: contextSnapshot.snapshot_hash,
      },
    }),
    processSnapshotGate: processSnapshotGate.promise,
    contextSnapshotGate: contextSnapshotGate.promise,
    processSnapshotRead: {
      schema_version: "trigger_process_snapshot_read.v1",
      snapshot_ref: "snapshot-ref:1",
      snapshot_manifest: processSnapshot,
      content_chunks: [],
      resolved_at: "2026-07-23T00:00:02.000Z",
    },
    contextSnapshotRead: {
      schema_version: "context_snapshot_read.v1",
      context_snapshot_ref: "context-ref:1",
      context_snapshot_version: 1,
      context_snapshot_hash: contextSnapshot.snapshot_hash,
      canonical_bytes_sha256: sha256(contextBytes),
      content_length_bytes: contextBytes.byteLength,
      delivery_mode: "inline",
      context_snapshot: contextSnapshot,
      chunks: null,
      retention_until: "2026-08-30T00:00:00.000Z",
      redaction_state: "complete",
      resolved_at: "2026-07-23T00:00:02.000Z",
      trace_id: "trace-owner-cancelled",
    },
    applicationOptions: {
      now: () => new Date("2026-07-23T00:00:02.000Z"),
    },
  });
  const processAbort = new AbortController();
  const contextAbort = new AbortController();
  const processPending = application.resolveReplaySnapshot(
    debugViewer,
    "process-1",
    "trace-owner-cancelled",
    processAbort.signal,
  );
  const contextPending = application.resolveAuditContextSnapshot(
    debugViewer,
    "process-1",
    "trace-owner-cancelled",
    contextAbort.signal,
  );
  while (
    calls.processSnapshotReads.length === 0 ||
    calls.contextSnapshotReads.length === 0
  ) {
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  processAbort.abort(new Error("process replay cancelled"));
  contextAbort.abort(new Error("context replay cancelled"));
  processSnapshotGate.resolve();
  contextSnapshotGate.resolve();
  await assert.rejects(processPending, /process replay cancelled/u);
  await assert.rejects(contextPending, /context replay cancelled/u);
  assert.equal(calls.processSnapshotSignals[0], processAbort.signal);
  assert.equal(calls.contextSnapshotSignals[0], contextAbort.signal);
});

test("snapshot owner reads fail closed on scope, capability and integrity drift", async () => {
  const processSnapshot = ownerProcessSnapshotFixture();
  const tampered = harness({
    audit: durableAudit(),
    ownerReads: true,
    process: processFixture({
      process_snapshot_identity: {
        snapshot_ref: "snapshot-ref:1",
        snapshot_version: 1,
        snapshot_hash: processSnapshot.snapshot_hash,
      },
    }),
    processSnapshotRead: {
      schema_version: "trigger_process_snapshot_read.v1",
      snapshot_ref: "snapshot-ref:1",
      snapshot_manifest: {
        ...processSnapshot,
        canonical_reason_code: "tampered",
      },
      content_chunks: [],
      resolved_at: "2026-07-23T00:00:02.000Z",
    },
    applicationOptions: {
      now: () => new Date("2026-07-23T00:00:02.000Z"),
    },
  });
  await assert.rejects(
    tampered.application.resolveReplaySnapshot(
      debugViewer,
      "process-1",
      "trace-tampered",
    ),
    (error) =>
      error instanceof ObservationApplicationErrorV1 &&
      error.code === "upstream_schema_mismatch",
  );

  const denied = harness({
    audit: durableAudit(),
    ownerReads: true,
    process: processFixture({
      process_snapshot_identity: {
        snapshot_ref: "snapshot-ref:1",
        snapshot_version: 1,
        snapshot_hash: processSnapshot.snapshot_hash,
      },
    }),
    processSnapshotError: new ObservationUpstreamErrorV1(
      "trigger_processor",
      "permission_denied",
      "capability denied",
    ),
  });
  await assert.rejects(
    denied.application.resolveReplaySnapshot(
      debugViewer,
      "process-1",
      "trace-capability-denied",
    ),
    (error) =>
      error instanceof ObservationApplicationErrorV1 &&
      error.code === "bot_permission_denied",
  );

  const wrongScope = harness({
    audit: durableAudit(),
    ownerReads: true,
    processSnapshotRead: {},
  });
  await assert.rejects(
    wrongScope.application.resolveReplaySnapshot(
      {
        ...debugViewer,
        scope: { ...scope, bot_id: "bot-other" },
      },
      "process-1",
      "trace-scope-denied",
    ),
    (error) =>
      error instanceof ObservationApplicationErrorV1 &&
      error.code === "bot_permission_denied",
  );
  assert.equal(wrongScope.calls.processSnapshotReads.length, 0);

  const noCurrentSnapshot = harness({
    audit: durableAudit(),
    ownerReads: true,
  });
  await assert.rejects(
    noCurrentSnapshot.application.resolveReplaySnapshot(
      debugViewer,
      "process-1",
      "trace-no-current-snapshot",
    ),
    (error) =>
      error instanceof ObservationApplicationErrorV1 &&
      error.code === "upstream_unavailable",
  );
  assert.equal(noCurrentSnapshot.calls.processSnapshotReads.length, 0);

  const invalidClock = harness({
    audit: durableAudit(),
    ownerReads: true,
    process: processFixture({
      process_snapshot_identity: {
        snapshot_ref: "snapshot-ref:1",
        snapshot_version: 1,
        snapshot_hash: processSnapshot.snapshot_hash,
      },
    }),
    processSnapshotRead: {
      schema_version: "trigger_process_snapshot_read.v1",
      snapshot_ref: "snapshot-ref:1",
      snapshot_manifest: processSnapshot,
      content_chunks: [],
      resolved_at: "2026-07-23T00:00:02.000Z",
    },
    applicationOptions: {
      now: () => new Date(Number.NaN),
    },
  });
  await assert.rejects(
    invalidClock.application.resolveReplaySnapshot(
      debugViewer,
      "process-1",
      "trace-invalid-clock",
    ),
    (error) =>
      error instanceof ObservationApplicationErrorV1 &&
      error.code === "upstream_unavailable",
  );

  const incomplete = harness();
  await assert.rejects(
    incomplete.application.checkReadiness(false, true),
    /snapshot owner-read ports/u,
  );
});

test("TP no-run state cannot be bypassed by a caller supplied runtime id", async () => {
  const { application, calls, audit } = harness({
    process: processFixture({
      runtime_run_id: null,
      phase: "context",
    }),
  });
  await assert.rejects(
    application.listToolInvocations(viewer, "process-1", {
      runtime_run_id: "attacker-run",
      trace_id: "trace-2",
    }),
    (error) =>
      error instanceof ObservationApplicationErrorV1 &&
      error.code === "runtime_run_mismatch",
  );
  assert.equal(calls.runtime, 0);
  assert.equal(audit.records.at(-1).endpoint, "tool_invocations");
  assert.equal(audit.records.at(-1).decision, "denied");
  assert.equal(audit.records.at(-1).status_code, 409);
});

test("direct Runtime and Meta debug reads authorize the process first and bind both resource ids", async () => {
  const { application, calls, audit } = harness();
  const runtime = await application.getRuntimeDetails(
    viewer,
    "process-1",
    "run-1",
    "trace-runtime-details",
  );
  assert.equal(runtime.runtime.runtime_run_id, "run-1");
  assert.equal(runtime.trace_id, "trace-runtime-details");
  assert.equal(calls.process, 1);
  assert.equal(calls.runtime, 1);
  assert.equal(audit.records.at(-1).endpoint, "runtime_details");

  const meta = await application.getMetaDetails(
    viewer,
    "process-1",
    "job-1",
    "trace-meta-details",
  );
  assert.equal(meta.meta.job_id, "job-1");
  assert.equal(meta.trace_id, "trace-meta-details");
  assert.equal(calls.process, 2);
  assert.equal(calls.meta, 1);
  assert.equal(audit.records.at(-1).endpoint, "meta_details");

  await assert.rejects(
    application.getRuntimeDetails(
      viewer,
      "process-1",
      "other-run",
      "trace-runtime-mismatch",
    ),
    (error) =>
      error instanceof ObservationApplicationErrorV1 &&
      error.code === "runtime_run_mismatch",
  );
  await assert.rejects(
    application.getMetaDetails(
      viewer,
      "process-1",
      "other-job",
      "trace-meta-mismatch",
    ),
    (error) =>
      error instanceof ObservationApplicationErrorV1 &&
      error.code === "bot_permission_denied",
  );
});

test("cross-service owner values are canonically preflighted before schema traversal", async () => {
  let processTrapCalls = 0;
  const proxiedProcess = new Proxy(processFixture(), {
    ownKeys(target) {
      processTrapCalls += 1;
      return Reflect.ownKeys(target);
    },
  });
  const processHarness = harness({ process: proxiedProcess });
  await assert.rejects(
    processHarness.application.getSnapshot(
      viewer,
      "process-1",
      "trace-process-proxy",
    ),
    (error) =>
      error instanceof ObservationApplicationErrorV1 &&
      error.code === "upstream_schema_mismatch",
  );
  assert.equal(processTrapCalls, 0);

  let runtimeGetterCalls = 0;
  const runtimeResponse = {};
  Object.defineProperty(runtimeResponse, "runtime_run", {
    enumerable: true,
    get() {
      runtimeGetterCalls += 1;
      return runtimeFixture().runtime_run;
    },
  });
  const runtimeHarness = harness({ runtime: runtimeResponse });
  await assert.rejects(
    runtimeHarness.application.getRuntimeDetails(
      viewer,
      "process-1",
      "run-1",
      "trace-runtime-accessor",
    ),
    (error) =>
      error instanceof ObservationApplicationErrorV1 &&
      error.code === "upstream_schema_mismatch",
  );
  assert.equal(runtimeGetterCalls, 0);
});

test("SSE snapshot uses the atomic watermark and forwards durable IDs unchanged", async () => {
  const { application, calls } = harness({
    events: [{ kind: "event", event: eventFixture() }],
  });
  const frames = await collect(
    application.streamEvents(viewer, "process-1", {
      trace_id: "trace-3",
    }),
  );
  assert.equal(frames[0].event, "observation.snapshot");
  assert.equal(frames[0].id, undefined);
  assert.equal(frames[0].data.snapshot_watermark, 1);
  assert.equal(frames[1].id, "process-1:2");
  assert.equal(frames[1].durable, true);
  assert.equal(calls.stream[0].start_after_append_sequence_no, 1);
  assert.equal("last_event_id" in calls.stream[0], false);
});

test("prepared SSE pins caller input, principal, owner state and audit identity before asynchronous consumption", async () => {
  const audit = new InMemoryObservationAccessAuditSpoolV1();
  const mutablePrincipal = {
    service_id: "action_runtime",
    actor_id: "user:viewer-1",
    roles: ["observation.viewer"],
    capabilities: ["observation.read"],
    delegated_principal: delegatedPrincipal(),
    scope: { ...scope },
  };
  const mutableInput = {
    last_event_id: "process-1:1",
    trace_id: "trace-pinned",
  };
  const { application, calls } = harness({
    audit,
    process: processFixture({
      process_snapshot_identity: {
        snapshot_ref: "snapshot-ref:1",
        snapshot_version: 1,
        snapshot_hash: `sha256:${"a".repeat(64)}`,
      },
    }),
  });
  const prepared = await application.prepareEventStream(
    mutablePrincipal,
    "process-1",
    mutableInput,
  );

  mutableInput.last_event_id = "process-1:999";
  mutableInput.trace_id = "trace-mutated";
  mutablePrincipal.actor_id = "user:attacker";
  mutablePrincipal.scope.bot_id = "bot-attacker";
  assert.equal(Object.isFrozen(prepared.input), true);
  assert.equal(Object.isFrozen(prepared.principal.scope), true);
  assert.equal(Object.isFrozen(prepared.process), true);
  assert.equal(
    Object.isFrozen(prepared.process.process_snapshot_identity),
    true,
  );

  await collect(application.streamPreparedEvents(prepared));

  assert.equal(calls.stream[0].last_event_id, "process-1:1");
  assert.equal(calls.stream[0].trace_id, "trace-pinned");
  assert.equal(calls.stream[0].scope.bot_id, "bot-1");
  assert.equal(
    audit.records.find(
      (record) => record.endpoint === "events_complete",
    ).trace_id,
    "trace-pinned",
  );
  assert.equal(
    audit.records.find(
      (record) => record.endpoint === "events_complete",
    ).actor_identity,
    "user:viewer-1",
  );
});

test("SSE preparation propagates cancellation through process and Runtime owner reads", async () => {
  const runtimeGate = deferred();
  const preparation = new AbortController();
  const { application, calls, audit } = harness({
    audit: durableAudit(),
    runtimeGate: runtimeGate.promise,
  });
  const pending = application.prepareEventStream(
    debugViewer,
    "process-1",
    {
      include_ephemeral_tokens: true,
      trace_id: "trace-prepare-owner-cancel",
    },
    preparation.signal,
  );
  while (calls.runtime === 0) {
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  assert.equal(calls.processSignals[0], preparation.signal);
  assert.equal(calls.runtimeSignals[0], preparation.signal);
  preparation.abort(new Error("SSE preparation cancelled"));
  runtimeGate.resolve();
  await assert.rejects(pending, /SSE preparation cancelled/u);
  assert.equal(calls.stream.length, 0);
  assert.equal(calls.tokens, 0);
  assert.equal(
    audit.records.some(
      (record) => record.decision === "allowed_debug_start",
    ),
    false,
  );
});

test("debug SSE preparation propagates cancellation into its durable audit handoff", async () => {
  const auditGate = deferred();
  const auditSignals = [];
  const auditRecords = [];
  const audit = {
    durability: "durable_spool",
    async checkReadiness() {},
    async enqueue(record, signal) {
      auditRecords.push(structuredClone(record));
      auditSignals.push(signal);
      await auditGate.promise;
      return "durable";
    },
    async replay() {},
  };
  const preparation = new AbortController();
  const { application, calls } = harness({ audit });
  const pending = application.prepareEventStream(
    debugViewer,
    "process-1",
    {
      include_ephemeral_tokens: true,
      trace_id: "trace-prepare-audit-cancel",
    },
    preparation.signal,
  );
  while (auditSignals.length === 0) {
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  assert.equal(auditSignals[0], preparation.signal);
  preparation.abort(new Error("debug audit handoff cancelled"));
  auditGate.resolve();
  await assert.rejects(pending, /debug audit handoff cancelled/u);
  assert.equal(calls.stream.length, 0);
  assert.equal(calls.tokens, 0);
  assert.equal(auditRecords[0].decision, "allowed_debug_start");
  assert.equal(auditRecords.at(-1).decision, "failed");
});

test("SSE validates and ignores TP summary control frames without advancing the durable cursor", async () => {
  const { application } = harness({
    events: [
      { kind: "event", event: summaryFixture() },
      { kind: "event", event: eventFixture() },
    ],
  });
  const frames = await collect(
    application.streamEvents(viewer, "process-1", {
      last_event_id: "process-1:1",
      trace_id: "trace-summary-control",
    }),
  );
  assert.equal(frames.length, 1);
  assert.equal(frames[0].id, "process-1:2");
  assert.equal(frames[0].data.event_type, "snapshot_gap_skipped");

  const malformed = harness({
    events: [
      {
        kind: "event",
        event: summaryFixture({
          observation_summary: {
            phase: "closed",
            status: "failed",
            reason_code: "execution_completed",
            terminal_outcome: "executed",
            terminal_outcome_finalized_at:
              "2026-07-23T00:00:02.000Z",
            observation_finalized: true,
          },
        }),
      },
    ],
  });
  await assert.rejects(
    collect(
      malformed.application.streamEvents(viewer, "process-1", {
        last_event_id: "process-1:1",
        trace_id: "trace-summary-malformed",
      }),
    ),
    (error) =>
      error instanceof ObservationApplicationErrorV1 &&
      error.code === "upstream_schema_mismatch",
  );
});

test("SSE rejects reused durable IDs with different content", async () => {
  const first = eventFixture();
  const second = eventFixture({
    observation_summary: {
      ...first.observation_summary,
      repair_status: "completed",
    },
  });
  const { application } = harness({
    events: [
      { kind: "event", event: first },
      { kind: "event", event: second },
    ],
  });
  await assert.rejects(
    collect(
      application.streamEvents(viewer, "process-1", {
        last_event_id: "process-1:1",
        trace_id: "trace-4",
      }),
    ),
    (error) =>
      error instanceof ObservationApplicationErrorV1 &&
      error.code === "upstream_schema_mismatch",
  );
});

test("SSE drops exact replay duplicates but rejects a durable sequence gap", async () => {
  const duplicate = eventFixture();
  const exactReplay = harness({
    events: [
      { kind: "event", event: duplicate },
      { kind: "event", event: structuredClone(duplicate) },
    ],
  });
  const replayFrames = await collect(
    exactReplay.application.streamEvents(viewer, "process-1", {
      last_event_id: "process-1:1",
      trace_id: "trace-exact-replay",
    }),
  );
  assert.deepEqual(
    replayFrames.map((frame) => frame.id),
    ["process-1:2"],
  );

  const gap = harness({
    events: [
      { kind: "event", event: eventFixture() },
      {
        kind: "event",
        event: eventFixture({ append_sequence_no: 4 }),
      },
    ],
  });
  await assert.rejects(
    collect(
      gap.application.streamEvents(viewer, "process-1", {
        last_event_id: "process-1:1",
        trace_id: "trace-gap",
      }),
    ),
    (error) =>
      error instanceof ObservationApplicationErrorV1 &&
      error.code === "upstream_schema_mismatch" &&
      error.details.expected_append_sequence_no === 3 &&
      error.details.actual_append_sequence_no === 4,
  );
});

test("SSE preserves the owner cursor-ahead conflict instead of collapsing it into availability", async () => {
  const { application } = harness({
    streamError: new ObservationUpstreamErrorV1(
      "trigger_processor",
      "cursor_ahead",
      "cursor exceeds the current watermark",
    ),
  });
  await assert.rejects(
    collect(
      application.streamEvents(viewer, "process-1", {
        last_event_id: "process-1:999",
        trace_id: "trace-cursor-ahead",
      }),
    ),
    (error) =>
      error instanceof ObservationApplicationErrorV1 &&
      error.code === "replay_cursor_ahead" &&
      error.retryable === false,
  );
});

test("SSE canonical preflight rejects accessor and Proxy frames before owner schema traversal", async () => {
  let getterCalls = 0;
  const accessorEvent = eventFixture();
  Object.defineProperty(accessorEvent, "observation_summary", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return eventFixture().observation_summary;
    },
  });
  const accessorHarness = harness({
    events: [{ kind: "event", event: accessorEvent }],
  });
  await assert.rejects(
    collect(
      accessorHarness.application.streamEvents(viewer, "process-1", {
        last_event_id: "process-1:1",
        trace_id: "trace-accessor-boundary",
      }),
    ),
    (error) =>
      error instanceof ObservationApplicationErrorV1 &&
      error.code === "upstream_schema_mismatch",
  );
  assert.equal(getterCalls, 0);

  let proxyTrapCalls = 0;
  const proxyEvent = new Proxy(eventFixture(), {
    ownKeys(target) {
      proxyTrapCalls += 1;
      return Reflect.ownKeys(target);
    },
  });
  const proxyHarness = harness({
    events: [{ kind: "event", event: proxyEvent }],
  });
  await assert.rejects(
    collect(
      proxyHarness.application.streamEvents(viewer, "process-1", {
        last_event_id: "process-1:1",
        trace_id: "trace-proxy-boundary",
      }),
    ),
    (error) =>
      error instanceof ObservationApplicationErrorV1 &&
      error.code === "upstream_schema_mismatch",
  );
  assert.equal(proxyTrapCalls, 0);
});

test("debug output requires a durable audit handoff and invalid token owner frames fail closed", async () => {
  const memoryOnly = harness({ holdStream: true });
  await assert.rejects(
    collect(
      memoryOnly.application.streamEvents(debugViewer, "process-1", {
        include_ephemeral_tokens: true,
        trace_id: "trace-memory-audit",
      }),
    ),
    (error) =>
      error instanceof ObservationApplicationErrorV1 &&
      error.code === "audit_unavailable",
  );
  assert.equal(memoryOnly.calls.tokens, 0);

  const unavailableAudit = durableAudit();
  unavailableAudit.setAvailable(false);
  const unavailable = harness({ audit: unavailableAudit });
  await assert.rejects(
    collect(
      unavailable.application.streamEvents(debugViewer, "process-1", {
        include_ephemeral_tokens: true,
        trace_id: "trace-5",
      }),
    ),
    (error) =>
      error instanceof ObservationApplicationErrorV1 &&
      error.code === "audit_unavailable",
  );
  assert.equal(unavailable.calls.tokens, 0);

  const invalid = harness({
    audit: durableAudit(),
    holdStream: true,
    tokens: [
      {
        schema_version: "runtime_token_sse_event.v1",
        runtime_run_id: "run-1",
        trigger_process_id: "process-1",
        token: "secret-token",
        emitted_at: "2026-07-23T00:00:01.000Z",
        event_id: "must-not-exist",
      },
    ],
  });
  await assert.rejects(
    collect(
      invalid.application.streamEvents(debugViewer, "process-1", {
        include_ephemeral_tokens: true,
        trace_id: "trace-6",
      }),
    ),
    (error) =>
      error instanceof ObservationApplicationErrorV1 &&
      error.code === "upstream_schema_mismatch",
  );
  assert.equal(
    JSON.stringify(invalid.audit.records).includes("secret-token"),
    false,
  );
});

test("ephemeral token side stream does not start for a terminal Runtime run", async () => {
  const terminalRuntime = runtimeFixture({
    status: "completed",
    completed_at: "2026-07-23T00:00:03.000Z",
    terminal_reason: "completed",
  });
  const { application, calls } = harness({
    audit: durableAudit(),
    runtime: terminalRuntime,
    tokens: [
      {
        schema_version: "runtime_token_sse_event.v1",
        runtime_run_id: "run-1",
        trigger_process_id: "process-1",
        token: "must-not-be-forwarded",
        emitted_at: "2026-07-23T00:00:04.000Z",
      },
    ],
  });
  const frames = await collect(
    application.streamEvents(debugViewer, "process-1", {
      last_event_id: "process-1:1",
      include_ephemeral_tokens: true,
      trace_id: "trace-terminal-token",
    }),
  );
  assert.deepEqual(frames, []);
  assert.equal(calls.tokens, 0);
});

test("a terminal debug request still requires a durable completion audit", async () => {
  const audit = durableAudit();
  const { application, calls } = harness({
    audit,
    runtime: runtimeFixture({
      status: "completed",
      completed_at: "2026-07-23T00:00:03.000Z",
      terminal_reason: "completed",
    }),
  });
  const prepared = await application.prepareEventStream(
    debugViewer,
    "process-1",
    {
      last_event_id: "process-1:1",
      include_ephemeral_tokens: true,
      trace_id: "trace-terminal-debug-audit",
    },
  );
  audit.setAvailable(false);
  await assert.rejects(
    collect(application.streamPreparedEvents(prepared)),
    (error) =>
      error instanceof ObservationApplicationErrorV1 &&
      error.code === "audit_unavailable",
  );
  assert.equal(calls.tokens, 0);
  assert.equal(audit.records.length, 1);
  assert.equal(audit.records[0].decision, "allowed_debug_start");
});

test("a closed TP process or expired credential cannot start an ephemeral token side stream", async () => {
  const closed = harness({
    audit: durableAudit(),
    process: processFixture({
      phase: "closed",
      status: "completed",
      terminal_reason: "completed",
      terminal_outcome: "executed",
      terminal_outcome_finalized_at: "2026-07-23T00:00:03.000Z",
      canonical_reason_code: "execution_completed",
      observation_finalized: true,
    }),
    tokens: [
      {
        schema_version: "runtime_token_sse_event.v1",
        runtime_run_id: "run-1",
        trigger_process_id: "process-1",
        token: "must-not-be-forwarded",
        emitted_at: "2026-07-23T00:00:04.000Z",
      },
    ],
  });
  const frames = await collect(
    closed.application.streamEvents(debugViewer, "process-1", {
      last_event_id: "process-1:1",
      include_ephemeral_tokens: true,
      trace_id: "trace-closed-token",
    }),
  );
  assert.deepEqual(frames, []);
  assert.equal(closed.calls.tokens, 0);

  const expired = harness({ audit: durableAudit() });
  await assert.rejects(
    expired.application.prepareEventStream(
      {
        ...debugViewer,
        credential_expires_at_epoch_seconds:
          Math.floor(Date.now() / 1_000) - 1,
      },
      "process-1",
      {
        include_ephemeral_tokens: true,
        trace_id: "trace-expired-token",
      },
    ),
    (error) =>
      error instanceof ObservationApplicationErrorV1 &&
      error.code === "debug_permission_denied",
  );
  assert.equal(expired.calls.process, 0);
  assert.equal(expired.calls.runtime, 0);
  assert.equal(expired.calls.tokens, 0);
});

test("credential expiry terminates a durable-only SSE lease, aborts its owner pump and audits the closure", async () => {
  const expiringViewer = {
    ...viewer,
    credential_expires_at_epoch_seconds:
      Math.ceil(Date.now() / 1_000) + 1,
  };
  const { application, calls, audit } = harness({ holdStream: true });
  await assert.rejects(
    withTimeout(
      collect(
        application.streamEvents(expiringViewer, "process-1", {
          last_event_id: "process-1:1",
          trace_id: "trace-durable-expiry",
        }),
      ),
      3_000,
    ),
    (error) =>
      error instanceof ObservationApplicationErrorV1 &&
      error.code === "bot_permission_denied",
  );
  assert.equal(calls.stream.length, 1);
  assert.equal(calls.tokens, 0);
  const completion = audit.records.find(
    (record) =>
      record.endpoint === "events_complete" &&
      record.trace_id === "trace-durable-expiry",
  );
  assert.equal(completion.decision, "stream_authorization_expired");
  assert.equal(completion.status_code, 403);
});

test("credential expiry discards buffered frames and dominates a concurrent producer failure", async () => {
  const expiresAt = Math.ceil(Date.now() / 1_000) + 1;
  const { application, audit } = harness({
    events: [
      { kind: "event", event: eventFixture({ append_sequence_no: 2 }) },
      { kind: "event", event: eventFixture({ append_sequence_no: 3 }) },
    ],
    streamError: new ObservationUpstreamErrorV1(
      "trigger_processor",
      "unavailable",
      "late durable failure",
    ),
  });
  const iterator = application
    .streamEvents(
      {
        ...viewer,
        credential_expires_at_epoch_seconds: expiresAt,
      },
      "process-1",
      {
        last_event_id: "process-1:1",
        trace_id: "trace-buffered-expiry",
      },
    )
    [Symbol.asyncIterator]();
  const first = await withTimeout(iterator.next());
  assert.equal(first.value.id, "process-1:2");
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) =>
    setTimeout(
      resolve,
      Math.max(0, expiresAt * 1_000 - Date.now() + 25),
    ),
  );
  await assert.rejects(
    withTimeout(iterator.next()),
    (error) =>
      error instanceof ObservationApplicationErrorV1 &&
      error.code === "bot_permission_denied",
  );
  const completion = audit.records.find(
    (record) =>
      record.endpoint === "events_complete" &&
      record.trace_id === "trace-buffered-expiry",
  );
  assert.equal(completion.decision, "stream_authorization_expired");
  assert.equal(completion.status_code, 403);
});

test("debug SSE expiry terminates both token and durable pumps", async () => {
  let tokenPumpObservedAbort = false;
  const expiringDebugViewer = {
    ...debugViewer,
    credential_expires_at_epoch_seconds:
      Math.ceil(Date.now() / 1_000) + 1,
  };
  const { application, calls, audit } = harness({
    audit: durableAudit(),
    holdStream: true,
    tokenStream: async function* (signal) {
      if (!signal.aborted) {
        await new Promise((resolve) => {
          signal.addEventListener("abort", resolve, { once: true });
        });
      }
      tokenPumpObservedAbort = signal.aborted;
    },
  });
  await assert.rejects(
    withTimeout(
      collect(
        application.streamEvents(expiringDebugViewer, "process-1", {
          last_event_id: "process-1:1",
          include_ephemeral_tokens: true,
          trace_id: "trace-debug-expiry",
        }),
      ),
      3_000,
    ),
    (error) =>
      error instanceof ObservationApplicationErrorV1 &&
      error.code === "debug_permission_denied",
  );
  assert.equal(calls.stream.length, 1);
  assert.equal(calls.tokens, 1);
  assert.equal(tokenPumpObservedAbort, true);
  const completion = audit.records.find(
    (record) =>
      record.endpoint === "events_complete" &&
      record.trace_id === "trace-debug-expiry",
  );
  assert.equal(completion.decision, "stream_authorization_expired");
  assert.equal(completion.status_code, 403);
});

test("a far-future safe-integer credential expiry cannot overflow the SSE timer", async () => {
  const downstream = new AbortController();
  const { application, calls } = harness({ holdStream: true });
  const iterator = application
    .streamEvents(
      {
        ...viewer,
        credential_expires_at_epoch_seconds: Number.MAX_SAFE_INTEGER,
      },
      "process-1",
      {
        last_event_id: "process-1:1",
        trace_id: "trace-far-future-expiry",
      },
      downstream.signal,
    )
    [Symbol.asyncIterator]();
  const pending = iterator.next();
  await withTimeout(
    (async () => {
      while (calls.stream.length === 0) {
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
    })(),
  );
  await new Promise((resolve) => setTimeout(resolve, 10));
  downstream.abort(new Error("test complete"));
  assert.deepEqual(await withTimeout(pending), {
    value: undefined,
    done: true,
  });
});

test("authorization and audit timestamps share the injected wall clock while duration uses a monotonic clock", async () => {
  const fixedNow = new Date("2026-07-23T00:00:02.000Z");
  const fixedNowSeconds = Math.floor(fixedNow.getTime() / 1_000);
  const monotonicValues = [1_000, 1_123];
  const { application, audit } = harness({
    events: [{ kind: "event", event: eventFixture() }],
    applicationOptions: {
      now: () => new Date(fixedNow),
      monotonic_now_ms: () => monotonicValues.shift(),
    },
  });
  const frames = await collect(
    application.streamEvents(
      {
        ...viewer,
        credential_expires_at_epoch_seconds: fixedNowSeconds + 10,
      },
      "process-1",
      {
        last_event_id: "process-1:1",
        trace_id: "trace-injected-clocks",
      },
    ),
  );
  assert.deepEqual(frames.map((frame) => frame.id), ["process-1:2"]);
  assert.deepEqual(
    audit.records.map((record) => record.occurred_at),
    [fixedNow.toISOString(), fixedNow.toISOString()],
  );
  assert.equal(
    audit.records.find(
      (record) => record.endpoint === "events_complete",
    ).connection_duration_ms,
    123,
  );

  const invalidWallClock = harness({
    applicationOptions: { now: () => new Date(Number.NaN) },
  });
  await assert.rejects(
    invalidWallClock.application.checkReadiness(),
    (error) =>
      error instanceof ObservationApplicationErrorV1 &&
      error.code === "upstream_unavailable",
  );

  const invalidMonotonicClock = harness({
    applicationOptions: { monotonic_now_ms: () => Number.NaN },
  });
  await assert.rejects(
    invalidMonotonicClock.application.checkReadiness(),
    (error) =>
      error instanceof ObservationApplicationErrorV1 &&
      error.code === "upstream_unavailable",
  );
});

test("owner list responses must honor the requested filters and trace binding", async () => {
  const toolMismatch = harness({
    tools: {
      runtime_run_id: "run-1",
      items: [
        {
          tool_invocation_id: "tool-1",
          tool_name: "search",
          status: "completed",
          side_effect_status: "produced",
          input_ref: null,
          output_ref: "artifact-1",
          failure_class: null,
          started_at: "2026-07-23T00:00:01.000Z",
          completed_at: "2026-07-23T00:00:02.000Z",
        },
      ],
      next_cursor: null,
      has_more: false,
    },
  });
  await assert.rejects(
    toolMismatch.application.listToolInvocations(
      viewer,
      "process-1",
      {
        status: "failed",
        trace_id: "trace-tool-filter",
      },
    ),
    (error) =>
      error instanceof ObservationApplicationErrorV1 &&
      error.code === "upstream_schema_mismatch",
  );
  assert.equal(toolMismatch.audit.records.at(-1).decision, "failed");
  assert.equal(toolMismatch.audit.records.at(-1).status_code, 502);

  const qualityMismatch = harness({
    quality: {
      trigger_process_id: "process-1",
      bot_id: "bot-1",
      items: [
        {
          id: "quality-1",
          signal_type: "tool_execution_failed",
          severity: "warning",
          source_kind: "service",
          source_service: "action_runtime",
          actor_principal: null,
          actor_role: null,
          source_ref: "runtime-run:run-1",
          evidence_refs: [],
          recommended_action: null,
          payload_summary: {},
          created_at: "2026-07-23T00:00:02.000Z",
        },
      ],
      next_cursor: null,
      has_more: false,
      trace_id: "trace-quality-filter",
    },
  });
  await assert.rejects(
    qualityMismatch.application.listQualitySignals(
      viewer,
      "process-1",
      {
        severity: "critical",
        trace_id: "trace-quality-filter",
      },
    ),
    (error) =>
      error instanceof ObservationApplicationErrorV1 &&
      error.code === "upstream_schema_mismatch",
  );

  const traceMismatch = harness({
    quality: {
      trigger_process_id: "process-1",
      bot_id: "bot-1",
      items: [],
      next_cursor: null,
      has_more: false,
      trace_id: "other-trace",
    },
  });
  await assert.rejects(
    traceMismatch.application.listQualitySignals(
      viewer,
      "process-1",
      { trace_id: "trace-quality-owner" },
    ),
    (error) =>
      error instanceof ObservationApplicationErrorV1 &&
      error.code === "upstream_schema_mismatch",
  );
});

test("every owner fan-out carries the real delegated principal and its fixed read capability", async () => {
  const { application, calls } = harness({
    events: [{ kind: "event", event: eventFixture() }],
    quality: {
      trigger_process_id: "process-1",
      bot_id: "bot-1",
      items: [],
      next_cursor: null,
      has_more: false,
      trace_id: "trace-owner-quality",
    },
  });
  await application.getSnapshot(viewer, "process-1", "trace-owner-auth");
  await application.listToolInvocations(viewer, "process-1", {
    runtime_run_id: "run-1",
    trace_id: "trace-owner-tools",
  });
  await application.listQualitySignals(viewer, "process-1", {
    trace_id: "trace-owner-quality",
  });
  await collect(
    application.streamEvents(viewer, "process-1", {
      last_event_id: "process-1:1",
      trace_id: "trace-owner-events",
    }),
  );

  for (const input of [
    ...calls.processInputs,
    ...calls.runtimeInputs,
    ...calls.metaInputs,
    ...calls.toolInputs,
    ...calls.qualityInputs,
    ...calls.stream,
  ]) {
    assert.deepEqual(
      input.delegated_principal,
      viewer.delegated_principal,
    );
    assert.equal(Object.isFrozen(input.delegated_principal), true);
  }
  assert.deepEqual(calls.processInputs[0].workload, {
    sub: "observation_gateway",
    aud: "trigger_processor",
    capabilities: [
      "trigger.context_snapshot.resolve",
      "trigger.process.read",
      "trigger.process.snapshot.resolve",
    ],
  });
  assert.equal(
    calls.runtimeInputs[0].workload.capability,
    "runtime.run.read",
  );
  assert.equal(
    calls.toolInputs[0].workload.capability,
    "runtime.tool_invocations.read",
  );
  assert.equal(
    calls.metaInputs[0].workload.capability,
    "meta.job.read",
  );
  assert.equal(
    calls.qualityInputs[0].workload.capability,
    "meta.quality_signals.read",
  );
  assert.equal(
    calls.stream[0].workload.capability,
    "trigger.process.events.read",
  );
});

test("ordinary reads reject expired workload leases and forged delegated bindings before owner access", async () => {
  const expired = harness();
  await assert.rejects(
    expired.application.getSnapshot(
      {
        ...viewer,
        credential_expires_at_epoch_seconds:
          Math.floor(Date.now() / 1_000) - 1,
      },
      "process-1",
      "trace-expired-read",
    ),
    (error) =>
      error instanceof ObservationApplicationErrorV1 &&
      error.code === "bot_permission_denied",
  );
  assert.equal(expired.calls.process, 0);

  const forged = harness();
  await assert.rejects(
    forged.application.getSnapshot(
      {
        ...viewer,
        delegated_principal: {
          ...viewer.delegated_principal,
          principal_id: "attacker",
        },
      },
      "process-1",
      "trace-forged-delegation",
    ),
    (error) =>
      error instanceof ObservationApplicationErrorV1 &&
      error.code === "bot_permission_denied",
  );
  assert.equal(forged.calls.process, 0);
});

test("tool summaries redact sensitive allowlisted strings and never return owner input or output references", async () => {
  const { application } = harness({
    tools: {
      runtime_run_id: "run-1",
      items: [
        {
          tool_invocation_id: "tool-call-1",
          tool_name: "api_key=owner-secret",
          status: "completed",
          side_effect_status: "produced",
          input_ref: "input:owner-secret",
          output_ref: "output:owner-secret",
          failure_class: null,
          started_at: "2026-07-23T00:00:00.000Z",
          completed_at: "2026-07-23T00:00:01.000Z",
        },
      ],
      next_cursor: null,
      has_more: false,
    },
  });
  const response = await application.listToolInvocations(
    viewer,
    "process-1",
    {
      runtime_run_id: "run-1",
      trace_id: "trace-redacted-tool",
    },
  );
  assert.equal(response.items[0].tool_name, "[REDACTED]");
  assert.equal(response.redacted_field_count, 3);
  assert.equal(JSON.stringify(response).includes("owner-secret"), false);
});

test("downstream disconnect aborts held owner streams without hanging", async () => {
  const { application, calls } = harness({ holdStream: true });
  const prepared = await application.prepareEventStream(
    viewer,
    "process-1",
    {
      last_event_id: "process-1:1",
      trace_id: "trace-disconnect",
    },
  );
  const downstream = new AbortController();
  const iterator = application
    .streamPreparedEvents(prepared, downstream.signal)
    [Symbol.asyncIterator]();
  const pending = iterator.next();
  await withTimeout(
    (async () => {
      while (calls.stream.length === 0) {
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
    })(),
  );
  downstream.abort(new Error("client disconnected"));
  assert.deepEqual(await withTimeout(pending), {
    value: undefined,
    done: true,
  });
  await assert.rejects(
    collect(application.streamPreparedEvents(prepared)),
    (error) =>
      error instanceof ObservationApplicationErrorV1 &&
      error.code === "invalid_request",
  );
});

test("a token adapter that ignores abort cannot leak after the target run terminates", async () => {
  const terminalEvent = eventFixture({
    event_type: "runtime.run.completed",
    observation_summary: {
      duration_ms: 10,
      reason_code: "completed",
      error_summary: null,
      artifact_ref: null,
      status: "completed",
      runtime_run_id: "run-1",
    },
  });
  const downstream = new AbortController();
  const { application } = harness({
    audit: durableAudit(),
    events: [{ kind: "event", event: terminalEvent }],
    holdStream: true,
    tokenStream: async function* () {
      await new Promise((resolve) => setTimeout(resolve, 20));
      yield {
        schema_version: "runtime_token_sse_event.v1",
        runtime_run_id: "run-1",
        trigger_process_id: "process-1",
        token: "must-not-leak-after-terminal",
        emitted_at: "2026-07-23T00:00:03.000Z",
      };
    },
  });
  const stop = setTimeout(() => downstream.abort(), 60);
  const frames = await withTimeout(
    collect(
      application.streamEvents(
        debugViewer,
        "process-1",
        {
          last_event_id: "process-1:1",
          include_ephemeral_tokens: true,
          trace_id: "trace-terminal-race",
        },
        downstream.signal,
      ),
    ),
  );
  clearTimeout(stop);
  assert.equal(
    frames.some((frame) => frame.event === "runtime_token"),
    false,
  );
  assert.equal(
    JSON.stringify(frames).includes("must-not-leak-after-terminal"),
    false,
  );
  assert.equal(frames.some((frame) => frame.durable), true);
});

test("an abort-signaled token adapter error is not reported as an upstream degradation", async () => {
  const terminalEvent = eventFixture({
    event_type: "runtime.run.completed",
    observation_summary: {
      duration_ms: 10,
      reason_code: "completed",
      error_summary: null,
      artifact_ref: null,
      status: "completed",
      runtime_run_id: "run-1",
    },
  });
  const downstream = new AbortController();
  let tokenAdapterSettled = false;
  const { application } = harness({
    audit: durableAudit(),
    events: [{ kind: "event", event: terminalEvent }],
    holdStream: true,
    tokenStream: async function* (signal) {
      try {
        if (!signal.aborted) {
          await new Promise((resolve) =>
            signal.addEventListener("abort", resolve, { once: true }),
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
        throw new Error("adapter abort");
      } finally {
        tokenAdapterSettled = true;
      }
    },
  });
  const stop = setTimeout(() => downstream.abort(), 30);
  const frames = await withTimeout(
    collect(
      application.streamEvents(
        debugViewer,
        "process-1",
        {
          last_event_id: "process-1:1",
          include_ephemeral_tokens: true,
          trace_id: "trace-token-abort",
        },
        downstream.signal,
      ),
    ),
  );
  clearTimeout(stop);
  assert.equal(
    frames.some((frame) => frame.event === "observation.degraded"),
    false,
  );
  assert.equal(frames.some((frame) => frame.durable), true);
  assert.equal(tokenAdapterSettled, true);
});

test("bounded SSE buffering fails closed and aborts producers on backpressure", async () => {
  const { application } = harness({
    events: [2, 3, 4].map((append_sequence_no) => ({
      kind: "event",
      event: eventFixture({ append_sequence_no }),
    })),
    holdStream: true,
    applicationOptions: {
      buffer_max_events: 1,
      buffer_max_bytes: 1_048_576,
    },
  });
  const stream = application.streamEvents(viewer, "process-1", {
    last_event_id: "process-1:1",
    trace_id: "trace-backpressure",
  });
  const iterator = stream[Symbol.asyncIterator]();
  const first = await withTimeout(iterator.next());
  assert.equal(first.value.id, "process-1:2");
  await new Promise((resolve) => setTimeout(resolve, 10));
  await assert.rejects(
    withTimeout(
      (async () => {
        while (!(await iterator.next()).done) {
          // Drain until the producer error is surfaced.
        }
      })(),
    ),
    (error) =>
      error instanceof ObservationApplicationErrorV1 &&
      error.code === "sse_backpressure_exceeded",
  );
});

test("debug access retries the durable handoff and recovers without unrelated traffic", async () => {
  const audit = durableAudit();
  const { application } = harness({ audit });
  audit.setAvailable(false);
  await application.getSnapshot(viewer, "process-1", "trace-audit-down");
  await assert.rejects(
    application.prepareEventStream(debugViewer, "process-1", {
      include_ephemeral_tokens: true,
      trace_id: "trace-debug-blocked",
    }),
    (error) =>
      error instanceof ObservationApplicationErrorV1 &&
      error.code === "audit_unavailable",
  );

  audit.setAvailable(true);
  const prepared = await application.prepareEventStream(
    debugViewer,
    "process-1",
    {
      include_ephemeral_tokens: true,
      trace_id: "trace-debug-recovered",
    },
  );
  assert.equal(prepared.include_tokens, true);
});

test("required durable audit retries commit-unknown with the exact same audit identity", async () => {
  const attempts = [];
  const committed = new Set();
  const audit = {
    durability: "durable_spool",
    async checkReadiness() {},
    async enqueue(record) {
      attempts.push(structuredClone(record));
      if (!committed.has(record.audit_id)) {
        committed.add(record.audit_id);
        return "commit_unknown";
      }
      return "durable";
    },
    async replay() {},
  };
  const { application } = harness({
    audit,
    applicationOptions: {
      require_durable_audit_handoff: true,
    },
  });
  const response = await application.getSnapshot(
    viewer,
    "process-1",
    "trace-audit-commit-unknown",
  );
  assert.equal(response.trigger_process.id, "process-1");
  assert.equal(attempts.length, 2);
  assert.equal(attempts[0].audit_id, attempts[1].audit_id);
  assert.deepEqual(attempts[0], attempts[1]);
});

test("an unresolved audit commit does not manufacture a contradictory second audit fact", async () => {
  const attempts = [];
  const audit = {
    durability: "durable_spool",
    async checkReadiness() {},
    async enqueue(record) {
      attempts.push(structuredClone(record));
      return "commit_unknown";
    },
    async replay() {},
  };
  const { application } = harness({
    audit,
    applicationOptions: {
      require_durable_audit_handoff: true,
    },
  });
  await assert.rejects(
    application.getSnapshot(
      viewer,
      "process-1",
      "trace-audit-still-unknown",
    ),
    (error) =>
      error instanceof ObservationApplicationErrorV1 &&
      error.code === "audit_unavailable",
  );
  assert.equal(attempts.length, 2);
  assert.equal(attempts[0].audit_id, attempts[1].audit_id);
  assert.equal(attempts[0].decision, "allowed");
  assert.deepEqual(attempts[0], attempts[1]);
});

test("required durable audit fails closed for memory-only and unavailable spools", async () => {
  const memoryOnly = harness({
    applicationOptions: {
      require_durable_audit_handoff: true,
    },
  });
  await assert.rejects(
    memoryOnly.application.getSnapshot(
      viewer,
      "process-1",
      "trace-memory-audit-required",
    ),
    (error) =>
      error instanceof ObservationApplicationErrorV1 &&
      error.code === "audit_unavailable",
  );

  const unavailable = {
    durability: "durable_spool",
    async checkReadiness() {},
    async enqueue() {
      return "unavailable";
    },
    async replay() {},
  };
  const durableButDown = harness({
    audit: unavailable,
    applicationOptions: {
      require_durable_audit_handoff: true,
    },
  });
  await assert.rejects(
    durableButDown.application.getSnapshot(
      viewer,
      "process-1",
      "trace-durable-audit-down",
    ),
    (error) =>
      error instanceof ObservationApplicationErrorV1 &&
      error.code === "audit_unavailable",
  );
});

test("audit spool retains records until sink acknowledgement and replays across adapter restart", async () => {
  const pending = [];
  const delivered = [];
  let acknowledge = false;
  const sink = {
    async append(record) {
      delivered.push(record.audit_id);
      return acknowledge ? "acknowledged" : "retry";
    },
  };
  const first = new InMemoryObservationAccessAuditSpoolV1(
    pending,
    10,
    true,
    sink,
  );
  const record = {
    audit_id: "audit-1",
    occurred_at: "2026-07-23T00:00:00.000Z",
    actor_identity: "user:1",
    service_identity: "action_runtime",
    roles: ["observation.viewer"],
    ...scope,
    resource_type: "trigger_process",
    resource_id: "process-1",
    endpoint: "snapshot",
    include_ephemeral_tokens: false,
    decision: "allowed",
    status_code: 200,
    trace_id: "trace-7",
    connection_duration_ms: 0,
    redacted_field_count: 0,
  };
  const atCapacity = new InMemoryObservationAccessAuditSpoolV1(
    [structuredClone(record)],
    1,
  );
  assert.equal(await atCapacity.enqueue(record), "durable");
  assert.equal(atCapacity.records.length, 1);
  assert.equal(await first.enqueue(record), "durable");
  await first.replay();
  assert.equal(pending.length, 1);
  acknowledge = true;
  const restarted = new InMemoryObservationAccessAuditSpoolV1(
    pending,
    10,
    true,
    sink,
  );
  await restarted.replay();
  assert.equal(pending.length, 0);
  assert.deepEqual(delivered, ["audit-1", "audit-1"]);
});

test("HTTP SSE observes a disconnect during prepare and never starts or hijacks the owner stream", async () => {
  const processGate = deferred();
  const { application, calls, audit } = harness({
    processGate: processGate.promise,
    holdStream: true,
  });
  const now = Math.floor(Date.now() / 1_000);
  const verifier = {
    async verify() {
      return {
        protectedHeader: { alg: "EdDSA", kid: "test", typ: "JWT" },
        claims: {
          iss: "pai-workload",
          sub: "action_runtime",
          aud: "observation_gateway",
          jti: "jti-prepare-disconnect",
          iat: now,
          nbf: now,
          exp: now + 60,
          capability: ["observation.read"],
          scope_kind: "bot",
          ...scope,
          delegated_principal: {
            principal_type: "user",
            principal_id: "viewer-prepare-disconnect",
            roles: ["observation.viewer"],
            source_issuer: "test",
            source_subject: "viewer-prepare-disconnect",
            auth_time: now,
            scope_kind: "bot",
            ...scope,
          },
        },
      };
    },
  };
  const app = buildObservationGatewayApp(
    { logger: false, auth: { verifier } },
    { observation: application },
    { allowed_callers: ["action_runtime"] },
  );
  let client;
  try {
    const address = await app.listen({ host: "127.0.0.1", port: 0 });
    client = httpRequest(
      new URL(
        "/internal/observation/trigger-processes/process-1/events",
        address,
      ),
      {
        method: "GET",
        headers: { authorization: "Bearer aaa.bbb.ccc" },
      },
    );
    client.on("error", () => {
      // Destroying the client before headers is the condition under test.
    });
    client.end();
    await withTimeout(
      (async () => {
        while (calls.process === 0) {
          await new Promise((resolve) => setTimeout(resolve, 1));
        }
      })(),
    );
    client.destroy();
    await new Promise((resolve) => setTimeout(resolve, 25));
    processGate.resolve();
    await withTimeout(
      (async () => {
        while (
          !audit.records.some(
            (record) =>
              record.endpoint === "events" &&
              record.decision === "failed",
          )
        ) {
          await new Promise((resolve) => setTimeout(resolve, 1));
        }
      })(),
      1_000,
    );
    assert.equal(calls.stream.length, 0);
    assert.equal(calls.tokens, 0);
    assert.equal(calls.processSignals[0]?.aborted, true);
  } finally {
    client?.destroy();
    processGate.resolve();
    await app.close();
  }
});

test("HTTP boundary accepts only signed delegated exact roles", async () => {
  const { application } = harness();
  const now = Math.floor(Date.now() / 1000);
  let delegatedRoles = ["observation.viewer"];
  const verifier = {
    async verify(_token, requirements) {
      assert.equal(requirements.audience, "observation_gateway");
      return {
        protectedHeader: { alg: "EdDSA", kid: "test", typ: "JWT" },
        claims: {
          iss: "pai-workload",
          sub: "action_runtime",
          aud: "observation_gateway",
          jti: "jti-1",
          iat: now,
          nbf: now,
          exp: now + 60,
          capability: ["observation.read"],
          scope_kind: "bot",
          ...scope,
          delegated_principal: {
            principal_type: "user",
            principal_id: "viewer-1",
            roles: delegatedRoles,
            source_issuer: "test",
            source_subject: "viewer-1",
            auth_time: now,
            scope_kind: "bot",
            ...scope,
          },
        },
      };
    },
  };
  const app = buildObservationGatewayApp(
    { logger: false, auth: { verifier } },
    { observation: application },
    { allowed_callers: ["action_runtime"] },
  );
  const allowed = await app.inject({
    method: "GET",
    url: "/internal/observation/trigger-processes/process-1",
    headers: { authorization: "Bearer aaa.bbb.ccc" },
  });
  assert.equal(allowed.statusCode, 200);

  for (const url of [
    "/internal/observation/trigger-processes/process-1?unknown=value",
    "/internal/observation/trigger-processes/process-1/events?unknown=value",
    "/internal/observation/trigger-processes/process-1/tool-invocations?limit=not-an-integer",
  ]) {
    const invalidQuery = await app.inject({
      method: "GET",
      url,
      headers: { authorization: "Bearer aaa.bbb.ccc" },
    });
    assert.equal(invalidQuery.statusCode, 400, invalidQuery.body);
    assert.equal(invalidQuery.json().code, "invalid_request");
  }

  const runtimeDetails = await app.inject({
    method: "GET",
    url: "/internal/observation/trigger-processes/process-1/runtime-runs/run-1",
    headers: { authorization: "Bearer aaa.bbb.ccc" },
  });
  assert.equal(runtimeDetails.statusCode, 200);
  assert.equal(runtimeDetails.json().runtime.runtime_run_id, "run-1");

  const metaDetails = await app.inject({
    method: "GET",
    url: "/internal/observation/trigger-processes/process-1/meta/jobs/job-1",
    headers: { authorization: "Bearer aaa.bbb.ccc" },
  });
  assert.equal(metaDetails.statusCode, 200);
  assert.equal(metaDetails.json().meta.job_id, "job-1");

  const forgedRuntime = await app.inject({
    method: "GET",
    url: "/internal/observation/trigger-processes/process-1/runtime-runs/other-run",
    headers: { authorization: "Bearer aaa.bbb.ccc" },
  });
  assert.equal(forgedRuntime.statusCode, 409);

  delegatedRoles = ["observation_viewer"];
  const alias = await app.inject({
    method: "GET",
    url: "/internal/observation/trigger-processes/process-1",
    headers: { authorization: "Bearer aaa.bbb.ccc" },
  });
  assert.equal(alias.statusCode, 403);
  await app.close();
});
