export type MetaDownstreamNameV1 = "memory" | "knowthat" | "skill";
export type MetaPartialFailureModeV1 = "blocking" | "nonblocking";

export interface MetaCognitionConfigV1 {
  readonly lease_ttl_ms: number;
  readonly heartbeat_interval_ms: number;
  readonly takeover_grace_ms: number;
  readonly llm_call_timeout_ms: number;
  readonly memory_write_timeout_ms: number;
  readonly knowthat_write_timeout_ms: number;
  readonly candidate_review_timeout_ms: number;
  readonly outbox_max_attempts: number;
  readonly retry_jitter: "full";
  readonly max_provider_parse_retries: number;
  readonly max_job_attempts: number;
  readonly retry_base_ms: number;
  readonly retry_max_ms: number;
  readonly max_prompt_bytes: number;
  readonly max_output_items: number;
  readonly max_evidence_refs: number;
  readonly downstream_failure_mode: Readonly<
    Record<MetaDownstreamNameV1, MetaPartialFailureModeV1>
  >;
}

export const DEFAULT_META_COGNITION_CONFIG_V1: MetaCognitionConfigV1 =
  Object.freeze({
    lease_ttl_ms: 60_000,
    heartbeat_interval_ms: 20_000,
    takeover_grace_ms: 5_000,
    llm_call_timeout_ms: 120_000,
    memory_write_timeout_ms: 30_000,
    knowthat_write_timeout_ms: 30_000,
    candidate_review_timeout_ms: 30_000,
    outbox_max_attempts: 10,
    retry_jitter: "full",
    max_provider_parse_retries: 2,
    max_job_attempts: 5,
    retry_base_ms: 1_000,
    retry_max_ms: 60_000,
    max_prompt_bytes: 1_048_576,
    max_output_items: 1_000,
    max_evidence_refs: 10_000,
    downstream_failure_mode: Object.freeze({
      memory: "nonblocking",
      knowthat: "blocking",
      skill: "nonblocking",
    }),
  });

const CONFIG_KEYS = Object.freeze([
  "lease_ttl_ms",
  "heartbeat_interval_ms",
  "takeover_grace_ms",
  "llm_call_timeout_ms",
  "memory_write_timeout_ms",
  "knowthat_write_timeout_ms",
  "candidate_review_timeout_ms",
  "outbox_max_attempts",
  "retry_jitter",
  "max_provider_parse_retries",
  "max_job_attempts",
  "retry_base_ms",
  "retry_max_ms",
  "max_prompt_bytes",
  "max_output_items",
  "max_evidence_refs",
  "downstream_failure_mode",
] as const);

function boundedInteger(
  label: string,
  value: number,
  minimum: number,
  maximum: number,
): void {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`Meta Cognition ${label} is outside its supported range`);
  }
}

function snapshotFailureModes(
  value: Readonly<
    Partial<Record<MetaDownstreamNameV1, MetaPartialFailureModeV1>>
  > | undefined,
): MetaCognitionConfigV1["downstream_failure_mode"] {
  if (value === undefined) {
    return DEFAULT_META_COGNITION_CONFIG_V1.downstream_failure_mode;
  }
  const keys = Object.keys(value);
  if (
    keys.some(
      (key) => key !== "memory" && key !== "knowthat" && key !== "skill",
    )
  ) {
    throw new Error("Meta Cognition downstream failure mode has unknown keys");
  }
  const result = {
    ...DEFAULT_META_COGNITION_CONFIG_V1.downstream_failure_mode,
    ...value,
  };
  if (
    Object.values(result).some(
      (mode) => mode !== "blocking" && mode !== "nonblocking",
    )
  ) {
    throw new Error("Meta Cognition downstream failure mode is invalid");
  }
  return Object.freeze(result);
}

export function resolveMetaCognitionConfigV1(
  input: Readonly<
    Partial<
      Omit<MetaCognitionConfigV1, "downstream_failure_mode"> & {
        readonly downstream_failure_mode: Readonly<
          Partial<
            Record<MetaDownstreamNameV1, MetaPartialFailureModeV1>
          >
        >;
      }
    >
  > = {},
): MetaCognitionConfigV1 {
  if (
    Object.keys(input).some(
      (key) => !(CONFIG_KEYS as readonly string[]).includes(key),
    )
  ) {
    throw new Error("Meta Cognition configuration has unknown keys");
  }
  const config: MetaCognitionConfigV1 = {
    ...DEFAULT_META_COGNITION_CONFIG_V1,
    ...input,
    downstream_failure_mode: snapshotFailureModes(
      input.downstream_failure_mode,
    ),
  };
  boundedInteger("lease_ttl_ms", config.lease_ttl_ms, 5_000, 15 * 60_000);
  boundedInteger(
    "heartbeat_interval_ms",
    config.heartbeat_interval_ms,
    250,
    5 * 60_000,
  );
  boundedInteger(
    "takeover_grace_ms",
    config.takeover_grace_ms,
    0,
    5 * 60_000,
  );
  boundedInteger(
    "llm_call_timeout_ms",
    config.llm_call_timeout_ms,
    100,
    10 * 60_000,
  );
  boundedInteger(
    "memory_write_timeout_ms",
    config.memory_write_timeout_ms,
    100,
    5 * 60_000,
  );
  boundedInteger(
    "knowthat_write_timeout_ms",
    config.knowthat_write_timeout_ms,
    100,
    5 * 60_000,
  );
  boundedInteger(
    "candidate_review_timeout_ms",
    config.candidate_review_timeout_ms,
    100,
    5 * 60_000,
  );
  boundedInteger(
    "outbox_max_attempts",
    config.outbox_max_attempts,
    1,
    100,
  );
  boundedInteger(
    "max_provider_parse_retries",
    config.max_provider_parse_retries,
    0,
    3,
  );
  boundedInteger("max_job_attempts", config.max_job_attempts, 1, 20);
  boundedInteger("retry_base_ms", config.retry_base_ms, 100, 60_000);
  boundedInteger("retry_max_ms", config.retry_max_ms, 100, 3_600_000);
  boundedInteger(
    "max_prompt_bytes",
    config.max_prompt_bytes,
    1_024,
    16 * 1_048_576,
  );
  boundedInteger("max_output_items", config.max_output_items, 1, 10_000);
  boundedInteger(
    "max_evidence_refs",
    config.max_evidence_refs,
    1,
    50_000,
  );
  if (
    config.retry_jitter !== "full" ||
    config.heartbeat_interval_ms * 2 >= config.lease_ttl_ms ||
    config.takeover_grace_ms >= config.lease_ttl_ms ||
    config.retry_base_ms > config.retry_max_ms
  ) {
    throw new Error("Meta Cognition configuration cross-constraint failed");
  }
  return Object.freeze(config);
}

function optionalEnvironmentInteger(
  environment: Readonly<Record<string, string | undefined>>,
  key: string,
): number | undefined {
  const value = environment[key];
  if (value === undefined) return undefined;
  if (!/^(?:0|[1-9][0-9]*)$/u.test(value)) {
    throw new Error(`Meta Cognition environment value ${key} is invalid`);
  }
  return Number(value);
}

export function metaCognitionConfigFromEnvironmentV1(
  environment: Readonly<Record<string, string | undefined>>,
): MetaCognitionConfigV1 {
  const values = {
    lease_ttl_ms: optionalEnvironmentInteger(
      environment,
      "PAI_META_LEASE_TTL_MS",
    ),
    heartbeat_interval_ms: optionalEnvironmentInteger(
      environment,
      "PAI_META_HEARTBEAT_INTERVAL_MS",
    ),
    takeover_grace_ms: optionalEnvironmentInteger(
      environment,
      "PAI_META_TAKEOVER_GRACE_MS",
    ),
    llm_call_timeout_ms: optionalEnvironmentInteger(
      environment,
      "PAI_META_LLM_CALL_TIMEOUT_MS",
    ),
    memory_write_timeout_ms: optionalEnvironmentInteger(
      environment,
      "PAI_META_MEMORY_WRITE_TIMEOUT_MS",
    ),
    knowthat_write_timeout_ms: optionalEnvironmentInteger(
      environment,
      "PAI_META_KNOWTHAT_WRITE_TIMEOUT_MS",
    ),
    candidate_review_timeout_ms: optionalEnvironmentInteger(
      environment,
      "PAI_META_CANDIDATE_REVIEW_TIMEOUT_MS",
    ),
    outbox_max_attempts: optionalEnvironmentInteger(
      environment,
      "PAI_META_OUTBOX_MAX_ATTEMPTS",
    ),
    max_provider_parse_retries: optionalEnvironmentInteger(
      environment,
      "PAI_META_PROVIDER_PARSE_RETRIES",
    ),
    max_job_attempts: optionalEnvironmentInteger(
      environment,
      "PAI_META_MAX_JOB_ATTEMPTS",
    ),
    retry_base_ms: optionalEnvironmentInteger(
      environment,
      "PAI_META_RETRY_BASE_MS",
    ),
    retry_max_ms: optionalEnvironmentInteger(
      environment,
      "PAI_META_RETRY_MAX_MS",
    ),
    max_prompt_bytes: optionalEnvironmentInteger(
      environment,
      "PAI_META_MAX_PROMPT_BYTES",
    ),
    max_output_items: optionalEnvironmentInteger(
      environment,
      "PAI_META_MAX_OUTPUT_ITEMS",
    ),
    max_evidence_refs: optionalEnvironmentInteger(
      environment,
      "PAI_META_MAX_EVIDENCE_REFS",
    ),
  };
  return resolveMetaCognitionConfigV1(
    Object.fromEntries(
      Object.entries(values).filter((entry) => entry[1] !== undefined),
    ),
  );
}
