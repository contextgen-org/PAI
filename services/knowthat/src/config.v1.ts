import { requiresProductionDependenciesV1 } from "@pai/service-kit";

export interface KnowThatConfigV1 {
  readonly snapshot_hmac_secret: string;
  readonly snapshot_ttl_ms: number;
  readonly replay_revision_window: number;
  readonly linkage_lease_ms: number;
  readonly outbox_lease_ms: number;
  readonly max_linkage_attempts: number;
  readonly max_outbox_attempts: number;
  readonly retry_base_ms: number;
  readonly retry_max_ms: number;
}

export const DEFAULT_KNOWTHAT_CONFIG_V1 = Object.freeze({
  snapshot_hmac_secret: "local-test-only-knowthat-secret-32-bytes",
  snapshot_ttl_ms: 5 * 60_000,
  replay_revision_window: 100,
  linkage_lease_ms: 60_000,
  outbox_lease_ms: 30_000,
  max_linkage_attempts: 8,
  max_outbox_attempts: 12,
  retry_base_ms: 1_000,
  retry_max_ms: 5 * 60_000,
} satisfies KnowThatConfigV1);

function bounded(
  label: string,
  value: number,
  minimum: number,
  maximum: number,
): void {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`KnowThat ${label} is outside its supported range`);
  }
}

export function resolveKnowThatConfigV1(
  input: Partial<KnowThatConfigV1> = {},
): KnowThatConfigV1 {
  const config = { ...DEFAULT_KNOWTHAT_CONFIG_V1, ...input };
  if (Buffer.byteLength(config.snapshot_hmac_secret, "utf8") < 32) {
    throw new Error("KnowThat snapshot HMAC secret is too short");
  }
  bounded("snapshot_ttl_ms", config.snapshot_ttl_ms, 10_000, 3_600_000);
  bounded(
    "replay_revision_window",
    config.replay_revision_window,
    2,
    100_000,
  );
  bounded("linkage_lease_ms", config.linkage_lease_ms, 1_000, 900_000);
  bounded("outbox_lease_ms", config.outbox_lease_ms, 1_000, 900_000);
  bounded("max_linkage_attempts", config.max_linkage_attempts, 1, 100);
  bounded("max_outbox_attempts", config.max_outbox_attempts, 1, 100);
  bounded("retry_base_ms", config.retry_base_ms, 100, 60_000);
  bounded("retry_max_ms", config.retry_max_ms, 100, 3_600_000);
  if (config.retry_base_ms > config.retry_max_ms) {
    throw new Error("KnowThat retry range is invalid");
  }
  return Object.freeze(config);
}

function environmentInteger(
  environment: Readonly<Record<string, string | undefined>>,
  key: string,
): number | undefined {
  const value = environment[key];
  if (value === undefined) return undefined;
  if (!/^[1-9][0-9]*$/u.test(value)) {
    throw new Error(`KnowThat environment value ${key} is invalid`);
  }
  return Number(value);
}

export function knowThatConfigFromEnvironmentV1(
  environment: Readonly<Record<string, string | undefined>>,
): KnowThatConfigV1 {
  const production = requiresProductionDependenciesV1(environment);
  const secret = environment.PAI_KNOWTHAT_SNAPSHOT_HMAC_SECRET;
  if (production && secret === undefined) {
    throw new Error(
      "PAI_KNOWTHAT_SNAPSHOT_HMAC_SECRET is required in production",
    );
  }
  const input = {
    snapshot_hmac_secret:
      secret ?? DEFAULT_KNOWTHAT_CONFIG_V1.snapshot_hmac_secret,
    snapshot_ttl_ms: environmentInteger(
      environment,
      "PAI_KNOWTHAT_SNAPSHOT_TTL_MS",
    ),
    replay_revision_window: environmentInteger(
      environment,
      "PAI_KNOWTHAT_REPLAY_REVISION_WINDOW",
    ),
    linkage_lease_ms: environmentInteger(
      environment,
      "PAI_KNOWTHAT_LINKAGE_LEASE_MS",
    ),
    outbox_lease_ms: environmentInteger(
      environment,
      "PAI_KNOWTHAT_OUTBOX_LEASE_MS",
    ),
    max_linkage_attempts: environmentInteger(
      environment,
      "PAI_KNOWTHAT_MAX_LINKAGE_ATTEMPTS",
    ),
    max_outbox_attempts: environmentInteger(
      environment,
      "PAI_KNOWTHAT_MAX_OUTBOX_ATTEMPTS",
    ),
    retry_base_ms: environmentInteger(
      environment,
      "PAI_KNOWTHAT_RETRY_BASE_MS",
    ),
    retry_max_ms: environmentInteger(
      environment,
      "PAI_KNOWTHAT_RETRY_MAX_MS",
    ),
  };
  return resolveKnowThatConfigV1(
    Object.fromEntries(
      Object.entries(input).filter((entry) => entry[1] !== undefined),
    ),
  );
}
