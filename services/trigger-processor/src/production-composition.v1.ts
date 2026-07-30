import { constants as fsConstants } from "node:fs";
import { access } from "node:fs/promises";

import {
  openOwnerCommandDispatchRuntimeFromEnvV1,
  openOwnerEventDispatchRuntimeFromEnvV1,
} from "@pai/eventing";
import {
  openVerifiedOwnerPostgresCompositionV1,
  ownerDatabaseApplicationDependenciesV1,
  type VerifiedOwnerPostgresCompositionV1,
} from "@pai/persistence";

import type { TriggerProcessorInternalApplicationsV1 } from "./app.js";
import {
  createAcceptedTriggerConfirmationVerifierV1,
  createTriggerConfirmationResponseApplicationV1,
} from "./application/confirmation.v1.js";
import {
  createContextSnapshotReadApplicationV1,
} from "./application/context-snapshot-read.v1.js";
import {
  createContextSnapshotResolverV1,
} from "./application/context-snapshot-resolver.v1.js";
import {
  createObjectStoreTriggerProcessSnapshotMaterializerV1,
} from "./application/process-snapshot-object-store-materializer.v1.js";
import {
  createTriggerProcessSnapshotReadApplicationV1,
} from "./application/process-snapshot-read.v1.js";
import {
  createTriggerLifecycleApplicationV1,
} from "./application/trigger-lifecycle.v1.js";
import {
  createTriggerProcessLifecycleRecoveryHandlerV1,
  createTriggerProcessRecoveryRunnerV1,
  createTriggerProcessRecoveryWorkerV1,
  createTriggerProcessSnapshotRepairHandlerV1,
} from "./application/trigger-recovery.v1.js";
import { createRuntimeStartReservationValidationApplicationV1 } from "./application/runtime-start-reservation-validation.v1.js";
import { createTriggerAdmissionApplicationV1 } from "./application/trigger-admission.v1.js";
import { createTriggerProcessControlApplicationV1 } from "./application/process-control.v1.js";
import { createTriggerProcessObservationApplicationV1 } from "./application/process-observation.v1.js";
import { createTriggerConfirmationReadRepositoryV1 } from "./db/confirmation-read-repository.v1.js";
import { createContextSnapshotCanonicalReferenceRepositoryV1 } from "./db/context-snapshot-canonical-reference-repository.v1.js";
import { createTriggerContextOwnerSourcePortV1 } from "./db/context-source-owner-repository.v1.js";
import { createTriggerProcessObservationRepositoryV1 } from "./db/process-observation-repository.v1.js";
import { createTriggerProcessSnapshotMetadataRepositoryV1 } from "./db/process-snapshot-metadata-repository.v1.js";
import { createTriggerProcessSnapshotRetentionRepositoryV1 } from "./db/process-snapshot-retention-repository.v1.js";
import { createRuntimeStartReservationValidationRepositoryV1 } from "./db/runtime-start-reservation-validation-repository.v1.js";
import { TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1 } from "./db/permission-manifest.v1.js";
import { DeepSeekClaudeAgentIntentAdapterV1 } from "./deepseek-claude-agent-intent-adapter.v1.js";
import { createTriggerProcessorHttpPortsV1, createTriggerProcessorWorkloadSignerFromEnvV1 } from "./production-http-ports.v1.js";
import { createTriggerObjectAccessPolicyV1 } from "./production-object-access-policy.v1.js";
import { createTriggerRuntimeCommandTransportV1 } from "./production-command-dispatch.v1.js";
import { openTriggerProcessorObjectStoreV1 } from "./production-object-store.v1.js";

export interface ProductionTriggerProcessorCompositionOptionsV1 {
  readonly deployment_environment: "local" | "dev" | "staging" | "prod";
  readonly release_channel: "stable" | "canary";
  readonly env?: NodeJS.ProcessEnv;
}

export interface ProductionTriggerProcessorCompositionV1 {
  readonly trigger_admission: ReturnType<typeof createTriggerAdmissionApplicationV1>;
  readonly process_control: ReturnType<typeof createTriggerProcessControlApplicationV1>;
  readonly process_observation: ReturnType<typeof createTriggerProcessObservationApplicationV1>;
  readonly internal_applications: TriggerProcessorInternalApplicationsV1;
  readonly readiness_checks: readonly Readonly<{
    name: string;
    check(signal: AbortSignal): Promise<void>;
  }>[];
  start(): void;
  close(): Promise<void>;
}

function requiredEnvV1(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (typeof value !== "string" || value.length === 0 || value.includes("\u0000")) {
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

function deepSeekProviderEnvironmentV1(env: NodeJS.ProcessEnv): Readonly<Record<string, string>> {
  const apiKey = requiredEnvV1(env, "DEEPSEEK_API_KEY");
  const path = requiredEnvV1(env, "PATH");
  if (
    apiKey.length < 16 ||
    apiKey.length > 16_384 ||
    /[\r\n]/u.test(apiKey) ||
    env.ANTHROPIC_API_KEY !== undefined ||
    env.ANTHROPIC_AUTH_TOKEN !== undefined ||
    env.ANTHROPIC_BASE_URL !== undefined
  ) {
    throw new Error("DeepSeek Agent SDK configuration is invalid");
  }
  const result: Record<string, string> = {
    // The process environment contains only the provider-native credential.
    // Map it at the isolated SDK boundary; never inherit an Anthropic key or
    // an arbitrary endpoint into the Agent SDK subprocess.
    ANTHROPIC_BASE_URL: "https://api.deepseek.com/anthropic",
    ANTHROPIC_AUTH_TOKEN: apiKey,
    PATH: path,
  };
  // Do not inherit ambient HTTP proxy settings into the isolated Agent SDK
  // subprocess. In particular, a desktop proxy such as 127.0.0.1:7890 is a
  // loopback address inside the container, not the host proxy, and otherwise
  // turns a reachable provider into an unbounded retry. Deployment-specific
  // egress belongs at the runtime/network layer instead of this credential
  // boundary. TLS trust anchors remain explicit and safe to pass through.
  for (const key of ["NODE_EXTRA_CA_CERTS", "SSL_CERT_FILE"] as const) {
    if (env[key] !== undefined) result[key] = env[key]!;
  }
  return Object.freeze(result);
}

type TriggerPostgresCompositionV1 = VerifiedOwnerPostgresCompositionV1<
  typeof TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1
>;

/**
 * Constructs the complete Trigger owner graph. Every external owner is bound
 * by workload JWT and every local durable component is opened and verified
 * before it can make the traffic entrypoint ready.
 */
export async function openProductionTriggerProcessorCompositionV1(
  options: ProductionTriggerProcessorCompositionOptionsV1,
): Promise<ProductionTriggerProcessorCompositionV1> {
  const env = options.env ?? process.env;
  const databaseUrl = requiredEnvV1(env, "PAI_DATABASE_URL");
  const reconcilerDatabaseUrl = requiredEnvV1(env, "PAI_OBJECT_STORE_RECONCILER_DATABASE_URL");
  const supabaseUrl = requiredEnvV1(env, "PAI_SUPABASE_URL");
  const supabaseSecretKey = requiredEnvV1(env, "PAI_SUPABASE_SECRET_KEY");
  const objectAccessSecret = requiredEnvV1(env, "PAI_TRIGGER_OBJECT_ACCESS_HMAC_SECRET");
  const recoveryWorkerId = requiredEnvV1(env, "PAI_TRIGGER_RECOVERY_WORKER_ID");
  const actionRuntimeUrl = requiredEnvV1(env, "PAI_ACTION_RUNTIME_URL");
  const skillRegistryUrl = requiredEnvV1(env, "PAI_SKILL_REGISTRY_URL");
  const memoryUrl = requiredEnvV1(env, "PAI_MEMORY_URL");
  const knowThatUrl = requiredEnvV1(env, "PAI_KNOWTHAT_URL");
  const intentModel = requiredEnvV1(env, "PAI_TRIGGER_INTENT_MODEL");
  const intentSdkCwd = requiredEnvV1(env, "PAI_TRIGGER_INTENT_SDK_CWD");
  const contextRetentionSeconds = requiredIntegerV1(
    env,
    "PAI_TRIGGER_CONTEXT_RETENTION_SECONDS",
    60,
    31_536_000,
  );
  const requestTimeoutMs = optionalIntegerV1(
    env,
    "PAI_TRIGGER_INTERNAL_REQUEST_TIMEOUT_MS",
    100,
    300_000,
  );
  const recoveryPollMs = optionalIntegerV1(
    env,
    "PAI_TRIGGER_RECOVERY_POLL_INTERVAL_MS",
    10,
    60_000,
  );
  const providerEnv = deepSeekProviderEnvironmentV1(env);
  await access(intentSdkCwd, fsConstants.R_OK | fsConstants.W_OK | fsConstants.X_OK);

  let postgres: TriggerPostgresCompositionV1 | undefined;
  let eventDispatch: Awaited<ReturnType<typeof openOwnerEventDispatchRuntimeFromEnvV1>> | undefined;
  let commandDispatch: Awaited<ReturnType<typeof openOwnerCommandDispatchRuntimeFromEnvV1>> | undefined;
  let objectStore: Awaited<ReturnType<typeof openTriggerProcessorObjectStoreV1>> | undefined;
  let recoveryRunner: ReturnType<typeof createTriggerProcessRecoveryRunnerV1> | undefined;
  let started = false;
  let closed = false;

  const closeV1 = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    await recoveryRunner?.stop().catch(() => undefined);
    await commandDispatch?.close().catch(() => undefined);
    await eventDispatch?.close().catch(() => undefined);
    await objectStore?.close().catch(() => undefined);
    await postgres?.close().catch(() => undefined);
  };

  try {
    postgres = await openVerifiedOwnerPostgresCompositionV1(
      TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
      databaseUrl,
    );
    eventDispatch = await openOwnerEventDispatchRuntimeFromEnvV1(
      postgres.outbox,
      {
        deployment_environment: options.deployment_environment,
        release_channel: options.release_channel,
        production_dependencies_required: true,
        transport_epoch_postgres: postgres.postgres,
        env,
      },
    );
    if (eventDispatch === undefined) {
      throw new Error("Trigger Processor owner event dispatch is not composed");
    }
    commandDispatch = await openOwnerCommandDispatchRuntimeFromEnvV1(
      postgres.outbox,
      {
        production_dependencies_required: true,
        transport_epoch_postgres: postgres.postgres,
        transport: createTriggerRuntimeCommandTransportV1({
          action_runtime_url: actionRuntimeUrl,
          signer: createTriggerProcessorWorkloadSignerFromEnvV1(env),
          ...(requestTimeoutMs === undefined
            ? {}
            : { request_timeout_ms: requestTimeoutMs }),
        }),
        env,
      },
    );
    if (commandDispatch === undefined) {
      throw new Error("Trigger Processor owner command dispatch is not composed");
    }
    const accessPolicy = createTriggerObjectAccessPolicyV1({
      postgres: postgres.postgres,
      hmac_secret: objectAccessSecret,
    });
    objectStore = await openTriggerProcessorObjectStoreV1({
      database_url: databaseUrl,
      reconciler_database_url: reconcilerDatabaseUrl,
      supabase_url: supabaseUrl,
      supabase_secret_key: supabaseSecretKey,
      worker_id: `${recoveryWorkerId}:object-store`,
      access_policy: accessPolicy,
    });
    const ownerContext = createTriggerContextOwnerSourcePortV1(postgres.postgres);
    const http = createTriggerProcessorHttpPortsV1({
      action_runtime_url: actionRuntimeUrl,
      skill_registry_url: skillRegistryUrl,
      memory_url: memoryUrl,
      knowthat_url: knowThatUrl,
      signer: createTriggerProcessorWorkloadSignerFromEnvV1(env),
      context_query: ownerContext,
      ...(requestTimeoutMs === undefined ? {} : { request_timeout_ms: requestTimeoutMs }),
    });
    const contextResolver = createContextSnapshotResolverV1(
      objectStore.object_store,
      accessPolicy.context_snapshots,
      createContextSnapshotCanonicalReferenceRepositoryV1(postgres.postgres),
    );
    const intentEngine = new DeepSeekClaudeAgentIntentAdapterV1({
      model: intentModel,
      sandbox_cwd: intentSdkCwd,
      provider_env: providerEnv,
      context_snapshots: contextResolver,
      tool_permissions: http.intent_policy_sources.tool_permissions,
      trigger_input: ownerContext,
    });
    const lifecycle = createTriggerLifecycleApplicationV1(
      ownerDatabaseApplicationDependenciesV1(postgres),
      {
        confirmations: createAcceptedTriggerConfirmationVerifierV1(
          createTriggerConfirmationReadRepositoryV1(postgres.postgres),
        ),
        context_sources: {
          ...http.context_sources,
          ...ownerContext.local_sources,
        },
        intent_policy_sources: http.intent_policy_sources,
        intent_engine: intentEngine,
        object_store: objectStore.object_store,
        context_snapshots: contextResolver,
        runtime_events: http.runtime_events,
        process_snapshot_retention:
          createTriggerProcessSnapshotRetentionRepositoryV1(postgres.postgres),
        context_retention_until: () =>
          new Date(Date.now() + contextRetentionSeconds * 1_000).toISOString(),
      },
    );
    const snapshotMaterializer = createObjectStoreTriggerProcessSnapshotMaterializerV1(
      objectStore.object_store,
      accessPolicy.snapshot_manifest,
      Object.freeze({
        async read() {
          // There is intentionally no cross-owner DB fallback. Until each
          // referenced owner supplies an authenticated overflow reader, an
          // overflow-bearing snapshot is unavailable rather than partially
          // reconstructed with unverified bytes.
          throw new Error("snapshot_overflow_owner_reader_unavailable");
        },
      }),
    );
    const snapshotRead = createTriggerProcessSnapshotReadApplicationV1(
      createTriggerProcessSnapshotMetadataRepositoryV1(postgres.postgres),
      snapshotMaterializer,
    );
    const snapshotRepair = createTriggerProcessSnapshotRepairHandlerV1(
      ownerDatabaseApplicationDependenciesV1(postgres),
    );
    recoveryRunner = createTriggerProcessRecoveryRunnerV1(
      createTriggerProcessRecoveryWorkerV1(
        ownerDatabaseApplicationDependenciesV1(postgres),
        createTriggerProcessLifecycleRecoveryHandlerV1(lifecycle, snapshotRepair),
        // Intent synthesis has a bounded 120-second provider deadline. Its
        // fenced work lease must also cover Context/profile revalidation and
        // the final owner ACK; otherwise a healthy provider result can be
        // discarded at the recovery boundary.
        { worker_id: recoveryWorkerId, lease_seconds: 150 },
      ),
      ...(recoveryPollMs === undefined ? [] : [{ poll_interval_ms: recoveryPollMs }]),
    );
    const internalApplications: TriggerProcessorInternalApplicationsV1 = Object.freeze({
      confirmation_response: createTriggerConfirmationResponseApplicationV1(
        ownerDatabaseApplicationDependenciesV1(postgres),
      ),
      lifecycle,
      context_snapshot_read: createContextSnapshotReadApplicationV1(contextResolver),
      snapshot_read: snapshotRead,
      runtime_start_reservation_validation:
        createRuntimeStartReservationValidationApplicationV1(
          createRuntimeStartReservationValidationRepositoryV1(
            postgres.read_committed_postgres,
          ),
        ),
      recovery_runner: recoveryRunner,
    });
    return Object.freeze({
      trigger_admission: createTriggerAdmissionApplicationV1(
        ownerDatabaseApplicationDependenciesV1(postgres),
      ),
      process_control: createTriggerProcessControlApplicationV1(
        ownerDatabaseApplicationDependenciesV1(postgres),
      ),
      process_observation: createTriggerProcessObservationApplicationV1(
        createTriggerProcessObservationRepositoryV1(postgres.postgres),
      ),
      internal_applications: internalApplications,
      readiness_checks: Object.freeze([
        { name: "owner_postgres", check: postgres.checkReadiness },
        { name: "owner_event_dispatch", check: eventDispatch.checkReadiness },
        { name: "owner_command_dispatch", check: commandDispatch.checkReadiness },
        { name: "object_store", check: objectStore.checkReadiness },
        { name: "owner_http_dependencies", check: http.checkReadiness },
      ]),
      start() {
        if (closed) throw new Error("Trigger Processor production composition is closed");
        if (started) return;
        started = true;
        objectStore!.start();
        eventDispatch!.start();
        commandDispatch!.start();
        recoveryRunner?.start();
      },
      close: closeV1,
    });
  } catch (error) {
    await closeV1();
    throw error;
  }
}
