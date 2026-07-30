import { describe, expect, it } from "vitest";

import { providerEnvironmentV1 } from "../src/production-composition.v1.js";

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
});
