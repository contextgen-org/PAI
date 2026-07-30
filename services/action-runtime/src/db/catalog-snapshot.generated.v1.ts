// Generated from a fresh revision-pinned pai-infra PostgreSQL catalog. Do not edit.
export const ACTION_RUNTIME_DATABASE_COLUMNS_V1 = [
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
    "table_name": "runtime_artifacts",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_artifacts",
    "column_name": "runtime_run_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_artifacts",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_artifacts",
    "column_name": "owner_agent_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_artifacts",
    "column_name": "artifact_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_artifacts",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_artifacts",
    "column_name": "artifact_ref",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_artifacts",
    "column_name": "content_hash",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_artifacts",
    "column_name": "size_bytes",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "runtime_artifacts",
    "column_name": "media_type",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_artifacts",
    "column_name": "redaction_status",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_artifacts",
    "column_name": "retention_until",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_artifacts",
    "column_name": "error",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "runtime_artifacts",
    "column_name": "metadata",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "runtime_artifacts",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_artifacts",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_artifacts",
    "column_name": "originating_lease_generation",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "runtime_artifacts",
    "column_name": "reconciliation_generation",
    "not_null": true,
    "default_expression": "0",
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "runtime_artifacts",
    "column_name": "reconciliation_owner",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_artifacts",
    "column_name": "reconciliation_expires_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_control_signals",
    "column_name": "runtime_signal_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_control_signals",
    "column_name": "trigger_process_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_control_signals",
    "column_name": "runtime_run_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_control_signals",
    "column_name": "start_attempt_no",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "runtime_control_signals",
    "column_name": "start_fence_generation",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "runtime_control_signals",
    "column_name": "signal_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_control_signals",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_control_signals",
    "column_name": "request_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_control_signals",
    "column_name": "requested_by",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_control_signals",
    "column_name": "reason_code",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_control_signals",
    "column_name": "control_token_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_control_signals",
    "column_name": "control_valid_until",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_control_signals",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_control_signals",
    "column_name": "handled_status",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_control_signals",
    "column_name": "target_lease_generation",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "runtime_control_signals",
    "column_name": "handled_lease_generation",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "runtime_control_signals",
    "column_name": "final_fencing_generation",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "runtime_control_signals",
    "column_name": "safe_point_reached",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "boolean"
  },
  {
    "table_name": "runtime_control_signals",
    "column_name": "late_events_isolated",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "boolean"
  },
  {
    "table_name": "runtime_control_signals",
    "column_name": "last_runtime_sequence_no",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "runtime_control_signals",
    "column_name": "isolation_proof_ref",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_control_signals",
    "column_name": "trace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_control_signals",
    "column_name": "requested_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_control_signals",
    "column_name": "handled_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_control_signals",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_control_signals",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_control_tombstones",
    "column_name": "runtime_run_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_control_tombstones",
    "column_name": "trigger_process_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_control_tombstones",
    "column_name": "start_attempt_no",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "runtime_control_tombstones",
    "column_name": "start_fence_generation",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "runtime_control_tombstones",
    "column_name": "signal_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_control_tombstones",
    "column_name": "runtime_signal_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_control_tombstones",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_control_tombstones",
    "column_name": "request_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_control_tombstones",
    "column_name": "control_token_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_control_tombstones",
    "column_name": "control_valid_until",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_control_tombstones",
    "column_name": "reason_code",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_control_tombstones",
    "column_name": "scope",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "runtime_control_tombstones",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_control_tombstones",
    "column_name": "trace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_control_tombstones",
    "column_name": "requested_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_control_tombstones",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_control_tombstones",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_event_dlq",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_dlq",
    "column_name": "source_event_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_dlq",
    "column_name": "event_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_dlq",
    "column_name": "payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "runtime_event_dlq",
    "column_name": "last_error",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "runtime_event_dlq",
    "column_name": "failed_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_event_dlq_resolutions",
    "column_name": "resolution_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_dlq_resolutions",
    "column_name": "dlq_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_dlq_resolutions",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_dlq_resolutions",
    "column_name": "resolution_kind",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_dlq_resolutions",
    "column_name": "resolution_payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "runtime_event_dlq_resolutions",
    "column_name": "resolved_by",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_dlq_resolutions",
    "column_name": "resolved_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_event_inbox",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_inbox",
    "column_name": "source",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_inbox",
    "column_name": "event_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_inbox",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_inbox",
    "column_name": "payload_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_inbox",
    "column_name": "semantic_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_inbox",
    "column_name": "scope_fingerprint",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_inbox",
    "column_name": "processed_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_event_inbox",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_event_outbox",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_outbox",
    "column_name": "runtime_run_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_outbox",
    "column_name": "trigger_process_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_outbox",
    "column_name": "source_event_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_outbox",
    "column_name": "source",
    "not_null": true,
    "default_expression": "'action_runtime'::text",
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_outbox",
    "column_name": "event_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_outbox",
    "column_name": "source_sequence_no",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "runtime_event_outbox",
    "column_name": "append_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_outbox",
    "column_name": "payload_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_outbox",
    "column_name": "payload_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_outbox",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_outbox",
    "column_name": "target",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_outbox",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_outbox",
    "column_name": "claim_token",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_outbox",
    "column_name": "acknowledged_claim_token",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_outbox",
    "column_name": "claimed_by",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_outbox",
    "column_name": "locked_until",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_event_outbox",
    "column_name": "last_error",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "runtime_event_outbox",
    "column_name": "transport_ref",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_outbox",
    "column_name": "transport_epoch",
    "not_null": true,
    "default_expression": "'0'::text",
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_outbox",
    "column_name": "transport_generation",
    "not_null": true,
    "default_expression": "0",
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "runtime_event_outbox",
    "column_name": "transport_response_hash",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_outbox",
    "column_name": "sent_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_event_outbox",
    "column_name": "missing_detected_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_event_outbox",
    "column_name": "attempt_count",
    "not_null": true,
    "default_expression": "0",
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "runtime_event_outbox",
    "column_name": "next_retry_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_event_outbox",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_event_outbox",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_event_outbox",
    "column_name": "reconciliation_missing_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_event_outbox",
    "column_name": "reconciliation_missing_reporter",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_outbox",
    "column_name": "reconciliation_next_probe_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_event_outbox",
    "column_name": "reconciliation_claimed_by",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_outbox",
    "column_name": "reconciliation_claim_token",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_outbox",
    "column_name": "reconciliation_claim_generation",
    "not_null": false,
    "default_expression": "0",
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "runtime_event_outbox",
    "column_name": "reconciliation_locked_until",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_event_outbox_quarantine",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_outbox_quarantine",
    "column_name": "canonical_outbox_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_outbox_quarantine",
    "column_name": "source",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_outbox_quarantine",
    "column_name": "event_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_outbox_quarantine",
    "column_name": "observed_idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_outbox_quarantine",
    "column_name": "observed_payload_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_outbox_quarantine",
    "column_name": "canonical_payload_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_outbox_quarantine",
    "column_name": "reason",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_outbox_quarantine",
    "column_name": "details",
    "not_null": true,
    "default_expression": "'{}'::jsonb",
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "runtime_event_outbox_quarantine",
    "column_name": "detected_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_event_outbox_reconciliations",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_outbox_reconciliations",
    "column_name": "outbox_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_outbox_reconciliations",
    "column_name": "source",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_outbox_reconciliations",
    "column_name": "event_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_outbox_reconciliations",
    "column_name": "transport_epoch",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_outbox_reconciliations",
    "column_name": "transport_generation",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "runtime_event_outbox_reconciliations",
    "column_name": "reconciliation_generation",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "runtime_event_outbox_reconciliations",
    "column_name": "reason",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_outbox_reconciliations",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_outbox_reconciliations",
    "column_name": "claim_token",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_outbox_reconciliations",
    "column_name": "claimed_by",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_outbox_reconciliations",
    "column_name": "locked_until",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_event_outbox_reconciliations",
    "column_name": "probe_ref",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_outbox_reconciliations",
    "column_name": "probe_result_hash",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_outbox_reconciliations",
    "column_name": "rematerialized_payload_ref",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_outbox_reconciliations",
    "column_name": "rematerialized_payload_hash",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_event_outbox_reconciliations",
    "column_name": "last_error",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "runtime_event_outbox_reconciliations",
    "column_name": "detected_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_event_outbox_reconciliations",
    "column_name": "completed_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_event_outbox_reconciliations",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_event_outbox_reconciliations",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_event_outbox_reconciliations",
    "column_name": "claim_generation",
    "not_null": true,
    "default_expression": "0",
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "runtime_events",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_events",
    "column_name": "runtime_run_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_events",
    "column_name": "trigger_process_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_events",
    "column_name": "event_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_events",
    "column_name": "sequence_no",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "runtime_events",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_events",
    "column_name": "envelope",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "runtime_events",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_events",
    "column_name": "payload_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_events",
    "column_name": "payload_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_events",
    "column_name": "envelope_canonical_bytes",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bytea"
  },
  {
    "table_name": "runtime_events",
    "column_name": "retention_until",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_events",
    "column_name": "redaction_state",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_permissions",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_permissions",
    "column_name": "runtime_run_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_permissions",
    "column_name": "policy_snapshot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_permissions",
    "column_name": "capability",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_permissions",
    "column_name": "scope",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "runtime_permissions",
    "column_name": "expires_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_permissions",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_policy_input_artifacts",
    "column_name": "policy_input_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_policy_input_artifacts",
    "column_name": "trigger_process_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_policy_input_artifacts",
    "column_name": "runtime_run_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_policy_input_artifacts",
    "column_name": "start_attempt_no",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "runtime_policy_input_artifacts",
    "column_name": "workspace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_policy_input_artifacts",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_policy_input_artifacts",
    "column_name": "owner_agent_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_policy_input_artifacts",
    "column_name": "deployment_environment",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_policy_input_artifacts",
    "column_name": "release_channel",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_policy_input_artifacts",
    "column_name": "expected_catalog_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_policy_input_artifacts",
    "column_name": "catalog_as_of",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_policy_input_artifacts",
    "column_name": "policy_canonical_bytes",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bytea"
  },
  {
    "table_name": "runtime_policy_input_artifacts",
    "column_name": "policy_input_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_policy_input_artifacts",
    "column_name": "intent_policy_snapshot_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_policy_input_artifacts",
    "column_name": "intent_policy_snapshot_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_policy_input_artifacts",
    "column_name": "intent_policy_snapshot_canonical_bytes",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bytea"
  },
  {
    "table_name": "runtime_policy_input_artifacts",
    "column_name": "policy_created_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_policy_input_artifacts",
    "column_name": "policy_expires_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_policy_input_artifacts",
    "column_name": "retention_until",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_policy_input_artifacts",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_policy_input_artifacts",
    "column_name": "tool_permission_profile_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_policy_input_artifacts",
    "column_name": "tool_permission_profile_revision",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "runtime_policy_input_artifacts",
    "column_name": "tool_permission_profile_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_policy_input_artifacts",
    "column_name": "tool_policy_epoch",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "runtime_policy_input_artifacts",
    "column_name": "requested_allowed_tools",
    "not_null": true,
    "default_expression": "'{}'::text[]",
    "identity": "",
    "generated": "",
    "postgres_type": "text[]"
  },
  {
    "table_name": "runtime_policy_snapshots",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_policy_snapshots",
    "column_name": "runtime_run_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_policy_snapshots",
    "column_name": "workspace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_policy_snapshots",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_policy_snapshots",
    "column_name": "owner_agent_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_policy_snapshots",
    "column_name": "deployment_environment",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_policy_snapshots",
    "column_name": "release_channel",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_policy_snapshots",
    "column_name": "policy_input_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_policy_snapshots",
    "column_name": "policy_input_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_policy_snapshots",
    "column_name": "policy_input_created_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_policy_snapshots",
    "column_name": "policy_input",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "runtime_policy_snapshots",
    "column_name": "requested_catalog_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_policy_snapshots",
    "column_name": "effective_catalog_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_policy_snapshots",
    "column_name": "catalog_as_of",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_policy_snapshots",
    "column_name": "skill_resolution_ids",
    "not_null": true,
    "default_expression": "'{}'::text[]",
    "identity": "",
    "generated": "",
    "postgres_type": "text[]"
  },
  {
    "table_name": "runtime_policy_snapshots",
    "column_name": "resolved_skill_digests",
    "not_null": true,
    "default_expression": "'{}'::jsonb",
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "runtime_policy_snapshots",
    "column_name": "resolved_skills",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "runtime_policy_snapshots",
    "column_name": "allowed_tools",
    "not_null": true,
    "default_expression": "'{}'::text[]",
    "identity": "",
    "generated": "",
    "postgres_type": "text[]"
  },
  {
    "table_name": "runtime_policy_snapshots",
    "column_name": "tool_scopes",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "runtime_policy_snapshots",
    "column_name": "resource_scopes",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "runtime_policy_snapshots",
    "column_name": "network_scope",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "runtime_policy_snapshots",
    "column_name": "filesystem_scope",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "runtime_policy_snapshots",
    "column_name": "timer_scope",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "runtime_policy_snapshots",
    "column_name": "memory_scope",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "runtime_policy_snapshots",
    "column_name": "expires_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_policy_snapshots",
    "column_name": "security_revocation_epoch",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "runtime_policy_snapshots",
    "column_name": "revocation_policy",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "runtime_policy_snapshots",
    "column_name": "policy_snapshot_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_policy_snapshots",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_policy_snapshots",
    "column_name": "tool_permission_profile_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_policy_snapshots",
    "column_name": "tool_permission_profile_revision",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "runtime_policy_snapshots",
    "column_name": "tool_permission_profile_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_policy_snapshots",
    "column_name": "tool_policy_epoch",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "runtime_policy_snapshots",
    "column_name": "requested_allowed_tools",
    "not_null": true,
    "default_expression": "'{}'::text[]",
    "identity": "",
    "generated": "",
    "postgres_type": "text[]"
  },
  {
    "table_name": "runtime_policy_snapshots",
    "column_name": "tool_arg_constraints",
    "not_null": true,
    "default_expression": "'{}'::jsonb",
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "runtime_run_leases",
    "column_name": "runtime_run_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_run_leases",
    "column_name": "lease_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_run_leases",
    "column_name": "lease_generation",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "runtime_run_leases",
    "column_name": "owner_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_run_leases",
    "column_name": "lease_expires_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_run_leases",
    "column_name": "heartbeat_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_run_leases",
    "column_name": "recovery_state",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_run_leases",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_run_leases",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_runs",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_runs",
    "column_name": "trigger_process_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_runs",
    "column_name": "workspace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_runs",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_runs",
    "column_name": "owner_agent_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_runs",
    "column_name": "deployment_environment",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_runs",
    "column_name": "release_channel",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_runs",
    "column_name": "start_attempt_no",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "runtime_runs",
    "column_name": "start_fence_generation",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "runtime_runs",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_runs",
    "column_name": "cancellation_status",
    "not_null": true,
    "default_expression": "'none'::text",
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_runs",
    "column_name": "runtime_provider",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_runs",
    "column_name": "model",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_runs",
    "column_name": "intent_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_runs",
    "column_name": "intent_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "runtime_runs",
    "column_name": "structured_intent_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_runs",
    "column_name": "structured_intent",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "runtime_runs",
    "column_name": "context_snapshot_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_runs",
    "column_name": "context_snapshot_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "runtime_runs",
    "column_name": "context_snapshot_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_runs",
    "column_name": "policy_snapshot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_runs",
    "column_name": "policy_snapshot_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_runs",
    "column_name": "terminal_reason",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_runs",
    "column_name": "cancel_requested_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_runs",
    "column_name": "started_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_runs",
    "column_name": "completed_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_runs",
    "column_name": "cancelled_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_runs",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_runs",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_skill_security_projection",
    "column_name": "singleton_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_skill_security_projection",
    "column_name": "security_revocation_epoch",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "runtime_skill_security_projection",
    "column_name": "last_event_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_skill_security_projection",
    "column_name": "last_event_occurred_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_skill_security_projection",
    "column_name": "stream_epoch",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_skill_security_projection",
    "column_name": "stream_generation",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "runtime_skill_security_projection",
    "column_name": "synchronized_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_skill_security_projection",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_skill_security_projection",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_start_attempts",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_attempts",
    "column_name": "trigger_process_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_attempts",
    "column_name": "start_attempt_no",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "runtime_start_attempts",
    "column_name": "runtime_run_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_attempts",
    "column_name": "workspace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_attempts",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_attempts",
    "column_name": "owner_agent_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_attempts",
    "column_name": "deployment_environment",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_attempts",
    "column_name": "release_channel",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_attempts",
    "column_name": "request_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_attempts",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_attempts",
    "column_name": "start_fence_generation",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "runtime_start_attempts",
    "column_name": "start_fence_token_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_attempts",
    "column_name": "request_snapshot",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "runtime_start_attempts",
    "column_name": "actor_binding",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "runtime_start_attempts",
    "column_name": "actor_binding_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_attempts",
    "column_name": "delegated_principal_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_attempts",
    "column_name": "delegated_scope",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "runtime_start_attempts",
    "column_name": "delegated_scope_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_attempts",
    "column_name": "reservation_validation_stage",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_attempts",
    "column_name": "reservation_status_snapshot",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_attempts",
    "column_name": "policy_input_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_attempts",
    "column_name": "policy_input_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_attempts",
    "column_name": "policy_input_created_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_start_attempts",
    "column_name": "policy_expires_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_start_attempts",
    "column_name": "requested_catalog_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_attempts",
    "column_name": "effective_catalog_version",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_attempts",
    "column_name": "result_code",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_attempts",
    "column_name": "response_payload",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "runtime_start_attempts",
    "column_name": "trace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_attempts",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_start_attempts",
    "column_name": "completed_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_start_reservation_validation_calls",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_reservation_validation_calls",
    "column_name": "runtime_start_attempt_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_reservation_validation_calls",
    "column_name": "validation_call_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_reservation_validation_calls",
    "column_name": "validation_stage",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_reservation_validation_calls",
    "column_name": "request_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_reservation_validation_calls",
    "column_name": "trace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_reservation_validation_calls",
    "column_name": "requested_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_start_reservation_validations",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_reservation_validations",
    "column_name": "runtime_start_attempt_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_reservation_validations",
    "column_name": "validation_stage",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_reservation_validations",
    "column_name": "request_token_kind",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_reservation_validations",
    "column_name": "validation_sequence_no",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "runtime_start_reservation_validations",
    "column_name": "request_binding_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_reservation_validations",
    "column_name": "start_fence_token_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_reservation_validations",
    "column_name": "validation_result",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_reservation_validations",
    "column_name": "reservation_status_snapshot",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_reservation_validations",
    "column_name": "validated_fence_generation",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "runtime_start_reservation_validations",
    "column_name": "owner_response_schema_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_reservation_validations",
    "column_name": "owner_response_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_reservation_validations",
    "column_name": "owner_response",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "runtime_start_reservation_validations",
    "column_name": "error_code",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_reservation_validations",
    "column_name": "details",
    "not_null": true,
    "default_expression": "'{}'::jsonb",
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "runtime_start_reservation_validations",
    "column_name": "trace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_reservation_validations",
    "column_name": "recorded_txid",
    "not_null": true,
    "default_expression": "txid_current()",
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "runtime_start_reservation_validations",
    "column_name": "validated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_start_reservation_validations",
    "column_name": "validation_call_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_reservation_validations",
    "column_name": "request_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_reservation_validations",
    "column_name": "actor_binding_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_reservation_validations",
    "column_name": "response_source",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_reservation_validations",
    "column_name": "response_schema_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_reservation_validations",
    "column_name": "response_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "tool_invocations",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "tool_invocations",
    "column_name": "runtime_run_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "tool_invocations",
    "column_name": "adapter_tool_call_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "tool_invocations",
    "column_name": "tool_name",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "tool_invocations",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "tool_invocations",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "tool_invocations",
    "column_name": "request_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "tool_invocations",
    "column_name": "normalized_args_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "tool_invocations",
    "column_name": "input",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "tool_invocations",
    "column_name": "output",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "tool_invocations",
    "column_name": "error",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "tool_invocations",
    "column_name": "side_effect_status",
    "not_null": true,
    "default_expression": "'none'::text",
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "tool_invocations",
    "column_name": "downstream_idempotency_key",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "tool_invocations",
    "column_name": "external_response_ref",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "tool_invocations",
    "column_name": "external_error_ref",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "tool_invocations",
    "column_name": "reconciled_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "tool_invocations",
    "column_name": "reconciliation_evidence_ref",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "tool_invocations",
    "column_name": "reconciliation_idempotency_key",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "tool_invocations",
    "column_name": "reconciliation_request_hash",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "tool_invocations",
    "column_name": "started_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "tool_invocations",
    "column_name": "completed_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "tool_permission_profile_current",
    "column_name": "workspace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "tool_permission_profile_current",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "tool_permission_profile_current",
    "column_name": "owner_agent_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "tool_permission_profile_current",
    "column_name": "deployment_environment",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "tool_permission_profile_current",
    "column_name": "release_channel",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "tool_permission_profile_current",
    "column_name": "profile_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "tool_permission_profile_current",
    "column_name": "revision",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "tool_permission_profile_current",
    "column_name": "profile_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "tool_permission_profile_current",
    "column_name": "policy_epoch",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "tool_permission_profile_current",
    "column_name": "pointer_version",
    "not_null": true,
    "default_expression": "1",
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "tool_permission_profile_current",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "tool_permission_profile_revisions",
    "column_name": "profile_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "tool_permission_profile_revisions",
    "column_name": "workspace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "tool_permission_profile_revisions",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "tool_permission_profile_revisions",
    "column_name": "owner_agent_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "tool_permission_profile_revisions",
    "column_name": "deployment_environment",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "tool_permission_profile_revisions",
    "column_name": "release_channel",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "tool_permission_profile_revisions",
    "column_name": "revision",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "tool_permission_profile_revisions",
    "column_name": "allowed_tools",
    "not_null": true,
    "default_expression": "'{}'::text[]",
    "identity": "",
    "generated": "",
    "postgres_type": "text[]"
  },
  {
    "table_name": "tool_permission_profile_revisions",
    "column_name": "tool_arg_constraints",
    "not_null": true,
    "default_expression": "'{}'::jsonb",
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "tool_permission_profile_revisions",
    "column_name": "resource_scopes",
    "not_null": true,
    "default_expression": "'{}'::jsonb",
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "tool_permission_profile_revisions",
    "column_name": "network_scope",
    "not_null": true,
    "default_expression": "'{}'::jsonb",
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "tool_permission_profile_revisions",
    "column_name": "filesystem_scope",
    "not_null": true,
    "default_expression": "'{}'::jsonb",
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "tool_permission_profile_revisions",
    "column_name": "timer_scope",
    "not_null": true,
    "default_expression": "'{}'::jsonb",
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "tool_permission_profile_revisions",
    "column_name": "memory_scope",
    "not_null": true,
    "default_expression": "'{}'::jsonb",
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "tool_permission_profile_revisions",
    "column_name": "policy_epoch",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "tool_permission_profile_revisions",
    "column_name": "profile_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "tool_permission_profile_revisions",
    "column_name": "effective_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "tool_permission_profile_revisions",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  }
] as const;

export const ACTION_RUNTIME_DATABASE_CHECKS_V1 = [
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
    "constraint_name": "runtime_artifacts_originating_lease_generation_safe_check",
    "table_name": "runtime_artifacts",
    "required_definition_fragments": [
      "CHECK (originating_lease_generation >= 1 AND originating_lease_generation <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "integer_range",
      "column_name": "originating_lease_generation",
      "min": 1,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "runtime_artifacts_reconciliation_generation_safe_check",
    "table_name": "runtime_artifacts",
    "required_definition_fragments": [
      "CHECK (reconciliation_generation >= 0 AND reconciliation_generation <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "integer_range",
      "column_name": "reconciliation_generation",
      "min": 0,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "runtime_artifacts_size_bytes_check",
    "table_name": "runtime_artifacts",
    "required_definition_fragments": [
      "CHECK (size_bytes IS NULL OR size_bytes >= 0 AND size_bytes <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "nullable_integer_range",
      "column_name": "size_bytes",
      "min": 0,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "runtime_artifacts_state_payload_check",
    "table_name": "runtime_artifacts",
    "required_definition_fragments": [
      "CHECK (status = 'creating'::text AND artifact_ref IS NULL AND error IS NULL OR status = 'available'::text AND artifact_ref IS NOT NULL AND content_hash IS NOT NULL AND size_bytes IS NOT NULL AND media_type IS NOT NULL AND redaction_status IS NOT NULL AND retention_until IS NOT NULL AND error IS NULL OR status = 'failed'::text AND artifact_ref IS NULL AND error IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "runtime_artifacts_status_check",
    "table_name": "runtime_artifacts",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['creating'::text, 'available'::text, 'failed'::text]))"
    ],
    "semantic_constraint": {
      "kind": "text_enum",
      "column_name": "status",
      "allowed_values": [
        "creating",
        "available",
        "failed"
      ]
    }
  },
  {
    "constraint_name": "runtime_control_signals_check",
    "table_name": "runtime_control_signals",
    "required_definition_fragments": [
      "CHECK (control_valid_until > requested_at)"
    ]
  },
  {
    "constraint_name": "runtime_control_signals_final_fence_safe_check",
    "table_name": "runtime_control_signals",
    "required_definition_fragments": [
      "CHECK (final_fencing_generation IS NULL OR final_fencing_generation >= 1 AND final_fencing_generation <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "nullable_integer_range",
      "column_name": "final_fencing_generation",
      "min": 1,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "runtime_control_signals_handled_lease_safe_check",
    "table_name": "runtime_control_signals",
    "required_definition_fragments": [
      "CHECK (handled_lease_generation IS NULL OR handled_lease_generation >= 1 AND handled_lease_generation <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "nullable_integer_range",
      "column_name": "handled_lease_generation",
      "min": 1,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "runtime_control_signals_handled_status_check",
    "table_name": "runtime_control_signals",
    "required_definition_fragments": [
      "CHECK (handled_status = ANY (ARRAY['handled_safe_point'::text, 'cancelled_isolated_after_timeout'::text, 'isolation_unproven'::text, 'already_terminal'::text, 'no_run_tombstoned'::text]))"
    ]
  },
  {
    "constraint_name": "runtime_control_signals_last_sequence_safe_check",
    "table_name": "runtime_control_signals",
    "required_definition_fragments": [
      "CHECK (last_runtime_sequence_no IS NULL OR last_runtime_sequence_no >= 1 AND last_runtime_sequence_no <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "nullable_integer_range",
      "column_name": "last_runtime_sequence_no",
      "min": 1,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "runtime_control_signals_signal_type_check",
    "table_name": "runtime_control_signals",
    "required_definition_fragments": [
      "CHECK (signal_type = ANY (ARRAY['cancel'::text, 'preempt'::text, 'user_retract'::text]))"
    ]
  },
  {
    "constraint_name": "runtime_control_signals_start_attempt_no_check",
    "table_name": "runtime_control_signals",
    "required_definition_fragments": [
      "CHECK (start_attempt_no > 0)"
    ]
  },
  {
    "constraint_name": "runtime_control_signals_start_fence_generation_check",
    "table_name": "runtime_control_signals",
    "required_definition_fragments": [
      "CHECK (start_fence_generation >= 1 AND start_fence_generation <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "integer_range",
      "column_name": "start_fence_generation",
      "min": 1,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "runtime_control_signals_status_check",
    "table_name": "runtime_control_signals",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['received'::text, 'handled'::text, 'failed'::text]))"
    ]
  },
  {
    "constraint_name": "runtime_control_signals_target_lease_safe_check",
    "table_name": "runtime_control_signals",
    "required_definition_fragments": [
      "CHECK (target_lease_generation IS NULL OR target_lease_generation >= 1 AND target_lease_generation <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "nullable_integer_range",
      "column_name": "target_lease_generation",
      "min": 1,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "runtime_control_tombstones_check",
    "table_name": "runtime_control_tombstones",
    "required_definition_fragments": [
      "CHECK (control_valid_until > created_at)"
    ]
  },
  {
    "constraint_name": "runtime_control_tombstones_scope_check",
    "table_name": "runtime_control_tombstones",
    "required_definition_fragments": [
      "CHECK (jsonb_typeof(scope) = 'object'::text)"
    ]
  },
  {
    "constraint_name": "runtime_control_tombstones_signal_type_check",
    "table_name": "runtime_control_tombstones",
    "required_definition_fragments": [
      "CHECK (signal_type = ANY (ARRAY['cancel'::text, 'preempt'::text, 'user_retract'::text]))"
    ]
  },
  {
    "constraint_name": "runtime_control_tombstones_start_attempt_no_check",
    "table_name": "runtime_control_tombstones",
    "required_definition_fragments": [
      "CHECK (start_attempt_no > 0)"
    ]
  },
  {
    "constraint_name": "runtime_control_tombstones_start_fence_generation_check",
    "table_name": "runtime_control_tombstones",
    "required_definition_fragments": [
      "CHECK (start_fence_generation >= 1 AND start_fence_generation <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "integer_range",
      "column_name": "start_fence_generation",
      "min": 1,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "runtime_control_tombstones_status_check",
    "table_name": "runtime_control_tombstones",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['received'::text, 'no_run_tombstoned'::text, 'superseded'::text]))"
    ]
  },
  {
    "constraint_name": "runtime_event_dlq_resolutions_resolution_payload_check",
    "table_name": "runtime_event_dlq_resolutions",
    "required_definition_fragments": [
      "CHECK (jsonb_typeof(resolution_payload) = 'object'::text)"
    ]
  },
  {
    "constraint_name": "runtime_event_inbox_event_id_check",
    "table_name": "runtime_event_inbox",
    "required_definition_fragments": [
      "CHECK (length(event_id) > 0)"
    ]
  },
  {
    "constraint_name": "runtime_event_inbox_payload_hash_check",
    "table_name": "runtime_event_inbox",
    "required_definition_fragments": [
      "CHECK (length(payload_hash) > 0)"
    ]
  },
  {
    "constraint_name": "runtime_event_inbox_scope_fingerprint_check",
    "table_name": "runtime_event_inbox",
    "required_definition_fragments": [
      "CHECK (length(scope_fingerprint) > 0)"
    ]
  },
  {
    "constraint_name": "runtime_event_inbox_semantic_hash_check",
    "table_name": "runtime_event_inbox",
    "required_definition_fragments": [
      "CHECK (length(semantic_hash) > 0)"
    ]
  },
  {
    "constraint_name": "runtime_event_outbox_attempt_count_check",
    "table_name": "runtime_event_outbox",
    "required_definition_fragments": [
      "CHECK (attempt_count >= 0)"
    ]
  },
  {
    "constraint_name": "runtime_event_outbox_check",
    "table_name": "runtime_event_outbox",
    "required_definition_fragments": [
      "CHECK (event_id = source_event_id)"
    ]
  },
  {
    "constraint_name": "runtime_event_outbox_check1",
    "table_name": "runtime_event_outbox",
    "required_definition_fragments": [
      "CHECK (status = 'dispatching'::text AND claim_token IS NOT NULL AND claimed_by IS NOT NULL AND locked_until IS NOT NULL OR status <> 'dispatching'::text AND claim_token IS NULL AND claimed_by IS NULL AND locked_until IS NULL)"
    ]
  },
  {
    "constraint_name": "runtime_event_outbox_check2",
    "table_name": "runtime_event_outbox",
    "required_definition_fragments": [
      "CHECK (transport_ref IS NULL AND transport_response_hash IS NULL AND sent_at IS NULL OR transport_ref IS NOT NULL AND transport_response_hash IS NOT NULL AND sent_at IS NOT NULL AND transport_generation >= 1 AND transport_generation <= '9007199254740991'::bigint)"
    ]
  },
  {
    "constraint_name": "runtime_event_outbox_check3",
    "table_name": "runtime_event_outbox",
    "required_definition_fragments": [
      "CHECK (status <> 'sent'::text OR sent_at IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "runtime_event_outbox_check4",
    "table_name": "runtime_event_outbox",
    "required_definition_fragments": [
      "CHECK ((status = 'sent'::text) = (acknowledged_claim_token IS NOT NULL))"
    ]
  },
  {
    "constraint_name": "runtime_event_outbox_check5",
    "table_name": "runtime_event_outbox",
    "required_definition_fragments": [
      "CHECK (status <> 'retry_wait'::text OR next_retry_at IS NOT NULL AND last_error IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "runtime_event_outbox_check6",
    "table_name": "runtime_event_outbox",
    "required_definition_fragments": [
      "CHECK (status <> 'failed'::text OR last_error IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "runtime_event_outbox_reconciliation_generation_check",
    "table_name": "runtime_event_outbox",
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
    "constraint_name": "runtime_event_outbox_sent_at_check",
    "table_name": "runtime_event_outbox",
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
    "constraint_name": "runtime_event_outbox_sent_transport_epoch_check",
    "table_name": "runtime_event_outbox",
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
    "constraint_name": "runtime_event_outbox_sent_transport_generation_check",
    "table_name": "runtime_event_outbox",
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
    "constraint_name": "runtime_event_outbox_sent_transport_ref_check",
    "table_name": "runtime_event_outbox",
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
    "constraint_name": "runtime_event_outbox_source_check",
    "table_name": "runtime_event_outbox",
    "required_definition_fragments": [
      "CHECK (source = 'action_runtime'::text)"
    ]
  },
  {
    "constraint_name": "runtime_event_outbox_source_sequence_no_check",
    "table_name": "runtime_event_outbox",
    "required_definition_fragments": [
      "CHECK (source_sequence_no >= 1 AND source_sequence_no <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "integer_range",
      "column_name": "source_sequence_no",
      "min": 1,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "runtime_event_outbox_status_check",
    "table_name": "runtime_event_outbox",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['pending'::text, 'dispatching'::text, 'sent'::text, 'retry_wait'::text, 'failed'::text]))"
    ]
  },
  {
    "constraint_name": "runtime_event_outbox_transport_epoch_check",
    "table_name": "runtime_event_outbox",
    "required_definition_fragments": [
      "CHECK (transport_epoch IS NULL OR length(transport_epoch) > 0)"
    ]
  },
  {
    "constraint_name": "runtime_event_outbox_transport_generation_check",
    "table_name": "runtime_event_outbox",
    "required_definition_fragments": [
      "CHECK (transport_generation >= 0 AND transport_generation <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "integer_range",
      "column_name": "transport_generation",
      "min": 0,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "runtime_event_outbox_quarantine_reason_check",
    "table_name": "runtime_event_outbox_quarantine",
    "required_definition_fragments": [
      "CHECK (reason = ANY (ARRAY['idempotency_key_drift'::text, 'payload_hash_drift'::text, 'scope_drift'::text]))"
    ]
  },
  {
    "constraint_name": "runtime_event_outbox_reconcilia_reconciliation_generation_check",
    "table_name": "runtime_event_outbox_reconciliations",
    "required_definition_fragments": [
      "CHECK (reconciliation_generation >= 1 AND reconciliation_generation <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "integer_range",
      "column_name": "reconciliation_generation",
      "min": 1,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "runtime_event_outbox_reconciliations_check",
    "table_name": "runtime_event_outbox_reconciliations",
    "required_definition_fragments": [
      "CHECK (status = 'claimed'::text AND claim_token IS NOT NULL AND claimed_by IS NOT NULL AND locked_until IS NOT NULL OR status <> 'claimed'::text AND claim_token IS NULL AND claimed_by IS NULL AND locked_until IS NULL)"
    ]
  },
  {
    "constraint_name": "runtime_event_outbox_reconciliations_check1",
    "table_name": "runtime_event_outbox_reconciliations",
    "required_definition_fragments": [
      "CHECK ((probe_ref IS NULL) = (probe_result_hash IS NULL))"
    ]
  },
  {
    "constraint_name": "runtime_event_outbox_reconciliations_check2",
    "table_name": "runtime_event_outbox_reconciliations",
    "required_definition_fragments": [
      "CHECK ((rematerialized_payload_ref IS NULL) = (rematerialized_payload_hash IS NULL))"
    ]
  },
  {
    "constraint_name": "runtime_event_outbox_reconciliations_check3",
    "table_name": "runtime_event_outbox_reconciliations",
    "required_definition_fragments": [
      "CHECK ((status = ANY (ARRAY['confirmed'::text, 'failed'::text])) = (completed_at IS NOT NULL))"
    ]
  },
  {
    "constraint_name": "runtime_event_outbox_reconciliations_check4",
    "table_name": "runtime_event_outbox_reconciliations",
    "required_definition_fragments": [
      "CHECK (status <> 'failed'::text OR last_error IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "runtime_event_outbox_reconciliations_claim_generation_check",
    "table_name": "runtime_event_outbox_reconciliations",
    "required_definition_fragments": [
      "CHECK (claim_generation >= 0 AND claim_generation <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "integer_range",
      "column_name": "claim_generation",
      "min": 0,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "runtime_event_outbox_reconciliations_reason_check",
    "table_name": "runtime_event_outbox_reconciliations",
    "required_definition_fragments": [
      "CHECK (reason = ANY (ARRAY['commit_disconnect'::text, 'ack_timeout'::text, 'transport_missing'::text, 'manual_repair'::text]))"
    ]
  },
  {
    "constraint_name": "runtime_event_outbox_reconciliations_status_check",
    "table_name": "runtime_event_outbox_reconciliations",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['missing_detected'::text, 'claimed'::text, 'rematerialized'::text, 'confirmed'::text, 'failed'::text]))"
    ],
    "semantic_constraint": {
      "kind": "text_enum",
      "column_name": "status",
      "allowed_values": [
        "missing_detected",
        "claimed",
        "rematerialized",
        "confirmed",
        "failed"
      ]
    }
  },
  {
    "constraint_name": "runtime_event_outbox_reconciliations_transport_epoch_check",
    "table_name": "runtime_event_outbox_reconciliations",
    "required_definition_fragments": [
      "CHECK (length(transport_epoch) > 0)"
    ]
  },
  {
    "constraint_name": "runtime_event_outbox_reconciliations_transport_generation_check",
    "table_name": "runtime_event_outbox_reconciliations",
    "required_definition_fragments": [
      "CHECK (transport_generation >= 0 AND transport_generation <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "integer_range",
      "column_name": "transport_generation",
      "min": 0,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "runtime_events_canonical_bytes_check",
    "table_name": "runtime_events",
    "required_definition_fragments": [
      "CHECK (octet_length(envelope_canonical_bytes) > 0)"
    ],
    "semantic_constraint": {
      "kind": "octet_length_min",
      "column_name": "envelope_canonical_bytes",
      "min": 0
    }
  },
  {
    "constraint_name": "runtime_events_check",
    "table_name": "runtime_events",
    "required_definition_fragments": [
      "CHECK (jsonb_typeof(envelope) = 'object'::text AND envelope ?& ARRAY['event_id'::text, 'event_type'::text, 'schema_version'::text, 'producer'::text, 'occurred_at'::text, 'idempotency_key'::text, 'trace_id'::text, 'payload'::text] AND (envelope ->> 'event_id'::text) = id AND (envelope ->> 'event_type'::text) = event_type AND (envelope ->> 'idempotency_key'::text) = idempotency_key AND (envelope ->> 'producer'::text) = 'action_runtime'::text)"
    ],
    "semantic_constraint": {
      "kind": "json_event_envelope",
      "column_name": "envelope",
      "producer_value": "action_runtime",
      "allow_additional_keys": true,
      "required_keys": [
        "event_id",
        "event_type",
        "schema_version",
        "producer",
        "occurred_at",
        "idempotency_key",
        "trace_id",
        "payload"
      ],
      "field_bindings": [
        {
          "field_name": "event_id",
          "column_name": "id"
        },
        {
          "field_name": "event_type",
          "column_name": "event_type"
        },
        {
          "field_name": "idempotency_key",
          "column_name": "idempotency_key"
        }
      ]
    }
  },
  {
    "constraint_name": "runtime_events_event_type_check",
    "table_name": "runtime_events",
    "required_definition_fragments": [
      "CHECK (event_type = ANY (ARRAY['runtime.run.started'::text, 'runtime.run.completed'::text, 'runtime.run.failed'::text, 'runtime.run.cancelled'::text, 'runtime.run.preempted'::text, 'runtime.tool.requested'::text, 'runtime.tool.completed'::text, 'runtime.tool.failed'::text, 'runtime.tool.cancelled'::text, 'runtime.artifact.created'::text, 'runtime.artifact.failed'::text, 'runtime.control_signal.received'::text, 'runtime.control_signal.handled'::text, 'runtime.skill.load.requested'::text, 'runtime.skill.load.resolved'::text, 'runtime.skill.load.materialized'::text, 'runtime.skill.load.failed'::text]))"
    ],
    "semantic_constraint": {
      "kind": "text_enum",
      "column_name": "event_type",
      "allowed_values": [
        "runtime.run.started",
        "runtime.run.completed",
        "runtime.run.failed",
        "runtime.run.cancelled",
        "runtime.run.preempted",
        "runtime.tool.requested",
        "runtime.tool.completed",
        "runtime.tool.failed",
        "runtime.tool.cancelled",
        "runtime.artifact.created",
        "runtime.artifact.failed",
        "runtime.control_signal.received",
        "runtime.control_signal.handled",
        "runtime.skill.load.requested",
        "runtime.skill.load.resolved",
        "runtime.skill.load.materialized",
        "runtime.skill.load.failed"
      ]
    }
  },
  {
    "constraint_name": "runtime_events_payload_hash_shape_check",
    "table_name": "runtime_events",
    "required_definition_fragments": [
      "CHECK (payload_hash ~ '^sha256:[0-9a-f]{64}$'::text)"
    ],
    "semantic_constraint": {
      "kind": "text_regex",
      "column_name": "payload_hash",
      "pattern": "^sha256:[0-9a-f]{64}$"
    }
  },
  {
    "constraint_name": "runtime_events_payload_ref_shape_check",
    "table_name": "runtime_events",
    "required_definition_fragments": [
      "CHECK (payload_ref = ('runtime_event:'::text || id))"
    ],
    "semantic_constraint": {
      "kind": "text_identity_prefix",
      "column_name": "payload_ref",
      "prefix": "runtime_event:",
      "identity_column_name": "id"
    }
  },
  {
    "constraint_name": "runtime_events_redaction_state_check",
    "table_name": "runtime_events",
    "required_definition_fragments": [
      "CHECK (redaction_state = ANY (ARRAY['not_required'::text, 'complete'::text]))"
    ],
    "semantic_constraint": {
      "kind": "text_enum",
      "column_name": "redaction_state",
      "allowed_values": [
        "not_required",
        "complete"
      ]
    }
  },
  {
    "constraint_name": "runtime_events_retention_check",
    "table_name": "runtime_events",
    "required_definition_fragments": [
      "CHECK (retention_until > created_at)"
    ],
    "semantic_constraint": {
      "kind": "column_order",
      "column_name": "retention_until",
      "operator": ">",
      "other_column_name": "created_at"
    }
  },
  {
    "constraint_name": "runtime_events_sequence_no_check",
    "table_name": "runtime_events",
    "required_definition_fragments": [
      "CHECK (sequence_no >= 1 AND sequence_no <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "integer_range",
      "column_name": "sequence_no",
      "min": 1,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "runtime_policy_input_artifac_intent_policy_snapshot_canon_check",
    "table_name": "runtime_policy_input_artifacts",
    "required_definition_fragments": [
      "CHECK (octet_length(intent_policy_snapshot_canonical_bytes) > 0)"
    ]
  },
  {
    "constraint_name": "runtime_policy_input_artifacts_check",
    "table_name": "runtime_policy_input_artifacts",
    "required_definition_fragments": [
      "CHECK (policy_created_at < policy_expires_at)"
    ]
  },
  {
    "constraint_name": "runtime_policy_input_artifacts_check1",
    "table_name": "runtime_policy_input_artifacts",
    "required_definition_fragments": [
      "CHECK (policy_expires_at <= (policy_created_at + '24:00:00'::interval))"
    ]
  },
  {
    "constraint_name": "runtime_policy_input_artifacts_check2",
    "table_name": "runtime_policy_input_artifacts",
    "required_definition_fragments": [
      "CHECK (retention_until >= policy_expires_at)"
    ]
  },
  {
    "constraint_name": "runtime_policy_input_artifacts_deployment_environment_check",
    "table_name": "runtime_policy_input_artifacts",
    "required_definition_fragments": [
      "CHECK (deployment_environment = ANY (ARRAY['local'::text, 'dev'::text, 'staging'::text, 'prod'::text]))"
    ]
  },
  {
    "constraint_name": "runtime_policy_input_artifacts_policy_canonical_bytes_check",
    "table_name": "runtime_policy_input_artifacts",
    "required_definition_fragments": [
      "CHECK (octet_length(policy_canonical_bytes) > 0)"
    ]
  },
  {
    "constraint_name": "runtime_policy_input_artifacts_release_channel_check",
    "table_name": "runtime_policy_input_artifacts",
    "required_definition_fragments": [
      "CHECK (release_channel = ANY (ARRAY['stable'::text, 'canary'::text]))"
    ]
  },
  {
    "constraint_name": "runtime_policy_input_artifacts_start_attempt_no_check",
    "table_name": "runtime_policy_input_artifacts",
    "required_definition_fragments": [
      "CHECK (start_attempt_no > 0)"
    ]
  },
  {
    "constraint_name": "runtime_policy_input_profile_revision_safe_check",
    "table_name": "runtime_policy_input_artifacts",
    "required_definition_fragments": [
      "CHECK (tool_permission_profile_revision >= 1 AND tool_permission_profile_revision <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "integer_range",
      "column_name": "tool_permission_profile_revision",
      "min": 1,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "runtime_policy_input_tool_epoch_safe_check",
    "table_name": "runtime_policy_input_artifacts",
    "required_definition_fragments": [
      "CHECK (tool_policy_epoch >= 0 AND tool_policy_epoch <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "integer_range",
      "column_name": "tool_policy_epoch",
      "min": 0,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "runtime_policy_snapshot_allowed_tools_subset_check",
    "table_name": "runtime_policy_snapshots",
    "required_definition_fragments": [
      "CHECK (allowed_tools <@ requested_allowed_tools)"
    ]
  },
  {
    "constraint_name": "runtime_policy_snapshot_profile_revision_safe_check",
    "table_name": "runtime_policy_snapshots",
    "required_definition_fragments": [
      "CHECK (tool_permission_profile_revision >= 1 AND tool_permission_profile_revision <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "integer_range",
      "column_name": "tool_permission_profile_revision",
      "min": 1,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "runtime_policy_snapshot_tool_epoch_safe_check",
    "table_name": "runtime_policy_snapshots",
    "required_definition_fragments": [
      "CHECK (tool_policy_epoch >= 0 AND tool_policy_epoch <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "integer_range",
      "column_name": "tool_policy_epoch",
      "min": 0,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "runtime_policy_snapshots_check",
    "table_name": "runtime_policy_snapshots",
    "required_definition_fragments": [
      "CHECK (policy_input_created_at < expires_at)"
    ]
  },
  {
    "constraint_name": "runtime_policy_snapshots_check1",
    "table_name": "runtime_policy_snapshots",
    "required_definition_fragments": [
      "CHECK (expires_at <= (policy_input_created_at + '24:00:00'::interval))"
    ]
  },
  {
    "constraint_name": "runtime_policy_snapshots_check2",
    "table_name": "runtime_policy_snapshots",
    "required_definition_fragments": [
      "CHECK (requested_catalog_version = effective_catalog_version)"
    ]
  },
  {
    "constraint_name": "runtime_policy_snapshots_deployment_environment_check",
    "table_name": "runtime_policy_snapshots",
    "required_definition_fragments": [
      "CHECK (deployment_environment = ANY (ARRAY['local'::text, 'dev'::text, 'staging'::text, 'prod'::text]))"
    ]
  },
  {
    "constraint_name": "runtime_policy_snapshots_release_channel_check",
    "table_name": "runtime_policy_snapshots",
    "required_definition_fragments": [
      "CHECK (release_channel = ANY (ARRAY['stable'::text, 'canary'::text]))"
    ]
  },
  {
    "constraint_name": "runtime_policy_snapshots_security_revocation_epoch_check",
    "table_name": "runtime_policy_snapshots",
    "required_definition_fragments": [
      "CHECK (security_revocation_epoch >= 0 AND security_revocation_epoch <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "integer_range",
      "column_name": "security_revocation_epoch",
      "min": 0,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "runtime_policy_snapshots_tool_arg_constraints_check",
    "table_name": "runtime_policy_snapshots",
    "required_definition_fragments": [
      "CHECK (jsonb_typeof(tool_arg_constraints) = 'object'::text)"
    ]
  },
  {
    "constraint_name": "runtime_run_leases_lease_generation_check",
    "table_name": "runtime_run_leases",
    "required_definition_fragments": [
      "CHECK (lease_generation >= 1 AND lease_generation <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "integer_range",
      "column_name": "lease_generation",
      "min": 1,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "runtime_run_leases_recovery_state_check",
    "table_name": "runtime_run_leases",
    "required_definition_fragments": [
      "CHECK (recovery_state = ANY (ARRAY['active'::text, 'heartbeat_lost'::text, 'expired'::text, 'takeover_pending'::text, 'recovered'::text, 'abandoned'::text]))"
    ]
  },
  {
    "constraint_name": "runtime_runs_cancellation_status_check",
    "table_name": "runtime_runs",
    "required_definition_fragments": [
      "CHECK (cancellation_status = ANY (ARRAY['none'::text, 'requested'::text, 'cancelling'::text, 'reconciliation_required'::text, 'cancelled'::text]))"
    ]
  },
  {
    "constraint_name": "runtime_runs_check",
    "table_name": "runtime_runs",
    "required_definition_fragments": [
      "CHECK (status <> 'queued'::text OR started_at IS NULL)"
    ]
  },
  {
    "constraint_name": "runtime_runs_check1",
    "table_name": "runtime_runs",
    "required_definition_fragments": [
      "CHECK ((status = ANY (ARRAY['completed'::text, 'failed'::text, 'cancelled'::text])) AND terminal_reason IS NOT NULL AND length(terminal_reason) > 0 OR (status <> ALL (ARRAY['completed'::text, 'failed'::text, 'cancelled'::text])) AND terminal_reason IS NULL)"
    ]
  },
  {
    "constraint_name": "runtime_runs_context_snapshot_hash_check",
    "table_name": "runtime_runs",
    "required_definition_fragments": [
      "CHECK (length(context_snapshot_hash) > 0)"
    ]
  },
  {
    "constraint_name": "runtime_runs_context_snapshot_version_check",
    "table_name": "runtime_runs",
    "required_definition_fragments": [
      "CHECK (context_snapshot_version >= 1 AND context_snapshot_version <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "integer_range",
      "column_name": "context_snapshot_version",
      "min": 1,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "runtime_runs_deployment_environment_check",
    "table_name": "runtime_runs",
    "required_definition_fragments": [
      "CHECK (deployment_environment = ANY (ARRAY['local'::text, 'dev'::text, 'staging'::text, 'prod'::text]))"
    ]
  },
  {
    "constraint_name": "runtime_runs_intent_version_check",
    "table_name": "runtime_runs",
    "required_definition_fragments": [
      "CHECK (intent_version >= 1 AND intent_version <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "integer_range",
      "column_name": "intent_version",
      "min": 1,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "runtime_runs_release_channel_check",
    "table_name": "runtime_runs",
    "required_definition_fragments": [
      "CHECK (release_channel = ANY (ARRAY['stable'::text, 'canary'::text]))"
    ]
  },
  {
    "constraint_name": "runtime_runs_start_attempt_no_check",
    "table_name": "runtime_runs",
    "required_definition_fragments": [
      "CHECK (start_attempt_no > 0)"
    ]
  },
  {
    "constraint_name": "runtime_runs_start_fence_generation_check",
    "table_name": "runtime_runs",
    "required_definition_fragments": [
      "CHECK (start_fence_generation >= 1 AND start_fence_generation <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "integer_range",
      "column_name": "start_fence_generation",
      "min": 1,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "runtime_runs_status_check",
    "table_name": "runtime_runs",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['queued'::text, 'running'::text, 'preempt_requested'::text, 'cancelling'::text, 'cancelled'::text, 'completed'::text, 'failed'::text]))"
    ]
  },
  {
    "constraint_name": "runtime_skill_security_projection_check",
    "table_name": "runtime_skill_security_projection",
    "required_definition_fragments": [
      "CHECK (last_event_id IS NULL AND last_event_occurred_at IS NULL AND security_revocation_epoch = 0 OR last_event_id IS NOT NULL AND last_event_occurred_at IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "runtime_skill_security_projection_check1",
    "table_name": "runtime_skill_security_projection",
    "required_definition_fragments": [
      "CHECK ((stream_epoch IS NULL) = (stream_generation IS NULL))"
    ]
  },
  {
    "constraint_name": "runtime_skill_security_projection_check2",
    "table_name": "runtime_skill_security_projection",
    "required_definition_fragments": [
      "CHECK (synchronized_at IS NULL OR stream_generation IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "runtime_skill_security_projection_epoch_safe_check",
    "table_name": "runtime_skill_security_projection",
    "required_definition_fragments": [
      "CHECK (security_revocation_epoch >= 0 AND security_revocation_epoch <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "integer_range",
      "column_name": "security_revocation_epoch",
      "min": 0,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "runtime_skill_security_projection_singleton_key_check",
    "table_name": "runtime_skill_security_projection",
    "required_definition_fragments": [
      "CHECK (singleton_key = 'global'::text)"
    ]
  },
  {
    "constraint_name": "runtime_skill_security_projection_stream_generation_safe_check",
    "table_name": "runtime_skill_security_projection",
    "required_definition_fragments": [
      "CHECK (stream_generation IS NULL OR stream_generation >= 1 AND stream_generation <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "nullable_integer_range",
      "column_name": "stream_generation",
      "min": 1,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "runtime_start_attempts_actor_binding_check",
    "table_name": "runtime_start_attempts",
    "required_definition_fragments": [
      "CHECK (jsonb_typeof(actor_binding) = 'object'::text)"
    ]
  },
  {
    "constraint_name": "runtime_start_attempts_actor_binding_hash_check",
    "table_name": "runtime_start_attempts",
    "required_definition_fragments": [
      "CHECK (actor_binding_hash ~ '^sha256:[0-9a-f]{64}$'::text)"
    ]
  },
  {
    "constraint_name": "runtime_start_attempts_check",
    "table_name": "runtime_start_attempts",
    "required_definition_fragments": [
      "CHECK (policy_input_created_at < policy_expires_at)"
    ]
  },
  {
    "constraint_name": "runtime_start_attempts_check1",
    "table_name": "runtime_start_attempts",
    "required_definition_fragments": [
      "CHECK (policy_expires_at <= (policy_input_created_at + '24:00:00'::interval))"
    ]
  },
  {
    "constraint_name": "runtime_start_attempts_check2",
    "table_name": "runtime_start_attempts",
    "required_definition_fragments": [
      "CHECK (result_code <> 'runtime_queued'::text OR effective_catalog_version = requested_catalog_version AND reservation_validation_stage = 'preflight_completed'::text AND reservation_status_snapshot = 'valid'::text)"
    ]
  },
  {
    "constraint_name": "runtime_start_attempts_delegated_scope_check",
    "table_name": "runtime_start_attempts",
    "required_definition_fragments": [
      "CHECK (jsonb_typeof(delegated_scope) = 'object'::text)"
    ]
  },
  {
    "constraint_name": "runtime_start_attempts_deployment_environment_check",
    "table_name": "runtime_start_attempts",
    "required_definition_fragments": [
      "CHECK (deployment_environment = ANY (ARRAY['local'::text, 'dev'::text, 'staging'::text, 'prod'::text]))"
    ]
  },
  {
    "constraint_name": "runtime_start_attempts_release_channel_check",
    "table_name": "runtime_start_attempts",
    "required_definition_fragments": [
      "CHECK (release_channel = ANY (ARRAY['stable'::text, 'canary'::text]))"
    ]
  },
  {
    "constraint_name": "runtime_start_attempts_request_snapshot_check",
    "table_name": "runtime_start_attempts",
    "required_definition_fragments": [
      "CHECK (jsonb_typeof(request_snapshot) = 'object'::text)"
    ]
  },
  {
    "constraint_name": "runtime_start_attempts_reservation_status_snapshot_check",
    "table_name": "runtime_start_attempts",
    "required_definition_fragments": [
      "CHECK (reservation_status_snapshot = ANY (ARRAY['pending'::text, 'valid'::text, 'stale'::text, 'cancelled'::text, 'expired'::text]))"
    ]
  },
  {
    "constraint_name": "runtime_start_attempts_reservation_validation_stage_check",
    "table_name": "runtime_start_attempts",
    "required_definition_fragments": [
      "CHECK (reservation_validation_stage = ANY (ARRAY['request_received'::text, 'preflight_completed'::text, 'before_running'::text]))"
    ]
  },
  {
    "constraint_name": "runtime_start_attempts_result_code_check",
    "table_name": "runtime_start_attempts",
    "required_definition_fragments": [
      "CHECK (result_code = ANY (ARRAY['requested'::text, 'runtime_queued'::text, 'stale_start_fence'::text, 'start_cancelled'::text, 'catalog_version_conflict'::text, 'authorization_scope_mismatch'::text, 'invalid_runtime_policy'::text, 'tool_permission_profile_not_found'::text, 'tool_permission_profile_hash_mismatch'::text, 'tool_policy_epoch_stale'::text, 'tool_permission_denied'::text, 'idempotency_conflict'::text, 'no_run_confirmed'::text, 'failed'::text]))"
    ]
  },
  {
    "constraint_name": "runtime_start_attempts_start_attempt_no_check",
    "table_name": "runtime_start_attempts",
    "required_definition_fragments": [
      "CHECK (start_attempt_no > 0)"
    ]
  },
  {
    "constraint_name": "runtime_start_attempts_start_fence_generation_check",
    "table_name": "runtime_start_attempts",
    "required_definition_fragments": [
      "CHECK (start_fence_generation IS NULL OR start_fence_generation >= 1 AND start_fence_generation <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "nullable_integer_range",
      "column_name": "start_fence_generation",
      "min": 1,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "runtime_start_reservation_validation_calls_request_hash_check",
    "table_name": "runtime_start_reservation_validation_calls",
    "required_definition_fragments": [
      "CHECK (request_hash ~ '^sha256:[0-9a-f]{64}$'::text)"
    ],
    "semantic_constraint": {
      "kind": "text_regex",
      "column_name": "request_hash",
      "pattern": "^sha256:[0-9a-f]{64}$"
    }
  },
  {
    "constraint_name": "runtime_start_reservation_validation_calls_stage_check",
    "table_name": "runtime_start_reservation_validation_calls",
    "required_definition_fragments": [
      "CHECK (validation_stage = ANY (ARRAY['request_received'::text, 'preflight_completed'::text, 'before_running'::text]))"
    ],
    "semantic_constraint": {
      "kind": "text_enum",
      "column_name": "validation_stage",
      "allowed_values": [
        "request_received",
        "preflight_completed",
        "before_running"
      ]
    }
  },
  {
    "constraint_name": "runtime_start_reservation_val_reservation_status_snapshot_check",
    "table_name": "runtime_start_reservation_validations",
    "required_definition_fragments": [
      "CHECK (reservation_status_snapshot = ANY (ARRAY['pending'::text, 'valid'::text, 'stale'::text, 'cancelled'::text, 'expired'::text]))"
    ]
  },
  {
    "constraint_name": "runtime_start_reservation_vali_validated_fence_generation_check",
    "table_name": "runtime_start_reservation_validations",
    "required_definition_fragments": [
      "CHECK (validated_fence_generation IS NULL OR validated_fence_generation >= 1 AND validated_fence_generation <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "nullable_integer_range",
      "column_name": "validated_fence_generation",
      "min": 1,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "runtime_start_reservation_validati_validation_sequence_no_check",
    "table_name": "runtime_start_reservation_validations",
    "required_definition_fragments": [
      "CHECK (validation_sequence_no >= 1 AND validation_sequence_no <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "integer_range",
      "column_name": "validation_sequence_no",
      "min": 1,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "runtime_start_reservation_validations_actor_binding_hash_check",
    "table_name": "runtime_start_reservation_validations",
    "required_definition_fragments": [
      "CHECK (actor_binding_hash ~ '^sha256:[0-9a-f]{64}$'::text)"
    ],
    "semantic_constraint": {
      "kind": "text_regex",
      "column_name": "actor_binding_hash",
      "pattern": "^sha256:[0-9a-f]{64}$"
    }
  },
  {
    "constraint_name": "runtime_start_reservation_validations_check",
    "table_name": "runtime_start_reservation_validations",
    "required_definition_fragments": [
      "CHECK ((validation_stage = ANY (ARRAY['request_received'::text, 'preflight_completed'::text])) AND request_token_kind = 'plaintext_presented'::text OR validation_stage = 'before_running'::text AND request_token_kind = 'persisted_hash'::text)"
    ]
  },
  {
    "constraint_name": "runtime_start_reservation_validations_check1",
    "table_name": "runtime_start_reservation_validations",
    "required_definition_fragments": [
      "CHECK (validation_result = 'valid'::text AND error_code IS NULL AND validated_fence_generation IS NOT NULL OR validation_result = 'error'::text AND error_code IS NOT NULL AND validated_fence_generation IS NULL AND reservation_status_snapshot = 'pending'::text)"
    ]
  },
  {
    "constraint_name": "runtime_start_reservation_validations_details_check",
    "table_name": "runtime_start_reservation_validations",
    "required_definition_fragments": [
      "CHECK (jsonb_typeof(details) = 'object'::text)"
    ]
  },
  {
    "constraint_name": "runtime_start_reservation_validations_owner_response_check",
    "table_name": "runtime_start_reservation_validations",
    "required_definition_fragments": [
      "CHECK (jsonb_typeof(owner_response) = 'object'::text)"
    ]
  },
  {
    "constraint_name": "runtime_start_reservation_validations_request_hash_check",
    "table_name": "runtime_start_reservation_validations",
    "required_definition_fragments": [
      "CHECK (request_hash ~ '^sha256:[0-9a-f]{64}$'::text)"
    ],
    "semantic_constraint": {
      "kind": "text_regex",
      "column_name": "request_hash",
      "pattern": "^sha256:[0-9a-f]{64}$"
    }
  },
  {
    "constraint_name": "runtime_start_reservation_validations_request_token_kind_check",
    "table_name": "runtime_start_reservation_validations",
    "required_definition_fragments": [
      "CHECK (request_token_kind = ANY (ARRAY['plaintext_presented'::text, 'persisted_hash'::text]))"
    ]
  },
  {
    "constraint_name": "runtime_start_reservation_validations_response_hash_check",
    "table_name": "runtime_start_reservation_validations",
    "required_definition_fragments": [
      "CHECK (response_hash ~ '^sha256:[0-9a-f]{64}$'::text)"
    ],
    "semantic_constraint": {
      "kind": "text_regex",
      "column_name": "response_hash",
      "pattern": "^sha256:[0-9a-f]{64}$"
    }
  },
  {
    "constraint_name": "runtime_start_reservation_validations_result_check",
    "table_name": "runtime_start_reservation_validations",
    "required_definition_fragments": [
      "CHECK (validation_result = ANY (ARRAY['valid'::text, 'error'::text]))"
    ],
    "semantic_constraint": {
      "kind": "text_enum",
      "column_name": "validation_result",
      "allowed_values": [
        "valid",
        "error"
      ]
    }
  },
  {
    "constraint_name": "runtime_start_reservation_validations_schema_check",
    "table_name": "runtime_start_reservation_validations",
    "required_definition_fragments": [
      "CHECK (response_schema_version = ANY (ARRAY['runtime_start_reservation_validate_response.v1'::text, 'runtime_start_reservation_validate_error.v1'::text]))"
    ],
    "semantic_constraint": {
      "kind": "text_enum",
      "column_name": "response_schema_version",
      "allowed_values": [
        "runtime_start_reservation_validate_response.v1",
        "runtime_start_reservation_validate_error.v1"
      ]
    }
  },
  {
    "constraint_name": "runtime_start_reservation_validations_source_check",
    "table_name": "runtime_start_reservation_validations",
    "required_definition_fragments": [
      "CHECK (response_source = 'trigger_processor'::text)"
    ]
  },
  {
    "constraint_name": "runtime_start_reservation_validations_start_fence_token_hash_ch",
    "table_name": "runtime_start_reservation_validations",
    "required_definition_fragments": [
      "CHECK (start_fence_token_hash ~ '^sha256:[0-9a-f]{64}$'::text)"
    ]
  },
  {
    "constraint_name": "runtime_start_reservation_validations_validation_stage_check",
    "table_name": "runtime_start_reservation_validations",
    "required_definition_fragments": [
      "CHECK (validation_stage = ANY (ARRAY['request_received'::text, 'preflight_completed'::text, 'before_running'::text]))"
    ]
  },
  {
    "constraint_name": "tool_invocations_check",
    "table_name": "tool_invocations",
    "required_definition_fragments": [
      "CHECK (side_effect_status <> 'unknown'::text OR status = 'failed'::text)"
    ]
  },
  {
    "constraint_name": "tool_invocations_check1",
    "table_name": "tool_invocations",
    "required_definition_fragments": [
      "CHECK (reconciled_at IS NULL AND reconciliation_evidence_ref IS NULL AND reconciliation_idempotency_key IS NULL AND reconciliation_request_hash IS NULL OR reconciled_at IS NOT NULL AND reconciliation_evidence_ref IS NOT NULL AND reconciliation_idempotency_key IS NOT NULL AND reconciliation_request_hash IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "tool_invocations_side_effect_status_check",
    "table_name": "tool_invocations",
    "required_definition_fragments": [
      "CHECK (side_effect_status = ANY (ARRAY['none'::text, 'produced'::text, 'unknown'::text]))"
    ]
  },
  {
    "constraint_name": "tool_invocations_status_check",
    "table_name": "tool_invocations",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['requested'::text, 'running'::text, 'completed'::text, 'failed'::text, 'cancelled'::text]))"
    ]
  },
  {
    "constraint_name": "tool_permission_profile_current_deployment_environment_check",
    "table_name": "tool_permission_profile_current",
    "required_definition_fragments": [
      "CHECK (deployment_environment = ANY (ARRAY['local'::text, 'dev'::text, 'staging'::text, 'prod'::text]))"
    ]
  },
  {
    "constraint_name": "tool_permission_profile_current_release_channel_check",
    "table_name": "tool_permission_profile_current",
    "required_definition_fragments": [
      "CHECK (release_channel = ANY (ARRAY['stable'::text, 'canary'::text]))"
    ]
  },
  {
    "constraint_name": "tool_profile_current_pointer_version_safe_check",
    "table_name": "tool_permission_profile_current",
    "required_definition_fragments": [
      "CHECK (pointer_version >= 1 AND pointer_version <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "integer_range",
      "column_name": "pointer_version",
      "min": 1,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "tool_profile_current_policy_epoch_safe_check",
    "table_name": "tool_permission_profile_current",
    "required_definition_fragments": [
      "CHECK (policy_epoch >= 0 AND policy_epoch <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "integer_range",
      "column_name": "policy_epoch",
      "min": 0,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "tool_profile_current_revision_safe_check",
    "table_name": "tool_permission_profile_current",
    "required_definition_fragments": [
      "CHECK (revision >= 1 AND revision <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "integer_range",
      "column_name": "revision",
      "min": 1,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "tool_permission_profile_revisions_deployment_environment_check",
    "table_name": "tool_permission_profile_revisions",
    "required_definition_fragments": [
      "CHECK (deployment_environment = ANY (ARRAY['local'::text, 'dev'::text, 'staging'::text, 'prod'::text]))"
    ]
  },
  {
    "constraint_name": "tool_permission_profile_revisions_filesystem_scope_check",
    "table_name": "tool_permission_profile_revisions",
    "required_definition_fragments": [
      "CHECK (jsonb_typeof(filesystem_scope) = 'object'::text)"
    ]
  },
  {
    "constraint_name": "tool_permission_profile_revisions_memory_scope_check",
    "table_name": "tool_permission_profile_revisions",
    "required_definition_fragments": [
      "CHECK (jsonb_typeof(memory_scope) = 'object'::text)"
    ]
  },
  {
    "constraint_name": "tool_permission_profile_revisions_network_scope_check",
    "table_name": "tool_permission_profile_revisions",
    "required_definition_fragments": [
      "CHECK (jsonb_typeof(network_scope) = 'object'::text)"
    ]
  },
  {
    "constraint_name": "tool_permission_profile_revisions_profile_hash_check",
    "table_name": "tool_permission_profile_revisions",
    "required_definition_fragments": [
      "CHECK (length(profile_hash) > 0)"
    ]
  },
  {
    "constraint_name": "tool_permission_profile_revisions_release_channel_check",
    "table_name": "tool_permission_profile_revisions",
    "required_definition_fragments": [
      "CHECK (release_channel = ANY (ARRAY['stable'::text, 'canary'::text]))"
    ]
  },
  {
    "constraint_name": "tool_permission_profile_revisions_resource_scopes_check",
    "table_name": "tool_permission_profile_revisions",
    "required_definition_fragments": [
      "CHECK (jsonb_typeof(resource_scopes) = 'object'::text)"
    ]
  },
  {
    "constraint_name": "tool_permission_profile_revisions_timer_scope_check",
    "table_name": "tool_permission_profile_revisions",
    "required_definition_fragments": [
      "CHECK (jsonb_typeof(timer_scope) = 'object'::text)"
    ]
  },
  {
    "constraint_name": "tool_permission_profile_revisions_tool_arg_constraints_check",
    "table_name": "tool_permission_profile_revisions",
    "required_definition_fragments": [
      "CHECK (jsonb_typeof(tool_arg_constraints) = 'object'::text)"
    ]
  },
  {
    "constraint_name": "tool_profile_revisions_policy_epoch_safe_check",
    "table_name": "tool_permission_profile_revisions",
    "required_definition_fragments": [
      "CHECK (policy_epoch >= 0 AND policy_epoch <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "integer_range",
      "column_name": "policy_epoch",
      "min": 0,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "tool_profile_revisions_revision_safe_check",
    "table_name": "tool_permission_profile_revisions",
    "required_definition_fragments": [
      "CHECK (revision >= 1 AND revision <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "integer_range",
      "column_name": "revision",
      "min": 1,
      "max": 9007199254740991
    }
  }
] as const;

export const ACTION_RUNTIME_DATABASE_FUNCTIONS_V1 = [
  {
    "function_name": "acquire_runtime_aggregate_xact_lock_v1",
    "security_definer": true,
    "settings": [
      "search_path=pg_catalog"
    ],
    "strict": true,
    "volatility": "v",
    "parallel_safety": "u",
    "leakproof": false,
    "function_kind": "f",
    "default_argument_count": 0,
    "identity_arguments": "p_runtime_run_id text",
    "argument_names": [
      "p_runtime_run_id"
    ],
    "argument_types": [
      "text"
    ],
    "returns_set": false,
    "result_type": "void",
    "language_name": "plpgsql",
    "function_body_sha256": "sha256:db611e0db187c858b72a5900541a9eea4e6f1b3e737e0290cc2ccc8b5f3b3b47"
  }
] as const;

export const ACTION_RUNTIME_DATABASE_TRIGGERS_V1 = [
  {
    "table_name": "runtime_policy_snapshots",
    "trigger_name": "runtime_policy_snapshot_tool_profile_guard",
    "enabled_mode": "O",
    "trigger_type": 5,
    "trigger_argument_count": 0,
    "update_columns": "",
    "constraint_trigger": true,
    "has_when_clause": false,
    "has_old_transition_table": false,
    "has_new_transition_table": false,
    "function_schema": "action_runtime",
    "function_name": "validate_runtime_tool_profile_snapshot",
    "security_definer": false,
    "settings": null,
    "language_name": "plpgsql",
    "function_body_sha256": "sha256:7a9bc1d367bd992341a7bd412133e05d80e007868f303cd7f28f14f642df1c35"
  },
  {
    "table_name": "runtime_runs",
    "trigger_name": "runtime_run_before_running_trigger",
    "enabled_mode": "O",
    "trigger_type": 17,
    "trigger_argument_count": 0,
    "update_columns": "",
    "constraint_trigger": true,
    "has_when_clause": true,
    "has_old_transition_table": false,
    "has_new_transition_table": false,
    "function_schema": "action_runtime",
    "function_name": "require_before_running_evidence",
    "security_definer": true,
    "settings": [
      "search_path=pg_catalog, action_runtime"
    ],
    "language_name": "plpgsql",
    "function_body_sha256": "sha256:8b4ed54a5cdc36275415173d64e5a8acde1d9ad81b9289788acb9157809b6cfd"
  },
  {
    "table_name": "runtime_start_attempts",
    "trigger_name": "runtime_start_queued_validations_trigger",
    "enabled_mode": "O",
    "trigger_type": 21,
    "trigger_argument_count": 0,
    "update_columns": "",
    "constraint_trigger": true,
    "has_when_clause": false,
    "has_old_transition_table": false,
    "has_new_transition_table": false,
    "function_schema": "action_runtime",
    "function_name": "require_runtime_queued_validations",
    "security_definer": true,
    "settings": [
      "search_path=pg_catalog, action_runtime"
    ],
    "language_name": "plpgsql",
    "function_body_sha256": "sha256:c97f7d2da9276478b05b88fe4454976eb4a4866c7a27649166f4bef06c7d56e6"
  },
  {
    "table_name": "runtime_start_reservation_validations",
    "trigger_name": "runtime_start_reservation_validations_immutable",
    "enabled_mode": "O",
    "trigger_type": 27,
    "trigger_argument_count": 0,
    "update_columns": "",
    "constraint_trigger": false,
    "has_when_clause": false,
    "has_old_transition_table": false,
    "has_new_transition_table": false,
    "function_schema": "action_runtime",
    "function_name": "reject_runtime_start_validation_mutation",
    "security_definer": false,
    "settings": null,
    "language_name": "plpgsql",
    "function_body_sha256": "sha256:c28b8da19b4fd56c9e9aaefb879dba79c3645bf2d7e26a0a87da57ffb792d8d6"
  },
  {
    "table_name": "tool_permission_profile_revisions",
    "trigger_name": "tool_permission_profile_revisions_immutable",
    "enabled_mode": "O",
    "trigger_type": 27,
    "trigger_argument_count": 0,
    "update_columns": "",
    "constraint_trigger": false,
    "has_when_clause": false,
    "has_old_transition_table": false,
    "has_new_transition_table": false,
    "function_schema": "action_runtime",
    "function_name": "reject_tool_profile_revision_mutation",
    "security_definer": false,
    "settings": null,
    "language_name": "plpgsql",
    "function_body_sha256": "sha256:8b4f1952413596e1eba4b27d868e6a9f2a4930c564cc09df92410d1ed1a288e1"
  }
] as const;

export const ACTION_RUNTIME_DATABASE_UNIQUE_CONSTRAINTS_V1 = [
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
    "constraint_name": "runtime_artifacts_pkey",
    "table_name": "runtime_artifacts",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_control_signals_pkey",
    "table_name": "runtime_control_signals",
    "columns": [
      "runtime_signal_id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_control_signals_runtime_run_id_idempotency_key_key",
    "table_name": "runtime_control_signals",
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
    "constraint_name": "runtime_control_tombstones_idempotency_key_key",
    "table_name": "runtime_control_tombstones",
    "columns": [
      "idempotency_key"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_control_tombstones_pkey",
    "table_name": "runtime_control_tombstones",
    "columns": [
      "runtime_run_id",
      "start_attempt_no",
      "start_fence_generation"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_control_tombstones_runtime_signal_id_key",
    "table_name": "runtime_control_tombstones",
    "columns": [
      "runtime_signal_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_event_dlq_pkey",
    "table_name": "runtime_event_dlq",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_event_dlq_resolutions_dlq_id_key",
    "table_name": "runtime_event_dlq_resolutions",
    "columns": [
      "dlq_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_event_dlq_resolutions_idempotency_key_key",
    "table_name": "runtime_event_dlq_resolutions",
    "columns": [
      "idempotency_key"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_event_dlq_resolutions_pkey",
    "table_name": "runtime_event_dlq_resolutions",
    "columns": [
      "resolution_id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_event_inbox_pkey",
    "table_name": "runtime_event_inbox",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_event_inbox_source_event_id_key",
    "table_name": "runtime_event_inbox",
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
    "constraint_name": "runtime_event_inbox_source_idempotency_key_key",
    "table_name": "runtime_event_inbox",
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
    "constraint_name": "runtime_event_outbox_pkey",
    "table_name": "runtime_event_outbox",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_event_outbox_source_event_id_key",
    "table_name": "runtime_event_outbox",
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
    "constraint_name": "runtime_event_outbox_target_idempotency_key_key",
    "table_name": "runtime_event_outbox",
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
    "constraint_name": "runtime_event_outbox_quaranti_source_event_id_observed_idem_key",
    "table_name": "runtime_event_outbox_quarantine",
    "columns": [
      "source",
      "event_id",
      "observed_idempotency_key",
      "observed_payload_hash"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_event_outbox_quarantine_pkey",
    "table_name": "runtime_event_outbox_quarantine",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_event_outbox_reconciliations_pkey",
    "table_name": "runtime_event_outbox_reconciliations",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_event_outbox_reconciliations_transport_identity_key",
    "table_name": "runtime_event_outbox_reconciliations",
    "columns": [
      "outbox_id",
      "transport_epoch",
      "transport_generation",
      "reconciliation_generation"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_events_payload_ref_uq",
    "table_name": "runtime_events",
    "columns": [
      "payload_ref"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_events_pkey",
    "table_name": "runtime_events",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_events_resolver_identity_uq",
    "table_name": "runtime_events",
    "columns": [
      "id",
      "runtime_run_id",
      "trigger_process_id",
      "sequence_no",
      "payload_ref",
      "payload_hash"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_events_runtime_run_id_idempotency_key_key",
    "table_name": "runtime_events",
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
    "constraint_name": "runtime_events_runtime_run_id_sequence_no_key",
    "table_name": "runtime_events",
    "columns": [
      "runtime_run_id",
      "sequence_no"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_permissions_pkey",
    "table_name": "runtime_permissions",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_policy_input_artifact_runtime_run_id_start_attempt__key",
    "table_name": "runtime_policy_input_artifacts",
    "columns": [
      "runtime_run_id",
      "start_attempt_no"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_policy_input_artifacts_pkey",
    "table_name": "runtime_policy_input_artifacts",
    "columns": [
      "policy_input_ref"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_policy_snapshots_pkey",
    "table_name": "runtime_policy_snapshots",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_policy_snapshots_policy_snapshot_hash_key",
    "table_name": "runtime_policy_snapshots",
    "columns": [
      "policy_snapshot_hash"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_policy_snapshots_runtime_run_id_key",
    "table_name": "runtime_policy_snapshots",
    "columns": [
      "runtime_run_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_run_leases_lease_id_key",
    "table_name": "runtime_run_leases",
    "columns": [
      "lease_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_run_leases_pkey",
    "table_name": "runtime_run_leases",
    "columns": [
      "runtime_run_id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_runs_pkey",
    "table_name": "runtime_runs",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_runs_trigger_process_id_key",
    "table_name": "runtime_runs",
    "columns": [
      "trigger_process_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_runs_trigger_process_id_start_attempt_no_key",
    "table_name": "runtime_runs",
    "columns": [
      "trigger_process_id",
      "start_attempt_no"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_skill_security_projection_pkey",
    "table_name": "runtime_skill_security_projection",
    "columns": [
      "singleton_key"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_start_attempts_idempotency_key_key",
    "table_name": "runtime_start_attempts",
    "columns": [
      "idempotency_key"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_start_attempts_pkey",
    "table_name": "runtime_start_attempts",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_start_attempts_trigger_process_id_start_attempt_no_key",
    "table_name": "runtime_start_attempts",
    "columns": [
      "trigger_process_id",
      "start_attempt_no"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_start_attempts_trigger_process_id_start_fence_gener_key",
    "table_name": "runtime_start_attempts",
    "columns": [
      "trigger_process_id",
      "start_fence_generation"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_start_reservation_validation_calls_identity_key",
    "table_name": "runtime_start_reservation_validation_calls",
    "columns": [
      "runtime_start_attempt_id",
      "validation_call_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_start_reservation_validation_calls_pkey",
    "table_name": "runtime_start_reservation_validation_calls",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_start_reservation_val_runtime_start_attempt_id_vali_key",
    "table_name": "runtime_start_reservation_validations",
    "columns": [
      "runtime_start_attempt_id",
      "validation_sequence_no"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_start_reservation_validations_call_key",
    "table_name": "runtime_start_reservation_validations",
    "columns": [
      "runtime_start_attempt_id",
      "validation_call_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_start_reservation_validations_pkey",
    "table_name": "runtime_start_reservation_validations",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "tool_invocations_pkey",
    "table_name": "tool_invocations",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "tool_invocations_reconciliation_idempotency_key_key",
    "table_name": "tool_invocations",
    "columns": [
      "reconciliation_idempotency_key"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "tool_invocations_runtime_run_id_adapter_tool_call_id_key",
    "table_name": "tool_invocations",
    "columns": [
      "runtime_run_id",
      "adapter_tool_call_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "tool_invocations_runtime_run_id_idempotency_key_key",
    "table_name": "tool_invocations",
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
    "constraint_name": "tool_permission_profile_current_pkey",
    "table_name": "tool_permission_profile_current",
    "columns": [
      "workspace_id",
      "bot_id",
      "owner_agent_id",
      "deployment_environment",
      "release_channel"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "tool_permission_profile_revis_profile_ref_workspace_id_bot__key",
    "table_name": "tool_permission_profile_revisions",
    "columns": [
      "profile_ref",
      "workspace_id",
      "bot_id",
      "owner_agent_id",
      "deployment_environment",
      "release_channel",
      "revision",
      "profile_hash",
      "policy_epoch"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "tool_permission_profile_revis_workspace_id_bot_id_owner_age_key",
    "table_name": "tool_permission_profile_revisions",
    "columns": [
      "workspace_id",
      "bot_id",
      "owner_agent_id",
      "deployment_environment",
      "release_channel",
      "revision"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "tool_permission_profile_revisions_pkey",
    "table_name": "tool_permission_profile_revisions",
    "columns": [
      "profile_ref"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  }
] as const;

export const ACTION_RUNTIME_DATABASE_INDEXES_V1 = [
  {
    "index_name": "eventing_transport_epochs_pkey",
    "table_name": "eventing_transport_epochs",
    "definition": "CREATE UNIQUE INDEX eventing_transport_epochs_pkey ON action_runtime.eventing_transport_epochs USING btree (transport_name)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "runtime_artifacts_gc_idx",
    "table_name": "runtime_artifacts",
    "definition": "CREATE INDEX runtime_artifacts_gc_idx ON action_runtime.runtime_artifacts USING btree (status, retention_until)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "runtime_artifacts_pkey",
    "table_name": "runtime_artifacts",
    "definition": "CREATE UNIQUE INDEX runtime_artifacts_pkey ON action_runtime.runtime_artifacts USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "runtime_artifacts_reconciliation_due_idx",
    "table_name": "runtime_artifacts",
    "definition": "CREATE INDEX runtime_artifacts_reconciliation_due_idx ON action_runtime.runtime_artifacts USING btree (reconciliation_expires_at NULLS FIRST, created_at, id) WHERE (status = 'creating'::text)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "runtime_control_signals_pkey",
    "table_name": "runtime_control_signals",
    "definition": "CREATE UNIQUE INDEX runtime_control_signals_pkey ON action_runtime.runtime_control_signals USING btree (runtime_signal_id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "runtime_control_signals_runtime_run_id_idempotency_key_key",
    "table_name": "runtime_control_signals",
    "definition": "CREATE UNIQUE INDEX runtime_control_signals_runtime_run_id_idempotency_key_key ON action_runtime.runtime_control_signals USING btree (runtime_run_id, idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "runtime_control_tombstones_idempotency_key_key",
    "table_name": "runtime_control_tombstones",
    "definition": "CREATE UNIQUE INDEX runtime_control_tombstones_idempotency_key_key ON action_runtime.runtime_control_tombstones USING btree (idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "runtime_control_tombstones_pkey",
    "table_name": "runtime_control_tombstones",
    "definition": "CREATE UNIQUE INDEX runtime_control_tombstones_pkey ON action_runtime.runtime_control_tombstones USING btree (runtime_run_id, start_attempt_no, start_fence_generation)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "runtime_control_tombstones_runtime_signal_id_key",
    "table_name": "runtime_control_tombstones",
    "definition": "CREATE UNIQUE INDEX runtime_control_tombstones_runtime_signal_id_key ON action_runtime.runtime_control_tombstones USING btree (runtime_signal_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "runtime_event_dlq_pkey",
    "table_name": "runtime_event_dlq",
    "definition": "CREATE UNIQUE INDEX runtime_event_dlq_pkey ON action_runtime.runtime_event_dlq USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "runtime_event_dlq_resolutions_dlq_id_key",
    "table_name": "runtime_event_dlq_resolutions",
    "definition": "CREATE UNIQUE INDEX runtime_event_dlq_resolutions_dlq_id_key ON action_runtime.runtime_event_dlq_resolutions USING btree (dlq_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "runtime_event_dlq_resolutions_idempotency_key_key",
    "table_name": "runtime_event_dlq_resolutions",
    "definition": "CREATE UNIQUE INDEX runtime_event_dlq_resolutions_idempotency_key_key ON action_runtime.runtime_event_dlq_resolutions USING btree (idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "runtime_event_dlq_resolutions_pkey",
    "table_name": "runtime_event_dlq_resolutions",
    "definition": "CREATE UNIQUE INDEX runtime_event_dlq_resolutions_pkey ON action_runtime.runtime_event_dlq_resolutions USING btree (resolution_id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "runtime_event_inbox_pkey",
    "table_name": "runtime_event_inbox",
    "definition": "CREATE UNIQUE INDEX runtime_event_inbox_pkey ON action_runtime.runtime_event_inbox USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "runtime_event_inbox_source_event_id_key",
    "table_name": "runtime_event_inbox",
    "definition": "CREATE UNIQUE INDEX runtime_event_inbox_source_event_id_key ON action_runtime.runtime_event_inbox USING btree (source, event_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "runtime_event_inbox_source_idempotency_key_key",
    "table_name": "runtime_event_inbox",
    "definition": "CREATE UNIQUE INDEX runtime_event_inbox_source_idempotency_key_key ON action_runtime.runtime_event_inbox USING btree (source, idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "action_runtime_outbox_dispatch_idx",
    "table_name": "runtime_event_outbox",
    "definition": "CREATE INDEX action_runtime_outbox_dispatch_idx ON action_runtime.runtime_event_outbox USING btree (status, next_retry_at, created_at) WHERE (status = ANY (ARRAY['pending'::text, 'retry_wait'::text]))",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "runtime_event_outbox_due_idx",
    "table_name": "runtime_event_outbox",
    "definition": "CREATE INDEX runtime_event_outbox_due_idx ON action_runtime.runtime_event_outbox USING btree (status, next_retry_at, locked_until, created_at) WHERE (status = ANY (ARRAY['pending'::text, 'dispatching'::text, 'retry_wait'::text]))",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "runtime_event_outbox_generation_idx",
    "table_name": "runtime_event_outbox",
    "definition": "CREATE INDEX runtime_event_outbox_generation_idx ON action_runtime.runtime_event_outbox USING btree (id, transport_epoch, transport_generation)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "runtime_event_outbox_pkey",
    "table_name": "runtime_event_outbox",
    "definition": "CREATE UNIQUE INDEX runtime_event_outbox_pkey ON action_runtime.runtime_event_outbox USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "runtime_event_outbox_reconciliation_due_idx",
    "table_name": "runtime_event_outbox",
    "definition": "CREATE INDEX runtime_event_outbox_reconciliation_due_idx ON action_runtime.runtime_event_outbox USING btree (reconciliation_next_probe_at NULLS FIRST, sent_at, id) WHERE (status = 'sent'::text)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "runtime_event_outbox_reconciliation_generation_idx",
    "table_name": "runtime_event_outbox",
    "definition": "CREATE INDEX runtime_event_outbox_reconciliation_generation_idx ON action_runtime.runtime_event_outbox USING btree (transport_epoch, transport_generation, sent_at, id) WHERE (status = 'sent'::text)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "runtime_event_outbox_reconciliation_transport_ref_idx",
    "table_name": "runtime_event_outbox",
    "definition": "CREATE INDEX runtime_event_outbox_reconciliation_transport_ref_idx ON action_runtime.runtime_event_outbox USING btree (transport_ref, transport_epoch, transport_generation) WHERE ((status = 'sent'::text) AND (transport_ref IS NOT NULL))",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "runtime_event_outbox_source_event_id_key",
    "table_name": "runtime_event_outbox",
    "definition": "CREATE UNIQUE INDEX runtime_event_outbox_source_event_id_key ON action_runtime.runtime_event_outbox USING btree (source, event_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "runtime_event_outbox_target_idempotency_key_key",
    "table_name": "runtime_event_outbox",
    "definition": "CREATE UNIQUE INDEX runtime_event_outbox_target_idempotency_key_key ON action_runtime.runtime_event_outbox USING btree (target, idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "runtime_event_outbox_transport_idx",
    "table_name": "runtime_event_outbox",
    "definition": "CREATE INDEX runtime_event_outbox_transport_idx ON action_runtime.runtime_event_outbox USING btree (transport_ref, transport_epoch, transport_generation) WHERE (transport_ref IS NOT NULL)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "runtime_event_outbox_quaranti_source_event_id_observed_idem_key",
    "table_name": "runtime_event_outbox_quarantine",
    "definition": "CREATE UNIQUE INDEX runtime_event_outbox_quaranti_source_event_id_observed_idem_key ON action_runtime.runtime_event_outbox_quarantine USING btree (source, event_id, observed_idempotency_key, observed_payload_hash)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "runtime_event_outbox_quarantine_identity_idx",
    "table_name": "runtime_event_outbox_quarantine",
    "definition": "CREATE INDEX runtime_event_outbox_quarantine_identity_idx ON action_runtime.runtime_event_outbox_quarantine USING btree (source, event_id, detected_at)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "runtime_event_outbox_quarantine_pkey",
    "table_name": "runtime_event_outbox_quarantine",
    "definition": "CREATE UNIQUE INDEX runtime_event_outbox_quarantine_pkey ON action_runtime.runtime_event_outbox_quarantine USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "runtime_event_outbox_reconciliation_claim_idx",
    "table_name": "runtime_event_outbox_reconciliations",
    "definition": "CREATE INDEX runtime_event_outbox_reconciliation_claim_idx ON action_runtime.runtime_event_outbox_reconciliations USING btree (status, locked_until, detected_at) WHERE (status = ANY (ARRAY['missing_detected'::text, 'claimed'::text, 'rematerialized'::text]))",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "runtime_event_outbox_reconciliations_pkey",
    "table_name": "runtime_event_outbox_reconciliations",
    "definition": "CREATE UNIQUE INDEX runtime_event_outbox_reconciliations_pkey ON action_runtime.runtime_event_outbox_reconciliations USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "runtime_event_outbox_reconciliations_transport_identity_key",
    "table_name": "runtime_event_outbox_reconciliations",
    "definition": "CREATE UNIQUE INDEX runtime_event_outbox_reconciliations_transport_identity_key ON action_runtime.runtime_event_outbox_reconciliations USING btree (outbox_id, transport_epoch, transport_generation, reconciliation_generation)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "action_runtime_events_run_sequence_idx",
    "table_name": "runtime_events",
    "definition": "CREATE INDEX action_runtime_events_run_sequence_idx ON action_runtime.runtime_events USING btree (runtime_run_id, sequence_no)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "runtime_events_payload_ref_uq",
    "table_name": "runtime_events",
    "definition": "CREATE UNIQUE INDEX runtime_events_payload_ref_uq ON action_runtime.runtime_events USING btree (payload_ref)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "runtime_events_pkey",
    "table_name": "runtime_events",
    "definition": "CREATE UNIQUE INDEX runtime_events_pkey ON action_runtime.runtime_events USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "runtime_events_resolver_identity_uq",
    "table_name": "runtime_events",
    "definition": "CREATE UNIQUE INDEX runtime_events_resolver_identity_uq ON action_runtime.runtime_events USING btree (id, runtime_run_id, trigger_process_id, sequence_no, payload_ref, payload_hash)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "runtime_events_resolver_retention_idx",
    "table_name": "runtime_events",
    "definition": "CREATE INDEX runtime_events_resolver_retention_idx ON action_runtime.runtime_events USING btree (retention_until, runtime_run_id, sequence_no)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "runtime_events_runtime_run_id_idempotency_key_key",
    "table_name": "runtime_events",
    "definition": "CREATE UNIQUE INDEX runtime_events_runtime_run_id_idempotency_key_key ON action_runtime.runtime_events USING btree (runtime_run_id, idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "runtime_events_runtime_run_id_sequence_no_key",
    "table_name": "runtime_events",
    "definition": "CREATE UNIQUE INDEX runtime_events_runtime_run_id_sequence_no_key ON action_runtime.runtime_events USING btree (runtime_run_id, sequence_no)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "runtime_permissions_pkey",
    "table_name": "runtime_permissions",
    "definition": "CREATE UNIQUE INDEX runtime_permissions_pkey ON action_runtime.runtime_permissions USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "runtime_policy_input_artifact_runtime_run_id_start_attempt__key",
    "table_name": "runtime_policy_input_artifacts",
    "definition": "CREATE UNIQUE INDEX runtime_policy_input_artifact_runtime_run_id_start_attempt__key ON action_runtime.runtime_policy_input_artifacts USING btree (runtime_run_id, start_attempt_no)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "runtime_policy_input_artifacts_pkey",
    "table_name": "runtime_policy_input_artifacts",
    "definition": "CREATE UNIQUE INDEX runtime_policy_input_artifacts_pkey ON action_runtime.runtime_policy_input_artifacts USING btree (policy_input_ref)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "runtime_policy_input_artifacts_retention_idx",
    "table_name": "runtime_policy_input_artifacts",
    "definition": "CREATE INDEX runtime_policy_input_artifacts_retention_idx ON action_runtime.runtime_policy_input_artifacts USING btree (retention_until, runtime_run_id, start_attempt_no)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "runtime_policy_snapshots_expiry_idx",
    "table_name": "runtime_policy_snapshots",
    "definition": "CREATE INDEX runtime_policy_snapshots_expiry_idx ON action_runtime.runtime_policy_snapshots USING btree (expires_at, runtime_run_id)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "runtime_policy_snapshots_pkey",
    "table_name": "runtime_policy_snapshots",
    "definition": "CREATE UNIQUE INDEX runtime_policy_snapshots_pkey ON action_runtime.runtime_policy_snapshots USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "runtime_policy_snapshots_policy_snapshot_hash_key",
    "table_name": "runtime_policy_snapshots",
    "definition": "CREATE UNIQUE INDEX runtime_policy_snapshots_policy_snapshot_hash_key ON action_runtime.runtime_policy_snapshots USING btree (policy_snapshot_hash)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "runtime_policy_snapshots_runtime_run_id_key",
    "table_name": "runtime_policy_snapshots",
    "definition": "CREATE UNIQUE INDEX runtime_policy_snapshots_runtime_run_id_key ON action_runtime.runtime_policy_snapshots USING btree (runtime_run_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "runtime_leases_expiry_idx",
    "table_name": "runtime_run_leases",
    "definition": "CREATE INDEX runtime_leases_expiry_idx ON action_runtime.runtime_run_leases USING btree (lease_expires_at)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "runtime_run_leases_lease_id_key",
    "table_name": "runtime_run_leases",
    "definition": "CREATE UNIQUE INDEX runtime_run_leases_lease_id_key ON action_runtime.runtime_run_leases USING btree (lease_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "runtime_run_leases_pkey",
    "table_name": "runtime_run_leases",
    "definition": "CREATE UNIQUE INDEX runtime_run_leases_pkey ON action_runtime.runtime_run_leases USING btree (runtime_run_id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "action_runtime_runs_status_idx",
    "table_name": "runtime_runs",
    "definition": "CREATE INDEX action_runtime_runs_status_idx ON action_runtime.runtime_runs USING btree (status, updated_at DESC)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "runtime_runs_owner_idx",
    "table_name": "runtime_runs",
    "definition": "CREATE INDEX runtime_runs_owner_idx ON action_runtime.runtime_runs USING btree (bot_id, owner_agent_id, created_at DESC)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "runtime_runs_pkey",
    "table_name": "runtime_runs",
    "definition": "CREATE UNIQUE INDEX runtime_runs_pkey ON action_runtime.runtime_runs USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "runtime_runs_trigger_process_id_key",
    "table_name": "runtime_runs",
    "definition": "CREATE UNIQUE INDEX runtime_runs_trigger_process_id_key ON action_runtime.runtime_runs USING btree (trigger_process_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "runtime_runs_trigger_process_id_start_attempt_no_key",
    "table_name": "runtime_runs",
    "definition": "CREATE UNIQUE INDEX runtime_runs_trigger_process_id_start_attempt_no_key ON action_runtime.runtime_runs USING btree (trigger_process_id, start_attempt_no)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "runtime_skill_security_projection_pkey",
    "table_name": "runtime_skill_security_projection",
    "definition": "CREATE UNIQUE INDEX runtime_skill_security_projection_pkey ON action_runtime.runtime_skill_security_projection USING btree (singleton_key)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "runtime_start_attempt_one_queued_uq",
    "table_name": "runtime_start_attempts",
    "definition": "CREATE UNIQUE INDEX runtime_start_attempt_one_queued_uq ON action_runtime.runtime_start_attempts USING btree (trigger_process_id) WHERE (result_code = 'runtime_queued'::text)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "runtime_start_attempts_idempotency_key_key",
    "table_name": "runtime_start_attempts",
    "definition": "CREATE UNIQUE INDEX runtime_start_attempts_idempotency_key_key ON action_runtime.runtime_start_attempts USING btree (idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "runtime_start_attempts_pkey",
    "table_name": "runtime_start_attempts",
    "definition": "CREATE UNIQUE INDEX runtime_start_attempts_pkey ON action_runtime.runtime_start_attempts USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "runtime_start_attempts_trigger_process_id_start_attempt_no_key",
    "table_name": "runtime_start_attempts",
    "definition": "CREATE UNIQUE INDEX runtime_start_attempts_trigger_process_id_start_attempt_no_key ON action_runtime.runtime_start_attempts USING btree (trigger_process_id, start_attempt_no)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "runtime_start_attempts_trigger_process_id_start_fence_gener_key",
    "table_name": "runtime_start_attempts",
    "definition": "CREATE UNIQUE INDEX runtime_start_attempts_trigger_process_id_start_fence_gener_key ON action_runtime.runtime_start_attempts USING btree (trigger_process_id, start_fence_generation)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "runtime_start_reservation_validation_calls_identity_key",
    "table_name": "runtime_start_reservation_validation_calls",
    "definition": "CREATE UNIQUE INDEX runtime_start_reservation_validation_calls_identity_key ON action_runtime.runtime_start_reservation_validation_calls USING btree (runtime_start_attempt_id, validation_call_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "runtime_start_reservation_validation_calls_pkey",
    "table_name": "runtime_start_reservation_validation_calls",
    "definition": "CREATE UNIQUE INDEX runtime_start_reservation_validation_calls_pkey ON action_runtime.runtime_start_reservation_validation_calls USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "runtime_start_reservation_val_runtime_start_attempt_id_vali_key",
    "table_name": "runtime_start_reservation_validations",
    "definition": "CREATE UNIQUE INDEX runtime_start_reservation_val_runtime_start_attempt_id_vali_key ON action_runtime.runtime_start_reservation_validations USING btree (runtime_start_attempt_id, validation_sequence_no)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "runtime_start_reservation_validations_call_key",
    "table_name": "runtime_start_reservation_validations",
    "definition": "CREATE UNIQUE INDEX runtime_start_reservation_validations_call_key ON action_runtime.runtime_start_reservation_validations USING btree (runtime_start_attempt_id, validation_call_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "runtime_start_reservation_validations_latest_idx",
    "table_name": "runtime_start_reservation_validations",
    "definition": "CREATE INDEX runtime_start_reservation_validations_latest_idx ON action_runtime.runtime_start_reservation_validations USING btree (runtime_start_attempt_id, validation_stage, validation_sequence_no DESC)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "runtime_start_reservation_validations_pkey",
    "table_name": "runtime_start_reservation_validations",
    "definition": "CREATE UNIQUE INDEX runtime_start_reservation_validations_pkey ON action_runtime.runtime_start_reservation_validations USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "action_runtime_tool_invocations_run_idx",
    "table_name": "tool_invocations",
    "definition": "CREATE INDEX action_runtime_tool_invocations_run_idx ON action_runtime.tool_invocations USING btree (runtime_run_id, started_at DESC)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "tool_invocations_pkey",
    "table_name": "tool_invocations",
    "definition": "CREATE UNIQUE INDEX tool_invocations_pkey ON action_runtime.tool_invocations USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "tool_invocations_reconciliation_idempotency_key_key",
    "table_name": "tool_invocations",
    "definition": "CREATE UNIQUE INDEX tool_invocations_reconciliation_idempotency_key_key ON action_runtime.tool_invocations USING btree (reconciliation_idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "tool_invocations_reconciliation_idx",
    "table_name": "tool_invocations",
    "definition": "CREATE INDEX tool_invocations_reconciliation_idx ON action_runtime.tool_invocations USING btree (side_effect_status, started_at, id) WHERE (side_effect_status = 'unknown'::text)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "tool_invocations_runtime_run_id_adapter_tool_call_id_key",
    "table_name": "tool_invocations",
    "definition": "CREATE UNIQUE INDEX tool_invocations_runtime_run_id_adapter_tool_call_id_key ON action_runtime.tool_invocations USING btree (runtime_run_id, adapter_tool_call_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "tool_invocations_runtime_run_id_idempotency_key_key",
    "table_name": "tool_invocations",
    "definition": "CREATE UNIQUE INDEX tool_invocations_runtime_run_id_idempotency_key_key ON action_runtime.tool_invocations USING btree (runtime_run_id, idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "tool_permission_profile_current_pkey",
    "table_name": "tool_permission_profile_current",
    "definition": "CREATE UNIQUE INDEX tool_permission_profile_current_pkey ON action_runtime.tool_permission_profile_current USING btree (workspace_id, bot_id, owner_agent_id, deployment_environment, release_channel)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "tool_permission_profile_revis_profile_ref_workspace_id_bot__key",
    "table_name": "tool_permission_profile_revisions",
    "definition": "CREATE UNIQUE INDEX tool_permission_profile_revis_profile_ref_workspace_id_bot__key ON action_runtime.tool_permission_profile_revisions USING btree (profile_ref, workspace_id, bot_id, owner_agent_id, deployment_environment, release_channel, revision, profile_hash, policy_epoch)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "tool_permission_profile_revis_workspace_id_bot_id_owner_age_key",
    "table_name": "tool_permission_profile_revisions",
    "definition": "CREATE UNIQUE INDEX tool_permission_profile_revis_workspace_id_bot_id_owner_age_key ON action_runtime.tool_permission_profile_revisions USING btree (workspace_id, bot_id, owner_agent_id, deployment_environment, release_channel, revision)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "tool_permission_profile_revisions_pkey",
    "table_name": "tool_permission_profile_revisions",
    "definition": "CREATE UNIQUE INDEX tool_permission_profile_revisions_pkey ON action_runtime.tool_permission_profile_revisions USING btree (profile_ref)",
    "unique": true,
    "primary": true,
    "valid": true
  }
] as const;

export const ACTION_RUNTIME_FOREIGN_KEYS_V1 = [
  {
    "constraint_name": "runtime_artifacts_runtime_run_id_fkey",
    "table_name": "runtime_artifacts",
    "columns": [
      "runtime_run_id"
    ],
    "referenced_schema": "action_runtime",
    "referenced_table": "runtime_runs",
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
    "constraint_name": "runtime_control_signals_runtime_run_id_fkey",
    "table_name": "runtime_control_signals",
    "columns": [
      "runtime_run_id"
    ],
    "referenced_schema": "action_runtime",
    "referenced_table": "runtime_runs",
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
    "constraint_name": "runtime_event_dlq_resolutions_dlq_id_fkey",
    "table_name": "runtime_event_dlq_resolutions",
    "columns": [
      "dlq_id"
    ],
    "referenced_schema": "action_runtime",
    "referenced_table": "runtime_event_dlq",
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
    "constraint_name": "runtime_event_outbox_owner_identity_fk",
    "table_name": "runtime_event_outbox",
    "columns": [
      "source_event_id",
      "runtime_run_id",
      "trigger_process_id",
      "source_sequence_no",
      "payload_ref",
      "payload_hash"
    ],
    "referenced_schema": "action_runtime",
    "referenced_table": "runtime_events",
    "referenced_columns": [
      "id",
      "runtime_run_id",
      "trigger_process_id",
      "sequence_no",
      "payload_ref",
      "payload_hash"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_event_outbox_runtime_run_id_fkey",
    "table_name": "runtime_event_outbox",
    "columns": [
      "runtime_run_id"
    ],
    "referenced_schema": "action_runtime",
    "referenced_table": "runtime_runs",
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
    "constraint_name": "runtime_event_outbox_source_event_id_fkey",
    "table_name": "runtime_event_outbox",
    "columns": [
      "source_event_id"
    ],
    "referenced_schema": "action_runtime",
    "referenced_table": "runtime_events",
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
    "constraint_name": "runtime_event_outbox_quarantine_canonical_outbox_id_fkey",
    "table_name": "runtime_event_outbox_quarantine",
    "columns": [
      "canonical_outbox_id"
    ],
    "referenced_schema": "action_runtime",
    "referenced_table": "runtime_event_outbox",
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
    "constraint_name": "runtime_event_outbox_reconciliations_outbox_id_fkey",
    "table_name": "runtime_event_outbox_reconciliations",
    "columns": [
      "outbox_id"
    ],
    "referenced_schema": "action_runtime",
    "referenced_table": "runtime_event_outbox",
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
    "constraint_name": "runtime_event_outbox_reconciliations_source_event_id_fkey",
    "table_name": "runtime_event_outbox_reconciliations",
    "columns": [
      "source",
      "event_id"
    ],
    "referenced_schema": "action_runtime",
    "referenced_table": "runtime_event_outbox",
    "referenced_columns": [
      "source",
      "event_id"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_events_runtime_run_id_fkey",
    "table_name": "runtime_events",
    "columns": [
      "runtime_run_id"
    ],
    "referenced_schema": "action_runtime",
    "referenced_table": "runtime_runs",
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
    "constraint_name": "runtime_permissions_policy_snapshot_id_fkey",
    "table_name": "runtime_permissions",
    "columns": [
      "policy_snapshot_id"
    ],
    "referenced_schema": "action_runtime",
    "referenced_table": "runtime_policy_snapshots",
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
    "constraint_name": "runtime_permissions_runtime_run_id_fkey",
    "table_name": "runtime_permissions",
    "columns": [
      "runtime_run_id"
    ],
    "referenced_schema": "action_runtime",
    "referenced_table": "runtime_runs",
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
    "constraint_name": "runtime_policy_input_tool_profile_fk",
    "table_name": "runtime_policy_input_artifacts",
    "columns": [
      "tool_permission_profile_ref",
      "workspace_id",
      "bot_id",
      "owner_agent_id",
      "deployment_environment",
      "release_channel",
      "tool_permission_profile_revision",
      "tool_permission_profile_hash",
      "tool_policy_epoch"
    ],
    "referenced_schema": "action_runtime",
    "referenced_table": "tool_permission_profile_revisions",
    "referenced_columns": [
      "profile_ref",
      "workspace_id",
      "bot_id",
      "owner_agent_id",
      "deployment_environment",
      "release_channel",
      "revision",
      "profile_hash",
      "policy_epoch"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_policy_snapshot_tool_profile_fk",
    "table_name": "runtime_policy_snapshots",
    "columns": [
      "tool_permission_profile_ref",
      "workspace_id",
      "bot_id",
      "owner_agent_id",
      "deployment_environment",
      "release_channel",
      "tool_permission_profile_revision",
      "tool_permission_profile_hash",
      "tool_policy_epoch"
    ],
    "referenced_schema": "action_runtime",
    "referenced_table": "tool_permission_profile_revisions",
    "referenced_columns": [
      "profile_ref",
      "workspace_id",
      "bot_id",
      "owner_agent_id",
      "deployment_environment",
      "release_channel",
      "revision",
      "profile_hash",
      "policy_epoch"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_policy_snapshots_policy_input_ref_fkey",
    "table_name": "runtime_policy_snapshots",
    "columns": [
      "policy_input_ref"
    ],
    "referenced_schema": "action_runtime",
    "referenced_table": "runtime_policy_input_artifacts",
    "referenced_columns": [
      "policy_input_ref"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_policy_snapshots_runtime_run_id_fkey",
    "table_name": "runtime_policy_snapshots",
    "columns": [
      "runtime_run_id"
    ],
    "referenced_schema": "action_runtime",
    "referenced_table": "runtime_runs",
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
    "constraint_name": "runtime_run_leases_runtime_run_id_fkey",
    "table_name": "runtime_run_leases",
    "columns": [
      "runtime_run_id"
    ],
    "referenced_schema": "action_runtime",
    "referenced_table": "runtime_runs",
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
    "constraint_name": "runtime_start_attempts_policy_input_ref_fkey",
    "table_name": "runtime_start_attempts",
    "columns": [
      "policy_input_ref"
    ],
    "referenced_schema": "action_runtime",
    "referenced_table": "runtime_policy_input_artifacts",
    "referenced_columns": [
      "policy_input_ref"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_start_reservation_valida_runtime_start_attempt_id_fkey1",
    "table_name": "runtime_start_reservation_validation_calls",
    "columns": [
      "runtime_start_attempt_id"
    ],
    "referenced_schema": "action_runtime",
    "referenced_table": "runtime_start_attempts",
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
    "constraint_name": "runtime_start_reservation_validat_runtime_start_attempt_id_fkey",
    "table_name": "runtime_start_reservation_validations",
    "columns": [
      "runtime_start_attempt_id"
    ],
    "referenced_schema": "action_runtime",
    "referenced_table": "runtime_start_attempts",
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
    "constraint_name": "runtime_start_reservation_validations_call_fkey",
    "table_name": "runtime_start_reservation_validations",
    "columns": [
      "runtime_start_attempt_id",
      "validation_call_id"
    ],
    "referenced_schema": "action_runtime",
    "referenced_table": "runtime_start_reservation_validation_calls",
    "referenced_columns": [
      "runtime_start_attempt_id",
      "validation_call_id"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "cascade",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "tool_invocations_runtime_run_id_fkey",
    "table_name": "tool_invocations",
    "columns": [
      "runtime_run_id"
    ],
    "referenced_schema": "action_runtime",
    "referenced_table": "runtime_runs",
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
    "constraint_name": "tool_permission_profile_curre_profile_ref_workspace_id_bot_fkey",
    "table_name": "tool_permission_profile_current",
    "columns": [
      "profile_ref",
      "workspace_id",
      "bot_id",
      "owner_agent_id",
      "deployment_environment",
      "release_channel",
      "revision",
      "profile_hash",
      "policy_epoch"
    ],
    "referenced_schema": "action_runtime",
    "referenced_table": "tool_permission_profile_revisions",
    "referenced_columns": [
      "profile_ref",
      "workspace_id",
      "bot_id",
      "owner_agent_id",
      "deployment_environment",
      "release_channel",
      "revision",
      "profile_hash",
      "policy_epoch"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  }
] as const;
