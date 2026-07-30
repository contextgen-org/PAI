import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  MetaJobQueryDetailsV1Schema,
  assertMetaJobQueryDetailsSemanticBindingsV1,
} from "../../src/index.js";

const details = {
  job_id: "meta_job_01",
  trigger_process_id: "tp_01",
  bot_id: "bot_01",
  status: "completed",
  result_status: "complete",
  attempt_count: 1,
  next_retry_at: null,
  summary: {
    experience_summary: {
      summary: "completed",
      reflection_summary: null,
      evidence_refs: ["trigger_event:event_01"],
    },
    result_status: "complete",
    partial_failures_count: 0,
    quality_signals_count: 0,
    memory_write_refs: ["memory_write:batch_01"],
    knowthat_write_refs: ["knowthat_write:batch_01"],
    candidate_review_refs: [],
    skill_candidate_refs: [],
    personality_suggestion_refs: [],
  },
  error: null,
  created_at: "2026-07-13T12:00:00.000Z",
  updated_at: "2026-07-13T12:00:09.000Z",
  trace_id: "trace_meta_01",
} as const;

describe("MetaJobQueryDetailsV1", () => {
  it("exposes only the bounded result summary", () => {
    expect(MetaJobQueryDetailsV1Schema.$id).toBe(
      "urn:pai:meta:job-query-details:v1",
    );
    expect(Value.Check(MetaJobQueryDetailsV1Schema, details)).toBe(true);
    expect(() =>
      assertMetaJobQueryDetailsSemanticBindingsV1(details),
    ).not.toThrow();
  });

  it("rejects full payload expansion and retry/result drift", () => {
    expect(
      Value.Check(MetaJobQueryDetailsV1Schema, {
        ...details,
        meta_results_payload: { private: true },
      }),
    ).toBe(false);
    expect(() =>
      assertMetaJobQueryDetailsSemanticBindingsV1({
        ...details,
        status: "retry_wait",
      }),
    ).toThrow(/semantic binding/u);
    expect(() =>
      assertMetaJobQueryDetailsSemanticBindingsV1({
        ...details,
        result_status: "partial_failed",
      }),
    ).toThrow(/semantic binding/u);
  });
});
