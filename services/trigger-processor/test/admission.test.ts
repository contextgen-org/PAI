import type { VerifiedWorkloadCredential } from "@pai/auth";
import { TriggerAdmissionDecisionV1Schema } from "@pai/contracts";
import { OwnerRepositoryTransientErrorV1 } from "@pai/persistence";
import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  createTriggerAdmissionApplicationV1,
  InvalidAdmitTriggerCommandError,
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
                  return {
                    code: "trigger_accepted",
                    message: "accepted",
                    retryable: false,
                    details: { trigger_id: "trigger-1" },
                    trace_id:
                      (writerRequest.arguments as Record<string, unknown>)
                        .p_trace_id,
                  };
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
      idempotency_key: "submit-1",
      trace_id: "trace-1",
      is_catch_up: false,
      explicit_interrupt: false,
    } as const;
    await expect(
      application.admit(credential, command),
    ).resolves.toMatchObject({
      code: "trigger_accepted",
      trace_id: "trace-1",
    });
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
        p_request_hash: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
        p_actor: { actor_type: "user", actor_id: "user-1" },
        p_admission_request: {
          is_catch_up: false,
          explicit_interrupt: false,
          requested_explicit_interrupt: false,
        },
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
    await expect(
      application.admit(credential, {
        ...command,
        explicit_interrupt: true,
      }),
    ).rejects.toMatchObject({ kind: "capability_denied" });
    const developerCredential = {
      ...credential,
      claims: {
        ...credential.claims,
        delegated_principal: {
          ...credential.claims.delegated_principal,
          principal_type: "developer",
          principal_id: "developer-1",
          roles: ["developer"],
          source_subject: "developer-1",
        },
        capability: ["trigger.submit.chat", "trigger.interrupt"],
      },
    } as const satisfies VerifiedWorkloadCredential;
    await expect(
      application.admit(developerCredential, {
        ...command,
        explicit_interrupt: true,
      }),
    ).rejects.toMatchObject({ kind: "authorization_denied" });
    const notificationCommandWithoutHash = {
      ...command,
      source: "notification",
    } as const;
    const notificationCredential = {
      ...credential,
      claims: {
        ...credential.claims,
        capability: ["trigger.submit.notification"],
      },
    } as const satisfies VerifiedWorkloadCredential;
    await expect(
      application.admit(notificationCredential, {
        ...notificationCommandWithoutHash,
        explicit_interrupt: true,
      }),
    ).rejects.toMatchObject({ kind: "capability_denied" });

    const superUserCredential = {
      ...credential,
      claims: {
        ...credential.claims,
        capability: ["trigger.submit.chat", "trigger.interrupt"],
        delegated_principal: {
          ...credential.claims.delegated_principal,
          roles: ["super_user"],
        },
      },
    } as const satisfies VerifiedWorkloadCredential;
    await expect(
      application.admit(superUserCredential, {
        ...command,
        explicit_interrupt: true,
      }),
    ).resolves.toMatchObject({ code: "trigger_accepted" });
    expect(calls.at(-1)?.writer).toMatchObject({
      arguments: expect.objectContaining({
        p_admission_request: {
          is_catch_up: false,
          explicit_interrupt: true,
          requested_explicit_interrupt: true,
        },
      }),
    });
    const firstUnicodeCommand = {
      ...command,
      trigger_id: "trigger-unicode",
      process_id: "process-unicode",
      idempotency_key: "submit-unicode",
      payload: { "é": 1, a: 2, "😀": 3 },
    } as const;
    const secondUnicodeCommand = {
      ...firstUnicodeCommand,
      payload: { "😀": 3, a: 2, "é": 1 },
    } as const;
    await application.admit(credential, firstUnicodeCommand);
    const firstUnicodeHash = (
      calls.at(-1)?.writer as { readonly arguments?: Record<string, unknown> }
    )?.arguments?.p_request_hash;
    await application.admit(credential, secondUnicodeCommand);
    const secondUnicodeHash = (
      calls.at(-1)?.writer as { readonly arguments?: Record<string, unknown> }
    )?.arguments?.p_request_hash;
    expect(firstUnicodeHash).toBe(secondUnicodeHash);

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
    const { source: _source, trace_id: _traceId, ...routeBody } = command;
    const routed = await routedApp.inject({
      method: "POST",
      url: "/internal/v1/triggers/admit/chat",
      headers: { authorization: "Bearer aaa.bbb.ccc" },
      payload: routeBody,
    });
    expect(routed.statusCode).toBe(200);
    expect(JSON.parse(routed.payload)).toMatchObject({
      code: "trigger_accepted",
      trace_id: routed.headers["x-trace-id"],
    });
    expect(calls.at(-1)?.writer).toMatchObject({
      arguments: expect.objectContaining({
        p_trace_id: routed.headers["x-trace-id"],
      }),
    });
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
    expect(JSON.parse(deniedScope.payload)).toMatchObject({
      code: "authorization_scope_mismatch",
    });
    const interruptWithoutCapability = await routedApp.inject({
      method: "POST",
      url: "/internal/v1/triggers/admit/chat",
      headers: { authorization: "Bearer aaa.bbb.ccc" },
      payload: {
        ...routeBody,
        explicit_interrupt: true,
      },
    });
    expect(interruptWithoutCapability.statusCode).toBe(403);
    expect(JSON.parse(interruptWithoutCapability.payload)).toMatchObject({
      code: "capability_denied",
    });
    const deniedRoleApp = buildTriggerProcessorApp(
      {
        logger: false,
        auth: {
          verifier: {
            async verify() {
              return developerCredential;
            },
          },
        },
      },
      application,
    );
    const interruptWithoutRole = await deniedRoleApp.inject({
      method: "POST",
      url: "/internal/v1/triggers/admit/chat",
      headers: { authorization: "Bearer aaa.bbb.ccc" },
      payload: {
        ...routeBody,
        explicit_interrupt: true,
      },
    });
    expect(interruptWithoutRole.statusCode).toBe(403);
    expect(JSON.parse(interruptWithoutRole.payload)).toMatchObject({
      code: "authorization_denied",
    });
    await deniedRoleApp.close();
    const invalidBody = await routedApp.inject({
      method: "POST",
      url: "/internal/v1/triggers/admit/chat",
      headers: { authorization: "Bearer aaa.bbb.ccc" },
      payload: {
        ...routeBody,
        payload: undefined,
      },
    });
    expect(invalidBody.statusCode).toBe(400);
    expect(JSON.parse(invalidBody.payload)).toMatchObject({
      code: "invalid_request",
      trace_id: invalidBody.headers["x-trace-id"],
    });
    await routedApp.close();

    const transientApp = buildTriggerProcessorApp(
      {
        logger: false,
        auth: {
          verifier: {
            async verify() {
              return credential;
            },
          },
        },
      },
      {
        async admit() {
          throw new OwnerRepositoryTransientErrorV1(
            "serialization_retry_exhausted",
            "owner unit of work exhausted serialization retries for admit_trigger",
          );
        },
      },
    );
    const transient = await transientApp.inject({
      method: "POST",
      url: "/internal/v1/triggers/admit/chat",
      headers: { authorization: "Bearer aaa.bbb.ccc" },
      payload: routeBody,
    });
    expect(transient.statusCode).toBe(503);
    expect(JSON.parse(transient.payload)).toMatchObject({
      code: "serialization_retry_exhausted",
      retryable: true,
    });
    await transientApp.close();

    const conflictApp = buildTriggerProcessorApp(
      {
        logger: false,
        auth: {
          verifier: {
            async verify() {
              return credential;
            },
          },
        },
      },
      {
        async admit(_credential, commandValue) {
          return {
            code: "idempotency_conflict",
            message: "admission idempotency key has a different request",
            retryable: false,
            details: {},
            trace_id: (commandValue as { readonly trace_id: string }).trace_id,
          };
        },
      },
    );
    const conflict = await conflictApp.inject({
      method: "POST",
      url: "/internal/v1/triggers/admit/chat",
      headers: { authorization: "Bearer aaa.bbb.ccc" },
      payload: routeBody,
    });
    expect(conflict.statusCode).toBe(409);
    expect(JSON.parse(conflict.payload)).toMatchObject({
      code: "idempotency_conflict",
      retryable: false,
    });
    await conflictApp.close();

    const invalidWriterDatabase = {
      repository: {},
      deployment: {},
      unit_of_work: {
        owner_service: "trigger_processor",
        async withTransaction(_request: Record<string, unknown>, work: Function) {
          return work(
            { owner_service: "trigger_processor", transaction_id: "tx-invalid" },
            {
              owner: {
                async executeWriter() {
                  return {
                    code: "future_uncontracted_code",
                    message: "invalid",
                    retryable: false,
                    details: {},
                    trace_id: "trace-invalid",
                  };
                },
              },
            },
          );
        },
      },
    } as unknown as TriggerProcessorOwnerDatabaseV1;
    const invalidWriterApplication =
      createTriggerAdmissionApplicationV1(invalidWriterDatabase);
    await expect(
      invalidWriterApplication.admit(credential, command),
    ).rejects.toMatchObject({
      kind: "server_invariant",
      message: "admit_trigger_v1 returned a non-canonical response",
    } satisfies Partial<InvalidAdmitTriggerCommandError>);

    const invariantApp = buildTriggerProcessorApp(
      {
        logger: false,
        auth: {
          verifier: {
            async verify() {
              return credential;
            },
          },
        },
      },
      invalidWriterApplication,
    );
    const invariant = await invariantApp.inject({
      method: "POST",
      url: "/internal/v1/triggers/admit/chat",
      headers: { authorization: "Bearer aaa.bbb.ccc" },
      payload: routeBody,
    });
    expect(invariant.statusCode).toBe(500);
    expect(JSON.parse(invariant.payload)).toMatchObject({
      code: "internal_error",
      retryable: false,
    });
    await invariantApp.close();

    for (const invalidWriterResponse of [
      {
        code: "trigger_accepted",
        message: "accepted",
        retryable: true,
        details: {},
        trace_id: "trace-invalid",
      },
      {
        code: "authorization_denied",
        message: "writer must not make route authorization decisions",
        retryable: false,
        details: {},
        trace_id: "trace-invalid",
      },
      {
        code: "serialization_retry_exhausted",
        message: "retryable failures must be marked retryable",
        retryable: false,
        details: {},
        trace_id: "trace-invalid",
      },
    ]) {
      const invalidResponseDatabase = {
        repository: {},
        deployment: {},
        unit_of_work: {
          owner_service: "trigger_processor",
          async withTransaction(
            _request: Record<string, unknown>,
            work: Function,
          ) {
            return work(
              {
                owner_service: "trigger_processor",
                transaction_id: "tx-invalid-response",
              },
              {
                owner: {
                  async executeWriter() {
                    return invalidWriterResponse;
                  },
                },
              },
            );
          },
        },
      } as unknown as TriggerProcessorOwnerDatabaseV1;
      await expect(
        createTriggerAdmissionApplicationV1(invalidResponseDatabase).admit(
          credential,
          command,
        ),
      ).rejects.toMatchObject({ kind: "server_invariant" });
    }
  });
});
