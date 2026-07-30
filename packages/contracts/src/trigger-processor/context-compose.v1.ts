import { Type, type Static } from "@sinclair/typebox";

import {
  TriggerProcessorBotScopeV1Properties,
  TriggerProcessorIdentifierV1Schema,
  TriggerProcessorPositiveVersionV1Schema,
  TriggerProcessorReasonCodeV1Schema,
  TriggerProcessorSha256V1Schema,
  TriggerProcessorTimestampV1Schema,
} from "./contract-primitives.v1.js";
import {
  TriggerActorTypeV1Schema,
  TriggerSourceV1Schema,
} from "./trigger-admission.v1.js";

export const CONTEXT_SOURCE_NAMES_V1 = [
  "knowthat",
  "memory",
  "skill",
  "environment",
  "history",
] as const;

export const CONTEXT_SOURCE_OWNERS_V1 = Object.freeze({
  knowthat: "knowthat",
  memory: "memory",
  skill: "skill_registry",
  environment: "trigger_processor",
  history: "trigger_processor",
} as const);

export const ContextSourceNameV1Schema = Type.Union(
  CONTEXT_SOURCE_NAMES_V1.map((source) => Type.Literal(source)),
);

export const ContextSourceStatusV1Schema = Type.Union([
  Type.Literal("ok"),
  Type.Literal("empty"),
  Type.Literal("timeout"),
  Type.Literal("failed"),
  Type.Literal("degraded"),
  Type.Literal("skipped_by_policy"),
]);

const contextSourceOutcomeBase = {
  source: ContextSourceNameV1Schema,
  retrieved_at: TriggerProcessorTimestampV1Schema,
  source_as_of: Type.Union([TriggerProcessorTimestampV1Schema, Type.Null()]),
  source_version: Type.Union([
    TriggerProcessorIdentifierV1Schema,
    Type.Null(),
  ]),
  latency_ms: Type.Integer({ minimum: 0, maximum: 300_000 }),
  result_count: Type.Integer({ minimum: 0, maximum: 1_000_000 }),
  failure_reason: Type.Union([
    TriggerProcessorReasonCodeV1Schema,
    Type.Null(),
  ]),
} as const;

export const ContextSourceOutcomeV1Schema = Type.Union([
  Type.Object(
    {
      ...contextSourceOutcomeBase,
      status: Type.Union([
        Type.Literal("ok"),
        Type.Literal("empty"),
        Type.Literal("timeout"),
        Type.Literal("failed"),
        Type.Literal("degraded"),
      ]),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      ...contextSourceOutcomeBase,
      status: Type.Literal("skipped_by_policy"),
      policy_id: TriggerProcessorIdentifierV1Schema,
      reason_code: TriggerProcessorReasonCodeV1Schema,
      source_owner: TriggerProcessorIdentifierV1Schema,
    },
    { additionalProperties: false },
  ),
]);

const contextItemRefSchema = Type.Object(
  {
    ref: TriggerProcessorIdentifierV1Schema,
    version: TriggerProcessorIdentifierV1Schema,
    hash: Type.Optional(TriggerProcessorSha256V1Schema),
    summary: Type.String({ minLength: 1, maxLength: 16_384 }),
  },
  { additionalProperties: false },
);

const skillCatalogItemSchema = Type.Object(
  {
    skill_key: TriggerProcessorIdentifierV1Schema,
    name: Type.String({ minLength: 1, maxLength: 512 }),
    description: Type.String({ maxLength: 16_384 }),
    active_version: TriggerProcessorIdentifierV1Schema,
    package_digest: TriggerProcessorSha256V1Schema,
    manifest_digest: TriggerProcessorSha256V1Schema,
    runtime_target: TriggerProcessorIdentifierV1Schema,
  },
  { additionalProperties: false },
);

export const ContextSnapshotV1Schema = Type.Object(
  {
    schema_version: Type.Literal("context_snapshot.v1"),
    trigger_process_id: TriggerProcessorIdentifierV1Schema,
    context_version: TriggerProcessorPositiveVersionV1Schema,
    ...TriggerProcessorBotScopeV1Properties,
    pinned_facts: Type.Array(contextItemRefSchema, { maxItems: 10_000 }),
    memory_context: Type.Array(contextItemRefSchema, { maxItems: 10_000 }),
    skill_catalog: Type.Union([
      Type.Object(
        {
          catalog_version: TriggerProcessorIdentifierV1Schema,
          catalog_as_of: TriggerProcessorTimestampV1Schema,
          items: Type.Array(skillCatalogItemSchema, { maxItems: 10_000 }),
        },
        { additionalProperties: false },
      ),
      Type.Null(),
    ]),
    environment: Type.Union([
      Type.Object(
        {
          captured_at: TriggerProcessorTimestampV1Schema,
          channel: TriggerProcessorIdentifierV1Schema,
          timezone: TriggerProcessorIdentifierV1Schema,
          capability_summary_ref: TriggerProcessorIdentifierV1Schema,
        },
        { additionalProperties: false },
      ),
      Type.Null(),
    ]),
    history: Type.Array(contextItemRefSchema, { maxItems: 10_000 }),
    source_status: Type.Array(ContextSourceOutcomeV1Schema, {
      minItems: 5,
      maxItems: 5,
    }),
    assembly_notes: Type.Array(TriggerProcessorReasonCodeV1Schema, {
      maxItems: 1_000,
    }),
    snapshot_hash: TriggerProcessorSha256V1Schema,
  },
  {
    $id: "urn:pai:trigger-processor:context-snapshot:v1",
    additionalProperties: false,
  },
);

export const ContextComposeRequestV1Schema = Type.Object(
  {
    schema_version: Type.Literal("context_compose_request.v1"),
    trigger_process_id: TriggerProcessorIdentifierV1Schema,
    ...TriggerProcessorBotScopeV1Properties,
    trigger: Type.Object(
      {
        trigger_id: TriggerProcessorIdentifierV1Schema,
        source: TriggerSourceV1Schema,
        actor_type: TriggerActorTypeV1Schema,
      },
      { additionalProperties: false },
    ),
    context_version: TriggerProcessorPositiveVersionV1Schema,
    source_policy: Type.Object(
      {
        required_sources: Type.Array(ContextSourceNameV1Schema, {
          maxItems: 5,
          uniqueItems: true,
        }),
        allowed_sources: Type.Array(ContextSourceNameV1Schema, {
          minItems: 1,
          maxItems: 5,
          uniqueItems: true,
        }),
        skip_decisions: Type.Array(
          Type.Object(
            {
              source: ContextSourceNameV1Schema,
              policy_id: TriggerProcessorIdentifierV1Schema,
              reason_code: TriggerProcessorReasonCodeV1Schema,
              source_owner: TriggerProcessorIdentifierV1Schema,
            },
            { additionalProperties: false },
          ),
          { maxItems: 5 },
        ),
      },
      { additionalProperties: false },
    ),
    idempotency_key: TriggerProcessorIdentifierV1Schema,
    trace_id: TriggerProcessorIdentifierV1Schema,
  },
  { additionalProperties: false },
);

export const ContextComposeResponseV1Schema = Type.Object(
  {
    code: Type.Literal("context_composed"),
    message: Type.String({ minLength: 1, maxLength: 4096 }),
    retryable: Type.Literal(false),
    trace_id: TriggerProcessorIdentifierV1Schema,
    details: Type.Object(
      {
        context_snapshot_ref: TriggerProcessorIdentifierV1Schema,
        context_snapshot_version: TriggerProcessorPositiveVersionV1Schema,
        context_snapshot_hash: TriggerProcessorSha256V1Schema,
        source_status: Type.Array(ContextSourceOutcomeV1Schema, {
          minItems: 5,
          maxItems: 5,
        }),
        assembly_notes: Type.Array(TriggerProcessorReasonCodeV1Schema, {
          maxItems: 1_000,
        }),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

export const ContextComposeContractV1Schema = Type.Union(
  [ContextComposeRequestV1Schema, ContextComposeResponseV1Schema],
  { $id: "urn:pai:trigger-processor:context-compose:v1" },
);

export type ContextSourceNameV1 = Static<typeof ContextSourceNameV1Schema>;
export type ContextSourceOutcomeV1 = Static<typeof ContextSourceOutcomeV1Schema>;
export type ContextSnapshotV1 = Static<typeof ContextSnapshotV1Schema>;
export type ContextComposeRequestV1 = Static<typeof ContextComposeRequestV1Schema>;
export type ContextComposeResponseV1 = Static<
  typeof ContextComposeResponseV1Schema
>;

export function assertContextSourceOutcomesV1(
  outcomes: readonly ContextSourceOutcomeV1[],
): void {
  const counts = new Map<ContextSourceNameV1, number>(
    CONTEXT_SOURCE_NAMES_V1.map((source) => [source, 0]),
  );
  for (const outcome of outcomes) {
    counts.set(outcome.source, (counts.get(outcome.source) ?? 0) + 1);
    const hasOwnerSnapshot =
      outcome.source_as_of !== null && outcome.source_version !== null;
    const validStatusFacts =
      (outcome.status === "ok" &&
        outcome.result_count > 0 &&
        outcome.failure_reason === null &&
        hasOwnerSnapshot) ||
      (outcome.status === "empty" &&
        outcome.result_count === 0 &&
        outcome.failure_reason === null &&
        hasOwnerSnapshot) ||
      (outcome.status === "degraded" &&
        outcome.result_count > 0 &&
        outcome.failure_reason !== null &&
        hasOwnerSnapshot) ||
      ((outcome.status === "failed" || outcome.status === "timeout") &&
        outcome.result_count === 0 &&
        outcome.failure_reason !== null &&
        !hasOwnerSnapshot) ||
      (outcome.status === "skipped_by_policy" &&
        outcome.result_count === 0 &&
        outcome.failure_reason === null &&
        !hasOwnerSnapshot);
    if (
      !validStatusFacts ||
      (outcome.source_as_of !== null &&
        Date.parse(outcome.source_as_of) > Date.parse(outcome.retrieved_at))
    ) {
      throw new Error(
        "Context source status contradicts its durable result facts",
      );
    }
  }
  if (
    outcomes.length !== CONTEXT_SOURCE_NAMES_V1.length ||
    CONTEXT_SOURCE_NAMES_V1.some((source) => counts.get(source) !== 1)
  ) {
    throw new Error("ContextSnapshotV1 must contain exactly one outcome per source");
  }
}

export function assertContextComposeRequestBindingsV1(
  request: ContextComposeRequestV1,
): void {
  const expectedKey = `${request.trigger_process_id}:context:${request.context_version}`;
  const allowed = new Set(request.source_policy.allowed_sources);
  const required = new Set(request.source_policy.required_sources);
  const skipDecisions = new Map(
    request.source_policy.skip_decisions.map((decision) => [
      decision.source,
      decision,
    ]),
  );
  if (
    request.idempotency_key !== expectedKey ||
    skipDecisions.size !== request.source_policy.skip_decisions.length ||
    [...required].some(
      (source) => !allowed.has(source) || skipDecisions.has(source),
    ) ||
    request.source_policy.skip_decisions.some(
      (decision) =>
        decision.source_owner !== CONTEXT_SOURCE_OWNERS_V1[decision.source],
    ) ||
    CONTEXT_SOURCE_NAMES_V1.some(
      (source) => allowed.has(source) === skipDecisions.has(source),
    )
  ) {
    throw new Error("ContextComposeContractV1 semantic binding mismatch");
  }
}

export function assertContextSnapshotSemanticBindingsV1(
  snapshot: ContextSnapshotV1,
): void {
  assertContextSourceOutcomesV1(snapshot.source_status);
  const outcomeBySource = new Map(
    snapshot.source_status.map((outcome) => [outcome.source, outcome]),
  );
  const skill = outcomeBySource.get("skill");
  const environment = outcomeBySource.get("environment");
  const skillHasSnapshot = snapshot.skill_catalog !== null;
  const skillHasUsableOutcome =
    skill?.status === "ok" ||
    skill?.status === "empty" ||
    skill?.status === "degraded";
  if (
    snapshot.pinned_facts.length !==
      (outcomeBySource.get("knowthat")?.result_count ?? -1) ||
    snapshot.memory_context.length !==
      (outcomeBySource.get("memory")?.result_count ?? -1) ||
    snapshot.history.length !==
      (outcomeBySource.get("history")?.result_count ?? -1) ||
    skillHasSnapshot !== skillHasUsableOutcome ||
    (snapshot.skill_catalog !== null &&
      snapshot.skill_catalog.items.length !== skill?.result_count) ||
    (snapshot.skill_catalog !== null &&
      (skill?.source_as_of !== snapshot.skill_catalog.catalog_as_of ||
        skill.source_version !== snapshot.skill_catalog.catalog_version)) ||
    (snapshot.environment === null) !==
      (environment?.status === "skipped_by_policy") ||
    (snapshot.environment !== null &&
      (environment?.status !== "ok" && environment?.status !== "degraded")) ||
    (snapshot.environment !== null &&
      (environment?.result_count !== 1 ||
        environment?.source_as_of !== snapshot.environment.captured_at))
  ) {
    throw new Error("ContextSnapshotV1 provenance binding mismatch");
  }
}
