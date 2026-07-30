// Generated from a fresh revision-pinned pai-infra PostgreSQL catalog. Do not edit.
export const MEMORY_DATABASE_COLUMNS_V1 = [
  {
    "table_name": "eventing_transport_epochs",
    "column_name": "transport_name",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "eventing_transport_epochs",
    "column_name": "active_epoch",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "eventing_transport_epochs",
    "column_name": "active_generation",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "eventing_transport_epochs",
    "column_name": "activated_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_audit_logs",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_audit_logs",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_audit_logs",
    "column_name": "revision_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_audit_logs",
    "column_name": "feedback_event_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_audit_logs",
    "column_name": "target_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_audit_logs",
    "column_name": "target_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_audit_logs",
    "column_name": "actor_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_audit_logs",
    "column_name": "action",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_audit_logs",
    "column_name": "reason_code",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_audit_logs",
    "column_name": "capability_snapshot",
    "not_null": true,
    "default_expression": "'{}'::jsonb",
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "memory_audit_logs",
    "column_name": "payload",
    "not_null": true,
    "default_expression": "'{}'::jsonb",
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "memory_audit_logs",
    "column_name": "trace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_audit_logs",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_command_dlq",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_command_dlq",
    "column_name": "command_outbox_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_command_dlq",
    "column_name": "payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "memory_command_dlq",
    "column_name": "payload_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_command_dlq",
    "column_name": "last_error",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "memory_command_dlq",
    "column_name": "failed_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_command_dlq_resolutions",
    "column_name": "resolution_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_command_dlq_resolutions",
    "column_name": "dlq_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_command_dlq_resolutions",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_command_dlq_resolutions",
    "column_name": "resolution_kind",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_command_dlq_resolutions",
    "column_name": "resolution_payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "memory_command_dlq_resolutions",
    "column_name": "resolved_by",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_command_dlq_resolutions",
    "column_name": "resolved_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_command_outbox",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_command_outbox",
    "column_name": "command_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_command_outbox",
    "column_name": "contract_name",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_command_outbox",
    "column_name": "source_service",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_command_outbox",
    "column_name": "source_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_command_outbox",
    "column_name": "workspace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_command_outbox",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_command_outbox",
    "column_name": "owner_agent_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_command_outbox",
    "column_name": "deployment_environment",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_command_outbox",
    "column_name": "release_channel",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_command_outbox",
    "column_name": "dedupe_scope_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_command_outbox",
    "column_name": "request_payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "memory_command_outbox",
    "column_name": "request_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_command_outbox",
    "column_name": "trace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_command_outbox",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_command_outbox",
    "column_name": "attempt_count",
    "not_null": true,
    "default_expression": "0",
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "memory_command_outbox",
    "column_name": "next_retry_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_command_outbox",
    "column_name": "last_error",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "memory_command_outbox",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_command_outbox",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_command_outbox",
    "column_name": "claimed_by",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_command_outbox",
    "column_name": "claim_token",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_command_outbox",
    "column_name": "acknowledged_claim_token",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_command_outbox",
    "column_name": "locked_until",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_command_outbox",
    "column_name": "transport_ref",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_command_outbox",
    "column_name": "transport_epoch",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_command_outbox",
    "column_name": "transport_generation",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "memory_command_outbox",
    "column_name": "sent_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_conflicts",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_conflicts",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_conflicts",
    "column_name": "series_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_conflicts",
    "column_name": "conflict_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_conflicts",
    "column_name": "conflict_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_conflicts",
    "column_name": "left_memory_point_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_conflicts",
    "column_name": "right_memory_point_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_conflicts",
    "column_name": "confidence_delta",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "double precision"
  },
  {
    "table_name": "memory_conflicts",
    "column_name": "evidence_refs",
    "not_null": true,
    "default_expression": "'{}'::text[]",
    "identity": "",
    "generated": "",
    "postgres_type": "text[]"
  },
  {
    "table_name": "memory_conflicts",
    "column_name": "conflict_payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "memory_conflicts",
    "column_name": "proposed_resolution",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "memory_conflicts",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_conflicts",
    "column_name": "state_version",
    "not_null": true,
    "default_expression": "1",
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "memory_conflicts",
    "column_name": "resolution",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "memory_conflicts",
    "column_name": "payload_schema_version",
    "not_null": true,
    "default_expression": "'memory_conflict.v1'::text",
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_conflicts",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_conflicts",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_conflicts",
    "column_name": "conflict_domain",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_conflicts",
    "column_name": "source_priority_policy_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_embedding_profiles",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_embedding_profiles",
    "column_name": "model_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_embedding_profiles",
    "column_name": "model_revision",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_embedding_profiles",
    "column_name": "dimensions",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "memory_embedding_profiles",
    "column_name": "normalized",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "boolean"
  },
  {
    "table_name": "memory_embedding_profiles",
    "column_name": "distance_metric",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_embedding_profiles",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_event_dlq",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_event_dlq",
    "column_name": "source_event_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_event_dlq",
    "column_name": "event_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_event_dlq",
    "column_name": "payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "memory_event_dlq",
    "column_name": "last_error",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "memory_event_dlq",
    "column_name": "failed_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_event_dlq_resolutions",
    "column_name": "resolution_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_event_dlq_resolutions",
    "column_name": "dlq_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_event_dlq_resolutions",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_event_dlq_resolutions",
    "column_name": "resolution_kind",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_event_dlq_resolutions",
    "column_name": "resolution_payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "memory_event_dlq_resolutions",
    "column_name": "resolved_by",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_event_dlq_resolutions",
    "column_name": "resolved_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_event_inbox",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_event_inbox",
    "column_name": "source",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_event_inbox",
    "column_name": "event_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_event_inbox",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_event_inbox",
    "column_name": "payload_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_event_inbox",
    "column_name": "semantic_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_event_inbox",
    "column_name": "scope_fingerprint",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_event_inbox",
    "column_name": "processed_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_event_inbox",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_event_outbox",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_event_outbox",
    "column_name": "event_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_event_outbox",
    "column_name": "schema_version",
    "not_null": true,
    "default_expression": "'memory.event.v1'::text",
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_event_outbox",
    "column_name": "producer",
    "not_null": true,
    "default_expression": "'memory'::text",
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_event_outbox",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_event_outbox",
    "column_name": "aggregate_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_event_outbox",
    "column_name": "aggregate_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_event_outbox",
    "column_name": "aggregate_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "memory_event_outbox",
    "column_name": "occurred_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_event_outbox",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_event_outbox",
    "column_name": "trace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_event_outbox",
    "column_name": "target",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_event_outbox",
    "column_name": "payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "memory_event_outbox",
    "column_name": "payload_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_event_outbox",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_event_outbox",
    "column_name": "attempt_count",
    "not_null": true,
    "default_expression": "0",
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "memory_event_outbox",
    "column_name": "next_retry_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_event_outbox",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_event_outbox",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_event_outbox",
    "column_name": "claimed_by",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_event_outbox",
    "column_name": "claim_token",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_event_outbox",
    "column_name": "acknowledged_claim_token",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_event_outbox",
    "column_name": "locked_until",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_event_outbox",
    "column_name": "last_error",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "memory_event_outbox",
    "column_name": "transport_ref",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_event_outbox",
    "column_name": "transport_epoch",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_event_outbox",
    "column_name": "transport_generation",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "memory_event_outbox",
    "column_name": "sent_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_event_outbox",
    "column_name": "reconciliation_missing_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_event_outbox",
    "column_name": "reconciliation_missing_reporter",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_event_outbox",
    "column_name": "reconciliation_next_probe_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_event_outbox",
    "column_name": "reconciliation_claimed_by",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_event_outbox",
    "column_name": "reconciliation_claim_token",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_event_outbox",
    "column_name": "reconciliation_claim_generation",
    "not_null": false,
    "default_expression": "0",
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "memory_event_outbox",
    "column_name": "reconciliation_locked_until",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_feedback_audit_refs",
    "column_name": "feedback_event_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_feedback_audit_refs",
    "column_name": "audit_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_feedback_event_refs",
    "column_name": "feedback_event_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_feedback_event_refs",
    "column_name": "event_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_feedback_events",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_feedback_events",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_feedback_events",
    "column_name": "target_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_feedback_events",
    "column_name": "target_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_feedback_events",
    "column_name": "action",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_feedback_events",
    "column_name": "expected_state_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "memory_feedback_events",
    "column_name": "resulting_state_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "memory_feedback_events",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_feedback_events",
    "column_name": "request_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_feedback_events",
    "column_name": "request_payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "memory_feedback_events",
    "column_name": "response_payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "memory_feedback_events",
    "column_name": "authenticated_actor_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_feedback_events",
    "column_name": "trace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_feedback_events",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_feedback_revision_refs",
    "column_name": "feedback_event_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_feedback_revision_refs",
    "column_name": "revision_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_graph_builds",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_graph_builds",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_graph_builds",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_graph_builds",
    "column_name": "request_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_graph_builds",
    "column_name": "graph_profile_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_graph_builds",
    "column_name": "graph_revision",
    "not_null": true,
    "default_expression": "1",
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "memory_graph_builds",
    "column_name": "response_payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "memory_graph_builds",
    "column_name": "expires_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_graph_builds",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_integration_change_receipts",
    "column_name": "change_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_integration_change_receipts",
    "column_name": "integration_job_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_integration_change_receipts",
    "column_name": "lease_generation",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "memory_integration_change_receipts",
    "column_name": "change_kind",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_integration_change_receipts",
    "column_name": "target_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_integration_change_receipts",
    "column_name": "target_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_integration_change_receipts",
    "column_name": "request_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_integration_change_receipts",
    "column_name": "result_payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "memory_integration_change_receipts",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_integration_job_leases",
    "column_name": "integration_job_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_integration_job_leases",
    "column_name": "lease_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_integration_job_leases",
    "column_name": "lease_generation",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "memory_integration_job_leases",
    "column_name": "owner_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_integration_job_leases",
    "column_name": "lease_expires_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_integration_job_leases",
    "column_name": "heartbeat_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_integration_job_leases",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_integration_job_leases",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_integration_jobs",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_integration_jobs",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_integration_jobs",
    "column_name": "mode",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_integration_jobs",
    "column_name": "scope",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "memory_integration_jobs",
    "column_name": "dry_run",
    "not_null": true,
    "default_expression": "false",
    "identity": "",
    "generated": "",
    "postgres_type": "boolean"
  },
  {
    "table_name": "memory_integration_jobs",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_integration_jobs",
    "column_name": "request_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_integration_jobs",
    "column_name": "expected_policy_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_integration_jobs",
    "column_name": "state_version",
    "not_null": true,
    "default_expression": "1",
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "memory_integration_jobs",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_integration_jobs",
    "column_name": "checkpoint_ref",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_integration_jobs",
    "column_name": "result_payload",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "memory_integration_jobs",
    "column_name": "error",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "memory_integration_jobs",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_integration_jobs",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_linkage_operations",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_linkage_operations",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_linkage_operations",
    "column_name": "source_kind",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_linkage_operations",
    "column_name": "source_service",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_linkage_operations",
    "column_name": "actor_principal",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_linkage_operations",
    "column_name": "actor_role",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_linkage_operations",
    "column_name": "source_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_linkage_operations",
    "column_name": "source_fact_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_linkage_operations",
    "column_name": "source_linkage_check_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_linkage_operations",
    "column_name": "source_memory_point_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_linkage_operations",
    "column_name": "affected_query",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "memory_linkage_operations",
    "column_name": "linked_memory_point_ids",
    "not_null": true,
    "default_expression": "'{}'::text[]",
    "identity": "",
    "generated": "",
    "postgres_type": "text[]"
  },
  {
    "table_name": "memory_linkage_operations",
    "column_name": "relationship_edge_changes",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "memory_linkage_operations",
    "column_name": "operation",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_linkage_operations",
    "column_name": "historical_payload",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "memory_linkage_operations",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_linkage_operations",
    "column_name": "attempt_count",
    "not_null": true,
    "default_expression": "0",
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "memory_linkage_operations",
    "column_name": "next_retry_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_linkage_operations",
    "column_name": "locked_by",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_linkage_operations",
    "column_name": "locked_until",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_linkage_operations",
    "column_name": "last_error",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "memory_linkage_operations",
    "column_name": "reason",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_linkage_operations",
    "column_name": "evidence_refs",
    "not_null": true,
    "default_expression": "'{}'::text[]",
    "identity": "",
    "generated": "",
    "postgres_type": "text[]"
  },
  {
    "table_name": "memory_linkage_operations",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_linkage_operations",
    "column_name": "payload_schema_version",
    "not_null": true,
    "default_expression": "'memory_linkage_operation.v1'::text",
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_linkage_operations",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_linkage_operations",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_point_search_index",
    "column_name": "memory_point_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_point_search_index",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_point_search_index",
    "column_name": "series_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_point_search_index",
    "column_name": "topic_family_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_point_search_index",
    "column_name": "topic_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_point_search_index",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_point_search_index",
    "column_name": "state_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "memory_point_search_index",
    "column_name": "series_state_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "memory_point_search_index",
    "column_name": "source_revision_ids",
    "not_null": true,
    "default_expression": "'{}'::text[]",
    "identity": "",
    "generated": "",
    "postgres_type": "text[]"
  },
  {
    "table_name": "memory_point_search_index",
    "column_name": "ranking_profile_version",
    "not_null": true,
    "default_expression": "'memory.fast_recall.ranking.v1'::text",
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_point_search_index",
    "column_name": "content_summary",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_point_search_index",
    "column_name": "content_tsv",
    "not_null": false,
    "default_expression": "to_tsvector('simple'::regconfig, content_summary)",
    "identity": "",
    "generated": "stored",
    "postgres_type": "tsvector"
  },
  {
    "table_name": "memory_point_search_index",
    "column_name": "keyword_tags",
    "not_null": true,
    "default_expression": "'{}'::text[]",
    "identity": "",
    "generated": "",
    "postgres_type": "text[]"
  },
  {
    "table_name": "memory_point_search_index",
    "column_name": "scene_tags",
    "not_null": true,
    "default_expression": "'{}'::text[]",
    "identity": "",
    "generated": "",
    "postgres_type": "text[]"
  },
  {
    "table_name": "memory_point_search_index",
    "column_name": "emotion_tags",
    "not_null": true,
    "default_expression": "'{}'::text[]",
    "identity": "",
    "generated": "",
    "postgres_type": "text[]"
  },
  {
    "table_name": "memory_point_search_index",
    "column_name": "occurred_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_point_search_index",
    "column_name": "importance_score",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "double precision"
  },
  {
    "table_name": "memory_point_search_index",
    "column_name": "last_mentioned_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_point_search_index",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_point_search_index",
    "column_name": "evidence_valid_until",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_point_search_index",
    "column_name": "embedding_profile_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_point_search_index",
    "column_name": "summary_embedding",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "extensions.halfvec(2048)"
  },
  {
    "table_name": "memory_point_search_index",
    "column_name": "embedding_backfill_status",
    "not_null": true,
    "default_expression": "'pending'::text",
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_points",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_points",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_points",
    "column_name": "series_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_points",
    "column_name": "version_no",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "memory_points",
    "column_name": "content_summary",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_points",
    "column_name": "human_agent_relation",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "memory_points",
    "column_name": "keyword_tags",
    "not_null": true,
    "default_expression": "'{}'::text[]",
    "identity": "",
    "generated": "",
    "postgres_type": "text[]"
  },
  {
    "table_name": "memory_points",
    "column_name": "scene_tags",
    "not_null": true,
    "default_expression": "'{}'::text[]",
    "identity": "",
    "generated": "",
    "postgres_type": "text[]"
  },
  {
    "table_name": "memory_points",
    "column_name": "emotion_tags",
    "not_null": true,
    "default_expression": "'{}'::text[]",
    "identity": "",
    "generated": "",
    "postgres_type": "text[]"
  },
  {
    "table_name": "memory_points",
    "column_name": "source_info",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "memory_points",
    "column_name": "source_trigger_process_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_points",
    "column_name": "content_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_points",
    "column_name": "series_decision",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_points",
    "column_name": "decision_reason",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "memory_points",
    "column_name": "previous_memory_point_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_points",
    "column_name": "confidence_score",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "double precision"
  },
  {
    "table_name": "memory_points",
    "column_name": "occurred_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_points",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_points",
    "column_name": "payload_schema_version",
    "not_null": true,
    "default_expression": "'memory_point.v1'::text",
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_points",
    "column_name": "state_version",
    "not_null": true,
    "default_expression": "1",
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "memory_points",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_points",
    "column_name": "evidence_valid_until",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_points",
    "column_name": "embedding_profile_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_points",
    "column_name": "summary_embedding",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "extensions.halfvec(2048)"
  },
  {
    "table_name": "memory_points",
    "column_name": "embedding_backfill_status",
    "not_null": true,
    "default_expression": "'pending'::text",
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_pre_promotion_check_identities",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_pre_promotion_check_identities",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_pre_promotion_check_identities",
    "column_name": "candidate_fact_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_pre_promotion_check_identities",
    "column_name": "request_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_pre_promotion_check_identities",
    "column_name": "current_check_generation",
    "not_null": true,
    "default_expression": "0",
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "memory_pre_promotion_check_identities",
    "column_name": "current_check_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_pre_promotion_check_identities",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_pre_promotion_check_identities",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_pre_promotion_checks",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_pre_promotion_checks",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_pre_promotion_checks",
    "column_name": "candidate_fact_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_pre_promotion_checks",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_pre_promotion_checks",
    "column_name": "request_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_pre_promotion_checks",
    "column_name": "required_checks",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text[]"
  },
  {
    "table_name": "memory_pre_promotion_checks",
    "column_name": "point_state_snapshot",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "memory_pre_promotion_checks",
    "column_name": "overall_result",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_pre_promotion_checks",
    "column_name": "blocking_reasons",
    "not_null": true,
    "default_expression": "'{}'::text[]",
    "identity": "",
    "generated": "",
    "postgres_type": "text[]"
  },
  {
    "table_name": "memory_pre_promotion_checks",
    "column_name": "check_policy_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_pre_promotion_checks",
    "column_name": "check_token_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_pre_promotion_checks",
    "column_name": "checked_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_pre_promotion_checks",
    "column_name": "expires_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_pre_promotion_checks",
    "column_name": "response_payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "memory_pre_promotion_checks",
    "column_name": "check_generation",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "memory_pre_promotion_checks",
    "column_name": "generation_status",
    "not_null": true,
    "default_expression": "'current'::text",
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_pre_promotion_checks",
    "column_name": "superseded_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_pre_promotion_checks",
    "column_name": "superseded_reason",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_promotion_reservation_targets",
    "column_name": "reservation_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_promotion_reservation_targets",
    "column_name": "aggregate_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_promotion_reservation_targets",
    "column_name": "aggregate_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_promotion_reservation_targets",
    "column_name": "expected_state_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "memory_promotion_reservation_targets",
    "column_name": "expected_state_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_promotion_reservations",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_promotion_reservations",
    "column_name": "check_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_promotion_reservations",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_promotion_reservations",
    "column_name": "candidate_fact_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_promotion_reservations",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_promotion_reservations",
    "column_name": "request_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_promotion_reservations",
    "column_name": "fencing_generation",
    "not_null": true,
    "default_expression": null,
    "identity": "always",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "memory_promotion_reservations",
    "column_name": "reservation_token_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_promotion_reservations",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_promotion_reservations",
    "column_name": "expires_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_promotion_reservations",
    "column_name": "committed_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_promotion_reservations",
    "column_name": "promotion_revision_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_promotion_reservations",
    "column_name": "ack_payload",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "memory_promotion_reservations",
    "column_name": "release_reason",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_promotion_reservations",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_promotion_reservations",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_promotion_reservations",
    "column_name": "check_generation",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "memory_series",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_series",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_series",
    "column_name": "topic_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_series",
    "column_name": "topic_family_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_series",
    "column_name": "subject_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_series",
    "column_name": "aspect_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_series",
    "column_name": "scope_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_series",
    "column_name": "merged_into_series_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_series",
    "column_name": "title",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_series",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_series",
    "column_name": "current_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "memory_series",
    "column_name": "state_version",
    "not_null": true,
    "default_expression": "1",
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "memory_series",
    "column_name": "canonicalization_version",
    "not_null": true,
    "default_expression": "'memory.topic_key.v1'::text",
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_series",
    "column_name": "topic_components_raw",
    "not_null": true,
    "default_expression": "'{}'::jsonb",
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "memory_series",
    "column_name": "topic_components_normalized",
    "not_null": true,
    "default_expression": "'{}'::jsonb",
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "memory_series",
    "column_name": "importance_score",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "double precision"
  },
  {
    "table_name": "memory_series",
    "column_name": "last_recalled_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_series",
    "column_name": "last_mentioned_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_series",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_series",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_state_revisions",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_state_revisions",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_state_revisions",
    "column_name": "aggregate_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_state_revisions",
    "column_name": "aggregate_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_state_revisions",
    "column_name": "previous_state_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "memory_state_revisions",
    "column_name": "resulting_state_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "memory_state_revisions",
    "column_name": "operation",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_state_revisions",
    "column_name": "before_payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "memory_state_revisions",
    "column_name": "after_payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "memory_state_revisions",
    "column_name": "actor_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_state_revisions",
    "column_name": "reason",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_state_revisions",
    "column_name": "evidence_refs",
    "not_null": true,
    "default_expression": "'[]'::jsonb",
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "memory_state_revisions",
    "column_name": "trace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_state_revisions",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_write_batches",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_write_batches",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_write_batches",
    "column_name": "trigger_process_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_write_batches",
    "column_name": "source_meta_job_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_write_batches",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_write_batches",
    "column_name": "request_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_write_batches",
    "column_name": "trace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_write_batches",
    "column_name": "request_payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "memory_write_batches",
    "column_name": "response_payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "memory_write_batches",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_write_batches",
    "column_name": "payload_schema_version",
    "not_null": true,
    "default_expression": "'memory.write_batch.v1'::text",
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_write_batches",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_write_batches",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "memory_write_item_decisions",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_write_item_decisions",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_write_item_decisions",
    "column_name": "batch_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_write_item_decisions",
    "column_name": "client_item_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_write_item_decisions",
    "column_name": "source_item_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_write_item_decisions",
    "column_name": "source_trigger_process_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_write_item_decisions",
    "column_name": "content_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_write_item_decisions",
    "column_name": "decision",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_write_item_decisions",
    "column_name": "target_series_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_write_item_decisions",
    "column_name": "target_memory_point_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_write_item_decisions",
    "column_name": "conflict_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "memory_write_item_decisions",
    "column_name": "candidate_refs",
    "not_null": true,
    "default_expression": "'[]'::jsonb",
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "memory_write_item_decisions",
    "column_name": "decision_reason",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "memory_write_item_decisions",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "relationship_edges",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "relationship_edges",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "relationship_edges",
    "column_name": "subject_role_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "relationship_edges",
    "column_name": "object_role_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "relationship_edges",
    "column_name": "relation_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "relationship_edges",
    "column_name": "confidence",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "double precision"
  },
  {
    "table_name": "relationship_edges",
    "column_name": "evidence_memory_point_ids",
    "not_null": true,
    "default_expression": "'{}'::text[]",
    "identity": "",
    "generated": "",
    "postgres_type": "text[]"
  },
  {
    "table_name": "relationship_edges",
    "column_name": "valid_from",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "relationship_edges",
    "column_name": "valid_until",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "relationship_edges",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "relationship_edges",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "role_memories",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "role_memories",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "role_memories",
    "column_name": "role_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "role_memories",
    "column_name": "role_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "role_memories",
    "column_name": "display_name",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "role_memories",
    "column_name": "attributes",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "role_memories",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "role_memories",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "topic_family_key_aliases",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "topic_family_key_aliases",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "topic_family_key_aliases",
    "column_name": "old_canonicalization_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "topic_family_key_aliases",
    "column_name": "old_topic_family_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "topic_family_key_aliases",
    "column_name": "new_canonicalization_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "topic_family_key_aliases",
    "column_name": "new_topic_family_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "topic_family_key_aliases",
    "column_name": "actor_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "topic_family_key_aliases",
    "column_name": "reason",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "topic_family_key_aliases",
    "column_name": "evidence_refs",
    "not_null": true,
    "default_expression": "'{}'::text[]",
    "identity": "",
    "generated": "",
    "postgres_type": "text[]"
  },
  {
    "table_name": "topic_family_key_aliases",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "topic_key_aliases",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "topic_key_aliases",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "topic_key_aliases",
    "column_name": "old_canonicalization_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "topic_key_aliases",
    "column_name": "old_topic_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "topic_key_aliases",
    "column_name": "new_canonicalization_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "topic_key_aliases",
    "column_name": "new_topic_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "topic_key_aliases",
    "column_name": "actor_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "topic_key_aliases",
    "column_name": "reason",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "topic_key_aliases",
    "column_name": "evidence_refs",
    "not_null": true,
    "default_expression": "'[]'::jsonb",
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "topic_key_aliases",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  }
] as const;

export const MEMORY_DATABASE_CHECKS_V1 = [
  {
    "constraint_name": "eventing_transport_epochs_active_epoch_check",
    "table_name": "eventing_transport_epochs",
    "required_definition_fragments": [
      "CHECK (length(active_epoch) >= 1 AND length(active_epoch) <= 512)"
    ]
  },
  {
    "constraint_name": "eventing_transport_epochs_active_generation_safe_check",
    "table_name": "eventing_transport_epochs",
    "required_definition_fragments": [
      "CHECK (active_generation >= 1 AND active_generation <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "integer_range",
      "column_name": "active_generation",
      "min": 1,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "memory_command_dlq_resolutions_resolution_payload_check",
    "table_name": "memory_command_dlq_resolutions",
    "required_definition_fragments": [
      "CHECK (jsonb_typeof(resolution_payload) = 'object'::text)"
    ]
  },
  {
    "constraint_name": "memory_command_outbox_ack_fence_check",
    "table_name": "memory_command_outbox",
    "required_definition_fragments": [
      "CHECK ((status = 'sent'::text) = (acknowledged_claim_token IS NOT NULL))"
    ]
  },
  {
    "constraint_name": "memory_command_outbox_attempt_count_check",
    "table_name": "memory_command_outbox",
    "required_definition_fragments": [
      "CHECK (attempt_count >= 0)"
    ]
  },
  {
    "constraint_name": "memory_command_outbox_claim_fence_check",
    "table_name": "memory_command_outbox",
    "required_definition_fragments": [
      "CHECK ((status = 'dispatching'::text) = (claimed_by IS NOT NULL AND claim_token IS NOT NULL AND locked_until IS NOT NULL))"
    ]
  },
  {
    "constraint_name": "memory_command_outbox_contract_name_check",
    "table_name": "memory_command_outbox",
    "required_definition_fragments": [
      "CHECK (contract_name = 'MetaFeedbackRequestSuggestionContractV1'::text)"
    ]
  },
  {
    "constraint_name": "memory_command_outbox_deployment_environment_check",
    "table_name": "memory_command_outbox",
    "required_definition_fragments": [
      "CHECK (deployment_environment = ANY (ARRAY['local'::text, 'dev'::text, 'staging'::text, 'prod'::text]))"
    ]
  },
  {
    "constraint_name": "memory_command_outbox_release_channel_check",
    "table_name": "memory_command_outbox",
    "required_definition_fragments": [
      "CHECK (release_channel = ANY (ARRAY['stable'::text, 'canary'::text]))"
    ]
  },
  {
    "constraint_name": "memory_command_outbox_source_service_check",
    "table_name": "memory_command_outbox",
    "required_definition_fragments": [
      "CHECK (source_service = 'memory_service'::text)"
    ]
  },
  {
    "constraint_name": "memory_command_outbox_status_check",
    "table_name": "memory_command_outbox",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['pending'::text, 'dispatching'::text, 'sent'::text, 'retry_wait'::text, 'failed'::text]))"
    ]
  },
  {
    "constraint_name": "memory_command_outbox_transport_generation_safe_check",
    "table_name": "memory_command_outbox",
    "required_definition_fragments": [
      "CHECK (transport_generation IS NULL OR transport_generation >= 1 AND transport_generation <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "nullable_integer_range",
      "column_name": "transport_generation",
      "min": 1,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "memory_conflicts_state_version_check",
    "table_name": "memory_conflicts",
    "required_definition_fragments": [
      "CHECK (state_version > 0)"
    ]
  },
  {
    "constraint_name": "memory_conflicts_status_check",
    "table_name": "memory_conflicts",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['open'::text, 'auto_resolved'::text, 'feedback_requested'::text, 'resolved'::text, 'ignored'::text]))"
    ]
  },
  {
    "constraint_name": "memory_embedding_profiles_dimensions_check",
    "table_name": "memory_embedding_profiles",
    "required_definition_fragments": [
      "CHECK (dimensions = 2048)"
    ]
  },
  {
    "constraint_name": "memory_embedding_profiles_distance_metric_check",
    "table_name": "memory_embedding_profiles",
    "required_definition_fragments": [
      "CHECK (distance_metric = 'cosine'::text)"
    ]
  },
  {
    "constraint_name": "memory_embedding_profiles_normalized_check",
    "table_name": "memory_embedding_profiles",
    "required_definition_fragments": [
      "CHECK (normalized)"
    ]
  },
  {
    "constraint_name": "memory_event_dlq_resolutions_resolution_payload_check",
    "table_name": "memory_event_dlq_resolutions",
    "required_definition_fragments": [
      "CHECK (jsonb_typeof(resolution_payload) = 'object'::text)"
    ]
  },
  {
    "constraint_name": "memory_event_inbox_event_id_check",
    "table_name": "memory_event_inbox",
    "required_definition_fragments": [
      "CHECK (length(event_id) > 0)"
    ]
  },
  {
    "constraint_name": "memory_event_inbox_payload_hash_check",
    "table_name": "memory_event_inbox",
    "required_definition_fragments": [
      "CHECK (length(payload_hash) > 0)"
    ]
  },
  {
    "constraint_name": "memory_event_inbox_scope_fingerprint_check",
    "table_name": "memory_event_inbox",
    "required_definition_fragments": [
      "CHECK (length(scope_fingerprint) > 0)"
    ]
  },
  {
    "constraint_name": "memory_event_inbox_semantic_hash_check",
    "table_name": "memory_event_inbox",
    "required_definition_fragments": [
      "CHECK (length(semantic_hash) > 0)"
    ]
  },
  {
    "constraint_name": "memory_event_outbox_ack_fence_check",
    "table_name": "memory_event_outbox",
    "required_definition_fragments": [
      "CHECK ((status = 'sent'::text) = (acknowledged_claim_token IS NOT NULL))"
    ]
  },
  {
    "constraint_name": "memory_event_outbox_aggregate_type_check",
    "table_name": "memory_event_outbox",
    "required_definition_fragments": [
      "CHECK (aggregate_type = ANY (ARRAY['memory_point'::text, 'memory_series'::text, 'memory_conflict'::text, 'integration_job'::text]))"
    ]
  },
  {
    "constraint_name": "memory_event_outbox_aggregate_version_check",
    "table_name": "memory_event_outbox",
    "required_definition_fragments": [
      "CHECK (aggregate_version > 0)"
    ]
  },
  {
    "constraint_name": "memory_event_outbox_check",
    "table_name": "memory_event_outbox",
    "required_definition_fragments": [
      "CHECK (payload ?& ARRAY['bot_id'::text, 'aggregate_id'::text, 'aggregate_type'::text, 'aggregate_version'::text] AND (payload ->> 'bot_id'::text) = bot_id AND (payload ->> 'aggregate_id'::text) = aggregate_id AND (payload ->> 'aggregate_type'::text) = aggregate_type AND NULLIF(payload ->> 'aggregate_version'::text, ''::text)::bigint = aggregate_version)"
    ]
  },
  {
    "constraint_name": "memory_event_outbox_check1",
    "table_name": "memory_event_outbox",
    "required_definition_fragments": [
      "CHECK ((event_type = ANY (ARRAY['memory.point.created'::text, 'memory.point.updated'::text])) AND aggregate_type = 'memory_point'::text OR (event_type = ANY (ARRAY['memory.series.created'::text, 'memory.series.updated'::text])) AND aggregate_type = 'memory_series'::text OR (event_type = ANY (ARRAY['memory.conflict.detected'::text, 'memory.conflict.updated'::text])) AND aggregate_type = 'memory_conflict'::text OR event_type = 'memory.integration.finished'::text AND aggregate_type = 'integration_job'::text)"
    ]
  },
  {
    "constraint_name": "memory_event_outbox_claim_fence_check",
    "table_name": "memory_event_outbox",
    "required_definition_fragments": [
      "CHECK ((status = 'dispatching'::text) = (claimed_by IS NOT NULL AND claim_token IS NOT NULL AND locked_until IS NOT NULL))"
    ]
  },
  {
    "constraint_name": "memory_event_outbox_event_type_check",
    "table_name": "memory_event_outbox",
    "required_definition_fragments": [
      "CHECK (event_type = ANY (ARRAY['memory.point.created'::text, 'memory.point.updated'::text, 'memory.series.created'::text, 'memory.series.updated'::text, 'memory.conflict.detected'::text, 'memory.conflict.updated'::text, 'memory.integration.finished'::text]))"
    ],
    "semantic_constraint": {
      "kind": "text_enum",
      "column_name": "event_type",
      "allowed_values": [
        "memory.point.created",
        "memory.point.updated",
        "memory.series.created",
        "memory.series.updated",
        "memory.conflict.detected",
        "memory.conflict.updated",
        "memory.integration.finished"
      ]
    }
  },
  {
    "constraint_name": "memory_event_outbox_producer_check",
    "table_name": "memory_event_outbox",
    "required_definition_fragments": [
      "CHECK (producer = 'memory'::text)"
    ],
    "semantic_constraint": {
      "kind": "text_equals",
      "column_name": "producer",
      "value": "memory"
    }
  },
  {
    "constraint_name": "memory_event_outbox_reconciliation_generation_check",
    "table_name": "memory_event_outbox",
    "required_definition_fragments": [
      "CHECK (reconciliation_claim_generation IS NULL OR reconciliation_claim_generation >= 0 AND reconciliation_claim_generation <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "nullable_integer_range",
      "column_name": "reconciliation_claim_generation",
      "min": 0,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "memory_event_outbox_schema_version_check",
    "table_name": "memory_event_outbox",
    "required_definition_fragments": [
      "CHECK (schema_version = 'memory.event.v1'::text)"
    ]
  },
  {
    "constraint_name": "memory_event_outbox_sent_at_check",
    "table_name": "memory_event_outbox",
    "required_definition_fragments": [
      "CHECK (status <> 'sent'::text OR sent_at IS NOT NULL)"
    ],
    "semantic_constraint": {
      "kind": "implies_not_null",
      "column_name": "sent_at",
      "condition_column_name": "status",
      "condition_equals": "sent"
    }
  },
  {
    "constraint_name": "memory_event_outbox_sent_transport_epoch_check",
    "table_name": "memory_event_outbox",
    "required_definition_fragments": [
      "CHECK (status <> 'sent'::text OR transport_epoch IS NOT NULL)"
    ],
    "semantic_constraint": {
      "kind": "implies_not_null",
      "column_name": "transport_epoch",
      "condition_column_name": "status",
      "condition_equals": "sent"
    }
  },
  {
    "constraint_name": "memory_event_outbox_sent_transport_generation_check",
    "table_name": "memory_event_outbox",
    "required_definition_fragments": [
      "CHECK (status <> 'sent'::text OR transport_generation IS NOT NULL)"
    ],
    "semantic_constraint": {
      "kind": "implies_not_null",
      "column_name": "transport_generation",
      "condition_column_name": "status",
      "condition_equals": "sent"
    }
  },
  {
    "constraint_name": "memory_event_outbox_sent_transport_ref_check",
    "table_name": "memory_event_outbox",
    "required_definition_fragments": [
      "CHECK (status <> 'sent'::text OR transport_ref IS NOT NULL)"
    ],
    "semantic_constraint": {
      "kind": "implies_not_null",
      "column_name": "transport_ref",
      "condition_column_name": "status",
      "condition_equals": "sent"
    }
  },
  {
    "constraint_name": "memory_event_outbox_status_check",
    "table_name": "memory_event_outbox",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['pending'::text, 'dispatching'::text, 'sent'::text, 'retry_wait'::text, 'failed'::text]))"
    ]
  },
  {
    "constraint_name": "memory_event_outbox_target_check",
    "table_name": "memory_event_outbox",
    "required_definition_fragments": [
      "CHECK (target <> ALL (ARRAY['observation'::text, 'observation_gateway'::text]))"
    ]
  },
  {
    "constraint_name": "memory_event_outbox_transport_generation_safe_check",
    "table_name": "memory_event_outbox",
    "required_definition_fragments": [
      "CHECK (transport_generation IS NULL OR transport_generation >= 1 AND transport_generation <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "nullable_integer_range",
      "column_name": "transport_generation",
      "min": 1,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "memory_feedback_events_action_check",
    "table_name": "memory_feedback_events",
    "required_definition_fragments": [
      "CHECK (action = ANY (ARRAY['confirm'::text, 'correct'::text, 'reject'::text, 'merge'::text, 'suppress'::text]))"
    ]
  },
  {
    "constraint_name": "memory_feedback_events_check",
    "table_name": "memory_feedback_events",
    "required_definition_fragments": [
      "CHECK (resulting_state_version = (expected_state_version + 1))"
    ]
  },
  {
    "constraint_name": "memory_feedback_events_expected_state_version_check",
    "table_name": "memory_feedback_events",
    "required_definition_fragments": [
      "CHECK (expected_state_version > 0)"
    ]
  },
  {
    "constraint_name": "memory_feedback_events_response_payload_check",
    "table_name": "memory_feedback_events",
    "required_definition_fragments": [
      "CHECK (response_payload ?& ARRAY['revision_refs'::text, 'audit_ids'::text, 'event_ids'::text])"
    ]
  },
  {
    "constraint_name": "memory_feedback_events_resulting_state_version_check",
    "table_name": "memory_feedback_events",
    "required_definition_fragments": [
      "CHECK (resulting_state_version > 0)"
    ]
  },
  {
    "constraint_name": "memory_feedback_events_target_type_check",
    "table_name": "memory_feedback_events",
    "required_definition_fragments": [
      "CHECK (target_type = ANY (ARRAY['memory_point'::text, 'series'::text]))"
    ]
  },
  {
    "constraint_name": "memory_graph_builds_graph_revision_check",
    "table_name": "memory_graph_builds",
    "required_definition_fragments": [
      "CHECK (graph_revision > 0)"
    ]
  },
  {
    "constraint_name": "memory_integration_change_receipts_change_kind_check",
    "table_name": "memory_integration_change_receipts",
    "required_definition_fragments": [
      "CHECK (change_kind = ANY (ARRAY['decay_point'::text, 'deduplicate_point'::text, 'rekey_series'::text, 'rebuild_projection'::text]))"
    ]
  },
  {
    "constraint_name": "memory_integration_change_receipts_lease_generation_check",
    "table_name": "memory_integration_change_receipts",
    "required_definition_fragments": [
      "CHECK (lease_generation > 0)"
    ]
  },
  {
    "constraint_name": "memory_integration_change_receipts_request_hash_check",
    "table_name": "memory_integration_change_receipts",
    "required_definition_fragments": [
      "CHECK (request_hash ~ '^sha256:[0-9a-f]{64}$'::text)"
    ]
  },
  {
    "constraint_name": "memory_integration_change_receipts_result_payload_check",
    "table_name": "memory_integration_change_receipts",
    "required_definition_fragments": [
      "CHECK (jsonb_typeof(result_payload) = 'object'::text)"
    ]
  },
  {
    "constraint_name": "memory_integration_change_receipts_target_type_check",
    "table_name": "memory_integration_change_receipts",
    "required_definition_fragments": [
      "CHECK (target_type = ANY (ARRAY['memory_point'::text, 'memory_series'::text]))"
    ]
  },
  {
    "constraint_name": "memory_integration_job_leases_lease_generation_check",
    "table_name": "memory_integration_job_leases",
    "required_definition_fragments": [
      "CHECK (lease_generation > 0)"
    ]
  },
  {
    "constraint_name": "memory_integration_jobs_mode_check",
    "table_name": "memory_integration_jobs",
    "required_definition_fragments": [
      "CHECK (mode = ANY (ARRAY['decay'::text, 'deduplicate'::text, 'rekey'::text, 'rebuild_projection'::text, 'full'::text]))"
    ]
  },
  {
    "constraint_name": "memory_integration_jobs_state_version_check",
    "table_name": "memory_integration_jobs",
    "required_definition_fragments": [
      "CHECK (state_version > 0)"
    ]
  },
  {
    "constraint_name": "memory_integration_jobs_status_check",
    "table_name": "memory_integration_jobs",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['queued'::text, 'leased'::text, 'running'::text, 'completed'::text, 'partial_failed'::text, 'failed'::text]))"
    ]
  },
  {
    "constraint_name": "memory_linkage_operations_check",
    "table_name": "memory_linkage_operations",
    "required_definition_fragments": [
      "CHECK (source_kind = 'service'::text AND source_service IS NOT NULL OR source_kind <> 'service'::text AND source_service IS NULL AND (actor_principal IS NOT NULL OR actor_role IS NOT NULL))"
    ]
  },
  {
    "constraint_name": "memory_linkage_operations_operation_check",
    "table_name": "memory_linkage_operations",
    "required_definition_fragments": [
      "CHECK (operation = ANY (ARRAY['no_op'::text, 'downgrade'::text, 'mark_historical'::text, 'append_version'::text, 'feedback_required'::text]))"
    ]
  },
  {
    "constraint_name": "memory_linkage_operations_source_kind_check",
    "table_name": "memory_linkage_operations",
    "required_definition_fragments": [
      "CHECK (source_kind = ANY (ARRAY['service'::text, 'manual'::text, 'operator'::text, 'offline_repair'::text]))"
    ]
  },
  {
    "constraint_name": "memory_linkage_operations_source_service_check",
    "table_name": "memory_linkage_operations",
    "required_definition_fragments": [
      "CHECK (source_service = ANY (ARRAY['trigger_processor'::text, 'action_runtime'::text, 'meta_cognition'::text, 'memory'::text, 'knowthat'::text, 'skill_registry'::text, 'timer_trigger_app'::text, 'observation_gateway'::text]))"
    ]
  },
  {
    "constraint_name": "memory_linkage_operations_status_check",
    "table_name": "memory_linkage_operations",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['pending'::text, 'running'::text, 'retry_wait'::text, 'applied'::text, 'failed'::text, 'skipped'::text]))"
    ]
  },
  {
    "constraint_name": "memory_point_search_index_embedding_backfill_status_check",
    "table_name": "memory_point_search_index",
    "required_definition_fragments": [
      "CHECK (embedding_backfill_status = ANY (ARRAY['pending'::text, 'processing'::text, 'ready'::text, 'failed'::text]))"
    ]
  },
  {
    "constraint_name": "memory_point_search_index_series_state_version_check",
    "table_name": "memory_point_search_index",
    "required_definition_fragments": [
      "CHECK (series_state_version > 0)"
    ]
  },
  {
    "constraint_name": "memory_point_search_index_state_version_check",
    "table_name": "memory_point_search_index",
    "required_definition_fragments": [
      "CHECK (state_version > 0)"
    ]
  },
  {
    "constraint_name": "memory_point_search_index_status_check",
    "table_name": "memory_point_search_index",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['active'::text, 'superseded'::text, 'downgraded'::text, 'archived'::text, 'rejected'::text, 'pending_conflict'::text]))"
    ]
  },
  {
    "constraint_name": "memory_search_embedding_ready_check",
    "table_name": "memory_point_search_index",
    "required_definition_fragments": [
      "CHECK (embedding_backfill_status <> 'ready'::text OR embedding_profile_id IS NOT NULL AND summary_embedding IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "memory_points_confidence_score_check",
    "table_name": "memory_points",
    "required_definition_fragments": [
      "CHECK (confidence_score >= 0::double precision AND confidence_score <= 1::double precision)"
    ]
  },
  {
    "constraint_name": "memory_points_content_hash_check",
    "table_name": "memory_points",
    "required_definition_fragments": [
      "CHECK (length(content_hash) > 0)"
    ]
  },
  {
    "constraint_name": "memory_points_embedding_backfill_status_check",
    "table_name": "memory_points",
    "required_definition_fragments": [
      "CHECK (embedding_backfill_status = ANY (ARRAY['pending'::text, 'processing'::text, 'ready'::text, 'failed'::text]))"
    ]
  },
  {
    "constraint_name": "memory_points_embedding_ready_check",
    "table_name": "memory_points",
    "required_definition_fragments": [
      "CHECK (embedding_backfill_status <> 'ready'::text OR embedding_profile_id IS NOT NULL AND summary_embedding IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "memory_points_emotion_tags_check",
    "table_name": "memory_points",
    "required_definition_fragments": [
      "CHECK (emotion_tags <@ ARRAY['neutral'::text, 'satisfied'::text, 'confused'::text, 'frustrated'::text, 'urgent'::text, 'uncertain'::text, 'concerned'::text, 'positive'::text])"
    ]
  },
  {
    "constraint_name": "memory_points_scene_tags_check",
    "table_name": "memory_points",
    "required_definition_fragments": [
      "CHECK (scene_tags <@ ARRAY['work_planning'::text, 'architecture_review'::text, 'implementation'::text, 'debugging'::text, 'decision_making'::text, 'follow_up'::text, 'personal_preference'::text, 'relationship'::text, 'other'::text])"
    ]
  },
  {
    "constraint_name": "memory_points_series_decision_check",
    "table_name": "memory_points",
    "required_definition_fragments": [
      "CHECK (series_decision = ANY (ARRAY['append_version'::text, 'new_series'::text, 'merge_existing'::text, 'conflict_review'::text]))"
    ]
  },
  {
    "constraint_name": "memory_points_state_version_check",
    "table_name": "memory_points",
    "required_definition_fragments": [
      "CHECK (state_version > 0)"
    ]
  },
  {
    "constraint_name": "memory_points_status_check",
    "table_name": "memory_points",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['active'::text, 'superseded'::text, 'downgraded'::text, 'archived'::text, 'rejected'::text, 'pending_conflict'::text]))"
    ]
  },
  {
    "constraint_name": "memory_points_version_no_check",
    "table_name": "memory_points",
    "required_definition_fragments": [
      "CHECK (version_no > 0)"
    ]
  },
  {
    "constraint_name": "memory_pre_promotion_check_ident_current_check_generation_check",
    "table_name": "memory_pre_promotion_check_identities",
    "required_definition_fragments": [
      "CHECK (current_check_generation >= 0 AND current_check_generation <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "integer_range",
      "column_name": "current_check_generation",
      "min": 0,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "memory_pre_promotion_check_identities_check",
    "table_name": "memory_pre_promotion_check_identities",
    "required_definition_fragments": [
      "CHECK ((current_check_generation = 0) = (current_check_id IS NULL))"
    ]
  },
  {
    "constraint_name": "memory_pre_promotion_checks_check_generation_check",
    "table_name": "memory_pre_promotion_checks",
    "required_definition_fragments": [
      "CHECK (check_generation >= 1 AND check_generation <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "integer_range",
      "column_name": "check_generation",
      "min": 1,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "memory_pre_promotion_checks_generation_status_check",
    "table_name": "memory_pre_promotion_checks",
    "required_definition_fragments": [
      "CHECK (generation_status = ANY (ARRAY['current'::text, 'superseded'::text, 'consumed'::text]))"
    ]
  },
  {
    "constraint_name": "memory_pre_promotion_checks_overall_result_check",
    "table_name": "memory_pre_promotion_checks",
    "required_definition_fragments": [
      "CHECK (overall_result = ANY (ARRAY['passed'::text, 'blocked'::text, 'needs_review'::text]))"
    ]
  },
  {
    "constraint_name": "memory_pre_promotion_checks_superseded_check",
    "table_name": "memory_pre_promotion_checks",
    "required_definition_fragments": [
      "CHECK (generation_status = 'current'::text AND superseded_at IS NULL AND superseded_reason IS NULL OR generation_status <> 'current'::text AND superseded_at IS NOT NULL AND superseded_reason IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "memory_promotion_reservation_targe_expected_state_version_check",
    "table_name": "memory_promotion_reservation_targets",
    "required_definition_fragments": [
      "CHECK (expected_state_version > 0)"
    ]
  },
  {
    "constraint_name": "memory_promotion_reservation_targets_aggregate_type_check",
    "table_name": "memory_promotion_reservation_targets",
    "required_definition_fragments": [
      "CHECK (aggregate_type = ANY (ARRAY['memory_point'::text, 'memory_series'::text, 'memory_conflict'::text]))"
    ]
  },
  {
    "constraint_name": "memory_promotion_reservation_ack_payload_secret_check",
    "table_name": "memory_promotion_reservations",
    "required_definition_fragments": [
      "CHECK (ack_payload IS NULL OR jsonb_typeof(ack_payload) = 'object'::text AND NOT jsonb_path_exists(ack_payload, '$.**.\"reservation_token\"'::jsonpath) AND (ack_payload ->> 'reservation_token_hash'::text) = reservation_token_hash)"
    ]
  },
  {
    "constraint_name": "memory_promotion_reservation_token_hash_format_check",
    "table_name": "memory_promotion_reservations",
    "required_definition_fragments": [
      "CHECK (reservation_token_hash ~ '^sha256:[0-9a-f]{64}$'::text)"
    ]
  },
  {
    "constraint_name": "memory_promotion_reservations_check",
    "table_name": "memory_promotion_reservations",
    "required_definition_fragments": [
      "CHECK (expires_at > created_at)"
    ]
  },
  {
    "constraint_name": "memory_promotion_reservations_check1",
    "table_name": "memory_promotion_reservations",
    "required_definition_fragments": [
      "CHECK (expires_at <= (created_at + '00:00:15'::interval))"
    ]
  },
  {
    "constraint_name": "memory_promotion_reservations_check2",
    "table_name": "memory_promotion_reservations",
    "required_definition_fragments": [
      "CHECK (status <> 'acked'::text OR committed_at IS NOT NULL AND committed_at <= expires_at AND promotion_revision_id IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "memory_promotion_reservations_check_generation_check",
    "table_name": "memory_promotion_reservations",
    "required_definition_fragments": [
      "CHECK (check_generation >= 1 AND check_generation <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "integer_range",
      "column_name": "check_generation",
      "min": 1,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "memory_promotion_reservations_fence_json_safe_check",
    "table_name": "memory_promotion_reservations",
    "required_definition_fragments": [
      "CHECK (fencing_generation >= 1 AND fencing_generation <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "integer_range",
      "column_name": "fencing_generation",
      "min": 1,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "memory_promotion_reservations_status_check",
    "table_name": "memory_promotion_reservations",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['active'::text, 'acked'::text, 'released'::text, 'expired'::text, 'invalidated'::text]))"
    ]
  },
  {
    "constraint_name": "memory_series_current_version_check",
    "table_name": "memory_series",
    "required_definition_fragments": [
      "CHECK (current_version > 0)"
    ]
  },
  {
    "constraint_name": "memory_series_importance_score_check",
    "table_name": "memory_series",
    "required_definition_fragments": [
      "CHECK (importance_score >= 0::double precision AND importance_score <= 1::double precision)"
    ]
  },
  {
    "constraint_name": "memory_series_state_version_check",
    "table_name": "memory_series",
    "required_definition_fragments": [
      "CHECK (state_version > 0)"
    ]
  },
  {
    "constraint_name": "memory_series_status_check",
    "table_name": "memory_series",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['active'::text, 'archived'::text, 'merged'::text, 'suppressed'::text, 'pending_conflict'::text]))"
    ]
  },
  {
    "constraint_name": "memory_state_revisions_aggregate_type_check",
    "table_name": "memory_state_revisions",
    "required_definition_fragments": [
      "CHECK (aggregate_type = ANY (ARRAY['memory_point'::text, 'memory_series'::text, 'memory_conflict'::text, 'integration_job'::text]))"
    ]
  },
  {
    "constraint_name": "memory_state_revisions_check",
    "table_name": "memory_state_revisions",
    "required_definition_fragments": [
      "CHECK (resulting_state_version = (previous_state_version + 1))"
    ]
  },
  {
    "constraint_name": "memory_state_revisions_previous_state_version_check",
    "table_name": "memory_state_revisions",
    "required_definition_fragments": [
      "CHECK (previous_state_version >= 0)"
    ]
  },
  {
    "constraint_name": "memory_state_revisions_resulting_state_version_check",
    "table_name": "memory_state_revisions",
    "required_definition_fragments": [
      "CHECK (resulting_state_version > 0)"
    ]
  },
  {
    "constraint_name": "memory_write_batches_payload_schema_version_check",
    "table_name": "memory_write_batches",
    "required_definition_fragments": [
      "CHECK (payload_schema_version = 'memory.write_batch.v1'::text)"
    ]
  },
  {
    "constraint_name": "memory_write_batches_status_check",
    "table_name": "memory_write_batches",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['completed'::text, 'partial_failed'::text]))"
    ]
  },
  {
    "constraint_name": "memory_write_item_decisions_decision_check",
    "table_name": "memory_write_item_decisions",
    "required_definition_fragments": [
      "CHECK (decision = ANY (ARRAY['new_series'::text, 'append_version'::text, 'merge_existing'::text, 'conflict_review'::text, 'rejected'::text]))"
    ]
  },
  {
    "constraint_name": "relationship_edges_confidence_check",
    "table_name": "relationship_edges",
    "required_definition_fragments": [
      "CHECK (confidence >= 0::double precision AND confidence <= 1::double precision)"
    ]
  },
  {
    "constraint_name": "role_memories_role_type_check",
    "table_name": "role_memories",
    "required_definition_fragments": [
      "CHECK (role_type = ANY (ARRAY['user'::text, 'agent'::text, 'organization'::text, 'project'::text, 'system'::text, 'other'::text]))"
    ]
  }
] as const;

export const MEMORY_DATABASE_FUNCTIONS_V1 = [] as const;

export const MEMORY_DATABASE_TRIGGERS_V1 = [] as const;

export const MEMORY_DATABASE_UNIQUE_CONSTRAINTS_V1 = [
  {
    "constraint_name": "eventing_transport_epochs_pkey",
    "table_name": "eventing_transport_epochs",
    "columns": [
      "transport_name"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_audit_logs_pkey",
    "table_name": "memory_audit_logs",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_command_dlq_command_outbox_id_key",
    "table_name": "memory_command_dlq",
    "columns": [
      "command_outbox_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_command_dlq_pkey",
    "table_name": "memory_command_dlq",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_command_dlq_resolutions_dlq_id_key",
    "table_name": "memory_command_dlq_resolutions",
    "columns": [
      "dlq_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_command_dlq_resolutions_idempotency_key_key",
    "table_name": "memory_command_dlq_resolutions",
    "columns": [
      "idempotency_key"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_command_dlq_resolutions_pkey",
    "table_name": "memory_command_dlq_resolutions",
    "columns": [
      "resolution_id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_command_outbox_command_id_key",
    "table_name": "memory_command_outbox",
    "columns": [
      "command_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_command_outbox_pkey",
    "table_name": "memory_command_outbox",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_command_outbox_source_service_command_id_request_has_key",
    "table_name": "memory_command_outbox",
    "columns": [
      "source_service",
      "command_id",
      "request_hash"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_conflicts_bot_id_conflict_key_key",
    "table_name": "memory_conflicts",
    "columns": [
      "bot_id",
      "conflict_key"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_conflicts_pkey",
    "table_name": "memory_conflicts",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_embedding_profiles_model_id_model_revision_key",
    "table_name": "memory_embedding_profiles",
    "columns": [
      "model_id",
      "model_revision"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_embedding_profiles_pkey",
    "table_name": "memory_embedding_profiles",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_event_dlq_pkey",
    "table_name": "memory_event_dlq",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_event_dlq_resolutions_dlq_id_key",
    "table_name": "memory_event_dlq_resolutions",
    "columns": [
      "dlq_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_event_dlq_resolutions_idempotency_key_key",
    "table_name": "memory_event_dlq_resolutions",
    "columns": [
      "idempotency_key"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_event_dlq_resolutions_pkey",
    "table_name": "memory_event_dlq_resolutions",
    "columns": [
      "resolution_id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_event_inbox_pkey",
    "table_name": "memory_event_inbox",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_event_inbox_source_event_id_key",
    "table_name": "memory_event_inbox",
    "columns": [
      "source",
      "event_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_event_inbox_source_idempotency_key_key",
    "table_name": "memory_event_inbox",
    "columns": [
      "source",
      "idempotency_key"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_event_outbox_pkey",
    "table_name": "memory_event_outbox",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_event_outbox_target_aggregate_id_aggregate_version_key",
    "table_name": "memory_event_outbox",
    "columns": [
      "target",
      "aggregate_id",
      "aggregate_version"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_event_outbox_target_idempotency_key_key",
    "table_name": "memory_event_outbox",
    "columns": [
      "target",
      "idempotency_key"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_feedback_audit_refs_pkey",
    "table_name": "memory_feedback_audit_refs",
    "columns": [
      "feedback_event_id",
      "audit_id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_feedback_event_refs_pkey",
    "table_name": "memory_feedback_event_refs",
    "columns": [
      "feedback_event_id",
      "event_id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_feedback_events_bot_id_idempotency_key_key",
    "table_name": "memory_feedback_events",
    "columns": [
      "bot_id",
      "idempotency_key"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_feedback_events_pkey",
    "table_name": "memory_feedback_events",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_feedback_revision_refs_pkey",
    "table_name": "memory_feedback_revision_refs",
    "columns": [
      "feedback_event_id",
      "revision_id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_graph_builds_bot_id_idempotency_key_key",
    "table_name": "memory_graph_builds",
    "columns": [
      "bot_id",
      "idempotency_key"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_graph_builds_pkey",
    "table_name": "memory_graph_builds",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_integration_change_rece_integration_job_id_change_id_key",
    "table_name": "memory_integration_change_receipts",
    "columns": [
      "integration_job_id",
      "change_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_integration_change_receipts_pkey",
    "table_name": "memory_integration_change_receipts",
    "columns": [
      "change_id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_integration_job_leases_lease_id_key",
    "table_name": "memory_integration_job_leases",
    "columns": [
      "lease_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_integration_job_leases_pkey",
    "table_name": "memory_integration_job_leases",
    "columns": [
      "integration_job_id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_integration_jobs_bot_id_idempotency_key_key",
    "table_name": "memory_integration_jobs",
    "columns": [
      "bot_id",
      "idempotency_key"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_integration_jobs_pkey",
    "table_name": "memory_integration_jobs",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_linkage_operations_bot_id_idempotency_key_key",
    "table_name": "memory_linkage_operations",
    "columns": [
      "bot_id",
      "idempotency_key"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_linkage_operations_pkey",
    "table_name": "memory_linkage_operations",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_point_search_index_pkey",
    "table_name": "memory_point_search_index",
    "columns": [
      "memory_point_id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_points_pkey",
    "table_name": "memory_points",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_points_series_id_version_no_key",
    "table_name": "memory_points",
    "columns": [
      "series_id",
      "version_no"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_pre_promotion_check_id_bot_id_idempotency_key_reques_key",
    "table_name": "memory_pre_promotion_check_identities",
    "columns": [
      "bot_id",
      "idempotency_key",
      "request_hash"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_pre_promotion_check_identities_pkey",
    "table_name": "memory_pre_promotion_check_identities",
    "columns": [
      "bot_id",
      "idempotency_key"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_pre_promotion_checks_check_token_hash_key",
    "table_name": "memory_pre_promotion_checks",
    "columns": [
      "check_token_hash"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_pre_promotion_checks_generation_uq",
    "table_name": "memory_pre_promotion_checks",
    "columns": [
      "bot_id",
      "idempotency_key",
      "check_generation",
      "id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_pre_promotion_checks_id_generation_uq",
    "table_name": "memory_pre_promotion_checks",
    "columns": [
      "id",
      "check_generation"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_pre_promotion_checks_pkey",
    "table_name": "memory_pre_promotion_checks",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_promotion_reservation_targets_pkey",
    "table_name": "memory_promotion_reservation_targets",
    "columns": [
      "reservation_id",
      "aggregate_type",
      "aggregate_id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_promotion_reservations_fencing_generation_key",
    "table_name": "memory_promotion_reservations",
    "columns": [
      "fencing_generation"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_promotion_reservations_idempotency_key_key",
    "table_name": "memory_promotion_reservations",
    "columns": [
      "idempotency_key"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_promotion_reservations_pkey",
    "table_name": "memory_promotion_reservations",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_promotion_reservations_reservation_token_hash_key",
    "table_name": "memory_promotion_reservations",
    "columns": [
      "reservation_token_hash"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_series_pkey",
    "table_name": "memory_series",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_state_revisions_bot_id_aggregate_type_aggregate_id_r_key",
    "table_name": "memory_state_revisions",
    "columns": [
      "bot_id",
      "aggregate_type",
      "aggregate_id",
      "resulting_state_version"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_state_revisions_pkey",
    "table_name": "memory_state_revisions",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_write_batches_bot_id_idempotency_key_key",
    "table_name": "memory_write_batches",
    "columns": [
      "bot_id",
      "idempotency_key"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_write_batches_pkey",
    "table_name": "memory_write_batches",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_write_item_decisions_batch_id_client_item_id_key",
    "table_name": "memory_write_item_decisions",
    "columns": [
      "batch_id",
      "client_item_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_write_item_decisions_bot_id_source_item_id_key",
    "table_name": "memory_write_item_decisions",
    "columns": [
      "bot_id",
      "source_item_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_write_item_decisions_pkey",
    "table_name": "memory_write_item_decisions",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "relationship_edges_pkey",
    "table_name": "relationship_edges",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "role_memories_bot_id_role_id_key",
    "table_name": "role_memories",
    "columns": [
      "bot_id",
      "role_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "role_memories_pkey",
    "table_name": "role_memories",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "topic_family_key_aliases_bot_id_old_canonicalization_versio_key",
    "table_name": "topic_family_key_aliases",
    "columns": [
      "bot_id",
      "old_canonicalization_version",
      "old_topic_family_key",
      "new_canonicalization_version",
      "new_topic_family_key"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "topic_family_key_aliases_pkey",
    "table_name": "topic_family_key_aliases",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "topic_key_aliases_bot_id_old_canonicalization_version_old_t_key",
    "table_name": "topic_key_aliases",
    "columns": [
      "bot_id",
      "old_canonicalization_version",
      "old_topic_key"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "topic_key_aliases_pkey",
    "table_name": "topic_key_aliases",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  }
] as const;

export const MEMORY_DATABASE_INDEXES_V1 = [
  {
    "index_name": "eventing_transport_epochs_pkey",
    "table_name": "eventing_transport_epochs",
    "definition": "CREATE UNIQUE INDEX eventing_transport_epochs_pkey ON memory.eventing_transport_epochs USING btree (transport_name)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "memory_audit_logs_pkey",
    "table_name": "memory_audit_logs",
    "definition": "CREATE UNIQUE INDEX memory_audit_logs_pkey ON memory.memory_audit_logs USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "memory_command_dlq_command_outbox_id_key",
    "table_name": "memory_command_dlq",
    "definition": "CREATE UNIQUE INDEX memory_command_dlq_command_outbox_id_key ON memory.memory_command_dlq USING btree (command_outbox_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "memory_command_dlq_pkey",
    "table_name": "memory_command_dlq",
    "definition": "CREATE UNIQUE INDEX memory_command_dlq_pkey ON memory.memory_command_dlq USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "memory_command_dlq_resolutions_dlq_id_key",
    "table_name": "memory_command_dlq_resolutions",
    "definition": "CREATE UNIQUE INDEX memory_command_dlq_resolutions_dlq_id_key ON memory.memory_command_dlq_resolutions USING btree (dlq_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "memory_command_dlq_resolutions_idempotency_key_key",
    "table_name": "memory_command_dlq_resolutions",
    "definition": "CREATE UNIQUE INDEX memory_command_dlq_resolutions_idempotency_key_key ON memory.memory_command_dlq_resolutions USING btree (idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "memory_command_dlq_resolutions_pkey",
    "table_name": "memory_command_dlq_resolutions",
    "definition": "CREATE UNIQUE INDEX memory_command_dlq_resolutions_pkey ON memory.memory_command_dlq_resolutions USING btree (resolution_id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "memory_command_outbox_claim_idx",
    "table_name": "memory_command_outbox",
    "definition": "CREATE INDEX memory_command_outbox_claim_idx ON memory.memory_command_outbox USING btree (status, next_retry_at, created_at) WHERE (status = ANY (ARRAY['pending'::text, 'retry_wait'::text]))",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "memory_command_outbox_command_id_key",
    "table_name": "memory_command_outbox",
    "definition": "CREATE UNIQUE INDEX memory_command_outbox_command_id_key ON memory.memory_command_outbox USING btree (command_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "memory_command_outbox_pkey",
    "table_name": "memory_command_outbox",
    "definition": "CREATE UNIQUE INDEX memory_command_outbox_pkey ON memory.memory_command_outbox USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "memory_command_outbox_source_service_command_id_request_has_key",
    "table_name": "memory_command_outbox",
    "definition": "CREATE UNIQUE INDEX memory_command_outbox_source_service_command_id_request_has_key ON memory.memory_command_outbox USING btree (source_service, command_id, request_hash)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "memory_conflicts_bot_id_conflict_key_key",
    "table_name": "memory_conflicts",
    "definition": "CREATE UNIQUE INDEX memory_conflicts_bot_id_conflict_key_key ON memory.memory_conflicts USING btree (bot_id, conflict_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "memory_conflicts_pkey",
    "table_name": "memory_conflicts",
    "definition": "CREATE UNIQUE INDEX memory_conflicts_pkey ON memory.memory_conflicts USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "memory_embedding_profiles_model_id_model_revision_key",
    "table_name": "memory_embedding_profiles",
    "definition": "CREATE UNIQUE INDEX memory_embedding_profiles_model_id_model_revision_key ON memory.memory_embedding_profiles USING btree (model_id, model_revision)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "memory_embedding_profiles_pkey",
    "table_name": "memory_embedding_profiles",
    "definition": "CREATE UNIQUE INDEX memory_embedding_profiles_pkey ON memory.memory_embedding_profiles USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "memory_event_dlq_pkey",
    "table_name": "memory_event_dlq",
    "definition": "CREATE UNIQUE INDEX memory_event_dlq_pkey ON memory.memory_event_dlq USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "memory_event_dlq_resolutions_dlq_id_key",
    "table_name": "memory_event_dlq_resolutions",
    "definition": "CREATE UNIQUE INDEX memory_event_dlq_resolutions_dlq_id_key ON memory.memory_event_dlq_resolutions USING btree (dlq_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "memory_event_dlq_resolutions_idempotency_key_key",
    "table_name": "memory_event_dlq_resolutions",
    "definition": "CREATE UNIQUE INDEX memory_event_dlq_resolutions_idempotency_key_key ON memory.memory_event_dlq_resolutions USING btree (idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "memory_event_dlq_resolutions_pkey",
    "table_name": "memory_event_dlq_resolutions",
    "definition": "CREATE UNIQUE INDEX memory_event_dlq_resolutions_pkey ON memory.memory_event_dlq_resolutions USING btree (resolution_id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "memory_event_inbox_pkey",
    "table_name": "memory_event_inbox",
    "definition": "CREATE UNIQUE INDEX memory_event_inbox_pkey ON memory.memory_event_inbox USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "memory_event_inbox_source_event_id_key",
    "table_name": "memory_event_inbox",
    "definition": "CREATE UNIQUE INDEX memory_event_inbox_source_event_id_key ON memory.memory_event_inbox USING btree (source, event_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "memory_event_inbox_source_idempotency_key_key",
    "table_name": "memory_event_inbox",
    "definition": "CREATE UNIQUE INDEX memory_event_inbox_source_idempotency_key_key ON memory.memory_event_inbox USING btree (source, idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "memory_event_outbox_pkey",
    "table_name": "memory_event_outbox",
    "definition": "CREATE UNIQUE INDEX memory_event_outbox_pkey ON memory.memory_event_outbox USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "memory_event_outbox_reconciliation_due_idx",
    "table_name": "memory_event_outbox",
    "definition": "CREATE INDEX memory_event_outbox_reconciliation_due_idx ON memory.memory_event_outbox USING btree (reconciliation_next_probe_at NULLS FIRST, sent_at, id) WHERE (status = 'sent'::text)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "memory_event_outbox_reconciliation_generation_idx",
    "table_name": "memory_event_outbox",
    "definition": "CREATE INDEX memory_event_outbox_reconciliation_generation_idx ON memory.memory_event_outbox USING btree (transport_epoch, transport_generation, sent_at, id) WHERE (status = 'sent'::text)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "memory_event_outbox_reconciliation_transport_ref_idx",
    "table_name": "memory_event_outbox",
    "definition": "CREATE INDEX memory_event_outbox_reconciliation_transport_ref_idx ON memory.memory_event_outbox USING btree (transport_ref, transport_epoch, transport_generation) WHERE ((status = 'sent'::text) AND (transport_ref IS NOT NULL))",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "memory_event_outbox_target_aggregate_id_aggregate_version_key",
    "table_name": "memory_event_outbox",
    "definition": "CREATE UNIQUE INDEX memory_event_outbox_target_aggregate_id_aggregate_version_key ON memory.memory_event_outbox USING btree (target, aggregate_id, aggregate_version)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "memory_event_outbox_target_idempotency_key_key",
    "table_name": "memory_event_outbox",
    "definition": "CREATE UNIQUE INDEX memory_event_outbox_target_idempotency_key_key ON memory.memory_event_outbox USING btree (target, idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "memory_feedback_audit_refs_pkey",
    "table_name": "memory_feedback_audit_refs",
    "definition": "CREATE UNIQUE INDEX memory_feedback_audit_refs_pkey ON memory.memory_feedback_audit_refs USING btree (feedback_event_id, audit_id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "memory_feedback_event_refs_pkey",
    "table_name": "memory_feedback_event_refs",
    "definition": "CREATE UNIQUE INDEX memory_feedback_event_refs_pkey ON memory.memory_feedback_event_refs USING btree (feedback_event_id, event_id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "memory_feedback_events_bot_id_idempotency_key_key",
    "table_name": "memory_feedback_events",
    "definition": "CREATE UNIQUE INDEX memory_feedback_events_bot_id_idempotency_key_key ON memory.memory_feedback_events USING btree (bot_id, idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "memory_feedback_events_pkey",
    "table_name": "memory_feedback_events",
    "definition": "CREATE UNIQUE INDEX memory_feedback_events_pkey ON memory.memory_feedback_events USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "memory_feedback_revision_refs_pkey",
    "table_name": "memory_feedback_revision_refs",
    "definition": "CREATE UNIQUE INDEX memory_feedback_revision_refs_pkey ON memory.memory_feedback_revision_refs USING btree (feedback_event_id, revision_id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "memory_graph_builds_bot_id_idempotency_key_key",
    "table_name": "memory_graph_builds",
    "definition": "CREATE UNIQUE INDEX memory_graph_builds_bot_id_idempotency_key_key ON memory.memory_graph_builds USING btree (bot_id, idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "memory_graph_builds_pkey",
    "table_name": "memory_graph_builds",
    "definition": "CREATE UNIQUE INDEX memory_graph_builds_pkey ON memory.memory_graph_builds USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "memory_integration_change_rece_integration_job_id_change_id_key",
    "table_name": "memory_integration_change_receipts",
    "definition": "CREATE UNIQUE INDEX memory_integration_change_rece_integration_job_id_change_id_key ON memory.memory_integration_change_receipts USING btree (integration_job_id, change_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "memory_integration_change_receipts_job_idx",
    "table_name": "memory_integration_change_receipts",
    "definition": "CREATE INDEX memory_integration_change_receipts_job_idx ON memory.memory_integration_change_receipts USING btree (integration_job_id, created_at, change_id)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "memory_integration_change_receipts_pkey",
    "table_name": "memory_integration_change_receipts",
    "definition": "CREATE UNIQUE INDEX memory_integration_change_receipts_pkey ON memory.memory_integration_change_receipts USING btree (change_id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "memory_integration_job_leases_lease_id_key",
    "table_name": "memory_integration_job_leases",
    "definition": "CREATE UNIQUE INDEX memory_integration_job_leases_lease_id_key ON memory.memory_integration_job_leases USING btree (lease_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "memory_integration_job_leases_pkey",
    "table_name": "memory_integration_job_leases",
    "definition": "CREATE UNIQUE INDEX memory_integration_job_leases_pkey ON memory.memory_integration_job_leases USING btree (integration_job_id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "memory_integration_jobs_bot_id_idempotency_key_key",
    "table_name": "memory_integration_jobs",
    "definition": "CREATE UNIQUE INDEX memory_integration_jobs_bot_id_idempotency_key_key ON memory.memory_integration_jobs USING btree (bot_id, idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "memory_integration_jobs_claim_idx",
    "table_name": "memory_integration_jobs",
    "definition": "CREATE INDEX memory_integration_jobs_claim_idx ON memory.memory_integration_jobs USING btree (status, updated_at) WHERE (status = ANY (ARRAY['queued'::text, 'leased'::text, 'running'::text]))",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "memory_integration_jobs_pkey",
    "table_name": "memory_integration_jobs",
    "definition": "CREATE UNIQUE INDEX memory_integration_jobs_pkey ON memory.memory_integration_jobs USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "memory_linkage_operations_bot_id_idempotency_key_key",
    "table_name": "memory_linkage_operations",
    "definition": "CREATE UNIQUE INDEX memory_linkage_operations_bot_id_idempotency_key_key ON memory.memory_linkage_operations USING btree (bot_id, idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "memory_linkage_operations_pkey",
    "table_name": "memory_linkage_operations",
    "definition": "CREATE UNIQUE INDEX memory_linkage_operations_pkey ON memory.memory_linkage_operations USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "memory_point_search_embedding_active_hnsw",
    "table_name": "memory_point_search_index",
    "definition": "CREATE INDEX memory_point_search_embedding_active_hnsw ON memory.memory_point_search_index USING hnsw (summary_embedding extensions.halfvec_cosine_ops) WITH (m='16', ef_construction='64') WHERE ((status = 'active'::text) AND (summary_embedding IS NOT NULL))",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "memory_point_search_embedding_downgraded_hnsw",
    "table_name": "memory_point_search_index",
    "definition": "CREATE INDEX memory_point_search_embedding_downgraded_hnsw ON memory.memory_point_search_index USING hnsw (summary_embedding extensions.halfvec_cosine_ops) WITH (m='16', ef_construction='64') WHERE ((status = 'downgraded'::text) AND (summary_embedding IS NOT NULL))",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "memory_point_search_evidence_expiry_idx",
    "table_name": "memory_point_search_index",
    "definition": "CREATE INDEX memory_point_search_evidence_expiry_idx ON memory.memory_point_search_index USING btree (evidence_valid_until, bot_id, memory_point_id) WHERE (evidence_valid_until IS NOT NULL)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "memory_point_search_index_content_fts_gin",
    "table_name": "memory_point_search_index",
    "definition": "CREATE INDEX memory_point_search_index_content_fts_gin ON memory.memory_point_search_index USING gin (content_tsv)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "memory_point_search_index_pkey",
    "table_name": "memory_point_search_index",
    "definition": "CREATE UNIQUE INDEX memory_point_search_index_pkey ON memory.memory_point_search_index USING btree (memory_point_id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "memory_point_search_index_tags_gin",
    "table_name": "memory_point_search_index",
    "definition": "CREATE INDEX memory_point_search_index_tags_gin ON memory.memory_point_search_index USING gin (keyword_tags, scene_tags, emotion_tags)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "memory_points_pkey",
    "table_name": "memory_points",
    "definition": "CREATE UNIQUE INDEX memory_points_pkey ON memory.memory_points USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "memory_points_series_id_version_no_key",
    "table_name": "memory_points",
    "definition": "CREATE UNIQUE INDEX memory_points_series_id_version_no_key ON memory.memory_points USING btree (series_id, version_no)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "memory_points_summary_embedding_hnsw",
    "table_name": "memory_points",
    "definition": "CREATE INDEX memory_points_summary_embedding_hnsw ON memory.memory_points USING hnsw (summary_embedding extensions.halfvec_cosine_ops) WITH (m='16', ef_construction='64') WHERE (summary_embedding IS NOT NULL)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "memory_pre_promotion_check_id_bot_id_idempotency_key_reques_key",
    "table_name": "memory_pre_promotion_check_identities",
    "definition": "CREATE UNIQUE INDEX memory_pre_promotion_check_id_bot_id_idempotency_key_reques_key ON memory.memory_pre_promotion_check_identities USING btree (bot_id, idempotency_key, request_hash)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "memory_pre_promotion_check_identities_pkey",
    "table_name": "memory_pre_promotion_check_identities",
    "definition": "CREATE UNIQUE INDEX memory_pre_promotion_check_identities_pkey ON memory.memory_pre_promotion_check_identities USING btree (bot_id, idempotency_key)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "memory_pre_promotion_checks_check_token_hash_key",
    "table_name": "memory_pre_promotion_checks",
    "definition": "CREATE UNIQUE INDEX memory_pre_promotion_checks_check_token_hash_key ON memory.memory_pre_promotion_checks USING btree (check_token_hash)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "memory_pre_promotion_checks_generation_uq",
    "table_name": "memory_pre_promotion_checks",
    "definition": "CREATE UNIQUE INDEX memory_pre_promotion_checks_generation_uq ON memory.memory_pre_promotion_checks USING btree (bot_id, idempotency_key, check_generation, id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "memory_pre_promotion_checks_id_generation_uq",
    "table_name": "memory_pre_promotion_checks",
    "definition": "CREATE UNIQUE INDEX memory_pre_promotion_checks_id_generation_uq ON memory.memory_pre_promotion_checks USING btree (id, check_generation)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "memory_pre_promotion_checks_pkey",
    "table_name": "memory_pre_promotion_checks",
    "definition": "CREATE UNIQUE INDEX memory_pre_promotion_checks_pkey ON memory.memory_pre_promotion_checks USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "memory_promotion_reservation_targets_pkey",
    "table_name": "memory_promotion_reservation_targets",
    "definition": "CREATE UNIQUE INDEX memory_promotion_reservation_targets_pkey ON memory.memory_promotion_reservation_targets USING btree (reservation_id, aggregate_type, aggregate_id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "memory_promotion_reservations_fencing_generation_key",
    "table_name": "memory_promotion_reservations",
    "definition": "CREATE UNIQUE INDEX memory_promotion_reservations_fencing_generation_key ON memory.memory_promotion_reservations USING btree (fencing_generation)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "memory_promotion_reservations_idempotency_key_key",
    "table_name": "memory_promotion_reservations",
    "definition": "CREATE UNIQUE INDEX memory_promotion_reservations_idempotency_key_key ON memory.memory_promotion_reservations USING btree (idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "memory_promotion_reservations_one_active_candidate_idx",
    "table_name": "memory_promotion_reservations",
    "definition": "CREATE UNIQUE INDEX memory_promotion_reservations_one_active_candidate_idx ON memory.memory_promotion_reservations USING btree (bot_id, candidate_fact_id) WHERE (status = 'active'::text)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "memory_promotion_reservations_pkey",
    "table_name": "memory_promotion_reservations",
    "definition": "CREATE UNIQUE INDEX memory_promotion_reservations_pkey ON memory.memory_promotion_reservations USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "memory_promotion_reservations_reservation_token_hash_key",
    "table_name": "memory_promotion_reservations",
    "definition": "CREATE UNIQUE INDEX memory_promotion_reservations_reservation_token_hash_key ON memory.memory_promotion_reservations USING btree (reservation_token_hash)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "memory_series_pkey",
    "table_name": "memory_series",
    "definition": "CREATE UNIQUE INDEX memory_series_pkey ON memory.memory_series USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "memory_state_revisions_bot_id_aggregate_type_aggregate_id_r_key",
    "table_name": "memory_state_revisions",
    "definition": "CREATE UNIQUE INDEX memory_state_revisions_bot_id_aggregate_type_aggregate_id_r_key ON memory.memory_state_revisions USING btree (bot_id, aggregate_type, aggregate_id, resulting_state_version)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "memory_state_revisions_pkey",
    "table_name": "memory_state_revisions",
    "definition": "CREATE UNIQUE INDEX memory_state_revisions_pkey ON memory.memory_state_revisions USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "memory_state_revisions_target_idx",
    "table_name": "memory_state_revisions",
    "definition": "CREATE INDEX memory_state_revisions_target_idx ON memory.memory_state_revisions USING btree (bot_id, aggregate_type, aggregate_id, resulting_state_version DESC)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "memory_write_batches_bot_id_idempotency_key_key",
    "table_name": "memory_write_batches",
    "definition": "CREATE UNIQUE INDEX memory_write_batches_bot_id_idempotency_key_key ON memory.memory_write_batches USING btree (bot_id, idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "memory_write_batches_pkey",
    "table_name": "memory_write_batches",
    "definition": "CREATE UNIQUE INDEX memory_write_batches_pkey ON memory.memory_write_batches USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "memory_write_item_decisions_batch_id_client_item_id_key",
    "table_name": "memory_write_item_decisions",
    "definition": "CREATE UNIQUE INDEX memory_write_item_decisions_batch_id_client_item_id_key ON memory.memory_write_item_decisions USING btree (batch_id, client_item_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "memory_write_item_decisions_bot_id_source_item_id_key",
    "table_name": "memory_write_item_decisions",
    "definition": "CREATE UNIQUE INDEX memory_write_item_decisions_bot_id_source_item_id_key ON memory.memory_write_item_decisions USING btree (bot_id, source_item_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "memory_write_item_decisions_pkey",
    "table_name": "memory_write_item_decisions",
    "definition": "CREATE UNIQUE INDEX memory_write_item_decisions_pkey ON memory.memory_write_item_decisions USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "relationship_edges_pkey",
    "table_name": "relationship_edges",
    "definition": "CREATE UNIQUE INDEX relationship_edges_pkey ON memory.relationship_edges USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "role_memories_bot_id_role_id_key",
    "table_name": "role_memories",
    "definition": "CREATE UNIQUE INDEX role_memories_bot_id_role_id_key ON memory.role_memories USING btree (bot_id, role_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "role_memories_pkey",
    "table_name": "role_memories",
    "definition": "CREATE UNIQUE INDEX role_memories_pkey ON memory.role_memories USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "topic_family_key_aliases_bot_id_old_canonicalization_versio_key",
    "table_name": "topic_family_key_aliases",
    "definition": "CREATE UNIQUE INDEX topic_family_key_aliases_bot_id_old_canonicalization_versio_key ON memory.topic_family_key_aliases USING btree (bot_id, old_canonicalization_version, old_topic_family_key, new_canonicalization_version, new_topic_family_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "topic_family_key_aliases_pkey",
    "table_name": "topic_family_key_aliases",
    "definition": "CREATE UNIQUE INDEX topic_family_key_aliases_pkey ON memory.topic_family_key_aliases USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "topic_key_aliases_bot_id_old_canonicalization_version_old_t_key",
    "table_name": "topic_key_aliases",
    "definition": "CREATE UNIQUE INDEX topic_key_aliases_bot_id_old_canonicalization_version_old_t_key ON memory.topic_key_aliases USING btree (bot_id, old_canonicalization_version, old_topic_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "topic_key_aliases_pkey",
    "table_name": "topic_key_aliases",
    "definition": "CREATE UNIQUE INDEX topic_key_aliases_pkey ON memory.topic_key_aliases USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  }
] as const;

export const MEMORY_FOREIGN_KEYS_V1 = [
  {
    "constraint_name": "memory_audit_logs_feedback_event_id_fkey",
    "table_name": "memory_audit_logs",
    "columns": [
      "feedback_event_id"
    ],
    "referenced_schema": "memory",
    "referenced_table": "memory_feedback_events",
    "referenced_columns": [
      "id"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_audit_logs_revision_id_fkey",
    "table_name": "memory_audit_logs",
    "columns": [
      "revision_id"
    ],
    "referenced_schema": "memory",
    "referenced_table": "memory_state_revisions",
    "referenced_columns": [
      "id"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_command_dlq_command_outbox_id_fkey",
    "table_name": "memory_command_dlq",
    "columns": [
      "command_outbox_id"
    ],
    "referenced_schema": "memory",
    "referenced_table": "memory_command_outbox",
    "referenced_columns": [
      "id"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_command_dlq_resolutions_dlq_id_fkey",
    "table_name": "memory_command_dlq_resolutions",
    "columns": [
      "dlq_id"
    ],
    "referenced_schema": "memory",
    "referenced_table": "memory_command_dlq",
    "referenced_columns": [
      "id"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_conflicts_left_memory_point_id_fkey",
    "table_name": "memory_conflicts",
    "columns": [
      "left_memory_point_id"
    ],
    "referenced_schema": "memory",
    "referenced_table": "memory_points",
    "referenced_columns": [
      "id"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_conflicts_right_memory_point_id_fkey",
    "table_name": "memory_conflicts",
    "columns": [
      "right_memory_point_id"
    ],
    "referenced_schema": "memory",
    "referenced_table": "memory_points",
    "referenced_columns": [
      "id"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_conflicts_series_id_fkey",
    "table_name": "memory_conflicts",
    "columns": [
      "series_id"
    ],
    "referenced_schema": "memory",
    "referenced_table": "memory_series",
    "referenced_columns": [
      "id"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_event_dlq_resolutions_dlq_id_fkey",
    "table_name": "memory_event_dlq_resolutions",
    "columns": [
      "dlq_id"
    ],
    "referenced_schema": "memory",
    "referenced_table": "memory_event_dlq",
    "referenced_columns": [
      "id"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_feedback_audit_refs_audit_id_fkey",
    "table_name": "memory_feedback_audit_refs",
    "columns": [
      "audit_id"
    ],
    "referenced_schema": "memory",
    "referenced_table": "memory_audit_logs",
    "referenced_columns": [
      "id"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_feedback_audit_refs_feedback_event_id_fkey",
    "table_name": "memory_feedback_audit_refs",
    "columns": [
      "feedback_event_id"
    ],
    "referenced_schema": "memory",
    "referenced_table": "memory_feedback_events",
    "referenced_columns": [
      "id"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "cascade",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_feedback_event_refs_event_id_fkey",
    "table_name": "memory_feedback_event_refs",
    "columns": [
      "event_id"
    ],
    "referenced_schema": "memory",
    "referenced_table": "memory_event_outbox",
    "referenced_columns": [
      "id"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_feedback_event_refs_feedback_event_id_fkey",
    "table_name": "memory_feedback_event_refs",
    "columns": [
      "feedback_event_id"
    ],
    "referenced_schema": "memory",
    "referenced_table": "memory_feedback_events",
    "referenced_columns": [
      "id"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "cascade",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_feedback_revision_refs_feedback_event_id_fkey",
    "table_name": "memory_feedback_revision_refs",
    "columns": [
      "feedback_event_id"
    ],
    "referenced_schema": "memory",
    "referenced_table": "memory_feedback_events",
    "referenced_columns": [
      "id"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "cascade",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_feedback_revision_refs_revision_id_fkey",
    "table_name": "memory_feedback_revision_refs",
    "columns": [
      "revision_id"
    ],
    "referenced_schema": "memory",
    "referenced_table": "memory_state_revisions",
    "referenced_columns": [
      "id"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_integration_change_receipts_integration_job_id_fkey",
    "table_name": "memory_integration_change_receipts",
    "columns": [
      "integration_job_id"
    ],
    "referenced_schema": "memory",
    "referenced_table": "memory_integration_jobs",
    "referenced_columns": [
      "id"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_integration_job_leases_integration_job_id_fkey",
    "table_name": "memory_integration_job_leases",
    "columns": [
      "integration_job_id"
    ],
    "referenced_schema": "memory",
    "referenced_table": "memory_integration_jobs",
    "referenced_columns": [
      "id"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_linkage_operations_source_memory_point_id_fkey",
    "table_name": "memory_linkage_operations",
    "columns": [
      "source_memory_point_id"
    ],
    "referenced_schema": "memory",
    "referenced_table": "memory_points",
    "referenced_columns": [
      "id"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_point_search_index_embedding_profile_id_fkey",
    "table_name": "memory_point_search_index",
    "columns": [
      "embedding_profile_id"
    ],
    "referenced_schema": "memory",
    "referenced_table": "memory_embedding_profiles",
    "referenced_columns": [
      "id"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_point_search_index_memory_point_id_fkey",
    "table_name": "memory_point_search_index",
    "columns": [
      "memory_point_id"
    ],
    "referenced_schema": "memory",
    "referenced_table": "memory_points",
    "referenced_columns": [
      "id"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "cascade",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_point_search_index_series_id_fkey",
    "table_name": "memory_point_search_index",
    "columns": [
      "series_id"
    ],
    "referenced_schema": "memory",
    "referenced_table": "memory_series",
    "referenced_columns": [
      "id"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_points_embedding_profile_id_fkey",
    "table_name": "memory_points",
    "columns": [
      "embedding_profile_id"
    ],
    "referenced_schema": "memory",
    "referenced_table": "memory_embedding_profiles",
    "referenced_columns": [
      "id"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_points_series_id_fkey",
    "table_name": "memory_points",
    "columns": [
      "series_id"
    ],
    "referenced_schema": "memory",
    "referenced_table": "memory_series",
    "referenced_columns": [
      "id"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_pre_promotion_identity_current_fk",
    "table_name": "memory_pre_promotion_check_identities",
    "columns": [
      "bot_id",
      "idempotency_key",
      "current_check_generation",
      "current_check_id"
    ],
    "referenced_schema": "memory",
    "referenced_table": "memory_pre_promotion_checks",
    "referenced_columns": [
      "bot_id",
      "idempotency_key",
      "check_generation",
      "id"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": true,
    "initially_deferred": true,
    "validated": true
  },
  {
    "constraint_name": "memory_pre_promotion_checks_identity_fk",
    "table_name": "memory_pre_promotion_checks",
    "columns": [
      "bot_id",
      "idempotency_key",
      "request_hash"
    ],
    "referenced_schema": "memory",
    "referenced_table": "memory_pre_promotion_check_identities",
    "referenced_columns": [
      "bot_id",
      "idempotency_key",
      "request_hash"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_promotion_reservation_targets_reservation_id_fkey",
    "table_name": "memory_promotion_reservation_targets",
    "columns": [
      "reservation_id"
    ],
    "referenced_schema": "memory",
    "referenced_table": "memory_promotion_reservations",
    "referenced_columns": [
      "id"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "cascade",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_promotion_reservation_check_generation_fk",
    "table_name": "memory_promotion_reservations",
    "columns": [
      "check_id",
      "check_generation"
    ],
    "referenced_schema": "memory",
    "referenced_table": "memory_pre_promotion_checks",
    "referenced_columns": [
      "id",
      "check_generation"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_promotion_reservations_check_id_fkey",
    "table_name": "memory_promotion_reservations",
    "columns": [
      "check_id"
    ],
    "referenced_schema": "memory",
    "referenced_table": "memory_pre_promotion_checks",
    "referenced_columns": [
      "id"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_write_item_decisions_batch_id_fkey",
    "table_name": "memory_write_item_decisions",
    "columns": [
      "batch_id"
    ],
    "referenced_schema": "memory",
    "referenced_table": "memory_write_batches",
    "referenced_columns": [
      "id"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_write_item_decisions_conflict_id_fkey",
    "table_name": "memory_write_item_decisions",
    "columns": [
      "conflict_id"
    ],
    "referenced_schema": "memory",
    "referenced_table": "memory_conflicts",
    "referenced_columns": [
      "id"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_write_item_decisions_target_memory_point_id_fkey",
    "table_name": "memory_write_item_decisions",
    "columns": [
      "target_memory_point_id"
    ],
    "referenced_schema": "memory",
    "referenced_table": "memory_points",
    "referenced_columns": [
      "id"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "memory_write_item_decisions_target_series_id_fkey",
    "table_name": "memory_write_item_decisions",
    "columns": [
      "target_series_id"
    ],
    "referenced_schema": "memory",
    "referenced_table": "memory_series",
    "referenced_columns": [
      "id"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "relationship_edges_object_role_id_fkey",
    "table_name": "relationship_edges",
    "columns": [
      "object_role_id"
    ],
    "referenced_schema": "memory",
    "referenced_table": "role_memories",
    "referenced_columns": [
      "id"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "relationship_edges_subject_role_id_fkey",
    "table_name": "relationship_edges",
    "columns": [
      "subject_role_id"
    ],
    "referenced_schema": "memory",
    "referenced_table": "role_memories",
    "referenced_columns": [
      "id"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  }
] as const;
