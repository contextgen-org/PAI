import { Type, type Static } from "@sinclair/typebox";

import {
  SKILL_RUNTIME_TARGET_V1,
  SkillRegistryIdentifierV1Schema,
  SkillRegistrySemverV1Schema,
  SkillRegistrySha256V1Schema,
  SkillRegistrySkillNameV1Schema,
  SkillRegistryTimestampV1Schema,
  skillRegistryEnvelopeV1,
} from "./primitives.v1.js";

export const SkillPublishRequestV1Schema = Type.Object(
  {
    schema_version: Type.Literal("skill_publish_request.v1"),
    skill_name: SkillRegistrySkillNameV1Schema,
    semver: SkillRegistrySemverV1Schema,
    validation_id: SkillRegistryIdentifierV1Schema,
    package_digest: SkillRegistrySha256V1Schema,
    manifest_digest: SkillRegistrySha256V1Schema,
    artifact_ref: SkillRegistryIdentifierV1Schema,
    idempotency_key: SkillRegistryIdentifierV1Schema,
    trace_id: SkillRegistryIdentifierV1Schema,
  },
  {
    $id: "urn:pai:skill-registry:publish-request:v1",
    additionalProperties: false,
  },
);

export const SkillPublishDetailsV1Schema = Type.Object(
  {
    skill_version_id: SkillRegistryIdentifierV1Schema,
    skill_name: SkillRegistrySkillNameV1Schema,
    version: SkillRegistrySemverV1Schema,
    state: Type.Literal("published"),
    package_digest: SkillRegistrySha256V1Schema,
    manifest_digest: SkillRegistrySha256V1Schema,
    runtime_target: Type.Literal(SKILL_RUNTIME_TARGET_V1),
    created_at: SkillRegistryTimestampV1Schema,
    duplicate_replayed: Type.Boolean(),
  },
  { additionalProperties: false },
);

export const SkillPublishResponseV1Schema = skillRegistryEnvelopeV1(
  "skill_version_published",
  SkillPublishDetailsV1Schema,
);

export const SkillPublishContractV1Schema = Type.Union(
  [SkillPublishRequestV1Schema, SkillPublishResponseV1Schema],
  { $id: "urn:pai:skill-registry:publish:v1" },
);

export type SkillPublishRequestV1 = Static<typeof SkillPublishRequestV1Schema>;
export type SkillPublishDetailsV1 = Static<typeof SkillPublishDetailsV1Schema>;
export type SkillPublishResponseV1 = Static<
  typeof SkillPublishResponseV1Schema
>;

export function assertSkillPublishRequestSemanticBindingsV1(
  request: SkillPublishRequestV1,
): void {
  if (
    request.idempotency_key !==
    `publish:${request.skill_name}:${request.semver}:${request.package_digest}`
  ) {
    throw new Error("SkillPublishRequestV1 idempotency binding mismatch");
  }
}

export function assertSkillPublishSemanticBindingsV1(
  request: SkillPublishRequestV1,
  response: SkillPublishResponseV1,
): void {
  assertSkillPublishRequestSemanticBindingsV1(request);
  if (
    response.details.skill_name !== request.skill_name ||
    response.details.version !== request.semver ||
    response.details.package_digest !== request.package_digest ||
    response.details.manifest_digest !== request.manifest_digest
  ) {
    throw new Error("SkillPublishContractV1 semantic binding mismatch");
  }
}
