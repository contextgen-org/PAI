import { createHash, createPrivateKey } from "node:crypto";

import {
  WorkloadJwtSigner,
  normalizePrivateKeyPemEnvironmentValueV1,
  type AuthorizationScopeV1,
  type WorkloadCredentialSignerPort,
} from "@pai/auth";
import {
  canonicalJsonV1,
  MetaFeedbackRequestSuggestionRequestV1Schema,
  MetaFeedbackRequestSuggestionResponseV1Schema,
  type MetaFeedbackRequestSuggestionRequestV1,
  type MetaFeedbackRequestSuggestionResponseV1,
} from "@pai/contracts";
import {
  OwnerCommandTransportErrorV1,
  type OwnerCommandDispatchTransportPortV1,
} from "@pai/eventing";
import {
  InternalClientError,
  isTrustedLocalDockerHttpOriginV1,
  requestInternalJson,
} from "@pai/service-kit";
import { Value } from "@sinclair/typebox/value";

const MEMORY_FEEDBACK_COMMAND_TABLE_V1 = "memory_command_outbox";
const MEMORY_FEEDBACK_COMMAND_CONTRACT_V1 =
  "MetaFeedbackRequestSuggestionContractV1";
const META_FEEDBACK_SUGGESTION_CAPABILITY_V1 =
  "meta.feedback_request_suggestion.create";

function serviceBaseUrlV1(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("PAI_META_COGNITION_URL must be an absolute URL");
  }
  const loopback =
    url.hostname === "127.0.0.1" ||
    url.hostname === "[::1]" ||
    url.hostname === "localhost";
  if (
    (url.protocol !== "https:" &&
      !(url.protocol === "http:" &&
        (loopback || isTrustedLocalDockerHttpOriginV1(url)))) ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.search.length > 0 ||
    url.hash.length > 0
  ) {
    throw new Error(
      "PAI_META_COGNITION_URL must use HTTPS except on loopback and must not contain credentials, query, or fragment",
    );
  }
  return url.toString().replace(/\/$/u, "");
}

function boundedTimeoutV1(value: number | undefined): number {
  const timeout = value ?? 10_000;
  if (!Number.isSafeInteger(timeout) || timeout < 100 || timeout > 300_000) {
    throw new Error("Memory Meta command request timeout is outside bounds");
  }
  return timeout;
}

function sha256V1(value: unknown): string {
  return `sha256:${createHash("sha256")
    .update(canonicalJsonV1(value), "utf8")
    .digest("hex")}`;
}

function transportTraceIdV1(traceId: string): string {
  const result = createHash("sha256").update(traceId, "utf8").digest("hex").slice(0, 32);
  return /^0+$/u.test(result) ? `1${result.slice(1)}` : result;
}

function commandRequestV1(
  record: Readonly<Record<string, unknown>>,
): MetaFeedbackRequestSuggestionRequestV1 {
  const requestPayload = record.request_payload;
  canonicalJsonV1(requestPayload);
  if (
    !Value.Check(
      MetaFeedbackRequestSuggestionRequestV1Schema,
      requestPayload,
    )
  ) {
    throw new OwnerCommandTransportErrorV1(
      "command_contract_violation",
      false,
      false,
      "Memory feedback suggestion command violates its owner contract",
    );
  }
  const request =
    requestPayload as MetaFeedbackRequestSuggestionRequestV1;
  const { request_hash: requestHash, ...requestWithoutHash } = request;
  const rowDedupeScope = record.dedupe_scope_ref;
  if (
    record.contract_name !== MEMORY_FEEDBACK_COMMAND_CONTRACT_V1 ||
    record.source_service !== "memory_service" ||
    record.source_ref !== request.source_ref ||
    record.command_id !== request.command_id ||
    record.workspace_id !== request.workspace_id ||
    record.bot_id !== request.bot_id ||
    record.owner_agent_id !== request.owner_agent_id ||
    record.deployment_environment !== request.deployment_environment ||
    record.release_channel !== request.release_channel ||
    rowDedupeScope !== request.dedupe_scope_ref.ref ||
    record.request_hash !== requestHash ||
    record.trace_id !== request.trace_id ||
    request.source_service !== "memory_service" ||
    requestHash !== sha256V1(requestWithoutHash)
  ) {
    throw new OwnerCommandTransportErrorV1(
      "command_contract_binding_mismatch",
      false,
      false,
      "Memory feedback suggestion command bindings drifted",
    );
  }
  return request;
}

function authorizationScopeV1(
  request: MetaFeedbackRequestSuggestionRequestV1,
): AuthorizationScopeV1 {
  return Object.freeze({
    scope_kind: "bot" as const,
    workspace_id: request.workspace_id,
    bot_id: request.bot_id,
    owner_agent_id: request.owner_agent_id,
    deployment_environment: request.deployment_environment,
    release_channel: request.release_channel,
  });
}

function classifyRequestErrorV1(error: unknown): OwnerCommandTransportErrorV1 {
  if (error instanceof OwnerCommandTransportErrorV1) return error;
  if (error instanceof InternalClientError) {
    const outcomeAmbiguous = error.status === undefined;
    return new OwnerCommandTransportErrorV1(
      error.code,
      outcomeAmbiguous || error.retryable,
      outcomeAmbiguous,
      outcomeAmbiguous
        ? "Meta command delivery outcome is ambiguous"
        : "Meta rejected the feedback suggestion command",
      { cause: error },
    );
  }
  return new OwnerCommandTransportErrorV1(
    "command_delivery_outcome_ambiguous",
    true,
    true,
    "Meta command delivery outcome is ambiguous",
    { cause: error },
  );
}

export function createMemoryWorkloadSignerFromEnvV1(
  env: NodeJS.ProcessEnv,
): WorkloadCredentialSignerPort {
  const pem = env.PAI_WORKLOAD_SIGNING_PRIVATE_KEY_PEM;
  const keyId = env.PAI_WORKLOAD_SIGNING_KEY_ID;
  const algorithm = env.PAI_WORKLOAD_SIGNING_ALGORITHM;
  if (pem === undefined || keyId === undefined || algorithm === undefined) {
    throw new Error(
      "PAI_WORKLOAD_SIGNING_PRIVATE_KEY_PEM, PAI_WORKLOAD_SIGNING_KEY_ID, and PAI_WORKLOAD_SIGNING_ALGORITHM are required",
    );
  }
  if (algorithm !== "EdDSA" && algorithm !== "ES256" && algorithm !== "RS256") {
    throw new Error(
      "PAI_WORKLOAD_SIGNING_ALGORITHM must be EdDSA, ES256, or RS256",
    );
  }
  return new WorkloadJwtSigner({
    subject: "memory",
    privateKey: createPrivateKey(normalizePrivateKeyPemEnvironmentValueV1(pem)),
    keyId,
    algorithm,
  });
}

export function createMemoryMetaCommandTransportV1(
  input: Readonly<{
    meta_cognition_url: string;
    signer: WorkloadCredentialSignerPort;
    request_timeout_ms?: number;
    fetch?: typeof fetch;
  }>,
): OwnerCommandDispatchTransportPortV1 {
  const metaUrl = serviceBaseUrlV1(input.meta_cognition_url);
  const timeoutMs = boundedTimeoutV1(input.request_timeout_ms);
  const fetchImpl = input.fetch ?? fetch;
  const port: OwnerCommandDispatchTransportPortV1 = {
    async dispatch(envelope, signal) {
      if (
        envelope.owner_service !== "memory" ||
        envelope.outbox_table !== MEMORY_FEEDBACK_COMMAND_TABLE_V1
      ) {
        throw new OwnerCommandTransportErrorV1(
          "command_route_not_supported",
          false,
          false,
          "Memory command dispatcher received an unsupported command route",
        );
      }
      const request = commandRequestV1(envelope.record);
      signal?.throwIfAborted();
      const credential = await input.signer.sign({
        audience: "meta_cognition",
        capabilities: [META_FEEDBACK_SUGGESTION_CAPABILITY_V1],
        scope: authorizationScopeV1(request),
      });
      signal?.throwIfAborted();
      let response: MetaFeedbackRequestSuggestionResponseV1;
      try {
        const result =
          await requestInternalJson<MetaFeedbackRequestSuggestionResponseV1>({
            url: `${metaUrl}/internal/meta/feedback-request-suggestions`,
            method: "POST",
            workloadCredential: credential,
            json: request,
            traceId: transportTraceIdV1(request.trace_id),
            timeoutMs,
            idempotent: true,
            maxRetries: 2,
            ...(signal === undefined ? {} : { signal }),
            fetchImpl,
          });
        response = result.body;
      } catch (error) {
        signal?.throwIfAborted();
        throw classifyRequestErrorV1(error);
      }
      signal?.throwIfAborted();
      canonicalJsonV1(response);
      if (
        !Value.Check(
          MetaFeedbackRequestSuggestionResponseV1Schema,
          response,
        )
      ) {
        throw new OwnerCommandTransportErrorV1(
          "meta_feedback_suggestion_response_invalid",
          true,
          true,
          "Meta returned an invalid feedback suggestion response",
        );
      }
      if (response.status === "conflict") {
        throw new OwnerCommandTransportErrorV1(
          response.code,
          false,
          false,
          "Meta rejected the feedback suggestion command",
        );
      }
      if (
        response.command_id !== request.command_id ||
        response.request_hash !== request.request_hash
      ) {
        throw new OwnerCommandTransportErrorV1(
          "meta_feedback_suggestion_response_mismatch",
          true,
          true,
          "Meta feedback suggestion response bindings drifted",
        );
      }
      return Object.freeze({
        transport_ref: `meta_feedback_request:${response.feedback_request_id}`,
      });
    },
    async checkReadiness(signal) {
      signal?.throwIfAborted();
      const response = await fetchImpl(`${metaUrl}/health`, {
        method: "GET",
        redirect: "error",
        signal:
          signal === undefined
            ? AbortSignal.timeout(timeoutMs)
            : AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
      });
      await response.body?.cancel().catch(() => undefined);
      signal?.throwIfAborted();
      if (!response.ok) throw new Error("Meta Cognition is not live");
    },
  };
  return Object.freeze(port);
}

export function createMemoryMetaCommandTransportFromEnvV1(
  env: NodeJS.ProcessEnv,
): OwnerCommandDispatchTransportPortV1 {
  return createMemoryMetaCommandTransportV1({
    meta_cognition_url:
      env.PAI_META_COGNITION_URL ??
      (() => {
        throw new Error("PAI_META_COGNITION_URL is required");
      })(),
    signer: createMemoryWorkloadSignerFromEnvV1(env),
  });
}
