import { Type, type Static } from "@sinclair/typebox";

import {
  SKILL_CONTENT_GRANT_MAX_TTL_SECONDS_V1,
  SKILL_RUNTIME_TARGET_V1,
  SkillCatalogScopeV1Properties,
  SkillRegistryIdentifierV1Schema,
  SkillRegistryNonNegativeIntegerV1Schema,
  SkillRegistrySecurityEpochV1Schema,
  SkillRegistrySha256V1Schema,
  SkillRegistryTimestampV1Schema,
  skillRegistryEnvelopeV1,
} from "./primitives.v1.js";

export const SkillContentRequestV1Schema = Type.Object(
  {
    schema_version: Type.Literal("skill_content_request.v1"),
    resolution_id: SkillRegistryIdentifierV1Schema,
    runtime_run_id: SkillRegistryIdentifierV1Schema,
    ...SkillCatalogScopeV1Properties,
    owner_agent_id: Type.Optional(SkillRegistryIdentifierV1Schema),
    expected_package_digest: SkillRegistrySha256V1Schema,
    expected_manifest_digest: SkillRegistrySha256V1Schema,
    security_revocation_epoch: SkillRegistrySecurityEpochV1Schema,
    trace_id: SkillRegistryIdentifierV1Schema,
  },
  {
    $id: "urn:pai:skill-registry:content-request:v1",
    additionalProperties: false,
  },
);

export const SkillContentDetailsV1Schema = Type.Object(
  {
    content_ref: SkillRegistryIdentifierV1Schema,
    content_type: Type.String({ minLength: 1, maxLength: 256 }),
    size_bytes: SkillRegistryNonNegativeIntegerV1Schema,
    package_digest: SkillRegistrySha256V1Schema,
    manifest_digest: SkillRegistrySha256V1Schema,
    entrypoint: Type.Literal("SKILL.md"),
    expires_at: SkillRegistryTimestampV1Schema,
    runtime_target: Type.Literal(SKILL_RUNTIME_TARGET_V1),
  },
  { additionalProperties: false },
);

export const SkillContentResponseV1Schema = skillRegistryEnvelopeV1(
  "skill_content_authorized",
  SkillContentDetailsV1Schema,
);

export const SkillContentContractV1Schema = Type.Union(
  [SkillContentRequestV1Schema, SkillContentResponseV1Schema],
  { $id: "urn:pai:skill-registry:content:v1" },
);

export type SkillContentRequestV1 = Static<typeof SkillContentRequestV1Schema>;
export type SkillContentDetailsV1 = Static<typeof SkillContentDetailsV1Schema>;
export type SkillContentResponseV1 = Static<
  typeof SkillContentResponseV1Schema
>;

export function assertSkillContentResponseSemanticBindingsV1(
  request: SkillContentRequestV1,
  response: SkillContentResponseV1,
  resolutionValidUntil: string,
  issuedAtMs: number,
): void {
  const maximumExpiry = Math.min(
    issuedAtMs + SKILL_CONTENT_GRANT_MAX_TTL_SECONDS_V1 * 1_000,
    Date.parse(resolutionValidUntil),
  );
  if (
    !Number.isFinite(issuedAtMs) ||
    !Number.isFinite(maximumExpiry) ||
    response.details.package_digest !== request.expected_package_digest ||
    response.details.manifest_digest !== request.expected_manifest_digest ||
    Date.parse(response.details.expires_at) > maximumExpiry ||
    Date.parse(response.details.expires_at) <= issuedAtMs
  ) {
    throw new Error("SkillContentContractV1 semantic binding mismatch");
  }
}
