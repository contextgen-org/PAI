import { describe, expect, it, vi } from "vitest";

import { createTriggerProcessSnapshotMetadataRepositoryV1 } from "../src/db/process-snapshot-metadata-repository.v1.js";

const hash = `sha256:${"a".repeat(64)}`;

function row() {
  return {
    snapshot_id: "snapshot-1",
    trigger_process_id: "process-1",
    workspace_id: "workspace-1",
    bot_id: "bot-1",
    owner_agent_id: "agent-1",
    deployment_environment: "dev",
    release_channel: "stable",
    schema_version: "trigger_process_snapshot.v1",
    snapshot_version: "2",
    snapshot_hash: hash,
    snapshot_ref: "object:snapshot-1",
    first_append_sequence_no: "1",
    last_append_sequence_no: "3",
    status: "current",
    retention_until: "2026-08-30T00:00:00.000Z",
    overflow_refs: [
      {
        schema_version: "snapshot_overflow_ref.v1",
        source_service: "action_runtime",
        store_type: "runtime_events",
        object_ref: "runtime-events:1-3",
        first_append_sequence_no: 1,
        last_append_sequence_no: 3,
        checksum_algorithm: "sha256",
        checksum: hash,
        retention_until: "2026-08-30T00:00:00.000Z",
        redaction_state: "complete",
      },
    ],
  } as const;
}

describe("Trigger Process snapshot metadata repository", () => {
  it("removes nullable optional keys while reading an exact owner snapshot", async () => {
    const query = vi.fn(async () => ({ rows: [row()] }));
    const repository = createTriggerProcessSnapshotMetadataRepositoryV1({
      query,
    } as never);

    await expect(
      repository.readExactSnapshot({
        trigger_process_id: "process-1",
        snapshot_ref: "object:snapshot-1",
      }),
    ).resolves.toMatchObject({
      outcome: "found",
      metadata: {
        snapshot_version: 2,
        overflow_refs: [
          expect.not.objectContaining({ source_sequence_range: null }),
        ],
      },
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("jsonb_strip_nulls(jsonb_build_object("),
      ["process-1", "object:snapshot-1"],
    );
  });

  it("rejects non-canonical overflow rows before any ObjectStore read", async () => {
    const invalid = {
      ...row(),
      overflow_refs: [
        {
          ...row().overflow_refs[0],
          source_sequence_range: null,
        },
      ],
    };
    const repository = createTriggerProcessSnapshotMetadataRepositoryV1({
      async query() {
        return { rows: [invalid] };
      },
    } as never);

    await expect(
      repository.readExactSnapshot({
        trigger_process_id: "process-1",
        snapshot_ref: "object:snapshot-1",
      }),
    ).rejects.toThrow(/owner row is invalid/u);
  });
});
