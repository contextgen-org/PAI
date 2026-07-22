import { createClient } from "redis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  canonicalJsonV1,
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
    stream_epoch: "epoch_20260722",
    stream_generation: 1,
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
      payload: {
        scope_kind: "bot",
        workspace_id: "workspace_live_001",
        bot_id: "bot_live_001",
        owner_agent_id: "owner_agent_live_001",
        deployment_environment: "local",
        release_channel: "stable",
        occurrence_id: "timer_occurrence_live_001",
        schedule_id: "timer_schedule_live_001",
        scheduled_fire_at: "2026-07-21T05:00:00.000Z",
        effective_fire_at: "2026-07-21T05:00:00.000Z",
        dedupe_key: "timer:timer_occurrence_live_001",
        is_catch_up: false,
      },
    } as const;
    const published = await composition!.transport.publish({
      target,
      envelope,
      payload_hash: canonicalPayloadHashV1(envelope.payload),
      current_transport_epoch: "epoch_20260722",
      current_transport_generation: 1,
    });
    expect(published.transport_ref).toMatch(/^redis_stream:/);
    expect(published.transport_epoch).toBe("epoch_20260722");
    expect(published.transport_generation).toBe(1);
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
      payload: canonicalJsonV1(envelope.payload),
    });
    expect(await reader!.info("commandstats")).toMatch(
      /cmdstat_waitaof:calls=[1-9]\d*/u,
    );
  });

  it("rejects environment or release-channel scope drift before XADD", async () => {
    const before = await reader!.xLen(physicalStream);
    const baseEnvelope = {
      event_id: "evt_scope_drift_001",
      event_type: "timer.occurrence.due",
      schema_version: "timer_event.v1",
      producer: "timer_trigger_app",
      occurred_at: "2026-07-21T05:00:00.000Z",
      idempotency_key: "scope_drift_001:due",
      trace_id: "trace_scope_drift_001",
      payload: {
        scope_kind: "bot",
        workspace_id: "workspace_live_001",
        bot_id: "bot_live_001",
        owner_agent_id: "owner_agent_live_001",
        deployment_environment: "prod",
        release_channel: "stable",
        occurrence_id: "scope_drift_001",
        schedule_id: "scope_schedule_001",
        scheduled_fire_at: "2026-07-21T05:00:00.000Z",
        effective_fire_at: "2026-07-21T05:00:00.000Z",
        dedupe_key: "timer:scope_drift_001",
        is_catch_up: false,
      },
    } as const;
    await expect(
      composition!.transport.publish({
        target,
        envelope: baseEnvelope,
        payload_hash: canonicalPayloadHashV1(baseEnvelope.payload),
        current_transport_epoch: "epoch_20260722",
        current_transport_generation: 1,
      }),
    ).rejects.toThrow(/environment\/channel namespace/u);
    const channelDrift = {
      ...baseEnvelope,
      event_id: "evt_scope_drift_002",
      idempotency_key: "scope_drift_002:due",
      payload: {
        ...baseEnvelope.payload,
        deployment_environment: "local",
        release_channel: "canary",
      },
    } as const;
    await expect(
      composition!.transport.publish({
        target,
        envelope: channelDrift,
        payload_hash: canonicalPayloadHashV1(channelDrift.payload),
        current_transport_epoch: "epoch_20260722",
        current_transport_generation: 1,
      }),
    ).rejects.toThrow(/environment\/channel namespace/u);
    expect(await reader!.xLen(physicalStream)).toBe(before);
  });

  it("rejects a cross-owner or unknown event before XADD", async () => {
    const before = await reader!.xLen(physicalStream);
    const actionEnvelope = {
      event_id: "evt_cross_owner_001",
      event_type: "runtime.run.completed",
      schema_version: "runtime_event.v1",
      producer: "action_runtime",
      occurred_at: "2026-07-21T05:00:00.000Z",
      idempotency_key: "runtime_run_001:completed",
      trace_id: "trace_cross_owner_001",
      payload: {
        scope_kind: "bot",
        workspace_id: "workspace_live_001",
        bot_id: "bot_live_001",
        owner_agent_id: "owner_agent_live_001",
        deployment_environment: "local",
        release_channel: "stable",
        runtime_run_id: "runtime_run_001",
        outcome: "completed",
      },
    } as const;
    await expect(
      composition!.transport.publish({
        target,
        envelope: actionEnvelope,
        payload_hash: canonicalPayloadHashV1(actionEnvelope.payload),
        current_transport_epoch: "epoch_20260722",
        current_transport_generation: 1,
      }),
    ).rejects.toMatchObject({ code: "transport_rejected", retryable: false });

    const unknownTimerEnvelope = {
      ...actionEnvelope,
      event_id: "evt_unknown_timer_001",
      event_type: "timer.occurrence.unregistered",
      producer: "timer_trigger_app",
      idempotency_key: "timer_occurrence_001:unregistered",
    } as const;
    await expect(
      composition!.transport.publish({
        target,
        envelope: unknownTimerEnvelope,
        payload_hash: canonicalPayloadHashV1(unknownTimerEnvelope.payload),
        current_transport_epoch: "epoch_20260722",
        current_transport_generation: 1,
      }),
    ).rejects.toMatchObject({ code: "transport_rejected", retryable: false });
    expect(await reader!.xLen(physicalStream)).toBe(before);
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
