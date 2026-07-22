import { createClient } from "redis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  buildRedisStreamMessageV1,
  canonicalPayloadHashV1,
  createRedisNamespaceV1,
  namespacedRedisKeyV1,
  openVerifiedRedisStreamCompositionV1,
  type VerifiedRedisStreamCompositionV1,
} from "../src/index.js";

const redisUrl = process.env.PAI_TEST_REDIS_URL;
const describeRedis = redisUrl === undefined ? describe.skip : describe;

describeRedis("Redis same-generation reference reconciliation", () => {
  const namespace = createRedisNamespaceV1({
    deployment_environment: "local",
    release_channel: "stable",
    owner_service: "trigger_processor",
    stream_epoch: "epoch_reconciliation_live",
    stream_generation: 1,
  });
  const target = "trigger_processor.admission_audit";
  const logicalStream = "stream:reconciliation_events";
  const physicalStream = namespacedRedisKeyV1(namespace, logicalStream);
  const reader = redisUrl === undefined ? undefined : createClient({ url: redisUrl });
  let composition: VerifiedRedisStreamCompositionV1 | undefined;

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

  it("finds and then detects deletion of the exact persisted transport ref", async () => {
    const envelope = {
      event_id: "evt_reconciliation_live_001",
      event_type: "trigger.rejected",
      schema_version: "trigger_processor_event.v1",
      producer: "trigger_processor",
      occurred_at: "2026-07-22T06:00:00.000Z",
      idempotency_key: "reconciliation_live_001:rejected",
      trace_id: "trace_reconciliation_live_001",
      payload: {
        workspace_id: "workspace_live_001",
        bot_id: "bot_live_001",
        owner_agent_id: "owner_agent_live_001",
        deployment_environment: "local",
        release_channel: "stable",
        reason_code: "business_admission_rejected",
        source_ref: "trigger_event:reconciliation_live_001",
        submit_attempt_id: "reconciliation_live_001",
        rejection_stage: "business_admission",
        rejection_code: "admission_capacity_exceeded",
      },
    } as const;
    const receipt = await composition!.transport.publish({
      target,
      envelope,
      payload_hash: canonicalPayloadHashV1(envelope.payload),
      current_transport_epoch: namespace.stream_epoch,
      current_transport_generation: namespace.stream_generation,
    });
    await expect(
      composition!.referenceProbe.probe({
        target,
        transport_ref: receipt.transport_ref,
        expected_envelope: envelope,
        expected_payload_hash: canonicalPayloadHashV1(envelope.payload),
      }),
    ).resolves.toEqual({ status: "present" });

    const streamId = receipt.transport_ref.slice(
      receipt.transport_ref.lastIndexOf(":") + 1,
    );
    await expect(reader!.xDel(physicalStream, streamId)).resolves.toBe(1);
    await expect(
      composition!.referenceProbe.probe({
        target,
        transport_ref: receipt.transport_ref,
        expected_envelope: envelope,
        expected_payload_hash: canonicalPayloadHashV1(envelope.payload),
      }),
    ).resolves.toEqual({ status: "missing" });

    await reader!.del(physicalStream);
    await reader!.xAdd(
      physicalStream,
      streamId,
      buildRedisStreamMessageV1({
        ...envelope,
        event_id: "evt_reconciliation_live_wrong",
        idempotency_key: "reconciliation_live_wrong:rejected",
      }),
    );
    await expect(
      composition!.referenceProbe.probe({
        target,
        transport_ref: receipt.transport_ref,
        expected_envelope: envelope,
        expected_payload_hash: canonicalPayloadHashV1(envelope.payload),
      }),
    ).resolves.toEqual({ status: "mismatched" });
  });
});
