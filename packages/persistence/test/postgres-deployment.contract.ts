import { randomUUID } from "node:crypto";

import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it as baseIt } from "vitest";
import { TRIGGER_PROCESS_STATE_V1_DATABASE_CHECK } from "@pai/contracts";

import {
  OWNER_EVENTING_TRANSPORT_EPOCH_TABLE_V1,
  OWNER_EVENTING_TRANSPORT_EPOCH_WRITER_V1,
  OWNER_OUTBOX_BATCH_MAX_V1,
  OWNER_SAFE_BIGINT_MAX_V1,
  OwnerRepositoryTransientErrorV1,
  type OwnerOutboxAcknowledgeRequestV1,
  type OwnerOutboxClaimRequestV1,
  type OwnerUnitOfWorkRequestV1,
  type PostgresQueryPortV1,
  createVerifiedOwnerPostgresRepositoryV1,
  defineOwnerRepositoryContractV1,
  openVerifiedOwnerPostgresCompositionV1,
  ownerEventingTransportEpochActivationSignatureV1,
  ownerEventingTransportEpochTablePermissionV1,
  ownerFunctionSignatureV1,
  ownerImmutableTriggerV1,
  ownerWriterArtifactV1,
  verifyOwnerRepositoryDeploymentFromPostgresV1,
} from "../src/index.js";
import { checkOwnerPostgresReadinessV1 } from "../src/owner-postgres-readiness.v1.js";

// The verifier drops and rebuilds its `timer` schema by design. Keep that
// destructive fixture in a dedicated database when the workspace gate also
// runs Timer service integration tests against the shared test database.
const configuredDatabaseUrl =
  process.env.PAI_PERSISTENCE_TEST_DATABASE_URL ?? process.env.PAI_TEST_DATABASE_URL;
let databaseUrl = configuredDatabaseUrl;
const it = baseIt.sequential;

function quotePostgresIdentifier(value: string): string {
  if (!/^[a-z_][a-z0-9_]{0,62}$/u.test(value)) {
    throw new Error(`unsafe PostgreSQL identifier: ${value}`);
  }
  return `"${value}"`;
}

function databaseUrlForDatabase(baseUrl: string, databaseName: string): string {
  const value = new URL(baseUrl);
  value.pathname = `/${databaseName}`;
  return value.toString();
}

function databaseUrlForRuntime(baseUrl: string): string {
  const value = new URL(baseUrl);
  value.username = "pai_timer_runtime";
  value.password = "timer-runtime-test";
  return value.toString();
}

async function waitForDatabaseConnectionsToClose(
  adminPool: Pool,
  databaseName: string,
): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const result = await adminPool.query<{
      active_connections: string;
      connection_states: string | null;
    }>(
      `SELECT count(*)::text AS active_connections,
              string_agg(
                coalesce(usename, 'unknown') || ':' || coalesce(state, 'unknown') ||
                ':' || left(coalesce(query, ''), 160),
                ',' ORDER BY pid
              ) AS connection_states
         FROM pg_catalog.pg_stat_activity
        WHERE datname = $1
          AND backend_type = 'client backend'
          AND pid <> pg_catalog.pg_backend_pid()`,
      [databaseName],
    );
    if (result.rows[0]?.active_connections === "0") return;
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 20);
    });
  }
  const result = await adminPool.query<{
    connection_states: string | null;
  }>(
    `SELECT string_agg(
              coalesce(usename, 'unknown') || ':' || coalesce(state, 'unknown') ||
              ':' || left(coalesce(query, ''), 160),
              ',' ORDER BY pid
            ) AS connection_states
       FROM pg_catalog.pg_stat_activity
      WHERE datname = $1
        AND backend_type = 'client backend'
        AND pid <> pg_catalog.pg_backend_pid()`,
    [databaseName],
  );
  throw new Error(
    `test database ${databaseName} still has active connections: ${
      result.rows[0]?.connection_states ?? "unknown"
    }`,
  );
}

const transientRoleCleanupSql = `
DO $cleanup$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY[
    'pai_contract_deployer',
    'pai_contract_rogue_deployer',
    'pai_memory_runtime_test',
    'pai_owner_rogue',
    'pai_timer_intruder',
    'pai_timer_runtime_test'
  ] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('DROP OWNED BY %I', role_name);
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pai_contract_deployer') THEN
    REVOKE pai_migrator FROM pai_contract_deployer;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pai_contract_rogue_deployer') THEN
    REVOKE pai_migrator FROM pai_contract_rogue_deployer;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pai_memory_runtime_test') THEN
    REVOKE pai_memory_app FROM pai_memory_runtime_test;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pai_owner_rogue') THEN
    REVOKE pai_migrator FROM pai_owner_rogue;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pai_timer_intruder') THEN
    REVOKE pai_timer_app FROM pai_timer_intruder;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pai_timer_runtime_test') THEN
    REVOKE pai_timer_app FROM pai_timer_runtime_test;
  END IF;
END
$cleanup$;
DROP ROLE IF EXISTS pai_contract_rogue_deployer;
DROP ROLE IF EXISTS pai_contract_deployer;
DROP ROLE IF EXISTS pai_memory_runtime_test;
DROP ROLE IF EXISTS pai_owner_rogue;
DROP ROLE IF EXISTS pai_timer_intruder;
DROP ROLE IF EXISTS pai_timer_runtime_test;
`;

const POSTGRES_WRITER_SIGNATURE = ownerFunctionSignatureV1({
  schema: "timer",
  function_name: "write_contract_child_v1",
  primary_table: "contract_children",
  writer_kind: "state_transition",
  arguments: [
    ["p_parent_key", "text"],
    ["p_expected_parent_version", "bigint"],
    ["p_child_id", "text"],
    ["p_payload", "jsonb", { nullable: true }],
  ],
  reads_tables: ["contract_parents"],
  writes_tables: [
    "contract_parents",
    "contract_children",
    "contract_audits",
  ],
  effects: [
    { table_name: "contract_parents", operation: "append", concurrency_control: "expected_version" },
    { table_name: "contract_children", operation: "append", concurrency_control: "idempotency_key" },
    { table_name: "contract_audits", operation: "append", concurrency_control: "idempotency_key" },
  ],
  returns: "jsonb",
});

const POSTGRES_WRITER_BODY = `
DECLARE
  current_version bigint;
  next_version bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_parent_key, 0));
  SELECT parent_version INTO current_version
    FROM timer.contract_parents WHERE parent_key = p_parent_key
    ORDER BY parent_version DESC LIMIT 1 FOR UPDATE;
  current_version := COALESCE(current_version, 0);
  IF p_expected_parent_version IS NULL
     OR current_version IS DISTINCT FROM p_expected_parent_version THEN
    RAISE EXCEPTION 'stale parent version';
  END IF;
  next_version := current_version + 1;
  INSERT INTO timer.contract_parents(parent_key, parent_version)
    VALUES (p_parent_key, next_version);
  INSERT INTO timer.contract_children(child_id, parent_key, parent_version, payload)
    VALUES (p_child_id, p_parent_key, next_version, COALESCE(p_payload, '{}'::jsonb));
  INSERT INTO timer.contract_audits(audit_id, child_id, created_at)
    VALUES ('audit-' || p_child_id, p_child_id, clock_timestamp());
  IF p_payload ? 'force_failure' THEN
    RAISE EXCEPTION 'forced writer failure';
  END IF;
  RETURN jsonb_build_object('parent_version', next_version, 'child_id', p_child_id);
END;
`;

const POSTGRES_TRANSPORT_SIGNATURE =
  ownerEventingTransportEpochActivationSignatureV1("timer");

const POSTGRES_OUTBOX_CLAIM_SIGNATURE = ownerFunctionSignatureV1({
  schema: "timer",
  function_name: "claim_contract_outbox_v1",
  primary_table: "contract_outbox",
  writer_kind: "outbox_claim_ack",
  arguments: [
    ["p_worker_id", "text"],
    ["p_limit", "integer"],
    ["p_lease_seconds", "integer"],
    ["p_now", "timestamptz"],
    ["p_current_transport_epoch", "text"],
    ["p_current_transport_generation", "bigint"],
  ],
  reads_tables: ["contract_outbox", OWNER_EVENTING_TRANSPORT_EPOCH_TABLE_V1],
  writes_tables: ["contract_outbox"],
  effects: [
    {
      table_name: "contract_outbox",
      operation: "claim",
      concurrency_control: "lease_fence",
    },
  ],
  returns: "setof jsonb",
});

const POSTGRES_OUTBOX_ACK_SIGNATURE = ownerFunctionSignatureV1({
  schema: "timer",
  function_name: "ack_contract_outbox_v1",
  primary_table: "contract_outbox",
  writer_kind: "outbox_claim_ack",
  arguments: [
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
  reads_tables: ["contract_outbox", OWNER_EVENTING_TRANSPORT_EPOCH_TABLE_V1],
  writes_tables: ["contract_outbox"],
  effects: [
    {
      table_name: "contract_outbox",
      operation: "ack",
      concurrency_control: "lease_fence",
    },
  ],
  returns: "jsonb",
});

const POSTGRES_TRANSPORT_BODY = `
DECLARE
  v_active_generation bigint;
  v_transport_name text;
BEGIN
  SELECT active_generation
    INTO v_active_generation
    FROM timer.eventing_transport_epochs
   WHERE transport_name = p_transport_name
   FOR UPDATE;
  IF NOT FOUND
     OR v_active_generation IS DISTINCT FROM p_expected_generation
     OR p_next_generation IS DISTINCT FROM p_expected_generation + 1 THEN
    RAISE EXCEPTION 'stale transport generation';
  END IF;
  UPDATE timer.eventing_transport_epochs
     SET active_epoch = p_next_epoch,
         active_generation = p_next_generation,
         activated_at = p_now
   WHERE transport_name = p_transport_name
     AND active_generation = p_expected_generation
   RETURNING transport_name INTO v_transport_name;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'stale transport generation';
  END IF;
  RETURN jsonb_build_object('activated', true, 'transport_name', v_transport_name);
END;
`;

const POSTGRES_OUTBOX_CLAIM_BODY = `
DECLARE
  v_active_epoch text;
  v_active_generation bigint;
BEGIN
  SELECT active_epoch, active_generation
    INTO v_active_epoch, v_active_generation
    FROM timer.eventing_transport_epochs
   WHERE transport_name = 'redis_stream'
   FOR UPDATE;
  IF NOT FOUND
     OR v_active_epoch IS DISTINCT FROM p_current_transport_epoch
     OR v_active_generation IS DISTINCT FROM p_current_transport_generation THEN
    RAISE EXCEPTION 'stale active transport generation';
  END IF;
  RETURN QUERY
  WITH candidates AS (
    SELECT id
      FROM timer.contract_outbox
     WHERE status IN ('pending', 'retry_wait')
       AND (next_retry_at IS NULL OR next_retry_at <= p_now)
     ORDER BY updated_at, id
     FOR UPDATE SKIP LOCKED
     LIMIT p_limit
  ), claimed AS (
    UPDATE timer.contract_outbox AS outbox
       SET status = 'processing',
           attempt_count = outbox.attempt_count + 1,
           claimed_by = p_worker_id,
           claim_token = p_worker_id || ':' || outbox.id || ':' || (outbox.attempt_count + 1)::text,
           locked_until = p_now + make_interval(secs => p_lease_seconds),
           updated_at = p_now
      FROM candidates
     WHERE outbox.id = candidates.id
     RETURNING outbox.id, outbox.payload, outbox.claim_token
  )
  SELECT jsonb_build_object(
    'outbox_id', claimed.id,
    'payload', claimed.payload,
    'claim_token', claimed.claim_token
  )
    FROM claimed;
END;
`;

const POSTGRES_OUTBOX_ACK_BODY = `
DECLARE
  v_active_epoch text;
  v_active_generation bigint;
  v_outbox_id text;
BEGIN
  SELECT active_epoch, active_generation
    INTO v_active_epoch, v_active_generation
    FROM timer.eventing_transport_epochs
   WHERE transport_name = 'redis_stream'
   FOR UPDATE;
  IF NOT FOUND
     OR v_active_epoch IS DISTINCT FROM p_current_transport_epoch
     OR v_active_generation IS DISTINCT FROM p_current_transport_generation THEN
    RAISE EXCEPTION 'stale active transport generation';
  END IF;
  UPDATE timer.contract_outbox
     SET status = p_outcome,
         next_retry_at = p_next_retry_at,
         last_error = p_error,
         transport_ref = p_transport_ref,
         transport_epoch = p_transport_epoch,
         transport_generation = p_transport_generation,
         sent_at = CASE WHEN p_outcome = 'sent' THEN p_now ELSE sent_at END,
         claimed_by = NULL,
         claim_token = NULL,
         locked_until = NULL,
         updated_at = p_now
   WHERE id = p_outbox_id
     AND status = 'processing'
     AND claim_token = p_claim_token
   RETURNING id INTO v_outbox_id;
  RETURN jsonb_build_object('acknowledged', v_outbox_id IS NOT NULL);
END;
`;

const POSTGRES_IMMUTABLE_TRIGGER_BODY = `
BEGIN
  RAISE EXCEPTION 'contract_audits is immutable'
    USING ERRCODE = '55000';
END;
`;

const POSTGRES_IMMUTABLE_TRIGGER = ownerImmutableTriggerV1({
  trigger_name: "contract_audits_immutable",
  table_name: "contract_audits",
  function_name: "reject_contract_audit_mutation_v1",
  function_body: POSTGRES_IMMUTABLE_TRIGGER_BODY,
});

const POSTGRES_CONTRACT = defineOwnerRepositoryContractV1({
  contract_version: "owner_repository_contract.v1",
  owner_service: "timer_trigger_app",
  schema: "timer",
  app_role: "pai_timer_app",
  fresh_migrations: ["0300_timer"],
  manifest_source: "services/timer-trigger-app/src/db/permission-manifest.v1.ts",
  generated_permission_sql: [
    "pai-infra/supabase/generated/permissions/0300_timer.sql",
  ],
  tables: [
    "contract_parents",
    "contract_children",
    "contract_audits",
    OWNER_EVENTING_TRANSPORT_EPOCH_TABLE_V1,
    "contract_outbox",
  ],
  table_permissions: [
    {
      table_name: "contract_parents",
      select_columns: ["parent_key", "parent_version"],
      insert_columns: [],
      update_columns: [],
      delete_allowed: false,
      writer_kind: "state_transition",
    },
    {
      table_name: "contract_children",
      select_columns: ["child_id", "parent_key", "parent_version", "payload"],
      insert_columns: [],
      update_columns: [],
      delete_allowed: false,
      writer_kind: "state_transition",
    },
    {
      table_name: "contract_audits",
      select_columns: ["audit_id", "child_id", "created_at"],
      insert_columns: [],
      update_columns: [],
      delete_allowed: false,
      writer_kind: "immutable_append",
    },
    ownerEventingTransportEpochTablePermissionV1(),
    {
      table_name: "contract_outbox",
      select_columns: [
        "id",
        "status",
        "attempt_count",
        "payload",
        "next_retry_at",
        "last_error",
        "transport_ref",
        "transport_epoch",
        "transport_generation",
        "sent_at",
        "updated_at",
      ],
      insert_columns: [],
      update_columns: [],
      delete_allowed: false,
      writer_kind: "outbox_claim_ack",
    },
  ],
  mutable_writers: [
    "write_contract_child_v1",
    OWNER_EVENTING_TRANSPORT_EPOCH_WRITER_V1,
    "claim_contract_outbox_v1",
    "ack_contract_outbox_v1",
  ],
  function_signatures: [
    POSTGRES_WRITER_SIGNATURE,
    POSTGRES_TRANSPORT_SIGNATURE,
    POSTGRES_OUTBOX_CLAIM_SIGNATURE,
    POSTGRES_OUTBOX_ACK_SIGNATURE,
  ],
  writer_artifacts: [
    ownerWriterArtifactV1({
      signature: POSTGRES_WRITER_SIGNATURE,
      generator_source:
        "pai-infra/supabase/generated/permissions/0300_timer.sql",
      function_body: POSTGRES_WRITER_BODY,
    }),
    ownerWriterArtifactV1({
      signature: POSTGRES_TRANSPORT_SIGNATURE,
      generator_source:
        "pai-infra/supabase/generated/permissions/0300_timer.sql",
      function_body: POSTGRES_TRANSPORT_BODY,
    }),
    ownerWriterArtifactV1({
      signature: POSTGRES_OUTBOX_CLAIM_SIGNATURE,
      generator_source:
        "pai-infra/supabase/generated/permissions/0300_timer.sql",
      function_body: POSTGRES_OUTBOX_CLAIM_BODY,
    }),
    ownerWriterArtifactV1({
      signature: POSTGRES_OUTBOX_ACK_SIGNATURE,
      generator_source:
        "pai-infra/supabase/generated/permissions/0300_timer.sql",
      function_body: POSTGRES_OUTBOX_ACK_BODY,
    }),
  ],
  immutable_triggers: [POSTGRES_IMMUTABLE_TRIGGER],
  foreign_key_snapshot: {
    status: "complete",
    source: "postgres deployment contract fixture",
  },
  foreign_keys: [
    {
      constraint_name: "contract_children_parent_fk",
      table_name: "contract_children",
      columns: ["parent_key", "parent_version"],
      referenced_schema: "timer",
      referenced_table: "contract_parents",
      referenced_columns: ["parent_key", "parent_version"],
      match_type: "simple",
      on_update: "no_action",
      on_delete: "no_action",
      deferrable: false,
      initially_deferred: false,
      validated: true,
    },
  ],
  database_checks: [
    {
      constraint_name: "eventing_transport_epochs_active_generation_safe_check",
      table_name: OWNER_EVENTING_TRANSPORT_EPOCH_TABLE_V1,
      required_definition_fragments: [
        "active_generation >= 1",
        String(OWNER_SAFE_BIGINT_MAX_V1),
      ],
      semantic_constraint: {
        kind: "integer_range",
        column_name: "active_generation",
        min: 1,
        max: OWNER_SAFE_BIGINT_MAX_V1,
      },
    },
  ],
  database_columns: [
    {
      table_name: "contract_parents",
      column_name: "parent_key",
      postgres_type: "text",
      not_null: true,
      default_expression: null,
      identity: "",
      generated: "",
    },
    {
      table_name: "contract_parents",
      column_name: "parent_version",
      postgres_type: "bigint",
      not_null: true,
      default_expression: null,
      identity: "",
      generated: "",
    },
    {
      table_name: "contract_children",
      column_name: "child_id",
      postgres_type: "text",
      not_null: true,
      default_expression: null,
      identity: "",
      generated: "",
    },
    {
      table_name: "contract_children",
      column_name: "parent_key",
      postgres_type: "text",
      not_null: true,
      default_expression: null,
      identity: "",
      generated: "",
    },
    {
      table_name: "contract_children",
      column_name: "parent_version",
      postgres_type: "bigint",
      not_null: true,
      default_expression: null,
      identity: "",
      generated: "",
    },
    {
      table_name: "contract_children",
      column_name: "payload",
      postgres_type: "jsonb",
      not_null: true,
      default_expression: null,
      identity: "",
      generated: "",
    },
    {
      table_name: "contract_audits",
      column_name: "audit_id",
      postgres_type: "text",
      not_null: true,
      default_expression: null,
      identity: "",
      generated: "",
    },
    {
      table_name: "contract_audits",
      column_name: "child_id",
      postgres_type: "text",
      not_null: true,
      default_expression: null,
      identity: "",
      generated: "",
    },
    {
      table_name: "contract_audits",
      column_name: "created_at",
      postgres_type: "timestamp with time zone",
      not_null: true,
      default_expression: null,
      identity: "",
      generated: "",
    },
    ...[
      [OWNER_EVENTING_TRANSPORT_EPOCH_TABLE_V1, "transport_name", "text", true],
      [OWNER_EVENTING_TRANSPORT_EPOCH_TABLE_V1, "active_epoch", "text", true],
      [OWNER_EVENTING_TRANSPORT_EPOCH_TABLE_V1, "active_generation", "bigint", true],
      [OWNER_EVENTING_TRANSPORT_EPOCH_TABLE_V1, "activated_at", "timestamp with time zone", true],
      ["contract_outbox", "id", "text", true],
      ["contract_outbox", "status", "text", true],
      ["contract_outbox", "attempt_count", "integer", true],
      ["contract_outbox", "payload", "jsonb", true],
      ["contract_outbox", "claimed_by", "text", false],
      ["contract_outbox", "claim_token", "text", false],
      ["contract_outbox", "locked_until", "timestamp with time zone", false],
      ["contract_outbox", "next_retry_at", "timestamp with time zone", false],
      ["contract_outbox", "last_error", "jsonb", false],
      ["contract_outbox", "transport_ref", "text", false],
      ["contract_outbox", "transport_epoch", "text", false],
      ["contract_outbox", "transport_generation", "bigint", false],
      ["contract_outbox", "sent_at", "timestamp with time zone", false],
      ["contract_outbox", "updated_at", "timestamp with time zone", true],
    ].map(([table_name, column_name, postgres_type, not_null]) => ({
      table_name: table_name as
        | typeof OWNER_EVENTING_TRANSPORT_EPOCH_TABLE_V1
        | "contract_outbox",
      column_name: column_name as string,
      postgres_type: postgres_type as string,
      not_null: not_null as boolean,
      default_expression: null,
      identity: "" as const,
      generated: "" as const,
    })),
  ],
  database_unique_constraints: [
    {
      constraint_name: "contract_audits_pkey",
      table_name: "contract_audits",
      columns: ["audit_id"],
      kind: "primary_key",
      deferrable: false,
      initially_deferred: false,
      validated: true,
    },
    {
      constraint_name: "contract_children_pkey",
      table_name: "contract_children",
      columns: ["child_id"],
      kind: "primary_key",
      deferrable: false,
      initially_deferred: false,
      validated: true,
    },
    {
      constraint_name: "contract_parents_pkey",
      table_name: "contract_parents",
      columns: ["parent_key", "parent_version"],
      kind: "primary_key",
      deferrable: false,
      initially_deferred: false,
      validated: true,
    },
    {
      constraint_name: "eventing_transport_epochs_pkey",
      table_name: OWNER_EVENTING_TRANSPORT_EPOCH_TABLE_V1,
      columns: ["transport_name"],
      kind: "primary_key",
      deferrable: false,
      initially_deferred: false,
      validated: true,
    },
    {
      constraint_name: "contract_outbox_pkey",
      table_name: "contract_outbox",
      columns: ["id"],
      kind: "primary_key",
      deferrable: false,
      initially_deferred: false,
      validated: true,
    },
  ],
  database_indexes: [
    {
      index_name: "contract_audits_pkey",
      table_name: "contract_audits",
      definition:
        "CREATE UNIQUE INDEX contract_audits_pkey ON timer.contract_audits USING btree (audit_id)",
      unique: true,
      primary: true,
      valid: true,
    },
    {
      index_name: "contract_children_pkey",
      table_name: "contract_children",
      definition:
        "CREATE UNIQUE INDEX contract_children_pkey ON timer.contract_children USING btree (child_id)",
      unique: true,
      primary: true,
      valid: true,
    },
    {
      index_name: "contract_parents_pkey",
      table_name: "contract_parents",
      definition:
        "CREATE UNIQUE INDEX contract_parents_pkey ON timer.contract_parents USING btree (parent_key, parent_version)",
      unique: true,
      primary: true,
      valid: true,
    },
    {
      index_name: "eventing_transport_epochs_pkey",
      table_name: OWNER_EVENTING_TRANSPORT_EPOCH_TABLE_V1,
      definition:
        "CREATE UNIQUE INDEX eventing_transport_epochs_pkey ON timer.eventing_transport_epochs USING btree (transport_name)",
      unique: true,
      primary: true,
      valid: true,
    },
    {
      index_name: "contract_outbox_pkey",
      table_name: "contract_outbox",
      definition:
        "CREATE UNIQUE INDEX contract_outbox_pkey ON timer.contract_outbox USING btree (id)",
      unique: true,
      primary: true,
      valid: true,
    },
  ],
  append_only_tables: ["contract_audits", "contract_outbox"],
  outbox_tables: ["contract_outbox"],
  inbox_tables: [],
  dlq_tables: [],
  object_metadata_tables: [],
} as const);

const setupSql = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pai_migrator') THEN
    CREATE ROLE pai_migrator NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pai_timer_app') THEN
    CREATE ROLE pai_timer_app NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pai_timer_runtime') THEN
    CREATE ROLE pai_timer_runtime LOGIN PASSWORD 'timer-runtime-test';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pai_runtime_bridge') THEN
    CREATE ROLE pai_runtime_bridge NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pai_memory_app') THEN
    CREATE ROLE pai_memory_app NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END $$;
${transientRoleCleanupSql}
ALTER ROLE pai_migrator NOLOGIN INHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
ALTER ROLE pai_timer_app NOLOGIN INHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
ALTER ROLE pai_timer_runtime LOGIN INHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD 'timer-runtime-test';
ALTER ROLE pai_timer_app RESET ALL;
ALTER ROLE pai_timer_runtime RESET ALL;
REVOKE SET, ALTER SYSTEM ON PARAMETER session_replication_role
  FROM PUBLIC, pai_timer_app, pai_timer_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE pai_migrator
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, pai_timer_app, pai_timer_runtime, pai_runtime_bridge, pai_memory_app;
ALTER DEFAULT PRIVILEGES FOR ROLE pai_migrator
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated, pai_timer_app, pai_timer_runtime, pai_runtime_bridge, pai_memory_app;
ALTER DEFAULT PRIVILEGES FOR ROLE pai_migrator
  REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated, pai_timer_app, pai_timer_runtime, pai_runtime_bridge, pai_memory_app;
REVOKE pai_memory_app FROM pai_migrator;
REVOKE pai_runtime_bridge FROM pai_migrator;
REVOKE pai_timer_app FROM pai_timer_runtime;
REVOKE pai_runtime_bridge FROM pai_timer_runtime;
REVOKE pai_memory_app FROM pai_timer_runtime;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pai_timer_intruder') THEN
    EXECUTE 'REVOKE pai_timer_app FROM pai_timer_intruder';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pai_owner_rogue') THEN
    EXECUTE 'REVOKE pai_migrator FROM pai_owner_rogue';
  END IF;
END $$;
GRANT pai_timer_app TO pai_timer_runtime WITH INHERIT TRUE, SET FALSE, ADMIN FALSE;
DROP SCHEMA IF EXISTS timer_shadow CASCADE;
DROP SCHEMA IF EXISTS timer_rogue CASCADE;
DROP SCHEMA IF EXISTS timer CASCADE;
DROP FUNCTION IF EXISTS memory.read_owner_secret_v1();
DROP SEQUENCE IF EXISTS memory.owner_secret_sequence;
DROP TABLE IF EXISTS memory.owner_secrets;
CREATE SCHEMA timer AUTHORIZATION pai_migrator;
REVOKE ALL ON SCHEMA timer FROM PUBLIC, anon, authenticated, pai_timer_runtime, pai_runtime_bridge, pai_memory_app;
GRANT USAGE ON SCHEMA timer TO pai_timer_app;
SET ROLE pai_migrator;
CREATE TABLE timer.contract_parents (
  parent_key text NOT NULL,
  parent_version bigint NOT NULL,
  PRIMARY KEY (parent_key, parent_version)
);
CREATE TABLE timer.contract_children (
  child_id text PRIMARY KEY,
  parent_key text NOT NULL,
  parent_version bigint NOT NULL,
  payload jsonb NOT NULL,
  CONSTRAINT contract_children_parent_fk
    FOREIGN KEY (parent_key, parent_version)
    REFERENCES timer.contract_parents(parent_key, parent_version)
);
CREATE TABLE timer.contract_audits (
  audit_id text PRIMARY KEY,
  child_id text NOT NULL,
  created_at timestamptz NOT NULL
);
CREATE TABLE timer.eventing_transport_epochs (
  transport_name text PRIMARY KEY,
  active_epoch text NOT NULL,
  active_generation bigint NOT NULL,
  activated_at timestamptz NOT NULL,
  CONSTRAINT eventing_transport_epochs_active_generation_safe_check
    CHECK (active_generation >= 1 AND active_generation <= 9007199254740991)
);
CREATE TABLE timer.contract_outbox (
  id text PRIMARY KEY,
  status text NOT NULL,
  attempt_count integer NOT NULL,
  payload jsonb NOT NULL,
  claimed_by text,
  claim_token text,
  locked_until timestamptz,
  next_retry_at timestamptz,
  last_error jsonb,
  transport_ref text,
  transport_epoch text,
  transport_generation bigint,
  sent_at timestamptz,
  updated_at timestamptz NOT NULL
);
CREATE SEQUENCE timer.contract_owner_sequence;
CREATE FUNCTION timer.reject_contract_audit_mutation_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
PARALLEL UNSAFE
SET search_path = timer, pg_temp
AS $immutable$
${POSTGRES_IMMUTABLE_TRIGGER_BODY}
$immutable$;
CREATE TRIGGER contract_audits_immutable
BEFORE UPDATE OR DELETE ON timer.contract_audits
FOR EACH ROW
EXECUTE FUNCTION timer.reject_contract_audit_mutation_v1();
CREATE FUNCTION timer.write_contract_child_v1(
  p_parent_key text,
  p_expected_parent_version bigint,
  p_child_id text,
  p_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = timer, pg_temp
AS $$
${POSTGRES_WRITER_BODY}
$$;
CREATE FUNCTION timer.activate_eventing_transport_epoch_v1(
  p_transport_name text,
  p_expected_generation bigint,
  p_next_epoch text,
  p_next_generation bigint,
  p_now timestamptz
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = timer, pg_temp
AS $$
${POSTGRES_TRANSPORT_BODY}
$$;
CREATE FUNCTION timer.claim_contract_outbox_v1(
  p_worker_id text,
  p_limit integer,
  p_lease_seconds integer,
  p_now timestamptz,
  p_current_transport_epoch text,
  p_current_transport_generation bigint
) RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = timer, pg_temp
AS $$
${POSTGRES_OUTBOX_CLAIM_BODY}
$$;
CREATE FUNCTION timer.ack_contract_outbox_v1(
  p_outbox_id text,
  p_claim_token text,
  p_outcome text,
  p_next_retry_at timestamptz,
  p_error jsonb,
  p_transport_ref text,
  p_transport_epoch text,
  p_transport_generation bigint,
  p_current_transport_epoch text,
  p_current_transport_generation bigint,
  p_now timestamptz
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = timer, pg_temp
AS $$
${POSTGRES_OUTBOX_ACK_BODY}
$$;
RESET ROLE;
REVOKE ALL ON ALL TABLES IN SCHEMA timer FROM PUBLIC, anon, authenticated, pai_timer_app, pai_timer_runtime, pai_runtime_bridge, pai_memory_app;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA timer FROM PUBLIC, anon, authenticated, pai_timer_app, pai_timer_runtime, pai_runtime_bridge, pai_memory_app;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA timer FROM PUBLIC, anon, authenticated, pai_timer_app, pai_timer_runtime, pai_runtime_bridge, pai_memory_app;
GRANT SELECT (parent_key, parent_version) ON timer.contract_parents TO pai_timer_app;
GRANT SELECT (child_id, parent_key, parent_version, payload) ON timer.contract_children TO pai_timer_app;
GRANT SELECT (audit_id, child_id, created_at) ON timer.contract_audits TO pai_timer_app;
GRANT SELECT (transport_name, active_epoch, active_generation, activated_at) ON timer.eventing_transport_epochs TO pai_timer_app;
GRANT SELECT (id, status, attempt_count, payload, next_retry_at, last_error, transport_ref, transport_epoch, transport_generation, sent_at, updated_at) ON timer.contract_outbox TO pai_timer_app;
GRANT EXECUTE ON FUNCTION timer.write_contract_child_v1(text, bigint, text, jsonb) TO pai_timer_app;
GRANT EXECUTE ON FUNCTION timer.activate_eventing_transport_epoch_v1(text, bigint, text, bigint, timestamptz) TO pai_timer_app;
GRANT EXECUTE ON FUNCTION timer.claim_contract_outbox_v1(text, integer, integer, timestamptz, text, bigint) TO pai_timer_app;
GRANT EXECUTE ON FUNCTION timer.ack_contract_outbox_v1(text, text, text, timestamptz, jsonb, text, text, bigint, text, bigint, timestamptz) TO pai_timer_app;
`;

function replacementWriterSql(options: Readonly<{
  expectedVersionCheck?: string;
  extraDeclare?: string;
  beforeExpectedVersionCheck?: string;
  extraStatement?: string;
}> = {}): string {
  return `CREATE OR REPLACE FUNCTION timer.write_contract_child_v1(
    p_parent_key text,
    p_expected_parent_version bigint,
    p_child_id text,
    p_payload jsonb
  ) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = timer, pg_temp
  AS $body$
  DECLARE
    current_version bigint;
    next_version bigint;
    ${options.extraDeclare ?? ""}
  BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_parent_key, 0));
    SELECT parent_version INTO current_version
      FROM timer.contract_parents WHERE parent_key = p_parent_key
      ORDER BY parent_version DESC LIMIT 1 FOR UPDATE;
    current_version := COALESCE(current_version, 0);
    ${options.beforeExpectedVersionCheck ?? ""}
    IF ${options.expectedVersionCheck ?? "p_expected_parent_version IS NULL OR current_version IS DISTINCT FROM p_expected_parent_version"} THEN
      RAISE EXCEPTION 'stale parent version';
    END IF;
    next_version := current_version + 1;
    INSERT INTO timer.contract_parents(parent_key, parent_version)
      VALUES (p_parent_key, next_version);
    INSERT INTO timer.contract_children(child_id, parent_key, parent_version, payload)
      VALUES (p_child_id, p_parent_key, next_version, COALESCE(p_payload, '{}'::jsonb));
    INSERT INTO timer.contract_audits(audit_id, child_id, created_at)
      VALUES ('audit-' || p_child_id, p_child_id, clock_timestamp());
    ${options.extraStatement ?? ""}
    RETURN jsonb_build_object('parent_version', next_version, 'child_id', p_child_id);
  END;
  $body$`;
}

const describePostgres =
  configuredDatabaseUrl === undefined ? describe.skip : describe.sequential;

describePostgres("PostgreSQL owner deployment verification", () => {
  let adminPool: Pool | undefined;
  let pool: Pool | undefined;
  let runtimePool: Pool | undefined;
  let testDatabaseName: string | undefined;
  let resetChain: Promise<void> = Promise.resolve();

  beforeAll(async () => {
    if (configuredDatabaseUrl === undefined) return;
    adminPool = new Pool({ connectionString: configuredDatabaseUrl });
    testDatabaseName = `pai_persistence_contract_${process.pid}_${randomUUID()
      .replaceAll("-", "")
      .slice(0, 12)}`.toLowerCase();
    const quotedDatabase = quotePostgresIdentifier(testDatabaseName);
    await adminPool.query(`CREATE DATABASE ${quotedDatabase}`);
    databaseUrl = databaseUrlForDatabase(configuredDatabaseUrl, testDatabaseName);
    pool = new Pool({ connectionString: databaseUrl });
    runtimePool = new Pool({
      connectionString: databaseUrlForRuntime(databaseUrl),
    });
  });

  afterAll(async () => {
    await runtimePool?.end();
    if (pool !== undefined) {
      await pool.query(transientRoleCleanupSql);
      await pool.query(`
        DROP SCHEMA IF EXISTS timer_shadow CASCADE;
        DROP SCHEMA IF EXISTS timer_rogue CASCADE;
        DROP SCHEMA IF EXISTS timer CASCADE;
        DROP FUNCTION IF EXISTS memory.read_owner_secret_v1();
        DROP SEQUENCE IF EXISTS memory.owner_secret_sequence;
        DROP TABLE IF EXISTS memory.owner_secrets;
      `);
      await pool.end();
    }
    if (adminPool !== undefined && testDatabaseName !== undefined) {
      try {
        await waitForDatabaseConnectionsToClose(adminPool, testDatabaseName);
        await adminPool.query(
          `DROP DATABASE IF EXISTS ${quotePostgresIdentifier(testDatabaseName)} WITH (FORCE)`,
        );
      } finally {
        await adminPool.end();
      }
    }
  });

  async function reset(): Promise<Pool> {
    if (pool === undefined) throw new Error("PAI_TEST_DATABASE_URL is required");
    const postgres = pool;
    const resetTask = resetChain.then(async () => {
      await postgres.query(setupSql);
    });
    resetChain = resetTask.then(
      () => undefined,
      () => undefined,
    );
    await resetTask;
    return postgres;
  }

  function runtime(): Pool {
    if (runtimePool === undefined) throw new Error("PAI_TEST_DATABASE_URL is required");
    return runtimePool;
  }

  async function createCrossOwnerFixture(postgres: Pool): Promise<void> {
    await postgres.query(`
      CREATE SCHEMA IF NOT EXISTS memory AUTHORIZATION pai_migrator;
      SET ROLE pai_migrator;
      CREATE TABLE memory.owner_secrets (
        secret_id text PRIMARY KEY,
        secret_value text NOT NULL
      );
      CREATE SEQUENCE memory.owner_secret_sequence;
      CREATE FUNCTION memory.read_owner_secret_v1() RETURNS text
      LANGUAGE sql
      SECURITY DEFINER
      SET search_path = memory, pg_temp
      AS $function$ SELECT secret_value FROM memory.owner_secrets LIMIT 1 $function$;
      RESET ROLE;
      REVOKE ALL ON SCHEMA memory FROM PUBLIC, anon, authenticated, pai_timer_app, pai_timer_runtime;
      REVOKE ALL ON ALL TABLES IN SCHEMA memory FROM PUBLIC, anon, authenticated, pai_timer_app, pai_timer_runtime;
      REVOKE ALL ON ALL SEQUENCES IN SCHEMA memory FROM PUBLIC, anon, authenticated, pai_timer_app, pai_timer_runtime;
      REVOKE ALL ON ALL FUNCTIONS IN SCHEMA memory FROM PUBLIC, anon, authenticated, pai_timer_app, pai_timer_runtime;
    `);
  }

  it("derives a verified capability from PostgreSQL catalogs", async () => {
    const postgres = await reset();
    const verified = await verifyOwnerRepositoryDeploymentFromPostgresV1(
      POSTGRES_CONTRACT,
      postgres,
      {
        expected_schema_owner: "pai_migrator",
        runtime_postgres: runtime(),
      },
    );
    expect(verified).toMatchObject({ owner_service: "timer_trigger_app" });
    expect(verified.contract_fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(verified.database_fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("enforces the declared immutable trigger for UPDATE and DELETE", async () => {
    const postgres = await reset();
    await postgres.query(
      `INSERT INTO timer.contract_audits(audit_id, child_id, created_at)
       VALUES ('immutable-audit', 'immutable-child', clock_timestamp())`,
    );
    await expect(
      postgres.query(
        `UPDATE timer.contract_audits
            SET child_id = 'mutated'
          WHERE audit_id = 'immutable-audit'`,
      ),
    ).rejects.toThrow(/contract_audits is immutable/u);
    await expect(
      postgres.query(
        `DELETE FROM timer.contract_audits
          WHERE audit_id = 'immutable-audit'`,
      ),
    ).rejects.toThrow(/contract_audits is immutable/u);
    await expect(
      postgres.query<{ child_id: string }>(
        `SELECT child_id FROM timer.contract_audits
          WHERE audit_id = 'immutable-audit'`,
      ),
    ).resolves.toMatchObject({
      rows: [{ child_id: "immutable-child" }],
    });
  });

  it.each([
    [
      "disabled trigger",
      "ALTER TABLE timer.contract_audits DISABLE TRIGGER contract_audits_immutable",
    ],
    [
      "incomplete trigger event set",
      `DROP TRIGGER contract_audits_immutable ON timer.contract_audits;
       CREATE TRIGGER contract_audits_immutable
       BEFORE DELETE ON timer.contract_audits
       FOR EACH ROW EXECUTE FUNCTION timer.reject_contract_audit_mutation_v1()`,
    ],
    [
      "trigger function source",
      `CREATE OR REPLACE FUNCTION timer.reject_contract_audit_mutation_v1()
       RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER VOLATILE PARALLEL UNSAFE
       SET search_path = timer, pg_temp AS $body$
       BEGIN RAISE EXCEPTION 'changed immutable error'; END;
       $body$`,
    ],
    [
      "trigger function search_path",
      "ALTER FUNCTION timer.reject_contract_audit_mutation_v1() SET search_path = pg_temp",
    ],
    [
      "trigger function owner",
      "ALTER FUNCTION timer.reject_contract_audit_mutation_v1() OWNER TO pai_timer_app",
    ],
    [
      "PUBLIC trigger function execute",
      "GRANT EXECUTE ON FUNCTION timer.reject_contract_audit_mutation_v1() TO PUBLIC",
    ],
  ] as const)(
    "fails closed on immutable %s drift",
    async (_label, driftSql) => {
      const postgres = await reset();
      await postgres.query(driftSql);
      await expect(
        verifyOwnerRepositoryDeploymentFromPostgresV1(
          POSTGRES_CONTRACT,
          postgres,
          {
            expected_schema_owner: "pai_migrator",
            runtime_postgres: runtime(),
          },
        ),
      ).rejects.toThrow(/drift|cross-owner/u);
    },
  );

  it.each([
    ["synchronous_commit", "off"],
    ["session_replication_role", "replica"],
  ] as const)(
    "rejects an unsafe runtime role default for %s",
    async (parameter, value) => {
      const postgres = await reset();
      if (databaseUrl === undefined) {
        throw new Error("PAI_TEST_DATABASE_URL is required");
      }
      await postgres.query(
        `ALTER ROLE pai_timer_runtime SET ${parameter} TO '${value}'`,
      );
      const runtimeUrl = new URL(databaseUrl);
      runtimeUrl.username = "pai_timer_runtime";
      runtimeUrl.password = "timer-runtime-test";
      const driftRuntime = new Pool({ connectionString: runtimeUrl.toString() });
      try {
        await expect(
          verifyOwnerRepositoryDeploymentFromPostgresV1(
            POSTGRES_CONTRACT,
            postgres,
            {
              expected_schema_owner: "pai_migrator",
              runtime_postgres: driftRuntime,
            },
          ),
        ).rejects.toThrow(/GUC (?:default )?drift/u);
      } finally {
        await driftRuntime.end();
        await postgres.query(`ALTER ROLE pai_timer_runtime RESET ${parameter}`);
      }
    },
  );

  it("rejects parameter privileges that can disable trigger enforcement", async () => {
    const postgres = await reset();
    await postgres.query(
      "GRANT SET ON PARAMETER session_replication_role TO pai_timer_runtime",
    );
    try {
      await expect(
        verifyOwnerRepositoryDeploymentFromPostgresV1(
          POSTGRES_CONTRACT,
          postgres,
          {
            expected_schema_owner: "pai_migrator",
            runtime_postgres: runtime(),
          },
        ),
      ).rejects.toThrow(/durability GUC drift|parameter ACL drift/u);
    } finally {
      await postgres.query(
        "REVOKE SET ON PARAMETER session_replication_role FROM pai_timer_runtime",
      );
    }
  });

  it("rechecks durability GUCs after BEGIN before invoking owner work", async () => {
    const postgres = await reset();
    if (databaseUrl === undefined) {
      throw new Error("PAI_TEST_DATABASE_URL is required");
    }
    const runtimeUrl = new URL(databaseUrl);
    runtimeUrl.username = "pai_timer_runtime";
    runtimeUrl.password = "timer-runtime-test";
    const composition = await openVerifiedOwnerPostgresCompositionV1(
      POSTGRES_CONTRACT,
      runtimeUrl.toString(),
    );
    let workInvoked = false;
    try {
      await composition.postgres.query("SET synchronous_commit = off");
      await expect(
        composition.unit_of_work.withTransaction(
          {
            operation: "reject-unsafe-runtime-guc",
            idempotency_key: "reject-unsafe-runtime-guc",
            trace_id: "trace-reject-unsafe-runtime-guc",
            isolation: "read_committed",
            retry: "none",
          },
          async () => {
            workInvoked = true;
            return "must-not-run";
          },
        ),
      ).rejects.toThrow(/runtime durability GUC drift/u);
      expect(workInvoked).toBe(false);
    } finally {
      await composition.postgres
        .query("RESET synchronous_commit")
        .catch(() => undefined);
      await composition.close();
    }
  });

  it("uses a new READ COMMITTED statement snapshot after an advisory-lock wait", async () => {
    const postgres = await reset();
    if (databaseUrl === undefined) {
      throw new Error("PAI_TEST_DATABASE_URL is required");
    }
    const runtimeUrl = new URL(databaseUrl);
    runtimeUrl.username = "pai_timer_runtime";
    runtimeUrl.password = "timer-runtime-test";
    const composition = await openVerifiedOwnerPostgresCompositionV1(
      POSTGRES_CONTRACT,
      runtimeUrl.toString(),
    );
    const writer = await postgres.connect();
    const parentKey = `read-snapshot-${randomUUID()}`;
    let releasePid!: (pid: number) => void;
    const readerPid = new Promise<number>((resolve) => {
      releasePid = resolve;
    });
    try {
      await postgres.query(
        `INSERT INTO timer.contract_parents(parent_key, parent_version)
         VALUES ($1::text, 1::bigint)`,
        [parentKey],
      );
      await writer.query("BEGIN");
      await writer.query(
        `SELECT pg_catalog.pg_advisory_xact_lock(
           pg_catalog.hashtextextended($1::text, 0)
         )`,
        [parentKey],
      );
      await writer.query(
        `DELETE FROM timer.contract_parents
          WHERE parent_key = $1::text
            AND parent_version = 1::bigint`,
        [parentKey],
      );
      await writer.query(
        `INSERT INTO timer.contract_parents(parent_key, parent_version)
         VALUES ($1::text, 2::bigint)`,
        [parentKey],
      );
      const read = composition.read_committed_postgres
        .withReadCommittedTransaction(async (transaction) => {
          const pid = await transaction.query<{ pid: number }>(
            "SELECT pg_catalog.pg_backend_pid() AS pid",
          );
          releasePid(pid.rows[0]!.pid);
          await transaction.query(
            `SELECT pg_catalog.pg_advisory_xact_lock(
               pg_catalog.hashtextextended($1::text, 0)
             )`,
            [parentKey],
          );
          return transaction.query<{ parent_version: string }>(
            `SELECT parent_version::text AS parent_version
               FROM timer.contract_parents
              WHERE parent_key = $1::text
              ORDER BY parent_version DESC
              LIMIT 1`,
            [parentKey],
          );
        });
      const pid = await readerPid;
      let observedWait = false;
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const activity = await postgres.query<{
          wait_event_type: string | null;
          wait_event: string | null;
        }>(
          `SELECT wait_event_type, wait_event
             FROM pg_catalog.pg_stat_activity
            WHERE pid = $1::integer`,
          [pid],
        );
        if (
          activity.rows[0]?.wait_event_type === "Lock" &&
          activity.rows[0]?.wait_event === "advisory"
        ) {
          observedWait = true;
          break;
        }
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 10);
        });
      }
      expect(observedWait).toBe(true);
      await writer.query("COMMIT");
      await expect(read).resolves.toEqual({
        rows: [{ parent_version: "2" }],
      });
    } finally {
      await writer.query("ROLLBACK").catch(() => undefined);
      writer.release();
      await composition.close();
    }
  });

  it("rejects session-level read SQL and reuses the connection without residual advisory locks", async () => {
    const postgres = await reset();
    if (databaseUrl === undefined) {
      throw new Error("PAI_TEST_DATABASE_URL is required");
    }
    const runtimeUrl = new URL(databaseUrl);
    runtimeUrl.username = "pai_timer_runtime";
    runtimeUrl.password = "timer-runtime-test";
    const composition = await openVerifiedOwnerPostgresCompositionV1(
      POSTGRES_CONTRACT,
      runtimeUrl.toString(),
    );
    const lockKey = `read-session-lock-${randomUUID()}`;
    let rejectedConnectionPid: number | undefined;
    try {
      await expect(
        composition.read_committed_postgres.withReadCommittedTransaction(
          async (transaction) => {
            const pid = await transaction.query<{ pid: number }>(
              "SELECT pg_catalog.pg_backend_pid() AS pid",
            );
            rejectedConnectionPid = pid.rows[0]?.pid;
            await transaction.query(
              `SELECT pg_catalog.pg_advisory_lock(
                 pg_catalog.hashtextextended($1::text, 0)
               )`,
              [lockKey],
            );
          },
        ),
      ).rejects.toThrow(/session-level or side-effecting functions/u);

      for (const unsafeStatement of [
        "COMMIT",
        "SET application_name = 'unsafe-read-session'",
        "SELECT pg_catalog.set_config('application_name', 'unsafe', false)",
        "SELECT 1; SELECT 2",
      ]) {
        await expect(
          composition.read_committed_postgres.withReadCommittedTransaction(
            (transaction) => transaction.query(unsafeStatement),
          ),
        ).rejects.toThrow(/repository-safe SELECT|side-effecting functions/u);
      }

      const reusedConnectionPid =
        await composition.read_committed_postgres.withReadCommittedTransaction(
          async (transaction) => {
            await transaction.query(
              `SELECT pg_catalog.pg_advisory_xact_lock(
                 pg_catalog.hashtextextended($1::text, 0)
               )`,
              [lockKey],
            );
            const pid = await transaction.query<{ pid: number }>(
              "SELECT pg_catalog.pg_backend_pid() AS pid",
            );
            return pid.rows[0]?.pid;
          },
        );
      expect(rejectedConnectionPid).toBeTypeOf("number");
      expect(reusedConnectionPid).toBe(rejectedConnectionPid);
      await expect(
        postgres.query<{ advisory_locks: number }>(
          `SELECT pg_catalog.count(*)::integer AS advisory_locks
             FROM pg_catalog.pg_locks
            WHERE locktype = 'advisory'
              AND pid = $1::integer`,
          [reusedConnectionPid],
        ),
      ).resolves.toMatchObject({ rows: [{ advisory_locks: 0 }] });

      const externalLock = await postgres.query<{ acquired: boolean }>(
        `SELECT pg_catalog.pg_try_advisory_lock(
           pg_catalog.hashtextextended($1::text, 0)
         ) AS acquired`,
        [lockKey],
      );
      expect(externalLock.rows).toEqual([{ acquired: true }]);
      await postgres.query(
        `SELECT pg_catalog.pg_advisory_unlock(
           pg_catalog.hashtextextended($1::text, 0)
         )`,
        [lockKey],
      );
    } finally {
      await composition.close();
    }
  });

  it("rolls back, releases locks, revokes escaped clients and makes the raw read capability read-only", async () => {
    const postgres = await reset();
    if (databaseUrl === undefined) {
      throw new Error("PAI_TEST_DATABASE_URL is required");
    }
    const runtimeUrl = new URL(databaseUrl);
    runtimeUrl.username = "pai_timer_runtime";
    runtimeUrl.password = "timer-runtime-test";
    const composition = await openVerifiedOwnerPostgresCompositionV1(
      POSTGRES_CONTRACT,
      runtimeUrl.toString(),
    );
    const lockKey = `read-rollback-${randomUUID()}`;
    let escaped:
      | Parameters<
          Parameters<
            typeof composition.read_committed_postgres.withReadCommittedTransaction
          >[0]
        >[0]
      | undefined;
    try {
      await expect(
        composition.read_committed_postgres.withReadCommittedTransaction(
          async (transaction) => {
            escaped = transaction;
            await transaction.query(
              `SELECT pg_catalog.pg_advisory_xact_lock(
                 pg_catalog.hashtextextended($1::text, 0)
               )`,
              [lockKey],
            );
            throw new Error("forced read transaction failure");
          },
        ),
      ).rejects.toThrow(/forced read transaction failure/u);
      await expect(
        escaped!.query("SELECT 1 AS value"),
      ).rejects.toThrow(/no longer active/u);
      const lock = await postgres.query<{ acquired: boolean }>(
        `SELECT pg_catalog.pg_try_advisory_lock(
           pg_catalog.hashtextextended($1::text, 0)
         ) AS acquired`,
        [lockKey],
      );
      expect(lock.rows).toEqual([{ acquired: true }]);
      await postgres.query(
        `SELECT pg_catalog.pg_advisory_unlock(
           pg_catalog.hashtextextended($1::text, 0)
         )`,
        [lockKey],
      );
      await expect(
        composition.read_committed_postgres.withReadCommittedTransaction(
          (transaction) =>
            transaction.query<{ value: number }>(
              "SELECT 1::integer AS value",
            ),
        ),
      ).resolves.toEqual({ rows: [{ value: 1 }] });
      await expect(
        composition.read_committed_postgres.withReadCommittedTransaction(
          (transaction) =>
            transaction.query(
              `UPDATE timer.contract_parents
                  SET parent_version = parent_version + 1`,
            ),
        ),
      ).rejects.toThrow(
        /repository-safe SELECT|read-only|permission denied/u,
      );
      const writerChildId = `raw-read-writer-${randomUUID()}`;
      await expect(
        composition.read_committed_postgres.withReadCommittedTransaction(
          (transaction) =>
            transaction.query(
              `SELECT timer.write_contract_child_v1(
                 $1::text,
                 0::bigint,
                 $2::text,
                 '{}'::jsonb
               )`,
              [`parent-${writerChildId}`, writerChildId],
            ),
        ),
      ).rejects.toThrow(/read-only transaction/u);
      await expect(
        postgres.query<{ count: string }>(
          `SELECT count(*)::text AS count
             FROM timer.contract_children
            WHERE child_id = $1::text`,
          [writerChildId],
        ),
      ).resolves.toMatchObject({ rows: [{ count: "0" }] });
    } finally {
      await composition.close();
    }
  });

  it("keeps public catalog proofs non-executable, including Pool lookalikes", async () => {
    const postgres = await reset();
    const runtimePostgres = runtime();
    const verified = await verifyOwnerRepositoryDeploymentFromPostgresV1(
      POSTGRES_CONTRACT,
      postgres,
      {
        expected_schema_owner: "pai_migrator",
        runtime_postgres: runtimePostgres,
      },
    );

    expect(() =>
      createVerifiedOwnerPostgresRepositoryV1(
        POSTGRES_CONTRACT,
        verified,
        postgres,
      ),
    ).toThrow(/capability or PostgreSQL pool does not match/u);
    expect(() =>
      createVerifiedOwnerPostgresRepositoryV1(
        POSTGRES_CONTRACT,
        verified,
        runtimePostgres,
      ),
    ).toThrow(/capability or PostgreSQL pool does not match/u);
    expect(() =>
      createVerifiedOwnerPostgresRepositoryV1(
        POSTGRES_CONTRACT,
        { ...verified },
        runtimePostgres,
      ),
    ).toThrow(/capability or PostgreSQL pool does not match/u);

    const delegatingCatalogPort: PostgresQueryPortV1 = {
      async query<TRow extends Record<string, unknown>>(
        sql: string,
        values: readonly unknown[] = [],
      ): Promise<{ readonly rows: readonly TRow[] }> {
        const result = await postgres.query<TRow>(sql, [...values]);
        return { rows: result.rows };
      },
    };
    const structurallyVerified =
      await verifyOwnerRepositoryDeploymentFromPostgresV1(
        POSTGRES_CONTRACT,
        delegatingCatalogPort,
        {
          expected_schema_owner: "pai_migrator",
          runtime_postgres: runtimePostgres,
        },
      );
    expect(() =>
      createVerifiedOwnerPostgresRepositoryV1(
        POSTGRES_CONTRACT,
        structurallyVerified,
        runtimePostgres,
      ),
    ).toThrow(/capability or PostgreSQL pool does not match/u);

    const forgedCatalogPool = Object.setPrototypeOf(
      {
        query: delegatingCatalogPort.query,
      },
      Pool.prototype,
    ) as Pool;
    expect(forgedCatalogPool).toBeInstanceOf(Pool);
    const forgedPoolProof =
      await verifyOwnerRepositoryDeploymentFromPostgresV1(
        POSTGRES_CONTRACT,
        forgedCatalogPool,
        {
          expected_schema_owner: "pai_migrator",
          runtime_postgres: runtimePostgres,
        },
      );
    expect(() =>
      createVerifiedOwnerPostgresRepositoryV1(
        POSTGRES_CONTRACT,
        forgedPoolProof,
        runtimePostgres,
      ),
    ).toThrow(/capability or PostgreSQL pool does not match/u);
  });

  it("rejects catalog facts from a different PostgreSQL cluster identity", async () => {
    const postgres = await reset();
    const runtimePostgres = runtime();
    const mismatchedRuntime: PostgresQueryPortV1 = {
      async query<TRow extends Record<string, unknown>>(
        sql: string,
        values: readonly unknown[] = [],
      ): Promise<{ readonly rows: readonly TRow[] }> {
        const result = await runtimePostgres.query<TRow>(sql, [...values]);
        if (sql.includes("pg_control_system")) {
          const identity = result.rows[0] as
            | (TRow & { system_identifier: string })
            | undefined;
          return {
            rows:
              identity === undefined
                ? result.rows
                : [
                    {
                      ...identity,
                      system_identifier: `${identity.system_identifier}-other`,
                    } as TRow,
                  ],
          };
        }
        return { rows: result.rows };
      },
    };

    await expect(
      verifyOwnerRepositoryDeploymentFromPostgresV1(
        POSTGRES_CONTRACT,
        postgres,
        {
          expected_schema_owner: "pai_migrator",
          runtime_postgres: mismatchedRuntime,
        },
      ),
    ).rejects.toThrow(/identities do not match/u);
  });

  it("allows only explicitly named least-privilege principals to assume the schema owner", async () => {
    const postgres = await reset();
    const runtimePostgres = runtime();
    const deployer = "pai_contract_deployer";
    const rogue = "pai_contract_rogue_deployer";
    await postgres.query(`
      DROP ROLE IF EXISTS ${rogue};
      DROP ROLE IF EXISTS ${deployer};
      CREATE ROLE ${deployer}
        LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS
        NOCREATEDB NOCREATEROLE NOREPLICATION;
      GRANT pai_migrator TO ${deployer}
        WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;
    `);
    try {
      await expect(
        verifyOwnerRepositoryDeploymentFromPostgresV1(
          POSTGRES_CONTRACT,
          postgres,
          {
            expected_schema_owner: "pai_migrator",
            runtime_postgres: runtimePostgres,
            schema_owner_assume_principals: [deployer],
          },
        ),
      ).resolves.toMatchObject({ owner_service: "timer_trigger_app" });

      await postgres.query(`
        CREATE ROLE ${rogue}
          LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS
          NOCREATEDB NOCREATEROLE NOREPLICATION;
        GRANT pai_migrator TO ${rogue}
          WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;
      `);
      await expect(
        verifyOwnerRepositoryDeploymentFromPostgresV1(
          POSTGRES_CONTRACT,
          postgres,
          {
            expected_schema_owner: "pai_migrator",
            runtime_postgres: runtimePostgres,
            schema_owner_assume_principals: [deployer],
          },
        ),
      ).rejects.toThrow(/reverse members drift/u);

      await postgres.query(`
        REVOKE pai_migrator FROM ${rogue};
        GRANT pai_migrator TO ${deployer}
          WITH ADMIN FALSE, INHERIT TRUE, SET TRUE;
      `);
      await expect(
        verifyOwnerRepositoryDeploymentFromPostgresV1(
          POSTGRES_CONTRACT,
          postgres,
          {
            expected_schema_owner: "pai_migrator",
            runtime_postgres: runtimePostgres,
            schema_owner_assume_principals: [deployer],
          },
        ),
      ).rejects.toThrow(/membership option drift/u);
    } finally {
      await postgres.query(`
        REVOKE pai_migrator FROM ${rogue};
        REVOKE pai_migrator FROM ${deployer};
        DROP ROLE IF EXISTS ${rogue};
        DROP ROLE IF EXISTS ${deployer};
      `);
    }
  });

  it("maps acquire, BEGIN, and COMMIT availability failures without hiding other errors", async () => {
    await reset();
    if (databaseUrl === undefined) throw new Error("PAI_TEST_DATABASE_URL is required");
    const runtimeUrl = new URL(databaseUrl);
    runtimeUrl.username = "pai_timer_runtime";
    runtimeUrl.password = "timer-runtime-test";
    const composition = await openVerifiedOwnerPostgresCompositionV1(
      POSTGRES_CONTRACT,
      runtimeUrl.toString(),
    );
    const unitOfWork = composition.unit_of_work;
    const mutablePoolPrototype = Pool.prototype as unknown as {
      connect(this: Pool): Promise<PoolClient>;
    };
    const originalConnect = mutablePoolPrototype.connect;
    const request = {
      operation: "transient_phase_test",
      idempotency_key: "transient-phase-test",
      trace_id: "trace-transient-phase-test",
      isolation: "read_committed" as const,
      retry: "none" as const,
    };

    try {
      mutablePoolPrototype.connect = async function () {
        throw new Error("timeout exceeded when trying to connect");
      };
      await expect(
        unitOfWork.withTransaction(request, async () => "unreachable"),
      ).rejects.toMatchObject({
        code: "transient_database_error",
      });

      for (const [statement, driverError] of [
        ["BEGIN", Object.assign(new Error("admin shutdown"), { code: "57P01" })],
        ["COMMIT", Object.assign(new Error("socket reset"), { code: "ECONNRESET" })],
      ] as const) {
        mutablePoolPrototype.connect = async function () {
          const client = await originalConnect.call(this);
          const mutableClient = client as unknown as {
            query: (sql: string) => Promise<unknown>;
          };
          const originalQuery = mutableClient.query;
          mutableClient.query = async (sql: string) => {
            if (sql.startsWith(statement)) {
              mutableClient.query = originalQuery;
              if (statement === "COMMIT") {
                await originalQuery.call(client, sql);
              }
              throw driverError;
            }
            return originalQuery.call(client, sql);
          };
          return client;
        };
        await expect(
          unitOfWork.withTransaction(request, async () => "not-persisted"),
        ).rejects.toMatchObject({
          code:
            statement === "COMMIT"
              ? "commit_outcome_unknown"
              : "transient_database_error",
        });
      }
    } finally {
      mutablePoolPrototype.connect = originalConnect;
      await composition.close();
    }
  });

  it("snapshots and bounds unit-of-work audit fields before acquiring PostgreSQL", async () => {
    await reset();
    if (databaseUrl === undefined) throw new Error("PAI_TEST_DATABASE_URL is required");
    const runtimeUrl = new URL(databaseUrl);
    runtimeUrl.username = "pai_timer_runtime";
    runtimeUrl.password = "timer-runtime-test";
    const composition = await openVerifiedOwnerPostgresCompositionV1(
      POSTGRES_CONTRACT,
      runtimeUrl.toString(),
    );
    try {
      const mutableRequest: OwnerUnitOfWorkRequestV1 = {
        operation: "snapshot-unit-of-work",
        idempotency_key: "snapshot-unit-of-work",
        trace_id: "trace-original",
        isolation: "serializable",
        retry: "none",
      };
      const pending = composition.unit_of_work.withTransaction(
        mutableRequest,
        async (transaction) => transaction.trace_id,
      );
      Object.assign(mutableRequest, {
        operation: "mutated-operation",
        idempotency_key: "mutated-idempotency-key",
        trace_id: "trace-mutated",
        isolation: "read_committed",
        retry: "serialization_failures",
      });
      await expect(pending).resolves.toBe("trace-original");

      await expect(
        composition.unit_of_work.withTransaction(
          {
            operation: "x".repeat(257),
            idempotency_key: "bounded-idempotency-key",
            trace_id: "bounded-trace-id",
            isolation: "read_committed",
            retry: "none",
          },
          async () => "unreachable",
        ),
      ).rejects.toThrow(/invalid owner unit-of-work request/u);
    } finally {
      await composition.close();
    }
  });

  it("reports commit-then-disconnect as unknown while preserving the committed write", async () => {
    const postgres = await reset();
    if (databaseUrl === undefined) throw new Error("PAI_TEST_DATABASE_URL is required");
    const runtimeUrl = new URL(databaseUrl);
    runtimeUrl.username = "pai_timer_runtime";
    runtimeUrl.password = "timer-runtime-test";
    const composition = await openVerifiedOwnerPostgresCompositionV1(
      POSTGRES_CONTRACT,
      runtimeUrl.toString(),
    );
    const mutablePoolPrototype = Pool.prototype as unknown as {
      connect(this: Pool): Promise<PoolClient>;
    };
    const originalConnect = mutablePoolPrototype.connect;
    const childId = `commit-unknown-${randomUUID()}`;
    const operation = "commit_then_disconnect";
    const idempotencyKey = `idempotency-${childId}`;
    try {
      mutablePoolPrototype.connect = async function () {
        const client = await originalConnect.call(this);
        const mutableClient = client as unknown as {
          query: (sql: string, values?: readonly unknown[]) => Promise<unknown>;
        };
        const originalQuery = mutableClient.query;
        mutableClient.query = async (sql, values = []) => {
          if (sql === "COMMIT") {
            mutableClient.query = originalQuery;
            await originalQuery.call(client, sql, [...values]);
            throw Object.assign(new Error("socket reset after commit"), {
              code: "ECONNRESET",
            });
          }
          return originalQuery.call(client, sql, [...values]);
        };
        return client;
      };

      await expect(
        composition.unit_of_work.withTransaction(
          {
            operation,
            idempotency_key: idempotencyKey,
            trace_id: `trace-${childId}`,
            isolation: "read_committed",
            retry: "none",
          },
          async (transaction, { owner }) =>
            owner.executeWriter(transaction, {
              writer: "write_contract_child_v1",
              arguments: {
                p_parent_key: childId,
                p_expected_parent_version: "0",
                p_child_id: childId,
                p_payload: {},
              },
              expected_rows: 1,
            }),
        ),
      ).rejects.toMatchObject({
        code: "commit_outcome_unknown",
        operation,
        idempotency_key: idempotencyKey,
      });
    } finally {
      mutablePoolPrototype.connect = originalConnect;
      await composition.close();
    }

    await expect(
      postgres.query(
        "SELECT child_id FROM timer.contract_children WHERE child_id = $1",
        [childId],
      ),
    ).resolves.toMatchObject({ rows: [{ child_id: childId }] });
  });

  it("executes the Trigger Process terminal/meta truth table in PostgreSQL", async () => {
    const postgres = await reset();
    await postgres.query(`
      CREATE TEMP TABLE trigger_process_state_parity (
        phase text NOT NULL,
        status text NOT NULL,
        wait_reason text,
        terminal_reason text,
        meta_enqueue_reason text,
        ${TRIGGER_PROCESS_STATE_V1_DATABASE_CHECK}
      )
    `);
    const validStates = [
      ["admission", "running", null, null, null],
      ["context", "running", null, null, null],
      ["intent", "running", null, null, null],
      ["execution", "running", null, null, null],
      ["cooldown", "waiting", "cooldown_until", null, null],
      [
        "meta_enqueued",
        "waiting",
        "meta_enqueue_wait",
        null,
        "cooldown_expired",
      ],
      ["closed", "completed", null, "completed", null],
    ] as const;
    for (const values of validStates) {
      await expect(
        postgres.query(
          `INSERT INTO trigger_process_state_parity
             (phase, status, wait_reason, terminal_reason, meta_enqueue_reason)
           VALUES ($1, $2, $3, $4, $5)`,
          [...values],
        ),
      ).resolves.toBeDefined();
    }
    for (const terminalReason of [""] as const) {
      await expect(
        postgres.query(
          `INSERT INTO trigger_process_state_parity
             (phase, status, wait_reason, terminal_reason, meta_enqueue_reason)
           VALUES ('admission', 'running', NULL, $1, NULL)`,
          [terminalReason],
        ),
      ).rejects.toThrow();
    }
    for (const terminalReason of [null, ""] as const) {
      await expect(
        postgres.query(
          `INSERT INTO trigger_process_state_parity
             (phase, status, wait_reason, terminal_reason, meta_enqueue_reason)
           VALUES ('closed', 'completed', NULL, $1, NULL)`,
          [terminalReason],
        ),
      ).rejects.toThrow();
    }
    await expect(
      postgres.query(`
        INSERT INTO trigger_process_state_parity
          (phase, status, wait_reason, terminal_reason, meta_enqueue_reason)
        VALUES ('execution', 'running', NULL, NULL, 'system_interrupted')
      `),
    ).rejects.toThrow();
  });

  it("binds the verified capability to the executable repository and unit of work", async () => {
    const postgres = await reset();
    if (databaseUrl === undefined) throw new Error("PAI_TEST_DATABASE_URL is required");
    const runtimeUrl = new URL(databaseUrl);
    runtimeUrl.username = "pai_timer_runtime";
    runtimeUrl.password = "timer-runtime-test";
    const composition = await openVerifiedOwnerPostgresCompositionV1(
      POSTGRES_CONTRACT,
      runtimeUrl.toString(),
    );
    try {
      const childId = `composition-${randomUUID()}`;
      const inheritedArguments = Object.create({
        p_parent_key: `parent-inherited-${childId}`,
        p_expected_parent_version: "0",
        p_child_id: `inherited-${childId}`,
        p_payload: {},
      }) as Readonly<Record<string, unknown>>;
      await expect(
        composition.unit_of_work.withTransaction(
          {
            operation: "reject_inherited_writer_arguments",
            idempotency_key: `inherited-${childId}`,
            trace_id: `trace-inherited-${childId}`,
            isolation: "read_committed",
            retry: "none",
          },
          async (transaction, { owner }) =>
            owner.executeWriter(transaction, {
              writer: "write_contract_child_v1",
              arguments: inheritedArguments as never,
              expected_rows: 1,
            }),
        ),
      ).rejects.toThrow(/plain data object/u);

      await expect(
        composition.unit_of_work.withTransaction(
          {
            operation: "reject_unbounded_writer_row_expectation",
            idempotency_key: `row-expectation-${childId}`,
            trace_id: `trace-row-expectation-${childId}`,
            isolation: "read_committed",
            retry: "none",
          },
          async (transaction, { owner }) =>
            owner.executeWriter(transaction, {
              writer: "write_contract_child_v1",
              arguments: {
                p_parent_key: `parent-row-expectation-${childId}`,
                p_expected_parent_version: "0",
                p_child_id: `row-expectation-${childId}`,
                p_payload: {},
              },
              expected_rows: "unchecked" as never,
            }),
        ),
      ).rejects.toThrow(/row-count expectation drift/u);

      const result = await composition.unit_of_work.withTransaction(
        {
          operation: "write_contract_child",
          idempotency_key: childId,
          trace_id: `trace-${childId}`,
          isolation: "serializable",
          retry: "serialization_failures",
        },
        async (transaction, { owner }) =>
          owner.executeWriter<{
            readonly parent_version: number;
            readonly child_id: string;
          }, "write_contract_child_v1">(transaction, {
            writer: "write_contract_child_v1",
            arguments: {
              p_parent_key: `parent-${childId}`,
              p_expected_parent_version: "0",
              p_child_id: childId,
              p_payload: {},
            },
            expected_rows: 1,
          }),
      );
      expect(result).toMatchObject({ child_id: childId, parent_version: 1 });
      const persisted = await postgres.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM timer.contract_children WHERE child_id = $1",
        [childId],
      );
      expect(persisted.rows[0]?.count).toBe("1");
    } finally {
      await composition.close();
    }
  });

  it("cancels an active owner PostgreSQL readiness query and keeps the pool usable", async () => {
    await reset();
    const controller = new AbortController();
    const startedAt = performance.now();
    const readiness = checkOwnerPostgresReadinessV1(
      runtime(),
      controller.signal,
      "SELECT pg_sleep(30)",
    );
    const timer = setTimeout(
      () => controller.abort(new Error("readiness deadline exceeded")),
      100,
    );
    try {
      await expect(readiness).rejects.toThrow();
    } finally {
      clearTimeout(timer);
    }
    expect(performance.now() - startedAt).toBeLessThan(5_000);
    await expect(
      runtime().query("SELECT 1 AS owner_postgres_ready"),
    ).resolves.toMatchObject({ rows: [{ owner_postgres_ready: 1 }] });
  });

  it("re-attests the activated owner deployment during readiness", async () => {
    const postgres = await reset();
    if (databaseUrl === undefined) throw new Error("PAI_TEST_DATABASE_URL is required");
    const runtimeUrl = new URL(databaseUrl);
    runtimeUrl.username = "pai_timer_runtime";
    runtimeUrl.password = "timer-runtime-test";
    const composition = await openVerifiedOwnerPostgresCompositionV1(
      POSTGRES_CONTRACT,
      runtimeUrl.toString(),
    );
    const cleanController = new AbortController();
    const driftController = new AbortController();
    try {
      await expect(
        composition.checkReadiness(cleanController.signal),
      ).resolves.toBeUndefined();
      await postgres.query(
        replacementWriterSql({
          extraStatement: "PERFORM 1;",
        }),
      );
      await expect(
        composition.checkReadiness(driftController.signal),
      ).rejects.toThrow(/drift|fingerprint/u);
    } finally {
      await composition.close();
    }
  });

  it("maps only driver-origin PostgreSQL availability failures to transient storage errors", async () => {
    const postgres = await reset();
    if (databaseUrl === undefined) throw new Error("PAI_TEST_DATABASE_URL is required");
    const runtimeUrl = new URL(databaseUrl);
    runtimeUrl.username = "pai_timer_runtime";
    runtimeUrl.password = "timer-runtime-test";
    const composition = await openVerifiedOwnerPostgresCompositionV1(
      POSTGRES_CONTRACT,
      runtimeUrl.toString(),
    );
    try {
      const applicationError = Object.assign(
        new Error("application-level error with a PostgreSQL-looking code"),
        { code: "08006" },
      );
      await expect(
        composition.unit_of_work.withTransaction(
          {
            operation: "application_error_is_not_database_transient",
            idempotency_key: "application-error",
            trace_id: "trace-application-error",
            isolation: "read_committed",
            retry: "none",
          },
          async () => {
            throw applicationError;
          },
        ),
      ).rejects.toBe(applicationError);

      let contractFailure: unknown;
      try {
        await composition.unit_of_work.withTransaction(
          {
            operation: "database_contract_failure_is_not_transient",
            idempotency_key: "contract-failure",
            trace_id: "trace-contract-failure",
            isolation: "read_committed",
            retry: "none",
          },
          async (transaction, { owner }) =>
            owner.executeWriter(transaction, {
              writer: "write_contract_child_v1",
              arguments: {
                p_parent_key: "parent-contract-failure",
                p_expected_parent_version: "0",
                p_child_id: "child-contract-failure",
                p_payload: { force_failure: true },
              },
              expected_rows: 1,
            }),
        );
      } catch (error) {
        contractFailure = error;
      }
      expect(contractFailure).toBeInstanceOf(Error);
      expect(contractFailure).not.toBeInstanceOf(OwnerRepositoryTransientErrorV1);
      expect((contractFailure as { readonly code?: unknown }).code).toBe("P0001");

      const duplicateChildId = `constraint-${randomUUID()}`;
      await composition.unit_of_work.withTransaction(
        {
          operation: "seed_database_constraint_failure",
          idempotency_key: duplicateChildId,
          trace_id: `trace-${duplicateChildId}`,
          isolation: "read_committed",
          retry: "none",
        },
        async (transaction, { owner }) =>
          owner.executeWriter(transaction, {
            writer: "write_contract_child_v1",
            arguments: {
              p_parent_key: "parent-constraint-failure",
              p_expected_parent_version: "0",
              p_child_id: duplicateChildId,
              p_payload: {},
            },
            expected_rows: 1,
          }),
      );
      let constraintFailure: unknown;
      try {
        await composition.unit_of_work.withTransaction(
          {
            operation: "database_constraint_failure_is_not_transient",
            idempotency_key: `${duplicateChildId}-duplicate`,
            trace_id: `trace-${duplicateChildId}-duplicate`,
            isolation: "read_committed",
            retry: "none",
          },
          async (transaction, { owner }) =>
            owner.executeWriter(transaction, {
              writer: "write_contract_child_v1",
              arguments: {
                p_parent_key: "parent-constraint-failure",
                p_expected_parent_version: "1",
                p_child_id: duplicateChildId,
                p_payload: {},
              },
              expected_rows: 1,
            }),
        );
      } catch (error) {
        constraintFailure = error;
      }
      expect(constraintFailure).toBeInstanceOf(Error);
      expect(constraintFailure).not.toBeInstanceOf(
        OwnerRepositoryTransientErrorV1,
      );
      expect((constraintFailure as { readonly code?: unknown }).code).toBe(
        "23505",
      );

      await postgres.query(`
        CREATE OR REPLACE FUNCTION timer.write_contract_child_v1(
          p_parent_key text,
          p_expected_parent_version bigint,
          p_child_id text,
          p_payload jsonb
        ) RETURNS jsonb
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = timer, pg_temp
        AS $body$
        BEGIN
          RAISE EXCEPTION 'simulated connection failure' USING ERRCODE = '08006';
        END;
        $body$
      `);
      let availabilityFailure: unknown;
      try {
        await composition.unit_of_work.withTransaction(
          {
            operation: "database_availability_failure_is_transient",
            idempotency_key: "availability-failure",
            trace_id: "trace-availability-failure",
            isolation: "read_committed",
            retry: "none",
          },
          async (transaction, { owner }) =>
            owner.executeWriter(transaction, {
              writer: "write_contract_child_v1",
              arguments: {
                p_parent_key: "parent-availability-failure",
                p_expected_parent_version: "0",
                p_child_id: "child-availability-failure",
                p_payload: {},
              },
              expected_rows: 1,
            }),
        );
      } catch (error) {
        availabilityFailure = error;
      }
      expect(availabilityFailure).toBeInstanceOf(OwnerRepositoryTransientErrorV1);
      expect(availabilityFailure).toMatchObject({
        code: "transient_database_error",
      });
      expect(
        (availabilityFailure as OwnerRepositoryTransientErrorV1).cause,
      ).toMatchObject({ code: "08006" });
    } finally {
      await composition.close();
    }
  });

  it("rejects a real PostgreSQL stale outbox ACK before commit", async () => {
    const postgres = await reset();
    if (databaseUrl === undefined) {
      throw new Error("PAI_TEST_DATABASE_URL is required");
    }
    const now = new Date().toISOString();
    const callerSuppliedFuture = "2999-01-01T00:00:00.000Z";
    const outboxId = `outbox-${randomUUID()}`;
    await postgres.query(
      `INSERT INTO timer.eventing_transport_epochs
         (transport_name, active_epoch, active_generation, activated_at)
       VALUES ('redis_stream', 'epoch-1', 1, $1)`,
      [now],
    );
    await postgres.query(
      `INSERT INTO timer.contract_outbox
         (id, status, attempt_count, payload, updated_at)
       VALUES ($1, 'pending', 0, $2::jsonb, $3)`,
      [outboxId, { event: "contract" }, now],
    );
    await expect(
      runtime().query(
        "SELECT claim_token FROM timer.contract_outbox WHERE id = $1",
        [outboxId],
      ),
    ).rejects.toThrow(/permission denied/u);

    const runtimeUrl = new URL(databaseUrl);
    runtimeUrl.username = "pai_timer_runtime";
    runtimeUrl.password = "timer-runtime-test";
    const composition = await openVerifiedOwnerPostgresCompositionV1(
      POSTGRES_CONTRACT,
      runtimeUrl.toString(),
    );
    try {
      await expect(
        composition.outbox.claim({
          outbox_table: "contract_outbox",
          worker_id: "oversized-worker",
          limit: OWNER_OUTBOX_BATCH_MAX_V1 + 1,
          lease_seconds: 30,
          now: callerSuppliedFuture,
          current_transport_epoch: "epoch-1",
          current_transport_generation: 1,
        }),
      ).rejects.toThrow(/invalid owner outbox claim request/u);
      await expect(
        composition.outbox.claim({
          outbox_table: "contract_outbox",
          worker_id: "x".repeat(257),
          limit: 1,
          lease_seconds: 30,
          now: callerSuppliedFuture,
          current_transport_epoch: "epoch-1",
          current_transport_generation: 1,
        }),
      ).rejects.toThrow(/invalid owner outbox claim request/u);

      const mutableClaimRequest: OwnerOutboxClaimRequestV1 = {
        outbox_table: "contract_outbox",
        worker_id: "worker-1",
        limit: 1,
        lease_seconds: 30,
        now: callerSuppliedFuture,
        current_transport_epoch: "epoch-1",
        current_transport_generation: 1,
      };
      const pendingClaim = composition.outbox.claim<{
        readonly outbox_id: string;
        readonly payload: Readonly<Record<string, unknown>>;
        readonly claim_token: string;
      }>(mutableClaimRequest);
      Object.assign(mutableClaimRequest, {
        worker_id: "mutated-worker",
        limit: OWNER_OUTBOX_BATCH_MAX_V1 + 1,
        current_transport_epoch: "mutated-epoch",
      });
      const claimed = await pendingClaim;
      expect(claimed).toHaveLength(1);
      const claimToken = claimed[0]?.claim_token;
      expect(claimToken).toBeTypeOf("string");
      expect(claimToken).toContain("worker-1");
      if (claimToken === undefined) throw new Error("missing claim token");
      await expect(
        postgres.query<{ database_clock_authoritative: boolean }>(
          `SELECT locked_until < pg_catalog.clock_timestamp() + interval '1 minute'
                    AND updated_at < pg_catalog.clock_timestamp() + interval '1 minute'
                    AS database_clock_authoritative
             FROM timer.contract_outbox
            WHERE id = $1`,
          [outboxId],
        ),
      ).resolves.toMatchObject({
        rows: [{ database_clock_authoritative: true }],
      });

      await expect(
        composition.outbox.acknowledge({
          outbox_table: "contract_outbox",
          outbox_id: outboxId,
          claim_token: `${claimToken}-stale`,
          outcome: "sent",
          next_retry_at: null,
          error: null,
          transport_ref: "stream:1-0",
          transport_epoch: "epoch-1",
          transport_generation: 1,
          current_transport_epoch: "epoch-1",
          current_transport_generation: 1,
          now: callerSuppliedFuture,
        }),
      ).rejects.toThrow(/did not confirm its fenced compare-and-set/u);

      const afterStale = await postgres.query<{
        status: string;
        claim_token: string | null;
        transport_ref: string | null;
      }>(
        `SELECT status, claim_token, transport_ref
           FROM timer.contract_outbox
          WHERE id = $1`,
        [outboxId],
      );
      expect(afterStale.rows).toEqual([
        {
          status: "processing",
          claim_token: claimToken,
          transport_ref: null,
        },
      ]);

      let errorGetterCalls = 0;
      const accessorBackedError: Readonly<Record<string, unknown>> = {};
      Object.defineProperty(accessorBackedError, "message", {
        enumerable: true,
        get() {
          errorGetterCalls += 1;
          return "must-not-run";
        },
      });
      await expect(
        composition.outbox.acknowledge({
          outbox_table: "contract_outbox",
          outbox_id: outboxId,
          claim_token: claimToken,
          outcome: "failed",
          next_retry_at: null,
          error: accessorBackedError,
          transport_ref: null,
          transport_epoch: null,
          transport_generation: null,
          current_transport_epoch: "epoch-1",
          current_transport_generation: 1,
          now: callerSuppliedFuture,
        }),
      ).rejects.toThrow(/own data properties/u);
      expect(errorGetterCalls).toBe(0);

      await expect(
        composition.outbox.acknowledge({
          outbox_table: "contract_outbox",
          outbox_id: outboxId,
          claim_token: claimToken,
          outcome: "failed",
          next_retry_at: null,
          error: { message: "x".repeat(16 * 1_024 + 1) },
          transport_ref: null,
          transport_epoch: null,
          transport_generation: null,
          current_transport_epoch: "epoch-1",
          current_transport_generation: 1,
          now: callerSuppliedFuture,
        }),
      ).rejects.toThrow(/bounded JSON contract/u);

      const mutableAcknowledgeRequest: OwnerOutboxAcknowledgeRequestV1 = {
        outbox_table: "contract_outbox",
        outbox_id: outboxId,
        claim_token: claimToken,
        outcome: "sent",
        next_retry_at: null,
        error: null,
        transport_ref: "stream:1-0",
        transport_epoch: "epoch-1",
        transport_generation: 1,
        current_transport_epoch: "epoch-1",
        current_transport_generation: 1,
        now: callerSuppliedFuture,
      };
      const pendingAcknowledge = composition.outbox.acknowledge(
        mutableAcknowledgeRequest,
      );
      Object.assign(mutableAcknowledgeRequest, {
        outcome: "failed",
        error: { code: "mutated-after-call" },
        transport_ref: null,
        transport_epoch: null,
        transport_generation: null,
        current_transport_epoch: "mutated-epoch",
      });
      await expect(pendingAcknowledge).resolves.toEqual({ acknowledged: true });
      await expect(
        postgres.query<{ database_clock_authoritative: boolean }>(
          `SELECT sent_at < pg_catalog.clock_timestamp() + interval '1 minute'
                    AND updated_at < pg_catalog.clock_timestamp() + interval '1 minute'
                    AS database_clock_authoritative
             FROM timer.contract_outbox
            WHERE id = $1`,
          [outboxId],
        ),
      ).resolves.toMatchObject({
        rows: [{ database_clock_authoritative: true }],
      });
    } finally {
      await composition.close();
    }
  });

  it("reports an outbox claim commit disconnect with exact durable claim identities and no repeated lease effect", async () => {
    const postgres = await reset();
    if (databaseUrl === undefined) {
      throw new Error("PAI_TEST_DATABASE_URL is required");
    }
    const now = new Date().toISOString();
    const outboxId = `claim-commit-unknown-${randomUUID()}`;
    await postgres.query(
      `INSERT INTO timer.eventing_transport_epochs
         (transport_name, active_epoch, active_generation, activated_at)
       VALUES ('redis_stream', 'epoch-1', 1, $1)`,
      [now],
    );
    await postgres.query(
      `INSERT INTO timer.contract_outbox
         (id, status, attempt_count, payload, updated_at)
       VALUES ($1, 'pending', 0, '{}'::jsonb, $2)`,
      [outboxId, now],
    );
    const runtimeUrl = new URL(databaseUrl);
    runtimeUrl.username = "pai_timer_runtime";
    runtimeUrl.password = "timer-runtime-test";
    const composition = await openVerifiedOwnerPostgresCompositionV1(
      POSTGRES_CONTRACT,
      runtimeUrl.toString(),
    );
    const mutablePoolPrototype = Pool.prototype as unknown as {
      connect(this: Pool): Promise<PoolClient>;
    };
    const originalConnect = mutablePoolPrototype.connect;
    const releaseDestroyFlags: unknown[] = [];
    const request: OwnerOutboxClaimRequestV1 = {
      outbox_table: "contract_outbox",
      worker_id: "claim-commit-unknown-worker",
      limit: 1,
      lease_seconds: 30,
      now,
      current_transport_epoch: "epoch-1",
      current_transport_generation: 1,
    };
    let commitFailure: unknown;
    try {
      mutablePoolPrototype.connect = async function () {
        const client = await originalConnect.call(this);
        const mutableClient = client as unknown as {
          query: (
            sql: string,
            values?: readonly unknown[],
          ) => Promise<unknown>;
          release: (destroy?: boolean) => void;
        };
        const originalQuery = mutableClient.query;
        const originalRelease = mutableClient.release;
        mutableClient.query = async (sql, values = []) => {
          if (sql === "COMMIT") {
            mutableClient.query = originalQuery;
            await originalQuery.call(client, sql, [...values]);
            throw Object.assign(
              new Error("socket reset after outbox claim commit"),
              { code: "ECONNRESET" },
            );
          }
          return originalQuery.call(client, sql, [...values]);
        };
        mutableClient.release = (destroy) => {
          releaseDestroyFlags.push(destroy);
          originalRelease.call(client, destroy);
        };
        return client;
      };
      try {
        await composition.outbox.claim(request);
      } catch (error) {
        commitFailure = error;
      }
    } finally {
      mutablePoolPrototype.connect = originalConnect;
    }

    try {
      const persisted = await postgres.query<{
        status: string;
        attempt_count: number;
        claimed_by: string;
        claim_token: string;
      }>(
        `SELECT status, attempt_count, claimed_by, claim_token
           FROM timer.contract_outbox
          WHERE id = $1`,
        [outboxId],
      );
      expect(persisted.rows).toHaveLength(1);
      const claimToken = persisted.rows[0]!.claim_token;
      expect(commitFailure).toMatchObject({
        code: "commit_outcome_unknown",
        operation:
          "timer_trigger_app.outbox.claim:timer.contract_outbox",
        idempotency_key: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
        reconciliation: {
          kind: "outbox_claim",
          outbox_table: "contract_outbox",
          worker_id: request.worker_id,
          current_transport_epoch: "epoch-1",
          current_transport_generation: 1,
          claims: [{ outbox_id: outboxId, claim_token: claimToken }],
        },
      });
      expect(releaseDestroyFlags).toContain(true);
      expect(persisted.rows[0]).toMatchObject({
        status: "processing",
        attempt_count: 1,
        claimed_by: request.worker_id,
      });
      await expect(composition.outbox.claim(request)).resolves.toEqual([]);
      await expect(
        postgres.query<{ attempt_count: number }>(
          "SELECT attempt_count FROM timer.contract_outbox WHERE id = $1",
          [outboxId],
        ),
      ).resolves.toMatchObject({ rows: [{ attempt_count: 1 }] });
    } finally {
      await composition.close();
    }
  });

  it("reports an outbox ACK commit disconnect with its exact CAS identity and makes retry a no-op", async () => {
    const postgres = await reset();
    if (databaseUrl === undefined) {
      throw new Error("PAI_TEST_DATABASE_URL is required");
    }
    const now = new Date().toISOString();
    const outboxId = `ack-commit-unknown-${randomUUID()}`;
    await postgres.query(
      `INSERT INTO timer.eventing_transport_epochs
         (transport_name, active_epoch, active_generation, activated_at)
       VALUES ('redis_stream', 'epoch-1', 1, $1)`,
      [now],
    );
    await postgres.query(
      `INSERT INTO timer.contract_outbox
         (id, status, attempt_count, payload, updated_at)
       VALUES ($1, 'pending', 0, '{}'::jsonb, $2)`,
      [outboxId, now],
    );
    const runtimeUrl = new URL(databaseUrl);
    runtimeUrl.username = "pai_timer_runtime";
    runtimeUrl.password = "timer-runtime-test";
    const composition = await openVerifiedOwnerPostgresCompositionV1(
      POSTGRES_CONTRACT,
      runtimeUrl.toString(),
    );
    const claimed = await composition.outbox.claim<{
      readonly outbox_id: string;
      readonly claim_token: string;
    }>({
      outbox_table: "contract_outbox",
      worker_id: "ack-commit-unknown-worker",
      limit: 1,
      lease_seconds: 30,
      now,
      current_transport_epoch: "epoch-1",
      current_transport_generation: 1,
    });
    const claimToken = claimed[0]?.claim_token;
    if (claimToken === undefined) throw new Error("missing claim token");
    const request: OwnerOutboxAcknowledgeRequestV1 = {
      outbox_table: "contract_outbox",
      outbox_id: outboxId,
      claim_token: claimToken,
      outcome: "sent",
      next_retry_at: null,
      error: null,
      transport_ref: "redis_stream:test:1-0",
      transport_epoch: "epoch-1",
      transport_generation: 1,
      current_transport_epoch: "epoch-1",
      current_transport_generation: 1,
      now,
    };
    const mutablePoolPrototype = Pool.prototype as unknown as {
      connect(this: Pool): Promise<PoolClient>;
    };
    const originalConnect = mutablePoolPrototype.connect;
    const releaseDestroyFlags: unknown[] = [];
    let commitFailure: unknown;
    try {
      mutablePoolPrototype.connect = async function () {
        const client = await originalConnect.call(this);
        const mutableClient = client as unknown as {
          query: (
            sql: string,
            values?: readonly unknown[],
          ) => Promise<unknown>;
          release: (destroy?: boolean) => void;
        };
        const originalQuery = mutableClient.query;
        const originalRelease = mutableClient.release;
        mutableClient.query = async (sql, values = []) => {
          if (sql === "COMMIT") {
            mutableClient.query = originalQuery;
            await originalQuery.call(client, sql, [...values]);
            throw Object.assign(
              new Error("socket reset after outbox ACK commit"),
              { code: "ECONNRESET" },
            );
          }
          return originalQuery.call(client, sql, [...values]);
        };
        mutableClient.release = (destroy) => {
          releaseDestroyFlags.push(destroy);
          originalRelease.call(client, destroy);
        };
        return client;
      };
      try {
        await composition.outbox.acknowledge(request);
      } catch (error) {
        commitFailure = error;
      }
    } finally {
      mutablePoolPrototype.connect = originalConnect;
    }

    try {
      expect(commitFailure).toMatchObject({
        code: "commit_outcome_unknown",
        operation: "timer_trigger_app.outbox.ack:timer.contract_outbox",
        idempotency_key: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
        reconciliation: {
          kind: "outbox_ack",
          outbox_table: "contract_outbox",
          outbox_id: outboxId,
          claim_token: claimToken,
          outcome: "sent",
          next_retry_at: null,
          transport_ref: request.transport_ref,
          transport_epoch: "epoch-1",
          transport_generation: 1,
          current_transport_epoch: "epoch-1",
          current_transport_generation: 1,
          error_fingerprint: null,
        },
      });
      expect(releaseDestroyFlags).toContain(true);
      await expect(
        postgres.query<{
          status: string;
          attempt_count: number;
          transport_ref: string;
        }>(
          `SELECT status, attempt_count, transport_ref
             FROM timer.contract_outbox
            WHERE id = $1`,
          [outboxId],
        ),
      ).resolves.toMatchObject({
        rows: [
          {
            status: "sent",
            attempt_count: 1,
            transport_ref: request.transport_ref,
          },
        ],
      });
      await expect(
        composition.outbox.acknowledge(request),
      ).rejects.toThrow(/did not confirm its fenced compare-and-set/u);
      await expect(
        postgres.query<{ attempt_count: number }>(
          "SELECT attempt_count FROM timer.contract_outbox WHERE id = $1",
          [outboxId],
        ),
      ).resolves.toMatchObject({ rows: [{ attempt_count: 1 }] });
    } finally {
      await composition.close();
    }
  });

  it("rolls back a lease when PostgreSQL returns a malformed claim row", async () => {
    const postgres = await reset();
    if (databaseUrl === undefined) {
      throw new Error("PAI_TEST_DATABASE_URL is required");
    }
    const now = new Date().toISOString();
    const outboxId = `malformed-claim-${randomUUID()}`;
    await postgres.query(
      `INSERT INTO timer.contract_outbox
         (id, status, attempt_count, payload, updated_at)
       VALUES ($1, 'pending', 0, '{}'::jsonb, $2)`,
      [outboxId, now],
    );
    const runtimeUrl = new URL(databaseUrl);
    runtimeUrl.username = "pai_timer_runtime";
    runtimeUrl.password = "timer-runtime-test";
    const composition = await openVerifiedOwnerPostgresCompositionV1(
      POSTGRES_CONTRACT,
      runtimeUrl.toString(),
    );
    try {
      await postgres.query(`
        CREATE OR REPLACE FUNCTION timer.claim_contract_outbox_v1(
          p_worker_id text,
          p_limit integer,
          p_lease_seconds integer,
          p_now timestamptz,
          p_current_transport_epoch text,
          p_current_transport_generation bigint
        ) RETURNS SETOF jsonb
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = timer, pg_temp
        AS $body$
        BEGIN
          UPDATE timer.contract_outbox
             SET status = 'processing',
                 claim_token = p_worker_id,
                 updated_at = p_now
           WHERE id = '${outboxId}';
          RETURN NEXT to_jsonb('malformed'::text);
        END;
        $body$
      `);
      await expect(
        composition.outbox.claim({
          outbox_table: "contract_outbox",
          worker_id: "worker-malformed",
          limit: 1,
          lease_seconds: 30,
          now,
          current_transport_epoch: "epoch-1",
          current_transport_generation: 1,
        }),
      ).rejects.toThrow(/invalid fenced identity/u);
      const persisted = await postgres.query<{
        status: string;
        claim_token: string | null;
      }>(
        `SELECT status, claim_token
           FROM timer.contract_outbox
          WHERE id = $1`,
        [outboxId],
      );
      expect(persisted.rows).toEqual([
        { status: "pending", claim_token: null },
      ]);
    } finally {
      await composition.close();
    }
  });

  it.each([
    ["missing function", "DROP FUNCTION timer.write_contract_child_v1(text, bigint, text, jsonb)"],
    ["direct DML", "GRANT UPDATE ON timer.contract_children TO pai_timer_app"],
    ["PUBLIC execute", "GRANT EXECUTE ON FUNCTION timer.write_contract_child_v1(text, bigint, text, jsonb) TO PUBLIC"],
    ["STRICT writer function", "ALTER FUNCTION timer.write_contract_child_v1(text, bigint, text, jsonb) STRICT"],
    ["wrong search_path", "ALTER FUNCTION timer.write_contract_child_v1(text, bigint, text, jsonb) SET search_path = public"],
    [
      "undeclared NOT VALID CHECK helper surface",
      "ALTER TABLE timer.contract_children ADD CONSTRAINT contract_children_payload_extra_check CHECK (jsonb_typeof(payload) = 'object') NOT VALID",
    ],
    [
      "extra LOGIN inheriting the app role",
      `DO $$ BEGIN
         IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pai_timer_intruder') THEN
           CREATE ROLE pai_timer_intruder LOGIN PASSWORD 'timer-intruder-test';
         END IF;
       END $$;
       ALTER ROLE pai_timer_intruder LOGIN INHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD 'timer-intruder-test';
       GRANT pai_timer_app TO pai_timer_intruder WITH INHERIT TRUE, SET FALSE, ADMIN FALSE`,
    ],
    [
      "schema owner LOGIN flag",
      "ALTER ROLE pai_migrator LOGIN PASSWORD 'timer-owner-test'",
    ],
    [
      "extra LOGIN inheriting the schema owner role",
      `DO $$ BEGIN
         IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pai_owner_rogue') THEN
           CREATE ROLE pai_owner_rogue LOGIN PASSWORD 'timer-owner-rogue-test';
         END IF;
       END $$;
       ALTER ROLE pai_owner_rogue LOGIN INHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD 'timer-owner-rogue-test';
       GRANT pai_migrator TO pai_owner_rogue WITH INHERIT TRUE, SET FALSE, ADMIN FALSE`,
    ],
    [
      "schema owner inheriting another role",
      "GRANT pai_memory_app TO pai_migrator WITH INHERIT TRUE, SET FALSE, ADMIN FALSE",
    ],
    [
      "RLS policy on a contract table",
      `ALTER TABLE timer.contract_children ENABLE ROW LEVEL SECURITY;
       CREATE POLICY contract_children_contract_policy
       ON timer.contract_children
       FOR SELECT TO pai_timer_app USING (true)`,
    ],
    [
      "inheritance child outside the owner schema",
      `CREATE SCHEMA timer_shadow AUTHORIZATION pai_migrator;
       SET ROLE pai_migrator;
       CREATE TABLE timer_shadow.contract_children_shadow ()
       INHERITS (timer.contract_children);
       RESET ROLE`,
    ],
    [
      "inbound cross-schema foreign key and its owner-side internal triggers",
      `CREATE SCHEMA timer_rogue AUTHORIZATION pai_migrator;
       SET ROLE pai_migrator;
       CREATE TABLE timer_rogue.inbound_child (
         id text PRIMARY KEY,
         parent_key text NOT NULL,
         parent_version bigint NOT NULL,
         CONSTRAINT inbound_child_parent_fk
           FOREIGN KEY (parent_key, parent_version)
           REFERENCES timer.contract_parents(parent_key, parent_version)
       );
       RESET ROLE`,
    ],
    [
      "disabled internal FK enforcement trigger",
      "ALTER TABLE timer.contract_children DISABLE TRIGGER ALL",
    ],
    [
      "replica-only internal FK enforcement triggers",
      `DO $body$
       DECLARE trigger_name text;
       BEGIN
         FOR trigger_name IN
           SELECT tgname
             FROM pg_catalog.pg_trigger
            WHERE tgrelid = 'timer.contract_children'::regclass
              AND tgisinternal
         LOOP
           EXECUTE format(
             'ALTER TABLE timer.contract_children ENABLE REPLICA TRIGGER %I',
             trigger_name
           );
         END LOOP;
       END
       $body$`,
    ],
    ["UNLOGGED owner table", "ALTER TABLE timer.contract_audits SET UNLOGGED"],
    [
      "UNLOGGED owner sequence",
      "ALTER SEQUENCE timer.contract_owner_sequence SET UNLOGGED",
    ],
    ["missing composite FK", "ALTER TABLE timer.contract_children DROP CONSTRAINT contract_children_parent_fk"],
    [
      "updatable view with app-role DML",
      `CREATE VIEW timer.direct_contract_child_write AS
       SELECT * FROM timer.contract_children;
       GRANT SELECT, INSERT, UPDATE, DELETE
       ON timer.direct_contract_child_write TO pai_timer_app`,
    ],
    [
      "missing primary-key uniqueness",
      "ALTER TABLE timer.contract_audits DROP CONSTRAINT contract_audits_pkey",
    ],
    [
      "column nullability drift",
      "ALTER TABLE timer.contract_audits ALTER COLUMN created_at DROP NOT NULL",
    ],
    [
      "column default drift",
      "ALTER TABLE timer.contract_children ALTER COLUMN payload SET DEFAULT '{}'::jsonb",
    ],
    ["undeclared column", "ALTER TABLE timer.contract_children ADD COLUMN attacker_note text"],
    [
      "foreign-key delete action",
      `ALTER TABLE timer.contract_children DROP CONSTRAINT contract_children_parent_fk;
       ALTER TABLE timer.contract_children ADD CONSTRAINT contract_children_parent_fk
       FOREIGN KEY (parent_key, parent_version)
       REFERENCES timer.contract_parents(parent_key, parent_version)
       ON DELETE CASCADE`,
    ],
    [
      "unvalidated foreign key",
      `ALTER TABLE timer.contract_children DROP CONSTRAINT contract_children_parent_fk;
       ALTER TABLE timer.contract_children ADD CONSTRAINT contract_children_parent_fk
       FOREIGN KEY (parent_key, parent_version)
       REFERENCES timer.contract_parents(parent_key, parent_version)
       NOT VALID`,
    ],
    [
      "DELETE after a declared immutable append",
      replacementWriterSql({
        extraStatement: "DELETE FROM timer.contract_audits WHERE false;",
      }),
    ],
    [
      "TRUNCATE of a declared immutable append table",
      replacementWriterSql({
        extraStatement: "TRUNCATE TABLE timer.contract_audits;",
      }),
    ],
    [
      "cross-owner SECURITY DEFINER read",
      replacementWriterSql({
        extraStatement: "PERFORM secret_value FROM memory.owner_secrets LIMIT 1;",
      }),
    ],
    [
      "comma-separated cross-owner SECURITY DEFINER read",
      replacementWriterSql({
        extraStatement:
          "PERFORM 1 FROM timer.contract_parents p, memory.owner_secrets s WHERE false;",
      }),
    ],
    [
      "MERGE USING cross-owner SECURITY DEFINER read",
      replacementWriterSql({
        extraStatement:
          "MERGE INTO timer.contract_children c USING memory.owner_secrets s ON c.child_id = s.child_id WHEN MATCHED THEN UPDATE SET payload = '{}'::jsonb;",
      }),
    ],
    [
      "unused expected-version argument",
      replacementWriterSql({ expectedVersionCheck: "current_version <> 0" }),
    ],
    [
      "expected-version argument used only as a no-op null check",
      replacementWriterSql({
        expectedVersionCheck: "p_expected_parent_version IS NOT NULL",
      }),
    ],
    [
      "expected-version self comparison",
      replacementWriterSql({
        expectedVersionCheck:
          "p_expected_parent_version = p_expected_parent_version",
      }),
    ],
    [
      "expected-version copied into local variable",
      replacementWriterSql({
        extraDeclare: "v_copy bigint;",
        beforeExpectedVersionCheck: "v_copy := p_expected_parent_version;",
        expectedVersionCheck: "p_expected_parent_version = v_copy",
      }),
    ],
    [
      "expected-version copied through an expression into local variable",
      replacementWriterSql({
        extraDeclare: "v_copy bigint;",
        beforeExpectedVersionCheck:
          "v_copy := coalesce(p_expected_parent_version, p_expected_parent_version);",
        expectedVersionCheck: "p_expected_parent_version = v_copy",
      }),
    ],
    [
      "expected-version direct coalesce comparison",
      replacementWriterSql({
        expectedVersionCheck:
          "p_expected_parent_version = coalesce(p_expected_parent_version, 0)",
      }),
    ],
    [
      "proof hidden behind a constant-false branch",
      replacementWriterSql({
        beforeExpectedVersionCheck: `
          IF 1 = 0 THEN
            INSERT INTO timer.contract_audits(audit_id, child_id, created_at)
            VALUES ('unreachable-' || p_child_id, p_child_id, clock_timestamp());
          END IF;
        `,
      }),
    ],
    [
      "proof hidden behind a NULL branch",
      replacementWriterSql({
        beforeExpectedVersionCheck: `
          IF NULL THEN
            INSERT INTO timer.contract_audits(audit_id, child_id, created_at)
            VALUES ('unreachable-null-' || p_child_id, p_child_id, clock_timestamp());
          END IF;
        `,
      }),
    ],
    [
      "proof hidden behind a string constant-false branch",
      replacementWriterSql({
        beforeExpectedVersionCheck: `
          IF 'a' = 'b' THEN
            INSERT INTO timer.contract_audits(audit_id, child_id, created_at)
            VALUES ('unreachable-string-' || p_child_id, p_child_id, clock_timestamp());
          END IF;
        `,
      }),
    ],
    [
      "proof hidden behind an arithmetic constant-false branch",
      replacementWriterSql({
        beforeExpectedVersionCheck: `
          IF 2 = 3 THEN
            INSERT INTO timer.contract_audits(audit_id, child_id, created_at)
            VALUES ('unreachable-' || p_child_id, p_child_id, clock_timestamp());
          END IF;
        `,
      }),
    ],
    [
      "proof hidden behind a CAST constant-false branch",
      replacementWriterSql({
        beforeExpectedVersionCheck: `
          IF CAST(2 AS integer) = 3 THEN
            INSERT INTO timer.contract_audits(audit_id, child_id, created_at)
            VALUES ('unreachable-cast-' || p_child_id, p_child_id, clock_timestamp());
          END IF;
        `,
      }),
    ],
    [
      "CAS proof read from an unrelated row",
      replacementWriterSql({
        extraDeclare: "unrelated_version bigint;",
        beforeExpectedVersionCheck: `
          SELECT parent_version INTO unrelated_version
            FROM timer.contract_parents
           ORDER BY parent_key, parent_version
           LIMIT 1;
          PERFORM p_expected_parent_version = unrelated_version;
        `,
      }),
    ],
    [
      "fail-closed RAISE swallowed by an exception handler",
      replacementWriterSql().replace(
        "RAISE EXCEPTION 'stale parent version';",
        "BEGIN RAISE EXCEPTION 'stale parent version'; EXCEPTION WHEN OTHERS THEN NULL; END;",
      ),
    ],
    [
      "proof hidden inside a nested dollar-quoted string literal",
      `CREATE OR REPLACE FUNCTION timer.write_contract_child_v1(
         p_parent_key text,
         p_expected_parent_version bigint,
         p_child_id text,
         p_payload jsonb
       ) RETURNS jsonb
       LANGUAGE plpgsql
       SECURITY DEFINER
       SET search_path = timer, pg_temp
       AS $body$
       BEGIN
         PERFORM $proof$
           IF current_version <> p_expected_parent_version THEN
             RAISE EXCEPTION 'stale';
           END IF;
           INSERT INTO timer.contract_parents(parent_key, parent_version)
             VALUES (p_parent_key, p_expected_parent_version + 1);
           INSERT INTO timer.contract_children(child_id, parent_key, parent_version, payload)
             VALUES (p_child_id, p_parent_key, p_expected_parent_version + 1, p_payload);
           INSERT INTO timer.contract_audits(audit_id, child_id, created_at)
             VALUES ('audit-' || p_child_id, p_child_id, clock_timestamp());
         $proof$;
         RETURN '{}'::jsonb;
       END;
       $body$`,
    ],
    [
      "declared effects after an unconditional RETURN",
      `CREATE OR REPLACE FUNCTION timer.write_contract_child_v1(
         p_parent_key text,
         p_expected_parent_version bigint,
         p_child_id text,
         p_payload jsonb
       ) RETURNS jsonb
       LANGUAGE plpgsql
       SECURITY DEFINER
       SET search_path = timer, pg_temp
       AS $body$
       BEGIN
         RETURN '{}'::jsonb;
         INSERT INTO timer.contract_parents(parent_key, parent_version)
           VALUES (p_parent_key, p_expected_parent_version + 1);
         INSERT INTO timer.contract_children(child_id, parent_key, parent_version, payload)
           VALUES (p_child_id, p_parent_key, p_expected_parent_version + 1, p_payload);
         INSERT INTO timer.contract_audits(audit_id, child_id, created_at)
           VALUES ('audit-' || p_child_id, p_child_id, clock_timestamp());
       END;
       $body$`,
    ],
    [
      "undeclared owner helper side effect",
      replacementWriterSql({
        extraStatement: "PERFORM memory.write_side_effect_v1();",
      }),
    ],
    [
      "unqualified undeclared owner helper side effect",
      `CREATE FUNCTION timer.hidden_side_effect_v1() RETURNS void
       LANGUAGE plpgsql AS $helper$ BEGIN
         DELETE FROM timer.contract_audits WHERE false;
       END $helper$;
       ${replacementWriterSql({
         extraStatement: "PERFORM hidden_side_effect_v1();",
       })}`,
    ],
    [
      "undeclared table trigger side effect",
      `CREATE FUNCTION timer.contract_side_effect_trigger_v1() RETURNS trigger
       LANGUAGE plpgsql AS $trigger$ BEGIN
         INSERT INTO timer.contract_audits(audit_id, child_id, created_at)
         VALUES ('trigger-' || NEW.child_id, NEW.child_id, clock_timestamp());
         RETURN NEW;
       END $trigger$;
       CREATE TRIGGER contract_children_side_effect
       AFTER INSERT ON timer.contract_children
       FOR EACH ROW EXECUTE FUNCTION timer.contract_side_effect_trigger_v1()`,
    ],
    [
      "declared effects missing from the function body",
      `CREATE OR REPLACE FUNCTION timer.write_contract_child_v1(
         p_parent_key text,
         p_expected_parent_version bigint,
         p_child_id text,
         p_payload jsonb
       ) RETURNS jsonb
       LANGUAGE plpgsql
       SECURITY DEFINER
       SET search_path = timer, pg_temp
       AS $body$
       BEGIN
         RETURN '{}'::jsonb;
       END;
       $body$`,
    ],
    [
      "unexpected independent pg_index entry",
      `CREATE INDEX contract_children_payload_idx
         ON timer.contract_children USING gin (payload)`,
    ],
  ])("fails closed on %s drift", async (_label, driftSql) => {
    const postgres = await reset();
    await postgres.query(driftSql);
    await expect(
      verifyOwnerRepositoryDeploymentFromPostgresV1(POSTGRES_CONTRACT, postgres, {
        expected_schema_owner: "pai_migrator",
        runtime_postgres: runtime(),
      }),
    ).rejects.toThrow(/drift|missing|forbidden|undeclared|least-privilege|enforcement/);
  });

  it("proves rollback and function-level atomic side effects", async () => {
    const postgres = await reset();
    await expect(
      postgres.query(
        `SELECT timer.write_contract_child_v1($1, $2, $3, $4::jsonb)`,
        ["parent-rollback", "0", "child-rollback", { force_failure: true }],
      ),
    ).rejects.toThrow(/forced writer failure/);
    const result = await postgres.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM timer.contract_parents
       WHERE parent_key = 'parent-rollback'`,
    );
    expect(result.rows[0]?.count).toBe("0");
    const audit = await postgres.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM timer.contract_audits
       WHERE child_id = 'child-rollback'`,
    );
    expect(audit.rows[0]?.count).toBe("0");
  });

  it("rejects NULL expected-version fences at SQL and repository boundaries", async () => {
    const postgres = await reset();
    await expect(
      postgres.query(
        `SELECT timer.write_contract_child_v1($1, $2::bigint, $3, $4::jsonb)`,
        ["parent-null-fence", null, "child-null-fence-sql", {}],
      ),
    ).rejects.toThrow(/stale parent version/u);

    if (databaseUrl === undefined) {
      throw new Error("PAI_TEST_DATABASE_URL is required");
    }
    const runtimeUrl = new URL(databaseUrl);
    runtimeUrl.username = "pai_timer_runtime";
    runtimeUrl.password = "timer-runtime-test";
    const composition = await openVerifiedOwnerPostgresCompositionV1(
      POSTGRES_CONTRACT,
      runtimeUrl.toString(),
    );
    try {
      await expect(
        composition.unit_of_work.withTransaction(
          {
            operation: "write_contract_child_null_fence",
            idempotency_key: "null-fence",
            trace_id: "trace-null-fence",
            isolation: "read_committed",
            retry: "none",
          },
          async (transaction, { owner }) =>
            owner.executeWriter(transaction, {
              writer: "write_contract_child_v1",
              arguments: {
                p_parent_key: "parent-null-fence",
                p_expected_parent_version: null,
                p_child_id: "child-null-fence-repository",
                p_payload: {},
              } as never,
              expected_rows: 1,
            }),
        ),
      ).rejects.toThrow(/does not allow null: p_expected_parent_version/u);

      for (const [label, argumentsValue, expectedType] of [
        [
          "unsafe-number-bigint",
          {
            p_parent_key: "parent-unsafe-number",
            p_expected_parent_version: 9_007_199_254_740_993,
            p_child_id: "child-unsafe-number",
            p_payload: {},
          },
          "bigint",
        ],
        [
          "structured-text",
          {
            p_parent_key: { forged: "text" },
            p_expected_parent_version: "0",
            p_child_id: "child-structured-text",
            p_payload: {},
          },
          "text",
        ],
        [
          "primitive-json",
          {
            p_parent_key: "parent-primitive-json",
            p_expected_parent_version: "0",
            p_child_id: "child-primitive-json",
            p_payload: "not-an-object",
          },
          "jsonb",
        ],
      ] as const) {
        await expect(
          composition.unit_of_work.withTransaction(
            {
              operation: `reject-${label}`,
              idempotency_key: label,
              trace_id: `trace-${label}`,
              isolation: "read_committed",
              retry: "none",
            },
            async (transaction, { owner }) =>
              owner.executeWriter(transaction, {
                writer: "write_contract_child_v1",
                arguments: argumentsValue as never,
                expected_rows: 1,
              }),
          ),
        ).rejects.toThrow(
          new RegExp(`argument type drift.*expected ${expectedType}`, "u"),
        );
      }

      await expect(
        composition.unit_of_work.withTransaction(
          {
            operation: "write_contract_child_nullable_payload",
            idempotency_key: "nullable-payload",
            trace_id: "trace-nullable-payload",
            isolation: "read_committed",
            retry: "none",
          },
          async (transaction, { owner }) =>
            owner.executeWriter(transaction, {
              writer: "write_contract_child_v1",
              arguments: {
                p_parent_key: "parent-nullable-payload",
                p_expected_parent_version: "0",
                p_child_id: "child-nullable-payload",
                p_payload: null,
              },
              expected_rows: 1,
            }),
        ),
      ).resolves.toMatchObject({ child_id: "child-nullable-payload" });
    } finally {
      await composition.close();
    }

    const persisted = await postgres.query<{ count: string }>(
      `SELECT count(*)::text AS count
         FROM timer.contract_children
        WHERE child_id IN ('child-null-fence-sql', 'child-null-fence-repository')`,
    );
    expect(persisted.rows[0]?.count).toBe("0");
    const nullablePayload = await postgres.query<{ payload: unknown }>(
      `SELECT payload
         FROM timer.contract_children
        WHERE child_id = 'child-nullable-payload'`,
    );
    expect(nullablePayload.rows).toEqual([{ payload: {} }]);
  });

  it("rejects a NULL writer result even after a deployment was verified", async () => {
    const postgres = await reset();
    if (databaseUrl === undefined) throw new Error("PAI_TEST_DATABASE_URL is required");
    const runtimeUrl = new URL(databaseUrl);
    runtimeUrl.username = "pai_timer_runtime";
    runtimeUrl.password = "timer-runtime-test";
    const composition = await openVerifiedOwnerPostgresCompositionV1(
      POSTGRES_CONTRACT,
      runtimeUrl.toString(),
    );
    try {
      await postgres.query(`
        CREATE OR REPLACE FUNCTION timer.write_contract_child_v1(
          p_parent_key text,
          p_expected_parent_version bigint,
          p_child_id text,
          p_payload jsonb
        ) RETURNS jsonb
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = timer, pg_temp
        AS $body$
        BEGIN
          RETURN NULL::jsonb;
        END;
        $body$
      `);
      await expect(
        composition.unit_of_work.withTransaction(
          {
            operation: "write_contract_child_null_result",
            idempotency_key: "null-result",
            trace_id: "trace-null-result",
            isolation: "read_committed",
            retry: "none",
          },
          async (transaction, { owner }) =>
            owner.executeWriter(transaction, {
              writer: "write_contract_child_v1",
              arguments: {
                p_parent_key: "parent-null-result",
                p_expected_parent_version: "0",
                p_child_id: "child-null-result",
                p_payload: {},
              },
              expected_rows: 1,
            }),
        ),
      ).rejects.toThrow(/returned null result/u);
    } finally {
      await composition.close();
    }
  });

  it("serializes competing expected-version writers", async () => {
    const postgres = await reset();
    await postgres.query(
      `SELECT timer.write_contract_child_v1($1, $2, $3, $4::jsonb)`,
      ["parent-race", "0", `seed-${randomUUID()}`, {}],
    );
    const first = await postgres.connect();
    const second = await postgres.connect();
    try {
      await first.query("BEGIN");
      await second.query("BEGIN");
      await first.query(
        `SELECT timer.write_contract_child_v1($1, $2, $3, $4::jsonb)`,
        ["parent-race", "1", `winner-${randomUUID()}`, {}],
      );
      const staleWrite = second
        .query(
          `SELECT timer.write_contract_child_v1($1, $2, $3, $4::jsonb)`,
          ["parent-race", "1", `loser-${randomUUID()}`, {}],
        )
        .then(
          () => ({ status: "fulfilled" as const }),
          (error: unknown) => ({ status: "rejected" as const, error }),
        );
      await new Promise<void>((resolve) => setImmediate(resolve));
      await first.query("COMMIT");
      const staleResult = await staleWrite;
      expect(staleResult.status).toBe("rejected");
      if (staleResult.status !== "rejected") {
        throw new Error("expected competing writer to be rejected");
      }
      expect(String((staleResult.error as Error).message)).toMatch(
        /stale parent version/,
      );
      await second.query("ROLLBACK");
    } finally {
      await first.query("ROLLBACK").catch(() => undefined);
      await second.query("ROLLBACK").catch(() => undefined);
      first.release();
      second.release();
    }
  });

  it("denies the public application roles and direct app DML", async () => {
    const postgres = await reset();
    const client = await postgres.connect();
    try {
      await client.query("SET ROLE authenticated");
      await expect(
        client.query(
          `SELECT timer.write_contract_child_v1('p', 0, 'c', '{}'::jsonb)`,
        ),
      ).rejects.toThrow(/permission denied/);
      await client.query("RESET ROLE");
      await client.query("SET ROLE pai_timer_app");
      await expect(
        client.query(
          `UPDATE timer.contract_children SET payload = '{}'::jsonb WHERE false`,
        ),
      ).rejects.toThrow(/permission denied/);
    } finally {
      await client.query("RESET ROLE").catch(() => undefined);
      client.release();
    }
  });

  it("fails closed on inherited DML through an intermediate role", async () => {
    const postgres = await reset();
    await postgres.query("GRANT UPDATE ON timer.contract_children TO pai_runtime_bridge");
    await postgres.query("GRANT pai_runtime_bridge TO pai_timer_runtime");
    await expect(
      verifyOwnerRepositoryDeploymentFromPostgresV1(POSTGRES_CONTRACT, postgres, {
        expected_schema_owner: "pai_migrator",
        runtime_postgres: runtime(),
      }),
    ).rejects.toThrow(/membership|privilege drift/);
  });

  it("fails closed on application role flags or table owner drift", async () => {
    const postgres = await reset();
    await postgres.query("ALTER ROLE pai_timer_app CREATEROLE");
    await expect(
      verifyOwnerRepositoryDeploymentFromPostgresV1(POSTGRES_CONTRACT, postgres, {
        expected_schema_owner: "pai_migrator",
        runtime_postgres: runtime(),
      }),
    ).rejects.toThrow(/application PostgreSQL role|least-privilege/);

    await reset();
    await postgres.query("ALTER TABLE timer.contract_children OWNER TO pai_timer_app");
    await expect(
      verifyOwnerRepositoryDeploymentFromPostgresV1(POSTGRES_CONTRACT, postgres, {
        expected_schema_owner: "pai_migrator",
        runtime_postgres: runtime(),
      }),
    ).rejects.toThrow(/table owner drift|owned tables/);
  });

  it("fails closed on a cross-owner schema and function grant", async () => {
    const postgres = await reset();
    await postgres.query("GRANT USAGE ON SCHEMA timer TO pai_memory_app");
    await postgres.query(
      "GRANT EXECUTE ON FUNCTION timer.write_contract_child_v1(text, bigint, text, jsonb) TO pai_memory_app",
    );
    await expect(
      verifyOwnerRepositoryDeploymentFromPostgresV1(POSTGRES_CONTRACT, postgres, {
        expected_schema_owner: "pai_migrator",
        runtime_postgres: runtime(),
      }),
    ).rejects.toThrow(/cross-owner/);
  });

  it("fails closed when the runtime can read another owner schema", async () => {
    const postgres = await reset();
    await createCrossOwnerFixture(postgres);
    await postgres.query(
      "INSERT INTO memory.owner_secrets(secret_id, secret_value) VALUES ('secret-1', 'classified')",
    );
    await postgres.query("GRANT USAGE ON SCHEMA memory TO pai_timer_app");
    await postgres.query(
      "GRANT SELECT ON memory.owner_secrets TO pai_timer_app",
    );
    await expect(
      runtime().query<{ secret_value: string }>(
        "SELECT secret_value FROM memory.owner_secrets WHERE secret_id = 'secret-1'",
      ),
    ).resolves.toMatchObject({ rows: [{ secret_value: "classified" }] });
    await expect(
      verifyOwnerRepositoryDeploymentFromPostgresV1(POSTGRES_CONTRACT, postgres, {
        expected_schema_owner: "pai_migrator",
        runtime_postgres: runtime(),
      }),
    ).rejects.toThrow(/cross-owner effective runtime schema privilege drift/u);
  });

  it.each([
    [
      "table",
      "GRANT SELECT ON memory.owner_secrets TO pai_timer_app",
      /cross-owner effective runtime table privilege drift/u,
    ],
    [
      "column",
      "GRANT SELECT (secret_value) ON memory.owner_secrets TO pai_timer_app",
      /cross-owner effective runtime column privilege drift/u,
    ],
    [
      "function",
      "GRANT EXECUTE ON FUNCTION memory.read_owner_secret_v1() TO pai_timer_app",
      /cross-owner effective runtime function privilege drift/u,
    ],
    [
      "sequence",
      "GRANT USAGE ON SEQUENCE memory.owner_secret_sequence TO pai_timer_app",
      /cross-owner effective runtime sequence privilege drift/u,
    ],
  ])(
    "fails closed on outgoing cross-owner %s privilege",
    async (_surface, grantSql, expectedError) => {
      const postgres = await reset();
      await createCrossOwnerFixture(postgres);
      await postgres.query(grantSql);
      await expect(
        verifyOwnerRepositoryDeploymentFromPostgresV1(
          POSTGRES_CONTRACT,
          postgres,
          {
            expected_schema_owner: "pai_migrator",
            runtime_postgres: runtime(),
          },
        ),
      ).rejects.toThrow(expectedError);
    },
  );

  it.each([
    [
      "PUBLIC function execute",
      "ALTER DEFAULT PRIVILEGES FOR ROLE pai_migrator GRANT EXECUTE ON FUNCTIONS TO PUBLIC",
    ],
    [
      "application table select",
      "ALTER DEFAULT PRIVILEGES FOR ROLE pai_migrator GRANT SELECT ON TABLES TO pai_timer_app",
    ],
    [
      "application sequence usage",
      "ALTER DEFAULT PRIVILEGES FOR ROLE pai_migrator GRANT USAGE ON SEQUENCES TO pai_timer_app",
    ],
  ])("fails closed on insecure %s defaults", async (_surface, defaultGrantSql) => {
    const postgres = await reset();
    await postgres.query(defaultGrantSql);
    await expect(
      verifyOwnerRepositoryDeploymentFromPostgresV1(POSTGRES_CONTRACT, postgres, {
        expected_schema_owner: "pai_migrator",
        runtime_postgres: runtime(),
      }),
    ).rejects.toThrow(/default privilege drift/u);
  });

  it.each([
    [
      "owner",
      "ALTER SEQUENCE timer.contract_owner_sequence OWNER TO pai_timer_app",
      /sequence owner drift/u,
    ],
    [
      "ACL",
      "GRANT USAGE ON SEQUENCE timer.contract_owner_sequence TO pai_timer_app",
      /sequence privilege drift/u,
    ],
  ])("fails closed on sequence %s drift", async (_surface, driftSql, expectedError) => {
    const postgres = await reset();
    await postgres.query(driftSql);
    await expect(
      verifyOwnerRepositoryDeploymentFromPostgresV1(POSTGRES_CONTRACT, postgres, {
        expected_schema_owner: "pai_migrator",
        runtime_postgres: runtime(),
      }),
    ).rejects.toThrow(expectedError);
  });

  it("fails closed when the runtime DSN is an admin connection", async () => {
    const postgres = await reset();
    await expect(
      verifyOwnerRepositoryDeploymentFromPostgresV1(POSTGRES_CONTRACT, postgres, {
        expected_schema_owner: "pai_migrator",
        runtime_postgres: postgres,
      }),
    ).rejects.toThrow(/least-privilege LOGIN/);
  });
});
