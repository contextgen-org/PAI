import type { VerifiedWorkloadCredential } from "@pai/auth";
import { TriggerAdmissionDecisionV1Schema } from "@pai/contracts";
import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  createTriggerAdmissionApplicationV1,
  type TriggerProcessorOwnerDatabaseV1,
} from "../src/application/trigger-admission.v1.js";
import { buildTriggerProcessorApp } from "../src/app.js";
import {
  assertTriggerAdmissionCommitPreconditionV1,
  calculateTriggerPriorityV1,
  decideTriggerAdmissionV1,
} from "../src/domain/admission.js";

const base = {
  source: "chat" as const,
  actor_type: "user" as const,
  bot_state: "active" as const,
  safety_blocked: false,
  active_process: "none" as const,
  active_process_id: null,
  active_process_slot_generation: null,
  active_process_updated_at: null,
  trusted_strong_hint: false,
  explicit_interrupt: false,
  is_catch_up: false,
  foreground_slot_process_id: null,
  foreground_slot_generation: 7,
};

describe("Trigger admission", () => {
  it("calculates priority from source and actor instead of accepting caller priority", () => {
    expect(calculateTriggerPriorityV1(base)).toBe("weak");
    expect(
      calculateTriggerPriorityV1({
        ...base,
        actor_type: "super_user",
      }),
    ).toBe("strong");
    expect(
      calculateTriggerPriorityV1({
        ...base,
        source: "timer",
        actor_type: "system",
      }),
    ).toBe("strong");
  });

  it("dispatches a weak trigger without promoting it when no process is active", () => {
    expect(decideTriggerAdmissionV1(base)).toMatchObject({
      trigger_status: "accepted",
      priority: "weak",
      action: "dispatch",
      reason_code: "weak_no_active_dispatch",
      initial_process_state: { phase: "admission", status: "running" },
    });
  });

  it("queues ordinary weak work behind an active runtime", () => {
    expect(
      decideTriggerAdmissionV1({
        ...base,
        active_process: "execution_running",
        active_process_id: "process-active",
        active_process_slot_generation: 7,
        active_process_updated_at: "2026-07-20T08:00:00.000Z",
        foreground_slot_process_id: "process-active",
      }),
    ).toMatchObject({
      priority: "weak",
      action: "enqueue_weak",
      reason_code: "active_process_running",
      initial_process_state: {
        phase: "admission",
        status: "waiting",
        wait_reason: "weak_queue",
      },
    });
  });

  it("does not mislabel a trusted strong hint as an explicit interrupt", () => {
    expect(
      decideTriggerAdmissionV1({
        ...base,
        trusted_strong_hint: true,
      }),
    ).toMatchObject({
      priority: "strong",
      action: "dispatch",
      reason_code: "strong_no_active_dispatch",
    });
  });

  it("serializes timer catch-up without preempting an occupied foreground slot", () => {
    expect(
      decideTriggerAdmissionV1({
        ...base,
        source: "timer",
        actor_type: "system",
        is_catch_up: true,
        active_process: "execution_running",
        active_process_id: "process-active",
        active_process_slot_generation: 7,
        active_process_updated_at: "2026-07-20T08:00:00.000Z",
        foreground_slot_process_id: "process-active",
      }),
    ).toMatchObject({
      trigger_status: "accepted",
      priority: "strong",
      action: "enqueue_strong_fifo",
      reason_code: "catch_up_foreground_busy",
      initial_process_state: {
        phase: "admission",
        status: "waiting",
        wait_reason: "deferred_strong_queue",
      },
    });
  });

  it("rejects admission facts with torn process identity or slot generation", () => {
    expect(() =>
      decideTriggerAdmissionV1({
        ...base,
        source: "timer",
        actor_type: "system",
        foreground_slot_process_id: "process-raced-in",
      }),
    ).toThrow(/TrustedAdmissionFactsV1|identity and foreground slot generation/);

    expect(() =>
      decideTriggerAdmissionV1({
        ...base,
        source: "timer",
        actor_type: "system",
        is_catch_up: true,
        active_process: "execution_running",
        active_process_id: "process-a",
        active_process_slot_generation: 6,
        active_process_updated_at: "2026-07-20T08:00:00.000Z",
        foreground_slot_process_id: "process-a",
      }),
    ).toThrow(/TrustedAdmissionFactsV1|identity and foreground slot generation/);

    expect(() =>
      decideTriggerAdmissionV1({
        ...base,
        active_process: "execution_running",
        active_process_id: "process-a",
        active_process_slot_generation: 7,
        active_process_updated_at: "2026-07-20T08:00:00.000Z",
        foreground_slot_process_id: "process-b",
      }),
    ).toThrow(/TrustedAdmissionFactsV1|identity and foreground slot generation/);
  });

  it("rejects empty process identities and invalid process timestamps", () => {
    expect(() =>
      decideTriggerAdmissionV1({
        ...base,
        active_process: "execution_running",
        active_process_id: "",
        active_process_slot_generation: 7,
        active_process_updated_at: "2026-07-20T08:00:00.000Z",
        foreground_slot_process_id: "",
      }),
    ).toThrow(/TrustedAdmissionFactsV1|identity and foreground slot generation/);
    expect(() =>
      decideTriggerAdmissionV1({
        ...base,
        active_process: "cooldown_waiting",
        active_process_id: "process-a",
        active_process_slot_generation: 7,
        active_process_updated_at: "not-a-timestamp",
        foreground_slot_process_id: "process-a",
      }),
    ).toThrow(/TrustedAdmissionFactsV1|identity and foreground slot generation/);
  });

  it("rejects unknown and malformed fact discriminants before domain access", () => {
    expect(() =>
      decideTriggerAdmissionV1({
        ...base,
        active_process: "cooldown_typo",
      } as never),
    ).toThrow("TrustedAdmissionFactsV1");
    expect(() => decideTriggerAdmissionV1(null as never)).toThrow(
      "TrustedAdmissionFactsV1",
    );
    expect(() =>
      decideTriggerAdmissionV1({ ...base, caller_priority: "strong" } as never),
    ).toThrow("TrustedAdmissionFactsV1");
  });

  it("produces TypeBox-valid decisions for every foreground discriminant", () => {
    const facts = [
      base,
      {
        ...base,
        active_process: "execution_running" as const,
        active_process_id: "process-running",
        active_process_slot_generation: 7,
        active_process_updated_at: "2026-07-20T08:00:00.000Z",
        foreground_slot_process_id: "process-running",
      },
      {
        ...base,
        active_process: "cooldown_waiting" as const,
        active_process_id: "process-cooldown",
        active_process_slot_generation: 7,
        active_process_updated_at: "2026-07-20T08:00:00.000Z",
        foreground_slot_process_id: "process-cooldown",
      },
    ];
    for (const item of facts) {
      expect(
        Value.Check(
          TriggerAdmissionDecisionV1Schema,
          decideTriggerAdmissionV1(item),
        ),
      ).toBe(true);
    }
  });

  it("returns the exact slot CAS precondition consumed by admit_trigger_v1", () => {
    expect(decideTriggerAdmissionV1(base)).toMatchObject({
      admission_precondition: {
        kind: "idle",
        process_id: null,
        slot_generation: 7,
      },
    });
    expect(
      decideTriggerAdmissionV1({
        ...base,
        active_process: "cooldown_waiting",
        active_process_id: "process-active",
        active_process_slot_generation: 7,
        active_process_updated_at: "2026-07-20T08:00:00.000Z",
        foreground_slot_process_id: "process-active",
      }),
    ).toMatchObject({
      admission_precondition: {
        kind: "occupied",
        process_id: "process-active",
        slot_generation: 7,
        phase: "cooldown",
        status: "waiting",
        process_updated_at: "2026-07-20T08:00:00.000Z",
      },
    });
  });

  it("rejects commit when a concurrent slot transfer wins after the decision", () => {
    const decision = decideTriggerAdmissionV1(base);
    if (decision.trigger_status !== "accepted") throw new Error("expected accepted");
    expect(() =>
      assertTriggerAdmissionCommitPreconditionV1(decision, {
        process_id: "process-b",
        generation: 8,
      }, null),
    ).toThrow("changed before atomic trigger admission commit");
    expect(() =>
      assertTriggerAdmissionCommitPreconditionV1(decision, {
        process_id: null,
        generation: 7,
      }, null),
    ).not.toThrow();
  });

  it("rejects a same-slot decision after the active process phase changes", () => {
    const decision = decideTriggerAdmissionV1({
      ...base,
      active_process: "execution_running",
      active_process_id: "process-a",
      active_process_slot_generation: 7,
      active_process_updated_at: "2026-07-20T08:00:00.000Z",
      foreground_slot_process_id: "process-a",
    });
    if (decision.trigger_status !== "accepted") throw new Error("expected accepted");
    expect(() =>
      assertTriggerAdmissionCommitPreconditionV1(
        decision,
        { process_id: "process-a", generation: 7 },
        {
          process_id: "process-a",
          phase: "cooldown",
          status: "waiting",
          updated_at: "2026-07-20T08:00:01.000Z",
        },
      ),
    ).toThrow("changed before atomic trigger admission commit");
  });

  it("compares occupied process state semantically, independent of property insertion order", () => {
    const decision = decideTriggerAdmissionV1({
      ...base,
      active_process: "execution_running",
      active_process_id: "process-a",
      active_process_slot_generation: 7,
      active_process_updated_at: "2026-07-20T08:00:00.000Z",
      foreground_slot_process_id: "process-a",
    });
    if (decision.trigger_status !== "accepted") throw new Error("expected accepted");
    const currentProcess = {
      updated_at: "2026-07-20T08:00:00.000Z",
      status: "running" as const,
      phase: "execution" as const,
      process_id: "process-a",
    };
    expect(() =>
      assertTriggerAdmissionCommitPreconditionV1(
        decision,
        { process_id: "process-a", generation: 7 },
        currentProcess,
      ),
    ).not.toThrow();
  });

  it("rejects an inactive bot without producing a process state", () => {
    const decision = decideTriggerAdmissionV1({
      ...base,
      bot_state: "disabled",
    });
    expect(decision).toEqual({
      trigger_status: "rejected",
      priority: "weak",
      action: "reject",
      reason_code: "bot_disabled",
    });
    expect("initial_process_state" in decision).toBe(false);
  });

  it("executes admission through the injected serializable owner transaction", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const database = {
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
                async executeWriter(_transaction: unknown, writerRequest: Record<string, unknown>) {
                  calls.push({ writer: writerRequest });
                  return { persisted: true };
                },
              },
            },
          );
        },
      },
    } as unknown as TriggerProcessorOwnerDatabaseV1;
    const application = createTriggerAdmissionApplicationV1(database);
    const credential = {
      claims: {
        iss: "pai-workload",
        sub: "observation_gateway",
        aud: "trigger_processor",
        jti: "credential-1",
        iat: 100,
        nbf: 100,
        exp: 200,
        capability: ["trigger.submit.chat"],
        scope_kind: "bot",
        workspace_id: "workspace-1",
        bot_id: "bot-1",
        owner_agent_id: "agent-1",
        deployment_environment: "dev",
        release_channel: "stable",
        delegated_principal: {
          principal_type: "user",
          principal_id: "user-1",
          roles: ["user"],
          source_issuer: "supabase",
          source_subject: "user-1",
          auth_time: 100,
          scope_kind: "bot",
          workspace_id: "workspace-1",
          bot_id: "bot-1",
          owner_agent_id: "agent-1",
          deployment_environment: "dev",
          release_channel: "stable",
        },
      },
      protectedHeader: { alg: "EdDSA", kid: "workload-key-1", typ: "JWT" },
    } as const satisfies VerifiedWorkloadCredential;
    const command = {
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
      source: "chat",
      payload: { text: "hello" },
      dedupe_key: "dedupe-1",
      request_hash: "request-hash-1",
      idempotency_key: "submit-1",
      trace_id: "trace-1",
      is_catch_up: false,
      explicit_interrupt: false,
    } as const;
    await expect(
      application.admit(credential, command),
    ).resolves.toEqual({ persisted: true });
    expect(calls[0]?.transaction).toMatchObject({
      operation: "admit_trigger",
      isolation: "serializable",
      retry: "serialization_failures",
    });
    expect(calls[1]?.writer).toMatchObject({
      writer: "admit_trigger_v1",
      expected_rows: 1,
      arguments: expect.objectContaining({
        p_trigger_id: "trigger-1",
        p_process_id: "process-1",
        p_actor: { actor_type: "user", actor_id: "user-1" },
        p_authenticated_context: {
          workload_subject: "observation_gateway",
          credential_jti: "credential-1",
          credential_kid: "workload-key-1",
          capability: "trigger.submit.chat",
          delegated_principal: credential.claims.delegated_principal,
        },
      }),
    });

    await expect(
      application.admit(credential, {
        ...command,
        scope: { ...command.scope, workspace_id: "workspace-attacker" },
      }),
    ).rejects.toThrow("complete bot scope");
    await expect(
      application.admit(credential, { ...command, source: "timer" }),
    ).rejects.toThrow(/trigger.submit.timer|timer_trigger_app/);
    await expect(
      application.admit(credential, { ...command, actor: { actor_id: "attacker" } }),
    ).rejects.toThrow("AdmitTriggerCommandV1");

    const app = buildTriggerProcessorApp({ logger: false }, application);
    expect(app.hasDecorator("ownerDatabase")).toBe(false);
    expect(app.hasDecorator("triggerAdmission")).toBe(true);
    await app.close();

    const verificationRequirements: unknown[] = [];
    const routedApp = buildTriggerProcessorApp(
      {
        logger: false,
        auth: {
          verifier: {
            async verify(_token, requirements) {
              verificationRequirements.push(requirements);
              return credential;
            },
          },
        },
      },
      application,
    );
    const { source: _source, ...routeBody } = command;
    const routed = await routedApp.inject({
      method: "POST",
      url: "/internal/v1/triggers/admit/chat",
      headers: { authorization: "Bearer aaa.bbb.ccc" },
      payload: routeBody,
    });
    expect(routed.statusCode).toBe(200);
    expect(verificationRequirements).toEqual([
      expect.objectContaining({
        audience: "trigger_processor",
        requiredCapabilities: ["trigger.submit.chat"],
        allowedCallers: ["observation_gateway"],
      }),
    ]);
    const deniedScope = await routedApp.inject({
      method: "POST",
      url: "/internal/v1/triggers/admit/chat",
      headers: { authorization: "Bearer aaa.bbb.ccc" },
      payload: {
        ...routeBody,
        scope: { ...routeBody.scope, workspace_id: "workspace-attacker" },
      },
    });
    expect(deniedScope.statusCode).toBe(403);
    await routedApp.close();
  });
});
