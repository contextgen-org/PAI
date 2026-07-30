import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  ACTION_RUNTIME_DOMAIN_EVENT_TYPES_V1,
  RUNTIME_TOKEN_SSE_FORBIDDEN_DURABLE_FIELDS_V1,
  RuntimeTokenSseEventV1Schema,
} from "../../src/index.js";

const frame = {
  schema_version: "runtime_token_sse_event.v1",
  runtime_run_id: "run-01",
  trigger_process_id: "process-01",
  token: "next",
  emitted_at: "2026-07-13T12:00:02.123Z",
};

describe("RuntimeTokenSseEventV1 live-only contract", () => {
  it("accepts the exact five-field token frame", () => {
    expect(Value.Check(RuntimeTokenSseEventV1Schema, frame)).toBe(true);
    expect(Object.keys(frame).sort()).toEqual(
      [
        "emitted_at",
        "runtime_run_id",
        "schema_version",
        "token",
        "trigger_process_id",
      ].sort(),
    );
  });

  it("cannot acquire durable identity, replay or append fields", () => {
    for (const field of RUNTIME_TOKEN_SSE_FORBIDDEN_DURABLE_FIELDS_V1) {
      expect(
        Value.Check(RuntimeTokenSseEventV1Schema, {
          ...frame,
          [field]: field === "sequence_no" ? 1 : "forbidden",
        }),
      ).toBe(false);
    }
    expect(ACTION_RUNTIME_DOMAIN_EVENT_TYPES_V1).not.toContain("runtime.token");
  });
});
