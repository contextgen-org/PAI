import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";

import {
  defineOwnerRepositoryContractV1,
  openVerifiedOwnerPostgresCompositionV1,
  ownerFunctionSignatureV1,
} from "@pai/persistence";

import {
  canonicalPayloadHashV1,
  createDurableOutboxDispatcherV1,
  createPostgresOwnerOutboxStoreV1,
  type DurableEventTransportPortV1,
} from "../src/index.js";

const databaseUrl = process.env.PAI_TEST_DATABASE_URL;

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

const EVENTING_CONTRACT = defineOwnerRepositoryContractV1({
  contract_version: "owner_repository_contract.v1",
  owner_service: "skill_registry",
  schema: "skill_registry",
  app_role: "pai_skill_registry_app",
  fresh_migrations: ["0450_skill_registry"],
  manifest_source: "services/skill-registry/src/db/permission-manifest.v1.ts",
  generated_permission_sql: [
    "pai-infra/supabase/generated/permissions/0450_skill_registry.sql",
  ],
  tables: ["eventing_outbox", "eventing_inbox", "eventing_dlq"],
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
        "created_at",
        "updated_at",
      ],
      insert_columns: [],
      update_columns: [],
      delete_allowed: false,
      writer_kind: "outbox_claim_ack",
    },
    {
      table_name: "eventing_inbox",
      select_columns: [
        "id",
        "source",
        "event_id",
        "idempotency_key",
        "payload_hash",
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
  ],
  mutable_writers: [
    "enqueue_eventing_outbox_v1",
    "claim_eventing_outbox_v1",
    "ack_eventing_outbox_v1",
    "consume_eventing_inbox_v1",
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
      ],
      reads_tables: ["eventing_outbox"],
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
        ["p_now", "timestamptz"],
      ],
      reads_tables: ["eventing_outbox"],
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
      ],
      reads_tables: ["eventing_inbox"],
      writes_tables: ["eventing_inbox"],
      effects: [
        {
          table_name: "eventing_inbox",
          operation: "append",
          concurrency_control: "idempotency_key",
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
    eventingColumn("eventing_inbox", "idempotency_key", "text"),
    eventingColumn("eventing_inbox", "payload_hash", "text"),
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
      index_name: "eventing_inbox_source_idempotency_key_key",
      table_name: "eventing_inbox",
      definition:
        "CREATE UNIQUE INDEX eventing_inbox_source_idempotency_key_key ON skill_registry.eventing_inbox USING btree (source, idempotency_key)",
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
  ],
  database_checks: [
    {
      constraint_name: "eventing_outbox_producer_check",
      table_name: "eventing_outbox",
      required_definition_fragments: ["producer", "skill_registry"],
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
    },
  ],
  append_only_tables: ["eventing_outbox", "eventing_inbox", "eventing_dlq"],
  outbox_tables: ["eventing_outbox"],
  inbox_tables: ["eventing_inbox"],
  dlq_tables: ["eventing_dlq"],
  object_metadata_tables: [],
} as const);

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
  event_type text NOT NULL,
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
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
CREATE TABLE skill_registry.eventing_inbox (
  id text PRIMARY KEY,
  source text NOT NULL,
  event_id text NOT NULL,
  idempotency_key text NOT NULL,
  payload_hash text NOT NULL,
  processed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  UNIQUE (source, idempotency_key)
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
  p_now timestamptz
) RETURNS SETOF jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = skill_registry, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT id FROM skill_registry.eventing_outbox
    WHERE (
      status IN ('pending','retry_wait')
      OR (status = 'dispatching' AND locked_until <= p_now)
    )
      AND (next_retry_at IS NULL OR next_retry_at <= p_now)
    ORDER BY created_at, id
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  ), claimed AS (
    UPDATE skill_registry.eventing_outbox outbox
       SET status = 'dispatching',
           attempt_count = outbox.attempt_count + 1,
           claimed_by = p_worker_id,
           claim_token = p_worker_id || ':' || outbox.id || ':' || (outbox.attempt_count + 1)::text,
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
  p_now timestamptz
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = skill_registry, pg_temp
AS $$
DECLARE current_event skill_registry.eventing_outbox%ROWTYPE;
BEGIN
  UPDATE skill_registry.eventing_outbox
     SET status = p_outcome,
         next_retry_at = p_next_retry_at,
         last_error = p_error,
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
  p_payload_hash text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = skill_registry, pg_temp
AS $$
DECLARE existing_hash text;
BEGIN
  INSERT INTO skill_registry.eventing_inbox(
    id, source, event_id, idempotency_key, payload_hash, processed_at, created_at
  ) VALUES (
    'inbox:' || (p_event->>'producer') || ':' || p_idempotency_key,
    p_event->>'producer', p_event->>'event_id', p_idempotency_key,
    p_payload_hash, clock_timestamp(), clock_timestamp()
  ) ON CONFLICT (source, idempotency_key) DO NOTHING;
  IF FOUND THEN
    RETURN jsonb_build_object('status', 'processed');
  END IF;
  SELECT payload_hash INTO existing_hash
    FROM skill_registry.eventing_inbox
   WHERE source = p_event->>'producer' AND idempotency_key = p_idempotency_key
   FOR UPDATE;
  IF existing_hash <> p_payload_hash THEN
    RAISE EXCEPTION 'inbox idempotency payload hash conflict';
  END IF;
  RETURN jsonb_build_object('status', 'replayed');
END;
$$;
RESET ROLE;
REVOKE ALL ON ALL TABLES IN SCHEMA skill_registry FROM PUBLIC, anon, authenticated, pai_skill_registry_app, pai_skill_registry_eventing_test;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA skill_registry FROM PUBLIC, anon, authenticated, pai_skill_registry_app, pai_skill_registry_eventing_test;
GRANT SELECT (${EVENTING_CONTRACT.table_permissions[0]!.select_columns.join(", ")}) ON skill_registry.eventing_outbox TO pai_skill_registry_app;
GRANT SELECT (${EVENTING_CONTRACT.table_permissions[1]!.select_columns.join(", ")}) ON skill_registry.eventing_inbox TO pai_skill_registry_app;
GRANT SELECT (${EVENTING_CONTRACT.table_permissions[2]!.select_columns.join(", ")}) ON skill_registry.eventing_dlq TO pai_skill_registry_app;
GRANT EXECUTE ON FUNCTION skill_registry.enqueue_eventing_outbox_v1(jsonb, text, text) TO pai_skill_registry_app;
GRANT EXECUTE ON FUNCTION skill_registry.claim_eventing_outbox_v1(text, integer, integer, timestamptz) TO pai_skill_registry_app;
GRANT EXECUTE ON FUNCTION skill_registry.ack_eventing_outbox_v1(text, text, text, timestamptz, jsonb, timestamptz) TO pai_skill_registry_app;
GRANT EXECUTE ON FUNCTION skill_registry.consume_eventing_inbox_v1(jsonb, text, text) TO pai_skill_registry_app;
`;

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
      payload: { skill_version_id: "skill_version_001" },
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
        return { transport_ref: "redis_stream:1-0" };
      },
    };
    const dispatcher = createDurableOutboxDispatcherV1(
      createPostgresOwnerOutboxStoreV1(
        secondProcess.outbox,
        "eventing_outbox",
      ),
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

    const consume = async (eventPayload: typeof envelope.payload) =>
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
            },
            expected_rows: 1,
          }),
      );
    await expect(consume(envelope.payload)).resolves.toEqual({ status: "processed" });
    await expect(consume(envelope.payload)).resolves.toEqual({ status: "replayed" });
    await expect(
      consume({ skill_version_id: "skill_version_drift" }),
    ).rejects.toThrow(/payload hash conflict/);

    if (admin === undefined) throw new Error("PAI_TEST_DATABASE_URL is required");
    const persisted = await admin.query<{ status: string; attempt_count: number }>(
      "SELECT status, attempt_count FROM skill_registry.eventing_outbox WHERE id = $1",
      [envelope.event_id],
    );
    expect(persisted.rows).toEqual([{ status: "sent", attempt_count: 1 }]);
    await secondProcess.close();
  });
});
