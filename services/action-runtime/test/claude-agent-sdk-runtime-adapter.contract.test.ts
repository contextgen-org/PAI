import type {
  CanUseTool,
  Options as ClaudeAgentSdkOptions,
  SDKMessage,
  SdkMcpToolDefinition,
} from "@anthropic-ai/claude-agent-sdk";
import type {
  ContextSnapshotV1,
  RuntimeStartRequestV1,
} from "@pai/contracts";
import { canonicalJsonV1, canonicalPayloadHashV1 } from "@pai/eventing";
import { describe, expect, it, vi } from "vitest";

import {
  ClaudeAgentSdkRuntimeAdapter,
  createClaudeAgentSdkPermissionHookV1,
  type ClaudeAgentSdkQueryFactoryV1,
} from "../src/claude-agent-sdk-runtime-adapter.v1.js";
import type {
  RuntimeAdapterContextV1,
  RuntimeAdapterTurnV1,
  RuntimeSkillMaterializationV1,
} from "../src/runtime-execution.v1.js";
import { assertRuntimeSkillMaterializationManifestV1 } from "../src/runtime-execution.v1.js";

const at = "2026-07-23T04:00:00.000Z";
const deadline = "2026-07-23T04:30:00.000Z";
const hash = `sha256:${"a".repeat(64)}` as const;

function contextSnapshot(): ContextSnapshotV1 {
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
    skill_catalog: {
      catalog_version: "catalog-184",
      catalog_as_of: at,
      items: [],
    },
    environment: {
      captured_at: at,
      channel: "chat",
      timezone: "Asia/Shanghai",
      capability_summary_ref: "capability-summary:1",
    },
    history: [],
    source_status: [
      { source: "knowthat" as const, status: "empty" as const, retrieved_at: at, source_as_of: at, source_version: "knowthat.v1", latency_ms: 1, result_count: 0, failure_reason: null },
      { source: "memory" as const, status: "empty" as const, retrieved_at: at, source_as_of: at, source_version: "memory.v1", latency_ms: 1, result_count: 0, failure_reason: null },
      { source: "skill" as const, status: "empty" as const, retrieved_at: at, source_as_of: at, source_version: "catalog-184", latency_ms: 1, result_count: 0, failure_reason: null },
      { source: "environment" as const, status: "ok" as const, retrieved_at: at, source_as_of: at, source_version: "environment.v1", latency_ms: 1, result_count: 1, failure_reason: null },
      { source: "history" as const, status: "empty" as const, retrieved_at: at, source_as_of: at, source_version: "history.v1", latency_ms: 1, result_count: 0, failure_reason: null },
    ],
    assembly_notes: [],
  };
  return {
    ...partial,
    snapshot_hash: canonicalPayloadHashV1(partial),
  };
}

const snapshot = contextSnapshot();

function request(
  overrides: Partial<RuntimeStartRequestV1> = {},
): RuntimeStartRequestV1 & {
  readonly tool_authorizations: Readonly<Record<string, string>>;
} {
  return {
    schema_version: "runtime_start.v1.2",
    trigger_process_id: "process-1",
    runtime_run_id: "run-1",
    workspace_id: "workspace-1",
    bot_id: "bot-1",
    owner_agent_id: "agent-1",
    deployment_environment: "dev",
    release_channel: "stable",
    start_attempt_no: 1,
    start_fence_token: "start-fence-1",
    intent_ref: "intent:process-1:1",
    intent_version: 1,
    structured_intent_hash: hash,
    structured_intent: {
      goal: "return an exact durable answer",
      user_need: "an answer",
      response_style: "concise",
      action_plan: [
        {
          step: 1,
          action_type: "tool_use",
          action: "use the approved search tool",
          candidate_tool: "search",
          capability_scope_required: ["search.read"],
        },
      ],
      required_skills: [],
      memory_followups: [],
      safety_notes: [],
      requires_confirmation: false,
    },
    context_snapshot_ref: "context:process-1:1",
    context_snapshot_version: 1,
    context_snapshot_hash: snapshot.snapshot_hash,
    intent_policy_snapshot_ref: "intent-policy:run-1:1",
    intent_policy_snapshot_hash: hash,
    intent_policy_snapshot: {
      schema_version: "intent_policy_input_snapshot.v1",
      snapshot_ref: "intent-policy:run-1:1",
      snapshot_hash: hash,
      workspace_id: "workspace-1",
      bot_id: "bot-1",
      owner_agent_id: "agent-1",
      deployment_environment: "dev",
      release_channel: "stable",
      bot_policy_revision_id: "bot-policy:1",
      personality_ref: "personality:1",
      personality_version: 1,
      personality_hash: hash,
      safety_boundaries_ref: "safety:1",
      safety_boundaries_version: 1,
      safety_boundaries_hash: hash,
      tool_permission_profile_ref: "tool-profile:1",
      tool_permission_profile_revision: 1,
      tool_permission_profile_hash: hash,
      tool_policy_epoch: 1,
      catalog_version: "catalog-184",
      catalog_as_of: at,
      security_revocation_epoch: 1,
      skill_permission_summary_ref: "skill-permission:1",
      skill_permission_summary_hash: hash,
    },
    expected_catalog_version: "catalog-184",
    catalog_as_of: at,
    allowed_tools: ["search"],
    tool_authorizations: { search: "search.read" },
    allowed_skills: [],
    planned_skills: [],
    policy_input_ref: "policy:run-1:1",
    policy_input_hash: hash,
    policy: {
      schema_version: "runtime_policy_input.v1",
      intent_policy_snapshot_ref: "intent-policy:run-1:1",
      intent_policy_snapshot_hash: hash,
      created_at: at,
      expires_at: "2026-07-24T04:00:00.000Z",
    },
    confirmation_ref: null,
    confirmation_hash: null,
    preempt_token: "preempt-secret",
    idempotency_key: "process-1:start:1",
    trace_id: "trace-1",
    ...overrides,
  };
}

function adapterContext(
  overrides: Partial<RuntimeAdapterContextV1> = {},
): RuntimeAdapterContextV1 {
  return {
    runtime_run_id: "run-1",
    trigger_process_id: "process-1",
    lease_generation: 7,
    deadline_at: deadline,
    signal: new AbortController().signal,
    context_snapshot: snapshot,
    ...overrides,
  };
}

function sdkMessage(value: unknown): SDKMessage {
  return value as SDKMessage;
}

function digest(value: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function successMessage(result: string): SDKMessage {
  return sdkMessage({
    type: "result",
    subtype: "success",
    result,
    session_id: "sdk-session-1",
  });
}

function queryFrom(
  messages: readonly SDKMessage[],
  controls = {
    close: vi.fn(),
    interrupt: vi.fn(async () => undefined),
  },
): ReturnType<ClaudeAgentSdkQueryFactoryV1> {
  return {
    ...controls,
    async *[Symbol.asyncIterator]() {
      for (const message of messages) yield message;
    },
  };
}

function adapterOptions(
  queryFactory: ClaudeAgentSdkQueryFactoryV1,
  overrides: Readonly<Record<string, unknown>> = {},
) {
  return {
    model: "claude-sonnet-pinned",
    sandbox_cwd: "/tmp/pai-action-runtime-test",
    provider_env: {
      PATH: "/usr/bin:/bin",
      ANTHROPIC_API_KEY: "test-key",
    },
    now: () => new Date(at),
    id_factory: () => "adapter-session-1",
    query_factory: queryFactory,
    ...overrides,
  };
}

describe("ClaudeAgentSdkRuntimeAdapter contract", () => {
  it("publishes only textual SDK deltas to the ephemeral token side stream", async () => {
    let observedOptions: ClaudeAgentSdkOptions | undefined;
    const publish = vi.fn(async () => undefined);
    const adapter = new ClaudeAgentSdkRuntimeAdapter(
      adapterOptions(
        (parameters) => {
          observedOptions = parameters.options;
          return queryFrom([
            sdkMessage({
              type: "stream_event",
              event: {
                type: "content_block_delta",
                index: 0,
                delta: { type: "text_delta", text: "live-token" },
              },
              parent_tool_use_id: null,
              uuid: "stream-event-1",
              session_id: "sdk-session-1",
            }),
            sdkMessage({
              type: "stream_event",
              event: {
                type: "content_block_delta",
                index: 0,
                delta: { type: "thinking_delta", thinking: "private" },
              },
              parent_tool_use_id: null,
              uuid: "stream-event-2",
              session_id: "sdk-session-1",
            }),
            successMessage("complete"),
          ]);
        },
        { token_publisher: { publish } },
      ),
    );
    const session = await adapter.start(request(), adapterContext());
    await expect(adapter.next(session, adapterContext())).resolves.toMatchObject({
      kind: "artifact",
    });
    expect(observedOptions?.includePartialMessages).toBe(true);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(
      {
        runtime_run_id: "run-1",
        trigger_process_id: "process-1",
        scope: {
          workspace_id: "workspace-1",
          bot_id: "bot-1",
          owner_agent_id: "agent-1",
          deployment_environment: "dev",
          release_channel: "stable",
        },
        token: "live-token",
        emitted_at: at,
      },
      expect.any(AbortSignal),
    );
    expect(JSON.stringify(publish.mock.calls)).not.toContain("private");
    await adapter.cancel(session, "test_cleanup");
  });

  it("snapshots constructor options and provider env before validation can be raced", async () => {
    let observedOptions: ClaudeAgentSdkOptions | undefined;
    const mutableOptions = adapterOptions((parameters) => {
      observedOptions = parameters.options;
      return queryFrom([successMessage("stable")]);
    });
    const adapter = new ClaudeAgentSdkRuntimeAdapter(mutableOptions);

    mutableOptions.model = "attacker-controlled-model";
    mutableOptions.sandbox_cwd = "/";
    mutableOptions.provider_env.ANTHROPIC_API_KEY = "replaced-key";
    mutableOptions.provider_env.PATH = "/attacker/bin";
    Object.assign(mutableOptions.provider_env, {
      DATABASE_URL: "must-never-be-forwarded",
    });

    const session = await adapter.start(request(), adapterContext());
    await adapter.next(session, adapterContext());

    expect(adapter.model).toBe("claude-sonnet-pinned");
    expect(observedOptions?.model).toBe("claude-sonnet-pinned");
    expect(observedOptions?.env).toMatchObject({
      ANTHROPIC_API_KEY: "test-key",
      PATH: "/usr/bin:/bin",
    });
    expect(observedOptions?.env).not.toHaveProperty("DATABASE_URL");
    expect(observedOptions?.env).not.toBe(mutableOptions.provider_env);
    expect(observedOptions).not.toBe(mutableOptions);
    await adapter.cancel(session, "test_cleanup");

    let getterReads = 0;
    const accessorOptions = adapterOptions(() => queryFrom([]));
    Object.defineProperty(accessorOptions, "model", {
      enumerable: true,
      get() {
        getterReads += 1;
        return "must-not-be-read";
      },
    });
    expect(
      () => new ClaudeAgentSdkRuntimeAdapter(accessorOptions),
    ).toThrow(/own data properties/u);
    expect(getterReads).toBe(0);
  });

  it("locks the official SDK identity, isolates provider options, and maps final output through ObjectStore artifact flow", async () => {
    let observedOptions: ClaudeAgentSdkOptions | undefined;
    const queryFactory: ClaudeAgentSdkQueryFactoryV1 = (parameters) => {
      observedOptions = parameters.options;
      expect(parameters.prompt).toContain(snapshot.snapshot_hash);
      expect(parameters.prompt).not.toContain("preempt-secret");
      expect(parameters.prompt).not.toContain("start-fence-1");
      return queryFrom([successMessage("final answer")]);
    };
    const adapter = new ClaudeAgentSdkRuntimeAdapter(
      adapterOptions(queryFactory),
    );

    expect(adapter).toMatchObject({
      adapter_id: "ClaudeAgentSdkRuntimeAdapter",
      sdk_package: "@anthropic-ai/claude-agent-sdk",
      sdk_version: "0.3.212",
    });
    for (const identityField of [
      "adapter_id",
      "sdk_package",
      "sdk_version",
      "model",
    ] as const) {
      expect(
        Object.getOwnPropertyDescriptor(adapter, identityField),
      ).toMatchObject({
        enumerable: true,
        writable: false,
        configurable: false,
      });
    }
    const session = await adapter.start(request(), adapterContext());
    const artifactTurn = await adapter.next(session, adapterContext());

    const runCwd = observedOptions?.cwd;
    expect(runCwd).toMatch(
      /^\/tmp\/pai-action-runtime-test\/pai-run-[A-Za-z0-9]+$/u,
    );
    expect(observedOptions).toMatchObject({
      model: "claude-sonnet-pinned",
      tools: [],
      skills: [],
      plugins: [],
      strictMcpConfig: true,
      settingSources: ["project"],
      persistSession: false,
      permissionMode: "dontAsk",
    });
    expect(observedOptions?.env).toEqual({
      PATH: "/usr/bin:/bin",
      ANTHROPIC_API_KEY: "test-key",
      HOME: runCwd,
      CLAUDE_CONFIG_DIR: join(
        runCwd ?? "",
        ".claude-config",
      ),
      TMPDIR: join(runCwd ?? "", ".tmp"),
      CLAUDE_AGENT_SDK_CLIENT_APP:
        "project-pai-action-runtime/1.0.0",
    });
    expect(artifactTurn).toMatchObject({
      kind: "artifact",
      artifact: {
        artifact_id: "run-1:sdk-final",
        artifact_kind: "runtime-final-result",
        media_type: "text/plain; charset=utf-8",
      },
    });
    if (artifactTurn.kind !== "artifact") throw new Error("artifact expected");
    expect(new TextDecoder().decode(artifactTurn.artifact.body)).toBe(
      "final answer",
    );

    await expect(
      adapter.next(
        session,
        adapterContext({
          last_artifact_id: artifactTurn.artifact.artifact_id,
          last_artifact_ref: "object:runtime-final",
        }),
      ),
    ).resolves.toEqual({
      kind: "complete",
      terminal_artifact_ref: "object:runtime-final",
    });
  });

  it("bridges an SDK MCP tool use through the durable permission hook and returns the exact audited result", async () => {
    const definitions: Array<{
      name: string;
      handler: (
        args: Readonly<Record<string, unknown>>,
        extra: unknown,
      ) => Promise<unknown>;
    }> = [];
    let sdkOptions: ClaudeAgentSdkOptions | undefined;
    let finishProvider: (() => void) | undefined;
    const providerGate = new Promise<void>((resolve) => {
      finishProvider = resolve;
    });
    const queryFactory: ClaudeAgentSdkQueryFactoryV1 = (parameters) => {
      sdkOptions = parameters.options;
      return {
        close: vi.fn(),
        interrupt: vi.fn(async () => undefined),
        async *[Symbol.asyncIterator]() {
          await providerGate;
          yield sdkMessage({
            type: "assistant",
            error: "rate_limit",
            session_id: "sdk-session-1",
          });
          yield sdkMessage({
            type: "result",
            subtype: "error_during_execution",
            terminal_reason: "api_error",
            session_id: "sdk-session-1",
          });
        },
      };
    };
    const toolFactory = (
      name: string,
      _description: string,
      _schema: Readonly<Record<string, unknown>>,
      handler: (
        args: Readonly<Record<string, unknown>>,
        extra: unknown,
      ) => Promise<unknown>,
    ) => {
      definitions.push({ name, handler });
      return { name, handler } as unknown as SdkMcpToolDefinition;
    };
    const adapter = new ClaudeAgentSdkRuntimeAdapter(
      adapterOptions(queryFactory, {
        tool_factory: toolFactory,
        mcp_server_factory: (() => ({
          type: "sdk",
          name: "pai_runtime",
          instance: {},
        })) as never,
      }),
    );
    const session = await adapter.start(request(), adapterContext());
    const input = {
      arguments: { query: "bounded" },
    };
    const canUseTool = sdkOptions?.canUseTool;
    if (canUseTool === undefined) throw new Error("permission hook missing");
    await expect(
      canUseTool(
        "mcp__pai_runtime__search",
        input,
        {
          signal: new AbortController().signal,
          toolUseID: "sdk-tool-1",
        } as Parameters<CanUseTool>[2],
      ),
    ).resolves.toMatchObject({ behavior: "allow" });
    await expect(
      canUseTool(
        "Bash",
        { command: "whoami" },
        {
          signal: new AbortController().signal,
          toolUseID: "sdk-tool-denied",
        } as Parameters<CanUseTool>[2],
      ),
    ).resolves.toMatchObject({ behavior: "deny" });

    const search = definitions.find(({ name }) => name === "search");
    if (search === undefined) throw new Error("search bridge missing");
    const providerToolResult = search.handler(input, {});
    input.arguments.query = "admin-after-enqueue";
    await expect(adapter.next(session, adapterContext())).resolves.toEqual({
      kind: "tool_call",
      call: {
        tool_call_id: "sdk-tool-1",
        tool_name: "search",
        capability: "search.read",
        arguments: { query: "bounded" },
      },
    });

    const terminalPromise = adapter.next(
      session,
      adapterContext({
        last_tool_call_id: "sdk-tool-1",
        last_tool_result: {
          outcome: "completed",
          retryable: false,
          side_effect_status: "produced",
          output: { hits: 1 },
          external_response_ref: "evidence:search:1",
        },
      }),
    );
    const providerResult = await providerToolResult;
    expect(providerResult).toMatchObject({
      content: [
        {
          type: "text",
          text: expect.stringContaining('"side_effect_status":"produced"'),
        },
      ],
    });
    expect(JSON.stringify(providerResult)).not.toContain(
      "evidence:search:1",
    );
    finishProvider?.();
    await expect(terminalPromise).resolves.toEqual({
      kind: "failed",
      retryable: false,
      reason_code: "sdk_execution_failed",
      error_summary:
        "Claude Agent SDK ended with error_during_execution",
    });
  });

  it("does not invent a tool-use id when the SDK permission hook was bypassed", async () => {
    const definitions: Array<{
      name: string;
      handler: (
        args: Readonly<Record<string, unknown>>,
        extra: unknown,
      ) => Promise<unknown>;
    }> = [];
    const adapter = new ClaudeAgentSdkRuntimeAdapter(
      adapterOptions(
        () =>
          queryFrom([
            sdkMessage({
              type: "result",
              subtype: "error_max_turns",
              session_id: "sdk-session-1",
            }),
          ]),
        {
          tool_factory: ((
            name: string,
            _description: string,
            _schema: Readonly<Record<string, unknown>>,
            handler: (
              args: Readonly<Record<string, unknown>>,
              extra: unknown,
            ) => Promise<unknown>,
          ) => {
            definitions.push({ name, handler });
            return { name, handler } as unknown as SdkMcpToolDefinition;
          }) as never,
          mcp_server_factory: (() => ({
            type: "sdk",
            name: "pai_runtime",
            instance: {},
          })) as never,
        },
      ),
    );
    const session = await adapter.start(request(), adapterContext());
    const search = definitions.find(({ name }) => name === "search");
    if (search === undefined) throw new Error("search bridge missing");
    await expect(
      search.handler(
        {
          arguments: { query: "must-not-dispatch" },
        },
        {},
      ),
    ).resolves.toMatchObject({
      isError: true,
      content: [
        {
          type: "text",
          text: expect.stringContaining(
            '"code":"tool_permission_hook_missing"',
          ),
        },
      ],
    });
    await expect(adapter.next(session, adapterContext())).resolves.toMatchObject(
      {
        kind: "failed",
        reason_code: "sdk_max_turns",
      },
    );
  });

  it("materializes an exact frozen skill in the per-run project and reloads it through the native SDK discovery path", async () => {
    const definitions: Array<{
      name: string;
      handler: (
        args: Readonly<Record<string, unknown>>,
        extra: unknown,
      ) => Promise<unknown>;
    }> = [];
    let sdkOptions: ClaudeAgentSdkOptions | undefined;
    let finishProvider: (() => void) | undefined;
    const providerGate = new Promise<void>((resolve) => {
      finishProvider = resolve;
    });
    const reloadSkills = vi.fn(async () => ({
      skills: [
        {
          name: "calendar-assistant",
          description: "Use the frozen calendar workflow",
          argumentHint: "",
        },
      ],
    }));
    const queryFactory: ClaudeAgentSdkQueryFactoryV1 = (parameters) => {
      sdkOptions = parameters.options;
      return {
        close: vi.fn(),
        interrupt: vi.fn(async () => undefined),
        reloadSkills,
        async *[Symbol.asyncIterator]() {
          await providerGate;
          yield sdkMessage({
            type: "result",
            subtype: "error_max_turns",
            session_id: "sdk-session-1",
          });
        },
      };
    };
    const adapter = new ClaudeAgentSdkRuntimeAdapter(
      adapterOptions(queryFactory, {
        tool_factory: ((
          name: string,
          _description: string,
          _schema: Readonly<Record<string, unknown>>,
          handler: (
            args: Readonly<Record<string, unknown>>,
            extra: unknown,
          ) => Promise<unknown>,
        ) => {
          definitions.push({ name, handler });
          return { name, handler } as unknown as SdkMcpToolDefinition;
        }) as never,
        mcp_server_factory: (() => ({
          type: "sdk",
          name: "pai_runtime",
          instance: {},
        })) as never,
      }),
    );
    const skillRequest = request({
      allowed_skills: ["calendar-assistant"],
      planned_skills: ["calendar-assistant"],
    });
    const session = await adapter.start(
      skillRequest,
      adapterContext(),
    );
    expect(sdkOptions).toMatchObject({
      tools: ["Skill"],
      skills: ["calendar-assistant"],
      settingSources: ["project"],
    });
    const permission = sdkOptions?.canUseTool;
    if (permission === undefined) throw new Error("permission hook missing");
    const skillInput = {
      skill_name: "calendar-assistant",
      runtime_run_id: "run-1",
      idempotency_key: "run-1:skill:calendar-assistant",
    };
    await expect(
      permission(
        "mcp__pai_runtime__skill.load",
        skillInput,
        {
          signal: new AbortController().signal,
          toolUseID: "sdk-skill-load-1",
        } as Parameters<CanUseTool>[2],
      ),
    ).resolves.toMatchObject({ behavior: "allow" });
    await expect(
      permission(
        "Skill",
        { skill: "calendar-assistant" },
        {
          signal: new AbortController().signal,
          toolUseID: "sdk-native-skill-1",
        } as Parameters<CanUseTool>[2],
      ),
    ).resolves.toMatchObject({ behavior: "allow" });
    const skillLoad = definitions.find(
      ({ name }) => name === "skill.load",
    );
    if (skillLoad === undefined) throw new Error("skill bridge missing");
    const providerSkillResult = skillLoad.handler(skillInput, {});
    await expect(adapter.next(session, adapterContext())).resolves.toEqual({
      kind: "skill_load",
      skill_key: "calendar-assistant",
    });

    const packageBytes = new TextEncoder().encode("exact-package-v1");
    const skillBytes = new TextEncoder().encode(
      [
        "---",
        "name: calendar-assistant",
        "description: Use the frozen calendar workflow",
        "---",
        "",
        "Follow the frozen workflow.",
        "",
      ].join("\n"),
    );
    const guideBytes = new TextEncoder().encode("Exact guide.");
    const manifestBytes = new TextEncoder().encode(
      canonicalJsonV1({
        schema_version: "skill_package_manifest.v1",
        runtime_target: "filesystem_bundle.v1",
        files: [
          {
            path: "SKILL.md",
            mode: "0600",
            size_bytes: skillBytes.byteLength,
            sha256: digest(skillBytes),
          },
          {
            path: "references/guide.md",
            mode: "0600",
            size_bytes: guideBytes.byteLength,
            sha256: digest(guideBytes),
          },
        ],
      }),
    );
    const materialization: RuntimeSkillMaterializationV1 = {
      bytes: packageBytes,
      manifest_bytes: manifestBytes,
      media_type: "application/vnd.pai.skill-bundle",
      package_digest: digest(packageBytes),
      manifest_digest: digest(manifestBytes),
      runtime_target: "filesystem_bundle.v1",
      source: "skill_registry",
      entry_paths: ["SKILL.md", "references/guide.md"],
      entries: [
        {
          path: "SKILL.md",
          mode: "0600",
          bytes: skillBytes,
          sha256: digest(skillBytes),
        },
        {
          path: "references/guide.md",
          mode: "0600",
          bytes: guideBytes,
          sha256: digest(guideBytes),
        },
      ],
    };
    expect(() =>
      assertRuntimeSkillMaterializationManifestV1({
        ...materialization,
        entry_paths: [...materialization.entry_paths, "injected.txt"],
        entries: [
          ...materialization.entries,
          {
            path: "injected.txt",
            mode: "0600",
            bytes: new TextEncoder().encode("injected"),
            sha256: digest(new TextEncoder().encode("injected")),
          },
        ],
      }),
    ).toThrow(/manifest file set/u);
    expect(() =>
      assertRuntimeSkillMaterializationManifestV1({
        ...materialization,
        entries: materialization.entries.map((entry, index) =>
          index === 0 ? { ...entry, mode: "0644" } : entry,
        ),
      }),
    ).toThrow(/mode/u);
    const terminalPromise = adapter.next(
      session,
      adapterContext({
        last_skill: {
          resolution_id: "resolution-calendar-v1",
          skill_id: "skill-calendar",
          skill_key: "calendar-assistant",
          version: "1.0.0",
          version_id: "version-calendar-v1",
          package_digest: materialization.package_digest,
          manifest_digest: materialization.manifest_digest,
          granted_capability_refs: [],
          runtime_target: "filesystem_bundle.v1",
          required: true,
          security_revocation_epoch: 1,
          valid_until: "2026-07-24T04:00:00.000Z",
        },
        last_skill_materialization: materialization,
        last_skill_audit_event_id: "runtime-event-skill-materialized-1",
      }),
    );
    const result = await providerSkillResult;
    expect(result).toMatchObject({
      content: [
        {
          type: "text",
          text: expect.stringContaining(
            '"skill_name":"calendar-assistant"',
          ),
        },
      ],
    });
    const resultText = JSON.stringify(result);
    expect(resultText).not.toContain("Follow the frozen workflow");
    expect(resultText).not.toContain("secret-resolution-token");
    expect(resultText).not.toContain("object:calendar-skill-v1");
    expect(reloadSkills).toHaveBeenCalledTimes(1);
    const runCwd = sdkOptions?.cwd;
    if (runCwd === undefined) throw new Error("run cwd missing");
    const parsedResult = JSON.parse(
      (
        result as Readonly<{
          content: readonly Readonly<{ text: string }>[];
        }>
      ).content[0]?.text ?? "{}",
    ) as Readonly<{ details?: Readonly<{ entrypoint?: string }> }>;
    const entrypoint = parsedResult.details?.entrypoint;
    if (entrypoint === undefined) {
      throw new Error("entrypoint missing");
    }
    await expect(
      readFile(join(runCwd, entrypoint)),
    ).resolves.toEqual(Buffer.from(skillBytes));
    await expect(
      readFile(
        join(
          runCwd,
          entrypoint,
          "..",
          "references/guide.md",
        ),
      ),
    ).resolves.toEqual(Buffer.from(guideBytes));
    await expect(
      stat(join(runCwd, entrypoint)),
    ).resolves.toMatchObject({ mode: expect.any(Number) });

    finishProvider?.();
    await expect(terminalPromise).resolves.toMatchObject({
      kind: "failed",
      reason_code: "sdk_max_turns",
    });
  });

  it("maps retryable SDK failures to a bounded fresh query attempt", async () => {
    let attempts = 0;
    const queryFactory: ClaudeAgentSdkQueryFactoryV1 = () => {
      attempts += 1;
      if (attempts === 1) {
        return queryFrom([
          sdkMessage({
            type: "assistant",
            error: "rate_limit",
            session_id: "sdk-session-1",
          }),
          sdkMessage({
            type: "result",
            subtype: "error_during_execution",
            terminal_reason: "api_error",
            session_id: "sdk-session-1",
          }),
        ]);
      }
      return queryFrom([successMessage("recovered")]);
    };
    const adapter = new ClaudeAgentSdkRuntimeAdapter(
      adapterOptions(queryFactory),
    );
    const session = await adapter.start(request(), adapterContext());

    await expect(adapter.next(session, adapterContext())).resolves.toEqual({
      kind: "failed",
      retryable: true,
      reason_code: "sdk_execution_failed",
      error_summary:
        "Claude Agent SDK ended with error_during_execution",
    });
    await expect(adapter.next(session, adapterContext())).resolves.toMatchObject(
      {
        kind: "artifact",
        artifact: { artifact_id: "run-1:sdk-final" },
      },
    );
    expect(attempts).toBe(2);
  });

  it("interrupts and closes the SDK query for both cancel and preempt cleanup", async () => {
    const controls = {
      close: vi.fn(),
      interrupt: vi.fn(async () => undefined),
    };
    const queryFactory: ClaudeAgentSdkQueryFactoryV1 = () =>
      queryFrom([], controls);
    const adapter = new ClaudeAgentSdkRuntimeAdapter(
      adapterOptions(queryFactory),
    );
    const session = await adapter.start(request(), adapterContext());

    await adapter.cancel(session, "preempt");
    await adapter.cancel(session, "preempt");
    expect(controls.interrupt).toHaveBeenCalledTimes(1);
    expect(controls.close).toHaveBeenCalled();
  });

  it("awaits isolated-directory cleanup before returning a terminal turn", async () => {
    const sandbox = await mkdtemp("/tmp/pai-action-runtime-cleanup-");
    let releaseCleanup!: () => void;
    const cleanupGate = new Promise<void>((resolve) => {
      releaseCleanup = resolve;
    });
    const removed: string[] = [];
    const adapter = new ClaudeAgentSdkRuntimeAdapter(
      adapterOptions(() => queryFrom([successMessage("done")]), {
        sandbox_cwd: sandbox,
        remove_run_directory: async (path: string) => {
          removed.push(path);
          await cleanupGate;
          await rm(path, { recursive: true, force: true });
        },
      }),
    );
    const session = await adapter.start(request(), adapterContext());
    const artifact = await adapter.next(session, adapterContext());
    if (artifact.kind !== "artifact") throw new Error("artifact expected");

    let settled = false;
    const terminal = adapter
      .next(
        session,
        adapterContext({
          last_artifact_id: artifact.artifact.artifact_id,
          last_artifact_ref: "object:runtime-final",
        }),
      )
      .finally(() => {
        settled = true;
      });
    await Promise.resolve();
    expect(removed).toHaveLength(1);
    expect(settled).toBe(false);
    releaseCleanup();
    await expect(terminal).resolves.toEqual({
      kind: "complete",
      terminal_artifact_ref: "object:runtime-final",
    });
    await rm(sandbox, { recursive: true, force: true });
  });

  it("fails closed on cleanup failure without exposing provider data", async () => {
    const sandbox = await mkdtemp("/tmp/pai-action-runtime-cleanup-fail-");
    const adapter = new ClaudeAgentSdkRuntimeAdapter(
      adapterOptions(() => queryFrom([successMessage("provider-secret")]), {
        sandbox_cwd: sandbox,
        remove_run_directory: async () => {
          throw new Error("signed-url-secret");
        },
      }),
    );
    const session = await adapter.start(request(), adapterContext());
    const artifact = await adapter.next(session, adapterContext());
    if (artifact.kind !== "artifact") throw new Error("artifact expected");

    await expect(
      adapter.next(
        session,
        adapterContext({
          last_artifact_id: artifact.artifact.artifact_id,
          last_artifact_ref: "object:runtime-final",
        }),
      ),
    ).rejects.toMatchObject({
      code: "runtime_adapter_failed",
      message: "Claude Agent SDK isolated directory cleanup failed",
      retryable: true,
    });
    await expect(adapter.cancel(session, "retry-cleanup")).rejects.toMatchObject({
      message: "Claude Agent SDK isolated directory cleanup failed",
    });
    await rm(sandbox, { recursive: true, force: true });
  });

  it("reconciles residual run directories before the first new session", async () => {
    const sandbox = await mkdtemp("/tmp/pai-action-runtime-residual-");
    const residual = join(sandbox, "pai-run-crash");
    await mkdir(residual, { mode: 0o700 });
    await writeFile(
      join(residual, ".pai-action-runtime-owned.v1"),
      "project-pai:action-runtime:claude-agent-sdk:0.3.212\n",
      { mode: 0o600 },
    );
    await writeFile(join(residual, "provider.tmp"), "uncommitted");
    const unrelated = join(sandbox, "pai-run-unrelated");
    await mkdir(unrelated, { mode: 0o700 });
    await writeFile(join(unrelated, "user-data"), "must-not-delete");
    const spoofed = join(sandbox, "pai-run-spoofed-marker");
    const spoofedMarkerTarget = join(sandbox, "spoofed-marker-target");
    await mkdir(spoofed, { mode: 0o700 });
    await writeFile(
      spoofedMarkerTarget,
      "project-pai:action-runtime:claude-agent-sdk:0.3.212\n",
      { mode: 0o600 },
    );
    await writeFile(join(spoofed, "user-data"), "must-not-delete");
    await symlink(
      spoofedMarkerTarget,
      join(spoofed, ".pai-action-runtime-owned.v1"),
    );
    const removed: string[] = [];
    const adapter = new ClaudeAgentSdkRuntimeAdapter(
      adapterOptions(() => queryFrom([]), {
        sandbox_cwd: sandbox,
        remove_run_directory: async (path: string) => {
          removed.push(path);
          await rm(path, { recursive: true, force: true });
        },
      }),
    );
    const session = await adapter.start(request(), adapterContext());
    expect(removed).toContain(residual);
    await expect(stat(residual)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(unrelated, "user-data"), "utf8")).resolves.toBe(
      "must-not-delete",
    );
    expect(removed).not.toContain(unrelated);
    await expect(readFile(join(spoofed, "user-data"), "utf8")).resolves.toBe(
      "must-not-delete",
    );
    expect(removed).not.toContain(spoofed);
    await adapter.cancel(session, "test-cleanup");
    expect(removed.filter((path) => path === residual)).toHaveLength(1);
    await rm(sandbox, { recursive: true, force: true });
  });

  it("fails closed on environment expansion and SDK result shape drift", async () => {
    expect(
      () =>
        new ClaudeAgentSdkRuntimeAdapter(
          adapterOptions(() => queryFrom([]), {
            provider_env: {
              PATH: "/usr/bin",
              DATABASE_URL: "must-not-leak",
            },
          }),
        ),
    ).toThrow(/DATABASE_URL/u);

    const adapter = new ClaudeAgentSdkRuntimeAdapter(
      adapterOptions(() =>
        queryFrom([
          sdkMessage({
            type: "result",
            subtype: "future_unknown_result",
            session_id: "sdk-session-1",
          }),
        ]),
      ),
    );
    const session = await adapter.start(request(), adapterContext());
    const turn: RuntimeAdapterTurnV1 = await adapter.next(
      session,
      adapterContext(),
    );
    expect(turn).toEqual({
      kind: "failed",
      retryable: false,
      reason_code: "sdk_shape_drift",
      error_summary: "Claude Agent SDK emitted an unknown result subtype",
    });
  });

  it("rejects accessor and Proxy SDK messages before provider property traversal", async () => {
    let accessorReads = 0;
    const accessorMessage: Record<string, unknown> = {};
    Object.defineProperty(accessorMessage, "type", {
      enumerable: true,
      get() {
        accessorReads += 1;
        return "result";
      },
    });
    let proxyReads = 0;
    const proxyMessage = new Proxy<Record<string, unknown>>(
      {
        type: "result",
        subtype: "success",
        result: "must-not-observe",
      },
      {
        get(_target, property) {
          if (property === "then") return undefined;
          proxyReads += 1;
          throw new Error("Proxy property traversal is forbidden");
        },
      },
    );

    for (const message of [accessorMessage, proxyMessage]) {
      const adapter = new ClaudeAgentSdkRuntimeAdapter(
        adapterOptions(() =>
          queryFrom([sdkMessage(message)]),
        ),
      );
      const session = await adapter.start(request(), adapterContext());
      await expect(
        adapter.next(session, adapterContext()),
      ).resolves.toEqual({
        kind: "failed",
        retryable: false,
        reason_code: "sdk_shape_drift",
        error_summary:
          "Claude Agent SDK emitted a non-canonical message",
      });
    }
    expect(accessorReads).toBe(0);
    expect(proxyReads).toBe(0);
  });

  it("never persists or returns provider exception secrets in SDK failures", async () => {
    const secret =
      "sk-ant-secret https://signed.example/object?token=secret prompt-body";
    const adapter = new ClaudeAgentSdkRuntimeAdapter(
      adapterOptions(() => {
        throw new Error(secret);
      }),
    );
    const session = await adapter.start(request(), adapterContext());
    const turn = await adapter.next(session, adapterContext());
    expect(turn).toEqual({
      kind: "failed",
      retryable: false,
      reason_code: "sdk_start_failed",
      error_summary: "Claude Agent SDK execution failed",
    });
    expect(JSON.stringify(turn)).not.toContain(secret);
    expect(JSON.stringify(turn)).not.toContain("sk-ant-secret");
  });

  it("permission hook denies any tool outside the frozen exact-name set", async () => {
    const hook = createClaudeAgentSdkPermissionHookV1(
      new Set(["mcp__pai_runtime__search"]),
    );
    const signal = new AbortController().signal;
    await expect(
      hook(
        "mcp__pai_runtime__search",
        { query: "ok" },
        { signal, toolUseID: "tool-1" } as Parameters<CanUseTool>[2],
      ),
    ).resolves.toMatchObject({ behavior: "allow" });
    await expect(
      hook(
        "mcp__other__search",
        { query: "no" },
        { signal, toolUseID: "tool-2" } as Parameters<CanUseTool>[2],
      ),
    ).resolves.toMatchObject({ behavior: "deny", interrupt: false });

    let deep: Record<string, unknown> = { leaf: true };
    for (let index = 0; index < 40; index += 1) {
      deep = { nested: deep };
    }
    const sparse = new Array(2);
    sparse[1] = "present";
    let accessorReads = 0;
    const accessorInput: Record<string, unknown> = {};
    Object.defineProperty(accessorInput, "query", {
      enumerable: true,
      get() {
        accessorReads += 1;
        return "must-not-run";
      },
    });
    let proxyReads = 0;
    const proxyInput = new Proxy<Record<string, unknown>>(
      { query: "must-not-run" },
      {
        get() {
          proxyReads += 1;
          throw new Error("Proxy property traversal is forbidden");
        },
      },
    );
    for (const [toolUseID, input] of [
      ["tool-deep", deep],
      ["tool-large", { value: "x".repeat(1_100_000) }],
      ["tool-sparse", { value: sparse }],
      ["tool-non-json", { value: 1n }],
      ["tool-accessor", accessorInput],
      ["tool-proxy", proxyInput],
    ] as const) {
      await expect(
        hook(
          "mcp__pai_runtime__search",
          input,
          {
            signal,
            toolUseID,
          } as Parameters<CanUseTool>[2],
        ),
      ).resolves.toMatchObject({ behavior: "deny" });
    }
    expect(accessorReads).toBe(0);
    expect(proxyReads).toBe(0);
  });

  it("bounds concurrent MCP bridge work before it can grow without limit", async () => {
    const definitions: Array<{
      name: string;
      handler: (
        args: Readonly<Record<string, unknown>>,
        extra: unknown,
      ) => Promise<unknown>;
    }> = [];
    let sdkOptions: ClaudeAgentSdkOptions | undefined;
    let releaseProvider!: () => void;
    const providerGate = new Promise<void>((resolve) => {
      releaseProvider = resolve;
    });
    const queryFactory: ClaudeAgentSdkQueryFactoryV1 = (parameters) => {
      sdkOptions = parameters.options;
      return {
        close: vi.fn(() => releaseProvider()),
        interrupt: vi.fn(async () => releaseProvider()),
        async *[Symbol.asyncIterator]() {
          await providerGate;
        },
      };
    };
    const adapter = new ClaudeAgentSdkRuntimeAdapter(
      adapterOptions(queryFactory, {
        tool_factory: (
          name: string,
          _description: string,
          _schema: Readonly<Record<string, unknown>>,
          handler: (
            args: Readonly<Record<string, unknown>>,
            extra: unknown,
          ) => Promise<unknown>,
        ) => {
          definitions.push({ name, handler });
          return { name, handler } as unknown as SdkMcpToolDefinition;
        },
        mcp_server_factory: (() => ({
          type: "sdk",
          name: "pai_runtime",
          instance: {},
        })) as never,
      }),
    );
    const session = await adapter.start(request(), adapterContext());
    const hook = sdkOptions?.canUseTool;
    const search = definitions.find(({ name }) => name === "search");
    if (hook === undefined || search === undefined) {
      throw new Error("bounded bridge setup failed");
    }
    const pending: Promise<unknown>[] = [];
    for (let index = 0; index < 128; index += 1) {
      const input = {
        arguments: { query: `bounded-${index}` },
      };
      await hook("mcp__pai_runtime__search", input, {
        signal: new AbortController().signal,
        toolUseID: `tool-${index}`,
      } as Parameters<CanUseTool>[2]);
      pending.push(search.handler(input, {}));
    }
    const overflowInput = {
      arguments: { query: "overflow" },
    };
    await hook("mcp__pai_runtime__search", overflowInput, {
      signal: new AbortController().signal,
      toolUseID: "tool-overflow",
    } as Parameters<CanUseTool>[2]);
    await expect(
      search.handler(overflowInput, {}),
    ).resolves.toMatchObject({ isError: true });
    await adapter.cancel(session, "bounded-test-cleanup");
    await Promise.all(pending);
  });
});
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
