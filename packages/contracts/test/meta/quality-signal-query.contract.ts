import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  QualitySignalListDetailsV1Schema,
  assertQualitySignalListDetailsSemanticBindingsV1,
} from "../../src/index.js";

const details = {
  trigger_process_id: "tp_01",
  bot_id: "bot_01",
  items: [
    {
      id: "signal_02",
      signal_type: "tool_execution_failed",
      severity: "error",
      source_kind: "service",
      source_service: "action_runtime",
      actor_principal: null,
      actor_role: null,
      source_ref: "runtime_event:event_02",
      evidence_refs: ["tool_result:result_02"],
      recommended_action: "inspect tool policy",
      payload_summary: { retryable: false, stage: "tool" },
      created_at: "2026-07-13T12:00:05.000Z",
    },
    {
      id: "signal_01",
      signal_type: "feedback_required",
      severity: "warning",
      source_kind: "operator",
      source_service: null,
      actor_principal: "operator_01",
      actor_role: null,
      source_ref: "meta_audit:audit_01",
      evidence_refs: ["developer_note:note_01"],
      recommended_action: null,
      payload_summary: { queue: "review" },
      created_at: "2026-07-13T12:00:04.000Z",
    },
  ],
  next_cursor: null,
  has_more: false,
  trace_id: "trace_signal_01",
} as const;

describe("QualitySignalListDetailsV1", () => {
  it("pins taxonomy, provenance, redacted summary and cursor ordering", () => {
    expect(QualitySignalListDetailsV1Schema.$id).toBe(
      "urn:pai:meta:quality-signal-list-details:v1",
    );
    expect(Value.Check(QualitySignalListDetailsV1Schema, details)).toBe(true);
    expect(() =>
      assertQualitySignalListDetailsSemanticBindingsV1(details),
    ).not.toThrow();
  });

  it("rejects unregistered types, actorless manual sources and raw payloads", () => {
    expect(
      Value.Check(QualitySignalListDetailsV1Schema, {
        ...details,
        items: [{ ...details.items[0], signal_type: "new_unregistered_type" }],
      }),
    ).toBe(false);
    expect(() =>
      assertQualitySignalListDetailsSemanticBindingsV1({
        ...details,
        items: [
          {
            ...details.items[1],
            actor_principal: null,
            actor_role: null,
          },
        ],
      }),
    ).toThrow(/source binding/u);
    expect(
      Value.Check(QualitySignalListDetailsV1Schema, {
        ...details,
        items: [{ ...details.items[0], payload: { raw_prompt: "secret" } }],
      }),
    ).toBe(false);
  });
});
