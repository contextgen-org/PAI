import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  ToolInvocationListDetailsV1Schema,
  assertToolInvocationListDetailsSemanticBindingsV1,
} from "../../src/index.js";

const page = {
  runtime_run_id: "run_01",
  items: [
    {
      tool_invocation_id: "tool_02",
      tool_name: "lark.im.send_message",
      status: "completed",
      side_effect_status: "produced",
      input_ref: "artifact:input_02",
      output_ref: "artifact:output_02",
      failure_class: null,
      started_at: "2026-07-13T12:00:04.000Z",
      completed_at: "2026-07-13T12:00:05.000Z",
    },
    {
      tool_invocation_id: "tool_01",
      tool_name: "memory.read",
      status: "failed",
      side_effect_status: "none",
      input_ref: "artifact:input_01",
      output_ref: null,
      failure_class: "upstream_unavailable",
      started_at: "2026-07-13T12:00:02.000Z",
      completed_at: "2026-07-13T12:00:03.000Z",
    },
  ],
  next_cursor: "cursor_01",
  has_more: true,
} as const;

describe("ToolInvocationListDetailsV1", () => {
  it("pins redacted fields, cursor binding and stable descending order", () => {
    expect(ToolInvocationListDetailsV1Schema.$id).toBe(
      "urn:pai:action-runtime:tool-invocation-list:v1",
    );
    expect(Value.Check(ToolInvocationListDetailsV1Schema, page)).toBe(true);
    expect(() =>
      assertToolInvocationListDetailsSemanticBindingsV1(page),
    ).not.toThrow();
  });

  it("rejects cursor drift, unsafe output fields and unstable ordering", () => {
    expect(() =>
      assertToolInvocationListDetailsSemanticBindingsV1({
        ...page,
        next_cursor: null,
      }),
    ).toThrow(/cursor binding/u);
    expect(
      Value.Check(ToolInvocationListDetailsV1Schema, {
        ...page,
        items: [{ ...page.items[0], raw_arguments: { secret: true } }],
      }),
    ).toBe(false);
    expect(() =>
      assertToolInvocationListDetailsSemanticBindingsV1({
        ...page,
        items: [...page.items].reverse(),
      }),
    ).toThrow(/ordering/u);
  });
});
