import { describe, expect, it } from "vitest";

import { assertBoundedPureJsonV1 } from "../../src/index.js";

describe("Bounded pure JSON V1", () => {
  it("accepts repeated acyclic aliases but rejects active-path cycles", () => {
    const shared = { stable: true };
    expect(() =>
      assertBoundedPureJsonV1({ first: shared, second: shared }),
    ).not.toThrow();

    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(() => assertBoundedPureJsonV1(cyclic)).toThrow(/cyclic/u);
  });

  it("rejects accessors and proxies without executing user code", () => {
    let getterCalls = 0;
    const accessor = Object.defineProperty({}, "secret", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return "hidden";
      },
    });
    expect(() => assertBoundedPureJsonV1(accessor)).toThrow(/accessor/u);
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
    expect(() => assertBoundedPureJsonV1(proxy)).toThrow(/proxy/u);
    expect(trapCalls).toBe(0);
  });

  it("enforces depth, node, byte, container, and Unicode bounds", () => {
    let deep: unknown = "leaf";
    for (let index = 0; index < 32; index += 1) {
      deep = { child: deep };
    }
    expect(() =>
      assertBoundedPureJsonV1(deep, { max_depth: 8 }),
    ).toThrow(/maximum depth/u);
    expect(() =>
      assertBoundedPureJsonV1(["a", "b"], { max_nodes: 2 }),
    ).toThrow(/maximum node/u);
    expect(() =>
      assertBoundedPureJsonV1("long", { max_bytes: 3 }),
    ).toThrow(/maximum encoded byte/u);
    expect(() =>
      assertBoundedPureJsonV1(["a", "b"], {
        max_container_entries: 1,
      }),
    ).toThrow(/maximum entry/u);
    expect(() => assertBoundedPureJsonV1("\ud800")).toThrow(
      /surrogate/u,
    );
  });
});
