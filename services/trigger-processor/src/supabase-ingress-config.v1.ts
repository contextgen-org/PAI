import {
  JwksCache,
  RemoteJwksProvider,
  SupabaseIngressVerifier,
} from "@pai/auth";

export function createTriggerSupabaseIngressVerifierFromEnvV1(
  env: Readonly<Record<string, string | undefined>>,
): SupabaseIngressVerifier | undefined {
  const issuer = env.PAI_SUPABASE_ISSUER;
  const audience = env.PAI_SUPABASE_AUDIENCE;
  const jwksUrl = env.PAI_SUPABASE_JWKS_URL;
  const configured = [issuer, audience, jwksUrl].some(
    (value) => value !== undefined && value.length > 0,
  );
  if (!configured) return undefined;
  if (
    issuer === undefined ||
    issuer.length === 0 ||
    audience === undefined ||
    audience.length === 0 ||
    jwksUrl === undefined ||
    jwksUrl.length === 0
  ) {
    throw new Error(
      "PAI_SUPABASE_ISSUER, PAI_SUPABASE_AUDIENCE and PAI_SUPABASE_JWKS_URL must be configured together",
    );
  }
  const cache = new JwksCache({
    provider: new RemoteJwksProvider({ url: jwksUrl }),
  });
  return new SupabaseIngressVerifier({
    issuer,
    audience,
    getKey: cache.getKey,
  });
}

export function assertTriggerIngressConfigurationV1(
  admissionEnabled: boolean,
  supabaseIngressVerifier: SupabaseIngressVerifier | undefined,
): void {
  if (admissionEnabled && supabaseIngressVerifier === undefined) {
    throw new Error(
      "PAI_SUPABASE_ISSUER, PAI_SUPABASE_AUDIENCE and PAI_SUPABASE_JWKS_URL are required when Trigger admission is enabled",
    );
  }
}
