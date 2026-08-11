import type { Query, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type {
  ContextSnapshotV1,
  IntentSynthesizeRequestV1,
  ToolPermissionProfileV1,
} from "@pai/contracts";
import { describe, expect, it } from "vitest";

import { DeepSeekClaudeAgentIntentAdapterV1 } from "../src/deepseek-claude-agent-intent-adapter.v1.js";

const request = {
  schema_version: "intent_synthesize_request.v1",
  trigger_process_id: "process-1",
  workspace_id: "workspace-1",
  bot_id: "bot-1",
  owner_agent_id: "agent-1",
  deployment_environment: "prod",
  release_channel: "stable",
  trigger_ref: "trigger-1",
  intent_version: 1,
  context_snapshot_ref: "object-1",
  context_snapshot_version: 1,
  context_snapshot_hash: `sha256:${"a".repeat(64)}`,
  intent_policy_snapshot: {
    schema_version: "intent_policy_input_snapshot.v1",
    snapshot_ref: "policy-1",
    workspace_id: "workspace-1",
    bot_id: "bot-1",
    owner_agent_id: "agent-1",
    deployment_environment: "prod",
    release_channel: "stable",
    bot_policy_revision_id: "bot-policy-1",
    personality_ref: "personality-1",
    personality_version: 1,
    personality_hash: `sha256:${"b".repeat(64)}`,
    safety_boundaries_ref: "safety-1",
    safety_boundaries_version: 1,
    safety_boundaries_hash: `sha256:${"c".repeat(64)}`,
    tool_permission_profile_ref: "tool-profile-1",
    tool_permission_profile_revision: 1,
    tool_permission_profile_hash: `sha256:${"d".repeat(64)}`,
    tool_policy_epoch: 1,
    catalog_version: "catalog-1",
    catalog_as_of: "2026-07-28T00:00:00.000Z",
    security_revocation_epoch: 1,
    skill_permission_summary_ref: "summary-1",
    skill_permission_summary_hash: `sha256:${"e".repeat(64)}`,
    snapshot_hash: `sha256:${"f".repeat(64)}`,
  },
  idempotency_key: "process-1:intent:1",
  trace_id: "trace-1",
} as const satisfies IntentSynthesizeRequestV1;

const context = {
  skill_catalog: {
    catalog_version: "catalog-1",
    catalog_as_of: "2026-07-28T00:00:00.000Z",
    items: [
      {
        skill_key: "summarize",
        name: "Summarize",
        description: "Summarize a document.",
        active_version: "skill-version-1",
        package_digest: `sha256:${"1".repeat(64)}`,
        manifest_digest: `sha256:${"2".repeat(64)}`,
        runtime_target: "filesystem_bundle.v1",
      },
    ],
  },
} as ContextSnapshotV1;

const profile = {
  profile_ref: "tool-profile-1",
  revision: 1,
  profile_hash: `sha256:${"d".repeat(64)}`,
  policy_epoch: 1,
  allowed_tools: ["calendar.lookup"],
} as ToolPermissionProfileV1;

function sdkResult(structuredOutput: unknown): Query {
  return {
    async *[Symbol.asyncIterator]() {
      yield {
        type: "result",
        subtype: "success",
        result: "ignored",
        structured_output: structuredOutput,
      } as SDKMessage;
    },
    close() {},
  } as unknown as Query;
}

function adapter(
  result: unknown,
  options: Readonly<{
    on_query?: (prompt: string) => void;
    on_options?: (value: Readonly<{ thinking?: unknown; effort?: unknown }>) => void;
    trigger_ref?: string;
    trigger_source?: "chat" | "notification" | "timer";
    trigger_payload?: unknown;
    allowed_tools?: readonly string[];
  }> = {},
): DeepSeekClaudeAgentIntentAdapterV1 {
  return new DeepSeekClaudeAgentIntentAdapterV1({
    model: "deepseek-chat",
    sandbox_cwd: "/tmp",
    provider_env: {
      ANTHROPIC_BASE_URL: "https://api.deepseek.com/anthropic",
      ANTHROPIC_AUTH_TOKEN: "x".repeat(32),
      PATH: "/usr/bin:/bin",
    },
    context_snapshots: {
      async resolve() {
        return context;
      },
    },
    tool_permissions: {
      async readCurrent() {
        return {
          ...profile,
          allowed_tools: options.allowed_tools ?? profile.allowed_tools,
        };
      },
    },
    trigger_input: {
      async readIntentInput() {
        return {
          trigger_ref: options.trigger_ref ?? request.trigger_ref,
          source: options.trigger_source ?? "chat",
          received_at: "2026-07-28T00:00:00.000Z",
          payload: options.trigger_payload ?? { message: "actual durable Trigger payload" },
        };
      },
    },
    query_factory: (input) => {
      options.on_query?.(input.prompt);
      options.on_options?.(input.options);
      return sdkResult(result);
    },
  });
}

const safeIntent = {
  goal: "Reply to the user",
  user_need: "A concise reply",
  response_style: "concise",
  action_plan: [
    { step: 1, action_type: "respond", action: "Respond concisely" },
  ],
  required_skills: [],
  memory_followups: [],
  safety_notes: ["No external action"],
  requires_confirmation: false,
};

describe("DeepSeek Claude Agent SDK intent adapter", () => {
  it("rejects an ambient proxy from the isolated provider environment", () => {
    expect(
      () =>
        new DeepSeekClaudeAgentIntentAdapterV1({
          model: "deepseek-chat",
          sandbox_cwd: "/tmp",
          provider_env: {
            ANTHROPIC_BASE_URL: "https://api.deepseek.com/anthropic",
            ANTHROPIC_AUTH_TOKEN: "x".repeat(32),
            PATH: "/usr/bin:/bin",
            HTTPS_PROXY: "http://127.0.0.1:7890",
          },
          context_snapshots: { async resolve() { return context; } },
          tool_permissions: { async readCurrent() { return profile; } },
          trigger_input: {
            async readIntentInput() {
              return {
                trigger_ref: request.trigger_ref,
                received_at: "2026-07-28T00:00:00.000Z",
                payload: {},
              };
            },
          },
        }),
    ).toThrow("provider environment is invalid");
  });

  it("binds a structured response to the exact frozen owner facts", async () => {
    let providerPrompt = "";
    let providerOptions: Readonly<{ thinking?: unknown; effort?: unknown }> = {};
    const response = await adapter({
      structured_intent: safeIntent,
      policy_decision: "allow",
    }, {
      on_query: (prompt) => { providerPrompt = prompt; },
      on_options: (value) => { providerOptions = value; },
    }).synthesize(
      request,
      new AbortController().signal,
    );

    expect(response.details.intent_ref).toBe("intent:process-1:1");
    expect(response.details.structured_intent).toEqual(safeIntent);
    expect(JSON.parse(providerPrompt).trigger_input.payload).toEqual({
      message: "actual durable Trigger payload",
    });
    expect(JSON.parse(providerPrompt).instructions).toEqual(
      expect.arrayContaining([
        "The trigger_input.payload is nevertheless the business input whose user request you must translate into structured_intent; do not reject it solely because it is untrusted data.",
        "For an ordinary conversational request that needs only a response, return policy_decision allow with exactly one respond action, no skills, no tools, and requires_confirmation false.",
        "Return deny only when a supplied host policy fact or a non-overridable provider safety rule prohibits producing any response at all.",
      ]),
    );
    expect(providerOptions).toMatchObject({
      thinking: { type: "disabled" },
      effort: "low",
    });
  });

  it("rejects a model attempt to select a tool outside the current owner profile", async () => {
    await expect(
      adapter({
        structured_intent: {
          ...safeIntent,
          action_plan: [
            {
              step: 1,
              action_type: "tool_use",
              action: "Call an unapproved tool",
              candidate_tool: "filesystem.write",
            },
          ],
        },
        policy_decision: "allow",
      }).synthesize(request, new AbortController().signal),
    ).rejects.toThrow(/widen owner policy/u);
  });

  it("rejects a Trigger input whose durable reference does not match the request", async () => {
    await expect(
      adapter(
        { structured_intent: safeIntent, policy_decision: "allow" },
        { trigger_ref: "trigger:other" },
      ).synthesize(request, new AbortController().signal),
    ).rejects.toThrow(/Trigger owner input binding drifted/u);
  });

  it("normalizes a delayed chat information request into a timer-only parent", async () => {
    const response = await adapter({
      structured_intent: {
        ...safeIntent,
        goal: "Report Shanghai weather now and make a reminder",
        action_plan: [
          {
            step: 1,
            action_type: "tool_use",
            action: "Read Shanghai weather now",
            candidate_tool: "weather.current",
          },
          {
            step: 2,
            action_type: "tool_use",
            action: "Set a three-minute reminder",
            candidate_tool: "timer.remind_after",
          },
          {
            step: 3,
            action_type: "respond",
            action: "Report the weather and the reminder",
          },
        ],
      },
      policy_decision: "allow",
    }, {
      allowed_tools: ["weather.current", "timer.remind_after"],
      trigger_payload: { message: "上海天气，3 分钟后提醒" },
    }).synthesize(request, new AbortController().signal);

    expect(response.details.structured_intent).toMatchObject({
      execution_mode: "deferred_timer_parent",
      required_skills: [],
      action_plan: [
        { step: 1, candidate_tool: "timer.remind_after" },
        { step: 2, action_type: "respond" },
      ],
    });
    expect(response.details.structured_intent.deferred_instruction).toContain(
      "上海天气，3 分钟后提醒",
    );
    expect(response.details.structured_intent.deferred_fire_at).toBe(
      "2026-07-28T00:03:00.000Z",
    );
    expect(
      response.details.structured_intent.action_plan.some(
        (step) => step.candidate_tool === "weather.current",
      ),
    ).toBe(false);
  });

  it("normalizes min shorthand into a timer-only parent from the durable receive time", async () => {
    const response = await adapter({
      structured_intent: {
        ...safeIntent,
        action_plan: [
          {
            step: 1,
            action_type: "tool_use",
            action: "Read today's news now",
            candidate_tool: "search",
          },
          {
            step: 2,
            action_type: "tool_use",
            action: "Set a two-minute reminder",
            candidate_tool: "timer.remind_after",
          },
        ],
      },
      policy_decision: "allow",
    }, {
      allowed_tools: ["search", "timer.remind_after"],
      trigger_payload: { message: "搜索一下今天的重要新闻 2min后发给我" },
    }).synthesize(request, new AbortController().signal);

    expect(response.details.structured_intent).toMatchObject({
      execution_mode: "deferred_timer_parent",
      deferred_fire_at: "2026-07-28T00:02:00.000Z",
      action_plan: [
        { step: 1, candidate_tool: "timer.remind_after" },
        { step: 2, action_type: "respond" },
      ],
    });
    expect(response.details.structured_intent.action_plan).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ candidate_tool: "search" })]),
    );
  });

  it("requires a host confirmation for every sending or modifying tool even when the model allows it", async () => {
    const response = await adapter({
      structured_intent: {
        ...safeIntent,
        action_plan: [
          {
            step: 1,
            action_type: "tool_use",
            action: "Send the requested message",
            candidate_tool: "lark.message.send",
            risk_level: "low",
            requires_confirmation: false,
          },
        ],
      },
      policy_decision: "allow",
    }, {
      allowed_tools: ["lark.message.send"],
    }).synthesize(request, new AbortController().signal);

    expect(response.details.policy_decision).toBe("require_confirmation");
    expect(response.details.structured_intent).toMatchObject({
      requires_confirmation: true,
      action_plan: [
        {
          candidate_tool: "lark.message.send",
          risk_level: "high",
          requires_confirmation: true,
        },
      ],
    });
  });

  it("removes every timer capability from an already-due timer occurrence", async () => {
    let providerPrompt = "";
    const response = await adapter({
      structured_intent: {
        ...safeIntent,
        action_plan: [
          {
            step: 1,
            action_type: "tool_use",
            action: "Search today's news now",
            candidate_tool: "search",
          },
          { step: 2, action_type: "respond", action: "Report the result" },
        ],
      },
      policy_decision: "allow",
    }, {
      trigger_source: "timer",
      allowed_tools: ["search", "timer.remind_after", "timer.create"],
      trigger_payload: {
        message: "The scheduled time has now arrived. Search today's important news and report it now.",
      },
      on_query: (prompt) => { providerPrompt = prompt; },
    }).synthesize(request, new AbortController().signal);

    expect(response.details.structured_intent.action_plan).toEqual(
      expect.arrayContaining([expect.objectContaining({ candidate_tool: "search" })]),
    );
    const providerInput = JSON.parse(providerPrompt) as {
      allowed_tools: string[];
      instructions: string[];
    };
    expect(providerInput.allowed_tools).toEqual(["search"]);
    expect(providerInput.instructions).toContain(
      "This is an already-due timer occurrence. Its payload message is the instruction for this run: execute it now. Never create, update, or schedule any timer from a timer occurrence.",
    );
  });

  it("rejects a model attempt to re-arm an already-due timer occurrence", async () => {
    await expect(
      adapter({
        structured_intent: {
          ...safeIntent,
          action_plan: [
            {
              step: 1,
              action_type: "tool_use",
              action: "Schedule another timer",
              candidate_tool: "timer.remind_after",
            },
          ],
        },
        policy_decision: "allow",
      }, {
        trigger_source: "timer",
        allowed_tools: ["search", "timer.remind_after"],
        trigger_payload: { message: "Run the due request now." },
      }).synthesize(request, new AbortController().signal),
    ).rejects.toThrow(/widen owner policy/u);
  });
});
