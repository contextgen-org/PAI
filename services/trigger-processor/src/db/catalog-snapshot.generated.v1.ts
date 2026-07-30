// Generated from a fresh revision-pinned pai-infra PostgreSQL catalog. Do not edit.
export const TRIGGER_PROCESSOR_DATABASE_COLUMNS_V1 = [
  {
    "table_name": "bot_foreground_slots",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bot_foreground_slots",
    "column_name": "process_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bot_foreground_slots",
    "column_name": "slot_generation",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "bot_foreground_slots",
    "column_name": "acquired_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "bot_foreground_slots",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "bot_intent_policy_audit_logs",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bot_intent_policy_audit_logs",
    "column_name": "workspace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bot_intent_policy_audit_logs",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bot_intent_policy_audit_logs",
    "column_name": "owner_agent_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bot_intent_policy_audit_logs",
    "column_name": "deployment_environment",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bot_intent_policy_audit_logs",
    "column_name": "release_channel",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bot_intent_policy_audit_logs",
    "column_name": "action",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bot_intent_policy_audit_logs",
    "column_name": "revision_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bot_intent_policy_audit_logs",
    "column_name": "actor_principal_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bot_intent_policy_audit_logs",
    "column_name": "payload",
    "not_null": true,
    "default_expression": "'{}'::jsonb",
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "bot_intent_policy_audit_logs",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "bot_intent_policy_current",
    "column_name": "workspace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bot_intent_policy_current",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bot_intent_policy_current",
    "column_name": "owner_agent_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bot_intent_policy_current",
    "column_name": "deployment_environment",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bot_intent_policy_current",
    "column_name": "release_channel",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bot_intent_policy_current",
    "column_name": "bot_policy_revision_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bot_intent_policy_current",
    "column_name": "current_revision_no",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "bot_intent_policy_current",
    "column_name": "pointer_version",
    "not_null": true,
    "default_expression": "1",
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "bot_intent_policy_current",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "bot_intent_policy_revisions",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bot_intent_policy_revisions",
    "column_name": "workspace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bot_intent_policy_revisions",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bot_intent_policy_revisions",
    "column_name": "owner_agent_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bot_intent_policy_revisions",
    "column_name": "deployment_environment",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bot_intent_policy_revisions",
    "column_name": "release_channel",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bot_intent_policy_revisions",
    "column_name": "revision_no",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "bot_intent_policy_revisions",
    "column_name": "personality_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bot_intent_policy_revisions",
    "column_name": "personality_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "bot_intent_policy_revisions",
    "column_name": "personality_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bot_intent_policy_revisions",
    "column_name": "safety_boundaries_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bot_intent_policy_revisions",
    "column_name": "safety_boundaries_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "bot_intent_policy_revisions",
    "column_name": "safety_boundaries_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bot_intent_policy_revisions",
    "column_name": "effective_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "bot_intent_policy_revisions",
    "column_name": "created_by_principal",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bot_intent_policy_revisions",
    "column_name": "change_reason",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bot_intent_policy_revisions",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "bot_permission_bindings",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bot_permission_bindings",
    "column_name": "workspace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bot_permission_bindings",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bot_permission_bindings",
    "column_name": "principal_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bot_permission_bindings",
    "column_name": "principal_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bot_permission_bindings",
    "column_name": "deployment_environment",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bot_permission_bindings",
    "column_name": "release_channel",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bot_permission_bindings",
    "column_name": "permission_scope",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bot_permission_bindings",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bot_permission_bindings",
    "column_name": "source_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bot_permission_bindings",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "bot_permission_bindings",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "bot_permission_bindings",
    "column_name": "owner_agent_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bots",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bots",
    "column_name": "workspace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bots",
    "column_name": "owner_agent_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bots",
    "column_name": "deployment_environment",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bots",
    "column_name": "release_channel",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bots",
    "column_name": "name",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bots",
    "column_name": "super_user_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bots",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bots",
    "column_name": "timezone",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bots",
    "column_name": "locale",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "bots",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "bots",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
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
    "table_name": "intent_policy_snapshots",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "intent_policy_snapshots",
    "column_name": "schema_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "intent_policy_snapshots",
    "column_name": "trigger_process_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "intent_policy_snapshots",
    "column_name": "intent_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "intent_policy_snapshots",
    "column_name": "workspace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "intent_policy_snapshots",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "intent_policy_snapshots",
    "column_name": "owner_agent_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "intent_policy_snapshots",
    "column_name": "deployment_environment",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "intent_policy_snapshots",
    "column_name": "release_channel",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "intent_policy_snapshots",
    "column_name": "bot_policy_revision_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "intent_policy_snapshots",
    "column_name": "bot_policy_revision_no",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "intent_policy_snapshots",
    "column_name": "personality_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "intent_policy_snapshots",
    "column_name": "personality_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "intent_policy_snapshots",
    "column_name": "personality_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "intent_policy_snapshots",
    "column_name": "safety_boundaries_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "intent_policy_snapshots",
    "column_name": "safety_boundaries_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "intent_policy_snapshots",
    "column_name": "safety_boundaries_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "intent_policy_snapshots",
    "column_name": "tool_permission_profile_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "intent_policy_snapshots",
    "column_name": "tool_permission_profile_revision",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "intent_policy_snapshots",
    "column_name": "tool_permission_profile_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "intent_policy_snapshots",
    "column_name": "tool_policy_epoch",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "intent_policy_snapshots",
    "column_name": "catalog_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "intent_policy_snapshots",
    "column_name": "catalog_as_of",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "intent_policy_snapshots",
    "column_name": "security_revocation_epoch",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "intent_policy_snapshots",
    "column_name": "skill_permission_summary_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "intent_policy_snapshots",
    "column_name": "skill_permission_summary_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "intent_policy_snapshots",
    "column_name": "canonical_bytes",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bytea"
  },
  {
    "table_name": "intent_policy_snapshots",
    "column_name": "snapshot_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "intent_policy_snapshots",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_start_reservations",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_reservations",
    "column_name": "trigger_process_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_reservations",
    "column_name": "start_attempt_no",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "runtime_start_reservations",
    "column_name": "reserved_runtime_run_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_reservations",
    "column_name": "start_fence_generation",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "runtime_start_reservations",
    "column_name": "start_fence_token_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_reservations",
    "column_name": "request_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_reservations",
    "column_name": "policy_schema_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_reservations",
    "column_name": "policy_input_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_reservations",
    "column_name": "policy_input_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_reservations",
    "column_name": "policy_canonical_bytes",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bytea"
  },
  {
    "table_name": "runtime_start_reservations",
    "column_name": "policy_input_created_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_start_reservations",
    "column_name": "policy_expires_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_start_reservations",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_reservations",
    "column_name": "claimed_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_start_reservations",
    "column_name": "cancel_requested_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_start_reservations",
    "column_name": "cancelled_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_start_reservations",
    "column_name": "started_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_start_reservations",
    "column_name": "completed_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_start_reservations",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_start_reservations",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "runtime_start_reservations",
    "column_name": "intent_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "runtime_start_reservations",
    "column_name": "intent_policy_snapshot_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_reservations",
    "column_name": "intent_policy_snapshot_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_reservations",
    "column_name": "confirmation_ref",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "runtime_start_reservations",
    "column_name": "confirmation_hash",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_command_dlq",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_command_dlq",
    "column_name": "source_command_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_command_dlq",
    "column_name": "command_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_command_dlq",
    "column_name": "target",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_command_dlq",
    "column_name": "payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "trigger_command_dlq",
    "column_name": "request_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_command_dlq",
    "column_name": "last_error",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "trigger_command_dlq",
    "column_name": "failed_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_command_dlq_resolutions",
    "column_name": "resolution_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_command_dlq_resolutions",
    "column_name": "dlq_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_command_dlq_resolutions",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_command_dlq_resolutions",
    "column_name": "resolution_kind",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_command_dlq_resolutions",
    "column_name": "resolution_payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "trigger_command_dlq_resolutions",
    "column_name": "resolved_by",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_command_dlq_resolutions",
    "column_name": "resolved_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_command_outbox",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_command_outbox",
    "column_name": "aggregate_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_command_outbox",
    "column_name": "command_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_command_outbox",
    "column_name": "schema_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_command_outbox",
    "column_name": "producer",
    "not_null": true,
    "default_expression": "'trigger_processor'::text",
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_command_outbox",
    "column_name": "target",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_command_outbox",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_command_outbox",
    "column_name": "request_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_command_outbox",
    "column_name": "trace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_command_outbox",
    "column_name": "payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "trigger_command_outbox",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_command_outbox",
    "column_name": "attempt_count",
    "not_null": true,
    "default_expression": "0",
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "trigger_command_outbox",
    "column_name": "next_retry_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_command_outbox",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_command_outbox",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_command_outbox",
    "column_name": "claimed_by",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_command_outbox",
    "column_name": "claim_token",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_command_outbox",
    "column_name": "acknowledged_claim_token",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_command_outbox",
    "column_name": "locked_until",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_command_outbox",
    "column_name": "last_error",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "trigger_command_outbox",
    "column_name": "transport_ref",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_command_outbox",
    "column_name": "transport_epoch",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_command_outbox",
    "column_name": "transport_generation",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "trigger_command_outbox",
    "column_name": "sent_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_confirmation_challenges",
    "column_name": "challenge_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_confirmation_challenges",
    "column_name": "trigger_process_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_confirmation_challenges",
    "column_name": "workspace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_confirmation_challenges",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_confirmation_challenges",
    "column_name": "owner_agent_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_confirmation_challenges",
    "column_name": "deployment_environment",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_confirmation_challenges",
    "column_name": "release_channel",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_confirmation_challenges",
    "column_name": "intent_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_confirmation_challenges",
    "column_name": "intent_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "trigger_confirmation_challenges",
    "column_name": "structured_intent_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_confirmation_challenges",
    "column_name": "policy_input_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_confirmation_challenges",
    "column_name": "action_step_ids",
    "not_null": true,
    "default_expression": "'{}'::text[]",
    "identity": "",
    "generated": "",
    "postgres_type": "text[]"
  },
  {
    "table_name": "trigger_confirmation_challenges",
    "column_name": "allowed_principal_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_confirmation_challenges",
    "column_name": "allowed_principal_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_confirmation_challenges",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_confirmation_challenges",
    "column_name": "expires_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_confirmation_challenges",
    "column_name": "response_hash",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_confirmation_challenges",
    "column_name": "idempotency_key",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_confirmation_challenges",
    "column_name": "responded_by",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_confirmation_challenges",
    "column_name": "responded_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_confirmation_challenges",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_confirmation_challenges",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_confirmation_challenges",
    "column_name": "request_hash",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_confirmation_challenges",
    "column_name": "confirmation_hash",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_confirmation_challenges",
    "column_name": "response_payload",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "trigger_confirmation_challenges",
    "column_name": "stage_execute_work_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_context_source_outcomes",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_context_source_outcomes",
    "column_name": "trigger_process_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_context_source_outcomes",
    "column_name": "context_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "trigger_context_source_outcomes",
    "column_name": "source",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_context_source_outcomes",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_context_source_outcomes",
    "column_name": "source_owner",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_context_source_outcomes",
    "column_name": "source_version",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_context_source_outcomes",
    "column_name": "policy_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_context_source_outcomes",
    "column_name": "reason_code",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_context_source_outcomes",
    "column_name": "retrieved_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_context_source_outcomes",
    "column_name": "source_as_of",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_context_source_outcomes",
    "column_name": "latency_ms",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "trigger_context_source_outcomes",
    "column_name": "result_count",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "trigger_context_source_outcomes",
    "column_name": "failure_reason",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_context_source_outcomes",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_event_dlq",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_event_dlq",
    "column_name": "source_event_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_event_dlq",
    "column_name": "event_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_event_dlq",
    "column_name": "payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "trigger_event_dlq",
    "column_name": "last_error",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "trigger_event_dlq",
    "column_name": "failed_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_event_dlq_resolutions",
    "column_name": "resolution_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_event_dlq_resolutions",
    "column_name": "dlq_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_event_dlq_resolutions",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_event_dlq_resolutions",
    "column_name": "resolution_kind",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_event_dlq_resolutions",
    "column_name": "resolution_payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "trigger_event_dlq_resolutions",
    "column_name": "resolved_by",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_event_dlq_resolutions",
    "column_name": "resolved_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_event_inbox",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_event_inbox",
    "column_name": "source",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_event_inbox",
    "column_name": "event_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_event_inbox",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_event_inbox",
    "column_name": "payload_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_event_inbox",
    "column_name": "semantic_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_event_inbox",
    "column_name": "scope_fingerprint",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_event_inbox",
    "column_name": "processed_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_event_inbox",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_event_outbox",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_event_outbox",
    "column_name": "aggregate_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_event_outbox",
    "column_name": "event_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_event_outbox",
    "column_name": "schema_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_event_outbox",
    "column_name": "producer",
    "not_null": true,
    "default_expression": "'trigger_processor'::text",
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_event_outbox",
    "column_name": "occurred_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_event_outbox",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_event_outbox",
    "column_name": "trace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_event_outbox",
    "column_name": "payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "trigger_event_outbox",
    "column_name": "payload_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_event_outbox",
    "column_name": "target",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_event_outbox",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_event_outbox",
    "column_name": "attempt_count",
    "not_null": true,
    "default_expression": "0",
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "trigger_event_outbox",
    "column_name": "next_retry_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_event_outbox",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_event_outbox",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_event_outbox",
    "column_name": "claimed_by",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_event_outbox",
    "column_name": "claim_token",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_event_outbox",
    "column_name": "acknowledged_claim_token",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_event_outbox",
    "column_name": "locked_until",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_event_outbox",
    "column_name": "last_error",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "trigger_event_outbox",
    "column_name": "transport_ref",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_event_outbox",
    "column_name": "transport_epoch",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_event_outbox",
    "column_name": "transport_generation",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "trigger_event_outbox",
    "column_name": "sent_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_event_outbox",
    "column_name": "reconciliation_missing_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_event_outbox",
    "column_name": "reconciliation_missing_reporter",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_event_outbox",
    "column_name": "reconciliation_next_probe_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_event_outbox",
    "column_name": "reconciliation_claimed_by",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_event_outbox",
    "column_name": "reconciliation_claim_token",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_event_outbox",
    "column_name": "reconciliation_claim_generation",
    "not_null": false,
    "default_expression": "0",
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "trigger_event_outbox",
    "column_name": "reconciliation_locked_until",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_process_cancel_requests",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_cancel_requests",
    "column_name": "trigger_process_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_cancel_requests",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_cancel_requests",
    "column_name": "request_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_cancel_requests",
    "column_name": "reason_code",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_cancel_requests",
    "column_name": "actor_principal_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_cancel_requests",
    "column_name": "actor_role",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_cancel_requests",
    "column_name": "actor_auth_context_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_cancel_requests",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_cancel_requests",
    "column_name": "runtime_signal_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_cancel_requests",
    "column_name": "fencing_generation",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "trigger_process_cancel_requests",
    "column_name": "stopped_at_safe_point",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "boolean"
  },
  {
    "table_name": "trigger_process_cancel_requests",
    "column_name": "isolation_status",
    "not_null": true,
    "default_expression": "'pending'::text",
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_cancel_requests",
    "column_name": "isolation_proof_ref",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_cancel_requests",
    "column_name": "result_payload",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "trigger_process_cancel_requests",
    "column_name": "trace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_cancel_requests",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_process_cancel_requests",
    "column_name": "completed_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_process_event_projections",
    "column_name": "trigger_process_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_event_projections",
    "column_name": "append_sequence_no",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "trigger_process_event_projections",
    "column_name": "event_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_event_projections",
    "column_name": "event_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_event_projections",
    "column_name": "schema_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_event_projections",
    "column_name": "observation_summary",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "trigger_process_event_projections",
    "column_name": "trace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_event_projections",
    "column_name": "occurred_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_process_event_projections",
    "column_name": "retention_until",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_process_event_projections",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_process_meta_projections",
    "column_name": "trigger_process_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_meta_projections",
    "column_name": "meta_job_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_meta_projections",
    "column_name": "meta_status",
    "not_null": true,
    "default_expression": "'not_enqueued'::text",
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_meta_projections",
    "column_name": "meta_enqueue_reason",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_meta_projections",
    "column_name": "meta_result_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_meta_projections",
    "column_name": "result_version",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "trigger_process_meta_projections",
    "column_name": "result_status",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_meta_projections",
    "column_name": "meta_summary_ref",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_meta_projections",
    "column_name": "projection_version",
    "not_null": true,
    "default_expression": "0",
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "trigger_process_meta_projections",
    "column_name": "last_meta_event_sequence",
    "not_null": true,
    "default_expression": "0",
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "trigger_process_meta_projections",
    "column_name": "last_meta_event_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_meta_projections",
    "column_name": "last_result_event_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_meta_projections",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_process_meta_projections",
    "column_name": "result_finalized_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_process_meta_projections",
    "column_name": "active_compensation_count",
    "not_null": true,
    "default_expression": "0",
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "trigger_process_meta_projections",
    "column_name": "active_repair_count",
    "not_null": true,
    "default_expression": "0",
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "trigger_process_meta_projections",
    "column_name": "observation_finalized",
    "not_null": true,
    "default_expression": "false",
    "identity": "",
    "generated": "",
    "postgres_type": "boolean"
  },
  {
    "table_name": "trigger_process_meta_projections",
    "column_name": "observation_finalized_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_process_snapshots",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_snapshots",
    "column_name": "trigger_process_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_snapshots",
    "column_name": "workspace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_snapshots",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_snapshots",
    "column_name": "owner_agent_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_snapshots",
    "column_name": "deployment_environment",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_snapshots",
    "column_name": "release_channel",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_snapshots",
    "column_name": "schema_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_snapshots",
    "column_name": "snapshot_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "trigger_process_snapshots",
    "column_name": "snapshot_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_snapshots",
    "column_name": "snapshot_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_snapshots",
    "column_name": "context_snapshot_ref",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_snapshots",
    "column_name": "intent_ref",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_snapshots",
    "column_name": "runtime_run_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_snapshots",
    "column_name": "runtime_state",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_snapshots",
    "column_name": "cooldown_until",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_process_snapshots",
    "column_name": "policy_snapshot_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_snapshots",
    "column_name": "personality_ref",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_snapshots",
    "column_name": "personality_version",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "trigger_process_snapshots",
    "column_name": "personality_hash",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_snapshots",
    "column_name": "first_append_sequence_no",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "trigger_process_snapshots",
    "column_name": "last_append_sequence_no",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "trigger_process_snapshots",
    "column_name": "last_sequence_by_source",
    "not_null": true,
    "default_expression": "'{}'::jsonb",
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "trigger_process_snapshots",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_snapshots",
    "column_name": "retention_until",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_process_snapshots",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_process_snapshots",
    "column_name": "superseded_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_process_snapshots",
    "column_name": "context_snapshot_version",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "trigger_process_snapshots",
    "column_name": "context_snapshot_hash",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_transitions",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_transitions",
    "column_name": "trigger_process_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_transitions",
    "column_name": "from_phase",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_transitions",
    "column_name": "to_phase",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_transitions",
    "column_name": "from_status",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_transitions",
    "column_name": "to_status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_transitions",
    "column_name": "reason",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_transitions",
    "column_name": "actor",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_transitions",
    "column_name": "source_ref",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_transitions",
    "column_name": "evidence_refs",
    "not_null": true,
    "default_expression": "'{}'::text[]",
    "identity": "",
    "generated": "",
    "postgres_type": "text[]"
  },
  {
    "table_name": "trigger_process_transitions",
    "column_name": "previous_state",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "trigger_process_transitions",
    "column_name": "next_state",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "trigger_process_transitions",
    "column_name": "schema_version",
    "not_null": true,
    "default_expression": "'v1'::text",
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_transitions",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_process_transitions",
    "column_name": "reason_code",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_transitions",
    "column_name": "previous_state_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "trigger_process_transitions",
    "column_name": "resulting_state_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "trigger_process_work_items",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_work_items",
    "column_name": "trigger_process_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_work_items",
    "column_name": "workspace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_work_items",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_work_items",
    "column_name": "owner_agent_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_work_items",
    "column_name": "deployment_environment",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_work_items",
    "column_name": "release_channel",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_work_items",
    "column_name": "work_kind",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_work_items",
    "column_name": "schema_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_work_items",
    "column_name": "expected_process_state_version",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "trigger_process_work_items",
    "column_name": "payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "trigger_process_work_items",
    "column_name": "payload_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_work_items",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_work_items",
    "column_name": "attempt_count",
    "not_null": true,
    "default_expression": "0",
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "trigger_process_work_items",
    "column_name": "next_retry_at",
    "not_null": true,
    "default_expression": "clock_timestamp()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_process_work_items",
    "column_name": "last_error",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "trigger_process_work_items",
    "column_name": "lease_owner",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_work_items",
    "column_name": "lease_token_hash",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_work_items",
    "column_name": "lease_generation",
    "not_null": true,
    "default_expression": "0",
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "trigger_process_work_items",
    "column_name": "lease_until",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_process_work_items",
    "column_name": "ack_result_hash",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_work_items",
    "column_name": "completed_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_process_work_items",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_work_items",
    "column_name": "trace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_process_work_items",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "clock_timestamp()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_process_work_items",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "clock_timestamp()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "trigger_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "workspace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "owner_agent_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "deployment_environment",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "release_channel",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "phase",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "wait_reason",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "current_runtime_run_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "runtime_start_attempt_no",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "runtime_policy_created_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "runtime_policy_expires_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "inherited_from_process_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "blocked_by_process_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "canonical_process_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "preempted_by_process_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "preempt_commit_result",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "preempt_isolation_proof_ref",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "merged_into_process_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "merged_into_queue_item_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "terminal_reason",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "terminal_outcome",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "cancel_requested_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "cancellation_status",
    "not_null": true,
    "default_expression": "'none'::text",
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "cancel_reason_code",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "cancel_actor_principal_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "cancel_actor_role",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "runtime_cancel_signal_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "cancellation_isolation_status",
    "not_null": true,
    "default_expression": "'none'::text",
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "cancelled_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "cooldown_until",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "snapshot_retention_until",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "context_snapshot_ref",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "intent_ref",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "current_reason_code",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "current_snapshot_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "context_snapshot_version",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "context_snapshot_hash",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "context_snapshot_retention_until",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "priority",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "admission_time",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "terminal_outcome_finalized_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "successor_process_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "superseded_by_process_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "snapshot_transfer_ref",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "boundary_system_event_ref",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "canonical_reason_code",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "state_version",
    "not_null": true,
    "default_expression": "1",
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "observation_finalized",
    "not_null": true,
    "default_expression": "false",
    "identity": "",
    "generated": "",
    "postgres_type": "boolean"
  },
  {
    "table_name": "trigger_processes",
    "column_name": "meta_enqueue_reason",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_snapshot_append_audits",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_snapshot_append_audits",
    "column_name": "trigger_process_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_snapshot_append_audits",
    "column_name": "snapshot_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_snapshot_append_audits",
    "column_name": "source_service",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_snapshot_append_audits",
    "column_name": "source_event_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_snapshot_append_audits",
    "column_name": "source_sequence_no",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "trigger_snapshot_append_audits",
    "column_name": "append_sequence_no",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "trigger_snapshot_append_audits",
    "column_name": "previous_snapshot_version",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "trigger_snapshot_append_audits",
    "column_name": "next_snapshot_version",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "trigger_snapshot_append_audits",
    "column_name": "previous_snapshot_hash",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_snapshot_append_audits",
    "column_name": "next_snapshot_hash",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_snapshot_append_audits",
    "column_name": "result",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_snapshot_append_audits",
    "column_name": "error",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "trigger_snapshot_append_audits",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_snapshot_append_audits",
    "column_name": "missing_source_sequence_range",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "int8range"
  },
  {
    "table_name": "trigger_snapshot_append_audits",
    "column_name": "late_event_disposition",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_snapshot_append_cursors",
    "column_name": "trigger_process_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_snapshot_append_cursors",
    "column_name": "last_append_sequence_no",
    "not_null": true,
    "default_expression": "0",
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "trigger_snapshot_append_cursors",
    "column_name": "last_sequence_by_source",
    "not_null": true,
    "default_expression": "'{}'::jsonb",
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "trigger_snapshot_append_cursors",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_snapshot_overflow_refs",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_snapshot_overflow_refs",
    "column_name": "snapshot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_snapshot_overflow_refs",
    "column_name": "source_service",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_snapshot_overflow_refs",
    "column_name": "store_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_snapshot_overflow_refs",
    "column_name": "object_ref",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_snapshot_overflow_refs",
    "column_name": "first_append_sequence_no",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "trigger_snapshot_overflow_refs",
    "column_name": "last_append_sequence_no",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "trigger_snapshot_overflow_refs",
    "column_name": "first_source_sequence_no",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "trigger_snapshot_overflow_refs",
    "column_name": "last_source_sequence_no",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "trigger_snapshot_overflow_refs",
    "column_name": "checksum",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_snapshot_overflow_refs",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_snapshot_overflow_refs",
    "column_name": "schema_version",
    "not_null": true,
    "default_expression": "'snapshot_overflow_ref.v1'::text",
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_snapshot_overflow_refs",
    "column_name": "checksum_algorithm",
    "not_null": true,
    "default_expression": "'sha256'::text",
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_snapshot_overflow_refs",
    "column_name": "retention_until",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_snapshot_overflow_refs",
    "column_name": "redaction_state",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_snapshot_pending_events",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_snapshot_pending_events",
    "column_name": "trigger_process_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_snapshot_pending_events",
    "column_name": "source_service",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_snapshot_pending_events",
    "column_name": "source_event_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_snapshot_pending_events",
    "column_name": "source_sequence_no",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "bigint"
  },
  {
    "table_name": "trigger_snapshot_pending_events",
    "column_name": "append_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_snapshot_pending_events",
    "column_name": "payload_ref",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_snapshot_pending_events",
    "column_name": "payload_hash",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_snapshot_pending_events",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_snapshot_pending_events",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_snapshot_pending_events",
    "column_name": "attempt_count",
    "not_null": true,
    "default_expression": "0",
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "trigger_snapshot_pending_events",
    "column_name": "next_retry_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_snapshot_pending_events",
    "column_name": "last_error",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "trigger_snapshot_pending_events",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_snapshot_pending_events",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_snapshot_repair_jobs",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_snapshot_repair_jobs",
    "column_name": "trigger_process_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_snapshot_repair_jobs",
    "column_name": "repair_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_snapshot_repair_jobs",
    "column_name": "idempotency_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_snapshot_repair_jobs",
    "column_name": "request_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_snapshot_repair_jobs",
    "column_name": "previous_snapshot_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_snapshot_repair_jobs",
    "column_name": "next_snapshot_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_snapshot_repair_jobs",
    "column_name": "meta_job_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_snapshot_repair_jobs",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_snapshot_repair_jobs",
    "column_name": "attempt_count",
    "not_null": true,
    "default_expression": "0",
    "identity": "",
    "generated": "",
    "postgres_type": "integer"
  },
  {
    "table_name": "trigger_snapshot_repair_jobs",
    "column_name": "next_retry_at",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_snapshot_repair_jobs",
    "column_name": "last_error",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "trigger_snapshot_repair_jobs",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_snapshot_repair_jobs",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "trigger_submit_attempts",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_submit_attempts",
    "column_name": "claimed_workspace_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_submit_attempts",
    "column_name": "claimed_bot_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_submit_attempts",
    "column_name": "claimed_owner_agent_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_submit_attempts",
    "column_name": "claimed_deployment_environment",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_submit_attempts",
    "column_name": "claimed_release_channel",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_submit_attempts",
    "column_name": "claimed_source",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_submit_attempts",
    "column_name": "claimed_actor_type",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_submit_attempts",
    "column_name": "claimed_actor_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_submit_attempts",
    "column_name": "claimed_dedupe_key",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_submit_attempts",
    "column_name": "request_hash",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_submit_attempts",
    "column_name": "canonical_audit_hash",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_submit_attempts",
    "column_name": "verified_principal_type",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_submit_attempts",
    "column_name": "verified_principal_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_submit_attempts",
    "column_name": "verified_workload_issuer",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_submit_attempts",
    "column_name": "verified_workload_subject",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_submit_attempts",
    "column_name": "verified_workload_kid",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_submit_attempts",
    "column_name": "verified_workspace_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_submit_attempts",
    "column_name": "verified_bot_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_submit_attempts",
    "column_name": "verified_owner_agent_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_submit_attempts",
    "column_name": "verified_deployment_environment",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_submit_attempts",
    "column_name": "verified_release_channel",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_submit_attempts",
    "column_name": "verified_permission_scope",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_submit_attempts",
    "column_name": "stage",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_submit_attempts",
    "column_name": "outcome",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_submit_attempts",
    "column_name": "result_code",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_submit_attempts",
    "column_name": "retryable",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "boolean"
  },
  {
    "table_name": "trigger_submit_attempts",
    "column_name": "trigger_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_submit_attempts",
    "column_name": "trace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "trigger_submit_attempts",
    "column_name": "audit_payload",
    "not_null": true,
    "default_expression": "'{}'::jsonb",
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "trigger_submit_attempts",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "triggers",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "triggers",
    "column_name": "workspace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "triggers",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "triggers",
    "column_name": "owner_agent_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "triggers",
    "column_name": "deployment_environment",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "triggers",
    "column_name": "release_channel",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "triggers",
    "column_name": "source",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "triggers",
    "column_name": "actor_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "triggers",
    "column_name": "actor_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "triggers",
    "column_name": "payload",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "jsonb"
  },
  {
    "table_name": "triggers",
    "column_name": "dedupe_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "triggers",
    "column_name": "request_hash",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "triggers",
    "column_name": "priority",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "triggers",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "triggers",
    "column_name": "received_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "triggers",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "weak_trigger_groups",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "weak_trigger_groups",
    "column_name": "workspace_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "weak_trigger_groups",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "weak_trigger_groups",
    "column_name": "owner_agent_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "weak_trigger_groups",
    "column_name": "deployment_environment",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "weak_trigger_groups",
    "column_name": "release_channel",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "weak_trigger_groups",
    "column_name": "source",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "weak_trigger_groups",
    "column_name": "actor_type",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "weak_trigger_groups",
    "column_name": "actor_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "weak_trigger_groups",
    "column_name": "normalized_topic_hint",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "weak_trigger_groups",
    "column_name": "cooldown_process_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "weak_trigger_groups",
    "column_name": "merge_group_key",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "weak_trigger_groups",
    "column_name": "first_item_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "weak_trigger_groups",
    "column_name": "merge_window_until",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "weak_trigger_groups",
    "column_name": "max_queue_age_expires_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "weak_trigger_groups",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "weak_trigger_groups",
    "column_name": "canonical_process_id",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "weak_trigger_groups",
    "column_name": "summary",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "weak_trigger_groups",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "weak_trigger_groups",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "weak_trigger_queue_items",
    "column_name": "id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "weak_trigger_queue_items",
    "column_name": "bot_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "weak_trigger_queue_items",
    "column_name": "trigger_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "weak_trigger_queue_items",
    "column_name": "weak_group_id",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "weak_trigger_queue_items",
    "column_name": "available_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "weak_trigger_queue_items",
    "column_name": "expires_at",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "weak_trigger_queue_items",
    "column_name": "status",
    "not_null": true,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "weak_trigger_queue_items",
    "column_name": "summary",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "weak_trigger_queue_items",
    "column_name": "original_trigger_ids",
    "not_null": true,
    "default_expression": "'{}'::text[]",
    "identity": "",
    "generated": "",
    "postgres_type": "text[]"
  },
  {
    "table_name": "weak_trigger_queue_items",
    "column_name": "locked_by",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "text"
  },
  {
    "table_name": "weak_trigger_queue_items",
    "column_name": "locked_until",
    "not_null": false,
    "default_expression": null,
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "weak_trigger_queue_items",
    "column_name": "created_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  },
  {
    "table_name": "weak_trigger_queue_items",
    "column_name": "updated_at",
    "not_null": true,
    "default_expression": "now()",
    "identity": "",
    "generated": "",
    "postgres_type": "timestamp with time zone"
  }
] as const;

export const TRIGGER_PROCESSOR_DATABASE_CHECKS_V1 = [
  {
    "constraint_name": "bot_foreground_slots_generation_safe_check",
    "table_name": "bot_foreground_slots",
    "required_definition_fragments": [
      "CHECK (slot_generation >= 1 AND slot_generation <= '9007199254740991'::bigint)"
    ],
    "semantic_constraint": {
      "kind": "integer_range",
      "column_name": "slot_generation",
      "min": 1,
      "max": 9007199254740991
    }
  },
  {
    "constraint_name": "bot_intent_policy_audit_logs_action_check",
    "table_name": "bot_intent_policy_audit_logs",
    "required_definition_fragments": [
      "CHECK (action = ANY (ARRAY['revision_created'::text, 'current_switched'::text]))"
    ]
  },
  {
    "constraint_name": "bot_intent_policy_audit_logs_deployment_environment_check",
    "table_name": "bot_intent_policy_audit_logs",
    "required_definition_fragments": [
      "CHECK (deployment_environment = ANY (ARRAY['local'::text, 'dev'::text, 'staging'::text, 'prod'::text]))"
    ]
  },
  {
    "constraint_name": "bot_intent_policy_audit_logs_payload_check",
    "table_name": "bot_intent_policy_audit_logs",
    "required_definition_fragments": [
      "CHECK (jsonb_typeof(payload) = 'object'::text)"
    ]
  },
  {
    "constraint_name": "bot_intent_policy_audit_logs_release_channel_check",
    "table_name": "bot_intent_policy_audit_logs",
    "required_definition_fragments": [
      "CHECK (release_channel = ANY (ARRAY['stable'::text, 'canary'::text]))"
    ]
  },
  {
    "constraint_name": "bot_intent_policy_current_current_revision_no_check",
    "table_name": "bot_intent_policy_current",
    "required_definition_fragments": [
      "CHECK (current_revision_no > 0)"
    ]
  },
  {
    "constraint_name": "bot_intent_policy_current_deployment_environment_check",
    "table_name": "bot_intent_policy_current",
    "required_definition_fragments": [
      "CHECK (deployment_environment = ANY (ARRAY['local'::text, 'dev'::text, 'staging'::text, 'prod'::text]))"
    ]
  },
  {
    "constraint_name": "bot_intent_policy_current_pointer_version_check",
    "table_name": "bot_intent_policy_current",
    "required_definition_fragments": [
      "CHECK (pointer_version > 0)"
    ]
  },
  {
    "constraint_name": "bot_intent_policy_current_release_channel_check",
    "table_name": "bot_intent_policy_current",
    "required_definition_fragments": [
      "CHECK (release_channel = ANY (ARRAY['stable'::text, 'canary'::text]))"
    ]
  },
  {
    "constraint_name": "bot_intent_policy_revisions_change_reason_check",
    "table_name": "bot_intent_policy_revisions",
    "required_definition_fragments": [
      "CHECK (length(change_reason) > 0)"
    ]
  },
  {
    "constraint_name": "bot_intent_policy_revisions_created_by_principal_check",
    "table_name": "bot_intent_policy_revisions",
    "required_definition_fragments": [
      "CHECK (length(created_by_principal) > 0)"
    ]
  },
  {
    "constraint_name": "bot_intent_policy_revisions_deployment_environment_check",
    "table_name": "bot_intent_policy_revisions",
    "required_definition_fragments": [
      "CHECK (deployment_environment = ANY (ARRAY['local'::text, 'dev'::text, 'staging'::text, 'prod'::text]))"
    ]
  },
  {
    "constraint_name": "bot_intent_policy_revisions_personality_hash_check",
    "table_name": "bot_intent_policy_revisions",
    "required_definition_fragments": [
      "CHECK (length(personality_hash) > 0)"
    ]
  },
  {
    "constraint_name": "bot_intent_policy_revisions_personality_version_check",
    "table_name": "bot_intent_policy_revisions",
    "required_definition_fragments": [
      "CHECK (personality_version > 0)"
    ]
  },
  {
    "constraint_name": "bot_intent_policy_revisions_release_channel_check",
    "table_name": "bot_intent_policy_revisions",
    "required_definition_fragments": [
      "CHECK (release_channel = ANY (ARRAY['stable'::text, 'canary'::text]))"
    ]
  },
  {
    "constraint_name": "bot_intent_policy_revisions_revision_no_check",
    "table_name": "bot_intent_policy_revisions",
    "required_definition_fragments": [
      "CHECK (revision_no > 0)"
    ]
  },
  {
    "constraint_name": "bot_intent_policy_revisions_safety_boundaries_hash_check",
    "table_name": "bot_intent_policy_revisions",
    "required_definition_fragments": [
      "CHECK (length(safety_boundaries_hash) > 0)"
    ]
  },
  {
    "constraint_name": "bot_intent_policy_revisions_safety_boundaries_version_check",
    "table_name": "bot_intent_policy_revisions",
    "required_definition_fragments": [
      "CHECK (safety_boundaries_version > 0)"
    ]
  },
  {
    "constraint_name": "bot_permission_bindings_deployment_environment_check",
    "table_name": "bot_permission_bindings",
    "required_definition_fragments": [
      "CHECK (deployment_environment = ANY (ARRAY['local'::text, 'dev'::text, 'staging'::text, 'prod'::text]))"
    ]
  },
  {
    "constraint_name": "bot_permission_bindings_principal_type_check",
    "table_name": "bot_permission_bindings",
    "required_definition_fragments": [
      "CHECK (principal_type = ANY (ARRAY['user'::text, 'service'::text, 'agent'::text, 'developer'::text]))"
    ]
  },
  {
    "constraint_name": "bot_permission_bindings_release_channel_check",
    "table_name": "bot_permission_bindings",
    "required_definition_fragments": [
      "CHECK (release_channel = ANY (ARRAY['stable'::text, 'canary'::text]))"
    ]
  },
  {
    "constraint_name": "bot_permission_bindings_status_check",
    "table_name": "bot_permission_bindings",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text, 'revoked'::text]))"
    ]
  },
  {
    "constraint_name": "bots_deployment_environment_check",
    "table_name": "bots",
    "required_definition_fragments": [
      "CHECK (deployment_environment = ANY (ARRAY['local'::text, 'dev'::text, 'staging'::text, 'prod'::text]))"
    ]
  },
  {
    "constraint_name": "bots_release_channel_check",
    "table_name": "bots",
    "required_definition_fragments": [
      "CHECK (release_channel = ANY (ARRAY['stable'::text, 'canary'::text]))"
    ]
  },
  {
    "constraint_name": "bots_status_check",
    "table_name": "bots",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['active'::text, 'disabled'::text, 'archived'::text]))"
    ]
  },
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
    "constraint_name": "intent_policy_snapshots_bot_policy_revision_no_check",
    "table_name": "intent_policy_snapshots",
    "required_definition_fragments": [
      "CHECK (bot_policy_revision_no > 0)"
    ]
  },
  {
    "constraint_name": "intent_policy_snapshots_deployment_environment_check",
    "table_name": "intent_policy_snapshots",
    "required_definition_fragments": [
      "CHECK (deployment_environment = ANY (ARRAY['local'::text, 'dev'::text, 'staging'::text, 'prod'::text]))"
    ]
  },
  {
    "constraint_name": "intent_policy_snapshots_intent_version_check",
    "table_name": "intent_policy_snapshots",
    "required_definition_fragments": [
      "CHECK (intent_version > 0)"
    ]
  },
  {
    "constraint_name": "intent_policy_snapshots_personality_hash_check",
    "table_name": "intent_policy_snapshots",
    "required_definition_fragments": [
      "CHECK (length(personality_hash) > 0)"
    ]
  },
  {
    "constraint_name": "intent_policy_snapshots_personality_version_check",
    "table_name": "intent_policy_snapshots",
    "required_definition_fragments": [
      "CHECK (personality_version > 0)"
    ]
  },
  {
    "constraint_name": "intent_policy_snapshots_release_channel_check",
    "table_name": "intent_policy_snapshots",
    "required_definition_fragments": [
      "CHECK (release_channel = ANY (ARRAY['stable'::text, 'canary'::text]))"
    ]
  },
  {
    "constraint_name": "intent_policy_snapshots_safety_boundaries_hash_check",
    "table_name": "intent_policy_snapshots",
    "required_definition_fragments": [
      "CHECK (length(safety_boundaries_hash) > 0)"
    ]
  },
  {
    "constraint_name": "intent_policy_snapshots_safety_boundaries_version_check",
    "table_name": "intent_policy_snapshots",
    "required_definition_fragments": [
      "CHECK (safety_boundaries_version > 0)"
    ]
  },
  {
    "constraint_name": "intent_policy_snapshots_schema_version_check",
    "table_name": "intent_policy_snapshots",
    "required_definition_fragments": [
      "CHECK (schema_version = 'intent_policy_input_snapshot.v1'::text)"
    ]
  },
  {
    "constraint_name": "intent_policy_snapshots_security_revocation_epoch_check",
    "table_name": "intent_policy_snapshots",
    "required_definition_fragments": [
      "CHECK (security_revocation_epoch >= 0)"
    ]
  },
  {
    "constraint_name": "intent_policy_snapshots_skill_permission_summary_hash_check",
    "table_name": "intent_policy_snapshots",
    "required_definition_fragments": [
      "CHECK (length(skill_permission_summary_hash) > 0)"
    ]
  },
  {
    "constraint_name": "intent_policy_snapshots_skill_permission_summary_ref_check",
    "table_name": "intent_policy_snapshots",
    "required_definition_fragments": [
      "CHECK (length(skill_permission_summary_ref) > 0)"
    ]
  },
  {
    "constraint_name": "intent_policy_snapshots_snapshot_hash_check",
    "table_name": "intent_policy_snapshots",
    "required_definition_fragments": [
      "CHECK (length(snapshot_hash) > 0)"
    ]
  },
  {
    "constraint_name": "intent_policy_snapshots_tool_permission_profile_hash_check",
    "table_name": "intent_policy_snapshots",
    "required_definition_fragments": [
      "CHECK (length(tool_permission_profile_hash) > 0)"
    ]
  },
  {
    "constraint_name": "intent_policy_snapshots_tool_permission_profile_revision_check",
    "table_name": "intent_policy_snapshots",
    "required_definition_fragments": [
      "CHECK (tool_permission_profile_revision > 0)"
    ]
  },
  {
    "constraint_name": "intent_policy_snapshots_tool_policy_epoch_check",
    "table_name": "intent_policy_snapshots",
    "required_definition_fragments": [
      "CHECK (tool_policy_epoch >= 0)"
    ]
  },
  {
    "constraint_name": "runtime_start_reservations_check",
    "table_name": "runtime_start_reservations",
    "required_definition_fragments": [
      "CHECK (policy_input_created_at < policy_expires_at AND policy_expires_at <= (policy_input_created_at + '24:00:00'::interval))"
    ]
  },
  {
    "constraint_name": "runtime_start_reservations_confirmation_pair_check",
    "table_name": "runtime_start_reservations",
    "required_definition_fragments": [
      "CHECK ((confirmation_ref IS NULL) = (confirmation_hash IS NULL))"
    ]
  },
  {
    "constraint_name": "runtime_start_reservations_intent_version_check",
    "table_name": "runtime_start_reservations",
    "required_definition_fragments": [
      "CHECK (intent_version > 0)"
    ]
  },
  {
    "constraint_name": "runtime_start_reservations_start_attempt_no_check",
    "table_name": "runtime_start_reservations",
    "required_definition_fragments": [
      "CHECK (start_attempt_no > 0)"
    ]
  },
  {
    "constraint_name": "runtime_start_reservations_start_fence_generation_check",
    "table_name": "runtime_start_reservations",
    "required_definition_fragments": [
      "CHECK (start_fence_generation > 0)"
    ]
  },
  {
    "constraint_name": "runtime_start_reservations_status_check",
    "table_name": "runtime_start_reservations",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['reserved'::text, 'dispatching'::text, 'queued'::text, 'started'::text, 'failed'::text, 'cancel_requested'::text, 'cancelled_before_dispatch'::text, 'cancelled_after_dispatch'::text, 'completed'::text]))"
    ]
  },
  {
    "constraint_name": "trigger_command_dlq_resolutions_resolution_payload_check",
    "table_name": "trigger_command_dlq_resolutions",
    "required_definition_fragments": [
      "CHECK (jsonb_typeof(resolution_payload) = 'object'::text)"
    ]
  },
  {
    "constraint_name": "trigger_command_outbox_ack_fence_check",
    "table_name": "trigger_command_outbox",
    "required_definition_fragments": [
      "CHECK ((status = 'sent'::text) = (acknowledged_claim_token IS NOT NULL))"
    ]
  },
  {
    "constraint_name": "trigger_command_outbox_claim_fence_check",
    "table_name": "trigger_command_outbox",
    "required_definition_fragments": [
      "CHECK ((status = 'dispatching'::text) = (claimed_by IS NOT NULL AND claim_token IS NOT NULL AND locked_until IS NOT NULL))"
    ]
  },
  {
    "constraint_name": "trigger_command_outbox_command_type_check",
    "table_name": "trigger_command_outbox",
    "required_definition_fragments": [
      "CHECK (command_type = ANY (ARRAY['runtime.start'::text, 'runtime.cancel'::text, 'runtime.preempt'::text, 'runtime.user_retract'::text, 'meta.job.create'::text, 'meta.snapshot_repair'::text, 'meta.feedback_answer'::text]))"
    ]
  },
  {
    "constraint_name": "trigger_command_outbox_producer_check",
    "table_name": "trigger_command_outbox",
    "required_definition_fragments": [
      "CHECK (producer = 'trigger_processor'::text)"
    ]
  },
  {
    "constraint_name": "trigger_command_outbox_status_check",
    "table_name": "trigger_command_outbox",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['pending'::text, 'dispatching'::text, 'sent'::text, 'retry_wait'::text, 'failed'::text]))"
    ]
  },
  {
    "constraint_name": "trigger_command_outbox_transport_generation_safe_check",
    "table_name": "trigger_command_outbox",
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
    "constraint_name": "trigger_confirmation_challenges_allowed_principal_type_check",
    "table_name": "trigger_confirmation_challenges",
    "required_definition_fragments": [
      "CHECK (allowed_principal_type = ANY (ARRAY['user'::text, 'developer'::text, 'operator'::text]))"
    ]
  },
  {
    "constraint_name": "trigger_confirmation_challenges_check",
    "table_name": "trigger_confirmation_challenges",
    "required_definition_fragments": [
      "CHECK (expires_at > created_at)"
    ]
  },
  {
    "constraint_name": "trigger_confirmation_challenges_check1",
    "table_name": "trigger_confirmation_challenges",
    "required_definition_fragments": [
      "CHECK ((status <> ALL (ARRAY['accepted'::text, 'rejected'::text])) OR response_hash IS NOT NULL AND idempotency_key IS NOT NULL AND responded_by IS NOT NULL AND responded_at IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "trigger_confirmation_challenges_check2",
    "table_name": "trigger_confirmation_challenges",
    "required_definition_fragments": [
      "CHECK (status <> 'pending'::text OR response_hash IS NULL AND idempotency_key IS NULL AND responded_by IS NULL AND responded_at IS NULL)"
    ]
  },
  {
    "constraint_name": "trigger_confirmation_challenges_deployment_environment_check",
    "table_name": "trigger_confirmation_challenges",
    "required_definition_fragments": [
      "CHECK (deployment_environment = ANY (ARRAY['local'::text, 'dev'::text, 'staging'::text, 'prod'::text]))"
    ]
  },
  {
    "constraint_name": "trigger_confirmation_challenges_intent_version_check",
    "table_name": "trigger_confirmation_challenges",
    "required_definition_fragments": [
      "CHECK (intent_version > 0)"
    ]
  },
  {
    "constraint_name": "trigger_confirmation_challenges_release_channel_check",
    "table_name": "trigger_confirmation_challenges",
    "required_definition_fragments": [
      "CHECK (release_channel = ANY (ARRAY['stable'::text, 'canary'::text]))"
    ]
  },
  {
    "constraint_name": "trigger_confirmation_challenges_status_check",
    "table_name": "trigger_confirmation_challenges",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text, 'expired'::text]))"
    ]
  },
  {
    "constraint_name": "trigger_confirmation_decision_material_check",
    "table_name": "trigger_confirmation_challenges",
    "required_definition_fragments": [
      "CHECK (status = 'pending'::text AND request_hash IS NULL AND response_hash IS NULL AND confirmation_hash IS NULL AND response_payload IS NULL AND stage_execute_work_id IS NULL OR status = 'accepted'::text AND request_hash IS NOT NULL AND response_hash IS NOT NULL AND confirmation_hash IS NOT NULL AND response_payload IS NOT NULL AND stage_execute_work_id IS NOT NULL OR status = 'rejected'::text AND request_hash IS NOT NULL AND response_hash IS NOT NULL AND confirmation_hash IS NULL AND response_payload IS NOT NULL AND stage_execute_work_id IS NULL OR status = 'expired'::text AND request_hash IS NULL AND response_hash IS NULL AND confirmation_hash IS NULL AND response_payload IS NULL AND stage_execute_work_id IS NULL)"
    ]
  },
  {
    "constraint_name": "trigger_confirmation_hash_format_check",
    "table_name": "trigger_confirmation_challenges",
    "required_definition_fragments": [
      "CHECK ((request_hash IS NULL OR request_hash ~ '^sha256:[0-9a-f]{64}$'::text) AND (response_hash IS NULL OR response_hash ~ '^sha256:[0-9a-f]{64}$'::text) AND (confirmation_hash IS NULL OR confirmation_hash ~ '^sha256:[0-9a-f]{64}$'::text))"
    ]
  },
  {
    "constraint_name": "trigger_context_source_outcomes_check",
    "table_name": "trigger_context_source_outcomes",
    "required_definition_fragments": [
      "CHECK (status <> 'skipped_by_policy'::text OR policy_id IS NOT NULL AND reason_code IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "trigger_context_source_outcomes_check1",
    "table_name": "trigger_context_source_outcomes",
    "required_definition_fragments": [
      "CHECK (source_as_of IS NULL OR source_as_of <= retrieved_at)"
    ]
  },
  {
    "constraint_name": "trigger_context_source_outcomes_context_version_check",
    "table_name": "trigger_context_source_outcomes",
    "required_definition_fragments": [
      "CHECK (context_version > 0)"
    ]
  },
  {
    "constraint_name": "trigger_context_source_outcomes_latency_ms_check",
    "table_name": "trigger_context_source_outcomes",
    "required_definition_fragments": [
      "CHECK (latency_ms IS NULL OR latency_ms >= 0)"
    ]
  },
  {
    "constraint_name": "trigger_context_source_outcomes_result_count_check",
    "table_name": "trigger_context_source_outcomes",
    "required_definition_fragments": [
      "CHECK (result_count IS NULL OR result_count >= 0)"
    ]
  },
  {
    "constraint_name": "trigger_context_source_outcomes_source_check",
    "table_name": "trigger_context_source_outcomes",
    "required_definition_fragments": [
      "CHECK (source = ANY (ARRAY['knowthat'::text, 'memory'::text, 'skill'::text, 'environment'::text, 'history'::text]))"
    ]
  },
  {
    "constraint_name": "trigger_context_source_outcomes_status_check",
    "table_name": "trigger_context_source_outcomes",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['ok'::text, 'empty'::text, 'timeout'::text, 'failed'::text, 'degraded'::text, 'skipped_by_policy'::text]))"
    ]
  },
  {
    "constraint_name": "trigger_event_dlq_resolutions_resolution_payload_check",
    "table_name": "trigger_event_dlq_resolutions",
    "required_definition_fragments": [
      "CHECK (jsonb_typeof(resolution_payload) = 'object'::text)"
    ]
  },
  {
    "constraint_name": "trigger_event_inbox_event_id_check",
    "table_name": "trigger_event_inbox",
    "required_definition_fragments": [
      "CHECK (length(event_id) > 0)"
    ]
  },
  {
    "constraint_name": "trigger_event_inbox_payload_hash_check",
    "table_name": "trigger_event_inbox",
    "required_definition_fragments": [
      "CHECK (length(payload_hash) > 0)"
    ]
  },
  {
    "constraint_name": "trigger_event_inbox_scope_fingerprint_check",
    "table_name": "trigger_event_inbox",
    "required_definition_fragments": [
      "CHECK (length(scope_fingerprint) > 0)"
    ]
  },
  {
    "constraint_name": "trigger_event_inbox_semantic_hash_check",
    "table_name": "trigger_event_inbox",
    "required_definition_fragments": [
      "CHECK (length(semantic_hash) > 0)"
    ]
  },
  {
    "constraint_name": "trigger_event_outbox_ack_fence_check",
    "table_name": "trigger_event_outbox",
    "required_definition_fragments": [
      "CHECK ((status = 'sent'::text) = (acknowledged_claim_token IS NOT NULL))"
    ]
  },
  {
    "constraint_name": "trigger_event_outbox_claim_fence_check",
    "table_name": "trigger_event_outbox",
    "required_definition_fragments": [
      "CHECK ((status = 'dispatching'::text) = (claimed_by IS NOT NULL AND claim_token IS NOT NULL AND locked_until IS NOT NULL))"
    ]
  },
  {
    "constraint_name": "trigger_event_outbox_event_type_check",
    "table_name": "trigger_event_outbox",
    "required_definition_fragments": [
      "CHECK (event_type = ANY (ARRAY['trigger.accepted'::text, 'trigger.rejected'::text, 'trigger_process.phase_changed'::text, 'trigger_process.user_message_retracted'::text, 'trigger_process.system_interrupted'::text, 'cooldown.expired'::text, 'weak_trigger.merged'::text, 'trigger_process.outcome_finalized'::text]))"
    ],
    "semantic_constraint": {
      "kind": "text_enum",
      "column_name": "event_type",
      "allowed_values": [
        "trigger.accepted",
        "trigger.rejected",
        "trigger_process.phase_changed",
        "trigger_process.user_message_retracted",
        "trigger_process.system_interrupted",
        "cooldown.expired",
        "weak_trigger.merged",
        "trigger_process.outcome_finalized"
      ]
    }
  },
  {
    "constraint_name": "trigger_event_outbox_generated_contract_check",
    "table_name": "trigger_event_outbox",
    "required_definition_fragments": [
      "CHECK (producer = 'trigger_processor'::text AND schema_version = 'trigger_processor_event.v1'::text AND (event_type = ANY (ARRAY['trigger.accepted'::text, 'trigger.rejected'::text, 'trigger_process.phase_changed'::text, 'trigger_process.user_message_retracted'::text, 'trigger_process.system_interrupted'::text, 'cooldown.expired'::text, 'weak_trigger.merged'::text, 'trigger_process.outcome_finalized'::text])))"
    ],
    "semantic_constraint": {
      "kind": "column_event_envelope",
      "column_name": "event_type",
      "producer_column_name": "producer",
      "producer_value": "trigger_processor",
      "schema_version_column_name": "schema_version",
      "schema_version_value": "trigger_processor_event.v1",
      "event_type_column_name": "event_type",
      "event_type_allowed_values": [
        "trigger.accepted",
        "trigger.rejected",
        "trigger_process.phase_changed",
        "trigger_process.user_message_retracted",
        "trigger_process.system_interrupted",
        "cooldown.expired",
        "weak_trigger.merged",
        "trigger_process.outcome_finalized"
      ]
    }
  },
  {
    "constraint_name": "trigger_event_outbox_producer_check",
    "table_name": "trigger_event_outbox",
    "required_definition_fragments": [
      "CHECK (producer = 'trigger_processor'::text)"
    ],
    "semantic_constraint": {
      "kind": "text_equals",
      "column_name": "producer",
      "value": "trigger_processor"
    }
  },
  {
    "constraint_name": "trigger_event_outbox_reconciliation_generation_check",
    "table_name": "trigger_event_outbox",
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
    "constraint_name": "trigger_event_outbox_schema_version_check",
    "table_name": "trigger_event_outbox",
    "required_definition_fragments": [
      "CHECK (schema_version = 'trigger_processor_event.v1'::text)"
    ],
    "semantic_constraint": {
      "kind": "text_equals",
      "column_name": "schema_version",
      "value": "trigger_processor_event.v1"
    }
  },
  {
    "constraint_name": "trigger_event_outbox_sent_at_check",
    "table_name": "trigger_event_outbox",
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
    "constraint_name": "trigger_event_outbox_sent_transport_epoch_check",
    "table_name": "trigger_event_outbox",
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
    "constraint_name": "trigger_event_outbox_sent_transport_generation_check",
    "table_name": "trigger_event_outbox",
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
    "constraint_name": "trigger_event_outbox_sent_transport_ref_check",
    "table_name": "trigger_event_outbox",
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
    "constraint_name": "trigger_event_outbox_status_check",
    "table_name": "trigger_event_outbox",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['pending'::text, 'dispatching'::text, 'sent'::text, 'retry_wait'::text, 'failed'::text]))"
    ]
  },
  {
    "constraint_name": "trigger_event_outbox_transport_generation_safe_check",
    "table_name": "trigger_event_outbox",
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
    "constraint_name": "trigger_process_cancel_requests_check",
    "table_name": "trigger_process_cancel_requests",
    "required_definition_fragments": [
      "CHECK (status <> 'completed'::text OR completed_at IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "trigger_process_cancel_requests_check1",
    "table_name": "trigger_process_cancel_requests",
    "required_definition_fragments": [
      "CHECK (isolation_status <> 'timeout_isolated'::text OR isolation_proof_ref IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "trigger_process_cancel_requests_isolation_status_check",
    "table_name": "trigger_process_cancel_requests",
    "required_definition_fragments": [
      "CHECK (isolation_status = ANY (ARRAY['pending'::text, 'safe_point'::text, 'timeout_isolated'::text, 'unproven'::text]))"
    ]
  },
  {
    "constraint_name": "trigger_process_cancel_requests_status_check",
    "table_name": "trigger_process_cancel_requests",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['accepted'::text, 'runtime_handling'::text, 'reconciliation_required'::text, 'completed'::text]))"
    ]
  },
  {
    "constraint_name": "trigger_process_event_projections_append_sequence_no_check",
    "table_name": "trigger_process_event_projections",
    "required_definition_fragments": [
      "CHECK (append_sequence_no > 0)"
    ]
  },
  {
    "constraint_name": "trigger_process_event_projections_check",
    "table_name": "trigger_process_event_projections",
    "required_definition_fragments": [
      "CHECK (retention_until >= occurred_at)"
    ]
  },
  {
    "constraint_name": "trigger_process_event_projections_observation_summary_check",
    "table_name": "trigger_process_event_projections",
    "required_definition_fragments": [
      "CHECK (jsonb_typeof(observation_summary) = 'object'::text)"
    ]
  },
  {
    "constraint_name": "trigger_process_meta_observation_gate_check",
    "table_name": "trigger_process_meta_projections",
    "required_definition_fragments": [
      "CHECK (observation_finalized = false OR meta_status = 'not_applicable'::text OR (meta_status = ANY (ARRAY['completed'::text, 'failed'::text])) AND (result_status = ANY (ARRAY['complete'::text, 'partial_failed'::text])) AND result_finalized_at IS NOT NULL AND active_compensation_count = 0 AND active_repair_count = 0)"
    ]
  },
  {
    "constraint_name": "trigger_process_meta_observation_time_check",
    "table_name": "trigger_process_meta_projections",
    "required_definition_fragments": [
      "CHECK (observation_finalized = (observation_finalized_at IS NOT NULL))"
    ]
  },
  {
    "constraint_name": "trigger_process_meta_partial_pending_check",
    "table_name": "trigger_process_meta_projections",
    "required_definition_fragments": [
      "CHECK (result_status <> 'partial_pending'::text OR result_finalized_at IS NULL AND observation_finalized = false)"
    ]
  },
  {
    "constraint_name": "trigger_process_meta_projection_active_compensation_count_check",
    "table_name": "trigger_process_meta_projections",
    "required_definition_fragments": [
      "CHECK (active_compensation_count >= 0)"
    ]
  },
  {
    "constraint_name": "trigger_process_meta_projections_active_repair_count_check",
    "table_name": "trigger_process_meta_projections",
    "required_definition_fragments": [
      "CHECK (active_repair_count >= 0)"
    ]
  },
  {
    "constraint_name": "trigger_process_meta_projections_check",
    "table_name": "trigger_process_meta_projections",
    "required_definition_fragments": [
      "CHECK (meta_status = 'not_enqueued'::text AND meta_enqueue_reason IS NULL OR meta_status <> 'not_enqueued'::text AND NULLIF(meta_enqueue_reason, ''::text) IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "trigger_process_meta_projections_last_meta_event_sequence_check",
    "table_name": "trigger_process_meta_projections",
    "required_definition_fragments": [
      "CHECK (last_meta_event_sequence >= 0)"
    ]
  },
  {
    "constraint_name": "trigger_process_meta_projections_meta_status_check",
    "table_name": "trigger_process_meta_projections",
    "required_definition_fragments": [
      "CHECK (meta_status = ANY (ARRAY['not_enqueued'::text, 'enqueue_pending'::text, 'queued'::text, 'running'::text, 'retry_wait'::text, 'completed'::text, 'failed'::text, 'not_applicable'::text]))"
    ]
  },
  {
    "constraint_name": "trigger_process_meta_projections_projection_version_check",
    "table_name": "trigger_process_meta_projections",
    "required_definition_fragments": [
      "CHECK (projection_version >= 0)"
    ]
  },
  {
    "constraint_name": "trigger_process_meta_projections_result_status_check",
    "table_name": "trigger_process_meta_projections",
    "required_definition_fragments": [
      "CHECK (result_status IS NULL OR (result_status = ANY (ARRAY['complete'::text, 'partial_pending'::text, 'partial_failed'::text])))"
    ]
  },
  {
    "constraint_name": "trigger_process_meta_projections_result_version_check",
    "table_name": "trigger_process_meta_projections",
    "required_definition_fragments": [
      "CHECK (result_version IS NULL OR result_version > 0)"
    ]
  },
  {
    "constraint_name": "trigger_process_meta_result_final_check",
    "table_name": "trigger_process_meta_projections",
    "required_definition_fragments": [
      "CHECK (result_finalized_at IS NULL OR (result_status = ANY (ARRAY['complete'::text, 'partial_failed'::text])))"
    ]
  },
  {
    "constraint_name": "trigger_process_snapshots_check",
    "table_name": "trigger_process_snapshots",
    "required_definition_fragments": [
      "CHECK (last_append_sequence_no >= first_append_sequence_no)"
    ]
  },
  {
    "constraint_name": "trigger_process_snapshots_check1",
    "table_name": "trigger_process_snapshots",
    "required_definition_fragments": [
      "CHECK (cooldown_until IS NULL OR retention_until > cooldown_until)"
    ]
  },
  {
    "constraint_name": "trigger_process_snapshots_check2",
    "table_name": "trigger_process_snapshots",
    "required_definition_fragments": [
      "CHECK (runtime_run_id IS NULL AND policy_snapshot_id IS NULL OR runtime_run_id IS NOT NULL AND policy_snapshot_id IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "trigger_process_snapshots_check3",
    "table_name": "trigger_process_snapshots",
    "required_definition_fragments": [
      "CHECK (personality_ref IS NULL AND personality_version IS NULL AND personality_hash IS NULL OR personality_ref IS NOT NULL AND personality_version IS NOT NULL AND personality_version > 0 AND personality_hash IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "trigger_process_snapshots_context_identity_complete_check",
    "table_name": "trigger_process_snapshots",
    "required_definition_fragments": [
      "CHECK (context_snapshot_ref IS NULL AND context_snapshot_version IS NULL AND context_snapshot_hash IS NULL OR context_snapshot_ref IS NOT NULL AND context_snapshot_version >= 1 AND context_snapshot_version <= '9007199254740991'::bigint AND context_snapshot_hash IS NOT NULL AND length(context_snapshot_hash) > 0)"
    ],
    "semantic_constraint": {
      "kind": "nullable_versioned_identity",
      "column_name": "context_snapshot_ref",
      "version_column_name": "context_snapshot_version",
      "hash_column_name": "context_snapshot_hash",
      "min_version": 1,
      "max_version": 9007199254740991
    }
  },
  {
    "constraint_name": "trigger_process_snapshots_deployment_environment_check",
    "table_name": "trigger_process_snapshots",
    "required_definition_fragments": [
      "CHECK (deployment_environment = ANY (ARRAY['local'::text, 'dev'::text, 'staging'::text, 'prod'::text]))"
    ]
  },
  {
    "constraint_name": "trigger_process_snapshots_json_safe_integer_check",
    "table_name": "trigger_process_snapshots",
    "required_definition_fragments": [
      "CHECK (snapshot_version >= 1 AND snapshot_version <= '9007199254740991'::bigint AND first_append_sequence_no >= 0 AND first_append_sequence_no <= '9007199254740991'::bigint AND last_append_sequence_no >= 0 AND last_append_sequence_no <= '9007199254740991'::bigint AND (personality_version IS NULL OR personality_version >= 1 AND personality_version <= '9007199254740991'::bigint))"
    ],
    "semantic_constraint": {
      "kind": "integer_ranges",
      "column_name": "snapshot_version",
      "ranges": [
        {
          "column_name": "snapshot_version",
          "min": 1,
          "max": 9007199254740991,
          "nullable": false
        },
        {
          "column_name": "first_append_sequence_no",
          "min": 0,
          "max": 9007199254740991,
          "nullable": false
        },
        {
          "column_name": "last_append_sequence_no",
          "min": 0,
          "max": 9007199254740991,
          "nullable": false
        },
        {
          "column_name": "personality_version",
          "min": 1,
          "max": 9007199254740991,
          "nullable": true
        }
      ]
    }
  },
  {
    "constraint_name": "trigger_process_snapshots_release_channel_check",
    "table_name": "trigger_process_snapshots",
    "required_definition_fragments": [
      "CHECK (release_channel = ANY (ARRAY['stable'::text, 'canary'::text]))"
    ]
  },
  {
    "constraint_name": "trigger_process_snapshots_schema_version_check",
    "table_name": "trigger_process_snapshots",
    "required_definition_fragments": [
      "CHECK (schema_version = 'trigger_process_snapshot.v1'::text)"
    ]
  },
  {
    "constraint_name": "trigger_process_snapshots_snapshot_version_check",
    "table_name": "trigger_process_snapshots",
    "required_definition_fragments": [
      "CHECK (snapshot_version > 0)"
    ]
  },
  {
    "constraint_name": "trigger_process_snapshots_status_check",
    "table_name": "trigger_process_snapshots",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['current'::text, 'superseded'::text, 'invalid'::text, 'expired'::text]))"
    ]
  },
  {
    "constraint_name": "trigger_process_transition_version_step_check",
    "table_name": "trigger_process_transitions",
    "required_definition_fragments": [
      "CHECK (resulting_state_version = (previous_state_version + 1))"
    ],
    "semantic_constraint": {
      "kind": "integer_successor",
      "column_name": "resulting_state_version",
      "previous_column_name": "previous_state_version"
    }
  },
  {
    "constraint_name": "trigger_process_transitions_previous_state_version_check",
    "table_name": "trigger_process_transitions",
    "required_definition_fragments": [
      "CHECK (previous_state_version > 0)"
    ]
  },
  {
    "constraint_name": "trigger_process_transitions_resulting_state_version_check",
    "table_name": "trigger_process_transitions",
    "required_definition_fragments": [
      "CHECK (resulting_state_version > 0)"
    ]
  },
  {
    "constraint_name": "trigger_process_work_items_attempt_count_check",
    "table_name": "trigger_process_work_items",
    "required_definition_fragments": [
      "CHECK (attempt_count >= 0)"
    ]
  },
  {
    "constraint_name": "trigger_process_work_items_check",
    "table_name": "trigger_process_work_items",
    "required_definition_fragments": [
      "CHECK (work_kind = 'stage_execute'::text AND schema_version = 'trigger_stage_execute_work.v1'::text OR work_kind = 'stage_retry'::text AND schema_version = 'trigger_stage_retry_work.v1'::text OR work_kind = 'runtime_start_recompose'::text AND schema_version = 'trigger_runtime_start_recompose_work.v1'::text OR work_kind = 'snapshot_repair'::text AND schema_version = 'trigger_snapshot_repair_work.v1'::text OR work_kind = 'meta_enqueue'::text AND schema_version = 'trigger_meta_enqueue_work.v1'::text)"
    ]
  },
  {
    "constraint_name": "trigger_process_work_items_check1",
    "table_name": "trigger_process_work_items",
    "required_definition_fragments": [
      "CHECK (status <> 'leased'::text OR lease_owner IS NOT NULL AND lease_token_hash IS NOT NULL AND lease_generation > 0 AND lease_until IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "trigger_process_work_items_check2",
    "table_name": "trigger_process_work_items",
    "required_definition_fragments": [
      "CHECK ((status <> ALL (ARRAY['pending'::text, 'retry_wait'::text])) OR lease_owner IS NULL AND lease_token_hash IS NULL AND lease_until IS NULL)"
    ]
  },
  {
    "constraint_name": "trigger_process_work_items_check3",
    "table_name": "trigger_process_work_items",
    "required_definition_fragments": [
      "CHECK ((status <> ALL (ARRAY['completed'::text, 'failed'::text])) OR completed_at IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "trigger_process_work_items_deployment_environment_check",
    "table_name": "trigger_process_work_items",
    "required_definition_fragments": [
      "CHECK (deployment_environment = ANY (ARRAY['local'::text, 'dev'::text, 'staging'::text, 'prod'::text]))"
    ]
  },
  {
    "constraint_name": "trigger_process_work_items_expected_process_state_version_check",
    "table_name": "trigger_process_work_items",
    "required_definition_fragments": [
      "CHECK (expected_process_state_version > 0)"
    ]
  },
  {
    "constraint_name": "trigger_process_work_items_lease_generation_check",
    "table_name": "trigger_process_work_items",
    "required_definition_fragments": [
      "CHECK (lease_generation >= 0)"
    ]
  },
  {
    "constraint_name": "trigger_process_work_items_payload_hash_check",
    "table_name": "trigger_process_work_items",
    "required_definition_fragments": [
      "CHECK (payload_hash ~ '^sha256:[0-9a-f]{64}$'::text)"
    ]
  },
  {
    "constraint_name": "trigger_process_work_items_payload_schema_check",
    "table_name": "trigger_process_work_items",
    "required_definition_fragments": [
      "CHECK (jsonb_typeof(payload) = 'object'::text AND (work_kind = 'stage_execute'::text AND (payload ->> 'schema_version'::text) = 'trigger_stage_execute_work.v1'::text OR work_kind = 'stage_retry'::text AND (payload ->> 'schema_version'::text) = 'trigger_stage_retry_work.v1'::text OR work_kind = 'runtime_start_recompose'::text AND (payload ->> 'schema_version'::text) = 'trigger_runtime_start_recompose_work.v1'::text OR work_kind = 'snapshot_repair'::text AND (payload ->> 'schema_version'::text) = 'trigger_snapshot_repair_work.v1'::text OR work_kind = 'meta_enqueue'::text AND (payload ->> 'schema_version'::text) = 'trigger_meta_enqueue_work.v1'::text))"
    ],
    "semantic_constraint": {
      "kind": "json_discriminator",
      "column_name": "work_kind",
      "payload_column_name": "payload",
      "payload_field_name": "schema_version",
      "branches": [
        {
          "discriminator_value": "stage_execute",
          "payload_field_value": "trigger_stage_execute_work.v1"
        },
        {
          "discriminator_value": "stage_retry",
          "payload_field_value": "trigger_stage_retry_work.v1"
        },
        {
          "discriminator_value": "runtime_start_recompose",
          "payload_field_value": "trigger_runtime_start_recompose_work.v1"
        },
        {
          "discriminator_value": "snapshot_repair",
          "payload_field_value": "trigger_snapshot_repair_work.v1"
        },
        {
          "discriminator_value": "meta_enqueue",
          "payload_field_value": "trigger_meta_enqueue_work.v1"
        }
      ]
    }
  },
  {
    "constraint_name": "trigger_process_work_items_release_channel_check",
    "table_name": "trigger_process_work_items",
    "required_definition_fragments": [
      "CHECK (release_channel = ANY (ARRAY['stable'::text, 'canary'::text]))"
    ]
  },
  {
    "constraint_name": "trigger_process_work_items_status_check",
    "table_name": "trigger_process_work_items",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['pending'::text, 'leased'::text, 'retry_wait'::text, 'completed'::text, 'failed'::text]))"
    ],
    "semantic_constraint": {
      "kind": "text_enum",
      "column_name": "status",
      "allowed_values": [
        "pending",
        "leased",
        "retry_wait",
        "completed",
        "failed"
      ]
    }
  },
  {
    "constraint_name": "trigger_process_work_items_work_kind_check",
    "table_name": "trigger_process_work_items",
    "required_definition_fragments": [
      "CHECK (work_kind = ANY (ARRAY['stage_execute'::text, 'stage_retry'::text, 'runtime_start_recompose'::text, 'snapshot_repair'::text, 'meta_enqueue'::text]))"
    ],
    "semantic_constraint": {
      "kind": "text_enum",
      "column_name": "work_kind",
      "allowed_values": [
        "stage_execute",
        "stage_retry",
        "runtime_start_recompose",
        "snapshot_repair",
        "meta_enqueue"
      ]
    }
  },
  {
    "constraint_name": "trigger_processes_cancellation_isolation_status_check",
    "table_name": "trigger_processes",
    "required_definition_fragments": [
      "CHECK (cancellation_isolation_status = ANY (ARRAY['none'::text, 'pending'::text, 'safe_point'::text, 'timeout_isolated'::text, 'unproven'::text]))"
    ]
  },
  {
    "constraint_name": "trigger_processes_cancellation_status_check",
    "table_name": "trigger_processes",
    "required_definition_fragments": [
      "CHECK (cancellation_status = ANY (ARRAY['none'::text, 'requested'::text, 'runtime_handling'::text, 'reconciliation_required'::text, 'completed'::text]))"
    ]
  },
  {
    "constraint_name": "trigger_processes_check",
    "table_name": "trigger_processes",
    "required_definition_fragments": [
      "CHECK (snapshot_retention_until IS NULL OR cooldown_until IS NULL OR snapshot_retention_until > cooldown_until)"
    ]
  },
  {
    "constraint_name": "trigger_processes_check1",
    "table_name": "trigger_processes",
    "required_definition_fragments": [
      "CHECK ((status = 'waiting'::text) = (wait_reason IS NOT NULL))"
    ]
  },
  {
    "constraint_name": "trigger_processes_check2",
    "table_name": "trigger_processes",
    "required_definition_fragments": [
      "CHECK (phase = 'admission'::text AND status = 'running'::text AND wait_reason IS NULL OR phase = 'admission'::text AND status = 'waiting'::text AND (wait_reason = ANY (ARRAY['weak_queue'::text, 'preempt_commit'::text, 'deferred_strong_queue'::text, 'stage_retry_wait'::text])) OR phase = 'context'::text AND status = 'running'::text AND wait_reason IS NULL OR phase = 'context'::text AND status = 'waiting'::text AND (wait_reason = ANY (ARRAY['runtime_start_recompose'::text, 'stage_retry_wait'::text])) OR phase = 'intent'::text AND status = 'running'::text AND wait_reason IS NULL OR phase = 'intent'::text AND status = 'waiting'::text AND (wait_reason = ANY (ARRAY['external_confirmation'::text, 'stage_retry_wait'::text])) OR phase = 'execution'::text AND status = 'waiting'::text AND (wait_reason = ANY (ARRAY['runtime_start'::text, 'runtime_start_reconcile'::text, 'external_confirmation'::text, 'stage_retry_wait'::text])) OR phase = 'execution'::text AND (status = ANY (ARRAY['running'::text, 'preempt_requested'::text, 'cancelling'::text])) AND wait_reason IS NULL OR phase = 'cooldown'::text AND status = 'waiting'::text AND wait_reason = 'cooldown_until'::text OR phase = 'meta_enqueued'::text AND status = 'waiting'::text AND wait_reason = 'meta_enqueue_wait'::text OR phase = 'closed'::text AND (status = ANY (ARRAY['completed'::text, 'failed'::text, 'preempted'::text, 'cancelled'::text])) AND wait_reason IS NULL)"
    ]
  },
  {
    "constraint_name": "trigger_processes_check3",
    "table_name": "trigger_processes",
    "required_definition_fragments": [
      "CHECK ((blocked_by_process_id IS NULL OR blocked_by_process_id <> id) AND (canonical_process_id IS NULL OR canonical_process_id <> id))"
    ]
  },
  {
    "constraint_name": "trigger_processes_check4",
    "table_name": "trigger_processes",
    "required_definition_fragments": [
      "CHECK (runtime_start_attempt_no IS NULL AND runtime_policy_created_at IS NULL AND runtime_policy_expires_at IS NULL OR runtime_start_attempt_no IS NOT NULL AND runtime_policy_created_at IS NOT NULL AND runtime_policy_expires_at IS NOT NULL AND runtime_policy_created_at < runtime_policy_expires_at AND runtime_policy_expires_at <= (runtime_policy_created_at + '24:00:00'::interval))"
    ]
  },
  {
    "constraint_name": "trigger_processes_context_identity_complete_check",
    "table_name": "trigger_processes",
    "required_definition_fragments": [
      "CHECK (context_snapshot_ref IS NULL AND context_snapshot_version IS NULL AND context_snapshot_hash IS NULL OR context_snapshot_ref IS NOT NULL AND context_snapshot_version >= 1 AND context_snapshot_version <= '9007199254740991'::bigint AND context_snapshot_hash IS NOT NULL AND length(context_snapshot_hash) > 0)"
    ],
    "semantic_constraint": {
      "kind": "nullable_versioned_identity",
      "column_name": "context_snapshot_ref",
      "version_column_name": "context_snapshot_version",
      "hash_column_name": "context_snapshot_hash",
      "min_version": 1,
      "max_version": 9007199254740991
    }
  },
  {
    "constraint_name": "trigger_processes_context_retention_complete_check",
    "table_name": "trigger_processes",
    "required_definition_fragments": [
      "CHECK (context_snapshot_ref IS NULL AND context_snapshot_retention_until IS NULL OR context_snapshot_ref IS NOT NULL AND context_snapshot_retention_until IS NOT NULL AND context_snapshot_retention_until > created_at)"
    ]
  },
  {
    "constraint_name": "trigger_processes_deferred_strong_guard",
    "table_name": "trigger_processes",
    "required_definition_fragments": [
      "CHECK (wait_reason <> 'deferred_strong_queue'::text OR phase = 'admission'::text AND status = 'waiting'::text AND priority = 'strong'::text AND blocked_by_process_id IS NULL)"
    ]
  },
  {
    "constraint_name": "trigger_processes_deployment_environment_check",
    "table_name": "trigger_processes",
    "required_definition_fragments": [
      "CHECK (deployment_environment = ANY (ARRAY['local'::text, 'dev'::text, 'staging'::text, 'prod'::text]))"
    ]
  },
  {
    "constraint_name": "trigger_processes_meta_enqueue_presence_check",
    "table_name": "trigger_processes",
    "required_definition_fragments": [
      "CHECK ((phase = 'meta_enqueued'::text) = (meta_enqueue_reason IS NOT NULL))"
    ],
    "semantic_constraint": {
      "kind": "iff_not_null",
      "column_name": "meta_enqueue_reason",
      "condition_column_name": "phase",
      "condition_equals": "meta_enqueued",
      "require_non_empty": false
    }
  },
  {
    "constraint_name": "trigger_processes_meta_enqueue_reason_check",
    "table_name": "trigger_processes",
    "required_definition_fragments": [
      "CHECK (meta_enqueue_reason IS NULL OR (meta_enqueue_reason = ANY (ARRAY['cooldown_expired'::text, 'user_retracted'::text, 'system_interrupted'::text, 'failed_with_learnable_snapshot'::text])))"
    ],
    "semantic_constraint": {
      "kind": "nullable_text_enum",
      "column_name": "meta_enqueue_reason",
      "allowed_values": [
        "cooldown_expired",
        "user_retracted",
        "system_interrupted",
        "failed_with_learnable_snapshot"
      ]
    }
  },
  {
    "constraint_name": "trigger_processes_no_execution_confirmation_wait_check",
    "table_name": "trigger_processes",
    "required_definition_fragments": [
      "CHECK (NOT (phase = 'execution'::text AND status = 'waiting'::text AND wait_reason = 'external_confirmation'::text))"
    ]
  },
  {
    "constraint_name": "trigger_processes_outcome_close_check",
    "table_name": "trigger_processes",
    "required_definition_fragments": [
      "CHECK (phase <> 'closed'::text AND terminal_outcome IS NULL AND terminal_outcome_finalized_at IS NULL OR phase = 'closed'::text AND (terminal_reason = 'merged'::text OR terminal_outcome IS NOT NULL))"
    ]
  },
  {
    "constraint_name": "trigger_processes_outcome_timestamp_check",
    "table_name": "trigger_processes",
    "required_definition_fragments": [
      "CHECK ((terminal_outcome IS NULL) = (terminal_outcome_finalized_at IS NULL))"
    ]
  },
  {
    "constraint_name": "trigger_processes_phase_check",
    "table_name": "trigger_processes",
    "required_definition_fragments": [
      "CHECK (phase = ANY (ARRAY['admission'::text, 'context'::text, 'intent'::text, 'execution'::text, 'cooldown'::text, 'meta_enqueued'::text, 'closed'::text]))"
    ]
  },
  {
    "constraint_name": "trigger_processes_preempt_commit_guard",
    "table_name": "trigger_processes",
    "required_definition_fragments": [
      "CHECK (wait_reason <> 'preempt_commit'::text OR phase = 'admission'::text AND status = 'waiting'::text AND priority = 'strong'::text AND blocked_by_process_id IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "trigger_processes_preempt_commit_result_check",
    "table_name": "trigger_processes",
    "required_definition_fragments": [
      "CHECK (preempt_commit_result IS NULL OR (preempt_commit_result = ANY (ARRAY['committed'::text, 'timeout_isolated'::text, 'failed_but_isolated'::text, 'failed_not_isolated'::text])))"
    ]
  },
  {
    "constraint_name": "trigger_processes_priority_check",
    "table_name": "trigger_processes",
    "required_definition_fragments": [
      "CHECK (priority = ANY (ARRAY['strong'::text, 'weak'::text]))"
    ]
  },
  {
    "constraint_name": "trigger_processes_release_channel_check",
    "table_name": "trigger_processes",
    "required_definition_fragments": [
      "CHECK (release_channel = ANY (ARRAY['stable'::text, 'canary'::text]))"
    ]
  },
  {
    "constraint_name": "trigger_processes_runtime_start_attempt_no_check",
    "table_name": "trigger_processes",
    "required_definition_fragments": [
      "CHECK (runtime_start_attempt_no IS NULL OR runtime_start_attempt_no > 0)"
    ]
  },
  {
    "constraint_name": "trigger_processes_state_version_check",
    "table_name": "trigger_processes",
    "required_definition_fragments": [
      "CHECK (state_version > 0)"
    ]
  },
  {
    "constraint_name": "trigger_processes_status_check",
    "table_name": "trigger_processes",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['running'::text, 'waiting'::text, 'preempt_requested'::text, 'preempted'::text, 'cancelling'::text, 'cancelled'::text, 'completed'::text, 'failed'::text]))"
    ]
  },
  {
    "constraint_name": "trigger_processes_successor_self_check",
    "table_name": "trigger_processes",
    "required_definition_fragments": [
      "CHECK (successor_process_id IS NULL OR successor_process_id <> id)"
    ]
  },
  {
    "constraint_name": "trigger_processes_superseded_self_check",
    "table_name": "trigger_processes",
    "required_definition_fragments": [
      "CHECK (superseded_by_process_id IS NULL OR superseded_by_process_id <> id)"
    ]
  },
  {
    "constraint_name": "trigger_processes_terminal_evidence_check",
    "table_name": "trigger_processes",
    "required_definition_fragments": [
      "CHECK (terminal_outcome IS NULL OR canonical_reason_code IS NOT NULL AND (terminal_outcome <> 'merged_and_executed'::text OR canonical_process_id IS NOT NULL) AND (terminal_outcome <> 'superseded_by_later_trigger'::text OR superseded_by_process_id IS NOT NULL) AND (terminal_outcome <> 'preempted_and_handed_off'::text OR successor_process_id IS NOT NULL AND snapshot_transfer_ref IS NOT NULL AND preempt_isolation_proof_ref IS NOT NULL) AND (terminal_outcome <> 'interrupted_with_reason'::text OR boundary_system_event_ref IS NOT NULL AND boundary_system_event_ref ~ '^(memory_point|trigger_process|trigger_event|user_feedback|developer_note|system_event|artifact|tool_result):.+$'::text))"
    ]
  },
  {
    "constraint_name": "trigger_processes_terminal_outcome_check",
    "table_name": "trigger_processes",
    "required_definition_fragments": [
      "CHECK (terminal_outcome IS NULL OR (terminal_outcome = ANY (ARRAY['executed'::text, 'merged_and_executed'::text, 'superseded_by_later_trigger'::text, 'deferred_then_executed'::text, 'expired_with_audit_record'::text, 'cancelled_with_reason'::text, 'failed_with_reason'::text, 'preempted_and_handed_off'::text, 'interrupted_with_reason'::text])))"
    ],
    "semantic_constraint": {
      "kind": "nullable_text_enum",
      "column_name": "terminal_outcome",
      "allowed_values": [
        "executed",
        "merged_and_executed",
        "superseded_by_later_trigger",
        "deferred_then_executed",
        "expired_with_audit_record",
        "cancelled_with_reason",
        "failed_with_reason",
        "preempted_and_handed_off",
        "interrupted_with_reason"
      ]
    }
  },
  {
    "constraint_name": "trigger_processes_terminal_reason_presence_check",
    "table_name": "trigger_processes",
    "required_definition_fragments": [
      "CHECK ((phase = 'closed'::text) = (terminal_reason IS NOT NULL) AND (terminal_reason IS NULL OR terminal_reason <> ''::text))"
    ],
    "semantic_constraint": {
      "kind": "iff_not_null",
      "column_name": "terminal_reason",
      "condition_column_name": "phase",
      "condition_equals": "closed",
      "require_non_empty": true
    }
  },
  {
    "constraint_name": "trigger_processes_terminal_ref_shape_check",
    "table_name": "trigger_processes",
    "required_definition_fragments": [
      "CHECK (boundary_system_event_ref IS NULL OR boundary_system_event_ref ~ '^(memory_point|trigger_process|trigger_event|user_feedback|developer_note|system_event|artifact|tool_result):.+$'::text)"
    ]
  },
  {
    "constraint_name": "trigger_processes_wait_reason_check",
    "table_name": "trigger_processes",
    "required_definition_fragments": [
      "CHECK (wait_reason IS NULL OR (wait_reason = ANY (ARRAY['weak_queue'::text, 'preempt_commit'::text, 'deferred_strong_queue'::text, 'runtime_start'::text, 'runtime_start_reconcile'::text, 'runtime_start_recompose'::text, 'external_confirmation'::text, 'stage_retry_wait'::text, 'cooldown_until'::text, 'meta_enqueue_wait'::text])))"
    ]
  },
  {
    "constraint_name": "trigger_snapshot_append_audits_gap_range_check",
    "table_name": "trigger_snapshot_append_audits",
    "required_definition_fragments": [
      "CHECK (result <> 'gap_skipped'::text OR missing_source_sequence_range IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "trigger_snapshot_append_audits_json_safe_integer_check",
    "table_name": "trigger_snapshot_append_audits",
    "required_definition_fragments": [
      "CHECK (source_sequence_no >= 1 AND source_sequence_no <= '9007199254740991'::bigint AND (append_sequence_no IS NULL OR append_sequence_no >= 0 AND append_sequence_no <= '9007199254740991'::bigint) AND (previous_snapshot_version IS NULL OR previous_snapshot_version >= 1 AND previous_snapshot_version <= '9007199254740991'::bigint) AND (next_snapshot_version IS NULL OR next_snapshot_version >= 1 AND next_snapshot_version <= '9007199254740991'::bigint))"
    ],
    "semantic_constraint": {
      "kind": "integer_ranges",
      "column_name": "source_sequence_no",
      "ranges": [
        {
          "column_name": "source_sequence_no",
          "min": 1,
          "max": 9007199254740991,
          "nullable": false
        },
        {
          "column_name": "append_sequence_no",
          "min": 0,
          "max": 9007199254740991,
          "nullable": true
        },
        {
          "column_name": "previous_snapshot_version",
          "min": 1,
          "max": 9007199254740991,
          "nullable": true
        },
        {
          "column_name": "next_snapshot_version",
          "min": 1,
          "max": 9007199254740991,
          "nullable": true
        }
      ]
    }
  },
  {
    "constraint_name": "trigger_snapshot_append_audits_late_disposition_check",
    "table_name": "trigger_snapshot_append_audits",
    "required_definition_fragments": [
      "CHECK (result <> 'late_event_dlq'::text OR (late_event_disposition = ANY (ARRAY['audit_only'::text, 'repair_append_scheduled'::text])))"
    ]
  },
  {
    "constraint_name": "trigger_snapshot_append_audits_result_check",
    "table_name": "trigger_snapshot_append_audits",
    "required_definition_fragments": [
      "CHECK (result = ANY (ARRAY['appended'::text, 'duplicate_replayed'::text, 'pending_gap'::text, 'gap_skipped'::text, 'late_event_dlq'::text, 'repair_appended'::text, 'rejected'::text, 'failed'::text]))"
    ]
  },
  {
    "constraint_name": "trigger_snapshot_append_audits_source_service_check",
    "table_name": "trigger_snapshot_append_audits",
    "required_definition_fragments": [
      "CHECK (source_service = ANY (ARRAY['trigger_processor'::text, 'action_runtime'::text, 'meta_cognition'::text, 'memory'::text, 'knowthat'::text, 'skill_registry'::text, 'timer_trigger_app'::text, 'observation_gateway'::text]))"
    ]
  },
  {
    "constraint_name": "trigger_snapshot_append_cursors_last_append_sequence_no_check",
    "table_name": "trigger_snapshot_append_cursors",
    "required_definition_fragments": [
      "CHECK (last_append_sequence_no >= 0)"
    ]
  },
  {
    "constraint_name": "trigger_snapshot_append_cursors_last_sequence_by_source_check",
    "table_name": "trigger_snapshot_append_cursors",
    "required_definition_fragments": [
      "CHECK (jsonb_typeof(last_sequence_by_source) = 'object'::text)"
    ]
  },
  {
    "constraint_name": "trigger_snapshot_overflow_refs_check",
    "table_name": "trigger_snapshot_overflow_refs",
    "required_definition_fragments": [
      "CHECK (last_append_sequence_no >= first_append_sequence_no)"
    ]
  },
  {
    "constraint_name": "trigger_snapshot_overflow_refs_check1",
    "table_name": "trigger_snapshot_overflow_refs",
    "required_definition_fragments": [
      "CHECK (first_source_sequence_no IS NULL AND last_source_sequence_no IS NULL OR first_source_sequence_no IS NOT NULL AND last_source_sequence_no IS NOT NULL AND last_source_sequence_no >= first_source_sequence_no)"
    ]
  },
  {
    "constraint_name": "trigger_snapshot_overflow_refs_checksum_algorithm_check",
    "table_name": "trigger_snapshot_overflow_refs",
    "required_definition_fragments": [
      "CHECK (checksum_algorithm = 'sha256'::text)"
    ]
  },
  {
    "constraint_name": "trigger_snapshot_overflow_refs_json_safe_integer_check",
    "table_name": "trigger_snapshot_overflow_refs",
    "required_definition_fragments": [
      "CHECK (first_append_sequence_no >= 0 AND first_append_sequence_no <= '9007199254740991'::bigint AND last_append_sequence_no >= 0 AND last_append_sequence_no <= '9007199254740991'::bigint AND (first_source_sequence_no IS NULL OR first_source_sequence_no >= 1 AND first_source_sequence_no <= '9007199254740991'::bigint) AND (last_source_sequence_no IS NULL OR last_source_sequence_no >= 1 AND last_source_sequence_no <= '9007199254740991'::bigint))"
    ],
    "semantic_constraint": {
      "kind": "integer_ranges",
      "column_name": "first_append_sequence_no",
      "ranges": [
        {
          "column_name": "first_append_sequence_no",
          "min": 0,
          "max": 9007199254740991,
          "nullable": false
        },
        {
          "column_name": "last_append_sequence_no",
          "min": 0,
          "max": 9007199254740991,
          "nullable": false
        },
        {
          "column_name": "first_source_sequence_no",
          "min": 1,
          "max": 9007199254740991,
          "nullable": true
        },
        {
          "column_name": "last_source_sequence_no",
          "min": 1,
          "max": 9007199254740991,
          "nullable": true
        }
      ]
    }
  },
  {
    "constraint_name": "trigger_snapshot_overflow_refs_redaction_state_check",
    "table_name": "trigger_snapshot_overflow_refs",
    "required_definition_fragments": [
      "CHECK (redaction_state = ANY (ARRAY['not_required'::text, 'complete'::text]))"
    ]
  },
  {
    "constraint_name": "trigger_snapshot_overflow_refs_retention_check",
    "table_name": "trigger_snapshot_overflow_refs",
    "required_definition_fragments": [
      "CHECK (retention_until > created_at)"
    ]
  },
  {
    "constraint_name": "trigger_snapshot_overflow_refs_schema_version_check",
    "table_name": "trigger_snapshot_overflow_refs",
    "required_definition_fragments": [
      "CHECK (schema_version = 'snapshot_overflow_ref.v1'::text)"
    ]
  },
  {
    "constraint_name": "trigger_snapshot_overflow_refs_source_service_check",
    "table_name": "trigger_snapshot_overflow_refs",
    "required_definition_fragments": [
      "CHECK (source_service = ANY (ARRAY['trigger_processor'::text, 'action_runtime'::text, 'meta_cognition'::text, 'memory'::text, 'knowthat'::text, 'skill_registry'::text, 'timer_trigger_app'::text, 'observation_gateway'::text]))"
    ]
  },
  {
    "constraint_name": "trigger_snapshot_pending_events_json_safe_integer_check",
    "table_name": "trigger_snapshot_pending_events",
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
    "constraint_name": "trigger_snapshot_pending_events_source_service_check",
    "table_name": "trigger_snapshot_pending_events",
    "required_definition_fragments": [
      "CHECK (source_service = ANY (ARRAY['trigger_processor'::text, 'action_runtime'::text, 'meta_cognition'::text, 'memory'::text, 'knowthat'::text, 'skill_registry'::text, 'timer_trigger_app'::text, 'observation_gateway'::text]))"
    ]
  },
  {
    "constraint_name": "trigger_snapshot_pending_events_status_check",
    "table_name": "trigger_snapshot_pending_events",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['pending'::text, 'ready'::text, 'appended'::text, 'retry_wait'::text, 'failed'::text, 'gap_skipped'::text, 'late_event_dlq'::text]))"
    ]
  },
  {
    "constraint_name": "trigger_snapshot_repair_jobs_repair_type_check",
    "table_name": "trigger_snapshot_repair_jobs",
    "required_definition_fragments": [
      "CHECK (repair_type = ANY (ARRAY['redis_cache'::text, 'durable_snapshot'::text]))"
    ]
  },
  {
    "constraint_name": "trigger_snapshot_repair_jobs_status_check",
    "table_name": "trigger_snapshot_repair_jobs",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['queued'::text, 'running'::text, 'rebuilding'::text, 'awaiting_meta_ack'::text, 'retry_wait'::text, 'completed'::text, 'failed'::text]))"
    ]
  },
  {
    "constraint_name": "trigger_snapshot_repair_meta_ack_check",
    "table_name": "trigger_snapshot_repair_jobs",
    "required_definition_fragments": [
      "CHECK (status <> 'awaiting_meta_ack'::text OR meta_job_id IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "trigger_submit_attempts_audit_payload_check",
    "table_name": "trigger_submit_attempts",
    "required_definition_fragments": [
      "CHECK (jsonb_typeof(audit_payload) = 'object'::text AND NOT audit_payload ?| ARRAY['authorization'::text, 'bearer_token'::text, 'raw_payload'::text, 'signature'::text, 'jwt'::text, 'claims'::text])"
    ]
  },
  {
    "constraint_name": "trigger_submit_attempts_check",
    "table_name": "trigger_submit_attempts",
    "required_definition_fragments": [
      "CHECK ((verified_principal_type IS NULL) = (verified_principal_id IS NULL))"
    ]
  },
  {
    "constraint_name": "trigger_submit_attempts_check1",
    "table_name": "trigger_submit_attempts",
    "required_definition_fragments": [
      "CHECK (verified_workspace_id IS NULL AND verified_bot_id IS NULL AND verified_owner_agent_id IS NULL AND verified_deployment_environment IS NULL AND verified_release_channel IS NULL OR verified_workspace_id IS NOT NULL AND verified_bot_id IS NOT NULL AND verified_owner_agent_id IS NOT NULL AND verified_deployment_environment IS NOT NULL AND verified_release_channel IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "trigger_submit_attempts_check2",
    "table_name": "trigger_submit_attempts",
    "required_definition_fragments": [
      "CHECK (stage = 'pre_admission'::text AND trigger_id IS NULL OR stage = 'business_admission'::text AND trigger_id IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "trigger_submit_attempts_claimed_actor_id_check",
    "table_name": "trigger_submit_attempts",
    "required_definition_fragments": [
      "CHECK (claimed_actor_id IS NULL OR length(claimed_actor_id) >= 1 AND length(claimed_actor_id) <= 256)"
    ]
  },
  {
    "constraint_name": "trigger_submit_attempts_claimed_actor_type_check",
    "table_name": "trigger_submit_attempts",
    "required_definition_fragments": [
      "CHECK (claimed_actor_type IS NULL OR length(claimed_actor_type) >= 1 AND length(claimed_actor_type) <= 64)"
    ]
  },
  {
    "constraint_name": "trigger_submit_attempts_claimed_bot_id_check",
    "table_name": "trigger_submit_attempts",
    "required_definition_fragments": [
      "CHECK (claimed_bot_id IS NULL OR length(claimed_bot_id) >= 1 AND length(claimed_bot_id) <= 256)"
    ]
  },
  {
    "constraint_name": "trigger_submit_attempts_claimed_dedupe_key_check",
    "table_name": "trigger_submit_attempts",
    "required_definition_fragments": [
      "CHECK (claimed_dedupe_key IS NULL OR length(claimed_dedupe_key) >= 1 AND length(claimed_dedupe_key) <= 512)"
    ]
  },
  {
    "constraint_name": "trigger_submit_attempts_claimed_deployment_environment_check",
    "table_name": "trigger_submit_attempts",
    "required_definition_fragments": [
      "CHECK (claimed_deployment_environment IS NULL OR length(claimed_deployment_environment) >= 1 AND length(claimed_deployment_environment) <= 64)"
    ]
  },
  {
    "constraint_name": "trigger_submit_attempts_claimed_owner_agent_id_check",
    "table_name": "trigger_submit_attempts",
    "required_definition_fragments": [
      "CHECK (claimed_owner_agent_id IS NULL OR length(claimed_owner_agent_id) >= 1 AND length(claimed_owner_agent_id) <= 256)"
    ]
  },
  {
    "constraint_name": "trigger_submit_attempts_claimed_release_channel_check",
    "table_name": "trigger_submit_attempts",
    "required_definition_fragments": [
      "CHECK (claimed_release_channel IS NULL OR length(claimed_release_channel) >= 1 AND length(claimed_release_channel) <= 64)"
    ]
  },
  {
    "constraint_name": "trigger_submit_attempts_claimed_source_check",
    "table_name": "trigger_submit_attempts",
    "required_definition_fragments": [
      "CHECK (claimed_source IS NULL OR length(claimed_source) >= 1 AND length(claimed_source) <= 64)"
    ]
  },
  {
    "constraint_name": "trigger_submit_attempts_claimed_workspace_id_check",
    "table_name": "trigger_submit_attempts",
    "required_definition_fragments": [
      "CHECK (claimed_workspace_id IS NULL OR length(claimed_workspace_id) >= 1 AND length(claimed_workspace_id) <= 256)"
    ]
  },
  {
    "constraint_name": "trigger_submit_attempts_outcome_check",
    "table_name": "trigger_submit_attempts",
    "required_definition_fragments": [
      "CHECK (outcome = ANY (ARRAY['accepted'::text, 'rejected'::text, 'duplicate_replayed'::text, 'rate_limited'::text, 'schema_invalid'::text, 'authentication_failed'::text, 'permission_denied'::text, 'bot_not_found'::text, 'identity_invalid'::text]))"
    ]
  },
  {
    "constraint_name": "trigger_submit_attempts_stage_check",
    "table_name": "trigger_submit_attempts",
    "required_definition_fragments": [
      "CHECK (stage = ANY (ARRAY['pre_admission'::text, 'business_admission'::text]))"
    ]
  },
  {
    "constraint_name": "trigger_submit_attempts_verified_deployment_environment_check",
    "table_name": "trigger_submit_attempts",
    "required_definition_fragments": [
      "CHECK (verified_deployment_environment IS NULL OR (verified_deployment_environment = ANY (ARRAY['local'::text, 'dev'::text, 'staging'::text, 'prod'::text])))"
    ]
  },
  {
    "constraint_name": "trigger_submit_attempts_verified_principal_type_check",
    "table_name": "trigger_submit_attempts",
    "required_definition_fragments": [
      "CHECK (verified_principal_type IS NULL OR (verified_principal_type = ANY (ARRAY['user'::text, 'service'::text, 'agent'::text, 'developer'::text])))"
    ]
  },
  {
    "constraint_name": "trigger_submit_attempts_verified_release_channel_check",
    "table_name": "trigger_submit_attempts",
    "required_definition_fragments": [
      "CHECK (verified_release_channel IS NULL OR (verified_release_channel = ANY (ARRAY['stable'::text, 'canary'::text])))"
    ]
  },
  {
    "constraint_name": "triggers_actor_type_check",
    "table_name": "triggers",
    "required_definition_fragments": [
      "CHECK (actor_type = ANY (ARRAY['super_user'::text, 'user'::text, 'agent'::text, 'system'::text, 'developer'::text]))"
    ]
  },
  {
    "constraint_name": "triggers_dedupe_key_check",
    "table_name": "triggers",
    "required_definition_fragments": [
      "CHECK (length(dedupe_key) > 0)"
    ]
  },
  {
    "constraint_name": "triggers_deployment_environment_check",
    "table_name": "triggers",
    "required_definition_fragments": [
      "CHECK (deployment_environment = ANY (ARRAY['local'::text, 'dev'::text, 'staging'::text, 'prod'::text]))"
    ]
  },
  {
    "constraint_name": "triggers_priority_check",
    "table_name": "triggers",
    "required_definition_fragments": [
      "CHECK (priority = ANY (ARRAY['strong'::text, 'weak'::text]))"
    ]
  },
  {
    "constraint_name": "triggers_release_channel_check",
    "table_name": "triggers",
    "required_definition_fragments": [
      "CHECK (release_channel = ANY (ARRAY['stable'::text, 'canary'::text]))"
    ]
  },
  {
    "constraint_name": "triggers_request_hash_check",
    "table_name": "triggers",
    "required_definition_fragments": [
      "CHECK (length(request_hash) > 0)"
    ]
  },
  {
    "constraint_name": "triggers_source_check",
    "table_name": "triggers",
    "required_definition_fragments": [
      "CHECK (source = ANY (ARRAY['chat'::text, 'notification'::text, 'timer'::text]))"
    ]
  },
  {
    "constraint_name": "triggers_status_check",
    "table_name": "triggers",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['accepted'::text, 'rejected'::text]))"
    ]
  },
  {
    "constraint_name": "weak_trigger_groups_actor_type_check",
    "table_name": "weak_trigger_groups",
    "required_definition_fragments": [
      "CHECK (actor_type = ANY (ARRAY['super_user'::text, 'user'::text, 'agent'::text, 'system'::text, 'developer'::text]))"
    ]
  },
  {
    "constraint_name": "weak_trigger_groups_check",
    "table_name": "weak_trigger_groups",
    "required_definition_fragments": [
      "CHECK (merge_window_until >= first_item_at)"
    ]
  },
  {
    "constraint_name": "weak_trigger_groups_check1",
    "table_name": "weak_trigger_groups",
    "required_definition_fragments": [
      "CHECK (max_queue_age_expires_at >= merge_window_until)"
    ]
  },
  {
    "constraint_name": "weak_trigger_groups_check2",
    "table_name": "weak_trigger_groups",
    "required_definition_fragments": [
      "CHECK (status <> 'promoted'::text OR canonical_process_id IS NOT NULL)"
    ]
  },
  {
    "constraint_name": "weak_trigger_groups_deployment_environment_check",
    "table_name": "weak_trigger_groups",
    "required_definition_fragments": [
      "CHECK (deployment_environment = ANY (ARRAY['local'::text, 'dev'::text, 'staging'::text, 'prod'::text]))"
    ]
  },
  {
    "constraint_name": "weak_trigger_groups_release_channel_check",
    "table_name": "weak_trigger_groups",
    "required_definition_fragments": [
      "CHECK (release_channel = ANY (ARRAY['stable'::text, 'canary'::text]))"
    ]
  },
  {
    "constraint_name": "weak_trigger_groups_source_check",
    "table_name": "weak_trigger_groups",
    "required_definition_fragments": [
      "CHECK (source = ANY (ARRAY['chat'::text, 'notification'::text, 'timer'::text]))"
    ]
  },
  {
    "constraint_name": "weak_trigger_groups_status_check",
    "table_name": "weak_trigger_groups",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['pending'::text, 'promoted'::text, 'merged'::text, 'expired'::text, 'cancelled'::text]))"
    ]
  },
  {
    "constraint_name": "weak_trigger_queue_items_check",
    "table_name": "weak_trigger_queue_items",
    "required_definition_fragments": [
      "CHECK (available_at <= expires_at)"
    ]
  },
  {
    "constraint_name": "weak_trigger_queue_items_check1",
    "table_name": "weak_trigger_queue_items",
    "required_definition_fragments": [
      "CHECK (expires_at > created_at)"
    ]
  },
  {
    "constraint_name": "weak_trigger_queue_items_status_check",
    "table_name": "weak_trigger_queue_items",
    "required_definition_fragments": [
      "CHECK (status = ANY (ARRAY['pending'::text, 'merged'::text, 'promoted'::text, 'expired'::text, 'cancelled'::text]))"
    ]
  }
] as const;

export const TRIGGER_PROCESSOR_DATABASE_FUNCTIONS_V1 = [] as const;

export const TRIGGER_PROCESSOR_DATABASE_TRIGGERS_V1 = [
  {
    "table_name": "bot_intent_policy_current",
    "trigger_name": "bot_intent_policy_current_guard",
    "enabled_mode": "O",
    "trigger_type": 23,
    "trigger_argument_count": 0,
    "update_columns": "",
    "constraint_trigger": false,
    "has_when_clause": false,
    "has_old_transition_table": false,
    "has_new_transition_table": false,
    "function_schema": "trigger_processor",
    "function_name": "guard_bot_intent_policy_current",
    "security_definer": false,
    "settings": null,
    "language_name": "plpgsql",
    "function_body_sha256": "sha256:da45e3981b8a0043e3eaf34c165113af70c2b0e06338133972ed35f68eaacd54"
  },
  {
    "table_name": "bot_intent_policy_revisions",
    "trigger_name": "bot_intent_policy_revisions_immutable",
    "enabled_mode": "O",
    "trigger_type": 27,
    "trigger_argument_count": 0,
    "update_columns": "",
    "constraint_trigger": false,
    "has_when_clause": false,
    "has_old_transition_table": false,
    "has_new_transition_table": false,
    "function_schema": "trigger_processor",
    "function_name": "reject_immutable_intent_policy_mutation",
    "security_definer": false,
    "settings": null,
    "language_name": "plpgsql",
    "function_body_sha256": "sha256:4abf9bba9e957518abdfc4f87b151bd8e023cf37c5da1e636209b0c0caf327ad"
  },
  {
    "table_name": "intent_policy_snapshots",
    "trigger_name": "intent_policy_snapshots_immutable",
    "enabled_mode": "O",
    "trigger_type": 27,
    "trigger_argument_count": 0,
    "update_columns": "",
    "constraint_trigger": false,
    "has_when_clause": false,
    "has_old_transition_table": false,
    "has_new_transition_table": false,
    "function_schema": "trigger_processor",
    "function_name": "reject_immutable_intent_policy_mutation",
    "security_definer": false,
    "settings": null,
    "language_name": "plpgsql",
    "function_body_sha256": "sha256:4abf9bba9e957518abdfc4f87b151bd8e023cf37c5da1e636209b0c0caf327ad"
  },
  {
    "table_name": "trigger_processes",
    "trigger_name": "trigger_processes_admission_order_immutable",
    "enabled_mode": "O",
    "trigger_type": 19,
    "trigger_argument_count": 0,
    "update_columns": "44 45",
    "constraint_trigger": false,
    "has_when_clause": false,
    "has_old_transition_table": false,
    "has_new_transition_table": false,
    "function_schema": "trigger_processor",
    "function_name": "prevent_admission_order_mutation",
    "security_definer": false,
    "settings": null,
    "language_name": "plpgsql",
    "function_body_sha256": "sha256:1e71d5904722683c39a08e916efab0a9038a5d446af6ca39c2b330d3db1b5aeb"
  }
] as const;

export const TRIGGER_PROCESSOR_DATABASE_UNIQUE_CONSTRAINTS_V1 = [
  {
    "constraint_name": "bot_foreground_slots_pkey",
    "table_name": "bot_foreground_slots",
    "columns": [
      "bot_id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "bot_foreground_slots_process_id_key",
    "table_name": "bot_foreground_slots",
    "columns": [
      "process_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "bot_intent_policy_audit_logs_pkey",
    "table_name": "bot_intent_policy_audit_logs",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "bot_intent_policy_current_pkey",
    "table_name": "bot_intent_policy_current",
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
    "constraint_name": "bot_intent_policy_revisions_id_workspace_id_bot_id_owner_a_key1",
    "table_name": "bot_intent_policy_revisions",
    "columns": [
      "id",
      "workspace_id",
      "bot_id",
      "owner_agent_id",
      "deployment_environment",
      "release_channel",
      "revision_no",
      "personality_ref",
      "personality_version",
      "personality_hash",
      "safety_boundaries_ref",
      "safety_boundaries_version",
      "safety_boundaries_hash"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "bot_intent_policy_revisions_id_workspace_id_bot_id_owner_ag_key",
    "table_name": "bot_intent_policy_revisions",
    "columns": [
      "id",
      "workspace_id",
      "bot_id",
      "owner_agent_id",
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
    "constraint_name": "bot_intent_policy_revisions_pkey",
    "table_name": "bot_intent_policy_revisions",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "bot_intent_policy_revisions_workspace_id_bot_id_owner_agent_key",
    "table_name": "bot_intent_policy_revisions",
    "columns": [
      "workspace_id",
      "bot_id",
      "owner_agent_id",
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
    "constraint_name": "bot_permission_bindings_pkey",
    "table_name": "bot_permission_bindings",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "bots_permission_scope_fk_key",
    "table_name": "bots",
    "columns": [
      "workspace_id",
      "id",
      "deployment_environment",
      "release_channel"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "bots_pkey",
    "table_name": "bots",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "bots_workspace_id_id_owner_agent_id_deployment_environment__key",
    "table_name": "bots",
    "columns": [
      "workspace_id",
      "id",
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
    "constraint_name": "intent_policy_snapshots_id_trigger_process_id_intent_versio_key",
    "table_name": "intent_policy_snapshots",
    "columns": [
      "id",
      "trigger_process_id",
      "intent_version",
      "snapshot_hash"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "intent_policy_snapshots_pkey",
    "table_name": "intent_policy_snapshots",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "intent_policy_snapshots_trigger_process_id_intent_version_key",
    "table_name": "intent_policy_snapshots",
    "columns": [
      "trigger_process_id",
      "intent_version"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_start_reservations_pkey",
    "table_name": "runtime_start_reservations",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_start_reservations_reserved_runtime_run_id_key",
    "table_name": "runtime_start_reservations",
    "columns": [
      "reserved_runtime_run_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_start_reservations_trigger_process_id_start_attempt_key",
    "table_name": "runtime_start_reservations",
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
    "constraint_name": "trigger_command_dlq_pkey",
    "table_name": "trigger_command_dlq",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "trigger_command_dlq_resolutions_dlq_id_key",
    "table_name": "trigger_command_dlq_resolutions",
    "columns": [
      "dlq_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "trigger_command_dlq_resolutions_idempotency_key_key",
    "table_name": "trigger_command_dlq_resolutions",
    "columns": [
      "idempotency_key"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "trigger_command_dlq_resolutions_pkey",
    "table_name": "trigger_command_dlq_resolutions",
    "columns": [
      "resolution_id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "trigger_command_outbox_pkey",
    "table_name": "trigger_command_outbox",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "trigger_command_outbox_target_idempotency_key_key",
    "table_name": "trigger_command_outbox",
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
    "constraint_name": "trigger_confirmation_challenges_pkey",
    "table_name": "trigger_confirmation_challenges",
    "columns": [
      "challenge_id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "trigger_context_source_outcom_trigger_process_id_context_ve_key",
    "table_name": "trigger_context_source_outcomes",
    "columns": [
      "trigger_process_id",
      "context_version",
      "source"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "trigger_context_source_outcomes_pkey",
    "table_name": "trigger_context_source_outcomes",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "trigger_event_dlq_pkey",
    "table_name": "trigger_event_dlq",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "trigger_event_dlq_resolutions_dlq_id_key",
    "table_name": "trigger_event_dlq_resolutions",
    "columns": [
      "dlq_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "trigger_event_dlq_resolutions_idempotency_key_key",
    "table_name": "trigger_event_dlq_resolutions",
    "columns": [
      "idempotency_key"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "trigger_event_dlq_resolutions_pkey",
    "table_name": "trigger_event_dlq_resolutions",
    "columns": [
      "resolution_id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "trigger_event_inbox_pkey",
    "table_name": "trigger_event_inbox",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "trigger_event_inbox_source_event_id_key",
    "table_name": "trigger_event_inbox",
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
    "constraint_name": "trigger_event_inbox_source_idempotency_key_key",
    "table_name": "trigger_event_inbox",
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
    "constraint_name": "trigger_event_outbox_pkey",
    "table_name": "trigger_event_outbox",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "trigger_event_outbox_target_idempotency_key_key",
    "table_name": "trigger_event_outbox",
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
    "constraint_name": "trigger_process_cancel_reques_trigger_process_id_idempotenc_key",
    "table_name": "trigger_process_cancel_requests",
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
    "constraint_name": "trigger_process_cancel_requests_pkey",
    "table_name": "trigger_process_cancel_requests",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "trigger_process_event_projections_event_id_key",
    "table_name": "trigger_process_event_projections",
    "columns": [
      "event_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "trigger_process_event_projections_pkey",
    "table_name": "trigger_process_event_projections",
    "columns": [
      "trigger_process_id",
      "append_sequence_no"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "trigger_process_meta_projections_pkey",
    "table_name": "trigger_process_meta_projections",
    "columns": [
      "trigger_process_id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "trigger_process_snapshots_pkey",
    "table_name": "trigger_process_snapshots",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "trigger_process_snapshots_trigger_process_id_snapshot_hash_key",
    "table_name": "trigger_process_snapshots",
    "columns": [
      "trigger_process_id",
      "snapshot_hash"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "trigger_process_snapshots_trigger_process_id_snapshot_versi_key",
    "table_name": "trigger_process_snapshots",
    "columns": [
      "trigger_process_id",
      "snapshot_version"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "trigger_process_transitions_pkey",
    "table_name": "trigger_process_transitions",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "trigger_process_work_items_pkey",
    "table_name": "trigger_process_work_items",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "trigger_process_work_items_trigger_process_id_idempotency_k_key",
    "table_name": "trigger_process_work_items",
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
    "constraint_name": "trigger_processes_bot_id_id_key",
    "table_name": "trigger_processes",
    "columns": [
      "bot_id",
      "id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "trigger_processes_id_workspace_id_bot_id_owner_agent_id_dep_key",
    "table_name": "trigger_processes",
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
    "constraint_name": "trigger_processes_pkey",
    "table_name": "trigger_processes",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "trigger_processes_trigger_id_key",
    "table_name": "trigger_processes",
    "columns": [
      "trigger_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "trigger_snapshot_append_audit_trigger_process_id_append_seq_key",
    "table_name": "trigger_snapshot_append_audits",
    "columns": [
      "trigger_process_id",
      "append_sequence_no"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "trigger_snapshot_append_audit_trigger_process_id_source_ser_key",
    "table_name": "trigger_snapshot_append_audits",
    "columns": [
      "trigger_process_id",
      "source_service",
      "source_event_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "trigger_snapshot_append_audits_pkey",
    "table_name": "trigger_snapshot_append_audits",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "trigger_snapshot_append_cursors_pkey",
    "table_name": "trigger_snapshot_append_cursors",
    "columns": [
      "trigger_process_id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "trigger_snapshot_overflow_ref_snapshot_id_source_service_ob_key",
    "table_name": "trigger_snapshot_overflow_refs",
    "columns": [
      "snapshot_id",
      "source_service",
      "object_ref"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "trigger_snapshot_overflow_refs_pkey",
    "table_name": "trigger_snapshot_overflow_refs",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "trigger_snapshot_pending_even_source_service_source_event_i_key",
    "table_name": "trigger_snapshot_pending_events",
    "columns": [
      "source_service",
      "source_event_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "trigger_snapshot_pending_even_trigger_process_id_idempotenc_key",
    "table_name": "trigger_snapshot_pending_events",
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
    "constraint_name": "trigger_snapshot_pending_events_pkey",
    "table_name": "trigger_snapshot_pending_events",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "trigger_snapshot_repair_jobs_idempotency_key_key",
    "table_name": "trigger_snapshot_repair_jobs",
    "columns": [
      "idempotency_key"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "trigger_snapshot_repair_jobs_pkey",
    "table_name": "trigger_snapshot_repair_jobs",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "trigger_submit_attempts_pkey",
    "table_name": "trigger_submit_attempts",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "triggers_bot_id_source_dedupe_key_key",
    "table_name": "triggers",
    "columns": [
      "bot_id",
      "source",
      "dedupe_key"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "triggers_pkey",
    "table_name": "triggers",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "weak_trigger_groups_pkey",
    "table_name": "weak_trigger_groups",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "weak_trigger_queue_items_pkey",
    "table_name": "weak_trigger_queue_items",
    "columns": [
      "id"
    ],
    "kind": "primary_key",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "weak_trigger_queue_items_trigger_id_key",
    "table_name": "weak_trigger_queue_items",
    "columns": [
      "trigger_id"
    ],
    "kind": "unique",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  }
] as const;

export const TRIGGER_PROCESSOR_DATABASE_INDEXES_V1 = [
  {
    "index_name": "bot_foreground_slots_pkey",
    "table_name": "bot_foreground_slots",
    "definition": "CREATE UNIQUE INDEX bot_foreground_slots_pkey ON trigger_processor.bot_foreground_slots USING btree (bot_id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "bot_foreground_slots_process_id_key",
    "table_name": "bot_foreground_slots",
    "definition": "CREATE UNIQUE INDEX bot_foreground_slots_process_id_key ON trigger_processor.bot_foreground_slots USING btree (process_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "bot_intent_policy_audit_logs_pkey",
    "table_name": "bot_intent_policy_audit_logs",
    "definition": "CREATE UNIQUE INDEX bot_intent_policy_audit_logs_pkey ON trigger_processor.bot_intent_policy_audit_logs USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "bot_intent_policy_current_pkey",
    "table_name": "bot_intent_policy_current",
    "definition": "CREATE UNIQUE INDEX bot_intent_policy_current_pkey ON trigger_processor.bot_intent_policy_current USING btree (workspace_id, bot_id, owner_agent_id, deployment_environment, release_channel)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "bot_intent_policy_revisions_id_workspace_id_bot_id_owner_a_key1",
    "table_name": "bot_intent_policy_revisions",
    "definition": "CREATE UNIQUE INDEX bot_intent_policy_revisions_id_workspace_id_bot_id_owner_a_key1 ON trigger_processor.bot_intent_policy_revisions USING btree (id, workspace_id, bot_id, owner_agent_id, deployment_environment, release_channel, revision_no, personality_ref, personality_version, personality_hash, safety_boundaries_ref, safety_boundaries_version, safety_boundaries_hash)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "bot_intent_policy_revisions_id_workspace_id_bot_id_owner_ag_key",
    "table_name": "bot_intent_policy_revisions",
    "definition": "CREATE UNIQUE INDEX bot_intent_policy_revisions_id_workspace_id_bot_id_owner_ag_key ON trigger_processor.bot_intent_policy_revisions USING btree (id, workspace_id, bot_id, owner_agent_id, deployment_environment, release_channel, revision_no)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "bot_intent_policy_revisions_pkey",
    "table_name": "bot_intent_policy_revisions",
    "definition": "CREATE UNIQUE INDEX bot_intent_policy_revisions_pkey ON trigger_processor.bot_intent_policy_revisions USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "bot_intent_policy_revisions_workspace_id_bot_id_owner_agent_key",
    "table_name": "bot_intent_policy_revisions",
    "definition": "CREATE UNIQUE INDEX bot_intent_policy_revisions_workspace_id_bot_id_owner_agent_key ON trigger_processor.bot_intent_policy_revisions USING btree (workspace_id, bot_id, owner_agent_id, deployment_environment, release_channel, revision_no)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "bot_permission_bindings_active_uq",
    "table_name": "bot_permission_bindings",
    "definition": "CREATE UNIQUE INDEX bot_permission_bindings_active_uq ON trigger_processor.bot_permission_bindings USING btree (workspace_id, bot_id, principal_type, principal_id, deployment_environment, release_channel, permission_scope) WHERE (status = 'active'::text)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "bot_permission_bindings_pkey",
    "table_name": "bot_permission_bindings",
    "definition": "CREATE UNIQUE INDEX bot_permission_bindings_pkey ON trigger_processor.bot_permission_bindings USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "bots_permission_scope_fk_key",
    "table_name": "bots",
    "definition": "CREATE UNIQUE INDEX bots_permission_scope_fk_key ON trigger_processor.bots USING btree (workspace_id, id, deployment_environment, release_channel)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "bots_pkey",
    "table_name": "bots",
    "definition": "CREATE UNIQUE INDEX bots_pkey ON trigger_processor.bots USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "bots_workspace_id_id_owner_agent_id_deployment_environment__key",
    "table_name": "bots",
    "definition": "CREATE UNIQUE INDEX bots_workspace_id_id_owner_agent_id_deployment_environment__key ON trigger_processor.bots USING btree (workspace_id, id, owner_agent_id, deployment_environment, release_channel)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "eventing_transport_epochs_pkey",
    "table_name": "eventing_transport_epochs",
    "definition": "CREATE UNIQUE INDEX eventing_transport_epochs_pkey ON trigger_processor.eventing_transport_epochs USING btree (transport_name)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "intent_policy_snapshots_id_trigger_process_id_intent_versio_key",
    "table_name": "intent_policy_snapshots",
    "definition": "CREATE UNIQUE INDEX intent_policy_snapshots_id_trigger_process_id_intent_versio_key ON trigger_processor.intent_policy_snapshots USING btree (id, trigger_process_id, intent_version, snapshot_hash)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "intent_policy_snapshots_pkey",
    "table_name": "intent_policy_snapshots",
    "definition": "CREATE UNIQUE INDEX intent_policy_snapshots_pkey ON trigger_processor.intent_policy_snapshots USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "intent_policy_snapshots_trigger_process_id_intent_version_key",
    "table_name": "intent_policy_snapshots",
    "definition": "CREATE UNIQUE INDEX intent_policy_snapshots_trigger_process_id_intent_version_key ON trigger_processor.intent_policy_snapshots USING btree (trigger_process_id, intent_version)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "runtime_start_reservations_dispatch_idx",
    "table_name": "runtime_start_reservations",
    "definition": "CREATE INDEX runtime_start_reservations_dispatch_idx ON trigger_processor.runtime_start_reservations USING btree (status, created_at, trigger_process_id, start_attempt_no) WHERE (status = ANY (ARRAY['reserved'::text, 'dispatching'::text, 'cancel_requested'::text]))",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "runtime_start_reservations_pkey",
    "table_name": "runtime_start_reservations",
    "definition": "CREATE UNIQUE INDEX runtime_start_reservations_pkey ON trigger_processor.runtime_start_reservations USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "runtime_start_reservations_reserved_runtime_run_id_key",
    "table_name": "runtime_start_reservations",
    "definition": "CREATE UNIQUE INDEX runtime_start_reservations_reserved_runtime_run_id_key ON trigger_processor.runtime_start_reservations USING btree (reserved_runtime_run_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "runtime_start_reservations_trigger_process_id_start_attempt_key",
    "table_name": "runtime_start_reservations",
    "definition": "CREATE UNIQUE INDEX runtime_start_reservations_trigger_process_id_start_attempt_key ON trigger_processor.runtime_start_reservations USING btree (trigger_process_id, start_attempt_no)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_command_dlq_pkey",
    "table_name": "trigger_command_dlq",
    "definition": "CREATE UNIQUE INDEX trigger_command_dlq_pkey ON trigger_processor.trigger_command_dlq USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "trigger_command_dlq_resolutions_dlq_id_key",
    "table_name": "trigger_command_dlq_resolutions",
    "definition": "CREATE UNIQUE INDEX trigger_command_dlq_resolutions_dlq_id_key ON trigger_processor.trigger_command_dlq_resolutions USING btree (dlq_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_command_dlq_resolutions_idempotency_key_key",
    "table_name": "trigger_command_dlq_resolutions",
    "definition": "CREATE UNIQUE INDEX trigger_command_dlq_resolutions_idempotency_key_key ON trigger_processor.trigger_command_dlq_resolutions USING btree (idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_command_dlq_resolutions_pkey",
    "table_name": "trigger_command_dlq_resolutions",
    "definition": "CREATE UNIQUE INDEX trigger_command_dlq_resolutions_pkey ON trigger_processor.trigger_command_dlq_resolutions USING btree (resolution_id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "trigger_command_outbox_dispatch_idx",
    "table_name": "trigger_command_outbox",
    "definition": "CREATE INDEX trigger_command_outbox_dispatch_idx ON trigger_processor.trigger_command_outbox USING btree (status, next_retry_at, created_at) WHERE (status = ANY (ARRAY['pending'::text, 'retry_wait'::text]))",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_command_outbox_pkey",
    "table_name": "trigger_command_outbox",
    "definition": "CREATE UNIQUE INDEX trigger_command_outbox_pkey ON trigger_processor.trigger_command_outbox USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "trigger_command_outbox_target_idempotency_key_key",
    "table_name": "trigger_command_outbox",
    "definition": "CREATE UNIQUE INDEX trigger_command_outbox_target_idempotency_key_key ON trigger_processor.trigger_command_outbox USING btree (target, idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_confirmation_challenges_pending_uq",
    "table_name": "trigger_confirmation_challenges",
    "definition": "CREATE UNIQUE INDEX trigger_confirmation_challenges_pending_uq ON trigger_processor.trigger_confirmation_challenges USING btree (trigger_process_id, intent_version) WHERE (status = 'pending'::text)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_confirmation_challenges_pkey",
    "table_name": "trigger_confirmation_challenges",
    "definition": "CREATE UNIQUE INDEX trigger_confirmation_challenges_pkey ON trigger_processor.trigger_confirmation_challenges USING btree (challenge_id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "trigger_confirmation_challenges_replay_uq",
    "table_name": "trigger_confirmation_challenges",
    "definition": "CREATE UNIQUE INDEX trigger_confirmation_challenges_replay_uq ON trigger_processor.trigger_confirmation_challenges USING btree (challenge_id, idempotency_key) WHERE (idempotency_key IS NOT NULL)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_confirmation_stage_work_uq",
    "table_name": "trigger_confirmation_challenges",
    "definition": "CREATE UNIQUE INDEX trigger_confirmation_stage_work_uq ON trigger_processor.trigger_confirmation_challenges USING btree (stage_execute_work_id) WHERE (stage_execute_work_id IS NOT NULL)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_context_source_outcom_trigger_process_id_context_ve_key",
    "table_name": "trigger_context_source_outcomes",
    "definition": "CREATE UNIQUE INDEX trigger_context_source_outcom_trigger_process_id_context_ve_key ON trigger_processor.trigger_context_source_outcomes USING btree (trigger_process_id, context_version, source)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_context_source_outcomes_pkey",
    "table_name": "trigger_context_source_outcomes",
    "definition": "CREATE UNIQUE INDEX trigger_context_source_outcomes_pkey ON trigger_processor.trigger_context_source_outcomes USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "trigger_event_dlq_pkey",
    "table_name": "trigger_event_dlq",
    "definition": "CREATE UNIQUE INDEX trigger_event_dlq_pkey ON trigger_processor.trigger_event_dlq USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "trigger_event_dlq_resolutions_dlq_id_key",
    "table_name": "trigger_event_dlq_resolutions",
    "definition": "CREATE UNIQUE INDEX trigger_event_dlq_resolutions_dlq_id_key ON trigger_processor.trigger_event_dlq_resolutions USING btree (dlq_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_event_dlq_resolutions_idempotency_key_key",
    "table_name": "trigger_event_dlq_resolutions",
    "definition": "CREATE UNIQUE INDEX trigger_event_dlq_resolutions_idempotency_key_key ON trigger_processor.trigger_event_dlq_resolutions USING btree (idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_event_dlq_resolutions_pkey",
    "table_name": "trigger_event_dlq_resolutions",
    "definition": "CREATE UNIQUE INDEX trigger_event_dlq_resolutions_pkey ON trigger_processor.trigger_event_dlq_resolutions USING btree (resolution_id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "trigger_event_inbox_pkey",
    "table_name": "trigger_event_inbox",
    "definition": "CREATE UNIQUE INDEX trigger_event_inbox_pkey ON trigger_processor.trigger_event_inbox USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "trigger_event_inbox_source_event_id_key",
    "table_name": "trigger_event_inbox",
    "definition": "CREATE UNIQUE INDEX trigger_event_inbox_source_event_id_key ON trigger_processor.trigger_event_inbox USING btree (source, event_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_event_inbox_source_idempotency_key_key",
    "table_name": "trigger_event_inbox",
    "definition": "CREATE UNIQUE INDEX trigger_event_inbox_source_idempotency_key_key ON trigger_processor.trigger_event_inbox USING btree (source, idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_event_outbox_pkey",
    "table_name": "trigger_event_outbox",
    "definition": "CREATE UNIQUE INDEX trigger_event_outbox_pkey ON trigger_processor.trigger_event_outbox USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "trigger_event_outbox_reconciliation_due_idx",
    "table_name": "trigger_event_outbox",
    "definition": "CREATE INDEX trigger_event_outbox_reconciliation_due_idx ON trigger_processor.trigger_event_outbox USING btree (reconciliation_next_probe_at NULLS FIRST, sent_at, id) WHERE (status = 'sent'::text)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_event_outbox_reconciliation_generation_idx",
    "table_name": "trigger_event_outbox",
    "definition": "CREATE INDEX trigger_event_outbox_reconciliation_generation_idx ON trigger_processor.trigger_event_outbox USING btree (transport_epoch, transport_generation, sent_at, id) WHERE (status = 'sent'::text)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_event_outbox_reconciliation_transport_ref_idx",
    "table_name": "trigger_event_outbox",
    "definition": "CREATE INDEX trigger_event_outbox_reconciliation_transport_ref_idx ON trigger_processor.trigger_event_outbox USING btree (transport_ref, transport_epoch, transport_generation) WHERE ((status = 'sent'::text) AND (transport_ref IS NOT NULL))",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_event_outbox_target_idempotency_key_key",
    "table_name": "trigger_event_outbox",
    "definition": "CREATE UNIQUE INDEX trigger_event_outbox_target_idempotency_key_key ON trigger_processor.trigger_event_outbox USING btree (target, idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_processor_outbox_dispatch_idx",
    "table_name": "trigger_event_outbox",
    "definition": "CREATE INDEX trigger_processor_outbox_dispatch_idx ON trigger_processor.trigger_event_outbox USING btree (status, next_retry_at, created_at) WHERE (status = ANY (ARRAY['pending'::text, 'retry_wait'::text]))",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_process_cancel_reconcile_idx",
    "table_name": "trigger_process_cancel_requests",
    "definition": "CREATE INDEX trigger_process_cancel_reconcile_idx ON trigger_processor.trigger_process_cancel_requests USING btree (status, created_at, trigger_process_id) WHERE (status = ANY (ARRAY['runtime_handling'::text, 'reconciliation_required'::text]))",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_process_cancel_reques_trigger_process_id_idempotenc_key",
    "table_name": "trigger_process_cancel_requests",
    "definition": "CREATE UNIQUE INDEX trigger_process_cancel_reques_trigger_process_id_idempotenc_key ON trigger_processor.trigger_process_cancel_requests USING btree (trigger_process_id, idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_process_cancel_requests_pkey",
    "table_name": "trigger_process_cancel_requests",
    "definition": "CREATE UNIQUE INDEX trigger_process_cancel_requests_pkey ON trigger_processor.trigger_process_cancel_requests USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "trigger_process_cancel_runtime_signal_uq",
    "table_name": "trigger_process_cancel_requests",
    "definition": "CREATE UNIQUE INDEX trigger_process_cancel_runtime_signal_uq ON trigger_processor.trigger_process_cancel_requests USING btree (runtime_signal_id) WHERE (runtime_signal_id IS NOT NULL)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_process_event_projection_retention_idx",
    "table_name": "trigger_process_event_projections",
    "definition": "CREATE INDEX trigger_process_event_projection_retention_idx ON trigger_processor.trigger_process_event_projections USING btree (retention_until, trigger_process_id, append_sequence_no)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_process_event_projections_event_id_key",
    "table_name": "trigger_process_event_projections",
    "definition": "CREATE UNIQUE INDEX trigger_process_event_projections_event_id_key ON trigger_processor.trigger_process_event_projections USING btree (event_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_process_event_projections_pkey",
    "table_name": "trigger_process_event_projections",
    "definition": "CREATE UNIQUE INDEX trigger_process_event_projections_pkey ON trigger_processor.trigger_process_event_projections USING btree (trigger_process_id, append_sequence_no)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "trigger_process_meta_job_uq",
    "table_name": "trigger_process_meta_projections",
    "definition": "CREATE UNIQUE INDEX trigger_process_meta_job_uq ON trigger_processor.trigger_process_meta_projections USING btree (meta_job_id) WHERE (meta_job_id IS NOT NULL)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_process_meta_projections_pkey",
    "table_name": "trigger_process_meta_projections",
    "definition": "CREATE UNIQUE INDEX trigger_process_meta_projections_pkey ON trigger_processor.trigger_process_meta_projections USING btree (trigger_process_id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "trigger_process_meta_result_uq",
    "table_name": "trigger_process_meta_projections",
    "definition": "CREATE UNIQUE INDEX trigger_process_meta_result_uq ON trigger_processor.trigger_process_meta_projections USING btree (meta_result_id) WHERE (meta_result_id IS NOT NULL)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_process_snapshots_current_uq",
    "table_name": "trigger_process_snapshots",
    "definition": "CREATE UNIQUE INDEX trigger_process_snapshots_current_uq ON trigger_processor.trigger_process_snapshots USING btree (trigger_process_id) WHERE (status = 'current'::text)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_process_snapshots_pkey",
    "table_name": "trigger_process_snapshots",
    "definition": "CREATE UNIQUE INDEX trigger_process_snapshots_pkey ON trigger_processor.trigger_process_snapshots USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "trigger_process_snapshots_retention_idx",
    "table_name": "trigger_process_snapshots",
    "definition": "CREATE INDEX trigger_process_snapshots_retention_idx ON trigger_processor.trigger_process_snapshots USING btree (status, retention_until)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_process_snapshots_trigger_process_id_snapshot_hash_key",
    "table_name": "trigger_process_snapshots",
    "definition": "CREATE UNIQUE INDEX trigger_process_snapshots_trigger_process_id_snapshot_hash_key ON trigger_processor.trigger_process_snapshots USING btree (trigger_process_id, snapshot_hash)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_process_snapshots_trigger_process_id_snapshot_versi_key",
    "table_name": "trigger_process_snapshots",
    "definition": "CREATE UNIQUE INDEX trigger_process_snapshots_trigger_process_id_snapshot_versi_key ON trigger_processor.trigger_process_snapshots USING btree (trigger_process_id, snapshot_version)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_process_transitions_pkey",
    "table_name": "trigger_process_transitions",
    "definition": "CREATE UNIQUE INDEX trigger_process_transitions_pkey ON trigger_processor.trigger_process_transitions USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "trigger_process_work_claim_idx",
    "table_name": "trigger_process_work_items",
    "definition": "CREATE INDEX trigger_process_work_claim_idx ON trigger_processor.trigger_process_work_items USING btree (next_retry_at, created_at, id) WHERE (status = ANY (ARRAY['pending'::text, 'retry_wait'::text]))",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_process_work_items_pkey",
    "table_name": "trigger_process_work_items",
    "definition": "CREATE UNIQUE INDEX trigger_process_work_items_pkey ON trigger_processor.trigger_process_work_items USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "trigger_process_work_items_trigger_process_id_idempotency_k_key",
    "table_name": "trigger_process_work_items",
    "definition": "CREATE UNIQUE INDEX trigger_process_work_items_trigger_process_id_idempotency_k_key ON trigger_processor.trigger_process_work_items USING btree (trigger_process_id, idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_process_work_lease_expiry_idx",
    "table_name": "trigger_process_work_items",
    "definition": "CREATE INDEX trigger_process_work_lease_expiry_idx ON trigger_processor.trigger_process_work_items USING btree (lease_until, lease_generation, id) WHERE (status = 'leased'::text)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_processes_bot_id_id_key",
    "table_name": "trigger_processes",
    "definition": "CREATE UNIQUE INDEX trigger_processes_bot_id_id_key ON trigger_processor.trigger_processes USING btree (bot_id, id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_processes_bot_process_uq",
    "table_name": "trigger_processes",
    "definition": "CREATE UNIQUE INDEX trigger_processes_bot_process_uq ON trigger_processor.trigger_processes USING btree (bot_id, id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_processes_id_workspace_id_bot_id_owner_agent_id_dep_key",
    "table_name": "trigger_processes",
    "definition": "CREATE UNIQUE INDEX trigger_processes_id_workspace_id_bot_id_owner_agent_id_dep_key ON trigger_processor.trigger_processes USING btree (id, workspace_id, bot_id, owner_agent_id, deployment_environment, release_channel)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_processes_identity_idx",
    "table_name": "trigger_processes",
    "definition": "CREATE UNIQUE INDEX trigger_processes_identity_idx ON trigger_processor.trigger_processes USING btree (bot_id, owner_agent_id, deployment_environment, release_channel, id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_processes_pkey",
    "table_name": "trigger_processes",
    "definition": "CREATE UNIQUE INDEX trigger_processes_pkey ON trigger_processor.trigger_processes USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "trigger_processes_preempt_candidate_uq",
    "table_name": "trigger_processes",
    "definition": "CREATE UNIQUE INDEX trigger_processes_preempt_candidate_uq ON trigger_processor.trigger_processes USING btree (bot_id) WHERE ((phase = 'admission'::text) AND (status = 'waiting'::text) AND (priority = 'strong'::text) AND (wait_reason = 'preempt_commit'::text))",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_processes_strong_fifo_idx",
    "table_name": "trigger_processes",
    "definition": "CREATE INDEX trigger_processes_strong_fifo_idx ON trigger_processor.trigger_processes USING btree (bot_id, admission_time, id) WHERE ((phase = 'admission'::text) AND (status = 'waiting'::text) AND (priority = 'strong'::text))",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_processes_trigger_id_key",
    "table_name": "trigger_processes",
    "definition": "CREATE UNIQUE INDEX trigger_processes_trigger_id_key ON trigger_processor.trigger_processes USING btree (trigger_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_processor_trigger_processes_bot_phase_status_idx",
    "table_name": "trigger_processes",
    "definition": "CREATE INDEX trigger_processor_trigger_processes_bot_phase_status_idx ON trigger_processor.trigger_processes USING btree (bot_id, phase, status, updated_at DESC)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_processor_trigger_processes_cooldown_idx",
    "table_name": "trigger_processes",
    "definition": "CREATE INDEX trigger_processor_trigger_processes_cooldown_idx ON trigger_processor.trigger_processes USING btree (cooldown_until) WHERE (phase = 'cooldown'::text)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_snapshot_append_audit_trigger_process_id_append_seq_key",
    "table_name": "trigger_snapshot_append_audits",
    "definition": "CREATE UNIQUE INDEX trigger_snapshot_append_audit_trigger_process_id_append_seq_key ON trigger_processor.trigger_snapshot_append_audits USING btree (trigger_process_id, append_sequence_no)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_snapshot_append_audit_trigger_process_id_source_ser_key",
    "table_name": "trigger_snapshot_append_audits",
    "definition": "CREATE UNIQUE INDEX trigger_snapshot_append_audit_trigger_process_id_source_ser_key ON trigger_processor.trigger_snapshot_append_audits USING btree (trigger_process_id, source_service, source_event_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_snapshot_append_audits_pkey",
    "table_name": "trigger_snapshot_append_audits",
    "definition": "CREATE UNIQUE INDEX trigger_snapshot_append_audits_pkey ON trigger_processor.trigger_snapshot_append_audits USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "trigger_snapshot_append_cursors_pkey",
    "table_name": "trigger_snapshot_append_cursors",
    "definition": "CREATE UNIQUE INDEX trigger_snapshot_append_cursors_pkey ON trigger_processor.trigger_snapshot_append_cursors USING btree (trigger_process_id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "trigger_snapshot_overflow_ref_snapshot_id_source_service_ob_key",
    "table_name": "trigger_snapshot_overflow_refs",
    "definition": "CREATE UNIQUE INDEX trigger_snapshot_overflow_ref_snapshot_id_source_service_ob_key ON trigger_processor.trigger_snapshot_overflow_refs USING btree (snapshot_id, source_service, object_ref)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_snapshot_overflow_refs_pkey",
    "table_name": "trigger_snapshot_overflow_refs",
    "definition": "CREATE UNIQUE INDEX trigger_snapshot_overflow_refs_pkey ON trigger_processor.trigger_snapshot_overflow_refs USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "trigger_snapshot_pending_even_source_service_source_event_i_key",
    "table_name": "trigger_snapshot_pending_events",
    "definition": "CREATE UNIQUE INDEX trigger_snapshot_pending_even_source_service_source_event_i_key ON trigger_processor.trigger_snapshot_pending_events USING btree (source_service, source_event_id)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_snapshot_pending_even_trigger_process_id_idempotenc_key",
    "table_name": "trigger_snapshot_pending_events",
    "definition": "CREATE UNIQUE INDEX trigger_snapshot_pending_even_trigger_process_id_idempotenc_key ON trigger_processor.trigger_snapshot_pending_events USING btree (trigger_process_id, idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_snapshot_pending_events_pkey",
    "table_name": "trigger_snapshot_pending_events",
    "definition": "CREATE UNIQUE INDEX trigger_snapshot_pending_events_pkey ON trigger_processor.trigger_snapshot_pending_events USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "trigger_snapshot_pending_events_scan_idx",
    "table_name": "trigger_snapshot_pending_events",
    "definition": "CREATE INDEX trigger_snapshot_pending_events_scan_idx ON trigger_processor.trigger_snapshot_pending_events USING btree (status, next_retry_at, trigger_process_id, source_service, source_sequence_no) WHERE (status = ANY (ARRAY['pending'::text, 'ready'::text, 'retry_wait'::text]))",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_snapshot_repair_jobs_idempotency_key_key",
    "table_name": "trigger_snapshot_repair_jobs",
    "definition": "CREATE UNIQUE INDEX trigger_snapshot_repair_jobs_idempotency_key_key ON trigger_processor.trigger_snapshot_repair_jobs USING btree (idempotency_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_snapshot_repair_jobs_pkey",
    "table_name": "trigger_snapshot_repair_jobs",
    "definition": "CREATE UNIQUE INDEX trigger_snapshot_repair_jobs_pkey ON trigger_processor.trigger_snapshot_repair_jobs USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "trigger_snapshot_repair_jobs_scan_idx",
    "table_name": "trigger_snapshot_repair_jobs",
    "definition": "CREATE INDEX trigger_snapshot_repair_jobs_scan_idx ON trigger_processor.trigger_snapshot_repair_jobs USING btree (status, next_retry_at, created_at) WHERE (status = ANY (ARRAY['queued'::text, 'retry_wait'::text, 'awaiting_meta_ack'::text]))",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_submit_attempts_claimed_lookup_idx",
    "table_name": "trigger_submit_attempts",
    "definition": "CREATE INDEX trigger_submit_attempts_claimed_lookup_idx ON trigger_processor.trigger_submit_attempts USING btree (claimed_bot_id, claimed_source, claimed_dedupe_key, created_at DESC)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_submit_attempts_pkey",
    "table_name": "trigger_submit_attempts",
    "definition": "CREATE UNIQUE INDEX trigger_submit_attempts_pkey ON trigger_processor.trigger_submit_attempts USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "trigger_submit_attempts_verified_lookup_idx",
    "table_name": "trigger_submit_attempts",
    "definition": "CREATE INDEX trigger_submit_attempts_verified_lookup_idx ON trigger_processor.trigger_submit_attempts USING btree (verified_bot_id, verified_permission_scope, created_at DESC)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "trigger_processor_triggers_bot_received_idx",
    "table_name": "triggers",
    "definition": "CREATE INDEX trigger_processor_triggers_bot_received_idx ON trigger_processor.triggers USING btree (bot_id, received_at DESC)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "triggers_bot_id_source_dedupe_key_key",
    "table_name": "triggers",
    "definition": "CREATE UNIQUE INDEX triggers_bot_id_source_dedupe_key_key ON trigger_processor.triggers USING btree (bot_id, source, dedupe_key)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "triggers_pkey",
    "table_name": "triggers",
    "definition": "CREATE UNIQUE INDEX triggers_pkey ON trigger_processor.triggers USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "weak_trigger_groups_active_uq",
    "table_name": "weak_trigger_groups",
    "definition": "CREATE UNIQUE INDEX weak_trigger_groups_active_uq ON trigger_processor.weak_trigger_groups USING btree (bot_id, merge_group_key) WHERE (status = 'pending'::text)",
    "unique": true,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "weak_trigger_groups_pkey",
    "table_name": "weak_trigger_groups",
    "definition": "CREATE UNIQUE INDEX weak_trigger_groups_pkey ON trigger_processor.weak_trigger_groups USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "trigger_processor_weak_queue_claim_idx",
    "table_name": "weak_trigger_queue_items",
    "definition": "CREATE INDEX trigger_processor_weak_queue_claim_idx ON trigger_processor.weak_trigger_queue_items USING btree (bot_id, status, available_at, locked_until) WHERE (status = 'pending'::text)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "weak_trigger_queue_group_scan_idx",
    "table_name": "weak_trigger_queue_items",
    "definition": "CREATE INDEX weak_trigger_queue_group_scan_idx ON trigger_processor.weak_trigger_queue_items USING btree (bot_id, weak_group_id, status, available_at, expires_at)",
    "unique": false,
    "primary": false,
    "valid": true
  },
  {
    "index_name": "weak_trigger_queue_items_pkey",
    "table_name": "weak_trigger_queue_items",
    "definition": "CREATE UNIQUE INDEX weak_trigger_queue_items_pkey ON trigger_processor.weak_trigger_queue_items USING btree (id)",
    "unique": true,
    "primary": true,
    "valid": true
  },
  {
    "index_name": "weak_trigger_queue_items_trigger_id_key",
    "table_name": "weak_trigger_queue_items",
    "definition": "CREATE UNIQUE INDEX weak_trigger_queue_items_trigger_id_key ON trigger_processor.weak_trigger_queue_items USING btree (trigger_id)",
    "unique": true,
    "primary": false,
    "valid": true
  }
] as const;

export const TRIGGER_PROCESSOR_FOREIGN_KEYS_V1 = [
  {
    "constraint_name": "bot_foreground_slots_bot_id_fkey",
    "table_name": "bot_foreground_slots",
    "columns": [
      "bot_id"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "bots",
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
    "constraint_name": "bot_foreground_slots_bot_id_process_id_fkey",
    "table_name": "bot_foreground_slots",
    "columns": [
      "bot_id",
      "process_id"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "trigger_processes",
    "referenced_columns": [
      "bot_id",
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
    "constraint_name": "bot_foreground_slots_process_id_fkey",
    "table_name": "bot_foreground_slots",
    "columns": [
      "process_id"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "trigger_processes",
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
    "constraint_name": "bot_intent_policy_audit_logs_revision_id_fkey",
    "table_name": "bot_intent_policy_audit_logs",
    "columns": [
      "revision_id"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "bot_intent_policy_revisions",
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
    "constraint_name": "bot_intent_policy_current_bot_policy_revision_id_workspace_fkey",
    "table_name": "bot_intent_policy_current",
    "columns": [
      "bot_policy_revision_id",
      "workspace_id",
      "bot_id",
      "owner_agent_id",
      "deployment_environment",
      "release_channel",
      "current_revision_no"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "bot_intent_policy_revisions",
    "referenced_columns": [
      "id",
      "workspace_id",
      "bot_id",
      "owner_agent_id",
      "deployment_environment",
      "release_channel",
      "revision_no"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "bot_intent_policy_revisions_workspace_id_bot_id_owner_agen_fkey",
    "table_name": "bot_intent_policy_revisions",
    "columns": [
      "workspace_id",
      "bot_id",
      "owner_agent_id",
      "deployment_environment",
      "release_channel"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "bots",
    "referenced_columns": [
      "workspace_id",
      "id",
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
    "constraint_name": "bot_permission_bindings_workspace_id_bot_id_deployment_env_fkey",
    "table_name": "bot_permission_bindings",
    "columns": [
      "workspace_id",
      "bot_id",
      "owner_agent_id",
      "deployment_environment",
      "release_channel"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "bots",
    "referenced_columns": [
      "workspace_id",
      "id",
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
    "constraint_name": "intent_policy_snapshots_bot_policy_revision_id_workspace_i_fkey",
    "table_name": "intent_policy_snapshots",
    "columns": [
      "bot_policy_revision_id",
      "workspace_id",
      "bot_id",
      "owner_agent_id",
      "deployment_environment",
      "release_channel",
      "bot_policy_revision_no",
      "personality_ref",
      "personality_version",
      "personality_hash",
      "safety_boundaries_ref",
      "safety_boundaries_version",
      "safety_boundaries_hash"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "bot_intent_policy_revisions",
    "referenced_columns": [
      "id",
      "workspace_id",
      "bot_id",
      "owner_agent_id",
      "deployment_environment",
      "release_channel",
      "revision_no",
      "personality_ref",
      "personality_version",
      "personality_hash",
      "safety_boundaries_ref",
      "safety_boundaries_version",
      "safety_boundaries_hash"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "intent_policy_snapshots_trigger_process_id_workspace_id_bo_fkey",
    "table_name": "intent_policy_snapshots",
    "columns": [
      "trigger_process_id",
      "workspace_id",
      "bot_id",
      "owner_agent_id",
      "deployment_environment",
      "release_channel"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "trigger_processes",
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
    "constraint_name": "runtime_start_reservation_intent_policy_snapshot_fk",
    "table_name": "runtime_start_reservations",
    "columns": [
      "intent_policy_snapshot_ref",
      "trigger_process_id",
      "intent_version",
      "intent_policy_snapshot_hash"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "intent_policy_snapshots",
    "referenced_columns": [
      "id",
      "trigger_process_id",
      "intent_version",
      "snapshot_hash"
    ],
    "match_type": "simple",
    "on_update": "no_action",
    "on_delete": "no_action",
    "deferrable": false,
    "initially_deferred": false,
    "validated": true
  },
  {
    "constraint_name": "runtime_start_reservations_trigger_process_id_fkey",
    "table_name": "runtime_start_reservations",
    "columns": [
      "trigger_process_id"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "trigger_processes",
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
    "constraint_name": "trigger_command_dlq_resolutions_dlq_id_fkey",
    "table_name": "trigger_command_dlq_resolutions",
    "columns": [
      "dlq_id"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "trigger_command_dlq",
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
    "constraint_name": "trigger_confirmation_challeng_trigger_process_id_workspace_fkey",
    "table_name": "trigger_confirmation_challenges",
    "columns": [
      "trigger_process_id",
      "workspace_id",
      "bot_id",
      "owner_agent_id",
      "deployment_environment",
      "release_channel"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "trigger_processes",
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
    "constraint_name": "trigger_confirmation_challenges_stage_execute_work_id_fkey",
    "table_name": "trigger_confirmation_challenges",
    "columns": [
      "stage_execute_work_id"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "trigger_process_work_items",
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
    "constraint_name": "trigger_confirmation_challenges_trigger_process_id_fkey",
    "table_name": "trigger_confirmation_challenges",
    "columns": [
      "trigger_process_id"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "trigger_processes",
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
    "constraint_name": "trigger_context_source_outcomes_trigger_process_id_fkey",
    "table_name": "trigger_context_source_outcomes",
    "columns": [
      "trigger_process_id"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "trigger_processes",
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
    "constraint_name": "trigger_event_dlq_resolutions_dlq_id_fkey",
    "table_name": "trigger_event_dlq_resolutions",
    "columns": [
      "dlq_id"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "trigger_event_dlq",
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
    "constraint_name": "trigger_process_cancel_requests_trigger_process_id_fkey",
    "table_name": "trigger_process_cancel_requests",
    "columns": [
      "trigger_process_id"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "trigger_processes",
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
    "constraint_name": "trigger_process_event_projections_trigger_process_id_fkey",
    "table_name": "trigger_process_event_projections",
    "columns": [
      "trigger_process_id"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "trigger_processes",
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
    "constraint_name": "trigger_process_meta_projections_trigger_process_id_fkey",
    "table_name": "trigger_process_meta_projections",
    "columns": [
      "trigger_process_id"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "trigger_processes",
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
    "constraint_name": "trigger_process_snapshots_trigger_process_id_fkey",
    "table_name": "trigger_process_snapshots",
    "columns": [
      "trigger_process_id"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "trigger_processes",
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
    "constraint_name": "trigger_process_snapshots_trigger_process_id_workspace_id__fkey",
    "table_name": "trigger_process_snapshots",
    "columns": [
      "trigger_process_id",
      "workspace_id",
      "bot_id",
      "owner_agent_id",
      "deployment_environment",
      "release_channel"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "trigger_processes",
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
    "constraint_name": "trigger_process_transitions_trigger_process_id_fkey",
    "table_name": "trigger_process_transitions",
    "columns": [
      "trigger_process_id"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "trigger_processes",
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
    "constraint_name": "trigger_process_work_items_trigger_process_id_workspace_id_fkey",
    "table_name": "trigger_process_work_items",
    "columns": [
      "trigger_process_id",
      "workspace_id",
      "bot_id",
      "owner_agent_id",
      "deployment_environment",
      "release_channel"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "trigger_processes",
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
    "constraint_name": "trigger_processes_blocked_by_process_id_fkey",
    "table_name": "trigger_processes",
    "columns": [
      "blocked_by_process_id"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "trigger_processes",
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
    "constraint_name": "trigger_processes_canonical_process_id_fkey",
    "table_name": "trigger_processes",
    "columns": [
      "canonical_process_id"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "trigger_processes",
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
    "constraint_name": "trigger_processes_current_snapshot_id_fkey",
    "table_name": "trigger_processes",
    "columns": [
      "current_snapshot_id"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "trigger_process_snapshots",
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
    "constraint_name": "trigger_processes_inherited_from_process_id_fkey",
    "table_name": "trigger_processes",
    "columns": [
      "inherited_from_process_id"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "trigger_processes",
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
    "constraint_name": "trigger_processes_merged_into_process_id_fkey",
    "table_name": "trigger_processes",
    "columns": [
      "merged_into_process_id"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "trigger_processes",
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
    "constraint_name": "trigger_processes_preempted_by_process_id_fkey",
    "table_name": "trigger_processes",
    "columns": [
      "preempted_by_process_id"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "trigger_processes",
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
    "constraint_name": "trigger_processes_successor_process_id_fkey",
    "table_name": "trigger_processes",
    "columns": [
      "successor_process_id"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "trigger_processes",
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
    "constraint_name": "trigger_processes_superseded_by_process_id_fkey",
    "table_name": "trigger_processes",
    "columns": [
      "superseded_by_process_id"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "trigger_processes",
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
    "constraint_name": "trigger_processes_trigger_id_fkey",
    "table_name": "trigger_processes",
    "columns": [
      "trigger_id"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "triggers",
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
    "constraint_name": "trigger_processes_workspace_id_bot_id_owner_agent_id_deplo_fkey",
    "table_name": "trigger_processes",
    "columns": [
      "workspace_id",
      "bot_id",
      "owner_agent_id",
      "deployment_environment",
      "release_channel"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "bots",
    "referenced_columns": [
      "workspace_id",
      "id",
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
    "constraint_name": "trigger_snapshot_append_audits_snapshot_id_fkey",
    "table_name": "trigger_snapshot_append_audits",
    "columns": [
      "snapshot_id"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "trigger_process_snapshots",
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
    "constraint_name": "trigger_snapshot_append_audits_trigger_process_id_fkey",
    "table_name": "trigger_snapshot_append_audits",
    "columns": [
      "trigger_process_id"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "trigger_processes",
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
    "constraint_name": "trigger_snapshot_append_cursors_trigger_process_id_fkey",
    "table_name": "trigger_snapshot_append_cursors",
    "columns": [
      "trigger_process_id"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "trigger_processes",
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
    "constraint_name": "trigger_snapshot_overflow_refs_snapshot_id_fkey",
    "table_name": "trigger_snapshot_overflow_refs",
    "columns": [
      "snapshot_id"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "trigger_process_snapshots",
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
    "constraint_name": "trigger_snapshot_pending_events_trigger_process_id_fkey",
    "table_name": "trigger_snapshot_pending_events",
    "columns": [
      "trigger_process_id"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "trigger_processes",
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
    "constraint_name": "trigger_snapshot_repair_jobs_next_snapshot_id_fkey",
    "table_name": "trigger_snapshot_repair_jobs",
    "columns": [
      "next_snapshot_id"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "trigger_process_snapshots",
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
    "constraint_name": "trigger_snapshot_repair_jobs_previous_snapshot_id_fkey",
    "table_name": "trigger_snapshot_repair_jobs",
    "columns": [
      "previous_snapshot_id"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "trigger_process_snapshots",
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
    "constraint_name": "trigger_snapshot_repair_jobs_trigger_process_id_fkey",
    "table_name": "trigger_snapshot_repair_jobs",
    "columns": [
      "trigger_process_id"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "trigger_processes",
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
    "constraint_name": "trigger_submit_attempts_trigger_id_fkey",
    "table_name": "trigger_submit_attempts",
    "columns": [
      "trigger_id"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "triggers",
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
    "constraint_name": "trigger_submit_attempts_verified_workspace_id_verified_bot_fkey",
    "table_name": "trigger_submit_attempts",
    "columns": [
      "verified_workspace_id",
      "verified_bot_id",
      "verified_owner_agent_id",
      "verified_deployment_environment",
      "verified_release_channel"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "bots",
    "referenced_columns": [
      "workspace_id",
      "id",
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
    "constraint_name": "triggers_workspace_id_bot_id_owner_agent_id_deployment_env_fkey",
    "table_name": "triggers",
    "columns": [
      "workspace_id",
      "bot_id",
      "owner_agent_id",
      "deployment_environment",
      "release_channel"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "bots",
    "referenced_columns": [
      "workspace_id",
      "id",
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
    "constraint_name": "weak_trigger_groups_canonical_process_id_fkey",
    "table_name": "weak_trigger_groups",
    "columns": [
      "canonical_process_id"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "trigger_processes",
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
    "constraint_name": "weak_trigger_groups_cooldown_process_id_fkey",
    "table_name": "weak_trigger_groups",
    "columns": [
      "cooldown_process_id"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "trigger_processes",
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
    "constraint_name": "weak_trigger_groups_workspace_id_bot_id_owner_agent_id_dep_fkey",
    "table_name": "weak_trigger_groups",
    "columns": [
      "workspace_id",
      "bot_id",
      "owner_agent_id",
      "deployment_environment",
      "release_channel"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "bots",
    "referenced_columns": [
      "workspace_id",
      "id",
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
    "constraint_name": "weak_trigger_queue_items_bot_id_fkey",
    "table_name": "weak_trigger_queue_items",
    "columns": [
      "bot_id"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "bots",
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
    "constraint_name": "weak_trigger_queue_items_group_fk",
    "table_name": "weak_trigger_queue_items",
    "columns": [
      "weak_group_id"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "weak_trigger_groups",
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
    "constraint_name": "weak_trigger_queue_items_trigger_id_fkey",
    "table_name": "weak_trigger_queue_items",
    "columns": [
      "trigger_id"
    ],
    "referenced_schema": "trigger_processor",
    "referenced_table": "triggers",
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
