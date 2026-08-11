import type { PostgresQueryPortV1 } from "@pai/persistence";

import type {
  TriggerConfirmationOwnerRowV1,
  TriggerConfirmationPendingReadRepositoryV1,
  TriggerConfirmationReadRepositoryV1,
} from "../application/confirmation.v1.js";

const TRIGGER_CONFIRMATION_READ_SQL_V1 = `
SELECT
  c.challenge_id,
  c.trigger_process_id,
  c.workspace_id,
  c.bot_id,
  c.owner_agent_id,
  c.deployment_environment,
  c.release_channel,
  c.intent_ref,
  c.intent_version,
  c.structured_intent_hash,
  c.policy_input_hash,
  c.action_step_ids,
  c.allowed_principal_type,
  c.allowed_principal_id,
  c.status,
  pg_catalog.to_char(c.expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS expires_at,
  c.request_hash,
  c.response_hash,
  c.confirmation_hash,
  c.stage_execute_work_id,
  work.expected_process_state_version AS stage_expected_process_state_version,
  c.idempotency_key,
  c.responded_by,
  pg_catalog.to_char(c.responded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS responded_at,
  pg_catalog.to_char(c.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_at,
  pg_catalog.to_char(c.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS updated_at
FROM trigger_processor.trigger_confirmation_challenges AS c
LEFT JOIN trigger_processor.trigger_process_work_items AS work
  ON work.id = c.stage_execute_work_id
WHERE c.challenge_id = $1::text
LIMIT 2`;

const PENDING_TRIGGER_CONFIRMATION_READ_SQL_V1 = `
SELECT
  c.challenge_id,
  c.trigger_process_id,
  c.workspace_id,
  c.bot_id,
  c.owner_agent_id,
  c.deployment_environment,
  c.release_channel,
  c.intent_ref,
  c.intent_version,
  c.structured_intent_hash,
  c.policy_input_hash,
  c.action_step_ids,
  c.allowed_principal_type,
  c.allowed_principal_id,
  c.status,
  pg_catalog.to_char(c.expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS expires_at,
  c.request_hash,
  c.response_hash,
  c.confirmation_hash,
  c.stage_execute_work_id,
  work.expected_process_state_version AS stage_expected_process_state_version,
  runtime_start.confirmation_structured_intent,
  c.idempotency_key,
  c.responded_by,
  pg_catalog.to_char(c.responded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS responded_at,
  pg_catalog.to_char(c.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_at,
  pg_catalog.to_char(c.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS updated_at
FROM trigger_processor.trigger_confirmation_challenges AS c
LEFT JOIN trigger_processor.trigger_process_work_items AS work
  ON work.id = c.stage_execute_work_id
LEFT JOIN LATERAL (
  SELECT candidate.payload #> '{request,structured_intent}'
    AS confirmation_structured_intent
  FROM trigger_processor.trigger_process_work_items AS candidate
  WHERE candidate.id = 'trigger-work:' || c.trigger_process_id || ':runtime-start:1'
    AND candidate.work_kind = 'stage_execute'
    AND candidate.payload #>> '{request,intent_ref}' = c.intent_ref
  LIMIT 1
) AS runtime_start ON TRUE
WHERE c.trigger_process_id = $1::text
  AND c.allowed_principal_type = $2::text
  AND c.allowed_principal_id = $3::text
  AND c.status = 'pending'
ORDER BY c.created_at DESC
LIMIT 2`;

export function createTriggerConfirmationReadRepositoryV1(
  postgres: PostgresQueryPortV1,
): TriggerConfirmationReadRepositoryV1 & TriggerConfirmationPendingReadRepositoryV1 {
  return Object.freeze({
    async findByChallengeId(
      challengeId: string,
      signal: AbortSignal,
    ): Promise<TriggerConfirmationOwnerRowV1 | undefined> {
      if (signal.aborted) throw signal.reason;
      const result = await postgres.query<TriggerConfirmationOwnerRowV1>(
        TRIGGER_CONFIRMATION_READ_SQL_V1,
        [challengeId],
      );
      if (signal.aborted) throw signal.reason;
      if (result.rows.length > 1) {
        throw new Error("Trigger confirmation challenge is not unique");
      }
      return result.rows[0];
    },
    async findPendingByProcessAndPrincipal(
      processId: string,
      principalType: "user" | "developer" | "operator",
      principalId: string,
      signal: AbortSignal,
    ): Promise<TriggerConfirmationOwnerRowV1 | undefined> {
      if (signal.aborted) throw signal.reason;
      const result = await postgres.query<TriggerConfirmationOwnerRowV1>(
        PENDING_TRIGGER_CONFIRMATION_READ_SQL_V1,
        [processId, principalType, principalId],
      );
      if (signal.aborted) throw signal.reason;
      if (result.rows.length > 1) {
        throw new Error("Multiple pending Trigger confirmation challenges exist");
      }
      return result.rows[0];
    },
  });
}
