import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  assertMetaFeedbackRequestListResponseSemanticBindingsV1,
  MetaFeedbackRequestListContractV1Schema,
} from "../../src/index.js";
import { at, later, scope } from "./owner-fixtures.v1.js";

function item(id: string, createdAt: string) {
  return {
    feedback_request_id: id,
    bot_id: "bot-1",
    dedupe_scope_ref: {
      kind: "candidate",
      ref: `candidate:${id}`,
    },
    question_key: "confirm_fact",
    question_ref: `question:${id}`,
    status: "open",
    assignee: "developer-1",
    delivery_mode: "internal_queue",
    delivery_status: "not_applicable",
    created_at: createdAt,
    expires_at: "2026-07-30T00:00:00.000Z",
  };
}

describe("MetaFeedbackRequestListContractV1", () => {
  it("binds assignee, five-part scope, and ascending stable pagination", () => {
    expect(
      Value.Check(MetaFeedbackRequestListContractV1Schema, {
        status: "open",
        assignee: "developer-1",
        ...scope,
        cursor: null,
        limit: 100,
      }),
    ).toBe(true);
    const response = {
      assignee: "developer-1",
      items: [item("feedback-1", at), item("feedback-2", later)],
      next_cursor: null,
      has_more: false,
      trace_id: "trace-1",
    };
    expect(Value.Check(MetaFeedbackRequestListContractV1Schema, response)).toBe(
      true,
    );
    expect(() =>
      assertMetaFeedbackRequestListResponseSemanticBindingsV1(
        response as never,
      ),
    ).not.toThrow();
  });

  it("rejects cross-assignee rows", () => {
    const response = {
      assignee: "developer-1",
      items: [{ ...item("feedback-1", at), assignee: "developer-2" }],
      next_cursor: null,
      has_more: false,
      trace_id: "trace-1",
    };
    expect(() =>
      assertMetaFeedbackRequestListResponseSemanticBindingsV1(
        response as never,
      ),
    ).toThrow(/binding/);
  });
});
