import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import { OWNER_DURABLE_EVENT_TYPES_V1 } from "@pai/contracts";

import { ACTION_RUNTIME_REPOSITORY_CONTRACT_V1 } from "../../../services/action-runtime/src/db/permission-manifest.v1.js";
import { KNOWTHAT_REPOSITORY_CONTRACT_V1 } from "../../../services/knowthat/src/db/permission-manifest.v1.js";
import { MEMORY_REPOSITORY_CONTRACT_V1 } from "../../../services/memory/src/db/permission-manifest.v1.js";
import { META_COGNITION_REPOSITORY_CONTRACT_V1 } from "../../../services/meta-cognition/src/db/permission-manifest.v1.js";
import { SKILL_REGISTRY_REPOSITORY_CONTRACT_V1 } from "../../../services/skill-registry/src/db/permission-manifest.v1.js";
import { TIMER_REPOSITORY_CONTRACT_V1 } from "../../../services/timer-trigger-app/src/db/permission-manifest.v1.js";
import { TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1 } from "../../../services/trigger-processor/src/db/permission-manifest.v1.js";
import {
  assertOwnerOutboxAcknowledgeConfirmationV1,
  assertOwnerOutboxClaimIdentityV1,
  defineOwnerRepositoryContractV1,
  OWNER_DATABASE_TARGETS_V1,
  OWNER_EVENTING_TRANSPORT_EPOCH_TABLE_V1,
  OWNER_EVENTING_TRANSPORT_EPOCH_WRITER_V1,
  OWNER_SAFE_BIGINT_MAX_V1,
  ownerDatabaseApplicationDependenciesV1,
  ownerEventingReconciliationContractV1,
  ownerFunctionSignatureV1,
  ownerImmutableTriggerV1,
  ownerWriterArtifactV1,
  verifyOwnerDatabaseCheckDefinitionV1,
  verifyOwnerRepositoryDeploymentFromPostgresV1,
  verifyOwnerWriterDefinitionV1,
  lintOwnerWriterDefinitionV1,
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
  "outbox_claim_ack",
]);

const timerReconciliation = ownerEventingReconciliationContractV1(
  "timer",
  "timer_event_outbox",
);

function timerContractWithReconciliation() {
  const columns = new Map<
    string,
    Readonly<{
      table_name: string;
      column_name: string;
      postgres_type: string;
      not_null: boolean;
      default_expression: string | null;
      identity: "";
      generated: "";
    }>
  >();
  for (const permission of TIMER_REPOSITORY_CONTRACT_V1.table_permissions) {
    for (const columnName of permission.select_columns) {
      const postgresType = columnName.endsWith("_at")
        ? "timestamp with time zone"
        : columnName === "attempt_count"
          ? "integer"
          : "text";
      columns.set(`${permission.table_name}.${columnName}`, {
        table_name: permission.table_name,
        column_name: columnName,
        postgres_type: postgresType,
        not_null:
          permission.table_name === "timer_event_inbox" &&
          [
            "source",
            "event_id",
            "idempotency_key",
            "payload_hash",
            "semantic_hash",
            "scope_fingerprint",
          ].includes(columnName),
        default_expression: null,
        identity: "",
        generated: "",
      });
    }
  }
  for (const column of TIMER_REPOSITORY_CONTRACT_V1.database_columns ?? []) {
    columns.set(`${column.table_name}.${column.column_name}`, column);
  }
  const requiredTypes: Readonly<Record<string, string>> = {
    id: "text",
    status: "text",
    attempt_count: "integer",
    transport_ref: "text",
    transport_epoch: "text",
    transport_generation: "bigint",
    sent_at: "timestamp with time zone",
    updated_at: "timestamp with time zone",
  };
  for (const columnName of timerReconciliation.required_existing_columns) {
    const key = `timer_event_outbox.${columnName}`;
    if (!columns.has(key)) {
      columns.set(key, {
        table_name: "timer_event_outbox",
        column_name: columnName,
        postgres_type: requiredTypes[columnName] ?? "text",
        not_null: false,
        default_expression: null,
        identity: "",
        generated: "",
      });
    }
  }
  for (const column of timerReconciliation.database_columns) {
    columns.set(`${column.table_name}.${column.column_name}`, column);
  }
  const alreadyIntegrated =
    TIMER_REPOSITORY_CONTRACT_V1.function_signatures.some((signature) =>
      signature.effects.some(
        ({ table_name, operation }) =>
          table_name === timerReconciliation.outbox_table &&
          operation === "reconcile_claim",
      ),
    );
  return {
    ...TIMER_REPOSITORY_CONTRACT_V1,
    writer_artifacts: undefined,
    mutable_writers: [
      ...TIMER_REPOSITORY_CONTRACT_V1.mutable_writers,
      ...(alreadyIntegrated ? [] : timerReconciliation.mutable_writers),
    ],
    function_signatures: [
      ...TIMER_REPOSITORY_CONTRACT_V1.function_signatures,
      ...(alreadyIntegrated ? [] : timerReconciliation.function_signatures),
    ],
    database_columns: [...columns.values()],
    database_checks: [
      ...(TIMER_REPOSITORY_CONTRACT_V1.database_checks ?? []),
      ...(alreadyIntegrated ? [] : timerReconciliation.database_checks),
    ],
    database_indexes: [
      ...(TIMER_REPOSITORY_CONTRACT_V1.database_indexes ?? []),
      ...(alreadyIntegrated ? [] : timerReconciliation.database_indexes),
    ],
  } as const;
}

describe("owner repository contracts", () => {
  it("accepts exact physical CHECK snapshots without weakening semantic checks", () => {
    expect(() =>
      defineOwnerRepositoryContractV1({
        ...TIMER_REPOSITORY_CONTRACT_V1,
        database_checks: [
          ...(TIMER_REPOSITORY_CONTRACT_V1.database_checks ?? []),
          {
            constraint_name: "timer_exact_snapshot_probe_check",
            table_name: "timer_schedules",
            required_definition_fragments: ["CHECK ((status IS NOT NULL))"],
          },
        ],
      } as never),
    ).not.toThrow();
  });

  it("accepts only the exact fenced outbox ACK confirmation", () => {
    expect(() =>
      assertOwnerOutboxAcknowledgeConfirmationV1({ acknowledged: true }),
    ).not.toThrow();
    for (const invalid of [
      { acknowledged: false },
      {},
      { acknowledged: true, outbox_id: "stale" },
      [true],
      null,
      "true",
    ]) {
      expect(() =>
        assertOwnerOutboxAcknowledgeConfirmationV1(invalid),
      ).toThrow(/did not confirm its fenced compare-and-set/u);
    }
  });

  it("rejects malformed outbox claim identities before lease commit", () => {
    expect(() =>
      assertOwnerOutboxClaimIdentityV1({
        outbox_id: "outbox-1",
        claim_token: "claim-1",
        envelope: {},
      }),
    ).not.toThrow();
    for (const invalid of [
      { outbox_id: "", claim_token: "claim-1" },
      { outbox_id: "outbox-1", claim_token: " " },
      { id: "outbox-1", claim_token: "claim-1" },
      ["outbox-1", "claim-1"],
      null,
    ]) {
      expect(() => assertOwnerOutboxClaimIdentityV1(invalid)).toThrow(
        /invalid fenced identity/u,
      );
    }
  });

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

  it("fails closed on every owner's durable inbox identity drift", () => {
    for (const contract of contracts) {
      const inboxTable = contract.inbox_tables[0];
      expect(inboxTable).toBeDefined();
      if (inboxTable === undefined) continue;

      expect(() =>
        defineOwnerRepositoryContractV1({
          ...contract,
          table_permissions: contract.table_permissions.map((permission) =>
            permission.table_name === inboxTable
              ? {
                  ...permission,
                  select_columns: permission.select_columns.filter(
                    (column) => column !== "event_id",
                  ),
                }
              : permission,
          ),
        }),
      ).toThrow(/durable inbox identity columns drift/u);

      expect(() =>
        defineOwnerRepositoryContractV1({
          ...contract,
          function_signatures: contract.function_signatures.map((signature) =>
            signature.writes_tables.includes(inboxTable)
              ? {
                  ...signature,
                  effects: signature.effects.map((effect) =>
                    effect.table_name === inboxTable
                      ? {
                          ...effect,
                          concurrency_control: "idempotency_key" as const,
                        }
                      : effect,
                  ),
                }
              : signature,
          ),
        }),
      ).toThrow(/durable inbox identity ABI drift/u);

      expect(() =>
        defineOwnerRepositoryContractV1({
          ...contract,
          function_signatures: contract.function_signatures.map((signature) =>
            signature.writes_tables.includes(inboxTable)
              ? {
                  ...signature,
                  arguments: signature.arguments.filter(
                    ({ argument_name }) =>
                      argument_name !== "p_semantic_hash",
                  ),
                }
              : signature,
          ),
        }),
      ).toThrow(/semantic effect|durable inbox identity ABI drift/u);
    }
  });

  it("requires exact delivery and idempotency inbox identities", () => {
    const base = timerContractWithReconciliation();
    expect(() =>
      defineOwnerRepositoryContractV1({
        ...base,
      } as never),
    ).not.toThrow();
    expect(() =>
      defineOwnerRepositoryContractV1({
        ...base,
        database_unique_constraints:
          base.database_unique_constraints?.filter(
            ({ constraint_name }) =>
              constraint_name !==
              "timer_event_inbox_source_idempotency_key_key",
          ),
      } as never),
    ).toThrow(/exact non-deferrable UNIQUE/u);
    expect(() =>
      defineOwnerRepositoryContractV1({
        ...base,
        database_indexes: base.database_indexes?.filter(
          ({ index_name }) =>
            index_name !== "timer_event_inbox_source_idempotency_key_key",
        ),
      } as never),
    ).toThrow(/exact unique delivery and idempotency indexes/u);
  });

  it("requires durable inbox conflicts to close before business mutations", () => {
    const signature = ownerFunctionSignatureV1({
      schema: "timer",
      function_name: "consume_timer_event_v1",
      primary_table: "timer_event_inbox",
      writer_kind: "state_transition",
      arguments: [
        ["p_event", "jsonb"],
        ["p_idempotency_key", "text"],
        ["p_payload_hash", "text"],
        ["p_semantic_hash", "text"],
        ["p_scope_fingerprint", "text"],
      ],
      reads_tables: ["timer_event_inbox"],
      writes_tables: [
        "timer_event_inbox",
        "timer_event_dlq",
        "timer_audit_logs",
      ],
      effects: [
        {
          table_name: "timer_event_inbox",
          operation: "append",
          concurrency_control: "durable_event_identity",
        },
        {
          table_name: "timer_event_dlq",
          operation: "append",
          concurrency_control: "idempotency_key",
        },
        {
          table_name: "timer_audit_logs",
          operation: "append",
          concurrency_control: "idempotency_key",
        },
      ],
      returns: "jsonb",
    });
    const auditInsert = `
        INSERT INTO timer.timer_audit_logs(id, event_type, payload)
          VALUES (p_idempotency_key, 'timer.event.applied', p_event);`;
    const definition = () => `
      CREATE FUNCTION timer.consume_timer_event_v1(
        p_event jsonb,
        p_idempotency_key text,
        p_payload_hash text,
        p_semantic_hash text,
        p_scope_fingerprint text
      ) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
      SET search_path = timer, pg_temp AS $body$
      DECLARE
        existing timer.timer_event_inbox%ROWTYPE;
        inserted_id text;
        isolation_id text;
      BEGIN
        IF p_idempotency_key IS NULL THEN
          RAISE EXCEPTION 'missing idempotency key';
        END IF;
        INSERT INTO timer.timer_event_inbox(
          source,
          event_id,
          idempotency_key,
          payload_hash,
          semantic_hash,
          scope_fingerprint
        ) VALUES (
          p_event->>'producer',
          p_event->>'event_id',
          p_idempotency_key,
          p_payload_hash,
          p_semantic_hash,
          p_scope_fingerprint
        )
        ON CONFLICT (source, event_id) DO NOTHING
        RETURNING event_id INTO inserted_id;

        IF inserted_id IS NOT NULL THEN
          ${auditInsert}
          RETURN jsonb_build_object('status', 'processed');
        END IF;

        SELECT * INTO existing
          FROM timer.timer_event_inbox
         WHERE source = p_event->>'producer'
           AND event_id = p_event->>'event_id'
         FOR UPDATE;

        IF existing.event_id IS DISTINCT FROM p_event->>'event_id'
           OR existing.idempotency_key IS DISTINCT FROM p_idempotency_key
           OR existing.payload_hash IS DISTINCT FROM p_payload_hash
           OR existing.semantic_hash IS DISTINCT FROM p_semantic_hash
           OR existing.scope_fingerprint IS DISTINCT FROM p_scope_fingerprint THEN
          isolation_id := 'inbox-conflict:' || (p_event->>'producer') || ':' ||
            (p_event->>'event_id') || ':' || md5(jsonb_build_array(
              p_idempotency_key,
              p_payload_hash,
              p_semantic_hash,
              p_scope_fingerprint
            )::text);
          INSERT INTO timer.timer_event_dlq(id, payload)
            VALUES (isolation_id, p_event)
            ON CONFLICT (id) DO NOTHING;
          RETURN jsonb_build_object(
            'status', 'isolated',
            'isolation_code', 'durable_inbox_identity_conflict',
            'isolation_ref', 'timer.timer_event_dlq/' || isolation_id
          );
        END IF;
        RETURN jsonb_build_object('status', 'replayed');
      END
      $body$`;

    expect(() =>
      lintOwnerWriterDefinitionV1(
        TIMER_REPOSITORY_CONTRACT_V1,
        signature,
        definition(),
      ),
    ).not.toThrow();
    for (const invalid of [
      definition().replace(
        "INSERT INTO timer.timer_event_inbox(",
        `${auditInsert}\n        INSERT INTO timer.timer_event_inbox(`,
      ),
      definition().replace(
        "OR existing.payload_hash IS DISTINCT FROM p_payload_hash",
        "AND existing.payload_hash IS DISTINCT FROM p_payload_hash",
      ),
      definition().replace(
        `p_event->>'producer',
          p_event->>'event_id',
          p_idempotency_key,`,
        `p_event->>'event_id',
          p_event->>'producer',
          p_idempotency_key,`,
      ),
      definition().replace(
        `IF inserted_id IS NOT NULL THEN
          ${auditInsert}
          RETURN jsonb_build_object('status', 'processed');
        END IF;`,
        `${auditInsert}
        RETURN jsonb_build_object('status', 'processed');`,
      ),
      definition().replace(
        `${auditInsert}
          RETURN jsonb_build_object('status', 'processed');`,
        `RETURN jsonb_build_object('status', 'processed');
          ${auditInsert}`,
      ),
      definition().replace(
        "RETURN jsonb_build_object('status', 'replayed');",
        `${auditInsert}\n        RETURN jsonb_build_object('status', 'replayed');`,
      ),
      definition().replace(
        "'isolation_ref', 'timer.timer_event_dlq/' || isolation_id",
        "'isolation_ref', 'timer.timer_event_dlq/caller-reported'",
      ),
      definition().replace("ON CONFLICT (id) DO NOTHING;", ""),
      definition().replace(
        "(p_event->>'event_id') || ':' || md5",
        "'shared-event-id' || ':' || md5",
      ),
      definition().replace(
        "p_scope_fingerprint\n            )::text",
        "'shared-scope'\n            )::text",
      ),
    ]) {
      expect(() =>
        lintOwnerWriterDefinitionV1(
          TIMER_REPOSITORY_CONTRACT_V1,
          signature,
          invalid,
        ),
      ).toThrow(/durable event identity drift/u);
    }
  });

  it("derives Meta finalization provenance from locked transition history", () => {
    const signature = ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "finalize_trigger_meta_projection_v1",
      primary_table: "trigger_processes",
      writer_kind: "state_transition",
      arguments: [
        ["p_process_id", "text"],
        ["p_expected_process_phase", "text"],
        ["p_expected_process_status", "text"],
        ["p_expected_process_updated_at", "timestamptz"],
        ["p_expected_meta_enqueue_reason", "text"],
        ["p_meta_finalization_evidence", "jsonb"],
      ],
      reads_tables: ["trigger_processes", "trigger_process_transitions"],
      writes_tables: [],
      effects: [],
      returns: "jsonb",
    });
    const body = `
      DECLARE
        v_execution_provenance text;
        v_execution_transition_ref text;
        v_deferred_transition_ref text;
        v_execution_transition_created_at timestamptz;
        v_persisted_process_phase text;
        v_persisted_process_status text;
        v_persisted_process_updated_at timestamptz;
        v_persisted_meta_enqueue_reason text;
      BEGIN
        SELECT process.phase,
               process.status,
               process.updated_at,
               process.meta_enqueue_reason
          INTO v_persisted_process_phase,
               v_persisted_process_status,
               v_persisted_process_updated_at,
               v_persisted_meta_enqueue_reason
          FROM trigger_processor.trigger_processes process
         WHERE process.id = p_process_id
         FOR UPDATE;
        IF v_persisted_process_phase IS DISTINCT FROM p_expected_process_phase
           OR v_persisted_process_status IS DISTINCT FROM p_expected_process_status
           OR v_persisted_process_updated_at IS DISTINCT FROM p_expected_process_updated_at
           OR v_persisted_meta_enqueue_reason IS DISTINCT FROM p_expected_meta_enqueue_reason THEN
          RAISE EXCEPTION 'stale persisted Meta process state';
        END IF;
        PERFORM 1
          FROM trigger_processor.trigger_process_transitions transition
         WHERE transition.trigger_process_id = p_process_id
         FOR SHARE;
        SELECT transition.id::text,
               transition.created_at,
               CASE
                 WHEN transition.from_phase = 'deferred'
                   THEN 'deferred_execution'
                 ELSE 'direct_execution'
               END
          INTO v_execution_transition_ref,
               v_execution_transition_created_at,
               v_execution_provenance
          FROM trigger_processor.trigger_process_transitions transition
         WHERE transition.trigger_process_id = p_process_id
           AND transition.to_phase = 'execution'
         ORDER BY transition.created_at DESC, transition.id DESC
         LIMIT 1;
        IF v_execution_transition_ref IS NULL THEN
          v_execution_provenance := 'not_applicable';
          v_deferred_transition_ref := NULL;
        ELSIF v_execution_provenance = 'deferred_execution' THEN
          SELECT transition.id::text
            INTO v_deferred_transition_ref
            FROM trigger_processor.trigger_process_transitions transition
           WHERE transition.trigger_process_id = p_process_id
             AND transition.to_phase = 'deferred'
             AND transition.created_at < v_execution_transition_created_at
           ORDER BY transition.created_at DESC, transition.id DESC
           LIMIT 1;
          IF v_deferred_transition_ref IS NULL THEN
            RAISE EXCEPTION 'deferred execution transition is incomplete';
          END IF;
        ELSE
          v_deferred_transition_ref := NULL;
        END IF;
        IF NOT (
          (v_persisted_meta_enqueue_reason = 'user_retracted'
           AND p_meta_finalization_evidence->>'terminal_outcome' = 'cancelled_with_reason')
          OR (v_persisted_meta_enqueue_reason = 'system_interrupted'
           AND p_meta_finalization_evidence->>'terminal_outcome' = 'interrupted_with_reason')
          OR (v_persisted_meta_enqueue_reason = 'failed_with_learnable_snapshot'
           AND p_meta_finalization_evidence->>'terminal_outcome' = 'failed_with_reason')
          OR (v_persisted_meta_enqueue_reason = 'cooldown_expired'
           AND p_meta_finalization_evidence->>'terminal_outcome' = 'executed'
           AND p_meta_finalization_evidence->>'execution_provenance' = 'direct_execution')
          OR (v_persisted_meta_enqueue_reason = 'cooldown_expired'
           AND p_meta_finalization_evidence->>'terminal_outcome' = 'deferred_then_executed'
           AND p_meta_finalization_evidence->>'execution_provenance' = 'deferred_execution')
          OR (v_persisted_meta_enqueue_reason = 'cooldown_expired'
           AND p_meta_finalization_evidence->>'terminal_outcome' = 'failed_with_reason'
           AND p_meta_finalization_evidence->>'execution_provenance' = 'direct_execution')
          OR (v_persisted_meta_enqueue_reason = 'cooldown_expired'
           AND p_meta_finalization_evidence->>'terminal_outcome' = 'failed_with_reason'
           AND p_meta_finalization_evidence->>'execution_provenance' = 'deferred_execution')
        ) THEN
          RAISE EXCEPTION 'Meta finalization reason/outcome mismatch';
        END IF;
        IF p_meta_finalization_evidence->>'execution_provenance'
             IS DISTINCT FROM v_execution_provenance
           OR p_meta_finalization_evidence->>'execution_transition_ref'
             IS DISTINCT FROM v_execution_transition_ref
           OR p_meta_finalization_evidence->>'deferred_transition_ref'
             IS DISTINCT FROM v_deferred_transition_ref THEN
          RAISE EXCEPTION 'Meta finalization provenance mismatch';
        END IF;
        RETURN jsonb_build_object('status', 'processed');
      END;`;
    const definition = (source: string) => `
      CREATE FUNCTION trigger_processor.finalize_trigger_meta_projection_v1(
        p_process_id text,
        p_expected_process_phase text,
        p_expected_process_status text,
        p_expected_process_updated_at timestamptz,
        p_expected_meta_enqueue_reason text,
        p_meta_finalization_evidence jsonb
      ) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
      SET search_path = trigger_processor, pg_temp AS $body$
      ${source}
      $body$`;
    expect(() =>
      lintOwnerWriterDefinitionV1(
        TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        signature,
        definition(body),
      ),
    ).not.toThrow();
    for (const invalid of [
      body.replace("         FOR UPDATE;", ";"),
      body.replace("         FOR SHARE;", ";"),
      body.replaceAll(
        "transition.from_phase",
        "p_meta_finalization_evidence",
      ),
      body.replace(
        "transition.created_at < v_execution_transition_created_at",
        "transition.created_at < clock_timestamp()",
      ),
      body.replaceAll(
        "v_persisted_meta_enqueue_reason =",
        "p_expected_meta_enqueue_reason =",
      ),
      body.replace(
        "p_meta_finalization_evidence->>'terminal_outcome' = 'interrupted_with_reason'",
        "p_meta_finalization_evidence->>'terminal_outcome' = 'cancelled_with_reason'",
      ),
      body.replace(
        "AND p_meta_finalization_evidence->>'terminal_outcome' = 'cancelled_with_reason')",
        `AND p_meta_finalization_evidence->>'terminal_outcome' = 'cancelled_with_reason'
           AND p_meta_finalization_evidence->>'execution_provenance' = 'not_applicable')`,
      ),
      body.replace(
        "IS DISTINCT FROM v_execution_provenance",
        "IS DISTINCT FROM p_meta_finalization_evidence->>'execution_provenance'",
      ),
    ]) {
      expect(() =>
        lintOwnerWriterDefinitionV1(
          TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
          signature,
          definition(invalid),
        ),
      ).toThrow(/Meta finalization provenance drift/u);
    }
  });

  it.each([
    "SET LOCAL synchronous_commit = off;",
    "SET SESSION session_replication_role = replica;",
    "PERFORM pg_catalog.set_config('synchronous_commit', 'off', true);",
    "PERFORM pg_catalog.set_config('synchronous_' || 'commit', 'off', true);",
    "PERFORM pg_catalog.set_config(variable_name, variable_value, true);",
  ])("forbids protected runtime GUC changes in owner writers", (statement) => {
    const signature = ownerFunctionSignatureV1({
      schema: "timer",
      function_name: "protected_guc_probe_v1",
      primary_table: "contract_parents",
      writer_kind: "state_transition",
      arguments: [],
      reads_tables: [],
      writes_tables: [],
      effects: [],
      returns: "jsonb",
    });
    expect(() =>
      lintOwnerWriterDefinitionV1(
        TIMER_REPOSITORY_CONTRACT_V1,
        signature,
        `CREATE FUNCTION timer.protected_guc_probe_v1() RETURNS jsonb
         LANGUAGE plpgsql SECURITY DEFINER SET search_path = timer, pg_temp
         AS $body$ BEGIN ${statement} RETURN '{}'::jsonb; END; $body$`,
      ),
    ).toThrow(/protected runtime GUC changes are forbidden/u);
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
        expect(signature.effects.length).toBeGreaterThanOrEqual(
          signature.writes_tables.length,
        );
        expect(
          [...new Set(signature.effects.map(({ table_name }) => table_name))].sort(),
        ).toEqual(
          [...signature.writes_tables].sort(),
        );
        expect(
          new Set(
            signature.effects.map(
              ({
                table_name,
                operation,
                concurrency_control,
                advisory_lock,
              }) =>
                `${table_name}:${operation}:${concurrency_control}:${
                  advisory_lock === undefined
                    ? ""
                    : JSON.stringify(advisory_lock)
                }`,
            ),
          ).size,
        ).toBe(signature.effects.length);
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

  it("binds every outbox to one standard lease-fenced claim and ack pair", () => {
    const expectedArguments = {
      claim: [
        ["p_worker_id", "text"],
        ["p_limit", "integer"],
        ["p_lease_seconds", "integer"],
        ["p_now", "timestamptz"],
        ["p_current_transport_epoch", "text"],
        ["p_current_transport_generation", "bigint"],
      ],
      ack: [
        ["p_outbox_id", "text"],
        ["p_claim_token", "text"],
        ["p_outcome", "text"],
        ["p_next_retry_at", "timestamptz"],
        ["p_error", "jsonb"],
        ["p_transport_ref", "text"],
        ["p_transport_epoch", "text"],
        ["p_transport_generation", "bigint"],
        ["p_current_transport_epoch", "text"],
        ["p_current_transport_generation", "bigint"],
        ["p_now", "timestamptz"],
      ],
    } as const;
    for (const contract of contracts) {
      const authorityPermission = contract.table_permissions.find(
        ({ table_name }) =>
          table_name === OWNER_EVENTING_TRANSPORT_EPOCH_TABLE_V1,
      );
      expect(authorityPermission).toMatchObject({
        table_name: OWNER_EVENTING_TRANSPORT_EPOCH_TABLE_V1,
        writer_kind: "pointer_cas",
      });
      expect(authorityPermission?.select_columns).toEqual([
        "transport_name",
        "active_epoch",
        "active_generation",
        "activated_at",
      ]);
      expect(
        contract.mutable_writers,
      ).toContain(OWNER_EVENTING_TRANSPORT_EPOCH_WRITER_V1);
      expect(
        contract.function_signatures.filter(
          ({ function_name, primary_table }) =>
            function_name === OWNER_EVENTING_TRANSPORT_EPOCH_WRITER_V1 &&
            primary_table === OWNER_EVENTING_TRANSPORT_EPOCH_TABLE_V1,
        ),
      ).toHaveLength(1);
      expect(contract.database_checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            table_name: OWNER_EVENTING_TRANSPORT_EPOCH_TABLE_V1,
            semantic_constraint: {
              kind: "integer_range",
              column_name: "active_generation",
              min: 1,
              max: OWNER_SAFE_BIGINT_MAX_V1,
            },
          }),
        ]),
      );
      for (const table of contract.outbox_tables) {
        for (const operation of ["claim", "ack"] as const) {
          const signatures = contract.function_signatures.filter(
            (signature) =>
              signature.primary_table === table &&
              signature.effects.some(
                (effect) =>
                  effect.table_name === table && effect.operation === operation,
              ),
          );
          expect(signatures).toHaveLength(1);
          expect(
            signatures[0]?.arguments.map(
              ({ argument_name, postgres_type }) => [
                argument_name,
                postgres_type,
              ],
            ),
          ).toEqual(expectedArguments[operation]);
          expect(signatures[0]?.returns).toBe(
            operation === "claim" ? "setof jsonb" : "jsonb",
          );
          expect(
            signatures[0]?.arguments
              .filter(({ nullable }) => nullable === true)
              .map(({ argument_name }) => argument_name),
          ).toEqual(
            operation === "ack"
              ? [
                  "p_next_retry_at",
                  "p_error",
                  "p_transport_ref",
                  "p_transport_epoch",
                  "p_transport_generation",
                ]
              : [],
          );
          expect(signatures[0]?.reads_tables).toContain(
            OWNER_EVENTING_TRANSPORT_EPOCH_TABLE_V1,
          );
        }
      }
    }
  });

  it("rejects a hand-built outbox ACK signature that omits canonical nullability", () => {
    const { writer_artifacts: _writerArtifacts, ...contractWithoutArtifacts } =
      TIMER_REPOSITORY_CONTRACT_V1;
    const ackSignature =
      TIMER_REPOSITORY_CONTRACT_V1.function_signatures.find(
        (signature) =>
          signature.effects.some(({ operation }) => operation === "ack"),
      );
    expect(ackSignature).toBeDefined();
    expect(() =>
      defineOwnerRepositoryContractV1({
        ...contractWithoutArtifacts,
        function_signatures:
          TIMER_REPOSITORY_CONTRACT_V1.function_signatures.map((signature) =>
            signature === ackSignature
              ? {
                  ...signature,
                  arguments: signature.arguments.map((argument) =>
                    argument.argument_name === "p_error"
                      ? {
                          argument_name: argument.argument_name,
                          postgres_type: argument.postgres_type,
                          mode: argument.mode,
                        }
                      : argument,
                  ),
                }
              : signature,
          ),
      } as never),
    ).toThrow(/standard ack writer/u);
    void _writerArtifacts;
  });

  it("builds one fail-closed reconciliation fragment without exposing leases", () => {
    expect(timerReconciliation.required_existing_columns).toEqual([
      "id",
      "status",
      "attempt_count",
      "transport_ref",
      "transport_epoch",
      "transport_generation",
      "sent_at",
      "updated_at",
    ]);
    expect(
      timerReconciliation.database_columns.map(({ column_name }) => column_name),
    ).toEqual([
      "reconciliation_missing_at",
      "reconciliation_missing_reporter",
      "reconciliation_next_probe_at",
      "reconciliation_claimed_by",
      "reconciliation_claim_token",
      "reconciliation_claim_generation",
      "reconciliation_locked_until",
    ]);
    expect(timerReconciliation.database_indexes).toHaveLength(3);
    expect(timerReconciliation.database_indexes[0]?.definition).toContain(
      "WHERE ((status = 'sent'::text) AND (transport_ref IS NOT NULL))",
    );
    expect(timerReconciliation.database_indexes[1]?.definition).toContain(
      "reconciliation_next_probe_at NULLS FIRST",
    );
    expect(timerReconciliation.next_probe_semantics).toEqual({
      clock_authority: "postgres_clock_timestamp",
      claim_lease: "database_now_plus_bounded_lease_seconds",
      acknowledgment_schedule:
        "database_now_plus_bounded_probe_interval_ms",
      null_next_probe: "due_immediately",
      previous_generation: "due_immediately_regardless_of_next_probe",
      reported_missing: "due_immediately_regardless_of_next_probe",
      current_generation: "due_when_next_probe_at_lte_now",
      deleted_ref_update:
        "least_existing_or_observed_at_with_null_as_observed_at",
    });
    expect(timerReconciliation.mutable_writers).toEqual([
      "record_timer_event_outbox_deleted_transport_refs_v1",
      "claim_timer_event_outbox_reconciliation_v1",
      "ack_timer_event_outbox_transport_present_v1",
      "ack_timer_event_outbox_rematerialized_v1",
      "ack_timer_event_outbox_permanent_failure_v1",
    ]);
    expect(
      timerReconciliation.function_signatures.map(
        ({ effects, returns }) => [
          effects[0]?.operation,
          effects[0]?.concurrency_control,
          returns,
        ],
      ),
    ).toEqual([
      ["reconcile_mark_missing", "reconciliation_fence", "jsonb"],
      ["reconcile_claim", "reconciliation_fence", "setof jsonb"],
      ["reconcile_ack_present", "reconciliation_fence", "jsonb"],
      ["reconcile_ack_rematerialized", "reconciliation_fence", "jsonb"],
      ["reconcile_ack_permanent_failure", "reconciliation_fence", "jsonb"],
    ]);
    const argumentsFor = (operation: string) =>
      timerReconciliation.function_signatures
        .find(({ effects }) => effects[0]?.operation === operation)
        ?.arguments.map(({ argument_name }) => argument_name);
    expect(argumentsFor("reconcile_claim")).toEqual([
      "p_worker_id",
      "p_limit",
      "p_lease_seconds",
      "p_current_transport_epoch",
      "p_current_transport_generation",
    ]);
    expect(argumentsFor("reconcile_ack_present")?.slice(-1)).toEqual([
      "p_probe_interval_ms",
    ]);
    expect(argumentsFor("reconcile_ack_rematerialized")?.slice(-1)).toEqual([
      "p_probe_interval_ms",
    ]);
    expect(argumentsFor("reconcile_ack_permanent_failure")?.slice(-3)).toEqual([
      "p_failure_code",
      "p_failure_message",
      "p_now",
    ]);
    expect(
      timerReconciliation.function_signatures.flatMap(({ arguments: values }) =>
        values.map(({ argument_name }) => argument_name),
      ),
    ).not.toContain("p_next_probe_at");
    for (const value of Object.values(timerReconciliation)) {
      if (Array.isArray(value)) expect(Object.isFrozen(value)).toBe(true);
    }
    expect(
      TIMER_REPOSITORY_CONTRACT_V1.table_permissions
        .find(({ table_name }) => table_name === "timer_event_outbox")
        ?.select_columns.includes("reconciliation_claim_token"),
    ).toBe(false);

    const longest = ownerEventingReconciliationContractV1(
      "knowthat",
      "knowthat_memory_command_outbox",
    );
    expect(
      Math.max(...longest.mutable_writers.map(({ length }) => length)),
    ).toBe(63);
    expect(
      Math.max(...longest.database_indexes.map(({ index_name }) => index_name.length)),
    ).toBe(63);
  });

  it("builds the same reconciliation ABI for all eleven owner outboxes", () => {
    const outboxes = contracts.flatMap((contract) =>
      contract.outbox_tables.map((table) => ({
        schema: contract.schema,
        table,
      })),
    );
    expect(outboxes).toHaveLength(11);
    for (const { schema, table } of outboxes) {
      const fragment = ownerEventingReconciliationContractV1(schema, table);
      expect(fragment.function_signatures).toHaveLength(5);
      expect(fragment.database_columns).toHaveLength(7);
      expect(fragment.database_indexes).toHaveLength(3);
      expect(
        fragment.mutable_writers.every((writer) => writer.length <= 63),
      ).toBe(true);
      expect(
        fragment.database_indexes.every(({ index_name }) =>
          index_name.length <= 63,
        ),
      ).toBe(true);
    }
  });

  it("composes reconciliation only with the full physical and compound-fence contract", () => {
    expect(() =>
      defineOwnerRepositoryContractV1(
        timerContractWithReconciliation() as never,
      ),
    ).not.toThrow();

    const exposedLease = timerContractWithReconciliation();
    expect(() =>
      defineOwnerRepositoryContractV1({
        ...exposedLease,
        table_permissions: exposedLease.table_permissions.map((permission) =>
          permission.table_name === "timer_event_outbox"
            ? {
                ...permission,
                select_columns: [
                  ...permission.select_columns,
                  "reconciliation_claim_token",
                ],
              }
            : permission,
        ),
      } as never),
    ).toThrow(/internal columns cannot be direct SELECT grants/u);

    const missingFence = timerContractWithReconciliation();
    expect(() =>
      defineOwnerRepositoryContractV1({
        ...missingFence,
        function_signatures: missingFence.function_signatures.map((signature) =>
          signature.effects[0]?.operation === "reconcile_ack_present"
            ? {
                ...signature,
                arguments: signature.arguments.filter(
                  ({ argument_name }) =>
                    argument_name !== "p_previous_transport_ref",
                ),
              }
            : signature,
        ),
      } as never),
    ).toThrow(/semantic effect|reconciliation writer ABI drift/u);

    const downgradedFence = timerContractWithReconciliation();
    expect(() =>
      defineOwnerRepositoryContractV1({
        ...downgradedFence,
        function_signatures: downgradedFence.function_signatures.map(
          (signature) =>
            signature.effects[0]?.operation === "reconcile_ack_present"
              ? {
                  ...signature,
                  effects: signature.effects.map((effect) => ({
                    ...effect,
                    concurrency_control: "lease_fence" as const,
                  })),
                }
              : signature,
        ),
      } as never),
    ).toThrow(/reconciliation writer ABI drift/u);

    const missingIndex = timerContractWithReconciliation();
    expect(() =>
      defineOwnerRepositoryContractV1({
        ...missingIndex,
        database_indexes: missingIndex.database_indexes.filter(
          ({ index_name }) =>
            index_name !==
            timerReconciliation.database_indexes[0]?.index_name,
        ),
      } as never),
    ).toThrow(/reconciliation index drift/u);
  });

  it("lints every previous identity and active generation in reconciliation ACK", () => {
    const contract = defineOwnerRepositoryContractV1(
      timerContractWithReconciliation() as never,
    );
    const signature = contract.function_signatures.find(
      ({ effects }) =>
        effects[0]?.operation === "reconcile_ack_present",
    );
    expect(signature).toBeDefined();
    if (signature === undefined) throw new Error("missing reconciliation ACK");
    const body = `
DECLARE
  v_active_epoch text;
  v_active_generation bigint;
  v_updated_id text;
  v_database_now timestamptz;
BEGIN
  IF p_probe_interval_ms < 1000 OR p_probe_interval_ms > 86400000 THEN
    RAISE EXCEPTION 'invalid reconciliation probe interval';
  END IF;
  SELECT active_epoch, active_generation
    INTO v_active_epoch, v_active_generation
    FROM timer.eventing_transport_epochs
   WHERE transport_name = 'redis_stream'
   FOR UPDATE;
  IF v_active_epoch <> p_current_transport_epoch
     OR v_active_generation <> p_current_transport_generation THEN
    RAISE EXCEPTION 'stale active transport generation';
  END IF;
  v_database_now := clock_timestamp();
  UPDATE timer.timer_event_outbox
     SET reconciliation_next_probe_at = v_database_now +
           make_interval(secs => p_probe_interval_ms::double precision / 1000.0),
         reconciliation_missing_at = NULL,
         reconciliation_missing_reporter = NULL,
         reconciliation_claimed_by = NULL,
         reconciliation_claim_token = NULL,
         reconciliation_locked_until = NULL,
         updated_at = v_database_now
   WHERE id = p_outbox_id
     AND status = 'sent'
     AND reconciliation_claim_token = p_claim_token
     AND transport_ref IS NOT DISTINCT FROM p_previous_transport_ref
     AND transport_epoch IS NOT DISTINCT FROM p_previous_transport_epoch
     AND transport_generation IS NOT DISTINCT FROM p_previous_transport_generation
   RETURNING id INTO v_updated_id;
  IF v_updated_id IS NULL THEN
    RAISE EXCEPTION 'stale reconciliation claim';
  END IF;
  RETURN jsonb_build_object('acknowledged', true);
END;`;
    const definition = (functionBody: string) => `
CREATE FUNCTION timer.${signature.function_name}() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = timer, pg_temp
AS $writer$
${functionBody}
$writer$`;
    expect(() =>
      lintOwnerWriterDefinitionV1(contract, signature, definition(body)),
    ).not.toThrow();
    expect(() =>
      lintOwnerWriterDefinitionV1(
        contract,
        signature,
        definition(
          body.replace(
            "     AND transport_ref IS NOT DISTINCT FROM p_previous_transport_ref\n",
            "",
          ),
        ),
      ),
    ).toThrow(/reconciliation (?:fence|ACK result) drift/u);
    expect(() =>
      lintOwnerWriterDefinitionV1(
        contract,
        signature,
        definition(body.replace("   FOR UPDATE;", ";")),
      ),
    ).toThrow(/reconciliation fence drift/u);
    expect(() =>
      lintOwnerWriterDefinitionV1(
        contract,
        signature,
        definition(
          body.replace(
            "RETURN jsonb_build_object('acknowledged', true);",
            "RETURN jsonb_build_object('outbox_id', v_updated_id);",
          ),
        ),
      ),
    ).toThrow(/reconciliation ACK result drift/u);
    expect(() =>
      lintOwnerWriterDefinitionV1(
        contract,
        signature,
        definition(
          body.replace(
            "v_database_now := clock_timestamp();",
            "v_database_now := p_now;",
          ),
        ),
      ),
    ).toThrow(/reconciliation fence drift/u);
  });

  it("binds every canonical event outbox to the owner event union and producer", () => {
    for (const contract of contracts) {
      const checks = contract.database_checks ?? [];
      const expectedOwnerEventTypes = [
        ...OWNER_DURABLE_EVENT_TYPES_V1[contract.owner_service],
      ].sort();
      const ownerEventTypeChecks = checks.filter(
        ({ semantic_constraint }) =>
          semantic_constraint?.kind === "text_enum" &&
          semantic_constraint.column_name === "event_type" &&
          semantic_constraint.allowed_values.length ===
            expectedOwnerEventTypes.length &&
          JSON.stringify([...semantic_constraint.allowed_values].sort()) ===
            JSON.stringify(expectedOwnerEventTypes),
      );
      expect(
        ownerEventTypeChecks,
        `${contract.owner_service} must expose exactly one canonical owner-event enum`,
      ).toHaveLength(1);
      expect(ownerEventTypeChecks[0]?.semantic_constraint).toMatchObject({
        kind: "text_enum",
      });
      if (ownerEventTypeChecks[0]?.semantic_constraint?.kind === "text_enum") {
        expect([...ownerEventTypeChecks[0].semantic_constraint.allowed_values].sort()).toEqual(
          expectedOwnerEventTypes,
        );
      }
      for (const table of contract.outbox_tables) {
        const columns = contract.table_permissions.find(
          ({ table_name }) => table_name === table,
        )?.select_columns ?? [];
        if (!columns.includes("event_type")) continue;
        expect(
          checks.filter(
            ({ table_name, semantic_constraint }) =>
              table_name === table &&
              semantic_constraint?.kind === "text_enum" &&
              semantic_constraint.column_name === "event_type",
          ),
        ).toHaveLength(1);
        if (columns.includes("producer")) {
          expect(
            checks.filter(
              ({ table_name, semantic_constraint }) =>
                table_name === table &&
                semantic_constraint?.kind === "text_equals" &&
                semantic_constraint.column_name === "producer" &&
                semantic_constraint.value === contract.owner_service,
            ),
          ).toHaveLength(1);
        } else if (columns.includes("payload")) {
          expect(
            checks.filter(
              ({ table_name, semantic_constraint }) =>
                table_name === table &&
                ((semantic_constraint?.kind === "json_text_equals" &&
                  semantic_constraint.column_name === "payload" &&
                  semantic_constraint.field_name === "producer" &&
                  semantic_constraint.value === contract.owner_service) ||
                  (semantic_constraint?.kind === "json_event_envelope" &&
                    semantic_constraint.column_name === "payload" &&
                    semantic_constraint.producer_value ===
                      contract.owner_service)),
            ),
          ).toHaveLength(1);
        }
      }
    }
  });

  it("binds Trigger Processor outbox schema_version to the single domain-event union version", () => {
    expect(TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1.database_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table_name: "trigger_event_outbox",
          constraint_name: "trigger_event_outbox_schema_version_check",
          semantic_constraint: {
            kind: "text_equals",
            column_name: "schema_version",
            value: "trigger_processor_event.v1",
          },
        }),
      ]),
    );
  });

  it("verifies every JSON payload schema against its PostgreSQL discriminator branch", () => {
    const expectation = TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1.database_checks
      ?.find(
        ({ constraint_name }) =>
          constraint_name ===
          "trigger_process_work_items_payload_schema_check",
      );
    expect(expectation).toBeDefined();
    const definition = `CHECK (jsonb_typeof(payload) = 'object' AND (
      (work_kind = 'stage_execute' AND payload->>'schema_version' = 'trigger_stage_execute_work.v1') OR
      (work_kind = 'stage_retry' AND payload->>'schema_version' = 'trigger_stage_retry_work.v1') OR
      (work_kind = 'runtime_start_recompose' AND payload->>'schema_version' = 'trigger_runtime_start_recompose_work.v1') OR
      (work_kind = 'snapshot_repair' AND payload->>'schema_version' = 'trigger_snapshot_repair_work.v1') OR
      (work_kind = 'meta_enqueue' AND payload->>'schema_version' = 'trigger_meta_enqueue_work.v1')
    ))`;
    expect(() =>
      verifyOwnerDatabaseCheckDefinitionV1(expectation!, definition),
    ).not.toThrow();
    expect(() =>
      verifyOwnerDatabaseCheckDefinitionV1(
        expectation!,
        definition.replace(
          "trigger_meta_enqueue_work.v1",
          "trigger_stage_execute_work.v1",
        ),
      ),
    ).toThrow(/CHECK constraint drift/u);
  });

  it("binds the Action Runtime controlled outbox to a complete canonical source envelope", () => {
    expect(
      ACTION_RUNTIME_REPOSITORY_CONTRACT_V1.foreign_keys.filter(
        ({ table_name, columns, referenced_table, referenced_columns }) =>
          table_name === "runtime_event_outbox" &&
          columns.length === 1 &&
          columns[0] === "source_event_id" &&
          referenced_table === "runtime_events" &&
          referenced_columns.length === 1 &&
          referenced_columns[0] === "id",
      ),
    ).toHaveLength(1);
    expect(ACTION_RUNTIME_REPOSITORY_CONTRACT_V1.database_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table_name: "runtime_events",
          semantic_constraint: expect.objectContaining({
            kind: "text_enum",
            column_name: "event_type",
          }),
        }),
        expect.objectContaining({
          table_name: "runtime_events",
          semantic_constraint: expect.objectContaining({
            kind: "json_event_envelope",
            column_name: "envelope",
            producer_value: "action_runtime",
            allow_additional_keys: true,
            required_keys: [
              "event_id",
              "event_type",
              "schema_version",
              "producer",
              "occurred_at",
              "idempotency_key",
              "trace_id",
              "payload",
            ],
            field_bindings: expect.arrayContaining([
              { field_name: "event_id", column_name: "id" },
              { field_name: "event_type", column_name: "event_type" },
              {
                field_name: "idempotency_key",
                column_name: "idempotency_key",
              },
            ]),
          }),
        }),
      ]),
    );
  });

  it("rejects drift in PostgreSQL JSON envelope producer, keys, and source bindings", () => {
    const expectation = ACTION_RUNTIME_REPOSITORY_CONTRACT_V1.database_checks
      .find(({ constraint_name }) => constraint_name === "runtime_events_check");
    expect(expectation).toBeDefined();
    if (expectation === undefined) return;
    const definition = `CHECK (jsonb_typeof(envelope) = 'object'::text AND envelope ?& ARRAY['event_id'::text, 'event_type'::text, 'schema_version'::text, 'producer'::text, 'occurred_at'::text, 'idempotency_key'::text, 'trace_id'::text, 'payload'::text] AND (envelope ->> 'event_id'::text) = id AND (envelope ->> 'event_type'::text) = event_type AND (envelope ->> 'idempotency_key'::text) = idempotency_key AND (envelope ->> 'producer'::text) = 'action_runtime'::text)`;

    expect(() =>
      verifyOwnerDatabaseCheckDefinitionV1(expectation, definition),
    ).not.toThrow();
    expect(() =>
      verifyOwnerDatabaseCheckDefinitionV1(
        expectation,
        definition.replace("'action_runtime'", "'trigger_processor'"),
      ),
    ).toThrow(/CHECK constraint drift/u);
    expect(() =>
      verifyOwnerDatabaseCheckDefinitionV1(
        expectation,
        definition.replace("'payload'::text", "'trace_id'::text"),
      ),
    ).toThrow(/CHECK constraint drift/u);
    expect(() =>
      verifyOwnerDatabaseCheckDefinitionV1(
        expectation,
        definition.replace(
          "(envelope ->> 'event_id'::text) = id",
          "(envelope ->> 'event_id'::text) = runtime_run_id",
        ),
      ),
    ).toThrow(/CHECK constraint drift/u);
    expect(() =>
      verifyOwnerDatabaseCheckDefinitionV1(
        expectation,
        `CHECK ((${definition.slice("CHECK (".length, -1)}) OR true)`,
      ),
    ).toThrow(/CHECK constraint drift/u);
    expect(() =>
      verifyOwnerDatabaseCheckDefinitionV1(
        expectation,
        `CHECK ((${definition.slice("CHECK (".length, -1)}) AND true)`,
      ),
    ).toThrow(/CHECK constraint drift/u);
  });

  it("proves Action Runtime resolver ref, hash, canonical bytes and retention CHECK semantics", () => {
    const expectations = Object.fromEntries(
      (ACTION_RUNTIME_REPOSITORY_CONTRACT_V1.database_checks ?? []).map(
        (check) => [check.constraint_name, check],
      ),
    );
    const cases = [
      [
        "runtime_events_payload_ref_shape_check",
        "CHECK ((payload_ref = ('runtime_event:'::text || id)))",
        "CHECK ((payload_ref = ('artifact:'::text || id)))",
      ],
      [
        "runtime_events_payload_hash_shape_check",
        "CHECK ((payload_hash ~ '^sha256:[0-9a-f]{64}$'::text))",
        "CHECK ((payload_hash ~ '^sha256:.+$'::text))",
      ],
      [
        "runtime_events_canonical_bytes_check",
        "CHECK ((octet_length(envelope_canonical_bytes) > 0))",
        "CHECK ((octet_length(envelope_canonical_bytes) >= 0))",
      ],
      [
        "runtime_events_retention_check",
        "CHECK ((retention_until > created_at))",
        "CHECK ((retention_until >= created_at))",
      ],
    ] as const;
    for (const [name, valid, weakened] of cases) {
      const expectation = expectations[name];
      expect(expectation, name).toBeDefined();
      if (expectation === undefined) continue;
      expect(() =>
        verifyOwnerDatabaseCheckDefinitionV1(expectation, valid),
      ).not.toThrow();
      expect(() =>
        verifyOwnerDatabaseCheckDefinitionV1(expectation, weakened),
      ).toThrow(/CHECK constraint drift/u);
    }
  });

  it("rejects semantic weakening of integer range and meta enqueue CHECKs", () => {
    const generationExpectation =
      TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1.database_checks?.find(
        ({ constraint_name }) =>
          constraint_name === "bot_foreground_slots_generation_safe_check",
      );
    const transitionVersionExpectation =
      TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1.database_checks?.find(
        ({ constraint_name }) =>
          constraint_name === "trigger_process_transition_version_step_check",
      );
    const reasonExpectation =
      TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1.database_checks?.find(
        ({ constraint_name }) =>
          constraint_name === "trigger_processes_meta_enqueue_reason_check",
      );
    const presenceExpectation =
      TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1.database_checks?.find(
        ({ constraint_name }) =>
          constraint_name === "trigger_processes_meta_enqueue_presence_check",
      );
    const terminalExpectation =
      TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1.database_checks?.find(
        ({ constraint_name }) =>
          constraint_name === "trigger_processes_terminal_reason_presence_check",
      );
    expect(generationExpectation).toBeDefined();
    expect(transitionVersionExpectation).toBeDefined();
    expect(reasonExpectation).toBeDefined();
    expect(presenceExpectation).toBeDefined();
    expect(terminalExpectation).toBeDefined();
    if (
      generationExpectation === undefined ||
      transitionVersionExpectation === undefined ||
      reasonExpectation === undefined ||
      presenceExpectation === undefined ||
      terminalExpectation === undefined
    ) return;

    expect(() =>
      verifyOwnerDatabaseCheckDefinitionV1(
        generationExpectation,
        "CHECK ((slot_generation >= 1) AND (slot_generation <= 9007199254740991))",
      ),
    ).not.toThrow();
    expect(() =>
      verifyOwnerDatabaseCheckDefinitionV1(
        generationExpectation,
        "CHECK (slot_generation >= 1 AND slot_generation <= '9007199254740991'::bigint)",
      ),
    ).not.toThrow();
    expect(() =>
      verifyOwnerDatabaseCheckDefinitionV1(
        generationExpectation,
        "CHECK (((slot_generation >= 1) AND (slot_generation <= 9007199254740991)) OR true)",
      ),
    ).toThrow(/CHECK constraint drift/u);
    expect(() =>
      verifyOwnerDatabaseCheckDefinitionV1(
        generationExpectation,
        "CHECK ((slot_generation >= 1) AND (slot_generation <= 9223372036854775807))",
      ),
    ).toThrow(/CHECK constraint drift/u);

    expect(() =>
      verifyOwnerDatabaseCheckDefinitionV1(
        transitionVersionExpectation,
        "CHECK (resulting_state_version = previous_state_version + 1)",
      ),
    ).not.toThrow();
    for (const weakened of [
      "CHECK (resulting_state_version >= previous_state_version + 1)",
      "CHECK (resulting_state_version = previous_state_version)",
      "CHECK ((resulting_state_version = previous_state_version + 1) OR true)",
      "CHECK (resulting_state_version = unrelated_version + 1)",
    ]) {
      expect(() =>
        verifyOwnerDatabaseCheckDefinitionV1(
          transitionVersionExpectation,
          weakened,
        ),
      ).toThrow(/CHECK constraint drift/u);
    }

    expect(() =>
      verifyOwnerDatabaseCheckDefinitionV1(
        reasonExpectation,
        "CHECK (meta_enqueue_reason IS NULL OR meta_enqueue_reason IN ('cooldown_expired', 'user_retracted', 'system_interrupted', 'failed_with_learnable_snapshot'))",
      ),
    ).not.toThrow();
    expect(() =>
      verifyOwnerDatabaseCheckDefinitionV1(
        reasonExpectation,
        "CHECK (meta_enqueue_reason IS NULL OR meta_enqueue_reason IN ('cooldown_expired', 'user_retracted', 'system_interrupted', 'failed_with_learnable_snapshot', 'attacker_reason'))",
      ),
    ).toThrow(/CHECK constraint drift/u);

    expect(() =>
      verifyOwnerDatabaseCheckDefinitionV1(
        presenceExpectation,
        "CHECK ((phase = 'meta_enqueued') = (meta_enqueue_reason IS NOT NULL))",
      ),
    ).not.toThrow();
    expect(() =>
      verifyOwnerDatabaseCheckDefinitionV1(
        presenceExpectation,
        "CHECK (phase <> 'meta_enqueued' OR meta_enqueue_reason IS NOT NULL)",
      ),
    ).toThrow(/CHECK constraint drift/u);
    expect(() =>
      verifyOwnerDatabaseCheckDefinitionV1(
        presenceExpectation,
        "CHECK ((phase = 'meta_enqueued') = true)",
      ),
    ).toThrow(/CHECK constraint drift/u);
    expect(() =>
      verifyOwnerDatabaseCheckDefinitionV1(
        terminalExpectation,
        "CHECK (((phase = 'closed') = (terminal_reason IS NOT NULL)) AND (terminal_reason IS NULL OR terminal_reason <> ''))",
      ),
    ).not.toThrow();
    expect(() =>
      verifyOwnerDatabaseCheckDefinitionV1(
        terminalExpectation,
        "CHECK ((phase = 'closed') = (terminal_reason IS NOT NULL AND terminal_reason <> ''))",
      ),
    ).toThrow(/CHECK constraint drift/u);
    expect(() =>
      verifyOwnerDatabaseCheckDefinitionV1(
        terminalExpectation,
        "CHECK ((phase = 'closed') = (terminal_reason IS NOT NULL))",
      ),
    ).toThrow(/CHECK constraint drift/u);
  });

  it("proves bounded non-null text arrays and permission-summary branch closure", () => {
    const capabilityRefsExpectation = {
      constraint_name:
        "skill_permission_summary_entries_capability_refs_check",
      table_name: "skill_permission_summary_entries",
      required_definition_fragments: [
        "cardinality",
        "capability_refs",
        "1024",
        "array_position",
      ],
      semantic_constraint: {
        kind: "text_array_bounded_no_null" as const,
        column_name: "capability_refs",
        max_items: 1024,
      },
    };
    const branchExpectation = {
      constraint_name: "skill_permission_summary_entries_branch_check",
      table_name: "skill_permission_summary_entries",
      required_definition_fragments: [
        "decision_source",
        "revision",
        "default_deny",
        "permission_revision_id",
        "revision_no",
        "scope_hash",
        "owner_agent_condition",
        "cardinality",
      ],
      semantic_constraint: {
        kind: "permission_summary_entry_branch" as const,
        column_name: "decision_source",
        revision_value: "revision",
        default_deny_value: "default_deny",
        decision_column_name: "decision",
        deny_value: "deny",
        revision_required_columns: [
          "permission_revision_id",
          "revision_no",
          "scope_hash",
        ],
        default_null_columns: [
          "permission_revision_id",
          "revision_no",
          "scope_hash",
          "owner_agent_condition",
        ],
        default_empty_array_column_name: "capability_refs",
      },
    };
    const validCapabilityRefs =
      "CHECK ((cardinality(capability_refs) <= 1024) AND (array_position(capability_refs, NULL::text) IS NULL))";
    const validBranch = `CHECK (((decision_source = 'revision'::text) AND (permission_revision_id IS NOT NULL) AND (revision_no IS NOT NULL) AND (scope_hash IS NOT NULL)) OR ((decision_source = 'default_deny'::text) AND (decision = 'deny'::text) AND (permission_revision_id IS NULL) AND (revision_no IS NULL) AND (scope_hash IS NULL) AND (owner_agent_condition IS NULL) AND (cardinality(capability_refs) = 0)))`;

    expect(() =>
      verifyOwnerDatabaseCheckDefinitionV1(
        capabilityRefsExpectation,
        validCapabilityRefs,
      ),
    ).not.toThrow();
    expect(() =>
      verifyOwnerDatabaseCheckDefinitionV1(branchExpectation, validBranch),
    ).not.toThrow();

    for (const weakened of [
      validCapabilityRefs.replace("<= 1024", "<= 2048"),
      validCapabilityRefs.replace(
        "(array_position(capability_refs, NULL::text) IS NULL)",
        "true",
      ),
      `CHECK ((${validCapabilityRefs.slice(7, -1)}) OR true)`,
    ]) {
      expect(() =>
        verifyOwnerDatabaseCheckDefinitionV1(
          capabilityRefsExpectation,
          weakened,
        ),
      ).toThrow(/CHECK constraint drift/u);
    }
    for (const weakened of [
      validBranch.replace(" AND (scope_hash IS NOT NULL)", ""),
      validBranch.replace("(decision = 'deny'::text)", "(decision = 'grant'::text)"),
      validBranch.replace(
        " AND (cardinality(capability_refs) = 0)",
        "",
      ),
      `CHECK ((${validBranch.slice(7, -1)}) OR true)`,
    ]) {
      expect(() =>
        verifyOwnerDatabaseCheckDefinitionV1(branchExpectation, weakened),
      ).toThrow(/CHECK constraint drift/u);
    }
  });

  it("proves nullable Action Runtime generations are either NULL or JavaScript-safe", () => {
    const expectation =
      ACTION_RUNTIME_REPOSITORY_CONTRACT_V1.database_checks?.find(
        ({ constraint_name }) =>
          constraint_name ===
          "runtime_control_signals_target_lease_safe_check",
      );
    expect(expectation).toBeDefined();
    if (expectation === undefined) return;

    for (const valid of [
      "CHECK ((target_lease_generation IS NULL) OR ((target_lease_generation >= 1) AND (target_lease_generation <= 9007199254740991)))",
      "CHECK (target_lease_generation IS NULL OR (target_lease_generation >= '1'::bigint AND target_lease_generation <= '9007199254740991'::bigint))",
    ]) {
      expect(() =>
        verifyOwnerDatabaseCheckDefinitionV1(expectation, valid),
      ).not.toThrow();
    }
    for (const weakened of [
      "CHECK (target_lease_generation IS NULL OR target_lease_generation >= 1)",
      "CHECK (target_lease_generation IS NULL OR (target_lease_generation >= 1 AND target_lease_generation <= 9223372036854775807))",
      "CHECK ((target_lease_generation IS NULL OR (target_lease_generation >= 1 AND target_lease_generation <= 9007199254740991)) OR true)",
    ]) {
      expect(() =>
        verifyOwnerDatabaseCheckDefinitionV1(expectation, weakened),
      ).toThrow(/CHECK constraint drift/u);
    }
  });

  it("proves nullable versioned identities are complete and JavaScript-safe", () => {
    const expectation =
      TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1.database_checks?.find(
        ({ constraint_name }) =>
          constraint_name ===
          "trigger_processes_context_identity_complete_check",
      );
    expect(expectation).toBeDefined();
    if (expectation === undefined) return;

    const valid =
      "CHECK (((context_snapshot_ref IS NULL) AND (context_snapshot_version IS NULL) AND (context_snapshot_hash IS NULL)) OR ((context_snapshot_ref IS NOT NULL) AND (context_snapshot_version >= 1) AND (context_snapshot_version <= 9007199254740991) AND (context_snapshot_hash IS NOT NULL) AND (length(context_snapshot_hash) > 0)))";
    expect(() =>
      verifyOwnerDatabaseCheckDefinitionV1(expectation, valid),
    ).not.toThrow();

    for (const weakened of [
      valid.replace(
        "(context_snapshot_hash IS NULL)",
        "(context_snapshot_hash IS NOT NULL)",
      ),
      valid.replace(
        "context_snapshot_version <= 9007199254740991",
        "context_snapshot_version <= 9223372036854775807",
      ),
      valid.replace(
        "(length(context_snapshot_hash) > 0)",
        "true",
      ),
      `CHECK ((${valid.slice(7, -1)}) OR true)`,
    ]) {
      expect(() =>
        verifyOwnerDatabaseCheckDefinitionV1(expectation, weakened),
      ).toThrow(/CHECK constraint drift/u);
    }

    expect(() =>
      defineOwnerRepositoryContractV1({
        ...TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        database_checks:
          TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1.database_checks?.map(
            (check) =>
              check.constraint_name ===
                "trigger_processes_context_identity_complete_check" &&
              check.semantic_constraint?.kind ===
                "nullable_versioned_identity"
                ? {
                    ...check,
                    semantic_constraint: {
                      ...check.semantic_constraint,
                      hash_column_name: "caller_claimed_hash",
                    },
                  }
                : check,
          ),
      } as never),
    ).toThrow(/invalid owner database check/u);
  });

  it("proves every field in a combined JSON-safe integer CHECK", () => {
    const expectation =
      TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1.database_checks?.find(
        ({ constraint_name }) =>
          constraint_name ===
          "trigger_process_snapshots_json_safe_integer_check",
      );
    expect(expectation).toBeDefined();
    if (expectation === undefined) return;

    const valid =
      "CHECK (((snapshot_version >= 1) AND (snapshot_version <= 9007199254740991) AND (first_append_sequence_no >= 0) AND (first_append_sequence_no <= 9007199254740991) AND (last_append_sequence_no >= 0) AND (last_append_sequence_no <= 9007199254740991) AND ((personality_version IS NULL) OR ((personality_version >= 1) AND (personality_version <= 9007199254740991)))))";
    const postgresDeparsed =
      "CHECK (snapshot_version >= 1 AND snapshot_version <= '9007199254740991'::bigint AND first_append_sequence_no >= 0 AND first_append_sequence_no <= '9007199254740991'::bigint AND last_append_sequence_no >= 0 AND last_append_sequence_no <= '9007199254740991'::bigint AND (personality_version IS NULL OR personality_version >= 1 AND personality_version <= '9007199254740991'::bigint))";
    for (const definition of [valid, postgresDeparsed]) {
      expect(() =>
        verifyOwnerDatabaseCheckDefinitionV1(expectation, definition),
      ).not.toThrow();
    }

    for (const weakened of [
      valid.replace(
        "personality_version <= 9007199254740991",
        "personality_version <= 9223372036854775807",
      ),
      valid.replace(
        "last_append_sequence_no <= 9007199254740991",
        "last_append_sequence_no >= 0",
      ),
      valid.replace(
        "snapshot_version <= 9007199254740991",
        "snapshot_version <= 9007199254740991) OR true OR (snapshot_version <= 9007199254740991",
      ),
    ]) {
      expect(() =>
        verifyOwnerDatabaseCheckDefinitionV1(expectation, weakened),
      ).toThrow(/CHECK constraint drift/u);
    }
  });

  it("requires Meta's complete owner-event envelope to contain exactly the eight controlled fields", () => {
    const expectation = META_COGNITION_REPOSITORY_CONTRACT_V1.database_checks
      .find(
        ({ constraint_name }) =>
          constraint_name === "meta_event_outbox_check",
      );
    expect(expectation).toBeDefined();
    if (expectation === undefined) return;
    const keys = "'event_id'::text, 'event_type'::text, 'schema_version'::text, 'producer'::text, 'occurred_at'::text, 'idempotency_key'::text, 'trace_id'::text, 'payload'::text";
    const bindings = "(payload ->> 'producer'::text) = 'meta_cognition'::text AND (payload ->> 'event_id'::text) = id AND (payload ->> 'event_type'::text) = event_type AND (payload ->> 'idempotency_key'::text) = idempotency_key";
    const definition = `CHECK (jsonb_typeof(payload) = 'object'::text AND jsonb_object_length(payload) = 8 AND payload ?& ARRAY[${keys}] AND ${bindings})`;

    for (const valid of [
      definition,
      `CHECK (jsonb_typeof(payload) = 'object'::text AND payload ?& ARRAY[${keys}] AND (payload - ARRAY[${keys}]) = '{}'::jsonb AND ${bindings})`,
    ]) {
      expect(() =>
        verifyOwnerDatabaseCheckDefinitionV1(expectation, valid),
      ).not.toThrow();
    }
    expect(() =>
      verifyOwnerDatabaseCheckDefinitionV1(
        expectation,
        definition.replace("jsonb_object_length(payload) = 8", "true"),
      ),
    ).toThrow(/CHECK constraint drift/u);
    expect(() =>
      verifyOwnerDatabaseCheckDefinitionV1(
        expectation,
        definition.replace("(payload ->> 'event_id'::text) = id", "true"),
      ),
    ).toThrow(/CHECK constraint drift/u);
  });

  it("requires Trigger outbox domain CHECK to bind columns, not payload fields", () => {
    const expectation = TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1.database_checks
      .find(
        ({ constraint_name }) =>
          constraint_name === "trigger_event_outbox_generated_contract_check",
      );
    expect(expectation).toBeDefined();
    if (expectation === undefined) return;
    const definition =
      "CHECK (((producer = 'trigger_processor'::text) AND (schema_version = 'trigger_processor_event.v1'::text) AND (event_type IN ('trigger.accepted'::text, 'trigger.rejected'::text, 'trigger_process.phase_changed'::text, 'trigger_process.user_message_retracted'::text, 'trigger_process.system_interrupted'::text, 'cooldown.expired'::text, 'weak_trigger.merged'::text, 'trigger_process.outcome_finalized'::text))))";
    expect(() =>
      verifyOwnerDatabaseCheckDefinitionV1(expectation, definition),
    ).not.toThrow();
    expect(() =>
      verifyOwnerDatabaseCheckDefinitionV1(
        expectation,
        definition.replace(
          "schema_version = 'trigger_processor_event.v1'::text",
          "payload ->> 'schema_version' = 'trigger_processor_event.v1'::text",
        ),
      ),
    ).toThrow(/CHECK constraint drift/u);
    expect(() =>
      verifyOwnerDatabaseCheckDefinitionV1(
        expectation,
        definition.replace(
          ", 'trigger_process.outcome_finalized'::text",
          ", 'trigger_process.outcome_finalized'::text, 'attacker.event'::text",
        ),
      ),
    ).toThrow(/CHECK constraint drift/u);
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
          semantic_constraint: expect.objectContaining({
            kind: "nullable_text_enum",
            column_name: "meta_enqueue_reason",
            allowed_values: expect.arrayContaining([
              "user_retracted",
              "system_interrupted",
            ]),
          }),
        }),
        expect.objectContaining({
          constraint_name: "trigger_processes_meta_enqueue_presence_check",
          table_name: "trigger_processes",
        }),
      ]),
    );
  });

  it("models trigger admission as one slot-aware state/audit/outbox transaction", () => {
    const signature = TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1.function_signatures
      .find(
        ({ function_name }) =>
          function_name === "create_trigger_admission_v1",
      );
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
    expect(signature?.reads_tables).toContain("bot_foreground_slots");
    expect(signature?.writes_tables).not.toContain("bot_foreground_slots");
    expect(signature?.writes_tables).toEqual(
      expect.arrayContaining([
        "triggers",
        "trigger_processes",
        "trigger_process_transitions",
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
    expect(pendingWriter?.writer_kind).toBe("state_transition");
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
      "runtime_run_leases",
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
        "create_runtime_start_attempt_v1",
        "begin_runtime_start_reservation_validation_call_v1",
        "append_runtime_start_reservation_validation_v1",
        "transition_runtime_start_attempt_v1",
        "cas_runtime_run_lease_v1",
        "cas_tool_permission_profile_current_v1",
        "append_runtime_event_v1",
        "record_tool_invocation_v1",
        "transition_runtime_control_signal_v1",
        "record_runtime_artifact_v1",
      ]),
    );
    for (const legacyWriter of [
      "persist_runtime_policy_snapshot_v1",
      "transition_tool_invocation_v1",
      "transition_runtime_artifact_v1",
    ]) {
      expect(
        ACTION_RUNTIME_REPOSITORY_CONTRACT_V1.mutable_writers,
      ).not.toContain(legacyWriter);
    }
  });

  it("fails closed on schema or role drift", () => {
    expect(() =>
      defineOwnerRepositoryContractV1({
        ...TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        schema: "memory",
      } as never),
    ).toThrow(/owner database target drift/);
  });

  it("refuses to verify a live owner without canonical DLQ resolution mappings", async () => {
    const queries: string[] = [];
    const postgres = {
      async query<TRow extends Record<string, unknown>>(sql: string) {
        queries.push(sql);
        return { rows: [] as TRow[] };
      },
    };
    await expect(
      verifyOwnerRepositoryDeploymentFromPostgresV1(
        {
          ...TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
          dlq_resolutions: undefined,
        } as never,
        postgres,
        {
          expected_schema_owner: "pai_migrator",
          runtime_postgres: postgres,
        },
      ),
    ).rejects.toThrow(/canonical immutable DLQ resolution mapping is required/u);
    expect(queries).toEqual([]);
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
        {
          ...TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
          dlq_tables: [],
          dlq_resolutions: [],
        } as never,
        postgres,
        {
          expected_schema_owner: "pai_migrator",
          runtime_postgres: postgres,
        },
      ),
    ).rejects.toThrow(
      /canonical PostgreSQL column snapshot is required|durable inbox identity ABI drift/u,
    );
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
              contract.database_columns
                ?.filter(
                  ({ table_name }) => table_name === foreignKey.table_name,
                )
                .map(({ column_name }) => column_name),
            );
            const referencedColumns = new Set(
              contract.database_columns
                ?.filter(
                  ({ table_name }) =>
                    table_name === foreignKey.referenced_table,
                )
                .map(({ column_name }) => column_name),
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
    expect(application).not.toHaveProperty("outbox");
    expect(application).not.toHaveProperty("close");
    expect(Object.isFrozen(application)).toBe(true);
  });

  it("rejects runtime search_path mutation and unqualified owner table access", () => {
    const signature = MEMORY_REPOSITORY_CONTRACT_V1.function_signatures.find(
      ({ function_name }) => function_name === "claim_memory_event_outbox_v1",
    );
    expect(signature).toBeDefined();
    if (signature === undefined) return;
    const body = (statement: string) => `
      CREATE FUNCTION memory.claim_memory_event_outbox_v1(
        p_worker_id text,
        p_limit integer,
        p_lease_seconds integer,
        p_now timestamptz
      ) RETURNS SETOF jsonb
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = memory, pg_temp
      AS $body$
      BEGIN
        ${statement}
        RETURN QUERY
          UPDATE memory.memory_event_outbox
             SET status = 'dispatching',
                 claim_token = p_worker_id,
                 locked_until = p_now + make_interval(secs => p_lease_seconds),
                 attempt_count = attempt_count + 1
           WHERE id IN (
             SELECT id
               FROM memory.memory_event_outbox
              WHERE status = 'pending'
              ORDER BY created_at
              FOR UPDATE SKIP LOCKED
              LIMIT p_limit
           )
           RETURNING to_jsonb(memory.memory_event_outbox);
      END
      $body$`;

    expect(() =>
      lintOwnerWriterDefinitionV1(
        MEMORY_REPOSITORY_CONTRACT_V1,
        signature,
        body("PERFORM pg_catalog.set_config('search_path', 'pg_temp', true);"),
      ),
    ).toThrow(/protected runtime GUC changes|search_path/u);

    expect(() =>
      lintOwnerWriterDefinitionV1(
        MEMORY_REPOSITORY_CONTRACT_V1,
        signature,
        body(""),
      ),
    ).not.toThrow();

    expect(() =>
      lintOwnerWriterDefinitionV1(
        MEMORY_REPOSITORY_CONTRACT_V1,
        signature,
        body("").replaceAll(
          "memory.memory_event_outbox",
          "memory_event_outbox",
        ),
      ),
    ).toThrow(/unqualified|effect drift/u);
  });

  it("authorizes only the exact pai-infra writer artifact, not lexical proof lookalikes", () => {
    const signature = ownerFunctionSignatureV1({
      schema: "timer",
      function_name: "artifact_bound_writer_v1",
      primary_table: "timer_schedules",
      writer_kind: "state_transition",
      arguments: [["p_schedule_id", "text"]],
      reads_tables: ["timer_schedules"],
      writes_tables: ["timer_schedules"],
      effects: [
        {
          table_name: "timer_schedules",
          operation: "transition",
          concurrency_control: "idempotency_key",
        },
      ],
      returns: "jsonb",
    });
    const trustedBody = `BEGIN
  UPDATE timer.timer_schedules SET status = 'paused'
   WHERE id = p_schedule_id;
  RETURN '{}'::jsonb;
END;`;
    const definition = (body: string) => `
      CREATE FUNCTION timer.artifact_bound_writer_v1(p_schedule_id text)
      RETURNS jsonb LANGUAGE plpgsql AS $writer$
${body}
$writer$`;
    const contract = {
      writer_artifacts: [
        ownerWriterArtifactV1({
          signature,
          generator_source:
            "pai-infra/supabase/generated/permissions/0300_timer.sql",
          function_body: trustedBody,
        }),
      ],
    };

    expect(() =>
      verifyOwnerWriterDefinitionV1(contract, signature, definition(trustedBody)),
    ).not.toThrow();
    for (const bypassBody of [
      `IF CAST(2 AS integer) = 3 THEN\n${trustedBody}\nEND IF;`,
      `DECLARE v_status text; BEGIN\nSELECT status INTO v_status FROM timer.timer_schedules LIMIT 1;\nPERFORM p_schedule_id = v_status;\n${trustedBody.slice("BEGIN\n".length)}`,
      trustedBody.replace(
        "UPDATE timer.timer_schedules",
        "BEGIN RAISE EXCEPTION 'denied'; EXCEPTION WHEN OTHERS THEN NULL; END;\n  UPDATE timer.timer_schedules",
      ),
    ]) {
      expect(() =>
        verifyOwnerWriterDefinitionV1(contract, signature, definition(bypassBody)),
      ).toThrow(/trusted PostgreSQL writer artifact drift/u);
    }
  });

  it("accepts only a static unconditional immutable-trigger RAISE body", () => {
    const body = `BEGIN
  RAISE EXCEPTION 'immutable owner fact' USING ERRCODE = '55000';
END;`;
    const artifact = ownerImmutableTriggerV1({
      trigger_name: "owner_facts_immutable",
      table_name: "owner_facts",
      function_name: "reject_owner_fact_mutation_v1",
      function_body: body,
    });
    expect(artifact).toMatchObject({
      trigger_name: "owner_facts_immutable",
      table_name: "owner_facts",
      function_name: "reject_owner_fact_mutation_v1",
      timing: "before",
      events: ["update", "delete"],
      orientation: "row",
      enabled_mode: "origin",
    });
    expect(artifact.function_body_sha256).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(Object.isFrozen(artifact)).toBe(true);
    expect(Object.isFrozen(artifact.events)).toBe(true);

    for (const unsafeBody of [
      `BEGIN PERFORM 1; RAISE EXCEPTION 'immutable'; END;`,
      `BEGIN IF true THEN RAISE EXCEPTION 'immutable'; END IF; END;`,
      `BEGIN RAISE EXCEPTION p_message; END;`,
      `BEGIN RAISE EXCEPTION 'immutable'; RETURN OLD; END;`,
      `BEGIN RAISE EXCEPTION 'immutable'; EXCEPTION WHEN OTHERS THEN RETURN OLD; END;`,
    ]) {
      expect(() =>
        ownerImmutableTriggerV1({
          trigger_name: "owner_facts_immutable",
          table_name: "owner_facts",
          function_name: "reject_owner_fact_mutation_v1",
          function_body: unsafeBody,
        }),
      ).toThrow(/exactly one unconditional static RAISE EXCEPTION/u);
    }
  });

  it("requires the schema-prefixed transaction advisory lock before owner fact access", () => {
    const signature = ownerFunctionSignatureV1({
      schema: "action_runtime",
      function_name: "advisory_start_control_fence_v1",
      primary_table: "runtime_start_attempts",
      writer_kind: "state_transition",
      arguments: [["p_runtime_run_id", "text"]],
      reads_tables: [
        "runtime_start_attempts",
        "runtime_control_tombstones",
      ],
      writes_tables: ["runtime_start_attempts"],
      effects: [
        {
          table_name: "runtime_start_attempts",
          operation: "append",
          concurrency_control: "advisory_identity_lock",
        },
      ],
      returns: "jsonb",
    });
    const lock =
      "PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('action_runtime:' || p_runtime_run_id, 0));";
    const insert =
      "INSERT INTO action_runtime.runtime_start_attempts(id) VALUES (p_runtime_run_id);";
    const definition = (body: string) => `
      CREATE FUNCTION action_runtime.advisory_start_control_fence_v1(
        p_runtime_run_id text
      ) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
      SET search_path = action_runtime, pg_temp AS $body$
      BEGIN
        ${body}
        RETURN '{}'::jsonb;
      END
      $body$`;

    expect(() =>
      lintOwnerWriterDefinitionV1(
        ACTION_RUNTIME_REPOSITORY_CONTRACT_V1,
        signature,
        definition(`${lock}\n${insert}`),
      ),
    ).not.toThrow();

    for (const weakened of [
      insert,
      `${insert}\n${lock}`,
      `${lock.replace("action_runtime:", "other_domain:")}\n${insert}`,
      `${lock.replace("pg_advisory_xact_lock", "pg_advisory_lock")}\n${insert}`,
      `${lock.replace("pg_catalog.pg_advisory_xact_lock", "pg_advisory_xact_lock")}\n${insert}`,
      `${lock.replace("pg_catalog.hashtextextended", "hashtextextended")}\n${insert}`,
      `${lock.replace("pg_catalog.pg_advisory_xact_lock", "action_runtime.pg_advisory_xact_lock")}\n${insert}`,
      `${lock.replace("pg_catalog.hashtextextended", "action_runtime.hashtextextended")}\n${insert}`,
      `IF p_runtime_run_id <> '' THEN ${lock} END IF;\n${insert}`,
      `BEGIN ${lock} RAISE EXCEPTION 'rollback lock'; EXCEPTION WHEN OTHERS THEN NULL; END;\n${insert}`,
      `PERFORM 1 FROM action_runtime.runtime_control_tombstones WHERE runtime_run_id = p_runtime_run_id;\n${lock}\n${insert}`,
      `PERFORM action_runtime.some_owner_helper(p_runtime_run_id);\n${lock}\n${insert}`,
    ]) {
      expect(() =>
        lintOwnerWriterDefinitionV1(
          ACTION_RUNTIME_REPOSITORY_CONTRACT_V1,
          signature,
          definition(weakened),
        ),
      ).toThrow(/advisory identity lock drift/u);
    }
  });

  it("pins ordered process and exact-attempt advisory locks before Runtime Start facts", () => {
    const signature = ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "runtime_start_lock_probe_v1",
      primary_table: "runtime_start_reservations",
      writer_kind: "state_transition",
      arguments: [
        ["p_process_id", "text"],
        ["p_start_attempt_no", "bigint"],
      ],
      reads_tables: ["runtime_start_reservations"],
      writes_tables: ["runtime_start_reservations"],
      effects: [
        {
          table_name: "runtime_start_reservations",
          operation: "transition",
          concurrency_control: "advisory_identity_lock",
          advisory_lock: {
            key_prefix:
              "trigger_processor:runtime_start_reservation_process:",
            identity_arguments: ["p_process_id"],
            separator: ":",
            order: 1,
          },
        },
        {
          table_name: "runtime_start_reservations",
          operation: "transition",
          concurrency_control: "advisory_identity_lock",
          advisory_lock: {
            key_prefix: "trigger_processor:runtime_start_reservation:",
            identity_arguments: [
              "p_process_id",
              "p_start_attempt_no",
            ],
            separator: ":",
            order: 2,
          },
        },
      ],
      returns: "jsonb",
    });
    const coarse = `PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'trigger_processor:runtime_start_reservation_process:'::pg_catalog.text
          || p_process_id::pg_catalog.text,
        0));`;
    const exact = `PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'trigger_processor:runtime_start_reservation:'::pg_catalog.text
          || p_process_id::pg_catalog.text
          || ':'::pg_catalog.text
          || p_start_attempt_no::pg_catalog.text,
        0));`;
    const mutation = `UPDATE trigger_processor.runtime_start_reservations
      SET status = 'dispatching'
      WHERE trigger_process_id = p_process_id
        AND start_attempt_no = p_start_attempt_no;`;
    const definition = (statements: string) => `
      CREATE FUNCTION trigger_processor.runtime_start_lock_probe_v1(
        p_process_id text,
        p_start_attempt_no bigint
      ) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
      SET search_path = trigger_processor, pg_temp AS $body$
      BEGIN
        ${statements}
        RETURN '{}'::jsonb;
      END;
      $body$`;

    expect(() =>
      lintOwnerWriterDefinitionV1(
        TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        signature,
        definition(`${coarse}\n${exact}\n${mutation}`),
      ),
    ).not.toThrow();
    for (const weakened of [
      `${exact}\n${coarse}\n${mutation}`,
      `${coarse}\n${mutation}`,
      `${coarse}\n${mutation}\n${exact}`,
      `${coarse}\n${exact.replace(
        "runtime_start_reservation:",
        "runtime_start_other:",
      )}\n${mutation}`,
    ]) {
      expect(() =>
        lintOwnerWriterDefinitionV1(
          TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
          signature,
          definition(weakened),
        ),
      ).toThrow(/advisory identity lock drift/u);
    }
  });

  it("locks the declared authority row before mutating a different effect table", () => {
    const signature = ownerFunctionSignatureV1({
      schema: "action_runtime",
      function_name: "append_event_from_locked_run_v1",
      primary_table: "runtime_events",
      writer_kind: "state_transition",
      arguments: [["p_runtime_run_id", "text"]],
      reads_tables: ["runtime_runs"],
      writes_tables: ["runtime_events"],
      effects: [
        {
          table_name: "runtime_events",
          operation: "append",
          concurrency_control: "database_row_lock",
          lock_table_name: "runtime_runs",
        },
      ],
      returns: "jsonb",
    });
    const lock = `SELECT id INTO v_run_id
        FROM action_runtime.runtime_runs
       WHERE id = p_runtime_run_id
       FOR UPDATE;`;
    const insert = `INSERT INTO action_runtime.runtime_events(
        id, runtime_run_id
      ) VALUES ('event-id', p_runtime_run_id);`;
    const definition = (body: string) => `
      CREATE FUNCTION action_runtime.append_event_from_locked_run_v1(
        p_runtime_run_id text
      ) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
      SET search_path = action_runtime, pg_temp AS $body$
      DECLARE
        v_run_id text;
      BEGIN
        ${body}
        RETURN '{}'::jsonb;
      END
      $body$`;

    expect(() =>
      lintOwnerWriterDefinitionV1(
        ACTION_RUNTIME_REPOSITORY_CONTRACT_V1,
        signature,
        definition(`${lock}\n${insert}`),
      ),
    ).not.toThrow();
    for (const weakened of [
      `${insert}\n${lock}`,
      `${lock.replace("runtime_runs", "runtime_events")}\n${insert}`,
      insert,
    ]) {
      expect(() =>
        lintOwnerWriterDefinitionV1(
          ACTION_RUNTIME_REPOSITORY_CONTRACT_V1,
          signature,
          definition(weakened),
        ),
      ).toThrow(/row-lock drift|undeclared PostgreSQL read/u);
    }
  });

  it("defaults writer arguments to non-null and rejects nullable fences", () => {
    const signature = ownerFunctionSignatureV1({
      schema: "timer",
      function_name: "nullable_metadata_v1",
      primary_table: "timer_schedules",
      writer_kind: "state_transition",
      arguments: [
        ["p_required", "text"],
        ["p_optional", "jsonb", { nullable: true }],
      ],
      reads_tables: ["timer_schedules"],
      writes_tables: ["timer_schedules"],
      effects: [
        {
          table_name: "timer_schedules",
          operation: "transition",
          concurrency_control: "idempotency_key",
        },
      ],
      returns: "jsonb",
    });
    expect(signature.arguments).toEqual([
      {
        argument_name: "p_required",
        postgres_type: "text",
        mode: "in",
      },
      {
        argument_name: "p_optional",
        postgres_type: "jsonb",
        mode: "in",
        nullable: true,
      },
    ]);

    const scheduleWriterIndex =
      TIMER_REPOSITORY_CONTRACT_V1.function_signatures.findIndex(
        ({ function_name }) => function_name === "cas_timer_schedule_v1",
      );
    expect(scheduleWriterIndex).toBeGreaterThanOrEqual(0);
    expect(() =>
      defineOwnerRepositoryContractV1({
        ...TIMER_REPOSITORY_CONTRACT_V1,
        function_signatures:
          TIMER_REPOSITORY_CONTRACT_V1.function_signatures.map(
            (writer, index) =>
              index === scheduleWriterIndex
                ? {
                    ...writer,
                    arguments: writer.arguments.map((argument) =>
                      argument.argument_name ===
                      "p_expected_schedule_version"
                        ? { ...argument, nullable: true }
                        : argument,
                    ),
                  }
                : writer,
          ),
      } as never),
    ).toThrow(/semantic effect/u);
  });

  it("requires exact authority and slot/process relational fences", () => {
    const signature = ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "test_server_side_admission_v1",
      primary_table: "weak_trigger_queue_items",
      writer_kind: "state_transition",
      arguments: [
        ["p_scope", "jsonb"],
        ["p_source", "text"],
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
    const validAuthorityProof = `
        PERFORM b.id, binding.bot_id,
                p_admission_request->>'is_catch_up',
                p_admission_request->>'explicit_interrupt'
          FROM trigger_processor.bots b
          JOIN trigger_processor.bot_permission_bindings binding
            ON binding.workspace_id = b.workspace_id
           AND binding.bot_id = b.id
           AND binding.deployment_environment = b.deployment_environment
           AND binding.release_channel = b.release_channel
           AND binding.principal_type = p_authenticated_context->>'principal_type'
           AND binding.principal_id = p_authenticated_context->>'principal_id'
           AND binding.permission_scope = p_authenticated_context->>'permission_scope'
         WHERE b.workspace_id = p_scope->>'workspace_id'
           AND b.id = p_scope->>'bot_id'
           AND b.owner_agent_id = p_scope->>'owner_agent_id'
           AND b.deployment_environment = p_scope->>'deployment_environment'
           AND b.release_channel = p_scope->>'release_channel'
           AND binding.status = 'active'
           AND p_source IN ('chat', 'notification', 'timer')
           AND p_authenticated_context->>'permission_scope'
                 = 'trigger.submit.' || p_source
           AND (
             (
               p_source = 'timer'
               AND
               p_authenticated_context->>'authentication_kind' = 'pai_workload_jwt'
               AND p_authenticated_context->>'principal_type' = 'service'
             )
             OR
             (
               p_source IN ('chat', 'notification')
               AND
               p_authenticated_context->>'authentication_kind' = 'supabase_ingress'
               AND p_authenticated_context->>'principal_type'
                     IN ('user', 'developer', 'agent')
             )
           );
        IF NOT FOUND THEN
          RAISE EXCEPTION 'bot authority not found';
        END IF;`;
    const body = (
      locks: string,
      authorityProof = validAuthorityProof,
    ) => `
      CREATE FUNCTION trigger_processor.test_server_side_admission_v1(
        p_scope jsonb,
        p_source text,
        p_authenticated_context jsonb,
        p_admission_request jsonb
      ) RETURNS jsonb LANGUAGE plpgsql AS $body$
      BEGIN
        ${locks}
        ${authorityProof}
        INSERT INTO trigger_processor.weak_trigger_queue_items(id) VALUES ('id');
        RETURN '{}'::jsonb;
      END $body$`;
    expect(() =>
      lintOwnerWriterDefinitionV1(
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
          IF NOT FOUND THEN
            RAISE EXCEPTION 'slot/process fence not found';
          END IF;
        `),
      ),
    ).not.toThrow();
    const validLocks = `
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
      IF NOT FOUND THEN
        RAISE EXCEPTION 'slot/process fence not found';
      END IF;`;
    for (const invalidAuthorityProof of [
      validAuthorityProof.replace(
        "binding.principal_id = p_authenticated_context->>'principal_id'",
        "p_authenticated_context->>'principal_id' IS NOT NULL",
      ),
      validAuthorityProof.replace(
        "p_authenticated_context->>'authentication_kind' = 'pai_workload_jwt'",
        "p_authenticated_context->>'authentication_kind' = 'supabase_ingress'",
      ),
      validAuthorityProof.replace(
        "p_source = 'timer'\n               AND\n               p_authenticated_context->>'authentication_kind' = 'pai_workload_jwt'",
        "p_source = 'timer'\n               OR\n               p_authenticated_context->>'authentication_kind' = 'pai_workload_jwt'",
      ),
      validAuthorityProof.replace(
        "p_authenticated_context->>'principal_type' = 'service'",
        "p_authenticated_context->>'principal_type' = 'service' OR TRUE",
      ),
      validAuthorityProof.replace(
        "binding.permission_scope = p_authenticated_context->>'permission_scope'",
        "binding.permission_scope = 'trigger.submit.timer'",
      ),
      validAuthorityProof.replace(
        "p_authenticated_context->>'permission_scope'\n                 = 'trigger.submit.' || p_source",
        "p_authenticated_context->>'permission_scope' = 'trigger.submit.timer'",
      ),
      validAuthorityProof.replace(
        "binding.principal_id = p_authenticated_context->>'principal_id'",
        "binding.principal_id = p_authenticated_context #>> '{verified_principal,principal_id}'",
      ),
    ]) {
      expect(() =>
        lintOwnerWriterDefinitionV1(
          TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
          signature,
          body(validLocks, invalidAuthorityProof),
        ),
      ).toThrow(/slot\/process fence drift/);
    }
    expect(() =>
      lintOwnerWriterDefinitionV1(
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
    ).toThrow(/slot\/process fence drift/);
    expect(() =>
      lintOwnerWriterDefinitionV1(
        TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        signature,
        body(`
          PERFORM 1 FROM trigger_processor.bots FOR UPDATE;
          PERFORM 1 FROM trigger_processor.bot_permission_bindings FOR UPDATE;
        `),
      ),
    ).toThrow(/slot\/process fence drift/);
    expect(() =>
      lintOwnerWriterDefinitionV1(
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
      lintOwnerWriterDefinitionV1(
        TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        signature,
        body(`
          PERFORM 1
            FROM trigger_processor.bot_foreground_slots slot
            JOIN trigger_processor.trigger_processes process
              ON process.id = slot.process_id
           WHERE slot.process_id IS DISTINCT FROM slot.process_id
           FOR UPDATE;
          IF NOT FOUND THEN
            RAISE EXCEPTION 'slot/process fence not found';
          END IF;
        `),
      ),
    ).toThrow(/unreachable relational proof|slot\/process fence drift/);
    expect(() =>
      lintOwnerWriterDefinitionV1(
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

    const callerFencedSignature = ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "test_caller_fenced_admission_v1",
      primary_table: "weak_trigger_queue_items",
      writer_kind: "state_transition",
      arguments: [
        ["p_scope", "jsonb"],
        ["p_admission_precondition", "jsonb"],
      ],
      reads_tables: ["bot_foreground_slots", "trigger_processes"],
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
    const callerFencedBody = (stateVersionField: string) => `
      CREATE FUNCTION trigger_processor.test_caller_fenced_admission_v1(
        p_scope jsonb,
        p_admission_precondition jsonb
      ) RETURNS jsonb LANGUAGE plpgsql AS $body$
      BEGIN
        PERFORM 1
          FROM trigger_processor.bot_foreground_slots slot
          JOIN trigger_processor.trigger_processes process
            ON process.id = slot.process_id
         WHERE slot.bot_id = p_scope->>'bot_id'
           AND p_admission_precondition->>'process_id' = process.id
           AND p_admission_precondition->>'slot_generation' = slot.generation::text
           AND p_admission_precondition->>'phase' = process.phase
           AND p_admission_precondition->>'status' = process.status
           AND p_admission_precondition->>'${stateVersionField}' = process.state_version::text
         FOR UPDATE;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'slot/process fence not found';
        END IF;
        INSERT INTO trigger_processor.weak_trigger_queue_items(id) VALUES ('id');
        RETURN '{}'::jsonb;
      END $body$`;
    expect(() =>
      lintOwnerWriterDefinitionV1(
        TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        callerFencedSignature,
        callerFencedBody("process_state_version"),
      ),
    ).not.toThrow();
    expect(() =>
      lintOwnerWriterDefinitionV1(
        TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        callerFencedSignature,
        callerFencedBody("process_updated_at"),
      ),
    ).toThrow(/slot\/process fence drift/);
  });

  it("requires candidate application baseline Catalog comparison under a locked current row", () => {
    const signature = ownerFunctionSignatureV1({
      schema: "skill_registry",
      function_name: "test_apply_candidate_v1",
      primary_table: "skill_candidate_applications",
      writer_kind: "state_transition",
      arguments: [
        ["p_application_id", "text"],
        ["p_workspace_id", "text"],
        ["p_bot_id", "text"],
        ["p_deployment_environment", "text"],
        ["p_release_channel", "text"],
        ["p_baseline_catalog_version", "text"],
        ["p_idempotency_key", "text"],
      ],
      reads_tables: [
        "skill_candidate_applications",
        "skill_catalog_current",
        "skill_catalog_revisions",
      ],
      writes_tables: ["skill_candidate_applications"],
      effects: [
        {
          table_name: "skill_candidate_applications",
          operation: "append",
          concurrency_control: "idempotency_key",
        },
        {
          table_name: "skill_candidate_applications",
          operation: "append",
          concurrency_control: "catalog_baseline_fence",
        },
      ],
      returns: "jsonb",
    });
    const lockedCatalogRead = `
        SELECT cr.catalog_version
          INTO v_current_catalog_version
          FROM skill_registry.skill_catalog_current cc
          JOIN skill_registry.skill_catalog_revisions cr
            ON cc.catalog_revision_id = cr.id
         WHERE cc.workspace_id = p_workspace_id
           AND cc.bot_id = p_bot_id
           AND cc.deployment_environment = p_deployment_environment
           AND cc.release_channel = p_release_channel
         FOR UPDATE OF cc;
        IF v_current_catalog_version IS DISTINCT FROM p_baseline_catalog_version THEN
          RAISE EXCEPTION 'catalog baseline conflict';
        END IF;`;
    const body = (proof: string) => `
      CREATE FUNCTION skill_registry.test_apply_candidate_v1(
        p_application_id text,
        p_workspace_id text,
        p_bot_id text,
        p_deployment_environment text,
        p_release_channel text,
        p_baseline_catalog_version text,
        p_idempotency_key text
      ) RETURNS jsonb LANGUAGE plpgsql AS $body$
      DECLARE
        v_current_catalog_version text;
      BEGIN
        ${proof}
        INSERT INTO skill_registry.skill_candidate_applications(
          id,
          idempotency_key
        ) VALUES (
          p_application_id,
          p_idempotency_key
        );
        RETURN '{}'::jsonb;
      END $body$`;

    expect(() =>
      lintOwnerWriterDefinitionV1(
        SKILL_REGISTRY_REPOSITORY_CONTRACT_V1,
        signature,
        body(lockedCatalogRead),
      ),
    ).not.toThrow();
    for (const invalidProof of [
      lockedCatalogRead.replace("FOR UPDATE OF cc", ""),
      lockedCatalogRead.replace(
        "cc.release_channel = p_release_channel",
        "cc.release_channel = 'stable'",
      ),
      lockedCatalogRead.replace(
        "cc.catalog_revision_id = cr.id",
        "cc.catalog_revision_id = cc.catalog_revision_id",
      ),
      lockedCatalogRead.replace(
        "v_current_catalog_version IS DISTINCT FROM p_baseline_catalog_version",
        "v_current_catalog_version IS NOT NULL",
      ),
    ]) {
      expect(() =>
        lintOwnerWriterDefinitionV1(
          SKILL_REGISTRY_REPOSITORY_CONTRACT_V1,
          signature,
          body(invalidProof),
        ),
      ).toThrow(/catalog baseline fence drift/u);
    }
    expect(() =>
      lintOwnerWriterDefinitionV1(
        SKILL_REGISTRY_REPOSITORY_CONTRACT_V1,
        signature,
        body(
          `${lockedCatalogRead.replace(
            /IF v_current_catalog_version[\s\S]*?END IF;/u,
            "",
          )}
           INSERT INTO skill_registry.skill_candidate_applications(
             id,
             idempotency_key
           ) VALUES (p_application_id, p_idempotency_key);
           IF v_current_catalog_version IS DISTINCT FROM p_baseline_catalog_version THEN
             RAISE EXCEPTION 'catalog baseline conflict';
           END IF;`,
        ),
      ),
    ).toThrow(/catalog baseline fence drift/u);
  });

  it("requires deployed Memory mutators to lock and reject exact active promotion targets before mutation", () => {
    const signature = ownerFunctionSignatureV1({
      schema: "memory",
      function_name: "test_transition_memory_series_v1",
      primary_table: "memory_series",
      writer_kind: "state_transition",
      arguments: [["p_series_id", "text"]],
      reads_tables: [
        "memory_series",
        "memory_promotion_reservations",
        "memory_promotion_reservation_targets",
      ],
      writes_tables: ["memory_series"],
      effects: [
        {
          table_name: "memory_series",
          operation: "transition",
          concurrency_control: "promotion_reservation_fence",
          promotion_reservation_targets: [
            {
              aggregate_type: "memory_series",
              id_argument: "p_series_id",
            },
          ],
        },
      ],
      returns: "jsonb",
    });
    const fence = `
        PERFORM 1
          FROM memory.memory_promotion_reservations pr
          JOIN memory.memory_promotion_reservation_targets pt
            ON pt.reservation_id = pr.id
         WHERE pr.status = 'active'
           AND pr.expires_at > clock_timestamp()
           AND pt.aggregate_type = 'memory_series'
           AND pt.aggregate_id = p_series_id
         FOR UPDATE OF pr;
        IF FOUND THEN
          RAISE EXCEPTION 'promotion_reserved';
        END IF;`;
    const body = (proof: string) => `
      CREATE FUNCTION memory.test_transition_memory_series_v1(
        p_series_id text
      ) RETURNS jsonb LANGUAGE plpgsql AS $body$
      BEGIN
        ${proof}
        UPDATE memory.memory_series
           SET updated_at = clock_timestamp()
         WHERE id = p_series_id;
        RETURN '{}'::jsonb;
      END $body$`;

    expect(() =>
      lintOwnerWriterDefinitionV1(
        MEMORY_REPOSITORY_CONTRACT_V1,
        signature,
        body(fence),
      ),
    ).not.toThrow();
    for (const invalidProof of [
      fence.replace("pr.status = 'active'", "pr.status = 'released'"),
      fence.replace(
        "pr.expires_at > clock_timestamp()",
        "pr.expires_at IS NOT NULL",
      ),
      fence.replace(
        "pt.aggregate_type = 'memory_series'",
        "pt.aggregate_type = 'memory_point'",
      ),
      fence.replace(
        "pt.aggregate_id = p_series_id",
        "pt.aggregate_id IS NOT NULL",
      ),
      fence.replace("FOR UPDATE OF pr", ""),
      fence.replace("RAISE EXCEPTION 'promotion_reserved';", "NULL;"),
    ]) {
      expect(() =>
        lintOwnerWriterDefinitionV1(
          MEMORY_REPOSITORY_CONTRACT_V1,
          signature,
          body(invalidProof),
        ),
      ).toThrow(/promotion reservation fence drift/u);
    }
  });

  it("fails closed when FK columns drift outside declared table columns", () => {
    expect(() =>
      defineOwnerRepositoryContractV1({
        ...KNOWTHAT_REPOSITORY_CONTRACT_V1,
        table_permissions:
          KNOWTHAT_REPOSITORY_CONTRACT_V1.table_permissions.map(
            (permission) =>
              permission.table_name === "semantic_key_aliases"
                ? {
                    ...permission,
                    select_columns: permission.select_columns.filter(
                      (column) => column !== "target_fact_id",
                    ),
                  }
                : permission,
          ),
        database_columns:
          KNOWTHAT_REPOSITORY_CONTRACT_V1.database_columns?.filter(
            ({ table_name, column_name }) =>
              table_name !== "semantic_key_aliases" ||
              column_name !== "target_fact_id",
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
      lintOwnerWriterDefinitionV1(
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
      lintOwnerWriterDefinitionV1(
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
      lintOwnerWriterDefinitionV1(
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
      lintOwnerWriterDefinitionV1(
        TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        transitionSignature,
        constantFalseProofBody,
      ),
    ).toThrow(/unreachable proof block/);

    const castedConstantFalseProofBody = constantFalseProofBody.replace(
      "IF 2 = 3 THEN",
      "IF 2::integer = 3::integer THEN",
    );
    expect(() =>
      lintOwnerWriterDefinitionV1(
        TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        transitionSignature,
        castedConstantFalseProofBody,
      ),
    ).toThrow(/unreachable proof block/);

    const nullProofBody = constantFalseProofBody.replace(
      "IF 2 = 3 THEN",
      "IF NULL THEN",
    );
    expect(() =>
      lintOwnerWriterDefinitionV1(
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
      lintOwnerWriterDefinitionV1(
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
      lintOwnerWriterDefinitionV1(
        TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        transitionSignature,
        coalesceOnlyProofBody,
      ),
    ).toThrow(/CAS fence drift/);

    const localConstantProofBody = partialExpectedBody.replace(
      "BEGIN",
      "DECLARE v_observed_status text;\n      BEGIN",
    ).replace(
      "RETURN '{}'::jsonb;",
      `v_observed_status := 'running';
       PERFORM p_expected_status = v_observed_status;
       RETURN '{}'::jsonb;`,
    );
    expect(() =>
      lintOwnerWriterDefinitionV1(
        TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        transitionSignature,
        localConstantProofBody,
      ),
    ).toThrow(/CAS fence drift/);

    const selfDistinctPredicateBody = partialExpectedBody.replace(
      "AND p.phase = p_expected_phase;",
      `AND p.phase = p_expected_phase
           AND p.status = p_expected_status
           AND p.status IS DISTINCT FROM p.status;`,
    );
    expect(() =>
      lintOwnerWriterDefinitionV1(
        TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        transitionSignature,
        selfDistinctPredicateBody,
      ),
    ).toThrow(/unreachable relational proof|CAS fence drift/);

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
      lintOwnerWriterDefinitionV1(
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
    ).toThrow(
      /arguments must contain unique SQL identifiers|must declare one canonical idempotent resolve writer/,
    );

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

    expect(() =>
      defineOwnerRepositoryContractV1({
        ...ACTION_RUNTIME_REPOSITORY_CONTRACT_V1,
        function_signatures:
          ACTION_RUNTIME_REPOSITORY_CONTRACT_V1.function_signatures.map(
            (signature) =>
              signature.function_name === "claim_runtime_event_outbox_v1"
                ? {
                    ...signature,
                    reads_tables: signature.reads_tables.filter(
                      (table) =>
                        table !== OWNER_EVENTING_TRANSPORT_EPOCH_TABLE_V1,
                    ),
                  }
                : signature,
          ),
      } as never),
    ).toThrow(/active eventing transport epoch/);
  });

  it("requires batched state-table claims to declare a bounded SKIP LOCKED contract", () => {
    const claim =
      ACTION_RUNTIME_REPOSITORY_CONTRACT_V1.function_signatures.find(
        ({ function_name }) =>
          function_name ===
          "claim_runtime_artifact_reconciliation_v1",
      );
    expect(claim).toBeDefined();
    expect(claim?.effects).toEqual([
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
    expect(() =>
      defineOwnerRepositoryContractV1({
        ...ACTION_RUNTIME_REPOSITORY_CONTRACT_V1,
        function_signatures:
          ACTION_RUNTIME_REPOSITORY_CONTRACT_V1.function_signatures.map(
            (signature) =>
              signature.function_name ===
              "claim_runtime_artifact_reconciliation_v1"
                ? {
                    ...signature,
                    effects: signature.effects.map(
                      ({
                        claim_locking: _claimLocking,
                        claim_fence: _claimFence,
                        claim_authority: _claimAuthority,
                        ...effect
                      }) => effect,
                    ),
                  }
                : signature,
          ),
      } as never),
    ).toThrow(/semantic effect/u);

    expect(() =>
      defineOwnerRepositoryContractV1({
        ...ACTION_RUNTIME_REPOSITORY_CONTRACT_V1,
        function_signatures:
          ACTION_RUNTIME_REPOSITORY_CONTRACT_V1.function_signatures.map(
            (signature) =>
              signature.function_name ===
              "claim_runtime_artifact_reconciliation_v1"
                ? {
                    ...signature,
                    effects: signature.effects.map((effect) => ({
                      ...effect,
                      claim_fence:
                        effect.claim_fence === undefined
                          ? undefined
                          : {
                              ...effect.claim_fence,
                              generation_column: "created_at",
                            },
                    })),
                  }
                : signature,
          ),
      } as never),
    ).toThrow(/semantic effect/u);
  });

  it("lints the exact batched artifact claim fence instead of accepting a table scan label", () => {
    const claim =
      ACTION_RUNTIME_REPOSITORY_CONTRACT_V1.function_signatures.find(
        ({ function_name }) =>
          function_name ===
          "claim_runtime_artifact_reconciliation_v1",
      );
    expect(claim).toBeDefined();
    if (claim === undefined) return;
    const trustedBody = `
      CREATE FUNCTION action_runtime.claim_runtime_artifact_reconciliation_v1(
        p_worker_id text,
        p_limit integer,
        p_lease_seconds integer,
        p_now timestamptz
      ) RETURNS SETOF jsonb
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = action_runtime, pg_temp
      AS $body$
      BEGIN
        RETURN QUERY
          WITH claim_candidates AS (
            SELECT artifact.id
              FROM action_runtime.runtime_artifacts AS artifact
              JOIN action_runtime.runtime_runs AS runtime_run
                ON runtime_run.id = artifact.runtime_run_id
             WHERE artifact.status = 'creating'
               AND (
                 artifact.reconciliation_expires_at IS NULL
                 OR artifact.reconciliation_expires_at
                      <= pg_catalog.clock_timestamp()
               )
               AND NOT EXISTS (
                 SELECT 1
                   FROM action_runtime.runtime_run_leases AS active_lease
                  WHERE active_lease.runtime_run_id =
                        artifact.runtime_run_id
                    AND active_lease.lease_generation =
                        artifact.originating_lease_generation
                    AND active_lease.recovery_state = 'active'
                    AND active_lease.lease_expires_at >
                        pg_catalog.clock_timestamp()
               )
             ORDER BY
               artifact.reconciliation_expires_at NULLS FIRST,
               artifact.created_at,
               artifact.id
             FOR UPDATE SKIP LOCKED
             LIMIT p_limit
          )
          UPDATE action_runtime.runtime_artifacts AS artifact
             SET reconciliation_owner = p_worker_id,
                 reconciliation_expires_at =
                   pg_catalog.clock_timestamp()
                   + pg_catalog.make_interval(secs => p_lease_seconds),
                 reconciliation_generation =
                   artifact.reconciliation_generation + 1
            FROM claim_candidates
           WHERE artifact.id = claim_candidates.id
           RETURNING to_jsonb(artifact);
      END
      $body$`;

    expect(() =>
      lintOwnerWriterDefinitionV1(
        ACTION_RUNTIME_REPOSITORY_CONTRACT_V1,
        claim,
        trustedBody,
      ),
    ).not.toThrow();
    for (const driftedDefinition of [
      trustedBody.replaceAll(
        "pg_catalog.clock_timestamp()",
        "p_now",
      ),
      trustedBody.replace(
        "artifact.reconciliation_generation + 1",
        "artifact.reconciliation_generation",
      ),
      trustedBody.replace(
        "artifact.status = 'creating'",
        "artifact.status = 'available'",
      ),
      trustedBody.replace(
        "artifact.id = claim_candidates.id",
        "artifact.id = artifact.id",
      ),
      trustedBody.replace(
        "active_lease.recovery_state = 'active'",
        "active_lease.recovery_state = 'takeover_pending'",
      ),
    ]) {
      expect(() =>
        lintOwnerWriterDefinitionV1(
          ACTION_RUNTIME_REPOSITORY_CONTRACT_V1,
          claim,
          driftedDefinition,
        ),
      ).toThrow(/claim fence drift/u);
    }
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
