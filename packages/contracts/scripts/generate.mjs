import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  PENDING_OWNER_SCHEMA_GENERATION,
  REGISTERED_OWNER_SCHEMA_CATALOG,
  SHARED_SCHEMA_CATALOG,
  TRIGGER_PROCESSOR_SCHEMA_CATALOG,
  TRIGGER_PROCESSOR_HTTP_OPERATIONS_V1,
} from "../dist/catalog.js";
import {
  TRIGGER_PROCESSOR_COMMAND_V1_DATABASE_CHECK,
} from "../dist/trigger-processor/commands.v1.js";
import {
  ACTION_RUNTIME_DOMAIN_EVENT_BRANCH_SCHEMAS_V1,
  ACTION_RUNTIME_DOMAIN_EVENT_TYPES_V1,
} from "../dist/action-runtime/runtime-events.v1.js";
import {
  META_COGNITION_DOMAIN_EVENT_BRANCH_SCHEMAS_V1,
  META_COGNITION_DOMAIN_EVENT_CONSUMERS_V1,
  META_COGNITION_DOMAIN_EVENT_TYPES_V1,
} from "../dist/meta/events.v1.js";
import {
  SKILL_REGISTRY_DOMAIN_EVENT_BRANCH_SCHEMAS_V1,
  SKILL_REGISTRY_DOMAIN_EVENT_CONTRACT_VERSION_V1,
  SKILL_REGISTRY_DOMAIN_EVENT_CONSUMERS_V1,
  SKILL_REGISTRY_DOMAIN_EVENT_TYPES_V1,
  SKILL_REGISTRY_DOMAIN_EVENT_V1_DATABASE_CHECK,
} from "../dist/skill-registry/events.v1.js";
import {
  SkillActivateCommandV1Schema,
  SkillDeprecateCommandV1Schema,
  SkillDisableCommandV1Schema,
  SkillManagementCommandEnvelopeV1Schema,
  SkillPermissionGrantCommandV1Schema,
  SkillPermissionRevokeCommandV1Schema,
  SkillRevokeCommandV1Schema,
  SkillRollbackCommandV1Schema,
} from "../dist/skill-registry/management-commands.v1.js";
import {
  SKILL_PERMISSION_SUMMARY_IMMUTABLE_TRIGGER_FUNCTION_BODY_V1,
  skillPermissionSummaryCanonicalBytesV1,
} from "../dist/skill-registry/skill-permission-summary.v1.js";
import {
  RuntimeEventReadErrorV1Schema,
  RuntimeEventResolveRequestV1Schema,
} from "../dist/action-runtime/runtime-event-read.v1.js";
import {
  KnowThatCandidateReviewRequestV1Schema,
} from "../dist/knowthat/candidate-review.v1.js";
import {
  KnowThatFeedbackResponseV1Schema,
} from "../dist/knowthat/feedback-request.v1.js";
import {
  KnowThatLinkageRecoveryResponseV1Schema,
} from "../dist/knowthat/linkage-recovery.v1.js";
import {
  TimerOccurrenceSnoozeCommandV1Schema,
  TimerOccurrenceSnoozeResponseV1Schema,
  TimerScheduleCancelCommandV1Schema,
  TimerScheduleCancelResponseV1Schema,
  TimerScheduleCreateCommandV1Schema,
  TimerScheduleCreateResponseV1Schema,
  TimerSchedulePauseCommandV1Schema,
  TimerSchedulePauseResponseV1Schema,
  TimerScheduleResumeCommandV1Schema,
  TimerScheduleResumeResponseV1Schema,
  TimerScheduleUpdateCommandV1Schema,
  TimerScheduleUpdateResponseV1Schema,
} from "../dist/timer/schedule-command.v1.js";
import {
  TimerScheduleQueryResponseV1Schema,
} from "../dist/timer/schedule-query-response.v1.js";
import {
  TimerDispatchRequestV1Schema,
  TimerDispatchResponseV1Schema,
} from "../dist/timer/dispatch-request.v1.js";
import {
  TimerCatchUpAdvanceRequestV1Schema,
  TimerCatchUpAdvanceResponseV1Schema,
  TimerCatchUpCreateRequestV1Schema,
  TimerCatchUpCreateResponseV1Schema,
  TimerIdPathParamsV1Schema,
  TimerOccurrenceClaimRequestV1Schema,
  TimerOccurrenceClaimResponseV1Schema,
  TimerScanDueRequestV1Schema,
  TimerScanDueResponseV1Schema,
  TimerScheduleListQueryParamsV1Schema,
  TimerScheduleReadQueryParamsV1Schema,
} from "../dist/timer/http-routes.v1.js";
import {
  TRIGGER_PROCESS_STATE_V1_DATABASE_CHECK,
} from "../dist/trigger-processor/trigger-process-state.v1.js";
import {
  TRIGGER_PROCESSOR_DOMAIN_EVENT_BRANCH_SCHEMAS_V1,
  TRIGGER_PROCESSOR_DOMAIN_EVENT_CONSUMERS_V1,
  TRIGGER_PROCESSOR_DOMAIN_EVENT_TYPES_V1,
  TRIGGER_PROCESSOR_DOMAIN_EVENT_V1_DATABASE_CHECK,
} from "../dist/trigger-processor/events.v1.js";
import {
  TriggerProcessGetResponseV1Schema,
} from "../dist/trigger-processor/process-get-response.v1.js";
import {
  TriggerConfirmationResponseResultV1Schema,
} from "../dist/trigger-processor/confirmation.v1.js";
import {
  TERMINAL_OUTCOME_V1_DATABASE_CHECK,
} from "../dist/trigger-processor/terminal-outcome.v1.js";
import {
  TriggerProcessSseRequestV1Schema,
} from "../dist/trigger-processor/process-sse.v1.js";
import {
  validateWorkloadCredentialClaimsV1,
} from "../dist/shared/workload-credential-claims.v1.js";
import { evaluateConflictPolicyV1 } from "../dist/policy/conflict-policy.v1.js";
import { evaluateDirectActivePolicyV1 } from "../dist/policy/direct-active-policy.v1.js";
import { findUnexpectedGeneratedFiles } from "./generated-output-drift.mjs";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const checkMode = process.argv.includes("--check");
const expectedOutputs = new Set();
const driftedOutputs = [];

async function emitGeneratedFile(outputPath, content) {
  const relativePath = relative(packageRoot, outputPath);
  expectedOutputs.add(relativePath);
  if (checkMode) {
    try {
      const existing = await readFile(outputPath, "utf8");
      if (existing !== content) driftedOutputs.push(relativePath);
    } catch {
      driftedOutputs.push(relativePath);
    }
    return;
  }
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, content);
}

const schemaCatalog = [
  ...SHARED_SCHEMA_CATALOG,
  ...PENDING_OWNER_SCHEMA_GENERATION,
  ...TRIGGER_PROCESSOR_SCHEMA_CATALOG,
  ...REGISTERED_OWNER_SCHEMA_CATALOG,
];

const schemaByName = new Map(
  schemaCatalog.map((entry) => [entry.schema_name, entry.schema]),
);

function openApiOperation(operation) {
  const requestSchema = schemaByName.get(operation.request_schema_name);
  const responseSchema = schemaByName.get(operation.response_schema_name);
  if (requestSchema === undefined || responseSchema === undefined) {
    throw new Error(`unknown schema for OpenAPI operation ${operation.operation_id}`);
  }
  const sourceAuthorization = Object.fromEntries(
    operation.source_bindings.map((binding) => [
      binding.source,
      binding.authentication === "supabase_ingress"
        ? {
            authentication: binding.authentication,
            allowed_principal_types: binding.allowed_principal_types,
            actor_derivation: binding.actor_derivation,
            required_permission_scope: binding.required_permission_scope,
            principal_mapping: binding.principal_mapping,
          }
        : {
            authentication: binding.authentication,
            required_capability: binding.required_capability,
            required_permission_scope: binding.required_permission_scope,
            allowed_caller: binding.allowed_caller,
          },
    ]),
  );
  return {
    [operation.method]: {
      operationId: operation.operation_id,
      tags: ["trigger_processor"],
      summary: "Admit a chat, notification, or timer trigger",
      description:
        "The source discriminator selects either verified public Supabase ingress for chat/notification or the Timer workload credential binding.",
      // HTTP bearer schemes do not define OAuth scopes. Keep the standard
      // requirement empty and expose PAI capabilities through an extension.
      security: [{ SupabaseJwt: [] }, { PaiWorkloadJwt: [] }],
      "x-pai-source-authorization": sourceAuthorization,
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: requestSchema,
          },
        },
      },
      responses: Object.fromEntries(
        operation.responses.map((status) => [
          String(status),
          {
            description:
              status === 202
                ? "Fresh trigger accepted"
                : status === 200
                  ? "Rejected or duplicate replay result"
                : "Canonical error envelope",
            content: {
              "application/json": {
                schema: operation.response_schemas_by_status[status] ?? responseSchema,
              },
            },
          },
        ]),
      ),
    },
  };
}

const triggerProcessorOpenApiPaths = {
  ...Object.fromEntries(
    TRIGGER_PROCESSOR_HTTP_OPERATIONS_V1.map((operation) => [
      operation.path,
      openApiOperation(operation),
    ]),
  ),
  "/v1/trigger-processes/{id}": {
    get: {
      operationId: "getTriggerProcessV1",
      tags: ["trigger_processor"],
      summary: "Read one authorized Trigger Process snapshot",
      description:
        "Snapshot identity members are nullable and are disclosed independently only to the Observation Gateway workload when its verified credential carries the matching resolve capability. Process snapshot identity is bound to trigger.process.snapshot.resolve/observation_replay; Context snapshot identity is bound to trigger.context_snapshot.resolve/audit_replay. Supabase principals, Timer, and other callers receive null identities.",
      security: [{ SupabaseJwt: [] }, { PaiWorkloadJwt: [] }],
      "x-pai-conditional-response-capabilities": {
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
      },
      parameters: [
        {
          in: "path",
          name: "id",
          required: true,
          schema: { type: "string", minLength: 1, maxLength: 512 },
        },
      ],
      responses: {
        200: {
          description: "Atomic process and durable snapshot watermark",
          content: { "application/json": { schema: TriggerProcessGetResponseV1Schema } },
        },
        403: { description: "Delegated read scope denied" },
        404: { description: "Process not found inside the authorized scope" },
        503: { description: "Owner PostgreSQL unavailable" },
      },
    },
  },
  "/v1/trigger-processes/{id}/events": {
    get: {
      operationId: "subscribeTriggerProcessEventsV1",
      tags: ["trigger_processor"],
      summary: "Replay and tail authorized Trigger Process events",
      security: [{ SupabaseJwt: [] }, { PaiWorkloadJwt: [] }],
      parameters: [
        {
          in: "path",
          name: "id",
          required: true,
          schema: { type: "string", minLength: 1, maxLength: 512 },
        },
        {
          in: "header",
          name: "Last-Event-ID",
          required: false,
          schema: TriggerProcessSseRequestV1Schema.properties.last_event_id,
        },
        {
          in: "query",
          name: "start_after_append_sequence_no",
          required: false,
          schema:
            TriggerProcessSseRequestV1Schema.properties
              .start_after_append_sequence_no,
        },
      ],
      responses: {
        200: {
          description: "SSE replay followed by realtime tail",
          content: {
            "text/event-stream": {
              schema: { type: "string" },
              "x-pai-event-schema": schemaByName.get("TriggerProcessSseEventV1"),
            },
          },
        },
        400: { description: "Invalid or ambiguous replay cursor" },
        403: { description: "Delegated read scope denied" },
        404: { description: "Process not found inside the authorized scope" },
        409: { description: "Replay cursor is ahead of the durable watermark" },
        410: { description: "Replay cursor is below the durable retention cutoff" },
        429: { description: "Per-bot connection limit exceeded" },
      },
    },
  },
  "/v1/trigger-processes/{id}/cancel": {
    post: {
      operationId: "cancelTriggerProcessV1",
      tags: ["trigger_processor"],
      summary: "Request cancellation of a Trigger Process",
      security: [{ SupabaseJwt: [] }],
      parameters: [
        {
          in: "path",
          name: "id",
          required: true,
          schema: { type: "string", minLength: 1, maxLength: 512 },
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: schemaByName.get("TriggerProcessCancelRequestV1"),
          },
        },
      },
      responses: Object.fromEntries(
        [200, 202, 409].map((status) => [
          String(status),
          {
            description:
              status === 202
                ? "Cancellation pending Runtime isolation"
                : status === 409
                  ? "Process is not cancellable or idempotency conflict"
                  : "Cancellation accepted or replayed",
            content: {
              "application/json": {
                schema: schemaByName.get("TriggerProcessCancelResponseV1"),
              },
            },
          },
        ]),
      ),
    },
  },
  "/v1/trigger-processes/{trigger_process_id}/confirmations/{challenge_id}": {
    post: {
      operationId: "respondToTriggerConfirmationV1",
      tags: ["trigger_processor"],
      summary: "Accept or reject one scope-bound confirmation challenge",
      security: [{ SupabaseJwt: [] }],
      parameters: [
        {
          in: "path",
          name: "trigger_process_id",
          required: true,
          schema: { type: "string", minLength: 1, maxLength: 512 },
        },
        {
          in: "path",
          name: "challenge_id",
          required: true,
          schema: { type: "string", minLength: 1, maxLength: 512 },
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: schemaByName.get("TriggerConfirmationResponseV1"),
          },
        },
      },
      responses: {
        200: {
          description: "Confirmation accepted, rejected, or replayed",
          content: {
            "application/json": {
              schema: TriggerConfirmationResponseResultV1Schema,
            },
          },
        },
        403: { description: "confirmation_principal_mismatch" },
        404: { description: "confirmation_not_found" },
        409: { description: "confirmation state or idempotency conflict" },
        410: { description: "confirmation_expired" },
        422: { description: "schema_validation_failed" },
        503: { description: "owner dependency unavailable" },
      },
    },
  },
};

for (const entry of schemaCatalog) {
  const schemaOutput = entry.generated_outputs.find((output) =>
    output.startsWith("generated/schema/"),
  );
  if (schemaOutput === undefined) continue;
  const outputPath = resolve(packageRoot, schemaOutput);
  await emitGeneratedFile(outputPath, `${JSON.stringify(entry.schema, null, 2)}\n`);
}

const openApiPath = resolve(packageRoot, "generated/openapi/shared.yaml");
await emitGeneratedFile(
  openApiPath,
  `${JSON.stringify(
    {
      openapi: "3.1.0",
      info: { title: "PAI Shared Contracts", version: "1.0.0" },
      paths: {},
      components: {
        schemas: Object.fromEntries(
          SHARED_SCHEMA_CATALOG.filter((entry) =>
            entry.generated_outputs.includes("generated/openapi/shared.yaml"),
          ).map((entry) => [entry.schema_name, entry.schema]),
        ),
      },
    },
    null,
    2,
  )}\n`,
);

const triggerProcessorOpenApiPath = resolve(
  packageRoot,
  "generated/openapi/trigger-processor.yaml",
);
await emitGeneratedFile(
  triggerProcessorOpenApiPath,
  `${JSON.stringify(
    {
      openapi: "3.1.0",
      info: { title: "PAI Trigger Processor API", version: "1.0.0" },
      paths: triggerProcessorOpenApiPaths,
      components: {
        securitySchemes: {
          PaiWorkloadJwt: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
          SupabaseJwt: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "Supabase JWT",
          },
        },
        schemas: Object.fromEntries(
          TRIGGER_PROCESSOR_SCHEMA_CATALOG.map((entry) => [
            entry.schema_name,
            entry.schema,
          ]),
        ),
      },
    },
    null,
    2,
  )}\n`,
);

function catalogComponents(catalog) {
  return Object.fromEntries(
    catalog.map((entry) => [entry.schema_name, entry.schema]),
  );
}

function internalPostOperation(
  operationId,
  requestSchema,
  responseSchema,
  errorSchema,
) {
  if (errorSchema !== undefined) {
    const errorResponse = (description) => ({
      description,
      content: { "application/json": { schema: errorSchema } },
    });
    return {
      post: {
        operationId,
        security: [{ PaiWorkloadJwt: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: requestSchema } },
        },
        responses: {
          200: {
            description: "Canonical owner success response",
            content: { "application/json": { schema: responseSchema } },
          },
          403: errorResponse("Context snapshot scope mismatch"),
          404: errorResponse("Context snapshot not found"),
          409: errorResponse("Context snapshot hash mismatch"),
          410: errorResponse("Context snapshot expired"),
          422: errorResponse("Context snapshot schema incompatible"),
        },
      },
    };
  }
  return {
    post: {
      operationId,
      security: [{ PaiWorkloadJwt: [] }],
      requestBody: {
        required: true,
        content: { "application/json": { schema: requestSchema } },
      },
      responses: {
        200: {
          description: "Canonical owner success or idempotent replay response",
          content: { "application/json": { schema: responseSchema } },
        },
        201: {
          description: "Canonical owner resource created response",
          content: { "application/json": { schema: responseSchema } },
        },
        409: {
          description: "Idempotency, state, or ownership conflict",
          content: { "application/json": { schema: responseSchema } },
        },
        422: { description: "Schema-valid request failed semantic validation" },
        503: { description: "Owner dependency unavailable" },
      },
    },
  };
}

function metaInternalPostOperation(
  operationId,
  requestSchema,
  responseSchema,
  allowedCaller,
  requiredCapability,
  supportsCreated = false,
  requiresDelegatedPrincipal = false,
) {
  return {
    post: {
      operationId,
      security: [{ PaiWorkloadJwt: [] }],
      "x-pai-allowed-caller": allowedCaller,
      "x-pai-required-capability": requiredCapability,
      "x-pai-requires-delegated-principal": requiresDelegatedPrincipal,
      requestBody: {
        required: true,
        content: { "application/json": { schema: requestSchema } },
      },
      responses: {
        200: {
          description: "Canonical owner success or idempotent replay response",
          content: { "application/json": { schema: responseSchema } },
        },
        ...(supportsCreated
          ? {
              201: {
                description: "Canonical owner resource created response",
                content: {
                  "application/json": { schema: responseSchema },
                },
              },
            }
          : {}),
        400: { description: "Request schema or semantic validation failed" },
        403: { description: "Caller, capability, or scope authorization denied" },
        404: { description: "Owner resource not found" },
        409: { description: "Idempotency, state, or ownership conflict" },
        503: { description: "Owner dependency unavailable" },
      },
    },
  };
}

const internalSecuritySchemes = {
  PaiWorkloadJwt: {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
  },
};

const delegatedReadSecuritySchemes = {
  SupabaseJwt: {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
  },
  PaiWorkloadJwt: internalSecuritySchemes.PaiWorkloadJwt,
};

function foundEnvelopeSchema(code, detailsSchema) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["code", "message", "retryable", "trace_id", "details"],
    properties: {
      code: { const: code },
      message: { type: "string", minLength: 1, maxLength: 4096 },
      retryable: { const: false },
      trace_id: { type: "string", minLength: 1, maxLength: 512 },
      details: detailsSchema,
    },
  };
}

const internalTriggerSchemas = Object.fromEntries(
  TRIGGER_PROCESSOR_SCHEMA_CATALOG.filter((entry) =>
    entry.generated_outputs.includes(
      "generated/openapi/trigger-processor-internal.yaml",
    ),
  ).map((entry) => [entry.schema_name, entry.schema]),
);
await emitGeneratedFile(
  resolve(packageRoot, "generated/openapi/trigger-processor-internal.yaml"),
  `${JSON.stringify(
    {
      openapi: "3.1.0",
      info: { title: "PAI Trigger Processor Internal API", version: "1.0.0" },
      paths: {
        "/internal/context/compose": internalPostOperation(
          "composeContextV1",
          schemaByName.get("ContextComposeContractV1").anyOf[0],
          schemaByName.get("ContextComposeContractV1").anyOf[1],
        ),
        "/internal/context-snapshots:resolve": internalPostOperation(
          "resolveContextSnapshotV1",
          schemaByName.get("ContextSnapshotResolveRequestV1"),
          schemaByName.get("ContextSnapshotReadContractV1"),
          schemaByName.get("ContextSnapshotReadErrorV1"),
        ),
        "/internal/intent/synthesize": internalPostOperation(
          "synthesizeIntentV1",
          schemaByName.get("IntentSynthesizeContractV1").anyOf[0],
          schemaByName.get("IntentSynthesizeContractV1").anyOf[1],
        ),
        "/internal/trigger-processes/{id}/runtime-events":
          internalPostOperation(
            "appendRuntimeEventV1",
            schemaByName.get("SnapshotAppendContractV1").anyOf[0],
            schemaByName.get("SnapshotAppendContractV1").anyOf[1],
          ),
        "/internal/trigger-process-snapshots:resolve":
          internalPostOperation(
            "resolveTriggerProcessSnapshotV1",
            schemaByName.get("TriggerProcessSnapshotResolveRequestV1"),
            schemaByName.get("TriggerProcessSnapshotReadContractV1"),
          ),
        "/internal/trigger-processes/{id}/runtime-start-reservations/{attempt}/validate": {
          post: {
            operationId: "validateRuntimeStartReservationV1",
            security: [{ PaiWorkloadJwt: [] }],
            parameters: [
              {
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string", minLength: 1, maxLength: 256 },
              },
              {
                name: "attempt",
                in: "path",
                required: true,
                schema: {
                  type: "integer",
                  minimum: 1,
                  maximum: Number.MAX_SAFE_INTEGER,
                },
              },
            ],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: schemaByName.get(
                    "RuntimeStartReservationValidateContractV1",
                  ).anyOf[0],
                },
              },
            },
            responses: Object.fromEntries(
              [
                [200, "Current owner reservation is valid"],
                [403, "Workload or owner scope mismatch"],
                [409, "Fence, cancellation, terminal, or idempotency conflict"],
                [422, "Request or path schema validation failed"],
                [500, "Owner invariant or unexpected internal failure"],
                [503, "Owner PostgreSQL is temporarily unavailable"],
              ].map(([status, description]) => [
                status,
                {
                  description,
                  content: {
                    "application/json": {
                      schema:
                        schemaByName.get(
                          "RuntimeStartReservationValidateContractV1",
                        ).anyOf[status === 200 ? 1 : 2],
                    },
                  },
                },
              ]),
            ),
          },
        },
      },
      components: {
        securitySchemes: internalSecuritySchemes,
        schemas: internalTriggerSchemas,
      },
    },
    null,
    2,
  )}\n`,
);

const actionRuntimeCatalog = REGISTERED_OWNER_SCHEMA_CATALOG.filter(
  (entry) => entry.owner_service === "action-runtime",
);
await emitGeneratedFile(
  resolve(packageRoot, "generated/openapi/action-runtime-internal.yaml"),
  `${JSON.stringify(
    {
      openapi: "3.1.0",
      info: { title: "PAI Action Runtime Internal API", version: "1.2.0" },
      paths: {
        "/internal/runtime/tool-permission-profiles/current": {
          get: {
            operationId: "readCurrentToolPermissionProfileV1",
            security: [{ PaiWorkloadJwt: [] }],
            "x-pai-workload-authorization": {
              allowed_caller: "trigger_processor",
              audience: "action_runtime",
              required_capability: "runtime.tool_permission_profile.current.read",
              scope_source: "authenticated_principal_and_selector",
            },
            parameters: Object.entries(
              schemaByName.get("ToolPermissionProfileCurrentReadContractV1")
                .anyOf[0].properties.selector.properties,
            ).map(([name, schema]) => ({
              name,
              in: "query",
              required: true,
              schema,
            })),
            responses: {
              200: {
                description: "Current immutable ToolPermissionProfile owner artifact",
                content: {
                  "application/json": {
                    schema: schemaByName.get(
                      "ToolPermissionProfileCurrentReadContractV1",
                    ).anyOf[1],
                  },
                },
              },
              ...Object.fromEntries(
                [403, 404, 503].map((status) => [
                  String(status),
                  {
                    description: "Fail-closed current profile read error",
                    content: {
                      "application/json": {
                        schema: schemaByName.get(
                          "ToolPermissionProfileCurrentReadContractV1",
                        ).anyOf[2],
                      },
                    },
                  },
                ]),
              ),
            },
          },
        },
        "/internal/runtime/runs": internalPostOperation(
          "startRuntimeV1",
          schemaByName.get("RuntimeStartContractV1").anyOf[0],
          schemaByName.get("RuntimeStartContractV1").anyOf[1],
        ),
        "/internal/runtime-events:resolve": {
          post: {
            operationId: "resolveRuntimeEventV1",
            security: [{ PaiWorkloadJwt: [] }],
            "x-pai-workload-authorization": {
              allowed_caller: "trigger_processor",
              audience: "action_runtime",
              required_capability: "runtime.event.resolve",
              purpose: "trigger_snapshot_append",
            },
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: RuntimeEventResolveRequestV1Schema,
                },
              },
            },
            responses: {
              200: {
                description: "Canonical Action Runtime owner event",
                content: {
                  "application/json": {
                    schema: schemaByName.get("RuntimeEventReadContractV1"),
                  },
                },
              },
              ...Object.fromEntries(
                [403, 404, 409, 410, 422].map((status) => [
                  String(status),
                  {
                    description: "Fail-closed runtime event resolution error",
                    content: {
                      "application/json": {
                        schema: RuntimeEventReadErrorV1Schema,
                      },
                    },
                  },
                ]),
              ),
            },
          },
        },
        "/internal/runtime/runs/{runtime_run_id}/start-attempts/{start_attempt_no}/policy-input": {
          get: {
            operationId: "readRuntimePolicyInputV1",
            security: [{ PaiWorkloadJwt: [] }],
            "x-pai-workload-authorization": {
              allowed_caller: "skill_registry",
              audience: "action_runtime",
              required_capability: "runtime.policy_input.read",
              scope_source: "authenticated_principal_and_owner_run",
            },
            parameters: [
              {
                name: "runtime_run_id",
                in: "path",
                required: true,
                schema: { type: "string", minLength: 1, maxLength: 512 },
              },
              {
                name: "start_attempt_no",
                in: "path",
                required: true,
                schema: {
                  type: "integer",
                  minimum: 1,
                  maximum: Number.MAX_SAFE_INTEGER,
                },
              },
            ],
            responses: {
              200: {
                description: "Owner-persisted, scope-bound runtime policy input",
                content: {
                  "application/json": {
                    schema: schemaByName.get(
                      "RuntimePolicyInputReadContractV1",
                    ),
                  },
                },
              },
              403: { description: "authorization_scope_mismatch" },
              404: { description: "runtime_not_found" },
              503: { description: "owner dependency unavailable" },
            },
          },
        },
        "/internal/runtime-runs/{runtime_run_id}/tokens": {
          get: {
            operationId: "streamRuntimeTokensV1",
            security: [{ PaiWorkloadJwt: [] }],
            "x-pai-workload-authorization": {
              allowed_caller: "observation_gateway",
              audience: "action_runtime",
              required_capability: "runtime.debug_tokens",
              scope_source: "authenticated_principal_and_owner_run",
              replay: false,
            },
            parameters: [
              {
                name: "runtime_run_id",
                in: "path",
                required: true,
                schema: { type: "string", minLength: 1, maxLength: 256 },
              },
            ],
            responses: {
              200: {
                description: "Live non-durable runtime token SSE without event ids",
                content: {
                  "text/event-stream": {
                    schema: { type: "string" },
                    "x-pai-event-schema": schemaByName.get(
                      "RuntimeTokenSseEventV1",
                    ),
                    "x-pai-sse-event-name": "runtime_token",
                    "x-pai-last-event-id-supported": false,
                  },
                },
              },
              409: {
                description: "runtime_token_stream_not_live; retryable=false",
              },
            },
          },
        },
      },
      components: {
        securitySchemes: internalSecuritySchemes,
        schemas: catalogComponents(actionRuntimeCatalog),
      },
    },
    null,
    2,
  )}\n`,
);

await emitGeneratedFile(
  resolve(packageRoot, "generated/openapi/action-runtime.yaml"),
  `${JSON.stringify(
    {
      openapi: "3.1.0",
      info: { title: "PAI Action Runtime Query API", version: "1.0.0" },
      paths: {
        "/v1/runtime-runs/{id}": {
          get: {
            operationId: "getRuntimeRunV1",
            security: [{ SupabaseJwt: [] }, { PaiWorkloadJwt: [] }],
            "x-pai-required-permission-scope": "runtime.run.read",
            parameters: [
              {
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string", minLength: 1, maxLength: 512 },
              },
            ],
            responses: {
              200: {
                description: "Authorized owner run projection",
                content: {
                  "application/json": {
                    schema: foundEnvelopeSchema(
                      "runtime_run_found",
                      schemaByName.get("RuntimeRunQueryDetailsV1"),
                    ),
                  },
                },
              },
              403: { description: "authorization_denied" },
              404: { description: "runtime_run_not_found" },
              503: { description: "owner dependency unavailable" },
            },
          },
        },
        "/v1/runtime-runs/{id}/tool-invocations": {
          get: {
            operationId: "listToolInvocationsV1",
            security: [{ SupabaseJwt: [] }, { PaiWorkloadJwt: [] }],
            "x-pai-required-permission-scope": "runtime.tool_invocations.read",
            parameters: [
              {
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string", minLength: 1, maxLength: 512 },
              },
              {
                name: "cursor",
                in: "query",
                schema: { type: "string", minLength: 1, maxLength: 512 },
              },
              {
                name: "limit",
                in: "query",
                schema: { type: "integer", minimum: 1, maximum: 200, default: 50 },
              },
              {
                name: "status",
                in: "query",
                schema: {
                  enum: [
                    "requested",
                    "running",
                    "completed",
                    "failed",
                    "cancelled",
                  ],
                },
              },
            ],
            responses: {
              200: {
                description: "Stable redacted tool-invocation page",
                content: {
                  "application/json": {
                    schema: foundEnvelopeSchema(
                      "tool_invocations_found",
                      schemaByName.get("ToolInvocationListDetailsV1"),
                    ),
                  },
                },
              },
              400: { description: "invalid_cursor or schema_validation_failed" },
              403: { description: "authorization_denied" },
              404: { description: "runtime_run_not_found" },
              503: { description: "owner dependency unavailable" },
            },
          },
        },
      },
      components: {
        securitySchemes: delegatedReadSecuritySchemes,
        schemas: catalogComponents(actionRuntimeCatalog),
      },
    },
    null,
    2,
  )}\n`,
);

const metaCatalog = REGISTERED_OWNER_SCHEMA_CATALOG.filter(
  (entry) => entry.owner_service === "meta-cognition",
);
await emitGeneratedFile(
  resolve(packageRoot, "generated/openapi/meta-internal.yaml"),
  `${JSON.stringify(
    {
      openapi: "3.1.0",
      info: { title: "PAI Meta Cognition Internal API", version: "1.0.0" },
      paths: {
        "/internal/meta/jobs": metaInternalPostOperation(
          "createMetaJobV1",
          schemaByName.get("MetaJobCreateContractV1").anyOf[0],
          schemaByName.get("MetaJobCreateContractV1").anyOf[1],
          "trigger_processor",
          "meta.job.create",
          true,
        ),
        "/internal/meta/jobs/{meta_job_id}/snapshot-repair": {
          ...metaInternalPostOperation(
            "repairMetaSnapshotV1",
            schemaByName.get("MetaSnapshotRepairRequestV1"),
            schemaByName.get("MetaSnapshotRepairResponseV1"),
            "trigger_processor",
            "meta.snapshot_repair",
          ),
          parameters: [
            {
              name: "meta_job_id",
              in: "path",
              required: true,
              schema: { type: "string", minLength: 1, maxLength: 512 },
            },
          ],
        },
        "/internal/meta/feedback-request-suggestions":
          metaInternalPostOperation(
            "suggestMetaFeedbackRequestV1",
            schemaByName.get(
              "MetaFeedbackRequestSuggestionContractV1",
            ).anyOf[0],
            schemaByName.get(
              "MetaFeedbackRequestSuggestionContractV1",
            ).anyOf[1],
            ["memory", "timer_trigger_app"],
            "meta.feedback_request_suggestion.create",
          ),
        "/internal/meta/feedback-requests/{feedback_request_id}/answer": {
          ...metaInternalPostOperation(
            "answerMetaFeedbackRequestV1",
            schemaByName.get("MetaFeedbackAnswerContractV1").anyOf[0],
            schemaByName.get("MetaFeedbackAnswerContractV1").anyOf[1],
            "trigger_processor",
            "meta.feedback.answer",
            false,
            true,
          ),
          parameters: [
            {
              name: "feedback_request_id",
              in: "path",
              required: true,
              schema: { type: "string", minLength: 1, maxLength: 512 },
            },
          ],
        },
        "/internal/meta/feedback-requests": {
          get: {
            operationId: "listMetaFeedbackRequestsV1",
            security: [{ PaiWorkloadJwt: [] }],
            "x-pai-allowed-caller": "observation_gateway",
            "x-pai-required-capability": "meta.feedback_requests.read",
            "x-pai-requires-delegated-principal": true,
            "x-pai-required-permission-scope": "meta.feedback_requests.read",
            parameters: [
              {
                name: "status",
                in: "query",
                required: true,
                schema: { const: "open" },
              },
              {
                name: "assignee",
                in: "query",
                required: true,
                schema: { type: "string", minLength: 1, maxLength: 512 },
              },
              {
                name: "cursor",
                in: "query",
                schema: { type: "string", minLength: 1, maxLength: 512 },
              },
              {
                name: "limit",
                in: "query",
                schema: {
                  type: "integer",
                  minimum: 1,
                  maximum: 200,
                  default: 50,
                },
              },
            ],
            responses: {
              200: {
                description: "Stable redacted feedback request page",
                content: {
                  "application/json": {
                    schema: schemaByName.get(
                      "MetaFeedbackRequestListContractV1",
                    ).anyOf[1],
                  },
                },
              },
              400: { description: "Invalid cursor or query" },
              403: { description: "Assignee or scope authorization denied" },
              503: { description: "Owner dependency unavailable" },
            },
          },
        },
        "/internal/meta/results/{id}/audit": {
          get: {
            operationId: "listMetaResultAuditV1",
            security: [{ PaiWorkloadJwt: [] }],
            "x-pai-allowed-caller": "observation_gateway",
            "x-pai-required-capability": "meta.result_audit.read",
            "x-pai-requires-delegated-principal": true,
            "x-pai-required-permission-scope": "meta.result_audit.read",
            parameters: [
              {
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string", minLength: 1, maxLength: 512 },
              },
              {
                name: "cursor",
                in: "query",
                schema: { type: "string", minLength: 1, maxLength: 512 },
              },
              {
                name: "limit",
                in: "query",
                schema: {
                  type: "integer",
                  minimum: 1,
                  maximum: 200,
                  default: 50,
                },
              },
            ],
            responses: {
              200: {
                description: "Stable redacted result audit page",
                content: {
                  "application/json": {
                    schema: schemaByName.get(
                      "MetaResultAuditQueryContractV1",
                    ).anyOf[1],
                  },
                },
              },
              400: { description: "Invalid cursor or query" },
              403: { description: "Scope authorization denied" },
              404: { description: "Result not found in authorized scope" },
              503: { description: "Owner dependency unavailable" },
            },
          },
        },
        "/internal/meta/skill-candidates/{id}/review": {
          ...metaInternalPostOperation(
            "reviewMetaSkillCandidateV1",
            schemaByName.get("MetaSkillCandidateReviewContractV1").anyOf[0],
            schemaByName.get("MetaSkillCandidateReviewContractV1").anyOf[1],
            "meta_cognition",
            "meta.skill_candidate.review",
            false,
            true,
          ),
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", minLength: 1, maxLength: 512 },
            },
          ],
        },
        "/internal/meta/commands/claim": metaInternalPostOperation(
          "claimMetaCommandsV1",
          schemaByName.get("MetaCommandClaimContractV1").anyOf[0],
          schemaByName.get("MetaCommandClaimContractV1").anyOf[1],
          "meta_cognition",
          "meta.command.dispatch",
        ),
        "/internal/meta/commands/{id}/settle": {
          ...metaInternalPostOperation(
            "settleMetaCommandV1",
            schemaByName.get("MetaCommandSettlementContractV1").anyOf[0],
            schemaByName.get("MetaCommandSettlementContractV1").anyOf[1],
            "meta_cognition",
            "meta.command.dispatch",
          ),
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", minLength: 1, maxLength: 512 },
            },
          ],
        },
      },
      components: {
        securitySchemes: internalSecuritySchemes,
        schemas: catalogComponents(metaCatalog),
      },
    },
    null,
    2,
  )}\n`,
);

await emitGeneratedFile(
  resolve(packageRoot, "generated/openapi/meta-cognition.yaml"),
  `${JSON.stringify(
    {
      openapi: "3.1.0",
      info: { title: "PAI Meta Cognition Query API", version: "1.0.0" },
      paths: {
        "/v1/meta/jobs/{id}": {
          get: {
            operationId: "getMetaJobV1",
            security: [{ PaiWorkloadJwt: [] }],
            "x-pai-allowed-caller": "observation_gateway",
            "x-pai-required-capability": "meta.job.read",
            "x-pai-requires-delegated-principal": true,
            "x-pai-required-permission-scope": "meta.job.read",
            parameters: [
              {
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string", minLength: 1, maxLength: 512 },
              },
            ],
            responses: {
              200: {
                description: "Authorized bounded Meta job summary",
                content: {
                  "application/json": {
                    schema: foundEnvelopeSchema(
                      "meta_job_found",
                      schemaByName.get("MetaJobQueryDetailsV1"),
                    ),
                  },
                },
              },
              403: { description: "authorization_denied" },
              404: { description: "meta_job_not_found" },
              503: { description: "owner dependency unavailable" },
            },
          },
        },
        "/v1/trigger-processes/{id}/quality-signals": {
          get: {
            operationId: "listQualitySignalsV1",
            security: [{ PaiWorkloadJwt: [] }],
            "x-pai-allowed-caller": "observation_gateway",
            "x-pai-required-capability": "meta.quality_signals.read",
            "x-pai-requires-delegated-principal": true,
            "x-pai-required-permission-scope": "meta.quality_signals.read",
            parameters: [
              {
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string", minLength: 1, maxLength: 512 },
              },
              {
                name: "cursor",
                in: "query",
                schema: { type: "string", minLength: 1, maxLength: 512 },
              },
              {
                name: "limit",
                in: "query",
                schema: { type: "integer", minimum: 1, maximum: 200, default: 50 },
              },
              {
                name: "severity",
                in: "query",
                schema: { enum: ["info", "warning", "error", "critical"] },
              },
              {
                name: "signal_type",
                in: "query",
                schema: {
                  enum: [
                    "snapshot_missing",
                    "snapshot_incomplete",
                    "snapshot_schema_incompatible",
                    "snapshot_hash_mismatch",
                    "artifact_unreadable",
                    "redaction_incomplete",
                    "llm_parse_failed",
                    "schema_validation_failed",
                    "memory_write_partial_failed",
                    "knowthat_conflict_detected",
                    "tool_execution_failed",
                    "user_dissatisfied",
                    "low_confidence_extraction",
                    "feedback_required",
                    "downstream_operation_failed",
                  ],
                },
              },
            ],
            responses: {
              200: {
                description: "Stable redacted quality-signal page",
                content: {
                  "application/json": {
                    schema: foundEnvelopeSchema(
                      "quality_signals_found",
                      schemaByName.get("QualitySignalListDetailsV1"),
                    ),
                  },
                },
              },
              400: { description: "invalid_cursor or schema_validation_failed" },
              403: { description: "authorization_denied" },
              404: { description: "trigger_process_not_found" },
              503: { description: "owner dependency unavailable" },
            },
          },
        },
        "/v1/trigger-processes/{id}/experience": {
          get: {
            operationId: "getMetaExperienceV1",
            security: [{ PaiWorkloadJwt: [] }],
            "x-pai-allowed-caller": "observation_gateway",
            "x-pai-required-capability": "meta.experience.read",
            "x-pai-requires-delegated-principal": true,
            "x-pai-required-permission-scope": "meta.experience.read",
            parameters: [
              {
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string", minLength: 1, maxLength: 512 },
              },
            ],
            responses: {
              200: {
                description: "Authorized redacted experience summary",
                content: {
                  "application/json": {
                    schema: schemaByName.get(
                      "MetaExperienceQueryContractV1",
                    ).anyOf[1],
                  },
                },
              },
              403: { description: "authorization_denied" },
              404: { description: "trigger_process_not_found" },
              503: { description: "owner dependency unavailable" },
            },
          },
        },
      },
      components: {
        securitySchemes: internalSecuritySchemes,
        schemas: catalogComponents(metaCatalog),
      },
    },
    null,
    2,
  )}\n`,
);

const skillRegistryCatalog = REGISTERED_OWNER_SCHEMA_CATALOG.filter(
  (entry) =>
    entry.owner_service === "skill-registry" ||
    entry.owner_service === "skill_registry",
);
const skillRegistryContractBranch = (schemaName, index) => {
  const contract = schemaByName.get(schemaName);
  const branch = contract?.anyOf?.[index];
  if (branch === undefined) {
    throw new Error(`${schemaName} branch ${index} missing`);
  }
  return branch;
};
const skillRegistryOperation = (operationId, schemaName, method = "post") => ({
  [method]: {
    operationId,
    security: [{ PaiWorkloadJwt: [] }],
    ...(method === "post"
      ? {
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: skillRegistryContractBranch(schemaName, 0),
              },
            },
          },
        }
      : {}),
    responses: {
      200: {
        description: "Canonical Skill Registry response",
        content: {
          "application/json": {
            schema: skillRegistryContractBranch(schemaName, 1),
          },
        },
      },
      400: { description: "Canonical non-retryable contract error" },
      403: { description: "Authorization scope mismatch" },
      503: { description: "Owner dependency unavailable" },
    },
  },
});
await emitGeneratedFile(
  resolve(packageRoot, "generated/openapi/skill-registry-internal.yaml"),
  `${JSON.stringify(
    {
      openapi: "3.1.0",
      info: { title: "PAI Skill Registry Internal API", version: "1.0.0" },
      paths: {
        "/internal/skill-registry/resolve": skillRegistryOperation(
          "resolveSkillsV1",
          "SkillResolveContractV1",
        ),
        "/internal/skill-registry/content": skillRegistryOperation(
          "authorizeSkillContentV1",
          "SkillContentContractV1",
        ),
        "/internal/skill-registry/skills/validate": skillRegistryOperation(
          "validateSkillPackageV1",
          "SkillValidateContractV1",
        ),
        "/internal/skill-registry/skills/{name}/versions":
          skillRegistryOperation(
            "publishSkillVersionV1",
            "SkillPublishContractV1",
          ),
        "/internal/skill-registry/catalog": skillRegistryOperation(
          "querySkillCatalogV1",
          "SkillCatalogQueryContractV1",
          "get",
        ),
        "/internal/skill-registry/candidate-applications":
          skillRegistryOperation(
            "applySkillCandidateV1",
            "SkillCandidateApplicationContractV1",
          ),
      },
      components: {
        securitySchemes: internalSecuritySchemes,
        schemas: catalogComponents(skillRegistryCatalog),
      },
    },
    null,
    2,
  )}\n`,
);

await emitGeneratedFile(
  resolve(packageRoot, "generated/openapi/skill-registry-management.yaml"),
  `${JSON.stringify(
    {
      openapi: "3.1.0",
      info: { title: "PAI Skill Registry Management API", version: "1.1.0" },
      paths: Object.fromEntries(
        [
          [
            "/internal/skill-registry/skills/{skill_key}/activations:activate",
            "activateSkillVersionV1",
            "skill.version.activate",
            "registry_release_admin",
            SkillActivateCommandV1Schema,
            0,
            ["skill_key"],
          ],
          [
            "/internal/skill-registry/skills/{skill_key}/activations:rollback",
            "rollbackSkillActivationV1",
            "skill.version.rollback",
            "registry_release_admin",
            SkillRollbackCommandV1Schema,
            1,
            ["skill_key"],
          ],
          [
            "/internal/skill-registry/skills/{skill_key}/activations:disable",
            "disableSkillActivationV1",
            "skill.activation.disable",
            "registry_release_admin",
            SkillDisableCommandV1Schema,
            2,
            ["skill_key"],
          ],
          [
            "/internal/skill-registry/skills/{skill_key}/permissions:grant",
            "grantSkillPermissionV1",
            "skill.permission.grant",
            "workspace_skill_admin",
            SkillPermissionGrantCommandV1Schema,
            3,
            ["skill_key"],
          ],
          [
            "/internal/skill-registry/skills/{skill_key}/permissions:revoke",
            "revokeSkillPermissionV1",
            "skill.permission.revoke",
            "workspace_skill_admin",
            SkillPermissionRevokeCommandV1Schema,
            4,
            ["skill_key"],
          ],
          [
            "/internal/skill-registry/skills/{skill_key}/versions/{version_id}:deprecate",
            "deprecateSkillVersionV1",
            "skill.version.deprecate",
            "registry_release_admin",
            SkillDeprecateCommandV1Schema,
            5,
            ["skill_key", "version_id"],
          ],
          [
            "/internal/skill-registry/skills/{skill_key}/versions/{version_id}:revoke",
            "revokeSkillVersionV1",
            "skill.version.revoke",
            "security_admin",
            SkillRevokeCommandV1Schema,
            6,
            ["skill_key", "version_id"],
          ],
        ].map(
          ([
            path,
            operationId,
            capability,
            delegatedRole,
            requestSchema,
            responseBranch,
            pathParameters,
          ]) => [
            path,
            {
              post: {
                operationId,
                security: [{ PaiWorkloadJwt: [] }],
                "x-pai-allowed-caller": "skill_registry",
                "x-pai-required-capability": capability,
                "x-pai-requires-delegated-principal": true,
                "x-pai-required-delegated-role": delegatedRole,
                parameters: pathParameters.map((name) => ({
                  name,
                  in: "path",
                  required: true,
                  schema: { type: "string", minLength: 1, maxLength: 512 },
                })),
                requestBody: {
                  required: true,
                  content: {
                    "application/json": { schema: requestSchema },
                  },
                },
                responses: {
                  200: {
                    description: "Canonical Skill Registry management response",
                    content: {
                      "application/json": {
                        schema:
                          SkillManagementCommandEnvelopeV1Schema.anyOf[
                            responseBranch
                          ],
                      },
                    },
                  },
                  400: { description: "Canonical non-retryable contract error" },
                  403: { description: "Authorization scope mismatch" },
                  409: { description: "Owner CAS or idempotency conflict" },
                  503: { description: "Owner dependency unavailable" },
                },
              },
            },
          ],
        ),
      ),
      components: {
        securitySchemes: internalSecuritySchemes,
        schemas: catalogComponents(
          skillRegistryCatalog.filter(
            (entry) => entry.schema_name === "SkillManagementCommandV1",
          ),
        ),
      },
    },
    null,
    2,
  )}\n`,
);

const memoryCatalog = REGISTERED_OWNER_SCHEMA_CATALOG.filter(
  (entry) => entry.owner_service === "memory-service",
);
function memoryUnionBranch(schemaName, index) {
  const branch = schemaByName.get(schemaName)?.anyOf?.[index];
  if (branch === undefined) {
    throw new Error(`${schemaName} branch ${index} missing from schema catalog`);
  }
  return branch;
}

function memoryPostOperation(
  operationId,
  requestSchema,
  responseSchema,
  successStatus = 200,
  pathParameter,
) {
  return {
    post: {
      operationId,
      security: [{ PaiWorkloadJwt: [] }],
      ...(pathParameter === undefined
        ? {}
        : {
            parameters: [
              {
                in: "path",
                name: pathParameter,
                required: true,
                schema: { type: "string", minLength: 1, maxLength: 256 },
              },
            ],
          }),
      requestBody: {
        required: true,
        content: { "application/json": { schema: requestSchema } },
      },
      responses: {
        [successStatus]: {
          description: "Canonical owner success or idempotent replay response",
          content: { "application/json": { schema: responseSchema } },
        },
        401: { description: "Workload authentication failed" },
        403: { description: "Caller capability or bot scope is forbidden" },
        404: { description: "Owner aggregate or reservation was not found" },
        409: { description: "Idempotency, state, or ownership conflict" },
        410: { description: "Snapshot, check, or reservation expired" },
        413: { description: "Owner request exceeds its byte or item limit" },
        422: { description: "Request failed owner schema or semantic validation" },
        503: { description: "Owner dependency unavailable" },
      },
    },
  };
}

const memoryQuerySeriesRequest = memoryUnionBranch(
  "MemoryQuerySeriesContractV1",
  0,
);
const memoryQuerySeriesResponse = memoryUnionBranch(
  "MemoryQuerySeriesContractV1",
  1,
);
await emitGeneratedFile(
  resolve(packageRoot, "generated/openapi/memory-service.yaml"),
  `${JSON.stringify(
    {
      openapi: "3.1.0",
      info: { title: "PAI Memory Service Internal API", version: "1.0.0" },
      paths: {
        "/internal/memory/write-batch": memoryPostOperation(
          "writeMemoryBatchV1",
          memoryUnionBranch("MemoryWriteBatchV1", 0),
          memoryUnionBranch("MemoryWriteBatchV1", 1),
        ),
        "/v1/memory/fast-recall": memoryPostOperation(
          "fastRecallMemoryV1",
          memoryUnionBranch("MemoryFastRecallV1", 0),
          memoryUnionBranch("MemoryFastRecallV1", 1),
        ),
        "/internal/memory/deep-recall": memoryPostOperation(
          "deepRecallMemoryV1",
          memoryUnionBranch("MemoryDeepRecallV1", 0),
          memoryUnionBranch("MemoryDeepRecallV1", 1),
        ),
        "/internal/memory/pre-promotion-check": memoryPostOperation(
          "checkMemoryPrePromotionV1",
          memoryUnionBranch("MemoryPrePromotionCheckV1", 0),
          memoryUnionBranch("MemoryPrePromotionCheckV1", 1),
        ),
        "/internal/memory/pre-promotion-check/validate": memoryPostOperation(
          "validateMemoryPrePromotionV1",
          memoryUnionBranch("MemoryPrePromotionCheckV1", 2),
          memoryUnionBranch("MemoryPrePromotionCheckV1", 3),
        ),
        "/internal/memory/promotion-reservations/{id}/ack":
          memoryPostOperation(
            "ackMemoryPromotionReservationV1",
            memoryUnionBranch("MemoryPrePromotionCheckV1", 4),
            memoryUnionBranch("MemoryPrePromotionCheckV1", 5),
            200,
            "id",
          ),
        "/internal/memory/promotion-reservations/{id}/release":
          memoryPostOperation(
            "releaseMemoryPromotionReservationV1",
            memoryUnionBranch("MemoryPrePromotionCheckV1", 6),
            memoryUnionBranch("MemoryPrePromotionCheckV1", 7),
            200,
            "id",
          ),
        "/v1/memory/feedback": memoryPostOperation(
          "submitMemoryDirectFeedbackV1",
          memoryUnionBranch("MemoryDirectFeedbackV1", 0),
          memoryUnionBranch("MemoryDirectFeedbackV1", 1),
        ),
        "/internal/memory/conflicts/{id}/resolve": memoryPostOperation(
          "resolveMemoryConflictV1",
          memoryUnionBranch("MemoryConflictV1", 0),
          memoryUnionBranch("MemoryConflictV1", 1),
          200,
          "id",
        ),
        "/internal/memory/integration/run": memoryPostOperation(
          "runMemoryIntegrationV1",
          memoryUnionBranch("MemoryIntegrationJobV1", 0),
          memoryUnionBranch("MemoryIntegrationJobV1", 1),
          202,
        ),
        "/internal/memory/association-graph/build": memoryPostOperation(
          "buildMemoryAssociationGraphV1",
          memoryUnionBranch("MemoryGraphBuildContractV1", 0),
          memoryUnionBranch("MemoryGraphBuildContractV1", 1),
        ),
        "/v1/memory/series/{id}": {
          get: {
            operationId: "queryMemorySeriesV1",
            security: [{ PaiWorkloadJwt: [] }],
            parameters: [
              {
                in: "path",
                name: "id",
                required: true,
                schema: memoryQuerySeriesRequest.properties.series_id,
              },
              ...Object.entries(memoryQuerySeriesRequest.properties)
                .filter(([name]) => name !== "series_id")
                .map(([name, schema]) => ({
                  in: "query",
                  name,
                  required: memoryQuerySeriesRequest.required.includes(name),
                  schema,
                })),
            ],
            responses: {
              200: {
                description: "Snapshot-bound independently paged series view",
                content: {
                  "application/json": { schema: memoryQuerySeriesResponse },
                },
              },
              403: { description: "Memory audit capability denied" },
              404: { description: "Series not found in authorized bot scope" },
              410: { description: "Series snapshot expired" },
              422: { description: "Query failed owner semantic validation" },
              503: { description: "Owner dependency unavailable" },
            },
          },
        },
      },
      components: {
        securitySchemes: internalSecuritySchemes,
        schemas: catalogComponents(memoryCatalog),
      },
    },
    null,
    2,
  )}\n`,
);

const knowThatCatalog = REGISTERED_OWNER_SCHEMA_CATALOG.filter(
  (entry) => entry.owner_service === "knowthat",
);
const knowThatWriteBatch = schemaByName.get("KnowThatWriteBatchV1");
if (
  knowThatWriteBatch?.anyOf?.[0] === undefined ||
  knowThatWriteBatch.anyOf[1] === undefined
) {
  throw new Error("KnowThatWriteBatchV1 request/response branches missing");
}
function knowThatPostOperation(
  operationId,
  requestSchema,
  responseSchema,
  pathParameter,
) {
  return {
    post: {
      operationId,
      security: [{ PaiWorkloadJwt: [] }],
      ...(pathParameter === undefined
        ? {}
        : {
            parameters: [
              {
                in: "path",
                name: pathParameter,
                required: true,
                schema: { type: "string", minLength: 1, maxLength: 512 },
              },
            ],
          }),
      requestBody: {
        required: true,
        content: { "application/json": { schema: requestSchema } },
      },
      responses: {
        200: {
          description: "Canonical KnowThat owner response",
          content: { "application/json": { schema: responseSchema } },
        },
        403: { description: "authorization_scope_mismatch" },
        404: { description: "owner entity not found in the authorized scope" },
        409: { description: "idempotency, version, or recovery conflict" },
        410: { description: "snapshot_expired" },
        413: { description: "payload_too_large" },
        422: { description: "schema or owner semantic validation failed" },
        503: { description: "owner dependency unavailable" },
      },
    },
  };
}
function knowThatFeedbackOperation() {
  const operation = knowThatPostOperation(
    "submitKnowThatFeedbackV1",
    schemaByName.get("KnowThatFeedbackRequestV1"),
    KnowThatFeedbackResponseV1Schema,
    "id",
  );
  const response = operation.post.responses[200];
  return {
    post: {
      ...operation.post,
      responses: {
        ...operation.post.responses,
        200: {
          ...response,
          description: "Canonical idempotent KnowThat feedback replay",
        },
        201: {
          ...response,
          description: "Canonical KnowThat feedback event created",
        },
      },
    },
  };
}
await emitGeneratedFile(
  resolve(packageRoot, "generated/openapi/knowthat.yaml"),
  `${JSON.stringify(
    {
      openapi: "3.1.0",
      info: { title: "PAI KnowThat API", version: "1.0.0" },
      paths: {
        "/internal/knowthat/write-batch": knowThatPostOperation(
          "writeKnowThatBatchV1",
          knowThatWriteBatch.anyOf[0],
          knowThatWriteBatch.anyOf[1],
        ),
        "/v1/knowthat/query": knowThatPostOperation(
          "queryKnowThatV1",
          schemaByName.get("KnowThatQueryRequestV1"),
          schemaByName.get("KnowThatQueryResponseV1"),
        ),
        "/v1/knowthat/facts/{id}/feedback": knowThatFeedbackOperation(),
        "/internal/knowthat/candidates/{id}/review": knowThatPostOperation(
          "reviewKnowThatCandidateV1",
          KnowThatCandidateReviewRequestV1Schema,
          schemaByName.get("CandidateReviewResult"),
          "id",
        ),
        "/internal/knowthat/linkage-jobs/{id}/recover": knowThatPostOperation(
          "recoverKnowThatLinkageV1",
          schemaByName.get("KnowThatLinkageRecoveryV1"),
          KnowThatLinkageRecoveryResponseV1Schema,
          "id",
        ),
      },
      components: {
        securitySchemes: internalSecuritySchemes,
        schemas: catalogComponents(knowThatCatalog),
      },
    },
    null,
    2,
  )}\n`,
);

const timerCatalog = REGISTERED_OWNER_SCHEMA_CATALOG.filter(
  (entry) => entry.owner_service === "timer-trigger-app",
);
const timerIdPathParameter = Object.freeze({
  in: "path",
  name: "id",
  required: true,
  schema: TimerIdPathParamsV1Schema.properties.id,
});

function timerQueryParameters(schema, includePathId) {
  const required = new Set(schema.required ?? []);
  return [
    ...(includePathId ? [timerIdPathParameter] : []),
    ...Object.entries(schema.properties).map(([name, propertySchema]) => ({
      in: "query",
      name,
      required: required.has(name),
      schema: propertySchema,
    })),
  ];
}

function timerOperation({
  operationId,
  method,
  caller,
  capability,
  requestSchema,
  responseSchema,
  includePathId = false,
  querySchema,
}) {
  const operation = {
    operationId,
    security: [{ PaiWorkloadJwt: [] }],
    "x-pai-allowed-caller": caller,
    "x-pai-required-capability": capability,
    ...((includePathId || querySchema !== undefined)
      ? {
          parameters:
            querySchema === undefined
              ? [timerIdPathParameter]
              : timerQueryParameters(querySchema, includePathId),
        }
      : {}),
    ...(requestSchema === undefined
      ? {}
      : {
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: requestSchema },
            },
          },
        }),
    responses: {
      200: {
        description: "Scope-bound Timer owner response",
        content: {
          "application/json": { schema: responseSchema },
        },
      },
      400: { description: "schema_validation_failed" },
      403: { description: "authorization_scope_mismatch" },
      404: { description: "schedule, occurrence, or batch not found" },
      409: { description: "idempotency, version, fence, cursor, or state conflict" },
      413: { description: "payload_too_large" },
      503: { description: "owner dependency unavailable" },
    },
  };
  return { [method]: operation };
}
await emitGeneratedFile(
  resolve(packageRoot, "generated/openapi/timer-trigger-app.yaml"),
  `${JSON.stringify(
    {
      openapi: "3.1.0",
      info: { title: "PAI Timer Trigger App API", version: "1.0.0" },
      paths: {
        "/internal/agent-timers": {
          post: timerOperation({
            operationId: "createTimerScheduleV1",
            method: "post",
            caller: "action_runtime",
            capability: "timer.write",
            requestSchema: TimerScheduleCreateCommandV1Schema,
            responseSchema: TimerScheduleCreateResponseV1Schema,
          }).post,
          get: timerOperation({
            operationId: "listTimerSchedulesV1",
            method: "get",
            caller: "action_runtime",
            capability: "timer.read",
            querySchema: TimerScheduleListQueryParamsV1Schema,
            responseSchema: TimerScheduleQueryResponseV1Schema,
          }).get,
        },
        "/internal/agent-timers/{id}": {
          patch: timerOperation({
            operationId: "updateTimerScheduleV1",
            method: "patch",
            caller: "action_runtime",
            capability: "timer.write",
            requestSchema: TimerScheduleUpdateCommandV1Schema,
            responseSchema: TimerScheduleUpdateResponseV1Schema,
            includePathId: true,
          }).patch,
          get: timerOperation({
            operationId: "getTimerScheduleV1",
            method: "get",
            caller: "action_runtime",
            capability: "timer.read",
            querySchema: TimerScheduleReadQueryParamsV1Schema,
            responseSchema: TimerScheduleQueryResponseV1Schema,
            includePathId: true,
          }).get,
        },
        "/internal/agent-timers/{id}/pause": timerOperation({
          operationId: "pauseTimerScheduleV1",
          method: "post",
          caller: "action_runtime",
          capability: "timer.write",
          requestSchema: TimerSchedulePauseCommandV1Schema,
          responseSchema: TimerSchedulePauseResponseV1Schema,
          includePathId: true,
        }),
        "/internal/agent-timers/{id}/resume": timerOperation({
          operationId: "resumeTimerScheduleV1",
          method: "post",
          caller: "action_runtime",
          capability: "timer.write",
          requestSchema: TimerScheduleResumeCommandV1Schema,
          responseSchema: TimerScheduleResumeResponseV1Schema,
          includePathId: true,
        }),
        "/internal/agent-timers/{id}/cancel": timerOperation({
          operationId: "cancelTimerScheduleV1",
          method: "post",
          caller: "action_runtime",
          capability: "timer.write",
          requestSchema: TimerScheduleCancelCommandV1Schema,
          responseSchema: TimerScheduleCancelResponseV1Schema,
          includePathId: true,
        }),
        "/internal/agent-timers/{id}/history": timerOperation({
          operationId: "getTimerScheduleHistoryV1",
          method: "get",
          caller: "action_runtime",
          capability: "timer.read",
          querySchema: TimerScheduleReadQueryParamsV1Schema,
          responseSchema: TimerScheduleQueryResponseV1Schema,
          includePathId: true,
        }),
        "/internal/timer-occurrences/{id}/snooze": timerOperation({
          operationId: "snoozeTimerOccurrenceV1",
          method: "post",
          caller: "action_runtime",
          capability: "timer.write",
          requestSchema: TimerOccurrenceSnoozeCommandV1Schema,
          responseSchema: TimerOccurrenceSnoozeResponseV1Schema,
          includePathId: true,
        }),
        "/internal/timers/scan-due": timerOperation({
          operationId: "scanDueTimerOccurrencesV1",
          method: "post",
          caller: "timer_trigger_app",
          capability: "timer.worker.scan",
          requestSchema: TimerScanDueRequestV1Schema,
          responseSchema: TimerScanDueResponseV1Schema,
        }),
        "/internal/timer-occurrences/{id}/claim": timerOperation({
          operationId: "claimTimerOccurrenceV1",
          method: "post",
          caller: "timer_trigger_app",
          capability: "timer.worker.dispatch",
          requestSchema: TimerOccurrenceClaimRequestV1Schema,
          responseSchema: TimerOccurrenceClaimResponseV1Schema,
          includePathId: true,
        }),
        "/internal/timer-occurrences/{id}/dispatch": timerOperation({
          operationId: "dispatchTimerOccurrenceV1",
          method: "post",
          caller: "timer_trigger_app",
          capability: "timer.worker.dispatch",
          requestSchema: TimerDispatchRequestV1Schema,
          responseSchema: TimerDispatchResponseV1Schema,
          includePathId: true,
        }),
        "/internal/timer-catch-up-batches": timerOperation({
          operationId: "createTimerCatchUpBatchV1",
          method: "post",
          caller: "timer_trigger_app",
          capability: "timer.worker.catch_up",
          requestSchema: TimerCatchUpCreateRequestV1Schema,
          responseSchema: TimerCatchUpCreateResponseV1Schema,
        }),
        "/internal/timer-catch-up-batches/{id}/advance": timerOperation({
          operationId: "advanceTimerCatchUpBatchV1",
          method: "post",
          caller: "timer_trigger_app",
          capability: "timer.worker.catch_up",
          requestSchema: TimerCatchUpAdvanceRequestV1Schema,
          responseSchema: TimerCatchUpAdvanceResponseV1Schema,
          includePathId: true,
        }),
      },
      components: {
        securitySchemes: internalSecuritySchemes,
        schemas: catalogComponents(timerCatalog),
      },
    },
    null,
    2,
  )}\n`,
);

const triggerProcessorDomainEventSchema = schemaByName.get(
  "TriggerProcessorDomainEventV1",
);
if (triggerProcessorDomainEventSchema === undefined) {
  throw new Error("TriggerProcessorDomainEventV1 missing from schema catalog");
}

const triggerProcessorAsyncApiPath = resolve(
  packageRoot,
  "generated/asyncapi/trigger-processor.yaml",
);
const triggerProcessorEventMessageName = (eventType) =>
  `TriggerProcessor${eventType
    .split(/[^a-z0-9]+/u)
    .filter(Boolean)
    .map((segment) => `${segment[0].toUpperCase()}${segment.slice(1)}`)
    .join("")}EventV1`;
await emitGeneratedFile(
  triggerProcessorAsyncApiPath,
  `${JSON.stringify(
    {
      asyncapi: "3.0.0",
      info: {
        title: "PAI Trigger Processor Domain Events",
        version: "1.0.0",
      },
      channels: Object.fromEntries(
        TRIGGER_PROCESSOR_DOMAIN_EVENT_TYPES_V1.map((eventType) => [
          `trigger_processor.${eventType}`,
          {
            address: `trigger_processor.${eventType}`,
            messages: {
              [triggerProcessorEventMessageName(eventType)]: {
                $ref: `#/components/messages/${triggerProcessorEventMessageName(eventType)}`,
              },
            },
            "x-pai-consumer-services":
              TRIGGER_PROCESSOR_DOMAIN_EVENT_CONSUMERS_V1[eventType],
          },
        ]),
      ),
      operations: Object.fromEntries(
        TRIGGER_PROCESSOR_DOMAIN_EVENT_TYPES_V1.map((eventType) => [
          `publish_${eventType.replace(/[^a-z0-9]+/gu, "_")}_v1`,
          {
            action: "send",
            channel: {
              $ref: `#/channels/trigger_processor.${eventType}`,
            },
          },
        ]),
      ),
      components: {
        messages: {
          ...Object.fromEntries(
            TRIGGER_PROCESSOR_DOMAIN_EVENT_TYPES_V1.map((eventType) => [
              triggerProcessorEventMessageName(eventType),
              {
                name: triggerProcessorEventMessageName(eventType),
                title: `Trigger Processor ${eventType} domain event envelope`,
                payload: TRIGGER_PROCESSOR_DOMAIN_EVENT_BRANCH_SCHEMAS_V1[
                  eventType
                ],
              },
            ]),
          ),
        },
      },
    },
    null,
    2,
  )}\n`,
);

await emitGeneratedFile(
  resolve(packageRoot, "generated/asyncapi/action-runtime.yaml"),
  `${JSON.stringify(
    {
      asyncapi: "3.0.0",
      info: { title: "PAI Action Runtime Domain Events", version: "1.0.0" },
      channels: Object.fromEntries(
        ACTION_RUNTIME_DOMAIN_EVENT_TYPES_V1.map((eventType) => [
          eventType,
          {
            address: eventType,
            messages: {
              [eventType]: { $ref: `#/components/messages/${eventType}` },
            },
            "x-pai-consumer-services": ["trigger_processor"],
          },
        ]),
      ),
      components: {
        messages: Object.fromEntries(
          ACTION_RUNTIME_DOMAIN_EVENT_TYPES_V1.map((eventType) => [
            eventType,
            { payload: ACTION_RUNTIME_DOMAIN_EVENT_BRANCH_SCHEMAS_V1[eventType] },
          ]),
        ),
      },
    },
    null,
    2,
  )}\n`,
);

await emitGeneratedFile(
  resolve(packageRoot, "generated/asyncapi/meta-cognition.yaml"),
  `${JSON.stringify(
    {
      asyncapi: "3.0.0",
      info: { title: "PAI Meta Cognition Domain Events", version: "1.0.0" },
      channels: Object.fromEntries(
        META_COGNITION_DOMAIN_EVENT_TYPES_V1.map((eventType) => [
          eventType,
          {
            address: eventType,
            messages: {
              [eventType]: { $ref: `#/components/messages/${eventType}` },
            },
            "x-pai-consumer-services":
              META_COGNITION_DOMAIN_EVENT_CONSUMERS_V1[eventType],
          },
        ]),
      ),
      components: {
        messages: Object.fromEntries(
          META_COGNITION_DOMAIN_EVENT_TYPES_V1.map((eventType) => [
            eventType,
            {
              payload:
                META_COGNITION_DOMAIN_EVENT_BRANCH_SCHEMAS_V1[eventType],
            },
          ]),
        ),
      },
    },
    null,
    2,
  )}\n`,
);

await emitGeneratedFile(
  resolve(packageRoot, "generated/asyncapi/skill-registry.yaml"),
  `${JSON.stringify(
    {
      asyncapi: "3.0.0",
      info: {
        title: "PAI Skill Registry Domain Events",
        version: SKILL_REGISTRY_DOMAIN_EVENT_CONTRACT_VERSION_V1,
      },
      channels: Object.fromEntries(
        SKILL_REGISTRY_DOMAIN_EVENT_TYPES_V1.map((eventType) => [
          eventType,
          {
            address: eventType,
            messages: {
              [eventType]: { $ref: `#/components/messages/${eventType}` },
            },
            "x-pai-consumer-services":
              SKILL_REGISTRY_DOMAIN_EVENT_CONSUMERS_V1[eventType],
          },
        ]),
      ),
      components: {
        messages: Object.fromEntries(
          SKILL_REGISTRY_DOMAIN_EVENT_TYPES_V1.map((eventType) => [
            eventType,
            {
              payload:
                SKILL_REGISTRY_DOMAIN_EVENT_BRANCH_SCHEMAS_V1[eventType],
            },
          ]),
        ),
      },
    },
    null,
    2,
  )}\n`,
);

await emitGeneratedFile(
  resolve(packageRoot, "generated/asyncapi/action-runtime-token-sse.yaml"),
  `${JSON.stringify(
    {
      asyncapi: "3.0.0",
      info: {
        title: "PAI Action Runtime Live Token SSE",
        version: "1.0.0",
      },
      channels: {
        runtime_token: {
          address: "/internal/runtime-runs/{runtime_run_id}/tokens",
          messages: {
            RuntimeTokenSseEventV1: {
              $ref: "#/components/messages/RuntimeTokenSseEventV1",
            },
          },
          "x-pai-durable": false,
          "x-pai-replay": false,
          "x-pai-sse-event-id": false,
        },
      },
      operations: {
        receive_runtime_token_v1: {
          action: "receive",
          channel: { $ref: "#/channels/runtime_token" },
        },
      },
      components: {
        messages: {
          RuntimeTokenSseEventV1: {
            name: "runtime_token",
            payload: schemaByName.get("RuntimeTokenSseEventV1"),
          },
        },
      },
    },
    null,
    2,
  )}\n`,
);

function declarationExportsFor(output, catalog) {
  const sources = new Set(
    catalog
      .filter((entry) => entry.generated_outputs.includes(output))
      .map((entry) => entry.source_file),
  );
  return [
    ...[...sources]
      .sort()
      .map((source) => {
        const distModule = source
          .replace(/^packages\/contracts\/src\//, "../../dist/")
          .replace(/\.ts$/, ".js");
        return `export * from "${distModule}";`;
      }),
    "",
  ].join("\n");
}

const typesPath = resolve(packageRoot, "generated/types/shared.d.ts");
await emitGeneratedFile(
  typesPath,
  declarationExportsFor("generated/types/shared.d.ts", SHARED_SCHEMA_CATALOG),
);

const triggerProcessorTypesPath = resolve(
  packageRoot,
  "generated/types/trigger-processor.d.ts",
);
await emitGeneratedFile(
  triggerProcessorTypesPath,
  declarationExportsFor(
    "generated/types/trigger-processor.d.ts",
    TRIGGER_PROCESSOR_SCHEMA_CATALOG,
  ),
);

const triggerProcessorEventTypesPath = resolve(
  packageRoot,
  "generated/types/trigger-processor-events.d.ts",
);
await emitGeneratedFile(
  triggerProcessorEventTypesPath,
  declarationExportsFor(
    "generated/types/trigger-processor-events.d.ts",
    TRIGGER_PROCESSOR_SCHEMA_CATALOG,
  ),
);

await emitGeneratedFile(
  resolve(packageRoot, "generated/types/action-runtime.d.ts"),
  declarationExportsFor(
    "generated/types/action-runtime.d.ts",
    REGISTERED_OWNER_SCHEMA_CATALOG,
  ),
);
await emitGeneratedFile(
  resolve(packageRoot, "generated/types/action-runtime-events.d.ts"),
  declarationExportsFor(
    "generated/types/action-runtime-events.d.ts",
    REGISTERED_OWNER_SCHEMA_CATALOG,
  ),
);
await emitGeneratedFile(
  resolve(packageRoot, "generated/types/meta.d.ts"),
  declarationExportsFor(
    "generated/types/meta.d.ts",
    REGISTERED_OWNER_SCHEMA_CATALOG,
  ),
);
await emitGeneratedFile(
  resolve(packageRoot, "generated/types/meta-cognition-events.d.ts"),
  declarationExportsFor(
    "generated/types/meta-cognition-events.d.ts",
    REGISTERED_OWNER_SCHEMA_CATALOG,
  ),
);
await emitGeneratedFile(
  resolve(packageRoot, "generated/types/memory.d.ts"),
  declarationExportsFor(
    "generated/types/memory.d.ts",
    REGISTERED_OWNER_SCHEMA_CATALOG,
  ),
);
await emitGeneratedFile(
  resolve(packageRoot, "generated/types/knowthat.d.ts"),
  declarationExportsFor(
    "generated/types/knowthat.d.ts",
    REGISTERED_OWNER_SCHEMA_CATALOG,
  ),
);
await emitGeneratedFile(
  resolve(packageRoot, "generated/types/timer.d.ts"),
  declarationExportsFor(
    "generated/types/timer.d.ts",
    REGISTERED_OWNER_SCHEMA_CATALOG,
  ),
);
await emitGeneratedFile(
  resolve(packageRoot, "generated/types/skill-registry.d.ts"),
  declarationExportsFor(
    "generated/types/skill-registry.d.ts",
    REGISTERED_OWNER_SCHEMA_CATALOG,
  ),
);
await emitGeneratedFile(
  resolve(packageRoot, "generated/types/skill-registry-management.d.ts"),
  declarationExportsFor(
    "generated/types/skill-registry-management.d.ts",
    REGISTERED_OWNER_SCHEMA_CATALOG,
  ),
);
await emitGeneratedFile(
  resolve(packageRoot, "generated/types/skill-registry-events.d.ts"),
  declarationExportsFor(
    "generated/types/skill-registry-events.d.ts",
    REGISTERED_OWNER_SCHEMA_CATALOG,
  ),
);

const policyTypesPath = resolve(packageRoot, "generated/types/shared-policy.d.ts");
await emitGeneratedFile(
  policyTypesPath,
  declarationExportsFor(
    "generated/types/shared-policy.d.ts",
    SHARED_SCHEMA_CATALOG,
  ),
);

const authTypesPath = resolve(packageRoot, "generated/types/shared-auth.d.ts");
await emitGeneratedFile(
  authTypesPath,
  declarationExportsFor(
    "generated/types/shared-auth.d.ts",
    SHARED_SCHEMA_CATALOG,
  ),
);

const triggerProcessCheckPath = resolve(
  packageRoot,
  "generated/sql/trigger-processor/trigger-process-state.v1.check.sql",
);
await emitGeneratedFile(
  triggerProcessCheckPath,
  `${TRIGGER_PROCESS_STATE_V1_DATABASE_CHECK.trim()}\n`,
);

const triggerProcessorEventCheckPath = resolve(
  packageRoot,
  "generated/db/trigger-processor-event-check.sql",
);
await emitGeneratedFile(
  triggerProcessorEventCheckPath,
  `${TRIGGER_PROCESSOR_DOMAIN_EVENT_V1_DATABASE_CHECK.trim()}\n`,
);

await emitGeneratedFile(
  resolve(packageRoot, "generated/db/trigger-processor-command-check.sql"),
  `${TRIGGER_PROCESSOR_COMMAND_V1_DATABASE_CHECK.trim()}\n`,
);
await emitGeneratedFile(
  resolve(
    packageRoot,
    "generated/db/trigger-processor-terminal-outcome-check.sql",
  ),
  `${TERMINAL_OUTCOME_V1_DATABASE_CHECK}\n`,
);
await emitGeneratedFile(
  resolve(packageRoot, "generated/db/skill-registry-event-check.sql"),
  `${SKILL_REGISTRY_DOMAIN_EVENT_V1_DATABASE_CHECK.trim()}\n`,
);
await emitGeneratedFile(
  resolve(packageRoot, "generated/db/skill-registry-permission-summary.sql"),
  `CREATE TABLE skill_registry.skill_permission_summary_snapshots (
  summary_ref text PRIMARY KEY,
  schema_version text NOT NULL
    CONSTRAINT skill_permission_summary_snapshots_schema_version_check
    CHECK (schema_version = 'skill_permission_summary.v1'),
  workspace_id text NOT NULL,
  bot_id text NOT NULL,
  owner_agent_id text NOT NULL,
  deployment_environment text NOT NULL
    CONSTRAINT skill_permission_summary_snapshots_environment_check
    CHECK (deployment_environment IN ('local', 'dev', 'staging', 'prod')),
  release_channel text NOT NULL
    CONSTRAINT skill_permission_summary_snapshots_channel_check
    CHECK (release_channel IN ('stable', 'canary')),
  catalog_revision_id text NOT NULL,
  catalog_version text NOT NULL,
  catalog_as_of timestamptz NOT NULL,
  security_revocation_epoch bigint NOT NULL
    CONSTRAINT skill_permission_summary_snapshots_security_epoch_check
    CHECK (security_revocation_epoch BETWEEN 0 AND 9007199254740991),
  canonical_bytes bytea NOT NULL
    CONSTRAINT skill_permission_summary_snapshots_canonical_bytes_check
    CHECK (octet_length(canonical_bytes) > 0),
  summary_hash text NOT NULL
    CONSTRAINT skill_permission_summary_snapshots_summary_hash_check
    CHECK (summary_hash ~ '^sha256:[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT skill_permission_summary_snap_catalog_revision_id_workspac_fkey
    FOREIGN KEY (catalog_revision_id, workspace_id, bot_id, deployment_environment, release_channel)
    REFERENCES skill_registry.skill_catalog_revisions
      (id, workspace_id, bot_id, deployment_environment, release_channel),
  CONSTRAINT skill_permission_summary_snapshots_scope_catalog_key
    UNIQUE (workspace_id, bot_id, owner_agent_id, deployment_environment, release_channel, catalog_revision_id),
  CONSTRAINT skill_permission_summary_snapshots_ref_hash_key
    UNIQUE (summary_ref, summary_hash)
);

CREATE TABLE skill_registry.skill_permission_summary_entries (
  summary_ref text NOT NULL,
  ordinal bigint NOT NULL
    CONSTRAINT skill_permission_summary_entries_ordinal_check
    CHECK (ordinal BETWEEN 1 AND 9007199254740991),
  skill_id text NOT NULL,
  skill_key text NOT NULL,
  activation_revision_id text NOT NULL,
  version_id text NOT NULL,
  decision text NOT NULL
    CONSTRAINT skill_permission_summary_entries_decision_check
    CHECK (decision IN ('grant', 'deny')),
  decision_source text NOT NULL
    CONSTRAINT skill_permission_summary_entries_decision_source_check
    CHECK (decision_source IN ('revision', 'default_deny')),
  permission_revision_id text,
  revision_no bigint
    CONSTRAINT skill_permission_summary_entries_revision_no_check
    CHECK (revision_no BETWEEN 1 AND 9007199254740991),
  scope_hash text
    CONSTRAINT skill_permission_summary_entries_scope_hash_check
    CHECK (scope_hash ~ '^sha256:[0-9a-f]{64}$'),
  owner_agent_condition text,
  capability_refs text[] NOT NULL DEFAULT '{}'::text[]
    CONSTRAINT skill_permission_summary_entries_capability_refs_check
    CHECK (
      cardinality(capability_refs) <= 1024
      AND array_position(capability_refs, NULL) IS NULL
    ),
  CONSTRAINT skill_permission_summary_entries_pkey
    PRIMARY KEY (summary_ref, skill_id),
  CONSTRAINT skill_permission_summary_entries_summary_ordinal_key
    UNIQUE (summary_ref, ordinal),
  CONSTRAINT skill_permission_summary_entries_summary_ref_fkey
    FOREIGN KEY (summary_ref)
    REFERENCES skill_registry.skill_permission_summary_snapshots (summary_ref)
    ON DELETE RESTRICT,
  CONSTRAINT skill_permission_summary_entries_skill_id_fkey
    FOREIGN KEY (skill_id)
    REFERENCES skill_registry.skills (id),
  CONSTRAINT skill_permission_summary_entries_branch_check CHECK (
    (
      decision_source = 'revision'
      AND permission_revision_id IS NOT NULL
      AND revision_no IS NOT NULL
      AND scope_hash IS NOT NULL
    )
    OR
    (
      decision_source = 'default_deny'
      AND decision = 'deny'
      AND permission_revision_id IS NULL
      AND revision_no IS NULL
      AND scope_hash IS NULL
      AND owner_agent_condition IS NULL
      AND cardinality(capability_refs) = 0
    )
  )
);

CREATE FUNCTION skill_registry.reject_skill_permission_summary_mutation_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
PARALLEL UNSAFE
SET search_path = skill_registry, pg_temp
AS $body$
${SKILL_PERMISSION_SUMMARY_IMMUTABLE_TRIGGER_FUNCTION_BODY_V1}
$body$;

REVOKE ALL ON FUNCTION skill_registry.reject_skill_permission_summary_mutation_v1()
FROM PUBLIC;

CREATE TRIGGER skill_permission_summary_snapshots_immutable
BEFORE UPDATE OR DELETE ON skill_registry.skill_permission_summary_snapshots
FOR EACH ROW EXECUTE FUNCTION skill_registry.reject_skill_permission_summary_mutation_v1();

CREATE TRIGGER skill_permission_summary_entries_immutable
BEFORE UPDATE OR DELETE ON skill_registry.skill_permission_summary_entries
FOR EACH ROW EXECUTE FUNCTION skill_registry.reject_skill_permission_summary_mutation_v1();
`,
);

const skillPermissionSummaryGolden = {
  schema_version: "skill_permission_summary.v1",
  summary_ref: "summary:fixture:1",
  workspace_id: "workspace_01",
  bot_id: "bot_01",
  owner_agent_id: "agent_01",
  deployment_environment: "prod",
  release_channel: "stable",
  catalog_revision_id: "catalog_revision_01",
  catalog_version: "cat_184",
  catalog_as_of: "2026-07-13T12:00:00.000Z",
  security_revocation_epoch: 1,
  entries: [],
  summary_hash: `sha256:${"0".repeat(64)}`,
};
await emitGeneratedFile(
  resolve(
    packageRoot,
    "generated/fixtures/skill-registry/skill-permission-summary.v1.canonical.json",
  ),
  `${skillPermissionSummaryCanonicalBytesV1(skillPermissionSummaryGolden)}\n`,
);

await emitGeneratedFile(
  resolve(
    packageRoot,
    "generated/fixtures/meta/feedback-dedupe-scope-ref.v1.json",
  ),
  `${JSON.stringify(
    [
      { kind: "conflict", ref: "conflict:fixture-1" },
      { kind: "candidate", ref: "candidate:fixture-1" },
      { kind: "schedule", ref: "schedule:fixture-1" },
    ],
    null,
    2,
  )}\n`,
);

const policyFixtures = [
  [
    "generated/fixtures/policy/conflict-policy.v1.truth-table.json",
    [
      evaluateConflictPolicyV1({
        leftDomain: "project_decision",
        rightDomain: "project_decision",
        sameActorScope: true,
        authorityGatePassed: true,
        leftSource: "approved_artifact",
        rightSource: "agent_observation",
        leftConfidence: 0.7,
        rightConfidence: 0.9,
      }),
      evaluateConflictPolicyV1({
        leftDomain: "unclassified",
        rightDomain: "unclassified",
        sameActorScope: true,
        authorityGatePassed: true,
        leftSource: "explicit_feedback",
        rightSource: "meta_inference",
        leftConfidence: 1,
        rightConfidence: 1,
      }),
    ],
  ],
  [
    "generated/fixtures/policy/direct-active-policy.v1.truth-table.json",
    [
      evaluateDirectActivePolicyV1({
        proposedStatus: "active",
        directActiveHint: true,
        riskLevel: "low",
        evidencePending: false,
        explicitness: "explicit_statement",
        confidence: 0.9,
        sourceAndEvidenceValid: true,
        hasOpenConflict: false,
        categoryGatePassed: true,
        validityGatePassed: true,
        category: "project_fact",
        ruleAllowlisted: false,
        changesProtectedBoundary: false,
      }),
      evaluateDirectActivePolicyV1({
        proposedStatus: "active",
        directActiveHint: true,
        riskLevel: "low",
        evidencePending: false,
        explicitness: "strong_implication",
        confidence: 1,
        sourceAndEvidenceValid: true,
        hasOpenConflict: false,
        categoryGatePassed: true,
        validityGatePassed: true,
        category: "project_fact",
        ruleAllowlisted: false,
        changesProtectedBoundary: false,
      }),
    ],
  ],
];

for (const [relativePath, fixtures] of policyFixtures) {
  const outputPath = resolve(packageRoot, relativePath);
  await emitGeneratedFile(outputPath, `${JSON.stringify(fixtures, null, 2)}\n`);
}

const validWorkloadCredentialFixture = {
  iss: "pai-workload",
  sub: "trigger_processor",
  aud: "action_runtime",
  jti: "jti_fixture_01",
  iat: 100,
  nbf: 100,
  exp: 400,
  capability: ["runtime.read", "runtime.start"],
  scope_kind: "bot",
  workspace_id: "workspace_01",
  bot_id: "bot_01",
  owner_agent_id: "agent_01",
  deployment_environment: "dev",
  release_channel: "stable",
};
const validDelegatedPrincipalFixture = {
  principal_type: "developer",
  principal_id: "developer_01",
  roles: ["developer"],
  source_issuer: "supabase",
  source_subject: "user_01",
  auth_time: 100,
  scope_kind: "bot",
  workspace_id: "workspace_01",
  bot_id: "bot_01",
  owner_agent_id: "agent_01",
  deployment_environment: "dev",
  release_channel: "stable",
};
const workloadCredentialFixtures = {
  valid_bot_scope: validWorkloadCredentialFixture,
  invalid_array_audience: {
    ...validWorkloadCredentialFixture,
    aud: ["action_runtime"],
  },
  invalid_service_alias: {
    ...validWorkloadCredentialFixture,
    sub: "trigger-processor",
  },
};
const delegatedPrincipalFixtures = {
  valid_bot_scope: validDelegatedPrincipalFixture,
  invalid_unsigned_sidecar: {
    ...validDelegatedPrincipalFixture,
    unsigned_sidecar: true,
  },
  invalid_scope_drift: {
    ...validDelegatedPrincipalFixture,
    bot_id: "bot_02",
  },
  invalid_principal_type: {
    ...validDelegatedPrincipalFixture,
    principal_type: "service",
  },
};

if (!validateWorkloadCredentialClaimsV1(validWorkloadCredentialFixture).ok) {
  throw new Error("generated valid workload credential fixture is invalid");
}
for (const [name, fixture] of Object.entries(workloadCredentialFixtures)) {
  if (
    name.startsWith("invalid_") &&
    validateWorkloadCredentialClaimsV1(fixture).ok
  ) {
    throw new Error(`generated invalid workload credential fixture passed: ${name}`);
  }
}
for (const [name, principal] of Object.entries(delegatedPrincipalFixtures)) {
  const result = validateWorkloadCredentialClaimsV1({
    ...validWorkloadCredentialFixture,
    delegated_principal: principal,
  });
  if ((name === "valid_bot_scope") !== result.ok) {
    throw new Error(`generated delegated principal fixture polarity drift: ${name}`);
  }
}

const authFixtureDirectory = resolve(packageRoot, "generated/fixtures/auth");
await emitGeneratedFile(
  resolve(authFixtureDirectory, "workload-credential-claims.v1.json"),
  `${JSON.stringify(workloadCredentialFixtures, null, 2)}\n`,
);
await emitGeneratedFile(
  resolve(authFixtureDirectory, "delegated-principal-context.v1.json"),
  `${JSON.stringify(delegatedPrincipalFixtures, null, 2)}\n`,
);

if (checkMode) {
  const generatedRoot = resolve(packageRoot, "generated");
  driftedOutputs.push(
    ...(await findUnexpectedGeneratedFiles(generatedRoot, expectedOutputs)),
  );
  if (driftedOutputs.length > 0) {
    const uniqueOutputs = [...new Set(driftedOutputs)].sort();
    console.error(
      `generated contract drift detected:\n${uniqueOutputs.map((output) => `- ${output}`).join("\n")}\nRun pnpm --filter @pai/contracts build and commit the generated outputs.`,
    );
    process.exitCode = 1;
  }
}
