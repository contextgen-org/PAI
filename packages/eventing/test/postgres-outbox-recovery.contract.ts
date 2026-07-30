import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { createClient } from "redis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type {
  DurableEventEnvelopeV1,
  DurableInboxIdentityV1,
} from "@pai/contracts";

import {
  assertOwnerOutboxAcknowledgeConfirmationV1,
  defineOwnerRepositoryContractV1,
  ownerDlqResolutionContractV1,
  openVerifiedOwnerPostgresCompositionV1,
  ownerFunctionSignatureV1,
  ownerWriterArtifactV1,
  verifyOwnerRepositoryDeploymentFromPostgresV1,
} from "@pai/persistence";

import {
  canonicalDurableEventEnvelopePayloadHashV1,
  canonicalDurableEventEnvelopeSemanticHashV1,
  canonicalPayloadHashV1,
  assertDurableSentOutboxPermanentFailureAckResultV1,
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

const databaseUrl =
  process.env.PAI_EVENTING_TEST_DATABASE_URL ??
  process.env.PAI_PERSISTENCE_TEST_DATABASE_URL ??
  process.env.PAI_TEST_DATABASE_URL;
const redisUrl = process.env.PAI_TEST_REDIS_URL;
const itPostgresRedis =
  databaseUrl === undefined || redisUrl === undefined ? it.skip : it;
const EVENTING_TEST_SCHEMA = "trigger_processor" as const;
const EVENTING_TEST_APP_ROLE = "pai_trigger_processor_app" as const;
const EVENTING_TEST_MIGRATOR_ROLE = "pai_eventing_contract_migrator" as const;
const EVENTING_TEST_RUNTIME_ROLE = "pai_eventing_contract_runtime" as const;
const EVENTING_DLQ_RESOLUTION = ownerDlqResolutionContractV1(
  "trigger_processor",
  "eventing_dlq",
);

function triggerRejectedEvent(request: Readonly<{
  event_id: string;
  idempotency_key: string;
  trace_id: string;
  submit_attempt_id: string;
}>) {
  return {
    event_id: request.event_id,
    event_type: "trigger.rejected",
    schema_version: "trigger_processor_event.v1",
    producer: "trigger_processor",
    occurred_at: "2026-07-21T05:00:00.000Z",
    idempotency_key: request.idempotency_key,
    trace_id: request.trace_id,
    payload: {
      workspace_id: "workspace_001",
      bot_id: "bot_001",
      owner_agent_id: "owner_agent_001",
      deployment_environment: "dev",
      release_channel: "stable",
      reason_code: "business_admission_rejected",
      source_ref: `trigger_event:${request.submit_attempt_id}`,
      submit_attempt_id: request.submit_attempt_id,
      rejection_stage: "business_admission",
      rejection_code: "admission_capacity_exceeded",
    },
  } as const;
}

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
  owner_service: "trigger_processor",
  schema: "trigger_processor",
  app_role: "pai_trigger_processor_app",
  fresh_migrations: ["0100_trigger_processor"],
  manifest_source: "services/trigger-processor/src/db/permission-manifest.v1.ts",
  generated_permission_sql: [
    "pai-infra/supabase/generated/permissions/0100_trigger_processor.sql",
  ],
  tables: [
    "eventing_outbox",
    "eventing_transport_epochs",
    "eventing_inbox",
    "eventing_projection",
    "eventing_audit",
    "eventing_dlq",
    EVENTING_DLQ_RESOLUTION.resolution_table,
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
    EVENTING_DLQ_RESOLUTION.table_permission,
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
    "quarantine_sent_eventing_outbox_redrive_v1",
    ...EVENTING_DLQ_RESOLUTION.mutable_writers,
  ],
  function_signatures: [
    ownerFunctionSignatureV1({
      schema: "trigger_processor",
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
      schema: "trigger_processor",
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
      schema: "trigger_processor",
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
      schema: "trigger_processor",
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
      writes_tables: ["eventing_inbox", "eventing_projection", "eventing_audit", "eventing_dlq"],
      effects: [
        {
          table_name: "eventing_inbox",
          operation: "append",
          concurrency_control: "durable_event_identity",
        },
        {
          table_name: "eventing_dlq",
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
      schema: "trigger_processor",
      function_name: "record_eventing_consumer_dlq_v1",
      primary_table: "eventing_dlq",
      writer_kind: "immutable_append",
      arguments: [
        ["p_delivery_id", "text"],
        ["p_delivery_ref", "text"],
        ["p_consumer_service", "text"],
        ["p_failure_code", "text"],
        ["p_failure_message", "text"],
        ["p_raw_fields", "jsonb", { nullable: true }],
        ["p_envelope", "jsonb", { nullable: true }],
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
      schema: "trigger_processor",
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
      schema: "trigger_processor",
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
      schema: "trigger_processor",
      function_name: "ack_sent_eventing_outbox_redrive_v1",
      primary_table: "eventing_outbox",
      writer_kind: "outbox_claim_ack",
      arguments: [
        ["p_outbox_id", "text"],
        ["p_claim_token", "text"],
        ["p_previous_transport_ref", "text"],
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
    ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "quarantine_sent_eventing_outbox_redrive_v1",
      primary_table: "eventing_outbox",
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
        "eventing_outbox",
        "eventing_transport_epochs",
        "eventing_dlq",
      ],
      writes_tables: ["eventing_outbox", "eventing_dlq"],
      effects: [
        {
          table_name: "eventing_outbox",
          operation: "redrive_ack",
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
    ...EVENTING_DLQ_RESOLUTION.function_signatures,
  ],
  foreign_key_snapshot: {
    status: "complete",
    source: "Day 5 isolated PostgreSQL eventing contract fixture with canonical DLQ resolution",
  },
  foreign_keys: [...EVENTING_DLQ_RESOLUTION.foreign_keys],
  database_columns: [
    eventingColumn("eventing_dlq", "id", "text"),
    eventingColumn("eventing_dlq", "source_event_id", "text"),
    eventingColumn("eventing_dlq", "event_type", "text"),
    eventingColumn("eventing_dlq", "payload", "jsonb"),
    eventingColumn("eventing_dlq", "last_error", "jsonb"),
    eventingColumn("eventing_dlq", "failed_at", "timestamp with time zone"),
    ...EVENTING_DLQ_RESOLUTION.database_columns,
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
    ...EVENTING_DLQ_RESOLUTION.database_unique_constraints,
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
      constraint_name: "eventing_inbox_source_event_id_key",
      table_name: "eventing_inbox",
      columns: ["source", "event_id"],
      kind: "unique",
      deferrable: false,
      initially_deferred: false,
      validated: true,
    },
    {
      constraint_name: "eventing_inbox_source_idempotency_key_key",
      table_name: "eventing_inbox",
      columns: ["source", "idempotency_key"],
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
    ...EVENTING_DLQ_RESOLUTION.database_indexes,
    {
      index_name: "eventing_dlq_pkey",
      table_name: "eventing_dlq",
      definition:
        "CREATE UNIQUE INDEX eventing_dlq_pkey ON trigger_processor.eventing_dlq USING btree (id)",
      unique: true,
      primary: true,
      valid: true,
    },
    {
      index_name: "eventing_inbox_pkey",
      table_name: "eventing_inbox",
      definition:
        "CREATE UNIQUE INDEX eventing_inbox_pkey ON trigger_processor.eventing_inbox USING btree (id)",
      unique: true,
      primary: true,
      valid: true,
    },
    {
      index_name: "eventing_inbox_source_event_id_key",
      table_name: "eventing_inbox",
      definition:
        "CREATE UNIQUE INDEX eventing_inbox_source_event_id_key ON trigger_processor.eventing_inbox USING btree (source, event_id)",
      unique: true,
      primary: false,
      valid: true,
    },
    {
      index_name: "eventing_inbox_source_idempotency_key_key",
      table_name: "eventing_inbox",
      definition:
        "CREATE UNIQUE INDEX eventing_inbox_source_idempotency_key_key ON trigger_processor.eventing_inbox USING btree (source, idempotency_key)",
      unique: true,
      primary: false,
      valid: true,
    },
    {
      index_name: "eventing_outbox_idempotency_key_key",
      table_name: "eventing_outbox",
      definition:
        "CREATE UNIQUE INDEX eventing_outbox_idempotency_key_key ON trigger_processor.eventing_outbox USING btree (idempotency_key)",
      unique: true,
      primary: false,
      valid: true,
    },
    {
      index_name: "eventing_outbox_pkey",
      table_name: "eventing_outbox",
      definition:
        "CREATE UNIQUE INDEX eventing_outbox_pkey ON trigger_processor.eventing_outbox USING btree (id)",
      unique: true,
      primary: true,
      valid: true,
    },
    {
      index_name: "eventing_transport_epochs_pkey",
      table_name: "eventing_transport_epochs",
      definition:
        "CREATE UNIQUE INDEX eventing_transport_epochs_pkey ON trigger_processor.eventing_transport_epochs USING btree (transport_name)",
      unique: true,
      primary: true,
      valid: true,
    },
    {
      index_name: "eventing_projection_pkey",
      table_name: "eventing_projection",
      definition:
        "CREATE UNIQUE INDEX eventing_projection_pkey ON trigger_processor.eventing_projection USING btree (id)",
      unique: true,
      primary: true,
      valid: true,
    },
    {
      index_name: "eventing_audit_pkey",
      table_name: "eventing_audit",
      definition:
        "CREATE UNIQUE INDEX eventing_audit_pkey ON trigger_processor.eventing_audit USING btree (id)",
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
      required_definition_fragments: ["event_type", "trigger.rejected"],
      semantic_constraint: {
        kind: "text_enum",
        column_name: "event_type",
        allowed_values: ["trigger.rejected"],
      },
    },
    {
      constraint_name: "eventing_outbox_producer_check",
      table_name: "eventing_outbox",
      required_definition_fragments: ["producer", "trigger_processor"],
      semantic_constraint: {
        kind: "text_equals",
        column_name: "producer",
        value: "trigger_processor",
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
    EVENTING_DLQ_RESOLUTION.resolution_table,
  ],
  outbox_tables: ["eventing_outbox"],
  inbox_tables: ["eventing_inbox"],
  dlq_tables: ["eventing_dlq"],
  dlq_resolutions: [EVENTING_DLQ_RESOLUTION.binding],
  object_metadata_tables: [],
} as const;

const canonicalSetupSql = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pai_migrator') THEN
    CREATE ROLE pai_migrator NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pai_trigger_processor_app') THEN
    CREATE ROLE pai_trigger_processor_app NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pai_eventing_recovery_runtime') THEN
    CREATE ROLE pai_eventing_recovery_runtime LOGIN PASSWORD 'eventing-runtime-test';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END $$;
ALTER ROLE pai_trigger_processor_app NOLOGIN INHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
ALTER ROLE pai_eventing_recovery_runtime LOGIN INHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD 'eventing-runtime-test';
DO $$
DECLARE inherited_role record;
BEGIN
  FOR inherited_role IN
    SELECT parent.rolname
      FROM pg_catalog.pg_auth_members membership
      JOIN pg_catalog.pg_roles parent ON parent.oid = membership.roleid
      JOIN pg_catalog.pg_roles member ON member.oid = membership.member
     WHERE member.rolname = 'pai_eventing_recovery_runtime'
  LOOP
    EXECUTE format(
      'REVOKE %I FROM pai_eventing_recovery_runtime',
      inherited_role.rolname
    );
  END LOOP;
END $$;
GRANT pai_trigger_processor_app TO pai_eventing_recovery_runtime WITH INHERIT TRUE, SET FALSE, ADMIN FALSE;
DROP SCHEMA IF EXISTS trigger_processor CASCADE;
CREATE SCHEMA trigger_processor AUTHORIZATION pai_migrator;
REVOKE ALL ON SCHEMA trigger_processor FROM PUBLIC, anon, authenticated, pai_eventing_recovery_runtime;
GRANT USAGE ON SCHEMA trigger_processor TO pai_trigger_processor_app;
ALTER DEFAULT PRIVILEGES FOR ROLE pai_migrator
  REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE pai_migrator
  REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE pai_migrator
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE pai_migrator IN SCHEMA trigger_processor
  REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE pai_migrator IN SCHEMA trigger_processor
  REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE pai_migrator IN SCHEMA trigger_processor
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
SET ROLE pai_migrator;
CREATE TABLE trigger_processor.eventing_outbox (
  id text PRIMARY KEY,
  event_type text NOT NULL CHECK (event_type IN ('trigger.rejected')),
  schema_version text NOT NULL,
  producer text NOT NULL CHECK (producer = 'trigger_processor'),
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
CREATE TABLE trigger_processor.eventing_transport_epochs (
  transport_name text PRIMARY KEY,
  active_epoch text NOT NULL,
  active_generation bigint NOT NULL,
  activated_at timestamptz NOT NULL
);
ALTER TABLE trigger_processor.eventing_transport_epochs
  ADD CONSTRAINT eventing_transport_epochs_active_generation_safe_check
  CHECK (
    active_generation >= 1
    AND active_generation <= 9007199254740991
  );
INSERT INTO trigger_processor.eventing_transport_epochs(
  transport_name, active_epoch, active_generation, activated_at
) VALUES ('redis_stream', 'epoch_1', 1, '2026-07-22T00:00:00.000Z');
CREATE TABLE trigger_processor.eventing_inbox (
  id text PRIMARY KEY,
  source text NOT NULL,
  event_id text NOT NULL,
  scope_fingerprint text NOT NULL,
  idempotency_key text NOT NULL,
  payload_hash text NOT NULL,
  semantic_hash text NOT NULL,
  processed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  UNIQUE (source, event_id),
  UNIQUE (source, idempotency_key)
);
CREATE TABLE trigger_processor.eventing_dlq (
  id text PRIMARY KEY,
  source_event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  last_error jsonb NOT NULL,
  failed_at timestamptz NOT NULL
);
CREATE TABLE trigger_processor.eventing_dlq_resolutions (
  resolution_id text PRIMARY KEY,
  dlq_id text NOT NULL UNIQUE
    REFERENCES trigger_processor.eventing_dlq(id) ON DELETE NO ACTION,
  idempotency_key text NOT NULL UNIQUE,
  resolution_kind text NOT NULL,
  resolution_payload jsonb NOT NULL,
  resolved_by text NOT NULL,
  resolved_at timestamptz NOT NULL
);
CREATE TABLE trigger_processor.eventing_projection (
  id text PRIMARY KEY,
  source text NOT NULL,
  scope_fingerprint text NOT NULL,
  idempotency_key text NOT NULL,
  semantic_hash text NOT NULL,
  applied_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL
);
CREATE TABLE trigger_processor.eventing_audit (
  id text PRIMARY KEY,
  inbox_id text NOT NULL,
  event_id text NOT NULL,
  semantic_hash text NOT NULL,
  created_at timestamptz NOT NULL
);
CREATE FUNCTION trigger_processor.enqueue_eventing_outbox_v1(
  p_event jsonb,
  p_idempotency_key text,
  p_payload_hash text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = trigger_processor, pg_temp
AS $$
DECLARE result jsonb;
BEGIN
  INSERT INTO trigger_processor.eventing_outbox(
    id, event_type, schema_version, producer, occurred_at, idempotency_key,
    trace_id, payload, payload_hash, target, status, created_at, updated_at
  ) VALUES (
    p_event->>'event_id', p_event->>'event_type', p_event->>'schema_version',
    p_event->>'producer', (p_event->>'occurred_at')::timestamptz,
    p_idempotency_key, p_event->>'trace_id', p_event->'payload', p_payload_hash,
    'trigger_processor.admission_audit', 'pending', clock_timestamp(), clock_timestamp()
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING jsonb_build_object('outbox_id', id, 'status', status) INTO result;
  IF result IS NULL THEN
    SELECT jsonb_build_object('outbox_id', id, 'status', status)
      INTO result
      FROM trigger_processor.eventing_outbox
     WHERE idempotency_key = p_idempotency_key
       AND payload_hash = p_payload_hash;
    IF result IS NULL THEN
      RAISE EXCEPTION 'outbox idempotency payload hash conflict';
    END IF;
  END IF;
  RETURN result;
END;
$$;
CREATE FUNCTION trigger_processor.claim_eventing_outbox_v1(
  p_worker_id text,
  p_limit integer,
  p_lease_seconds integer,
  p_now timestamptz,
  p_current_transport_epoch text,
  p_current_transport_generation bigint
) RETURNS SETOF jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = trigger_processor, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT outbox.id
      FROM trigger_processor.eventing_outbox outbox
      JOIN trigger_processor.eventing_transport_epochs active
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
    UPDATE trigger_processor.eventing_outbox outbox
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
CREATE FUNCTION trigger_processor.ack_eventing_outbox_v1(
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
SET search_path = trigger_processor, pg_temp
AS $$
DECLARE
  current_event trigger_processor.eventing_outbox%ROWTYPE;
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
    FROM trigger_processor.eventing_transport_epochs active
   WHERE active.transport_name = 'redis_stream'
   FOR UPDATE;
  IF active_epoch IS DISTINCT FROM p_current_transport_epoch
     OR active_generation IS DISTINCT FROM p_current_transport_generation THEN
    RAISE EXCEPTION 'stale active transport generation';
  END IF;
  UPDATE trigger_processor.eventing_outbox
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
    INSERT INTO trigger_processor.eventing_dlq(
      id, source_event_id, event_type, payload, last_error, failed_at
    ) VALUES (
      'dlq:' || p_outbox_id, p_outbox_id, current_event.event_type,
      current_event.payload, p_error, p_now
    );
  END IF;
  RETURN jsonb_build_object('acknowledged', true);
END;
$$;
CREATE FUNCTION trigger_processor.consume_eventing_inbox_v1(
  p_event jsonb,
  p_idempotency_key text,
  p_payload_hash text,
  p_semantic_hash text,
  p_scope_fingerprint text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = trigger_processor, pg_temp
AS $$
DECLARE
  existing trigger_processor.eventing_inbox%ROWTYPE;
  applied_inbox_id text;
  isolation_id text;
  projection_id text;
BEGIN
  projection_id := (p_event->>'producer') || ':' || p_scope_fingerprint || ':' || p_idempotency_key;
  INSERT INTO trigger_processor.eventing_inbox(
    id, source, event_id, scope_fingerprint, idempotency_key, payload_hash,
    semantic_hash, processed_at, created_at
  ) VALUES (
    'inbox:' || (p_event->>'producer') || ':' || (p_event->>'event_id'),
    p_event->>'producer', p_event->>'event_id', p_scope_fingerprint,
    p_idempotency_key, p_payload_hash, p_semantic_hash,
    clock_timestamp(), clock_timestamp()
  ) ON CONFLICT DO NOTHING
  RETURNING id INTO applied_inbox_id;
  IF FOUND THEN
    INSERT INTO trigger_processor.eventing_projection(
      id, source, scope_fingerprint, idempotency_key, semantic_hash,
      applied_count, updated_at
    ) VALUES (
      projection_id, p_event->>'producer', p_scope_fingerprint,
      p_idempotency_key, p_semantic_hash, 1, clock_timestamp()
    )
    ON CONFLICT (id) DO UPDATE
      SET semantic_hash = EXCLUDED.semantic_hash,
          applied_count = trigger_processor.eventing_projection.applied_count + 1,
          updated_at = EXCLUDED.updated_at;
    INSERT INTO trigger_processor.eventing_audit(
      id, inbox_id, event_id, semantic_hash, created_at
    ) VALUES (
      'audit:' || (p_event->>'producer') || ':' || (p_event->>'event_id'),
      applied_inbox_id, p_event->>'event_id',
      p_semantic_hash, clock_timestamp()
    );
    RETURN jsonb_build_object('status', 'processed');
  END IF;
  SELECT * INTO existing
    FROM trigger_processor.eventing_inbox
   WHERE source = p_event->>'producer'
     AND (
       event_id = p_event->>'event_id'
       OR idempotency_key = p_idempotency_key
     )
   ORDER BY CASE
     WHEN event_id = p_event->>'event_id' THEN 0
     ELSE 1
   END
   LIMIT 1
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'inbox delivery identity missing';
  END IF;
  IF existing.event_id IS DISTINCT FROM p_event->>'event_id'
     OR existing.idempotency_key IS DISTINCT FROM p_idempotency_key
     OR existing.payload_hash IS DISTINCT FROM p_payload_hash
     OR existing.semantic_hash IS DISTINCT FROM p_semantic_hash
     OR existing.scope_fingerprint IS DISTINCT FROM p_scope_fingerprint THEN
    isolation_id := 'inbox-conflict:' || (p_event->>'producer') || ':' ||
      (p_event->>'event_id') || ':' || md5(jsonb_build_array(
        p_idempotency_key, p_payload_hash, p_semantic_hash,
        p_scope_fingerprint
      )::text);
    INSERT INTO trigger_processor.eventing_dlq(
      id, source_event_id, event_type, payload, last_error, failed_at
    ) VALUES (
      isolation_id,
      p_event->>'event_id',
      'consumer.delivery.identity_conflict',
      p_event,
      jsonb_build_object(
        'code', 'durable_inbox_identity_conflict',
        'idempotency_key', p_idempotency_key,
        'payload_hash', p_payload_hash,
        'semantic_hash', p_semantic_hash,
        'scope_fingerprint', p_scope_fingerprint
      ),
      clock_timestamp()
    ) ON CONFLICT (id) DO NOTHING;
    RETURN jsonb_build_object(
      'status', 'isolated',
      'isolation_code', 'durable_inbox_identity_conflict',
      'isolation_ref', 'trigger_processor.eventing_dlq/' || isolation_id
    );
  END IF;
  RETURN jsonb_build_object('status', 'replayed');
END;
$$;
CREATE FUNCTION trigger_processor.record_eventing_consumer_dlq_v1(
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
SET search_path = trigger_processor, pg_temp
AS $$
DECLARE inserted_id text;
BEGIN
  IF p_delivery_id IS NULL OR btrim(p_delivery_id) = ''
     OR p_delivery_ref IS NULL OR btrim(p_delivery_ref) = ''
     OR p_consumer_service IS NULL OR btrim(p_consumer_service) = ''
     OR p_failure_code IS NULL OR btrim(p_failure_code) = '' THEN
    RAISE EXCEPTION 'invalid durable consumer DLQ identity';
  END IF;
  INSERT INTO trigger_processor.eventing_dlq(
    id, source_event_id, event_type, payload, last_error, failed_at
  ) VALUES (
    'consumer-dlq:' || p_consumer_service || ':' || p_delivery_ref,
    p_delivery_id,
    'consumer.delivery.invalid',
    jsonb_build_object('raw_fields', p_raw_fields, 'envelope', p_envelope),
    jsonb_build_object('code', p_failure_code, 'message', p_failure_message),
    p_now
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO inserted_id;
  INSERT INTO trigger_processor.eventing_audit(
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
CREATE FUNCTION trigger_processor.resolve_eventing_dlq_v1(
  p_resolution_id text,
  p_dlq_id text,
  p_idempotency_key text,
  p_resolution_kind text,
  p_resolution_payload jsonb,
  p_resolved_by text,
  p_resolved_at timestamptz
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = trigger_processor, pg_temp
AS $$
DECLARE result jsonb;
BEGIN
  IF p_resolution_id IS NULL OR btrim(p_resolution_id) = ''
     OR p_dlq_id IS NULL OR btrim(p_dlq_id) = ''
     OR p_idempotency_key IS NULL OR btrim(p_idempotency_key) = ''
     OR p_resolution_kind IS NULL OR btrim(p_resolution_kind) = ''
     OR p_resolution_payload IS NULL
     OR p_resolved_by IS NULL OR btrim(p_resolved_by) = ''
     OR p_resolved_at IS NULL THEN
    RAISE EXCEPTION 'invalid durable DLQ resolution fact';
  END IF;
  INSERT INTO trigger_processor.eventing_dlq_resolutions(
    resolution_id, dlq_id, idempotency_key, resolution_kind,
    resolution_payload, resolved_by, resolved_at
  ) VALUES (
    p_resolution_id, p_dlq_id, p_idempotency_key, p_resolution_kind,
    p_resolution_payload, p_resolved_by, p_resolved_at
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING jsonb_build_object(
    'resolution_id', resolution_id,
    'status', 'recorded'
  ) INTO result;
  IF result IS NULL THEN
    SELECT jsonb_build_object(
      'resolution_id', resolution_id,
      'status', 'replayed'
    ) INTO result
      FROM trigger_processor.eventing_dlq_resolutions
     WHERE idempotency_key = p_idempotency_key
       AND resolution_id = p_resolution_id
       AND dlq_id = p_dlq_id
       AND resolution_kind = p_resolution_kind
       AND resolution_payload = p_resolution_payload
       AND resolved_by = p_resolved_by
       AND resolved_at = p_resolved_at;
    IF result IS NULL THEN
      RAISE EXCEPTION 'DLQ resolution idempotency conflict';
    END IF;
  END IF;
  RETURN result;
END;
$$;
CREATE FUNCTION trigger_processor.activate_eventing_transport_epoch_v1(
  p_transport_name text,
  p_expected_generation bigint,
  p_next_epoch text,
  p_next_generation bigint,
  p_now timestamptz
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = trigger_processor, pg_temp
AS $$
DECLARE updated_name text;
BEGIN
  IF p_transport_name IS NULL OR btrim(p_transport_name) = ''
     OR p_next_epoch IS NULL OR btrim(p_next_epoch) = ''
     OR p_next_generation <= p_expected_generation THEN
    RAISE EXCEPTION 'invalid active transport epoch transition';
  END IF;
  UPDATE trigger_processor.eventing_transport_epochs
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
CREATE FUNCTION trigger_processor.claim_sent_eventing_outbox_redrive_v1(
  p_worker_id text,
  p_limit integer,
  p_lease_seconds integer,
  p_now timestamptz,
  p_current_transport_epoch text,
  p_current_transport_generation bigint
) RETURNS SETOF jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = trigger_processor, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT outbox.id
      FROM trigger_processor.eventing_outbox outbox
      JOIN trigger_processor.eventing_transport_epochs active
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
    UPDATE trigger_processor.eventing_outbox outbox
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
CREATE FUNCTION trigger_processor.ack_sent_eventing_outbox_redrive_v1(
  p_outbox_id text,
  p_claim_token text,
  p_previous_transport_ref text,
  p_previous_transport_epoch text,
  p_previous_transport_generation bigint,
  p_transport_ref text,
  p_transport_epoch text,
  p_current_transport_generation bigint,
  p_now timestamptz
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = trigger_processor, pg_temp
AS $$
DECLARE
  updated_id text;
  active_epoch text;
  active_generation bigint;
BEGIN
  IF p_previous_transport_ref IS NULL OR btrim(p_previous_transport_ref) = ''
     OR p_transport_ref IS NULL OR btrim(p_transport_ref) = ''
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
    FROM trigger_processor.eventing_transport_epochs active
   WHERE active.transport_name = 'redis_stream'
   FOR UPDATE;
  IF active_epoch IS DISTINCT FROM p_transport_epoch
     OR active_generation IS DISTINCT FROM p_current_transport_generation THEN
    RAISE EXCEPTION 'stale active transport generation';
  END IF;
  UPDATE trigger_processor.eventing_outbox
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
     AND transport_ref = p_previous_transport_ref
     AND transport_epoch IS NOT DISTINCT FROM p_previous_transport_epoch
     AND transport_generation IS NOT DISTINCT FROM p_previous_transport_generation
   RETURNING id INTO updated_id;
  IF updated_id IS NULL THEN
    RAISE EXCEPTION 'stale sent outbox redrive claim';
  END IF;
  RETURN jsonb_build_object('acknowledged', true);
END;
$$;
CREATE FUNCTION trigger_processor.quarantine_sent_eventing_outbox_redrive_v1(
  p_outbox_id text,
  p_claim_token text,
  p_previous_transport_ref text,
  p_previous_transport_epoch text,
  p_previous_transport_generation bigint,
  p_current_transport_epoch text,
  p_current_transport_generation bigint,
  p_failure_code text,
  p_failure_message text,
  p_now timestamptz
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = trigger_processor, pg_temp
AS $$
DECLARE
  v_active_epoch text;
  v_active_generation bigint;
  v_updated_id text;
  v_event_type text;
  v_payload jsonb;
  v_failure jsonb;
  v_quarantine_id text;
  v_quarantine_payload jsonb;
  v_replayed boolean;
BEGIN
  IF p_outbox_id IS NULL OR btrim(p_outbox_id) = ''
     OR p_claim_token IS NULL OR btrim(p_claim_token) = ''
     OR p_previous_transport_ref IS NULL OR btrim(p_previous_transport_ref) = ''
     OR p_previous_transport_epoch IS NULL OR btrim(p_previous_transport_epoch) = ''
     OR p_current_transport_epoch IS NULL OR btrim(p_current_transport_epoch) = ''
     OR p_current_transport_generation < 1
     OR p_failure_code IS NULL
     OR p_failure_code !~ '^[a-z][a-z0-9_]{0,63}$'
     OR p_failure_message IS NULL OR btrim(p_failure_message) = '' THEN
    RAISE EXCEPTION 'invalid sent outbox permanent failure acknowledgment';
  END IF;

  SELECT active.active_epoch, active.active_generation
    INTO v_active_epoch, v_active_generation
    FROM trigger_processor.eventing_transport_epochs active
   WHERE active.transport_name = 'redis_stream'
   FOR UPDATE;
  IF v_active_epoch IS DISTINCT FROM p_current_transport_epoch
     OR v_active_generation IS DISTINCT FROM p_current_transport_generation THEN
    RAISE EXCEPTION 'stale active transport generation';
  END IF;

  v_failure := jsonb_build_object(
    'code', p_failure_code,
    'message', p_failure_message,
    'retryable', false
  );
  v_quarantine_id :=
    'sent_redrive_permanent:' || p_outbox_id || ':' || p_claim_token;
  v_quarantine_payload := jsonb_build_object(
    'kind', 'sent_outbox_redrive_permanent_failure',
    'outbox_id', p_outbox_id,
    'claim_token', p_claim_token,
    'previous_transport_ref', p_previous_transport_ref,
    'previous_transport_epoch', p_previous_transport_epoch,
    'previous_transport_generation', p_previous_transport_generation,
    'current_transport_epoch', p_current_transport_epoch,
    'current_transport_generation', p_current_transport_generation,
    'failure_code', p_failure_code
  );

  UPDATE trigger_processor.eventing_outbox
     SET status = 'failed',
         last_error = v_failure,
         redrive_claimed_by = NULL,
         redrive_claim_token = NULL,
         redrive_locked_until = NULL,
         updated_at = p_now
   WHERE id = p_outbox_id
     AND status = 'sent'
     AND redrive_claim_token = p_claim_token
     AND transport_ref = p_previous_transport_ref
     AND transport_epoch IS NOT DISTINCT FROM p_previous_transport_epoch
     AND transport_generation IS NOT DISTINCT FROM p_previous_transport_generation
   RETURNING id, event_type, payload
        INTO v_updated_id, v_event_type, v_payload;

  IF v_updated_id IS NULL THEN
    SELECT true
      INTO v_replayed
      FROM trigger_processor.eventing_outbox outbox
      JOIN trigger_processor.eventing_dlq dlq
        ON dlq.id = v_quarantine_id
     WHERE outbox.id = p_outbox_id
       AND outbox.status = 'failed'
       AND outbox.transport_ref = p_previous_transport_ref
       AND outbox.transport_epoch IS NOT DISTINCT FROM p_previous_transport_epoch
       AND outbox.transport_generation IS NOT DISTINCT FROM p_previous_transport_generation
       AND outbox.last_error = v_failure
       AND dlq.source_event_id = p_outbox_id
       AND dlq.payload = v_quarantine_payload
       AND dlq.last_error = v_failure;
    IF v_replayed IS TRUE THEN
      RETURN jsonb_build_object(
        'acknowledged', true,
        'status', 'replayed'
      );
    END IF;
    RAISE EXCEPTION 'stale sent outbox permanent failure claim';
  END IF;

  INSERT INTO trigger_processor.eventing_dlq(
    id,
    source_event_id,
    event_type,
    payload,
    last_error,
    failed_at
  ) VALUES (
    v_quarantine_id,
    p_outbox_id,
    v_event_type,
    v_quarantine_payload,
    v_failure,
    p_now
  )
  ON CONFLICT (id) DO NOTHING;

  PERFORM 1
    FROM trigger_processor.eventing_dlq dlq
   WHERE dlq.id = v_quarantine_id
     AND dlq.source_event_id = p_outbox_id
     AND dlq.event_type = v_event_type
     AND dlq.payload = v_quarantine_payload
     AND dlq.last_error = v_failure;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'sent outbox quarantine identity conflict';
  END IF;

  RETURN jsonb_build_object(
    'acknowledged', true,
    'status', 'quarantined'
  );
END;
$$;
RESET ROLE;
REVOKE ALL ON ALL TABLES IN SCHEMA trigger_processor FROM PUBLIC, anon, authenticated, pai_trigger_processor_app, pai_eventing_recovery_runtime;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA trigger_processor FROM PUBLIC, anon, authenticated, pai_trigger_processor_app, pai_eventing_recovery_runtime;
GRANT SELECT (${EVENTING_CONTRACT_INPUT.table_permissions[0]!.select_columns.join(", ")}) ON trigger_processor.eventing_outbox TO pai_trigger_processor_app;
GRANT SELECT (${EVENTING_CONTRACT_INPUT.table_permissions[1]!.select_columns.join(", ")}) ON trigger_processor.eventing_transport_epochs TO pai_trigger_processor_app;
GRANT SELECT (${EVENTING_CONTRACT_INPUT.table_permissions[2]!.select_columns.join(", ")}) ON trigger_processor.eventing_inbox TO pai_trigger_processor_app;
GRANT SELECT (${EVENTING_CONTRACT_INPUT.table_permissions[3]!.select_columns.join(", ")}) ON trigger_processor.eventing_dlq TO pai_trigger_processor_app;
GRANT SELECT (${EVENTING_CONTRACT_INPUT.table_permissions[4]!.select_columns.join(", ")}) ON trigger_processor.eventing_projection TO pai_trigger_processor_app;
GRANT SELECT (${EVENTING_CONTRACT_INPUT.table_permissions[5]!.select_columns.join(", ")}) ON trigger_processor.eventing_audit TO pai_trigger_processor_app;
GRANT SELECT (${EVENTING_CONTRACT_INPUT.table_permissions[6]!.select_columns.join(", ")}) ON trigger_processor.eventing_dlq_resolutions TO pai_trigger_processor_app;
GRANT EXECUTE ON FUNCTION trigger_processor.enqueue_eventing_outbox_v1(jsonb, text, text) TO pai_trigger_processor_app;
GRANT EXECUTE ON FUNCTION trigger_processor.claim_eventing_outbox_v1(text, integer, integer, timestamptz, text, bigint) TO pai_trigger_processor_app;
GRANT EXECUTE ON FUNCTION trigger_processor.ack_eventing_outbox_v1(text, text, text, timestamptz, jsonb, text, text, bigint, text, bigint, timestamptz) TO pai_trigger_processor_app;
GRANT EXECUTE ON FUNCTION trigger_processor.consume_eventing_inbox_v1(jsonb, text, text, text, text) TO pai_trigger_processor_app;
GRANT EXECUTE ON FUNCTION trigger_processor.record_eventing_consumer_dlq_v1(text, text, text, text, text, jsonb, jsonb, timestamptz) TO pai_trigger_processor_app;
GRANT EXECUTE ON FUNCTION trigger_processor.resolve_eventing_dlq_v1(text, text, text, text, jsonb, text, timestamptz) TO pai_trigger_processor_app;
GRANT EXECUTE ON FUNCTION trigger_processor.activate_eventing_transport_epoch_v1(text, bigint, text, bigint, timestamptz) TO pai_trigger_processor_app;
GRANT EXECUTE ON FUNCTION trigger_processor.claim_sent_eventing_outbox_redrive_v1(text, integer, integer, timestamptz, text, bigint) TO pai_trigger_processor_app;
GRANT EXECUTE ON FUNCTION trigger_processor.ack_sent_eventing_outbox_redrive_v1(text, text, text, text, bigint, text, text, bigint, timestamptz) TO pai_trigger_processor_app;
GRANT EXECUTE ON FUNCTION trigger_processor.quarantine_sent_eventing_outbox_redrive_v1(text, text, text, text, bigint, text, bigint, text, text, timestamptz) TO pai_trigger_processor_app;
`;

const setupSql = canonicalSetupSql
  .replaceAll("pai_trigger_processor_app", EVENTING_TEST_APP_ROLE)
  .replaceAll("pai_eventing_recovery_runtime", EVENTING_TEST_RUNTIME_ROLE)
  .replaceAll("pai_migrator", EVENTING_TEST_MIGRATOR_ROLE);

function generatedWriterBody(functionName: string): string {
  const functionStart = setupSql.indexOf(
    `CREATE FUNCTION trigger_processor.${functionName}(`,
  );
  const bodyMarker = setupSql.indexOf("AS $$", functionStart);
  const bodyStart = setupSql.indexOf("\n", bodyMarker) + 1;
  const bodyEnd = setupSql.indexOf("\n$$;", bodyStart);
  if (functionStart < 0 || bodyMarker < 0 || bodyStart <= 0 || bodyEnd < 0) {
    throw new Error(`missing generated fixture writer body: ${functionName}`);
  }
  return setupSql.slice(bodyStart, bodyEnd);
}

const CANONICAL_EVENTING_CONTRACT = defineOwnerRepositoryContractV1({
  ...EVENTING_CONTRACT_INPUT,
  writer_artifacts: EVENTING_CONTRACT_INPUT.function_signatures.map(
    (signature) =>
      ownerWriterArtifactV1({
        signature,
        generator_source:
          "pai-infra/supabase/generated/permissions/0100_trigger_processor.sql",
        function_body: generatedWriterBody(signature.function_name),
      }),
  ),
});

// Production owner contracts intentionally pin canonical schema/role targets.
// This integration fixture preserves that validated contract shape at compile
// time, then isolates only its PostgreSQL deployment target to avoid dropping
// a canonical owner schema while parallel CI suites are running.
const EVENTING_TEST_FUNCTION_SIGNATURES =
  CANONICAL_EVENTING_CONTRACT.function_signatures.map((signature) =>
    Object.freeze({
      ...signature,
      schema: EVENTING_TEST_SCHEMA,
      search_path: [EVENTING_TEST_SCHEMA, "pg_temp"] as const,
    }),
  );
const EVENTING_CONTRACT = Object.freeze({
  ...CANONICAL_EVENTING_CONTRACT,
  schema: EVENTING_TEST_SCHEMA,
  app_role: EVENTING_TEST_APP_ROLE,
  function_signatures: EVENTING_TEST_FUNCTION_SIGNATURES,
  foreign_keys: CANONICAL_EVENTING_CONTRACT.foreign_keys.map((foreignKey) =>
    Object.freeze({
      ...foreignKey,
      referenced_schema: EVENTING_TEST_SCHEMA,
    }),
  ),
  database_indexes: CANONICAL_EVENTING_CONTRACT.database_indexes?.map(
    (index) =>
      Object.freeze({
        ...index,
        definition: index.definition.replace(
          " ON trigger_processor.",
          ` ON ${EVENTING_TEST_SCHEMA}.`,
        ),
      }),
  ),
  writer_artifacts: EVENTING_TEST_FUNCTION_SIGNATURES.map((signature) =>
    ownerWriterArtifactV1({
      signature,
      generator_source:
        "pai-infra/supabase/generated/permissions/0100_trigger_processor.sql",
      function_body: generatedWriterBody(signature.function_name),
    }),
  ),
}) as unknown as typeof CANONICAL_EVENTING_CONTRACT;

describe("eventing deployment contract guard", () => {
  it("rejects an unmapped DLQ before querying either PostgreSQL identity", async () => {
    const { dlq_resolutions: _mapping, ...unmapped } =
      CANONICAL_EVENTING_CONTRACT;
    const queries: string[] = [];
    const postgres = {
      async query<TRow extends Record<string, unknown>>(sql: string) {
        queries.push(sql);
        return { rows: [] as TRow[] };
      },
    };

    await expect(
      verifyOwnerRepositoryDeploymentFromPostgresV1(
        unmapped as typeof CANONICAL_EVENTING_CONTRACT,
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

const describePostgres = databaseUrl === undefined ? describe.skip : describe;

describePostgres("PostgreSQL durable outbox recovery", () => {
  const control = databaseUrl === undefined
    ? undefined
    : new Pool({ connectionString: databaseUrl, max: 1 });
  const isolatedDatabase =
    `pai_eventing_${randomUUID().replaceAll("-", "")}`;
  let isolatedDatabaseUrl: string | undefined;
  let admin: Pool | undefined;

  beforeAll(async () => {
    if (control === undefined || databaseUrl === undefined) {
      throw new Error("PAI_TEST_DATABASE_URL is required");
    }
    await control.query(`CREATE DATABASE "${isolatedDatabase}" TEMPLATE template0`);
    const url = new URL(databaseUrl);
    url.pathname = `/${isolatedDatabase}`;
    isolatedDatabaseUrl = url.toString();
    admin = new Pool({ connectionString: isolatedDatabaseUrl });
  });

  afterAll(async () => {
    await admin?.end();
    if (control !== undefined) {
      await control.query(`DROP DATABASE IF EXISTS "${isolatedDatabase}" WITH (FORCE)`);
      await control.query(`DROP ROLE IF EXISTS ${EVENTING_TEST_RUNTIME_ROLE}`);
      await control.query(`DROP ROLE IF EXISTS ${EVENTING_TEST_MIGRATOR_ROLE}`);
      await control.end();
    }
  });

  async function reset(): Promise<void> {
    if (admin === undefined) throw new Error("PAI_TEST_DATABASE_URL is required");
    await admin.query(setupSql);
  }

  function runtimeUrl(): string {
    if (isolatedDatabaseUrl === undefined) {
      throw new Error("isolated PostgreSQL database is not initialized");
    }
    const url = new URL(isolatedDatabaseUrl);
    url.username = EVENTING_TEST_RUNTIME_ROLE;
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
        const confirmation = await composition.unit_of_work.withTransaction(
          {
            operation: "ack_eventing_outbox",
            idempotency_key: `${request.outbox_id}:${request.claim_token}`,
            trace_id: "trace_ack_eventing_outbox",
            isolation: "read_committed",
            retry: "none",
          },
          async (transaction, repositories) =>
            repositories.owner.executeWriter<unknown, "ack_eventing_outbox_v1">(
              transaction,
              {
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
              },
            ),
        );
        assertOwnerOutboxAcknowledgeConfirmationV1(confirmation);
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
    const envelope = triggerRejectedEvent({
      event_id: "evt_restart_001",
      idempotency_key: "submit_attempt_restart_001:rejected",
      trace_id: "trace_restart_001",
      submit_attempt_id: "submit_attempt_restart_001",
    });
    const payloadHash = canonicalPayloadHashV1(envelope.payload);

    const firstProcess = await openVerifiedOwnerPostgresCompositionV1(
      EVENTING_CONTRACT,
      runtimeUrl(),
      EVENTING_TEST_MIGRATOR_ROLE,
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
      EVENTING_TEST_MIGRATOR_ROLE,
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
        owner_service: "trigger_processor",
        worker_id: "eventing_worker_001",
        batch_size: 16,
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

    const consume = async (
      eventPayload: Readonly<Record<string, unknown>>,
      overrides: Readonly<{
        event_id?: string;
        idempotency_key?: string;
        payload_hash?: string;
        semantic_hash?: string;
        scope_fingerprint?: string;
      }> = {},
    ) => {
      const consumedEnvelope = {
        ...envelope,
        ...(overrides.event_id === undefined
          ? {}
          : { event_id: overrides.event_id }),
        payload: eventPayload,
      };
      const result = await secondProcess.unit_of_work.withTransaction(
        {
          operation: "consume_skill_event",
          idempotency_key:
            overrides.idempotency_key ?? envelope.idempotency_key,
          trace_id: envelope.trace_id,
          isolation: "read_committed",
          retry: "none",
        },
        async (transaction, repositories) =>
          repositories.owner.executeWriter<
            Readonly<{
              status: "processed" | "replayed" | "isolated";
              isolation_code?: "durable_inbox_identity_conflict";
              isolation_ref?: string;
            }>,
            "consume_eventing_inbox_v1"
          >(transaction, {
            writer: "consume_eventing_inbox_v1",
            arguments: {
              p_event: consumedEnvelope,
              p_idempotency_key:
                overrides.idempotency_key ?? envelope.idempotency_key,
              p_payload_hash:
                overrides.payload_hash ??
                canonicalDurableEventEnvelopePayloadHashV1(consumedEnvelope),
              p_semantic_hash:
                overrides.semantic_hash ??
                canonicalDurableEventEnvelopeSemanticHashV1(consumedEnvelope),
              p_scope_fingerprint:
                overrides.scope_fingerprint ??
                durableEventScopeFingerprintV1(consumedEnvelope),
            },
            expected_rows: 1,
          }),
      );
      return result;
    };
    await expect(consume(envelope.payload)).resolves.toEqual({ status: "processed" });
    await expect(consume(envelope.payload)).resolves.toEqual({ status: "replayed" });
    await expect(
      consume(envelope.payload, { idempotency_key: "changed-business-key" }),
    ).resolves.toMatchObject({ status: "isolated" });
    await expect(
      consume(envelope.payload, { payload_hash: "changed-payload-hash" }),
    ).resolves.toMatchObject({ status: "isolated" });
    await expect(
      consume(envelope.payload, { semantic_hash: "changed-semantic-hash" }),
    ).resolves.toMatchObject({ status: "isolated" });
    await expect(
      consume(envelope.payload, { scope_fingerprint: "changed-scope" }),
    ).resolves.toMatchObject({ status: "isolated" });
    const nextEventId = `${envelope.event_id}_next`;
    await expect(
      consume(envelope.payload, {
        event_id: nextEventId,
        idempotency_key: envelope.idempotency_key,
      }),
    ).resolves.toMatchObject({
      status: "isolated",
      isolation_code: "durable_inbox_identity_conflict",
    });

    if (admin === undefined) throw new Error("PAI_TEST_DATABASE_URL is required");
    const projection = await admin.query<{
      applied_count: number;
      semantic_hash: string;
    }>(
      "SELECT applied_count, semantic_hash FROM trigger_processor.eventing_projection WHERE id = $1",
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
      "SELECT count(*)::text AS count FROM trigger_processor.eventing_audit",
    );
    expect(audit.rows).toEqual([{ count: "1" }]);
    const conflicts = await admin.query<{ count: string }>(
      `SELECT count(*)::text AS count
         FROM trigger_processor.eventing_dlq
        WHERE event_type = 'consumer.delivery.identity_conflict'`,
    );
    expect(conflicts.rows).toEqual([{ count: "5" }]);
    const persisted = await admin.query<{
      status: string;
      attempt_count: number;
      transport_ref: string;
      transport_epoch: string;
      transport_generation: string;
    }>(
      `SELECT status, attempt_count, transport_ref, transport_epoch,
              transport_generation::text AS transport_generation
         FROM trigger_processor.eventing_outbox
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

  it("commits an inbox identity isolation before the worker XACKs exactly once", async () => {
    await reset();
    const composition = await openVerifiedOwnerPostgresCompositionV1(
      EVENTING_CONTRACT,
      runtimeUrl(),
      EVENTING_TEST_MIGRATOR_ROLE,
    );
    const canonical = triggerRejectedEvent({
      event_id: "evt_worker_identity_conflict_001",
      idempotency_key: "submit_attempt_worker_conflict_001:rejected",
      trace_id: "trace_worker_identity_conflict_001",
      submit_attempt_id: "submit_attempt_worker_conflict_001",
    });
    let returnedIsolationRef: string | undefined;
    const apply = async (
      request: Readonly<
        DurableInboxIdentityV1 & { envelope: DurableEventEnvelopeV1 }
      >,
    ) => {
      const result = await composition.unit_of_work.withTransaction(
        {
          operation: "consume_worker_identity_conflict",
          idempotency_key: request.idempotency_key,
          trace_id: request.envelope.trace_id,
          isolation: "read_committed",
          retry: "none",
        },
        async (transaction, repositories) =>
          repositories.owner.executeWriter<
            | Readonly<{ status: "processed" | "replayed" }>
            | Readonly<{
                status: "isolated";
                isolation_code: "durable_inbox_identity_conflict";
                isolation_ref: string;
              }>,
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
      if (result.status === "isolated") {
        returnedIsolationRef = result.isolation_ref;
      }
      return result;
    };
    const inbox = createDurableInboxConsumerV1(
      { apply },
      { consumer_service: "trigger_processor" },
    );
    await expect(inbox.consume(canonical)).resolves.toEqual({
      status: "processed",
    });

    const conflicting = {
      ...canonical,
      idempotency_key: "submit_attempt_worker_conflict_001:changed",
    };
    let acknowledged = 0;
    let deadLetterCalls = 0;
    let isolationRef: string | undefined;
    const worker = createDurableEventConsumerWorkerV1(
      {
        async readNew() {
          return [
            {
              kind: "event",
              delivery_id: "worker-conflict-1-0",
              delivery_ref: "stream:worker-conflict#worker-conflict-1-0",
              envelope: conflicting,
            },
          ];
        },
        async reclaimPending() {
          return {
            next_start_id: "0-0",
            deliveries: [],
            deleted_ids: [],
          };
        },
        async acknowledge(request) {
          if (admin === undefined) {
            throw new Error("PAI_TEST_DATABASE_URL is required");
          }
          const durable = await admin.query<{
            projection_count: string;
            audit_count: string;
            conflict_count: string;
            isolation_id: string;
          }>(
            `SELECT
               (SELECT count(*)::text
                  FROM trigger_processor.eventing_projection) AS projection_count,
               (SELECT count(*)::text
                  FROM trigger_processor.eventing_audit
                 WHERE event_id = $1) AS audit_count,
               (SELECT count(*)::text
                  FROM trigger_processor.eventing_dlq
                 WHERE source_event_id = $1
                   AND event_type = 'consumer.delivery.identity_conflict')
                 AS conflict_count,
               (SELECT id
                  FROM trigger_processor.eventing_dlq
                 WHERE source_event_id = $1
                   AND event_type = 'consumer.delivery.identity_conflict')
                 AS isolation_id`,
            [canonical.event_id],
          );
          expect(durable.rows).toHaveLength(1);
          const persisted = durable.rows[0];
          expect(persisted).toMatchObject({
            projection_count: "1",
            audit_count: "1",
            conflict_count: "1",
          });
          isolationRef = `trigger_processor.eventing_dlq/${persisted?.isolation_id}`;
          expect(returnedIsolationRef).toBe(isolationRef);
          acknowledged += request.delivery_ids.length;
          return { acknowledged: request.delivery_ids.length };
        },
      },
      { apply },
      {
        consumer_service: "trigger_processor",
        dead_letter: {
          async recordPermanentFailure() {
            deadLetterCalls += 1;
            return { status: "recorded" };
          },
        },
      },
    );
    try {
      await expect(
        worker.consumeNewBatch({ count: 1, block_ms: 0 }),
      ).resolves.toMatchObject({
        received: 1,
        processed: 0,
        replayed: 0,
        failed: 0,
        dead_lettered: 1,
        acknowledged: 1,
      });
      expect(acknowledged).toBe(1);
      expect(deadLetterCalls).toBe(0);
      expect(isolationRef).toMatch(
        /^trigger_processor\.eventing_dlq\/inbox-conflict:/u,
      );
    } finally {
      await composition.close();
    }
  });

  it("does not let an old normal dispatcher claim a pending row after transport cutover", async () => {
    await reset();
    const composition = await openVerifiedOwnerPostgresCompositionV1(
      EVENTING_CONTRACT,
      runtimeUrl(),
      EVENTING_TEST_MIGRATOR_ROLE,
    );
    try {
      const envelope = triggerRejectedEvent({
        event_id: "evt_cutover_claim_001",
        idempotency_key: "submit_attempt_cutover_claim_001:rejected",
        trace_id: "trace_cutover_claim_001",
        submit_attempt_id: "submit_attempt_cutover_claim_001",
      });
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
            owner_service: "trigger_processor",
            worker_id: `eventing_worker_${generation}`,
            batch_size: 16,
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
           FROM trigger_processor.eventing_outbox
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
      EVENTING_TEST_MIGRATOR_ROLE,
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
    const envelope = triggerRejectedEvent({
      event_id: "evt_epoch_redrive_001",
      idempotency_key: "submit_attempt_redrive_001:rejected",
      trace_id: "trace_epoch_redrive_001",
      submit_attempt_id: "submit_attempt_redrive_001",
    });
    const oldNamespace = createRedisNamespaceV1({
      deployment_environment: "dev",
      release_channel: "stable",
      owner_service: "trigger_processor",
      stream_epoch: "epoch_1",
      stream_generation: 1,
    });
    const newNamespace = createRedisNamespaceV1({
      deployment_environment: "dev",
      release_channel: "stable",
      owner_service: "trigger_processor",
      stream_epoch: "epoch_new",
      stream_generation: 2,
    });
    const target = "trigger_processor.admission_audit";
    const logicalStream = "stream:trigger_events";
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
        owner_service: "trigger_processor",
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
        const confirmation = await composition.unit_of_work.withTransaction(
          {
            operation: "ack_sent_redrive",
            idempotency_key: request.outbox_id,
            trace_id: "trace_ack_sent_redrive",
            isolation: "read_committed",
            retry: "none",
          },
          async (transaction, repositories) =>
            repositories.owner.executeWriter<
              unknown,
              "ack_sent_eventing_outbox_redrive_v1"
            >(transaction, {
              writer: "ack_sent_eventing_outbox_redrive_v1",
              arguments: {
                p_outbox_id: request.outbox_id,
                p_claim_token: request.claim_token,
                p_previous_transport_ref: request.previous_transport_ref,
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
        assertOwnerOutboxAcknowledgeConfirmationV1(confirmation);
      },
      async acknowledgeSentRedrivePermanentFailure(request) {
        const result = await composition.unit_of_work.withTransaction(
          {
            operation: "quarantine_sent_redrive",
            idempotency_key: `${request.outbox_id}:${request.claim_token}`,
            trace_id: "trace_quarantine_sent_redrive",
            isolation: "read_committed",
            retry: "none",
          },
          async (transaction, repositories) =>
            repositories.owner.executeWriter<
              unknown,
              "quarantine_sent_eventing_outbox_redrive_v1"
            >(transaction, {
              writer: "quarantine_sent_eventing_outbox_redrive_v1",
              arguments: {
                p_outbox_id: request.outbox_id,
                p_claim_token: request.claim_token,
                p_previous_transport_ref: request.previous_transport_ref,
                p_previous_transport_epoch: request.previous_transport_epoch,
                p_previous_transport_generation:
                  request.previous_transport_generation === null
                    ? null
                    : String(request.previous_transport_generation),
                p_current_transport_epoch: request.current_transport_epoch,
                p_current_transport_generation:
                  String(request.current_transport_generation),
                p_failure_code: request.failure_code,
                p_failure_message: request.failure_message,
                p_now: request.now,
              },
              expected_rows: 1,
            }),
        );
        assertDurableSentOutboxPermanentFailureAckResultV1(result);
        return result;
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
      acknowledgeSentRedrivePermanentFailure: (request) =>
        postgresRedriveStore.acknowledgeSentRedrivePermanentFailure(request),
    };
    const redriver = (at: string) => createDurableSentOutboxRedriverV1(
      redriveStore,
      newRedis.transport,
      {
        owner_service: "trigger_processor",
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
        previous_transport_ref: "redis_stream:stale-claim:1-0",
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
         FROM trigger_processor.eventing_outbox outbox
         JOIN trigger_processor.eventing_projection projection
           ON projection.id = $2
        WHERE outbox.id = $1`,
      [
        envelope.event_id,
        `${envelope.producer}:${durableEventScopeFingerprintV1(envelope)}:${envelope.idempotency_key}`,
      ],
    );
    expect(persisted.rows).toEqual([{
      transport_ref: expect.stringMatching(
        /^redis_stream:pai:dev:stable:trigger_processor:v1:epoch_new:generation_2:stream:trigger_events:\d+-\d+$/u,
      ),
      transport_epoch: "epoch_new",
      transport_generation: "2",
      projection_count: 1,
    }]);

    await activateTransportEpoch(composition, {
      expected_generation: 2,
      next_epoch: "epoch_ref_cas",
      next_generation: 3,
      now: "2026-07-22T04:02:30.000Z",
    });
    const [refRaceClaim] = await postgresRedriveStore.claimSentForRedrive({
      worker_id: "redrive_ref_race",
      limit: 1,
      lease_seconds: 30,
      now: "2026-07-22T04:02:31.000Z",
      current_transport_epoch: "epoch_ref_cas",
      current_transport_generation: 3,
    });
    if (
      refRaceClaim === undefined ||
      typeof refRaceClaim.transport_ref !== "string" ||
      typeof refRaceClaim.transport_epoch !== "string" ||
      (refRaceClaim.transport_generation !== null &&
        !Number.isSafeInteger(refRaceClaim.transport_generation))
    ) {
      throw new Error("expected a valid sent outbox ref-CAS claim");
    }
    const concurrentlyRemappedRef = `${refRaceClaim.transport_ref}:concurrent`;
    await admin.query(
      `UPDATE trigger_processor.eventing_outbox
          SET transport_ref = $2,
              updated_at = $3
        WHERE id = $1`,
      [
        refRaceClaim.outbox_id,
        concurrentlyRemappedRef,
        "2026-07-22T04:02:32.000Z",
      ],
    );
    await expect(
      postgresRedriveStore.acknowledgeSentRedrive({
        outbox_id: refRaceClaim.outbox_id,
        claim_token: refRaceClaim.claim_token,
        previous_transport_ref: refRaceClaim.transport_ref,
        previous_transport_epoch: refRaceClaim.transport_epoch,
        previous_transport_generation:
          refRaceClaim.transport_generation === null
            ? null
            : (refRaceClaim.transport_generation as number),
        transport_ref: "redis_stream:stale_ref_ack:1-0",
        transport_epoch: "epoch_ref_cas",
        current_transport_generation: 3,
        now: "2026-07-22T04:02:33.000Z",
      }),
    ).rejects.toThrow(/stale sent outbox redrive claim/u);
    const refAfterRejectedAck = await admin.query<{
      transport_ref: string;
      transport_epoch: string;
      transport_generation: string;
    }>(
      `SELECT transport_ref, transport_epoch,
              transport_generation::text AS transport_generation
         FROM trigger_processor.eventing_outbox
        WHERE id = $1`,
      [refRaceClaim.outbox_id],
    );
    expect(refAfterRejectedAck.rows).toEqual([{
      transport_ref: concurrentlyRemappedRef,
      transport_epoch: "epoch_new",
      transport_generation: "2",
    }]);

    const [quarantineClaim] =
      await postgresRedriveStore.claimSentForRedrive({
        worker_id: "redrive_quarantine",
        limit: 1,
        lease_seconds: 30,
        now: "2026-07-22T04:04:00.000Z",
        current_transport_epoch: "epoch_ref_cas",
        current_transport_generation: 3,
      });
    if (
      quarantineClaim === undefined ||
      typeof quarantineClaim.transport_ref !== "string" ||
      typeof quarantineClaim.transport_epoch !== "string" ||
      (quarantineClaim.transport_generation !== null &&
        !Number.isSafeInteger(quarantineClaim.transport_generation))
    ) {
      throw new Error("expected a valid sent outbox quarantine claim");
    }
    const quarantineRequest = {
      outbox_id: quarantineClaim.outbox_id,
      claim_token: quarantineClaim.claim_token,
      previous_transport_ref: quarantineClaim.transport_ref,
      previous_transport_epoch: quarantineClaim.transport_epoch,
      previous_transport_generation:
        quarantineClaim.transport_generation === null
          ? null
          : (quarantineClaim.transport_generation as number),
      current_transport_epoch: "epoch_ref_cas",
      current_transport_generation: 3,
      failure_code: "outbox_contract_violation",
      failure_message:
        "durable event delivery failed closed (outbox_contract_violation)",
      now: "2026-07-22T04:04:01.000Z",
    } as const;
    await expect(
      postgresRedriveStore.acknowledgeSentRedrivePermanentFailure(
        quarantineRequest,
      ),
    ).resolves.toEqual({ acknowledged: true, status: "quarantined" });
    await expect(
      postgresRedriveStore.acknowledgeSentRedrivePermanentFailure(
        quarantineRequest,
      ),
    ).resolves.toEqual({ acknowledged: true, status: "replayed" });
    await expect(
      postgresRedriveStore.acknowledgeSentRedrivePermanentFailure({
        ...quarantineRequest,
        claim_token: `${quarantineRequest.claim_token}:stale`,
      }),
    ).rejects.toThrow(/stale sent outbox permanent failure claim/u);

    const quarantineState = await admin.query<{
      status: string;
      redrive_claim_token: string | null;
      last_error: unknown;
      dlq_count: number;
      dlq_payload: unknown;
    }>(
      `SELECT outbox.status,
              outbox.redrive_claim_token,
              outbox.last_error,
              pg_catalog.count(dlq.id)::integer AS dlq_count,
              pg_catalog.min(dlq.payload::text)::jsonb AS dlq_payload
         FROM trigger_processor.eventing_outbox outbox
         LEFT JOIN trigger_processor.eventing_dlq dlq
           ON dlq.source_event_id = outbox.id
          AND dlq.payload->>'kind' =
            'sent_outbox_redrive_permanent_failure'
        WHERE outbox.id = $1
        GROUP BY outbox.id`,
      [quarantineClaim.outbox_id],
    );
    expect(quarantineState.rows).toEqual([{
      status: "failed",
      redrive_claim_token: null,
      last_error: {
        code: "outbox_contract_violation",
        message:
          "durable event delivery failed closed (outbox_contract_violation)",
        retryable: false,
      },
      dlq_count: 1,
      dlq_payload: expect.objectContaining({
        kind: "sent_outbox_redrive_permanent_failure",
        outbox_id: quarantineClaim.outbox_id,
        claim_token: quarantineClaim.claim_token,
        previous_transport_ref: quarantineClaim.transport_ref,
        current_transport_epoch: "epoch_ref_cas",
        current_transport_generation: 3,
      }),
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
      EVENTING_TEST_MIGRATOR_ROLE,
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
             (SELECT count(*)::text FROM trigger_processor.eventing_dlq
               WHERE source_event_id = $1) AS dlq_count,
             (SELECT count(*)::text FROM trigger_processor.eventing_audit
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
         (SELECT count(*)::text FROM trigger_processor.eventing_dlq
           WHERE source_event_id = 'poison-1-0') AS dlq_count,
         (SELECT count(*)::text FROM trigger_processor.eventing_audit
           WHERE event_id = 'poison-1-0' AND id LIKE 'audit:consumer-dlq:%') AS audit_count`,
    );
    expect(dlq.rows).toEqual([{ dlq_count: "1", audit_count: "1" }]);
    await composition.close();
  });

  it("rejects a widened owner event union before exposing runtime capabilities", async () => {
    await reset();
    if (admin === undefined) throw new Error("PAI_TEST_DATABASE_URL is required");
    await admin.query(`
      ALTER TABLE trigger_processor.eventing_outbox
        DROP CONSTRAINT eventing_outbox_event_type_check;
      ALTER TABLE trigger_processor.eventing_outbox
        ADD CONSTRAINT eventing_outbox_event_type_check CHECK (
          event_type IN ('trigger.rejected', 'trigger.attacker')
        );
    `);
    await expect(
      openVerifiedOwnerPostgresCompositionV1(
        EVENTING_CONTRACT,
        runtimeUrl(),
        EVENTING_TEST_MIGRATOR_ROLE,
      ),
    ).rejects.toThrow(/CHECK constraint drift/);
  });

  it("rejects a producer CHECK that admits another service", async () => {
    await reset();
    if (admin === undefined) throw new Error("PAI_TEST_DATABASE_URL is required");
    await admin.query(`
      ALTER TABLE trigger_processor.eventing_outbox
        DROP CONSTRAINT eventing_outbox_producer_check;
      ALTER TABLE trigger_processor.eventing_outbox
        ADD CONSTRAINT eventing_outbox_producer_check CHECK (
          producer IN ('trigger_processor', 'action_runtime')
        );
    `);
    await expect(
      openVerifiedOwnerPostgresCompositionV1(
        EVENTING_CONTRACT,
        runtimeUrl(),
        EVENTING_TEST_MIGRATOR_ROLE,
      ),
    ).rejects.toThrow(/CHECK constraint drift/);
  });
});
