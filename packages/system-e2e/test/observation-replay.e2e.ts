import { describe, expect, it } from "vitest";

import type {
  MetaExperienceQueryResponseV1,
  MetaJobQueryDetailsV1,
  MetaResultAuditQueryResponseV1,
  QualitySignalListDetailsV1,
  RuntimeRunQueryDetailsV1,
  ToolInvocationListDetailsV1,
  TriggerProcessQueryDetailsV1,
  TriggerProcessSseEventV1,
} from "@pai/contracts";
import {
  createRuntimeQueryApplicationV1,
  type RuntimeQueryPrincipalV1,
  type RuntimeQueryRepositoryV1,
} from "@pai/action-runtime";
import {
  createMetaQueryApplicationV1,
  type MetaQueryPrincipalV1,
  type MetaQueryRepositoryV1,
} from "@pai/meta-cognition";
import {
  InMemoryObservationAccessAuditSpoolV1,
  ObservationApplicationErrorV1,
  ObservationApplicationV1,
  ObservationUpstreamErrorV1,
  type ObservationMetaPortV1,
  type ObservationAccessAuditRecordV1,
  type ObservationPrincipalV1,
  type ObservationRuntimePortV1,
  type ObservationScopeV1,
  type ObservationTriggerProcessorPortV1,
} from "@pai/observation-gateway";
import {
  TriggerProcessObservationErrorV1,
  createTriggerProcessObservationApplicationV1,
  type DelegatedProcessReadPrincipalV1,
  type TriggerProcessObservationRepositoryV1,
} from "@pai/trigger-processor";

const traceId = "trace-system-e2e";
const activeCredentialExpiresAtEpochSeconds = 253_402_300_799;
const scope = Object.freeze({
  workspace_id: "workspace-system-e2e",
  bot_id: "bot-system-e2e",
  owner_agent_id: "agent-system-e2e",
  deployment_environment: "dev",
  release_channel: "stable",
} satisfies ObservationScopeV1);

const process: TriggerProcessQueryDetailsV1 = {
  id: "process-system-e2e",
  trigger_id: "trigger-system-e2e",
  ...scope,
  runtime_run_id: "run-system-e2e",
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
  snapshot_retention_until: "2026-08-24T04:00:00.000Z",
  process_snapshot_identity: null,
  context_snapshot_identity: null,
  snapshot_watermark: 2,
  meta_job_id: "meta-job-system-e2e",
  meta_status: "running",
  meta_summary_ref: null,
  observation_finalized: false,
};

const processEvent: TriggerProcessSseEventV1 = {
  schema_version: "trigger_process_sse_event.v1",
  trigger_process_id: process.id,
  append_sequence_no: 2,
  event_type: "runtime.run.started",
  occurred_at: "2026-07-24T04:00:01.000Z",
  trace_id: traceId,
  observation_summary: {
    runtime_run_id: "run-system-e2e",
    status: "running",
    duration_ms: null,
    reason_code: null,
    error_summary: null,
    artifact_ref: null,
  },
};

const runtimeProjection: RuntimeRunQueryDetailsV1 = {
  runtime_run: {
    runtime_run_id: "run-system-e2e",
    trigger_process_id: process.id,
    ...scope,
    status: "running",
    start_attempt_no: 1,
    policy_snapshot_id: "runtime-policy:run-system-e2e",
    requested_catalog_version: "catalog-system-e2e",
    effective_catalog_version: "catalog-system-e2e",
    created_at: "2026-07-24T04:00:00.000Z",
    started_at: "2026-07-24T04:00:01.000Z",
    completed_at: null,
    terminal_reason: null,
  },
};

const toolPage: ToolInvocationListDetailsV1 = {
  runtime_run_id: "run-system-e2e",
  items: [],
  next_cursor: null,
  has_more: false,
};

const metaProjection: MetaJobQueryDetailsV1 = {
  job_id: "meta-job-system-e2e",
  trigger_process_id: process.id,
  bot_id: scope.bot_id,
  status: "running",
  result_status: null,
  attempt_count: 1,
  next_retry_at: null,
  summary: null,
  error: null,
  created_at: "2026-07-24T04:00:01.000Z",
  updated_at: "2026-07-24T04:00:02.000Z",
  trace_id: traceId,
};

const qualityPage: QualitySignalListDetailsV1 = {
  trigger_process_id: process.id,
  bot_id: scope.bot_id,
  items: [],
  next_cursor: null,
  has_more: false,
  trace_id: traceId,
};

const viewer = Object.freeze({
  service_id: "action_runtime",
  actor_id: "operator:system-e2e",
  roles: Object.freeze(["observation.viewer"]),
  capabilities: Object.freeze(["observation.read"]),
  credential_expires_at_epoch_seconds:
    activeCredentialExpiresAtEpochSeconds,
  delegated_principal: Object.freeze(delegated()),
  scope,
} satisfies ObservationPrincipalV1);

function delegated(
  scopeValue: ObservationScopeV1 = scope,
  roles: readonly string[] = ["observation.viewer"],
) {
  return {
    principal_type: "operator" as const,
    principal_id: "system-e2e",
    roles: [...roles],
    source_issuer: "https://auth.system-e2e.test",
    source_subject: "system-e2e",
    auth_time: 1_784_000_000,
    scope_kind: "bot" as const,
    ...scopeValue,
  };
}

function sameScope(
  left: ObservationScopeV1,
  right: ObservationScopeV1,
): boolean {
  return (
    left.workspace_id === right.workspace_id &&
    left.bot_id === right.bot_id &&
    left.owner_agent_id === right.owner_agent_id &&
    left.deployment_environment === right.deployment_environment &&
    left.release_channel === right.release_channel
  );
}

function sameDelegatedPrincipal(
  value: RuntimeQueryPrincipalV1["delegated_principal"],
  expectedScope: ObservationScopeV1,
): boolean {
  return (
    value.principal_type === "operator" &&
    value.principal_id === "system-e2e" &&
    value.source_issuer === "https://auth.system-e2e.test" &&
    value.source_subject === "system-e2e" &&
    value.roles.includes("observation.viewer") &&
    value.scope_kind === "bot" &&
    sameScope(value, expectedScope)
  );
}

function assertOwnerWorkload(
  workload: Readonly<{
    sub: string;
    aud: string;
    capability: string;
  }>,
  audience: string,
  capability: string,
): void {
  if (
    workload.sub !== "observation_gateway" ||
    workload.aud !== audience ||
    workload.capability !== capability
  ) {
    throw new Error(
      `invalid owner workload ${workload.sub}/${workload.aud}/${workload.capability}`,
    );
  }
}

function parseTpFrame(
  frame: string,
):
  | Readonly<{ kind: "heartbeat" }>
  | Readonly<{ kind: "event"; event: TriggerProcessSseEventV1 }> {
  if (frame.startsWith(":heartbeat")) return { kind: "heartbeat" };
  const line = frame
    .split("\n")
    .find((candidate) => candidate.startsWith("data: "));
  if (line === undefined) {
    throw new Error("Trigger Processor emitted an invalid SSE frame");
  }
  return {
    kind: "event",
    event: JSON.parse(line.slice("data: ".length)) as TriggerProcessSseEventV1,
  };
}

function rethrowTpUpstreamError(error: unknown): never {
  if (!(error instanceof TriggerProcessObservationErrorV1)) throw error;
  const code =
    error.code === "bot_permission_denied"
      ? "permission_denied"
      : error.code === "process_not_found"
        ? "not_found"
        : error.code === "replay_expired"
          ? "replay_expired"
          : error.code === "cursor_ahead"
            ? "cursor_ahead"
            : error.code === "rate_limited"
            ? "rate_limited"
            : error.code === "projection_contract_drift"
              ? "schema_mismatch"
              : "unavailable";
  throw new ObservationUpstreamErrorV1(
    "trigger_processor",
    code,
    error.message,
  );
}

function systemApplications(
  options: Readonly<{
    process?: TriggerProcessQueryDetailsV1;
    events?: readonly TriggerProcessSseEventV1[];
    observation_closed?: boolean;
    durable_audit_test_double?: boolean;
  }> = {},
) {
  const ownerProcess = options.process ?? process;
  const ownerEvents = options.events ?? [processEvent];
  const observationClosed = options.observation_closed ?? false;
  const traces = {
    trigger: [] as string[],
    runtime: [] as string[],
    meta: [] as string[],
  };
  const calls = { runtime: 0, meta: 0 };
  const tpRepository: TriggerProcessObservationRepositoryV1 = {
    async readAuthorizedProcess(request) {
      if (
        request.principal.signed_bot_scope === undefined ||
        !sameScope(request.principal.signed_bot_scope, scope)
      ) {
        return { outcome: "denied" };
      }
      return {
        outcome: "found",
        details: ownerProcess,
        replay_cutoff: 0,
        observation_closed: observationClosed,
      };
    },
    async readAuthorizedEventPage(request) {
      if (
        request.principal.signed_bot_scope === undefined ||
        !sameScope(request.principal.signed_bot_scope, scope)
      ) {
        return {
          outcome: "denied",
          current_watermark: 0,
          replay_cutoff: 0,
          events: [],
          observation_closed: false,
          details: null,
        };
      }
      return {
        outcome: "found",
        current_watermark: ownerProcess.snapshot_watermark,
        replay_cutoff: 0,
        events: ownerEvents.filter(
          ({ append_sequence_no }) =>
            append_sequence_no > request.after_append_sequence_no,
        ),
        observation_closed: observationClosed,
        details: ownerProcess,
      };
    },
  };
  const tp = createTriggerProcessObservationApplicationV1(
    tpRepository,
    {
      heartbeat_interval_ms: 10_000,
      poll_interval_ms: 10,
    },
  );
  const runtimeRepository: RuntimeQueryRepositoryV1 = {
    async readAuthorizedRun(request) {
      calls.runtime += 1;
      return request.runtime_run_id ===
          runtimeProjection.runtime_run.runtime_run_id &&
        sameScope(request.principal.scope, scope) &&
        sameDelegatedPrincipal(
          request.principal.delegated_principal,
          scope,
        )
        ? { outcome: "found", details: runtimeProjection }
        : { outcome: "denied" };
    },
    async listAuthorizedToolInvocations(request) {
      calls.runtime += 1;
      return request.runtime_run_id === toolPage.runtime_run_id &&
        sameScope(request.principal.scope, scope) &&
        sameDelegatedPrincipal(
          request.principal.delegated_principal,
          scope,
        )
        ? {
            outcome: "found",
            details: { run: runtimeProjection, page: toolPage },
          }
        : { outcome: "denied" };
    },
    async checkReadiness() {},
  };
  const runtime = createRuntimeQueryApplicationV1(runtimeRepository);
  const emptyExperience: MetaExperienceQueryResponseV1 = {
    trigger_process_id: process.id,
    bot_id: scope.bot_id,
    trace_id: traceId,
    experience_record_id: null,
    status: "not_found",
    summary: null,
    execution_summary: null,
    evidence_refs: [],
    quality_score: null,
    created_at: null,
  };
  const emptyAudit: MetaResultAuditQueryResponseV1 = {
    meta_result_id: "meta-result-system-e2e",
    trigger_process_id: process.id,
    bot_id: scope.bot_id,
    result_version: 1,
    result_status: "complete",
    items: [],
    next_cursor: null,
    has_more: false,
    redacted_field_count: 0,
    trace_id: traceId,
  };
  const metaRepository: MetaQueryRepositoryV1 = {
    async readAuthorizedJob(request) {
      calls.meta += 1;
      return request.meta_job_id === metaProjection.job_id &&
        sameScope(request.principal.scope, scope) &&
        sameDelegatedPrincipal(
          request.principal.delegated_principal,
          scope,
        )
        ? {
            outcome: "found",
            authoritative_scope: scope,
            details: metaProjection,
          }
        : { outcome: "denied" };
    },
    async listAuthorizedQualitySignals(request) {
      calls.meta += 1;
      return request.trigger_process_id === process.id &&
        sameScope(request.principal.scope, scope) &&
        sameDelegatedPrincipal(
          request.principal.delegated_principal,
          scope,
        )
        ? {
            outcome: "found",
            authoritative_scope: scope,
            details: { ...qualityPage, trace_id: request.trace_id },
          }
        : { outcome: "denied" };
    },
    async readAuthorizedExperience() {
      return {
        outcome: "found",
        authoritative_scope: scope,
        details: emptyExperience,
      };
    },
    async listAuthorizedResultAudit() {
      return {
        outcome: "found",
        authoritative_scope: scope,
        details: emptyAudit,
      };
    },
    async checkReadiness() {},
  };
  const meta = createMetaQueryApplicationV1(metaRepository);
  const tpPort: ObservationTriggerProcessorPortV1 = {
    async checkReadiness() {},
    async getProcess(input) {
      traces.trigger.push(input.trace_id);
      if (
        input.workload.sub !== "observation_gateway" ||
        input.workload.aud !== "trigger_processor" ||
        !input.workload.capabilities.includes("trigger.process.read")
      ) {
        throw new ObservationUpstreamErrorV1(
          "trigger_processor",
          "permission_denied",
          "invalid Observation owner workload",
        );
      }
      try {
        const response = await tp.getProcess(
          {
            principal_type: "service",
            principal_id: "observation_gateway",
            credential_expires_at_epoch_seconds:
              activeCredentialExpiresAtEpochSeconds,
            signed_bot_scope: input.scope,
            process_snapshot_identity_grant: {
              capability: "trigger.process.snapshot.resolve",
              purpose: "observation_replay",
            },
            context_snapshot_identity_grant: {
              capability: "trigger.context_snapshot.resolve",
              purpose: "audit_replay",
            },
          },
          input.trigger_process_id,
          input.trace_id,
        );
        return response.details;
      } catch (error) {
        rethrowTpUpstreamError(error);
      }
    },
    async *streamProcessEvents(input, signal) {
      traces.trigger.push(input.trace_id);
      if (
        input.workload.sub !== "observation_gateway" ||
        input.workload.aud !== "trigger_processor" ||
        input.workload.capability !== "trigger.process.events.read"
      ) {
        throw new ObservationUpstreamErrorV1(
          "trigger_processor",
          "permission_denied",
          "invalid Observation event workload",
        );
      }
      const principal: DelegatedProcessReadPrincipalV1 = {
        principal_type: "service",
        principal_id: "observation_gateway",
        credential_expires_at_epoch_seconds:
          activeCredentialExpiresAtEpochSeconds,
        signed_bot_scope: input.scope,
        process_snapshot_identity_grant: {
          capability: "trigger.process.snapshot.resolve",
          purpose: "observation_replay",
        },
        context_snapshot_identity_grant: {
          capability: "trigger.context_snapshot.resolve",
          purpose: "audit_replay",
        },
      };
      try {
        const stream = await tp.streamProcessEvents(
          principal,
          {
            schema_version: "trigger_process_sse_request.v1",
            trigger_process_id: input.trigger_process_id,
            ...(input.last_event_id === undefined
              ? input.start_after_append_sequence_no === undefined
                ? {}
                : {
                    start_after_append_sequence_no:
                      input.start_after_append_sequence_no,
                  }
              : { last_event_id: input.last_event_id }),
          },
          signal,
        );
        for await (const frame of stream) yield parseTpFrame(frame);
      } catch (error) {
        rethrowTpUpstreamError(error);
      }
    },
  };
  const runtimePort: ObservationRuntimePortV1 = {
    checkReadiness: () => runtime.checkReadiness(),
    async getRun(input) {
      traces.runtime.push(input.trace_id);
      assertOwnerWorkload(
        input.workload,
        "action_runtime",
        "runtime.run.read",
      );
      const principal: RuntimeQueryPrincipalV1 = {
        workload_service: "observation_gateway",
        delegated_principal: input.delegated_principal,
        scope: input.scope,
      };
      return (
        await runtime.getRun(
          principal,
          input.runtime_run_id,
          input.trace_id,
        )
      ).details;
    },
    async listToolInvocations(input) {
      traces.runtime.push(input.trace_id);
      assertOwnerWorkload(
        input.workload,
        "action_runtime",
        "runtime.tool_invocations.read",
      );
      const principal: RuntimeQueryPrincipalV1 = {
        workload_service: "observation_gateway",
        delegated_principal: input.delegated_principal,
        scope: input.scope,
      };
      return (
        await runtime.listToolInvocations(
          principal,
          input.runtime_run_id,
          {
            ...(input.cursor === undefined
              ? {}
              : { cursor: input.cursor }),
            limit: input.limit,
            ...(input.status === undefined
              ? {}
              : {
                  status:
                    input.status as
                      | "requested"
                      | "running"
                      | "completed"
                      | "failed"
                      | "cancelled",
                }),
          },
          input.trace_id,
        )
      ).details;
    },
    async *streamTokens(input) {
      assertOwnerWorkload(
        input.workload,
        "action_runtime",
        "runtime.debug_tokens",
      );
      // This suite exercises durable replay only.
    },
  };
  const metaPort: ObservationMetaPortV1 = {
    checkReadiness: () => meta.checkReadiness(),
    async getJob(input) {
      traces.meta.push(input.trace_id);
      assertOwnerWorkload(
        input.workload,
        "meta_cognition",
        "meta.job.read",
      );
      const principal: MetaQueryPrincipalV1 = {
        workload_service: "observation_gateway",
        delegated_principal: input.delegated_principal,
        scope: input.scope,
      };
      return (
        await meta.getJob(
          principal,
          input.meta_job_id,
          input.trace_id,
        )
      ).details;
    },
    async listQualitySignals(input) {
      traces.meta.push(input.trace_id);
      assertOwnerWorkload(
        input.workload,
        "meta_cognition",
        "meta.quality_signals.read",
      );
      const principal: MetaQueryPrincipalV1 = {
        workload_service: "observation_gateway",
        delegated_principal: input.delegated_principal,
        scope: input.scope,
      };
      return (
        await meta.listQualitySignals(
          principal,
          input.trigger_process_id,
          {
            ...(input.cursor === undefined
              ? {}
              : { cursor: input.cursor }),
            limit: input.limit,
            ...(input.severity === undefined
              ? {}
              : {
                  severity:
                    input.severity as
                      | "info"
                      | "warning"
                      | "error"
                      | "critical",
                }),
            ...(input.signal_type === undefined
              ? {}
              : { signal_type: input.signal_type }),
          },
          input.trace_id,
        )
      ).details;
    },
  };
  const auditRecords: ObservationAccessAuditRecordV1[] = [];
  const audit =
    options.durable_audit_test_double === true
      ? {
          durability: "durable_spool" as const,
          records: auditRecords,
          async checkReadiness() {},
          async enqueue(
            record: ObservationAccessAuditRecordV1,
          ) {
            auditRecords.push(structuredClone(record));
            return "durable" as const;
          },
          async replay() {},
        }
      : new InMemoryObservationAccessAuditSpoolV1(auditRecords);
  return {
    application: new ObservationApplicationV1(
      tpPort,
      runtimePort,
      metaPort,
      audit,
    ),
    audit,
    calls,
    traces,
  };
}

describe("Observation aggregation and durable replay", () => {
  it("[Day19 production boundary] remains No-Go without a real durable audit spool and snapshot owner-read composition", async () => {
    const memoryOnly = systemApplications();
    await expect(
      memoryOnly.application.checkReadiness(true, true),
    ).rejects.toThrow(/durable access-audit spool/u);

    const durableTestDouble = systemApplications({
      durable_audit_test_double: true,
    });
    await expect(
      durableTestDouble.application.checkReadiness(true, true),
    ).rejects.toThrow(/snapshot owner-read ports/u);
  });

  it("[Day19 P0 #1/#8, process-internal] observes the authorized Strong identity across owner query applications and resumes at the exact TP cursor", async () => {
    const system = systemApplications();
    const snapshot = await system.application.getSnapshot(
      viewer,
      process.id,
      traceId,
    );
    expect(snapshot).toMatchObject({
      trigger_process: {
        id: process.id,
        runtime_run_id: "run-system-e2e",
        meta_job_id: "meta-job-system-e2e",
      },
      runtime: {
        runtime_run_id: "run-system-e2e",
        status: "running",
      },
      meta: {
        job_id: "meta-job-system-e2e",
        status: "running",
      },
      trace_id: traceId,
    });
    expect(system.traces).toEqual({
      trigger: [traceId],
      runtime: [traceId],
      meta: [traceId],
    });

    const downstream = new AbortController();
    const iterator = system.application
      .streamEvents(
        viewer,
        process.id,
        {
          last_event_id: `${process.id}:1`,
          trace_id: traceId,
        },
        downstream.signal,
      )
      [Symbol.asyncIterator]();
    const recovered = await iterator.next();
    expect(recovered.done).toBe(false);
    expect(recovered.value).toMatchObject({
      id: `${process.id}:2`,
      event: "observation.event",
      durable: true,
      data: {
        event_type: "runtime.run.started",
        trigger_process_id: process.id,
        append_sequence_no: 2,
        trace_id: traceId,
      },
    });
    downstream.abort(new Error("SSE client checkpointed cursor 2"));
    await expect(iterator.next()).resolves.toEqual({
      value: undefined,
      done: true,
    });
    expect(system.traces.trigger).toEqual([
      traceId,
      traceId,
      traceId,
    ]);
    expect(system.audit.records.at(-1)).toMatchObject({
      endpoint: "events_complete",
      trace_id: traceId,
      decision: "stream_closed",
    });
  });

  it("[Day19 P0 #7/#8] denies a cross-scope viewer at TP before Runtime or Meta fan-out", async () => {
    const system = systemApplications();
    const crossScopeViewer = {
      ...viewer,
      scope: { ...scope, owner_agent_id: "agent-other" },
      delegated_principal: delegated({
        ...scope,
        owner_agent_id: "agent-other",
      }),
    };
    const attempts = [
      () =>
        system.application.getSnapshot(
          crossScopeViewer,
          process.id,
          "trace-cross-scope-snapshot",
        ),
      () =>
        system.application.getRuntimeDetails(
          crossScopeViewer,
          process.id,
          "run-system-e2e",
          "trace-cross-scope-runtime-detail",
        ),
      () =>
        system.application.getMetaDetails(
          crossScopeViewer,
          process.id,
          "meta-job-system-e2e",
          "trace-cross-scope-meta-detail",
        ),
      () =>
        system.application.listToolInvocations(
          crossScopeViewer,
          process.id,
          {
            runtime_run_id: "run-system-e2e",
            trace_id: "trace-cross-scope-tool-list",
          },
        ),
      () =>
        system.application.listQualitySignals(
          crossScopeViewer,
          process.id,
          {
            trace_id: "trace-cross-scope-quality-list",
          },
        ),
      () =>
        system.application.prepareEventStream(
          crossScopeViewer,
          process.id,
          {
            trace_id: "trace-cross-scope-event-stream",
          },
        ),
    ];
    for (const attempt of attempts) {
      await expect(attempt()).rejects.toMatchObject({
        code: "bot_permission_denied",
      } satisfies Partial<ObservationApplicationErrorV1>);
    }
    expect(system.calls).toEqual({ runtime: 0, meta: 0 });
  });

  it.each([
    {
      name: "missing observation.read capability",
      principal: {
        ...viewer,
        capabilities: [],
      },
    },
    {
      name: "missing viewer role",
      principal: {
        ...viewer,
        roles: [],
      },
    },
  ])(
    "[Day19 P0 #7/#8] rejects $name before any owner fan-out",
    async ({ principal }) => {
      const system = systemApplications();
      await expect(
        system.application.getSnapshot(
          principal,
          process.id,
          "trace-observation-permission-denied",
        ),
      ).rejects.toMatchObject({
        code: "bot_permission_denied",
      } satisfies Partial<ObservationApplicationErrorV1>);
      expect(system.calls).toEqual({ runtime: 0, meta: 0 });
      expect(system.traces).toEqual({
        trigger: [],
        runtime: [],
        meta: [],
      });
    },
  );

  it("[Day19 P0 #7] rejects expired debug credential metadata before opening the token side channel", async () => {
    const system = systemApplications({
      durable_audit_test_double: true,
    });
    await expect(
      system.application.prepareEventStream(
        {
          ...viewer,
          roles: ["observation.debug_viewer"],
          delegated_principal: delegated(
            scope,
            ["observation.debug_viewer"],
          ),
          credential_expires_at_epoch_seconds:
            Math.floor(Date.now() / 1_000) - 1,
        },
        process.id,
        {
          include_ephemeral_tokens: true,
          runtime_run_id: "run-system-e2e",
          trace_id: "trace-expired-debug-credential",
        },
      ),
    ).rejects.toMatchObject({
      code: "debug_permission_denied",
    } satisfies Partial<ObservationApplicationErrorV1>);
    expect(system.calls).toEqual({ runtime: 0, meta: 0 });
  });

  it("[Day19 P0 #8] consumes a terminal TP summary as a validated control frame after durable replay", async () => {
    const terminalProcess: TriggerProcessQueryDetailsV1 = {
      ...process,
      phase: "closed",
      status: "completed",
      terminal_reason: "completed",
      terminal_outcome: "executed",
      terminal_outcome_finalized_at: "2026-07-24T04:00:03.000Z",
      canonical_reason_code: "execution_completed",
      reason_code: "execution_completed",
      meta_status: "completed",
      observation_finalized: true,
    };
    const terminalEvent: TriggerProcessSseEventV1 = {
      ...processEvent,
      event_type: "runtime.run.completed",
      occurred_at: "2026-07-24T04:00:03.000Z",
      observation_summary: {
        runtime_run_id: "run-system-e2e",
        status: "completed",
        duration_ms: 2_000,
        reason_code: "completed",
        error_summary: null,
        artifact_ref: null,
      },
    };
    const system = systemApplications({
      process: terminalProcess,
      events: [terminalEvent],
      observation_closed: true,
    });
    const frames = [];
    for await (const frame of system.application.streamEvents(
      viewer,
      process.id,
      {
        last_event_id: `${process.id}:1`,
        trace_id: "trace-terminal-summary-system-e2e",
      },
    )) {
      frames.push(frame);
    }
    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatchObject({
      id: `${process.id}:2`,
      event: "observation.event",
      durable: true,
      data: {
        event_type: "runtime.run.completed",
        trigger_process_id: process.id,
        append_sequence_no: 2,
      },
    });
  });
});
