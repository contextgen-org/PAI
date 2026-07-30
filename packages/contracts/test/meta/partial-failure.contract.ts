import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  assertPartialFailureSemanticBindingsV1,
  PartialFailureV1Schema,
} from "../../src/index.js";
import { at, partialFailure } from "./owner-fixtures.v1.js";

describe("PartialFailureV1", () => {
  it("requires durable compensation for active failures", () => {
    const active = partialFailure();
    expect(Value.Check(PartialFailureV1Schema, active)).toBe(true);
    expect(() =>
      assertPartialFailureSemanticBindingsV1(active as never),
    ).not.toThrow();
    expect(() =>
      assertPartialFailureSemanticBindingsV1(
        partialFailure({ compensation_outbox_id: undefined }) as never,
      ),
    ).toThrow(/semantic binding/);
  });

  it("requires resolution evidence for terminal failures", () => {
    const terminal = partialFailure({
      status: "failed",
      retryable: false,
      next_retry_at: undefined,
      compensation_outbox_id: undefined,
      terminal_reason: "retry_exhausted",
      resolved_at: at,
    });
    expect(Value.Check(PartialFailureV1Schema, terminal)).toBe(true);
    expect(() =>
      assertPartialFailureSemanticBindingsV1(terminal as never),
    ).not.toThrow();
  });
});
