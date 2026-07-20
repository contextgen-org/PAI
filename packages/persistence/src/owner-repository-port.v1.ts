import type { ServiceIdV1 } from "@pai/contracts";

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
  | "outbox_claim_ack";

export interface OwnerTablePermissionV1<TTable extends string = string> {
  readonly table_name: TTable;
  readonly select_columns: readonly string[];
  readonly insert_columns: readonly [];
  readonly update_columns: readonly [];
  readonly delete_allowed: false;
  readonly writer_kind: OwnerWriterKindV1;
}

export interface OwnerFunctionArgumentV1 {
  readonly argument_name: string;
  readonly postgres_type:
    | "text"
    | "bigint"
    | "integer"
    | "boolean"
    | "jsonb"
    | "timestamptz";
  readonly mode: "in";
}

export interface OwnerFunctionSignatureV1<
  TSchema extends string = string,
  TTable extends string = string,
  TWriter extends string = string,
> {
  readonly schema: TSchema;
  readonly function_name: TWriter;
  readonly primary_table: TTable;
  readonly writer_kind: OwnerWriterKindV1;
  readonly arguments: readonly OwnerFunctionArgumentV1[];
  readonly returns: "jsonb" | "setof jsonb";
  readonly security_definer: true;
  readonly search_path: readonly [TSchema, "pg_temp"];
}

export interface OwnerRepositoryContractV1<
  TService extends OwnerDatabaseServiceIdV1 = OwnerDatabaseServiceIdV1,
  TTable extends string = string,
  TWriter extends string = string,
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
  readonly function_signatures: readonly OwnerFunctionSignatureV1<
    (typeof OWNER_DATABASE_TARGETS_V1)[TService]["schema"],
    TTable,
    TWriter
  >[];
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
  "outbox_claim_ack",
]);

const standardArguments = {
  immutable_append: [
    ["p_idempotency_key", "text"],
    ["p_request_hash", "text"],
    ["p_body", "jsonb"],
    ["p_trace_id", "text"],
  ],
  projection_upsert: [
    ["p_projection_key", "text"],
    ["p_expected_version", "bigint"],
    ["p_request_hash", "text"],
    ["p_body", "jsonb"],
    ["p_trace_id", "text"],
  ],
  state_transition: [
    ["p_entity_id", "text"],
    ["p_expected_state", "text"],
    ["p_next_state", "text"],
    ["p_expected_version", "bigint"],
    ["p_request_hash", "text"],
    ["p_body", "jsonb"],
    ["p_trace_id", "text"],
  ],
  pointer_cas: [
    ["p_pointer_key", "text"],
    ["p_expected_version", "bigint"],
    ["p_next_ref", "text"],
    ["p_request_hash", "text"],
    ["p_trace_id", "text"],
  ],
  lease_fence: [
    ["p_entity_id", "text"],
    ["p_expected_generation", "bigint"],
    ["p_expected_fence", "text"],
    ["p_next_lease", "jsonb"],
    ["p_request_hash", "text"],
    ["p_trace_id", "text"],
  ],
} as const;

const outboxClaimArguments = [
  ["p_worker_id", "text"],
  ["p_limit", "integer"],
  ["p_lease_seconds", "integer"],
  ["p_now", "timestamptz"],
] as const;

const outboxAckArguments = [
  ["p_outbox_id", "text"],
  ["p_claim_token", "text"],
  ["p_outcome", "text"],
  ["p_next_retry_at", "timestamptz"],
  ["p_error_class", "text"],
] as const;

export function ownerFunctionSignatureV1<
  const TSchema extends OwnerSchemaV1,
  const TTable extends string,
  const TWriter extends string,
>(input: {
  readonly schema: TSchema;
  readonly function_name: TWriter;
  readonly primary_table: TTable;
  readonly writer_kind: Exclude<OwnerWriterKindV1, "outbox_claim_ack">;
}): OwnerFunctionSignatureV1<TSchema, TTable, TWriter>;
export function ownerFunctionSignatureV1<
  const TSchema extends OwnerSchemaV1,
  const TTable extends string,
  const TWriter extends string,
>(input: {
  readonly schema: TSchema;
  readonly function_name: TWriter;
  readonly primary_table: TTable;
  readonly writer_kind: "outbox_claim_ack";
  readonly outbox_operation: "claim" | "ack";
}): OwnerFunctionSignatureV1<TSchema, TTable, TWriter>;
export function ownerFunctionSignatureV1(
  input: {
    readonly schema: OwnerSchemaV1;
    readonly function_name: string;
    readonly primary_table: string;
    readonly writer_kind: OwnerWriterKindV1;
    readonly outbox_operation?: "claim" | "ack";
  },
): OwnerFunctionSignatureV1 {
  const outboxArguments =
    input.outbox_operation === "claim"
      ? outboxClaimArguments
      : outboxAckArguments;
  const pairs =
    input.writer_kind === "outbox_claim_ack"
      ? outboxArguments
      : standardArguments[input.writer_kind];
  const signature: OwnerFunctionSignatureV1 = {
    schema: input.schema,
    function_name: input.function_name,
    primary_table: input.primary_table,
    writer_kind: input.writer_kind,
    arguments: pairs.map(([argument_name, postgres_type]) =>
      Object.freeze({
        argument_name,
        postgres_type,
        mode: "in" as const,
      }),
    ),
    returns:
      input.writer_kind === "outbox_claim_ack" &&
      input.outbox_operation === "claim"
        ? "setof jsonb"
        : "jsonb",
    security_definer: true,
    search_path: [input.schema, "pg_temp"],
  };
  Object.freeze(signature.arguments);
  Object.freeze(signature.search_path);
  return Object.freeze(signature);
}

export function defineOwnerRepositoryContractV1<
  const TService extends OwnerDatabaseServiceIdV1,
  const TTable extends string,
  const TWriter extends string,
>(
  contract: OwnerRepositoryContractV1<TService, TTable, TWriter>,
): OwnerRepositoryContractV1<TService, TTable, TWriter> {
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
  for (const signature of contract.function_signatures) {
    const tablePermission = permissionByTable.get(signature.primary_table);
    const expectedArguments =
      signature.writer_kind === "outbox_claim_ack"
        ? signature.returns === "setof jsonb"
          ? outboxClaimArguments
          : outboxAckArguments
        : standardArguments[signature.writer_kind];
    const expectedReturn =
      signature.writer_kind === "outbox_claim_ack" &&
      signature.returns === "setof jsonb"
        ? "setof jsonb"
        : "jsonb";
    if (
      signature.schema !== contract.schema ||
      tablePermission?.writer_kind !== signature.writer_kind ||
      signature.security_definer !== true ||
      signature.search_path.length !== 2 ||
      signature.search_path[0] !== contract.schema ||
      signature.search_path[1] !== "pg_temp" ||
      signature.returns !== expectedReturn ||
      signature.arguments.length !== expectedArguments.length ||
      signature.arguments.some(
        (argument, index) =>
          argument.argument_name !== expectedArguments[index]?.[0] ||
          argument.postgres_type !== expectedArguments[index]?.[1] ||
          argument.mode !== "in",
      )
    ) {
      throw new Error(
        `invalid generated writer signature: ${contract.schema}.${signature.function_name}`,
      );
    }
    assertUniqueIdentifiers(
      `${signature.function_name}.arguments`,
      signature.arguments.map(({ argument_name }) => argument_name),
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

export type OwnerAppendOnlyTableV1<
  TContract extends OwnerRepositoryContractV1,
> = TContract["append_only_tables"][number];

export interface ExecuteOwnerWriterRequestV1<TWriter extends string> {
  readonly writer: TWriter;
  readonly arguments: Readonly<Record<string, unknown>>;
  readonly expected_rows: 1 | "one_or_more";
}

export interface AppendOwnerRowRequestV1<TTable extends string> {
  readonly table: TTable;
  readonly row: Readonly<Record<string, unknown>>;
}

/**
 * Mutation adapters may invoke only the owner-generated writer registry. Direct
 * table INSERT/UPDATE/DELETE and cross-owner SQL are intentionally absent.
 */
export interface OwnerRepositoryPortV1<
  TContract extends OwnerRepositoryContractV1,
> {
  readonly contract: TContract;
  executeWriter<TResult>(
    transaction: OwnerTransactionV1<TContract["owner_service"]>,
    request: ExecuteOwnerWriterRequestV1<OwnerWriterNameV1<TContract>>,
  ): Promise<TResult>;
  appendImmutable<TResult>(
    transaction: OwnerTransactionV1<TContract["owner_service"]>,
    request: AppendOwnerRowRequestV1<OwnerAppendOnlyTableV1<TContract>>,
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

export type AssertOwnerServiceV1<T extends ServiceIdV1> =
  T extends OwnerDatabaseServiceIdV1 ? T : never;
