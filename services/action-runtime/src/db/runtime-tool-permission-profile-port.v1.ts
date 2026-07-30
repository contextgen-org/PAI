import { createHash } from "node:crypto";

import {
  RuntimeToolInvocationRequestV1Schema,
  ToolPermissionProfileV1Schema,
  assertToolPermissionProfileSemanticBindingsV1,
  type ToolPermissionProfileV1,
} from "@pai/contracts";
import { canonicalJsonV1 } from "@pai/eventing";
import type { PostgresQueryPortV1 } from "@pai/persistence";
import { Value } from "@sinclair/typebox/value";

import {
  RuntimeExecutionErrorV1,
  type RuntimeToolPermissionProfilePortV1,
  type RuntimeToolPermissionProfileV1,
} from "../runtime-execution.v1.js";

const TOOL_PERMISSION_PROFILE_EXACT_READ_SQL_V1 = `
SELECT
  workspace_id,
  bot_id,
  owner_agent_id,
  deployment_environment,
  release_channel,
  profile_ref,
  revision,
  profile_hash,
  allowed_tools,
  tool_arg_constraints,
  resource_scopes,
  network_scope,
  filesystem_scope,
  timer_scope,
  memory_scope,
  policy_epoch,
  pg_catalog.to_char(
    effective_at AT TIME ZONE 'UTC',
    -- ToolPermissionProfile hashes canonically bind millisecond RFC3339
    -- timestamps. Keep exact reads byte-compatible with the current-profile
    -- read path; formatting the same instant with trailing microseconds
    -- otherwise turns a valid immutable profile into a hash mismatch.
    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
  ) AS effective_at
FROM action_runtime.tool_permission_profile_revisions
WHERE workspace_id = $1::text
  AND bot_id = $2::text
  AND owner_agent_id = $3::text
  AND deployment_environment = $4::text
  AND release_channel = $5::text
  AND profile_ref = $6::text
  AND revision = $7::bigint
  AND profile_hash = $8::text
  AND policy_epoch = $9::bigint
LIMIT 2`;

interface ToolPermissionProfileExactRowV1
  extends Record<string, unknown> {
  readonly workspace_id: unknown;
  readonly bot_id: unknown;
  readonly owner_agent_id: unknown;
  readonly deployment_environment: unknown;
  readonly release_channel: unknown;
  readonly profile_ref: unknown;
  readonly revision: unknown;
  readonly profile_hash: unknown;
  readonly allowed_tools: unknown;
  readonly tool_arg_constraints: unknown;
  readonly resource_scopes: unknown;
  readonly network_scope: unknown;
  readonly filesystem_scope: unknown;
  readonly timer_scope: unknown;
  readonly memory_scope: unknown;
  readonly policy_epoch: unknown;
  readonly effective_at: unknown;
}

function sha256V1(value: string): string {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function safeIntegerV1(value: unknown, minimum: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum) {
    throw new Error("ToolPermissionProfile safe-integer drift");
  }
  return parsed;
}

function immutableJsonV1<T>(value: T): T {
  return JSON.parse(canonicalJsonV1(value)) as T;
}

function throwIfAbortedV1(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) throw signal.reason;
}

function plainRecordV1(value: unknown): value is Readonly<Record<string, unknown>> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  );
}

function validateToolConstraintV1(
  constraint: unknown,
  argumentsValue: unknown,
): boolean {
  if (!plainRecordV1(constraint)) return false;
  const keys = Object.keys(constraint);
  if (keys.length === 0) return true;
  if (keys.some((key) => key !== "max_bytes")) return false;
  const maximumBytes = constraint.max_bytes;
  if (
    !Number.isSafeInteger(maximumBytes) ||
    (maximumBytes as number) < 1 ||
    (maximumBytes as number) > 2_097_152
  ) {
    return false;
  }
  try {
    return (
      Buffer.byteLength(canonicalJsonV1(argumentsValue), "utf8") <=
      (maximumBytes as number)
    );
  } catch {
    return false;
  }
}

function profileFromRowV1(
  row: ToolPermissionProfileExactRowV1,
): ToolPermissionProfileV1 {
  return {
    schema_version: "tool_permission_profile.v1",
    selector: {
      workspace_id: row.workspace_id as string,
      bot_id: row.bot_id as string,
      owner_agent_id: row.owner_agent_id as string,
      deployment_environment:
        row.deployment_environment as ToolPermissionProfileV1["selector"]["deployment_environment"],
      release_channel:
        row.release_channel as ToolPermissionProfileV1["selector"]["release_channel"],
    },
    profile_ref: row.profile_ref as string,
    revision: safeIntegerV1(row.revision, 1),
    profile_hash: row.profile_hash as `sha256:${string}`,
    allowed_tools: row.allowed_tools as string[],
    tool_arg_constraints: row.tool_arg_constraints as Record<string, unknown>,
    resource_scopes: row.resource_scopes as Record<string, unknown>,
    network_scope: row.network_scope as Record<string, unknown>,
    filesystem_scope: row.filesystem_scope as Record<string, unknown>,
    timer_scope: row.timer_scope as Record<string, unknown>,
    memory_scope: row.memory_scope as Record<string, unknown>,
    policy_epoch: safeIntegerV1(row.policy_epoch, 0),
    effective_at: row.effective_at as string,
  };
}

function runtimeProfileV1(
  profileValue: ToolPermissionProfileV1,
): RuntimeToolPermissionProfileV1 {
  const profile = immutableJsonV1(profileValue);
  const constraints = profile.tool_arg_constraints;
  const allowedTools = new Set(profile.allowed_tools);
  return Object.freeze({
    profile_ref: profile.profile_ref,
    revision: profile.revision,
    profile_hash: profile.profile_hash,
    policy_epoch: profile.policy_epoch,
    allowed_tools: Object.freeze([...profile.allowed_tools]),
    tool_arg_constraints: Object.freeze(constraints),
    validateArguments(toolName: string, argumentsValue: unknown): boolean {
      if (!allowedTools.has(toolName)) return false;
      if (
        !Value.Check(RuntimeToolInvocationRequestV1Schema, {
          schema_version: "runtime_tool_invocation_request.v1",
          runtime_run_id: "validation-run",
          adapter_tool_call_id: "validation-call",
          tool_name: toolName,
          normalized_args: argumentsValue,
        })
      ) {
        return false;
      }
      const constraint = constraints[toolName];
      return constraint === undefined
        ? true
        : validateToolConstraintV1(constraint, argumentsValue);
    },
  });
}

export function createPostgresRuntimeToolPermissionProfilePortV1(
  postgres: PostgresQueryPortV1,
): RuntimeToolPermissionProfilePortV1 {
  return Object.freeze({
    async resolveExact(
      request: Parameters<
        RuntimeToolPermissionProfilePortV1["resolveExact"]
      >[0],
      signal?: AbortSignal,
    ): Promise<RuntimeToolPermissionProfileV1> {
      throwIfAbortedV1(signal);
      let result: Readonly<{
        rows: readonly ToolPermissionProfileExactRowV1[];
      }>;
      try {
        result = await postgres.query<ToolPermissionProfileExactRowV1>(
          TOOL_PERMISSION_PROFILE_EXACT_READ_SQL_V1,
          [
            request.workspace_id,
            request.bot_id,
            request.owner_agent_id,
            request.deployment_environment,
            request.release_channel,
            request.profile_ref,
            String(request.revision),
            request.profile_hash,
            String(request.policy_epoch),
          ],
        );
      } catch (error) {
        throwIfAbortedV1(signal);
        throw new RuntimeExecutionErrorV1(
          "reservation_unavailable",
          "ToolPermissionProfile owner storage is unavailable",
          true,
        );
      }
      throwIfAbortedV1(signal);
      if (result.rows.length !== 1) {
        throw new RuntimeExecutionErrorV1(
          "tool_policy_denied",
          "The exact ToolPermissionProfile owner artifact was not found",
        );
      }
      try {
        const profile = profileFromRowV1(result.rows[0]!);
        if (!Value.Check(ToolPermissionProfileV1Schema, profile)) {
          throw new Error("ToolPermissionProfile schema drift");
        }
        assertToolPermissionProfileSemanticBindingsV1(profile, sha256V1);
        if (
          profile.selector.workspace_id !== request.workspace_id ||
          profile.selector.bot_id !== request.bot_id ||
          profile.selector.owner_agent_id !== request.owner_agent_id ||
          profile.selector.deployment_environment !==
            request.deployment_environment ||
          profile.selector.release_channel !== request.release_channel ||
          profile.profile_ref !== request.profile_ref ||
          profile.revision !== request.revision ||
          profile.profile_hash !== request.profile_hash ||
          profile.policy_epoch !== request.policy_epoch
        ) {
          throw new Error("ToolPermissionProfile binding drift");
        }
        return runtimeProfileV1(profile);
      } catch (error) {
        if (error instanceof RuntimeExecutionErrorV1) throw error;
        throw new RuntimeExecutionErrorV1(
          "tool_policy_denied",
          "The exact ToolPermissionProfile owner artifact is invalid",
        );
      }
    },
  });
}
