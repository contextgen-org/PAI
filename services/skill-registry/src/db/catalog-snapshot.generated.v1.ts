// Generated from a fresh revision-pinned pai-infra PostgreSQL catalog. Do not edit.
export const SKILL_REGISTRY_DATABASE_COLUMNS_V1 = [
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
    "table_name": "skill_activation_current",
    "column_name": "skill_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_activation_current",
    "column_name": "workspace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_activation_current",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_activation_current",
    "column_name": "deployment_environment",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_activation_current",
    "column_name": "release_channel",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_activation_current",
    "column_name": "activation_revision_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_activation_current",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_activation_revisions",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_activation_revisions",
    "column_name": "skill_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_activation_revisions",
    "column_name": "workspace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_activation_revisions",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_activation_revisions",
    "column_name": "deployment_environment",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_activation_revisions",
    "column_name": "release_channel",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_activation_revisions",
    "column_name": "version_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_activation_revisions",
    "column_name": "state",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_activation_revisions",
    "column_name": "revision_no",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "skill_activation_revisions",
    "column_name": "previous_revision_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_activation_revisions",
    "column_name": "actor_principal_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_activation_revisions",
    "column_name": "reason",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_activation_revisions",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_audit_logs",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_audit_logs",
    "column_name": "skill_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_audit_logs",
    "column_name": "version_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_audit_logs",
    "column_name": "runtime_run_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_audit_logs",
    "column_name": "application_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_audit_logs",
    "column_name": "actor",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_audit_logs",
    "column_name": "action",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_audit_logs",
    "column_name": "decision",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_audit_logs",
    "column_name": "reason_code",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_audit_logs",
    "column_name": "evidence_refs",
    "not_null": true,
    "default_expression": "'{}'::text[]",
    "identity": "",
    "generated": "",
    "postgres_type": "text[]"
  },
  {
    "table_name": "skill_audit_logs",
    "column_name": "payload",
    "not_null": true,
    "default_expression": "'{}'::jsonb",
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "skill_audit_logs",
    "column_name": "trace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_audit_logs",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_candidate_applications",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_candidate_applications",
    "column_name": "candidate_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_candidate_applications",
    "column_name": "workspace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_candidate_applications",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_candidate_applications",
    "column_name": "owner_agent_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_candidate_applications",
    "column_name": "deployment_environment",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_candidate_applications",
    "column_name": "release_channel",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_candidate_applications",
    "column_name": "review_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "skill_candidate_applications",
    "column_name": "candidate_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_candidate_applications",
    "column_name": "skill_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_candidate_applications",
    "column_name": "baseline_catalog_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_candidate_applications",
    "column_name": "proposal_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_candidate_applications",
    "column_name": "proposal_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_candidate_applications",
    "column_name": "evidence_refs",
    "not_null": true,
    "default_expression": "'{}'::text[]",
    "identity": "",
    "generated": "",
    "postgres_type": "text[]"
  },
  {
    "table_name": "skill_candidate_applications",
    "column_name": "reviewed_by",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_candidate_applications",
    "column_name": "schema_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_candidate_applications",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_candidate_applications",
    "column_name": "request_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_candidate_applications",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_candidate_applications",
    "column_name": "staging_version_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_candidate_applications",
    "column_name": "review_ref",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_candidate_applications",
    "column_name": "response_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_candidate_applications",
    "column_name": "response_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_candidate_applications",
    "column_name": "trace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_candidate_applications",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_candidate_applications",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_catalog_current",
    "column_name": "workspace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_catalog_current",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_catalog_current",
    "column_name": "deployment_environment",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_catalog_current",
    "column_name": "release_channel",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_catalog_current",
    "column_name": "catalog_revision_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_catalog_current",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_catalog_revision_entries",
    "column_name": "catalog_revision_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_catalog_revision_entries",
    "column_name": "workspace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_catalog_revision_entries",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_catalog_revision_entries",
    "column_name": "deployment_environment",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_catalog_revision_entries",
    "column_name": "release_channel",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_catalog_revision_entries",
    "column_name": "skill_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_catalog_revision_entries",
    "column_name": "activation_revision_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_catalog_revision_entries",
    "column_name": "version_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_catalog_revision_entries",
    "column_name": "package_digest",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_catalog_revision_entries",
    "column_name": "manifest_digest",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_catalog_revision_entries",
    "column_name": "runtime_target",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_catalog_revisions",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_catalog_revisions",
    "column_name": "workspace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_catalog_revisions",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_catalog_revisions",
    "column_name": "deployment_environment",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_catalog_revisions",
    "column_name": "release_channel",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_catalog_revisions",
    "column_name": "catalog_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_catalog_revisions",
    "column_name": "catalog_as_of",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_catalog_revisions",
    "column_name": "security_revocation_epoch",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "skill_catalog_revisions",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_event_dlq",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_event_dlq",
    "column_name": "source_event_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_event_dlq",
    "column_name": "event_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_event_dlq",
    "column_name": "payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "skill_event_dlq",
    "column_name": "last_error",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "skill_event_dlq",
    "column_name": "failed_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_event_dlq_resolutions",
    "column_name": "resolution_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_event_dlq_resolutions",
    "column_name": "dlq_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_event_dlq_resolutions",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_event_dlq_resolutions",
    "column_name": "resolution_kind",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_event_dlq_resolutions",
    "column_name": "resolution_payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "skill_event_dlq_resolutions",
    "column_name": "resolved_by",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_event_dlq_resolutions",
    "column_name": "resolved_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_event_inbox",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_event_inbox",
    "column_name": "source",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_event_inbox",
    "column_name": "event_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_event_inbox",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_event_inbox",
    "column_name": "payload_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_event_inbox",
    "column_name": "semantic_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_event_inbox",
    "column_name": "scope_fingerprint",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_event_inbox",
    "column_name": "processed_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_event_inbox",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_event_outbox",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_event_outbox",
    "column_name": "event_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_event_outbox",
    "column_name": "schema_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_event_outbox",
    "column_name": "producer",
    "not_null": true,
    "default_expression": "'skill_registry'::text",
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_event_outbox",
    "column_name": "occurred_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_event_outbox",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_event_outbox",
    "column_name": "trace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_event_outbox",
    "column_name": "payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "skill_event_outbox",
    "column_name": "payload_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_event_outbox",
    "column_name": "target",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_event_outbox",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_event_outbox",
    "column_name": "attempt_count",
    "not_null": true,
    "default_expression": "0",
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "skill_event_outbox",
    "column_name": "next_retry_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_event_outbox",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_event_outbox",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_event_outbox",
    "column_name": "claimed_by",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_event_outbox",
    "column_name": "claim_token",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_event_outbox",
    "column_name": "acknowledged_claim_token",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_event_outbox",
    "column_name": "locked_until",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_event_outbox",
    "column_name": "last_error",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "skill_event_outbox",
    "column_name": "transport_ref",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_event_outbox",
    "column_name": "transport_epoch",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_event_outbox",
    "column_name": "transport_generation",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "skill_event_outbox",
    "column_name": "sent_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_event_outbox",
    "column_name": "reconciliation_missing_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_event_outbox",
    "column_name": "reconciliation_missing_reporter",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_event_outbox",
    "column_name": "reconciliation_next_probe_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_event_outbox",
    "column_name": "reconciliation_claimed_by",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_event_outbox",
    "column_name": "reconciliation_claim_token",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_event_outbox",
    "column_name": "reconciliation_claim_generation",
    "not_null": false,
    "default_expression": "0",
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "skill_event_outbox",
    "column_name": "reconciliation_locked_until",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_management_commands",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_management_commands",
    "column_name": "operation",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_management_commands",
    "column_name": "scope_kind",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_management_commands",
    "column_name": "workspace_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_management_commands",
    "column_name": "bot_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_management_commands",
    "column_name": "deployment_environment",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_management_commands",
    "column_name": "release_channel",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_management_commands",
    "column_name": "skill_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_management_commands",
    "column_name": "version_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_management_commands",
    "column_name": "target_version_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_management_commands",
    "column_name": "owner_agent_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_management_commands",
    "column_name": "capability_refs",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text[]"
  },
  {
    "table_name": "skill_management_commands",
    "column_name": "scope_hash",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_management_commands",
    "column_name": "expected_catalog_version",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_management_commands",
    "column_name": "expected_activation_revision",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_management_commands",
    "column_name": "expected_permission_revision",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_management_commands",
    "column_name": "expected_lifecycle_version",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "skill_management_commands",
    "column_name": "emergency",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "boolean"
  },
  {
    "table_name": "skill_management_commands",
    "column_name": "request_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_management_commands",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_management_commands",
    "column_name": "actor_principal_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_management_commands",
    "column_name": "actor_role",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_management_commands",
    "column_name": "reason",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_management_commands",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_management_commands",
    "column_name": "result_revision",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_management_commands",
    "column_name": "result_catalog_version",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_management_commands",
    "column_name": "previous_lifecycle_version",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "skill_management_commands",
    "column_name": "new_lifecycle_version",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "skill_management_commands",
    "column_name": "result_security_revocation_epoch",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "skill_management_commands",
    "column_name": "response_payload",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "skill_management_commands",
    "column_name": "error",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "skill_management_commands",
    "column_name": "trace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_management_commands",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_management_commands",
    "column_name": "completed_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_object_access_decisions",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_object_access_decisions",
    "column_name": "owner_object_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_object_access_decisions",
    "column_name": "owner_state_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "skill_object_access_decisions",
    "column_name": "object_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_object_access_decisions",
    "column_name": "operation",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_object_access_decisions",
    "column_name": "purpose",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_object_access_decisions",
    "column_name": "capability",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_object_access_decisions",
    "column_name": "scope_kind",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_object_access_decisions",
    "column_name": "prior_access_decision_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_object_access_decisions",
    "column_name": "retention_policy_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_object_access_decisions",
    "column_name": "redaction_policy_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_object_access_decisions",
    "column_name": "decision",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_object_access_decisions",
    "column_name": "expires_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_object_access_decisions",
    "column_name": "trace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_object_access_decisions",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_package_retention_holds",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_package_retention_holds",
    "column_name": "package_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_package_retention_holds",
    "column_name": "hold_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_package_retention_holds",
    "column_name": "reason_code",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_package_retention_holds",
    "column_name": "active",
    "not_null": true,
    "default_expression": "true",
    "identity": "",
    "generated": "",
    "postgres_type": "boolean"
  },
  {
    "table_name": "skill_package_retention_holds",
    "column_name": "expires_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_package_retention_holds",
    "column_name": "actor_principal_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_package_retention_holds",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_package_retention_holds",
    "column_name": "released_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_package_retention_transitions",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_package_retention_transitions",
    "column_name": "package_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_package_retention_transitions",
    "column_name": "from_state",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_package_retention_transitions",
    "column_name": "to_state",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_package_retention_transitions",
    "column_name": "from_state_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "skill_package_retention_transitions",
    "column_name": "to_state_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "skill_package_retention_transitions",
    "column_name": "reason_code",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_package_retention_transitions",
    "column_name": "actor_principal_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_package_retention_transitions",
    "column_name": "object_store_deletion_decision_version",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_package_retention_transitions",
    "column_name": "trace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_package_retention_transitions",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_packages",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_packages",
    "column_name": "version_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_packages",
    "column_name": "package_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_packages",
    "column_name": "media_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_packages",
    "column_name": "size_bytes",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "skill_packages",
    "column_name": "file_count",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "skill_packages",
    "column_name": "package_digest",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_packages",
    "column_name": "manifest_digest",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_packages",
    "column_name": "manifest",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "skill_packages",
    "column_name": "scan_result",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "skill_packages",
    "column_name": "retention_state",
    "not_null": true,
    "default_expression": "'retained'::text",
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_packages",
    "column_name": "retention_until",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_packages",
    "column_name": "deletion_requested_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_packages",
    "column_name": "deleted_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_packages",
    "column_name": "delete_error",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "skill_packages",
    "column_name": "state_version",
    "not_null": true,
    "default_expression": "1",
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "skill_packages",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_packages",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_packages",
    "column_name": "object_access_decision_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_packages",
    "column_name": "owner_object_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_packages",
    "column_name": "owner_state_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "skill_permission_current",
    "column_name": "skill_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_permission_current",
    "column_name": "workspace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_permission_current",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_permission_current",
    "column_name": "deployment_environment",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_permission_current",
    "column_name": "release_channel",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_permission_current",
    "column_name": "scope_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_permission_current",
    "column_name": "permission_revision_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_permission_current",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_permission_revisions",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_permission_revisions",
    "column_name": "skill_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_permission_revisions",
    "column_name": "workspace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_permission_revisions",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_permission_revisions",
    "column_name": "deployment_environment",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_permission_revisions",
    "column_name": "release_channel",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_permission_revisions",
    "column_name": "owner_agent_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_permission_revisions",
    "column_name": "decision",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_permission_revisions",
    "column_name": "capability_refs",
    "not_null": true,
    "default_expression": "'{}'::text[]",
    "identity": "",
    "generated": "",
    "postgres_type": "text[]"
  },
  {
    "table_name": "skill_permission_revisions",
    "column_name": "scope_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_permission_revisions",
    "column_name": "revision_no",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "skill_permission_revisions",
    "column_name": "previous_revision_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_permission_revisions",
    "column_name": "actor_principal_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_permission_revisions",
    "column_name": "reason",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_permission_revisions",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_permission_summary_entries",
    "column_name": "summary_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_permission_summary_entries",
    "column_name": "ordinal",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "skill_permission_summary_entries",
    "column_name": "skill_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_permission_summary_entries",
    "column_name": "skill_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_permission_summary_entries",
    "column_name": "activation_revision_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_permission_summary_entries",
    "column_name": "version_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_permission_summary_entries",
    "column_name": "decision",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_permission_summary_entries",
    "column_name": "decision_source",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_permission_summary_entries",
    "column_name": "permission_revision_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_permission_summary_entries",
    "column_name": "revision_no",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "skill_permission_summary_entries",
    "column_name": "scope_hash",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_permission_summary_entries",
    "column_name": "owner_agent_condition",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_permission_summary_entries",
    "column_name": "capability_refs",
    "not_null": true,
    "default_expression": "'{}'::text[]",
    "identity": "",
    "generated": "",
    "postgres_type": "text[]"
  },
  {
    "table_name": "skill_permission_summary_snapshots",
    "column_name": "summary_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_permission_summary_snapshots",
    "column_name": "schema_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_permission_summary_snapshots",
    "column_name": "workspace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_permission_summary_snapshots",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_permission_summary_snapshots",
    "column_name": "owner_agent_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_permission_summary_snapshots",
    "column_name": "deployment_environment",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_permission_summary_snapshots",
    "column_name": "release_channel",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_permission_summary_snapshots",
    "column_name": "catalog_revision_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_permission_summary_snapshots",
    "column_name": "catalog_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_permission_summary_snapshots",
    "column_name": "catalog_as_of",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_permission_summary_snapshots",
    "column_name": "security_revocation_epoch",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "skill_permission_summary_snapshots",
    "column_name": "canonical_bytes",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bytea"
  },
  {
    "table_name": "skill_permission_summary_snapshots",
    "column_name": "summary_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_permission_summary_snapshots",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_resolution_attempts",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_resolution_attempts",
    "column_name": "runtime_run_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_resolution_attempts",
    "column_name": "start_attempt_no",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "skill_resolution_attempts",
    "column_name": "workspace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_resolution_attempts",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_resolution_attempts",
    "column_name": "owner_agent_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_resolution_attempts",
    "column_name": "deployment_environment",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_resolution_attempts",
    "column_name": "release_channel",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_resolution_attempts",
    "column_name": "policy_input_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_resolution_attempts",
    "column_name": "policy_input_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_resolution_attempts",
    "column_name": "policy_input_created_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_resolution_attempts",
    "column_name": "policy_expires_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_resolution_attempts",
    "column_name": "requested_catalog_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_resolution_attempts",
    "column_name": "effective_catalog_version",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_resolution_attempts",
    "column_name": "catalog_as_of",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_resolution_attempts",
    "column_name": "security_revocation_epoch",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "skill_resolution_attempts",
    "column_name": "skill_permission_summary_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_resolution_attempts",
    "column_name": "skill_permission_summary_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_resolution_attempts",
    "column_name": "request_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_resolution_attempts",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_resolution_attempts",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_resolution_attempts",
    "column_name": "error_code",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_resolution_attempts",
    "column_name": "response_payload",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "skill_resolution_attempts",
    "column_name": "valid_until",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_resolution_attempts",
    "column_name": "trace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_resolution_attempts",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_resolution_attempts",
    "column_name": "completed_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_resolutions",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_resolutions",
    "column_name": "resolution_attempt_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_resolutions",
    "column_name": "runtime_run_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_resolutions",
    "column_name": "start_attempt_no",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "skill_resolutions",
    "column_name": "skill_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_resolutions",
    "column_name": "skill_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_resolutions",
    "column_name": "required",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "boolean"
  },
  {
    "table_name": "skill_resolutions",
    "column_name": "version_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_resolutions",
    "column_name": "package_digest",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_resolutions",
    "column_name": "manifest_digest",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_resolutions",
    "column_name": "runtime_target",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_resolutions",
    "column_name": "permission_decision",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_resolutions",
    "column_name": "granted_capability_refs",
    "not_null": true,
    "default_expression": "'{}'::text[]",
    "identity": "",
    "generated": "",
    "postgres_type": "text[]"
  },
  {
    "table_name": "skill_resolutions",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_resolutions",
    "column_name": "resolution_token_hash",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_resolutions",
    "column_name": "valid_until",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_resolutions",
    "column_name": "trace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_resolutions",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_security_state",
    "column_name": "singleton_key",
    "not_null": true,
    "default_expression": "true",
    "identity": "",
    "generated": "",
    "postgres_type": "boolean"
  },
  {
    "table_name": "skill_security_state",
    "column_name": "security_revocation_epoch",
    "not_null": true,
    "default_expression": "0",
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "skill_security_state",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_validation_attempts",
    "column_name": "attempt_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_validation_attempts",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_validation_attempts",
    "column_name": "request_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_validation_attempts",
    "column_name": "request_payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "skill_validation_attempts",
    "column_name": "outcome",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_validation_attempts",
    "column_name": "validation_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_validation_attempts",
    "column_name": "validation_record",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "skill_validation_attempts",
    "column_name": "success_payload",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "skill_validation_attempts",
    "column_name": "error_payload",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "skill_validation_attempts",
    "column_name": "response_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_validation_attempts",
    "column_name": "terminal_fingerprint",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_validation_attempts",
    "column_name": "expires_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_validation_attempts",
    "column_name": "actor_principal_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_validation_attempts",
    "column_name": "trace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_validation_attempts",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_version_staging",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_version_staging",
    "column_name": "skill_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_version_staging",
    "column_name": "skill_name",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_version_staging",
    "column_name": "proposed_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_version_staging",
    "column_name": "object_access_decision_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_version_staging",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_version_staging",
    "column_name": "request_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_version_staging",
    "column_name": "artifact_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_version_staging",
    "column_name": "package_digest",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_version_staging",
    "column_name": "manifest_digest",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_version_staging",
    "column_name": "provenance",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "skill_version_staging",
    "column_name": "validation_result",
    "not_null": true,
    "default_expression": "'{}'::jsonb",
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "skill_version_staging",
    "column_name": "scanner_versions",
    "not_null": true,
    "default_expression": "'{}'::jsonb",
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "skill_version_staging",
    "column_name": "validation_expires_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_version_staging",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_version_staging",
    "column_name": "created_by",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_version_staging",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_version_staging",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_version_staging",
    "column_name": "owner_object_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_version_staging",
    "column_name": "owner_state_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "skill_version_staging",
    "column_name": "manifest",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "skill_version_staging",
    "column_name": "runtime_target",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_version_staging",
    "column_name": "media_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_version_staging",
    "column_name": "size_bytes",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "skill_version_staging",
    "column_name": "staging_state_version",
    "not_null": true,
    "default_expression": "1",
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "skill_versions",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_versions",
    "column_name": "skill_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_versions",
    "column_name": "version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_versions",
    "column_name": "package_digest",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_versions",
    "column_name": "manifest_digest",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_versions",
    "column_name": "runtime_target",
    "not_null": true,
    "default_expression": "'filesystem_bundle.v1'::text",
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_versions",
    "column_name": "lifecycle_state",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_versions",
    "column_name": "lifecycle_version",
    "not_null": true,
    "default_expression": "1",
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "skill_versions",
    "column_name": "provenance",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "skill_versions",
    "column_name": "validation_result",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "skill_versions",
    "column_name": "scanner_versions",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "skill_versions",
    "column_name": "validation_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_versions",
    "column_name": "published_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_versions",
    "column_name": "deprecated_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_versions",
    "column_name": "revoked_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skill_versions",
    "column_name": "revocation_epoch",
    "not_null": true,
    "default_expression": "0",
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "skill_versions",
    "column_name": "created_by",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skill_versions",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skills",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skills",
    "column_name": "skill_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skills",
    "column_name": "name",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skills",
    "column_name": "title",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skills",
    "column_name": "description",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skills",
    "column_name": "owner_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skills",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "skills",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "skills",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  }
] as const;

export const SKILL_REGISTRY_DATABASE_CHECKS_V1 = [
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
    "constraint_name": "skill_activation_current_deployment_environment_check",
    "table_name": "skill_activation_current",
    "required_definition_fragments": [
      "CHECK (deployment_environment = ANY (ARRAY['local'::text, 'dev'::text, 'staging'::text, 'prod'::text]))"
    ]
  },
  {
    "constraint_name": "skill_activation_current_release_channel_check",
    "table_name": "skill_activation_current",
    "required_definition_fragments": [
      "CHECK (release_channel = ANY (ARRAY['stable'::text, 'canary'::text]))"
    ]
  },
  {
    "constraint_name": "skill_activation_revisions_check",
    "table_name": "skill_activation_revisions",
    "required_definition_fragments": [
      "CHECK (state <> 'active'::text OR version_id IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "skill_activation_revisions_deployment_environment_check",
    "table_name": "skill_activation_revisions",
    "required_definition_fragments": [
      "CHECK (deployment_environment = ANY (ARRAY['local'::text, 'dev'::text, 'staging'::text, 'prod'::text]))"
    ]
  },
  {
    "constraint_name": "skill_activation_revisions_release_channel_check",
    "table_name": "skill_activation_revisions",
    "required_definition_fragments": [
      "CHECK (release_channel = ANY (ARRAY['stable'::text, 'canary'::text]))"
    ]
  },
  {
    "constraint_name": "skill_activation_revisions_revision_no_check",
    "table_name": "skill_activation_revisions",
    "required_definition_fragments": [
      "CHECK (revision_no > 0)"
    ]
  },
  {
    "constraint_name": "skill_activation_revisions_state_check",
    "table_name": "skill_activation_revisions",
    "required_definition_fragments": [
      "CHECK (state = ANY (ARRAY['active'::text, 'disabled'::text]))"
    ]
  },
  {
    "constraint_name": "skill_candidate_applications_candidate_type_check",
    "table_name": "skill_candidate_applications",
    "required_definition_fragments": [
      "CHECK (candidate_type = ANY (ARRAY['new_skill'::text, 'skill_update'::text, 'skill_deprecation'::text]))"
    ]
  },
  {
    "constraint_name": "skill_candidate_applications_check",
    "table_name": "skill_candidate_applications",
    "required_definition_fragments": [
      "CHECK (status <> 'draft_created'::text OR staging_version_id IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "skill_candidate_applications_check1",
    "table_name": "skill_candidate_applications",
    "required_definition_fragments": [
      "CHECK (status <> 'deprecation_review_created'::text OR review_ref IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "skill_candidate_applications_deployment_environment_check",
    "table_name": "skill_candidate_applications",
    "required_definition_fragments": [
      "CHECK (deployment_environment = ANY (ARRAY['local'::text, 'dev'::text, 'staging'::text, 'prod'::text]))"
    ]
  },
  {
    "constraint_name": "skill_candidate_applications_release_channel_check",
    "table_name": "skill_candidate_applications",
    "required_definition_fragments": [
      "CHECK (release_channel = ANY (ARRAY['stable'::text, 'canary'::text]))"
    ]
  },
  {
    "constraint_name": "skill_candidate_applications_review_version_check",
    "table_name": "skill_candidate_applications",
    "required_definition_fragments": [
      "CHECK (review_version > 0)"
    ]
  },
  {
    "constraint_name": "skill_candidate_applications_status_check",
    "table_name": "skill_candidate_applications",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['received'::text, 'validating'::text, 'draft_created'::text, 'deprecation_review_created'::text, 'rejected'::text, 'failed'::text]))"
    ]
  },
  {
    "constraint_name": "skill_catalog_current_deployment_environment_check",
    "table_name": "skill_catalog_current",
    "required_definition_fragments": [
      "CHECK (deployment_environment = ANY (ARRAY['local'::text, 'dev'::text, 'staging'::text, 'prod'::text]))"
    ]
  },
  {
    "constraint_name": "skill_catalog_current_release_channel_check",
    "table_name": "skill_catalog_current",
    "required_definition_fragments": [
      "CHECK (release_channel = ANY (ARRAY['stable'::text, 'canary'::text]))"
    ]
  },
  {
    "constraint_name": "skill_catalog_revision_entries_deployment_environment_check",
    "table_name": "skill_catalog_revision_entries",
    "required_definition_fragments": [
      "CHECK (deployment_environment = ANY (ARRAY['local'::text, 'dev'::text, 'staging'::text, 'prod'::text]))"
    ]
  },
  {
    "constraint_name": "skill_catalog_revision_entries_release_channel_check",
    "table_name": "skill_catalog_revision_entries",
    "required_definition_fragments": [
      "CHECK (release_channel = ANY (ARRAY['stable'::text, 'canary'::text]))"
    ]
  },
  {
    "constraint_name": "skill_catalog_revision_entries_runtime_target_check",
    "table_name": "skill_catalog_revision_entries",
    "required_definition_fragments": [
      "CHECK (runtime_target = 'filesystem_bundle.v1'::text)"
    ]
  },
  {
    "constraint_name": "skill_catalog_revisions_deployment_environment_check",
    "table_name": "skill_catalog_revisions",
    "required_definition_fragments": [
      "CHECK (deployment_environment = ANY (ARRAY['local'::text, 'dev'::text, 'staging'::text, 'prod'::text]))"
    ]
  },
  {
    "constraint_name": "skill_catalog_revisions_release_channel_check",
    "table_name": "skill_catalog_revisions",
    "required_definition_fragments": [
      "CHECK (release_channel = ANY (ARRAY['stable'::text, 'canary'::text]))"
    ]
  },
  {
    "constraint_name": "skill_catalog_revisions_security_revocation_epoch_check",
    "table_name": "skill_catalog_revisions",
    "required_definition_fragments": [
      "CHECK (security_revocation_epoch >= 0)"
    ]
  },
  {
    "constraint_name": "skill_event_dlq_resolutions_resolution_payload_check",
    "table_name": "skill_event_dlq_resolutions",
    "required_definition_fragments": [
      "CHECK (jsonb_typeof(resolution_payload) = 'object'::text)"
    ]
  },
  {
    "constraint_name": "skill_event_inbox_event_id_check",
    "table_name": "skill_event_inbox",
    "required_definition_fragments": [
      "CHECK (length(event_id) > 0)"
    ]
  },
  {
    "constraint_name": "skill_event_inbox_payload_hash_check",
    "table_name": "skill_event_inbox",
    "required_definition_fragments": [
      "CHECK (length(payload_hash) > 0)"
    ]
  },
  {
    "constraint_name": "skill_event_inbox_scope_fingerprint_check",
    "table_name": "skill_event_inbox",
    "required_definition_fragments": [
      "CHECK (length(scope_fingerprint) > 0)"
    ]
  },
  {
    "constraint_name": "skill_event_inbox_semantic_hash_check",
    "table_name": "skill_event_inbox",
    "required_definition_fragments": [
      "CHECK (length(semantic_hash) > 0)"
    ]
  },
  {
    "constraint_name": "skill_event_outbox_ack_fence_check",
    "table_name": "skill_event_outbox",
    "required_definition_fragments": [
      "CHECK ((status = 'sent'::text) = (acknowledged_claim_token IS NOT NULL))"
    ]
  },
  {
    "constraint_name": "skill_event_outbox_claim_fence_check",
    "table_name": "skill_event_outbox",
    "required_definition_fragments": [
      "CHECK ((status = 'dispatching'::text) = (claimed_by IS NOT NULL AND claim_token IS NOT NULL AND locked_until IS NOT NULL))"
    ]
  },
  {
    "constraint_name": "skill_event_outbox_event_type_check",
    "table_name": "skill_event_outbox",
    "required_definition_fragments": [
      "CHECK (event_type = ANY (ARRAY['skill.version.published'::text, 'skill.version.deprecated'::text, 'skill.version.revoked'::text, 'skill.security_revocation_epoch.changed'::text, 'skill.package.retention.changed'::text, 'skill.package.retention_hold.changed'::text, 'skill.catalog.changed'::text, 'skill.version.activated'::text, 'skill.activation.disabled'::text, 'skill.activation.rolled_back'::text, 'skill.permission.granted'::text, 'skill.permission.revoked'::text, 'skill.candidate.application.updated'::text]))"
    ],
    "semantic_constraint": {
      "kind": "text_enum",
      "column_name": "event_type",
      "allowed_values": [
        "skill.version.published",
        "skill.version.deprecated",
        "skill.version.revoked",
        "skill.security_revocation_epoch.changed",
        "skill.package.retention.changed",
        "skill.package.retention_hold.changed",
        "skill.catalog.changed",
        "skill.version.activated",
        "skill.activation.disabled",
        "skill.activation.rolled_back",
        "skill.permission.granted",
        "skill.permission.revoked",
        "skill.candidate.application.updated"
      ]
    }
  },
  {
    "constraint_name": "skill_event_outbox_no_observation_target_check",
    "table_name": "skill_event_outbox",
    "required_definition_fragments": [
      "CHECK (target <> 'observation_gateway'::text)"
    ]
  },
  {
    "constraint_name": "skill_event_outbox_producer_check",
    "table_name": "skill_event_outbox",
    "required_definition_fragments": [
      "CHECK (producer = 'skill_registry'::text)"
    ],
    "semantic_constraint": {
      "kind": "text_equals",
      "column_name": "producer",
      "value": "skill_registry"
    }
  },
  {
    "constraint_name": "skill_event_outbox_reconciliation_generation_check",
    "table_name": "skill_event_outbox",
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
    "constraint_name": "skill_event_outbox_scope_shape_check",
    "table_name": "skill_event_outbox",
    "required_definition_fragments": [
      "CHECK ((event_type = ANY (ARRAY['skill.version.published'::text, 'skill.version.deprecated'::text, 'skill.version.revoked'::text, 'skill.security_revocation_epoch.changed'::text, 'skill.package.retention.changed'::text, 'skill.package.retention_hold.changed'::text])) AND (payload ->> 'scope_kind'::text) = 'global'::text AND NOT payload ? 'workspace_id'::text AND NOT payload ? 'bot_id'::text AND NOT payload ? 'owner_agent_id'::text AND NOT payload ? 'deployment_environment'::text AND NOT payload ? 'release_channel'::text AND NOT payload ? 'catalog_version'::text OR (event_type = ANY (ARRAY['skill.catalog.changed'::text, 'skill.version.activated'::text, 'skill.activation.disabled'::text, 'skill.activation.rolled_back'::text, 'skill.permission.granted'::text, 'skill.permission.revoked'::text])) AND (payload ->> 'scope_kind'::text) = 'scoped'::text AND NULLIF(payload ->> 'workspace_id'::text, ''::text) IS NOT NULL AND NULLIF(payload ->> 'bot_id'::text, ''::text) IS NOT NULL AND NULLIF(payload ->> 'deployment_environment'::text, ''::text) IS NOT NULL AND NULLIF(payload ->> 'release_channel'::text, ''::text) IS NOT NULL OR event_type = 'skill.candidate.application.updated'::text AND (payload ->> 'scope_kind'::text) = 'provenance'::text AND NULLIF(payload ->> 'workspace_id'::text, ''::text) IS NOT NULL AND NULLIF(payload ->> 'bot_id'::text, ''::text) IS NOT NULL AND NULLIF(payload ->> 'owner_agent_id'::text, ''::text) IS NOT NULL AND NULLIF(payload ->> 'deployment_environment'::text, ''::text) IS NOT NULL AND NULLIF(payload ->> 'release_channel'::text, ''::text) IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "skill_event_outbox_sent_at_check",
    "table_name": "skill_event_outbox",
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
    "constraint_name": "skill_event_outbox_sent_transport_epoch_check",
    "table_name": "skill_event_outbox",
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
    "constraint_name": "skill_event_outbox_sent_transport_generation_check",
    "table_name": "skill_event_outbox",
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
    "constraint_name": "skill_event_outbox_sent_transport_ref_check",
    "table_name": "skill_event_outbox",
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
    "constraint_name": "skill_event_outbox_status_check",
    "table_name": "skill_event_outbox",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['pending'::text, 'dispatching'::text, 'sent'::text, 'retry_wait'::text, 'failed'::text]))"
    ]
  },
  {
    "constraint_name": "skill_event_outbox_transport_generation_safe_check",
    "table_name": "skill_event_outbox",
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
    "constraint_name": "skill_management_commands_check",
    "table_name": "skill_management_commands",
    "required_definition_fragments": [
      "CHECK (scope_kind = 'scoped'::text AND (operation = ANY (ARRAY['activate'::text, 'rollback'::text, 'disable'::text, 'permission_grant'::text, 'permission_revoke'::text])) AND workspace_id IS NOT NULL AND bot_id IS NOT NULL AND deployment_environment IS NOT NULL AND release_channel IS NOT NULL AND expected_catalog_version IS NOT NULL AND expected_lifecycle_version IS NULL AND (operation = 'activate'::text AND version_id IS NOT NULL AND target_version_id IS NULL AND expected_activation_revision IS NOT NULL AND expected_permission_revision IS NULL OR operation = 'rollback'::text AND version_id IS NULL AND target_version_id IS NOT NULL AND expected_activation_revision IS NOT NULL AND expected_permission_revision IS NULL OR operation = 'disable'::text AND version_id IS NULL AND target_version_id IS NULL AND owner_agent_id IS NULL AND scope_hash IS NULL AND capability_refs IS NULL AND expected_activation_revision IS NOT NULL AND expected_permission_revision IS NULL AND emergency IS NULL OR (operation = ANY (ARRAY['permission_grant'::text, 'permission_revoke'::text])) AND version_id IS NULL AND target_version_id IS NULL AND scope_hash IS NOT NULL AND capability_refs IS NOT NULL AND expected_permission_revision IS NOT NULL AND expected_activation_revision IS NULL) OR scope_kind = 'global'::text AND (operation = ANY (ARRAY['deprecate'::text, 'revoke'::text])) AND workspace_id IS NULL AND bot_id IS NULL AND deployment_environment IS NULL AND release_channel IS NULL AND owner_agent_id IS NULL AND scope_hash IS NULL AND capability_refs IS NULL AND expected_catalog_version IS NULL AND expected_activation_revision IS NULL AND expected_permission_revision IS NULL AND version_id IS NOT NULL AND target_version_id IS NULL AND expected_lifecycle_version IS NOT NULL AND expected_lifecycle_version > 0)"
    ]
  },
  {
    "constraint_name": "skill_management_commands_check1",
    "table_name": "skill_management_commands",
    "required_definition_fragments": [
      "CHECK (status <> 'completed'::text OR completed_at IS NOT NULL AND (scope_kind = 'scoped'::text AND result_revision IS NOT NULL AND result_catalog_version IS NOT NULL AND previous_lifecycle_version IS NULL AND new_lifecycle_version IS NULL OR scope_kind = 'global'::text AND result_revision IS NULL AND result_catalog_version IS NULL AND previous_lifecycle_version IS NOT NULL AND new_lifecycle_version = (previous_lifecycle_version + 1)))"
    ]
  },
  {
    "constraint_name": "skill_management_commands_deployment_environment_check",
    "table_name": "skill_management_commands",
    "required_definition_fragments": [
      "CHECK (deployment_environment IS NULL OR (deployment_environment = ANY (ARRAY['local'::text, 'dev'::text, 'staging'::text, 'prod'::text])))"
    ]
  },
  {
    "constraint_name": "skill_management_commands_operation_check",
    "table_name": "skill_management_commands",
    "required_definition_fragments": [
      "CHECK (operation = ANY (ARRAY['activate'::text, 'rollback'::text, 'disable'::text, 'deprecate'::text, 'revoke'::text, 'permission_grant'::text, 'permission_revoke'::text]))"
    ]
  },
  {
    "constraint_name": "skill_management_commands_release_channel_check",
    "table_name": "skill_management_commands",
    "required_definition_fragments": [
      "CHECK (release_channel IS NULL OR (release_channel = ANY (ARRAY['stable'::text, 'canary'::text])))"
    ]
  },
  {
    "constraint_name": "skill_management_commands_result_security_revocation_epoc_check",
    "table_name": "skill_management_commands",
    "required_definition_fragments": [
      "CHECK (result_security_revocation_epoch >= 0)"
    ]
  },
  {
    "constraint_name": "skill_management_commands_scope_kind_check",
    "table_name": "skill_management_commands",
    "required_definition_fragments": [
      "CHECK (scope_kind = ANY (ARRAY['scoped'::text, 'global'::text]))"
    ]
  },
  {
    "constraint_name": "skill_management_commands_status_check",
    "table_name": "skill_management_commands",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['accepted'::text, 'completed'::text, 'failed'::text]))"
    ]
  },
  {
    "constraint_name": "skill_object_access_decisions_capability_check",
    "table_name": "skill_object_access_decisions",
    "required_definition_fragments": [
      "CHECK (capability = 'skill.content.read'::text)"
    ]
  },
  {
    "constraint_name": "skill_object_access_decisions_check",
    "table_name": "skill_object_access_decisions",
    "required_definition_fragments": [
      "CHECK (expires_at > created_at)"
    ]
  },
  {
    "constraint_name": "skill_object_access_decisions_decision_check",
    "table_name": "skill_object_access_decisions",
    "required_definition_fragments": [
      "CHECK (decision = 'allow'::text)"
    ]
  },
  {
    "constraint_name": "skill_object_access_decisions_operation_check",
    "table_name": "skill_object_access_decisions",
    "required_definition_fragments": [
      "CHECK (operation = ANY (ARRAY['head'::text, 'get'::text, 'grant'::text]))"
    ]
  },
  {
    "constraint_name": "skill_object_access_decisions_owner_state_version_check",
    "table_name": "skill_object_access_decisions",
    "required_definition_fragments": [
      "CHECK (owner_state_version > 0)"
    ]
  },
  {
    "constraint_name": "skill_object_access_decisions_purpose_check",
    "table_name": "skill_object_access_decisions",
    "required_definition_fragments": [
      "CHECK (purpose = ANY (ARRAY['publish_integrity_check'::text, 'runtime_content_read'::text]))"
    ]
  },
  {
    "constraint_name": "skill_object_access_decisions_scope_kind_check",
    "table_name": "skill_object_access_decisions",
    "required_definition_fragments": [
      "CHECK (scope_kind = 'global'::text)"
    ]
  },
  {
    "constraint_name": "skill_package_retention_holds_check",
    "table_name": "skill_package_retention_holds",
    "required_definition_fragments": [
      "CHECK (active AND released_at IS NULL OR NOT active AND released_at IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "skill_package_retention_holds_hold_type_check",
    "table_name": "skill_package_retention_holds",
    "required_definition_fragments": [
      "CHECK (hold_type = ANY (ARRAY['audit'::text, 'legal'::text]))"
    ]
  },
  {
    "constraint_name": "skill_packages_file_count_check",
    "table_name": "skill_packages",
    "required_definition_fragments": [
      "CHECK (file_count > 0)"
    ]
  },
  {
    "constraint_name": "skill_packages_owner_state_version_check",
    "table_name": "skill_packages",
    "required_definition_fragments": [
      "CHECK (owner_state_version >= 1 AND owner_state_version <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "integer_range",
      "column_name": "owner_state_version",
      "min": 1,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "skill_packages_retention_shape_check",
    "table_name": "skill_packages",
    "required_definition_fragments": [
      "CHECK (retention_state = 'retained'::text AND deletion_requested_at IS NULL AND deleted_at IS NULL AND delete_error IS NULL OR retention_state = 'deletion_pending'::text AND deletion_requested_at IS NOT NULL AND deleted_at IS NULL AND delete_error IS NULL OR retention_state = 'delete_failed'::text AND deletion_requested_at IS NOT NULL AND deleted_at IS NULL AND delete_error IS NOT NULL OR retention_state = 'deleted'::text AND deletion_requested_at IS NOT NULL AND deleted_at IS NOT NULL AND delete_error IS NULL)"
    ]
  },
  {
    "constraint_name": "skill_packages_retention_state_check",
    "table_name": "skill_packages",
    "required_definition_fragments": [
      "CHECK (retention_state = ANY (ARRAY['retained'::text, 'deletion_pending'::text, 'delete_failed'::text, 'deleted'::text]))"
    ]
  },
  {
    "constraint_name": "skill_packages_size_bytes_check",
    "table_name": "skill_packages",
    "required_definition_fragments": [
      "CHECK (size_bytes >= 0)"
    ]
  },
  {
    "constraint_name": "skill_packages_state_version_check",
    "table_name": "skill_packages",
    "required_definition_fragments": [
      "CHECK (state_version > 0)"
    ]
  },
  {
    "constraint_name": "skill_permission_current_deployment_environment_check",
    "table_name": "skill_permission_current",
    "required_definition_fragments": [
      "CHECK (deployment_environment = ANY (ARRAY['local'::text, 'dev'::text, 'staging'::text, 'prod'::text]))"
    ]
  },
  {
    "constraint_name": "skill_permission_current_release_channel_check",
    "table_name": "skill_permission_current",
    "required_definition_fragments": [
      "CHECK (release_channel = ANY (ARRAY['stable'::text, 'canary'::text]))"
    ]
  },
  {
    "constraint_name": "skill_permission_revisions_decision_check",
    "table_name": "skill_permission_revisions",
    "required_definition_fragments": [
      "CHECK (decision = ANY (ARRAY['allow'::text, 'deny'::text]))"
    ]
  },
  {
    "constraint_name": "skill_permission_revisions_deployment_environment_check",
    "table_name": "skill_permission_revisions",
    "required_definition_fragments": [
      "CHECK (deployment_environment = ANY (ARRAY['local'::text, 'dev'::text, 'staging'::text, 'prod'::text]))"
    ]
  },
  {
    "constraint_name": "skill_permission_revisions_release_channel_check",
    "table_name": "skill_permission_revisions",
    "required_definition_fragments": [
      "CHECK (release_channel = ANY (ARRAY['stable'::text, 'canary'::text]))"
    ]
  },
  {
    "constraint_name": "skill_permission_revisions_revision_no_check",
    "table_name": "skill_permission_revisions",
    "required_definition_fragments": [
      "CHECK (revision_no > 0)"
    ]
  },
  {
    "constraint_name": "skill_permission_summary_entries_check",
    "table_name": "skill_permission_summary_entries",
    "required_definition_fragments": [
      "CHECK (decision_source = 'revision'::text AND permission_revision_id IS NOT NULL AND revision_no IS NOT NULL AND scope_hash IS NOT NULL OR decision_source = 'default_deny'::text AND decision = 'deny'::text AND permission_revision_id IS NULL AND revision_no IS NULL AND scope_hash IS NULL)"
    ]
  },
  {
    "constraint_name": "skill_permission_summary_entries_decision_check",
    "table_name": "skill_permission_summary_entries",
    "required_definition_fragments": [
      "CHECK (decision = ANY (ARRAY['grant'::text, 'deny'::text]))"
    ],
    "semantic_constraint": {
      "kind": "text_enum",
      "column_name": "decision",
      "allowed_values": [
        "grant",
        "deny"
      ]
    }
  },
  {
    "constraint_name": "skill_permission_summary_entries_decision_source_check",
    "table_name": "skill_permission_summary_entries",
    "required_definition_fragments": [
      "CHECK (decision_source = ANY (ARRAY['revision'::text, 'default_deny'::text]))"
    ],
    "semantic_constraint": {
      "kind": "text_enum",
      "column_name": "decision_source",
      "allowed_values": [
        "revision",
        "default_deny"
      ]
    }
  },
  {
    "constraint_name": "skill_permission_summary_entries_ordinal_check",
    "table_name": "skill_permission_summary_entries",
    "required_definition_fragments": [
      "CHECK (ordinal > 0)"
    ]
  },
  {
    "constraint_name": "skill_permission_summary_snapsh_security_revocation_epoch_check",
    "table_name": "skill_permission_summary_snapshots",
    "required_definition_fragments": [
      "CHECK (security_revocation_epoch >= 0)"
    ]
  },
  {
    "constraint_name": "skill_permission_summary_snapshots_canonical_bytes_check",
    "table_name": "skill_permission_summary_snapshots",
    "required_definition_fragments": [
      "CHECK (octet_length(canonical_bytes) > 0)"
    ],
    "semantic_constraint": {
      "kind": "octet_length_min",
      "column_name": "canonical_bytes",
      "min": 0
    }
  },
  {
    "constraint_name": "skill_permission_summary_snapshots_deployment_environment_check",
    "table_name": "skill_permission_summary_snapshots",
    "required_definition_fragments": [
      "CHECK (deployment_environment = ANY (ARRAY['local'::text, 'dev'::text, 'staging'::text, 'prod'::text]))"
    ]
  },
  {
    "constraint_name": "skill_permission_summary_snapshots_release_channel_check",
    "table_name": "skill_permission_summary_snapshots",
    "required_definition_fragments": [
      "CHECK (release_channel = ANY (ARRAY['stable'::text, 'canary'::text]))"
    ]
  },
  {
    "constraint_name": "skill_permission_summary_snapshots_schema_version_check",
    "table_name": "skill_permission_summary_snapshots",
    "required_definition_fragments": [
      "CHECK (schema_version = 'skill_permission_summary.v1'::text)"
    ],
    "semantic_constraint": {
      "kind": "text_equals",
      "column_name": "schema_version",
      "value": "skill_permission_summary.v1"
    }
  },
  {
    "constraint_name": "skill_resolution_attempts_check",
    "table_name": "skill_resolution_attempts",
    "required_definition_fragments": [
      "CHECK (policy_input_created_at < policy_expires_at)"
    ]
  },
  {
    "constraint_name": "skill_resolution_attempts_check1",
    "table_name": "skill_resolution_attempts",
    "required_definition_fragments": [
      "CHECK (policy_expires_at <= (policy_input_created_at + '24:00:00'::interval))"
    ]
  },
  {
    "constraint_name": "skill_resolution_attempts_check2",
    "table_name": "skill_resolution_attempts",
    "required_definition_fragments": [
      "CHECK (status <> 'resolved'::text OR effective_catalog_version = requested_catalog_version AND valid_until = policy_expires_at AND security_revocation_epoch IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "skill_resolution_attempts_deployment_environment_check",
    "table_name": "skill_resolution_attempts",
    "required_definition_fragments": [
      "CHECK (deployment_environment = ANY (ARRAY['local'::text, 'dev'::text, 'staging'::text, 'prod'::text]))"
    ]
  },
  {
    "constraint_name": "skill_resolution_attempts_release_channel_check",
    "table_name": "skill_resolution_attempts",
    "required_definition_fragments": [
      "CHECK (release_channel = ANY (ARRAY['stable'::text, 'canary'::text]))"
    ]
  },
  {
    "constraint_name": "skill_resolution_attempts_security_revocation_epoch_check",
    "table_name": "skill_resolution_attempts",
    "required_definition_fragments": [
      "CHECK (security_revocation_epoch >= 0)"
    ]
  },
  {
    "constraint_name": "skill_resolution_attempts_start_attempt_no_check",
    "table_name": "skill_resolution_attempts",
    "required_definition_fragments": [
      "CHECK (start_attempt_no > 0)"
    ]
  },
  {
    "constraint_name": "skill_resolution_attempts_status_check",
    "table_name": "skill_resolution_attempts",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['resolving'::text, 'resolved'::text, 'failed'::text]))"
    ]
  },
  {
    "constraint_name": "skill_resolutions_check",
    "table_name": "skill_resolutions",
    "required_definition_fragments": [
      "CHECK (status <> 'resolved'::text OR version_id IS NOT NULL AND package_digest IS NOT NULL AND manifest_digest IS NOT NULL AND runtime_target = 'filesystem_bundle.v1'::text AND resolution_token_hash IS NOT NULL AND valid_until IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "skill_resolutions_permission_decision_check",
    "table_name": "skill_resolutions",
    "required_definition_fragments": [
      "CHECK (permission_decision = ANY (ARRAY['allow'::text, 'deny'::text]))"
    ]
  },
  {
    "constraint_name": "skill_resolutions_start_attempt_no_check",
    "table_name": "skill_resolutions",
    "required_definition_fragments": [
      "CHECK (start_attempt_no > 0)"
    ]
  },
  {
    "constraint_name": "skill_resolutions_status_check",
    "table_name": "skill_resolutions",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['resolved'::text, 'denied'::text, 'not_found'::text, 'revoked'::text, 'incompatible'::text]))"
    ]
  },
  {
    "constraint_name": "skill_security_state_security_revocation_epoch_check",
    "table_name": "skill_security_state",
    "required_definition_fragments": [
      "CHECK (security_revocation_epoch >= 0)"
    ]
  },
  {
    "constraint_name": "skill_security_state_singleton_key_check",
    "table_name": "skill_security_state",
    "required_definition_fragments": [
      "CHECK (singleton_key)"
    ]
  },
  {
    "constraint_name": "skill_validation_attempts_error_branch_check",
    "table_name": "skill_validation_attempts",
    "required_definition_fragments": [
      "CHECK ((outcome = 'rejected'::text) = (error_payload IS NOT NULL))"
    ],
    "semantic_constraint": {
      "kind": "iff_not_null",
      "column_name": "error_payload",
      "condition_column_name": "outcome",
      "condition_equals": "rejected",
      "require_non_empty": false
    }
  },
  {
    "constraint_name": "skill_validation_attempts_outcome_check",
    "table_name": "skill_validation_attempts",
    "required_definition_fragments": [
      "CHECK (outcome = ANY (ARRAY['approved'::text, 'rejected'::text]))"
    ],
    "semantic_constraint": {
      "kind": "text_enum",
      "column_name": "outcome",
      "allowed_values": [
        "approved",
        "rejected"
      ]
    }
  },
  {
    "constraint_name": "skill_validation_attempts_request_hash_check",
    "table_name": "skill_validation_attempts",
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
    "constraint_name": "skill_validation_attempts_request_payload_check",
    "table_name": "skill_validation_attempts",
    "required_definition_fragments": [
      "CHECK (jsonb_typeof(request_payload) = 'object'::text)"
    ]
  },
  {
    "constraint_name": "skill_validation_attempts_response_hash_check",
    "table_name": "skill_validation_attempts",
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
    "constraint_name": "skill_validation_attempts_success_branch_check",
    "table_name": "skill_validation_attempts",
    "required_definition_fragments": [
      "CHECK ((outcome = 'approved'::text) = (success_payload IS NOT NULL))"
    ],
    "semantic_constraint": {
      "kind": "iff_not_null",
      "column_name": "success_payload",
      "condition_column_name": "outcome",
      "condition_equals": "approved",
      "require_non_empty": false
    }
  },
  {
    "constraint_name": "skill_validation_attempts_terminal_fingerprint_check",
    "table_name": "skill_validation_attempts",
    "required_definition_fragments": [
      "CHECK (terminal_fingerprint ~ '^sha256:[0-9a-f]{64}$'::text)"
    ],
    "semantic_constraint": {
      "kind": "text_regex",
      "column_name": "terminal_fingerprint",
      "pattern": "^sha256:[0-9a-f]{64}$"
    }
  },
  {
    "constraint_name": "skill_validation_attempts_validation_id_branch_check",
    "table_name": "skill_validation_attempts",
    "required_definition_fragments": [
      "CHECK ((outcome = 'approved'::text) = (validation_id IS NOT NULL))"
    ],
    "semantic_constraint": {
      "kind": "iff_not_null",
      "column_name": "validation_id",
      "condition_column_name": "outcome",
      "condition_equals": "approved",
      "require_non_empty": false
    }
  },
  {
    "constraint_name": "skill_validation_attempts_validation_record_branch_check",
    "table_name": "skill_validation_attempts",
    "required_definition_fragments": [
      "CHECK ((outcome = 'approved'::text) = (validation_record IS NOT NULL))"
    ],
    "semantic_constraint": {
      "kind": "iff_not_null",
      "column_name": "validation_record",
      "condition_column_name": "outcome",
      "condition_equals": "approved",
      "require_non_empty": false
    }
  },
  {
    "constraint_name": "skill_version_staging_check",
    "table_name": "skill_version_staging",
    "required_definition_fragments": [
      "CHECK (validation_expires_at = (created_at + '00:30:00'::interval))"
    ]
  },
  {
    "constraint_name": "skill_version_staging_manifest_check",
    "table_name": "skill_version_staging",
    "required_definition_fragments": [
      "CHECK (jsonb_typeof(manifest) = 'object'::text)"
    ]
  },
  {
    "constraint_name": "skill_version_staging_owner_state_version_safe_check",
    "table_name": "skill_version_staging",
    "required_definition_fragments": [
      "CHECK (owner_state_version >= 1 AND owner_state_version <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "integer_range",
      "column_name": "owner_state_version",
      "min": 1,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "skill_version_staging_request_hash_check",
    "table_name": "skill_version_staging",
    "required_definition_fragments": [
      "CHECK (length(request_hash) > 0)"
    ]
  },
  {
    "constraint_name": "skill_version_staging_size_bytes_check",
    "table_name": "skill_version_staging",
    "required_definition_fragments": [
      "CHECK (size_bytes >= 0 AND size_bytes <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "integer_range",
      "column_name": "size_bytes",
      "min": 0,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "skill_version_staging_skill_name_check",
    "table_name": "skill_version_staging",
    "required_definition_fragments": [
      "CHECK (length(skill_name) > 0)"
    ]
  },
  {
    "constraint_name": "skill_version_staging_state_version_safe_check",
    "table_name": "skill_version_staging",
    "required_definition_fragments": [
      "CHECK (staging_state_version >= 1 AND staging_state_version <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "integer_range",
      "column_name": "staging_state_version",
      "min": 1,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "skill_version_staging_status_check",
    "table_name": "skill_version_staging",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['draft'::text, 'validating'::text, 'review_pending'::text, 'approved'::text, 'rejected'::text]))"
    ]
  },
  {
    "constraint_name": "skill_versions_check",
    "table_name": "skill_versions",
    "required_definition_fragments": [
      "CHECK (lifecycle_state <> 'deprecated'::text OR deprecated_at IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "skill_versions_check1",
    "table_name": "skill_versions",
    "required_definition_fragments": [
      "CHECK (lifecycle_state <> 'revoked'::text OR revoked_at IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "skill_versions_lifecycle_state_check",
    "table_name": "skill_versions",
    "required_definition_fragments": [
      "CHECK (lifecycle_state = ANY (ARRAY['published'::text, 'deprecated'::text, 'revoked'::text]))"
    ]
  },
  {
    "constraint_name": "skill_versions_lifecycle_version_check",
    "table_name": "skill_versions",
    "required_definition_fragments": [
      "CHECK (lifecycle_version > 0)"
    ]
  },
  {
    "constraint_name": "skill_versions_revocation_epoch_check",
    "table_name": "skill_versions",
    "required_definition_fragments": [
      "CHECK (revocation_epoch >= 0)"
    ]
  },
  {
    "constraint_name": "skill_versions_runtime_target_check",
    "table_name": "skill_versions",
    "required_definition_fragments": [
      "CHECK (runtime_target = 'filesystem_bundle.v1'::text)"
    ]
  },
  {
    "constraint_name": "skills_status_check",
    "table_name": "skills",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['enabled'::text, 'disabled'::text]))"
    ]
  }
] as const;

export const SKILL_REGISTRY_DATABASE_FUNCTIONS_V1 = [] as const;

export const SKILL_REGISTRY_DATABASE_TRIGGERS_V1 = [
  {
    "table_name": "skill_packages",
    "trigger_name": "skill_packages_retention_transition_guard",
    "enabled_mode": "O",
    "trigger_type": 27,
    "trigger_argument_count": 0,
    "update_columns": "",
    "constraint_trigger": false,
    "has_when_clause": false,
    "has_old_transition_table": false,
    "has_new_transition_table": false,
    "function_schema": "skill_registry",
    "function_name": "guard_skill_package_retention_transition",
    "security_definer": true,
    "settings": [
      "search_path=pg_catalog, skill_registry"
    ],
    "language_name": "plpgsql",
    "function_body_sha256": "sha256:54c76f754303f4ab061868a7190c9d6063f159897fc4207ccad18c25b5d4fc17"
  },
  {
    "table_name": "skill_permission_summary_entries",
    "trigger_name": "skill_permission_summary_entries_immutable",
    "enabled_mode": "O",
    "trigger_type": 27,
    "trigger_argument_count": 0,
    "update_columns": "",
    "constraint_trigger": false,
    "has_when_clause": false,
    "has_old_transition_table": false,
    "has_new_transition_table": false,
    "function_schema": "skill_registry",
    "function_name": "reject_skill_permission_summary_mutation",
    "security_definer": true,
    "settings": [
      "search_path=pg_catalog, skill_registry"
    ],
    "language_name": "plpgsql",
    "function_body_sha256": "sha256:4f6238796eeac3e3932758f23b1184265894053b47d3c0bf012cb875dc5d564c"
  },
  {
    "table_name": "skill_permission_summary_snapshots",
    "trigger_name": "skill_permission_summary_snapshots_immutable",
    "enabled_mode": "O",
    "trigger_type": 27,
    "trigger_argument_count": 0,
    "update_columns": "",
    "constraint_trigger": false,
    "has_when_clause": false,
    "has_old_transition_table": false,
    "has_new_transition_table": false,
    "function_schema": "skill_registry",
    "function_name": "reject_skill_permission_summary_mutation",
    "security_definer": true,
    "settings": [
      "search_path=pg_catalog, skill_registry"
    ],
    "language_name": "plpgsql",
    "function_body_sha256": "sha256:4f6238796eeac3e3932758f23b1184265894053b47d3c0bf012cb875dc5d564c"
  }
] as const;

export const SKILL_REGISTRY_DATABASE_UNIQUE_CONSTRAINTS_V1 = [
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
    "constraint_name": "skill_activation_current_activation_revision_id_key",
    "table_name": "skill_activation_current",
    "columns": [
      "activation_revision_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_activation_current_pkey",
    "table_name": "skill_activation_current",
    "columns": [
      "skill_id",
      "workspace_id",
      "bot_id",
      "deployment_environment",
      "release_channel"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_activation_revisions_id_skill_id_workspace_id_bot_id__key",
    "table_name": "skill_activation_revisions",
    "columns": [
      "id",
      "skill_id",
      "workspace_id",
      "bot_id",
      "deployment_environment",
      "release_channel"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_activation_revisions_pkey",
    "table_name": "skill_activation_revisions",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_activation_revisions_skill_id_workspace_id_bot_id_dep_key",
    "table_name": "skill_activation_revisions",
    "columns": [
      "skill_id",
      "workspace_id",
      "bot_id",
      "deployment_environment",
      "release_channel",
      "revision_no"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_audit_logs_pkey",
    "table_name": "skill_audit_logs",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_candidate_applications_candidate_id_proposal_hash_key",
    "table_name": "skill_candidate_applications",
    "columns": [
      "candidate_id",
      "proposal_hash"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_candidate_applications_idempotency_key_key",
    "table_name": "skill_candidate_applications",
    "columns": [
      "idempotency_key"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_candidate_applications_pkey",
    "table_name": "skill_candidate_applications",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_catalog_current_catalog_revision_id_key",
    "table_name": "skill_catalog_current",
    "columns": [
      "catalog_revision_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_catalog_current_pkey",
    "table_name": "skill_catalog_current",
    "columns": [
      "workspace_id",
      "bot_id",
      "deployment_environment",
      "release_channel"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_catalog_revision_entries_pkey",
    "table_name": "skill_catalog_revision_entries",
    "columns": [
      "catalog_revision_id",
      "skill_id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_catalog_revisions_id_workspace_id_bot_id_deployment_e_key",
    "table_name": "skill_catalog_revisions",
    "columns": [
      "id",
      "workspace_id",
      "bot_id",
      "deployment_environment",
      "release_channel"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_catalog_revisions_pkey",
    "table_name": "skill_catalog_revisions",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_catalog_revisions_workspace_id_bot_id_deployment_envi_key",
    "table_name": "skill_catalog_revisions",
    "columns": [
      "workspace_id",
      "bot_id",
      "deployment_environment",
      "release_channel",
      "catalog_version"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_event_dlq_pkey",
    "table_name": "skill_event_dlq",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_event_dlq_resolutions_dlq_id_key",
    "table_name": "skill_event_dlq_resolutions",
    "columns": [
      "dlq_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_event_dlq_resolutions_idempotency_key_key",
    "table_name": "skill_event_dlq_resolutions",
    "columns": [
      "idempotency_key"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_event_dlq_resolutions_pkey",
    "table_name": "skill_event_dlq_resolutions",
    "columns": [
      "resolution_id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_event_inbox_pkey",
    "table_name": "skill_event_inbox",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_event_inbox_source_event_id_key",
    "table_name": "skill_event_inbox",
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
    "constraint_name": "skill_event_inbox_source_idempotency_key_key",
    "table_name": "skill_event_inbox",
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
    "constraint_name": "skill_event_outbox_idempotency_key_key",
    "table_name": "skill_event_outbox",
    "columns": [
      "idempotency_key"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_event_outbox_pkey",
    "table_name": "skill_event_outbox",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_management_commands_pkey",
    "table_name": "skill_management_commands",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_management_commands_scope_kind_operation_idempotency__key",
    "table_name": "skill_management_commands",
    "columns": [
      "scope_kind",
      "operation",
      "idempotency_key"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_object_access_decisions_pkey",
    "table_name": "skill_object_access_decisions",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_package_retention_holds_pkey",
    "table_name": "skill_package_retention_holds",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_package_retention_transit_package_id_to_state_version_key",
    "table_name": "skill_package_retention_transitions",
    "columns": [
      "package_id",
      "to_state_version"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_package_retention_transitions_pkey",
    "table_name": "skill_package_retention_transitions",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_packages_pkey",
    "table_name": "skill_packages",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_packages_version_id_key",
    "table_name": "skill_packages",
    "columns": [
      "version_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_permission_current_permission_revision_id_key",
    "table_name": "skill_permission_current",
    "columns": [
      "permission_revision_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_permission_current_pkey",
    "table_name": "skill_permission_current",
    "columns": [
      "skill_id",
      "workspace_id",
      "bot_id",
      "deployment_environment",
      "release_channel",
      "scope_hash"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_permission_revisions_id_skill_id_workspace_id_bot_id__key",
    "table_name": "skill_permission_revisions",
    "columns": [
      "id",
      "skill_id",
      "workspace_id",
      "bot_id",
      "deployment_environment",
      "release_channel",
      "scope_hash"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_permission_revisions_pkey",
    "table_name": "skill_permission_revisions",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_permission_revisions_skill_id_workspace_id_bot_id_dep_key",
    "table_name": "skill_permission_revisions",
    "columns": [
      "skill_id",
      "workspace_id",
      "bot_id",
      "deployment_environment",
      "release_channel",
      "scope_hash",
      "revision_no"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_permission_summary_entries_pkey",
    "table_name": "skill_permission_summary_entries",
    "columns": [
      "summary_ref",
      "skill_id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_permission_summary_entries_summary_ref_ordinal_key",
    "table_name": "skill_permission_summary_entries",
    "columns": [
      "summary_ref",
      "ordinal"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_permission_summary_snap_workspace_id_bot_id_owner_age_key",
    "table_name": "skill_permission_summary_snapshots",
    "columns": [
      "workspace_id",
      "bot_id",
      "owner_agent_id",
      "deployment_environment",
      "release_channel",
      "catalog_revision_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_permission_summary_snapshots_pkey",
    "table_name": "skill_permission_summary_snapshots",
    "columns": [
      "summary_ref"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_permission_summary_snapshots_summary_ref_summary_hash_key",
    "table_name": "skill_permission_summary_snapshots",
    "columns": [
      "summary_ref",
      "summary_hash"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_resolution_attempts_id_runtime_run_id_start_attempt_n_key",
    "table_name": "skill_resolution_attempts",
    "columns": [
      "id",
      "runtime_run_id",
      "start_attempt_no"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_resolution_attempts_idempotency_key_key",
    "table_name": "skill_resolution_attempts",
    "columns": [
      "idempotency_key"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_resolution_attempts_pkey",
    "table_name": "skill_resolution_attempts",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_resolution_attempts_runtime_run_id_start_attempt_no_key",
    "table_name": "skill_resolution_attempts",
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
    "constraint_name": "skill_resolutions_pkey",
    "table_name": "skill_resolutions",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_resolutions_resolution_attempt_id_skill_key_key",
    "table_name": "skill_resolutions",
    "columns": [
      "resolution_attempt_id",
      "skill_key"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_resolutions_runtime_run_id_start_attempt_no_skill_key_key",
    "table_name": "skill_resolutions",
    "columns": [
      "runtime_run_id",
      "start_attempt_no",
      "skill_key"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_security_state_pkey",
    "table_name": "skill_security_state",
    "columns": [
      "singleton_key"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_validation_attempts_idempotency_key_key",
    "table_name": "skill_validation_attempts",
    "columns": [
      "idempotency_key"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_validation_attempts_pkey",
    "table_name": "skill_validation_attempts",
    "columns": [
      "attempt_id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_validation_attempts_validation_id_key",
    "table_name": "skill_validation_attempts",
    "columns": [
      "validation_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_version_staging_artifact_ref_key",
    "table_name": "skill_version_staging",
    "columns": [
      "artifact_ref"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_version_staging_id_skill_id_key",
    "table_name": "skill_version_staging",
    "columns": [
      "id",
      "skill_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_version_staging_idempotency_key_key",
    "table_name": "skill_version_staging",
    "columns": [
      "idempotency_key"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_version_staging_object_access_decision_ref_key",
    "table_name": "skill_version_staging",
    "columns": [
      "object_access_decision_ref"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_version_staging_pkey",
    "table_name": "skill_version_staging",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_version_staging_skill_id_skill_name_proposed_version__key",
    "table_name": "skill_version_staging",
    "columns": [
      "skill_id",
      "skill_name",
      "proposed_version",
      "package_digest"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_versions_id_skill_id_key",
    "table_name": "skill_versions",
    "columns": [
      "id",
      "skill_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_versions_pkey",
    "table_name": "skill_versions",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_versions_skill_id_package_digest_key",
    "table_name": "skill_versions",
    "columns": [
      "skill_id",
      "package_digest"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_versions_skill_id_version_key",
    "table_name": "skill_versions",
    "columns": [
      "skill_id",
      "version"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_versions_validation_id_key",
    "table_name": "skill_versions",
    "columns": [
      "validation_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skills_pkey",
    "table_name": "skills",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skills_skill_key_key",
    "table_name": "skills",
    "columns": [
      "skill_key"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  }
] as const;

export const SKILL_REGISTRY_DATABASE_INDEXES_V1 = [
  {
    "index_name": "eventing_transport_epochs_pkey",
    "table_name": "eventing_transport_epochs",
    "definition": "CREATE UNIQUE INDEX eventing_transport_epochs_pkey ON skill_registry.eventing_transport_epochs USING btree (transport_name)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "skill_activation_current_activation_revision_id_key",
    "table_name": "skill_activation_current",
    "definition": "CREATE UNIQUE INDEX skill_activation_current_activation_revision_id_key ON skill_registry.skill_activation_current USING btree (activation_revision_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_activation_current_pkey",
    "table_name": "skill_activation_current",
    "definition": "CREATE UNIQUE INDEX skill_activation_current_pkey ON skill_registry.skill_activation_current USING btree (skill_id, workspace_id, bot_id, deployment_environment, release_channel)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "skill_activation_revisions_id_skill_id_workspace_id_bot_id__key",
    "table_name": "skill_activation_revisions",
    "definition": "CREATE UNIQUE INDEX skill_activation_revisions_id_skill_id_workspace_id_bot_id__key ON skill_registry.skill_activation_revisions USING btree (id, skill_id, workspace_id, bot_id, deployment_environment, release_channel)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_activation_revisions_pkey",
    "table_name": "skill_activation_revisions",
    "definition": "CREATE UNIQUE INDEX skill_activation_revisions_pkey ON skill_registry.skill_activation_revisions USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "skill_activation_revisions_scope_idx",
    "table_name": "skill_activation_revisions",
    "definition": "CREATE INDEX skill_activation_revisions_scope_idx ON skill_registry.skill_activation_revisions USING btree (workspace_id, bot_id, deployment_environment, release_channel, skill_id, revision_no DESC)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_activation_revisions_skill_id_workspace_id_bot_id_dep_key",
    "table_name": "skill_activation_revisions",
    "definition": "CREATE UNIQUE INDEX skill_activation_revisions_skill_id_workspace_id_bot_id_dep_key ON skill_registry.skill_activation_revisions USING btree (skill_id, workspace_id, bot_id, deployment_environment, release_channel, revision_no)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_audit_logs_pkey",
    "table_name": "skill_audit_logs",
    "definition": "CREATE UNIQUE INDEX skill_audit_logs_pkey ON skill_registry.skill_audit_logs USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "skill_candidate_applications_candidate_id_proposal_hash_key",
    "table_name": "skill_candidate_applications",
    "definition": "CREATE UNIQUE INDEX skill_candidate_applications_candidate_id_proposal_hash_key ON skill_registry.skill_candidate_applications USING btree (candidate_id, proposal_hash)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_candidate_applications_idempotency_key_key",
    "table_name": "skill_candidate_applications",
    "definition": "CREATE UNIQUE INDEX skill_candidate_applications_idempotency_key_key ON skill_registry.skill_candidate_applications USING btree (idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_candidate_applications_pkey",
    "table_name": "skill_candidate_applications",
    "definition": "CREATE UNIQUE INDEX skill_candidate_applications_pkey ON skill_registry.skill_candidate_applications USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "skill_candidate_applications_status_idx",
    "table_name": "skill_candidate_applications",
    "definition": "CREATE INDEX skill_candidate_applications_status_idx ON skill_registry.skill_candidate_applications USING btree (status, updated_at)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_catalog_current_catalog_revision_id_key",
    "table_name": "skill_catalog_current",
    "definition": "CREATE UNIQUE INDEX skill_catalog_current_catalog_revision_id_key ON skill_registry.skill_catalog_current USING btree (catalog_revision_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_catalog_current_pkey",
    "table_name": "skill_catalog_current",
    "definition": "CREATE UNIQUE INDEX skill_catalog_current_pkey ON skill_registry.skill_catalog_current USING btree (workspace_id, bot_id, deployment_environment, release_channel)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "skill_catalog_revision_entries_pkey",
    "table_name": "skill_catalog_revision_entries",
    "definition": "CREATE UNIQUE INDEX skill_catalog_revision_entries_pkey ON skill_registry.skill_catalog_revision_entries USING btree (catalog_revision_id, skill_id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "skill_catalog_revisions_id_workspace_id_bot_id_deployment_e_key",
    "table_name": "skill_catalog_revisions",
    "definition": "CREATE UNIQUE INDEX skill_catalog_revisions_id_workspace_id_bot_id_deployment_e_key ON skill_registry.skill_catalog_revisions USING btree (id, workspace_id, bot_id, deployment_environment, release_channel)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_catalog_revisions_pkey",
    "table_name": "skill_catalog_revisions",
    "definition": "CREATE UNIQUE INDEX skill_catalog_revisions_pkey ON skill_registry.skill_catalog_revisions USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "skill_catalog_revisions_workspace_id_bot_id_deployment_envi_key",
    "table_name": "skill_catalog_revisions",
    "definition": "CREATE UNIQUE INDEX skill_catalog_revisions_workspace_id_bot_id_deployment_envi_key ON skill_registry.skill_catalog_revisions USING btree (workspace_id, bot_id, deployment_environment, release_channel, catalog_version)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_event_dlq_pkey",
    "table_name": "skill_event_dlq",
    "definition": "CREATE UNIQUE INDEX skill_event_dlq_pkey ON skill_registry.skill_event_dlq USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "skill_event_dlq_resolutions_dlq_id_key",
    "table_name": "skill_event_dlq_resolutions",
    "definition": "CREATE UNIQUE INDEX skill_event_dlq_resolutions_dlq_id_key ON skill_registry.skill_event_dlq_resolutions USING btree (dlq_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_event_dlq_resolutions_idempotency_key_key",
    "table_name": "skill_event_dlq_resolutions",
    "definition": "CREATE UNIQUE INDEX skill_event_dlq_resolutions_idempotency_key_key ON skill_registry.skill_event_dlq_resolutions USING btree (idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_event_dlq_resolutions_pkey",
    "table_name": "skill_event_dlq_resolutions",
    "definition": "CREATE UNIQUE INDEX skill_event_dlq_resolutions_pkey ON skill_registry.skill_event_dlq_resolutions USING btree (resolution_id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "skill_event_inbox_pkey",
    "table_name": "skill_event_inbox",
    "definition": "CREATE UNIQUE INDEX skill_event_inbox_pkey ON skill_registry.skill_event_inbox USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "skill_event_inbox_source_event_id_key",
    "table_name": "skill_event_inbox",
    "definition": "CREATE UNIQUE INDEX skill_event_inbox_source_event_id_key ON skill_registry.skill_event_inbox USING btree (source, event_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_event_inbox_source_idempotency_key_key",
    "table_name": "skill_event_inbox",
    "definition": "CREATE UNIQUE INDEX skill_event_inbox_source_idempotency_key_key ON skill_registry.skill_event_inbox USING btree (source, idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_event_outbox_dispatch_idx",
    "table_name": "skill_event_outbox",
    "definition": "CREATE INDEX skill_event_outbox_dispatch_idx ON skill_registry.skill_event_outbox USING btree (status, next_retry_at, created_at) WHERE (status = ANY (ARRAY['pending'::text, 'retry_wait'::text]))",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_event_outbox_idempotency_key_key",
    "table_name": "skill_event_outbox",
    "definition": "CREATE UNIQUE INDEX skill_event_outbox_idempotency_key_key ON skill_registry.skill_event_outbox USING btree (idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_event_outbox_pkey",
    "table_name": "skill_event_outbox",
    "definition": "CREATE UNIQUE INDEX skill_event_outbox_pkey ON skill_registry.skill_event_outbox USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "skill_event_outbox_reconciliation_due_idx",
    "table_name": "skill_event_outbox",
    "definition": "CREATE INDEX skill_event_outbox_reconciliation_due_idx ON skill_registry.skill_event_outbox USING btree (reconciliation_next_probe_at NULLS FIRST, sent_at, id) WHERE (status = 'sent'::text)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_event_outbox_reconciliation_generation_idx",
    "table_name": "skill_event_outbox",
    "definition": "CREATE INDEX skill_event_outbox_reconciliation_generation_idx ON skill_registry.skill_event_outbox USING btree (transport_epoch, transport_generation, sent_at, id) WHERE (status = 'sent'::text)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_event_outbox_reconciliation_transport_ref_idx",
    "table_name": "skill_event_outbox",
    "definition": "CREATE INDEX skill_event_outbox_reconciliation_transport_ref_idx ON skill_registry.skill_event_outbox USING btree (transport_ref, transport_epoch, transport_generation) WHERE ((status = 'sent'::text) AND (transport_ref IS NOT NULL))",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_management_commands_pkey",
    "table_name": "skill_management_commands",
    "definition": "CREATE UNIQUE INDEX skill_management_commands_pkey ON skill_registry.skill_management_commands USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "skill_management_commands_scope_kind_operation_idempotency__key",
    "table_name": "skill_management_commands",
    "definition": "CREATE UNIQUE INDEX skill_management_commands_scope_kind_operation_idempotency__key ON skill_registry.skill_management_commands USING btree (scope_kind, operation, idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_management_commands_scope_status_idx",
    "table_name": "skill_management_commands",
    "definition": "CREATE INDEX skill_management_commands_scope_status_idx ON skill_registry.skill_management_commands USING btree (scope_kind, operation, status, created_at)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_object_access_decisions_pkey",
    "table_name": "skill_object_access_decisions",
    "definition": "CREATE UNIQUE INDEX skill_object_access_decisions_pkey ON skill_registry.skill_object_access_decisions USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "skill_object_access_decisions_verify_idx",
    "table_name": "skill_object_access_decisions",
    "definition": "CREATE INDEX skill_object_access_decisions_verify_idx ON skill_registry.skill_object_access_decisions USING btree (id, operation, object_ref, owner_object_id, owner_state_version, expires_at)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_package_retention_holds_active_uq",
    "table_name": "skill_package_retention_holds",
    "definition": "CREATE UNIQUE INDEX skill_package_retention_holds_active_uq ON skill_registry.skill_package_retention_holds USING btree (package_id, hold_type, reason_code) WHERE active",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_package_retention_holds_pkey",
    "table_name": "skill_package_retention_holds",
    "definition": "CREATE UNIQUE INDEX skill_package_retention_holds_pkey ON skill_registry.skill_package_retention_holds USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "skill_package_retention_transit_package_id_to_state_version_key",
    "table_name": "skill_package_retention_transitions",
    "definition": "CREATE UNIQUE INDEX skill_package_retention_transit_package_id_to_state_version_key ON skill_registry.skill_package_retention_transitions USING btree (package_id, to_state_version)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_package_retention_transitions_pkey",
    "table_name": "skill_package_retention_transitions",
    "definition": "CREATE UNIQUE INDEX skill_package_retention_transitions_pkey ON skill_registry.skill_package_retention_transitions USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "skill_packages_gc_idx",
    "table_name": "skill_packages",
    "definition": "CREATE INDEX skill_packages_gc_idx ON skill_registry.skill_packages USING btree (retention_state, retention_until, state_version) WHERE (retention_state = ANY (ARRAY['retained'::text, 'deletion_pending'::text, 'delete_failed'::text]))",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_packages_pkey",
    "table_name": "skill_packages",
    "definition": "CREATE UNIQUE INDEX skill_packages_pkey ON skill_registry.skill_packages USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "skill_packages_version_id_key",
    "table_name": "skill_packages",
    "definition": "CREATE UNIQUE INDEX skill_packages_version_id_key ON skill_registry.skill_packages USING btree (version_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_permission_current_permission_revision_id_key",
    "table_name": "skill_permission_current",
    "definition": "CREATE UNIQUE INDEX skill_permission_current_permission_revision_id_key ON skill_registry.skill_permission_current USING btree (permission_revision_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_permission_current_pkey",
    "table_name": "skill_permission_current",
    "definition": "CREATE UNIQUE INDEX skill_permission_current_pkey ON skill_registry.skill_permission_current USING btree (skill_id, workspace_id, bot_id, deployment_environment, release_channel, scope_hash)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "skill_permission_revisions_id_skill_id_workspace_id_bot_id__key",
    "table_name": "skill_permission_revisions",
    "definition": "CREATE UNIQUE INDEX skill_permission_revisions_id_skill_id_workspace_id_bot_id__key ON skill_registry.skill_permission_revisions USING btree (id, skill_id, workspace_id, bot_id, deployment_environment, release_channel, scope_hash)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_permission_revisions_pkey",
    "table_name": "skill_permission_revisions",
    "definition": "CREATE UNIQUE INDEX skill_permission_revisions_pkey ON skill_registry.skill_permission_revisions USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "skill_permission_revisions_scope_idx",
    "table_name": "skill_permission_revisions",
    "definition": "CREATE INDEX skill_permission_revisions_scope_idx ON skill_registry.skill_permission_revisions USING btree (workspace_id, bot_id, deployment_environment, release_channel, skill_id, scope_hash, revision_no DESC)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_permission_revisions_skill_id_workspace_id_bot_id_dep_key",
    "table_name": "skill_permission_revisions",
    "definition": "CREATE UNIQUE INDEX skill_permission_revisions_skill_id_workspace_id_bot_id_dep_key ON skill_registry.skill_permission_revisions USING btree (skill_id, workspace_id, bot_id, deployment_environment, release_channel, scope_hash, revision_no)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_permission_summary_entries_pkey",
    "table_name": "skill_permission_summary_entries",
    "definition": "CREATE UNIQUE INDEX skill_permission_summary_entries_pkey ON skill_registry.skill_permission_summary_entries USING btree (summary_ref, skill_id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "skill_permission_summary_entries_summary_ref_ordinal_key",
    "table_name": "skill_permission_summary_entries",
    "definition": "CREATE UNIQUE INDEX skill_permission_summary_entries_summary_ref_ordinal_key ON skill_registry.skill_permission_summary_entries USING btree (summary_ref, ordinal)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_permission_summary_snap_workspace_id_bot_id_owner_age_key",
    "table_name": "skill_permission_summary_snapshots",
    "definition": "CREATE UNIQUE INDEX skill_permission_summary_snap_workspace_id_bot_id_owner_age_key ON skill_registry.skill_permission_summary_snapshots USING btree (workspace_id, bot_id, owner_agent_id, deployment_environment, release_channel, catalog_revision_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_permission_summary_snapshots_pkey",
    "table_name": "skill_permission_summary_snapshots",
    "definition": "CREATE UNIQUE INDEX skill_permission_summary_snapshots_pkey ON skill_registry.skill_permission_summary_snapshots USING btree (summary_ref)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "skill_permission_summary_snapshots_summary_ref_summary_hash_key",
    "table_name": "skill_permission_summary_snapshots",
    "definition": "CREATE UNIQUE INDEX skill_permission_summary_snapshots_summary_ref_summary_hash_key ON skill_registry.skill_permission_summary_snapshots USING btree (summary_ref, summary_hash)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_resolution_attempts_id_runtime_run_id_start_attempt_n_key",
    "table_name": "skill_resolution_attempts",
    "definition": "CREATE UNIQUE INDEX skill_resolution_attempts_id_runtime_run_id_start_attempt_n_key ON skill_registry.skill_resolution_attempts USING btree (id, runtime_run_id, start_attempt_no)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_resolution_attempts_idempotency_key_key",
    "table_name": "skill_resolution_attempts",
    "definition": "CREATE UNIQUE INDEX skill_resolution_attempts_idempotency_key_key ON skill_registry.skill_resolution_attempts USING btree (idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_resolution_attempts_pkey",
    "table_name": "skill_resolution_attempts",
    "definition": "CREATE UNIQUE INDEX skill_resolution_attempts_pkey ON skill_registry.skill_resolution_attempts USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "skill_resolution_attempts_runtime_run_id_start_attempt_no_key",
    "table_name": "skill_resolution_attempts",
    "definition": "CREATE UNIQUE INDEX skill_resolution_attempts_runtime_run_id_start_attempt_no_key ON skill_registry.skill_resolution_attempts USING btree (runtime_run_id, start_attempt_no)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_resolution_attempts_status_idx",
    "table_name": "skill_resolution_attempts",
    "definition": "CREATE INDEX skill_resolution_attempts_status_idx ON skill_registry.skill_resolution_attempts USING btree (status, created_at, runtime_run_id, start_attempt_no)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_resolutions_attempt_idx",
    "table_name": "skill_resolutions",
    "definition": "CREATE INDEX skill_resolutions_attempt_idx ON skill_registry.skill_resolutions USING btree (resolution_attempt_id, status, skill_key)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_resolutions_pkey",
    "table_name": "skill_resolutions",
    "definition": "CREATE UNIQUE INDEX skill_resolutions_pkey ON skill_registry.skill_resolutions USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "skill_resolutions_resolution_attempt_id_skill_key_key",
    "table_name": "skill_resolutions",
    "definition": "CREATE UNIQUE INDEX skill_resolutions_resolution_attempt_id_skill_key_key ON skill_registry.skill_resolutions USING btree (resolution_attempt_id, skill_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_resolutions_runtime_run_id_start_attempt_no_skill_key_key",
    "table_name": "skill_resolutions",
    "definition": "CREATE UNIQUE INDEX skill_resolutions_runtime_run_id_start_attempt_no_skill_key_key ON skill_registry.skill_resolutions USING btree (runtime_run_id, start_attempt_no, skill_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_security_state_pkey",
    "table_name": "skill_security_state",
    "definition": "CREATE UNIQUE INDEX skill_security_state_pkey ON skill_registry.skill_security_state USING btree (singleton_key)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "skill_validation_attempts_expires_at_idx",
    "table_name": "skill_validation_attempts",
    "definition": "CREATE INDEX skill_validation_attempts_expires_at_idx ON skill_registry.skill_validation_attempts USING btree (expires_at, attempt_id)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_validation_attempts_idempotency_key_key",
    "table_name": "skill_validation_attempts",
    "definition": "CREATE UNIQUE INDEX skill_validation_attempts_idempotency_key_key ON skill_registry.skill_validation_attempts USING btree (idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_validation_attempts_pkey",
    "table_name": "skill_validation_attempts",
    "definition": "CREATE UNIQUE INDEX skill_validation_attempts_pkey ON skill_registry.skill_validation_attempts USING btree (attempt_id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "skill_validation_attempts_validation_id_key",
    "table_name": "skill_validation_attempts",
    "definition": "CREATE UNIQUE INDEX skill_validation_attempts_validation_id_key ON skill_registry.skill_validation_attempts USING btree (validation_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_version_staging_artifact_ref_key",
    "table_name": "skill_version_staging",
    "definition": "CREATE UNIQUE INDEX skill_version_staging_artifact_ref_key ON skill_registry.skill_version_staging USING btree (artifact_ref)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_version_staging_id_skill_id_key",
    "table_name": "skill_version_staging",
    "definition": "CREATE UNIQUE INDEX skill_version_staging_id_skill_id_key ON skill_registry.skill_version_staging USING btree (id, skill_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_version_staging_idempotency_key_key",
    "table_name": "skill_version_staging",
    "definition": "CREATE UNIQUE INDEX skill_version_staging_idempotency_key_key ON skill_registry.skill_version_staging USING btree (idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_version_staging_object_access_decision_ref_key",
    "table_name": "skill_version_staging",
    "definition": "CREATE UNIQUE INDEX skill_version_staging_object_access_decision_ref_key ON skill_registry.skill_version_staging USING btree (object_access_decision_ref)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_version_staging_pkey",
    "table_name": "skill_version_staging",
    "definition": "CREATE UNIQUE INDEX skill_version_staging_pkey ON skill_registry.skill_version_staging USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "skill_version_staging_skill_id_skill_name_proposed_version__key",
    "table_name": "skill_version_staging",
    "definition": "CREATE UNIQUE INDEX skill_version_staging_skill_id_skill_name_proposed_version__key ON skill_registry.skill_version_staging USING btree (skill_id, skill_name, proposed_version, package_digest)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_version_staging_status_idx",
    "table_name": "skill_version_staging",
    "definition": "CREATE INDEX skill_version_staging_status_idx ON skill_registry.skill_version_staging USING btree (status, updated_at)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_versions_id_skill_id_key",
    "table_name": "skill_versions",
    "definition": "CREATE UNIQUE INDEX skill_versions_id_skill_id_key ON skill_registry.skill_versions USING btree (id, skill_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_versions_lookup_idx",
    "table_name": "skill_versions",
    "definition": "CREATE INDEX skill_versions_lookup_idx ON skill_registry.skill_versions USING btree (skill_id, lifecycle_state, created_at DESC)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_versions_pkey",
    "table_name": "skill_versions",
    "definition": "CREATE UNIQUE INDEX skill_versions_pkey ON skill_registry.skill_versions USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "skill_versions_skill_id_package_digest_key",
    "table_name": "skill_versions",
    "definition": "CREATE UNIQUE INDEX skill_versions_skill_id_package_digest_key ON skill_registry.skill_versions USING btree (skill_id, package_digest)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_versions_skill_id_version_key",
    "table_name": "skill_versions",
    "definition": "CREATE UNIQUE INDEX skill_versions_skill_id_version_key ON skill_registry.skill_versions USING btree (skill_id, version)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skill_versions_validation_id_key",
    "table_name": "skill_versions",
    "definition": "CREATE UNIQUE INDEX skill_versions_validation_id_key ON skill_registry.skill_versions USING btree (validation_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "skills_pkey",
    "table_name": "skills",
    "definition": "CREATE UNIQUE INDEX skills_pkey ON skill_registry.skills USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "skills_skill_key_key",
    "table_name": "skills",
    "definition": "CREATE UNIQUE INDEX skills_skill_key_key ON skill_registry.skills USING btree (skill_key)",
    "unique": true,
    "primary": false,
    "valid": true
  }
] as const;

export const SKILL_REGISTRY_FOREIGN_KEYS_V1 = [
  {
    "constraint_name": "skill_activation_current_activation_revision_id_skill_id_w_fkey",
    "table_name": "skill_activation_current",
    "columns": [
      "activation_revision_id",
      "skill_id",
      "workspace_id",
      "bot_id",
      "deployment_environment",
      "release_channel"
    ],
    "referenced_schema": "skill_registry",
    "referenced_table": "skill_activation_revisions",
    "referenced_columns": [
      "id",
      "skill_id",
      "workspace_id",
      "bot_id",
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
    "constraint_name": "skill_activation_current_skill_id_fkey",
    "table_name": "skill_activation_current",
    "columns": [
      "skill_id"
    ],
    "referenced_schema": "skill_registry",
    "referenced_table": "skills",
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
    "constraint_name": "skill_activation_revisions_previous_revision_id_skill_id_w_fkey",
    "table_name": "skill_activation_revisions",
    "columns": [
      "previous_revision_id",
      "skill_id",
      "workspace_id",
      "bot_id",
      "deployment_environment",
      "release_channel"
    ],
    "referenced_schema": "skill_registry",
    "referenced_table": "skill_activation_revisions",
    "referenced_columns": [
      "id",
      "skill_id",
      "workspace_id",
      "bot_id",
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
    "constraint_name": "skill_activation_revisions_skill_id_fkey",
    "table_name": "skill_activation_revisions",
    "columns": [
      "skill_id"
    ],
    "referenced_schema": "skill_registry",
    "referenced_table": "skills",
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
    "constraint_name": "skill_activation_revisions_version_id_skill_id_fkey",
    "table_name": "skill_activation_revisions",
    "columns": [
      "version_id",
      "skill_id"
    ],
    "referenced_schema": "skill_registry",
    "referenced_table": "skill_versions",
    "referenced_columns": [
      "id",
      "skill_id"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_audit_logs_application_id_fkey",
    "table_name": "skill_audit_logs",
    "columns": [
      "application_id"
    ],
    "referenced_schema": "skill_registry",
    "referenced_table": "skill_candidate_applications",
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
    "constraint_name": "skill_audit_logs_skill_id_fkey",
    "table_name": "skill_audit_logs",
    "columns": [
      "skill_id"
    ],
    "referenced_schema": "skill_registry",
    "referenced_table": "skills",
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
    "constraint_name": "skill_audit_logs_version_id_fkey",
    "table_name": "skill_audit_logs",
    "columns": [
      "version_id"
    ],
    "referenced_schema": "skill_registry",
    "referenced_table": "skill_versions",
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
    "constraint_name": "skill_candidate_applications_staging_version_id_fkey",
    "table_name": "skill_candidate_applications",
    "columns": [
      "staging_version_id"
    ],
    "referenced_schema": "skill_registry",
    "referenced_table": "skill_version_staging",
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
    "constraint_name": "skill_catalog_current_catalog_revision_id_workspace_id_bot_fkey",
    "table_name": "skill_catalog_current",
    "columns": [
      "catalog_revision_id",
      "workspace_id",
      "bot_id",
      "deployment_environment",
      "release_channel"
    ],
    "referenced_schema": "skill_registry",
    "referenced_table": "skill_catalog_revisions",
    "referenced_columns": [
      "id",
      "workspace_id",
      "bot_id",
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
    "constraint_name": "skill_catalog_revision_entrie_activation_revision_id_skill_fkey",
    "table_name": "skill_catalog_revision_entries",
    "columns": [
      "activation_revision_id",
      "skill_id",
      "workspace_id",
      "bot_id",
      "deployment_environment",
      "release_channel"
    ],
    "referenced_schema": "skill_registry",
    "referenced_table": "skill_activation_revisions",
    "referenced_columns": [
      "id",
      "skill_id",
      "workspace_id",
      "bot_id",
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
    "constraint_name": "skill_catalog_revision_entrie_catalog_revision_id_workspac_fkey",
    "table_name": "skill_catalog_revision_entries",
    "columns": [
      "catalog_revision_id",
      "workspace_id",
      "bot_id",
      "deployment_environment",
      "release_channel"
    ],
    "referenced_schema": "skill_registry",
    "referenced_table": "skill_catalog_revisions",
    "referenced_columns": [
      "id",
      "workspace_id",
      "bot_id",
      "deployment_environment",
      "release_channel"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "cascade",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_catalog_revision_entries_skill_id_fkey",
    "table_name": "skill_catalog_revision_entries",
    "columns": [
      "skill_id"
    ],
    "referenced_schema": "skill_registry",
    "referenced_table": "skills",
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
    "constraint_name": "skill_catalog_revision_entries_version_id_skill_id_fkey",
    "table_name": "skill_catalog_revision_entries",
    "columns": [
      "version_id",
      "skill_id"
    ],
    "referenced_schema": "skill_registry",
    "referenced_table": "skill_versions",
    "referenced_columns": [
      "id",
      "skill_id"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_event_dlq_resolutions_dlq_id_fkey",
    "table_name": "skill_event_dlq_resolutions",
    "columns": [
      "dlq_id"
    ],
    "referenced_schema": "skill_registry",
    "referenced_table": "skill_event_dlq",
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
    "constraint_name": "skill_management_commands_skill_id_fkey",
    "table_name": "skill_management_commands",
    "columns": [
      "skill_id"
    ],
    "referenced_schema": "skill_registry",
    "referenced_table": "skills",
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
    "constraint_name": "skill_management_commands_target_version_id_fkey",
    "table_name": "skill_management_commands",
    "columns": [
      "target_version_id"
    ],
    "referenced_schema": "skill_registry",
    "referenced_table": "skill_versions",
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
    "constraint_name": "skill_management_commands_version_id_fkey",
    "table_name": "skill_management_commands",
    "columns": [
      "version_id"
    ],
    "referenced_schema": "skill_registry",
    "referenced_table": "skill_versions",
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
    "constraint_name": "skill_package_retention_holds_package_id_fkey",
    "table_name": "skill_package_retention_holds",
    "columns": [
      "package_id"
    ],
    "referenced_schema": "skill_registry",
    "referenced_table": "skill_packages",
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
    "constraint_name": "skill_package_retention_transitions_package_id_fkey",
    "table_name": "skill_package_retention_transitions",
    "columns": [
      "package_id"
    ],
    "referenced_schema": "skill_registry",
    "referenced_table": "skill_packages",
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
    "constraint_name": "skill_packages_version_id_fkey",
    "table_name": "skill_packages",
    "columns": [
      "version_id"
    ],
    "referenced_schema": "skill_registry",
    "referenced_table": "skill_versions",
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
    "constraint_name": "skill_permission_current_permission_revision_id_skill_id_w_fkey",
    "table_name": "skill_permission_current",
    "columns": [
      "permission_revision_id",
      "skill_id",
      "workspace_id",
      "bot_id",
      "deployment_environment",
      "release_channel",
      "scope_hash"
    ],
    "referenced_schema": "skill_registry",
    "referenced_table": "skill_permission_revisions",
    "referenced_columns": [
      "id",
      "skill_id",
      "workspace_id",
      "bot_id",
      "deployment_environment",
      "release_channel",
      "scope_hash"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_permission_current_skill_id_fkey",
    "table_name": "skill_permission_current",
    "columns": [
      "skill_id"
    ],
    "referenced_schema": "skill_registry",
    "referenced_table": "skills",
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
    "constraint_name": "skill_permission_revisions_previous_revision_id_skill_id_w_fkey",
    "table_name": "skill_permission_revisions",
    "columns": [
      "previous_revision_id",
      "skill_id",
      "workspace_id",
      "bot_id",
      "deployment_environment",
      "release_channel",
      "scope_hash"
    ],
    "referenced_schema": "skill_registry",
    "referenced_table": "skill_permission_revisions",
    "referenced_columns": [
      "id",
      "skill_id",
      "workspace_id",
      "bot_id",
      "deployment_environment",
      "release_channel",
      "scope_hash"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_permission_revisions_skill_id_fkey",
    "table_name": "skill_permission_revisions",
    "columns": [
      "skill_id"
    ],
    "referenced_schema": "skill_registry",
    "referenced_table": "skills",
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
    "constraint_name": "skill_permission_summary_entries_skill_id_fkey",
    "table_name": "skill_permission_summary_entries",
    "columns": [
      "skill_id"
    ],
    "referenced_schema": "skill_registry",
    "referenced_table": "skills",
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
    "constraint_name": "skill_permission_summary_entries_summary_ref_fkey",
    "table_name": "skill_permission_summary_entries",
    "columns": [
      "summary_ref"
    ],
    "referenced_schema": "skill_registry",
    "referenced_table": "skill_permission_summary_snapshots",
    "referenced_columns": [
      "summary_ref"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "restrict",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_permission_summary_snap_catalog_revision_id_workspac_fkey",
    "table_name": "skill_permission_summary_snapshots",
    "columns": [
      "catalog_revision_id",
      "workspace_id",
      "bot_id",
      "deployment_environment",
      "release_channel"
    ],
    "referenced_schema": "skill_registry",
    "referenced_table": "skill_catalog_revisions",
    "referenced_columns": [
      "id",
      "workspace_id",
      "bot_id",
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
    "constraint_name": "skill_resolution_attempt_summary_fk",
    "table_name": "skill_resolution_attempts",
    "columns": [
      "skill_permission_summary_ref",
      "skill_permission_summary_hash"
    ],
    "referenced_schema": "skill_registry",
    "referenced_table": "skill_permission_summary_snapshots",
    "referenced_columns": [
      "summary_ref",
      "summary_hash"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_resolutions_resolution_attempt_id_runtime_run_id_sta_fkey",
    "table_name": "skill_resolutions",
    "columns": [
      "resolution_attempt_id",
      "runtime_run_id",
      "start_attempt_no"
    ],
    "referenced_schema": "skill_registry",
    "referenced_table": "skill_resolution_attempts",
    "referenced_columns": [
      "id",
      "runtime_run_id",
      "start_attempt_no"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_resolutions_skill_id_fkey",
    "table_name": "skill_resolutions",
    "columns": [
      "skill_id"
    ],
    "referenced_schema": "skill_registry",
    "referenced_table": "skills",
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
    "constraint_name": "skill_resolutions_version_id_skill_id_fkey",
    "table_name": "skill_resolutions",
    "columns": [
      "version_id",
      "skill_id"
    ],
    "referenced_schema": "skill_registry",
    "referenced_table": "skill_versions",
    "referenced_columns": [
      "id",
      "skill_id"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "skill_validation_attempts_validation_id_fkey",
    "table_name": "skill_validation_attempts",
    "columns": [
      "validation_id"
    ],
    "referenced_schema": "skill_registry",
    "referenced_table": "skill_version_staging",
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
    "constraint_name": "skill_version_staging_skill_id_fkey",
    "table_name": "skill_version_staging",
    "columns": [
      "skill_id"
    ],
    "referenced_schema": "skill_registry",
    "referenced_table": "skills",
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
    "constraint_name": "skill_versions_skill_id_fkey",
    "table_name": "skill_versions",
    "columns": [
      "skill_id"
    ],
    "referenced_schema": "skill_registry",
    "referenced_table": "skills",
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
    "constraint_name": "skill_versions_validation_id_skill_id_fkey",
    "table_name": "skill_versions",
    "columns": [
      "validation_id",
      "skill_id"
    ],
    "referenced_schema": "skill_registry",
    "referenced_table": "skill_version_staging",
    "referenced_columns": [
      "id",
      "skill_id"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  }
] as const;
