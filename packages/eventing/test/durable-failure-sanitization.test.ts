import { describe, expect, it } from "vitest";

import { summarizeDurableRawFieldsV1 } from "../src/durable-failure-sanitization.v1.js";

describe("durable failure sanitization V1", () => {
  it("rejects Proxy-backed raw fields before reflection", () => {
    let descriptorTrapCalls = 0;
    const rawFields = new Proxy(["payload", "private"], {
      getOwnPropertyDescriptor(target, property) {
        descriptorTrapCalls += 1;
        return Reflect.getOwnPropertyDescriptor(target, property);
      },
    });

    expect(summarizeDurableRawFieldsV1(rawFields)).toEqual([]);
    expect(descriptorTrapCalls).toBe(0);
  });

  it("does not trust caller-forged summary positions or roles", () => {
    const summaries = summarizeDurableRawFieldsV1([
      {
        schema_version: "eventing.raw_field_summary.v1",
        kind: "non_string",
        position: 7,
        role: "field_value",
      },
    ]);

    expect(summaries).toEqual([
      {
        schema_version: "eventing.raw_field_summary.v1",
        kind: "non_string",
        position: 0,
        role: "field_name",
      },
    ]);
  });

  it("accepts an omitted marker only as the final summary element", () => {
    const summaries = summarizeDurableRawFieldsV1([
      {
        schema_version: "eventing.raw_field_summary.v1",
        kind: "omitted",
        omitted_count: 9,
      },
      {
        schema_version: "eventing.raw_field_summary.v1",
        kind: "non_string",
        position: 1,
        role: "field_value",
      },
    ]);

    expect(summaries).toEqual([
      {
        schema_version: "eventing.raw_field_summary.v1",
        kind: "non_string",
        position: 0,
        role: "field_name",
      },
      {
        schema_version: "eventing.raw_field_summary.v1",
        kind: "non_string",
        position: 1,
        role: "field_value",
      },
    ]);
  });
});
