import {
  MetaFeedbackRequestSuggestionRequestV1Schema,
  MetaFeedbackRequestSuggestionResponseV1Schema,
  type MetaFeedbackRequestSuggestionRequestV1,
  type MetaFeedbackRequestSuggestionResponseV1,
} from "@pai/contracts";
import type {
  OwnerDatabaseApplicationDependenciesV1,
} from "@pai/persistence";
import { Value } from "@sinclair/typebox/value";

import {
  META_COGNITION_REPOSITORY_CONTRACT_V1,
} from "./db/permission-manifest.v1.js";
import {
  assertBoundedMetaJsonV1,
  sha256CanonicalV1,
  snapshotCanonicalJsonV1,
} from "./canonical.v1.js";
import type { MetaBotScopeV1 } from "./meta-types.v1.js";

type MetaFeedbackSuggestionDependenciesV1 =
  OwnerDatabaseApplicationDependenciesV1<
    typeof META_COGNITION_REPOSITORY_CONTRACT_V1
  >;

export interface MetaFeedbackSuggestionPrincipalV1 {
  readonly caller: "memory" | "timer_trigger_app";
  readonly capabilities: readonly string[];
  readonly scope: MetaBotScopeV1;
}

export interface MetaFeedbackSuggestionApplicationV1 {
  suggest(
    principal: MetaFeedbackSuggestionPrincipalV1,
    value: unknown,
  ): Promise<MetaFeedbackRequestSuggestionResponseV1>;
}

export class MetaFeedbackSuggestionErrorV1 extends Error {
  public constructor(
    public readonly code:
      | "invalid_request"
      | "authorization_scope_mismatch"
      | "owner_contract_drift",
    message: string = code,
    public readonly retryable = code === "owner_contract_drift",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "MetaFeedbackSuggestionErrorV1";
  }
}

function failV1(
  code: MetaFeedbackSuggestionErrorV1["code"],
  message: string,
  options?: ErrorOptions,
): never {
  throw new MetaFeedbackSuggestionErrorV1(
    code,
    message,
    code === "owner_contract_drift",
    options,
  );
}

function sameScopeV1(
  left: MetaBotScopeV1,
  right: MetaFeedbackRequestSuggestionRequestV1,
): boolean {
  return (
    left.workspace_id === right.workspace_id &&
    left.bot_id === right.bot_id &&
    left.owner_agent_id === right.owner_agent_id &&
    left.deployment_environment === right.deployment_environment &&
    left.release_channel === right.release_channel
  );
}

function stableFeedbackRequestIdV1(
  request: MetaFeedbackRequestSuggestionRequestV1,
): string {
  return `meta_feedback_${sha256CanonicalV1({
    source_service: request.source_service,
    command_id: request.command_id,
  }).slice("sha256:".length, "sha256:".length + 32)}`;
}

export function createPostgresMetaFeedbackSuggestionApplicationV1(
  dependencies: MetaFeedbackSuggestionDependenciesV1,
): MetaFeedbackSuggestionApplicationV1 {
  const application: MetaFeedbackSuggestionApplicationV1 = {
    async suggest(principal, value) {
      let request: MetaFeedbackRequestSuggestionRequestV1;
      try {
        assertBoundedMetaJsonV1(value);
        if (
          !Value.Check(
            MetaFeedbackRequestSuggestionRequestV1Schema,
            value,
          )
        ) {
          failV1(
            "invalid_request",
            "feedback suggestion violates its owner contract",
          );
        }
        request = snapshotCanonicalJsonV1(
          value,
        ) as MetaFeedbackRequestSuggestionRequestV1;
      } catch (error) {
        if (error instanceof MetaFeedbackSuggestionErrorV1) throw error;
        failV1(
          "invalid_request",
          "feedback suggestion violates the bounded canonical JSON contract",
          { cause: error },
        );
      }
      const expectedCaller =
        request.source_service === "memory_service"
          ? "memory"
          : "timer_trigger_app";
      if (
        principal.caller !== expectedCaller ||
        !principal.capabilities.includes(
          "meta.feedback_request_suggestion.create",
        ) ||
        !sameScopeV1(principal.scope, request)
      ) {
        failV1(
          "authorization_scope_mismatch",
          "feedback suggestion is outside authenticated authority",
        );
      }
      const { request_hash: requestHash, ...requestWithoutHash } = request;
      if (requestHash !== sha256CanonicalV1(requestWithoutHash)) {
        failV1(
          "invalid_request",
          "feedback suggestion request hash drifted",
        );
      }
      const feedbackRequestId = stableFeedbackRequestIdV1(request);
      const idempotencyKey =
        `service_command:${request.source_service}:${request.command_id}`;
      const feedbackRequest = {
        workspace_id: request.workspace_id,
        bot_id: request.bot_id,
        owner_agent_id: request.owner_agent_id,
        deployment_environment: request.deployment_environment,
        release_channel: request.release_channel,
        source_ref: request.source_ref,
        ...(request.dedupe_scope_ref.kind === "conflict"
          ? {
              conflict_id: request.dedupe_scope_ref.ref.slice(
                "conflict:".length,
              ),
            }
          : request.dedupe_scope_ref.kind === "candidate"
            ? {
                candidate_id: request.dedupe_scope_ref.ref.slice(
                  "candidate:".length,
                ),
              }
            : {}),
        question_payload: {
          question_ref: request.question_ref,
          source_ref: request.source_ref,
          trace_id: request.trace_id,
        },
        question_payload_hash: request.question_hash,
        target_actor_ref: request.owner_agent_id,
      };
      let response: unknown;
      try {
        response = await dependencies.unit_of_work.withTransaction(
          {
            operation: "meta_feedback_request_suggestion",
            idempotency_key: idempotencyKey,
            trace_id: request.trace_id,
            isolation: "read_committed",
            retry: "none",
          },
          async (transaction, { owner }) =>
            owner.executeWriter(transaction, {
              writer: "create_service_feedback_request_v1",
              arguments: {
                p_feedback_request_id: feedbackRequestId,
                p_source_service: request.source_service,
                p_command_id: request.command_id,
                p_request_hash: request.request_hash,
                p_bot_id: request.bot_id,
                p_dedupe_scope_ref: request.dedupe_scope_ref.ref,
                p_question_key: request.question_key,
                p_idempotency_key: idempotencyKey,
                p_feedback_request: feedbackRequest,
              },
              expected_rows: 1,
            }),
        );
      } catch (error) {
        failV1(
          "owner_contract_drift",
          "Meta feedback suggestion owner writer failed",
          { cause: error },
        );
      }
      try {
        assertBoundedMetaJsonV1(response);
        if (
          !Value.Check(
            MetaFeedbackRequestSuggestionResponseV1Schema,
            response,
          )
        ) {
          throw new Error("invalid feedback suggestion writer result");
        }
        const stable = snapshotCanonicalJsonV1(
          response,
        ) as MetaFeedbackRequestSuggestionResponseV1;
        if (
          stable.status !== "conflict" &&
          (stable.command_id !== request.command_id ||
            stable.request_hash !== request.request_hash)
        ) {
          throw new Error("feedback suggestion writer response drift");
        }
        return stable;
      } catch (error) {
        failV1(
          "owner_contract_drift",
          "Meta feedback suggestion owner response drifted",
          { cause: error },
        );
      }
    },
  };
  return Object.freeze(application);
}
