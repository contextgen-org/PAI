import { isProxy } from "node:util/types";

import {
  RUNTIME_POLICY_MAX_LIFETIME_MS_V1,
  SKILL_CATALOG_QUERY_MAX_LIMIT_V1,
  SKILL_CONTENT_GRANT_MAX_TTL_SECONDS_V1,
  SKILL_PACKAGE_MAX_BYTES_V1,
} from "@pai/contracts";

export interface SkillRegistryConfigV1 {
  readonly package_max_bytes: number;
  readonly manifest_max_bytes: number;
  readonly validation_timeout_seconds: number;
  readonly catalog_page_size: number;
  readonly catalog_revision_retention_days: number;
  readonly content_cache_ttl_seconds: number;
  readonly signed_content_token_ttl_seconds: number;
  readonly idempotency_retention_days: number;
  readonly outbox_batch_size: number;
  readonly outbox_retention_days: number;
  readonly max_runtime_policy_lifetime_ms: number;
}

export const SKILL_REGISTRY_CONFIG_DEFAULTS_V1 =
  Object.freeze<SkillRegistryConfigV1>({
    package_max_bytes: SKILL_PACKAGE_MAX_BYTES_V1,
    manifest_max_bytes: 262_144,
    validation_timeout_seconds: 60,
    catalog_page_size: 100,
    catalog_revision_retention_days: 90,
    content_cache_ttl_seconds: 300,
    signed_content_token_ttl_seconds:
      SKILL_CONTENT_GRANT_MAX_TTL_SECONDS_V1,
    idempotency_retention_days: 7,
    outbox_batch_size: 100,
    outbox_retention_days: 14,
    max_runtime_policy_lifetime_ms: RUNTIME_POLICY_MAX_LIFETIME_MS_V1,
  });

const configKeys = Object.freeze(
  Object.keys(SKILL_REGISTRY_CONFIG_DEFAULTS_V1) as Array<
    keyof SkillRegistryConfigV1
  >,
);

function configRecord(value: unknown): Readonly<Record<string, unknown>> {
  if (value === undefined) return Object.freeze({});
  if (
    typeof value !== "object" ||
    value === null ||
    isProxy(value) ||
    Array.isArray(value)
  ) {
    throw new Error("Skill Registry configuration must be a plain object");
  }
  let prototype: object | null;
  let descriptors: PropertyDescriptorMap;
  try {
    prototype = Object.getPrototypeOf(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    throw new Error("Skill Registry configuration must be a plain object");
  }
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error("Skill Registry configuration must be a plain object");
  }
  const result = Object.create(null) as Record<string, unknown>;
  for (const key of Reflect.ownKeys(descriptors)) {
    if (
      typeof key !== "string" ||
      !configKeys.includes(key as keyof SkillRegistryConfigV1)
    ) {
      throw new Error(`unknown Skill Registry configuration key: ${String(key)}`);
    }
    const descriptor = descriptors[key];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true ||
      descriptor.get !== undefined ||
      descriptor.set !== undefined
    ) {
      throw new Error(`Skill Registry configuration ${key} must be a data value`);
    }
    result[key] = descriptor.value;
  }
  return result;
}

function boundedInteger(
  value: number,
  minimum: number,
  maximum: number,
  key: keyof SkillRegistryConfigV1,
): void {
  if (
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new Error(
      `Skill Registry configuration ${key} must be an integer from ${minimum} to ${maximum}`,
    );
  }
}

/**
 * Resolves only owner-documented keys. Unknown keys, wrong units, values
 * outside hard bounds, and cross-field contradictions fail startup.
 */
export function resolveSkillRegistryConfigV1(
  value?: unknown,
): Readonly<SkillRegistryConfigV1> {
  const supplied = configRecord(value);
  const config = {
    ...SKILL_REGISTRY_CONFIG_DEFAULTS_V1,
    ...supplied,
  } as SkillRegistryConfigV1;

  boundedInteger(
    config.package_max_bytes,
    1,
    SKILL_PACKAGE_MAX_BYTES_V1,
    "package_max_bytes",
  );
  boundedInteger(
    config.manifest_max_bytes,
    16_384,
    1_048_576,
    "manifest_max_bytes",
  );
  boundedInteger(
    config.validation_timeout_seconds,
    5,
    300,
    "validation_timeout_seconds",
  );
  boundedInteger(
    config.catalog_page_size,
    1,
    SKILL_CATALOG_QUERY_MAX_LIMIT_V1,
    "catalog_page_size",
  );
  boundedInteger(
    config.catalog_revision_retention_days,
    30,
    365,
    "catalog_revision_retention_days",
  );
  boundedInteger(
    config.content_cache_ttl_seconds,
    30,
    3_600,
    "content_cache_ttl_seconds",
  );
  boundedInteger(
    config.signed_content_token_ttl_seconds,
    30,
    SKILL_CONTENT_GRANT_MAX_TTL_SECONDS_V1,
    "signed_content_token_ttl_seconds",
  );
  boundedInteger(
    config.idempotency_retention_days,
    1,
    30,
    "idempotency_retention_days",
  );
  boundedInteger(
    config.outbox_batch_size,
    1,
    1_000,
    "outbox_batch_size",
  );
  boundedInteger(
    config.outbox_retention_days,
    7,
    90,
    "outbox_retention_days",
  );
  if (
    config.max_runtime_policy_lifetime_ms !==
    RUNTIME_POLICY_MAX_LIFETIME_MS_V1
  ) {
    throw new Error(
      "Skill Registry max_runtime_policy_lifetime_ms is fixed at 86400000",
    );
  }
  if (config.manifest_max_bytes >= config.package_max_bytes) {
    throw new Error(
      "Skill Registry manifest_max_bytes must be less than package_max_bytes",
    );
  }
  if (
    config.signed_content_token_ttl_seconds >
    config.content_cache_ttl_seconds
  ) {
    throw new Error(
      "Skill Registry signed_content_token_ttl_seconds must not exceed content_cache_ttl_seconds",
    );
  }
  return Object.freeze({ ...config });
}
