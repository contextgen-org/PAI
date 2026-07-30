import { describe, expect, it } from "vitest";

import type {
  AdmitTriggerWriterResponseV1,
  TimerTriggerSubmitRequestV1,
  TriggerProcessQueryDetailsV1,
  TriggerSubmitResponseV1,
} from "@pai/contracts";
import {
  createTriggerAdmissionApplicationV1,
  InvalidAdmitTriggerCommandError,
  type TriggerProcessorOwnerDatabaseV1,
  type VerifiedTriggerIngressV1,
} from "@pai/trigger-processor";
import {
  InMemoryTimerStateRepositoryV1,
  TimerApplicationErrorV1,
  TimerApplicationV1,
  TimerDownstreamErrorV1,
  type TimerPrincipalV1,
  type TimerScopeV1,
  type TimerTriggerProcessorPortV1,
} from "@pai/timer-trigger-app";

const scope = Object.freeze({
  workspace_id: "workspace-system-e2e",
  bot_id: "bot-system-e2e",
  owner_agent_id: "agent-system-e2e",
  deployment_environment: "dev",
  release_channel: "stable",
} satisfies TimerScopeV1);

const writer = Object.freeze({
  caller: "action_runtime",
  capabilities: Object.freeze(["timer.read", "timer.write"]),
  scope,
} satisfies TimerPrincipalV1);

const worker = Object.freeze({
  caller: "timer_trigger_app",
  capabilities: Object.freeze([
    "timer.worker.catch_up",
    "timer.worker.dispatch",
    "timer.worker.scan",
  ]),
  scope,
} satisfies TimerPrincipalV1);

const timerIngress = {
  authentication_kind: "pai_workload_jwt",
  credential: {
    claims: {
      iss: "pai-workload",
      sub: "timer_trigger_app",
      aud: "trigger_processor",
      jti: "credential-system-e2e",
      iat: 1_784_000_000,
      nbf: 1_784_000_000,
      exp: 1_900_000_000,
      capability: ["trigger.submit.timer"],
      scope_kind: "bot",
      ...scope,
    },
    protectedHeader: {
      alg: "EdDSA",
      kid: "workload-key-system-e2e",
      typ: "JWT",
    },
  },
} satisfies VerifiedTriggerIngressV1;

interface AdmissionCommitV1 {
  readonly trigger_id: string;
  readonly process_id: string;
  readonly request_hash: string;
}

function admissionDatabase(
  commits: Map<string, AdmissionCommitV1>,
): TriggerProcessorOwnerDatabaseV1 {
  const database = {
    repository: {} as never,
    deployment: {} as never,
    unit_of_work: {
      owner_service: "trigger_processor",
      async withTransaction(request: any, work: any) {
        return work(
          {
            owner_service: "trigger_processor",
            transaction_id: `tx:${request.idempotency_key}`,
          },
          {
            owner: {
              async executeWriter(
                _transaction: unknown,
                writerRequest: any,
              ) {
                if (writerRequest.writer !== "create_trigger_admission_v1") {
                  throw new Error(
                    `unexpected Trigger owner writer ${writerRequest.writer}`,
                  );
                }
                const args = writerRequest.arguments as Record<
                  string,
                  unknown
                >;
                const key = String(args["p_idempotency_key"]);
                const requestHash = String(args["p_request_hash"]);
                const existing = commits.get(key);
                if (
                  existing !== undefined &&
                  existing.request_hash !== requestHash
                ) {
                  throw new Error("owner idempotency request drift");
                }
                const committed =
                  existing ??
                  Object.freeze({
                    trigger_id: String(args["p_trigger_id"]),
                    process_id: String(args["p_process_id"]),
                    request_hash: requestHash,
                  });
                commits.set(key, committed);
                return {
                  code:
                    existing === undefined
                      ? "trigger_accepted"
                      : "duplicate_replayed",
                  message:
                    existing === undefined
                      ? "accepted"
                      : "replayed committed admission",
                  retryable: false,
                  trace_id: String(args["p_trace_id"]),
                  details: {
                    trigger_id: committed.trigger_id,
                    trigger_status: "accepted",
                    trigger_process_id: committed.process_id,
                    process_phase: "admission",
                    process_status: "running",
                    wait_reason: null,
                    blocked_by_process_id: null,
                    priority: "strong",
                    action: "dispatch",
                    reason_code: "timer_due",
                    duplicate_replayed: existing !== undefined,
                  },
                } satisfies AdmitTriggerWriterResponseV1;
              },
            },
          },
        );
      },
    },
  };
  return database as unknown as TriggerProcessorOwnerDatabaseV1;
}

function scheduleCommand(
  overrides: Readonly<{
    runtime_run_id?: string;
    trigger_process_id?: string;
    client_request_id?: string;
    trace_id?: string;
    fire_at?: string;
    message?: string;
  }> = {},
) {
  return {
    schema_version: "timer.schedule_command.v1",
    method: "timer.remind_at",
    runtime_run_id: overrides.runtime_run_id ?? "runtime-origin",
    trigger_process_id:
      overrides.trigger_process_id ?? "process-origin",
    client_request_id:
      overrides.client_request_id ?? "timer-command-1",
    trace_id: overrides.trace_id ?? "trace-system-e2e",
    scope,
    timezone: "UTC",
    fire_at: overrides.fire_at ?? "2026-07-24T04:00:00.000Z",
    message: overrides.message ?? "run the durable system E2E",
    payload: { suite: "day19" },
  } as const;
}

function triggerProcessProjection(
  processId: string,
  triggerId: string,
  state:
    | Readonly<{
        phase: "admission";
        status: "waiting" | "running";
        reason_code:
          | "catch_up_foreground_busy"
          | "timer_catch_up"
          | "timer_due";
      }>
    | Readonly<{
        phase: "closed";
        status: "completed";
        reason_code: "execution_completed";
      }>,
): TriggerProcessQueryDetailsV1 {
  const closed = state.phase === "closed";
  return {
    id: processId,
    trigger_id: triggerId,
    ...scope,
    runtime_run_id: closed ? `runtime:${processId}` : null,
    phase: state.phase,
    status: state.status,
    terminal_reason: closed ? "completed" : null,
    terminal_outcome: closed ? "executed" : null,
    terminal_outcome_finalized_at: closed
      ? "2026-07-24T04:05:00.000Z"
      : null,
    successor_process_id: null,
    snapshot_transfer_ref: null,
    boundary_system_event_ref: null,
    canonical_reason_code: closed ? state.reason_code : null,
    reason_code: state.reason_code,
    cooldown_until: null,
    snapshot_retention_until: "2026-08-24T04:00:00.000Z",
    process_snapshot_identity: null,
    context_snapshot_identity: null,
    snapshot_watermark: closed ? 4 : 1,
    meta_job_id: closed ? `meta:${processId}` : null,
    meta_status: closed ? "completed" : "not_enqueued",
    meta_summary_ref: null,
    observation_finalized: closed,
  };
}

describe("Timer application to Trigger Processor admission", () => {
  it("[Day19 P0 #2/#6-outbox, process-internal] converges on one TP identity after commit-then-disconnect and Timer app restart", async () => {
    const commits = new Map<string, AdmissionCommitV1>();
    let generated = 0;
    const admission = createTriggerAdmissionApplicationV1(
      admissionDatabase(commits),
      {
        generateId: () => {
          generated += 1;
          return generated % 2 === 1
            ? `trigger-system-${Math.ceil(generated / 2)}`
            : `process-system-${generated / 2}`;
        },
      },
    );
    const submissions: TimerTriggerSubmitRequestV1[] = [];
    let disconnectAfterFirstCommit = true;
    const repository = new InMemoryTimerStateRepositoryV1();
    const triggerProcessor: TimerTriggerProcessorPortV1 = {
        async submit(request, traceId) {
          submissions.push(structuredClone(request));
          const response = await admission.admit(timerIngress, {
            ...request,
            trace_id: traceId,
          });
          if (disconnectAfterFirstCommit) {
            disconnectAfterFirstCommit = false;
            throw new TimerDownstreamErrorV1(
              "retryable_transient",
              "connection closed after Trigger owner commit",
            );
          }
          if (
            response.code !== "trigger_accepted" &&
            response.code !== "duplicate_replayed"
          ) {
            throw new TimerDownstreamErrorV1(
              "downstream_rejected",
              `unexpected timer admission response ${response.code}`,
            );
          }
          return response as TriggerSubmitResponseV1;
        },
        async getProcess(
          processId: string,
          requestedScope: TimerScopeV1,
          _traceId: string,
        ): Promise<TriggerProcessQueryDetailsV1> {
          expect(requestedScope).toEqual(scope);
          const committed = [...commits.values()].find(
            (candidate) => candidate.process_id === processId,
          );
          if (committed === undefined) {
            throw new Error(`missing committed process ${processId}`);
          }
          return triggerProcessProjection(processId, committed.trigger_id, {
            phase: "admission",
            status: "running",
            reason_code: "timer_due",
          });
        },
      };
    const createTimerApplication = () =>
      new TimerApplicationV1(repository, triggerProcessor, {
        base_retry_delay_ms: 10,
        max_retry_delay_ms: 10,
        max_dispatch_attempts: 3,
      });
    let timer = createTimerApplication();

    await timer.executeCommand(
      writer,
      scheduleCommand(),
      new Date("2026-07-24T03:00:00.000Z"),
    );
    const [due] = await timer.scanDue(worker, {
      scope,
      worker_id: "timer-scanner-system",
      checkpoint_id: "timer-system-e2e",
      now: "2026-07-24T04:00:00.000Z",
    });
    expect(due).toBeDefined();

    const firstClaim = await timer.claimOccurrence(worker, {
      scope,
      occurrence_id: due!.id,
      expected_occurrence_version: due!.occurrence_version,
      expected_schedule_version: due!.schedule_version,
      expected_status: "pending",
      worker_id: "timer-dispatcher-system",
      lease_seconds: 30,
      now: "2026-07-24T04:00:00.000Z",
    });
    const retryWait = await timer.dispatchOccurrence(worker, {
      scope,
      occurrence_id: due!.id,
      expected_occurrence_version: firstClaim.occurrence_version,
      dispatch_generation: firstClaim.dispatch_generation,
      claim_token: firstClaim.claim_token,
      trace_id: "trace-dispatch-first",
      now: "2026-07-24T04:00:01.000Z",
    });
    expect(retryWait).toMatchObject({
      status: "retry_wait",
      attempt_count: 1,
      dispatch_error_class: "retryable_transient",
    });
    expect(retryWait.next_retry_at).not.toBeNull();
    expect(commits).toHaveLength(1);

    timer = createTimerApplication();
    const retryAt = new Date(Date.parse(retryWait.next_retry_at!) + 1);
    const replayClaim = await timer.claimOccurrence(worker, {
      scope,
      occurrence_id: retryWait.id,
      expected_occurrence_version: retryWait.occurrence_version,
      expected_schedule_version: retryWait.schedule_version,
      expected_status: "retry_wait",
      worker_id: "timer-dispatcher-system",
      lease_seconds: 30,
      now: retryAt.toISOString(),
    });
    const dispatched = await timer.dispatchOccurrence(worker, {
      scope,
      occurrence_id: retryWait.id,
      expected_occurrence_version: replayClaim.occurrence_version,
      dispatch_generation: replayClaim.dispatch_generation,
      claim_token: replayClaim.claim_token,
      trace_id: "trace-dispatch-replay",
      now: new Date(retryAt.getTime() + 1).toISOString(),
    });

    const [committed] = commits.values();
    expect(dispatched).toMatchObject({
      status: "dispatched",
      trigger_id: committed!.trigger_id,
      trigger_process_id: committed!.process_id,
      dispatch_error_class: "idempotency_replayed",
    });
    expect(submissions).toHaveLength(2);
    expect(submissions[1]).toEqual(submissions[0]);
    expect(submissions[0]!.dedupe_key).toBe(
      `timer:${due!.occurrence_key}`,
    );
    expect(generated).toBe(4);
  });

  it("[Day19 P0 #3, process-internal] preserves TP owner Strong-FIFO decisions and releases catch-up occurrences one at a time", async () => {
    const processStates = new Map<string, TriggerProcessQueryDetailsV1>();
    const admissionDecisions: Array<
      Readonly<{
        process_id: string;
        occurrence_id: string;
        action: "enqueue_strong_fifo" | "dispatch_catch_up_serial";
        reason_code:
          | "catch_up_foreground_busy"
          | "timer_catch_up";
        blocked_by_process_id: string | null;
        admission_request: unknown;
      }>
    > = [];
    let generated = 0;
    let foregroundProcessId: string | null = "process-foreground";
    const database = {
      repository: {} as never,
      deployment: {} as never,
      unit_of_work: {
        owner_service: "trigger_processor",
        async withTransaction(request: any, work: any) {
          return work(
            {
              owner_service: "trigger_processor",
              transaction_id: `tx:${request.idempotency_key}`,
            },
            {
              owner: {
                async executeWriter(
                  _transaction: unknown,
                  writerRequest: any,
                ) {
                  if (
                    writerRequest.writer !==
                    "create_trigger_admission_v1"
                  ) {
                    throw new Error(
                      `unexpected Trigger owner writer ${writerRequest.writer}`,
                    );
                  }
                  const args = writerRequest.arguments as Record<
                    string,
                    any
                  >;
                  const payload = args["p_payload"] as
                    TimerTriggerSubmitRequestV1["payload"];
                  expect(args["p_admission_request"]).toEqual({
                    is_catch_up: true,
                    catch_up_batch_id: payload.catch_up_batch_id,
                    trusted_strong_hint: false,
                    priority_hint: null,
                    explicit_interrupt: false,
                    requested_explicit_interrupt: false,
                  });
                  const processId = String(args["p_process_id"]);
                  const blockedBy = foregroundProcessId;
                  const action =
                    blockedBy === null
                      ? ("dispatch_catch_up_serial" as const)
                      : ("enqueue_strong_fifo" as const);
                  const reasonCode =
                    blockedBy === null
                      ? ("timer_catch_up" as const)
                      : ("catch_up_foreground_busy" as const);
                  admissionDecisions.push({
                    process_id: processId,
                    occurrence_id: payload.occurrence_id,
                    action,
                    reason_code: reasonCode,
                    blocked_by_process_id: blockedBy,
                    admission_request: structuredClone(
                      args["p_admission_request"],
                    ),
                  });
                  processStates.set(
                    processId,
                    triggerProcessProjection(
                      processId,
                      String(args["p_trigger_id"]),
                      blockedBy === null
                        ? {
                            phase: "admission",
                            status: "running",
                            reason_code: "timer_catch_up",
                          }
                        : {
                            phase: "admission",
                            status: "waiting",
                            reason_code: "catch_up_foreground_busy",
                          },
                    ),
                  );
                  const response: AdmitTriggerWriterResponseV1 =
                    blockedBy === null
                      ? {
                          code: "trigger_accepted",
                          message: "accepted",
                          retryable: false,
                          trace_id: String(args["p_trace_id"]),
                          details: {
                            trigger_id: String(args["p_trigger_id"]),
                            trigger_status: "accepted",
                            trigger_process_id: processId,
                            process_phase: "admission",
                            process_status: "running",
                            wait_reason: null,
                            blocked_by_process_id: null,
                            priority: "strong",
                            action: "dispatch_catch_up_serial",
                            reason_code: "timer_catch_up",
                            duplicate_replayed: false,
                          },
                        }
                      : {
                          code: "trigger_accepted",
                          message: "accepted",
                          retryable: false,
                          trace_id: String(args["p_trace_id"]),
                          details: {
                            trigger_id: String(args["p_trigger_id"]),
                            trigger_status: "accepted",
                            trigger_process_id: processId,
                            process_phase: "admission",
                            process_status: "waiting",
                            wait_reason: "deferred_strong_queue",
                            blocked_by_process_id: blockedBy,
                            priority: "strong",
                            action: "enqueue_strong_fifo",
                            reason_code: "catch_up_foreground_busy",
                            duplicate_replayed: false,
                          },
                        };
                  return response;
                },
              },
            },
          );
        },
      },
    } as unknown as TriggerProcessorOwnerDatabaseV1;
    const admission = createTriggerAdmissionApplicationV1(database, {
      generateId: () => {
        generated += 1;
        return generated % 2 === 1
          ? `trigger-catch-up-${Math.ceil(generated / 2)}`
          : `process-catch-up-${generated / 2}`;
      },
    });
    const submissions: TimerTriggerSubmitRequestV1[] = [];
    const timer = new TimerApplicationV1(
      new InMemoryTimerStateRepositoryV1(),
      {
        async submit(request, traceId) {
          submissions.push(structuredClone(request));
          return admission.admit(timerIngress, {
            ...request,
            trace_id: traceId,
          }) as Promise<TriggerSubmitResponseV1>;
        },
        async getProcess(processId) {
          const process = processStates.get(processId);
          if (process === undefined) {
            throw new Error(`missing catch-up process ${processId}`);
          }
          return process;
        },
      },
    );

    await timer.executeCommand(
      writer,
      scheduleCommand({
        runtime_run_id: "runtime-catch-up-1",
        trigger_process_id: "origin-catch-up-1",
        client_request_id: "timer-catch-up-command-1",
        trace_id: "trace-catch-up-1",
        fire_at: "2026-07-24T03:58:00.000Z",
      }),
      new Date("2026-07-24T03:50:00.000Z"),
    );
    await timer.executeCommand(
      writer,
      scheduleCommand({
        runtime_run_id: "runtime-catch-up-2",
        trigger_process_id: "origin-catch-up-2",
        client_request_id: "timer-catch-up-command-2",
        trace_id: "trace-catch-up-2",
        fire_at: "2026-07-24T03:59:00.000Z",
      }),
      new Date("2026-07-24T03:50:00.000Z"),
    );
    const due = await timer.scanDue(worker, {
      scope,
      worker_id: "timer-catch-up-scanner",
      checkpoint_id: "timer-catch-up-system-e2e",
      now: "2026-07-24T04:00:00.000Z",
    });
    expect(due).toHaveLength(2);
    const batchId = due[0]!.catch_up_batch_id;
    expect(batchId).not.toBeNull();
    if (batchId === null) {
      throw new Error("scanner did not atomically create its catch-up batch");
    }
    expect(due[1]!.catch_up_batch_id).toBe(batchId);
    const firstReady = await timer.advanceCatchUpBatch(worker, {
      scope,
      batch_id: batchId,
      expected_status: "running",
      expected_cursor_occurrence_id: null,
      expected_last_occurrence_id: null,
      expected_last_trigger_process_id: null,
      trace_id: "trace-catch-up-release-first",
      now: "2026-07-24T04:00:01.000Z",
    });
    expect(firstReady.outcome).toBe("ready");
    if (firstReady.outcome !== "ready") {
      throw new Error("first catch-up occurrence was not released");
    }
    const firstOccurrence = firstReady.occurrence;
    if (firstOccurrence === null) {
      throw new Error("first catch-up release omitted its occurrence");
    }
    expect(firstOccurrence.id).toBe(due[0]!.id);
    await expect(
      timer.claimOccurrence(worker, {
        scope,
        occurrence_id: due[1]!.id,
        expected_occurrence_version: due[1]!.occurrence_version,
        expected_schedule_version: due[1]!.schedule_version,
        expected_status: "pending",
        worker_id: "timer-catch-up-bypass",
        now: "2026-07-24T04:00:02.500Z",
      }),
    ).rejects.toMatchObject({
      code: "claim_conflict",
    } satisfies Partial<TimerApplicationErrorV1>);
    const firstClaim = await timer.claimOccurrence(worker, {
      scope,
      occurrence_id: firstOccurrence.id,
      expected_occurrence_version:
        firstOccurrence.occurrence_version,
      expected_schedule_version: firstOccurrence.schedule_version,
      expected_status: "pending",
      worker_id: "timer-catch-up-worker",
      now: "2026-07-24T04:00:03.000Z",
    });
    const firstDispatched = await timer.dispatchOccurrence(worker, {
      scope,
      occurrence_id: firstOccurrence.id,
      expected_occurrence_version: firstClaim.occurrence_version,
      dispatch_generation: firstClaim.dispatch_generation,
      claim_token: firstClaim.claim_token,
      trace_id: "trace-catch-up-dispatch-first",
      now: "2026-07-24T04:00:04.000Z",
    });
    expect(admissionDecisions[0]).toMatchObject({
      occurrence_id: firstOccurrence.id,
      action: "enqueue_strong_fifo",
      reason_code: "catch_up_foreground_busy",
      blocked_by_process_id: "process-foreground",
    });
    expect(admissionDecisions.map(({ action }) => action)).toEqual([
      "enqueue_strong_fifo",
    ]);

    const stillBlocked = await timer.advanceCatchUpBatch(worker, {
      scope,
      batch_id: batchId,
      expected_status: "running",
      expected_cursor_occurrence_id: firstDispatched.id,
      expected_last_occurrence_id: firstDispatched.id,
      expected_last_trigger_process_id:
        firstDispatched.trigger_process_id,
      trace_id: "trace-catch-up-still-blocked",
      now: "2026-07-24T04:00:05.000Z",
    });
    expect(stillBlocked).toMatchObject({
      outcome: "waiting",
      occurrence: null,
    });
    expect(submissions).toHaveLength(1);

    processStates.set(
      firstDispatched.trigger_process_id!,
      triggerProcessProjection(
        firstDispatched.trigger_process_id!,
        firstDispatched.trigger_id!,
        {
          phase: "closed",
          status: "completed",
          reason_code: "execution_completed",
        },
      ),
    );
    foregroundProcessId = null;
    const secondReady = await timer.advanceCatchUpBatch(worker, {
      scope,
      batch_id: batchId,
      expected_status: "running",
      expected_cursor_occurrence_id:
        stillBlocked.batch.cursor_occurrence_id,
      expected_last_occurrence_id:
        stillBlocked.batch.last_occurrence_id,
      expected_last_trigger_process_id:
        stillBlocked.batch.last_trigger_process_id,
      trace_id: "trace-catch-up-release-second",
      now: "2026-07-24T04:00:06.000Z",
    });
    expect(secondReady.outcome).toBe("ready");
    if (secondReady.outcome !== "ready") {
      throw new Error("second catch-up occurrence was not released");
    }
    const secondOccurrence = secondReady.occurrence;
    if (secondOccurrence === null) {
      throw new Error("second catch-up release omitted its occurrence");
    }
    expect(secondOccurrence.id).toBe(due[1]!.id);
    const secondClaim = await timer.claimOccurrence(worker, {
      scope,
      occurrence_id: secondOccurrence.id,
      expected_occurrence_version:
        secondOccurrence.occurrence_version,
      expected_schedule_version:
        secondOccurrence.schedule_version,
      expected_status: "pending",
      worker_id: "timer-catch-up-worker",
      now: "2026-07-24T04:00:07.000Z",
    });
    const secondDispatched = await timer.dispatchOccurrence(worker, {
      scope,
      occurrence_id: secondOccurrence.id,
      expected_occurrence_version: secondClaim.occurrence_version,
      dispatch_generation: secondClaim.dispatch_generation,
      claim_token: secondClaim.claim_token,
      trace_id: "trace-catch-up-dispatch-second",
      now: "2026-07-24T04:00:08.000Z",
    });
    expect(admissionDecisions[1]).toMatchObject({
      occurrence_id: secondOccurrence.id,
      action: "dispatch_catch_up_serial",
      reason_code: "timer_catch_up",
      blocked_by_process_id: null,
    });
    expect(submissions).toHaveLength(2);
    expect(
      submissions.every(
        (request) =>
          request.payload.is_catch_up === true &&
          request.payload.catch_up_batch_id === batchId,
      ),
    ).toBe(true);

    processStates.set(
      secondDispatched.trigger_process_id!,
      triggerProcessProjection(
        secondDispatched.trigger_process_id!,
        secondDispatched.trigger_id!,
        {
          phase: "closed",
          status: "completed",
          reason_code: "execution_completed",
        },
      ),
    );
    const completed = await timer.advanceCatchUpBatch(worker, {
      scope,
      batch_id: batchId,
      expected_status: "running",
      expected_cursor_occurrence_id: secondDispatched.id,
      expected_last_occurrence_id: secondDispatched.id,
      expected_last_trigger_process_id:
        secondDispatched.trigger_process_id,
      trace_id: "trace-catch-up-complete",
      now: "2026-07-24T04:00:09.000Z",
    });
    expect(completed).toMatchObject({
      outcome: "completed",
      batch: {
        status: "completed",
        reason: "all_occurrences_dispatched",
      },
      occurrence: null,
    });
  });

  it("[Day19 P0 #7] rejects a credential or Timer caller whose complete bot scope drifts", async () => {
    const admission = createTriggerAdmissionApplicationV1(
      admissionDatabase(new Map()),
      {
        generateId: (() => {
          const ids = ["trigger-cross-scope", "process-cross-scope"];
          return () => ids.shift() ?? "unexpected-id";
        })(),
      },
    );
    const request: TimerTriggerSubmitRequestV1 = {
      workspace_id: scope.workspace_id,
      bot_id: scope.bot_id,
      owner_agent_id: scope.owner_agent_id,
      deployment_environment: scope.deployment_environment,
      release_channel: scope.release_channel,
      source: "timer",
      actor_type: "system",
      actor_id: "timer_app",
      payload: {
        ...scope,
        schedule_id: "schedule-cross-scope",
        schedule_version: 1,
        occurrence_id: "occurrence-cross-scope",
        local_date: "2026-07-24",
        local_time: "04:00:00",
        timezone: "UTC",
        scheduled_for: "2026-07-24T04:00:00.000Z",
        occurrence_key: `v1:${"a".repeat(43)}`,
        message: "scope check",
        is_catch_up: false,
        catch_up_batch_id: null,
        missed_window_summary: null,
      },
      dedupe_key: `timer:v1:${"a".repeat(43)}`,
    };
    await expect(
      admission.admit(
        {
          ...timerIngress,
          credential: {
            ...timerIngress.credential,
            claims: {
              ...timerIngress.credential.claims,
              owner_agent_id: "agent-other",
            },
          },
        },
        { ...request, trace_id: "trace-cross-scope" },
      ),
    ).rejects.toMatchObject({
      kind: "authorization_scope_mismatch",
    } satisfies Partial<InvalidAdmitTriggerCommandError>);

    const timer = new TimerApplicationV1(
      new InMemoryTimerStateRepositoryV1(),
      {
        async submit() {
          throw new Error("must not dispatch");
        },
        async getProcess() {
          throw new Error("must not query");
        },
      },
    );
    await expect(
      timer.executeCommand(
        {
          ...writer,
          scope: { ...scope, owner_agent_id: "agent-other" },
        },
        scheduleCommand(),
        new Date("2026-07-24T03:00:00.000Z"),
      ),
    ).rejects.toMatchObject({
      code: "forbidden",
    } satisfies Partial<TimerApplicationErrorV1>);
  });
});
