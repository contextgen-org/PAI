import { createHash } from "node:crypto";

import {
  type TriggerConfirmationChallengeV1,
} from "@pai/contracts";
import { canonicalJsonV1 } from "@pai/eventing";
import { describe, expect, it, vi } from "vitest";

import {
  AcceptedTriggerConfirmationErrorV1,
  TriggerConfirmationResponseErrorV1,
  createAcceptedTriggerConfirmationVerifierV1,
  createTriggerConfirmationPendingReadApplicationV1,
  type TriggerConfirmationOwnerRowV1,
} from "../src/application/confirmation.v1.js";
import { createTriggerConfirmationReadRepositoryV1 } from "../src/db/confirmation-read-repository.v1.js";

const pendingConfirmationPreview = {
  goal: "send a short email",
  user_need: "Send an email to user@example.com with the body hello.",
  response_style: "concise",
  action_plan: [
    {
      step: 1,
      action_type: "ask_confirmation" as const,
      action: "Confirm the recipient user@example.com and body hello before sending.",
      candidate_tool: "mail.send",
      risk_level: "high" as const,
      requires_confirmation: true,
    },
  ],
  required_skills: [],
  memory_followups: [],
  safety_notes: ["Do not send until the user confirms."],
  requires_confirmation: true,
};

const structuredIntentHash = `sha256:${createHash("sha256")
  .update(canonicalJsonV1(pendingConfirmationPreview), "utf8")
  .digest("hex")}`;

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
  structured_intent_hash: structuredIntentHash,
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
    structured_intent_hash: structuredIntentHash,
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

const legacyMillisecondConfirmationHash = `sha256:${createHash("sha256")
  .update(canonicalJsonV1({
    schema_version: "trigger_confirmation_proof.v1",
    confirmation_ref: "confirmation:confirmation-1",
    challenge_id: "confirmation-1",
    trigger_process_id: "process-1",
    intent_ref: "intent:process-1:2",
    intent_version: 2,
    structured_intent_hash: structuredIntentHash,
    policy_input_hash: `sha256:${"b".repeat(64)}`,
    action_step_ids: ["step-1"],
    principal_type: "user",
    principal_id: "user-1",
    decision: "accept",
    request_hash: `sha256:${"d".repeat(64)}`,
    response_hash: `sha256:${"c".repeat(64)}`,
    accepted_at: "2026-07-30T00:01:00.000Z",
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
    confirmation_structured_intent: pendingConfirmationPreview,
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
  structured_intent_hash: structuredIntentHash,
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

  it("accepts only the exact legacy millisecond receipt serialization", async () => {
    const verifier = createAcceptedTriggerConfirmationVerifierV1(
      { async findByChallengeId() {
        return ownerRow({ confirmation_hash: legacyMillisecondConfirmationHash });
      } },
      { now: () => new Date("2026-07-30T00:02:00Z") },
    );
    await expect(
      verifier.assertAccepted(
        { ...expected, confirmation_hash: legacyMillisecondConfirmationHash },
        new AbortController().signal,
      ),
    ).resolves.toBeUndefined();
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

  it("reads a pending preview only from the matching durable Runtime Start request", async () => {
    const query = vi.fn(async () => ({ rows: [ownerRow()] }));
    const repository = createTriggerConfirmationReadRepositoryV1({ query });
    await repository.findPendingByProcessAndPrincipal(
      "process-1",
      "user",
      "user-1",
      new AbortController().signal,
    );
    const [sql, values] = query.mock.calls[0] as unknown as [
      string,
      unknown[],
    ];
    expect(sql).toContain("confirmation_structured_intent");
    expect(sql).toContain("candidate.id = 'trigger-work:' || c.trigger_process_id || ':runtime-start:1'");
    expect(sql).toContain("candidate.payload #>> '{request,intent_ref}' = c.intent_ref");
    expect(values).toEqual(["process-1", "user", "user-1"]);
  });

  it("reveals only the owner-created pending challenge to its exact Supabase principal", async () => {
    const pending = ownerRow({
      status: "pending",
      request_hash: null,
      response_hash: null,
      confirmation_hash: null,
      stage_execute_work_id: null,
      idempotency_key: null,
      responded_by: null,
      responded_at: null,
    });
    const findPendingByProcessAndPrincipal = vi.fn(async () => pending);
    const application = createTriggerConfirmationPendingReadApplicationV1(
      { findPendingByProcessAndPrincipal },
      { now: () => new Date("2026-07-30T00:02:00Z") },
    );
    await expect(
      application.getPending(
        {
          authentication_kind: "supabase_ingress",
          credential: {
            principal: { principal_type: "user", principal_id: "user-1" },
          },
        } as never,
        "process-1",
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({
      challenge_id: "confirmation-1",
      status: "pending",
      allowed_principal_id: "user-1",
      confirmation_preview: pendingConfirmationPreview,
    });
    expect(findPendingByProcessAndPrincipal).toHaveBeenCalledWith(
      "process-1",
      "user",
      "user-1",
      expect.any(AbortSignal),
    );
  });

  it("fails closed when the durable Runtime Start intent no longer matches the challenge hash", async () => {
    const pending = ownerRow({
      status: "pending",
      request_hash: null,
      response_hash: null,
      confirmation_hash: null,
      stage_execute_work_id: null,
      idempotency_key: null,
      responded_by: null,
      responded_at: null,
      confirmation_structured_intent: {
        ...pendingConfirmationPreview,
        goal: "send a different email",
      },
    });
    const application = createTriggerConfirmationPendingReadApplicationV1(
      { async findPendingByProcessAndPrincipal() { return pending; } },
      { now: () => new Date("2026-07-30T00:02:00Z") },
    );
    await expect(
      application.getPending(
        {
          authentication_kind: "supabase_ingress",
          credential: {
            principal: { principal_type: "user", principal_id: "user-1" },
          },
        } as never,
        "process-1",
        new AbortController().signal,
      ),
    ).rejects.toMatchObject<TriggerConfirmationResponseErrorV1>({
      code: "owner_contract_drift",
    });
  });
});
