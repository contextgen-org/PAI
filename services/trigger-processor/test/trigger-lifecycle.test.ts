import { createHash } from "node:crypto";

import type {
  ContextComposeRequestV1,
  ContextSnapshotV1,
  IntentPolicyInputSnapshotV1,
  IntentSynthesizeRequestV1,
  IntentSynthesizeResponseV1,
  RuntimeStartRequestV1,
} from "@pai/contracts";
import { canonicalJsonV1 } from "@pai/eventing";
import type { ObjectRefV1, PutImmutableRequestV1 } from "@pai/object-store";
import { InternalClientError } from "@pai/service-kit";
import { describe, expect, it } from "vitest";

import {
  createTriggerLifecycleApplicationV1,
  TriggerLifecycleStageErrorV1,
  type ContextSourceAdaptersV1,
  type TriggerLifecycleDependenciesV1,
} from "../src/application/trigger-lifecycle.v1.js";
import type { TriggerProcessorOwnerDatabaseV1 } from "../src/application/trigger-admission.v1.js";

const at = "2026-07-30T00:00:00.000Z";
const workClaim = Object.freeze({
  work_item_id: "work-1",
  claim_token: "claim-token-1",
  lease_generation: 1,
  lease_owner: "worker-1",
  expected_process_state_version: 1,
  payload_hash:
    "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const,
});

function hash(value: unknown): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(canonicalJsonV1(value)).digest("hex")}`;
}

function withoutKey(
  value: Readonly<Record<string, unknown>>,
  key: string,
): Readonly<Record<string, unknown>> {
  return Object.fromEntries(Object.entries(value).filter(([name]) => name !== key));
}

const contextRequest: ContextComposeRequestV1 = {
  schema_version: "context_compose_request.v1",
  trigger_process_id: "process-1",
  workspace_id: "workspace-1",
  bot_id: "bot-1",
  owner_agent_id: "agent-1",
  deployment_environment: "dev",
  release_channel: "stable",
  trigger: { trigger_id: "trigger-1", source: "chat", actor_type: "user" },
  context_version: 1,
  source_policy: {
    required_sources: ["environment"],
    allowed_sources: ["knowthat", "memory", "skill", "environment", "history"],
    skip_decisions: [],
  },
  idempotency_key: "process-1:context:1",
  trace_id: "trace-1",
};

function contextSources(
  calls: string[] = [],
): ContextSourceAdaptersV1 {
  return {
    knowthat: {
      async fetch() {
        calls.push("knowthat");
        return { source_as_of: at, source_version: "knowthat.v1", pinned_facts: [] };
      },
    },
    memory: {
      async fetch() {
        calls.push("memory");
        return { source_as_of: at, source_version: "memory.v1", memory_context: [] };
      },
    },
    skill: {
      async fetch() {
        calls.push("skill");
        return {
          source_as_of: at,
          source_version: "cat_184",
          skill_catalog: { catalog_version: "cat_184", catalog_as_of: at, items: [] },
        };
      },
    },
    environment: {
      async fetch() {
        calls.push("environment");
        return {
          source_as_of: at,
          source_version: "tp_environment.v1",
          environment: {
            captured_at: at,
            channel: "chat",
            timezone: "Asia/Shanghai",
            capability_summary_ref: "capability-summary:1",
          },
        };
      },
    },
    history: {
      async fetch() {
        calls.push("history");
        return { source_as_of: at, source_version: "history.v1", history: [] };
      },
    },
  };
}

function contextSnapshot(
  skillCatalog: ContextSnapshotV1["skill_catalog"] = {
    catalog_version: "cat_184",
    catalog_as_of: at,
    items: [],
  },
): ContextSnapshotV1 {
  const sourceStatus: ContextSnapshotV1["source_status"] = [
    { source: "knowthat", status: "empty", retrieved_at: at, source_as_of: at, source_version: "knowthat.v1", latency_ms: 1, result_count: 0, failure_reason: null },
    { source: "memory", status: "empty", retrieved_at: at, source_as_of: at, source_version: "memory.v1", latency_ms: 1, result_count: 0, failure_reason: null },
    skillCatalog === null
      ? { source: "skill", status: "failed", retrieved_at: at, source_as_of: null, source_version: null, latency_ms: 1, result_count: 0, failure_reason: "skill_unavailable" }
      : { source: "skill", status: "empty", retrieved_at: at, source_as_of: at, source_version: "cat_184", latency_ms: 1, result_count: 0, failure_reason: null },
    { source: "environment", status: "ok", retrieved_at: at, source_as_of: at, source_version: "tp_environment.v1", latency_ms: 1, result_count: 1, failure_reason: null },
    { source: "history", status: "empty", retrieved_at: at, source_as_of: at, source_version: "history.v1", latency_ms: 1, result_count: 0, failure_reason: null },
  ];
  const partial = {
    schema_version: "context_snapshot.v1" as const,
    trigger_process_id: "process-1",
    context_version: 1,
    workspace_id: "workspace-1",
    bot_id: "bot-1",
    owner_agent_id: "agent-1",
    deployment_environment: "dev" as const,
    release_channel: "stable" as const,
    pinned_facts: [],
    memory_context: [],
    skill_catalog: skillCatalog,
    environment: {
      captured_at: at,
      channel: "chat",
      timezone: "Asia/Shanghai",
      capability_summary_ref: "capability-summary:1",
    },
    history: [],
    source_status: sourceStatus,
    assembly_notes: [],
  };
  return { ...partial, snapshot_hash: hash(partial) };
}

function database(
  calls: Array<Readonly<Record<string, unknown>>>,
  options: { failAfterWorkOnce?: boolean; writerResult?: unknown } = {},
): TriggerProcessorOwnerDatabaseV1 {
  let fail = options.failAfterWorkOnce === true;
  return {
    repository: {} as never,
    deployment: {} as never,
    unit_of_work: {
      owner_service: "trigger_processor",
      async withTransaction(request, work) {
        calls.push({ transaction: request });
        const result = await work({} as never, {
          owner: {
            async executeWriter(_transaction: unknown, writer: unknown) {
              calls.push(writer as Readonly<Record<string, unknown>>);
              return options.writerResult ?? {};
            },
          } as never,
        });
        if (fail) {
          fail = false;
          throw new Error("commit_then_disconnect");
        }
        return result;
      },
    },
  } as TriggerProcessorOwnerDatabaseV1;
}

function dependencies(
  puts: PutImmutableRequestV1[],
  options: {
    failPut?: boolean;
    resolvedContext?: ContextSnapshotV1;
    runtimeEvent?: unknown;
    runtimeResolveError?: unknown;
    runtimeResolveRequests?: unknown[];
    runtimeRetentionUntil?: string;
    snapshotRetentionUntil?: string;
    retentionReadRequests?: unknown[];
  } = {},
): TriggerLifecycleDependenciesV1 {
  return {
    context_sources: contextSources(),
    intent_policy_sources: {
      tool_permissions: {
        async readCurrent(request) {
          const hashable = {
            schema_version: "tool_permission_profile.v1" as const,
            selector: {
              workspace_id: request.workspace_id,
              bot_id: request.bot_id,
              owner_agent_id: request.owner_agent_id,
              deployment_environment: request.deployment_environment,
              release_channel: request.release_channel,
            },
            profile_ref: "tool-profile:1",
            revision: 1,
            allowed_tools: [],
            tool_arg_constraints: {},
            resource_scopes: {},
            network_scope: {},
            filesystem_scope: {},
            timer_scope: {},
            memory_scope: {},
            policy_epoch: 0,
            effective_at: at,
          };
          return { ...hashable, profile_hash: hash(hashable) };
        },
      },
      skill_catalog: {
        async readFirstPage(request) {
          return {
            schema_version: "skill_catalog_response.v1",
            workspace_id: request.workspace_id,
            bot_id: request.bot_id,
            owner_agent_id: request.owner_agent_id,
            deployment_environment: request.deployment_environment,
            release_channel: request.release_channel,
            catalog_revision_id: "catalog-revision:1",
            catalog_version: "cat_184",
            as_of: at,
            security_revocation_epoch: 0,
            skill_permission_summary_ref: "skill-summary:1",
            skill_permission_summary_hash:
              "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            items: [],
            next_cursor: null,
          };
        },
      },
    },
    intent_engine: {
      async synthesize() {
        throw new Error("unused");
      },
    },
    object_store: {
      async putImmutable(request) {
        puts.push(request);
        if (options.failPut) throw new Error("storage_unavailable");
        return {
          object_ref: "object:context-1" as ObjectRefV1,
          version: "1",
          sha256: request.expected_sha256,
          size_bytes: request.size_bytes,
          media_type: request.media_type,
          retention_until: request.retention_until,
          replayed: puts.length > 1,
        };
      },
    },
    context_snapshots: {
      async resolve() {
        return options.resolvedContext ?? contextSnapshot();
      },
    },
    runtime_events: {
      async resolve(request) {
        if (options.runtimeResolveError !== undefined) {
          throw options.runtimeResolveError;
        }
        if (options.runtimeEvent === undefined) throw new Error("unused");
        options.runtimeResolveRequests?.push(request);
        return {
          schema_version: "runtime_event_read.v1",
          source_event_id: request.source_event_id,
          payload_ref: request.payload_ref,
          payload_hash: request.expected_payload_hash,
          runtime_run_id: request.runtime_run_id,
          trigger_process_id: request.trigger_process_id,
          source_sequence_no: request.source_sequence_no,
          workspace_id: request.workspace_id,
          bot_id: request.bot_id,
          owner_agent_id: request.owner_agent_id,
          deployment_environment: request.deployment_environment,
          release_channel: request.release_channel,
          purpose: request.purpose,
          runtime_event: options.runtimeEvent,
          retention_until:
            options.runtimeRetentionUntil ?? "2026-08-30T00:00:00.000Z",
          redaction_state: "complete",
          resolved_at: at,
          trace_id: request.trace_id,
        } as never;
      },
    },
    process_snapshot_retention: {
      async readCurrent(request) {
        options.retentionReadRequests?.push(request);
        return "snapshotRetentionUntil" in options
          ? options.snapshotRetentionUntil
          : "2026-08-30T00:00:00.000Z";
      },
    },
    now: () => new Date(at),
    context_retention_until: () => "2026-08-30T00:00:00.000Z",
  };
}

describe("Trigger lifecycle context materialization", () => {
  it("writes immutable bytes before atomically advancing the process", async () => {
    const dbCalls: Array<Readonly<Record<string, unknown>>> = [];
    const puts: PutImmutableRequestV1[] = [];
    const app = createTriggerLifecycleApplicationV1(
      database(dbCalls),
      dependencies(puts),
    );

    await expect(app.composeContext(contextRequest, workClaim)).resolves.toMatchObject({
      code: "context_composed",
      details: { context_snapshot_version: 1 },
    });
    expect(puts).toHaveLength(1);
    expect(puts[0]).toMatchObject({
      owner_object_id: "process-1",
      owner_state_version: 1,
      idempotency_key: expect.stringMatching(
        /^process-1:context:1:sha256:[a-f0-9]{64}$/u,
      ),
      object_class: "trigger_process_snapshot",
      capability: "trigger_process.snapshot.manage",
      expected_sha256: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
    });
    expect(
      dbCalls.filter((call) => call.writer === "append_trigger_context_source_outcome_v1"),
    ).toHaveLength(0);
    expect(dbCalls.at(-1)).toMatchObject({
      writer: "advance_trigger_stage_v1",
      arguments: {
        p_context_snapshot_ref: expect.any(String),
        p_context_snapshot_version: "1",
        p_context_snapshot_hash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
        p_context_snapshot_retention_until: "2026-08-30T00:00:00.000Z",
        p_context_source_outcomes: expect.arrayContaining([
          expect.objectContaining({ source: "knowthat" }),
          expect.objectContaining({ source: "memory" }),
          expect.objectContaining({ source: "skill" }),
          expect.objectContaining({ source: "environment" }),
          expect.objectContaining({ source: "history" }),
        ]),
        p_tool_permission_profile: expect.objectContaining({
          profile_ref: "tool-profile:1",
        }),
        p_skill_catalog_snapshot: expect.objectContaining({
          catalog_version: "cat_184",
          skill_permission_summary_ref: "skill-summary:1",
        }),
      },
    });
  });

  it("keeps ObjectStore ownership on context version while fencing the database with process state version", async () => {
    const dbCalls: Array<Readonly<Record<string, unknown>>> = [];
    const puts: PutImmutableRequestV1[] = [];
    const app = createTriggerLifecycleApplicationV1(
      database(dbCalls),
      dependencies(puts),
    );
    const request = {
      ...contextRequest,
      context_version: 7,
      idempotency_key: "process-1:context:7",
    };
    const claim = {
      ...workClaim,
      expected_process_state_version: 42,
    };

    await expect(
      app.composeContext(request, claim),
    ).resolves.toMatchObject({
      details: { context_snapshot_version: 7 },
    });
    expect(puts[0]).toMatchObject({
      owner_object_id: "process-1",
      owner_state_version: 7,
    });
    expect(dbCalls.at(-1)).toMatchObject({
      arguments: {
        p_expected_process_state_version: "42",
        p_context_snapshot_version: "7",
      },
    });
  });

  it("pins request and work-claim values before asynchronous source reads", async () => {
    const dbCalls: Array<Readonly<Record<string, unknown>>> = [];
    const puts: PutImmutableRequestV1[] = [];
    const base = dependencies(puts);
    let releaseEnvironment!: () => void;
    const environmentGate = new Promise<void>((resolve) => {
      releaseEnvironment = resolve;
    });
    let observedRequest: ContextComposeRequestV1 | undefined;
    const app = createTriggerLifecycleApplicationV1(database(dbCalls), {
      ...base,
      context_sources: {
        ...base.context_sources,
        environment: {
          async fetch(request, signal) {
            observedRequest = request;
            await environmentGate;
            return base.context_sources.environment.fetch(request, signal);
          },
        },
      },
    });
    const mutableRequest = structuredClone(contextRequest);
    const mutableClaim = structuredClone(workClaim);
    const pending = app.composeContext(mutableRequest, mutableClaim);

    Reflect.set(mutableRequest, "idempotency_key", "mutated:context:key");
    Reflect.set(mutableRequest, "trace_id", "trace-mutated");
    Reflect.set(mutableRequest.source_policy, "required_sources", []);
    Reflect.set(mutableClaim, "claim_token", "mutated-claim-token");
    releaseEnvironment();

    await expect(pending).resolves.toMatchObject({
      code: "context_composed",
      trace_id: contextRequest.trace_id,
    });
    expect(observedRequest).toMatchObject(contextRequest);
    expect(Object.isFrozen(observedRequest)).toBe(true);
    expect(Object.isFrozen(observedRequest?.source_policy)).toBe(true);
    expect(dbCalls[0]).toMatchObject({
      transaction: {
        idempotency_key: contextRequest.idempotency_key,
        trace_id: contextRequest.trace_id,
      },
    });
    expect(dbCalls.at(-1)).toMatchObject({
      arguments: {
        p_claim_token: workClaim.claim_token,
        p_trace_id: contextRequest.trace_id,
      },
    });
  });

  it("atomically records all source outcomes when context composition fails", async () => {
    const dbCalls: Array<Readonly<Record<string, unknown>>> = [];
    const puts: PutImmutableRequestV1[] = [];
    const base = dependencies(puts);
    const app = createTriggerLifecycleApplicationV1(database(dbCalls), {
      ...base,
      context_sources: {
        ...base.context_sources,
        environment: {
          async fetch() {
            throw new Error("environment_unavailable");
          },
        },
      },
    });

    await expect(
      app.composeContext(contextRequest, workClaim),
    ).rejects.toMatchObject({
      reason_code: "environment_unavailable",
    } satisfies Partial<TriggerLifecycleStageErrorV1>);
    expect(puts).toHaveLength(0);
    expect(dbCalls.at(-1)).toMatchObject({
      writer: "advance_trigger_stage_v1",
      arguments: {
        p_progression: "context_failed",
        p_context_snapshot_ref: null,
        p_context_snapshot_version: null,
        p_context_snapshot_hash: null,
        p_context_snapshot_retention_until: null,
        p_context_source_outcomes: expect.arrayContaining([
          expect.objectContaining({
            source: "environment",
            status: "failed",
          }),
        ]),
      },
    });
    expect(
      dbCalls.filter(
        (call) =>
          call.writer ===
          "append_trigger_context_source_outcome_v1",
      ),
    ).toHaveLength(0);
  });

  it("preflights lifecycle JSON before recursive schemas and permits acyclic aliases", async () => {
    const calls: Array<Readonly<Record<string, unknown>>> = [];
    const sourceCalls: string[] = [];
    const baseDependencies = dependencies([]);
    const app = createTriggerLifecycleApplicationV1(database(calls), {
      ...baseDependencies,
      context_sources: contextSources(sourceCalls),
    });

    let deeplyNested: unknown = "leaf";
    for (let depth = 0; depth < 130; depth += 1) {
      deeplyNested = { child: deeplyNested };
    }
    await expect(
      app.composeContext(
        { ...contextRequest, undeclared_deep_value: deeplyNested },
        workClaim,
      ),
    ).rejects.toMatchObject({
      reason_code: "invalid_request",
    } satisfies Partial<TriggerLifecycleStageErrorV1>);

    let proxyTrapCalls = 0;
    const proxiedRequest = new Proxy(contextRequest, {
      getPrototypeOf() {
        proxyTrapCalls += 1;
        return Object.prototype;
      },
    });
    await expect(
      app.composeContext(proxiedRequest, workClaim),
    ).rejects.toMatchObject({
      reason_code: "invalid_request",
    } satisfies Partial<TriggerLifecycleStageErrorV1>);
    expect(proxyTrapCalls).toBe(0);
    expect(sourceCalls).toHaveLength(0);

    const aliasedSources = [
      "knowthat",
      "memory",
      "skill",
      "environment",
      "history",
    ] as const;
    await expect(
      app.composeContext(
        {
          ...contextRequest,
          source_policy: {
            required_sources: aliasedSources,
            allowed_sources: aliasedSources,
            skip_decisions: [],
          },
        },
        workClaim,
      ),
    ).resolves.toMatchObject({ code: "context_composed" });
  });

  it("does not advance PostgreSQL when immutable storage fails", async () => {
    const dbCalls: Array<Readonly<Record<string, unknown>>> = [];
    const app = createTriggerLifecycleApplicationV1(
      database(dbCalls),
      dependencies([], { failPut: true }),
    );
    await expect(app.composeContext(contextRequest, workClaim)).rejects.toThrow(
      "storage_unavailable",
    );
    expect(dbCalls).toEqual([]);
  });

  it("rejects expired or unparsable retention before writing ObjectStore", async () => {
    for (const retentionUntil of [at, "not-a-timestamp"]) {
      const dbCalls: Array<Readonly<Record<string, unknown>>> = [];
      const puts: PutImmutableRequestV1[] = [];
      const base = dependencies(puts);
      const app = createTriggerLifecycleApplicationV1(database(dbCalls), {
        ...base,
        context_retention_until: () => retentionUntil,
      });

      await expect(app.composeContext(contextRequest, workClaim)).rejects.toMatchObject({
        reason_code: "context_retention_invalid",
      } satisfies Partial<TriggerLifecycleStageErrorV1>);
      expect(puts).toHaveLength(0);
      expect(dbCalls).toHaveLength(0);
    }
  });

  it("replays the same object after an ambiguous database commit", async () => {
    const dbCalls: Array<Readonly<Record<string, unknown>>> = [];
    const puts: PutImmutableRequestV1[] = [];
    const app = createTriggerLifecycleApplicationV1(
      database(dbCalls, { failAfterWorkOnce: true }),
      dependencies(puts),
    );
    await expect(app.composeContext(contextRequest, workClaim)).rejects.toThrow(
      "commit_then_disconnect",
    );
    await expect(app.composeContext(contextRequest, workClaim)).resolves.toMatchObject({
      code: "context_composed",
    });
    expect(puts).toHaveLength(2);
    expect(puts[0]?.idempotency_key).toBe(puts[1]?.idempotency_key);
    expect(puts[0]?.expected_sha256).toBe(puts[1]?.expected_sha256);
    expect(puts[0]?.size_bytes).toBe(puts[1]?.size_bytes);
  });

  it("does not wedge recovery when source facts advance after DB rollback", async () => {
    const dbCalls: Array<Readonly<Record<string, unknown>>> = [];
    const puts: PutImmutableRequestV1[] = [];
    const base = dependencies(puts);
    let catalogRevision = 0;
    const app = createTriggerLifecycleApplicationV1(
      database(dbCalls, { failAfterWorkOnce: true }),
      {
        ...base,
        context_sources: {
          ...base.context_sources,
          skill: {
            async fetch() {
              catalogRevision += 1;
              return {
                source_as_of: at,
                source_version: `cat_${catalogRevision}`,
                skill_catalog: {
                  catalog_version: `cat_${catalogRevision}`,
                  catalog_as_of: at,
                  items: [],
                },
              };
            },
          },
        },
        intent_policy_sources: {
          ...base.intent_policy_sources,
          skill_catalog: {
            async readFirstPage(request) {
              return {
                schema_version: "skill_catalog_response.v1",
                workspace_id: request.workspace_id,
                bot_id: request.bot_id,
                owner_agent_id: request.owner_agent_id,
                deployment_environment: request.deployment_environment,
                release_channel: request.release_channel,
                catalog_revision_id: `catalog-revision:${catalogRevision}`,
                catalog_version: `cat_${catalogRevision}`,
                as_of: at,
                security_revocation_epoch: 0,
                skill_permission_summary_ref: `skill-summary:${catalogRevision}`,
                skill_permission_summary_hash:
                  "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                items: [],
                next_cursor: null,
              };
            },
          },
        },
      },
    );

    await expect(app.composeContext(contextRequest, workClaim)).rejects.toThrow(
      "commit_then_disconnect",
    );
    await expect(app.composeContext(contextRequest, workClaim)).resolves.toMatchObject({
      code: "context_composed",
    });
    expect(puts).toHaveLength(2);
    expect(puts[0]?.expected_sha256).not.toBe(puts[1]?.expected_sha256);
    expect(puts[0]?.idempotency_key).not.toBe(puts[1]?.idempotency_key);
    expect(puts[0]?.idempotency_key).toMatch(/^process-1:context:1:sha256:/u);
    expect(puts[1]?.idempotency_key).toMatch(/^process-1:context:1:sha256:/u);
  });

  it("rejects a storage receipt that does not bind the uploaded bytes", async () => {
    const dbCalls: Array<Readonly<Record<string, unknown>>> = [];
    const base = dependencies([]);
    const app = createTriggerLifecycleApplicationV1(database(dbCalls), {
      ...base,
      object_store: {
        async putImmutable(request) {
          return {
            object_ref: "object:context-1" as ObjectRefV1,
            version: "1",
            sha256: `sha256:${"0".repeat(64)}`,
            size_bytes: request.size_bytes,
            media_type: request.media_type,
            retention_until: request.retention_until,
            replayed: false,
          };
        },
      },
    });
    await expect(app.composeContext(contextRequest, workClaim)).rejects.toMatchObject({
      stage: "context",
      reason_code: "object_store_result_binding_mismatch",
    } satisfies Partial<TriggerLifecycleStageErrorV1>);
    expect(dbCalls).toEqual([]);
  });

  it("does not treat a required source policy skip as a successful compose", async () => {
    const calls: string[] = [];
    const dbCalls: Array<Readonly<Record<string, unknown>>> = [];
    const base = dependencies([]);
    const app = createTriggerLifecycleApplicationV1(database(dbCalls), {
      ...base,
      context_sources: contextSources(calls),
    });
    await expect(
      app.composeContext(
        {
          ...contextRequest,
          source_policy: {
            required_sources: ["environment"],
            allowed_sources: ["knowthat", "memory", "skill", "history"],
            skip_decisions: [
              {
                source: "environment",
                policy_id: "isolation-policy-1",
                reason_code: "isolated_execution",
                source_owner: "trigger_processor",
              },
            ],
          },
        },
        workClaim,
      ),
    ).rejects.toThrow(/semantic binding mismatch/u);
    expect(calls).not.toContain("environment");
    expect(dbCalls).toHaveLength(0);
  });
});

describe("Trigger lifecycle intent validation", () => {
  it("rejects a model response whose policy or ordered intent binding drifts", async () => {
    const policyWithoutHash = {
      schema_version: "intent_policy_input_snapshot.v1",
      snapshot_ref: "intent-policy:1",
      workspace_id: "workspace-1",
      bot_id: "bot-1",
      owner_agent_id: "agent-1",
      deployment_environment: "dev",
      release_channel: "stable",
      bot_policy_revision_id: "policy-r1",
      personality_ref: "personality:1",
      personality_version: 1,
      personality_hash: `sha256:${"1".repeat(64)}`,
      safety_boundaries_ref: "safety:1",
      safety_boundaries_version: 1,
      safety_boundaries_hash: `sha256:${"2".repeat(64)}`,
      tool_permission_profile_ref: "tool-profile:1",
      tool_permission_profile_revision: 1,
      tool_permission_profile_hash: `sha256:${"3".repeat(64)}`,
      tool_policy_epoch: 1,
      catalog_version: "cat_184",
      catalog_as_of: at,
      security_revocation_epoch: 1,
      skill_permission_summary_ref: "skill-permissions:1",
      skill_permission_summary_hash: `sha256:${"4".repeat(64)}`,
    } as const;
    const policy: IntentPolicyInputSnapshotV1 = {
      ...policyWithoutHash,
      snapshot_hash: hash(policyWithoutHash),
    };
    const request: IntentSynthesizeRequestV1 = {
      schema_version: "intent_synthesize_request.v1",
      trigger_process_id: "process-1",
      workspace_id: "workspace-1",
      bot_id: "bot-1",
      owner_agent_id: "agent-1",
      deployment_environment: "dev",
      release_channel: "stable",
      trigger_ref: "trigger:1",
      intent_version: 1,
      context_snapshot_ref: "context:1",
      context_snapshot_version: 1,
      context_snapshot_hash: contextSnapshot().snapshot_hash,
      intent_policy_snapshot: policy,
      idempotency_key: "process-1:intent:1",
      trace_id: "trace-1",
    };
    const invalidIntent = {
      goal: "respond",
      user_need: "result",
      response_style: "concise",
      action_plan: [
        { step: 2, action_type: "respond" as const, action: "respond" },
      ],
      required_skills: [],
      memory_followups: [],
      safety_notes: [],
      requires_confirmation: false,
    };
    const response: IntentSynthesizeResponseV1 = {
      code: "intent_synthesized",
      message: "synthesized",
      retryable: false,
      trace_id: "trace-1",
      details: {
        intent_ref: "intent:1",
        intent_version: 1,
        intent_schema_version: "structured_intent.v1",
        structured_intent_hash: hash(invalidIntent),
        structured_intent: invalidIntent,
        policy_decision: "allow",
        intent_policy_snapshot: policy,
      },
    };
    const base = dependencies([]);
    const app = createTriggerLifecycleApplicationV1(database([]), {
      ...base,
      intent_engine: { async synthesize() { return response; } },
    });
    await expect(
      app.synthesizeIntent({ ...request, bot_id: "bot-other" }, workClaim),
    ).rejects.toThrow(/identity binding/u);
    await expect(app.synthesizeIntent(request, workClaim)).rejects.toThrow(/ordered DAG/u);
  });
});

describe("Trigger lifecycle confirmation fencing", () => {
  function confirmedRuntimeStart(): RuntimeStartRequestV1 {
    const intentPolicyWithoutHash = {
      schema_version: "intent_policy_input_snapshot.v1" as const,
      snapshot_ref: "intent-policy:process-1:1",
      workspace_id: "workspace-1",
      bot_id: "bot-1",
      owner_agent_id: "agent-1",
      deployment_environment: "dev" as const,
      release_channel: "stable" as const,
      bot_policy_revision_id: "bot-policy:1",
      personality_ref: "personality:1",
      personality_version: 1,
      personality_hash: `sha256:${"1".repeat(64)}`,
      safety_boundaries_ref: "safety:1",
      safety_boundaries_version: 1,
      safety_boundaries_hash: `sha256:${"2".repeat(64)}`,
      tool_permission_profile_ref: "tool-profile:1",
      tool_permission_profile_revision: 1,
      tool_permission_profile_hash: `sha256:${"3".repeat(64)}`,
      tool_policy_epoch: 1,
      catalog_version: "cat_184",
      catalog_as_of: at,
      security_revocation_epoch: 1,
      skill_permission_summary_ref: "skill-permissions:1",
      skill_permission_summary_hash: `sha256:${"4".repeat(64)}`,
    };
    const intentPolicy = {
      ...intentPolicyWithoutHash,
      snapshot_hash: hash(intentPolicyWithoutHash),
    };
    const structuredIntent = {
      goal: "execute confirmed action",
      user_need: "complete the workflow",
      response_style: "concise",
      action_plan: [
        {
          step: 1,
          action_type: "respond" as const,
          action: "return the confirmed result",
          requires_confirmation: true,
        },
      ],
      required_skills: [],
      memory_followups: [],
      safety_notes: [],
      requires_confirmation: true,
    };
    const policy = {
      schema_version: "runtime_policy_input.v1" as const,
      intent_policy_snapshot_ref: intentPolicy.snapshot_ref,
      intent_policy_snapshot_hash: intentPolicy.snapshot_hash,
      created_at: "2026-07-29T23:59:00.000Z",
      expires_at: "2026-07-30T00:30:00.000Z",
    };
    return {
      schema_version: "runtime_start.v1.2",
      trigger_process_id: "process-1",
      runtime_run_id: "runtime-1",
      workspace_id: "workspace-1",
      bot_id: "bot-1",
      owner_agent_id: "agent-1",
      deployment_environment: "dev",
      release_channel: "stable",
      start_attempt_no: 1,
      start_fence_token: "fence-1",
      intent_ref: "intent:process-1:1",
      intent_version: 1,
      structured_intent_hash: hash(structuredIntent),
      structured_intent: structuredIntent,
      context_snapshot_ref: "context:1",
      context_snapshot_version: 1,
      context_snapshot_hash: contextSnapshot().snapshot_hash,
      intent_policy_snapshot_ref: intentPolicy.snapshot_ref,
      intent_policy_snapshot_hash: intentPolicy.snapshot_hash,
      intent_policy_snapshot: intentPolicy,
      expected_catalog_version: "cat_184",
      catalog_as_of: at,
      allowed_tools: [],
      allowed_skills: [],
      planned_skills: [],
      policy_input_ref: "policy:process-1:1",
      policy_input_hash: hash(policy),
      policy,
      confirmation_ref: "confirmation:confirmation-1",
      confirmation_hash: `sha256:${"c".repeat(64)}`,
      preempt_token: "preempt-1",
      idempotency_key: "process-1:start:1",
      trace_id: "trace-1",
    };
  }

  it("blocks reservation before context reads when accepted owner proof is absent", async () => {
    const dbCalls: Array<Readonly<Record<string, unknown>>> = [];
    const base = dependencies([]);
    const app = createTriggerLifecycleApplicationV1(
      database(dbCalls),
      base,
    );
    await expect(
      app.reserveRuntimeStart(confirmedRuntimeStart(), workClaim),
    ).rejects.toMatchObject({
      reason_code: "confirmation_owner_unavailable",
    });
    expect(dbCalls).toEqual([]);
  });

  it("verifies the accepted challenge binding before creating the reservation", async () => {
    const dbCalls: Array<Readonly<Record<string, unknown>>> = [];
    const confirmationReads: unknown[] = [];
    const base = dependencies([]);
    const app = createTriggerLifecycleApplicationV1(database(dbCalls), {
      ...base,
      confirmations: {
        async assertAccepted(expected) {
          confirmationReads.push(expected);
        },
      },
    });
    await expect(
      app.reserveRuntimeStart(confirmedRuntimeStart(), workClaim),
    ).resolves.toBeUndefined();
    expect(confirmationReads).toEqual([
      expect.objectContaining({
        confirmation_ref: "confirmation:confirmation-1",
        trigger_process_id: "process-1",
        intent_ref: "intent:process-1:1",
        intent_version: 1,
      }),
    ]);
    expect(dbCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          writer: "create_runtime_start_reservation_v1",
        }),
      ]),
    );
  });
});

describe("Trigger lifecycle runtime completion", () => {
  const sourceEvent = {
    event_id: "runtime-event-1",
    event_type: "runtime.run.completed" as const,
    schema_version: "runtime_event.v1" as const,
    producer: "action_runtime" as const,
    occurred_at: at,
    idempotency_key: "runtime-event-1",
    trace_id: "trace-1",
    payload: {
      trigger_process_id: "process-1",
      runtime_run_id: "runtime-1",
      sequence_no: 1,
      workspace_id: "workspace-1",
      bot_id: "bot-1",
      owner_agent_id: "agent-1",
      deployment_environment: "dev" as const,
      release_channel: "stable" as const,
      start_attempt_no: 1,
      start_fence_generation: 7,
      status: "completed" as const,
      previous_status: "running" as const,
      next_status: "completed" as const,
      model: "claude-sonnet-4",
      reason: null,
      duration_ms: 1_000,
      reason_code: null,
      error_summary: null,
      terminal_artifact_ref: null,
    },
  };
  const appendRequest = {
    trigger_process_id: "process-1",
    runtime_run_id: "runtime-1",
    source_event_id: "runtime-event-1",
    source_service: "action_runtime" as const,
    source_sequence_no: 1,
    event_type: "runtime.run.completed" as const,
    schema_version: "runtime_event.v1",
    occurred_at: at,
    trace_id: "trace-1",
    append_type: "runtime_event" as const,
    payload_ref: "runtime_event:runtime-event-1",
    payload_hash: hash(sourceEvent),
    observation_summary: {
      runtime_run_id: "runtime-1",
      status: "completed",
      duration_ms: 1_000,
      reason_code: null,
      error_summary: null,
      artifact_ref: null,
    },
    idempotency_key: "action_runtime:runtime-event-1",
  };

  function callbackFor(
    eventType:
      | "runtime.run.started"
      | "runtime.run.failed"
      | "runtime.run.cancelled"
      | "runtime.run.preempted"
      | "runtime.control_signal.handled",
  ) {
    const eventId = `runtime-event:${eventType}`;
    const payload = eventType === "runtime.control_signal.handled"
      ? {
          trigger_process_id: "process-1",
          runtime_run_id: "runtime-1",
          sequence_no: 1,
          workspace_id: "workspace-1",
          bot_id: "bot-1",
          owner_agent_id: "agent-1",
          deployment_environment: "dev" as const,
          release_channel: "stable" as const,
          start_attempt_no: 1,
          start_fence_generation: 7,
          runtime_signal_id: "signal-1",
          signal_type: "cancel" as const,
          requested_by: "trigger_processor",
          control_valid_until: "2099-01-01T00:00:00.000Z",
          status: "handled" as const,
          handled_status: "handled_safe_point" as const,
          target_lease_generation: 3,
          handled_lease_generation: 3,
          final_fencing_generation: 8,
          safe_point_reached: true,
          late_events_isolated: true,
          last_runtime_sequence_no: 9,
          safe_point_ref: "safe-point-1",
          isolation_proof_ref: null,
          reason_code: null,
        }
      : {
          trigger_process_id: "process-1",
          runtime_run_id: "runtime-1",
          sequence_no: 1,
          workspace_id: "workspace-1",
          bot_id: "bot-1",
          owner_agent_id: "agent-1",
          deployment_environment: "dev" as const,
          release_channel: "stable" as const,
          start_attempt_no: 1,
          start_fence_generation: 7,
          status: eventType === "runtime.run.started"
            ? ("running" as const)
            : eventType === "runtime.run.failed"
              ? ("failed" as const)
              : ("cancelled" as const),
          previous_status: eventType === "runtime.run.started"
            ? ("queued" as const)
            : eventType === "runtime.run.cancelled"
              ? ("cancelling" as const)
              : eventType === "runtime.run.preempted"
                ? ("preempt_requested" as const)
                : ("running" as const),
          next_status: eventType === "runtime.run.started"
            ? ("running" as const)
            : eventType === "runtime.run.failed"
              ? ("failed" as const)
              : ("cancelled" as const),
          model: "claude-sonnet-4",
          reason: eventType === "runtime.run.started" ? null : "run_terminal",
          duration_ms: eventType === "runtime.run.started" ? null : 1_000,
          reason_code: eventType === "runtime.run.started" ? null : "run_terminal",
          error_summary: eventType === "runtime.run.failed" ? "failed" : null,
          terminal_artifact_ref: null,
        };
    const event = {
      event_id: eventId,
      event_type: eventType,
      schema_version: "runtime_event.v1" as const,
      producer: "action_runtime" as const,
      occurred_at: at,
      idempotency_key: eventId,
      trace_id: "trace-1",
      payload,
    };
    const observationSummary = eventType === "runtime.control_signal.handled"
      ? {
          runtime_signal_id: "signal-1",
          safe_point_ref: "safe-point-1",
          isolation_proof_ref: null,
          status: "handled",
          duration_ms: null,
          reason_code: null,
          error_summary: null,
          artifact_ref: null,
        }
      : {
          runtime_run_id: "runtime-1",
          status: payload.status,
          duration_ms: "duration_ms" in payload ? payload.duration_ms : null,
          reason_code: payload.reason_code,
          error_summary: "error_summary" in payload ? payload.error_summary : null,
          artifact_ref: null,
        };
    return {
      event,
      request: {
        trigger_process_id: "process-1",
        runtime_run_id: "runtime-1",
        source_event_id: eventId,
        source_service: "action_runtime" as const,
        source_sequence_no: 1,
        event_type: eventType,
        schema_version: "runtime_event.v1",
        occurred_at: at,
        trace_id: "trace-1",
        append_type: "runtime_event" as const,
        payload_ref: `runtime_event:${eventId}`,
        payload_hash: hash(event),
        observation_summary: observationSummary,
        idempotency_key: `action_runtime:${eventId}`,
      },
    };
  }

  it.each([
    ["runtime.run.started", "record_runtime_started_v1"],
    ["runtime.run.failed", "finalize_trigger_runtime_terminal_v1"],
    ["runtime.run.cancelled", "finalize_trigger_runtime_terminal_v1"],
    ["runtime.run.preempted", "finalize_trigger_runtime_terminal_v1"],
    ["runtime.control_signal.handled", "apply_runtime_control_handled_v1"],
  ] as const)("routes %s through its narrow owner transition", async (eventType, writerName) => {
    const callback = callbackFor(eventType);
    const calls: Array<Readonly<Record<string, unknown>>> = [];
    const app = createTriggerLifecycleApplicationV1(
      database(calls, {
        writerResult: {
          code: "snapshot_appended",
          message: "appended",
          retryable: false,
          trace_id: "trace-1",
          details: {
            trigger_process_id: "process-1",
            snapshot_version: 2,
            append_sequence_no: 2,
            last_sequence_by_source: { action_runtime: 1 },
            duplicate_replayed: false,
          },
        },
      }),
      dependencies([], { runtimeEvent: callback.event }),
    );

    await app.appendRuntimeEvent({
      request: callback.request,
      authenticated_principal: {
        sub: "action_runtime",
        aud: "trigger_processor",
        capability: ["trigger.process.snapshot.append"],
        scope_kind: "bot",
        workspace_id: "workspace-1",
        bot_id: "bot-1",
        owner_agent_id: "agent-1",
        deployment_environment: "dev",
        release_channel: "stable",
      },
    });
    expect(calls).toContainEqual(
      expect.objectContaining({
        writer: writerName,
        arguments: expect.objectContaining({
          p_append_request: callback.request,
          p_source_event: callback.event,
          p_owner_event_read: expect.objectContaining({
            runtime_event: callback.event,
            retention_until: "2026-08-30T00:00:00.000Z",
          }),
          p_expected_snapshot_retention_until:
            "2026-08-30T00:00:00.000Z",
        }),
      }),
    );
  });

  it("keeps a non-retryable owner event read rejection permanent", async () => {
    const callback = callbackFor("runtime.run.started");
    const app = createTriggerLifecycleApplicationV1(
      database([]),
      dependencies([], {
        runtimeResolveError: new InternalClientError({
          code: "event_expired",
          message: "Runtime event retention has expired",
          retryable: false,
          traceId: "11111111111111111111111111111111",
          status: 410,
        }),
      }),
    );

    await expect(
      app.appendRuntimeEvent({
        request: callback.request,
        authenticated_principal: {
          sub: "action_runtime",
          aud: "trigger_processor",
          capability: ["trigger.process.snapshot.append"],
          scope_kind: "bot",
          workspace_id: "workspace-1",
          bot_id: "bot-1",
          owner_agent_id: "agent-1",
          deployment_environment: "dev",
          release_channel: "stable",
        },
      }),
    ).rejects.toMatchObject({ reason_code: "runtime_event_owner_rejected" });
  });

  it("lets the owner writer build the next snapshot under its DB lock", async () => {
    const calls: Array<Readonly<Record<string, unknown>>> = [];
    const runtimeResolveRequests: unknown[] = [];
    const app = createTriggerLifecycleApplicationV1(
      database(calls, {
        writerResult: {
          code: "snapshot_appended",
          message: "appended",
          retryable: false,
          trace_id: "trace-1",
          details: {
            trigger_process_id: "process-1",
            snapshot_version: 2,
            append_sequence_no: 2,
            last_sequence_by_source: { action_runtime: 1 },
            duplicate_replayed: false,
          },
        },
      }),
      dependencies([], { runtimeEvent: sourceEvent, runtimeResolveRequests }),
    );

    await expect(
      app.appendRuntimeEvent({
        request: appendRequest,
        authenticated_principal: {
          sub: "action_runtime",
          aud: "trigger_processor",
          capability: ["trigger.process.snapshot.append"],
          scope_kind: "bot",
          workspace_id: "workspace-1",
          bot_id: "bot-1",
          owner_agent_id: "agent-1",
          deployment_environment: "dev",
          release_channel: "stable",
        },
        // A transport may carry extra JSON, but it must never become a
        // caller-supplied completed snapshot or append sequence.
        next_snapshot: { snapshot_hash: "caller-controlled" },
      } as never),
    ).resolves.toMatchObject({ code: "snapshot_appended" });
    const writer = calls.find(
      (call) => call.writer === "enter_trigger_cooldown_v1",
    ) as Readonly<{ arguments: Readonly<Record<string, unknown>> }>;
    expect(writer.arguments).toMatchObject({
      p_process_id: "process-1",
      p_source_event: sourceEvent,
      p_owner_event_read: {
        runtime_event: sourceEvent,
        retention_until: "2026-08-30T00:00:00.000Z",
      },
      p_expected_snapshot_retention_until: "2026-08-30T00:00:00.000Z",
    });
    expect(writer.arguments).not.toHaveProperty("p_snapshot_manifest");
    expect(writer.arguments).not.toHaveProperty("p_append_sequence_no");
    expect(runtimeResolveRequests).toEqual([
      {
        schema_version: "runtime_event_resolve_request.v1",
        source_event_id: "runtime-event-1",
        payload_ref: "runtime_event:runtime-event-1",
        runtime_run_id: "runtime-1",
        trigger_process_id: "process-1",
        source_sequence_no: 1,
        expected_payload_hash: hash(sourceEvent),
        workspace_id: "workspace-1",
        bot_id: "bot-1",
        owner_agent_id: "agent-1",
        deployment_environment: "dev",
        release_channel: "stable",
        purpose: "trigger_snapshot_append",
        trace_id: "trace-1",
      },
    ]);
  });

  it("bootstraps the first runtime snapshot retention from its verified owner event", async () => {
    const calls: Array<Readonly<Record<string, unknown>>> = [];
    const app = createTriggerLifecycleApplicationV1(
      database(calls, {
        writerResult: {
          code: "snapshot_appended",
          message: "appended",
          retryable: false,
          trace_id: "trace-1",
          details: {
            trigger_process_id: "process-1",
            snapshot_version: 2,
            append_sequence_no: 2,
            last_sequence_by_source: { action_runtime: 1 },
            duplicate_replayed: false,
          },
        },
      }),
      dependencies([], {
        runtimeEvent: callbackFor("runtime.run.started").event,
        snapshotRetentionUntil: undefined,
      }),
    );

    const callback = callbackFor("runtime.run.started");
    await expect(app.appendRuntimeEvent({
      request: callback.request,
      authenticated_principal: {
        sub: "action_runtime",
        aud: "trigger_processor",
        capability: ["trigger.process.snapshot.append"],
        scope_kind: "bot",
        workspace_id: "workspace-1",
        bot_id: "bot-1",
        owner_agent_id: "agent-1",
        deployment_environment: "dev",
        release_channel: "stable",
      },
    })).resolves.toMatchObject({ code: "snapshot_appended" });
    expect(calls).toContainEqual(expect.objectContaining({
      writer: "record_runtime_started_v1",
      arguments: expect.objectContaining({
        p_expected_snapshot_retention_until: "2026-08-30T00:00:00.000Z",
      }),
    }));
  });

  it("fails closed when the owner writer returns another process identity", async () => {
    const app = createTriggerLifecycleApplicationV1(
      database([], {
        writerResult: {
          code: "snapshot_appended",
          message: "appended",
          retryable: false,
          trace_id: "trace-1",
          details: {
            trigger_process_id: "process-other",
            snapshot_version: 2,
            append_sequence_no: 2,
            last_sequence_by_source: { action_runtime: 1 },
            duplicate_replayed: false,
          },
        },
      }),
      dependencies([], { runtimeEvent: sourceEvent }),
    );
    await expect(
      app.appendRuntimeEvent({
        request: appendRequest,
        authenticated_principal: {
          sub: "action_runtime",
          aud: "trigger_processor",
          capability: ["trigger.process.snapshot.append"],
          scope_kind: "bot",
          workspace_id: "workspace-1",
          bot_id: "bot-1",
          owner_agent_id: "agent-1",
          deployment_environment: "dev",
          release_channel: "stable",
        },
      }),
    ).rejects.toMatchObject({ reason_code: "writer_response_invalid" });
  });

  it("rejects owner bytes retained for less time than the current Process before mutation", async () => {
    const calls: Array<Readonly<Record<string, unknown>>> = [];
    const retentionReadRequests: unknown[] = [];
    const app = createTriggerLifecycleApplicationV1(
      database(calls),
      dependencies([], {
        runtimeEvent: sourceEvent,
        runtimeRetentionUntil: "2026-08-30T00:00:00.123455Z",
        snapshotRetentionUntil: "2026-08-30T00:00:00.123456Z",
        retentionReadRequests,
      }),
    );

    await expect(
      app.appendRuntimeEvent({
        request: appendRequest,
        authenticated_principal: {
          sub: "action_runtime",
          aud: "trigger_processor",
          capability: ["trigger.process.snapshot.append"],
          scope_kind: "bot",
          workspace_id: "workspace-1",
          bot_id: "bot-1",
          owner_agent_id: "agent-1",
          deployment_environment: "dev",
          release_channel: "stable",
        },
      }),
    ).rejects.toMatchObject({
      reason_code: "runtime_event_owner_retention_insufficient",
    });
    expect(retentionReadRequests).toEqual([
      {
        trigger_process_id: "process-1",
        workspace_id: "workspace-1",
        bot_id: "bot-1",
        owner_agent_id: "agent-1",
        deployment_environment: "dev",
        release_channel: "stable",
      },
    ]);
    expect(calls).toEqual([]);
  });
});
