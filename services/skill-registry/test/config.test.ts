import { describe, expect, it } from "vitest";

import {
  resolveSkillRegistryConfigV1,
  SKILL_REGISTRY_CONFIG_DEFAULTS_V1,
} from "../src/config.v1.js";

describe("Skill Registry configuration", () => {
  it("resolves the documented defaults", () => {
    expect(resolveSkillRegistryConfigV1()).toEqual(
      SKILL_REGISTRY_CONFIG_DEFAULTS_V1,
    );
  });

  it.each([
    [{ unknown_key: 1 }, /unknown/u],
    [{ package_max_bytes: 31_457_281 }, /package_max_bytes/u],
    [{ catalog_page_size: 501 }, /catalog_page_size/u],
    [{ signed_content_token_ttl_seconds: 301 }, /signed_content/u],
    [{ max_runtime_policy_lifetime_ms: 86_400_001 }, /fixed/u],
    [
      { package_max_bytes: 16_384, manifest_max_bytes: 16_384 },
      /must be less/u,
    ],
    [
      {
        signed_content_token_ttl_seconds: 300,
        content_cache_ttl_seconds: 299,
      },
      /must not exceed/u,
    ],
  ])("fails closed for invalid or contradictory configuration %#", (value, pattern) => {
    expect(() => resolveSkillRegistryConfigV1(value)).toThrow(pattern);
  });

  it("rejects Proxy and hidden configuration before invoking traps", () => {
    let reads = 0;
    const proxied = new Proxy(
      { catalog_page_size: 10 },
      {
        getPrototypeOf() {
          reads += 1;
          throw new Error("prototype trap must not run");
        },
        ownKeys() {
          reads += 1;
          throw new Error("ownKeys trap must not run");
        },
      },
    );
    expect(() => resolveSkillRegistryConfigV1(proxied)).toThrow(
      /plain object/u,
    );
    expect(reads).toBe(0);

    const hidden = {};
    Object.defineProperty(hidden, "catalog_page_size", {
      enumerable: false,
      value: 10,
    });
    expect(() => resolveSkillRegistryConfigV1(hidden)).toThrow(
      /data value/u,
    );
  });
});
