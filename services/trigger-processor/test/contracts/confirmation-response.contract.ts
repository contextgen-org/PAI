import {
  TriggerConfirmationResponseResultV1Schema,
  TriggerConfirmationResponseV1Schema,
} from "@pai/contracts";
import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { pendingConfirmationChallengeV1 } from "./confirmation-challenge.contract.js";

describe("TriggerConfirmationResponseV1", () => {
  it("accepts only the closed decision set and full replay identity", () => {
    const request = {
      schema_version: "trigger_confirmation_response.v1",
      decision: "accept",
      expected_intent_version: 2,
      idempotency_key: "process-1:confirmation:confirmation-1:accept",
      response_hash: `sha256:${"c".repeat(64)}`,
      trace_id: "trace-1",
    };
    expect(Value.Check(TriggerConfirmationResponseV1Schema, request)).toBe(true);
    expect(
      Value.Check(TriggerConfirmationResponseV1Schema, {
        ...request,
        decision: "approve",
      }),
    ).toBe(false);
  });

  it("returns the decided challenge and duplicate replay fact", () => {
    expect(
      Value.Check(TriggerConfirmationResponseResultV1Schema, {
        schema_version: "trigger_confirmation_result.v1",
        trigger_process_id: pendingConfirmationChallengeV1.trigger_process_id,
        challenge_id: pendingConfirmationChallengeV1.challenge_id,
        decision: "accept",
        challenge_status: "accepted",
        process_state_version: 6,
        request_hash: `sha256:${"d".repeat(64)}`,
        response_hash: `sha256:${"c".repeat(64)}`,
        confirmation_ref: "confirmation:confirmation-1",
        confirmation_hash: `sha256:${"e".repeat(64)}`,
        stage_execute_work_id: "trigger-work:process-1:runtime-start:1",
        duplicate_replayed: false,
        trace_id: "trace-1",
      }),
    ).toBe(true);
  });
});
