import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  ContextComposeRequestV1Schema,
  IntentPolicyInputSnapshotV1Schema,
  RuntimeEventAppendRequestV1Schema,
  StructuredIntentV1Schema,
  assertContextComposeRequestBindingsV1,
  assertContextSourceOutcomesV1,
  assertRuntimeEventAppendBindingsV1,
  assertRuntimeObservationSummaryBindingsV1,
  assertStructuredIntentSemanticBindingsV1,
  type ContextSourceOutcomeV1,
  type RuntimeEventAppendRequestV1,
  type StructuredIntentV1,
} from "../../src/index.js";

const hash = `sha256:${"a".repeat(64)}` as const;
const at = "2026-07-30T00:00:00.000Z";

const intent: StructuredIntentV1 = {
  goal: "Complete the requested workflow",
  user_need: "A durable result",
  response_style: "concise",
  action_plan: [
    {
      step: 1,
      action_type: "tool_use",
      action: "read the canonical source",
      candidate_tool: "source.read",
      candidate_skill: "source-reader",
      requires_confirmation: false,
    },
    {
      step: 2,
      action_type: "respond",
      action: "return the verified result",
      depends_on: 1,
    },
  ],
  required_skills: ["source-reader"],
  memory_followups: [],
  safety_notes: [],
  requires_confirmation: false,
};

function outcome(
  source: ContextSourceOutcomeV1["source"],
): ContextSourceOutcomeV1 {
  return {
    source,
    status: "empty",
    retrieved_at: at,
    source_as_of: at,
    source_version: "source.v1",
    latency_ms: 1,
    result_count: 0,
    failure_reason: null,
  };
}

describe("Trigger Processor Day 11 contracts", () => {
  it("accepts the documented zero-valued policy epochs without losing integer precision", () => {
    const snapshot = {
      schema_version: "intent_policy_input_snapshot.v1",
      snapshot_ref: "intent-policy-snapshot-1",
      workspace_id: "workspace-1",
      bot_id: "bot-1",
      owner_agent_id: "agent-1",
      deployment_environment: "dev",
      release_channel: "stable",
      bot_policy_revision_id: "bot-policy-revision-1",
      personality_ref: "personality-1",
      personality_version: 1,
      personality_hash: hash,
      safety_boundaries_ref: "safety-1",
      safety_boundaries_version: 1,
      safety_boundaries_hash: hash,
      tool_permission_profile_ref: "tool-profile-1",
      tool_permission_profile_revision: 1,
      tool_permission_profile_hash: hash,
      tool_policy_epoch: 0,
      catalog_version: "catalog-1",
      catalog_as_of: at,
      security_revocation_epoch: 0,
      skill_permission_summary_ref: "permission-summary-1",
      skill_permission_summary_hash: hash,
      snapshot_hash: hash,
    } as const;

    expect(Value.Check(IntentPolicyInputSnapshotV1Schema, snapshot)).toBe(true);
    expect(
      Value.Check(IntentPolicyInputSnapshotV1Schema, {
        ...snapshot,
        tool_policy_epoch: -1,
      }),
    ).toBe(false);
    expect(
      Value.Check(IntentPolicyInputSnapshotV1Schema, {
        ...snapshot,
        security_revocation_epoch: Number.MAX_SAFE_INTEGER + 1,
      }),
    ).toBe(false);
  });

  it("requires exactly one auditable outcome for each frozen context source", () => {
    const outcomes = [
      outcome("knowthat"),
      outcome("memory"),
      outcome("skill"),
      outcome("environment"),
      outcome("history"),
    ];
    expect(() => assertContextSourceOutcomesV1(outcomes)).not.toThrow();
    expect(() =>
      assertContextSourceOutcomesV1([...outcomes.slice(0, 4), outcome("history")]),
    ).not.toThrow();
    expect(() =>
      assertContextSourceOutcomesV1([...outcomes.slice(0, 4), outcome("memory")]),
    ).toThrow(/exactly one outcome/u);
    expect(() =>
      assertContextSourceOutcomesV1([
        { ...outcomes[0]!, status: "failed", failure_reason: "owner_failed" },
        ...outcomes.slice(1),
      ]),
    ).toThrow(/contradicts/u);
    expect(() =>
      assertContextSourceOutcomesV1([
        {
          ...outcomes[0]!,
          source_as_of: "2026-07-30T00:00:01.000Z",
        },
        ...outcomes.slice(1),
      ]),
    ).toThrow(/contradicts/u);
  });

  it("binds the compose idempotency key and partitions all five sources", () => {
    const request = {
      schema_version: "context_compose_request.v1",
      trigger_process_id: "process-1",
      workspace_id: "workspace-1",
      bot_id: "bot-1",
      owner_agent_id: "agent-1",
      deployment_environment: "dev",
      release_channel: "stable",
      trigger: { trigger_id: "trigger-1", source: "chat", actor_type: "user" },
      context_version: 1,
      source_policy: {
        required_sources: ["environment"],
        allowed_sources: ["knowthat", "memory", "skill", "environment"],
        skip_decisions: [
          {
            source: "history",
            policy_id: "isolation-policy-1",
            reason_code: "isolated_execution",
            source_owner: "trigger_processor",
          },
        ],
      },
      idempotency_key: "process-1:context:1",
      trace_id: "trace-1",
    } as const;
    expect(Value.Check(ContextComposeRequestV1Schema, request)).toBe(true);
    expect(() => assertContextComposeRequestBindingsV1(request)).not.toThrow();
    expect(() =>
      assertContextComposeRequestBindingsV1({
        ...request,
        idempotency_key: "drifted",
      }),
    ).toThrow(/semantic binding/u);
    expect(() =>
      assertContextComposeRequestBindingsV1({
        ...request,
        source_policy: {
          ...request.source_policy,
          skip_decisions: [
            { ...request.source_policy.skip_decisions[0]!, source_owner: "memory" },
          ],
        },
      }),
    ).toThrow(/semantic binding/u);
    expect(() =>
      assertContextComposeRequestBindingsV1({
        ...request,
        source_policy: {
          required_sources: ["history"],
          allowed_sources: ["knowthat", "memory", "skill", "environment"],
          skip_decisions: request.source_policy.skip_decisions,
        },
      }),
    ).toThrow(/semantic binding/u);
  });

  it("keeps StructuredIntent provider-agnostic and validates its ordered DAG", () => {
    expect(Value.Check(StructuredIntentV1Schema, intent)).toBe(true);
    expect(() => assertStructuredIntentSemanticBindingsV1(intent)).not.toThrow();
    expect(
      Value.Check(StructuredIntentV1Schema, {
        ...intent,
        policy_decision: "allow",
      }),
    ).toBe(false);
    expect(() =>
      assertStructuredIntentSemanticBindingsV1({
        ...intent,
        action_plan: [{ ...intent.action_plan[0]!, step: 2 }],
      }),
    ).toThrow(/ordered DAG/u);
  });

  it("binds a safe observation projection to the authenticated Runtime event", () => {
    const event = {
      event_id: "event-1",
      event_type: "runtime.run.started",
      schema_version: "runtime_event.v1",
      producer: "action_runtime",
      occurred_at: at,
      idempotency_key: "run-1:started",
      trace_id: "trace-1",
      payload: {
        trigger_process_id: "process-1",
        runtime_run_id: "run-1",
        workspace_id: "workspace-1",
        bot_id: "bot-1",
        owner_agent_id: "agent-1",
        deployment_environment: "dev",
        release_channel: "stable",
        start_attempt_no: 1,
        start_fence_generation: 1,
        status: "running",
        duration_ms: null,
        reason_code: null,
        error_summary: null,
        terminal_artifact_ref: null,
      },
    } as const;
    const request: RuntimeEventAppendRequestV1 = {
      trigger_process_id: "process-1",
      runtime_run_id: "run-1",
      source_event_id: "event-1",
      source_service: "action_runtime",
      source_sequence_no: 1,
      event_type: "runtime.run.started",
      schema_version: "runtime_event.v1",
      occurred_at: at,
      trace_id: "trace-1",
      append_type: "runtime_event",
      payload_ref: "runtime-event:event-1",
      payload_hash: hash,
      observation_summary: {
        runtime_run_id: "run-1",
        status: "running",
        duration_ms: null,
        reason_code: null,
        error_summary: null,
        artifact_ref: null,
      },
      idempotency_key: "action_runtime:event-1",
    };
    expect(Value.Check(RuntimeEventAppendRequestV1Schema, request)).toBe(true);
    expect(() =>
      assertRuntimeEventAppendBindingsV1(request, "action_runtime", event),
    ).not.toThrow();
    expect(() =>
      assertRuntimeObservationSummaryBindingsV1(request, event),
    ).not.toThrow();
    expect(() =>
      assertRuntimeObservationSummaryBindingsV1(
        {
          ...request,
          observation_summary: {
            ...request.observation_summary,
            status: "completed",
          },
        },
        event,
      ),
    ).toThrow(/observation summary/u);
  });
});
