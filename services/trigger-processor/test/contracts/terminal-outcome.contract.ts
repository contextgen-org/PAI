import {
  TERMINAL_OUTCOMES_V1,
  TerminalOutcomeV1Schema,
} from "@pai/contracts";
import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

describe("TerminalOutcomeV1", () => {
  it("accepts exactly the nine documented outcomes", () => {
    expect(TERMINAL_OUTCOMES_V1).toHaveLength(9);
    for (const outcome of TERMINAL_OUTCOMES_V1) {
      expect(Value.Check(TerminalOutcomeV1Schema, outcome)).toBe(true);
    }
    expect(Value.Check(TerminalOutcomeV1Schema, "completed")).toBe(false);
  });
});
