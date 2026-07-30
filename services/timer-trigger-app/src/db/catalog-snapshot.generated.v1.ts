// Generated from a fresh revision-pinned pai-infra PostgreSQL catalog. Do not edit.
export const TIMER_DATABASE_COLUMNS_V1 = [
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
    "table_name": "timer_audit_logs",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_audit_logs",
    "column_name": "workspace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_audit_logs",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_audit_logs",
    "column_name": "owner_agent_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_audit_logs",
    "column_name": "deployment_environment",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_audit_logs",
    "column_name": "release_channel",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_audit_logs",
    "column_name": "schedule_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_audit_logs",
    "column_name": "occurrence_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_audit_logs",
    "column_name": "event_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_audit_logs",
    "column_name": "actor",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_audit_logs",
    "column_name": "reason",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_audit_logs",
    "column_name": "source_ref",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_audit_logs",
    "column_name": "evidence_refs",
    "not_null": true,
    "default_expression": "'{}'::text[]",
    "identity": "",
    "generated": "",
    "postgres_type": "text[]"
  },
  {
    "table_name": "timer_audit_logs",
    "column_name": "previous_state",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_audit_logs",
    "column_name": "next_state",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_audit_logs",
    "column_name": "schema_version",
    "not_null": true,
    "default_expression": "'timer_audit.v1'::text",
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_audit_logs",
    "column_name": "payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "timer_audit_logs",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "timer_catch_up_batches",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_catch_up_batches",
    "column_name": "workspace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_catch_up_batches",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_catch_up_batches",
    "column_name": "owner_agent_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_catch_up_batches",
    "column_name": "deployment_environment",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_catch_up_batches",
    "column_name": "release_channel",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_catch_up_batches",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_catch_up_batches",
    "column_name": "cursor_occurrence_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_catch_up_batches",
    "column_name": "last_occurrence_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_catch_up_batches",
    "column_name": "last_trigger_process_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_catch_up_batches",
    "column_name": "timeout_seconds",
    "not_null": true,
    "default_expression": "300",
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "timer_catch_up_batches",
    "column_name": "deadline_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "timer_catch_up_batches",
    "column_name": "started_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "timer_catch_up_batches",
    "column_name": "completed_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "timer_catch_up_batches",
    "column_name": "reason_code",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_catch_up_batches",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "timer_catch_up_batches",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "timer_catch_up_batches",
    "column_name": "policy_snapshot",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "timer_command_requests",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_command_requests",
    "column_name": "workspace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_command_requests",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_command_requests",
    "column_name": "owner_agent_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_command_requests",
    "column_name": "deployment_environment",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_command_requests",
    "column_name": "release_channel",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_command_requests",
    "column_name": "runtime_run_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_command_requests",
    "column_name": "trigger_process_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_command_requests",
    "column_name": "method",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_command_requests",
    "column_name": "schedule_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_command_requests",
    "column_name": "client_request_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_command_requests",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_command_requests",
    "column_name": "request_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_command_requests",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_command_requests",
    "column_name": "request",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "timer_command_requests",
    "column_name": "response",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "timer_command_requests",
    "column_name": "error",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "timer_command_requests",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "timer_command_requests",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "timer_dispatch_attempts",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_dispatch_attempts",
    "column_name": "occurrence_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_dispatch_attempts",
    "column_name": "attempt_no",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "timer_dispatch_attempts",
    "column_name": "expected_occurrence_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "timer_dispatch_attempts",
    "column_name": "resulting_occurrence_version",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "timer_dispatch_attempts",
    "column_name": "dispatch_generation",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "timer_dispatch_attempts",
    "column_name": "claim_token",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_dispatch_attempts",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_dispatch_attempts",
    "column_name": "request",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "timer_dispatch_attempts",
    "column_name": "response",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "timer_dispatch_attempts",
    "column_name": "error",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "timer_dispatch_attempts",
    "column_name": "next_retry_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "timer_dispatch_attempts",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "timer_event_dlq",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_event_dlq",
    "column_name": "source_event_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_event_dlq",
    "column_name": "event_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_event_dlq",
    "column_name": "payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "timer_event_dlq",
    "column_name": "last_error",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "timer_event_dlq",
    "column_name": "failed_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "timer_event_dlq_resolutions",
    "column_name": "resolution_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_event_dlq_resolutions",
    "column_name": "dlq_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_event_dlq_resolutions",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_event_dlq_resolutions",
    "column_name": "resolution_kind",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_event_dlq_resolutions",
    "column_name": "resolution_payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "timer_event_dlq_resolutions",
    "column_name": "resolved_by",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_event_dlq_resolutions",
    "column_name": "resolved_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "timer_event_inbox",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_event_inbox",
    "column_name": "source",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_event_inbox",
    "column_name": "event_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_event_inbox",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_event_inbox",
    "column_name": "payload_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_event_inbox",
    "column_name": "semantic_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_event_inbox",
    "column_name": "scope_fingerprint",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_event_inbox",
    "column_name": "processed_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "timer_event_inbox",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "timer_event_outbox",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_event_outbox",
    "column_name": "workspace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_event_outbox",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_event_outbox",
    "column_name": "owner_agent_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_event_outbox",
    "column_name": "deployment_environment",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_event_outbox",
    "column_name": "release_channel",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_event_outbox",
    "column_name": "aggregate_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_event_outbox",
    "column_name": "event_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_event_outbox",
    "column_name": "schema_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_event_outbox",
    "column_name": "producer",
    "not_null": true,
    "default_expression": "'timer_trigger_app'::text",
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_event_outbox",
    "column_name": "occurred_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "timer_event_outbox",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_event_outbox",
    "column_name": "trace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_event_outbox",
    "column_name": "payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "timer_event_outbox",
    "column_name": "payload_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_event_outbox",
    "column_name": "target",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_event_outbox",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_event_outbox",
    "column_name": "attempt_count",
    "not_null": true,
    "default_expression": "0",
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "timer_event_outbox",
    "column_name": "next_retry_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "timer_event_outbox",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "timer_event_outbox",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "timer_event_outbox",
    "column_name": "claimed_by",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_event_outbox",
    "column_name": "claim_token",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_event_outbox",
    "column_name": "acknowledged_claim_token",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_event_outbox",
    "column_name": "locked_until",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "timer_event_outbox",
    "column_name": "last_error",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "timer_event_outbox",
    "column_name": "transport_ref",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_event_outbox",
    "column_name": "transport_epoch",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_event_outbox",
    "column_name": "transport_generation",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "timer_event_outbox",
    "column_name": "sent_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "timer_event_outbox",
    "column_name": "reconciliation_missing_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "timer_event_outbox",
    "column_name": "reconciliation_missing_reporter",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_event_outbox",
    "column_name": "reconciliation_next_probe_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "timer_event_outbox",
    "column_name": "reconciliation_claimed_by",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_event_outbox",
    "column_name": "reconciliation_claim_token",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_event_outbox",
    "column_name": "reconciliation_claim_generation",
    "not_null": false,
    "default_expression": "0",
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "timer_event_outbox",
    "column_name": "reconciliation_locked_until",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "timer_occurrences",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_occurrences",
    "column_name": "schedule_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_occurrences",
    "column_name": "workspace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_occurrences",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_occurrences",
    "column_name": "owner_agent_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_occurrences",
    "column_name": "deployment_environment",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_occurrences",
    "column_name": "release_channel",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_occurrences",
    "column_name": "occurrence_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_occurrences",
    "column_name": "occurrence_version",
    "not_null": true,
    "default_expression": "1",
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "timer_occurrences",
    "column_name": "scheduled_fire_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "timer_occurrences",
    "column_name": "effective_fire_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "timer_occurrences",
    "column_name": "local_date",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "date"
  },
  {
    "table_name": "timer_occurrences",
    "column_name": "local_time",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "time without time zone"
  },
  {
    "table_name": "timer_occurrences",
    "column_name": "timezone",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_occurrences",
    "column_name": "schedule_end_time",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "timer_occurrences",
    "column_name": "schedule_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "timer_occurrences",
    "column_name": "dispatch_payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "timer_occurrences",
    "column_name": "dispatch_payload_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_occurrences",
    "column_name": "payload_schema_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_occurrences",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_occurrences",
    "column_name": "trigger_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_occurrences",
    "column_name": "trigger_process_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_occurrences",
    "column_name": "dedupe_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_occurrences",
    "column_name": "error",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "timer_occurrences",
    "column_name": "attempt_count",
    "not_null": true,
    "default_expression": "0",
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "timer_occurrences",
    "column_name": "next_dispatch_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "timer_occurrences",
    "column_name": "catch_up_batch_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_occurrences",
    "column_name": "is_catch_up",
    "not_null": true,
    "default_expression": "false",
    "identity": "",
    "generated": "",
    "postgres_type": "boolean"
  },
  {
    "table_name": "timer_occurrences",
    "column_name": "locked_by",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_occurrences",
    "column_name": "locked_until",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "timer_occurrences",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "timer_occurrences",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "timer_occurrences",
    "column_name": "dispatch_generation",
    "not_null": true,
    "default_expression": "0",
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "timer_occurrences",
    "column_name": "claim_token",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_occurrences",
    "column_name": "cancel_requested_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "timer_query_requests",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_query_requests",
    "column_name": "workspace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_query_requests",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_query_requests",
    "column_name": "owner_agent_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_query_requests",
    "column_name": "deployment_environment",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_query_requests",
    "column_name": "release_channel",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_query_requests",
    "column_name": "runtime_run_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_query_requests",
    "column_name": "method",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_query_requests",
    "column_name": "schedule_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_query_requests",
    "column_name": "request_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_query_requests",
    "column_name": "response_hash",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_query_requests",
    "column_name": "trace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_query_requests",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "timer_scanner_checkpoints",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_scanner_checkpoints",
    "column_name": "scanner_name",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_scanner_checkpoints",
    "column_name": "last_scanned_until",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "timer_scanner_checkpoints",
    "column_name": "locked_by",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_scanner_checkpoints",
    "column_name": "locked_until",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "timer_scanner_checkpoints",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "timer_scanner_checkpoints",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "timer_schedules",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_schedules",
    "column_name": "workspace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_schedules",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_schedules",
    "column_name": "owner_agent_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_schedules",
    "column_name": "deployment_environment",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_schedules",
    "column_name": "release_channel",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_schedules",
    "column_name": "name",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_schedules",
    "column_name": "message",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_schedules",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_schedules",
    "column_name": "schedule_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_schedules",
    "column_name": "rrule",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_schedules",
    "column_name": "fire_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "timer_schedules",
    "column_name": "timezone",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_schedules",
    "column_name": "end_time",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "timer_schedules",
    "column_name": "payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "timer_schedules",
    "column_name": "catch_up",
    "not_null": true,
    "default_expression": "true",
    "identity": "",
    "generated": "",
    "postgres_type": "boolean"
  },
  {
    "table_name": "timer_schedules",
    "column_name": "max_catch_up_window_seconds",
    "not_null": true,
    "default_expression": "86400",
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "timer_schedules",
    "column_name": "max_catch_up_occurrences",
    "not_null": true,
    "default_expression": "100",
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "timer_schedules",
    "column_name": "next_fire_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "timer_schedules",
    "column_name": "schedule_version",
    "not_null": true,
    "default_expression": "1",
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "timer_schedules",
    "column_name": "created_by",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_schedules",
    "column_name": "created_by_runtime_run_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_schedules",
    "column_name": "created_by_trigger_process_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_schedules",
    "column_name": "client_request_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_schedules",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "timer_schedules",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "timer_schedules",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  }
] as const;

export const TIMER_DATABASE_CHECKS_V1 = [
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
    "constraint_name": "timer_audit_logs_deployment_environment_check",
    "table_name": "timer_audit_logs",
    "required_definition_fragments": [
      "CHECK (deployment_environment = ANY (ARRAY['local'::text, 'dev'::text, 'staging'::text, 'prod'::text]))"
    ]
  },
  {
    "constraint_name": "timer_audit_logs_event_type_check",
    "table_name": "timer_audit_logs",
    "required_definition_fragments": [
      "CHECK (event_type = ANY (ARRAY['timer.schedule.created'::text, 'timer.schedule.updated'::text, 'timer.schedule.paused'::text, 'timer.schedule.resumed'::text, 'timer.schedule.cancelled'::text, 'timer.schedule.completed'::text, 'timer.schedule.expired'::text, 'timer.schedule.failed'::text, 'timer.occurrence.due'::text, 'timer.occurrence.snoozed'::text, 'timer.occurrence.dispatched'::text, 'timer.occurrence.skipped'::text, 'timer.occurrence.failed'::text, 'timer.occurrence.cancelled'::text, 'timer.catch_up.batch_created'::text, 'timer.catch_up.occurrence_summarized'::text, 'timer.catch_up.timeout'::text, 'timer.dst.shifted'::text, 'timer.missed_recovery.scanned'::text]))"
    ],
    "semantic_constraint": {
      "kind": "text_enum",
      "column_name": "event_type",
      "allowed_values": [
        "timer.schedule.created",
        "timer.schedule.updated",
        "timer.schedule.paused",
        "timer.schedule.resumed",
        "timer.schedule.cancelled",
        "timer.schedule.completed",
        "timer.schedule.expired",
        "timer.schedule.failed",
        "timer.occurrence.due",
        "timer.occurrence.snoozed",
        "timer.occurrence.dispatched",
        "timer.occurrence.skipped",
        "timer.occurrence.failed",
        "timer.occurrence.cancelled",
        "timer.catch_up.batch_created",
        "timer.catch_up.occurrence_summarized",
        "timer.catch_up.timeout",
        "timer.dst.shifted",
        "timer.missed_recovery.scanned"
      ]
    }
  },
  {
    "constraint_name": "timer_audit_logs_release_channel_check",
    "table_name": "timer_audit_logs",
    "required_definition_fragments": [
      "CHECK (release_channel = ANY (ARRAY['stable'::text, 'canary'::text]))"
    ]
  },
  {
    "constraint_name": "timer_catch_up_batches_check",
    "table_name": "timer_catch_up_batches",
    "required_definition_fragments": [
      "CHECK (deadline_at > started_at)"
    ]
  },
  {
    "constraint_name": "timer_catch_up_batches_check1",
    "table_name": "timer_catch_up_batches",
    "required_definition_fragments": [
      "CHECK (status = 'running'::text AND completed_at IS NULL OR (status = ANY (ARRAY['completed'::text, 'timed_out'::text, 'cancelled'::text])) AND completed_at IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "timer_catch_up_batches_check2",
    "table_name": "timer_catch_up_batches",
    "required_definition_fragments": [
      "CHECK ((status <> ALL (ARRAY['timed_out'::text, 'cancelled'::text])) OR reason_code IS NOT NULL AND length(reason_code) > 0)"
    ]
  },
  {
    "constraint_name": "timer_catch_up_batches_deployment_environment_check",
    "table_name": "timer_catch_up_batches",
    "required_definition_fragments": [
      "CHECK (deployment_environment = ANY (ARRAY['local'::text, 'dev'::text, 'staging'::text, 'prod'::text]))"
    ]
  },
  {
    "constraint_name": "timer_catch_up_batches_policy_snapshot_check",
    "table_name": "timer_catch_up_batches",
    "required_definition_fragments": [
      "CHECK (jsonb_typeof(policy_snapshot) = 'object'::text)"
    ]
  },
  {
    "constraint_name": "timer_catch_up_batches_release_channel_check",
    "table_name": "timer_catch_up_batches",
    "required_definition_fragments": [
      "CHECK (release_channel = ANY (ARRAY['stable'::text, 'canary'::text]))"
    ]
  },
  {
    "constraint_name": "timer_catch_up_batches_status_check",
    "table_name": "timer_catch_up_batches",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['running'::text, 'completed'::text, 'timed_out'::text, 'cancelled'::text]))"
    ]
  },
  {
    "constraint_name": "timer_catch_up_batches_timeout_seconds_check",
    "table_name": "timer_catch_up_batches",
    "required_definition_fragments": [
      "CHECK (timeout_seconds >= 1 AND timeout_seconds <= 3600)"
    ]
  },
  {
    "constraint_name": "timer_command_requests_deployment_environment_check",
    "table_name": "timer_command_requests",
    "required_definition_fragments": [
      "CHECK (deployment_environment = ANY (ARRAY['local'::text, 'dev'::text, 'staging'::text, 'prod'::text]))"
    ]
  },
  {
    "constraint_name": "timer_command_requests_method_check",
    "table_name": "timer_command_requests",
    "required_definition_fragments": [
      "CHECK (method = ANY (ARRAY['timer.create'::text, 'timer.remind_after'::text, 'timer.remind_at'::text, 'timer.create_recurring'::text, 'timer.update'::text, 'timer.pause'::text, 'timer.resume'::text, 'timer.cancel'::text, 'timer.snooze'::text]))"
    ]
  },
  {
    "constraint_name": "timer_command_requests_release_channel_check",
    "table_name": "timer_command_requests",
    "required_definition_fragments": [
      "CHECK (release_channel = ANY (ARRAY['stable'::text, 'canary'::text]))"
    ]
  },
  {
    "constraint_name": "timer_command_requests_status_check",
    "table_name": "timer_command_requests",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['accepted'::text, 'completed'::text, 'failed'::text]))"
    ]
  },
  {
    "constraint_name": "timer_dispatch_attempts_attempt_no_check",
    "table_name": "timer_dispatch_attempts",
    "required_definition_fragments": [
      "CHECK (attempt_no > 0)"
    ]
  },
  {
    "constraint_name": "timer_dispatch_attempts_check",
    "table_name": "timer_dispatch_attempts",
    "required_definition_fragments": [
      "CHECK (resulting_occurrence_version IS NULL OR resulting_occurrence_version = (expected_occurrence_version + 1))"
    ]
  },
  {
    "constraint_name": "timer_dispatch_attempts_dispatch_generation_check",
    "table_name": "timer_dispatch_attempts",
    "required_definition_fragments": [
      "CHECK (dispatch_generation > 0)"
    ]
  },
  {
    "constraint_name": "timer_dispatch_attempts_expected_occurrence_version_check",
    "table_name": "timer_dispatch_attempts",
    "required_definition_fragments": [
      "CHECK (expected_occurrence_version > 0)"
    ]
  },
  {
    "constraint_name": "timer_dispatch_attempts_resulting_occurrence_version_check",
    "table_name": "timer_dispatch_attempts",
    "required_definition_fragments": [
      "CHECK (resulting_occurrence_version > 0)"
    ]
  },
  {
    "constraint_name": "timer_dispatch_attempts_status_check",
    "table_name": "timer_dispatch_attempts",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['pending'::text, 'success'::text, 'retry_wait'::text, 'failed'::text]))"
    ]
  },
  {
    "constraint_name": "timer_event_dlq_resolutions_resolution_payload_check",
    "table_name": "timer_event_dlq_resolutions",
    "required_definition_fragments": [
      "CHECK (jsonb_typeof(resolution_payload) = 'object'::text)"
    ]
  },
  {
    "constraint_name": "timer_event_inbox_event_id_check",
    "table_name": "timer_event_inbox",
    "required_definition_fragments": [
      "CHECK (length(event_id) > 0)"
    ]
  },
  {
    "constraint_name": "timer_event_inbox_payload_hash_check",
    "table_name": "timer_event_inbox",
    "required_definition_fragments": [
      "CHECK (length(payload_hash) > 0)"
    ]
  },
  {
    "constraint_name": "timer_event_inbox_scope_fingerprint_check",
    "table_name": "timer_event_inbox",
    "required_definition_fragments": [
      "CHECK (length(scope_fingerprint) > 0)"
    ]
  },
  {
    "constraint_name": "timer_event_inbox_semantic_hash_check",
    "table_name": "timer_event_inbox",
    "required_definition_fragments": [
      "CHECK (length(semantic_hash) > 0)"
    ]
  },
  {
    "constraint_name": "timer_event_outbox_ack_fence_check",
    "table_name": "timer_event_outbox",
    "required_definition_fragments": [
      "CHECK ((status = 'sent'::text) = (acknowledged_claim_token IS NOT NULL))"
    ]
  },
  {
    "constraint_name": "timer_event_outbox_check",
    "table_name": "timer_event_outbox",
    "required_definition_fragments": [
      "CHECK ((payload ->> 'workspace_id'::text) = workspace_id AND (payload ->> 'bot_id'::text) = bot_id AND (payload ->> 'owner_agent_id'::text) = owner_agent_id AND (payload ->> 'deployment_environment'::text) = deployment_environment AND (payload ->> 'release_channel'::text) = release_channel AND (payload ->> 'aggregate_id'::text) = aggregate_id)"
    ]
  },
  {
    "constraint_name": "timer_event_outbox_claim_fence_check",
    "table_name": "timer_event_outbox",
    "required_definition_fragments": [
      "CHECK ((status = 'dispatching'::text) = (claimed_by IS NOT NULL AND claim_token IS NOT NULL AND locked_until IS NOT NULL))"
    ]
  },
  {
    "constraint_name": "timer_event_outbox_deployment_environment_check",
    "table_name": "timer_event_outbox",
    "required_definition_fragments": [
      "CHECK (deployment_environment = ANY (ARRAY['local'::text, 'dev'::text, 'staging'::text, 'prod'::text]))"
    ]
  },
  {
    "constraint_name": "timer_event_outbox_event_type_check",
    "table_name": "timer_event_outbox",
    "required_definition_fragments": [
      "CHECK (event_type = ANY (ARRAY['timer.schedule.created'::text, 'timer.schedule.updated'::text, 'timer.schedule.paused'::text, 'timer.schedule.resumed'::text, 'timer.schedule.cancelled'::text, 'timer.schedule.completed'::text, 'timer.schedule.expired'::text, 'timer.schedule.failed'::text, 'timer.occurrence.due'::text, 'timer.occurrence.dispatched'::text, 'timer.occurrence.skipped'::text, 'timer.occurrence.failed'::text, 'timer.occurrence.cancelled'::text, 'timer.occurrence.snoozed'::text, 'timer.catch_up.batch_created'::text, 'timer.catch_up.occurrence_summarized'::text]))"
    ],
    "semantic_constraint": {
      "kind": "text_enum",
      "column_name": "event_type",
      "allowed_values": [
        "timer.schedule.created",
        "timer.schedule.updated",
        "timer.schedule.paused",
        "timer.schedule.resumed",
        "timer.schedule.cancelled",
        "timer.schedule.completed",
        "timer.schedule.expired",
        "timer.schedule.failed",
        "timer.occurrence.due",
        "timer.occurrence.dispatched",
        "timer.occurrence.skipped",
        "timer.occurrence.failed",
        "timer.occurrence.cancelled",
        "timer.occurrence.snoozed",
        "timer.catch_up.batch_created",
        "timer.catch_up.occurrence_summarized"
      ]
    }
  },
  {
    "constraint_name": "timer_event_outbox_producer_check",
    "table_name": "timer_event_outbox",
    "required_definition_fragments": [
      "CHECK (producer = 'timer_trigger_app'::text)"
    ],
    "semantic_constraint": {
      "kind": "text_equals",
      "column_name": "producer",
      "value": "timer_trigger_app"
    }
  },
  {
    "constraint_name": "timer_event_outbox_reconciliation_generation_check",
    "table_name": "timer_event_outbox",
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
    "constraint_name": "timer_event_outbox_release_channel_check",
    "table_name": "timer_event_outbox",
    "required_definition_fragments": [
      "CHECK (release_channel = ANY (ARRAY['stable'::text, 'canary'::text]))"
    ]
  },
  {
    "constraint_name": "timer_event_outbox_sent_at_check",
    "table_name": "timer_event_outbox",
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
    "constraint_name": "timer_event_outbox_sent_transport_epoch_check",
    "table_name": "timer_event_outbox",
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
    "constraint_name": "timer_event_outbox_sent_transport_generation_check",
    "table_name": "timer_event_outbox",
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
    "constraint_name": "timer_event_outbox_sent_transport_ref_check",
    "table_name": "timer_event_outbox",
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
    "constraint_name": "timer_event_outbox_status_check",
    "table_name": "timer_event_outbox",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['pending'::text, 'dispatching'::text, 'sent'::text, 'retry_wait'::text, 'failed'::text]))"
    ]
  },
  {
    "constraint_name": "timer_event_outbox_transport_generation_safe_check",
    "table_name": "timer_event_outbox",
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
    "constraint_name": "timer_occurrences_attempt_count_check",
    "table_name": "timer_occurrences",
    "required_definition_fragments": [
      "CHECK (attempt_count >= 0)"
    ]
  },
  {
    "constraint_name": "timer_occurrences_check",
    "table_name": "timer_occurrences",
    "required_definition_fragments": [
      "CHECK (schedule_end_time IS NULL OR scheduled_fire_at <= schedule_end_time)"
    ]
  },
  {
    "constraint_name": "timer_occurrences_deployment_environment_check",
    "table_name": "timer_occurrences",
    "required_definition_fragments": [
      "CHECK (deployment_environment = ANY (ARRAY['local'::text, 'dev'::text, 'staging'::text, 'prod'::text]))"
    ]
  },
  {
    "constraint_name": "timer_occurrences_dispatch_generation_check",
    "table_name": "timer_occurrences",
    "required_definition_fragments": [
      "CHECK (dispatch_generation >= 0 AND dispatch_generation <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "integer_range",
      "column_name": "dispatch_generation",
      "min": 0,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "timer_occurrences_dispatch_payload_hash_check",
    "table_name": "timer_occurrences",
    "required_definition_fragments": [
      "CHECK (length(dispatch_payload_hash) > 0)"
    ]
  },
  {
    "constraint_name": "timer_occurrences_occurrence_version_check",
    "table_name": "timer_occurrences",
    "required_definition_fragments": [
      "CHECK (occurrence_version > 0)"
    ]
  },
  {
    "constraint_name": "timer_occurrences_payload_schema_version_check",
    "table_name": "timer_occurrences",
    "required_definition_fragments": [
      "CHECK (payload_schema_version = 'timer.trigger_payload.v1'::text)"
    ]
  },
  {
    "constraint_name": "timer_occurrences_release_channel_check",
    "table_name": "timer_occurrences",
    "required_definition_fragments": [
      "CHECK (release_channel = ANY (ARRAY['stable'::text, 'canary'::text]))"
    ]
  },
  {
    "constraint_name": "timer_occurrences_schedule_version_check",
    "table_name": "timer_occurrences",
    "required_definition_fragments": [
      "CHECK (schedule_version > 0)"
    ]
  },
  {
    "constraint_name": "timer_occurrences_status_check",
    "table_name": "timer_occurrences",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['pending'::text, 'dispatching'::text, 'retry_wait'::text, 'dispatched'::text, 'failed'::text, 'skipped'::text, 'cancelled'::text]))"
    ]
  },
  {
    "constraint_name": "timer_query_requests_deployment_environment_check",
    "table_name": "timer_query_requests",
    "required_definition_fragments": [
      "CHECK (deployment_environment = ANY (ARRAY['local'::text, 'dev'::text, 'staging'::text, 'prod'::text]))"
    ]
  },
  {
    "constraint_name": "timer_query_requests_method_check",
    "table_name": "timer_query_requests",
    "required_definition_fragments": [
      "CHECK (method = ANY (ARRAY['timer.list'::text, 'timer.get'::text, 'timer.history'::text]))"
    ]
  },
  {
    "constraint_name": "timer_query_requests_release_channel_check",
    "table_name": "timer_query_requests",
    "required_definition_fragments": [
      "CHECK (release_channel = ANY (ARRAY['stable'::text, 'canary'::text]))"
    ]
  },
  {
    "constraint_name": "timer_schedules_check",
    "table_name": "timer_schedules",
    "required_definition_fragments": [
      "CHECK (schedule_type = 'once'::text AND fire_at IS NOT NULL AND rrule IS NULL OR schedule_type = 'recurring'::text AND rrule IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "timer_schedules_check1",
    "table_name": "timer_schedules",
    "required_definition_fragments": [
      "CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text])) AND next_fire_at IS NOT NULL OR (status = ANY (ARRAY['cancelled'::text, 'completed'::text, 'expired'::text, 'failed'::text])))"
    ]
  },
  {
    "constraint_name": "timer_schedules_check2",
    "table_name": "timer_schedules",
    "required_definition_fragments": [
      "CHECK (end_time IS NULL OR next_fire_at IS NULL OR end_time >= next_fire_at)"
    ]
  },
  {
    "constraint_name": "timer_schedules_deployment_environment_check",
    "table_name": "timer_schedules",
    "required_definition_fragments": [
      "CHECK (deployment_environment = ANY (ARRAY['local'::text, 'dev'::text, 'staging'::text, 'prod'::text]))"
    ]
  },
  {
    "constraint_name": "timer_schedules_max_catch_up_occurrences_check",
    "table_name": "timer_schedules",
    "required_definition_fragments": [
      "CHECK (max_catch_up_occurrences > 0)"
    ]
  },
  {
    "constraint_name": "timer_schedules_max_catch_up_window_seconds_check",
    "table_name": "timer_schedules",
    "required_definition_fragments": [
      "CHECK (max_catch_up_window_seconds > 0)"
    ]
  },
  {
    "constraint_name": "timer_schedules_release_channel_check",
    "table_name": "timer_schedules",
    "required_definition_fragments": [
      "CHECK (release_channel = ANY (ARRAY['stable'::text, 'canary'::text]))"
    ]
  },
  {
    "constraint_name": "timer_schedules_schedule_type_check",
    "table_name": "timer_schedules",
    "required_definition_fragments": [
      "CHECK (schedule_type = ANY (ARRAY['once'::text, 'recurring'::text]))"
    ]
  },
  {
    "constraint_name": "timer_schedules_schedule_version_check",
    "table_name": "timer_schedules",
    "required_definition_fragments": [
      "CHECK (schedule_version > 0)"
    ]
  },
  {
    "constraint_name": "timer_schedules_status_check",
    "table_name": "timer_schedules",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['active'::text, 'paused'::text, 'cancelled'::text, 'completed'::text, 'expired'::text, 'failed'::text]))"
    ]
  }
] as const;

export const TIMER_DATABASE_FUNCTIONS_V1 = [] as const;

export const TIMER_DATABASE_TRIGGERS_V1 = [] as const;

export const TIMER_DATABASE_UNIQUE_CONSTRAINTS_V1 = [
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
    "constraint_name": "timer_audit_logs_pkey",
    "table_name": "timer_audit_logs",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "timer_catch_up_batches_id_workspace_id_bot_id_owner_agent_i_key",
    "table_name": "timer_catch_up_batches",
    "columns": [
      "id",
      "workspace_id",
      "bot_id",
      "owner_agent_id",
      "deployment_environment",
      "release_channel"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "timer_catch_up_batches_pkey",
    "table_name": "timer_catch_up_batches",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "timer_command_requests_pkey",
    "table_name": "timer_command_requests",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "timer_command_requests_runtime_run_id_idempotency_key_key",
    "table_name": "timer_command_requests",
    "columns": [
      "runtime_run_id",
      "idempotency_key"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "timer_command_requests_runtime_run_id_method_client_request_key",
    "table_name": "timer_command_requests",
    "columns": [
      "runtime_run_id",
      "method",
      "client_request_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "timer_dispatch_attempts_occurrence_id_attempt_no_key",
    "table_name": "timer_dispatch_attempts",
    "columns": [
      "occurrence_id",
      "attempt_no"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "timer_dispatch_attempts_occurrence_id_dispatch_generation_key",
    "table_name": "timer_dispatch_attempts",
    "columns": [
      "occurrence_id",
      "dispatch_generation"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "timer_dispatch_attempts_pkey",
    "table_name": "timer_dispatch_attempts",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "timer_event_dlq_pkey",
    "table_name": "timer_event_dlq",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "timer_event_dlq_resolutions_dlq_id_key",
    "table_name": "timer_event_dlq_resolutions",
    "columns": [
      "dlq_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "timer_event_dlq_resolutions_idempotency_key_key",
    "table_name": "timer_event_dlq_resolutions",
    "columns": [
      "idempotency_key"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "timer_event_dlq_resolutions_pkey",
    "table_name": "timer_event_dlq_resolutions",
    "columns": [
      "resolution_id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "timer_event_inbox_pkey",
    "table_name": "timer_event_inbox",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "timer_event_inbox_source_event_id_key",
    "table_name": "timer_event_inbox",
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
    "constraint_name": "timer_event_inbox_source_idempotency_key_key",
    "table_name": "timer_event_inbox",
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
    "constraint_name": "timer_event_outbox_pkey",
    "table_name": "timer_event_outbox",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "timer_event_outbox_target_idempotency_key_key",
    "table_name": "timer_event_outbox",
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
    "constraint_name": "timer_occurrences_dedupe_key_key",
    "table_name": "timer_occurrences",
    "columns": [
      "dedupe_key"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "timer_occurrences_id_schedule_id_workspace_id_bot_id_owner__key",
    "table_name": "timer_occurrences",
    "columns": [
      "id",
      "schedule_id",
      "workspace_id",
      "bot_id",
      "owner_agent_id",
      "deployment_environment",
      "release_channel"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "timer_occurrences_pkey",
    "table_name": "timer_occurrences",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "timer_occurrences_schedule_id_schedule_version_occurrence_k_key",
    "table_name": "timer_occurrences",
    "columns": [
      "schedule_id",
      "schedule_version",
      "occurrence_key"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "timer_occurrences_schedule_id_schedule_version_scheduled_fi_key",
    "table_name": "timer_occurrences",
    "columns": [
      "schedule_id",
      "schedule_version",
      "scheduled_fire_at"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "timer_query_requests_pkey",
    "table_name": "timer_query_requests",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "timer_scanner_checkpoints_pkey",
    "table_name": "timer_scanner_checkpoints",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "timer_scanner_checkpoints_scanner_name_key",
    "table_name": "timer_scanner_checkpoints",
    "columns": [
      "scanner_name"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "timer_schedules_created_by_runtime_run_id_idempotency_key_key",
    "table_name": "timer_schedules",
    "columns": [
      "created_by_runtime_run_id",
      "idempotency_key"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "timer_schedules_id_workspace_id_bot_id_owner_agent_id_deplo_key",
    "table_name": "timer_schedules",
    "columns": [
      "id",
      "workspace_id",
      "bot_id",
      "owner_agent_id",
      "deployment_environment",
      "release_channel"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "timer_schedules_pkey",
    "table_name": "timer_schedules",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  }
] as const;

export const TIMER_DATABASE_INDEXES_V1 = [
  {
    "index_name": "eventing_transport_epochs_pkey",
    "table_name": "eventing_transport_epochs",
    "definition": "CREATE UNIQUE INDEX eventing_transport_epochs_pkey ON timer.eventing_transport_epochs USING btree (transport_name)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "timer_audit_logs_pkey",
    "table_name": "timer_audit_logs",
    "definition": "CREATE UNIQUE INDEX timer_audit_logs_pkey ON timer.timer_audit_logs USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "timer_audit_logs_scope_created_idx",
    "table_name": "timer_audit_logs",
    "definition": "CREATE INDEX timer_audit_logs_scope_created_idx ON timer.timer_audit_logs USING btree (workspace_id, bot_id, owner_agent_id, deployment_environment, release_channel, created_at DESC)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "timer_catch_up_batches_deadline_idx",
    "table_name": "timer_catch_up_batches",
    "definition": "CREATE INDEX timer_catch_up_batches_deadline_idx ON timer.timer_catch_up_batches USING btree (status, deadline_at, workspace_id, bot_id) WHERE (status = 'running'::text)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "timer_catch_up_batches_id_workspace_id_bot_id_owner_agent_i_key",
    "table_name": "timer_catch_up_batches",
    "definition": "CREATE UNIQUE INDEX timer_catch_up_batches_id_workspace_id_bot_id_owner_agent_i_key ON timer.timer_catch_up_batches USING btree (id, workspace_id, bot_id, owner_agent_id, deployment_environment, release_channel)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "timer_catch_up_batches_pkey",
    "table_name": "timer_catch_up_batches",
    "definition": "CREATE UNIQUE INDEX timer_catch_up_batches_pkey ON timer.timer_catch_up_batches USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "timer_one_running_catch_up_batch_per_scope_uq",
    "table_name": "timer_catch_up_batches",
    "definition": "CREATE UNIQUE INDEX timer_one_running_catch_up_batch_per_scope_uq ON timer.timer_catch_up_batches USING btree (workspace_id, bot_id, owner_agent_id, deployment_environment, release_channel) WHERE (status = 'running'::text)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "timer_command_requests_pkey",
    "table_name": "timer_command_requests",
    "definition": "CREATE UNIQUE INDEX timer_command_requests_pkey ON timer.timer_command_requests USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "timer_command_requests_runtime_idx",
    "table_name": "timer_command_requests",
    "definition": "CREATE INDEX timer_command_requests_runtime_idx ON timer.timer_command_requests USING btree (runtime_run_id, created_at DESC)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "timer_command_requests_runtime_run_id_idempotency_key_key",
    "table_name": "timer_command_requests",
    "definition": "CREATE UNIQUE INDEX timer_command_requests_runtime_run_id_idempotency_key_key ON timer.timer_command_requests USING btree (runtime_run_id, idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "timer_command_requests_runtime_run_id_method_client_request_key",
    "table_name": "timer_command_requests",
    "definition": "CREATE UNIQUE INDEX timer_command_requests_runtime_run_id_method_client_request_key ON timer.timer_command_requests USING btree (runtime_run_id, method, client_request_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "timer_command_requests_scope_idx",
    "table_name": "timer_command_requests",
    "definition": "CREATE INDEX timer_command_requests_scope_idx ON timer.timer_command_requests USING btree (workspace_id, bot_id, owner_agent_id, deployment_environment, release_channel, runtime_run_id, method, created_at DESC)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "timer_dispatch_attempts_occurrence_id_attempt_no_key",
    "table_name": "timer_dispatch_attempts",
    "definition": "CREATE UNIQUE INDEX timer_dispatch_attempts_occurrence_id_attempt_no_key ON timer.timer_dispatch_attempts USING btree (occurrence_id, attempt_no)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "timer_dispatch_attempts_occurrence_id_dispatch_generation_key",
    "table_name": "timer_dispatch_attempts",
    "definition": "CREATE UNIQUE INDEX timer_dispatch_attempts_occurrence_id_dispatch_generation_key ON timer.timer_dispatch_attempts USING btree (occurrence_id, dispatch_generation)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "timer_dispatch_attempts_pkey",
    "table_name": "timer_dispatch_attempts",
    "definition": "CREATE UNIQUE INDEX timer_dispatch_attempts_pkey ON timer.timer_dispatch_attempts USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "timer_dispatch_attempts_retry_idx",
    "table_name": "timer_dispatch_attempts",
    "definition": "CREATE INDEX timer_dispatch_attempts_retry_idx ON timer.timer_dispatch_attempts USING btree (status, next_retry_at, created_at) WHERE (status = ANY (ARRAY['pending'::text, 'retry_wait'::text]))",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "timer_event_dlq_pkey",
    "table_name": "timer_event_dlq",
    "definition": "CREATE UNIQUE INDEX timer_event_dlq_pkey ON timer.timer_event_dlq USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "timer_event_dlq_resolutions_dlq_id_key",
    "table_name": "timer_event_dlq_resolutions",
    "definition": "CREATE UNIQUE INDEX timer_event_dlq_resolutions_dlq_id_key ON timer.timer_event_dlq_resolutions USING btree (dlq_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "timer_event_dlq_resolutions_idempotency_key_key",
    "table_name": "timer_event_dlq_resolutions",
    "definition": "CREATE UNIQUE INDEX timer_event_dlq_resolutions_idempotency_key_key ON timer.timer_event_dlq_resolutions USING btree (idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "timer_event_dlq_resolutions_pkey",
    "table_name": "timer_event_dlq_resolutions",
    "definition": "CREATE UNIQUE INDEX timer_event_dlq_resolutions_pkey ON timer.timer_event_dlq_resolutions USING btree (resolution_id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "timer_event_inbox_pkey",
    "table_name": "timer_event_inbox",
    "definition": "CREATE UNIQUE INDEX timer_event_inbox_pkey ON timer.timer_event_inbox USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "timer_event_inbox_source_event_id_key",
    "table_name": "timer_event_inbox",
    "definition": "CREATE UNIQUE INDEX timer_event_inbox_source_event_id_key ON timer.timer_event_inbox USING btree (source, event_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "timer_event_inbox_source_idempotency_key_key",
    "table_name": "timer_event_inbox",
    "definition": "CREATE UNIQUE INDEX timer_event_inbox_source_idempotency_key_key ON timer.timer_event_inbox USING btree (source, idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "timer_event_outbox_dispatch_idx",
    "table_name": "timer_event_outbox",
    "definition": "CREATE INDEX timer_event_outbox_dispatch_idx ON timer.timer_event_outbox USING btree (status, next_retry_at, created_at) WHERE (status = ANY (ARRAY['pending'::text, 'retry_wait'::text]))",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "timer_event_outbox_pkey",
    "table_name": "timer_event_outbox",
    "definition": "CREATE UNIQUE INDEX timer_event_outbox_pkey ON timer.timer_event_outbox USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "timer_event_outbox_reconciliation_due_idx",
    "table_name": "timer_event_outbox",
    "definition": "CREATE INDEX timer_event_outbox_reconciliation_due_idx ON timer.timer_event_outbox USING btree (reconciliation_next_probe_at NULLS FIRST, sent_at, id) WHERE (status = 'sent'::text)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "timer_event_outbox_reconciliation_generation_idx",
    "table_name": "timer_event_outbox",
    "definition": "CREATE INDEX timer_event_outbox_reconciliation_generation_idx ON timer.timer_event_outbox USING btree (transport_epoch, transport_generation, sent_at, id) WHERE (status = 'sent'::text)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "timer_event_outbox_reconciliation_transport_ref_idx",
    "table_name": "timer_event_outbox",
    "definition": "CREATE INDEX timer_event_outbox_reconciliation_transport_ref_idx ON timer.timer_event_outbox USING btree (transport_ref, transport_epoch, transport_generation) WHERE ((status = 'sent'::text) AND (transport_ref IS NOT NULL))",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "timer_event_outbox_scope_dispatch_idx",
    "table_name": "timer_event_outbox",
    "definition": "CREATE INDEX timer_event_outbox_scope_dispatch_idx ON timer.timer_event_outbox USING btree (workspace_id, bot_id, owner_agent_id, deployment_environment, release_channel, status, next_retry_at, created_at)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "timer_event_outbox_target_idempotency_key_key",
    "table_name": "timer_event_outbox",
    "definition": "CREATE UNIQUE INDEX timer_event_outbox_target_idempotency_key_key ON timer.timer_event_outbox USING btree (target, idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "timer_occurrences_dedupe_key_key",
    "table_name": "timer_occurrences",
    "definition": "CREATE UNIQUE INDEX timer_occurrences_dedupe_key_key ON timer.timer_occurrences USING btree (dedupe_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "timer_occurrences_dispatch_idx",
    "table_name": "timer_occurrences",
    "definition": "CREATE INDEX timer_occurrences_dispatch_idx ON timer.timer_occurrences USING btree (status, next_dispatch_at, effective_fire_at, locked_until) WHERE ((status = ANY (ARRAY['pending'::text, 'retry_wait'::text])) OR ((status = 'dispatching'::text) AND (locked_until IS NOT NULL)))",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "timer_occurrences_id_schedule_id_workspace_id_bot_id_owner__key",
    "table_name": "timer_occurrences",
    "definition": "CREATE UNIQUE INDEX timer_occurrences_id_schedule_id_workspace_id_bot_id_owner__key ON timer.timer_occurrences USING btree (id, schedule_id, workspace_id, bot_id, owner_agent_id, deployment_environment, release_channel)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "timer_occurrences_pkey",
    "table_name": "timer_occurrences",
    "definition": "CREATE UNIQUE INDEX timer_occurrences_pkey ON timer.timer_occurrences USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "timer_occurrences_schedule_id_schedule_version_occurrence_k_key",
    "table_name": "timer_occurrences",
    "definition": "CREATE UNIQUE INDEX timer_occurrences_schedule_id_schedule_version_occurrence_k_key ON timer.timer_occurrences USING btree (schedule_id, schedule_version, occurrence_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "timer_occurrences_schedule_id_schedule_version_scheduled_fi_key",
    "table_name": "timer_occurrences",
    "definition": "CREATE UNIQUE INDEX timer_occurrences_schedule_id_schedule_version_scheduled_fi_key ON timer.timer_occurrences USING btree (schedule_id, schedule_version, scheduled_fire_at)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "timer_occurrences_scope_dispatch_idx",
    "table_name": "timer_occurrences",
    "definition": "CREATE INDEX timer_occurrences_scope_dispatch_idx ON timer.timer_occurrences USING btree (workspace_id, bot_id, owner_agent_id, deployment_environment, release_channel, status, next_dispatch_at, scheduled_fire_at)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "timer_query_requests_pkey",
    "table_name": "timer_query_requests",
    "definition": "CREATE UNIQUE INDEX timer_query_requests_pkey ON timer.timer_query_requests USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "timer_query_requests_scope_idx",
    "table_name": "timer_query_requests",
    "definition": "CREATE INDEX timer_query_requests_scope_idx ON timer.timer_query_requests USING btree (workspace_id, bot_id, owner_agent_id, deployment_environment, release_channel, runtime_run_id, method, created_at DESC)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "timer_scanner_checkpoints_lock_idx",
    "table_name": "timer_scanner_checkpoints",
    "definition": "CREATE INDEX timer_scanner_checkpoints_lock_idx ON timer.timer_scanner_checkpoints USING btree (locked_until)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "timer_scanner_checkpoints_pkey",
    "table_name": "timer_scanner_checkpoints",
    "definition": "CREATE UNIQUE INDEX timer_scanner_checkpoints_pkey ON timer.timer_scanner_checkpoints USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "timer_scanner_checkpoints_scanner_name_key",
    "table_name": "timer_scanner_checkpoints",
    "definition": "CREATE UNIQUE INDEX timer_scanner_checkpoints_scanner_name_key ON timer.timer_scanner_checkpoints USING btree (scanner_name)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "timer_schedules_created_by_runtime_run_id_idempotency_key_key",
    "table_name": "timer_schedules",
    "definition": "CREATE UNIQUE INDEX timer_schedules_created_by_runtime_run_id_idempotency_key_key ON timer.timer_schedules USING btree (created_by_runtime_run_id, idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "timer_schedules_due_idx",
    "table_name": "timer_schedules",
    "definition": "CREATE INDEX timer_schedules_due_idx ON timer.timer_schedules USING btree (next_fire_at, status) WHERE (status = 'active'::text)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "timer_schedules_id_workspace_id_bot_id_owner_agent_id_deplo_key",
    "table_name": "timer_schedules",
    "definition": "CREATE UNIQUE INDEX timer_schedules_id_workspace_id_bot_id_owner_agent_id_deplo_key ON timer.timer_schedules USING btree (id, workspace_id, bot_id, owner_agent_id, deployment_environment, release_channel)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "timer_schedules_pkey",
    "table_name": "timer_schedules",
    "definition": "CREATE UNIQUE INDEX timer_schedules_pkey ON timer.timer_schedules USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "timer_schedules_scope_status_idx",
    "table_name": "timer_schedules",
    "definition": "CREATE INDEX timer_schedules_scope_status_idx ON timer.timer_schedules USING btree (workspace_id, bot_id, owner_agent_id, deployment_environment, release_channel, status, next_fire_at)",
    "unique": false,
    "primary": false,
    "valid": true
  }
] as const;

export const TIMER_FOREIGN_KEYS_V1 = [
  {
    "constraint_name": "timer_audit_logs_schedule_id_workspace_id_bot_id_owner_age_fkey",
    "table_name": "timer_audit_logs",
    "columns": [
      "schedule_id",
      "workspace_id",
      "bot_id",
      "owner_agent_id",
      "deployment_environment",
      "release_channel"
    ],
    "referenced_schema": "timer",
    "referenced_table": "timer_schedules",
    "referenced_columns": [
      "id",
      "workspace_id",
      "bot_id",
      "owner_agent_id",
      "deployment_environment",
      "release_channel"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "timer_catch_up_batches_cursor_occurrence_id_fkey",
    "table_name": "timer_catch_up_batches",
    "columns": [
      "cursor_occurrence_id"
    ],
    "referenced_schema": "timer",
    "referenced_table": "timer_occurrences",
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
    "constraint_name": "timer_catch_up_batches_last_occurrence_id_fkey",
    "table_name": "timer_catch_up_batches",
    "columns": [
      "last_occurrence_id"
    ],
    "referenced_schema": "timer",
    "referenced_table": "timer_occurrences",
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
    "constraint_name": "timer_dispatch_attempts_occurrence_id_fkey",
    "table_name": "timer_dispatch_attempts",
    "columns": [
      "occurrence_id"
    ],
    "referenced_schema": "timer",
    "referenced_table": "timer_occurrences",
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
    "constraint_name": "timer_event_dlq_resolutions_dlq_id_fkey",
    "table_name": "timer_event_dlq_resolutions",
    "columns": [
      "dlq_id"
    ],
    "referenced_schema": "timer",
    "referenced_table": "timer_event_dlq",
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
    "constraint_name": "timer_occurrences_catch_up_batch_scope_fk",
    "table_name": "timer_occurrences",
    "columns": [
      "catch_up_batch_id",
      "workspace_id",
      "bot_id",
      "owner_agent_id",
      "deployment_environment",
      "release_channel"
    ],
    "referenced_schema": "timer",
    "referenced_table": "timer_catch_up_batches",
    "referenced_columns": [
      "id",
      "workspace_id",
      "bot_id",
      "owner_agent_id",
      "deployment_environment",
      "release_channel"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "timer_occurrences_schedule_id_workspace_id_bot_id_owner_ag_fkey",
    "table_name": "timer_occurrences",
    "columns": [
      "schedule_id",
      "workspace_id",
      "bot_id",
      "owner_agent_id",
      "deployment_environment",
      "release_channel"
    ],
    "referenced_schema": "timer",
    "referenced_table": "timer_schedules",
    "referenced_columns": [
      "id",
      "workspace_id",
      "bot_id",
      "owner_agent_id",
      "deployment_environment",
      "release_channel"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  }
] as const;
