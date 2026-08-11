import { describe, expect, it, vi } from "vitest";

import {
  createActionRuntimeWorkerV1,
  createPostgresRuntimeExecutionQueueV1,
} from "../src/runtime-worker.v1.js";

describe("Action Runtime production worker", () => {
  it("discovers queued runs and drains execution, callbacks, and artifacts", async () => {
    const execution = {
      executeQueued: vi.fn(async () => ({ status: "completed" })),
      recoverPendingCallbacks: vi.fn(async () => ({ attempted: 0, sent: 0 })),
      recoverPendingArtifacts: vi.fn(async () => ({
        attempted: 0,
        available: 0,
        failed: 0,
        pending: 0,
      })),
    };
    const queue = {
      listQueued: vi.fn(async () => [
        {
          runtime_run_id: "runtime-1",
          expected_start_fence_generation: 2,
          deadline_at: "2026-07-28T00:00:00.000Z",
        },
      ]),
      checkReadiness: vi.fn(async () => undefined),
    };
    const worker = createActionRuntimeWorkerV1({
      execution: execution as never,
      queue,
      worker_id: "action-runtime-worker-1",
    });

    await worker.runOnce();

    expect(execution.executeQueued).toHaveBeenCalledWith(
      {
        runtime_run_id: "runtime-1",
        worker_id: "action-runtime-worker-1",
        expected_start_fence_generation: 2,
        lease_seconds: 30,
        deadline_at: "2026-07-28T00:00:00.000Z",
      },
      expect.any(AbortSignal),
    );
    expect(execution.recoverPendingCallbacks).toHaveBeenCalledWith(
      100,
      expect.any(AbortSignal),
    );
    expect(execution.recoverPendingArtifacts).toHaveBeenCalledWith(
      {
        worker_id: "action-runtime-worker-1:artifacts",
        limit: 16,
        lease_seconds: 60,
      },
      expect.any(AbortSignal),
    );
  });

  it("does not let one conflicting queued run starve the rest of the batch", async () => {
    const executeQueued = vi
      .fn()
      .mockRejectedValueOnce(new Error("claim conflict"))
      .mockResolvedValueOnce({ status: "completed" });
    const execution = {
      executeQueued,
      recoverPendingCallbacks: vi.fn(async () => ({ attempted: 0, sent: 0 })),
      recoverPendingArtifacts: vi.fn(async () => ({
        attempted: 0,
        available: 0,
        failed: 0,
        pending: 0,
      })),
    };
    const queued = ["runtime-1", "runtime-2"].map((runtime_run_id) => ({
      runtime_run_id,
      expected_start_fence_generation: 1,
      deadline_at: "2026-07-28T00:00:00.000Z",
    }));
    const worker = createActionRuntimeWorkerV1({
      execution: execution as never,
      queue: {
        async listQueued() {
          return queued;
        },
        async checkReadiness() {},
      },
      worker_id: "worker-1",
    });

    await worker.runOnce();

    expect(executeQueued).toHaveBeenCalledTimes(2);
  });

  it("reports a redacted classified failure while continuing the batch", async () => {
    const onExecutionError = vi.fn();
    const execution = {
      executeQueued: vi
        .fn()
        .mockRejectedValueOnce(
          Object.assign(new Error("provider secret must not reach logs"), {
            code: "runtime_adapter_failed",
            retryable: true,
          }),
        )
        .mockResolvedValueOnce({ status: "completed" }),
      recoverPendingCallbacks: vi.fn(async () => ({ attempted: 0, sent: 0 })),
      recoverPendingArtifacts: vi.fn(async () => ({
        attempted: 0,
        available: 0,
        failed: 0,
        pending: 0,
      })),
    };
    const worker = createActionRuntimeWorkerV1({
      execution: execution as never,
      queue: {
        async listQueued() {
          return ["runtime-1", "runtime-2"].map((runtime_run_id) => ({
            runtime_run_id,
            expected_start_fence_generation: 1,
            deadline_at: "2026-07-28T00:00:00.000Z",
          }));
        },
        async checkReadiness() {},
      },
      worker_id: "worker-1",
      on_execution_error: onExecutionError,
    });

    await worker.runOnce();

    expect(onExecutionError).toHaveBeenCalledWith({
      runtime_run_id: "runtime-1",
      error_code: "runtime_adapter_failed",
      retryable: true,
    });
    expect(execution.executeQueued).toHaveBeenCalledTimes(2);
  });

  it("reports a redacted recovery-cycle failure before rejecting the cycle", async () => {
    const onCycleError = vi.fn();
    const execution = {
      executeQueued: vi.fn(async () => ({ status: "completed" })),
      recoverPendingCallbacks: vi.fn(async () => {
        throw Object.assign(new Error("database details must not reach logs"), {
          code: "runtime_callback_recovery_failed",
          retryable: true,
        });
      }),
      recoverPendingArtifacts: vi.fn(async () => ({
        attempted: 0,
        available: 0,
        failed: 0,
        pending: 0,
      })),
    };
    const worker = createActionRuntimeWorkerV1({
      execution: execution as never,
      queue: {
        async listQueued() {
          return [];
        },
        async checkReadiness() {},
      },
      worker_id: "worker-1",
      on_cycle_error: onCycleError,
    });

    await expect(worker.runOnce()).rejects.toThrow(
      "database details must not reach logs",
    );
    expect(onCycleError).toHaveBeenCalledWith({
      stage: "callbacks",
      error_code: "runtime_callback_recovery_failed",
      retryable: true,
    });
  });

  it("rejects an artifact batch above the durable writer limit", () => {
    const execution = {
      executeQueued: vi.fn(async () => ({ status: "completed" })),
      recoverPendingCallbacks: vi.fn(async () => ({ attempted: 0, sent: 0 })),
      recoverPendingArtifacts: vi.fn(async () => ({
        attempted: 0,
        available: 0,
        failed: 0,
        pending: 0,
      })),
    };

    expect(() =>
      createActionRuntimeWorkerV1({
        execution: execution as never,
        queue: {
          async listQueued() {
            return [];
          },
          async checkReadiness() {},
        },
        worker_id: "worker-1",
        artifact_batch_size: 17,
      }),
    ).toThrow("artifact_batch_size must be an integer from 1 to 16");
  });

  it("discovers queued rows and only expired running leases for fenced recovery", async () => {
    const query = vi.fn(async () => ({
      rows: [
        {
          runtime_run_id: "runtime-1",
          start_fence_generation: "3",
          deadline_at: new Date("2026-07-28T00:00:00.000Z"),
        },
      ],
    }));
    const queue = createPostgresRuntimeExecutionQueueV1({ query } as never);

    await expect(queue.listQueued(7)).resolves.toEqual([
      {
        runtime_run_id: "runtime-1",
        expected_start_fence_generation: 3,
        deadline_at: "2026-07-28T00:00:00.000Z",
      },
    ]);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE run.status = 'queued'"),
      [7],
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("lease.lease_expires_at <= clock_timestamp()"),
      [7],
    );
  });
});
