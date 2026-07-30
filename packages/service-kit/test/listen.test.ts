import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createServiceApp,
  shutdownService,
  startService,
  type InternalRouteAuthPolicy,
} from "../src/index.js";

const apps = [] as ReturnType<typeof createServiceApp>[];

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
});

describe("graceful shutdown", () => {
  it("closes normally before the deadline", async () => {
    const app = createServiceApp("skill_registry");
    const close = vi.spyOn(app, "close");
    expect(await shutdownService(app, 1_000, "test")).toBe("closed");
    expect(close).toHaveBeenCalledOnce();
  });

  it("forces connection closure when the deadline is exceeded", async () => {
    const app = createServiceApp("timer_trigger_app");
    apps.push(app);
    const originalClose = app.close.bind(app);
    const close = vi
      .spyOn(app, "close")
      .mockImplementation(async () => new Promise<void>(() => undefined));

    expect(await shutdownService(app, 5, "test-timeout")).toBe("forced");
    close.mockRestore();
    await originalClose();
    apps.splice(apps.indexOf(app), 1);
  });
});

describe("service startup workload verifier requirements", () => {
  const internalPolicy = {
    method: "POST",
    route: "/internal/v1/example",
    requiredCapabilities: ["example.write"],
    allowedCallers: ["trigger_processor"],
    requiredScope: {
      scope_kind: "bot",
      workspace_id: "workspace-1",
      bot_id: "bot-1",
      owner_agent_id: "agent-1",
      deployment_environment: "local",
      release_channel: "stable",
    },
  } as const satisfies InternalRouteAuthPolicy;

  it("fails closed by default when internal routes have no workload verifier", async () => {
    const buildApp = vi.fn(() => createServiceApp("trigger_processor"));
    await expect(
      startService({
        serviceId: "trigger_processor",
        defaultPort: 3001,
        env: {},
        internalRouteAuthPolicies: [internalPolicy],
        buildApp,
      }),
    ).rejects.toThrow("PAI_WORKLOAD_JWKS_URL");
    expect(buildApp).not.toHaveBeenCalled();
  });

  it("honors an explicit workload verifier requirement without internal policies", async () => {
    const buildApp = vi.fn(() => createServiceApp("trigger_processor"));
    await expect(
      startService({
        serviceId: "trigger_processor",
        defaultPort: 3001,
        env: {},
        internalRouteAuthPolicies: [],
        requireWorkloadVerifier: true,
        buildApp,
      }),
    ).rejects.toThrow("PAI_WORKLOAD_JWKS_URL");
    expect(buildApp).not.toHaveBeenCalled();
  });

  it("cannot disable verifier enforcement in a production-like environment", async () => {
    const buildApp = vi.fn(() => createServiceApp("trigger_processor"));
    await expect(
      startService({
        serviceId: "trigger_processor",
        defaultPort: 3001,
        env: {
          PAI_DEPLOYMENT_ENVIRONMENT: "staging",
        },
        internalRouteAuthPolicies: [],
        requireWorkloadVerifier: false,
        buildApp,
      }),
    ).rejects.toThrow("PAI_WORKLOAD_JWKS_URL");
    expect(buildApp).not.toHaveBeenCalled();
  });

  it("can explicitly defer verifier enforcement for local no-DB smoke paths", async () => {
    const signalInstall = vi
      .spyOn(process, "once")
      .mockReturnValue(process);
    const app = {
      listen: vi.fn(async () => undefined),
    };
    try {
      await expect(
        startService({
          serviceId: "trigger_processor",
          defaultPort: 3001,
          env: {},
          internalRouteAuthPolicies: [internalPolicy],
          requireWorkloadVerifier: false,
          buildApp: vi.fn(() => app as never),
        }),
      ).resolves.toBeUndefined();
      expect(app.listen).toHaveBeenCalledOnce();
    } finally {
      signalInstall.mockRestore();
    }
  });
});
