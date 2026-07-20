import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  TERMINAL_OUTCOMES_V1,
  TriggerProcessStateV1Schema,
  isTriggerProcessTransitionV1Allowed,
  type TriggerProcessStateV1,
} from "../../src/index.js";

const running = (phase: "admission" | "context" | "intent" | "execution") =>
  ({
    phase,
    status: "running",
    wait_reason: null,
    terminal_reason: null,
  }) as const satisfies TriggerProcessStateV1;

describe("TriggerProcessStateV1", () => {
  it("enforces waiting iff wait_reason is non-null", () => {
    expect(
      Value.Check(TriggerProcessStateV1Schema, {
        phase: "admission",
        status: "waiting",
        wait_reason: "weak_queue",
        terminal_reason: null,
      }),
    ).toBe(true);
    expect(
      Value.Check(TriggerProcessStateV1Schema, {
        phase: "admission",
        status: "waiting",
        wait_reason: null,
        terminal_reason: null,
      }),
    ).toBe(false);
  });

  it("keeps external confirmation in intent and out of execution", () => {
    expect(
      Value.Check(TriggerProcessStateV1Schema, {
        phase: "intent",
        status: "waiting",
        wait_reason: "external_confirmation",
        terminal_reason: null,
      }),
    ).toBe(true);
    expect(
      Value.Check(TriggerProcessStateV1Schema, {
        phase: "execution",
        status: "waiting",
        wait_reason: "external_confirmation",
        terminal_reason: null,
      }),
    ).toBe(false);
  });

  it("allows only admission states as the creation edge", () => {
    expect(isTriggerProcessTransitionV1Allowed(null, running("admission"))).toBe(
      true,
    );
    expect(isTriggerProcessTransitionV1Allowed(null, running("context"))).toBe(
      false,
    );
  });

  it("accepts canonical transitions and rejects invented phases", () => {
    expect(
      isTriggerProcessTransitionV1Allowed(running("context"), running("intent")),
    ).toBe(true);
    expect(
      isTriggerProcessTransitionV1Allowed(
        {
          phase: "closed",
          status: "completed",
          wait_reason: null,
          terminal_reason: "meta_completed",
        },
        running("admission"),
      ),
    ).toBe(false);
    expect(
      Value.Check(TriggerProcessStateV1Schema, {
        phase: "meta",
        status: "running",
        wait_reason: null,
        terminal_reason: null,
      }),
    ).toBe(false);
  });

  it("keeps the accountable terminal outcome closed set", () => {
    expect(TERMINAL_OUTCOMES_V1).toEqual([
      "executed",
      "merged_and_executed",
      "superseded_by_later_trigger",
      "deferred_then_executed",
      "expired_with_audit_record",
      "cancelled_with_reason",
      "failed_with_reason",
      "preempted_and_handed_off",
      "interrupted_with_reason",
    ]);
  });
});
