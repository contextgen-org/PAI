import type { VerifiedOwnerPostgresCompositionV1 } from "@pai/persistence";

import { metaCognitionConfigFromEnvironmentV1 } from "./config.v1.js";
import {
  DeepSeekClaudeAgentStructuredProviderTransportV1,
  deepSeekClaudeAgentMetaProviderConfigFromEnvironmentV1,
} from "./deepseek-claude-agent-structured-provider.v1.js";
import {
  createPostgresMetaJobRepositoryV1,
} from "./db/postgres-meta-job-repository.v1.js";
import {
  createPostgresMetaJobWorkerCandidateSourceV1,
} from "./db/postgres-meta-job-worker-candidates.v1.js";
import { META_COGNITION_REPOSITORY_CONTRACT_V1 } from "./db/permission-manifest.v1.js";
import { createMetaJobApplicationV1, type MetaJobApplicationV1 } from "./meta-job-application.v1.js";
import { createMetaJobWorkerV1, type MetaJobWorkerV1 } from "./meta-job-worker.v1.js";
import {
  createMetaProductionHttpPortsV1,
  createMetaWorkloadSignerFromEnvV1,
} from "./production-http-ports.v1.js";
import { createStructuredMetaProviderAdapterV1 } from "./structured-provider.v1.js";

type MetaPostgresCompositionV1 = VerifiedOwnerPostgresCompositionV1<
  typeof META_COGNITION_REPOSITORY_CONTRACT_V1
>;

const META_PRODUCTION_COMPOSITION_ENVIRONMENT_KEYS_V1 = Object.freeze([
  "PAI_TRIGGER_PROCESSOR_URL",
  "PAI_MEMORY_URL",
  "PAI_KNOWTHAT_URL",
  "PAI_WORKLOAD_SIGNING_PRIVATE_KEY_PEM",
  "PAI_WORKLOAD_SIGNING_KEY_ID",
  "PAI_WORKLOAD_SIGNING_ALGORITHM",
  "PAI_META_WORKER_ID",
  "PAI_META_LLM_MODEL",
  "PAI_META_LLM_SDK_CWD",
] as const);

export { META_PRODUCTION_COMPOSITION_ENVIRONMENT_KEYS_V1 };

function requiredEnvV1(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${key} is required for Meta production composition`);
  }
  return value;
}

function optionalBoundedIntegerV1(
  env: NodeJS.ProcessEnv,
  key: string,
  minimum: number,
  maximum: number,
): number | undefined {
  const raw = env[key];
  if (raw === undefined) return undefined;
  if (!/^(?:0|[1-9][0-9]*)$/u.test(raw)) {
    throw new Error(`${key} must be an unsigned integer`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${key} is outside its supported range`);
  }
  return value;
}

/**
 * The Meta runtime is composed only from durable owner state and signed
 * service ports.  There is deliberately no in-memory or anonymous fallback:
 * a configured PostgreSQL runtime without this complete environment fails at
 * process construction, before it can accept or claim work.
 */
export function createMetaProductionCompositionV1(
  postgresComposition: MetaPostgresCompositionV1,
  env: NodeJS.ProcessEnv,
): Readonly<{
  application: MetaJobApplicationV1;
  worker: MetaJobWorkerV1;
}> {
  const config = metaCognitionConfigFromEnvironmentV1(env);
  const internalRequestTimeoutMs = optionalBoundedIntegerV1(
    env,
    "PAI_META_INTERNAL_REQUEST_TIMEOUT_MS",
    100,
    300_000,
  );
  const pollIntervalMs = optionalBoundedIntegerV1(
    env,
    "PAI_META_WORKER_POLL_INTERVAL_MS",
    100,
    60_000,
  );
  const batchSize = optionalBoundedIntegerV1(
    env,
    "PAI_META_WORKER_BATCH_SIZE",
    1,
    100,
  );
  const repository = createPostgresMetaJobRepositoryV1(postgresComposition);
  const ports = createMetaProductionHttpPortsV1({
    trigger_processor_url: requiredEnvV1(env, "PAI_TRIGGER_PROCESSOR_URL"),
    memory_url: requiredEnvV1(env, "PAI_MEMORY_URL"),
    knowthat_url: requiredEnvV1(env, "PAI_KNOWTHAT_URL"),
    signer: createMetaWorkloadSignerFromEnvV1(env),
    read_meta_job: repository.readJob,
    ...(internalRequestTimeoutMs === undefined
      ? {}
      : { request_timeout_ms: internalRequestTimeoutMs }),
  });
  const providerConfig = deepSeekClaudeAgentMetaProviderConfigFromEnvironmentV1(env);
  const provider = createStructuredMetaProviderAdapterV1(
    new DeepSeekClaudeAgentStructuredProviderTransportV1(providerConfig),
    undefined,
    {
      timeout_ms: config.llm_call_timeout_ms,
      max_parse_retries: config.max_provider_parse_retries,
      max_output_items: config.max_output_items,
      max_evidence_refs: config.max_evidence_refs,
    },
  );
  const application = createMetaJobApplicationV1(
    {
      repository,
      snapshot_resolver: ports.snapshot_resolver,
      provider,
      memory: ports.memory,
      knowthat: ports.knowthat,
    },
    config,
  );
  const worker = createMetaJobWorkerV1({
    application,
    candidates: createPostgresMetaJobWorkerCandidateSourceV1(
      postgresComposition,
      config.takeover_grace_ms,
    ),
    worker_id: requiredEnvV1(env, "PAI_META_WORKER_ID"),
    ...(pollIntervalMs === undefined ? {} : { poll_interval_ms: pollIntervalMs }),
    ...(batchSize === undefined ? {} : { batch_size: batchSize }),
  });
  return Object.freeze({ application, worker });
}
