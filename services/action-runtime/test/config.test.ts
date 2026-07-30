import { describe, expect, it } from "vitest";

import {
  ACTION_RUNTIME_CONFIG_DEFAULTS_V1,
  actionRuntimeConfigFromEnvironmentV1,
  resolveActionRuntimeConfigV1,
} from "../src/config.v1.js";

describe("Action Runtime documented configuration", () => {
  it("uses the owner-documented defaults", () => {
    expect(resolveActionRuntimeConfigV1()).toEqual(
      ACTION_RUNTIME_CONFIG_DEFAULTS_V1,
    );
  });

  it("loads explicit unit-bearing environment keys", () => {
    expect(
      actionRuntimeConfigFromEnvironmentV1({
        PAI_RUNTIME_RUN_LEASE_TTL_SECONDS: "60",
        PAI_RUNTIME_HEARTBEAT_INTERVAL_SECONDS: "10",
        PAI_RUNTIME_RETRY_JITTER: "none",
      }),
    ).toMatchObject({
      run_lease_ttl_seconds: 60,
      heartbeat_interval_seconds: 10,
      retry_jitter: "none",
    });
  });

  it("rejects unknown keys, unit suffixes, and cross-field contradictions", () => {
    expect(() =>
      resolveActionRuntimeConfigV1({ unknown: 1 }),
    ).toThrow(/unknown Action Runtime configuration key/u);
    expect(() =>
      actionRuntimeConfigFromEnvironmentV1({
        PAI_RUNTIME_TOOL_TIMEOUT_SECONDS: "300s",
      }),
    ).toThrow(/without a unit suffix/u);
    expect(() =>
      resolveActionRuntimeConfigV1({
        run_lease_ttl_seconds: 15,
        heartbeat_interval_seconds: 5,
      }),
    ).toThrow(/less than one third/u);
    expect(() =>
      resolveActionRuntimeConfigV1({
        retry_base_backoff_ms: 5_000,
        retry_max_backoff_seconds: 1,
      }),
    ).toThrow(/must not exceed/u);
  });
});
