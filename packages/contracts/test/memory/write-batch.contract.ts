import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  MemoryWriteBatchRequestV1Schema,
  MemoryWriteBatchResponseV1Schema,
  assertMemoryWriteBatchRequestSemanticBindingsV1,
  assertMemoryWriteBatchResponseSemanticBindingsV1,
} from "../../src/index.js";

const request = {
  schema_version: "memory.write_batch.v1",
  bot_id: "bot-1",
  trigger_process_id: "process-1",
  source_meta_job_id: "meta-job-1",
  idempotency_key: "meta-job-1:memory",
  items: [
    {
      client_item_id: "item-1",
      content_summary: "The user chose PostgreSQL.",
      subject_refs: [
        { subject_type: "user", canonical_id: "user-1", primary: true },
      ],
      human_agent_relation: [],
      keyword_tags: ["postgresql"],
      scene_tags: ["architecture_review"],
      emotion_tags: ["neutral"],
      source_info: {
        source_type: "trigger_snapshot",
        source_ref: "trigger_process:process-1",
        actor_type: "user",
        actor_id: "user-1",
        evidence_refs: ["trigger_process:process-1"],
        trace_id: "trace-1",
      },
      confidence_score: 0.95,
      occurred_at: "2026-07-23T00:00:00.000Z",
    },
  ],
} as const;

describe("MemoryWriteBatchV1", () => {
  it("accepts the owner request and enforces custom semantic keywords", () => {
    expect(Value.Check(MemoryWriteBatchRequestV1Schema, request)).toBe(true);
    expect(() =>
      assertMemoryWriteBatchRequestSemanticBindingsV1(request),
    ).not.toThrow();

    const missingPrimary = {
      ...request,
      items: [
        {
          ...request.items[0],
          subject_refs: [
            { subject_type: "user", canonical_id: "user-1" },
            { subject_type: "project", canonical_id: "project-1" },
          ],
        },
      ],
    } as const;
    expect(Value.Check(MemoryWriteBatchRequestV1Schema, missingPrimary)).toBe(
      true,
    );
    expect(() =>
      assertMemoryWriteBatchRequestSemanticBindingsV1(missingPrimary),
    ).toThrow(/exactly one primary/);
    expect(() =>
      assertMemoryWriteBatchRequestSemanticBindingsV1({
        ...missingPrimary,
        compatibility_mode: "legacy_subject_order",
      }),
    ).not.toThrow();
  });

  it("rejects duplicate client item identities and UTF-8 byte overflow", () => {
    expect(() =>
      assertMemoryWriteBatchRequestSemanticBindingsV1({
        ...request,
        items: [request.items[0], request.items[0]],
      }),
    ).toThrow(/duplicate canonical identity/);
    expect(() =>
      assertMemoryWriteBatchRequestSemanticBindingsV1({
        ...request,
        idempotency_key: "界".repeat(43),
      }),
    ).toThrow(/128 UTF-8 bytes/);
    expect(() =>
      assertMemoryWriteBatchRequestSemanticBindingsV1({
        ...request,
        idempotency_key: "a".repeat(128),
      }),
    ).not.toThrow();
    expect(
      Value.Check(MemoryWriteBatchRequestV1Schema, {
        ...request,
        idempotency_key: "a".repeat(129),
      }),
    ).toBe(true);
    expect(() =>
      assertMemoryWriteBatchRequestSemanticBindingsV1({
        ...request,
        idempotency_key: "a".repeat(129),
      }),
    ).toThrow(/128 UTF-8 bytes/);
  });

  it("normalizes optional evidence expiry to null or canonical UTC", () => {
    expect(() =>
      assertMemoryWriteBatchRequestSemanticBindingsV1({
        ...request,
        items: [
          {
            ...request.items[0],
            evidence_valid_until: "2026-07-24T00:00:00.000Z",
          },
        ],
      }),
    ).not.toThrow();
    expect(() =>
      assertMemoryWriteBatchRequestSemanticBindingsV1({
        ...request,
        items: [
          {
            ...request.items[0],
            evidence_valid_until: null,
          },
        ],
      }),
    ).not.toThrow();
    expect(() =>
      assertMemoryWriteBatchRequestSemanticBindingsV1({
        ...request,
        items: [
          {
            ...request.items[0],
            evidence_valid_until: "2026-07-24T08:00:00+08:00",
          },
        ],
      }),
    ).toThrow(/canonical RFC 3339/);
  });

  it("binds response projections to item results", () => {
    const response = {
      schema_version: "memory.write_batch.v1",
      write_batch_id: "batch-1",
      batch_status: "completed",
      item_results: [
        {
          client_item_id: "item-1",
          status: "succeeded",
          decision: "new_series",
          memory_point_id: "point-1",
          series_id: "series-1",
          topic_key: "topic-1",
          version_no: 1,
          conflict_ids: [],
        },
      ],
      accepted_point_ids: ["point-1"],
      rejected_items: [],
      conflict_ids: [],
      warnings: [],
      duplicate_replayed: false,
    } as const;
    expect(Value.Check(MemoryWriteBatchResponseV1Schema, response)).toBe(true);
    expect(() =>
      assertMemoryWriteBatchResponseSemanticBindingsV1(response),
    ).not.toThrow();
    expect(() =>
      assertMemoryWriteBatchResponseSemanticBindingsV1({
        ...response,
        accepted_point_ids: [],
      }),
    ).toThrow(/accepted_point_ids mismatch/);
    expect(
      Value.Check(MemoryWriteBatchResponseV1Schema, {
        ...response,
        item_results: [
          {
            ...response.item_results[0],
            version_no: Number.MAX_SAFE_INTEGER + 1,
          },
        ],
      }),
    ).toBe(false);
  });
});
