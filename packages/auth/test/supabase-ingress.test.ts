import type { JWK } from "jose";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { describe, expect, it, vi } from "vitest";

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
  return { key, verifier, cache };
}

async function sign(
  privateKey: CryptoKey,
  overrides: Readonly<Record<string, unknown>> = {},
  typ = "JWT",
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
    .setProtectedHeader({ alg: "ES256", kid: "supabase-1", typ })
    .setIssuer("https://project.supabase.co/auth/v1")
    .setAudience("authenticated")
    .setIssuedAt(now)
    .setExpirationTime(now + 60)
    .sign(privateKey);
}

describe("Supabase ingress verifier", () => {
  it("rejects unsafe issuer and audience configuration", () => {
    const getKey = async () => new Uint8Array(32);
    expect(
      () =>
        new SupabaseIngressVerifier({
          issuer: "http://identity.example/auth/v1",
          audience: "authenticated",
          getKey,
        }),
    ).toThrow("must use HTTPS");
    expect(
      () =>
        new SupabaseIngressVerifier({
          issuer: "https://project.supabase.co/auth/v1",
          audience: " ",
          getKey,
        }),
    ).toThrow("bounded token");
    expect(
      () =>
        new SupabaseIngressVerifier({
          issuer: "https://user:secret@project.supabase.co/auth/v1",
          audience: "authenticated",
          getKey,
        }),
    ).toThrow("cannot contain credentials");
    expect(
      () =>
        new SupabaseIngressVerifier({
          issuer: "https://project.supabase.co/auth/v1?tenant=confused",
          audience: "authenticated",
          getKey,
        }),
    ).toThrow("a query");
    expect(
      () =>
        new SupabaseIngressVerifier({
          issuer: "http://[::1]/auth/v1",
          audience: "authenticated",
          getKey,
        }),
    ).not.toThrow();
  });

  it("rejects accessor-backed verifier policy without executing it", () => {
    let issuerGetterCalls = 0;
    const options: Record<string, unknown> = {
      audience: "authenticated",
      getKey: async () => new Uint8Array(32),
    };
    Object.defineProperty(options, "issuer", {
      enumerable: true,
      get() {
        issuerGetterCalls += 1;
        return "https://project.supabase.co/auth/v1";
      },
    });
    expect(
      () => new SupabaseIngressVerifier(options as never),
    ).toThrow("options are invalid");
    expect(issuerGetterCalls).toBe(0);
  });

  it("rejects unsafe or empty algorithm allowlists", () => {
    const options = {
      issuer: "https://project.supabase.co/auth/v1",
      audience: "authenticated",
      getKey: async () => new Uint8Array(32),
    };

    expect(
      () =>
        new SupabaseIngressVerifier({
          ...options,
          algorithms: ["HS256" as never],
        }),
    ).toThrow("non-empty subset of EdDSA, ES256, and RS256");
    expect(
      () => new SupabaseIngressVerifier({ ...options, algorithms: [] }),
    ).toThrow("non-empty subset of EdDSA, ES256, and RS256");
  });

  it("rejects oversized compact credentials before JOSE parsing or key lookup", async () => {
    const getKey = vi.fn(async () => new Uint8Array(32));
    const verifier = new SupabaseIngressVerifier({
      issuer: "https://project.supabase.co/auth/v1",
      audience: "authenticated",
      getKey,
    });

    await expect(
      verifier.verify(`a.${"b".repeat(16_384)}.c`),
    ).rejects.toMatchObject({ code: "unauthenticated" });
    expect(getKey).not.toHaveBeenCalled();
  });

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
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.principal)).toBe(true);
    expect(Object.isFrozen(result.principal.roles)).toBe(true);
    expect(Object.isFrozen(result.claims)).toBe(true);
    expect(Object.isFrozen(result.claims.app_metadata)).toBe(true);
    expect(result).not.toHaveProperty("token");
  });

  it("rejects an accessor-backed custom principal without invoking it", async () => {
    const { key, cache } = await fixture();
    let principalIdGetterCalls = 0;
    const mappedPrincipal: Record<string, unknown> = {
      principal_type: "developer",
      roles: ["reader"],
      source_issuer: "https://project.supabase.co/auth/v1",
      source_subject: "user-1",
      auth_time: 0,
    };
    Object.defineProperty(mappedPrincipal, "principal_id", {
      enumerable: true,
      get() {
        principalIdGetterCalls += 1;
        return "developer-1";
      },
    });
    const verifier = new SupabaseIngressVerifier({
      issuer: "https://project.supabase.co/auth/v1",
      audience: "authenticated",
      getKey: cache.getKey,
      mapPrincipal: () => mappedPrincipal as never,
    });
    await expect(
      verifier.verify(await sign(key.privateKey)),
    ).rejects.toMatchObject({ code: "unauthenticated" });
    expect(principalIdGetterCalls).toBe(0);
  });

  it("rejects a signed token from a different JWT media type", async () => {
    const { key, verifier } = await fixture();
    await expect(
      verifier.verify(await sign(key.privateKey, {}, "at+jwt")),
    ).rejects.toMatchObject({ code: "unauthenticated" });
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
      .setProtectedHeader({ alg: "ES256", kid: "supabase-1", typ: "JWT" })
      .setIssuer("https://project.supabase.co/auth/v1")
      .setAudience("service_role")
      .setIssuedAt(now)
      .setExpirationTime(now + 60)
      .sign(key.privateKey);
    await expect(verifier.verify(wrongAudience)).rejects.toMatchObject({
      code: "unauthenticated",
    });

    const wrongIssuer = await new SignJWT({ sub: "user-1" })
      .setProtectedHeader({ alg: "ES256", kid: "supabase-1", typ: "JWT" })
      .setIssuer("https://attacker.invalid/auth/v1")
      .setAudience("authenticated")
      .setIssuedAt(now)
      .setExpirationTime(now + 60)
      .sign(key.privateKey);
    await expect(verifier.verify(wrongIssuer)).rejects.toMatchObject({
      code: "unauthenticated",
    });

    const expired = await new SignJWT({ sub: "user-1" })
      .setProtectedHeader({ alg: "ES256", kid: "supabase-1", typ: "JWT" })
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

  it.each(["sub", "iat", "exp"] as const)(
    "rejects a signed credential with missing %s",
    async (missingClaim) => {
      const { key, verifier } = await fixture();
      const now = Math.floor(Date.now() / 1_000);
      const claims: Record<string, string | number> = {
        sub: "user-1",
        iat: now,
        exp: now + 60,
      };
      delete claims[missingClaim];
      const token = await new SignJWT(claims)
        .setProtectedHeader({ alg: "ES256", kid: "supabase-1", typ: "JWT" })
        .setIssuer("https://project.supabase.co/auth/v1")
        .setAudience("authenticated")
        .sign(key.privateKey);

      await expect(verifier.verify(token)).rejects.toMatchObject({
        code: "unauthenticated",
      });
    },
  );
});
