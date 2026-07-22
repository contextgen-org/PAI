import { describe, expect, it } from "vitest";

import {
  assertTriggerIngressConfigurationV1,
  createTriggerSupabaseIngressVerifierFromEnvV1,
} from "../src/supabase-ingress-config.v1.js";

describe("Trigger Supabase ingress production configuration", () => {
  it("allows an entirely absent public verifier only while admission is disabled", () => {
    const verifier = createTriggerSupabaseIngressVerifierFromEnvV1({});
    expect(verifier).toBeUndefined();
    expect(() =>
      assertTriggerIngressConfigurationV1(false, verifier),
    ).not.toThrow();
    expect(() =>
      assertTriggerIngressConfigurationV1(true, verifier),
    ).toThrow("PAI_SUPABASE_ISSUER");
  });

  it("rejects partial public JWT configuration before service startup", () => {
    expect(() =>
      createTriggerSupabaseIngressVerifierFromEnvV1({
        PAI_SUPABASE_ISSUER: "https://project.supabase.co/auth/v1",
        PAI_SUPABASE_AUDIENCE: "authenticated",
      }),
    ).toThrow("must be configured together");
  });

  it("constructs the verifier only from the complete issuer/audience/JWKS tuple", () => {
    const verifier = createTriggerSupabaseIngressVerifierFromEnvV1({
      PAI_SUPABASE_ISSUER: "https://project.supabase.co/auth/v1",
      PAI_SUPABASE_AUDIENCE: "authenticated",
      PAI_SUPABASE_JWKS_URL:
        "https://project.supabase.co/auth/v1/.well-known/jwks.json",
    });
    expect(verifier).toBeDefined();
    expect(() =>
      assertTriggerIngressConfigurationV1(true, verifier),
    ).not.toThrow();
  });
});
