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
