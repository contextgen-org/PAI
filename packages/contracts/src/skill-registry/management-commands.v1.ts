import { Type, type Static } from "@sinclair/typebox";

import {
  SkillCatalogScopeV1Properties,
  SkillRegistryCapabilityRefV1Schema,
  SkillRegistryIdentifierV1Schema,
  SkillRegistryPositiveIntegerV1Schema,
  SkillRegistrySecurityEpochV1Schema,
  SkillRegistrySha256V1Schema,
  assertStrictlySortedUniqueStringsV1,
  skillRegistryEnvelopeV1,
} from "./primitives.v1.js";

const commandCommon = {
  schema_version: Type.Literal("skill.management-command.v1"),
  skill_id: SkillRegistryIdentifierV1Schema,
  reason: Type.String({ minLength: 1, maxLength: 4_096 }),
  idempotency_key: SkillRegistryIdentifierV1Schema,
  trace_id: SkillRegistryIdentifierV1Schema,
} as const;

const scopedCommandCommon = {
  ...commandCommon,
  scope_kind: Type.Literal("scoped"),
  ...SkillCatalogScopeV1Properties,
} as const;

export const SkillActivateCommandV1Schema = Type.Object(
  {
    ...scopedCommandCommon,
    operation: Type.Literal("activate"),
    version_id: SkillRegistryIdentifierV1Schema,
    expected_catalog_version: SkillRegistryIdentifierV1Schema,
    expected_activation_revision: SkillRegistryIdentifierV1Schema,
  },
  { additionalProperties: false },
);

export const SkillRollbackCommandV1Schema = Type.Object(
  {
    ...scopedCommandCommon,
    operation: Type.Literal("rollback"),
    target_version_id: SkillRegistryIdentifierV1Schema,
    expected_catalog_version: SkillRegistryIdentifierV1Schema,
    expected_activation_revision: SkillRegistryIdentifierV1Schema,
  },
  { additionalProperties: false },
);

export const SkillDisableCommandV1Schema = Type.Object(
  {
    ...scopedCommandCommon,
    operation: Type.Literal("disable"),
    expected_catalog_version: SkillRegistryIdentifierV1Schema,
    expected_activation_revision: SkillRegistryIdentifierV1Schema,
  },
  { additionalProperties: false },
);

function permissionCommand(operation: "permission_grant" | "permission_revoke") {
  return Type.Object(
    {
      ...scopedCommandCommon,
      operation: Type.Literal(operation),
      owner_agent_id: Type.Optional(SkillRegistryIdentifierV1Schema),
      capability_refs: Type.Array(SkillRegistryCapabilityRefV1Schema, {
        minItems: 1,
        maxItems: 1_024,
      }),
      scope_hash: SkillRegistrySha256V1Schema,
      expected_catalog_version: SkillRegistryIdentifierV1Schema,
      expected_permission_revision: SkillRegistryIdentifierV1Schema,
    },
    { additionalProperties: false },
  );
}

export const SkillPermissionGrantCommandV1Schema =
  permissionCommand("permission_grant");
export const SkillPermissionRevokeCommandV1Schema =
  permissionCommand("permission_revoke");

export const SkillDeprecateCommandV1Schema = Type.Object(
  {
    ...commandCommon,
    operation: Type.Literal("deprecate"),
    scope_kind: Type.Literal("global"),
    version_id: SkillRegistryIdentifierV1Schema,
    expected_lifecycle_version: SkillRegistryPositiveIntegerV1Schema,
  },
  { additionalProperties: false },
);

export const SkillRevokeCommandV1Schema = Type.Object(
  {
    ...commandCommon,
    operation: Type.Literal("revoke"),
    scope_kind: Type.Literal("global"),
    version_id: SkillRegistryIdentifierV1Schema,
    expected_lifecycle_version: SkillRegistryPositiveIntegerV1Schema,
    emergency: Type.Boolean(),
  },
  { additionalProperties: false },
);

export const SkillManagementCommandRequestV1Schema = Type.Union([
  SkillActivateCommandV1Schema,
  SkillRollbackCommandV1Schema,
  SkillDisableCommandV1Schema,
  SkillPermissionGrantCommandV1Schema,
  SkillPermissionRevokeCommandV1Schema,
  SkillDeprecateCommandV1Schema,
  SkillRevokeCommandV1Schema,
]);

function scopedResponse(
  operation:
    | "activate"
    | "rollback"
    | "disable"
    | "permission_grant"
    | "permission_revoke",
) {
  return Type.Object(
    {
      scope_kind: Type.Literal("scoped"),
      operation: Type.Literal(operation),
      command_id: SkillRegistryIdentifierV1Schema,
      ...SkillCatalogScopeV1Properties,
      previous_revision: SkillRegistryIdentifierV1Schema,
      new_revision: SkillRegistryIdentifierV1Schema,
      catalog_version: SkillRegistryIdentifierV1Schema,
      security_revocation_epoch: SkillRegistrySecurityEpochV1Schema,
      duplicate_replayed: Type.Boolean(),
    },
    { additionalProperties: false },
  );
}

function globalResponse(
  operation: "deprecate" | "revoke",
  lifecycleState: "deprecated" | "revoked",
) {
  return Type.Object(
    {
      scope_kind: Type.Literal("global"),
      operation: Type.Literal(operation),
      command_id: SkillRegistryIdentifierV1Schema,
      skill_id: SkillRegistryIdentifierV1Schema,
      version_id: SkillRegistryIdentifierV1Schema,
      previous_lifecycle_version: SkillRegistryPositiveIntegerV1Schema,
      new_lifecycle_version: SkillRegistryPositiveIntegerV1Schema,
      lifecycle_state: Type.Literal(lifecycleState),
      security_revocation_epoch: SkillRegistrySecurityEpochV1Schema,
      duplicate_replayed: Type.Boolean(),
    },
    { additionalProperties: false },
  );
}

export const SkillManagementCommandResponseV1Schema = Type.Union([
  scopedResponse("activate"),
  scopedResponse("rollback"),
  scopedResponse("disable"),
  scopedResponse("permission_grant"),
  scopedResponse("permission_revoke"),
  globalResponse("deprecate", "deprecated"),
  globalResponse("revoke", "revoked"),
]);

export const SKILL_MANAGEMENT_SUCCESS_CODES_V1 = Object.freeze({
  activate: "skill_version_activated",
  rollback: "skill_activation_rolled_back",
  disable: "skill_activation_disabled",
  permission_grant: "skill_permission_granted",
  permission_revoke: "skill_permission_revoked",
  deprecate: "skill_version_deprecated",
  revoke: "skill_version_revoked",
} as const);

export const SkillManagementCommandEnvelopeV1Schema = Type.Union([
  skillRegistryEnvelopeV1(
    SKILL_MANAGEMENT_SUCCESS_CODES_V1.activate,
    scopedResponse("activate"),
  ),
  skillRegistryEnvelopeV1(
    SKILL_MANAGEMENT_SUCCESS_CODES_V1.rollback,
    scopedResponse("rollback"),
  ),
  skillRegistryEnvelopeV1(
    SKILL_MANAGEMENT_SUCCESS_CODES_V1.disable,
    scopedResponse("disable"),
  ),
  skillRegistryEnvelopeV1(
    SKILL_MANAGEMENT_SUCCESS_CODES_V1.permission_grant,
    scopedResponse("permission_grant"),
  ),
  skillRegistryEnvelopeV1(
    SKILL_MANAGEMENT_SUCCESS_CODES_V1.permission_revoke,
    scopedResponse("permission_revoke"),
  ),
  skillRegistryEnvelopeV1(
    SKILL_MANAGEMENT_SUCCESS_CODES_V1.deprecate,
    globalResponse("deprecate", "deprecated"),
  ),
  skillRegistryEnvelopeV1(
    SKILL_MANAGEMENT_SUCCESS_CODES_V1.revoke,
    globalResponse("revoke", "revoked"),
  ),
]);

export const SkillManagementCommandV1Schema = Type.Union(
  [
    SkillManagementCommandRequestV1Schema,
    SkillManagementCommandResponseV1Schema,
    SkillManagementCommandEnvelopeV1Schema,
  ],
  { $id: "urn:pai:skill-registry:management-command:v1" },
);

export type SkillManagementCommandRequestV1 = Static<
  typeof SkillManagementCommandRequestV1Schema
>;
export type SkillActivateCommandV1 = Static<typeof SkillActivateCommandV1Schema>;
export type SkillRollbackCommandV1 = Static<
  typeof SkillRollbackCommandV1Schema
>;
export type SkillDisableCommandV1 = Static<
  typeof SkillDisableCommandV1Schema
>;
export type SkillPermissionGrantCommandV1 = Static<
  typeof SkillPermissionGrantCommandV1Schema
>;
export type SkillPermissionRevokeCommandV1 = Static<
  typeof SkillPermissionRevokeCommandV1Schema
>;
export type SkillDeprecateCommandV1 = Static<
  typeof SkillDeprecateCommandV1Schema
>;
export type SkillRevokeCommandV1 = Static<
  typeof SkillRevokeCommandV1Schema
>;
export type SkillManagementCommandResponseV1 = Static<
  typeof SkillManagementCommandResponseV1Schema
>;
export type SkillManagementCommandEnvelopeV1 = Static<
  typeof SkillManagementCommandEnvelopeV1Schema
>;

export function assertSkillManagementCommandSemanticBindingsV1(
  request: SkillManagementCommandRequestV1,
  response: SkillManagementCommandResponseV1,
): void {
  const expectedScopedRevision =
    request.operation === "activate" ||
    request.operation === "rollback" ||
    request.operation === "disable"
      ? request.expected_activation_revision
      : request.operation === "permission_grant" ||
          request.operation === "permission_revoke"
        ? request.expected_permission_revision
        : undefined;
  if (
    response.operation !== request.operation ||
    response.scope_kind !== request.scope_kind ||
    (response.scope_kind === "scoped" &&
      (request.scope_kind !== "scoped" ||
        response.workspace_id !== request.workspace_id ||
        response.bot_id !== request.bot_id ||
        response.deployment_environment !== request.deployment_environment ||
        response.release_channel !== request.release_channel ||
        response.previous_revision !== expectedScopedRevision)) ||
    (response.scope_kind === "global" &&
      (request.scope_kind !== "global" ||
        response.skill_id !== request.skill_id ||
        response.version_id !== request.version_id ||
        response.previous_lifecycle_version !==
          request.expected_lifecycle_version ||
        response.new_lifecycle_version <= response.previous_lifecycle_version))
  ) {
    throw new Error("SkillManagementCommandV1 semantic binding mismatch");
  }
  if (
    request.operation === "permission_grant" ||
    request.operation === "permission_revoke"
  ) {
    assertStrictlySortedUniqueStringsV1(
      request.capability_refs,
      "capability_refs",
    );
  }
}

export function skillManagementIdempotencyNamespaceV1(
  request: SkillManagementCommandRequestV1,
): string {
  return request.scope_kind === "global"
    ? `global:${request.operation}:${request.skill_id}:${request.version_id}`
    : `scoped:${request.operation}:${request.workspace_id}:${request.bot_id}:${request.deployment_environment}:${request.release_channel}:${request.skill_id}`;
}
