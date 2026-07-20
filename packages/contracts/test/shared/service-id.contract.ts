import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { ServiceIdV1Schema } from "../../src/index.js";

describe("ServiceIdV1", () => {
  it("accepts only the closed underscore-delimited service IDs", () => {
    expect(Value.Check(ServiceIdV1Schema, "trigger_processor")).toBe(true);
    expect(Value.Check(ServiceIdV1Schema, "trigger-processor")).toBe(false);
    expect(Value.Check(ServiceIdV1Schema, "Trigger Processor")).toBe(false);
  });
});
