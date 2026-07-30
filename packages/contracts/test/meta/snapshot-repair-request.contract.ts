import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  assertMetaSnapshotRepairRequestSemanticBindingsV1,
  MetaSnapshotRepairRequestV1Schema,
} from "../../src/index.js";
import { hashA, hashB } from "./owner-fixtures.v1.js";

const request = {
  schema_version: "meta_snapshot_repair.v1",
  repair_id: "repair-1",
  meta_job_id: "job-1",
  trigger_process_id: "process-1",
  previous_snapshot_ref: "snapshot-1",
  previous_snapshot_version: 1,
  previous_snapshot_hash: hashA,
  next_snapshot_ref: "snapshot-2",
  next_snapshot_version: 2,
  next_snapshot_hash: hashB,
  snapshot_retention_until: "2026-07-30T00:00:00.000Z",
  reason_code: "snapshot_hash_mismatch",
  idempotency_key: "repair-1",
  trace_id: "trace-1",
};

describe("MetaSnapshotRepairRequestV1", () => {
  it("binds repair identity, monotonic input version, and retention", () => {
    expect(Value.Check(MetaSnapshotRepairRequestV1Schema, request)).toBe(true);
    expect(() =>
      assertMetaSnapshotRepairRequestSemanticBindingsV1(
        request as never,
        Date.parse("2026-07-23T00:00:00.000Z"),
      ),
    ).not.toThrow();
  });

  it("rejects idempotency and version drift", () => {
    expect(() =>
      assertMetaSnapshotRepairRequestSemanticBindingsV1(
        {
          ...request,
          idempotency_key: "other",
          next_snapshot_version: 1,
        } as never,
        Date.parse("2026-07-23T00:00:00.000Z"),
      ),
    ).toThrow(/semantic binding/);
  });
});
