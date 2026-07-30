import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  ACTION_RUNTIME_DOMAIN_EVENT_TYPES_V1,
  RuntimeCancelContractV1Schema,
  RuntimeDomainEventV1Schema,
  RuntimePreemptContractV1Schema,
  RuntimeStartRequestV1Schema,
  RuntimeUserRetractContractV1Schema,
  assertIntentSynthesizeRequestBindingsV1,
  assertRuntimeDomainEventSemanticBindingsV1,
  assertRuntimeStartSemanticBindingsV1,
  type ActionRuntimeDomainEventTypeV1,
  type RuntimeStartRequestV1,
} from "../../src/index.js";

const at = "2026-07-30T00:00:00.000Z";
const hash = `sha256:${"c".repeat(64)}` as const;
const scope = {
  workspace_id: "workspace-1",
  bot_id: "bot-1",
  owner_agent_id: "agent-1",
  deployment_environment: "dev" as const,
  release_channel: "stable" as const,
};

const intentPolicySnapshot = {
  schema_version: "intent_policy_input_snapshot.v1",
  snapshot_ref: "intent-policy:process-1:1",
  ...scope,
  bot_policy_revision_id: "bot-policy-r1",
  personality_ref: "personality:1",
  personality_version: 1,
  personality_hash: hash,
  safety_boundaries_ref: "safety:1",
  safety_boundaries_version: 1,
  safety_boundaries_hash: hash,
  tool_permission_profile_ref: "tool-profile:1",
  tool_permission_profile_revision: 1,
  tool_permission_profile_hash: hash,
  tool_policy_epoch: 1,
  catalog_version: "cat_184",
  catalog_as_of: at,
  security_revocation_epoch: 1,
  skill_permission_summary_ref: "skill-permissions:1",
  skill_permission_summary_hash: hash,
  snapshot_hash: hash,
} as const;

const runtimeStart: RuntimeStartRequestV1 = {
  schema_version: "runtime_start.v1.2",
  trigger_process_id: "process-1",
  runtime_run_id: "run-1",
  ...scope,
  start_attempt_no: 1,
  start_fence_token: "fence-1",
  intent_ref: "intent:process-1:1",
  intent_version: 1,
  structured_intent_hash: hash,
  structured_intent: {
    goal: "complete the workflow",
    user_need: "a durable result",
    response_style: "concise",
    action_plan: [
      {
        step: 1,
        action_type: "tool_use",
        action: "execute the pinned skill",
        candidate_skill: "skill-a",
      },
    ],
    required_skills: ["skill-b"],
    memory_followups: [],
    safety_notes: [],
    requires_confirmation: false,
  },
  context_snapshot_ref: "context:process-1:1",
  context_snapshot_version: 1,
  context_snapshot_hash: hash,
  intent_policy_snapshot_ref: intentPolicySnapshot.snapshot_ref,
  intent_policy_snapshot_hash: intentPolicySnapshot.snapshot_hash,
  intent_policy_snapshot: intentPolicySnapshot,
  expected_catalog_version: "cat_184",
  catalog_as_of: at,
  allowed_tools: [],
  allowed_skills: ["skill-a", "skill-b"],
  planned_skills: ["skill-b", "skill-a"],
  policy_input_ref: "policy-input:process-1:1",
  policy_input_hash: hash,
  policy: {
    schema_version: "runtime_policy_input.v1",
    intent_policy_snapshot_ref: intentPolicySnapshot.snapshot_ref,
    intent_policy_snapshot_hash: intentPolicySnapshot.snapshot_hash,
    created_at: at,
    expires_at: "2026-07-30T01:00:00.000Z",
  },
  confirmation_ref: null,
  confirmation_hash: null,
  preempt_token: "preempt-token-1",
  idempotency_key: "process-1:start:1",
  trace_id: "trace-1",
};

function runtimeEvent(eventType: ActionRuntimeDomainEventTypeV1) {
  const identity = {
    trigger_process_id: "process-1",
    runtime_run_id: "run-1",
    sequence_no: 1,
    ...scope,
    start_attempt_no: 1,
    start_fence_generation: 1,
  };
  let payload: Record<string, unknown>;
  if (eventType.startsWith("runtime.run.")) {
    const statuses = {
      "runtime.run.started": "running",
      "runtime.run.completed": "completed",
      "runtime.run.failed": "failed",
      "runtime.run.cancelled": "cancelled",
      "runtime.run.preempted": "cancelled",
    } as const;
    payload = {
      ...identity,
      status: statuses[eventType as keyof typeof statuses],
      previous_status:
        eventType === "runtime.run.started" ? "queued" : "running",
      next_status: statuses[eventType as keyof typeof statuses],
      model: "claude-sonnet-4-20250514",
      reason: eventType === "runtime.run.started" ? null : "run_terminal",
      duration_ms: eventType === "runtime.run.started" ? null : 10,
      reason_code: eventType === "runtime.run.started" ? null : "run_terminal",
      error_summary: eventType === "runtime.run.failed" ? "failed" : null,
      terminal_artifact_ref: null,
    };
  } else if (eventType.startsWith("runtime.tool.")) {
    const requested = eventType === "runtime.tool.requested";
    const completed = eventType === "runtime.tool.completed";
    const failed = eventType === "runtime.tool.failed";
    const outputRef =
      completed || failed ? "artifact:tool-invocation-1:result" : null;
    payload = {
      ...identity,
      tool_invocation_id: "tool-invocation-1",
      tool_name: "tool-a",
      status: eventType.slice("runtime.tool.".length),
      policy_snapshot_id: intentPolicySnapshot.snapshot_ref,
      capability_token_id: "permission:tool-invocation-1",
      input_ref: "artifact:tool-invocation-1:input",
      output_ref: outputRef,
      side_effect_status: completed ? "produced" : "none",
      downstream_idempotency_key: "run-1:tool-invocation-1",
      external_response_ref: completed ? outputRef : null,
      external_error_ref:
        failed ? "artifact:tool-invocation-1:external-error" : null,
      duplicate_replayed: false,
      error: failed
        ? {
            failure_class: "tool_execution_failed",
            code: "tool_failed",
            message: "The tool execution failed",
            retryable: false,
          }
        : null,
      duration_ms: requested ? null : 10,
      reason_code: requested ? null : "tool_terminal",
      error_summary: failed ? "failed" : null,
      artifact_ref: outputRef,
    };
  } else if (eventType.startsWith("runtime.artifact.")) {
    const created = eventType.endsWith("created");
    payload = {
      ...identity,
      artifact_id: "artifact-1",
      artifact_ref: created ? "artifact-1" : null,
      artifact_kind: "tool-result",
      content_hash: hash,
      size_bytes: 128,
      media_type: "application/json",
      retention_until: "2026-08-30T00:00:00.000Z",
      status: created ? "available" : "failed",
      artifact_status: created ? "available" : "failed",
      redaction_status: "complete",
      error: created
        ? null
        : {
            failure_class: "artifact_persistence_failed",
            code: "artifact_failed",
            message: "The artifact could not be persisted",
            retryable: true,
          },
      reason_code: created ? null : "artifact_failed",
      error_summary: created ? null : "failed",
    };
  } else if (eventType.startsWith("runtime.control_signal.")) {
    const handled = eventType.endsWith("handled");
    payload = {
      ...identity,
      runtime_signal_id: "signal-1",
      signal_type: "preempt",
      requested_by: "trigger_processor",
      control_valid_until: "2026-07-30T01:00:00.000Z",
      status: handled ? "handled" : "received",
      handled_status: handled ? "handled_safe_point" : null,
      target_lease_generation: 1,
      handled_lease_generation: handled ? 1 : null,
      final_fencing_generation: handled ? 1 : null,
      safe_point_reached: handled ? true : null,
      late_events_isolated: handled ? true : null,
      last_runtime_sequence_no: handled ? 4 : null,
      safe_point_ref: handled ? "safe-point-1" : null,
      isolation_proof_ref: null,
      reason_code: null,
    };
  } else {
    const status = eventType.slice("runtime.skill.load.".length);
    payload = {
      ...identity,
      skill_key: "skill-a",
      skill_version: status === "requested" ? null : "1.0.0",
      status,
      reason_code: status === "failed" ? "skill_load_failed" : null,
      error_summary: status === "failed" ? "failed" : null,
      materialized_artifact_ref:
        status === "materialized" ? "artifact-skill-1" : null,
    };
  }
  return {
    event_id: `event:${eventType}`,
    event_type: eventType,
    schema_version: "runtime_event.v1",
    producer: "action_runtime",
    occurred_at: at,
    idempotency_key: `run-1:${eventType}`,
    trace_id: "trace-1",
    payload,
  };
}

describe("Action Runtime Day 11 owner contracts", () => {
  it("binds intent synthesis to the policy snapshot five-tuple", () => {
    const request = {
      schema_version: "intent_synthesize_request.v1" as const,
      trigger_process_id: "process-1",
      ...scope,
      trigger_ref: "trigger-1",
      intent_version: 1,
      context_snapshot_ref: "context:process-1:1",
      context_snapshot_version: 1,
      context_snapshot_hash: hash,
      intent_policy_snapshot: intentPolicySnapshot,
      idempotency_key: "process-1:intent:1",
      trace_id: "trace-1",
    };
    expect(() => assertIntentSynthesizeRequestBindingsV1(request)).not.toThrow();
    expect(() =>
      assertIntentSynthesizeRequestBindingsV1({
        ...request,
        bot_id: "bot-other",
      }),
    ).toThrow(/identity binding/u);
  });

  it("binds Runtime Start scope, catalog, planned skills, confirmation, and lifetime", () => {
    expect(Value.Check(RuntimeStartRequestV1Schema, runtimeStart)).toBe(true);
    expect(() =>
      assertRuntimeStartSemanticBindingsV1(
        runtimeStart,
        Date.parse("2026-07-30T00:30:00.000Z"),
      ),
    ).not.toThrow();
    expect(() =>
      assertRuntimeStartSemanticBindingsV1(
        { ...runtimeStart, planned_skills: ["skill-a"] },
        Date.parse("2026-07-30T00:30:00.000Z"),
      ),
    ).toThrow(/semantic binding/u);
  });

  it("keeps all three stop-only Runtime control commands closed and versioned", () => {
    const base = {
      runtime_signal_id: "signal-1",
      runtime_run_id: "run-1",
      trigger_process_id: "process-1",
      start_attempt_no: 1,
      preempt_token: "preempt-token-1",
      reason_code: "user_requested",
      requested_at: at,
      idempotency_key: "signal-1",
      trace_id: "trace-1",
    };
    expect(
      Value.Check(RuntimeCancelContractV1Schema, {
        ...base,
        schema_version: "runtime_cancel.v1",
      }),
    ).toBe(true);
    expect(
      Value.Check(RuntimePreemptContractV1Schema, {
        ...base,
        schema_version: "runtime_preempt.v1",
      }),
    ).toBe(true);
    expect(
      Value.Check(RuntimeUserRetractContractV1Schema, {
        ...base,
        schema_version: "runtime_user_retract.v1",
      }),
    ).toBe(true);
    expect(
      Value.Check(RuntimeCancelContractV1Schema, {
        ...base,
        schema_version: "runtime_cancel.v1",
        start_fence_generation: 1,
      }),
    ).toBe(false);
  });

  it("has an exhaustive, closed payload branch for every documented Runtime event", () => {
    expect(ACTION_RUNTIME_DOMAIN_EVENT_TYPES_V1).toHaveLength(17);
    for (const eventType of ACTION_RUNTIME_DOMAIN_EVENT_TYPES_V1) {
      const event = runtimeEvent(eventType);
      expect(
        Value.Check(RuntimeDomainEventV1Schema, event),
        `invalid runtime event fixture: ${eventType}`,
      ).toBe(true);
      expect(() =>
        assertRuntimeDomainEventSemanticBindingsV1(event as never),
      ).not.toThrow();
    }
    expect(
      Value.Check(RuntimeDomainEventV1Schema, {
        ...runtimeEvent("runtime.run.started"),
        schema_version: "runtime_event.v2",
      }),
    ).toBe(false);
    const missingBotScope = runtimeEvent("runtime.run.started");
    delete missingBotScope.payload.workspace_id;
    expect(Value.Check(RuntimeDomainEventV1Schema, missingBotScope)).toBe(false);
  });

  it("rejects a control completion that claims isolation without its durable proof", () => {
    const event = runtimeEvent("runtime.control_signal.handled");
    const invalid = {
      ...event,
      payload: {
        ...event.payload,
        handled_status: "cancelled_isolated_after_timeout",
        safe_point_reached: false,
        late_events_isolated: true,
        safe_point_ref: null,
        isolation_proof_ref: null,
      },
    };
    expect(Value.Check(RuntimeDomainEventV1Schema, invalid)).toBe(true);
    expect(() =>
      assertRuntimeDomainEventSemanticBindingsV1(invalid as never),
    ).toThrow(/isolation proof/u);
  });

  it("allows only Trigger Processor or Action Runtime as durable control intent owners", () => {
    const received = runtimeEvent(
      "runtime.control_signal.received",
    );
    expect(
      Value.Check(RuntimeDomainEventV1Schema, {
        ...received,
        payload: {
          ...received.payload,
          requested_by: "action_runtime",
          signal_type: "cancel",
          reason_code: "runtime_policy_expired",
        },
      }),
    ).toBe(true);
    expect(
      Value.Check(RuntimeDomainEventV1Schema, {
        ...received,
        payload: {
          ...received.payload,
          requested_by: "sdk_callback",
        },
      }),
    ).toBe(false);
  });
});
