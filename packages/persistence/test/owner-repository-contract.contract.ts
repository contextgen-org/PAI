import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { ACTION_RUNTIME_REPOSITORY_CONTRACT_V1 } from "../../../services/action-runtime/src/db/permission-manifest.v1.js";
import { KNOWTHAT_REPOSITORY_CONTRACT_V1 } from "../../../services/knowthat/src/db/permission-manifest.v1.js";
import { MEMORY_REPOSITORY_CONTRACT_V1 } from "../../../services/memory/src/db/permission-manifest.v1.js";
import { META_COGNITION_REPOSITORY_CONTRACT_V1 } from "../../../services/meta-cognition/src/db/permission-manifest.v1.js";
import { SKILL_REGISTRY_REPOSITORY_CONTRACT_V1 } from "../../../services/skill-registry/src/db/permission-manifest.v1.js";
import { TIMER_REPOSITORY_CONTRACT_V1 } from "../../../services/timer-trigger-app/src/db/permission-manifest.v1.js";
import { TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1 } from "../../../services/trigger-processor/src/db/permission-manifest.v1.js";
import {
  defineOwnerRepositoryContractV1,
  OWNER_DATABASE_TARGETS_V1,
  ownerDatabaseApplicationDependenciesV1,
  ownerFunctionSignatureV1,
  verifyOwnerRepositoryDeploymentFromPostgresV1,
  verifyOwnerWriterDefinitionV1,
} from "../src/index.js";

const contracts = [
  TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
  ACTION_RUNTIME_REPOSITORY_CONTRACT_V1,
  TIMER_REPOSITORY_CONTRACT_V1,
  META_COGNITION_REPOSITORY_CONTRACT_V1,
  SKILL_REGISTRY_REPOSITORY_CONTRACT_V1,
  KNOWTHAT_REPOSITORY_CONTRACT_V1,
  MEMORY_REPOSITORY_CONTRACT_V1,
] as const;

const writerKinds = new Set([
  "immutable_append",
  "projection_upsert",
  "state_transition",
  "pointer_cas",
  "lease_fence",
  "queue_claim_ack",
  "outbox_claim_ack",
]);

describe("owner repository contracts", () => {
  it("covers all and only the seven database owners", () => {
    expect(contracts.map((contract) => contract.owner_service).sort()).toEqual(
      Object.keys(OWNER_DATABASE_TARGETS_V1).sort(),
    );
    expect(contracts.map((contract) => contract.owner_service)).not.toContain(
      "observation_gateway",
    );
  });

  it("binds every owner to one schema, app role, source, and generated SQL", () => {
    for (const contract of contracts) {
      expect(contract.schema).toBe(
        OWNER_DATABASE_TARGETS_V1[contract.owner_service].schema,
      );
      expect(contract.app_role).toBe(
        OWNER_DATABASE_TARGETS_V1[contract.owner_service].app_role,
      );
      expect(contract.manifest_source).toMatch(
        new RegExp(`^services/.+/src/db/permission-manifest\\.v1\\.ts$`),
      );
      expect(contract.generated_permission_sql).not.toHaveLength(0);
      expect(contract.generated_permission_sql.every((path) =>
        path.startsWith("pai-infra/supabase/generated/permissions/"),
      )).toBe(true);
      expect(contract.outbox_tables.every((table) =>
        contract.tables.includes(table),
      )).toBe(true);
      expect(contract.inbox_tables.every((table) =>
        contract.tables.includes(table),
      )).toBe(true);
      expect(contract.dlq_tables.every((table) =>
        contract.tables.includes(table),
      )).toBe(true);
      expect([
        ...contract.outbox_tables,
        ...contract.inbox_tables,
        ...contract.dlq_tables,
      ].every((table) => contract.append_only_tables.includes(table))).toBe(
        true,
      );
      expect(Object.isFrozen(contract)).toBe(true);
      expect(Object.isFrozen(contract.tables)).toBe(true);
    }
  });

  it("declares exact writer-only permissions for every fresh table", () => {
    for (const contract of contracts) {
      expect(contract.table_permissions.map(({ table_name }) => table_name)).toEqual(
        contract.tables,
      );
      for (const permission of contract.table_permissions) {
        expect(permission.select_columns.length).toBeGreaterThan(0);
        expect(permission.select_columns).not.toContain("*");
        expect(new Set(permission.select_columns).size).toBe(
          permission.select_columns.length,
        );
        expect(permission.insert_columns).toEqual([]);
        expect(permission.update_columns).toEqual([]);
        expect(permission.delete_allowed).toBe(false);
        expect(writerKinds.has(permission.writer_kind)).toBe(true);
        expect(Object.isFrozen(permission)).toBe(true);
        expect(Object.isFrozen(permission.select_columns)).toBe(true);
      }
    }
  });

  it("binds every named writer to a full SECURITY DEFINER signature", () => {
    for (const contract of contracts) {
      expect(
        contract.function_signatures.map(({ function_name }) => function_name),
      ).toEqual(contract.mutable_writers);
      for (const signature of contract.function_signatures) {
        const permission = contract.table_permissions.find(
          ({ table_name }) => table_name === signature.primary_table,
        );
        expect(permission?.writer_kind).toBe(signature.writer_kind);
        expect(signature.schema).toBe(contract.schema);
        expect(signature.security_definer).toBe(true);
        expect(signature.search_path).toEqual([contract.schema, "pg_temp"]);
        expect(signature.arguments.length).toBeGreaterThan(0);
        expect(signature.arguments.every(({ mode }) => mode === "in")).toBe(true);
        expect(new Set(signature.arguments.map(({ argument_name }) => argument_name)).size)
          .toBe(signature.arguments.length);
        expect(Object.isFrozen(signature)).toBe(true);
        expect(Object.isFrozen(signature.arguments)).toBe(true);
        expect(Object.isFrozen(signature.reads_tables)).toBe(true);
        expect(Object.isFrozen(signature.writes_tables)).toBe(true);
        expect(Object.isFrozen(signature.effects)).toBe(true);
        expect(signature.effects).toHaveLength(signature.writes_tables.length);
        expect(signature.effects.map(({ table_name }) => table_name).sort()).toEqual(
          [...signature.writes_tables].sort(),
        );
        expect(signature.writes_tables).toContain(signature.primary_table);
        expect(signature.reads_tables.every((table) => contract.tables.includes(table)))
          .toBe(true);
        expect(signature.writes_tables.every((table) => contract.tables.includes(table)))
          .toBe(true);
      }
      const writableTables = new Set(
        contract.function_signatures.flatMap(({ writes_tables }) => writes_tables),
      );
      expect(contract.tables.every((table) => writableTables.has(table))).toBe(true);
    }
  });

  it("uses the parent-owned timer service path and never creates an apps alias", () => {
    expect(TIMER_REPOSITORY_CONTRACT_V1.manifest_source).toBe(
      "services/timer-trigger-app/src/db/permission-manifest.v1.ts",
    );
  });

  it("pins the canonical Timer relation graph and TP meta-enqueue checks", () => {
    expect(TIMER_REPOSITORY_CONTRACT_V1.foreign_keys).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table_name: "timer_occurrences",
          columns: [
            "schedule_id",
            "workspace_id",
            "bot_id",
            "owner_agent_id",
            "deployment_environment",
            "release_channel",
          ],
          referenced_table: "timer_schedules",
        }),
        expect.objectContaining({
          table_name: "timer_dispatch_attempts",
          columns: ["occurrence_id"],
          referenced_table: "timer_occurrences",
        }),
      ]),
    );
    expect(TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1.database_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          constraint_name: "trigger_processes_meta_enqueue_reason_check",
          table_name: "trigger_processes",
          required_definition_fragments: expect.arrayContaining([
            "user_retracted",
            "system_interrupted",
          ]),
        }),
        expect.objectContaining({
          constraint_name: "trigger_processes_meta_enqueue_presence_check",
          table_name: "trigger_processes",
        }),
      ]),
    );
  });

  it("models trigger admission as one slot-fenced state/audit/outbox transaction", () => {
    const signature = TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1.function_signatures
      .find(({ function_name }) => function_name === "admit_trigger_v1");
    expect(signature?.arguments.map(({ argument_name }) => argument_name)).toEqual(
      expect.arrayContaining([
        "p_dedupe_key",
        "p_trigger_id",
        "p_process_id",
        "p_authenticated_context",
        "p_admission_request",
      ]),
    );
    expect(
      signature?.arguments.map(({ argument_name }) => argument_name),
    ).not.toContain("p_expected_slot_process_id");
    expect(
      signature?.arguments.map(({ argument_name }) => argument_name),
    ).not.toEqual(
      expect.arrayContaining([
        "p_priority",
        "p_admission_precondition",
        "p_admission_decision",
      ]),
    );
    expect(signature?.writes_tables).toEqual(
      expect.arrayContaining([
        "triggers",
        "trigger_processes",
        "trigger_process_transitions",
        "bot_foreground_slots",
        "weak_trigger_queue_items",
        "trigger_submit_attempts",
        "trigger_event_outbox",
      ]),
    );
  });

  it("binds mutable queue and memory lifecycle tables to narrow semantic effects", () => {
    expect(
      TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1.append_only_tables,
    ).not.toContain("trigger_snapshot_pending_events");
    const pendingWriter =
      TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1.function_signatures.find(
        ({ function_name }) =>
          function_name === "transition_trigger_snapshot_pending_event_v1",
      );
    expect(pendingWriter?.writer_kind).toBe("queue_claim_ack");
    expect(pendingWriter?.effects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table_name: "trigger_snapshot_pending_events",
          operation: "transition",
          concurrency_control: "expected_state_version",
        }),
      ]),
    );

    const seriesWriter = MEMORY_REPOSITORY_CONTRACT_V1.function_signatures.find(
      ({ function_name }) => function_name === "transition_memory_series_v1",
    );
    expect(seriesWriter?.writes_tables).toEqual([
      "memory_series",
      "memory_audit_logs",
      "memory_event_outbox",
    ]);
    expect(seriesWriter?.writes_tables).not.toContain("memory_feedback_events");
    expect(seriesWriter?.writes_tables).not.toContain(
      "memory_promotion_reservations",
    );
    expect(seriesWriter?.writes_tables).not.toContain("memory_graph_builds");
  });

  it("separates Action Runtime aggregate lifecycles into narrow writers", () => {
    const runWriter = ACTION_RUNTIME_REPOSITORY_CONTRACT_V1.function_signatures.find(
      ({ function_name }) => function_name === "transition_runtime_run_v1",
    );
    expect(runWriter?.writes_tables).toEqual([
      "runtime_runs",
      "runtime_events",
      "runtime_event_outbox",
    ]);
    expect(runWriter?.writes_tables).not.toContain("tool_invocations");
    expect(runWriter?.writes_tables).not.toContain("runtime_control_signals");
    expect(runWriter?.writes_tables).not.toContain("runtime_artifacts");
    expect(
      ACTION_RUNTIME_REPOSITORY_CONTRACT_V1.mutable_writers,
    ).toEqual(
      expect.arrayContaining([
        "persist_runtime_policy_snapshot_v1",
        "transition_tool_invocation_v1",
        "transition_runtime_control_signal_v1",
        "transition_runtime_artifact_v1",
      ]),
    );
  });

  it("fails closed on schema or role drift", () => {
    expect(() =>
      defineOwnerRepositoryContractV1({
        ...TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        schema: "memory",
      } as never),
    ).toThrow(/owner database target drift/);
  });

  it("requires canonical schema snapshots before live PostgreSQL verification", async () => {
    const queries: string[] = [];
    const postgres = {
      async query<TRow extends Record<string, unknown>>(sql: string) {
        queries.push(sql);
        return { rows: [] as TRow[] };
      },
    };
    await expect(
      verifyOwnerRepositoryDeploymentFromPostgresV1(
        TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        postgres,
        {
          expected_schema_owner: "pai_migrator",
          runtime_postgres: postgres,
        },
      ),
    ).rejects.toThrow(/canonical PostgreSQL column snapshot is required/);
    expect(queries).toEqual([]);
  });

  it("pins a complete non-empty canonical FK snapshot for every database owner", () => {
    for (const contract of contracts) {
      expect(contract.foreign_key_snapshot).toMatchObject({
        status: "complete",
      });
      expect(contract.foreign_keys.length).toBeGreaterThan(0);
      expect(
        contract.foreign_keys.every(
          (foreignKey) => {
            const sourceColumns = new Set(
              contract.table_permissions.find(
                ({ table_name }) => table_name === foreignKey.table_name,
              )?.select_columns,
            );
            const referencedColumns = new Set(
              contract.table_permissions.find(
                ({ table_name }) =>
                  table_name === foreignKey.referenced_table,
              )?.select_columns,
            );
            return (
              foreignKey.referenced_schema === contract.schema &&
              foreignKey.validated &&
              foreignKey.columns.length ===
                foreignKey.referenced_columns.length &&
              foreignKey.columns.every((column) =>
                sourceColumns.has(column),
              ) &&
              foreignKey.referenced_columns.every((column) =>
                referencedColumns.has(column),
              )
            );
          },
        ),
      ).toBe(true);
    }
  });

  it("projects an exact application capability without raw PostgreSQL access", () => {
    const composition = {
      deployment: { owner_service: "trigger_processor" },
      repository: { owner_service: "trigger_processor" },
      unit_of_work: { owner_service: "trigger_processor" },
      postgres: { query: () => Promise.resolve({ rows: [] }) },
      checkReadiness: () => Promise.resolve(),
      close: () => Promise.resolve(),
    } as never;
    const application = ownerDatabaseApplicationDependenciesV1(composition);
    expect(Object.keys(application).sort()).toEqual([
      "deployment",
      "repository",
      "unit_of_work",
    ]);
    expect(application).not.toHaveProperty("postgres");
    expect(application).not.toHaveProperty("close");
    expect(Object.isFrozen(application)).toBe(true);
  });

  it("rejects generic row locks as a slot/process admission fence", () => {
    const signature = ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "test_server_side_admission_v1",
      primary_table: "weak_trigger_queue_items",
      writer_kind: "state_transition",
      arguments: [
        ["p_scope", "jsonb"],
        ["p_authenticated_context", "jsonb"],
        ["p_admission_request", "jsonb"],
      ],
      reads_tables: [
        "bots",
        "bot_permission_bindings",
        "bot_foreground_slots",
        "trigger_processes",
      ],
      writes_tables: ["weak_trigger_queue_items"],
      effects: [
        {
          table_name: "weak_trigger_queue_items",
          operation: "enqueue",
          concurrency_control: "slot_and_process_state_fence",
        },
      ],
      returns: "jsonb",
    });
    const body = (locks: string) => `
      CREATE FUNCTION trigger_processor.test_server_side_admission_v1(
        p_scope jsonb,
        p_authenticated_context jsonb,
        p_admission_request jsonb
      ) RETURNS jsonb LANGUAGE plpgsql AS $body$
      BEGIN
        ${locks}
        PERFORM b.id, binding.bot_id,
                p_admission_request->>'is_catch_up',
                p_admission_request->>'explicit_interrupt',
                p_authenticated_context->>'workload_subject',
                p_authenticated_context->>'capability'
          FROM trigger_processor.bots b
          JOIN trigger_processor.bot_permission_bindings binding
            ON binding.bot_id = b.id
           AND binding.principal_id = p_authenticated_context->>'workload_subject'
           AND binding.permission_scope = p_authenticated_context->>'capability'
         WHERE b.workspace_id = p_scope->>'workspace_id'
           AND b.id = p_scope->>'bot_id'
           AND b.owner_agent_id = p_scope->>'owner_agent_id'
           AND b.deployment_environment = p_scope->>'deployment_environment'
           AND b.release_channel = p_scope->>'release_channel';
        INSERT INTO trigger_processor.weak_trigger_queue_items(id) VALUES ('id');
        RETURN '{}'::jsonb;
      END $body$`;
    expect(() =>
      verifyOwnerWriterDefinitionV1(
        TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        signature,
        body(`
          PERFORM 1
            FROM trigger_processor.bot_foreground_slots slot
            JOIN trigger_processor.trigger_processes process
              ON process.id = slot.process_id
           WHERE slot.bot_id = p_scope->>'bot_id'
             AND process.workspace_id = p_scope->>'workspace_id'
             AND process.bot_id = p_scope->>'bot_id'
             AND process.owner_agent_id = p_scope->>'owner_agent_id'
             AND process.deployment_environment = p_scope->>'deployment_environment'
             AND process.release_channel = p_scope->>'release_channel'
           FOR UPDATE;
        `),
      ),
    ).not.toThrow();
    expect(() =>
      verifyOwnerWriterDefinitionV1(
        TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        signature,
        body(`
          PERFORM 1 FROM trigger_processor.bots FOR UPDATE;
          PERFORM 1 FROM trigger_processor.bot_permission_bindings FOR UPDATE;
        `),
      ),
    ).toThrow(/slot\/process fence drift/);
    expect(() =>
      verifyOwnerWriterDefinitionV1(
        TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        signature,
        body(`
          PERFORM 1
            FROM trigger_processor.bot_foreground_slots slot
            JOIN trigger_processor.trigger_processes process
              ON process.id = slot.process_id
           WHERE false
           FOR UPDATE;
        `),
      ),
    ).toThrow(/unreachable relational proof|slot\/process fence drift/);
    expect(() =>
      verifyOwnerWriterDefinitionV1(
        TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        signature,
        body(`
          PERFORM 1
            FROM trigger_processor.bot_foreground_slots slot
            JOIN trigger_processor.trigger_processes process
              ON process.id = slot.process_id
           WHERE slot.bot_id = p_scope->>'bot_id'
           FOR UPDATE;
          PERFORM 1
            FROM trigger_processor.bots b
            JOIN trigger_processor.bot_permission_bindings binding ON 1 = 1
           WHERE false;
        `),
      ),
    ).toThrow(/unreachable relational proof|slot\/process fence drift/);
  });

  it("fails closed when FK columns drift outside declared table columns", () => {
    const aliasPermissionIndex =
      KNOWTHAT_REPOSITORY_CONTRACT_V1.table_permissions.findIndex(
        ({ table_name }) => table_name === "semantic_key_aliases",
      );
    expect(aliasPermissionIndex).toBeGreaterThanOrEqual(0);
    expect(() =>
      defineOwnerRepositoryContractV1({
        ...KNOWTHAT_REPOSITORY_CONTRACT_V1,
        table_permissions:
          KNOWTHAT_REPOSITORY_CONTRACT_V1.table_permissions.map(
            (permission, index) =>
              index === aliasPermissionIndex
                ? {
                    ...permission,
                    select_columns: permission.select_columns.filter(
                      (column) => column !== "target_fact_id",
                    ),
                  }
                : permission,
          ),
      } as never),
    ).toThrow(/invalid owner foreign key/);
  });

  it("rejects partial expected-state consumption and MERGE cross-owner reads", () => {
    const transitionSignature = ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "test_transition_process_v1",
      primary_table: "trigger_processes",
      writer_kind: "state_transition",
      arguments: [
        ["p_process_id", "text"],
        ["p_expected_phase", "text"],
        ["p_expected_status", "text"],
        ["p_next_state", "jsonb"],
        ["p_request_hash", "text"],
      ],
      reads_tables: ["trigger_processes"],
      writes_tables: ["trigger_processes"],
      effects: [
        {
          table_name: "trigger_processes",
          operation: "transition",
          concurrency_control: "expected_state_version",
        },
      ],
      returns: "jsonb",
    });
    const partialExpectedBody = `
      CREATE FUNCTION trigger_processor.test_transition_process_v1(
        p_process_id text,
        p_expected_phase text,
        p_expected_status text,
        p_next_state jsonb,
        p_request_hash text
      ) RETURNS jsonb LANGUAGE plpgsql AS $body$
      BEGIN
        UPDATE trigger_processor.trigger_processes p
           SET status = p_next_state->>'status'
         WHERE p.id = p_process_id
           AND p.phase = p_expected_phase;
        RETURN '{}'::jsonb;
      END $body$`;
    expect(() =>
      verifyOwnerWriterDefinitionV1(
        TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        transitionSignature,
        partialExpectedBody,
      ),
    ).toThrow(/CAS fence drift/);

    const mergeBody = partialExpectedBody.replace(
      "RETURN '{}'::jsonb;",
      `MERGE INTO trigger_processor.trigger_processes p
         USING memory.owner_secrets s
            ON p.id = s.process_id
       WHEN MATCHED THEN UPDATE SET status = p_next_state->>'status';
       RETURN '{}'::jsonb;`,
    );
    expect(() =>
      verifyOwnerWriterDefinitionV1(
        TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        transitionSignature,
        mergeBody,
      ),
    ).toThrow(/undeclared PostgreSQL read|CAS fence drift/);

    const indirectExpectedCopyBody = partialExpectedBody.replace(
      "BEGIN",
      "DECLARE v_copy text;\n      BEGIN",
    ).replace(
      "AND p.phase = p_expected_phase;",
      `AND p.phase = p_expected_phase
           AND p.status = p_expected_status;
        v_copy := coalesce(p_expected_phase, p_expected_phase);
        IF p_expected_phase = v_copy THEN
          RETURN '{}'::jsonb;
        END IF;`,
    );
    expect(() =>
      verifyOwnerWriterDefinitionV1(
        TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        transitionSignature,
        indirectExpectedCopyBody,
      ),
    ).toThrow(/CAS fence drift/);

    const constantFalseProofBody = partialExpectedBody.replace(
      `UPDATE trigger_processor.trigger_processes p
           SET status = p_next_state->>'status'
         WHERE p.id = p_process_id
           AND p.phase = p_expected_phase;`,
      `IF 2 = 3 THEN
          UPDATE trigger_processor.trigger_processes p
             SET status = p_next_state->>'status'
           WHERE p.id = p_process_id
             AND p.phase = p_expected_phase
             AND p.status = p_expected_status;
        END IF;`,
    );
    expect(() =>
      verifyOwnerWriterDefinitionV1(
        TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        transitionSignature,
        constantFalseProofBody,
      ),
    ).toThrow(/unreachable proof block/);

    const nullProofBody = constantFalseProofBody.replace(
      "IF 2 = 3 THEN",
      "IF NULL THEN",
    );
    expect(() =>
      verifyOwnerWriterDefinitionV1(
        TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        transitionSignature,
        nullProofBody,
      ),
    ).toThrow(/unreachable proof block/);

    const stringFalseProofBody = constantFalseProofBody.replace(
      "IF 2 = 3 THEN",
      "IF 'a' = 'b' THEN",
    );
    expect(() =>
      verifyOwnerWriterDefinitionV1(
        TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        transitionSignature,
        stringFalseProofBody,
      ),
    ).toThrow(/unreachable proof block/);

    const coalesceOnlyProofBody = partialExpectedBody.replace(
      "RETURN '{}'::jsonb;",
      `PERFORM p_expected_status = coalesce(p_expected_status, 'running');
       RETURN '{}'::jsonb;`,
    );
    expect(() =>
      verifyOwnerWriterDefinitionV1(
        TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        transitionSignature,
        coalesceOnlyProofBody,
      ),
    ).toThrow(/CAS fence drift/);

    const dollarQuotedProofBody = partialExpectedBody.replace(
      `UPDATE trigger_processor.trigger_processes p
           SET status = p_next_state->>'status'
         WHERE p.id = p_process_id
           AND p.phase = p_expected_phase;`,
      `PERFORM $proof$
          UPDATE trigger_processor.trigger_processes p
             SET status = p_next_state->>'status'
           WHERE p.id = p_process_id
             AND p.phase = p_expected_phase
             AND p.status = p_expected_status;
        $proof$;`,
    );
    expect(() =>
      verifyOwnerWriterDefinitionV1(
        TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        transitionSignature,
        dollarQuotedProofBody,
      ),
    ).toThrow(/effect drift|CAS fence drift/);
  });

  it("fails closed on permission coverage, direct writes, or writer signature drift", () => {
    expect(() =>
      defineOwnerRepositoryContractV1({
        ...TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        table_permissions:
          TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1.table_permissions.slice(1),
      } as never),
    ).toThrow(/table_permissions must cover/);

    expect(() =>
      defineOwnerRepositoryContractV1({
        ...TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        table_permissions: [
          {
            ...TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1.table_permissions[0],
            insert_columns: ["id"],
          },
          ...TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1.table_permissions.slice(1),
        ],
      } as never),
    ).toThrow(/writer-only V1 permissions/);

    expect(() =>
      defineOwnerRepositoryContractV1({
        ...TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        function_signatures: [
          {
            ...TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1.function_signatures[0],
            search_path: ["public", "pg_temp"],
          },
          ...TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1.function_signatures.slice(1),
        ],
      } as never),
    ).toThrow(/invalid generated writer signature/);

    const tableWithoutPrimaryWriter = "bot_permission_bindings";
    expect(() =>
      defineOwnerRepositoryContractV1({
        ...TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        function_signatures:
          TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1.function_signatures.map(
            (signature) => ({
              ...signature,
              writes_tables: signature.writes_tables.filter(
                (table) => table !== tableWithoutPrimaryWriter,
              ),
            }),
          ),
      } as never),
    ).toThrow(/semantic effect|tables without an atomic writer/);

    expect(() =>
      defineOwnerRepositoryContractV1({
        ...TIMER_REPOSITORY_CONTRACT_V1,
        function_signatures: [
          {
            ...TIMER_REPOSITORY_CONTRACT_V1.function_signatures[0],
            arguments: [
              ...TIMER_REPOSITORY_CONTRACT_V1.function_signatures[0].arguments,
              { argument_name: "p_schedule_id", postgres_type: "text", mode: "in" },
            ],
          },
          ...TIMER_REPOSITORY_CONTRACT_V1.function_signatures.slice(1),
        ],
      } as never),
    ).toThrow(/arguments must contain unique SQL identifiers/);

    expect(() =>
      defineOwnerRepositoryContractV1({
        ...TIMER_REPOSITORY_CONTRACT_V1,
        function_signatures: [
          {
            ...TIMER_REPOSITORY_CONTRACT_V1.function_signatures[0],
            effects: TIMER_REPOSITORY_CONTRACT_V1.function_signatures[0].effects.map(
              (effect) => ({
                ...effect,
                concurrency_control: "slot_and_process_state_fence" as const,
              }),
            ),
          },
          ...TIMER_REPOSITORY_CONTRACT_V1.function_signatures.slice(1),
        ],
      } as never),
    ).toThrow(/semantic effect/);
  });

});

describe("SDK import boundary", () => {
  it("allows Supabase JS only in the object-store adapter package", async () => {
    const repositoryRoot = resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../../..",
    );
    const packageFiles = [
      "packages/auth/package.json",
      "packages/contracts/package.json",
      "packages/persistence/package.json",
      "packages/service-kit/package.json",
      "services/action-runtime/package.json",
      "services/knowthat/package.json",
      "services/memory/package.json",
      "services/meta-cognition/package.json",
      "services/observation-gateway/package.json",
      "services/skill-registry/package.json",
      "services/timer-trigger-app/package.json",
      "services/trigger-processor/package.json",
    ];
    for (const path of packageFiles) {
      const manifest = await readFile(resolve(repositoryRoot, path), "utf8");
      expect(manifest, path).not.toContain("@supabase/supabase-js");
      expect(manifest, path).not.toContain("@supabase/storage-js");
    }
  });
});
