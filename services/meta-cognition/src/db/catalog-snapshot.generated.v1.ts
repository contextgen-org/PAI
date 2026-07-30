// Generated from a fresh revision-pinned pai-infra PostgreSQL catalog. Do not edit.
export const META_COGNITION_DATABASE_COLUMNS_V1 = [
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
    "table_name": "experience_records",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "experience_records",
    "column_name": "trigger_process_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "experience_records",
    "column_name": "workspace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "experience_records",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "experience_records",
    "column_name": "owner_agent_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "experience_records",
    "column_name": "deployment_environment",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "experience_records",
    "column_name": "release_channel",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "experience_records",
    "column_name": "summary",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "experience_records",
    "column_name": "execution_summary",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "experience_records",
    "column_name": "reflection_summary",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "experience_records",
    "column_name": "evidence_refs",
    "not_null": true,
    "default_expression": "'[]'::jsonb",
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "experience_records",
    "column_name": "quality_score",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "double precision"
  },
  {
    "table_name": "experience_records",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "feedback_requests",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "feedback_requests",
    "column_name": "workspace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "feedback_requests",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "feedback_requests",
    "column_name": "owner_agent_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "feedback_requests",
    "column_name": "deployment_environment",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "feedback_requests",
    "column_name": "release_channel",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "feedback_requests",
    "column_name": "source_kind",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "feedback_requests",
    "column_name": "trigger_process_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "feedback_requests",
    "column_name": "meta_job_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "feedback_requests",
    "column_name": "source_service",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "feedback_requests",
    "column_name": "source_ref",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "feedback_requests",
    "column_name": "command_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "feedback_requests",
    "column_name": "request_hash",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "feedback_requests",
    "column_name": "conflict_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "feedback_requests",
    "column_name": "candidate_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "feedback_requests",
    "column_name": "dedupe_scope_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "feedback_requests",
    "column_name": "question_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "feedback_requests",
    "column_name": "question_payload_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "feedback_requests",
    "column_name": "question_payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "feedback_requests",
    "column_name": "question_payload_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "feedback_requests",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "feedback_requests",
    "column_name": "answered_by_trigger_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "feedback_requests",
    "column_name": "answer_payload",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "feedback_requests",
    "column_name": "target_actor_ref",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "feedback_requests",
    "column_name": "target_binding_ref",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "feedback_requests",
    "column_name": "delivery_mode",
    "not_null": true,
    "default_expression": "'internal_queue'::text",
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "feedback_requests",
    "column_name": "delivery_channel",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "feedback_requests",
    "column_name": "delivery_status",
    "not_null": true,
    "default_expression": "'not_applicable'::text",
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "feedback_requests",
    "column_name": "delivery_version",
    "not_null": true,
    "default_expression": "1",
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "feedback_requests",
    "column_name": "delivery_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "feedback_requests",
    "column_name": "delivery_attempt_count",
    "not_null": true,
    "default_expression": "0",
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "feedback_requests",
    "column_name": "delivery_last_error",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "feedback_requests",
    "column_name": "delivered_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "feedback_requests",
    "column_name": "expires_at",
    "not_null": true,
    "default_expression": "(now() + '7 days'::interval)",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "feedback_requests",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "feedback_requests",
    "column_name": "payload_schema_version",
    "not_null": true,
    "default_expression": "'feedback_request.v1'::text",
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "feedback_requests",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "feedback_requests",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "meta_command_outbox",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_command_outbox",
    "column_name": "meta_job_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_command_outbox",
    "column_name": "command_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_command_outbox",
    "column_name": "target_service",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_command_outbox",
    "column_name": "dispatch_mode",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_command_outbox",
    "column_name": "owner_request",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "meta_command_outbox",
    "column_name": "owner_request_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_command_outbox",
    "column_name": "failed_client_item_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_command_outbox",
    "column_name": "item_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_command_outbox",
    "column_name": "source_owner_request_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_command_outbox",
    "column_name": "source_idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_command_outbox",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_command_outbox",
    "column_name": "lease_generation",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "meta_command_outbox",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_command_outbox",
    "column_name": "attempt_count",
    "not_null": true,
    "default_expression": "0",
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "meta_command_outbox",
    "column_name": "next_retry_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "meta_command_outbox",
    "column_name": "owner_response_schema_version",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_command_outbox",
    "column_name": "owner_response",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "meta_command_outbox",
    "column_name": "owner_response_hash",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_command_outbox",
    "column_name": "owner_item_set_hash",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_command_outbox",
    "column_name": "last_error",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "meta_command_outbox",
    "column_name": "trace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_command_outbox",
    "column_name": "settled_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "meta_command_outbox",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "meta_command_outbox",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "meta_command_outbox",
    "column_name": "claimed_by",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_command_outbox",
    "column_name": "claim_token",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_command_outbox",
    "column_name": "acknowledged_claim_token",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_command_outbox",
    "column_name": "locked_until",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "meta_command_outbox",
    "column_name": "transport_ref",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_command_outbox",
    "column_name": "transport_epoch",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_command_outbox",
    "column_name": "transport_generation",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "meta_command_outbox",
    "column_name": "sent_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "meta_event_dlq",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_event_dlq",
    "column_name": "source_event_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_event_dlq",
    "column_name": "event_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_event_dlq",
    "column_name": "payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "meta_event_dlq",
    "column_name": "last_error",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "meta_event_dlq",
    "column_name": "failed_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "meta_event_dlq_resolutions",
    "column_name": "resolution_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_event_dlq_resolutions",
    "column_name": "dlq_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_event_dlq_resolutions",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_event_dlq_resolutions",
    "column_name": "resolution_kind",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_event_dlq_resolutions",
    "column_name": "resolution_payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "meta_event_dlq_resolutions",
    "column_name": "resolved_by",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_event_dlq_resolutions",
    "column_name": "resolved_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "meta_event_inbox",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_event_inbox",
    "column_name": "source",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_event_inbox",
    "column_name": "event_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_event_inbox",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_event_inbox",
    "column_name": "payload_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_event_inbox",
    "column_name": "semantic_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_event_inbox",
    "column_name": "scope_fingerprint",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_event_inbox",
    "column_name": "processed_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "meta_event_inbox",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "meta_event_outbox",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_event_outbox",
    "column_name": "meta_job_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_event_outbox",
    "column_name": "trigger_process_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_event_outbox",
    "column_name": "workspace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_event_outbox",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_event_outbox",
    "column_name": "owner_agent_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_event_outbox",
    "column_name": "deployment_environment",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_event_outbox",
    "column_name": "release_channel",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_event_outbox",
    "column_name": "event_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_event_outbox",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_event_outbox",
    "column_name": "target",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_event_outbox",
    "column_name": "payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "meta_event_outbox",
    "column_name": "payload_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_event_outbox",
    "column_name": "lease_generation",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "meta_event_outbox",
    "column_name": "request_hash",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_event_outbox",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_event_outbox",
    "column_name": "attempt_count",
    "not_null": true,
    "default_expression": "0",
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "meta_event_outbox",
    "column_name": "next_retry_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "meta_event_outbox",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "meta_event_outbox",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "meta_event_outbox",
    "column_name": "claimed_by",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_event_outbox",
    "column_name": "claim_token",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_event_outbox",
    "column_name": "acknowledged_claim_token",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_event_outbox",
    "column_name": "locked_until",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "meta_event_outbox",
    "column_name": "last_error",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "meta_event_outbox",
    "column_name": "transport_ref",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_event_outbox",
    "column_name": "transport_epoch",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_event_outbox",
    "column_name": "transport_generation",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "meta_event_outbox",
    "column_name": "sent_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "meta_event_outbox",
    "column_name": "reconciliation_missing_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "meta_event_outbox",
    "column_name": "reconciliation_missing_reporter",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_event_outbox",
    "column_name": "reconciliation_next_probe_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "meta_event_outbox",
    "column_name": "reconciliation_claimed_by",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_event_outbox",
    "column_name": "reconciliation_claim_token",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_event_outbox",
    "column_name": "reconciliation_claim_generation",
    "not_null": false,
    "default_expression": "0",
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "meta_event_outbox",
    "column_name": "reconciliation_locked_until",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "meta_job_audit_logs",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_job_audit_logs",
    "column_name": "meta_job_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_job_audit_logs",
    "column_name": "previous_status",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_job_audit_logs",
    "column_name": "next_status",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_job_audit_logs",
    "column_name": "previous_recovery_state",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_job_audit_logs",
    "column_name": "next_recovery_state",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_job_audit_logs",
    "column_name": "owner_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_job_audit_logs",
    "column_name": "actor",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_job_audit_logs",
    "column_name": "trace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_job_audit_logs",
    "column_name": "scope",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "meta_job_audit_logs",
    "column_name": "expanded_fields",
    "not_null": true,
    "default_expression": "'{}'::text[]",
    "identity": "",
    "generated": "",
    "postgres_type": "text[]"
  },
  {
    "table_name": "meta_job_audit_logs",
    "column_name": "source_kind",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_job_audit_logs",
    "column_name": "source_service",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_job_audit_logs",
    "column_name": "source_ref",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_job_audit_logs",
    "column_name": "audit_action",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_job_audit_logs",
    "column_name": "reason_code",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_job_audit_logs",
    "column_name": "reason",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_job_audit_logs",
    "column_name": "error",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "meta_job_audit_logs",
    "column_name": "evidence_refs",
    "not_null": true,
    "default_expression": "'{}'::text[]",
    "identity": "",
    "generated": "",
    "postgres_type": "text[]"
  },
  {
    "table_name": "meta_job_audit_logs",
    "column_name": "schema_version",
    "not_null": true,
    "default_expression": "'meta_job_audit.v1'::text",
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_job_audit_logs",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "meta_job_leases",
    "column_name": "job_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_job_leases",
    "column_name": "lease_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_job_leases",
    "column_name": "lease_generation",
    "not_null": true,
    "default_expression": "1",
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "meta_job_leases",
    "column_name": "owner_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_job_leases",
    "column_name": "lease_expires_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "meta_job_leases",
    "column_name": "heartbeat_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "meta_job_leases",
    "column_name": "attempt",
    "not_null": true,
    "default_expression": "1",
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "meta_job_leases",
    "column_name": "recovery_state",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_job_leases",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "meta_job_leases",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "meta_jobs",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_jobs",
    "column_name": "trigger_process_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_jobs",
    "column_name": "workspace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_jobs",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_jobs",
    "column_name": "owner_agent_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_jobs",
    "column_name": "deployment_environment",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_jobs",
    "column_name": "release_channel",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_jobs",
    "column_name": "snapshot_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_jobs",
    "column_name": "snapshot_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "meta_jobs",
    "column_name": "snapshot_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_jobs",
    "column_name": "snapshot_retention_until",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "meta_jobs",
    "column_name": "cooldown_until",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "meta_jobs",
    "column_name": "boundary_system_event_ref",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_jobs",
    "column_name": "learnable_snapshot_ready",
    "not_null": true,
    "default_expression": "false",
    "identity": "",
    "generated": "",
    "postgres_type": "boolean"
  },
  {
    "table_name": "meta_jobs",
    "column_name": "enqueue_reason",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_jobs",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_jobs",
    "column_name": "trace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_jobs",
    "column_name": "request_schema_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_jobs",
    "column_name": "request_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_jobs",
    "column_name": "input_revision",
    "not_null": true,
    "default_expression": "1",
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "meta_jobs",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_jobs",
    "column_name": "lease_previous_status",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_jobs",
    "column_name": "attempt_count",
    "not_null": true,
    "default_expression": "0",
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "meta_jobs",
    "column_name": "next_retry_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "meta_jobs",
    "column_name": "error",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "meta_jobs",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "meta_jobs",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "meta_memory_split_chunks",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_memory_split_chunks",
    "column_name": "split_plan_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_memory_split_chunks",
    "column_name": "chunk_no",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "meta_memory_split_chunks",
    "column_name": "chunk_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_memory_split_chunks",
    "column_name": "memory_write_request_id",
    "not_null": false,
    "default_expression": "id",
    "identity": "",
    "generated": "stored",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_memory_split_chunks",
    "column_name": "request_payload_ref",
    "not_null": false,
    "default_expression": "('meta_memory_split_chunk:'::text || id)",
    "identity": "",
    "generated": "stored",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_memory_split_chunks",
    "column_name": "request_payload_hash",
    "not_null": false,
    "default_expression": "chunk_hash",
    "identity": "",
    "generated": "stored",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_memory_split_chunks",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_memory_split_chunks",
    "column_name": "client_item_ids",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text[]"
  },
  {
    "table_name": "meta_memory_split_chunks",
    "column_name": "request_payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "meta_memory_split_chunks",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_memory_split_chunks",
    "column_name": "memory_write_batch_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_memory_split_chunks",
    "column_name": "response_payload",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "meta_memory_split_chunks",
    "column_name": "failure_ids",
    "not_null": true,
    "default_expression": "'{}'::text[]",
    "identity": "",
    "generated": "",
    "postgres_type": "text[]"
  },
  {
    "table_name": "meta_memory_split_chunks",
    "column_name": "compensation_outbox_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_memory_split_chunks",
    "column_name": "attempt_count",
    "not_null": true,
    "default_expression": "0",
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "meta_memory_split_chunks",
    "column_name": "next_retry_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "meta_memory_split_chunks",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "meta_memory_split_chunks",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "meta_memory_split_plans",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_memory_split_plans",
    "column_name": "meta_job_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_memory_split_plans",
    "column_name": "plan_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "meta_memory_split_plans",
    "column_name": "source_items_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_memory_split_plans",
    "column_name": "split_profile_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_memory_split_plans",
    "column_name": "max_batch_bytes",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "meta_memory_split_plans",
    "column_name": "max_batch_items",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "meta_memory_split_plans",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_memory_split_plans",
    "column_name": "supersedes_plan_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_memory_split_plans",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "meta_memory_split_plans",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "meta_provider_output_checkpoints",
    "column_name": "meta_job_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_provider_output_checkpoints",
    "column_name": "lease_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_provider_output_checkpoints",
    "column_name": "lease_generation",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "meta_provider_output_checkpoints",
    "column_name": "request_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_provider_output_checkpoints",
    "column_name": "output_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_provider_output_checkpoints",
    "column_name": "output",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "meta_provider_output_checkpoints",
    "column_name": "evidence_artifacts",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "meta_provider_output_checkpoints",
    "column_name": "solidified_event_range",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "meta_provider_output_checkpoints",
    "column_name": "llm_run_metadata",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "meta_provider_output_checkpoints",
    "column_name": "solidified_event_refs",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "meta_provider_output_checkpoints",
    "column_name": "provider_binding",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "meta_provider_output_checkpoints",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "meta_results",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_results",
    "column_name": "meta_job_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_results",
    "column_name": "trigger_process_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_results",
    "column_name": "workspace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_results",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_results",
    "column_name": "owner_agent_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_results",
    "column_name": "deployment_environment",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_results",
    "column_name": "release_channel",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "meta_results",
    "column_name": "result_version",
    "not_null": true,
    "default_expression": "1",
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "meta_results",
    "column_name": "memory_write_refs",
    "not_null": true,
    "default_expression": "'{}'::text[]",
    "identity": "",
    "generated": "",
    "postgres_type": "text[]"
  },
  {
    "table_name": "meta_results",
    "column_name": "knowthat_write_refs",
    "not_null": true,
    "default_expression": "'{}'::text[]",
    "identity": "",
    "generated": "",
    "postgres_type": "text[]"
  },
  {
    "table_name": "meta_results",
    "column_name": "candidate_review_refs",
    "not_null": true,
    "default_expression": "'{}'::text[]",
    "identity": "",
    "generated": "",
    "postgres_type": "text[]"
  },
  {
    "table_name": "meta_results",
    "column_name": "skill_candidate_refs",
    "not_null": true,
    "default_expression": "'{}'::text[]",
    "identity": "",
    "generated": "",
    "postgres_type": "text[]"
  },
  {
    "table_name": "meta_results",
    "column_name": "personality_suggestion_refs",
    "not_null": true,
    "default_expression": "'{}'::text[]",
    "identity": "",
    "generated": "",
    "postgres_type": "text[]"
  },
  {
    "table_name": "meta_results",
    "column_name": "quality_signal_refs",
    "not_null": true,
    "default_expression": "'{}'::text[]",
    "identity": "",
    "generated": "",
    "postgres_type": "text[]"
  },
  {
    "table_name": "meta_results",
    "column_name": "payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "meta_results",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "meta_results",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "meta_results",
    "column_name": "finalized_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "personality_suggestions",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "personality_suggestions",
    "column_name": "workspace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "personality_suggestions",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "personality_suggestions",
    "column_name": "owner_agent_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "personality_suggestions",
    "column_name": "deployment_environment",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "personality_suggestions",
    "column_name": "release_channel",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "personality_suggestions",
    "column_name": "trigger_process_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "personality_suggestions",
    "column_name": "meta_job_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "personality_suggestions",
    "column_name": "suggestion_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "personality_suggestions",
    "column_name": "personality_ref",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "personality_suggestions",
    "column_name": "personality_version",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "personality_suggestions",
    "column_name": "personality_hash",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "personality_suggestions",
    "column_name": "proposed_patch",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "personality_suggestions",
    "column_name": "proposed_patch_hash",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "personality_suggestions",
    "column_name": "reason",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "personality_suggestions",
    "column_name": "evidence_refs",
    "not_null": true,
    "default_expression": "'{}'::text[]",
    "identity": "",
    "generated": "",
    "postgres_type": "text[]"
  },
  {
    "table_name": "personality_suggestions",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "personality_suggestions",
    "column_name": "downstream_status",
    "not_null": true,
    "default_expression": "'not_applicable'::text",
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "personality_suggestions",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "personality_suggestions",
    "column_name": "review_owner_service",
    "not_null": true,
    "default_expression": "'personality'::text",
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "personality_suggestions",
    "column_name": "reviewed_by",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "personality_suggestions",
    "column_name": "reviewed_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "personality_suggestions",
    "column_name": "review_reason",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "personality_suggestions",
    "column_name": "superseded_by_suggestion_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "personality_suggestions",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "personality_suggestions",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "quality_signals",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "quality_signals",
    "column_name": "trigger_process_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "quality_signals",
    "column_name": "workspace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "quality_signals",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "quality_signals",
    "column_name": "owner_agent_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "quality_signals",
    "column_name": "deployment_environment",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "quality_signals",
    "column_name": "release_channel",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "quality_signals",
    "column_name": "signal_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "quality_signals",
    "column_name": "severity",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "quality_signals",
    "column_name": "source_kind",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "quality_signals",
    "column_name": "source_service",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "quality_signals",
    "column_name": "actor_principal",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "quality_signals",
    "column_name": "actor_role",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "quality_signals",
    "column_name": "source_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "quality_signals",
    "column_name": "evidence_refs",
    "not_null": true,
    "default_expression": "'{}'::text[]",
    "identity": "",
    "generated": "",
    "postgres_type": "text[]"
  },
  {
    "table_name": "quality_signals",
    "column_name": "recommended_action",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "quality_signals",
    "column_name": "payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "quality_signals",
    "column_name": "schema_version",
    "not_null": true,
    "default_expression": "'quality_signal.v1'::text",
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "quality_signals",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_candidates",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_candidates",
    "column_name": "workspace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_candidates",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_candidates",
    "column_name": "owner_agent_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_candidates",
    "column_name": "deployment_environment",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_candidates",
    "column_name": "release_channel",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_candidates",
    "column_name": "trigger_process_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_candidates",
    "column_name": "meta_job_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_candidates",
    "column_name": "candidate_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_candidates",
    "column_name": "skill_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_candidates",
    "column_name": "title",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_candidates",
    "column_name": "proposal_payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "skill_candidates",
    "column_name": "proposal_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_candidates",
    "column_name": "baseline_catalog_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_candidates",
    "column_name": "reason",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_candidates",
    "column_name": "evidence_refs",
    "not_null": true,
    "default_expression": "'{}'::text[]",
    "identity": "",
    "generated": "",
    "postgres_type": "text[]"
  },
  {
    "table_name": "skill_candidates",
    "column_name": "evidence_artifacts",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "skill_candidates",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_candidates",
    "column_name": "downstream_status",
    "not_null": true,
    "default_expression": "'not_started'::text",
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_candidates",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_candidates",
    "column_name": "review_version",
    "not_null": true,
    "default_expression": "0",
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "skill_candidates",
    "column_name": "review_idempotency_key",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_candidates",
    "column_name": "review_request_hash",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_candidates",
    "column_name": "review_response_payload",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "skill_candidates",
    "column_name": "review_owner_service",
    "not_null": true,
    "default_expression": "'skill_registry'::text",
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_candidates",
    "column_name": "reviewed_by",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_candidates",
    "column_name": "reviewed_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_candidates",
    "column_name": "review_reason",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_candidates",
    "column_name": "registry_application_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_candidates",
    "column_name": "downstream_ref",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_candidates",
    "column_name": "delivery_attempt_count",
    "not_null": true,
    "default_expression": "0",
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "skill_candidates",
    "column_name": "delivery_last_error",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "skill_candidates",
    "column_name": "superseded_by_candidate_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_candidates",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_candidates",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_process_events",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_events",
    "column_name": "trigger_process_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_events",
    "column_name": "workspace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_events",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_events",
    "column_name": "owner_agent_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_events",
    "column_name": "deployment_environment",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_events",
    "column_name": "release_channel",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_events",
    "column_name": "sequence_no",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "trigger_process_events",
    "column_name": "event_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_events",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_events",
    "column_name": "payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "trigger_process_events",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  }
] as const;

export const META_COGNITION_DATABASE_CHECKS_V1 = [
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
    "constraint_name": "experience_records_deployment_environment_check",
    "table_name": "experience_records",
    "required_definition_fragments": [
      "CHECK (deployment_environment = ANY (ARRAY['local'::text, 'dev'::text, 'staging'::text, 'prod'::text]))"
    ]
  },
  {
    "constraint_name": "experience_records_quality_score_check",
    "table_name": "experience_records",
    "required_definition_fragments": [
      "CHECK (quality_score IS NULL OR quality_score >= 0::double precision AND quality_score <= 1::double precision)"
    ]
  },
  {
    "constraint_name": "experience_records_release_channel_check",
    "table_name": "experience_records",
    "required_definition_fragments": [
      "CHECK (release_channel = ANY (ARRAY['stable'::text, 'canary'::text]))"
    ]
  },
  {
    "constraint_name": "feedback_requests_check",
    "table_name": "feedback_requests",
    "required_definition_fragments": [
      "CHECK (status <> 'answered'::text OR answered_by_trigger_id IS NOT NULL AND answer_payload IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "feedback_requests_check1",
    "table_name": "feedback_requests",
    "required_definition_fragments": [
      "CHECK (delivery_mode <> 'proactive'::text OR target_actor_ref IS NOT NULL AND target_binding_ref IS NOT NULL AND delivery_channel IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "feedback_requests_check2",
    "table_name": "feedback_requests",
    "required_definition_fragments": [
      "CHECK (source_kind = 'meta_job'::text AND trigger_process_id IS NOT NULL AND meta_job_id IS NOT NULL AND source_service IS NULL AND source_ref IS NULL AND command_id IS NULL AND request_hash IS NULL OR source_kind = 'service_command'::text AND trigger_process_id IS NULL AND meta_job_id IS NULL AND (source_service = ANY (ARRAY['memory_service'::text, 'timer_trigger_app'::text])) AND source_ref IS NOT NULL AND command_id IS NOT NULL AND request_hash IS NOT NULL OR source_kind = 'operator'::text AND trigger_process_id IS NULL AND meta_job_id IS NULL AND source_service IS NULL AND source_ref IS NOT NULL AND command_id IS NULL AND request_hash IS NULL)"
    ]
  },
  {
    "constraint_name": "feedback_requests_delivery_attempt_count_check",
    "table_name": "feedback_requests",
    "required_definition_fragments": [
      "CHECK (delivery_attempt_count >= 0)"
    ]
  },
  {
    "constraint_name": "feedback_requests_delivery_mode_check",
    "table_name": "feedback_requests",
    "required_definition_fragments": [
      "CHECK (delivery_mode = ANY (ARRAY['proactive'::text, 'internal_queue'::text]))"
    ]
  },
  {
    "constraint_name": "feedback_requests_delivery_status_check",
    "table_name": "feedback_requests",
    "required_definition_fragments": [
      "CHECK (delivery_status = ANY (ARRAY['not_applicable'::text, 'pending'::text, 'dispatching'::text, 'delivered'::text, 'retry_wait'::text, 'failed'::text]))"
    ]
  },
  {
    "constraint_name": "feedback_requests_delivery_version_check",
    "table_name": "feedback_requests",
    "required_definition_fragments": [
      "CHECK (delivery_version > 0)"
    ]
  },
  {
    "constraint_name": "feedback_requests_deployment_environment_check",
    "table_name": "feedback_requests",
    "required_definition_fragments": [
      "CHECK (deployment_environment = ANY (ARRAY['local'::text, 'dev'::text, 'staging'::text, 'prod'::text]))"
    ]
  },
  {
    "constraint_name": "feedback_requests_release_channel_check",
    "table_name": "feedback_requests",
    "required_definition_fragments": [
      "CHECK (release_channel = ANY (ARRAY['stable'::text, 'canary'::text]))"
    ]
  },
  {
    "constraint_name": "feedback_requests_source_kind_check",
    "table_name": "feedback_requests",
    "required_definition_fragments": [
      "CHECK (source_kind = ANY (ARRAY['meta_job'::text, 'service_command'::text, 'operator'::text]))"
    ]
  },
  {
    "constraint_name": "feedback_requests_status_check",
    "table_name": "feedback_requests",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['open'::text, 'answered'::text, 'cancelled'::text, 'expired'::text, 'superseded'::text]))"
    ]
  },
  {
    "constraint_name": "meta_command_outbox_ack_fence_check",
    "table_name": "meta_command_outbox",
    "required_definition_fragments": [
      "CHECK ((status = 'succeeded'::text) = (acknowledged_claim_token IS NOT NULL))"
    ]
  },
  {
    "constraint_name": "meta_command_outbox_attempt_count_check",
    "table_name": "meta_command_outbox",
    "required_definition_fragments": [
      "CHECK (attempt_count >= 0)"
    ]
  },
  {
    "constraint_name": "meta_command_outbox_check",
    "table_name": "meta_command_outbox",
    "required_definition_fragments": [
      "CHECK (dispatch_mode <> 'original_request_replay'::text OR owner_request_hash = source_owner_request_hash AND idempotency_key = source_idempotency_key)"
    ]
  },
  {
    "constraint_name": "meta_command_outbox_check1",
    "table_name": "meta_command_outbox",
    "required_definition_fragments": [
      "CHECK (dispatch_mode <> 'single_item_retry'::text OR idempotency_key <> source_idempotency_key)"
    ]
  },
  {
    "constraint_name": "meta_command_outbox_check2",
    "table_name": "meta_command_outbox",
    "required_definition_fragments": [
      "CHECK (owner_response IS NULL AND owner_response_schema_version IS NULL AND owner_response_hash IS NULL AND owner_item_set_hash IS NULL OR jsonb_typeof(owner_response) = 'object'::text AND owner_response_schema_version IS NOT NULL AND owner_response_hash IS NOT NULL AND owner_item_set_hash IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "meta_command_outbox_check3",
    "table_name": "meta_command_outbox",
    "required_definition_fragments": [
      "CHECK (status <> 'retry_wait'::text OR next_retry_at IS NOT NULL AND last_error IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "meta_command_outbox_check4",
    "table_name": "meta_command_outbox",
    "required_definition_fragments": [
      "CHECK (status <> 'succeeded'::text OR owner_response IS NOT NULL AND settled_at IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "meta_command_outbox_check5",
    "table_name": "meta_command_outbox",
    "required_definition_fragments": [
      "CHECK (status <> 'failed'::text OR last_error IS NOT NULL AND settled_at IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "meta_command_outbox_check6",
    "table_name": "meta_command_outbox",
    "required_definition_fragments": [
      "CHECK ((status <> ALL (ARRAY['pending'::text, 'dispatching'::text, 'retry_wait'::text])) OR settled_at IS NULL)"
    ]
  },
  {
    "constraint_name": "meta_command_outbox_claim_fence_check",
    "table_name": "meta_command_outbox",
    "required_definition_fragments": [
      "CHECK ((status = 'dispatching'::text) = (claimed_by IS NOT NULL AND claim_token IS NOT NULL AND locked_until IS NOT NULL))"
    ]
  },
  {
    "constraint_name": "meta_command_outbox_command_type_check",
    "table_name": "meta_command_outbox",
    "required_definition_fragments": [
      "CHECK (command_type = ANY (ARRAY['memory_write'::text, 'knowthat_write'::text, 'skill_candidate_application'::text]))"
    ]
  },
  {
    "constraint_name": "meta_command_outbox_dispatch_mode_check",
    "table_name": "meta_command_outbox",
    "required_definition_fragments": [
      "CHECK (dispatch_mode = ANY (ARRAY['original_request_replay'::text, 'single_item_retry'::text]))"
    ]
  },
  {
    "constraint_name": "meta_command_outbox_lease_generation_check",
    "table_name": "meta_command_outbox",
    "required_definition_fragments": [
      "CHECK (lease_generation > 0)"
    ]
  },
  {
    "constraint_name": "meta_command_outbox_owner_request_check",
    "table_name": "meta_command_outbox",
    "required_definition_fragments": [
      "CHECK (jsonb_typeof(owner_request) = 'object'::text)"
    ]
  },
  {
    "constraint_name": "meta_command_outbox_status_check",
    "table_name": "meta_command_outbox",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['pending'::text, 'dispatching'::text, 'retry_wait'::text, 'succeeded'::text, 'failed'::text, 'fenced'::text]))"
    ]
  },
  {
    "constraint_name": "meta_command_outbox_target_service_check",
    "table_name": "meta_command_outbox",
    "required_definition_fragments": [
      "CHECK (target_service = ANY (ARRAY['memory'::text, 'knowthat'::text, 'skill_registry'::text]))"
    ]
  },
  {
    "constraint_name": "meta_command_outbox_transport_generation_safe_check",
    "table_name": "meta_command_outbox",
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
    "constraint_name": "meta_event_dlq_resolutions_resolution_payload_check",
    "table_name": "meta_event_dlq_resolutions",
    "required_definition_fragments": [
      "CHECK (jsonb_typeof(resolution_payload) = 'object'::text)"
    ]
  },
  {
    "constraint_name": "meta_event_inbox_event_id_check",
    "table_name": "meta_event_inbox",
    "required_definition_fragments": [
      "CHECK (length(event_id) > 0)"
    ]
  },
  {
    "constraint_name": "meta_event_inbox_payload_hash_check",
    "table_name": "meta_event_inbox",
    "required_definition_fragments": [
      "CHECK (length(payload_hash) > 0)"
    ]
  },
  {
    "constraint_name": "meta_event_inbox_scope_fingerprint_check",
    "table_name": "meta_event_inbox",
    "required_definition_fragments": [
      "CHECK (length(scope_fingerprint) > 0)"
    ]
  },
  {
    "constraint_name": "meta_event_inbox_semantic_hash_check",
    "table_name": "meta_event_inbox",
    "required_definition_fragments": [
      "CHECK (length(semantic_hash) > 0)"
    ]
  },
  {
    "constraint_name": "meta_event_outbox_ack_fence_check",
    "table_name": "meta_event_outbox",
    "required_definition_fragments": [
      "CHECK ((status = 'sent'::text) = (acknowledged_claim_token IS NOT NULL))"
    ]
  },
  {
    "constraint_name": "meta_event_outbox_check",
    "table_name": "meta_event_outbox",
    "required_definition_fragments": [
      "CHECK (jsonb_typeof(payload) = 'object'::text AND payload ?& ARRAY['event_id'::text, 'event_type'::text, 'schema_version'::text, 'producer'::text, 'occurred_at'::text, 'idempotency_key'::text, 'trace_id'::text, 'payload'::text] AND (payload - ARRAY['event_id'::text, 'event_type'::text, 'schema_version'::text, 'producer'::text, 'occurred_at'::text, 'idempotency_key'::text, 'trace_id'::text, 'payload'::text]) = '{}'::jsonb AND (payload ->> 'producer'::text) = 'meta_cognition'::text AND (payload ->> 'event_id'::text) = id AND (payload ->> 'event_type'::text) = event_type AND (payload ->> 'idempotency_key'::text) = idempotency_key)"
    ],
    "semantic_constraint": {
      "kind": "json_event_envelope",
      "column_name": "payload",
      "producer_value": "meta_cognition",
      "allow_additional_keys": false,
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
    "constraint_name": "meta_event_outbox_check1",
    "table_name": "meta_event_outbox",
    "required_definition_fragments": [
      "CHECK (event_type <> 'meta.job.created'::text OR (payload -> 'payload'::text) ?& ARRAY['snapshot_ref'::text, 'snapshot_version'::text, 'snapshot_hash'::text])"
    ]
  },
  {
    "constraint_name": "meta_event_outbox_check2",
    "table_name": "meta_event_outbox",
    "required_definition_fragments": [
      "CHECK (event_type <> 'meta.job.failed'::text OR (((payload -> 'payload'::text) ->> 'result_disposition'::text) = ANY (ARRAY['not_created'::text, 'finalized'::text])))"
    ]
  },
  {
    "constraint_name": "meta_event_outbox_claim_fence_check",
    "table_name": "meta_event_outbox",
    "required_definition_fragments": [
      "CHECK ((status = 'dispatching'::text) = (claimed_by IS NOT NULL AND claim_token IS NOT NULL AND locked_until IS NOT NULL))"
    ]
  },
  {
    "constraint_name": "meta_event_outbox_deployment_environment_check",
    "table_name": "meta_event_outbox",
    "required_definition_fragments": [
      "CHECK (deployment_environment = ANY (ARRAY['local'::text, 'dev'::text, 'staging'::text, 'prod'::text]))"
    ]
  },
  {
    "constraint_name": "meta_event_outbox_event_type_check",
    "table_name": "meta_event_outbox",
    "required_definition_fragments": [
      "CHECK (event_type = ANY (ARRAY['meta.job.created'::text, 'meta.job.started'::text, 'meta.job.retry_wait'::text, 'meta.experience.created'::text, 'meta.memory.write_requested'::text, 'meta.knowthat.write_requested'::text, 'meta.candidate.review_requested'::text, 'meta.candidate.reviewed'::text, 'meta.skill.candidate_application_requested'::text, 'meta.feedback.required'::text, 'meta.result.updated'::text, 'meta.result.finalized'::text, 'meta.job.completed'::text, 'meta.job.failed'::text]))"
    ],
    "semantic_constraint": {
      "kind": "text_enum",
      "column_name": "event_type",
      "allowed_values": [
        "meta.job.created",
        "meta.job.started",
        "meta.job.retry_wait",
        "meta.experience.created",
        "meta.memory.write_requested",
        "meta.knowthat.write_requested",
        "meta.candidate.review_requested",
        "meta.candidate.reviewed",
        "meta.skill.candidate_application_requested",
        "meta.feedback.required",
        "meta.result.updated",
        "meta.result.finalized",
        "meta.job.completed",
        "meta.job.failed"
      ]
    }
  },
  {
    "constraint_name": "meta_event_outbox_lease_generation_check",
    "table_name": "meta_event_outbox",
    "required_definition_fragments": [
      "CHECK (lease_generation IS NULL OR lease_generation > 0)"
    ]
  },
  {
    "constraint_name": "meta_event_outbox_reconciliation_generation_check",
    "table_name": "meta_event_outbox",
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
    "constraint_name": "meta_event_outbox_release_channel_check",
    "table_name": "meta_event_outbox",
    "required_definition_fragments": [
      "CHECK (release_channel = ANY (ARRAY['stable'::text, 'canary'::text]))"
    ]
  },
  {
    "constraint_name": "meta_event_outbox_sent_at_check",
    "table_name": "meta_event_outbox",
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
    "constraint_name": "meta_event_outbox_sent_transport_epoch_check",
    "table_name": "meta_event_outbox",
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
    "constraint_name": "meta_event_outbox_sent_transport_generation_check",
    "table_name": "meta_event_outbox",
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
    "constraint_name": "meta_event_outbox_sent_transport_ref_check",
    "table_name": "meta_event_outbox",
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
    "constraint_name": "meta_event_outbox_status_check",
    "table_name": "meta_event_outbox",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['pending'::text, 'dispatching'::text, 'sent'::text, 'retry_wait'::text, 'failed'::text]))"
    ]
  },
  {
    "constraint_name": "meta_event_outbox_transport_generation_safe_check",
    "table_name": "meta_event_outbox",
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
    "constraint_name": "meta_job_audit_logs_source_kind_check",
    "table_name": "meta_job_audit_logs",
    "required_definition_fragments": [
      "CHECK (source_kind = ANY (ARRAY['meta_job'::text, 'service_command'::text, 'operator'::text, 'system'::text]))"
    ]
  },
  {
    "constraint_name": "meta_job_leases_lease_generation_check",
    "table_name": "meta_job_leases",
    "required_definition_fragments": [
      "CHECK (lease_generation > 0)"
    ]
  },
  {
    "constraint_name": "meta_job_leases_recovery_state_check",
    "table_name": "meta_job_leases",
    "required_definition_fragments": [
      "CHECK (recovery_state = ANY (ARRAY['active'::text, 'heartbeat_lost'::text, 'expired'::text, 'takeover_pending'::text, 'recovered'::text, 'abandoned'::text]))"
    ]
  },
  {
    "constraint_name": "meta_jobs_check",
    "table_name": "meta_jobs",
    "required_definition_fragments": [
      "CHECK (idempotency_key = trigger_process_id)"
    ]
  },
  {
    "constraint_name": "meta_jobs_check1",
    "table_name": "meta_jobs",
    "required_definition_fragments": [
      "CHECK (enqueue_reason <> 'cooldown_expired'::text OR cooldown_until IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "meta_jobs_check2",
    "table_name": "meta_jobs",
    "required_definition_fragments": [
      "CHECK (enqueue_reason = 'cooldown_expired'::text OR (enqueue_reason = ANY (ARRAY['user_retracted'::text, 'system_interrupted'::text])) AND boundary_system_event_ref IS NOT NULL AND boundary_system_event_ref ~ '^(memory_point|trigger_process|trigger_event|user_feedback|developer_note|system_event|artifact|tool_result):.+$'::text AND learnable_snapshot_ready OR enqueue_reason = 'failed_with_learnable_snapshot'::text AND learnable_snapshot_ready)"
    ]
  },
  {
    "constraint_name": "meta_jobs_deployment_environment_check",
    "table_name": "meta_jobs",
    "required_definition_fragments": [
      "CHECK (deployment_environment = ANY (ARRAY['local'::text, 'dev'::text, 'staging'::text, 'prod'::text]))"
    ]
  },
  {
    "constraint_name": "meta_jobs_enqueue_reason_check",
    "table_name": "meta_jobs",
    "required_definition_fragments": [
      "CHECK (enqueue_reason = ANY (ARRAY['cooldown_expired'::text, 'user_retracted'::text, 'system_interrupted'::text, 'failed_with_learnable_snapshot'::text]))"
    ]
  },
  {
    "constraint_name": "meta_jobs_input_revision_check",
    "table_name": "meta_jobs",
    "required_definition_fragments": [
      "CHECK (input_revision > 0)"
    ]
  },
  {
    "constraint_name": "meta_jobs_lease_previous_status_check",
    "table_name": "meta_jobs",
    "required_definition_fragments": [
      "CHECK (lease_previous_status = ANY (ARRAY['queued'::text, 'running'::text, 'retry_wait'::text]))"
    ]
  },
  {
    "constraint_name": "meta_jobs_release_channel_check",
    "table_name": "meta_jobs",
    "required_definition_fragments": [
      "CHECK (release_channel = ANY (ARRAY['stable'::text, 'canary'::text]))"
    ]
  },
  {
    "constraint_name": "meta_jobs_snapshot_version_check",
    "table_name": "meta_jobs",
    "required_definition_fragments": [
      "CHECK (snapshot_version > 0)"
    ]
  },
  {
    "constraint_name": "meta_jobs_status_check",
    "table_name": "meta_jobs",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['queued'::text, 'leased'::text, 'running'::text, 'retry_wait'::text, 'completed'::text, 'failed'::text]))"
    ]
  },
  {
    "constraint_name": "meta_memory_split_chunks_attempt_count_check",
    "table_name": "meta_memory_split_chunks",
    "required_definition_fragments": [
      "CHECK (attempt_count >= 0)"
    ]
  },
  {
    "constraint_name": "meta_memory_split_chunks_check",
    "table_name": "meta_memory_split_chunks",
    "required_definition_fragments": [
      "CHECK ((status <> ALL (ARRAY['succeeded'::text, 'partial_failed'::text])) OR response_payload IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "meta_memory_split_chunks_chunk_no_check",
    "table_name": "meta_memory_split_chunks",
    "required_definition_fragments": [
      "CHECK (chunk_no > 0)"
    ]
  },
  {
    "constraint_name": "meta_memory_split_chunks_client_item_ids_check",
    "table_name": "meta_memory_split_chunks",
    "required_definition_fragments": [
      "CHECK (cardinality(client_item_ids) > 0)"
    ]
  },
  {
    "constraint_name": "meta_memory_split_chunks_status_check",
    "table_name": "meta_memory_split_chunks",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['pending'::text, 'dispatching'::text, 'retry_wait'::text, 'succeeded'::text, 'partial_failed'::text, 'failed'::text, 'unknown'::text, 'superseded'::text]))"
    ]
  },
  {
    "constraint_name": "meta_memory_split_plans_max_batch_bytes_check",
    "table_name": "meta_memory_split_plans",
    "required_definition_fragments": [
      "CHECK (max_batch_bytes > 0)"
    ]
  },
  {
    "constraint_name": "meta_memory_split_plans_max_batch_items_check",
    "table_name": "meta_memory_split_plans",
    "required_definition_fragments": [
      "CHECK (max_batch_items > 0)"
    ]
  },
  {
    "constraint_name": "meta_memory_split_plans_plan_version_check",
    "table_name": "meta_memory_split_plans",
    "required_definition_fragments": [
      "CHECK (plan_version > 0)"
    ]
  },
  {
    "constraint_name": "meta_memory_split_plans_status_check",
    "table_name": "meta_memory_split_plans",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['pending'::text, 'active'::text, 'succeeded'::text, 'partial_failed'::text, 'failed'::text, 'superseded'::text]))"
    ]
  },
  {
    "constraint_name": "meta_provider_output_checkpoints_evidence_artifacts_check",
    "table_name": "meta_provider_output_checkpoints",
    "required_definition_fragments": [
      "CHECK (meta_cognition.valid_evidence_artifacts_v1(evidence_artifacts, NULL::text[], 4096))"
    ]
  },
  {
    "constraint_name": "meta_provider_output_checkpoints_lease_generation_check",
    "table_name": "meta_provider_output_checkpoints",
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
    "constraint_name": "meta_provider_output_checkpoints_llm_run_metadata_check",
    "table_name": "meta_provider_output_checkpoints",
    "required_definition_fragments": [
      "CHECK (jsonb_typeof(llm_run_metadata) = 'object'::text)"
    ]
  },
  {
    "constraint_name": "meta_provider_output_checkpoints_output_check",
    "table_name": "meta_provider_output_checkpoints",
    "required_definition_fragments": [
      "CHECK (jsonb_typeof(output) = 'object'::text)"
    ]
  },
  {
    "constraint_name": "meta_provider_output_checkpoints_provider_binding_check",
    "table_name": "meta_provider_output_checkpoints",
    "required_definition_fragments": [
      "CHECK (jsonb_typeof(provider_binding) = 'object'::text AND provider_binding ?& ARRAY['model_provider'::text, 'model_name'::text, 'adapter_version'::text, 'input_hash'::text])"
    ]
  },
  {
    "constraint_name": "meta_provider_output_checkpoints_solidified_event_range_check",
    "table_name": "meta_provider_output_checkpoints",
    "required_definition_fragments": [
      "CHECK (jsonb_typeof(solidified_event_range) = 'object'::text AND solidified_event_range ?& ARRAY['first_append_sequence_no'::text, 'last_append_sequence_no'::text] AND jsonb_typeof(solidified_event_range -> 'first_append_sequence_no'::text) = 'number'::text AND jsonb_typeof(solidified_event_range -> 'last_append_sequence_no'::text) = 'number'::text AND ((solidified_event_range ->> 'first_append_sequence_no'::text)::bigint) >= 1 AND ((solidified_event_range ->> 'last_append_sequence_no'::text)::bigint) >= ((solidified_event_range ->> 'first_append_sequence_no'::text)::bigint))"
    ]
  },
  {
    "constraint_name": "meta_provider_output_checkpoints_solidified_event_refs_check",
    "table_name": "meta_provider_output_checkpoints",
    "required_definition_fragments": [
      "CHECK (jsonb_typeof(solidified_event_refs) = 'array'::text)"
    ]
  },
  {
    "constraint_name": "meta_results_check",
    "table_name": "meta_results",
    "required_definition_fragments": [
      "CHECK (finalized_at IS NULL OR ((payload ->> 'result_status'::text) = ANY (ARRAY['complete'::text, 'partial_failed'::text])))"
    ]
  },
  {
    "constraint_name": "meta_results_deployment_environment_check",
    "table_name": "meta_results",
    "required_definition_fragments": [
      "CHECK (deployment_environment = ANY (ARRAY['local'::text, 'dev'::text, 'staging'::text, 'prod'::text]))"
    ]
  },
  {
    "constraint_name": "meta_results_release_channel_check",
    "table_name": "meta_results",
    "required_definition_fragments": [
      "CHECK (release_channel = ANY (ARRAY['stable'::text, 'canary'::text]))"
    ]
  },
  {
    "constraint_name": "meta_results_result_version_check",
    "table_name": "meta_results",
    "required_definition_fragments": [
      "CHECK (result_version > 0)"
    ]
  },
  {
    "constraint_name": "personality_suggestions_check",
    "table_name": "personality_suggestions",
    "required_definition_fragments": [
      "CHECK (status <> 'accepted'::text OR reviewed_at IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "personality_suggestions_check1",
    "table_name": "personality_suggestions",
    "required_definition_fragments": [
      "CHECK (proposed_patch IS NULL OR personality_ref IS NOT NULL AND personality_version IS NOT NULL AND personality_version > 0 AND personality_hash IS NOT NULL AND proposed_patch_hash IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "personality_suggestions_deployment_environment_check",
    "table_name": "personality_suggestions",
    "required_definition_fragments": [
      "CHECK (deployment_environment = ANY (ARRAY['local'::text, 'dev'::text, 'staging'::text, 'prod'::text]))"
    ]
  },
  {
    "constraint_name": "personality_suggestions_downstream_status_check",
    "table_name": "personality_suggestions",
    "required_definition_fragments": [
      "CHECK (downstream_status = 'not_applicable'::text)"
    ]
  },
  {
    "constraint_name": "personality_suggestions_release_channel_check",
    "table_name": "personality_suggestions",
    "required_definition_fragments": [
      "CHECK (release_channel = ANY (ARRAY['stable'::text, 'canary'::text]))"
    ]
  },
  {
    "constraint_name": "personality_suggestions_status_check",
    "table_name": "personality_suggestions",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['proposed'::text, 'accepted'::text, 'rejected'::text, 'superseded'::text]))"
    ]
  },
  {
    "constraint_name": "quality_signals_check",
    "table_name": "quality_signals",
    "required_definition_fragments": [
      "CHECK (source_kind = 'service'::text AND source_service IS NOT NULL OR source_kind <> 'service'::text AND source_service IS NULL AND (actor_principal IS NOT NULL OR actor_role IS NOT NULL))"
    ]
  },
  {
    "constraint_name": "quality_signals_deployment_environment_check",
    "table_name": "quality_signals",
    "required_definition_fragments": [
      "CHECK (deployment_environment = ANY (ARRAY['local'::text, 'dev'::text, 'staging'::text, 'prod'::text]))"
    ]
  },
  {
    "constraint_name": "quality_signals_release_channel_check",
    "table_name": "quality_signals",
    "required_definition_fragments": [
      "CHECK (release_channel = ANY (ARRAY['stable'::text, 'canary'::text]))"
    ]
  },
  {
    "constraint_name": "quality_signals_severity_check",
    "table_name": "quality_signals",
    "required_definition_fragments": [
      "CHECK (severity = ANY (ARRAY['info'::text, 'warning'::text, 'error'::text, 'critical'::text]))"
    ]
  },
  {
    "constraint_name": "quality_signals_signal_type_check",
    "table_name": "quality_signals",
    "required_definition_fragments": [
      "CHECK (signal_type = ANY (ARRAY['snapshot_missing'::text, 'snapshot_incomplete'::text, 'snapshot_schema_incompatible'::text, 'snapshot_hash_mismatch'::text, 'artifact_unreadable'::text, 'redaction_incomplete'::text, 'llm_parse_failed'::text, 'schema_validation_failed'::text, 'memory_write_partial_failed'::text, 'knowthat_conflict_detected'::text, 'tool_execution_failed'::text, 'user_dissatisfied'::text, 'low_confidence_extraction'::text, 'feedback_required'::text, 'downstream_operation_failed'::text]))"
    ]
  },
  {
    "constraint_name": "quality_signals_source_kind_check",
    "table_name": "quality_signals",
    "required_definition_fragments": [
      "CHECK (source_kind = ANY (ARRAY['service'::text, 'manual'::text, 'operator'::text, 'offline_repair'::text]))"
    ]
  },
  {
    "constraint_name": "quality_signals_source_service_check",
    "table_name": "quality_signals",
    "required_definition_fragments": [
      "CHECK (source_service = ANY (ARRAY['trigger_processor'::text, 'action_runtime'::text, 'meta_cognition'::text, 'memory'::text, 'knowthat'::text, 'skill_registry'::text, 'timer_trigger_app'::text, 'observation_gateway'::text]))"
    ]
  },
  {
    "constraint_name": "skill_candidates_candidate_type_check",
    "table_name": "skill_candidates",
    "required_definition_fragments": [
      "CHECK (candidate_type = ANY (ARRAY['new_skill'::text, 'skill_update'::text, 'skill_deprecation'::text]))"
    ]
  },
  {
    "constraint_name": "skill_candidates_check",
    "table_name": "skill_candidates",
    "required_definition_fragments": [
      "CHECK (meta_cognition.valid_evidence_artifacts_v1(evidence_artifacts, evidence_refs, 256))"
    ]
  },
  {
    "constraint_name": "skill_candidates_check1",
    "table_name": "skill_candidates",
    "required_definition_fragments": [
      "CHECK (status <> 'accepted'::text OR reviewed_at IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "skill_candidates_check2",
    "table_name": "skill_candidates",
    "required_definition_fragments": [
      "CHECK (status = 'proposed'::text AND downstream_status = 'not_started'::text OR status = 'accepted'::text AND (downstream_status = ANY (ARRAY['pending'::text, 'dispatching'::text, 'received'::text, 'validating'::text, 'draft_created'::text, 'deprecation_review_created'::text, 'rejected'::text, 'failed'::text])) OR (status = ANY (ARRAY['rejected'::text, 'superseded'::text])) AND downstream_status = 'not_applicable'::text)"
    ]
  },
  {
    "constraint_name": "skill_candidates_delivery_attempt_count_check",
    "table_name": "skill_candidates",
    "required_definition_fragments": [
      "CHECK (delivery_attempt_count >= 0)"
    ]
  },
  {
    "constraint_name": "skill_candidates_deployment_environment_check",
    "table_name": "skill_candidates",
    "required_definition_fragments": [
      "CHECK (deployment_environment = ANY (ARRAY['local'::text, 'dev'::text, 'staging'::text, 'prod'::text]))"
    ]
  },
  {
    "constraint_name": "skill_candidates_downstream_status_check",
    "table_name": "skill_candidates",
    "required_definition_fragments": [
      "CHECK (downstream_status = ANY (ARRAY['not_started'::text, 'not_applicable'::text, 'pending'::text, 'dispatching'::text, 'received'::text, 'validating'::text, 'draft_created'::text, 'deprecation_review_created'::text, 'rejected'::text, 'failed'::text]))"
    ]
  },
  {
    "constraint_name": "skill_candidates_release_channel_check",
    "table_name": "skill_candidates",
    "required_definition_fragments": [
      "CHECK (release_channel = ANY (ARRAY['stable'::text, 'canary'::text]))"
    ]
  },
  {
    "constraint_name": "skill_candidates_review_version_check",
    "table_name": "skill_candidates",
    "required_definition_fragments": [
      "CHECK (review_version >= 0)"
    ]
  },
  {
    "constraint_name": "skill_candidates_status_check",
    "table_name": "skill_candidates",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['proposed'::text, 'accepted'::text, 'rejected'::text, 'superseded'::text]))"
    ]
  },
  {
    "constraint_name": "trigger_process_events_deployment_environment_check",
    "table_name": "trigger_process_events",
    "required_definition_fragments": [
      "CHECK (deployment_environment = ANY (ARRAY['local'::text, 'dev'::text, 'staging'::text, 'prod'::text]))"
    ]
  },
  {
    "constraint_name": "trigger_process_events_release_channel_check",
    "table_name": "trigger_process_events",
    "required_definition_fragments": [
      "CHECK (release_channel = ANY (ARRAY['stable'::text, 'canary'::text]))"
    ]
  }
] as const;

export const META_COGNITION_DATABASE_FUNCTIONS_V1 = [
  {
    "function_name": "valid_evidence_artifacts_v1",
    "security_definer": false,
    "settings": null,
    "strict": false,
    "volatility": "i",
    "parallel_safety": "s",
    "leakproof": false,
    "function_kind": "f",
    "default_argument_count": 0,
    "identity_arguments": "p_evidence_artifacts jsonb, p_expected_refs text[], p_max_items integer",
    "argument_names": [
      "p_evidence_artifacts",
      "p_expected_refs",
      "p_max_items"
    ],
    "argument_types": [
      "jsonb",
      "text[]",
      "integer"
    ],
    "returns_set": false,
    "result_type": "boolean",
    "language_name": "sql",
    "function_body_sha256": "sha256:ffe6ce37d9a326d2cd33cb9afb5afe266625aaa1dfaffa59eaf39ca7581bedf4"
  }
] as const;

export const META_COGNITION_DATABASE_TRIGGERS_V1 = [
  {
    "table_name": "meta_provider_output_checkpoints",
    "trigger_name": "meta_provider_output_checkpoints_immutable",
    "enabled_mode": "O",
    "trigger_type": 27,
    "trigger_argument_count": 0,
    "update_columns": "",
    "constraint_trigger": false,
    "has_when_clause": false,
    "has_old_transition_table": false,
    "has_new_transition_table": false,
    "function_schema": "meta_cognition",
    "function_name": "reject_provider_output_checkpoint_mutation",
    "security_definer": false,
    "settings": null,
    "language_name": "plpgsql",
    "function_body_sha256": "sha256:a96b6d0e43e2c24c71ec4b806134bc9a274be5e1e10dd3615b3af5e99ef62951"
  }
] as const;

export const META_COGNITION_DATABASE_UNIQUE_CONSTRAINTS_V1 = [
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
    "constraint_name": "experience_records_pkey",
    "table_name": "experience_records",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "experience_records_trigger_process_id_key",
    "table_name": "experience_records",
    "columns": [
      "trigger_process_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "feedback_requests_delivery_id_key",
    "table_name": "feedback_requests",
    "columns": [
      "delivery_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "feedback_requests_idempotency_key_key",
    "table_name": "feedback_requests",
    "columns": [
      "idempotency_key"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "feedback_requests_pkey",
    "table_name": "feedback_requests",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "meta_command_outbox_pkey",
    "table_name": "meta_command_outbox",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "meta_command_outbox_target_service_idempotency_key_key",
    "table_name": "meta_command_outbox",
    "columns": [
      "target_service",
      "idempotency_key"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "meta_event_dlq_pkey",
    "table_name": "meta_event_dlq",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "meta_event_dlq_resolutions_dlq_id_key",
    "table_name": "meta_event_dlq_resolutions",
    "columns": [
      "dlq_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "meta_event_dlq_resolutions_idempotency_key_key",
    "table_name": "meta_event_dlq_resolutions",
    "columns": [
      "idempotency_key"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "meta_event_dlq_resolutions_pkey",
    "table_name": "meta_event_dlq_resolutions",
    "columns": [
      "resolution_id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "meta_event_inbox_pkey",
    "table_name": "meta_event_inbox",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "meta_event_inbox_source_event_id_key",
    "table_name": "meta_event_inbox",
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
    "constraint_name": "meta_event_inbox_source_idempotency_key_key",
    "table_name": "meta_event_inbox",
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
    "constraint_name": "meta_event_outbox_pkey",
    "table_name": "meta_event_outbox",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "meta_event_outbox_target_idempotency_key_key",
    "table_name": "meta_event_outbox",
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
    "constraint_name": "meta_job_audit_logs_pkey",
    "table_name": "meta_job_audit_logs",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "meta_job_leases_lease_id_key",
    "table_name": "meta_job_leases",
    "columns": [
      "lease_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "meta_job_leases_pkey",
    "table_name": "meta_job_leases",
    "columns": [
      "job_id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "meta_jobs_idempotency_key_key",
    "table_name": "meta_jobs",
    "columns": [
      "idempotency_key"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "meta_jobs_pkey",
    "table_name": "meta_jobs",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "meta_jobs_trigger_process_id_key",
    "table_name": "meta_jobs",
    "columns": [
      "trigger_process_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "meta_memory_split_chunks_compensation_outbox_id_key",
    "table_name": "meta_memory_split_chunks",
    "columns": [
      "compensation_outbox_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "meta_memory_split_chunks_idempotency_key_key",
    "table_name": "meta_memory_split_chunks",
    "columns": [
      "idempotency_key"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "meta_memory_split_chunks_pkey",
    "table_name": "meta_memory_split_chunks",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "meta_memory_split_chunks_split_plan_id_chunk_no_key",
    "table_name": "meta_memory_split_chunks",
    "columns": [
      "split_plan_id",
      "chunk_no"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "meta_memory_split_plans_meta_job_id_plan_version_key",
    "table_name": "meta_memory_split_plans",
    "columns": [
      "meta_job_id",
      "plan_version"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "meta_memory_split_plans_meta_job_id_source_items_hash_split_key",
    "table_name": "meta_memory_split_plans",
    "columns": [
      "meta_job_id",
      "source_items_hash",
      "split_profile_version"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "meta_memory_split_plans_pkey",
    "table_name": "meta_memory_split_plans",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "meta_provider_output_checkpoin_meta_job_id_lease_generation_key",
    "table_name": "meta_provider_output_checkpoints",
    "columns": [
      "meta_job_id",
      "lease_generation"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "meta_provider_output_checkpoints_pkey",
    "table_name": "meta_provider_output_checkpoints",
    "columns": [
      "meta_job_id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "meta_results_meta_job_id_key",
    "table_name": "meta_results",
    "columns": [
      "meta_job_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "meta_results_pkey",
    "table_name": "meta_results",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "meta_results_trigger_process_id_key",
    "table_name": "meta_results",
    "columns": [
      "trigger_process_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "personality_suggestions_bot_id_idempotency_key_key",
    "table_name": "personality_suggestions",
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
    "constraint_name": "personality_suggestions_pkey",
    "table_name": "personality_suggestions",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "quality_signals_pkey",
    "table_name": "quality_signals",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_candidates_bot_id_idempotency_key_key",
    "table_name": "skill_candidates",
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
    "constraint_name": "skill_candidates_pkey",
    "table_name": "skill_candidates",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_candidates_review_idempotency_key_key",
    "table_name": "skill_candidates",
    "columns": [
      "review_idempotency_key"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "trigger_process_events_pkey",
    "table_name": "trigger_process_events",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "trigger_process_events_trigger_process_id_idempotency_key_key",
    "table_name": "trigger_process_events",
    "columns": [
      "trigger_process_id",
      "idempotency_key"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "trigger_process_events_trigger_process_id_sequence_no_key",
    "table_name": "trigger_process_events",
    "columns": [
      "trigger_process_id",
      "sequence_no"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  }
] as const;

export const META_COGNITION_DATABASE_INDEXES_V1 = [
  {
    "index_name": "eventing_transport_epochs_pkey",
    "table_name": "eventing_transport_epochs",
    "definition": "CREATE UNIQUE INDEX eventing_transport_epochs_pkey ON meta_cognition.eventing_transport_epochs USING btree (transport_name)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "experience_records_pkey",
    "table_name": "experience_records",
    "definition": "CREATE UNIQUE INDEX experience_records_pkey ON meta_cognition.experience_records USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "experience_records_trigger_process_id_key",
    "table_name": "experience_records",
    "definition": "CREATE UNIQUE INDEX experience_records_trigger_process_id_key ON meta_cognition.experience_records USING btree (trigger_process_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "meta_cognition_experience_bot_created_idx",
    "table_name": "experience_records",
    "definition": "CREATE INDEX meta_cognition_experience_bot_created_idx ON meta_cognition.experience_records USING btree (bot_id, created_at DESC)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "feedback_requests_delivery_id_key",
    "table_name": "feedback_requests",
    "definition": "CREATE UNIQUE INDEX feedback_requests_delivery_id_key ON meta_cognition.feedback_requests USING btree (delivery_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "feedback_requests_idempotency_key_key",
    "table_name": "feedback_requests",
    "definition": "CREATE UNIQUE INDEX feedback_requests_idempotency_key_key ON meta_cognition.feedback_requests USING btree (idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "feedback_requests_open_scope_question_uq",
    "table_name": "feedback_requests",
    "definition": "CREATE UNIQUE INDEX feedback_requests_open_scope_question_uq ON meta_cognition.feedback_requests USING btree (bot_id, dedupe_scope_ref, question_key) WHERE (status = 'open'::text)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "feedback_requests_pkey",
    "table_name": "feedback_requests",
    "definition": "CREATE UNIQUE INDEX feedback_requests_pkey ON meta_cognition.feedback_requests USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "feedback_requests_service_command_uq",
    "table_name": "feedback_requests",
    "definition": "CREATE UNIQUE INDEX feedback_requests_service_command_uq ON meta_cognition.feedback_requests USING btree (source_service, command_id) WHERE (source_kind = 'service_command'::text)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "meta_cognition_feedback_requests_open_unique",
    "table_name": "feedback_requests",
    "definition": "CREATE UNIQUE INDEX meta_cognition_feedback_requests_open_unique ON meta_cognition.feedback_requests USING btree (bot_id, dedupe_scope_ref, question_key) WHERE (status = 'open'::text)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "meta_cognition_feedback_requests_status_idx",
    "table_name": "feedback_requests",
    "definition": "CREATE INDEX meta_cognition_feedback_requests_status_idx ON meta_cognition.feedback_requests USING btree (bot_id, status, created_at DESC)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "meta_command_outbox_claim_idx",
    "table_name": "meta_command_outbox",
    "definition": "CREATE INDEX meta_command_outbox_claim_idx ON meta_cognition.meta_command_outbox USING btree (status, next_retry_at, created_at) WHERE (status = ANY (ARRAY['pending'::text, 'retry_wait'::text]))",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "meta_command_outbox_pkey",
    "table_name": "meta_command_outbox",
    "definition": "CREATE UNIQUE INDEX meta_command_outbox_pkey ON meta_cognition.meta_command_outbox USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "meta_command_outbox_target_service_idempotency_key_key",
    "table_name": "meta_command_outbox",
    "definition": "CREATE UNIQUE INDEX meta_command_outbox_target_service_idempotency_key_key ON meta_cognition.meta_command_outbox USING btree (target_service, idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "meta_event_dlq_pkey",
    "table_name": "meta_event_dlq",
    "definition": "CREATE UNIQUE INDEX meta_event_dlq_pkey ON meta_cognition.meta_event_dlq USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "meta_event_dlq_resolutions_dlq_id_key",
    "table_name": "meta_event_dlq_resolutions",
    "definition": "CREATE UNIQUE INDEX meta_event_dlq_resolutions_dlq_id_key ON meta_cognition.meta_event_dlq_resolutions USING btree (dlq_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "meta_event_dlq_resolutions_idempotency_key_key",
    "table_name": "meta_event_dlq_resolutions",
    "definition": "CREATE UNIQUE INDEX meta_event_dlq_resolutions_idempotency_key_key ON meta_cognition.meta_event_dlq_resolutions USING btree (idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "meta_event_dlq_resolutions_pkey",
    "table_name": "meta_event_dlq_resolutions",
    "definition": "CREATE UNIQUE INDEX meta_event_dlq_resolutions_pkey ON meta_cognition.meta_event_dlq_resolutions USING btree (resolution_id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "meta_event_inbox_pkey",
    "table_name": "meta_event_inbox",
    "definition": "CREATE UNIQUE INDEX meta_event_inbox_pkey ON meta_cognition.meta_event_inbox USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "meta_event_inbox_source_event_id_key",
    "table_name": "meta_event_inbox",
    "definition": "CREATE UNIQUE INDEX meta_event_inbox_source_event_id_key ON meta_cognition.meta_event_inbox USING btree (source, event_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "meta_event_inbox_source_idempotency_key_key",
    "table_name": "meta_event_inbox",
    "definition": "CREATE UNIQUE INDEX meta_event_inbox_source_idempotency_key_key ON meta_cognition.meta_event_inbox USING btree (source, idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "meta_cognition_outbox_dispatch_idx",
    "table_name": "meta_event_outbox",
    "definition": "CREATE INDEX meta_cognition_outbox_dispatch_idx ON meta_cognition.meta_event_outbox USING btree (status, next_retry_at, created_at) WHERE (status = ANY (ARRAY['pending'::text, 'retry_wait'::text]))",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "meta_event_outbox_pkey",
    "table_name": "meta_event_outbox",
    "definition": "CREATE UNIQUE INDEX meta_event_outbox_pkey ON meta_cognition.meta_event_outbox USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "meta_event_outbox_reconciliation_due_idx",
    "table_name": "meta_event_outbox",
    "definition": "CREATE INDEX meta_event_outbox_reconciliation_due_idx ON meta_cognition.meta_event_outbox USING btree (reconciliation_next_probe_at NULLS FIRST, sent_at, id) WHERE (status = 'sent'::text)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "meta_event_outbox_reconciliation_generation_idx",
    "table_name": "meta_event_outbox",
    "definition": "CREATE INDEX meta_event_outbox_reconciliation_generation_idx ON meta_cognition.meta_event_outbox USING btree (transport_epoch, transport_generation, sent_at, id) WHERE (status = 'sent'::text)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "meta_event_outbox_reconciliation_transport_ref_idx",
    "table_name": "meta_event_outbox",
    "definition": "CREATE INDEX meta_event_outbox_reconciliation_transport_ref_idx ON meta_cognition.meta_event_outbox USING btree (transport_ref, transport_epoch, transport_generation) WHERE ((status = 'sent'::text) AND (transport_ref IS NOT NULL))",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "meta_event_outbox_target_idempotency_key_key",
    "table_name": "meta_event_outbox",
    "definition": "CREATE UNIQUE INDEX meta_event_outbox_target_idempotency_key_key ON meta_cognition.meta_event_outbox USING btree (target, idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "meta_cognition_job_audit_job_idx",
    "table_name": "meta_job_audit_logs",
    "definition": "CREATE INDEX meta_cognition_job_audit_job_idx ON meta_cognition.meta_job_audit_logs USING btree (meta_job_id, created_at DESC)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "meta_job_audit_logs_pkey",
    "table_name": "meta_job_audit_logs",
    "definition": "CREATE UNIQUE INDEX meta_job_audit_logs_pkey ON meta_cognition.meta_job_audit_logs USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "meta_cognition_job_leases_expiry_idx",
    "table_name": "meta_job_leases",
    "definition": "CREATE INDEX meta_cognition_job_leases_expiry_idx ON meta_cognition.meta_job_leases USING btree (lease_expires_at, recovery_state)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "meta_job_leases_lease_id_key",
    "table_name": "meta_job_leases",
    "definition": "CREATE UNIQUE INDEX meta_job_leases_lease_id_key ON meta_cognition.meta_job_leases USING btree (lease_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "meta_job_leases_pkey",
    "table_name": "meta_job_leases",
    "definition": "CREATE UNIQUE INDEX meta_job_leases_pkey ON meta_cognition.meta_job_leases USING btree (job_id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "meta_cognition_jobs_claim_idx",
    "table_name": "meta_jobs",
    "definition": "CREATE INDEX meta_cognition_jobs_claim_idx ON meta_cognition.meta_jobs USING btree (status, next_retry_at, created_at) WHERE (status = ANY (ARRAY['queued'::text, 'retry_wait'::text]))",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "meta_jobs_idempotency_key_key",
    "table_name": "meta_jobs",
    "definition": "CREATE UNIQUE INDEX meta_jobs_idempotency_key_key ON meta_cognition.meta_jobs USING btree (idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "meta_jobs_pkey",
    "table_name": "meta_jobs",
    "definition": "CREATE UNIQUE INDEX meta_jobs_pkey ON meta_cognition.meta_jobs USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "meta_jobs_trigger_process_id_key",
    "table_name": "meta_jobs",
    "definition": "CREATE UNIQUE INDEX meta_jobs_trigger_process_id_key ON meta_cognition.meta_jobs USING btree (trigger_process_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "meta_memory_split_chunks_claim_idx",
    "table_name": "meta_memory_split_chunks",
    "definition": "CREATE INDEX meta_memory_split_chunks_claim_idx ON meta_cognition.meta_memory_split_chunks USING btree (status, next_retry_at, split_plan_id, chunk_no) WHERE (status = ANY (ARRAY['pending'::text, 'retry_wait'::text]))",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "meta_memory_split_chunks_compensation_outbox_id_key",
    "table_name": "meta_memory_split_chunks",
    "definition": "CREATE UNIQUE INDEX meta_memory_split_chunks_compensation_outbox_id_key ON meta_cognition.meta_memory_split_chunks USING btree (compensation_outbox_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "meta_memory_split_chunks_idempotency_key_key",
    "table_name": "meta_memory_split_chunks",
    "definition": "CREATE UNIQUE INDEX meta_memory_split_chunks_idempotency_key_key ON meta_cognition.meta_memory_split_chunks USING btree (idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "meta_memory_split_chunks_pkey",
    "table_name": "meta_memory_split_chunks",
    "definition": "CREATE UNIQUE INDEX meta_memory_split_chunks_pkey ON meta_cognition.meta_memory_split_chunks USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "meta_memory_split_chunks_split_plan_id_chunk_no_key",
    "table_name": "meta_memory_split_chunks",
    "definition": "CREATE UNIQUE INDEX meta_memory_split_chunks_split_plan_id_chunk_no_key ON meta_cognition.meta_memory_split_chunks USING btree (split_plan_id, chunk_no)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "meta_memory_split_plans_meta_job_id_plan_version_key",
    "table_name": "meta_memory_split_plans",
    "definition": "CREATE UNIQUE INDEX meta_memory_split_plans_meta_job_id_plan_version_key ON meta_cognition.meta_memory_split_plans USING btree (meta_job_id, plan_version)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "meta_memory_split_plans_meta_job_id_source_items_hash_split_key",
    "table_name": "meta_memory_split_plans",
    "definition": "CREATE UNIQUE INDEX meta_memory_split_plans_meta_job_id_source_items_hash_split_key ON meta_cognition.meta_memory_split_plans USING btree (meta_job_id, source_items_hash, split_profile_version)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "meta_memory_split_plans_pkey",
    "table_name": "meta_memory_split_plans",
    "definition": "CREATE UNIQUE INDEX meta_memory_split_plans_pkey ON meta_cognition.meta_memory_split_plans USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "meta_cognition_provider_checkpoint_fence_idx",
    "table_name": "meta_provider_output_checkpoints",
    "definition": "CREATE INDEX meta_cognition_provider_checkpoint_fence_idx ON meta_cognition.meta_provider_output_checkpoints USING btree (meta_job_id, lease_generation)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "meta_provider_output_checkpoin_meta_job_id_lease_generation_key",
    "table_name": "meta_provider_output_checkpoints",
    "definition": "CREATE UNIQUE INDEX meta_provider_output_checkpoin_meta_job_id_lease_generation_key ON meta_cognition.meta_provider_output_checkpoints USING btree (meta_job_id, lease_generation)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "meta_provider_output_checkpoints_pkey",
    "table_name": "meta_provider_output_checkpoints",
    "definition": "CREATE UNIQUE INDEX meta_provider_output_checkpoints_pkey ON meta_cognition.meta_provider_output_checkpoints USING btree (meta_job_id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "meta_results_meta_job_id_key",
    "table_name": "meta_results",
    "definition": "CREATE UNIQUE INDEX meta_results_meta_job_id_key ON meta_cognition.meta_results USING btree (meta_job_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "meta_results_pkey",
    "table_name": "meta_results",
    "definition": "CREATE UNIQUE INDEX meta_results_pkey ON meta_cognition.meta_results USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "meta_results_trigger_process_id_key",
    "table_name": "meta_results",
    "definition": "CREATE UNIQUE INDEX meta_results_trigger_process_id_key ON meta_cognition.meta_results USING btree (trigger_process_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "meta_cognition_personality_suggestions_job_idx",
    "table_name": "personality_suggestions",
    "definition": "CREATE INDEX meta_cognition_personality_suggestions_job_idx ON meta_cognition.personality_suggestions USING btree (meta_job_id, created_at DESC)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "meta_cognition_personality_suggestions_status_idx",
    "table_name": "personality_suggestions",
    "definition": "CREATE INDEX meta_cognition_personality_suggestions_status_idx ON meta_cognition.personality_suggestions USING btree (bot_id, status, created_at DESC)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "personality_suggestions_bot_id_idempotency_key_key",
    "table_name": "personality_suggestions",
    "definition": "CREATE UNIQUE INDEX personality_suggestions_bot_id_idempotency_key_key ON meta_cognition.personality_suggestions USING btree (bot_id, idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "personality_suggestions_pkey",
    "table_name": "personality_suggestions",
    "definition": "CREATE UNIQUE INDEX personality_suggestions_pkey ON meta_cognition.personality_suggestions USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "quality_signals_pkey",
    "table_name": "quality_signals",
    "definition": "CREATE UNIQUE INDEX quality_signals_pkey ON meta_cognition.quality_signals USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "meta_cognition_skill_candidates_job_idx",
    "table_name": "skill_candidates",
    "definition": "CREATE INDEX meta_cognition_skill_candidates_job_idx ON meta_cognition.skill_candidates USING btree (meta_job_id, created_at DESC)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "meta_cognition_skill_candidates_skill_key_idx",
    "table_name": "skill_candidates",
    "definition": "CREATE INDEX meta_cognition_skill_candidates_skill_key_idx ON meta_cognition.skill_candidates USING btree (bot_id, skill_key, created_at DESC)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "meta_cognition_skill_candidates_status_idx",
    "table_name": "skill_candidates",
    "definition": "CREATE INDEX meta_cognition_skill_candidates_status_idx ON meta_cognition.skill_candidates USING btree (bot_id, status, created_at DESC)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_candidates_bot_id_idempotency_key_key",
    "table_name": "skill_candidates",
    "definition": "CREATE UNIQUE INDEX skill_candidates_bot_id_idempotency_key_key ON meta_cognition.skill_candidates USING btree (bot_id, idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_candidates_pkey",
    "table_name": "skill_candidates",
    "definition": "CREATE UNIQUE INDEX skill_candidates_pkey ON meta_cognition.skill_candidates USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "skill_candidates_review_idempotency_key_key",
    "table_name": "skill_candidates",
    "definition": "CREATE UNIQUE INDEX skill_candidates_review_idempotency_key_key ON meta_cognition.skill_candidates USING btree (review_idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "meta_cognition_events_process_sequence_idx",
    "table_name": "trigger_process_events",
    "definition": "CREATE INDEX meta_cognition_events_process_sequence_idx ON meta_cognition.trigger_process_events USING btree (trigger_process_id, sequence_no)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_process_events_pkey",
    "table_name": "trigger_process_events",
    "definition": "CREATE UNIQUE INDEX trigger_process_events_pkey ON meta_cognition.trigger_process_events USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "trigger_process_events_trigger_process_id_idempotency_key_key",
    "table_name": "trigger_process_events",
    "definition": "CREATE UNIQUE INDEX trigger_process_events_trigger_process_id_idempotency_key_key ON meta_cognition.trigger_process_events USING btree (trigger_process_id, idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_process_events_trigger_process_id_sequence_no_key",
    "table_name": "trigger_process_events",
    "definition": "CREATE UNIQUE INDEX trigger_process_events_trigger_process_id_sequence_no_key ON meta_cognition.trigger_process_events USING btree (trigger_process_id, sequence_no)",
    "unique": true,
    "primary": false,
    "valid": true
  }
] as const;

export const META_COGNITION_FOREIGN_KEYS_V1 = [
  {
    "constraint_name": "feedback_requests_meta_job_id_fkey",
    "table_name": "feedback_requests",
    "columns": [
      "meta_job_id"
    ],
    "referenced_schema": "meta_cognition",
    "referenced_table": "meta_jobs",
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
    "constraint_name": "meta_command_outbox_meta_job_id_fkey",
    "table_name": "meta_command_outbox",
    "columns": [
      "meta_job_id"
    ],
    "referenced_schema": "meta_cognition",
    "referenced_table": "meta_jobs",
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
    "constraint_name": "meta_event_dlq_resolutions_dlq_id_fkey",
    "table_name": "meta_event_dlq_resolutions",
    "columns": [
      "dlq_id"
    ],
    "referenced_schema": "meta_cognition",
    "referenced_table": "meta_event_dlq",
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
    "constraint_name": "meta_job_audit_logs_meta_job_id_fkey",
    "table_name": "meta_job_audit_logs",
    "columns": [
      "meta_job_id"
    ],
    "referenced_schema": "meta_cognition",
    "referenced_table": "meta_jobs",
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
    "constraint_name": "meta_job_leases_job_id_fkey",
    "table_name": "meta_job_leases",
    "columns": [
      "job_id"
    ],
    "referenced_schema": "meta_cognition",
    "referenced_table": "meta_jobs",
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
    "constraint_name": "meta_memory_split_chunks_compensation_outbox_id_fkey",
    "table_name": "meta_memory_split_chunks",
    "columns": [
      "compensation_outbox_id"
    ],
    "referenced_schema": "meta_cognition",
    "referenced_table": "meta_command_outbox",
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
    "constraint_name": "meta_memory_split_chunks_split_plan_id_fkey",
    "table_name": "meta_memory_split_chunks",
    "columns": [
      "split_plan_id"
    ],
    "referenced_schema": "meta_cognition",
    "referenced_table": "meta_memory_split_plans",
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
    "constraint_name": "meta_memory_split_plans_meta_job_id_fkey",
    "table_name": "meta_memory_split_plans",
    "columns": [
      "meta_job_id"
    ],
    "referenced_schema": "meta_cognition",
    "referenced_table": "meta_jobs",
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
    "constraint_name": "meta_memory_split_plans_supersedes_plan_id_fkey",
    "table_name": "meta_memory_split_plans",
    "columns": [
      "supersedes_plan_id"
    ],
    "referenced_schema": "meta_cognition",
    "referenced_table": "meta_memory_split_plans",
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
    "constraint_name": "meta_provider_output_checkpoints_meta_job_id_fkey",
    "table_name": "meta_provider_output_checkpoints",
    "columns": [
      "meta_job_id"
    ],
    "referenced_schema": "meta_cognition",
    "referenced_table": "meta_jobs",
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
    "constraint_name": "meta_results_meta_job_id_fkey",
    "table_name": "meta_results",
    "columns": [
      "meta_job_id"
    ],
    "referenced_schema": "meta_cognition",
    "referenced_table": "meta_jobs",
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
    "constraint_name": "personality_suggestions_meta_job_id_fkey",
    "table_name": "personality_suggestions",
    "columns": [
      "meta_job_id"
    ],
    "referenced_schema": "meta_cognition",
    "referenced_table": "meta_jobs",
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
    "constraint_name": "personality_suggestions_superseded_by_suggestion_id_fkey",
    "table_name": "personality_suggestions",
    "columns": [
      "superseded_by_suggestion_id"
    ],
    "referenced_schema": "meta_cognition",
    "referenced_table": "personality_suggestions",
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
    "constraint_name": "skill_candidates_meta_job_id_fkey",
    "table_name": "skill_candidates",
    "columns": [
      "meta_job_id"
    ],
    "referenced_schema": "meta_cognition",
    "referenced_table": "meta_jobs",
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
    "constraint_name": "skill_candidates_superseded_by_candidate_id_fkey",
    "table_name": "skill_candidates",
    "columns": [
      "superseded_by_candidate_id"
    ],
    "referenced_schema": "meta_cognition",
    "referenced_table": "skill_candidates",
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
