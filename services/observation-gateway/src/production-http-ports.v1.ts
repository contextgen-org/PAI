import { createPrivateKey } from "node:crypto";

import {
  WorkloadJwtSigner,
  normalizePrivateKeyPemEnvironmentValueV1,
  type AuthorizationScopeV1,
  type WorkloadCredentialSignerPort,
} from "@pai/auth";
import {
  ContextSnapshotReadContractV1Schema,
  TriggerProcessGetResponseV1Schema,
  TriggerProcessSnapshotReadContractV1Schema,
  type DelegatedPrincipalContextV1,
} from "@pai/contracts";
import {
  InternalClientError,
  isTrustedLocalDockerHttpOriginV1,
  requestInternalJson,
  requestWorkloadJson,
} from "@pai/service-kit";
import { Value } from "@sinclair/typebox/value";

import {
  ObservationUpstreamErrorV1,
  type ObservationMetaPortV1,
  type ObservationRuntimePortV1,
  type ObservationScopeV1,
  type ObservationTriggerProcessorOwnerReadPortV1,
  type ObservationTriggerProcessorPortV1,
  type ObservationUpstreamV1,
} from "./observation-application.v1.js";

const MAX_SSE_FRAME_CHARS = 1_048_576;

function baseUrlV1(raw: string, label: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${label} must be an absolute URL`);
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
      `${label} must use HTTPS except on loopback and must not contain credentials, query, or fragment`,
    );
  }
  return url.toString().replace(/\/$/u, "");
}

function botScopeV1(scope: ObservationScopeV1): AuthorizationScopeV1 {
  return Object.freeze({ scope_kind: "bot" as const, ...scope });
}

function upstreamErrorV1(
  upstream: ObservationUpstreamV1,
  error: unknown,
): ObservationUpstreamErrorV1 {
  if (error instanceof ObservationUpstreamErrorV1) return error;
  if (error instanceof InternalClientError) {
    const code =
      error.code === "upstream_timeout"
        ? "timeout"
        : error.status === 401 || error.status === 403
          ? "permission_denied"
          : error.status === 404
            ? "not_found"
            : error.status === 409 && error.code === "cursor_ahead"
              ? "cursor_ahead"
              : error.status === 410
                ? "replay_expired"
                : error.status === 429
                  ? "rate_limited"
                  : "unavailable";
    return new ObservationUpstreamErrorV1(
      upstream,
      code,
      `${upstream} request failed`,
    );
  }
  return new ObservationUpstreamErrorV1(
    upstream,
    "unavailable",
    `${upstream} request failed`,
  );
}

function envelopeDetailsV1(
  body: unknown,
  expectedCode: string,
  expectedTraceId: string,
  upstream: ObservationUpstreamV1,
): unknown {
  if (
    typeof body !== "object" ||
    body === null ||
    !("code" in body) ||
    body.code !== expectedCode ||
    !("trace_id" in body) ||
    body.trace_id !== expectedTraceId ||
    !("details" in body)
  ) {
    throw new ObservationUpstreamErrorV1(
      upstream,
      "schema_mismatch",
      `${upstream} response envelope is invalid`,
    );
  }
  return body.details;
}

async function checkLiveV1(
  url: string,
  timeoutMs: number,
  fetchImpl: typeof fetch,
): Promise<void> {
  const response = await fetchImpl(`${url}/health`, {
    method: "GET",
    redirect: "error",
    signal: AbortSignal.timeout(timeoutMs),
  });
  await response.body?.cancel().catch(() => undefined);
  if (!response.ok) throw new Error("Observation upstream is not live");
}

function sseBoundaryV1(buffer: string): Readonly<{
  index: number;
  length: number;
}> | undefined {
  const lf = buffer.indexOf("\n\n");
  const crlf = buffer.indexOf("\r\n\r\n");
  if (lf === -1 && crlf === -1) return undefined;
  if (crlf !== -1 && (lf === -1 || crlf < lf)) {
    return { index: crlf, length: 4 };
  }
  return { index: lf, length: 2 };
}

function parseSseFrameV1(
  raw: string,
  expectedEvent: "trigger_process_event" | "runtime_token",
  upstream: ObservationUpstreamV1,
): Readonly<{ kind: "heartbeat" }> | Readonly<{ kind: "event"; event: unknown }> {
  const data: string[] = [];
  let eventName: string | undefined;
  let heartbeat = false;
  let idSeen = false;
  for (const line of raw.split(/\r?\n/u)) {
    if (line.startsWith(":")) {
      heartbeat ||= line === ":heartbeat";
      continue;
    }
    const separator = line.indexOf(":");
    const field = separator === -1 ? line : line.slice(0, separator);
    const rawValue = separator === -1 ? "" : line.slice(separator + 1);
    const value = rawValue.startsWith(" ") ? rawValue.slice(1) : rawValue;
    if (field === "event") eventName = value;
    else if (field === "data") data.push(value);
    else if (field === "id") idSeen = true;
  }
  if (data.length === 0 && heartbeat) return Object.freeze({ kind: "heartbeat" });
  if (
    data.length === 0 ||
    eventName !== expectedEvent ||
    (expectedEvent === "runtime_token" && idSeen)
  ) {
    throw new ObservationUpstreamErrorV1(
      upstream,
      "schema_mismatch",
      `${upstream} returned an invalid SSE frame`,
    );
  }
  try {
    return Object.freeze({
      kind: "event" as const,
      event: JSON.parse(data.join("\n")) as unknown,
    });
  } catch {
    throw new ObservationUpstreamErrorV1(
      upstream,
      "schema_mismatch",
      `${upstream} returned invalid SSE JSON`,
    );
  }
}

async function* streamSseV1(input: Readonly<{
  url: string;
  credential: string;
  trace_id: string;
  signal: AbortSignal;
  timeout_ms: number;
  fetch: typeof fetch;
  upstream: ObservationUpstreamV1;
  expected_event: "trigger_process_event" | "runtime_token";
  last_event_id?: string;
}>): AsyncGenerator<
  Readonly<{ kind: "heartbeat" }> | Readonly<{ kind: "event"; event: unknown }>
> {
  input.signal.throwIfAborted();
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort(input.signal.reason);
  input.signal.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort(new Error("observation_upstream_connect_timeout"));
  }, input.timeout_ms);
  timeout.unref();
  let response: Response;
  try {
    response = await input.fetch(input.url, {
      method: "GET",
      redirect: "manual",
      headers: {
        accept: "text/event-stream",
        authorization: `Bearer ${input.credential}`,
        "x-trace-id": input.trace_id,
        ...(input.last_event_id === undefined
          ? {}
          : { "last-event-id": input.last_event_id }),
      },
      signal: controller.signal,
    });
  } catch (error) {
    throw new ObservationUpstreamErrorV1(
      input.upstream,
      timedOut ? "timeout" : "unavailable",
      `${input.upstream} SSE connection failed`,
    );
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok || response.body === null) {
    await response.body?.cancel().catch(() => undefined);
    const code =
      response.status === 401 || response.status === 403
        ? "permission_denied"
        : response.status === 404
          ? "not_found"
          : response.status === 409
            ? "cursor_ahead"
            : response.status === 410
              ? "replay_expired"
              : response.status === 429
                ? "rate_limited"
                : "unavailable";
    throw new ObservationUpstreamErrorV1(
      input.upstream,
      code,
      `${input.upstream} rejected the SSE request`,
    );
  }
  if (!response.headers.get("content-type")?.startsWith("text/event-stream")) {
    await response.body.cancel().catch(() => undefined);
    throw new ObservationUpstreamErrorV1(
      input.upstream,
      "schema_mismatch",
      `${input.upstream} returned a non-SSE response`,
    );
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let buffer = "";
  try {
    while (true) {
      input.signal.throwIfAborted();
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      if (buffer.length > MAX_SSE_FRAME_CHARS) {
        throw new ObservationUpstreamErrorV1(
          input.upstream,
          "schema_mismatch",
          `${input.upstream} SSE frame exceeded its bound`,
        );
      }
      let boundary = sseBoundaryV1(buffer);
      while (boundary !== undefined) {
        const raw = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary.length);
        if (raw.length > 0) {
          yield parseSseFrameV1(raw, input.expected_event, input.upstream);
        }
        boundary = sseBoundaryV1(buffer);
      }
    }
    buffer += decoder.decode();
    if (buffer.length !== 0) {
      throw new ObservationUpstreamErrorV1(
        input.upstream,
        "schema_mismatch",
        `${input.upstream} ended with an incomplete SSE frame`,
      );
    }
  } catch (error) {
    if (error instanceof ObservationUpstreamErrorV1 || input.signal.aborted) {
      throw error;
    }
    throw new ObservationUpstreamErrorV1(
      input.upstream,
      "schema_mismatch",
      `${input.upstream} SSE stream is invalid`,
    );
  } finally {
    input.signal.removeEventListener("abort", abort);
    controller.abort();
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export function createObservationWorkloadSignerFromEnvV1(
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
    throw new Error("PAI_WORKLOAD_SIGNING_ALGORITHM is invalid");
  }
  return new WorkloadJwtSigner({
    subject: "observation_gateway",
    privateKey: createPrivateKey(normalizePrivateKeyPemEnvironmentValueV1(pem)),
    keyId,
    algorithm,
  });
}

export interface ObservationProductionHttpPortsV1 {
  readonly trigger_processor: ObservationTriggerProcessorPortV1;
  readonly owner_reads: ObservationTriggerProcessorOwnerReadPortV1;
  readonly runtime: ObservationRuntimePortV1;
  readonly meta: ObservationMetaPortV1;
}

export function createObservationProductionHttpPortsV1(input: Readonly<{
  trigger_processor_url: string;
  action_runtime_url: string;
  meta_cognition_url: string;
  signer: WorkloadCredentialSignerPort;
  request_timeout_ms?: number;
  fetch?: typeof fetch;
}>): ObservationProductionHttpPortsV1 {
  const triggerProcessorUrl = baseUrlV1(input.trigger_processor_url, "Trigger Processor URL");
  const actionRuntimeUrl = baseUrlV1(input.action_runtime_url, "Action Runtime URL");
  const metaCognitionUrl = baseUrlV1(input.meta_cognition_url, "Meta Cognition URL");
  const timeoutMs = input.request_timeout_ms ?? 10_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 300_000) {
    throw new Error("Observation request timeout is outside bounds");
  }
  const fetchImpl = input.fetch ?? fetch;
  const sign = async (
    audience: "trigger_processor" | "action_runtime" | "meta_cognition",
    capabilities: readonly string[],
    scope: ObservationScopeV1,
    delegatedPrincipal: DelegatedPrincipalContextV1 | undefined,
  ) => input.signer.sign({
    audience,
    capabilities,
    scope: botScopeV1(scope),
    ...(delegatedPrincipal === undefined ? {} : { delegatedPrincipal }),
  });

  const triggerProcessor: ObservationTriggerProcessorPortV1 = {
    checkReadiness: () => checkLiveV1(triggerProcessorUrl, timeoutMs, fetchImpl),
    async getProcess(request, signal) {
      try {
        const credential = await sign(
          "trigger_processor",
          request.workload.capabilities,
          request.scope,
          request.delegated_principal,
        );
        const response = await requestWorkloadJson<unknown>({
          url: `${triggerProcessorUrl}/v1/trigger-processes/${encodeURIComponent(request.trigger_process_id)}`,
          workloadCredential: credential,
          timeoutMs,
          idempotent: true,
          maxRetries: 2,
          traceId: request.trace_id,
          ...(signal === undefined ? {} : { signal }),
          fetchImpl,
        });
        if (
          !Value.Check(TriggerProcessGetResponseV1Schema, response.body) ||
          response.body.trace_id !== request.trace_id ||
          response.body.details.id !== request.trigger_process_id
        ) {
          throw new ObservationUpstreamErrorV1(
            "trigger_processor",
            "schema_mismatch",
            "Trigger Processor process response is invalid",
          );
        }
        return response.body.details;
      } catch (error) {
        throw upstreamErrorV1("trigger_processor", error);
      }
    },
    streamProcessEvents(request, signal) {
      const iterator = async function* () {
        const credential = await sign(
          "trigger_processor",
          [request.workload.capability],
          request.scope,
          request.delegated_principal,
        );
        const url = new URL(
          `${triggerProcessorUrl}/v1/trigger-processes/${encodeURIComponent(request.trigger_process_id)}/events`,
        );
        if (request.start_after_append_sequence_no !== undefined) {
          url.searchParams.set(
            "start_after_append_sequence_no",
            String(request.start_after_append_sequence_no),
          );
        }
        yield* streamSseV1({
          url: url.toString(),
          credential,
          trace_id: request.trace_id,
          signal,
          timeout_ms: timeoutMs,
          fetch: fetchImpl,
          upstream: "trigger_processor",
          expected_event: "trigger_process_event",
          ...(request.last_event_id === undefined
            ? {}
            : { last_event_id: request.last_event_id }),
        });
      };
      return iterator();
    },
  };

  const ownerReads: ObservationTriggerProcessorOwnerReadPortV1 = {
    checkReadiness: () => checkLiveV1(triggerProcessorUrl, timeoutMs, fetchImpl),
    async resolveProcessSnapshot(request, signal) {
      try {
        const credential = await sign(
          "trigger_processor",
          [request.workload.capability],
          {
            workspace_id: request.request.workspace_id,
            bot_id: request.request.bot_id,
            owner_agent_id: request.request.owner_agent_id,
            deployment_environment: request.request.deployment_environment,
            release_channel: request.request.release_channel,
          },
          request.delegated_principal,
        );
        const response = await requestInternalJson<unknown>({
          url: `${triggerProcessorUrl}/internal/trigger-process-snapshots:resolve`,
          method: "POST",
          workloadCredential: credential,
          json: request.request,
          timeoutMs,
          idempotent: true,
          maxRetries: 2,
          signal,
          fetchImpl,
        });
        if (!Value.Check(TriggerProcessSnapshotReadContractV1Schema, response.body)) {
          throw new ObservationUpstreamErrorV1("trigger_processor", "schema_mismatch", "Process snapshot response is invalid");
        }
        return response.body;
      } catch (error) {
        throw upstreamErrorV1("trigger_processor", error);
      }
    },
    async resolveContextSnapshot(request, signal) {
      try {
        const credential = await sign(
          "trigger_processor",
          [request.workload.capability],
          {
            workspace_id: request.request.workspace_id,
            bot_id: request.request.bot_id,
            owner_agent_id: request.request.owner_agent_id,
            deployment_environment: request.request.deployment_environment,
            release_channel: request.request.release_channel,
          },
          request.delegated_principal,
        );
        const response = await requestInternalJson<unknown>({
          url: `${triggerProcessorUrl}/internal/context-snapshots:resolve`,
          method: "POST",
          workloadCredential: credential,
          json: request.request,
          timeoutMs,
          idempotent: true,
          maxRetries: 2,
          signal,
          fetchImpl,
        });
        if (!Value.Check(ContextSnapshotReadContractV1Schema, response.body)) {
          throw new ObservationUpstreamErrorV1("trigger_processor", "schema_mismatch", "Context snapshot response is invalid");
        }
        return response.body;
      } catch (error) {
        throw upstreamErrorV1("trigger_processor", error);
      }
    },
  };

  const runtime: ObservationRuntimePortV1 = {
    checkReadiness: () => checkLiveV1(actionRuntimeUrl, timeoutMs, fetchImpl),
    async getRun(request, signal) {
      try {
        const credential = await sign("action_runtime", [request.workload.capability], request.scope, request.delegated_principal);
        const response = await requestWorkloadJson<unknown>({
          url: `${actionRuntimeUrl}/v1/runtime-runs/${encodeURIComponent(request.runtime_run_id)}`,
          workloadCredential: credential,
          timeoutMs,
          idempotent: true,
          maxRetries: 2,
          traceId: request.trace_id,
          ...(signal === undefined ? {} : { signal }),
          fetchImpl,
        });
        return envelopeDetailsV1(response.body, "runtime_run_found", request.trace_id, "action_runtime");
      } catch (error) {
        throw upstreamErrorV1("action_runtime", error);
      }
    },
    async listToolInvocations(request) {
      try {
        const credential = await sign("action_runtime", [request.workload.capability], request.scope, request.delegated_principal);
        const url = new URL(`${actionRuntimeUrl}/v1/runtime-runs/${encodeURIComponent(request.runtime_run_id)}/tool-invocations`);
        url.searchParams.set("limit", String(request.limit));
        if (request.cursor !== undefined) url.searchParams.set("cursor", request.cursor);
        if (request.status !== undefined) url.searchParams.set("status", request.status);
        const response = await requestWorkloadJson<unknown>({
          url: url.toString(), workloadCredential: credential, timeoutMs, idempotent: true, maxRetries: 2,
          traceId: request.trace_id, fetchImpl,
        });
        return envelopeDetailsV1(response.body, "tool_invocations_found", request.trace_id, "action_runtime");
      } catch (error) {
        throw upstreamErrorV1("action_runtime", error);
      }
    },
    streamTokens(request, signal) {
      const iterator = async function* () {
        const credential = await sign("action_runtime", [request.workload.capability], request.scope, request.delegated_principal);
        for await (const frame of streamSseV1({
          url: `${actionRuntimeUrl}/internal/runtime-runs/${encodeURIComponent(request.runtime_run_id)}/tokens`,
          credential, trace_id: request.trace_id, signal, timeout_ms: timeoutMs, fetch: fetchImpl,
          upstream: "action_runtime", expected_event: "runtime_token",
        })) {
          if (frame.kind === "event") yield frame.event;
        }
      };
      return iterator();
    },
  };

  const meta: ObservationMetaPortV1 = {
    checkReadiness: () => checkLiveV1(metaCognitionUrl, timeoutMs, fetchImpl),
    async getJob(request) {
      try {
        const credential = await sign("meta_cognition", [request.workload.capability], request.scope, request.delegated_principal);
        const response = await requestWorkloadJson<unknown>({
          url: `${metaCognitionUrl}/v1/meta/jobs/${encodeURIComponent(request.meta_job_id)}`,
          workloadCredential: credential, timeoutMs, idempotent: true, maxRetries: 2,
          traceId: request.trace_id, fetchImpl,
        });
        return envelopeDetailsV1(response.body, "meta_job_found", request.trace_id, "meta_cognition");
      } catch (error) {
        throw upstreamErrorV1("meta_cognition", error);
      }
    },
    async listQualitySignals(request) {
      try {
        const credential = await sign("meta_cognition", [request.workload.capability], request.scope, request.delegated_principal);
        const url = new URL(`${metaCognitionUrl}/v1/trigger-processes/${encodeURIComponent(request.trigger_process_id)}/quality-signals`);
        url.searchParams.set("limit", String(request.limit));
        if (request.cursor !== undefined) url.searchParams.set("cursor", request.cursor);
        if (request.severity !== undefined) url.searchParams.set("severity", request.severity);
        if (request.signal_type !== undefined) url.searchParams.set("signal_type", request.signal_type);
        const response = await requestWorkloadJson<unknown>({
          url: url.toString(), workloadCredential: credential, timeoutMs, idempotent: true, maxRetries: 2,
          traceId: request.trace_id, fetchImpl,
        });
        return envelopeDetailsV1(response.body, "quality_signals_found", request.trace_id, "meta_cognition");
      } catch (error) {
        throw upstreamErrorV1("meta_cognition", error);
      }
    },
  };

  return Object.freeze({ trigger_processor: Object.freeze(triggerProcessor), owner_reads: Object.freeze(ownerReads), runtime: Object.freeze(runtime), meta: Object.freeze(meta) });
}
