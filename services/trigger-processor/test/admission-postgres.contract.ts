import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.PAI_TEST_DATABASE_URL;
const describePostgres = databaseUrl === undefined ? describe.skip : describe;

describePostgres("Trigger admission PostgreSQL concurrency contract", () => {
  const schema = `tp_admission_${randomUUID().replaceAll("-", "_")}`;
  const pool = databaseUrl === undefined ? undefined : new Pool({
    connectionString: databaseUrl,
    max: 32,
  });

  beforeAll(async () => {
    if (pool === undefined) throw new Error("PAI_TEST_DATABASE_URL is required");
    await pool.query(`
      CREATE SCHEMA "${schema}";
      CREATE TABLE "${schema}".triggers (
        dedupe_key text PRIMARY KEY,
        request_hash text NOT NULL,
        trigger_id text NOT NULL UNIQUE,
        trace_id text NOT NULL
      );
      CREATE TABLE "${schema}".trigger_processes (
        process_id text PRIMARY KEY,
        trigger_id text NOT NULL UNIQUE
          REFERENCES "${schema}".triggers(trigger_id)
      );
      CREATE TABLE "${schema}".trigger_event_outbox (
        outbox_id text PRIMARY KEY,
        trigger_id text NOT NULL UNIQUE
          REFERENCES "${schema}".triggers(trigger_id)
      );
      CREATE FUNCTION "${schema}".create_trigger_admission_v1(
        p_dedupe_key text,
        p_request_hash text,
        p_trigger_id text,
        p_process_id text,
        p_trace_id text
      ) RETURNS jsonb
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = "${schema}", pg_temp
      AS $function$
      DECLARE
        inserted_count integer := 0;
        canonical_trigger_id text;
        canonical_process_id text;
        canonical_hash text;
      BEGIN
        INSERT INTO triggers(dedupe_key, request_hash, trigger_id, trace_id)
        VALUES (p_dedupe_key, p_request_hash, p_trigger_id, p_trace_id)
        ON CONFLICT (dedupe_key) DO NOTHING;
        GET DIAGNOSTICS inserted_count = ROW_COUNT;

        SELECT trigger_id, request_hash
          INTO canonical_trigger_id, canonical_hash
          FROM triggers
         WHERE dedupe_key = p_dedupe_key
         FOR UPDATE;

        IF canonical_hash <> p_request_hash THEN
          RETURN jsonb_build_object(
            'code', 'idempotency_conflict',
            'trigger_id', canonical_trigger_id
          );
        END IF;

        IF inserted_count = 1 THEN
          INSERT INTO trigger_processes(process_id, trigger_id)
          VALUES (p_process_id, canonical_trigger_id);
          INSERT INTO trigger_event_outbox(outbox_id, trigger_id)
          VALUES ('outbox:' || canonical_trigger_id, canonical_trigger_id);
        END IF;

        SELECT process_id INTO canonical_process_id
          FROM trigger_processes
         WHERE trigger_id = canonical_trigger_id;
        RETURN jsonb_build_object(
          'code', CASE WHEN inserted_count = 1 THEN 'trigger_accepted' ELSE 'duplicate_replayed' END,
          'trigger_id', canonical_trigger_id,
          'trigger_process_id', canonical_process_id,
          'duplicate_replayed', inserted_count = 0
        );
      END
      $function$;
    `);
  });

  afterAll(async () => {
    if (pool === undefined) return;
    await pool.query(`DROP SCHEMA "${schema}" CASCADE`);
    await pool.end();
  });

  it("turns 100 concurrent identical submissions into one canonical process and outbox fact", async () => {
    if (pool === undefined) throw new Error("PAI_TEST_DATABASE_URL is required");
    const responses = await Promise.all(
      Array.from({ length: 100 }, async (_value, index) => {
        const result = await pool.query<{ result: Readonly<Record<string, unknown>> }>(
          `SELECT "${schema}".create_trigger_admission_v1($1, $2, $3, $4, $5) AS result`,
          [
            "chat:message-100",
            "sha256:same-request",
            `trigger-${index}`,
            `process-${index}`,
            `trace-${index}`,
          ],
        );
        return result.rows[0]!.result;
      }),
    );
    expect(responses.filter(({ code }) => code === "trigger_accepted")).toHaveLength(1);
    expect(responses.filter(({ code }) => code === "duplicate_replayed")).toHaveLength(99);
    expect(new Set(responses.map(({ trigger_id }) => trigger_id)).size).toBe(1);
    expect(new Set(responses.map(({ trigger_process_id }) => trigger_process_id)).size).toBe(1);
    const counts = await pool.query<{ triggers: string; processes: string; outbox: string }>(
      `SELECT
         (SELECT count(*)::text FROM "${schema}".triggers) AS triggers,
         (SELECT count(*)::text FROM "${schema}".trigger_processes) AS processes,
         (SELECT count(*)::text FROM "${schema}".trigger_event_outbox) AS outbox`,
    );
    expect(counts.rows).toEqual([{ triggers: "1", processes: "1", outbox: "1" }]);
  });

  it("rejects same-key body drift and rolls all owner facts back together", async () => {
    if (pool === undefined) throw new Error("PAI_TEST_DATABASE_URL is required");
    const conflict = await pool.query<{ result: Readonly<Record<string, unknown>> }>(
      `SELECT "${schema}".create_trigger_admission_v1($1, $2, $3, $4, $5) AS result`,
      ["chat:message-100", "sha256:drifted", "attacker-trigger", "attacker-process", "trace-drift"],
    );
    expect(conflict.rows[0]!.result).toMatchObject({ code: "idempotency_conflict" });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `SELECT "${schema}".create_trigger_admission_v1($1, $2, $3, $4, $5)`,
        ["chat:rollback", "sha256:rollback", "rollback-trigger", "rollback-process", "trace-rollback"],
      );
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
    const counts = await pool.query<{ triggers: string; processes: string; outbox: string }>(
      `SELECT
         (SELECT count(*)::text FROM "${schema}".triggers) AS triggers,
         (SELECT count(*)::text FROM "${schema}".trigger_processes) AS processes,
         (SELECT count(*)::text FROM "${schema}".trigger_event_outbox) AS outbox`,
    );
    expect(counts.rows).toEqual([{ triggers: "1", processes: "1", outbox: "1" }]);
  });
});
