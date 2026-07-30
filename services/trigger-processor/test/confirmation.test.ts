import { createHash } from "node:crypto";

import {
  type TriggerConfirmationChallengeV1,
} from "@pai/contracts";
import { canonicalJsonV1 } from "@pai/eventing";
import { describe, expect, it, vi } from "vitest";

import {
  AcceptedTriggerConfirmationErrorV1,
  createAcceptedTriggerConfirmationVerifierV1,
  type TriggerConfirmationOwnerRowV1,
} from "../src/application/confirmation.v1.js";
import { createTriggerConfirmationReadRepositoryV1 } from "../src/db/confirmation-read-repository.v1.js";

const challengeWithoutConfirmationHash = {
  schema_version: "trigger_confirmation_challenge.v1",
  challenge_id: "confirmation-1",
  trigger_process_id: "process-1",
  workspace_id: "workspace-1",
  bot_id: "bot-1",
  owner_agent_id: "agent-1",
  deployment_environment: "dev",
  release_channel: "stable",
  intent_ref: "intent:process-1:2",
  intent_version: 2,
  structured_intent_hash: `sha256:${"a".repeat(64)}`,
  policy_input_hash: `sha256:${"b".repeat(64)}`,
  action_step_ids: ["step-1"],
  allowed_principal_type: "user",
  allowed_principal_id: "user-1",
  status: "accepted",
  expires_at: "2026-07-30T01:00:00.000000Z",
  request_hash: `sha256:${"d".repeat(64)}`,
  response_hash: `sha256:${"c".repeat(64)}`,
  confirmation_hash: null,
  stage_execute_work_id: "work-1",
  idempotency_key: "process-1:confirmation:confirmation-1:accept",
  responded_by: "user-1",
  responded_at: "2026-07-30T00:01:00.000000Z",
  created_at: "2026-07-30T00:00:00.000000Z",
  updated_at: "2026-07-30T00:01:00.000000Z",
};

const confirmationHash = `sha256:${createHash("sha256")
  .update(canonicalJsonV1({
    schema_version: "trigger_confirmation_proof.v1",
    confirmation_ref: "confirmation:confirmation-1",
    challenge_id: "confirmation-1",
    trigger_process_id: "process-1",
    intent_ref: "intent:process-1:2",
    intent_version: 2,
    structured_intent_hash: `sha256:${"a".repeat(64)}`,
    policy_input_hash: `sha256:${"b".repeat(64)}`,
    action_step_ids: ["step-1"],
    principal_type: "user",
    principal_id: "user-1",
    decision: "accept",
    request_hash: `sha256:${"d".repeat(64)}`,
    response_hash: `sha256:${"c".repeat(64)}`,
    accepted_at: "2026-07-30T00:01:00.000000Z",
    process_state_version: 6,
    stage_execute_work_id: "work-1",
  }), "utf8")
  .digest("hex")}`;

const challenge: TriggerConfirmationChallengeV1 = {
  ...challengeWithoutConfirmationHash,
  confirmation_hash: confirmationHash,
};

function ownerRow(
  overrides: Partial<TriggerConfirmationOwnerRowV1> = {},
): TriggerConfirmationOwnerRowV1 {
  const { schema_version: _schemaVersion, ...row } = challenge;
  return {
    ...row,
    intent_version: "2",
    stage_expected_process_state_version: "6",
    ...overrides,
  };
}

const expected = {
  confirmation_ref: "confirmation:confirmation-1",
  confirmation_hash: confirmationHash,
  trigger_process_id: "process-1",
  workspace_id: "workspace-1",
  bot_id: "bot-1",
  owner_agent_id: "agent-1",
  deployment_environment: "dev" as const,
  release_channel: "stable" as const,
  intent_ref: "intent:process-1:2",
  intent_version: 2,
  structured_intent_hash: `sha256:${"a".repeat(64)}`,
  policy_input_hash: `sha256:${"b".repeat(64)}`,
};

describe("accepted Trigger confirmation verifier", () => {
  it("verifies accepted state, complete owner scope and canonical hash", async () => {
    const findByChallengeId = vi.fn(async () => ownerRow());
    const verifier = createAcceptedTriggerConfirmationVerifierV1(
      { findByChallengeId },
      { now: () => new Date("2026-07-30T00:02:00Z") },
    );
    await expect(
      verifier.assertAccepted(expected, new AbortController().signal),
    ).resolves.toBeUndefined();
    expect(findByChallengeId).toHaveBeenCalledWith(
      "confirmation-1",
      expect.any(AbortSignal),
    );
  });

  it("rejects pending, stale and cross-intent challenges", async () => {
    for (const [rowOverride, expectedOverride, code] of [
      [{ status: "pending", request_hash: null, response_hash: null, confirmation_hash: null, stage_execute_work_id: null, idempotency_key: null, responded_by: null, responded_at: null }, {}, "confirmation_not_accepted"],
      [{}, { intent_version: 3 }, "confirmation_binding_mismatch"],
      [{}, { confirmation_hash: `sha256:${"f".repeat(64)}` }, "confirmation_hash_mismatch"],
    ] as const) {
      const verifier = createAcceptedTriggerConfirmationVerifierV1(
        { async findByChallengeId() { return ownerRow(rowOverride); } },
        { now: () => new Date("2026-07-30T00:02:00Z") },
      );
      await expect(
        verifier.assertAccepted(
          { ...expected, ...expectedOverride },
          new AbortController().signal,
        ),
      ).rejects.toMatchObject<AcceptedTriggerConfirmationErrorV1>({ code });
    }
  });

  it("reads only the owner challenge id and rejects duplicate physical rows", async () => {
    const query = vi.fn(async () => ({ rows: [ownerRow()] }));
    const repository = createTriggerConfirmationReadRepositoryV1({ query });
    await repository.findByChallengeId(
      "confirmation-1",
      new AbortController().signal,
    );
    const [sql, values] = query.mock.calls[0] as unknown as [
      string,
      unknown[],
    ];
    expect(sql).toContain(
      "trigger_processor.trigger_confirmation_challenges",
    );
    expect(sql).toContain("c.challenge_id = $1::text");
    expect(sql).toContain("pg_catalog.to_char");
    expect(values).toEqual(["confirmation-1"]);
  });
});
