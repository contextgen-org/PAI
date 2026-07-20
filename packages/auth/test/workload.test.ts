import type { JSONWebKeySet, JWK } from "jose";
import {
  exportJWK,
  generateKeyPair,
  SignJWT,
} from "jose";
import { describe, expect, it } from "vitest";

import {
  AuthError,
  JwksCache,
  type JwksProvider,
  WorkloadJwtSigner,
  WorkloadJwtVerifier,
} from "../src/index.js";

async function keyFixture(kid: string) {
  const pair = await generateKeyPair("Ed25519", { extractable: true });
  const publicJwk: JWK = {
    ...(await exportJWK(pair.publicKey)),
    alg: "EdDSA",
    kid,
    use: "sig",
  };
  return { ...pair, publicJwk };
}

function globalInput() {
  return {
    audience: "memory" as const,
    capabilities: ["memory.read"],
    scope: { scope_kind: "global" as const },
  };
}

async function verifierFor(jwks: JSONWebKeySet) {
  const cache = new JwksCache({ provider: { load: async () => jwks } });
  return new WorkloadJwtVerifier({ getKey: cache.getKey });
}

describe("workload JWT", () => {
  it("signs and verifies the canonical single-audience claims", async () => {
    const key = await keyFixture("workload-1");
    const signer = new WorkloadJwtSigner({
      subject: "action_runtime",
      privateKey: key.privateKey,
      keyId: "workload-1",
      algorithm: "EdDSA",
    });
    const verifier = await verifierFor({ keys: [key.publicJwk] });

    const token = await signer.sign({
      ...globalInput(),
      capabilities: ["memory.read", "memory.deep_recall"],
    });
    const verified = await verifier.verify(token, {
      audience: "memory",
      allowedCallers: ["action_runtime"],
      requiredCapabilities: ["memory.deep_recall"],
      requiredScope: { scope_kind: "global" },
    });

    expect(verified.protectedHeader.kid).toBe("workload-1");
    expect(verified.claims.aud).toBe("memory");
    expect(verified.claims.capability).toEqual([
      "memory.deep_recall",
      "memory.read",
    ]);
  });

  it("rejects TTL above 300 seconds before signing", async () => {
    const key = await keyFixture("workload-1");
    const signer = new WorkloadJwtSigner({
      subject: "action_runtime",
      privateKey: key.privateKey,
      keyId: "workload-1",
      algorithm: "EdDSA",
    });
    await expect(signer.sign({ ...globalInput(), ttlSeconds: 301 })).rejects.toThrow(
      "1 to 300",
    );
  });

  it.each([
    {
      name: "wrong audience",
      requirements: {
        audience: "knowthat" as const,
        requiredCapabilities: ["memory.read"],
      },
      code: "unauthenticated",
    },
    {
      name: "missing capability",
      requirements: {
        audience: "memory" as const,
        requiredCapabilities: ["memory.write"],
      },
      code: "capability_denied",
    },
    {
      name: "caller mismatch",
      requirements: {
        audience: "memory" as const,
        allowedCallers: ["knowthat" as const],
        requiredCapabilities: ["memory.read"],
      },
      code: "authorization_denied",
    },
    {
      name: "scope mismatch",
      requirements: {
        audience: "memory" as const,
        requiredCapabilities: ["memory.read"],
        requiredScope: {
          scope_kind: "bot" as const,
          workspace_id: "workspace-1",
          bot_id: "bot-1",
          owner_agent_id: "agent-1",
          deployment_environment: "prod" as const,
          release_channel: "stable" as const,
        },
      },
      code: "authorization_scope_mismatch",
    },
  ])("rejects $name", async ({ requirements, code }) => {
    const key = await keyFixture("workload-1");
    const signer = new WorkloadJwtSigner({
      subject: "action_runtime",
      privateKey: key.privateKey,
      keyId: "workload-1",
      algorithm: "EdDSA",
    });
    const verifier = await verifierFor({ keys: [key.publicJwk] });
    const token = await signer.sign(globalInput());

    await expect(verifier.verify(token, requirements)).rejects.toMatchObject({
      code,
    });
  });

  it("rejects expired and payload-tampered credentials", async () => {
    const key = await keyFixture("workload-1");
    const verifier = await verifierFor({ keys: [key.publicJwk] });
    const now = Math.floor(Date.now() / 1_000);
    const expired = await new SignJWT({
      iss: "pai-workload",
      sub: "action_runtime",
      aud: "memory",
      jti: "expired",
      iat: now - 120,
      nbf: now - 120,
      exp: now - 60,
      capability: ["memory.read"],
      scope_kind: "global",
    })
      .setProtectedHeader({ alg: "EdDSA", kid: "workload-1" })
      .sign(key.privateKey);
    await expect(
      verifier.verify(expired, {
        audience: "memory",
        requiredCapabilities: ["memory.read"],
      }),
    ).rejects.toMatchObject({ code: "unauthenticated" });

    const signer = new WorkloadJwtSigner({
      subject: "action_runtime",
      privateKey: key.privateKey,
      keyId: "workload-1",
      algorithm: "EdDSA",
    });
    const valid = await signer.sign(globalInput());
    const parts = valid.split(".");
    parts[1] = `${parts[1]![0] === "a" ? "b" : "a"}${parts[1]!.slice(1)}`;
    await expect(
      verifier.verify(parts.join("."), {
        audience: "memory",
        requiredCapabilities: ["memory.read"],
      }),
    ).rejects.toBeInstanceOf(AuthError);
  });

  it("rejects a future-issued token that tries to stretch the effective lifetime", async () => {
    const key = await keyFixture("workload-1");
    const verifier = await verifierFor({ keys: [key.publicJwk] });
    const now = Math.floor(Date.now() / 1_000);
    const futureIssued = await new SignJWT({
      iss: "pai-workload",
      sub: "action_runtime",
      aud: "memory",
      jti: "future-issued",
      iat: now + 3_600,
      nbf: now - 1,
      exp: now + 3_900,
      capability: ["memory.read"],
      scope_kind: "global",
    })
      .setProtectedHeader({ alg: "EdDSA", kid: "workload-1" })
      .sign(key.privateKey);

    await expect(
      verifier.verify(futureIssued, {
        audience: "memory",
        requiredCapabilities: ["memory.read"],
      }),
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("rejects delegated-principal tampering even when every other claim is unchanged", async () => {
    const key = await keyFixture("workload-1");
    const signer = new WorkloadJwtSigner({
      subject: "action_runtime",
      privateKey: key.privateKey,
      keyId: "workload-1",
      algorithm: "EdDSA",
    });
    const verifier = await verifierFor({ keys: [key.publicJwk] });
    const token = await signer.sign({
      audience: "memory",
      capabilities: ["memory.deep_recall"],
      scope: {
        scope_kind: "bot",
        workspace_id: "workspace-1",
        bot_id: "bot-1",
        owner_agent_id: "agent-1",
        deployment_environment: "prod",
        release_channel: "stable",
      },
      delegatedPrincipal: {
        principal_type: "user",
        principal_id: "user-1",
        roles: ["member"],
        source_issuer: "https://project.supabase.co/auth/v1",
        source_subject: "user-1",
        auth_time: Math.floor(Date.now() / 1_000),
        scope_kind: "bot",
        workspace_id: "workspace-1",
        bot_id: "bot-1",
        owner_agent_id: "agent-1",
        deployment_environment: "prod",
        release_channel: "stable",
      },
    });
    const parts = token.split(".");
    const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8")) as {
      delegated_principal: { principal_id: string };
    };
    payload.delegated_principal.principal_id = "attacker";
    parts[1] = Buffer.from(JSON.stringify(payload)).toString("base64url");

    await expect(
      verifier.verify(parts.join("."), {
        audience: "memory",
        allowedCallers: ["action_runtime"],
        requiredCapabilities: ["memory.deep_recall"],
        requiredScope: {
          scope_kind: "bot",
          workspace_id: "workspace-1",
          bot_id: "bot-1",
          owner_agent_id: "agent-1",
          deployment_environment: "prod",
          release_channel: "stable",
        },
      }),
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("supports bounded old/new kid overlap and retires the old key", async () => {
    const oldKey = await keyFixture("old");
    const newKey = await keyFixture("new");
    let clockMs = 1_000;
    let active: JSONWebKeySet = { keys: [oldKey.publicJwk] };
    let loads = 0;
    const provider: JwksProvider = {
      load: async () => {
        loads += 1;
        return active;
      },
    };
    const cache = new JwksCache({
      provider,
      maxAgeMs: 100,
      unknownKidRefreshCooldownMs: 100,
      now: () => clockMs,
    });
    const verifier = new WorkloadJwtVerifier({ getKey: cache.getKey });
    const oldSigner = new WorkloadJwtSigner({
      subject: "action_runtime",
      privateKey: oldKey.privateKey,
      keyId: "old",
      algorithm: "EdDSA",
    });
    const newSigner = new WorkloadJwtSigner({
      subject: "action_runtime",
      privateKey: newKey.privateKey,
      keyId: "new",
      algorithm: "EdDSA",
    });
    const requirements = {
      audience: "memory" as const,
      requiredCapabilities: ["memory.read"],
    };
    const oldToken = await oldSigner.sign(globalInput());
    await expect(verifier.verify(oldToken, requirements)).resolves.toBeDefined();

    active = { keys: [oldKey.publicJwk, newKey.publicJwk] };
    const newToken = await newSigner.sign(globalInput());
    await expect(verifier.verify(newToken, requirements)).resolves.toBeDefined();
    await expect(verifier.verify(oldToken, requirements)).resolves.toBeDefined();

    active = { keys: [newKey.publicJwk] };
    clockMs += 101;
    await expect(verifier.verify(newToken, requirements)).resolves.toBeDefined();
    await expect(verifier.verify(oldToken, requirements)).rejects.toMatchObject({
      code: "unauthenticated",
    });
    expect(loads).toBeGreaterThanOrEqual(3);
  });

  it("bounds unknown-kid refreshes across random kid values", async () => {
    const trustedKey = await keyFixture("trusted");
    const attackerA = await keyFixture("attacker-a");
    const attackerB = await keyFixture("attacker-b");
    let clockMs = 1_000;
    let loads = 0;
    const cache = new JwksCache({
      provider: {
        load: async () => {
          loads += 1;
          return { keys: [trustedKey.publicJwk] };
        },
      },
      unknownKidRefreshCooldownMs: 100,
      now: () => clockMs,
    });
    const verifier = new WorkloadJwtVerifier({ getKey: cache.getKey });
    const trustedSigner = new WorkloadJwtSigner({
      subject: "action_runtime",
      privateKey: trustedKey.privateKey,
      keyId: "trusted",
      algorithm: "EdDSA",
    });
    const attackerSignerA = new WorkloadJwtSigner({
      subject: "action_runtime",
      privateKey: attackerA.privateKey,
      keyId: "attacker-a",
      algorithm: "EdDSA",
    });
    const attackerSignerB = new WorkloadJwtSigner({
      subject: "action_runtime",
      privateKey: attackerB.privateKey,
      keyId: "attacker-b",
      algorithm: "EdDSA",
    });
    const requirements = {
      audience: "memory" as const,
      requiredCapabilities: ["memory.read"],
    };

    await expect(
      verifier.verify(await trustedSigner.sign(globalInput()), requirements),
    ).resolves.toBeDefined();
    await expect(
      verifier.verify(await attackerSignerA.sign(globalInput()), requirements),
    ).rejects.toMatchObject({ code: "unauthenticated" });
    await expect(
      verifier.verify(await attackerSignerB.sign(globalInput()), requirements),
    ).rejects.toMatchObject({ code: "unauthenticated" });
    expect(loads).toBe(2);
  });
});
