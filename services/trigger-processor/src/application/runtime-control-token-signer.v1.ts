import { createPrivateKey, randomUUID, type KeyObject } from "node:crypto";

import { normalizePrivateKeyPemEnvironmentValueV1 } from "@pai/auth";
import { SignJWT, type CryptoKey as JoseCryptoKey } from "jose";

const identityPatternV1 = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,511}$/u;
const tokenIdentityPatternV1 = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u;
const CONTROL_GRACE_MS_V1 = 15 * 60 * 1_000;
const MAX_POLICY_LIFETIME_MS_V1 = 24 * 60 * 60 * 1_000;
const MAX_CONTROL_TOKEN_BYTES_V1 = 8_192;

export interface RuntimeControlTokenSignRequestV1 {
  readonly trigger_process_id: string;
  readonly runtime_run_id: string;
  readonly bot_id: string;
  readonly token_version: number;
  readonly policy_expires_at: string;
  readonly jti?: string;
}

export interface RuntimeControlTokenSignResultV1 {
  readonly token: string;
  readonly control_valid_until: string;
}

export interface RuntimeControlTokenSignerPortV1 {
  sign(
    request: RuntimeControlTokenSignRequestV1,
  ): Promise<RuntimeControlTokenSignResultV1>;
}

export interface RuntimeControlTokenSignerOptionsV1 {
  readonly private_key: KeyObject | JoseCryptoKey;
  readonly key_id: string;
  readonly algorithm: "EdDSA" | "ES256" | "RS256";
  readonly issuer?: string;
  readonly now?: () => number;
  readonly generate_jti?: () => string;
}

export function createRuntimeControlTokenSignerV1(
  options: RuntimeControlTokenSignerOptionsV1,
): RuntimeControlTokenSignerPortV1 {
  const issuer = options.issuer ?? "pai-runtime-control";
  const now = options.now ?? (() => Date.now());
  const generateJti = options.generate_jti ?? randomUUID;
  if (
    !tokenIdentityPatternV1.test(options.key_id) ||
    !tokenIdentityPatternV1.test(issuer) ||
    (options.algorithm !== "EdDSA" &&
      options.algorithm !== "ES256" &&
      options.algorithm !== "RS256") ||
    typeof now !== "function" ||
    typeof generateJti !== "function"
  ) {
    throw new Error("Runtime control token signer options are invalid");
  }

  return Object.freeze({
    async sign(
      request: RuntimeControlTokenSignRequestV1,
    ): Promise<RuntimeControlTokenSignResultV1> {
      const currentTimeMs = now();
      const policyExpiresAtMs = Date.parse(request.policy_expires_at);
      const jti = request.jti ?? generateJti();
      if (
        !Number.isSafeInteger(currentTimeMs) ||
        currentTimeMs < 0 ||
        !identityPatternV1.test(request.trigger_process_id) ||
        !identityPatternV1.test(request.runtime_run_id) ||
        !identityPatternV1.test(request.bot_id) ||
        !Number.isSafeInteger(request.token_version) ||
        request.token_version < 1 ||
        !Number.isFinite(policyExpiresAtMs) ||
        policyExpiresAtMs <= currentTimeMs ||
        policyExpiresAtMs - currentTimeMs > MAX_POLICY_LIFETIME_MS_V1 ||
        !tokenIdentityPatternV1.test(jti)
      ) {
        throw new Error("Runtime control token signing request is invalid");
      }

      const controlValidUntil = new Date(
        policyExpiresAtMs + CONTROL_GRACE_MS_V1,
      ).toISOString();
      const issuedAt = Math.floor(currentTimeMs / 1_000);
      const expiresAt = Math.floor(Date.parse(controlValidUntil) / 1_000);
      const token = await new SignJWT({
        trigger_process_id: request.trigger_process_id,
        runtime_run_id: request.runtime_run_id,
        bot_id: request.bot_id,
        token_version: request.token_version,
        control_valid_until: controlValidUntil,
      })
        .setProtectedHeader({
          alg: options.algorithm,
          kid: options.key_id,
          typ: "JWT",
        })
        .setIssuer(issuer)
        .setAudience("action_runtime")
        .setSubject("trigger_processor")
        .setJti(jti)
        .setIssuedAt(issuedAt)
        .setNotBefore(issuedAt)
        .setExpirationTime(expiresAt)
        .sign(options.private_key);
      if (Buffer.byteLength(token, "utf8") > MAX_CONTROL_TOKEN_BYTES_V1) {
        throw new Error("Runtime control token exceeds the bounded contract");
      }
      return Object.freeze({
        token,
        control_valid_until: controlValidUntil,
      });
    },
  });
}

export function createRuntimeControlTokenSignerFromEnvV1(
  env: NodeJS.ProcessEnv,
): RuntimeControlTokenSignerPortV1 {
  const pem = env.PAI_RUNTIME_CONTROL_SIGNING_PRIVATE_KEY_PEM;
  const keyId = env.PAI_RUNTIME_CONTROL_SIGNING_KEY_ID;
  const algorithm = env.PAI_RUNTIME_CONTROL_SIGNING_ALGORITHM;
  if (pem === undefined || keyId === undefined || algorithm === undefined) {
    throw new Error(
      "PAI_RUNTIME_CONTROL_SIGNING_PRIVATE_KEY_PEM, PAI_RUNTIME_CONTROL_SIGNING_KEY_ID, and PAI_RUNTIME_CONTROL_SIGNING_ALGORITHM are required",
    );
  }
  if (algorithm !== "EdDSA" && algorithm !== "ES256" && algorithm !== "RS256") {
    throw new Error(
      "PAI_RUNTIME_CONTROL_SIGNING_ALGORITHM must be EdDSA, ES256, or RS256",
    );
  }
  return createRuntimeControlTokenSignerV1({
    private_key: createPrivateKey(normalizePrivateKeyPemEnvironmentValueV1(pem)),
    key_id: keyId,
    algorithm,
    issuer:
      env.PAI_RUNTIME_CONTROL_TOKEN_ISSUER ?? "pai-runtime-control",
  });
}
