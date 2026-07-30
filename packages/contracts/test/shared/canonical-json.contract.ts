import { describe, expect, it } from "vitest";

import {
  CANONICAL_JSON_LIMITS_V1,
  CanonicalJsonViolationV1,
  assertCanonicalJsonBoundaryV1,
  canonicalJsonV1,
} from "../../src/index.js";

describe("Shared Canonical JSON V1", () => {
  it("produces RFC 8785-compatible deterministic bytes", () => {
    expect(
      canonicalJsonV1({
        z: 1,
        a: { y: 2, x: 3 },
        negative_zero: -0,
      }),
    ).toBe('{"a":{"x":3,"y":2},"negative_zero":0,"z":1}');
    expect(canonicalJsonV1({ "\u{10000}": 1, "\uE000": 2 })).toBe(
      '{"𐀀":1,"":2}',
    );
  });

  it("treats an acyclic alias exactly like a de-aliased JSON tree", () => {
    const shared = Object.freeze({ a: [1, 2], z: true });
    expect(canonicalJsonV1({ left: shared, right: shared })).toBe(
      canonicalJsonV1({
        left: { a: [1, 2], z: true },
        right: { a: [1, 2], z: true },
      }),
    );
  });

  it("rejects accessors and proxies before invoking attacker code", () => {
    let getterCalls = 0;
    const accessor = Object.defineProperty({}, "secret", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return "do-not-read";
      },
    });
    expect(() => canonicalJsonV1(accessor)).toThrow(
      expect.objectContaining({ reason: "accessor_property" }),
    );
    expect(getterCalls).toBe(0);

    let trapCalls = 0;
    const proxy = new Proxy(
      { stable: true },
      {
        ownKeys(target) {
          trapCalls += 1;
          return Reflect.ownKeys(target);
        },
      },
    );
    expect(() => canonicalJsonV1(proxy)).toThrow(
      expect.objectContaining({ reason: "proxy_object" }),
    );
    expect(trapCalls).toBe(0);
  });

  it.each([
    [
      "hidden_property",
      Object.defineProperty({}, "hidden", {
        enumerable: false,
        value: true,
      }),
    ],
    ["symbol_key", { [Symbol("key")]: true }],
    ["sparse_array", new Array(1)],
    [
      "array_extra_key",
      Object.assign(["stable"], { unexpected: true }),
    ],
    ["non_plain_object", new Date(0)],
    ["unpaired_surrogate", "\ud800"],
    ["invalid_value", Number.NaN],
  ] as const)("rejects %s", (reason, value) => {
    expect(() => canonicalJsonV1(value)).toThrow(
      expect.objectContaining({ reason }),
    );
  });

  it("rejects cycles and every configured resource boundary", () => {
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(() => canonicalJsonV1(cyclic)).toThrow(
      expect.objectContaining({ reason: "cycle_detected" }),
    );

    let deep: unknown = "leaf";
    for (let index = 0; index < 8; index += 1) deep = { child: deep };
    expect(() => canonicalJsonV1(deep, { max_depth: 3 })).toThrow(
      expect.objectContaining({ reason: "max_depth_exceeded" }),
    );
    expect(() => canonicalJsonV1(["a", "b"], { max_nodes: 2 })).toThrow(
      expect.objectContaining({ reason: "max_nodes_exceeded" }),
    );
    expect(() => canonicalJsonV1("long", { max_bytes: 3 })).toThrow(
      expect.objectContaining({ reason: "max_bytes_exceeded" }),
    );
    expect(() =>
      canonicalJsonV1(["a", "b"], { max_container_entries: 1 }),
    ).toThrow(
      expect.objectContaining({
        reason: "max_container_entries_exceeded",
      }),
    );
  });

  it("does not allow callers to loosen the shared hard limits", () => {
    expect(CANONICAL_JSON_LIMITS_V1).toEqual({
      maxBytes: 67_108_864,
      maxDepth: 128,
      maxNodes: 1_000_000,
      maxContainerEntries: 100_000,
    });
    let deeperThanSharedLimit: unknown = "leaf";
    for (
      let index = 0;
      index <= CANONICAL_JSON_LIMITS_V1.maxDepth;
      index += 1
    ) {
      deeperThanSharedLimit = { child: deeperThanSharedLimit };
    }
    expect(() =>
      assertCanonicalJsonBoundaryV1(deeperThanSharedLimit, {
        max_depth: CANONICAL_JSON_LIMITS_V1.maxDepth + 1,
      }),
    ).toThrow(
      expect.objectContaining({ reason: "max_depth_exceeded" }),
    );
    expect(
      new CanonicalJsonViolationV1("invalid_value", "stable").reason,
    ).toBe("invalid_value");
  });
});
