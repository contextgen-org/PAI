import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  TriggerProcessSnapshotReadContractV1Schema,
  TriggerProcessSnapshotResolveRequestV1Schema,
  assertTriggerProcessSnapshotReadBindingsV1,
  type TriggerProcessSnapshotReadContractV1,
  type TriggerProcessSnapshotResolveRequestV1,
} from "../../src/index.js";

const hash = `sha256:${"a".repeat(64)}` as const;
const at = "2026-07-30T00:00:00.000Z";
const retention = "2026-08-30T00:00:00.000Z";

const request: TriggerProcessSnapshotResolveRequestV1 = {
  schema_version: "trigger_process_snapshot_resolve_request.v1",
  trigger_process_id: "process-1",
  workspace_id: "workspace-1",
  bot_id: "bot-1",
  owner_agent_id: "agent-1",
  deployment_environment: "dev",
  release_channel: "stable",
  snapshot_ref: "snapshot-ref:1",
  expected_snapshot_version: 1,
  expected_snapshot_hash: hash,
  purpose: "meta_learning",
  trace_id: "trace-1",
};

function readContract(): TriggerProcessSnapshotReadContractV1 {
  return {
    schema_version: "trigger_process_snapshot_read.v1",
    snapshot_ref: request.snapshot_ref,
    snapshot_manifest: {
      schema_version: "trigger_process_snapshot.v1",
      snapshot_id: "snapshot-1",
      snapshot_version: 1,
      snapshot_hash: hash,
      trigger_process_id: request.trigger_process_id,
      workspace_id: request.workspace_id,
      bot_id: request.bot_id,
      owner_agent_id: request.owner_agent_id,
      deployment_environment: request.deployment_environment,
      release_channel: request.release_channel,
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
      event_trace: [
        {
          source_service: "trigger_processor",
          source_event_id: "event-1",
          source_sequence_no: 1,
          append_sequence_no: 1,
          payload_ref: "event-payload:1",
          payload_hash: hash,
          created_at: at,
          event_type: "trigger_process.closed",
          schema_version: "trigger_processor_event.v1",
          occurred_at: at,
          runtime_run_id: null,
          artifact_refs: [],
        },
      ],
      input_event_range: {
        first_append_sequence_no: 1,
        last_append_sequence_no: 1,
      },
      overflow_refs: [],
      last_append_sequence_no: 1,
      last_sequence_by_source: { trigger_processor: 1 },
      terminal_outcome: "executed",
      terminal_outcome_finalized_at: at,
      canonical_process_id: null,
      successor_process_id: null,
      superseded_by_process_id: null,
      snapshot_transfer_ref: null,
      boundary_system_event_ref: null,
      canonical_reason_code: "completed",
      open_loops: [],
      created_at: at,
      updated_at: at,
      cooldown_until: null,
      snapshot_retention_until: retention,
    },
    content_chunks: [
      {
        source_service: "trigger_processor",
        first_append_sequence_no: 1,
        last_append_sequence_no: 1,
        checksum_algorithm: "sha256",
        checksum: hash,
        inline_content: { event_id: "event-1" },
        retention_until: retention,
        redaction_state: "not_required",
      },
    ],
    resolved_at: at,
  };
}

describe("TriggerProcessSnapshot owner read contract", () => {
  it("binds workload purpose, five-tuple, ref, version, hash and complete chunks", () => {
    const result = readContract();
    expect(Value.Check(TriggerProcessSnapshotResolveRequestV1Schema, request)).toBe(
      true,
    );
    expect(Value.Check(TriggerProcessSnapshotReadContractV1Schema, result)).toBe(
      true,
    );
    expect(() =>
      assertTriggerProcessSnapshotReadBindingsV1(request, result),
    ).not.toThrow();
  });

  it("rejects caller scope drift and partial ranges", () => {
    const result = readContract();
    expect(() =>
      assertTriggerProcessSnapshotReadBindingsV1(
        { ...request, bot_id: "other-bot" },
        result,
      ),
    ).toThrow(/identity binding/u);
    expect(() =>
      assertTriggerProcessSnapshotReadBindingsV1(request, {
        ...result,
        content_chunks: [],
      }),
    ).toThrow(/append range/u);
  });

  it("makes inline content and owner refs mutually exclusive", () => {
    const result = readContract();
    expect(
      Value.Check(TriggerProcessSnapshotReadContractV1Schema, {
        ...result,
        content_chunks: [
          {
            ...result.content_chunks[0],
            owner_content_ref: "owner:event-1",
          },
        ],
      }),
    ).toBe(false);
  });

  it("rejects unmanifested owner refs and inline chunks bound to another source", () => {
    const result = readContract();
    expect(() =>
      assertTriggerProcessSnapshotReadBindingsV1(request, {
        ...result,
        content_chunks: [
          {
            ...result.content_chunks[0]!,
            source_service: "action_runtime",
          },
        ],
      }),
    ).toThrow(/inline binding/u);
    expect(() =>
      assertTriggerProcessSnapshotReadBindingsV1(request, {
        ...result,
        content_chunks: [
          {
            source_service: "trigger_processor",
            first_append_sequence_no: 1,
            last_append_sequence_no: 1,
            checksum_algorithm: "sha256",
            checksum: hash,
            owner_content_ref: "owner:unmanifested",
            retention_until: retention,
            redaction_state: "not_required",
          },
        ],
      }),
    ).toThrow(/overflow binding/u);
  });
});
