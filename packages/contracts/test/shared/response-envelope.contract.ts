import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { ResponseEnvelopeV1Schema } from "../../src/index.js";

describe("ResponseEnvelopeV1", () => {
  it("requires every error field and rejects consumer extensions", () => {
    expect(
      Value.Check(ResponseEnvelopeV1Schema, {
        code: "schema_validation_failed",
        message: "invalid request",
        retryable: false,
        details: { field_path: "/aud", schema_version: "1.0.0" },
        trace_id: "trace_01",
      }),
    ).toBe(true);
    expect(
      Value.Check(ResponseEnvelopeV1Schema, {
        code: "invalid",
        message: "invalid request",
        retryable: false,
        details: null,
        trace_id: "trace_01",
        error: "consumer alias",
      }),
    ).toBe(false);
  });
});
