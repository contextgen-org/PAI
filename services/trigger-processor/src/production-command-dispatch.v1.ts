import { createHash } from "node:crypto";

import type { AuthorizationScopeV1, WorkloadCredentialSignerPort } from "@pai/auth";
import {
  MetaJobCreateRequestV1Schema,
  MetaJobCreateResponseV1Schema,
  RuntimeCancelContractV1Schema,
  RuntimePreemptContractV1Schema,
  RuntimeStartRequestV1Schema,
  RuntimeStartResponseV1Schema,
  type DelegatedPrincipalContextV1,
  type MetaJobCreateRequestV1,
  type MetaJobCreateResponseV1,
  type RuntimeCancelContractV1,
  TriggerProcessorCommandV1Schema,
  type RuntimePreemptContractV1,
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
const RUNTIME_CANCEL_COMMAND_TYPE_V1 = "runtime.cancel";
const RUNTIME_PREEMPT_COMMAND_TYPE_V1 = "runtime.preempt";
const META_JOB_CREATE_COMMAND_TYPE_V1 = "meta.job.create";

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

function metaJobCreateScopeV1(
  request: MetaJobCreateRequestV1,
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

function assertRuntimeControlResponseV1(
  response: unknown,
  control: "Cancel" | "Preempt",
): asserts response is Readonly<{
  accepted: true;
  replayed: boolean;
}> {
  if (
    typeof response !== "object" ||
    response === null ||
    Array.isArray(response) ||
    Object.keys(response).sort().join(",") !== "accepted,replayed" ||
    (response as Readonly<{ accepted?: unknown }>).accepted !== true ||
    typeof (response as Readonly<{ replayed?: unknown }>).replayed !== "boolean"
  ) {
    throw new OwnerCommandTransportErrorV1(
      "runtime_" + control.toLowerCase() + "_response_invalid",
      true,
      true,
      "Action Runtime returned an invalid Runtime " + control + " response",
    );
  }
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

function assertMetaJobCreateResponseV1(
  response: unknown,
): asserts response is MetaJobCreateResponseV1 {
  if (!Value.Check(MetaJobCreateResponseV1Schema, response)) {
    throw new OwnerCommandTransportErrorV1(
      "meta_job_create_response_invalid",
      true,
      true,
      "Meta Cognition returned an invalid Meta Job Create response",
    );
  }
}

export function createTriggerRuntimeCommandTransportV1(
  input: Readonly<{
    action_runtime_url: string;
    meta_cognition_url: string;
    signer: WorkloadCredentialSignerPort;
    runtime_control_scope: (
      request: RuntimePreemptContractV1 | RuntimeCancelContractV1,
      signal: AbortSignal | undefined,
    ) => Promise<AuthorizationScopeV1>;
    /**
     * Reads the ingress-verified principal retained by the Trigger owner.
     * It is signed into the workload credential rather than copied into the
     * durable Runtime Start request body.
     */
    runtime_start_delegated_principal: (
      request: RuntimeStartRequestV1,
      signal: AbortSignal | undefined,
    ) => Promise<DelegatedPrincipalContextV1 | undefined>;
    request_timeout_ms?: number;
    fetch?: typeof fetch;
  }>,
): OwnerCommandDispatchTransportPortV1 {
  const actionRuntimeUrl = serviceBaseUrlV1(input.action_runtime_url);
  const metaCognitionUrl = serviceBaseUrlV1(input.meta_cognition_url);
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
        command.target === "action_runtime" &&
        command.command_type === RUNTIME_CANCEL_COMMAND_TYPE_V1
      ) {
        if (!Value.Check(RuntimeCancelContractV1Schema, command.payload)) {
          throw new OwnerCommandTransportErrorV1(
            "command_contract_violation",
            false,
            false,
            "Runtime Cancel command violates its payload contract",
          );
        }
        const request = command.payload as RuntimeCancelContractV1;
        signal?.throwIfAborted();
        const scope = await input.runtime_control_scope(request, signal);
        signal?.throwIfAborted();
        const credential = await input.signer.sign({
          audience: "action_runtime",
          capabilities: ["runtime.control"],
          scope,
        });
        signal?.throwIfAborted();
        let response: unknown;
        try {
          response = (
            await requestInternalJson<unknown>({
              url:
                actionRuntimeUrl +
                "/internal/runtime/runs/" +
                encodeURIComponent(request.runtime_run_id) +
                "/cancel",
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
        assertRuntimeControlResponseV1(response, "Cancel");
        return Object.freeze({
          transport_ref:
            "runtime_cancel:" +
            request.runtime_run_id +
            ":" +
            request.runtime_signal_id,
        });
      }
      if (
        command.target === "action_runtime" &&
        command.command_type === RUNTIME_START_COMMAND_TYPE_V1
      ) {
        if (!Value.Check(RuntimeStartRequestV1Schema, command.payload)) {
          throw new OwnerCommandTransportErrorV1(
            "command_contract_violation",
            false,
            false,
            "Runtime Start command violates its payload contract",
          );
        }
        const request = command.payload as RuntimeStartRequestV1;
        signal?.throwIfAborted();
        let delegatedPrincipal: DelegatedPrincipalContextV1 | undefined;
        try {
          delegatedPrincipal =
            await input.runtime_start_delegated_principal(request, signal);
        } catch (error) {
          signal?.throwIfAborted();
          throw new OwnerCommandTransportErrorV1(
            "runtime_start_delegation_unavailable",
            true,
            false,
            "Runtime Start delegated principal is unavailable",
            { cause: error },
          );
        }
        signal?.throwIfAborted();
        const credential = await input.signer.sign({
          audience: "action_runtime",
          capabilities: ["runtime.start"],
          scope: runtimeStartScopeV1(request),
          ...(delegatedPrincipal === undefined
            ? {}
            : { delegatedPrincipal }),
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
      }
      if (
        command.target === "action_runtime" &&
        command.command_type === RUNTIME_PREEMPT_COMMAND_TYPE_V1
      ) {
        if (!Value.Check(RuntimePreemptContractV1Schema, command.payload)) {
          throw new OwnerCommandTransportErrorV1(
            "command_contract_violation",
            false,
            false,
            "Runtime Preempt command violates its payload contract",
          );
        }
        const request = command.payload as RuntimePreemptContractV1;
        signal?.throwIfAborted();
        const scope = await input.runtime_control_scope(request, signal);
        signal?.throwIfAborted();
        const credential = await input.signer.sign({
          audience: "action_runtime",
          capabilities: ["runtime.control"],
          scope,
        });
        signal?.throwIfAborted();
        let response: unknown;
        try {
          response = (
            await requestInternalJson<unknown>({
              url: `${actionRuntimeUrl}/internal/runtime/runs/${encodeURIComponent(request.runtime_run_id)}/preempt`,
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
        assertRuntimeControlResponseV1(response, "Preempt");
        return Object.freeze({
          transport_ref: `runtime_preempt:${request.runtime_run_id}:${request.runtime_signal_id}`,
        });
      }
      if (
        command.target === "meta_cognition" &&
        command.command_type === META_JOB_CREATE_COMMAND_TYPE_V1
      ) {
        if (!Value.Check(MetaJobCreateRequestV1Schema, command.payload)) {
          throw new OwnerCommandTransportErrorV1(
            "command_contract_violation",
            false,
            false,
            "Meta Job Create command violates its payload contract",
          );
        }
        const request = command.payload as MetaJobCreateRequestV1;
        signal?.throwIfAborted();
        const credential = await input.signer.sign({
          audience: "meta_cognition",
          capabilities: ["meta.job.create"],
          scope: metaJobCreateScopeV1(request),
        });
        signal?.throwIfAborted();
        let response: unknown;
        try {
          response = (
            await requestInternalJson<unknown>({
              url: `${metaCognitionUrl}/internal/meta/jobs`,
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
        assertMetaJobCreateResponseV1(response);
        return Object.freeze({
          transport_ref: `meta_job:${response.job_id}`,
        });
      }
      {
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
    },
    async checkReadiness(signal) {
      const check = async (url: string, service: string): Promise<void> => {
        signal?.throwIfAborted();
        const response = await fetchImpl(`${url}/health`, {
          method: "GET",
          redirect: "error",
          signal:
            signal === undefined
              ? AbortSignal.timeout(timeoutMs)
              : AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
        });
        await response.body?.cancel().catch(() => undefined);
        signal?.throwIfAborted();
        if (!response.ok) throw new Error(`${service} is not live`);
      };
      await check(actionRuntimeUrl, "Action Runtime");
      await check(metaCognitionUrl, "Meta Cognition");
    },
  };
  return Object.freeze(port);
}
