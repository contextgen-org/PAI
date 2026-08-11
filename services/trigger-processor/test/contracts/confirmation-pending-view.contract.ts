import {
  TriggerConfirmationPendingViewV1Schema,
} from "@pai/contracts";
import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { pendingConfirmationChallengeV1 } from "./confirmation-challenge.contract.js";

const preview = {
  goal: "send an email",
  user_need: "Send hello to user@example.com.",
  response_style: "concise",
  action_plan: [
    {
      step: 1,
      action_type: "ask_confirmation" as const,
      action: "Confirm before sending hello to user@example.com.",
      candidate_tool: "mail.send",
      risk_level: "high" as const,
      requires_confirmation: true,
    },
  ],
  required_skills: [],
  memory_followups: [],
  safety_notes: ["Never send before confirmation."],
  requires_confirmation: true,
};

describe("TriggerConfirmationPendingViewV1", () => {
  it("requires a structured, hash-bindable confirmation preview", () => {
    expect(
      Value.Check(TriggerConfirmationPendingViewV1Schema, {
        ...pendingConfirmationChallengeV1,
        confirmation_preview: preview,
      }),
    ).toBe(true);
    expect(
      Value.Check(TriggerConfirmationPendingViewV1Schema, {
        ...pendingConfirmationChallengeV1,
      }),
    ).toBe(false);
  });
});
