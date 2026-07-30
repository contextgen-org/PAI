import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { MetaSnapshotRepairResponseV1Schema } from "../../src/index.js";
import { later } from "./owner-fixtures.v1.js";

describe("MetaSnapshotRepairResponseV1", () => {
  it("makes accepted/rejected response fields unambiguous", () => {
    expect(
      Value.Check(MetaSnapshotRepairResponseV1Schema, {
        job_id: "job-1",
        repair_id: "repair-1",
        input_revision: 2,
        snapshot_version: 2,
        status: "accepted",
        next_retry_at: later,
        duplicate_replayed: false,
        accepted_at: later,
      }),
    ).toBe(true);
    expect(
      Value.Check(MetaSnapshotRepairResponseV1Schema, {
        job_id: "job-1",
        repair_id: "repair-1",
        input_revision: 1,
        snapshot_version: 1,
        status: "rejected",
        next_retry_at: null,
        duplicate_replayed: true,
        accepted_at: null,
        reason_code: "job_terminal",
      }),
    ).toBe(true);
  });

  it("rejects a rejected response with an acceptance timestamp", () => {
    expect(
      Value.Check(MetaSnapshotRepairResponseV1Schema, {
        job_id: "job-1",
        repair_id: "repair-1",
        input_revision: 1,
        snapshot_version: 1,
        status: "rejected",
        next_retry_at: null,
        duplicate_replayed: false,
        accepted_at: later,
        reason_code: "job_terminal",
      }),
    ).toBe(false);
  });
});
