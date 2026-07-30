import { randomUUID } from "node:crypto";

import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  RUNTIME_START_RESERVATION_ATTEMPT_LOCK_SQL_V1,
  RUNTIME_START_RESERVATION_PROCESS_LOCK_SQL_V1,
} from "../src/db/runtime-start-reservation-validation-repository.v1.js";

const databaseUrl = process.env.PAI_TEST_DATABASE_URL;
const describePostgres = databaseUrl === undefined ? describe.skip : describe;
const runtimeStartTransitionWriters = [
  "record_runtime_started_v1",
  "record_runtime_start_uncertain_v1",
  "schedule_runtime_start_recompose_v1",
  "enter_trigger_cooldown_v1",
  "finalize_trigger_runtime_terminal_v1",
] as const;

describePostgres("Runtime Start shared PostgreSQL lock contract", () => {
  const schema = `tp_runtime_start_${randomUUID().replaceAll("-", "_")}`;
  const pool =
    databaseUrl === undefined
      ? undefined
      : new Pool({ connectionString: databaseUrl, max: 8 });

  beforeAll(async () => {
    if (pool === undefined) throw new Error("PAI_TEST_DATABASE_URL is required");
    await pool.query(`
      CREATE SCHEMA "${schema}";
      CREATE TABLE "${schema}".reservations (
        process_id text NOT NULL,
        attempt_no bigint NOT NULL,
        status text NOT NULL,
        has_tombstone boolean NOT NULL DEFAULT false,
        last_writer text,
        PRIMARY KEY (process_id, attempt_no)
      );

      CREATE FUNCTION "${schema}".create_runtime_start_reservation_v1(
        p_process_id text,
        p_attempt_no bigint
      ) RETURNS void LANGUAGE plpgsql AS $writer$
      BEGIN
        PERFORM pg_catalog.pg_advisory_xact_lock(
          pg_catalog.hashtextextended(
            'trigger_processor:runtime_start_reservation_process:'::pg_catalog.text
              || p_process_id::pg_catalog.text,
            0
          )
        );
        PERFORM pg_catalog.pg_advisory_xact_lock(
          pg_catalog.hashtextextended(
            'trigger_processor:runtime_start_reservation:'::pg_catalog.text
              || p_process_id::pg_catalog.text
              || ':'::pg_catalog.text
              || p_attempt_no::pg_catalog.text,
            0
          )
        );
        INSERT INTO "${schema}".reservations(
          process_id,
          attempt_no,
          status,
          last_writer
        ) VALUES (
          p_process_id,
          p_attempt_no,
          'dispatching',
          'create_runtime_start_reservation_v1'
        );
      END;
      $writer$;

      ${runtimeStartTransitionWriters
        .map(
          (writerName) => `
      CREATE FUNCTION "${schema}".${writerName}(
        p_process_id text,
        p_attempt_no bigint
      ) RETURNS void LANGUAGE plpgsql AS $writer$
      BEGIN
        PERFORM pg_catalog.pg_advisory_xact_lock(
          pg_catalog.hashtextextended(
            'trigger_processor:runtime_start_reservation_process:'::pg_catalog.text
              || p_process_id::pg_catalog.text,
            0
          )
        );
        UPDATE "${schema}".reservations
           SET last_writer = '${writerName}'
         WHERE process_id = p_process_id
           AND attempt_no = p_attempt_no;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'reservation not found';
        END IF;
      END;
      $writer$;`,
        )
        .join("\n")}

      CREATE FUNCTION "${schema}".request_trigger_cancel_v1(
        p_process_id text
      ) RETURNS void LANGUAGE plpgsql AS $writer$
      BEGIN
        PERFORM pg_catalog.pg_advisory_xact_lock(
          pg_catalog.hashtextextended(
            'trigger_processor:runtime_start_reservation_process:'::pg_catalog.text
              || p_process_id::pg_catalog.text,
            0
          )
        );
        UPDATE "${schema}".reservations
           SET status = 'cancel_requested',
               has_tombstone = true,
               last_writer = 'request_trigger_cancel_v1'
         WHERE process_id = p_process_id;
      END;
      $writer$;
    `);
  });

  afterAll(async () => {
    if (pool === undefined) return;
    await pool.query(`DROP SCHEMA "${schema}" CASCADE`);
    await pool.end();
  });

  async function waitForAdvisoryBlock(pid: number): Promise<void> {
    if (pool === undefined) throw new Error("PAI_TEST_DATABASE_URL is required");
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const activity = await pool.query<{
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
        return;
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 10));
    }
    throw new Error("validator did not block on the shared advisory lock");
  }

  async function beginValidatorRead(
    processId: string,
    attemptNo: number,
  ): Promise<{
    pid: number;
    read: Promise<Readonly<{
      status: string;
      has_tombstone: boolean;
      last_writer: string | null;
    }> | null>;
    client: PoolClient;
  }> {
    if (pool === undefined) throw new Error("PAI_TEST_DATABASE_URL is required");
    const client = await pool.connect();
    await client.query("BEGIN ISOLATION LEVEL READ COMMITTED");
    const pid = await client.query<{ pid: number }>(
      "SELECT pg_catalog.pg_backend_pid() AS pid",
    );
    const read = (async () => {
      await client.query(RUNTIME_START_RESERVATION_PROCESS_LOCK_SQL_V1, [
        processId,
      ]);
      await client.query(RUNTIME_START_RESERVATION_ATTEMPT_LOCK_SQL_V1, [
        processId,
        attemptNo,
      ]);
      const result = await client.query<{
        status: string;
        has_tombstone: boolean;
        last_writer: string | null;
      }>(
        `SELECT status, has_tombstone, last_writer
           FROM "${schema}".reservations
          WHERE process_id = $1::text AND attempt_no = $2::bigint`,
        [processId, attemptNo],
      );
      return result.rows[0] ?? null;
    })();
    return { pid: pid.rows[0]!.pid, read, client };
  }

  async function commitWriterAfterValidatorBlocks(input: Readonly<{
    processId: string;
    attemptNo: number;
    writerSql: string;
    writerValues: readonly unknown[];
    expected: Readonly<{
      status: string;
      has_tombstone: boolean;
      last_writer: string | null;
    }> | null;
  }>): Promise<void> {
    if (pool === undefined) throw new Error("PAI_TEST_DATABASE_URL is required");
    const writer = await pool.connect();
    let validator: Awaited<ReturnType<typeof beginValidatorRead>> | undefined;
    try {
      await writer.query("BEGIN");
      await writer.query(input.writerSql, [...input.writerValues]);
      validator = await beginValidatorRead(input.processId, input.attemptNo);
      await waitForAdvisoryBlock(validator.pid);
      await writer.query("COMMIT");
      await expect(validator.read).resolves.toEqual(input.expected);
      await validator.client.query("COMMIT");
    } finally {
      await writer.query("ROLLBACK").catch(() => undefined);
      await validator?.client.query("ROLLBACK").catch(() => undefined);
      writer.release();
      validator?.client.release();
    }
  }

  it("blocks behind create and re-reads the committed exact reservation", async () => {
    if (pool === undefined) throw new Error("PAI_TEST_DATABASE_URL is required");
    const processId = `create-${randomUUID()}`;
    await commitWriterAfterValidatorBlocks({
      processId,
      attemptNo: 1,
      writerSql: `SELECT "${schema}".create_runtime_start_reservation_v1($1::text, $2::bigint)`,
      writerValues: [processId, 1],
      expected: {
        status: "dispatching",
        has_tombstone: false,
        last_writer: "create_runtime_start_reservation_v1",
      },
    });
  });

  it("blocks a different attempt behind create's coarse process lock", async () => {
    const processId = `create-cross-attempt-${randomUUID()}`;
    await commitWriterAfterValidatorBlocks({
      processId,
      attemptNo: 2,
      writerSql: `SELECT "${schema}".create_runtime_start_reservation_v1($1::text, $2::bigint)`,
      writerValues: [processId, 1],
      expected: null,
    });
  });

  it("blocks behind cancellation and re-reads its committed tombstone", async () => {
    if (pool === undefined) throw new Error("PAI_TEST_DATABASE_URL is required");
    const processId = `cancel-${randomUUID()}`;
    await pool.query(
      `INSERT INTO "${schema}".reservations(process_id, attempt_no, status)
       VALUES ($1::text, $2::bigint, 'reserved')`,
      [processId, 1],
    );
    await commitWriterAfterValidatorBlocks({
      processId,
      attemptNo: 1,
      writerSql: `SELECT "${schema}".request_trigger_cancel_v1($1::text)`,
      writerValues: [processId],
      expected: {
        status: "cancel_requested",
        has_tombstone: true,
        last_writer: "request_trigger_cancel_v1",
      },
    });
  });

  it.each(runtimeStartTransitionWriters)(
    "%s blocks the validator until its reservation transition commits",
    async (writerName) => {
      if (pool === undefined) {
        throw new Error("PAI_TEST_DATABASE_URL is required");
      }
      const processId = `${writerName}-${randomUUID()}`;
      await pool.query(
        `INSERT INTO "${schema}".reservations(process_id, attempt_no, status)
         VALUES ($1::text, $2::bigint, 'dispatching')`,
        [processId, 1],
      );
      await commitWriterAfterValidatorBlocks({
        processId,
        attemptNo: 1,
        writerSql: `SELECT "${schema}".${writerName}($1::text, $2::bigint)`,
        writerValues: [processId, 1],
        expected: {
          status: "dispatching",
          has_tombstone: false,
          last_writer: writerName,
        },
      });
    },
  );
});
