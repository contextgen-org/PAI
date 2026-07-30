import type { ServiceIdV1 } from "@pai/contracts";
import type { TSchema } from "@sinclair/typebox";

import {
  ObservationEventV1Schema,
  ObservationQualitySignalListV1Schema,
  ObservationSnapshotResponseV1Schema,
  ObservationSseControlV1Schema,
  ObservationSseErrorV1Schema,
  ObservationToolInvocationListV1Schema,
} from "./contracts/observation.v1.js";

export const OBSERVATION_ROUTES_V1 = Object.freeze({
  snapshot: "/internal/observation/trigger-processes/:id",
  events: "/internal/observation/trigger-processes/:id/events",
  toolInvocations:
    "/internal/observation/trigger-processes/:id/tool-invocations",
  qualitySignals:
    "/internal/observation/trigger-processes/:id/quality-signals",
  runtimeDetails:
    "/internal/observation/trigger-processes/:trigger_process_id/runtime-runs/:runtime_run_id",
  metaDetails:
    "/internal/observation/trigger-processes/:trigger_process_id/meta/jobs/:meta_job_id",
} as const);

export const OBSERVATION_SCHEMA_CATALOG_COLUMNS_V1 = Object.freeze([
  "schema_name",
  "schema_id",
  "version",
  "owner_service",
  "source_file",
  "generated_outputs",
  "contract_tests",
] as const);

export interface ObservationOwnerSchemaCatalogEntryV1 {
  readonly schema_name:
    | "ObservationSnapshotResponse"
    | "ObservationEvent"
    | "ObservationSseControlV1"
    | "ObservationSseError"
    | "ObservationToolInvocationList"
    | "ObservationQualitySignalList";
  readonly schema_id:
    | "observation.snapshot.response"
    | "observation.event"
    | "observation.sse.control"
    | "observation.sse.error"
    | "observation.tool-invocation.list"
    | "observation.quality-signal.list";
  readonly version: "1.0.0";
  readonly owner_service: "observation-gateway";
  readonly source_file: "services/observation-gateway/src/contracts/observation.v1.ts";
  readonly generated_outputs: readonly string[];
  readonly contract_tests: readonly [
    "services/observation-gateway/test/observation-contract-generation.test.mjs",
  ];
}

const ownerSchemaByEntry = new WeakMap<
  ObservationOwnerSchemaCatalogEntryV1,
  TSchema
>();
const sourceFile =
  "services/observation-gateway/src/contracts/observation.v1.ts" as const;
const contractTests = Object.freeze([
  "services/observation-gateway/test/observation-contract-generation.test.mjs",
] as const);
const openApiOutput =
  "generated/openapi/observation-gateway.openapi.json";
const asyncApiOutput =
  "generated/asyncapi/observation-gateway-sse.yaml";
const typesOutput = "generated/types/observation-gateway.d.ts";
// The architecture intentionally has no generic internal caller here. A
// deployment must bind the concrete ingress service at composition time;
// publishing every registered service as an allowed caller would turn the
// shared service registry into an observation authorization wildcard.
const allowedCallers = Object.freeze([] as ServiceIdV1[]);

function ownerSchema(
  schema_name: ObservationOwnerSchemaCatalogEntryV1["schema_name"],
  schema_id: ObservationOwnerSchemaCatalogEntryV1["schema_id"],
  schemaOutput: string,
  schema: TSchema,
  includeAsyncApi: boolean,
): ObservationOwnerSchemaCatalogEntryV1 {
  if (schema.$id !== schema_id) {
    throw new Error(
      `${schema_name} schema id ${String(schema.$id)} does not match ${schema_id}`,
    );
  }
  const entry: ObservationOwnerSchemaCatalogEntryV1 = Object.freeze({
    schema_name,
    schema_id,
    version: "1.0.0",
    owner_service: "observation-gateway",
    source_file: sourceFile,
    generated_outputs: Object.freeze([
      schemaOutput,
      openApiOutput,
      ...(includeAsyncApi ? [asyncApiOutput] : []),
      typesOutput,
    ]),
    contract_tests: contractTests,
  });
  ownerSchemaByEntry.set(entry, schema);
  return entry;
}

export const OBSERVATION_OWNER_SCHEMA_CATALOG_V1 = Object.freeze([
  ownerSchema(
    "ObservationSnapshotResponse",
    "observation.snapshot.response",
    "generated/schema/observation-snapshot-response.v1.json",
    ObservationSnapshotResponseV1Schema,
    true,
  ),
  ownerSchema(
    "ObservationEvent",
    "observation.event",
    "generated/schema/observation-event.v1.json",
    ObservationEventV1Schema,
    true,
  ),
  ownerSchema(
    "ObservationSseControlV1",
    "observation.sse.control",
    "generated/schema/observation-sse-control.v1.json",
    ObservationSseControlV1Schema,
    true,
  ),
  ownerSchema(
    "ObservationSseError",
    "observation.sse.error",
    "generated/schema/observation-sse-error.v1.json",
    ObservationSseErrorV1Schema,
    true,
  ),
  ownerSchema(
    "ObservationToolInvocationList",
    "observation.tool-invocation.list",
    "generated/schema/observation-tool-invocation-list.v1.json",
    ObservationToolInvocationListV1Schema,
    false,
  ),
  ownerSchema(
    "ObservationQualitySignalList",
    "observation.quality-signal.list",
    "generated/schema/observation-quality-signal-list.v1.json",
    ObservationQualitySignalListV1Schema,
    false,
  ),
] as const satisfies readonly ObservationOwnerSchemaCatalogEntryV1[]);

export function observationOwnerSchemaV1(
  entry: ObservationOwnerSchemaCatalogEntryV1,
): TSchema {
  const schema = ownerSchemaByEntry.get(entry);
  if (schema === undefined) {
    throw new Error("unknown Observation owner schema catalog entry");
  }
  return schema;
}

export interface ObservationHttpOperationV1 {
  readonly operation_id: string;
  readonly method: "GET";
  readonly path: (typeof OBSERVATION_ROUTES_V1)[keyof typeof OBSERVATION_ROUTES_V1];
  readonly transport: "http" | "sse";
  readonly required_capability: "observation.read";
  readonly allowed_callers: readonly ServiceIdV1[];
  readonly response_schema_name:
    | ObservationOwnerSchemaCatalogEntryV1["schema_name"]
    | null;
}

function operation(
  operation_id: string,
  path: ObservationHttpOperationV1["path"],
  transport: ObservationHttpOperationV1["transport"],
  response_schema_name: ObservationHttpOperationV1["response_schema_name"],
): ObservationHttpOperationV1 {
  return Object.freeze({
    operation_id,
    method: "GET",
    path,
    transport,
    required_capability: "observation.read",
    allowed_callers: allowedCallers,
    response_schema_name,
  });
}

export const OBSERVATION_HTTP_OPERATIONS_V1 = Object.freeze([
  operation(
    "getObservationSnapshotV1",
    OBSERVATION_ROUTES_V1.snapshot,
    "http",
    "ObservationSnapshotResponse",
  ),
  operation(
    "streamObservationEventsV1",
    OBSERVATION_ROUTES_V1.events,
    "sse",
    null,
  ),
  operation(
    "listObservationToolInvocationsV1",
    OBSERVATION_ROUTES_V1.toolInvocations,
    "http",
    "ObservationToolInvocationList",
  ),
  operation(
    "listObservationQualitySignalsV1",
    OBSERVATION_ROUTES_V1.qualitySignals,
    "http",
    "ObservationQualitySignalList",
  ),
  operation(
    "getObservationRuntimeDetailsV1",
    OBSERVATION_ROUTES_V1.runtimeDetails,
    "http",
    null,
  ),
  operation(
    "getObservationMetaDetailsV1",
    OBSERVATION_ROUTES_V1.metaDetails,
    "http",
    null,
  ),
] as const satisfies readonly ObservationHttpOperationV1[]);
