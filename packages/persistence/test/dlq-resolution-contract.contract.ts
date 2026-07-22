import { describe, expect, it } from "vitest";

import {
  defineOwnerRepositoryContractV1,
  ownerDlqResolutionContractV1,
  ownerFunctionSignatureV1,
  verifyOwnerRepositoryDeploymentFromPostgresV1,
} from "../src/index.js";

const DLQ_TABLE = "contract_event_dlq" as const;
const resolution = ownerDlqResolutionContractV1("timer", DLQ_TABLE);

const RECORD_DLQ_SIGNATURE = ownerFunctionSignatureV1({
  schema: "timer",
  function_name: "record_contract_event_dlq_v1",
  primary_table: DLQ_TABLE,
  writer_kind: "immutable_append",
  arguments: [
    ["p_dlq_id", "text"],
    ["p_payload", "jsonb"],
    ["p_idempotency_key", "text"],
    ["p_failed_at", "timestamptz"],
  ],
  reads_tables: [DLQ_TABLE],
  writes_tables: [DLQ_TABLE],
  effects: [
    {
      table_name: DLQ_TABLE,
      operation: "append",
      concurrency_control: "idempotency_key",
    },
  ],
  returns: "jsonb",
});

function completeContractInput() {
  return {
    contract_version: "owner_repository_contract.v1",
    owner_service: "timer_trigger_app",
    schema: "timer",
    app_role: "pai_timer_app",
    fresh_migrations: ["0300_timer"],
    manifest_source:
      "services/timer-trigger-app/src/db/permission-manifest.v1.ts",
    generated_permission_sql: [
      "pai-infra/supabase/generated/permissions/0300_timer.sql",
    ],
    tables: [DLQ_TABLE, resolution.resolution_table],
    table_permissions: [
      {
        table_name: DLQ_TABLE,
        select_columns: ["id", "payload", "failed_at"],
        insert_columns: [],
        update_columns: [],
        delete_allowed: false,
        writer_kind: "immutable_append",
      },
      resolution.table_permission,
    ],
    mutable_writers: [
      "record_contract_event_dlq_v1",
      ...resolution.mutable_writers,
    ],
    function_signatures: [
      RECORD_DLQ_SIGNATURE,
      ...resolution.function_signatures,
    ],
    foreign_key_snapshot: {
      status: "complete",
      source: "synthetic canonical DLQ resolution fixture",
    },
    foreign_keys: [...resolution.foreign_keys],
    database_checks: [],
    database_columns: [
      {
        table_name: DLQ_TABLE,
        column_name: "id",
        postgres_type: "text",
        not_null: true,
        default_expression: null,
        identity: "",
        generated: "",
      },
      {
        table_name: DLQ_TABLE,
        column_name: "payload",
        postgres_type: "jsonb",
        not_null: true,
        default_expression: null,
        identity: "",
        generated: "",
      },
      {
        table_name: DLQ_TABLE,
        column_name: "failed_at",
        postgres_type: "timestamp with time zone",
        not_null: true,
        default_expression: null,
        identity: "",
        generated: "",
      },
      ...resolution.database_columns,
    ],
    database_unique_constraints: [
      {
        constraint_name: "contract_event_dlq_pkey",
        table_name: DLQ_TABLE,
        columns: ["id"],
        kind: "primary_key",
        deferrable: false,
        initially_deferred: false,
        validated: true,
      },
      ...resolution.database_unique_constraints,
    ],
    database_indexes: [
      {
        index_name: "contract_event_dlq_pkey",
        table_name: DLQ_TABLE,
        definition:
          "CREATE UNIQUE INDEX contract_event_dlq_pkey ON timer.contract_event_dlq USING btree (id)",
        unique: true,
        primary: true,
        valid: true,
      },
      ...resolution.database_indexes,
    ],
    append_only_tables: [DLQ_TABLE, resolution.resolution_table],
    outbox_tables: [],
    inbox_tables: [],
    dlq_tables: [DLQ_TABLE],
    dlq_resolutions: [resolution.binding],
    object_metadata_tables: [],
  } as const;
}

describe("canonical immutable DLQ resolution", () => {
  it("builds one append-only resolution fact with a complete fence", () => {
    expect(resolution.binding).toEqual({
      dlq_table: DLQ_TABLE,
      resolution_table: "contract_event_dlq_resolutions",
      resolve_writer: "resolve_contract_event_dlq_v1",
    });
    expect(
      resolution.database_columns.map(({ column_name }) => column_name),
    ).toEqual([
      "resolution_id",
      "dlq_id",
      "idempotency_key",
      "resolution_kind",
      "resolution_payload",
      "resolved_by",
      "resolved_at",
    ]);
    expect(resolution.foreign_keys[0]).toMatchObject({
      columns: ["dlq_id"],
      referenced_table: DLQ_TABLE,
      referenced_columns: ["id"],
      on_delete: "no_action",
    });
    expect(resolution.database_unique_constraints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          columns: ["resolution_id"],
          kind: "primary_key",
        }),
        expect.objectContaining({ columns: ["dlq_id"], kind: "unique" }),
        expect.objectContaining({
          columns: ["idempotency_key"],
          kind: "unique",
        }),
      ]),
    );
    expect(resolution.function_signatures[0]).toMatchObject({
      function_name: "resolve_contract_event_dlq_v1",
      writer_kind: "immutable_append",
      reads_tables: [DLQ_TABLE, "contract_event_dlq_resolutions"],
      writes_tables: ["contract_event_dlq_resolutions"],
      effects: [
        {
          table_name: "contract_event_dlq_resolutions",
          operation: "append",
          concurrency_control: "idempotency_key",
        },
      ],
    });
    expect(() =>
      defineOwnerRepositoryContractV1(completeContractInput()),
    ).not.toThrow();
  });

  it("rejects missing, partial, or mutable resolution mappings", () => {
    const withoutMapping = completeContractInput();
    const { dlq_resolutions: _mapping, ...unmapped } = withoutMapping;
    expect(() =>
      defineOwnerRepositoryContractV1(unmapped as never),
    ).not.toThrow();
    expect(() =>
      defineOwnerRepositoryContractV1({
        ...completeContractInput(),
        dlq_resolutions: [],
      } as never),
    ).toThrow(/must cover every DLQ exactly once/u);

    const mutableHistory = completeContractInput();
    expect(() =>
      defineOwnerRepositoryContractV1({
        ...mutableHistory,
        table_permissions: mutableHistory.table_permissions.map((permission) =>
          permission.table_name === DLQ_TABLE
            ? {
                ...permission,
                select_columns: [...permission.select_columns, "resolved_at"],
              }
            : permission,
        ),
        database_columns: [
          ...mutableHistory.database_columns,
          {
            table_name: DLQ_TABLE,
            column_name: "resolved_at",
            postgres_type: "timestamp with time zone",
            not_null: false,
            default_expression: null,
            identity: "",
            generated: "",
          },
        ],
      } as never),
    ).toThrow(/cannot mutate resolved_at on immutable DLQ history/u);

    const mutableResolution = completeContractInput();
    expect(() =>
      defineOwnerRepositoryContractV1({
        ...mutableResolution,
        append_only_tables: [DLQ_TABLE],
      } as never),
    ).toThrow(/separate immutable canonical resolution table/u);
    void _mapping;
  });

  it("rejects FK, uniqueness, index, and resolve-writer drift", () => {
    const wrongForeignKey = completeContractInput();
    expect(() =>
      defineOwnerRepositoryContractV1({
        ...wrongForeignKey,
        foreign_keys: wrongForeignKey.foreign_keys.map((foreignKey) => ({
          ...foreignKey,
          on_delete: "cascade" as const,
        })),
      } as never),
    ).toThrow(/resolution foreign key/u);

    const missingUnique = completeContractInput();
    expect(() =>
      defineOwnerRepositoryContractV1({
        ...missingUnique,
        database_unique_constraints:
          missingUnique.database_unique_constraints.filter(
            ({ columns }) => columns[0] !== "dlq_id",
          ),
      } as never),
    ).toThrow(/resolution uniqueness/u);

    const missingIndex = completeContractInput();
    expect(() =>
      defineOwnerRepositoryContractV1({
        ...missingIndex,
        database_indexes: missingIndex.database_indexes.filter(
          ({ index_name }) => !index_name.endsWith("_idempotency_key_key"),
        ),
      } as never),
    ).toThrow(/resolution indexes/u);

    const weakWriter = completeContractInput();
    expect(() =>
      defineOwnerRepositoryContractV1({
        ...weakWriter,
        function_signatures: weakWriter.function_signatures.map((signature) =>
          signature.function_name === resolution.binding.resolve_writer
            ? {
                ...signature,
                arguments: signature.arguments.filter(
                  ({ argument_name }) =>
                    argument_name !== "p_idempotency_key",
                ),
              }
            : signature,
        ),
      } as never),
    ).toThrow(/canonical idempotent resolve writer/u);
  });

  it("cannot mint a live verified token while production is not opted in", async () => {
    const { dlq_resolutions: _mapping, ...unmapped } = completeContractInput();
    const queries: string[] = [];
    const postgres = {
      async query<TRow extends Record<string, unknown>>(sql: string) {
        queries.push(sql);
        return { rows: [] as TRow[] };
      },
    };
    await expect(
      verifyOwnerRepositoryDeploymentFromPostgresV1(
        defineOwnerRepositoryContractV1(unmapped as never),
        postgres,
        {
          expected_schema_owner: "pai_migrator",
          runtime_postgres: postgres,
        },
      ),
    ).rejects.toThrow(/canonical immutable DLQ resolution mapping is required/u);
    expect(queries).toEqual([]);
    void _mapping;
  });
});
