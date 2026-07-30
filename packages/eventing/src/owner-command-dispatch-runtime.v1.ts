import { isProxy } from "node:util/types";

import type {
  OwnerOutboxStorePortV1,
  PostgresQueryPortV1,
} from "@pai/persistence";

import {
  ensureActiveOwnerTransportEpochV1,
  OWNER_EVENT_SCHEMA_V1,
} from "./owner-event-dispatch-runtime.v1.js";

const COMMAND_TRANSPORT_NAME_V1 = "internal_http";
const COMMAND_BATCH_MAX_V1 = 16;
const COMMAND_IDENTITY_MAX_LENGTH_V1 = 512;
const COMMAND_TRANSPORT_REF_MAX_LENGTH_V1 = 2_048;

export interface OwnerCommandTransportReceiptV1 {
  readonly transport_ref: string;
}

export interface OwnerCommandDispatchTransportPortV1 {
  dispatch(
    request: Readonly<{
      owner_service: string;
      outbox_table: string;
      record: Readonly<Record<string, unknown>>;
      current_transport_epoch: string;
      current_transport_generation: number;
    }>,
    signal?: AbortSignal,
  ): Promise<OwnerCommandTransportReceiptV1>;
  checkReadiness(signal?: AbortSignal): Promise<void>;
}

export class OwnerCommandTransportErrorV1 extends Error {
  public constructor(
    public readonly code: string,
    public readonly retryable: boolean,
    public readonly outcome_ambiguous: boolean,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "OwnerCommandTransportErrorV1";
  }
}

export interface OwnerCommandDispatchSummaryV1 {
  readonly claimed: number;
  readonly sent: number;
  readonly retry_wait: number;
  readonly failed: number;
}

export interface OwnerCommandDispatchRuntimeConfigV1 {
  readonly transport_epoch: string;
  readonly transport_generation: number;
  readonly worker_id: string;
  readonly batch_size?: number;
  readonly lease_seconds?: number;
  readonly max_attempts?: number;
  readonly retry_base_delay_ms?: number;
  readonly retry_max_delay_ms?: number;
  readonly retry_jitter?: "none" | "full";
  readonly poll_interval_ms?: number;
  readonly on_error?: (error: unknown) => void | Promise<void>;
  readonly now?: () => Date;
  readonly random?: () => number;
}

export interface OwnerCommandDispatchRuntimeV1 {
  readonly state: "idle" | "running" | "stopping" | "stopped";
  readonly command_outbox_tables: readonly string[];
  start(): void;
  runOnce(signal?: AbortSignal): Promise<OwnerCommandDispatchSummaryV1>;
  checkReadiness(signal?: AbortSignal): Promise<void>;
  close(): Promise<void>;
}

export interface OwnerCommandDispatchRuntimeEnvironmentV1 {
  readonly production_dependencies_required: boolean;
  readonly transport_epoch_postgres: PostgresQueryPortV1;
  readonly transport: OwnerCommandDispatchTransportPortV1;
  readonly env?: Readonly<Record<string, string | undefined>>;
}

const EMPTY_SUMMARY_V1 = Object.freeze({
  claimed: 0,
  sent: 0,
  retry_wait: 0,
  failed: 0,
});

function boundedIntegerV1(
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
    throw new Error(`${label} is outside owner command runtime bounds`);
  }
  return candidate;
}

function environmentIntegerV1(
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

function boundedTextV1(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= COMMAND_IDENTITY_MAX_LENGTH_V1 &&
    !value.includes("\u0000")
  );
}

function boundedTransportRefV1(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= COMMAND_TRANSPORT_REF_MAX_LENGTH_V1 &&
    !value.includes("\u0000")
  );
}

function snapshotRecordV1(
  value: unknown,
): Readonly<Record<string, unknown>> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    isProxy(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  ) {
    throw new OwnerCommandTransportErrorV1(
      "command_outbox_contract_violation",
      false,
      false,
      "claimed command outbox row is invalid",
    );
  }
  const snapshot: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string") {
      throw new OwnerCommandTransportErrorV1(
        "command_outbox_contract_violation",
        false,
        false,
        "claimed command outbox row is invalid",
      );
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      throw new OwnerCommandTransportErrorV1(
        "command_outbox_contract_violation",
        false,
        false,
        "claimed command outbox row is invalid",
      );
    }
    snapshot[key] = descriptor.value;
  }
  return Object.freeze(snapshot);
}

function snapshotBatchV1(
  value: unknown,
  limit: number,
): readonly Readonly<Record<string, unknown>>[] {
  if (!Array.isArray(value) || isProxy(value) || value.length > limit) {
    throw new OwnerCommandTransportErrorV1(
      "command_outbox_contract_violation",
      false,
      false,
      "claimed command outbox batch is invalid",
    );
  }
  const ownKeys = Reflect.ownKeys(value);
  const expectedKeys = new Set<PropertyKey>([
    "length",
    ...Array.from({ length: value.length }, (_, index) => String(index)),
  ]);
  if (
    ownKeys.length !== expectedKeys.size ||
    ownKeys.some((key) => !expectedKeys.has(key))
  ) {
    throw new OwnerCommandTransportErrorV1(
      "command_outbox_contract_violation",
      false,
      false,
      "claimed command outbox batch is invalid",
    );
  }
  const records = value.map(snapshotRecordV1);
  const identities = records.map((record) => {
    const {
      outbox_id: outboxId,
      claim_token: claimToken,
      attempt_count: attemptCount,
    } = record;
    if (
      !boundedTextV1(outboxId) ||
      !boundedTextV1(claimToken) ||
      !Number.isSafeInteger(attemptCount) ||
      (attemptCount as number) < 1
    ) {
      throw new OwnerCommandTransportErrorV1(
        "command_outbox_contract_violation",
        false,
        false,
        "claimed command outbox lease identity is invalid",
      );
    }
    return `${outboxId}\u0000${claimToken}`;
  });
  if (new Set(identities).size !== identities.length) {
    throw new OwnerCommandTransportErrorV1(
      "command_outbox_contract_violation",
      false,
      false,
      "claimed command outbox batch contains duplicate leases",
    );
  }
  return Object.freeze(records);
}

function snapshotReceiptV1(value: unknown): OwnerCommandTransportReceiptV1 {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    isProxy(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null) ||
    Reflect.ownKeys(value).length !== 1
  ) {
    throw new OwnerCommandTransportErrorV1(
      "command_transport_receipt_invalid",
      true,
      true,
      "command transport receipt is invalid",
    );
  }
  const descriptor = Object.getOwnPropertyDescriptor(value, "transport_ref");
  if (
    descriptor === undefined ||
    !("value" in descriptor) ||
    descriptor.enumerable !== true ||
    !boundedTransportRefV1(descriptor.value)
  ) {
    throw new OwnerCommandTransportErrorV1(
      "command_transport_receipt_invalid",
      true,
      true,
      "command transport receipt is invalid",
    );
  }
  return Object.freeze({ transport_ref: descriptor.value });
}

function retryDelayV1(
  attemptCount: number,
  baseDelayMs: number,
  maxDelayMs: number,
  jitter: "none" | "full",
  random: () => number,
): number {
  const ceiling = Math.min(
    maxDelayMs,
    baseDelayMs * 2 ** Math.min(attemptCount - 1, 30),
  );
  if (jitter === "none") return ceiling;
  const sample = random();
  if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
    throw new Error("owner command retry random source must return [0, 1)");
  }
  return Math.floor(sample * (ceiling + 1));
}

function addSummaryV1(
  left: OwnerCommandDispatchSummaryV1,
  right: OwnerCommandDispatchSummaryV1,
): OwnerCommandDispatchSummaryV1 {
  return Object.freeze({
    claimed: left.claimed + right.claimed,
    sent: left.sent + right.sent,
    retry_wait: left.retry_wait + right.retry_wait,
    failed: left.failed + right.failed,
  });
}

export function createOwnerCommandDispatchRuntimeV1(
  ownerOutbox: OwnerOutboxStorePortV1,
  transport: OwnerCommandDispatchTransportPortV1,
  config: OwnerCommandDispatchRuntimeConfigV1,
): OwnerCommandDispatchRuntimeV1 {
  const commandOutboxTables = Object.freeze(
    ownerOutbox.outbox_tables.filter((table) => table.endsWith("command_outbox")),
  );
  if (commandOutboxTables.length === 0) {
    throw new Error(`${ownerOutbox.owner_service} has no durable command outbox`);
  }
  if (
    !boundedTextV1(config.transport_epoch) ||
    !boundedTextV1(config.worker_id) ||
    !Number.isSafeInteger(config.transport_generation) ||
    config.transport_generation < 1 ||
    (config.retry_jitter !== undefined &&
      config.retry_jitter !== "none" &&
      config.retry_jitter !== "full") ||
    (config.on_error !== undefined && typeof config.on_error !== "function")
  ) {
    throw new Error("invalid owner command dispatch runtime configuration");
  }
  const batchSize = boundedIntegerV1(
    config.batch_size,
    16,
    1,
    COMMAND_BATCH_MAX_V1,
    "batch_size",
  );
  const leaseSeconds = boundedIntegerV1(
    config.lease_seconds,
    30,
    1,
    300,
    "lease_seconds",
  );
  const maxAttempts = boundedIntegerV1(
    config.max_attempts,
    10,
    1,
    100,
    "max_attempts",
  );
  const retryBaseDelayMs = boundedIntegerV1(
    config.retry_base_delay_ms,
    1_000,
    1,
    300_000,
    "retry_base_delay_ms",
  );
  const retryMaxDelayMs = boundedIntegerV1(
    config.retry_max_delay_ms,
    60_000,
    retryBaseDelayMs,
    300_000,
    "retry_max_delay_ms",
  );
  const pollIntervalMs = boundedIntegerV1(
    config.poll_interval_ms,
    1_000,
    10,
    60_000,
    "poll_interval_ms",
  );
  const now = config.now ?? (() => new Date());
  const random = config.random ?? Math.random;
  const jitter = config.retry_jitter ?? "full";
  const claim = ownerOutbox.claim.bind(ownerOutbox);
  const acknowledge = ownerOutbox.acknowledge.bind(ownerOutbox);
  const dispatch = transport.dispatch.bind(transport);
  const checkTransportReadiness = transport.checkReadiness.bind(transport);

  const dispatchTable = async (
    outboxTable: string,
    signal?: AbortSignal,
  ): Promise<OwnerCommandDispatchSummaryV1> => {
    signal?.throwIfAborted();
    const claimed = snapshotBatchV1(
      await claim({
        outbox_table: outboxTable,
        worker_id: `${config.worker_id}:${outboxTable}`,
        limit: batchSize,
        lease_seconds: leaseSeconds,
        now: now().toISOString(),
        current_transport_epoch: config.transport_epoch,
        current_transport_generation: config.transport_generation,
      }),
      batchSize,
    );
    signal?.throwIfAborted();
    let sent = 0;
    let retryWait = 0;
    let failed = 0;
    for (const record of claimed) {
      signal?.throwIfAborted();
      const { outbox_id: outboxId, claim_token: claimToken } = record;
      const attemptCount = record.attempt_count as number;
      let receipt: OwnerCommandTransportReceiptV1 | undefined;
      let failure: OwnerCommandTransportErrorV1 | undefined;
      try {
        receipt = snapshotReceiptV1(await dispatch({
          owner_service: ownerOutbox.owner_service,
          outbox_table: outboxTable,
          record,
          current_transport_epoch: config.transport_epoch,
          current_transport_generation: config.transport_generation,
        }, signal));
        signal?.throwIfAborted();
      } catch (error) {
        signal?.throwIfAborted();
        failure = error instanceof OwnerCommandTransportErrorV1
          ? error
          : new OwnerCommandTransportErrorV1(
              "command_delivery_outcome_ambiguous",
              true,
              true,
              "command delivery outcome is ambiguous",
              { cause: error },
            );
      }
      const acknowledgedAt = now();
      if (failure === undefined) {
        await acknowledge({
          outbox_table: outboxTable,
          outbox_id: outboxId as string,
          claim_token: claimToken as string,
          outcome: "sent",
          next_retry_at: null,
          error: null,
          transport_ref: receipt!.transport_ref,
          transport_epoch: config.transport_epoch,
          transport_generation: config.transport_generation,
          current_transport_epoch: config.transport_epoch,
          current_transport_generation: config.transport_generation,
          now: acknowledgedAt.toISOString(),
        });
        signal?.throwIfAborted();
        sent += 1;
        continue;
      }
      const exhausted = attemptCount >= maxAttempts;
      const retryable =
        failure.outcome_ambiguous || (failure.retryable && !exhausted);
      await acknowledge({
        outbox_table: outboxTable,
        outbox_id: outboxId as string,
        claim_token: claimToken as string,
        outcome: retryable ? "retry_wait" : "failed",
        next_retry_at: retryable
          ? new Date(
              acknowledgedAt.getTime() +
                retryDelayV1(
                  attemptCount,
                  retryBaseDelayMs,
                  retryMaxDelayMs,
                  jitter,
                  random,
                ),
            ).toISOString()
          : null,
        error: {
          code:
            exhausted && failure.retryable && !failure.outcome_ambiguous
              ? "command_delivery_retry_exhausted"
              : failure.code,
          retryable,
          outcome_ambiguous: failure.outcome_ambiguous,
        },
        transport_ref: null,
        transport_epoch: null,
        transport_generation: null,
        current_transport_epoch: config.transport_epoch,
        current_transport_generation: config.transport_generation,
        now: acknowledgedAt.toISOString(),
      });
      signal?.throwIfAborted();
      if (retryable) retryWait += 1;
      else failed += 1;
    }
    return Object.freeze({
      claimed: claimed.length,
      sent,
      retry_wait: retryWait,
      failed,
    });
  };

  let state: OwnerCommandDispatchRuntimeV1["state"] = "idle";
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active: Promise<OwnerCommandDispatchSummaryV1> | undefined;
  let activeController: AbortController | undefined;
  let closePromise: Promise<void> | undefined;
  let lastError: unknown;

  const runtime: OwnerCommandDispatchRuntimeV1 = {
    get state() {
      return state;
    },
    command_outbox_tables: commandOutboxTables,
    start() {
      if (state === "running") return;
      if (state !== "idle") {
        throw new Error("owner command dispatch runtime cannot be restarted");
      }
      state = "running";
      void runCycle();
    },
    async runOnce(signal?: AbortSignal) {
      let summary: OwnerCommandDispatchSummaryV1 = EMPTY_SUMMARY_V1;
      for (const table of commandOutboxTables) {
        signal?.throwIfAborted();
        summary = addSummaryV1(summary, await dispatchTable(table, signal));
      }
      return summary;
    },
    async checkReadiness(signal?: AbortSignal) {
      signal?.throwIfAborted();
      if (state !== "running") {
        throw new Error("owner command dispatch runtime is not running");
      }
      await checkTransportReadiness(signal);
      signal?.throwIfAborted();
      if (lastError !== undefined) {
        throw new Error("owner command dispatch loop has not recovered", {
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
          new Error("owner command dispatch runtime is stopping"),
        );
        await active?.catch(() => undefined);
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
      if (state === "running") {
        lastError = error;
        try {
          await config.on_error?.(error);
        } catch {
          // Diagnostic sinks cannot terminate the durable dispatch loop.
        }
      }
    } finally {
      active = undefined;
      activeController = undefined;
      schedule();
    }
  }

  return Object.freeze(runtime);
}

export async function openOwnerCommandDispatchRuntimeFromEnvV1(
  ownerOutbox: OwnerOutboxStorePortV1,
  input: OwnerCommandDispatchRuntimeEnvironmentV1,
): Promise<OwnerCommandDispatchRuntimeV1 | undefined> {
  const commandTables = ownerOutbox.outbox_tables.filter((table) =>
    table.endsWith("command_outbox"));
  if (commandTables.length === 0) return undefined;
  const env = input.env ?? process.env;
  const epoch = env.PAI_INTERNAL_HTTP_TRANSPORT_EPOCH;
  const generation = environmentIntegerV1(
    "PAI_INTERNAL_HTTP_TRANSPORT_GENERATION",
    env.PAI_INTERNAL_HTTP_TRANSPORT_GENERATION,
  );
  if (epoch === undefined && generation === undefined) {
    if (input.production_dependencies_required) {
      throw new Error(
        "PAI_INTERNAL_HTTP_TRANSPORT_EPOCH and PAI_INTERNAL_HTTP_TRANSPORT_GENERATION are required for durable owner commands in production",
      );
    }
    return undefined;
  }
  if (epoch === undefined || epoch.length === 0 || generation === undefined) {
    throw new Error(
      "PAI_INTERNAL_HTTP_TRANSPORT_EPOCH and PAI_INTERNAL_HTTP_TRANSPORT_GENERATION must be configured together",
    );
  }
  const ownerService = ownerOutbox.owner_service;
  if (!(ownerService in OWNER_EVENT_SCHEMA_V1)) {
    throw new Error("owner service has no PostgreSQL transport epoch authority");
  }
  await ensureActiveOwnerTransportEpochV1(
    ownerService as keyof typeof OWNER_EVENT_SCHEMA_V1,
    input.transport_epoch_postgres,
    COMMAND_TRANSPORT_NAME_V1,
    epoch,
    generation,
  );
  return createOwnerCommandDispatchRuntimeV1(ownerOutbox, input.transport, {
    transport_epoch: epoch,
    transport_generation: generation,
    worker_id:
      env.PAI_COMMAND_DISPATCH_WORKER_ID ??
      env.HOSTNAME ??
      `${ownerService}:command:pid:${process.pid}`,
  });
}
