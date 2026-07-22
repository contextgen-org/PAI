import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  AdmitTriggerAcceptedResponseV1Schema,
  AdmitTriggerCommandV1Schema,
  AdmitTriggerConflictResponseV1Schema,
  AdmitTriggerOkResponseV1Schema,
  AdmitTriggerRetryableFailureResponseV1Schema,
  AdmitTriggerWriterResponseV1Schema,
  TRIGGER_PROCESSOR_HTTP_OPERATIONS_V1,
  TriggerSubmitRequestV1Schema,
  TriggerSubmitResponseV1Schema,
  TriggerAdmissionDecisionV1Schema,
  TrustedAdmissionFactsV1Schema,
} from "../../src/index.js";

const occurrenceKey = `v1:${"a".repeat(43)}`;
const timerBody = {
  workspace_id: "workspace-1",
  bot_id: "bot-1",
  owner_agent_id: "agent-1",
  deployment_environment: "dev",
  release_channel: "stable",
  source: "timer",
  actor_type: "system",
  actor_id: "timer_app",
  payload: {
    workspace_id: "workspace-1",
    bot_id: "bot-1",
    owner_agent_id: "agent-1",
    deployment_environment: "dev",
    release_channel: "stable",
    schedule_id: "schedule-1",
    schedule_version: 3,
    occurrence_id: "occurrence-1",
    local_date: "2026-07-22",
    local_time: "08:30:00",
    timezone: "Asia/Shanghai",
    scheduled_for: "2026-07-22T00:30:00.000Z",
    occurrence_key: occurrenceKey,
    message: "run the scheduled task",
    is_catch_up: false,
    catch_up_batch_id: null,
    missed_window_summary: null,
  },
  dedupe_key: `timer:${occurrenceKey}`,
} as const;

const gatewayBodyBase = {
  workspace_id: "workspace-1",
  bot_id: "bot-1",
  owner_agent_id: "agent-1",
  deployment_environment: "dev",
  release_channel: "stable",
  actor_type: "user",
  actor_id: "user-1",
  payload: { message: "continue" },
} as const;

const chatBody = {
  ...gatewayBodyBase,
  source: "chat",
  dedupe_key: "chat:message-1",
} as const;

const notificationBody = {
  ...gatewayBodyBase,
  source: "notification",
  dedupe_key: "notification:event-1",
} as const;

const fifoSnapshot = {
  strong_fifo_revision: 11,
  strong_fifo_head_process_id: null,
  strong_fifo_head_admission_time: null,
  strong_fifo_preempt_commit_process_id: null,
} as const;

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
    ...fifoSnapshot,
  },
} as const;

const acceptedResponse = {
  code: "trigger_accepted",
  message: "accepted",
  retryable: false,
  details: {
    trigger_id: "trigger-1",
    trigger_status: "accepted",
    trigger_process_id: "process-1",
    process_phase: "admission",
    process_status: "running",
    priority: "strong",
    action: "dispatch",
    duplicate_replayed: false,
  },
  trace_id: "trace-1",
} as const;

describe("Trigger admission contracts", () => {
  it("accepts exact chat, notification and Timer branches with server-injected trace", () => {
    for (const body of [chatBody, notificationBody, timerBody]) {
      expect(Value.Check(TriggerSubmitRequestV1Schema, body)).toBe(true);
      expect(
        Value.Check(AdmitTriggerCommandV1Schema, {
          ...body,
          trace_id: "trace-1",
        }),
      ).toBe(true);
    }

    for (const invalid of [
      { ...chatBody, source: "timer" },
      { ...chatBody, actor_type: "system" },
      { ...notificationBody, source: "invented" },
      { ...timerBody, actor_id: "caller-selected" },
      { ...timerBody, trigger_id: "caller-trigger" },
      { ...timerBody, process_id: "caller-process" },
      { ...timerBody, trace_id: "caller-trace" },
      {
        ...timerBody,
        payload: { ...timerBody.payload, occurrence_key: "not-a-sha256-key" },
      },
      {
        ...timerBody,
        payload: {
          ...timerBody.payload,
          is_catch_up: true,
          catch_up_batch_id: null,
          missed_window_summary: null,
        },
      },
    ]) {
      expect(Value.Check(TriggerSubmitRequestV1Schema, invalid)).toBe(false);
    }
  });

  it("declares only the documented protected POST /v1/triggers operation", () => {
    expect(TRIGGER_PROCESSOR_HTTP_OPERATIONS_V1).toHaveLength(1);
    expect(TRIGGER_PROCESSOR_HTTP_OPERATIONS_V1[0]).toMatchObject({
      operation_id: "submitTriggerV1",
      method: "post",
      path: "/v1/triggers",
      source_bindings: [
        {
          source: "chat",
          authentication: "supabase_ingress",
          allowed_principal_types: ["user", "developer", "bot"],
          actor_derivation: "verified_supabase_principal",
          required_permission_scope: "trigger.submit.chat",
          principal_mapping: {
            user: "user_or_signed_super_user",
            developer: "developer",
            bot: "agent",
            operator: "rejected",
          },
        },
        {
          source: "notification",
          authentication: "supabase_ingress",
          allowed_principal_types: ["user", "developer", "bot"],
          actor_derivation: "verified_supabase_principal",
          required_permission_scope: "trigger.submit.notification",
          principal_mapping: {
            user: "user_or_signed_super_user",
            developer: "developer",
            bot: "agent",
            operator: "rejected",
          },
        },
        {
          source: "timer",
          authentication: "pai_workload_jwt",
          required_capability: "trigger.submit.timer",
          required_permission_scope: "trigger.submit.timer",
          allowed_caller: "timer_trigger_app",
        },
      ],
      responses: [200, 202, 400, 401, 403, 404, 409, 429, 500, 503],
    });
  });

  it("keeps accepted, rejected and duplicate replay responses structurally exact", () => {
    expect(Value.Check(AdmitTriggerAcceptedResponseV1Schema, acceptedResponse)).toBe(
      true,
    );
    expect(Value.Check(TriggerSubmitResponseV1Schema, acceptedResponse)).toBe(true);
    expect(
      Value.Check(AdmitTriggerAcceptedResponseV1Schema, {
        ...acceptedResponse,
        retryable: true,
      }),
    ).toBe(false);
    expect(
      Value.Check(AdmitTriggerAcceptedResponseV1Schema, {
        ...acceptedResponse,
        details: { trigger_id: "trigger-1" },
      }),
    ).toBe(false);
    for (const impossible of [
      {
        ...acceptedResponse,
        details: {
          ...acceptedResponse.details,
          process_phase: "closed",
          process_status: "running",
        },
      },
      {
        ...acceptedResponse,
        details: {
          ...acceptedResponse.details,
          action: "enqueue_weak",
          priority: "strong",
          process_status: "waiting",
        },
      },
      {
        ...acceptedResponse,
        details: {
          ...acceptedResponse.details,
          action: "dispatch_or_preempt",
          process_status: "running",
        },
      },
    ]) {
      expect(Value.Check(AdmitTriggerAcceptedResponseV1Schema, impossible)).toBe(
        false,
      );
    }

    expect(
      Value.Check(AdmitTriggerOkResponseV1Schema, {
        code: "duplicate_replayed",
        message: "duplicate",
        retryable: false,
        details: {
          ...acceptedResponse.details,
          action: "duplicate_replay",
          duplicate_replayed: true,
        },
        trace_id: "trace-2",
      }),
    ).toBe(true);
    expect(
      Value.Check(AdmitTriggerOkResponseV1Schema, {
        code: "duplicate_replayed",
        message: "duplicate",
        retryable: false,
        details: {
          ...acceptedResponse.details,
          process_phase: "closed",
          process_status: "running",
          action: "duplicate_replay",
          duplicate_replayed: true,
        },
        trace_id: "trace-2",
      }),
    ).toBe(false);
    expect(
      Value.Check(TriggerSubmitResponseV1Schema, {
        code: "invented_future_code",
        message: "no",
        retryable: false,
        details: {},
        trace_id: "trace-1",
      }),
    ).toBe(false);
    expect(
      Value.Check(AdmitTriggerRetryableFailureResponseV1Schema, {
        code: "storage_unavailable",
        message: "retry",
        retryable: true,
        details: { submit_attempt_id: null },
        trace_id: "trace-1",
      }),
    ).toBe(true);
    expect(
      Value.Check(AdmitTriggerConflictResponseV1Schema, {
        code: "idempotency_conflict",
        message: "conflict",
        retryable: false,
        details: {
          dedupe_key: timerBody.dedupe_key,
          existing_trigger_id: "trigger-existing",
          existing_process_id: "process-existing",
        },
        trace_id: "trace-1",
      }),
    ).toBe(true);
    for (const preAdmissionResult of [
      {
        code: "bot_permission_denied",
        message: "denied",
        retryable: false,
        details: {
          permission_scope: "trigger.submit.timer",
          policy: "bot_permission_binding_v1",
          reason_code: "bot_permission_denied",
          submit_attempt_id: "attempt-2",
        },
        trace_id: "trace-1",
      },
      {
        code: "bot_not_found",
        message: "missing",
        retryable: false,
        details: { submit_attempt_id: "attempt-not-found" },
        trace_id: "trace-1",
      },
      {
        code: "rate_limited",
        message: "limited",
        retryable: true,
        details: {
          retry_after_ms: 1_000,
          quota_key: "bot:bot-1",
          limit_window_ms: 60_000,
          submit_attempt_id: "attempt-3",
        },
        trace_id: "trace-1",
      },
    ] as const) {
      expect(
        Value.Check(AdmitTriggerWriterResponseV1Schema, preAdmissionResult),
      ).toBe(true);
    }
    expect(
      Value.Check(AdmitTriggerWriterResponseV1Schema, {
        code: "bot_permission_denied",
        message: "denied",
        retryable: false,
        details: {
          permission_scope: "trigger.submit.chat",
          policy: "supabase_ingress_principal_v1",
          reason_code: "timer_source_caller_denied",
          submit_attempt_id: "attempt-mismatch",
        },
        trace_id: "trace-1",
      }),
    ).toBe(false);
  });

  it("requires one coherent slot, process and Strong FIFO snapshot", () => {
    const idleFacts = {
      source: "timer",
      actor_type: "system",
      bot_state: "active",
      safety_blocked: false,
      trusted_strong_hint: false,
      explicit_interrupt: false,
      is_catch_up: false,
      foreground_slot_generation: 7,
      ...fifoSnapshot,
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
        strong_fifo_head_process_id: "process-head",
      }),
    ).toBe(false);
    expect(
      Value.Check(TrustedAdmissionFactsV1Schema, {
        ...idleFacts,
        strong_fifo_revision: Number.MAX_SAFE_INTEGER + 1,
      }),
    ).toBe(false);
    expect(
      Value.Check(TrustedAdmissionFactsV1Schema, {
        ...idleFacts,
        caller_priority: "strong",
      }),
    ).toBe(false);
  });

  it("binds every accepted decision to slot, process and FIFO preconditions", () => {
    expect(Value.Check(TriggerAdmissionDecisionV1Schema, acceptedDecision)).toBe(
      true,
    );
    expect(
      Value.Check(TriggerAdmissionDecisionV1Schema, {
        ...acceptedDecision,
        reason_code: "invented_future_reason",
      }),
    ).toBe(false);
    const { strong_fifo_revision: _, ...withoutQueueRevision } =
      acceptedDecision.admission_precondition;
    expect(
      Value.Check(TriggerAdmissionDecisionV1Schema, {
        ...acceptedDecision,
        admission_precondition: withoutQueueRevision,
      }),
    ).toBe(false);
    expect(
      Value.Check(TriggerAdmissionDecisionV1Schema, {
        ...acceptedDecision,
        admission_precondition: {
          kind: "occupied",
          process_id: "process-a",
          slot_generation: 7,
          phase: "execution",
          status: "running",
          process_updated_at: "2026-07-22T08:00:00.000Z",
          ...fifoSnapshot,
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
          process_updated_at: "2026-07-22T08:00:00.000Z",
          ...fifoSnapshot,
        },
      }),
    ).toBe(false);
    expect(
      Value.Check(TriggerAdmissionDecisionV1Schema, {
        ...acceptedDecision,
        admission_precondition: {
          kind: "occupied",
          process_id: "process-a",
          slot_generation: 7,
          phase: "execution",
          status: "running",
          process_updated_at: "not-a-canonical-timestamp",
          ...fifoSnapshot,
        },
      }),
    ).toBe(false);
  });
});
