import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  TriggerProcessSnapshotV1Schema,
  assertTriggerProcessSnapshotSemanticBindingsV1,
  type TriggerProcessSnapshotV1,
} from "../../src/index.js";

const hash = `sha256:${"b".repeat(64)}` as const;
const at = "2026-07-30T00:00:00.000Z";

function pendingMergedSnapshot(): TriggerProcessSnapshotV1 {
  return {
    schema_version: "trigger_process_snapshot.v1",
    snapshot_id: "snapshot-1",
    snapshot_version: 1,
    snapshot_hash: hash,
    trigger_process_id: "process-merged",
    workspace_id: "workspace-1",
    bot_id: "bot-1",
    owner_agent_id: "agent-1",
    deployment_environment: "dev",
    release_channel: "stable",
    phase: "closed",
    trigger: {
      trigger_id: "trigger-1",
      source: "chat",
      actor_type: "user",
      actor_id: "user-1",
      payload_ref: "trigger-payload:1",
      payload_hash: hash,
      accepted_at: at,
    },
    context_snapshot: null,
    intent: null,
    runtime_run_id: null,
    policy_snapshot_id: null,
    runtime_state: null,
    action_trace: [],
    tool_results: [],
    event_trace: [],
    input_event_range: {
      first_append_sequence_no: 0,
      last_append_sequence_no: 0,
    },
    overflow_refs: [],
    last_append_sequence_no: 0,
    last_sequence_by_source: {},
    terminal_outcome: null,
    terminal_outcome_finalized_at: null,
    canonical_process_id: "process-canonical",
    successor_process_id: null,
    superseded_by_process_id: null,
    snapshot_transfer_ref: null,
    boundary_system_event_ref: null,
    canonical_reason_code: null,
    open_loops: ["await_canonical_terminal_outcome"],
    created_at: at,
    updated_at: at,
    cooldown_until: null,
    snapshot_retention_until: "2026-08-30T00:00:00.000Z",
  };
}

describe("TriggerProcessSnapshotV1", () => {
  it("allows a closed merged process to await canonical outcome finalization", () => {
    const snapshot = pendingMergedSnapshot();
    expect(Value.Check(TriggerProcessSnapshotV1Schema, snapshot)).toBe(true);
    expect(() =>
      assertTriggerProcessSnapshotSemanticBindingsV1(snapshot),
    ).not.toThrow();
    expect(() =>
      assertTriggerProcessSnapshotSemanticBindingsV1({
        ...snapshot,
        canonical_process_id: null,
      }),
    ).toThrow(/semantic binding/u);
  });

  it("requires the inline tail and overflow refs to cover the full append range", () => {
    const snapshot: TriggerProcessSnapshotV1 = {
      ...pendingMergedSnapshot(),
      event_trace: [
        {
          source_service: "trigger_processor",
          source_event_id: "event-3",
          source_sequence_no: 3,
          append_sequence_no: 3,
          payload_ref: "tp-event:event-3",
          payload_hash: hash,
          created_at: at,
          event_type: "trigger_process.phase_changed",
          schema_version: "trigger_processor_event.v1",
          occurred_at: at,
          runtime_run_id: null,
          artifact_refs: [],
        },
      ],
      input_event_range: {
        first_append_sequence_no: 1,
        last_append_sequence_no: 3,
      },
      overflow_refs: [
        {
          schema_version: "snapshot_overflow_ref.v1",
          source_service: "trigger_processor",
          store_type: "tp_event_projection",
          object_ref: "tp-events:1-2",
          first_append_sequence_no: 1,
          last_append_sequence_no: 2,
          source_sequence_range: {
            first_source_sequence_no: 1,
            last_source_sequence_no: 2,
          },
          checksum_algorithm: "sha256",
          checksum: hash,
          retention_until: "2026-08-30T00:00:00.000Z",
          redaction_state: "not_required",
        },
      ],
      last_append_sequence_no: 3,
      last_sequence_by_source: { trigger_processor: 3 },
    };
    expect(Value.Check(TriggerProcessSnapshotV1Schema, snapshot)).toBe(true);
    expect(() =>
      assertTriggerProcessSnapshotSemanticBindingsV1(snapshot),
    ).not.toThrow();
    expect(() =>
      assertTriggerProcessSnapshotSemanticBindingsV1({
        ...snapshot,
        overflow_refs: [
          { ...snapshot.overflow_refs[0]!, last_append_sequence_no: 1 },
        ],
      }),
    ).toThrow(/append range.*gap/u);
    expect(() =>
      assertTriggerProcessSnapshotSemanticBindingsV1({
        ...snapshot,
        overflow_refs: [
          { ...snapshot.overflow_refs[0]!, last_append_sequence_no: 3 },
        ],
      }),
    ).toThrow(/overlaps or has a gap/u);
  });

  it("requires the canonical action trace ordering used by snapshot hashing", () => {
    const action = {
      source_service: "action_runtime" as const,
      source_event_id: "action-2",
      source_sequence_no: 2,
      append_sequence_no: 2,
      payload_ref: "runtime-action:2",
      payload_hash: hash,
      created_at: at,
      step: 1,
      action_type: "tool_use",
      status: "completed",
      tool_name: "search",
      skill_key: null,
      started_at: at,
      completed_at: at,
      reason_code: null,
    };
    expect(() =>
      assertTriggerProcessSnapshotSemanticBindingsV1({
        ...pendingMergedSnapshot(),
        action_trace: [action, { ...action, source_event_id: "action-1", append_sequence_no: 1 }],
      }),
    ).toThrow(/semantic binding/u);
  });
});
