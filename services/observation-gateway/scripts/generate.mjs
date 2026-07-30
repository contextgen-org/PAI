import {
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { RuntimeTokenSseEventV1Schema } from "@pai/contracts";

import {
  OBSERVATION_HTTP_OPERATIONS_V1,
  OBSERVATION_OWNER_SCHEMA_CATALOG_V1,
  OBSERVATION_ROUTES_V1,
  observationOwnerSchemaV1,
} from "../dist/catalog.v1.js";
import {
  ObservationMetaDetailsResponseV1Schema,
  ObservationRuntimeDetailsResponseV1Schema,
} from "../dist/contracts/observation.v1.js";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const checkMode = process.argv.includes("--check");
const expectedOutputs = new Set(
  OBSERVATION_OWNER_SCHEMA_CATALOG_V1.flatMap((entry) =>
    entry.generated_outputs,
  ),
);
const driftedOutputs = [];

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function emitGeneratedFile(relativePath, content) {
  if (!expectedOutputs.has(relativePath)) {
    throw new Error(`unregistered generated output: ${relativePath}`);
  }
  const outputPath = resolve(packageRoot, relativePath);
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

function inlineSchema(schema) {
  const copy = structuredClone(schema);
  const visit = (value) => {
    if (typeof value !== "object" || value === null) return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    delete value.$id;
    Object.values(value).forEach(visit);
  };
  visit(copy);
  return copy;
}

function openApiPath(path) {
  return path.replace(/:([a-z_][a-z0-9_]*)/giu, "{$1}");
}

function pathParameters(path) {
  return [...path.matchAll(/:([a-z_][a-z0-9_]*)/giu)].map((match) => ({
    name: match[1],
    in: "path",
    required: true,
    schema: { type: "string", minLength: 1, maxLength: 512 },
  }));
}

const schemaByName = new Map(
  OBSERVATION_OWNER_SCHEMA_CATALOG_V1.map((entry) => [
    entry.schema_name,
    observationOwnerSchemaV1(entry),
  ]),
);

function responseSchema(operation) {
  if (operation.response_schema_name !== null) {
    return {
      $ref: `#/components/schemas/${operation.response_schema_name}`,
    };
  }
  if (operation.path === OBSERVATION_ROUTES_V1.runtimeDetails) {
    return inlineSchema(ObservationRuntimeDetailsResponseV1Schema);
  }
  if (operation.path === OBSERVATION_ROUTES_V1.metaDetails) {
    return inlineSchema(ObservationMetaDetailsResponseV1Schema);
  }
  return { type: "string" };
}

function queryParameters(operation) {
  if (operation.path === OBSERVATION_ROUTES_V1.events) {
    return [
      {
        name: "Last-Event-ID",
        in: "header",
        required: false,
        schema: { type: "string", minLength: 1, maxLength: 512 },
      },
      {
        name: "include_ephemeral_tokens",
        in: "query",
        required: false,
        schema: { type: "boolean", default: false },
      },
      {
        name: "runtime_run_id",
        in: "query",
        required: false,
        schema: { type: "string", minLength: 1, maxLength: 512 },
      },
    ];
  }
  if (operation.path === OBSERVATION_ROUTES_V1.toolInvocations) {
    return [
      {
        name: "runtime_run_id",
        in: "query",
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
    ];
  }
  if (operation.path === OBSERVATION_ROUTES_V1.qualitySignals) {
    return [
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
    ];
  }
  return [];
}

function openApiOperation(operation) {
  const streaming = operation.transport === "sse";
  return {
    operationId: operation.operation_id,
    tags: ["observation_gateway"],
    security: [{ PaiWorkloadJwt: [] }],
    "x-pai-allowed-callers": operation.allowed_callers,
    "x-pai-required-capability": operation.required_capability,
    ...(streaming
      ? {
          "x-pai-asyncapi-channel":
            "../asyncapi/observation-gateway-sse.yaml#/channels/observation_process_events",
        }
      : {}),
    parameters: [
      ...pathParameters(operation.path),
      ...queryParameters(operation),
    ],
    responses: {
      200: {
        description: streaming
          ? "Authorized Observation SSE stream"
          : "Authorized redacted Observation response",
        content: {
          [streaming ? "text/event-stream" : "application/json"]: {
            schema: responseSchema(operation),
          },
        },
      },
      400: { description: "invalid_request" },
      401: { description: "unauthenticated" },
      403: { description: "bot_permission_denied" },
      404: { description: "process_not_found" },
      409: { description: "runtime_run_mismatch" },
      410: { description: "replay_expired" },
      429: { description: "rate_limited" },
      502: { description: "upstream_schema_mismatch" },
      503: { description: "upstream_unavailable or audit_unavailable" },
    },
  };
}

for (const entry of OBSERVATION_OWNER_SCHEMA_CATALOG_V1) {
  const output = entry.generated_outputs.find((candidate) =>
    candidate.startsWith("generated/schema/"),
  );
  if (output === undefined) {
    throw new Error(`${entry.schema_name} has no JSON Schema output`);
  }
  await emitGeneratedFile(output, json(observationOwnerSchemaV1(entry)));
}

await emitGeneratedFile(
  "generated/openapi/observation-gateway.openapi.json",
  json({
    openapi: "3.1.0",
    info: {
      title: "PAI Observation Gateway Internal API",
      version: "1.0.0",
    },
    paths: Object.fromEntries(
      OBSERVATION_HTTP_OPERATIONS_V1.map((operation) => [
        openApiPath(operation.path),
        {
          [operation.method.toLowerCase()]:
            openApiOperation(operation),
        },
      ]),
    ),
    components: {
      securitySchemes: {
        PaiWorkloadJwt: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: Object.fromEntries(
        OBSERVATION_OWNER_SCHEMA_CATALOG_V1.map((entry) => [
          entry.schema_name,
          observationOwnerSchemaV1(entry),
        ]),
      ),
    },
  }),
);

await emitGeneratedFile(
  "generated/asyncapi/observation-gateway-sse.yaml",
  json({
    asyncapi: "3.0.0",
    info: {
      title: "PAI Observation Gateway SSE",
      version: "1.0.0",
    },
    channels: {
      observation_process_events: {
        address: openApiPath(OBSERVATION_ROUTES_V1.events),
        parameters: {
          id: {
            description: "Authorized Trigger Process identifier",
          },
        },
        messages: {
          ObservationSnapshotResponse: {
            $ref: "#/components/messages/ObservationSnapshotResponse",
          },
          ObservationEvent: {
            $ref: "#/components/messages/ObservationEvent",
          },
          ObservationSseControlV1: {
            $ref: "#/components/messages/ObservationSseControlV1",
          },
          ObservationSseError: {
            $ref: "#/components/messages/ObservationSseError",
          },
          RuntimeTokenSseEventV1: {
            $ref: "#/components/messages/RuntimeTokenSseEventV1",
          },
        },
        "x-pai-allowed-callers":
          OBSERVATION_HTTP_OPERATIONS_V1.find(
            (operation) =>
              operation.path === OBSERVATION_ROUTES_V1.events,
          ).allowed_callers,
        "x-pai-required-capability": "observation.read",
        "x-pai-last-event-id-owner": "trigger_processor",
      },
    },
    operations: {
      sendObservationProcessEventsV1: {
        action: "send",
        channel: {
          $ref: "#/channels/observation_process_events",
        },
      },
    },
    components: {
      messages: {
        ObservationSnapshotResponse: {
          name: "observation.snapshot",
          payload: schemaByName.get("ObservationSnapshotResponse"),
          "x-pai-durable": false,
          "x-pai-sse-event-id": false,
        },
        ObservationEvent: {
          name: "observation.event",
          payload: schemaByName.get("ObservationEvent"),
          "x-pai-durable": true,
          "x-pai-sse-event-id":
            "{trigger_process_id}:{append_sequence_no}",
          "x-pai-replay": "Last-Event-ID",
        },
        ObservationSseControlV1: {
          name: "observation.degraded",
          payload: schemaByName.get("ObservationSseControlV1"),
          "x-pai-durable": false,
          "x-pai-sse-event-id": false,
        },
        ObservationSseError: {
          name: "observation.error",
          payload: schemaByName.get("ObservationSseError"),
          "x-pai-durable": false,
          "x-pai-sse-event-id": false,
        },
        RuntimeTokenSseEventV1: {
          name: "runtime_token",
          payload: RuntimeTokenSseEventV1Schema,
          "x-pai-owner-service": "action-runtime",
          "x-pai-durable": false,
          "x-pai-sse-event-id": false,
          "x-pai-replay": false,
          "x-pai-persistence": false,
        },
      },
    },
  }),
);

await emitGeneratedFile(
  "generated/types/observation-gateway.d.ts",
  [
    "export {",
    "  ObservationEventV1Schema,",
    "  ObservationQualitySignalListV1Schema,",
    "  ObservationSnapshotResponseV1Schema,",
    "  ObservationSseControlV1Schema,",
    "  ObservationSseErrorV1Schema,",
    "  ObservationToolInvocationListV1Schema,",
    "  type ObservationEventV1,",
    "  type ObservationQualitySignalListV1,",
    "  type ObservationSnapshotResponseV1,",
    "  type ObservationSseControlV1,",
    "  type ObservationSseErrorV1,",
    "  type ObservationToolInvocationListV1,",
    '} from "../../dist/contracts/observation.v1.js";',
    "",
  ].join("\n"),
);

async function generatedFiles(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
  const files = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await generatedFiles(path)));
    } else if (entry.isFile()) {
      files.push(relative(packageRoot, path));
    }
  }
  return files;
}

const unexpectedOutputs = (await generatedFiles(
  resolve(packageRoot, "generated"),
)).filter((output) => !expectedOutputs.has(output));

if (checkMode && (driftedOutputs.length > 0 || unexpectedOutputs.length > 0)) {
  throw new Error(
    [
      ...(driftedOutputs.length === 0
        ? []
        : [`drifted/missing: ${driftedOutputs.sort().join(", ")}`]),
      ...(unexpectedOutputs.length === 0
        ? []
        : [`unexpected: ${unexpectedOutputs.sort().join(", ")}`]),
    ].join("; "),
  );
}

if (!checkMode && unexpectedOutputs.length > 0) {
  throw new Error(
    `unexpected generated outputs: ${unexpectedOutputs.sort().join(", ")}`,
  );
}
