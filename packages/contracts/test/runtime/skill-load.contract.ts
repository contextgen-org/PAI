import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  RuntimeSkillLoadRequestV1Schema,
  RuntimeSkillLoadResponseV1Schema,
  assertRuntimeSkillLoadBindingsV1,
} from "../../src/action-runtime/skill-load.v1.js";

const request = {
  skill_name: "lark-doc",
  runtime_run_id: "run-01",
  idempotency_key: "run-01:skill:lark-doc",
} as const;

const response = {
  code: "skill_loaded" as const,
  message: "skill loaded",
  retryable: false as const,
  trace_id: "trace-01",
  details: {
    skill_name: "lark-doc",
    resolution_id: "resolution-01",
    version_id: "version-01",
    package_digest: `sha256:${"a".repeat(64)}`,
    manifest_digest: `sha256:${"b".repeat(64)}`,
    digest_verified: true as const,
    runtime_target: "filesystem_bundle.v1" as const,
    entrypoint: ".claude/skills/lark-doc/SKILL.md",
    source: "skill_registry" as const,
    materialization_status: "loaded" as const,
    audit_event_id: "runtime-event-01",
  },
};

describe("RuntimeSkillLoadContractV1", () => {
  it("binds the exact frozen skill to its run and native SDK entrypoint", () => {
    expect(Value.Check(RuntimeSkillLoadRequestV1Schema, request)).toBe(true);
    expect(Value.Check(RuntimeSkillLoadResponseV1Schema, response)).toBe(true);
    expect(() => assertRuntimeSkillLoadBindingsV1(request, response)).not.toThrow();
  });

  it("rejects host paths and mismatched skill identities", () => {
    expect(
      Value.Check(RuntimeSkillLoadResponseV1Schema, {
        ...response,
        details: {
          ...response.details,
          entrypoint: "/tmp/lark-doc/SKILL.md",
        },
      }),
    ).toBe(false);
    expect(() =>
      assertRuntimeSkillLoadBindingsV1(request, {
        ...response,
        details: { ...response.details, skill_name: "other-skill" },
      }),
    ).toThrow(/binding mismatch/u);
  });
});
