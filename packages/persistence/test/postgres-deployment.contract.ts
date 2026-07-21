import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";

import {
  defineOwnerRepositoryContractV1,
  openVerifiedOwnerPostgresCompositionV1,
  ownerFunctionSignatureV1,
  verifyOwnerRepositoryDeploymentFromPostgresV1,
} from "../src/index.js";

const databaseUrl = process.env.PAI_TEST_DATABASE_URL;

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
  tables: ["contract_parents", "contract_children", "contract_audits"],
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
  ],
  mutable_writers: ["write_contract_child_v1"],
  function_signatures: [
    ownerFunctionSignatureV1({
      schema: "timer",
      function_name: "write_contract_child_v1",
      primary_table: "contract_children",
      writer_kind: "state_transition",
      arguments: [
        ["p_parent_key", "text"],
        ["p_expected_parent_version", "bigint"],
        ["p_child_id", "text"],
        ["p_payload", "jsonb"],
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
    }),
  ],
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
  append_only_tables: ["contract_audits"],
  outbox_tables: [],
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
ALTER ROLE pai_timer_app NOLOGIN INHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
ALTER ROLE pai_timer_runtime LOGIN INHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD 'timer-runtime-test';
REVOKE pai_timer_app FROM pai_timer_runtime;
REVOKE pai_runtime_bridge FROM pai_timer_runtime;
REVOKE pai_memory_app FROM pai_timer_runtime;
GRANT pai_timer_app TO pai_timer_runtime;
DROP SCHEMA IF EXISTS timer CASCADE;
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
DECLARE
  current_version bigint;
  next_version bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_parent_key, 0));
  SELECT parent_version INTO current_version
    FROM timer.contract_parents WHERE parent_key = p_parent_key
    ORDER BY parent_version DESC LIMIT 1 FOR UPDATE;
  current_version := COALESCE(current_version, 0);
  IF current_version <> p_expected_parent_version THEN
    RAISE EXCEPTION 'stale parent version';
  END IF;
  next_version := current_version + 1;
  INSERT INTO timer.contract_parents(parent_key, parent_version)
    VALUES (p_parent_key, next_version);
  INSERT INTO timer.contract_children(child_id, parent_key, parent_version, payload)
    VALUES (p_child_id, p_parent_key, next_version, p_payload);
  INSERT INTO timer.contract_audits(audit_id, child_id, created_at)
    VALUES ('audit-' || p_child_id, p_child_id, clock_timestamp());
  IF p_payload ? 'force_failure' THEN
    RAISE EXCEPTION 'forced writer failure';
  END IF;
  RETURN jsonb_build_object('parent_version', next_version, 'child_id', p_child_id);
END;
$$;
RESET ROLE;
REVOKE ALL ON ALL TABLES IN SCHEMA timer FROM PUBLIC, anon, authenticated, pai_timer_app, pai_timer_runtime, pai_runtime_bridge, pai_memory_app;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA timer FROM PUBLIC, anon, authenticated, pai_timer_app, pai_timer_runtime, pai_runtime_bridge, pai_memory_app;
GRANT SELECT (parent_key, parent_version) ON timer.contract_parents TO pai_timer_app;
GRANT SELECT (child_id, parent_key, parent_version, payload) ON timer.contract_children TO pai_timer_app;
GRANT SELECT (audit_id, child_id, created_at) ON timer.contract_audits TO pai_timer_app;
GRANT EXECUTE ON FUNCTION timer.write_contract_child_v1(text, bigint, text, jsonb) TO pai_timer_app;
`;

function replacementWriterSql(options: Readonly<{
  expectedVersionCheck?: string;
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
  BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_parent_key, 0));
    SELECT parent_version INTO current_version
      FROM timer.contract_parents WHERE parent_key = p_parent_key
      ORDER BY parent_version DESC LIMIT 1 FOR UPDATE;
    current_version := COALESCE(current_version, 0);
    IF ${options.expectedVersionCheck ?? "current_version <> p_expected_parent_version"} THEN
      RAISE EXCEPTION 'stale parent version';
    END IF;
    next_version := current_version + 1;
    INSERT INTO timer.contract_parents(parent_key, parent_version)
      VALUES (p_parent_key, next_version);
    INSERT INTO timer.contract_children(child_id, parent_key, parent_version, payload)
      VALUES (p_child_id, p_parent_key, next_version, p_payload);
    INSERT INTO timer.contract_audits(audit_id, child_id, created_at)
      VALUES ('audit-' || p_child_id, p_child_id, clock_timestamp());
    ${options.extraStatement ?? ""}
    RETURN jsonb_build_object('parent_version', next_version, 'child_id', p_child_id);
  END;
  $body$`;
}

const describePostgres = databaseUrl === undefined ? describe.skip : describe;

describePostgres("PostgreSQL owner deployment verification", () => {
  const pool = databaseUrl === undefined ? undefined : new Pool({ connectionString: databaseUrl });
  const runtimePool =
    databaseUrl === undefined
      ? undefined
      : new Pool({
          connectionString: (() => {
            const value = new URL(databaseUrl);
            value.username = "pai_timer_runtime";
            value.password = "timer-runtime-test";
            return value.toString();
          })(),
        });

  afterAll(async () => {
    await Promise.all([pool?.end(), runtimePool?.end()]);
  });

  async function reset(): Promise<Pool> {
    if (pool === undefined) throw new Error("PAI_TEST_DATABASE_URL is required");
    await pool.query(setupSql);
    return pool;
  }

  function runtime(): Pool {
    if (runtimePool === undefined) throw new Error("PAI_TEST_DATABASE_URL is required");
    return runtimePool;
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

  it.each([
    ["missing function", "DROP FUNCTION timer.write_contract_child_v1(text, bigint, text, jsonb)"],
    ["direct DML", "GRANT UPDATE ON timer.contract_children TO pai_timer_app"],
    ["PUBLIC execute", "GRANT EXECUTE ON FUNCTION timer.write_contract_child_v1(text, bigint, text, jsonb) TO PUBLIC"],
    ["wrong search_path", "ALTER FUNCTION timer.write_contract_child_v1(text, bigint, text, jsonb) SET search_path = public"],
    ["missing composite FK", "ALTER TABLE timer.contract_children DROP CONSTRAINT contract_children_parent_fk"],
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
  ])("fails closed on %s drift", async (_label, driftSql) => {
    const postgres = await reset();
    await postgres.query(driftSql);
    await expect(
      verifyOwnerRepositoryDeploymentFromPostgresV1(POSTGRES_CONTRACT, postgres, {
        expected_schema_owner: "pai_migrator",
        runtime_postgres: runtime(),
      }),
    ).rejects.toThrow(/drift|missing|forbidden|undeclared/);
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
      const staleWrite = second.query(
        `SELECT timer.write_contract_child_v1($1, $2, $3, $4::jsonb)`,
        ["parent-race", "1", `loser-${randomUUID()}`, {}],
      );
      await new Promise<void>((resolve) => setImmediate(resolve));
      await first.query("COMMIT");
      await expect(staleWrite).rejects.toThrow(/stale parent version/);
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
