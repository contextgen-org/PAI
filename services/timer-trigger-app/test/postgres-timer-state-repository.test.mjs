import assert from "node:assert/strict";
import test from "node:test";

import { openVerifiedOwnerPostgresCompositionV1 } from "@pai/persistence";

import {
  TIMER_REPOSITORY_CONTRACT_V1,
} from "../dist/db/permission-manifest.v1.js";
import {
  createPostgresTimerStateRepositoryV1,
} from "../dist/db/postgres-timer-state-repository.v1.js";
import {
  createTimerApplicationWithVerifiedPostgresStateV1,
} from "../dist/timer-application.v1.js";
import { acquireTimerRuntimeDatabaseV1 } from "./postgres-test-runtime.mjs";

const databaseUrl =
  process.env.PAI_TIMER_TEST_DATABASE_URL ??
  process.env.PAI_TEST_DATABASE_URL;

test(
  "PostgreSQL Timer state survives restart and executes scan and claim fences",
  { skip: databaseUrl === undefined },
  async () => {
    const runtime = await acquireTimerRuntimeDatabaseV1(databaseUrl);
    let composition;
    try {
      composition = await openVerifiedOwnerPostgresCompositionV1(
        TIMER_REPOSITORY_CONTRACT_V1,
        runtime.database_url,
      );
      const suffix = Date.now().toString(36);
      const scope = Object.freeze({
        workspace_id: `workspace_${suffix}`,
        bot_id: `bot_${suffix}`,
        owner_agent_id: `agent_${suffix}`,
        deployment_environment: "local",
        release_channel: "stable",
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
      const triggerProcessor = Object.freeze({
        async submit(request, traceId) {
          return {
            code: "trigger_accepted",
            message: "accepted",
            retryable: false,
            trace_id: traceId,
            details: {
              trigger_id: `trigger_${suffix}`,
              trigger_status: "accepted",
              trigger_process_id: `process_${suffix}`,
              process_phase: "admission",
              process_status: "running",
              wait_reason: null,
              blocked_by_process_id: null,
              priority: "strong",
              action: request.payload.is_catch_up
                ? "dispatch_catch_up_serial"
                : "dispatch",
              reason_code: request.payload.is_catch_up
                ? "timer_catch_up"
                : "timer_due",
              duplicate_replayed: false,
            },
          };
        },
        async getProcess(processId) {
          return {
            id: processId,
            trigger_id: `trigger_${suffix}`,
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
        },
        async checkReadiness() {},
      });
      const application = createTimerApplicationWithVerifiedPostgresStateV1(
        createPostgresTimerStateRepositoryV1(composition),
        composition.deployment,
        triggerProcessor,
      );
      const command = Object.freeze({
        schema_version: "timer.schedule_command.v1",
        method: "timer.remind_at",
        runtime_run_id: `runtime_${suffix}`,
        trigger_process_id: `origin_process_${suffix}`,
        client_request_id: `request_${suffix}`,
        trace_id: `trace_${suffix}`,
        scope,
        timezone: "UTC",
        fire_at: "2035-01-02T12:00:00.000Z",
        message: "durable wake up",
        payload: { source: "postgres_contract" },
      });
      const created = await application.executeCommand(
        writer,
        command,
        new Date("2035-01-02T10:00:00.000Z"),
      );
      assert.equal(created.code, "timer_schedule_created");

      const restarted = createTimerApplicationWithVerifiedPostgresStateV1(
        createPostgresTimerStateRepositoryV1(composition),
        composition.deployment,
        triggerProcessor,
      );
      const replay = await restarted.executeCommand(
        writer,
        { ...command, trace_id: `trace_replay_${suffix}` },
        new Date("2035-01-02T10:01:00.000Z"),
      );
      assert.equal(replay.duplicate_replayed, true);
      assert.equal(replay.schedule.id, created.schedule.id);

      const due = await restarted.scanDue(worker, {
        scope,
        worker_id: `scanner_${suffix}`,
        checkpoint_id: `default_${suffix}`,
        now: "2035-01-02T12:00:00.000Z",
      });
      assert.equal(due.length, 1);
      const occurrence = due[0];
      const claim = await restarted.claimOccurrence(worker, {
        scope,
        occurrence_id: occurrence.id,
        expected_occurrence_version: occurrence.occurrence_version,
        expected_schedule_version: occurrence.schedule_version,
        expected_status: occurrence.status,
        worker_id: `dispatcher_${suffix}`,
        lease_seconds: 30,
        now: "2035-01-02T12:00:01.000Z",
      });
      assert.equal(claim.occurrence.status, "dispatching");
      assert.equal(claim.occurrence_version, occurrence.occurrence_version + 1);
      assert.equal(claim.dispatch_generation, occurrence.dispatch_generation + 1);
      assert.ok(claim.claim_token.length > 0);

      const dispatched = await restarted.dispatchOccurrence(worker, {
        scope,
        occurrence_id: occurrence.id,
        expected_occurrence_version: claim.occurrence_version,
        dispatch_generation: claim.dispatch_generation,
        claim_token: claim.claim_token,
        trace_id: `dispatch_${suffix}`,
        now: "2035-01-02T12:00:02.000Z",
      });
      assert.equal(dispatched.status, "dispatched");
      assert.equal(dispatched.trigger_process_id, `process_${suffix}`);

      const history = await restarted.query(writer, {
        method: "timer.history",
        runtime_run_id: `runtime_${suffix}`,
        trace_id: `history_${suffix}`,
        scope,
        schedule_id: created.schedule.id,
      });
      assert.equal(history.code, "timer_history_found");
      assert.equal(history.schedule.status, "completed");
      assert.equal(history.schedule.next_fire_at, null);
      assert.equal(history.occurrences[0].status, "dispatched");
      assert.equal(history.occurrences[0].claim_token, null);
    } finally {
      try {
        await composition?.close();
      } finally {
        await runtime.release();
      }
    }
  },
);
