import {
  AuthError,
  type VerifiedWorkloadCredential,
  type WorkloadCredentialVerifierPort,
  type WorkloadVerificationRequirements,
} from "@pai/auth";
import { SERVICE_IDS, type WorkloadCredentialClaimsV1 } from "@pai/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createServiceApp,
  getWorkloadAuthContext,
  tryGetWorkloadAuthContext,
} from "../src/index.js";

const TOKEN = "header.payload.signature";
const apps: ReturnType<typeof createServiceApp>[] = [];

function claims(
  overrides: Partial<WorkloadCredentialClaimsV1> = {},
): WorkloadCredentialClaimsV1 {
  const now = Math.floor(Date.now() / 1_000);
  return {
    iss: "pai-workload",
    sub: "action_runtime",
    aud: "memory",
    jti: "test-jti",
    iat: now,
    nbf: now,
    exp: now + 60,
    capability: ["memory.read"],
    scope_kind: "global",
    ...overrides,
  } as WorkloadCredentialClaimsV1;
}

function verifier(
  verify: (
    requirements: WorkloadVerificationRequirements,
  ) => VerifiedWorkloadCredential | Promise<VerifiedWorkloadCredential>,
): WorkloadCredentialVerifierPort {
  return {
    verify: async (_token, requirements) => verify(requirements),
  };
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
});

describe("workload route guard", () => {
  it("defaults to 401 before handlers in all eight services", async () => {
    for (const serviceId of SERVICE_IDS) {
      let handled = false;
      const app = createServiceApp(serviceId);
      apps.push(app);
      app.get("/internal/protected", async () => {
        handled = true;
        return { accepted: true };
      });
      const response = await app.inject({
        method: "GET",
        url: "/internal/protected",
      });
      expect(response.statusCode, serviceId).toBe(401);
      expect(response.json().code, serviceId).toBe("unauthenticated");
      expect(handled, serviceId).toBe(false);
    }
  });

  it("also fail-closes the exact internal route root", async () => {
    let handled = false;
    const app = createServiceApp("memory");
    apps.push(app);
    app.get("/internal", async () => {
      handled = true;
      return { accepted: true };
    });

    const response = await app.inject({ method: "GET", url: "/internal" });

    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe("unauthenticated");
    expect(handled).toBe(false);
  });

  it("does not let a catch-all route bypass the internal fail-closed boundary", async () => {
    let handled = false;
    const app = createServiceApp("memory");
    apps.push(app);
    app.all("/*", async () => {
      handled = true;
      return { accepted: true };
    });

    const response = await app.inject({
      method: "GET",
      url: "/internal/catch-all?source=test",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe("unauthenticated");
    expect(handled).toBe(false);
  });

  it("rejects a runtime policy that omits its required authorization scope", () => {
    expect(() =>
      createServiceApp("memory", {
        auth: {
          policies: [
            {
              method: "GET",
              route: "/internal/unsafe",
              requiredCapabilities: ["memory.read"],
              allowedCallers: ["action_runtime"],
              requiredScope: undefined as never,
            },
          ],
        },
      }),
    ).toThrow("capabilities, callers and scope");
  });

  it("rejects accessor-backed auth policies without invoking their getters", () => {
    let policyGetterCalls = 0;
    const policy = {
      method: "GET",
      route: "/internal/accessor-policy",
      requiredCapabilities: ["memory.read"],
      allowedCallers: ["action_runtime"],
      requiredScope: { scope_kind: "global" },
    } as Record<string, unknown>;
    Object.defineProperty(policy, "allowedCallers", {
      configurable: true,
      enumerable: true,
      get() {
        policyGetterCalls += 1;
        return ["action_runtime"];
      },
    });

    expect(() =>
      createServiceApp("memory", {
        auth: { policies: [policy as never] },
      }),
    ).toThrow("capabilities, callers and scope");
    expect(policyGetterCalls).toBe(0);

    let arrayGetterCalls = 0;
    const capabilities = ["memory.read"];
    Object.defineProperty(capabilities, "0", {
      configurable: true,
      enumerable: true,
      get() {
        arrayGetterCalls += 1;
        return "memory.read";
      },
    });
    expect(() =>
      createServiceApp("memory", {
        auth: {
          policies: [
            {
              method: "GET",
              route: "/internal/accessor-array",
              requiredCapabilities: capabilities,
              allowedCallers: ["action_runtime"],
              requiredScope: { scope_kind: "global" },
            },
          ],
        },
      }),
    ).toThrow("dense own-data array");
    expect(arrayGetterCalls).toBe(0);
  });

  it("rejects an accessor-backed dynamic scope without invoking it", async () => {
    let handled = false;
    let scopeGetterCalls = 0;
    const app = createServiceApp("memory", {
      auth: {
        verifier: verifier(() => ({
          claims: claims({
            scope_kind: "bot",
            workspace_id: "workspace-1",
            bot_id: "bot-1",
            owner_agent_id: "agent-1",
            deployment_environment: "prod",
            release_channel: "stable",
          }),
          protectedHeader: { alg: "EdDSA", kid: "test-key" },
        })),
        policies: [
          {
            method: "GET",
            route: "/internal/accessor-scope",
            requiredCapabilities: ["memory.read"],
            allowedCallers: ["action_runtime"],
            requiredScope: () => {
              const resolved = {
                scope_kind: "bot",
                workspace_id: "workspace-1",
                bot_id: "bot-1",
                owner_agent_id: "agent-1",
                deployment_environment: "prod",
                release_channel: "stable",
              } as Record<string, unknown>;
              Object.defineProperty(resolved, "bot_id", {
                configurable: true,
                enumerable: true,
                get() {
                  scopeGetterCalls += 1;
                  return "bot-1";
                },
              });
              return resolved as never;
            },
          },
        ],
      },
    });
    apps.push(app);
    app.get("/internal/accessor-scope", async () => {
      handled = true;
      return { accepted: true };
    });

    const response = await app.inject({
      method: "GET",
      url: "/internal/accessor-scope",
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().code).toBe("authorization_scope_mismatch");
    expect(handled).toBe(false);
    expect(scopeGetterCalls).toBe(0);
  });

  it("snapshots the verifier instead of following a mutable auth options object", async () => {
    const initialVerify = vi.fn(() => ({
      claims: claims(),
      protectedHeader: { alg: "EdDSA", kid: "initial-key" },
    }));
    const replacementVerify = vi.fn(() => {
      throw new AuthError("unauthenticated", "replacement verifier ran");
    });
    const auth = {
      verifier: verifier(initialVerify),
      policies: [
        {
          method: "GET",
          route: "/internal/snapshotted-verifier" as const,
          requiredCapabilities: ["memory.read"],
          allowedCallers: ["action_runtime" as const],
          requiredScope: { scope_kind: "global" as const },
        },
      ],
    };
    const app = createServiceApp("memory", { auth });
    apps.push(app);
    auth.verifier = verifier(replacementVerify);
    app.get("/internal/snapshotted-verifier", async () => ({ accepted: true }));

    const response = await app.inject({
      method: "GET",
      url: "/internal/snapshotted-verifier",
      headers: { authorization: `Bearer ${TOKEN}` },
    });

    expect(response.statusCode).toBe(200);
    expect(initialVerify).toHaveBeenCalledOnce();
    expect(replacementVerify).not.toHaveBeenCalled();
  });

  it("rejects an accessor-backed verifier method without invoking the getter", () => {
    let getterCalls = 0;
    const accessorVerifier = {} as Record<string, unknown>;
    Object.defineProperty(accessorVerifier, "verify", {
      configurable: true,
      enumerable: true,
      get() {
        getterCalls += 1;
        return async () => ({
          claims: claims(),
          protectedHeader: { alg: "EdDSA", kid: "accessor-key" },
        });
      },
    });

    expect(() =>
      createServiceApp("memory", {
        auth: {
          verifier: accessorVerifier as never,
          policies: [
            {
              method: "GET",
              route: "/internal/accessor-verifier",
              requiredCapabilities: ["memory.read"],
              allowedCallers: ["action_runtime"],
              requiredScope: { scope_kind: "global" },
            },
          ],
        },
      }),
    ).toThrow("must expose an own-data method");
    expect(getterCalls).toBe(0);
  });

  it("snapshots verified claims before an awaited dynamic scope decision", async () => {
    let enterScope!: () => void;
    let releaseScope!: () => void;
    const scopeEntered = new Promise<void>((resolve) => {
      enterScope = resolve;
    });
    const scopeGate = new Promise<void>((resolve) => {
      releaseScope = resolve;
    });
    const mutableClaims = claims({
      scope_kind: "bot",
      workspace_id: "workspace-1",
      bot_id: "bot-original",
      owner_agent_id: "agent-1",
      deployment_environment: "prod",
      release_channel: "stable",
    });
    const mutableCredential: VerifiedWorkloadCredential = {
      claims: mutableClaims,
      protectedHeader: { alg: "EdDSA", kid: "mutable-key", typ: "JWT" },
    };
    let handled = false;
    const app = createServiceApp("memory", {
      auth: {
        verifier: verifier(() => mutableCredential),
        policies: [
          {
            method: "GET",
            route: "/internal/mutable-credential",
            requiredCapabilities: ["memory.read"],
            allowedCallers: ["action_runtime"],
            requiredScope: async () => {
              enterScope();
              await scopeGate;
              return {
                scope_kind: "bot",
                workspace_id: "workspace-1",
                bot_id: "bot-mutated",
                owner_agent_id: "agent-1",
                deployment_environment: "prod",
                release_channel: "stable",
              };
            },
          },
        ],
      },
    });
    apps.push(app);
    app.get("/internal/mutable-credential", async () => {
      handled = true;
      return { accepted: true };
    });

    const pending = app.inject({
      method: "GET",
      url: "/internal/mutable-credential",
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    await scopeEntered;
    (mutableClaims as unknown as Record<string, unknown>).bot_id = "bot-mutated";
    releaseScope();

    const response = await pending;
    expect(response.statusCode).toBe(403);
    expect(response.json().code).toBe("authorization_scope_mismatch");
    expect(handled).toBe(false);
  });

  it("independently rejects a verifier result that violates the route policy", async () => {
    const app = createServiceApp("memory", {
      auth: {
        verifier: verifier(() => ({
          claims: claims({ aud: "action_runtime" }),
          protectedHeader: { alg: "EdDSA", kid: "wrong-audience-key" },
        })),
        policies: [
          {
            method: "GET",
            route: "/internal/wrong-verifier-result",
            requiredCapabilities: ["memory.read"],
            allowedCallers: ["action_runtime"],
            requiredScope: { scope_kind: "global" },
          },
        ],
      },
    });
    apps.push(app);
    app.get("/internal/wrong-verifier-result", async () => ({ accepted: true }));

    const response = await app.inject({
      method: "GET",
      url: "/internal/wrong-verifier-result",
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe("unauthenticated");
  });

  it("passes the exact audience, caller and capability policy to the verifier", async () => {
    const verify = vi.fn((requirements: WorkloadVerificationRequirements) => ({
      claims: claims({ aud: requirements.audience }),
      protectedHeader: { alg: "EdDSA", kid: "test-key" },
    }));
    const app = createServiceApp("memory", {
      auth: {
        verifier: verifier(verify),
        policies: [
          {
            method: "GET",
            route: "/internal/recall",
            requiredCapabilities: ["memory.read"],
            allowedCallers: ["action_runtime"],
            requiredScope: { scope_kind: "global" },
          },
        ],
      },
    });
    apps.push(app);
    app.get("/internal/recall", async (request) => ({
      caller: getWorkloadAuthContext(request).claims.sub,
    }));

    const response = await app.inject({
      method: "GET",
      url: "/internal/recall",
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ caller: "action_runtime" });
    expect(verify).toHaveBeenCalledWith({
      audience: "memory",
      requiredCapabilities: ["memory.read"],
      allowedCallers: ["action_runtime"],
      requiredScope: { scope_kind: "global" },
    });
  });

  it("rejects missing capability and dynamic resource-scope mismatch before handlers", async () => {
    let handled = false;
    const capabilityApp = createServiceApp("memory", {
      auth: {
        verifier: verifier(() => {
          throw new AuthError("capability_denied", "missing capability");
        }),
        policies: [
          {
            method: "POST",
            route: "/internal/write",
            requiredCapabilities: ["memory.write"],
            allowedCallers: ["meta_cognition"],
            requiredScope: { scope_kind: "global" },
          },
        ],
      },
    });
    apps.push(capabilityApp);
    capabilityApp.post("/internal/write", async () => {
      handled = true;
      return { accepted: true };
    });
    const denied = await capabilityApp.inject({
      method: "POST",
      url: "/internal/write",
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(denied.statusCode).toBe(403);
    expect(denied.json().code).toBe("capability_denied");
    expect(handled).toBe(false);

    const scopeApp = createServiceApp("memory", {
      auth: {
        verifier: verifier(() => ({
          claims: claims(),
          protectedHeader: { alg: "EdDSA", kid: "test-key" },
        })),
        policies: [
          {
            method: "GET",
            route: "/internal/bot-memory/:botId",
            requiredCapabilities: ["memory.read"],
            allowedCallers: ["action_runtime"],
            requiredScope: () => ({
              scope_kind: "bot",
              workspace_id: "workspace-1",
              bot_id: "bot-1",
              owner_agent_id: "agent-1",
              deployment_environment: "prod",
              release_channel: "stable",
            }),
          },
        ],
      },
    });
    apps.push(scopeApp);
    scopeApp.get("/internal/bot-memory/:botId", async () => {
      handled = true;
      return { accepted: true };
    });
    const scopeDenied = await scopeApp.inject({
      method: "GET",
      url: "/internal/bot-memory/bot-1",
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(scopeDenied.statusCode).toBe(403);
    expect(scopeDenied.json().code).toBe("authorization_scope_mismatch");
    expect(handled).toBe(false);
  });

  it("retains only the signature-verified credential context on authorization denial", async () => {
    const verifiedCredential: VerifiedWorkloadCredential = {
      claims: claims(),
      protectedHeader: { alg: "EdDSA", kid: "test-key", typ: "JWT" },
    };
    let observed: VerifiedWorkloadCredential | undefined;
    const app = createServiceApp("memory", {
      errorMapper(_error, request) {
        observed = tryGetWorkloadAuthContext(request);
        return undefined;
      },
      auth: {
        verifier: verifier(() => {
          throw new AuthError(
            "authorization_denied",
            "caller is not allowed",
            undefined,
            verifiedCredential,
          );
        }),
        policies: [
          {
            method: "GET",
            route: "/internal/recall",
            requiredCapabilities: ["memory.read"],
            allowedCallers: ["knowthat"],
            requiredScope: { scope_kind: "global" },
          },
        ],
      },
    });
    apps.push(app);
    app.get("/internal/recall", async () => ({ accepted: true }));

    const response = await app.inject({
      method: "GET",
      url: "/internal/recall",
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(response.statusCode).toBe(403);
    expect(observed).toEqual(verifiedCredential);
    expect(JSON.stringify(observed)).not.toContain(TOKEN);
  });

  it("does not expose a rejected credential in logs", async () => {
    const lines: string[] = [];
    const app = createServiceApp("memory", {
      logger: true,
      loggerStream: { write: (line) => lines.push(line) },
      auth: {
        verifier: verifier(() => {
          throw new AuthError("unauthenticated", "bad signature");
        }),
        policies: [
          {
            method: "GET",
            route: "/internal/recall",
            requiredCapabilities: ["memory.read"],
            allowedCallers: ["action_runtime"],
            requiredScope: { scope_kind: "global" },
          },
        ],
      },
    });
    apps.push(app);
    app.get("/internal/recall", async () => ({ accepted: true }));
    await app.inject({
      method: "GET",
      url: "/internal/recall",
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(lines.join("\n")).not.toContain(TOKEN);
    expect(lines.join("\n")).toContain("workload_auth_rejected");
  });
});
