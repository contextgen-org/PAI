import {
  MemoryIdV1Schema,
  MemoryWriteBatchResponseV1Schema,
} from "@pai/contracts/memory/write-batch.v1";
import {
  MemoryFastRecallRequestV1Schema,
  MemoryFastRecallResponseV1Schema,
} from "@pai/contracts/memory/fast-recall.v1";
import {
  MemoryDeepRecallRequestV1Schema,
  MemoryDeepRecallResponseV1Schema,
  assertMemoryDeepRecallRequestSemanticBindingsV1,
  assertMemoryDeepRecallResponseSemanticBindingsV1,
  type MemoryDeepRecallRequestV1,
  type MemoryDeepRecallResponseV1,
} from "@pai/contracts/memory/deep-recall.v1";
import {
  MemoryPrePromotionCheckRequestV1Schema,
  MemoryPrePromotionCheckResponseV1Schema,
  MemoryPrePromotionValidateRequestV1Schema,
  MemoryPromotionReservationV1Schema,
  MemoryPromotionReservationAckRequestV1Schema,
  MemoryPromotionReservationAckResponseV1Schema,
  MemoryPromotionReservationReleaseRequestV1Schema,
  MemoryPromotionReservationReleaseResponseV1Schema,
  assertMemoryPrePromotionCheckRequestSemanticBindingsV1,
  assertMemoryPrePromotionCheckResponseSemanticBindingsV1,
  assertMemoryPrePromotionValidateRequestSemanticBindingsV1,
  assertMemoryPromotionReservationSemanticBindingsV1,
  assertMemoryPromotionReservationAckRequestSemanticBindingsV1,
  assertMemoryPromotionReservationAckResponseSemanticBindingsV1,
  assertMemoryPromotionReservationReleaseRequestSemanticBindingsV1,
  assertMemoryPromotionReservationReleaseResponseSemanticBindingsV1,
  type MemoryPrePromotionCheckRequestV1,
  type MemoryPrePromotionCheckResponseV1,
  type MemoryPrePromotionValidateRequestV1,
  type MemoryPromotionReservationV1,
  type MemoryPromotionReservationAckRequestV1,
  type MemoryPromotionReservationAckResponseV1,
  type MemoryPromotionReservationReleaseRequestV1,
  type MemoryPromotionReservationReleaseResponseV1,
} from "@pai/contracts/memory/pre-promotion-check.v1";
import {
  MemoryDirectFeedbackRequestV1Schema,
  MemoryDirectFeedbackResponseV1Schema,
  assertMemoryDirectFeedbackRequestSemanticBindingsV1,
  assertMemoryDirectFeedbackResponseSemanticBindingsV1,
  type MemoryDirectFeedbackRequestV1,
  type MemoryDirectFeedbackResponseV1,
} from "@pai/contracts/memory/direct-feedback.v1";
import {
  MemoryConflictResolveRequestV1Schema,
  MemoryConflictResolveResponseV1Schema,
  assertMemoryConflictResolveRequestSemanticBindingsV1,
  assertMemoryConflictResolveResponseSemanticBindingsV1,
  type MemoryConflictResolveRequestV1,
  type MemoryConflictResolveResponseV1,
} from "@pai/contracts/memory/conflict.v1";
import {
  MemoryGraphBuildRequestV1Schema,
  MemoryGraphBuildResponseV1Schema,
  assertMemoryGraphBuildRequestSemanticBindingsV1,
  assertMemoryGraphBuildResponseSemanticBindingsV1,
  type MemoryGraphBuildRequestV1,
  type MemoryGraphBuildResponseV1,
} from "@pai/contracts/memory/graph-build.v1";
import {
  MemoryQuerySeriesRequestV1Schema,
  MemoryQuerySeriesResponseV1Schema,
  assertMemoryQuerySeriesRequestSemanticBindingsV1,
  assertMemoryQuerySeriesResponseSemanticBindingsV1,
  type MemoryQuerySeriesRequestV1,
  type MemoryQuerySeriesResponseV1,
} from "@pai/contracts/memory/query-series.v1";
import {
  MemoryIntegrationClaimV1Schema,
  MemoryIntegrationJobDetailsV1Schema,
  MemoryIntegrationRunRequestV1Schema,
  MemoryIntegrationRunResponseV1Schema,
} from "@pai/contracts/memory/integration-job.v1";
import {
  createServiceApp,
  getWorkloadAuthContext,
  ServiceError,
  type InternalRouteAuthPolicy,
  type ServiceAppOptions,
} from "@pai/service-kit";
import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import {
  MemoryApplicationErrorV1,
  memoryCanonicalJsonV1,
  type MemoryApplicationV1,
  type MemoryPrincipalV1,
} from "./memory-application.v1.js";

export const MEMORY_ROUTES_V1 = Object.freeze({
  writeBatch: "/internal/memory/write-batch",
  fastRecall: "/v1/memory/fast-recall",
  deepRecall: "/internal/memory/deep-recall",
  prePromotionCheck: "/internal/memory/pre-promotion-check",
  prePromotionValidate: "/internal/memory/pre-promotion-check/validate",
  promotionReservationAck:
    "/internal/memory/promotion-reservations/:id/ack",
  promotionReservationRelease:
    "/internal/memory/promotion-reservations/:id/release",
  directFeedback: "/v1/memory/feedback",
  conflictResolve: "/internal/memory/conflicts/:id/resolve",
  graphBuild: "/internal/memory/association-graph/build",
  querySeries: "/v1/memory/series/:id",
  integrationRun: "/internal/memory/integration/run",
  integrationGet: "/internal/memory/integration/jobs/:id",
  integrationClaim: "/internal/memory/integration/jobs/:id/claim",
  integrationCheckpoint:
    "/internal/memory/integration/jobs/:id/checkpoint",
  integrationFinish: "/internal/memory/integration/jobs/:id/finish",
} as const);

export interface MemoryOwnerRouteOperationsV1 {
  deepRecall(
    principal: MemoryPrincipalV1,
    request: MemoryDeepRecallRequestV1,
  ): Promise<MemoryDeepRecallResponseV1>;
  checkPrePromotion(
    principal: MemoryPrincipalV1,
    request: MemoryPrePromotionCheckRequestV1,
  ): Promise<MemoryPrePromotionCheckResponseV1>;
  validatePrePromotion(
    principal: MemoryPrincipalV1,
    request: MemoryPrePromotionValidateRequestV1,
  ): Promise<MemoryPromotionReservationV1>;
  ackPromotionReservation(
    principal: MemoryPrincipalV1,
    request: MemoryPromotionReservationAckRequestV1,
  ): Promise<MemoryPromotionReservationAckResponseV1>;
  releasePromotionReservation(
    principal: MemoryPrincipalV1,
    request: MemoryPromotionReservationReleaseRequestV1,
  ): Promise<MemoryPromotionReservationReleaseResponseV1>;
  submitDirectFeedback(
    principal: MemoryPrincipalV1,
    request: MemoryDirectFeedbackRequestV1,
  ): Promise<MemoryDirectFeedbackResponseV1>;
  resolveConflict(
    principal: MemoryPrincipalV1,
    conflictId: string,
    request: MemoryConflictResolveRequestV1,
  ): Promise<MemoryConflictResolveResponseV1>;
  buildAssociationGraph(
    principal: MemoryPrincipalV1,
    request: MemoryGraphBuildRequestV1,
  ): Promise<MemoryGraphBuildResponseV1>;
  querySeries(
    principal: MemoryPrincipalV1,
    request: MemoryQuerySeriesRequestV1,
  ): Promise<MemoryQuerySeriesResponseV1>;
}

export type MemoryHttpApplicationV1 = MemoryApplicationV1 &
  Partial<MemoryOwnerRouteOperationsV1>;

const REQUIRED_MEMORY_OWNER_OPERATIONS_V1 = Object.freeze([
  "deepRecall",
  "checkPrePromotion",
  "validatePrePromotion",
  "ackPromotionReservation",
  "releasePromotionReservation",
  "submitDirectFeedback",
  "resolveConflict",
  "buildAssociationGraph",
  "querySeries",
] as const satisfies readonly (keyof MemoryOwnerRouteOperationsV1)[]);

export interface MemoryApplicationsV1 {
  readonly memory?: MemoryHttpApplicationV1;
}

export interface MemoryBuildOptionsV1 {
  readonly require_complete_pipeline?: boolean;
  /**
   * rev309 does not assign the series query endpoint to one service subject.
   * Keep it disabled unless composition supplies a reviewed allowlist.
   */
  readonly series_query_allowed_callers?: readonly MemoryPrincipalV1["caller"][];
}

function fastifyWireSchema<T extends Readonly<Record<string, unknown>>>(
  ownerSchema: T,
): T {
  const clone = structuredClone(ownerSchema) as Record<string, unknown>;
  const ownerSemanticAnnotations = new Set([
    "atLeastOneOf",
    "exactlyOnePrimary",
    "maxCanonicalJsonBytes",
    "maxUtf8Bytes",
    "uniqueByCanonicalIdentity",
  ]);
  const stripNestedIds = (value: unknown, root: boolean): void => {
    if (typeof value !== "object" || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((entry) => stripNestedIds(entry, false));
      return;
    }
    const record = value as Record<string, unknown>;
    if (!root) delete record["$id"];
    ownerSemanticAnnotations.forEach((key) => delete record[key]);
    Object.values(record).forEach((entry) => stripNestedIds(entry, false));
  };
  stripNestedIds(clone, true);
  return clone as T;
}

const MemoryWriteBatchEnvelopeRequestV1Schema = Type.Object(
  {
    schema_version: Type.Literal("memory.write_batch.v1"),
    bot_id: MemoryIdV1Schema,
    trigger_process_id: MemoryIdV1Schema,
    source_meta_job_id: MemoryIdV1Schema,
    idempotency_key: Type.String({
      minLength: 1,
      maxUtf8Bytes: 128,
    }),
    compatibility_mode: Type.Optional(
      Type.Literal("legacy_subject_order"),
    ),
    items: Type.Array(Type.Unknown(), {
      minItems: 1,
      maxItems: 100,
    }),
  },
  {
    $id: "urn:pai:memory:write-batch-envelope-request:v1",
    additionalProperties: false,
    maxCanonicalJsonBytes: 2_097_152,
  },
);

const writeBatchRequestRouteSchema = fastifyWireSchema(
  MemoryWriteBatchEnvelopeRequestV1Schema,
);
const writeBatchResponseRouteSchema = fastifyWireSchema(
  MemoryWriteBatchResponseV1Schema,
);
const fastRecallRequestRouteSchema = fastifyWireSchema(
  MemoryFastRecallRequestV1Schema,
);
const fastRecallResponseRouteSchema = fastifyWireSchema(
  MemoryFastRecallResponseV1Schema,
);
const deepRecallRequestRouteSchema = fastifyWireSchema(
  MemoryDeepRecallRequestV1Schema,
);
const deepRecallResponseRouteSchema = fastifyWireSchema(
  MemoryDeepRecallResponseV1Schema,
);
const prePromotionCheckRequestRouteSchema = fastifyWireSchema(
  MemoryPrePromotionCheckRequestV1Schema,
);
const prePromotionCheckResponseRouteSchema = fastifyWireSchema(
  MemoryPrePromotionCheckResponseV1Schema,
);
const prePromotionValidateRequestRouteSchema = fastifyWireSchema(
  MemoryPrePromotionValidateRequestV1Schema,
);
const promotionReservationRouteSchema = fastifyWireSchema(
  MemoryPromotionReservationV1Schema,
);
const promotionReservationAckRequestRouteSchema = fastifyWireSchema(
  MemoryPromotionReservationAckRequestV1Schema,
);
const promotionReservationAckResponseRouteSchema = fastifyWireSchema(
  MemoryPromotionReservationAckResponseV1Schema,
);
const promotionReservationReleaseRequestRouteSchema = fastifyWireSchema(
  MemoryPromotionReservationReleaseRequestV1Schema,
);
const promotionReservationReleaseResponseRouteSchema = fastifyWireSchema(
  MemoryPromotionReservationReleaseResponseV1Schema,
);
const directFeedbackRequestRouteSchema = fastifyWireSchema(
  MemoryDirectFeedbackRequestV1Schema,
);
const directFeedbackResponseRouteSchema = fastifyWireSchema(
  MemoryDirectFeedbackResponseV1Schema,
);
const conflictResolveRequestRouteSchema = fastifyWireSchema(
  MemoryConflictResolveRequestV1Schema,
);
const conflictResolveResponseRouteSchema = fastifyWireSchema(
  MemoryConflictResolveResponseV1Schema,
);
const graphBuildRequestRouteSchema = fastifyWireSchema(
  MemoryGraphBuildRequestV1Schema,
);
const graphBuildResponseRouteSchema = fastifyWireSchema(
  MemoryGraphBuildResponseV1Schema,
);
const querySeriesResponseRouteSchema = fastifyWireSchema(
  MemoryQuerySeriesResponseV1Schema,
);
const integrationRunRequestRouteSchema = fastifyWireSchema(
  MemoryIntegrationRunRequestV1Schema,
);
const integrationRunResponseRouteSchema = fastifyWireSchema(
  MemoryIntegrationRunResponseV1Schema,
);
const integrationJobRouteSchema = fastifyWireSchema(
  MemoryIntegrationJobDetailsV1Schema,
);
const integrationClaimRouteSchema = fastifyWireSchema(
  MemoryIntegrationClaimV1Schema,
);

function querySeriesWireSchema(): Readonly<Record<string, unknown>> {
  const schema = fastifyWireSchema(
    MemoryQuerySeriesRequestV1Schema,
  ) as Record<string, unknown>;
  const properties = schema["properties"];
  if (
    typeof properties !== "object" ||
    properties === null ||
    Array.isArray(properties)
  ) {
    throw new Error("Memory series query schema has no properties");
  }
  delete (properties as Record<string, unknown>)["series_id"];
  const required = schema["required"];
  if (Array.isArray(required)) {
    schema["required"] = required.filter(
      (entry) => entry !== "series_id",
    );
  }
  return schema;
}

const querySeriesRequestRouteSchema = querySeriesWireSchema();
const pathIdRouteSchema = Object.freeze({
  type: "object",
  required: Object.freeze(["id"]),
  additionalProperties: false,
  properties: Object.freeze({
    id: fastifyWireSchema(MemoryIdV1Schema),
  }),
});

type SemanticAssertion<T> = (value: T) => void;

function strictUtf8Bytes(value: string, path: string): number {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const low = value.charCodeAt(index + 1);
      if (low < 0xdc00 || low > 0xdfff) {
        throw new Error(`${path} contains an unpaired UTF-16 surrogate`);
      }
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      throw new Error(`${path} contains an unpaired UTF-16 surrogate`);
    }
  }
  return Buffer.byteLength(value, "utf8");
}

function assertOwnerSchemaAnnotations(
  schemaValue: unknown,
  value: unknown,
  path = "$",
): void {
  if (
    typeof schemaValue !== "object" ||
    schemaValue === null ||
    Array.isArray(schemaValue)
  ) {
    return;
  }
  const schema = schemaValue as Record<string, unknown>;
  const maxUtf8Bytes = schema["maxUtf8Bytes"];
  if (
    typeof maxUtf8Bytes === "number" &&
    typeof value === "string" &&
    strictUtf8Bytes(value, path) > maxUtf8Bytes
  ) {
    throw new Error(`${path} exceeds maxUtf8Bytes`);
  }
  const maxCanonicalJsonBytes = schema["maxCanonicalJsonBytes"];
  if (typeof maxCanonicalJsonBytes === "number") {
    const encoded = JSON.stringify(value);
    if (
      encoded === undefined ||
      strictUtf8Bytes(encoded, path) > maxCanonicalJsonBytes
    ) {
      throw new Error(`${path} exceeds maxCanonicalJsonBytes`);
    }
  }
  for (const branchKey of ["anyOf", "oneOf", "allOf"] as const) {
    const branches = schema[branchKey];
    if (!Array.isArray(branches)) continue;
    for (const branch of branches) {
      if (
        branchKey === "allOf" ||
        Value.Check(
          branch as Parameters<typeof Value.Check>[0],
          value,
        )
      ) {
        assertOwnerSchemaAnnotations(branch, value, path);
      }
    }
  }
  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  ) {
    const properties = schema["properties"];
    if (
      typeof properties === "object" &&
      properties !== null &&
      !Array.isArray(properties)
    ) {
      for (const [key, childSchema] of Object.entries(properties)) {
        if (Object.hasOwn(value, key)) {
          assertOwnerSchemaAnnotations(
            childSchema,
            (value as Record<string, unknown>)[key],
            `${path}/${key}`,
          );
        }
      }
    }
  }
  if (Array.isArray(value) && schema["items"] !== undefined) {
    value.forEach((entry, index) =>
      assertOwnerSchemaAnnotations(
        schema["items"],
        entry,
        `${path}/${index}`,
      ),
    );
  }
}

function assertOwnerRequestSchema<T = unknown>(
  schema: Parameters<typeof Value.Check>[0],
  value: unknown,
  semanticAssertion?: SemanticAssertion<T>,
): asserts value is T {
  memoryCanonicalJsonV1(value);
  if (!Value.Check(schema, value)) {
    throw new MemoryApplicationErrorV1(
      "schema_validation_failed",
      "request does not match the Memory owner schema",
    );
  }
  try {
    assertOwnerSchemaAnnotations(schema, value);
    semanticAssertion?.(value as T);
  } catch (error) {
    throw new MemoryApplicationErrorV1(
      "schema_validation_failed",
      error instanceof Error
        ? error.message
        : "request violates the Memory owner semantic contract",
    );
  }
}

function ownerRequest<T>(
  schema: Parameters<typeof Value.Check>[0],
  value: unknown,
  semanticAssertion: SemanticAssertion<T>,
): T {
  assertOwnerRequestSchema(schema, value, semanticAssertion);
  return value;
}

function assertOwnerResponseSchema<T>(
  schema: Parameters<typeof Value.Check>[0],
  value: unknown,
  semanticAssertion: SemanticAssertion<T>,
): asserts value is T {
  try {
    memoryCanonicalJsonV1(value);
  } catch {
    throw new MemoryApplicationErrorV1(
      "dependency_unavailable",
      "Memory owner operation returned non-canonical JSON",
      true,
    );
  }
  if (!Value.Check(schema, value)) {
    throw new MemoryApplicationErrorV1(
      "dependency_unavailable",
      "Memory owner operation returned an invalid response",
      true,
    );
  }
  try {
    assertOwnerSchemaAnnotations(schema, value);
    semanticAssertion(value as T);
  } catch {
    throw new MemoryApplicationErrorV1(
      "dependency_unavailable",
      "Memory owner operation returned a semantically invalid response",
      true,
    );
  }
}

function workloadScope(
  request: Parameters<typeof getWorkloadAuthContext>[0],
) {
  const claims = getWorkloadAuthContext(request).claims;
  if (claims.scope_kind !== "bot") {
    throw new MemoryApplicationErrorV1(
      "forbidden",
      "Memory requires a bot-scoped workload",
    );
  }
  return Object.freeze({
    scope_kind: "bot" as const,
    workspace_id: claims.workspace_id,
    bot_id: claims.bot_id,
    owner_agent_id: claims.owner_agent_id,
    deployment_environment: claims.deployment_environment,
    release_channel: claims.release_channel,
  });
}

function principal(
  request: Parameters<typeof getWorkloadAuthContext>[0],
): MemoryPrincipalV1 {
  const claims = getWorkloadAuthContext(request).claims;
  const scope = workloadScope(request);
  if (
    claims.sub !== "action_runtime" &&
    claims.sub !== "knowthat" &&
    claims.sub !== "meta_cognition" &&
    claims.sub !== "trigger_processor" &&
    claims.sub !== "memory"
  ) {
    throw new MemoryApplicationErrorV1(
      "forbidden",
      "unsupported Memory workload identity",
    );
  }
  return Object.freeze({
    caller: claims.sub,
    capabilities: Object.freeze([...claims.capability]),
    scope: Object.freeze({
      workspace_id: scope.workspace_id,
      bot_id: scope.bot_id,
      owner_agent_id: scope.owner_agent_id,
      deployment_environment: scope.deployment_environment,
      release_channel: scope.release_channel,
    }),
  });
}

function policies(
  seriesQueryCallers: readonly MemoryPrincipalV1["caller"][],
): readonly InternalRouteAuthPolicy[] {
  const policy = (
    method: string,
    route: InternalRouteAuthPolicy["route"],
    capability: string,
    callers:
      | MemoryPrincipalV1["caller"]
      | readonly MemoryPrincipalV1["caller"][],
  ): InternalRouteAuthPolicy =>
    Object.freeze({
      method,
      route,
      requiredCapabilities: Object.freeze([capability]),
      allowedCallers: Object.freeze(
        typeof callers === "string" ? [callers] : [...callers],
      ),
      requiredScope: workloadScope,
    });
  // An empty reviewed allowlist keeps the route authenticated but disabled.
  // The handler rejects before invoking the application. "memory" here is
  // only the protected owner identity used to avoid an unguarded route.
  const protectedSeriesCallers =
    seriesQueryCallers.length === 0
      ? (["memory"] as const)
      : seriesQueryCallers;
  return Object.freeze([
    policy(
      "POST",
      MEMORY_ROUTES_V1.writeBatch,
      "memory.write",
      "meta_cognition",
    ),
    policy(
      "POST",
      MEMORY_ROUTES_V1.fastRecall,
      "memory.read",
      "trigger_processor",
    ),
    policy(
      "POST",
      MEMORY_ROUTES_V1.deepRecall,
      "memory.deep_recall",
      "action_runtime",
    ),
    policy(
      "POST",
      MEMORY_ROUTES_V1.prePromotionCheck,
      "memory.pre_promotion_check",
      "knowthat",
    ),
    policy(
      "POST",
      MEMORY_ROUTES_V1.prePromotionValidate,
      "memory.pre_promotion_check",
      "knowthat",
    ),
    policy(
      "POST",
      MEMORY_ROUTES_V1.promotionReservationAck,
      "memory.promotion_reservation.ack",
      "knowthat",
    ),
    policy(
      "POST",
      MEMORY_ROUTES_V1.promotionReservationRelease,
      "memory.promotion_reservation.release",
      "knowthat",
    ),
    policy(
      "POST",
      MEMORY_ROUTES_V1.directFeedback,
      "memory.feedback.write",
      ["meta_cognition", "action_runtime"],
    ),
    policy(
      "POST",
      MEMORY_ROUTES_V1.conflictResolve,
      "memory.conflict.resolve",
      "memory",
    ),
    policy(
      "POST",
      MEMORY_ROUTES_V1.graphBuild,
      "memory.association_graph.build",
      "memory",
    ),
    policy(
      "GET",
      MEMORY_ROUTES_V1.querySeries,
      "memory.series.read",
      protectedSeriesCallers,
    ),
    policy(
      "POST",
      MEMORY_ROUTES_V1.integrationRun,
      "memory.integration.run",
      "memory",
    ),
    policy(
      "GET",
      MEMORY_ROUTES_V1.integrationGet,
      "memory.integration.run",
      "memory",
    ),
    policy(
      "POST",
      MEMORY_ROUTES_V1.integrationClaim,
      "memory.integration.run",
      "memory",
    ),
    policy(
      "POST",
      MEMORY_ROUTES_V1.integrationCheckpoint,
      "memory.integration.run",
      "memory",
    ),
    policy(
      "POST",
      MEMORY_ROUTES_V1.integrationFinish,
      "memory.integration.run",
      "memory",
    ),
  ]);
}

const statusByMemoryError = Object.freeze({
  invalid_request: 400,
  schema_validation_failed: 422,
  forbidden: 403,
  bot_scope_mismatch: 403,
  integration_job_not_found: 404,
  promotion_reservation_not_found: 404,
  snapshot_expired: 410,
  promotion_check_expired: 410,
  stale_memory_check: 409,
  stale_conflict_version: 409,
  idempotency_conflict: 409,
  lease_conflict: 409,
  promotion_reserved: 409,
  promotion_stale_fence: 409,
  promotion_version_drift: 409,
  payload_too_large: 413,
  too_many_items: 413,
  batch_too_large: 422,
  dependency_unavailable: 503,
} as const);

function recordBody(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new MemoryApplicationErrorV1(
      "invalid_request",
      "request body must be an object",
    );
  }
  return value as Record<string, unknown>;
}

function pathId(value: unknown): string {
  const id = recordBody(value)["id"];
  if (
    !Value.Check(MemoryIdV1Schema, id) ||
    typeof id !== "string" ||
    Buffer.byteLength(id, "utf8") > 256
  ) {
    throw new MemoryApplicationErrorV1(
      "invalid_request",
      "Memory path id does not match the owner schema",
    );
  }
  return id;
}

function assertBotScope(
  request: Parameters<typeof getWorkloadAuthContext>[0],
  botId: string,
): void {
  if (botId !== workloadScope(request).bot_id) {
    throw new MemoryApplicationErrorV1(
      "bot_scope_mismatch",
      "bot_id does not match workload scope",
    );
  }
}

function assertDeepRecallScope(
  request: Parameters<typeof getWorkloadAuthContext>[0],
  body: MemoryDeepRecallRequestV1,
): void {
  const scope = workloadScope(request);
  assertBotScope(request, body.bot_id);
  if (body.owner_agent_id !== scope.owner_agent_id) {
    throw new MemoryApplicationErrorV1(
      "forbidden",
      "owner_agent_id does not match workload scope",
    );
  }
}

function unavailableOperation(operation: string): never {
  throw new MemoryApplicationErrorV1(
    "dependency_unavailable",
    `${operation} is not composed`,
    true,
  );
}

function assertSameValue(
  actual: string | number,
  expected: string | number,
  label: string,
): void {
  if (actual !== expected) {
    throw new MemoryApplicationErrorV1(
      "dependency_unavailable",
      `Memory owner operation returned a mismatched ${label}`,
      true,
    );
  }
}

function assertSameIdentitySet(
  actual: readonly string[],
  expected: readonly string[],
  label: string,
): void {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  if (
    actualSet.size !== actual.length ||
    expectedSet.size !== expected.length ||
    actualSet.size !== expectedSet.size ||
    [...actualSet].some((entry) => !expectedSet.has(entry))
  ) {
    throw new MemoryApplicationErrorV1(
      "dependency_unavailable",
      `Memory owner operation returned mismatched ${label}`,
      true,
    );
  }
}

function seriesQueryCallers(
  value: readonly MemoryPrincipalV1["caller"][] | undefined,
): readonly MemoryPrincipalV1["caller"][] {
  const callers = [...(value ?? [])];
  if (
    callers.length > 5 ||
    new Set(callers).size !== callers.length
  ) {
    throw new Error(
      "series_query_allowed_callers must be a unique reviewed allowlist",
    );
  }
  return Object.freeze(callers);
}

function seriesQueryInput(
  request: Parameters<typeof getWorkloadAuthContext>[0],
): MemoryQuerySeriesRequestV1 {
  const query = { ...recordBody(request.query) };
  const seriesId = pathId(request.params);
  if (query["series_id"] !== undefined) {
    throw new MemoryApplicationErrorV1(
      "invalid_request",
      "series_id is path-owned and cannot be supplied as query data",
    );
  }
  const candidate = { ...query, series_id: seriesId };
  assertOwnerRequestSchema(
    MemoryQuerySeriesRequestV1Schema,
    candidate,
    assertMemoryQuerySeriesRequestSemanticBindingsV1,
  );
  assertBotScope(request, candidate.bot_id);
  return candidate;
}

function rawBodyBytes(
  request: Parameters<typeof getWorkloadAuthContext>[0],
): number {
  const contentLength = request.headers["content-length"];
  if (
    typeof contentLength === "string" &&
    /^(?:0|[1-9]\d*)$/u.test(contentLength)
  ) {
    const parsed = Number(contentLength);
    if (Number.isSafeInteger(parsed)) return parsed;
  }
  return Buffer.byteLength(JSON.stringify(request.body), "utf8");
}

function workerInput(
  request: Parameters<typeof getWorkloadAuthContext>[0],
): Record<string, unknown> {
  const body = recordBody(request.body);
  const id = pathId(request.params);
  if (
    body["integration_job_id"] !== undefined &&
    body["integration_job_id"] !== id
  ) {
    throw new MemoryApplicationErrorV1(
      "invalid_request",
      "integration_job_id does not match the path",
    );
  }
  if (
    body["bot_id"] !== undefined &&
    body["bot_id"] !== workloadScope(request).bot_id
  ) {
    throw new MemoryApplicationErrorV1(
      "bot_scope_mismatch",
      "bot_id does not match workload scope",
    );
  }
  return {
    ...body,
    bot_id: workloadScope(request).bot_id,
    integration_job_id: id,
  };
}

export function buildMemoryApp(
  options: ServiceAppOptions = {},
  applications: MemoryApplicationsV1 = {},
  buildOptions: MemoryBuildOptionsV1 = {},
): ReturnType<typeof createServiceApp> {
  const memory = applications.memory;
  const reviewedSeriesQueryCallers = seriesQueryCallers(
    buildOptions.series_query_allowed_callers,
  );
  const existingErrorMapper = options.errorMapper;
  const app = createServiceApp("memory", {
    ...options,
    auth: {
      ...(options.auth?.verifier === undefined
        ? {}
        : { verifier: options.auth.verifier }),
      policies:
        memory === undefined
          ? options.auth?.policies ?? []
          : [
              ...(options.auth?.policies ?? []),
              ...policies(reviewedSeriesQueryCallers),
            ],
    },
    errorMapper: async (error, request) => {
      if (error instanceof MemoryApplicationErrorV1) {
        return new ServiceError({
          code: error.code,
          message: error.message,
          statusCode: statusByMemoryError[error.code],
          retryable: error.retryable,
          details:
            error.details ??
            (error.field_path === undefined
              ? undefined
              : { field_path: error.field_path }),
          cause: error,
        });
      }
      if (
        typeof error === "object" &&
        error !== null &&
        "statusCode" in error &&
        error.statusCode === 413
      ) {
        return new ServiceError({
          code: "payload_too_large",
          message: "request body exceeds 2 MiB",
          statusCode: 413,
          retryable: false,
          cause: error,
        });
      }
      if (
        typeof error === "object" &&
        error !== null &&
        "statusCode" in error &&
        error.statusCode === 400
      ) {
        return new ServiceError({
          code: "schema_validation_failed",
          message: "request does not match the Memory owner schema",
          statusCode: 422,
          retryable: false,
          cause: error,
        });
      }
      return existingErrorMapper?.(error, request);
    },
    readinessChecks: [
      ...(options.readinessChecks ?? []),
      ...(buildOptions.require_complete_pipeline === true
        ? [
            {
              name: "memory_application",
              async check() {
                if (memory === undefined) {
                  throw new Error("Memory application is not composed");
                }
                await memory.checkReadiness();
                const missing = REQUIRED_MEMORY_OWNER_OPERATIONS_V1.filter(
                  (operation) => typeof memory[operation] !== "function",
                );
                if (missing.length > 0) {
                  throw new Error(
                    `Memory owner operations are not composed: ${missing.join(", ")}`,
                  );
                }
                // The current owner document does not assign this route to a
                // service subject. An empty reviewed allowlist is therefore a
                // deliberate deny-all state, not a readiness failure.
              },
            },
          ]
        : []),
    ],
  });

  if (memory === undefined) return app;

  app.post(
    MEMORY_ROUTES_V1.writeBatch,
    {
      bodyLimit: 2_097_152,
      async preValidation(request) {
        assertOwnerRequestSchema(
          MemoryWriteBatchEnvelopeRequestV1Schema,
          request.body,
        );
      },
      schema: {
        body: writeBatchRequestRouteSchema,
        response: { 200: writeBatchResponseRouteSchema },
      },
    },
    async (request, reply) =>
      reply.code(200).send(
        await memory.writeBatch(principal(request), request.body, {
          raw_body_bytes: rawBodyBytes(request),
        }),
      ),
  );

  app.post(
    MEMORY_ROUTES_V1.fastRecall,
    {
      async preValidation(request) {
        assertOwnerRequestSchema(
          MemoryFastRecallRequestV1Schema,
          request.body,
        );
      },
      schema: {
        body: fastRecallRequestRouteSchema,
        response: { 200: fastRecallResponseRouteSchema },
      },
    },
    async (request, reply) => {
      // Fast Recall creates a pinned owner snapshot.  Publish the exact
      // owner-selected instant as a response header so an authenticated
      // consumer can record source_as_of without inventing a caller clock.
      const sourceAsOf = new Date();
      const response = await memory.fastRecall(
        principal(request),
        request.body,
        sourceAsOf,
      );
      return reply
        .header("x-pai-memory-source-as-of", sourceAsOf.toISOString())
        .code(200)
        .send(response);
    },
  );

  app.post(
    MEMORY_ROUTES_V1.deepRecall,
    {
      async preValidation(request) {
        assertOwnerRequestSchema(
          MemoryDeepRecallRequestV1Schema,
          request.body,
          assertMemoryDeepRecallRequestSemanticBindingsV1,
        );
        assertDeepRecallScope(request, request.body);
      },
      schema: {
        body: deepRecallRequestRouteSchema,
        response: { 200: deepRecallResponseRouteSchema },
      },
    },
    async (request, reply) => {
      const body = ownerRequest(
        MemoryDeepRecallRequestV1Schema,
        request.body,
        assertMemoryDeepRecallRequestSemanticBindingsV1,
      );
      const operation = memory.deepRecall;
      if (typeof operation !== "function") unavailableOperation("deep recall");
      const response = await operation.call(
        memory,
        principal(request),
        body,
      );
      assertOwnerResponseSchema(
        MemoryDeepRecallResponseV1Schema,
        response,
        assertMemoryDeepRecallResponseSemanticBindingsV1,
      );
      return reply.code(200).send(response);
    },
  );

  app.post(
    MEMORY_ROUTES_V1.prePromotionCheck,
    {
      async preValidation(request) {
        assertOwnerRequestSchema(
          MemoryPrePromotionCheckRequestV1Schema,
          request.body,
          assertMemoryPrePromotionCheckRequestSemanticBindingsV1,
        );
        assertBotScope(request, request.body.bot_id);
      },
      schema: {
        body: prePromotionCheckRequestRouteSchema,
        response: { 200: prePromotionCheckResponseRouteSchema },
      },
    },
    async (request, reply) => {
      const body = ownerRequest(
        MemoryPrePromotionCheckRequestV1Schema,
        request.body,
        assertMemoryPrePromotionCheckRequestSemanticBindingsV1,
      );
      const operation = memory.checkPrePromotion;
      if (typeof operation !== "function") {
        unavailableOperation("pre-promotion check");
      }
      const response = await operation.call(
        memory,
        principal(request),
        body,
      );
      assertOwnerResponseSchema(
        MemoryPrePromotionCheckResponseV1Schema,
        response,
        assertMemoryPrePromotionCheckResponseSemanticBindingsV1,
      );
      assertSameValue(
        response.candidate_fact_id,
        body.candidate_fact_id,
        "candidate_fact_id",
      );
      assertSameIdentitySet(
        response.points.map((point) => point.memory_point_id),
        body.memory_point_ids,
        "memory_point_ids",
      );
      return reply.code(200).send(response);
    },
  );

  app.post(
    MEMORY_ROUTES_V1.prePromotionValidate,
    {
      async preValidation(request) {
        assertOwnerRequestSchema(
          MemoryPrePromotionValidateRequestV1Schema,
          request.body,
          assertMemoryPrePromotionValidateRequestSemanticBindingsV1,
        );
        assertBotScope(request, request.body.bot_id);
      },
      schema: {
        body: prePromotionValidateRequestRouteSchema,
        response: { 200: promotionReservationRouteSchema },
      },
    },
    async (request, reply) => {
      const body = ownerRequest(
        MemoryPrePromotionValidateRequestV1Schema,
        request.body,
        assertMemoryPrePromotionValidateRequestSemanticBindingsV1,
      );
      const operation = memory.validatePrePromotion;
      if (typeof operation !== "function") {
        unavailableOperation("pre-promotion validation");
      }
      const response = await operation.call(
        memory,
        principal(request),
        body,
      );
      assertOwnerResponseSchema(
        MemoryPromotionReservationV1Schema,
        response,
        assertMemoryPromotionReservationSemanticBindingsV1,
      );
      assertSameValue(
        response.candidate_fact_id,
        body.candidate_fact_id,
        "candidate_fact_id",
      );
      assertSameIdentitySet(
        response.reserved_points.map(
          (point) =>
            JSON.stringify([
              point.memory_point_id,
              point.state_version,
              point.state_hash,
            ]),
        ),
        body.expected_point_versions.map(
          (point) =>
            JSON.stringify([
              point.memory_point_id,
              point.state_version,
              point.state_hash,
            ]),
        ),
        "reserved point versions",
      );
      assertSameIdentitySet(
        response.reserved_conflicts.map(
          (conflict) =>
            JSON.stringify([
              conflict.conflict_id,
              conflict.conflict_version,
            ]),
        ),
        body.expected_conflict_versions.map(
          (conflict) =>
            JSON.stringify([
              conflict.conflict_id,
              conflict.conflict_version,
            ]),
        ),
        "reserved conflict versions",
      );
      return reply.code(200).send(response);
    },
  );

  app.post(
    MEMORY_ROUTES_V1.promotionReservationAck,
    {
      async preValidation(request) {
        assertOwnerRequestSchema(
          MemoryPromotionReservationAckRequestV1Schema,
          request.body,
          assertMemoryPromotionReservationAckRequestSemanticBindingsV1,
        );
        assertBotScope(request, request.body.bot_id);
        assertSameValue(
          request.body.reservation_id,
          pathId(request.params),
          "reservation_id",
        );
      },
      schema: {
        body: promotionReservationAckRequestRouteSchema,
        response: { 200: promotionReservationAckResponseRouteSchema },
      },
    },
    async (request, reply) => {
      const body = ownerRequest(
        MemoryPromotionReservationAckRequestV1Schema,
        request.body,
        assertMemoryPromotionReservationAckRequestSemanticBindingsV1,
      );
      const operation = memory.ackPromotionReservation;
      if (typeof operation !== "function") {
        unavailableOperation("promotion reservation ack");
      }
      const response = await operation.call(
        memory,
        principal(request),
        body,
      );
      assertOwnerResponseSchema(
        MemoryPromotionReservationAckResponseV1Schema,
        response,
        assertMemoryPromotionReservationAckResponseSemanticBindingsV1,
      );
      assertSameValue(
        response.reservation_id,
        body.reservation_id,
        "reservation_id",
      );
      assertSameValue(
        response.candidate_fact_id,
        body.candidate_fact_id,
        "candidate_fact_id",
      );
      assertSameValue(
        response.fencing_generation,
        body.fencing_generation,
        "fencing_generation",
      );
      assertSameValue(
        response.promotion_revision_id,
        body.promotion_revision_id,
        "promotion_revision_id",
      );
      assertSameValue(
        response.committed_at,
        body.committed_at,
        "committed_at",
      );
      return reply.code(200).send(response);
    },
  );

  app.post(
    MEMORY_ROUTES_V1.promotionReservationRelease,
    {
      async preValidation(request) {
        assertOwnerRequestSchema(
          MemoryPromotionReservationReleaseRequestV1Schema,
          request.body,
          assertMemoryPromotionReservationReleaseRequestSemanticBindingsV1,
        );
        assertBotScope(request, request.body.bot_id);
        assertSameValue(
          request.body.reservation_id,
          pathId(request.params),
          "reservation_id",
        );
      },
      schema: {
        body: promotionReservationReleaseRequestRouteSchema,
        response: {
          200: promotionReservationReleaseResponseRouteSchema,
        },
      },
    },
    async (request, reply) => {
      const body = ownerRequest(
        MemoryPromotionReservationReleaseRequestV1Schema,
        request.body,
        assertMemoryPromotionReservationReleaseRequestSemanticBindingsV1,
      );
      const operation = memory.releasePromotionReservation;
      if (typeof operation !== "function") {
        unavailableOperation("promotion reservation release");
      }
      const response = await operation.call(
        memory,
        principal(request),
        body,
      );
      assertOwnerResponseSchema(
        MemoryPromotionReservationReleaseResponseV1Schema,
        response,
        assertMemoryPromotionReservationReleaseResponseSemanticBindingsV1,
      );
      assertSameValue(
        response.reservation_id,
        body.reservation_id,
        "reservation_id",
      );
      assertSameValue(
        response.candidate_fact_id,
        body.candidate_fact_id,
        "candidate_fact_id",
      );
      assertSameValue(
        response.fencing_generation,
        body.fencing_generation,
        "fencing_generation",
      );
      return reply.code(200).send(response);
    },
  );

  app.post(
    MEMORY_ROUTES_V1.directFeedback,
    {
      async preValidation(request) {
        assertOwnerRequestSchema(
          MemoryDirectFeedbackRequestV1Schema,
          request.body,
          assertMemoryDirectFeedbackRequestSemanticBindingsV1,
        );
        assertBotScope(request, request.body.bot_id);
      },
      schema: {
        body: directFeedbackRequestRouteSchema,
        response: { 200: directFeedbackResponseRouteSchema },
      },
    },
    async (request, reply) => {
      const body = ownerRequest(
        MemoryDirectFeedbackRequestV1Schema,
        request.body,
        assertMemoryDirectFeedbackRequestSemanticBindingsV1,
      );
      const operation = memory.submitDirectFeedback;
      if (typeof operation !== "function") {
        unavailableOperation("direct feedback");
      }
      const response = await operation.call(
        memory,
        principal(request),
        body,
      );
      assertOwnerResponseSchema(
        MemoryDirectFeedbackResponseV1Schema,
        response,
        assertMemoryDirectFeedbackResponseSemanticBindingsV1,
      );
      assertSameValue(
        response.target_type,
        body.target_type,
        "target_type",
      );
      assertSameValue(
        response.target_id,
        body.target_id,
        "target_id",
      );
      return reply.code(200).send(response);
    },
  );

  app.post(
    MEMORY_ROUTES_V1.conflictResolve,
    {
      async preValidation(request) {
        pathId(request.params);
        assertOwnerRequestSchema(
          MemoryConflictResolveRequestV1Schema,
          request.body,
          assertMemoryConflictResolveRequestSemanticBindingsV1,
        );
        assertBotScope(request, request.body.bot_id);
      },
      schema: {
        params: pathIdRouteSchema,
        body: conflictResolveRequestRouteSchema,
        response: { 200: conflictResolveResponseRouteSchema },
      },
    },
    async (request, reply) => {
      const body = ownerRequest(
        MemoryConflictResolveRequestV1Schema,
        request.body,
        assertMemoryConflictResolveRequestSemanticBindingsV1,
      );
      const operation = memory.resolveConflict;
      if (typeof operation !== "function") {
        unavailableOperation("conflict resolve");
      }
      const conflictId = pathId(request.params);
      const response = await operation.call(
        memory,
        principal(request),
        conflictId,
        body,
      );
      assertOwnerResponseSchema(
        MemoryConflictResolveResponseV1Schema,
        response,
        assertMemoryConflictResolveResponseSemanticBindingsV1,
      );
      assertSameValue(response.conflict_id, conflictId, "conflict_id");
      return reply.code(200).send(response);
    },
  );

  app.post(
    MEMORY_ROUTES_V1.graphBuild,
    {
      async preValidation(request) {
        assertOwnerRequestSchema(
          MemoryGraphBuildRequestV1Schema,
          request.body,
          assertMemoryGraphBuildRequestSemanticBindingsV1,
        );
        assertBotScope(request, request.body.bot_id);
      },
      schema: {
        body: graphBuildRequestRouteSchema,
        response: { 200: graphBuildResponseRouteSchema },
      },
    },
    async (request, reply) => {
      const body = ownerRequest(
        MemoryGraphBuildRequestV1Schema,
        request.body,
        assertMemoryGraphBuildRequestSemanticBindingsV1,
      );
      const operation = memory.buildAssociationGraph;
      if (typeof operation !== "function") {
        unavailableOperation("association graph build");
      }
      const response = await operation.call(
        memory,
        principal(request),
        body,
      );
      assertOwnerResponseSchema(
        MemoryGraphBuildResponseV1Schema,
        response,
        assertMemoryGraphBuildResponseSemanticBindingsV1,
      );
      return reply.code(200).send(response);
    },
  );

  app.get(
    MEMORY_ROUTES_V1.querySeries,
    {
      async preValidation(request) {
        seriesQueryInput(request);
      },
      schema: {
        params: pathIdRouteSchema,
        querystring: querySeriesRequestRouteSchema,
        response: { 200: querySeriesResponseRouteSchema },
      },
    },
    async (request, reply) => {
      if (reviewedSeriesQueryCallers.length === 0) {
        unavailableOperation("series query authorization");
      }
      const caller = principal(request);
      const input = seriesQueryInput(request);
      const include = new Set(input.include ?? ["points"]);
      if (
        (include.has("conflicts") || include.has("edges")) &&
        !caller.capabilities.includes("memory.audit.read")
      ) {
        throw new MemoryApplicationErrorV1(
          "forbidden",
          "memory.audit.read is required for conflicts or edges",
        );
      }
      const operation = memory.querySeries;
      if (typeof operation !== "function") unavailableOperation("series query");
      const response = await operation.call(memory, caller, input);
      assertOwnerResponseSchema(
        MemoryQuerySeriesResponseV1Schema,
        response,
        assertMemoryQuerySeriesResponseSemanticBindingsV1,
      );
      assertSameValue(response.series.id, input.series_id, "series_id");
      assertSameValue(response.series.bot_id, input.bot_id, "bot_id");
      return reply.code(200).send(response);
    },
  );

  app.post(
    MEMORY_ROUTES_V1.integrationRun,
    {
      async preValidation(request) {
        assertOwnerRequestSchema(
          MemoryIntegrationRunRequestV1Schema,
          request.body,
        );
      },
      schema: {
        body: integrationRunRequestRouteSchema,
        response: { 202: integrationRunResponseRouteSchema },
      },
    },
    async (request, reply) =>
      reply
        .code(202)
        .send(
          await memory.createIntegrationJob(principal(request), request.body),
        ),
  );

  app.get(
    MEMORY_ROUTES_V1.integrationGet,
    { schema: { response: { 200: integrationJobRouteSchema } } },
    async (request, reply) => {
      const caller = principal(request);
      return reply
        .code(200)
        .send(
          await memory.getIntegrationJob(
            caller,
            caller.scope.bot_id,
            pathId(request.params),
          ),
        );
    },
  );

  app.post(
    MEMORY_ROUTES_V1.integrationClaim,
    { schema: { response: { 200: integrationClaimRouteSchema } } },
    async (request, reply) =>
      reply.code(200).send(
        await memory.claimIntegrationJob(
          principal(request),
          workerInput(request) as Parameters<
            MemoryApplicationV1["claimIntegrationJob"]
          >[1],
        ),
      ),
  );

  app.post(
    MEMORY_ROUTES_V1.integrationCheckpoint,
    { schema: { response: { 200: integrationJobRouteSchema } } },
    async (request, reply) =>
      reply.code(200).send(
        await memory.checkpointIntegrationJob(
          principal(request),
          workerInput(request) as Parameters<
            MemoryApplicationV1["checkpointIntegrationJob"]
          >[1],
        ),
      ),
  );

  app.post(
    MEMORY_ROUTES_V1.integrationFinish,
    { schema: { response: { 200: integrationJobRouteSchema } } },
    async (request, reply) =>
      reply.code(200).send(
        await memory.finishIntegrationJob(
          principal(request),
          workerInput(request) as Parameters<
            MemoryApplicationV1["finishIntegrationJob"]
          >[1],
        ),
      ),
  );

  return app;
}
