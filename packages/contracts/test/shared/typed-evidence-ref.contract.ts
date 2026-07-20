import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  TypedEvidenceRefV1Schema,
  splitTypedEvidenceRef,
} from "../../src/index.js";

describe("TypedEvidenceRefV1", () => {
  it("splits only on the first colon and rejects unknown types", () => {
    const ref = "artifact:bucketless:opaque:value" as const;
    expect(Value.Check(TypedEvidenceRefV1Schema, ref)).toBe(true);
    expect(splitTypedEvidenceRef(ref)).toEqual({
      type: "artifact",
      opaqueId: "bucketless:opaque:value",
    });
    expect(Value.Check(TypedEvidenceRefV1Schema, "knowthat:fact_1")).toBe(
      false,
    );
  });
});
