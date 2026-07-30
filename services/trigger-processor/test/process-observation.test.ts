import type {
  TriggerProcessQueryDetailsV1,
  TriggerProcessSseEventV1,
} from "@pai/contracts";
import { describe, expect, it } from "vitest";

import {
  TriggerProcessObservationErrorV1,
  createTriggerProcessObservationApplicationV1,
  delegatedSnapshotIdentityAccessV1,
  type TriggerProcessObservationRepositoryV1,
} from "../src/application/process-observation.v1.js";
import { createTriggerProcessObservationRepositoryV1 } from "../src/db/process-observation-repository.v1.js";
import { processDetailsFixtureV1 } from "./contracts/process-query.contract.js";
import { runtimeSseEventFixtureV1 } from "./contracts/process-sse.contract.js";

const principal = {
  principal_type: "developer",
  principal_id: "developer-1",
  credential_expires_at_epoch_seconds: 253_402_300_799,
} as const;

function repositoryFixture(
  details: TriggerProcessQueryDetailsV1,
  events: readonly TriggerProcessSseEventV1[] = [],
): TriggerProcessObservationRepositoryV1 {
  return {
    async readAuthorizedProcess() {
      return {
        outcome: "found",
        details,
        replay_cutoff: 0,
        observation_closed:
          details.terminal_outcome_finalized_at !== null &&
          details.observation_finalized,
      };
    },
    async readAuthorizedEventPage(request) {
      return {
        outcome: "found",
        current_watermark: details.snapshot_watermark,
        replay_cutoff: 0,
        events: events
          .filter(({ append_sequence_no }) =>
            append_sequence_no > request.after_append_sequence_no,
          )
          .slice(0, request.limit),
        observation_closed:
          details.terminal_outcome_finalized_at !== null &&
          details.observation_finalized,
        details,
      };
    },
  };
}

async function frames(stream: AsyncIterable<string>): Promise<string[]> {
  const result: string[] = [];
  for await (const frame of stream) result.push(frame);
  return result;
}

describe("Trigger Process observation application", () => {
  it("orders the PostgreSQL event aggregate by the durable append sequence", async () => {
    const queries: string[] = [];
    const queryValues: unknown[][] = [];
    const repository = createTriggerProcessObservationRepositoryV1({
      async query(sql: string, values?: readonly unknown[]) {
        queries.push(sql);
        queryValues.push([...(values ?? [])]);
        return {
          rows: [
            {
              authorization_state: "not_found",
              current_watermark: "0",
              replay_cutoff: "0",
              observation_closed: false,
              current_snapshot_identity_consistent: true,
              details: null,
              events: [],
            },
          ],
        };
      },
    } as never);

    await repository.readAuthorizedEventPage({
      process_id: "tp-1",
      principal,
      permission_scope: "trigger.process.events.read",
      after_append_sequence_no: 0,
      limit: 10,
    });
    expect(queries[0]).toMatch(
      /jsonb_agg\(event ORDER BY append_sequence_no\)/u,
    );
    expect(queries[0]).toMatch(
      /active_compensation_count[\s\S]+active_repair_count[\s\S]+trigger_snapshot_repair_jobs[\s\S]+trigger_process_work_items/u,
    );
    expect(queries[0]).toMatch(
      /current_snapshot_id[\s\S]+trigger_process_snapshots[\s\S]+process_snapshot_identity[\s\S]+context_snapshot_identity/u,
    );
    expect(queries[0]).toMatch(
      /process_snapshot_status[\s\S]+process_snapshot_retention_until\s*<=\s*transaction_timestamp\(\)[\s\S]+context_snapshot_retention_until\s*<=\s*transaction_timestamp\(\)/u,
    );
    expect(queries[0]).toMatch(
      /snapshot_retention_until\s*<=\s*transaction_timestamp\(\)[\s\S]+o\.retention_until\s*>\s*transaction_timestamp\(\)/u,
    );
    expect(queries[0]).not.toMatch(/clock_timestamp\(\)/u);
    expect(queries[0]).toMatch(
      /'process_snapshot_identity', CASE\s+WHEN NOT \$6::boolean/u,
    );
    expect(queries[0]).toMatch(
      /'context_snapshot_identity', CASE\s+WHEN NOT \$7::boolean/u,
    );
    expect(queries[0]).toMatch(
      /append_sequence_no > \$8::bigint[\s\S]+LIMIT \$9::integer/u,
    );
    expect(queries[0]).toMatch(
      /WITH target AS MATERIALIZED \(\s+SELECT\s+p\.id,\s+p\.trigger_id,/u,
    );
    expect(queries[0]).not.toMatch(/SELECT p\.\*/u);
    expect(queryValues[0]?.slice(5, 9)).toEqual([false, false, 0, 10]);
    expect(queries[0]).not.toMatch(
      /LEFT JOIN trigger_processor\.trigger_process_snapshots[\s\S]+AND ps\.status = 'current'[\s\S]+LEFT JOIN trigger_processor\.trigger_snapshot_append_cursors/u,
    );
  });

  it("fails closed when the current snapshot pointer cannot produce its persisted identity", async () => {
    const repository = createTriggerProcessObservationRepositoryV1({
      async query() {
        return {
          rows: [
            {
              authorization_state: "found",
              current_watermark: "184",
              replay_cutoff: "0",
              observation_closed: false,
              current_snapshot_identity_consistent: false,
              details: processDetailsFixtureV1,
              events: [],
            },
          ],
        };
      },
    } as never);

    await expect(
      repository.readAuthorizedProcess({
        process_id: "tp-1",
        principal,
        permission_scope: "trigger.process.read",
      }),
    ).rejects.toThrow(/snapshot identity is inconsistent/u);
  });

  it("rejects proxy-backed owner projections before recursive contract traversal", async () => {
    let proxyTrapCalls = 0;
    const proxiedDetails = new Proxy(processDetailsFixtureV1, {
      getPrototypeOf() {
        proxyTrapCalls += 1;
        return Object.prototype;
      },
    });
    const app = createTriggerProcessObservationApplicationV1({
      async readAuthorizedProcess() {
        return {
          outcome: "found",
          details: proxiedDetails,
          replay_cutoff: 0,
          observation_closed: false,
        };
      },
      async readAuthorizedEventPage() {
        throw new Error("not used");
      },
    });

    await expect(
      app.getProcess(principal, "tp-1", "trace-1"),
    ).rejects.toMatchObject({
      code: "projection_contract_drift",
    });
    expect(proxyTrapCalls).toBe(0);
  });

  it("returns process and durable watermark from the same authorized snapshot", async () => {
    const app = createTriggerProcessObservationApplicationV1(
      repositoryFixture(processDetailsFixtureV1),
    );
    await expect(app.getProcess(principal, "tp-1", "trace-1")).resolves.toMatchObject({
      code: "trigger_process_found",
      details: {
        id: "tp-1",
        snapshot_watermark: 184,
        process_snapshot_identity: null,
        context_snapshot_identity: null,
      },
    });
  });

  it("pins SSE request and delegated principal before the first owner read", async () => {
    let releaseInitialRead!: () => void;
    const initialReadGate = new Promise<void>((resolve) => {
      releaseInitialRead = resolve;
    });
    const processReads: unknown[] = [];
    const pageReads: unknown[] = [];
    const repository: TriggerProcessObservationRepositoryV1 = {
      async readAuthorizedProcess(request) {
        processReads.push(request);
        await initialReadGate;
        return {
          outcome: "found",
          details: processDetailsFixtureV1,
          replay_cutoff: 0,
          observation_closed: false,
        };
      },
      async readAuthorizedEventPage(request) {
        pageReads.push(request);
        return {
          outcome: "found",
          current_watermark:
            processDetailsFixtureV1.snapshot_watermark,
          replay_cutoff: 0,
          events: [],
          observation_closed: true,
          details: processDetailsFixtureV1,
        };
      },
    };
    const app = createTriggerProcessObservationApplicationV1(repository);
    const mutablePrincipal = { ...principal };
    const mutableRequest = {
      schema_version: "trigger_process_sse_request.v1" as const,
      trigger_process_id: "tp-1",
    };
    const pending = app.streamProcessEvents(
      mutablePrincipal,
      mutableRequest,
      new AbortController().signal,
    );
    mutablePrincipal.principal_id = "mutated-principal";
    mutableRequest.trigger_process_id = "mutated-process";
    releaseInitialRead();

    const stream = await pending;
    await expect(frames(stream)).resolves.toHaveLength(2);
    expect(processReads[0]).toMatchObject({
      process_id: "tp-1",
      principal: { principal_id: principal.principal_id },
    });
    expect(pageReads[0]).toMatchObject({
      process_id: "tp-1",
      principal: { principal_id: principal.principal_id },
    });
    expect(
      Object.isFrozen(
        (pageReads[0] as { principal: object }).principal,
      ),
    ).toBe(true);
  });

  it("exposes each snapshot identity only to its independently granted Observation workload", async () => {
    const processOnlyPrincipal = {
      principal_type: "service",
      principal_id: "observation_gateway",
      credential_expires_at_epoch_seconds: 253_402_300_799,
      signed_bot_scope: {
        workspace_id: "workspace-1",
        bot_id: "bot-1",
        owner_agent_id: "agent-1",
        deployment_environment: "dev",
        release_channel: "stable",
      },
      process_snapshot_identity_grant: {
        capability: "trigger.process.snapshot.resolve",
        purpose: "observation_replay",
      },
    } as const;
    expect(delegatedSnapshotIdentityAccessV1(processOnlyPrincipal)).toEqual({
      process_snapshot: true,
      context_snapshot: false,
    });
    const app = createTriggerProcessObservationApplicationV1(
      repositoryFixture(processDetailsFixtureV1),
    );
    await expect(
      app.getProcess(processOnlyPrincipal, "tp-1", "trace-1"),
    ).resolves.toMatchObject({
      details: {
        process_snapshot_identity:
          processDetailsFixtureV1.process_snapshot_identity,
        context_snapshot_identity: null,
      },
    });

    const contextOnlyPrincipal = {
      principal_type: "service",
      principal_id: "observation_gateway",
      credential_expires_at_epoch_seconds: 253_402_300_799,
      signed_bot_scope: processOnlyPrincipal.signed_bot_scope,
      context_snapshot_identity_grant: {
        capability: "trigger.context_snapshot.resolve",
        purpose: "audit_replay",
      },
    } as const;
    await expect(
      app.getProcess(contextOnlyPrincipal, "tp-1", "trace-context"),
    ).resolves.toMatchObject({
      details: {
        process_snapshot_identity: null,
        context_snapshot_identity:
          processDetailsFixtureV1.context_snapshot_identity,
      },
    });

    const bothPrincipal = {
      ...processOnlyPrincipal,
      context_snapshot_identity_grant: {
        capability: "trigger.context_snapshot.resolve",
        purpose: "audit_replay",
      },
    } as const;
    await expect(
      app.getProcess(bothPrincipal, "tp-1", "trace-2"),
    ).resolves.toMatchObject({
      details: {
        process_snapshot_identity:
          processDetailsFixtureV1.process_snapshot_identity,
        context_snapshot_identity:
          processDetailsFixtureV1.context_snapshot_identity,
      },
    });
  });

  it("does not trust snapshot grants from Timer or an unsigned Observation principal", () => {
    expect(
      delegatedSnapshotIdentityAccessV1({
        principal_type: "service",
        principal_id: "timer_trigger_app",
        credential_expires_at_epoch_seconds: 253_402_300_799,
        signed_bot_scope: {
          workspace_id: "workspace-1",
          bot_id: "bot-1",
          owner_agent_id: "agent-1",
          deployment_environment: "dev",
          release_channel: "stable",
        },
        process_snapshot_identity_grant: {
          capability: "trigger.process.snapshot.resolve",
          purpose: "observation_replay",
        },
      }),
    ).toEqual({ process_snapshot: false, context_snapshot: false });
    expect(
      delegatedSnapshotIdentityAccessV1({
        principal_type: "service",
        principal_id: "observation_gateway",
        credential_expires_at_epoch_seconds: 253_402_300_799,
        context_snapshot_identity_grant: {
          capability: "trigger.context_snapshot.resolve",
          purpose: "audit_replay",
        },
      }),
    ).toEqual({ process_snapshot: false, context_snapshot: false });
  });

  it("fails closed before emitting a semantically invalid owner summary", async () => {
    const app = createTriggerProcessObservationApplicationV1(
      repositoryFixture({
        ...processDetailsFixtureV1,
        status: "failed",
        terminal_outcome: "executed",
      }),
    );
    const stream = await app.streamProcessEvents(
      principal,
      {
        schema_version: "trigger_process_sse_request.v1",
        trigger_process_id: "tp-1",
      },
      new AbortController().signal,
    );
    await expect(frames(stream)).rejects.toMatchObject({
      code: "projection_contract_drift",
    });
  });

  it("rejects a final page whose summary belongs to another process", async () => {
    const repository: TriggerProcessObservationRepositoryV1 = {
      async readAuthorizedProcess() {
        return {
          outcome: "found",
          details: processDetailsFixtureV1,
          replay_cutoff: 0,
          observation_closed: false,
        };
      },
      async readAuthorizedEventPage() {
        return {
          outcome: "found",
          current_watermark:
            processDetailsFixtureV1.snapshot_watermark,
          replay_cutoff: 0,
          events: [],
          observation_closed: true,
          details: {
            ...processDetailsFixtureV1,
            id: "tp-other",
          },
        };
      },
    };
    const stream =
      await createTriggerProcessObservationApplicationV1(
        repository,
      ).streamProcessEvents(
        principal,
        {
          schema_version: "trigger_process_sse_request.v1",
          trigger_process_id: "tp-1",
        },
        new AbortController().signal,
      );
    await expect(frames(stream)).rejects.toMatchObject({
      code: "projection_contract_drift",
    });
  });

  it("replays every durable event after the cursor and then emits final summary", async () => {
    const details = {
      ...processDetailsFixtureV1,
      snapshot_watermark: 57,
    } as const;
    const app = createTriggerProcessObservationApplicationV1(
      repositoryFixture(details, [runtimeSseEventFixtureV1]),
    );
    const stream = await app.streamProcessEvents(
      principal,
      {
        schema_version: "trigger_process_sse_request.v1",
        trigger_process_id: "tp-1",
        start_after_append_sequence_no: 56,
      },
      new AbortController().signal,
    );
    const output = await frames(stream);
    expect(output).toHaveLength(2);
    expect(output[0]).toContain("id: tp-1:57");
    expect(output[0]).toContain('"event_type":"runtime.tool.completed"');
    expect(output[1]).toContain('"event_type":"trigger_process.summary"');
  });

  it("does not emit events fetched after the signed credential expires", async () => {
    let nowMs = 1_000;
    const details = {
      ...processDetailsFixtureV1,
      snapshot_watermark: 57,
    } as const;
    const repository: TriggerProcessObservationRepositoryV1 = {
      async readAuthorizedProcess() {
        return {
          outcome: "found",
          details,
          replay_cutoff: 0,
          observation_closed: false,
        };
      },
      async readAuthorizedEventPage() {
        nowMs = 2_000;
        return {
          outcome: "found",
          current_watermark: 57,
          replay_cutoff: 0,
          events: [runtimeSseEventFixtureV1],
          observation_closed: true,
          details,
        };
      },
    };
    const app = createTriggerProcessObservationApplicationV1(repository, {
      now_ms: () => nowMs,
    });
    const stream = await app.streamProcessEvents(
      {
        ...principal,
        credential_expires_at_epoch_seconds: 2,
      },
      {
        schema_version: "trigger_process_sse_request.v1",
        trigger_process_id: "tp-1",
        start_after_append_sequence_no: 56,
      },
      new AbortController().signal,
    );
    await expect(frames(stream)).resolves.toEqual([]);
  });

  it("rejects a repository row that masquerades as the non-durable summary control frame", async () => {
    const details = {
      ...processDetailsFixtureV1,
      snapshot_watermark: 57,
    } as const;
    const summary = {
      schema_version: "trigger_process_sse_event.v1",
      trigger_process_id: details.id,
      append_sequence_no: 57,
      event_type: "trigger_process.summary",
      occurred_at: "2026-07-13T12:00:05.000Z",
      trace_id: "trace-summary-row",
      observation_summary: {
        phase: details.phase,
        status: details.status,
        reason_code: details.reason_code,
        terminal_outcome: details.terminal_outcome,
        terminal_outcome_finalized_at:
          details.terminal_outcome_finalized_at,
        observation_finalized: details.observation_finalized,
      },
    } as const satisfies TriggerProcessSseEventV1;
    const app = createTriggerProcessObservationApplicationV1(
      repositoryFixture(details, [summary]),
    );
    const stream = await app.streamProcessEvents(
      principal,
      {
        schema_version: "trigger_process_sse_request.v1",
        trigger_process_id: details.id,
        start_after_append_sequence_no: 56,
      },
      new AbortController().signal,
    );
    await expect(frames(stream)).rejects.toMatchObject({
      code: "projection_contract_drift",
    });
  });

  it("fails closed for authorization and invalid retention cursors", async () => {
    const denied: TriggerProcessObservationRepositoryV1 = {
      async readAuthorizedProcess() { return { outcome: "denied" }; },
      async readAuthorizedEventPage() {
        throw new Error("must not be reached");
      },
    };
    const deniedApp = createTriggerProcessObservationApplicationV1(denied);
    await expect(deniedApp.getProcess(principal, "tp-1", "trace-1")).rejects.toMatchObject({
      code: "bot_permission_denied",
    });

    const expired: TriggerProcessObservationRepositoryV1 = {
      async readAuthorizedProcess() {
        return {
          outcome: "found",
          details: { ...processDetailsFixtureV1, snapshot_watermark: 100 },
          replay_cutoff: 50,
          observation_closed: true,
        };
      },
      async readAuthorizedEventPage() {
        throw new Error("must not be reached");
      },
    };
    const expiredApp = createTriggerProcessObservationApplicationV1(expired);
    await expect(
      expiredApp.streamProcessEvents(
        principal,
        {
          schema_version: "trigger_process_sse_request.v1",
          trigger_process_id: "tp-1",
          start_after_append_sequence_no: 49,
        },
        new AbortController().signal,
      ),
    ).rejects.toEqual(
      expect.objectContaining<Partial<TriggerProcessObservationErrorV1>>({
        code: "replay_expired",
      }),
    );
  });

  it("reports a live projection hole as drift instead of falsely returning 410", async () => {
    const details = { ...processDetailsFixtureV1, snapshot_watermark: 10 };
    const repository: TriggerProcessObservationRepositoryV1 = {
      async readAuthorizedProcess() {
        return {
          outcome: "found",
          details,
          replay_cutoff: 0,
          observation_closed: false,
        };
      },
      async readAuthorizedEventPage() {
        return {
          outcome: "found",
          current_watermark: 10,
          replay_cutoff: 0,
          events: [],
          observation_closed: false,
          details,
        };
      },
    };
    const app = createTriggerProcessObservationApplicationV1(repository, {
      poll_interval_ms: 10,
    });
    const stream = await app.streamProcessEvents(
      principal,
      {
        schema_version: "trigger_process_sse_request.v1",
        trigger_process_id: "tp-1",
        start_after_append_sequence_no: 9,
      },
      new AbortController().signal,
    );
    await expect(frames(stream)).rejects.toMatchObject({
      code: "projection_contract_drift",
    });
  });

  it("keeps a finalized process stream open while repair or compensation is active", async () => {
    const details = {
      ...processDetailsFixtureV1,
      snapshot_watermark: 184,
      terminal_outcome_finalized_at: "2026-07-13T12:00:08.000Z",
      observation_finalized: true,
    } as const;
    const controller = new AbortController();
    let pageReads = 0;
    const repository: TriggerProcessObservationRepositoryV1 = {
      async readAuthorizedProcess() {
        return {
          outcome: "found",
          details,
          replay_cutoff: 0,
          observation_closed: false,
        };
      },
      async readAuthorizedEventPage() {
        pageReads += 1;
        controller.abort();
        return {
          outcome: "found",
          current_watermark: details.snapshot_watermark,
          replay_cutoff: 0,
          events: [],
          observation_closed: false,
          details,
        };
      },
    };
    const app = createTriggerProcessObservationApplicationV1(repository, {
      poll_interval_ms: 10,
    });
    const stream = await app.streamProcessEvents(
      principal,
      {
        schema_version: "trigger_process_sse_request.v1",
        trigger_process_id: "tp-1",
      },
      controller.signal,
    );
    await expect(frames(stream)).resolves.toHaveLength(1);
    expect(pageReads).toBe(1);
  });
});
