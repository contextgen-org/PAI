import { describe, expect, it } from "vitest";

import { buildTriggerProcessorApp } from "../src/app.js";
import {
  LOCAL_CHAT_AUTH_CONFIG_ROUTE_V1,
  LOCAL_CHAT_CONSOLE_ROUTE_V1,
  localChatConsoleEnabledFromEnvV1,
  localChatConsoleSupabaseAuthOriginFromIssuerV1,
  localChatConsoleSupabasePublishableKeyFromEnvV1,
} from "../src/local-chat-console.v1.js";

describe("local chat console", () => {
  it("is opt-in and restricted to the local deployment environment", () => {
    expect(
      localChatConsoleEnabledFromEnvV1(
        { PAI_LOCAL_CHAT_CONSOLE_ENABLED: "true" },
        "local",
      ),
    ).toBe(true);
    expect(
      localChatConsoleEnabledFromEnvV1(
        { PAI_LOCAL_CHAT_CONSOLE_ENABLED: "true" },
        "prod",
      ),
    ).toBe(false);
    expect(localChatConsoleEnabledFromEnvV1({}, "local")).toBe(false);
  });

  it("derives only the HTTPS origin from the configured Supabase issuer", () => {
    expect(
      localChatConsoleSupabaseAuthOriginFromIssuerV1(
        "https://project.supabase.co/auth/v1",
      ),
    ).toBe("https://project.supabase.co");
    expect(localChatConsoleSupabaseAuthOriginFromIssuerV1(undefined)).toBeUndefined();
    expect(() =>
      localChatConsoleSupabaseAuthOriginFromIssuerV1(
        "http://project.supabase.co/auth/v1",
      ),
    ).toThrow("absolute HTTPS URL");
  });

  it("accepts only a browser-safe Supabase publishable key", () => {
    expect(
      localChatConsoleSupabasePublishableKeyFromEnvV1(
        "sb_publishable_test_123",
      ),
    ).toBe("sb_publishable_test_123");
    expect(localChatConsoleSupabasePublishableKeyFromEnvV1(undefined)).toBeUndefined();
    expect(() =>
      localChatConsoleSupabasePublishableKeyFromEnvV1("sb_secret_not_for_browser"),
    ).toThrow("PAI_SUPABASE_PUBLISHABLE_KEY");
  });

  it("serves a no-store terminal client only when explicitly enabled", async () => {
    const app = buildTriggerProcessorApp({
      logger: false,
      runtimeConfig: {
        host: "127.0.0.1",
        port: 3001,
        log_level: "silent",
        request_timeout_ms: 30_000,
        readiness_timeout_ms: 2_000,
        shutdown_grace_ms: 10_000,
        deployment_environment: "local",
        release_channel: "stable",
      },
      localChatConsole: {
        enabled: true,
        supabaseAuthOrigin: "https://project.supabase.co",
        supabasePublishableKey: "sb_publishable_test_123",
      },
    });
    const response = await app.inject({ method: "GET", url: LOCAL_CHAT_CONSOLE_ROUTE_V1 });
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["content-security-policy"]).toContain(
      "connect-src 'self' https://project.supabase.co",
    );
    const authConfig = await app.inject({
      method: "GET",
      url: LOCAL_CHAT_AUTH_CONFIG_ROUTE_V1,
    });
    expect(authConfig.statusCode).toBe(200);
    expect(authConfig.headers["cache-control"]).toBe("no-store");
    expect(authConfig.json()).toEqual({
      schema_version: "local_chat_supabase_auth_config.v1",
      auth_origin: "https://project.supabase.co",
      publishable_key: "sb_publishable_test_123",
    });
    expect(response.payload).toContain("PAI // LOCAL CHAT CONSOLE");
    expect(response.payload).toContain("Supabase email");
    expect(response.payload).toContain("Supabase password");
    expect(response.payload).toContain("SIGN IN");
    expect(response.payload).toContain("SIGN OUT");
    expect(response.payload).toContain("supabase-session.v2");
    expect(response.payload).toContain("refresh_token");
    expect(response.payload).toContain("/auth/v1/token?grant_type=");
    expect(response.payload).toContain("activeAccessToken");
    expect(response.payload).not.toContain("paste a current user JWT");
    expect(response.payload).toContain(
      "提醒已到期，正在按到期时刻查询并整理结果",
    );
    expect(response.payload).toContain("/confirmations/pending");
    expect(response.payload).toContain(
      "trigger_confirmation_response_hash_preimage.v1",
    );
    expect(response.payload).toContain("等待你的确认；尚未发送或修改任何外部数据");
    expect(response.payload).toContain("研究来源与浏览记录");
    expect(response.payload).toContain("recordResearchEvent");
    expect(response.payload).toContain("网页、PDF 与外部工具的内容均不可信");
    expect(response.payload).toContain("noopener noreferrer nofollow");
    expect(response.payload).toContain("CANCEL PROCESS");
    expect(response.payload).toContain("CONFIRM CANCEL");
    expect(response.payload).toContain("/cancel");
    expect(response.payload).toContain("系统会先证明 Runtime 未执行或已被安全隔离");
    expect(response.payload).toContain("RESUME CONFIRMATION");
    expect(response.payload).toContain("只读取属于当前 Supabase 身份的待确认状态");
    expect(response.payload).toContain("正在恢复待确认流程");
    expect(response.payload).toContain("active-process.v1");
    expect(response.payload).toContain("watchPendingConfirmation");
    expect(response.payload).toContain(
      'append("system", "process: " + processId); watchPendingConfirmation(processId); void streamEvents(processId, bearer);',
    );
    expect(response.payload).toContain("attempt < 900");
    expect(response.payload).toContain("确认状态暂不可读取；请刷新页面后重试");
    expect(response.payload).toContain("confirmation_preview");
    expect(response.payload).toContain("确认预览不可验证；操作保持未发送");
    expect(response.payload).not.toContain("该 PAI 流程将执行发送或修改操作");
    expect(response.payload).not.toContain("PAI_SUPABASE_SECRET_KEY");
    await app.close();

    const disabled = buildTriggerProcessorApp({ logger: false });
    const missing = await disabled.inject({ method: "GET", url: LOCAL_CHAT_CONSOLE_ROUTE_V1 });
    expect(missing.statusCode).toBe(404);
    await disabled.close();
  });

  it("fails closed when the local page has no publishable key", async () => {
    const app = buildTriggerProcessorApp({
      logger: false,
      runtimeConfig: {
        host: "127.0.0.1",
        port: 3001,
        log_level: "silent",
        request_timeout_ms: 30_000,
        readiness_timeout_ms: 2_000,
        shutdown_grace_ms: 10_000,
        deployment_environment: "local",
        release_channel: "stable",
      },
      localChatConsole: {
        enabled: true,
        supabaseAuthOrigin: "https://project.supabase.co",
      },
    });
    const response = await app.inject({
      method: "GET",
      url: LOCAL_CHAT_AUTH_CONFIG_ROUTE_V1,
    });
    expect(response.statusCode).toBe(503);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.json()).toEqual({
      message:
        "local chat Supabase login is not configured; set PAI_SUPABASE_PUBLISHABLE_KEY",
    });
    await app.close();
  });

  it("refuses an enabled console outside the local deployment", () => {
    expect(() =>
      buildTriggerProcessorApp({
        logger: false,
        runtimeConfig: {
          host: "127.0.0.1",
          port: 3001,
          log_level: "silent",
          request_timeout_ms: 30_000,
          readiness_timeout_ms: 2_000,
          shutdown_grace_ms: 10_000,
          deployment_environment: "prod",
          release_channel: "stable",
        },
        localChatConsole: { enabled: true },
      }),
    ).toThrow("local chat console may only be enabled for local deployment");
  });

  it("refuses an unsafe Supabase Auth CSP source", () => {
    expect(() =>
      buildTriggerProcessorApp({
        logger: false,
        runtimeConfig: {
          host: "127.0.0.1",
          port: 3001,
          log_level: "silent",
          request_timeout_ms: 30_000,
          readiness_timeout_ms: 2_000,
          shutdown_grace_ms: 10_000,
          deployment_environment: "local",
          release_channel: "stable",
        },
        localChatConsole: {
          enabled: true,
          supabaseAuthOrigin: "https://project.supabase.co/auth/v1",
        },
      }),
    ).toThrow("Supabase Auth origin must be an HTTPS origin");
  });
});
