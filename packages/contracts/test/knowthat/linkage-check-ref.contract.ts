import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { KnowThatLinkageCheckRefV1Schema } from "../../src/knowthat/linkage-check-ref.v1.js";
import { TypedEvidenceRefV1Schema } from "../../src/shared/typed-evidence-ref.v1.js";

describe("KnowThat linkage-check workflow reference", () => {
  it("uses the owner prefix without widening Shared evidence", () => {
    const reference = "knowthat_linkage_check:linkage-1";
    expect(Value.Check(KnowThatLinkageCheckRefV1Schema, reference)).toBe(true);
    expect(Value.Check(TypedEvidenceRefV1Schema, reference)).toBe(false);
    expect(
      Value.Check(KnowThatLinkageCheckRefV1Schema, "linkage_check:linkage-1"),
    ).toBe(false);
  });
});
