import type { RuntimeStartRequestV1 } from "@pai/contracts";
import { describe, expect, it, vi } from "vitest";

import { createTriggerRuntimeCommandTransportV1 } from "../src/production-command-dispatch.v1.js";

const hash = `sha256:${"a".repeat(64)}` as const;

function runtimeStartRequest(): RuntimeStartRequestV1 {
  const policySnapshot = {
    schema_version: "intent_policy_input_snapshot.v1" as const,
    snapshot_ref: "intent-policy:1",
    workspace_id: "workspace-1",
    bot_id: "bot-1",
    owner_agent_id: "agent-1",
    deployment_environment: "local" as const,
    release_channel: "stable" as const,
    bot_policy_revision_id: "policy-1",
    personality_ref: "personality-1",
    personality_version: 1,
    personality_hash: hash,
    safety_boundaries_ref: "safety-1",
    safety_boundaries_version: 1,
    safety_boundaries_hash: hash,
    tool_permission_profile_ref: "tool-profile:1",
    tool_permission_profile_revision: 1,
    tool_permission_profile_hash: hash,
    tool_policy_epoch: 1,
    catalog_version: "catalog-1",
    catalog_as_of: "2026-07-30T00:00:00.000Z",
    security_revocation_epoch: 1,
    skill_permission_summary_ref: "skill-permissions:1",
    skill_permission_summary_hash: hash,
    snapshot_hash: hash,
  };
  return {
    schema_version: "runtime_start.v1.2",
    trigger_process_id: "process-1",
    runtime_run_id: "run-1",
    workspace_id: "workspace-1",
    bot_id: "bot-1",
    owner_agent_id: "agent-1",
    deployment_environment: "local",
    release_channel: "stable",
    start_attempt_no: 1,
    start_fence_token: "fence-1",
    intent_ref: "intent-1",
    intent_version: 1,
    structured_intent_hash: hash,
    structured_intent: {
      goal: "respond",
      user_need: "a response",
      response_style: "concise",
      action_plan: [{ step: 1, action_type: "respond", action: "respond" }],
      required_skills: [],
      memory_followups: [],
      safety_notes: [],
      requires_confirmation: false,
    },
    context_snapshot_ref: "context-1",
    context_snapshot_version: 1,
    context_snapshot_hash: hash,
    intent_policy_snapshot_ref: policySnapshot.snapshot_ref,
    intent_policy_snapshot_hash: policySnapshot.snapshot_hash,
    intent_policy_snapshot: policySnapshot,
    expected_catalog_version: policySnapshot.catalog_version,
    catalog_as_of: policySnapshot.catalog_as_of,
    allowed_tools: [],
    allowed_skills: [],
    planned_skills: [],
    policy_input_ref: "policy-input-1",
    policy_input_hash: hash,
    policy: {
      schema_version: "runtime_policy_input.v1",
      intent_policy_snapshot_ref: policySnapshot.snapshot_ref,
      intent_policy_snapshot_hash: policySnapshot.snapshot_hash,
      created_at: "2026-07-29T00:00:00.000Z",
      expires_at: "2026-07-30T01:00:00.000Z",
    },
    confirmation_ref: null,
    confirmation_hash: null,
    preempt_token: "preempt-1",
    idempotency_key: "process-1:start:1",
    trace_id: "trace-1",
  };
}

describe("Trigger Runtime Start command transport", () => {
  it("delivers only a contract-bound Runtime Start and returns its receipt", async () => {
    const request = runtimeStartRequest();
    const signer = {
      sign: vi.fn(async () => "aaa.bbb.ccc"),
    };
    const fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          code: "runtime_queued",
          message: "Runtime execution queued",
          retryable: false,
          details: {
            status: "queued",
            runtime_run_id: request.runtime_run_id,
            start_attempt_no: request.start_attempt_no,
            start_fence_generation: 1,
            policy_snapshot_id: "runtime-policy:run-1",
            policy_snapshot_hash: hash,
            requested_catalog_version: request.expected_catalog_version,
            effective_catalog_version: request.expected_catalog_version,
            catalog_as_of: request.catalog_as_of,
          },
          trace_id: request.trace_id,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const transport = createTriggerRuntimeCommandTransportV1({
      action_runtime_url: "http://127.0.0.1:3002",
      signer,
      fetch,
    });

    await expect(
      transport.dispatch(
        {
          owner_service: "trigger_processor",
          outbox_table: "trigger_command_outbox",
          record: {
            id: "command-1",
            aggregate_id: request.trigger_process_id,
            command_type: "runtime.start",
            schema_version: "trigger_processor_command.v1",
            producer: "trigger_processor",
            target: "action_runtime",
            idempotency_key: request.idempotency_key,
            request_hash: hash,
            trace_id: request.trace_id,
            payload: request,
          },
        },
        new AbortController().signal,
      ),
    ).resolves.toEqual({ transport_ref: "runtime_start:run-1:1" });

    expect(signer.sign).toHaveBeenCalledWith({
      audience: "action_runtime",
      capabilities: ["runtime.start"],
      scope: {
        scope_kind: "bot",
        workspace_id: request.workspace_id,
        bot_id: request.bot_id,
        owner_agent_id: request.owner_agent_id,
        deployment_environment: request.deployment_environment,
        release_channel: request.release_channel,
      },
    });
    expect(String(fetch.mock.calls[0]?.[0])).toBe(
      "http://127.0.0.1:3002/internal/runtime/runs",
    );
    expect((fetch.mock.calls[0]?.[1] as RequestInit | undefined)?.method).toBe(
      "POST",
    );
  });
});
