import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { DeploymentEnvironmentV1Schema } from "../../src/index.js";

describe("DeploymentEnvironmentV1", () => {
  it("rejects aliases and case drift", () => {
    expect(Value.Check(DeploymentEnvironmentV1Schema, "staging")).toBe(true);
    expect(Value.Check(DeploymentEnvironmentV1Schema, "stage")).toBe(false);
    expect(Value.Check(DeploymentEnvironmentV1Schema, "PROD")).toBe(false);
  });
});
