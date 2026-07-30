import { createHash } from "node:crypto";

import {
  ToolPermissionProfileCurrentReadRequestV1Schema,
  ToolPermissionProfileCurrentReadSuccessV1Schema,
  ToolPermissionProfileV1Schema,
  assertToolPermissionProfileCurrentReadBindingV1,
  assertToolPermissionProfileSemanticBindingsV1,
  type ToolPermissionProfileCurrentReadRequestV1,
  type ToolPermissionProfileCurrentReadSuccessV1,
  type ToolPermissionProfileSelectorV1,
  type ToolPermissionProfileV1,
} from "@pai/contracts";
import { canonicalJsonV1 } from "@pai/eventing";
import { Value } from "@sinclair/typebox/value";

export type ToolPermissionProfileCurrentReadErrorCodeV1 =
  | "authorization_scope_mismatch"
  | "tool_permission_profile_not_found"
  | "owner_contract_drift"
  | "storage_unavailable";

export interface ToolPermissionProfileCurrentReadPrincipalV1 {
  readonly sub: "trigger_processor";
  readonly aud: "action_runtime";
  readonly capability: readonly string[];
  readonly scope: ToolPermissionProfileSelectorV1;
}

export interface ToolPermissionProfileCurrentOwnerRowV1
  extends Record<string, unknown> {
  readonly workspace_id: string;
  readonly bot_id: string;
  readonly owner_agent_id: string;
  readonly deployment_environment: string;
  readonly release_channel: string;
  readonly profile_ref: string;
  readonly revision: string | number;
  readonly profile_hash: string;
  readonly allowed_tools: unknown;
  readonly tool_arg_constraints: unknown;
  readonly resource_scopes: unknown;
  readonly network_scope: unknown;
  readonly filesystem_scope: unknown;
  readonly timer_scope: unknown;
  readonly memory_scope: unknown;
  readonly policy_epoch: string | number;
  readonly pointer_version: string | number;
  readonly effective_at: string;
}

export interface ToolPermissionProfileCurrentReadRepositoryV1 {
  findCurrent(
    selector: ToolPermissionProfileSelectorV1,
    signal: AbortSignal,
  ): Promise<ToolPermissionProfileCurrentOwnerRowV1 | undefined>;
}

export class ToolPermissionProfileCurrentReadErrorV1 extends Error {
  public constructor(
    public readonly code: ToolPermissionProfileCurrentReadErrorCodeV1,
    public readonly traceId: string,
    public readonly retryable = code === "storage_unavailable",
  ) {
    super(code);
    this.name = "ToolPermissionProfileCurrentReadErrorV1";
  }
}

export interface ToolPermissionProfileCurrentReadApplicationV1 {
  readCurrent(
    principal: ToolPermissionProfileCurrentReadPrincipalV1,
    selector: unknown,
    traceId: string,
    signal?: AbortSignal,
  ): Promise<ToolPermissionProfileCurrentReadSuccessV1>;
}

function safeIntegerV1(value: string | number, minimum: number): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  if (!Number.isSafeInteger(parsed) || parsed < minimum) {
    throw new Error("owner safe integer drift");
  }
  return parsed;
}

function sameSelectorV1(
  left: ToolPermissionProfileSelectorV1,
  right: ToolPermissionProfileSelectorV1,
): boolean {
  return (
    left.workspace_id === right.workspace_id &&
    left.bot_id === right.bot_id &&
    left.owner_agent_id === right.owner_agent_id &&
    left.deployment_environment === right.deployment_environment &&
    left.release_channel === right.release_channel
  );
}

function sha256V1(value: string): string {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function rowToProfileV1(
  row: ToolPermissionProfileCurrentOwnerRowV1,
): Readonly<{ profile: ToolPermissionProfileV1; pointerVersion: number }> {
  const profile: ToolPermissionProfileV1 = {
    schema_version: "tool_permission_profile.v1",
    selector: {
      workspace_id: row.workspace_id,
      bot_id: row.bot_id,
      owner_agent_id: row.owner_agent_id,
      deployment_environment:
        row.deployment_environment as ToolPermissionProfileSelectorV1["deployment_environment"],
      release_channel:
        row.release_channel as ToolPermissionProfileSelectorV1["release_channel"],
    },
    profile_ref: row.profile_ref,
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
    effective_at: row.effective_at,
  };
  return {
    profile,
    pointerVersion: safeIntegerV1(row.pointer_version, 1),
  };
}

export function createToolPermissionProfileCurrentReadApplicationV1(
  repository: ToolPermissionProfileCurrentReadRepositoryV1,
): ToolPermissionProfileCurrentReadApplicationV1 {
  return Object.freeze({
    async readCurrent(
      principal: ToolPermissionProfileCurrentReadPrincipalV1,
      selectorValue: unknown,
      traceId: string,
      signal = new AbortController().signal,
    ): Promise<ToolPermissionProfileCurrentReadSuccessV1> {
      let selector: unknown;
      try {
        selector = JSON.parse(canonicalJsonV1(selectorValue));
      } catch {
        throw new ToolPermissionProfileCurrentReadErrorV1(
          "authorization_scope_mismatch",
          traceId,
        );
      }
      const request: ToolPermissionProfileCurrentReadRequestV1 = {
        schema_version:
          "tool_permission_profile_current_read_request.v1",
        selector: selector as ToolPermissionProfileSelectorV1,
        trace_id: traceId,
      };
      if (
        !Value.Check(
          ToolPermissionProfileCurrentReadRequestV1Schema,
          request,
        ) ||
        principal.sub !== "trigger_processor" ||
        principal.aud !== "action_runtime" ||
        !principal.capability.includes(
          "runtime.tool_permission_profile.current.read",
        ) ||
        !sameSelectorV1(principal.scope, request.selector)
      ) {
        throw new ToolPermissionProfileCurrentReadErrorV1(
          "authorization_scope_mismatch",
          traceId,
        );
      }
      let row: ToolPermissionProfileCurrentOwnerRowV1 | undefined;
      try {
        row = await repository.findCurrent(request.selector, signal);
      } catch (error) {
        if (signal.aborted) throw signal.reason;
        throw new ToolPermissionProfileCurrentReadErrorV1(
          "storage_unavailable",
          traceId,
          true,
        );
      }
      if (row === undefined) {
        throw new ToolPermissionProfileCurrentReadErrorV1(
          "tool_permission_profile_not_found",
          traceId,
        );
      }
      try {
        const { profile, pointerVersion } = rowToProfileV1(row);
        if (!Value.Check(ToolPermissionProfileV1Schema, profile)) {
          throw new Error("profile schema drift");
        }
        assertToolPermissionProfileSemanticBindingsV1(profile, sha256V1);
        const response: ToolPermissionProfileCurrentReadSuccessV1 = {
          code: "tool_permission_profile_current",
          message: "Current ToolPermissionProfile owner artifact",
          retryable: false,
          details: { profile, pointer_version: pointerVersion },
          trace_id: traceId,
        };
        if (
          !Value.Check(
            ToolPermissionProfileCurrentReadSuccessV1Schema,
            response,
          )
        ) {
          throw new Error("response schema drift");
        }
        assertToolPermissionProfileCurrentReadBindingV1(request, response);
        return Object.freeze(response);
      } catch {
        throw new ToolPermissionProfileCurrentReadErrorV1(
          "owner_contract_drift",
          traceId,
        );
      }
    },
  });
}
