import { canonicalJsonV1 } from "@pai/eventing";
import { describe, expect, it, vi } from "vitest";

import { createActionRuntimeToolPortV1 } from "../src/production-tool-port.v1.js";

const context = Object.freeze({
  runtime_run_id: "run-1",
  trigger_process_id: "process-1",
  trace_id: "trace-1",
  lease_generation: 3,
  idempotency_key: "run-1:tool:call-1",
  policy_snapshot_id: "policy-snapshot-1",
  policy_snapshot_hash: `sha256:${"1".repeat(64)}`,
  permission_id: "runtime-permission-1",
  permission_expires_at: "2030-01-01T00:05:00.000Z",
  actor_binding: Object.freeze({
    workload_service: "trigger_processor" as const,
    scope: Object.freeze({
      workspace_id: "workspace-1",
      bot_id: "bot-1",
      owner_agent_id: "agent-1",
      deployment_environment: "prod" as const,
      release_channel: "stable" as const,
    }),
    delegated_principal: Object.freeze({
      principal_id: "user-1",
      principal_type: "user" as const,
      roles: Object.freeze(["member"]),
    }),
    delegated_principal_hash: `sha256:${"2".repeat(64)}`,
  }),
  actor_binding_hash: `sha256:${"3".repeat(64)}`,
  signal: new AbortController().signal,
});

describe("Action Runtime production tool port", () => {
  it("admits only the explicit local Compose internal service origins", () => {
    vi.stubEnv("PAI_DEPLOYMENT_ENVIRONMENT", "local");
    vi.stubEnv("PAI_LOCAL_DOCKER_TRANSPORT", "true");
    expect(() => createActionRuntimeToolPortV1({
      memory_url: "http://memory:3004",
      timer_url: "http://timer-trigger-app:3006",
      signer: { sign: async () => "header.payload.signature" },
    })).not.toThrow();
    expect(() => createActionRuntimeToolPortV1({
      memory_url: "http://memory.internal:3004",
      timer_url: "http://timer-trigger-app:3006",
      signer: { sign: async () => "header.payload.signature" },
    })).toThrow(/Memory URL is invalid/u);
    vi.unstubAllEnvs();
  });

  it("rebinds Memory deep recall to the frozen Runtime identity and policy", async () => {
    let body: any;
    const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
      body = JSON.parse(String(init?.body));
      return new Response(
        canonicalJsonV1({
          code: "memory_deep_recall_completed",
          message: "completed",
          retryable: false,
          details: {
            request_id: "memory-request-1",
            ranking_profile_version: "memory.deep_recall.rrf.v1",
            graph_profile_version: "memory.deep_recall_graph.v1",
            items: [],
            actual_graph_budget: {
              max_hops: 0,
              nodes_visited: 0,
              edges_visited: 0,
            },
            is_partial: false,
            completed_channels: ["semantic", "timeline", "relationship"],
            missing_channels: [],
            second_query_executed: false,
            partial_reason: null,
          },
          trace_id: "trace-1",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const port = createActionRuntimeToolPortV1({
      memory_url: "https://memory.example.test",
      timer_url: "https://timer.example.test",
      signer: { sign: async () => "header.payload.signature" },
      fetch: fetchImpl,
    });
    const result = await port.invoke(
      {
        tool_call_id: "call-1",
        tool_name: "memory.deepRecall",
        capability: "memory.deep_recall",
        arguments: { query: "remember this" },
      },
      context,
    );
    expect(result).toMatchObject({
      outcome: "completed",
      side_effect_status: "none",
    });
    expect(result).not.toHaveProperty("external_response_ref");
    expect(body).toMatchObject({
      bot_id: "bot-1",
      owner_agent_id: "agent-1",
      runtime_run_id: "run-1",
      trigger_process_id: "process-1",
      policy_snapshot_id: "policy-snapshot-1",
      policy_snapshot_hash: context.policy_snapshot_hash,
      capability_token: "header.payload.signature",
      capability_token_id: "runtime-permission-1",
      scope: { channels: ["semantic", "timeline", "relationship"] },
    });
  });

  it("maps the camel Timer alias to the typed idempotent owner command", async () => {
    let body: any;
    const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
      body = JSON.parse(String(init?.body));
      return new Response(
        canonicalJsonV1({
          schema_version: "timer.schedule_command.v1",
          timer_command_request_id: "timer-request-1",
          schedule_id: "schedule-1",
          schedule_version: 1,
          duplicate_replayed: false,
          method: "timer.remind_at",
          command: "create",
          occurrence_id: "occurrence-1",
          schedule_status: "active",
          next_fire_at: "2030-01-01T00:01:00.000Z",
          timezone: "UTC",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const port = createActionRuntimeToolPortV1({
      memory_url: "https://memory.example.test",
      timer_url: "https://timer.example.test",
      signer: { sign: async () => "header.payload.signature" },
      fetch: fetchImpl,
    });
    const result = await port.invoke(
      {
        tool_call_id: "call-1",
        tool_name: "timer.remindAt",
        capability: "timer.write",
        arguments: {
          schedule: {
            name: "Reminder",
            message: "Do the thing",
            timezone: "UTC",
            catch_up: false,
            schedule_type: "once",
            fire_at: "2030-01-01T00:01:00.000Z",
          },
        },
      },
      context,
    );
    expect(result).toMatchObject({
      outcome: "completed",
      side_effect_status: "produced",
    });
    expect(result).not.toHaveProperty("external_response_ref");
    expect(body).toMatchObject({
      method: "timer.remind_at",
      command: "create",
      runtime_run_id: "run-1",
      trigger_process_id: "process-1",
      workspace_id: "workspace-1",
      bot_id: "bot-1",
    });
  });

  it("turns a bounded relative reminder into an exact durable fire_at at the host clock", async () => {
    let body: any;
    const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
      body = JSON.parse(String(init?.body));
      return new Response(
        canonicalJsonV1({
          schema_version: "timer.schedule_command.v1",
          timer_command_request_id: "timer-request-relative-1",
          schedule_id: "schedule-relative-1",
          schedule_version: 1,
          duplicate_replayed: false,
          method: "timer.remind_after",
          command: "create",
          occurrence_id: "occurrence-relative-1",
          schedule_status: "active",
          next_fire_at: "2030-01-01T00:03:00.000Z",
          timezone: "Asia/Shanghai",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const port = createActionRuntimeToolPortV1({
      memory_url: "https://memory.example.test",
      timer_url: "https://timer.example.test",
      signer: { sign: async () => "header.payload.signature" },
      now: () => new Date("2030-01-01T00:00:00.000Z"),
      fetch: fetchImpl,
    });
    const result = await port.invoke(
      {
        tool_call_id: "call-relative-1",
        tool_name: "timer.remind_after",
        capability: "timer.write",
        arguments: {
          after_seconds: 180,
          message: "Check Shanghai weather",
          timezone: "Asia/Shanghai",
        },
      },
      context,
    );
    expect(result).toMatchObject({
      outcome: "completed",
      side_effect_status: "produced",
    });
    expect(body.schedule).toEqual({
      name: "Reminder",
      message: "Check Shanghai weather",
      timezone: "Asia/Shanghai",
      catch_up: true,
      schedule_type: "once",
      fire_at: "2030-01-01T00:03:00.000Z",
    });
    expect(body).not.toHaveProperty("after_seconds");
  });

  it("reads current weather through fixed provider origins without accepting a user URL", async () => {
    const requests: URL[] = [];
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input));
      requests.push(url);
      if (url.hostname === "geocoding-api.open-meteo.com") {
        return new Response(
          JSON.stringify({
            results: [{
              name: "Shanghai",
              country: "China",
              admin1: "Shanghai",
              timezone: "Asia/Shanghai",
              latitude: 31.2304,
              longitude: 121.4737,
            }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          current: {
            time: "2030-01-01T00:00:00+08:00",
            temperature_2m: 21.5,
            apparent_temperature: 20.1,
            relative_humidity_2m: 70,
            precipitation: 0,
            weather_code: 1,
            wind_speed_10m: 12,
            wind_direction_10m: 90,
            is_day: 1,
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const port = createActionRuntimeToolPortV1({
      memory_url: "https://memory.example.test",
      timer_url: "https://timer.example.test",
      signer: { sign: async () => "header.payload.signature" },
      fetch: fetchImpl,
    });
    const result = await port.invoke(
      {
        tool_call_id: "call-weather-1",
        tool_name: "weather.current",
        capability: "weather.read",
        arguments: { location: "https://untrusted.example.test/Shanghai" },
      },
      context,
    );
    expect(result).toMatchObject({
      outcome: "completed",
      side_effect_status: "none",
      output: {
        provider: "open-meteo",
        location: { name: "Shanghai", country: "China" },
        current: { temperature_c: 21.5, weather_code: 1 },
      },
    });
    expect(result).not.toHaveProperty("external_response_ref");
    expect(requests.map((url) => url.origin)).toEqual([
      "https://geocoding-api.open-meteo.com",
      "https://api.open-meteo.com",
    ]);
    expect(requests[0]?.searchParams.get("name")).toBe(
      "https://untrusted.example.test/Shanghai",
    );
  });

  it("bridges only an allowlisted personal-assistant logical tool and keeps provider credentials server-side", async () => {
    const calls: Array<Readonly<{ request: Readonly<Record<string, unknown>>; headers: Headers }>> = [];
    const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
      const request = JSON.parse(String(init?.body)) as Readonly<Record<string, unknown>>;
      calls.push(Object.freeze({ request, headers: new Headers(init?.headers) }));
      if (request.method === "initialize") {
        return new Response(
          canonicalJsonV1({
            jsonrpc: "2.0",
            id: request.id,
            result: { protocolVersion: "2025-06-18", capabilities: {}, serverInfo: { name: "test" } },
          }),
          { status: 200, headers: { "content-type": "application/json", "mcp-session-id": "personal-session-1" } },
        );
      }
      if (request.method === "notifications/initialized") {
        return new Response(undefined, { status: 202 });
      }
      return new Response(
        canonicalJsonV1({
          jsonrpc: "2.0",
          id: request.id,
          result: {
            isError: false,
            content: [{ type: "text", text: "untrusted provider document title" }],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const port = createActionRuntimeToolPortV1({
      memory_url: "https://memory.example.test",
      timer_url: "https://timer.example.test",
      signer: { sign: async () => "header.payload.signature" },
      personal_assistant_mcp: {
        mcp_url: "https://personal.example.test/mcp",
        bearer_token: "personal-assistant-test-bearer-token",
        tools: { "lark.doc.search": "lark_docs_search" },
      },
      fetch: fetchImpl,
    });
    await expect(
      port.invoke(
        {
          tool_call_id: "call-personal-doc-search-1",
          tool_name: "lark.doc.search",
          capability: "lark.doc.search",
          arguments: { query: "Project PAI" },
        },
        context,
      ),
    ).resolves.toMatchObject({
      outcome: "completed",
      side_effect_status: "none",
      output: {
        provider: "personal-assistant-mcp",
        remote_tool: "lark_docs_search",
        logical_tool: "lark.doc.search",
      },
    });
    expect(calls.map((entry) => entry.request.method)).toEqual([
      "initialize",
      "notifications/initialized",
      "tools/call",
    ]);
    expect(calls[0]?.headers.get("authorization")).toBe(
      "Bearer personal-assistant-test-bearer-token",
    );
    expect(calls[2]?.request).toMatchObject({
      method: "tools/call",
      params: {
        name: "lark_docs_search",
        arguments: { query: "Project PAI" },
        _meta: {
          "io.pai.personal-assistant": {
            principal_id: "user-1",
            principal_type: "user",
            actor_binding_hash: `sha256:${"3".repeat(64)}`,
          },
        },
      },
    });
  });

  it("allows the deployment-owned personal gateway only over the fixed local Docker origin", () => {
    vi.stubEnv("PAI_DEPLOYMENT_ENVIRONMENT", "local");
    vi.stubEnv("PAI_LOCAL_DOCKER_TRANSPORT", "true");
    expect(() => createActionRuntimeToolPortV1({
      memory_url: "http://memory:3004",
      timer_url: "http://timer-trigger-app:3006",
      signer: { sign: async () => "header.payload.signature" },
      personal_assistant_mcp: {
        mcp_url: "http://assistant-mcp-gateway:3010/mcp",
        bearer_token: "personal-assistant-test-bearer-token",
        tools: { "mail.search": "gmail_search" },
      },
    })).not.toThrow();
    vi.unstubAllEnvs();
  });

  it("does not let a personal-assistant document request carry a provider URL or local path", async () => {
    const port = createActionRuntimeToolPortV1({
      memory_url: "https://memory.example.test",
      timer_url: "https://timer.example.test",
      signer: { sign: async () => "header.payload.signature" },
      personal_assistant_mcp: {
        mcp_url: "https://assistant.example.test/mcp",
        bearer_token: "personal-assistant-token-1234567890",
        tools: { "lark.doc.read": "lark_doc_read" },
      },
    });

    const result = await port.invoke(
      {
        tool_call_id: "call-personal-doc-read-unsafe-1",
        tool_name: "lark.doc.read",
        capability: "lark.doc.read",
        arguments: { documentUrl: "http://127.0.0.1/admin" },
      },
      context,
    );

    expect(result).toMatchObject({
      outcome: "failed",
      retryable: false,
      side_effect_status: "none",
      error: { code: "personal_assistant_mcp_unsafe_arguments" },
    });
  });

  it("fails closed without retry when a configured personal write may have reached its provider", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
      const request = JSON.parse(String(init?.body)) as Readonly<Record<string, unknown>>;
      if (request.method === "initialize") {
        return new Response(
          canonicalJsonV1({
            jsonrpc: "2.0",
            id: request.id,
            result: { protocolVersion: "2025-06-18", capabilities: {}, serverInfo: { name: "test" } },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (request.method === "notifications/initialized") {
        return new Response(undefined, { status: 202 });
      }
      return new Response(undefined, { status: 503 });
    });
    const port = createActionRuntimeToolPortV1({
      memory_url: "https://memory.example.test",
      timer_url: "https://timer.example.test",
      signer: { sign: async () => "header.payload.signature" },
      personal_assistant_mcp: {
        mcp_url: "https://personal.example.test/mcp",
        bearer_token: "personal-assistant-test-bearer-token",
        tools: { "mail.send": "mail_send" },
      },
      fetch: fetchImpl,
    });
    await expect(
      port.invoke(
        {
          tool_call_id: "call-personal-mail-send-1",
          tool_name: "mail.send",
          capability: "mail.send",
          arguments: { recipient_id: "mailbox-contact-1", subject: "Hi", body: "Hello" },
        },
        context,
      ),
    ).resolves.toMatchObject({
      outcome: "failed",
      retryable: false,
      side_effect_status: "unknown",
      error: { code: "personal_assistant_mcp_gateway_unavailable" },
    });
  });

  it("bridges an authorized web search only to the fixed AgentCore Gateway MCP endpoint", async () => {
    const calls: Array<Readonly<{ url: string; request: Readonly<Record<string, unknown>>; headers: Headers }>> = [];
    const fetchImpl = vi.fn<typeof fetch>(async (input, requestInit) => {
      const request = JSON.parse(String(requestInit?.body)) as Readonly<Record<string, unknown>>;
      calls.push(Object.freeze({
        url: String(input),
        request,
        headers: new Headers(requestInit?.headers),
      }));
      if (request.method === "initialize") {
        return new Response(
          `event: message\ndata: ${canonicalJsonV1({
            jsonrpc: "2.0",
            id: request.id,
            result: { protocolVersion: "2025-06-18", capabilities: {}, serverInfo: { name: "test" } },
          })}\n\n`,
          {
            status: 200,
            headers: {
              "content-type": "text/event-stream",
              "mcp-session-id": "mcp-session-1",
            },
          },
        );
      }
      if (request.method === "notifications/initialized") {
        return new Response(undefined, { status: 202 });
      }
      return new Response(
        `event: message\ndata: ${canonicalJsonV1({
          jsonrpc: "2.0",
          id: request.id,
          result: {
            isError: false,
            content: [{ type: "text", text: "untrusted web result" }],
          },
        })}\n\n`,
        { status: 200, headers: { "content-type": "text/event-stream" } },
      );
    });
    const port = createActionRuntimeToolPortV1({
      memory_url: "https://memory.example.test",
      timer_url: "https://timer.example.test",
      signer: { sign: async () => "header.payload.signature" },
      agentcore_web: {
        mcp_url: "https://gateway.example.test/mcp",
        bearer_token: "agentcore-test-bearer-token",
        tools: { search: "web_search", fetch: "web_fetch", browser: "web_browser" },
      },
      fetch: fetchImpl,
    });
    const result = await port.invoke(
      {
        tool_call_id: "call-agentcore-search-1",
        tool_name: "web.search",
        capability: "web.search",
        arguments: { query: "Project PAI AgentCore" },
      },
      context,
    );
    expect(result).toMatchObject({
      outcome: "completed",
      side_effect_status: "none",
      output: {
        provider: "amazon-bedrock-agentcore-gateway",
        remote_tool: "web_search",
        content: [{ type: "text", text: "untrusted web result" }],
      },
    });
    expect(calls).toHaveLength(3);
    expect(calls.map((entry) => entry.url)).toEqual([
      "https://gateway.example.test/mcp",
      "https://gateway.example.test/mcp",
      "https://gateway.example.test/mcp",
    ]);
    expect(calls.map((entry) => entry.request.method)).toEqual([
      "initialize",
      "notifications/initialized",
      "tools/call",
    ]);
    expect(calls[0]?.headers).toMatchObject(new Headers({
      authorization: "Bearer agentcore-test-bearer-token",
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    }));
    expect(calls[1]?.headers.get("mcp-session-id")).toBe("mcp-session-1");
    expect(calls[2]?.headers.get("mcp-session-id")).toBe("mcp-session-1");
    expect(calls[2]?.request).toMatchObject({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "web_search",
        arguments: { query: "Project PAI AgentCore" },
      },
    });
  });

  it("fails closed for authorized web tools when the Gateway is absent", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const port = createActionRuntimeToolPortV1({
      memory_url: "https://memory.example.test",
      timer_url: "https://timer.example.test",
      signer: { sign: async () => "header.payload.signature" },
      fetch: fetchImpl,
    });
    await expect(
      port.invoke(
        {
          tool_call_id: "call-agentcore-unconfigured-1",
          tool_name: "web.browser",
          capability: "web.browser",
          arguments: { url: "https://example.test" },
        },
        context,
      ),
    ).resolves.toMatchObject({
      outcome: "failed",
      retryable: false,
      side_effect_status: "none",
      error: { code: "agentcore_web_not_configured" },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("requires all configured AgentCore tools at readiness", async () => {
    const calls: unknown[] = [];
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      calls.push({ url, body: init?.body });
      if (url === "https://memory.example.test/health" || url === "https://timer.example.test/health") {
        return new Response(undefined, { status: 200 });
      }
      const request = JSON.parse(String(init?.body));
      if (request.method === "notifications/initialized") {
        return new Response(undefined, { status: 202 });
      }
      return new Response(
        canonicalJsonV1({
          jsonrpc: "2.0",
          id: request.id,
          result: {
            tools: [
              { name: "web_search" },
              { name: "web_fetch" },
              { name: "web_browser" },
            ],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const port = createActionRuntimeToolPortV1({
      memory_url: "https://memory.example.test",
      timer_url: "https://timer.example.test",
      signer: { sign: async () => "header.payload.signature" },
      agentcore_web: {
        mcp_url: "https://gateway.example.test/mcp",
        bearer_token: "agentcore-test-bearer-token",
        tools: { search: "web_search", fetch: "web_fetch", browser: "web_browser" },
      },
      fetch: fetchImpl,
    });
    await expect(port.checkReadiness(new AbortController().signal)).resolves.toBeUndefined();
    expect(calls).toContainEqual(expect.objectContaining({ url: "https://gateway.example.test/mcp" }));
    const gatewayCall = calls.findLast(
      (entry) =>
        (entry as { url: string }).url === "https://gateway.example.test/mcp" &&
        JSON.parse(String((entry as { body: string }).body)).method === "tools/list",
    ) as { body: string } | undefined;
    expect(JSON.parse(String(gatewayCall?.body))).toMatchObject({ method: "tools/list" });
  });
});
