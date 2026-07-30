import {
  DURABLE_EVENT_TARGET_CONSUMERS_V1,
  type DeploymentEnvironmentV1,
  type ReleaseChannelV1,
} from "@pai/contracts";
import type {
  OwnerOutboxStorePortV1,
  PostgresQueryPortV1,
} from "@pai/persistence";

import {
  createDurableOutboxDispatcherV1,
  createPostgresOwnerOutboxStoreV1,
  type DurableOutboxDispatchSummaryV1,
} from "./durable-eventing.v1.js";
import {
  createRedisNamespaceV1,
  openVerifiedRedisStreamCompositionV1,
  type VerifiedRedisStreamCompositionV1,
} from "./redis-stream-transport.v1.js";

export interface OwnerEventDispatchRuntimeConfigV1 {
  readonly redis_url: string;
  readonly deployment_environment: DeploymentEnvironmentV1;
  readonly release_channel: ReleaseChannelV1;
  readonly stream_epoch: string;
  readonly stream_generation: number;
  readonly worker_id: string;
  readonly batch_size?: number;
  readonly lease_seconds?: number;
  readonly max_attempts?: number;
  readonly retry_base_delay_ms?: number;
  readonly retry_max_delay_ms?: number;
  readonly retry_jitter?: "none" | "full";
  readonly poll_interval_ms?: number;
  readonly on_error?: (error: unknown) => void | Promise<void>;
}

export interface OwnerEventDispatchRuntimeV1 {
  readonly state: "idle" | "running" | "stopping" | "stopped";
  readonly event_outbox_tables: readonly string[];
  readonly redis: VerifiedRedisStreamCompositionV1;
  start(): void;
  runOnce(signal?: AbortSignal): Promise<DurableOutboxDispatchSummaryV1>;
  checkReadiness(signal?: AbortSignal): Promise<void>;
  close(): Promise<void>;
}

export interface OwnerEventDispatchRuntimeEnvironmentV1 {
  readonly deployment_environment: DeploymentEnvironmentV1;
  readonly release_channel: ReleaseChannelV1;
  readonly production_dependencies_required: boolean;
  readonly transport_epoch_postgres?: PostgresQueryPortV1;
  readonly env?: Readonly<Record<string, string | undefined>>;
}

function positiveIntegerV1(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  label: string,
): number {
  const candidate = value ?? fallback;
  if (
    !Number.isSafeInteger(candidate) ||
    candidate < minimum ||
    candidate > maximum
  ) {
    throw new Error(`${label} is outside the owner event runtime bounds`);
  }
  return candidate;
}

function eventRoutesV1(): Readonly<Record<string, string>> {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(DURABLE_EVENT_TARGET_CONSUMERS_V1).map(
        ([target, consumer]) => [target, `consumer:${consumer}`],
      ),
    ),
  );
}

function addSummaryV1(
  left: DurableOutboxDispatchSummaryV1,
  right: DurableOutboxDispatchSummaryV1,
): DurableOutboxDispatchSummaryV1 {
  return Object.freeze({
    claimed: left.claimed + right.claimed,
    sent: left.sent + right.sent,
    retry_wait: left.retry_wait + right.retry_wait,
    failed: left.failed + right.failed,
  });
}

const EMPTY_SUMMARY_V1 = Object.freeze({
  claimed: 0,
  sent: 0,
  retry_wait: 0,
  failed: 0,
});

function positiveEnvironmentIntegerV1(
  name: string,
  value: string | undefined,
): number | undefined {
  if (value === undefined) return undefined;
  if (!/^[1-9][0-9]*$/u.test(value)) {
    throw new Error(`${name} must be a positive integer`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${name} must be a safe integer`);
  }
  return parsed;
}

export const OWNER_EVENT_SCHEMA_V1 = Object.freeze({
  trigger_processor: "trigger_processor",
  action_runtime: "action_runtime",
  timer_trigger_app: "timer",
  meta_cognition: "meta_cognition",
  skill_registry: "skill_registry",
  knowthat: "knowthat",
  memory: "memory",
} as const);

export async function readActiveOwnerTransportEpochV1(
  ownerService: keyof typeof OWNER_EVENT_SCHEMA_V1,
  postgres: PostgresQueryPortV1,
  transportName: string,
): Promise<Readonly<{ epoch: string; generation: number }>> {
  const schema = OWNER_EVENT_SCHEMA_V1[ownerService];
  const result = await postgres.query<{
    active_epoch: unknown;
    active_generation: unknown;
  }>(
    `SELECT active_epoch, active_generation::text AS active_generation
       FROM ${schema}.eventing_transport_epochs
      WHERE transport_name = $1`,
    [transportName],
  );
  const row = result.rows[0];
  if (
    result.rows.length !== 1 ||
    row === undefined ||
    typeof row.active_epoch !== "string" ||
    typeof row.active_generation !== "string" ||
    !/^[1-9][0-9]*$/u.test(row.active_generation)
  ) {
    throw new Error(`${ownerService} active event transport fence is invalid`);
  }
  const generation = Number(row.active_generation);
  if (!Number.isSafeInteger(generation)) {
    throw new Error(`${ownerService} active event transport fence is invalid`);
  }
  return Object.freeze({ epoch: row.active_epoch, generation });
}

/** Activates one named owner transport epoch with a monotonic generation CAS. */
export async function ensureActiveOwnerTransportEpochV1(
  ownerService: keyof typeof OWNER_EVENT_SCHEMA_V1,
  postgres: PostgresQueryPortV1,
  transportName: string,
  nextEpoch: string,
  nextGeneration: number,
): Promise<void> {
  const current = await readActiveOwnerTransportEpochV1(
    ownerService,
    postgres,
    transportName,
  );
  if (current.generation === nextGeneration) {
    if (current.epoch !== nextEpoch) {
      throw new Error(
        `${ownerService} ${transportName} transport epoch cannot change without advancing generation`,
      );
    }
    return;
  }
  if (nextGeneration !== current.generation + 1) {
    throw new Error(
      `${ownerService} ${transportName} transport generation must equal the active generation or advance it by one`,
    );
  }
  const schema = OWNER_EVENT_SCHEMA_V1[ownerService];
  try {
    await postgres.query(
      `SELECT ${schema}.activate_eventing_transport_epoch_v1($1,$2,$3,$4,$5) AS result`,
      [
        transportName,
        current.generation,
        nextEpoch,
        nextGeneration,
        new Date().toISOString(),
      ],
    );
  } catch (error) {
    const raced = await readActiveOwnerTransportEpochV1(
      ownerService,
      postgres,
      transportName,
    );
    if (raced.epoch === nextEpoch && raced.generation === nextGeneration) return;
    throw error;
  }
  const activated = await readActiveOwnerTransportEpochV1(
    ownerService,
    postgres,
    transportName,
  );
  if (
    activated.epoch !== nextEpoch ||
    activated.generation !== nextGeneration
  ) {
    throw new Error(`${ownerService} ${transportName} transport activation was not durable`);
  }
}

export async function openOwnerEventDispatchRuntimeFromEnvV1(
  ownerOutbox: OwnerOutboxStorePortV1,
  input: OwnerEventDispatchRuntimeEnvironmentV1,
): Promise<OwnerEventDispatchRuntimeV1 | undefined> {
  const env = input.env ?? process.env;
  const redisUrl = env.PAI_REDIS_URL;
  const streamEpoch = env.PAI_EVENT_STREAM_EPOCH;
  const streamGeneration = positiveEnvironmentIntegerV1(
    "PAI_EVENT_STREAM_GENERATION",
    env.PAI_EVENT_STREAM_GENERATION,
  );
  const configuredCount = [redisUrl, streamEpoch, streamGeneration].filter(
    (value) => value !== undefined,
  ).length;
  if (configuredCount === 0) {
    if (input.production_dependencies_required) {
      throw new Error(
        "PAI_REDIS_URL, PAI_EVENT_STREAM_EPOCH, and PAI_EVENT_STREAM_GENERATION are required for durable owner events in production",
      );
    }
    return undefined;
  }
  if (
    configuredCount !== 3 ||
    redisUrl === undefined ||
    redisUrl.length === 0 ||
    streamEpoch === undefined ||
    streamEpoch.length === 0 ||
    streamGeneration === undefined
  ) {
    throw new Error(
      "PAI_REDIS_URL, PAI_EVENT_STREAM_EPOCH, and PAI_EVENT_STREAM_GENERATION must be configured together",
    );
  }
  const ownerService = ownerOutbox.owner_service;
  if (
    !(ownerService in OWNER_EVENT_SCHEMA_V1) ||
    input.transport_epoch_postgres === undefined
  ) {
    throw new Error(
      "verified owner PostgreSQL is required to activate the durable event transport fence",
    );
  }
  await ensureActiveOwnerTransportEpochV1(
    ownerService as keyof typeof OWNER_EVENT_SCHEMA_V1,
    input.transport_epoch_postgres,
    "redis_stream",
    streamEpoch,
    streamGeneration,
  );
  const instanceId =
    env.PAI_EVENT_DISPATCH_WORKER_ID ??
    env.HOSTNAME ??
    `${ownerOutbox.owner_service}:pid:${process.pid}`;
  return openOwnerEventDispatchRuntimeV1(ownerOutbox, {
    redis_url: redisUrl,
    deployment_environment: input.deployment_environment,
    release_channel: input.release_channel,
    stream_epoch: streamEpoch,
    stream_generation: streamGeneration,
    worker_id: instanceId,
  });
}

/**
 * Opens one verified Redis transport and a fenced dispatcher for every domain
 * event outbox owned by the verified PostgreSQL composition. Command outboxes
 * are intentionally excluded: they require authenticated HTTP dispatchers,
 * not the owner durable-event Redis envelope.
 */
export async function openOwnerEventDispatchRuntimeV1(
  ownerOutbox: OwnerOutboxStorePortV1,
  config: OwnerEventDispatchRuntimeConfigV1,
): Promise<OwnerEventDispatchRuntimeV1> {
  if (
    typeof config !== "object" ||
    config === null ||
    config.redis_url.length === 0 ||
    config.worker_id.length === 0 ||
    config.worker_id.length > 256 ||
    (config.retry_jitter !== undefined &&
      config.retry_jitter !== "none" &&
      config.retry_jitter !== "full") ||
    (config.on_error !== undefined && typeof config.on_error !== "function")
  ) {
    throw new Error("invalid owner event dispatch runtime configuration");
  }
  const batchSize = positiveIntegerV1(
    config.batch_size,
    16,
    1,
    16,
    "batch_size",
  );
  const leaseSeconds = positiveIntegerV1(
    config.lease_seconds,
    30,
    1,
    3_600,
    "lease_seconds",
  );
  const maxAttempts = positiveIntegerV1(
    config.max_attempts,
    8,
    1,
    100,
    "max_attempts",
  );
  const retryBaseDelayMs = positiveIntegerV1(
    config.retry_base_delay_ms,
    1_000,
    1,
    300_000,
    "retry_base_delay_ms",
  );
  const retryMaxDelayMs = positiveIntegerV1(
    config.retry_max_delay_ms,
    60_000,
    retryBaseDelayMs,
    300_000,
    "retry_max_delay_ms",
  );
  const pollIntervalMs = positiveIntegerV1(
    config.poll_interval_ms,
    1_000,
    10,
    60_000,
    "poll_interval_ms",
  );
  const eventOutboxTables = Object.freeze(
    ownerOutbox.outbox_tables.filter((table) =>
      table.endsWith("event_outbox"),
    ),
  );
  if (eventOutboxTables.length === 0) {
    throw new Error(
      `${ownerOutbox.owner_service} has no durable domain-event outbox`,
    );
  }
  const namespace = createRedisNamespaceV1({
    deployment_environment: config.deployment_environment,
    release_channel: config.release_channel,
    owner_service: ownerOutbox.owner_service,
    stream_epoch: config.stream_epoch,
    stream_generation: config.stream_generation,
  });
  const redis = await openVerifiedRedisStreamCompositionV1({
    url: config.redis_url,
    namespace,
    routes: eventRoutesV1(),
  });
  const dispatchers = eventOutboxTables.map((table) =>
    createDurableOutboxDispatcherV1(
      createPostgresOwnerOutboxStoreV1(ownerOutbox, table),
      redis.transport,
      {
        owner_service: ownerOutbox.owner_service,
        worker_id: `${config.worker_id}:${table}`,
        batch_size: batchSize,
        lease_seconds: leaseSeconds,
        max_attempts: maxAttempts,
        retry_base_delay_ms: retryBaseDelayMs,
        retry_max_delay_ms: retryMaxDelayMs,
        retry_jitter: config.retry_jitter ?? "full",
        current_transport_epoch: config.stream_epoch,
        current_transport_generation: config.stream_generation,
      },
    ),
  );
  let state: OwnerEventDispatchRuntimeV1["state"] = "idle";
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active: Promise<DurableOutboxDispatchSummaryV1> | undefined;
  let activeController: AbortController | undefined;
  let closePromise: Promise<void> | undefined;
  let lastError: unknown;

  const reportError = async (error: unknown): Promise<void> => {
    lastError = error;
    try {
      await config.on_error?.(error);
    } catch {
      // A diagnostic sink is never allowed to terminate the durable loop.
    }
  };

  const runtime: OwnerEventDispatchRuntimeV1 = {
    get state() {
      return state;
    },
    event_outbox_tables: eventOutboxTables,
    redis,
    start() {
      if (state === "running") return;
      if (state !== "idle") {
        throw new Error("owner event dispatch runtime cannot be restarted");
      }
      state = "running";
      void runCycle();
    },
    async runOnce(signal?: AbortSignal) {
      signal?.throwIfAborted();
      let summary: DurableOutboxDispatchSummaryV1 = EMPTY_SUMMARY_V1;
      for (const dispatcher of dispatchers) {
        signal?.throwIfAborted();
        summary = addSummaryV1(
          summary,
          await dispatcher.dispatchBatch(signal),
        );
      }
      signal?.throwIfAborted();
      return summary;
    },
    async checkReadiness(signal?: AbortSignal) {
      signal?.throwIfAborted();
      if (state !== "running") {
        throw new Error("owner event dispatch runtime is not running");
      }
      await redis.checkReadiness(signal);
      signal?.throwIfAborted();
      if (lastError !== undefined) {
        throw new Error("owner event dispatch loop has not recovered", {
          cause: lastError,
        });
      }
    },
    close() {
      if (closePromise !== undefined) return closePromise;
      closePromise = (async () => {
        if (state === "stopped") return;
        state = "stopping";
        if (timer !== undefined) clearTimeout(timer);
        activeController?.abort(
          new Error("owner event dispatch runtime is stopping"),
        );
        await active?.catch(() => undefined);
        await redis.close();
        state = "stopped";
      })();
      return closePromise;
    },
  };

  function schedule(): void {
    if (state !== "running") return;
    timer = setTimeout(() => void runCycle(), pollIntervalMs);
    timer.unref();
  }

  async function runCycle(): Promise<void> {
    if (state !== "running" || active !== undefined) return;
    const controller = new AbortController();
    activeController = controller;
    active = runtime.runOnce(controller.signal);
    try {
      await active;
      lastError = undefined;
    } catch (error) {
      if (state === "running") await reportError(error);
    } finally {
      active = undefined;
      activeController = undefined;
      schedule();
    }
  }

  return Object.freeze(runtime);
}
