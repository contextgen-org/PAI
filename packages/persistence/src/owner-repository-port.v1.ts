import { createHash, randomUUID } from "node:crypto";

import type { ServiceIdV1 } from "@pai/contracts";
import { Pool, type PoolClient } from "pg";

export const OWNER_DATABASE_TARGETS_V1 = {
  trigger_processor: {
    schema: "trigger_processor",
    app_role: "pai_trigger_processor_app",
  },
  action_runtime: {
    schema: "action_runtime",
    app_role: "pai_action_runtime_app",
  },
  timer_trigger_app: { schema: "timer", app_role: "pai_timer_app" },
  meta_cognition: {
    schema: "meta_cognition",
    app_role: "pai_meta_cognition_app",
  },
  skill_registry: {
    schema: "skill_registry",
    app_role: "pai_skill_registry_app",
  },
  knowthat: { schema: "knowthat", app_role: "pai_knowthat_app" },
  memory: { schema: "memory", app_role: "pai_memory_app" },
} as const;

export type OwnerDatabaseServiceIdV1 = keyof typeof OWNER_DATABASE_TARGETS_V1;
export type OwnerSchemaV1 =
  (typeof OWNER_DATABASE_TARGETS_V1)[OwnerDatabaseServiceIdV1]["schema"];

export type OwnerWriterKindV1 =
  | "immutable_append"
  | "projection_upsert"
  | "state_transition"
  | "pointer_cas"
  | "lease_fence"
  | "queue_claim_ack"
  | "outbox_claim_ack";

export interface OwnerTablePermissionV1<TTable extends string = string> {
  readonly table_name: TTable;
  readonly select_columns: readonly string[];
  readonly insert_columns: readonly [];
  readonly update_columns: readonly [];
  readonly delete_allowed: false;
  readonly writer_kind: OwnerWriterKindV1;
}

export type OwnerPostgresTypeV1 =
  | "text"
  | "bigint"
  | "integer"
  | "boolean"
  | "jsonb"
  | "timestamptz";

export interface OwnerFunctionArgumentV1 {
  readonly argument_name: string;
  readonly postgres_type: OwnerPostgresTypeV1;
  readonly mode: "in";
}

export interface OwnerFunctionEffectV1<TTable extends string = string> {
  readonly table_name: TTable;
  readonly operation:
    | "append"
    | "upsert"
    | "transition"
    | "cas"
    | "enqueue"
    | "claim"
    | "ack";
  readonly concurrency_control:
    | "idempotency_key"
    | "expected_state_version"
    | "expected_version"
    | "generation_fence"
    | "slot_and_process_state_fence"
    | "lease_fence";
}

export interface OwnerFunctionSignatureV1<
  TSchema extends string = string,
  TTable extends string = string,
  TWriter extends string = string,
  TArguments extends readonly OwnerFunctionArgumentV1[] = readonly OwnerFunctionArgumentV1[],
> {
  readonly schema: TSchema;
  readonly function_name: TWriter;
  readonly primary_table: TTable;
  readonly writer_kind: OwnerWriterKindV1;
  readonly arguments: TArguments;
  readonly reads_tables: readonly TTable[];
  readonly writes_tables: readonly TTable[];
  readonly effects: readonly OwnerFunctionEffectV1<TTable>[];
  readonly returns: "jsonb" | "setof jsonb";
  readonly security_definer: true;
  readonly search_path: readonly [TSchema, "pg_temp"];
}

export interface OwnerForeignKeyV1<TTable extends string = string> {
  readonly constraint_name: string;
  readonly table_name: TTable;
  readonly columns: readonly string[];
  readonly referenced_schema: string;
  readonly referenced_table: TTable;
  readonly referenced_columns: readonly string[];
  readonly match_type: "simple" | "full" | "partial";
  readonly on_update:
    | "no_action"
    | "restrict"
    | "cascade"
    | "set_null"
    | "set_default";
  readonly on_delete:
    | "no_action"
    | "restrict"
    | "cascade"
    | "set_null"
    | "set_default";
  readonly deferrable: boolean;
  readonly initially_deferred: boolean;
  readonly validated: boolean;
}

export interface OwnerDatabaseCheckV1<TTable extends string = string> {
  readonly constraint_name: string;
  readonly table_name: TTable;
  readonly required_definition_fragments: readonly string[];
}

export interface OwnerDatabaseColumnV1<TTable extends string = string> {
  readonly table_name: TTable;
  readonly column_name: string;
  readonly postgres_type: string;
  readonly not_null: boolean;
  readonly default_expression: string | null;
  readonly identity: "" | "always" | "by_default";
  readonly generated: "" | "stored";
}

export interface OwnerDatabaseUniqueConstraintV1<TTable extends string = string> {
  readonly constraint_name: string;
  readonly table_name: TTable;
  readonly columns: readonly string[];
  readonly kind: "primary_key" | "unique";
  readonly deferrable: boolean;
  readonly initially_deferred: boolean;
  readonly validated: boolean;
}

export function ownerForeignKeyV1<
  const TSchema extends OwnerSchemaV1,
  const TTable extends string,
>(input: Readonly<{
  schema: TSchema;
  constraint_name: string;
  table_name: TTable;
  columns: readonly string[];
  referenced_table: TTable;
  referenced_columns: readonly string[];
  match_type?: OwnerForeignKeyV1["match_type"];
  on_update?: OwnerForeignKeyV1["on_update"];
  on_delete?: OwnerForeignKeyV1["on_delete"];
  deferrable?: boolean;
  initially_deferred?: boolean;
  validated?: boolean;
}>): OwnerForeignKeyV1<TTable> {
  return Object.freeze({
    constraint_name: input.constraint_name,
    table_name: input.table_name,
    columns: Object.freeze([...input.columns]),
    referenced_schema: input.schema,
    referenced_table: input.referenced_table,
    referenced_columns: Object.freeze([...input.referenced_columns]),
    match_type: input.match_type ?? "simple",
    on_update: input.on_update ?? "no_action",
    on_delete: input.on_delete ?? "no_action",
    deferrable: input.deferrable ?? false,
    initially_deferred: input.initially_deferred ?? false,
    validated: input.validated ?? true,
  });
}

export type OwnerForeignKeyTupleV1<TTable extends string = string> = readonly [
  constraint_name: string,
  table_name: TTable,
  columns: readonly string[],
  referenced_table: TTable,
  referenced_columns: readonly string[],
  overrides?: Readonly<
    Partial<
      Pick<
        OwnerForeignKeyV1,
        | "match_type"
        | "on_update"
        | "on_delete"
        | "deferrable"
        | "initially_deferred"
        | "validated"
      >
    >
  >,
];

export function ownerForeignKeysV1<
  const TSchema extends OwnerSchemaV1,
  const TTable extends string,
>(
  schema: TSchema,
  entries: readonly OwnerForeignKeyTupleV1<TTable>[],
): readonly OwnerForeignKeyV1<TTable>[] {
  return Object.freeze(
    entries.map(
      ([
        constraint_name,
        table_name,
        columns,
        referenced_table,
        referenced_columns,
        overrides = {},
      ]) =>
        ownerForeignKeyV1({
          schema,
          constraint_name,
          table_name,
          columns,
          referenced_table,
          referenced_columns,
          ...overrides,
        }),
    ),
  );
}

export type OwnerForeignKeySnapshotV1 =
  | Readonly<{
      status: "complete";
      source: string;
    }>
  | Readonly<{
      status: "known_empty";
      source: string;
      justification: string;
    }>
  | Readonly<{
      status: "pending";
      reason: string;
    }>;

export interface OwnerRepositoryContractV1<
  TService extends OwnerDatabaseServiceIdV1 = OwnerDatabaseServiceIdV1,
  TTable extends string = string,
  TWriter extends string = string,
  TSignatures extends readonly OwnerFunctionSignatureV1<
    (typeof OWNER_DATABASE_TARGETS_V1)[TService]["schema"],
    TTable,
    TWriter
  >[] = readonly OwnerFunctionSignatureV1<
    (typeof OWNER_DATABASE_TARGETS_V1)[TService]["schema"],
    TTable,
    TWriter
  >[],
> {
  readonly contract_version: "owner_repository_contract.v1";
  readonly owner_service: TService;
  readonly schema: (typeof OWNER_DATABASE_TARGETS_V1)[TService]["schema"];
  readonly app_role: (typeof OWNER_DATABASE_TARGETS_V1)[TService]["app_role"];
  readonly fresh_migrations: readonly string[];
  readonly manifest_source: string;
  readonly generated_permission_sql: readonly string[];
  readonly tables: readonly TTable[];
  readonly table_permissions: readonly OwnerTablePermissionV1<TTable>[];
  readonly mutable_writers: readonly TWriter[];
  readonly function_signatures: TSignatures;
  readonly foreign_key_snapshot: OwnerForeignKeySnapshotV1;
  readonly foreign_keys: readonly OwnerForeignKeyV1<TTable>[];
  readonly database_checks?: readonly OwnerDatabaseCheckV1<TTable>[];
  readonly database_columns?: readonly OwnerDatabaseColumnV1<TTable>[];
  readonly database_unique_constraints?: readonly OwnerDatabaseUniqueConstraintV1<TTable>[];
  readonly append_only_tables: readonly TTable[];
  readonly outbox_tables: readonly TTable[];
  readonly inbox_tables: readonly TTable[];
  readonly dlq_tables: readonly TTable[];
  readonly object_metadata_tables: readonly TTable[];
}

const sqlIdentifierPattern = /^[a-z][a-z0-9_]*$/;
const sourcePattern = /^(?:services|packages)\/[a-z0-9-]+\/src\/.+\.ts$/;
const migrationPattern = /^\d{4}(?:\/\d{4})?_[a-z0-9_]+$/;
const generatedPermissionPattern =
  /^pai-infra\/supabase\/generated\/permissions\/\d{4}_[a-z0-9_]+\.sql$/;

function assertUniqueIdentifiers(label: string, values: readonly string[]): void {
  if (
    new Set(values).size !== values.length ||
    values.some((value) => !sqlIdentifierPattern.test(value))
  ) {
    throw new Error(`${label} must contain unique SQL identifiers`);
  }
}

const writerKinds = new Set<OwnerWriterKindV1>([
  "immutable_append",
  "projection_upsert",
  "state_transition",
  "pointer_cas",
  "lease_fence",
  "queue_claim_ack",
  "outbox_claim_ack",
]);
const effectOperations = new Set<OwnerFunctionEffectV1["operation"]>([
  "append", "upsert", "transition", "cas", "enqueue", "claim", "ack",
]);
const concurrencyControls = new Set<
  OwnerFunctionEffectV1["concurrency_control"]
>([
  "idempotency_key",
  "expected_state_version",
  "expected_version",
  "generation_fence",
  "slot_and_process_state_fence",
  "lease_fence",
]);

const operationsByWriterKind: Readonly<
  Record<OwnerWriterKindV1, ReadonlySet<OwnerFunctionEffectV1["operation"]>>
> = {
  immutable_append: new Set(["append"]),
  projection_upsert: new Set(["upsert"]),
  state_transition: new Set(["append", "enqueue", "transition"]),
  pointer_cas: new Set(["cas"]),
  lease_fence: new Set(["cas", "claim", "ack", "transition"]),
  queue_claim_ack: new Set(["enqueue", "claim", "ack", "transition"]),
  outbox_claim_ack: new Set(["enqueue", "claim", "ack"]),
};

function hasConcurrencyArgument(
  signature: OwnerFunctionSignatureV1,
  control: OwnerFunctionEffectV1["concurrency_control"],
): boolean {
  const names = signature.arguments.map(({ argument_name }) => argument_name);
  if (control === "slot_and_process_state_fence") {
    return (
      names.includes("p_admission_precondition") ||
      names.includes("p_admission_request")
    );
  }
  if (control === "generation_fence") {
    return names.some(
      (name) =>
        name.startsWith("p_expected_") &&
        (name.includes("generation") ||
          name.includes("fence") ||
          name.includes("process_id")),
    );
  }
  if (control === "lease_fence") {
    return (
      names.includes("p_claim_token") ||
      (names.includes("p_worker_id") && names.includes("p_lease_seconds"))
    );
  }
  if (control === "expected_state_version" || control === "expected_version") {
    return names.some((name) => name.startsWith("p_expected_"));
  }
  return (
    names.includes("p_idempotency_key") ||
    names.includes("p_request_hash") ||
    names.includes("p_claim_token") ||
    names.includes("p_lock_token") ||
    names.some((name) => /^p_[a-z0-9_]+_id$/.test(name))
  );
}

type OwnerFunctionArgumentsFromTuplesV1<
  TArguments extends readonly (
    readonly [argument_name: string, postgres_type: OwnerPostgresTypeV1]
  )[],
> = {
  readonly [TIndex in keyof TArguments]: TArguments[TIndex] extends readonly [
    infer TName extends string,
    infer TType extends OwnerPostgresTypeV1,
  ]
    ? Readonly<{
        argument_name: TName;
        postgres_type: TType;
        mode: "in";
      }>
    : never;
};

export function ownerFunctionSignatureV1<
  const TSchema extends OwnerSchemaV1,
  const TTable extends string,
  const TWriter extends string,
  const TArguments extends readonly (
    readonly [argument_name: string, postgres_type: OwnerPostgresTypeV1]
  )[],
>(input: {
  readonly schema: TSchema;
  readonly function_name: TWriter;
  readonly primary_table: TTable;
  readonly writer_kind: OwnerWriterKindV1;
  readonly arguments: TArguments;
  readonly reads_tables: readonly TTable[];
  readonly writes_tables: readonly TTable[];
  readonly effects: readonly OwnerFunctionEffectV1<TTable>[];
  readonly returns: "jsonb" | "setof jsonb";
}): OwnerFunctionSignatureV1<
  TSchema,
  TTable,
  TWriter,
  OwnerFunctionArgumentsFromTuplesV1<TArguments>
> {
  const signature = {
    schema: input.schema,
    function_name: input.function_name,
    primary_table: input.primary_table,
    writer_kind: input.writer_kind,
    arguments: input.arguments.map(([argument_name, postgres_type]) =>
      Object.freeze({
        argument_name,
        postgres_type,
        mode: "in" as const,
      }),
    ),
    reads_tables: [...input.reads_tables],
    writes_tables: [...input.writes_tables],
    effects: [...input.effects],
    returns: input.returns,
    security_definer: true,
    search_path: [input.schema, "pg_temp"],
  } as unknown as OwnerFunctionSignatureV1<
    TSchema,
    TTable,
    TWriter,
    OwnerFunctionArgumentsFromTuplesV1<TArguments>
  >;
  Object.freeze(signature.arguments);
  Object.freeze(signature.reads_tables);
  Object.freeze(signature.writes_tables);
  for (const effect of signature.effects) Object.freeze(effect);
  Object.freeze(signature.effects);
  Object.freeze(signature.search_path);
  return Object.freeze(signature);
}

export function defineOwnerRepositoryContractV1<
  const TService extends OwnerDatabaseServiceIdV1,
  const TTable extends string,
  const TWriter extends string,
  const TSignatures extends readonly OwnerFunctionSignatureV1<
    (typeof OWNER_DATABASE_TARGETS_V1)[TService]["schema"],
    TTable,
    TWriter
  >[],
>(
  contract: OwnerRepositoryContractV1<TService, TTable, TWriter, TSignatures>,
): OwnerRepositoryContractV1<TService, TTable, TWriter, TSignatures> {
  const target = OWNER_DATABASE_TARGETS_V1[contract.owner_service];
  if (contract.schema !== target.schema || contract.app_role !== target.app_role) {
    throw new Error(`owner database target drift for ${contract.owner_service}`);
  }
  if (!sourcePattern.test(contract.manifest_source)) {
    throw new Error(`invalid manifest source: ${contract.manifest_source}`);
  }
  if (
    contract.fresh_migrations.length === 0 ||
    contract.fresh_migrations.some((value) => !migrationPattern.test(value))
  ) {
    throw new Error(`invalid fresh migration list for ${contract.owner_service}`);
  }
  if (
    contract.generated_permission_sql.length === 0 ||
    new Set(contract.generated_permission_sql).size !==
      contract.generated_permission_sql.length ||
    contract.generated_permission_sql.some(
      (value) => !generatedPermissionPattern.test(value),
    )
  ) {
    throw new Error(
      `invalid generated permission SQL for ${contract.owner_service}`,
    );
  }
  assertUniqueIdentifiers("tables", contract.tables);
  assertUniqueIdentifiers("mutable_writers", contract.mutable_writers);
  assertUniqueIdentifiers("append_only_tables", contract.append_only_tables);
  const tableSet = new Set<string>(contract.tables);
  if (
    contract.table_permissions.length !== contract.tables.length ||
    new Set(contract.table_permissions.map(({ table_name }) => table_name)).size !==
      contract.tables.length ||
    contract.table_permissions.some(
      (permission) => !tableSet.has(permission.table_name),
    )
  ) {
    throw new Error(
      `table_permissions must cover every ${contract.owner_service} table exactly once`,
    );
  }
  for (const permission of contract.table_permissions) {
    assertUniqueIdentifiers(
      `${permission.table_name}.select_columns`,
      permission.select_columns,
    );
    if (
      permission.insert_columns.length !== 0 ||
      permission.update_columns.length !== 0 ||
      permission.delete_allowed !== false ||
      !writerKinds.has(permission.writer_kind)
    ) {
      throw new Error(
        `${permission.table_name} must use writer-only V1 permissions and one writer kind`,
      );
    }
  }
  const selectColumnsByTable = new Map(
    contract.table_permissions.map(({ table_name, select_columns }) => [
      table_name,
      new Set<string>(select_columns),
    ]),
  );
  assertUniqueIdentifiers(
    "foreign_keys.constraint_name",
    (contract.foreign_keys ?? []).map(({ constraint_name }) => constraint_name),
  );
  if (
    (contract.foreign_key_snapshot.status === "complete" &&
      contract.foreign_keys.length === 0) ||
    (contract.foreign_key_snapshot.status === "known_empty" &&
      (contract.foreign_keys.length !== 0 ||
        contract.foreign_key_snapshot.justification.trim().length === 0)) ||
    (contract.foreign_key_snapshot.status === "pending" &&
      (contract.foreign_keys.length !== 0 ||
        contract.foreign_key_snapshot.reason.trim().length === 0)) ||
    (contract.foreign_key_snapshot.status !== "pending" &&
      contract.foreign_key_snapshot.source.trim().length === 0)
  ) {
    throw new Error(
      `invalid foreign-key snapshot state for ${contract.owner_service}`,
    );
  }
  Object.freeze(contract.foreign_key_snapshot);
  for (const foreignKey of contract.foreign_keys ?? []) {
    const sourceColumns = selectColumnsByTable.get(foreignKey.table_name);
    const referencedColumns = selectColumnsByTable.get(
      foreignKey.referenced_table,
    );
    assertUniqueIdentifiers(
      `${foreignKey.constraint_name}.columns`,
      foreignKey.columns,
    );
    assertUniqueIdentifiers(
      `${foreignKey.constraint_name}.referenced_columns`,
      foreignKey.referenced_columns,
    );
    if (
      !tableSet.has(foreignKey.table_name) ||
      foreignKey.referenced_schema !== contract.schema ||
      !tableSet.has(foreignKey.referenced_table) ||
      foreignKey.columns.length === 0 ||
      foreignKey.columns.length !== foreignKey.referenced_columns.length ||
      foreignKey.columns.some((column) => !sourceColumns?.has(column)) ||
      foreignKey.referenced_columns.some(
        (column) => !referencedColumns?.has(column),
      ) ||
      foreignKey.match_type === "partial" ||
      foreignKey.initially_deferred && !foreignKey.deferrable ||
      !foreignKey.validated
    ) {
      throw new Error(`invalid owner foreign key: ${foreignKey.constraint_name}`);
    }
    Object.freeze(foreignKey.columns);
    Object.freeze(foreignKey.referenced_columns);
    Object.freeze(foreignKey);
  }
  assertUniqueIdentifiers(
    "database_checks.constraint_name",
    (contract.database_checks ?? []).map(({ constraint_name }) => constraint_name),
  );
  for (const check of contract.database_checks ?? []) {
    if (
      !tableSet.has(check.table_name) ||
      check.required_definition_fragments.length === 0 ||
      check.required_definition_fragments.some((fragment) => fragment.length === 0)
    ) {
      throw new Error(`invalid owner database check: ${check.constraint_name}`);
    }
    Object.freeze(check.required_definition_fragments);
    Object.freeze(check);
  }
  const databaseColumnKeys = (contract.database_columns ?? []).map(
    ({ table_name, column_name }) => `${table_name}.${column_name}`,
  );
  if (
    new Set(databaseColumnKeys).size !== databaseColumnKeys.length ||
    (contract.database_columns ?? []).some(
      ({ table_name, column_name }) =>
        !sqlIdentifierPattern.test(table_name) ||
        !sqlIdentifierPattern.test(column_name),
    )
  ) {
    throw new Error("database_columns must contain unique SQL identifiers");
  }
  const declaredSelectColumns = new Set(
    contract.table_permissions.flatMap(({ table_name, select_columns }) =>
      select_columns.map((column) => `${table_name}.${column}`),
    ),
  );
  for (const column of contract.database_columns ?? []) {
    if (
      !tableSet.has(column.table_name) ||
      !declaredSelectColumns.has(`${column.table_name}.${column.column_name}`) ||
      column.postgres_type.trim().length === 0 ||
      (column.default_expression !== null &&
        column.default_expression.trim().length === 0) ||
      !["", "always", "by_default"].includes(column.identity) ||
      !["", "stored"].includes(column.generated)
    ) {
      throw new Error(
        `invalid owner database column snapshot: ${column.table_name}.${column.column_name}`,
      );
    }
    Object.freeze(column);
  }
  assertUniqueIdentifiers(
    "database_unique_constraints.constraint_name",
    (contract.database_unique_constraints ?? []).map(
      ({ constraint_name }) => constraint_name,
    ),
  );
  for (const constraint of contract.database_unique_constraints ?? []) {
    const sourceColumns = selectColumnsByTable.get(constraint.table_name);
    if (
      !tableSet.has(constraint.table_name) ||
      constraint.columns.length === 0 ||
      constraint.columns.some((column) => !sourceColumns?.has(column)) ||
      !["primary_key", "unique"].includes(constraint.kind) ||
      (constraint.initially_deferred && !constraint.deferrable) ||
      !constraint.validated
    ) {
      throw new Error(
        `invalid owner unique constraint snapshot: ${constraint.constraint_name}`,
      );
    }
    assertUniqueIdentifiers(
      `${constraint.constraint_name}.columns`,
      constraint.columns,
    );
    Object.freeze(constraint.columns);
    Object.freeze(constraint);
  }
  const signatureNames = contract.function_signatures.map(
    ({ function_name }) => function_name,
  );
  if (
    signatureNames.length !== contract.mutable_writers.length ||
    new Set(signatureNames).size !== signatureNames.length ||
    signatureNames.some((name) => !contract.mutable_writers.includes(name)) ||
    contract.mutable_writers.some((name) => !signatureNames.includes(name))
  ) {
    throw new Error(
      `function_signatures must cover every ${contract.owner_service} mutable writer exactly once`,
    );
  }
  const permissionByTable = new Map(
    contract.table_permissions.map((permission) => [
      permission.table_name,
      permission,
    ]),
  );
  const tablesWithWriter = new Set<string>();
  for (const signature of contract.function_signatures) {
    const tablePermission = permissionByTable.get(signature.primary_table);
    if (
      signature.schema !== contract.schema ||
      tablePermission?.writer_kind !== signature.writer_kind ||
      signature.security_definer !== true ||
      signature.search_path.length !== 2 ||
      signature.search_path[0] !== contract.schema ||
      signature.search_path[1] !== "pg_temp" ||
      signature.arguments.length === 0 ||
      signature.arguments.some((argument) => argument.mode !== "in") ||
      signature.reads_tables.length === 0 ||
      signature.writes_tables.length === 0 ||
      !signature.writes_tables.includes(signature.primary_table) ||
      signature.reads_tables.some((table) => !tableSet.has(table)) ||
      signature.writes_tables.some((table) => !tableSet.has(table))
    ) {
      throw new Error(
        `invalid generated writer signature: ${contract.schema}.${signature.function_name}`,
      );
    }
    assertUniqueIdentifiers(
      `${signature.function_name}.arguments`,
      signature.arguments.map(({ argument_name }) => argument_name),
    );
    assertUniqueIdentifiers(
      `${signature.function_name}.reads_tables`,
      signature.reads_tables,
    );
    assertUniqueIdentifiers(
      `${signature.function_name}.writes_tables`,
      signature.writes_tables,
    );
    const effects = signature.effects;
    const effectTables = effects.map(({ table_name }) => table_name);
    if (
      effects.length !== signature.writes_tables.length ||
      new Set(effectTables).size !== effectTables.length ||
      effects.some(({ table_name, operation, concurrency_control }) => {
        const tableWriterKind = permissionByTable.get(table_name)?.writer_kind;
        return (
          !effectOperations.has(operation) ||
          !concurrencyControls.has(concurrency_control) ||
          tableWriterKind === undefined ||
          !operationsByWriterKind[tableWriterKind].has(operation) ||
          !hasConcurrencyArgument(signature, concurrency_control)
        );
      }) ||
      sorted(effectTables).join("\u0000") !==
        sorted(signature.writes_tables).join("\u0000")
    ) {
      throw new Error(
        `${contract.owner_service}.${signature.function_name} must declare one compatible semantic effect for every written table`,
      );
    }
    for (const table of signature.writes_tables) tablesWithWriter.add(table);
  }
  const tablesWithoutWriter = contract.tables.filter(
    (table) => !tablesWithWriter.has(table),
  );
  if (tablesWithoutWriter.length > 0) {
    throw new Error(
      `${contract.owner_service} tables without an atomic writer: ${tablesWithoutWriter.join(", ")}`,
    );
  }
  for (const [label, tables] of [
    ["outbox_tables", contract.outbox_tables],
    ["inbox_tables", contract.inbox_tables],
    ["dlq_tables", contract.dlq_tables],
    ["object_metadata_tables", contract.object_metadata_tables],
    ["append_only_tables", contract.append_only_tables],
  ] as const) {
    if (tables.some((table) => !tableSet.has(table))) {
      throw new Error(`${label} contains a table outside owner schema contract`);
    }
  }
  const appendOnlySet = new Set<string>(contract.append_only_tables);
  const permissionKinds = new Map(
    contract.table_permissions.map(({ table_name, writer_kind }) => [
      table_name,
      writer_kind,
    ]),
  );
  if (
    contract.append_only_tables.some(
      (table) =>
        permissionKinds.get(table) !== "immutable_append" &&
        permissionKinds.get(table) !== "outbox_claim_ack",
    ) ||
    contract.outbox_tables.some(
      (table) => permissionKinds.get(table) !== "outbox_claim_ack",
    )
  ) {
    throw new Error(
      `${contract.owner_service} append/outbox tables have conflicting writer kinds`,
    );
  }
  for (const table of [
    ...contract.outbox_tables,
    ...contract.inbox_tables,
    ...contract.dlq_tables,
  ]) {
    if (!appendOnlySet.has(table)) {
      throw new Error(`${table} must be registered as append-only`);
    }
  }
  for (const permission of contract.table_permissions) {
    Object.freeze(permission.select_columns);
    Object.freeze(permission.insert_columns);
    Object.freeze(permission.update_columns);
    Object.freeze(permission);
  }
  for (const value of Object.values(contract)) {
    if (Array.isArray(value)) Object.freeze(value);
  }
  return Object.freeze(contract);
}

declare const ownerTransactionBrand: unique symbol;

/** Created only by a UnitOfWork adapter and valid only inside its callback. */
export interface OwnerTransactionV1<TService extends OwnerDatabaseServiceIdV1> {
  readonly [ownerTransactionBrand]: TService;
  readonly owner_service: TService;
  readonly transaction_id: string;
  readonly trace_id: string;
  readonly started_at: string;
  readonly attempt: number;
}

export type OwnerWriterNameV1<TContract extends OwnerRepositoryContractV1> =
  TContract["mutable_writers"][number];

const verifiedOwnerDeploymentBrand = Symbol("verifiedOwnerDeploymentV1");

export interface VerifiedOwnerRepositoryDeploymentV1<
  TService extends OwnerDatabaseServiceIdV1,
> {
  readonly owner_service: TService;
  readonly verified_at: string;
  readonly contract_fingerprint: string;
  readonly database_fingerprint: string;
  readonly [verifiedOwnerDeploymentBrand]: true;
}

export interface PostgresQueryPortV1 {
  query<TRow extends Record<string, unknown>>(
    sql: string,
    values?: readonly unknown[],
  ): Promise<{ readonly rows: readonly TRow[] }>;
}

function fingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function sorted(values: Iterable<string>): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function assertSameSet(label: string, actual: Iterable<string>, expected: Iterable<string>): void {
  const actualValues = sorted(actual);
  const expectedValues = sorted(expected);
  if (JSON.stringify(actualValues) !== JSON.stringify(expectedValues)) {
    throw new Error(
      `${label} drift: expected ${expectedValues.join(",")}; observed ${actualValues.join(",")}`,
    );
  }
}

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function staticFunctionBody(definition: string): string {
  const bodyMatch = definition.match(/\bas\s+(\$[a-z0-9_]*\$)([\s\S]*?)\1/i);
  if (bodyMatch?.[2] === undefined) {
    throw new Error("owner writer function body must use a static dollar-quoted definition");
  }
  return bodyMatch[2];
}

function semanticFunctionDefinition(definition: string): string {
  return staticFunctionBody(definition)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\r\n]*/g, " ")
    .toLowerCase();
}

function executableFunctionDefinition(definition: string): string {
  return semanticFunctionDefinition(definition)
    .replace(/'(?:''|[^'])*'/g, "''")
    .toLowerCase();
}

function beforeFirstUnconditionalReturn(value: string): string {
  const match = /\breturn\s+(?!next\b|query\b)/i.exec(value);
  return match === null ? value : value.slice(0, match.index);
}

function assertNoUnreachableProofScaffolding(
  signature: OwnerFunctionSignatureV1,
  executable: string,
): void {
  const constantFalseIf =
    /\bif\s+(?:\(?\s*)?(?:false|1\s*=\s*0|0\s*=\s*1|true\s*=\s*false|false\s*=\s*true|not\s+true)(?:\s*\)?)\s+then\b/i;
  if (constantFalseIf.test(executable)) {
    throw new Error(
      `unreachable proof block is forbidden in owner writer: ${signature.schema}.${signature.function_name}`,
    );
  }
  for (const match of executable.matchAll(
    /\b([a-z][a-z0-9_]*)\s*:=\s*(p_expected_[a-z0-9_]+)\b/gi,
  )) {
    const localName = match[1]?.toLowerCase();
    if (localName !== undefined && !localName.startsWith("p_")) {
      throw new Error(
        `PostgreSQL function CAS fence drift: ${signature.schema}.${signature.function_name} copies caller expected value into a local variable`,
      );
    }
  }
  for (const match of executable.matchAll(
    /\bselect\s+(p_expected_[a-z0-9_]+)\s+into\s+([a-z][a-z0-9_]*)\b/gi,
  )) {
    const localName = match[2]?.toLowerCase();
    if (localName !== undefined && !localName.startsWith("p_")) {
      throw new Error(
        `PostgreSQL function CAS fence drift: ${signature.schema}.${signature.function_name} copies caller expected value into a local variable`,
      );
    }
  }
}

function allowedMutationVerbs(
  operation: OwnerFunctionEffectV1["operation"],
): ReadonlySet<string> {
  if (operation === "append" || operation === "enqueue") {
    return new Set(["insert"]);
  }
  if (operation === "upsert") {
    return new Set(["insert", "update", "merge"]);
  }
  return new Set(["update", "merge"]);
}

function concurrencyArgumentNames(
  signature: OwnerFunctionSignatureV1,
  control: OwnerFunctionEffectV1["concurrency_control"],
): readonly string[] {
  const names = signature.arguments.map(({ argument_name }) => argument_name);
  if (control === "slot_and_process_state_fence") {
    return names.filter(
      (name) =>
        name === "p_admission_precondition" || name === "p_admission_request",
    );
  }
  if (control === "generation_fence") {
    return names.filter(
      (name) =>
        name.startsWith("p_expected_") &&
        (name.includes("generation") ||
          name.includes("fence") ||
          name.includes("process_id")),
    );
  }
  if (control === "lease_fence") {
    const claimToken = names.filter((name) => name === "p_claim_token");
    return claimToken.length > 0
      ? claimToken
      : names.filter(
          (name) => name === "p_worker_id" || name === "p_lease_seconds",
        );
  }
  if (control === "expected_state_version" || control === "expected_version") {
    return names.filter((name) => name.startsWith("p_expected_"));
  }
  return names.filter(
    (name) =>
      name === "p_idempotency_key" ||
      name === "p_request_hash" ||
      name === "p_claim_token" ||
      name === "p_lock_token" ||
      /^p_[a-z0-9_]+_id$/.test(name),
  );
}

function assertConcurrencyFenceIsConsumed(
  signature: OwnerFunctionSignatureV1,
  effect: OwnerFunctionEffectV1,
  executable: string,
  semantic: string,
): void {
  const candidates = concurrencyArgumentNames(
    signature,
    effect.concurrency_control,
  );
  const consumed = candidates.filter((name) =>
    new RegExp(`\\b${escapeRegularExpression(name)}\\b`, "i").test(executable),
  );
  if (consumed.length === 0) {
    throw new Error(
      `PostgreSQL function fence drift: ${signature.schema}.${signature.function_name} does not consume ${effect.concurrency_control}`,
    );
  }
  if (effect.concurrency_control === "slot_and_process_state_fence") {
    const statements = semantic.split(";");
    const qualifiedTable = (table: string): string =>
      `(?:"?${escapeRegularExpression(signature.schema)}"?\\s*\\.\\s*)?"?${escapeRegularExpression(table)}"?`;
    const referencesTable = (statement: string, table: string): boolean =>
      new RegExp(
        `\\b(?:from|join)\\s+(?:only\\s+)?${qualifiedTable(table)}\\b`,
        "i",
      ).test(statement);
    const aliasesForTable = (
      statement: string,
      table: string,
    ): readonly string[] => {
      const aliases = new Set<string>([table]);
      const pattern = new RegExp(
        `\\b(?:from|join)\\s+(?:only\\s+)?${qualifiedTable(table)}(?:\\s+(?:as\\s+)?("?([a-z][a-z0-9_]*)"?))?`,
        "gi",
      );
      for (const match of statement.matchAll(pattern)) {
        const alias = match[2];
        if (
          alias !== undefined &&
          ![
            "where",
            "join",
            "left",
            "right",
            "full",
            "cross",
            "inner",
            "for",
            "on",
          ].includes(alias)
        ) {
          aliases.add(alias);
        }
      }
      return [...aliases];
    };
    const lockedSlotAndProcess = statements.some((statement) => {
      if (
        !referencesTable(statement, "bot_foreground_slots") ||
        !referencesTable(statement, "trigger_processes") ||
        !/\bfor\s+(?:no\s+key\s+)?update\b/i.test(statement) ||
        !/\bwhere\b/i.test(statement)
      ) {
        return false;
      }
      const slotAliases = aliasesForTable(statement, "bot_foreground_slots");
      const processAliases = aliasesForTable(statement, "trigger_processes");
      return slotAliases.some((slotAlias) =>
        processAliases.some((processAlias) => {
          const slot = escapeRegularExpression(slotAlias);
          const process = escapeRegularExpression(processAlias);
          return (
            new RegExp(`\\b${slot}\\.process_id\\s*=\\s*${process}\\.id\\b`, "i")
              .test(statement) ||
            new RegExp(`\\b${process}\\.id\\s*=\\s*${slot}\\.process_id\\b`, "i")
              .test(statement)
          );
        }),
      );
    });
    const locksTable = (table: string): boolean => {
      return statements.some(
        (statement) =>
          new RegExp(
            `\\b(?:from|join)\\s+(?:only\\s+)?${qualifiedTable(table)}\\b`,
            "i",
          ).test(
            statement,
          ) && /\bfor\s+(?:no\s+key\s+)?update\b/i.test(statement),
      );
    };
    const requiredPreconditionFields = [
      "process_id",
      "slot_generation",
      "phase",
      "status",
      "process_updated_at",
    ];
    const usesCallerPrecondition = signature.arguments.some(
      ({ argument_name }) => argument_name === "p_admission_precondition",
    );
    const comparesEveryPreconditionField = requiredPreconditionFields.every(
      (field) => {
        const jsonValue = `p_admission_precondition\\s*(?:->>|#>>?)\\s*(?:array\\s*\\[\\s*)?['"]${field}['"]`;
        const comparison = "(?:=|<>|is\\s+(?:not\\s+)?distinct\\s+from)";
        const rowValue = "(?:[a-z][a-z0-9_]*\\.)[a-z][a-z0-9_]*";
        return (
          new RegExp(`${jsonValue}[^;]{0,160}?${comparison}\\s*${rowValue}`, "i")
            .test(executable) ||
          new RegExp(`${rowValue}\\s*${comparison}[^;]{0,160}?${jsonValue}`, "i")
            .test(executable)
        );
      },
    );
    const recomputesServerSide =
      !usesCallerPrecondition &&
      signature.arguments.some(
        ({ argument_name }) => argument_name === "p_admission_request",
      ) &&
      signature.arguments.some(
        ({ argument_name }) => argument_name === "p_authenticated_context",
      ) &&
      signature.arguments.some(({ argument_name }) => argument_name === "p_scope") &&
      ["bots", "bot_permission_bindings"].every((table) =>
        new RegExp(
          `\\b(?:from|join)\\s+(?:"?${escapeRegularExpression(signature.schema)}"?\\s*\\.\\s*)?"?${table}"?\\b`,
          "i",
        ).test(semantic),
      ) &&
      [
        "workspace_id",
        "bot_id",
        "owner_agent_id",
        "deployment_environment",
        "release_channel",
      ].every((field) =>
        new RegExp(
          `\\bp_scope\\s*(?:->>|#>>?)\\s*(?:array\\s*\\[\\s*)?['"]${field}['"]`,
          "i",
        ).test(semantic),
      ) &&
      ["workload_subject", "capability"].every((field) =>
        new RegExp(
          `\\bp_authenticated_context\\s*(?:->>|#>>?)\\s*(?:array\\s*\\[\\s*)?['"]${field}['"]`,
          "i",
        ).test(semantic),
      ) &&
      ["is_catch_up", "explicit_interrupt"].every((field) =>
        new RegExp(
          `\\bp_admission_request\\s*(?:->>|#>>?)\\s*(?:array\\s*\\[\\s*)?['"]${field}['"]`,
          "i",
        ).test(semantic),
      ) &&
      !/\bjoin\s+(?:"?[a-z][a-z0-9_]*"?\s*\.\s*)?"?bot_permission_bindings"?\s+(?:as\s+)?[a-z][a-z0-9_]*\s+on\s+true\b/i
        .test(semantic);
    if (
      !lockedSlotAndProcess ||
      (usesCallerPrecondition &&
        (!locksTable("bot_foreground_slots") ||
          !locksTable("trigger_processes"))) ||
      (usesCallerPrecondition
        ? !comparesEveryPreconditionField
        : !recomputesServerSide)
    ) {
      throw new Error(
        `PostgreSQL function slot/process fence drift: ${signature.schema}.${signature.function_name}`,
      );
    }
  }
  if (
    effect.concurrency_control === "expected_state_version" ||
    effect.concurrency_control === "expected_version" ||
    effect.concurrency_control === "generation_fence"
  ) {
    const argumentNames = new Set(
      signature.arguments.map(({ argument_name }) => argument_name),
    );
    const compared = (name: string): boolean => {
      const escaped = escapeRegularExpression(name);
      const comparison = "(?:=|<>|is\\s+(?:not\\s+)?distinct\\s+from)";
      const rowValue = "((?:[a-z][a-z0-9_]*\\.)?[a-z][a-z0-9_]*)";
      const matches = [
        ...executable.matchAll(
          new RegExp(`\\b${escaped}\\b\\s*${comparison}\\s*${rowValue}\\b`, "gi"),
        ),
        ...executable.matchAll(
          new RegExp(`\\b${rowValue}\\b\\s*${comparison}\\s*\\b${escaped}\\b`, "gi"),
        ),
      ];
      return matches.some((match) => {
        const identifier = match[1]?.toLowerCase();
        const column = identifier?.split(".").at(-1);
        return (
          identifier !== undefined &&
          column !== undefined &&
          identifier !== name &&
          !argumentNames.has(identifier) &&
          !argumentNames.has(column) &&
          !column.startsWith("p_")
        );
      });
    };
    if (consumed.length !== candidates.length || !candidates.every(compared)) {
      throw new Error(
        `PostgreSQL function CAS fence drift: ${signature.schema}.${signature.function_name}`,
      );
    }
  }
}

function mutationPattern(
  schema: string,
  table: string,
  verbs: readonly string[],
): RegExp {
  const qualifiedTable = `(?:"?${escapeRegularExpression(schema)}"?\\s*\\.\\s*)?"?${escapeRegularExpression(table)}"?`;
  return new RegExp(
    `\\b(?:${verbs.join("|")})\\s+(?:into\\s+)?(?:only\\s+)?${qualifiedTable}\\b`,
    "i",
  );
}

function assertFunctionEffectsInDefinition(
  contract: OwnerRepositoryContractV1,
  signature: OwnerFunctionSignatureV1,
  definition: string,
  ownerFunctionNames: ReadonlySet<string>,
): void {
  const semantic = semanticFunctionDefinition(definition);
  const executable = semantic.replace(/'(?:''|[^'])*'/g, "''");
  const reachableSemantic = beforeFirstUnconditionalReturn(semantic);
  const reachableExecutable = beforeFirstUnconditionalReturn(executable);
  assertNoUnreachableProofScaffolding(signature, executable);
  if (/\bexecute\b/i.test(executable)) {
    throw new Error(
      `dynamic SQL is forbidden in owner writer: ${signature.schema}.${signature.function_name}`,
    );
  }
  if (
    /\b(?:create|alter|drop|truncate|grant|revoke|comment|vacuum|analyze|refresh)\b/i
      .test(executable)
  ) {
    throw new Error(
      `DDL is forbidden in owner writer: ${signature.schema}.${signature.function_name}`,
    );
  }
  if (/\bdelete\s+from\b/i.test(executable)) {
    throw new Error(
      `DELETE is forbidden by writer-only V1: ${signature.schema}.${signature.function_name}`,
    );
  }
  for (const effect of signature.effects) {
    const verbs = [...allowedMutationVerbs(effect.operation)];
    if (!mutationPattern(contract.schema, effect.table_name, verbs).test(reachableExecutable)) {
      throw new Error(
        `PostgreSQL function effect drift: ${signature.schema}.${signature.function_name} does not ${effect.operation} ${effect.table_name}`,
      );
    }
    assertConcurrencyFenceIsConsumed(
      signature,
      effect,
      reachableExecutable,
      reachableSemantic,
    );
  }
  const declaredTables = new Set<string>(signature.writes_tables);
  const mutationTargetPattern =
    /\b(insert\s+into|update|delete\s+from|merge\s+into|truncate(?:\s+table)?)\s+(?:only\s+)?(?:"?([a-z][a-z0-9_]*)"?\s*\.\s*)?"?([a-z][a-z0-9_]*)"?\b/gi;
  for (const match of executable.matchAll(mutationTargetPattern)) {
    const observedVerb = match[1]?.split(/\s+/u)[0];
    const observedSchema = match[2] ?? contract.schema;
    const observedTable = match[3];
    const declaredEffect = signature.effects.find(
      ({ table_name }) => table_name === observedTable,
    );
    if (
      observedVerb === undefined ||
      observedTable === undefined ||
      observedSchema !== contract.schema ||
      !declaredTables.has(observedTable) ||
      declaredEffect === undefined ||
      !allowedMutationVerbs(declaredEffect.operation).has(observedVerb)
    ) {
      throw new Error(
        `undeclared PostgreSQL mutation in ${signature.schema}.${signature.function_name}: ${observedSchema}.${observedTable ?? "unknown"}`,
      );
    }
  }
  const commonTableExpressions = new Set(
    [...executable.matchAll(/(?:\bwith\b|,)\s*"?([a-z][a-z0-9_]*)"?\s+as\s*\(/gi)]
      .flatMap((match) => (match[1] === undefined ? [] : [match[1]])),
  );
  const declaredReads = new Set<string>([
    ...signature.reads_tables,
    ...signature.writes_tables,
  ]);
  const readTargetPattern =
    /\b(?:from|join)\s+(?:only\s+)?(?:"?([a-z][a-z0-9_]*)"?\s*\.\s*)?"?([a-z][a-z0-9_]*)"?\b/gi;
  for (const match of executable.matchAll(readTargetPattern)) {
    const observedSchema = match[1];
    const observedTable = match[2];
    const suffix = executable.slice((match.index ?? 0) + match[0].length);
    if (
      observedTable === undefined ||
      commonTableExpressions.has(observedTable) ||
      /^\s*\(/u.test(suffix)
    ) {
      continue;
    }
    if (
      (observedSchema !== undefined && observedSchema !== contract.schema) ||
      !declaredReads.has(observedTable)
    ) {
      throw new Error(
        `undeclared PostgreSQL read in ${signature.schema}.${signature.function_name}: ${observedSchema ?? contract.schema}.${observedTable}`,
      );
    }
  }
  const fromClausePattern =
    /\bfrom\b([\s\S]*?)(?=\b(?:where|group\s+by|order\s+by|having|limit|offset|returning|for\s+(?:no\s+key\s+)?update|union|intersect|except)\b|;|$)/gi;
  const commaReadTargetPattern =
    /,\s*(?:only\s+)?(?:"?([a-z][a-z0-9_]*)"?\s*\.\s*)?"?([a-z][a-z0-9_]*)"?(?:\s+(?:as\s+)?(?!where\b|join\b|left\b|right\b|full\b|cross\b|inner\b|group\b|order\b|having\b|limit\b|offset\b|returning\b|for\b)(?:"?[a-z][a-z0-9_]*"?))?(?=\s*(?:,|\b(?:join|left|right|full|cross|inner|where|group|order|having|limit|offset|returning|for|union|intersect|except)\b|$))/gi;
  for (const fromClause of executable.matchAll(fromClausePattern)) {
    const relations = fromClause[1] ?? "";
    for (const match of relations.matchAll(commaReadTargetPattern)) {
      const observedSchema = match[1];
      const observedTable = match[2];
      if (
        observedTable === undefined ||
        commonTableExpressions.has(observedTable)
      ) {
        continue;
      }
      if (
        (observedSchema !== undefined && observedSchema !== contract.schema) ||
        !declaredReads.has(observedTable)
      ) {
        throw new Error(
          `undeclared PostgreSQL read in ${signature.schema}.${signature.function_name}: ${observedSchema ?? contract.schema}.${observedTable}`,
        );
      }
    }
  }
  const mergeUsingPattern =
    /\bmerge\s+into\s+(?:only\s+)?(?:"?[a-z][a-z0-9_]*"?\s*\.\s*)?"?[a-z][a-z0-9_]*"?\b[\s\S]{0,2000}?\busing\s+(?:only\s+)?(?:"?([a-z][a-z0-9_]*)"?\s*\.\s*)?"?([a-z][a-z0-9_]*)"?\b/gi;
  for (const match of executable.matchAll(mergeUsingPattern)) {
    const observedSchema = match[1];
    const observedTable = match[2];
    const suffix = executable.slice((match.index ?? 0) + match[0].length);
    if (
      observedTable === undefined ||
      commonTableExpressions.has(observedTable) ||
      /^\s*\(/u.test(suffix)
    ) {
      continue;
    }
    if (
      (observedSchema !== undefined && observedSchema !== contract.schema) ||
      !declaredReads.has(observedTable)
    ) {
      throw new Error(
        `undeclared PostgreSQL read in ${signature.schema}.${signature.function_name}: ${observedSchema ?? contract.schema}.${observedTable}`,
      );
    }
  }
  const qualifiedFunctionCallPattern =
    /\b"?([a-z][a-z0-9_]*)"?\s*\.\s*"?([a-z][a-z0-9_]*)"?\s*\(/gi;
  for (const match of executable.matchAll(qualifiedFunctionCallPattern)) {
    const helperSchema = match[1];
    const helperName = match[2];
    const prefix = executable.slice(0, match.index ?? 0);
    if (/\b(?:into|update|table)\s*$/iu.test(prefix)) continue;
    if (
      helperSchema !== undefined &&
      helperSchema !== "pg_catalog" &&
      !(helperSchema === signature.schema && helperName === signature.function_name)
    ) {
      throw new Error(
        `undeclared PostgreSQL helper call in ${signature.schema}.${signature.function_name}: ${helperSchema}.${helperName ?? "unknown"}`,
      );
    }
  }
  const unqualifiedFunctionCallPattern =
    /(?<!\.)\b"?([a-z][a-z0-9_]*)"?\s*\(/gi;
  for (const match of executable.matchAll(unqualifiedFunctionCallPattern)) {
    const helperName = match[1];
    if (
      helperName !== undefined &&
      helperName !== signature.function_name &&
      ownerFunctionNames.has(helperName)
    ) {
      throw new Error(
        `undeclared PostgreSQL helper call in ${signature.schema}.${signature.function_name}: ${signature.schema}.${helperName}`,
      );
    }
  }
}

/**
 * Performs the same static writer-body verification used by the live catalog
 * verifier. pai-infra can call this while generating a migration, before the
 * function is applied to PostgreSQL.
 */
export function verifyOwnerWriterDefinitionV1(
  contract: OwnerRepositoryContractV1,
  signature: OwnerFunctionSignatureV1,
  definition: string,
): void {
  assertFunctionEffectsInDefinition(
    contract,
    signature,
    definition,
    new Set([signature.function_name]),
  );
}

/**
 * Reads PostgreSQL catalogs directly. Callers cannot supply a deployment
 * artifact, verification timestamp, grants, function configuration, or table
 * shape. The returned capability is bound to both contract and observed facts.
 */
export async function verifyOwnerRepositoryDeploymentFromPostgresV1<
  const TContract extends OwnerRepositoryContractV1,
>(
  contract: TContract,
  postgres: PostgresQueryPortV1,
  options: Readonly<{
    expected_schema_owner: string;
    runtime_postgres: PostgresQueryPortV1;
  }>,
): Promise<VerifiedOwnerRepositoryDeploymentV1<TContract["owner_service"]>> {
  if (contract.foreign_key_snapshot.status === "pending") {
    throw new Error(
      `canonical PostgreSQL foreign-key snapshot is pending for ${contract.owner_service}: ${contract.foreign_key_snapshot.reason}`,
    );
  }
  const schemaResult = await postgres.query<{
    schema_name: string;
    schema_owner: string;
  }>(
    `SELECT n.nspname AS schema_name, pg_get_userbyid(n.nspowner) AS schema_owner
       FROM pg_catalog.pg_namespace n
      WHERE n.nspname = $1`,
    [contract.schema],
  );
  if (
    schemaResult.rows.length !== 1 ||
    schemaResult.rows[0]?.schema_owner !== options.expected_schema_owner
  ) {
    throw new Error(`PostgreSQL schema owner drift for ${contract.schema}`);
  }

  const appRoleResult = await postgres.query<{
    role_name: string;
    can_login: boolean;
    inherits_privileges: boolean;
    is_superuser: boolean;
    bypasses_rls: boolean;
    can_create_role: boolean;
    can_create_database: boolean;
    can_replicate: boolean;
  }>(
    `SELECT r.rolname AS role_name,
            r.rolcanlogin AS can_login,
            r.rolinherit AS inherits_privileges,
            r.rolsuper AS is_superuser,
            r.rolbypassrls AS bypasses_rls,
            r.rolcreaterole AS can_create_role,
            r.rolcreatedb AS can_create_database,
            r.rolreplication AS can_replicate
       FROM pg_catalog.pg_roles r
      WHERE r.rolname = $1`,
    [contract.app_role],
  );
  const appRole = appRoleResult.rows[0];
  if (
    appRoleResult.rows.length !== 1 ||
    appRole === undefined ||
    appRole.can_login ||
    !appRole.inherits_privileges ||
    appRole.is_superuser ||
    appRole.bypasses_rls ||
    appRole.can_create_role ||
    appRole.can_create_database ||
    appRole.can_replicate
  ) {
    throw new Error(
      `application PostgreSQL role is not least-privilege for ${contract.owner_service}`,
    );
  }

  const runtimeIdentityResult = await options.runtime_postgres.query<{
    current_user: string;
    session_user: string;
    can_login: boolean;
    inherits_privileges: boolean;
    is_superuser: boolean;
    bypasses_rls: boolean;
    can_create_role: boolean;
    can_create_database: boolean;
    can_replicate: boolean;
  }>(
    `SELECT current_user::text AS current_user,
            session_user::text AS session_user,
            r.rolcanlogin AS can_login,
            r.rolinherit AS inherits_privileges,
            r.rolsuper AS is_superuser,
            r.rolbypassrls AS bypasses_rls,
            r.rolcreaterole AS can_create_role,
            r.rolcreatedb AS can_create_database,
            r.rolreplication AS can_replicate
       FROM pg_catalog.pg_roles r
      WHERE r.rolname = current_user`,
  );
  const runtimeIdentity = runtimeIdentityResult.rows[0];
  if (
    runtimeIdentityResult.rows.length !== 1 ||
    runtimeIdentity === undefined ||
    runtimeIdentity.current_user !== runtimeIdentity.session_user ||
    !runtimeIdentity.can_login ||
    !runtimeIdentity.inherits_privileges ||
    runtimeIdentity.is_superuser ||
    runtimeIdentity.bypasses_rls ||
    runtimeIdentity.can_create_role ||
    runtimeIdentity.can_create_database ||
    runtimeIdentity.can_replicate
  ) {
    throw new Error(
      `runtime PostgreSQL connection identity is not a least-privilege LOGIN for ${contract.owner_service}`,
    );
  }
  const runtimeMembershipResult = await options.runtime_postgres.query<{
    role_name: string;
  }>(
    `WITH RECURSIVE inherited_roles(role_oid) AS (
       SELECT r.oid FROM pg_catalog.pg_roles r WHERE r.rolname = current_user
       UNION
       SELECT m.roleid
         FROM pg_catalog.pg_auth_members m
         JOIN inherited_roles inherited ON inherited.role_oid = m.member
     )
     SELECT r.rolname AS role_name
       FROM inherited_roles inherited
       JOIN pg_catalog.pg_roles r ON r.oid = inherited.role_oid
      ORDER BY r.rolname`,
  );
  const inheritedRoles = new Set(
    runtimeMembershipResult.rows.map(({ role_name }) => role_name),
  );
  const allowedRuntimeRoles = new Set([
    runtimeIdentity.current_user,
    contract.app_role,
  ]);
  if (
    !inheritedRoles.has(contract.app_role) ||
    inheritedRoles.has(options.expected_schema_owner) ||
    [...inheritedRoles].some((role) => !allowedRuntimeRoles.has(role))
  ) {
    throw new Error(
      `runtime PostgreSQL role membership drift for ${contract.owner_service}`,
    );
  }
  const runtimeMembershipOptionsResult = await options.runtime_postgres.query<{
    role_name: string;
    admin_option: boolean;
    inherit_option: boolean;
    set_option: boolean;
  }>(
    `SELECT inherited.rolname AS role_name,
            m.admin_option,
            m.inherit_option,
            m.set_option
       FROM pg_catalog.pg_auth_members m
       JOIN pg_catalog.pg_roles inherited ON inherited.oid = m.roleid
       JOIN pg_catalog.pg_roles member ON member.oid = m.member
      WHERE member.rolname = current_user`,
  );
  if (
    runtimeMembershipOptionsResult.rows.length !== 1 ||
    runtimeMembershipOptionsResult.rows[0]?.role_name !== contract.app_role ||
    runtimeMembershipOptionsResult.rows[0]?.admin_option ||
    runtimeMembershipOptionsResult.rows[0]?.set_option ||
    runtimeMembershipOptionsResult.rows[0]?.inherit_option !== true
  ) {
    throw new Error(
      `runtime PostgreSQL role membership options drift for ${contract.owner_service}`,
    );
  }

  const unsupportedRelationResult = await postgres.query<{
    relation_name: string;
    relkind: string;
  }>(
    `SELECT c.relname AS relation_name, c.relkind::text AS relkind
       FROM pg_catalog.pg_class c
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1 AND c.relkind IN ('v','m','f')
      ORDER BY c.relname`,
    [contract.schema],
  );
  if (unsupportedRelationResult.rows.length > 0) {
    throw new Error(
      `unsupported PostgreSQL relation kind drift for ${contract.schema}: ${unsupportedRelationResult.rows
        .map(({ relation_name, relkind }) => `${relation_name}:${relkind}`)
        .join(", ")}`,
    );
  }

  const rewriteRuleResult = await postgres.query<{
    relation_name: string;
    rule_name: string;
  }>(
    `SELECT c.relname AS relation_name, r.rulename AS rule_name
       FROM pg_catalog.pg_rewrite r
       JOIN pg_catalog.pg_class c ON c.oid = r.ev_class
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1 AND r.rulename <> '_RETURN'
      ORDER BY c.relname, r.rulename`,
    [contract.schema],
  );
  if (rewriteRuleResult.rows.length > 0) {
    throw new Error(
      `unsupported PostgreSQL rewrite rule drift for ${contract.schema}: ${rewriteRuleResult.rows
        .map(({ relation_name, rule_name }) => `${relation_name}.${rule_name}`)
        .join(", ")}`,
    );
  }

  const tableOwnerResult = await postgres.query<{
    table_name: string;
    table_owner: string;
  }>(
    `SELECT c.relname AS table_name,
            pg_catalog.pg_get_userbyid(c.relowner) AS table_owner
       FROM pg_catalog.pg_class c
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1 AND c.relkind IN ('r','p')
      ORDER BY c.relname`,
    [contract.schema],
  );
  assertSameSet(
    `${contract.schema} owned tables`,
    tableOwnerResult.rows
      .filter(({ table_owner }) => table_owner === options.expected_schema_owner)
      .map(({ table_name }) => table_name),
    contract.tables,
  );
  if (
    tableOwnerResult.rows.some(
      ({ table_owner }) => table_owner !== options.expected_schema_owner,
    )
  ) {
    throw new Error(`PostgreSQL table owner drift for ${contract.schema}`);
  }

  const columnResult = await postgres.query<{
    table_name: string;
    column_name: string;
    postgres_type: string;
    not_null: boolean;
    default_expression: string | null;
    identity: OwnerDatabaseColumnV1["identity"];
    generated: OwnerDatabaseColumnV1["generated"];
  }>(
    `SELECT c.relname AS table_name, a.attname AS column_name,
            pg_catalog.format_type(a.atttypid, a.atttypmod) AS postgres_type,
            a.attnotnull AS not_null,
            pg_catalog.pg_get_expr(d.adbin, d.adrelid) AS default_expression,
            CASE a.attidentity WHEN 'a' THEN 'always'
                               WHEN 'd' THEN 'by_default'
                               ELSE '' END AS identity,
            CASE a.attgenerated WHEN 's' THEN 'stored'
                                ELSE '' END AS generated
       FROM pg_catalog.pg_class c
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid
       LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid
        AND d.adnum = a.attnum
      WHERE n.nspname = $1 AND c.relkind IN ('r','p')
        AND a.attnum > 0 AND NOT a.attisdropped
      ORDER BY c.relname, a.attnum`,
    [contract.schema],
  );
  assertSameSet(
    `${contract.schema} tables`,
    new Set(columnResult.rows.map(({ table_name }) => table_name)),
    contract.tables,
  );
  const observedColumns = new Set(
    columnResult.rows.map(({ table_name, column_name }) => `${table_name}.${column_name}`),
  );
  assertSameSet(
    `${contract.schema} columns`,
    observedColumns,
    contract.table_permissions.flatMap(({ table_name, select_columns }) =>
      select_columns.map((column) => `${table_name}.${column}`),
    ),
  );
  for (const permission of contract.table_permissions) {
    for (const column of permission.select_columns) {
      if (!observedColumns.has(`${permission.table_name}.${column}`)) {
        throw new Error(`PostgreSQL column missing: ${permission.table_name}.${column}`);
      }
    }
  }
  const columnSnapshot = (
    row: OwnerDatabaseColumnV1 | (typeof columnResult.rows)[number],
  ): string =>
    `${row.table_name}.${row.column_name}:${row.postgres_type}:not_null=${row.not_null}:default=${row.default_expression ?? ""}:identity=${row.identity}:generated=${row.generated}`;
  if (contract.database_columns !== undefined) {
    assertSameSet(
      `${contract.schema} database columns`,
      columnResult.rows.map(columnSnapshot),
      contract.database_columns.map(columnSnapshot),
    );
  }

  const tableAclResult = await postgres.query<{
    table_name: string;
    grantee: string;
    privilege_type: string;
  }>(
    `SELECT c.relname AS table_name,
            COALESCE(r.rolname, 'PUBLIC') AS grantee,
            acl.privilege_type
       FROM pg_catalog.pg_class c
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       CROSS JOIN LATERAL pg_catalog.aclexplode(
         COALESCE(c.relacl, pg_catalog.acldefault('r', c.relowner))
       ) acl
       LEFT JOIN pg_catalog.pg_roles r ON r.oid = acl.grantee
      WHERE n.nspname = $1 AND c.relkind IN ('r','p')`,
    [contract.schema],
  );
  if (
    tableAclResult.rows.some(
      ({ grantee }) => grantee !== options.expected_schema_owner,
    )
  ) {
    throw new Error(`cross-owner table privilege drift for ${contract.schema}`);
  }

  const columnAclResult = await postgres.query<{
    table_name: string;
    column_name: string;
    grantee: string;
    privilege_type: string;
  }>(
    `SELECT c.relname AS table_name, a.attname AS column_name,
            COALESCE(r.rolname, 'PUBLIC') AS grantee,
            acl.privilege_type
       FROM pg_catalog.pg_class c
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid
       CROSS JOIN LATERAL pg_catalog.aclexplode(
         COALESCE(a.attacl, '{}'::aclitem[])
       ) acl
       LEFT JOIN pg_catalog.pg_roles r ON r.oid = acl.grantee
      WHERE n.nspname = $1 AND c.relkind IN ('r','p')
        AND a.attnum > 0 AND NOT a.attisdropped`,
    [contract.schema],
  );
  if (
    columnAclResult.rows.some(
      ({ grantee, privilege_type }) =>
        grantee !== options.expected_schema_owner &&
        (grantee !== contract.app_role || privilege_type !== "SELECT"),
    )
  ) {
    throw new Error(`cross-owner column privilege drift for ${contract.schema}`);
  }
  assertSameSet(
    `${contract.app_role} SELECT columns`,
    columnAclResult.rows
      .filter(
        ({ grantee, privilege_type }) =>
          grantee === contract.app_role && privilege_type === "SELECT",
      )
      .map(({ table_name, column_name }) => `${table_name}.${column_name}`),
    contract.table_permissions.flatMap(({ table_name, select_columns }) =>
      select_columns.map((column) => `${table_name}.${column}`),
    ),
  );

  const runtimeColumnPrivilegeResult = await options.runtime_postgres.query<{
    table_name: string;
    column_name: string;
    can_select: boolean;
    can_insert: boolean;
    can_update: boolean;
    can_delete: boolean;
  }>(
    `SELECT c.relname AS table_name, a.attname AS column_name,
            pg_catalog.has_column_privilege(current_user, c.oid, a.attnum, 'SELECT') AS can_select,
            pg_catalog.has_column_privilege(current_user, c.oid, a.attnum, 'INSERT') AS can_insert,
            pg_catalog.has_column_privilege(current_user, c.oid, a.attnum, 'UPDATE') AS can_update,
            pg_catalog.has_table_privilege(current_user, c.oid, 'DELETE') AS can_delete
       FROM pg_catalog.pg_class c
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid
      WHERE n.nspname = $1 AND c.relkind IN ('r','p')
        AND a.attnum > 0 AND NOT a.attisdropped`,
    [contract.schema],
  );
  if (
    runtimeColumnPrivilegeResult.rows.some(
      ({ can_insert, can_update, can_delete }) =>
        can_insert || can_update || can_delete,
    )
  ) {
    throw new Error(`effective runtime DML privilege drift for ${contract.schema}`);
  }
  assertSameSet(
    `effective runtime SELECT columns for ${contract.owner_service}`,
    runtimeColumnPrivilegeResult.rows
      .filter(({ can_select }) => can_select)
      .map(({ table_name, column_name }) => `${table_name}.${column_name}`),
    contract.table_permissions.flatMap(({ table_name, select_columns }) =>
      select_columns.map((column) => `${table_name}.${column}`),
    ),
  );

  const triggerResult = await postgres.query<{
    table_name: string;
    trigger_name: string;
  }>(
    `SELECT c.relname AS table_name, t.tgname AS trigger_name
       FROM pg_catalog.pg_trigger t
       JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1
        AND NOT t.tgisinternal
        AND t.tgenabled <> 'D'`,
    [contract.schema],
  );
  if (triggerResult.rows.length > 0) {
    throw new Error(
      `undeclared PostgreSQL trigger side effects in ${contract.schema}: ${triggerResult.rows
        .map(({ table_name, trigger_name }) => `${table_name}.${trigger_name}`)
        .join(", ")}`,
    );
  }

  const functionResult = await postgres.query<{
    oid: string;
    function_name: string;
    function_owner: string;
    security_definer: boolean;
    settings: string[] | null;
    argument_names: string[] | null;
    argument_types: string[] | null;
    returns_set: boolean;
    result_type: string;
    language_name: string;
    function_definition: string;
  }>(
    `SELECT p.oid::text AS oid, p.proname AS function_name,
            pg_get_userbyid(p.proowner) AS function_owner,
            p.prosecdef AS security_definer, p.proconfig AS settings,
            p.proargnames AS argument_names,
            CASE WHEN p.pronargs = 0 THEN ARRAY[]::text[]
                 ELSE string_to_array(pg_catalog.oidvectortypes(p.proargtypes), ', ')
            END AS argument_types,
            p.proretset AS returns_set,
            pg_catalog.format_type(p.prorettype, NULL) AS result_type,
            language.lanname AS language_name,
            pg_catalog.pg_get_functiondef(p.oid) AS function_definition
       FROM pg_catalog.pg_proc p
       JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
       JOIN pg_catalog.pg_language language ON language.oid = p.prolang
      WHERE n.nspname = $1`,
    [contract.schema],
  );
  const postgresType = (type: OwnerPostgresTypeV1): string =>
    type === "timestamptz" ? "timestamp with time zone" : type;
  const ownerFunctionNames = new Set(
    functionResult.rows.map(({ function_name }) => function_name),
  );
  for (const signature of contract.function_signatures) {
    const deployed = functionResult.rows.find(
      ({ function_name }) => function_name === signature.function_name,
    );
    const expectedSettings = `search_path=${contract.schema}, pg_temp`;
    if (
      deployed === undefined ||
      deployed.function_owner !== options.expected_schema_owner ||
      deployed.security_definer !== true ||
      JSON.stringify(deployed.settings ?? []) !== JSON.stringify([expectedSettings]) ||
      JSON.stringify(deployed.argument_names ?? []) !==
        JSON.stringify(signature.arguments.map(({ argument_name }) => argument_name)) ||
      JSON.stringify(deployed.argument_types ?? []) !==
        JSON.stringify(signature.arguments.map(({ postgres_type }) => postgresType(postgres_type))) ||
      deployed.returns_set !== (signature.returns === "setof jsonb") ||
      deployed.result_type !== "jsonb" ||
      (deployed.language_name !== "sql" && deployed.language_name !== "plpgsql")
    ) {
      throw new Error(`PostgreSQL function signature/security drift: ${contract.schema}.${signature.function_name}`);
    }
    assertFunctionEffectsInDefinition(
      contract,
      signature,
      deployed.function_definition,
      ownerFunctionNames,
    );
  }

  const executeGrantResult = await postgres.query<{
    function_name: string;
    grantee: string;
  }>(
    `SELECT p.proname AS function_name, COALESCE(r.rolname, 'PUBLIC') AS grantee
       FROM pg_catalog.pg_proc p
       JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
       CROSS JOIN LATERAL pg_catalog.aclexplode(
         COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))
       ) acl
       LEFT JOIN pg_catalog.pg_roles r ON r.oid = acl.grantee
      WHERE n.nspname = $1 AND acl.privilege_type = 'EXECUTE'`,
    [contract.schema],
  );
  const appExecutableFunctions = executeGrantResult.rows
    .filter(({ grantee }) => grantee === contract.app_role)
    .map(({ function_name }) => function_name);
  assertSameSet(`${contract.app_role} EXECUTE functions`, appExecutableFunctions, contract.mutable_writers);
  if (
    executeGrantResult.rows.some(
      ({ grantee }) =>
        grantee !== options.expected_schema_owner && grantee !== contract.app_role,
    )
  ) {
    throw new Error(`cross-owner EXECUTE privilege drift for ${contract.schema}`);
  }

  const runtimeExecuteResult = await options.runtime_postgres.query<{
    function_name: string;
  }>(
    `SELECT p.proname AS function_name
       FROM pg_catalog.pg_proc p
       JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = $1
        AND pg_catalog.has_function_privilege(current_user, p.oid, 'EXECUTE')`,
    [contract.schema],
  );
  assertSameSet(
    `effective runtime EXECUTE functions for ${contract.owner_service}`,
    runtimeExecuteResult.rows.map(({ function_name }) => function_name),
    contract.mutable_writers,
  );

  const schemaAclResult = await postgres.query<{
    grantee: string;
    privilege_type: string;
  }>(
    `SELECT COALESCE(r.rolname, 'PUBLIC') AS grantee, acl.privilege_type
       FROM pg_catalog.pg_namespace n
       CROSS JOIN LATERAL pg_catalog.aclexplode(
         COALESCE(n.nspacl, pg_catalog.acldefault('n', n.nspowner))
       ) acl
       LEFT JOIN pg_catalog.pg_roles r ON r.oid = acl.grantee
      WHERE n.nspname = $1`,
    [contract.schema],
  );
  if (
    schemaAclResult.rows.some(
      ({ grantee, privilege_type }) =>
        grantee !== options.expected_schema_owner &&
        (grantee !== contract.app_role || privilege_type !== "USAGE"),
    ) ||
    !schemaAclResult.rows.some(
      ({ grantee, privilege_type }) =>
        grantee === contract.app_role && privilege_type === "USAGE",
    )
  ) {
    throw new Error(`cross-owner schema privilege drift for ${contract.schema}`);
  }
  const runtimeSchemaPrivilegeResult =
    await options.runtime_postgres.query<{
      can_use: boolean;
      can_create: boolean;
    }>(
      `SELECT pg_catalog.has_schema_privilege(current_user, n.oid, 'USAGE') AS can_use,
              pg_catalog.has_schema_privilege(current_user, n.oid, 'CREATE') AS can_create
         FROM pg_catalog.pg_namespace n
        WHERE n.nspname = $1`,
      [contract.schema],
    );
  if (
    runtimeSchemaPrivilegeResult.rows.length !== 1 ||
    runtimeSchemaPrivilegeResult.rows[0]?.can_use !== true ||
    runtimeSchemaPrivilegeResult.rows[0]?.can_create !== false
  ) {
    throw new Error(`effective runtime schema privilege drift for ${contract.schema}`);
  }

  const foreignKeyResult = await postgres.query<{
    constraint_name: string;
    table_name: string;
    columns: string[];
    referenced_schema: string;
    referenced_table: string;
    referenced_columns: string[];
    match_type: OwnerForeignKeyV1["match_type"];
    on_update: OwnerForeignKeyV1["on_update"];
    on_delete: OwnerForeignKeyV1["on_delete"];
    deferrable: boolean;
    initially_deferred: boolean;
    validated: boolean;
  }>(
    `SELECT con.conname AS constraint_name, src.relname AS table_name,
            ARRAY(SELECT a.attname::text FROM unnest(con.conkey) WITH ORDINALITY k(attnum, ord)
                    JOIN pg_catalog.pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.attnum
                   ORDER BY k.ord)::text[] AS columns,
            dst_namespace.nspname AS referenced_schema,
            dst.relname AS referenced_table,
            ARRAY(SELECT a.attname::text FROM unnest(con.confkey) WITH ORDINALITY k(attnum, ord)
                    JOIN pg_catalog.pg_attribute a ON a.attrelid = con.confrelid AND a.attnum = k.attnum
                   ORDER BY k.ord)::text[] AS referenced_columns,
            CASE con.confmatchtype WHEN 's' THEN 'simple' WHEN 'f' THEN 'full'
                 WHEN 'p' THEN 'partial' END AS match_type,
            CASE con.confupdtype WHEN 'a' THEN 'no_action' WHEN 'r' THEN 'restrict'
                 WHEN 'c' THEN 'cascade' WHEN 'n' THEN 'set_null'
                 WHEN 'd' THEN 'set_default' END AS on_update,
            CASE con.confdeltype WHEN 'a' THEN 'no_action' WHEN 'r' THEN 'restrict'
                 WHEN 'c' THEN 'cascade' WHEN 'n' THEN 'set_null'
                 WHEN 'd' THEN 'set_default' END AS on_delete,
            con.condeferrable AS deferrable,
            con.condeferred AS initially_deferred,
            con.convalidated AS validated
       FROM pg_catalog.pg_constraint con
       JOIN pg_catalog.pg_class src ON src.oid = con.conrelid
       JOIN pg_catalog.pg_class dst ON dst.oid = con.confrelid
       JOIN pg_catalog.pg_namespace n ON n.oid = src.relnamespace
       JOIN pg_catalog.pg_namespace dst_namespace ON dst_namespace.oid = dst.relnamespace
      WHERE n.nspname = $1 AND con.contype = 'f'`,
    [contract.schema],
  );
  const fkSnapshot = (row: OwnerForeignKeyV1 | (typeof foreignKeyResult.rows)[number]) =>
    `${row.constraint_name}:${row.table_name}(${row.columns.join(",")})->${row.referenced_schema}.${row.referenced_table}(${row.referenced_columns.join(",")}):match=${row.match_type}:update=${row.on_update}:delete=${row.on_delete}:deferrable=${row.deferrable}:initially_deferred=${row.initially_deferred}:validated=${row.validated}`;
  assertSameSet(
    `${contract.schema} foreign keys`,
    foreignKeyResult.rows.map(fkSnapshot),
    contract.foreign_keys.map(fkSnapshot),
  );

  const uniqueConstraintResult = await postgres.query<{
    constraint_name: string;
    table_name: string;
    columns: string[];
    kind: OwnerDatabaseUniqueConstraintV1["kind"];
    deferrable: boolean;
    initially_deferred: boolean;
    validated: boolean;
  }>(
    `SELECT con.conname AS constraint_name, c.relname AS table_name,
            ARRAY(SELECT a.attname::text FROM unnest(con.conkey) WITH ORDINALITY k(attnum, ord)
                    JOIN pg_catalog.pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.attnum
                   ORDER BY k.ord)::text[] AS columns,
            CASE con.contype WHEN 'p' THEN 'primary_key'
                             WHEN 'u' THEN 'unique' END AS kind,
            con.condeferrable AS deferrable,
            con.condeferred AS initially_deferred,
            con.convalidated AS validated
       FROM pg_catalog.pg_constraint con
       JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1 AND con.contype IN ('p','u')
      ORDER BY c.relname, con.conname`,
    [contract.schema],
  );
  const uniqueSnapshot = (
    row:
      | OwnerDatabaseUniqueConstraintV1
      | (typeof uniqueConstraintResult.rows)[number],
  ): string =>
    `${row.constraint_name}:${row.table_name}(${row.columns.join(",")}):kind=${row.kind}:deferrable=${row.deferrable}:initially_deferred=${row.initially_deferred}:validated=${row.validated}`;
  if (contract.database_unique_constraints !== undefined) {
    assertSameSet(
      `${contract.schema} unique constraints`,
      uniqueConstraintResult.rows.map(uniqueSnapshot),
      contract.database_unique_constraints.map(uniqueSnapshot),
    );
  }

  const checkConstraintResult = await postgres.query<{
    constraint_name: string;
    table_name: string;
    definition: string;
  }>(
    `SELECT con.conname AS constraint_name, c.relname AS table_name,
            pg_catalog.pg_get_constraintdef(con.oid, true) AS definition
       FROM pg_catalog.pg_constraint con
       JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1 AND con.contype = 'c'`,
    [contract.schema],
  );
  for (const expectation of contract.database_checks ?? []) {
    const observed = checkConstraintResult.rows.find(
      ({ constraint_name, table_name }) =>
        constraint_name === expectation.constraint_name &&
        table_name === expectation.table_name,
    );
    if (
      observed === undefined ||
      expectation.required_definition_fragments.some(
        (fragment) => !observed.definition.includes(fragment),
      )
    ) {
      throw new Error(
        `PostgreSQL CHECK constraint drift: ${expectation.table_name}.${expectation.constraint_name}`,
      );
    }
  }

  const contractFingerprint = fingerprint(contract);
  const databaseFingerprint = fingerprint({
    schema: schemaResult.rows,
    app_role: appRoleResult.rows,
    columns: columnResult.rows,
    table_owners: tableOwnerResult.rows,
    runtime_identity: runtimeIdentityResult.rows,
    runtime_membership: runtimeMembershipResult.rows,
    runtime_membership_options: runtimeMembershipOptionsResult.rows,
    unsupported_relations: unsupportedRelationResult.rows,
    rewrite_rules: rewriteRuleResult.rows,
    table_acl: tableAclResult.rows,
    column_acl: columnAclResult.rows,
    runtime_column_privileges: runtimeColumnPrivilegeResult.rows,
    triggers: triggerResult.rows,
    functions: functionResult.rows,
    execute_grants: executeGrantResult.rows,
    runtime_execute: runtimeExecuteResult.rows,
    schema_acl: schemaAclResult.rows,
    runtime_schema_privileges: runtimeSchemaPrivilegeResult.rows,
    foreign_keys: foreignKeyResult.rows,
    unique_constraints: uniqueConstraintResult.rows,
    check_constraints: checkConstraintResult.rows,
  });
  return Object.freeze({
    owner_service: contract.owner_service,
    verified_at: new Date().toISOString(),
    contract_fingerprint: contractFingerprint,
    database_fingerprint: databaseFingerprint,
    [verifiedOwnerDeploymentBrand]: true,
  }) as VerifiedOwnerRepositoryDeploymentV1<TContract["owner_service"]>;
}

export interface VerifiedOwnerPostgresCompositionV1<
  TContract extends OwnerRepositoryContractV1,
> {
  readonly deployment: VerifiedOwnerRepositoryDeploymentV1<
    TContract["owner_service"]
  >;
  readonly postgres: PostgresQueryPortV1;
  readonly repository: OwnerRepositoryPortV1<TContract>;
  readonly unit_of_work: OwnerUnitOfWorkPortV1<
    TContract["owner_service"],
    Readonly<{ owner: OwnerRepositoryPortV1<TContract> }>
  >;
  readonly checkReadiness: () => Promise<void>;
  readonly close: () => Promise<void>;
}

export interface OwnerDatabaseApplicationDependenciesV1<
  TContract extends OwnerRepositoryContractV1,
> {
  readonly deployment: VerifiedOwnerRepositoryDeploymentV1<
    TContract["owner_service"]
  >;
  readonly repository: OwnerRepositoryPortV1<TContract>;
  readonly unit_of_work: OwnerUnitOfWorkPortV1<
    TContract["owner_service"],
    Readonly<{ owner: OwnerRepositoryPortV1<TContract> }>
  >;
}

/**
 * Creates an exact runtime capability object for application code. The pool,
 * raw query port, readiness and lifecycle controls remain private to main.
 */
export function ownerDatabaseApplicationDependenciesV1<
  const TContract extends OwnerRepositoryContractV1,
>(
  composition: VerifiedOwnerPostgresCompositionV1<TContract>,
): OwnerDatabaseApplicationDependenciesV1<TContract> {
  return Object.freeze({
    deployment: composition.deployment,
    repository: composition.repository,
    unit_of_work: composition.unit_of_work,
  });
}

/**
 * Opens the service runtime connection, verifies that exact effective identity
 * against PostgreSQL, and retains both the verified capability and pool for the
 * lifetime of the service composition.
 */
export async function openVerifiedOwnerPostgresCompositionV1<
  const TContract extends OwnerRepositoryContractV1,
>(
  contract: TContract,
  databaseUrl: string,
  expectedSchemaOwner = "pai_migrator",
): Promise<VerifiedOwnerPostgresCompositionV1<TContract>> {
  const pool = new Pool({ connectionString: databaseUrl });
  const postgres: PostgresQueryPortV1 = {
    async query<TRow extends Record<string, unknown>>(
      sql: string,
      values: readonly unknown[] = [],
    ): Promise<{ readonly rows: readonly TRow[] }> {
      const result = await pool.query<TRow>(sql, [...values]);
      return { rows: result.rows };
    },
  };
  try {
    const deployment =
      await verifyOwnerRepositoryDeploymentFromPostgresV1(
        contract,
        postgres,
        {
          expected_schema_owner: expectedSchemaOwner,
          runtime_postgres: postgres,
        },
      );
    const ownerRepository = createVerifiedOwnerPostgresRepositoryV1(
      contract,
      deployment,
      pool,
    );
    return Object.freeze({
      deployment,
      postgres,
      repository: ownerRepository.repository,
      unit_of_work: ownerRepository.unit_of_work,
      async checkReadiness(): Promise<void> {
        await postgres.query("SELECT 1 AS owner_postgres_ready");
      },
      async close(): Promise<void> {
        await pool.end();
      },
    });
  } catch (error) {
    await pool.end();
    throw error;
  }
}

type OwnerPostgresValueV1<TType extends OwnerPostgresTypeV1> =
  TType extends "text" | "bigint" | "timestamptz"
    ? string | null
    : TType extends "integer"
      ? number | null
      : TType extends "boolean"
        ? boolean | null
        : Readonly<Record<string, unknown>> | readonly unknown[] | null;

type OwnerWriterSignatureForV1<
  TContract extends OwnerRepositoryContractV1,
  TWriter extends OwnerWriterNameV1<TContract>,
> = Extract<TContract["function_signatures"][number], { function_name: TWriter }>;

type OwnerWriterArgumentsV1<
  TContract extends OwnerRepositoryContractV1,
  TWriter extends OwnerWriterNameV1<TContract>,
> = OwnerWriterSignatureForV1<TContract, TWriter>["arguments"] extends infer TArguments extends
  readonly OwnerFunctionArgumentV1[]
  ? {
      readonly [TArgument in TArguments[number] as TArgument["argument_name"]]:
        OwnerPostgresValueV1<TArgument["postgres_type"]>;
    }
  : never;

export interface ExecuteOwnerWriterRequestV1<
  TContract extends OwnerRepositoryContractV1,
  TWriter extends OwnerWriterNameV1<TContract>,
> {
  readonly writer: TWriter;
  readonly arguments: OwnerWriterArgumentsV1<TContract, TWriter>;
  readonly expected_rows: 1 | "one_or_more";
}

/**
 * Mutation adapters may invoke only the owner-generated writer registry. Direct
 * table INSERT/UPDATE/DELETE and cross-owner SQL are intentionally absent.
 */
export interface OwnerRepositoryPortV1<
  TContract extends OwnerRepositoryContractV1,
> {
  readonly contract: TContract;
  readonly deployment: VerifiedOwnerRepositoryDeploymentV1<
    TContract["owner_service"]
  >;
  executeWriter<TResult, const TWriter extends OwnerWriterNameV1<TContract>>(
    transaction: OwnerTransactionV1<TContract["owner_service"]>,
    request: ExecuteOwnerWriterRequestV1<TContract, TWriter>,
  ): Promise<TResult>;
}

export interface OwnerUnitOfWorkRequestV1 {
  readonly operation: string;
  readonly idempotency_key: string;
  readonly trace_id: string;
  readonly isolation: "read_committed" | "repeatable_read" | "serializable";
  readonly retry: "none" | "serialization_failures";
}

/**
 * State, audit and outbox mutations for one business operation must be invoked
 * through the repositories supplied to this single callback.
 */
export interface OwnerUnitOfWorkPortV1<
  TService extends OwnerDatabaseServiceIdV1,
  TRepositories,
> {
  readonly owner_service: TService;
  withTransaction<TResult>(
    request: OwnerUnitOfWorkRequestV1,
    work: (
      transaction: OwnerTransactionV1<TService>,
      repositories: TRepositories,
    ) => Promise<TResult>,
  ): Promise<TResult>;
}

function postgresArgumentCast(type: OwnerPostgresTypeV1): string {
  return type === "timestamptz" ? "timestamp with time zone" : type;
}

function isSerializationFailure(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === "40001"
  );
}

export class OwnerRepositoryTransientErrorV1 extends Error {
  public constructor(
    public readonly code:
      | "serialization_retry_exhausted"
      | "transient_database_error",
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "OwnerRepositoryTransientErrorV1";
  }
}

/**
 * The only generic execution adapter for owner writers. It cannot be created
 * without the live PostgreSQL-derived deployment capability, and every call is
 * bound to a transaction opened by the paired unit of work.
 */
export function createVerifiedOwnerPostgresRepositoryV1<
  const TContract extends OwnerRepositoryContractV1,
>(
  contract: TContract,
  deployment: VerifiedOwnerRepositoryDeploymentV1<
    TContract["owner_service"]
  >,
  pool: Pool,
): Readonly<{
  repository: OwnerRepositoryPortV1<TContract>;
  unit_of_work: OwnerUnitOfWorkPortV1<
    TContract["owner_service"],
    Readonly<{ owner: OwnerRepositoryPortV1<TContract> }>
  >;
}> {
  if (
    deployment[verifiedOwnerDeploymentBrand] !== true ||
    deployment.owner_service !== contract.owner_service ||
    deployment.contract_fingerprint !== fingerprint(contract)
  ) {
    throw new Error(
      `verified deployment capability does not match ${contract.owner_service}`,
    );
  }
  const clients = new WeakMap<object, PoolClient>();
  const repository: OwnerRepositoryPortV1<TContract> = Object.freeze({
    contract,
    deployment,
    async executeWriter<
      TResult,
      const TWriter extends OwnerWriterNameV1<TContract>,
    >(
      transaction: OwnerTransactionV1<TContract["owner_service"]>,
      request: ExecuteOwnerWriterRequestV1<TContract, TWriter>,
    ): Promise<TResult> {
      const client = clients.get(transaction);
      if (
        client === undefined ||
        transaction.owner_service !== contract.owner_service
      ) {
        throw new Error("owner writer requires its active unit-of-work transaction");
      }
      const signature = contract.function_signatures.find(
        ({ function_name }) => function_name === request.writer,
      );
      if (signature === undefined) {
        throw new Error(`unknown owner writer: ${String(request.writer)}`);
      }
      const argumentRecord = request.arguments as Readonly<
        Record<string, unknown>
      >;
      const values = signature.arguments.map(
        ({ argument_name }) => argumentRecord[argument_name],
      );
      if (
        Object.keys(argumentRecord).length !== signature.arguments.length ||
        signature.arguments.some(
          ({ argument_name }) => !(argument_name in argumentRecord),
        )
      ) {
        throw new Error(
          `owner writer argument drift: ${contract.schema}.${signature.function_name}`,
        );
      }
      const placeholders = signature.arguments
        .map(
          ({ postgres_type }, index) =>
            `$${index + 1}::${postgresArgumentCast(postgres_type)}`,
        )
        .join(", ");
      const invocation = `${contract.schema}.${signature.function_name}(${placeholders})`;
      const result =
        signature.returns === "setof jsonb"
          ? await client.query<{ result: TResult }>(
              `SELECT value AS result FROM ${invocation} AS value`,
              values,
            )
          : await client.query<{ result: TResult }>(
              `SELECT ${invocation} AS result`,
              values,
            );
      if (
        (request.expected_rows === 1 && result.rows.length !== 1) ||
        (request.expected_rows === "one_or_more" && result.rows.length === 0)
      ) {
        throw new Error(
          `owner writer row-count drift: ${contract.schema}.${signature.function_name}`,
        );
      }
      return (signature.returns === "setof jsonb"
        ? result.rows.map(({ result: value }) => value)
        : result.rows[0]?.result) as TResult;
    },
  });
  const isolationSql = {
    read_committed: "READ COMMITTED",
    repeatable_read: "REPEATABLE READ",
    serializable: "SERIALIZABLE",
  } as const;
  const unitOfWork: OwnerUnitOfWorkPortV1<
    TContract["owner_service"],
    Readonly<{ owner: OwnerRepositoryPortV1<TContract> }>
  > = Object.freeze({
    owner_service: contract.owner_service,
    async withTransaction<TResult>(
      request: OwnerUnitOfWorkRequestV1,
      work: (
        transaction: OwnerTransactionV1<TContract["owner_service"]>,
        repositories: Readonly<{ owner: OwnerRepositoryPortV1<TContract> }>,
      ) => Promise<TResult>,
    ): Promise<TResult> {
      const maxAttempts = request.retry === "serialization_failures" ? 3 : 1;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const client = await pool.connect();
        const transaction = Object.freeze({
          owner_service: contract.owner_service,
          transaction_id: randomUUID(),
          trace_id: request.trace_id,
          started_at: new Date().toISOString(),
          attempt,
        }) as unknown as OwnerTransactionV1<TContract["owner_service"]>;
        clients.set(transaction, client);
        try {
          await client.query(
            `BEGIN ISOLATION LEVEL ${isolationSql[request.isolation]}`,
          );
          const result = await work(transaction, { owner: repository });
          await client.query("COMMIT");
          return result;
        } catch (error) {
          await client.query("ROLLBACK").catch(() => undefined);
          if (isSerializationFailure(error) && attempt === maxAttempts) {
            throw new OwnerRepositoryTransientErrorV1(
              "serialization_retry_exhausted",
              `owner unit of work exhausted serialization retries for ${request.operation}`,
              { cause: error },
            );
          }
          if (!isSerializationFailure(error)) {
            throw error;
          }
        } finally {
          clients.delete(transaction);
          client.release();
        }
      }
      throw new Error("owner unit of work exhausted serialization retries");
    },
  });
  return Object.freeze({ repository, unit_of_work: unitOfWork });
}

export type AssertOwnerServiceV1<T extends ServiceIdV1> =
  T extends OwnerDatabaseServiceIdV1 ? T : never;
