import { TriggerSubmitResponseV1Schema } from "@pai/contracts";
import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

const accepted = {
  code: "trigger_accepted",
  message: "accepted",
  retryable: false,
  details: {
    trigger_id: "trigger-1",
    trigger_status: "accepted",
    trigger_process_id: "process-1",
    process_phase: "admission",
    process_status: "running",
    priority: "strong",
    action: "dispatch",
    duplicate_replayed: false,
  },
  trace_id: "trace-1",
} as const;

describe("TriggerSubmitResponseV1", () => {
  it("owns only success, business rejection and duplicate replay", () => {
    expect(TriggerSubmitResponseV1Schema.$id).toBe(
      "urn:pai:trigger-processor:trigger-submit-response:v1",
    );
    expect(Value.Check(TriggerSubmitResponseV1Schema, accepted)).toBe(true);
    expect(
      Value.Check(TriggerSubmitResponseV1Schema, {
        ...accepted,
        details: {
          ...accepted.details,
          process_phase: "closed",
          process_status: "running",
        },
      }),
    ).toBe(false);
    expect(
      Value.Check(TriggerSubmitResponseV1Schema, {
        code: "invalid_request",
        message: "invalid",
        retryable: false,
        details: {},
        trace_id: "trace-1",
      }),
    ).toBe(false);
  });

});
