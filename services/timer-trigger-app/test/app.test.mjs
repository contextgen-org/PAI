import assert from "node:assert/strict";
import test from "node:test";

import { buildTimerTriggerApp } from "../dist/app.js";
import { TIMER_REPOSITORY_CONTRACT_V1 } from "../dist/db/permission-manifest.v1.js";
import {
  InMemoryTimerStateRepositoryV1,
  TimerApplicationErrorV1,
  TimerApplicationV1,
} from "../dist/timer-application.v1.js";
import {
  toTimerApplicationCommandV1,
  toTimerOwnerCommandResponseV1,
} from "../dist/timer-owner-contract-adapter.v1.js";

const token = "aaa.bbb.ccc";
const scope = Object.freeze({
  workspace_id: "workspace_1",
  bot_id: "bot_1",
  owner_agent_id: "agent_1",
  deployment_environment: "dev",
  release_channel: "stable",
});

function credential(capabilities = ["timer.write"]) {
  return {
    claims: {
      iss: "pai-workload",
      sub: "action_runtime",
      aud: "timer_trigger_app",
      jti: "credential_1",
      iat: 100,
      nbf: 100,
      exp: 200,
      capability: capabilities,
      scope_kind: "bot",
      ...scope,
    },
    protectedHeader: { alg: "EdDSA", kid: "key_1", typ: "JWT" },
  };
}

function workerCredential(capabilities = ["timer.worker.dispatch"]) {
  return {
    ...credential(capabilities),
    claims: {
      ...credential(capabilities).claims,
      sub: "timer_trigger_app",
    },
  };
}

function command(overrides = {}) {
  return {
    schema_version: "timer.schedule_command.v1",
    ...scope,
    method: "timer.remind_at",
    command: "create",
    runtime_run_id: "runtime_1",
    trigger_process_id: "process_1",
    client_request_id: "request_1",
    trace_id: "trace_1",
    schedule: {
      name: "future reminder",
      message: "future reminder",
      schedule_type: "once",
      timezone: "UTC",
      fire_at: "2099-01-01T00:00:00.000Z",
      catch_up: true,
      payload: {
        schema_version: "timer.trigger_payload.v1",
        value: {},
      },
    },
    ...overrides,
  };
}

function application() {
  return new TimerApplicationV1(
    new InMemoryTimerStateRepositoryV1(),
    {
      async submit() {
        throw new Error("not used");
      },
      async getProcess() {
        throw new Error("not used");
      },
    },
    {
      clock: () => new Date("2026-07-23T12:02:00.000Z"),
    },
  );
}

test("owner response projection rejects a typed Proxy before any property read", async () => {
  const principal = {
    caller: "action_runtime",
    capabilities: ["timer.read", "timer.write"],
    scope,
  };
  const mapped = toTimerApplicationCommandV1(command(), principal);
  const result = await application().executeCommand(
    principal,
    mapped.internal,
    new Date("2026-07-23T00:00:00.000Z"),
  );
  let propertyReads = 0;
  const malicious = new Proxy(result, {
    get(target, property, receiver) {
      propertyReads += 1;
      return Reflect.get(target, property, receiver);
    },
  });
  assert.throws(
    () => toTimerOwnerCommandResponseV1(mapped.owner, malicious),
    /canonical JSON boundary/u,
  );
  assert.equal(propertyReads, 0);
});

test("HTTP errors expose only closed Timer summaries", async () => {
  const secret =
    "Bearer timer-http-super-secret https://dependency.invalid/?token=secret";
  const timer = application();
  timer.query = async () => {
    throw new TimerApplicationErrorV1("invalid_request", secret);
  };
  const app = buildTimerTriggerApp(
    {
      logger: false,
      auth: {
        verifier: {
          async verify() {
            return credential(["timer.read"]);
          },
        },
      },
    },
    { timer },
  );
  const response = await app.inject({
    method: "GET",
    url:
      "/internal/agent-timers" +
      "?runtime_run_id=runtime_1&trace_id=trace_http_error",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().code, "invalid_request");
  assert.equal(response.json().message, "Timer request is invalid");
  assert.equal(response.body.includes(secret), false);
  assert.equal(response.body.includes("timer-http-super-secret"), false);
});

test("Fastify schema rejection never reaches the Timer owner handler", async () => {
  const timer = application();
  let handlerCalls = 0;
  timer.executeCommand = async () => {
    handlerCalls += 1;
    throw new Error("must not execute");
  };
  const app = buildTimerTriggerApp(
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
    { timer },
  );
  const response = await app.inject({
    method: "POST",
    url: "/internal/agent-timers",
    headers: { authorization: `Bearer ${token}` },
    payload: { ...command(), unexpected: true },
  });
  assert.equal(response.statusCode, 400, response.body);
  assert.equal(response.json().code, "invalid_request");
  assert.equal(handlerCalls, 0);
  await app.close();
});

test("write route is workload protected and binds the full verified scope", async () => {
  const requirements = [];
  const app = buildTimerTriggerApp(
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
    { timer: application() },
  );
  const response = await app.inject({
    method: "POST",
    url: "/internal/agent-timers",
    headers: { authorization: `Bearer ${token}` },
    payload: command(),
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().command, "create");
  assert.equal(response.json().schedule_status, "active");
  assert.deepEqual(requirements, [
    {
      audience: "timer_trigger_app",
      allowedCallers: ["action_runtime"],
      requiredCapabilities: ["timer.write"],
    },
  ]);

  const mismatch = await app.inject({
    method: "POST",
    url: "/internal/agent-timers",
    headers: { authorization: `Bearer ${token}` },
    payload: command({
      client_request_id: "request_2",
      owner_agent_id: "agent_other",
    }),
  });
  assert.equal(mismatch.statusCode, 403);
  assert.equal(mismatch.json().code, "forbidden");
  await app.close();
});

test("route semantics cannot be smuggled through a caller-controlled method", async () => {
  const app = buildTimerTriggerApp(
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
    { timer: application() },
  );
  const response = await app.inject({
    method: "POST",
    url: "/internal/agent-timers",
    headers: { authorization: `Bearer ${token}` },
    payload: command({
      method: "timer.cancel",
      command: "cancel",
      schedule_id: "victim_schedule",
      expected_schedule_version: 1,
    }),
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().code, "invalid_request");

  const invalidScope = await app.inject({
    method: "POST",
    url: "/internal/agent-timers",
    headers: { authorization: `Bearer ${token}` },
    payload: command({
      client_request_id: "request_invalid_scope",
      owner_agent_id: "agent_other",
    }),
  });
  assert.equal(invalidScope.statusCode, 403);
  assert.equal(invalidScope.json().code, "forbidden");
  await app.close();
});

test("GET query routes derive scope from the verified credential and parse limits", async () => {
  const app = buildTimerTriggerApp(
    {
      logger: false,
      auth: {
        verifier: {
          async verify() {
            return credential(["timer.read"]);
          },
        },
      },
    },
    { timer: application() },
  );
  const response = await app.inject({
    method: "GET",
    url: "/internal/agent-timers?runtime_run_id=runtime_1&trace_id=trace_1&limit=10",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().schema_version, "timer.schedule_query_response.v1");
  assert.equal(response.json().returned, 0);
  assert.deepEqual(response.json().schedules, []);
  await app.close();
});

test("claim route requires snapshot CAS fields and returns the frozen owner payload", async () => {
  const timer = application();
  const app = buildTimerTriggerApp(
    {
      logger: false,
      auth: {
        verifier: {
          async verify(_token, expected) {
            return expected.allowedCallers.includes("timer_trigger_app")
              ? workerCredential(expected.requiredCapabilities)
              : credential(expected.requiredCapabilities);
          },
        },
      },
    },
    { timer },
  );
  await timer.executeCommand(
    {
      caller: "action_runtime",
      capabilities: ["timer.write"],
      scope,
    },
    {
      schema_version: "timer.schedule_command.v1",
      method: "timer.remind_at",
      runtime_run_id: "runtime_claim",
      trigger_process_id: "process_claim",
      client_request_id: "request_claim",
      trace_id: "trace_claim",
      scope,
      timezone: "UTC",
      fire_at: "2026-07-23T12:00:00.000Z",
      message: "claim me",
    },
    new Date("2026-07-23T10:00:00.000Z"),
  );
  const [occurrence] = await timer.scanDue(
    {
      caller: "timer_trigger_app",
      capabilities: ["timer.worker.scan"],
      scope,
    },
    {
      scope,
      worker_id: "scanner_1",
      checkpoint_id: "default",
      now: "2026-07-23T12:00:00.000Z",
    },
  );
  assert.ok(occurrence);
  const history = await app.inject({
    method: "GET",
    url:
      `/internal/agent-timers/${occurrence.schedule_id}/history` +
      "?runtime_run_id=runtime_claim&trace_id=history_after_scan",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(history.statusCode, 200, history.body);
  assert.equal(history.json().schedules[0].status, "active");
  assert.equal(
    history.json().schedules[0].next_fire_at,
    "2026-07-23T12:00:00.000Z",
  );
  assert.equal(history.json().occurrences.length, 1);
  const response = await app.inject({
    method: "POST",
    url: `/internal/timer-occurrences/${occurrence.id}/claim`,
    headers: { authorization: `Bearer ${token}` },
    payload: {
      expected_occurrence_version: occurrence.occurrence_version,
      expected_schedule_version: occurrence.schedule_version,
      expected_status: occurrence.status,
      worker_id: "dispatcher_1",
      lease_seconds: 30,
    },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().schema_version, "timer.occurrence_claim.v1");
  assert.equal(response.json().occurrence_id, occurrence.id);
  assert.equal(response.json().previous_status, "pending");
  assert.equal(response.json().status, "dispatching");
  assert.match(
    response.json().dispatch_payload_hash,
    /^sha256:[a-f0-9]{64}$/u,
  );
  await app.close();
});

test("worker routes adapt HTTP commands to owner catch-up contracts with continuation fencing", async () => {
  const timer = application();
  for (const [runtime, requestId, fireAt] of [
    ["runtime_catchup_a", "request_catchup_a", "2026-07-23T12:02:00.000Z"],
    ["runtime_catchup_b", "request_catchup_b", "2026-07-23T12:02:00.000Z"],
  ]) {
    await timer.executeCommand(
      {
        caller: "action_runtime",
        capabilities: ["timer.write"],
        scope,
      },
      {
        schema_version: "timer.schedule_command.v1",
        method: "timer.remind_at",
        runtime_run_id: runtime,
        trigger_process_id: `process_${runtime}`,
        client_request_id: requestId,
        trace_id: `trace_${runtime}`,
        scope,
        timezone: "UTC",
        fire_at: fireAt,
        message: "catch-up me",
      },
      new Date("2026-07-23T10:00:00.000Z"),
    );
  }
  const app = buildTimerTriggerApp(
    {
      logger: false,
      auth: {
        verifier: {
          async verify(_token, expected) {
            return workerCredential(expected.requiredCapabilities);
          },
        },
      },
    },
    { timer },
  );
  const scanned = await app.inject({
    method: "POST",
    url: "/internal/timers/scan-due",
    headers: { authorization: `Bearer ${token}` },
    payload: {
      worker_id: "scanner_http",
      checkpoint_id: "http",
      trace_id: "scan_http_trace",
    },
  });
  assert.equal(scanned.statusCode, 200, scanned.body);
  assert.equal(scanned.json().occurrences.length, 2);
  assert.equal(
    scanned.json().occurrences[0].schema_version,
    "timer.occurrence.v1",
  );
  const occurrenceIds = scanned
    .json()
    .occurrences.map((entry) => entry.occurrence_id);
  const rejectedPolicyOverride = await app.inject({
    method: "POST",
    url: "/internal/timer-catch-up-batches",
    headers: { authorization: `Bearer ${token}` },
    payload: {
      occurrence_ids: occurrenceIds,
      trace_id: "catchup_http_rejected",
      timeout_seconds: 1,
    },
  });
  assert.equal(rejectedPolicyOverride.statusCode, 400);

  const created = await app.inject({
    method: "POST",
    url: "/internal/timer-catch-up-batches",
    headers: { authorization: `Bearer ${token}` },
    payload: {
      occurrence_ids: occurrenceIds,
      trace_id: "catchup_http_create",
    },
  });
  assert.equal(created.statusCode, 200, created.body);
  const batch = created.json();
  assert.equal(batch.schema_version, "timer.catch_up_batch.v1");
  assert.equal(batch.policy_snapshot.catch_up_timeout_seconds, 300);

  const precondition = {
    expected_status: "running",
    expected_cursor_occurrence_id: null,
    expected_last_occurrence_id: null,
    expected_last_trigger_process_id: null,
    trace_id: "catchup_http_advance",
  };
  const advanced = await app.inject({
    method: "POST",
    url:
      `/internal/timer-catch-up-batches/` +
      `${batch.catch_up_batch_id}/advance`,
    headers: { authorization: `Bearer ${token}` },
    payload: precondition,
  });
  assert.equal(advanced.statusCode, 200, advanced.body);
  assert.equal(
    advanced.json().schema_version,
    "timer.catch_up_advance_response.v1",
  );
  assert.equal(advanced.json().outcome, "ready");
  assert.equal(
    advanced.json().batch.cursor_occurrence_id,
    advanced.json().occurrence.occurrence_id,
  );

  const stale = await app.inject({
    method: "POST",
    url:
      `/internal/timer-catch-up-batches/` +
      `${batch.catch_up_batch_id}/advance`,
    headers: { authorization: `Bearer ${token}` },
    payload: precondition,
  });
  assert.equal(stale.statusCode, 409);
  assert.equal(stale.json().code, "catch_up_conflict");
  await app.close();
});

test("production readiness fails closed when the executable pipeline is absent", async () => {
  const app = buildTimerTriggerApp(
    { logger: false },
    {},
    { require_complete_pipeline: true },
  );
  const response = await app.inject({ method: "GET", url: "/ready" });
  assert.equal(response.statusCode, 503);
  assert.deepEqual(
    response.json().checks.map((check) => [check.name, check.status]),
    [["timer_repository_trigger_processor_pipeline", "down"]],
  );
  await app.close();
});

test("complete-pipeline readiness cannot be activated by self-reported green probes", async () => {
  let triggerProbeCalls = 0;
  const memory = new InMemoryTimerStateRepositoryV1();
  let repositoryProbeCalls = 0;
  const selfReportedRepository = {
    transact(operation) {
      return memory.transact(operation);
    },
    async checkReadiness() {
      repositoryProbeCalls += 1;
    },
  };
  const timer = new TimerApplicationV1(
    selfReportedRepository,
    {
      async submit() {
        throw new Error("not used");
      },
      async getProcess() {
        throw new Error("not used");
      },
      async checkReadiness() {
        triggerProbeCalls += 1;
      },
    },
  );
  const complete = buildTimerTriggerApp(
    { logger: false },
    { timer },
    { require_complete_pipeline: true },
  );
  const ready = await complete.inject({
    method: "GET",
    url: "/ready",
  });
  assert.equal(ready.statusCode, 503);
  assert.equal(repositoryProbeCalls, 0);
  assert.equal(triggerProbeCalls, 0);
  assert.deepEqual(
    ready.json().checks.map((check) => [check.name, check.status]),
    [["timer_repository_trigger_processor_pipeline", "down"]],
  );
  await complete.close();
});

test("the executable owner operations stay bound to the verified writer ABI", () => {
  const functions = new Set(TIMER_REPOSITORY_CONTRACT_V1.mutable_writers);
  for (const required of [
    "create_timer_schedule_v1",
    "cas_timer_schedule_v1",
    "advance_timer_scanner_checkpoint_v1",
    "enqueue_timer_occurrence_v1",
    "claim_timer_occurrence_v1",
    "transition_timer_occurrence_v1",
    "record_timer_dispatch_attempt_v1",
    "record_timer_audit_v1",
    "record_timer_command_request_v1",
    "transition_timer_command_request_v1",
    "record_timer_query_request_v1",
    "create_timer_catch_up_batch_v1",
    "transition_timer_catch_up_batch_v1",
    "timeout_timer_catch_up_batch_v1",
    "claim_timer_event_outbox_v1",
    "ack_timer_event_outbox_v1",
    "activate_eventing_transport_epoch_v1",
  ]) {
    assert.equal(functions.has(required), true, `${required} is missing`);
  }

  const signature = (functionName) => {
    const value = TIMER_REPOSITORY_CONTRACT_V1.function_signatures.find(
      (candidate) => candidate.function_name === functionName,
    );
    assert.ok(value, `${functionName} signature is missing`);
    return value;
  };
  const scannerSignature = signature(
    "advance_timer_scanner_checkpoint_v1",
  );
  assert.deepEqual(
    scannerSignature.arguments.map(({ argument_name }) => argument_name),
    [
      "p_scanner_checkpoint_id",
      "p_scanner_name",
      "p_expected_scanned_until",
      "p_next_scanned_until",
      "p_lock_token",
      "p_workspace_id",
      "p_bot_id",
      "p_owner_agent_id",
      "p_deployment_environment",
      "p_release_channel",
      "p_expected_schedule_versions",
      "p_schedule_transitions",
      "p_occurrences",
      "p_catch_up_batches",
      "p_idempotency_key",
      "p_request_hash",
      "p_trace_id",
    ],
  );
  assert.deepEqual(
    new Set(scannerSignature.reads_tables),
    new Set([
      "timer_scanner_checkpoints",
      "timer_schedules",
      "timer_occurrences",
      "timer_catch_up_batches",
    ]),
  );
  assert.deepEqual(
    new Set(scannerSignature.writes_tables),
    new Set([
      "timer_scanner_checkpoints",
      "timer_schedules",
      "timer_occurrences",
      "timer_catch_up_batches",
      "timer_audit_logs",
      "timer_event_outbox",
    ]),
  );
  assert.deepEqual(
    scannerSignature.effects,
    [
      {
        table_name: "timer_scanner_checkpoints",
        operation: "cas",
        concurrency_control: "expected_version",
      },
      {
        table_name: "timer_schedules",
        operation: "transition",
        concurrency_control: "expected_version",
      },
      {
        table_name: "timer_occurrences",
        operation: "enqueue",
        concurrency_control: "idempotency_key",
      },
      {
        table_name: "timer_catch_up_batches",
        operation: "append",
        concurrency_control: "database_row_lock",
        lock_table_name: "timer_scanner_checkpoints",
      },
      {
        table_name: "timer_audit_logs",
        operation: "append",
        concurrency_control: "idempotency_key",
      },
      {
        table_name: "timer_event_outbox",
        operation: "enqueue",
        concurrency_control: "idempotency_key",
      },
    ],
  );
  const manualBatchSignature = signature(
    "create_timer_catch_up_batch_v1",
  );
  assert.equal(
    manualBatchSignature.arguments[0]?.argument_name,
    "p_scanner_checkpoint_id",
  );
  assert.equal(
    manualBatchSignature.reads_tables.includes(
      "timer_scanner_checkpoints",
    ),
    true,
  );
  assert.deepEqual(
    manualBatchSignature.effects.find(
      ({ table_name }) => table_name === "timer_catch_up_batches",
    ),
    {
      table_name: "timer_catch_up_batches",
      operation: "append",
      concurrency_control: "database_row_lock",
      lock_table_name: "timer_scanner_checkpoints",
    },
  );
  const runningBatchIndex =
    TIMER_REPOSITORY_CONTRACT_V1.database_indexes?.find(
      ({ index_name }) =>
        index_name === "timer_one_running_catch_up_batch_per_scope_uq",
    );
  assert.deepEqual(runningBatchIndex, {
    index_name: "timer_one_running_catch_up_batch_per_scope_uq",
    table_name: "timer_catch_up_batches",
    definition:
      "CREATE UNIQUE INDEX timer_one_running_catch_up_batch_per_scope_uq ON timer.timer_catch_up_batches USING btree (workspace_id, bot_id, owner_agent_id, deployment_environment, release_channel) WHERE (status = 'running'::text)",
    unique: true,
    primary: false,
    valid: true,
  });
  assert.deepEqual(
    new Set(signature("transition_timer_catch_up_batch_v1").writes_tables),
    new Set([
      "timer_catch_up_batches",
      "timer_occurrences",
      "timer_schedules",
      "timer_audit_logs",
      "timer_event_outbox",
    ]),
  );
  assert.deepEqual(
    new Set(signature("timeout_timer_catch_up_batch_v1").writes_tables),
    new Set([
      "timer_catch_up_batches",
      "timer_occurrences",
      "timer_schedules",
      "timer_audit_logs",
    ]),
  );
  assert.deepEqual(
    new Set(signature("enqueue_timer_occurrence_v1").writes_tables),
    new Set([
      "timer_occurrences",
      "timer_schedules",
      "timer_audit_logs",
      "timer_event_outbox",
    ]),
  );
  assert.deepEqual(
    new Set(signature("transition_timer_occurrence_v1").writes_tables),
    new Set([
      "timer_occurrences",
      "timer_dispatch_attempts",
      "timer_schedules",
      "timer_catch_up_batches",
      "timer_audit_logs",
      "timer_event_outbox",
    ]),
  );
  assert.deepEqual(
    signature("claim_timer_occurrence_v1").arguments.map(
      ({ argument_name }) => argument_name,
    ),
    [
      "p_occurrence_id",
      "p_expected_occurrence_version",
      "p_expected_schedule_version",
      "p_expected_status",
      "p_worker_id",
      "p_lease_seconds",
      "p_now",
      "p_trace_id",
    ],
  );
  assert.deepEqual(
    new Set(signature("claim_timer_occurrence_v1").writes_tables),
    new Set(["timer_occurrences", "timer_audit_logs"]),
  );
  assert.deepEqual(
    new Set(signature("record_timer_dispatch_attempt_v1").writes_tables),
    new Set(["timer_dispatch_attempts"]),
  );
});
