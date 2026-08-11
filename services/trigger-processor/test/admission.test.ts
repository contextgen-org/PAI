import {
  AuthError,
  type IngressPrincipalType,
  type VerifiedSupabaseIngress,
  type VerifiedWorkloadCredential,
} from "@pai/auth";
import { TriggerAdmissionDecisionV1Schema } from "@pai/contracts";
import { OwnerRepositoryTransientErrorV1 } from "@pai/persistence";
import { ServiceError } from "@pai/service-kit";
import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  createTriggerAdmissionApplicationV1,
  InvalidAdmitTriggerCommandError,
  type TriggerAdmissionApplicationV1,
  type TriggerPreAdmissionFailureV1,
  type TriggerProcessorOwnerDatabaseV1,
} from "../src/application/trigger-admission.v1.js";
import { buildTriggerProcessorApp } from "../src/app.js";
import {
  assertTriggerAdmissionCommitPreconditionV1,
  calculateTriggerPriorityV1,
  decideTriggerAdmissionV1,
} from "../src/domain/admission.js";

const emptyFifo = {
  strong_fifo_revision: 11,
  strong_fifo_head_process_id: null,
  strong_fifo_head_admission_time: null,
  strong_fifo_preempt_commit_process_id: null,
} as const;

const base = {
  source: "chat" as const,
  actor_type: "user" as const,
  bot_state: "active" as const,
  safety_blocked: false,
  active_process: "none" as const,
  active_process_id: null,
  active_process_slot_generation: null,
  active_process_state_version: null,
  trusted_strong_hint: false,
  explicit_interrupt: false,
  is_catch_up: false,
  foreground_slot_process_id: null,
  foreground_slot_generation: 7,
  ...emptyFifo,
};

const currentEmptyFifo = {
  revision: 11,
  head_process_id: null,
  head_admission_time: null,
  preempt_commit_process_id: null,
} as const;

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

const timerCommand = { ...timerBody, trace_id: "trace-1" } as const;

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

const timerCredential = {
  claims: {
    iss: "pai-workload",
    sub: "timer_trigger_app",
    aud: "trigger_processor",
    jti: "credential-1",
    iat: 100,
    nbf: 100,
    exp: 200,
    capability: ["trigger.submit.timer"],
    scope_kind: "bot",
    workspace_id: "workspace-1",
    bot_id: "bot-1",
    owner_agent_id: "agent-1",
    deployment_environment: "dev",
    release_channel: "stable",
  },
  protectedHeader: { alg: "EdDSA", kid: "workload-key-1", typ: "JWT" },
} as const satisfies VerifiedWorkloadCredential;

const timerIngress = {
  authentication_kind: "pai_workload_jwt",
  credential: timerCredential,
} as const;

const observationGatewayCredential = {
  ...timerCredential,
  claims: {
    ...timerCredential.claims,
    sub: "observation_gateway",
    jti: "credential-observation-1",
  },
} as const satisfies VerifiedWorkloadCredential;

const TIMER_TOKEN = "aaa.bbb.ccc";
const SUPABASE_TOKEN = "ddd.eee.fff";
const OBSERVATION_TOKEN = "ggg.hhh.iii";

function supabaseCredential(
  principalType: IngressPrincipalType,
  principalId: string,
  roles: readonly string[] = ["member"],
): VerifiedSupabaseIngress {
  return {
    principal: {
      principal_type: principalType,
      principal_id: principalId,
      roles: [...roles],
      source_issuer: "https://project.supabase.co/auth/v1",
      source_subject: `subject-${principalId}`,
      auth_time: 100,
    },
    claims: {
      iss: "https://project.supabase.co/auth/v1",
      sub: `subject-${principalId}`,
      iat: 100,
      nbf: 100,
      exp: 200,
      aud: "authenticated",
    },
  };
}

const supabaseUserCredential = supabaseCredential("user", "user-1");
const supabaseUserIngress = {
  authentication_kind: "supabase_ingress",
  credential: supabaseUserCredential,
} as const;
const supabaseDeveloperIngress = {
  authentication_kind: "supabase_ingress",
  credential: supabaseCredential("developer", "developer-1", ["developer"]),
} as const;
const supabaseSuperUserIngress = {
  authentication_kind: "supabase_ingress",
  credential: supabaseCredential("user", "super-user-1", [
    "member",
    "super_user",
  ]),
} as const;
const supabaseBotIngress = {
  authentication_kind: "supabase_ingress",
  credential: supabaseCredential("bot", "agent-1", ["automation"]),
} as const;
const supabaseOperatorIngress = {
  authentication_kind: "supabase_ingress",
  credential: supabaseCredential("operator", "operator-1", ["operator"]),
} as const;

function acceptedResponse(traceId: string) {
  return {
    code: "trigger_accepted",
    message: "accepted",
    retryable: false,
    details: {
      trigger_id: "trigger-original-1",
      trigger_status: "accepted",
      trigger_process_id: "process-original-1",
      process_phase: "admission",
      process_status: "running",
      wait_reason: null,
      blocked_by_process_id: null,
      priority: "strong",
      action: "dispatch",
      reason_code: "timer_due",
      duplicate_replayed: false,
    },
    trace_id: traceId,
  } as const;
}

function withAttemptRecorder(
  application: Pick<TriggerAdmissionApplicationV1, "admit">,
  failures: TriggerPreAdmissionFailureV1[] = [],
): TriggerAdmissionApplicationV1 {
  let sequence = 0;
  return {
    ...application,
    async recordPreAdmissionFailure(failure) {
      failures.push(failure);
      sequence += 1;
      return `submit-attempt-${sequence}`;
    },
  };
}

function databaseCapturing(calls: Array<Record<string, unknown>>) {
  return {
    repository: {},
    deployment: {},
    unit_of_work: {
      owner_service: "trigger_processor",
      async withTransaction(request: Record<string, unknown>, work: Function) {
        calls.push({ transaction: request });
        return work(
          { owner_service: "trigger_processor", transaction_id: "tx-1" },
          {
            owner: {
              async executeWriter(
                _transaction: unknown,
                writerRequest: Record<string, unknown>,
              ) {
                calls.push({ writer: writerRequest });
                const args = writerRequest.arguments as Record<string, unknown>;
                if (writerRequest.writer === "record_trigger_submit_attempt_v1") {
                  return {
                    acknowledged: true,
                    submit_attempt_id: String(args.p_attempt_id),
                  };
                }
                const response = acceptedResponse(String(args.p_trace_id));
                return {
                  ...response,
                  details: {
                    ...response.details,
                    trigger_id: String(args.p_trigger_id),
                    trigger_process_id: String(args.p_process_id),
                  },
                };
              },
            },
          },
        );
      },
    },
  } as unknown as TriggerProcessorOwnerDatabaseV1;
}

describe("Trigger admission domain", () => {
  it("derives priority from trusted facts", () => {
    expect(calculateTriggerPriorityV1(base)).toBe("weak");
    expect(calculateTriggerPriorityV1({ ...base, actor_type: "super_user" })).toBe(
      "strong",
    );
    expect(
      calculateTriggerPriorityV1({
        ...base,
        source: "timer",
        actor_type: "system",
      }),
    ).toBe("strong");
  });

  it("keeps later strong work behind the immutable FIFO head", () => {
    const decision = decideTriggerAdmissionV1({
      ...base,
      source: "timer",
      actor_type: "system",
      strong_fifo_revision: 12,
      strong_fifo_head_process_id: "process-head",
      strong_fifo_head_admission_time: "2026-07-22T08:00:00.000Z",
      strong_fifo_preempt_commit_process_id: "process-head",
    });
    expect(decision).toMatchObject({
      priority: "strong",
      action: "enqueue_strong_fifo",
      reason_code: "strong_fifo_waiting",
      initial_process_state: {
        status: "waiting",
        wait_reason: "deferred_strong_queue",
      },
      admission_precondition: {
        strong_fifo_revision: 12,
        strong_fifo_head_process_id: "process-head",
        strong_fifo_preempt_commit_process_id: "process-head",
      },
    });
    expect(Value.Check(TriggerAdmissionDecisionV1Schema, decision)).toBe(true);
  });

  it("serializes catch-up work and keeps weak work behind an active process", () => {
    expect(
      decideTriggerAdmissionV1({
        ...base,
        source: "timer",
        actor_type: "system",
        is_catch_up: true,
        active_process: "execution_running",
        active_process_id: "process-active",
        active_process_slot_generation: 7,
        active_process_state_version: 9,
        foreground_slot_process_id: "process-active",
      }),
    ).toMatchObject({
      action: "enqueue_strong_fifo",
      reason_code: "catch_up_foreground_busy",
    });
    expect(
      decideTriggerAdmissionV1({
        ...base,
        active_process: "execution_running",
        active_process_id: "process-active",
        active_process_slot_generation: 7,
        active_process_state_version: 9,
        foreground_slot_process_id: "process-active",
      }),
    ).toMatchObject({ action: "enqueue_weak", reason_code: "active_process_running" });
  });

  it("queues Strong work behind a valid but non-preemptible foreground state", () => {
    const states = [
      ["context_running", "context", "running"],
      ["context_waiting", "context", "waiting"],
      ["intent_running", "intent", "running"],
      ["intent_waiting", "intent", "waiting"],
      ["execution_waiting", "execution", "waiting"],
      ["execution_preempt_requested", "execution", "preempt_requested"],
      ["execution_cancelling", "execution", "cancelling"],
    ] as const;
    for (const [active_process, phase, status] of states) {
      const decision = decideTriggerAdmissionV1({
        ...base,
        trusted_strong_hint: true,
        active_process,
        active_process_id: "process-active",
        active_process_slot_generation: 7,
        active_process_state_version: 9,
        foreground_slot_process_id: "process-active",
      });
      expect(decision).toMatchObject({
        trigger_status: "accepted",
        priority: "strong",
        action: "enqueue_strong_fifo",
        reason_code: "strong_fifo_waiting",
        initial_process_state: {
          phase: "admission",
          status: "waiting",
          wait_reason: "deferred_strong_queue",
        },
        admission_precondition: { phase, status },
      });
    }
    expect(
      decideTriggerAdmissionV1({
        ...base,
        source: "timer",
        actor_type: "system",
        active_process: "execution_waiting",
        active_process_id: "process-runtime-start",
        active_process_slot_generation: 7,
        active_process_state_version: 9,
        foreground_slot_process_id: "process-runtime-start",
      }),
    ).toMatchObject({
      action: "enqueue_strong_fifo",
      reason_code: "strong_fifo_waiting",
    });
  });

  it("dispatches trusted strong work over a completed runtime in cooldown", () => {
    expect(
      decideTriggerAdmissionV1({
        ...base,
        trusted_strong_hint: true,
        active_process: "cooldown_waiting",
        active_process_id: "process-cooldown",
        active_process_slot_generation: 7,
        foreground_slot_process_id: "process-cooldown",
        active_process_state_version: 9,
      }),
    ).toMatchObject({
      trigger_status: "accepted",
      priority: "strong",
      action: "dispatch",
      reason_code: "strong_supersede_cooldown",
      initial_process_state: { phase: "admission", status: "running" },
    });
  });

  it("dispatches a due timer over a completed runtime in cooldown without preempting it", () => {
    expect(
      decideTriggerAdmissionV1({
        ...base,
        source: "timer",
        actor_type: "system",
        active_process: "cooldown_waiting",
        active_process_id: "process-cooldown",
        active_process_slot_generation: 7,
        foreground_slot_process_id: "process-cooldown",
        active_process_state_version: 9,
      }),
    ).toMatchObject({
      trigger_status: "accepted",
      priority: "strong",
      action: "dispatch",
      reason_code: "timer_due_supersede_cooldown",
      initial_process_state: { phase: "admission", status: "running" },
    });
  });

  it("rejects torn slot/process/FIFO snapshots", () => {
    expect(() =>
      decideTriggerAdmissionV1({
        ...base,
        foreground_slot_process_id: "process-raced-in",
      }),
    ).toThrow("TrustedAdmissionFactsV1");
    expect(() =>
      decideTriggerAdmissionV1({
        ...base,
        strong_fifo_head_process_id: "head-a",
        strong_fifo_head_admission_time: "2026-07-22T08:00:00.000Z",
        strong_fifo_preempt_commit_process_id: "head-b",
      }),
    ).toThrow(/one consistent admission snapshot/);
  });

  it("fences both idle and occupied commits on the exact FIFO snapshot", () => {
    const idle = decideTriggerAdmissionV1(base);
    if (idle.trigger_status !== "accepted") throw new Error("expected accepted");
    expect(() =>
      assertTriggerAdmissionCommitPreconditionV1(
        idle,
        { process_id: null, generation: 7 },
        null,
        currentEmptyFifo,
      ),
    ).not.toThrow();
    expect(() =>
      assertTriggerAdmissionCommitPreconditionV1(
        idle,
        { process_id: null, generation: 7 },
        null,
        { ...currentEmptyFifo, revision: 12 },
      ),
    ).toThrow("changed before atomic trigger admission commit");

    const occupied = decideTriggerAdmissionV1({
      ...base,
      active_process: "execution_running",
      active_process_id: "process-a",
      active_process_slot_generation: 7,
      active_process_state_version: 9,
      foreground_slot_process_id: "process-a",
    });
    if (occupied.trigger_status !== "accepted") throw new Error("expected accepted");
    const process = {
      process_id: "process-a",
      phase: "execution" as const,
      status: "running" as const,
      state_version: 9,
    };
    expect(() =>
      assertTriggerAdmissionCommitPreconditionV1(
        occupied,
        { process_id: "process-a", generation: 7 },
        process,
        currentEmptyFifo,
      ),
    ).not.toThrow();
    expect(() =>
      assertTriggerAdmissionCommitPreconditionV1(
        occupied,
        { process_id: "process-a", generation: 7 },
        process,
        { ...currentEmptyFifo, head_process_id: "raced-head", head_admission_time: "2026-07-22T08:00:01.000Z" },
      ),
    ).toThrow("changed before atomic trigger admission commit");
    expect(() =>
      assertTriggerAdmissionCommitPreconditionV1(
        occupied,
        { process_id: "process-a", generation: 7 },
        { ...process, state_version: 10 },
        currentEmptyFifo,
      ),
    ).toThrow("changed before atomic trigger admission commit");
  });
});

describe("Trigger admission application", () => {
  it("records pre-admission failures through an attempt-only owner writer", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const application = createTriggerAdmissionApplicationV1(
      databaseCapturing(calls),
      { generateId: () => "attempt-generated-1" },
    );

    await expect(
      application.recordPreAdmissionFailure({
        trace_id: "trace-audit-1",
        result_code: "invalid_request",
        outcome: "schema_invalid",
        request_body: {
          workspace_id: "workspace-1",
          bot_id: "bot-1",
          source: "timer",
          actor_type: "system",
          actor_id: "timer_app",
          dedupe_key: timerBody.dedupe_key,
          payload: { present: true },
        },
        credential: timerIngress,
      }),
    ).resolves.toBe("attempt-generated-1");
    expect(calls[0]?.transaction).toEqual({
      operation: "record_trigger_submit_attempt",
      idempotency_key: "attempt-generated-1",
      trace_id: "trace-audit-1",
      isolation: "read_committed",
      retry: "none",
    });
    expect(calls[1]?.writer).toMatchObject({
      writer: "record_trigger_submit_attempt_v1",
      expected_rows: 1,
      arguments: {
        p_attempt_id: "attempt-generated-1",
        p_claimed_scope: {
          workspace_id: "workspace-1",
          bot_id: "bot-1",
          owner_agent_id: null,
          deployment_environment: null,
          release_channel: null,
        },
        p_claimed_source: "timer",
        p_claimed_actor: {
          actor_type: "system",
          actor_id: "timer_app",
        },
        p_claimed_dedupe_key: timerBody.dedupe_key,
        p_audit_request_hash:
          "sha256:5d66568e94e96b91630286020d179215f909904eb1f01aea1dfbae82651c2171",
        p_outcome: "schema_invalid",
        p_result_code: "invalid_request",
        p_retryable: false,
        p_authenticated_context: {
          authentication_kind: "pai_workload_jwt",
          principal_id: "timer_trigger_app",
          principal_type: "service",
          permission_scope: "trigger.submit.timer",
          workload_subject: "timer_trigger_app",
          credential_jti: "credential-1",
          credential_kid: "workload-key-1",
          scope_kind: "bot",
        },
        p_audit_payload: {
          request_body_present: true,
          timer_payload_present: true,
          request_hash_present: true,
          authenticated: true,
        },
        p_trace_id: "trace-audit-1",
      },
    });
  });

  it("generates identities server-side and calls only the serializable owner writer", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const generatedIds = ["trigger-generated-1", "process-generated-1"];
    const application = createTriggerAdmissionApplicationV1(
      databaseCapturing(calls),
      { generateId: () => generatedIds.shift() ?? "unexpected-extra-id" },
    );

    await expect(application.admit(timerIngress, timerCommand)).resolves.toEqual({
      ...acceptedResponse("trace-1"),
      details: {
        ...acceptedResponse("trace-1").details,
        trigger_id: "trigger-generated-1",
        trigger_process_id: "process-generated-1",
      },
    });
    expect(calls[0]?.transaction).toEqual({
      operation: "admit_trigger",
      idempotency_key: timerBody.dedupe_key,
      trace_id: "trace-1",
      isolation: "serializable",
      retry: "serialization_failures",
    });
    expect(calls[1]?.writer).toMatchObject({
      writer: "create_trigger_admission_v1",
      expected_rows: 1,
      arguments: {
        p_trigger_id: "trigger-generated-1",
        p_process_id: "process-generated-1",
        p_scope: {
          scope_kind: "bot",
          workspace_id: "workspace-1",
          bot_id: "bot-1",
          owner_agent_id: "agent-1",
          deployment_environment: "dev",
          release_channel: "stable",
        },
        p_source: "timer",
        p_actor: { actor_type: "system", actor_id: "timer_app" },
        p_payload: timerBody.payload,
        p_dedupe_key: timerBody.dedupe_key,
        p_request_hash: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
        p_authenticated_context: {
          authentication_kind: "pai_workload_jwt",
          principal_id: "timer_trigger_app",
          principal_type: "service",
          permission_scope: "trigger.submit.timer",
          delegated_principal: null,
          workload_subject: "timer_trigger_app",
          credential_jti: "credential-1",
          credential_kid: "workload-key-1",
        },
        p_admission_request: {
          is_catch_up: false,
          catch_up_batch_id: null,
          trusted_strong_hint: false,
          priority_hint: null,
          explicit_interrupt: false,
          requested_explicit_interrupt: false,
        },
        p_idempotency_key: timerBody.dedupe_key,
        p_trace_id: "trace-1",
      },
    });
  });

  it("derives public actors only from verified Supabase user, developer and bot principals", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const generatedIds = [
      "chat-trigger",
      "chat-process",
      "notification-trigger",
      "notification-process",
      "developer-trigger",
      "developer-process",
      "agent-trigger",
      "agent-process",
      "super-trigger",
      "super-process",
    ];
    const application = createTriggerAdmissionApplicationV1(
      databaseCapturing(calls),
      { generateId: () => generatedIds.shift() ?? "unexpected-id" },
    );

    await application.admit(supabaseUserIngress, {
      ...chatBody,
      trace_id: "trace-chat",
    });
    await application.admit(supabaseUserIngress, {
      ...notificationBody,
      trace_id: "trace-notification",
    });
    await application.admit(supabaseDeveloperIngress, {
      ...chatBody,
      actor_type: "developer",
      actor_id: "developer-1",
      dedupe_key: "chat:developer-1",
      priority_hint: "strong",
      trace_id: "trace-developer",
    });
    await application.admit(supabaseBotIngress, {
      ...notificationBody,
      actor_type: "agent",
      actor_id: "agent-1",
      dedupe_key: "notification:agent-1",
      trace_id: "trace-agent",
    });
    await application.admit(supabaseSuperUserIngress, {
      ...chatBody,
      actor_type: "super_user",
      actor_id: "super-user-1",
      dedupe_key: "chat:super-user-1",
      priority_hint: "strong",
      trace_id: "trace-super-user",
    });

    expect(calls[1]?.writer).toMatchObject({
      arguments: {
        p_source: "chat",
        p_actor: { actor_type: "user", actor_id: "user-1" },
        p_authenticated_context: {
          authentication_kind: "supabase_ingress",
          principal_id: "user-1",
          principal_type: "user",
          permission_scope: "trigger.submit.chat",
          delegated_principal: {
            principal_type: "user",
            principal_id: "user-1",
            roles: ["member"],
            source_issuer: "https://project.supabase.co/auth/v1",
            source_subject: "subject-user-1",
            auth_time: 100,
            scope_kind: "bot",
            workspace_id: "workspace-1",
            bot_id: "bot-1",
            owner_agent_id: "agent-1",
            deployment_environment: "dev",
            release_channel: "stable",
          },
          verified_principal: {
            principal_type: "user",
            principal_id: "user-1",
          },
        },
        p_admission_request: {
          is_catch_up: false,
          catch_up_batch_id: null,
          trusted_strong_hint: false,
          priority_hint: null,
          explicit_interrupt: false,
          requested_explicit_interrupt: false,
        },
      },
    });
    expect(calls[3]?.writer).toMatchObject({
      arguments: {
        p_source: "notification",
        p_actor: { actor_type: "user", actor_id: "user-1" },
        p_authenticated_context: {
          authentication_kind: "supabase_ingress",
          principal_id: "user-1",
          principal_type: "user",
          permission_scope: "trigger.submit.notification",
          verified_principal: { principal_type: "user", principal_id: "user-1" },
        },
      },
    });
    expect(calls[5]?.writer).toMatchObject({
      arguments: {
        p_actor: { actor_type: "developer", actor_id: "developer-1" },
        p_authenticated_context: {
          principal_id: "developer-1",
          principal_type: "developer",
          permission_scope: "trigger.submit.chat",
        },
        p_admission_request: {
          trusted_strong_hint: true,
          priority_hint: "strong",
        },
      },
    });
    expect(calls[7]?.writer).toMatchObject({
      arguments: {
        p_actor: { actor_type: "agent", actor_id: "agent-1" },
        p_authenticated_context: {
          principal_id: "agent-1",
          principal_type: "agent",
          permission_scope: "trigger.submit.notification",
          delegated_principal: null,
          verified_principal: {
            principal_type: "bot",
            principal_id: "agent-1",
          },
        },
      },
    });
    expect(calls[9]?.writer).toMatchObject({
      arguments: {
        p_actor: { actor_type: "super_user", actor_id: "super-user-1" },
        p_authenticated_context: {
          principal_id: "super-user-1",
          principal_type: "user",
          permission_scope: "trigger.submit.chat",
          verified_principal: {
            principal_type: "user",
            principal_id: "super-user-1",
            roles: ["member", "super_user"],
          },
        },
        p_admission_request: {
          trusted_strong_hint: true,
          priority_hint: "strong",
        },
      },
    });
  });

  it("rejects public actor spoofing, operator actors, workload ingress and untrusted priority hints", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const application = createTriggerAdmissionApplicationV1(databaseCapturing(calls));
    await expect(
      application.admit(supabaseUserIngress, {
        ...chatBody,
        actor_id: "attacker-selected",
        trace_id: "trace-spoof",
      }),
    ).rejects.toMatchObject({
      kind: "authorization_denied",
      source: "chat",
    });
    await expect(
      application.admit(supabaseUserIngress, {
        ...chatBody,
        actor_type: "super_user",
        trace_id: "trace-role-spoof",
      }),
    ).rejects.toMatchObject({
      kind: "authorization_denied",
      source: "chat",
    });
    await expect(
      application.admit(
        supabaseOperatorIngress,
        {
          ...chatBody,
          actor_id: "operator-1",
          trace_id: "trace-operator",
        },
      ),
    ).rejects.toMatchObject({ kind: "authorization_denied", source: "chat" });
    await expect(
      application.admit(
        timerIngress,
        { ...chatBody, trace_id: "trace-caller" },
      ),
    ).rejects.toMatchObject({ kind: "authorization_denied", source: "chat" });
    await expect(
      application.admit(
        supabaseUserIngress,
        { ...chatBody, priority_hint: "strong", trace_id: "trace-priority" },
      ),
    ).rejects.toMatchObject({ kind: "authorization_denied", source: "chat" });
    expect(calls).toHaveLength(0);
  });

  it("preflights bounded pure JSON before recursive admission schema validation", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const application = createTriggerAdmissionApplicationV1(
      databaseCapturing(calls),
    );
    let deeplyNested: unknown = "leaf";
    for (let depth = 0; depth < 130; depth += 1) {
      deeplyNested = { child: deeplyNested };
    }
    await expect(
      application.admit(supabaseUserIngress, {
        ...chatBody,
        payload: { deeplyNested },
        trace_id: "trace-deep",
      }),
    ).rejects.toMatchObject({
      kind: "invalid_request",
      message:
        "admission command is outside the bounded canonical JSON contract",
    });

    let proxyTrapCalls = 0;
    const proxiedCommand = new Proxy(
      { ...chatBody, trace_id: "trace-proxy" },
      {
        getPrototypeOf() {
          proxyTrapCalls += 1;
          return Object.prototype;
        },
      },
    );
    await expect(
      application.admit(supabaseUserIngress, proxiedCommand),
    ).rejects.toMatchObject({ kind: "invalid_request" });
    expect(proxyTrapCalls).toBe(0);
    expect(calls).toHaveLength(0);

    const shared = { value: "same-pure-json-value" };
    await expect(
      application.admit(supabaseUserIngress, {
        ...chatBody,
        payload: { first: shared, second: shared },
        trace_id: "trace-alias",
      }),
    ).resolves.toMatchObject({ code: "trigger_accepted" });
  });

  it("pins command and verified workload identity before transaction acquisition", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const gatedDatabase = databaseCapturing(calls);
    const originalWithTransaction =
      gatedDatabase.unit_of_work.withTransaction.bind(
        gatedDatabase.unit_of_work,
      );
    let releaseTransaction!: () => void;
    const transactionGate = new Promise<void>((resolve) => {
      releaseTransaction = resolve;
    });
    gatedDatabase.unit_of_work.withTransaction = (async (
      request: Parameters<typeof originalWithTransaction>[0],
      work: Parameters<typeof originalWithTransaction>[1],
    ) => {
      await transactionGate;
      return originalWithTransaction(request, work);
    }) as typeof gatedDatabase.unit_of_work.withTransaction;
    const generatedIds = ["trigger-pinned", "process-pinned"];
    const application = createTriggerAdmissionApplicationV1(
      gatedDatabase,
      { generateId: () => generatedIds.shift() ?? "unexpected-id" },
    );
    const mutableIngress = structuredClone(timerIngress);
    const mutableCommand = structuredClone(timerCommand);
    const pending = application.admit(mutableIngress, mutableCommand);

    Reflect.set(mutableCommand, "dedupe_key", "timer:mutated");
    Reflect.set(mutableCommand, "trace_id", "trace-mutated");
    Reflect.set(mutableCommand.payload, "message", "mutated message");
    Reflect.set(mutableIngress.credential.claims, "jti", "mutated-jti");
    releaseTransaction();

    await expect(pending).resolves.toMatchObject({
      code: "trigger_accepted",
      trace_id: timerCommand.trace_id,
    });
    expect(calls[1]).toMatchObject({
      writer: {
        arguments: {
          p_dedupe_key: timerCommand.dedupe_key,
          p_trace_id: timerCommand.trace_id,
          p_payload: { message: timerCommand.payload.message },
          p_authenticated_context: {
            credential_jti: timerCredential.claims.jti,
          },
        },
      },
    });
    const writer = calls[1]?.writer as
      | { arguments?: { p_payload?: object } }
      | undefined;
    expect(Object.isFrozen(writer?.arguments?.p_payload)).toBe(true);
  });

  it("hashes exactly the canonical TriggerSubmit request body", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const generatedIds = ["trigger-1", "process-1"];
    const application = createTriggerAdmissionApplicationV1(
      databaseCapturing(calls),
      { generateId: () => generatedIds.shift() ?? "unexpected-id" },
    );

    await application.admit(
      {
        authentication_kind: "pai_workload_jwt",
        credential: {
          ...timerCredential,
          claims: {
            ...timerCredential.claims,
            jti: "rotated-jti",
            capability: ["diagnostic.read", "trigger.submit.timer"],
          },
          protectedHeader: {
            ...timerCredential.protectedHeader,
            kid: "rotated-key",
          },
        },
      },
      timerCommand,
    );

    const writer = calls[1]?.writer as
      | { readonly arguments?: Readonly<Record<string, unknown>> }
      | undefined;
    expect(writer?.arguments?.p_request_hash).toBe(
      "sha256:56e3eeff3ca95622270e3b16d9fc15b26cbad34059cb7f443405b544e3db33ec",
    );
  });

  it("rejects scope, dedupe, payload-byte and authority drift before mutation", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const application = createTriggerAdmissionApplicationV1(databaseCapturing(calls));
    await expect(
      application.admit(timerIngress, {
        ...timerCommand,
        payload: { ...timerCommand.payload, workspace_id: "workspace-attacker" },
      }),
    ).rejects.toMatchObject({ kind: "authorization_scope_mismatch" });
    await expect(
      application.admit(timerIngress, {
        ...timerCommand,
        dedupe_key: "timer:wrong",
      }),
    ).rejects.toThrow("timer:{occurrence_key}");
    await expect(
      application.admit(timerIngress, {
        ...timerCommand,
        payload: { ...timerCommand.payload, message: "界".repeat(2_800) },
      }),
    ).rejects.toThrow("8KB");
    for (const invalidTime of [
      { ...timerCommand.payload, local_date: "2026-02-30" },
      {
        ...timerCommand.payload,
        scheduled_for: "2026-07-22T00:30:00+24:00",
      },
      { ...timerCommand.payload, timezone: "not/a-zone" },
      { ...timerCommand.payload, local_time: "09:30:00" },
    ]) {
      await expect(
        application.admit(timerIngress, {
          ...timerCommand,
          payload: invalidTime,
        }),
      ).rejects.toMatchObject({ kind: "invalid_request" });
    }
    await expect(
      application.admit(
        {
          authentication_kind: "pai_workload_jwt",
          credential: {
            ...timerCredential,
            claims: { ...timerCredential.claims, sub: "action_runtime" },
          },
        },
        timerCommand,
      ),
    ).rejects.toMatchObject({ kind: "authorization_denied" });
    await expect(
      application.admit(
        {
          authentication_kind: "pai_workload_jwt",
          credential: {
            ...timerCredential,
            claims: { ...timerCredential.claims, capability: [] },
          },
        },
        timerCommand,
      ),
    ).rejects.toMatchObject({ kind: "capability_denied" });
    expect(calls).toHaveLength(0);
  });

  it("rejects a non-canonical owner response", async () => {
    const database = {
      repository: {},
      deployment: {},
      unit_of_work: {
        owner_service: "trigger_processor",
        async withTransaction(_request: unknown, work: Function) {
          return work(
            { owner_service: "trigger_processor", transaction_id: "tx-bad" },
            { owner: { async executeWriter() { return { code: "future_code" }; } } },
          );
        },
      },
    } as unknown as TriggerProcessorOwnerDatabaseV1;
    await expect(
      createTriggerAdmissionApplicationV1(database).admit(
        timerIngress,
        timerCommand,
      ),
    ).rejects.toMatchObject({
      kind: "server_invariant",
      message:
        "create_trigger_admission_v1 returned a non-canonical response",
    } satisfies Partial<InvalidAdmitTriggerCommandError>);
  });

  it("rejects a valid writer envelope whose trace does not echo the request", async () => {
    let committed = 0;
    let rolledBack = 0;
    const database = {
      repository: {},
      deployment: {},
      unit_of_work: {
        owner_service: "trigger_processor",
        async withTransaction(_request: unknown, work: Function) {
          try {
            const result = await work(
              { owner_service: "trigger_processor", transaction_id: "tx-trace" },
              {
                owner: {
                  async executeWriter() {
                    return acceptedResponse("different-trace");
                  },
                },
              },
            );
            committed += 1;
            return result;
          } catch (error) {
            rolledBack += 1;
            throw error;
          }
        },
      },
    } as unknown as TriggerProcessorOwnerDatabaseV1;

    await expect(
      createTriggerAdmissionApplicationV1(database).admit(
        timerIngress,
        timerCommand,
      ),
    ).rejects.toMatchObject({ kind: "server_invariant" });
    expect({ committed, rolledBack }).toEqual({ committed: 0, rolledBack: 1 });
  });

  it("rejects a mismatched submit-attempt ACK before returning correlation", async () => {
    let committed = 0;
    let rolledBack = 0;
    const database = {
      repository: {},
      deployment: {},
      unit_of_work: {
        owner_service: "trigger_processor",
        async withTransaction(_request: unknown, work: Function) {
          try {
            const result = await work(
              { owner_service: "trigger_processor", transaction_id: "tx-bad-ack" },
              {
                owner: {
                  async executeWriter() {
                    return {
                      acknowledged: true,
                      submit_attempt_id: "different-attempt",
                    };
                  },
                },
              },
            );
            committed += 1;
            return result;
          } catch (error) {
            rolledBack += 1;
            throw error;
          }
        },
      },
    } as unknown as TriggerProcessorOwnerDatabaseV1;
    await expect(
      createTriggerAdmissionApplicationV1(database, {
        generateId: () => "expected-attempt",
      }).recordPreAdmissionFailure({
        trace_id: "trace-bad-ack",
        result_code: "unauthenticated",
        outcome: "identity_invalid",
        request_body: undefined,
      }),
    ).rejects.toMatchObject({
      kind: "server_invariant",
      message:
        "record_trigger_submit_attempt_v1 returned a non-canonical response",
    } satisfies Partial<InvalidAdmitTriggerCommandError>);
    expect({ committed, rolledBack }).toEqual({ committed: 0, rolledBack: 1 });
  });
});

describe("POST /v1/triggers", () => {
  it("captures mixed-ingress verifiers before caller mutation", async () => {
    let workloadCalls = 0;
    let supabaseCalls = 0;
    let admitted = 0;
    const workloadVerifier = {
      async verify(token: string) {
        workloadCalls += 1;
        if (token === TIMER_TOKEN) return timerCredential;
        throw new AuthError("unauthenticated", "not a workload JWT");
      },
    };
    const supabaseIngressVerifier = {
      async verify(token: string) {
        supabaseCalls += 1;
        if (token === SUPABASE_TOKEN) return supabaseUserCredential;
        throw new AuthError("unauthenticated", "not a Supabase JWT");
      },
    };
    const app = buildTriggerProcessorApp(
      {
        logger: false,
        auth: { verifier: workloadVerifier },
        supabaseIngressVerifier,
      },
      withAttemptRecorder({
        async admit(_credential, command) {
          admitted += 1;
          return acceptedResponse((command as { trace_id: string }).trace_id);
        },
      }),
    );
    workloadVerifier.verify = async () => {
      throw new Error("mutated workload verifier must not run");
    };
    supabaseIngressVerifier.verify = async () => {
      throw new Error("mutated Supabase verifier must not run");
    };

    const timer = await app.inject({
      method: "POST",
      url: "/v1/triggers",
      headers: { authorization: `Bearer ${TIMER_TOKEN}` },
      payload: timerBody,
    });
    const chat = await app.inject({
      method: "POST",
      url: "/v1/triggers",
      headers: { authorization: `Bearer ${SUPABASE_TOKEN}` },
      payload: chatBody,
    });
    expect([timer.statusCode, chat.statusCode]).toEqual([202, 202]);
    expect({ workloadCalls, supabaseCalls, admitted }).toEqual({
      workloadCalls: 2,
      supabaseCalls: 1,
      admitted: 2,
    });
    await app.close();
  });

  it("snapshots verifier credentials before later request hooks can mutate them", async () => {
    const mutableTimerCredential = {
      claims: {
        ...timerCredential.claims,
        capability: [...timerCredential.claims.capability],
      },
      protectedHeader: { ...timerCredential.protectedHeader },
    } satisfies VerifiedWorkloadCredential;
    let admitted = 0;
    const app = buildTriggerProcessorApp(
      {
        logger: false,
        auth: {
          verifier: {
            async verify() {
              return mutableTimerCredential;
            },
          },
        },
      },
      withAttemptRecorder({
        async admit(_credential, command) {
          admitted += 1;
          return acceptedResponse((command as { trace_id: string }).trace_id);
        },
      }),
    );
    app.addHook("onRequest", async (request) => {
      if (request.routeOptions.url !== "/v1/triggers") return;
      mutableTimerCredential.claims.sub = "observation_gateway";
      mutableTimerCredential.claims.bot_id = "bot-attacker";
      mutableTimerCredential.claims.capability.splice(0);
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/triggers",
      headers: { authorization: `Bearer ${TIMER_TOKEN}` },
      payload: timerBody,
    });
    expect(response.statusCode).toBe(202);
    expect(admitted).toBe(1);
    await app.close();
  });

  it("rejects accessor-backed app options and verifier methods without invoking getters", () => {
    let optionGetterCalls = 0;
    const options = { logger: false } as Record<string, unknown>;
    Object.defineProperty(options, "supabaseIngressVerifier", {
      enumerable: true,
      get() {
        optionGetterCalls += 1;
        return { async verify() { return supabaseUserCredential; } };
      },
    });
    expect(() => buildTriggerProcessorApp(options as never)).toThrow(
      "Trigger Processor app options must contain only own data properties",
    );
    expect(optionGetterCalls).toBe(0);

    let verifierGetterCalls = 0;
    const verifier = {} as Record<string, unknown>;
    Object.defineProperty(verifier, "verify", {
      enumerable: true,
      get() {
        verifierGetterCalls += 1;
        return async () => timerCredential;
      },
    });
    expect(() =>
      buildTriggerProcessorApp({
        logger: false,
        auth: { verifier: verifier as never },
      }),
    ).toThrow("must expose verify as a data method");
    expect(verifierGetterCalls).toBe(0);
  });

  it("protects the sole documented route and returns 202 for a fresh acceptance", async () => {
    const requirements: unknown[] = [];
    const app = buildTriggerProcessorApp(
      {
        logger: false,
        auth: {
          verifier: {
            async verify(_token, value) {
              requirements.push(value);
              return timerCredential;
            },
          },
        },
      },
      withAttemptRecorder({
        async admit(_credential, command) {
          return acceptedResponse(
            (command as { readonly trace_id: string }).trace_id,
          );
        },
      }),
    );
    const response = await app.inject({
      method: "POST",
      url: "/v1/triggers",
      headers: { authorization: `Bearer ${TIMER_TOKEN}` },
      payload: timerBody,
    });
    expect(response.statusCode).toBe(202);
    expect(JSON.parse(response.payload)).toEqual(
      acceptedResponse(String(response.headers["x-trace-id"])),
    );
    expect(requirements).toEqual([
      expect.objectContaining({
        audience: "trigger_processor",
        requiredCapabilities: [],
      }),
    ]);

    const oldRoute = await app.inject({
      method: "POST",
      url: "/internal/v1/triggers/admit/chat",
      headers: { authorization: "Bearer aaa.bbb.ccc" },
      payload: timerBody,
    });
    expect(oldRoute.statusCode).not.toBe(200);
    await app.close();
  });

  it("separates Supabase public ingress from the exact Timer workload caller", async () => {
    let admitted = 0;
    const failures: TriggerPreAdmissionFailureV1[] = [];
    const app = buildTriggerProcessorApp(
      {
        logger: false,
        auth: {
          verifier: {
            async verify(token) {
              if (token === TIMER_TOKEN) return timerCredential;
              if (token === OBSERVATION_TOKEN) {
                return observationGatewayCredential;
              }
              throw new AuthError("unauthenticated", "not a workload JWT");
            },
          },
        },
        supabaseIngressVerifier: {
          async verify(token) {
            if (token === SUPABASE_TOKEN) return supabaseUserCredential;
            throw new AuthError("unauthenticated", "not a Supabase JWT");
          },
        },
      },
      withAttemptRecorder(
        {
          async admit(_credential, command) {
            admitted += 1;
            return acceptedResponse((command as { trace_id: string }).trace_id);
          },
        },
        failures,
      ),
    );

    for (const request of [
      { token: SUPABASE_TOKEN, body: chatBody },
      { token: SUPABASE_TOKEN, body: notificationBody },
      { token: TIMER_TOKEN, body: timerBody },
    ] as const) {
      const response = await app.inject({
        method: "POST",
        url: "/v1/triggers",
        headers: { authorization: `Bearer ${request.token}` },
        payload: request.body,
      });
      expect(response.statusCode).toBe(202);
    }

    const deniedCases = [
      {
        token: OBSERVATION_TOKEN,
        body: timerBody,
        code: "timer_source_caller_denied",
        permissionScope: "trigger.submit.timer",
      },
      {
        token: TIMER_TOKEN,
        body: chatBody,
        code: "bot_permission_denied",
        permissionScope: "trigger.submit.chat",
      },
      {
        token: OBSERVATION_TOKEN,
        body: notificationBody,
        code: "bot_permission_denied",
        permissionScope: "trigger.submit.notification",
      },
      {
        token: SUPABASE_TOKEN,
        body: timerBody,
        code: "timer_source_caller_denied",
        permissionScope: "trigger.submit.timer",
      },
    ] as const;
    for (const deniedCase of deniedCases) {
      const response = await app.inject({
        method: "POST",
        url: "/v1/triggers",
        headers: { authorization: `Bearer ${deniedCase.token}` },
        payload: deniedCase.body,
      });
      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.payload)).toMatchObject({
        code: deniedCase.code,
        details: {
          reason_code: deniedCase.code,
          permission_scope: deniedCase.permissionScope,
          submit_attempt_id: expect.any(String),
        },
      });
    }
    expect(admitted).toBe(3);
    expect(failures).toHaveLength(4);
    expect(failures[0]).toMatchObject({
      result_code: "timer_source_caller_denied",
      request_body: { source: "timer" },
      credential: {
        authentication_kind: "pai_workload_jwt",
        credential: { claims: { sub: "observation_gateway" } },
      },
    });
    expect(failures[1]).toMatchObject({
      result_code: "bot_permission_denied",
      request_body: { source: "chat" },
      credential: {
        authentication_kind: "pai_workload_jwt",
        credential: { claims: { sub: "timer_trigger_app" } },
      },
    });
    expect(failures[3]).toMatchObject({
      result_code: "timer_source_caller_denied",
      request_body: { source: "timer" },
      credential: { authentication_kind: "supabase_ingress" },
    });
    expect(failures.every(({ credential }) => credential !== undefined)).toBe(
      true,
    );
    await app.close();
  });

  it("authenticates malformed bodies before schema rejection", async () => {
    let workloadAttempts = 0;
    let supabaseAttempts = 0;
    const failures: TriggerPreAdmissionFailureV1[] = [];
    const app = buildTriggerProcessorApp(
      {
        logger: false,
        auth: {
          verifier: {
            async verify(token) {
              workloadAttempts += 1;
              if (token === TIMER_TOKEN) return timerCredential;
              throw new AuthError("unauthenticated", "not a workload JWT");
            },
          },
        },
        supabaseIngressVerifier: {
          async verify(token) {
            supabaseAttempts += 1;
            if (token === SUPABASE_TOKEN) return supabaseUserCredential;
            throw new AuthError("unauthenticated", "not a Supabase JWT");
          },
        },
      },
      withAttemptRecorder(
        {
          async admit(_credential, command) {
            return acceptedResponse((command as { trace_id: string }).trace_id);
          },
        },
        failures,
      ),
    );
    const unauthenticated = await app.inject({
      method: "POST",
      url: "/v1/triggers",
      payload: { source: "invented" },
    });
    expect(unauthenticated.statusCode).toBe(401);
    expect(workloadAttempts).toBe(0);
    expect(supabaseAttempts).toBe(0);

    const workloadAuthenticated = await app.inject({
      method: "POST",
      url: "/v1/triggers",
      headers: { authorization: `Bearer ${TIMER_TOKEN}` },
      payload: { source: "invented" },
    });
    expect(workloadAuthenticated.statusCode).toBe(400);

    const supabaseAuthenticated = await app.inject({
      method: "POST",
      url: "/v1/triggers",
      headers: { authorization: `Bearer ${SUPABASE_TOKEN}` },
      payload: { source: "invented" },
    });
    expect(supabaseAuthenticated.statusCode).toBe(400);
    expect(workloadAttempts).toBe(2);
    expect(supabaseAttempts).toBe(1);
    expect(failures.map(({ credential }) => credential)).toEqual([
      undefined,
      timerIngress,
      supabaseUserIngress,
    ]);
    await app.close();
  });

  it("maps authentication, scope and validation failures to the exact schemas", async () => {
    const failures: TriggerPreAdmissionFailureV1[] = [];
    const app = buildTriggerProcessorApp(
      {
        logger: false,
        auth: { verifier: { async verify() { return timerCredential; } } },
      },
      withAttemptRecorder(
        {
          async admit(_credential, command) {
            return acceptedResponse((command as { trace_id: string }).trace_id);
          },
        },
        failures,
      ),
    );
    const unauthenticated = await app.inject({
      method: "POST",
      url: "/v1/triggers",
      payload: timerBody,
    });
    expect(unauthenticated.statusCode).toBe(401);
    expect(JSON.parse(unauthenticated.payload)).toMatchObject({
      code: "unauthenticated",
      retryable: false,
      details: { submit_attempt_id: expect.any(String) },
    });

    const attackerBody = {
      ...timerBody,
      workspace_id: "workspace-attacker",
      payload: { ...timerBody.payload, workspace_id: "workspace-attacker" },
    };
    const denied = await app.inject({
      method: "POST",
      url: "/v1/triggers",
      headers: { authorization: "Bearer aaa.bbb.ccc" },
      payload: attackerBody,
    });
    expect(denied.statusCode).toBe(403);
    expect(JSON.parse(denied.payload)).toMatchObject({
      code: "timer_owner_binding_mismatch",
      details: {
        reason_code: "timer_owner_binding_mismatch",
        submit_attempt_id: expect.any(String),
      },
    });

    const invalid = await app.inject({
      method: "POST",
      url: "/v1/triggers",
      headers: { authorization: "Bearer aaa.bbb.ccc" },
      payload: { ...timerBody, payload: undefined },
    });
    expect(invalid.statusCode).toBe(400);
    expect(JSON.parse(invalid.payload)).toMatchObject({
      code: "invalid_request",
      retryable: false,
      details: {
        schema_version: "trigger_submit_request.v1",
        submit_attempt_id: expect.any(String),
      },
    });
    expect(failures).toHaveLength(3);
    expect(failures.map(({ result_code, outcome }) => ({ result_code, outcome }))).toEqual([
      { result_code: "unauthenticated", outcome: "identity_invalid" },
      {
        result_code: "timer_owner_binding_mismatch",
        outcome: "identity_invalid",
      },
      { result_code: "invalid_request", outcome: "schema_invalid" },
    ]);
    expect(failures[0]?.credential).toBeUndefined();
    expect(failures[1]?.credential).toEqual(timerIngress);
    expect(failures[2]?.credential).toEqual(timerIngress);
    await app.close();
  });

  it("audits Fastify body parser failures before returning canonical 400", async () => {
    const failures: TriggerPreAdmissionFailureV1[] = [];
    const app = buildTriggerProcessorApp(
      {
        logger: false,
        auth: { verifier: { async verify() { return timerCredential; } } },
      },
      withAttemptRecorder(
        {
          async admit(_credential, command) {
            return acceptedResponse((command as { trace_id: string }).trace_id);
          },
        },
        failures,
      ),
    );
    const cases = [
      {
        headers: {
          authorization: "Bearer aaa.bbb.ccc",
          "content-type": "application/json",
        },
        payload: "{",
      },
      {
        headers: {
          authorization: "Bearer aaa.bbb.ccc",
          "content-type": "application/json",
        },
        payload: "",
      },
      {
        headers: {
          authorization: "Bearer aaa.bbb.ccc",
          "content-type": "application/octet-stream",
        },
        payload: Buffer.from("unsupported"),
      },
      {
        headers: {
          authorization: "Bearer aaa.bbb.ccc",
          "content-type": "application/json",
        },
        payload: JSON.stringify({ value: "x".repeat(1_100_000) }),
      },
    ];
    for (const testCase of cases) {
      const response = await app.inject({
        method: "POST",
        url: "/v1/triggers",
        ...testCase,
      });
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload)).toMatchObject({
        code: "invalid_request",
        retryable: false,
        details: {
          schema_version: "trigger_submit_request.v1",
          submit_attempt_id: expect.any(String),
        },
      });
    }
    expect(failures).toHaveLength(cases.length);
    expect(failures.map(({ credential }) => credential)).toEqual(
      cases.map(() => timerIngress),
    );
    await app.close();
  });

  it("fails closed when the durable pre-admission audit cannot be written", async () => {
    const app = buildTriggerProcessorApp(
      {
        logger: false,
        auth: { verifier: { async verify() { return timerCredential; } } },
      },
      {
        async admit(_credential, command) {
          return acceptedResponse((command as { trace_id: string }).trace_id);
        },
        async recordPreAdmissionFailure() {
          throw new OwnerRepositoryTransientErrorV1(
            "transient_database_error",
            "audit store unavailable",
          );
        },
      },
    );
    const response = await app.inject({
      method: "POST",
      url: "/v1/triggers",
      payload: timerBody,
    });
    expect(response.statusCode).toBe(503);
    expect(JSON.parse(response.payload)).toMatchObject({
      code: "storage_unavailable",
      retryable: true,
      details: { submit_attempt_id: null },
    });
    await app.close();
  });

  it("uses 200 for duplicate replay and canonical 503/500 envelopes", async () => {
    const options = {
      logger: false as const,
      auth: { verifier: { async verify() { return timerCredential; } } },
    };
    const duplicateApp = buildTriggerProcessorApp(options, withAttemptRecorder({
      async admit(_credential, command) {
        return {
          code: "duplicate_replayed",
          message: "duplicate",
          retryable: false,
          details: {
            ...acceptedResponse("unused").details,
            duplicate_replayed: true,
          },
          trace_id: (command as { trace_id: string }).trace_id,
        };
      },
    }));
    const duplicate = await duplicateApp.inject({
      method: "POST",
      url: "/v1/triggers",
      headers: { authorization: "Bearer aaa.bbb.ccc" },
      payload: timerBody,
    });
    expect(duplicate.statusCode).toBe(200);
    expect(JSON.parse(duplicate.payload)).toMatchObject({
      code: "duplicate_replayed",
      details: { action: "dispatch", duplicate_replayed: true },
    });
    await duplicateApp.close();

    const transientApp = buildTriggerProcessorApp(options, withAttemptRecorder({
      async admit() {
        throw new OwnerRepositoryTransientErrorV1(
          "serialization_retry_exhausted",
          "retry",
        );
      },
    }));
    const transient = await transientApp.inject({
      method: "POST",
      url: "/v1/triggers",
      headers: { authorization: "Bearer aaa.bbb.ccc" },
      payload: timerBody,
    });
    expect(transient.statusCode).toBe(503);
    expect(JSON.parse(transient.payload)).toMatchObject({
      code: "storage_unavailable",
      retryable: true,
      details: { submit_attempt_id: null },
    });
    await transientApp.close();

    const invariantApp = buildTriggerProcessorApp(options, withAttemptRecorder({
      async admit() {
        throw new InvalidAdmitTriggerCommandError("bad writer", "server_invariant");
      },
    }));
    const invariant = await invariantApp.inject({
      method: "POST",
      url: "/v1/triggers",
      headers: { authorization: "Bearer aaa.bbb.ccc" },
      payload: timerBody,
    });
    expect(invariant.statusCode).toBe(500);
    expect(JSON.parse(invariant.payload)).toMatchObject({
      code: "internal_error",
      retryable: false,
      details: { schema_version: "trigger_submit_response.v1" },
    });
    await invariantApp.close();
  });

  it("exposes writer-owned 404 and 429 pre-admission outcomes", async () => {
    const options = {
      logger: false as const,
      auth: { verifier: { async verify() { return timerCredential; } } },
    };
    const cases = [
      {
        status: 404,
        response: {
          code: "bot_not_found" as const,
          message: "bot does not exist",
          retryable: false as const,
          details: { submit_attempt_id: "attempt-not-found" },
        },
      },
      {
        status: 429,
        response: {
          code: "rate_limited" as const,
          message: "weak queue is full",
          retryable: true as const,
          details: {
            retry_after_ms: 1_000,
            quota_key: "bot:bot-1",
            limit_window_ms: 60_000,
            submit_attempt_id: "attempt-1",
          },
        },
      },
    ];
    for (const testCase of cases) {
      const app = buildTriggerProcessorApp(options, withAttemptRecorder({
        async admit(_credential, command) {
          return {
            ...testCase.response,
            trace_id: (command as { trace_id: string }).trace_id,
          };
        },
      }));
      const response = await app.inject({
        method: "POST",
        url: "/v1/triggers",
        headers: { authorization: "Bearer aaa.bbb.ccc" },
        payload: timerBody,
      });
      expect(response.statusCode).toBe(testCase.status);
      expect(JSON.parse(response.payload)).toMatchObject(testCase.response);
      await app.close();
    }
  });

  it("keeps canonical route errors closed against caller mappers and malformed canonical JSON", async () => {
    const app = buildTriggerProcessorApp(
      {
        logger: false,
        errorMapper() {
          return new ServiceError({
            code: "caller_override",
            message: "must not escape the route contract",
            statusCode: 418,
            retryable: false,
          });
        },
        auth: { verifier: { async verify() { return timerCredential; } } },
      },
      createTriggerAdmissionApplicationV1(databaseCapturing([])),
    );
    const response = await app.inject({
      method: "POST",
      url: "/v1/triggers",
      headers: { authorization: "Bearer aaa.bbb.ccc" },
      payload: {
        ...timerBody,
        payload: { ...timerBody.payload, message: "\ud800" },
      },
    });
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.payload)).toMatchObject({
      code: "invalid_request",
      retryable: false,
      details: { schema_version: "trigger_submit_request.v1" },
    });
    await app.close();
  });
});
