import type { JSONWebKeySet, JWK } from "jose";
import {
  exportJWK,
  generateKeyPair,
  SignJWT,
} from "jose";
import { describe, expect, it, vi } from "vitest";

import {
  AuthError,
  JwksCache,
  type JwksProvider,
  WorkloadJwtSigner,
  WorkloadJwtVerifier,
  RemoteJwksProvider,
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
  it("does not follow JWKS redirects or accept an oversized key set", async () => {
    const redirectFetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      expect(init?.redirect).toBe("error");
      return new Response(undefined, { status: 302 });
    });
    const redirectProvider = new RemoteJwksProvider({
      url: "https://identity.example/.well-known/jwks.json",
      fetchImpl: redirectFetch as unknown as typeof fetch,
    });
    await expect(redirectProvider.load()).rejects.toThrow("non-success status");

    const oversizedProvider = new RemoteJwksProvider({
      url: "https://identity.example/.well-known/jwks.json",
      fetchImpl: (async () =>
        new Response("x", {
          status: 200,
          headers: { "content-length": "1048577" },
        })) as typeof fetch,
    });
    await expect(oversizedProvider.load()).rejects.toThrow("maximum size");

    const tooManyKeysProvider = new RemoteJwksProvider({
      url: "https://identity.example/.well-known/jwks.json",
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({ keys: Array.from({ length: 129 }, () => ({})) }),
          { status: 200 },
        )) as typeof fetch,
    });
    await expect(tooManyKeysProvider.load()).rejects.toThrow("1 to 128 keys");
    expect(
      () =>
        new RemoteJwksProvider({
          url: "https://user:secret@identity.example/.well-known/jwks.json",
        }),
    ).toThrow("cannot contain credentials");
    expect(
      () =>
        new RemoteJwksProvider({
          url: "https://identity.example/.well-known/jwks.json#stale",
        }),
    ).toThrow("fragment");
    expect(
      () =>
        new RemoteJwksProvider({
          url: "https://identity.example/.well-known/jwks.json?tenant=confused",
        }),
    ).toThrow("a query");
  });

  it("bounds JWKS cache and network timing configuration", () => {
    const provider: JwksProvider = { load: async () => ({ keys: [] }) };
    for (const maxAgeMs of [0, 3_600_001, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => new JwksCache({ provider, maxAgeMs })).toThrow(
        "1 to 3600000",
      );
    }
    for (const unknownKidRefreshCooldownMs of [
      0,
      60_001,
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      expect(
        () => new JwksCache({ provider, unknownKidRefreshCooldownMs }),
      ).toThrow("1 to 60000");
    }
    for (const timeoutMs of [0, 30_001, Number.MAX_SAFE_INTEGER + 1]) {
      expect(
        () =>
          new RemoteJwksProvider({
            url: "https://identity.example/.well-known/jwks.json",
            timeoutMs,
          }),
      ).toThrow("1 to 30000");
    }
  });

  it("captures JWKS policy without invoking accessors or later method swaps", async () => {
    let providerGetterCalls = 0;
    const accessorOptions: Record<string, unknown> = {};
    Object.defineProperty(accessorOptions, "provider", {
      enumerable: true,
      get() {
        providerGetterCalls += 1;
        return { load: async () => ({ keys: [] }) };
      },
    });
    expect(() => new JwksCache(accessorOptions as never)).toThrow(
      "options are invalid",
    );
    expect(providerGetterCalls).toBe(0);

    const key = await keyFixture("captured-provider");
    let trustedLoads = 0;
    let swappedLoads = 0;
    const provider: JwksProvider = {
      load: async () => {
        trustedLoads += 1;
        return { keys: [key.publicJwk] };
      },
    };
    const cache = new JwksCache({ provider });
    provider.load = async () => {
      swappedLoads += 1;
      return { keys: [] };
    };
    const signer = new WorkloadJwtSigner({
      subject: "action_runtime",
      privateKey: key.privateKey,
      keyId: "captured-provider",
      algorithm: "EdDSA",
    });
    const verifier = new WorkloadJwtVerifier({ getKey: cache.getKey });
    await expect(
      verifier.verify(await signer.sign(globalInput()), {
        audience: "memory",
        requiredCapabilities: ["memory.read"],
      }),
    ).resolves.toBeDefined();
    expect(trustedLoads).toBe(1);
    expect(swappedLoads).toBe(0);
  });

  it("rejects unsafe verifier algorithms and clock tolerance", () => {
    const getKey = async () => new Uint8Array(32);

    expect(
      () =>
        new WorkloadJwtVerifier({
          getKey,
          algorithms: ["HS256" as never],
        }),
    ).toThrow("non-empty subset of EdDSA, ES256, and RS256");
    expect(
      () => new WorkloadJwtVerifier({ getKey, algorithms: [] }),
    ).toThrow("non-empty subset of EdDSA, ES256, and RS256");

    for (const clockToleranceSeconds of [-1, 1.5, 6, Number.NaN]) {
      expect(
        () => new WorkloadJwtVerifier({ getKey, clockToleranceSeconds }),
      ).toThrow("integer from 0 to 5 seconds");
    }
    expect(
      () => new WorkloadJwtVerifier({ getKey, clockToleranceSeconds: 5 }),
    ).not.toThrow();
  });

  it("rejects accessor-backed verifier and signer policy without executing it", async () => {
    let getKeyGetterCalls = 0;
    const verifierOptions: Record<string, unknown> = {};
    Object.defineProperty(verifierOptions, "getKey", {
      enumerable: true,
      get() {
        getKeyGetterCalls += 1;
        return async () => new Uint8Array(32);
      },
    });
    expect(
      () => new WorkloadJwtVerifier(verifierOptions as never),
    ).toThrow("options are invalid");
    expect(getKeyGetterCalls).toBe(0);

    const key = await keyFixture("accessor-options");
    let keyIdGetterCalls = 0;
    const signerOptions: Record<string, unknown> = {
      subject: "action_runtime",
      privateKey: key.privateKey,
      algorithm: "EdDSA",
    };
    Object.defineProperty(signerOptions, "keyId", {
      enumerable: true,
      get() {
        keyIdGetterCalls += 1;
        return "accessor-options";
      },
    });
    expect(
      () => new WorkloadJwtSigner(signerOptions as never),
    ).toThrow("options are invalid");
    expect(keyIdGetterCalls).toBe(0);
  });

  it("enforces signer runtime algorithms, identity, key and input bounds", async () => {
    const key = await keyFixture("workload-1");
    const validOptions = {
      subject: "action_runtime" as const,
      privateKey: key.privateKey,
      keyId: "workload-1",
      algorithm: "EdDSA" as const,
    };

    for (const algorithm of ["HS256", "none"]) {
      expect(
        () =>
          new WorkloadJwtSigner({
            ...validOptions,
            algorithm: algorithm as never,
          }),
      ).toThrow("workload signing options are invalid");
    }
    expect(
      () =>
        new WorkloadJwtSigner({
          ...validOptions,
          subject: "attacker_service" as never,
        }),
    ).toThrow("workload signing options are invalid");
    expect(
      () =>
        new WorkloadJwtSigner({
          ...validOptions,
          privateKey: key.publicKey as never,
        }),
    ).toThrow("workload signing options are invalid");
    expect(
      () =>
        new WorkloadJwtSigner({
          ...validOptions,
          privateKey: new Uint8Array(32) as never,
        }),
    ).toThrow("workload signing options are invalid");
    for (const keyId of ["", "contains whitespace", "k".repeat(257), 123]) {
      expect(
        () => new WorkloadJwtSigner({ ...validOptions, keyId: keyId as never }),
      ).toThrow("workload signing options are invalid");
    }

    const signer = new WorkloadJwtSigner(validOptions);
    await expect(
      signer.sign({
        ...globalInput(),
        capabilities: Array.from(
          { length: 65 },
          (_, index) => `memory.capability_${index}`,
        ),
      }),
    ).rejects.toThrow("from 1 to 64");
    await expect(
      signer.sign({
        ...globalInput(),
        capabilities: ["INVALID CAPABILITY"],
      }),
    ).rejects.toThrow("bounded capability names");
    await expect(
      signer.sign({
        ...globalInput(),
        capabilities: undefined as never,
      }),
    ).rejects.toThrow("from 1 to 64");
    for (const jti of ["", "contains whitespace", "j".repeat(257), 123]) {
      await expect(signer.sign({ ...globalInput(), jti: jti as never })).rejects.toThrow(
        "jti is invalid",
      );
    }
    await expect(
      signer.sign({
        ...globalInput(),
        scope: {
          scope_kind: "global",
          sub: "memory",
          aud: "knowthat",
          capability: ["knowthat.write"],
        } as never,
      }),
    ).rejects.toThrow("authorization scope is invalid");

    for (const invalidNow of [
      -1,
      1.5,
      Number.NaN,
      Date.now(),
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      const invalidClockSigner = new WorkloadJwtSigner({
        ...validOptions,
        now: () => invalidNow,
      });
      await expect(invalidClockSigner.sign(globalInput())).rejects.toThrow(
        "bounded epoch second",
      );
    }
  });

  it("rejects oversized compact credentials before JOSE parsing or key lookup", async () => {
    const getKey = vi.fn(async () => new Uint8Array(32));
    const verifier = new WorkloadJwtVerifier({ getKey });

    await expect(
      verifier.verify(`a.${"b".repeat(16_384)}.c`, {
        audience: "memory",
        requiredCapabilities: ["memory.read"],
      }),
    ).rejects.toMatchObject({ code: "unauthenticated" });
    expect(getKey).not.toHaveBeenCalled();
  });

  it("never reports authorization evidence from an unverified key resolver", async () => {
    const verifier = new WorkloadJwtVerifier({
      getKey: async () => {
        throw new AuthError("capability_denied", "resolver must not authorize");
      },
    });

    await expect(
      verifier.verify("eyJhbGciOiJFZERTQSIsImtpZCI6ImZvcmdlZCIsInR5cCI6IkpXVCJ9.e30.AA", {
        audience: "memory",
        requiredCapabilities: ["memory.read"],
      }),
    ).rejects.toMatchObject({
      code: "unauthenticated",
      verifiedCredential: undefined,
    });
  });

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
    expect(Object.isFrozen(verified)).toBe(true);
    expect(Object.isFrozen(verified.claims)).toBe(true);
    expect(Object.isFrozen(verified.claims.capability)).toBe(true);
    expect(Object.isFrozen(verified.protectedHeader)).toBe(true);
  });

  it("snapshots delegated signing input before async crypto and returns frozen claims", async () => {
    const key = await keyFixture("delegated-snapshot");
    const signer = new WorkloadJwtSigner({
      subject: "action_runtime",
      privateKey: key.privateKey,
      keyId: "delegated-snapshot",
      algorithm: "EdDSA",
    });
    const verifier = await verifierFor({ keys: [key.publicJwk] });
    const roles = ["member"];
    const delegatedPrincipal = {
      principal_type: "user" as const,
      principal_id: "user-original",
      roles,
      source_issuer: "https://project.supabase.co/auth/v1",
      source_subject: "user-original",
      auth_time: Math.floor(Date.now() / 1_000),
      scope_kind: "bot" as const,
      workspace_id: "workspace-1",
      bot_id: "bot-1",
      owner_agent_id: "agent-1",
      deployment_environment: "prod" as const,
      release_channel: "stable" as const,
    };
    const pendingToken = signer.sign({
      audience: "memory",
      capabilities: ["memory.read"],
      scope: {
        scope_kind: "bot",
        workspace_id: "workspace-1",
        bot_id: "bot-1",
        owner_agent_id: "agent-1",
        deployment_environment: "prod",
        release_channel: "stable",
      },
      delegatedPrincipal,
    });
    delegatedPrincipal.principal_id = "attacker";
    roles[0] = "admin";
    const verified = await verifier.verify(await pendingToken, {
      audience: "memory",
      requiredCapabilities: ["memory.read"],
    });
    expect(verified.claims.delegated_principal).toMatchObject({
      principal_id: "user-original",
      roles: ["member"],
    });
    expect(Object.isFrozen(verified.claims.delegated_principal)).toBe(true);
    expect(
      Object.isFrozen(verified.claims.delegated_principal?.roles),
    ).toBe(true);
  });

  it("snapshots authorization requirements before asynchronous key lookup", async () => {
    const key = await keyFixture("workload-requirements-snapshot");
    const signer = new WorkloadJwtSigner({
      subject: "action_runtime",
      privateKey: key.privateKey,
      keyId: "workload-requirements-snapshot",
      algorithm: "EdDSA",
    });
    let releaseKeyLookup!: () => void;
    const keyLookupBlocked = new Promise<void>((resolve) => {
      releaseKeyLookup = resolve;
    });
    let keyLookupStarted!: () => void;
    const keyLookupObserved = new Promise<void>((resolve) => {
      keyLookupStarted = resolve;
    });
    const verifier = new WorkloadJwtVerifier({
      getKey: async () => {
        keyLookupStarted();
        await keyLookupBlocked;
        return key.publicKey;
      },
    });
    const token = await signer.sign(globalInput());
    const allowedCallers = ["knowthat"];
    const requiredCapabilities = ["memory.write"];
    const requiredScope: Record<string, unknown> = {
      scope_kind: "bot",
      workspace_id: "workspace-1",
      bot_id: "bot-1",
      owner_agent_id: "agent-1",
      deployment_environment: "prod",
      release_channel: "stable",
    };
    const requirements = {
      audience: "memory",
      allowedCallers,
      requiredCapabilities,
      requiredScope,
    };

    const pending = verifier.verify(token, requirements as never);
    await keyLookupObserved;
    allowedCallers[0] = "action_runtime";
    requiredCapabilities[0] = "memory.read";
    for (const key of Object.keys(requiredScope)) delete requiredScope[key];
    requiredScope.scope_kind = "global";
    releaseKeyLookup();

    await expect(pending).rejects.toMatchObject({
      code: "authorization_denied",
    });
  });

  it("rejects accessor-backed authorization scope instead of reading it twice", async () => {
    const key = await keyFixture("workload-accessor-scope");
    const signer = new WorkloadJwtSigner({
      subject: "action_runtime",
      privateKey: key.privateKey,
      keyId: "workload-accessor-scope",
      algorithm: "EdDSA",
    });
    const scope = {
      scope_kind: "bot",
      bot_id: "bot-1",
      owner_agent_id: "agent-1",
      deployment_environment: "prod",
      release_channel: "stable",
    } as Record<string, unknown>;
    Object.defineProperty(scope, "workspace_id", {
      enumerable: true,
      get: () => "workspace-1",
    });

    await expect(
      signer.sign({ ...globalInput(), scope: scope as never }),
    ).rejects.toThrow("authorization scope is invalid");
  });

  it("rejects a signed token from a different JWT media type", async () => {
    const key = await keyFixture("workload-1");
    const verifier = await verifierFor({ keys: [key.publicJwk] });
    const now = Math.floor(Date.now() / 1_000);
    const token = await new SignJWT({
      iss: "pai-workload",
      sub: "action_runtime",
      aud: "memory",
      jti: "cross-jwt-confusion",
      iat: now,
      nbf: now - 1,
      exp: now + 60,
      capability: ["memory.read"],
      scope_kind: "global",
    })
      .setProtectedHeader({
        alg: "EdDSA",
        kid: "workload-1",
        typ: "at+jwt",
      })
      .sign(key.privateKey);

    await expect(
      verifier.verify(token, {
        audience: "memory",
        requiredCapabilities: ["memory.read"],
      }),
    ).rejects.toMatchObject({ code: "unauthenticated" });
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

    const error = await verifier.verify(token, requirements).then(
      () => undefined,
      (value: unknown) => value,
    );
    expect(error).toBeInstanceOf(AuthError);
    expect(error).toMatchObject({ code });
    if (!(error instanceof AuthError)) throw new Error("expected AuthError");
    if (code === "unauthenticated") {
      expect(error.verifiedCredential).toBeUndefined();
    } else {
      expect(error.verifiedCredential).toMatchObject({
        claims: {
          sub: "action_runtime",
          aud: "memory",
          jti: expect.any(String),
        },
        protectedHeader: { kid: "workload-1" },
      });
      expect(JSON.stringify(error.verifiedCredential)).not.toContain(token);
    }
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
      .setProtectedHeader({ alg: "EdDSA", kid: "workload-1", typ: "JWT" })
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
      .setProtectedHeader({ alg: "EdDSA", kid: "workload-1", typ: "JWT" })
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

  it("backs off failed JWKS refreshes without accepting an expired key set", async () => {
    const key = await keyFixture("trusted");
    const signer = new WorkloadJwtSigner({
      subject: "action_runtime",
      privateKey: key.privateKey,
      keyId: "trusted",
      algorithm: "EdDSA",
    });
    const token = await signer.sign(globalInput());
    const requirements = {
      audience: "memory" as const,
      requiredCapabilities: ["memory.read"],
    };
    let clockMs = 1_000;
    let loads = 0;
    let providerAvailable = false;
    const cache = new JwksCache({
      provider: {
        load: () => {
          loads += 1;
          if (!providerAvailable) throw new Error("identity provider unavailable");
          return Promise.resolve({ keys: [key.publicJwk] });
        },
      },
      maxAgeMs: 100,
      now: () => clockMs,
    });
    const verifier = new WorkloadJwtVerifier({ getKey: cache.getKey });

    await Promise.all(
      Array.from({ length: 20 }, () =>
        expect(verifier.verify(token, requirements)).rejects.toMatchObject({
          code: "unauthenticated",
        }),
      ),
    );
    expect(loads).toBe(1);

    for (let attempt = 0; attempt < 20; attempt += 1) {
      await expect(verifier.verify(token, requirements)).rejects.toMatchObject({
        code: "unauthenticated",
      });
    }
    expect(loads).toBe(1);

    clockMs += 249;
    await expect(verifier.verify(token, requirements)).rejects.toMatchObject({
      code: "unauthenticated",
    });
    expect(loads).toBe(1);

    clockMs += 1;
    await expect(verifier.verify(token, requirements)).rejects.toMatchObject({
      code: "unauthenticated",
    });
    expect(loads).toBe(2);

    clockMs += 499;
    await expect(verifier.verify(token, requirements)).rejects.toMatchObject({
      code: "unauthenticated",
    });
    expect(loads).toBe(2);

    providerAvailable = true;
    clockMs += 1;
    await expect(verifier.verify(token, requirements)).resolves.toBeDefined();
    expect(loads).toBe(3);

    providerAvailable = false;
    clockMs += 101;
    await expect(verifier.verify(token, requirements)).rejects.toMatchObject({
      code: "unauthenticated",
    });
    expect(loads).toBe(4);

    providerAvailable = true;
    clockMs += 249;
    await expect(verifier.verify(token, requirements)).rejects.toMatchObject({
      code: "unauthenticated",
    });
    expect(loads).toBe(4);

    clockMs += 1;
    await expect(verifier.verify(token, requirements)).resolves.toBeDefined();
    expect(loads).toBe(5);
  });

  it("fails closed on an invalid cache clock and refreshes after clock rollback", async () => {
    const oldKey = await keyFixture("old");
    const newKey = await keyFixture("new");
    let clockMs = 1_000;
    let loads = 0;
    let active: JSONWebKeySet = { keys: [oldKey.publicJwk] };
    const cache = new JwksCache({
      provider: {
        load: async () => {
          loads += 1;
          return active;
        },
      },
      maxAgeMs: 10_000,
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
    const newToken = await newSigner.sign(globalInput());

    await expect(verifier.verify(oldToken, requirements)).resolves.toBeDefined();
    expect(loads).toBe(1);

    clockMs = Number.NaN;
    await expect(verifier.verify(oldToken, requirements)).rejects.toMatchObject({
      code: "unauthenticated",
    });
    expect(loads).toBe(1);

    active = { keys: [newKey.publicJwk] };
    clockMs = 900;
    await expect(verifier.verify(newToken, requirements)).resolves.toBeDefined();
    expect(loads).toBe(2);
  });

  it("recovers unknown-kid rotation after refresh failure backoff", async () => {
    const oldKey = await keyFixture("old");
    const newKey = await keyFixture("new");
    let clockMs = 1_000;
    let loads = 0;
    let active: JSONWebKeySet | undefined = { keys: [oldKey.publicJwk] };
    const cache = new JwksCache({
      provider: {
        load: async () => {
          loads += 1;
          if (active === undefined) throw new Error("identity provider unavailable");
          return active;
        },
      },
      maxAgeMs: 10_000,
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
    const newToken = await newSigner.sign(globalInput());

    await expect(verifier.verify(oldToken, requirements)).resolves.toBeDefined();
    expect(loads).toBe(1);

    active = undefined;
    await expect(verifier.verify(newToken, requirements)).rejects.toMatchObject({
      code: "unauthenticated",
    });
    expect(loads).toBe(2);

    clockMs += 99;
    await expect(verifier.verify(newToken, requirements)).rejects.toMatchObject({
      code: "unauthenticated",
    });
    expect(loads).toBe(2);

    active = { keys: [oldKey.publicJwk, newKey.publicJwk] };
    clockMs += 151;
    await expect(verifier.verify(newToken, requirements)).resolves.toBeDefined();
    await expect(verifier.verify(oldToken, requirements)).resolves.toBeDefined();
    expect(loads).toBe(3);
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
