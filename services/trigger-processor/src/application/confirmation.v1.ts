import { createHash } from "node:crypto";

import {
  TriggerConfirmationChallengeV1Schema,
  TriggerConfirmationResponseResultV1Schema,
  TriggerConfirmationResponseV1Schema,
  assertTriggerConfirmationChallengeSemanticBindingsV1,
  type TriggerConfirmationChallengeV1,
  type TriggerConfirmationResponseResultV1,
  type TriggerConfirmationResponseV1,
} from "@pai/contracts";
import { canonicalJsonV1 } from "@pai/eventing";
import { Value } from "@sinclair/typebox/value";

import type {
  TriggerProcessorOwnerDatabaseV1,
  VerifiedTriggerIngressV1,
} from "./trigger-admission.v1.js";

export class TriggerConfirmationResponseErrorV1 extends Error {
  public constructor(
    public readonly code:
      | "confirmation_not_found"
      | "confirmation_principal_mismatch"
      | "confirmation_intent_version_mismatch"
      | "confirmation_response_hash_mismatch"
      | "confirmation_expired"
      | "confirmation_already_decided"
      | "idempotency_conflict"
      | "schema_validation_failed"
      | "owner_contract_drift",
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = "TriggerConfirmationResponseErrorV1";
  }
}

export interface TriggerConfirmationResponseApplicationV1 {
  respond(
    ingress: VerifiedTriggerIngressV1,
    processId: string,
    challengeId: string,
    request: unknown,
  ): Promise<TriggerConfirmationResponseResultV1>;
}

function responseCanonicalSnapshotV1<T>(value: unknown): T {
  try {
    return JSON.parse(canonicalJsonV1(value)) as T;
  } catch (error) {
    throw new TriggerConfirmationResponseErrorV1(
      "schema_validation_failed",
      { cause: error },
    );
  }
}

function confirmationRequestHashV1(
  processId: string,
  challengeId: string,
  request: TriggerConfirmationResponseV1,
): string {
  const { trace_id: _traceId, ...body } = request;
  return sha256V1(canonicalJsonV1({
    schema_version: "trigger_confirmation_request_hash_preimage.v1",
    trigger_process_id: processId,
    challenge_id: challengeId,
    body,
  }));
}

export function createTriggerConfirmationResponseApplicationV1(
  database: TriggerProcessorOwnerDatabaseV1,
): TriggerConfirmationResponseApplicationV1 {
  return Object.freeze({
    async respond(
      ingressValue: VerifiedTriggerIngressV1,
      processId: string,
      challengeId: string,
      requestValue: unknown,
    ): Promise<TriggerConfirmationResponseResultV1> {
      const ingress = responseCanonicalSnapshotV1<VerifiedTriggerIngressV1>(
        ingressValue,
      );
      const request = responseCanonicalSnapshotV1<unknown>(requestValue);
      if (
        ingress.authentication_kind !== "supabase_ingress" ||
        !Value.Check(TriggerConfirmationResponseV1Schema, request) ||
        processId.length < 1 || processId.length > 512 || /[\r\n]/u.test(processId) ||
        challengeId.length < 1 || challengeId.length > 512 || /[\r\n]/u.test(challengeId)
      ) {
        throw new TriggerConfirmationResponseErrorV1(
          "schema_validation_failed",
        );
      }
      const typedRequest = request as TriggerConfirmationResponseV1;
      const principal = ingress.credential.principal;
      if (principal.principal_type === "bot") {
        throw new TriggerConfirmationResponseErrorV1(
          "confirmation_principal_mismatch",
        );
      }
      const requestHash = confirmationRequestHashV1(
        processId,
        challengeId,
        typedRequest,
      );
      const writer = typedRequest.decision === "accept"
        ? "accept_trigger_confirmation_v1"
        : "reject_trigger_confirmation_v1";
      try {
        return await database.unit_of_work.withTransaction(
          {
            operation: writer,
            idempotency_key: typedRequest.idempotency_key,
            trace_id: typedRequest.trace_id,
            isolation: "serializable",
            retry: "serialization_failures",
          },
          async (transaction, { owner }) => {
            const resultValue = await owner.executeWriter<
              TriggerConfirmationResponseResultV1,
              typeof writer
            >(transaction, {
              writer,
              arguments: {
                p_process_id: processId,
                p_challenge_id: challengeId,
                p_principal_type: principal.principal_type,
                p_principal_id: principal.principal_id,
                p_response: typedRequest,
                p_request_hash: requestHash,
                p_trace_id: typedRequest.trace_id,
              },
              expected_rows: 1,
            });
            const result = responseCanonicalSnapshotV1<unknown>(resultValue);
            if (
              !Value.Check(TriggerConfirmationResponseResultV1Schema, result) ||
              result.trigger_process_id !== processId ||
              result.challenge_id !== challengeId ||
              result.decision !== typedRequest.decision ||
              result.request_hash !== requestHash ||
              result.response_hash !== typedRequest.response_hash ||
              result.trace_id !== typedRequest.trace_id
            ) {
              throw new TriggerConfirmationResponseErrorV1(
                "owner_contract_drift",
              );
            }
            return result as TriggerConfirmationResponseResultV1;
          },
        );
      } catch (error) {
        if (error instanceof TriggerConfirmationResponseErrorV1) throw error;
        const message = error instanceof Error ? error.message : "";
        const known = [
          "confirmation_not_found",
          "confirmation_principal_mismatch",
          "confirmation_intent_version_mismatch",
          "confirmation_response_hash_mismatch",
          "confirmation_expired",
          "confirmation_already_decided",
          "idempotency_conflict",
        ] as const;
        const code = known.find((candidate) => message.includes(candidate));
        if (code !== undefined) {
          throw new TriggerConfirmationResponseErrorV1(code, { cause: error });
        }
        throw error;
      }
    },
  });
}

export interface AcceptedTriggerConfirmationReadV1 {
  readonly confirmation_ref: string;
  readonly confirmation_hash: string;
  readonly trigger_process_id: string;
  readonly workspace_id: string;
  readonly bot_id: string;
  readonly owner_agent_id: string;
  readonly deployment_environment: "local" | "dev" | "staging" | "prod";
  readonly release_channel: "stable" | "canary";
  readonly intent_ref: string;
  readonly intent_version: number;
  readonly structured_intent_hash: string;
  readonly policy_input_hash: string;
}

export interface TriggerConfirmationOwnerRowV1
  extends Record<string, unknown> {
  readonly challenge_id: string;
  readonly trigger_process_id: string;
  readonly workspace_id: string;
  readonly bot_id: string;
  readonly owner_agent_id: string;
  readonly deployment_environment: string;
  readonly release_channel: string;
  readonly intent_ref: string;
  readonly intent_version: string | number;
  readonly structured_intent_hash: string;
  readonly policy_input_hash: string;
  readonly action_step_ids: unknown;
  readonly allowed_principal_type: string;
  readonly allowed_principal_id: string;
  readonly status: string;
  readonly expires_at: string;
  readonly request_hash: string | null;
  readonly response_hash: string | null;
  readonly confirmation_hash: string | null;
  readonly stage_execute_work_id: string | null;
  readonly stage_expected_process_state_version: string | number | null;
  readonly idempotency_key: string | null;
  readonly responded_by: string | null;
  readonly responded_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface TriggerConfirmationReadRepositoryV1 {
  findByChallengeId(
    challengeId: string,
    signal: AbortSignal,
  ): Promise<TriggerConfirmationOwnerRowV1 | undefined>;
}

export interface AcceptedTriggerConfirmationVerifierV1 {
  assertAccepted(
    expected: AcceptedTriggerConfirmationReadV1,
    signal: AbortSignal,
  ): Promise<void>;
}

export class AcceptedTriggerConfirmationErrorV1 extends Error {
  public constructor(
    public readonly code:
      | "confirmation_not_found"
      | "confirmation_not_accepted"
      | "confirmation_binding_mismatch"
      | "confirmation_hash_mismatch"
      | "confirmation_expired"
      | "owner_contract_drift",
  ) {
    super(code);
    this.name = "AcceptedTriggerConfirmationErrorV1";
  }
}

function safePositiveIntegerV1(value: string | number): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new AcceptedTriggerConfirmationErrorV1("owner_contract_drift");
  }
  return parsed;
}

function rowSnapshotV1(
  row: TriggerConfirmationOwnerRowV1,
): TriggerConfirmationChallengeV1 {
  let snapshot: TriggerConfirmationOwnerRowV1;
  try {
    snapshot = JSON.parse(canonicalJsonV1(row));
  } catch {
    throw new AcceptedTriggerConfirmationErrorV1("owner_contract_drift");
  }
  return {
    schema_version: "trigger_confirmation_challenge.v1",
    challenge_id: snapshot.challenge_id,
    trigger_process_id: snapshot.trigger_process_id,
    workspace_id: snapshot.workspace_id,
    bot_id: snapshot.bot_id,
    owner_agent_id: snapshot.owner_agent_id,
    deployment_environment:
      snapshot.deployment_environment as TriggerConfirmationChallengeV1["deployment_environment"],
    release_channel:
      snapshot.release_channel as TriggerConfirmationChallengeV1["release_channel"],
    intent_ref: snapshot.intent_ref,
    intent_version: safePositiveIntegerV1(snapshot.intent_version),
    structured_intent_hash:
      snapshot.structured_intent_hash as `sha256:${string}`,
    policy_input_hash: snapshot.policy_input_hash as `sha256:${string}`,
    action_step_ids: snapshot.action_step_ids as string[],
    allowed_principal_type:
      snapshot.allowed_principal_type as TriggerConfirmationChallengeV1["allowed_principal_type"],
    allowed_principal_id: snapshot.allowed_principal_id,
    status: snapshot.status as TriggerConfirmationChallengeV1["status"],
    expires_at: snapshot.expires_at,
    request_hash: snapshot.request_hash as `sha256:${string}` | null,
    response_hash: snapshot.response_hash as `sha256:${string}` | null,
    confirmation_hash:
      snapshot.confirmation_hash as `sha256:${string}` | null,
    stage_execute_work_id: snapshot.stage_execute_work_id,
    idempotency_key: snapshot.idempotency_key,
    responded_by: snapshot.responded_by,
    responded_at: snapshot.responded_at,
    created_at: snapshot.created_at,
    updated_at: snapshot.updated_at,
  };
}

function sha256V1(value: string): string {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

export function createAcceptedTriggerConfirmationVerifierV1(
  repository: TriggerConfirmationReadRepositoryV1,
  options: Readonly<{ now?: () => Date }> = {},
): AcceptedTriggerConfirmationVerifierV1 {
  const now = options.now ?? (() => new Date());
  return Object.freeze({
    async assertAccepted(
      expected: AcceptedTriggerConfirmationReadV1,
      signal: AbortSignal,
    ): Promise<void> {
      if (!/^confirmation:[^\r\n]+$/u.test(expected.confirmation_ref)) {
        throw new AcceptedTriggerConfirmationErrorV1(
          "confirmation_binding_mismatch",
        );
      }
      const challengeId = expected.confirmation_ref.slice(
        "confirmation:".length,
      );
      const row = await repository.findByChallengeId(challengeId, signal);
      if (row === undefined) {
        throw new AcceptedTriggerConfirmationErrorV1(
          "confirmation_not_found",
        );
      }
      const challenge = rowSnapshotV1(row);
      if (!Value.Check(TriggerConfirmationChallengeV1Schema, challenge)) {
        throw new AcceptedTriggerConfirmationErrorV1(
          "owner_contract_drift",
        );
      }
      try {
        assertTriggerConfirmationChallengeSemanticBindingsV1(challenge);
      } catch {
        throw new AcceptedTriggerConfirmationErrorV1(
          "owner_contract_drift",
        );
      }
      if (challenge.status !== "accepted") {
        throw new AcceptedTriggerConfirmationErrorV1(
          "confirmation_not_accepted",
        );
      }
      if (Date.parse(challenge.expires_at) <= now().getTime()) {
        throw new AcceptedTriggerConfirmationErrorV1(
          "confirmation_expired",
        );
      }
      if (
        challenge.trigger_process_id !== expected.trigger_process_id ||
        challenge.workspace_id !== expected.workspace_id ||
        challenge.bot_id !== expected.bot_id ||
        challenge.owner_agent_id !== expected.owner_agent_id ||
        challenge.deployment_environment !==
          expected.deployment_environment ||
        challenge.release_channel !== expected.release_channel ||
        challenge.intent_ref !== expected.intent_ref ||
        challenge.intent_version !== expected.intent_version ||
        challenge.structured_intent_hash !==
          expected.structured_intent_hash ||
        challenge.policy_input_hash !== expected.policy_input_hash
      ) {
        throw new AcceptedTriggerConfirmationErrorV1(
          "confirmation_binding_mismatch",
        );
      }
      if (
        challenge.request_hash === null ||
        challenge.response_hash === null ||
        challenge.confirmation_hash === null ||
        challenge.stage_execute_work_id === null ||
        challenge.responded_at === null ||
        challenge.responded_by !== challenge.allowed_principal_id ||
        row.stage_expected_process_state_version === null
      ) {
        throw new AcceptedTriggerConfirmationErrorV1(
          "owner_contract_drift",
        );
      }
      const proof = {
        schema_version: "trigger_confirmation_proof.v1",
        confirmation_ref: expected.confirmation_ref,
        challenge_id: challenge.challenge_id,
        trigger_process_id: challenge.trigger_process_id,
        intent_ref: challenge.intent_ref,
        intent_version: challenge.intent_version,
        structured_intent_hash: challenge.structured_intent_hash,
        policy_input_hash: challenge.policy_input_hash,
        action_step_ids: challenge.action_step_ids,
        principal_type: challenge.allowed_principal_type,
        principal_id: challenge.allowed_principal_id,
        decision: "accept",
        request_hash: challenge.request_hash,
        response_hash: challenge.response_hash,
        accepted_at: challenge.responded_at,
        process_state_version: safePositiveIntegerV1(
          row.stage_expected_process_state_version,
        ),
        stage_execute_work_id: challenge.stage_execute_work_id,
      } as const;
      if (
        challenge.confirmation_hash !== expected.confirmation_hash ||
        sha256V1(canonicalJsonV1(proof)) !== expected.confirmation_hash
      ) {
        throw new AcceptedTriggerConfirmationErrorV1(
          "confirmation_hash_mismatch",
        );
      }
    },
  });
}
