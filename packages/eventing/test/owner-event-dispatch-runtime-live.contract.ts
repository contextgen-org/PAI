import { randomUUID } from "node:crypto";

import type { OwnerOutboxStorePortV1 } from "@pai/persistence";
import { describe, expect, it } from "vitest";

import {
  openOwnerEventDispatchRuntimeFromEnvV1,
  openOwnerEventDispatchRuntimeV1,
} from "../src/index.js";

const redisUrl = process.env.PAI_TEST_REDIS_URL;
const describeRedis = redisUrl === undefined ? describe.skip : describe;

function emptyOwnerOutbox(): OwnerOutboxStorePortV1<"trigger_processor"> {
  return {
    owner_service: "trigger_processor",
    outbox_tables: Object.freeze(["trigger_event_outbox"]),
    async claim<TResult extends Readonly<Record<string, unknown>>>() {
      return Object.freeze([]) as readonly TResult[];
    },
    async acknowledge() {
      return Object.freeze({ acknowledged: true as const });
    },
  };
}

describe("owner event dispatch environment", () => {
  it("allows an absent local transport but rejects partial and production gaps", async () => {
    const ownerOutbox = emptyOwnerOutbox();
    await expect(
      openOwnerEventDispatchRuntimeFromEnvV1(ownerOutbox, {
        deployment_environment: "local",
        release_channel: "stable",
        production_dependencies_required: false,
        env: {},
      }),
    ).resolves.toBeUndefined();
    await expect(
      openOwnerEventDispatchRuntimeFromEnvV1(ownerOutbox, {
        deployment_environment: "local",
        release_channel: "stable",
        production_dependencies_required: false,
        env: { PAI_REDIS_URL: "redis://127.0.0.1:6379" },
      }),
    ).rejects.toThrow(/must be configured together/u);
    await expect(
      openOwnerEventDispatchRuntimeFromEnvV1(ownerOutbox, {
        deployment_environment: "prod",
        release_channel: "stable",
        production_dependencies_required: true,
        env: {},
      }),
    ).rejects.toThrow(/required for durable owner events/u);
    await expect(
      openOwnerEventDispatchRuntimeFromEnvV1(ownerOutbox, {
        deployment_environment: "local",
        release_channel: "stable",
        production_dependencies_required: false,
        env: {
          PAI_REDIS_URL: "redis://127.0.0.1:6379",
          PAI_EVENT_STREAM_EPOCH: "epoch_2",
          PAI_EVENT_STREAM_GENERATION: "2",
        },
      }),
    ).rejects.toThrow(/verified owner PostgreSQL is required/u);
  });
});

describeRedis("owner event dispatch production runtime", () => {
  it("atomically advances and then joins the configured owner transport fence", async () => {
    if (redisUrl === undefined) throw new Error("PAI_TEST_REDIS_URL is required");
    let active = { active_epoch: "bootstrap", active_generation: "1" };
    let activationCount = 0;
    const postgres = {
      async query<TRow extends Record<string, unknown>>(
        sql: string,
        values: readonly unknown[] = [],
      ) {
        if (sql.includes("activate_eventing_transport_epoch_v1")) {
          expect(values.slice(0, 4)).toEqual([
            "redis_stream",
            1,
            "contract_epoch_2",
            2,
          ]);
          activationCount += 1;
          active = {
            active_epoch: "contract_epoch_2",
            active_generation: "2",
          };
          return { rows: [{ result: {} }] as unknown as readonly TRow[] };
        }
        return { rows: [active] as unknown as readonly TRow[] };
      },
    };
    const open = () =>
      openOwnerEventDispatchRuntimeFromEnvV1(emptyOwnerOutbox(), {
        deployment_environment: "local",
        release_channel: "stable",
        production_dependencies_required: false,
        transport_epoch_postgres: postgres,
        env: {
          PAI_REDIS_URL: redisUrl,
          PAI_EVENT_STREAM_EPOCH: "contract_epoch_2",
          PAI_EVENT_STREAM_GENERATION: "2",
          PAI_EVENT_DISPATCH_WORKER_ID: "event-runtime-fence-contract",
        },
      });
    const first = await open();
    if (first === undefined) throw new Error("event runtime was not composed");
    await first.close();
    const second = await open();
    if (second === undefined) throw new Error("event runtime was not composed");
    await second.close();
    expect(activationCount).toBe(1);
  });

  it("opens the verified Redis baseline and runs the PostgreSQL owner shell", async () => {
    if (redisUrl === undefined) throw new Error("PAI_TEST_REDIS_URL is required");
    const ownerOutbox = emptyOwnerOutbox();
    const runtime = await openOwnerEventDispatchRuntimeV1(ownerOutbox, {
      redis_url: redisUrl,
      deployment_environment: "local",
      release_channel: "stable",
      stream_epoch: `contract_${randomUUID().replaceAll("-", "")}`,
      stream_generation: 1,
      worker_id: "event-runtime-contract",
      retry_jitter: "none",
      poll_interval_ms: 60_000,
    });
    try {
      expect(runtime.state).toBe("idle");
      runtime.start();
      await runtime.checkReadiness();
      await expect(runtime.runOnce()).resolves.toEqual({
        claimed: 0,
        sent: 0,
        retry_wait: 0,
        failed: 0,
      });
      expect(runtime.event_outbox_tables).toEqual(["trigger_event_outbox"]);
    } finally {
      await runtime.close();
    }
    expect(runtime.state).toBe("stopped");
  });
});
