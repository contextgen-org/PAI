import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  RuntimeRunQueryDetailsV1Schema,
  assertRuntimeRunQueryDetailsSemanticBindingsV1,
} from "../../src/index.js";

const completed = {
  runtime_run: {
    runtime_run_id: "run_01",
    trigger_process_id: "tp_01",
    workspace_id: "ws_01",
    bot_id: "bot_01",
    owner_agent_id: "agent_01",
    deployment_environment: "prod",
    release_channel: "stable",
    status: "completed",
    start_attempt_no: 1,
    policy_snapshot_id: "rps_01",
    requested_catalog_version: "cat_184",
    effective_catalog_version: "cat_184",
    created_at: "2026-07-13T12:00:00.000Z",
    started_at: "2026-07-13T12:00:01.000Z",
    completed_at: "2026-07-13T12:00:09.000Z",
    terminal_reason: "completed",
  },
} as const;

describe("RuntimeRunQueryDetailsV1", () => {
  it("owns the exact five-tuple run projection and terminal lifecycle", () => {
    expect(RuntimeRunQueryDetailsV1Schema.$id).toBe(
      "urn:pai:action-runtime:runtime-run-query:v1",
    );
    expect(Value.Check(RuntimeRunQueryDetailsV1Schema, completed)).toBe(true);
    expect(() =>
      assertRuntimeRunQueryDetailsSemanticBindingsV1(completed),
    ).not.toThrow();
  });

  it("fails closed on hidden fields or terminal timestamp drift", () => {
    expect(
      Value.Check(RuntimeRunQueryDetailsV1Schema, {
        ...completed,
        runtime_run: { ...completed.runtime_run, provider_secret: "secret" },
      }),
    ).toBe(false);
    expect(() =>
      assertRuntimeRunQueryDetailsSemanticBindingsV1({
        ...completed,
        runtime_run: { ...completed.runtime_run, completed_at: null },
      }),
    ).toThrow(/semantic binding/u);
  });
});
