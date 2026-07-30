import type { Query, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { describe, expect, it } from "vitest";

import {
  DEEPSEEK_ANTHROPIC_BASE_URL_V1,
  DeepSeekClaudeAgentStructuredProviderTransportV1,
  deepSeekClaudeAgentMetaProviderConfigFromEnvironmentV1,
} from "../src/deepseek-claude-agent-structured-provider.v1.js";
import { META_PROVIDER_RESPONSE_SCHEMA_V1 } from "../src/structured-provider.v1.js";

function providerOutput() {
  return {
    schema_version: "meta_provider_output.v1" as const,
    summary: "summary",
    execution_summary: { completed_stage_count: 1 },
    reflection_summary: "reflection",
    evidence_refs: ["trigger_process:process-1"],
    quality_score: 0.9,
    memory_writes: [],
    knowthat_candidates: [],
    skill_candidates: [],
    quality_signals: [],
  };
}

function resultStream(result: unknown): Query {
  return {
    async *[Symbol.asyncIterator]() {
      yield {
        type: "result",
        subtype: "success",
        result: "ignored",
        structured_output: result,
      } as SDKMessage;
    },
    close() {},
  } as unknown as Query;
}

const request = Object.freeze({
  prompt: "frozen meta owner prompt",
  response_schema: META_PROVIDER_RESPONSE_SCHEMA_V1,
  parser: "meta_provider_output_parser.v1" as const,
});

const providerEnvironment = Object.freeze({
  ANTHROPIC_AUTH_TOKEN: "x".repeat(32),
  ANTHROPIC_BASE_URL: DEEPSEEK_ANTHROPIC_BASE_URL_V1,
  PATH: "/usr/bin:/bin",
});

describe("DeepSeek Claude Agent SDK Meta provider transport", () => {
  it("maps either native DeepSeek credentials or the pinned Anthropic-compatible pair into a minimal SDK environment", () => {
    const native = deepSeekClaudeAgentMetaProviderConfigFromEnvironmentV1({
      DEEPSEEK_API_KEY: "native-deepseek-token-1234567890",
      PAI_META_LLM_MODEL: "deepseek-v4-flash",
      PAI_META_LLM_SDK_CWD: "/tmp/pai-meta-sdk",
      PATH: "/usr/bin:/bin",
    });
    expect(native).toEqual({
      model: "deepseek-v4-flash",
      sandbox_cwd: "/tmp/pai-meta-sdk",
      provider_env: {
        ANTHROPIC_AUTH_TOKEN: "native-deepseek-token-1234567890",
        ANTHROPIC_BASE_URL: DEEPSEEK_ANTHROPIC_BASE_URL_V1,
        PATH: "/usr/bin:/bin",
      },
    });
    const compatible = deepSeekClaudeAgentMetaProviderConfigFromEnvironmentV1({
      ANTHROPIC_AUTH_TOKEN: "compatible-deepseek-token-1234567890",
      ANTHROPIC_BASE_URL: DEEPSEEK_ANTHROPIC_BASE_URL_V1,
      PAI_META_LLM_MODEL: "deepseek-v4-pro",
      PAI_META_LLM_SDK_CWD: "/tmp/pai-meta-sdk",
      PATH: "/usr/bin:/bin",
    });
    expect(compatible.provider_env).toEqual({
      ANTHROPIC_AUTH_TOKEN: "compatible-deepseek-token-1234567890",
      ANTHROPIC_BASE_URL: DEEPSEEK_ANTHROPIC_BASE_URL_V1,
      PATH: "/usr/bin:/bin",
    });
  });

  it("fails closed for an arbitrary Anthropic endpoint or ambiguous credentials", () => {
    expect(() =>
      deepSeekClaudeAgentMetaProviderConfigFromEnvironmentV1({
        ANTHROPIC_AUTH_TOKEN: "compatible-deepseek-token-1234567890",
        ANTHROPIC_BASE_URL: "https://api.anthropic.com",
        PAI_META_LLM_MODEL: "deepseek-v4-pro",
        PAI_META_LLM_SDK_CWD: "/tmp/pai-meta-sdk",
        PATH: "/usr/bin:/bin",
      }),
    ).toThrow(/DeepSeek Anthropic compatibility endpoint/u);
    expect(() =>
      deepSeekClaudeAgentMetaProviderConfigFromEnvironmentV1({
        DEEPSEEK_API_KEY: "native-deepseek-token-1234567890",
        ANTHROPIC_AUTH_TOKEN: "different-deepseek-token-1234567890",
        PAI_META_LLM_MODEL: "deepseek-v4-pro",
        PAI_META_LLM_SDK_CWD: "/tmp/pai-meta-sdk",
        PATH: "/usr/bin:/bin",
      }),
    ).toThrow(/must be unset or equal/u);
  });

  it("runs the SDK in a one-turn no-tool structured-output boundary", async () => {
    let observed: unknown;
    const transport = new DeepSeekClaudeAgentStructuredProviderTransportV1({
      model: "deepseek-v4-pro",
      sandbox_cwd: "/tmp",
      provider_env: providerEnvironment,
      query_factory(input) {
        observed = input;
        return resultStream(providerOutput());
      },
    });
    await expect(
      transport.complete(request, new AbortController().signal),
    ).resolves.toEqual(providerOutput());
    expect(observed).toMatchObject({
      prompt: "frozen meta owner prompt",
      options: {
        model: "deepseek-v4-pro",
        cwd: "/tmp",
        env: providerEnvironment,
        tools: [],
        settingSources: [],
        permissionMode: "dontAsk",
        persistSession: false,
        maxTurns: 1,
        outputFormat: { type: "json_schema" },
      },
    });
  });

  it("propagates aborts to the isolated SDK controller and always closes the stream", async () => {
    let closed = false;
    let abortController: AbortController | undefined;
    const transport = new DeepSeekClaudeAgentStructuredProviderTransportV1({
      model: "deepseek-v4-pro",
      sandbox_cwd: "/tmp",
      provider_env: providerEnvironment,
      query_factory(input) {
        abortController = input.options.abortController;
        return {
          async *[Symbol.asyncIterator]() {
            await new Promise<void>((resolve) => {
              input.options.abortController?.signal.addEventListener(
                "abort",
                () => resolve(),
                { once: true },
              );
            });
          },
          close() {
            closed = true;
          },
        } as unknown as Query;
      },
    });
    const controller = new AbortController();
    const pending = transport.complete(request, controller.signal);
    controller.abort(new Error("caller cancelled"));
    await expect(pending).rejects.toThrow(/caller cancelled/u);
    expect(abortController?.signal.aborted).toBe(true);
    expect(closed).toBe(true);
  });
});
