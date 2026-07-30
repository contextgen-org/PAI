import type { PostgresQueryPortV1 } from "@pai/persistence";

import type {
  ToolPermissionProfileCurrentOwnerRowV1,
  ToolPermissionProfileCurrentReadRepositoryV1,
} from "../tool-permission-profile-current-read.v1.js";
import type { ToolPermissionProfileSelectorV1 } from "@pai/contracts";

const TOOL_PERMISSION_PROFILE_CURRENT_READ_SQL_V1 = `
SELECT
  r.workspace_id,
  r.bot_id,
  r.owner_agent_id,
  r.deployment_environment,
  r.release_channel,
  r.profile_ref,
  r.revision,
  r.profile_hash,
  r.allowed_tools,
  r.tool_arg_constraints,
  r.resource_scopes,
  r.network_scope,
  r.filesystem_scope,
  r.timer_scope,
  r.memory_scope,
  r.policy_epoch,
  c.pointer_version,
  pg_catalog.to_char(
    r.effective_at AT TIME ZONE 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
  ) AS effective_at
FROM action_runtime.tool_permission_profile_current AS c
JOIN action_runtime.tool_permission_profile_revisions AS r
  ON r.profile_ref = c.profile_ref
 AND r.workspace_id = c.workspace_id
 AND r.bot_id = c.bot_id
 AND r.owner_agent_id = c.owner_agent_id
 AND r.deployment_environment = c.deployment_environment
 AND r.release_channel = c.release_channel
 AND r.revision = c.revision
 AND r.profile_hash = c.profile_hash
 AND r.policy_epoch = c.policy_epoch
WHERE c.workspace_id = $1::text
  AND c.bot_id = $2::text
  AND c.owner_agent_id = $3::text
  AND c.deployment_environment = $4::text
  AND c.release_channel = $5::text
LIMIT 2`;

export function createPostgresToolPermissionProfileCurrentReadRepositoryV1(
  postgres: PostgresQueryPortV1,
): ToolPermissionProfileCurrentReadRepositoryV1 {
  return Object.freeze({
    async findCurrent(
      selector: ToolPermissionProfileSelectorV1,
      signal: AbortSignal,
    ): Promise<ToolPermissionProfileCurrentOwnerRowV1 | undefined> {
      if (signal.aborted) throw signal.reason;
      const result =
        await postgres.query<ToolPermissionProfileCurrentOwnerRowV1>(
          TOOL_PERMISSION_PROFILE_CURRENT_READ_SQL_V1,
          [
            selector.workspace_id,
            selector.bot_id,
            selector.owner_agent_id,
            selector.deployment_environment,
            selector.release_channel,
          ],
        );
      if (signal.aborted) throw signal.reason;
      if (result.rows.length > 1) {
        throw new Error(
          "current ToolPermissionProfile owner identity is not unique",
        );
      }
      return result.rows[0];
    },
  });
}
