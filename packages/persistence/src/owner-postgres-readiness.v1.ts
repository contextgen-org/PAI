interface OwnerPostgresReadinessClientV1 {
  query(sql: string): Promise<unknown>;
  release(destroy?: boolean): void;
}

export interface OwnerPostgresReadinessPoolV1 {
  connect(): Promise<OwnerPostgresReadinessClientV1>;
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new Error("owner PostgreSQL readiness check was aborted");
}

async function acquireReadinessClientV1(
  pool: OwnerPostgresReadinessPoolV1,
  signal: AbortSignal,
): Promise<OwnerPostgresReadinessClientV1> {
  if (signal.aborted) throw abortReason(signal);
  return new Promise((resolve, reject) => {
    let aborted = false;
    let reason: unknown;
    const onAbort = (): void => {
      aborted = true;
      reason = abortReason(signal);
    };
    signal.addEventListener("abort", onAbort, { once: true });
    let acquisition: Promise<OwnerPostgresReadinessClientV1>;
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
  const client = await acquireReadinessClientV1(pool, signal);
  if (signal.aborted) {
    client.release();
    throw abortReason(signal);
  }

  let released = false;
  let rejectForAbort!: (reason: unknown) => void;
  const aborted = new Promise<never>((_resolve, reject) => {
    rejectForAbort = reject;
  });
  const onAbort = (): void => {
    try {
      released = true;
      client.release(true);
      rejectForAbort(abortReason(signal));
    } catch (error) {
      rejectForAbort(error);
    }
  };
  signal.addEventListener("abort", onAbort, { once: true });
  try {
    await Promise.race([client.query(sql), aborted]);
    if (signal.aborted) throw abortReason(signal);
  } finally {
    signal.removeEventListener("abort", onAbort);
    if (!released) client.release();
  }
}
