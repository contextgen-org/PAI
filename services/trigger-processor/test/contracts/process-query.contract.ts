import {
  TriggerProcessGetResponseV1Schema,
  TriggerProcessQueryDetailsV1Schema,
  assertTriggerProcessQueryDetailsV1,
} from "@pai/contracts";
import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

export const processDetailsFixtureV1 = {
  id: "tp-1",
  trigger_id: "trg-1",
  workspace_id: "ws-1",
  bot_id: "bot-1",
  owner_agent_id: "agent-1",
  deployment_environment: "prod",
  release_channel: "stable",
  runtime_run_id: "run-1",
  phase: "closed",
  status: "preempted",
  terminal_reason: "handoff_completed",
  terminal_outcome: "preempted_and_handed_off",
  terminal_outcome_finalized_at: "2026-07-15T05:10:00.000Z",
  successor_process_id: "tp-2",
  snapshot_transfer_ref: "snapshot-transfer:tp-1:tp-2:v1",
  boundary_system_event_ref: null,
  canonical_reason_code: "strong_preempt_handoff_completed",
  reason_code: "strong_preempt_handoff_completed",
  cooldown_until: null,
  snapshot_retention_until: "2026-07-15T06:10:00.000Z",
  process_snapshot_identity: {
    snapshot_ref: "snapshot-ref:tp-1:184",
    snapshot_version: 184,
    snapshot_hash: `sha256:${"a".repeat(64)}`,
  },
  context_snapshot_identity: {
    context_snapshot_ref: "context-snapshot-ref:tp-1:7",
    context_snapshot_version: 7,
    context_snapshot_hash: `sha256:${"b".repeat(64)}`,
  },
  snapshot_watermark: 184,
  meta_job_id: null,
  meta_status: "not_applicable",
  meta_summary_ref: null,
  observation_finalized: true,
} as const;

describe("Trigger Process query contract", () => {
  it("matches the documented wire mapping and rejects physical aliases", () => {
    expect(Value.Check(TriggerProcessQueryDetailsV1Schema, processDetailsFixtureV1)).toBe(true);
    expect(() => assertTriggerProcessQueryDetailsV1(processDetailsFixtureV1)).not.toThrow();
    expect(
      Value.Check(TriggerProcessGetResponseV1Schema, {
        code: "trigger_process_found",
        message: "found",
        retryable: false,
        trace_id: "trace-1",
        details: processDetailsFixtureV1,
      }),
    ).toBe(true);
    expect(
      Value.Check(TriggerProcessQueryDetailsV1Schema, {
        ...processDetailsFixtureV1,
        current_runtime_run_id: "run-1",
      }),
    ).toBe(false);
  });

  it("requires a safe durable watermark and finalized outcome pairing", () => {
    expect(() =>
      assertTriggerProcessQueryDetailsV1({
        ...processDetailsFixtureV1,
        terminal_outcome_finalized_at: null,
      }),
    ).toThrow(/semantic binding/u);
    expect(
      Value.Check(TriggerProcessQueryDetailsV1Schema, {
        ...processDetailsFixtureV1,
        snapshot_watermark: Number.MAX_SAFE_INTEGER + 1,
      }),
    ).toBe(false);
  });

  it("requires complete, safe and canonical current snapshot identities", () => {
    expect(
      Value.Check(TriggerProcessQueryDetailsV1Schema, {
        ...processDetailsFixtureV1,
        process_snapshot_identity: {
          ...processDetailsFixtureV1.process_snapshot_identity,
          snapshot_version: Number.MAX_SAFE_INTEGER + 1,
        },
      }),
    ).toBe(false);
    expect(
      Value.Check(TriggerProcessQueryDetailsV1Schema, {
        ...processDetailsFixtureV1,
        context_snapshot_identity: {
          context_snapshot_ref: "context-snapshot-ref:tp-1:7",
          context_snapshot_version: 7,
        },
      }),
    ).toBe(false);
    expect(
      Value.Check(TriggerProcessQueryDetailsV1Schema, {
        ...processDetailsFixtureV1,
        process_snapshot_identity: {
          ...processDetailsFixtureV1.process_snapshot_identity,
          snapshot_hash: "caller-supplied-latest",
        },
      }),
    ).toBe(false);
  });
});
