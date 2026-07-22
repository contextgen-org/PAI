import { describe, expect, it } from "vitest";

import {
  checkOwnerPostgresReadinessV1,
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
    let queryStarted = false;
    const pool: OwnerPostgresReadinessPoolV1 = {
      async connect() {
        return {
          async query() {
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
    const pool: OwnerPostgresReadinessPoolV1 = {
      async connect() {
        return {
          async query() {
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
  });
});
