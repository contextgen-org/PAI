import { isProxy } from "node:util/types";

export interface ActionRuntimeConfigV1 {
  readonly run_lease_ttl_seconds: number;
  readonly tool_lease_ttl_seconds: number;
  readonly heartbeat_interval_seconds: number;
  readonly interrupt_timeout_seconds: number;
  readonly control_request_signature_ttl_seconds: number;
  readonly external_reconciliation_timeout_seconds: number;
  readonly skill_cache_ttl_seconds: number;
  readonly skill_revocation_projection_max_staleness_seconds: number;
  readonly tool_timeout_seconds: number;
  readonly retry_max_attempts: number;
  readonly retry_base_backoff_ms: number;
  readonly retry_max_backoff_seconds: number;
  readonly retry_jitter: "none" | "full";
  readonly outbox_batch_size: number;
  readonly outbox_retention_days: number;
}

export const ACTION_RUNTIME_CONFIG_DEFAULTS_V1 =
  Object.freeze<ActionRuntimeConfigV1>({
    run_lease_ttl_seconds: 30,
    tool_lease_ttl_seconds: 60,
    heartbeat_interval_seconds: 5,
    interrupt_timeout_seconds: 15,
    control_request_signature_ttl_seconds: 120,
    external_reconciliation_timeout_seconds: 300,
    skill_cache_ttl_seconds: 300,
    skill_revocation_projection_max_staleness_seconds: 30,
    tool_timeout_seconds: 300,
    retry_max_attempts: 5,
    retry_base_backoff_ms: 500,
    retry_max_backoff_seconds: 30,
    retry_jitter: "full",
    outbox_batch_size: 100,
    outbox_retention_days: 7,
  });

const CONFIG_KEYS_V1 = Object.freeze(
  Object.keys(ACTION_RUNTIME_CONFIG_DEFAULTS_V1) as Array<
    keyof ActionRuntimeConfigV1
  >,
);

const ENV_KEYS_V1 = Object.freeze({
  run_lease_ttl_seconds: "PAI_RUNTIME_RUN_LEASE_TTL_SECONDS",
  tool_lease_ttl_seconds: "PAI_RUNTIME_TOOL_LEASE_TTL_SECONDS",
  heartbeat_interval_seconds: "PAI_RUNTIME_HEARTBEAT_INTERVAL_SECONDS",
  interrupt_timeout_seconds: "PAI_RUNTIME_INTERRUPT_TIMEOUT_SECONDS",
  control_request_signature_ttl_seconds:
    "PAI_RUNTIME_CONTROL_REQUEST_SIGNATURE_TTL_SECONDS",
  external_reconciliation_timeout_seconds:
    "PAI_RUNTIME_EXTERNAL_RECONCILIATION_TIMEOUT_SECONDS",
  skill_cache_ttl_seconds: "PAI_RUNTIME_SKILL_CACHE_TTL_SECONDS",
  skill_revocation_projection_max_staleness_seconds:
    "PAI_RUNTIME_SKILL_REVOCATION_PROJECTION_MAX_STALENESS_SECONDS",
  tool_timeout_seconds: "PAI_RUNTIME_TOOL_TIMEOUT_SECONDS",
  retry_max_attempts: "PAI_RUNTIME_RETRY_MAX_ATTEMPTS",
  retry_base_backoff_ms: "PAI_RUNTIME_RETRY_BASE_BACKOFF_MS",
  retry_max_backoff_seconds: "PAI_RUNTIME_RETRY_MAX_BACKOFF_SECONDS",
  retry_jitter: "PAI_RUNTIME_RETRY_JITTER",
  outbox_batch_size: "PAI_RUNTIME_OUTBOX_BATCH_SIZE",
  outbox_retention_days: "PAI_RUNTIME_OUTBOX_RETENTION_DAYS",
} as const satisfies Readonly<
  Record<keyof ActionRuntimeConfigV1, string>
>);

function ownConfigurationV1(value: unknown): Readonly<Record<string, unknown>> {
  if (value === undefined) return Object.freeze({});
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    isProxy(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  ) {
    throw new Error("Action Runtime configuration must be a plain object");
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const snapshot: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(descriptors)) {
    if (
      typeof key !== "string" ||
      !CONFIG_KEYS_V1.includes(key as keyof ActionRuntimeConfigV1)
    ) {
      throw new Error(`unknown Action Runtime configuration key: ${String(key)}`);
    }
    const descriptor = descriptors[key];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      throw new Error(`Action Runtime configuration ${key} must be own data`);
    }
    snapshot[key] = descriptor.value;
  }
  return Object.freeze(snapshot);
}

function boundedIntegerV1(
  value: unknown,
  minimum: number,
  maximum: number,
  key: keyof ActionRuntimeConfigV1,
): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new Error(
      `Action Runtime configuration ${key} must be an integer from ${minimum} to ${maximum}`,
    );
  }
}

export function resolveActionRuntimeConfigV1(
  value?: unknown,
): Readonly<ActionRuntimeConfigV1> {
  const supplied = ownConfigurationV1(value);
  const config = {
    ...ACTION_RUNTIME_CONFIG_DEFAULTS_V1,
    ...supplied,
  } as ActionRuntimeConfigV1;

  boundedIntegerV1(config.run_lease_ttl_seconds, 15, 120, "run_lease_ttl_seconds");
  boundedIntegerV1(config.tool_lease_ttl_seconds, 15, 300, "tool_lease_ttl_seconds");
  boundedIntegerV1(
    config.heartbeat_interval_seconds,
    1,
    20,
    "heartbeat_interval_seconds",
  );
  boundedIntegerV1(config.interrupt_timeout_seconds, 1, 60, "interrupt_timeout_seconds");
  boundedIntegerV1(
    config.control_request_signature_ttl_seconds,
    30,
    600,
    "control_request_signature_ttl_seconds",
  );
  boundedIntegerV1(
    config.external_reconciliation_timeout_seconds,
    30,
    3_600,
    "external_reconciliation_timeout_seconds",
  );
  boundedIntegerV1(config.skill_cache_ttl_seconds, 30, 3_600, "skill_cache_ttl_seconds");
  boundedIntegerV1(
    config.skill_revocation_projection_max_staleness_seconds,
    1,
    300,
    "skill_revocation_projection_max_staleness_seconds",
  );
  boundedIntegerV1(config.tool_timeout_seconds, 1, 3_600, "tool_timeout_seconds");
  boundedIntegerV1(config.retry_max_attempts, 0, 10, "retry_max_attempts");
  boundedIntegerV1(config.retry_base_backoff_ms, 100, 5_000, "retry_base_backoff_ms");
  boundedIntegerV1(config.retry_max_backoff_seconds, 1, 120, "retry_max_backoff_seconds");
  boundedIntegerV1(config.outbox_batch_size, 1, 1_000, "outbox_batch_size");
  boundedIntegerV1(config.outbox_retention_days, 1, 30, "outbox_retention_days");
  if (config.retry_jitter !== "none" && config.retry_jitter !== "full") {
    throw new Error("Action Runtime configuration retry_jitter must be none or full");
  }
  if (
    config.heartbeat_interval_seconds >=
    Math.min(config.run_lease_ttl_seconds, config.tool_lease_ttl_seconds) / 3
  ) {
    throw new Error(
      "Action Runtime heartbeat_interval_seconds must be less than one third of both lease TTLs",
    );
  }
  if (
    config.retry_base_backoff_ms >
    config.retry_max_backoff_seconds * 1_000
  ) {
    throw new Error(
      "Action Runtime retry_base_backoff_ms must not exceed retry_max_backoff_seconds",
    );
  }
  return Object.freeze({ ...config });
}

function parseIntegerEnvironmentV1(value: string, key: string): number {
  if (!/^(?:0|[1-9][0-9]*)$/u.test(value)) {
    throw new Error(`${key} must be a base-10 integer without a unit suffix`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`${key} exceeds safe integer bounds`);
  return parsed;
}

export function actionRuntimeConfigFromEnvironmentV1(
  env: NodeJS.ProcessEnv,
): Readonly<ActionRuntimeConfigV1> {
  const supplied: Record<string, unknown> = {};
  for (const key of CONFIG_KEYS_V1) {
    const envKey = ENV_KEYS_V1[key];
    const raw = env[envKey];
    if (raw === undefined) continue;
    supplied[key] =
      key === "retry_jitter" ? raw : parseIntegerEnvironmentV1(raw, envKey);
  }
  return resolveActionRuntimeConfigV1(supplied);
}
