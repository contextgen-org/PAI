import { describe, expect, it } from "vitest";

import {
  buildMetaCognitionApp,
  createPostgresMetaFeedbackSuggestionApplicationV1,
  META_FEEDBACK_SUGGESTION_ROUTE_V1,
  sha256CanonicalV1,
} from "../src/index.js";

function requestV1(
  overrides: Readonly<Record<string, unknown>> = {},
) {
  const withoutHash = {
    schema_version: "meta.feedback_request_suggestion.v1",
    source_kind: "service_command",
    source_service: "memory_service",
    source_ref: "memory_conflict:conflict_001",
    command_id: "command_001",
    workspace_id: "workspace-1",
    bot_id: "bot-1",
    owner_agent_id: "agent-1",
    deployment_environment: "dev",
    release_channel: "stable",
    dedupe_scope_ref: {
      kind: "conflict",
      ref: "conflict:conflict_001",
    },
    question_key: "memory_conflict_resolution_v1",
    question_ref: "memory_conflict:conflict_001:v2",
    question_hash: `sha256:${"1".repeat(64)}`,
    trace_id: "trace_feedback_suggestion",
    ...overrides,
  };
  return {
    ...withoutHash,
    request_hash: sha256CanonicalV1(withoutHash),
  };
}

function principalV1() {
  return {
    caller: "memory" as const,
    capabilities: ["meta.feedback_request_suggestion.create"],
    scope: {
      workspace_id: "workspace-1",
      bot_id: "bot-1",
      owner_agent_id: "agent-1",
      deployment_environment: "dev" as const,
      release_channel: "stable" as const,
    },
  };
}

describe("Meta feedback request suggestion owner", () => {
  it("binds the authenticated command to the dedicated owner writer", async () => {
    const writes: unknown[] = [];
    const application =
      createPostgresMetaFeedbackSuggestionApplicationV1({
        deployment: {} as never,
        repository: {} as never,
        unit_of_work: {
          owner_service: "meta_cognition",
          async withTransaction(_request, work) {
            return work(
              { owner_service: "meta_cognition" } as never,
              {
                owner: {
                  async executeWriter(_transaction: unknown, writer: unknown) {
                    writes.push(writer);
                    return {
                      status: "accepted",
                      feedback_request_id:
                        "meta_feedback_f40ad783f23fd98d3b9b2684837c8c1c",
                      command_id: "command_001",
                      request_hash: requestV1().request_hash,
                    };
                  },
                },
              } as never,
            );
          },
        } as never,
      });

    await expect(
      application.suggest(principalV1(), requestV1()),
    ).resolves.toMatchObject({
      status: "accepted",
      command_id: "command_001",
    });
    expect(writes).toEqual([
      {
        writer: "create_service_feedback_request_v1",
        arguments: expect.objectContaining({
          p_source_service: "memory_service",
          p_command_id: "command_001",
          p_bot_id: "bot-1",
          p_dedupe_scope_ref: "conflict:conflict_001",
          p_question_key: "memory_conflict_resolution_v1",
          p_idempotency_key:
            "service_command:memory_service:command_001",
        }),
        expected_rows: 1,
      },
    ]);
  });

  it("rejects caller/source drift before the writer", async () => {
    let transactions = 0;
    const application =
      createPostgresMetaFeedbackSuggestionApplicationV1({
        deployment: {} as never,
        repository: {} as never,
        unit_of_work: {
          owner_service: "meta_cognition",
          async withTransaction() {
            transactions += 1;
            throw new Error("must not execute");
          },
        } as never,
      });

    await expect(
      application.suggest(
        principalV1(),
        requestV1({ source_service: "timer_trigger_app" }),
      ),
    ).rejects.toMatchObject({
      code: "authorization_scope_mismatch",
      retryable: false,
    });
    expect(transactions).toBe(0);
  });

  it("exposes exactly one authenticated internal suggestion route", async () => {
    const requests: unknown[] = [];
    const app = buildMetaCognitionApp(
      {
        logger: false,
        auth: {
          verifier: {
            async verify(_token: string, requirements: unknown) {
              expect(requirements).toEqual({
                audience: "meta_cognition",
                allowedCallers: ["memory", "timer_trigger_app"],
                requiredCapabilities: [
                  "meta.feedback_request_suggestion.create",
                ],
              });
              return {
                claims: {
                  iss: "pai-workload",
                  sub: "memory",
                  aud: "meta_cognition",
                  jti: "memory-command-token",
                  iat: 100,
                  nbf: 100,
                  exp: 200,
                  capability: [
                    "meta.feedback_request_suggestion.create",
                  ],
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
      undefined,
      {
        async suggest(principal, request) {
          requests.push({ principal, request });
          return {
            status: "accepted",
            feedback_request_id: "feedback-001",
            command_id: "command_001",
            request_hash: requestV1().request_hash,
          };
        },
      },
    );

    const response = await app.inject({
      method: "POST",
      url: META_FEEDBACK_SUGGESTION_ROUTE_V1,
      headers: { authorization: "Bearer aaa.bbb.ccc" },
      payload: requestV1(),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "accepted",
      feedback_request_id: "feedback-001",
    });
    expect(requests).toEqual([
      {
        principal: expect.objectContaining({
          caller: "memory",
          capabilities: [
            "meta.feedback_request_suggestion.create",
          ],
        }),
        request: requestV1(),
      },
    ]);
    await app.close();
  });
});
