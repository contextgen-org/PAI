import { TriggerProcessGetResponseV1Schema } from "@pai/contracts";
import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { processDetailsFixtureV1 } from "./process-query.contract.js";

describe("TriggerProcessGetResponseV1", () => {
  it("owns the public response envelope independently of the details projection", () => {
    const value = {
      code: "trigger_process_found",
      message: "found",
      retryable: false,
      trace_id: "trace-1",
      details: processDetailsFixtureV1,
    };
    expect(Value.Check(TriggerProcessGetResponseV1Schema, value)).toBe(true);
    expect(
      Value.Check(TriggerProcessGetResponseV1Schema, {
        ...value,
        process: processDetailsFixtureV1,
      }),
    ).toBe(false);
  });
});
