import { createHash } from "node:crypto";

import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  SkillPermissionSummaryV1Schema,
  assertSkillPermissionSummarySemanticBindingsV1,
  assertSkillPermissionSummarySnapshotBindingsV1,
  skillPermissionSummaryCanonicalBytesV1,
  type SkillPermissionSummaryV1,
} from "../../src/index.js";

const sha256 = (value: string) =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

function summary(): SkillPermissionSummaryV1 {
  const withoutHash = {
    schema_version: "skill_permission_summary.v1",
    summary_ref: "summary_01",
    workspace_id: "ws_01",
    bot_id: "bot_01",
    owner_agent_id: "agent_01",
    deployment_environment: "prod",
    release_channel: "stable",
    catalog_revision_id: "catalog_revision_01",
    catalog_version: "cat_184",
    catalog_as_of: "2026-07-24T00:00:00.000Z",
    security_revocation_epoch: 4,
    entries: [
      {
        skill_id: "skill_01",
        skill_key: "lark-doc",
        activation_revision_id: "activation_01",
        version_id: "version_01",
        decision_source: "revision",
        permission_revision_id: "permission_01",
        revision_no: 1,
        decision: "grant",
        scope_hash: `sha256:${"a".repeat(64)}`,
        owner_agent_condition: "agent_01",
        capability_refs: ["doc.read"],
      },
      {
        skill_id: "skill_02",
        skill_key: "calendar",
        activation_revision_id: "activation_02",
        version_id: "version_02",
        decision_source: "default_deny",
        decision: "deny",
        capability_refs: [],
      },
    ],
  } as const;
  return {
    ...withoutHash,
    summary_hash: sha256(
      JSON.stringify(
        Object.fromEntries(
          Object.entries(withoutHash).sort(([left], [right]) =>
            left < right ? -1 : left > right ? 1 : 0,
          ),
        ),
      ),
    ),
  };
}

describe("SkillPermissionSummaryV1", () => {
  it("keeps revision and default-deny branches closed", () => {
    const value = summary();
    value.summary_hash = sha256(skillPermissionSummaryCanonicalBytesV1(value));
    expect(Value.Check(SkillPermissionSummaryV1Schema, value)).toBe(true);
    expect(() =>
      assertSkillPermissionSummarySemanticBindingsV1(value, sha256),
    ).not.toThrow();
    expect(
      Value.Check(SkillPermissionSummaryV1Schema, {
        ...value,
        entries: [
          {
            ...value.entries[1],
            permission_revision_id: "fake",
          },
        ],
      }),
    ).toBe(false);
  });

  it("rejects ordering/hash drift and preserves immutable historical replay", () => {
    const value = summary();
    value.summary_hash = sha256(skillPermissionSummaryCanonicalBytesV1(value));
    expect(() =>
      assertSkillPermissionSummarySnapshotBindingsV1(value, {
        ...value,
        entries: [...value.entries],
      }),
    ).not.toThrow();
    expect(() =>
      assertSkillPermissionSummarySemanticBindingsV1(
        { ...value, entries: [...value.entries].reverse() },
        sha256,
      ),
    ).toThrow(/ordered/u);
  });
});
