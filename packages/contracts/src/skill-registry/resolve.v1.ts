import { Type, type Static } from "@sinclair/typebox";

import {
  SkillRegistryCapabilityRefV1Schema,
  SkillRegistryIdentifierV1Schema,
  SkillRegistryPositiveIntegerV1Schema,
  SkillRegistrySecurityEpochV1Schema,
  SkillRegistrySha256V1Schema,
  SkillRegistryTimestampV1Schema,
  SkillRegistrySkillNameV1Schema,
  SkillRuntimeScopeV1Properties,
  SKILL_RUNTIME_TARGET_V1,
  assertStrictlySortedUniqueStringsV1,
  skillRegistryEnvelopeV1,
} from "./primitives.v1.js";

export const SKILL_RESOLVE_ERROR_PRECEDENCE_V1 = Object.freeze([
  "authorization_scope_mismatch",
  "invalid_runtime_policy",
  "catalog_version_conflict",
  "permission_denied",
  "version_revoked",
  "required_skill_unavailable",
] as const);

export const SKILL_INVALID_RUNTIME_POLICY_REASONS_V1 = Object.freeze([
  "expires_at_missing",
  "expired",
  "lifetime_exceeded",
  "ref_hash_mismatch",
  "skill_permission_summary_missing",
  "skill_permission_summary_ref_hash_mismatch",
  "skill_permission_summary_scope_mismatch",
] as const);

export const SkillResolveItemRequestV1Schema = Type.Object(
  {
    name: SkillRegistrySkillNameV1Schema,
    version_constraint: Type.Literal("catalog_revision"),
    required: Type.Boolean(),
  },
  { additionalProperties: false },
);

export const SkillResolveRequestV1Schema = Type.Object(
  {
    schema_version: Type.Literal("skill_resolution_request.v1"),
    runtime_run_id: SkillRegistryIdentifierV1Schema,
    start_attempt_no: SkillRegistryPositiveIntegerV1Schema,
    ...SkillRuntimeScopeV1Properties,
    expected_catalog_version: SkillRegistryIdentifierV1Schema,
    catalog_as_of: SkillRegistryTimestampV1Schema,
    policy_input_ref: SkillRegistryIdentifierV1Schema,
    policy_input_hash: SkillRegistrySha256V1Schema,
    skills: Type.Array(SkillResolveItemRequestV1Schema, {
      minItems: 1,
      maxItems: 512,
    }),
    idempotency_key: SkillRegistryIdentifierV1Schema,
    trace_id: SkillRegistryIdentifierV1Schema,
  },
  {
    $id: "urn:pai:skill-registry:resolve-request:v1",
    additionalProperties: false,
  },
);

export const ResolvedSkillV1Schema = Type.Object(
  {
    resolution_id: SkillRegistryIdentifierV1Schema,
    skill_id: SkillRegistryIdentifierV1Schema,
    skill_key: SkillRegistryIdentifierV1Schema,
    version_id: SkillRegistryIdentifierV1Schema,
    version: Type.String({ minLength: 1, maxLength: 128 }),
    package_digest: SkillRegistrySha256V1Schema,
    manifest_digest: SkillRegistrySha256V1Schema,
    runtime_target: Type.Literal(SKILL_RUNTIME_TARGET_V1),
    granted_capability_refs: Type.Array(
      SkillRegistryCapabilityRefV1Schema,
      { maxItems: 1_024 },
    ),
    required: Type.Boolean(),
    valid_until: SkillRegistryTimestampV1Schema,
  },
  { additionalProperties: false },
);

export const SkillResolveDegradationV1Schema = Type.Object(
  {
    skill_key: SkillRegistryIdentifierV1Schema,
    reason: Type.Union([
      Type.Literal("not_found"),
      Type.Literal("activation_disabled"),
      Type.Literal("permission_denied"),
      Type.Literal("version_revoked"),
    ]),
  },
  { additionalProperties: false },
);

export const SkillResolveDetailsV1Schema = Type.Object(
  {
    schema_version: Type.Literal("skill_resolution_response.v1"),
    resolution_attempt_id: SkillRegistryIdentifierV1Schema,
    runtime_run_id: SkillRegistryIdentifierV1Schema,
    start_attempt_no: SkillRegistryPositiveIntegerV1Schema,
    ...SkillRuntimeScopeV1Properties,
    requested_catalog_version: SkillRegistryIdentifierV1Schema,
    effective_catalog_version: SkillRegistryIdentifierV1Schema,
    catalog_as_of: SkillRegistryTimestampV1Schema,
    security_revocation_epoch: SkillRegistrySecurityEpochV1Schema,
    policy_input_hash: SkillRegistrySha256V1Schema,
    valid_until: SkillRegistryTimestampV1Schema,
    resolved_skills: Type.Array(ResolvedSkillV1Schema, { maxItems: 512 }),
    degradation_notes: Type.Array(SkillResolveDegradationV1Schema, {
      maxItems: 512,
    }),
    duplicate_replayed: Type.Boolean(),
  },
  { additionalProperties: false },
);

export const SkillResolveResponseV1Schema = skillRegistryEnvelopeV1(
  "skill_resolution_succeeded",
  SkillResolveDetailsV1Schema,
);

export const SkillResolveInvalidRuntimePolicyV1Schema =
  skillRegistryEnvelopeV1(
    "invalid_runtime_policy",
    Type.Object(
      {
        reason_code: Type.Union(
          SKILL_INVALID_RUNTIME_POLICY_REASONS_V1.map((reason) =>
            Type.Literal(reason),
          ),
        ),
      },
      { additionalProperties: false },
    ),
  );

export const SkillResolveErrorV1Schema = Type.Union([
  SkillResolveInvalidRuntimePolicyV1Schema,
  ...SKILL_RESOLVE_ERROR_PRECEDENCE_V1.filter(
    (code) => code !== "invalid_runtime_policy",
  ).map((code) =>
    skillRegistryEnvelopeV1(
      code,
      Type.Record(Type.String(), Type.Unknown()),
    ),
  ),
]);

export const SkillResolveContractV1Schema = Type.Union(
  [
    SkillResolveRequestV1Schema,
    SkillResolveResponseV1Schema,
    SkillResolveErrorV1Schema,
  ],
  { $id: "urn:pai:skill-registry:resolve:v1" },
);

export type SkillResolveItemRequestV1 = Static<
  typeof SkillResolveItemRequestV1Schema
>;
export type SkillResolveRequestV1 = Static<typeof SkillResolveRequestV1Schema>;
export type ResolvedSkillV1 = Static<typeof ResolvedSkillV1Schema>;
export type SkillResolveDetailsV1 = Static<typeof SkillResolveDetailsV1Schema>;
export type SkillResolveResponseV1 = Static<
  typeof SkillResolveResponseV1Schema
>;

export function assertSkillResolveRequestSemanticBindingsV1(
  request: SkillResolveRequestV1,
): void {
  const expectedIdempotencyKey =
    `${request.runtime_run_id}:skill-resolution:attempt:${request.start_attempt_no}`;
  const names = request.skills.map((item) => item.name);
  if (
    request.idempotency_key !== expectedIdempotencyKey ||
    new Set(names).size !== names.length
  ) {
    throw new Error("SkillResolveRequestV1 attempt identity mismatch");
  }
}

export function assertSkillResolveResponseSemanticBindingsV1(
  request: SkillResolveRequestV1,
  response: SkillResolveResponseV1,
  policyExpiresAt: string,
): void {
  const details = response.details;
  if (
    details.runtime_run_id !== request.runtime_run_id ||
    details.start_attempt_no !== request.start_attempt_no ||
    details.workspace_id !== request.workspace_id ||
    details.bot_id !== request.bot_id ||
    details.owner_agent_id !== request.owner_agent_id ||
    details.deployment_environment !== request.deployment_environment ||
    details.release_channel !== request.release_channel ||
    details.requested_catalog_version !== request.expected_catalog_version ||
    details.effective_catalog_version !== request.expected_catalog_version ||
    details.catalog_as_of !== request.catalog_as_of ||
    details.policy_input_hash !== request.policy_input_hash ||
    details.valid_until !== policyExpiresAt ||
    details.resolved_skills.some(
      (skill) =>
        skill.valid_until !== policyExpiresAt ||
        skill.runtime_target !== SKILL_RUNTIME_TARGET_V1,
    )
  ) {
    throw new Error("SkillResolveContractV1 semantic binding mismatch");
  }
  for (const skill of details.resolved_skills) {
    assertStrictlySortedUniqueStringsV1(
      skill.granted_capability_refs,
      "granted_capability_refs",
    );
  }
}
