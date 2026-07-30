import { describe, expect, it } from "vitest";

import { ACTION_RUNTIME_REPOSITORY_CONTRACT_V1 } from "../src/db/permission-manifest.v1.js";

const signature = (name: string) =>
  ACTION_RUNTIME_REPOSITORY_CONTRACT_V1.function_signatures.find(
    ({ function_name }) => function_name === name,
  );

const argumentNames = (name: string) =>
  signature(name)?.arguments.map(({ argument_name }) => argument_name);

describe("Action Runtime permission manifest", () => {
  it("exposes the canonical lifecycle and recovery writers without legacy aliases", () => {
    expect(ACTION_RUNTIME_REPOSITORY_CONTRACT_V1.mutable_writers).toEqual(
      expect.arrayContaining([
        "create_runtime_start_attempt_v1",
        "begin_runtime_start_reservation_validation_call_v1",
        "append_runtime_start_reservation_validation_v1",
        "transition_runtime_start_attempt_v1",
        "transition_runtime_run_v1",
        "cas_runtime_run_lease_v1",
        "cas_tool_permission_profile_current_v1",
        "append_runtime_event_v1",
        "record_tool_invocation_v1",
        "mark_tool_invocation_running_v1",
        "finalize_tool_invocation_v1",
        "freeze_unknown_tool_side_effect_v1",
        "reconcile_tool_invocation_v1",
        "record_runtime_control_signal_v1",
        "transition_runtime_control_signal_v1",
        "record_runtime_artifact_v1",
        "finalize_runtime_artifact_v1",
        "claim_runtime_artifact_reconciliation_v1",
        "reconcile_runtime_artifact_v1",
        "record_runtime_event_inbox_v1",
        "touch_runtime_skill_security_projection_v1",
        "record_runtime_consumer_dead_letter_v1",
        "claim_runtime_event_outbox_v1",
        "ack_runtime_event_outbox_v1",
        "detect_missing_runtime_event_delivery_v1",
        "claim_runtime_event_reconciliation_v1",
        "ack_runtime_event_reconciliation_v1",
        "rematerialize_runtime_event_outbox_v1",
        "quarantine_runtime_event_outbox_drift_v1",
        "activate_eventing_transport_epoch_v1",
      ]),
    );
    for (const legacyName of [
      "persist_runtime_policy_snapshot_v1",
      "transition_tool_invocation_v1",
      "transition_runtime_artifact_v1",
    ]) {
      expect(ACTION_RUNTIME_REPOSITORY_CONTRACT_V1.mutable_writers).not.toContain(
        legacyName,
      );
      expect(signature(legacyName)).toBeUndefined();
    }
  });

  it.each([
    [
      "create_runtime_start_attempt_v1",
      ["runtime_policy_input_artifacts", "runtime_start_attempts"],
    ],
    [
      "begin_runtime_start_reservation_validation_call_v1",
      ["runtime_start_reservation_validation_calls"],
    ],
    [
      "append_runtime_start_reservation_validation_v1",
      ["runtime_start_attempts", "runtime_start_reservation_validations"],
    ],
    [
      "transition_runtime_start_attempt_v1",
      [
        "runtime_start_attempts",
        "runtime_start_reservation_validations",
        "runtime_runs",
        "runtime_policy_snapshots",
        "runtime_permissions",
      ],
    ],
    [
      "transition_runtime_run_v1",
      [
        "runtime_runs",
        "runtime_run_leases",
        "runtime_events",
        "runtime_event_outbox",
      ],
    ],
    ["cas_runtime_run_lease_v1", ["runtime_run_leases"]],
    [
      "cas_tool_permission_profile_current_v1",
      [
        "tool_permission_profile_revisions",
        "tool_permission_profile_current",
      ],
    ],
    [
      "append_runtime_event_v1",
      ["runtime_events", "runtime_event_outbox"],
    ],
    [
      "record_tool_invocation_v1",
      ["tool_invocations", "runtime_events", "runtime_event_outbox"],
    ],
    ["mark_tool_invocation_running_v1", ["tool_invocations"]],
    [
      "finalize_tool_invocation_v1",
      ["tool_invocations", "runtime_events", "runtime_event_outbox"],
    ],
    [
      "freeze_unknown_tool_side_effect_v1",
      [
        "tool_invocations",
        "runtime_runs",
        "runtime_events",
        "runtime_event_outbox",
      ],
    ],
    [
      "reconcile_tool_invocation_v1",
      ["tool_invocations", "runtime_events", "runtime_event_outbox"],
    ],
    [
      "record_runtime_control_signal_v1",
      [
        "runtime_control_signals",
        "runtime_control_tombstones",
        "runtime_runs",
        "runtime_events",
        "runtime_event_outbox",
      ],
    ],
    [
      "transition_runtime_control_signal_v1",
      [
        "runtime_control_signals",
        "runtime_runs",
        "runtime_run_leases",
        "runtime_events",
        "runtime_event_outbox",
      ],
    ],
    ["record_runtime_artifact_v1", ["runtime_artifacts"]],
    [
      "finalize_runtime_artifact_v1",
      ["runtime_artifacts", "runtime_events", "runtime_event_outbox"],
    ],
    [
      "claim_runtime_artifact_reconciliation_v1",
      ["runtime_artifacts"],
    ],
    [
      "reconcile_runtime_artifact_v1",
      ["runtime_artifacts", "runtime_events", "runtime_event_outbox"],
    ],
    [
      "record_runtime_event_inbox_v1",
      [
        "runtime_event_inbox",
        "runtime_skill_security_projection",
        "runtime_event_dlq",
      ],
    ],
    [
      "touch_runtime_skill_security_projection_v1",
      ["runtime_skill_security_projection"],
    ],
    ["record_runtime_consumer_dead_letter_v1", ["runtime_event_dlq"]],
    ["claim_runtime_event_outbox_v1", ["runtime_event_outbox"]],
    [
      "ack_runtime_event_outbox_v1",
      ["runtime_event_outbox", "runtime_event_dlq"],
    ],
    [
      "detect_missing_runtime_event_delivery_v1",
      ["runtime_event_outbox_reconciliations"],
    ],
    [
      "claim_runtime_event_reconciliation_v1",
      ["runtime_event_outbox_reconciliations"],
    ],
    [
      "ack_runtime_event_reconciliation_v1",
      ["runtime_event_outbox_reconciliations", "runtime_event_dlq"],
    ],
    [
      "rematerialize_runtime_event_outbox_v1",
      ["runtime_event_outbox", "runtime_event_outbox_reconciliations"],
    ],
    [
      "quarantine_runtime_event_outbox_drift_v1",
      ["runtime_event_outbox_quarantine"],
    ],
  ] as const)(
    "keeps %s scoped to its legal aggregate effects",
    (writerName, expectedTables) => {
      const writer = signature(writerName);
      expect(writer).toBeDefined();
      expect(writer?.writes_tables).toEqual(expectedTables);
      expect(
        new Set(writer?.effects.map(({ table_name }) => table_name)),
      ).toEqual(new Set(expectedTables));
    },
  );

  it("binds mutable runtime work to start and lease generation fences", () => {
    for (const writerName of [
      "transition_runtime_run_v1",
      "cas_runtime_run_lease_v1",
      "append_runtime_event_v1",
      "record_tool_invocation_v1",
      "mark_tool_invocation_running_v1",
      "finalize_tool_invocation_v1",
      "freeze_unknown_tool_side_effect_v1",
      "reconcile_tool_invocation_v1",
      "record_runtime_artifact_v1",
      "finalize_runtime_artifact_v1",
      "reconcile_runtime_artifact_v1",
    ]) {
      const names = argumentNames(writerName) ?? [];
      expect(names).toContain("p_expected_start_fence_generation");
      expect(
        names.includes("p_expected_lease_generation") ||
          names.includes("p_expected_invocation_lease_generation") ||
          names.includes("p_expected_originating_lease_generation"),
      ).toBe(true);
    }
    expect(argumentNames("cas_runtime_run_lease_v1")).toContain(
      "p_next_lease_generation",
    );
    expect(argumentNames("cas_runtime_run_lease_v1")).toEqual(
      expect.arrayContaining([
        "p_expected_recovery_state",
        "p_next_recovery_state",
      ]),
    );
    expect(signature("cas_runtime_run_lease_v1")?.reads_tables).toEqual(
      expect.arrayContaining(["tool_invocations", "runtime_artifacts"]),
    );
  });

  it("derives a control target generation from the locked owner row", () => {
    const record = signature("record_runtime_control_signal_v1");
    expect(record?.arguments.map(({ argument_name }) => argument_name)).toEqual(
      expect.arrayContaining([
        "p_expected_start_fence_generation",
        "p_request_source",
        "p_verified_control_claims",
        "p_policy_checkpoint",
      ]),
    );
    expect(record?.arguments.map(({ argument_name }) => argument_name)).not.toContain(
      "p_expected_lease_generation",
    );
    expect(
      record?.arguments.find(
        ({ argument_name }) =>
          argument_name === "p_verified_control_claims",
      )?.nullable,
    ).toBe(true);
    expect(
      record?.arguments.find(
        ({ argument_name }) =>
          argument_name === "p_policy_checkpoint",
      )?.nullable,
    ).toBe(true);
    expect(record?.reads_tables).toEqual(
      expect.arrayContaining([
        "runtime_runs",
        "runtime_run_leases",
        "runtime_control_tombstones",
      ]),
    );
    expect(record?.effects).toEqual(
      expect.arrayContaining([
        {
          table_name: "runtime_control_signals",
          operation: "append",
          concurrency_control: "advisory_identity_lock",
        },
        {
          table_name: "runtime_runs",
          operation: "transition",
          concurrency_control: "database_row_lock",
        },
        {
          table_name: "runtime_control_tombstones",
          operation: "append",
          concurrency_control: "idempotency_key",
        },
      ]),
    );

    const transition = signature("transition_runtime_control_signal_v1");
    const transitionArguments =
      transition?.arguments.map(({ argument_name }) => argument_name) ?? [];
    expect(transitionArguments).toEqual(
      expect.arrayContaining([
        "p_expected_start_fence_generation",
        "p_worker_lease_id",
        "p_worker_id",
      ]),
    );
    expect(transitionArguments).not.toContain(
      "p_expected_lease_generation",
    );
    expect(transition?.effects).toEqual(
      expect.arrayContaining([
        {
          table_name: "runtime_control_signals",
          operation: "transition",
          concurrency_control: "advisory_identity_lock",
        },
        {
          table_name: "runtime_runs",
          operation: "transition",
          concurrency_control: "database_row_lock",
        },
      ]),
    );
  });

  it("separates durable create, normal transition, and unknown-side-effect recovery", () => {
    expect(signature("record_tool_invocation_v1")?.effects).toEqual(
      expect.arrayContaining([
        {
          table_name: "tool_invocations",
          operation: "append",
          concurrency_control: "generation_fence",
        },
        {
          table_name: "tool_invocations",
          operation: "append",
          concurrency_control: "idempotency_key",
        },
      ]),
    );
    expect(signature("mark_tool_invocation_running_v1")?.writes_tables).toEqual([
      "tool_invocations",
    ]);
    expect(
      signature("freeze_unknown_tool_side_effect_v1")?.writes_tables,
    ).toContain("runtime_runs");
    expect(argumentNames("reconcile_tool_invocation_v1")).toEqual(
      expect.arrayContaining([
        "p_expected_side_effect_status",
        "p_expected_invocation_lease_generation",
        "p_expected_request_hash",
        "p_expected_downstream_idempotency_key",
      ]),
    );

    expect(signature("record_runtime_artifact_v1")?.writes_tables).toEqual([
      "runtime_artifacts",
    ]);
    expect(signature("finalize_runtime_artifact_v1")?.writes_tables).toEqual([
      "runtime_artifacts",
      "runtime_events",
      "runtime_event_outbox",
    ]);
    expect(argumentNames("reconcile_runtime_artifact_v1")).toEqual(
      expect.arrayContaining([
        "p_expected_status",
        "p_expected_start_fence_generation",
        "p_expected_originating_lease_generation",
        "p_reconciliation_owner",
        "p_expected_reconciliation_generation",
        "p_reconciliation_locked_until",
        "p_terminal_status",
      ]),
    );
    expect(
      signature("reconcile_runtime_artifact_v1")?.effects,
    ).toEqual(
      expect.arrayContaining([
        {
          table_name: "runtime_artifacts",
          operation: "transition",
          concurrency_control: "generation_fence",
        },
      ]),
    );

    const artifactClaim = signature(
      "claim_runtime_artifact_reconciliation_v1",
    );
    expect(artifactClaim).toMatchObject({
      primary_table: "runtime_artifacts",
      writer_kind: "state_transition",
      reads_tables: [
        "runtime_runs",
        "runtime_run_leases",
        "runtime_artifacts",
      ],
      writes_tables: ["runtime_artifacts"],
      returns: "setof jsonb",
    });
    expect(argumentNames(
      "claim_runtime_artifact_reconciliation_v1",
    )).toEqual([
      "p_worker_id",
      "p_limit",
      "p_lease_seconds",
      "p_now",
    ]);
    expect(artifactClaim?.effects).toEqual([
      {
        table_name: "runtime_artifacts",
        operation: "claim",
        concurrency_control: "lease_fence",
        claim_locking: "for_update_skip_locked",
        claim_fence: {
          identity_column: "id",
          status_column: "status",
          eligible_status: "creating",
          worker_column: "reconciliation_owner",
          lease_expires_at_column: "reconciliation_expires_at",
          generation_column: "reconciliation_generation",
          order_by_columns: [
            "reconciliation_expires_at",
            "created_at",
            "id",
          ],
        },
        claim_authority: {
          owner_table_name: "runtime_runs",
          owner_identity_column: "id",
          claimed_owner_identity_column: "runtime_run_id",
          originating_lease_generation_column:
            "originating_lease_generation",
          lease_table_name: "runtime_run_leases",
          lease_owner_identity_column: "runtime_run_id",
          lease_generation_column: "lease_generation",
          lease_expires_at_column: "lease_expires_at",
          lease_state_column: "recovery_state",
          active_lease_state: "active",
        },
      },
    ]);
  });

  it("binds profile pointer CAS to the five-scope identity and pointer version", () => {
    expect(argumentNames("cas_tool_permission_profile_current_v1")).toEqual(
      expect.arrayContaining([
        "p_workspace_id",
        "p_bot_id",
        "p_owner_agent_id",
        "p_deployment_environment",
        "p_release_channel",
        "p_expected_revision",
        "p_expected_pointer_version",
        "p_next_revision",
        "p_next_pointer_version",
        "p_next_policy_epoch",
      ]),
    );
    expect(
      signature("cas_tool_permission_profile_current_v1")?.writes_tables,
    ).not.toContain("runtime_events");
    expect(
      signature("cas_runtime_run_lease_v1")?.writes_tables,
    ).not.toContain("runtime_events");
  });

  it("serializes every start/control edge and locks the run before lease mutation", () => {
    for (const [writerName, tableName, operation] of [
      [
        "create_runtime_start_attempt_v1",
        "runtime_start_attempts",
        "append",
      ],
      ["transition_runtime_start_attempt_v1", "runtime_runs", "append"],
      ["transition_runtime_run_v1", "runtime_runs", "transition"],
      [
        "record_runtime_control_signal_v1",
        "runtime_control_signals",
        "append",
      ],
      [
        "transition_runtime_control_signal_v1",
        "runtime_control_signals",
        "transition",
      ],
    ] as const) {
      expect(signature(writerName)?.effects).toContainEqual({
        table_name: tableName,
        operation,
        concurrency_control: "advisory_identity_lock",
      });
      expect(argumentNames(writerName)).toContain("p_runtime_run_id");
    }

    for (const writerName of [
      "transition_runtime_run_v1",
      "cas_runtime_run_lease_v1",
    ]) {
      expect(signature(writerName)?.effects).toContainEqual({
        table_name: "runtime_run_leases",
        operation: "cas",
        concurrency_control: "database_row_lock",
        lock_table_name: "runtime_runs",
      });
    }

    for (const [writerName, tableName, operation] of [
      ["append_runtime_event_v1", "runtime_events", "append"],
      ["record_tool_invocation_v1", "tool_invocations", "append"],
      ["mark_tool_invocation_running_v1", "tool_invocations", "transition"],
      ["finalize_tool_invocation_v1", "tool_invocations", "transition"],
      ["freeze_unknown_tool_side_effect_v1", "tool_invocations", "transition"],
      ["reconcile_tool_invocation_v1", "tool_invocations", "transition"],
      ["record_runtime_control_signal_v1", "runtime_control_signals", "append"],
      [
        "transition_runtime_control_signal_v1",
        "runtime_control_signals",
        "transition",
      ],
      ["record_runtime_artifact_v1", "runtime_artifacts", "append"],
      ["finalize_runtime_artifact_v1", "runtime_artifacts", "transition"],
      ["reconcile_runtime_artifact_v1", "runtime_artifacts", "transition"],
    ] as const) {
      expect(signature(writerName)?.effects).toContainEqual({
        table_name: tableName,
        operation,
        concurrency_control: "database_row_lock",
        lock_table_name: "runtime_runs",
      });
    }
  });

  it("pins every Action Runtime bigint exposed as a JSON number to a safe range", () => {
    const checks =
      ACTION_RUNTIME_REPOSITORY_CONTRACT_V1.database_checks ?? [];
    const check = (tableName: string, columnName: string) =>
      checks.find(
        ({ table_name, semantic_constraint }) =>
          table_name === tableName &&
          semantic_constraint !== undefined &&
          "column_name" in semantic_constraint &&
          semantic_constraint.column_name === columnName,
      )?.semantic_constraint;

    expect(check("runtime_runs", "start_fence_generation")).toEqual({
      kind: "integer_range",
      column_name: "start_fence_generation",
      min: 1,
      max: Number.MAX_SAFE_INTEGER,
    });
    expect(check("runtime_policy_snapshots", "tool_policy_epoch")).toEqual({
      kind: "integer_range",
      column_name: "tool_policy_epoch",
      min: 0,
      max: Number.MAX_SAFE_INTEGER,
    });
    expect(
      check("runtime_control_signals", "target_lease_generation"),
    ).toEqual({
      kind: "nullable_integer_range",
      column_name: "target_lease_generation",
      min: 1,
      max: Number.MAX_SAFE_INTEGER,
    });
    expect(check("runtime_artifacts", "size_bytes")).toEqual({
      kind: "nullable_integer_range",
      column_name: "size_bytes",
      min: 0,
      max: Number.MAX_SAFE_INTEGER,
    });
    expect(
      check("runtime_artifacts", "originating_lease_generation"),
    ).toEqual({
      kind: "integer_range",
      column_name: "originating_lease_generation",
      min: 1,
      max: Number.MAX_SAFE_INTEGER,
    });
    expect(
      check("runtime_artifacts", "reconciliation_generation"),
    ).toEqual({
      kind: "integer_range",
      column_name: "reconciliation_generation",
      min: 0,
      max: Number.MAX_SAFE_INTEGER,
    });
  });

  it("gives every TP reservation response an append-only sequenced evidence writer", () => {
    const validationCallWriter = signature(
      "begin_runtime_start_reservation_validation_call_v1",
    );
    expect(validationCallWriter).toMatchObject({
      primary_table:
        "runtime_start_reservation_validation_calls",
      writer_kind: "immutable_append",
      reads_tables: [
        "runtime_start_attempts",
        "runtime_start_reservation_validation_calls",
        "runtime_start_reservation_validations",
      ],
      writes_tables: [
        "runtime_start_reservation_validation_calls",
      ],
    });
    expect(
      argumentNames(
        "begin_runtime_start_reservation_validation_call_v1",
      ),
    ).toEqual([
      "p_runtime_run_id",
      "p_runtime_start_attempt_id",
      "p_expected_start_request_hash",
      "p_expected_start_fence_token_hash",
      "p_expected_actor_binding_hash",
      "p_validation_call_id",
      "p_validation_stage",
      "p_owner_request_hash",
      "p_requested_at",
      "p_idempotency_key",
      "p_trace_id",
    ]);
    const validationWriter = signature(
      "append_runtime_start_reservation_validation_v1",
    );
    expect(validationWriter).toMatchObject({
      primary_table: "runtime_start_reservation_validations",
      writer_kind: "immutable_append",
      reads_tables: [
        "runtime_start_attempts",
        "runtime_start_reservation_validation_calls",
        "runtime_start_reservation_validations",
      ],
      writes_tables: [
        "runtime_start_attempts",
        "runtime_start_reservation_validations",
      ],
    });
    expect(
      argumentNames(
        "append_runtime_start_reservation_validation_v1",
      ),
    ).toEqual([
      "p_runtime_run_id",
      "p_runtime_start_attempt_id",
      "p_expected_start_request_hash",
      "p_expected_start_fence_token_hash",
      "p_expected_actor_binding_hash",
      "p_validation_call_id",
      "p_validation_stage",
      "p_owner_request_hash",
      "p_response_source",
      "p_response_schema_version",
      "p_response_hash",
      "p_owner_response",
      "p_validated_at",
      "p_idempotency_key",
      "p_trace_id",
    ]);
    expect(validationWriter?.effects).toEqual(
      expect.arrayContaining([
        {
          table_name: "runtime_start_reservation_validations",
          operation: "append",
          concurrency_control: "expected_state_version",
        },
        {
          table_name: "runtime_start_reservation_validations",
          operation: "append",
          concurrency_control: "database_row_lock",
          lock_table_name: "runtime_start_attempts",
        },
        {
          table_name: "runtime_start_reservation_validations",
          operation: "append",
          concurrency_control: "advisory_identity_lock",
        },
      ]),
    );
    const selectedCallColumns =
      ACTION_RUNTIME_REPOSITORY_CONTRACT_V1.table_permissions.find(
        ({ table_name }) =>
          table_name ===
          "runtime_start_reservation_validation_calls",
      )?.select_columns ?? [];
    expect(selectedCallColumns).toEqual(
      expect.arrayContaining([
        "validation_call_id",
        "validation_stage",
        "request_hash",
        "trace_id",
        "requested_at",
      ]),
    );
    const selectedColumns =
      ACTION_RUNTIME_REPOSITORY_CONTRACT_V1.table_permissions.find(
        ({ table_name }) =>
          table_name === "runtime_start_reservation_validations",
      )?.select_columns ?? [];
    expect(selectedColumns).toEqual(
      expect.arrayContaining([
        "validation_call_id",
        "validation_sequence_no",
        "validation_result",
        "request_hash",
        "start_fence_token_hash",
        "actor_binding_hash",
        "response_source",
        "response_schema_version",
        "response_hash",
        "owner_response",
      ]),
    );
    expect(
      ACTION_RUNTIME_REPOSITORY_CONTRACT_V1.database_indexes,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          index_name:
            "runtime_start_reservation_val_runtime_start_attempt_id_vali_key",
          unique: true,
        }),
        expect.objectContaining({
          index_name:
            "runtime_start_reservation_validation_calls_identity_key",
          unique: true,
        }),
        expect.objectContaining({
          index_name:
            "runtime_start_reservation_validations_call_key",
          unique: true,
        }),
      ]),
    );
  });

  it("pins the artifact claim eligibility status to the owner schema", () => {
    const statusCheck =
      ACTION_RUNTIME_REPOSITORY_CONTRACT_V1.database_checks?.find(
        ({ constraint_name }) =>
          constraint_name === "runtime_artifacts_status_check",
      );
    expect(statusCheck?.semantic_constraint).toEqual({
      kind: "text_enum",
      column_name: "status",
      allowed_values: ["creating", "available", "failed"],
    });
  });

  it("keeps claim leases and reconciliation metadata behind owner writers", () => {
    const selectedOutboxColumns =
      ACTION_RUNTIME_REPOSITORY_CONTRACT_V1.table_permissions.find(
        ({ table_name }) => table_name === "runtime_event_outbox",
      )?.select_columns ?? [];
    for (const privateColumn of [
      "claimed_by",
      "claim_token",
      "locked_until",
      "transport_ref",
      "transport_epoch",
      "transport_generation",
      "sent_at",
    ]) {
      expect(selectedOutboxColumns).not.toContain(privateColumn);
      expect(
        ACTION_RUNTIME_REPOSITORY_CONTRACT_V1.database_columns?.some(
          ({ table_name, column_name }) =>
            table_name === "runtime_event_outbox" &&
            column_name === privateColumn,
        ),
      ).toBe(true);
    }

    const selectedReconciliationColumns =
      ACTION_RUNTIME_REPOSITORY_CONTRACT_V1.table_permissions.find(
        ({ table_name }) =>
          table_name === "runtime_event_outbox_reconciliations",
      )?.select_columns ?? [];
    for (const privateColumn of [
      "claim_token",
      "claimed_by",
      "locked_until",
      "claim_generation",
    ]) {
      expect(selectedReconciliationColumns).not.toContain(privateColumn);
      expect(
        ACTION_RUNTIME_REPOSITORY_CONTRACT_V1.database_columns?.some(
          ({ table_name, column_name }) =>
            table_name === "runtime_event_outbox_reconciliations" &&
            column_name === privateColumn,
        ),
      ).toBe(true);
    }

    const selectedArtifactColumns =
      ACTION_RUNTIME_REPOSITORY_CONTRACT_V1.table_permissions.find(
        ({ table_name }) => table_name === "runtime_artifacts",
      )?.select_columns ?? [];
    for (const privateColumn of [
      "originating_lease_generation",
      "reconciliation_generation",
      "reconciliation_owner",
      "reconciliation_expires_at",
    ]) {
      expect(selectedArtifactColumns).not.toContain(privateColumn);
      expect(
        ACTION_RUNTIME_REPOSITORY_CONTRACT_V1.database_columns?.some(
          ({ table_name, column_name }) =>
            table_name === "runtime_artifacts" &&
            column_name === privateColumn,
        ),
      ).toBe(true);
    }
    expect(
      ACTION_RUNTIME_REPOSITORY_CONTRACT_V1.database_indexes,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          index_name:
            "runtime_artifacts_reconciliation_due_idx",
          table_name: "runtime_artifacts",
          unique: false,
          valid: true,
          definition: expect.stringMatching(
            /reconciliation_expires_at NULLS FIRST.*status = 'creating'/u,
          ),
        }),
      ]),
    );
  });
});
