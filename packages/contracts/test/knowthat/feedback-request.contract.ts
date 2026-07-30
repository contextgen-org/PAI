import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  KnowThatFeedbackRequestV1Schema,
  KnowThatFeedbackResponseV1Schema,
  assertKnowThatFeedbackRequestV1,
  assertKnowThatFeedbackResponseSemanticBindingsV1,
} from "../../src/knowthat/feedback-request.v1.js";

const request = {
  schema_version: "knowthat_feedback.v1",
  feedback_type: "correct",
  payload: { corrected_object: "Shanghai", confidence: 0.98 },
  evidence_ref: "user_feedback:feedback-1",
  idempotency_key: "feedback:fact-1:feedback-1",
  trace_id: "trace-feedback-1",
} as const;

describe("KnowThat feedback owner contract", () => {
  it("accepts only the documented request and response shapes", () => {
    expect(Value.Check(KnowThatFeedbackRequestV1Schema, request)).toBe(true);
    expect(() => assertKnowThatFeedbackRequestV1(request)).not.toThrow();
    expect(
      Value.Check(KnowThatFeedbackRequestV1Schema, {
        ...request,
        payload: ["not", "an", "object"],
      }),
    ).toBe(false);
    expect(
      Value.Check(KnowThatFeedbackRequestV1Schema, {
        ...request,
        feedback_type: "delete",
      }),
    ).toBe(false);

    const response = {
      schema_version: "knowthat_feedback.v1",
      id: "feedback-event-1",
      bot_id: "bot-1",
      fact_id: "fact-1",
      feedback_type: request.feedback_type,
      payload: request.payload,
      evidence_ref: request.evidence_ref,
      created_at: "2026-07-27T00:00:00.000Z",
      duplicate_replayed: false,
    } as const;
    expect(Value.Check(KnowThatFeedbackResponseV1Schema, response)).toBe(true);
    expect(() =>
      assertKnowThatFeedbackResponseSemanticBindingsV1(
        request,
        "fact-1",
        response,
      ),
    ).not.toThrow();
    expect(() =>
      assertKnowThatFeedbackResponseSemanticBindingsV1(
        request,
        "fact-other",
        response,
      ),
    ).toThrow(/binding mismatch/u);
  });

  it("treats payload key order as the same canonical feedback", () => {
    expect(() =>
      assertKnowThatFeedbackResponseSemanticBindingsV1(
        request,
        "fact-1",
        {
          schema_version: "knowthat_feedback.v1",
          id: "feedback-event-1",
          bot_id: "bot-1",
          fact_id: "fact-1",
          feedback_type: "correct",
          payload: { confidence: 0.98, corrected_object: "Shanghai" },
          evidence_ref: "user_feedback:feedback-1",
          created_at: "2026-07-27T00:00:00.000Z",
          duplicate_replayed: true,
        },
      ),
    ).not.toThrow();
  });
});
