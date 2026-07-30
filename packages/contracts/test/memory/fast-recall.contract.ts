import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  MemoryFastRecallRequestV1Schema,
  MemoryFastRecallResponseV1Schema,
  assertMemoryFastRecallRequestSemanticBindingsV1,
  assertMemoryFastRecallResponseSemanticBindingsV1,
} from "../../src/index.js";

describe("MemoryFastRecallV1", () => {
  it("requires snapshot binding for continuation cursors", () => {
    const firstPage = {
      schema_version: "memory.fast_recall.v1",
      bot_id: "bot-1",
      query: "database choice",
      query_purpose: "context_injection",
      limit: 8,
    } as const;
    expect(Value.Check(MemoryFastRecallRequestV1Schema, firstPage)).toBe(true);
    expect(() =>
      assertMemoryFastRecallRequestSemanticBindingsV1(firstPage),
    ).not.toThrow();
    expect(() =>
      assertMemoryFastRecallRequestSemanticBindingsV1({
        ...firstPage,
        cursor: "cursor-2",
      }),
    ).toThrow(/snapshot_token/);
  });

  it("binds partial_reason and rejects duplicate recall points", () => {
    const response = {
      schema_version: "memory.fast_recall.v1",
      snapshot_token: "snapshot-1",
      query_revision: 1,
      ranking_profile_version: "memory.fast_recall.ranking.v1",
      items: [
        {
          memory_point_id: "point-1",
          series_id: "series-1",
          topic_family_key: "family-1",
          topic_key: "topic-1",
          content_summary: "PostgreSQL was selected.",
          occurred_at: "2026-07-23T00:00:00.000Z",
          status: "active",
          score_breakdown: {
            vector: 0.9,
            keyword: 0.8,
            importance: 0.7,
            recency: 0.6,
            tag_boost: 0.05,
            status_decay: 1,
            final_score: 0.82,
          },
          redaction_status: "not_required",
        },
      ],
      is_partial: false,
    } as const;
    expect(Value.Check(MemoryFastRecallResponseV1Schema, response)).toBe(true);
    expect(() =>
      assertMemoryFastRecallResponseSemanticBindingsV1(response),
    ).not.toThrow();
    expect(() =>
      assertMemoryFastRecallResponseSemanticBindingsV1({
        ...response,
        is_partial: true,
      }),
    ).toThrow(/semantic binding mismatch/);
  });
});
