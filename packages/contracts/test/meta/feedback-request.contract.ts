import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  assertFeedbackRequestSemanticBindingsV1,
  FeedbackRequestV1Schema,
} from "../../src/index.js";
import { feedbackRequest } from "./owner-fixtures.v1.js";

describe("FeedbackRequestV1", () => {
  it("accepts a redacted internal queue request", () => {
    const request = feedbackRequest();
    expect(Value.Check(FeedbackRequestV1Schema, request)).toBe(true);
    expect(() =>
      assertFeedbackRequestSemanticBindingsV1(request as never),
    ).not.toThrow();
  });

  it("rejects a proactive delivery without a trusted binding", () => {
    const request = feedbackRequest({
      delivery_mode: "proactive",
      delivery_status: "pending",
    });
    expect(Value.Check(FeedbackRequestV1Schema, request)).toBe(true);
    expect(() =>
      assertFeedbackRequestSemanticBindingsV1(request as never),
    ).toThrow(/semantic binding/);
  });
});
