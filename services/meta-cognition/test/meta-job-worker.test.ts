import { describe, expect, it, vi } from "vitest";

import { createMetaJobWorkerV1 } from "../src/meta-job-worker.v1.js";

describe("Meta durable job worker", () => {
  it("uses the PostgreSQL candidate list only as a hint and lets the application lease fence decide", async () => {
    const acquireLease = vi
      .fn()
      .mockRejectedValueOnce(new Error("competing owner"))
      .mockResolvedValueOnce({
        job_id: "job-2",
        lease_id: "lease-2",
        owner_id: "worker-1",
        lease_generation: 2,
        lease_expires_at: "2026-07-28T00:01:00.000Z",
      });
    const runJob = vi.fn().mockResolvedValue({ outcome: "completed" });
    const checkReadiness = vi.fn().mockResolvedValue(undefined);
    const candidates = {
      claimable: vi.fn().mockResolvedValue([
        {
          job_id: "job-1",
          expected_lease_generation: 1,
          trace_id: "trace-1",
        },
        {
          job_id: "job-2",
          expected_lease_generation: 1,
          trace_id: "trace-2",
        },
      ]),
      checkReadiness: vi.fn().mockResolvedValue(undefined),
    };
    const worker = createMetaJobWorkerV1({
      application: {
        acquireLease,
        runJob,
        checkReadiness,
      } as never,
      candidates,
      worker_id: "worker-1",
      batch_size: 2,
    });

    await expect(worker.runOnce()).resolves.toBe(1);
    expect(candidates.claimable).toHaveBeenCalledWith(2, expect.any(Date));
    expect(acquireLease).toHaveBeenNthCalledWith(1, {
      job_id: "job-1",
      owner_id: "worker-1",
      expected_generation: 1,
      trace_id: "trace-1",
    });
    expect(runJob).toHaveBeenCalledWith(
      expect.objectContaining({ job_id: "job-2", lease_generation: 2 }),
      expect.any(AbortSignal),
    );
    await worker.checkReadiness(new AbortController().signal);
    expect(checkReadiness).toHaveBeenCalledOnce();
    expect(candidates.checkReadiness).toHaveBeenCalledOnce();
    await worker.close();
  });
});
