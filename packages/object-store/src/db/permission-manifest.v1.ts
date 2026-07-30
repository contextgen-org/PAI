import { createHash } from "node:crypto";

import { assertCanonicalJsonBoundaryV1 } from "@pai/contracts";

import type { ObjectMetadataOwnerServiceV1 } from "./metadata-contract.v1.js";

export const OBJECT_STORE_PERMISSION_MANIFEST_VERSION_V1 =
  "object_store_permission_manifest.v1" as const;

export const OBJECT_STORE_SCHEMA_V1 = "object_store" as const;
export const OBJECT_STORE_FRESH_MIGRATION_V1 =
  "0050_object_store" as const;
export const OBJECT_STORE_GENERATED_PERMISSION_SQL_V1 =
  "pai-infra/supabase/generated/permissions/0050_object_store.sql" as const;

export const OBJECT_STORE_FOREGROUND_ROLE_BINDINGS_V1 = Object.freeze([
  Object.freeze({
    role: "pai_trigger_processor_app" as const,
    owner_service: "trigger_processor" as const,
  }),
  Object.freeze({
    role: "pai_action_runtime_app" as const,
    owner_service: "action_runtime" as const,
  }),
  Object.freeze({
    role: "pai_skill_registry_app" as const,
    owner_service: "skill_registry" as const,
  }),
]);

export const OBJECT_STORE_RECONCILER_ROLE_V1 =
  "pai_object_store_reconciler_app" as const;

export type ObjectStoreForegroundRoleV1 =
  (typeof OBJECT_STORE_FOREGROUND_ROLE_BINDINGS_V1)[number]["role"];
export type ObjectStoreReconcilerRoleV1 =
  typeof OBJECT_STORE_RECONCILER_ROLE_V1;
export type ObjectStoreRuntimeRoleV1 =
  | ObjectStoreForegroundRoleV1
  | ObjectStoreReconcilerRoleV1;

export const OBJECT_STORE_TABLES_V1 = Object.freeze([
  "object_metadata_reservations",
  "object_operation_attempts",
  "object_terminal_proofs",
  "object_reconcile_jobs",
] as const);

export type ObjectStoreTableV1 = (typeof OBJECT_STORE_TABLES_V1)[number];

export const OBJECT_STORE_LOCK_ORDER_V1 = Object.freeze([
  "object_metadata_reservations",
  "object_operation_attempts",
  "object_terminal_proofs",
  "object_reconcile_jobs",
] as const satisfies readonly ObjectStoreTableV1[]);

export const OBJECT_STORE_TABLE_COLUMNS_V1 = Object.freeze({
  object_metadata_reservations: Object.freeze([
    "id",
    "contract_version",
    "operation",
    "owner_service",
    "owner_object_id",
    "owner_state_version",
    "object_class",
    "scope_kind",
    "workspace_id",
    "bot_id",
    "owner_agent_id",
    "deployment_environment",
    "release_channel",
    "idempotency_key",
    "request_hash",
    "object_fingerprint",
    "expected_digest",
    "expected_size_bytes",
    "media_type",
    "retention_until",
    "deletion_decision_version",
    "foreground_lease_token_hash",
    "foreground_lease_expires_at",
    "generation",
    "current_attempt_no",
    "status",
    "opaque_ref",
    "physical_object_fingerprint",
    "terminal_proof_hash",
    "gc_not_before",
    "created_at",
    "updated_at",
  ]),
  object_operation_attempts: Object.freeze([
    "id",
    "reservation_id",
    "operation",
    "attempt_no",
    "actor_kind",
    "attempt_token_hash",
    "claim_token_hash",
    "claim_generation",
    "status",
    "provider_request_id",
    "provider_receipt_hash",
    "physical_object_fingerprint",
    "result_digest",
    "result_size_bytes",
    "error",
    "started_at",
    "completed_at",
  ]),
  object_terminal_proofs: Object.freeze([
    "id",
    "reservation_id",
    "attempt_id",
    "operation",
    "proof_kind",
    "opaque_ref",
    "provider_receipt_hash",
    "physical_object_fingerprint",
    "result_digest",
    "result_size_bytes",
    "result_media_type",
    "provider_terminal_disposition",
    "tombstone",
    "proof_hash",
    "completed_at",
    "created_at",
  ]),
  object_reconcile_jobs: Object.freeze([
    "id",
    "reservation_id",
    "status",
    "claim_token_hash",
    "claim_generation",
    "claim_lease_expires_at",
    "retry_count",
    "next_retry_at",
    "last_error",
    "dlq_reason",
    "dlq_at",
    "created_at",
    "updated_at",
  ]),
} as const);

export const OBJECT_STORE_WRITER_NAMES_V1 = Object.freeze([
  "reserve_object_operation_v1",
  "start_object_operation_attempt_v1",
  "mark_object_operation_commit_unknown_v1",
  "finalize_object_operation_v1",
  "claim_expired_object_reconcile_v1",
  "renew_object_reconcile_claim_v1",
  "settle_object_reconcile_v1",
  "get_object_operation_result_v1",
] as const);

export type ObjectStoreWriterNameV1 =
  (typeof OBJECT_STORE_WRITER_NAMES_V1)[number];

type ObjectStorePostgresTypeV1 =
  | "text"
  | "bigint"
  | "integer"
  | "jsonb"
  | "timestamptz";

export interface ObjectStoreFunctionArgumentV1 {
  readonly argument_name: `p_${string}`;
  readonly postgres_type: ObjectStorePostgresTypeV1;
  readonly mode: "in";
  readonly nullable: boolean;
  /**
   * Plaintext secrets are input-only. PostgreSQL writers hash them before any
   * durable write and never include them in result rows.
   */
  readonly sensitivity: "public" | "secret_input";
}

export interface ObjectStoreFunctionEffectV1 {
  readonly table_name: ObjectStoreTableV1;
  readonly columns: readonly string[];
  readonly operation:
    | "create_or_replay"
    | "append"
    | "transition"
    | "claim"
    | "settle"
    | "immutable_proof";
  readonly concurrency_control:
    | "idempotency_identity"
    | "expected_generation"
    | "attempt_fence"
    | "foreground_lease"
    | "claim_generation"
    | "terminal_immutability";
}

export interface ObjectStoreFunctionManifestV1 {
  readonly schema: typeof OBJECT_STORE_SCHEMA_V1;
  readonly function_name: ObjectStoreWriterNameV1;
  readonly top_level_operation:
    | "create"
    | "claim"
    | "transition"
    | "record"
    | "ack";
  readonly request_schema_id: `urn:pai:object-store:${string}:v1`;
  readonly response_schema_id: `urn:pai:object-store:${string}:v1`;
  readonly arguments: readonly ObjectStoreFunctionArgumentV1[];
  readonly reads_tables: readonly ObjectStoreTableV1[];
  readonly writes_tables: readonly ObjectStoreTableV1[];
  readonly effects: readonly ObjectStoreFunctionEffectV1[];
  readonly returns: "jsonb" | "setof jsonb";
  readonly security_definer: true;
  readonly search_path: readonly ["pg_catalog", "object_store", "pg_temp"];
  readonly granted_roles: readonly ObjectStoreRuntimeRoleV1[];
  readonly invocation_modes: readonly (
    | "foreground"
    | "reconciler"
    | "owner_internal_reconciler"
  )[];
  readonly lock_order: readonly ObjectStoreTableV1[];
  readonly atomicity: "single_transaction";
  readonly audit_effects: readonly Readonly<{
    table_name: "object_operation_attempts" | "object_terminal_proofs";
    columns: readonly string[];
  }>[];
  readonly outbox_effect: "none";
}

const foregroundRolesV1 = Object.freeze(
  OBJECT_STORE_FOREGROUND_ROLE_BINDINGS_V1.map(({ role }) => role),
);
const foregroundAndReconcilerRolesV1 = Object.freeze([
  ...foregroundRolesV1,
  OBJECT_STORE_RECONCILER_ROLE_V1,
]);
const fixedSearchPathV1 = Object.freeze([
  "pg_catalog",
  "object_store",
  "pg_temp",
] as const);

function argumentV1(
  argument_name: `p_${string}`,
  postgres_type: ObjectStorePostgresTypeV1,
  options: Readonly<{
    nullable?: boolean;
    sensitivity?: ObjectStoreFunctionArgumentV1["sensitivity"];
  }> = {},
): ObjectStoreFunctionArgumentV1 {
  return Object.freeze({
    argument_name,
    postgres_type,
    mode: "in" as const,
    nullable: options.nullable ?? false,
    sensitivity: options.sensitivity ?? "public",
  });
}

function effectV1(
  table_name: ObjectStoreTableV1,
  operation: ObjectStoreFunctionEffectV1["operation"],
  concurrency_control: ObjectStoreFunctionEffectV1["concurrency_control"],
  columns: readonly string[],
): ObjectStoreFunctionEffectV1 {
  return Object.freeze({
    table_name,
    columns: Object.freeze([...columns]),
    operation,
    concurrency_control,
  });
}

const derivedFunctionContractsV1 = {
  reserve_object_operation_v1: {
    top_level_operation: "create",
    request_schema_id:
      "urn:pai:object-store:reserve-operation-request:v1",
    response_schema_id:
      "urn:pai:object-store:reserve-operation-result:v1",
    lock_order: [
      "object_metadata_reservations",
      "object_reconcile_jobs",
    ],
    audit_effects: [],
  },
  start_object_operation_attempt_v1: {
    top_level_operation: "transition",
    request_schema_id:
      "urn:pai:object-store:start-operation-attempt-request:v1",
    response_schema_id:
      "urn:pai:object-store:start-operation-attempt-result:v1",
    lock_order: [
      "object_metadata_reservations",
      "object_operation_attempts",
      "object_reconcile_jobs",
    ],
    audit_effects: [{
      table_name: "object_operation_attempts",
      columns: [
        "id",
        "reservation_id",
        "operation",
        "attempt_no",
        "actor_kind",
        "attempt_token_hash",
        "claim_token_hash",
        "claim_generation",
        "status",
        "started_at",
      ],
    }],
  },
  mark_object_operation_commit_unknown_v1: {
    top_level_operation: "record",
    request_schema_id:
      "urn:pai:object-store:mark-operation-commit-unknown-request:v1",
    response_schema_id:
      "urn:pai:object-store:mark-operation-commit-unknown-result:v1",
    lock_order: [
      "object_metadata_reservations",
      "object_operation_attempts",
      "object_reconcile_jobs",
    ],
    audit_effects: [{
      table_name: "object_operation_attempts",
      columns: [
        "status",
        "provider_request_id",
        "provider_receipt_hash",
        "physical_object_fingerprint",
        "error",
        "completed_at",
      ],
    }],
  },
  finalize_object_operation_v1: {
    top_level_operation: "transition",
    request_schema_id:
      "urn:pai:object-store:finalize-operation-request:v1",
    response_schema_id:
      "urn:pai:object-store:finalize-operation-result:v1",
    lock_order: [
      "object_metadata_reservations",
      "object_operation_attempts",
      "object_terminal_proofs",
      "object_reconcile_jobs",
    ],
    audit_effects: [
      {
        table_name: "object_operation_attempts",
        columns: [
          "status",
          "provider_receipt_hash",
          "physical_object_fingerprint",
          "result_digest",
          "result_size_bytes",
          "error",
          "completed_at",
        ],
      },
      {
        table_name: "object_terminal_proofs",
        columns: [
          "id",
          "reservation_id",
          "attempt_id",
          "operation",
          "proof_kind",
          "proof_hash",
          "created_at",
        ],
      },
    ],
  },
  claim_expired_object_reconcile_v1: {
    top_level_operation: "claim",
    request_schema_id:
      "urn:pai:object-store:claim-expired-reconcile-request:v1",
    response_schema_id:
      "urn:pai:object-store:reconcile-claim-batch:v1",
    lock_order: [
      "object_metadata_reservations",
      "object_reconcile_jobs",
    ],
    audit_effects: [],
  },
  renew_object_reconcile_claim_v1: {
    top_level_operation: "transition",
    request_schema_id:
      "urn:pai:object-store:renew-reconcile-claim-request:v1",
    response_schema_id:
      "urn:pai:object-store:reconcile-claim:v1",
    lock_order: [
      "object_metadata_reservations",
      "object_reconcile_jobs",
    ],
    audit_effects: [],
  },
  settle_object_reconcile_v1: {
    top_level_operation: "ack",
    request_schema_id:
      "urn:pai:object-store:settle-reconcile-request:v1",
    response_schema_id:
      "urn:pai:object-store:settle-reconcile-result:v1",
    lock_order: [
      "object_metadata_reservations",
      "object_operation_attempts",
      "object_terminal_proofs",
      "object_reconcile_jobs",
    ],
    audit_effects: [
      {
        table_name: "object_operation_attempts",
        columns: [
          "id",
          "reservation_id",
          "operation",
          "attempt_no",
          "actor_kind",
          "claim_token_hash",
          "claim_generation",
          "status",
          "completed_at",
        ],
      },
      {
        table_name: "object_terminal_proofs",
        columns: [
          "id",
          "reservation_id",
          "attempt_id",
          "operation",
          "proof_kind",
          "proof_hash",
          "created_at",
        ],
      },
    ],
  },
  get_object_operation_result_v1: {
    top_level_operation: "record",
    request_schema_id:
      "urn:pai:object-store:get-operation-result-request:v1",
    response_schema_id:
      "urn:pai:object-store:operation-result:v1",
    lock_order: [
      "object_metadata_reservations",
      "object_operation_attempts",
      "object_terminal_proofs",
      "object_reconcile_jobs",
    ],
    audit_effects: [],
  },
} as const satisfies Record<
  ObjectStoreWriterNameV1,
  Readonly<{
    top_level_operation: ObjectStoreFunctionManifestV1["top_level_operation"];
    request_schema_id: ObjectStoreFunctionManifestV1["request_schema_id"];
    response_schema_id: ObjectStoreFunctionManifestV1["response_schema_id"];
    lock_order: readonly ObjectStoreTableV1[];
    audit_effects: readonly Readonly<{
      table_name: "object_operation_attempts" | "object_terminal_proofs";
      columns: readonly string[];
    }>[];
  }>
>;

function derivedFunctionContractV1(
  writer: ObjectStoreWriterNameV1,
): Pick<
  ObjectStoreFunctionManifestV1,
  | "top_level_operation"
  | "request_schema_id"
  | "response_schema_id"
  | "lock_order"
  | "atomicity"
  | "audit_effects"
  | "outbox_effect"
> {
  return {
    ...derivedFunctionContractsV1[writer],
    atomicity: "single_transaction",
    outbox_effect: "none",
  };
}

function functionManifestV1(
  input: Omit<
    ObjectStoreFunctionManifestV1,
    | "schema"
    | "security_definer"
    | "search_path"
    | "top_level_operation"
    | "request_schema_id"
    | "response_schema_id"
    | "lock_order"
    | "atomicity"
    | "audit_effects"
    | "outbox_effect"
  >,
): ObjectStoreFunctionManifestV1 {
  const derived = derivedFunctionContractV1(input.function_name);
  return Object.freeze({
    schema: OBJECT_STORE_SCHEMA_V1,
    ...derived,
    ...input,
    arguments: Object.freeze([...input.arguments]),
    reads_tables: Object.freeze([...input.reads_tables]),
    writes_tables: Object.freeze([...input.writes_tables]),
    effects: Object.freeze([...input.effects]),
    security_definer: true as const,
    search_path: fixedSearchPathV1,
    granted_roles: Object.freeze([...input.granted_roles]),
    invocation_modes: Object.freeze([...input.invocation_modes]),
    lock_order: Object.freeze([...derived.lock_order]),
    audit_effects: Object.freeze(
      derived.audit_effects.map((effect) =>
        Object.freeze({
          table_name: effect.table_name,
          columns: Object.freeze([...effect.columns]),
        })
      ),
    ),
  });
}

const reservationScopeArgumentsV1 = Object.freeze([
  argumentV1("p_scope_kind", "text"),
  argumentV1("p_workspace_id", "text", { nullable: true }),
  argumentV1("p_bot_id", "text", { nullable: true }),
  argumentV1("p_owner_agent_id", "text", { nullable: true }),
  argumentV1("p_deployment_environment", "text", { nullable: true }),
  argumentV1("p_release_channel", "text", { nullable: true }),
]);

const attemptFenceArgumentsV1 = Object.freeze([
  argumentV1("p_actor_kind", "text"),
  argumentV1("p_attempt_token", "text", {
    nullable: true,
    sensitivity: "secret_input",
  }),
  argumentV1("p_claim_token", "text", {
    nullable: true,
    sensitivity: "secret_input",
  }),
  argumentV1("p_claim_generation", "bigint", { nullable: true }),
]);

const durableIdentityArgumentsV1 = Object.freeze([
  argumentV1("p_owner_service", "text"),
  argumentV1("p_owner_object_id", "text"),
  argumentV1("p_owner_state_version", "bigint"),
  argumentV1("p_object_class", "text"),
  ...reservationScopeArgumentsV1,
  argumentV1("p_idempotency_key", "text"),
  argumentV1("p_request_hash", "text"),
  argumentV1("p_object_fingerprint", "text"),
  argumentV1("p_expected_digest", "text", { nullable: true }),
  argumentV1("p_expected_size_bytes", "bigint", { nullable: true }),
  argumentV1("p_media_type", "text", { nullable: true }),
  argumentV1("p_retention_until", "timestamptz"),
  argumentV1("p_deletion_decision_version", "bigint", {
    nullable: true,
  }),
  argumentV1("p_gc_not_before", "timestamptz"),
]);

export const OBJECT_STORE_FUNCTION_MANIFESTS_V1 = Object.freeze([
  functionManifestV1({
    function_name: "reserve_object_operation_v1",
    arguments: [
      argumentV1("p_owner_service", "text"),
      argumentV1("p_operation", "text"),
      argumentV1("p_owner_object_id", "text"),
      argumentV1("p_owner_state_version", "bigint"),
      argumentV1("p_object_class", "text"),
      ...reservationScopeArgumentsV1,
      argumentV1("p_idempotency_key", "text"),
      argumentV1("p_request_hash", "text"),
      argumentV1("p_object_fingerprint", "text"),
      argumentV1("p_expected_digest", "text", { nullable: true }),
      argumentV1("p_expected_size_bytes", "bigint", { nullable: true }),
      argumentV1("p_media_type", "text", { nullable: true }),
      argumentV1("p_retention_until", "timestamptz"),
      argumentV1("p_deletion_decision_version", "bigint", {
        nullable: true,
      }),
      argumentV1("p_foreground_lease_token", "text", {
        sensitivity: "secret_input",
      }),
      argumentV1("p_foreground_lease_seconds", "integer"),
      argumentV1("p_gc_not_before", "timestamptz"),
    ],
    reads_tables: [
      "object_metadata_reservations",
      "object_reconcile_jobs",
    ],
    writes_tables: [
      "object_metadata_reservations",
      "object_reconcile_jobs",
    ],
    effects: [
      effectV1(
        "object_metadata_reservations",
        "create_or_replay",
        "idempotency_identity",
        [
          "id",
          "contract_version",
          "operation",
          "owner_service",
          "owner_object_id",
          "owner_state_version",
          "object_class",
          "scope_kind",
          "workspace_id",
          "bot_id",
          "owner_agent_id",
          "deployment_environment",
          "release_channel",
          "idempotency_key",
          "request_hash",
          "object_fingerprint",
          "expected_digest",
          "expected_size_bytes",
          "media_type",
          "retention_until",
          "deletion_decision_version",
          "foreground_lease_token_hash",
          "foreground_lease_expires_at",
          "generation",
          "current_attempt_no",
          "status",
          "opaque_ref",
          "gc_not_before",
          "created_at",
          "updated_at",
        ],
      ),
      effectV1(
        "object_metadata_reservations",
        "transition",
        "foreground_lease",
        [
          "foreground_lease_token_hash",
          "foreground_lease_expires_at",
          "generation",
          "status",
          "updated_at",
        ],
      ),
      effectV1(
        "object_reconcile_jobs",
        "create_or_replay",
        "foreground_lease",
        [
          "id",
          "reservation_id",
          "status",
          "retry_count",
          "next_retry_at",
          "created_at",
          "updated_at",
        ],
      ),
    ],
    returns: "jsonb",
    granted_roles: foregroundRolesV1,
    invocation_modes: ["foreground"],
  }),
  functionManifestV1({
    function_name: "start_object_operation_attempt_v1",
    arguments: [
      argumentV1("p_reservation_id", "text"),
      argumentV1("p_operation", "text"),
      argumentV1("p_expected_generation", "bigint"),
      ...durableIdentityArgumentsV1,
      ...attemptFenceArgumentsV1,
    ],
    reads_tables: [
      "object_metadata_reservations",
      "object_reconcile_jobs",
    ],
    writes_tables: [
      "object_metadata_reservations",
      "object_operation_attempts",
    ],
    effects: [
      effectV1(
        "object_metadata_reservations",
        "transition",
        "expected_generation",
        ["generation", "current_attempt_no", "status", "updated_at"],
      ),
      effectV1(
        "object_operation_attempts",
        "append",
        "attempt_fence",
        [
          "id",
          "reservation_id",
          "operation",
          "attempt_no",
          "actor_kind",
          "attempt_token_hash",
          "claim_token_hash",
          "claim_generation",
          "status",
          "started_at",
        ],
      ),
    ],
    returns: "jsonb",
    granted_roles: foregroundRolesV1,
    invocation_modes: ["foreground", "owner_internal_reconciler"],
  }),
  functionManifestV1({
    function_name: "mark_object_operation_commit_unknown_v1",
    arguments: [
      argumentV1("p_reservation_id", "text"),
      argumentV1("p_attempt_id", "text"),
      argumentV1("p_operation", "text"),
      argumentV1("p_expected_generation", "bigint"),
      ...durableIdentityArgumentsV1,
      ...attemptFenceArgumentsV1,
      argumentV1("p_provider_request_id", "text", { nullable: true }),
      argumentV1("p_provider_receipt_hash", "text", { nullable: true }),
      argumentV1("p_physical_object_fingerprint", "text", {
        nullable: true,
      }),
      argumentV1("p_error", "jsonb", { nullable: true }),
    ],
    reads_tables: [
      "object_metadata_reservations",
      "object_operation_attempts",
      "object_reconcile_jobs",
    ],
    writes_tables: [
      "object_metadata_reservations",
      "object_operation_attempts",
      "object_reconcile_jobs",
    ],
    effects: [
      effectV1(
        "object_metadata_reservations",
        "transition",
        "expected_generation",
        [
          "generation",
          "status",
          "physical_object_fingerprint",
          "updated_at",
        ],
      ),
      effectV1(
        "object_operation_attempts",
        "transition",
        "attempt_fence",
        [
          "status",
          "provider_request_id",
          "provider_receipt_hash",
          "physical_object_fingerprint",
          "error",
          "completed_at",
        ],
      ),
      effectV1(
        "object_reconcile_jobs",
        "create_or_replay",
        "attempt_fence",
        [
          "id",
          "reservation_id",
          "status",
          "retry_count",
          "created_at",
          "updated_at",
        ],
      ),
    ],
    returns: "jsonb",
    granted_roles: foregroundRolesV1,
    invocation_modes: ["foreground", "owner_internal_reconciler"],
  }),
  functionManifestV1({
    function_name: "finalize_object_operation_v1",
    arguments: [
      argumentV1("p_reservation_id", "text"),
      argumentV1("p_attempt_id", "text"),
      argumentV1("p_operation", "text"),
      argumentV1("p_expected_generation", "bigint"),
      ...durableIdentityArgumentsV1,
      ...attemptFenceArgumentsV1,
      argumentV1("p_outcome", "jsonb"),
    ],
    reads_tables: [
      "object_metadata_reservations",
      "object_operation_attempts",
      "object_terminal_proofs",
      "object_reconcile_jobs",
    ],
    writes_tables: [
      "object_metadata_reservations",
      "object_operation_attempts",
      "object_terminal_proofs",
      "object_reconcile_jobs",
    ],
    effects: [
      effectV1(
        "object_metadata_reservations",
        "transition",
        "expected_generation",
        [
          "generation",
          "status",
          "opaque_ref",
          "physical_object_fingerprint",
          "terminal_proof_hash",
          "updated_at",
        ],
      ),
      effectV1(
        "object_operation_attempts",
        "transition",
        "attempt_fence",
        [
          "status",
          "provider_receipt_hash",
          "physical_object_fingerprint",
          "result_digest",
          "result_size_bytes",
          "error",
          "completed_at",
        ],
      ),
      effectV1(
        "object_terminal_proofs",
        "immutable_proof",
        "terminal_immutability",
        [
          "id",
          "reservation_id",
          "attempt_id",
          "operation",
          "proof_kind",
          "opaque_ref",
          "provider_receipt_hash",
          "physical_object_fingerprint",
          "result_digest",
          "result_size_bytes",
          "result_media_type",
          "provider_terminal_disposition",
          "tombstone",
          "proof_hash",
          "completed_at",
          "created_at",
        ],
      ),
      effectV1(
        "object_terminal_proofs",
        "immutable_proof",
        "attempt_fence",
        ["reservation_id", "attempt_id", "proof_hash"],
      ),
      effectV1(
        "object_reconcile_jobs",
        "settle",
        "attempt_fence",
        [
          "status",
          "claim_token_hash",
          "claim_generation",
          "claim_lease_expires_at",
          "updated_at",
        ],
      ),
    ],
    returns: "jsonb",
    granted_roles: foregroundRolesV1,
    invocation_modes: ["foreground", "owner_internal_reconciler"],
  }),
  functionManifestV1({
    function_name: "claim_expired_object_reconcile_v1",
    arguments: [
      argumentV1("p_worker_id", "text"),
      argumentV1("p_limit", "integer"),
      argumentV1("p_lease_seconds", "integer"),
      argumentV1("p_reservation_id", "text", { nullable: true }),
    ],
    reads_tables: [
      "object_metadata_reservations",
      "object_reconcile_jobs",
    ],
    writes_tables: [
      "object_metadata_reservations",
      "object_reconcile_jobs",
    ],
    effects: [
      effectV1(
        "object_metadata_reservations",
        "transition",
        "foreground_lease",
        ["generation", "status", "updated_at"],
      ),
      effectV1(
        "object_reconcile_jobs",
        "claim",
        "claim_generation",
        [
          "status",
          "claim_token_hash",
          "claim_generation",
          "claim_lease_expires_at",
          "retry_count",
          "updated_at",
        ],
      ),
    ],
    returns: "setof jsonb",
    granted_roles: [OBJECT_STORE_RECONCILER_ROLE_V1],
    invocation_modes: ["reconciler"],
  }),
  functionManifestV1({
    function_name: "renew_object_reconcile_claim_v1",
    arguments: [
      argumentV1("p_reservation_id", "text"),
      argumentV1("p_operation", "text"),
      argumentV1("p_claim_token", "text", {
        sensitivity: "secret_input",
      }),
      argumentV1("p_claim_generation", "bigint"),
      argumentV1("p_expected_generation", "bigint"),
      ...durableIdentityArgumentsV1,
      argumentV1("p_expected_claim_lease_expires_at", "timestamptz"),
      argumentV1("p_lease_seconds", "integer"),
    ],
    reads_tables: [
      "object_metadata_reservations",
      "object_reconcile_jobs",
    ],
    writes_tables: ["object_reconcile_jobs"],
    effects: [
      effectV1(
        "object_reconcile_jobs",
        "transition",
        "claim_generation",
        ["claim_lease_expires_at", "updated_at"],
      ),
    ],
    returns: "jsonb",
    granted_roles: [OBJECT_STORE_RECONCILER_ROLE_V1],
    invocation_modes: ["reconciler"],
  }),
  functionManifestV1({
    function_name: "settle_object_reconcile_v1",
    arguments: [
      argumentV1("p_reservation_id", "text"),
      argumentV1("p_operation", "text"),
      argumentV1("p_claim_token", "text", {
        sensitivity: "secret_input",
      }),
      argumentV1("p_claim_generation", "bigint"),
      argumentV1("p_expected_generation", "bigint"),
      ...durableIdentityArgumentsV1,
      argumentV1("p_settlement", "jsonb"),
    ],
    reads_tables: [
      "object_metadata_reservations",
      "object_operation_attempts",
      "object_terminal_proofs",
      "object_reconcile_jobs",
    ],
    writes_tables: [
      "object_metadata_reservations",
      "object_operation_attempts",
      "object_terminal_proofs",
      "object_reconcile_jobs",
    ],
    effects: [
      effectV1(
        "object_metadata_reservations",
        "transition",
        "claim_generation",
        [
          "generation",
          "status",
          "opaque_ref",
          "physical_object_fingerprint",
          "terminal_proof_hash",
          "updated_at",
        ],
      ),
      effectV1(
        "object_operation_attempts",
        "append",
        "claim_generation",
        [
          "id",
          "reservation_id",
          "operation",
          "attempt_no",
          "actor_kind",
          "claim_token_hash",
          "claim_generation",
          "status",
          "started_at",
          "completed_at",
        ],
      ),
      effectV1(
        "object_terminal_proofs",
        "immutable_proof",
        "terminal_immutability",
        [
          "id",
          "reservation_id",
          "attempt_id",
          "operation",
          "proof_kind",
          "opaque_ref",
          "provider_receipt_hash",
          "physical_object_fingerprint",
          "result_digest",
          "result_size_bytes",
          "result_media_type",
          "provider_terminal_disposition",
          "tombstone",
          "proof_hash",
          "completed_at",
          "created_at",
        ],
      ),
      effectV1(
        "object_terminal_proofs",
        "immutable_proof",
        "claim_generation",
        ["reservation_id", "attempt_id", "proof_hash"],
      ),
      effectV1(
        "object_reconcile_jobs",
        "settle",
        "claim_generation",
        [
          "status",
          "claim_token_hash",
          "claim_generation",
          "claim_lease_expires_at",
          "next_retry_at",
          "last_error",
          "dlq_reason",
          "dlq_at",
          "updated_at",
        ],
      ),
    ],
    returns: "jsonb",
    granted_roles: [OBJECT_STORE_RECONCILER_ROLE_V1],
    invocation_modes: ["reconciler"],
  }),
  functionManifestV1({
    function_name: "get_object_operation_result_v1",
    arguments: [
      argumentV1("p_caller_kind", "text"),
      argumentV1("p_operation", "text"),
      ...durableIdentityArgumentsV1,
      argumentV1("p_reservation_id", "text", { nullable: true }),
      argumentV1("p_claim_token", "text", {
        nullable: true,
        sensitivity: "secret_input",
      }),
      argumentV1("p_claim_generation", "bigint", { nullable: true }),
    ],
    reads_tables: [
      "object_metadata_reservations",
      "object_operation_attempts",
      "object_terminal_proofs",
      "object_reconcile_jobs",
    ],
    writes_tables: [],
    effects: [],
    returns: "jsonb",
    granted_roles: foregroundAndReconcilerRolesV1,
    invocation_modes: ["foreground", "reconciler"],
  }),
] satisfies readonly ObjectStoreFunctionManifestV1[]);

export const OBJECT_STORE_ROLE_OPERATION_ALLOWLIST_V1 = Object.freeze([
  ...OBJECT_STORE_FOREGROUND_ROLE_BINDINGS_V1.map(
    ({ role, owner_service }) =>
      Object.freeze({
        role,
        owner_service,
        operations: Object.freeze([
          "put_immutable",
          "delete_if_eligible",
        ] as const),
        execute_functions: Object.freeze([
          "reserve_object_operation_v1",
          "start_object_operation_attempt_v1",
          "mark_object_operation_commit_unknown_v1",
          "finalize_object_operation_v1",
          "get_object_operation_result_v1",
        ] as const),
      }),
  ),
  Object.freeze({
    role: OBJECT_STORE_RECONCILER_ROLE_V1,
    owner_service: null,
    operations: Object.freeze([
      "put_immutable",
      "delete_if_eligible",
    ] as const),
    execute_functions: Object.freeze([
      "claim_expired_object_reconcile_v1",
      "renew_object_reconcile_claim_v1",
      "settle_object_reconcile_v1",
      "get_object_operation_result_v1",
    ] as const),
  }),
]);

export const OBJECT_STORE_TABLE_PERMISSIONS_V1 = Object.freeze(
  OBJECT_STORE_TABLES_V1.map((table_name) =>
    Object.freeze({
      table_name,
      select_columns: Object.freeze([] as const),
      insert_columns: Object.freeze([] as const),
      update_columns: Object.freeze([] as const),
      delete_allowed: false as const,
      sequence_usage_allowed: false as const,
      granted_roles: Object.freeze([] as const),
    }),
  ),
);

export const OBJECT_STORE_FOREIGN_KEYS_V1 = Object.freeze([
  Object.freeze({
    table_name: "object_operation_attempts" as const,
    columns: Object.freeze(["reservation_id"] as const),
    referenced_table: "object_metadata_reservations" as const,
    referenced_columns: Object.freeze(["id"] as const),
  }),
  Object.freeze({
    table_name: "object_operation_attempts" as const,
    columns: Object.freeze(["reservation_id", "operation"] as const),
    referenced_table: "object_metadata_reservations" as const,
    referenced_columns: Object.freeze(["id", "operation"] as const),
  }),
  Object.freeze({
    table_name: "object_terminal_proofs" as const,
    columns: Object.freeze(["reservation_id"] as const),
    referenced_table: "object_metadata_reservations" as const,
    referenced_columns: Object.freeze(["id"] as const),
  }),
  Object.freeze({
    table_name: "object_terminal_proofs" as const,
    columns: Object.freeze(["reservation_id", "operation"] as const),
    referenced_table: "object_metadata_reservations" as const,
    referenced_columns: Object.freeze(["id", "operation"] as const),
  }),
  Object.freeze({
    table_name: "object_terminal_proofs" as const,
    columns: Object.freeze(["attempt_id"] as const),
    referenced_table: "object_operation_attempts" as const,
    referenced_columns: Object.freeze(["id"] as const),
  }),
  Object.freeze({
    table_name: "object_reconcile_jobs" as const,
    columns: Object.freeze(["reservation_id"] as const),
    referenced_table: "object_metadata_reservations" as const,
    referenced_columns: Object.freeze(["id"] as const),
  }),
]);

export const OBJECT_STORE_REQUIRED_INDEXES_V1 = Object.freeze([
  Object.freeze({
    index_name: "object_metadata_reconcile_scan_idx" as const,
    table_name: "object_metadata_reservations" as const,
    columns: Object.freeze([
      "status",
      "foreground_lease_expires_at",
      "updated_at",
    ] as const),
    predicate:
      "status IN ('reserved', 'executing', 'commit_unknown', 'reconcile_required')" as const,
  }),
  Object.freeze({
    index_name: "object_reconcile_jobs_scan_idx" as const,
    table_name: "object_reconcile_jobs" as const,
    columns: Object.freeze(["status", "next_retry_at", "updated_at"] as const),
    predicate: "status IN ('pending', 'retry_wait')" as const,
  }),
  Object.freeze({
    index_name: "object_metadata_gc_scan_idx" as const,
    table_name: "object_metadata_reservations" as const,
    columns: Object.freeze([
      "gc_not_before",
      "owner_service",
      "object_class",
    ] as const),
    predicate:
      "status IN ('succeeded', 'tombstoned', 'failed')" as const,
  }),
]);

export interface ObjectStorePermissionManifestV1 {
  readonly manifest_version: typeof OBJECT_STORE_PERMISSION_MANIFEST_VERSION_V1;
  readonly schema: typeof OBJECT_STORE_SCHEMA_V1;
  readonly fresh_migration: typeof OBJECT_STORE_FRESH_MIGRATION_V1;
  readonly metadata_contract_source:
    "packages/object-store/src/db/metadata-contract.v1.ts";
  readonly manifest_source:
    "packages/object-store/src/db/permission-manifest.v1.ts";
  readonly generated_permission_sql:
    typeof OBJECT_STORE_GENERATED_PERMISSION_SQL_V1;
  readonly migration_owner_repository: "pai-infra";
  readonly tables: typeof OBJECT_STORE_TABLES_V1;
  readonly table_permissions: typeof OBJECT_STORE_TABLE_PERMISSIONS_V1;
  readonly function_manifests: typeof OBJECT_STORE_FUNCTION_MANIFESTS_V1;
  readonly role_operation_allowlist:
    typeof OBJECT_STORE_ROLE_OPERATION_ALLOWLIST_V1;
  readonly foreign_keys: typeof OBJECT_STORE_FOREIGN_KEYS_V1;
  readonly required_indexes: typeof OBJECT_STORE_REQUIRED_INDEXES_V1;
  readonly public_roles: readonly ["PUBLIC", "anon", "authenticated"];
  readonly public_schema_usage: false;
  readonly public_function_execute: false;
  readonly runtime_table_dml: false;
  readonly runtime_sequence_usage: false;
}

function sameValues(
  actual: readonly string[],
  expected: readonly string[],
): boolean {
  return (
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  );
}

function sameManifestValue(actual: unknown, expected: unknown): boolean {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function expectedGrantForWriter(
  writerName: ObjectStoreWriterNameV1,
): readonly ObjectStoreRuntimeRoleV1[] {
  if (
    writerName === "claim_expired_object_reconcile_v1" ||
    writerName === "renew_object_reconcile_claim_v1" ||
    writerName === "settle_object_reconcile_v1"
  ) {
    return [OBJECT_STORE_RECONCILER_ROLE_V1];
  }
  if (writerName === "get_object_operation_result_v1") {
    return foregroundAndReconcilerRolesV1;
  }
  return foregroundRolesV1;
}

export function assertObjectStorePermissionManifestV1(
  manifest: ObjectStorePermissionManifestV1,
): ObjectStorePermissionManifestV1 {
  assertCanonicalJsonBoundaryV1(manifest, {
    max_bytes: 1_048_576,
    max_depth: 32,
    max_nodes: 10_000,
    max_container_entries: 1_000,
  });
  if (
    manifest.manifest_version !==
      OBJECT_STORE_PERMISSION_MANIFEST_VERSION_V1 ||
    manifest.schema !== OBJECT_STORE_SCHEMA_V1 ||
    manifest.fresh_migration !== OBJECT_STORE_FRESH_MIGRATION_V1 ||
    manifest.metadata_contract_source !==
      "packages/object-store/src/db/metadata-contract.v1.ts" ||
    manifest.manifest_source !==
      "packages/object-store/src/db/permission-manifest.v1.ts" ||
    manifest.generated_permission_sql !==
      OBJECT_STORE_GENERATED_PERMISSION_SQL_V1 ||
    manifest.migration_owner_repository !== "pai-infra" ||
    manifest.public_schema_usage !== false ||
    manifest.public_function_execute !== false ||
    manifest.runtime_table_dml !== false ||
    manifest.runtime_sequence_usage !== false
  ) {
    throw new Error("object-store manifest authority or default-deny drift");
  }
  if (
    !sameValues(manifest.tables, OBJECT_STORE_TABLES_V1) ||
    !sameValues(
      manifest.public_roles,
      ["PUBLIC", "anon", "authenticated"],
    ) ||
    manifest.table_permissions.length !== OBJECT_STORE_TABLES_V1.length
  ) {
    throw new Error("object-store table coverage drift");
  }
  const permissionByTable = new Map(
    manifest.table_permissions.map((permission) => [
      permission.table_name,
      permission,
    ]),
  );
  for (const table of OBJECT_STORE_TABLES_V1) {
    const permission = permissionByTable.get(table);
    if (
      permission === undefined ||
      permission.select_columns.length !== 0 ||
      permission.insert_columns.length !== 0 ||
      permission.update_columns.length !== 0 ||
      permission.delete_allowed !== false ||
      permission.sequence_usage_allowed !== false ||
      permission.granted_roles.length !== 0
    ) {
      throw new Error(`object-store table access must be writer-only: ${table}`);
    }
  }
  if (
    manifest.function_manifests.length !==
      OBJECT_STORE_WRITER_NAMES_V1.length ||
    !sameValues(
      manifest.function_manifests.map(({ function_name }) => function_name),
      OBJECT_STORE_WRITER_NAMES_V1,
    )
  ) {
    throw new Error("object-store writer ABI coverage drift");
  }
  for (const writer of manifest.function_manifests) {
    const derived = derivedFunctionContractV1(writer.function_name);
    const argumentNames = writer.arguments.map(
      ({ argument_name }) => argument_name,
    );
    if (
      writer.schema !== OBJECT_STORE_SCHEMA_V1 ||
      writer.top_level_operation !== derived.top_level_operation ||
      writer.request_schema_id !== derived.request_schema_id ||
      writer.response_schema_id !== derived.response_schema_id ||
      writer.atomicity !== "single_transaction" ||
      writer.outbox_effect !== "none" ||
      writer.security_definer !== true ||
      !sameValues(writer.search_path, fixedSearchPathV1) ||
      !sameValues(writer.lock_order, derived.lock_order) ||
      new Set(writer.lock_order).size !== writer.lock_order.length ||
      writer.lock_order.some(
        (table, index) =>
          index > 0 &&
          OBJECT_STORE_LOCK_ORDER_V1.indexOf(
              writer.lock_order[index - 1]!,
            ) >= OBJECT_STORE_LOCK_ORDER_V1.indexOf(table),
      ) ||
      writer.reads_tables.some(
        (table) => !writer.lock_order.includes(table),
      ) ||
      writer.writes_tables.some(
        (table) => !writer.lock_order.includes(table),
      ) ||
      new Set(argumentNames).size !== argumentNames.length ||
      argumentNames.some((name) => !/^p_[a-z][a-z0-9_]*$/u.test(name)) ||
      !sameValues(
        writer.granted_roles,
        expectedGrantForWriter(writer.function_name),
      ) ||
      writer.writes_tables.some(
        (table) =>
          !writer.effects.some((effect) => effect.table_name === table),
      ) ||
      writer.effects.some(
        (effect) =>
          !writer.writes_tables.includes(effect.table_name) ||
          effect.columns.length === 0 ||
          new Set(effect.columns).size !== effect.columns.length ||
          effect.columns.some(
            (column) =>
              !OBJECT_STORE_TABLE_COLUMNS_V1[effect.table_name].includes(
                column as never,
              ),
          ),
      ) ||
      !sameManifestValue(writer.audit_effects, derived.audit_effects) ||
      writer.audit_effects.some(
        (effect) =>
          effect.columns.length === 0 ||
          new Set(effect.columns).size !== effect.columns.length ||
          effect.columns.some(
            (column) =>
              !OBJECT_STORE_TABLE_COLUMNS_V1[effect.table_name].includes(
                column as never,
              ),
          ),
      )
    ) {
      throw new Error(
        `invalid object-store writer contract: ${writer.function_name}`,
      );
    }
    const plaintextSecrets = writer.arguments.filter(
      ({ sensitivity }) => sensitivity === "secret_input",
    );
    if (
      plaintextSecrets.some(
        ({ argument_name }) =>
          !argument_name.endsWith("_token") ||
          argument_name.endsWith("_token_hash"),
      )
    ) {
      throw new Error(
        `object-store token input classification drift: ${writer.function_name}`,
      );
    }
  }
  const roleBindings = new Map(
    manifest.role_operation_allowlist.map((binding) => [
      binding.role,
      binding,
    ]),
  );
  if (
    manifest.role_operation_allowlist.length !==
      OBJECT_STORE_FOREGROUND_ROLE_BINDINGS_V1.length + 1 ||
    roleBindings.size !== manifest.role_operation_allowlist.length
  ) {
    throw new Error("object-store role allowlist coverage drift");
  }
  for (const binding of OBJECT_STORE_FOREGROUND_ROLE_BINDINGS_V1) {
    const allowlist = roleBindings.get(binding.role);
    if (
      allowlist === undefined ||
      allowlist.owner_service !== binding.owner_service ||
      !sameValues(allowlist.operations, [
        "put_immutable",
        "delete_if_eligible",
      ]) ||
      !sameValues(allowlist.execute_functions, [
        "reserve_object_operation_v1",
        "start_object_operation_attempt_v1",
        "mark_object_operation_commit_unknown_v1",
        "finalize_object_operation_v1",
        "get_object_operation_result_v1",
      ])
    ) {
      throw new Error(`object-store foreground role drift: ${binding.role}`);
    }
  }
  const reconciler = roleBindings.get(OBJECT_STORE_RECONCILER_ROLE_V1);
  if (
    reconciler === undefined ||
    reconciler.owner_service !== null ||
    !sameValues(reconciler.execute_functions, [
      "claim_expired_object_reconcile_v1",
      "renew_object_reconcile_claim_v1",
      "settle_object_reconcile_v1",
      "get_object_operation_result_v1",
    ])
  ) {
    throw new Error("object-store reconciler grant partition drift");
  }
  if (
    !sameManifestValue(
      manifest.table_permissions,
      OBJECT_STORE_TABLE_PERMISSIONS_V1,
    ) ||
    !sameManifestValue(
      manifest.function_manifests,
      OBJECT_STORE_FUNCTION_MANIFESTS_V1,
    ) ||
    !sameManifestValue(
      manifest.role_operation_allowlist,
      OBJECT_STORE_ROLE_OPERATION_ALLOWLIST_V1,
    ) ||
    !sameManifestValue(manifest.foreign_keys, OBJECT_STORE_FOREIGN_KEYS_V1) ||
    !sameManifestValue(
      manifest.required_indexes,
      OBJECT_STORE_REQUIRED_INDEXES_V1,
    )
  ) {
    throw new Error("object-store executable manifest fingerprint drift");
  }
  return manifest;
}

export const OBJECT_STORE_PERMISSION_MANIFEST_V1 =
  assertObjectStorePermissionManifestV1(
    Object.freeze({
      manifest_version: OBJECT_STORE_PERMISSION_MANIFEST_VERSION_V1,
      schema: OBJECT_STORE_SCHEMA_V1,
      fresh_migration: OBJECT_STORE_FRESH_MIGRATION_V1,
      metadata_contract_source:
        "packages/object-store/src/db/metadata-contract.v1.ts",
      manifest_source:
        "packages/object-store/src/db/permission-manifest.v1.ts",
      generated_permission_sql: OBJECT_STORE_GENERATED_PERMISSION_SQL_V1,
      migration_owner_repository: "pai-infra",
      tables: OBJECT_STORE_TABLES_V1,
      table_permissions: OBJECT_STORE_TABLE_PERMISSIONS_V1,
      function_manifests: OBJECT_STORE_FUNCTION_MANIFESTS_V1,
      role_operation_allowlist:
        OBJECT_STORE_ROLE_OPERATION_ALLOWLIST_V1,
      foreign_keys: OBJECT_STORE_FOREIGN_KEYS_V1,
      required_indexes: OBJECT_STORE_REQUIRED_INDEXES_V1,
      public_roles: Object.freeze([
        "PUBLIC",
        "anon",
        "authenticated",
      ] as const),
      public_schema_usage: false,
      public_function_execute: false,
      runtime_table_dml: false,
      runtime_sequence_usage: false,
    }),
  );

export function objectStorePermissionManifestFingerprintV1(
  manifest: ObjectStorePermissionManifestV1,
): `sha256:${string}` {
  const digest = createHash("sha256")
    .update(JSON.stringify(manifest))
    .digest("hex");
  return `sha256:${digest}`;
}

/**
 * pai-infra must embed this exact fingerprint into migration 0050. Until a
 * live verifier compares it with pg_proc/ACL/proconfig/function-body evidence,
 * this remains a generation input rather than deployment proof.
 */
export const OBJECT_STORE_PERMISSION_MANIFEST_FINGERPRINT_V1 =
  objectStorePermissionManifestFingerprintV1(
    OBJECT_STORE_PERMISSION_MANIFEST_V1,
  );

export function objectStoreOwnerServiceForRoleV1(
  role: string,
): ObjectMetadataOwnerServiceV1 | undefined {
  return OBJECT_STORE_FOREGROUND_ROLE_BINDINGS_V1.find(
    (binding) => binding.role === role,
  )?.owner_service;
}
