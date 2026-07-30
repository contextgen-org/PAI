import { Type, type Static } from "@sinclair/typebox";

import {
  SKILL_PACKAGE_MAX_BYTES_V1,
  SkillPackageManifestV1Schema,
  SkillRegistryIdentifierV1Schema,
  SkillRegistrySha256V1Schema,
  SkillRegistryTimestampV1Schema,
  assertSkillPackageManifestSemanticBindingsV1,
  skillRegistryEnvelopeV1,
} from "./primitives.v1.js";

export const SKILL_VALIDATION_DIAGNOSTIC_MAX_ITEMS_V1 = 4_096;
export const SKILL_VALIDATION_RECORD_TTL_SECONDS_V1 = 1_800;

export const SkillValidateRequestV1Schema = Type.Object(
  {
    schema_version: Type.Literal("skill_validate_request.v1"),
    artifact_ref: SkillRegistryIdentifierV1Schema,
    content_digest: SkillRegistrySha256V1Schema,
    media_type: Type.String({ minLength: 1, maxLength: 256 }),
    size_bytes: Type.Integer({
      minimum: 0,
      maximum: SKILL_PACKAGE_MAX_BYTES_V1,
    }),
    idempotency_key: SkillRegistryIdentifierV1Schema,
    trace_id: SkillRegistryIdentifierV1Schema,
  },
  {
    $id: "urn:pai:skill-registry:validate-request:v1",
    additionalProperties: false,
  },
);

export const SkillValidationDiagnosticV1Schema = Type.Object(
  {
    severity: Type.Union([
      Type.Literal("info"),
      Type.Literal("warning"),
      Type.Literal("error"),
    ]),
    code: SkillRegistryIdentifierV1Schema,
    path: Type.String({ maxLength: 4_096 }),
    message: Type.String({ minLength: 1, maxLength: 4_096 }),
  },
  { additionalProperties: false },
);

export const SkillValidateDetailsV1Schema = Type.Object(
  {
    validation_id: SkillRegistryIdentifierV1Schema,
    package_digest: SkillRegistrySha256V1Schema,
    manifest_digest: SkillRegistrySha256V1Schema,
    normalized_manifest: SkillPackageManifestV1Schema,
    diagnostics: Type.Array(SkillValidationDiagnosticV1Schema, {
      maxItems: SKILL_VALIDATION_DIAGNOSTIC_MAX_ITEMS_V1,
    }),
    expires_at: SkillRegistryTimestampV1Schema,
  },
  { additionalProperties: false },
);

export const SkillValidateResponseV1Schema = skillRegistryEnvelopeV1(
  "skill_package_validated",
  SkillValidateDetailsV1Schema,
);

export const SkillValidateContractV1Schema = Type.Union(
  [SkillValidateRequestV1Schema, SkillValidateResponseV1Schema],
  { $id: "urn:pai:skill-registry:validate:v1" },
);

export type SkillValidateRequestV1 = Static<
  typeof SkillValidateRequestV1Schema
>;
export type SkillValidationDiagnosticV1 = Static<
  typeof SkillValidationDiagnosticV1Schema
>;
export type SkillValidateDetailsV1 = Static<
  typeof SkillValidateDetailsV1Schema
>;
export type SkillValidateResponseV1 = Static<
  typeof SkillValidateResponseV1Schema
>;

export function assertSkillValidateRequestSemanticBindingsV1(
  request: SkillValidateRequestV1,
): void {
  if (request.idempotency_key !== `validate:${request.content_digest}`) {
    throw new Error("SkillValidateRequestV1 idempotency binding mismatch");
  }
}

export function assertSkillValidateResponseSemanticBindingsV1(
  request: SkillValidateRequestV1,
  response: SkillValidateResponseV1,
): void {
  if (
    response.trace_id !== request.trace_id ||
    response.details.package_digest !== request.content_digest
  ) {
    throw new Error("SkillValidateContractV1 response binding mismatch");
  }
  assertSkillPackageManifestSemanticBindingsV1(
    response.details.normalized_manifest,
  );
}
