import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  AdmitTriggerCommandV1Schema,
  AdmitTriggerRequestBodyV1Schema,
  AdmitTriggerResponseV1Schema,
  TriggerAdmissionDecisionV1Schema,
  TrustedAdmissionFactsV1Schema,
} from "../../src/index.js";

const acceptedDecision = {
  trigger_status: "accepted",
  priority: "strong",
  action: "dispatch",
  reason_code: "timer_due",
  initial_process_state: {
    phase: "admission",
    status: "running",
    wait_reason: null,
    terminal_reason: null,
  },
  admission_precondition: {
    kind: "idle",
    process_id: null,
    slot_generation: 7,
  },
} as const;

describe("TriggerAdmissionDecisionV1", () => {
  it("separates canonical HTTP body from route-injected source and trace", () => {
    const body = {
      trigger_id: "trigger-1",
      process_id: "process-1",
      scope: {
        scope_kind: "bot",
        workspace_id: "workspace-1",
        bot_id: "bot-1",
        owner_agent_id: "agent-1",
        deployment_environment: "dev",
        release_channel: "stable",
      },
      payload: { text: "hello" },
      dedupe_key: "dedupe-1",
      request_hash: "request-hash-1",
      idempotency_key: "submit-1",
      is_catch_up: false,
      explicit_interrupt: false,
    } as const;
    expect(Value.Check(AdmitTriggerRequestBodyV1Schema, body)).toBe(true);
    expect(
      Value.Check(AdmitTriggerRequestBodyV1Schema, {
        ...body,
        source: "chat",
      }),
    ).toBe(false);
    expect(
      Value.Check(AdmitTriggerRequestBodyV1Schema, {
        ...body,
        trace_id: "caller-trace",
      }),
    ).toBe(false);
    expect(
      Value.Check(AdmitTriggerCommandV1Schema, {
        ...body,
        source: "chat",
        trace_id: "route-trace",
      }),
    ).toBe(true);
    expect(
      Value.Check(AdmitTriggerResponseV1Schema, {
        code: "trigger_accepted",
        message: "accepted",
        retryable: false,
        details: { trigger_id: "trigger-1" },
        trace_id: "route-trace",
      }),
    ).toBe(true);
  });

  it("rejects malformed trusted-fact discriminants and undeclared fields", () => {
    const idleFacts = {
      source: "chat",
      actor_type: "user",
      bot_state: "active",
      safety_blocked: false,
      trusted_strong_hint: false,
      explicit_interrupt: false,
      is_catch_up: false,
      foreground_slot_generation: 7,
      active_process: "none",
      active_process_id: null,
      active_process_slot_generation: null,
      active_process_updated_at: null,
      foreground_slot_process_id: null,
    } as const;
    expect(Value.Check(TrustedAdmissionFactsV1Schema, idleFacts)).toBe(true);
    expect(
      Value.Check(TrustedAdmissionFactsV1Schema, {
        ...idleFacts,
        active_process: "cooldown_typo",
      }),
    ).toBe(false);
    expect(
      Value.Check(TrustedAdmissionFactsV1Schema, {
        ...idleFacts,
        caller_priority: "strong",
      }),
    ).toBe(false);
  });

  it("accepts registered reason codes and rejects invented accepted reasons", () => {
    expect(Value.Check(TriggerAdmissionDecisionV1Schema, acceptedDecision)).toBe(
      true,
    );
    expect(
      Value.Check(TriggerAdmissionDecisionV1Schema, {
        ...acceptedDecision,
        reason_code: "invented_future_reason",
      }),
    ).toBe(false);
  });

  it("requires an exact foreground slot identity and generation precondition", () => {
    const { admission_precondition: _, ...withoutPrecondition } =
      acceptedDecision;
    expect(
      Value.Check(TriggerAdmissionDecisionV1Schema, withoutPrecondition),
    ).toBe(false);
    expect(
      Value.Check(TriggerAdmissionDecisionV1Schema, {
        ...acceptedDecision,
        admission_precondition: {
          kind: "occupied",
          process_id: "process-a",
          slot_generation: -1,
          phase: "execution",
          status: "running",
          process_updated_at: "2026-07-20T08:00:00.000Z",
        },
      }),
    ).toBe(false);
    expect(
      Value.Check(TriggerAdmissionDecisionV1Schema, {
        ...acceptedDecision,
        admission_precondition: {
          kind: "occupied",
          process_id: "process-a",
          slot_generation: Number.MAX_SAFE_INTEGER + 1,
          phase: "execution",
          status: "running",
          process_updated_at: "2026-07-20T08:00:00.000Z",
        },
      }),
    ).toBe(false);
  });

  it("requires an exact active-process phase and version fence", () => {
    expect(
      Value.Check(TriggerAdmissionDecisionV1Schema, {
        ...acceptedDecision,
        admission_precondition: {
          kind: "occupied",
          process_id: "process-a",
          slot_generation: 7,
          phase: "execution",
          status: "running",
          process_updated_at: "2026-07-20T08:00:00.000Z",
        },
      }),
    ).toBe(true);
    expect(
      Value.Check(TriggerAdmissionDecisionV1Schema, {
        ...acceptedDecision,
        admission_precondition: {
          kind: "occupied",
          process_id: "process-a",
          slot_generation: 7,
          phase: "execution",
          status: "waiting",
          process_updated_at: "2026-07-20T08:00:00.000Z",
        },
      }),
    ).toBe(false);

    expect(
      Value.Check(TriggerAdmissionDecisionV1Schema, {
        ...acceptedDecision,
        admission_precondition: {
          kind: "idle",
          process_id: "process-a",
          slot_generation: 7,
        },
      }),
    ).toBe(false);
  });

  it("rejects cross-field combinations that no admission path can produce", () => {
    expect(
      Value.Check(TriggerAdmissionDecisionV1Schema, {
        ...acceptedDecision,
        priority: "weak",
        action: "enqueue_weak",
        reason_code: "timer_catch_up",
        initial_process_state: {
          phase: "admission",
          status: "running",
          wait_reason: "weak_queue",
          terminal_reason: null,
        },
      }),
    ).toBe(false);
  });
});
