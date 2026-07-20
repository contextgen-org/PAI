import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { ReleaseChannelV1Schema } from "../../src/index.js";

describe("ReleaseChannelV1", () => {
  it("accepts only stable and canary", () => {
    expect(Value.Check(ReleaseChannelV1Schema, "stable")).toBe(true);
    expect(Value.Check(ReleaseChannelV1Schema, "canary")).toBe(true);
    expect(Value.Check(ReleaseChannelV1Schema, "default")).toBe(false);
    expect(Value.Check(ReleaseChannelV1Schema, "beta")).toBe(false);
  });
});
