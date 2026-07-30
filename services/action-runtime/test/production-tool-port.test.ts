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
      external_response_ref: "memory:memory-request-1",
    });
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
      external_response_ref: "timer:timer-request-1",
    });
    expect(body).toMatchObject({
      method: "timer.remind_at",
      command: "create",
      runtime_run_id: "run-1",
      trigger_process_id: "process-1",
      workspace_id: "workspace-1",
      bot_id: "bot-1",
    });
  });
});
