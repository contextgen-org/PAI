import type { PostgresQueryPortV1 } from "@pai/persistence";

import type { ContextSnapshotCanonicalReferenceRepositoryV1 } from "../application/context-snapshot-resolver.v1.js";

interface CanonicalReferenceRowV1 extends Record<string, unknown> {
  readonly is_canonical: boolean;
}

export function createContextSnapshotCanonicalReferenceRepositoryV1(
  postgres: PostgresQueryPortV1,
): ContextSnapshotCanonicalReferenceRepositoryV1 {
  return Object.freeze({
    async isCanonicalReference(
      request: Parameters<
        ContextSnapshotCanonicalReferenceRepositoryV1["isCanonicalReference"]
      >[0],
    ) {
      const result = await postgres.query<CanonicalReferenceRowV1>(
        `SELECT EXISTS (
           SELECT 1
           FROM trigger_processor.trigger_processes AS p
           WHERE p.id = $1::text
             AND p.workspace_id = $2::text
             AND p.bot_id = $3::text
             AND p.owner_agent_id = $4::text
             AND p.deployment_environment = $5::text
             AND p.release_channel = $6::text
             AND (
               p.context_snapshot_ref = $7::text
               OR EXISTS (
                 SELECT 1
                 FROM trigger_processor.trigger_process_snapshots AS s
                 WHERE s.trigger_process_id = p.id
                   AND s.workspace_id = p.workspace_id
                   AND s.bot_id = p.bot_id
                   AND s.owner_agent_id = p.owner_agent_id
                   AND s.deployment_environment = p.deployment_environment
                   AND s.release_channel = p.release_channel
                   AND s.context_snapshot_ref = $7::text
                   AND s.status IN ('current', 'superseded')
               )
             )
         ) AS is_canonical`,
        [
          request.trigger_process_id,
          request.workspace_id,
          request.bot_id,
          request.owner_agent_id,
          request.deployment_environment,
          request.release_channel,
          request.context_snapshot_ref,
        ],
      );
      if (
        result.rows.length !== 1 ||
        typeof result.rows[0]?.is_canonical !== "boolean"
      ) {
        throw new Error("Context snapshot canonical reference query is invalid");
      }
      return result.rows[0].is_canonical;
    },
  });
}
