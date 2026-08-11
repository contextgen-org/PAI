import { describe, expect, it } from "vitest";

import {
  createStrongFifoPromotionWorkerV1,
  type StrongFifoPromotionCandidateV1,
} from "../src/application/strong-fifo-promotion.v1.js";
import type { TriggerProcessorOwnerDatabaseV1 } from "../src/application/trigger-admission.v1.js";

const candidate: StrongFifoPromotionCandidateV1 = {
  bot_id: "bot-1",
  slot_process_id: "closed-process-1",
  slot_generation: 4,
  strong_fifo_revision: 2,
  head_process_id: "process-1",
  head_admission_time: "2026-08-07T01:02:03.123456Z",
  head_phase: "admission",
  head_status: "waiting",
  head_state_version: 2,
  head_updated_at: "2026-08-07T01:02:03.123456Z",
  preempt_commit_result: null,
  accepted_trace_id: "trace-1",
};

function database(
  execute: (request: Readonly<{
    writer: string;
    arguments: Readonly<Record<string, unknown>>;
  }>) => Promise<unknown>,
): TriggerProcessorOwnerDatabaseV1 {
  return {
    deployment: {} as never,
    repository: {} as never,
    unit_of_work: {
      owner_service: "trigger_processor",
      async withTransaction(_request, work) {
        return work({} as never, {
          owner: { executeWriter: (_transaction, request) => execute(request) },
        } as never);
      },
    },
  } as TriggerProcessorOwnerDatabaseV1;
}

describe("Strong FIFO promotion worker", () => {
  it("promotes an idle head exclusively through the fenced owner writer", async () => {
    const writes: Array<Readonly<Record<string, unknown>>> = [];
    const worker = createStrongFifoPromotionWorkerV1(
      { async listEligible(limit) { expect(limit).toBe(16); return [candidate]; } },
      database(async (request) => {
        writes.push(request.arguments);
        return {
          applied: true,
          writer: request.writer,
          process_id: request.arguments.p_expected_head_process_id,
        };
      }),
      {},
    );

    await expect(worker.runOnce()).resolves.toMatchObject({
      claimed: 1,
      promoted: 1,
      raced: 0,
    });
    expect(writes).toEqual([
      expect.objectContaining({
        p_bot_id: "bot-1",
        p_expected_slot_fence: {
          process_id: "closed-process-1",
          slot_generation: 4,
        },
        p_expected_head_process_id: "process-1",
        p_next_slot_generation: "5",
        p_evidence: {},
        p_command: {},
      }),
    ]);
  });

  it("does not manufacture a promotion when the advisory read is empty", async () => {
    const worker = createStrongFifoPromotionWorkerV1(
      { async listEligible() { return []; } },
      database(async () => {
        throw new Error("owner writer must not run without an eligible head");
      }),
      {},
    );

    await expect(worker.runOnce()).resolves.toMatchObject({
      claimed: 0,
      promoted: 0,
    });
  });

  it("treats an owner fence conflict as another worker safely winning", async () => {
    const worker = createStrongFifoPromotionWorkerV1(
      { async listEligible() { return [candidate]; } },
      database(async () => {
        throw Object.assign(new Error("stale fence"), { code: "40001" });
      }),
      {},
    );

    await expect(worker.runOnce()).resolves.toMatchObject({
      claimed: 1,
      promoted: 0,
      raced: 1,
    });
  });
});
