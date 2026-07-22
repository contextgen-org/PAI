import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";

import {
  lintOwnerWriterDefinitionV1,
  ownerEventingReconciliationContractV1,
} from "../src/index.js";

const databaseUrl = process.env.PAI_TEST_DATABASE_URL;
const describePostgres = databaseUrl === undefined ? describe.skip : describe;
const schema = "persistence_reconciliation_test";
const outboxTable = "clock_outbox";
const reconciliation = ownerEventingReconciliationContractV1(
  schema as never,
  outboxTable,
);

const claimWriter = `claim_${outboxTable}_reconciliation_v1`;
const acknowledgePresentWriter = `ack_${outboxTable}_transport_present_v1`;
const acknowledgeRematerializedWriter = `ack_${outboxTable}_rematerialized_v1`;

const claimBody = `
DECLARE
  v_active_epoch text;
  v_active_generation bigint;
  v_database_now timestamptz;
BEGIN
  IF p_limit < 1 OR p_limit > 16 OR
     p_lease_seconds < 1 OR p_lease_seconds > 3600 THEN
    RAISE EXCEPTION 'invalid reconciliation claim bounds';
  END IF;
  SELECT active_epoch, active_generation
    INTO v_active_epoch, v_active_generation
    FROM ${schema}.eventing_transport_epochs
   WHERE transport_name = 'redis_stream'
   FOR UPDATE;
  IF v_active_epoch IS DISTINCT FROM p_current_transport_epoch OR
     v_active_generation IS DISTINCT FROM p_current_transport_generation THEN
    RAISE EXCEPTION 'stale active transport generation';
  END IF;
  v_database_now := clock_timestamp();
  RETURN QUERY
  WITH due AS (
    SELECT row.id
      FROM ${schema}.${outboxTable} AS row
     WHERE row.status = 'sent'
       AND (row.reconciliation_locked_until IS NULL OR
            row.reconciliation_locked_until <= v_database_now)
       AND (row.transport_epoch IS DISTINCT FROM p_current_transport_epoch OR
            row.transport_generation IS DISTINCT FROM p_current_transport_generation OR
            row.reconciliation_missing_at IS NOT NULL OR
            row.reconciliation_next_probe_at IS NULL OR
            row.reconciliation_next_probe_at <= v_database_now)
     ORDER BY row.reconciliation_next_probe_at NULLS FIRST, row.sent_at, row.id
     FOR UPDATE SKIP LOCKED
     LIMIT p_limit
  )
  UPDATE ${schema}.${outboxTable} AS claimed
     SET reconciliation_claimed_by = p_worker_id,
         reconciliation_claim_generation =
           claimed.reconciliation_claim_generation + 1,
         reconciliation_claim_token =
           p_worker_id || ':' || claimed.id || ':' ||
           (claimed.reconciliation_claim_generation + 1)::text,
         reconciliation_locked_until = v_database_now +
           make_interval(secs => p_lease_seconds),
         updated_at = v_database_now
    FROM due
   WHERE claimed.id = due.id
   RETURNING jsonb_build_object(
     'outbox_id', claimed.id,
     'claim_token', claimed.reconciliation_claim_token,
     'transport_ref', claimed.transport_ref,
     'transport_epoch', claimed.transport_epoch,
     'transport_generation', claimed.transport_generation
   );
END;`;

const acknowledgePresentBody = `
DECLARE
  v_active_epoch text;
  v_active_generation bigint;
  v_updated_id text;
  v_database_now timestamptz;
BEGIN
  IF p_probe_interval_ms < 1000 OR p_probe_interval_ms > 86400000 THEN
    RAISE EXCEPTION 'invalid reconciliation probe interval';
  END IF;
  SELECT active_epoch, active_generation
    INTO v_active_epoch, v_active_generation
    FROM ${schema}.eventing_transport_epochs
   WHERE transport_name = 'redis_stream'
   FOR UPDATE;
  IF v_active_epoch IS DISTINCT FROM p_current_transport_epoch OR
     v_active_generation IS DISTINCT FROM p_current_transport_generation THEN
    RAISE EXCEPTION 'stale active transport generation';
  END IF;
  v_database_now := clock_timestamp();
  UPDATE ${schema}.${outboxTable}
     SET reconciliation_next_probe_at = v_database_now +
           make_interval(secs => p_probe_interval_ms::double precision / 1000.0),
         reconciliation_missing_at = NULL,
         reconciliation_missing_reporter = NULL,
         reconciliation_claimed_by = NULL,
         reconciliation_claim_token = NULL,
         reconciliation_locked_until = NULL,
         updated_at = v_database_now
   WHERE id = p_outbox_id
     AND status = 'sent'
     AND reconciliation_claim_token = p_claim_token
     AND transport_ref IS NOT DISTINCT FROM p_previous_transport_ref
     AND transport_epoch IS NOT DISTINCT FROM p_previous_transport_epoch
     AND transport_generation IS NOT DISTINCT FROM p_previous_transport_generation
   RETURNING id INTO v_updated_id;
  IF v_updated_id IS NULL THEN
    RAISE EXCEPTION 'stale reconciliation claim';
  END IF;
  RETURN jsonb_build_object('acknowledged', true);
END;`;

const acknowledgeRematerializedBody = `
DECLARE
  v_active_epoch text;
  v_active_generation bigint;
  v_updated_id text;
  v_database_now timestamptz;
BEGIN
  IF p_probe_interval_ms < 1000 OR p_probe_interval_ms > 86400000 THEN
    RAISE EXCEPTION 'invalid reconciliation probe interval';
  END IF;
  SELECT active_epoch, active_generation
    INTO v_active_epoch, v_active_generation
    FROM ${schema}.eventing_transport_epochs
   WHERE transport_name = 'redis_stream'
   FOR UPDATE;
  IF v_active_epoch IS DISTINCT FROM p_current_transport_epoch OR
     v_active_generation IS DISTINCT FROM p_current_transport_generation OR
     v_active_epoch IS DISTINCT FROM p_transport_epoch OR
     v_active_generation IS DISTINCT FROM p_transport_generation THEN
    RAISE EXCEPTION 'stale active transport generation';
  END IF;
  v_database_now := clock_timestamp();
  UPDATE ${schema}.${outboxTable}
     SET transport_ref = p_transport_ref,
         transport_epoch = p_transport_epoch,
         transport_generation = p_transport_generation,
         reconciliation_next_probe_at = v_database_now +
           make_interval(secs => p_probe_interval_ms::double precision / 1000.0),
         reconciliation_missing_at = NULL,
         reconciliation_missing_reporter = NULL,
         reconciliation_claimed_by = NULL,
         reconciliation_claim_token = NULL,
         reconciliation_locked_until = NULL,
         updated_at = v_database_now
   WHERE id = p_outbox_id
     AND status = 'sent'
     AND reconciliation_claim_token = p_claim_token
     AND transport_ref IS NOT DISTINCT FROM p_previous_transport_ref
     AND transport_epoch IS NOT DISTINCT FROM p_previous_transport_epoch
     AND transport_generation IS NOT DISTINCT FROM p_previous_transport_generation
   RETURNING id INTO v_updated_id;
  IF v_updated_id IS NULL THEN
    RAISE EXCEPTION 'stale reconciliation claim';
  END IF;
  RETURN jsonb_build_object('acknowledged', true);
END;`;

const setupSql = `
DROP SCHEMA IF EXISTS ${schema} CASCADE;
CREATE SCHEMA ${schema};
CREATE TABLE ${schema}.eventing_transport_epochs (
  transport_name text PRIMARY KEY,
  active_epoch text NOT NULL,
  active_generation bigint NOT NULL,
  activated_at timestamptz NOT NULL
);
CREATE TABLE ${schema}.${outboxTable} (
  id text PRIMARY KEY,
  status text NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  transport_ref text,
  transport_epoch text,
  transport_generation bigint,
  sent_at timestamptz,
  updated_at timestamptz NOT NULL,
  reconciliation_missing_at timestamptz,
  reconciliation_missing_reporter text,
  reconciliation_next_probe_at timestamptz,
  reconciliation_claimed_by text,
  reconciliation_claim_token text,
  reconciliation_claim_generation bigint NOT NULL DEFAULT 0,
  reconciliation_locked_until timestamptz
);
INSERT INTO ${schema}.eventing_transport_epochs
  (transport_name, active_epoch, active_generation, activated_at)
VALUES ('redis_stream', 'epoch-current', 7, clock_timestamp());

CREATE FUNCTION ${schema}.${claimWriter}(
  p_worker_id text,
  p_limit integer,
  p_lease_seconds integer,
  p_current_transport_epoch text,
  p_current_transport_generation bigint
) RETURNS SETOF jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ${schema}, pg_temp
AS $writer$
${claimBody}
$writer$;

CREATE FUNCTION ${schema}.${acknowledgePresentWriter}(
  p_outbox_id text,
  p_claim_token text,
  p_previous_transport_ref text,
  p_previous_transport_epoch text,
  p_previous_transport_generation bigint,
  p_current_transport_epoch text,
  p_current_transport_generation bigint,
  p_probe_interval_ms integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ${schema}, pg_temp
AS $writer$
${acknowledgePresentBody}
$writer$;

CREATE FUNCTION ${schema}.${acknowledgeRematerializedWriter}(
  p_outbox_id text,
  p_claim_token text,
  p_previous_transport_ref text,
  p_previous_transport_epoch text,
  p_previous_transport_generation bigint,
  p_transport_ref text,
  p_transport_epoch text,
  p_transport_generation bigint,
  p_current_transport_epoch text,
  p_current_transport_generation bigint,
  p_probe_interval_ms integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ${schema}, pg_temp
AS $writer$
${acknowledgeRematerializedBody}
$writer$;
`;

describePostgres("PostgreSQL reconciliation clock authority", () => {
  const postgres =
    databaseUrl === undefined ? undefined : new Pool({ connectionString: databaseUrl });

  afterAll(async () => {
    if (postgres !== undefined) {
      await postgres.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await postgres.end();
    }
  });

  async function reset(): Promise<Pool> {
    if (postgres === undefined) throw new Error("PAI_TEST_DATABASE_URL is required");
    await postgres.query(setupSql);
    return postgres;
  }

  it("pins the generated claim and ACK ABI to database-owned time inputs", () => {
    const byOperation = new Map(
      reconciliation.function_signatures.map((signature) => [
        signature.effects[0]?.operation,
        signature.arguments.map(({ argument_name }) => argument_name),
      ]),
    );
    expect(byOperation.get("reconcile_claim")).toEqual([
      "p_worker_id",
      "p_limit",
      "p_lease_seconds",
      "p_current_transport_epoch",
      "p_current_transport_generation",
    ]);
    expect(byOperation.get("reconcile_ack_present")?.slice(-1)).toEqual([
      "p_probe_interval_ms",
    ]);
    expect(byOperation.get("reconcile_ack_rematerialized")?.slice(-1)).toEqual([
      "p_probe_interval_ms",
    ]);
    const bodyByOperation = new Map([
      ["reconcile_claim", claimBody],
      ["reconcile_ack_present", acknowledgePresentBody],
      ["reconcile_ack_rematerialized", acknowledgeRematerializedBody],
    ]);
    for (const signature of reconciliation.function_signatures.slice(1)) {
      const operation = signature.effects[0]?.operation;
      const body = operation === undefined ? undefined : bodyByOperation.get(operation);
      expect(operation).toBeDefined();
      expect(body).toBeDefined();
      if (body === undefined) continue;
      expect(() =>
        lintOwnerWriterDefinitionV1(
          { schema } as never,
          signature,
          `CREATE FUNCTION ${schema}.${signature.function_name}()
           RETURNS ${signature.returns}
           LANGUAGE plpgsql SECURITY DEFINER
           SET search_path = ${schema}, pg_temp
           AS $writer$
           ${body}
           $writer$`,
        ),
      ).not.toThrow();
    }
  });

  it("cannot use a future caller clock to claim a not-yet-due row", async () => {
    const db = await reset();
    const id = `future-${randomUUID()}`;
    await db.query(
      `INSERT INTO ${schema}.${outboxTable}
         (id, status, transport_ref, transport_epoch, transport_generation,
          sent_at, updated_at, reconciliation_next_probe_at)
       VALUES ($1, 'sent', 'stream:1-0', 'epoch-current', 7,
               clock_timestamp(), clock_timestamp(),
               clock_timestamp() + interval '1 hour')`,
      [id],
    );

    const notDue = await db.query<{ result: unknown }>(
      `SELECT value AS result
         FROM ${schema}.${claimWriter}($1, $2, $3, $4, $5) AS value`,
      ["worker-clock", 1, 30, "epoch-current", 7],
    );
    expect(notDue.rows).toEqual([]);
    await expect(
      db.query(
        `SELECT * FROM ${schema}.${claimWriter}($1, $2, $3, $4, $5, $6)`,
        ["worker-clock", 1, 30, "2999-01-01T00:00:00.000Z", "epoch-current", 7],
      ),
    ).rejects.toThrow(/does not exist/u);

    await db.query(
      `UPDATE ${schema}.${outboxTable}
          SET reconciliation_next_probe_at = clock_timestamp() - interval '1 second'
        WHERE id = $1`,
      [id],
    );
    const before = await db.query<{ now: Date }>(
      "SELECT clock_timestamp() AS now",
    );
    const claimed = await db.query<{ result: { claim_token: string } }>(
      `SELECT value AS result
         FROM ${schema}.${claimWriter}($1, $2, $3, $4, $5) AS value`,
      ["worker-clock", 1, 30, "epoch-current", 7],
    );
    const after = await db.query<{ now: Date }>(
      "SELECT clock_timestamp() AS now",
    );
    expect(claimed.rows).toHaveLength(1);
    const persisted = await db.query<{ locked_until: Date }>(
      `SELECT reconciliation_locked_until AS locked_until
         FROM ${schema}.${outboxTable} WHERE id = $1`,
      [id],
    );
    const lockedUntil = persisted.rows[0]?.locked_until.getTime();
    expect(lockedUntil).toBeGreaterThanOrEqual(
      (before.rows[0]?.now.getTime() ?? 0) + 30_000,
    );
    expect(lockedUntil).toBeLessThanOrEqual(
      (after.rows[0]?.now.getTime() ?? 0) + 30_000,
    );
    await expect(
      db.query(
        `SELECT * FROM ${schema}.${claimWriter}($1, $2, $3, $4, $5)`,
        ["worker-clock", 17, 30, "epoch-current", 7],
      ),
    ).rejects.toThrow(/invalid reconciliation claim bounds/u);
  });

  it("uses database time for exact ACK scheduling and rejects stale CAS", async () => {
    const db = await reset();
    const id = `ack-${randomUUID()}`;
    const claimToken = `claim-${randomUUID()}`;
    await db.query(
      `INSERT INTO ${schema}.${outboxTable}
         (id, status, transport_ref, transport_epoch, transport_generation,
          sent_at, updated_at, reconciliation_claim_token,
          reconciliation_locked_until)
       VALUES ($1, 'sent', 'stream:1-0', 'epoch-current', 7,
               clock_timestamp(), clock_timestamp(), $2,
               clock_timestamp() + interval '30 seconds')`,
      [id, claimToken],
    );

    await expect(
      db.query(
        `SELECT ${schema}.${acknowledgePresentWriter}(
          $1, $2, $3, $4, $5, $6, $7, $8, $9
        )`,
        [
          id,
          claimToken,
          "stream:1-0",
          "epoch-current",
          7,
          "epoch-current",
          7,
          "2999-01-01T00:00:00.000Z",
          "2999-01-01T00:00:00.000Z",
        ],
      ),
    ).rejects.toThrow(/does not exist/u);

    const before = await db.query<{ now: Date }>(
      "SELECT clock_timestamp() AS now",
    );
    const acknowledged = await db.query<{ result: unknown }>(
      `SELECT ${schema}.${acknowledgePresentWriter}(
         $1, $2, $3, $4, $5, $6, $7, $8
       ) AS result`,
      [
        id,
        claimToken,
        "stream:1-0",
        "epoch-current",
        7,
        "epoch-current",
        7,
        60_000,
      ],
    );
    const after = await db.query<{ now: Date }>(
      "SELECT clock_timestamp() AS now",
    );
    expect(acknowledged.rows).toEqual([{ result: { acknowledged: true } }]);
    const persisted = await db.query<{
      next_probe_at: Date;
      updated_at: Date;
      claim_token: string | null;
    }>(
      `SELECT reconciliation_next_probe_at AS next_probe_at,
              updated_at,
              reconciliation_claim_token AS claim_token
         FROM ${schema}.${outboxTable} WHERE id = $1`,
      [id],
    );
    const nextProbeAt = persisted.rows[0]?.next_probe_at.getTime();
    expect(nextProbeAt).toBeGreaterThanOrEqual(
      (before.rows[0]?.now.getTime() ?? 0) + 60_000,
    );
    expect(nextProbeAt).toBeLessThanOrEqual(
      (after.rows[0]?.now.getTime() ?? 0) + 60_000,
    );
    expect(persisted.rows[0]?.claim_token).toBeNull();
    await expect(
      db.query(
        `SELECT ${schema}.${acknowledgePresentWriter}(
           $1, $2, $3, $4, $5, $6, $7, $8
         )`,
        [
          id,
          claimToken,
          "stream:1-0",
          "epoch-current",
          7,
          "epoch-current",
          7,
          60_000,
        ],
      ),
    ).rejects.toThrow(/stale reconciliation claim/u);
  });

  it("returns the same exact confirmation after rematerialization", async () => {
    const db = await reset();
    const id = `rematerialized-${randomUUID()}`;
    const claimToken = `claim-${randomUUID()}`;
    await db.query(
      `INSERT INTO ${schema}.${outboxTable}
         (id, status, transport_ref, transport_epoch, transport_generation,
          sent_at, updated_at, reconciliation_claim_token)
       VALUES ($1, 'sent', 'stream:old-0', 'epoch-old', 6,
               clock_timestamp(), clock_timestamp(), $2)`,
      [id, claimToken],
    );
    const acknowledged = await db.query<{ result: unknown }>(
      `SELECT ${schema}.${acknowledgeRematerializedWriter}(
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
       ) AS result`,
      [
        id,
        claimToken,
        "stream:old-0",
        "epoch-old",
        6,
        "stream:new-0",
        "epoch-current",
        7,
        "epoch-current",
        7,
        60_000,
      ],
    );
    expect(acknowledged.rows).toEqual([{ result: { acknowledged: true } }]);
    const persisted = await db.query<{
      transport_ref: string;
      transport_epoch: string;
      transport_generation: string;
    }>(
      `SELECT transport_ref, transport_epoch,
              transport_generation::text AS transport_generation
         FROM ${schema}.${outboxTable} WHERE id = $1`,
      [id],
    );
    expect(persisted.rows).toEqual([
      {
        transport_ref: "stream:new-0",
        transport_epoch: "epoch-current",
        transport_generation: "7",
      },
    ]);
  });
});
