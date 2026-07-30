import { describe, expect, it, vi } from "vitest";

import { createTriggerProcessSnapshotRetentionRepositoryV1 } from "../src/db/process-snapshot-retention-repository.v1.js";

const request = Object.freeze({
  trigger_process_id: "process-1",
  workspace_id: "workspace-1",
  bot_id: "bot-1",
  owner_agent_id: "agent-1",
  deployment_environment: "dev" as const,
  release_channel: "stable" as const,
});

describe("Trigger Process snapshot retention repository", () => {
  it("reads the exact owner Process and normalizes PostgreSQL timestamptz", async () => {
    const query = vi.fn(async () => ({
      rows: [{ snapshot_retention_until: "2026-08-30T00:00:00.123456Z" }],
    }));
    const repository = createTriggerProcessSnapshotRetentionRepositoryV1({
      query,
    } as never);

    await expect(
      repository.readCurrent(request, new AbortController().signal),
    ).resolves.toBe("2026-08-30T00:00:00.123456Z");
    expect(query).toHaveBeenCalledWith(
      expect.stringMatching(
        /p\.id = \$1::text[\s\S]+p\.workspace_id = \$2::text[\s\S]+p\.release_channel = \$6::text/u,
      ),
      ["process-1", "workspace-1", "bot-1", "agent-1", "dev", "stable"],
    );
  });

  it("fails closed for a missing, ambiguous, invalid, or aborted owner read", async () => {
    for (const rows of [
      [],
      [
        { snapshot_retention_until: "2026-08-30T00:00:00.000Z" },
        { snapshot_retention_until: "2026-08-30T00:00:00.000Z" },
      ],
      [{ snapshot_retention_until: "invalid" }],
    ]) {
      const repository = createTriggerProcessSnapshotRetentionRepositoryV1({
        async query() {
          return { rows };
        },
      } as never);
      await expect(
        repository.readCurrent(request, new AbortController().signal),
      ).rejects.toThrow();
    }

    const controller = new AbortController();
    controller.abort();
    const repository = createTriggerProcessSnapshotRetentionRepositoryV1({
      async query() {
        throw new Error("must not query");
      },
    } as never);
    await expect(repository.readCurrent(request, controller.signal)).rejects.toThrow(
      /aborted/u,
    );
  });
});
