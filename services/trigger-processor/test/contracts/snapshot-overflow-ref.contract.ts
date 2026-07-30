import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  SnapshotOverflowRefV1Schema,
  assertSnapshotOverflowRefSemanticBindingsV1,
} from "@pai/contracts";

const valid = {
  schema_version: "snapshot_overflow_ref.v1",
  source_service: "action_runtime",
  store_type: "runtime_events",
  object_ref: "runtime-event-batch:1-10",
  first_append_sequence_no: 1,
  last_append_sequence_no: 10,
  source_sequence_range: {
    first_source_sequence_no: 11,
    last_source_sequence_no: 20,
  },
  checksum_algorithm: "sha256",
  checksum: `sha256:${"a".repeat(64)}`,
  retention_until: "2026-08-31T00:00:00.000Z",
  redaction_state: "complete",
} as const;

describe("SnapshotOverflowRefV1", () => {
  it("freezes the owner ref, both ranges, checksum, retention, and redaction", () => {
    expect(Value.Check(SnapshotOverflowRefV1Schema, valid)).toBe(true);
    expect(() =>
      assertSnapshotOverflowRefSemanticBindingsV1(valid),
    ).not.toThrow();
  });

  it("rejects partial legacy aliases and reversed ranges", () => {
    expect(
      Value.Check(SnapshotOverflowRefV1Schema, {
        source_service: valid.source_service,
        content_ref: valid.object_ref,
        content_hash: valid.checksum,
      }),
    ).toBe(false);
    expect(() =>
      assertSnapshotOverflowRefSemanticBindingsV1({
        ...valid,
        first_append_sequence_no: 11,
      }),
    ).toThrow(/semantic binding/u);
    expect(() =>
      assertSnapshotOverflowRefSemanticBindingsV1({
        ...valid,
        source_service: "memory",
      }),
    ).toThrow(/semantic binding/u);
  });
});
