import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  TRIGGER_PROCESS_WORK_SCHEMA_VERSION_BY_KIND_V1,
  TriggerProcessWorkPayloadV1Schema,
  assertTriggerProcessWorkPayloadBindingsV1,
  type TriggerProcessWorkKindV1,
  type TriggerProcessWorkPayloadV1,
} from "../../src/trigger-processor/work-item.v1.js";

const hash = `sha256:${"a".repeat(64)}` as const;
const state = {
  phase: "context" as const,
  status: "running" as const,
  wait_reason: null,
  terminal_reason: null,
};
const scope = {
  workspace_id: "workspace-1",
  bot_id: "bot-1",
  owner_agent_id: "agent-1",
  deployment_environment: "dev" as const,
  release_channel: "stable" as const,
};
const contextRequest = {
  schema_version: "context_compose_request.v1" as const,
  trigger_process_id: "process-1",
  ...scope,
  trigger: {
    trigger_id: "trigger-1",
    source: "chat" as const,
    actor_type: "user" as const,
  },
  context_version: 1,
  source_policy: {
    required_sources: ["environment" as const],
    allowed_sources: ["environment" as const],
    skip_decisions: [],
  },
  idempotency_key: "process-1:context:1",
  trace_id: "trace-1",
};

const execute = {
  schema_version: "trigger_stage_execute_work.v1" as const,
  trigger_process_id: "process-1",
  expected_process_state: state,
  expected_process_state_version: 3,
  immutable_input_hash: hash,
  trace_id: "trace-1",
  target_stage: "context" as const,
  request: contextRequest,
};

describe("TriggerProcessWorkPayloadV1", () => {
  it("pins every work kind to one distinct schema version", () => {
    expect(TRIGGER_PROCESS_WORK_SCHEMA_VERSION_BY_KIND_V1).toEqual({
      stage_execute: "trigger_stage_execute_work.v1",
      stage_retry: "trigger_stage_retry_work.v1",
      runtime_start_recompose: "trigger_runtime_start_recompose_work.v1",
      snapshot_repair: "trigger_snapshot_repair_work.v1",
      meta_enqueue: "trigger_meta_enqueue_work.v1",
    });
    expect(Value.Check(TriggerProcessWorkPayloadV1Schema, execute)).toBe(true);
    expect(() =>
      assertTriggerProcessWorkPayloadBindingsV1("stage_execute", execute),
    ).not.toThrow();
  });

  it("rejects a work kind/schema mismatch and request process drift", () => {
    expect(() =>
      assertTriggerProcessWorkPayloadBindingsV1(
        "stage_retry",
        execute as TriggerProcessWorkPayloadV1,
      ),
    ).toThrow(/binding mismatch/u);
    expect(() =>
      assertTriggerProcessWorkPayloadBindingsV1("stage_execute", {
        ...execute,
        request: { ...contextRequest, trigger_process_id: "process-other" },
      }),
    ).toThrow(/binding mismatch/u);
  });

  it("rejects unknown properties and unsafe state versions", () => {
    expect(
      Value.Check(TriggerProcessWorkPayloadV1Schema, {
        ...execute,
        caller_override: true,
      }),
    ).toBe(false);
    expect(
      Value.Check(TriggerProcessWorkPayloadV1Schema, {
        ...execute,
        expected_process_state_version: Number.MAX_SAFE_INTEGER + 1,
      }),
    ).toBe(false);
  });

  it("starts Runtime recompose from a fresh Context request, never an old Start request", () => {
    const recompose = {
      schema_version: "trigger_runtime_start_recompose_work.v1",
      trigger_process_id: "process-1",
      expected_process_state: state,
      expected_process_state_version: 4,
      immutable_input_hash: hash,
      trace_id: "trace-1",
      old_start_attempt_no: 1,
      old_start_fence_generation: 7,
      catalog_conflict_ref: "catalog-conflict:1",
      no_run_proof_ref: "no-run-proof:1",
      previous_context_snapshot_ref: "context:process-1:1",
      previous_context_snapshot_hash: hash,
      previous_intent_ref: "intent:process-1:1",
      previous_intent_hash: hash,
      request: {
        ...contextRequest,
        context_version: 2,
        idempotency_key: "process-1:context:2",
      },
    } as const;

    expect(Value.Check(TriggerProcessWorkPayloadV1Schema, recompose)).toBe(true);
    expect(() =>
      assertTriggerProcessWorkPayloadBindingsV1(
        "runtime_start_recompose",
        recompose,
      ),
    ).not.toThrow();
    expect(
      Value.Check(TriggerProcessWorkPayloadV1Schema, {
        ...recompose,
        request: {
          schema_version: "runtime_start.v1.2",
          trigger_process_id: "process-1",
        },
      }),
    ).toBe(false);
    expect(() =>
      assertTriggerProcessWorkPayloadBindingsV1(
        "runtime_start_recompose",
        {
          ...recompose,
          expected_process_state: {
            phase: "execution",
            status: "waiting",
            wait_reason: "runtime_start_recompose",
            terminal_reason: null,
          },
        },
      ),
    ).toThrow(/binding mismatch/u);
  });

  it("keeps the kind type closed", () => {
    const kinds: TriggerProcessWorkKindV1[] = [
      "stage_execute",
      "stage_retry",
      "runtime_start_recompose",
      "snapshot_repair",
      "meta_enqueue",
    ];
    expect(kinds).toHaveLength(5);
  });
});
