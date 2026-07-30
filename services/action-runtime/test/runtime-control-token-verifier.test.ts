import {
  SignJWT,
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
} from "jose";
import { describe, expect, it } from "vitest";

import {
  createRuntimeControlTokenVerifierFromEnvV1,
  createRuntimeControlTokenVerifierV1,
} from "../src/runtime-control-token-verifier.v1.js";

const expected = Object.freeze({
  runtime_run_id: "run-018f4f89-7fd1-7b9d-91d8-784dc7f759e2",
  trigger_process_id: "process-018f4f89-7fd1-7b9d-91d8-784dc7f759e2",
  start_attempt_no: 3,
  scope: Object.freeze({
    workspace_id: "workspace-1",
    bot_id: "bot-1",
    owner_agent_id: "agent-1",
    deployment_environment: "prod" as const,
    release_channel: "stable" as const,
  }),
});

async function fixture() {
  const pair = await generateKeyPair("Ed25519", { extractable: true });
  const publicJwk = await exportJWK(pair.publicKey);
  const getKey = createLocalJWKSet({
    keys: [{ ...publicJwk, kid: "runtime-control-1", alg: "EdDSA", use: "sig" }],
  });
  const controlValidUntil = "2030-01-01T00:15:00.000Z";
  const token = await new SignJWT({
    trigger_process_id: expected.trigger_process_id,
    runtime_run_id: expected.runtime_run_id,
    bot_id: expected.scope.bot_id,
    token_version: 7,
    control_valid_until: controlValidUntil,
  })
    .setProtectedHeader({ alg: "EdDSA", kid: "runtime-control-1", typ: "JWT" })
    .setIssuer("pai-runtime-control")
    .setAudience("action_runtime")
    .setSubject("trigger_processor")
    .setJti("control-1")
    .setIssuedAt(Math.floor(Date.parse("2029-12-31T23:55:00.000Z") / 1_000))
    .setExpirationTime(Math.floor(Date.parse(controlValidUntil) / 1_000))
    .sign(pair.privateKey);
  return { token, getKey, controlValidUntil };
}

describe("Runtime control token verifier", () => {
  it("admits only the fixed local Compose JWKS origin with explicit local transport", () => {
    expect(() => createRuntimeControlTokenVerifierFromEnvV1({
      PAI_DEPLOYMENT_ENVIRONMENT: "local",
      PAI_LOCAL_DOCKER_TRANSPORT: "true",
      PAI_RUNTIME_CONTROL_JWKS_URL:
        "http://jwks:8080/runtime-control.jwks.json",
    })).not.toThrow();
    expect(() => createRuntimeControlTokenVerifierFromEnvV1({
      PAI_DEPLOYMENT_ENVIRONMENT: "prod",
      PAI_LOCAL_DOCKER_TRANSPORT: "true",
      PAI_RUNTIME_CONTROL_JWKS_URL:
        "http://jwks:8080/runtime-control.jwks.json",
    })).toThrow(/PAI_RUNTIME_CONTROL_JWKS_URL is invalid/u);
  });

  it("verifies issuer signature, audience, bindings, version, and expiry", async () => {
    const { token, getKey, controlValidUntil } = await fixture();
    const verifier = createRuntimeControlTokenVerifierV1({ get_key: getKey });

    await expect(verifier.verify(token, expected)).resolves.toEqual({
      runtime_run_id: expected.runtime_run_id,
      trigger_process_id: expected.trigger_process_id,
      start_attempt_no: 3,
      start_fence_generation: 7,
      ...expected.scope,
      control_valid_until: controlValidUntil,
    });
  });

  it("fails closed when a signed token is replayed for another run or bot", async () => {
    const { token, getKey } = await fixture();
    const verifier = createRuntimeControlTokenVerifierV1({ get_key: getKey });

    await expect(
      verifier.verify(token, { ...expected, runtime_run_id: "another-run" }),
    ).rejects.toThrow(/binding is invalid/u);
    await expect(
      verifier.verify(token, {
        ...expected,
        scope: { ...expected.scope, bot_id: "another-bot" },
      }),
    ).rejects.toThrow(/binding is invalid/u);
  });
});
