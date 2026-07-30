import { describe, expect, it } from "vitest";

import {
  CANONICAL_JSON_MAX_BYTES_V1,
  CANONICAL_JSON_MAX_DEPTH_V1,
  CANONICAL_JSON_MAX_NODES_V1,
  CanonicalJsonErrorV1,
  canonicalJsonV1,
} from "../src/canonical.v1.js";

describe("Skill Registry canonical JSON", () => {
  it("canonicalizes plain data without consulting object methods", () => {
    const value = Object.create(null) as Record<string, unknown>;
    value["z"] = [true, null, "text"];
    value["a"] = -0;

    expect(canonicalJsonV1(value)).toBe(
      '{"a":0,"z":[true,null,"text"]}',
    );
  });

  it("rejects object and array accessors without invoking them", () => {
    let reads = 0;
    const object = {};
    Object.defineProperty(object, "secret", {
      enumerable: true,
      get() {
        reads += 1;
        return "leaked";
      },
    });
    const array: unknown[] = [];
    Object.defineProperty(array, "0", {
      enumerable: true,
      configurable: true,
      get() {
        reads += 1;
        return "leaked";
      },
    });
    array.length = 1;

    expect(() => canonicalJsonV1(object)).toThrow(
      /rejects accessors/u,
    );
    expect(() => canonicalJsonV1(array)).toThrow(
      /rejects accessors/u,
    );
    expect(reads).toBe(0);
  });

  it("rejects sparse, cyclic, proxy and hidden state", () => {
    const sparse = new Array<unknown>(1);
    const cyclic: Record<string, unknown> = {};
    cyclic["self"] = cyclic;
    const hidden = { visible: true };
    Object.defineProperty(hidden, "hidden", {
      enumerable: false,
      value: true,
    });

    for (const value of [
      sparse,
      cyclic,
      new Proxy({ value: 1 }, {}),
      hidden,
    ]) {
      expect(() => canonicalJsonV1(value)).toThrow(
        CanonicalJsonErrorV1,
      );
    }
  });

  it("allows repeated acyclic references", () => {
    const shared = { value: 1 };

    expect(
      canonicalJsonV1({ left: shared, right: shared }),
    ).toBe('{"left":{"value":1},"right":{"value":1}}');
  });

  it("fails before traversing values beyond depth, node and byte budgets", () => {
    let deep: Record<string, unknown> = {};
    const root = deep;
    for (
      let depth = 0;
      depth <= CANONICAL_JSON_MAX_DEPTH_V1;
      depth += 1
    ) {
      const next: Record<string, unknown> = {};
      deep["next"] = next;
      deep = next;
    }
    expect(() => canonicalJsonV1(root)).toThrow(/maximum depth/u);

    expect(() =>
      canonicalJsonV1(
        new Array(CANONICAL_JSON_MAX_NODES_V1).fill(null),
      ),
    ).toThrow(/maximum node count/u);

    expect(() =>
      canonicalJsonV1(
        "x".repeat(CANONICAL_JSON_MAX_BYTES_V1 + 1),
      ),
    ).toThrow(/maximum byte length/u);
  });
});
