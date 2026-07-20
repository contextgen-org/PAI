import { Pool } from "pg";

import {
  verifyOwnerRepositoryDeploymentFromPostgresV1,
  type PostgresQueryPortV1,
  type VerifiedOwnerRepositoryDeploymentV1,
} from "@pai/persistence";

import { TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1 } from "./permission-manifest.v1.js";

export async function verifyTriggerProcessorPostgresCompositionV1(
  databaseUrl: string,
): Promise<VerifiedOwnerRepositoryDeploymentV1<"trigger_processor">> {
  const pool = new Pool({ connectionString: databaseUrl });
  const postgres: PostgresQueryPortV1 = {
    async query<TRow extends Record<string, unknown>>(
      sql: string,
      values: readonly unknown[] = [],
    ): Promise<{ readonly rows: readonly TRow[] }> {
      const result = await pool.query<TRow>(sql, [...values]);
      return { rows: result.rows };
    },
  };
  try {
    return await verifyOwnerRepositoryDeploymentFromPostgresV1(
      TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
      postgres,
      { expected_schema_owner: "pai_migrator" },
    );
  } finally {
    await pool.end();
  }
}
