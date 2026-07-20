import { describe, expect, it } from "vitest";

import type { ObjectStorePortV1 } from "../src/index.js";

describe("ObjectStorePortV1", () => {
  it("exposes only the five document-owned operations", () => {
    const operations = [
      "putImmutable",
      "head",
      "getStream",
      "issueReadGrant",
      "deleteIfEligible",
    ] as const satisfies readonly (keyof ObjectStorePortV1)[];

    expect(operations).toEqual([
      "putImmutable",
      "head",
      "getStream",
      "issueReadGrant",
      "deleteIfEligible",
    ]);
    expect(operations).not.toContain("list" as never);
  });
});
