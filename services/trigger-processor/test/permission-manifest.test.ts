import { TERMINAL_OUTCOMES_V1 } from "@pai/contracts";
import { describe, expect, it } from "vitest";

import { ACTION_RUNTIME_REPOSITORY_CONTRACT_V1 } from "../../action-runtime/src/db/permission-manifest.v1.js";
import { KNOWTHAT_REPOSITORY_CONTRACT_V1 } from "../../knowthat/src/db/permission-manifest.v1.js";
import { MEMORY_REPOSITORY_CONTRACT_V1 } from "../../memory/src/db/permission-manifest.v1.js";
import { META_COGNITION_REPOSITORY_CONTRACT_V1 } from "../../meta-cognition/src/db/permission-manifest.v1.js";
import { SKILL_REGISTRY_REPOSITORY_CONTRACT_V1 } from "../../skill-registry/src/db/permission-manifest.v1.js";
import { TIMER_REPOSITORY_CONTRACT_V1 } from "../../timer-trigger-app/src/db/permission-manifest.v1.js";
import {
  assertTriggerProcessorLifecycleWriterSemanticsV1,
  TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
} from "../src/db/permission-manifest.v1.js";

const signature = (
  contract: { readonly function_signatures: readonly { readonly function_name: string }[] },
  name: string,
) => contract.function_signatures.find(({ function_name }) => function_name === name);

describe("owner permission manifest lifecycle boundaries", () => {
  it("does not claim DLQ resolution deployment before canonical fresh DDL exists", () => {
    for (const contract of [
      ACTION_RUNTIME_REPOSITORY_CONTRACT_V1,
      TIMER_REPOSITORY_CONTRACT_V1,
      META_COGNITION_REPOSITORY_CONTRACT_V1,
      SKILL_REGISTRY_REPOSITORY_CONTRACT_V1,
      KNOWTHAT_REPOSITORY_CONTRACT_V1,
      MEMORY_REPOSITORY_CONTRACT_V1,
      TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
    ]) {
      expect(
        contract.tables.filter((table) => table.endsWith("_dlq_resolutions")),
      ).toEqual([]);
      expect(
        contract.function_signatures.filter(({ function_name }) =>
          /^resolve_.*_dlq_v1$/u.test(function_name),
        ),
      ).toEqual([]);
    }
  });

  it("binds Trigger admission and progression to separate atomic writers", () => {
    const admit = signature(
      TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
      "admit_trigger_v1",
    );
    expect(admit?.writes_tables).toContain("trigger_command_outbox");
    expect(admit?.writes_tables).not.toContain("trigger_confirmation_challenges");
    expect(admit?.writes_tables).not.toContain("trigger_event_inbox");

    expect(
      signature(
        TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        "transition_trigger_process_v1",
      ),
    ).toBeUndefined();
    expect(
      signature(
        TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        "transition_trigger_process_aggregate_local_v1",
      ),
    ).toBeUndefined();

    for (const writer of [
      "advance_trigger_stage_v1",
      "schedule_trigger_stage_retry_v1",
      "claim_trigger_stage_retry_v1",
      "create_trigger_confirmation_challenge_v1",
      "accept_trigger_confirmation_v1",
      "reject_trigger_confirmation_v1",
      "expire_trigger_confirmation_v1",
      "request_trigger_cancel_v1",
      "transition_trigger_cancel_request_v1",
      "reserve_runtime_start_v1",
      "record_runtime_started_v1",
      "record_runtime_start_uncertain_v1",
      "request_runtime_start_recompose_v1",
      "claim_runtime_recompose_v1",
      "request_runtime_preempt_v1",
      "finalize_trigger_meta_projection_v1",
    ]) {
      expect(signature(TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1, writer)).toBeDefined();
    }
  });

  it("cannot route coupled Trigger edges through an unrestricted process writer", () => {
    const coupledWriters = [
      ["advance_trigger_stage_v1", "p_stage_progression_evidence"],
      ["schedule_trigger_stage_retry_v1", "p_stage_retry_scheduled_evidence"],
      ["claim_trigger_stage_retry_v1", "p_stage_retry_claimed_evidence"],
      [
        "create_trigger_confirmation_challenge_v1",
        "p_confirmation_challenge_created_evidence",
      ],
      ["accept_trigger_confirmation_v1", "p_confirmation_accepted_evidence"],
      ["reserve_runtime_start_v1", "p_runtime_start_reserved_evidence"],
      ["record_runtime_started_v1", "p_runtime_started_evidence"],
      [
        "record_runtime_start_uncertain_v1",
        "p_runtime_start_uncertain_evidence",
      ],
      [
        "request_runtime_start_recompose_v1",
        "p_runtime_start_recompose_evidence",
      ],
      ["claim_runtime_recompose_v1", "p_runtime_recompose_claimed_evidence"],
      ["request_runtime_preempt_v1", "p_runtime_control_requested_evidence"],
      ["request_trigger_cancel_v1", "p_runtime_control_requested_evidence"],
      ["finalize_trigger_meta_projection_v1", "p_meta_finalization_evidence"],
    ] as const;
    for (const [writerName, evidenceArgument] of coupledWriters) {
      const writer = signature(TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1, writerName);
      expect(writer?.arguments.map(({ argument_name }) => argument_name)).toContain(
        evidenceArgument,
      );
      expect(writer?.effects).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ table_name: "trigger_processes" }),
          expect.objectContaining({ table_name: "trigger_process_transitions" }),
          expect.objectContaining({ table_name: "trigger_event_outbox" }),
        ]),
      );
    }

    expect(() =>
      assertTriggerProcessorLifecycleWriterSemanticsV1({
        ...TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        function_signatures: [
          ...TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1.function_signatures,
          {
            ...TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1.function_signatures[0],
            function_name: "transition_trigger_process_v1",
          },
        ],
      } as never),
    ).toThrow(/generic Trigger lifecycle writer/u);

    expect(() =>
      assertTriggerProcessorLifecycleWriterSemanticsV1({
        ...TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        function_signatures: [
          ...TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1.function_signatures,
          {
            ...signature(
              TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
              "advance_trigger_stage_v1",
            )!,
            function_name: "mutate_trigger_process_without_edge_v1",
          },
        ],
      } as never),
    ).toThrow(/generic Trigger process authority/u);

    expect(() =>
      assertTriggerProcessorLifecycleWriterSemanticsV1({
        ...TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        function_signatures:
          TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1.function_signatures.map(
            (writer) =>
              writer.function_name === "record_runtime_started_v1"
                ? {
                    ...writer,
                    arguments: writer.arguments.filter(
                      ({ argument_name }) =>
                        argument_name !== "p_runtime_started_evidence",
                    ),
                  }
                : writer,
          ),
      } as never),
    ).toThrow(/lifecycle (?:fence|edge)/u);

    expect(() =>
      assertTriggerProcessorLifecycleWriterSemanticsV1({
        ...TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        function_signatures:
          TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1.function_signatures.map(
            (writer) =>
              writer.function_name === "advance_trigger_stage_v1"
                ? {
                    ...writer,
                    writes_tables: [
                      ...writer.writes_tables,
                      "runtime_start_reservations",
                    ],
                    effects: [
                      ...writer.effects,
                      {
                        table_name: "runtime_start_reservations",
                        operation: "transition",
                        concurrency_control: "expected_state_version",
                      },
                    ],
                  }
                : writer,
          ),
      } as never),
    ).toThrow(/lifecycle edge/u);

    const finalizer = signature(
      TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
      "finalize_trigger_meta_projection_v1",
    );
    expect(finalizer?.arguments.map(({ argument_name }) => argument_name)).toEqual(
      expect.arrayContaining([
        "p_expected_projection_version",
        "p_expected_process_phase",
        "p_expected_process_status",
        "p_expected_process_updated_at",
        "p_expected_meta_enqueue_reason",
        "p_source_event",
        "p_meta_finalization_evidence",
      ]),
    );
    expect(finalizer?.reads_tables).toEqual(
      expect.arrayContaining([
        "trigger_process_meta_projections",
        "trigger_processes",
        "trigger_process_transitions",
        "trigger_event_inbox",
      ]),
    );
    expect(finalizer?.effects).toEqual([
      {
        table_name: "trigger_process_meta_projections",
        operation: "upsert",
        concurrency_control: "expected_version",
      },
      {
        table_name: "trigger_processes",
        operation: "transition",
        concurrency_control: "expected_state_version",
      },
      {
        table_name: "trigger_process_transitions",
        operation: "append",
        concurrency_control: "idempotency_key",
      },
      {
        table_name: "trigger_event_inbox",
        operation: "append",
        concurrency_control: "durable_event_identity",
      },
      {
        table_name: "trigger_event_dlq",
        operation: "append",
        concurrency_control: "idempotency_key",
      },
      {
        table_name: "trigger_event_outbox",
        operation: "enqueue",
        concurrency_control: "idempotency_key",
      },
    ]);

    expect(() =>
      assertTriggerProcessorLifecycleWriterSemanticsV1({
        ...TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        function_signatures:
          TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1.function_signatures.map(
            (writer) =>
              writer.function_name === "finalize_trigger_meta_projection_v1"
                ? {
                    ...writer,
                    arguments: writer.arguments.filter(
                      ({ argument_name }) =>
                        argument_name !== "p_expected_meta_enqueue_reason",
                    ),
                  }
                : writer,
          ),
      } as never),
    ).toThrow(/lifecycle fence/u);
  });

  it("requires independent fenced writers for weak and strong queue progression", () => {
    const claim = signature(
      TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
      "claim_weak_trigger_queue_v1",
    );
    expect(claim?.effects).toContainEqual({
      table_name: "weak_trigger_queue_items",
      operation: "transition",
      concurrency_control: "lease_fence",
    });
    expect(
      signature(
        TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        "retry_weak_trigger_queue_item_v1",
      )?.effects,
    ).toContainEqual({
      table_name: "weak_trigger_queue_items",
      operation: "transition",
      concurrency_control: "lease_fence",
    });
    expect(
      signature(
        TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        "complete_weak_trigger_queue_item_v1",
      )?.effects,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table_name: "weak_trigger_queue_items",
          concurrency_control: "lease_fence",
        }),
        expect.objectContaining({
          table_name: "weak_trigger_groups",
          concurrency_control: "expected_state_version",
        }),
      ]),
    );

    const weakPromotion = signature(
      TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
      "promote_weak_trigger_queue_head_v1",
    );
    expect(
      weakPromotion?.arguments.map(({ argument_name }) => argument_name),
    ).toEqual(
      expect.arrayContaining([
        "p_expected_queue_status",
        "p_expected_queue_updated_at",
        "p_expected_slot_fence",
        "p_expected_strong_fifo_revision",
        "p_expected_strong_fifo_empty_fence",
        "p_strong_fifo_empty_lock_ref",
        "p_worker_id",
        "p_lease_seconds",
      ]),
    );
    expect(weakPromotion?.effects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table_name: "weak_trigger_queue_items",
          concurrency_control: "lease_fence",
        }),
        expect.objectContaining({
          table_name: "bot_foreground_slots",
          concurrency_control: "generation_fence",
        }),
        expect.objectContaining({
          table_name: "trigger_processes",
          concurrency_control: "expected_state_version",
        }),
        expect.objectContaining({ table_name: "trigger_command_outbox" }),
      ]),
    );

    const promote = signature(
      TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
      "promote_strong_fifo_head_v1",
    );
    expect(promote?.arguments.map(({ argument_name }) => argument_name)).toEqual(
      expect.arrayContaining([
        "p_expected_slot_fence",
        "p_expected_strong_fifo_revision",
        "p_expected_head_process_id",
        "p_expected_head_admission_time",
        "p_strong_fifo_head_lock_ref",
        "p_expected_preempt_commit_fence",
        "p_expected_head_phase",
        "p_expected_head_status",
        "p_expected_head_updated_at",
      ]),
    );
    expect(promote?.effects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table_name: "bot_foreground_slots",
          concurrency_control: "generation_fence",
        }),
        expect.objectContaining({
          table_name: "trigger_processes",
          concurrency_control: "expected_state_version",
        }),
        expect.objectContaining({ table_name: "trigger_command_outbox" }),
      ]),
    );
  });

  it("pins Trigger lifecycle columns and all nine terminal outcomes", () => {
    const processPermission = TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1.table_permissions
      .find(({ table_name }) => table_name === "trigger_processes");
    expect(processPermission?.select_columns).toEqual(
      expect.arrayContaining(["admission_time", "current_reason_code"]),
    );
    expect(
      TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1.table_permissions.find(
        ({ table_name }) => table_name === "trigger_process_transitions",
      )?.select_columns,
    ).toContain("reason_code");
    expect(
      TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1.database_checks?.find(
        ({ constraint_name }) =>
          constraint_name === "trigger_processes_terminal_outcome_check",
      )?.semantic_constraint,
    ).toEqual({
      kind: "nullable_text_enum",
      column_name: "terminal_outcome",
      allowed_values: TERMINAL_OUTCOMES_V1,
    });
  });

  it("does not model mutable work records as append-only", () => {
    const cases = [
      [TIMER_REPOSITORY_CONTRACT_V1, "timer_command_requests"],
      [META_COGNITION_REPOSITORY_CONTRACT_V1, "meta_memory_split_chunks"],
      [KNOWTHAT_REPOSITORY_CONTRACT_V1, "knowthat_conflicts"],
      [KNOWTHAT_REPOSITORY_CONTRACT_V1, "knowthat_linkage_checks"],
      [MEMORY_REPOSITORY_CONTRACT_V1, "memory_conflicts"],
    ] as const;
    for (const [contract, table] of cases) {
      expect(contract.append_only_tables).not.toContain(table);
      expect(
        contract.table_permissions.find(({ table_name }) => table_name === table)
          ?.writer_kind,
      ).toBe("state_transition");
    }
    expect(KNOWTHAT_REPOSITORY_CONTRACT_V1.append_only_tables).not.toContain(
      "knowthat_fact_query_versions",
    );
    expect(
      KNOWTHAT_REPOSITORY_CONTRACT_V1.table_permissions.find(
        ({ table_name }) => table_name === "knowthat_fact_query_versions",
      )?.writer_kind,
    ).toBe("projection_upsert");
  });

  it("removes unrelated lifecycle tables from former mega writers", () => {
    expect(
      signature(META_COGNITION_REPOSITORY_CONTRACT_V1, "transition_meta_job_v1")
        ?.writes_tables,
    ).toEqual(["meta_jobs", "meta_job_audit_logs", "meta_event_outbox"]);
    expect(
      signature(
        SKILL_REGISTRY_REPOSITORY_CONTRACT_V1,
        "transition_skill_version_lifecycle_v1",
      )?.writes_tables,
    ).toEqual([
      "skill_versions",
      "skill_security_state",
      "skill_audit_logs",
      "skill_event_outbox",
    ]);
    expect(
      signature(KNOWTHAT_REPOSITORY_CONTRACT_V1, "transition_knowthat_fact_v1")
        ?.writes_tables,
    ).toEqual([
      "knowthat_facts",
      "knowthat_fact_revisions",
      "knowthat_event_outbox",
    ]);
    expect(
      signature(TIMER_REPOSITORY_CONTRACT_V1, "transition_timer_occurrence_v1")
        ?.writes_tables,
    ).not.toEqual(
      expect.arrayContaining([
        "timer_command_requests",
        "timer_query_requests",
        "timer_event_inbox",
      ]),
    );
  });

  it("fails closed when a Trigger queue fence or atomic outbox effect drifts", () => {
    expect(() =>
      assertTriggerProcessorLifecycleWriterSemanticsV1({
        ...TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        function_signatures:
          TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1.function_signatures.map(
            (writer) =>
              writer.function_name === "promote_weak_trigger_queue_head_v1"
                ? {
                    ...writer,
                    arguments: writer.arguments.filter(
                      ({ argument_name }) =>
                        argument_name !== "p_expected_strong_fifo_revision",
                    ),
                  }
                : writer,
          ),
      } as never),
    ).toThrow(/lifecycle (?:fence|edge)/u);

    expect(() =>
      assertTriggerProcessorLifecycleWriterSemanticsV1({
        ...TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        function_signatures:
          TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1.function_signatures.map(
            (writer) =>
              writer.function_name === "promote_strong_fifo_head_v1"
                ? {
                    ...writer,
                    effects: writer.effects.filter(
                      ({ table_name }) => table_name !== "trigger_command_outbox",
                    ),
                  }
                : writer,
          ),
      } as never),
    ).toThrow(/lifecycle (?:fence|edge)/u);

    expect(() =>
      assertTriggerProcessorLifecycleWriterSemanticsV1({
        ...TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        append_only_tables: [
          ...TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1.append_only_tables,
          "weak_trigger_queue_items",
        ],
      } as never),
    ).toThrow(/mutable state-transition/u);
  });
});
