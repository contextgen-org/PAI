import { describe, expect, it } from "vitest";

import {
  checkOwnerPostgresReadinessV1,
  withAbortableOwnerPostgresCatalogSnapshotV1,
  type OwnerPostgresReadinessPoolV1,
} from "../src/owner-postgres-readiness.v1.js";

function deferred<T>(): Readonly<{
  promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
}> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("owner PostgreSQL readiness cancellation", () => {
  it("destroys the client that owns an active query when the shared attempt aborts", async () => {
    const query = deferred<unknown>();
    const releaseCalls: Array<boolean | undefined> = [];
    const statements: string[] = [];
    let queryStarted = false;
    const pool: OwnerPostgresReadinessPoolV1 = {
      async connect() {
        return {
          async query(sql: string) {
            statements.push(sql);
            if (
              sql.startsWith("SET statement_timeout") ||
              sql === "RESET statement_timeout"
            ) {
              return undefined;
            }
            queryStarted = true;
            return query.promise;
          },
          release(destroy) {
            releaseCalls.push(destroy);
            if (destroy === true) query.reject(new Error("connection destroyed"));
          },
        };
      },
    };
    const controller = new AbortController();
    const readiness = checkOwnerPostgresReadinessV1(pool, controller.signal);
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(queryStarted).toBe(true);

    controller.abort(new Error("readiness deadline exceeded"));

    await expect(readiness).rejects.toThrow("readiness deadline exceeded");
    expect(releaseCalls).toEqual([true]);
    expect(statements).toEqual([
      "SET statement_timeout = '1000ms'",
      "SELECT 1 AS owner_postgres_ready",
      "RESET statement_timeout",
    ]);
  });

  it("retains the shared task while acquiring and releases a client that arrives late", async () => {
    const acquired = deferred<Awaited<ReturnType<OwnerPostgresReadinessPoolV1["connect"]>>>();
    const releaseCalls: Array<boolean | undefined> = [];
    let queryCalls = 0;
    const pool: OwnerPostgresReadinessPoolV1 = {
      connect: async () => acquired.promise,
    };
    const controller = new AbortController();
    const readiness = checkOwnerPostgresReadinessV1(pool, controller.signal);
    let settled = false;
    void readiness.finally(() => {
      settled = true;
    }).catch(() => undefined);
    controller.abort(new Error("readiness deadline exceeded"));

    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(settled).toBe(false);
    expect(queryCalls).toBe(0);
    expect(releaseCalls).toEqual([]);

    acquired.resolve({
      async query() {
        queryCalls += 1;
      },
      release(destroy) {
        releaseCalls.push(destroy);
      },
    });
    await expect(readiness).rejects.toThrow("readiness deadline exceeded");
    expect(settled).toBe(true);
    expect(queryCalls).toBe(0);
    expect(releaseCalls).toEqual([undefined]);
  });

  it("returns a healthy result and releases the client for a completed query", async () => {
    const releaseCalls: Array<boolean | undefined> = [];
    const statements: string[] = [];
    const pool: OwnerPostgresReadinessPoolV1 = {
      async connect() {
        return {
          async query(sql: string) {
            statements.push(sql);
            return { rows: [{ owner_postgres_ready: 1 }] };
          },
          release(destroy) {
            releaseCalls.push(destroy);
          },
        };
      },
    };

    await expect(
      checkOwnerPostgresReadinessV1(pool, new AbortController().signal),
    ).resolves.toBeUndefined();
    expect(releaseCalls).toEqual([undefined]);
    expect(statements).toEqual([
      "SET statement_timeout = '1000ms'",
      "SELECT 1 AS owner_postgres_ready",
      "RESET statement_timeout",
    ]);
  });

  it("bounds catalog revalidation inside one read-only snapshot", async () => {
    const statements: string[] = [];
    const releaseCalls: Array<boolean | undefined> = [];
    const pool = {
      async connect() {
        return {
          async query<TRow extends Record<string, unknown>>(sql: string) {
            statements.push(sql);
            return { rows: [] as TRow[] };
          },
          release(destroy?: boolean) {
            releaseCalls.push(destroy);
          },
        };
      },
    };

    await expect(
      withAbortableOwnerPostgresCatalogSnapshotV1(
        pool,
        new AbortController().signal,
        5_000,
        async (client) => {
          await client.query("SELECT catalog_attestation");
          return "verified";
        },
      ),
    ).resolves.toBe("verified");
    expect(statements).toEqual([
      "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY",
      "SET LOCAL statement_timeout = '5000ms'",
      "SELECT catalog_attestation",
      "COMMIT",
    ]);
    expect(releaseCalls).toEqual([undefined]);
  });

  it("destroys the catalog snapshot client when revalidation aborts", async () => {
    const blockedCatalogQuery = deferred<{
      readonly rows: readonly Record<string, unknown>[];
    }>();
    const statements: string[] = [];
    const releaseCalls: Array<boolean | undefined> = [];
    let destroyed = false;
    const pool = {
      async connect() {
        return {
          async query<TRow extends Record<string, unknown>>(sql: string) {
            statements.push(sql);
            if (destroyed) throw new Error("connection destroyed");
            if (sql === "SELECT blocked_catalog_attestation") {
              return blockedCatalogQuery.promise as Promise<{
                readonly rows: readonly TRow[];
              }>;
            }
            return { rows: [] as TRow[] };
          },
          release(destroy?: boolean) {
            releaseCalls.push(destroy);
            if (destroy === true) {
              destroyed = true;
              blockedCatalogQuery.reject(new Error("connection destroyed"));
            }
          },
        };
      },
    };
    const controller = new AbortController();
    const readiness = withAbortableOwnerPostgresCatalogSnapshotV1(
      pool,
      controller.signal,
      5_000,
      async (client) => {
        await client.query("SELECT blocked_catalog_attestation");
      },
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(statements).toEqual([
      "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY",
      "SET LOCAL statement_timeout = '5000ms'",
      "SELECT blocked_catalog_attestation",
    ]);

    controller.abort(new Error("catalog readiness deadline exceeded"));

    await expect(readiness).rejects.toThrow(
      "catalog readiness deadline exceeded",
    );
    expect(releaseCalls).toEqual([true]);
  });
});
