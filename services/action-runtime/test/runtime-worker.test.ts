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
        limit: 100,
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

  it("binds PostgreSQL queue discovery to queued owner rows and frozen policy expiry", async () => {
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
  });
});
