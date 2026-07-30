import { afterEach, describe, expect, it } from "vitest";

import {
  openRedisRuntimeTokenLiveBusV1,
  type RedisRuntimeTokenLiveBusV1,
} from "../src/runtime-token-live-bus.v1.js";

const redisUrl = process.env.PAI_TEST_REDIS_URL;
const describeRedis = redisUrl === undefined ? describe.skip : describe;

describeRedis("Action Runtime live token Redis bus", () => {
  let bus: RedisRuntimeTokenLiveBusV1 | undefined;

  afterEach(async () => {
    await bus?.close();
    bus = undefined;
  });

  it("publishes an ephemeral scope-bound frame and cooperatively closes the subscriber", async () => {
    if (redisUrl === undefined) throw new Error("PAI_TEST_REDIS_URL is required");
    bus = await openRedisRuntimeTokenLiveBusV1(redisUrl);
    await bus.source.checkReadiness();
    const controller = new AbortController();
    const identity = {
      runtime_run_id: "runtime-token-live-01",
      trigger_process_id: "trigger-token-live-01",
      scope: {
        workspace_id: "workspace-token-live-01",
        bot_id: "bot-token-live-01",
        owner_agent_id: "agent-token-live-01",
        deployment_environment: "prod" as const,
        release_channel: "stable" as const,
      },
    };
    const iterator = bus.source
      .stream(identity, controller.signal)
      [Symbol.asyncIterator]();
    const framePromise = iterator.next();
    let frame: Awaited<typeof framePromise> | undefined;
    for (let attempt = 0; attempt < 20 && frame === undefined; attempt += 1) {
      await bus.publisher.publish({
        ...identity,
        token: "delivery-token",
        emitted_at: "2026-07-27T12:00:00.000Z",
      });
      frame = await Promise.race([
        framePromise,
        new Promise<undefined>((resolve) =>
          setTimeout(() => resolve(undefined), 20),
        ),
      ]);
    }
    expect(frame).toEqual({
      done: false,
      value: {
        schema_version: "runtime_token_sse_event.v1",
        runtime_run_id: "runtime-token-live-01",
        trigger_process_id: "trigger-token-live-01",
        token: "delivery-token",
        emitted_at: "2026-07-27T12:00:00.000Z",
      },
    });
    controller.abort(new Error("client disconnected"));
    await expect(iterator.next()).resolves.toEqual({
      done: true,
      value: undefined,
    });
  });
});
