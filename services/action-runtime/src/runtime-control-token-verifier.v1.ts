import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTVerifyGetKey,
} from "jose";
import { isTrustedLocalDockerHttpOriginV1 } from "@pai/service-kit";

import type {
  RuntimeControlTokenClaimsV1,
  RuntimeControlTokenVerifierPortV1,
} from "./runtime-execution.v1.js";

export interface RuntimeControlTokenVerifierOptionsV1 {
  readonly get_key: JWTVerifyGetKey;
  readonly issuer?: string;
  readonly algorithms?: readonly ("EdDSA" | "ES256" | "RS256")[];
  readonly clock_tolerance_seconds?: number;
}

const tokenIdPatternV1 = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u;

export function createRuntimeControlTokenVerifierV1(
  options: RuntimeControlTokenVerifierOptionsV1,
): RuntimeControlTokenVerifierPortV1 {
  const issuer = options.issuer ?? "pai-runtime-control";
  const algorithms: ("EdDSA" | "ES256" | "RS256")[] = [
    ...(options.algorithms ?? ["EdDSA", "ES256", "RS256"]),
  ];
  const tolerance = options.clock_tolerance_seconds ?? 5;
  if (
    typeof options.get_key !== "function" ||
    !tokenIdPatternV1.test(issuer) ||
    algorithms.length < 1 ||
    new Set(algorithms).size !== algorithms.length ||
    algorithms.some(
      (algorithm) =>
        algorithm !== "EdDSA" && algorithm !== "ES256" && algorithm !== "RS256",
    ) ||
    !Number.isSafeInteger(tolerance) ||
    tolerance < 0 ||
    tolerance > 30
  ) {
    throw new Error("Runtime control token verifier options are invalid");
  }
  return Object.freeze({
    async verify(
      token: string,
      expected: Parameters<RuntimeControlTokenVerifierPortV1["verify"]>[1],
    ): Promise<RuntimeControlTokenClaimsV1> {
      if (
        typeof token !== "string" ||
        token.length < 1 ||
        token.length > 8_192
      ) {
        throw new Error("Runtime control token is malformed");
      }
      const verified = await jwtVerify(token, options.get_key, {
        issuer,
        audience: "action_runtime",
        algorithms,
        clockTolerance: tolerance,
        requiredClaims: ["iat", "exp", "jti", "sub"],
      });
      const payload = verified.payload;
      const keys = Object.keys(payload).sort();
      const allowed = [
        "aud",
        "bot_id",
        "control_valid_until",
        "exp",
        "iat",
        "iss",
        "jti",
        "nbf",
        "runtime_run_id",
        "sub",
        "token_version",
        "trigger_process_id",
      ];
      if (
        keys.some((key) => !allowed.includes(key)) ||
        payload.sub !== "trigger_processor" ||
        payload.runtime_run_id !== expected.runtime_run_id ||
        payload.trigger_process_id !== expected.trigger_process_id ||
        payload.bot_id !== expected.scope.bot_id ||
        !Number.isSafeInteger(payload.token_version) ||
        (payload.token_version as number) < 1 ||
        typeof payload.control_valid_until !== "string" ||
        !Number.isFinite(Date.parse(payload.control_valid_until)) ||
        payload.exp !==
          Math.floor(Date.parse(payload.control_valid_until) / 1_000) ||
        typeof payload.jti !== "string" ||
        !tokenIdPatternV1.test(payload.jti)
      ) {
        throw new Error("Runtime control token binding is invalid");
      }
      return Object.freeze({
        runtime_run_id: expected.runtime_run_id,
        trigger_process_id: expected.trigger_process_id,
        start_attempt_no: expected.start_attempt_no,
        start_fence_generation: payload.token_version as number,
        ...expected.scope,
        control_valid_until: payload.control_valid_until,
      });
    },
  });
}

function jwksUrlV1(raw: string, env: NodeJS.ProcessEnv): URL {
  const url = new URL(raw);
  const loopback =
    url.hostname === "127.0.0.1" ||
    url.hostname === "[::1]" ||
    url.hostname === "localhost";
  if (
    (url.protocol !== "https:" &&
      !(url.protocol === "http:" &&
        (loopback || isTrustedLocalDockerHttpOriginV1(url, env)))) ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.hash.length > 0
  ) {
    throw new Error("PAI_RUNTIME_CONTROL_JWKS_URL is invalid");
  }
  return url;
}

export function createRuntimeControlTokenVerifierFromEnvV1(
  env: NodeJS.ProcessEnv,
): RuntimeControlTokenVerifierPortV1 {
  const rawUrl = env.PAI_RUNTIME_CONTROL_JWKS_URL;
  if (rawUrl === undefined) {
    throw new Error("PAI_RUNTIME_CONTROL_JWKS_URL is required");
  }
  return createRuntimeControlTokenVerifierV1({
    get_key: createRemoteJWKSet(jwksUrlV1(rawUrl, env)),
    issuer: env.PAI_RUNTIME_CONTROL_TOKEN_ISSUER ?? "pai-runtime-control",
  });
}
