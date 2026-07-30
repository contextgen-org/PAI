import { Type, type Static } from "@sinclair/typebox";

import {
  SkillRuntimeScopeV1Properties,
  SkillRegistryCapabilityRefV1Schema,
  SkillRegistryIdentifierV1Schema,
  SkillRegistryPositiveIntegerV1Schema,
  SkillRegistrySecurityEpochV1Schema,
  SkillRegistrySha256V1Schema,
  SkillRegistryTimestampV1Schema,
  assertStrictlySortedUniqueStringsV1,
  skillRegistryCanonicalJsonV1,
} from "./primitives.v1.js";

export const SKILL_PERMISSION_SUMMARY_IMMUTABLE_TRIGGER_FUNCTION_BODY_V1 = `BEGIN
  RAISE EXCEPTION 'skill_permission_summary_immutable'
    USING ERRCODE = '55000';
END;` as const;

const permissionSummaryEntryIdentity = {
  skill_id: SkillRegistryIdentifierV1Schema,
  skill_key: SkillRegistryIdentifierV1Schema,
  activation_revision_id: SkillRegistryIdentifierV1Schema,
  version_id: SkillRegistryIdentifierV1Schema,
} as const;

export const SkillPermissionRevisionEntryV1Schema = Type.Object(
  {
    ...permissionSummaryEntryIdentity,
    decision_source: Type.Literal("revision"),
    permission_revision_id: SkillRegistryIdentifierV1Schema,
    revision_no: SkillRegistryPositiveIntegerV1Schema,
    decision: Type.Union([Type.Literal("grant"), Type.Literal("deny")]),
    scope_hash: SkillRegistrySha256V1Schema,
    owner_agent_condition: Type.Union([
      SkillRegistryIdentifierV1Schema,
      Type.Null(),
    ]),
    capability_refs: Type.Array(SkillRegistryCapabilityRefV1Schema, {
      maxItems: 1_024,
    }),
  },
  { additionalProperties: false },
);

export const SkillPermissionDefaultDenyEntryV1Schema = Type.Object(
  {
    ...permissionSummaryEntryIdentity,
    decision_source: Type.Literal("default_deny"),
    decision: Type.Literal("deny"),
    capability_refs: Type.Array(SkillRegistryCapabilityRefV1Schema, {
      maxItems: 0,
    }),
  },
  { additionalProperties: false },
);

export const SkillPermissionSummaryEntryV1Schema = Type.Union([
  SkillPermissionRevisionEntryV1Schema,
  SkillPermissionDefaultDenyEntryV1Schema,
]);

export const SkillPermissionSummaryV1Schema = Type.Object(
  {
    schema_version: Type.Literal("skill_permission_summary.v1"),
    summary_ref: SkillRegistryIdentifierV1Schema,
    ...SkillRuntimeScopeV1Properties,
    catalog_revision_id: SkillRegistryIdentifierV1Schema,
    catalog_version: SkillRegistryIdentifierV1Schema,
    catalog_as_of: SkillRegistryTimestampV1Schema,
    security_revocation_epoch: SkillRegistrySecurityEpochV1Schema,
    entries: Type.Array(SkillPermissionSummaryEntryV1Schema, {
      maxItems: 100_000,
    }),
    summary_hash: SkillRegistrySha256V1Schema,
  },
  {
    $id: "urn:pai:skill-registry:permission-summary:v1",
    additionalProperties: false,
  },
);

export type SkillPermissionRevisionEntryV1 = Static<
  typeof SkillPermissionRevisionEntryV1Schema
>;
export type SkillPermissionDefaultDenyEntryV1 = Static<
  typeof SkillPermissionDefaultDenyEntryV1Schema
>;
export type SkillPermissionSummaryEntryV1 = Static<
  typeof SkillPermissionSummaryEntryV1Schema
>;
export type SkillPermissionSummaryV1 = Static<
  typeof SkillPermissionSummaryV1Schema
>;

export function skillPermissionSummaryCanonicalBytesV1(
  summary: SkillPermissionSummaryV1,
): string {
  const { summary_hash: _summaryHash, ...hashable } = summary;
  return skillRegistryCanonicalJsonV1(hashable);
}

export function assertSkillPermissionSummarySemanticBindingsV1(
  summary: SkillPermissionSummaryV1,
  calculateSha256: (canonicalUtf8: string) => string,
): void {
  let previousSkillId: string | undefined;
  for (const entry of summary.entries) {
    if (previousSkillId !== undefined && previousSkillId >= entry.skill_id) {
      throw new Error("permission summary entries must be ordered by skill_id");
    }
    assertStrictlySortedUniqueStringsV1(
      entry.capability_refs,
      "capability_refs",
    );
    previousSkillId = entry.skill_id;
  }
  const calculated = calculateSha256(
    skillPermissionSummaryCanonicalBytesV1(summary),
  );
  if (calculated !== summary.summary_hash) {
    throw new Error("SkillPermissionSummaryV1 hash mismatch");
  }
}

export function assertSkillPermissionSummarySnapshotBindingsV1(
  left: SkillPermissionSummaryV1,
  right: SkillPermissionSummaryV1,
): void {
  if (
    left.summary_ref !== right.summary_ref ||
    left.summary_hash !== right.summary_hash ||
    skillPermissionSummaryCanonicalBytesV1(left) !==
      skillPermissionSummaryCanonicalBytesV1(right)
  ) {
    throw new Error("immutable permission summary historical replay drifted");
  }
}
