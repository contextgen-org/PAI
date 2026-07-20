import type { JWK } from "jose";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { describe, expect, it } from "vitest";

import {
  JwksCache,
  SupabaseIngressVerifier,
} from "../src/index.js";

async function fixture() {
  const key = await generateKeyPair("ES256", { extractable: true });
  const publicJwk: JWK = {
    ...(await exportJWK(key.publicKey)),
    alg: "ES256",
    kid: "supabase-1",
    use: "sig",
  };
  const cache = new JwksCache({
    provider: { load: async () => ({ keys: [publicJwk] }) },
  });
  const verifier = new SupabaseIngressVerifier({
    issuer: "https://project.supabase.co/auth/v1",
    audience: "authenticated",
    getKey: cache.getKey,
  });
  return { key, verifier };
}

async function sign(
  privateKey: CryptoKey,
  overrides: Readonly<Record<string, unknown>> = {},
) {
  const now = Math.floor(Date.now() / 1_000);
  return new SignJWT({
    sub: "user-1",
    app_metadata: {
      principal_type: "developer",
      principal_id: "developer-1",
      roles: ["writer", "reader", "reader"],
    },
    ...overrides,
  })
    .setProtectedHeader({ alg: "ES256", kid: "supabase-1", typ: "JWT" })
    .setIssuer("https://project.supabase.co/auth/v1")
    .setAudience("authenticated")
    .setIssuedAt(now)
    .setNotBefore(now - 1)
    .setExpirationTime(now + 60)
    .sign(privateKey);
}

describe("Supabase ingress verifier", () => {
  it("verifies issuer, audience, time and maps a stable principal", async () => {
    const { key, verifier } = await fixture();
    const result = await verifier.verify(await sign(key.privateKey));
    expect(result.principal).toEqual({
      principal_type: "developer",
      principal_id: "developer-1",
      roles: ["reader", "writer"],
      source_issuer: "https://project.supabase.co/auth/v1",
      source_subject: "user-1",
      auth_time: expect.any(Number),
    });
    expect(result).not.toHaveProperty("token");
  });

  it("maps explicitly declared bot identities without creating delegation", async () => {
    const { key, verifier } = await fixture();
    const token = await sign(key.privateKey, {
      app_metadata: {
        principal_type: "bot",
        principal_id: "bot-1",
        roles: ["automation"],
      },
    });
    const result = await verifier.verify(token);
    expect(result.principal.principal_type).toBe("bot");
    expect(result.principal.principal_id).toBe("bot-1");
  });

  it("rejects wrong audience, expiry and signature tampering", async () => {
    const { key, verifier } = await fixture();
    const now = Math.floor(Date.now() / 1_000);
    const wrongAudience = await new SignJWT({ sub: "user-1" })
      .setProtectedHeader({ alg: "ES256", kid: "supabase-1" })
      .setIssuer("https://project.supabase.co/auth/v1")
      .setAudience("service_role")
      .setIssuedAt(now)
      .setExpirationTime(now + 60)
      .sign(key.privateKey);
    await expect(verifier.verify(wrongAudience)).rejects.toMatchObject({
      code: "unauthenticated",
    });

    const wrongIssuer = await new SignJWT({ sub: "user-1" })
      .setProtectedHeader({ alg: "ES256", kid: "supabase-1" })
      .setIssuer("https://attacker.invalid/auth/v1")
      .setAudience("authenticated")
      .setIssuedAt(now)
      .setExpirationTime(now + 60)
      .sign(key.privateKey);
    await expect(verifier.verify(wrongIssuer)).rejects.toMatchObject({
      code: "unauthenticated",
    });

    const expired = await new SignJWT({ sub: "user-1" })
      .setProtectedHeader({ alg: "ES256", kid: "supabase-1" })
      .setIssuer("https://project.supabase.co/auth/v1")
      .setAudience("authenticated")
      .setIssuedAt(now - 120)
      .setExpirationTime(now - 60)
      .sign(key.privateKey);
    await expect(verifier.verify(expired)).rejects.toMatchObject({
      code: "unauthenticated",
    });

    const valid = await sign(key.privateKey);
    const parts = valid.split(".");
    parts[1] = `${parts[1]![0] === "a" ? "b" : "a"}${parts[1]!.slice(1)}`;
    await expect(verifier.verify(parts.join("."))).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });
});
