import { describe, expect, it } from "vitest";

import { canonicalJsonV1, canonicalPayloadHashV1 } from "../src/index.js";

describe("canonical JSON V1", () => {
  it("produces stable RFC 8785 ordering and number serialization", () => {
    expect(
      canonicalJsonV1({
        numbers: [333333333.33333329, 1e30, 4.5, 0.002, 1e-27, -0],
        string: "€$\u000f\nA'B\"\\\"/",
        literals: [null, true, false],
      }),
    ).toBe(
      '{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27,0],"string":"€$\\u000f\\nA\'B\\\"\\\\\\\"/"}',
    );
    expect(canonicalJsonV1({ z: 1, a: { y: 2, x: 3 } })).toBe(
      '{"a":{"x":3,"y":2},"z":1}',
    );
    // RFC 8785 sorts property names by UTF-16 code units. UTF-8 byte sorting
    // would incorrectly place U+E000 before U+10000.
    expect(canonicalJsonV1({ "\u{10000}": 1, "\uE000": 2 })).toBe(
      '{"\u{10000}":1,"\uE000":2}',
    );
  });

  it("rejects values that cannot be losslessly represented as JSON", () => {
    expect(() => canonicalJsonV1({ value: undefined })).toThrow(/undefined/);
    expect(() => canonicalJsonV1(Number.NaN)).toThrow(/non-finite/);
    expect(() => canonicalJsonV1("\ud800")).toThrow(/surrogate/);
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(() => canonicalJsonV1(cyclic)).toThrow(/cyclic/);
  });

  it("hashes only canonical UTF-8 payload bytes", () => {
    expect(canonicalPayloadHashV1({ b: 2, a: 1 })).toBe(
      canonicalPayloadHashV1({ a: 1, b: 2 }),
    );
    expect(canonicalPayloadHashV1({ a: 1 })).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});
