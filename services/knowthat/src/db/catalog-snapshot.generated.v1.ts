// Generated from a fresh revision-pinned pai-infra PostgreSQL catalog. Do not edit.
export const KNOWTHAT_DATABASE_COLUMNS_V1 = [
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
    "table_name": "knowthat_audit_logs",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_audit_logs",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_audit_logs",
    "column_name": "aggregate_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_audit_logs",
    "column_name": "aggregate_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_audit_logs",
    "column_name": "action",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_audit_logs",
    "column_name": "actor",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "knowthat_audit_logs",
    "column_name": "reason",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_audit_logs",
    "column_name": "state_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "knowthat_audit_logs",
    "column_name": "payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "knowthat_audit_logs",
    "column_name": "trace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_audit_logs",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "knowthat_candidate_reviews",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_candidate_reviews",
    "column_name": "fact_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_candidate_reviews",
    "column_name": "decision",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_candidate_reviews",
    "column_name": "reason",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_candidate_reviews",
    "column_name": "evidence_refs",
    "not_null": true,
    "default_expression": "'{}'::text[]",
    "identity": "",
    "generated": "",
    "postgres_type": "text[]"
  },
  {
    "table_name": "knowthat_candidate_reviews",
    "column_name": "evidence_set_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_candidate_reviews",
    "column_name": "source_meta_job_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_candidate_reviews",
    "column_name": "target_candidate_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "knowthat_candidate_reviews",
    "column_name": "reviewed_by",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_candidate_reviews",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "knowthat_candidate_reviews",
    "column_name": "promotion_reservation_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_candidate_reviews",
    "column_name": "promotion_fence_generation",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "knowthat_candidate_reviews",
    "column_name": "promotion_reservation_token_hash",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_candidate_reviews",
    "column_name": "promotion_reservation_expires_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "knowthat_candidate_reviews",
    "column_name": "promotion_committed_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "knowthat_candidate_reviews",
    "column_name": "suggestion_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_candidate_reviews",
    "column_name": "suggested_action",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_candidate_reviews",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_candidate_reviews",
    "column_name": "request_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_candidate_reviews",
    "column_name": "outcome",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_candidate_reviews",
    "column_name": "reason_code",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_candidate_reviews",
    "column_name": "response_payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "knowthat_conflicts",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_conflicts",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_conflicts",
    "column_name": "conflict_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_conflicts",
    "column_name": "semantic_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_conflicts",
    "column_name": "left_fact_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_conflicts",
    "column_name": "right_fact_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_conflicts",
    "column_name": "conflict_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_conflicts",
    "column_name": "field_path",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_conflicts",
    "column_name": "source_priority_snapshot",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "knowthat_conflicts",
    "column_name": "confidence_delta",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "double precision"
  },
  {
    "table_name": "knowthat_conflicts",
    "column_name": "evidence_refs",
    "not_null": true,
    "default_expression": "'{}'::text[]",
    "identity": "",
    "generated": "",
    "postgres_type": "text[]"
  },
  {
    "table_name": "knowthat_conflicts",
    "column_name": "proposed_resolution",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "knowthat_conflicts",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_conflicts",
    "column_name": "resolution",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "knowthat_conflicts",
    "column_name": "payload_schema_version",
    "not_null": true,
    "default_expression": "'knowthat_conflict.v1'::text",
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_conflicts",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "knowthat_conflicts",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "knowthat_event_dlq",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_event_dlq",
    "column_name": "source_event_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_event_dlq",
    "column_name": "event_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_event_dlq",
    "column_name": "payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "knowthat_event_dlq",
    "column_name": "last_error",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "knowthat_event_dlq",
    "column_name": "failed_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "knowthat_event_dlq_resolutions",
    "column_name": "resolution_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_event_dlq_resolutions",
    "column_name": "dlq_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_event_dlq_resolutions",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_event_dlq_resolutions",
    "column_name": "resolution_kind",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_event_dlq_resolutions",
    "column_name": "resolution_payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "knowthat_event_dlq_resolutions",
    "column_name": "resolved_by",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_event_dlq_resolutions",
    "column_name": "resolved_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "knowthat_event_inbox",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_event_inbox",
    "column_name": "source",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_event_inbox",
    "column_name": "event_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_event_inbox",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_event_inbox",
    "column_name": "payload_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_event_inbox",
    "column_name": "semantic_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_event_inbox",
    "column_name": "scope_fingerprint",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_event_inbox",
    "column_name": "processed_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "knowthat_event_inbox",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "knowthat_event_outbox",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_event_outbox",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_event_outbox",
    "column_name": "aggregate_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_event_outbox",
    "column_name": "event_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_event_outbox",
    "column_name": "schema_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_event_outbox",
    "column_name": "producer",
    "not_null": true,
    "default_expression": "'knowthat'::text",
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_event_outbox",
    "column_name": "occurred_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "knowthat_event_outbox",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_event_outbox",
    "column_name": "trace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_event_outbox",
    "column_name": "payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "knowthat_event_outbox",
    "column_name": "payload_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_event_outbox",
    "column_name": "target",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_event_outbox",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_event_outbox",
    "column_name": "attempt_count",
    "not_null": true,
    "default_expression": "0",
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "knowthat_event_outbox",
    "column_name": "next_retry_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "knowthat_event_outbox",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "knowthat_event_outbox",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "knowthat_event_outbox",
    "column_name": "claimed_by",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_event_outbox",
    "column_name": "claim_token",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_event_outbox",
    "column_name": "acknowledged_claim_token",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_event_outbox",
    "column_name": "locked_until",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "knowthat_event_outbox",
    "column_name": "last_error",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "knowthat_event_outbox",
    "column_name": "transport_ref",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_event_outbox",
    "column_name": "transport_epoch",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_event_outbox",
    "column_name": "transport_generation",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "knowthat_event_outbox",
    "column_name": "sent_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "knowthat_event_outbox",
    "column_name": "reconciliation_missing_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "knowthat_event_outbox",
    "column_name": "reconciliation_missing_reporter",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_event_outbox",
    "column_name": "reconciliation_next_probe_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "knowthat_event_outbox",
    "column_name": "reconciliation_claimed_by",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_event_outbox",
    "column_name": "reconciliation_claim_token",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_event_outbox",
    "column_name": "reconciliation_claim_generation",
    "not_null": false,
    "default_expression": "0",
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "knowthat_event_outbox",
    "column_name": "reconciliation_locked_until",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "knowthat_fact_query_versions",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_fact_query_versions",
    "column_name": "fact_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_fact_query_versions",
    "column_name": "visible_from_revision",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "knowthat_fact_query_versions",
    "column_name": "visible_until_revision",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "knowthat_fact_query_versions",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_fact_query_versions",
    "column_name": "category",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_fact_query_versions",
    "column_name": "semantic_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_fact_query_versions",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "knowthat_fact_query_versions",
    "column_name": "valid_from",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "knowthat_fact_query_versions",
    "column_name": "valid_until",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "knowthat_fact_query_versions",
    "column_name": "search_vector",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "tsvector"
  },
  {
    "table_name": "knowthat_fact_query_versions",
    "column_name": "projection_payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "knowthat_fact_query_versions",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "knowthat_fact_revisions",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_fact_revisions",
    "column_name": "fact_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_fact_revisions",
    "column_name": "revision_no",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "knowthat_fact_revisions",
    "column_name": "patch",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "knowthat_fact_revisions",
    "column_name": "reason",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_fact_revisions",
    "column_name": "actor",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_fact_revisions",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "knowthat_fact_revisions",
    "column_name": "promotion_reservation_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_fact_revisions",
    "column_name": "promotion_fence_generation",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "knowthat_fact_revisions",
    "column_name": "promotion_reservation_token_hash",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_fact_revisions",
    "column_name": "promotion_committed_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "knowthat_facts",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_facts",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_facts",
    "column_name": "text",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_facts",
    "column_name": "subject",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_facts",
    "column_name": "predicate",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_facts",
    "column_name": "object",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_facts",
    "column_name": "normalized_object",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_facts",
    "column_name": "object_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_facts",
    "column_name": "canonicalization_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_facts",
    "column_name": "semantic_key_display",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_facts",
    "column_name": "semantic_components_raw",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "knowthat_facts",
    "column_name": "semantic_components_normalized",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "knowthat_facts",
    "column_name": "semantic_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_facts",
    "column_name": "category",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_facts",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_facts",
    "column_name": "confidence",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "double precision"
  },
  {
    "table_name": "knowthat_facts",
    "column_name": "source",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_facts",
    "column_name": "source_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_facts",
    "column_name": "evidence_refs",
    "not_null": true,
    "default_expression": "'{}'::text[]",
    "identity": "",
    "generated": "",
    "postgres_type": "text[]"
  },
  {
    "table_name": "knowthat_facts",
    "column_name": "valid_from",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "knowthat_facts",
    "column_name": "valid_until",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "knowthat_facts",
    "column_name": "payload_schema_version",
    "not_null": true,
    "default_expression": "'knowthat_fact.v1'::text",
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_facts",
    "column_name": "candidate_version",
    "not_null": true,
    "default_expression": "1",
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "knowthat_facts",
    "column_name": "state_version",
    "not_null": true,
    "default_expression": "1",
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "knowthat_facts",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "knowthat_facts",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "knowthat_feedback_events",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_feedback_events",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_feedback_events",
    "column_name": "fact_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_feedback_events",
    "column_name": "feedback_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_feedback_events",
    "column_name": "payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "knowthat_feedback_events",
    "column_name": "evidence_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_feedback_events",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "knowthat_feedback_events",
    "column_name": "schema_version",
    "not_null": true,
    "default_expression": "'knowthat_feedback.v2'::text",
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_feedback_events",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_feedback_events",
    "column_name": "request_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_feedback_events",
    "column_name": "feedback_payload_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_feedback_events",
    "column_name": "response_payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "knowthat_feedback_events",
    "column_name": "trace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_feedback_events",
    "column_name": "caller_principal_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_feedback_events",
    "column_name": "caller_principal_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_feedback_events",
    "column_name": "caller_service",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_feedback_events",
    "column_name": "verified_capability",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_feedback_events",
    "column_name": "generated_candidate_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_feedback_events",
    "column_name": "generated_candidate_version",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "knowthat_linkage_checks",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_linkage_checks",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_linkage_checks",
    "column_name": "fact_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_linkage_checks",
    "column_name": "check_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_linkage_checks",
    "column_name": "target_service",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_linkage_checks",
    "column_name": "change_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_linkage_checks",
    "column_name": "affected_query",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "knowthat_linkage_checks",
    "column_name": "target_memory_point_ids",
    "not_null": true,
    "default_expression": "'{}'::text[]",
    "identity": "",
    "generated": "",
    "postgres_type": "text[]"
  },
  {
    "table_name": "knowthat_linkage_checks",
    "column_name": "action",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_linkage_checks",
    "column_name": "reason",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_linkage_checks",
    "column_name": "evidence_refs",
    "not_null": true,
    "default_expression": "'{}'::text[]",
    "identity": "",
    "generated": "",
    "postgres_type": "text[]"
  },
  {
    "table_name": "knowthat_linkage_checks",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_linkage_checks",
    "column_name": "attempt_count",
    "not_null": true,
    "default_expression": "0",
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "knowthat_linkage_checks",
    "column_name": "next_retry_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "knowthat_linkage_checks",
    "column_name": "locked_by",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_linkage_checks",
    "column_name": "locked_until",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "knowthat_linkage_checks",
    "column_name": "last_error",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "knowthat_linkage_checks",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_linkage_checks",
    "column_name": "result",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "knowthat_linkage_checks",
    "column_name": "payload_schema_version",
    "not_null": true,
    "default_expression": "'knowthat_linkage_check.v1'::text",
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_linkage_checks",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "knowthat_linkage_checks",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "knowthat_linkage_checks",
    "column_name": "lease_generation",
    "not_null": true,
    "default_expression": "0",
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "knowthat_linkage_checks",
    "column_name": "claim_token",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_linkage_checks",
    "column_name": "job_version",
    "not_null": true,
    "default_expression": "1",
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "knowthat_linkage_recovery_receipts",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_linkage_recovery_receipts",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_linkage_recovery_receipts",
    "column_name": "linkage_check_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_linkage_recovery_receipts",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_linkage_recovery_receipts",
    "column_name": "request_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_linkage_recovery_receipts",
    "column_name": "response_payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "knowthat_linkage_recovery_receipts",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "knowthat_memory_command_outbox",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_memory_command_outbox",
    "column_name": "command_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_memory_command_outbox",
    "column_name": "reservation_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_memory_command_outbox",
    "column_name": "candidate_fact_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_memory_command_outbox",
    "column_name": "fencing_generation",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "knowthat_memory_command_outbox",
    "column_name": "reservation_token_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_memory_command_outbox",
    "column_name": "promotion_revision_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_memory_command_outbox",
    "column_name": "committed_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "knowthat_memory_command_outbox",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_memory_command_outbox",
    "column_name": "request_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_memory_command_outbox",
    "column_name": "payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "knowthat_memory_command_outbox",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_memory_command_outbox",
    "column_name": "attempt_count",
    "not_null": true,
    "default_expression": "0",
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "knowthat_memory_command_outbox",
    "column_name": "next_retry_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "knowthat_memory_command_outbox",
    "column_name": "last_error",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "knowthat_memory_command_outbox",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "knowthat_memory_command_outbox",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "knowthat_memory_command_outbox",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_memory_command_outbox",
    "column_name": "reservation_expires_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "knowthat_memory_command_outbox",
    "column_name": "release_reason",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_memory_command_outbox",
    "column_name": "released_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "knowthat_memory_command_outbox",
    "column_name": "claim_token",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_memory_command_outbox",
    "column_name": "acknowledged_claim_token",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_memory_command_outbox",
    "column_name": "locked_by",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_memory_command_outbox",
    "column_name": "locked_until",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "knowthat_memory_command_outbox",
    "column_name": "transport_ref",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_memory_command_outbox",
    "column_name": "transport_epoch",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_memory_command_outbox",
    "column_name": "transport_generation",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "knowthat_memory_command_outbox",
    "column_name": "sent_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "knowthat_query_revisions",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_query_revisions",
    "column_name": "current_revision",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "knowthat_query_revisions",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "knowthat_write_batches",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_write_batches",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_write_batches",
    "column_name": "trigger_process_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_write_batches",
    "column_name": "source_meta_job_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_write_batches",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_write_batches",
    "column_name": "request_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_write_batches",
    "column_name": "trace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_write_batches",
    "column_name": "request_payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "knowthat_write_batches",
    "column_name": "response_payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "knowthat_write_batches",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_write_batches",
    "column_name": "payload_schema_version",
    "not_null": true,
    "default_expression": "'knowthat.write_batch.v1'::text",
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "knowthat_write_batches",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "knowthat_write_batches",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "semantic_key_aliases",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "semantic_key_aliases",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "semantic_key_aliases",
    "column_name": "target_fact_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "semantic_key_aliases",
    "column_name": "old_canonicalization_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "semantic_key_aliases",
    "column_name": "old_semantic_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "semantic_key_aliases",
    "column_name": "new_canonicalization_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "semantic_key_aliases",
    "column_name": "new_semantic_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "semantic_key_aliases",
    "column_name": "actor_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "semantic_key_aliases",
    "column_name": "reason",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "semantic_key_aliases",
    "column_name": "evidence_refs",
    "not_null": true,
    "default_expression": "'[]'::jsonb",
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "semantic_key_aliases",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "semantic_key_synonyms",
    "column_name": "segment",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "semantic_key_synonyms",
    "column_name": "synonym",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "semantic_key_synonyms",
    "column_name": "canonical",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  }
] as const;

export const KNOWTHAT_DATABASE_CHECKS_V1 = [
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
    "constraint_name": "knowthat_audit_logs_actor_check",
    "table_name": "knowthat_audit_logs",
    "required_definition_fragments": [
      "CHECK (jsonb_typeof(actor) = 'object'::text)"
    ]
  },
  {
    "constraint_name": "knowthat_audit_logs_payload_check",
    "table_name": "knowthat_audit_logs",
    "required_definition_fragments": [
      "CHECK (jsonb_typeof(payload) = 'object'::text)"
    ]
  },
  {
    "constraint_name": "knowthat_audit_logs_state_version_check",
    "table_name": "knowthat_audit_logs",
    "required_definition_fragments": [
      "CHECK (state_version >= 1 AND state_version <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "integer_range",
      "column_name": "state_version",
      "min": 1,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "knowthat_candidate_reviews_decision_check",
    "table_name": "knowthat_candidate_reviews",
    "required_definition_fragments": [
      "CHECK (decision = ANY (ARRAY['promote'::text, 'keep_candidate'::text, 'reject'::text, 'expire'::text, 'request_feedback'::text]))"
    ]
  },
  {
    "constraint_name": "knowthat_candidate_reviews_memory_fencing_generation_check",
    "table_name": "knowthat_candidate_reviews",
    "required_definition_fragments": [
      "CHECK (promotion_fence_generation IS NULL OR promotion_fence_generation >= 1 AND promotion_fence_generation <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "nullable_integer_range",
      "column_name": "promotion_fence_generation",
      "min": 1,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "knowthat_candidate_reviews_memory_reservation_check",
    "table_name": "knowthat_candidate_reviews",
    "required_definition_fragments": [
      "CHECK (promotion_reservation_id IS NULL AND promotion_fence_generation IS NULL AND promotion_reservation_token_hash IS NULL AND promotion_reservation_expires_at IS NULL AND promotion_committed_at IS NULL OR decision = 'promote'::text AND promotion_reservation_id IS NOT NULL AND promotion_fence_generation IS NOT NULL AND promotion_reservation_token_hash IS NOT NULL AND promotion_reservation_expires_at IS NOT NULL AND (promotion_committed_at IS NULL OR promotion_committed_at <= promotion_reservation_expires_at))"
    ]
  },
  {
    "constraint_name": "knowthat_candidate_reviews_outcome_check",
    "table_name": "knowthat_candidate_reviews",
    "required_definition_fragments": [
      "CHECK (outcome = ANY (ARRAY['accepted'::text, 'rejected'::text, 'stale_candidate_version'::text]))"
    ]
  },
  {
    "constraint_name": "knowthat_candidate_reviews_suggested_action_check",
    "table_name": "knowthat_candidate_reviews",
    "required_definition_fragments": [
      "CHECK (suggested_action = ANY (ARRAY['promote'::text, 'keep_candidate'::text, 'reject'::text, 'expire'::text, 'request_feedback'::text]))"
    ]
  },
  {
    "constraint_name": "knowthat_conflicts_status_check",
    "table_name": "knowthat_conflicts",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['open'::text, 'auto_resolved'::text, 'feedback_requested'::text, 'resolved'::text, 'ignored'::text]))"
    ]
  },
  {
    "constraint_name": "knowthat_event_dlq_resolutions_resolution_payload_check",
    "table_name": "knowthat_event_dlq_resolutions",
    "required_definition_fragments": [
      "CHECK (jsonb_typeof(resolution_payload) = 'object'::text)"
    ]
  },
  {
    "constraint_name": "knowthat_event_inbox_event_id_check",
    "table_name": "knowthat_event_inbox",
    "required_definition_fragments": [
      "CHECK (length(event_id) > 0)"
    ]
  },
  {
    "constraint_name": "knowthat_event_inbox_payload_hash_check",
    "table_name": "knowthat_event_inbox",
    "required_definition_fragments": [
      "CHECK (length(payload_hash) > 0)"
    ]
  },
  {
    "constraint_name": "knowthat_event_inbox_scope_fingerprint_check",
    "table_name": "knowthat_event_inbox",
    "required_definition_fragments": [
      "CHECK (length(scope_fingerprint) > 0)"
    ]
  },
  {
    "constraint_name": "knowthat_event_inbox_semantic_hash_check",
    "table_name": "knowthat_event_inbox",
    "required_definition_fragments": [
      "CHECK (length(semantic_hash) > 0)"
    ]
  },
  {
    "constraint_name": "knowthat_event_outbox_ack_fence_check",
    "table_name": "knowthat_event_outbox",
    "required_definition_fragments": [
      "CHECK ((status = 'sent'::text) = (acknowledged_claim_token IS NOT NULL))"
    ]
  },
  {
    "constraint_name": "knowthat_event_outbox_check",
    "table_name": "knowthat_event_outbox",
    "required_definition_fragments": [
      "CHECK ((payload ->> 'bot_id'::text) = bot_id)"
    ]
  },
  {
    "constraint_name": "knowthat_event_outbox_claim_fence_check",
    "table_name": "knowthat_event_outbox",
    "required_definition_fragments": [
      "CHECK ((status = 'dispatching'::text) = (claimed_by IS NOT NULL AND claim_token IS NOT NULL AND locked_until IS NOT NULL))"
    ]
  },
  {
    "constraint_name": "knowthat_event_outbox_event_type_check",
    "table_name": "knowthat_event_outbox",
    "required_definition_fragments": [
      "CHECK (event_type = ANY (ARRAY['knowthat.fact.created'::text, 'knowthat.fact.updated'::text, 'knowthat.candidate.promoted'::text, 'knowthat.candidate.rejected'::text, 'knowthat.fact.expired'::text, 'knowthat.conflict.detected'::text, 'knowthat.linkage_check.requested'::text]))"
    ],
    "semantic_constraint": {
      "kind": "text_enum",
      "column_name": "event_type",
      "allowed_values": [
        "knowthat.fact.created",
        "knowthat.fact.updated",
        "knowthat.candidate.promoted",
        "knowthat.candidate.rejected",
        "knowthat.fact.expired",
        "knowthat.conflict.detected",
        "knowthat.linkage_check.requested"
      ]
    }
  },
  {
    "constraint_name": "knowthat_event_outbox_producer_check",
    "table_name": "knowthat_event_outbox",
    "required_definition_fragments": [
      "CHECK (producer = 'knowthat'::text)"
    ],
    "semantic_constraint": {
      "kind": "text_equals",
      "column_name": "producer",
      "value": "knowthat"
    }
  },
  {
    "constraint_name": "knowthat_event_outbox_reconciliation_generation_check",
    "table_name": "knowthat_event_outbox",
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
    "constraint_name": "knowthat_event_outbox_sent_at_check",
    "table_name": "knowthat_event_outbox",
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
    "constraint_name": "knowthat_event_outbox_sent_transport_epoch_check",
    "table_name": "knowthat_event_outbox",
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
    "constraint_name": "knowthat_event_outbox_sent_transport_generation_check",
    "table_name": "knowthat_event_outbox",
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
    "constraint_name": "knowthat_event_outbox_sent_transport_ref_check",
    "table_name": "knowthat_event_outbox",
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
    "constraint_name": "knowthat_event_outbox_status_check",
    "table_name": "knowthat_event_outbox",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['pending'::text, 'dispatching'::text, 'sent'::text, 'retry_wait'::text, 'failed'::text]))"
    ]
  },
  {
    "constraint_name": "knowthat_event_outbox_target_check",
    "table_name": "knowthat_event_outbox",
    "required_definition_fragments": [
      "CHECK (target <> ALL (ARRAY['observation'::text, 'observation_gateway'::text]))"
    ]
  },
  {
    "constraint_name": "knowthat_event_outbox_transport_generation_safe_check",
    "table_name": "knowthat_event_outbox",
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
    "constraint_name": "knowthat_fact_query_versions_check",
    "table_name": "knowthat_fact_query_versions",
    "required_definition_fragments": [
      "CHECK (visible_until_revision IS NULL OR visible_until_revision > visible_from_revision)"
    ]
  },
  {
    "constraint_name": "knowthat_fact_query_versions_status_check",
    "table_name": "knowthat_fact_query_versions",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['candidate'::text, 'active'::text, 'rejected'::text, 'expired'::text]))"
    ]
  },
  {
    "constraint_name": "knowthat_fact_query_versions_visible_from_revision_check",
    "table_name": "knowthat_fact_query_versions",
    "required_definition_fragments": [
      "CHECK (visible_from_revision > 0)"
    ]
  },
  {
    "constraint_name": "knowthat_fact_revisions_promotion_fence_generation_check",
    "table_name": "knowthat_fact_revisions",
    "required_definition_fragments": [
      "CHECK (promotion_fence_generation IS NULL OR promotion_fence_generation >= 1 AND promotion_fence_generation <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "nullable_integer_range",
      "column_name": "promotion_fence_generation",
      "min": 1,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "knowthat_fact_revisions_revision_no_check",
    "table_name": "knowthat_fact_revisions",
    "required_definition_fragments": [
      "CHECK (revision_no > 0)"
    ]
  },
  {
    "constraint_name": "knowthat_facts_candidate_version_check",
    "table_name": "knowthat_facts",
    "required_definition_fragments": [
      "CHECK (candidate_version > 0)"
    ]
  },
  {
    "constraint_name": "knowthat_facts_canonicalization_version_check",
    "table_name": "knowthat_facts",
    "required_definition_fragments": [
      "CHECK (canonicalization_version = 'knowthat.semantic_key.v1'::text)"
    ]
  },
  {
    "constraint_name": "knowthat_facts_category_check",
    "table_name": "knowthat_facts",
    "required_definition_fragments": [
      "CHECK (category = ANY (ARRAY['user_profile'::text, 'relationship_state'::text, 'world_state'::text, 'self_state'::text, 'project_fact'::text, 'preference'::text, 'rule'::text]))"
    ]
  },
  {
    "constraint_name": "knowthat_facts_confidence_check",
    "table_name": "knowthat_facts",
    "required_definition_fragments": [
      "CHECK (confidence >= 0::double precision AND confidence <= 1::double precision)"
    ]
  },
  {
    "constraint_name": "knowthat_facts_source_check",
    "table_name": "knowthat_facts",
    "required_definition_fragments": [
      "CHECK (source = ANY (ARRAY['explicit_feedback'::text, 'super_user_explicit'::text, 'approved_artifact'::text, 'system_event_tool_result'::text, 'user_explicit'::text, 'developer_note'::text, 'agent_observation'::text, 'meta_inference'::text]))"
    ]
  },
  {
    "constraint_name": "knowthat_facts_state_version_check",
    "table_name": "knowthat_facts",
    "required_definition_fragments": [
      "CHECK (state_version > 0)"
    ]
  },
  {
    "constraint_name": "knowthat_facts_status_check",
    "table_name": "knowthat_facts",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['candidate'::text, 'active'::text, 'rejected'::text, 'expired'::text]))"
    ]
  },
  {
    "constraint_name": "knowthat_feedback_caller_check",
    "table_name": "knowthat_feedback_events",
    "required_definition_fragments": [
      "CHECK (caller_principal_type = 'service'::text AND caller_service = 'trigger_processor'::text AND caller_principal_id = 'trigger_processor'::text OR (caller_principal_type = ANY (ARRAY['user'::text, 'developer'::text, 'operator'::text])) AND caller_service IS NULL)"
    ]
  },
  {
    "constraint_name": "knowthat_feedback_candidate_check",
    "table_name": "knowthat_feedback_events",
    "required_definition_fragments": [
      "CHECK (feedback_type = 'correct'::text AND generated_candidate_id IS NOT NULL AND generated_candidate_version = 1 OR feedback_type <> 'correct'::text AND generated_candidate_id IS NULL AND generated_candidate_version IS NULL)"
    ]
  },
  {
    "constraint_name": "knowthat_feedback_events_caller_principal_type_check",
    "table_name": "knowthat_feedback_events",
    "required_definition_fragments": [
      "CHECK (caller_principal_type = ANY (ARRAY['user'::text, 'developer'::text, 'operator'::text, 'service'::text]))"
    ]
  },
  {
    "constraint_name": "knowthat_feedback_events_schema_version_check",
    "table_name": "knowthat_feedback_events",
    "required_definition_fragments": [
      "CHECK (schema_version = 'knowthat_feedback.v2'::text)"
    ]
  },
  {
    "constraint_name": "knowthat_feedback_events_verified_capability_check",
    "table_name": "knowthat_feedback_events",
    "required_definition_fragments": [
      "CHECK (verified_capability = 'knowthat.feedback.submit'::text)"
    ]
  },
  {
    "constraint_name": "knowthat_feedback_hash_format_check",
    "table_name": "knowthat_feedback_events",
    "required_definition_fragments": [
      "CHECK (request_hash ~ '^sha256:[0-9a-f]{64}$'::text AND feedback_payload_hash ~ '^sha256:[0-9a-f]{64}$'::text)"
    ]
  },
  {
    "constraint_name": "knowthat_feedback_payload_object_check",
    "table_name": "knowthat_feedback_events",
    "required_definition_fragments": [
      "CHECK (jsonb_typeof(payload) = 'object'::text AND (payload ->> 'kind'::text) = feedback_type)"
    ]
  },
  {
    "constraint_name": "knowthat_feedback_type_check",
    "table_name": "knowthat_feedback_events",
    "required_definition_fragments": [
      "CHECK (feedback_type = ANY (ARRAY['confirm'::text, 'deny'::text, 'clarify'::text, 'correct'::text]))"
    ]
  },
  {
    "constraint_name": "knowthat_linkage_checks_action_check",
    "table_name": "knowthat_linkage_checks",
    "required_definition_fragments": [
      "CHECK (action = ANY (ARRAY['downgrade'::text, 'mark_historical'::text, 'append_version'::text, 'feedback_required'::text, 'no_op'::text]))"
    ]
  },
  {
    "constraint_name": "knowthat_linkage_checks_claim_fence_check",
    "table_name": "knowthat_linkage_checks",
    "required_definition_fragments": [
      "CHECK ((status = 'running'::text) = (locked_by IS NOT NULL AND locked_until IS NOT NULL AND claim_token IS NOT NULL))"
    ]
  },
  {
    "constraint_name": "knowthat_linkage_checks_job_version_check",
    "table_name": "knowthat_linkage_checks",
    "required_definition_fragments": [
      "CHECK (job_version >= 1 AND job_version <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "integer_range",
      "column_name": "job_version",
      "min": 1,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "knowthat_linkage_checks_lease_generation_check",
    "table_name": "knowthat_linkage_checks",
    "required_definition_fragments": [
      "CHECK (lease_generation >= 0 AND lease_generation <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "integer_range",
      "column_name": "lease_generation",
      "min": 0,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "knowthat_linkage_checks_status_check",
    "table_name": "knowthat_linkage_checks",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['pending'::text, 'running'::text, 'retry_wait'::text, 'completed'::text, 'failed'::text, 'skipped'::text]))"
    ]
  },
  {
    "constraint_name": "knowthat_linkage_recovery_receipts_request_hash_check",
    "table_name": "knowthat_linkage_recovery_receipts",
    "required_definition_fragments": [
      "CHECK (request_hash ~ '^sha256:[0-9a-f]{64}$'::text)"
    ]
  },
  {
    "constraint_name": "knowthat_linkage_recovery_receipts_response_payload_check",
    "table_name": "knowthat_linkage_recovery_receipts",
    "required_definition_fragments": [
      "CHECK (jsonb_typeof(response_payload) = 'object'::text)"
    ]
  },
  {
    "constraint_name": "knowthat_memory_command_last_error_secret_check",
    "table_name": "knowthat_memory_command_outbox",
    "required_definition_fragments": [
      "CHECK (last_error IS NULL OR NOT jsonb_path_exists(last_error, '$.**.\"reservation_token\"'::jsonpath))"
    ]
  },
  {
    "constraint_name": "knowthat_memory_command_outbox_ack_fence_check",
    "table_name": "knowthat_memory_command_outbox",
    "required_definition_fragments": [
      "CHECK ((status = 'sent'::text) = (acknowledged_claim_token IS NOT NULL))"
    ]
  },
  {
    "constraint_name": "knowthat_memory_command_outbox_attempt_count_check",
    "table_name": "knowthat_memory_command_outbox",
    "required_definition_fragments": [
      "CHECK (attempt_count >= 0)"
    ]
  },
  {
    "constraint_name": "knowthat_memory_command_outbox_check",
    "table_name": "knowthat_memory_command_outbox",
    "required_definition_fragments": [
      "CHECK (command_type <> 'promotion_reservation_ack'::text OR promotion_revision_id IS NOT NULL AND committed_at IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "knowthat_memory_command_outbox_claim_fence_check",
    "table_name": "knowthat_memory_command_outbox",
    "required_definition_fragments": [
      "CHECK ((status = 'dispatching'::text) = (locked_by IS NOT NULL AND claim_token IS NOT NULL AND locked_until IS NOT NULL))"
    ]
  },
  {
    "constraint_name": "knowthat_memory_command_outbox_command_type_check",
    "table_name": "knowthat_memory_command_outbox",
    "required_definition_fragments": [
      "CHECK (command_type = ANY (ARRAY['promotion_reservation_ack'::text, 'promotion_reservation_release'::text]))"
    ]
  },
  {
    "constraint_name": "knowthat_memory_command_outbox_fencing_generation_check",
    "table_name": "knowthat_memory_command_outbox",
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
    "constraint_name": "knowthat_memory_command_outbox_status_check",
    "table_name": "knowthat_memory_command_outbox",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['pending'::text, 'dispatching'::text, 'sent'::text, 'retry_wait'::text, 'failed'::text, 'fenced'::text]))"
    ]
  },
  {
    "constraint_name": "knowthat_memory_command_outbox_transport_generation_check",
    "table_name": "knowthat_memory_command_outbox",
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
    "constraint_name": "knowthat_memory_command_payload_check",
    "table_name": "knowthat_memory_command_outbox",
    "required_definition_fragments": [
      "CHECK (jsonb_typeof(payload) = 'object'::text AND NOT jsonb_path_exists(payload, '$.**.\"reservation_token\"'::jsonpath) AND payload ?& ARRAY['schema_version'::text, 'bot_id'::text, 'candidate_fact_id'::text, 'reservation_id'::text, 'fencing_generation'::text, 'reservation_token_hash'::text, 'idempotency_key'::text, 'trace_id'::text] AND (payload ->> 'bot_id'::text) = bot_id AND (payload ->> 'candidate_fact_id'::text) = candidate_fact_id AND (payload ->> 'reservation_id'::text) = reservation_id AND NULLIF(payload ->> 'fencing_generation'::text, ''::text)::bigint = fencing_generation AND (payload ->> 'reservation_token_hash'::text) = reservation_token_hash AND (payload ->> 'idempotency_key'::text) = idempotency_key AND (command_type = 'promotion_reservation_ack'::text AND (payload ->> 'schema_version'::text) = 'memory.promotion_reservation_ack.v1'::text AND payload ?& ARRAY['promotion_revision_id'::text, 'committed_at'::text] AND (payload ->> 'promotion_revision_id'::text) = promotion_revision_id AND ((payload ->> 'committed_at'::text)::timestamp with time zone) = committed_at OR command_type = 'promotion_reservation_release'::text AND (payload ->> 'schema_version'::text) = 'memory.promotion_reservation_release.v1'::text AND payload ? 'reason_code'::text AND promotion_revision_id IS NULL AND committed_at IS NULL))"
    ]
  },
  {
    "constraint_name": "knowthat_memory_command_token_hash_format_check",
    "table_name": "knowthat_memory_command_outbox",
    "required_definition_fragments": [
      "CHECK (reservation_token_hash ~ '^sha256:[0-9a-f]{64}$'::text)"
    ]
  },
  {
    "constraint_name": "knowthat_query_revisions_current_revision_check",
    "table_name": "knowthat_query_revisions",
    "required_definition_fragments": [
      "CHECK (current_revision > 0)"
    ]
  },
  {
    "constraint_name": "knowthat_write_batches_payload_schema_version_check",
    "table_name": "knowthat_write_batches",
    "required_definition_fragments": [
      "CHECK (payload_schema_version = 'knowthat.write_batch.v1'::text)"
    ]
  },
  {
    "constraint_name": "knowthat_write_batches_status_check",
    "table_name": "knowthat_write_batches",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['completed'::text, 'partial_failed'::text]))"
    ]
  },
  {
    "constraint_name": "semantic_key_synonyms_segment_check",
    "table_name": "semantic_key_synonyms",
    "required_definition_fragments": [
      "CHECK (segment = ANY (ARRAY['subject'::text, 'predicate'::text, 'object'::text]))"
    ]
  }
] as const;

export const KNOWTHAT_DATABASE_FUNCTIONS_V1 = [] as const;

export const KNOWTHAT_DATABASE_TRIGGERS_V1 = [] as const;

export const KNOWTHAT_DATABASE_UNIQUE_CONSTRAINTS_V1 = [
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
    "constraint_name": "knowthat_audit_logs_pkey",
    "table_name": "knowthat_audit_logs",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "knowthat_candidate_reviews_fact_id_evidence_set_hash_key",
    "table_name": "knowthat_candidate_reviews",
    "columns": [
      "fact_id",
      "evidence_set_hash"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "knowthat_candidate_reviews_idempotency_uq",
    "table_name": "knowthat_candidate_reviews",
    "columns": [
      "idempotency_key"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "knowthat_candidate_reviews_pkey",
    "table_name": "knowthat_candidate_reviews",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "knowthat_candidate_reviews_suggestion_uq",
    "table_name": "knowthat_candidate_reviews",
    "columns": [
      "source_meta_job_id",
      "suggestion_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "knowthat_conflicts_bot_id_conflict_key_key",
    "table_name": "knowthat_conflicts",
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
    "constraint_name": "knowthat_conflicts_pkey",
    "table_name": "knowthat_conflicts",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "knowthat_event_dlq_pkey",
    "table_name": "knowthat_event_dlq",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "knowthat_event_dlq_resolutions_dlq_id_key",
    "table_name": "knowthat_event_dlq_resolutions",
    "columns": [
      "dlq_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "knowthat_event_dlq_resolutions_idempotency_key_key",
    "table_name": "knowthat_event_dlq_resolutions",
    "columns": [
      "idempotency_key"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "knowthat_event_dlq_resolutions_pkey",
    "table_name": "knowthat_event_dlq_resolutions",
    "columns": [
      "resolution_id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "knowthat_event_inbox_pkey",
    "table_name": "knowthat_event_inbox",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "knowthat_event_inbox_source_event_id_key",
    "table_name": "knowthat_event_inbox",
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
    "constraint_name": "knowthat_event_inbox_source_idempotency_key_key",
    "table_name": "knowthat_event_inbox",
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
    "constraint_name": "knowthat_event_outbox_pkey",
    "table_name": "knowthat_event_outbox",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "knowthat_event_outbox_target_idempotency_key_key",
    "table_name": "knowthat_event_outbox",
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
    "constraint_name": "knowthat_fact_query_versions_pkey",
    "table_name": "knowthat_fact_query_versions",
    "columns": [
      "bot_id",
      "fact_id",
      "visible_from_revision"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "knowthat_fact_revisions_fact_id_revision_no_key",
    "table_name": "knowthat_fact_revisions",
    "columns": [
      "fact_id",
      "revision_no"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "knowthat_fact_revisions_pkey",
    "table_name": "knowthat_fact_revisions",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "knowthat_facts_bot_id_semantic_key_source_ref_key",
    "table_name": "knowthat_facts",
    "columns": [
      "bot_id",
      "semantic_key",
      "source_ref"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "knowthat_facts_id_bot_uq",
    "table_name": "knowthat_facts",
    "columns": [
      "id",
      "bot_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "knowthat_facts_pkey",
    "table_name": "knowthat_facts",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "knowthat_feedback_events_fact_id_evidence_ref_key",
    "table_name": "knowthat_feedback_events",
    "columns": [
      "fact_id",
      "evidence_ref"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "knowthat_feedback_events_pkey",
    "table_name": "knowthat_feedback_events",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "knowthat_linkage_checks_bot_id_idempotency_key_key",
    "table_name": "knowthat_linkage_checks",
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
    "constraint_name": "knowthat_linkage_checks_pkey",
    "table_name": "knowthat_linkage_checks",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "knowthat_linkage_recovery_receipts_bot_id_idempotency_key_key",
    "table_name": "knowthat_linkage_recovery_receipts",
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
    "constraint_name": "knowthat_linkage_recovery_receipts_pkey",
    "table_name": "knowthat_linkage_recovery_receipts",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "knowthat_memory_command_outbo_command_type_reservation_id_f_key",
    "table_name": "knowthat_memory_command_outbox",
    "columns": [
      "command_type",
      "reservation_id",
      "fencing_generation"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "knowthat_memory_command_outbox_idempotency_key_key",
    "table_name": "knowthat_memory_command_outbox",
    "columns": [
      "idempotency_key"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "knowthat_memory_command_outbox_pkey",
    "table_name": "knowthat_memory_command_outbox",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "knowthat_query_revisions_pkey",
    "table_name": "knowthat_query_revisions",
    "columns": [
      "bot_id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "knowthat_write_batches_bot_id_idempotency_key_key",
    "table_name": "knowthat_write_batches",
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
    "constraint_name": "knowthat_write_batches_pkey",
    "table_name": "knowthat_write_batches",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "semantic_key_aliases_bot_id_old_canonicalization_version_ol_key",
    "table_name": "semantic_key_aliases",
    "columns": [
      "bot_id",
      "old_canonicalization_version",
      "old_semantic_key"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "semantic_key_aliases_pkey",
    "table_name": "semantic_key_aliases",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "semantic_key_synonyms_pkey",
    "table_name": "semantic_key_synonyms",
    "columns": [
      "segment",
      "synonym"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  }
] as const;

export const KNOWTHAT_DATABASE_INDEXES_V1 = [
  {
    "index_name": "eventing_transport_epochs_pkey",
    "table_name": "eventing_transport_epochs",
    "definition": "CREATE UNIQUE INDEX eventing_transport_epochs_pkey ON knowthat.eventing_transport_epochs USING btree (transport_name)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "knowthat_audit_logs_pkey",
    "table_name": "knowthat_audit_logs",
    "definition": "CREATE UNIQUE INDEX knowthat_audit_logs_pkey ON knowthat.knowthat_audit_logs USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "knowthat_candidate_reviews_fact_id_evidence_set_hash_key",
    "table_name": "knowthat_candidate_reviews",
    "definition": "CREATE UNIQUE INDEX knowthat_candidate_reviews_fact_id_evidence_set_hash_key ON knowthat.knowthat_candidate_reviews USING btree (fact_id, evidence_set_hash)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "knowthat_candidate_reviews_fact_idx",
    "table_name": "knowthat_candidate_reviews",
    "definition": "CREATE INDEX knowthat_candidate_reviews_fact_idx ON knowthat.knowthat_candidate_reviews USING btree (fact_id, created_at DESC)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "knowthat_candidate_reviews_idempotency_uq",
    "table_name": "knowthat_candidate_reviews",
    "definition": "CREATE UNIQUE INDEX knowthat_candidate_reviews_idempotency_uq ON knowthat.knowthat_candidate_reviews USING btree (idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "knowthat_candidate_reviews_pkey",
    "table_name": "knowthat_candidate_reviews",
    "definition": "CREATE UNIQUE INDEX knowthat_candidate_reviews_pkey ON knowthat.knowthat_candidate_reviews USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "knowthat_candidate_reviews_suggestion_uq",
    "table_name": "knowthat_candidate_reviews",
    "definition": "CREATE UNIQUE INDEX knowthat_candidate_reviews_suggestion_uq ON knowthat.knowthat_candidate_reviews USING btree (source_meta_job_id, suggestion_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "knowthat_conflicts_bot_id_conflict_key_key",
    "table_name": "knowthat_conflicts",
    "definition": "CREATE UNIQUE INDEX knowthat_conflicts_bot_id_conflict_key_key ON knowthat.knowthat_conflicts USING btree (bot_id, conflict_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "knowthat_conflicts_pkey",
    "table_name": "knowthat_conflicts",
    "definition": "CREATE UNIQUE INDEX knowthat_conflicts_pkey ON knowthat.knowthat_conflicts USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "knowthat_event_dlq_pkey",
    "table_name": "knowthat_event_dlq",
    "definition": "CREATE UNIQUE INDEX knowthat_event_dlq_pkey ON knowthat.knowthat_event_dlq USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "knowthat_event_dlq_resolutions_dlq_id_key",
    "table_name": "knowthat_event_dlq_resolutions",
    "definition": "CREATE UNIQUE INDEX knowthat_event_dlq_resolutions_dlq_id_key ON knowthat.knowthat_event_dlq_resolutions USING btree (dlq_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "knowthat_event_dlq_resolutions_idempotency_key_key",
    "table_name": "knowthat_event_dlq_resolutions",
    "definition": "CREATE UNIQUE INDEX knowthat_event_dlq_resolutions_idempotency_key_key ON knowthat.knowthat_event_dlq_resolutions USING btree (idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "knowthat_event_dlq_resolutions_pkey",
    "table_name": "knowthat_event_dlq_resolutions",
    "definition": "CREATE UNIQUE INDEX knowthat_event_dlq_resolutions_pkey ON knowthat.knowthat_event_dlq_resolutions USING btree (resolution_id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "knowthat_event_inbox_pkey",
    "table_name": "knowthat_event_inbox",
    "definition": "CREATE UNIQUE INDEX knowthat_event_inbox_pkey ON knowthat.knowthat_event_inbox USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "knowthat_event_inbox_source_event_id_key",
    "table_name": "knowthat_event_inbox",
    "definition": "CREATE UNIQUE INDEX knowthat_event_inbox_source_event_id_key ON knowthat.knowthat_event_inbox USING btree (source, event_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "knowthat_event_inbox_source_idempotency_key_key",
    "table_name": "knowthat_event_inbox",
    "definition": "CREATE UNIQUE INDEX knowthat_event_inbox_source_idempotency_key_key ON knowthat.knowthat_event_inbox USING btree (source, idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "knowthat_event_outbox_dispatch_idx",
    "table_name": "knowthat_event_outbox",
    "definition": "CREATE INDEX knowthat_event_outbox_dispatch_idx ON knowthat.knowthat_event_outbox USING btree (status, next_retry_at, created_at) WHERE (status = ANY (ARRAY['pending'::text, 'retry_wait'::text]))",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "knowthat_event_outbox_pkey",
    "table_name": "knowthat_event_outbox",
    "definition": "CREATE UNIQUE INDEX knowthat_event_outbox_pkey ON knowthat.knowthat_event_outbox USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "knowthat_event_outbox_reconciliation_due_idx",
    "table_name": "knowthat_event_outbox",
    "definition": "CREATE INDEX knowthat_event_outbox_reconciliation_due_idx ON knowthat.knowthat_event_outbox USING btree (reconciliation_next_probe_at NULLS FIRST, sent_at, id) WHERE (status = 'sent'::text)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "knowthat_event_outbox_reconciliation_generation_idx",
    "table_name": "knowthat_event_outbox",
    "definition": "CREATE INDEX knowthat_event_outbox_reconciliation_generation_idx ON knowthat.knowthat_event_outbox USING btree (transport_epoch, transport_generation, sent_at, id) WHERE (status = 'sent'::text)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "knowthat_event_outbox_reconciliation_transport_ref_idx",
    "table_name": "knowthat_event_outbox",
    "definition": "CREATE INDEX knowthat_event_outbox_reconciliation_transport_ref_idx ON knowthat.knowthat_event_outbox USING btree (transport_ref, transport_epoch, transport_generation) WHERE ((status = 'sent'::text) AND (transport_ref IS NOT NULL))",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "knowthat_event_outbox_target_idempotency_key_key",
    "table_name": "knowthat_event_outbox",
    "definition": "CREATE UNIQUE INDEX knowthat_event_outbox_target_idempotency_key_key ON knowthat.knowthat_event_outbox USING btree (target, idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "knowthat_fact_query_current_uq",
    "table_name": "knowthat_fact_query_versions",
    "definition": "CREATE UNIQUE INDEX knowthat_fact_query_current_uq ON knowthat.knowthat_fact_query_versions USING btree (bot_id, fact_id) WHERE (visible_until_revision IS NULL)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "knowthat_fact_query_search_gin",
    "table_name": "knowthat_fact_query_versions",
    "definition": "CREATE INDEX knowthat_fact_query_search_gin ON knowthat.knowthat_fact_query_versions USING gin (search_vector)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "knowthat_fact_query_snapshot_idx",
    "table_name": "knowthat_fact_query_versions",
    "definition": "CREATE INDEX knowthat_fact_query_snapshot_idx ON knowthat.knowthat_fact_query_versions USING btree (bot_id, status, category, visible_from_revision, visible_until_revision, updated_at DESC, fact_id)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "knowthat_fact_query_versions_pkey",
    "table_name": "knowthat_fact_query_versions",
    "definition": "CREATE UNIQUE INDEX knowthat_fact_query_versions_pkey ON knowthat.knowthat_fact_query_versions USING btree (bot_id, fact_id, visible_from_revision)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "knowthat_fact_revisions_fact_id_revision_no_key",
    "table_name": "knowthat_fact_revisions",
    "definition": "CREATE UNIQUE INDEX knowthat_fact_revisions_fact_id_revision_no_key ON knowthat.knowthat_fact_revisions USING btree (fact_id, revision_no)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "knowthat_fact_revisions_pkey",
    "table_name": "knowthat_fact_revisions",
    "definition": "CREATE UNIQUE INDEX knowthat_fact_revisions_pkey ON knowthat.knowthat_fact_revisions USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "knowthat_candidate_query_idx",
    "table_name": "knowthat_facts",
    "definition": "CREATE INDEX knowthat_candidate_query_idx ON knowthat.knowthat_facts USING btree (bot_id, updated_at, id) WHERE (status = 'candidate'::text)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "knowthat_expiration_slot_cas_idx",
    "table_name": "knowthat_facts",
    "definition": "CREATE INDEX knowthat_expiration_slot_cas_idx ON knowthat.knowthat_facts USING btree (bot_id, semantic_key, status, valid_until, state_version) WHERE ((status = 'active'::text) AND (valid_until IS NOT NULL))",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "knowthat_facts_active_semantic_unique",
    "table_name": "knowthat_facts",
    "definition": "CREATE UNIQUE INDEX knowthat_facts_active_semantic_unique ON knowthat.knowthat_facts USING btree (bot_id, semantic_key) WHERE (status = 'active'::text)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "knowthat_facts_bot_id_semantic_key_source_ref_key",
    "table_name": "knowthat_facts",
    "definition": "CREATE UNIQUE INDEX knowthat_facts_bot_id_semantic_key_source_ref_key ON knowthat.knowthat_facts USING btree (bot_id, semantic_key, source_ref)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "knowthat_facts_id_bot_uq",
    "table_name": "knowthat_facts",
    "definition": "CREATE UNIQUE INDEX knowthat_facts_id_bot_uq ON knowthat.knowthat_facts USING btree (id, bot_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "knowthat_facts_pkey",
    "table_name": "knowthat_facts",
    "definition": "CREATE UNIQUE INDEX knowthat_facts_pkey ON knowthat.knowthat_facts USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "knowthat_facts_query_idx",
    "table_name": "knowthat_facts",
    "definition": "CREATE INDEX knowthat_facts_query_idx ON knowthat.knowthat_facts USING btree (bot_id, status, category, semantic_key)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "knowthat_facts_text_fts_gin",
    "table_name": "knowthat_facts",
    "definition": "CREATE INDEX knowthat_facts_text_fts_gin ON knowthat.knowthat_facts USING gin (to_tsvector('simple'::regconfig, text))",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "knowthat_facts_validity_idx",
    "table_name": "knowthat_facts",
    "definition": "CREATE INDEX knowthat_facts_validity_idx ON knowthat.knowthat_facts USING btree (bot_id, valid_from, valid_until) WHERE (status = 'active'::text)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "knowthat_feedback_events_fact_id_evidence_ref_key",
    "table_name": "knowthat_feedback_events",
    "definition": "CREATE UNIQUE INDEX knowthat_feedback_events_fact_id_evidence_ref_key ON knowthat.knowthat_feedback_events USING btree (fact_id, evidence_ref)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "knowthat_feedback_events_pkey",
    "table_name": "knowthat_feedback_events",
    "definition": "CREATE UNIQUE INDEX knowthat_feedback_events_pkey ON knowthat.knowthat_feedback_events USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "knowthat_feedback_generated_candidate_uq",
    "table_name": "knowthat_feedback_events",
    "definition": "CREATE UNIQUE INDEX knowthat_feedback_generated_candidate_uq ON knowthat.knowthat_feedback_events USING btree (generated_candidate_id) WHERE (generated_candidate_id IS NOT NULL)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "knowthat_feedback_idempotency_uq",
    "table_name": "knowthat_feedback_events",
    "definition": "CREATE UNIQUE INDEX knowthat_feedback_idempotency_uq ON knowthat.knowthat_feedback_events USING btree (bot_id, idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "knowthat_linkage_checks_bot_id_idempotency_key_key",
    "table_name": "knowthat_linkage_checks",
    "definition": "CREATE UNIQUE INDEX knowthat_linkage_checks_bot_id_idempotency_key_key ON knowthat.knowthat_linkage_checks USING btree (bot_id, idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "knowthat_linkage_checks_claim_idx",
    "table_name": "knowthat_linkage_checks",
    "definition": "CREATE INDEX knowthat_linkage_checks_claim_idx ON knowthat.knowthat_linkage_checks USING btree (status, next_retry_at, locked_until, updated_at) WHERE ((status = ANY (ARRAY['pending'::text, 'retry_wait'::text])) OR ((status = 'running'::text) AND (locked_until IS NOT NULL)))",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "knowthat_linkage_checks_claim_token_uq",
    "table_name": "knowthat_linkage_checks",
    "definition": "CREATE UNIQUE INDEX knowthat_linkage_checks_claim_token_uq ON knowthat.knowthat_linkage_checks USING btree (claim_token) WHERE (claim_token IS NOT NULL)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "knowthat_linkage_checks_pkey",
    "table_name": "knowthat_linkage_checks",
    "definition": "CREATE UNIQUE INDEX knowthat_linkage_checks_pkey ON knowthat.knowthat_linkage_checks USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "knowthat_linkage_recovery_receipts_bot_id_idempotency_key_key",
    "table_name": "knowthat_linkage_recovery_receipts",
    "definition": "CREATE UNIQUE INDEX knowthat_linkage_recovery_receipts_bot_id_idempotency_key_key ON knowthat.knowthat_linkage_recovery_receipts USING btree (bot_id, idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "knowthat_linkage_recovery_receipts_job_idx",
    "table_name": "knowthat_linkage_recovery_receipts",
    "definition": "CREATE INDEX knowthat_linkage_recovery_receipts_job_idx ON knowthat.knowthat_linkage_recovery_receipts USING btree (linkage_check_id, created_at)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "knowthat_linkage_recovery_receipts_pkey",
    "table_name": "knowthat_linkage_recovery_receipts",
    "definition": "CREATE UNIQUE INDEX knowthat_linkage_recovery_receipts_pkey ON knowthat.knowthat_linkage_recovery_receipts USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "knowthat_memory_command_dispatch_idx",
    "table_name": "knowthat_memory_command_outbox",
    "definition": "CREATE INDEX knowthat_memory_command_dispatch_idx ON knowthat.knowthat_memory_command_outbox USING btree (status, next_retry_at, created_at) WHERE (status = ANY (ARRAY['pending'::text, 'retry_wait'::text]))",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "knowthat_memory_command_outbo_command_type_reservation_id_f_key",
    "table_name": "knowthat_memory_command_outbox",
    "definition": "CREATE UNIQUE INDEX knowthat_memory_command_outbo_command_type_reservation_id_f_key ON knowthat.knowthat_memory_command_outbox USING btree (command_type, reservation_id, fencing_generation)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "knowthat_memory_command_outbox_idempotency_key_key",
    "table_name": "knowthat_memory_command_outbox",
    "definition": "CREATE UNIQUE INDEX knowthat_memory_command_outbox_idempotency_key_key ON knowthat.knowthat_memory_command_outbox USING btree (idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "knowthat_memory_command_outbox_pkey",
    "table_name": "knowthat_memory_command_outbox",
    "definition": "CREATE UNIQUE INDEX knowthat_memory_command_outbox_pkey ON knowthat.knowthat_memory_command_outbox USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "knowthat_memory_command_scope_idx",
    "table_name": "knowthat_memory_command_outbox",
    "definition": "CREATE INDEX knowthat_memory_command_scope_idx ON knowthat.knowthat_memory_command_outbox USING btree (bot_id, candidate_fact_id, reservation_id, fencing_generation)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "knowthat_query_revisions_pkey",
    "table_name": "knowthat_query_revisions",
    "definition": "CREATE UNIQUE INDEX knowthat_query_revisions_pkey ON knowthat.knowthat_query_revisions USING btree (bot_id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "knowthat_write_batches_bot_id_idempotency_key_key",
    "table_name": "knowthat_write_batches",
    "definition": "CREATE UNIQUE INDEX knowthat_write_batches_bot_id_idempotency_key_key ON knowthat.knowthat_write_batches USING btree (bot_id, idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "knowthat_write_batches_idempotency_idx",
    "table_name": "knowthat_write_batches",
    "definition": "CREATE INDEX knowthat_write_batches_idempotency_idx ON knowthat.knowthat_write_batches USING btree (bot_id, idempotency_key)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "knowthat_write_batches_pkey",
    "table_name": "knowthat_write_batches",
    "definition": "CREATE UNIQUE INDEX knowthat_write_batches_pkey ON knowthat.knowthat_write_batches USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "semantic_key_aliases_bot_id_old_canonicalization_version_ol_key",
    "table_name": "semantic_key_aliases",
    "definition": "CREATE UNIQUE INDEX semantic_key_aliases_bot_id_old_canonicalization_version_ol_key ON knowthat.semantic_key_aliases USING btree (bot_id, old_canonicalization_version, old_semantic_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "semantic_key_aliases_pkey",
    "table_name": "semantic_key_aliases",
    "definition": "CREATE UNIQUE INDEX semantic_key_aliases_pkey ON knowthat.semantic_key_aliases USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "semantic_key_synonyms_pkey",
    "table_name": "semantic_key_synonyms",
    "definition": "CREATE UNIQUE INDEX semantic_key_synonyms_pkey ON knowthat.semantic_key_synonyms USING btree (segment, synonym)",
    "unique": true,
    "primary": true,
    "valid": true
  }
] as const;

export const KNOWTHAT_FOREIGN_KEYS_V1 = [
  {
    "constraint_name": "knowthat_candidate_reviews_fact_id_fkey",
    "table_name": "knowthat_candidate_reviews",
    "columns": [
      "fact_id"
    ],
    "referenced_schema": "knowthat",
    "referenced_table": "knowthat_facts",
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
    "constraint_name": "knowthat_conflicts_left_fact_id_fkey",
    "table_name": "knowthat_conflicts",
    "columns": [
      "left_fact_id"
    ],
    "referenced_schema": "knowthat",
    "referenced_table": "knowthat_facts",
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
    "constraint_name": "knowthat_conflicts_right_fact_id_fkey",
    "table_name": "knowthat_conflicts",
    "columns": [
      "right_fact_id"
    ],
    "referenced_schema": "knowthat",
    "referenced_table": "knowthat_facts",
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
    "constraint_name": "knowthat_event_dlq_resolutions_dlq_id_fkey",
    "table_name": "knowthat_event_dlq_resolutions",
    "columns": [
      "dlq_id"
    ],
    "referenced_schema": "knowthat",
    "referenced_table": "knowthat_event_dlq",
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
    "constraint_name": "knowthat_fact_query_versions_fact_id_fkey",
    "table_name": "knowthat_fact_query_versions",
    "columns": [
      "fact_id"
    ],
    "referenced_schema": "knowthat",
    "referenced_table": "knowthat_facts",
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
    "constraint_name": "knowthat_fact_revisions_fact_id_fkey",
    "table_name": "knowthat_fact_revisions",
    "columns": [
      "fact_id"
    ],
    "referenced_schema": "knowthat",
    "referenced_table": "knowthat_facts",
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
    "constraint_name": "knowthat_feedback_events_fact_id_fkey",
    "table_name": "knowthat_feedback_events",
    "columns": [
      "fact_id"
    ],
    "referenced_schema": "knowthat",
    "referenced_table": "knowthat_facts",
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
    "constraint_name": "knowthat_feedback_events_generated_candidate_id_fkey",
    "table_name": "knowthat_feedback_events",
    "columns": [
      "generated_candidate_id"
    ],
    "referenced_schema": "knowthat",
    "referenced_table": "knowthat_facts",
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
    "constraint_name": "knowthat_linkage_checks_fact_id_fkey",
    "table_name": "knowthat_linkage_checks",
    "columns": [
      "fact_id"
    ],
    "referenced_schema": "knowthat",
    "referenced_table": "knowthat_facts",
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
    "constraint_name": "knowthat_linkage_recovery_receipts_linkage_check_id_fkey",
    "table_name": "knowthat_linkage_recovery_receipts",
    "columns": [
      "linkage_check_id"
    ],
    "referenced_schema": "knowthat",
    "referenced_table": "knowthat_linkage_checks",
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
    "constraint_name": "knowthat_memory_command_fact_scope_fk",
    "table_name": "knowthat_memory_command_outbox",
    "columns": [
      "candidate_fact_id",
      "bot_id"
    ],
    "referenced_schema": "knowthat",
    "referenced_table": "knowthat_facts",
    "referenced_columns": [
      "id",
      "bot_id"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "knowthat_memory_command_outbox_candidate_fact_id_fkey",
    "table_name": "knowthat_memory_command_outbox",
    "columns": [
      "candidate_fact_id"
    ],
    "referenced_schema": "knowthat",
    "referenced_table": "knowthat_facts",
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
    "constraint_name": "knowthat_memory_command_outbox_promotion_revision_id_fkey",
    "table_name": "knowthat_memory_command_outbox",
    "columns": [
      "promotion_revision_id"
    ],
    "referenced_schema": "knowthat",
    "referenced_table": "knowthat_fact_revisions",
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
    "constraint_name": "semantic_key_aliases_target_fact_id_fkey",
    "table_name": "semantic_key_aliases",
    "columns": [
      "target_fact_id"
    ],
    "referenced_schema": "knowthat",
    "referenced_table": "knowthat_facts",
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
