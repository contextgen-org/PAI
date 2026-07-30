import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalJsonV1,
  InMemoryTimerStateRepositoryV1,
  TimerApplicationErrorV1,
  TimerApplicationV1,
  TimerDownstreamErrorV1,
  resolveTimerLocalTimeV1,
  timerOccurrenceKeyV1,
} from "../dist/timer-application.v1.js";

const scope = Object.freeze({
  workspace_id: "workspace_1",
  bot_id: "bot_1",
  owner_agent_id: "agent_1",
  deployment_environment: "dev",
  release_channel: "stable",
});

const otherScope = Object.freeze({
  ...scope,
  owner_agent_id: "agent_2",
});

const writer = Object.freeze({
  caller: "action_runtime",
  capabilities: Object.freeze(["timer.read", "timer.write"]),
  scope,
});

const worker = Object.freeze({
  caller: "timer_trigger_app",
  capabilities: Object.freeze([
    "timer.worker.catch_up",
    "timer.worker.dispatch",
    "timer.worker.scan",
  ]),
  scope,
});

function accepted(processId, request, traceId, duplicate = false) {
  const catchUp = request.payload.is_catch_up;
  return {
    code: duplicate ? "duplicate_replayed" : "trigger_accepted",
    message: duplicate ? "duplicate" : "accepted",
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
      action: catchUp ? "dispatch_catch_up_serial" : "dispatch",
      reason_code: catchUp ? "timer_catch_up" : "timer_due",
      duplicate_replayed: duplicate,
    },
  };
}

function closedProcess(processId, overrides = {}) {
  return {
    id: processId,
    trigger_id: `trigger_${processId}`,
    ...scope,
    runtime_run_id: null,
    phase: "closed",
    status: "completed",
    terminal_reason: "completed",
    terminal_outcome: "executed",
    terminal_outcome_finalized_at: "2026-07-23T00:00:01.000Z",
    successor_process_id: null,
    snapshot_transfer_ref: null,
    boundary_system_event_ref: null,
    canonical_reason_code: "completed",
    reason_code: "completed",
    cooldown_until: null,
    snapshot_retention_until: null,
    process_snapshot_identity: null,
    context_snapshot_identity: null,
    snapshot_watermark: 1,
    meta_job_id: "meta_1",
    meta_status: "completed",
    meta_summary_ref: "summary_1",
    observation_finalized: true,
    ...overrides,
  };
}

function catchUpPrecondition(batch) {
  return {
    expected_status: "running",
    expected_cursor_occurrence_id: batch.cursor_occurrence_id,
    expected_last_occurrence_id: batch.last_occurrence_id,
    expected_last_trigger_process_id: batch.last_trigger_process_id,
  };
}

function harness() {
  const submitted = [];
  const processStates = new Map();
  let duplicate = false;
  let nextProcess = 1;
  const triggerProcessor = {
    async submit(request, traceId) {
      submitted.push(request);
      const processId = `process_${nextProcess}`;
      nextProcess += 1;
      return accepted(processId, request, traceId, duplicate);
    },
    async getProcess(processId) {
      return (
        processStates.get(processId) ??
        closedProcess(processId, {
          phase: "execution",
          status: "running",
          terminal_reason: null,
          terminal_outcome: null,
          terminal_outcome_finalized_at: null,
          canonical_reason_code: null,
          reason_code: null,
          meta_job_id: null,
          meta_status: "not_enqueued",
          meta_summary_ref: null,
          observation_finalized: false,
        })
      );
    },
  };
  const repository = new InMemoryTimerStateRepositoryV1();
  const application = new TimerApplicationV1(repository, triggerProcessor, {
    base_retry_delay_ms: 1_000,
    max_dispatch_attempts: 3,
  });
  return {
    application,
    processStates,
    repository,
    setDuplicate(value) {
      duplicate = value;
    },
    submitted,
  };
}

function createCommand(overrides = {}) {
  const result = {
    schema_version: "timer.schedule_command.v1",
    method: "timer.remind_at",
    runtime_run_id: "runtime_1",
    trigger_process_id: "origin_process_1",
    client_request_id: "request_1",
    trace_id: "trace_1",
    scope,
    timezone: "UTC",
    fire_at: "2026-07-23T12:00:00.000Z",
    message: "wake up",
    payload: { source: "test" },
    ...overrides,
  };
  if (
    ["timer.pause", "timer.resume", "timer.cancel"].includes(result.method)
  ) {
    delete result.kind;
    delete result.fire_at;
    delete result.delay_seconds;
    delete result.rrule;
    delete result.timezone;
    delete result.message;
    delete result.payload;
    delete result.snooze_until;
  }
  return result;
}

async function createDueOccurrence(
  application,
  commandOverrides = {},
  scanAt = "2026-07-23T12:00:00.000Z",
) {
  const created = await application.executeCommand(
    writer,
    createCommand(commandOverrides),
    new Date("2026-07-23T10:00:00.000Z"),
  );
  const occurrences = await application.scanDue(worker, {
    scope,
    worker_id: "scanner_1",
    checkpoint_id: "default",
    now: scanAt,
  });
  assert.equal(occurrences.length, 1);
  return { created, occurrence: occurrences[0] };
}

test("dispatch rejects malformed or proxied TP responses without finalizing owner state", async () => {
  for (const variant of [
    "null_trigger_id",
    "trace_drift",
    "normal_as_catchup",
    "proxy",
  ]) {
    const repository = new InMemoryTimerStateRepositoryV1();
    const propertyReads = [];
    const application = new TimerApplicationV1(repository, {
      async submit(request, traceId) {
        const response = accepted(`process_${variant}`, request, traceId);
        if (variant === "null_trigger_id") {
          response.details.trigger_id = null;
          return response;
        }
        if (variant === "trace_drift") {
          response.trace_id = "different_trace";
          return response;
        }
        if (variant === "normal_as_catchup") {
          response.details.action = "dispatch_catch_up_serial";
          response.details.reason_code = "timer_catch_up";
          return response;
        }
        return new Proxy(response, {
          get(target, property, receiver) {
            propertyReads.push(property);
            return Reflect.get(target, property, receiver);
          },
        });
      },
      async getProcess() {
        throw new Error("not used");
      },
    });
    const { occurrence } = await createDueOccurrence(application);
    const claim = await application.claimOccurrence(worker, {
      scope,
      occurrence_id: occurrence.id,
      expected_occurrence_version: occurrence.occurrence_version,
      expected_schedule_version: occurrence.schedule_version,
      expected_status: occurrence.status,
      worker_id: `dispatcher_${variant}`,
      now: "2026-07-23T12:00:00.000Z",
    });
    await assert.rejects(
      application.dispatchOccurrence(worker, {
        scope,
        occurrence_id: occurrence.id,
        expected_occurrence_version: claim.occurrence_version,
        dispatch_generation: claim.dispatch_generation,
        claim_token: claim.claim_token,
        trace_id: `trace_${variant}`,
        now: "2026-07-23T12:00:01.000Z",
      }),
      (error) =>
        error instanceof TimerDownstreamErrorV1 &&
        error.classification === "non_retryable_contract",
    );
    const history = await application.query(writer, {
      method: "timer.history",
      runtime_run_id: `runtime_${variant}`,
      trace_id: `history_${variant}`,
      scope,
      schedule_id: occurrence.schedule_id,
    });
    assert.equal(history.occurrences[0].status, "dispatching");
    assert.equal(
      history.occurrences[0].occurrence_version,
      claim.occurrence_version,
    );
    assert.equal(history.occurrences[0].claim_token, claim.claim_token);
    assert.equal(history.occurrences[0].trigger_id, null);
    assert.equal(history.occurrences[0].trigger_process_id, null);
    if (variant === "proxy") {
      // Promise resolution itself probes "then"; the Timer boundary must not
      // read any response field before rejecting the Proxy.
      assert.deepEqual(propertyReads, ["then"]);
    }
  }
});

test("dispatch proves the accepted TP process identity, trigger, and full scope before finalizing", async () => {
  for (const variant of ["process", "trigger", "scope"]) {
    const repository = new InMemoryTimerStateRepositoryV1();
    const application = new TimerApplicationV1(repository, {
      async submit(request, traceId) {
        return accepted(`process_${variant}_drift`, request, traceId);
      },
      async getProcess(processId, requestedScope, traceId) {
        assert.equal(
          canonicalJsonV1(requestedScope),
          canonicalJsonV1(scope),
        );
        assert.equal(traceId, `trace_${variant}_drift`);
        if (variant === "process") {
          return closedProcess("different_process");
        }
        if (variant === "trigger") {
          return closedProcess(processId, {
            trigger_id: "different_trigger",
          });
        }
        return closedProcess(processId, {
          owner_agent_id: otherScope.owner_agent_id,
        });
      },
    });
    const { occurrence } = await createDueOccurrence(application, {
      runtime_run_id: `runtime_${variant}_drift`,
      client_request_id: `request_${variant}_drift`,
    });
    const claim = await application.claimOccurrence(worker, {
      scope,
      occurrence_id: occurrence.id,
      expected_occurrence_version: occurrence.occurrence_version,
      expected_schedule_version: occurrence.schedule_version,
      expected_status: occurrence.status,
      worker_id: `dispatcher_${variant}_drift`,
      now: "2026-07-23T12:00:00.000Z",
    });
    await assert.rejects(
      application.dispatchOccurrence(worker, {
        scope,
        occurrence_id: occurrence.id,
        expected_occurrence_version: claim.occurrence_version,
        dispatch_generation: claim.dispatch_generation,
        claim_token: claim.claim_token,
        trace_id: `trace_${variant}_drift`,
        now: "2026-07-23T12:00:01.000Z",
      }),
      (error) =>
        error instanceof TimerDownstreamErrorV1 &&
        error.classification === "non_retryable_contract",
    );
    const history = await application.query(writer, {
      method: "timer.history",
      runtime_run_id: `history_runtime_${variant}_drift`,
      trace_id: `history_trace_${variant}_drift`,
      scope,
      schedule_id: occurrence.schedule_id,
    });
    assert.equal(history.occurrences[0].status, "dispatching");
    assert.equal(history.occurrences[0].claim_token, claim.claim_token);
    assert.equal(history.occurrences[0].trigger_id, null);
    assert.equal(history.occurrences[0].trigger_process_id, null);
  }
});

test("a TP process-read outage leaves the claim recoverable and restart replays the exact submission", async () => {
  const repository = new InMemoryTimerStateRepositoryV1();
  const submitted = [];
  let submitCount = 0;
  const triggerProcessor = {
    async submit(request, traceId) {
      submitted.push(structuredClone(request));
      submitCount += 1;
      return accepted(
        "process_projection_retry",
        request,
        traceId,
        submitCount > 1,
      );
    },
    async getProcess(processId) {
      if (submitCount === 1) {
        throw new Error("process projection temporarily unavailable");
      }
      return closedProcess(processId);
    },
  };
  const options = {
    base_retry_delay_ms: 1,
    max_retry_delay_ms: 1,
    max_dispatch_attempts: 1,
  };
  const firstApplication = new TimerApplicationV1(
    repository,
    triggerProcessor,
    options,
  );
  const { occurrence } = await createDueOccurrence(firstApplication, {
    runtime_run_id: "runtime_projection_retry",
    client_request_id: "request_projection_retry",
  });
  const firstClaim = await firstApplication.claimOccurrence(worker, {
    scope,
    occurrence_id: occurrence.id,
    expected_occurrence_version: occurrence.occurrence_version,
    expected_schedule_version: occurrence.schedule_version,
    expected_status: occurrence.status,
    worker_id: "projection_retry_worker_1",
    lease_seconds: 1,
    now: "2026-07-23T12:00:00.000Z",
  });
  await assert.rejects(
    firstApplication.dispatchOccurrence(worker, {
      scope,
      occurrence_id: occurrence.id,
      expected_occurrence_version: firstClaim.occurrence_version,
      dispatch_generation: firstClaim.dispatch_generation,
      claim_token: firstClaim.claim_token,
      trace_id: "projection_retry_trace_1",
      now: "2026-07-23T12:00:00.500Z",
    }),
    /process projection temporarily unavailable/u,
  );

  const restartedApplication = new TimerApplicationV1(
    repository,
    triggerProcessor,
    options,
  );
  const secondClaim = await restartedApplication.claimOccurrence(worker, {
    scope,
    occurrence_id: occurrence.id,
    expected_occurrence_version: firstClaim.occurrence_version,
    expected_schedule_version: occurrence.schedule_version,
    expected_status: "dispatching",
    worker_id: "projection_retry_worker_2",
    lease_seconds: 1,
    now: "2026-07-23T12:00:02.000Z",
  });
  const dispatched = await restartedApplication.dispatchOccurrence(worker, {
    scope,
    occurrence_id: occurrence.id,
    expected_occurrence_version: secondClaim.occurrence_version,
    dispatch_generation: secondClaim.dispatch_generation,
    claim_token: secondClaim.claim_token,
    trace_id: "projection_retry_trace_2",
    now: "2026-07-23T12:00:02.500Z",
  });
  assert.equal(dispatched.status, "dispatched");
  assert.equal(dispatched.dispatch_error_class, "idempotency_replayed");
  assert.equal(submitted.length, 2);
  assert.deepEqual(submitted[1], submitted[0]);
});

test("dispatch finalization uses a detached TP response snapshot", async () => {
  const durable = new InMemoryTimerStateRepositoryV1();
  let gateFinalization = false;
  let enteredFinalization;
  const finalizationEntered = new Promise((resolve) => {
    enteredFinalization = resolve;
  });
  let releaseFinalization;
  const finalizationReleased = new Promise((resolve) => {
    releaseFinalization = resolve;
  });
  const repository = {
    async transact(operation) {
      if (!gateFinalization) return durable.transact(operation);
      gateFinalization = false;
      enteredFinalization();
      await finalizationReleased;
      return durable.transact(operation);
    },
  };
  let callerOwnedResponse;
  const application = new TimerApplicationV1(repository, {
    async submit(request, traceId) {
      callerOwnedResponse = accepted(
        "process_detached_response",
        request,
        traceId,
      );
      gateFinalization = true;
      return callerOwnedResponse;
    },
    async getProcess(processId) {
      return closedProcess(processId);
    },
  });
  const { occurrence } = await createDueOccurrence(application);
  const claim = await application.claimOccurrence(worker, {
    scope,
    occurrence_id: occurrence.id,
    expected_occurrence_version: occurrence.occurrence_version,
    expected_schedule_version: occurrence.schedule_version,
    expected_status: occurrence.status,
    worker_id: "dispatcher_detached_response",
    now: "2026-07-23T12:00:00.000Z",
  });
  const dispatch = application.dispatchOccurrence(worker, {
    scope,
    occurrence_id: occurrence.id,
    expected_occurrence_version: claim.occurrence_version,
    dispatch_generation: claim.dispatch_generation,
    claim_token: claim.claim_token,
    trace_id: "trace_detached_response",
    now: "2026-07-23T12:00:01.000Z",
  });
  await finalizationEntered;
  callerOwnedResponse.code = "trigger_rejected";
  callerOwnedResponse.details.trigger_id = null;
  callerOwnedResponse.details.trigger_process_id = null;
  releaseFinalization();
  const result = await dispatch;
  assert.equal(result.status, "dispatched");
  assert.equal(result.trigger_id, "trigger_process_detached_response");
  assert.equal(result.trigger_process_id, "process_detached_response");
});

test("catch-up dispatch accepts the documented Strong FIFO TP projection", async () => {
  const repository = new InMemoryTimerStateRepositoryV1();
  const application = new TimerApplicationV1(repository, {
    async submit(request, traceId) {
      const response = accepted(
        "process_queued_catchup",
        request,
        traceId,
      );
      response.details.process_status = "waiting";
      response.details.wait_reason = "deferred_strong_queue";
      response.details.blocked_by_process_id = "foreground_process_1";
      response.details.action = "enqueue_strong_fifo";
      response.details.reason_code = "catch_up_foreground_busy";
      return response;
    },
    async getProcess(processId) {
      return closedProcess(processId);
    },
  });
  const { occurrence } = await createDueOccurrence(application);
  const batch = await application.createCatchUpBatch(worker, {
    scope,
    occurrence_ids: [occurrence.id],
    trace_id: "queued_catchup_batch",
    now: "2026-07-23T12:00:01.000Z",
  });
  const ready = await application.advanceCatchUpBatch(worker, {
    scope,
    batch_id: batch.id,
    ...catchUpPrecondition(batch),
    trace_id: "queued_catchup_advance",
    now: "2026-07-23T12:00:02.000Z",
  });
  const claim = await application.claimOccurrence(worker, {
    scope,
    occurrence_id: occurrence.id,
    expected_occurrence_version: ready.occurrence.occurrence_version,
    expected_schedule_version: ready.occurrence.schedule_version,
    expected_status: ready.occurrence.status,
    worker_id: "queued_catchup_dispatcher",
    now: "2026-07-23T12:00:03.000Z",
  });
  const result = await application.dispatchOccurrence(worker, {
    scope,
    occurrence_id: occurrence.id,
    expected_occurrence_version: claim.occurrence_version,
    dispatch_generation: claim.dispatch_generation,
    claim_token: claim.claim_token,
    trace_id: "queued_catchup_dispatch",
    now: "2026-07-23T12:00:04.000Z",
  });
  assert.equal(result.status, "dispatched");
  assert.equal(result.trigger_process_id, "process_queued_catchup");
});

test("command idempotency replays the committed response and rejects body drift", async () => {
  const { application } = harness();
  const command = createCommand();
  const first = await application.executeCommand(
    writer,
    command,
    new Date("2026-07-23T10:00:00.000Z"),
  );
  const replay = await application.executeCommand(
    writer,
    { ...command, trace_id: "trace_retry" },
    new Date("2026-07-23T11:00:00.000Z"),
  );
  assert.equal(replay.duplicate_replayed, true);
  assert.equal(replay.schedule.id, first.schedule.id);
  assert.equal(replay.trace_id, "trace_retry");

  await assert.rejects(
    application.executeCommand(
      writer,
      { ...command, message: "different" },
      new Date("2026-07-23T11:00:00.000Z"),
    ),
    (error) =>
      error instanceof TimerApplicationErrorV1 &&
      error.code === "idempotency_conflict",
  );
});

test("application entrypoints reject proxied requests before property access", async () => {
  const { application } = harness();
  let propertyReads = 0;
  const proxied = new Proxy(createCommand(), {
    get(target, property, receiver) {
      propertyReads += 1;
      return Reflect.get(target, property, receiver);
    },
  });
  await assert.rejects(
    application.executeCommand(
      writer,
      proxied,
      new Date("2026-07-23T10:00:00.000Z"),
    ),
    (error) =>
      error instanceof TimerApplicationErrorV1 &&
      error.code === "invalid_request",
  );
  assert.equal(propertyReads, 0);
});

test("queued owner transactions use detached request and clock snapshots", async () => {
  const { application, repository } = harness();
  let releaseBlocker;
  let markEntered;
  const entered = new Promise((resolve) => {
    markEntered = resolve;
  });
  const blocked = new Promise((resolve) => {
    releaseBlocker = resolve;
  });
  const blocker = repository.transact(async () => {
    markEntered();
    await blocked;
  });
  await entered;

  const command = createCommand({
    message: "original message",
    payload: { source: "original" },
  });
  const now = new Date("2026-07-23T10:00:00.000Z");
  const pending = application.executeCommand(writer, command, now);
  command.message = "mutated while queued";
  command.payload.source = "mutated";
  now.setUTCFullYear(2036);
  releaseBlocker();
  await blocker;

  const result = await pending;
  assert.equal(result.schedule.message, "original message");
  assert.equal(result.schedule.payload.source, "original");
  assert.equal(result.schedule.created_at, "2026-07-23T10:00:00.000Z");
});

test("in-memory conformance transactions roll back all owner state on failure", async () => {
  const repository = new InMemoryTimerStateRepositoryV1();
  await assert.rejects(
    repository.transact((state) => {
      state.scannerCheckpoints.set("partial", "should-not-commit");
      throw new Error("rollback");
    }),
    /rollback/u,
  );
  const checkpoint = await repository.transact((state) =>
    state.scannerCheckpoints.get("partial"),
  );
  assert.equal(checkpoint, undefined);
});

test("full five-tuple ownership and capabilities are enforced", async () => {
  const { application } = harness();
  await assert.rejects(
    application.executeCommand(
      { ...writer, scope: otherScope },
      createCommand(),
      new Date("2026-07-23T10:00:00.000Z"),
    ),
    (error) =>
      error instanceof TimerApplicationErrorV1 && error.code === "forbidden",
  );
  await assert.rejects(
    application.executeCommand(
      { ...writer, capabilities: ["timer.read"] },
      createCommand(),
      new Date("2026-07-23T10:00:00.000Z"),
    ),
    (error) =>
      error instanceof TimerApplicationErrorV1 && error.code === "forbidden",
  );
});

test("command idempotency and generated schedule identity are isolated by the full owner scope", async () => {
  const { application } = harness();
  const first = await application.executeCommand(
    writer,
    createCommand(),
    new Date("2026-07-23T10:00:00.000Z"),
  );
  const otherWriter = Object.freeze({ ...writer, scope: otherScope });
  const second = await application.executeCommand(
    otherWriter,
    createCommand({ scope: otherScope }),
    new Date("2026-07-23T10:00:00.000Z"),
  );
  assert.notEqual(second.schedule.id, first.schedule.id);
  assert.equal(second.schedule.scope.owner_agent_id, otherScope.owner_agent_id);
  assert.equal(first.duplicate_replayed, false);
  assert.equal(second.duplicate_replayed, false);
});

test("schedule CAS rejects stale concurrent updates", async () => {
  const { application } = harness();
  const created = await application.executeCommand(
    writer,
    createCommand(),
    new Date("2026-07-23T10:00:00.000Z"),
  );
  const update = {
    ...createCommand({
      method: "timer.update",
      client_request_id: "update_1",
      schedule_id: created.schedule.id,
      expected_schedule_version: 1,
      message: "updated",
    }),
  };
  const updated = await application.executeCommand(
    writer,
    update,
    new Date("2026-07-23T10:01:00.000Z"),
  );
  assert.equal(updated.schedule.schedule_version, 2);
  await assert.rejects(
    application.executeCommand(
      writer,
      { ...update, client_request_id: "update_2" },
      new Date("2026-07-23T10:02:00.000Z"),
    ),
    (error) =>
      error instanceof TimerApplicationErrorV1 &&
      error.code === "version_conflict",
  );
});

test("owner counters fail closed before JavaScript integer exhaustion", async () => {
  const { application, repository } = harness();
  const created = await application.executeCommand(
    writer,
    createCommand(),
    new Date("2026-07-23T10:00:00.000Z"),
  );
  await repository.transact((state) => {
    const schedule = state.schedules.get(created.schedule.id);
    assert.ok(schedule);
    schedule.schedule_version = Number.MAX_SAFE_INTEGER;
  });

  await assert.rejects(
    application.executeCommand(
      writer,
      createCommand({
        method: "timer.pause",
        client_request_id: "pause_exhausted_version",
        schedule_id: created.schedule.id,
        expected_schedule_version: Number.MAX_SAFE_INTEGER,
      }),
      new Date("2026-07-23T10:01:00.000Z"),
    ),
    (error) =>
      error instanceof TimerApplicationErrorV1 &&
      error.code === "invalid_state" &&
      /exhausted/u.test(error.message),
  );

  const current = await application.query(writer, {
    method: "timer.get",
    runtime_run_id: "runtime_1",
    trace_id: "get_exhausted_version",
    scope,
    schedule_id: created.schedule.id,
  });
  assert.equal(current.schedule.status, "active");
  assert.equal(current.schedule.schedule_version, Number.MAX_SAFE_INTEGER);
});

test("message-only update CAS-replaces the pending snapshot instead of losing it", async () => {
  const { application } = harness();
  const { created, occurrence } = await createDueOccurrence(application);
  const update = createCommand({
    method: "timer.update",
    client_request_id: "message_update",
    schedule_id: created.schedule.id,
    expected_schedule_version: 1,
    message: "new frozen message",
  });
  delete update.fire_at;
  delete update.timezone;
  delete update.payload;
  await application.executeCommand(
    writer,
    update,
    new Date("2026-07-23T12:00:01.000Z"),
  );
  const history = await application.query(writer, {
    method: "timer.history",
    runtime_run_id: "runtime_1",
    trace_id: "history_trace",
    scope,
    schedule_id: created.schedule.id,
  });
  assert.equal(history.occurrences.length, 1);
  assert.equal(history.occurrences[0].id, occurrence.id);
  assert.equal(history.occurrences[0].status, "pending");
  assert.equal(history.occurrences[0].schedule_version, 2);
  assert.equal(history.occurrences[0].message, "new frozen message");
});

test("history uses a stable bounded cursor instead of returning an unbounded occurrence set", async () => {
  const { application, repository } = harness();
  const { created, occurrence } = await createDueOccurrence(application);
  await repository.transact((state) => {
    const template = state.occurrences.get(occurrence.id);
    for (let index = 1; index < 101; index += 1) {
      const id = `${occurrence.id}_history_${String(index).padStart(3, "0")}`;
      const scheduledFireAt = new Date(
        Date.parse(occurrence.scheduled_fire_at) + index * 1_000,
      ).toISOString();
      state.occurrences.set(id, {
        ...structuredClone(template),
        id,
        scheduled_fire_at: scheduledFireAt,
        effective_fire_at: scheduledFireAt,
        occurrence_key: `${template.occurrence_key}:history:${index}`,
      });
    }
  });

  const ids = [];
  let cursor;
  do {
    const page = await application.query(writer, {
      method: "timer.history",
      runtime_run_id: "runtime_1",
      trace_id: "history_page",
      scope,
      schedule_id: created.schedule.id,
      limit: 25,
      ...(cursor === undefined ? {} : { cursor }),
    });
    assert.ok(page.occurrences.length <= 25);
    ids.push(...page.occurrences.map((entry) => entry.id));
    cursor = page.next_cursor ?? undefined;
  } while (cursor !== undefined);
  assert.equal(ids.length, 101);
  assert.equal(new Set(ids).size, 101);

  await assert.rejects(
    application.query(writer, {
      method: "timer.history",
      runtime_run_id: "runtime_1",
      trace_id: "history_bad_cursor",
      scope,
      schedule_id: created.schedule.id,
      limit: 25,
      cursor: "not-json",
    }),
    (error) =>
      error instanceof TimerApplicationErrorV1 &&
      error.code === "invalid_request",
  );
});

test("pause and resume preserve a pending occurrence while rebinding its versioned key", async () => {
  const { application } = harness();
  const { created, occurrence } = await createDueOccurrence(application);
  const paused = await application.executeCommand(
    writer,
    createCommand({
      method: "timer.pause",
      client_request_id: "pause_1",
      schedule_id: created.schedule.id,
      expected_schedule_version: 1,
    }),
    new Date("2026-07-23T12:00:01.000Z"),
  );
  assert.equal(paused.schedule.status, "paused");
  await assert.rejects(
    application.claimOccurrence(worker, {
      scope,
      occurrence_id: occurrence.id,
      expected_occurrence_version: occurrence.occurrence_version,
      expected_schedule_version: occurrence.schedule_version,
      expected_status: occurrence.status,
      worker_id: "dispatcher_1",
      now: "2026-07-23T12:00:02.000Z",
    }),
    (error) =>
      error instanceof TimerApplicationErrorV1 &&
      error.code === "claim_conflict",
  );
  const resumed = await application.executeCommand(
    writer,
    createCommand({
      method: "timer.resume",
      client_request_id: "resume_1",
      schedule_id: created.schedule.id,
      expected_schedule_version: 2,
    }),
    new Date("2026-07-23T12:00:03.000Z"),
  );
  assert.equal(resumed.schedule.status, "active");
  const history = await application.query(writer, {
    method: "timer.history",
    runtime_run_id: "runtime_1",
    trace_id: "history_trace",
    scope,
    schedule_id: created.schedule.id,
  });
  const rebound = history.occurrences[0];
  assert.equal(rebound.id, occurrence.id);
  assert.equal(rebound.schedule_version, 3);
  assert.notEqual(rebound.occurrence_key, occurrence.occurrence_key);
  assert.equal(
    rebound.occurrence_key,
    timerOccurrenceKeyV1({
      schedule_id: rebound.schedule_id,
      schedule_version: rebound.schedule_version,
      local_date: rebound.local_date,
      local_time: rebound.local_time,
      timezone: rebound.timezone,
    }),
  );
});

test("snooze is occurrence-CAS fenced and preserves cadence identity", async () => {
  const { application } = harness();
  const { created, occurrence } = await createDueOccurrence(application);
  const snoozed = await application.executeCommand(
    writer,
    {
      schema_version: "timer.schedule_command.v1",
      method: "timer.snooze",
      runtime_run_id: "runtime_1",
      trigger_process_id: "origin_process_1",
      client_request_id: "snooze_1",
      trace_id: "snooze_trace",
      scope,
      schedule_id: created.schedule.id,
      occurrence_id: occurrence.id,
      expected_schedule_version: 1,
      expected_occurrence_version: 1,
      snooze_until: "2026-07-23T13:00:00.000Z",
    },
    new Date("2026-07-23T12:00:01.000Z"),
  );
  assert.equal(snoozed.occurrence.id, occurrence.id);
  assert.equal(snoozed.occurrence.occurrence_key, occurrence.occurrence_key);
  assert.equal(
    snoozed.occurrence.scheduled_fire_at,
    occurrence.scheduled_fire_at,
  );
  assert.equal(
    snoozed.occurrence.effective_fire_at,
    "2026-07-23T13:00:00.000Z",
  );
  await assert.rejects(
    application.executeCommand(
      writer,
      {
        schema_version: "timer.schedule_command.v1",
        method: "timer.snooze",
        runtime_run_id: "runtime_1",
        trigger_process_id: "origin_process_1",
        client_request_id: "snooze_stale",
        trace_id: "snooze_trace_2",
        scope,
        schedule_id: created.schedule.id,
        occurrence_id: occurrence.id,
        expected_schedule_version: 1,
        expected_occurrence_version: 1,
        snooze_until: "2026-07-23T14:00:00.000Z",
      },
      new Date("2026-07-23T12:00:02.000Z"),
    ),
    (error) =>
      error instanceof TimerApplicationErrorV1 &&
      error.code === "version_conflict",
  );
});

test("claim rejects a stale occurrence snapshot after snooze", async () => {
  const { application } = harness();
  const { created, occurrence } = await createDueOccurrence(application);
  await application.executeCommand(
    writer,
    {
      schema_version: "timer.schedule_command.v1",
      method: "timer.snooze",
      runtime_run_id: "runtime_1",
      trigger_process_id: "origin_process_1",
      client_request_id: "snooze_before_claim",
      trace_id: "snooze_before_claim_trace",
      scope,
      schedule_id: created.schedule.id,
      occurrence_id: occurrence.id,
      expected_schedule_version: occurrence.schedule_version,
      expected_occurrence_version: occurrence.occurrence_version,
      snooze_until: "2026-07-23T13:00:00.000Z",
    },
    new Date("2026-07-23T12:00:01.000Z"),
  );
  await assert.rejects(
    application.claimOccurrence(worker, {
      scope,
      occurrence_id: occurrence.id,
      expected_occurrence_version: occurrence.occurrence_version,
      expected_schedule_version: occurrence.schedule_version,
      expected_status: occurrence.status,
      worker_id: "stale_scanner_worker",
      now: "2026-07-23T13:00:00.000Z",
    }),
    (error) =>
      error instanceof TimerApplicationErrorV1 &&
      error.code === "claim_conflict",
  );
});

test("expired claims are generation fenced and duplicate_replayed is successful", async () => {
  const harnessValue = harness();
  const { application } = harnessValue;
  const { occurrence } = await createDueOccurrence(application);
  const first = await application.claimOccurrence(worker, {
    scope,
    occurrence_id: occurrence.id,
    expected_occurrence_version: occurrence.occurrence_version,
    expected_schedule_version: occurrence.schedule_version,
    expected_status: occurrence.status,
    worker_id: "dispatcher_1",
    lease_seconds: 1,
    now: "2026-07-23T12:00:00.000Z",
  });
  const second = await application.claimOccurrence(worker, {
    scope,
    occurrence_id: occurrence.id,
    expected_occurrence_version: first.occurrence_version,
    expected_schedule_version: first.occurrence.schedule_version,
    expected_status: first.occurrence.status,
    worker_id: "dispatcher_2",
    lease_seconds: 30,
    now: "2026-07-23T12:00:02.000Z",
  });
  assert.equal(second.dispatch_generation, first.dispatch_generation + 1);
  await assert.rejects(
    application.dispatchOccurrence(worker, {
      scope,
      occurrence_id: occurrence.id,
      expected_occurrence_version: first.occurrence_version,
      dispatch_generation: first.dispatch_generation,
      claim_token: first.claim_token,
      trace_id: "stale_trace",
      now: "2026-07-23T12:00:02.000Z",
    }),
    (error) =>
      error instanceof TimerApplicationErrorV1 &&
      error.code === "claim_conflict",
  );

  harnessValue.setDuplicate(true);
  const dispatched = await application.dispatchOccurrence(worker, {
    scope,
    occurrence_id: occurrence.id,
    expected_occurrence_version: second.occurrence_version,
    dispatch_generation: second.dispatch_generation,
    claim_token: second.claim_token,
    trace_id: "dispatch_trace",
    now: "2026-07-23T12:00:03.000Z",
  });
  assert.equal(dispatched.status, "dispatched");
  assert.equal(dispatched.dispatch_error_class, "idempotency_replayed");
  assert.equal(
    harnessValue.submitted[0].dedupe_key,
    `timer:${occurrence.occurrence_key}`,
  );
});

test("dispatch cannot finalize with a lease that expired during TP submit", async () => {
  let clock = new Date("2026-07-23T12:00:00.500Z");
  const repository = new InMemoryTimerStateRepositoryV1();
  const application = new TimerApplicationV1(
    repository,
    {
      async submit(request, traceId) {
        clock = new Date("2026-07-23T12:00:02.000Z");
        return accepted("process_after_expiry", request, traceId);
      },
      async getProcess(processId) {
        return closedProcess(processId);
      },
    },
    { clock: () => clock },
  );
  const { occurrence } = await createDueOccurrence(application);
  const claim = await application.claimOccurrence(worker, {
    scope,
    occurrence_id: occurrence.id,
    expected_occurrence_version: occurrence.occurrence_version,
    expected_schedule_version: occurrence.schedule_version,
    expected_status: occurrence.status,
    worker_id: "dispatcher_1",
    lease_seconds: 1,
    now: "2026-07-23T12:00:00.000Z",
  });
  await assert.rejects(
    application.dispatchOccurrence(worker, {
      scope,
      occurrence_id: occurrence.id,
      expected_occurrence_version: claim.occurrence_version,
      dispatch_generation: claim.dispatch_generation,
      claim_token: claim.claim_token,
      trace_id: "lease_expiry_trace",
    }),
    (error) =>
      error instanceof TimerApplicationErrorV1 &&
      error.code === "claim_conflict",
  );
});

test("dispatch cannot finalize with a lease that expires during TP process verification", async () => {
  let clock = new Date("2026-07-23T12:00:00.500Z");
  const repository = new InMemoryTimerStateRepositoryV1();
  const application = new TimerApplicationV1(
    repository,
    {
      async submit(request, traceId) {
        return accepted("process_expired_during_read", request, traceId);
      },
      async getProcess(processId) {
        clock = new Date("2026-07-23T12:00:02.000Z");
        return closedProcess(processId);
      },
    },
    { clock: () => clock },
  );
  const { occurrence } = await createDueOccurrence(application, {
    runtime_run_id: "runtime_expired_during_read",
    client_request_id: "request_expired_during_read",
  });
  const claim = await application.claimOccurrence(worker, {
    scope,
    occurrence_id: occurrence.id,
    expected_occurrence_version: occurrence.occurrence_version,
    expected_schedule_version: occurrence.schedule_version,
    expected_status: occurrence.status,
    worker_id: "dispatcher_expired_during_read",
    lease_seconds: 1,
    now: "2026-07-23T12:00:00.000Z",
  });
  await assert.rejects(
    application.dispatchOccurrence(worker, {
      scope,
      occurrence_id: occurrence.id,
      expected_occurrence_version: claim.occurrence_version,
      dispatch_generation: claim.dispatch_generation,
      claim_token: claim.claim_token,
      trace_id: "lease_expired_during_read_trace",
    }),
    (error) =>
      error instanceof TimerApplicationErrorV1 &&
      error.code === "claim_conflict",
  );
});

test("cancelling an in-flight occurrence does not invalidate its exact claim", async () => {
  const { application } = harness();
  const { created, occurrence } = await createDueOccurrence(application);
  const claim = await application.claimOccurrence(worker, {
    scope,
    occurrence_id: occurrence.id,
    expected_occurrence_version: occurrence.occurrence_version,
    expected_schedule_version: occurrence.schedule_version,
    expected_status: occurrence.status,
    worker_id: "dispatcher_1",
    now: "2026-07-23T12:00:00.000Z",
  });
  await application.executeCommand(
    writer,
    createCommand({
      method: "timer.cancel",
      client_request_id: "cancel_1",
      schedule_id: created.schedule.id,
      expected_schedule_version: 1,
    }),
    new Date("2026-07-23T12:00:01.000Z"),
  );
  const dispatched = await application.dispatchOccurrence(worker, {
    scope,
    occurrence_id: occurrence.id,
    expected_occurrence_version: claim.occurrence_version,
    dispatch_generation: claim.dispatch_generation,
    claim_token: claim.claim_token,
    trace_id: "dispatch_trace",
    now: "2026-07-23T12:00:02.000Z",
  });
  assert.equal(dispatched.status, "dispatched");
  assert.equal(dispatched.cancel_requested_at, "2026-07-23T12:00:01.000Z");
});

test("an explicitly rejected in-flight cancellation settles cancelled without DLQ", async () => {
  const repository = new InMemoryTimerStateRepositoryV1();
  const application = new TimerApplicationV1(
    repository,
    {
      async submit() {
        throw new TimerDownstreamErrorV1(
          "non_retryable_contract",
          "request was not submitted",
        );
      },
      async getProcess(processId) {
        return closedProcess(processId);
      },
    },
    { max_dispatch_attempts: 1 },
  );
  const { created, occurrence } = await createDueOccurrence(application);
  const claim = await application.claimOccurrence(worker, {
    scope,
    occurrence_id: occurrence.id,
    expected_occurrence_version: occurrence.occurrence_version,
    expected_schedule_version: occurrence.schedule_version,
    expected_status: occurrence.status,
    worker_id: "cancelled_rejected_worker",
    now: "2026-07-23T12:00:00.000Z",
  });
  await application.executeCommand(
    writer,
    createCommand({
      method: "timer.cancel",
      client_request_id: "cancel_rejected",
      schedule_id: created.schedule.id,
      expected_schedule_version: 1,
    }),
    new Date("2026-07-23T12:00:01.000Z"),
  );
  const cancelled = await application.dispatchOccurrence(worker, {
    scope,
    occurrence_id: occurrence.id,
    expected_occurrence_version: claim.occurrence_version,
    dispatch_generation: claim.dispatch_generation,
    claim_token: claim.claim_token,
    trace_id: "cancelled_rejected_dispatch",
    now: "2026-07-23T12:00:02.000Z",
  });
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.dispatch_error_class, "non_retryable_cancelled");
  assert.equal(
    (await repository.transact((state) => [...state.dlq])).length,
    0,
  );
});

test("cancellation cannot turn a TP commit-unknown into a terminal outcome", async () => {
  const repository = new InMemoryTimerStateRepositoryV1();
  let submitCount = 0;
  const application = new TimerApplicationV1(
    repository,
    {
      async submit(request, traceId) {
        submitCount += 1;
        if (submitCount === 1) {
          throw new Error("connection closed after possible commit");
        }
        return accepted(
          "process_cancelled_unknown",
          request,
          traceId,
          true,
        );
      },
      async getProcess(processId) {
        return closedProcess(processId);
      },
    },
    {
      base_retry_delay_ms: 1,
      max_retry_delay_ms: 1,
      max_dispatch_attempts: 1,
    },
  );
  const { created, occurrence } = await createDueOccurrence(application);
  const claim = await application.claimOccurrence(worker, {
    scope,
    occurrence_id: occurrence.id,
    expected_occurrence_version: occurrence.occurrence_version,
    expected_schedule_version: occurrence.schedule_version,
    expected_status: occurrence.status,
    worker_id: "cancelled_unknown_worker",
    now: "2026-07-23T12:00:00.000Z",
  });
  await application.executeCommand(
    writer,
    createCommand({
      method: "timer.cancel",
      client_request_id: "cancel_unknown",
      schedule_id: created.schedule.id,
      expected_schedule_version: 1,
    }),
    new Date("2026-07-23T12:00:01.000Z"),
  );
  const unknown = await application.dispatchOccurrence(worker, {
    scope,
    occurrence_id: occurrence.id,
    expected_occurrence_version: claim.occurrence_version,
    dispatch_generation: claim.dispatch_generation,
    claim_token: claim.claim_token,
    trace_id: "cancelled_unknown_dispatch",
    now: "2026-07-23T12:00:02.000Z",
  });
  assert.equal(unknown.status, "retry_wait");
  assert.equal(unknown.dispatch_error_class, "retryable_transient");
  assert.equal(unknown.dispatch_commit_outcome_unknown, true);
  assert.equal(
    (await repository.transact((state) => [...state.dlq])).length,
    0,
  );
  const replayClaim = await application.claimOccurrence(worker, {
    scope,
    occurrence_id: occurrence.id,
    expected_occurrence_version: unknown.occurrence_version,
    expected_schedule_version: unknown.schedule_version,
    expected_status: unknown.status,
    worker_id: "cancelled_unknown_replay_worker",
    now: "2026-07-23T12:00:03.000Z",
  });
  const converged = await application.dispatchOccurrence(worker, {
    scope,
    occurrence_id: occurrence.id,
    expected_occurrence_version: replayClaim.occurrence_version,
    dispatch_generation: replayClaim.dispatch_generation,
    claim_token: replayClaim.claim_token,
    trace_id: "cancelled_unknown_replay",
    now: "2026-07-23T12:00:04.000Z",
  });
  assert.equal(converged.status, "dispatched");
  assert.equal(converged.trigger_process_id, "process_cancelled_unknown");
});

test("schedule edits and later cancellation preserve an unresolved TP submission's exact replay identity", async () => {
  const repository = new InMemoryTimerStateRepositoryV1();
  const submitted = [];
  const application = new TimerApplicationV1(
    repository,
    {
      async submit(request, traceId) {
        submitted.push(structuredClone(request));
        if (submitted.length === 1) {
          throw new Error("connection closed after possible commit");
        }
        return accepted(
          "process_edited_unknown",
          request,
          traceId,
          true,
        );
      },
      async getProcess(processId) {
        return closedProcess(processId);
      },
    },
    {
      base_retry_delay_ms: 1,
      max_retry_delay_ms: 1,
      max_dispatch_attempts: 1,
    },
  );
  const { created, occurrence } = await createDueOccurrence(application);
  const claim = await application.claimOccurrence(worker, {
    scope,
    occurrence_id: occurrence.id,
    expected_occurrence_version: occurrence.occurrence_version,
    expected_schedule_version: occurrence.schedule_version,
    expected_status: occurrence.status,
    worker_id: "edited_unknown_worker",
    now: "2026-07-23T12:00:00.000Z",
  });
  const unknown = await application.dispatchOccurrence(worker, {
    scope,
    occurrence_id: occurrence.id,
    expected_occurrence_version: claim.occurrence_version,
    dispatch_generation: claim.dispatch_generation,
    claim_token: claim.claim_token,
    trace_id: "edited_unknown_dispatch",
    now: "2026-07-23T12:00:01.000Z",
  });
  const update = createCommand({
    method: "timer.update",
    client_request_id: "edited_unknown_update",
    schedule_id: created.schedule.id,
    expected_schedule_version: 1,
    message: "must not rewrite an in-flight snapshot",
  });
  delete update.fire_at;
  delete update.timezone;
  delete update.payload;
  const updated = await application.executeCommand(
    writer,
    update,
    new Date("2026-07-23T12:00:01.100Z"),
  );
  await application.executeCommand(
    writer,
    createCommand({
      method: "timer.cancel",
      client_request_id: "edited_unknown_cancel",
      schedule_id: created.schedule.id,
      expected_schedule_version: updated.schedule.schedule_version,
    }),
    new Date("2026-07-23T12:00:01.200Z"),
  );
  const history = await application.query(writer, {
    method: "timer.history",
    runtime_run_id: "runtime_edited_unknown",
    trace_id: "edited_unknown_history",
    scope,
    schedule_id: created.schedule.id,
  });
  const unresolved = history.occurrences[0];
  assert.equal(unresolved.status, "retry_wait");
  assert.equal(unresolved.dispatch_error_class, "retryable_transient");
  assert.equal(unresolved.dispatch_commit_outcome_unknown, true);
  assert.equal(unresolved.schedule_version, unknown.schedule_version);
  assert.equal(unresolved.message, "wake up");
  assert.equal(canonicalJsonV1(unresolved.payload), '{"source":"test"}');
  assert.notEqual(unresolved.cancel_requested_at, null);

  const replayClaim = await application.claimOccurrence(worker, {
    scope,
    occurrence_id: unresolved.id,
    expected_occurrence_version: unresolved.occurrence_version,
    expected_schedule_version: unresolved.schedule_version,
    expected_status: unresolved.status,
    worker_id: "edited_unknown_replay_worker",
    now: "2026-07-23T12:00:02.000Z",
  });
  const converged = await application.dispatchOccurrence(worker, {
    scope,
    occurrence_id: unresolved.id,
    expected_occurrence_version: replayClaim.occurrence_version,
    dispatch_generation: replayClaim.dispatch_generation,
    claim_token: replayClaim.claim_token,
    trace_id: "edited_unknown_replay",
    now: "2026-07-23T12:00:03.000Z",
  });
  assert.equal(converged.status, "dispatched");
  assert.equal(submitted.length, 2);
  assert.equal(canonicalJsonV1(submitted[1]), canonicalJsonV1(submitted[0]));
});

test("DST gap shifts forward and repeated local time selects one stable earlier instant", () => {
  const gap = resolveTimerLocalTimeV1(
    "2026-03-08",
    "02:30:00",
    "America/New_York",
  );
  assert.equal(gap.dst_shifted, true);
  assert.equal(gap.instant.toISOString(), "2026-03-08T07:00:00.000Z");

  const repeated = resolveTimerLocalTimeV1(
    "2026-11-01",
    "01:30:00",
    "America/New_York",
  );
  assert.equal(repeated.dst_shifted, false);
  assert.equal(repeated.instant.toISOString(), "2026-11-01T05:30:00.000Z");
});

test("recurring scanner preserves the DST-shift audit fact", async () => {
  const { application } = harness();
  await application.executeCommand(
    writer,
    {
      schema_version: "timer.schedule_command.v1",
      method: "timer.create_recurring",
      runtime_run_id: "runtime_dst",
      trigger_process_id: "process_dst",
      client_request_id: "request_dst",
      trace_id: "trace_dst",
      scope,
      timezone: "America/New_York",
      rrule: "FREQ=DAILY;BYHOUR=2;BYMINUTE=30;BYSECOND=0",
      message: "DST reminder",
      payload: {},
    },
    new Date("2026-03-07T12:00:00.000Z"),
  );
  const occurrences = await application.scanDue(worker, {
    scope,
    worker_id: "scanner_dst",
    checkpoint_id: "dst",
    now: "2026-03-08T07:00:00.000Z",
  });
  assert.equal(occurrences.length, 1);
  assert.equal(occurrences[0].dst_shifted, true);
  assert.equal(occurrences[0].local_date, "2026-03-08");
  assert.equal(occurrences[0].local_time, "03:00:00");
});

test("scanner skips disabled catch-up backlog but preserves the current Strong due occurrence", async () => {
  const { application } = harness();
  const recurring = createCommand({
    method: "timer.create_recurring",
    client_request_id: "catchup_disabled",
    rrule: "FREQ=DAILY;BYHOUR=12;BYMINUTE=0;BYSECOND=0",
    catch_up: false,
  });
  delete recurring.fire_at;
  const created = await application.executeCommand(
    writer,
    recurring,
    new Date("2026-07-20T10:00:00.000Z"),
  );
  const occurrences = await application.scanDue(worker, {
    scope,
    worker_id: "scanner_catchup_disabled",
    checkpoint_id: "catchup_disabled",
    now: "2026-07-23T12:00:00.000Z",
  });
  assert.equal(occurrences.length, 1);
  assert.equal(occurrences[0].scheduled_fire_at, "2026-07-23T12:00:00.000Z");
  assert.equal(occurrences[0].is_catch_up, false);
  assert.equal(occurrences[0].catch_up_batch_id, null);
  const history = await application.query(writer, {
    method: "timer.history",
    runtime_run_id: "runtime_catchup_disabled",
    trace_id: "history_catchup_disabled",
    scope,
    schedule_id: created.schedule.id,
  });
  assert.deepEqual(
    history.occurrences.map(({ scheduled_fire_at, status }) => ({
      scheduled_fire_at,
      status,
    })),
    [
      {
        scheduled_fire_at: "2026-07-20T12:00:00.000Z",
        status: "skipped",
      },
      {
        scheduled_fire_at: "2026-07-23T12:00:00.000Z",
        status: "pending",
      },
    ],
  );
  assert.equal(
    history.schedule.next_fire_at,
    "2026-07-24T12:00:00.000Z",
  );
});

test("scanner applies persisted catch-up window and count before any occurrence can be claimed", async () => {
  const value = harness();
  const recurring = createCommand({
    method: "timer.create_recurring",
    client_request_id: "automatic_catchup_policy",
    rrule: "FREQ=DAILY;BYHOUR=12;BYMINUTE=0;BYSECOND=0",
    catch_up: true,
  });
  delete recurring.fire_at;
  const created = await value.application.executeCommand(
    writer,
    recurring,
    new Date("2026-07-19T10:00:00.000Z"),
  );
  await value.repository.transact((state) => {
    const schedule = state.schedules.get(created.schedule.id);
    schedule.max_catch_up_window_seconds = 3 * 86_400;
    schedule.max_catch_up_occurrences = 2;
  });
  const occurrences = await value.application.scanDue(worker, {
    scope,
    worker_id: "scanner_automatic_catchup",
    checkpoint_id: "automatic_catchup",
    now: "2026-07-24T12:00:01.000Z",
  });
  assert.deepEqual(
    occurrences.map(({ scheduled_fire_at }) => scheduled_fire_at),
    ["2026-07-23T12:00:00.000Z", "2026-07-24T12:00:00.000Z"],
  );
  assert.equal(occurrences.every(({ is_catch_up }) => is_catch_up), true);
  assert.equal(
    new Set(occurrences.map(({ catch_up_batch_id }) => catch_up_batch_id))
      .size,
    1,
  );
  const batch = await value.repository.transact((state) =>
    structuredClone(state.batches.get(occurrences[0].catch_up_batch_id)),
  );
  assert.equal(batch.policy_snapshot.max_catch_up_window_seconds, 259_200);
  assert.equal(batch.policy_snapshot.max_catch_up_occurrences, 2);
  assert.deepEqual(batch.occurrence_ids, occurrences.map(({ id }) => id));
  await assert.rejects(
    value.application.claimOccurrence(worker, {
      scope,
      occurrence_id: occurrences[0].id,
      expected_occurrence_version: occurrences[0].occurrence_version,
      expected_schedule_version: occurrences[0].schedule_version,
      expected_status: occurrences[0].status,
      worker_id: "claim_before_serial_release",
      now: "2026-07-24T12:00:02.000Z",
    }),
    (error) =>
      error instanceof TimerApplicationErrorV1 &&
      error.code === "claim_conflict",
  );
  const ready = await value.application.advanceCatchUpBatch(worker, {
    scope,
    batch_id: batch.id,
    ...catchUpPrecondition(batch),
    trace_id: "automatic_catchup_advance",
    now: "2026-07-24T12:00:02.000Z",
  });
  assert.equal(ready.outcome, "ready");
  assert.equal(ready.occurrence.id, occurrences[0].id);
  const claimed = await value.application.claimOccurrence(worker, {
    scope,
    occurrence_id: ready.occurrence.id,
    expected_occurrence_version: ready.occurrence.occurrence_version,
    expected_schedule_version: ready.occurrence.schedule_version,
    expected_status: ready.occurrence.status,
    worker_id: "claim_after_serial_release",
    now: "2026-07-24T12:00:03.000Z",
  });
  assert.equal(claimed.occurrence.status, "dispatching");
  const history = await value.application.query(writer, {
    method: "timer.history",
    runtime_run_id: "runtime_automatic_catchup",
    trace_id: "history_automatic_catchup",
    scope,
    schedule_id: created.schedule.id,
  });
  assert.equal(
    history.occurrences.filter(({ status }) => status === "skipped").length,
    2,
  );
  assert.equal(
    history.occurrences.some(
      ({ scheduled_fire_at, status }) =>
        scheduled_fire_at === "2026-07-22T12:00:00.000Z" &&
        status === "skipped",
    ),
    true,
  );
});

test("scanner response paging cannot truncate the durable catch-up batch", async () => {
  const value = harness();
  const recurring = createCommand({
    method: "timer.create_recurring",
    client_request_id: "automatic_catchup_page",
    rrule: "FREQ=DAILY;BYHOUR=12;BYMINUTE=0;BYSECOND=0",
    catch_up: true,
  });
  delete recurring.fire_at;
  const created = await value.application.executeCommand(
    writer,
    recurring,
    new Date("2026-07-20T10:00:00.000Z"),
  );
  await value.repository.transact((state) => {
    const schedule = state.schedules.get(created.schedule.id);
    schedule.max_catch_up_window_seconds = 3 * 86_400;
    schedule.max_catch_up_occurrences = 2;
  });
  const page = await value.application.scanDue(worker, {
    scope,
    worker_id: "scanner_automatic_catchup_page",
    checkpoint_id: "automatic_catchup_page",
    limit: 1,
    now: "2026-07-23T12:00:01.000Z",
  });
  assert.equal(page.length, 1);
  const batch = await value.repository.transact((state) =>
    structuredClone(state.batches.get(page[0].catch_up_batch_id)),
  );
  assert.equal(batch.occurrence_ids.length, 2);
  const durableOccurrences = await value.repository.transact((state) =>
    batch.occurrence_ids.map((id) =>
      structuredClone(state.occurrences.get(id)),
    ),
  );
  assert.deepEqual(
    durableOccurrences.map(({ scheduled_fire_at, status }) => ({
      scheduled_fire_at,
      status,
    })),
    [
      {
        scheduled_fire_at: "2026-07-22T12:00:00.000Z",
        status: "pending",
      },
      {
        scheduled_fire_at: "2026-07-23T12:00:00.000Z",
        status: "pending",
      },
    ],
  );
});

test("scanner advances an entirely out-of-window backlog without creating dispatchable work", async () => {
  const value = harness();
  const recurring = createCommand({
    method: "timer.create_recurring",
    client_request_id: "automatic_catchup_outside_window",
    rrule: "FREQ=DAILY;BYHOUR=12;BYMINUTE=0;BYSECOND=0",
    catch_up: true,
  });
  delete recurring.fire_at;
  const created = await value.application.executeCommand(
    writer,
    recurring,
    new Date("2026-07-19T10:00:00.000Z"),
  );
  await value.repository.transact((state) => {
    const schedule = state.schedules.get(created.schedule.id);
    schedule.max_catch_up_window_seconds = 60;
    schedule.max_catch_up_occurrences = 1;
  });
  const occurrences = await value.application.scanDue(worker, {
    scope,
    worker_id: "scanner_outside_window",
    checkpoint_id: "outside_window",
    now: "2026-07-24T13:00:00.000Z",
  });
  assert.deepEqual(occurrences, []);
  const history = await value.application.query(writer, {
    method: "timer.history",
    runtime_run_id: "runtime_outside_window",
    trace_id: "history_outside_window",
    scope,
    schedule_id: created.schedule.id,
  });
  assert.equal(history.occurrences.length, 1);
  assert.equal(history.occurrences[0].status, "skipped");
  assert.equal(
    history.schedule.next_fire_at,
    "2026-07-25T12:00:00.000Z",
  );
});

test("manual catch-up batching cannot override persisted schedule policy", async () => {
  const value = harness();
  const recurring = createCommand({
    method: "timer.create_recurring",
    client_request_id: "manual_catchup_policy",
    rrule: "FREQ=DAILY;BYHOUR=12;BYMINUTE=0;BYSECOND=0",
    catch_up: true,
  });
  delete recurring.fire_at;
  const created = await value.application.executeCommand(
    writer,
    recurring,
    new Date("2026-07-23T10:00:00.000Z"),
  );
  const first = await value.application.scanDue(worker, {
    scope,
    worker_id: "scanner_manual_policy_first",
    checkpoint_id: "manual_policy",
    now: "2026-07-23T12:00:00.000Z",
  });
  const second = await value.application.scanDue(worker, {
    scope,
    worker_id: "scanner_manual_policy_second",
    checkpoint_id: "manual_policy",
    now: "2026-07-24T12:00:00.000Z",
  });
  assert.equal(first.length, 1);
  assert.equal(second.length, 1);
  await value.repository.transact((state) => {
    const schedule = state.schedules.get(created.schedule.id);
    schedule.max_catch_up_window_seconds = 3 * 86_400;
    schedule.max_catch_up_occurrences = 1;
  });
  await assert.rejects(
    value.application.createCatchUpBatch(worker, {
      scope,
      occurrence_ids: [first[0].id, second[0].id],
      trace_id: "manual_policy_count",
      now: "2026-07-24T12:00:01.000Z",
    }),
    (error) =>
      error instanceof TimerApplicationErrorV1 &&
      error.code === "invalid_request",
  );
  await value.repository.transact((state) => {
    const schedule = state.schedules.get(created.schedule.id);
    schedule.max_catch_up_window_seconds = 60;
    schedule.max_catch_up_occurrences = 2;
  });
  await assert.rejects(
    value.application.createCatchUpBatch(worker, {
      scope,
      occurrence_ids: [first[0].id, second[0].id],
      trace_id: "manual_policy_window",
      now: "2026-07-24T12:02:00.000Z",
    }),
    (error) =>
      error instanceof TimerApplicationErrorV1 &&
      error.code === "invalid_request",
  );
  await value.repository.transact((state) => {
    const schedule = state.schedules.get(created.schedule.id);
    schedule.max_catch_up_window_seconds = 3 * 86_400;
    schedule.catch_up = false;
  });
  await assert.rejects(
    value.application.createCatchUpBatch(worker, {
      scope,
      occurrence_ids: [second[0].id],
      trace_id: "manual_policy_disabled",
      now: "2026-07-24T12:00:01.000Z",
    }),
    (error) =>
      error instanceof TimerApplicationErrorV1 &&
      error.code === "occurrence_not_found",
  );
  await value.repository.transact((state) => {
    const schedule = state.schedules.get(created.schedule.id);
    schedule.catch_up = true;
  });
  const batch = await value.application.createCatchUpBatch(worker, {
    scope,
    occurrence_ids: [first[0].id, second[0].id],
    trace_id: "manual_policy_allowed",
    now: "2026-07-24T12:00:01.000Z",
  });
  assert.equal(batch.policy_snapshot.max_catch_up_window_seconds, 259_200);
  assert.equal(batch.policy_snapshot.max_catch_up_occurrences, 2);
  assert.match(
    batch.policy_snapshot.config_revision,
    /^timer_manual_[A-Za-z0-9_-]{32}$/u,
  );
});

test("catch-up dispatch is strictly serial through the TP query projection", async () => {
  const value = harness();
  const first = await createDueOccurrence(value.application, {
    runtime_run_id: "runtime_a",
    client_request_id: "request_a",
    fire_at: "2026-07-23T12:00:00.000Z",
  });
  const second = await createDueOccurrence(
    value.application,
    {
      runtime_run_id: "runtime_b",
      client_request_id: "request_b",
      fire_at: "2026-07-23T12:01:00.000Z",
    },
    "2026-07-23T12:01:00.000Z",
  );
  const batch = await value.application.createCatchUpBatch(worker, {
    scope,
    occurrence_ids: [second.occurrence.id, first.occurrence.id],
    trace_id: "catchup_create_trace",
    timeout_seconds: 300,
    now: "2026-07-23T12:02:00.000Z",
  });
  await assert.rejects(
    value.application.claimOccurrence(worker, {
      scope,
      occurrence_id: second.occurrence.id,
      expected_occurrence_version: second.occurrence.occurrence_version,
      expected_schedule_version: second.occurrence.schedule_version,
      expected_status: second.occurrence.status,
      worker_id: "bypass_worker",
      now: "2026-07-23T12:02:00.500Z",
    }),
    (error) =>
      error instanceof TimerApplicationErrorV1 &&
      error.code === "claim_conflict",
  );
  const ready = await value.application.advanceCatchUpBatch(worker, {
    scope,
    batch_id: batch.id,
    ...catchUpPrecondition(batch),
    trace_id: "catchup_trace",
    now: "2026-07-23T12:02:01.000Z",
  });
  assert.equal(ready.outcome, "ready");
  assert.equal(ready.occurrence.id, first.occurrence.id);

  const claim = await value.application.claimOccurrence(worker, {
    scope,
    occurrence_id: first.occurrence.id,
    expected_occurrence_version: ready.occurrence.occurrence_version,
    expected_schedule_version: ready.occurrence.schedule_version,
    expected_status: ready.occurrence.status,
    worker_id: "catchup_worker",
    now: "2026-07-23T12:02:02.000Z",
  });
  const inFlight = await value.application.advanceCatchUpBatch(worker, {
    scope,
    batch_id: batch.id,
    ...catchUpPrecondition(ready.batch),
    trace_id: "catchup_in_flight_trace",
    now: "2026-07-23T12:02:02.500Z",
  });
  assert.equal(inFlight.outcome, "waiting");
  assert.equal(inFlight.occurrence, null);
  assert.equal(
    inFlight.batch.cursor_occurrence_id,
    first.occurrence.id,
  );
  assert.equal(inFlight.batch.last_occurrence_id, null);
  assert.equal(inFlight.batch.last_trigger_process_id, null);
  const dispatched = await value.application.dispatchOccurrence(worker, {
    scope,
    occurrence_id: first.occurrence.id,
    expected_occurrence_version: claim.occurrence_version,
    dispatch_generation: claim.dispatch_generation,
    claim_token: claim.claim_token,
    trace_id: "dispatch_trace",
    now: "2026-07-23T12:02:03.000Z",
  });
  const waiting = await value.application.advanceCatchUpBatch(worker, {
    scope,
    batch_id: batch.id,
    expected_status: "running",
    expected_cursor_occurrence_id: dispatched.id,
    expected_last_occurrence_id: dispatched.id,
    expected_last_trigger_process_id: dispatched.trigger_process_id,
    trace_id: "catchup_trace",
    now: "2026-07-23T12:02:04.000Z",
  });
  assert.equal(waiting.outcome, "waiting");

  value.processStates.set(
    dispatched.trigger_process_id,
    closedProcess("process_wrong_same_scope"),
  );
  await assert.rejects(
    value.application.advanceCatchUpBatch(worker, {
      scope,
      batch_id: batch.id,
      ...catchUpPrecondition(waiting.batch),
      trace_id: "catchup_drift_trace",
      now: "2026-07-23T12:02:04.500Z",
    }),
    (error) =>
      error instanceof TimerApplicationErrorV1 &&
      error.code === "catch_up_conflict",
  );

  value.processStates.set(
    dispatched.trigger_process_id,
    closedProcess(dispatched.trigger_process_id),
  );
  const next = await value.application.advanceCatchUpBatch(worker, {
    scope,
    batch_id: batch.id,
    ...catchUpPrecondition(waiting.batch),
    trace_id: "catchup_trace",
    now: "2026-07-23T12:02:05.000Z",
  });
  assert.equal(next.outcome, "ready");
  assert.equal(next.occurrence.id, second.occurrence.id);
});

test("catch-up stops after an owner-side terminal dispatch failure when continuation is disabled", async () => {
  const application = new TimerApplicationV1(
    new InMemoryTimerStateRepositoryV1(),
    {
      async submit() {
        throw new TimerDownstreamErrorV1(
          "non_retryable_contract",
          "contract rejected",
        );
      },
      async getProcess() {
        throw new Error("a rejected dispatch has no process projection");
      },
    },
    { max_dispatch_attempts: 1 },
  );
  const first = await createDueOccurrence(application, {
    runtime_run_id: "runtime_failed_catchup_a",
    client_request_id: "request_failed_catchup_a",
    fire_at: "2026-07-23T12:00:00.000Z",
  });
  const second = await createDueOccurrence(
    application,
    {
      runtime_run_id: "runtime_failed_catchup_b",
      client_request_id: "request_failed_catchup_b",
      fire_at: "2026-07-23T12:01:00.000Z",
    },
    "2026-07-23T12:01:00.000Z",
  );
  const batch = await application.createCatchUpBatch(worker, {
    scope,
    occurrence_ids: [first.occurrence.id, second.occurrence.id],
    continue_after_failed: false,
    trace_id: "failed_catchup_create",
    now: "2026-07-23T12:02:00.000Z",
  });
  const ready = await application.advanceCatchUpBatch(worker, {
    scope,
    batch_id: batch.id,
    ...catchUpPrecondition(batch),
    trace_id: "failed_catchup_ready",
    now: "2026-07-23T12:02:01.000Z",
  });
  const claim = await application.claimOccurrence(worker, {
    scope,
    occurrence_id: first.occurrence.id,
    expected_occurrence_version: ready.occurrence.occurrence_version,
    expected_schedule_version: ready.occurrence.schedule_version,
    expected_status: ready.occurrence.status,
    worker_id: "failed_catchup_worker",
    now: "2026-07-23T12:02:02.000Z",
  });
  const failed = await application.dispatchOccurrence(worker, {
    scope,
    occurrence_id: first.occurrence.id,
    expected_occurrence_version: claim.occurrence_version,
    dispatch_generation: claim.dispatch_generation,
    claim_token: claim.claim_token,
    trace_id: "failed_catchup_dispatch",
    now: "2026-07-23T12:02:03.000Z",
  });
  assert.equal(failed.status, "failed");

  const stopped = await application.advanceCatchUpBatch(worker, {
    scope,
    batch_id: batch.id,
    ...catchUpPrecondition(ready.batch),
    trace_id: "failed_catchup_stop",
    now: "2026-07-23T12:02:04.000Z",
  });
  assert.equal(stopped.outcome, "completed");
  assert.equal(stopped.batch.status, "cancelled");
  assert.equal(stopped.batch.reason, "prior_occurrence_not_dispatched");

  const secondHistory = await application.query(writer, {
    method: "timer.history",
    runtime_run_id: "runtime_failed_catchup_b",
    trace_id: "failed_catchup_history",
    scope,
    schedule_id: second.created.schedule.id,
  });
  assert.equal(secondHistory.occurrences[0].status, "skipped");
});

test("catch-up continuation disabled treats terminal Meta failure as a failed prior process", async () => {
  const value = harness();
  const first = await createDueOccurrence(value.application, {
    runtime_run_id: "runtime_meta_failed_a",
    client_request_id: "request_meta_failed_a",
    fire_at: "2026-07-23T12:00:00.000Z",
  });
  const second = await createDueOccurrence(
    value.application,
    {
      runtime_run_id: "runtime_meta_failed_b",
      client_request_id: "request_meta_failed_b",
      fire_at: "2026-07-23T12:01:00.000Z",
    },
    "2026-07-23T12:01:00.000Z",
  );
  const batch = await value.application.createCatchUpBatch(worker, {
    scope,
    occurrence_ids: [first.occurrence.id, second.occurrence.id],
    continue_after_failed: false,
    trace_id: "meta_failed_batch",
    now: "2026-07-23T12:02:00.000Z",
  });
  const ready = await value.application.advanceCatchUpBatch(worker, {
    scope,
    batch_id: batch.id,
    ...catchUpPrecondition(batch),
    trace_id: "meta_failed_ready",
    now: "2026-07-23T12:02:01.000Z",
  });
  const claim = await value.application.claimOccurrence(worker, {
    scope,
    occurrence_id: first.occurrence.id,
    expected_occurrence_version: ready.occurrence.occurrence_version,
    expected_schedule_version: ready.occurrence.schedule_version,
    expected_status: ready.occurrence.status,
    worker_id: "meta_failed_worker",
    now: "2026-07-23T12:02:02.000Z",
  });
  const dispatched = await value.application.dispatchOccurrence(worker, {
    scope,
    occurrence_id: first.occurrence.id,
    expected_occurrence_version: claim.occurrence_version,
    dispatch_generation: claim.dispatch_generation,
    claim_token: claim.claim_token,
    trace_id: "meta_failed_dispatch",
    now: "2026-07-23T12:02:03.000Z",
  });
  value.processStates.set(
    dispatched.trigger_process_id,
    closedProcess(dispatched.trigger_process_id, {
      meta_status: "failed",
      meta_summary_ref: null,
    }),
  );
  const stopped = await value.application.advanceCatchUpBatch(worker, {
    scope,
    batch_id: batch.id,
    expected_status: "running",
    expected_cursor_occurrence_id: dispatched.id,
    expected_last_occurrence_id: dispatched.id,
    expected_last_trigger_process_id: dispatched.trigger_process_id,
    trace_id: "meta_failed_stop",
    now: "2026-07-23T12:02:04.000Z",
  });
  assert.equal(stopped.outcome, "completed");
  assert.equal(stopped.batch.status, "cancelled");
  assert.equal(stopped.batch.reason, "prior_process_not_completed");

  const secondHistory = await value.application.query(writer, {
    method: "timer.history",
    runtime_run_id: "runtime_meta_failed_b",
    trace_id: "meta_failed_history",
    scope,
    schedule_id: second.created.schedule.id,
  });
  assert.equal(secondHistory.occurrences[0].status, "skipped");
});

test("catch-up timeout durably skips only undispatched work", async () => {
  const value = harness();
  const { occurrence } = await createDueOccurrence(value.application);
  const batch = await value.application.createCatchUpBatch(worker, {
    scope,
    occurrence_ids: [occurrence.id],
    trace_id: "catchup_timeout_create_trace",
    timeout_seconds: 1,
    now: "2026-07-23T12:00:01.000Z",
  });
  const timedOut = await value.application.advanceCatchUpBatch(worker, {
    scope,
    batch_id: batch.id,
    ...catchUpPrecondition(batch),
    trace_id: "catchup_trace",
    now: "2026-07-23T12:00:03.000Z",
  });
  assert.equal(timedOut.outcome, "timed_out");
  assert.equal(timedOut.batch.reason, "catch_up_timeout");
  const history = await value.application.query(writer, {
    method: "timer.history",
    runtime_run_id: "runtime_1",
    trace_id: "history_trace",
    scope,
    schedule_id: occurrence.schedule_id,
  });
  assert.equal(history.occurrences[0].status, "skipped");
  assert.equal(history.schedule.status, "expired");
});

test("catch-up timeout clears a released occurrence's durable retry schedule", async () => {
  const repository = new InMemoryTimerStateRepositoryV1();
  const application = new TimerApplicationV1(
    repository,
    {
      async submit() {
        throw new TimerDownstreamErrorV1(
          "retryable_rate_limited",
          "retry later",
        );
      },
      async getProcess() {
        throw new Error("not used");
      },
    },
    {
      base_retry_delay_ms: 60_000,
      max_retry_delay_ms: 60_000,
      max_dispatch_attempts: 3,
    },
  );
  const { created, occurrence } = await createDueOccurrence(application);
  const batch = await application.createCatchUpBatch(worker, {
    scope,
    occurrence_ids: [occurrence.id],
    trace_id: "retry_timeout_batch",
    timeout_seconds: 2,
    now: "2026-07-23T12:00:01.000Z",
  });
  const ready = await application.advanceCatchUpBatch(worker, {
    scope,
    batch_id: batch.id,
    ...catchUpPrecondition(batch),
    trace_id: "retry_timeout_ready",
    now: "2026-07-23T12:00:01.100Z",
  });
  const claim = await application.claimOccurrence(worker, {
    scope,
    occurrence_id: occurrence.id,
    expected_occurrence_version: ready.occurrence.occurrence_version,
    expected_schedule_version: ready.occurrence.schedule_version,
    expected_status: ready.occurrence.status,
    worker_id: "retry_timeout_worker",
    now: "2026-07-23T12:00:01.200Z",
  });
  const retry = await application.dispatchOccurrence(worker, {
    scope,
    occurrence_id: occurrence.id,
    expected_occurrence_version: claim.occurrence_version,
    dispatch_generation: claim.dispatch_generation,
    claim_token: claim.claim_token,
    trace_id: "retry_timeout_dispatch",
    now: "2026-07-23T12:00:01.300Z",
  });
  assert.equal(retry.status, "retry_wait");
  assert.notEqual(retry.next_retry_at, null);

  const timedOut = await application.advanceCatchUpBatch(worker, {
    scope,
    batch_id: batch.id,
    ...catchUpPrecondition(ready.batch),
    trace_id: "retry_timeout_advance",
    now: "2026-07-23T12:00:03.000Z",
  });
  assert.equal(timedOut.outcome, "timed_out");
  const history = await application.query(writer, {
    method: "timer.history",
    runtime_run_id: "runtime_retry_timeout",
    trace_id: "retry_timeout_history",
    scope,
    schedule_id: created.schedule.id,
  });
  assert.equal(history.occurrences[0].status, "skipped");
  assert.equal(history.occurrences[0].next_retry_at, null);
});

test("catch-up timeout preserves commit-unknown replay work until TP proves the outcome", async () => {
  const repository = new InMemoryTimerStateRepositoryV1();
  const submitted = [];
  const application = new TimerApplicationV1(
    repository,
    {
      async submit(request, traceId) {
        submitted.push(structuredClone(request));
        if (submitted.length === 1) {
          throw new Error("connection closed after possible commit");
        }
        return accepted(
          "process_timed_out_unknown",
          request,
          traceId,
          true,
        );
      },
      async getProcess(processId) {
        return closedProcess(processId);
      },
    },
    {
      base_retry_delay_ms: 1,
      max_retry_delay_ms: 1,
      max_dispatch_attempts: 1,
    },
  );
  const { created, occurrence } = await createDueOccurrence(application);
  const batch = await application.createCatchUpBatch(worker, {
    scope,
    occurrence_ids: [occurrence.id],
    trace_id: "timed_out_unknown_batch",
    timeout_seconds: 2,
    now: "2026-07-23T12:00:01.000Z",
  });
  const ready = await application.advanceCatchUpBatch(worker, {
    scope,
    batch_id: batch.id,
    ...catchUpPrecondition(batch),
    trace_id: "timed_out_unknown_ready",
    now: "2026-07-23T12:00:01.100Z",
  });
  const firstClaim = await application.claimOccurrence(worker, {
    scope,
    occurrence_id: occurrence.id,
    expected_occurrence_version: ready.occurrence.occurrence_version,
    expected_schedule_version: ready.occurrence.schedule_version,
    expected_status: ready.occurrence.status,
    worker_id: "timed_out_unknown_worker",
    now: "2026-07-23T12:00:01.200Z",
  });
  const unknown = await application.dispatchOccurrence(worker, {
    scope,
    occurrence_id: occurrence.id,
    expected_occurrence_version: firstClaim.occurrence_version,
    dispatch_generation: firstClaim.dispatch_generation,
    claim_token: firstClaim.claim_token,
    trace_id: "timed_out_unknown_dispatch",
    now: "2026-07-23T12:00:01.300Z",
  });
  assert.equal(unknown.status, "retry_wait");
  assert.equal(unknown.dispatch_error_class, "retryable_transient");
  assert.equal(unknown.dispatch_commit_outcome_unknown, true);
  const timedOut = await application.advanceCatchUpBatch(worker, {
    scope,
    batch_id: batch.id,
    ...catchUpPrecondition(ready.batch),
    trace_id: "timed_out_unknown_timeout",
    now: "2026-07-23T12:00:03.000Z",
  });
  assert.equal(timedOut.batch.status, "timed_out");
  const unresolvedHistory = await application.query(writer, {
    method: "timer.history",
    runtime_run_id: "runtime_timed_out_unknown",
    trace_id: "timed_out_unknown_history",
    scope,
    schedule_id: created.schedule.id,
  });
  const unresolved = unresolvedHistory.occurrences[0];
  assert.equal(unresolved.status, "retry_wait");
  assert.notEqual(unresolved.next_retry_at, null);

  const replayClaim = await application.claimOccurrence(worker, {
    scope,
    occurrence_id: unresolved.id,
    expected_occurrence_version: unresolved.occurrence_version,
    expected_schedule_version: unresolved.schedule_version,
    expected_status: unresolved.status,
    worker_id: "timed_out_unknown_replay_worker",
    now: "2026-07-23T12:00:04.000Z",
  });
  const converged = await application.dispatchOccurrence(worker, {
    scope,
    occurrence_id: unresolved.id,
    expected_occurrence_version: replayClaim.occurrence_version,
    dispatch_generation: replayClaim.dispatch_generation,
    claim_token: replayClaim.claim_token,
    trace_id: "timed_out_unknown_replay",
    now: "2026-07-23T12:00:05.000Z",
  });
  assert.equal(converged.status, "dispatched");
  assert.equal(converged.trigger_process_id, "process_timed_out_unknown");
  assert.equal(canonicalJsonV1(submitted[1]), canonicalJsonV1(submitted[0]));
});

test("payload size is enforced on canonical UTF-8 bytes", async () => {
  const { application } = harness();
  await assert.rejects(
    application.executeCommand(
      writer,
      createCommand({ payload: { value: "x".repeat(8 * 1_024) } }),
      new Date("2026-07-23T10:00:00.000Z"),
    ),
    (error) =>
      error instanceof TimerApplicationErrorV1 &&
      error.code === "payload_too_large",
  );
});

test("canonical JSON is bounded, side-effect free, and permits non-cyclic aliases", () => {
  let getterCalls = 0;
  const accessor = {};
  Object.defineProperty(accessor, "value", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return "secret";
    },
  });
  assert.throws(() => canonicalJsonV1(accessor), /accessor_property/u);
  assert.equal(getterCalls, 0);

  const hidden = {};
  Object.defineProperty(hidden, "value", {
    enumerable: false,
    value: "hidden",
  });
  assert.throws(() => canonicalJsonV1(hidden), /hidden_property/u);

  const sparse = new Array(2);
  sparse[1] = "present";
  assert.throws(() => canonicalJsonV1(sparse), /sparse_array/u);
  assert.throws(
    () => canonicalJsonV1(new Proxy({ value: "proxied" }, {})),
    /proxy_object/u,
  );

  const cyclic = {};
  cyclic.self = cyclic;
  assert.throws(() => canonicalJsonV1(cyclic), /cycle/u);

  const deep = {};
  let cursor = deep;
  for (let depth = 0; depth < 66; depth += 1) {
    cursor.next = {};
    cursor = cursor.next;
  }
  assert.throws(() => canonicalJsonV1(deep), /max_depth_exceeded/u);

  const shared = { value: "same" };
  assert.equal(
    canonicalJsonV1({ left: shared, right: shared }),
    '{"left":{"value":"same"},"right":{"value":"same"}}',
  );
});

test("terminal once dispatch failure closes the schedule as failed", async () => {
  const application = new TimerApplicationV1(
    new InMemoryTimerStateRepositoryV1(),
    {
      async submit() {
        throw new TimerDownstreamErrorV1(
          "non_retryable_contract",
          "contract rejected",
        );
      },
      async getProcess() {
        throw new Error("not used");
      },
    },
    { max_dispatch_attempts: 1 },
  );
  const { created, occurrence } = await createDueOccurrence(application);
  const claim = await application.claimOccurrence(worker, {
    scope,
    occurrence_id: occurrence.id,
    expected_occurrence_version: occurrence.occurrence_version,
    expected_schedule_version: occurrence.schedule_version,
    expected_status: occurrence.status,
    worker_id: "dispatcher_1",
    now: "2026-07-23T12:00:00.000Z",
  });
  const failed = await application.dispatchOccurrence(worker, {
    scope,
    occurrence_id: occurrence.id,
    expected_occurrence_version: claim.occurrence_version,
    dispatch_generation: claim.dispatch_generation,
    claim_token: claim.claim_token,
    trace_id: "dispatch_trace",
    now: "2026-07-23T12:00:01.000Z",
  });
  assert.equal(failed.status, "failed");
  const current = await application.query(writer, {
    method: "timer.get",
    runtime_run_id: "runtime_1",
    trace_id: "get_trace",
    scope,
    schedule_id: created.schedule.id,
  });
  assert.equal(current.schedule.status, "failed");
  assert.equal(current.schedule.schedule_version, 2);
});

test("TP commit-unknown is never made terminal by the local retry cap and converges by exact replay", async () => {
  const repository = new InMemoryTimerStateRepositoryV1();
  const submitted = [];
  let callCount = 0;
  const triggerProcessor = {
      async submit(request, traceId) {
        submitted.push(structuredClone(request));
        callCount += 1;
        if (callCount === 1) {
          // Model commit-then-disconnect: TP accepted the exact dedupe request,
          // but Timer did not receive the committed response.
          throw new Error("connection closed after commit");
        }
        return accepted(
          "process_commit_unknown",
          request,
          traceId,
          true,
        );
      },
      async getProcess(processId) {
        return closedProcess(processId);
      },
    };
  const options = {
      base_retry_delay_ms: 1,
      max_retry_delay_ms: 1,
      max_dispatch_attempts: 1,
    };
  const application = new TimerApplicationV1(
    repository,
    triggerProcessor,
    options,
  );
  const { occurrence } = await createDueOccurrence(application);
  const firstClaim = await application.claimOccurrence(worker, {
    scope,
    occurrence_id: occurrence.id,
    expected_occurrence_version: occurrence.occurrence_version,
    expected_schedule_version: occurrence.schedule_version,
    expected_status: occurrence.status,
    worker_id: "commit_unknown_worker_1",
    now: "2026-07-23T12:00:00.000Z",
  });
  const unknown = await application.dispatchOccurrence(worker, {
    scope,
    occurrence_id: occurrence.id,
    expected_occurrence_version: firstClaim.occurrence_version,
    dispatch_generation: firstClaim.dispatch_generation,
    claim_token: firstClaim.claim_token,
    trace_id: "commit_unknown_trace_1",
    now: "2026-07-23T12:00:01.000Z",
  });
  assert.equal(unknown.status, "retry_wait");
  assert.equal(unknown.dispatch_error_class, "retryable_transient");
  assert.equal(unknown.dispatch_commit_outcome_unknown, true);
  assert.equal(unknown.attempt_count, 1);
  assert.equal(
    (await repository.transact((state) => [...state.dlq])).length,
    0,
  );

  // A new application instance over the same durable state models process
  // restart; reconciliation authority must come from the persisted flag.
  const restarted = new TimerApplicationV1(
    repository,
    triggerProcessor,
    options,
  );
  const replayClaim = await restarted.claimOccurrence(worker, {
    scope,
    occurrence_id: occurrence.id,
    expected_occurrence_version: unknown.occurrence_version,
    expected_schedule_version: unknown.schedule_version,
    expected_status: unknown.status,
    worker_id: "commit_unknown_worker_2",
    now: "2026-07-23T12:00:02.000Z",
  });
  const converged = await restarted.dispatchOccurrence(worker, {
    scope,
    occurrence_id: occurrence.id,
    expected_occurrence_version: replayClaim.occurrence_version,
    dispatch_generation: replayClaim.dispatch_generation,
    claim_token: replayClaim.claim_token,
    trace_id: "commit_unknown_trace_2",
    now: "2026-07-23T12:00:03.000Z",
  });
  assert.equal(converged.status, "dispatched");
  assert.equal(converged.trigger_process_id, "process_commit_unknown");
  assert.equal(converged.dispatch_error_class, "idempotency_replayed");
  assert.equal(submitted.length, 2);
  assert.equal(canonicalJsonV1(submitted[1]), canonicalJsonV1(submitted[0]));
  assert.equal(
    (await repository.transact((state) => [...state.dlq])).length,
    0,
  );
});

test("the last recurring occurrence remains claimable before schedule expiry", async () => {
  const { application } = harness();
  const recurring = createCommand({
    method: "timer.create_recurring",
    client_request_id: "recurring_last_occurrence",
    rrule: "FREQ=DAILY;BYHOUR=12;BYMINUTE=0;BYSECOND=0",
    end_time: "2026-07-23T12:00:00.000Z",
  });
  delete recurring.fire_at;
  const created = await application.executeCommand(
    writer,
    recurring,
    new Date("2026-07-23T10:00:00.000Z"),
  );
  const [occurrence] = await application.scanDue(worker, {
    scope,
    worker_id: "scanner_last_recurring",
    checkpoint_id: "last_recurring",
    now: "2026-07-23T12:00:00.000Z",
  });
  assert.ok(occurrence);
  const claim = await application.claimOccurrence(worker, {
    scope,
    occurrence_id: occurrence.id,
    expected_occurrence_version: occurrence.occurrence_version,
    expected_schedule_version: occurrence.schedule_version,
    expected_status: occurrence.status,
    worker_id: "dispatcher_last_recurring",
    now: "2026-07-23T12:00:00.000Z",
  });
  const dispatched = await application.dispatchOccurrence(worker, {
    scope,
    occurrence_id: occurrence.id,
    expected_occurrence_version: claim.occurrence_version,
    dispatch_generation: claim.dispatch_generation,
    claim_token: claim.claim_token,
    trace_id: "last_recurring_dispatch",
    now: "2026-07-23T12:00:01.000Z",
  });
  assert.equal(dispatched.status, "dispatched");
  const current = await application.query(writer, {
    method: "timer.get",
    runtime_run_id: "runtime_1",
    trace_id: "last_recurring_query",
    scope,
    schedule_id: created.schedule.id,
  });
  assert.equal(current.schedule.status, "expired");
  assert.equal(current.schedule.schedule_version, 2);
});

test("retryable dispatch applies backoff then reaches the durable DLQ cap", async () => {
  const secretFailure =
    "Bearer timer-super-secret https://dependency.invalid/?token=secret";
  const repository = new InMemoryTimerStateRepositoryV1();
  const application = new TimerApplicationV1(
    repository,
    {
      async submit() {
        throw new TimerDownstreamErrorV1(
          "retryable_rate_limited",
          secretFailure,
        );
      },
      async getProcess() {
        throw new Error("not used");
      },
    },
    {
      base_retry_delay_ms: 1_000,
      max_retry_delay_ms: 1_000,
      max_dispatch_attempts: 2,
    },
  );
  const { occurrence } = await createDueOccurrence(application);
  const firstClaim = await application.claimOccurrence(worker, {
    scope,
    occurrence_id: occurrence.id,
    expected_occurrence_version: occurrence.occurrence_version,
    expected_schedule_version: occurrence.schedule_version,
    expected_status: occurrence.status,
    worker_id: "dispatcher_1",
    now: "2026-07-23T12:00:00.000Z",
  });
  const retry = await application.dispatchOccurrence(worker, {
    scope,
    occurrence_id: occurrence.id,
    expected_occurrence_version: firstClaim.occurrence_version,
    dispatch_generation: firstClaim.dispatch_generation,
    claim_token: firstClaim.claim_token,
    trace_id: "retry_trace_1",
    now: "2026-07-23T12:00:01.000Z",
  });
  assert.equal(retry.status, "retry_wait");
  assert.equal(retry.dispatch_error_class, "retryable_rate_limited");
  assert.ok(Date.parse(retry.next_retry_at) > Date.parse(retry.updated_at));
  await assert.rejects(
    application.claimOccurrence(worker, {
      scope,
      occurrence_id: occurrence.id,
      expected_occurrence_version: retry.occurrence_version,
      expected_schedule_version: retry.schedule_version,
      expected_status: retry.status,
      worker_id: "dispatcher_early",
      now: "2026-07-23T12:00:01.500Z",
    }),
    (error) =>
      error instanceof TimerApplicationErrorV1 &&
      error.code === "claim_conflict",
  );
  const secondClaim = await application.claimOccurrence(worker, {
    scope,
    occurrence_id: occurrence.id,
    expected_occurrence_version: retry.occurrence_version,
    expected_schedule_version: retry.schedule_version,
    expected_status: retry.status,
    worker_id: "dispatcher_2",
    now: "2026-07-23T13:00:00.000Z",
  });
  const failed = await application.dispatchOccurrence(worker, {
    scope,
    occurrence_id: occurrence.id,
    expected_occurrence_version: secondClaim.occurrence_version,
    dispatch_generation: secondClaim.dispatch_generation,
    claim_token: secondClaim.claim_token,
    trace_id: "retry_trace_2",
    now: "2026-07-23T13:00:01.000Z",
  });
  assert.equal(failed.status, "failed");
  const dlq = await repository.transact((state) => [...state.dlq]);
  assert.equal(dlq.length, 1);
  assert.equal(dlq[0].classification, "retryable_rate_limited");
  const durableState = await repository.transact((state) =>
    JSON.stringify({
      schedules: [...state.schedules.values()],
      occurrences: [...state.occurrences.values()],
      dispatch_attempts: state.dispatchAttempts,
      dlq: state.dlq,
      batches: [...state.batches.values()],
    }),
  );
  assert.equal(durableState.includes(secretFailure), false);
  assert.equal(durableState.includes("timer-super-secret"), false);
});
