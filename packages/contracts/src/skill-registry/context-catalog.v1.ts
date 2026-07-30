import { Type, type Static } from "@sinclair/typebox";

import {
  SkillRegistryIdentifierV1Schema,
  SkillRegistrySha256V1Schema,
  SkillRegistryTimestampV1Schema,
  SkillRuntimeScopeV1Properties,
  SKILL_RUNTIME_TARGET_V1,
  skillRegistryEnvelopeV1,
} from "./primitives.v1.js";

/**
 * Immutable Skill owner facts used when Trigger Processor freezes a Context
 * Snapshot.  This is deliberately distinct from the policy Catalog query:
 * Context needs the package and manifest identities that the policy summary
 * does not expose.
 */
export const SkillContextCatalogRequestV1Schema = Type.Object(
  {
    schema_version: Type.Literal("skill_context_catalog_request.v1"),
    ...SkillRuntimeScopeV1Properties,
    limit: Type.Integer({ minimum: 1, maximum: 500 }),
    trace_id: SkillRegistryIdentifierV1Schema,
  },
  {
    $id: "urn:pai:skill-registry:context-catalog-request:v1",
    additionalProperties: false,
  },
);

export const SkillContextCatalogItemV1Schema = Type.Object(
  {
    skill_key: SkillRegistryIdentifierV1Schema,
    name: Type.String({ minLength: 1, maxLength: 512 }),
    description: Type.String({ maxLength: 16_384 }),
    active_version: SkillRegistryIdentifierV1Schema,
    package_digest: SkillRegistrySha256V1Schema,
    manifest_digest: SkillRegistrySha256V1Schema,
    runtime_target: Type.Literal(SKILL_RUNTIME_TARGET_V1),
  },
  { additionalProperties: false },
);

export const SkillContextCatalogDetailsV1Schema = Type.Object(
  {
    schema_version: Type.Literal("skill_context_catalog_response.v1"),
    ...SkillRuntimeScopeV1Properties,
    catalog_version: SkillRegistryIdentifierV1Schema,
    as_of: SkillRegistryTimestampV1Schema,
    items: Type.Array(SkillContextCatalogItemV1Schema, { maxItems: 500 }),
  },
  { additionalProperties: false },
);

export const SkillContextCatalogResponseV1Schema = skillRegistryEnvelopeV1(
  "skill_context_catalog_found",
  SkillContextCatalogDetailsV1Schema,
);

export const SkillContextCatalogContractV1Schema = Type.Union(
  [SkillContextCatalogRequestV1Schema, SkillContextCatalogResponseV1Schema],
  { $id: "urn:pai:skill-registry:context-catalog:v1" },
);

export type SkillContextCatalogRequestV1 = Static<
  typeof SkillContextCatalogRequestV1Schema
>;
export type SkillContextCatalogItemV1 = Static<
  typeof SkillContextCatalogItemV1Schema
>;
export type SkillContextCatalogDetailsV1 = Static<
  typeof SkillContextCatalogDetailsV1Schema
>;
export type SkillContextCatalogResponseV1 = Static<
  typeof SkillContextCatalogResponseV1Schema
>;

export function assertSkillContextCatalogBindingsV1(
  request: SkillContextCatalogRequestV1,
  response: SkillContextCatalogResponseV1,
): void {
  const details = response.details;
  if (
    response.trace_id !== request.trace_id ||
    details.workspace_id !== request.workspace_id ||
    details.bot_id !== request.bot_id ||
    details.owner_agent_id !== request.owner_agent_id ||
    details.deployment_environment !== request.deployment_environment ||
    details.release_channel !== request.release_channel ||
    details.items.length > request.limit
  ) {
    throw new Error("Skill context catalog owner scope binding mismatch");
  }
  let previousKey: string | undefined;
  for (const item of details.items) {
    if (previousKey !== undefined && previousKey >= item.skill_key) {
      throw new Error("Skill context catalog items must be ordered by skill_key");
    }
    previousKey = item.skill_key;
  }
}
