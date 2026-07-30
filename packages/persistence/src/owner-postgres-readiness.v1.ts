export interface OwnerPostgresAbortableClientV1 {
  release(destroy?: boolean): void;
}

export interface OwnerPostgresCatalogClientV1
  extends OwnerPostgresAbortableClientV1 {
  query<TRow extends Record<string, unknown>>(
    sql: string,
    values?: readonly unknown[],
  ): Promise<{ readonly rows: readonly TRow[] }>;
}

interface OwnerPostgresReadinessClientV1
  extends OwnerPostgresAbortableClientV1 {
  query(sql: string): Promise<unknown>;
}

export interface OwnerPostgresReadinessPoolV1 {
  connect(): Promise<OwnerPostgresReadinessClientV1>;
}

const OWNER_POSTGRES_READINESS_STATEMENT_TIMEOUT_MS_V1 = 1_000;

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new Error("owner PostgreSQL readiness check was aborted");
}

async function acquireAbortableClientV1<
  TClient extends OwnerPostgresAbortableClientV1,
>(
  pool: Readonly<{ connect(): Promise<TClient> }>,
  signal: AbortSignal,
): Promise<TClient> {
  if (signal.aborted) throw abortReason(signal);
  return new Promise((resolve, reject) => {
    let aborted = false;
    let reason: unknown;
    const onAbort = (): void => {
      aborted = true;
      reason = abortReason(signal);
    };
    signal.addEventListener("abort", onAbort, { once: true });
    let acquisition: Promise<TClient>;
    try {
      acquisition = pool.connect();
    } catch (error) {
      signal.removeEventListener("abort", onAbort);
      reject(error);
      return;
    }
    void acquisition.then(
      (client) => {
        signal.removeEventListener("abort", onAbort);
        if (aborted || signal.aborted) {
          // pg cannot cancel a queued Pool.connect. Release a late acquisition
          // immediately. Do not settle the shared readiness task before this
          // point, otherwise each new probe could enqueue another uncancellable
          // pool waiter and defeat the single-flight bulkhead.
          try {
            client.release();
            reject(reason ?? abortReason(signal));
          } catch (error) {
            reject(error);
          }
          return;
        }
        resolve(client);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(aborted || signal.aborted ? reason ?? abortReason(signal) : error);
      },
    );
  });
}

/**
 * Runs a bounded PostgreSQL operation on one owned client. Aborting destroys
 * that exact connection so a blocked query cannot outlive the shared
 * readiness attempt or leak work back into the pool.
 */
export async function withAbortableOwnerPostgresClientV1<
  TClient extends OwnerPostgresAbortableClientV1,
  TResult,
>(
  pool: Readonly<{ connect(): Promise<TClient> }>,
  signal: AbortSignal,
  operation: (client: TClient) => Promise<TResult>,
): Promise<TResult> {
  const client = await acquireAbortableClientV1(pool, signal);
  if (signal.aborted) {
    client.release();
    throw abortReason(signal);
  }

  let released = false;
  let abortRequested = false;
  let rejectForAbort!: (reason: unknown) => void;
  const aborted = new Promise<never>((_resolve, reject) => {
    rejectForAbort = reject;
  });
  const operationPromise = Promise.resolve().then(async () => {
    if (signal.aborted) throw abortReason(signal);
    return operation(client);
  });
  const onAbort = (): void => {
    try {
      abortRequested = true;
      released = true;
      client.release(true);
      rejectForAbort(abortReason(signal));
    } catch (error) {
      rejectForAbort(error);
    }
  };
  signal.addEventListener("abort", onAbort, { once: true });
  try {
    return await Promise.race([
      operationPromise,
      aborted,
    ]);
  } finally {
    signal.removeEventListener("abort", onAbort);
    if (abortRequested) {
      await operationPromise.catch(() => undefined);
    } else if (!released) {
      client.release();
    }
  }
}

/**
 * Runs catalog attestation in one bounded, read-only snapshot. SET LOCAL keeps
 * the timeout scoped to this transaction, while the abort wrapper destroys
 * the exact client if any catalog statement remains blocked past readiness.
 */
export async function withAbortableOwnerPostgresCatalogSnapshotV1<
  TClient extends OwnerPostgresCatalogClientV1,
  TResult,
>(
  pool: Readonly<{ connect(): Promise<TClient> }>,
  signal: AbortSignal,
  statementTimeoutMs: number,
  operation: (client: TClient) => Promise<TResult>,
): Promise<TResult> {
  if (
    !Number.isSafeInteger(statementTimeoutMs) ||
    statementTimeoutMs <= 0
  ) {
    throw new Error(
      "owner PostgreSQL catalog statement timeout must be a positive integer",
    );
  }
  return withAbortableOwnerPostgresClientV1(
    pool,
    signal,
    async (client) => {
      let transactionOpen = false;
      const throwIfAborted = (): void => {
        if (signal.aborted) throw abortReason(signal);
      };
      try {
        throwIfAborted();
        await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
        transactionOpen = true;
        await client.query(
          `SET LOCAL statement_timeout = '${statementTimeoutMs}ms'`,
        );
        throwIfAborted();
        const result = await operation(client);
        throwIfAborted();
        await client.query("COMMIT");
        transactionOpen = false;
        return result;
      } catch (error) {
        if (transactionOpen) {
          await client.query("ROLLBACK").catch(() => undefined);
        }
        throwIfAborted();
        throw error;
      }
    },
  );
}

/**
 * Uses a dedicated pooled client so an expired shared readiness attempt can
 * destroy the active connection. This is a real cancellation boundary: merely
 * racing Pool.query would leave its acquisition/query queued after the probe
 * had already returned.
 *
 * The optional SQL exists only for the live cancellation contract test. The
 * production composition always uses the fixed SELECT 1 default.
 */
export async function checkOwnerPostgresReadinessV1(
  pool: OwnerPostgresReadinessPoolV1,
  signal: AbortSignal,
  sql = "SELECT 1 AS owner_postgres_ready",
): Promise<void> {
  await withAbortableOwnerPostgresClientV1(
    pool,
    signal,
    async (client) => {
      let statementTimeoutConfigured = false;
      try {
        await client.query(
          `SET statement_timeout = '${OWNER_POSTGRES_READINESS_STATEMENT_TIMEOUT_MS_V1}ms'`,
        );
        statementTimeoutConfigured = true;
        if (signal.aborted) throw abortReason(signal);
        await client.query(sql);
        if (signal.aborted) throw abortReason(signal);
      } finally {
        if (statementTimeoutConfigured) {
          await client.query("RESET statement_timeout").catch(() => undefined);
        }
      }
    },
  );
}
