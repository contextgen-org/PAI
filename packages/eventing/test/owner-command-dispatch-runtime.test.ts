import type {
  OwnerOutboxAcknowledgeRequestV1,
  OwnerOutboxStorePortV1,
} from "@pai/persistence";
import { describe, expect, it, vi } from "vitest";

import {
  createOwnerCommandDispatchRuntimeV1,
  openOwnerCommandDispatchRuntimeFromEnvV1,
  OwnerCommandTransportErrorV1,
  type OwnerCommandDispatchTransportPortV1,
} from "../src/index.js";

function claimedCommand(
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    outbox_id: "command_outbox_001",
    claim_token: "claim_001",
    attempt_count: 1,
    command_id: "command_001",
    request_payload: Object.freeze({ schema_version: "test_command.v1" }),
    ...overrides,
  });
}

function ownerOutbox(
  rows: readonly Readonly<Record<string, unknown>>[],
): Readonly<{
  port: OwnerOutboxStorePortV1<"memory">;
  acknowledgements: OwnerOutboxAcknowledgeRequestV1[];
}> {
  const acknowledgements: OwnerOutboxAcknowledgeRequestV1[] = [];
  return Object.freeze({
    acknowledgements,
    port: {
      owner_service: "memory",
      outbox_tables: Object.freeze([
        "memory_event_outbox",
        "memory_command_outbox",
      ]),
      async claim<TResult extends Readonly<Record<string, unknown>>>() {
        return rows as readonly TResult[];
      },
      async acknowledge(request) {
        acknowledgements.push(request);
        return Object.freeze({ acknowledged: true as const });
      },
    },
  });
}

function readyTransport(
  dispatch: OwnerCommandDispatchTransportPortV1["dispatch"],
): OwnerCommandDispatchTransportPortV1 {
  return Object.freeze({
    dispatch,
    async checkReadiness() {},
  });
}

function runtimeConfig(
  overrides: Readonly<Record<string, unknown>> = {},
) {
  return {
    transport_epoch: "http_epoch_001",
    transport_generation: 1,
    worker_id: "memory-command-worker",
    retry_jitter: "none" as const,
    retry_base_delay_ms: 1_000,
    retry_max_delay_ms: 10_000,
    now: () => new Date("2026-07-28T00:00:00.000Z"),
    ...overrides,
  };
}

describe("owner command dispatch runtime", () => {
  it("delivers a durable command and ACKs the exact active HTTP fence", async () => {
    const store = ownerOutbox([claimedCommand()]);
    const dispatch = vi.fn(async () =>
      Object.freeze({ transport_ref: "meta:feedback_request_001" }));
    const runtime = createOwnerCommandDispatchRuntimeV1(
      store.port,
      readyTransport(dispatch),
      runtimeConfig(),
    );

    await expect(runtime.runOnce()).resolves.toEqual({
      claimed: 1,
      sent: 1,
      retry_wait: 0,
      failed: 0,
    });
    expect(runtime.command_outbox_tables).toEqual(["memory_command_outbox"]);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        owner_service: "memory",
        outbox_table: "memory_command_outbox",
        current_transport_epoch: "http_epoch_001",
        current_transport_generation: 1,
      }),
      undefined,
    );
    expect(store.acknowledgements).toEqual([
      expect.objectContaining({
        outbox_id: "command_outbox_001",
        claim_token: "claim_001",
        outcome: "sent",
        transport_ref: "meta:feedback_request_001",
        transport_epoch: "http_epoch_001",
        transport_generation: 1,
      }),
    ]);
  });

  it.each([
    {
      label: "deterministic rejection",
      failure: new OwnerCommandTransportErrorV1(
        "idempotency_body_drift",
        false,
        false,
        "Meta rejected the command",
      ),
      attempt_count: 1,
      expected_outcome: "failed",
      expected_code: "idempotency_body_drift",
    },
    {
      label: "exhausted definitive retry",
      failure: new OwnerCommandTransportErrorV1(
        "meta_unavailable",
        true,
        false,
        "Meta was unavailable before accepting the request",
      ),
      attempt_count: 3,
      expected_outcome: "failed",
      expected_code: "command_delivery_retry_exhausted",
    },
    {
      label: "ambiguous response at the attempt limit",
      failure: new OwnerCommandTransportErrorV1(
        "command_delivery_outcome_ambiguous",
        true,
        true,
        "Meta may have accepted the request",
      ),
      attempt_count: 3,
      expected_outcome: "retry_wait",
      expected_code: "command_delivery_outcome_ambiguous",
    },
  ])(
    "classifies $label without losing ambiguous delivery",
    async ({
      failure,
      attempt_count: attemptCount,
      expected_outcome: expectedOutcome,
      expected_code: expectedCode,
    }) => {
      const store = ownerOutbox([claimedCommand({ attempt_count: attemptCount })]);
      const runtime = createOwnerCommandDispatchRuntimeV1(
        store.port,
        readyTransport(async () => {
          throw failure;
        }),
        runtimeConfig({ max_attempts: 3 }),
      );

      const result = await runtime.runOnce();
      expect(result).toEqual({
        claimed: 1,
        sent: 0,
        retry_wait: expectedOutcome === "retry_wait" ? 1 : 0,
        failed: expectedOutcome === "failed" ? 1 : 0,
      });
      expect(store.acknowledgements[0]).toEqual(
        expect.objectContaining({
          outcome: expectedOutcome,
          error: expect.objectContaining({ code: expectedCode }),
        }),
      );
      if (expectedOutcome === "retry_wait") {
        expect(store.acknowledgements[0]!.next_retry_at).toBe(
          "2026-07-28T00:00:04.000Z",
        );
      } else {
        expect(store.acknowledgements[0]!.next_retry_at).toBeNull();
      }
    },
  );

  it("rejects a malformed claim batch before dispatch or ACK", async () => {
    const sparse = new Array<Readonly<Record<string, unknown>>>(1);
    const store = ownerOutbox(sparse);
    const dispatch = vi.fn(async () => ({ transport_ref: "unused" }));
    const runtime = createOwnerCommandDispatchRuntimeV1(
      store.port,
      readyTransport(dispatch),
      runtimeConfig(),
    );

    await expect(runtime.runOnce()).rejects.toThrow(
      /claimed command outbox batch is invalid/u,
    );
    expect(dispatch).not.toHaveBeenCalled();
    expect(store.acknowledgements).toEqual([]);
  });

  it("does not execute accessors on an untrusted transport receipt", async () => {
    const store = ownerOutbox([claimedCommand()]);
    let getterCalls = 0;
    const receipt = Object.defineProperty({}, "transport_ref", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return "unsafe";
      },
    });
    const runtime = createOwnerCommandDispatchRuntimeV1(
      store.port,
      readyTransport(async () => receipt as { transport_ref: string }),
      runtimeConfig(),
    );

    await expect(runtime.runOnce()).resolves.toEqual({
      claimed: 1,
      sent: 0,
      retry_wait: 1,
      failed: 0,
    });
    expect(getterCalls).toBe(0);
  });

  it("starts, probes its transport, and closes without restart", async () => {
    const store = ownerOutbox([]);
    const readiness = vi.fn(async () => undefined);
    const runtime = createOwnerCommandDispatchRuntimeV1(
      store.port,
      Object.freeze({
        async dispatch() {
          return Object.freeze({ transport_ref: "unused" });
        },
        checkReadiness: readiness,
      }),
      runtimeConfig({ poll_interval_ms: 60_000 }),
    );

    await expect(runtime.checkReadiness()).rejects.toThrow(/not running/u);
    runtime.start();
    await runtime.checkReadiness();
    expect(readiness).toHaveBeenCalledOnce();
    await runtime.close();
    expect(runtime.state).toBe("stopped");
    expect(() => runtime.start()).toThrow(/cannot be restarted/u);
  });
});

describe("owner command dispatch environment", () => {
  it("fails closed for missing or partial production HTTP fences", async () => {
    const store = ownerOutbox([]);
    const transport = readyTransport(async () => ({
      transport_ref: "unused",
    }));
    const postgres = {
      async query<TResult extends Record<string, unknown>>() {
        return { rows: [] as readonly TResult[] };
      },
    };

    await expect(
      openOwnerCommandDispatchRuntimeFromEnvV1(store.port, {
        production_dependencies_required: true,
        transport_epoch_postgres: postgres,
        transport,
        env: {},
      }),
    ).rejects.toThrow(/required for durable owner commands/u);
    await expect(
      openOwnerCommandDispatchRuntimeFromEnvV1(store.port, {
        production_dependencies_required: false,
        transport_epoch_postgres: postgres,
        transport,
        env: { PAI_INTERNAL_HTTP_TRANSPORT_EPOCH: "epoch_only" },
      }),
    ).rejects.toThrow(/must be configured together/u);
  });
});
