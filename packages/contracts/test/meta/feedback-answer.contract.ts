import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  assertMetaFeedbackAnswerPathBindingV1,
  MetaFeedbackAnswerContractV1Schema,
  MetaFeedbackAnswerRequestV1Schema,
} from "../../src/index.js";

const request = {
  schema_version: "meta_feedback_answer.v1",
  feedback_request_id: "feedback-1",
  trigger_id: "trigger-1",
  bot_id: "bot-1",
  answer_payload: { confirmed: true },
  trace_id: "trace-1",
};

describe("MetaFeedbackAnswerContractV1", () => {
  it("binds path identity and preserves a replay discriminator", () => {
    expect(Value.Check(MetaFeedbackAnswerRequestV1Schema, request)).toBe(
      true,
    );
    expect(() =>
      assertMetaFeedbackAnswerPathBindingV1("feedback-1", request as never),
    ).not.toThrow();
    expect(
      Value.Check(MetaFeedbackAnswerContractV1Schema, {
        feedback_request_id: "feedback-1",
        status: "answered",
        answered_by_trigger_id: "trigger-1",
        duplicate_replayed: true,
      }),
    ).toBe(true);
  });

  it("rejects a path/body mismatch", () => {
    expect(() =>
      assertMetaFeedbackAnswerPathBindingV1("other", request as never),
    ).toThrow(/path\/body/);
  });
});
