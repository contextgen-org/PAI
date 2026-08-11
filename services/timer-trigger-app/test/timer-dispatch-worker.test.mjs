import assert from "node:assert/strict";
import test from "node:test";

import {
  InMemoryTimerStateRepositoryV1,
  TimerApplicationV1,
} from "../dist/timer-application.v1.js";
import { TimerDispatchWorkerV1 } from "../dist/timer-dispatch-worker.v1.js";

const scope = Object.freeze({
  workspace_id: "workspace_1",
  bot_id: "bot_1",
  owner_agent_id: "agent_1",
  deployment_environment: "dev",
  release_channel: "stable",
});

const writer = Object.freeze({
  caller: "action_runtime",
  capabilities: Object.freeze(["timer.read", "timer.write"]),
  scope,
});

function accepted(processId, request, traceId) {
  return {
    code: "trigger_accepted",
    message: "accepted",
    retryable: false,
    trace_id: traceId,
    details: {
      trigger_id: `trigger_${processId}`,
      trigger_status: "accepted",
      trigger_process_id: processId,
      process_phase: "admission",
      process_status: "running",
      wait_reason: null,
      blocked_by_process_id: null,
      priority: "strong",
      action: request.payload.is_catch_up ? "dispatch_catch_up_serial" : "dispatch",
      reason_code: request.payload.is_catch_up ? "timer_catch_up" : "timer_due",
      duplicate_replayed: false,
    },
  };
}

function runningProcess(processId) {
  return {
    id: processId,
    trigger_id: `trigger_${processId}`,
    ...scope,
    runtime_run_id: null,
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
    meta_job_id: null,
    meta_status: "not_enqueued",
    meta_summary_ref: null,
    observation_finalized: false,
  };
}

function command(fireAt, overrides = {}) {
  return {
    schema_version: "timer.schedule_command.v1",
    method: "timer.remind_at",
    runtime_run_id: "runtime_1",
    trigger_process_id: "origin_process_1",
    client_request_id: `request_${fireAt}`,
    trace_id: `trace_${fireAt}`,
    scope,
    timezone: "UTC",
    fire_at: fireAt,
    message: "tell the user that the reminder is due",
    payload: { source: "worker-test" },
    ...overrides,
  };
}

function historyRequest(scheduleId) {
  return {
    method: "timer.history",
    runtime_run_id: "runtime_history",
    trace_id: "trace_history",
    scope,
    schedule_id: scheduleId,
  };
}

test("owner worker dispatches a normal poll-delayed reminder exactly once", async () => {
  let now = new Date("2026-08-03T07:00:00.000Z");
  const submitted = [];
  const application = new TimerApplicationV1(
    new InMemoryTimerStateRepositoryV1(),
    {
      async submit(request, traceId) {
        submitted.push(request);
        return accepted("timer_process_1", request, traceId);
      },
      async getProcess(processId) {
        return runningProcess(processId);
      },
    },
    { clock: () => now },
  );
  const created = await application.executeCommand(
    writer,
    command("2026-08-03T07:00:01.000Z", { catch_up: false }),
    now,
  );
  now = new Date("2026-08-03T07:00:01.500Z");
  const worker = new TimerDispatchWorkerV1({
    timer: application,
    worker_id: "worker_1",
    now: () => now,
  });

  await worker.runOnce();
  await worker.runOnce();

  assert.equal(submitted.length, 1);
  assert.equal(submitted[0].source, "timer");
  const history = await application.query(writer, historyRequest(created.schedule.id));
  assert.equal(history.code, "timer_history_found");
  assert.equal(history.occurrences.length, 1);
  assert.equal(history.occurrences[0].status, "dispatched");
});

test("scanner jitter is direct dispatch, while a genuinely missed non-catch-up reminder is skipped", async () => {
  let now = new Date("2026-08-03T07:00:00.000Z");
  const submitted = [];
  const application = new TimerApplicationV1(
    new InMemoryTimerStateRepositoryV1(),
    {
      async submit(request, traceId) {
        submitted.push(request);
        return accepted("timer_process_2", request, traceId);
      },
      async getProcess(processId) {
        return runningProcess(processId);
      },
    },
    { clock: () => now },
  );
  const created = await application.executeCommand(
    writer,
    command("2026-08-03T07:00:01.000Z", { catch_up: false }),
    now,
  );
  now = new Date("2026-08-03T07:00:31.001Z");
  const worker = new TimerDispatchWorkerV1({ timer: application, now: () => now });

  await worker.runOnce();

  assert.equal(submitted.length, 0);
  const history = await application.query(writer, historyRequest(created.schedule.id));
  assert.equal(history.code, "timer_history_found");
  assert.equal(history.occurrences[0].status, "skipped");
});
