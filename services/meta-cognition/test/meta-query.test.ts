import { describe, expect, it, vi } from "vitest";

import {
  MetaQueryErrorV1,
  createInMemoryMetaQueryRepositoryV1,
  createMetaQueryApplicationV1,
  type MetaQueryPrincipalV1,
  type MetaQueryRepositoryV1,
} from "../src/meta-query.v1.js";
import {
  createAndLease,
  createHarness,
  providerOutput,
} from "./fixtures.js";

const scope = {
  workspace_id: "ws_01",
  bot_id: "bot_01",
  owner_agent_id: "agent_01",
  deployment_environment: "prod",
  release_channel: "stable",
} as const;

const principal: MetaQueryPrincipalV1 = {
  workload_service: "observation_gateway",
  delegated_principal: {
    principal_type: "operator",
    principal_id: "operator_01",
    roles: ["operator"],
    source_issuer: "https://auth.example.test",
    source_subject: "operator_01",
    auth_time: 1_784_000_000,
    scope_kind: "bot",
    ...scope,
  },
  scope,
};

const job = {
  job_id: "job_01",
  trigger_process_id: "tp_01",
  bot_id: "bot_01",
  status: "completed",
  result_status: "complete",
  attempt_count: 1,
  next_retry_at: null,
  summary: {
    experience_summary: {
      summary: "complete",
      reflection_summary: null,
      evidence_refs: ["trigger_event:event_01"],
    },
    result_status: "complete",
    partial_failures_count: 0,
    quality_signals_count: 1,
    memory_write_refs: [],
    knowthat_write_refs: [],
    candidate_review_refs: [],
    skill_candidate_refs: [],
    personality_suggestion_refs: [],
  },
  error: null,
  created_at: "2026-07-13T12:00:00.000Z",
  updated_at: "2026-07-13T12:00:01.000Z",
  trace_id: "trace_job_01",
} as const;

const signals = {
  trigger_process_id: "tp_01",
  bot_id: "bot_01",
  items: [
    {
      id: "signal_01",
      signal_type: "tool_execution_failed",
      severity: "error",
      source_kind: "service",
      source_service: "action_runtime",
      actor_principal: null,
      actor_role: null,
      source_ref: "runtime_event:event_01",
      evidence_refs: ["tool_result:result_01"],
      recommended_action: null,
      payload_summary: { retryable: false },
      created_at: "2026-07-13T12:00:01.000Z",
    },
  ],
  next_cursor: null,
  has_more: false,
  trace_id: "trace_signal_01",
} as const;

const experience = {
  trigger_process_id: "tp_01",
  bot_id: "bot_01",
  trace_id: "trace_experience",
  experience_record_id: "experience_01",
  status: "available",
  summary: "bounded experience",
  execution_summary: {
    task_stages: ["runtime"],
    major_results: ["completed"],
    failure_summaries: [],
    artifact_refs: [],
  },
  evidence_refs: ["trigger_event:event_01"],
  quality_score: 0.9,
  created_at: "2026-07-13T12:00:01.000Z",
} as const;

const resultAudit = {
  meta_result_id: "result_01",
  trigger_process_id: "tp_01",
  bot_id: "bot_01",
  result_version: 1,
  result_status: "complete",
  items: [
    {
      audit_id: "audit_01",
      result_version: 1,
      previous_result_status: null,
      result_status: "complete",
      operation: "created",
      changed_failure_ids: [],
      actor_kind: "service",
      actor_ref: "meta_cognition",
      payload_summary: { finalized: true },
      created_at: "2026-07-13T12:00:01.000Z",
    },
  ],
  next_cursor: null,
  has_more: false,
  redacted_field_count: 0,
  trace_id: "trace_audit",
} as const;

function repository(
  overrides: Partial<MetaQueryRepositoryV1> = {},
): MetaQueryRepositoryV1 {
  return {
    async readAuthorizedJob() {
      return { outcome: "found", authoritative_scope: scope, details: job };
    },
    async listAuthorizedQualitySignals() {
      return {
        outcome: "found",
        authoritative_scope: scope,
        details: signals,
      };
    },
    async readAuthorizedExperience() {
      return {
        outcome: "found",
        authoritative_scope: scope,
        details: experience,
      };
    },
    async listAuthorizedResultAudit() {
      return {
        outcome: "found",
        authoritative_scope: scope,
        details: resultAudit,
      };
    },
    async checkReadiness() {},
    ...overrides,
  };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function mutablePrincipal(): MetaQueryPrincipalV1 {
  return structuredClone(principal);
}

function mutatePrincipalBot(
  value: MetaQueryPrincipalV1,
  botId: string,
): void {
  (value.scope as unknown as { bot_id: string }).bot_id = botId;
  (
    value.delegated_principal as unknown as DelegatedBotPrincipalForTest
  ).bot_id = botId;
}

type DelegatedBotPrincipalForTest = {
  bot_id: string;
};

describe("Meta owner queries", () => {
  it("projects live in-memory job artifacts through all four owner queries", async () => {
    const harness = createHarness({
      provider: {
        async generate() {
          return providerOutput({
            quality_signals: [
              {
                item_id: "quality-1",
                evidence_refs: ["trigger_process:process-1"],
                payload: {
                  schema_version: "quality_signal.v1",
                  signal_type: "tool_execution_failed",
                  severity: "error",
                  source_kind: "service",
                  source_service: "action_runtime",
                  source_ref: "runtime:run-1",
                  evidence_refs: ["trigger_process:process-1"],
                  recommended_action: "inspect runtime",
                  payload: { retryable: false },
                },
              },
            ],
          });
        },
      },
    });
    const { created, lease } = await createAndLease(harness);
    const run = await harness.application.runJob(lease);
    expect(run.outcome).toBe("completed");
    if (run.outcome !== "completed") {
      throw new Error("expected completed Meta job");
    }
    const localPrincipal: MetaQueryPrincipalV1 = {
      workload_service: "observation_gateway",
      delegated_principal: {
        principal_type: "operator",
        principal_id: "operator-local",
        roles: ["operator"],
        source_issuer: "https://auth.example.test",
        source_subject: "operator-local",
        auth_time: 1_784_000_000,
        scope_kind: "bot",
        workspace_id: "workspace-1",
        bot_id: "bot-1",
        owner_agent_id: "agent-1",
        deployment_environment: "dev",
        release_channel: "stable",
      },
      scope: {
        workspace_id: "workspace-1",
        bot_id: "bot-1",
        owner_agent_id: "agent-1",
        deployment_environment: "dev",
        release_channel: "stable",
      },
    };
    const application = createMetaQueryApplicationV1(
      createInMemoryMetaQueryRepositoryV1(harness.repository),
    );
    await expect(
      application.getJob(
        localPrincipal,
        created.job_id,
        "trace-local-job",
      ),
    ).resolves.toMatchObject({
      details: {
        status: "completed",
        result_status: "complete",
      },
    });
    await expect(
      application.getExperience(
        localPrincipal,
        "process-1",
        "trace-local-experience",
      ),
    ).resolves.toMatchObject({
      status: "available",
      trigger_process_id: "process-1",
    });
    await expect(
      application.listQualitySignals(
        localPrincipal,
        "process-1",
        { severity: "error" },
        "trace-local-quality",
      ),
    ).resolves.toMatchObject({
      details: {
        items: [
          {
            signal_type: "tool_execution_failed",
            source_service: "action_runtime",
          },
        ],
      },
    });
    await expect(
      application.listResultAudit(
        localPrincipal,
        run.result.id,
        {},
        "trace-local-audit",
      ),
    ).resolves.toMatchObject({
      meta_result_id: run.result.id,
      result_version: 1,
      items: [{ operation: "created" }],
    });
  });

  it("returns bounded job and quality projections under one authoritative scope", async () => {
    const list = vi.fn(async () => ({
      outcome: "found" as const,
      authoritative_scope: scope,
      details: signals,
    }));
    const application = createMetaQueryApplicationV1(
      repository({ listAuthorizedQualitySignals: list }),
    );
    const jobResponse = await application.getJob(
      principal,
      "job_01",
      "trace_01",
    );
    expect(jobResponse).toMatchObject({
      code: "meta_job_found",
      details: job,
    });
    expect(Object.isFrozen(jobResponse.details)).toBe(true);
    expect(Object.isFrozen(jobResponse.details.summary)).toBe(true);
    await expect(
      application.listQualitySignals(
        principal,
        "tp_01",
        { limit: 50, severity: "error" },
        "trace_signal_01",
      ),
    ).resolves.toMatchObject({
      code: "quality_signals_found",
      details: signals,
    });
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger_process_id: "tp_01",
        principal,
        cursor: null,
        limit: 50,
        severity: "error",
        signal_type: null,
        trace_id: "trace_signal_01",
      }),
    );
    await expect(
      application.getExperience(
        principal,
        "tp_01",
        "trace_experience",
      ),
    ).resolves.toEqual(experience);
    await expect(
      application.listResultAudit(
        principal,
        "result_01",
        {},
        "trace_audit",
      ),
    ).resolves.toEqual(resultAudit);
  });

  it("snapshots and freezes every principal and query before repository await", async () => {
    {
      const entered = deferred();
      const release = deferred();
      let captured:
        | Parameters<MetaQueryRepositoryV1["readAuthorizedJob"]>[0]
        | undefined;
      const application = createMetaQueryApplicationV1(
        repository({
          async readAuthorizedJob(request) {
            captured = request;
            entered.resolve();
            await release.promise;
            return {
              outcome: "found",
              authoritative_scope: { ...request.principal.scope },
              details: {
                ...job,
                bot_id: request.principal.scope.bot_id,
              },
            };
          },
        }),
      );
      const caller = mutablePrincipal();
      const pending = application.getJob(
        caller,
        "job_01",
        "trace_01",
      );
      await entered.promise;
      mutatePrincipalBot(caller, "bot_other");
      expect(Object.isFrozen(captured)).toBe(true);
      expect(Object.isFrozen(captured?.principal)).toBe(true);
      expect(Object.isFrozen(captured?.principal.scope)).toBe(true);
      release.resolve();
      await expect(pending).resolves.toMatchObject({
        details: { bot_id: "bot_01" },
      });
    }

    {
      const entered = deferred();
      const release = deferred();
      let captured:
        | Parameters<
            MetaQueryRepositoryV1["listAuthorizedQualitySignals"]
          >[0]
        | undefined;
      const application = createMetaQueryApplicationV1(
        repository({
          async listAuthorizedQualitySignals(request) {
            captured = request;
            entered.resolve();
            await release.promise;
            return {
              outcome: "found",
              authoritative_scope: { ...request.principal.scope },
              details: {
                ...signals,
                bot_id: request.principal.scope.bot_id,
                trace_id: request.trace_id,
              },
            };
          },
        }),
      );
      const caller = mutablePrincipal();
      const query: {
        cursor?: string;
        limit?: number;
        severity?: "error";
        signal_type?: string;
        unexpected?: boolean;
      } = { limit: 50, severity: "error" };
      const pending = application.listQualitySignals(
        caller,
        "tp_01",
        query,
        "trace_signal_01",
      );
      await entered.promise;
      mutatePrincipalBot(caller, "bot_other");
      query.limit = 1;
      query.unexpected = true;
      expect(Object.isFrozen(captured)).toBe(true);
      expect(Object.isFrozen(captured?.principal)).toBe(true);
      expect(captured?.limit).toBe(50);
      release.resolve();
      await expect(pending).resolves.toMatchObject({
        details: { bot_id: "bot_01" },
      });
    }

    {
      const entered = deferred();
      const release = deferred();
      let captured:
        | Parameters<
            MetaQueryRepositoryV1["readAuthorizedExperience"]
          >[0]
        | undefined;
      const application = createMetaQueryApplicationV1(
        repository({
          async readAuthorizedExperience(request) {
            captured = request;
            entered.resolve();
            await release.promise;
            return {
              outcome: "found",
              authoritative_scope: { ...request.principal.scope },
              details: {
                ...experience,
                bot_id: request.principal.scope.bot_id,
                trace_id: request.trace_id,
              },
            };
          },
        }),
      );
      const caller = mutablePrincipal();
      const pending = application.getExperience(
        caller,
        "tp_01",
        "trace_experience",
      );
      await entered.promise;
      mutatePrincipalBot(caller, "bot_other");
      expect(Object.isFrozen(captured)).toBe(true);
      expect(Object.isFrozen(captured?.principal.scope)).toBe(true);
      release.resolve();
      await expect(pending).resolves.toMatchObject({
        bot_id: "bot_01",
      });
    }

    {
      const entered = deferred();
      const release = deferred();
      let captured:
        | Parameters<
            MetaQueryRepositoryV1["listAuthorizedResultAudit"]
          >[0]
        | undefined;
      const application = createMetaQueryApplicationV1(
        repository({
          async listAuthorizedResultAudit(request) {
            captured = request;
            entered.resolve();
            await release.promise;
            return {
              outcome: "found",
              authoritative_scope: { ...request.principal.scope },
              details: {
                ...resultAudit,
                bot_id: request.principal.scope.bot_id,
                trace_id: request.trace_id,
              },
            };
          },
        }),
      );
      const caller = mutablePrincipal();
      const query: {
        cursor?: string;
        limit?: number;
        unexpected?: boolean;
      } = { limit: 50 };
      const pending = application.listResultAudit(
        caller,
        "result_01",
        query,
        "trace_audit",
      );
      await entered.promise;
      mutatePrincipalBot(caller, "bot_other");
      query.limit = 1;
      query.unexpected = true;
      expect(Object.isFrozen(captured)).toBe(true);
      expect(Object.isFrozen(captured?.principal.scope)).toBe(true);
      expect(captured?.limit).toBe(50);
      release.resolve();
      await expect(pending).resolves.toMatchObject({
        bot_id: "bot_01",
      });
    }
  });

  it("rejects proxy, accessor and excess-key boundary objects without evaluating them", async () => {
    const application = createMetaQueryApplicationV1(repository());
    let principalProxyReads = 0;
    const principalProxy = new Proxy(mutablePrincipal(), {
      get(target, property, receiver) {
        principalProxyReads += 1;
        return Reflect.get(target, property, receiver);
      },
    });
    await expect(
      application.getJob(
        principalProxy,
        "job_01",
        "trace_01",
      ),
    ).rejects.toMatchObject<Partial<MetaQueryErrorV1>>({
      code: "authorization_denied",
    });
    expect(principalProxyReads).toBe(0);

    let principalGetterReads = 0;
    const principalAccessor = mutablePrincipal();
    Object.defineProperty(principalAccessor, "scope", {
      enumerable: true,
      get() {
        principalGetterReads += 1;
        return scope;
      },
    });
    await expect(
      application.getJob(
        principalAccessor,
        "job_01",
        "trace_01",
      ),
    ).rejects.toMatchObject<Partial<MetaQueryErrorV1>>({
      code: "authorization_denied",
    });
    expect(principalGetterReads).toBe(0);

    let queryProxyReads = 0;
    const queryProxy = new Proxy(
      { limit: 50 },
      {
        get(target, property, receiver) {
          queryProxyReads += 1;
          return Reflect.get(target, property, receiver);
        },
      },
    );
    await expect(
      application.listQualitySignals(
        principal,
        "tp_01",
        queryProxy,
        "trace_signal_01",
      ),
    ).rejects.toMatchObject<Partial<MetaQueryErrorV1>>({
      code: "schema_validation_failed",
    });
    expect(queryProxyReads).toBe(0);

    await expect(
      application.listResultAudit(
        principal,
        "result_01",
        { limit: 50, unexpected: true } as {
          limit: number;
        },
        "trace_audit",
      ),
    ).rejects.toMatchObject<Partial<MetaQueryErrorV1>>({
      code: "schema_validation_failed",
    });
  });

  it("snapshots owner outcomes and pins the readiness method at composition", async () => {
    let outcomeGetterReads = 0;
    const outcome = {
      outcome: "found",
      authoritative_scope: scope,
    } as Record<string, unknown>;
    Object.defineProperty(outcome, "details", {
      enumerable: true,
      get() {
        outcomeGetterReads += 1;
        return job;
      },
    });
    const originalReadiness = vi.fn(async () => {});
    const replacementReadiness = vi.fn(async () => {});
    const ownerRepository = repository({
      async readAuthorizedJob() {
        return outcome as unknown as Awaited<
          ReturnType<MetaQueryRepositoryV1["readAuthorizedJob"]>
        >;
      },
      checkReadiness: originalReadiness,
    });
    const application = createMetaQueryApplicationV1(ownerRepository);
    ownerRepository.checkReadiness = replacementReadiness;

    await expect(
      application.getJob(principal, "job_01", "trace_01"),
    ).rejects.toMatchObject<Partial<MetaQueryErrorV1>>({
      code: "owner_contract_drift",
    });
    expect(outcomeGetterReads).toBe(0);

    const signal = new AbortController().signal;
    await application.checkReadiness(signal);
    expect(originalReadiness).toHaveBeenCalledWith(signal);
    expect(replacementReadiness).not.toHaveBeenCalled();
  });

  it("rejects authoritative scope drift and filters outside the closed taxonomy", async () => {
    const application = createMetaQueryApplicationV1(
      repository({
        async readAuthorizedJob() {
          return {
            outcome: "found",
            authoritative_scope: { ...scope, bot_id: "bot_other" },
            details: job,
          };
        },
      }),
    );
    await expect(
      application.getJob(principal, "job_01", "trace_01"),
    ).rejects.toMatchObject<Partial<MetaQueryErrorV1>>({
      code: "owner_contract_drift",
    });
    await expect(
      createMetaQueryApplicationV1(repository()).listQualitySignals(
        principal,
        "tp_01",
        { signal_type: "new_unregistered_signal" },
        "trace_01",
      ),
    ).rejects.toMatchObject<Partial<MetaQueryErrorV1>>({
      code: "schema_validation_failed",
    });
  });

  it("rejects a delegated principal whose signed bot scope drifts", async () => {
    const application = createMetaQueryApplicationV1(repository());
    await expect(
      application.getJob(
        {
          ...principal,
          delegated_principal: {
            ...principal.delegated_principal,
            bot_id: "bot_other",
          },
        },
        "job_01",
        "trace_01",
      ),
    ).rejects.toMatchObject<Partial<MetaQueryErrorV1>>({
      code: "authorization_denied",
    });
  });
});
