import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  RuntimeToolInvocationRequestV1Schema,
} from "../../src/index.js";

const request = {
  schema_version: "runtime_tool_invocation_request.v1",
  runtime_run_id: "run-1",
  adapter_tool_call_id: "tool-call-1",
  tool_name: "timer.schedule",
  normalized_args: {
    delay_seconds: 30,
    labels: ["follow-up", "user-visible"],
    options: {
      notify: true,
      note: null,
    },
  },
} as const;

describe("RuntimeToolInvocationRequestV1", () => {
  it("accepts the exact JSON-only request hashed by the tool bridge", () => {
    expect(RuntimeToolInvocationRequestV1Schema.$id).toBe(
      "urn:pai:action-runtime:runtime-tool-invocation-request:v1",
    );
    expect(Value.Check(RuntimeToolInvocationRequestV1Schema, request)).toBe(
      true,
    );
  });

  it("rejects shape drift and non-object normalized arguments", () => {
    expect(
      Value.Check(RuntimeToolInvocationRequestV1Schema, {
        ...request,
        caller_selected_idempotency_key: "unsafe",
      }),
    ).toBe(false);
    expect(
      Value.Check(RuntimeToolInvocationRequestV1Schema, {
        ...request,
        normalized_args: ["not", "an", "object"],
      }),
    ).toBe(false);
  });
});
