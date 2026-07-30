import { Type, type Static } from "@sinclair/typebox";

import { canonicalJsonV1 } from "../shared/canonical-json.v1.js";
import { DeploymentEnvironmentV1Schema } from "../shared/deployment-environment.v1.js";
import {
  JsonSafeNonNegativeIntegerV1,
  JsonSafePositiveIntegerV1,
} from "../shared/json-safe-integer.v1.js";
import { ReleaseChannelV1Schema } from "../shared/release-channel.v1.js";
import {
  TriggerProcessorIdentifierV1Schema,
  TriggerProcessorSha256V1Schema,
  TriggerProcessorUtcTimestampV1Schema,
} from "../trigger-processor/index-internal.v1.js";

export const ToolPermissionProfileSelectorV1Schema = Type.Object(
  {
    workspace_id: TriggerProcessorIdentifierV1Schema,
    bot_id: TriggerProcessorIdentifierV1Schema,
    owner_agent_id: TriggerProcessorIdentifierV1Schema,
    deployment_environment: DeploymentEnvironmentV1Schema,
    release_channel: ReleaseChannelV1Schema,
  },
  { additionalProperties: false },
);

const jsonRecord = Type.Record(Type.String(), Type.Unknown());

export const ToolPermissionProfileV1Schema = Type.Object(
  {
    schema_version: Type.Literal("tool_permission_profile.v1"),
    selector: ToolPermissionProfileSelectorV1Schema,
    profile_ref: TriggerProcessorIdentifierV1Schema,
    revision: JsonSafePositiveIntegerV1,
    profile_hash: TriggerProcessorSha256V1Schema,
    allowed_tools: Type.Array(TriggerProcessorIdentifierV1Schema, {
      maxItems: 10_000,
      uniqueItems: true,
    }),
    tool_arg_constraints: jsonRecord,
    resource_scopes: jsonRecord,
    network_scope: jsonRecord,
    filesystem_scope: jsonRecord,
    timer_scope: jsonRecord,
    memory_scope: jsonRecord,
    policy_epoch: JsonSafeNonNegativeIntegerV1,
    effective_at: TriggerProcessorUtcTimestampV1Schema,
  },
  {
    $id: "urn:pai:action-runtime:tool-permission-profile:v1",
    additionalProperties: false,
  },
);

export type ToolPermissionProfileSelectorV1 = Static<
  typeof ToolPermissionProfileSelectorV1Schema
>;
export type ToolPermissionProfileV1 = Static<
  typeof ToolPermissionProfileV1Schema
>;

function compareUnicodeCodePointsV1(left: string, right: string): number {
  const leftPoints = Array.from(left, (value) => value.codePointAt(0)!);
  const rightPoints = Array.from(right, (value) => value.codePointAt(0)!);
  const length = Math.min(leftPoints.length, rightPoints.length);
  for (let index = 0; index < length; index += 1) {
    const difference = leftPoints[index]! - rightPoints[index]!;
    if (difference !== 0) return difference;
  }
  return leftPoints.length - rightPoints.length;
}

export function toolPermissionProfileCanonicalBytesV1(
  profile: ToolPermissionProfileV1,
): string {
  const { profile_hash: _profileHash, ...hashable } = profile;
  return canonicalJsonV1(hashable, {
    max_bytes: 2_097_152,
    max_depth: 64,
    max_nodes: 100_000,
    max_container_entries: 10_000,
  });
}

export function assertToolPermissionProfileSemanticBindingsV1(
  profile: ToolPermissionProfileV1,
  calculateSha256: (canonicalUtf8: string) => string,
): void {
  for (let index = 1; index < profile.allowed_tools.length; index += 1) {
    if (
      compareUnicodeCodePointsV1(
        profile.allowed_tools[index - 1]!,
        profile.allowed_tools[index]!,
      ) >= 0
    ) {
      throw new Error(
        "ToolPermissionProfileV1 allowed_tools must be Unicode code-point sorted and unique",
      );
    }
  }
  if (
    calculateSha256(toolPermissionProfileCanonicalBytesV1(profile)) !==
    profile.profile_hash
  ) {
    throw new Error("ToolPermissionProfileV1 profile_hash mismatch");
  }
}

export function assertToolPermissionProfileRevisionTransitionV1(
  previous: ToolPermissionProfileV1,
  next: ToolPermissionProfileV1,
): void {
  const sameSelector =
    canonicalJsonV1(previous.selector) === canonicalJsonV1(next.selector);
  if (
    !sameSelector ||
    previous.profile_ref === next.profile_ref ||
    next.revision !== previous.revision + 1 ||
    next.policy_epoch < previous.policy_epoch
  ) {
    throw new Error("ToolPermissionProfileV1 revision transition mismatch");
  }
}
