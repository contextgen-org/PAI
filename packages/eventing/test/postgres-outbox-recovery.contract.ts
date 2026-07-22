import { Pool } from "pg";
import { createClient } from "redis";
import { afterAll, describe, expect, it } from "vitest";

import {
  defineOwnerRepositoryContractV1,
  openVerifiedOwnerPostgresCompositionV1,
  ownerFunctionSignatureV1,
  ownerWriterArtifactV1,
} from "@pai/persistence";

import {
  canonicalDurableEventEnvelopeSemanticHashV1,
  canonicalPayloadHashV1,
  durableEventScopeFingerprintV1,
  createDurableEventConsumerWorkerV1,
  createDurableInboxConsumerV1,
  createDurableOutboxDispatcherV1,
  createDurableSentOutboxRedriverV1,
  createRedisNamespaceV1,
  createRedisStreamConsumerGroupPortV1,
  namespacedRedisKeyV1,
  openVerifiedRedisStreamCompositionV1,
  type DurableEventDeliveryConsumerPortV1,
  type ClaimedOutboxRecordV1,
  type ClaimedSentOutboxRecordV1,
  type DurableOutboxStorePortV1,
  type DurableSentOutboxRedriveStorePortV1,
  type DurableEventTransportPortV1,
} from "../src/index.js";

const databaseUrl = process.env.PAI_TEST_DATABASE_URL;
const redisUrl = process.env.PAI_TEST_REDIS_URL;
const itPostgresRedis =
  databaseUrl === undefined || redisUrl === undefined ? it.skip : it;

function eventingColumn<const TTable extends string>(
  table_name: TTable,
  column_name: string,
  postgres_type: string,
  not_null = true,
  default_expression: string | null = null,
) {
  return {
    table_name,
    column_name,
    postgres_type,
    not_null,
    default_expression,
    identity: "" as const,
    generated: "" as const,
  };
}

const EVENTING_CONTRACT_INPUT = {
  contract_version: "owner_repository_contract.v1",
  owner_service: "skill_registry",
  schema: "skill_registry",
  app_role: "pai_skill_registry_app",
  fresh_migrations: ["0450_skill_registry"],
  manifest_source: "services/skill-registry/src/db/permission-manifest.v1.ts",
  generated_permission_sql: [
    "pai-infra/supabase/generated/permissions/0450_skill_registry.sql",
  ],
  tables: [
    "eventing_outbox",
    "eventing_transport_epochs",
    "eventing_inbox",
    "eventing_projection",
    "eventing_audit",
    "eventing_dlq",
  ],
  table_permissions: [
    {
      table_name: "eventing_outbox",
      select_columns: [
        "id",
        "event_type",
        "schema_version",
        "producer",
        "occurred_at",
        "idempotency_key",
        "trace_id",
        "payload",
        "payload_hash",
        "target",
        "status",
        "attempt_count",
        "next_retry_at",
        "claimed_by",
        "claim_token",
        "locked_until",
        "last_error",
        "transport_ref",
        "transport_epoch",
        "transport_generation",
        "sent_at",
        "redrive_claimed_by",
        "redrive_claim_token",
        "redrive_claim_generation",
        "redrive_locked_until",
        "created_at",
        "updated_at",
      ],
      insert_columns: [],
      update_columns: [],
      delete_allowed: false,
      writer_kind: "outbox_claim_ack",
    },
    {
      table_name: "eventing_transport_epochs",
      select_columns: [
        "transport_name",
        "active_epoch",
        "active_generation",
        "activated_at",
      ],
      insert_columns: [],
      update_columns: [],
      delete_allowed: false,
      writer_kind: "pointer_cas",
    },
    {
      table_name: "eventing_inbox",
      select_columns: [
        "id",
        "source",
        "event_id",
        "scope_fingerprint",
        "idempotency_key",
        "payload_hash",
        "semantic_hash",
        "processed_at",
        "created_at",
      ],
      insert_columns: [],
      update_columns: [],
      delete_allowed: false,
      writer_kind: "immutable_append",
    },
    {
      table_name: "eventing_dlq",
      select_columns: [
        "id",
        "source_event_id",
        "event_type",
        "payload",
        "last_error",
        "failed_at",
        "resolved_at",
      ],
      insert_columns: [],
      update_columns: [],
      delete_allowed: false,
      writer_kind: "immutable_append",
    },
    {
      table_name: "eventing_projection",
      select_columns: [
        "id",
        "source",
        "scope_fingerprint",
        "idempotency_key",
        "semantic_hash",
        "applied_count",
        "updated_at",
      ],
      insert_columns: [],
      update_columns: [],
      delete_allowed: false,
      writer_kind: "projection_upsert",
    },
    {
      table_name: "eventing_audit",
      select_columns: [
        "id",
        "inbox_id",
        "event_id",
        "semantic_hash",
        "created_at",
      ],
      insert_columns: [],
      update_columns: [],
      delete_allowed: false,
      writer_kind: "immutable_append",
    },
  ],
  mutable_writers: [
    "enqueue_eventing_outbox_v1",
    "claim_eventing_outbox_v1",
    "ack_eventing_outbox_v1",
    "consume_eventing_inbox_v1",
    "record_eventing_consumer_dlq_v1",
    "claim_sent_eventing_outbox_redrive_v1",
    "activate_eventing_transport_epoch_v1",
    "ack_sent_eventing_outbox_redrive_v1",
  ],
  function_signatures: [
    ownerFunctionSignatureV1({
      schema: "skill_registry",
      function_name: "enqueue_eventing_outbox_v1",
      primary_table: "eventing_outbox",
      writer_kind: "outbox_claim_ack",
      arguments: [
        ["p_event", "jsonb"],
        ["p_idempotency_key", "text"],
        ["p_payload_hash", "text"],
      ],
      reads_tables: ["eventing_outbox"],
      writes_tables: ["eventing_outbox"],
      effects: [
        {
          table_name: "eventing_outbox",
          operation: "enqueue",
          concurrency_control: "idempotency_key",
        },
      ],
      returns: "jsonb",
    }),
    ownerFunctionSignatureV1({
      schema: "skill_registry",
      function_name: "claim_eventing_outbox_v1",
      primary_table: "eventing_outbox",
      writer_kind: "outbox_claim_ack",
      arguments: [
        ["p_worker_id", "text"],
        ["p_limit", "integer"],
        ["p_lease_seconds", "integer"],
        ["p_now", "timestamptz"],
        ["p_current_transport_epoch", "text"],
        ["p_current_transport_generation", "bigint"],
      ],
      reads_tables: ["eventing_outbox", "eventing_transport_epochs"],
      writes_tables: ["eventing_outbox"],
      effects: [
        {
          table_name: "eventing_outbox",
          operation: "claim",
          concurrency_control: "lease_fence",
        },
      ],
      returns: "setof jsonb",
    }),
    ownerFunctionSignatureV1({
      schema: "skill_registry",
      function_name: "ack_eventing_outbox_v1",
      primary_table: "eventing_outbox",
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
      reads_tables: ["eventing_outbox", "eventing_transport_epochs"],
      writes_tables: ["eventing_outbox", "eventing_dlq"],
      effects: [
        {
          table_name: "eventing_outbox",
          operation: "ack",
          concurrency_control: "lease_fence",
        },
        {
          table_name: "eventing_dlq",
          operation: "append",
          concurrency_control: "idempotency_key",
        },
      ],
      returns: "jsonb",
    }),
    ownerFunctionSignatureV1({
      schema: "skill_registry",
      function_name: "consume_eventing_inbox_v1",
      primary_table: "eventing_inbox",
      writer_kind: "immutable_append",
      arguments: [
        ["p_event", "jsonb"],
        ["p_idempotency_key", "text"],
        ["p_payload_hash", "text"],
        ["p_semantic_hash", "text"],
        ["p_scope_fingerprint", "text"],
      ],
      reads_tables: ["eventing_inbox", "eventing_projection"],
      writes_tables: ["eventing_inbox", "eventing_projection", "eventing_audit"],
      effects: [
        {
          table_name: "eventing_inbox",
          operation: "append",
          concurrency_control: "idempotency_key",
        },
        {
          table_name: "eventing_projection",
          operation: "upsert",
          concurrency_control: "idempotency_key",
        },
        {
          table_name: "eventing_audit",
          operation: "append",
          concurrency_control: "idempotency_key",
        },
      ],
      returns: "jsonb",
    }),
    ownerFunctionSignatureV1({
      schema: "skill_registry",
      function_name: "record_eventing_consumer_dlq_v1",
      primary_table: "eventing_dlq",
      writer_kind: "immutable_append",
      arguments: [
        ["p_delivery_id", "text"],
        ["p_delivery_ref", "text"],
        ["p_consumer_service", "text"],
        ["p_failure_code", "text"],
        ["p_failure_message", "text"],
        ["p_raw_fields", "jsonb"],
        ["p_envelope", "jsonb"],
        ["p_now", "timestamptz"],
      ],
      reads_tables: ["eventing_dlq"],
      writes_tables: ["eventing_dlq", "eventing_audit"],
      effects: [
        {
          table_name: "eventing_dlq",
          operation: "append",
          concurrency_control: "idempotency_key",
        },
        {
          table_name: "eventing_audit",
          operation: "append",
          concurrency_control: "idempotency_key",
        },
      ],
      returns: "jsonb",
    }),
    ownerFunctionSignatureV1({
      schema: "skill_registry",
      function_name: "claim_sent_eventing_outbox_redrive_v1",
      primary_table: "eventing_outbox",
      writer_kind: "outbox_claim_ack",
      arguments: [
        ["p_worker_id", "text"],
        ["p_limit", "integer"],
        ["p_lease_seconds", "integer"],
        ["p_now", "timestamptz"],
        ["p_current_transport_epoch", "text"],
        ["p_current_transport_generation", "bigint"],
      ],
      reads_tables: ["eventing_outbox", "eventing_transport_epochs"],
      writes_tables: ["eventing_outbox"],
      effects: [
        {
          table_name: "eventing_outbox",
          operation: "redrive_claim",
          concurrency_control: "lease_fence",
        },
      ],
      returns: "setof jsonb",
    }),
    ownerFunctionSignatureV1({
      schema: "skill_registry",
      function_name: "activate_eventing_transport_epoch_v1",
      primary_table: "eventing_transport_epochs",
      writer_kind: "pointer_cas",
      arguments: [
        ["p_transport_name", "text"],
        ["p_expected_generation", "bigint"],
        ["p_next_epoch", "text"],
        ["p_next_generation", "bigint"],
        ["p_now", "timestamptz"],
      ],
      reads_tables: ["eventing_transport_epochs"],
      writes_tables: ["eventing_transport_epochs"],
      effects: [
        {
          table_name: "eventing_transport_epochs",
          operation: "cas",
          concurrency_control: "generation_fence",
        },
      ],
      returns: "jsonb",
    }),
    ownerFunctionSignatureV1({
      schema: "skill_registry",
      function_name: "ack_sent_eventing_outbox_redrive_v1",
      primary_table: "eventing_outbox",
      writer_kind: "outbox_claim_ack",
      arguments: [
        ["p_outbox_id", "text"],
        ["p_claim_token", "text"],
        ["p_previous_transport_epoch", "text"],
        ["p_previous_transport_generation", "bigint"],
        ["p_transport_ref", "text"],
        ["p_transport_epoch", "text"],
        ["p_current_transport_generation", "bigint"],
        ["p_now", "timestamptz"],
      ],
      reads_tables: ["eventing_outbox", "eventing_transport_epochs"],
      writes_tables: ["eventing_outbox"],
      effects: [
        {
          table_name: "eventing_outbox",
          operation: "redrive_ack",
          concurrency_control: "lease_fence",
        },
      ],
      returns: "jsonb",
    }),
  ],
  foreign_key_snapshot: {
    status: "known_empty",
    source: "Day 5 isolated PostgreSQL eventing contract fixture",
    justification: "The fixture contains no same-owner parent-child relation.",
  },
  foreign_keys: [],
  database_columns: [
    eventingColumn("eventing_dlq", "id", "text"),
    eventingColumn("eventing_dlq", "source_event_id", "text"),
    eventingColumn("eventing_dlq", "event_type", "text"),
    eventingColumn("eventing_dlq", "payload", "jsonb"),
    eventingColumn("eventing_dlq", "last_error", "jsonb"),
    eventingColumn("eventing_dlq", "failed_at", "timestamp with time zone"),
    eventingColumn(
      "eventing_dlq",
      "resolved_at",
      "timestamp with time zone",
      false,
    ),
    eventingColumn("eventing_inbox", "id", "text"),
    eventingColumn("eventing_inbox", "source", "text"),
    eventingColumn("eventing_inbox", "event_id", "text"),
    eventingColumn("eventing_inbox", "scope_fingerprint", "text"),
    eventingColumn("eventing_inbox", "idempotency_key", "text"),
    eventingColumn("eventing_inbox", "payload_hash", "text"),
    eventingColumn("eventing_inbox", "semantic_hash", "text"),
    eventingColumn(
      "eventing_inbox",
      "processed_at",
      "timestamp with time zone",
    ),
    eventingColumn(
      "eventing_inbox",
      "created_at",
      "timestamp with time zone",
    ),
    eventingColumn("eventing_projection", "id", "text"),
    eventingColumn("eventing_projection", "source", "text"),
    eventingColumn("eventing_projection", "scope_fingerprint", "text"),
    eventingColumn("eventing_projection", "idempotency_key", "text"),
    eventingColumn("eventing_projection", "semantic_hash", "text"),
    eventingColumn("eventing_projection", "applied_count", "integer", true, "0"),
    eventingColumn(
      "eventing_projection",
      "updated_at",
      "timestamp with time zone",
    ),
    eventingColumn("eventing_audit", "id", "text"),
    eventingColumn("eventing_audit", "inbox_id", "text"),
    eventingColumn("eventing_audit", "event_id", "text"),
    eventingColumn("eventing_audit", "semantic_hash", "text"),
    eventingColumn("eventing_audit", "created_at", "timestamp with time zone"),
    eventingColumn("eventing_outbox", "id", "text"),
    eventingColumn("eventing_outbox", "event_type", "text"),
    eventingColumn("eventing_outbox", "schema_version", "text"),
    eventingColumn("eventing_outbox", "producer", "text"),
    eventingColumn(
      "eventing_outbox",
      "occurred_at",
      "timestamp with time zone",
    ),
    eventingColumn("eventing_outbox", "idempotency_key", "text"),
    eventingColumn("eventing_outbox", "trace_id", "text"),
    eventingColumn("eventing_outbox", "payload", "jsonb"),
    eventingColumn("eventing_outbox", "payload_hash", "text"),
    eventingColumn("eventing_outbox", "target", "text"),
    eventingColumn("eventing_outbox", "status", "text"),
    eventingColumn("eventing_outbox", "attempt_count", "integer", true, "0"),
    eventingColumn(
      "eventing_outbox",
      "next_retry_at",
      "timestamp with time zone",
      false,
    ),
    eventingColumn("eventing_outbox", "claimed_by", "text", false),
    eventingColumn("eventing_outbox", "claim_token", "text", false),
    eventingColumn(
      "eventing_outbox",
      "locked_until",
      "timestamp with time zone",
      false,
    ),
    eventingColumn("eventing_outbox", "last_error", "jsonb", false),
    eventingColumn("eventing_outbox", "transport_ref", "text", false),
    eventingColumn("eventing_outbox", "transport_epoch", "text", false),
    eventingColumn("eventing_outbox", "transport_generation", "bigint", false),
    eventingColumn(
      "eventing_outbox",
      "sent_at",
      "timestamp with time zone",
      false,
    ),
    eventingColumn("eventing_outbox", "redrive_claimed_by", "text", false),
    eventingColumn("eventing_outbox", "redrive_claim_token", "text", false),
    eventingColumn(
      "eventing_outbox",
      "redrive_claim_generation",
      "bigint",
      true,
      "0",
    ),
    eventingColumn(
      "eventing_outbox",
      "redrive_locked_until",
      "timestamp with time zone",
      false,
    ),
    eventingColumn(
      "eventing_outbox",
      "created_at",
      "timestamp with time zone",
    ),
    eventingColumn(
      "eventing_outbox",
      "updated_at",
      "timestamp with time zone",
    ),
    eventingColumn("eventing_transport_epochs", "transport_name", "text"),
    eventingColumn("eventing_transport_epochs", "active_epoch", "text"),
    eventingColumn("eventing_transport_epochs", "active_generation", "bigint"),
    eventingColumn(
      "eventing_transport_epochs",
      "activated_at",
      "timestamp with time zone",
    ),
  ],
  database_unique_constraints: [
    {
      constraint_name: "eventing_dlq_pkey",
      table_name: "eventing_dlq",
      columns: ["id"],
      kind: "primary_key",
      deferrable: false,
      initially_deferred: false,
      validated: true,
    },
    {
      constraint_name: "eventing_inbox_pkey",
      table_name: "eventing_inbox",
      columns: ["id"],
      kind: "primary_key",
      deferrable: false,
      initially_deferred: false,
      validated: true,
    },
    {
      constraint_name: "eventing_inbox_source_scope_fingerprint_idempotency_key_key",
      table_name: "eventing_inbox",
      columns: ["source", "scope_fingerprint", "idempotency_key"],
      kind: "unique",
      deferrable: false,
      initially_deferred: false,
      validated: true,
    },
    {
      constraint_name: "eventing_outbox_idempotency_key_key",
      table_name: "eventing_outbox",
      columns: ["idempotency_key"],
      kind: "unique",
      deferrable: false,
      initially_deferred: false,
      validated: true,
    },
    {
      constraint_name: "eventing_outbox_pkey",
      table_name: "eventing_outbox",
      columns: ["id"],
      kind: "primary_key",
      deferrable: false,
      initially_deferred: false,
      validated: true,
    },
    {
      constraint_name: "eventing_transport_epochs_pkey",
      table_name: "eventing_transport_epochs",
      columns: ["transport_name"],
      kind: "primary_key",
      deferrable: false,
      initially_deferred: false,
      validated: true,
    },
    {
      constraint_name: "eventing_projection_pkey",
      table_name: "eventing_projection",
      columns: ["id"],
      kind: "primary_key",
      deferrable: false,
      initially_deferred: false,
      validated: true,
    },
    {
      constraint_name: "eventing_audit_pkey",
      table_name: "eventing_audit",
      columns: ["id"],
      kind: "primary_key",
      deferrable: false,
      initially_deferred: false,
      validated: true,
    },
  ],
  database_indexes: [
    {
      index_name: "eventing_dlq_pkey",
      table_name: "eventing_dlq",
      definition:
        "CREATE UNIQUE INDEX eventing_dlq_pkey ON skill_registry.eventing_dlq USING btree (id)",
      unique: true,
      primary: true,
      valid: true,
    },
    {
      index_name: "eventing_inbox_pkey",
      table_name: "eventing_inbox",
      definition:
        "CREATE UNIQUE INDEX eventing_inbox_pkey ON skill_registry.eventing_inbox USING btree (id)",
      unique: true,
      primary: true,
      valid: true,
    },
    {
      index_name: "eventing_inbox_source_scope_fingerprint_idempotency_key_key",
      table_name: "eventing_inbox",
      definition:
        "CREATE UNIQUE INDEX eventing_inbox_source_scope_fingerprint_idempotency_key_key ON skill_registry.eventing_inbox USING btree (source, scope_fingerprint, idempotency_key)",
      unique: true,
      primary: false,
      valid: true,
    },
    {
      index_name: "eventing_outbox_idempotency_key_key",
      table_name: "eventing_outbox",
      definition:
        "CREATE UNIQUE INDEX eventing_outbox_idempotency_key_key ON skill_registry.eventing_outbox USING btree (idempotency_key)",
      unique: true,
      primary: false,
      valid: true,
    },
    {
      index_name: "eventing_outbox_pkey",
      table_name: "eventing_outbox",
      definition:
        "CREATE UNIQUE INDEX eventing_outbox_pkey ON skill_registry.eventing_outbox USING btree (id)",
      unique: true,
      primary: true,
      valid: true,
    },
    {
      index_name: "eventing_transport_epochs_pkey",
      table_name: "eventing_transport_epochs",
      definition:
        "CREATE UNIQUE INDEX eventing_transport_epochs_pkey ON skill_registry.eventing_transport_epochs USING btree (transport_name)",
      unique: true,
      primary: true,
      valid: true,
    },
    {
      index_name: "eventing_projection_pkey",
      table_name: "eventing_projection",
      definition:
        "CREATE UNIQUE INDEX eventing_projection_pkey ON skill_registry.eventing_projection USING btree (id)",
      unique: true,
      primary: true,
      valid: true,
    },
    {
      index_name: "eventing_audit_pkey",
      table_name: "eventing_audit",
      definition:
        "CREATE UNIQUE INDEX eventing_audit_pkey ON skill_registry.eventing_audit USING btree (id)",
      unique: true,
      primary: true,
      valid: true,
    },
  ],
  database_checks: [
    {
      constraint_name: "eventing_transport_epochs_active_generation_safe_check",
      table_name: "eventing_transport_epochs",
      required_definition_fragments: [
        "active_generation >= 1",
        "9007199254740991",
      ],
      semantic_constraint: {
        kind: "integer_range",
        column_name: "active_generation",
        min: 1,
        max: Number.MAX_SAFE_INTEGER,
      },
    },
    {
      constraint_name: "eventing_outbox_event_type_check",
      table_name: "eventing_outbox",
      required_definition_fragments: ["event_type", "skill.version.published"],
      semantic_constraint: {
        kind: "text_enum",
        column_name: "event_type",
        allowed_values: ["skill.version.published"],
      },
    },
    {
      constraint_name: "eventing_outbox_producer_check",
      table_name: "eventing_outbox",
      required_definition_fragments: ["producer", "skill_registry"],
      semantic_constraint: {
        kind: "text_equals",
        column_name: "producer",
        value: "skill_registry",
      },
    },
    {
      constraint_name: "eventing_outbox_status_check",
      table_name: "eventing_outbox",
      required_definition_fragments: [
        "pending",
        "dispatching",
        "sent",
        "retry_wait",
        "failed",
      ],
      semantic_constraint: {
        kind: "text_enum",
        column_name: "status",
        allowed_values: [
          "pending",
          "dispatching",
          "sent",
          "retry_wait",
          "failed",
        ],
      },
    },
  ],
  append_only_tables: [
    "eventing_outbox",
    "eventing_inbox",
    "eventing_audit",
    "eventing_dlq",
  ],
  outbox_tables: ["eventing_outbox"],
  inbox_tables: ["eventing_inbox"],
  dlq_tables: ["eventing_dlq"],
  object_metadata_tables: [],
} as const;

const setupSql = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pai_migrator') THEN
    CREATE ROLE pai_migrator NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pai_skill_registry_app') THEN
    CREATE ROLE pai_skill_registry_app NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pai_skill_registry_eventing_test') THEN
    CREATE ROLE pai_skill_registry_eventing_test LOGIN PASSWORD 'eventing-runtime-test';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END $$;
ALTER ROLE pai_skill_registry_app NOLOGIN INHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
ALTER ROLE pai_skill_registry_eventing_test LOGIN INHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD 'eventing-runtime-test';
REVOKE pai_skill_registry_app FROM pai_skill_registry_eventing_test;
GRANT pai_skill_registry_app TO pai_skill_registry_eventing_test WITH INHERIT TRUE, SET FALSE, ADMIN FALSE;
DROP SCHEMA IF EXISTS skill_registry CASCADE;
CREATE SCHEMA skill_registry AUTHORIZATION pai_migrator;
REVOKE ALL ON SCHEMA skill_registry FROM PUBLIC, anon, authenticated, pai_skill_registry_eventing_test;
GRANT USAGE ON SCHEMA skill_registry TO pai_skill_registry_app;
SET ROLE pai_migrator;
CREATE TABLE skill_registry.eventing_outbox (
  id text PRIMARY KEY,
  event_type text NOT NULL CHECK (event_type IN ('skill.version.published')),
  schema_version text NOT NULL,
  producer text NOT NULL CHECK (producer = 'skill_registry'),
  occurred_at timestamptz NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  trace_id text NOT NULL,
  payload jsonb NOT NULL,
  payload_hash text NOT NULL,
  target text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending','dispatching','sent','retry_wait','failed')),
  attempt_count integer NOT NULL DEFAULT 0,
  next_retry_at timestamptz,
  claimed_by text,
  claim_token text,
  locked_until timestamptz,
  last_error jsonb,
  transport_ref text,
  transport_epoch text,
  transport_generation bigint,
  sent_at timestamptz,
  redrive_claimed_by text,
  redrive_claim_token text,
  redrive_claim_generation bigint NOT NULL DEFAULT 0,
  redrive_locked_until timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
CREATE TABLE skill_registry.eventing_transport_epochs (
  transport_name text PRIMARY KEY,
  active_epoch text NOT NULL,
  active_generation bigint NOT NULL,
  activated_at timestamptz NOT NULL
);
ALTER TABLE skill_registry.eventing_transport_epochs
  ADD CONSTRAINT eventing_transport_epochs_active_generation_safe_check
  CHECK (
    active_generation >= 1
    AND active_generation <= 9007199254740991
  );
INSERT INTO skill_registry.eventing_transport_epochs(
  transport_name, active_epoch, active_generation, activated_at
) VALUES ('redis_stream', 'epoch_1', 1, '2026-07-22T00:00:00.000Z');
CREATE TABLE skill_registry.eventing_inbox (
  id text PRIMARY KEY,
  source text NOT NULL,
  event_id text NOT NULL,
  scope_fingerprint text NOT NULL,
  idempotency_key text NOT NULL,
  payload_hash text NOT NULL,
  semantic_hash text NOT NULL,
  processed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  UNIQUE (source, scope_fingerprint, idempotency_key)
);
CREATE TABLE skill_registry.eventing_dlq (
  id text PRIMARY KEY,
  source_event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  last_error jsonb NOT NULL,
  failed_at timestamptz NOT NULL,
  resolved_at timestamptz
);
CREATE TABLE skill_registry.eventing_projection (
  id text PRIMARY KEY,
  source text NOT NULL,
  scope_fingerprint text NOT NULL,
  idempotency_key text NOT NULL,
  semantic_hash text NOT NULL,
  applied_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL
);
CREATE TABLE skill_registry.eventing_audit (
  id text PRIMARY KEY,
  inbox_id text NOT NULL,
  event_id text NOT NULL,
  semantic_hash text NOT NULL,
  created_at timestamptz NOT NULL
);
CREATE FUNCTION skill_registry.enqueue_eventing_outbox_v1(
  p_event jsonb,
  p_idempotency_key text,
  p_payload_hash text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = skill_registry, pg_temp
AS $$
DECLARE result jsonb;
BEGIN
  INSERT INTO skill_registry.eventing_outbox(
    id, event_type, schema_version, producer, occurred_at, idempotency_key,
    trace_id, payload, payload_hash, target, status, created_at, updated_at
  ) VALUES (
    p_event->>'event_id', p_event->>'event_type', p_event->>'schema_version',
    p_event->>'producer', (p_event->>'occurred_at')::timestamptz,
    p_idempotency_key, p_event->>'trace_id', p_event->'payload', p_payload_hash,
    'trigger_processor.runtime_event_append', 'pending', clock_timestamp(), clock_timestamp()
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING jsonb_build_object('outbox_id', id, 'status', status) INTO result;
  IF result IS NULL THEN
    SELECT jsonb_build_object('outbox_id', id, 'status', status)
      INTO result
      FROM skill_registry.eventing_outbox
     WHERE idempotency_key = p_idempotency_key
       AND payload_hash = p_payload_hash;
    IF result IS NULL THEN
      RAISE EXCEPTION 'outbox idempotency payload hash conflict';
    END IF;
  END IF;
  RETURN result;
END;
$$;
CREATE FUNCTION skill_registry.claim_eventing_outbox_v1(
  p_worker_id text,
  p_limit integer,
  p_lease_seconds integer,
  p_now timestamptz,
  p_current_transport_epoch text,
  p_current_transport_generation bigint
) RETURNS SETOF jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = skill_registry, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT outbox.id
      FROM skill_registry.eventing_outbox outbox
      JOIN skill_registry.eventing_transport_epochs active
        ON active.transport_name = 'redis_stream'
     WHERE active.active_epoch = p_current_transport_epoch
       AND active.active_generation = p_current_transport_generation
       AND (
         outbox.status IN ('pending','retry_wait')
         OR (outbox.status = 'dispatching' AND outbox.locked_until <= p_now)
       )
       AND (outbox.next_retry_at IS NULL OR outbox.next_retry_at <= p_now)
    ORDER BY created_at, id
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  ), claimed AS (
    UPDATE skill_registry.eventing_outbox outbox
       SET status = 'dispatching',
           attempt_count = outbox.attempt_count + 1,
           claimed_by = p_worker_id,
           claim_token = p_worker_id || ':' || outbox.id || ':' ||
             (outbox.attempt_count + 1)::text || ':' ||
             p_current_transport_epoch || ':' ||
             p_current_transport_generation::text,
           locked_until = p_now + make_interval(secs => p_lease_seconds),
           updated_at = p_now
      FROM candidates
     WHERE outbox.id = candidates.id
     RETURNING outbox.*
  )
  SELECT jsonb_build_object(
    'outbox_id', id,
    'claim_token', claim_token,
    'attempt_count', attempt_count,
    'target', target,
    'payload_hash', payload_hash,
    'envelope', jsonb_build_object(
      'event_id', id,
      'event_type', event_type,
      'schema_version', schema_version,
      'producer', producer,
      'occurred_at', to_char(occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'idempotency_key', idempotency_key,
      'trace_id', trace_id,
      'payload', payload
    )
  ) FROM claimed;
END;
$$;
CREATE FUNCTION skill_registry.ack_eventing_outbox_v1(
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
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = skill_registry, pg_temp
AS $$
DECLARE
  current_event skill_registry.eventing_outbox%ROWTYPE;
  active_epoch text;
  active_generation bigint;
BEGIN
  IF p_outcome NOT IN ('sent', 'retry_wait', 'failed')
     OR ((p_outcome = 'sent') <> (
       p_transport_ref IS NOT NULL AND btrim(p_transport_ref) <> '' AND
       p_transport_epoch IS NOT NULL AND btrim(p_transport_epoch) <> '' AND
       p_transport_generation IS NOT NULL
     ))
     OR (p_outcome = 'sent' AND (
       p_transport_epoch IS DISTINCT FROM p_current_transport_epoch OR
       p_transport_generation IS DISTINCT FROM p_current_transport_generation
     ))
     OR ((p_outcome = 'retry_wait') <> (p_next_retry_at IS NOT NULL))
     OR (p_outcome = 'sent' AND p_error IS NOT NULL)
     OR (p_outcome <> 'sent' AND p_error IS NULL)
     OR (p_outcome <> 'sent' AND (
       p_transport_ref IS NOT NULL OR
       p_transport_epoch IS NOT NULL OR
       p_transport_generation IS NOT NULL
     )) THEN
    RAISE EXCEPTION 'invalid outbox acknowledgement outcome';
  END IF;
  SELECT active.active_epoch, active.active_generation
    INTO active_epoch, active_generation
    FROM skill_registry.eventing_transport_epochs active
   WHERE active.transport_name = 'redis_stream'
   FOR UPDATE;
  IF active_epoch IS DISTINCT FROM p_current_transport_epoch
     OR active_generation IS DISTINCT FROM p_current_transport_generation THEN
    RAISE EXCEPTION 'stale active transport generation';
  END IF;
  UPDATE skill_registry.eventing_outbox
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
     AND claim_token = p_claim_token
     AND status = 'dispatching'
   RETURNING * INTO current_event;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'stale outbox claim token';
  END IF;
  IF p_outcome = 'failed' THEN
    INSERT INTO skill_registry.eventing_dlq(
      id, source_event_id, event_type, payload, last_error, failed_at, resolved_at
    ) VALUES (
      'dlq:' || p_outbox_id, p_outbox_id, current_event.event_type,
      current_event.payload, p_error, p_now, NULL
    );
  END IF;
  RETURN jsonb_build_object('outbox_id', p_outbox_id, 'status', p_outcome);
END;
$$;
CREATE FUNCTION skill_registry.consume_eventing_inbox_v1(
  p_event jsonb,
  p_idempotency_key text,
  p_payload_hash text,
  p_semantic_hash text,
  p_scope_fingerprint text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = skill_registry, pg_temp
AS $$
DECLARE
  existing_hash text;
  applied_inbox_id text;
  projection_id text;
BEGIN
  projection_id := (p_event->>'producer') || ':' || p_scope_fingerprint || ':' || p_idempotency_key;
  INSERT INTO skill_registry.eventing_inbox(
    id, source, event_id, scope_fingerprint, idempotency_key, payload_hash,
    semantic_hash, processed_at, created_at
  ) VALUES (
    'inbox:' || projection_id,
    p_event->>'producer', p_event->>'event_id', p_scope_fingerprint,
    p_idempotency_key, p_payload_hash, p_semantic_hash,
    clock_timestamp(), clock_timestamp()
  ) ON CONFLICT (source, scope_fingerprint, idempotency_key) DO NOTHING
  RETURNING id INTO applied_inbox_id;
  IF FOUND THEN
    INSERT INTO skill_registry.eventing_projection(
      id, source, scope_fingerprint, idempotency_key, semantic_hash,
      applied_count, updated_at
    ) VALUES (
      projection_id, p_event->>'producer', p_scope_fingerprint,
      p_idempotency_key, p_semantic_hash, 1, clock_timestamp()
    )
    ON CONFLICT (id) DO UPDATE
      SET semantic_hash = EXCLUDED.semantic_hash,
          applied_count = skill_registry.eventing_projection.applied_count + 1,
          updated_at = EXCLUDED.updated_at;
    INSERT INTO skill_registry.eventing_audit(
      id, inbox_id, event_id, semantic_hash, created_at
    ) VALUES (
      'audit:' || projection_id, applied_inbox_id, p_event->>'event_id',
      p_semantic_hash, clock_timestamp()
    );
    RETURN jsonb_build_object('status', 'processed');
  END IF;
  SELECT semantic_hash INTO existing_hash
    FROM skill_registry.eventing_inbox
   WHERE source = p_event->>'producer'
     AND scope_fingerprint = p_scope_fingerprint
     AND idempotency_key = p_idempotency_key
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'inbox idempotency scope fingerprint missing';
  END IF;
  IF existing_hash <> p_semantic_hash THEN
    RAISE EXCEPTION 'inbox idempotency semantic hash conflict';
  END IF;
  RETURN jsonb_build_object('status', 'replayed');
END;
$$;
CREATE FUNCTION skill_registry.record_eventing_consumer_dlq_v1(
  p_delivery_id text,
  p_delivery_ref text,
  p_consumer_service text,
  p_failure_code text,
  p_failure_message text,
  p_raw_fields jsonb,
  p_envelope jsonb,
  p_now timestamptz
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = skill_registry, pg_temp
AS $$
DECLARE inserted_id text;
BEGIN
  IF p_delivery_id IS NULL OR btrim(p_delivery_id) = ''
     OR p_delivery_ref IS NULL OR btrim(p_delivery_ref) = ''
     OR p_consumer_service IS NULL OR btrim(p_consumer_service) = ''
     OR p_failure_code IS NULL OR btrim(p_failure_code) = '' THEN
    RAISE EXCEPTION 'invalid durable consumer DLQ identity';
  END IF;
  INSERT INTO skill_registry.eventing_dlq(
    id, source_event_id, event_type, payload, last_error, failed_at, resolved_at
  ) VALUES (
    'consumer-dlq:' || p_consumer_service || ':' || p_delivery_ref,
    p_delivery_id,
    'consumer.delivery.invalid',
    jsonb_build_object('raw_fields', p_raw_fields, 'envelope', p_envelope),
    jsonb_build_object('code', p_failure_code, 'message', p_failure_message),
    p_now,
    NULL
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO inserted_id;
  INSERT INTO skill_registry.eventing_audit(
    id, inbox_id, event_id, semantic_hash, created_at
  ) VALUES (
    'audit:consumer-dlq:' || p_consumer_service || ':' || p_delivery_ref,
    'consumer-dlq:' || p_consumer_service || ':' || p_delivery_ref,
    p_delivery_id,
    p_failure_code,
    p_now
  ) ON CONFLICT (id) DO NOTHING;
  RETURN jsonb_build_object(
    'status', CASE WHEN inserted_id IS NULL THEN 'replayed' ELSE 'recorded' END
  );
END;
$$;
CREATE FUNCTION skill_registry.activate_eventing_transport_epoch_v1(
  p_transport_name text,
  p_expected_generation bigint,
  p_next_epoch text,
  p_next_generation bigint,
  p_now timestamptz
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = skill_registry, pg_temp
AS $$
DECLARE updated_name text;
BEGIN
  IF p_transport_name IS NULL OR btrim(p_transport_name) = ''
     OR p_next_epoch IS NULL OR btrim(p_next_epoch) = ''
     OR p_next_generation <= p_expected_generation THEN
    RAISE EXCEPTION 'invalid active transport epoch transition';
  END IF;
  UPDATE skill_registry.eventing_transport_epochs
     SET active_epoch = p_next_epoch,
         active_generation = p_next_generation,
         activated_at = p_now
   WHERE transport_name = p_transport_name
     AND active_generation = p_expected_generation
   RETURNING transport_name INTO updated_name;
  IF updated_name IS NULL THEN
    RAISE EXCEPTION 'stale active transport generation';
  END IF;
  RETURN jsonb_build_object(
    'transport_name', updated_name,
    'active_epoch', p_next_epoch,
    'active_generation', p_next_generation
  );
END;
$$;
CREATE FUNCTION skill_registry.claim_sent_eventing_outbox_redrive_v1(
  p_worker_id text,
  p_limit integer,
  p_lease_seconds integer,
  p_now timestamptz,
  p_current_transport_epoch text,
  p_current_transport_generation bigint
) RETURNS SETOF jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = skill_registry, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT outbox.id
      FROM skill_registry.eventing_outbox outbox
      JOIN skill_registry.eventing_transport_epochs active
        ON active.transport_name = 'redis_stream'
     WHERE outbox.status = 'sent'
       AND active.active_epoch = p_current_transport_epoch
       AND active.active_generation = p_current_transport_generation
       AND (
         outbox.transport_epoch IS DISTINCT FROM active.active_epoch OR
         outbox.transport_generation IS DISTINCT FROM active.active_generation
       )
       AND (
         outbox.redrive_locked_until IS NULL OR
         outbox.redrive_locked_until <= p_now
       )
     ORDER BY outbox.sent_at, outbox.id
     FOR UPDATE SKIP LOCKED
     LIMIT p_limit
  ), claimed AS (
    UPDATE skill_registry.eventing_outbox outbox
       SET redrive_claimed_by = p_worker_id,
           redrive_claim_generation = outbox.redrive_claim_generation + 1,
          redrive_claim_token = p_worker_id || ':' || outbox.id || ':' ||
             (outbox.redrive_claim_generation + 1)::text || ':' ||
             p_current_transport_epoch || ':' ||
             p_current_transport_generation::text,
           redrive_locked_until = p_now + make_interval(secs => p_lease_seconds),
           updated_at = p_now
      FROM candidates
     WHERE outbox.id = candidates.id
     RETURNING outbox.*
  )
  SELECT jsonb_build_object(
    'outbox_id', id,
    'claim_token', redrive_claim_token,
    'attempt_count', attempt_count,
    'target', target,
    'payload_hash', payload_hash,
    'sent_at', sent_at,
    'transport_ref', transport_ref,
    'transport_epoch', transport_epoch,
    'transport_generation', transport_generation,
    'active_transport_generation', p_current_transport_generation,
    'envelope', jsonb_build_object(
      'event_id', id,
      'event_type', event_type,
      'schema_version', schema_version,
      'producer', producer,
      'occurred_at', to_char(occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'idempotency_key', idempotency_key,
      'trace_id', trace_id,
      'payload', payload
    )
  ) FROM claimed;
END;
$$;
CREATE FUNCTION skill_registry.ack_sent_eventing_outbox_redrive_v1(
  p_outbox_id text,
  p_claim_token text,
  p_previous_transport_epoch text,
  p_previous_transport_generation bigint,
  p_transport_ref text,
  p_transport_epoch text,
  p_current_transport_generation bigint,
  p_now timestamptz
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = skill_registry, pg_temp
AS $$
DECLARE
  updated_id text;
  active_epoch text;
  active_generation bigint;
BEGIN
  IF p_transport_ref IS NULL OR btrim(p_transport_ref) = ''
     OR p_transport_epoch IS NULL OR btrim(p_transport_epoch) = ''
     OR (
       p_transport_epoch = p_previous_transport_epoch AND
       p_previous_transport_generation IS NOT DISTINCT FROM
         p_current_transport_generation
     ) THEN
    RAISE EXCEPTION 'invalid sent outbox redrive receipt';
  END IF;
  SELECT active.active_epoch, active.active_generation
    INTO active_epoch, active_generation
    FROM skill_registry.eventing_transport_epochs active
   WHERE active.transport_name = 'redis_stream'
   FOR UPDATE;
  IF active_epoch IS DISTINCT FROM p_transport_epoch
     OR active_generation IS DISTINCT FROM p_current_transport_generation THEN
    RAISE EXCEPTION 'stale active transport generation';
  END IF;
  UPDATE skill_registry.eventing_outbox
     SET transport_ref = p_transport_ref,
         transport_epoch = p_transport_epoch,
         transport_generation = p_current_transport_generation,
         redrive_claimed_by = NULL,
         redrive_claim_token = NULL,
         redrive_locked_until = NULL,
         updated_at = p_now
   WHERE id = p_outbox_id
     AND status = 'sent'
     AND redrive_claim_token = p_claim_token
     AND transport_epoch IS NOT DISTINCT FROM p_previous_transport_epoch
     AND transport_generation IS NOT DISTINCT FROM p_previous_transport_generation
   RETURNING id INTO updated_id;
  IF updated_id IS NULL THEN
    RAISE EXCEPTION 'stale sent outbox redrive claim';
  END IF;
  RETURN jsonb_build_object('outbox_id', updated_id, 'status', 'sent');
END;
$$;
RESET ROLE;
REVOKE ALL ON ALL TABLES IN SCHEMA skill_registry FROM PUBLIC, anon, authenticated, pai_skill_registry_app, pai_skill_registry_eventing_test;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA skill_registry FROM PUBLIC, anon, authenticated, pai_skill_registry_app, pai_skill_registry_eventing_test;
GRANT SELECT (${EVENTING_CONTRACT_INPUT.table_permissions[0]!.select_columns.join(", ")}) ON skill_registry.eventing_outbox TO pai_skill_registry_app;
GRANT SELECT (${EVENTING_CONTRACT_INPUT.table_permissions[1]!.select_columns.join(", ")}) ON skill_registry.eventing_transport_epochs TO pai_skill_registry_app;
GRANT SELECT (${EVENTING_CONTRACT_INPUT.table_permissions[2]!.select_columns.join(", ")}) ON skill_registry.eventing_inbox TO pai_skill_registry_app;
GRANT SELECT (${EVENTING_CONTRACT_INPUT.table_permissions[3]!.select_columns.join(", ")}) ON skill_registry.eventing_dlq TO pai_skill_registry_app;
GRANT SELECT (${EVENTING_CONTRACT_INPUT.table_permissions[4]!.select_columns.join(", ")}) ON skill_registry.eventing_projection TO pai_skill_registry_app;
GRANT SELECT (${EVENTING_CONTRACT_INPUT.table_permissions[5]!.select_columns.join(", ")}) ON skill_registry.eventing_audit TO pai_skill_registry_app;
GRANT EXECUTE ON FUNCTION skill_registry.enqueue_eventing_outbox_v1(jsonb, text, text) TO pai_skill_registry_app;
GRANT EXECUTE ON FUNCTION skill_registry.claim_eventing_outbox_v1(text, integer, integer, timestamptz, text, bigint) TO pai_skill_registry_app;
GRANT EXECUTE ON FUNCTION skill_registry.ack_eventing_outbox_v1(text, text, text, timestamptz, jsonb, text, text, bigint, text, bigint, timestamptz) TO pai_skill_registry_app;
GRANT EXECUTE ON FUNCTION skill_registry.consume_eventing_inbox_v1(jsonb, text, text, text, text) TO pai_skill_registry_app;
GRANT EXECUTE ON FUNCTION skill_registry.record_eventing_consumer_dlq_v1(text, text, text, text, text, jsonb, jsonb, timestamptz) TO pai_skill_registry_app;
GRANT EXECUTE ON FUNCTION skill_registry.activate_eventing_transport_epoch_v1(text, bigint, text, bigint, timestamptz) TO pai_skill_registry_app;
GRANT EXECUTE ON FUNCTION skill_registry.claim_sent_eventing_outbox_redrive_v1(text, integer, integer, timestamptz, text, bigint) TO pai_skill_registry_app;
GRANT EXECUTE ON FUNCTION skill_registry.ack_sent_eventing_outbox_redrive_v1(text, text, text, bigint, text, text, bigint, timestamptz) TO pai_skill_registry_app;
`;

function generatedWriterBody(functionName: string): string {
  const functionStart = setupSql.indexOf(
    `CREATE FUNCTION skill_registry.${functionName}(`,
  );
  const bodyMarker = setupSql.indexOf("AS $$", functionStart);
  const bodyStart = setupSql.indexOf("\n", bodyMarker) + 1;
  const bodyEnd = setupSql.indexOf("\n$$;", bodyStart);
  if (functionStart < 0 || bodyMarker < 0 || bodyStart <= 0 || bodyEnd < 0) {
    throw new Error(`missing generated fixture writer body: ${functionName}`);
  }
  return setupSql.slice(bodyStart, bodyEnd);
}

const EVENTING_CONTRACT = defineOwnerRepositoryContractV1({
  ...EVENTING_CONTRACT_INPUT,
  writer_artifacts: EVENTING_CONTRACT_INPUT.function_signatures.map(
    (signature) =>
      ownerWriterArtifactV1({
        signature,
        generator_source:
          "pai-infra/supabase/generated/permissions/0450_skill_registry.sql",
        function_body: generatedWriterBody(signature.function_name),
      }),
  ),
});

const describePostgres = databaseUrl === undefined ? describe.skip : describe;

describePostgres("PostgreSQL durable outbox recovery", () => {
  const admin = databaseUrl === undefined
    ? undefined
    : new Pool({ connectionString: databaseUrl });

  afterAll(async () => {
    await admin?.end();
  });

  async function reset(): Promise<void> {
    if (admin === undefined) throw new Error("PAI_TEST_DATABASE_URL is required");
    await admin.query(setupSql);
  }

  function runtimeUrl(): string {
    if (databaseUrl === undefined) throw new Error("PAI_TEST_DATABASE_URL is required");
    const url = new URL(databaseUrl);
    url.username = "pai_skill_registry_eventing_test";
    url.password = "eventing-runtime-test";
    return url.toString();
  }

  function postgresOutboxStore(
    composition: Awaited<ReturnType<typeof openVerifiedOwnerPostgresCompositionV1>>,
  ): DurableOutboxStorePortV1 {
    return {
      async claim(request) {
        return composition.unit_of_work.withTransaction(
          {
            operation: "claim_eventing_outbox",
            idempotency_key:
              `${request.worker_id}:${request.now}:` +
              `${request.current_transport_epoch}:` +
              `${request.current_transport_generation}`,
            trace_id: "trace_claim_eventing_outbox",
            isolation: "read_committed",
            retry: "none",
          },
          async (transaction, repositories) =>
            repositories.owner.executeWriter<
              readonly ClaimedOutboxRecordV1[],
              "claim_eventing_outbox_v1"
            >(transaction, {
              writer: "claim_eventing_outbox_v1",
              arguments: {
                p_worker_id: request.worker_id,
                p_limit: request.limit,
                p_lease_seconds: request.lease_seconds,
                p_now: request.now,
                p_current_transport_epoch: request.current_transport_epoch,
                p_current_transport_generation:
                  String(request.current_transport_generation),
              },
              expected_rows: "zero_or_more",
            }),
        );
      },
      async acknowledge(request) {
        await composition.unit_of_work.withTransaction(
          {
            operation: "ack_eventing_outbox",
            idempotency_key: `${request.outbox_id}:${request.claim_token}`,
            trace_id: "trace_ack_eventing_outbox",
            isolation: "read_committed",
            retry: "none",
          },
          async (transaction, repositories) =>
            repositories.owner.executeWriter<
              Readonly<{ outbox_id: string; status: string }>,
              "ack_eventing_outbox_v1"
            >(transaction, {
              writer: "ack_eventing_outbox_v1",
              arguments: {
                p_outbox_id: request.outbox_id,
                p_claim_token: request.claim_token,
                p_outcome: request.outcome,
                p_next_retry_at: request.next_retry_at,
                p_error: request.error,
                p_transport_ref: request.transport_ref,
                p_transport_epoch: request.transport_epoch,
                p_transport_generation:
                  request.transport_generation === null
                    ? null
                    : String(request.transport_generation),
                p_current_transport_epoch: request.current_transport_epoch,
                p_current_transport_generation:
                  String(request.current_transport_generation),
                p_now: request.now,
              },
              expected_rows: 1,
            }),
        );
      },
    };
  }

  async function activateTransportEpoch(
    composition: Awaited<ReturnType<typeof openVerifiedOwnerPostgresCompositionV1>>,
    request: Readonly<{
      expected_generation: number;
      next_epoch: string;
      next_generation: number;
      now: string;
    }>,
  ): Promise<void> {
    await composition.unit_of_work.withTransaction(
      {
        operation: "activate_transport_epoch",
        idempotency_key:
          `redis_stream:${request.expected_generation}:` +
          `${request.next_epoch}:${request.next_generation}`,
        trace_id: "trace_activate_transport_epoch",
        isolation: "read_committed",
        retry: "none",
      },
      async (transaction, repositories) =>
        repositories.owner.executeWriter(transaction, {
          writer: "activate_eventing_transport_epoch_v1",
          arguments: {
            p_transport_name: "redis_stream",
            p_expected_generation: String(request.expected_generation),
            p_next_epoch: request.next_epoch,
            p_next_generation: String(request.next_generation),
            p_now: request.now,
          },
          expected_rows: 1,
        }),
    );
  }

  it("replays a committed outbox after process restart and dedupes the inbox", async () => {
    await reset();
    const envelope = {
      event_id: "evt_restart_001",
      event_type: "skill.version.published",
      schema_version: "skill_registry_event.v1",
      producer: "skill_registry",
      occurred_at: "2026-07-21T05:00:00.000Z",
      idempotency_key: "skill_version_001:published",
      trace_id: "trace_restart_001",
      payload: {
        scope_kind: "bot",
        workspace_id: "workspace_001",
        bot_id: "bot_001",
        owner_agent_id: "owner_agent_001",
        deployment_environment: "dev",
        release_channel: "stable",
        skill_version_id: "skill_version_001",
      },
    } as const;
    const payloadHash = canonicalPayloadHashV1(envelope.payload);

    const firstProcess = await openVerifiedOwnerPostgresCompositionV1(
      EVENTING_CONTRACT,
      runtimeUrl(),
    );
    await firstProcess.unit_of_work.withTransaction(
      {
        operation: "publish_skill_version",
        idempotency_key: envelope.idempotency_key,
        trace_id: envelope.trace_id,
        isolation: "read_committed",
        retry: "none",
      },
      async (transaction, repositories) =>
        repositories.owner.executeWriter(transaction, {
          writer: "enqueue_eventing_outbox_v1",
          arguments: {
            p_event: envelope,
            p_idempotency_key: envelope.idempotency_key,
            p_payload_hash: payloadHash,
          },
          expected_rows: 1,
        }),
    );
    await firstProcess.close();

    const secondProcess = await openVerifiedOwnerPostgresCompositionV1(
      EVENTING_CONTRACT,
      runtimeUrl(),
    );
    const published: string[] = [];
    const transport: DurableEventTransportPortV1 = {
      async publish({ envelope: event }) {
        published.push(event.event_id);
        return {
          transport_ref: "redis_stream:1-0",
          transport_epoch: "epoch_1",
          transport_generation: 1,
        };
      },
    };
    const dispatcher = createDurableOutboxDispatcherV1(
      postgresOutboxStore(secondProcess),
      transport,
      {
        owner_service: "skill_registry",
        worker_id: "eventing_worker_001",
        batch_size: 100,
        lease_seconds: 5,
        max_attempts: 3,
        retry_base_delay_ms: 250,
        retry_max_delay_ms: 15_000,
        retry_jitter: "full",
        current_transport_epoch: "epoch_1",
        current_transport_generation: 1,
      },
      {
        now: () => new Date("2026-07-21T05:00:01.000Z"),
        random: () => 0.5,
      },
    );
    await expect(dispatcher.dispatchBatch()).resolves.toEqual({
      claimed: 1,
      sent: 1,
      retry_wait: 0,
      failed: 0,
    });
    expect(published).toEqual([envelope.event_id]);

    const consume = async (eventPayload: Readonly<Record<string, unknown>>) =>
      secondProcess.unit_of_work.withTransaction(
        {
          operation: "consume_skill_event",
          idempotency_key: envelope.idempotency_key,
          trace_id: envelope.trace_id,
          isolation: "read_committed",
          retry: "none",
        },
        async (transaction, repositories) =>
          repositories.owner.executeWriter<
            Readonly<{ status: "processed" | "replayed" }>,
            "consume_eventing_inbox_v1"
          >(transaction, {
            writer: "consume_eventing_inbox_v1",
            arguments: {
              p_event: { ...envelope, payload: eventPayload },
              p_idempotency_key: envelope.idempotency_key,
              p_payload_hash: canonicalPayloadHashV1(eventPayload),
              p_semantic_hash: canonicalDurableEventEnvelopeSemanticHashV1({
                ...envelope,
                payload: eventPayload,
              }),
              p_scope_fingerprint: durableEventScopeFingerprintV1({
                ...envelope,
                payload: eventPayload,
              }),
            },
            expected_rows: 1,
          }),
      );
    await expect(consume(envelope.payload)).resolves.toEqual({ status: "processed" });
    await expect(consume(envelope.payload)).resolves.toEqual({ status: "replayed" });
    await expect(
      consume({ ...envelope.payload, skill_version_id: "skill_version_drift" }),
    ).rejects.toThrow(/semantic hash conflict/);

    if (admin === undefined) throw new Error("PAI_TEST_DATABASE_URL is required");
    const projection = await admin.query<{
      applied_count: number;
      semantic_hash: string;
    }>(
      "SELECT applied_count, semantic_hash FROM skill_registry.eventing_projection WHERE id = $1",
      [
        `${envelope.producer}:${durableEventScopeFingerprintV1(envelope)}:${envelope.idempotency_key}`,
      ],
    );
    expect(projection.rows).toEqual([
      {
        applied_count: 1,
        semantic_hash: canonicalDurableEventEnvelopeSemanticHashV1(envelope),
      },
    ]);
    const audit = await admin.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM skill_registry.eventing_audit",
    );
    expect(audit.rows).toEqual([{ count: "1" }]);
    const persisted = await admin.query<{
      status: string;
      attempt_count: number;
      transport_ref: string;
      transport_epoch: string;
      transport_generation: string;
    }>(
      `SELECT status, attempt_count, transport_ref, transport_epoch,
              transport_generation::text AS transport_generation
         FROM skill_registry.eventing_outbox
        WHERE id = $1`,
      [envelope.event_id],
    );
    expect(persisted.rows).toEqual([{
      status: "sent",
      attempt_count: 1,
      transport_ref: "redis_stream:1-0",
      transport_epoch: "epoch_1",
      transport_generation: "1",
    }]);
    await secondProcess.close();
  });

  it("does not let an old normal dispatcher claim a pending row after transport cutover", async () => {
    await reset();
    const composition = await openVerifiedOwnerPostgresCompositionV1(
      EVENTING_CONTRACT,
      runtimeUrl(),
    );
    try {
      const envelope = {
        event_id: "evt_cutover_claim_001",
        event_type: "skill.version.published",
        schema_version: "skill_registry_event.v1",
        producer: "skill_registry",
        occurred_at: "2026-07-21T05:00:00.000Z",
        idempotency_key: "skill_version_cutover_claim_001:published",
        trace_id: "trace_cutover_claim_001",
        payload: {
          scope_kind: "bot",
          workspace_id: "workspace_001",
          bot_id: "bot_001",
          owner_agent_id: "owner_agent_001",
          deployment_environment: "dev",
          release_channel: "stable",
          skill_version_id: "skill_version_cutover_claim_001",
        },
      } as const;
      await composition.unit_of_work.withTransaction(
        {
          operation: "enqueue_cutover_fixture",
          idempotency_key: envelope.idempotency_key,
          trace_id: envelope.trace_id,
          isolation: "read_committed",
          retry: "none",
        },
        async (transaction, repositories) =>
          repositories.owner.executeWriter(transaction, {
            writer: "enqueue_eventing_outbox_v1",
            arguments: {
              p_event: envelope,
              p_idempotency_key: envelope.idempotency_key,
              p_payload_hash: canonicalPayloadHashV1(envelope.payload),
            },
            expected_rows: 1,
          }),
      );
      await activateTransportEpoch(composition, {
        expected_generation: 1,
        next_epoch: "epoch_2",
        next_generation: 2,
        now: "2026-07-21T05:00:00.500Z",
      });
      const published: string[] = [];
      const transport: DurableEventTransportPortV1 = {
        async publish(request) {
          published.push(
            `${request.envelope.event_id}:${request.current_transport_epoch}:` +
              `${request.current_transport_generation}`,
          );
          return {
            transport_ref: `redis_stream:${published.length}-0`,
            transport_epoch: request.current_transport_epoch,
            transport_generation: request.current_transport_generation,
          };
        },
      };
      const makeDispatcher = (epoch: string, generation: number) =>
        createDurableOutboxDispatcherV1(
          postgresOutboxStore(composition),
          transport,
          {
            owner_service: "skill_registry",
            worker_id: `eventing_worker_${generation}`,
            batch_size: 100,
            lease_seconds: 5,
            max_attempts: 3,
            retry_base_delay_ms: 250,
            retry_max_delay_ms: 15_000,
            retry_jitter: "none",
            current_transport_epoch: epoch,
            current_transport_generation: generation,
          },
          {
            now: () => new Date("2026-07-21T05:00:01.000Z"),
            random: () => 0.5,
          },
        );

      await expect(makeDispatcher("epoch_1", 1).dispatchBatch()).resolves.toEqual({
        claimed: 0,
        sent: 0,
        retry_wait: 0,
        failed: 0,
      });
      expect(published).toEqual([]);

      await expect(makeDispatcher("epoch_2", 2).dispatchBatch()).resolves.toEqual({
        claimed: 1,
        sent: 1,
        retry_wait: 0,
        failed: 0,
      });
      expect(published).toEqual(["evt_cutover_claim_001:epoch_2:2"]);
      if (admin === undefined) throw new Error("PAI_TEST_DATABASE_URL is required");
      const persisted = await admin.query<{
        status: string;
        transport_epoch: string;
        transport_generation: string;
      }>(
        `SELECT status, transport_epoch,
                transport_generation::text AS transport_generation
           FROM skill_registry.eventing_outbox
          WHERE id = $1`,
        [envelope.event_id],
      );
      expect(persisted.rows).toEqual([{
        status: "sent",
        transport_epoch: "epoch_2",
        transport_generation: "2",
      }]);
      const redriveCandidates = await composition.unit_of_work.withTransaction(
        {
          operation: "claim_current_generation_redrive_probe",
          idempotency_key: "claim_current_generation_redrive_probe",
          trace_id: "trace_current_generation_redrive_probe",
          isolation: "read_committed",
          retry: "none",
        },
        async (transaction, repositories) =>
          repositories.owner.executeWriter<
            readonly ClaimedSentOutboxRecordV1[],
            "claim_sent_eventing_outbox_redrive_v1"
          >(transaction, {
            writer: "claim_sent_eventing_outbox_redrive_v1",
            arguments: {
              p_worker_id: "redrive_probe",
              p_limit: 10,
              p_lease_seconds: 30,
              p_now: "2026-07-21T05:00:02.000Z",
              p_current_transport_epoch: "epoch_2",
              p_current_transport_generation: "2",
            },
            expected_rows: "zero_or_more",
          }),
      );
      expect(redriveCandidates).toEqual([]);
    } finally {
      await composition.close();
    }
  });

  itPostgresRedis("redrives retained sent rows after real Redis loss and dedupes the PostgreSQL inbox", async () => {
    await reset();
    const composition = await openVerifiedOwnerPostgresCompositionV1(
      EVENTING_CONTRACT,
      runtimeUrl(),
    );
    if (redisUrl === undefined) throw new Error("PAI_TEST_REDIS_URL is required");
    const reader = createClient({ url: redisUrl });
    reader.on("error", () => undefined);
    await reader.connect();
    let oldRedis:
      | Awaited<ReturnType<typeof openVerifiedRedisStreamCompositionV1>>
      | undefined;
    let newRedis:
      | Awaited<ReturnType<typeof openVerifiedRedisStreamCompositionV1>>
      | undefined;
    let oldPhysicalStream: string | undefined;
    let newPhysicalStream: string | undefined;
    try {
    const envelope = {
      event_id: "evt_epoch_redrive_001",
      event_type: "skill.version.published",
      schema_version: "skill_registry_event.v1",
      producer: "skill_registry",
      occurred_at: "2026-07-21T05:00:00.000Z",
      idempotency_key: "skill_version_redrive_001:published",
      trace_id: "trace_epoch_redrive_001",
      payload: {
        scope_kind: "bot",
        workspace_id: "workspace_001",
        bot_id: "bot_001",
        owner_agent_id: "owner_agent_001",
        deployment_environment: "dev",
        release_channel: "stable",
        skill_version_id: "skill_version_redrive_001",
      },
    } as const;
    const oldNamespace = createRedisNamespaceV1({
      deployment_environment: "dev",
      release_channel: "stable",
      owner_service: "skill_registry",
      stream_epoch: "epoch_1",
      stream_generation: 1,
    });
    const newNamespace = createRedisNamespaceV1({
      deployment_environment: "dev",
      release_channel: "stable",
      owner_service: "skill_registry",
      stream_epoch: "epoch_new",
      stream_generation: 2,
    });
    const target = "trigger_processor.runtime_event_append";
    const logicalStream = "stream:skill_events";
    oldPhysicalStream = namespacedRedisKeyV1(oldNamespace, logicalStream);
    newPhysicalStream = namespacedRedisKeyV1(newNamespace, logicalStream);
    await reader.del(oldPhysicalStream, newPhysicalStream);
    oldRedis = await openVerifiedRedisStreamCompositionV1({
      url: redisUrl,
      namespace: oldNamespace,
      routes: { [target]: logicalStream },
    });
    newRedis = await openVerifiedRedisStreamCompositionV1({
      url: redisUrl,
      namespace: newNamespace,
      routes: { [target]: logicalStream },
    });
    await composition.unit_of_work.withTransaction(
      {
        operation: "enqueue_redrive_fixture",
        idempotency_key: envelope.idempotency_key,
        trace_id: envelope.trace_id,
        isolation: "read_committed",
        retry: "none",
      },
      async (transaction, repositories) =>
        repositories.owner.executeWriter(transaction, {
          writer: "enqueue_eventing_outbox_v1",
          arguments: {
            p_event: envelope,
            p_idempotency_key: envelope.idempotency_key,
            p_payload_hash: canonicalPayloadHashV1(envelope.payload),
          },
          expected_rows: 1,
        }),
    );
    const dispatcher = createDurableOutboxDispatcherV1(
      postgresOutboxStore(composition),
      oldRedis.transport,
      {
        owner_service: "skill_registry",
        worker_id: "publisher_old",
        batch_size: 10,
        lease_seconds: 30,
        max_attempts: 3,
        retry_base_delay_ms: 100,
        retry_max_delay_ms: 1_000,
        retry_jitter: "none",
        current_transport_epoch: "epoch_1",
        current_transport_generation: 1,
      },
      { now: () => new Date("2026-07-21T05:00:01.000Z") },
    );
    await expect(dispatcher.dispatchBatch()).resolves.toMatchObject({ sent: 1 });

    const redisCommandClient = {
      async sendCommand(args: readonly string[]): Promise<unknown> {
        return reader.sendCommand([...args]);
      },
    };
    const oldConsumer = createRedisStreamConsumerGroupPortV1(
      redisCommandClient,
      {
        stream: oldPhysicalStream,
        group: "trigger_processor",
        consumer: "old_worker",
        namespace: oldNamespace,
      },
    );
    await oldConsumer.ensureGroup();

    const inbox = createDurableInboxConsumerV1(
      {
        async apply(request) {
          return composition.unit_of_work.withTransaction(
            {
              operation: "consume_redrive_fixture",
              idempotency_key: request.idempotency_key,
              trace_id: request.envelope.trace_id,
              isolation: "read_committed",
              retry: "none",
            },
            async (transaction, repositories) =>
              repositories.owner.executeWriter<
                Readonly<{ status: "processed" | "replayed" }>,
                "consume_eventing_inbox_v1"
              >(transaction, {
                writer: "consume_eventing_inbox_v1",
                arguments: {
                  p_event: request.envelope,
                  p_idempotency_key: request.idempotency_key,
                  p_payload_hash: request.payload_hash,
                  p_semantic_hash: request.semantic_hash,
                  p_scope_fingerprint: request.scope_fingerprint,
                },
                expected_rows: 1,
              }),
          );
        },
      },
      { consumer_service: "trigger_processor" },
    );
    const oldDeliveries = await oldConsumer.readNew({ count: 10, block_ms: 0 });
    expect(oldDeliveries).toHaveLength(1);
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
    const reclaimed = await oldConsumer.reclaimPending({
      min_idle_ms: 1,
      count: 10,
      start_id: "0-0",
    });
    expect(reclaimed.next_start_id).toBe("0-0");
    expect(reclaimed.deleted_ids).toEqual([]);
    expect(reclaimed.deliveries).toHaveLength(1);
    if (reclaimed.deliveries[0]?.kind !== "event") {
      throw new Error("expected the original Redis delivery");
    }
    await expect(inbox.consume(reclaimed.deliveries[0].envelope)).resolves.toEqual({
      status: "processed",
    });
    await expect(
      oldConsumer.acknowledge({
        delivery_ids: [reclaimed.deliveries[0].delivery_id],
      }),
    ).resolves.toEqual({ acknowledged: 1 });

    await reader.del(oldPhysicalStream);
    await activateTransportEpoch(composition, {
      expected_generation: 1,
      next_epoch: "epoch_new",
      next_generation: 2,
      now: "2026-07-22T03:59:59.000Z",
    });
    const postgresRedriveStore: DurableSentOutboxRedriveStorePortV1 = {
      async claimSentForRedrive(request) {
        return composition.unit_of_work.withTransaction(
          {
            operation: "claim_sent_redrive",
            idempotency_key:
              `${request.worker_id}:${request.current_transport_epoch}:` +
              `${request.current_transport_generation}`,
            trace_id: "trace_claim_sent_redrive",
            isolation: "read_committed",
            retry: "none",
          },
          async (transaction, repositories) =>
            repositories.owner.executeWriter<
              readonly ClaimedSentOutboxRecordV1[],
              "claim_sent_eventing_outbox_redrive_v1"
            >(transaction, {
              writer: "claim_sent_eventing_outbox_redrive_v1",
              arguments: {
                p_worker_id: request.worker_id,
                p_limit: request.limit,
                p_lease_seconds: request.lease_seconds,
                p_now: request.now,
                p_current_transport_epoch: request.current_transport_epoch,
                p_current_transport_generation:
                  String(request.current_transport_generation),
              },
              expected_rows: "zero_or_more",
            }),
        );
      },
      async acknowledgeSentRedrive(request) {
        await composition.unit_of_work.withTransaction(
          {
            operation: "ack_sent_redrive",
            idempotency_key: request.outbox_id,
            trace_id: "trace_ack_sent_redrive",
            isolation: "read_committed",
            retry: "none",
          },
          async (transaction, repositories) =>
            repositories.owner.executeWriter(transaction, {
              writer: "ack_sent_eventing_outbox_redrive_v1",
              arguments: {
                p_outbox_id: request.outbox_id,
                p_claim_token: request.claim_token,
                p_previous_transport_epoch: request.previous_transport_epoch,
                p_previous_transport_generation:
                  request.previous_transport_generation === null
                    ? null
                    : String(request.previous_transport_generation),
                p_transport_ref: request.transport_ref,
                p_transport_epoch: request.transport_epoch,
                p_current_transport_generation:
                  String(request.current_transport_generation),
                p_now: request.now,
              },
              expected_rows: 1,
            }),
        );
      },
    };
    const redriveClaimTokens: string[] = [];
    let injectCommitDisconnect = true;
    const redriveStore: DurableSentOutboxRedriveStorePortV1 = {
      claimSentForRedrive: (request) =>
        postgresRedriveStore.claimSentForRedrive(request),
      async acknowledgeSentRedrive(request) {
        redriveClaimTokens.push(request.claim_token);
        if (injectCommitDisconnect) {
          injectCommitDisconnect = false;
          throw new Error("simulated redrive acknowledgement disconnect");
        }
        await postgresRedriveStore.acknowledgeSentRedrive(request);
      },
    };
    const redriver = (at: string) => createDurableSentOutboxRedriverV1(
      redriveStore,
      newRedis.transport,
      {
        owner_service: "skill_registry",
        worker_id: "redrive_worker",
        batch_size: 10,
        lease_seconds: 30,
        current_transport_epoch: "epoch_new",
        current_transport_generation: 2,
      },
      { now: () => new Date(at) },
    );
    await expect(
      redriver("2026-07-22T04:00:00.000Z").redriveBatch(),
    ).resolves.toEqual({
      claimed: 1,
      redriven: 0,
      retryable_failures: 1,
      permanent_failures: 0,
    });
    await expect(
      redriver("2026-07-22T04:01:00.000Z").redriveBatch(),
    ).resolves.toEqual({
      claimed: 1,
      redriven: 1,
      retryable_failures: 0,
      permanent_failures: 0,
    });
    expect(redriveClaimTokens).toHaveLength(2);
    expect(redriveClaimTokens[0]).not.toBe(redriveClaimTokens[1]);
    await expect(
      redriver("2026-07-22T04:02:00.000Z").redriveBatch(),
    ).resolves.toEqual({
      claimed: 0,
      redriven: 0,
      retryable_failures: 0,
      permanent_failures: 0,
    });
    await expect(
      postgresRedriveStore.acknowledgeSentRedrive({
        outbox_id: envelope.event_id,
        claim_token: redriveClaimTokens[0]!,
        previous_transport_epoch: "epoch_1",
        previous_transport_generation: 1,
        transport_ref: "redis_stream:stale:1-0",
        transport_epoch: "epoch_new",
        current_transport_generation: 2,
        now: "2026-07-22T04:01:01.000Z",
      }),
    ).rejects.toThrow(/stale sent outbox redrive claim/u);

    const newConsumer = createRedisStreamConsumerGroupPortV1(
      redisCommandClient,
      {
        stream: newPhysicalStream,
        group: "trigger_processor",
        consumer: "new_worker",
        namespace: newNamespace,
      },
    );
    await newConsumer.ensureGroup();
    const redrivenDeliveries = await newConsumer.readNew({
      count: 10,
      block_ms: 0,
    });
    expect(redrivenDeliveries).toHaveLength(2);
    for (const delivery of redrivenDeliveries) {
      if (delivery.kind !== "event") {
        throw new Error("expected the redriven Redis delivery");
      }
      await expect(inbox.consume(delivery.envelope)).resolves.toEqual({
        status: "replayed",
      });
    }
    await expect(
      newConsumer.acknowledge({
        delivery_ids: redrivenDeliveries.map(({ delivery_id }) => delivery_id),
      }),
    ).resolves.toEqual({ acknowledged: 2 });
    if (admin === undefined) throw new Error("PAI_TEST_DATABASE_URL is required");
    const persisted = await admin.query<{
      transport_ref: string;
      transport_epoch: string;
      transport_generation: string;
      projection_count: number;
    }>(
      `SELECT outbox.transport_ref, outbox.transport_epoch,
              outbox.transport_generation::text AS transport_generation,
              projection.applied_count AS projection_count
         FROM skill_registry.eventing_outbox outbox
         JOIN skill_registry.eventing_projection projection
           ON projection.id = $2
        WHERE outbox.id = $1`,
      [
        envelope.event_id,
        `${envelope.producer}:${durableEventScopeFingerprintV1(envelope)}:${envelope.idempotency_key}`,
      ],
    );
    expect(persisted.rows).toEqual([{
      transport_ref: expect.stringMatching(
        /^redis_stream:pai:dev:stable:skill_registry:v1:epoch_new:generation_2:stream:skill_events:\d+-\d+$/u,
      ),
      transport_epoch: "epoch_new",
      transport_generation: "2",
      projection_count: 1,
    }]);
    } finally {
      await oldRedis?.close();
      await newRedis?.close();
      if (oldPhysicalStream !== undefined && newPhysicalStream !== undefined) {
        await reader.del(oldPhysicalStream, newPhysicalStream);
      }
      if (reader.isOpen) await reader.close();
      await composition.close();
    }
  });

  it("commits a durable consumer DLQ record before XACK and replays idempotently", async () => {
    await reset();
    const composition = await openVerifiedOwnerPostgresCompositionV1(
      EVENTING_CONTRACT,
      runtimeUrl(),
    );
    const acknowledged: string[] = [];
    const delivery: DurableEventDeliveryConsumerPortV1 = {
      async readNew() {
        return [{
          kind: "invalid",
          delivery_id: "poison-1-0",
          delivery_ref: "stream:consumer_poison#poison-1-0",
          error_code: "invalid_json",
          error_message: "payload is malformed",
          raw_fields: ["payload", "{"],
        }];
      },
      async reclaimPending() {
        return { next_start_id: "0-0", deliveries: [], deleted_ids: [] };
      },
      async acknowledge(request) {
        if (admin === undefined) throw new Error("PAI_TEST_DATABASE_URL is required");
        const durable = await admin.query<{
          dlq_count: string;
          audit_count: string;
        }>(
          `SELECT
             (SELECT count(*)::text FROM skill_registry.eventing_dlq
               WHERE source_event_id = $1) AS dlq_count,
             (SELECT count(*)::text FROM skill_registry.eventing_audit
               WHERE event_id = $1 AND id LIKE 'audit:consumer-dlq:%') AS audit_count`,
          [request.delivery_ids[0]],
        );
        expect(durable.rows).toEqual([{ dlq_count: "1", audit_count: "1" }]);
        acknowledged.push(...request.delivery_ids);
        return { acknowledged: request.delivery_ids.length };
      },
    };
    const worker = createDurableEventConsumerWorkerV1(
      delivery,
      { async apply() { return { status: "processed" }; } },
      {
        consumer_service: "trigger_processor",
        dead_letter: {
          async recordPermanentFailure(request) {
            return composition.unit_of_work.withTransaction(
              {
                operation: "record_consumer_dlq",
                idempotency_key: request.delivery_ref,
                trace_id: `trace:${request.delivery_ref}`,
                isolation: "read_committed",
                retry: "none",
              },
              async (transaction, repositories) =>
                repositories.owner.executeWriter<
                  Readonly<{ status: "recorded" | "replayed" }>,
                  "record_eventing_consumer_dlq_v1"
                >(transaction, {
                  writer: "record_eventing_consumer_dlq_v1",
                  arguments: {
                    p_delivery_id: request.delivery_id,
                    p_delivery_ref: request.delivery_ref,
                    p_consumer_service: request.consumer_service,
                    p_failure_code: request.failure_code,
                    p_failure_message: request.failure_message,
                    p_raw_fields: request.raw_fields,
                    p_envelope: request.envelope,
                    p_now: "2026-07-22T04:00:00.000Z",
                  },
                  expected_rows: 1,
                }),
            );
          },
        },
      },
    );
    await expect(worker.consumeNewBatch({ count: 10, block_ms: 0 })).resolves
      .toMatchObject({ dead_lettered: 1, acknowledged: 1, failed: 0 });
    await expect(worker.consumeNewBatch({ count: 10, block_ms: 0 })).resolves
      .toMatchObject({ dead_lettered: 1, acknowledged: 1, failed: 0 });
    expect(acknowledged).toEqual(["poison-1-0", "poison-1-0"]);
    if (admin === undefined) throw new Error("PAI_TEST_DATABASE_URL is required");
    const dlq = await admin.query<{ dlq_count: string; audit_count: string }>(
      `SELECT
         (SELECT count(*)::text FROM skill_registry.eventing_dlq
           WHERE source_event_id = 'poison-1-0') AS dlq_count,
         (SELECT count(*)::text FROM skill_registry.eventing_audit
           WHERE event_id = 'poison-1-0' AND id LIKE 'audit:consumer-dlq:%') AS audit_count`,
    );
    expect(dlq.rows).toEqual([{ dlq_count: "1", audit_count: "1" }]);
    await composition.close();
  });

  it("rejects a widened owner event union before exposing runtime capabilities", async () => {
    await reset();
    if (admin === undefined) throw new Error("PAI_TEST_DATABASE_URL is required");
    await admin.query(`
      ALTER TABLE skill_registry.eventing_outbox
        DROP CONSTRAINT eventing_outbox_event_type_check;
      ALTER TABLE skill_registry.eventing_outbox
        ADD CONSTRAINT eventing_outbox_event_type_check CHECK (
          event_type IN ('skill.version.published', 'skill.version.attacker')
        );
    `);
    await expect(
      openVerifiedOwnerPostgresCompositionV1(EVENTING_CONTRACT, runtimeUrl()),
    ).rejects.toThrow(/CHECK constraint drift/);
  });

  it("rejects a producer CHECK that admits another service", async () => {
    await reset();
    if (admin === undefined) throw new Error("PAI_TEST_DATABASE_URL is required");
    await admin.query(`
      ALTER TABLE skill_registry.eventing_outbox
        DROP CONSTRAINT eventing_outbox_producer_check;
      ALTER TABLE skill_registry.eventing_outbox
        ADD CONSTRAINT eventing_outbox_producer_check CHECK (
          producer IN ('skill_registry', 'trigger_processor')
        );
    `);
    await expect(
      openVerifiedOwnerPostgresCompositionV1(EVENTING_CONTRACT, runtimeUrl()),
    ).rejects.toThrow(/CHECK constraint drift/);
  });
});
