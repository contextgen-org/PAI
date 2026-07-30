import type { ContextComposeRequestV1 } from "@pai/contracts";
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
  trace_id: "trace-1",
};

describe("Trigger Processor production HTTP ports", () => {
  it("signs context-catalog requests with only the canonical bot scope", async () => {
    const signer = {
      sign: vi.fn(async () => "workload-token"),
    };
    const ports = createTriggerProcessorHttpPortsV1({
      action_runtime_url: "http://127.0.0.1:3002",
      skill_registry_url: "http://127.0.0.1:3007",
      memory_url: "http://127.0.0.1:3004",
      knowthat_url: "http://127.0.0.1:3005",
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
});
