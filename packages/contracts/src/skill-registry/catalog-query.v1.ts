import { Type, type Static } from "@sinclair/typebox";

import {
  SkillRuntimeScopeV1Properties,
  SkillRegistryCapabilityRefV1Schema,
  SkillRegistryIdentifierV1Schema,
  SkillRegistryPositiveIntegerV1Schema,
  SkillRegistrySecurityEpochV1Schema,
  SkillRegistrySha256V1Schema,
  SkillRegistryTimestampV1Schema,
  SkillRegistrySemverV1Schema,
  assertStrictlySortedUniqueStringsV1,
  skillRegistryEnvelopeV1,
} from "./primitives.v1.js";

export const SKILL_CATALOG_QUERY_MAX_LIMIT_V1 = 500;

export const SKILL_CATALOG_INVALID_CURSOR_REASONS_V1 = Object.freeze([
  "malformed",
  "context_changed",
  "expired",
] as const);

export const SkillCatalogQueryRequestV1Schema = Type.Object(
  {
    schema_version: Type.Literal("skill_catalog_query.v1"),
    ...SkillRuntimeScopeV1Properties,
    as_of: Type.Optional(SkillRegistryTimestampV1Schema),
    filter: Type.Optional(Type.String({ maxLength: 4_096 })),
    cursor: Type.Optional(SkillRegistryIdentifierV1Schema),
    limit: Type.Integer({
      minimum: 1,
      maximum: SKILL_CATALOG_QUERY_MAX_LIMIT_V1,
    }),
    trace_id: SkillRegistryIdentifierV1Schema,
  },
  {
    $id: "urn:pai:skill-registry:catalog-query-request:v1",
    additionalProperties: false,
  },
);

export const SkillCatalogItemV1Schema = Type.Object(
  {
    skill_id: SkillRegistryIdentifierV1Schema,
    skill_key: SkillRegistryIdentifierV1Schema,
    skill_name: SkillRegistryIdentifierV1Schema,
    version_id: SkillRegistryIdentifierV1Schema,
    version: SkillRegistrySemverV1Schema,
    activation_revision_id: SkillRegistryIdentifierV1Schema,
    lifecycle_state: Type.Union([
      Type.Literal("published"),
      Type.Literal("deprecated"),
    ]),
    capability_refs: Type.Array(SkillRegistryCapabilityRefV1Schema, {
      maxItems: 1_024,
    }),
  },
  { additionalProperties: false },
);

export const SkillCatalogQueryDetailsV1Schema = Type.Object(
  {
    schema_version: Type.Literal("skill_catalog_response.v1"),
    ...SkillRuntimeScopeV1Properties,
    catalog_revision_id: SkillRegistryIdentifierV1Schema,
    catalog_version: SkillRegistryIdentifierV1Schema,
    as_of: SkillRegistryTimestampV1Schema,
    security_revocation_epoch: SkillRegistrySecurityEpochV1Schema,
    skill_permission_summary_ref: SkillRegistryIdentifierV1Schema,
    skill_permission_summary_hash: SkillRegistrySha256V1Schema,
    items: Type.Array(SkillCatalogItemV1Schema, {
      maxItems: SKILL_CATALOG_QUERY_MAX_LIMIT_V1,
    }),
    next_cursor: Type.Union([SkillRegistryIdentifierV1Schema, Type.Null()]),
  },
  { additionalProperties: false },
);

export const SkillCatalogQueryResponseV1Schema = skillRegistryEnvelopeV1(
  "skill_catalog_found",
  SkillCatalogQueryDetailsV1Schema,
);

export const SkillCatalogInvalidCursorV1Schema = skillRegistryEnvelopeV1(
  "invalid_cursor",
  Type.Object(
    {
      reason: Type.Union(
        SKILL_CATALOG_INVALID_CURSOR_REASONS_V1.map((reason) =>
          Type.Literal(reason),
        ),
      ),
      restart_from_first_page: Type.Literal(true),
    },
    { additionalProperties: false },
  ),
);

export const SkillCatalogQueryContractV1Schema = Type.Union(
  [
    SkillCatalogQueryRequestV1Schema,
    SkillCatalogQueryResponseV1Schema,
    SkillCatalogInvalidCursorV1Schema,
  ],
  { $id: "urn:pai:skill-registry:catalog-query:v1" },
);

export type SkillCatalogQueryRequestV1 = Static<
  typeof SkillCatalogQueryRequestV1Schema
>;
export type SkillCatalogItemV1 = Static<typeof SkillCatalogItemV1Schema>;
export type SkillCatalogQueryDetailsV1 = Static<
  typeof SkillCatalogQueryDetailsV1Schema
>;
export type SkillCatalogQueryResponseV1 = Static<
  typeof SkillCatalogQueryResponseV1Schema
>;

export interface SkillCatalogCursorBindingsV1 {
  readonly workspace_id: string;
  readonly bot_id: string;
  readonly deployment_environment: string;
  readonly release_channel: string;
  readonly owner_agent_id: string;
  readonly principal_id: string;
  readonly authorization_context_hash: string;
  readonly catalog_version: string;
  readonly as_of: string;
  readonly security_revocation_epoch: number;
  readonly skill_permission_summary_ref: string;
  readonly skill_permission_summary_hash: string;
  readonly limit: number;
  readonly filter_hash: string;
  readonly schema_version: "skill_catalog_query.v1";
}

export function assertSkillCatalogQuerySemanticBindingsV1(
  request: SkillCatalogQueryRequestV1,
  response: SkillCatalogQueryResponseV1,
): void {
  const details = response.details;
  if (
    response.trace_id !== request.trace_id ||
    details.workspace_id !== request.workspace_id ||
    details.bot_id !== request.bot_id ||
    details.owner_agent_id !== request.owner_agent_id ||
    details.deployment_environment !== request.deployment_environment ||
    details.release_channel !== request.release_channel ||
    (request.as_of !== undefined && details.as_of !== request.as_of) ||
    details.items.length > request.limit
  ) {
    throw new Error("SkillCatalogQueryContractV1 page binding mismatch");
  }
  let previousSkillId: string | undefined;
  for (const item of details.items) {
    if (previousSkillId !== undefined && previousSkillId >= item.skill_id) {
      throw new Error("catalog items must be ordered by skill_id");
    }
    assertStrictlySortedUniqueStringsV1(
      item.capability_refs,
      "capability_refs",
    );
    previousSkillId = item.skill_id;
  }
}

export function assertSkillCatalogCursorBindingsV1(
  expected: SkillCatalogCursorBindingsV1,
  actual: SkillCatalogCursorBindingsV1,
): void {
  for (const key of Object.keys(expected) as Array<
    keyof SkillCatalogCursorBindingsV1
  >) {
    if (expected[key] !== actual[key]) {
      throw new Error("skill catalog cursor context changed");
    }
  }
}
