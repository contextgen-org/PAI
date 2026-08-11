import type {
  ContextComposeRequestV1,
  RuntimeEventResolveRequestV1,
} from "@pai/contracts";
import { describe, expect, it, vi } from "vitest";

import { createTriggerProcessorHttpPortsV1 } from "../src/production-http-ports.v1.js";

const request: ContextComposeRequestV1 = {
  schema_version: "context_compose_request.v1",
  trigger_process_id: "process-1",
  workspace_id: "workspace-1",
  bot_id: "bot-1",
  owner_agent_id: "agent-1",
  deployment_environment: "local",
  release_channel: "stable",
  trigger: { trigger_id: "trigger-1", source: "chat", actor_type: "user" },
  context_version: 1,
  source_policy: {
    required_sources: [],
    allowed_sources: ["knowthat", "memory", "skill", "environment", "history"],
    skip_decisions: [],
  },
  idempotency_key: "process-1:context:1",
  trace_id: "11111111111111111111111111111111",
};

const runtimeEventRequest: RuntimeEventResolveRequestV1 = {
  schema_version: "runtime_event_resolve_request.v1",
  source_event_id: "runtime-event-1",
  payload_ref: "runtime_event:runtime-event-1",
  runtime_run_id: "runtime-run-1",
  trigger_process_id: "process-1",
  source_sequence_no: 1,
  expected_payload_hash:
    "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  workspace_id: "workspace-1",
  bot_id: "bot-1",
  owner_agent_id: "agent-1",
  deployment_environment: "local",
  release_channel: "stable",
  purpose: "trigger_snapshot_append",
  trace_id: "00000000-0000-4000-8000-000000000002",
};

describe("Trigger Processor production HTTP ports", () => {
  it("signs context-catalog requests with only the canonical bot scope", async () => {
    const signer = {
      sign: vi.fn(async () =>
        "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.c2ln",
      ),
    };
    const ports = createTriggerProcessorHttpPortsV1({
      action_runtime_url: "http://127.0.0.1:3002",
      skill_registry_url: "http://127.0.0.1:3007",
      memory_url: "http://127.0.0.1:3004",
      knowthat_url: "http://127.0.0.1:3005",
      timer_trigger_app_url: "http://127.0.0.1:3006",
      signer,
      context_query: { async readQuery() { return "context"; } },
      fetch: async () => new Response("unavailable", { status: 503 }),
    });

    await expect(
      ports.context_sources.skill.fetch(request, AbortSignal.timeout(1_000)),
    ).rejects.toThrow();

    expect(signer.sign).toHaveBeenCalledWith(expect.objectContaining({
      audience: "skill_registry",
      capabilities: ["skill.context_catalog.read"],
      scope: {
        scope_kind: "bot",
        workspace_id: "workspace-1",
        bot_id: "bot-1",
        owner_agent_id: "agent-1",
        deployment_environment: "local",
        release_channel: "stable",
      },
    }));
  });

  it("uses the literal Action Runtime event-resolve HTTP route", async () => {
    const signer = {
      sign: vi.fn(async () =>
        "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.c2ln",
      ),
    };
    const fetch = vi.fn(async () => new Response("unavailable", { status: 503 }));
    const ports = createTriggerProcessorHttpPortsV1({
      action_runtime_url: "http://127.0.0.1:3002",
      skill_registry_url: "http://127.0.0.1:3007",
      memory_url: "http://127.0.0.1:3004",
      knowthat_url: "http://127.0.0.1:3005",
      timer_trigger_app_url: "http://127.0.0.1:3006",
      signer,
      context_query: { async readQuery() { return "context"; } },
      fetch,
    });

    await expect(
      ports.runtime_events.resolve(runtimeEventRequest, AbortSignal.timeout(1_000)),
    ).rejects.toThrow();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(fetch.mock.calls[0]?.[0])).toBe(
      "http://127.0.0.1:3002/internal/runtime-events:resolve",
    );
  });

  it("reads delayed Timer follow-ups through a scoped Trigger workload credential", async () => {
    const signer = {
      sign: vi.fn(async () =>
        "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.c2ln",
      ),
    };
    const fetch = vi.fn(async () => new Response("unavailable", { status: 503 }));
    const ports = createTriggerProcessorHttpPortsV1({
      action_runtime_url: "http://127.0.0.1:3002",
      skill_registry_url: "http://127.0.0.1:3007",
      memory_url: "http://127.0.0.1:3004",
      knowthat_url: "http://127.0.0.1:3005",
      timer_trigger_app_url: "http://127.0.0.1:3006",
      signer,
      context_query: { async readQuery() { return "context"; } },
      fetch,
    });

    await expect(
      ports.timer_follow_ups.list(
        {
          trigger_process_id: "process-1",
          workspace_id: "workspace-1",
          bot_id: "bot-1",
          owner_agent_id: "agent-1",
          deployment_environment: "local",
          release_channel: "stable",
          trace_id: "33333333333333333333333333333333",
        },
        AbortSignal.timeout(1_000),
      ),
    ).rejects.toThrow();

    expect(signer.sign).toHaveBeenCalledWith(expect.objectContaining({
      audience: "timer_trigger_app",
      capabilities: ["timer.read"],
      scope: {
        scope_kind: "bot",
        workspace_id: "workspace-1",
        bot_id: "bot-1",
        owner_agent_id: "agent-1",
        deployment_environment: "local",
        release_channel: "stable",
      },
    }));
    expect(String(fetch.mock.calls[0]?.[0])).toContain(
      "http://127.0.0.1:3006/internal/agent-timers?",
    );
  });
});
