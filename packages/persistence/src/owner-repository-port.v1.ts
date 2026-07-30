import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { isIP } from "node:net";
import { checkServerIdentity } from "node:tls";
import { isProxy } from "node:util/types";

import type { ServiceIdV1 } from "@pai/contracts";
import { Pool, type PoolClient, type PoolConfig } from "pg";

import {
  checkOwnerPostgresReadinessV1,
  withAbortableOwnerPostgresCatalogSnapshotV1,
} from "./owner-postgres-readiness.v1.js";

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

const OWNER_DATABASE_SCHEMAS_V1 = Object.freeze([
  ...new Set(
    Object.values(OWNER_DATABASE_TARGETS_V1).map(({ schema }) => schema),
  ),
]);

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
  /** Omitted metadata is fail-closed and therefore equivalent to false. */
  readonly nullable?: boolean | undefined;
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
    | "ack"
    | "redrive_claim"
    | "redrive_ack"
    | "reconcile_mark_missing"
    | "reconcile_claim"
    | "reconcile_ack_present"
    | "reconcile_ack_rematerialized"
    | "reconcile_ack_permanent_failure";
  readonly concurrency_control:
    | "idempotency_key"
    | "durable_event_identity"
    | "expected_state_version"
    | "expected_version"
    | "generation_fence"
    | "slot_and_process_state_fence"
    | "catalog_baseline_fence"
    | "database_row_lock"
    | "advisory_identity_lock"
    | "lease_fence"
    | "promotion_reservation_fence"
    | "reconciliation_fence";
  /**
   * Exact transaction-level advisory-lock identity. Omission retains the V1
   * single-runtime-run key for existing Action Runtime writers; multi-part
   * cross-service fences must declare every key component explicitly.
   */
  readonly advisory_lock?: Readonly<{
    readonly key_prefix: string;
    readonly identity_arguments: readonly string[];
    /**
     * The only V1 identity derived from a durably locked row rather than an
     * RPC argument.  It is reserved for a companion state transition made by
     * an outbox claim writer: the claim first locks the outbox candidate, then
     * derives the aggregate identity from that row before touching the
     * companion owner state.
     */
    readonly identity_source?: "claimed_outbox_aggregate_id";
    readonly separator: ":";
    readonly order: number;
  }>;
  /**
   * Optional read-side authority row locked before the mutation. This is only
   * valid with database_row_lock; it prevents a writer from claiming that the
   * row it mutates is also the row whose state authorizes the mutation.
   */
  readonly lock_table_name?: TTable;
  /**
   * A batched lease claim must select its candidates under one PostgreSQL
   * `FOR UPDATE SKIP LOCKED` lock before updating them.  Keeping this as
   * explicit contract metadata prevents a plain, racing status scan from
   * masquerading as a durable worker claim.
   */
  readonly claim_locking?: "for_update_skip_locked";
  /**
   * Exact owner columns mutated by a batched lease claim. Generation is
   * server-incremented for every takeover; the caller never chooses it.
   */
  readonly claim_fence?: Readonly<{
    identity_column: string;
    status_column: string;
    eligible_status: string;
    worker_column: string;
    lease_expires_at_column: string;
    generation_column: string;
    order_by_columns: readonly string[];
  }>;
  /**
   * Cross-table owner/lease authority that makes a reconciliation row
   * eligible. A claim may not race the still-active lease that created it.
   */
  readonly claim_authority?: Readonly<{
    owner_table_name: TTable;
    owner_identity_column: string;
    claimed_owner_identity_column: string;
    originating_lease_generation_column: string;
    lease_table_name: TTable;
    lease_owner_identity_column: string;
    lease_generation_column: string;
    lease_expires_at_column: string;
    lease_state_column: string;
    active_lease_state: string;
  }>;
  /**
   * Server-authoritative aggregate identities checked against active,
   * unexpired Memory promotion reservations. Caller-supplied "no
   * reservation" flags are intentionally not representable.
   */
  readonly promotion_reservation_targets?: readonly (
    | Readonly<{
        aggregate_type:
          | "memory_point"
          | "memory_series"
          | "memory_conflict";
        id_argument: string;
        id_json_key?: string;
      }>
    | Readonly<{
        aggregate_type_argument: string;
        id_argument: string;
      }>
  )[];
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

export interface OwnerWriterArtifactV1<TWriter extends string = string> {
  readonly artifact_version: "owner_writer_artifact.v1";
  readonly generator: "pai-infra-owner-writer.v1";
  readonly generator_source: string;
  readonly function_name: TWriter;
  readonly signature_fingerprint: string;
  readonly function_body_sha256: string;
}

/**
 * Exact, non-bypassable guard for an append-only owner table. These triggers
 * are deliberately narrower than mutable writers: they may only reject UPDATE
 * and DELETE, never mutate state or expose an application-callable routine.
 */
export interface OwnerImmutableTriggerV1<TTable extends string = string> {
  readonly trigger_name: string;
  readonly table_name: TTable;
  readonly function_name: string;
  readonly timing: "before";
  readonly events: readonly ["update", "delete"];
  readonly orientation: "row";
  readonly enabled_mode: "origin";
  readonly function_body_sha256: string;
}

/** Exact catalog artifact for a non-internal owner trigger. */
export interface OwnerDatabaseTriggerV1<TTable extends string = string> {
  readonly trigger_name: string;
  readonly table_name: TTable;
  readonly trigger_type: number;
  readonly trigger_argument_count: number;
  readonly update_columns: string;
  readonly constraint_trigger: boolean;
  readonly has_when_clause: boolean;
  readonly has_old_transition_table: boolean;
  readonly has_new_transition_table: boolean;
  readonly enabled_mode: string;
  readonly function_schema: string;
  readonly function_name: string;
  readonly security_definer: boolean;
  readonly settings: readonly string[] | null;
  readonly language_name: "plpgsql";
  readonly function_body_sha256: string;
}

/** Exact catalog artifact for a private, non-writer owner helper function. */
export interface OwnerDatabaseFunctionV1 {
  readonly function_name: string;
  readonly security_definer: boolean;
  readonly settings: readonly string[] | null;
  readonly strict: boolean;
  readonly volatility: string;
  readonly parallel_safety: string;
  readonly leakproof: boolean;
  readonly function_kind: string;
  readonly default_argument_count: number;
  readonly identity_arguments: string;
  readonly argument_names: readonly string[] | null;
  readonly argument_types: readonly string[] | null;
  readonly returns_set: boolean;
  readonly result_type: string;
  readonly language_name: "plpgsql" | "sql";
  readonly function_body_sha256: string;
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
  readonly semantic_constraint?:
    | Readonly<{
        kind: "text_enum";
        column_name: string;
        allowed_values: readonly string[];
      }>
    | Readonly<{
        kind: "text_equals";
        column_name: string;
        value: string;
      }>
    | Readonly<{
        kind: "text_identity_prefix";
        column_name: string;
        prefix: string;
        identity_column_name: string;
      }>
    | Readonly<{
        kind: "text_regex";
        column_name: string;
        pattern: string;
      }>
    | Readonly<{
        kind: "text_array_bounded_no_null";
        column_name: string;
        max_items: number;
      }>
    | Readonly<{
        kind: "permission_summary_entry_branch";
        column_name: string;
        revision_value: string;
        default_deny_value: string;
        decision_column_name: string;
        deny_value: string;
        revision_required_columns: readonly string[];
        default_null_columns: readonly string[];
        default_empty_array_column_name: string;
      }>
    | Readonly<{
        kind: "octet_length_min";
        column_name: string;
        min: number;
      }>
    | Readonly<{
        kind: "column_order";
        column_name: string;
        operator: ">";
        other_column_name: string;
      }>
    | Readonly<{
        kind: "json_text_equals";
        column_name: string;
        field_name: string;
        value: string;
        allow_additional_keys: boolean;
        required_keys: readonly string[];
      }>
    | Readonly<{
        kind: "json_discriminator";
        column_name: string;
        payload_column_name: string;
        payload_field_name: string;
        branches: readonly Readonly<{
          discriminator_value: string;
          payload_field_value: string;
        }>[];
      }>
    | Readonly<{
        kind: "json_event_envelope";
        column_name: string;
        producer_value: string;
        allow_additional_keys: boolean;
        required_keys: readonly string[];
        field_bindings: readonly Readonly<{
          field_name: string;
          column_name: string;
        }>[];
      }>
    | Readonly<{
        kind: "column_event_envelope";
        column_name: string;
        producer_column_name: string;
        producer_value: string;
        schema_version_column_name: string;
        schema_version_value: string;
        event_type_column_name: string;
        event_type_allowed_values: readonly string[];
      }>
    | Readonly<{
        kind: "column_command_envelope";
        column_name: string;
        producer_column_name: string;
        producer_value: string;
        schema_version_column_name: string;
        schema_version_value: string;
        target_column_name: string;
        payload_column_name: string;
        commands: readonly Readonly<{
          command_type: string;
          target: string;
          payload_schema_version: string;
        }>[];
      }>
    | Readonly<{
        kind: "integer_range";
        column_name: string;
        min: number;
        max: number;
      }>
    | Readonly<{
        kind: "nullable_integer_range";
        column_name: string;
        min: number;
        max: number;
      }>
    | Readonly<{
        kind: "nullable_versioned_identity";
        column_name: string;
        version_column_name: string;
        hash_column_name: string;
        retention_column_name?: string;
        min_version: number;
        max_version: number;
      }>
    | Readonly<{
        kind: "integer_ranges";
        column_name: string;
        ranges: readonly Readonly<{
          column_name: string;
          min: number;
          max: number;
          nullable: boolean;
        }>[];
      }>
    | Readonly<{
        kind: "integer_successor";
        column_name: string;
        previous_column_name: string;
      }>
    | Readonly<{
        kind: "nullable_text_enum";
        column_name: string;
        allowed_values: readonly string[];
      }>
    | Readonly<{
        kind: "implies_not_null";
        column_name: string;
        condition_column_name: string;
        condition_equals: string;
      }>
    | Readonly<{
        kind: "iff_not_null";
        column_name: string;
        condition_column_name: string;
        condition_equals: string;
        require_non_empty: boolean;
      }>;
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

export interface OwnerDatabaseIndexV1<TTable extends string = string> {
  readonly index_name: string;
  readonly table_name: TTable;
  readonly definition: string;
  readonly unique: boolean;
  readonly primary: boolean;
  readonly valid: boolean;
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

export interface OwnerDlqResolutionBindingV1<
  TTable extends string = string,
  TWriter extends string = string,
> {
  readonly dlq_table: TTable;
  readonly resolution_table: TTable;
  readonly resolve_writer: TWriter;
}

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
  readonly writer_artifacts?: readonly OwnerWriterArtifactV1<TWriter>[];
  /** Exact version-pinned catalog snapshot for private owner helpers. */
  readonly database_functions?: readonly OwnerDatabaseFunctionV1[];
  /** Exact version-pinned catalog snapshot for non-internal owner triggers. */
  readonly database_triggers?: readonly OwnerDatabaseTriggerV1<TTable>[];
  /** Omission means that every non-internal trigger remains forbidden. */
  readonly immutable_triggers?: readonly OwnerImmutableTriggerV1<TTable>[];
  readonly foreign_key_snapshot: OwnerForeignKeySnapshotV1;
  readonly foreign_keys: readonly OwnerForeignKeyV1<TTable>[];
  readonly database_checks?: readonly OwnerDatabaseCheckV1<TTable>[];
  readonly database_columns?: readonly OwnerDatabaseColumnV1<TTable>[];
  readonly database_unique_constraints?: readonly OwnerDatabaseUniqueConstraintV1<TTable>[];
  readonly database_indexes?: readonly OwnerDatabaseIndexV1<TTable>[];
  readonly append_only_tables: readonly TTable[];
  readonly outbox_tables: readonly TTable[];
  readonly inbox_tables: readonly TTable[];
  readonly dlq_tables: readonly TTable[];
  /**
   * Optional during migration. Once present it must cover every DLQ exactly
   * once and each binding is validated as an immutable resolution fact.
   */
  readonly dlq_resolutions?: readonly OwnerDlqResolutionBindingV1<
    TTable,
    TWriter
  >[];
  readonly object_metadata_tables: readonly TTable[];
}

const sqlIdentifierPattern = /^[a-z][a-z0-9_]*$/;
const sourcePattern = /^(?:services|packages)\/[a-z0-9-]+\/src\/.+\.ts$/;
const migrationPattern = /^\d{4}(?:\/\d{4})?_[a-z0-9_]+$/;
const generatedPermissionPattern =
  /^pai-infra\/supabase\/generated\/permissions\/\d{4}_[a-z0-9_]+\.sql$/;
export const OWNER_EVENTING_TRANSPORT_EPOCH_TABLE_V1 =
  "eventing_transport_epochs" as const;
export const OWNER_EVENTING_TRANSPORT_EPOCH_WRITER_V1 =
  "activate_eventing_transport_epoch_v1" as const;
export const OWNER_SAFE_BIGINT_MAX_V1 = Number.MAX_SAFE_INTEGER;
export const OWNER_OUTBOX_BATCH_MAX_V1 = 16;
const ownerEventingTransportEpochColumnsV1 = Object.freeze([
  "transport_name",
  "active_epoch",
  "active_generation",
  "activated_at",
] as const);
const ownerEventingReconciliationRequiredExistingColumnsV1 = Object.freeze([
  "id",
  "status",
  "attempt_count",
  "transport_ref",
  "transport_epoch",
  "transport_generation",
  "sent_at",
  "updated_at",
] as const);
const ownerEventingReconciliationAddedColumnsV1 = Object.freeze([
  "reconciliation_missing_at",
  "reconciliation_missing_reporter",
  "reconciliation_next_probe_at",
  "reconciliation_claimed_by",
  "reconciliation_claim_token",
  "reconciliation_claim_generation",
  "reconciliation_locked_until",
] as const);
export const OWNER_EVENTING_RECONCILIATION_NEXT_PROBE_SEMANTICS_V1 =
  Object.freeze({
    clock_authority: "postgres_clock_timestamp" as const,
    claim_lease: "database_now_plus_bounded_lease_seconds" as const,
    acknowledgment_schedule:
      "database_now_plus_bounded_probe_interval_ms" as const,
    null_next_probe: "due_immediately" as const,
    previous_generation:
      "due_immediately_regardless_of_next_probe" as const,
    reported_missing:
      "due_immediately_regardless_of_next_probe" as const,
    current_generation: "due_when_next_probe_at_lte_now" as const,
    deleted_ref_update:
      "least_existing_or_observed_at_with_null_as_observed_at" as const,
  });

export type OwnerEventingReconciliationWriterNameV1<
  TOutboxTable extends string = string,
> =
  | `record_${TOutboxTable}_deleted_transport_refs_v1`
  | `claim_${TOutboxTable}_reconciliation_v1`
  | `ack_${TOutboxTable}_transport_present_v1`
  | `ack_${TOutboxTable}_rematerialized_v1`
  | `ack_${TOutboxTable}_permanent_failure_v1`;

export type OwnerEventingReconciliationDlqTableNameV1<
  TOutboxTable extends string = string,
> = TOutboxTable extends `${infer Prefix}_outbox`
  ? `${Prefix}_dlq`
  : `${TOutboxTable}_dlq`;

export interface OwnerEventingReconciliationContractV1<
  TSchema extends OwnerSchemaV1 = OwnerSchemaV1,
  TOutboxTable extends string = string,
> {
  readonly outbox_table: TOutboxTable;
  /** Physical prerequisites; these are not app_role SELECT grants. */
  readonly required_existing_columns: readonly string[];
  readonly database_columns: readonly OwnerDatabaseColumnV1<TOutboxTable>[];
  readonly database_checks: readonly OwnerDatabaseCheckV1<TOutboxTable>[];
  readonly database_indexes: readonly OwnerDatabaseIndexV1<TOutboxTable>[];
  readonly mutable_writers: readonly OwnerEventingReconciliationWriterNameV1<TOutboxTable>[];
  readonly function_signatures: readonly OwnerFunctionSignatureV1<
    TSchema,
    | TOutboxTable
    | OwnerEventingReconciliationDlqTableNameV1<TOutboxTable>
    | typeof OWNER_EVENTING_TRANSPORT_EPOCH_TABLE_V1,
    OwnerEventingReconciliationWriterNameV1<TOutboxTable>
  >[];
  readonly next_probe_semantics: typeof OWNER_EVENTING_RECONCILIATION_NEXT_PROBE_SEMANTICS_V1;
}

export type OwnerDlqResolutionTableNameV1<TDlqTable extends string = string> =
  `${TDlqTable}_resolutions`;
export type OwnerDlqResolutionWriterNameV1<TDlqTable extends string = string> =
  `resolve_${TDlqTable}_v1`;

export interface OwnerDlqResolutionContractV1<
  TSchema extends OwnerSchemaV1 = OwnerSchemaV1,
  TDlqTable extends string = string,
> {
  readonly binding: Readonly<{
    dlq_table: TDlqTable;
    resolution_table: OwnerDlqResolutionTableNameV1<TDlqTable>;
    resolve_writer: OwnerDlqResolutionWriterNameV1<TDlqTable>;
  }>;
  readonly resolution_table: OwnerDlqResolutionTableNameV1<TDlqTable>;
  readonly table_permission: OwnerTablePermissionV1<
    OwnerDlqResolutionTableNameV1<TDlqTable>
  >;
  readonly database_columns: readonly OwnerDatabaseColumnV1<
    OwnerDlqResolutionTableNameV1<TDlqTable>
  >[];
  readonly foreign_keys: readonly OwnerForeignKeyV1<
    TDlqTable | OwnerDlqResolutionTableNameV1<TDlqTable>
  >[];
  readonly database_unique_constraints: readonly OwnerDatabaseUniqueConstraintV1<
    OwnerDlqResolutionTableNameV1<TDlqTable>
  >[];
  readonly database_indexes: readonly OwnerDatabaseIndexV1<
    OwnerDlqResolutionTableNameV1<TDlqTable>
  >[];
  readonly mutable_writers: readonly OwnerDlqResolutionWriterNameV1<TDlqTable>[];
  readonly function_signatures: readonly OwnerFunctionSignatureV1<
    TSchema,
    TDlqTable | OwnerDlqResolutionTableNameV1<TDlqTable>,
    OwnerDlqResolutionWriterNameV1<TDlqTable>
  >[];
}

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
const effectOperations = new Set<OwnerFunctionEffectV1["operation"]>([
  "append", "upsert", "transition", "cas", "enqueue", "claim", "ack",
  "redrive_claim", "redrive_ack", "reconcile_mark_missing",
  "reconcile_claim", "reconcile_ack_present",
  "reconcile_ack_rematerialized", "reconcile_ack_permanent_failure",
]);
const concurrencyControls = new Set<
  OwnerFunctionEffectV1["concurrency_control"]
>([
  "idempotency_key",
  "durable_event_identity",
  "expected_state_version",
  "expected_version",
  "generation_fence",
  "slot_and_process_state_fence",
  "catalog_baseline_fence",
  "database_row_lock",
  "advisory_identity_lock",
  "lease_fence",
  "promotion_reservation_fence",
  "reconciliation_fence",
]);

const operationsByWriterKind: Readonly<
  Record<OwnerWriterKindV1, ReadonlySet<OwnerFunctionEffectV1["operation"]>>
> = {
  immutable_append: new Set(["append"]),
  projection_upsert: new Set(["upsert"]),
  state_transition: new Set(["append", "enqueue", "transition", "claim"]),
  // Pointer rows need one idempotent creation path before later compare-and-
  // swap transitions can lock them. The effect is still explicit per writer;
  // this does not grant direct table DML to the application role.
  pointer_cas: new Set(["append", "upsert", "cas"]),
  lease_fence: new Set(["upsert", "cas", "claim", "ack", "transition"]),
  outbox_claim_ack: new Set([
    "enqueue",
    "claim",
    "ack",
    "redrive_claim",
    "redrive_ack",
    "reconcile_mark_missing",
    "reconcile_claim",
    "reconcile_ack_present",
    "reconcile_ack_rematerialized",
    "reconcile_ack_permanent_failure",
  ]),
};

function reconciliationFenceArgumentNames(
  operation: OwnerFunctionEffectV1["operation"],
): readonly string[] {
  if (operation === "reconcile_mark_missing") {
    return [
      "p_observed_transport_epoch",
      "p_observed_transport_generation",
    ];
  }
  if (operation === "reconcile_claim") {
    return [
      "p_worker_id",
      "p_lease_seconds",
      "p_current_transport_epoch",
      "p_current_transport_generation",
    ];
  }
  if (
    operation === "reconcile_ack_present" ||
    operation === "reconcile_ack_rematerialized" ||
    operation === "reconcile_ack_permanent_failure"
  ) {
    const common = [
      "p_outbox_id",
      "p_claim_token",
      "p_previous_transport_ref",
      "p_previous_transport_epoch",
      "p_previous_transport_generation",
      "p_current_transport_epoch",
      "p_current_transport_generation",
    ] as const;
    if (operation !== "reconcile_ack_permanent_failure") {
      return common;
    }
    return [
      ...common,
      "p_failure_code",
      "p_failure_message",
      "p_now",
    ];
  }
  return [];
}

function hasConcurrencyArgument(
  signature: OwnerFunctionSignatureV1,
  control: OwnerFunctionEffectV1["concurrency_control"],
  operation: OwnerFunctionEffectV1["operation"],
  effect?: OwnerFunctionEffectV1,
): boolean {
  const names = signature.arguments.map(({ argument_name }) => argument_name);
  if (control === "durable_event_identity") {
    return (
      (names.includes("p_source_event") || names.includes("p_event")) &&
      [
        "p_idempotency_key",
        "p_payload_hash",
        "p_semantic_hash",
        "p_scope_fingerprint",
      ].every((name) => names.includes(name))
    );
  }
  if (control === "reconciliation_fence") {
    const required = reconciliationFenceArgumentNames(operation);
    return required.length > 0 && required.every((name) => names.includes(name));
  }
  if (control === "promotion_reservation_fence") {
    const targets =
      signature.effects.find(
        (effect) =>
          effect.concurrency_control ===
            "promotion_reservation_fence" &&
          effect.operation === operation,
      )?.promotion_reservation_targets ?? [];
    const argumentByName = new Map(
      signature.arguments.map((argument) => [
        argument.argument_name,
        argument,
      ]),
    );
    return (
      signature.reads_tables.includes(
        "memory_promotion_reservations",
      ) &&
      signature.reads_tables.includes(
        "memory_promotion_reservation_targets",
      ) &&
      targets.length > 0 &&
      targets.every((target) => {
        const id = argumentByName.get(target.id_argument);
        const aggregateTypeArgument =
          "aggregate_type_argument" in target
            ? argumentByName.get(target.aggregate_type_argument)
            : undefined;
        return (
          id !== undefined &&
          id.nullable !== true &&
          (aggregateTypeArgument === undefined ||
            aggregateTypeArgument.nullable !== true)
        );
      })
    );
  }
  if (control === "slot_and_process_state_fence") {
    return (
      names.includes("p_admission_precondition") ||
      names.includes("p_admission_request")
    );
  }
  if (control === "catalog_baseline_fence") {
    return [
      "p_workspace_id",
      "p_bot_id",
      "p_deployment_environment",
      "p_release_channel",
      "p_baseline_catalog_version",
    ].every((name) => names.includes(name));
  }
  if (control === "database_row_lock") {
    return names.some(
      (name) => name === "p_process_id" || /^p_[a-z0-9_]+_id$/u.test(name),
    );
  }
  if (control === "advisory_identity_lock") {
    if (
      effect?.advisory_lock?.identity_source ===
      "claimed_outbox_aggregate_id"
    ) {
      return [
        "p_worker_id",
        "p_limit",
        "p_lease_seconds",
        "p_now",
      ].every((name) => names.includes(name));
    }
    const required = effect?.advisory_lock?.identity_arguments ?? [
      "p_runtime_run_id",
    ];
    return required.length > 0 && required.every((name) => names.includes(name));
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

const OWNER_OUTBOX_ACK_NULLABLE_ARGUMENT_NAMES_V1 = Object.freeze([
  "p_next_retry_at",
  "p_error",
  "p_transport_ref",
  "p_transport_epoch",
  "p_transport_generation",
] as const);

type OwnerOutboxAckNullableArgumentNameV1 =
  (typeof OWNER_OUTBOX_ACK_NULLABLE_ARGUMENT_NAMES_V1)[number];

type OwnerImplicitNullableArgumentNamesV1<
  TWriterKind extends OwnerWriterKindV1,
  TEffects extends readonly OwnerFunctionEffectV1[],
> = TWriterKind extends "outbox_claim_ack"
  ? Extract<TEffects[number], { operation: "ack" }> extends never
    ? never
    : OwnerOutboxAckNullableArgumentNameV1
  : never;

type OwnerFunctionArgumentsFromTuplesV1<
  TArguments extends readonly (
    readonly [
      argument_name: string,
      postgres_type: OwnerPostgresTypeV1,
      options?: Readonly<{ nullable?: boolean }>,
    ]
  )[],
  TImplicitNullableNames extends string = never,
> = {
  readonly [TIndex in keyof TArguments]: TArguments[TIndex] extends readonly [
    infer TName extends string,
    infer TType extends OwnerPostgresTypeV1,
    ...infer TRest,
  ]
    ? Readonly<
        {
          argument_name: TName;
          postgres_type: TType;
          mode: "in";
        } & (TName extends TImplicitNullableNames
          ? { nullable: true }
          : TRest extends readonly [infer TOptions]
            ? TOptions extends Readonly<{ nullable: true }>
              ? { nullable: true }
              : { nullable?: false }
            : { nullable?: false })
      >
    : never;
};

export function ownerFunctionSignatureV1<
  const TSchema extends OwnerSchemaV1,
  const TTable extends string,
  const TWriter extends string,
  const TWriterKind extends OwnerWriterKindV1,
  const TArguments extends readonly (
    readonly [
      argument_name: string,
      postgres_type: OwnerPostgresTypeV1,
      options?: Readonly<{ nullable?: boolean }>,
    ]
  )[],
  const TEffects extends readonly OwnerFunctionEffectV1<TTable>[],
>(input: {
  readonly schema: TSchema;
  readonly function_name: TWriter;
  readonly primary_table: TTable;
  readonly writer_kind: TWriterKind;
  readonly arguments: TArguments;
  readonly reads_tables: readonly TTable[];
  readonly writes_tables: readonly TTable[];
  readonly effects: TEffects;
  readonly returns: "jsonb" | "setof jsonb";
}): OwnerFunctionSignatureV1<
  TSchema,
  TTable,
  TWriter,
  OwnerFunctionArgumentsFromTuplesV1<
    TArguments,
    OwnerImplicitNullableArgumentNamesV1<TWriterKind, TEffects>
  >
> {
  const usesStandardOutboxAckNullability =
    input.writer_kind === "outbox_claim_ack" &&
    input.effects.some(({ operation }) => operation === "ack");
  const signature = {
    schema: input.schema,
    function_name: input.function_name,
    primary_table: input.primary_table,
    writer_kind: input.writer_kind,
    arguments: input.arguments.map(
      ([argument_name, postgres_type, options]) =>
        Object.freeze({
          argument_name,
          postgres_type,
          mode: "in" as const,
          ...(options?.nullable === true ||
          (usesStandardOutboxAckNullability &&
            OWNER_OUTBOX_ACK_NULLABLE_ARGUMENT_NAMES_V1.includes(
              argument_name as OwnerOutboxAckNullableArgumentNameV1,
            ))
            ? { nullable: true as const }
            : {}),
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
    OwnerFunctionArgumentsFromTuplesV1<
      TArguments,
      OwnerImplicitNullableArgumentNamesV1<TWriterKind, TEffects>
    >
  >;
  Object.freeze(signature.arguments);
  Object.freeze(signature.reads_tables);
  Object.freeze(signature.writes_tables);
  for (const effect of signature.effects) {
    if (effect.advisory_lock !== undefined) {
      Object.freeze(effect.advisory_lock.identity_arguments);
      Object.freeze(effect.advisory_lock);
    }
    Object.freeze(effect);
  }
  Object.freeze(signature.effects);
  Object.freeze(signature.search_path);
  return Object.freeze(signature);
}

export function ownerEventingTransportEpochTablePermissionV1():
  OwnerTablePermissionV1<typeof OWNER_EVENTING_TRANSPORT_EPOCH_TABLE_V1> {
  return Object.freeze({
    table_name: OWNER_EVENTING_TRANSPORT_EPOCH_TABLE_V1,
    select_columns: ownerEventingTransportEpochColumnsV1,
    insert_columns: [] as const,
    update_columns: [] as const,
    delete_allowed: false,
    writer_kind: "pointer_cas",
  });
}

export function ownerEventingTransportEpochActivationSignatureV1<
  const TSchema extends OwnerSchemaV1,
>(
  schema: TSchema,
): OwnerFunctionSignatureV1<
  TSchema,
  typeof OWNER_EVENTING_TRANSPORT_EPOCH_TABLE_V1,
  typeof OWNER_EVENTING_TRANSPORT_EPOCH_WRITER_V1
> {
  return ownerFunctionSignatureV1({
    schema,
    function_name: OWNER_EVENTING_TRANSPORT_EPOCH_WRITER_V1,
    primary_table: OWNER_EVENTING_TRANSPORT_EPOCH_TABLE_V1,
    writer_kind: "pointer_cas",
    arguments: [
      ["p_transport_name", "text"],
      ["p_expected_generation", "bigint"],
      ["p_next_epoch", "text"],
      ["p_next_generation", "bigint"],
      ["p_now", "timestamptz"],
    ],
    reads_tables: [OWNER_EVENTING_TRANSPORT_EPOCH_TABLE_V1],
    writes_tables: [OWNER_EVENTING_TRANSPORT_EPOCH_TABLE_V1],
    effects: [
      {
        table_name: OWNER_EVENTING_TRANSPORT_EPOCH_TABLE_V1,
        operation: "cas",
        concurrency_control: "generation_fence",
      },
    ],
    returns: "jsonb",
  });
}

/**
 * Canonical immutable DLQ-resolution fact. Resolution never updates the
 * original dead-letter row: one unique append records the terminal action and
 * its audit context, while idempotency_key makes retries deterministic.
 */
export function ownerDlqResolutionContractV1<
  const TSchema extends OwnerSchemaV1,
  const TDlqTable extends string,
>(
  schema: TSchema,
  dlqTable: TDlqTable,
): OwnerDlqResolutionContractV1<TSchema, TDlqTable> {
  if (!sqlIdentifierPattern.test(dlqTable)) {
    throw new Error("DLQ resolution source must be a SQL identifier");
  }
  const resolutionTable =
    `${dlqTable}_resolutions` as OwnerDlqResolutionTableNameV1<TDlqTable>;
  const resolveWriter =
    `resolve_${dlqTable}_v1` as OwnerDlqResolutionWriterNameV1<TDlqTable>;
  const primaryKeyName = `${resolutionTable}_pkey` as const;
  const dlqUniqueName = `${resolutionTable}_dlq_id_key` as const;
  const idempotencyUniqueName =
    `${resolutionTable}_idempotency_key_key` as const;
  const foreignKeyName = `${resolutionTable}_dlq_id_fkey` as const;
  for (const identifier of [
    resolutionTable,
    resolveWriter,
    primaryKeyName,
    dlqUniqueName,
    idempotencyUniqueName,
    foreignKeyName,
  ]) {
    if (!sqlIdentifierPattern.test(identifier) || identifier.length > 63) {
      throw new Error(
        `DLQ resolution identifier exceeds PostgreSQL limits: ${identifier}`,
      );
    }
  }

  const columnNames = Object.freeze([
    "resolution_id",
    "dlq_id",
    "idempotency_key",
    "resolution_kind",
    "resolution_payload",
    "resolved_by",
    "resolved_at",
  ] as const);
  const databaseColumns = Object.freeze(
    (
      [
        ["resolution_id", "text"],
        ["dlq_id", "text"],
        ["idempotency_key", "text"],
        ["resolution_kind", "text"],
        ["resolution_payload", "jsonb"],
        ["resolved_by", "text"],
        ["resolved_at", "timestamp with time zone"],
      ] as const
    ).map(([column_name, postgres_type]) =>
      Object.freeze({
        table_name: resolutionTable,
        column_name,
        postgres_type,
        not_null: true,
        default_expression: null,
        identity: "" as const,
        generated: "" as const,
      }),
    ),
  );
  const tablePermission = Object.freeze({
    table_name: resolutionTable,
    select_columns: columnNames,
    insert_columns: Object.freeze([] as const),
    update_columns: Object.freeze([] as const),
    delete_allowed: false as const,
    writer_kind: "immutable_append" as const,
  });
  const foreignKeys = Object.freeze([
    ownerForeignKeyV1<
      TSchema,
      TDlqTable | OwnerDlqResolutionTableNameV1<TDlqTable>
    >({
      schema,
      constraint_name: foreignKeyName,
      table_name: resolutionTable,
      columns: ["dlq_id"],
      referenced_table: dlqTable,
      referenced_columns: ["id"],
    }),
  ]);
  const databaseUniqueConstraints = Object.freeze(
    (
      [
        [primaryKeyName, "resolution_id", "primary_key"],
        [dlqUniqueName, "dlq_id", "unique"],
        [idempotencyUniqueName, "idempotency_key", "unique"],
      ] as const
    ).map(([constraint_name, column, kind]) =>
      Object.freeze({
        constraint_name,
        table_name: resolutionTable,
        columns: Object.freeze([column]),
        kind,
        deferrable: false,
        initially_deferred: false,
        validated: true,
      }),
    ),
  );
  const databaseIndexes = Object.freeze(
    databaseUniqueConstraints.map((constraint) =>
      Object.freeze({
        index_name: constraint.constraint_name,
        table_name: resolutionTable,
        definition:
          `CREATE UNIQUE INDEX ${constraint.constraint_name} ON ${schema}.${resolutionTable} ` +
          `USING btree (${constraint.columns[0]})`,
        unique: true,
        primary: constraint.kind === "primary_key",
        valid: true,
      }),
    ),
  );
  const signature = ownerFunctionSignatureV1({
    schema,
    function_name: resolveWriter,
    primary_table: resolutionTable,
    writer_kind: "immutable_append",
    arguments: [
      ["p_resolution_id", "text"],
      ["p_dlq_id", "text"],
      ["p_idempotency_key", "text"],
      ["p_resolution_kind", "text"],
      ["p_resolution_payload", "jsonb"],
      ["p_resolved_by", "text"],
      ["p_resolved_at", "timestamptz"],
    ],
    reads_tables: [dlqTable, resolutionTable],
    writes_tables: [resolutionTable],
    effects: [
      {
        table_name: resolutionTable,
        operation: "append",
        concurrency_control: "idempotency_key",
      },
    ],
    returns: "jsonb",
  });
  const binding = Object.freeze({
    dlq_table: dlqTable,
    resolution_table: resolutionTable,
    resolve_writer: resolveWriter,
  });
  return Object.freeze({
    binding,
    resolution_table: resolutionTable,
    table_permission: tablePermission,
    database_columns: databaseColumns,
    foreign_keys: foreignKeys,
    database_unique_constraints: databaseUniqueConstraints,
    database_indexes: databaseIndexes,
    mutable_writers: Object.freeze([resolveWriter]),
    function_signatures: Object.freeze([signature]),
  }) as OwnerDlqResolutionContractV1<TSchema, TDlqTable>;
}

/**
 * Canonical physical and writer fragment for durable sent-outbox
 * reconciliation. The returned physical columns deliberately do not modify
 * table_permissions.select_columns: claim tokens and leases stay reachable
 * only through verified SECURITY DEFINER writers.
 */
export function ownerEventingReconciliationContractV1<
  const TSchema extends OwnerSchemaV1,
  const TOutboxTable extends string,
>(
  schema: TSchema,
  outboxTable: TOutboxTable,
): OwnerEventingReconciliationContractV1<TSchema, TOutboxTable> {
  if (!sqlIdentifierPattern.test(outboxTable)) {
    throw new Error("eventing reconciliation outbox must be a SQL identifier");
  }
  const recordDeletedWriterName =
    `record_${outboxTable}_deleted_transport_refs_v1` as const;
  const claimWriterName =
    `claim_${outboxTable}_reconciliation_v1` as const;
  const acknowledgePresentWriterName =
    `ack_${outboxTable}_transport_present_v1` as const;
  const acknowledgeRematerializedWriterName =
    `ack_${outboxTable}_rematerialized_v1` as const;
  const acknowledgePermanentFailureWriterName =
    `ack_${outboxTable}_permanent_failure_v1` as const;
  const dlqTable = (outboxTable.endsWith("_outbox")
    ? `${outboxTable.slice(0, -"_outbox".length)}_dlq`
    : `${outboxTable}_dlq`) as OwnerEventingReconciliationDlqTableNameV1<
    TOutboxTable
  >;
  type ReconciliationTableV1 =
    | TOutboxTable
    | OwnerEventingReconciliationDlqTableNameV1<TOutboxTable>
    | typeof OWNER_EVENTING_TRANSPORT_EPOCH_TABLE_V1;
  const outboxReconciliationTable = outboxTable as ReconciliationTableV1;
  const dlqReconciliationTable = dlqTable as ReconciliationTableV1;
  const epochReconciliationTable =
    OWNER_EVENTING_TRANSPORT_EPOCH_TABLE_V1 as ReconciliationTableV1;
  const envelopeReadTables = Object.freeze(
    schema === "action_runtime" && outboxTable === "runtime_event_outbox"
      ? (["runtime_events"] as const)
      : ([] as const),
  ) as readonly ReconciliationTableV1[];
  const writerNames = Object.freeze([
    recordDeletedWriterName,
    claimWriterName,
    acknowledgePresentWriterName,
    acknowledgeRematerializedWriterName,
    acknowledgePermanentFailureWriterName,
  ] as const);
  const indexNames = Object.freeze([
    `${outboxTable}_reconciliation_transport_ref_idx`,
    `${outboxTable}_reconciliation_due_idx`,
    `${outboxTable}_reconciliation_generation_idx`,
  ] as const);
  const checkNames = Object.freeze([
    `${outboxTable}_reconciliation_generation_check`,
    `${outboxTable}_sent_transport_ref_check`,
    `${outboxTable}_sent_transport_epoch_check`,
    `${outboxTable}_sent_transport_generation_check`,
    `${outboxTable}_sent_at_check`,
  ] as const);
  for (const identifier of [...writerNames, ...indexNames, ...checkNames]) {
    if (!sqlIdentifierPattern.test(identifier) || identifier.length > 63) {
      throw new Error(
        `eventing reconciliation identifier exceeds PostgreSQL limits: ${identifier}`,
      );
    }
  }

  const databaseColumns = Object.freeze(
    [
      ["reconciliation_missing_at", "timestamp with time zone", false, null],
      ["reconciliation_missing_reporter", "text", false, null],
      ["reconciliation_next_probe_at", "timestamp with time zone", false, null],
      ["reconciliation_claimed_by", "text", false, null],
      ["reconciliation_claim_token", "text", false, null],
      ["reconciliation_claim_generation", "bigint", false, "0"],
      ["reconciliation_locked_until", "timestamp with time zone", false, null],
    ].map(([column_name, postgres_type, not_null, default_expression]) =>
      Object.freeze({
        table_name: outboxTable,
        column_name: column_name as string,
        postgres_type: postgres_type as string,
        not_null: not_null as boolean,
        default_expression: default_expression as string | null,
        identity: "" as const,
        generated: "" as const,
      }),
    ),
  );
  const databaseChecks = Object.freeze([
    Object.freeze({
      constraint_name: checkNames[0],
      table_name: outboxTable,
      required_definition_fragments: Object.freeze([
        "reconciliation_claim_generation",
        "0",
        String(OWNER_SAFE_BIGINT_MAX_V1),
      ]),
      semantic_constraint: Object.freeze({
        kind: "nullable_integer_range" as const,
        column_name: "reconciliation_claim_generation",
        min: 0,
        max: OWNER_SAFE_BIGINT_MAX_V1,
      }),
    }),
    ...(
      [
        [checkNames[1], "transport_ref"],
        [checkNames[2], "transport_epoch"],
        [checkNames[3], "transport_generation"],
        [checkNames[4], "sent_at"],
      ] as const
    ).map(([constraint_name, column_name]) =>
      Object.freeze({
        constraint_name,
        table_name: outboxTable,
        required_definition_fragments: Object.freeze([
          "status",
          "sent",
          column_name,
        ]),
        semantic_constraint: Object.freeze({
          kind: "implies_not_null" as const,
          column_name,
          condition_column_name: "status",
          condition_equals: "sent",
        }),
      }),
    ),
  ]);
  const databaseIndexes = Object.freeze([
    Object.freeze({
      index_name: indexNames[0],
      table_name: outboxTable,
      definition:
        `CREATE INDEX ${indexNames[0]} ON ${schema}.${outboxTable} USING btree ` +
        `(transport_ref, transport_epoch, transport_generation) ` +
        `WHERE ((status = 'sent'::text) AND (transport_ref IS NOT NULL))`,
      unique: false,
      primary: false,
      valid: true,
    }),
    Object.freeze({
      index_name: indexNames[1],
      table_name: outboxTable,
      definition:
        `CREATE INDEX ${indexNames[1]} ON ${schema}.${outboxTable} USING btree ` +
        `(reconciliation_next_probe_at NULLS FIRST, sent_at, id) ` +
        `WHERE (status = 'sent'::text)`,
      unique: false,
      primary: false,
      valid: true,
    }),
    Object.freeze({
      index_name: indexNames[2],
      table_name: outboxTable,
      definition:
        `CREATE INDEX ${indexNames[2]} ON ${schema}.${outboxTable} USING btree ` +
        `(transport_epoch, transport_generation, sent_at, id) ` +
        `WHERE (status = 'sent'::text)`,
      unique: false,
      primary: false,
      valid: true,
    }),
  ]);

  const functionSignatures = Object.freeze([
    ownerFunctionSignatureV1({
      schema,
      function_name: recordDeletedWriterName,
      primary_table: outboxTable,
      writer_kind: "outbox_claim_ack",
      arguments: [
        ["p_consumer_service", "text"],
        ["p_transport_refs", "jsonb"],
        ["p_observed_transport_epoch", "text"],
        ["p_observed_transport_generation", "bigint"],
        ["p_observed_at", "timestamptz"],
      ],
      reads_tables: [
        outboxReconciliationTable,
        epochReconciliationTable,
      ],
      writes_tables: [outboxTable],
      effects: [
        {
          table_name: outboxTable,
          operation: "reconcile_mark_missing",
          concurrency_control: "reconciliation_fence",
        },
      ],
      returns: "jsonb",
    }),
    ownerFunctionSignatureV1({
      schema,
      function_name: claimWriterName,
      primary_table: outboxTable,
      writer_kind: "outbox_claim_ack",
      arguments: [
        ["p_worker_id", "text"],
        ["p_limit", "integer"],
        ["p_lease_seconds", "integer"],
        ["p_current_transport_epoch", "text"],
        ["p_current_transport_generation", "bigint"],
      ],
      reads_tables: [
        outboxReconciliationTable,
        epochReconciliationTable,
        ...envelopeReadTables,
      ],
      writes_tables: [outboxTable],
      effects: [
        {
          table_name: outboxTable,
          operation: "reconcile_claim",
          concurrency_control: "reconciliation_fence",
        },
      ],
      returns: "setof jsonb",
    }),
    ownerFunctionSignatureV1({
      schema,
      function_name: acknowledgePresentWriterName,
      primary_table: outboxTable,
      writer_kind: "outbox_claim_ack",
      arguments: [
        ["p_outbox_id", "text"],
        ["p_claim_token", "text"],
        ["p_previous_transport_ref", "text"],
        ["p_previous_transport_epoch", "text"],
        ["p_previous_transport_generation", "bigint", { nullable: true }],
        ["p_current_transport_epoch", "text"],
        ["p_current_transport_generation", "bigint"],
        ["p_probe_interval_ms", "integer"],
      ],
      reads_tables: [
        outboxReconciliationTable,
        epochReconciliationTable,
      ],
      writes_tables: [outboxTable],
      effects: [
        {
          table_name: outboxTable,
          operation: "reconcile_ack_present",
          concurrency_control: "reconciliation_fence",
        },
      ],
      returns: "jsonb",
    }),
    ownerFunctionSignatureV1({
      schema,
      function_name: acknowledgeRematerializedWriterName,
      primary_table: outboxTable,
      writer_kind: "outbox_claim_ack",
      arguments: [
        ["p_outbox_id", "text"],
        ["p_claim_token", "text"],
        ["p_previous_transport_ref", "text"],
        ["p_previous_transport_epoch", "text"],
        ["p_previous_transport_generation", "bigint", { nullable: true }],
        ["p_transport_ref", "text"],
        ["p_transport_epoch", "text"],
        ["p_transport_generation", "bigint"],
        ["p_current_transport_epoch", "text"],
        ["p_current_transport_generation", "bigint"],
        ["p_probe_interval_ms", "integer"],
      ],
      reads_tables: [
        outboxReconciliationTable,
        epochReconciliationTable,
      ],
      writes_tables: [outboxTable],
      effects: [
        {
          table_name: outboxTable,
          operation: "reconcile_ack_rematerialized",
          concurrency_control: "reconciliation_fence",
        },
      ],
      returns: "jsonb",
    }),
    ownerFunctionSignatureV1({
      schema,
      function_name: acknowledgePermanentFailureWriterName,
      primary_table: outboxReconciliationTable,
      writer_kind: "outbox_claim_ack",
      arguments: [
        ["p_outbox_id", "text"],
        ["p_claim_token", "text"],
        ["p_previous_transport_ref", "text"],
        ["p_previous_transport_epoch", "text"],
        ["p_previous_transport_generation", "bigint", { nullable: true }],
        ["p_current_transport_epoch", "text"],
        ["p_current_transport_generation", "bigint"],
        ["p_failure_code", "text"],
        ["p_failure_message", "text"],
        ["p_now", "timestamptz"],
      ],
      reads_tables: [
        outboxReconciliationTable,
        epochReconciliationTable,
        ...envelopeReadTables,
      ],
      writes_tables: [outboxReconciliationTable, dlqReconciliationTable],
      effects: [
        {
          table_name: outboxReconciliationTable,
          operation: "reconcile_ack_permanent_failure",
          concurrency_control: "reconciliation_fence",
        },
        {
          table_name: dlqReconciliationTable,
          operation: "append",
          concurrency_control: "idempotency_key",
        },
      ],
      returns: "jsonb",
    }),
  ]);

  return Object.freeze({
    outbox_table: outboxTable,
    required_existing_columns:
      ownerEventingReconciliationRequiredExistingColumnsV1,
    database_columns: databaseColumns,
    database_checks: databaseChecks,
    database_indexes: databaseIndexes,
    mutable_writers: writerNames,
    function_signatures: functionSignatures,
    next_probe_semantics:
      OWNER_EVENTING_RECONCILIATION_NEXT_PROBE_SEMANTICS_V1,
  }) as unknown as OwnerEventingReconciliationContractV1<
    TSchema,
    TOutboxTable
  >;
}

/**
 * Defines the immutable digest emitted beside a pai-infra generated writer.
 * Runtime verification compares PostgreSQL pg_proc.prosrc byte-for-byte after
 * newline normalization; it never attempts to prove arbitrary PL/pgSQL with
 * token or regular-expression heuristics.
 */
export function ownerWriterArtifactV1<
  const TWriter extends string,
>(input: Readonly<{
  signature: OwnerFunctionSignatureV1<string, string, TWriter>;
  generator_source: string;
  function_body: string;
}>): OwnerWriterArtifactV1<TWriter> {
  if (!generatedPermissionPattern.test(input.generator_source)) {
    throw new Error("owner writer artifact must originate from pai-infra generated SQL");
  }
  return Object.freeze({
    artifact_version: "owner_writer_artifact.v1" as const,
    generator: "pai-infra-owner-writer.v1" as const,
    generator_source: input.generator_source,
    function_name: input.signature.function_name,
    signature_fingerprint: `sha256:${fingerprint(input.signature)}`,
    function_body_sha256: writerSourceSha256(input.function_body),
  });
}

/**
 * Defines the exact catalog artifact for a fail-closed append-only trigger.
 * The function body is intentionally limited to one unconditional RAISE so a
 * trigger can never smuggle mutation, observation, or helper-call authority.
 */
export function ownerImmutableTriggerV1<
  const TTable extends string,
>(input: Readonly<{
  trigger_name: string;
  table_name: TTable;
  function_name: string;
  function_body: string;
}>): OwnerImmutableTriggerV1<TTable> {
  for (const identifier of [
    input.trigger_name,
    input.table_name,
    input.function_name,
  ]) {
    if (!sqlIdentifierPattern.test(identifier) || identifier.length > 63) {
      throw new Error(`invalid immutable trigger SQL identifier: ${identifier}`);
    }
  }
  assertImmutableTriggerFunctionSourceV1(input.function_body);
  return Object.freeze({
    trigger_name: input.trigger_name,
    table_name: input.table_name,
    function_name: input.function_name,
    timing: "before" as const,
    events: Object.freeze(["update", "delete"] as const),
    orientation: "row" as const,
    enabled_mode: "origin" as const,
    function_body_sha256: writerSourceSha256(input.function_body),
  });
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
  const physicalColumnsByTable = new Map(
    contract.table_permissions.map(({ table_name, select_columns }) => [
      table_name,
      new Set<string>(
        [
          ...select_columns,
          ...(contract.database_columns ?? [])
            .filter((column) => column.table_name === table_name)
            .map(({ column_name }) => column_name),
        ],
      ),
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
    const sourceColumns = physicalColumnsByTable.get(foreignKey.table_name);
    const referencedColumns = physicalColumnsByTable.get(
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
    const semantic = check.semantic_constraint;
    const tableColumns = physicalColumnsByTable.get(check.table_name);
    let invalidSemantic =
      semantic !== undefined &&
      (!sqlIdentifierPattern.test(semantic.column_name) ||
        !tableColumns?.has(semantic.column_name));
    if (!invalidSemantic && semantic !== undefined) {
      switch (semantic.kind) {
        case "text_enum":
        case "nullable_text_enum":
          invalidSemantic =
            semantic.allowed_values.length === 0 ||
            new Set(semantic.allowed_values).size !==
              semantic.allowed_values.length ||
            semantic.allowed_values.some((value) => value.length === 0);
          break;
        case "text_equals":
          invalidSemantic = semantic.value.length === 0;
          break;
        case "text_identity_prefix":
          invalidSemantic =
            semantic.prefix.length === 0 ||
            !sqlIdentifierPattern.test(semantic.identity_column_name) ||
            !tableColumns?.has(semantic.identity_column_name);
          break;
        case "text_regex":
          invalidSemantic = semantic.pattern.length === 0;
          break;
        case "text_array_bounded_no_null":
          invalidSemantic =
            !Number.isSafeInteger(semantic.max_items) ||
            semantic.max_items < 0;
          break;
        case "permission_summary_entry_branch": {
          const revisionColumns = semantic.revision_required_columns;
          const defaultNullColumns = semantic.default_null_columns;
          const referencedColumns = [
            semantic.column_name,
            semantic.decision_column_name,
            ...revisionColumns,
            ...defaultNullColumns,
            semantic.default_empty_array_column_name,
          ];
          invalidSemantic =
            semantic.revision_value.length === 0 ||
            semantic.default_deny_value.length === 0 ||
            semantic.revision_value === semantic.default_deny_value ||
            semantic.deny_value.length === 0 ||
            revisionColumns.length === 0 ||
            defaultNullColumns.length === 0 ||
            new Set(revisionColumns).size !== revisionColumns.length ||
            new Set(defaultNullColumns).size !== defaultNullColumns.length ||
            revisionColumns.some(
              (column) => !defaultNullColumns.includes(column),
            ) ||
            referencedColumns.some(
              (column) =>
                !sqlIdentifierPattern.test(column) ||
                !tableColumns?.has(column),
            ) ||
            new Set([
              semantic.column_name,
              semantic.decision_column_name,
              ...defaultNullColumns,
              semantic.default_empty_array_column_name,
            ]).size !==
              3 + defaultNullColumns.length;
          break;
        }
        case "octet_length_min":
          invalidSemantic =
            !Number.isSafeInteger(semantic.min) || semantic.min < 0;
          break;
        case "column_order":
          invalidSemantic =
            semantic.operator !== ">" ||
            !sqlIdentifierPattern.test(semantic.other_column_name) ||
            !tableColumns?.has(semantic.other_column_name);
          break;
      case "json_text_equals":
        invalidSemantic =
            !sqlIdentifierPattern.test(semantic.field_name) ||
            semantic.value.length === 0 ||
            typeof semantic.allow_additional_keys !== "boolean" ||
            semantic.required_keys.length === 0 ||
            new Set(semantic.required_keys).size !==
              semantic.required_keys.length ||
            !semantic.required_keys.includes(semantic.field_name) ||
            semantic.required_keys.some((value) => value.length === 0);
          break;
        case "json_discriminator":
          invalidSemantic =
            !sqlIdentifierPattern.test(semantic.payload_column_name) ||
            !tableColumns?.has(semantic.payload_column_name) ||
            !sqlIdentifierPattern.test(semantic.payload_field_name) ||
            semantic.branches.length === 0 ||
            new Set(
              semantic.branches.map(({ discriminator_value }) =>
                discriminator_value,
              ),
            ).size !== semantic.branches.length ||
            semantic.branches.some(
              ({ discriminator_value, payload_field_value }) =>
                discriminator_value.length === 0 ||
                payload_field_value.length === 0,
            );
          break;
      case "json_event_envelope":
        invalidSemantic =
            semantic.producer_value.length === 0 ||
            typeof semantic.allow_additional_keys !== "boolean" ||
            semantic.required_keys.length === 0 ||
            new Set(semantic.required_keys).size !==
              semantic.required_keys.length ||
            semantic.required_keys.some((value) => value.length === 0) ||
            semantic.field_bindings.length === 0 ||
            new Set(
              semantic.field_bindings.map(({ field_name }) => field_name),
            ).size !== semantic.field_bindings.length ||
            semantic.field_bindings.some(
              ({ field_name, column_name }) =>
                !sqlIdentifierPattern.test(field_name) ||
                !sqlIdentifierPattern.test(column_name) ||
                !semantic.required_keys.includes(field_name) ||
                !tableColumns?.has(column_name),
            );
          break;
        case "column_event_envelope":
          invalidSemantic =
            !sqlIdentifierPattern.test(semantic.producer_column_name) ||
            !tableColumns?.has(semantic.producer_column_name) ||
            !sqlIdentifierPattern.test(semantic.schema_version_column_name) ||
            !tableColumns?.has(semantic.schema_version_column_name) ||
            !sqlIdentifierPattern.test(semantic.event_type_column_name) ||
            !tableColumns?.has(semantic.event_type_column_name) ||
            semantic.producer_value.length === 0 ||
            semantic.schema_version_value.length === 0 ||
            semantic.event_type_allowed_values.length === 0 ||
            new Set(semantic.event_type_allowed_values).size !==
              semantic.event_type_allowed_values.length ||
            semantic.event_type_allowed_values.some(
              (value) => value.length === 0,
            );
          break;
        case "column_command_envelope":
          invalidSemantic =
            !sqlIdentifierPattern.test(semantic.producer_column_name) ||
            !tableColumns?.has(semantic.producer_column_name) ||
            !sqlIdentifierPattern.test(semantic.schema_version_column_name) ||
            !tableColumns?.has(semantic.schema_version_column_name) ||
            !sqlIdentifierPattern.test(semantic.target_column_name) ||
            !tableColumns?.has(semantic.target_column_name) ||
            !sqlIdentifierPattern.test(semantic.payload_column_name) ||
            !tableColumns?.has(semantic.payload_column_name) ||
            semantic.producer_value.length === 0 ||
            semantic.schema_version_value.length === 0 ||
            semantic.commands.length === 0 ||
            new Set(semantic.commands.map(({ command_type }) => command_type))
              .size !== semantic.commands.length ||
            semantic.commands.some(
              ({ command_type, target, payload_schema_version }) =>
                command_type.length === 0 ||
                target.length === 0 ||
                payload_schema_version.length === 0,
            );
          break;
        case "integer_range":
        case "nullable_integer_range":
          invalidSemantic =
            !Number.isSafeInteger(semantic.min) ||
            !Number.isSafeInteger(semantic.max) ||
            semantic.min > semantic.max;
          break;
        case "nullable_versioned_identity":
          {
            const identityColumns = [
              semantic.column_name,
              semantic.version_column_name,
              semantic.hash_column_name,
              ...(semantic.retention_column_name === undefined
                ? []
                : [semantic.retention_column_name]),
            ];
          invalidSemantic =
            !sqlIdentifierPattern.test(semantic.version_column_name) ||
            !tableColumns?.has(semantic.version_column_name) ||
            !sqlIdentifierPattern.test(semantic.hash_column_name) ||
            !tableColumns?.has(semantic.hash_column_name) ||
            (semantic.retention_column_name !== undefined &&
              (!sqlIdentifierPattern.test(
                semantic.retention_column_name,
              ) ||
                !tableColumns?.has(semantic.retention_column_name))) ||
            new Set(identityColumns).size !== identityColumns.length ||
            !Number.isSafeInteger(semantic.min_version) ||
            !Number.isSafeInteger(semantic.max_version) ||
            semantic.min_version > semantic.max_version;
          }
          break;
        case "integer_ranges":
          invalidSemantic =
            semantic.ranges.length < 2 ||
            semantic.column_name !== semantic.ranges[0]?.column_name ||
            new Set(semantic.ranges.map(({ column_name }) => column_name))
              .size !== semantic.ranges.length ||
            semantic.ranges.some(
              ({ column_name, min, max, nullable }) =>
                !sqlIdentifierPattern.test(column_name) ||
                !tableColumns?.has(column_name) ||
                !Number.isSafeInteger(min) ||
                !Number.isSafeInteger(max) ||
                min > max ||
                typeof nullable !== "boolean",
            );
          break;
        case "integer_successor":
          invalidSemantic =
            !sqlIdentifierPattern.test(semantic.previous_column_name) ||
            !tableColumns?.has(semantic.previous_column_name) ||
            semantic.previous_column_name === semantic.column_name;
          break;
        case "implies_not_null":
        case "iff_not_null":
          invalidSemantic =
            !sqlIdentifierPattern.test(semantic.condition_column_name) ||
            !tableColumns?.has(semantic.condition_column_name) ||
            semantic.condition_equals.length === 0 ||
            (semantic.kind === "iff_not_null" &&
              typeof semantic.require_non_empty !== "boolean");
          break;
      }
    }
    if (
      !tableSet.has(check.table_name) ||
      check.required_definition_fragments.length === 0 ||
      check.required_definition_fragments.some((fragment) => fragment.length === 0) ||
      invalidSemantic
    ) {
      throw new Error(`invalid owner database check: ${check.constraint_name}`);
    }
    if (
      semantic?.kind === "text_enum" ||
      semantic?.kind === "nullable_text_enum"
    ) {
      Object.freeze(semantic.allowed_values);
    }
    if (semantic?.kind === "column_command_envelope") {
      for (const command of semantic.commands) Object.freeze(command);
      Object.freeze(semantic.commands);
    }
    if (semantic?.kind === "json_discriminator") {
      for (const branch of semantic.branches) Object.freeze(branch);
      Object.freeze(semantic.branches);
    }
    if (
      semantic?.kind === "json_text_equals" ||
      semantic?.kind === "json_event_envelope"
    ) {
      Object.freeze(semantic.required_keys);
    }
    if (semantic?.kind === "json_event_envelope") {
      for (const binding of semantic.field_bindings) Object.freeze(binding);
      Object.freeze(semantic.field_bindings);
    }
    if (semantic?.kind === "column_event_envelope") {
      Object.freeze(semantic.event_type_allowed_values);
    }
    if (semantic?.kind === "integer_ranges") {
      for (const range of semantic.ranges) Object.freeze(range);
      Object.freeze(semantic.ranges);
    }
    if (semantic?.kind === "permission_summary_entry_branch") {
      Object.freeze(semantic.revision_required_columns);
      Object.freeze(semantic.default_null_columns);
    }
    if (semantic !== undefined) Object.freeze(semantic);
    Object.freeze(check.required_definition_fragments);
    Object.freeze(check);
  }
  const databaseColumnKeys = (contract.database_columns ?? []).map(
    ({ table_name, column_name }) => `${table_name}.${column_name}`,
  );
  const databaseColumnKeySet = new Set(databaseColumnKeys);
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
  for (const column of contract.database_columns ?? []) {
    if (
      !tableSet.has(column.table_name) ||
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
  const completeDatabaseColumnSnapshot =
    contract.database_columns !== undefined &&
    contract.tables.every((table) =>
      contract.database_columns?.some(({ table_name }) => table_name === table),
    );
  if (
    completeDatabaseColumnSnapshot &&
    contract.table_permissions.some(({ table_name, select_columns }) =>
      select_columns.some(
        (column) => !databaseColumnKeySet.has(`${table_name}.${column}`),
      ),
    )
  ) {
    throw new Error(
      "table_permissions.select_columns must be a subset of database_columns",
    );
  }
  assertUniqueIdentifiers(
    "database_unique_constraints.constraint_name",
    (contract.database_unique_constraints ?? []).map(
      ({ constraint_name }) => constraint_name,
    ),
  );
  for (const constraint of contract.database_unique_constraints ?? []) {
    const sourceColumns = physicalColumnsByTable.get(constraint.table_name);
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
  assertUniqueIdentifiers(
    "database_indexes.index_name",
    (contract.database_indexes ?? []).map(({ index_name }) => index_name),
  );
  for (const index of contract.database_indexes ?? []) {
    if (
      !tableSet.has(index.table_name) ||
      index.definition.trim().length === 0 ||
      (!index.unique && index.primary) ||
      !index.valid
    ) {
      throw new Error(
        `invalid owner database index snapshot: ${index.index_name}`,
      );
    }
    Object.freeze(index);
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
      signature.arguments.some(
        (argument) =>
          argument.mode !== "in" ||
          (argument.nullable !== undefined &&
            typeof argument.nullable !== "boolean"),
      ) ||
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
    const effectIdentities = effects.map(
      ({
        table_name,
        operation,
        concurrency_control,
        lock_table_name,
        claim_locking,
        claim_fence,
        claim_authority,
        advisory_lock,
      }) =>
        `${table_name}\u0000${operation}\u0000${concurrency_control}\u0000${lock_table_name ?? ""}\u0000${claim_locking ?? ""}\u0000${claim_fence === undefined ? "" : JSON.stringify(claim_fence)}\u0000${claim_authority === undefined ? "" : JSON.stringify(claim_authority)}\u0000${advisory_lock === undefined ? "" : JSON.stringify(advisory_lock)}`,
    );
    const advisoryEffects = effects.filter(
      ({ concurrency_control }) =>
        concurrency_control === "advisory_identity_lock",
    );
    const explicitAdvisoryEffects = advisoryEffects.filter(
      ({ advisory_lock }) => advisory_lock !== undefined,
    );
    const advisoryOrderDrift =
      explicitAdvisoryEffects.length > 0 &&
      (explicitAdvisoryEffects.length !== advisoryEffects.length ||
        sorted(
          explicitAdvisoryEffects.map(({ advisory_lock }) =>
            String(advisory_lock?.order).padStart(8, "0"),
          ),
        ).join("\u0000") !==
          explicitAdvisoryEffects
            .map((_, index) => String(index + 1).padStart(8, "0"))
            .join("\u0000"));
    if (
      effects.length < signature.writes_tables.length ||
      new Set(effectIdentities).size !== effectIdentities.length ||
      advisoryOrderDrift ||
      effects.some((effect) => {
        const { table_name, operation, concurrency_control } = effect;
        const tableWriterKind = permissionByTable.get(table_name)?.writer_kind;
        const concurrencyArguments = concurrencyArgumentNames(
          signature,
          concurrency_control,
          operation,
          effect,
        );
        const nullableFenceArguments = concurrencyArguments.filter(
          (argumentName) =>
            signature.arguments.find(
              ({ argument_name }) => argument_name === argumentName,
            )?.nullable === true,
        );
        const nullableFenceDrift =
          concurrency_control === "reconciliation_fence"
            ? nullableFenceArguments.some(
                (argumentName) =>
                  argumentName !== "p_previous_transport_generation",
              ) ||
              ((operation === "reconcile_ack_present" ||
                operation === "reconcile_ack_rematerialized" ||
                operation === "reconcile_ack_permanent_failure") &&
                signature.arguments.find(
                  ({ argument_name }) =>
                    argument_name === "p_previous_transport_generation",
                )?.nullable !== true)
            : nullableFenceArguments.length > 0;
        const promotionTargets =
          effect.promotion_reservation_targets ?? [];
        const promotionTargetIdentities = promotionTargets.map((target) =>
          "aggregate_type" in target
            ? `${target.aggregate_type}\u0000${target.id_argument}\u0000${target.id_json_key ?? ""}`
            : `dynamic\u0000${target.aggregate_type_argument}\u0000${target.id_argument}`,
        );
        const signatureArgumentNames = new Set(
          signature.arguments.map(({ argument_name }) => argument_name),
        );
        const advisoryLock = effect.advisory_lock;
        const advisoryIdentityArguments =
          advisoryLock?.identity_arguments ?? [];
        const hasDerivedOutboxAggregateIdentity =
          advisoryLock?.identity_source === "claimed_outbox_aggregate_id";
        const hasUnexpectedAdvisoryIdentitySource =
          advisoryLock?.identity_source !== undefined &&
          !hasDerivedOutboxAggregateIdentity;
        const outboxClaimArguments = [
          "p_worker_id",
          "p_limit",
          "p_lease_seconds",
          "p_now",
        ];
        const derivedOutboxAggregateIdentityDrift =
          !hasDerivedOutboxAggregateIdentity
            ? false
            : advisoryIdentityArguments.length !== 0 ||
              signature.writer_kind !== "outbox_claim_ack" ||
              !signature.function_name.startsWith("claim_") ||
              !signature.primary_table.endsWith("_outbox") ||
              signature.returns !== "setof jsonb" ||
              !outboxClaimArguments.every((argumentName) =>
                signatureArgumentNames.has(argumentName),
              ) ||
              !physicalColumnsByTable
                .get(signature.primary_table)
                ?.has("aggregate_id");
        const advisoryMetadataDrift =
          concurrency_control === "advisory_identity_lock"
            ? advisoryLock === undefined
              ? false
              : advisoryLock.key_prefix.length === 0 ||
                advisoryLock.key_prefix.length > 256 ||
                !advisoryLock.key_prefix.startsWith(
                  `${signature.schema}:`,
                ) ||
                !/^[a-z][a-z0-9_]*(?::[a-z][a-z0-9_]*)*:$/u.test(
                  advisoryLock.key_prefix,
                ) ||
                advisoryLock.separator !== ":" ||
                !Number.isSafeInteger(advisoryLock.order) ||
                advisoryLock.order < 1 ||
                hasUnexpectedAdvisoryIdentitySource ||
                derivedOutboxAggregateIdentityDrift ||
                (!hasDerivedOutboxAggregateIdentity &&
                  (advisoryIdentityArguments.length === 0 ||
                    new Set(advisoryIdentityArguments).size !==
                      advisoryIdentityArguments.length ||
                    advisoryIdentityArguments.some((argumentName) => {
                      const argument = signature.arguments.find(
                        ({ argument_name }) =>
                          argument_name === argumentName,
                      );
                      return (
                        argument === undefined ||
                        argument.nullable === true ||
                        !["text", "integer", "bigint"].includes(
                          argument.postgres_type,
                        )
                      );
                    })))
            : advisoryLock !== undefined;
        const promotionMetadataDrift =
          concurrency_control === "promotion_reservation_fence"
            ? promotionTargets.length === 0 ||
              new Set(promotionTargetIdentities).size !==
                promotionTargetIdentities.length ||
              promotionTargets.some(
                (target) =>
                  !signatureArgumentNames.has(target.id_argument) ||
                  ("aggregate_type_argument" in target &&
                    !signatureArgumentNames.has(
                      target.aggregate_type_argument,
                    )),
              )
            : effect.promotion_reservation_targets !== undefined;
        const rowLockMetadataDrift =
          effect.lock_table_name === undefined
            ? false
            : concurrency_control !== "database_row_lock" ||
              !signature.reads_tables.includes(effect.lock_table_name);
        const skipLockedClaimMetadataDrift =
          effect.claim_locking === undefined
            ? operation === "claim" &&
              tableWriterKind === "state_transition"
            : effect.claim_locking !== "for_update_skip_locked" ||
              operation !== "claim" ||
              concurrency_control !== "lease_fence" ||
              signature.returns !== "setof jsonb" ||
              ![
                "p_worker_id",
                "p_limit",
                "p_lease_seconds",
                "p_now",
              ].every((argumentName) =>
                signatureArgumentNames.has(argumentName),
              );
        const claimFence = effect.claim_fence;
        const claimTableColumns =
          physicalColumnsByTable.get(table_name);
        const claimColumn = (columnName: string | undefined) =>
          columnName === undefined
            ? undefined
            : contract.database_columns?.find(
                ({ table_name: columnTable, column_name }) =>
                  columnTable === table_name &&
                  column_name === columnName,
              );
        const claimWorkerColumn = claimColumn(
          claimFence?.worker_column,
        );
        const claimLeaseColumn = claimColumn(
          claimFence?.lease_expires_at_column,
        );
        const claimGenerationColumn = claimColumn(
          claimFence?.generation_column,
        );
        const claimGenerationRange =
          claimFence === undefined
            ? undefined
            : (contract.database_checks ?? []).find((check) => {
                const semantic = check.semantic_constraint;
                return (
                  check.table_name === table_name &&
                  semantic?.kind === "integer_range" &&
                  semantic.column_name ===
                    claimFence.generation_column &&
                  semantic.min >= 0 &&
                  semantic.max <= Number.MAX_SAFE_INTEGER
                );
              });
        const claimEligibleStatusCheck =
          claimFence === undefined
            ? undefined
            : (contract.database_checks ?? []).find((check) => {
                const semantic = check.semantic_constraint;
                return (
                  check.table_name === table_name &&
                  semantic?.kind === "text_enum" &&
                  semantic.column_name === claimFence.status_column &&
                  semantic.allowed_values.includes(
                    claimFence.eligible_status,
                  )
                );
              });
        const claimFenceColumns =
          claimFence === undefined
            ? []
            : [
                claimFence.identity_column,
                claimFence.status_column,
                claimFence.worker_column,
                claimFence.lease_expires_at_column,
                claimFence.generation_column,
                ...claimFence.order_by_columns,
              ];
        const claimFenceMetadataDrift =
          effect.claim_locking === "for_update_skip_locked"
            ? claimFence === undefined ||
              !sqlIdentifierPattern.test(claimFence.eligible_status) ||
              claimFence.order_by_columns.length === 0 ||
              new Set(claimFence.order_by_columns).size !==
                claimFence.order_by_columns.length ||
              new Set([
                claimFence.identity_column,
                claimFence.status_column,
                claimFence.worker_column,
                claimFence.lease_expires_at_column,
                claimFence.generation_column,
              ]).size !== 5 ||
              claimFenceColumns.some(
                (column) =>
                  !sqlIdentifierPattern.test(column) ||
                  !claimTableColumns?.has(column),
              ) ||
              claimWorkerColumn?.postgres_type !== "text" ||
              ![
                "timestamptz",
                "timestamp with time zone",
              ].includes(claimLeaseColumn?.postgres_type ?? "") ||
              claimGenerationColumn?.postgres_type !== "bigint" ||
              claimGenerationColumn.not_null !== true ||
              claimGenerationColumn.default_expression === null ||
              claimGenerationRange === undefined ||
              claimEligibleStatusCheck === undefined
            : claimFence !== undefined;
        const claimAuthority = effect.claim_authority;
        const auxiliaryClaimReads = signature.reads_tables.filter(
          (readTable) => readTable !== table_name,
        );
        const claimAuthorityColumns =
          claimAuthority === undefined
            ? []
            : [
                claimAuthority.claimed_owner_identity_column,
                claimAuthority.originating_lease_generation_column,
              ];
        const ownerAuthorityColumns =
          claimAuthority === undefined
            ? undefined
            : physicalColumnsByTable.get(
                claimAuthority.owner_table_name,
              );
        const leaseAuthorityColumns =
          claimAuthority === undefined
            ? undefined
            : physicalColumnsByTable.get(
                claimAuthority.lease_table_name,
              );
        const originatingGenerationColumn =
          claimAuthority === undefined
            ? undefined
            : contract.database_columns?.find(
                ({ table_name: columnTable, column_name }) =>
                  columnTable === table_name &&
                  column_name ===
                    claimAuthority.originating_lease_generation_column,
              );
        const originatingGenerationRange =
          claimAuthority === undefined
            ? undefined
            : (contract.database_checks ?? []).find((check) => {
                const semantic = check.semantic_constraint;
                return (
                  check.table_name === table_name &&
                  semantic?.kind === "integer_range" &&
                  semantic.column_name ===
                    claimAuthority.originating_lease_generation_column &&
                  semantic.min >= 1 &&
                  semantic.max <= Number.MAX_SAFE_INTEGER
                );
              });
        const claimAuthorityMetadataDrift =
          effect.claim_locking === "for_update_skip_locked"
            ? auxiliaryClaimReads.length === 0
              ? claimAuthority !== undefined
              : claimAuthority === undefined ||
                claimAuthority.owner_table_name === table_name ||
                claimAuthority.lease_table_name === table_name ||
                claimAuthority.owner_table_name ===
                  claimAuthority.lease_table_name ||
                sorted(auxiliaryClaimReads).join("\u0000") !==
                  sorted([
                    claimAuthority.owner_table_name,
                    claimAuthority.lease_table_name,
                  ]).join("\u0000") ||
                !sqlIdentifierPattern.test(
                  claimAuthority.active_lease_state,
                ) ||
                claimAuthorityColumns.some(
                  (column) =>
                    !sqlIdentifierPattern.test(column) ||
                    !claimTableColumns?.has(column),
                ) ||
                !ownerAuthorityColumns?.has(
                  claimAuthority.owner_identity_column,
                ) ||
                [
                  claimAuthority.lease_owner_identity_column,
                  claimAuthority.lease_generation_column,
                  claimAuthority.lease_expires_at_column,
                  claimAuthority.lease_state_column,
                ].some(
                  (column) =>
                    !sqlIdentifierPattern.test(column) ||
                    !leaseAuthorityColumns?.has(column),
                ) ||
                originatingGenerationColumn?.postgres_type !==
                  "bigint" ||
                originatingGenerationColumn.not_null !== true ||
                originatingGenerationRange === undefined
            : claimAuthority !== undefined;
        return (
          !effectOperations.has(operation) ||
          !concurrencyControls.has(concurrency_control) ||
          tableWriterKind === undefined ||
          !operationsByWriterKind[tableWriterKind].has(operation) ||
          !hasConcurrencyArgument(
            signature,
            concurrency_control,
            operation,
            effect,
          ) ||
          nullableFenceDrift ||
          advisoryMetadataDrift ||
          promotionMetadataDrift ||
          rowLockMetadataDrift ||
          skipLockedClaimMetadataDrift ||
          claimFenceMetadataDrift ||
          claimAuthorityMetadataDrift
        );
      }) ||
      sorted([...new Set(effectTables)]).join("\u0000") !==
        sorted(signature.writes_tables).join("\u0000")
    ) {
      throw new Error(
        `${contract.owner_service}.${signature.function_name} must declare one or more unique compatible semantic effects for every written table`,
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
  const databaseTriggers = contract.database_triggers ?? [];
  const databaseTriggerIdentities = databaseTriggers.map(
    ({ table_name, trigger_name }) => `${table_name}.${trigger_name}`,
  );
  if (
    new Set(databaseTriggerIdentities).size !== databaseTriggerIdentities.length
  ) {
    throw new Error(
      `${contract.owner_service} database_triggers must contain unique table/trigger identities`,
    );
  }
  for (const trigger of databaseTriggers) {
    if (
      !tableSet.has(trigger.table_name) ||
      !sqlIdentifierPattern.test(trigger.trigger_name) ||
      trigger.trigger_name.length > 63 ||
      trigger.function_schema !== contract.schema ||
      !sqlIdentifierPattern.test(trigger.function_name) ||
      trigger.function_name.length > 63 ||
      contract.mutable_writers.includes(trigger.function_name as TWriter) ||
      !Number.isInteger(trigger.trigger_type) ||
      trigger.trigger_type <= 0 ||
      !Number.isInteger(trigger.trigger_argument_count) ||
      trigger.trigger_argument_count < 0 ||
      trigger.language_name !== "plpgsql" ||
      !/^sha256:[0-9a-f]{64}$/u.test(trigger.function_body_sha256)
    ) {
      throw new Error(
        `invalid database trigger artifact: ${contract.schema}.${trigger.table_name}.${trigger.trigger_name}`,
      );
    }
    if (trigger.settings !== null) Object.freeze(trigger.settings);
    Object.freeze(trigger);
  }
  const databaseFunctions = contract.database_functions ?? [];
  if (
    new Set(databaseFunctions.map(({ function_name }) => function_name)).size !==
    databaseFunctions.length
  ) {
    throw new Error(
      `${contract.owner_service} database_functions must contain unique function names`,
    );
  }
  const triggerFunctionNames = new Set(
    databaseTriggers.map(({ function_name }) => function_name),
  );
  for (const fn of databaseFunctions) {
    if (
      !sqlIdentifierPattern.test(fn.function_name) ||
      fn.function_name.length > 63 ||
      contract.mutable_writers.includes(fn.function_name as TWriter) ||
      triggerFunctionNames.has(fn.function_name) ||
      !Number.isInteger(fn.default_argument_count) ||
      fn.default_argument_count < 0 ||
      (fn.language_name !== "plpgsql" && fn.language_name !== "sql") ||
      !/^sha256:[0-9a-f]{64}$/u.test(fn.function_body_sha256)
    ) {
      throw new Error(
        `invalid private database function artifact: ${contract.schema}.${fn.function_name}`,
      );
    }
    if (fn.settings !== null) Object.freeze(fn.settings);
    if (fn.argument_names !== null) Object.freeze(fn.argument_names);
    if (fn.argument_types !== null) Object.freeze(fn.argument_types);
    Object.freeze(fn);
  }
  const immutableTriggers = contract.immutable_triggers ?? [];
  const immutableTriggerIdentities = immutableTriggers.map(
    ({ table_name, trigger_name }) => `${table_name}.${trigger_name}`,
  );
  const immutableFunctionHashes = new Map<string, string>();
  if (
    new Set(immutableTriggerIdentities).size !==
    immutableTriggerIdentities.length
  ) {
    throw new Error(
      `${contract.owner_service} immutable_triggers must contain unique table/trigger identities`,
    );
  }
  for (const trigger of immutableTriggers) {
    const permission = permissionByTable.get(trigger.table_name);
    const priorHash = immutableFunctionHashes.get(trigger.function_name);
    if (
      !tableSet.has(trigger.table_name) ||
      !contract.append_only_tables.includes(trigger.table_name) ||
      permission?.writer_kind !== "immutable_append" ||
      !sqlIdentifierPattern.test(trigger.trigger_name) ||
      trigger.trigger_name.length > 63 ||
      !sqlIdentifierPattern.test(trigger.function_name) ||
      trigger.function_name.length > 63 ||
      contract.mutable_writers.includes(trigger.function_name as TWriter) ||
      trigger.timing !== "before" ||
      trigger.orientation !== "row" ||
      trigger.enabled_mode !== "origin" ||
      trigger.events.length !== 2 ||
      trigger.events[0] !== "update" ||
      trigger.events[1] !== "delete" ||
      !/^sha256:[0-9a-f]{64}$/u.test(trigger.function_body_sha256) ||
      (priorHash !== undefined &&
        priorHash !== trigger.function_body_sha256)
    ) {
      throw new Error(
        `invalid immutable trigger artifact: ${contract.schema}.${trigger.table_name}.${trigger.trigger_name}`,
      );
    }
    immutableFunctionHashes.set(
      trigger.function_name,
      trigger.function_body_sha256,
    );
    Object.freeze(trigger.events);
    Object.freeze(trigger);
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
  const durableInboxColumns = [
    "source",
    "event_id",
    "idempotency_key",
    "payload_hash",
    "semantic_hash",
    "scope_fingerprint",
  ] as const;
  for (const inboxTable of contract.inbox_tables) {
    const permission = permissionByTable.get(inboxTable);
    if (
      permission === undefined ||
      durableInboxColumns.some(
        (column) => !permission.select_columns.includes(column),
      )
    ) {
      throw new Error(
        `${contract.owner_service}.${inboxTable} durable inbox identity columns drift`,
      );
    }
    const physicalInboxColumns = (contract.database_columns ?? []).filter(
      ({ table_name }) => table_name === inboxTable,
    );
    if (
      contract.database_columns !== undefined &&
      durableInboxColumns.some((column) => {
        const observed = physicalInboxColumns.find(
          ({ column_name }) => column_name === column,
        );
        return observed === undefined || !observed.not_null;
      })
    ) {
      throw new Error(
        `${contract.owner_service}.${inboxTable} durable inbox identity must be NOT NULL`,
      );
    }
    if (contract.database_unique_constraints !== undefined) {
      const inboxUniqueConstraints = contract.database_unique_constraints.filter(
        ({ table_name, kind }) =>
          table_name === inboxTable && kind === "unique",
      );
      const requiredInboxIdentities = [
        ["source", "event_id"],
        ["source", "idempotency_key"],
      ] as const;
      if (
        inboxUniqueConstraints.length !== requiredInboxIdentities.length ||
        requiredInboxIdentities.some(
          (requiredColumns) =>
            inboxUniqueConstraints.filter(
              ({ columns, deferrable, initially_deferred, validated }) =>
                fingerprint(columns) === fingerprint(requiredColumns) &&
                !deferrable &&
                !initially_deferred &&
                validated,
            ).length !== 1,
        )
      ) {
        throw new Error(
          `${contract.owner_service}.${inboxTable} must have exact non-deferrable UNIQUE(source,event_id) and UNIQUE(source,idempotency_key) identities`,
        );
      }
    }
    const inboxUniqueIndexes = (contract.database_indexes ?? []).filter(
      ({ table_name, unique, primary, valid }) =>
        table_name === inboxTable && unique && valid && !primary,
    );
    const requiredInboxIndexColumns = [
      ["source", "event_id"],
      ["source", "idempotency_key"],
    ] as const;
    if (
      inboxUniqueIndexes.length !== requiredInboxIndexColumns.length ||
      requiredInboxIndexColumns.some(
        (columns) =>
          inboxUniqueIndexes.filter(({ definition }) =>
            databaseIndexDefinitionMatchesColumns(definition, columns),
          ).length !== 1,
      )
    ) {
      throw new Error(
        `${contract.owner_service}.${inboxTable} must have exact unique delivery and idempotency indexes`,
      );
    }
    const inboxWriters = contract.function_signatures.filter((signature) =>
      signature.writes_tables.includes(inboxTable),
    );
    if (inboxWriters.length === 0) {
      throw new Error(
        `${contract.owner_service}.${inboxTable} has no durable inbox writer`,
      );
    }
    for (const signature of inboxWriters) {
      const argumentTypes = new Map(
        signature.arguments.map(({ argument_name, postgres_type, nullable }) => [
          argument_name,
          { postgres_type, nullable: nullable === true },
        ]),
      );
      const eventArgument =
        argumentTypes.get("p_source_event") ?? argumentTypes.get("p_event");
      const identityEffect = signature.effects.find(
        ({ table_name }) => table_name === inboxTable,
      );
      const hasConflictQuarantine = signature.effects.some(
        ({ table_name, operation }) =>
          contract.dlq_tables.includes(table_name) && operation === "append",
      );
      if (
        eventArgument?.postgres_type !== "jsonb" ||
        eventArgument.nullable ||
        [
          "p_idempotency_key",
          "p_payload_hash",
          "p_semantic_hash",
          "p_scope_fingerprint",
        ].some((name) => {
          const argument = argumentTypes.get(name);
          return argument?.postgres_type !== "text" || argument.nullable;
        }) ||
        identityEffect?.operation !== "append" ||
        identityEffect.concurrency_control !== "durable_event_identity" ||
        !hasConflictQuarantine
      ) {
        throw new Error(
          `${contract.owner_service}.${signature.function_name} durable inbox identity ABI drift`,
        );
      }
    }
  }
  const checks = contract.database_checks ?? [];
  for (const outboxTable of contract.outbox_tables) {
    const columns = physicalColumnsByTable.get(outboxTable) ?? new Set<string>();
    if (columns.has("event_type")) {
      const eventTypeChecks = checks.filter(
        ({ table_name, semantic_constraint }) =>
          table_name === outboxTable &&
          semantic_constraint?.kind === "text_enum" &&
          semantic_constraint.column_name === "event_type",
      );
      if (eventTypeChecks.length !== 1) {
        throw new Error(
          `${contract.owner_service}.${outboxTable} must bind event_type to exactly one owner-union CHECK`,
        );
      }
    }
    if (columns.has("event_type") && columns.has("producer")) {
      const producerChecks = checks.filter(
        ({ table_name, semantic_constraint }) =>
          table_name === outboxTable &&
          semantic_constraint?.kind === "text_equals" &&
          semantic_constraint.column_name === "producer" &&
          semantic_constraint.value === contract.owner_service,
      );
      if (producerChecks.length !== 1) {
        throw new Error(
          `${contract.owner_service}.${outboxTable} must bind producer to its owner service CHECK`,
        );
      }
    } else if (columns.has("event_type") && columns.has("payload")) {
      const producerChecks = checks.filter(
        ({ table_name, semantic_constraint }) =>
          table_name === outboxTable &&
          ((semantic_constraint?.kind === "json_text_equals" &&
            semantic_constraint.column_name === "payload" &&
            semantic_constraint.field_name === "producer" &&
            semantic_constraint.value === contract.owner_service) ||
            (semantic_constraint?.kind === "json_event_envelope" &&
              semantic_constraint.column_name === "payload" &&
              semantic_constraint.producer_value === contract.owner_service)),
      );
      if (producerChecks.length !== 1) {
        throw new Error(
          `${contract.owner_service}.${outboxTable} must bind its envelope producer to the owner service CHECK`,
        );
      }
    } else if (columns.has("source_event_id")) {
      if (!columns.has("payload_hash")) {
        throw new Error(
          `${contract.owner_service}.${outboxTable} controlled outbox must pin payload_hash`,
        );
      }
      const sourceForeignKeys = contract.foreign_keys.filter(
        ({ table_name, columns: sourceColumns, referenced_columns }) =>
          table_name === outboxTable &&
          sourceColumns.length === 1 &&
          sourceColumns[0] === "source_event_id" &&
          referenced_columns.length === 1 &&
          referenced_columns[0] === "id",
      );
      if (sourceForeignKeys.length !== 1) {
        throw new Error(
          `${contract.owner_service}.${outboxTable} must bind source_event_id to exactly one canonical event table`,
        );
      }
      const sourceTable = sourceForeignKeys[0]?.referenced_table;
      const sourceEventTypeChecks = checks.filter(
        ({ table_name, semantic_constraint }) =>
          table_name === sourceTable &&
          semantic_constraint?.kind === "text_enum" &&
          semantic_constraint.column_name === "event_type",
      );
      const sourceEnvelopeChecks = checks.filter(
        ({ table_name, semantic_constraint }) =>
          table_name === sourceTable &&
          semantic_constraint?.kind === "json_event_envelope" &&
          semantic_constraint.column_name === "envelope" &&
          semantic_constraint.producer_value === contract.owner_service &&
          [
            ["event_id", "id"],
            ["event_type", "event_type"],
            ["idempotency_key", "idempotency_key"],
          ].every(([fieldName, columnName]) =>
            semantic_constraint.field_bindings.some(
              ({ field_name, column_name }) =>
                field_name === fieldName && column_name === columnName,
            ),
          ),
      );
      if (
        sourceEventTypeChecks.length !== 1 ||
        sourceEnvelopeChecks.length !== 1
      ) {
        throw new Error(
          `${contract.owner_service}.${outboxTable} must reference one owner-union, owner-produced canonical event envelope`,
        );
      }
    }
  }
  const appendOnlySet = new Set<string>(contract.append_only_tables);
  const permissionKinds = new Map(
    contract.table_permissions.map(({ table_name, writer_kind }) => [
      table_name,
      writer_kind,
    ]),
  );
  const dlqResolutions = contract.dlq_resolutions;
  if (dlqResolutions !== undefined) {
    const mappedDlqs = dlqResolutions.map(({ dlq_table }) => dlq_table);
    const resolutionTables = dlqResolutions.map(
      ({ resolution_table }) => resolution_table,
    );
    const resolveWriters = dlqResolutions.map(
      ({ resolve_writer }) => resolve_writer,
    );
    if (
      dlqResolutions.length !== contract.dlq_tables.length ||
      new Set(mappedDlqs).size !== mappedDlqs.length ||
      new Set(resolutionTables).size !== resolutionTables.length ||
      new Set(resolveWriters).size !== resolveWriters.length ||
      mappedDlqs.some((table) => !contract.dlq_tables.includes(table)) ||
      contract.dlq_tables.some((table) => !mappedDlqs.includes(table))
    ) {
      throw new Error(
        `${contract.owner_service} dlq_resolutions must cover every DLQ exactly once`,
      );
    }
    for (const binding of dlqResolutions) {
      const expected = ownerDlqResolutionContractV1(
        contract.schema,
        binding.dlq_table,
      );
      const resolutionTable = binding.resolution_table;
      if (
        binding.resolution_table !== expected.binding.resolution_table ||
        binding.resolve_writer !== expected.binding.resolve_writer ||
        binding.dlq_table === resolutionTable ||
        !tableSet.has(resolutionTable) ||
        contract.dlq_tables.includes(resolutionTable) ||
        !appendOnlySet.has(binding.dlq_table) ||
        !appendOnlySet.has(resolutionTable) ||
        permissionKinds.get(binding.dlq_table) !== "immutable_append" ||
        permissionKinds.get(resolutionTable) !== "immutable_append"
      ) {
        throw new Error(
          `${contract.owner_service}.${binding.dlq_table} must use a separate immutable canonical resolution table`,
        );
      }
      if (
        physicalColumnsByTable.get(binding.dlq_table)?.has("resolved_at") ===
        true
      ) {
        throw new Error(
          `${contract.owner_service}.${binding.dlq_table} cannot mutate resolved_at on immutable DLQ history`,
        );
      }
      const expectedColumnNames = expected.database_columns.map(
        ({ column_name }) => column_name,
      );
      const observedColumnNames = [
        ...(physicalColumnsByTable.get(resolutionTable) ?? []),
      ];
      assertSameSet(
        `${contract.owner_service}.${resolutionTable} resolution columns`,
        observedColumnNames,
        expectedColumnNames,
      );
      const selectedColumns =
        contract.table_permissions.find(
          ({ table_name }) => table_name === resolutionTable,
        )?.select_columns ?? [];
      assertSameSet(
        `${contract.owner_service}.${resolutionTable} resolution SELECT columns`,
        selectedColumns,
        expected.table_permission.select_columns,
      );
      const columnShape = (column: OwnerDatabaseColumnV1): string =>
        [
          column.table_name,
          column.column_name,
          column.postgres_type,
          column.not_null,
          column.default_expression,
          column.identity,
          column.generated,
        ].join("\u0000");
      assertSameSet(
        `${contract.owner_service}.${resolutionTable} resolution physical schema`,
        (contract.database_columns ?? [])
          .filter(({ table_name }) => table_name === resolutionTable)
          .map(columnShape),
        expected.database_columns.map(columnShape),
      );
      const foreignKeyShape = (foreignKey: OwnerForeignKeyV1): string =>
        JSON.stringify([
          foreignKey.constraint_name,
          foreignKey.table_name,
          foreignKey.columns,
          foreignKey.referenced_schema,
          foreignKey.referenced_table,
          foreignKey.referenced_columns,
          foreignKey.match_type,
          foreignKey.on_update,
          foreignKey.on_delete,
          foreignKey.deferrable,
          foreignKey.initially_deferred,
          foreignKey.validated,
        ]);
      assertSameSet(
        `${contract.owner_service}.${resolutionTable} resolution foreign key`,
        contract.foreign_keys
          .filter(({ table_name }) => table_name === resolutionTable)
          .map(foreignKeyShape),
        expected.foreign_keys.map(foreignKeyShape),
      );
      const uniqueShape = (
        constraint: OwnerDatabaseUniqueConstraintV1,
      ): string =>
        JSON.stringify([
          constraint.constraint_name,
          constraint.table_name,
          constraint.columns,
          constraint.kind,
          constraint.deferrable,
          constraint.initially_deferred,
          constraint.validated,
        ]);
      assertSameSet(
        `${contract.owner_service}.${resolutionTable} resolution uniqueness`,
        (contract.database_unique_constraints ?? [])
          .filter(({ table_name }) => table_name === resolutionTable)
          .map(uniqueShape),
        expected.database_unique_constraints.map(uniqueShape),
      );
      const indexShape = (index: OwnerDatabaseIndexV1): string =>
        JSON.stringify([
          index.index_name,
          index.table_name,
          index.definition,
          index.unique,
          index.primary,
          index.valid,
        ]);
      assertSameSet(
        `${contract.owner_service}.${resolutionTable} resolution indexes`,
        (contract.database_indexes ?? [])
          .filter(({ table_name }) => table_name === resolutionTable)
          .map(indexShape),
        expected.database_indexes.map(indexShape),
      );
      const signatureShape = (signature: OwnerFunctionSignatureV1): unknown => ({
        schema: signature.schema,
        function_name: signature.function_name,
        primary_table: signature.primary_table,
        writer_kind: signature.writer_kind,
        arguments: signature.arguments.map((argument) => ({
          argument_name: argument.argument_name,
          postgres_type: argument.postgres_type,
          mode: argument.mode,
          nullable: argument.nullable === true,
        })),
        reads_tables: signature.reads_tables,
        writes_tables: signature.writes_tables,
        effects: signature.effects,
        returns: signature.returns,
        security_definer: signature.security_definer,
        search_path: signature.search_path,
      });
      const resolutionWriters = contract.function_signatures.filter(
        ({ writes_tables }) => writes_tables.includes(resolutionTable),
      );
      const observedWriter = resolutionWriters[0];
      const expectedWriter = expected.function_signatures[0];
      if (
        resolutionWriters.length !== 1 ||
        observedWriter === undefined ||
        expectedWriter === undefined ||
        observedWriter.function_name !== binding.resolve_writer ||
        fingerprint(signatureShape(observedWriter)) !==
          fingerprint(signatureShape(expectedWriter))
      ) {
        throw new Error(
          `${contract.owner_service}.${binding.dlq_table} must declare one canonical idempotent resolve writer`,
        );
      }
      Object.freeze(binding);
    }
  }
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
  const standardOutboxArguments = {
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
  const standardTransportEpochArguments = [
    ["p_transport_name", "text"],
    ["p_expected_generation", "bigint"],
    ["p_next_epoch", "text"],
    ["p_next_generation", "bigint"],
    ["p_now", "timestamptz"],
  ] as const;
  if (contract.outbox_tables.length > 0) {
    const authorityPermission = contract.table_permissions.find(
      ({ table_name }) =>
        table_name === OWNER_EVENTING_TRANSPORT_EPOCH_TABLE_V1,
    );
    if (
      !tableSet.has(OWNER_EVENTING_TRANSPORT_EPOCH_TABLE_V1) ||
      authorityPermission?.writer_kind !== "pointer_cas" ||
      !ownerEventingTransportEpochColumnsV1.every((column) =>
        authorityPermission.select_columns.includes(column),
      )
    ) {
      throw new Error(
        `${contract.owner_service} outbox writers must declare an active eventing transport epoch authority table`,
      );
    }
    const activeGenerationChecks = checks.filter(
      ({ table_name, semantic_constraint }) =>
        table_name === OWNER_EVENTING_TRANSPORT_EPOCH_TABLE_V1 &&
        semantic_constraint?.kind === "integer_range" &&
        semantic_constraint.column_name === "active_generation" &&
        semantic_constraint.min === 1 &&
        semantic_constraint.max === OWNER_SAFE_BIGINT_MAX_V1,
    );
    if (activeGenerationChecks.length !== 1) {
      throw new Error(
        `${contract.owner_service} eventing transport active_generation must be bounded to JavaScript safe integers`,
      );
    }
    const activationWriters = contract.function_signatures.filter(
      (signature) =>
        signature.primary_table === OWNER_EVENTING_TRANSPORT_EPOCH_TABLE_V1 &&
        signature.effects.some(
          (effect) =>
            effect.table_name === OWNER_EVENTING_TRANSPORT_EPOCH_TABLE_V1 &&
            effect.operation === "cas" &&
            effect.concurrency_control === "generation_fence",
        ),
    );
    const activationWriter = activationWriters[0];
    if (
      activationWriters.length !== 1 ||
      activationWriter === undefined ||
      activationWriter.function_name !== OWNER_EVENTING_TRANSPORT_EPOCH_WRITER_V1 ||
      activationWriter.writer_kind !== "pointer_cas" ||
      activationWriter.returns !== "jsonb" ||
      JSON.stringify(
        activationWriter.arguments.map(({ argument_name, postgres_type }) => [
          argument_name,
          postgres_type,
        ]),
      ) !== JSON.stringify(standardTransportEpochArguments)
    ) {
      throw new Error(
        `${contract.owner_service} must declare one generation-fenced eventing transport activation writer`,
      );
    }
  }
  for (const outboxTable of contract.outbox_tables) {
    const signatures = contract.function_signatures.filter(
      ({ primary_table }) => primary_table === outboxTable,
    );
    for (const [operation, expectedArguments] of Object.entries(
      standardOutboxArguments,
    ) as readonly ["claim" | "ack", typeof standardOutboxArguments.claim | typeof standardOutboxArguments.ack][]) {
      const matches = signatures.filter((signature) =>
        signature.effects.some(
          (effect) =>
            effect.table_name === outboxTable && effect.operation === operation,
        ),
      );
      const signature = matches[0];
      if (
        matches.length !== 1 ||
        signature === undefined ||
        signature.writer_kind !== "outbox_claim_ack" ||
        signature.returns !== (operation === "claim" ? "setof jsonb" : "jsonb") ||
        JSON.stringify(
          signature.arguments.map(({ argument_name, postgres_type }) => [
            argument_name,
            postgres_type,
          ]),
        ) !== JSON.stringify(expectedArguments) ||
        JSON.stringify(
          signature.arguments
            .filter(({ nullable }) => nullable === true)
            .map(({ argument_name }) => argument_name),
        ) !==
          JSON.stringify(
            operation === "ack"
              ? OWNER_OUTBOX_ACK_NULLABLE_ARGUMENT_NAMES_V1
              : [],
          ) ||
        !signature.reads_tables.some(
          (table) => table === OWNER_EVENTING_TRANSPORT_EPOCH_TABLE_V1,
        )
      ) {
        throw new Error(
          `${contract.owner_service}.${outboxTable} must declare exactly one standard ${operation} writer that reads the active eventing transport epoch`,
        );
      }
    }
  }
  const reconciliationOperations = new Set<OwnerFunctionEffectV1["operation"]>([
    "reconcile_mark_missing",
    "reconcile_claim",
    "reconcile_ack_present",
    "reconcile_ack_rematerialized",
    "reconcile_ack_permanent_failure",
  ]);
  const reconciliationTables = new Set(
    contract.function_signatures.flatMap((signature) =>
      signature.effects.flatMap((effect) =>
        reconciliationOperations.has(effect.operation)
          ? [effect.table_name]
          : [],
      ),
    ),
  );
  for (const outboxTable of reconciliationTables) {
    if (!contract.outbox_tables.includes(outboxTable)) {
      throw new Error(
        `${contract.owner_service}.${outboxTable} reconciliation must target a registered outbox`,
      );
    }
    const expected = ownerEventingReconciliationContractV1(
      contract.schema,
      outboxTable,
    );
    const actualSignatures = contract.function_signatures.filter(
      ({ primary_table }) => primary_table === outboxTable,
    );
    for (const expectedSignature of expected.function_signatures) {
      const expectedOperation = expectedSignature.effects[0]?.operation;
      const matches = actualSignatures.filter((signature) =>
        signature.effects.some(
          (effect) => effect.operation === expectedOperation,
        ),
      );
      const observed = matches[0];
      const shape = (signature: OwnerFunctionSignatureV1): unknown => ({
        schema: signature.schema,
        function_name: signature.function_name,
        primary_table: signature.primary_table,
        writer_kind: signature.writer_kind,
        arguments: signature.arguments.map((argument) => ({
          argument_name: argument.argument_name,
          postgres_type: argument.postgres_type,
          mode: argument.mode,
          nullable: argument.nullable === true,
        })),
        reads_tables: signature.reads_tables,
        writes_tables: signature.writes_tables,
        effects: signature.effects,
        returns: signature.returns,
        security_definer: signature.security_definer,
        search_path: signature.search_path,
      });
      if (
        expectedOperation === undefined ||
        matches.length !== 1 ||
        observed === undefined ||
        fingerprint(shape(observed)) !== fingerprint(shape(expectedSignature))
      ) {
        throw new Error(
          `${contract.owner_service}.${outboxTable} reconciliation writer ABI drift: ${expectedOperation ?? "unknown"}`,
        );
      }
    }
    const physicalColumns = new Set(
      (contract.database_columns ?? [])
        .filter(({ table_name }) => table_name === outboxTable)
        .map(({ column_name }) => column_name),
    );
    if (
      [
        ...expected.required_existing_columns,
        ...expected.database_columns.map(({ column_name }) => column_name),
      ].some((column) => !physicalColumns.has(column))
    ) {
      throw new Error(
        `${contract.owner_service}.${outboxTable} reconciliation physical column drift`,
      );
    }
    const selectedColumns = new Set(
      contract.table_permissions.find(
        ({ table_name }) => table_name === outboxTable,
      )?.select_columns ?? [],
    );
    if (
      ownerEventingReconciliationAddedColumnsV1.some((column) =>
        selectedColumns.has(column),
      )
    ) {
      throw new Error(
        `${contract.owner_service}.${outboxTable} reconciliation internal columns cannot be direct SELECT grants`,
      );
    }
    for (const expectedColumn of expected.database_columns) {
      const observed = contract.database_columns?.find(
        ({ table_name, column_name }) =>
          table_name === outboxTable &&
          column_name === expectedColumn.column_name,
      );
      const columnShape = (column: OwnerDatabaseColumnV1): string =>
        [
          column.table_name,
          column.column_name,
          column.postgres_type,
          column.not_null,
          column.default_expression,
          column.identity,
          column.generated,
        ].join("\u0000");
      if (
        observed === undefined ||
        columnShape(observed) !== columnShape(expectedColumn)
      ) {
        throw new Error(
          `${contract.owner_service}.${outboxTable} reconciliation column drift: ${expectedColumn.column_name}`,
        );
      }
    }
    for (const expectedCheck of expected.database_checks) {
      const observed = contract.database_checks?.find(
        ({ constraint_name }) =>
          constraint_name === expectedCheck.constraint_name,
      );
      const observedDefinition = observed?.required_definition_fragments.join(
        "\n",
      ) ?? "";
      if (
        observed === undefined ||
        observed.table_name !== expectedCheck.table_name ||
        expectedCheck.required_definition_fragments.some(
          (fragment) => !observedDefinition.includes(fragment),
        ) ||
        fingerprint(observed.semantic_constraint) !==
          fingerprint(expectedCheck.semantic_constraint)
      ) {
        throw new Error(
          `${contract.owner_service}.${outboxTable} reconciliation CHECK drift: ${expectedCheck.constraint_name}`,
        );
      }
    }
    for (const expectedIndex of expected.database_indexes) {
      const observed = contract.database_indexes?.find(
        ({ index_name }) => index_name === expectedIndex.index_name,
      );
      if (
        observed === undefined ||
        fingerprint(observed) !== fingerprint(expectedIndex)
      ) {
        throw new Error(
          `${contract.owner_service}.${outboxTable} reconciliation index drift: ${expectedIndex.index_name}`,
        );
      }
    }
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
  // Validate the generated source attestation after the semantic contract.
  // This preserves precise fail-closed diagnostics for malformed signatures
  // while still refusing any otherwise-valid contract whose artifact set or
  // signature fingerprint drifted.
  if (contract.writer_artifacts !== undefined) {
    const artifactsByName = new Map(
      contract.writer_artifacts.map((artifact) => [artifact.function_name, artifact]),
    );
    if (
      artifactsByName.size !== contract.function_signatures.length ||
      contract.writer_artifacts.length !== contract.function_signatures.length
    ) {
      throw new Error(
        `${contract.owner_service} writer_artifacts must cover every generated writer exactly once`,
      );
    }
    for (const signature of contract.function_signatures) {
      const artifact = artifactsByName.get(signature.function_name);
      if (
        artifact === undefined ||
        artifact.artifact_version !== "owner_writer_artifact.v1" ||
        artifact.generator !== "pai-infra-owner-writer.v1" ||
        !generatedPermissionPattern.test(artifact.generator_source) ||
        !contract.generated_permission_sql.includes(artifact.generator_source) ||
        artifact.signature_fingerprint !== `sha256:${fingerprint(signature)}` ||
        !/^sha256:[0-9a-f]{64}$/u.test(artifact.function_body_sha256)
      ) {
        throw new Error(
          `invalid trusted writer artifact: ${contract.schema}.${signature.function_name} ` +
            `(expected signature sha256:${fingerprint(signature)}, observed ` +
            `${artifact?.signature_fingerprint ?? "missing"})`,
        );
      }
      Object.freeze(artifact);
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

interface VerifiedOwnerDeploymentBindingV1 {
  readonly catalog_postgres: PostgresQueryPortV1;
  readonly runtime_postgres: PostgresQueryPortV1;
  /**
   * Set only by openVerifiedOwnerPostgresCompositionV1 after its module-private
   * Pool has completed both catalog and runtime verification. Public verifier
   * callers receive a read-only proof and cannot activate writer execution,
   * even when they supply an instanceof-compatible object or Pool subclass.
   */
  readonly activation_pool?: Pool;
  readonly contract_fingerprint: string;
  readonly database_fingerprint: string;
}

/**
 * A deployment value is only an application capability while this module can
 * prove which live query ports produced it. Keeping the binding out of the
 * serializable value also makes copies and caller-assembled lookalikes inert.
 */
const verifiedOwnerDeploymentBindingsV1 = new WeakMap<
  object,
  VerifiedOwnerDeploymentBindingV1
>();

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

export interface PostgresReadCommittedTransactionV1
  extends PostgresQueryPortV1 {}

/**
 * Pins all callback statements to one checked-out client and one READ
 * COMMITTED, READ ONLY transaction. Each statement after an awaited lock
 * receives a new READ COMMITTED snapshot. The capability accepts one bounded,
 * repository-safe SELECT at a time, rejects session/transaction control, and
 * READ ONLY prevents an inherited SECURITY DEFINER writer from committing
 * table mutations. The capability is revoked as soon as the callback settles.
 */
export interface PostgresReadCommittedTransactionPortV1 {
  withReadCommittedTransaction<TResult>(
    work: (
      transaction: PostgresReadCommittedTransactionV1,
    ) => Promise<TResult>,
  ): Promise<TResult>;
}

const OWNER_READ_QUERY_MAX_LENGTH_V1 = 64 * 1_024;
const ownerReadUnsafeFunctionPatternV1 =
  /\b(?:pg_catalog\s*\.\s*)?(?:pg_advisory_lock(?:_shared)?|pg_try_advisory_lock(?:_shared)?|pg_advisory_unlock(?:_shared|_all)?|set_config|pg_notify|pg_cancel_backend|pg_terminate_backend|pg_reload_conf|pg_rotate_logfile|pg_log_backend_memory_contexts)\s*\(/iu;

function assertOwnerRepositorySafeReadStatementV1(sql: unknown): asserts sql is string {
  if (
    typeof sql !== "string" ||
    sql.length === 0 ||
    sql.length > OWNER_READ_QUERY_MAX_LENGTH_V1 ||
    sql.includes("\0")
  ) {
    throw new Error(
      "owner READ COMMITTED transaction requires a bounded repository-safe SELECT statement",
    );
  }
  const statement = sql.trim();
  if (
    !/^select(?:\s|\()/iu.test(statement) ||
    statement.includes(";") ||
    statement.includes('"') ||
    /--|\/\*|\*\//u.test(statement)
  ) {
    throw new Error(
      "owner READ COMMITTED transaction accepts only one repository-safe SELECT statement",
    );
  }
  if (ownerReadUnsafeFunctionPatternV1.test(statement)) {
    throw new Error(
      "owner READ COMMITTED transaction rejects session-level or side-effecting functions",
    );
  }
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

function databaseIndexDefinitionMatchesColumns(
  definition: string,
  expectedColumns: readonly string[],
): boolean {
  const normalized = definition
    .replace(/\s+/gu, " ")
    .trim()
    .toLowerCase();
  const match = /\busing\s+btree\s*\(([^()]*)\)\s*$/iu.exec(normalized);
  const columns = match?.[1]
    ?.split(",")
    .map((column) => column.trim().replace(/^"|"$/gu, ""));
  return columns !== undefined && fingerprint(columns) === fingerprint(expectedColumns);
}

function staticFunctionBody(definition: string): string {
  const bodyMatch = definition.match(/\bas\s+(\$[a-z0-9_]*\$)([\s\S]*?)\1/i);
  if (bodyMatch?.[2] === undefined) {
    throw new Error("owner writer function body must use a static dollar-quoted definition");
  }
  return bodyMatch[2];
}

function canonicalWriterSource(value: string): string {
  return value.replace(/\r\n?/gu, "\n").trim();
}

function writerSourceSha256(value: string): string {
  return `sha256:${createHash("sha256")
    .update(canonicalWriterSource(value), "utf8")
    .digest("hex")}`;
}

function assertImmutableTriggerFunctionSourceV1(value: string): void {
  const source = canonicalWriterSource(value);
  if (
    source.length === 0 ||
    source.length > 4096 ||
    source.includes("\0") ||
    !/^begin\s+raise\s+exception\s+'(?:''|[^'])*'(?:\s+using\s+errcode\s*=\s*'(?:''|[^'])*')?\s*;\s*end\s*;$/iu.test(
      source,
    )
  ) {
    throw new Error(
      "immutable trigger function must contain exactly one unconditional static RAISE EXCEPTION",
    );
  }
}

function assertOwnerWriterRuntimeGucSafetyV1(
  signature: Pick<OwnerFunctionSignatureV1, "schema" | "function_name">,
  functionSource: string,
): void {
  const semantic = stripDollarQuotedStringLiterals(functionSource)
    .replace(/\/\*[\s\S]*?\*\//gu, " ")
    .replace(/--[^\r\n]*/gu, " ")
    .toLowerCase();
  if (
    /\bset\s+(?:local\s+|session\s+)?(?:session_replication_role|synchronous_commit)\b/iu.test(
      semantic,
    ) ||
    // SECURITY DEFINER writers have no legitimate reason to mutate arbitrary
    // runtime GUCs. Reject every set_config call so concatenated names,
    // variables, casts, or wrapper expressions cannot bypass a literal scan.
    /\b(?:pg_catalog\s*\.\s*)?set_config\s*\(/iu.test(semantic)
  ) {
    throw new Error(
      `protected runtime GUC changes are forbidden in owner writer: ${signature.schema}.${signature.function_name}`,
    );
  }
}

function assertMetaFinalizationProvenanceSourceV1(
  signature: Pick<OwnerFunctionSignatureV1, "schema" | "function_name">,
  functionSource: string,
): void {
  if (
    signature.schema !== "trigger_processor" ||
    signature.function_name !== "finalize_trigger_meta_projection_v1"
  ) {
    return;
  }
  const semantic = stripDollarQuotedStringLiterals(functionSource)
    .replace(/\/\*[\s\S]*?\*\//gu, " ")
    .replace(/--[^\r\n]*/gu, " ")
    .toLowerCase();
  const processSelection =
    /\bselect\b([\s\S]*?)\binto\b([\s\S]*?)\bfrom\s+(?:only\s+)?trigger_processor\s*\.\s*trigger_processes\b([\s\S]*?)\bfor\s+(?:no\s+key\s+)?update\b/iu.exec(
      semantic,
    );
  const processExpressions = splitTopLevelSqlCommaList(
    processSelection?.[1] ?? "",
  );
  const processVariables = splitTopLevelSqlCommaList(
    processSelection?.[2] ?? "",
  ).map((variable) => variable.trim());
  const processVariableFor = (column: string): string | undefined => {
    const index = processExpressions.findIndex((expression) =>
      new RegExp(`\\b${escapeRegularExpression(column)}\\b`, "iu").test(
        expression,
      ),
    );
    return index < 0 ? undefined : processVariables[index];
  };
  const persistedPhaseVariable = processVariableFor("phase");
  const persistedStatusVariable = processVariableFor("status");
  const persistedUpdatedAtVariable = processVariableFor("updated_at");
  const persistedMetaReasonVariable = processVariableFor("meta_enqueue_reason");
  const processFenceComparison = (
    variable: string | undefined,
    argument: string,
  ): boolean =>
    variable !== undefined &&
    new RegExp(
      `\\b${escapeRegularExpression(variable)}\\s+is\\s+distinct\\s+from\\s+${escapeRegularExpression(argument)}\\b`,
      "iu",
    ).test(semantic);
  const processLock =
    processSelection !== null &&
    processExpressions.length === processVariables.length &&
    /\bid\s*=\s*p_process_id\b/iu.test(processSelection[3] ?? "") &&
    processFenceComparison(
      persistedPhaseVariable,
      "p_expected_process_phase",
    ) &&
    processFenceComparison(
      persistedStatusVariable,
      "p_expected_process_status",
    ) &&
    processFenceComparison(
      persistedUpdatedAtVariable,
      "p_expected_process_updated_at",
    ) &&
    processFenceComparison(
      persistedMetaReasonVariable,
      "p_expected_meta_enqueue_reason",
    );
  const evidenceKey = (key: string): string =>
    `p_meta_finalization_evidence\\s*(?:->>|#>>)\\s*'(?:\\{)?${key}(?:\\})?'`;
  const provenanceComparison = new RegExp(
    `${evidenceKey("execution_provenance")}\\s+is\\s+distinct\\s+from\\s+([a-z][a-z0-9_]*)`,
    "iu",
  ).exec(semantic);
  const executionRefComparison = new RegExp(
    `${evidenceKey("execution_transition_ref")}\\s+is\\s+distinct\\s+from\\s+([a-z][a-z0-9_]*)`,
    "iu",
  ).exec(semantic);
  const deferredRefComparison = new RegExp(
    `${evidenceKey("deferred_transition_ref")}\\s+is\\s+distinct\\s+from\\s+([a-z][a-z0-9_]*)`,
    "iu",
  ).exec(semantic);
  const provenanceVariable = provenanceComparison?.[1];
  const executionRefVariable = executionRefComparison?.[1];
  const deferredRefVariable = deferredRefComparison?.[1];
  const transitionHistoryLockMatch =
    /\bperform\s+1\b[\s\S]*?\bfrom\s+(?:only\s+)?trigger_processor\s*\.\s*trigger_process_transitions\b[\s\S]*?\btrigger_process_id\s*=\s*p_process_id\b[\s\S]*?\bfor\s+(?:no\s+key\s+)?(?:update|share)\b/iu.exec(
      semantic,
    );
  const transitionHistoryLock =
    transitionHistoryLockMatch !== null &&
    !/\blimit\b/iu.test(transitionHistoryLockMatch[0]);
  const transitionSelections = [
    ...semantic.matchAll(
      /\bselect\b([\s\S]*?)\binto\b([\s\S]*?)\bfrom\s+(?:only\s+)?trigger_processor\s*\.\s*trigger_process_transitions\b([\s\S]*?);/giu,
    ),
  ].map((match) => {
    const expressions = splitTopLevelSqlCommaList(match[1] ?? "");
    const variables = splitTopLevelSqlCommaList(match[2] ?? "").map(
      (variable) => variable.trim(),
    );
    return {
      expressions,
      variables,
      tail: match[3] ?? "",
      statement: match[0],
      expressionFor(variable: string | undefined): string | undefined {
        if (variable === undefined) return undefined;
        const index = variables.indexOf(variable);
        return index < 0 ? undefined : expressions[index];
      },
    };
  });
  const executionSelection = transitionSelections.find(
    ({ tail }) =>
      /\bto_phase\s*=\s*'execution'/iu.test(tail) &&
      /\border\s+by\b[\s\S]*?\bcreated_at\s+desc\b/iu.test(tail) &&
      /\blimit\s+1\b/iu.test(tail),
  );
  const executionRefExpression = executionSelection?.expressionFor(
    executionRefVariable,
  );
  const provenanceExpression = executionSelection?.expressionFor(
    provenanceVariable,
  );
  const executionCreatedAtVariable = executionSelection?.variables.find(
    (variable) =>
      /\bcreated_at\b/iu.test(executionSelection.expressionFor(variable) ?? ""),
  );
  const executionHistoryDerivation =
    executionSelection !== undefined &&
    executionSelection.expressions.length === executionSelection.variables.length &&
    executionRefVariable !== undefined &&
    provenanceVariable !== undefined &&
    executionCreatedAtVariable !== undefined &&
    /\bid\b/iu.test(executionRefExpression ?? "") &&
    /\bcase\b/iu.test(provenanceExpression ?? "") &&
    /\bfrom_phase\b/iu.test(provenanceExpression ?? "") &&
    /'deferred'/iu.test(provenanceExpression ?? "") &&
    /'direct_execution'/iu.test(provenanceExpression ?? "") &&
    /'deferred_execution'/iu.test(provenanceExpression ?? "") &&
    !/p_meta_finalization_evidence/iu.test(executionSelection.statement);
  const deferredSelection = transitionSelections.find(
    ({ tail }) =>
      /\bto_phase\s*=\s*'deferred'/iu.test(tail) &&
      executionCreatedAtVariable !== undefined &&
      new RegExp(
        `\\bcreated_at\\s*<\\s*${escapeRegularExpression(executionCreatedAtVariable)}\\b`,
        "iu",
      ).test(tail) &&
      /\border\s+by\b[\s\S]*?\bcreated_at\s+desc\b/iu.test(tail) &&
      /\blimit\s+1\b/iu.test(tail),
  );
  const deferredHistoryDerivation =
    deferredSelection !== undefined &&
    deferredSelection.expressions.length === deferredSelection.variables.length &&
    /\bid\b/iu.test(deferredSelection.expressionFor(deferredRefVariable) ?? "") &&
    !/p_meta_finalization_evidence/iu.test(deferredSelection.statement);
  const provenanceBranching =
    provenanceVariable !== undefined &&
    executionRefVariable !== undefined &&
    deferredRefVariable !== undefined &&
    new RegExp(
      `\\bif\\s+${escapeRegularExpression(executionRefVariable)}\\s+is\\s+null\\s+then[\\s\\S]*?\\b${escapeRegularExpression(provenanceVariable)}\\s*:=\\s*'not_applicable'[\\s\\S]*?\\b${escapeRegularExpression(deferredRefVariable)}\\s*:=\\s*null[\\s\\S]*?\\belsif\\s+${escapeRegularExpression(provenanceVariable)}\\s*=\\s*'deferred_execution'\\s+then[\\s\\S]*?\\bto_phase\\s*=\\s*'deferred'[\\s\\S]*?\\belse\\b[\\s\\S]*?\\b${escapeRegularExpression(deferredRefVariable)}\\s*:=\\s*null[\\s\\S]*?\\bend\\s+if\\s*;`,
      "iu",
    ).test(semantic);
  const evidenceKeys = [
    ...semantic.matchAll(
      /\bp_meta_finalization_evidence\s*(?:->>|#>>)\s*'(?:\{)?([a-z][a-z0-9_]*)(?:\})?'/giu,
    ),
  ].flatMap((match) => (match[1] === undefined ? [] : [match[1]]));
  const evidenceReadsAreBounded =
    evidenceKeys.length >= 6 &&
    evidenceKeys.every((key) =>
      [
        "execution_provenance",
        "execution_transition_ref",
        "deferred_transition_ref",
        "terminal_outcome",
      ].includes(key),
    );
  const allowlistPredicate =
    /\bif\s+not\s*\(([\s\S]*?)\)\s+then\s+raise\s+exception\b[\s\S]*?\bend\s+if\s*;/iu.exec(
      semantic,
    )?.[1] ?? "";
  const allowlistTerms = splitCheckDisjunction(
    stripBalancedOuterParentheses(allowlistPredicate),
  );
  const terminalOutcomePattern = (value: string): RegExp =>
    new RegExp(
      `${evidenceKey("terminal_outcome")}\\s*=\\s*'${escapeRegularExpression(value)}'`,
      "iu",
    );
  const provenancePattern = (value: string): RegExp =>
    new RegExp(
      `${evidenceKey("execution_provenance")}\\s*=\\s*'${escapeRegularExpression(value)}'`,
      "iu",
    );
  const allowlistTuples = [
    ["user_retracted", "cancelled_with_reason", undefined],
    ["system_interrupted", "interrupted_with_reason", undefined],
    ["failed_with_learnable_snapshot", "failed_with_reason", undefined],
    ["cooldown_expired", "executed", "direct_execution"],
    ["cooldown_expired", "deferred_then_executed", "deferred_execution"],
    ["cooldown_expired", "failed_with_reason", "direct_execution"],
    ["cooldown_expired", "failed_with_reason", "deferred_execution"],
  ] as const;
  const reasonOutcomeAllowlist =
    persistedMetaReasonVariable !== undefined &&
    allowlistTerms.length === allowlistTuples.length &&
    allowlistTerms.every((term) => !/\bor\b/iu.test(term)) &&
    allowlistTuples.every(
      ([reason, outcome, provenance]) =>
        allowlistTerms.filter(
          (term) => {
            const matchers = [
              new RegExp(
              `\\b${escapeRegularExpression(persistedMetaReasonVariable)}\\s*=\\s*'${escapeRegularExpression(reason)}'`,
              "iu",
              ),
              terminalOutcomePattern(outcome),
              ...(provenance === undefined
                ? []
                : [provenancePattern(provenance)]),
            ];
            const conjunctions = splitCheckConjunction(
              stripBalancedOuterParentheses(term),
            );
            return (
              conjunctions.length === matchers.length &&
              matchers.every(
                (matcher) =>
                  conjunctions.filter((conjunction) =>
                    matcher.test(stripBalancedOuterParentheses(conjunction)),
                  ).length === 1,
              )
            );
          },
        ).length === 1,
    );
  const mismatchRaises =
    /\bif\b[\s\S]*?p_meta_finalization_evidence\s*(?:->>|#>>)\s*'(?:\{)?execution_provenance(?:\})?'[\s\S]*?\bor\b[\s\S]*?p_meta_finalization_evidence\s*(?:->>|#>>)\s*'(?:\{)?execution_transition_ref(?:\})?'[\s\S]*?\bor\b[\s\S]*?p_meta_finalization_evidence\s*(?:->>|#>>)\s*'(?:\{)?deferred_transition_ref(?:\})?'[\s\S]*?\bthen\b[\s\S]*?\braise\s+exception\b[\s\S]*?\bend\s+if\s*;/iu.test(
      semantic,
    );
  if (
    !processLock ||
    !transitionHistoryLock ||
    !executionHistoryDerivation ||
    !deferredHistoryDerivation ||
    !provenanceBranching ||
    !evidenceReadsAreBounded ||
    !reasonOutcomeAllowlist ||
    !mismatchRaises
  ) {
    throw new Error(
      `PostgreSQL Meta finalization provenance drift: ${signature.schema}.${signature.function_name}`,
    );
  }
}

function stripDollarQuotedStringLiterals(value: string): string {
  return value.replace(/\$([a-z_][a-z0-9_]*)?\$[\s\S]*?\$\1\$/gi, "''");
}

function semanticFunctionDefinition(definition: string): string {
  return stripDollarQuotedStringLiterals(staticFunctionBody(definition))
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
  let conditionalDepth = 0;
  for (const match of value.matchAll(
    /\bend\s+if\b|\bif\b|\breturn\s+(?!next\b|query\b)/giu,
  )) {
    const token = match[0].toLowerCase().replace(/\s+/gu, " ");
    if (token === "if") {
      conditionalDepth += 1;
      continue;
    }
    if (token === "end if") {
      if (conditionalDepth > 0) conditionalDepth -= 1;
      continue;
    }
    if (conditionalDepth === 0 && match.index !== undefined) {
      return value.slice(0, match.index);
    }
  }
  return value;
}

function unquoteSqlLiteral(value: string): string {
  return value.slice(1, -1).replace(/''/g, "'");
}

function stripSimpleSqlCasts(value: string): string {
  let current = value;
  for (let pass = 0; pass < 4; pass += 1) {
    const next = current.replace(
      /((?:\b[a-z][a-z0-9_]*(?:\s*\.\s*[a-z][a-z0-9_]*)*\b)|(?:-?\d+)|(?:true|false|null|unknown)|(?:'(?:''|[^'])*')|\([^()]*\))\s*::\s*(?:(?:pg_catalog|public)\s*\.\s*)?[a-z][a-z0-9_]*(?:\s*\[\s*\])?/giu,
      "$1",
    );
    if (next === current) return current;
    current = next;
  }
  return current;
}

function evaluateConstantBooleanCondition(condition: string): boolean | undefined {
  let normalized = stripSimpleSqlCasts(condition).trim().replace(/\s+/g, " ");
  while (/^\([^()]*\)$/.test(normalized)) {
    normalized = normalized.slice(1, -1).trim();
  }
  if (/^(?:null|unknown)$/i.test(normalized)) return false;
  if (/^false$/i.test(normalized)) return false;
  if (/^true$/i.test(normalized)) return true;
  const notMatch = /^not\s+(.+)$/i.exec(normalized);
  if (notMatch?.[1] !== undefined) {
    const inner = evaluateConstantBooleanCondition(notMatch[1]);
    return inner === undefined ? undefined : !inner;
  }
  const booleanComparison =
    /^(true|false)\s*(=|<>|!=|is\s+(?:not\s+)?distinct\s+from)\s*(true|false)$/i
      .exec(normalized);
  if (booleanComparison !== null) {
    const left = booleanComparison[1]?.toLowerCase() === "true";
    const operator = booleanComparison[2]?.toLowerCase().replace(/\s+/g, " ");
    const right = booleanComparison[3]?.toLowerCase() === "true";
    if (operator === "=" || operator === "is not distinct from") return left === right;
    if (operator === "<>" || operator === "!=" || operator === "is distinct from") {
      return left !== right;
    }
  }
  const numericComparison =
    /^(-?\d+)\s*(=|<>|!=|<=|>=|<|>)\s*(-?\d+)$/i.exec(normalized);
  if (numericComparison !== null) {
    const left = Number.parseInt(numericComparison[1] ?? "", 10);
    const operator = numericComparison[2];
    const right = Number.parseInt(numericComparison[3] ?? "", 10);
    if (Number.isSafeInteger(left) && Number.isSafeInteger(right)) {
      switch (operator) {
        case "=":
          return left === right;
        case "<>":
        case "!=":
          return left !== right;
        case "<":
          return left < right;
        case ">":
          return left > right;
        case "<=":
          return left <= right;
        case ">=":
          return left >= right;
      }
    }
  }
  const stringComparison =
    /^('(?:''|[^'])*')\s*(=|<>|!=|is\s+(?:not\s+)?distinct\s+from)\s*('(?:''|[^'])*')$/i
      .exec(normalized);
  if (stringComparison !== null) {
    const left = unquoteSqlLiteral(stringComparison[1] ?? "");
    const operator = stringComparison[2]?.toLowerCase().replace(/\s+/g, " ");
    const right = unquoteSqlLiteral(stringComparison[3] ?? "");
    if (operator === "=" || operator === "is not distinct from") return left === right;
    if (operator === "<>" || operator === "!=" || operator === "is distinct from") {
      return left !== right;
    }
  }
  const identifierComparison =
    /^([a-z][a-z0-9_]*(?:\s*\.\s*[a-z][a-z0-9_]*)*)\s*(=|<>|!=|is\s+(?:not\s+)?distinct\s+from)\s*\1$/i
      .exec(normalized);
  if (identifierComparison !== null) {
    const operator = identifierComparison[2]?.toLowerCase().replace(/\s+/g, " ");
    if (operator === "=" || operator === "is not distinct from") return true;
    if (operator === "<>" || operator === "!=" || operator === "is distinct from") {
      return false;
    }
  }
  return undefined;
}

function sqlStatementsWithOffsets(
  value: string,
): readonly Readonly<{ statement: string; start: number; end: number }>[] {
  const statements: Array<Readonly<{ statement: string; start: number; end: number }>> = [];
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== ";") continue;
    const statement = value.slice(start, index).trim();
    if (statement.length > 0) statements.push({ statement, start, end: index + 1 });
    start = index + 1;
  }
  const statement = value.slice(start).trim();
  if (statement.length > 0) {
    statements.push({ statement, start, end: value.length });
  }
  return statements;
}

function balancedSqlParenthesizedContent(
  value: string,
  openIndex: number,
): Readonly<{ content: string; end: number }> | undefined {
  if (value[openIndex] !== "(") return undefined;
  let depth = 0;
  let inString = false;
  for (let index = openIndex; index < value.length; index += 1) {
    const character = value[index];
    if (character === "'") {
      if (inString && value[index + 1] === "'") {
        index += 1;
        continue;
      }
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (character === "(") depth += 1;
    if (character === ")") {
      depth -= 1;
      if (depth === 0) {
        return { content: value.slice(openIndex + 1, index), end: index + 1 };
      }
    }
  }
  return undefined;
}

function splitTopLevelSqlCommaList(value: string): readonly string[] {
  const entries: string[] = [];
  let depth = 0;
  let inString = false;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === "'") {
      if (inString && value[index + 1] === "'") {
        index += 1;
        continue;
      }
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (character === "," && depth === 0) {
      entries.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  entries.push(value.slice(start).trim());
  return entries;
}

function followedByFoundRaise(sql: string, endIndex: number): boolean {
  return /^\s*if\s+not\s+found\s+then\b[\s\S]{0,240}\braise\s+exception\b[\s\S]{0,120}\bend\s+if\b/i
    .test(sql.slice(endIndex, endIndex + 420));
}

function followedByFoundAdmissionRejection(
  sql: string,
  endIndex: number,
): boolean {
  return /^\s*if\s+not\s+found\s+then\b[\s\S]{0,4200}\bv_response\s*:=\s*jsonb_build_object\s*\([\s\S]{0,1600}\bexit\s+admission_business\s*;[\s\S]{0,120}\bend\s+if\b/i
    .test(sql.slice(endIndex, endIndex + 6000));
}

function trustedLocalRowValueIdentifiers(
  signature: OwnerFunctionSignatureV1,
  executable: string,
): ReadonlySet<string> {
  const trusted = new Set<string>();
  const allowedTables = new Set([...signature.reads_tables, ...signature.writes_tables]);
  const statementRows = sqlStatementsWithOffsets(executable);
  for (const { statement } of statementRows) {
    if (constantFalseWherePredicate(statement)) continue;
    const match =
      /\bselect\s+((?:[a-z][a-z0-9_]*\s*\.\s*)?[a-z][a-z0-9_]*)\s+into\s+([a-z][a-z0-9_]*)\b[\s\S]*?\bfrom\s+(?:only\s+)?(?:"?([a-z][a-z0-9_]*)"?\s*\.\s*)?"?([a-z][a-z0-9_]*)"?\b/i
        .exec(statement);
    const selected = match?.[1]?.toLowerCase().replace(/\s+/g, "");
    const local = match?.[2]?.toLowerCase();
    const schema = match?.[3] ?? signature.schema;
    const table = match?.[4];
    if (
      selected === undefined ||
      local === undefined ||
      table === undefined ||
      schema !== signature.schema ||
      !allowedTables.has(table) ||
      selected.startsWith("p_") ||
      /^\d/u.test(selected)
    ) {
      continue;
    }
    trusted.add(local);
  }
  return trusted;
}

function constantFalseWherePredicate(statement: string): boolean {
  const whereMatch =
    /\bwhere\s+([\s\S]*?)(?=\b(?:for\s+(?:no\s+key\s+)?update|group\s+by|order\s+by|having|limit|offset|returning|union|intersect|except)\b|$)/i
      .exec(statement);
  if (whereMatch?.[1] === undefined) return false;
  const predicate = whereMatch[1].trim();
  if (evaluateConstantBooleanCondition(predicate) === false) return true;
  return predicate
    .split(/\band\b/i)
    .some((clause) => evaluateConstantBooleanCondition(clause) === false);
}

function hasUnboundConstantJoin(statement: string): boolean {
  return /\bjoin\s+(?:"?[a-z][a-z0-9_]*"?\s*\.\s*)?"?[a-z][a-z0-9_]*"?(?:\s+(?:as\s+)?[a-z][a-z0-9_]*)?\s+on\s+(?:true|1\s*=\s*1)\b/i
    .test(statement);
}

function rejectExpectedValueLocalCopy(
  signature: OwnerFunctionSignatureV1,
  localName: string | undefined,
  expression: string | undefined,
): void {
  const local = localName?.toLowerCase();
  if (
    local !== undefined &&
    expression !== undefined &&
    !local.startsWith("p_") &&
    /\bp_expected_[a-z0-9_]+\b/i.test(expression)
  ) {
    throw new Error(
      `PostgreSQL function CAS fence drift: ${signature.schema}.${signature.function_name} derives a local variable from a caller expected value`,
    );
  }
}

function assertNoUnreachableProofScaffolding(
  signature: OwnerFunctionSignatureV1,
  semantic: string,
  executable: string,
): void {
  for (const match of semantic.matchAll(/\bif\s+([\s\S]{1,240}?)\s+then\b/gi)) {
    if (evaluateConstantBooleanCondition(match[1] ?? "") === false) {
      throw new Error(
        `unreachable proof block is forbidden in owner writer: ${signature.schema}.${signature.function_name}`,
      );
    }
  }
  for (const statement of semantic.split(";")) {
    if (
      /\b(?:from|join)\b/i.test(statement) &&
      (constantFalseWherePredicate(statement) ||
        hasUnboundConstantJoin(statement))
    ) {
      throw new Error(
        `unreachable relational proof is forbidden in owner writer: ${signature.schema}.${signature.function_name}`,
      );
    }
  }
  for (const match of executable.matchAll(
    /\b([a-z][a-z0-9_]*)\s*:=\s*([^;]*\bp_expected_[a-z0-9_]+\b[^;]*);/gi,
  )) {
    rejectExpectedValueLocalCopy(signature, match[1], match[2]);
  }
  for (const match of executable.matchAll(
    /\bselect\s+([^;]*\bp_expected_[a-z0-9_]+\b[^;]*?)\s+into\s+([a-z][a-z0-9_]*)\b/gi,
  )) {
    rejectExpectedValueLocalCopy(signature, match[2], match[1]);
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
  if (operation === "cas") {
    // A CAS pointer or lease may legitimately bootstrap an absent row. The
    // expected-value verifier below still requires the caller fence to be
    // compared with an observed owner row before this INSERT can qualify.
    return new Set(["insert", "update", "merge"]);
  }
  return new Set(["update", "merge"]);
}

function concurrencyArgumentNames(
  signature: OwnerFunctionSignatureV1,
  control: OwnerFunctionEffectV1["concurrency_control"],
  operation: OwnerFunctionEffectV1["operation"],
  effect?: OwnerFunctionEffectV1,
): readonly string[] {
  const names = signature.arguments.map(({ argument_name }) => argument_name);
  if (control === "durable_event_identity") {
    return [
      names.includes("p_source_event") ? "p_source_event" : "p_event",
      "p_idempotency_key",
      "p_payload_hash",
      "p_semantic_hash",
      "p_scope_fingerprint",
    ];
  }
  if (control === "reconciliation_fence") {
    return reconciliationFenceArgumentNames(operation);
  }
  if (control === "promotion_reservation_fence") {
    return [];
  }
  if (control === "slot_and_process_state_fence") {
    return names.filter(
      (name) =>
        name === "p_admission_precondition" || name === "p_admission_request",
    );
  }
  if (control === "catalog_baseline_fence") {
    return names.filter((name) =>
      [
        "p_workspace_id",
        "p_bot_id",
        "p_deployment_environment",
        "p_release_channel",
        "p_baseline_catalog_version",
      ].includes(name),
    );
  }
  if (control === "database_row_lock") {
    return names.filter(
      (name) =>
        name !== "p_trace_id" &&
        (name === "p_process_id" || /^p_[a-z0-9_]+_(?:id|key)$/u.test(name)),
    );
  }
  if (control === "advisory_identity_lock") {
    if (
      effect?.advisory_lock?.identity_source ===
      "claimed_outbox_aggregate_id"
    ) {
      return names.filter((name) =>
        ["p_worker_id", "p_limit", "p_lease_seconds", "p_now"].includes(name),
      );
    }
    const required = effect?.advisory_lock?.identity_arguments ?? [
      "p_runtime_run_id",
    ];
    return names.filter((name) => required.includes(name));
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
  if (
    effect.concurrency_control === "promotion_reservation_fence"
  ) {
    const targets = effect.promotion_reservation_targets ?? [];
    const reservationTable =
      `(?:"?memory"?\\s*\\.\\s*)?"?memory_promotion_reservations"?`;
    const targetTable =
      `(?:"?memory"?\\s*\\.\\s*)?"?memory_promotion_reservation_targets"?`;
    const statements = sqlStatementsWithOffsets(semantic);
    const writtenTablePattern = signature.writes_tables
      .map(
        (table) =>
          `(?:"?${escapeRegularExpression(signature.schema)}"?\\s*\\.\\s*)?"?${escapeRegularExpression(table)}"?`,
      )
      .join("|");
    const mutationOffset = statements.find(
      ({ statement }) =>
        new RegExp(
          `\\b(?:insert\\s+into|update|merge\\s+into)\\s+(?:only\\s+)?(?:${writtenTablePattern})\\b`,
          "iu",
        ).test(statement),
    )?.start;
    const fenceStatements = statements.filter(
      ({ statement, start }) =>
        new RegExp(
          `\\b(?:from|join)\\s+(?:only\\s+)?${reservationTable}\\b`,
          "iu",
        ).test(statement) &&
        new RegExp(
          `\\b(?:from|join)\\s+(?:only\\s+)?${targetTable}\\b`,
          "iu",
        ).test(statement) &&
        /\bfor\s+(?:no\s+key\s+)?update\b/iu.test(statement) &&
        /\bstatus\b\s*=\s*'active'/iu.test(statement) &&
        (/\bexpires_at\b\s*>\s*(?:(?:pg_catalog\s*\.\s*)?(?:clock_timestamp|statement_timestamp|now)\s*\(\s*\)|current_timestamp)/iu
          .test(statement) ||
          /(?:(?:pg_catalog\s*\.\s*)?(?:clock_timestamp|statement_timestamp|now)\s*\(\s*\)|current_timestamp)\s*<\s*\bexpires_at\b/iu
            .test(statement)) &&
        /\b(?:[a-z][a-z0-9_]*\s*\.\s*)?id\b\s*=\s*(?:[a-z][a-z0-9_]*\s*\.\s*)?reservation_id\b|\b(?:[a-z][a-z0-9_]*\s*\.\s*)?reservation_id\b\s*=\s*(?:[a-z][a-z0-9_]*\s*\.\s*)?id\b/iu
          .test(statement) &&
        (mutationOffset === undefined || start < mutationOffset),
    );
    const bindingIsChecked = (
      target: NonNullable<
        OwnerFunctionEffectV1["promotion_reservation_targets"]
      >[number],
    ): boolean =>
      fenceStatements.some(({ statement }) => {
        const aggregateTypeValue =
          "aggregate_type" in target
            ? `'${escapeRegularExpression(target.aggregate_type)}'`
            : `\\b${escapeRegularExpression(
                target.aggregate_type_argument,
              )}\\b`;
        const typeBinding =
          new RegExp(
            `\\baggregate_type\\b\\s*=\\s*${aggregateTypeValue}|${aggregateTypeValue}\\s*=\\s*\\baggregate_type\\b`,
            "iu",
          ).test(statement);
        const idArgument = `\\b${escapeRegularExpression(
          target.id_argument,
        )}\\b`;
        const idValue =
          "id_json_key" in target &&
          target.id_json_key !== undefined
            ? `${idArgument}\\s*->>\\s*'${escapeRegularExpression(
                target.id_json_key,
              )}'`
            : idArgument;
        const idBinding = new RegExp(
          `\\baggregate_id\\b\\s*=\\s*${idValue}|${idValue}\\s*=\\s*\\baggregate_id\\b`,
          "iu",
        ).test(statement);
        return typeBinding && idBinding;
      });
    const reservedError = /\braise\s+exception\b[\s\S]{0,500}?'promotion_reserved'|\braise\s+exception\s+'promotion_reserved'/iu
      .exec(semantic);
    if (
      signature.schema !== "memory" ||
      !signature.reads_tables.includes(
        "memory_promotion_reservations",
      ) ||
      !signature.reads_tables.includes(
        "memory_promotion_reservation_targets",
      ) ||
      targets.length === 0 ||
      fenceStatements.length === 0 ||
      !targets.every(bindingIsChecked) ||
      reservedError === null ||
      (mutationOffset !== undefined &&
        reservedError.index > mutationOffset)
    ) {
      throw new Error(
        `PostgreSQL function promotion reservation fence drift: ${signature.schema}.${signature.function_name}`,
      );
    }
    return;
  }
  if (effect.concurrency_control === "advisory_identity_lock") {
    const metadata = effect.advisory_lock;
    if (metadata?.identity_source === "claimed_outbox_aggregate_id") {
      const aggregateLock = new RegExp(
        `\\bperform\\s+pg_catalog\\s*\\.\\s*pg_advisory_xact_lock\\s*\\(\\s*pg_catalog\\s*\\.\\s*hashtextextended\\s*\\(\\s*'${escapeRegularExpression(
          metadata.key_prefix,
        )}'\\s*::\\s*pg_catalog\\s*\\.\\s*text\\s*\\|\\|\\s*v_candidate\\s*\\.\\s*aggregate_id\\s*::\\s*pg_catalog\\s*\\.\\s*text\\s*,\\s*0\\s*\\)\\s*\\)\\s*;`,
        "iu",
      ).exec(semantic);
      const qualifiedPrimaryOutbox =
        `(?:"?${escapeRegularExpression(signature.schema)}"?\\s*\\.\\s*)?"?${escapeRegularExpression(signature.primary_table)}"?`;
      const lockedCandidateLoop = new RegExp(
        `\\bfor\\s+v_candidate\\s+in\\s+select\\b[\\s\\S]{0,5000}?\\bfrom\\s+(?:only\\s+)?${qualifiedPrimaryOutbox}\\b[\\s\\S]{0,3500}?\\bfor\\s+(?:no\\s+key\\s+)?update\\s+skip\\s+locked\\b[\\s\\S]{0,1200}?\\blimit\\s+least\\s*\\(\\s*greatest\\s*\\(\\s*p_limit\\b[\\s\\S]{0,1200}?\\bloop\\b`,
        "iu",
      ).exec(semantic);
      const qualifiedEffectTable =
        `(?:"?${escapeRegularExpression(signature.schema)}"?\\s*\\.\\s*)?"?${escapeRegularExpression(effect.table_name)}"?`;
      const companionMutation = new RegExp(
        `\\bupdate\\s+(?:only\\s+)?${qualifiedEffectTable}\\b`,
        "iu",
      ).exec(semantic);
      if (
        aggregateLock === null ||
        lockedCandidateLoop === null ||
        companionMutation === null ||
        aggregateLock.index <= lockedCandidateLoop.index ||
        aggregateLock.index > companionMutation.index
      ) {
        throw new Error(
          `PostgreSQL function derived advisory identity lock drift: ${signature.schema}.${signature.function_name} must lock the claimed outbox aggregate before the companion state transition`,
        );
      }
      return;
    }
    const lockPatternFor = (
      lockMetadata: NonNullable<OwnerFunctionEffectV1["advisory_lock"]>,
    ): RegExp => {
      const keyPattern = [
        `'${escapeRegularExpression(
          lockMetadata.key_prefix,
        )}'\\s*::\\s*pg_catalog\\s*\\.\\s*text`,
        ...lockMetadata.identity_arguments.flatMap((argument, index) => [
          `\\b${escapeRegularExpression(
            argument,
          )}\\b\\s*::\\s*pg_catalog\\s*\\.\\s*text`,
          ...(index < lockMetadata.identity_arguments.length - 1
            ? [
                `'${escapeRegularExpression(
                  lockMetadata.separator,
                )}'\\s*::\\s*pg_catalog\\s*\\.\\s*text`,
              ]
            : []),
        ]),
      ].join("\\s*\\|\\|\\s*");
      return new RegExp(
        `\\bperform\\s+pg_catalog\\s*\\.\\s*pg_advisory_xact_lock\\s*\\(\\s*pg_catalog\\s*\\.\\s*hashtextextended\\s*\\(\\s*${keyPattern}\\s*,\\s*0\\s*\\)\\s*\\)\\s*;`,
        "iu",
      );
    };
    const lockPattern =
      metadata === undefined
        ? new RegExp(
            `\\bperform\\s+pg_catalog\\s*\\.\\s*pg_advisory_xact_lock\\s*\\(\\s*pg_catalog\\s*\\.\\s*hashtextextended\\s*\\(\\s*'${escapeRegularExpression(
              `${signature.schema}:`,
            )}'(?:\\s*::\\s*pg_catalog\\s*\\.\\s*text)?\\s*\\|\\|\\s*p_runtime_run_id\\s*,\\s*0\\s*\\)\\s*\\)\\s*;`,
            "iu",
          )
        : lockPatternFor(metadata);
    const lock = lockPattern.exec(semantic);
    const orderedExplicitLocks = signature.effects
      .filter(
        (
          candidate,
        ): candidate is OwnerFunctionEffectV1 & {
          readonly advisory_lock: NonNullable<
            OwnerFunctionEffectV1["advisory_lock"]
          >;
        } =>
          candidate.concurrency_control === "advisory_identity_lock" &&
          candidate.advisory_lock !== undefined,
      )
      .sort(
        (left, right) =>
          left.advisory_lock.order - right.advisory_lock.order,
      );
    const orderedLockOffsets = orderedExplicitLocks.map(
      ({ advisory_lock }) =>
        lockPatternFor(advisory_lock).exec(semantic)?.index,
    );
    const lockOrderDrift =
      orderedLockOffsets.some((offset) => offset === undefined) ||
      orderedLockOffsets.some(
        (offset, index) =>
          index > 0 &&
          offset !== undefined &&
          orderedLockOffsets[index - 1] !== undefined &&
          offset <= (orderedLockOffsets[index - 1] as number),
      );
    const ownerTables = [...new Set([
      ...signature.reads_tables,
      ...signature.writes_tables,
    ])]
      .map(
        (table) =>
          `(?:"?${escapeRegularExpression(signature.schema)}"?\\s*\\.\\s*)?"?${escapeRegularExpression(table)}"?`,
      )
      .join("|");
    const firstTableAccess = new RegExp(
      `\\b(?:from|join|update|insert\\s+into|merge\\s+into)\\s+(?:only\\s+)?(?:${ownerTables})\\b`,
      "iu",
    ).exec(semantic);
    const firstOwnerRoutineAccess = new RegExp(
      `\\b"?${escapeRegularExpression(signature.schema)}"?\\s*\\.\\s*"?[a-z][a-z0-9_]*"?\\s*\\(`,
      "iu",
    ).exec(semantic);
    const firstFactAccessIndex = Math.min(
      firstTableAccess?.index ?? Number.POSITIVE_INFINITY,
      firstOwnerRoutineAccess?.index ?? Number.POSITIVE_INFINITY,
    );
    const lockPrefix = lock === null ? "" : semantic.slice(0, lock.index);
    const beginOffset = lockPrefix.search(/\bbegin\b/iu);
    const executablePrefix =
      beginOffset < 0 ? lockPrefix : lockPrefix.slice(beginOffset + "begin".length);
    const controlFlowBeforeLock =
      lock === null
        ? true
        : /\b(?:if|case|loop|while|for)\b/iu.test(executablePrefix) ||
          [...executablePrefix.matchAll(/\bbegin\b/giu)].length !== 0;
    if (
      lock === null ||
      lockOrderDrift ||
      controlFlowBeforeLock ||
      lock.index > firstFactAccessIndex
    ) {
      throw new Error(
        `PostgreSQL function advisory identity lock drift: ${signature.schema}.${signature.function_name} must take the contract-pinned transaction lock before owner fact access`,
      );
    }
    return;
  }
  const candidates = concurrencyArgumentNames(
    signature,
    effect.concurrency_control,
    effect.operation,
  );
  const consumed = candidates.filter((name) =>
    new RegExp(`\\b${escapeRegularExpression(name)}\\b`, "i").test(executable),
  );
  if (consumed.length === 0) {
    throw new Error(
      `PostgreSQL function fence drift: ${signature.schema}.${signature.function_name} does not consume ${effect.concurrency_control}`,
    );
  }
  if (effect.concurrency_control === "database_row_lock") {
    const lockTable = effect.lock_table_name ?? effect.table_name;
    const qualifiedLockTable = `(?:"?${escapeRegularExpression(signature.schema)}"?\\s*\\.\\s*)?"?${escapeRegularExpression(lockTable)}"?`;
    const qualifiedEffectTable = `(?:"?${escapeRegularExpression(signature.schema)}"?\\s*\\.\\s*)?"?${escapeRegularExpression(effect.table_name)}"?`;
    const identity = consumed
      .map((name) => escapeRegularExpression(name))
      .join("|");
    const lockPattern = new RegExp(
      `\\bselect\\b[\\s\\S]{0,4000}?\\bfrom\\s+(?:only\\s+)?${qualifiedLockTable}\\b[\\s\\S]{0,2500}?\\b(?:${identity})\\b[\\s\\S]{0,1500}?\\bfor\\s+(?:no\\s+key\\s+)?update\\b`,
      "iu",
    );
    const lockMatch = lockPattern.exec(semantic);
    const mutationPattern = new RegExp(
      `\\b(?:insert\\s+into|update|merge\\s+into)\\s+${qualifiedEffectTable}\\b`,
      "iu",
    );
    const mutationMatch = mutationPattern.exec(semantic);
    if (
      lockMatch === null ||
      (mutationMatch !== null && lockMatch.index > mutationMatch.index)
    ) {
      throw new Error(
        `PostgreSQL function row-lock drift: ${signature.schema}.${signature.function_name} must lock ${lockTable} before mutation`,
      );
    }
  }
  if (effect.claim_locking === "for_update_skip_locked") {
    const qualifiedEffectTable =
      `(?:"?${escapeRegularExpression(signature.schema)}"?\\s*\\.\\s*)?"?${escapeRegularExpression(effect.table_name)}"?`;
    const claimFence = effect.claim_fence;
    const candidateLockPattern = new RegExp(
      `\\bselect\\b[\\s\\S]{0,5000}?\\bfrom\\s+(?:only\\s+)?${qualifiedEffectTable}\\b[\\s\\S]{0,3500}?\\bfor\\s+(?:no\\s+key\\s+)?update\\s+skip\\s+locked\\b[\\s\\S]{0,1200}?\\blimit\\s+p_limit\\b`,
      "iu",
    );
    const candidateLock = candidateLockPattern.exec(semantic);
    const mutation = new RegExp(
      `\\bupdate\\s+(?:only\\s+)?${qualifiedEffectTable}\\b(?:\\s+(?:as\\s+)?(?!set\\b)"?([a-z][a-z0-9_]*)"?\\b)?`,
      "iu",
    ).exec(semantic);
    if (
      claimFence === undefined ||
      candidateLock === null ||
      mutation === null ||
      candidateLock.index > mutation.index
    ) {
      throw new Error(
        `PostgreSQL function skip-locked claim drift: ${signature.schema}.${signature.function_name} must lock a p_limit-bounded ${effect.table_name} candidate set with FOR UPDATE SKIP LOCKED before mutation`,
      );
    }
    const columnReference = (column: string): string =>
      `(?:\\b[a-z][a-z0-9_]*\\s*\\.\\s*)?\\b${escapeRegularExpression(column)}\\b`;
    const directDatabaseClock =
      `(?:(?:pg_catalog\\s*\\.\\s*)?(?:clock_timestamp|statement_timestamp|now)\\s*\\(\\s*\\)|current_timestamp)`;
    const capturedDatabaseClock = semantic.match(
      /\b(v_[a-z][a-z0-9_]*)\s+(?:timestamp\s+with\s+time\s+zone|timestamptz)\s*:=\s*(?:(?:(?:pg_catalog\s*\.\s*)?(?:clock_timestamp|statement_timestamp|now)\s*\(\s*\)|current_timestamp)|(?:pg_catalog\s*\.\s*)?date_trunc\s*\(\s*'milliseconds'\s*,\s*(?:(?:pg_catalog\s*\.\s*)?(?:clock_timestamp|statement_timestamp|now)\s*\(\s*\)|current_timestamp)\s*\))/iu,
    )?.[1];
    const databaseClock = capturedDatabaseClock === undefined
      ? directDatabaseClock
      : `(?:${directDatabaseClock}|\\b${escapeRegularExpression(capturedDatabaseClock)}\\b)`;
    const candidateSql = candidateLock[0];
    const identity = columnReference(claimFence.identity_column);
    const status = columnReference(claimFence.status_column);
    const lease = columnReference(claimFence.lease_expires_at_column);
    const selectsIdentity = new RegExp(
      `\\bselect\\b[\\s\\S]{0,1200}?${identity}[\\s\\S]{0,1200}?\\bfrom\\b`,
      "iu",
    ).test(candidateSql);
    const eligibleStatus = new RegExp(
      `${status}\\s*=\\s*'${escapeRegularExpression(claimFence.eligible_status)}'`,
      "iu",
    ).test(candidateSql);
    const leaseIsNull = `${lease}\\s+is\\s+null`;
    const leaseIsExpired =
      `(?:${lease}\\s*<=\\s*${databaseClock}|${databaseClock}\\s*>=\\s*${lease})`;
    const expiredLeaseIsEligible =
      new RegExp(
        `\\(?\\s*${leaseIsNull}\\s+or\\s+${leaseIsExpired}\\s*\\)?`,
        "iu",
      ).test(candidateSql) ||
      new RegExp(
        `\\(?\\s*${leaseIsExpired}\\s+or\\s+${leaseIsNull}\\s*\\)?`,
        "iu",
      ).test(candidateSql);
    const claimOrder = claimFence.order_by_columns
      .map((column) => {
        const reference = columnReference(column);
        return column === claimFence.lease_expires_at_column
          ? `${reference}(?:\\s+asc)?\\s+nulls\\s+first`
          : `${reference}(?:\\s+asc)?`;
      })
      .join("\\s*,\\s*");
    const deterministicOrder = new RegExp(
      `\\border\\s+by\\s+${claimOrder}\\s+for\\s+(?:no\\s+key\\s+)?update\\s+skip\\s+locked\\b`,
      "iu",
    ).test(candidateSql);
    const candidatePrefix = semantic.slice(
      Math.max(0, candidateLock.index - 600),
      candidateLock.index,
    );
    const candidateCteName =
      /(?:\bwith\b|,)\s*"?([a-z][a-z0-9_]*)"?\s+as(?:\s+(?:not\s+)?materialized)?\s*\(\s*$/iu
        .exec(candidatePrefix)?.[1];
    const mutationEnd = semantic.indexOf(";", mutation.index);
    const mutationSql = semantic.slice(
      mutation.index,
      mutationEnd < 0
        ? Math.min(semantic.length, mutation.index + 6000)
        : mutationEnd,
    );
    const targetAlias = mutation[1] ?? effect.table_name;
    const candidateBound =
      candidateCteName !== undefined &&
      new RegExp(
        `\\bfrom\\s+"?${escapeRegularExpression(candidateCteName)}"?\\b`,
        "iu",
      ).test(mutationSql) &&
      new RegExp(
        `(?:"?${escapeRegularExpression(targetAlias)}"?\\s*\\.\\s*)"?${escapeRegularExpression(claimFence.identity_column)}"?\\s*=\\s*"?${escapeRegularExpression(candidateCteName)}"?\\s*\\.\\s*"?${escapeRegularExpression(claimFence.identity_column)}"?|"?${escapeRegularExpression(candidateCteName)}"?\\s*\\.\\s*"?${escapeRegularExpression(claimFence.identity_column)}"?\\s*=\\s*(?:"?${escapeRegularExpression(targetAlias)}"?\\s*\\.\\s*)"?${escapeRegularExpression(claimFence.identity_column)}"?`,
        "iu",
      ).test(mutationSql);
    const workerAssigned = new RegExp(
      `\\b${escapeRegularExpression(claimFence.worker_column)}\\b\\s*=\\s*p_worker_id\\b`,
      "iu",
    ).test(mutationSql);
    const generationReference =
      `(?:"?${escapeRegularExpression(targetAlias)}"?\\s*\\.\\s*)?\\b${escapeRegularExpression(claimFence.generation_column)}\\b`;
    const generationAdvanced = new RegExp(
      `\\b${escapeRegularExpression(claimFence.generation_column)}\\b\\s*=\\s*${generationReference}\\s*\\+\\s*1\\b`,
      "iu",
    ).test(mutationSql);
    const intervalFromLeaseSeconds =
      `(?:(?:pg_catalog\\s*\\.\\s*)?make_interval\\s*\\(\\s*secs\\s*=>\\s*p_lease_seconds\\s*\\)|p_lease_seconds\\s*\\*\\s*interval\\s*'1\\s+second'|interval\\s*'1\\s+second'\\s*\\*\\s*p_lease_seconds)`;
    const databaseLeaseAssigned = new RegExp(
      `\\b${escapeRegularExpression(claimFence.lease_expires_at_column)}\\b\\s*=\\s*${databaseClock}\\s*\\+\\s*${intervalFromLeaseSeconds}`,
      "iu",
    ).test(mutationSql);
    const claimAuthority = effect.claim_authority;
    let claimAuthorityBound = claimAuthority === undefined;
    if (claimAuthority !== undefined) {
      const qualifiedOwnerTable =
        `(?:"?${escapeRegularExpression(signature.schema)}"?\\s*\\.\\s*)?"?${escapeRegularExpression(claimAuthority.owner_table_name)}"?`;
      const qualifiedLeaseTable =
        `(?:"?${escapeRegularExpression(signature.schema)}"?\\s*\\.\\s*)?"?${escapeRegularExpression(claimAuthority.lease_table_name)}"?`;
      const ownerIdentity = columnReference(
        claimAuthority.owner_identity_column,
      );
      const claimedOwnerIdentity = columnReference(
        claimAuthority.claimed_owner_identity_column,
      );
      const leaseOwnerIdentity = columnReference(
        claimAuthority.lease_owner_identity_column,
      );
      const leaseGeneration = columnReference(
        claimAuthority.lease_generation_column,
      );
      const originatingLeaseGeneration = columnReference(
        claimAuthority.originating_lease_generation_column,
      );
      const leaseState = columnReference(
        claimAuthority.lease_state_column,
      );
      const activeLeaseExpiry = columnReference(
        claimAuthority.lease_expires_at_column,
      );
      const equality = (left: string, right: string) =>
        new RegExp(
          `(?:${left}\\s*=\\s*${right}|${right}\\s*=\\s*${left})`,
          "iu",
        ).test(candidateSql);
      claimAuthorityBound =
        new RegExp(
          `\\bjoin\\s+(?:only\\s+)?${qualifiedOwnerTable}\\b`,
          "iu",
        ).test(candidateSql) &&
        equality(ownerIdentity, claimedOwnerIdentity) &&
        new RegExp(
          `\\bnot\\s+exists\\s*\\([\\s\\S]{0,2500}?\\bfrom\\s+(?:only\\s+)?${qualifiedLeaseTable}\\b[\\s\\S]{0,2500}?\\)`,
          "iu",
        ).test(candidateSql) &&
        equality(leaseOwnerIdentity, claimedOwnerIdentity) &&
        equality(leaseGeneration, originatingLeaseGeneration) &&
        new RegExp(
          `${leaseState}\\s*=\\s*'${escapeRegularExpression(claimAuthority.active_lease_state)}'`,
          "iu",
        ).test(candidateSql) &&
        new RegExp(
          `(?:${activeLeaseExpiry}\\s*>\\s*${databaseClock}|${databaseClock}\\s*<\\s*${activeLeaseExpiry})`,
          "iu",
        ).test(candidateSql);
    }
    if (
      !selectsIdentity ||
      !eligibleStatus ||
      !expiredLeaseIsEligible ||
      !deterministicOrder ||
      !candidateBound ||
      !workerAssigned ||
      !generationAdvanced ||
      !databaseLeaseAssigned ||
      !claimAuthorityBound
    ) {
      throw new Error(
        `PostgreSQL function claim fence drift: ${signature.schema}.${signature.function_name} must claim only eligible expired rows, bind the locked candidate identity, set the worker and a DB-clock lease, and server-increment the claim generation`,
      );
    }
  }
  if (effect.concurrency_control === "catalog_baseline_fence") {
    const qualifiedCurrent =
      `(?:"?${escapeRegularExpression(signature.schema)}"?\\s*\\.\\s*)?"?skill_catalog_current"?`;
    const qualifiedRevisions =
      `(?:"?${escapeRegularExpression(signature.schema)}"?\\s*\\.\\s*)?"?skill_catalog_revisions"?`;
    const statementRows = sqlStatementsWithOffsets(semantic);
    const catalogReadIndex = statementRows.findIndex(({ statement }) =>
      new RegExp(
        `\\bfrom\\s+${qualifiedCurrent}\\b[\\s\\S]{0,3000}?\\bjoin\\s+${qualifiedRevisions}\\b`,
        "iu",
      ).test(statement),
    );
    const catalogRead = statementRows[catalogReadIndex]?.statement ?? "";
    const qualifiedEffectTable =
      `(?:"?${escapeRegularExpression(signature.schema)}"?\\s*\\.\\s*)?"?${escapeRegularExpression(effect.table_name)}"?`;
    const mutationIndex = statementRows.findIndex(({ statement }) =>
      new RegExp(
        `\\b(?:insert\\s+into|update|merge\\s+into)\\s+(?:only\\s+)?${qualifiedEffectTable}\\b`,
        "iu",
      ).test(statement),
    );
    const scopeBound = [
      ["workspace_id", "p_workspace_id"],
      ["bot_id", "p_bot_id"],
      ["deployment_environment", "p_deployment_environment"],
      ["release_channel", "p_release_channel"],
    ].every(([column, argument]) => {
      const columnPattern =
        `(?:\\b[a-z][a-z0-9_]*\\s*\\.\\s*)?\\b${column}\\b`;
      const argumentPattern = `\\b${argument}\\b`;
      const equality = "(?:=|is\\s+not\\s+distinct\\s+from)";
      return (
        new RegExp(
          `${columnPattern}\\s*${equality}\\s*${argumentPattern}`,
          "iu",
        ).test(catalogRead) ||
        new RegExp(
          `${argumentPattern}\\s*${equality}\\s*${columnPattern}`,
          "iu",
        ).test(catalogRead)
      );
    });
    const revisionJoinBound =
      /(?:\bcc\s*\.\s*)?\bcatalog_revision_id\b\s*=\s*(?:\bcr\s*\.\s*)?\bid\b/iu
        .test(catalogRead) ||
      /(?:\bcr\s*\.\s*)?\bid\b\s*=\s*(?:\bcc\s*\.\s*)?\bcatalog_revision_id\b/iu
        .test(catalogRead);
    const selectedCatalogVersion = /\bselect\b[\s\S]{0,1500}?\bcatalog_version\b[\s\S]{0,1000}?\binto\s+(v_[a-z][a-z0-9_]*)\b/iu
      .exec(catalogRead)?.[1];
    const mismatchPattern =
      selectedCatalogVersion === undefined
        ? undefined
        : new RegExp(
            `\\bif\\s+(?:${escapeRegularExpression(selectedCatalogVersion)}\\s*(?:<>|!=|is\\s+distinct\\s+from)\\s*p_baseline_catalog_version|p_baseline_catalog_version\\s*(?:<>|!=|is\\s+distinct\\s+from)\\s*${escapeRegularExpression(selectedCatalogVersion)})\\s+then\\b[\\s\\S]{0,800}?\\braise\\s+exception\\b`,
            "iu",
          );
    const mismatchGuardIndex =
      mismatchPattern === undefined
        ? -1
        : statementRows.findIndex(({ statement }) =>
            mismatchPattern.test(statement),
          );
    if (
      consumed.length !== candidates.length ||
      !signature.reads_tables.includes("skill_catalog_current") ||
      !signature.reads_tables.includes("skill_catalog_revisions") ||
      catalogReadIndex < 0 ||
      (mutationIndex >= 0 && catalogReadIndex > mutationIndex) ||
      !/\bfor\s+(?:no\s+key\s+)?update\b/iu.test(catalogRead) ||
      !scopeBound ||
      !revisionJoinBound ||
      mismatchGuardIndex < 0 ||
      (mutationIndex >= 0 && mismatchGuardIndex > mutationIndex)
    ) {
      throw new Error(
        `PostgreSQL function catalog baseline fence drift: ${signature.schema}.${signature.function_name}`,
      );
    }
  }
  if (effect.concurrency_control === "reconciliation_fence") {
    const compare = (
      argument: string,
      column: string,
      nullSafe = false,
      allowLocal = false,
    ): boolean => {
      const argumentPattern = `\\b${escapeRegularExpression(argument)}\\b`;
      const columnPattern = `(?:\\b[a-z][a-z0-9_]*\\.)?\\b${allowLocal ? "(?:v_)?" : ""}${escapeRegularExpression(column)}\\b`;
      const operator = nullSafe
        ? "is\\s+not\\s+distinct\\s+from"
        : "(?:=|<>|is\\s+(?:not\\s+)?distinct\\s+from)";
      return (
        new RegExp(`${columnPattern}\\s*${operator}\\s*${argumentPattern}`, "i")
          .test(executable) ||
        new RegExp(`${argumentPattern}\\s*${operator}\\s*${columnPattern}`, "i")
          .test(executable)
      );
    };
    const statementRows = sqlStatementsWithOffsets(semantic);
    const qualifiedReconciliationTable = (tableName: string): string =>
      `(?:"?${escapeRegularExpression(signature.schema)}"?\\s*\\.\\s*)?"?${escapeRegularExpression(tableName)}"?`;
    const transportAuthorityLockIndex = statementRows.findIndex(
      ({ statement }) =>
        new RegExp(
          `\\b(?:from|join)\\s+(?:only\\s+)?"?${escapeRegularExpression(signature.schema)}"?\\s*\\.\\s*"?${OWNER_EVENTING_TRANSPORT_EPOCH_TABLE_V1}"?\\b`,
          "i",
        ).test(statement) &&
        /\bfor\s+(?:no\s+key\s+)?update\b/iu.test(statement),
    );
    const transportAuthorityLocked =
      transportAuthorityLockIndex >= 0 ||
      new RegExp(
        `\\b(?:from|join)\\s+(?:only\\s+)?"?${escapeRegularExpression(signature.schema)}"?\\s*\\.\\s*"?${OWNER_EVENTING_TRANSPORT_EPOCH_TABLE_V1}"?\\b[\\s\\S]{0,500}?\\bfor\\s+(?:no\\s+key\\s+)?update\\b`,
        "iu",
      ).test(semantic);
    const activeEpochArgument =
      effect.operation === "reconcile_mark_missing"
        ? "p_observed_transport_epoch"
        : "p_current_transport_epoch";
    const activeGenerationArgument =
      effect.operation === "reconcile_mark_missing"
        ? "p_observed_transport_generation"
        : "p_current_transport_generation";
    const databaseClockVariable = semantic.match(
      /\b(v_[a-z][a-z0-9_]*(?:now|clock)[a-z0-9_]*)\s*:=\s*(?:pg_catalog\s*\.\s*)?clock_timestamp\s*\(\s*\)/iu,
    )?.[1];
    const databaseClockPattern =
      databaseClockVariable === undefined
        ? undefined
        : escapeRegularExpression(databaseClockVariable);
    const databaseClockStatementIndex = statementRows.findIndex(
      ({ statement }) =>
        /\bv_[a-z][a-z0-9_]*(?:now|clock)[a-z0-9_]*\s*:=\s*(?:pg_catalog\s*\.\s*)?clock_timestamp\s*\(\s*\)/iu.test(
          statement,
        ),
    );
    const databaseClockCapturedAfterAuthorityLock =
      databaseClockStatementIndex > transportAuthorityLockIndex;
    const reconciliationAckUpdatedIdVariable = executable.match(
      new RegExp(
        `\\bupdate\\s+"?${escapeRegularExpression(signature.schema)}"?\\s*\\.\\s*"?${escapeRegularExpression(effect.table_name)}"?\\b[\\s\\S]{1,3000}?\\breturning\\s+(?:(?:[a-z][a-z0-9_]*)\\s*\\.\\s*)?id\\s+into\\s+(v_[a-z][a-z0-9_]*)\\s*;`,
        "iu",
      ),
    )?.[1];
    let operationFenceValid =
      consumed.length === candidates.length &&
      signature.reads_tables.includes(OWNER_EVENTING_TRANSPORT_EPOCH_TABLE_V1) &&
      transportAuthorityLocked &&
      compare(activeEpochArgument, "active_epoch", false, true) &&
      compare(activeGenerationArgument, "active_generation", false, true);

    if (effect.operation === "reconcile_mark_missing") {
      operationFenceValid =
        consumed.length === candidates.length &&
        signature.reads_tables.includes(OWNER_EVENTING_TRANSPORT_EPOCH_TABLE_V1) &&
        transportAuthorityLocked &&
        compare("p_observed_transport_epoch", "active_epoch", false, true) &&
        compare("p_observed_transport_generation", "active_generation", false, true) &&
        /\b(?:(?:pg_catalog)\s*\.\s*)?jsonb_typeof\s*\(\s*p_transport_refs\s*\)\s*(?:<>|!=|is\s+distinct\s+from)\s*'array'/iu.test(
          semantic,
        ) &&
        /\b(?:(?:pg_catalog)\s*\.\s*)?jsonb_array_length\s*\(\s*p_transport_refs\s*\)\s*>\s*16\b/iu.test(
          executable,
        ) &&
        /\braise\s+exception\b/iu.test(executable) &&
        compare("p_observed_transport_epoch", "transport_epoch") &&
        compare("p_observed_transport_generation", "transport_generation") &&
        /\breconciliation_next_probe_at\b[\s\S]{0,240}?\b(?:least|case)\b/iu.test(
          executable,
        ) &&
        /\bp_observed_at\b/iu.test(executable);
    } else if (effect.operation === "reconcile_claim") {
      operationFenceValid =
        operationFenceValid &&
        databaseClockPattern !== undefined &&
        databaseClockCapturedAfterAuthorityLock &&
        /\bfor\s+(?:no\s+key\s+)?update\s+skip\s+locked\b/iu.test(
          executable,
        ) &&
        /\breconciliation_locked_until\s+is\s+null\b/iu.test(executable) &&
        new RegExp(
          `\\breconciliation_locked_until\\s*<=\\s*\\b${databaseClockPattern}\\b`,
          "iu",
        ).test(executable) &&
        new RegExp(
          `\\breconciliation_locked_until\\s*=\\s*\\b${databaseClockPattern}\\b[\\s\\S]{0,160}?\\bp_lease_seconds\\b`,
          "iu",
        ).test(executable) &&
        new RegExp(
          `\\bupdated_at\\s*=\\s*\\b${databaseClockPattern}\\b`,
          "iu",
        ).test(executable) &&
        /\bp_lease_seconds\s*<\s*1\b/iu.test(executable) &&
        /\bp_lease_seconds\s*>\s*3600\b/iu.test(executable) &&
        /\bp_limit\s*<\s*1\b/iu.test(executable) &&
        /\bp_limit\s*>\s*16\b/iu.test(executable) &&
        /\braise\s+exception\b/iu.test(executable) &&
        /\btransport_epoch\s+is\s+distinct\s+from\s+p_current_transport_epoch\b/iu.test(
          executable,
        ) &&
        /\btransport_generation\s+is\s+distinct\s+from\s+p_current_transport_generation\b/iu.test(
          executable,
        ) &&
        /\breconciliation_missing_at\s+is\s+not\s+null\b/iu.test(executable) &&
        /\breconciliation_next_probe_at\s+is\s+null\b/iu.test(executable) &&
        new RegExp(
          `\\breconciliation_next_probe_at\\s*<=\\s*\\b${databaseClockPattern}\\b`,
          "iu",
        ).test(executable);
	    } else if (
	      effect.operation === "reconcile_ack_present" ||
	      effect.operation === "reconcile_ack_rematerialized"
	    ) {
	      operationFenceValid =
	        operationFenceValid &&
	        databaseClockPattern !== undefined &&
        databaseClockCapturedAfterAuthorityLock &&
        compare("p_outbox_id", "id") &&
        compare("p_claim_token", "reconciliation_claim_token") &&
        compare("p_previous_transport_ref", "transport_ref", true) &&
        compare("p_previous_transport_epoch", "transport_epoch", true) &&
        compare(
          "p_previous_transport_generation",
          "transport_generation",
          true,
        ) &&
        new RegExp(
          `\\breconciliation_next_probe_at\\s*=\\s*\\b${databaseClockPattern}\\b[\\s\\S]{0,200}?\\bp_probe_interval_ms\\b`,
          "iu",
        ).test(executable) &&
        new RegExp(
          `\\bupdated_at\\s*=\\s*\\b${databaseClockPattern}\\b`,
          "iu",
        ).test(executable) &&
        /\bp_probe_interval_ms\s*<\s*1000\b/iu.test(executable) &&
        /\bp_probe_interval_ms\s*>\s*86400000\b/iu.test(executable) &&
        reconciliationAckUpdatedIdVariable !== undefined &&
        new RegExp(
          `\\bif\\s+${escapeRegularExpression(reconciliationAckUpdatedIdVariable)}\\s+is\\s+null\\s+then\\s+raise\\s+exception\\b`,
          "iu",
        ).test(executable);
      if (effect.operation === "reconcile_ack_rematerialized") {
        operationFenceValid =
          operationFenceValid &&
	          compare("p_transport_epoch", "active_epoch", false, true) &&
	          compare("p_transport_generation", "active_generation", false, true);
	      }
	    } else if (effect.operation === "reconcile_ack_permanent_failure") {
	      const permanentFailureDlqTable = signature.effects.find(
	        (candidate) =>
	          candidate.table_name !== effect.table_name &&
	          candidate.operation === "append" &&
	          candidate.table_name.endsWith("_dlq"),
	      )?.table_name;
	      operationFenceValid =
	        operationFenceValid &&
	        compare("p_outbox_id", "id") &&
	        compare("p_claim_token", "reconciliation_claim_token") &&
	        compare("p_previous_transport_ref", "transport_ref", true) &&
	        compare("p_previous_transport_epoch", "transport_epoch", true) &&
	        compare(
	          "p_previous_transport_generation",
	          "transport_generation",
	          true,
	        ) &&
        typeof permanentFailureDlqTable === "string" &&
        new RegExp(
          `\\binsert\\s+into\\s+${qualifiedReconciliationTable(permanentFailureDlqTable)}\\b`,
          "iu",
        ).test(semantic) &&
        new RegExp(
          `\\bupdate\\s+${qualifiedReconciliationTable(effect.table_name)}\\b[\\s\\S]{1,2400}?\\bstatus\\s*=\\s*'failed'`,
          "iu",
        ).test(semantic) &&
	        /\breconciliation_claim_token\s*=\s*null\b/iu.test(executable) &&
	        /\breconciliation_locked_until\s*=\s*null\b/iu.test(executable) &&
	        /\bp_failure_code\b/iu.test(executable) &&
	        /\bp_failure_message\b/iu.test(executable) &&
	        /\bp_now\b/iu.test(executable);
	    }
    if (!operationFenceValid) {
      throw new Error(
        `PostgreSQL function reconciliation fence drift: ${signature.schema}.${signature.function_name}`,
      );
    }
  }
  if (effect.concurrency_control === "durable_event_identity") {
    const eventArgument = signature.arguments.some(
      ({ argument_name }) => argument_name === "p_source_event",
    )
      ? "p_source_event"
      : "p_event";
    const usesSnapshotAppendResponse =
      signature.schema === "trigger_processor" &&
      new Set([
        "record_runtime_started_v1",
        "enter_trigger_cooldown_v1",
        "finalize_trigger_runtime_terminal_v1",
        "apply_runtime_control_handled_v1",
        "append_trigger_snapshot_v1",
      ]).has(signature.function_name);
    const statementRows = sqlStatementsWithOffsets(executable);
    const semanticStatementRows = sqlStatementsWithOffsets(semantic);
    const statementHead = (statement: string): string =>
      statement.replace(/^\s*begin\b/iu, "").trimStart();
    const matchingEndIfIndex = (startIndex: number): number => {
      let depth = 0;
      for (let index = startIndex; index < semanticStatementRows.length; index += 1) {
        const statement = statementHead(
          semanticStatementRows[index]?.statement ?? "",
        ).replace(/'(?:''|[^'])*'/gu, "''");
        for (const match of statement.matchAll(/\bend\s+if\b|\bif\b/giu)) {
          const token = match[0].toLowerCase().replace(/\s+/gu, " ");
          if (token === "if") {
            depth += 1;
          } else {
            depth -= 1;
            if (depth === 0) return index;
          }
        }
      }
      return -1;
    };
    const mismatchCompares = (
      statement: string,
      column: string,
      argument: string,
    ): boolean => {
      const qualifiedColumn = `(?:\\b[a-z][a-z0-9_]*\\.)?\\b${escapeRegularExpression(column)}\\b`;
      const qualifiedArgument = `\\b${escapeRegularExpression(argument)}\\b`;
      const operator = "(?:<>|!=|is\\s+distinct\\s+from)";
      return (
        new RegExp(`${qualifiedColumn}\\s*${operator}\\s*${qualifiedArgument}`, "iu").test(statement) ||
        new RegExp(`${qualifiedArgument}\\s*${operator}\\s*${qualifiedColumn}`, "iu").test(statement)
      );
    };
    const qualifiedTable = (tableName: string): string =>
      `(?:"?${escapeRegularExpression(signature.schema)}"?\\s*\\.\\s*)?"?${escapeRegularExpression(tableName)}"?`;
    const mutatesEffectTable = (
      statement: string,
      tableName: string,
      operation: OwnerFunctionEffectV1["operation"],
    ): boolean =>
      mutationPattern(
        signature.schema,
        tableName,
        [...allowedMutationVerbs(operation)],
      ).test(statement);
    const inboxInsertIndex = statementRows.findIndex(({ statement }) =>
      new RegExp(
        `\\binsert\\s+into\\s+${qualifiedTable(effect.table_name)}[\\s\\S]{1,2400}?\\bon\\s+conflict(?:\\s*\\(\\s*"?source"?\\s*,\\s*"?event_id"?\\s*\\))?\\s+do\\s+nothing\\b`,
        "iu",
      ).test(statement),
    );
    const inboxInsertStatement =
      semanticStatementRows[inboxInsertIndex]?.statement ?? "";
    const insertTarget = new RegExp(
      `\\binsert\\s+into\\s+${qualifiedTable(effect.table_name)}\\s*\\(`,
      "iu",
    ).exec(inboxInsertStatement);
    const insertColumnsOpen =
      insertTarget === null
        ? -1
        : (insertTarget.index ?? 0) + insertTarget[0].lastIndexOf("(");
    const insertColumns =
      insertColumnsOpen < 0
        ? undefined
        : balancedSqlParenthesizedContent(
            inboxInsertStatement,
            insertColumnsOpen,
          );
    const valuesKeyword =
      insertColumns === undefined
        ? undefined
        : /\bvalues\s*\(/iu.exec(inboxInsertStatement.slice(insertColumns.end));
    const insertValuesOpen =
      insertColumns === undefined ||
      valuesKeyword === undefined ||
      valuesKeyword === null
        ? -1
        : insertColumns.end +
          (valuesKeyword.index ?? 0) +
          valuesKeyword[0].lastIndexOf("(");
    const insertValues =
      insertValuesOpen < 0
        ? undefined
        : balancedSqlParenthesizedContent(inboxInsertStatement, insertValuesOpen);
    const columns =
      insertColumns === undefined
        ? []
        : splitTopLevelSqlCommaList(insertColumns.content).map((column) =>
            column.trim().replace(/^"|"$/gu, "").toLowerCase(),
          );
    const values =
      insertValues === undefined
        ? []
        : splitTopLevelSqlCommaList(insertValues.content);
    const valueForColumn = (column: string): string | undefined => {
      const index = columns.indexOf(column);
      return index < 0 ? undefined : values[index];
    };
    const eventFieldValue = (field: "producer" | "event_id"): RegExp =>
      new RegExp(
        `^\\(?\\s*${escapeRegularExpression(eventArgument)}\\s*->>\\s*'${field}'\\s*\\)?(?:\\s*::\\s*(?:pg_catalog\\s*\\.\\s*)?text)?$`,
        "iu",
      );
    const argumentValue = (argument: string): RegExp =>
      new RegExp(
        `^\\(?\\s*${escapeRegularExpression(argument)}\\s*\\)?(?:\\s*::\\s*(?:pg_catalog\\s*\\.\\s*)?text)?$`,
        "iu",
      );
    const insertValuesAreCanonical =
      columns.length === values.length &&
      eventFieldValue("producer").test(valueForColumn("source") ?? "") &&
      eventFieldValue("event_id").test(valueForColumn("event_id") ?? "") &&
      argumentValue("p_idempotency_key").test(
        valueForColumn("idempotency_key") ?? "",
      ) &&
      argumentValue("p_payload_hash").test(
        valueForColumn("payload_hash") ?? "",
      ) &&
      argumentValue("p_semantic_hash").test(
        valueForColumn("semantic_hash") ?? "",
      ) &&
      argumentValue("p_scope_fingerprint").test(
        valueForColumn("scope_fingerprint") ?? "",
      );
    const insertedIdentityVariable = inboxInsertStatement.match(
      /\breturning\s+(?:(?:[a-z][a-z0-9_]*)\s*\.\s*)?(?:id|event_id)\s+into\s+(v_[a-z][a-z0-9_]*|inserted_[a-z][a-z0-9_]*)\b/iu,
    )?.[1];
    const freshIfIndex =
      insertedIdentityVariable === undefined
        ? -1
        : semanticStatementRows.findIndex(({ statement }, index) =>
            index > inboxInsertIndex &&
            new RegExp(
              `^if\\s+${escapeRegularExpression(insertedIdentityVariable)}\\s+is\\s+not\\s+null\\s+then\\b`,
              "iu",
            ).test(statementHead(statement)),
          );
    const freshEndIfIndex =
      freshIfIndex < 0 ? -1 : matchingEndIfIndex(freshIfIndex);
    const eventFieldComparison = (
      statement: string,
      column: "source" | "event_id",
      field: "producer" | "event_id",
    ): boolean => {
      const columnPattern = `(?:\\b[a-z][a-z0-9_]*\\.)?\\b${column}\\b`;
      const fieldPattern = `\\b${escapeRegularExpression(eventArgument)}\\s*->>\\s*'${field}'(?:\\s*::\\s*(?:pg_catalog\\s*\\.\\s*)?text)?`;
      return (
        new RegExp(`${columnPattern}\\s*=\\s*${fieldPattern}`, "iu").test(
          statement,
        ) ||
        new RegExp(`${fieldPattern}\\s*=\\s*${columnPattern}`, "iu").test(
          statement,
        )
      );
    };
    const deliveryIdentityLockIndex = semanticStatementRows.findIndex(
      ({ statement }) =>
        new RegExp(
          `\\bfrom\\s+${qualifiedTable(effect.table_name)}[\\s\\S]{1,1600}?\\bfor\\s+(?:no\\s+key\\s+)?update\\b`,
          "iu",
        ).test(statement) &&
        eventFieldComparison(statement, "source", "producer") &&
        eventFieldComparison(statement, "event_id", "event_id"),
    );
    const quarantineTable = signature.effects.find(
      ({ table_name, operation }) =>
        table_name !== effect.table_name && operation === "append" &&
        table_name.endsWith("_dlq"),
    )?.table_name;
    const conflictIfIndex = semanticStatementRows.findIndex(
      ({ statement }, index) => {
        const head = statementHead(statement);
        if (index <= deliveryIdentityLockIndex || !/^if\b/iu.test(head)) {
          return false;
        }
        const predicate = (head.match(/^if\s+([\s\S]*?)\s+then\b/iu)?.[1] ?? "")
          .trim();
        const terms = splitCheckDisjunction(
          stripBalancedOuterParentheses(predicate),
        );
        const expected = [
          ["event_id", `${eventArgument}->>'event_id'`],
          ["idempotency_key", "p_idempotency_key"],
          ["payload_hash", "p_payload_hash"],
          ["semantic_hash", "p_semantic_hash"],
          ["scope_fingerprint", "p_scope_fingerprint"],
        ] as const;
        return (
          terms.length === expected.length &&
          terms.every((term) => !/\b(?:and|or)\b/iu.test(term)) &&
          expected.every(([column, argument]) => {
            if (column !== "event_id") {
              return terms.filter((term) =>
                mismatchCompares(term, column, argument)).length === 1;
            }
            const eventField = `\\b${escapeRegularExpression(eventArgument)}\\s*->>\\s*'event_id'`;
            const qualifiedColumn =
              `(?:\\b[a-z][a-z0-9_]*\\.)?\\bevent_id\\b`;
            const mismatch = "(?:<>|!=|is\\s+distinct\\s+from)";
            return terms.filter((term) =>
              new RegExp(
                `(?:${qualifiedColumn}\\s*${mismatch}\\s*${eventField}|${eventField}\\s*${mismatch}\\s*${qualifiedColumn})`,
                "iu",
              ).test(term)).length === 1;
          })
        );
      },
    );
    const conflictEndIfIndex =
      conflictIfIndex < 0 ? -1 : matchingEndIfIndex(conflictIfIndex);
    const quarantineIndex =
      quarantineTable === undefined || conflictIfIndex < 0 || conflictEndIfIndex < 0
        ? -1
        : statementRows.findIndex(
            ({ statement }, index) =>
              index >= conflictIfIndex &&
              index < conflictEndIfIndex &&
              mutatesEffectTable(statement, quarantineTable, "append"),
          );
    const conflictReturnIndex = semanticStatementRows.findIndex(
      ({ statement }, index) =>
        index > quarantineIndex &&
        index < conflictEndIfIndex &&
        /\breturn\s+jsonb_build_object\s*\(\s*'status'(?:\s*::\s*(?:pg_catalog\s*\.\s*)?text)?\s*,\s*'isolated'(?:\s*::\s*(?:pg_catalog\s*\.\s*)?text)?\s*,\s*'isolation_code'(?:\s*::\s*(?:pg_catalog\s*\.\s*)?text)?\s*,\s*'durable_inbox_identity_conflict'(?:\s*::\s*(?:pg_catalog\s*\.\s*)?text)?\s*,\s*'isolation_ref'(?:\s*::\s*(?:pg_catalog\s*\.\s*)?text)?\s*,/iu.test(
          statement,
        ),
    );
    const quarantineStatement =
      quarantineIndex < 0
        ? ""
        : (semanticStatementRows[quarantineIndex]?.statement ?? "");
    const quarantineInsertTarget =
      quarantineTable === undefined
        ? null
        : new RegExp(
            `\\binsert\\s+into\\s+${qualifiedTable(quarantineTable)}\\s*\\(`,
            "iu",
          ).exec(quarantineStatement);
    const quarantineColumnsOpen =
      quarantineInsertTarget === null
        ? -1
        : (quarantineInsertTarget.index ?? 0) +
          quarantineInsertTarget[0].lastIndexOf("(");
    const quarantineColumns =
      quarantineColumnsOpen < 0
        ? undefined
        : balancedSqlParenthesizedContent(
            quarantineStatement,
            quarantineColumnsOpen,
          );
    const quarantineValuesKeyword =
      quarantineColumns === undefined
        ? null
        : /\bvalues\s*\(/iu.exec(
            quarantineStatement.slice(quarantineColumns.end),
          );
    const quarantineValuesOpen =
      quarantineColumns === undefined || quarantineValuesKeyword === null
        ? -1
        : quarantineColumns.end +
          (quarantineValuesKeyword.index ?? 0) +
          quarantineValuesKeyword[0].lastIndexOf("(");
    const quarantineValues =
      quarantineValuesOpen < 0
        ? undefined
        : balancedSqlParenthesizedContent(
            quarantineStatement,
            quarantineValuesOpen,
          );
    const quarantineColumnNames =
      quarantineColumns === undefined
        ? []
        : splitTopLevelSqlCommaList(quarantineColumns.content).map((column) =>
            column.trim().replace(/^"|"$/gu, "").toLowerCase(),
          );
    const quarantineValueExpressions =
      quarantineValues === undefined
        ? []
        : splitTopLevelSqlCommaList(quarantineValues.content);
    const quarantineIdIndex = quarantineColumnNames.indexOf("id");
    const quarantineIdExpression =
      quarantineIdIndex < 0
        ? undefined
        : quarantineValueExpressions[quarantineIdIndex];
    const quarantineIdVariable =
      quarantineIdExpression?.trim().match(
        /^"?([a-z][a-z0-9_]*)"?$/iu,
      )?.[1];
    const quarantineIdAssignment =
      quarantineIdVariable === undefined
        ? undefined
        : [...semanticStatementRows]
            .slice(
              Math.max(conflictIfIndex, 0),
              Math.max(quarantineIndex, 0),
            )
            .reverse()
            .map(({ statement }) =>
              new RegExp(
                `\\b${escapeRegularExpression(quarantineIdVariable)}\\s*:=\\s*([\\s\\S]+?)\\s*;?\\s*$`,
                "iu",
              ).exec(statement),
            )
            .find((match) => match !== null)?.[1];
    const resolvedQuarantineIdExpression =
      quarantineIdAssignment ?? quarantineIdExpression ?? "";
    const quarantineIdBindsDeliveryAndConflictFingerprints =
      new RegExp(
        `\\b${escapeRegularExpression(eventArgument)}\\s*->>\\s*'producer'`,
        "iu",
      ).test(resolvedQuarantineIdExpression) &&
      new RegExp(
        `\\b${escapeRegularExpression(eventArgument)}\\s*->>\\s*'event_id'`,
        "iu",
      ).test(resolvedQuarantineIdExpression) &&
      [
        "p_idempotency_key",
        "p_payload_hash",
        "p_semantic_hash",
        "p_scope_fingerprint",
      ].every((argument) =>
        new RegExp(`\\b${argument}\\b`, "iu").test(
          resolvedQuarantineIdExpression,
        ),
      );
    const quarantineInsertIsIdempotent =
      /\bon\s+conflict\s*\(\s*"?id"?\s*\)\s*do\s+nothing\b/iu.test(
        quarantineStatement,
      );
    const conflictReturnStatement =
      conflictReturnIndex < 0
        ? ""
        : (semanticStatementRows[conflictReturnIndex]?.statement ?? "");
    const returnCall = /\breturn\s+jsonb_build_object\s*\(/iu.exec(
      conflictReturnStatement,
    );
    const returnArguments =
      returnCall === null
        ? undefined
        : balancedSqlParenthesizedContent(
            conflictReturnStatement,
            (returnCall.index ?? 0) + returnCall[0].lastIndexOf("("),
          );
    const isolatedReturnArguments =
      returnArguments === undefined
        ? []
        : splitTopLevelSqlCommaList(returnArguments.content);
    const normalizedSqlExpression = (expression: string): string =>
      expression.replace(/\s+/gu, "").replace(/^\((.*)\)$/u, "$1");
    const expectedIsolationRefExpression =
      quarantineTable === undefined || quarantineIdExpression === undefined
        ? undefined
        : `'${signature.schema}.${quarantineTable}/'||${normalizedSqlExpression(quarantineIdExpression)}`;
    const isolatedReturnIsExact =
      isolatedReturnArguments.length === 6 &&
      normalizedSqlExpression(isolatedReturnArguments[0] ?? "") === "'status'" &&
      normalizedSqlExpression(isolatedReturnArguments[1] ?? "") === "'isolated'" &&
      normalizedSqlExpression(isolatedReturnArguments[2] ?? "") ===
        "'isolation_code'" &&
      normalizedSqlExpression(isolatedReturnArguments[3] ?? "") ===
        "'durable_inbox_identity_conflict'" &&
      normalizedSqlExpression(isolatedReturnArguments[4] ?? "") ===
        "'isolation_ref'" &&
      expectedIsolationRefExpression !== undefined &&
      normalizedSqlExpression(isolatedReturnArguments[5] ?? "") ===
        expectedIsolationRefExpression;
    const businessEffects = signature.effects.filter(
      (candidate) =>
        candidate.table_name !== effect.table_name &&
        candidate.table_name !== quarantineTable,
    );
    const businessMutationIndexes = statementRows.flatMap(
      ({ statement }, index) =>
        businessEffects.some((candidate) =>
          mutatesEffectTable(statement, candidate.table_name, candidate.operation),
        )
          ? [index]
          : [],
    );
    const sourceGapIfIndex = usesSnapshotAppendResponse
      ? semanticStatementRows.findIndex(({ statement }, index) =>
          index < inboxInsertIndex &&
          /^if\s+v_source_sequence\s*>\s*v_previous_source_sequence\s*\+\s*1\s+then\b/iu
            .test(statementHead(statement)),
        )
      : -1;
    const sourceGapEndIfIndex = sourceGapIfIndex < 0
      ? -1
      : matchingEndIfIndex(sourceGapIfIndex);
    const sourceGapBranch = sourceGapIfIndex < 0 || sourceGapEndIfIndex < 0
      ? ""
      : semanticStatementRows
          .slice(sourceGapIfIndex, sourceGapEndIfIndex + 1)
          .map(({ statement }) => statement)
          .join(";\n");
    const hasExactPreInboxSourceGapBranch =
      usesSnapshotAppendResponse &&
      sourceGapIfIndex >= 0 &&
      sourceGapEndIfIndex > sourceGapIfIndex &&
      sourceGapEndIfIndex < inboxInsertIndex &&
      /\bselect\s+\*\s+into\s+v_existing_pending\s+from\s+trigger_processor\.trigger_snapshot_pending_events\b[\s\S]{1,2400}?\bfor\s+update\b/iu
        .test(sourceGapBranch) &&
      /\binsert\s+into\s+trigger_processor\.trigger_snapshot_pending_events\s+as\s+pending\s*\([\s\S]{1,2400}?'pending'[\s\S]{1,1200}?v_now\s*\+\s*interval\s*'15 seconds'[\s\S]{1,1800}?\)/iu
        .test(sourceGapBranch) &&
      /\binsert\s+into\s+trigger_processor\.trigger_snapshot_append_audits\s*\([\s\S]{1,2400}?'pending_gap'[\s\S]{1,1000}?'expected_source_sequence_no'\s*,\s*v_previous_source_sequence\s*\+\s*1[\s\S]{1,1000}?'event_gap_timeout_ms'\s*,\s*15000/iu
        .test(sourceGapBranch) &&
      /\breturn\s+jsonb_build_object\s*\([\s\S]{1,1800}?'code'\s*,\s*'snapshot_pending_gap'[\s\S]{1,1800}?'duplicate_replayed'\s*,\s*false/iu
        .test(sourceGapBranch) &&
      !new RegExp(
        `\\b(?:insert\\s+into|update|merge\\s+into)\\s+${qualifiedTable(effect.table_name)}\\b`,
        "iu",
      ).test(sourceGapBranch);
    const exactPreInboxSourceGapMutationIndexes = hasExactPreInboxSourceGapBranch
      ? businessMutationIndexes.filter((index) => {
          if (index <= sourceGapIfIndex || index >= sourceGapEndIfIndex) {
            return false;
          }
          const statement = semanticStatementRows[index]?.statement ?? "";
          return (
            /\binsert\s+into\s+trigger_processor\.trigger_snapshot_pending_events\s+as\s+pending\s*\(/iu
              .test(statement) &&
            /'pending'/iu.test(statement) &&
            /v_now\s*\+\s*interval\s*'15 seconds'/iu.test(statement)
          ) || (
            /\binsert\s+into\s+trigger_processor\.trigger_snapshot_append_audits\s*\(/iu
              .test(statement) &&
            /'pending_gap'/iu.test(statement) &&
            /'event_gap_timeout_ms'\s*,\s*15000/iu.test(statement)
          );
        })
      : [];
    const businessMutationsAreFreshOnly =
      freshIfIndex >= 0 &&
      freshEndIfIndex > freshIfIndex &&
      (businessEffects.length === 0
        ? businessMutationIndexes.length === 0
        : businessMutationIndexes.length > 0) &&
      businessMutationIndexes.every(
        (index) =>
          (index >= freshIfIndex && index < freshEndIfIndex) ||
          exactPreInboxSourceGapMutationIndexes.includes(index),
      );
    const isFreshSuccessReturn = (statement: string): boolean =>
      /\breturn\s+jsonb_build_object\s*\(\s*'status'(?:\s*::\s*(?:pg_catalog\s*\.\s*)?text)?\s*,\s*'processed'(?:\s*::\s*(?:pg_catalog\s*\.\s*)?text)?\s*\)/iu.test(
        statement,
      ) ||
      (usesSnapshotAppendResponse &&
        /\breturn\s+jsonb_build_object\s*\([\s\S]*?'code'\s*,\s*'snapshot_appended'[\s\S]*?'duplicate_replayed'\s*,\s*false[\s\S]*?\)/iu.test(
          statement,
        ));
    const processedReturnIndex = semanticStatementRows.findIndex(
      ({ statement }, index) =>
        index >= freshIfIndex &&
        index < freshEndIfIndex &&
        isFreshSuccessReturn(statement),
    );
    const businessMutationsCommitBeforeProcessed =
      processedReturnIndex >= freshIfIndex &&
      businessMutationIndexes.every((index) => index < processedReturnIndex);
    const isReplayReturn = (statement: string): boolean =>
      /\breturn\s+jsonb_build_object\s*\(\s*'status'(?:\s*::\s*(?:pg_catalog\s*\.\s*)?text)?\s*,\s*'replayed'(?:\s*::\s*(?:pg_catalog\s*\.\s*)?text)?\s*\)/iu.test(
        statement,
      ) ||
      (usesSnapshotAppendResponse &&
        /\breturn\s+jsonb_build_object\s*\([\s\S]*?'code'\s*,\s*'snapshot_appended'[\s\S]*?'duplicate_replayed'\s*,\s*true[\s\S]*?\)/iu.test(
          statement,
        ));
    const replayReturnIndex = semanticStatementRows.findIndex(
      ({ statement }, index) =>
        index > conflictEndIfIndex && isReplayReturn(statement),
    );
    const hasExactLateSourceIsolationBranch =
      usesSnapshotAppendResponse &&
      /\b(?:if|elsif)\s+v_source_sequence\s*<=\s*v_previous_source_sequence\s+then\b[\s\S]{1,12000}?\binsert\s+into\s+trigger_processor\.trigger_event_dlq\b[\s\S]{1,3000}?'code'\s*,\s*'late_source_event'[\s\S]{1,5000}?\breturn\s+jsonb_build_object\s*\([\s\S]{1,2000}?'code'\s*,\s*'snapshot_late_event_isolated'/iu
        .test(semantic);
    const isExactLateSourceQuarantine = (
      statement: string,
    ): boolean =>
      hasExactLateSourceIsolationBranch &&
      quarantineTable !== undefined &&
      new RegExp(
        `\\binsert\\s+into\\s+${qualifiedTable(quarantineTable)}\\s*\\(`,
        "iu",
      ).test(statement) &&
      /\bv_quarantine_id\b/iu.test(statement) &&
      /\bp_source_event\s*->>\s*'event_id'/iu.test(statement) &&
      /'code'\s*,\s*'late_source_event'/iu.test(statement) &&
      /'trigger_process_id'\s*,\s*p_process_id/iu.test(statement) &&
      /'source_sequence_no'\s*,\s*v_source_sequence/iu.test(statement) &&
      /'last_contiguous_source_sequence_no'\s*,\s*v_previous_source_sequence/iu
        .test(statement) &&
      /\bon\s+conflict\s*\(\s*"?id"?\s*\)\s+do\s+nothing\b/iu
        .test(statement);
    const quarantineMutationIndexes = quarantineTable === undefined
      ? []
      : statementRows.flatMap(({ statement }, index) =>
          mutatesEffectTable(statement, quarantineTable, "append")
            ? [index]
            : [],
        );
    const exactLateQuarantineIndexes = quarantineMutationIndexes.filter(
      (index) => isExactLateSourceQuarantine(
        semanticStatementRows[index]?.statement ?? "",
      ),
    );
    const conflictQuarantineIndexes = quarantineMutationIndexes.filter(
      (index) => index >= conflictIfIndex && index < conflictEndIfIndex,
    );
    const quarantineMutationsAreConflictOnly =
      quarantineTable !== undefined &&
      quarantineMutationIndexes.every(
        (index) =>
          conflictQuarantineIndexes.includes(index) ||
          exactLateQuarantineIndexes.includes(index),
      );
    const atomicallyQuarantinesConflict =
      conflictIfIndex > deliveryIdentityLockIndex &&
      quarantineIndex >= conflictIfIndex &&
      conflictReturnIndex > quarantineIndex &&
      conflictEndIfIndex > conflictReturnIndex &&
      quarantineMutationsAreConflictOnly &&
      quarantineInsertIsIdempotent &&
      quarantineIdBindsDeliveryAndConflictFingerprints &&
      isolatedReturnIsExact;
    if (
      consumed.length !== candidates.length ||
      inboxInsertIndex < 0 ||
      !insertValuesAreCanonical ||
      insertedIdentityVariable === undefined ||
      freshIfIndex <= inboxInsertIndex ||
      processedReturnIndex < 0 ||
      !businessMutationsAreFreshOnly ||
      !businessMutationsCommitBeforeProcessed ||
      deliveryIdentityLockIndex <= freshEndIfIndex ||
      replayReturnIndex <= conflictEndIfIndex ||
      !atomicallyQuarantinesConflict
    ) {
      const failedChecks = [
        ["arguments", consumed.length === candidates.length],
        ["inbox_insert", inboxInsertIndex >= 0],
        ["canonical_values", insertValuesAreCanonical],
        ["inserted_identity", insertedIdentityVariable !== undefined],
        ["fresh_branch", freshIfIndex > inboxInsertIndex],
        ["processed_return", processedReturnIndex >= 0],
        ["fresh_only", businessMutationsAreFreshOnly],
        ["business_before_return", businessMutationsCommitBeforeProcessed],
        ["identity_lock_after_fresh", deliveryIdentityLockIndex > freshEndIfIndex],
        ["replay_after_conflict", replayReturnIndex > conflictEndIfIndex],
        ["atomic_quarantine", atomicallyQuarantinesConflict],
        ["conflict_after_identity_lock", conflictIfIndex > deliveryIdentityLockIndex],
        ["conflict_quarantine_insert", quarantineIndex >= conflictIfIndex],
        ["conflict_return_after_insert", conflictReturnIndex > quarantineIndex],
        ["conflict_return_in_branch", conflictEndIfIndex > conflictReturnIndex],
        ["quarantine_mutation_scope", quarantineMutationsAreConflictOnly],
        ["quarantine_insert_idempotent", quarantineInsertIsIdempotent],
        ["quarantine_id_binding", quarantineIdBindsDeliveryAndConflictFingerprints],
        ["quarantine_return_exact", isolatedReturnIsExact],
        ["late_source_branch_exact", !usesSnapshotAppendResponse || hasExactLateSourceIsolationBranch],
        ["pre_inbox_source_gap_exact", !usesSnapshotAppendResponse || hasExactPreInboxSourceGapBranch],
        [`quarantine_counts_${quarantineMutationIndexes.length}_${conflictQuarantineIndexes.length}_${exactLateQuarantineIndexes.length}`,
          quarantineMutationsAreConflictOnly],
      ].filter(([, passed]) => !passed).map(([name]) => name).join(",");
      throw new Error(
        `PostgreSQL function durable event identity drift: ${signature.schema}.${signature.function_name} (${failedChecks})`,
      );
    }
  }
  if (effect.concurrency_control === "slot_and_process_state_fence") {
    const statementRows = sqlStatementsWithOffsets(semantic);
    const statements = statementRows.map(({ statement }) => statement);
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
    const joinedSlotAndProcessLock = statementRows.filter(({ statement }) => {
      if (
        !referencesTable(statement, "bot_foreground_slots") ||
        !referencesTable(statement, "trigger_processes") ||
        !/\bfor\s+(?:no\s+key\s+)?update\b/i.test(statement) ||
        !/\bwhere\b/i.test(statement) ||
        constantFalseWherePredicate(statement) ||
        hasUnboundConstantJoin(statement)
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
    const hasAdmissionSlotAdvisoryLock =
      /\bperform\s+pg_catalog\s*\.\s*pg_advisory_xact_lock\s*\(\s*pg_catalog\s*\.\s*hashtextextended\s*\(\s*'trigger_processor:foreground_slot:'\s*::\s*pg_catalog\s*\.\s*text\s*\|\|\s*\(?\s*p_scope\s*->>\s*'bot_id'\s*\)?\s*,\s*0\s*\)\s*\)\s*;/iu
        .test(semantic);
    const optionalExistingSlotLock = joinedSlotAndProcessLock.some(
      ({ statement }) =>
        /\b(?:[a-z][a-z0-9_]*\s*\.\s*)?bot_id\b\s*=\s*p_scope\s*->>\s*'bot_id'|p_scope\s*->>\s*'bot_id'\s*=\s*\b(?:[a-z][a-z0-9_]*\s*\.\s*)?bot_id\b/iu
          .test(statement),
    );
    const splitSlotLocks = statementRows.filter(
      ({ statement }) =>
        referencesTable(statement, "bot_foreground_slots") &&
        /\bfor\s+(?:no\s+key\s+)?update\b/iu.test(statement) &&
        /\b(?:[a-z][a-z0-9_]*\s*\.\s*)?bot_id\b\s*=\s*p_scope\s*->>\s*'bot_id'|p_scope\s*->>\s*'bot_id'\s*=\s*\b(?:[a-z][a-z0-9_]*\s*\.\s*)?bot_id\b/iu
          .test(statement),
    );
    const splitProcessLocks = statementRows.filter(
      ({ statement }) =>
        referencesTable(statement, "trigger_processes") &&
        /\bfor\s+(?:no\s+key\s+)?update\b/iu.test(statement) &&
        /\b(?:[a-z][a-z0-9_]*\s*\.\s*)?id\b\s*=\s*v_active_process_id\b|\bv_active_process_id\b\s*=\s*\b(?:[a-z][a-z0-9_]*\s*\.\s*)?id\b/iu
          .test(statement),
    );
    const followedByImmediateMissingOwnerRaise = (end: number): boolean =>
      /^\s*if\s+not\s+found\s+then\b[\s\S]{0,240}\braise\s+exception\b/iu
        .test(semantic.slice(end, end + 360));
    const locksSlotBeforeOwnerProcess = splitSlotLocks.some((slotLock) =>
      splitProcessLocks.some(
        (processLock) =>
          processLock.start > slotLock.end &&
          followedByImmediateMissingOwnerRaise(processLock.end),
      ),
    );
    const splitSlotPrecedesProcess = splitSlotLocks.some((slotLock) =>
      splitProcessLocks.some((processLock) => processLock.start > slotLock.end),
    );
    const splitProcessHasMissingOwnerGuard = splitProcessLocks.some(
      (processLock) => followedByImmediateMissingOwnerRaise(processLock.end),
    );
    const lockedSlotAndProcess =
      joinedSlotAndProcessLock.some(({ end }) =>
        followedByFoundRaise(semantic, end),
      ) ||
      (hasAdmissionSlotAdvisoryLock &&
        (optionalExistingSlotLock || locksSlotBeforeOwnerProcess));
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
      "process_state_version",
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
            .test(semantic) ||
          new RegExp(`${rowValue}\\s*${comparison}[^;]{0,160}?${jsonValue}`, "i")
            .test(semantic)
        );
      },
    );
    const qualifiedColumn = (alias: string, column: string): string =>
      `\\b"?${escapeRegularExpression(alias)}"?\\s*\\.\\s*"?${escapeRegularExpression(column)}"?\\b`;
    const jsonTextField = (parameter: string, field: string): string =>
      `\\b${escapeRegularExpression(parameter)}\\s*->>\\s*['"]${escapeRegularExpression(field)}['"]`;
    const exactJsonFieldMatch = (
      statement: string,
      alias: string,
      column: string,
      parameter: string,
      field: string,
    ): boolean => {
      const relationValue = qualifiedColumn(alias, column);
      const jsonValue = jsonTextField(parameter, field);
      return (
        new RegExp(`${relationValue}\\s*=\\s*${jsonValue}`, "i").test(statement) ||
        new RegExp(`${jsonValue}\\s*=\\s*${relationValue}`, "i").test(statement)
      );
    };
    const exactColumnMatch = (
      statement: string,
      leftAlias: string,
      leftColumn: string,
      rightAlias: string,
      rightColumn: string,
    ): boolean => {
      const left = qualifiedColumn(leftAlias, leftColumn);
      const right = qualifiedColumn(rightAlias, rightColumn);
      return (
        new RegExp(`${left}\\s*=\\s*${right}`, "i").test(statement) ||
        new RegExp(`${right}\\s*=\\s*${left}`, "i").test(statement)
      );
    };
    const validatesAuthenticationKind = (statement: string): boolean => {
      const authenticationKind = jsonTextField(
        "p_authenticated_context",
        "authentication_kind",
      );
      const principalType = jsonTextField(
        "p_authenticated_context",
        "principal_type",
      );
      type PredicateRange = Readonly<{ start: number; end: number }>;
      const equalityRange = (
        left: string,
        literal: string,
      ): PredicateRange | undefined => {
        const match = new RegExp(
          `${left}\\s*=\\s*['"]${escapeRegularExpression(literal)}['"]`,
          "i",
        ).exec(statement);
        return match?.index === undefined
          ? undefined
          : { start: match.index, end: match.index + match[0].length };
      };
      const exactInRange = (
        left: string,
        expected: readonly string[],
      ): PredicateRange | undefined => {
        const pattern = new RegExp(`${left}\\s+in\\s*\\(([^)]*)\\)`, "gi");
        for (const match of statement.matchAll(pattern)) {
          const actual = [...(match[1] ?? "").matchAll(/['"]([^'"]+)['"]/g)]
            .map((value) => value[1])
            .filter((value): value is string => value !== undefined)
            .sort();
          if (
            actual.length === expected.length &&
            actual.every((value, index) => value === [...expected].sort()[index]) &&
            match.index !== undefined
          ) {
            return { start: match.index, end: match.index + match[0].length };
          }
        }
        return undefined;
      };
      const conjoinedPredicateRange = (
        predicates: readonly (PredicateRange | undefined)[],
      ): PredicateRange | undefined => {
        if (predicates.some((predicate) => predicate === undefined)) {
          return undefined;
        }
        const ordered = (predicates as readonly PredicateRange[])
          .slice()
          .sort((left, right) => left.start - right.start);
        const conjoined = ordered.slice(0, -1).every((predicate, index) => {
          const next = ordered[index + 1];
          if (next === undefined) return false;
          const connector = statement.slice(predicate.end, next.start);
          return /\band\b/i.test(connector) && !/\bor\b/i.test(connector);
        });
        const first = ordered[0];
        const last = ordered.at(-1);
        return conjoined && first !== undefined && last !== undefined
          ? { start: first.start, end: last.end }
          : undefined;
      };
      const allSources = exactInRange("\\bp_source", [
        "chat",
        "notification",
        "timer",
      ]);
      const workloadBranch = conjoinedPredicateRange([
        equalityRange("\\bp_source", "timer"),
        equalityRange(authenticationKind, "pai_workload_jwt"),
        equalityRange(principalType, "service"),
      ]);
      const externalBranch = conjoinedPredicateRange([
        exactInRange("\\bp_source", ["chat", "notification"]),
        equalityRange(authenticationKind, "supabase_ingress"),
        exactInRange(principalType, ["user", "developer", "agent"]),
      ]);
      const authenticationBranchesAreAlternatives = (() => {
        if (workloadBranch === undefined || externalBranch === undefined) {
          return false;
        }
        const [first, second] = [workloadBranch, externalBranch].sort(
          (left, right) => left.start - right.start,
        );
        if (first === undefined || second === undefined) return false;
        return /\bor\b/i.test(statement.slice(first.end, second.start));
      })();
      const permissionScope = jsonTextField(
        "p_authenticated_context",
        "permission_scope",
      );
      const derivesPermissionScope =
        new RegExp(
          `${permissionScope}\\s*=\\s*['"]trigger\\.submit\\.['"]\\s*\\|\\|\\s*p_source`,
          "i",
        ).test(statement) ||
        new RegExp(
          `['"]trigger\\.submit\\.['"]\\s*\\|\\|\\s*p_source\\s*=\\s*${permissionScope}`,
          "i",
        ).test(statement);
      const hasExactBooleanBranchStructure = (): boolean => {
        type BooleanParts = Readonly<{
          terms: readonly string[];
          operators: readonly ("and" | "or")[];
        }>;
        const parentheses = (value: string): readonly PredicateRange[] => {
          const ranges: PredicateRange[] = [];
          const stack: number[] = [];
          let quote: "'" | '"' | undefined;
          for (let index = 0; index < value.length; index += 1) {
            const character = value[index];
            if (quote !== undefined) {
              if (character === quote) {
                if (value[index + 1] === quote) index += 1;
                else quote = undefined;
              }
              continue;
            }
            if (character === "'" || character === '"') quote = character;
            else if (character === "(") stack.push(index);
            else if (character === ")") {
              const start = stack.pop();
              if (start !== undefined) ranges.push({ start, end: index + 1 });
            }
          }
          return ranges;
        };
        const splitTopLevel = (value: string): BooleanParts => {
          const terms: string[] = [];
          const operators: Array<"and" | "or"> = [];
          let depth = 0;
          let start = 0;
          let quote: "'" | '"' | undefined;
          for (let index = 0; index < value.length; index += 1) {
            const character = value[index];
            if (quote !== undefined) {
              if (character === quote) {
                if (value[index + 1] === quote) index += 1;
                else quote = undefined;
              }
              continue;
            }
            if (character === "'" || character === '"') {
              quote = character;
              continue;
            }
            if (character === "(") {
              depth += 1;
              continue;
            }
            if (character === ")") {
              depth -= 1;
              continue;
            }
            if (
              depth !== 0 ||
              (index > 0 && /[a-z0-9_]/i.test(value[index - 1] ?? ""))
            ) {
              continue;
            }
            const operator = /^(and|or)\b/i.exec(value.slice(index))?.[1]
              ?.toLowerCase();
            if (operator !== "and" && operator !== "or") continue;
            terms.push(value.slice(start, index).trim());
            operators.push(operator);
            index += operator.length - 1;
            start = index + 1;
          }
          terms.push(value.slice(start).trim());
          return { terms, operators };
        };
        const unwrap = (value: string): string => {
          let result = value.trim();
          while (result.startsWith("(") && result.endsWith(")")) {
            if (
              !parentheses(result).some(
                (range) => range.start === 0 && range.end === result.length,
              )
            ) {
              break;
            }
            result = result.slice(1, -1).trim();
          }
          return result;
        };
        const canonical = (value: string): string =>
          unwrap(value).replace(/\s+/g, " ").trim().toLowerCase();
        const equality = (left: string, literal: string) =>
          (value: string): boolean =>
            new RegExp(
              `^${left}\\s*=\\s*['"]${escapeRegularExpression(literal)}['"]$`,
              "i",
            ).test(unwrap(value));
        const exactIn = (left: string, expected: readonly string[]) =>
          (value: string): boolean => {
            const match = new RegExp(
              `^${left}\\s+in\\s*\\(([^()]*)\\)$`,
              "i",
            ).exec(unwrap(value));
            if (match?.[1] === undefined) return false;
            const actual = match[1].split(",").map((entry) => {
              const literal = entry.trim();
              return (
                /^'([^']+)'$/.exec(literal)?.[1] ??
                /^"([^"]+)"$/.exec(literal)?.[1]
              );
            });
            const sortedExpected = [...expected].sort();
            return (
              actual.every((entry): entry is string => entry !== undefined) &&
              actual.length === sortedExpected.length &&
              [...actual]
                .sort()
                .every((entry, index) => entry === sortedExpected[index])
            );
          };
        type PredicateMatcher = (value: string) => boolean;
        const findExactGroup = (
          matchers: readonly PredicateMatcher[],
          operator: "and" | "or",
        ): PredicateRange | undefined =>
          [...parentheses(statement)]
            .sort(
              (left, right) =>
                left.end - left.start - (right.end - right.start),
            )
            .find((range) => {
              const parts = splitTopLevel(
                statement.slice(range.start + 1, range.end - 1),
              );
              if (
                parts.terms.length !== matchers.length ||
                parts.operators.length !== matchers.length - 1 ||
                !parts.operators.every((actual) => actual === operator)
              ) {
                return false;
              }
              const unmatched = [...matchers];
              for (const term of parts.terms) {
                const matcherIndex = unmatched.findIndex((matcher) =>
                  matcher(term),
                );
                if (matcherIndex < 0) return false;
                unmatched.splice(matcherIndex, 1);
              }
              return unmatched.length === 0;
            });
        const exactWorkloadBranch = findExactGroup(
          [
            equality("\\bp_source", "timer"),
            equality(authenticationKind, "pai_workload_jwt"),
            equality(principalType, "service"),
          ],
          "and",
        );
        const exactExternalBranch = findExactGroup(
          [
            exactIn("\\bp_source", ["chat", "notification"]),
            equality(authenticationKind, "supabase_ingress"),
            exactIn(principalType, ["user", "developer", "agent"]),
          ],
          "and",
        );
        if (
          exactWorkloadBranch === undefined ||
          exactExternalBranch === undefined
        ) {
          return false;
        }
        const expectedBranches = [exactWorkloadBranch, exactExternalBranch]
          .map((range) => canonical(statement.slice(range.start, range.end)))
          .sort();
        const exactAuthenticationGroup = [...parentheses(statement)]
          .sort(
            (left, right) => left.end - left.start - (right.end - right.start),
          )
          .find((range) => {
            if (
              range.start > exactWorkloadBranch.start ||
              range.start > exactExternalBranch.start ||
              range.end < exactWorkloadBranch.end ||
              range.end < exactExternalBranch.end
            ) {
              return false;
            }
            const parts = splitTopLevel(
              statement.slice(range.start + 1, range.end - 1),
            );
            return (
              parts.operators.length === 1 &&
              parts.operators[0] === "or" &&
              parts.terms.length === 2 &&
              parts.terms
                .map(canonical)
                .sort()
                .every((term, index) => term === expectedBranches[index])
            );
          });
        if (exactAuthenticationGroup === undefined) return false;
        const root = splitTopLevel(
          unwrap(statement.replace(/^\s*where\b/i, "")),
        );
        const exactGroupAtRoot = root.terms.some(
          (term) =>
            canonical(term) ===
            canonical(
              statement.slice(
                exactAuthenticationGroup.start,
                exactAuthenticationGroup.end,
              ),
            ),
        );
        return (
          exactGroupAtRoot &&
          root.operators.every((operator) => operator === "and") &&
          [...statement.matchAll(/\bor\b/gi)].length === 1
        );
      };
      const exactBooleanBranchStructure = hasExactBooleanBranchStructure();
      return (
        allSources !== undefined &&
        authenticationBranchesAreAlternatives &&
        derivesPermissionScope &&
        exactBooleanBranchStructure &&
        workloadBranch !== undefined &&
        externalBranch !== undefined
      );
    };
    const foundCheckedAuthProof = statementRows.some(({ statement, end }) => {
      const whereIndex = statement.search(/\bwhere\b/i);
      const authorityPredicate =
        whereIndex < 0 ? "" : statement.slice(whereIndex);
      if (
        !referencesTable(statement, "bots") ||
        !referencesTable(statement, "bot_permission_bindings") ||
        !/\bwhere\b/i.test(statement) ||
        constantFalseWherePredicate(statement) ||
        hasUnboundConstantJoin(statement) ||
        (!followedByFoundRaise(semantic, end) &&
          !followedByFoundAdmissionRejection(semantic, end)) ||
        !validatesAuthenticationKind(authorityPredicate)
      ) {
        return false;
      }
      return aliasesForTable(statement, "bots").some((botAlias) =>
        aliasesForTable(statement, "bot_permission_bindings").some(
          (bindingAlias) => {
            const bindingStatus = qualifiedColumn(bindingAlias, "status");
            return (
              [
                ["workspace_id", "workspace_id"],
                ["id", "bot_id"],
                ["owner_agent_id", "owner_agent_id"],
                ["deployment_environment", "deployment_environment"],
                ["release_channel", "release_channel"],
              ].every(([column, field]) =>
                exactJsonFieldMatch(
                  statement,
                  botAlias,
                  column as string,
                  "p_scope",
                  field as string,
                ),
              ) &&
              [
                ["workspace_id", "workspace_id"],
                ["bot_id", "id"],
                ["deployment_environment", "deployment_environment"],
                ["release_channel", "release_channel"],
              ].every(([bindingColumn, botColumn]) =>
                exactColumnMatch(
                  statement,
                  bindingAlias,
                  bindingColumn as string,
                  botAlias,
                  botColumn as string,
                ),
              ) &&
              ["principal_type", "principal_id", "permission_scope"].every(
                (field) =>
                  exactJsonFieldMatch(
                    statement,
                    bindingAlias,
                    field,
                    "p_authenticated_context",
                    field,
                  ),
              ) &&
              (new RegExp(`${bindingStatus}\\s*=\\s*['"]active['"]`, "i")
                .test(statement) ||
                new RegExp(`['"]active['"]\\s*=\\s*${bindingStatus}`, "i")
                  .test(statement))
            );
          },
        ),
      );
    });
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
      ["is_catch_up", "explicit_interrupt"].every((field) =>
        new RegExp(
          `\\bp_admission_request\\s*(?:->>|#>>?)\\s*(?:array\\s*\\[\\s*)?['"]${field}['"]`,
          "i",
        ).test(semantic),
      ) &&
      foundCheckedAuthProof &&
      !/\bjoin\s+(?:"?[a-z][a-z0-9_]*"?\s*\.\s*)?"?bot_permission_bindings"?\s+(?:as\s+)?[a-z][a-z0-9_]*\s+on\s+(?:true|1\s*=\s*1)\b/i
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
      const failedChecks = [
        ["slot_process_lock", lockedSlotAndProcess],
        ["advisory_lock", hasAdmissionSlotAdvisoryLock],
        ["joined_lock", optionalExistingSlotLock],
        ["split_slot_lock", splitSlotLocks.length > 0],
        ["split_process_lock", splitProcessLocks.length > 0],
        ["split_lock_order", splitSlotPrecedesProcess],
        ["split_owner_guard", splitProcessHasMissingOwnerGuard],
        ["slot_before_process", locksSlotBeforeOwnerProcess],
        ["preconditions", usesCallerPrecondition
          ? comparesEveryPreconditionField
          : recomputesServerSide],
      ].filter(([, passed]) => !passed).map(([name]) => name).join(",");
      throw new Error(
        `PostgreSQL function slot/process fence drift: ${signature.schema}.${signature.function_name} (${failedChecks})`,
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
    const trustedLocalRows = trustedLocalRowValueIdentifiers(
      signature,
      executable,
    );
    const compared = (name: string): boolean => {
      const escaped = escapeRegularExpression(name);
      const comparison = "(?:=|<>|is\\s+(?:not\\s+)?distinct\\s+from)";
      const identifier = '"?[a-z][a-z0-9_]*"?';
      const rowJsonValue =
        `\\(?\\s*${identifier}\\s*\\.\\s*${identifier}` +
        `(?:\\s*(?:->|->>|#>|#>>)\\s*(?:''|array\\s*\\[[^\\]]+\\]))+` +
        `\\s*\\)?(?:\\s*::\\s*${identifier})?`;
      if (
        new RegExp(
          `(?:${rowJsonValue})\\s*${comparison}\\s*\\b${escaped}\\b|` +
            `\\b${escaped}\\b\\s*${comparison}\\s*(?:${rowJsonValue})`,
          "iu",
        ).test(executable)
      ) {
        return true;
      }
      const rowValue = `((?:${identifier}\\s*\\.\\s*)?${identifier})`;
      const matches = [
        ...executable.matchAll(
          new RegExp(`\\b${escaped}\\b\\s*${comparison}\\s*${rowValue}`, "gi"),
        ),
        ...executable.matchAll(
          new RegExp(`${rowValue}\\s*${comparison}\\s*\\b${escaped}\\b`, "gi"),
        ),
      ];
      return matches.some((match) => {
        const observedIdentifier = match[1]
          ?.toLowerCase()
          .replace(/["\s]/gu, "");
        if (observedIdentifier === undefined) return false;
        const column = observedIdentifier.split(".").at(-1);
        const matchText = match[0].toLowerCase();
        const matchedIdentifier = match[1]?.toLowerCase() ?? "";
        const identifierOffset = matchText.lastIndexOf(matchedIdentifier);
        const identifierEnd =
          identifierOffset < 0 || match.index === undefined
            ? -1
            : match.index + identifierOffset + matchedIdentifier.length;
        const identifierIsFunctionCall =
          identifierEnd >= 0 && /^\s*\(/u.test(executable.slice(identifierEnd));
        return (
          observedIdentifier !== undefined &&
          column !== undefined &&
          observedIdentifier !== name &&
          (observedIdentifier.includes(".") ||
            trustedLocalRows.has(observedIdentifier)) &&
          !identifierIsFunctionCall &&
          !argumentNames.has(observedIdentifier) &&
          !argumentNames.has(column) &&
          !column.startsWith("p_")
        );
      });
    };
    if (consumed.length !== candidates.length || !candidates.every(compared)) {
      const missing = candidates.filter((candidate) => !compared(candidate));
      throw new Error(
        `PostgreSQL function CAS fence drift: ${signature.schema}.${signature.function_name} (${missing.join(",")})`,
      );
    }
  }
}

function mutationPattern(
  schema: string,
  table: string,
  verbs: readonly string[],
): RegExp {
  const qualifiedTable = `"?${escapeRegularExpression(schema)}"?\\s*\\.\\s*"?${escapeRegularExpression(table)}"?`;
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
  const functionSource = staticFunctionBody(definition);
  assertOwnerWriterRuntimeGucSafetyV1(signature, functionSource);
  assertMetaFinalizationProvenanceSourceV1(signature, functionSource);
  const semantic = semanticFunctionDefinition(definition);
  const executable = semantic.replace(/'(?:''|[^'])*'/g, "''");
  const reachableSemantic = beforeFirstUnconditionalReturn(semantic);
  const reachableExecutable = beforeFirstUnconditionalReturn(executable);
  const reconciliationAck = signature.effects.some(
    ({ operation }) =>
      operation === "reconcile_ack_present" ||
      operation === "reconcile_ack_rematerialized",
  );
  const reconciliationPermanentFailureAck = signature.effects.some(
    ({ operation }) => operation === "reconcile_ack_permanent_failure",
  );
  const reconciliationAckReturns = [
    ...semantic.matchAll(/\breturn\s+(?!next\b|query\b)([\s\S]*?);/giu),
  ];
  if (
    reconciliationAck &&
    (reconciliationAckReturns.length !== 1 ||
      !/^jsonb_build_object\s*\(\s*'acknowledged'\s*,\s*true\s*\)$/iu.test(
        reconciliationAckReturns[0]?.[1]?.trim() ?? "",
      ))
  ) {
    throw new Error(
      `PostgreSQL function reconciliation ACK result drift: ${signature.schema}.${signature.function_name}`,
    );
  }
  if (
    reconciliationPermanentFailureAck &&
    (reconciliationAckReturns.length < 1 ||
      reconciliationAckReturns.some(
        (returnMatch) =>
          !/^jsonb_build_object\s*\(\s*'acknowledged'\s*,\s*true\s*,\s*'status'\s*,/iu.test(
            returnMatch[1]?.trim() ?? "",
          ),
      ))
  ) {
    throw new Error(
      `PostgreSQL function reconciliation permanent-failure ACK result drift: ${signature.schema}.${signature.function_name}`,
    );
  }
  assertNoUnreachableProofScaffolding(
    signature,
    reachableSemantic,
    reachableExecutable,
  );
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
  if (
    /\bset\s+(?:local\s+|session\s+)?search_path\b/iu.test(semantic) ||
    /\b(?:pg_catalog\s*\.\s*)?set_config\s*\(\s*'search_path'/iu.test(semantic)
  ) {
    throw new Error(
      `runtime search_path changes are forbidden in owner writer: ${signature.schema}.${signature.function_name}`,
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
      effect.concurrency_control === "durable_event_identity"
        ? executable
        : reachableExecutable,
      effect.concurrency_control === "durable_event_identity"
        ? semantic
        : reachableSemantic,
    );
  }
  const declaredTables = new Set<string>(signature.writes_tables);
  const mutationTargetPattern =
    /\b(insert\s+into|update|delete\s+from|merge\s+into|truncate(?:\s+table)?)\s+(?:only\s+)?(?:"?([a-z][a-z0-9_]*)"?\s*\.\s*)?"?([a-z][a-z0-9_]*)"?\b/gi;
  for (const match of executable.matchAll(mutationTargetPattern)) {
    const observedVerb = match[1]?.split(/\s+/u)[0];
    const observedSchema = match[2] ?? contract.schema;
    const observedTable = match[3];
    const mutationPrefix = executable.slice(0, match.index ?? 0);
    if (
      observedVerb === "update" &&
      /\b(?:for\s+(?:no\s+key\s+)?|do\s*)$/iu.test(mutationPrefix)
    ) {
      continue;
    }
    const declaredEffects = signature.effects.filter(
      ({ table_name }) => table_name === observedTable,
    );
    if (
      observedVerb === undefined ||
      observedTable === undefined ||
      observedSchema === undefined ||
      observedSchema !== contract.schema ||
      !declaredTables.has(observedTable) ||
      declaredEffects.length === 0 ||
      !declaredEffects.some((effect) =>
        allowedMutationVerbs(effect.operation).has(observedVerb),
      )
    ) {
      throw new Error(
        `undeclared PostgreSQL mutation in ${signature.schema}.${signature.function_name}: ${observedSchema ?? "unqualified"}.${observedTable ?? "unknown"}`,
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
    const prefix = executable.slice(0, match.index ?? 0);
    const suffix = executable.slice((match.index ?? 0) + match[0].length);
    if (
      observedTable === undefined ||
      commonTableExpressions.has(observedTable) ||
      /^\s*\(/u.test(suffix) ||
      /\bdistinct\s*$/iu.test(prefix)
    ) {
      continue;
    }
    if (
      observedSchema === undefined ||
      observedSchema !== contract.schema ||
      !declaredReads.has(observedTable)
    ) {
      throw new Error(
        `undeclared PostgreSQL read in ${signature.schema}.${signature.function_name}: ${observedSchema ?? "unqualified"}.${observedTable}`,
      );
    }
  }
  const fromClausePattern =
    /\bfrom\b([\s\S]*?)(?=\b(?:where|group\s+by|order\s+by|having|limit|offset|into|returning|for\s+(?:no\s+key\s+)?update|union|intersect|except)\b|;|$)/gi;
  const commaReadTargetPattern =
    /,\s*(?:only\s+)?(?:"?([a-z][a-z0-9_]*)"?\s*\.\s*)?"?([a-z][a-z0-9_]*)"?(?:\s+(?:as\s+)?(?!where\b|join\b|left\b|right\b|full\b|cross\b|inner\b|group\b|order\b|having\b|limit\b|offset\b|returning\b|for\b)(?:"?[a-z][a-z0-9_]*"?))?(?=\s*(?:,|\b(?:join|left|right|full|cross|inner|where|group|order|having|limit|offset|returning|for|union|intersect|except)\b|$))/gi;
  for (const fromClause of executable.matchAll(fromClausePattern)) {
    const prefix = executable.slice(0, fromClause.index ?? 0);
    if (/\bdistinct\s*$/iu.test(prefix)) continue;
    const relations = fromClause[1] ?? "";
    if (
      /^\s*\(/u.test(relations) ||
      /\b(?:insert\s+into|update|delete\s+from|merge\s+into|truncate)\b/iu.test(
        relations,
      )
    ) {
      continue;
    }
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
        observedSchema === undefined ||
        observedSchema !== contract.schema ||
        !declaredReads.has(observedTable)
      ) {
        throw new Error(
          `undeclared PostgreSQL read in ${signature.schema}.${signature.function_name}: ${observedSchema ?? "unqualified"}.${observedTable}`,
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
      observedSchema === undefined ||
      observedSchema !== contract.schema ||
      !declaredReads.has(observedTable)
    ) {
      throw new Error(
        `undeclared PostgreSQL read in ${signature.schema}.${signature.function_name}: ${observedSchema ?? "unqualified"}.${observedTable}`,
      );
    }
  }
  const qualifiedFunctionCallPattern =
    /\b"?([a-z][a-z0-9_]*)"?\s*\.\s*"?([a-z][a-z0-9_]*)"?\s*\(/gi;
  const trustedImmutableCrossSchemaHelpers = new Set([
    "pai_infra.canonical_json_v1",
  ]);
  for (const match of executable.matchAll(qualifiedFunctionCallPattern)) {
    const helperSchema = match[1];
    const helperName = match[2];
    const prefix = executable.slice(0, match.index ?? 0);
    if (/\b(?:into|update|table)\s+"?$/iu.test(prefix)) continue;
    if (
      helperSchema !== undefined &&
      helperSchema !== "pg_catalog" &&
      !trustedImmutableCrossSchemaHelpers.has(`${helperSchema}.${helperName}`) &&
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
 * Defense-in-depth lint for pai-infra generation. This heuristic must never be
 * used to mint a VerifiedOwnerRepositoryDeploymentV1 capability.
 */
export function lintOwnerWriterDefinitionV1(
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

function trustedWriterArtifact(
  contract: Pick<OwnerRepositoryContractV1, "writer_artifacts">,
  signature: OwnerFunctionSignatureV1,
): OwnerWriterArtifactV1 {
  const artifact = contract.writer_artifacts?.find(
    ({ function_name }) => function_name === signature.function_name,
  );
  if (artifact === undefined) {
    throw new Error(
      `trusted pai-infra writer artifact is required: ${signature.schema}.${signature.function_name}`,
    );
  }
  return artifact;
}

function verifyOwnerWriterSourceV1(
  contract: Pick<OwnerRepositoryContractV1, "writer_artifacts">,
  signature: OwnerFunctionSignatureV1,
  functionSource: string,
): void {
  assertOwnerWriterRuntimeGucSafetyV1(signature, functionSource);
  assertMetaFinalizationProvenanceSourceV1(signature, functionSource);
  const artifact = trustedWriterArtifact(contract, signature);
  if (
    artifact.signature_fingerprint !== `sha256:${fingerprint(signature)}` ||
    writerSourceSha256(functionSource) !== artifact.function_body_sha256
  ) {
    throw new Error(
      `trusted PostgreSQL writer artifact drift: ${signature.schema}.${signature.function_name}`,
    );
  }
}

/**
 * Verifies a complete CREATE FUNCTION definition against its version-pinned
 * pai-infra artifact. Any source change, including unreachable or swallowed
 * proof scaffolding, changes the digest and fails closed.
 */
export function verifyOwnerWriterDefinitionV1(
  contract: Pick<OwnerRepositoryContractV1, "writer_artifacts">,
  signature: OwnerFunctionSignatureV1,
  definition: string,
): void {
  verifyOwnerWriterSourceV1(contract, signature, staticFunctionBody(definition));
}

function checkTextLiterals(definition: string): readonly string[] {
  return [...definition.matchAll(/'((?:''|[^'])*)'/gu)].map((match) =>
    (match[1] ?? "").replace(/''/gu, "'"),
  );
}

function stripBalancedOuterParentheses(value: string): string {
  let current = value.trim();
  while (current.startsWith("(") && current.endsWith(")")) {
    let depth = 0;
    let inString = false;
    let matchingIndex = -1;
    for (let index = 0; index < current.length; index += 1) {
      const character = current[index];
      if (character === "'") {
        if (inString && current[index + 1] === "'") {
          index += 1;
          continue;
        }
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (character === "(") depth += 1;
      if (character === ")") {
        depth -= 1;
        if (depth === 0) {
          matchingIndex = index;
          break;
        }
      }
    }
    if (matchingIndex !== current.length - 1) break;
    current = current.slice(1, -1).trim();
  }
  return current;
}

function postgresCheckExpression(definition: string): string | undefined {
  const match = /^\s*check\s*\(([\s\S]*)\)\s*$/iu.exec(definition);
  return match === null
    ? undefined
    : stripBalancedOuterParentheses(match[1] ?? "");
}

function splitCheckConjunction(expression: string): readonly string[] {
  return splitCheckBooleanOperator(expression, "and");
}

function splitCheckDisjunction(expression: string): readonly string[] {
  return splitCheckBooleanOperator(expression, "or");
}

function splitCheckBooleanOperator(
  expression: string,
  operator: "and" | "or",
): readonly string[] {
  const terms: string[] = [];
  let depth = 0;
  let inString = false;
  let start = 0;
  for (let index = 0; index < expression.length; index += 1) {
    const character = expression[index];
    if (character === "'") {
      if (inString && expression[index + 1] === "'") {
        index += 1;
        continue;
      }
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (character === "(") {
      depth += 1;
      continue;
    }
    if (character === ")") {
      depth -= 1;
      continue;
    }
    if (
      depth === 0 &&
      expression.slice(index, index + operator.length).toLowerCase() === operator &&
      !/[a-z0-9_]/iu.test(expression[index - 1] ?? " ") &&
      !/[a-z0-9_]/iu.test(expression[index + operator.length] ?? " ")
    ) {
      terms.push(stripBalancedOuterParentheses(expression.slice(start, index)));
      start = index + operator.length;
      index += operator.length - 1;
    }
  }
  terms.push(stripBalancedOuterParentheses(expression.slice(start)));
  return terms;
}

const postgresTextCastPattern =
  "(?:\\s*::\\s*(?:pg_catalog\\.)?text)?";

function parsePostgresTextArray(content: string): readonly string[] | undefined {
  const literalWithCast = new RegExp(
    `'(?:''|[^'])*'${postgresTextCastPattern}`,
    "giu",
  );
  const shape = content
    .replace(literalWithCast, "L")
    .replace(/\s/gu, "");
  if (!/^L(?:,L)*$/u.test(shape)) return undefined;
  return checkTextLiterals(content);
}

function matchesPostgresTextEnum(
  expression: string,
  column: string,
  allowedValues: readonly string[],
): boolean {
  if (allowedValues.length === 1) {
    const value = escapeRegularExpression(
      (allowedValues[0] ?? "").replace(/'/gu, "''"),
    );
    return new RegExp(
      `^\\b${column}\\b\\s*=\\s*'${value}'${postgresTextCastPattern}$`,
      "iu",
    ).test(expression);
  }
  const anyMatch = new RegExp(
    `^\\b${column}\\b\\s*=\\s*(?:pg_catalog\\.)?any\\s*\\(\\s*array\\s*\\[([\\s\\S]*)\\]\\s*(?:::\\s*(?:pg_catalog\\.)?text\\s*\\[\\s*\\])?\\s*\\)$`,
    "iu",
  ).exec(expression);
  const inMatch = new RegExp(
    `^\\b${column}\\b\\s+in\\s*\\(([\\s\\S]*)\\)$`,
    "iu",
  ).exec(expression);
  const content = anyMatch?.[1] ?? inMatch?.[1];
  if (content === undefined) return false;
  const observedValues = parsePostgresTextArray(content);
  return (
    observedValues !== undefined &&
    sorted(observedValues).join("\u0000") ===
      sorted(allowedValues).join("\u0000")
  );
}

function matchesPostgresTextEquals(
  expression: string,
  column: string,
  value: string,
): boolean {
  const escapedValue = escapeRegularExpression(value.replace(/'/gu, "''"));
  return new RegExp(
    `^\\b${column}\\b\\s*=\\s*'${escapedValue}'${postgresTextCastPattern}$`,
    "iu",
  ).test(expression);
}

function matchesPostgresTextIdentityPrefix(
  expression: string,
  column: string,
  prefix: string,
  identityColumn: string,
): boolean {
  const escapedPrefix = escapeRegularExpression(prefix.replace(/'/gu, "''"));
  return new RegExp(
    `^\\b${column}\\b\\s*=\\s*\\(?\\s*'${escapedPrefix}'${postgresTextCastPattern}\\s*\\|\\|\\s*\\b${identityColumn}\\b\\s*\\)?$`,
    "iu",
  ).test(expression);
}

function matchesPostgresTextRegex(
  expression: string,
  column: string,
  pattern: string,
): boolean {
  const escapedPattern = escapeRegularExpression(pattern.replace(/'/gu, "''"));
  return new RegExp(
    `^\\b${column}\\b\\s*~\\s*'${escapedPattern}'${postgresTextCastPattern}$`,
    "iu",
  ).test(expression);
}

function matchesTextArrayBoundedNoNull(
  expression: string,
  column: string,
  maxItems: number,
): boolean {
  const terms = splitCheckConjunction(expression);
  const cardinality = new RegExp(
    `^(?:pg_catalog\\s*\\.\\s*)?cardinality\\s*\\(\\s*\\b${column}\\b\\s*\\)\\s*<=\\s*${maxItems}$`,
    "iu",
  );
  const noNull = new RegExp(
    `^(?:pg_catalog\\s*\\.\\s*)?array_position\\s*\\(\\s*\\b${column}\\b\\s*,\\s*null(?:\\s*::\\s*(?:pg_catalog\\s*\\.\\s*)?text)?\\s*\\)\\s+is\\s+null$`,
    "iu",
  );
  return (
    terms.length === 2 &&
    terms.filter((term) => cardinality.test(term)).length === 1 &&
    terms.filter((term) => noNull.test(term)).length === 1
  );
}

function matchesPermissionSummaryEntryBranch(
  expression: string,
  semantic: Extract<
    NonNullable<OwnerDatabaseCheckV1["semantic_constraint"]>,
    { readonly kind: "permission_summary_entry_branch" }
  >,
): boolean {
  const branches = splitCheckDisjunction(expression);
  if (branches.length !== 2) return false;
  const discriminator = escapeRegularExpression(semantic.column_name);
  const decision = escapeRegularExpression(semantic.decision_column_name);
  const emptyArrayColumn = escapeRegularExpression(
    semantic.default_empty_array_column_name,
  );
  const nullPredicate = (column: string) =>
    new RegExp(
      `^\\b${escapeRegularExpression(column)}\\b\\s+is\\s+null$`,
      "iu",
    );
  const notNullPredicate = (column: string) =>
    new RegExp(
      `^\\b${escapeRegularExpression(column)}\\b\\s+is\\s+not\\s+null$`,
      "iu",
  );
  const emptyArrayPredicate = new RegExp(
    `^(?:pg_catalog\\s*\\.\\s*)?cardinality\\s*\\(\\s*\\b${emptyArrayColumn}\\b\\s*\\)\\s*=\\s*0$`,
    "iu",
  );

  const revisionBranch = branches.find((branch) => {
    const terms = splitCheckConjunction(branch);
    return (
      terms.length === 1 + semantic.revision_required_columns.length &&
      terms.filter((term) =>
        matchesPostgresTextEquals(
          term,
          discriminator,
          semantic.revision_value,
        ),
      ).length === 1 &&
      semantic.revision_required_columns.every(
        (column) =>
          terms.filter((term) => notNullPredicate(column).test(term)).length ===
          1,
      )
    );
  });
  const defaultBranch = branches.find((branch) => branch !== revisionBranch);
  if (revisionBranch === undefined || defaultBranch === undefined) return false;
  const defaultTerms = splitCheckConjunction(defaultBranch);
  return (
    defaultTerms.length === 3 + semantic.default_null_columns.length &&
    defaultTerms.filter((term) =>
      matchesPostgresTextEquals(
        term,
        discriminator,
        semantic.default_deny_value,
      ),
    ).length === 1 &&
    defaultTerms.filter((term) =>
      matchesPostgresTextEquals(term, decision, semantic.deny_value),
    ).length === 1 &&
    semantic.default_null_columns.every(
      (column) =>
        defaultTerms.filter((term) => nullPredicate(column).test(term))
          .length === 1,
    ) &&
    defaultTerms.filter((term) => emptyArrayPredicate.test(term)).length === 1
  );
}

function matchesOctetLengthMin(
  expression: string,
  column: string,
  min: number,
): boolean {
  return new RegExp(
    `^(?:pg_catalog\\.)?octet_length\\s*\\(\\s*\\b${column}\\b\\s*\\)\\s*>\\s*${min}$`,
    "iu",
  ).test(expression);
}

function matchesColumnOrder(
  expression: string,
  column: string,
  otherColumn: string,
): boolean {
  return new RegExp(
    `^\\b${column}\\b\\s*>\\s*\\b${otherColumn}\\b$`,
    "iu",
  ).test(expression);
}

function matchesColumnEventEnvelope(
  expression: string,
  semantic: Extract<
    NonNullable<OwnerDatabaseCheckV1["semantic_constraint"]>,
    { readonly kind: "column_event_envelope" }
  >,
): boolean {
  const terms = splitCheckConjunction(expression);
  const producerColumn = escapeRegularExpression(semantic.producer_column_name);
  const schemaVersionColumn = escapeRegularExpression(
    semantic.schema_version_column_name,
  );
  const eventTypeColumn = escapeRegularExpression(semantic.event_type_column_name);
  const producerTerms = terms.filter((term) =>
    matchesPostgresTextEquals(term, producerColumn, semantic.producer_value),
  );
  const schemaVersionTerms = terms.filter((term) =>
    matchesPostgresTextEquals(
      term,
      schemaVersionColumn,
      semantic.schema_version_value,
    ),
  );
  const eventTypeTerms = terms.filter((term) =>
    matchesPostgresTextEnum(
      term,
      eventTypeColumn,
      semantic.event_type_allowed_values,
    ),
  );
  return (
    terms.length === 3 &&
    producerTerms.length === 1 &&
    schemaVersionTerms.length === 1 &&
    eventTypeTerms.length === 1
  );
}

function matchesColumnCommandEnvelope(
  expression: string,
  semantic: Extract<
    NonNullable<OwnerDatabaseCheckV1["semantic_constraint"]>,
    { readonly kind: "column_command_envelope" }
  >,
): boolean {
  const terms = splitCheckConjunction(expression);
  const producerColumn = escapeRegularExpression(semantic.producer_column_name);
  const schemaVersionColumn = escapeRegularExpression(
    semantic.schema_version_column_name,
  );
  const commandTypeColumn = escapeRegularExpression(semantic.column_name);
  const targetColumn = escapeRegularExpression(semantic.target_column_name);
  const payloadColumn = escapeRegularExpression(semantic.payload_column_name);
  const producerTerms = terms.filter((term) =>
    matchesPostgresTextEquals(term, producerColumn, semantic.producer_value),
  );
  const schemaVersionTerms = terms.filter((term) =>
    matchesPostgresTextEquals(
      term,
      schemaVersionColumn,
      semantic.schema_version_value,
    ),
  );
  const objectTerms = terms.filter((term) =>
    matchesJsonObjectType(term, payloadColumn),
  );
  const branchTerms = terms.filter(
    (term) => splitCheckDisjunction(term).length === semantic.commands.length,
  );
  if (
    producerTerms.length !== 1 ||
    schemaVersionTerms.length !== 1 ||
    objectTerms.length !== 1 ||
    branchTerms.length !== 1 ||
    terms.length !== 4
  ) {
    return false;
  }
  const branches = splitCheckDisjunction(branchTerms[0] ?? "");
  return semantic.commands.every((command) =>
    branches.some((branch) => {
      const branchConjunction = splitCheckConjunction(branch);
      return (
        branchConjunction.length === 3 &&
        branchConjunction.some((term) =>
          matchesPostgresTextEquals(
            term,
            commandTypeColumn,
            command.command_type,
          ),
        ) &&
        branchConjunction.some((term) =>
          matchesPostgresTextEquals(term, targetColumn, command.target),
        ) &&
        branchConjunction.some((term) =>
          matchesJsonTextEquality(
            term,
            payloadColumn,
            "schema_version",
            `'${escapeRegularExpression(command.payload_schema_version)}'${postgresTextCastPattern}`,
          ),
        )
      );
    }),
  );
}

function matchesJsonDiscriminator(
  expression: string,
  semantic: Extract<
    NonNullable<OwnerDatabaseCheckV1["semantic_constraint"]>,
    { readonly kind: "json_discriminator" }
  >,
): boolean {
  const terms = splitCheckConjunction(expression);
  const discriminatorColumn = escapeRegularExpression(semantic.column_name);
  const payloadColumn = escapeRegularExpression(semantic.payload_column_name);
  const objectTerms = terms.filter((term) =>
    matchesJsonObjectType(term, payloadColumn),
  );
  const branchTerms = terms.filter(
    (term) => splitCheckDisjunction(term).length === semantic.branches.length,
  );
  if (
    objectTerms.length !== 1 ||
    branchTerms.length !== 1 ||
    terms.length !== 2
  ) {
    return false;
  }
  const branches = splitCheckDisjunction(branchTerms[0] ?? "");
  return semantic.branches.every((expected) =>
    branches.some((branch) => {
      const branchConjunction = splitCheckConjunction(branch);
      return (
        branchConjunction.length === 2 &&
        branchConjunction.some((term) =>
          matchesPostgresTextEquals(
            term,
            discriminatorColumn,
            expected.discriminator_value,
          ),
        ) &&
        branchConjunction.some((term) =>
          matchesJsonTextEquality(
            term,
            payloadColumn,
            semantic.payload_field_name,
            `'${escapeRegularExpression(
              expected.payload_field_value.replace(/'/gu, "''"),
            )}'${postgresTextCastPattern}`,
          ),
        )
      );
    }),
  );
}

function matchesNullablePostgresTextEnum(
  expression: string,
  column: string,
  allowedValues: readonly string[],
): boolean {
  const terms = splitCheckDisjunction(expression);
  const nullTerms = terms.filter((term) =>
    new RegExp(`^\\b${column}\\b\\s+is\\s+null$`, "iu").test(term),
  );
  const enumTerms = terms.filter((term) =>
    matchesPostgresTextEnum(term, column, allowedValues),
  );
  return nullTerms.length === 1 && enumTerms.length === 1 && terms.length === 2;
}

function matchesIntegerRange(
  expression: string,
  column: string,
  min: number,
  max: number,
): boolean {
  const terms = splitCheckConjunction(expression);
  const postgresIntegerLiteralPattern = (value: number): string => {
    const literal = escapeRegularExpression(String(value));
    return `(?:${literal}|'${literal}'\\s*::\\s*(?:pg_catalog\\.)?(?:bigint|int8|integer|int4|smallint|int2|numeric))`;
  };
  const minLiteral = postgresIntegerLiteralPattern(min);
  const maxLiteral = postgresIntegerLiteralPattern(max);
  const minPattern = new RegExp(
    `^(?:\\b${column}\\b\\s*>=\\s*${minLiteral}|${minLiteral}\\s*<=\\s*\\b${column}\\b)$`,
    "iu",
  );
  const maxPattern = new RegExp(
    `^(?:\\b${column}\\b\\s*<=\\s*${maxLiteral}|${maxLiteral}\\s*>=\\s*\\b${column}\\b)$`,
    "iu",
  );
  return (
    terms.length === 2 &&
    terms.some((term) => minPattern.test(term)) &&
    terms.some((term) => maxPattern.test(term))
  );
}

function matchesNullableIntegerRange(
  expression: string,
  column: string,
  min: number,
  max: number,
): boolean {
  const terms = splitCheckDisjunction(expression);
  const nullPattern = new RegExp(`^\\b${column}\\b\\s+is\\s+null$`, "iu");
  const nullTerms = terms.filter((term) => nullPattern.test(term));
  const rangeTerms = terms.filter((term) =>
    matchesIntegerRange(term, column, min, max),
  );
  return nullTerms.length === 1 && rangeTerms.length === 1 && terms.length === 2;
}

function matchesNullableVersionedIdentity(
  expression: string,
  semantic: Extract<
    NonNullable<OwnerDatabaseCheckV1["semantic_constraint"]>,
    { readonly kind: "nullable_versioned_identity" }
  >,
): boolean {
  const referenceColumn = escapeRegularExpression(semantic.column_name);
  const versionColumn = escapeRegularExpression(
    semantic.version_column_name,
  );
  const hashColumn = escapeRegularExpression(semantic.hash_column_name);
  const retentionColumn =
    semantic.retention_column_name === undefined
      ? undefined
      : escapeRegularExpression(semantic.retention_column_name);
  const branches = splitCheckDisjunction(expression);
  if (branches.length !== 2) return false;

  const nullPredicate = (column: string) =>
    new RegExp(`^\\b${column}\\b\\s+is\\s+null$`, "iu");
  const notNullPredicate = (column: string) =>
    new RegExp(`^\\b${column}\\b\\s+is\\s+not\\s+null$`, "iu");
  const nullBranch = branches.find((branch) => {
    const terms = splitCheckConjunction(branch);
    return (
      terms.length === (retentionColumn === undefined ? 3 : 4) &&
      terms.filter((term) => nullPredicate(referenceColumn).test(term))
        .length === 1 &&
      terms.filter((term) => nullPredicate(versionColumn).test(term))
        .length === 1 &&
      terms.filter((term) => nullPredicate(hashColumn).test(term)).length ===
        1 &&
      (retentionColumn === undefined ||
        terms.filter((term) => nullPredicate(retentionColumn).test(term))
          .length === 1)
    );
  });
  const presentBranch = branches.find((branch) => branch !== nullBranch);
  if (nullBranch === undefined || presentBranch === undefined) return false;

  const terms = splitCheckConjunction(presentBranch);
  const integerLiteral = (value: number) => {
    const literal = escapeRegularExpression(String(value));
    return `(?:${literal}|'${literal}'\\s*::\\s*(?:pg_catalog\\.)?(?:bigint|int8|integer|int4|smallint|int2|numeric))`;
  };
  const minLiteral = integerLiteral(semantic.min_version);
  const maxLiteral = integerLiteral(semantic.max_version);
  const minPredicate = new RegExp(
    `^(?:\\b${versionColumn}\\b\\s*>=\\s*${minLiteral}|${minLiteral}\\s*<=\\s*\\b${versionColumn}\\b)$`,
    "iu",
  );
  const maxPredicate = new RegExp(
    `^(?:\\b${versionColumn}\\b\\s*<=\\s*${maxLiteral}|${maxLiteral}\\s*>=\\s*\\b${versionColumn}\\b)$`,
    "iu",
  );
  const betweenPredicate = new RegExp(
    `^\\b${versionColumn}\\b\\s+between\\s+${minLiteral}\\s+and\\s+${maxLiteral}$`,
    "iu",
  );
  const hashLengthPredicate = new RegExp(
    `^(?:(?:pg_catalog\\.)?(?:length|char_length|octet_length))\\s*\\(\\s*\\b${hashColumn}\\b\\s*\\)\\s*>\\s*0$`,
    "iu",
  );
  const referencePredicates = terms.filter((term) =>
    notNullPredicate(referenceColumn).test(term),
  );
  const hashPredicates = terms.filter((term) =>
    notNullPredicate(hashColumn).test(term),
  );
  const lengthPredicates = terms.filter((term) =>
    hashLengthPredicate.test(term),
  );
  const retentionPredicates =
    retentionColumn === undefined
      ? []
      : terms.filter((term) => notNullPredicate(retentionColumn).test(term));
  const betweenPredicates = terms.filter((term) =>
    betweenPredicate.test(term),
  );
  const minPredicates = terms.filter((term) => minPredicate.test(term));
  const maxPredicates = terms.filter((term) => maxPredicate.test(term));
  const rangePredicateCount =
    betweenPredicates.length === 1 &&
    minPredicates.length === 0 &&
    maxPredicates.length === 0
      ? 1
      : betweenPredicates.length === 0 &&
          minPredicates.length === 1 &&
          maxPredicates.length === 1
        ? 2
        : 0;
  return (
    referencePredicates.length === 1 &&
    hashPredicates.length === 1 &&
    lengthPredicates.length === 1 &&
    (retentionColumn === undefined || retentionPredicates.length === 1) &&
    rangePredicateCount > 0 &&
    terms.length ===
      3 + rangePredicateCount + (retentionColumn === undefined ? 0 : 1)
  );
}

function matchesIntegerRanges(
  expression: string,
  semantic: Extract<
    NonNullable<OwnerDatabaseCheckV1["semantic_constraint"]>,
    { readonly kind: "integer_ranges" }
  >,
): boolean {
  const terms = splitCheckConjunction(expression);
  const matchedTerms = new Set<number>();
  for (const range of semantic.ranges) {
    const column = escapeRegularExpression(range.column_name);
    if (range.nullable) {
      const matches = terms
        .map((term, index) => ({ term, index }))
        .filter(({ term }) =>
          matchesNullableIntegerRange(
            term,
            column,
            range.min,
            range.max,
          ),
        );
      if (matches.length !== 1 || matches[0] === undefined) return false;
      matchedTerms.add(matches[0].index);
      continue;
    }
    const columnPattern = new RegExp(`\\b${column}\\b`, "iu");
    const candidates = terms
      .map((term, index) => ({ term, index }))
      .filter(({ term }) => columnPattern.test(term));
    if (
      candidates.length !== 2 ||
      !matchesIntegerRange(
        candidates.map(({ term }) => term).join(" AND "),
        column,
        range.min,
        range.max,
      )
    ) {
      return false;
    }
    for (const candidate of candidates) matchedTerms.add(candidate.index);
  }
  return matchedTerms.size === terms.length;
}

function matchesIntegerSuccessor(
  expression: string,
  column: string,
  previousColumn: string,
): boolean {
  const successorPattern = new RegExp(
    `^(?:\\b${column}\\b\\s*=\\s*\\(?\\s*\\b${previousColumn}\\b\\s*\\+\\s*1\\s*\\)?|\\(?\\s*\\b${previousColumn}\\b\\s*\\+\\s*1\\s*\\)?\\s*=\\s*\\b${column}\\b)$`,
    "iu",
  );
  return successorPattern.test(expression);
}

function matchesImplicationNotNull(
  expression: string,
  column: string,
  conditionColumn: string,
  conditionEquals: string,
): boolean {
  const value = escapeRegularExpression(conditionEquals.replace(/'/gu, "''"));
  const terms = splitCheckDisjunction(expression);
  const guardPattern = new RegExp(
    `^\\b${conditionColumn}\\b\\s*<>\\s*'${value}'${postgresTextCastPattern}$`,
    "iu",
  );
  const requiredPattern = new RegExp(
    `^\\b${column}\\b\\s+is\\s+not\\s+null$`,
    "iu",
  );
  return (
    terms.length === 2 &&
    terms.some((term) => guardPattern.test(term)) &&
    terms.some((term) => requiredPattern.test(term))
  );
}

function matchesIffNotNull(
  expression: string,
  column: string,
  conditionColumn: string,
  conditionEquals: string,
  requireNonEmpty: boolean,
): boolean {
  const value = escapeRegularExpression(conditionEquals.replace(/'/gu, "''"));
  const conditionPattern = `\\(?\\s*\\b${conditionColumn}\\b\\s*=\\s*'${value}'${postgresTextCastPattern}\\s*\\)?`;
  const notNullPattern = `\\(?\\s*\\b${column}\\b\\s+is\\s+not\\s+null\\s*\\)?`;
  const iffPattern = new RegExp(
    `^\\(?\\s*(?:${conditionPattern}\\s*=\\s*${notNullPattern}|${notNullPattern}\\s*=\\s*${conditionPattern})\\s*\\)?$`,
    "iu",
  );
  if (!requireNonEmpty) return iffPattern.test(expression);
  const terms = splitCheckConjunction(expression);
  const nonEmptyPattern = new RegExp(
    `^\\(?\\s*(?:\\b${column}\\b\\s+is\\s+null\\s+or\\s+\\b${column}\\b\\s*<>\\s*''${postgresTextCastPattern})\\s*\\)?$`,
    "iu",
  );
  return (
    terms.length === 2 &&
    terms.some((term) => iffPattern.test(term)) &&
    terms.some((term) => nonEmptyPattern.test(term))
  );
}

function matchesRequiredJsonKeys(
  term: string,
  column: string,
  requiredKeys: readonly string[],
): boolean {
  const match = new RegExp(
    `^\\b${column}\\b\\s*\\?&\\s*array\\s*\\[([\\s\\S]*)\\]\\s*(?:::\\s*(?:pg_catalog\\.)?text\\s*\\[\\s*\\])?$`,
    "iu",
  ).exec(term);
  const observedKeys =
    match?.[1] === undefined
      ? undefined
      : parsePostgresTextArray(match[1]);
  return (
    observedKeys !== undefined &&
    sorted(observedKeys).join("\u0000") ===
      sorted(requiredKeys).join("\u0000")
  );
}

function matchesJsonObjectType(term: string, column: string): boolean {
  return new RegExp(
    `^(?:pg_catalog\\.)?jsonb_typeof\\s*\\(\\s*\\b${column}\\b\\s*\\)\\s*=\\s*'object'${postgresTextCastPattern}$`,
    "iu",
  ).test(term);
}

function matchesJsonObjectLength(
  term: string,
  column: string,
  expectedLength: number,
): boolean {
  return new RegExp(
    `^(?:pg_catalog\\.)?jsonb_object_length\\s*\\(\\s*\\b${column}\\b\\s*\\)\\s*=\\s*${expectedLength}$`,
    "iu",
  ).test(term);
}

function matchesJsonExactKeys(
  term: string,
  column: string,
  requiredKeys: readonly string[],
): boolean {
  const match = new RegExp(
    `^\\(?\\s*\\b${column}\\b\\s*-\\s*array\\s*\\[([\\s\\S]*)\\]\\s*(?:::\\s*(?:pg_catalog\\.)?text\\s*\\[\\s*\\])?\\s*\\)?\\s*=\\s*'\\{\\}'\\s*::\\s*(?:pg_catalog\\.)?jsonb$`,
    "iu",
  ).exec(term);
  const observedKeys =
    match?.[1] === undefined
      ? undefined
      : parsePostgresTextArray(match[1]);
  return (
    observedKeys !== undefined &&
    sorted(observedKeys).join("\u0000") ===
      sorted(requiredKeys).join("\u0000")
  );
}

function matchesJsonTextEquality(
  term: string,
  jsonColumn: string,
  fieldName: string,
  valuePattern: string,
): boolean {
  const field = escapeRegularExpression(fieldName);
  return new RegExp(
    `^\\(?\\s*\\b${jsonColumn}\\b\\s*->>\\s*'${field}'${postgresTextCastPattern}\\s*\\)?\\s*=\\s*${valuePattern}$`,
    "iu",
  ).test(term);
}

function checkSemanticMatches(
  definition: string,
  semantic: NonNullable<OwnerDatabaseCheckV1["semantic_constraint"]>,
): boolean {
  const column = escapeRegularExpression(semantic.column_name);
  const expression = postgresCheckExpression(definition);
  if (expression === undefined) return false;
  if (semantic.kind === "text_equals") {
    return matchesPostgresTextEquals(expression, column, semantic.value);
  }
  if (semantic.kind === "text_identity_prefix") {
    return matchesPostgresTextIdentityPrefix(
      expression,
      column,
      semantic.prefix,
      escapeRegularExpression(semantic.identity_column_name),
    );
  }
  if (semantic.kind === "text_regex") {
    return matchesPostgresTextRegex(expression, column, semantic.pattern);
  }
  if (semantic.kind === "text_array_bounded_no_null") {
    return matchesTextArrayBoundedNoNull(
      expression,
      column,
      semantic.max_items,
    );
  }
  if (semantic.kind === "permission_summary_entry_branch") {
    return matchesPermissionSummaryEntryBranch(expression, semantic);
  }
  if (semantic.kind === "octet_length_min") {
    return matchesOctetLengthMin(expression, column, semantic.min);
  }
  if (semantic.kind === "column_order") {
    return matchesColumnOrder(
      expression,
      column,
      escapeRegularExpression(semantic.other_column_name),
    );
  }
  if (semantic.kind === "column_event_envelope") {
    return matchesColumnEventEnvelope(expression, semantic);
  }
  if (semantic.kind === "column_command_envelope") {
    return matchesColumnCommandEnvelope(expression, semantic);
  }
  if (semantic.kind === "json_discriminator") {
    return matchesJsonDiscriminator(expression, semantic);
  }
  if (semantic.kind === "json_text_equals") {
    const value = escapeRegularExpression(
      semantic.value.replace(/'/gu, "''"),
    );
    const terms = splitCheckConjunction(expression);
    const keyTerms = terms.filter((term) =>
      matchesRequiredJsonKeys(term, column, semantic.required_keys),
    );
    const equalityTerms = terms.filter((term) =>
      matchesJsonTextEquality(
        term,
        column,
        semantic.field_name,
        `'${value}'${postgresTextCastPattern}`,
      ),
    );
    const objectTerms = terms.filter((term) =>
      matchesJsonObjectType(term, column),
    );
    const lengthTerms = terms.filter(
      (term) =>
        matchesJsonObjectLength(term, column, semantic.required_keys.length) ||
        matchesJsonExactKeys(term, column, semantic.required_keys),
    );
    return (
      keyTerms.length === 1 &&
      equalityTerms.length === 1 &&
      objectTerms.length <= 1 &&
      lengthTerms.length === (semantic.allow_additional_keys ? 0 : 1) &&
      terms.length ===
        keyTerms.length +
          equalityTerms.length +
          objectTerms.length +
          lengthTerms.length
    );
  }
  if (semantic.kind === "json_event_envelope") {
    const producer = escapeRegularExpression(
      semantic.producer_value.replace(/'/gu, "''"),
    );
    const terms = splitCheckConjunction(expression);
    const objectTerms = terms.filter((term) =>
      matchesJsonObjectType(term, column),
    );
    const keyTerms = terms.filter((term) =>
      matchesRequiredJsonKeys(term, column, semantic.required_keys),
    );
    const lengthTerms = terms.filter(
      (term) =>
        matchesJsonObjectLength(term, column, semantic.required_keys.length) ||
        matchesJsonExactKeys(term, column, semantic.required_keys),
    );
    const producerTerms = terms.filter((term) =>
      matchesJsonTextEquality(
        term,
        column,
        "producer",
        `'${producer}'${postgresTextCastPattern}`,
      ),
    );
    const bindingTerms = semantic.field_bindings.map(
      ({ field_name, column_name }) =>
        terms.filter((term) =>
          matchesJsonTextEquality(
            term,
            column,
            field_name,
            `\\b${escapeRegularExpression(column_name)}\\b`,
          ),
        ),
    );
    return (
      objectTerms.length === 1 &&
      keyTerms.length === 1 &&
      lengthTerms.length === (semantic.allow_additional_keys ? 0 : 1) &&
      producerTerms.length === 1 &&
      bindingTerms.every((matches) => matches.length === 1) &&
      terms.length ===
        objectTerms.length +
          keyTerms.length +
          lengthTerms.length +
          producerTerms.length +
          bindingTerms.reduce((count, matches) => count + matches.length, 0)
    );
  }
  if (semantic.kind === "integer_range") {
    return matchesIntegerRange(
      expression,
      column,
      semantic.min,
      semantic.max,
    );
  }
  if (semantic.kind === "nullable_integer_range") {
    return matchesNullableIntegerRange(
      expression,
      column,
      semantic.min,
      semantic.max,
    );
  }
  if (semantic.kind === "nullable_versioned_identity") {
    return matchesNullableVersionedIdentity(expression, semantic);
  }
  if (semantic.kind === "integer_ranges") {
    return matchesIntegerRanges(expression, semantic);
  }
  if (semantic.kind === "integer_successor") {
    return matchesIntegerSuccessor(
      expression,
      column,
      escapeRegularExpression(semantic.previous_column_name),
    );
  }
  if (semantic.kind === "nullable_text_enum") {
    return matchesNullablePostgresTextEnum(
      expression,
      column,
      semantic.allowed_values,
    );
  }
  if (semantic.kind === "implies_not_null") {
    return matchesImplicationNotNull(
      expression,
      column,
      escapeRegularExpression(semantic.condition_column_name),
      semantic.condition_equals,
    );
  }
  if (semantic.kind === "iff_not_null") {
    return matchesIffNotNull(
      expression,
      column,
      escapeRegularExpression(semantic.condition_column_name),
      semantic.condition_equals,
      semantic.require_non_empty,
    );
  }
  return matchesPostgresTextEnum(
    expression,
    column,
    semantic.allowed_values,
  );
}

export function verifyOwnerDatabaseCheckDefinitionV1(
  expectation: OwnerDatabaseCheckV1,
  definition: string,
): void {
  const matches = expectation.semantic_constraint === undefined
    ? expectation.required_definition_fragments.every((fragment) =>
        definition.includes(fragment),
      )
    : checkSemanticMatches(definition, expectation.semantic_constraint);
  if (!matches) {
    throw new Error(
      `PostgreSQL CHECK constraint drift: ${expectation.table_name}.${expectation.constraint_name}`,
    );
  }
}

/**
 * pg_get_indexdef omits an operator-class schema only when that schema is in
 * the session search_path and usable by the connected role.  Deployment
 * manifests must be comparable under both the catalog and least-privilege
 * runtime identities, so normalize only the known pgvector operator classes.
 */
function stableOwnerIndexDefinitionV1(definition: string): string {
  return definition.replaceAll(
    /(?<![a-z0-9_.])(?:vector|halfvec|sparsevec)_(?:l2|ip|cosine|l1)_ops\b/gu,
    (operatorClass) => `extensions.${operatorClass}`,
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
    /**
     * Independent deployment LOGIN roles that may explicitly SET ROLE to the
     * NOLOGIN schema owner. Membership is exact and must be direct,
     * NOINHERIT, SET TRUE and ADMIN FALSE. Omission remains fail-closed.
     */
    schema_owner_assume_principals?: readonly string[];
  }>,
): Promise<VerifiedOwnerRepositoryDeploymentV1<TContract["owner_service"]>> {
  // The verifier is a public boundary; do not rely on callers having obtained
  // the object from defineOwnerRepositoryContractV1 first.
  defineOwnerRepositoryContractV1(contract);
  if (contract.foreign_key_snapshot.status === "pending") {
    throw new Error(
      `canonical PostgreSQL foreign-key snapshot is pending for ${contract.owner_service}: ${contract.foreign_key_snapshot.reason}`,
    );
  }
  if (
    contract.dlq_tables.length > 0 &&
    (contract.dlq_resolutions === undefined ||
      contract.dlq_resolutions.length !== contract.dlq_tables.length)
  ) {
    throw new Error(
      `canonical immutable DLQ resolution mapping is required for live owner verification: ${contract.owner_service}`,
    );
  }
  if (contract.database_columns === undefined) {
    throw new Error(
      `canonical PostgreSQL column snapshot is required for live owner verification: ${contract.owner_service}`,
    );
  }
  if (contract.database_unique_constraints === undefined) {
    throw new Error(
      `canonical PostgreSQL primary-key/unique snapshot is required for live owner verification: ${contract.owner_service}`,
    );
  }
  if (contract.database_indexes === undefined) {
    throw new Error(
      `canonical PostgreSQL pg_index snapshot is required for live owner verification: ${contract.owner_service}`,
    );
  }
  if (
    contract.writer_artifacts === undefined ||
    contract.writer_artifacts.length !== contract.function_signatures.length
  ) {
    throw new Error(
      `version-pinned pai-infra writer artifacts are required for live owner verification: ${contract.owner_service}`,
    );
  }
  const schemaOwnerAssumePrincipals = [
    ...(options.schema_owner_assume_principals ?? []),
  ];
  if (
    new Set(schemaOwnerAssumePrincipals).size !==
      schemaOwnerAssumePrincipals.length ||
    schemaOwnerAssumePrincipals.some(
      (principal) =>
        principal.trim().length === 0 ||
        principal === options.expected_schema_owner ||
        principal === contract.app_role,
    )
  ) {
    throw new Error(
      `invalid schema-owner assume principal allowlist for ${contract.owner_service}`,
    );
  }
  const databaseIdentitySql = `SELECT current_database()::text AS database_name,
                                      (pg_catalog.pg_control_system()).system_identifier::text
                                        AS system_identifier`;
  const [catalogDatabaseIdentityResult, runtimeDatabaseIdentityResult] =
    await Promise.all([
      postgres.query<{
        database_name: string;
        system_identifier: string;
      }>(databaseIdentitySql),
      options.runtime_postgres.query<{
        database_name: string;
        system_identifier: string;
      }>(databaseIdentitySql),
    ]);
  const catalogDatabaseIdentity = catalogDatabaseIdentityResult.rows[0];
  const runtimeDatabaseIdentity = runtimeDatabaseIdentityResult.rows[0];
  if (
    catalogDatabaseIdentityResult.rows.length !== 1 ||
    runtimeDatabaseIdentityResult.rows.length !== 1 ||
    catalogDatabaseIdentity === undefined ||
    runtimeDatabaseIdentity === undefined ||
    catalogDatabaseIdentity.database_name.length === 0 ||
    catalogDatabaseIdentity.system_identifier.length === 0 ||
    catalogDatabaseIdentity.database_name !==
      runtimeDatabaseIdentity.database_name ||
    catalogDatabaseIdentity.system_identifier !==
      runtimeDatabaseIdentity.system_identifier
  ) {
    throw new Error(
      `catalog and runtime PostgreSQL identities do not match for ${contract.owner_service}`,
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

  const schemaOwnerRoleResult = await postgres.query<{
    role_name: string;
    can_login: boolean;
    is_superuser: boolean;
    bypasses_rls: boolean;
    can_create_role: boolean;
    can_create_database: boolean;
    can_replicate: boolean;
  }>(
    `SELECT r.rolname AS role_name,
            r.rolcanlogin AS can_login,
            r.rolsuper AS is_superuser,
            r.rolbypassrls AS bypasses_rls,
            r.rolcreaterole AS can_create_role,
            r.rolcreatedb AS can_create_database,
            r.rolreplication AS can_replicate
       FROM pg_catalog.pg_roles r
      WHERE r.rolname = $1`,
    [options.expected_schema_owner],
  );
  const schemaOwnerRole = schemaOwnerRoleResult.rows[0];
  if (
    schemaOwnerRoleResult.rows.length !== 1 ||
    schemaOwnerRole === undefined ||
    schemaOwnerRole.can_login ||
    schemaOwnerRole.is_superuser ||
    schemaOwnerRole.bypasses_rls ||
    schemaOwnerRole.can_create_role ||
    schemaOwnerRole.can_create_database ||
    schemaOwnerRole.can_replicate
  ) {
    throw new Error(
      `schema owner PostgreSQL role is not least-privilege for ${contract.owner_service}`,
    );
  }

  const schemaOwnerInheritedRoleResult = await postgres.query<{
    role_name: string;
  }>(
    `WITH RECURSIVE inherited_roles(role_oid) AS (
       SELECT r.oid FROM pg_catalog.pg_roles r WHERE r.rolname = $1
       UNION
       SELECT m.roleid
         FROM pg_catalog.pg_auth_members m
         JOIN inherited_roles inherited ON inherited.role_oid = m.member
     )
     SELECT r.rolname AS role_name
       FROM inherited_roles inherited
       JOIN pg_catalog.pg_roles r ON r.oid = inherited.role_oid
      ORDER BY r.rolname`,
    [options.expected_schema_owner],
  );
  assertSameSet(
    `${options.expected_schema_owner} inherited roles`,
    schemaOwnerInheritedRoleResult.rows.map(({ role_name }) => role_name),
    [options.expected_schema_owner],
  );

  const schemaOwnerMemberResult = await postgres.query<{
    role_name: string;
    can_login: boolean;
    is_superuser: boolean;
    bypasses_rls: boolean;
    can_create_role: boolean;
    can_create_database: boolean;
    can_replicate: boolean;
  }>(
    `WITH RECURSIVE owner_role_members(role_oid, path) AS (
       SELECT r.oid, ARRAY[r.oid]
         FROM pg_catalog.pg_roles r
        WHERE r.rolname = $1
       UNION ALL
       SELECT m.member, owner_role_members.path || m.member
         FROM pg_catalog.pg_auth_members m
         JOIN owner_role_members ON owner_role_members.role_oid = m.roleid
        WHERE NOT m.member = ANY(owner_role_members.path)
     )
     SELECT r.rolname AS role_name,
            r.rolcanlogin AS can_login,
            r.rolsuper AS is_superuser,
            r.rolbypassrls AS bypasses_rls,
            r.rolcreaterole AS can_create_role,
            r.rolcreatedb AS can_create_database,
            r.rolreplication AS can_replicate
       FROM owner_role_members
       JOIN pg_catalog.pg_roles r ON r.oid = owner_role_members.role_oid
      WHERE r.rolname <> $1
      ORDER BY r.rolname`,
    [options.expected_schema_owner],
  );
  assertSameSet(
    `${options.expected_schema_owner} reverse members`,
    schemaOwnerMemberResult.rows.map(({ role_name }) => role_name),
    schemaOwnerAssumePrincipals,
  );
  if (
    schemaOwnerMemberResult.rows.some(
      ({
        can_login,
        is_superuser,
        bypasses_rls,
        can_create_role,
        can_create_database,
        can_replicate,
      }) =>
        !can_login ||
        is_superuser ||
        bypasses_rls ||
        can_create_role ||
        can_create_database ||
        can_replicate,
    )
  ) {
    throw new Error(
      `schema owner assume principal privilege drift for ${contract.owner_service}`,
    );
  }
  const schemaOwnerMembershipOptionsResult = await postgres.query<{
    role_name: string;
    admin_option: boolean;
    inherit_option: boolean;
    set_option: boolean;
  }>(
    `SELECT member.rolname AS role_name,
            membership.admin_option,
            membership.inherit_option,
            membership.set_option
       FROM pg_catalog.pg_auth_members membership
       JOIN pg_catalog.pg_roles owner_role
         ON owner_role.oid = membership.roleid
       JOIN pg_catalog.pg_roles member ON member.oid = membership.member
      WHERE owner_role.rolname = $1
      ORDER BY member.rolname`,
    [options.expected_schema_owner],
  );
  assertSameSet(
    `${options.expected_schema_owner} direct assume memberships`,
    schemaOwnerMembershipOptionsResult.rows.map(({ role_name }) => role_name),
    schemaOwnerAssumePrincipals,
  );
  if (
    schemaOwnerMembershipOptionsResult.rows.some(
      ({ admin_option, inherit_option, set_option }) =>
        admin_option || inherit_option || !set_option,
    )
  ) {
    throw new Error(
      `schema owner assume membership option drift for ${contract.owner_service}`,
    );
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
  const runtimeGucResult = await options.runtime_postgres.query<{
    session_replication_role: string;
    synchronous_commit: string;
    can_set_session_replication_role: boolean;
    can_alter_system_session_replication_role: boolean;
    can_alter_system_synchronous_commit: boolean;
  }>(
    `SELECT pg_catalog.current_setting('session_replication_role') AS session_replication_role,
            pg_catalog.current_setting('synchronous_commit') AS synchronous_commit,
            pg_catalog.has_parameter_privilege(
              current_user, 'session_replication_role', 'SET'
            ) AS can_set_session_replication_role,
            pg_catalog.has_parameter_privilege(
              current_user, 'session_replication_role', 'ALTER SYSTEM'
            ) AS can_alter_system_session_replication_role,
            pg_catalog.has_parameter_privilege(
              current_user, 'synchronous_commit', 'ALTER SYSTEM'
            ) AS can_alter_system_synchronous_commit`,
  );
  const runtimeGucs = runtimeGucResult.rows[0];
  if (
    runtimeGucResult.rows.length !== 1 ||
    runtimeGucs === undefined ||
    runtimeGucs.session_replication_role !== "origin" ||
    runtimeGucs.synchronous_commit !== "on" ||
    runtimeGucs.can_set_session_replication_role ||
    runtimeGucs.can_alter_system_session_replication_role ||
    runtimeGucs.can_alter_system_synchronous_commit
  ) {
    throw new Error(
      `runtime PostgreSQL durability GUC drift for ${contract.owner_service}`,
    );
  }
  const runtimeGucDefaultResult = await postgres.query<{
    role_name: string;
    database_name: string;
    setting: string;
  }>(
    `SELECT COALESCE(role.rolname, 'ALL') AS role_name,
            COALESCE(database.datname, 'ALL') AS database_name,
            setting
       FROM pg_catalog.pg_db_role_setting configured
       LEFT JOIN pg_catalog.pg_roles role ON role.oid = configured.setrole
       LEFT JOIN pg_catalog.pg_database database ON database.oid = configured.setdatabase
       CROSS JOIN LATERAL unnest(configured.setconfig) AS setting
      WHERE (configured.setrole = 0 OR role.rolname = ANY($1::text[]))
        AND (configured.setdatabase = 0 OR database.datname = pg_catalog.current_database())
        AND split_part(setting, '=', 1) = ANY($2::text[])
      ORDER BY role_name, database_name, setting`,
    [
      [runtimeIdentity.current_user, contract.app_role],
      ["session_replication_role", "synchronous_commit"],
    ],
  );
  if (
    runtimeGucDefaultResult.rows.some(
      ({ setting }) =>
        setting !== "session_replication_role=origin" &&
        setting !== "synchronous_commit=on",
    )
  ) {
    throw new Error(
      `runtime PostgreSQL role/database GUC default drift for ${contract.owner_service}`,
    );
  }
  const runtimeParameterAclResult = await postgres.query<{
    parameter_name: string;
    grantee: string;
    privilege_type: string;
  }>(
    `SELECT parameter.parname AS parameter_name,
            COALESCE(grantee.rolname, 'PUBLIC') AS grantee,
            acl.privilege_type
       FROM pg_catalog.pg_parameter_acl parameter
       CROSS JOIN LATERAL pg_catalog.aclexplode(parameter.paracl) acl
       LEFT JOIN pg_catalog.pg_roles grantee ON grantee.oid = acl.grantee
      WHERE parameter.parname = ANY($1::text[])
        AND COALESCE(grantee.rolname, 'PUBLIC') = ANY($2::text[])
      ORDER BY parameter_name, grantee, privilege_type`,
    [
      ["session_replication_role", "synchronous_commit"],
      ["PUBLIC", runtimeIdentity.current_user, contract.app_role],
    ],
  );
  if (runtimeParameterAclResult.rows.length > 0) {
    throw new Error(
      `runtime PostgreSQL parameter ACL drift for ${contract.owner_service}`,
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
  const appRoleMemberResult = await postgres.query<{
    role_name: string;
    can_login: boolean;
  }>(
    `WITH RECURSIVE app_role_members(role_oid, path) AS (
       SELECT r.oid, ARRAY[r.oid]
         FROM pg_catalog.pg_roles r
        WHERE r.rolname = $1
       UNION ALL
       SELECT m.member, app_role_members.path || m.member
         FROM pg_catalog.pg_auth_members m
         JOIN app_role_members ON app_role_members.role_oid = m.roleid
        WHERE NOT m.member = ANY(app_role_members.path)
     )
     SELECT r.rolname AS role_name, r.rolcanlogin AS can_login
       FROM app_role_members
       JOIN pg_catalog.pg_roles r ON r.oid = app_role_members.role_oid
      WHERE r.rolname <> $1
      ORDER BY r.rolname`,
    [contract.app_role],
  );
  assertSameSet(
    `${contract.app_role} reverse members`,
    appRoleMemberResult.rows.map(({ role_name }) => role_name),
    [runtimeIdentity.current_user],
  );
  if (
    appRoleMemberResult.rows.length !== 1 ||
    appRoleMemberResult.rows[0]?.can_login !== true
  ) {
    throw new Error(
      `application PostgreSQL role reverse membership drift for ${contract.owner_service}`,
    );
  }

  const otherOwnerSchemas = OWNER_DATABASE_SCHEMAS_V1.filter(
    (schema) => schema !== contract.schema,
  );
  const crossOwnerRuntimeSchemaPrivilegeResult =
    await options.runtime_postgres.query<{
      schema_name: string;
      can_use: boolean;
      can_create: boolean;
    }>(
      `SELECT n.nspname AS schema_name,
              pg_catalog.has_schema_privilege(current_user, n.oid, 'USAGE') AS can_use,
              pg_catalog.has_schema_privilege(current_user, n.oid, 'CREATE') AS can_create
         FROM pg_catalog.pg_namespace n
        WHERE n.nspname = ANY($1::text[])
        ORDER BY n.nspname`,
      [otherOwnerSchemas],
    );
  if (
    crossOwnerRuntimeSchemaPrivilegeResult.rows.some(
      ({ can_use, can_create }) => can_use || can_create,
    )
  ) {
    throw new Error(
      `cross-owner effective runtime schema privilege drift for ${contract.owner_service}`,
    );
  }

  const crossOwnerRuntimeTablePrivilegeResult =
    await options.runtime_postgres.query<{
      schema_name: string;
      relation_name: string;
      can_select: boolean;
      can_insert: boolean;
      can_update: boolean;
      can_delete: boolean;
      can_truncate: boolean;
      can_references: boolean;
      can_trigger: boolean;
    }>(
      `SELECT n.nspname AS schema_name, c.relname AS relation_name,
              pg_catalog.has_table_privilege(current_user, c.oid, 'SELECT') AS can_select,
              pg_catalog.has_table_privilege(current_user, c.oid, 'INSERT') AS can_insert,
              pg_catalog.has_table_privilege(current_user, c.oid, 'UPDATE') AS can_update,
              pg_catalog.has_table_privilege(current_user, c.oid, 'DELETE') AS can_delete,
              pg_catalog.has_table_privilege(current_user, c.oid, 'TRUNCATE') AS can_truncate,
              pg_catalog.has_table_privilege(current_user, c.oid, 'REFERENCES') AS can_references,
              pg_catalog.has_table_privilege(current_user, c.oid, 'TRIGGER') AS can_trigger
         FROM pg_catalog.pg_class c
         JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = ANY($1::text[])
          AND c.relkind IN ('r','p','v','m','f')
        ORDER BY n.nspname, c.relname`,
      [otherOwnerSchemas],
    );
  if (
    crossOwnerRuntimeTablePrivilegeResult.rows.some(
      ({
        can_select,
        can_insert,
        can_update,
        can_delete,
        can_truncate,
        can_references,
        can_trigger,
      }) =>
        can_select ||
        can_insert ||
        can_update ||
        can_delete ||
        can_truncate ||
        can_references ||
        can_trigger,
    )
  ) {
    throw new Error(
      `cross-owner effective runtime table privilege drift for ${contract.owner_service}`,
    );
  }

  const crossOwnerRuntimeColumnPrivilegeResult =
    await options.runtime_postgres.query<{
      schema_name: string;
      relation_name: string;
      column_name: string;
      can_select: boolean;
      can_insert: boolean;
      can_update: boolean;
      can_references: boolean;
    }>(
      `SELECT n.nspname AS schema_name, c.relname AS relation_name,
              a.attname AS column_name,
              pg_catalog.has_column_privilege(current_user, c.oid, a.attnum, 'SELECT') AS can_select,
              pg_catalog.has_column_privilege(current_user, c.oid, a.attnum, 'INSERT') AS can_insert,
              pg_catalog.has_column_privilege(current_user, c.oid, a.attnum, 'UPDATE') AS can_update,
              pg_catalog.has_column_privilege(current_user, c.oid, a.attnum, 'REFERENCES') AS can_references
         FROM pg_catalog.pg_class c
         JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
         JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid
        WHERE n.nspname = ANY($1::text[])
          AND c.relkind IN ('r','p','v','m','f')
          AND a.attnum > 0
          AND NOT a.attisdropped
        ORDER BY n.nspname, c.relname, a.attnum`,
      [otherOwnerSchemas],
    );
  if (
    crossOwnerRuntimeColumnPrivilegeResult.rows.some(
      ({ can_select, can_insert, can_update, can_references }) =>
        can_select || can_insert || can_update || can_references,
    )
  ) {
    throw new Error(
      `cross-owner effective runtime column privilege drift for ${contract.owner_service}`,
    );
  }

  const crossOwnerRuntimeFunctionPrivilegeResult =
    await options.runtime_postgres.query<{
      schema_name: string;
      function_name: string;
      can_execute: boolean;
    }>(
      `SELECT n.nspname AS schema_name, p.proname AS function_name,
              pg_catalog.has_function_privilege(current_user, p.oid, 'EXECUTE') AS can_execute
         FROM pg_catalog.pg_proc p
         JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = ANY($1::text[])
        ORDER BY n.nspname, p.proname, p.oid`,
      [otherOwnerSchemas],
    );
  if (
    crossOwnerRuntimeFunctionPrivilegeResult.rows.some(
      ({ can_execute }) => can_execute,
    )
  ) {
    throw new Error(
      `cross-owner effective runtime function privilege drift for ${contract.owner_service}`,
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
    relation_kind: string;
    row_security_enabled: boolean;
    force_row_security: boolean;
    is_partition: boolean;
    relation_persistence: string;
  }>(
    `SELECT c.relname AS table_name,
            pg_catalog.pg_get_userbyid(c.relowner) AS table_owner,
            c.relkind::text AS relation_kind,
            c.relrowsecurity AS row_security_enabled,
            c.relforcerowsecurity AS force_row_security,
            c.relispartition AS is_partition,
            c.relpersistence::text AS relation_persistence
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
  if (
    tableOwnerResult.rows.some(
      ({
        relation_kind,
        row_security_enabled,
        force_row_security,
        is_partition,
        relation_persistence,
      }) =>
        relation_kind !== "r" ||
        relation_persistence !== "p" ||
        row_security_enabled ||
        force_row_security ||
        is_partition,
    )
  ) {
    throw new Error(
      `PostgreSQL relation execution semantics drift for ${contract.schema}`,
    );
  }

  const rowSecurityPolicyResult = await postgres.query<{
    table_name: string;
    policy_name: string;
  }>(
    `SELECT c.relname AS table_name, p.polname AS policy_name
       FROM pg_catalog.pg_policy p
       JOIN pg_catalog.pg_class c ON c.oid = p.polrelid
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1
      ORDER BY c.relname, p.polname`,
    [contract.schema],
  );
  if (rowSecurityPolicyResult.rows.length > 0) {
    throw new Error(
      `PostgreSQL RLS policy drift for ${contract.schema}: ${rowSecurityPolicyResult.rows
        .map(({ table_name, policy_name }) => `${table_name}.${policy_name}`)
        .join(", ")}`,
    );
  }

  const inheritanceResult = await postgres.query<{
    child_schema: string;
    child_table: string;
    parent_schema: string;
    parent_table: string;
  }>(
    `SELECT child_namespace.nspname AS child_schema,
            child.relname AS child_table,
            parent_namespace.nspname AS parent_schema,
            parent.relname AS parent_table
       FROM pg_catalog.pg_inherits inherits
       JOIN pg_catalog.pg_class child ON child.oid = inherits.inhrelid
       JOIN pg_catalog.pg_namespace child_namespace
         ON child_namespace.oid = child.relnamespace
       JOIN pg_catalog.pg_class parent ON parent.oid = inherits.inhparent
       JOIN pg_catalog.pg_namespace parent_namespace
         ON parent_namespace.oid = parent.relnamespace
      WHERE child_namespace.nspname = $1 OR parent_namespace.nspname = $1
      ORDER BY child_namespace.nspname, child.relname,
               parent_namespace.nspname, parent.relname`,
    [contract.schema],
  );
  if (inheritanceResult.rows.length > 0) {
    throw new Error(
      `PostgreSQL inheritance or partition drift for ${contract.schema}: ${inheritanceResult.rows
        .map(
          ({ child_schema, child_table, parent_schema, parent_table }) =>
            `${child_schema}.${child_table}->${parent_schema}.${parent_table}`,
        )
        .join(", ")}`,
    );
  }

  const columnResult = await postgres.query<{
    table_name: string;
    column_name: string;
    postgres_type: string;
    type_schema: string;
    not_null: boolean;
    default_expression: string | null;
    identity: OwnerDatabaseColumnV1["identity"];
    generated: OwnerDatabaseColumnV1["generated"];
  }>(
    `SELECT c.relname AS table_name, a.attname AS column_name,
            pg_catalog.format_type(a.atttypid, a.atttypmod) AS postgres_type,
            type_namespace.nspname AS type_schema,
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
       JOIN pg_catalog.pg_type attribute_type ON attribute_type.oid = a.atttypid
       JOIN pg_catalog.pg_namespace type_namespace ON type_namespace.oid = attribute_type.typnamespace
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
  // Physical columns are verified exhaustively against database_columns below.
  // select_columns is intentionally only the app_role-readable subset so
  // internal lease and claim-token columns never need a direct SELECT grant.
  for (const permission of contract.table_permissions) {
    for (const column of permission.select_columns) {
      if (!observedColumns.has(`${permission.table_name}.${column}`)) {
        throw new Error(`PostgreSQL column missing: ${permission.table_name}.${column}`);
      }
    }
  }
  const columnSnapshot = (
    row: OwnerDatabaseColumnV1 | (typeof columnResult.rows)[number],
  ): string => {
    const typeSchema = "type_schema" in row ? row.type_schema : undefined;
    const postgresType =
      typeSchema === undefined ||
      typeSchema === "pg_catalog" ||
      row.postgres_type.startsWith(`${typeSchema}.`) ||
      row.postgres_type.startsWith(`"${typeSchema}".`)
        ? row.postgres_type
        : `${typeSchema}.${row.postgres_type}`;
    return `${row.table_name}.${row.column_name}:${postgresType}:not_null=${row.not_null}:default=${row.default_expression ?? ""}:identity=${row.identity}:generated=${row.generated}`;
  };
  assertSameSet(
    `${contract.schema} database columns`,
    columnResult.rows.map(columnSnapshot),
    contract.database_columns.map(columnSnapshot),
  );

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
       CROSS JOIN LATERAL pg_catalog.aclexplode(a.attacl) acl
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
    enabled_mode: string;
    trigger_type: number;
    trigger_argument_count: number;
    update_columns: string;
    constraint_trigger: boolean;
    has_when_clause: boolean;
    has_old_transition_table: boolean;
    has_new_transition_table: boolean;
    function_schema: string;
    function_name: string;
  }>(
    `SELECT c.relname AS table_name,
            t.tgname AS trigger_name,
            t.tgenabled::text AS enabled_mode,
            t.tgtype::integer AS trigger_type,
            t.tgnargs::integer AS trigger_argument_count,
            t.tgattr::text AS update_columns,
            t.tgconstraint <> 0::oid AS constraint_trigger,
            t.tgqual IS NOT NULL AS has_when_clause,
            t.tgoldtable IS NOT NULL AS has_old_transition_table,
            t.tgnewtable IS NOT NULL AS has_new_transition_table,
            function_namespace.nspname AS function_schema,
            fn.proname AS function_name
       FROM pg_catalog.pg_trigger t
       JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_catalog.pg_proc fn ON fn.oid = t.tgfoid
       JOIN pg_catalog.pg_namespace function_namespace
         ON function_namespace.oid = fn.pronamespace
      WHERE n.nspname = $1
        AND NOT t.tgisinternal`,
    [contract.schema],
  );
  const expectedImmutableTriggers = contract.immutable_triggers ?? [];
  const expectedDatabaseTriggers = contract.database_triggers ?? [];
  const expectedTriggers = [
    ...expectedImmutableTriggers,
    ...expectedDatabaseTriggers,
  ];
  assertSameSet(
    `${contract.schema} immutable triggers`,
    triggerResult.rows.map(
      ({ table_name, trigger_name }) => `${table_name}.${trigger_name}`,
    ),
    expectedTriggers.map(
      ({ table_name, trigger_name }) => `${table_name}.${trigger_name}`,
    ),
  );
  for (const expected of expectedImmutableTriggers) {
    const deployed = triggerResult.rows.find(
      ({ table_name, trigger_name }) =>
        table_name === expected.table_name &&
        trigger_name === expected.trigger_name,
    );
    if (
      deployed === undefined ||
      deployed.enabled_mode !== "O" ||
      deployed.trigger_type !== 27 ||
      deployed.trigger_argument_count !== 0 ||
      deployed.update_columns !== "" ||
      deployed.constraint_trigger ||
      deployed.has_when_clause ||
      deployed.has_old_transition_table ||
      deployed.has_new_transition_table ||
      deployed.function_schema !== contract.schema ||
      deployed.function_name !== expected.function_name
    ) {
      throw new Error(
        `PostgreSQL immutable trigger drift: ${contract.schema}.${expected.table_name}.${expected.trigger_name}`,
      );
    }
  }
  for (const expected of expectedDatabaseTriggers) {
    const deployed = triggerResult.rows.find(
      ({ table_name, trigger_name }) =>
        table_name === expected.table_name &&
        trigger_name === expected.trigger_name,
    );
    if (
      deployed === undefined ||
      deployed.enabled_mode !== expected.enabled_mode ||
      deployed.trigger_type !== expected.trigger_type ||
      deployed.trigger_argument_count !== expected.trigger_argument_count ||
      deployed.update_columns !== expected.update_columns ||
      deployed.constraint_trigger !== expected.constraint_trigger ||
      deployed.has_when_clause !== expected.has_when_clause ||
      deployed.has_old_transition_table !== expected.has_old_transition_table ||
      deployed.has_new_transition_table !== expected.has_new_transition_table ||
      deployed.function_schema !== expected.function_schema ||
      deployed.function_name !== expected.function_name
    ) {
      throw new Error(
        `PostgreSQL database trigger drift: ${contract.schema}.${expected.table_name}.${expected.trigger_name}`,
      );
    }
  }

  const functionResult = await postgres.query<{
    oid: string;
    function_name: string;
    function_owner: string;
    security_definer: boolean;
    settings: string[] | null;
    strict: boolean;
    volatility: string;
    parallel_safety: string;
    leakproof: boolean;
    function_kind: string;
    default_argument_count: number;
    identity_arguments: string;
    argument_names: string[] | null;
    argument_types: string[] | null;
    returns_set: boolean;
    result_type: string;
    language_name: string;
    function_definition: string;
    function_source: string;
  }>(
    `SELECT p.oid::text AS oid, p.proname AS function_name,
            pg_get_userbyid(p.proowner) AS function_owner,
            p.prosecdef AS security_definer, p.proconfig AS settings,
            p.proisstrict AS strict,
            p.provolatile::text AS volatility,
            p.proparallel::text AS parallel_safety,
            p.proleakproof AS leakproof,
            p.prokind::text AS function_kind,
            p.pronargdefaults AS default_argument_count,
            pg_catalog.pg_get_function_identity_arguments(p.oid) AS identity_arguments,
            p.proargnames AS argument_names,
            CASE WHEN p.pronargs = 0 THEN ARRAY[]::text[]
                 ELSE string_to_array(pg_catalog.oidvectortypes(p.proargtypes), ', ')
            END AS argument_types,
            p.proretset AS returns_set,
            pg_catalog.format_type(p.prorettype, NULL) AS result_type,
            language.lanname AS language_name,
            pg_catalog.pg_get_functiondef(p.oid) AS function_definition,
            p.prosrc AS function_source
       FROM pg_catalog.pg_proc p
       JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
       JOIN pg_catalog.pg_language language ON language.oid = p.prolang
      WHERE n.nspname = $1`,
    [contract.schema],
  );
  const postgresType = (type: OwnerPostgresTypeV1): string =>
    type === "timestamptz" ? "timestamp with time zone" : type;
  const immutableTriggerFunctions = [
    ...new Set(
      expectedImmutableTriggers.map(({ function_name }) => function_name),
    ),
  ];
  const databaseTriggerFunctions = [
    ...new Set(
      expectedDatabaseTriggers.map(({ function_name }) => function_name),
    ),
  ];
  const expectedDatabaseFunctions = contract.database_functions ?? [];
  assertSameSet(
    `${contract.schema} owner functions`,
    functionResult.rows.map(({ function_name }) => function_name),
    [
      ...contract.mutable_writers,
      ...immutableTriggerFunctions,
      ...databaseTriggerFunctions,
      ...expectedDatabaseFunctions.map(({ function_name }) => function_name),
    ],
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
      deployed.strict ||
      deployed.volatility !== "v" ||
      deployed.parallel_safety !== "u" ||
      deployed.leakproof ||
      deployed.function_kind !== "f" ||
      deployed.default_argument_count !== 0 ||
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
    verifyOwnerWriterSourceV1(contract, signature, deployed.function_source);
  }
  for (const functionName of immutableTriggerFunctions) {
    const deployed = functionResult.rows.find(
      ({ function_name }) => function_name === functionName,
    );
    const expected = expectedImmutableTriggers.find(
      ({ function_name }) => function_name === functionName,
    );
    const expectedSettings = `search_path=${contract.schema}, pg_temp`;
    if (
      deployed === undefined ||
      expected === undefined ||
      deployed.function_owner !== options.expected_schema_owner ||
      deployed.security_definer !== true ||
      deployed.strict ||
      deployed.volatility !== "v" ||
      deployed.parallel_safety !== "u" ||
      deployed.leakproof ||
      deployed.function_kind !== "f" ||
      deployed.default_argument_count !== 0 ||
      JSON.stringify(deployed.settings ?? []) !==
        JSON.stringify([expectedSettings]) ||
      deployed.identity_arguments !== "" ||
      (deployed.argument_names !== null &&
        deployed.argument_names.length !== 0) ||
      (deployed.argument_types !== null &&
        deployed.argument_types.length !== 0) ||
      deployed.returns_set ||
      deployed.result_type !== "trigger" ||
      deployed.language_name !== "plpgsql" ||
      writerSourceSha256(deployed.function_source) !==
        expected.function_body_sha256
    ) {
      throw new Error(
        `PostgreSQL immutable trigger function drift: ${contract.schema}.${functionName}`,
      );
    }
    assertImmutableTriggerFunctionSourceV1(deployed.function_source);
  }
  for (const functionName of databaseTriggerFunctions) {
    const deployed = functionResult.rows.find(
      ({ function_name }) => function_name === functionName,
    );
    const expected = expectedDatabaseTriggers.find(
      ({ function_name }) => function_name === functionName,
    );
    if (
      deployed === undefined ||
      expected === undefined ||
      deployed.function_owner !== options.expected_schema_owner ||
      deployed.security_definer !== expected.security_definer ||
      deployed.strict ||
      deployed.volatility !== "v" ||
      deployed.parallel_safety !== "u" ||
      deployed.leakproof ||
      deployed.function_kind !== "f" ||
      deployed.default_argument_count !== 0 ||
      JSON.stringify(deployed.settings) !== JSON.stringify(expected.settings) ||
      deployed.identity_arguments !== "" ||
      (deployed.argument_names !== null && deployed.argument_names.length !== 0) ||
      (deployed.argument_types !== null && deployed.argument_types.length !== 0) ||
      deployed.returns_set ||
      deployed.result_type !== "trigger" ||
      deployed.language_name !== expected.language_name ||
      writerSourceSha256(deployed.function_source) !==
        expected.function_body_sha256
    ) {
      throw new Error(
        `PostgreSQL database trigger function drift: ${contract.schema}.${functionName}`,
      );
    }
  }
  for (const expected of expectedDatabaseFunctions) {
    const deployed = functionResult.rows.find(
      ({ function_name }) => function_name === expected.function_name,
    );
    if (
      deployed === undefined ||
      deployed.function_owner !== options.expected_schema_owner ||
      deployed.security_definer !== expected.security_definer ||
      JSON.stringify(deployed.settings) !== JSON.stringify(expected.settings) ||
      deployed.strict !== expected.strict ||
      deployed.volatility !== expected.volatility ||
      deployed.parallel_safety !== expected.parallel_safety ||
      deployed.leakproof !== expected.leakproof ||
      deployed.function_kind !== expected.function_kind ||
      deployed.default_argument_count !== expected.default_argument_count ||
      deployed.identity_arguments !== expected.identity_arguments ||
      JSON.stringify(deployed.argument_names) !==
        JSON.stringify(expected.argument_names) ||
      JSON.stringify(deployed.argument_types) !==
        JSON.stringify(expected.argument_types) ||
      deployed.returns_set !== expected.returns_set ||
      deployed.result_type !== expected.result_type ||
      deployed.language_name !== expected.language_name ||
      writerSourceSha256(deployed.function_source) !==
        expected.function_body_sha256
    ) {
      throw new Error(
        `PostgreSQL private function drift: ${contract.schema}.${expected.function_name}`,
      );
    }
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

  const defaultPrivilegeResult = await postgres.query<{
    namespace_name: string;
    object_type: string;
    grantee: string;
    privilege_type: string;
  }>(
    `WITH owner_role AS (
       SELECT r.oid AS role_oid, r.rolname AS role_name
         FROM pg_catalog.pg_roles r
        WHERE r.rolname = $1
     ), object_types(object_type) AS (
       VALUES ('r'::"char"), ('S'::"char"), ('f'::"char")
     ), effective_defaults(namespace_name, object_type, owner_oid, acl_items) AS (
       SELECT 'GLOBAL'::text, object_types.object_type, owner_role.role_oid,
              COALESCE(default_acl.defaclacl,
                       pg_catalog.acldefault(object_types.object_type, owner_role.role_oid))
         FROM owner_role
         CROSS JOIN object_types
         LEFT JOIN pg_catalog.pg_default_acl default_acl
           ON default_acl.defaclrole = owner_role.role_oid
          AND default_acl.defaclnamespace = 0
          AND default_acl.defaclobjtype = object_types.object_type
       UNION ALL
       SELECT namespace.nspname, default_acl.defaclobjtype,
              owner_role.role_oid, default_acl.defaclacl
         FROM owner_role
         JOIN pg_catalog.pg_default_acl default_acl
           ON default_acl.defaclrole = owner_role.role_oid
          AND default_acl.defaclnamespace <> 0
         JOIN pg_catalog.pg_namespace namespace
           ON namespace.oid = default_acl.defaclnamespace
        WHERE namespace.nspname = $2
          AND default_acl.defaclobjtype IN ('r','S','f')
     )
     SELECT defaults.namespace_name,
            defaults.object_type::text AS object_type,
            COALESCE(grantee.rolname, 'PUBLIC') AS grantee,
            acl.privilege_type
       FROM effective_defaults defaults
       CROSS JOIN LATERAL pg_catalog.aclexplode(defaults.acl_items) acl
       LEFT JOIN pg_catalog.pg_roles grantee ON grantee.oid = acl.grantee
      ORDER BY defaults.namespace_name, defaults.object_type, grantee, acl.privilege_type`,
    [options.expected_schema_owner, contract.schema],
  );
  if (
    defaultPrivilegeResult.rows.some(
      ({ grantee }) => grantee !== options.expected_schema_owner,
    )
  ) {
    throw new Error(
      `default privilege drift for ${options.expected_schema_owner} in ${contract.schema}`,
    );
  }

  const sequenceOwnerResult = await postgres.query<{
    sequence_name: string;
    sequence_owner: string;
    relation_persistence: string;
  }>(
    `SELECT c.relname AS sequence_name,
            pg_catalog.pg_get_userbyid(c.relowner) AS sequence_owner,
            c.relpersistence::text AS relation_persistence
       FROM pg_catalog.pg_class c
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1 AND c.relkind = 'S'
      ORDER BY c.relname`,
    [contract.schema],
  );
  if (
    sequenceOwnerResult.rows.some(
      ({ sequence_owner, relation_persistence }) =>
        sequence_owner !== options.expected_schema_owner ||
        relation_persistence !== "p",
    )
  ) {
    throw new Error(`sequence owner drift for ${contract.schema}`);
  }

  const sequenceAclResult = await postgres.query<{
    sequence_name: string;
    grantee: string;
    privilege_type: string;
  }>(
    `SELECT c.relname AS sequence_name,
            COALESCE(r.rolname, 'PUBLIC') AS grantee,
            acl.privilege_type
       FROM pg_catalog.pg_class c
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       CROSS JOIN LATERAL pg_catalog.aclexplode(
         COALESCE(c.relacl, pg_catalog.acldefault('S', c.relowner))
       ) acl
       LEFT JOIN pg_catalog.pg_roles r ON r.oid = acl.grantee
      WHERE n.nspname = $1 AND c.relkind = 'S'
      ORDER BY c.relname, grantee, acl.privilege_type`,
    [contract.schema],
  );
  if (
    sequenceAclResult.rows.some(
      ({ grantee }) => grantee !== options.expected_schema_owner,
    )
  ) {
    throw new Error(`sequence privilege drift for ${contract.schema}`);
  }

  const runtimeSequencePrivilegeResult =
    await options.runtime_postgres.query<{
      schema_name: string;
      sequence_name: string;
      can_usage: boolean;
      can_select: boolean;
      can_update: boolean;
    }>(
      `SELECT n.nspname AS schema_name, c.relname AS sequence_name,
              pg_catalog.has_sequence_privilege(current_user, c.oid, 'USAGE') AS can_usage,
              pg_catalog.has_sequence_privilege(current_user, c.oid, 'SELECT') AS can_select,
              pg_catalog.has_sequence_privilege(current_user, c.oid, 'UPDATE') AS can_update
         FROM pg_catalog.pg_class c
         JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = $1 AND c.relkind = 'S'
        ORDER BY c.relname`,
      [contract.schema],
    );
  if (
    runtimeSequencePrivilegeResult.rows.some(
      ({ can_usage, can_select, can_update }) =>
        can_usage || can_select || can_update,
    )
  ) {
    throw new Error(
      `effective runtime sequence privilege drift for ${contract.schema}`,
    );
  }

  const crossOwnerRuntimeSequencePrivilegeResult =
    await options.runtime_postgres.query<{
      schema_name: string;
      sequence_name: string;
      can_usage: boolean;
      can_select: boolean;
      can_update: boolean;
    }>(
      `SELECT n.nspname AS schema_name, c.relname AS sequence_name,
              pg_catalog.has_sequence_privilege(current_user, c.oid, 'USAGE') AS can_usage,
              pg_catalog.has_sequence_privilege(current_user, c.oid, 'SELECT') AS can_select,
              pg_catalog.has_sequence_privilege(current_user, c.oid, 'UPDATE') AS can_update
         FROM pg_catalog.pg_class c
         JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = ANY($1::text[])
          AND c.relkind = 'S'
        ORDER BY n.nspname, c.relname`,
      [otherOwnerSchemas],
    );
  if (
    crossOwnerRuntimeSequencePrivilegeResult.rows.some(
      ({ can_usage, can_select, can_update }) =>
        can_usage || can_select || can_update,
    )
  ) {
    throw new Error(
      `cross-owner effective runtime sequence privilege drift for ${contract.owner_service}`,
    );
  }

  const inboundForeignKeyResult = await postgres.query<{
    source_schema: string;
    constraint_name: string;
    source_table: string;
    referenced_table: string;
  }>(
    `SELECT src_namespace.nspname AS source_schema,
            con.conname AS constraint_name,
            src.relname AS source_table,
            dst.relname AS referenced_table
       FROM pg_catalog.pg_constraint con
       JOIN pg_catalog.pg_class src ON src.oid = con.conrelid
       JOIN pg_catalog.pg_namespace src_namespace
         ON src_namespace.oid = src.relnamespace
       JOIN pg_catalog.pg_class dst ON dst.oid = con.confrelid
       JOIN pg_catalog.pg_namespace dst_namespace
         ON dst_namespace.oid = dst.relnamespace
      WHERE con.contype = 'f'
        AND dst_namespace.nspname = $1
        AND src_namespace.nspname <> $1
      ORDER BY source_schema, source_table, constraint_name`,
    [contract.schema],
  );
  if (inboundForeignKeyResult.rows.length > 0) {
    throw new Error(
      `undeclared inbound PostgreSQL foreign key drift for ${contract.schema}`,
    );
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

  const foreignKeyTriggerResult = await postgres.query<{
    constraint_name: string;
    table_name: string;
    referenced_table: string;
    trigger_name: string;
    trigger_relation: string;
    function_schema: string;
    function_name: string;
    enabled_mode: string;
  }>(
    `SELECT con.conname AS constraint_name,
            src.relname AS table_name,
            dst.relname AS referenced_table,
            t.tgname::text AS trigger_name,
            trigger_relation.relname AS trigger_relation,
            function_namespace.nspname AS function_schema,
            function.proname AS function_name,
            t.tgenabled::text AS enabled_mode
       FROM pg_catalog.pg_constraint con
       JOIN pg_catalog.pg_class src ON src.oid = con.conrelid
       JOIN pg_catalog.pg_class dst ON dst.oid = con.confrelid
       JOIN pg_catalog.pg_namespace n ON n.oid = src.relnamespace
       JOIN pg_catalog.pg_trigger t ON t.tgconstraint = con.oid
        AND t.tgisinternal
       JOIN pg_catalog.pg_class trigger_relation ON trigger_relation.oid = t.tgrelid
       JOIN pg_catalog.pg_proc function ON function.oid = t.tgfoid
       JOIN pg_catalog.pg_namespace function_namespace
         ON function_namespace.oid = function.pronamespace
      WHERE n.nspname = $1 AND con.contype = 'f'
      ORDER BY src.relname, con.conname, trigger_relation.relname, function.proname`,
    [contract.schema],
  );
  const foreignKeyActionFunction = (
    action: OwnerForeignKeyV1["on_update"] | OwnerForeignKeyV1["on_delete"],
    suffix: "upd" | "del",
  ): string =>
    `RI_FKey_${
      {
        no_action: "noaction",
        restrict: "restrict",
        cascade: "cascade",
        set_null: "setnull",
        set_default: "setdefault",
      }[action]
    }_${suffix}`;
  for (const foreignKey of foreignKeyResult.rows) {
    const triggers = foreignKeyTriggerResult.rows.filter(
      ({ constraint_name, table_name }) =>
        constraint_name === foreignKey.constraint_name &&
        table_name === foreignKey.table_name,
    );
    const expectedIdentities = [
      `${foreignKey.table_name}:RI_FKey_check_ins`,
      `${foreignKey.table_name}:RI_FKey_check_upd`,
      `${foreignKey.referenced_table}:${foreignKeyActionFunction(foreignKey.on_delete, "del")}`,
      `${foreignKey.referenced_table}:${foreignKeyActionFunction(foreignKey.on_update, "upd")}`,
    ];
    const observedIdentities = triggers.map(
      ({ trigger_relation, function_name }) =>
        `${trigger_relation}:${function_name}`,
    );
    if (
      triggers.length !== 4 ||
      triggers.some(
        ({ enabled_mode, function_schema }) =>
          enabled_mode !== "O" || function_schema !== "pg_catalog",
      ) ||
      fingerprint([...observedIdentities].sort()) !==
        fingerprint([...expectedIdentities].sort())
    ) {
      throw new Error(
        `PostgreSQL FK trigger enforcement drift for ${contract.schema}.${foreignKey.constraint_name}`,
      );
    }
  }

  const ownerInternalForeignKeyTriggerResult = await postgres.query<{
    source_schema: string;
    constraint_name: string;
    trigger_relation: string;
    trigger_name: string;
    function_schema: string;
    function_name: string;
    enabled_mode: string;
  }>(
    `SELECT source_namespace.nspname AS source_schema,
            con.conname AS constraint_name,
            trigger_relation.relname AS trigger_relation,
            trigger.tgname::text AS trigger_name,
            function_namespace.nspname AS function_schema,
            function.proname AS function_name,
            trigger.tgenabled::text AS enabled_mode
       FROM pg_catalog.pg_trigger trigger
       JOIN pg_catalog.pg_class trigger_relation
         ON trigger_relation.oid = trigger.tgrelid
       JOIN pg_catalog.pg_namespace trigger_namespace
         ON trigger_namespace.oid = trigger_relation.relnamespace
       JOIN pg_catalog.pg_constraint con ON con.oid = trigger.tgconstraint
       JOIN pg_catalog.pg_class source_relation ON source_relation.oid = con.conrelid
       JOIN pg_catalog.pg_namespace source_namespace
         ON source_namespace.oid = source_relation.relnamespace
       JOIN pg_catalog.pg_proc function ON function.oid = trigger.tgfoid
       JOIN pg_catalog.pg_namespace function_namespace
         ON function_namespace.oid = function.pronamespace
      WHERE trigger_namespace.nspname = $1
        AND trigger.tgisinternal
        AND con.contype = 'f'
      ORDER BY source_schema, constraint_name, trigger_relation, trigger_name`,
    [contract.schema],
  );
  const internalTriggerIdentity = (row: {
    readonly source_schema: string;
    readonly constraint_name: string;
    readonly trigger_relation: string;
    readonly trigger_name: string;
    readonly function_schema: string;
    readonly function_name: string;
    readonly enabled_mode: string;
  }): string =>
    [
      row.source_schema,
      row.constraint_name,
      row.trigger_relation,
      row.trigger_name,
      row.function_schema,
      row.function_name,
      row.enabled_mode,
    ].join(":");
  assertSameSet(
    `${contract.schema} owner-side internal foreign-key triggers`,
    ownerInternalForeignKeyTriggerResult.rows.map(internalTriggerIdentity),
    foreignKeyTriggerResult.rows
      .filter(({ trigger_relation }) => contract.tables.includes(trigger_relation))
      .map((row) =>
        internalTriggerIdentity({
          source_schema: contract.schema,
          constraint_name: row.constraint_name,
          trigger_relation: row.trigger_relation,
          trigger_name: row.trigger_name,
          function_schema: row.function_schema,
          function_name: row.function_name,
          enabled_mode: row.enabled_mode,
        }),
      ),
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
  assertSameSet(
    `${contract.schema} unique constraints`,
    uniqueConstraintResult.rows.map(uniqueSnapshot),
    contract.database_unique_constraints.map(uniqueSnapshot),
  );

  const indexResult = await postgres.query<{
    index_name: string;
    table_name: string;
    definition: string;
    unique: boolean;
    primary: boolean;
    valid: boolean;
    relation_persistence: string;
  }>(
    `SELECT idx.relname AS index_name,
            tab.relname AS table_name,
            pg_catalog.pg_get_indexdef(idx.oid) AS definition,
            i.indisunique AS unique,
            i.indisprimary AS primary,
            i.indisvalid AS valid,
            idx.relpersistence::text AS relation_persistence
       FROM pg_catalog.pg_index i
       JOIN pg_catalog.pg_class idx ON idx.oid = i.indexrelid
       JOIN pg_catalog.pg_class tab ON tab.oid = i.indrelid
       JOIN pg_catalog.pg_namespace n ON n.oid = tab.relnamespace
      WHERE n.nspname = $1
      ORDER BY tab.relname, idx.relname`,
    [contract.schema],
  );
  const indexSnapshot = (
    row: OwnerDatabaseIndexV1 | (typeof indexResult.rows)[number],
  ): string =>
    `${row.index_name}:${row.table_name}:unique=${row.unique}:primary=${row.primary}:valid=${row.valid}:definition=${stableOwnerIndexDefinitionV1(row.definition)}`;
  assertSameSet(
    `${contract.schema} database indexes`,
    indexResult.rows.map(indexSnapshot),
    contract.database_indexes.map(indexSnapshot),
  );
  if (
    indexResult.rows.some(
      ({ relation_persistence }) => relation_persistence !== "p",
    )
  ) {
    throw new Error(`PostgreSQL index persistence drift for ${contract.schema}`);
  }

  const checkConstraintResult = await postgres.query<{
    constraint_name: string;
    table_name: string;
    definition: string;
    validated: boolean;
  }>(
    `SELECT con.conname AS constraint_name, c.relname AS table_name,
            pg_catalog.pg_get_constraintdef(con.oid, true) AS definition,
            con.convalidated AS validated
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
    if (observed === undefined || !observed.validated) {
      throw new Error(
        `PostgreSQL CHECK constraint drift: ${expectation.table_name}.${expectation.constraint_name}`,
      );
    }
    verifyOwnerDatabaseCheckDefinitionV1(expectation, observed.definition);
  }
  assertSameSet(
    `${contract.schema} CHECK constraints`,
    checkConstraintResult.rows.map(
      ({ constraint_name, table_name }) => `${table_name}.${constraint_name}`,
    ),
    (contract.database_checks ?? []).map(
      ({ constraint_name, table_name }) => `${table_name}.${constraint_name}`,
    ),
  );

  const contractFingerprint = fingerprint(contract);
  const databaseFingerprint = fingerprint({
    schema: schemaResult.rows,
    schema_owner_role: schemaOwnerRoleResult.rows,
    schema_owner_inherited_roles: schemaOwnerInheritedRoleResult.rows,
    schema_owner_reverse_membership: schemaOwnerMemberResult.rows,
    schema_owner_reverse_membership_options:
      schemaOwnerMembershipOptionsResult.rows,
    app_role: appRoleResult.rows,
    columns: columnResult.rows,
    table_owners: tableOwnerResult.rows,
    row_security_policies: rowSecurityPolicyResult.rows,
    inheritance: inheritanceResult.rows,
    runtime_identity: runtimeIdentityResult.rows,
    runtime_membership: runtimeMembershipResult.rows,
    runtime_membership_options: runtimeMembershipOptionsResult.rows,
    app_role_reverse_membership: appRoleMemberResult.rows,
    cross_owner_runtime_schema_privileges:
      crossOwnerRuntimeSchemaPrivilegeResult.rows,
    cross_owner_runtime_table_privileges:
      crossOwnerRuntimeTablePrivilegeResult.rows,
    cross_owner_runtime_column_privileges:
      crossOwnerRuntimeColumnPrivilegeResult.rows,
    cross_owner_runtime_function_privileges:
      crossOwnerRuntimeFunctionPrivilegeResult.rows,
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
    runtime_gucs: runtimeGucResult.rows,
    runtime_guc_defaults: runtimeGucDefaultResult.rows,
    runtime_parameter_acl: runtimeParameterAclResult.rows,
    default_privileges: defaultPrivilegeResult.rows,
    sequence_owners: sequenceOwnerResult.rows,
    sequence_acl: sequenceAclResult.rows,
    runtime_sequence_privileges: runtimeSequencePrivilegeResult.rows,
    cross_owner_runtime_sequence_privileges:
      crossOwnerRuntimeSequencePrivilegeResult.rows,
    foreign_keys: foreignKeyResult.rows,
    inbound_foreign_keys: inboundForeignKeyResult.rows,
    foreign_key_triggers: foreignKeyTriggerResult.rows,
    owner_internal_foreign_key_triggers:
      ownerInternalForeignKeyTriggerResult.rows,
    unique_constraints: uniqueConstraintResult.rows,
    indexes: indexResult.rows,
    check_constraints: checkConstraintResult.rows,
    database_identity: catalogDatabaseIdentity,
  });
  const deployment = Object.freeze({
    owner_service: contract.owner_service,
    verified_at: new Date().toISOString(),
    contract_fingerprint: contractFingerprint,
    database_fingerprint: databaseFingerprint,
    [verifiedOwnerDeploymentBrand]: true,
  }) as VerifiedOwnerRepositoryDeploymentV1<TContract["owner_service"]>;
  verifiedOwnerDeploymentBindingsV1.set(deployment, {
    catalog_postgres: postgres,
    runtime_postgres: options.runtime_postgres,
    contract_fingerprint: contractFingerprint,
    database_fingerprint: databaseFingerprint,
  });
  return deployment;
}

/**
 * Converts a verified read-only proof into an executable capability only for
 * the Pool created and retained by this module's composition factory. Keeping
 * this operation private prevents nominal `instanceof Pool` lookalikes from
 * turning caller-reported catalog rows into writer authority.
 */
function activateOwnerRepositoryDeploymentForCompositionV1<
  TService extends OwnerDatabaseServiceIdV1,
>(
  deployment: VerifiedOwnerRepositoryDeploymentV1<TService>,
  pool: Pool,
): void {
  const binding = verifiedOwnerDeploymentBindingsV1.get(deployment);
  if (
    binding === undefined ||
    binding.catalog_postgres !== pool ||
    binding.runtime_postgres !== pool ||
    binding.contract_fingerprint !== deployment.contract_fingerprint ||
    binding.database_fingerprint !== deployment.database_fingerprint
  ) {
    throw new Error(
      `verified deployment proof cannot be activated for ${deployment.owner_service}`,
    );
  }
  verifiedOwnerDeploymentBindingsV1.set(deployment, {
    ...binding,
    activation_pool: pool,
  });
}

export interface VerifiedOwnerPostgresCompositionV1<
  TContract extends OwnerRepositoryContractV1,
> {
  readonly deployment: VerifiedOwnerRepositoryDeploymentV1<
    TContract["owner_service"]
  >;
  readonly postgres: PostgresQueryPortV1;
  readonly read_committed_postgres:
    PostgresReadCommittedTransactionPortV1;
  readonly repository: OwnerRepositoryPortV1<TContract>;
  readonly outbox: OwnerOutboxStorePortV1<TContract["owner_service"]>;
  readonly unit_of_work: OwnerUnitOfWorkPortV1<
    TContract["owner_service"],
    Readonly<{ owner: OwnerRepositoryPortV1<TContract> }>
  >;
  readonly checkReadiness: (signal: AbortSignal) => Promise<void>;
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

export type OwnerPostgresTransportSecurityV1 = "local" | "tls_verified";
const OWNER_POSTGRES_CONNECTION_TIMEOUT_MS_V1 = 5_000;
/**
 * Catalog attestation validates the complete durable owner contract at boot
 * and on every readiness probe. A five-second statement deadline is shorter
 * than a cold concurrent local production composition can legitimately take.
 * Keep the verification fail-closed, but leave bounded time below the service
 * readiness deadline (30 seconds in the local deployment composition).
 */
export const OWNER_POSTGRES_CATALOG_STATEMENT_TIMEOUT_MS_V1 = 25_000;

/**
 * Explicit, narrowly-scoped exception for the local Docker composition.  It
 * never treats arbitrary DNS as local: only the fixed Compose `postgres`
 * service can use plaintext TCP, and only when the caller opts in.
 */
export interface OwnerPostgresConnectionOptionsV1 {
  readonly allow_local_docker_postgres?: boolean;
}

export function ownerPostgresConnectionOptionsFromEnvV1(
  env: Readonly<Record<string, string | undefined>> = process.env,
): OwnerPostgresConnectionOptionsV1 {
  return Object.freeze({
    allow_local_docker_postgres:
      env.PAI_DEPLOYMENT_ENVIRONMENT === "local" &&
      env.PAI_LOCAL_DOCKER_TRANSPORT === "true",
  });
}

interface OwnerPostgresConnectionResolutionV1 {
  readonly transport_security: OwnerPostgresTransportSecurityV1;
  readonly effective_host?: string;
  readonly url?: URL;
}

function ownerPostgresConnectionResolutionV1(
  databaseUrl: string,
  options: OwnerPostgresConnectionOptionsV1 = {},
): OwnerPostgresConnectionResolutionV1 {
  if (databaseUrl.startsWith("/")) {
    return { transport_security: "local" };
  }
  let url: URL;
  let parsedWithDummyHost = false;
  try {
    url = new URL(databaseUrl);
  } catch {
    try {
      if (!databaseUrl.includes("@/")) throw new Error("missing socket marker");
      url = new URL(databaseUrl.replace("@/", "@owner-postgres.invalid/"));
      parsedWithDummyHost = true;
    } catch {
      // Never include a connection string because it may contain credentials.
      throw new Error("invalid PostgreSQL connection URL");
    }
  }
  if (url.protocol === "socket:") {
    if (!url.pathname.startsWith("/")) {
      throw new Error("invalid PostgreSQL Unix socket URL");
    }
    return { transport_security: "local", url };
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("unsupported PostgreSQL connection URL protocol");
  }
  const configuredHosts = url.searchParams.getAll("host");
  if (configuredHosts.length > 1) {
    throw new Error("PostgreSQL connection URL must name exactly one host");
  }
  const effectiveHost =
    configuredHosts[0] ?? (parsedWithDummyHost ? "" : url.hostname);
  if (effectiveHost.startsWith("/")) {
    return { transport_security: "local", url };
  }
  if (effectiveHost.length === 0) {
    throw new Error(
      "PostgreSQL connection URL must explicitly name a loopback host or Unix socket",
    );
  }
  const normalizedHost = effectiveHost
    .replace(/^\[|\]$/gu, "")
    .replace(/\.$/u, "")
    .toLowerCase();
  const ipVersion = isIP(normalizedHost);
  const loopback =
    normalizedHost === "localhost" ||
    (ipVersion === 4 && normalizedHost.startsWith("127.")) ||
    (ipVersion === 6 &&
      (normalizedHost === "::1" ||
        normalizedHost.startsWith("::ffff:127.")));
  if (loopback) {
    return { transport_security: "local", url };
  }
  if (
    options.allow_local_docker_postgres === true &&
    normalizedHost === "postgres"
  ) {
    return { transport_security: "local", url };
  }
  const sslModes = url.searchParams.getAll("sslmode");
  if (sslModes.length !== 1 || sslModes[0]?.toLowerCase() !== "verify-full") {
    throw new Error(
      "remote PostgreSQL requires sslmode=verify-full with CA and hostname verification",
    );
  }
  return {
    transport_security: "tls_verified",
    effective_host: normalizedHost,
    url,
  };
}

/**
 * Validates a DSN without returning or logging credentials. TCP connections
 * outside the local host must use CA and hostname verification; explicitly
 * local Unix sockets and loopback TCP remain usable by development/CI.
 */
export function assertOwnerPostgresTransportSecurityV1(
  databaseUrl: string,
  options: OwnerPostgresConnectionOptionsV1 = {},
): OwnerPostgresTransportSecurityV1 {
  return ownerPostgresConnectionResolutionV1(databaseUrl, options).transport_security;
}

function verifiedOwnerPostgresPoolConfigV1(
  databaseUrl: string,
  options: OwnerPostgresConnectionOptionsV1,
): PoolConfig {
  const resolution = ownerPostgresConnectionResolutionV1(databaseUrl, options);
  if (resolution.transport_security === "local" || resolution.url === undefined) {
    return {
      connectionString: databaseUrl,
      connectionTimeoutMillis: OWNER_POSTGRES_CONNECTION_TIMEOUT_MS_V1,
    };
  }
  if (resolution.effective_host === undefined) {
    throw new Error("remote PostgreSQL hostname verification target is missing");
  }
  const effectiveHost = resolution.effective_host;
  const url = new URL(resolution.url.toString());
  const rootCertificatePath = url.searchParams.get("sslrootcert");
  const clientCertificatePath = url.searchParams.get("sslcert");
  const clientKeyPath = url.searchParams.get("sslkey");
  for (const parameter of [
    "ssl",
    "sslmode",
    "sslrootcert",
    "sslcert",
    "sslkey",
    "uselibpqcompat",
  ]) {
    url.searchParams.delete(parameter);
  }
  return {
    connectionString: url.toString(),
    connectionTimeoutMillis: OWNER_POSTGRES_CONNECTION_TIMEOUT_MS_V1,
    ssl: {
      rejectUnauthorized: true,
      checkServerIdentity: (_hostname, certificate) =>
        checkServerIdentity(effectiveHost, certificate),
      ...(rootCertificatePath === null
        ? {}
        : { ca: readFileSync(rootCertificatePath, "utf8") }),
      ...(clientCertificatePath === null
        ? {}
        : { cert: readFileSync(clientCertificatePath, "utf8") }),
      ...(clientKeyPath === null
        ? {}
        : { key: readFileSync(clientKeyPath, "utf8") }),
    },
  };
}

async function verifyOwnerRepositoryDeploymentFromPoolSnapshotV1<
  const TContract extends OwnerRepositoryContractV1,
>(
  contract: TContract,
  pool: Pool,
  options: Readonly<{
    expected_schema_owner: string;
    schema_owner_assume_principals: readonly string[];
    signal?: AbortSignal;
  }>,
): Promise<VerifiedOwnerRepositoryDeploymentV1<TContract["owner_service"]>> {
  const signal = options.signal ?? new AbortController().signal;
  const deployment =
    await withAbortableOwnerPostgresCatalogSnapshotV1(
      pool,
      signal,
      OWNER_POSTGRES_CATALOG_STATEMENT_TIMEOUT_MS_V1,
      async (
        client,
      ): Promise<
        VerifiedOwnerRepositoryDeploymentV1<TContract["owner_service"]>
      > => {
        const throwIfAborted = (): void => {
          if (signal.aborted) {
            throw signal.reason ??
              new Error("owner PostgreSQL catalog verification was aborted");
          }
        };
        const snapshotPostgres: PostgresQueryPortV1 = Object.freeze({
          async query<TRow extends Record<string, unknown>>(
            sql: string,
            values: readonly unknown[] = [],
          ): Promise<{ readonly rows: readonly TRow[] }> {
            throwIfAborted();
            const result = await client.query<TRow>(sql, [...values]);
            throwIfAborted();
            return { rows: result.rows };
          },
        });
        const deployment =
          await verifyOwnerRepositoryDeploymentFromPostgresV1(
            contract,
            snapshotPostgres,
            {
              expected_schema_owner: options.expected_schema_owner,
              runtime_postgres: snapshotPostgres,
              schema_owner_assume_principals:
                options.schema_owner_assume_principals,
            },
          );
        throwIfAborted();
        return deployment;
      },
    );
  const binding = verifiedOwnerDeploymentBindingsV1.get(deployment);
  if (binding === undefined) {
    throw new Error(
      `verified deployment binding was not recorded for ${contract.owner_service}`,
    );
  }
  verifiedOwnerDeploymentBindingsV1.set(deployment, {
    ...binding,
    catalog_postgres: pool as unknown as PostgresQueryPortV1,
    runtime_postgres: pool as unknown as PostgresQueryPortV1,
  });
  return deployment;
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
  schemaOwnerAssumePrincipals: readonly string[] = [],
  connectionOptions: OwnerPostgresConnectionOptionsV1 =
    ownerPostgresConnectionOptionsFromEnvV1(),
): Promise<VerifiedOwnerPostgresCompositionV1<TContract>> {
  const pool = new Pool(
    verifiedOwnerPostgresPoolConfigV1(databaseUrl, connectionOptions),
  );
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
      await verifyOwnerRepositoryDeploymentFromPoolSnapshotV1(
        contract,
        pool,
        {
          expected_schema_owner: expectedSchemaOwner,
          schema_owner_assume_principals: schemaOwnerAssumePrincipals,
        },
      );
    activateOwnerRepositoryDeploymentForCompositionV1(deployment, pool);
    const ownerRepository = createVerifiedOwnerPostgresRepositoryV1(
      contract,
      deployment,
      pool,
    );
    return Object.freeze({
      deployment,
      postgres,
      read_committed_postgres:
        ownerRepository.read_committed_postgres,
      repository: ownerRepository.repository,
      outbox: ownerRepository.outbox,
      unit_of_work: ownerRepository.unit_of_work,
      async checkReadiness(signal: AbortSignal): Promise<void> {
        await checkOwnerPostgresReadinessV1(pool, signal);
        if (signal.aborted) throw signal.reason;
        const currentDeployment =
          await verifyOwnerRepositoryDeploymentFromPoolSnapshotV1(
            contract,
            pool,
            {
              expected_schema_owner: expectedSchemaOwner,
              schema_owner_assume_principals:
                schemaOwnerAssumePrincipals,
              signal,
            },
          );
        if (signal.aborted) throw signal.reason;
        if (
          currentDeployment.contract_fingerprint !==
            deployment.contract_fingerprint ||
          currentDeployment.database_fingerprint !==
            deployment.database_fingerprint
        ) {
          throw new Error(
            `owner PostgreSQL deployment fingerprint drift for ${contract.owner_service}`,
          );
        }
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

type OwnerPostgresNonNullValueV1<TType extends OwnerPostgresTypeV1> =
  TType extends "text" | "bigint" | "timestamptz"
    ? string
    : TType extends "integer"
      ? number
      : TType extends "boolean"
        ? boolean
        : Readonly<object> | readonly unknown[];

type OwnerPostgresValueV1<TArgument extends OwnerFunctionArgumentV1> =
  | OwnerPostgresNonNullValueV1<TArgument["postgres_type"]>
  | (TArgument["nullable"] extends true ? null : never);

type OwnerWriterSignatureForV1<
  TContract extends OwnerRepositoryContractV1,
  TWriter extends OwnerWriterNameV1<TContract>,
> = Extract<TContract["function_signatures"][number], { function_name: TWriter }>;

export type OwnerWriterArgumentsV1<
  TContract extends OwnerRepositoryContractV1,
  TWriter extends OwnerWriterNameV1<TContract>,
> = OwnerWriterSignatureForV1<TContract, TWriter>["arguments"] extends infer TArguments extends
  readonly OwnerFunctionArgumentV1[]
  ? {
      readonly [TArgument in TArguments[number] as TArgument["argument_name"]]:
        OwnerPostgresValueV1<TArgument>;
    }
  : never;

function exactOwnDataRecordV1(
  value: unknown,
  expectedFields: readonly string[],
  label: string,
): Readonly<Record<string, unknown>> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    isProxy(value)
  ) {
    throw new Error(`${label} must be a plain data object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`${label} must be a plain data object`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  const sortedExpected = [...expectedFields].sort();
  const sortedActual = keys
    .filter((key): key is string => typeof key === "string")
    .sort();
  if (
    keys.length !== sortedExpected.length ||
    sortedActual.length !== sortedExpected.length ||
    sortedActual.some((key, index) => key !== sortedExpected[index])
  ) {
    throw new Error(`${label} fields must match the owner ABI exactly`);
  }
  const snapshot: Record<string, unknown> = {};
  for (const field of expectedFields) {
    const descriptor = descriptors[field];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      throw new Error(`${label}.${field} must be an enumerable data property`);
    }
    snapshot[field] = descriptor.value;
  }
  return Object.freeze(snapshot);
}

export interface ExecuteOwnerWriterRequestV1<
  TContract extends OwnerRepositoryContractV1,
  TWriter extends OwnerWriterNameV1<TContract>,
> {
  readonly writer: TWriter;
  readonly arguments: OwnerWriterArgumentsV1<TContract, TWriter>;
  readonly expected_rows: 1 | "one_or_more" | "zero_or_more";
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

const OWNER_OUTBOX_IDENTITY_MAX_LENGTH_V1 = 256;
const OWNER_OUTBOX_EPOCH_MAX_LENGTH_V1 = 128;
const OWNER_OUTBOX_TRANSPORT_REF_MAX_LENGTH_V1 = 2_048;
const OWNER_OUTBOX_TIMESTAMP_MAX_LENGTH_V1 = 64;
const OWNER_UNIT_OF_WORK_OPERATION_MAX_LENGTH_V1 = 256;
const OWNER_UNIT_OF_WORK_IDEMPOTENCY_KEY_MAX_LENGTH_V1 = 512;
const OWNER_UNIT_OF_WORK_TRACE_ID_MAX_LENGTH_V1 = 256;

function isBoundedNonBlankTextV1(
  value: unknown,
  maximumLength: number,
): value is string {
  return (
    typeof value === "string" &&
    value.length <= maximumLength &&
    value.trim().length > 0
  );
}

export interface OwnerOutboxClaimRequestV1 {
  readonly outbox_table: string;
  readonly worker_id: string;
  readonly limit: number;
  readonly lease_seconds: number;
  /** Compatibility/audit timestamp only; lease authority is PostgreSQL clock_timestamp(). */
  readonly now: string;
  readonly current_transport_epoch: string;
  readonly current_transport_generation: number;
}

export interface OwnerOutboxClaimIdentityV1 {
  readonly outbox_id: string;
  readonly claim_token: string;
}

/** Reject malformed claim rows before their lease transaction can commit. */
export function assertOwnerOutboxClaimIdentityV1(
  value: unknown,
): asserts value is OwnerOutboxClaimIdentityV1 &
  Readonly<Record<string, unknown>> {
  const outboxIdDescriptor =
    typeof value === "object" && value !== null
      ? Object.getOwnPropertyDescriptor(value, "outbox_id")
      : undefined;
  const claimTokenDescriptor =
    typeof value === "object" && value !== null
      ? Object.getOwnPropertyDescriptor(value, "claim_token")
      : undefined;
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    outboxIdDescriptor === undefined ||
    !("value" in outboxIdDescriptor) ||
    !isBoundedNonBlankTextV1(
      outboxIdDescriptor.value,
      OWNER_OUTBOX_IDENTITY_MAX_LENGTH_V1,
    ) ||
    claimTokenDescriptor === undefined ||
    !("value" in claimTokenDescriptor) ||
    !isBoundedNonBlankTextV1(
      claimTokenDescriptor.value,
      OWNER_OUTBOX_IDENTITY_MAX_LENGTH_V1,
    )
  ) {
    throw new Error("outbox claim writer returned an invalid fenced identity");
  }
}

export interface OwnerOutboxAcknowledgeRequestV1 {
  readonly outbox_table: string;
  readonly outbox_id: string;
  readonly claim_token: string;
  readonly outcome: "sent" | "retry_wait" | "failed";
  readonly next_retry_at: string | null;
  readonly error: Readonly<Record<string, unknown>> | null;
  readonly transport_ref: string | null;
  readonly transport_epoch: string | null;
  readonly transport_generation: number | null;
  readonly current_transport_epoch: string;
  readonly current_transport_generation: number;
  /** Compatibility/audit timestamp only; persisted timing uses PostgreSQL clock_timestamp(). */
  readonly now: string;
}

export interface OwnerOutboxAcknowledgeConfirmationV1 {
  readonly acknowledged: true;
}

const OWNER_OUTBOX_ERROR_MAX_BYTES_V1 = 16 * 1_024;
const OWNER_OUTBOX_ERROR_MAX_DEPTH_V1 = 16;
const OWNER_OUTBOX_ERROR_MAX_NODES_V1 = 2_048;

function snapshotOwnerOutboxErrorV1(
  value: Readonly<Record<string, unknown>> | null,
): string | null {
  if (value === null) return null;
  type SnapshotTarget = Record<string, unknown> | unknown[];
  const root: Record<string, unknown> = Object.create(null) as Record<
    string,
    unknown
  >;
  const assign = (
    target: SnapshotTarget,
    key: string | number,
    entry: unknown,
  ): void => {
    if (Array.isArray(target)) {
      if (typeof key !== "number") {
        throw new Error("owner outbox error snapshot target drifted");
      }
      target[key] = entry;
      return;
    }
    if (typeof key !== "string") {
      throw new Error("owner outbox error snapshot target drifted");
    }
    Object.defineProperty(target, key, {
      value: entry,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  };
  const pending: Array<
    Readonly<{
      source: unknown;
      depth: number;
      target: SnapshotTarget;
      key: string | number;
    }>
  > = [
    { source: value, depth: 0, target: root, key: "value" },
  ];
  const visited = new WeakSet<object>();
  let nodes = 0;
  let estimatedUtf8Bytes = 0;
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined) break;
    nodes += 1;
    if (
      nodes > OWNER_OUTBOX_ERROR_MAX_NODES_V1 ||
      current.depth > OWNER_OUTBOX_ERROR_MAX_DEPTH_V1
    ) {
      throw new Error("owner outbox error exceeded its bounded JSON contract");
    }
    const entry = current.source;
    if (entry === null || typeof entry === "boolean") {
      estimatedUtf8Bytes += entry === null ? 4 : entry ? 4 : 5;
      assign(current.target, current.key, entry);
      continue;
    }
    if (typeof entry === "string") {
      estimatedUtf8Bytes += Buffer.byteLength(entry, "utf8");
      if (estimatedUtf8Bytes > OWNER_OUTBOX_ERROR_MAX_BYTES_V1) {
        throw new Error("owner outbox error exceeded its bounded JSON contract");
      }
      assign(current.target, current.key, entry);
      continue;
    }
    if (typeof entry === "number") {
      if (!Number.isFinite(entry)) {
        throw new Error("owner outbox error must contain canonical JSON values");
      }
      estimatedUtf8Bytes += 32;
      assign(current.target, current.key, entry);
      continue;
    }
    if (typeof entry !== "object" || ArrayBuffer.isView(entry)) {
      throw new Error("owner outbox error must contain canonical JSON values");
    }
    if (visited.has(entry)) {
      throw new Error("owner outbox error must not contain cycles or aliases");
    }
    visited.add(entry);
    const isArray = Array.isArray(entry);
    const prototype = Object.getPrototypeOf(entry);
    if (!isArray && prototype !== Object.prototype && prototype !== null) {
      throw new Error("owner outbox error must contain plain JSON objects");
    }
    const ownKeys = Reflect.ownKeys(entry);
    if (ownKeys.length > OWNER_OUTBOX_ERROR_MAX_NODES_V1) {
      throw new Error("owner outbox error exceeded its bounded JSON contract");
    }
    if (isArray) {
      const lengthDescriptor = Object.getOwnPropertyDescriptor(entry, "length");
      const length = lengthDescriptor?.value;
      if (
        lengthDescriptor === undefined ||
        !("value" in lengthDescriptor) ||
        !Number.isSafeInteger(length) ||
        (length as number) < 0 ||
        (length as number) > OWNER_OUTBOX_ERROR_MAX_NODES_V1 ||
        ownKeys.length !== (length as number) + 1
      ) {
        throw new Error("owner outbox error arrays must be dense JSON arrays");
      }
      const snapshot = new Array(length as number);
      assign(current.target, current.key, snapshot);
      estimatedUtf8Bytes += 2;
      for (const propertyKey of ownKeys) {
        if (propertyKey === "length") continue;
        if (typeof propertyKey !== "string") {
          throw new Error("owner outbox error arrays must use JSON indexes");
        }
        const index = Number(propertyKey);
        if (
          !Number.isSafeInteger(index) ||
          index < 0 ||
          index >= (length as number) ||
          String(index) !== propertyKey
        ) {
          throw new Error("owner outbox error arrays must be dense JSON arrays");
        }
        const descriptor = Object.getOwnPropertyDescriptor(entry, propertyKey);
        if (
          descriptor === undefined ||
          !("value" in descriptor) ||
          descriptor.enumerable !== true
        ) {
          throw new Error("owner outbox error must use own data properties");
        }
        pending.push({
          source: descriptor.value,
          depth: current.depth + 1,
          target: snapshot,
          key: index,
        });
      }
      continue;
    }
    const snapshot = Object.create(null) as Record<string, unknown>;
    assign(current.target, current.key, snapshot);
    estimatedUtf8Bytes += 2;
    for (const key of ownKeys) {
      if (typeof key !== "string") {
        throw new Error("owner outbox error must use string JSON keys");
      }
      const descriptor = Object.getOwnPropertyDescriptor(entry, key);
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        descriptor.enumerable !== true
      ) {
        throw new Error("owner outbox error must use own data properties");
      }
      estimatedUtf8Bytes += Buffer.byteLength(key, "utf8") + 3;
      if (estimatedUtf8Bytes > OWNER_OUTBOX_ERROR_MAX_BYTES_V1) {
        throw new Error("owner outbox error exceeded its bounded JSON contract");
      }
      pending.push({
        source: descriptor.value,
        depth: current.depth + 1,
        target: snapshot,
        key,
      });
    }
  }
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(root.value);
  } catch {
    throw new Error("owner outbox error is not JSON-serializable");
  }
  if (
    serialized === undefined ||
    Buffer.byteLength(serialized, "utf8") > OWNER_OUTBOX_ERROR_MAX_BYTES_V1
  ) {
    throw new Error("owner outbox error exceeded its bounded JSON contract");
  }
  return serialized;
}

/**
 * A standard outbox ACK is successful only when the fenced UPDATE affected the
 * claimed row.  Writers must return exactly this confirmation object; accepting
 * arbitrary JSON would turn a stale/no-op claim into a successful dispatch.
 */
export function assertOwnerOutboxAcknowledgeConfirmationV1(
  value: unknown,
): asserts value is OwnerOutboxAcknowledgeConfirmationV1 {
  const acknowledgedDescriptor =
    typeof value === "object" && value !== null
      ? Object.getOwnPropertyDescriptor(value, "acknowledged")
      : undefined;
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).length !== 1 ||
    acknowledgedDescriptor === undefined ||
    !("value" in acknowledgedDescriptor) ||
    acknowledgedDescriptor.value !== true
  ) {
    throw new Error(
      "outbox acknowledge writer did not confirm its fenced compare-and-set",
    );
  }
}

/**
 * Runtime dispatcher access to the standard claim/ack generated writers.
 * The port deliberately exposes neither raw SQL nor generic table mutation.
 */
export interface OwnerOutboxStorePortV1<
  TService extends OwnerDatabaseServiceIdV1 = OwnerDatabaseServiceIdV1,
> {
  readonly owner_service: TService;
  readonly outbox_tables: readonly string[];
  claim<TResult extends Readonly<Record<string, unknown>>>(
    request: OwnerOutboxClaimRequestV1,
  ): Promise<readonly TResult[]>;
  acknowledge(
    request: OwnerOutboxAcknowledgeRequestV1,
  ): Promise<OwnerOutboxAcknowledgeConfirmationV1>;
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

function postgresArgumentValue(
  argument: OwnerFunctionArgumentV1,
  value: unknown,
): unknown {
  if (value === undefined) {
    throw new Error(
      `owner writer argument must be explicitly present: ${argument.argument_name}`,
    );
  }
  if (value === null) {
    if (argument.nullable !== true) {
      throw new Error(
        `owner writer argument does not allow null: ${argument.argument_name}`,
      );
    }
    return null;
  }
  switch (argument.postgres_type) {
    case "text":
      if (typeof value !== "string") break;
      return value;
    case "bigint": {
      if (
        typeof value !== "string" ||
        !/^-?(?:0|[1-9][0-9]*)$/u.test(value)
      ) {
        break;
      }
      const parsed = BigInt(value);
      if (
        parsed < -9_223_372_036_854_775_808n ||
        parsed > 9_223_372_036_854_775_807n
      ) {
        break;
      }
      return value;
    }
    case "integer":
      if (
        typeof value !== "number" ||
        !Number.isInteger(value) ||
        value < -2_147_483_648 ||
        value > 2_147_483_647
      ) {
        break;
      }
      return value;
    case "boolean":
      if (typeof value !== "boolean") break;
      return value;
    case "timestamptz":
      if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.test(
          value,
        ) ||
        !Number.isFinite(Date.parse(value))
      ) {
        break;
      }
      return value;
    case "jsonb": {
      if (typeof value !== "object" || ArrayBuffer.isView(value)) break;
      let serialized: string | undefined;
      try {
        serialized = JSON.stringify(value);
      } catch {
        throw new Error(
          `owner writer jsonb argument is not JSON-serializable: ${argument.argument_name}`,
        );
      }
      if (serialized === undefined) {
        throw new Error(
          `owner writer jsonb argument is not JSON-serializable: ${argument.argument_name}`,
        );
      }
      return serialized;
    }
  }
  throw new Error(
    `owner writer argument type drift for ${argument.argument_name}: expected ${argument.postgres_type}`,
  );
}

const ownerPostgresDriverErrorsV1 = new WeakSet<object>();

function markOwnerPostgresDriverErrorV1(error: unknown): unknown {
  if (typeof error === "object" && error !== null) {
    ownerPostgresDriverErrorsV1.add(error);
  }
  return error;
}

function errorCodeV1(error: unknown): string | undefined {
  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error) ||
    typeof (error as { readonly code?: unknown }).code !== "string"
  ) {
    return undefined;
  }
  return (error as { readonly code: string }).code;
}

function isSerializationFailure(error: unknown): boolean {
  return errorCodeV1(error) === "40001";
}

const transientOwnerPostgresNetworkCodesV1 = new Set([
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENOTFOUND",
  "EPIPE",
  "ETIMEDOUT",
  "ERR_SOCKET_CLOSED",
  "ERR_STREAM_PREMATURE_CLOSE",
]);

const transientOwnerPostgresAvailabilitySqlStatesV1 = new Set([
  "53000",
  "53100",
  "53200",
  "53300",
  "53400",
  "57P01",
  "57P02",
  "57P03",
  "57P04",
  "58000",
  "58030",
]);

const transientOwnerPostgresDriverMessagesV1 = new Set([
  "Connection terminated",
  "Connection terminated due to connection timeout",
  "Connection terminated unexpectedly",
  "Query read timeout",
  "timeout exceeded when trying to connect",
  "timeout expired",
]);

function isTransientOwnerPostgresFailureV1(
  error: unknown,
  trustedDriverOrigin = false,
): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (trustedDriverOrigin || ownerPostgresDriverErrorsV1.has(error)) &&
    (() => {
      const code = errorCodeV1(error);
      if (
        code !== undefined &&
        (/^08[A-Z0-9]{3}$/u.test(code) ||
          transientOwnerPostgresAvailabilitySqlStatesV1.has(code) ||
          transientOwnerPostgresNetworkCodesV1.has(code))
      ) {
        return true;
      }
      return (
        error instanceof Error &&
        transientOwnerPostgresDriverMessagesV1.has(error.message)
      );
    })()
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

export type OwnerRepositoryCommitReconciliationV1 =
  | Readonly<{
      kind: "outbox_claim";
      outbox_table: string;
      worker_id: string;
      current_transport_epoch: string;
      current_transport_generation: number;
      claims: readonly Readonly<{
        outbox_id: string;
        claim_token: string;
      }>[];
    }>
  | Readonly<{
      kind: "outbox_ack";
      outbox_table: string;
      outbox_id: string;
      claim_token: string;
      outcome: OwnerOutboxAcknowledgeRequestV1["outcome"];
      next_retry_at: string | null;
      transport_ref: string | null;
      transport_epoch: string | null;
      transport_generation: number | null;
      current_transport_epoch: string;
      current_transport_generation: number;
      error_fingerprint: string | null;
    }>;

/**
 * PostgreSQL may commit successfully and lose the connection before the client
 * receives CommandComplete. This outcome must not be reported as an ordinary
 * retryable availability failure: callers must reconcile by the durable
 * operation idempotency key before deciding whether to retry.
 */
export class OwnerRepositoryCommitOutcomeUnknownErrorV1 extends Error {
  public readonly code = "commit_outcome_unknown" as const;

  public constructor(
    public readonly operation: string,
    public readonly idempotency_key: string,
    options?: ErrorOptions,
    public readonly reconciliation:
      | OwnerRepositoryCommitReconciliationV1
      | null = null,
  ) {
    super(`owner PostgreSQL commit outcome is unknown for ${operation}`, options);
    this.name = "OwnerRepositoryCommitOutcomeUnknownErrorV1";
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
  outbox: OwnerOutboxStorePortV1<TContract["owner_service"]>;
  unit_of_work: OwnerUnitOfWorkPortV1<
    TContract["owner_service"],
    Readonly<{ owner: OwnerRepositoryPortV1<TContract> }>
  >;
  read_committed_postgres:
    PostgresReadCommittedTransactionPortV1;
}> {
  const deploymentBinding = verifiedOwnerDeploymentBindingsV1.get(deployment);
  if (
    deployment[verifiedOwnerDeploymentBrand] !== true ||
    deployment.owner_service !== contract.owner_service ||
    deployment.contract_fingerprint !== fingerprint(contract) ||
    deploymentBinding === undefined ||
    deploymentBinding.activation_pool !== pool ||
    deploymentBinding.contract_fingerprint !==
      deployment.contract_fingerprint ||
    deploymentBinding.database_fingerprint !== deployment.database_fingerprint
  ) {
    throw new Error(
      `verified deployment capability or PostgreSQL pool does not match ${contract.owner_service}`,
    );
  }
  const clients = new WeakMap<object, PoolClient>();

  function outboxSignature(
    table: string,
    operation: "claim" | "ack",
  ): OwnerFunctionSignatureV1 {
    if (!contract.outbox_tables.includes(table)) {
      throw new Error(
        `outbox table is outside ${contract.owner_service} contract: ${table}`,
      );
    }
    const matches = contract.function_signatures.filter(
      (signature) =>
        signature.primary_table === table &&
        signature.effects.some(
          (effect) =>
            effect.table_name === table && effect.operation === operation,
        ),
    );
    if (matches.length !== 1 || matches[0] === undefined) {
      throw new Error(
        `missing verified ${operation} writer for ${contract.schema}.${table}`,
      );
    }
    return matches[0];
  }

  async function queryOwnerPostgresV1<TRow extends Record<string, unknown>>(
    client: PoolClient,
    sql: string,
    values: readonly unknown[] = [],
  ): Promise<{ readonly rows: readonly TRow[] }> {
    try {
      const result = await client.query<TRow>(sql, [...values]);
      return { rows: result.rows };
    } catch (error) {
      throw markOwnerPostgresDriverErrorV1(error);
    }
  }

  async function executeOwnerPostgresStatementV1(
    client: PoolClient,
    sql: string,
  ): Promise<void> {
    await queryOwnerPostgresV1(client, sql);
  }

  async function ownerPostgresClockTimestampV1(
    client: PoolClient,
  ): Promise<string> {
    const result = await queryOwnerPostgresV1<{ database_now: string }>(
      client,
      "SELECT pg_catalog.clock_timestamp()::text AS database_now",
    );
    const databaseNow = result.rows[0]?.database_now;
    if (
      result.rows.length !== 1 ||
      typeof databaseNow !== "string" ||
      !Number.isFinite(Date.parse(databaseNow))
    ) {
      throw new Error("PostgreSQL did not return a valid authoritative clock");
    }
    return databaseNow;
  }

  async function assertOwnerPostgresRuntimeGucsV1(
    client: PoolClient,
  ): Promise<void> {
    const result = await queryOwnerPostgresV1<{
      session_replication_role: string;
      synchronous_commit: string;
    }>(
      client,
      `SELECT pg_catalog.current_setting('session_replication_role') AS session_replication_role,
              pg_catalog.current_setting('synchronous_commit') AS synchronous_commit`,
    );
    const settings = result.rows[0];
    if (
      result.rows.length !== 1 ||
      settings?.session_replication_role !== "origin" ||
      settings.synchronous_commit !== "on"
    ) {
      throw new Error(
        `owner PostgreSQL runtime durability GUC drift for ${contract.owner_service}`,
      );
    }
  }

  async function clearOwnerPostgresSessionAdvisoryLocksV1(
    client: PoolClient,
  ): Promise<boolean> {
    const result = await queryOwnerPostgresV1<{
      advisory_lock_count: number;
    }>(
      client,
      `SELECT pg_catalog.count(*)::integer AS advisory_lock_count
         FROM pg_catalog.pg_locks
        WHERE locktype = 'advisory'
          AND pid = pg_catalog.pg_backend_pid()`,
    );
    const count = result.rows[0]?.advisory_lock_count;
    if (
      result.rows.length !== 1 ||
      !Number.isSafeInteger(count) ||
      (count as number) < 0
    ) {
      throw new Error(
        "PostgreSQL did not return a valid session advisory-lock count",
      );
    }
    if (count === 0) return false;
    await queryOwnerPostgresV1(
      client,
      "SELECT pg_catalog.pg_advisory_unlock_all()",
    );
    return true;
  }

  async function invokeSignature<TResult>(
    client: PoolClient,
    signature: OwnerFunctionSignatureV1,
    values: readonly unknown[],
  ): Promise<TResult | readonly TResult[]> {
    const placeholders = signature.arguments
      .map(
        ({ postgres_type }, index) =>
          `$${index + 1}::${postgresArgumentCast(postgres_type)}`,
      )
      .join(", ");
    const invocation = `${contract.schema}.${signature.function_name}(${placeholders})`;
    if (signature.returns === "setof jsonb") {
      const result = await queryOwnerPostgresV1<{ result: TResult }>(
        client,
        `SELECT value AS result FROM ${invocation} AS value`,
        values,
      );
      const valuesReturned = result.rows.map(({ result: value }) => value);
      if (valuesReturned.some((value) => value === null || value === undefined)) {
        throw new Error(
          `owner writer returned null result: ${contract.schema}.${signature.function_name}`,
        );
      }
      return valuesReturned;
    }
    const result = await queryOwnerPostgresV1<{ result: TResult }>(
      client,
      `SELECT ${invocation} AS result`,
      values,
    );
    if (result.rows.length !== 1 || result.rows[0] === undefined) {
      throw new Error(
        `owner writer row-count drift: ${contract.schema}.${signature.function_name}`,
      );
    }
    if (result.rows[0].result === null || result.rows[0].result === undefined) {
      throw new Error(
        `owner writer returned null result: ${contract.schema}.${signature.function_name}`,
      );
    }
    return result.rows[0].result;
  }
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
      const writerRequest = exactOwnDataRecordV1(
        request,
        ["writer", "arguments", "expected_rows"],
        "owner writer request",
      );
      const client = clients.get(transaction);
      if (
        client === undefined ||
        transaction.owner_service !== contract.owner_service
      ) {
        throw new Error("owner writer requires its active unit-of-work transaction");
      }
      const signature = contract.function_signatures.find(
        ({ function_name }) => function_name === writerRequest.writer,
      );
      if (signature === undefined) {
        throw new Error(`unknown owner writer for ${contract.schema}`);
      }
      if (
        writerRequest.expected_rows !== 1 &&
        writerRequest.expected_rows !== "one_or_more" &&
        writerRequest.expected_rows !== "zero_or_more"
      ) {
        throw new Error(
          `owner writer row-count expectation drift: ${contract.schema}.${signature.function_name}`,
        );
      }
      const argumentRecord = exactOwnDataRecordV1(
        writerRequest.arguments,
        signature.arguments.map(({ argument_name }) => argument_name),
        `${contract.schema}.${signature.function_name} arguments`,
      );
      const values = signature.arguments.map((argument) =>
        postgresArgumentValue(
          argument,
          argumentRecord[argument.argument_name],
        ),
      );
      const result = await invokeSignature<TResult>(client, signature, values);
      if (signature.returns === "setof jsonb") {
        if (
          !Array.isArray(result) ||
          (writerRequest.expected_rows === 1
            ? result.length !== 1
            : writerRequest.expected_rows === "one_or_more" &&
              result.length === 0)
        ) {
          throw new Error(
            `owner writer row-count drift: ${contract.schema}.${signature.function_name}`,
          );
        }
      }
      return result as TResult;
    },
  });

  function assertOutboxRequest(
    request: OwnerOutboxClaimRequestV1 | OwnerOutboxAcknowledgeRequestV1,
  ): void {
    if (
      typeof request.outbox_table !== "string" ||
      !contract.outbox_tables.includes(request.outbox_table) ||
      !isBoundedNonBlankTextV1(
        request.now,
        OWNER_OUTBOX_TIMESTAMP_MAX_LENGTH_V1,
      ) ||
      !Number.isFinite(Date.parse(request.now))
    ) {
      throw new Error("invalid owner outbox request");
    }
  }

  function outboxCommitOperationV1(
    outboxTable: string,
    operation: "claim" | "ack",
  ): string {
    return `${contract.owner_service}.outbox.${operation}:${contract.schema}.${outboxTable}`;
  }

  function outboxCommitIdempotencyKeyV1(
    reconciliation: OwnerRepositoryCommitReconciliationV1,
  ): string {
    return `sha256:${fingerprint({
      contract_fingerprint: deployment.contract_fingerprint,
      reconciliation,
    })}`;
  }

  const outbox: OwnerOutboxStorePortV1<TContract["owner_service"]> =
    Object.freeze({
      owner_service: contract.owner_service,
      outbox_tables: Object.freeze([...contract.outbox_tables]),
      async claim<TResult extends Readonly<Record<string, unknown>>>(
        request: OwnerOutboxClaimRequestV1,
      ): Promise<readonly TResult[]> {
        // The validated values are also the values sent to PostgreSQL. A
        // caller must not be able to change a lease fence while pool.connect
        // or the authoritative database clock is awaiting completion.
        const claimRequest = exactOwnDataRecordV1(
          request,
          [
            "outbox_table",
            "worker_id",
            "limit",
            "lease_seconds",
            "now",
            "current_transport_epoch",
            "current_transport_generation",
          ],
          "owner outbox claim request",
        ) as unknown as OwnerOutboxClaimRequestV1;
        assertOutboxRequest(claimRequest);
        if (
          !isBoundedNonBlankTextV1(
            claimRequest.worker_id,
            OWNER_OUTBOX_IDENTITY_MAX_LENGTH_V1,
          ) ||
          !isBoundedNonBlankTextV1(
            claimRequest.current_transport_epoch,
            OWNER_OUTBOX_EPOCH_MAX_LENGTH_V1,
          ) ||
          !Number.isSafeInteger(claimRequest.current_transport_generation) ||
          claimRequest.current_transport_generation < 1 ||
          !Number.isSafeInteger(claimRequest.limit) ||
          claimRequest.limit < 1 ||
          claimRequest.limit > OWNER_OUTBOX_BATCH_MAX_V1 ||
          !Number.isSafeInteger(claimRequest.lease_seconds) ||
          claimRequest.lease_seconds < 1 ||
          claimRequest.lease_seconds > 3_600
        ) {
          throw new Error("invalid owner outbox claim request");
        }
        const signature = outboxSignature(claimRequest.outbox_table, "claim");
        const client = await pool.connect();
        let commitStarted = false;
        let discardClient = false;
        let commitReconciliation:
          | Extract<
              OwnerRepositoryCommitReconciliationV1,
              { readonly kind: "outbox_claim" }
            >
          | undefined;
        try {
          await executeOwnerPostgresStatementV1(
            client,
            "BEGIN ISOLATION LEVEL READ COMMITTED",
          );
          await assertOwnerPostgresRuntimeGucsV1(client);
          const databaseNow = await ownerPostgresClockTimestampV1(client);
          const result = await invokeSignature<TResult>(client, signature, [
            claimRequest.worker_id,
            claimRequest.limit,
            claimRequest.lease_seconds,
            databaseNow,
            claimRequest.current_transport_epoch,
            String(claimRequest.current_transport_generation),
          ]);
          if (!Array.isArray(result) || result.length > claimRequest.limit) {
            throw new Error(
              `outbox claim writer did not return rows: ${contract.schema}.${signature.function_name}`,
            );
          }
          for (const claimed of result) {
            assertOwnerOutboxClaimIdentityV1(claimed);
          }
          commitReconciliation = Object.freeze({
            kind: "outbox_claim",
            outbox_table: claimRequest.outbox_table,
            worker_id: claimRequest.worker_id,
            current_transport_epoch:
              claimRequest.current_transport_epoch,
            current_transport_generation:
              claimRequest.current_transport_generation,
            claims: Object.freeze(
              result
                .map(({ outbox_id, claim_token }) =>
                  Object.freeze({ outbox_id, claim_token }),
                )
                .sort((left, right) =>
                  left.outbox_id.localeCompare(right.outbox_id) ||
                  left.claim_token.localeCompare(right.claim_token),
                ),
            ),
          });
          commitStarted = true;
          await executeOwnerPostgresStatementV1(client, "COMMIT");
          return result as readonly TResult[];
        } catch (error) {
          if (
            commitStarted &&
            commitReconciliation !== undefined &&
            isTransientOwnerPostgresFailureV1(error)
          ) {
            discardClient = true;
            throw new OwnerRepositoryCommitOutcomeUnknownErrorV1(
              outboxCommitOperationV1(
                claimRequest.outbox_table,
                "claim",
              ),
              outboxCommitIdempotencyKeyV1(commitReconciliation),
              { cause: error },
              commitReconciliation,
            );
          }
          await executeOwnerPostgresStatementV1(client, "ROLLBACK").catch(
            () => undefined,
          );
          throw error;
        } finally {
          client.release(discardClient);
        }
      },
      async acknowledge(
        request: OwnerOutboxAcknowledgeRequestV1,
      ): Promise<OwnerOutboxAcknowledgeConfirmationV1> {
        const acknowledgeRequest = exactOwnDataRecordV1(
          request,
          [
            "outbox_table",
            "outbox_id",
            "claim_token",
            "outcome",
            "next_retry_at",
            "error",
            "transport_ref",
            "transport_epoch",
            "transport_generation",
            "current_transport_epoch",
            "current_transport_generation",
            "now",
          ],
          "owner outbox acknowledge request",
        ) as unknown as OwnerOutboxAcknowledgeRequestV1;
        assertOutboxRequest(acknowledgeRequest);
        const retryWait = acknowledgeRequest.outcome === "retry_wait";
        const sent = acknowledgeRequest.outcome === "sent";
        if (
          !(["sent", "retry_wait", "failed"] as const).includes(
            acknowledgeRequest.outcome,
          ) ||
          !isBoundedNonBlankTextV1(
            acknowledgeRequest.outbox_id,
            OWNER_OUTBOX_IDENTITY_MAX_LENGTH_V1,
          ) ||
          !isBoundedNonBlankTextV1(
            acknowledgeRequest.claim_token,
            OWNER_OUTBOX_IDENTITY_MAX_LENGTH_V1,
          ) ||
          (retryWait !== (acknowledgeRequest.next_retry_at !== null)) ||
          (acknowledgeRequest.next_retry_at !== null &&
            (!isBoundedNonBlankTextV1(
              acknowledgeRequest.next_retry_at,
              OWNER_OUTBOX_TIMESTAMP_MAX_LENGTH_V1,
            ) ||
              !Number.isFinite(Date.parse(acknowledgeRequest.next_retry_at)))) ||
          (acknowledgeRequest.outcome === "sent" &&
            acknowledgeRequest.error !== null) ||
          (acknowledgeRequest.outcome !== "sent" &&
            (typeof acknowledgeRequest.error !== "object" ||
              acknowledgeRequest.error === null ||
              Array.isArray(acknowledgeRequest.error))) ||
          sent !==
            (acknowledgeRequest.transport_ref !== null &&
              acknowledgeRequest.transport_epoch !== null &&
              acknowledgeRequest.transport_generation !== null) ||
          (acknowledgeRequest.transport_ref !== null &&
            !isBoundedNonBlankTextV1(
              acknowledgeRequest.transport_ref,
              OWNER_OUTBOX_TRANSPORT_REF_MAX_LENGTH_V1,
            )) ||
          (acknowledgeRequest.transport_epoch !== null &&
            !isBoundedNonBlankTextV1(
              acknowledgeRequest.transport_epoch,
              OWNER_OUTBOX_EPOCH_MAX_LENGTH_V1,
            )) ||
          (acknowledgeRequest.transport_generation !== null &&
            (!Number.isSafeInteger(acknowledgeRequest.transport_generation) ||
              acknowledgeRequest.transport_generation < 1)) ||
          !isBoundedNonBlankTextV1(
            acknowledgeRequest.current_transport_epoch,
            OWNER_OUTBOX_EPOCH_MAX_LENGTH_V1,
          ) ||
          !Number.isSafeInteger(
            acknowledgeRequest.current_transport_generation,
          ) ||
          acknowledgeRequest.current_transport_generation < 1 ||
          (sent &&
            (acknowledgeRequest.transport_epoch !==
              acknowledgeRequest.current_transport_epoch ||
              acknowledgeRequest.transport_generation !==
                acknowledgeRequest.current_transport_generation)) ||
          (!sent &&
            (acknowledgeRequest.transport_ref !== null ||
              acknowledgeRequest.transport_epoch !== null ||
              acknowledgeRequest.transport_generation !== null))
        ) {
          throw new Error("invalid owner outbox acknowledge request");
        }
        const serializedError = snapshotOwnerOutboxErrorV1(
          acknowledgeRequest.error,
        );
        const signature = outboxSignature(
          acknowledgeRequest.outbox_table,
          "ack",
        );
        const commitReconciliation = Object.freeze({
          kind: "outbox_ack",
          outbox_table: acknowledgeRequest.outbox_table,
          outbox_id: acknowledgeRequest.outbox_id,
          claim_token: acknowledgeRequest.claim_token,
          outcome: acknowledgeRequest.outcome,
          next_retry_at: acknowledgeRequest.next_retry_at,
          transport_ref: acknowledgeRequest.transport_ref,
          transport_epoch: acknowledgeRequest.transport_epoch,
          transport_generation: acknowledgeRequest.transport_generation,
          current_transport_epoch:
            acknowledgeRequest.current_transport_epoch,
          current_transport_generation:
            acknowledgeRequest.current_transport_generation,
          error_fingerprint:
            serializedError === null
              ? null
              : `sha256:${fingerprint(serializedError)}`,
        }) satisfies Extract<
          OwnerRepositoryCommitReconciliationV1,
          { readonly kind: "outbox_ack" }
        >;
        const client = await pool.connect();
        let commitStarted = false;
        let discardClient = false;
        try {
          await executeOwnerPostgresStatementV1(
            client,
            "BEGIN ISOLATION LEVEL READ COMMITTED",
          );
          await assertOwnerPostgresRuntimeGucsV1(client);
          const databaseNow = await ownerPostgresClockTimestampV1(client);
          const result = await invokeSignature<unknown>(client, signature, [
            acknowledgeRequest.outbox_id,
            acknowledgeRequest.claim_token,
            acknowledgeRequest.outcome,
            acknowledgeRequest.next_retry_at,
            serializedError,
            acknowledgeRequest.transport_ref,
            acknowledgeRequest.transport_epoch,
            acknowledgeRequest.transport_generation === null
              ? null
              : String(acknowledgeRequest.transport_generation),
            acknowledgeRequest.current_transport_epoch,
            String(acknowledgeRequest.current_transport_generation),
            databaseNow,
          ]);
          assertOwnerOutboxAcknowledgeConfirmationV1(result);
          commitStarted = true;
          await executeOwnerPostgresStatementV1(client, "COMMIT");
          return Object.freeze({ acknowledged: true });
        } catch (error) {
          if (
            commitStarted &&
            isTransientOwnerPostgresFailureV1(error)
          ) {
            discardClient = true;
            throw new OwnerRepositoryCommitOutcomeUnknownErrorV1(
              outboxCommitOperationV1(
                acknowledgeRequest.outbox_table,
                "ack",
              ),
              outboxCommitIdempotencyKeyV1(commitReconciliation),
              { cause: error },
              commitReconciliation,
            );
          }
          await executeOwnerPostgresStatementV1(client, "ROLLBACK").catch(
            () => undefined,
          );
          throw error;
        } finally {
          client.release(discardClient);
        }
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
      const transactionRequest = exactOwnDataRecordV1(
        request,
        ["operation", "idempotency_key", "trace_id", "isolation", "retry"],
        "owner unit-of-work request",
      ) as unknown as OwnerUnitOfWorkRequestV1;
      if (
        typeof work !== "function" ||
        isProxy(work) ||
        !isBoundedNonBlankTextV1(
          transactionRequest.operation,
          OWNER_UNIT_OF_WORK_OPERATION_MAX_LENGTH_V1,
        ) ||
        !isBoundedNonBlankTextV1(
          transactionRequest.idempotency_key,
          OWNER_UNIT_OF_WORK_IDEMPOTENCY_KEY_MAX_LENGTH_V1,
        ) ||
        !isBoundedNonBlankTextV1(
          transactionRequest.trace_id,
          OWNER_UNIT_OF_WORK_TRACE_ID_MAX_LENGTH_V1,
        ) ||
        !Object.prototype.hasOwnProperty.call(
          isolationSql,
          transactionRequest.isolation,
        ) ||
        (transactionRequest.retry !== "none" &&
          transactionRequest.retry !== "serialization_failures")
      ) {
        throw new Error("invalid owner unit-of-work request");
      }
      const maxAttempts =
        transactionRequest.retry === "serialization_failures" ? 3 : 1;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        let client: PoolClient;
        try {
          client = await pool.connect();
        } catch (error) {
          if (isTransientOwnerPostgresFailureV1(error, true)) {
            throw new OwnerRepositoryTransientErrorV1(
              "transient_database_error",
              `owner unit of work could not acquire PostgreSQL for ${transactionRequest.operation}`,
              { cause: error },
            );
          }
          throw error;
        }
        const transaction = Object.freeze({
          owner_service: contract.owner_service,
          transaction_id: randomUUID(),
          trace_id: transactionRequest.trace_id,
          started_at: new Date().toISOString(),
          attempt,
        }) as unknown as OwnerTransactionV1<TContract["owner_service"]>;
        let discardClient = false;
        let commitStarted = false;
        clients.set(transaction, client);
        try {
          await executeOwnerPostgresStatementV1(
            client,
            `BEGIN ISOLATION LEVEL ${isolationSql[transactionRequest.isolation]}`,
          );
          await assertOwnerPostgresRuntimeGucsV1(client);
          const result = await work(transaction, { owner: repository });
          commitStarted = true;
          await executeOwnerPostgresStatementV1(client, "COMMIT");
          return result;
        } catch (error) {
          if (
            commitStarted &&
            isTransientOwnerPostgresFailureV1(error)
          ) {
            discardClient = true;
            throw new OwnerRepositoryCommitOutcomeUnknownErrorV1(
              transactionRequest.operation,
              transactionRequest.idempotency_key,
              { cause: error },
            );
          }
          await executeOwnerPostgresStatementV1(client, "ROLLBACK").catch(
            (rollbackError: unknown) => {
              discardClient ||= isTransientOwnerPostgresFailureV1(
                rollbackError,
              );
            },
          );
          if (isSerializationFailure(error) && attempt === maxAttempts) {
            throw new OwnerRepositoryTransientErrorV1(
              "serialization_retry_exhausted",
              `owner unit of work exhausted serialization retries for ${transactionRequest.operation}`,
              { cause: error },
            );
          }
          if (isSerializationFailure(error)) {
            continue;
          }
          if (isTransientOwnerPostgresFailureV1(error)) {
            discardClient = true;
            throw new OwnerRepositoryTransientErrorV1(
              "transient_database_error",
              `owner unit of work lost PostgreSQL availability for ${transactionRequest.operation}`,
              { cause: error },
            );
          }
          throw error;
        } finally {
          clients.delete(transaction);
          client.release(discardClient);
        }
      }
      throw new Error("owner unit of work exhausted serialization retries");
    },
  });
  const readCommittedPostgres: PostgresReadCommittedTransactionPortV1 =
    Object.freeze({
      async withReadCommittedTransaction<TResult>(
        work: (
          transaction: PostgresReadCommittedTransactionV1,
        ) => Promise<TResult>,
      ): Promise<TResult> {
        let client: PoolClient;
        try {
          client = await pool.connect();
        } catch (error) {
          if (isTransientOwnerPostgresFailureV1(error, true)) {
            throw new OwnerRepositoryTransientErrorV1(
              "transient_database_error",
              `owner read transaction could not acquire PostgreSQL for ${contract.owner_service}`,
              { cause: error },
            );
          }
          throw error;
        }
        let active = true;
        let discardClient = false;
        const transaction: PostgresReadCommittedTransactionV1 =
          Object.freeze({
            async query<TRow extends Record<string, unknown>>(
              sql: string,
              values: readonly unknown[] = [],
            ): Promise<{ readonly rows: readonly TRow[] }> {
              if (!active) {
                throw new Error(
                  "owner READ COMMITTED transaction capability is no longer active",
                );
              }
              assertOwnerRepositorySafeReadStatementV1(sql);
              return queryOwnerPostgresV1<TRow>(
                client,
                sql,
                values,
              );
            },
          });
        try {
          await executeOwnerPostgresStatementV1(
            client,
            "BEGIN ISOLATION LEVEL READ COMMITTED READ ONLY",
          );
          await assertOwnerPostgresRuntimeGucsV1(client);
          const result = await work(transaction);
          active = false;
          await executeOwnerPostgresStatementV1(client, "COMMIT");
          try {
            if (await clearOwnerPostgresSessionAdvisoryLocksV1(client)) {
              discardClient = true;
              throw new Error(
                "owner READ COMMITTED transaction left a session-level advisory lock",
              );
            }
          } catch (error) {
            discardClient = true;
            throw error;
          }
          return result;
        } catch (error) {
          active = false;
          await executeOwnerPostgresStatementV1(
            client,
            "ROLLBACK",
          ).catch((rollbackError: unknown) => {
            discardClient ||=
              isTransientOwnerPostgresFailureV1(rollbackError);
          });
          let residualSessionLock = false;
          if (!discardClient) {
            try {
              residualSessionLock =
                await clearOwnerPostgresSessionAdvisoryLocksV1(client);
            } catch {
              // A connection whose post-transaction session state cannot be
              // proven clean must never return to the shared pool.
              discardClient = true;
            }
          }
          if (residualSessionLock) {
            discardClient = true;
            throw new Error(
              "owner READ COMMITTED transaction left a session-level advisory lock",
              { cause: error },
            );
          }
          if (isTransientOwnerPostgresFailureV1(error)) {
            discardClient = true;
            throw new OwnerRepositoryTransientErrorV1(
              "transient_database_error",
              `owner read transaction lost PostgreSQL availability for ${contract.owner_service}`,
              { cause: error },
            );
          }
          throw error;
        } finally {
          active = false;
          client.release(discardClient);
        }
      },
    });
  return Object.freeze({
    repository,
    outbox,
    unit_of_work: unitOfWork,
    read_committed_postgres: readCommittedPostgres,
  });
}

export type AssertOwnerServiceV1<T extends ServiceIdV1> =
  T extends OwnerDatabaseServiceIdV1 ? T : never;
