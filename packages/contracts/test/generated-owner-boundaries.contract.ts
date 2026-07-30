import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  PENDING_OWNER_SCHEMA_GENERATION,
  SHARED_SCHEMA_CATALOG,
  TRIGGER_PROCESSOR_HTTP_OPERATIONS_V1,
  TRIGGER_PROCESSOR_SCHEMA_CATALOG,
} from "../src/catalog.js";
import {
  SKILL_PERMISSION_SUMMARY_IMMUTABLE_TRIGGER_FUNCTION_BODY_V1,
} from "../src/skill-registry/skill-permission-summary.v1.js";

const packageRoot = fileURLToPath(new URL("../", import.meta.url));

async function readGenerated(relativePath: string): Promise<string> {
  return readFile(resolve(packageRoot, relativePath), "utf8");
}

describe("generated contract owner boundaries", () => {
  it("emits the complete immutable Skill permission-summary relational contract", async () => {
    const ddl = await readGenerated(
      "generated/db/skill-registry-permission-summary.sql",
    );

    for (const required of [
      "CREATE TABLE skill_registry.skill_permission_summary_snapshots",
      "skill_permission_summary_snapshots_schema_version_check",
      "CHECK (schema_version = 'skill_permission_summary.v1')",
      "security_revocation_epoch BETWEEN 0 AND 9007199254740991",
      "skill_permission_summary_snapshots_canonical_bytes_check",
      "CHECK (octet_length(canonical_bytes) > 0)",
      "UNIQUE (summary_ref, summary_hash)",
      "CREATE TABLE skill_registry.skill_permission_summary_entries",
      "decision IN ('grant', 'deny')",
      "decision_source IN ('revision', 'default_deny')",
      "PRIMARY KEY (summary_ref, skill_id)",
      "UNIQUE (summary_ref, ordinal)",
      "ON DELETE RESTRICT",
      "skill_permission_summary_entries_branch_check",
      "skill_permission_summary_snapshots_immutable",
      "skill_permission_summary_entries_immutable",
      "SECURITY DEFINER",
      "PARALLEL UNSAFE",
      "REVOKE ALL ON FUNCTION skill_registry.reject_skill_permission_summary_mutation_v1()",
    ]) {
      expect(ddl).toContain(required);
    }
    expect(ddl).toContain(
      `AS $body$\n${SKILL_PERMISSION_SUMMARY_IMMUTABLE_TRIGGER_FUNCTION_BODY_V1}\n$body$;`,
    );
    expect(ddl).not.toContain("summary jsonb");
    expect(ddl).not.toContain("decision IN ('allow', 'deny')");
    expect(ddl).not.toContain(
      "decision_source IN ('permission_revision', 'default_deny')",
    );
  });

  it("keeps Shared OpenAPI free of Trigger Processor and pending-owner schemas", async () => {
    const document = JSON.parse(
      await readGenerated("generated/openapi/shared.yaml"),
    ) as {
      paths: Record<string, unknown>;
      components: { schemas: Record<string, unknown> };
    };
    const expectedSharedSchemas = SHARED_SCHEMA_CATALOG.filter((entry) =>
      entry.generated_outputs.includes("generated/openapi/shared.yaml"),
    )
      .map((entry) => entry.schema_name)
      .sort();

    expect(document.paths).toEqual({});
    expect(Object.keys(document.components.schemas).sort()).toEqual(
      expectedSharedSchemas,
    );
    for (const entry of [
      ...TRIGGER_PROCESSOR_SCHEMA_CATALOG,
      ...PENDING_OWNER_SCHEMA_GENERATION,
    ]) {
      expect(document.components.schemas).not.toHaveProperty(entry.schema_name);
    }
  });

  it("emits Trigger Processor routes and schemas only to its owner OpenAPI", async () => {
    const document = JSON.parse(
      await readGenerated("generated/openapi/trigger-processor.yaml"),
    ) as {
      paths: Record<string, unknown>;
      components: { schemas: Record<string, unknown> };
    };

    expect(Object.keys(document.paths).sort()).toEqual(
      [
        ...TRIGGER_PROCESSOR_HTTP_OPERATIONS_V1.map(
          (operation) => operation.path,
        ),
        "/v1/trigger-processes/{id}",
        "/v1/trigger-processes/{id}/cancel",
        "/v1/trigger-processes/{id}/events",
        "/v1/trigger-processes/{trigger_process_id}/confirmations/{challenge_id}",
      ].sort(),
    );
    expect(Object.keys(document.components.schemas).sort()).toEqual(
      TRIGGER_PROCESSOR_SCHEMA_CATALOG.map((entry) => entry.schema_name).sort(),
    );
    expect(
      (
        document.paths["/v1/trigger-processes/{id}"] as {
          get: {
            "x-pai-conditional-response-capabilities": unknown;
          };
        }
      ).get["x-pai-conditional-response-capabilities"],
    ).toEqual({
      process_snapshot_identity: {
        allowed_caller: "observation_gateway",
        required_capability: "trigger.process.snapshot.resolve",
        purpose: "observation_replay",
        denied_value: null,
      },
      context_snapshot_identity: {
        allowed_caller: "observation_gateway",
        required_capability: "trigger.context_snapshot.resolve",
        purpose: "audit_replay",
        denied_value: null,
      },
    });
  });

  it("keeps Runtime Start validation OpenAPI on the exact owner wire", async () => {
    const document = JSON.parse(
      await readGenerated("generated/openapi/trigger-processor-internal.yaml"),
    ) as {
      paths: Record<
        string,
        {
          post: {
            parameters: readonly {
              name: string;
              schema: Record<string, unknown>;
            }[];
            requestBody: {
              content: {
                "application/json": {
                  schema: Record<string, unknown>;
                };
              };
            };
            responses: Record<
              string,
              {
                content: {
                  "application/json": {
                    schema: Record<string, unknown>;
                  };
                };
              }
            >;
          };
        }
      >;
      components: {
        schemas: Record<
          string,
          { anyOf: readonly Record<string, unknown>[] }
        >;
      };
    };
    const operation =
      document.paths[
        "/internal/trigger-processes/{id}/runtime-start-reservations/{attempt}/validate"
      ]!.post;
    const contract =
      document.components.schemas
        .RuntimeStartReservationValidateContractV1!;

    expect(
      operation.parameters.find(({ name }) => name === "id")?.schema,
    ).toEqual({ type: "string", minLength: 1, maxLength: 256 });
    expect(Object.keys(operation.responses).sort()).toEqual(
      ["200", "403", "409", "422", "500", "503"].sort(),
    );
    expect(operation.requestBody.content["application/json"].schema).toEqual(
      contract.anyOf[0],
    );
    expect(
      operation.responses["200"]!.content["application/json"].schema,
    ).toEqual(contract.anyOf[1]);
    for (const status of ["403", "409", "422", "500", "503"]) {
      expect(
        operation.responses[status]!.content["application/json"].schema,
      ).toEqual(contract.anyOf[2]);
    }
  });

  it("does not re-export the package root or Trigger Processor from Shared types", async () => {
    const sharedTypes = await readGenerated("generated/types/shared.d.ts");
    const triggerProcessorTypes = await readGenerated(
      "generated/types/trigger-processor.d.ts",
    );

    expect(sharedTypes).not.toContain("../../dist/index.js");
    expect(sharedTypes).not.toContain("trigger-processor");
    expect(triggerProcessorTypes).toContain(
      '../../dist/trigger-processor/trigger-admission.v1.js',
    );
    expect(triggerProcessorTypes).toContain(
      '../../dist/trigger-processor/trigger-submit.v1.js',
    );
    expect(triggerProcessorTypes).toContain(
      '../../dist/trigger-processor/trigger-submit-response.v1.js',
    );
    expect(triggerProcessorTypes).toContain(
      '../../dist/trigger-processor/trigger-process-state.v1.js',
    );
  });

  it("publishes only executable Meta routes with exact workload authority and owner schemas", async () => {
    type Operation = {
      operationId: string;
      security: readonly Record<string, readonly unknown[]>[];
      "x-pai-allowed-caller": string | readonly string[];
      "x-pai-required-capability": string;
      "x-pai-requires-delegated-principal": boolean;
      requestBody?: {
        content: {
          "application/json": {
            schema: Record<string, unknown>;
          };
        };
      };
      responses: Record<
        string,
        {
          content?: {
            "application/json": {
              schema: Record<string, unknown>;
            };
          };
        }
      >;
    };
    type OpenApi = {
      paths: Record<string, Record<string, Operation>>;
      components: { schemas: Record<string, Record<string, unknown>> };
    };
    const internal = JSON.parse(
      await readGenerated("generated/openapi/meta-internal.yaml"),
    ) as OpenApi;
    const query = JSON.parse(
      await readGenerated("generated/openapi/meta-cognition.yaml"),
    ) as OpenApi;
    const expectedInternal = new Map([
      ["POST /internal/meta/jobs", ["trigger_processor", "meta.job.create", false]],
      [
        "POST /internal/meta/feedback-request-suggestions",
        [
          ["memory", "timer_trigger_app"],
          "meta.feedback_request_suggestion.create",
          false,
        ],
      ],
      [
        "POST /internal/meta/jobs/{meta_job_id}/snapshot-repair",
        ["trigger_processor", "meta.snapshot_repair", false],
      ],
      [
        "POST /internal/meta/feedback-requests/{feedback_request_id}/answer",
        ["trigger_processor", "meta.feedback.answer", true],
      ],
      [
        "GET /internal/meta/feedback-requests",
        ["observation_gateway", "meta.feedback_requests.read", true],
      ],
      [
        "GET /internal/meta/results/{id}/audit",
        ["observation_gateway", "meta.result_audit.read", true],
      ],
      [
        "POST /internal/meta/skill-candidates/{id}/review",
        ["meta_cognition", "meta.skill_candidate.review", true],
      ],
      [
        "POST /internal/meta/commands/claim",
        ["meta_cognition", "meta.command.dispatch", false],
      ],
      [
        "POST /internal/meta/commands/{id}/settle",
        ["meta_cognition", "meta.command.dispatch", false],
      ],
    ] as const);
    const expectedQueries = new Map([
      [
        "GET /v1/meta/jobs/{id}",
        ["observation_gateway", "meta.job.read", true],
      ],
      [
        "GET /v1/trigger-processes/{id}/quality-signals",
        ["observation_gateway", "meta.quality_signals.read", true],
      ],
      [
        "GET /v1/trigger-processes/{id}/experience",
        ["observation_gateway", "meta.experience.read", true],
      ],
    ] as const);

    const routeAuthorities = (
      document: OpenApi,
    ): Map<
      string,
      readonly [string | readonly string[], string, boolean]
    > => {
      const routes = new Map<
        string,
        readonly [string | readonly string[], string, boolean]
      >();
      for (const [path, methods] of Object.entries(document.paths)) {
        for (const [method, operation] of Object.entries(methods)) {
          if (method === "parameters") continue;
          expect(operation.security).toEqual([{ PaiWorkloadJwt: [] }]);
          routes.set(`${method.toUpperCase()} ${path}`, [
            operation["x-pai-allowed-caller"],
            operation["x-pai-required-capability"],
            operation["x-pai-requires-delegated-principal"],
          ]);
        }
      }
      return routes;
    };

    expect(routeAuthorities(internal)).toEqual(expectedInternal);
    expect(routeAuthorities(query)).toEqual(expectedQueries);
    const feedbackSuggestion =
      internal.paths[
        "/internal/meta/feedback-request-suggestions"
      ]!.post!;
    expect(
      feedbackSuggestion.requestBody!.content["application/json"].schema,
    ).toEqual(
      (
        internal.components.schemas
          .MetaFeedbackRequestSuggestionContractV1!.anyOf as readonly Record<
          string,
          unknown
        >[]
      )[0],
    );
    expect(
      feedbackSuggestion.responses["200"]!.content![
        "application/json"
      ].schema,
    ).toEqual(
      (
        internal.components.schemas
          .MetaFeedbackRequestSuggestionContractV1!.anyOf as readonly Record<
          string,
          unknown
        >[]
      )[1],
    );

    const review =
      internal.paths["/internal/meta/skill-candidates/{id}/review"]!.post!;
    expect(
      review.requestBody!.content["application/json"].schema,
    ).toEqual(
      (
        internal.components.schemas
          .MetaSkillCandidateReviewContractV1!.anyOf as readonly Record<
          string,
          unknown
        >[]
      )[0],
    );
    expect(
      review.responses["200"]!.content!["application/json"].schema,
    ).toEqual(
      (
        internal.components.schemas
          .MetaSkillCandidateReviewContractV1!.anyOf as readonly Record<
          string,
          unknown
        >[]
      )[1],
    );
    const claim = internal.paths["/internal/meta/commands/claim"]!.post!;
    expect(claim.requestBody!.content["application/json"].schema).toEqual(
      (
        internal.components.schemas.MetaCommandClaimContractV1!
          .anyOf as readonly Record<string, unknown>[]
      )[0],
    );
    expect(
      claim.responses["200"]!.content!["application/json"].schema,
    ).toEqual(
      (
        internal.components.schemas.MetaCommandClaimContractV1!
          .anyOf as readonly Record<string, unknown>[]
      )[1],
    );
    expect(claim.responses).not.toHaveProperty("201");
    expect(claim.responses["409"]).not.toHaveProperty("content");
    const settle =
      internal.paths["/internal/meta/commands/{id}/settle"]!.post!;
    expect(settle.requestBody!.content["application/json"].schema).toEqual(
      (
        internal.components.schemas.MetaCommandSettlementContractV1!
          .anyOf as readonly Record<string, unknown>[]
      )[0],
    );
    expect(settle.responses).not.toHaveProperty("201");
    expect(settle.responses["409"]).not.toHaveProperty("content");
    expect(
      internal.paths["/internal/meta/jobs"]!.post!.responses,
    ).toHaveProperty("201");
  });

  it("publishes every Timer route with its exact caller, capability, and branch schema", async () => {
    const document = JSON.parse(
      await readGenerated("generated/openapi/timer-trigger-app.yaml"),
    ) as {
      paths: Record<
        string,
        Record<
          string,
          {
            operationId: string;
            "x-pai-allowed-caller": string;
            "x-pai-required-capability": string;
            parameters?: readonly {
              in: string;
              name: string;
              required: boolean;
            }[];
            requestBody?: {
              content: {
                "application/json": {
                  schema: Record<string, unknown>;
                };
              };
            };
            responses: Record<
              string,
              {
                content?: {
                  "application/json": {
                    schema: Record<string, unknown>;
                  };
                };
              }
            >;
          }
        >
      >;
      components: { schemas: Record<string, unknown> };
    };
    const expected = new Map([
      ["POST /internal/agent-timers", ["action_runtime", "timer.write"]],
      ["GET /internal/agent-timers", ["action_runtime", "timer.read"]],
      ["PATCH /internal/agent-timers/{id}", ["action_runtime", "timer.write"]],
      ["GET /internal/agent-timers/{id}", ["action_runtime", "timer.read"]],
      ["POST /internal/agent-timers/{id}/pause", ["action_runtime", "timer.write"]],
      ["POST /internal/agent-timers/{id}/resume", ["action_runtime", "timer.write"]],
      ["POST /internal/agent-timers/{id}/cancel", ["action_runtime", "timer.write"]],
      ["GET /internal/agent-timers/{id}/history", ["action_runtime", "timer.read"]],
      ["POST /internal/timer-occurrences/{id}/snooze", ["action_runtime", "timer.write"]],
      ["POST /internal/timers/scan-due", ["timer_trigger_app", "timer.worker.scan"]],
      ["POST /internal/timer-occurrences/{id}/claim", ["timer_trigger_app", "timer.worker.dispatch"]],
      ["POST /internal/timer-occurrences/{id}/dispatch", ["timer_trigger_app", "timer.worker.dispatch"]],
      ["POST /internal/timer-catch-up-batches", ["timer_trigger_app", "timer.worker.catch_up"]],
      ["POST /internal/timer-catch-up-batches/{id}/advance", ["timer_trigger_app", "timer.worker.catch_up"]],
    ] as const);
    const actual = new Map<string, readonly [string, string]>();
    for (const [path, methods] of Object.entries(document.paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        actual.set(
          `${method.toUpperCase()} ${path}`,
          [
            operation["x-pai-allowed-caller"],
            operation["x-pai-required-capability"],
          ],
        );
      }
    }
    expect(actual).toEqual(expected);

    const createSchema =
      document.paths["/internal/agent-timers"]!.post!.requestBody!.content[
        "application/json"
      ].schema;
    expect(createSchema).toHaveProperty("anyOf");
    expect(JSON.stringify(createSchema)).not.toContain('"timer.update"');

    const updateSchema =
      document.paths["/internal/agent-timers/{id}"]!.patch!.requestBody!.content[
        "application/json"
      ].schema;
    expect(updateSchema).toHaveProperty(
      "properties.method.const",
      "timer.update",
    );

    const listParameters =
      document.paths["/internal/agent-timers"]!.get!.parameters ?? [];
    expect(
      listParameters
        .filter(({ required }) => required)
        .map(({ name }) => name)
        .sort(),
    ).toEqual(["runtime_run_id", "trace_id"]);
    expect(document.components.schemas).not.toHaveProperty(
      "TimerScheduleQueryV1",
    );
    expect(
      document.paths["/internal/timers/scan-due"]!.post!.requestBody!.content[
        "application/json"
      ].schema,
    ).toHaveProperty("$id", "urn:pai:timer:http:scan-due-request:v1");
    expect(
      document.paths[
        "/internal/timer-catch-up-batches/{id}/advance"
      ]!.post!.responses["200"]!.content!["application/json"].schema,
    ).toHaveProperty(
      "$id",
      "urn:pai:timer:http:catch-up-advance-response:v1",
    );
  });

  it("publishes all seven Skill management routes with exact disable authority", async () => {
    const document = JSON.parse(
      await readGenerated("generated/openapi/skill-registry-management.yaml"),
    ) as {
      info: { version: string };
      paths: Record<
        string,
        {
          post: {
            operationId: string;
            "x-pai-allowed-caller": string;
            "x-pai-required-capability": string;
            "x-pai-requires-delegated-principal": boolean;
            "x-pai-required-delegated-role": string;
            requestBody: {
              content: {
                "application/json": {
                  schema: Record<string, unknown>;
                };
              };
            };
          };
        }
      >;
    };
    expect(document.info.version).toBe("1.1.0");
    expect(Object.keys(document.paths).sort()).toEqual(
      [
        "/internal/skill-registry/skills/{skill_key}/activations:activate",
        "/internal/skill-registry/skills/{skill_key}/activations:disable",
        "/internal/skill-registry/skills/{skill_key}/activations:rollback",
        "/internal/skill-registry/skills/{skill_key}/permissions:grant",
        "/internal/skill-registry/skills/{skill_key}/permissions:revoke",
        "/internal/skill-registry/skills/{skill_key}/versions/{version_id}:deprecate",
        "/internal/skill-registry/skills/{skill_key}/versions/{version_id}:revoke",
      ].sort(),
    );
    const disable =
      document.paths[
        "/internal/skill-registry/skills/{skill_key}/activations:disable"
      ]!.post;
    expect(disable).toMatchObject({
      operationId: "disableSkillActivationV1",
      "x-pai-allowed-caller": "skill_registry",
      "x-pai-required-capability": "skill.activation.disable",
      "x-pai-requires-delegated-principal": true,
      "x-pai-required-delegated-role": "registry_release_admin",
    });
    expect(disable.requestBody.content["application/json"].schema).toHaveProperty(
      "properties.operation.const",
      "disable",
    );
    expect(
      JSON.stringify(disable.requestBody.content["application/json"].schema),
    ).not.toMatch(/version_id|target_version_id/u);
  });
});
