import { describe, expect, it, vi } from "vitest";

import { createContextSnapshotCanonicalReferenceRepositoryV1 } from "../src/db/context-snapshot-canonical-reference-repository.v1.js";

const request = Object.freeze({
  trigger_process_id: "process-1",
  workspace_id: "workspace-1",
  bot_id: "bot-1",
  owner_agent_id: "agent-1",
  deployment_environment: "dev" as const,
  release_channel: "stable" as const,
  context_snapshot_ref: "object:context-1",
  context_snapshot_version: 1,
  context_snapshot_hash: `sha256:${"a".repeat(64)}`,
  purpose: "runtime_start" as const,
});

describe("Context snapshot canonical reference repository", () => {
  it("binds the reference to the exact owner process scope and retained snapshot history", async () => {
    const query = vi.fn(async () => ({
      rows: [{ is_canonical: true }],
    }));
    const repository = createContextSnapshotCanonicalReferenceRepositoryV1({
      query,
    } as never);

    await expect(repository.isCanonicalReference(request)).resolves.toBe(true);
    expect(query).toHaveBeenCalledWith(
      expect.stringMatching(
        /p\.context_snapshot_ref = \$7::text[\s\S]+s\.status IN \('current', 'superseded'\)/u,
      ),
      [
        "process-1",
        "workspace-1",
        "bot-1",
        "agent-1",
        "dev",
        "stable",
        "object:context-1",
      ],
    );
  });

  it("fails closed when PostgreSQL does not return the exact boolean fact", async () => {
    const repository = createContextSnapshotCanonicalReferenceRepositoryV1({
      async query() {
        return { rows: [{ is_canonical: "true" }] };
      },
    } as never);

    await expect(repository.isCanonicalReference(request)).rejects.toThrow(
      /canonical reference query is invalid/u,
    );
  });
});
