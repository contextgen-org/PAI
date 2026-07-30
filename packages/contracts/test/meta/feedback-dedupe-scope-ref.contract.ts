import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { FeedbackDedupeScopeRefV1Schema } from "../../src/index.js";

describe("FeedbackDedupeScopeRefV1", () => {
  it.each([
    ["conflict", "conflict:1"],
    ["candidate", "candidate:1"],
    ["schedule", "schedule:1"],
  ])("accepts the closed %s branch", (kind, ref) => {
    expect(Value.Check(FeedbackDedupeScopeRefV1Schema, { kind, ref })).toBe(
      true,
    );
  });

  it("rejects mismatched, unknown, and empty refs", () => {
    expect(
      Value.Check(FeedbackDedupeScopeRefV1Schema, {
        kind: "candidate",
        ref: "conflict:1",
      }),
    ).toBe(false);
    expect(
      Value.Check(FeedbackDedupeScopeRefV1Schema, {
        kind: "other",
        ref: "other:1",
      }),
    ).toBe(false);
    expect(
      Value.Check(FeedbackDedupeScopeRefV1Schema, {
        kind: "schedule",
        ref: "schedule:",
      }),
    ).toBe(false);
  });
});
