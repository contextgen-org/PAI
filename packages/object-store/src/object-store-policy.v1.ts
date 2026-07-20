import type { ServiceIdV1 } from "@pai/contracts";

export const OBJECT_STORE_BUCKETS_V1 = [
  "tp-snapshots",
  "ar-artifacts",
  "skill-packages",
] as const;

export type ObjectStoreBucketV1 = (typeof OBJECT_STORE_BUCKETS_V1)[number];

export interface ObjectOperationCapabilitiesV1 {
  readonly put: readonly string[];
  readonly head: readonly string[];
  readonly get: readonly string[];
  readonly grant: readonly string[];
  readonly delete: readonly string[];
}

export interface ObjectClassPolicyV1 {
  readonly owner_service: ServiceIdV1;
  readonly object_class: string;
  readonly bucket: ObjectStoreBucketV1;
  readonly scope_kinds: readonly ("bot" | "global")[];
  readonly max_size_bytes: number;
  readonly media_types: readonly string[];
  readonly capabilities: ObjectOperationCapabilitiesV1;
}

export const PAI_OBJECT_CLASS_POLICY_BASES_V1 = {
  trigger_process_snapshot: {
    owner_service: "trigger_processor",
    object_class: "trigger_process_snapshot",
    bucket: "tp-snapshots",
    scope_kinds: ["bot"],
    capabilities: {
      put: ["trigger_process.snapshot.manage"],
      head: ["trigger_process.snapshot.resolve"],
      get: ["trigger_process.snapshot.resolve"],
      grant: ["trigger_process.snapshot.resolve"],
      delete: ["trigger_process.snapshot.manage"],
    },
  },
  runtime_artifact: {
    owner_service: "action_runtime",
    object_class: "runtime_artifact",
    bucket: "ar-artifacts",
    scope_kinds: ["bot"],
    capabilities: {
      put: ["runtime.artifact.write"],
      head: ["runtime.artifact.read"],
      get: ["runtime.artifact.read"],
      grant: ["runtime.artifact.read"],
      delete: ["runtime.artifact.delete"],
    },
  },
  skill_package: {
    owner_service: "skill_registry",
    object_class: "skill_package",
    bucket: "skill-packages",
    scope_kinds: ["global"],
    capabilities: {
      put: ["skill.package.write"],
      head: ["skill.content.read"],
      get: ["skill.content.read"],
      grant: ["skill.content.read"],
      delete: ["skill.package.delete"],
    },
  },
} as const;

export type PaiObjectClassV1 = keyof typeof PAI_OBJECT_CLASS_POLICY_BASES_V1;

export type PaiObjectClassLimitsV1 = Readonly<
  Record<
    PaiObjectClassV1,
    {
      readonly max_size_bytes: number;
      readonly media_types: readonly string[];
    }
  >
>;

/** Limits are owner/deployment inputs; missing limits never fall back to infinity. */
export function createPaiObjectClassPoliciesV1(
  limits: PaiObjectClassLimitsV1,
): readonly ObjectClassPolicyV1[] {
  return Object.entries(PAI_OBJECT_CLASS_POLICY_BASES_V1).map(
    ([objectClass, base]) => ({
      ...base,
      ...limits[objectClass as PaiObjectClassV1],
    }),
  );
}

const ownerBuckets: Readonly<
  Partial<Record<ServiceIdV1, ObjectStoreBucketV1>>
> = {
  trigger_processor: "tp-snapshots",
  action_runtime: "ar-artifacts",
  skill_registry: "skill-packages",
};

const capabilityPattern = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/;
const objectClassPattern = /^[a-z][a-z0-9_]{0,63}$/;

export function validateObjectClassPoliciesV1(
  policies: readonly ObjectClassPolicyV1[],
): void {
  if (policies.length === 0) {
    throw new Error("at least one object class policy is required");
  }
  const keys = new Set<string>();
  for (const policy of policies) {
    const expectedBucket = ownerBuckets[policy.owner_service];
    if (expectedBucket === undefined || policy.bucket !== expectedBucket) {
      throw new Error(
        `owner ${policy.owner_service} cannot use bucket ${policy.bucket}`,
      );
    }
    if (!objectClassPattern.test(policy.object_class)) {
      throw new Error(`invalid object class: ${policy.object_class}`);
    }
    if (
      !Number.isSafeInteger(policy.max_size_bytes) ||
      policy.max_size_bytes < 1 ||
      policy.media_types.length === 0 ||
      policy.scope_kinds.length === 0 ||
      new Set(policy.scope_kinds).size !== policy.scope_kinds.length ||
      new Set(policy.media_types).size !== policy.media_types.length ||
      policy.media_types.some((mediaType) => !mediaType.includes("/"))
    ) {
      throw new Error(`invalid object limits for ${policy.object_class}`);
    }
    const key = `${policy.owner_service}:${policy.object_class}`;
    if (keys.has(key)) throw new Error(`duplicate object class policy: ${key}`);
    keys.add(key);
    for (const [operation, capabilities] of Object.entries(
      policy.capabilities,
    ) as [string, readonly string[]][]) {
      if (
        capabilities.length === 0 ||
        new Set(capabilities).size !== capabilities.length ||
        capabilities.some((capability) => !capabilityPattern.test(capability))
      ) {
        throw new Error(
          `invalid ${operation} capabilities for object class ${policy.object_class}`,
        );
      }
    }
  }
}
