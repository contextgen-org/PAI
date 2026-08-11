import { constants as fsConstants } from "node:fs";
import { access, mkdir } from "node:fs/promises";

import {
  openVerifiedOwnerPostgresCompositionV1,
  type VerifiedOwnerPostgresCompositionV1,
} from "@pai/persistence";

import type { ActionRuntimeApplicationsV1 } from "./app.js";
import { ClaudeAgentSdkRuntimeAdapter } from "./claude-agent-sdk-runtime-adapter.v1.js";
import {
  actionRuntimeConfigFromEnvironmentV1,
  type ActionRuntimeConfigV1,
} from "./config.v1.js";
import { ACTION_RUNTIME_REPOSITORY_CONTRACT_V1 } from "./db/permission-manifest.v1.js";
import { createPostgresRuntimeEventOwnerRepositoryV1 } from "./db/runtime-event-read-repository.v1.js";
import { createPostgresRuntimeExecutionStoreV1 } from "./db/postgres-runtime-execution-store.v1.js";
import { createPostgresRuntimeQueryRepositoryV1 } from "./db/runtime-query-repository.v1.js";
import { createPostgresRuntimeToolPermissionProfilePortV1 } from "./db/runtime-tool-permission-profile-port.v1.js";
import { createPostgresToolPermissionProfileCurrentReadRepositoryV1 } from "./db/tool-permission-profile-current-read-repository.v1.js";
import {
  createActionRuntimeHttpPortsV1,
  createActionRuntimeWorkloadSignerFromEnvV1,
} from "./production-http-ports.v1.js";
import { openActionRuntimeObjectStoreV1 } from "./production-object-store.v1.js";
import { createActionRuntimeFinalResultObjectAccessPolicyV1 } from "./production-final-result-object-access-policy.v1.js";
import { createActionRuntimeCallbackV1 } from "./production-runtime-callback.v1.js";
import {
  createActionRuntimeToolPortV1,
  type AgentCoreWebToolsOptionsV1,
  type PersonalAssistantMcpToolNameV1,
  type PersonalAssistantMcpToolsOptionsV1,
} from "./production-tool-port.v1.js";
import { createRuntimeControlTokenVerifierFromEnvV1 } from "./runtime-control-token-verifier.v1.js";
import { createRuntimeEventReadApplicationV1 } from "./runtime-event-read.v1.js";
import { createRuntimeFinalResultReadApplicationV1 } from "./runtime-final-result-read.v1.js";
import { createRuntimeExecutionApplicationV1 } from "./runtime-execution.v1.js";
import { createRuntimeQueryApplicationV1 } from "./runtime-query.v1.js";
import { openRedisRuntimeTokenLiveBusV1 } from "./runtime-token-live-bus.v1.js";
import { createRuntimeTokenStreamApplicationV1 } from "./runtime-token-stream.v1.js";
import {
  createActionRuntimeWorkerV1,
  createPostgresRuntimeExecutionQueueV1,
} from "./runtime-worker.v1.js";
import { openActionRuntimeSkillProjectionRuntimeV1 } from "./skill-security-projection-runtime.v1.js";
import { createPostgresRuntimeSkillSecurityProjectionV1 } from "./skill-security-projection.v1.js";
import { createToolPermissionProfileCurrentReadApplicationV1 } from "./tool-permission-profile-current-read.v1.js";

export interface ProductionActionRuntimeCompositionOptionsV1 {
  readonly deployment_environment: "local" | "dev" | "staging" | "prod";
  readonly release_channel: "stable" | "canary";
  readonly env?: NodeJS.ProcessEnv;
}

export interface ProductionActionRuntimeCompositionV1 {
  readonly applications: ActionRuntimeApplicationsV1;
  readonly readiness_checks: readonly Readonly<{
    name: string;
    check(signal: AbortSignal): Promise<void>;
  }>[];
  start(): void;
  close(): Promise<void>;
}

function requiredEnvV1(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.includes("\u0000")
  ) {
    throw new Error(`${key} is required`);
  }
  return value;
}

function optionalIntegerV1(
  env: NodeJS.ProcessEnv,
  key: string,
  minimum: number,
  maximum: number,
): number | undefined {
  const raw = env[key];
  if (raw === undefined) return undefined;
  if (!/^(?:0|[1-9][0-9]*)$/u.test(raw)) {
    throw new Error(`${key} must be an unsigned base-10 integer`);
  }
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${key} is outside its supported range`);
  }
  return parsed;
}

function requiredIntegerV1(
  env: NodeJS.ProcessEnv,
  key: string,
  minimum: number,
  maximum: number,
): number {
  const value = optionalIntegerV1(env, key, minimum, maximum);
  if (value === undefined) throw new Error(`${key} is required`);
  return value;
}

function optionalPositiveNumberV1(
  env: NodeJS.ProcessEnv,
  key: string,
): number | undefined {
  const raw = env[key];
  if (raw === undefined) return undefined;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${key} must be a positive finite number`);
  }
  return parsed;
}

const DEEPSEEK_ANTHROPIC_BASE_URL_V1 =
  "https://api.deepseek.com/anthropic";

function nonemptySecretV1(env: NodeJS.ProcessEnv, key: string): string {
  const value = requiredEnvV1(env, key);
  if (value.length < 16 || value.length > 16_384 || /[\r\n]/u.test(value)) {
    throw new Error(`${key} is invalid`);
  }
  return value;
}

/**
 * AgentCore is deliberately opt-in.  Supplying any part of its connection
 * configuration without the rest is a startup error, rather than silently
 * downgrading an authorized web tool to a different network path.
 */
export function agentCoreWebToolsFromEnvironmentV1(
  env: NodeJS.ProcessEnv,
): Readonly<AgentCoreWebToolsOptionsV1> | undefined {
  const endpoint = env.PAI_AGENTCORE_MCP_URL?.trim() || undefined;
  const bearerToken = env.PAI_AGENTCORE_MCP_BEARER_TOKEN || undefined;
  if (endpoint === undefined && bearerToken === undefined) {
    return undefined;
  }
  if (endpoint === undefined) {
    throw new Error("PAI_AGENTCORE_MCP_URL is required when AgentCore web tools are configured");
  }
  if (bearerToken === undefined) {
    throw new Error("PAI_AGENTCORE_MCP_BEARER_TOKEN is required when AgentCore web tools are configured");
  }
  return Object.freeze({
    mcp_url: endpoint,
    bearer_token: bearerToken,
    tools: Object.freeze({
      search: env.PAI_AGENTCORE_WEB_SEARCH_TOOL_NAME?.trim() || "web_search",
      fetch: env.PAI_AGENTCORE_WEB_FETCH_TOOL_NAME?.trim() || "web_fetch",
      browser: env.PAI_AGENTCORE_WEB_BROWSER_TOOL_NAME?.trim() || "web_browser",
    }),
  });
}

/**
 * The personal-assistant bridge is opt-in and deliberately accepts only a
 * fixed PAI logical-tool map.  Its bearer token is consumed here by Action
 * Runtime, never sent to the model, browser, permission profile, or chat UI.
 */
export function personalAssistantMcpToolsFromEnvironmentV1(
  env: NodeJS.ProcessEnv,
): Readonly<PersonalAssistantMcpToolsOptionsV1> | undefined {
  const endpoint = env.PAI_PERSONAL_ASSISTANT_MCP_URL?.trim() || undefined;
  const bearerToken = env.PAI_PERSONAL_ASSISTANT_MCP_BEARER_TOKEN || undefined;
  const rawMapping = env.PAI_PERSONAL_ASSISTANT_MCP_TOOLS_JSON?.trim() || undefined;
  if (
    endpoint === undefined &&
    bearerToken === undefined &&
    rawMapping === undefined
  ) {
    return undefined;
  }
  if (endpoint === undefined) {
    throw new Error("PAI_PERSONAL_ASSISTANT_MCP_URL is required when personal assistant tools are configured");
  }
  if (bearerToken === undefined) {
    throw new Error("PAI_PERSONAL_ASSISTANT_MCP_BEARER_TOKEN is required when personal assistant tools are configured");
  }
  if (rawMapping === undefined) {
    throw new Error("PAI_PERSONAL_ASSISTANT_MCP_TOOLS_JSON is required when personal assistant tools are configured");
  }
  let mapping: unknown;
  try {
    mapping = JSON.parse(rawMapping);
  } catch {
    throw new Error("PAI_PERSONAL_ASSISTANT_MCP_TOOLS_JSON must be a JSON object");
  }
  if (
    typeof mapping !== "object" ||
    mapping === null ||
    Array.isArray(mapping)
  ) {
    throw new Error("PAI_PERSONAL_ASSISTANT_MCP_TOOLS_JSON must be a JSON object");
  }
  const tools: Partial<Record<PersonalAssistantMcpToolNameV1, string>> = {};
  for (const [logicalName, remoteName] of Object.entries(mapping)) {
    if (typeof remoteName !== "string") {
      throw new Error("PAI_PERSONAL_ASSISTANT_MCP_TOOLS_JSON values must be strings");
    }
    tools[logicalName as PersonalAssistantMcpToolNameV1] = remoteName;
  }
  return Object.freeze({
    mcp_url: endpoint,
    bearer_token: bearerToken,
    tools: Object.freeze(tools),
  });
}

export function providerEnvironmentV1(
  env: NodeJS.ProcessEnv,
): Readonly<Record<string, string>> {
  const provider = env.PAI_RUNTIME_PROVIDER ?? "anthropic";
  if (provider !== "anthropic" && provider !== "deepseek") {
    throw new Error("PAI_RUNTIME_PROVIDER must be anthropic or deepseek");
  }
  if (provider === "deepseek") {
    const deepseekKey = nonemptySecretV1(env, "DEEPSEEK_API_KEY");
    const configuredToken = env.ANTHROPIC_AUTH_TOKEN;
    if (
      configuredToken !== undefined &&
      configuredToken !== deepseekKey
    ) {
      throw new Error(
        "ANTHROPIC_AUTH_TOKEN must be unset or equal DEEPSEEK_API_KEY for DeepSeek",
      );
    }
    const configuredBaseUrl = env.ANTHROPIC_BASE_URL;
    if (
      configuredBaseUrl !== undefined &&
      configuredBaseUrl !== DEEPSEEK_ANTHROPIC_BASE_URL_V1
    ) {
      throw new Error(
        "ANTHROPIC_BASE_URL must be the DeepSeek Anthropic compatibility endpoint",
      );
    }
    if (env.ANTHROPIC_API_KEY !== undefined) {
      throw new Error(
        "ANTHROPIC_API_KEY must be unset when PAI_RUNTIME_PROVIDER=deepseek",
      );
    }
    const isolated: Record<string, string> = {
      ANTHROPIC_AUTH_TOKEN: deepseekKey,
      ANTHROPIC_BASE_URL: DEEPSEEK_ANTHROPIC_BASE_URL_V1,
    };
    for (const key of [
      "HTTPS_PROXY",
      "HTTP_PROXY",
      "NO_PROXY",
      "NODE_EXTRA_CA_CERTS",
      "PATH",
      "SSL_CERT_FILE",
    ] as const) {
      const value = env[key];
      if (value !== undefined) isolated[key] = value;
    }
    if (isolated.PATH === undefined) {
      throw new Error("PATH is required for the isolated Claude Agent SDK subprocess");
    }
    return Object.freeze(isolated);
  }
  const keys = [
    "ANTHROPIC_API_KEY",
    "ANTHROPIC_AUTH_TOKEN",
    "ANTHROPIC_BASE_URL",
    "HTTPS_PROXY",
    "HTTP_PROXY",
    "NO_PROXY",
    "NODE_EXTRA_CA_CERTS",
    "PATH",
    "SSL_CERT_FILE",
  ] as const;
  const result: Record<string, string> = {};
  for (const key of keys) {
    const value = env[key];
    if (value !== undefined) result[key] = value;
  }
  if (
    result.ANTHROPIC_API_KEY === undefined &&
    result.ANTHROPIC_AUTH_TOKEN === undefined
  ) {
    throw new Error("ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN is required");
  }
  if (result.PATH === undefined) {
    throw new Error("PATH is required for the isolated Claude Agent SDK subprocess");
  }
  return Object.freeze(result);
}

type ActionRuntimePostgresCompositionV1 =
  VerifiedOwnerPostgresCompositionV1<
    typeof ACTION_RUNTIME_REPOSITORY_CONTRACT_V1
  >;

export async function openProductionActionRuntimeCompositionV1(
  options: ProductionActionRuntimeCompositionOptionsV1,
): Promise<ProductionActionRuntimeCompositionV1> {
  const env = options.env ?? process.env;
  const config: Readonly<ActionRuntimeConfigV1> =
    actionRuntimeConfigFromEnvironmentV1(env);
  const databaseUrl = requiredEnvV1(env, "PAI_DATABASE_URL");
  const redisUrl = requiredEnvV1(env, "PAI_REDIS_URL");
  const streamEpoch = requiredEnvV1(env, "PAI_EVENT_STREAM_EPOCH");
  const streamGeneration = requiredIntegerV1(
    env,
    "PAI_EVENT_STREAM_GENERATION",
    1,
    Number.MAX_SAFE_INTEGER,
  );
  const workerId = requiredEnvV1(env, "PAI_ACTION_RUNTIME_WORKER_ID");
  const skillProjectionConsumer = requiredEnvV1(
    env,
    "PAI_ACTION_RUNTIME_SKILL_PROJECTION_CONSUMER",
  );
  const callbackEpoch = requiredEnvV1(
    env,
    "PAI_RUNTIME_CALLBACK_TRANSPORT_EPOCH",
  );
  const callbackGeneration = requiredIntegerV1(
    env,
    "PAI_RUNTIME_CALLBACK_TRANSPORT_GENERATION",
    1,
    Number.MAX_SAFE_INTEGER,
  );
  const triggerProcessorUrl = requiredEnvV1(
    env,
    "PAI_TRIGGER_PROCESSOR_URL",
  );
  const skillRegistryUrl = requiredEnvV1(env, "PAI_SKILL_REGISTRY_URL");
  const memoryUrl = requiredEnvV1(env, "PAI_MEMORY_URL");
  const timerUrl = requiredEnvV1(env, "PAI_TIMER_URL");
  const sandboxCwd = requiredEnvV1(env, "PAI_RUNTIME_SANDBOX_CWD");
  const model = requiredEnvV1(env, "PAI_RUNTIME_MODEL");
  const reconcilerDatabaseUrl = requiredEnvV1(
    env,
    "PAI_OBJECT_STORE_RECONCILER_DATABASE_URL",
  );
  const supabaseUrl = requiredEnvV1(env, "PAI_SUPABASE_URL");
  const supabaseSecretKey = requiredEnvV1(
    env,
    "PAI_SUPABASE_SECRET_KEY",
  );
  const finalResultObjectAccessSecret = requiredEnvV1(
    env,
    "PAI_ACTION_RUNTIME_OBJECT_ACCESS_HMAC_SECRET",
  );
  const requestTimeoutMs = optionalIntegerV1(
    env,
    "PAI_RUNTIME_INTERNAL_REQUEST_TIMEOUT_MS",
    100,
    300_000,
  );
  const agentCoreWebTools = agentCoreWebToolsFromEnvironmentV1(env);
  const personalAssistantMcpTools = personalAssistantMcpToolsFromEnvironmentV1(env);
  await mkdir(sandboxCwd, { recursive: true, mode: 0o700 });
  await access(
    sandboxCwd,
    fsConstants.R_OK | fsConstants.W_OK | fsConstants.X_OK,
  );

  let postgres: ActionRuntimePostgresCompositionV1 | undefined;
  let tokenBus: Awaited<
    ReturnType<typeof openRedisRuntimeTokenLiveBusV1>
  > | undefined;
  let objectStore: Awaited<
    ReturnType<typeof openActionRuntimeObjectStoreV1>
  > | undefined;
  let skillProjectionRuntime: Awaited<
    ReturnType<typeof openActionRuntimeSkillProjectionRuntimeV1>
  > | undefined;
  let runtimeWorker: ReturnType<typeof createActionRuntimeWorkerV1> | undefined;
  let started = false;
  let closed = false;

  const closeV1 = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    await runtimeWorker?.close().catch(() => undefined);
    await skillProjectionRuntime?.close().catch(() => undefined);
    await tokenBus?.close().catch(() => undefined);
    await objectStore?.close().catch(() => undefined);
    await postgres?.close().catch(() => undefined);
  };

  try {
    postgres = await openVerifiedOwnerPostgresCompositionV1(
      ACTION_RUNTIME_REPOSITORY_CONTRACT_V1,
      databaseUrl,
    );
    // Runtime events are not Redis consumer messages. This service owns the
    // outbox through the fenced, workload-authenticated Trigger callback
    // below; starting the generic owner dispatcher would ACK the row before
    // Trigger durably appends the process snapshot.
    tokenBus = await openRedisRuntimeTokenLiveBusV1(redisUrl);
    const signer = createActionRuntimeWorkloadSignerFromEnvV1(env);
    const httpPorts = createActionRuntimeHttpPortsV1({
      trigger_processor_url: triggerProcessorUrl,
      skill_registry_url: skillRegistryUrl,
      signer,
      ...(requestTimeoutMs === undefined
        ? {}
        : { request_timeout_ms: requestTimeoutMs }),
    });
    const tools = createActionRuntimeToolPortV1({
      memory_url: memoryUrl,
      timer_url: timerUrl,
      signer,
      ...(agentCoreWebTools === undefined
        ? {}
        : { agentcore_web: agentCoreWebTools }),
      ...(personalAssistantMcpTools === undefined
        ? {}
        : { personal_assistant_mcp: personalAssistantMcpTools }),
      ...(requestTimeoutMs === undefined
        ? {}
        : { request_timeout_ms: requestTimeoutMs }),
    });
    const callback = createActionRuntimeCallbackV1({
      trigger_processor_url: triggerProcessorUrl,
      signer,
      worker_id: `${workerId}:callback`,
      lease_seconds: config.run_lease_ttl_seconds,
      transport_epoch: callbackEpoch,
      transport_generation: callbackGeneration,
      ...(requestTimeoutMs === undefined
        ? {}
        : { request_timeout_ms: requestTimeoutMs }),
    });
    const finalResultObjectAccess =
      createActionRuntimeFinalResultObjectAccessPolicyV1({
        postgres: postgres.postgres,
        hmac_secret: finalResultObjectAccessSecret,
      });
    objectStore = await openActionRuntimeObjectStoreV1({
      database_url: databaseUrl,
      reconciler_database_url: reconcilerDatabaseUrl,
      supabase_url: supabaseUrl,
      supabase_secret_key: supabaseSecretKey,
      worker_id: `${workerId}:object-store`,
      access_policy: finalResultObjectAccess,
    });
    const projection = createPostgresRuntimeSkillSecurityProjectionV1({
      postgres: postgres.postgres,
      stream_epoch: streamEpoch,
      stream_generation: streamGeneration,
      maximum_staleness_seconds:
        config.skill_revocation_projection_max_staleness_seconds,
    });
    skillProjectionRuntime = await openActionRuntimeSkillProjectionRuntimeV1({
      redis_url: redisUrl,
      deployment_environment: options.deployment_environment,
      release_channel: options.release_channel,
      stream_epoch: streamEpoch,
      stream_generation: streamGeneration,
      projection,
      consumer_name: skillProjectionConsumer,
    });
    const maxSdkTurns = optionalIntegerV1(
      env,
      "PAI_RUNTIME_MAX_SDK_TURNS",
      1,
      1_000,
    );
    const maxBudgetUsd = optionalPositiveNumberV1(
      env,
      "PAI_RUNTIME_MAX_BUDGET_USD",
    );
    const adapter = new ClaudeAgentSdkRuntimeAdapter({
      model,
      sandbox_cwd: sandboxCwd,
      provider_env: providerEnvironmentV1(env),
      ...(maxSdkTurns === undefined ? {} : { max_sdk_turns: maxSdkTurns }),
      ...(maxBudgetUsd === undefined
        ? {}
        : { max_budget_usd: maxBudgetUsd }),
      token_publisher: tokenBus.publisher,
    });
    const store = createPostgresRuntimeExecutionStoreV1(postgres);
    const queue = createPostgresRuntimeExecutionQueueV1(postgres.postgres);
    const execution = createRuntimeExecutionApplicationV1(
      {
        store,
        reservation: httpPorts.reservation,
        control_tokens: createRuntimeControlTokenVerifierFromEnvV1(env),
        context_snapshots: httpPorts.context_snapshots,
        policy_checkpoints: projection.policy_checkpoints,
        profiles: createPostgresRuntimeToolPermissionProfilePortV1(
          postgres.postgres,
        ),
        adapter,
        tools,
        skills: httpPorts.skills,
        object_store: objectStore.object_store,
        callback,
      },
      {
        max_retry_attempts: config.retry_max_attempts,
        retry_base_backoff_ms: config.retry_base_backoff_ms,
        retry_max_backoff_ms: config.retry_max_backoff_seconds * 1_000,
        retry_jitter: config.retry_jitter,
        tool_timeout_ms: config.tool_timeout_seconds * 1_000,
        heartbeat_interval_ms: config.heartbeat_interval_seconds * 1_000,
      },
    );
    runtimeWorker = createActionRuntimeWorkerV1({
      execution,
      queue,
      worker_id: workerId,
      run_lease_seconds: config.run_lease_ttl_seconds,
      callback_batch_size: config.outbox_batch_size,
      artifact_lease_seconds: config.tool_lease_ttl_seconds,
      on_execution_error(failure) {
        // Only the opaque run id, classified code, and retry bit are emitted:
        // the original error can contain provider or database details.
        console.error(
          JSON.stringify({
            event: "runtime_worker_execution_failed",
            service_id: "action_runtime",
            ...failure,
          }),
        );
      },
      on_cycle_error(failure) {
        // Keep background recovery failures observable without exposing raw
        // database, provider, or object-store error contents.
        console.error(
          JSON.stringify({
            event: "runtime_worker_cycle_failed",
            service_id: "action_runtime",
            ...failure,
          }),
        );
      },
    });
    const runtimeQuery = createRuntimeQueryApplicationV1(
      createPostgresRuntimeQueryRepositoryV1(postgres.postgres),
    );
    const runtimeTokenStream = createRuntimeTokenStreamApplicationV1(
      runtimeQuery,
      tokenBus.source,
    );
    const applications: ActionRuntimeApplicationsV1 = Object.freeze({
      tool_permission_profile_current_read:
        createToolPermissionProfileCurrentReadApplicationV1(
          createPostgresToolPermissionProfileCurrentReadRepositoryV1(
            postgres.postgres,
          ),
        ),
      runtime_event_read: createRuntimeEventReadApplicationV1(
        createPostgresRuntimeEventOwnerRepositoryV1(postgres.postgres),
      ),
      runtime_execution: execution,
      runtime_final_result_read: createRuntimeFinalResultReadApplicationV1({
        store,
        object_store: objectStore.object_store,
        access_policy: finalResultObjectAccess,
      }),
      runtime_execution_readiness: Object.freeze({
        async checkReadiness(signal: AbortSignal): Promise<void> {
          await Promise.all([
            store.checkReadiness(signal),
            httpPorts.checkReadiness(signal),
            tools.checkReadiness(signal),
            callback.checkReadiness(signal),
            objectStore!.checkReadiness(signal),
            skillProjectionRuntime!.checkReadiness(signal),
            runtimeWorker!.checkReadiness(signal),
          ]);
          await access(
            sandboxCwd,
            fsConstants.R_OK | fsConstants.W_OK | fsConstants.X_OK,
          );
          signal.throwIfAborted();
        },
      }),
      runtime_query: runtimeQuery,
      runtime_token_stream: runtimeTokenStream,
    });
    const readinessChecks = Object.freeze([
      Object.freeze({ name: "owner_postgres", check: postgres.checkReadiness }),
    ]);
    return Object.freeze({
      applications,
      readiness_checks: readinessChecks,
      start() {
        if (started || closed) return;
        started = true;
        objectStore!.start();
        skillProjectionRuntime!.start();
        runtimeWorker!.start();
      },
      close: closeV1,
    });
  } catch (error) {
    await closeV1();
    throw error;
  }
}
