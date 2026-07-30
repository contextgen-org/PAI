import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  SKILL_MANAGEMENT_SUCCESS_CODES_V1,
  SkillManagementCommandEnvelopeV1Schema,
  SkillManagementCommandRequestV1Schema,
  SkillManagementCommandResponseV1Schema,
  assertSkillManagementCommandSemanticBindingsV1,
  skillManagementIdempotencyNamespaceV1,
} from "../../src/index.js";

describe("SkillManagementCommandV1", () => {
  const common = {
    schema_version: "skill.management-command.v1",
    skill_id: "skill_01",
    reason: "approved release",
    idempotency_key: "command_01",
    trace_id: "trace_01",
  } as const;

  it("closes scoped and global command branches against field mixing", () => {
    const scoped = {
      ...common,
      operation: "activate",
      scope_kind: "scoped",
      workspace_id: "ws_01",
      bot_id: "bot_01",
      deployment_environment: "prod",
      release_channel: "stable",
      version_id: "version_01",
      expected_catalog_version: "cat_184",
      expected_activation_revision: "none",
    } as const;
    const global = {
      ...common,
      operation: "revoke",
      scope_kind: "global",
      version_id: "version_01",
      expected_lifecycle_version: 1,
      emergency: true,
    } as const;
    expect(Value.Check(SkillManagementCommandRequestV1Schema, scoped)).toBe(true);
    expect(Value.Check(SkillManagementCommandRequestV1Schema, global)).toBe(true);
    expect(
      Value.Check(SkillManagementCommandRequestV1Schema, {
        ...global,
        workspace_id: "ws_01",
      }),
    ).toBe(false);
    expect(
      Value.Check(SkillManagementCommandRequestV1Schema, {
        ...scoped,
        owner_agent_id: "spoofed",
      }),
    ).toBe(false);
    const disable = {
      ...common,
      operation: "disable",
      scope_kind: "scoped",
      workspace_id: "ws_01",
      bot_id: "bot_01",
      deployment_environment: "prod",
      release_channel: "stable",
      expected_catalog_version: "cat_184",
      expected_activation_revision: "activation_01",
    } as const;
    expect(Value.Check(SkillManagementCommandRequestV1Schema, disable)).toBe(
      true,
    );
    expect(
      Value.Check(SkillManagementCommandRequestV1Schema, {
        ...disable,
        version_id: "version_spoofed",
      }),
    ).toBe(false);
    expect(
      Value.Check(SkillManagementCommandRequestV1Schema, {
        ...disable,
        target_version_id: "version_spoofed",
      }),
    ).toBe(false);
    expect(skillManagementIdempotencyNamespaceV1(scoped)).not.toBe(
      skillManagementIdempotencyNamespaceV1(global),
    );
  });

  it("binds discriminated responses and monotonic global lifecycle CAS", () => {
    const request = {
      ...common,
      operation: "deprecate",
      scope_kind: "global",
      version_id: "version_01",
      expected_lifecycle_version: 1,
    } as const;
    const response = {
      scope_kind: "global",
      operation: "deprecate",
      command_id: "command_01",
      skill_id: "skill_01",
      version_id: "version_01",
      previous_lifecycle_version: 1,
      new_lifecycle_version: 2,
      lifecycle_state: "deprecated",
      security_revocation_epoch: 1,
      duplicate_replayed: false,
    } as const;
    expect(Value.Check(SkillManagementCommandResponseV1Schema, response)).toBe(
      true,
    );
    expect(() =>
      assertSkillManagementCommandSemanticBindingsV1(request, response),
    ).not.toThrow();
    expect(() =>
      assertSkillManagementCommandSemanticBindingsV1(request, {
        ...response,
        previous_lifecycle_version: 2,
        new_lifecycle_version: 3,
      }),
    ).toThrow(/binding mismatch/u);
    expect(
      Value.Check(SkillManagementCommandEnvelopeV1Schema, {
        code: SKILL_MANAGEMENT_SUCCESS_CODES_V1.deprecate,
        message: "skill version deprecated",
        retryable: false,
        trace_id: request.trace_id,
        details: response,
      }),
    ).toBe(true);
  });

  it("accepts exactly the seven documented operations", () => {
    const scoped = {
      ...common,
      scope_kind: "scoped",
      workspace_id: "ws_01",
      bot_id: "bot_01",
      deployment_environment: "prod",
      release_channel: "stable",
      expected_catalog_version: "cat_184",
    } as const;
    const commands = [
      {
        ...scoped,
        operation: "activate",
        version_id: "version_01",
        expected_activation_revision: "activation_01",
      },
      {
        ...scoped,
        operation: "rollback",
        target_version_id: "version_01",
        expected_activation_revision: "activation_02",
      },
      {
        ...scoped,
        operation: "disable",
        expected_activation_revision: "activation_03",
      },
      {
        ...scoped,
        operation: "permission_grant",
        capability_refs: ["docs.read"],
        scope_hash: `sha256:${"a".repeat(64)}`,
        expected_permission_revision: "permission_01",
      },
      {
        ...scoped,
        operation: "permission_revoke",
        capability_refs: ["docs.read"],
        scope_hash: `sha256:${"a".repeat(64)}`,
        expected_permission_revision: "permission_02",
      },
      {
        ...common,
        operation: "deprecate",
        scope_kind: "global",
        version_id: "version_01",
        expected_lifecycle_version: 1,
      },
      {
        ...common,
        operation: "revoke",
        scope_kind: "global",
        version_id: "version_01",
        expected_lifecycle_version: 2,
        emergency: false,
      },
    ] as const;
    expect(
      commands.map((command) =>
        Value.Check(SkillManagementCommandRequestV1Schema, command),
      ),
    ).toEqual([true, true, true, true, true, true, true]);
    expect(
      Value.Check(SkillManagementCommandRequestV1Schema, {
        ...commands[0],
        operation: "enable",
      }),
    ).toBe(false);
  });

  it("binds disable responses to the expected activation revision", () => {
    const request = {
      ...common,
      operation: "disable",
      scope_kind: "scoped",
      workspace_id: "ws_01",
      bot_id: "bot_01",
      deployment_environment: "prod",
      release_channel: "stable",
      expected_catalog_version: "cat_184",
      expected_activation_revision: "activation_03",
    } as const;
    const response = {
      scope_kind: "scoped",
      operation: "disable",
      command_id: "command_03",
      workspace_id: "ws_01",
      bot_id: "bot_01",
      deployment_environment: "prod",
      release_channel: "stable",
      previous_revision: "activation_03",
      new_revision: "activation_04",
      catalog_version: "cat_185",
      security_revocation_epoch: 4,
      duplicate_replayed: false,
    } as const;
    expect(Value.Check(SkillManagementCommandResponseV1Schema, response)).toBe(
      true,
    );
    expect(() =>
      assertSkillManagementCommandSemanticBindingsV1(request, response),
    ).not.toThrow();
    expect(
      Value.Check(SkillManagementCommandEnvelopeV1Schema, {
        code: SKILL_MANAGEMENT_SUCCESS_CODES_V1.disable,
        message: "skill activation disabled",
        retryable: false,
        trace_id: request.trace_id,
        details: response,
      }),
    ).toBe(true);
  });
});
