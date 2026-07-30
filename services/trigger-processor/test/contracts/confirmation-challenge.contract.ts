import {
  TriggerConfirmationChallengeV1Schema,
  assertTriggerConfirmationChallengeSemanticBindingsV1,
} from "@pai/contracts";
import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

export const pendingConfirmationChallengeV1 = {
  schema_version: "trigger_confirmation_challenge.v1" as const,
  challenge_id: "confirmation-1",
  trigger_process_id: "process-1",
  workspace_id: "workspace-1",
  bot_id: "bot-1",
  owner_agent_id: "agent-1",
  deployment_environment: "prod" as const,
  release_channel: "stable" as const,
  intent_ref: "intent:process-1:2",
  intent_version: 2,
  structured_intent_hash: `sha256:${"a".repeat(64)}`,
  policy_input_hash: `sha256:${"b".repeat(64)}`,
  action_step_ids: ["step-1"],
  allowed_principal_type: "user" as const,
  allowed_principal_id: "user-1",
  status: "pending" as const,
  expires_at: "2026-07-27T00:15:00Z",
  request_hash: null,
  response_hash: null,
  confirmation_hash: null,
  stage_execute_work_id: null,
  idempotency_key: null,
  responded_by: null,
  responded_at: null,
  created_at: "2026-07-27T00:00:00Z",
  updated_at: "2026-07-27T00:00:00Z",
};

describe("TriggerConfirmationChallengeV1", () => {
  it("freezes intent, policy and full owner scope while pending", () => {
    expect(Value.Check(TriggerConfirmationChallengeV1Schema, pendingConfirmationChallengeV1)).toBe(true);
    expect(() =>
      assertTriggerConfirmationChallengeSemanticBindingsV1(
        pendingConfirmationChallengeV1,
      ),
    ).not.toThrow();
  });

  it("requires an all-null or all-present response identity", () => {
    expect(() =>
      assertTriggerConfirmationChallengeSemanticBindingsV1({
        ...pendingConfirmationChallengeV1,
        status: "accepted",
        response_hash: `sha256:${"c".repeat(64)}`,
      }),
    ).toThrow(/semantic binding mismatch/u);
    expect(
      Value.Check(TriggerConfirmationChallengeV1Schema, {
        ...pendingConfirmationChallengeV1,
        intent_version: Number.MAX_SAFE_INTEGER + 1,
      }),
    ).toBe(false);
  });
});
