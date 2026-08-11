import { describe, expect, it } from "vitest";

import {
  agentCoreWebToolsFromEnvironmentV1,
  personalAssistantMcpToolsFromEnvironmentV1,
  providerEnvironmentV1,
} from "../src/production-composition.v1.js";

describe("Action Runtime production provider composition", () => {
  it("maps a DeepSeek credential into the SDK's isolated Anthropic-compatible environment", () => {
    const providerEnvironment = providerEnvironmentV1({
      PAI_RUNTIME_PROVIDER: "deepseek",
      DEEPSEEK_API_KEY: "deepseek-test-token-1234567890",
      PATH: "/usr/bin:/bin",
      PAI_DATABASE_URL: "postgresql://must-not-leak",
    });

    expect(providerEnvironment).toEqual({
      ANTHROPIC_AUTH_TOKEN: "deepseek-test-token-1234567890",
      ANTHROPIC_BASE_URL: "https://api.deepseek.com/anthropic",
      PATH: "/usr/bin:/bin",
    });
    expect(providerEnvironment).not.toHaveProperty("DEEPSEEK_API_KEY");
    expect(providerEnvironment).not.toHaveProperty("PAI_DATABASE_URL");
  });

  it("fails closed when DeepSeek configuration is mixed with another provider credential", () => {
    expect(() =>
      providerEnvironmentV1({
        PAI_RUNTIME_PROVIDER: "deepseek",
        DEEPSEEK_API_KEY: "deepseek-test-token-1234567890",
        ANTHROPIC_API_KEY: "anthropic-test-token-1234567890",
        PATH: "/usr/bin:/bin",
      }),
    ).toThrow("ANTHROPIC_API_KEY must be unset");
  });

  it("fails closed when the DeepSeek credential or SDK executable path is absent", () => {
    expect(() =>
      providerEnvironmentV1({
        PAI_RUNTIME_PROVIDER: "deepseek",
        PATH: "/usr/bin:/bin",
      }),
    ).toThrow("DEEPSEEK_API_KEY is required");
    expect(() =>
      providerEnvironmentV1({
        PAI_RUNTIME_PROVIDER: "deepseek",
        DEEPSEEK_API_KEY: "deepseek-test-token-1234567890",
      }),
    ).toThrow("PATH is required");
  });

  it("keeps the full AgentCore web tool mapping server-side and opt-in", () => {
    expect(agentCoreWebToolsFromEnvironmentV1({})).toBeUndefined();
    expect(
      agentCoreWebToolsFromEnvironmentV1({
        PAI_AGENTCORE_MCP_URL: "",
        PAI_AGENTCORE_MCP_BEARER_TOKEN: "",
      }),
    ).toBeUndefined();
    expect(
      agentCoreWebToolsFromEnvironmentV1({
        PAI_AGENTCORE_MCP_URL: "https://gateway.example.test/mcp",
        PAI_AGENTCORE_MCP_BEARER_TOKEN: "agentcore-test-bearer-token",
      }),
    ).toEqual({
      mcp_url: "https://gateway.example.test/mcp",
      bearer_token: "agentcore-test-bearer-token",
      tools: {
        search: "web_search",
        fetch: "web_fetch",
        browser: "web_browser",
      },
    });
  });

  it("fails closed when only one half of the AgentCore credential pair is present", () => {
    expect(() =>
      agentCoreWebToolsFromEnvironmentV1({
        PAI_AGENTCORE_MCP_URL: "https://gateway.example.test/mcp",
      }),
    ).toThrow("PAI_AGENTCORE_MCP_BEARER_TOKEN is required");
    expect(() =>
      agentCoreWebToolsFromEnvironmentV1({
        PAI_AGENTCORE_MCP_BEARER_TOKEN: "agentcore-test-bearer-token",
      }),
    ).toThrow("PAI_AGENTCORE_MCP_URL is required");
  });

  it("keeps the fixed personal-assistant MCP mapping server-side and opt-in", () => {
    expect(personalAssistantMcpToolsFromEnvironmentV1({})).toBeUndefined();
    expect(
      personalAssistantMcpToolsFromEnvironmentV1({
        PAI_PERSONAL_ASSISTANT_MCP_URL: "https://assistant.example.test/mcp",
        PAI_PERSONAL_ASSISTANT_MCP_BEARER_TOKEN: "personal-assistant-test-bearer-token",
        PAI_PERSONAL_ASSISTANT_MCP_TOOLS_JSON: JSON.stringify({
          "lark.doc.search": "lark_docs_search",
          "mail.send": "mail_send",
        }),
      }),
    ).toEqual({
      mcp_url: "https://assistant.example.test/mcp",
      bearer_token: "personal-assistant-test-bearer-token",
      tools: {
        "lark.doc.search": "lark_docs_search",
        "mail.send": "mail_send",
      },
    });
  });

  it("requires the complete personal-assistant MCP configuration", () => {
    expect(() =>
      personalAssistantMcpToolsFromEnvironmentV1({
        PAI_PERSONAL_ASSISTANT_MCP_URL: "https://assistant.example.test/mcp",
      }),
    ).toThrow("PAI_PERSONAL_ASSISTANT_MCP_BEARER_TOKEN is required");
    expect(() =>
      personalAssistantMcpToolsFromEnvironmentV1({
        PAI_PERSONAL_ASSISTANT_MCP_URL: "https://assistant.example.test/mcp",
        PAI_PERSONAL_ASSISTANT_MCP_BEARER_TOKEN: "personal-assistant-test-bearer-token",
        PAI_PERSONAL_ASSISTANT_MCP_TOOLS_JSON: "[]",
      }),
    ).toThrow("PAI_PERSONAL_ASSISTANT_MCP_TOOLS_JSON must be a JSON object");
  });
});
