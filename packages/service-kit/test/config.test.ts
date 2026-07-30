import { describe, expect, it } from "vitest";

import {
  assertServiceRuntimeConfig,
  loadServiceRuntimeConfig,
  requiresProductionDependenciesV1,
  ServiceConfigError,
} from "../src/index.js";

describe("service runtime config", () => {
  it("loads documented defaults and exact environment overrides", () => {
    expect(
      loadServiceRuntimeConfig(
        { port: 3001 },
        {
          PORT: "4101",
          HOST: "0.0.0.0",
          PAI_LOG_LEVEL: "debug",
          PAI_DEPLOYMENT_ENVIRONMENT: "staging",
          PAI_RELEASE_CHANNEL: "canary",
        },
      ),
    ).toMatchObject({
      port: 4101,
      host: "0.0.0.0",
      log_level: "debug",
      deployment_environment: "staging",
      release_channel: "canary",
    });
  });

  it.each([
    [{ PORT: "3001junk" }, "PORT must be an integer"],
    [{ PAI_LOG_LEVEL: "verbose" }, "/log_level"],
    [{ PAI_SHUTDOWN_GRACE_MS: "999" }, "/shutdown_grace_ms"],
    [{ PAI_DEPLOYMENT_ENVIRONMENT: "production" }, "/deployment_environment"],
  ])("fails startup for invalid config %#", (env, expected) => {
    expect(() => loadServiceRuntimeConfig({ port: 3001 }, env)).toThrow(expected);
  });

  it("keeps the typed config object strict", () => {
    expect(() =>
      assertServiceRuntimeConfig({
        host: "127.0.0.1",
        port: 3001,
        log_level: "info",
        request_timeout_ms: 30_000,
        readiness_timeout_ms: 2_000,
        shutdown_grace_ms: 10_000,
        deployment_environment: "local",
        release_channel: "stable",
        invented_key: true,
      }),
    ).toThrow(ServiceConfigError);
  });

  it("snapshots config from own data properties without invoking accessors", () => {
    let getterCalls = 0;
    const config = {
      host: "127.0.0.1",
      port: 3001,
      log_level: "info",
      request_timeout_ms: 30_000,
      readiness_timeout_ms: 2_000,
      shutdown_grace_ms: 10_000,
      deployment_environment: "local",
      release_channel: "stable",
    } as Record<string, unknown>;
    Object.defineProperty(config, "port", {
      configurable: true,
      enumerable: true,
      get() {
        getterCalls += 1;
        return 3001;
      },
    });
    expect(() => assertServiceRuntimeConfig(config)).toThrow(ServiceConfigError);
    expect(getterCalls).toBe(0);

    const loaded = loadServiceRuntimeConfig({ port: 3001 }, {});
    expect(Object.isFrozen(loaded)).toBe(true);
  });

  it("requires strong dependencies for every production-like authority signal", () => {
    expect(
      requiresProductionDependenciesV1({
        PAI_DEPLOYMENT_ENVIRONMENT: "staging",
      }),
    ).toBe(true);
    expect(
      requiresProductionDependenciesV1({
        PAI_DEPLOYMENT_ENVIRONMENT: "prod",
      }),
    ).toBe(true);
    expect(requiresProductionDependenciesV1({ NODE_ENV: "production" })).toBe(
      true,
    );
    expect(
      requiresProductionDependenciesV1({
        PAI_DEPLOYMENT_ENVIRONMENT: "local",
        NODE_ENV: "development",
      }),
    ).toBe(false);
  });
});
