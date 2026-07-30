import { createPrivateKey } from "node:crypto";

import {
  WorkloadJwtSigner,
  normalizePrivateKeyPemEnvironmentValueV1,
  type AuthorizationScopeV1,
  type WorkloadCredentialSignerPort,
} from "@pai/auth";
import type {
  MemoryPrePromotionCheckRequestV1,
  MemoryPrePromotionCheckResponseV1,
  MemoryPrePromotionValidateRequestV1,
  MemoryPromotionReservationAckRequestV1,
  MemoryPromotionReservationAckResponseV1,
  MemoryPromotionReservationReleaseRequestV1,
  MemoryPromotionReservationReleaseResponseV1,
  MemoryPromotionReservationV1,
} from "@pai/contracts";
import {
  isTrustedLocalDockerHttpOriginV1,
  requestInternalJson,
} from "@pai/service-kit";

import type {
  KnowThatMemoryPrePromotionPortV1,
  KnowThatScopeV1,
} from "./knowthat-types.v1.js";

function requiredEnvV1(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.includes("\u0000")
  ) {
    throw new Error(`${key} is required`);
  }
  return value;
}

function optionalIntegerV1(
  env: NodeJS.ProcessEnv,
  key: string,
  minimum: number,
  maximum: number,
): number | undefined {
  const value = env[key];
  if (value === undefined) return undefined;
  if (!/^(?:0|[1-9][0-9]*)$/u.test(value)) {
    throw new Error(`${key} must be an unsigned base-10 integer`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${key} is outside its supported range`);
  }
  return parsed;
}

function baseUrlV1(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("PAI_MEMORY_URL must be an absolute URL");
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
      "PAI_MEMORY_URL must use HTTPS except on loopback and must not contain credentials, query, or fragment",
    );
  }
  return url.toString().replace(/\/$/u, "");
}

function botScopeV1(scope: KnowThatScopeV1): AuthorizationScopeV1 {
  return Object.freeze({ scope_kind: "bot" as const, ...scope });
}

function createKnowThatWorkloadSignerFromEnvV1(
  env: NodeJS.ProcessEnv,
): WorkloadCredentialSignerPort {
  const pem = requiredEnvV1(env, "PAI_WORKLOAD_SIGNING_PRIVATE_KEY_PEM");
  const keyId = requiredEnvV1(env, "PAI_WORKLOAD_SIGNING_KEY_ID");
  const algorithm = requiredEnvV1(env, "PAI_WORKLOAD_SIGNING_ALGORITHM");
  if (algorithm !== "EdDSA" && algorithm !== "ES256" && algorithm !== "RS256") {
    throw new Error(
      "PAI_WORKLOAD_SIGNING_ALGORITHM must be EdDSA, ES256, or RS256",
    );
  }
  return new WorkloadJwtSigner({
    subject: "knowthat",
    privateKey: createPrivateKey(normalizePrivateKeyPemEnvironmentValueV1(pem)),
    keyId,
    algorithm,
  });
}

export function createKnowThatMemoryClientV1(input: Readonly<{
  memory_url: string;
  signer: WorkloadCredentialSignerPort;
  request_timeout_ms?: number;
  fetch?: typeof fetch;
}>): KnowThatMemoryPrePromotionPortV1 {
  const memoryUrl = baseUrlV1(input.memory_url);
  const timeoutMs = input.request_timeout_ms ?? 10_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 300_000) {
    throw new Error("KnowThat Memory request timeout is outside bounds");
  }
  const fetchImpl = input.fetch ?? fetch;
  const sign = (
    capability: string,
    scope: KnowThatScopeV1 | undefined,
  ): Promise<string> =>
    scope === undefined
      ? Promise.reject(
          new Error("KnowThat Memory client requires a scope-bound request"),
        )
      : input.signer.sign({
          audience: "memory",
          capabilities: [capability],
          scope: botScopeV1(scope),
        });

  const client: KnowThatMemoryPrePromotionPortV1 = {
    async check(request, signal, scope) {
      const response =
        await requestInternalJson<MemoryPrePromotionCheckResponseV1>({
          url: `${memoryUrl}/internal/memory/pre-promotion-check`,
          method: "POST",
          workloadCredential: await sign(
            "memory.pre_promotion_check",
            scope,
          ),
          json: request,
          timeoutMs,
          idempotent: true,
          maxRetries: 2,
          signal,
          fetchImpl,
        });
      return response.body;
    },
    async validate(request, signal, scope) {
      const response =
        await requestInternalJson<MemoryPromotionReservationV1>({
          url: `${memoryUrl}/internal/memory/pre-promotion-check/validate`,
          method: "POST",
          workloadCredential: await sign(
            "memory.pre_promotion_check",
            scope,
          ),
          json: request,
          timeoutMs,
          idempotent: true,
          maxRetries: 2,
          signal,
          fetchImpl,
        });
      return response.body;
    },
    async ack(request, signal, scope) {
      const response =
        await requestInternalJson<MemoryPromotionReservationAckResponseV1>({
          url:
            `${memoryUrl}/internal/memory/promotion-reservations/` +
            `${encodeURIComponent(request.reservation_id)}/ack`,
          method: "POST",
          workloadCredential: await sign(
            "memory.promotion_reservation.ack",
            scope,
          ),
          json: request,
          timeoutMs,
          idempotent: true,
          maxRetries: 2,
          signal,
          fetchImpl,
        });
      return response.body;
    },
    async release(request, signal, scope) {
      const response =
        await requestInternalJson<MemoryPromotionReservationReleaseResponseV1>({
          url:
            `${memoryUrl}/internal/memory/promotion-reservations/` +
            `${encodeURIComponent(request.reservation_id)}/release`,
          method: "POST",
          workloadCredential: await sign(
            "memory.promotion_reservation.release",
            scope,
          ),
          json: request,
          timeoutMs,
          idempotent: true,
          maxRetries: 2,
          signal,
          fetchImpl,
        });
      return response.body;
    },
    async checkReadiness(signal) {
      signal.throwIfAborted();
      const response = await fetchImpl(`${memoryUrl}/health`, {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
      });
      await response.body?.cancel().catch(() => undefined);
      signal.throwIfAborted();
      if (!response.ok) throw new Error("Memory service is not live");
    },
  };
  return Object.freeze(client);
}

export function createKnowThatMemoryClientFromEnvV1(
  env: NodeJS.ProcessEnv = process.env,
): KnowThatMemoryPrePromotionPortV1 {
  const requestTimeoutMs = optionalIntegerV1(
    env,
    "PAI_KNOWTHAT_MEMORY_REQUEST_TIMEOUT_MS",
    100,
    300_000,
  );
  return createKnowThatMemoryClientV1({
    memory_url: requiredEnvV1(env, "PAI_MEMORY_URL"),
    signer: createKnowThatWorkloadSignerFromEnvV1(env),
    ...(requestTimeoutMs === undefined
      ? {}
      : { request_timeout_ms: requestTimeoutMs }),
  });
}
