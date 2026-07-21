import { createClient } from "redis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  canonicalPayloadHashV1,
  createRedisNamespaceV1,
  namespacedRedisKeyV1,
  openVerifiedRedisStreamCompositionV1,
  type VerifiedRedisStreamCompositionV1,
} from "../src/index.js";

const redisUrl = process.env.PAI_TEST_REDIS_URL;
const describeRedis = redisUrl === undefined ? describe.skip : describe;

describeRedis("locked Redis 8.8 Stream integration", () => {
  const namespace = createRedisNamespaceV1({
    deployment_environment: "local",
    release_channel: "stable",
    owner_service: "timer_trigger_app",
  });
  const target = "trigger_processor.timer_submit";
  const logicalStream = "stream:timer_events";
  const physicalStream = namespacedRedisKeyV1(namespace, logicalStream);
  let composition: VerifiedRedisStreamCompositionV1 | undefined;
  const reader = redisUrl === undefined ? undefined : createClient({ url: redisUrl });

  beforeAll(async () => {
    if (redisUrl === undefined || reader === undefined) {
      throw new Error("PAI_TEST_REDIS_URL is required");
    }
    reader.on("error", () => undefined);
    await reader.connect();
    await reader.del(physicalStream);
    composition = await openVerifiedRedisStreamCompositionV1({
      url: redisUrl,
      namespace,
      routes: { [target]: logicalStream },
    });
  });

  afterAll(async () => {
    await composition?.close();
    if (reader?.isOpen === true) {
      await reader.del(physicalStream);
      await reader.close();
    }
  });

  it("publishes the canonical eight-field envelope into its physical namespace", async () => {
    const envelope = {
      event_id: "evt_timer_live_001",
      event_type: "timer.occurrence.due",
      schema_version: "timer_event.v1",
      producer: "timer_trigger_app",
      occurred_at: "2026-07-21T05:00:00.000Z",
      idempotency_key: "timer_occurrence_live_001:due",
      trace_id: "trace_timer_live_001",
      payload: { occurrence_id: "timer_occurrence_live_001" },
    } as const;
    const published = await composition!.transport.publish({
      target,
      envelope,
      payload_hash: canonicalPayloadHashV1(envelope.payload),
    });
    expect(published.transport_ref).toMatch(/^redis_stream:/);
    await expect(composition!.checkReadiness()).resolves.toBeUndefined();
    expect(composition!.baseline).toMatchObject({ server_version: "8.8.0" });

    const entries = await reader!.xRange(
      physicalStream,
      "-",
      "+",
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]?.message).toEqual({
      event_id: envelope.event_id,
      event_type: envelope.event_type,
      schema_version: envelope.schema_version,
      producer: envelope.producer,
      occurred_at: envelope.occurred_at,
      idempotency_key: envelope.idempotency_key,
      trace_id: envelope.trace_id,
      payload: JSON.stringify(envelope.payload),
    });
    expect(await reader!.info("commandstats")).toMatch(
      /cmdstat_waitaof:calls=[1-9]\d*/u,
    );
  });

  it("fails a paused readiness command promptly and recovers on the same composition", async () => {
    await reader!.clientPause(300, "ALL");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 100);
    try {
      await expect(
        composition!.checkReadiness(controller.signal),
      ).rejects.toMatchObject({ code: "readiness_failed", retryable: true });
      expect(composition!.dependencyState()).toMatchObject({
        status: "degraded",
        consecutive_failures: 1,
      });
    } finally {
      clearTimeout(timer);
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
    await expect(composition!.checkReadiness()).resolves.toBeUndefined();
    expect(composition!.dependencyState()).toMatchObject({
      status: "healthy",
      consecutive_failures: 0,
    });
  });
});
