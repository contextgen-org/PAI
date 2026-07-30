import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  assertQualitySignalSemanticBindingsV1,
  QualitySignalV1Schema,
} from "../../src/index.js";
import { qualitySignal } from "./owner-fixtures.v1.js";

describe("QualitySignalV1", () => {
  it("accepts the fixed taxonomy and owner binding", () => {
    const signal = qualitySignal();
    expect(Value.Check(QualitySignalV1Schema, signal)).toBe(true);
    expect(() =>
      assertQualitySignalSemanticBindingsV1(signal as never),
    ).not.toThrow();
  });

  it("requires the downstream failure payload and non-service actor", () => {
    expect(
      Value.Check(
        QualitySignalV1Schema,
        qualitySignal({
          signal_type: "downstream_operation_failed",
          payload: {},
        }),
      ),
    ).toBe(false);
    const { source_service: _sourceService, ...manual } = qualitySignal({
      source_kind: "manual",
      actor_principal: null,
      actor_role: null,
    });
    expect(Value.Check(QualitySignalV1Schema, manual)).toBe(true);
    expect(() =>
      assertQualitySignalSemanticBindingsV1(manual as never),
    ).toThrow(/actor binding/);
  });
});
