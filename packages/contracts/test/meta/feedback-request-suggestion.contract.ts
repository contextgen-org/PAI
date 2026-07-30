import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  MetaFeedbackRequestSuggestionContractV1Schema,
  MetaFeedbackRequestSuggestionRequestV1Schema,
} from "../../src/index.js";
import { hashA, hashB, scope } from "./owner-fixtures.v1.js";

describe("MetaFeedbackRequestSuggestionContractV1", () => {
  it("accepts only the two documented service principals", () => {
    const request = {
      schema_version: "meta.feedback_request_suggestion.v1",
      source_kind: "service_command",
      source_service: "timer_trigger_app",
      source_ref: "schedule-1",
      command_id: "command-1",
      ...scope,
      dedupe_scope_ref: {
        kind: "schedule",
        ref: "schedule:schedule-1",
      },
      question_key: "confirm_schedule",
      question_ref: "question-1",
      question_hash: hashA,
      request_hash: hashB,
      trace_id: "trace-1",
    };
    expect(
      Value.Check(MetaFeedbackRequestSuggestionRequestV1Schema, request),
    ).toBe(true);
    expect(
      Value.Check(MetaFeedbackRequestSuggestionRequestV1Schema, {
        ...request,
        source_service: "trigger_processor",
      }),
    ).toBe(false);
  });

  it("distinguishes stable replay from body/open conflicts", () => {
    expect(
      Value.Check(MetaFeedbackRequestSuggestionContractV1Schema, {
        status: "replayed",
        feedback_request_id: "feedback-1",
        command_id: "command-1",
        request_hash: hashA,
      }),
    ).toBe(true);
    expect(
      Value.Check(MetaFeedbackRequestSuggestionContractV1Schema, {
        status: "conflict",
        code: "idempotency_body_drift",
      }),
    ).toBe(true);
  });
});
