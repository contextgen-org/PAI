import { Pool } from "pg";

const TIMER_RUNTIME_ROLE = "pai_timer_runtime_test";
const TIMER_RUNTIME_PASSWORD = "timer-runtime-test";

async function quoteIdentifier(adminPool, value) {
  const result = await adminPool.query(
    "SELECT pg_catalog.quote_ident($1) AS quoted_identifier",
    [value],
  );
  return result.rows[0].quoted_identifier;
}

export async function acquireTimerRuntimeDatabaseV1(adminDatabaseUrl) {
  const adminPool = new Pool({ connectionString: adminDatabaseUrl });
  let priorAppMembers = [];
  try {
    await adminPool.query("BEGIN");
    const members = await adminPool.query(
      `SELECT member.rolname AS role_name,
              membership.admin_option,
              membership.inherit_option,
              membership.set_option
         FROM pg_catalog.pg_auth_members AS membership
         JOIN pg_catalog.pg_roles AS app_role
           ON app_role.oid = membership.roleid
         JOIN pg_catalog.pg_roles AS member
           ON member.oid = membership.member
        WHERE app_role.rolname = 'pai_timer_app'
          AND member.rolname <> $1
        ORDER BY member.rolname`,
      [TIMER_RUNTIME_ROLE],
    );
    priorAppMembers = members.rows;
    for (const { role_name: roleName } of priorAppMembers) {
      const quotedRoleName = await quoteIdentifier(adminPool, roleName);
      await adminPool.query(`REVOKE pai_timer_app FROM ${quotedRoleName}`);
    }
    await adminPool.query(`
      DO $timer_runtime$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pai_timer_runtime') THEN
          REVOKE pai_timer_app FROM pai_timer_runtime;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${TIMER_RUNTIME_ROLE}') THEN
          EXECUTE 'DROP OWNED BY ${TIMER_RUNTIME_ROLE}';
          REVOKE pai_timer_app FROM ${TIMER_RUNTIME_ROLE};
        ELSE
          CREATE ROLE ${TIMER_RUNTIME_ROLE}
            LOGIN PASSWORD '${TIMER_RUNTIME_PASSWORD}'
            INHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
        END IF;
      END
      $timer_runtime$;
      ALTER ROLE ${TIMER_RUNTIME_ROLE}
        LOGIN INHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION
        PASSWORD '${TIMER_RUNTIME_PASSWORD}';
      GRANT pai_timer_app TO ${TIMER_RUNTIME_ROLE}
        WITH INHERIT TRUE, SET FALSE, ADMIN FALSE;
    `);
    await adminPool.query("COMMIT");
  } catch (error) {
    await adminPool.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await adminPool.end();
  }

  const runtimeUrl = new URL(adminDatabaseUrl);
  runtimeUrl.username = TIMER_RUNTIME_ROLE;
  runtimeUrl.password = TIMER_RUNTIME_PASSWORD;
  return Object.freeze({
    database_url: runtimeUrl.toString(),
    async release() {
      const restorePool = new Pool({ connectionString: adminDatabaseUrl });
      try {
        await restorePool.query("BEGIN");
        await restorePool.query(`REVOKE pai_timer_app FROM ${TIMER_RUNTIME_ROLE}`);
        for (const member of priorAppMembers) {
          const quotedRoleName = await quoteIdentifier(
            restorePool,
            member.role_name,
          );
          await restorePool.query(
            `GRANT pai_timer_app TO ${quotedRoleName}
               WITH INHERIT ${member.inherit_option ? "TRUE" : "FALSE"},
                    SET ${member.set_option ? "TRUE" : "FALSE"},
                    ADMIN ${member.admin_option ? "TRUE" : "FALSE"}`,
          );
        }
        await restorePool.query("COMMIT");
      } catch (error) {
        await restorePool.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        await restorePool.end();
      }
    },
  });
}
