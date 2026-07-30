import { FormatRegistry, Type, type Static, type TSchema } from "@sinclair/typebox";

import { canonicalJsonV1 } from "../shared/canonical-json.v1.js";
import { DeploymentEnvironmentV1Schema } from "../shared/deployment-environment.v1.js";
import { ReleaseChannelV1Schema } from "../shared/release-channel.v1.js";

if (!FormatRegistry.Has("date-time")) {
  FormatRegistry.Set(
    "date-time",
    (value) =>
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.test(
        value,
      ) && Number.isFinite(Date.parse(value)),
  );
}

export const SKILL_RUNTIME_TARGET_V1 = "filesystem_bundle.v1" as const;
export const SKILL_PACKAGE_MAX_BYTES_V1 = 31_457_280;
export const SKILL_PACKAGE_MAX_FILES_V1 = 512;
export const SKILL_ENTRYPOINT_MAX_BYTES_V1 = 262_144;
export const SKILL_CONTENT_GRANT_MAX_TTL_SECONDS_V1 = 300;
export const RUNTIME_POLICY_MAX_LIFETIME_MS_V1 = 86_400_000;

export const SkillRegistryIdentifierV1Schema = Type.String({
  minLength: 1,
  maxLength: 512,
});
export const SkillRegistrySha256V1Schema = Type.String({
  pattern: "^sha256:[0-9a-f]{64}$",
});
export const SkillRegistryTimestampV1Schema = Type.String({
  format: "date-time",
});
export const SkillRegistryNonNegativeIntegerV1Schema = Type.Integer({
  minimum: 0,
  maximum: Number.MAX_SAFE_INTEGER,
});
export const SkillRegistryPositiveIntegerV1Schema = Type.Integer({
  minimum: 1,
  maximum: Number.MAX_SAFE_INTEGER,
});
export const SkillRegistrySemverV1Schema = Type.String({
  pattern:
    "^(?:0|[1-9][0-9]*)\\.(?:0|[1-9][0-9]*)\\.(?:0|[1-9][0-9]*)(?:-[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?$",
  maxLength: 128,
});
export const SkillRegistrySkillNameV1Schema = Type.String({
  pattern: "^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$",
  maxLength: 64,
});
export const SkillRegistryCapabilityRefV1Schema = Type.String({
  minLength: 1,
  maxLength: 256,
});
export const SkillRegistrySecurityEpochV1Schema =
  SkillRegistryNonNegativeIntegerV1Schema;

export const SkillCatalogScopeV1Properties = {
  workspace_id: SkillRegistryIdentifierV1Schema,
  bot_id: SkillRegistryIdentifierV1Schema,
  deployment_environment: DeploymentEnvironmentV1Schema,
  release_channel: ReleaseChannelV1Schema,
} as const;

export const SkillRuntimeScopeV1Properties = {
  ...SkillCatalogScopeV1Properties,
  owner_agent_id: SkillRegistryIdentifierV1Schema,
} as const;

export const SkillManifestFileV1Schema = Type.Object(
  {
    path: Type.String({ minLength: 1, maxLength: 4_096 }),
    mode: Type.String({ pattern: "^0[0-7]{3}$" }),
    size_bytes: SkillRegistryNonNegativeIntegerV1Schema,
    sha256: SkillRegistrySha256V1Schema,
  },
  { additionalProperties: false },
);

export const SkillPackageManifestV1Schema = Type.Object(
  {
    schema_version: Type.Literal("skill_package_manifest.v1"),
    runtime_target: Type.Literal(SKILL_RUNTIME_TARGET_V1),
    files: Type.Array(SkillManifestFileV1Schema, {
      minItems: 1,
      maxItems: SKILL_PACKAGE_MAX_FILES_V1,
    }),
  },
  { additionalProperties: false },
);

export function skillRegistryEnvelopeV1<
  const TCode extends string,
  const TDetails extends TSchema,
>(
  code: TCode,
  details: TDetails,
) {
  return Type.Object(
    {
      code: Type.Literal(code),
      message: Type.String({ minLength: 1, maxLength: 4_096 }),
      retryable: Type.Literal(false),
      details,
      trace_id: SkillRegistryIdentifierV1Schema,
    },
    { additionalProperties: false },
  );
}

export type SkillManifestFileV1 = Static<typeof SkillManifestFileV1Schema>;
export type SkillPackageManifestV1 = Static<
  typeof SkillPackageManifestV1Schema
>;
export type SkillCatalogScopeV1 = Static<
  ReturnType<typeof Type.Object<typeof SkillCatalogScopeV1Properties>>
>;
export type SkillRuntimeScopeV1 = Static<
  ReturnType<typeof Type.Object<typeof SkillRuntimeScopeV1Properties>>
>;

export function skillRegistryCanonicalJsonV1(value: unknown): string {
  return canonicalJsonV1(value, {
    max_bytes: SKILL_PACKAGE_MAX_BYTES_V1,
    max_depth: 64,
    max_nodes: 1_000_000,
    max_container_entries: 100_000,
  });
}

export function assertStrictlySortedUniqueStringsV1(
  values: readonly string[],
  field: string,
): void {
  for (let index = 1; index < values.length; index += 1) {
    if (values[index - 1]! >= values[index]!) {
      throw new Error(`${field} must be strictly sorted and unique`);
    }
  }
}

export function assertSkillPackageManifestSemanticBindingsV1(
  manifest: SkillPackageManifestV1,
): void {
  let expandedBytes = 0;
  let previousPath: string | undefined;
  let entrypointCount = 0;
  for (const file of manifest.files) {
    if (
      file.path !== file.path.normalize("NFC") ||
      file.path.startsWith("/") ||
      file.path.includes("\\") ||
      /[\u0000-\u001f\u007f]/u.test(file.path) ||
      file.path
        .split("/")
        .some((segment) => segment === "" || segment === "." || segment === "..") ||
      (previousPath !== undefined && previousPath >= file.path)
    ) {
      throw new Error("manifest paths must be normalized, safe, sorted, and unique");
    }
    expandedBytes += file.size_bytes;
    if (
      !Number.isSafeInteger(expandedBytes) ||
      expandedBytes > SKILL_PACKAGE_MAX_BYTES_V1
    ) {
      throw new Error("manifest expanded bytes exceed the hard limit");
    }
    if (file.path === "SKILL.md") {
      entrypointCount += 1;
      if (file.size_bytes > SKILL_ENTRYPOINT_MAX_BYTES_V1) {
        throw new Error("SKILL.md exceeds the hard limit");
      }
    }
    previousPath = file.path;
  }
  if (entrypointCount !== 1) {
    throw new Error("manifest requires exactly one top-level SKILL.md");
  }
}
