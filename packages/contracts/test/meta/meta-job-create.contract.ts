import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  MetaJobCreateRequestV1Schema,
  MetaJobCreateResponseV1Schema,
  assertMetaJobCreateSemanticBindingsV1,
} from "../../src/index.js";

const hash = `sha256:${"d".repeat(64)}` as const;
const now = Date.parse("2026-07-30T00:00:00.000Z");
const base = {
  schema_version: "meta_job_create.v1",
  trigger_process_id: "process-1",
  workspace_id: "workspace-1",
  bot_id: "bot-1",
  owner_agent_id: "agent-1",
  deployment_environment: "dev",
  release_channel: "stable",
  snapshot_ref: "snapshot:process-1:1",
  snapshot_version: 1,
  snapshot_hash: hash,
  snapshot_retention_until: "2026-08-30T00:00:00.000Z",
  learnable_snapshot_ready: true,
  idempotency_key: "process-1",
  trace_id: "trace-1",
} as const;

describe("MetaJobCreateContractV1", () => {
  it("binds each enqueue reason to its cooldown or boundary evidence", () => {
    const requests = [
      {
        ...base,
        cooldown_until: "2026-07-30T00:05:00.000Z",
        enqueue_reason: "cooldown_expired",
        boundary_system_event_ref: null,
      },
      {
        ...base,
        cooldown_until: null,
        enqueue_reason: "user_retracted",
        boundary_system_event_ref: "trigger_event:retracted-1",
      },
      {
        ...base,
        cooldown_until: null,
        enqueue_reason: "system_interrupted",
        boundary_system_event_ref: "system_event:interrupted-1",
      },
      {
        ...base,
        cooldown_until: null,
        enqueue_reason: "failed_with_learnable_snapshot",
        boundary_system_event_ref: null,
      },
    ] as const;
    for (const request of requests) {
      expect(Value.Check(MetaJobCreateRequestV1Schema, request)).toBe(true);
      expect(() =>
        assertMetaJobCreateSemanticBindingsV1(request, now),
      ).not.toThrow();
    }
  });

  it("uses the Meta owner response directly without a TP envelope", () => {
    expect(
      Value.Check(MetaJobCreateResponseV1Schema, {
        job_id: "meta-job-1",
        status: "queued",
        duplicate_replayed: false,
        created_at: "2026-07-30T00:00:00.000Z",
      }),
    ).toBe(true);
    expect(
      Value.Check(MetaJobCreateResponseV1Schema, {
        code: "meta_job_created",
        details: { job_id: "meta-job-1" },
      }),
    ).toBe(false);
  });
});
