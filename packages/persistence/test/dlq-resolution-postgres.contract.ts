import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";

const databaseUrl =
  process.env.PAI_PERSISTENCE_TEST_DATABASE_URL ?? process.env.PAI_TEST_DATABASE_URL;
const describePostgres = databaseUrl === undefined ? describe.skip : describe;

describePostgres("PostgreSQL immutable DLQ resolution constraints", () => {
  const pool =
    databaseUrl === undefined
      ? undefined
      : new Pool({ connectionString: databaseUrl });

  afterAll(async () => {
    if (pool !== undefined) {
      await pool
        .query("DROP SCHEMA IF EXISTS persistence_dlq_contract CASCADE")
        .catch(() => undefined);
      await pool
        .query("DROP OWNED BY pai_dlq_contract_app")
        .catch(() => undefined);
      await pool.query("DROP ROLE IF EXISTS pai_dlq_contract_app").catch(() => undefined);
      await pool.end();
    }
  });

  it("fences one resolution per DLQ and denies mutation of history", async () => {
    if (pool === undefined) throw new Error("PAI_TEST_DATABASE_URL is required");
    await pool.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_roles WHERE rolname = 'pai_dlq_contract_app'
        ) THEN
          CREATE ROLE pai_dlq_contract_app NOLOGIN;
        END IF;
      END $$;
      DROP SCHEMA IF EXISTS persistence_dlq_contract CASCADE;
      CREATE SCHEMA persistence_dlq_contract;
      CREATE TABLE persistence_dlq_contract.contract_event_dlq (
        id text PRIMARY KEY,
        payload jsonb NOT NULL,
        failed_at timestamptz NOT NULL
      );
      CREATE TABLE persistence_dlq_contract.contract_event_dlq_resolutions (
        resolution_id text PRIMARY KEY,
        dlq_id text NOT NULL UNIQUE
          REFERENCES persistence_dlq_contract.contract_event_dlq(id),
        idempotency_key text NOT NULL UNIQUE,
        resolution_kind text NOT NULL,
        resolution_payload jsonb NOT NULL,
        resolved_by text NOT NULL,
        resolved_at timestamptz NOT NULL
      );
      REVOKE ALL ON SCHEMA persistence_dlq_contract FROM PUBLIC;
      REVOKE ALL ON ALL TABLES IN SCHEMA persistence_dlq_contract FROM PUBLIC;
      GRANT USAGE ON SCHEMA persistence_dlq_contract TO pai_dlq_contract_app;
      GRANT SELECT ON ALL TABLES IN SCHEMA persistence_dlq_contract
        TO pai_dlq_contract_app;
      INSERT INTO persistence_dlq_contract.contract_event_dlq
        (id, payload, failed_at)
      VALUES
        ('dlq-1', '{"event":1}'::jsonb, clock_timestamp()),
        ('dlq-2', '{"event":2}'::jsonb, clock_timestamp());
      INSERT INTO persistence_dlq_contract.contract_event_dlq_resolutions
        (resolution_id, dlq_id, idempotency_key, resolution_kind,
         resolution_payload, resolved_by, resolved_at)
      VALUES
        ('resolution-1', 'dlq-1', 'idem-1', 'redriven', '{}'::jsonb,
         'event_redriver', clock_timestamp());
    `);

    await expect(
      pool.query(`
        INSERT INTO persistence_dlq_contract.contract_event_dlq_resolutions
          (resolution_id, dlq_id, idempotency_key, resolution_kind,
           resolution_payload, resolved_by, resolved_at)
        VALUES
          ('resolution-2', 'dlq-1', 'idem-2', 'discarded', '{}'::jsonb,
           'operator', clock_timestamp())
      `),
    ).rejects.toThrow(/duplicate key/u);
    await expect(
      pool.query(`
        INSERT INTO persistence_dlq_contract.contract_event_dlq_resolutions
          (resolution_id, dlq_id, idempotency_key, resolution_kind,
           resolution_payload, resolved_by, resolved_at)
        VALUES
          ('resolution-3', 'dlq-2', 'idem-1', 'redriven', '{}'::jsonb,
           'event_redriver', clock_timestamp())
      `),
    ).rejects.toThrow(/duplicate key/u);
    await expect(
      pool.query(`
        INSERT INTO persistence_dlq_contract.contract_event_dlq_resolutions
          (resolution_id, dlq_id, idempotency_key, resolution_kind,
           resolution_payload, resolved_by, resolved_at)
        VALUES
          ('resolution-4', 'missing', 'idem-4', 'redriven', '{}'::jsonb,
           'event_redriver', clock_timestamp())
      `),
    ).rejects.toThrow(/foreign key/u);

    const runtime = await pool.connect();
    try {
      await runtime.query("SET ROLE pai_dlq_contract_app");
      await expect(
        runtime.query(`
          UPDATE persistence_dlq_contract.contract_event_dlq
             SET payload = '{}'::jsonb
           WHERE id = 'dlq-1'
        `),
      ).rejects.toThrow(/permission denied/u);
    } finally {
      await runtime.query("RESET ROLE").catch(() => undefined);
      runtime.release();
    }

    const facts = await pool.query<{
      dlq_id: string;
      resolutions: string;
    }>(`
      SELECT dlq.id AS dlq_id, count(resolution.resolution_id)::text AS resolutions
        FROM persistence_dlq_contract.contract_event_dlq AS dlq
        LEFT JOIN persistence_dlq_contract.contract_event_dlq_resolutions AS resolution
          ON resolution.dlq_id = dlq.id
       GROUP BY dlq.id
       ORDER BY dlq.id
    `);
    expect(facts.rows).toEqual([
      { dlq_id: "dlq-1", resolutions: "1" },
      { dlq_id: "dlq-2", resolutions: "0" },
    ]);
  });
});
