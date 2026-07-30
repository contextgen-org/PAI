import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  assertMetaResultAuditQueryResponseSemanticBindingsV1,
  MetaResultAuditQueryContractV1Schema,
} from "../../src/index.js";
import { at, later, scope } from "./owner-fixtures.v1.js";

function response(items: readonly Record<string, unknown>[]) {
  return {
    meta_result_id: "result-1",
    trigger_process_id: "process-1",
    bot_id: "bot-1",
    result_version: 2,
    result_status: "complete",
    items,
    next_cursor: null,
    has_more: false,
    redacted_field_count: 2,
    trace_id: "trace-1",
  };
}

function audit(
  auditId: string,
  version: number,
  createdAt: string,
) {
  return {
    audit_id: auditId,
    result_version: version,
    previous_result_status: version === 1 ? null : "partial_pending",
    result_status: version === 1 ? "partial_pending" : "complete",
    operation: "compensation_settled",
    changed_failure_ids: ["failure-1"],
    actor_kind: "service",
    actor_ref: "meta_cognition",
    payload_summary: { redacted: true },
    created_at: createdAt,
  };
}

describe("MetaResultAuditQueryContractV1", () => {
  it("owns request/response and stable result-version ordering", () => {
    expect(
      Value.Check(MetaResultAuditQueryContractV1Schema, {
        meta_result_id: "result-1",
        ...scope,
        cursor: null,
        limit: 100,
      }),
    ).toBe(true);
    const value = response([audit("audit-1", 1, at), audit("audit-2", 2, later)]);
    expect(Value.Check(MetaResultAuditQueryContractV1Schema, value)).toBe(
      true,
    );
    expect(() =>
      assertMetaResultAuditQueryResponseSemanticBindingsV1(value as never),
    ).not.toThrow();
  });

  it("rejects cursor and ordering drift", () => {
    const value = {
      ...response([audit("audit-2", 2, later), audit("audit-1", 1, at)]),
      has_more: true,
    };
    expect(() =>
      assertMetaResultAuditQueryResponseSemanticBindingsV1(value as never),
    ).toThrow(/cursor|ordering/);
  });
});
