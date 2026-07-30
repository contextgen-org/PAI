import { createHash } from "node:crypto";

import type { AuthorizationScopeV1, WorkloadCredentialSignerPort } from "@pai/auth";
import {
  RuntimeStartRequestV1Schema,
  RuntimeStartResponseV1Schema,
  TriggerProcessorCommandV1Schema,
  type RuntimeStartRequestV1,
  type RuntimeStartResponseV1,
  type TriggerProcessorCommandV1,
} from "@pai/contracts";
import {
  OwnerCommandTransportErrorV1,
  canonicalJsonV1,
  type OwnerCommandDispatchTransportPortV1,
} from "@pai/eventing";
import {
  InternalClientError,
  isTrustedLocalDockerHttpOriginV1,
  requestInternalJson,
} from "@pai/service-kit";
import { Value } from "@sinclair/typebox/value";

const TRIGGER_COMMAND_OUTBOX_TABLE_V1 = "trigger_command_outbox";
const RUNTIME_START_COMMAND_TYPE_V1 = "runtime.start";

function serviceBaseUrlV1(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("PAI_ACTION_RUNTIME_URL must be an absolute URL");
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
      "PAI_ACTION_RUNTIME_URL must use HTTPS except on loopback and must not contain credentials, query, or fragment",
    );
  }
  return url.toString().replace(/\/$/u, "");
}

function boundedTimeoutV1(value: number | undefined): number {
  const timeout = value ?? 10_000;
  if (!Number.isSafeInteger(timeout) || timeout < 100 || timeout > 300_000) {
    throw new Error("Trigger command request timeout is outside bounds");
  }
  return timeout;
}

function transportTraceIdV1(traceId: string): string {
  const result = createHash("sha256")
    .update(traceId, "utf8")
    .digest("hex")
    .slice(0, 32);
  return /^0+$/u.test(result) ? `1${result.slice(1)}` : result;
}

function commandFromRecordV1(
  record: Readonly<Record<string, unknown>>,
): TriggerProcessorCommandV1 {
  const command = {
    command_id: record.id,
    aggregate_id: record.aggregate_id,
    command_type: record.command_type,
    schema_version: record.schema_version,
    producer: record.producer,
    target: record.target,
    idempotency_key: record.idempotency_key,
    request_hash: record.request_hash,
    trace_id: record.trace_id,
    payload: record.payload,
  };
  // Canonicalization first prevents getters, prototype values, and non-finite
  // values from crossing the durable-command boundary.
  try {
    JSON.parse(canonicalJsonV1(command));
  } catch {
    throw new OwnerCommandTransportErrorV1(
      "command_contract_violation",
      false,
      false,
      "Trigger command is not canonical JSON",
    );
  }
  if (!Value.Check(TriggerProcessorCommandV1Schema, command)) {
    throw new OwnerCommandTransportErrorV1(
      "command_contract_violation",
      false,
      false,
      "Trigger command violates its durable owner contract",
    );
  }
  return command as TriggerProcessorCommandV1;
}

function runtimeStartScopeV1(request: RuntimeStartRequestV1): AuthorizationScopeV1 {
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
        ? "Runtime Start delivery outcome is ambiguous"
        : "Action Runtime rejected the Runtime Start command",
      { cause: error },
    );
  }
  return new OwnerCommandTransportErrorV1(
    "command_delivery_outcome_ambiguous",
    true,
    true,
    "Runtime Start delivery outcome is ambiguous",
    { cause: error },
  );
}

function assertRuntimeStartResponseV1(
  request: RuntimeStartRequestV1,
  response: unknown,
): asserts response is RuntimeStartResponseV1 {
  if (!Value.Check(RuntimeStartResponseV1Schema, response)) {
    throw new OwnerCommandTransportErrorV1(
      "runtime_start_response_invalid",
      true,
      true,
      "Action Runtime returned an invalid Runtime Start response",
    );
  }
  const typed = response as RuntimeStartResponseV1;
  if (
    typed.code !== "runtime_queued" ||
    typed.details.runtime_run_id !== request.runtime_run_id ||
    typed.details.start_attempt_no !== request.start_attempt_no ||
    typed.trace_id !== request.trace_id
  ) {
    throw new OwnerCommandTransportErrorV1(
      "runtime_start_response_mismatch",
      true,
      true,
      "Action Runtime Runtime Start response bindings drifted",
    );
  }
}

export function createTriggerRuntimeCommandTransportV1(
  input: Readonly<{
    action_runtime_url: string;
    signer: WorkloadCredentialSignerPort;
    request_timeout_ms?: number;
    fetch?: typeof fetch;
  }>,
): OwnerCommandDispatchTransportPortV1 {
  const actionRuntimeUrl = serviceBaseUrlV1(input.action_runtime_url);
  const timeoutMs = boundedTimeoutV1(input.request_timeout_ms);
  const fetchImpl = input.fetch ?? fetch;
  const port: OwnerCommandDispatchTransportPortV1 = {
    async dispatch(envelope, signal) {
      if (
        envelope.owner_service !== "trigger_processor" ||
        envelope.outbox_table !== TRIGGER_COMMAND_OUTBOX_TABLE_V1
      ) {
        throw new OwnerCommandTransportErrorV1(
          "command_route_not_supported",
          false,
          false,
          "Trigger command dispatcher received an unsupported command route",
        );
      }
      const command = commandFromRecordV1(envelope.record);
      if (
        command.command_type !== RUNTIME_START_COMMAND_TYPE_V1 ||
        command.target !== "action_runtime"
      ) {
        // Do not silently reinterpret a durable command. Other declared
        // Trigger command routes remain fail-closed until their exact target
        // contract has a production dispatcher.
        throw new OwnerCommandTransportErrorV1(
          "command_route_not_supported",
          false,
          false,
          `Trigger command type is not supported by this dispatcher: ${command.command_type}`,
        );
      }
      const request = command.payload as RuntimeStartRequestV1;
      signal?.throwIfAborted();
      const credential = await input.signer.sign({
        audience: "action_runtime",
        capabilities: ["runtime.start"],
        scope: runtimeStartScopeV1(request),
      });
      signal?.throwIfAborted();
      let response: unknown;
      try {
        response = (
          await requestInternalJson<unknown>({
            url: `${actionRuntimeUrl}/internal/runtime/runs`,
            method: "POST",
            workloadCredential: credential,
            json: request,
            traceId: transportTraceIdV1(request.trace_id),
            timeoutMs,
            idempotent: true,
            maxRetries: 2,
            ...(signal === undefined ? {} : { signal }),
            fetchImpl,
          })
        ).body;
      } catch (error) {
        signal?.throwIfAborted();
        throw classifyRequestErrorV1(error);
      }
      signal?.throwIfAborted();
      assertRuntimeStartResponseV1(request, response);
      return Object.freeze({
        transport_ref: `runtime_start:${response.details.runtime_run_id}:${response.details.start_attempt_no}`,
      });
    },
    async checkReadiness(signal) {
      signal?.throwIfAborted();
      const response = await fetchImpl(`${actionRuntimeUrl}/health`, {
        method: "GET",
        redirect: "error",
        signal:
          signal === undefined
            ? AbortSignal.timeout(timeoutMs)
            : AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
      });
      await response.body?.cancel().catch(() => undefined);
      signal?.throwIfAborted();
      if (!response.ok) throw new Error("Action Runtime is not live");
    },
  };
  return Object.freeze(port);
}
