import { createHash, createPrivateKey } from "node:crypto";

import {
  WorkloadJwtSigner,
  normalizePrivateKeyPemEnvironmentValueV1,
  type AuthorizationScopeV1,
  type WorkloadCredentialSignerPort,
} from "@pai/auth";
import {
  TriggerProcessGetResponseV1Schema,
  TriggerSubmitResponseV1Schema,
  type TriggerProcessGetResponseV1,
  type TriggerSubmitResponseV1,
} from "@pai/contracts";
import {
  isTrustedLocalDockerHttpOriginV1,
  requestWorkloadJson,
} from "@pai/service-kit";
import { Value } from "@sinclair/typebox/value";

import type {
  TimerScopeV1,
  TimerTriggerProcessorPortV1,
} from "./timer-application.v1.js";

function baseUrlV1(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("PAI_TRIGGER_PROCESSOR_URL must be an absolute URL");
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
      "PAI_TRIGGER_PROCESSOR_URL must use HTTPS except on loopback and must not contain credentials, query, or fragment",
    );
  }
  return url.toString().replace(/\/$/u, "");
}

function botScopeV1(scope: TimerScopeV1): AuthorizationScopeV1 {
  // `submit` receives a wider request object than the authorization scope.
  // Construct the credential scope explicitly instead of spreading the caller
  // object: the workload signer rejects unknown own properties fail-closed.
  return Object.freeze({
    scope_kind: "bot" as const,
    workspace_id: scope.workspace_id,
    bot_id: scope.bot_id,
    owner_agent_id: scope.owner_agent_id,
    deployment_environment: scope.deployment_environment,
    release_channel: scope.release_channel,
  });
}

/**
 * Timer command and occurrence identifiers are valid durable audit keys but
 * are not necessarily W3C trace IDs.  Keep that audit identity at the Timer
 * boundary and derive a valid, deterministic transport trace for HTTP.
 */
function transportTraceIdV1(timerTraceId: string): string {
  return createHash("sha256")
    .update("timer-trigger-processor.v1\u0000", "utf8")
    .update(timerTraceId, "utf8")
    .digest("hex")
    .slice(0, 32);
}

export function createTimerWorkloadSignerFromEnvV1(
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
    subject: "timer_trigger_app",
    privateKey: createPrivateKey(normalizePrivateKeyPemEnvironmentValueV1(pem)),
    keyId,
    algorithm,
  });
}

export function createTimerTriggerProcessorHttpPortV1(input: Readonly<{
  trigger_processor_url: string;
  signer: WorkloadCredentialSignerPort;
  request_timeout_ms?: number;
  fetch?: typeof fetch;
}>): TimerTriggerProcessorPortV1 {
  const triggerProcessorUrl = baseUrlV1(input.trigger_processor_url);
  const timeoutMs = input.request_timeout_ms ?? 10_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 300_000) {
    throw new Error("Timer internal request timeout is outside bounds");
  }
  const fetchImpl = input.fetch ?? fetch;
  const port: TimerTriggerProcessorPortV1 = {
    async submit(request, traceId) {
      const transportTraceId = transportTraceIdV1(traceId);
      const credential = await input.signer.sign({
        audience: "trigger_processor",
        capabilities: ["trigger.submit.timer"],
        scope: botScopeV1(request),
      });
      const response = await requestWorkloadJson<TriggerSubmitResponseV1>({
        url: `${triggerProcessorUrl}/v1/triggers`,
        method: "POST",
        workloadCredential: credential,
        // Trace identity is injected by requestWorkloadJson as x-trace-id.
        // TriggerSubmitRequestV1 is closed and must not receive transport
        // metadata in its JSON body.
        json: request,
        timeoutMs,
        traceId: transportTraceId,
        idempotent: true,
        maxRetries: 2,
        fetchImpl,
      });
      if (!Value.Check(TriggerSubmitResponseV1Schema, response.body)) {
        throw new Error("Trigger Processor returned an invalid Timer submit response");
      }
      if (response.body.trace_id !== transportTraceId) {
        throw new Error("Trigger Processor returned a mismatched Timer transport trace");
      }
      return Object.freeze({ ...response.body, trace_id: traceId });
    },
    async getProcess(processId, scope, traceId) {
      const transportTraceId = transportTraceIdV1(traceId);
      const credential = await input.signer.sign({
        audience: "trigger_processor",
        capabilities: ["trigger.process.read"],
        scope: botScopeV1(scope),
      });
      const response = await requestWorkloadJson<TriggerProcessGetResponseV1>({
        url: `${triggerProcessorUrl}/v1/trigger-processes/${encodeURIComponent(processId)}`,
        method: "GET",
        workloadCredential: credential,
        timeoutMs,
        traceId: transportTraceId,
        idempotent: true,
        maxRetries: 2,
        fetchImpl,
      });
      if (
        !Value.Check(TriggerProcessGetResponseV1Schema, response.body) ||
        response.body.trace_id !== transportTraceId ||
        response.body.details.id !== processId
      ) {
        throw new Error("Trigger Processor returned an invalid Timer process projection");
      }
      return response.body.details;
    },
    async checkReadiness(signal: AbortSignal) {
      signal.throwIfAborted();
      const response = await fetchImpl(`${triggerProcessorUrl}/health`, {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
      });
      await response.body?.cancel().catch(() => undefined);
      signal.throwIfAborted();
      if (!response.ok) throw new Error("Trigger Processor is not live");
    },
  };
  return Object.freeze(port);
}
