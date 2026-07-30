import { describe, expect, it } from "vitest";

import {
  buildMetaCognitionApp,
  InMemoryMetaOwnerOperationsV1,
  META_COMMAND_CLAIM_ROUTE_V1,
  META_COMMAND_SETTLE_ROUTE_V1,
  META_FEEDBACK_ANSWER_ROUTE_V1,
  META_JOB_CREATE_ROUTE_V1,
} from "../src/index.js";
import { createHarness, createRequest } from "./fixtures.js";

const token = "aaa.bbb.ccc";

function verifier(
  capabilities: readonly string[] = ["meta.job.create"],
  caller = "trigger_processor",
) {
  return {
    async verify(_token: string, requirements: unknown) {
      expect(requirements).toEqual({
        audience: "meta_cognition",
        allowedCallers: ["trigger_processor"],
        requiredCapabilities: ["meta.job.create"],
      });
      return {
        claims: {
          iss: "pai-workload",
          sub: caller,
          aud: "meta_cognition",
          jti: "credential-1",
          iat: 100,
          nbf: 100,
          exp: 200,
          capability: [...capabilities],
          scope_kind: "bot",
          workspace_id: "workspace-1",
          bot_id: "bot-1",
          owner_agent_id: "agent-1",
          deployment_environment: "dev",
          release_channel: "stable",
        },
        protectedHeader: { alg: "EdDSA", kid: "key-1", typ: "JWT" },
      };
    },
  };
}

describe("Meta Cognition application routes", () => {
  it("rejects strict schema drift before invoking the Meta owner handler", async () => {
    let handlerCalls = 0;
    const app = buildMetaCognitionApp(
      {
        logger: false,
        auth: { verifier: verifier() as never },
      },
      {
        async createJob() {
          handlerCalls += 1;
          throw new Error("must not execute");
        },
      } as never,
    );
    const response = await app.inject({
      method: "POST",
      url: META_JOB_CREATE_ROUTE_V1,
      headers: { authorization: `Bearer ${token}` },
      payload: { ...createRequest(), unexpected: true },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: "invalid_request",
      retryable: false,
    });
    expect(handlerCalls).toBe(0);
    await app.close();
  });

  it("binds feedback answer path/body and authoritative owner scope", async () => {
    const operations = new InMemoryMetaOwnerOperationsV1({
      now: () => new Date("2026-07-23T00:00:00.000Z"),
    });
    operations.seedFeedbackRequest({
      schema_version: "feedback_request.v1",
      feedback_request_id: "feedback-1",
      workspace_id: "workspace-1",
      bot_id: "bot-1",
      owner_agent_id: "agent-1",
      deployment_environment: "dev",
      release_channel: "stable",
      source_kind: "meta_job",
      meta_job_id: "job-1",
      trigger_process_id: "process-1",
      dedupe_scope_ref: {
        kind: "candidate",
        ref: "candidate:feedback-1",
      },
      question_key: "question-1",
      question_payload_ref: "question-payload-1",
      question_payload_hash: `sha256:${"1".repeat(64)}`,
      status: "open",
      delivery_mode: "internal_queue",
      target_actor_ref: "operator-1",
      target_binding_ref: null,
      delivery_channel: null,
      delivery_status: "not_applicable",
      delivery_version: 1,
      created_at: "2026-07-23T00:00:00.000Z",
      updated_at: "2026-07-23T00:00:00.000Z",
      expires_at: "2026-07-23T01:00:00.000Z",
      answered_by_trigger_id: null,
      answer_payload: null,
    });
    const app = buildMetaCognitionApp(
      {
        logger: false,
        auth: {
          verifier: {
            async verify(_token: string, requirements: unknown) {
              expect(requirements).toEqual({
                audience: "meta_cognition",
                allowedCallers: ["trigger_processor"],
                requiredCapabilities: ["meta.feedback.answer"],
              });
              return {
                claims: {
                  iss: "pai-workload",
                  sub: "trigger_processor",
                  aud: "meta_cognition",
                  jti: "credential-1",
                  iat: 100,
                  nbf: 100,
                  exp: 200,
                  capability: ["meta.feedback.answer"],
                  scope_kind: "bot",
                  workspace_id: "workspace-1",
                  bot_id: "bot-1",
                  owner_agent_id: "agent-1",
                  deployment_environment: "dev",
                  release_channel: "stable",
                },
                protectedHeader: {
                  alg: "EdDSA",
                  kid: "key-1",
                  typ: "JWT",
                },
              };
            },
          } as never,
        },
      },
      undefined,
      {},
      undefined,
      operations,
    );
    const body = {
      schema_version: "meta_feedback_answer.v1",
      feedback_request_id: "feedback-1",
      trigger_id: "trigger-2",
      bot_id: "bot-1",
      answer_payload: { answer: "yes" },
      trace_id: "trace-answer",
    };
    const mismatch = await app.inject({
      method: "POST",
      url: META_FEEDBACK_ANSWER_ROUTE_V1.replace(
        ":id",
        "other-feedback",
      ),
      headers: { authorization: `Bearer ${token}` },
      payload: body,
    });
    expect(mismatch.statusCode).toBe(400);
    const answered = await app.inject({
      method: "POST",
      url: META_FEEDBACK_ANSWER_ROUTE_V1.replace(":id", "feedback-1"),
      headers: { authorization: `Bearer ${token}` },
      payload: body,
    });
    expect(answered.statusCode).toBe(200);
    expect(answered.json()).toMatchObject({
      status: "answered",
      answered_by_trigger_id: "trigger-2",
    });
    await app.close();
  });

  it("settles a durable worker lease after workload JWT renewal", async () => {
    const now = Math.floor(Date.now() / 1_000);
    let jti = "meta-worker-token-1";
    let claimedPrincipalId: string | undefined;
    const operations = {
      async checkReadiness() {},
      async claimCommands(
        principal: Readonly<{ principal_id: string }>,
        request: unknown,
      ) {
        const workerId = (request as Readonly<{ worker_id: string }>).worker_id;
        if (workerId !== principal.principal_id) {
          throw new Error("worker identity mismatch");
        }
        claimedPrincipalId = principal.principal_id;
        return [];
      },
      async settleCommand(
        principal: Readonly<{ principal_id: string }>,
        commandId: string,
        request: unknown,
      ) {
        const workerId = (request as Readonly<{ worker_id: string }>).worker_id;
        if (
          workerId !== principal.principal_id ||
          principal.principal_id !== claimedPrincipalId
        ) {
          throw new Error("worker lease owner changed");
        }
        return {
          command_id: commandId,
          status: "retry_wait" as const,
          duplicate_replayed: false,
          result_status: "partial_pending" as const,
          result_version: 1,
        };
      },
    };
    const app = buildMetaCognitionApp(
      {
        logger: false,
        auth: {
          verifier: {
            async verify() {
              return {
                claims: {
                  iss: "pai-workload",
                  sub: "meta_cognition",
                  aud: "meta_cognition",
                  jti,
                  iat: now,
                  nbf: now,
                  exp: now + 60,
                  capability: ["meta.command.dispatch"],
                  scope_kind: "bot",
                  workspace_id: "workspace-1",
                  bot_id: "bot-1",
                  owner_agent_id: "agent-1",
                  deployment_environment: "dev",
                  release_channel: "stable",
                },
                protectedHeader: {
                  alg: "EdDSA",
                  kid: "key-1",
                  typ: "JWT",
                },
              };
            },
          },
        },
      },
      undefined,
      {},
      undefined,
      operations as never,
    );
    const claim = await app.inject({
      method: "POST",
      url: META_COMMAND_CLAIM_ROUTE_V1,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        worker_id: "meta_cognition",
        limit: 1,
        lease_seconds: 600,
        trace_id: "trace-claim",
      },
    });
    expect(claim.statusCode).toBe(200);

    jti = "meta-worker-token-2";
    const settlement = await app.inject({
      method: "POST",
      url: META_COMMAND_SETTLE_ROUTE_V1.replace(":id", "command-1"),
      headers: { authorization: `Bearer ${token}` },
      payload: {
        worker_id: "meta_cognition",
        lease_generation: 1,
        settlement_id: "command-1:retry:1",
        outcome: "retry_wait",
        result_ref: null,
        error_code: "dependency_unavailable",
        next_retry_at: "2026-07-28T00:00:00.000Z",
        trace_id: "trace-settle",
      },
    });
    expect(settlement.statusCode).toBe(200);
    expect(settlement.json()).toMatchObject({
      command_id: "command-1",
      status: "retry_wait",
    });
    await app.close();
  });

  it("fails complete-pipeline readiness closed when dependencies are absent", async () => {
    const app = buildMetaCognitionApp(
      { logger: false },
      undefined,
      { require_complete_pipeline: true },
    );
    const response = await app.inject({ method: "GET", url: "/ready" });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      status: "not_ready",
      checks: [
        { name: "meta_pipeline", status: "down" },
        { name: "meta_query", status: "down" },
        { name: "meta_owner_operations", status: "down" },
      ],
    });
    await app.close();
  });

  it("requires the durable job pipeline without pretending query or operator APIs are composed", async () => {
    const app = buildMetaCognitionApp(
      { logger: false },
      undefined,
      { require_job_pipeline: true },
    );
    const response = await app.inject({ method: "GET", url: "/ready" });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      status: "not_ready",
      checks: [{ name: "meta_pipeline", status: "down" }],
    });
    expect(response.json().checks).toHaveLength(1);
    await app.close();
  });

  it("protects POST /internal/meta/jobs with exact caller/capability/scope", async () => {
    const harness = createHarness();
    const app = buildMetaCognitionApp(
      {
        logger: false,
        auth: { verifier: verifier() as never },
      },
      harness.application,
    );
    const ready = await app.inject({ method: "GET", url: "/ready" });
    expect(ready.statusCode).toBe(200);

    const unauthenticated = await app.inject({
      method: "POST",
      url: META_JOB_CREATE_ROUTE_V1,
      payload: createRequest(),
    });
    expect(unauthenticated.statusCode).toBe(401);

    const malformed = await app.inject({
      method: "POST",
      url: META_JOB_CREATE_ROUTE_V1,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(malformed.statusCode).toBe(400);

    let deeplyNested: unknown = "leaf";
    for (let depth = 0; depth < 66; depth += 1) {
      deeplyNested = { child: deeplyNested };
    }
    const overDepth = await app.inject({
      method: "POST",
      url: META_JOB_CREATE_ROUTE_V1,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        ...createRequest(),
        undeclared_deep_value: deeplyNested,
      },
    });
    expect(overDepth.statusCode).toBe(400);
    expect(harness.repository.inspect().jobs).toHaveLength(0);

    const created = await app.inject({
      method: "POST",
      url: META_JOB_CREATE_ROUTE_V1,
      headers: { authorization: `Bearer ${token}` },
      payload: createRequest(),
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      status: "queued",
      duplicate_replayed: false,
    });

    const replay = await app.inject({
      method: "POST",
      url: META_JOB_CREATE_ROUTE_V1,
      headers: { authorization: `Bearer ${token}` },
      payload: createRequest({ trace_id: "trace-replay" }),
    });
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toMatchObject({ duplicate_replayed: true });

    const drift = await app.inject({
      method: "POST",
      url: META_JOB_CREATE_ROUTE_V1,
      headers: { authorization: `Bearer ${token}` },
      payload: createRequest({ snapshot_version: 2 }),
    });
    expect(drift.statusCode).toBe(409);
    expect(drift.json()).toMatchObject({
      code: "idempotency_conflict",
      retryable: false,
    });
    await app.close();
  });

  it("rejects a workload whose five-part bot scope does not match", async () => {
    const harness = createHarness();
    const mismatched = verifier();
    const original = mismatched.verify;
    mismatched.verify = async (...args: Parameters<typeof original>) => {
      const value = await original(...args);
      return {
        ...value,
        claims: { ...value.claims, bot_id: "other-bot" },
      };
    };
    const app = buildMetaCognitionApp(
      {
        logger: false,
        auth: { verifier: mismatched as never },
      },
      harness.application,
    );
    const response = await app.inject({
      method: "POST",
      url: META_JOB_CREATE_ROUTE_V1,
      headers: { authorization: `Bearer ${token}` },
      payload: createRequest(),
    });
    expect(response.statusCode).toBe(403);
    expect(harness.repository.inspect().jobs).toHaveLength(0);
    await app.close();
  });
});
