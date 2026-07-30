import { canonicalJsonV1 } from "@pai/eventing";
import { describe, expect, it, vi } from "vitest";

import { createActionRuntimeCallbackV1 } from "../src/production-runtime-callback.v1.js";

const event = Object.freeze({
  event_id: "event-1",
  event_type: "runtime.run.started" as const,
  schema_version: "runtime_event.v1" as const,
  producer: "action_runtime" as const,
  occurred_at: "2026-07-30T00:00:00.000Z",
  idempotency_key: "run-1:started",
  trace_id: "runtime-trace-1",
  payload: Object.freeze({
    trigger_process_id: "process-1",
    runtime_run_id: "run-1",
    sequence_no: 1,
    workspace_id: "workspace-1",
    bot_id: "bot-1",
    owner_agent_id: "agent-1",
    deployment_environment: "dev" as const,
    release_channel: "stable" as const,
    start_attempt_no: 1,
    start_fence_generation: 1,
    status: "running" as const,
    previous_status: "queued" as const,
    next_status: "running" as const,
    model: "claude-sonnet-pinned",
    reason: null,
    duration_ms: null,
    reason_code: null,
    error_summary: null,
    terminal_artifact_ref: null,
  }),
});

describe("Action Runtime production callback", () => {
  it("admits the fixed local Compose Trigger origin only with the explicit opt-in", () => {
    vi.stubEnv("PAI_DEPLOYMENT_ENVIRONMENT", "local");
    vi.stubEnv("PAI_LOCAL_DOCKER_TRANSPORT", "true");
    expect(() => createActionRuntimeCallbackV1({
      trigger_processor_url: "http://trigger-processor:3001",
      signer: { sign: async () => "header.payload.signature" },
      worker_id: "worker-1:callback",
      lease_seconds: 30,
      transport_epoch: "epoch-1",
      transport_generation: 2,
    })).not.toThrow();
    vi.unstubAllEnvs();
  });

  it("binds the owner event to the TP append contract and transport fence", async () => {
    let requestBody: unknown;
    const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
      requestBody = JSON.parse(String(init?.body));
      return new Response(
        canonicalJsonV1({
          code: "snapshot_appended",
          message: "snapshot appended",
          retryable: false,
          trace_id: event.trace_id,
          details: {
            trigger_process_id: "process-1",
            snapshot_version: 1,
            append_sequence_no: 1,
            last_sequence_by_source: { action_runtime: 1 },
            duplicate_replayed: false,
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const callback = createActionRuntimeCallbackV1({
      trigger_processor_url: "https://trigger.example.test",
      signer: { sign: async () => "header.payload.signature" },
      worker_id: "worker-1:callback",
      lease_seconds: 30,
      transport_epoch: "epoch-1",
      transport_generation: 2,
      fetch: fetchImpl,
    });

    await expect(
      callback.deliver(event, {
        outbox_id: "outbox-1",
        claim_token: "claim-1",
        attempt_count: 1,
        transport_epoch: "epoch-1",
        transport_generation: 2,
      }),
    ).resolves.toEqual({
      transport_ref: "trigger_processor:snapshot_appended:event-1:1:1",
    });
    expect(requestBody).toMatchObject({
      source_event_id: "event-1",
      source_sequence_no: 1,
      idempotency_key: "action_runtime:event-1",
      observation_summary: {
        runtime_run_id: "run-1",
        status: "running",
      },
    });
  });

  it("rejects a stale callback transport generation before I/O", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const callback = createActionRuntimeCallbackV1({
      trigger_processor_url: "https://trigger.example.test",
      signer: { sign: async () => "header.payload.signature" },
      worker_id: "worker-1:callback",
      lease_seconds: 30,
      transport_epoch: "epoch-1",
      transport_generation: 2,
      fetch: fetchImpl,
    });
    await expect(
      callback.deliver(event, {
        outbox_id: "outbox-1",
        claim_token: "claim-1",
        attempt_count: 1,
        transport_epoch: "epoch-1",
        transport_generation: 1,
      }),
    ).rejects.toThrow(/transport fence/u);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
