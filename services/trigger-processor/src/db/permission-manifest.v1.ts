import {
  TRIGGER_PROCESSOR_DATABASE_COLUMNS_V1,
  TRIGGER_PROCESSOR_DATABASE_INDEXES_V1,
  TRIGGER_PROCESSOR_DATABASE_CHECKS_V1,
  TRIGGER_PROCESSOR_DATABASE_FUNCTIONS_V1,
  TRIGGER_PROCESSOR_DATABASE_TRIGGERS_V1,
  TRIGGER_PROCESSOR_DATABASE_UNIQUE_CONSTRAINTS_V1,
  TRIGGER_PROCESSOR_FOREIGN_KEYS_V1,
} from "./catalog-snapshot.generated.v1.js";
import { TRIGGER_PROCESSOR_WRITER_ARTIFACTS_V1 } from "./writer-artifacts.generated.v1.js";
import {
  META_ENQUEUE_REASONS_V1,
  OWNER_DURABLE_EVENT_TYPES_V1,
  TERMINAL_OUTCOMES_V1,
} from "@pai/contracts";
import {
  defineOwnerRepositoryContractV1,
  ownerDlqResolutionContractV1,
  ownerEventingReconciliationContractV1,
  ownerEventingTransportEpochActivationSignatureV1,
  ownerEventingTransportEpochTablePermissionV1,
  ownerFunctionSignatureV1,
  type OwnerRepositoryPortV1,
  type OwnerUnitOfWorkPortV1,
} from "@pai/persistence";

const TRIGGER_EVENT_DLQ_RESOLUTION_V1 = ownerDlqResolutionContractV1(
  "trigger_processor",
  "trigger_event_dlq",
);
const TRIGGER_EVENT_RECONCILIATION_V1 =
  ownerEventingReconciliationContractV1(
    "trigger_processor",
    "trigger_event_outbox",
  );
const TRIGGER_COMMAND_DLQ_RESOLUTION_V1 = ownerDlqResolutionContractV1(
  "trigger_processor",
  "trigger_command_dlq",
);

const RUNTIME_START_PROCESS_LOCK_V1 = Object.freeze({
  key_prefix: "trigger_processor:runtime_start_reservation_process:",
  identity_arguments: Object.freeze(["p_process_id"] as const),
  separator: ":" as const,
  order: 1,
});

const RUNTIME_START_CLAIMED_OUTBOX_PROCESS_LOCK_V1 = Object.freeze({
  key_prefix: "trigger_processor:runtime_start_reservation_process:",
  identity_arguments: Object.freeze([] as const),
  identity_source: "claimed_outbox_aggregate_id" as const,
  separator: ":" as const,
  order: 1,
});

const RUNTIME_START_ATTEMPT_LOCK_V1 = Object.freeze({
  key_prefix: "trigger_processor:runtime_start_reservation:",
  identity_arguments: Object.freeze([
    "p_process_id",
    "p_start_attempt_no",
  ] as const),
  separator: ":" as const,
  order: 2,
});

const RUNTIME_START_BOT_SLOT_LOCK_V1 = Object.freeze({
  key_prefix: "trigger_processor:foreground_slot:",
  identity_arguments: Object.freeze(["p_bot_id"] as const),
  separator: ":" as const,
  order: 3,
});

export const TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1 =
  defineOwnerRepositoryContractV1({
    contract_version: "owner_repository_contract.v1",
    owner_service: "trigger_processor",
    schema: "trigger_processor",
    app_role: "pai_trigger_processor_app",
    fresh_migrations: ["0100_trigger_processor"],
    manifest_source:
      "services/trigger-processor/src/db/permission-manifest.v1.ts",
    generated_permission_sql: [
      "pai-infra/supabase/generated/permissions/0100_trigger_processor.sql",
    ],
    tables: [
      "bots",
      "triggers",
      "trigger_processes",
      "trigger_process_work_items",
      "trigger_process_transitions",
      "trigger_context_source_outcomes",
      "trigger_process_meta_projections",
      "trigger_process_event_projections",
      "weak_trigger_queue_items",
      "trigger_event_outbox",
      "trigger_event_inbox",
      "trigger_event_dlq",
      TRIGGER_EVENT_DLQ_RESOLUTION_V1.resolution_table,
      "bot_permission_bindings",
      "runtime_start_reservations",
      "trigger_process_cancel_requests",
      "trigger_command_outbox",
      "trigger_command_dlq",
      TRIGGER_COMMAND_DLQ_RESOLUTION_V1.resolution_table,
      "bot_intent_policy_revisions",
      "bot_intent_policy_current",
      "bot_intent_policy_audit_logs",
      "intent_policy_snapshots",
      "bot_foreground_slots",
      "trigger_process_snapshots",
      "trigger_snapshot_overflow_refs",
      "trigger_snapshot_pending_events",
      "trigger_snapshot_append_audits",
      "trigger_snapshot_repair_jobs",
      "trigger_snapshot_append_cursors",
      "trigger_submit_attempts",
      "weak_trigger_groups",
      "trigger_confirmation_challenges",
      "eventing_transport_epochs",
    ],
    table_permissions: [
    {
      table_name: "bots",
      select_columns: ["id","workspace_id","owner_agent_id","deployment_environment","release_channel","name","super_user_id","status","timezone","locale","created_at","updated_at"],
      insert_columns: [],
      update_columns: [],
      delete_allowed: false,
      writer_kind: "projection_upsert",
    },
    {
      table_name: "triggers",
      select_columns: ["id","workspace_id","bot_id","owner_agent_id","deployment_environment","release_channel","source","actor_type","actor_id","payload","dedupe_key","request_hash","priority","status","received_at","created_at","authenticated_context"],
      insert_columns: [],
      update_columns: [],
      delete_allowed: false,
      writer_kind: "state_transition",
    },
    {
      table_name: "trigger_processes",
      select_columns: ["id","trigger_id","workspace_id","bot_id","owner_agent_id","deployment_environment","release_channel","admission_time","phase","status","wait_reason","current_reason_code","state_version","current_runtime_run_id","runtime_start_attempt_no","runtime_policy_created_at","runtime_policy_expires_at","current_snapshot_id","inherited_from_process_id","blocked_by_process_id","canonical_process_id","preempted_by_process_id","successor_process_id","superseded_by_process_id","preempt_commit_result","preempt_isolation_proof_ref","merged_into_process_id","merged_into_queue_item_id","terminal_reason","terminal_outcome","terminal_outcome_finalized_at","snapshot_transfer_ref","boundary_system_event_ref","canonical_reason_code","observation_finalized","meta_enqueue_reason","cancel_requested_at","cancellation_status","cancel_reason_code","cancel_actor_principal_id","cancel_actor_role","runtime_cancel_signal_id","cancellation_isolation_status","cancelled_at","cooldown_until","snapshot_retention_until","context_snapshot_ref","context_snapshot_version","context_snapshot_hash","context_snapshot_retention_until","intent_ref","priority","created_at","updated_at"],
      insert_columns: [],
      update_columns: [],
      delete_allowed: false,
      writer_kind: "state_transition",
    },
    {
      table_name: "trigger_process_work_items",
      select_columns: ["id","trigger_process_id","workspace_id","bot_id","owner_agent_id","deployment_environment","release_channel","work_kind","schema_version","expected_process_state_version","payload","payload_hash","status","attempt_count","next_retry_at","last_error","lease_owner","lease_token_hash","lease_generation","lease_until","ack_result_hash","completed_at","idempotency_key","trace_id","created_at","updated_at"],
      insert_columns: [],
      update_columns: [],
      delete_allowed: false,
      writer_kind: "outbox_claim_ack",
    },
    {
      table_name: "trigger_process_transitions",
      select_columns: ["id","trigger_process_id","from_phase","to_phase","from_status","to_status","reason_code","actor","source_ref","evidence_refs","previous_state","next_state","previous_state_version","resulting_state_version","schema_version","created_at"],
      insert_columns: [],
      update_columns: [],
      delete_allowed: false,
      writer_kind: "immutable_append",
    },
    {
      table_name: "trigger_context_source_outcomes",
      select_columns: ["id","trigger_process_id","context_version","source","status","source_owner","source_version","policy_id","reason_code","source_as_of","failure_reason","created_at"],
      insert_columns: [],
      update_columns: [],
      delete_allowed: false,
      writer_kind: "immutable_append",
    },
    {
      table_name: "trigger_process_meta_projections",
      select_columns: ["trigger_process_id","meta_job_id","meta_status","meta_result_id","result_version","result_status","result_finalized_at","active_compensation_count","active_repair_count","meta_summary_ref","projection_version","last_meta_event_sequence","last_meta_event_id","last_result_event_id","updated_at"],
      insert_columns: [],
      update_columns: [],
      delete_allowed: false,
      writer_kind: "projection_upsert",
    },
    {
      table_name: "trigger_process_event_projections",
      select_columns: ["trigger_process_id","append_sequence_no","event_id","event_type","schema_version","observation_summary","trace_id","occurred_at","retention_until","created_at"],
      insert_columns: [],
      update_columns: [],
      delete_allowed: false,
      writer_kind: "immutable_append",
    },
    {
      table_name: "weak_trigger_queue_items",
      select_columns: ["id","bot_id","trigger_id","weak_group_id","available_at","expires_at","status","summary","original_trigger_ids","locked_by","locked_until","created_at","updated_at"],
      insert_columns: [],
      update_columns: [],
      delete_allowed: false,
      writer_kind: "state_transition",
    },
    {
      table_name: "trigger_event_outbox",
      select_columns: ["id","aggregate_id","event_type","schema_version","producer","occurred_at","idempotency_key","trace_id","payload","payload_hash","target","status","next_retry_at","created_at","updated_at"],
      insert_columns: [],
      update_columns: [],
      delete_allowed: false,
      writer_kind: "outbox_claim_ack",
    },
    {
      table_name: "trigger_event_inbox",
      select_columns: ["id","source","event_id","scope_fingerprint","idempotency_key","payload_hash","semantic_hash","processed_at","created_at"],
      insert_columns: [],
      update_columns: [],
      delete_allowed: false,
      writer_kind: "immutable_append",
    },
    {
      table_name: "trigger_event_dlq",
      select_columns: ["id","source_event_id","event_type","payload","last_error","failed_at"],
      insert_columns: [],
      update_columns: [],
      delete_allowed: false,
      writer_kind: "immutable_append",
    },
    TRIGGER_EVENT_DLQ_RESOLUTION_V1.table_permission,
    {
      table_name: "bot_permission_bindings",
      select_columns: ["id","workspace_id","bot_id","owner_agent_id","principal_type","principal_id","deployment_environment","release_channel","permission_scope","status","source_version","created_at","updated_at"],
      insert_columns: [],
      update_columns: [],
      delete_allowed: false,
      writer_kind: "projection_upsert",
    },
    {
      table_name: "runtime_start_reservations",
      select_columns: ["id","trigger_process_id","start_attempt_no","reserved_runtime_run_id","start_fence_generation","start_fence_token_hash","request_hash","policy_schema_version","policy_input_ref","policy_input_hash","policy_canonical_bytes","policy_input_created_at","policy_expires_at","intent_policy_snapshot_ref","intent_version","intent_policy_snapshot_hash","status","claimed_at","cancel_requested_at","cancelled_at","started_at","completed_at","created_at","updated_at"],
      insert_columns: [],
      update_columns: [],
      delete_allowed: false,
      writer_kind: "state_transition",
    },
    {
      table_name: "trigger_process_cancel_requests",
      select_columns: ["id","trigger_process_id","idempotency_key","request_hash","reason_code","actor_principal_id","actor_role","actor_auth_context_ref","status","runtime_signal_id","fencing_generation","stopped_at_safe_point","isolation_status","isolation_proof_ref","result_payload","trace_id","created_at","completed_at"],
      insert_columns: [],
      update_columns: [],
      delete_allowed: false,
      writer_kind: "state_transition",
    },
    {
      table_name: "trigger_command_outbox",
      select_columns: ["id","aggregate_id","command_type","schema_version","producer","target","idempotency_key","request_hash","trace_id","payload","status","next_retry_at","last_error","created_at","updated_at"],
      insert_columns: [],
      update_columns: [],
      delete_allowed: false,
      writer_kind: "outbox_claim_ack",
    },
    {
      table_name: "trigger_command_dlq",
      select_columns: ["id","source_command_id","command_type","target","payload","request_hash","last_error","failed_at"],
      insert_columns: [],
      update_columns: [],
      delete_allowed: false,
      writer_kind: "immutable_append",
    },
    TRIGGER_COMMAND_DLQ_RESOLUTION_V1.table_permission,
    {
      table_name: "bot_intent_policy_revisions",
      select_columns: ["id","workspace_id","bot_id","owner_agent_id","deployment_environment","release_channel","revision_no","personality_ref","personality_version","personality_hash","safety_boundaries_ref","safety_boundaries_version","safety_boundaries_hash","effective_at","created_by_principal","change_reason","created_at"],
      insert_columns: [],
      update_columns: [],
      delete_allowed: false,
      writer_kind: "immutable_append",
    },
    {
      table_name: "bot_intent_policy_current",
      select_columns: ["workspace_id","bot_id","owner_agent_id","deployment_environment","release_channel","bot_policy_revision_id","current_revision_no","pointer_version","updated_at"],
      insert_columns: [],
      update_columns: [],
      delete_allowed: false,
      writer_kind: "pointer_cas",
    },
    {
      table_name: "bot_intent_policy_audit_logs",
      select_columns: ["id","workspace_id","bot_id","owner_agent_id","deployment_environment","release_channel","action","revision_id","actor_principal_id","payload","created_at"],
      insert_columns: [],
      update_columns: [],
      delete_allowed: false,
      writer_kind: "immutable_append",
    },
    {
      table_name: "intent_policy_snapshots",
      select_columns: ["id","schema_version","trigger_process_id","intent_version","workspace_id","bot_id","owner_agent_id","deployment_environment","release_channel","bot_policy_revision_id","bot_policy_revision_no","personality_ref","personality_version","personality_hash","safety_boundaries_ref","safety_boundaries_version","safety_boundaries_hash","tool_permission_profile_ref","tool_permission_profile_revision","tool_permission_profile_hash","tool_policy_epoch","catalog_version","catalog_as_of","security_revocation_epoch","skill_permission_summary_ref","skill_permission_summary_hash","canonical_bytes","snapshot_hash","created_at"],
      insert_columns: [],
      update_columns: [],
      delete_allowed: false,
      writer_kind: "immutable_append",
    },
    {
      table_name: "bot_foreground_slots",
      select_columns: ["bot_id","process_id","slot_generation","acquired_at","updated_at"],
      insert_columns: [],
      update_columns: [],
      delete_allowed: false,
      writer_kind: "lease_fence",
    },
    {
      table_name: "trigger_process_snapshots",
      select_columns: ["id","trigger_process_id","workspace_id","bot_id","owner_agent_id","deployment_environment","release_channel","schema_version","snapshot_version","snapshot_hash","snapshot_ref","context_snapshot_ref","context_snapshot_version","context_snapshot_hash","intent_ref","runtime_run_id","runtime_state","cooldown_until","policy_snapshot_id","personality_ref","personality_version","personality_hash","first_append_sequence_no","last_append_sequence_no","last_sequence_by_source","status","retention_until","created_at","superseded_at"],
      insert_columns: [],
      update_columns: [],
      delete_allowed: false,
      writer_kind: "state_transition",
    },
    {
      table_name: "trigger_snapshot_overflow_refs",
      select_columns: ["id","snapshot_id","schema_version","source_service","store_type","object_ref","first_append_sequence_no","last_append_sequence_no","first_source_sequence_no","last_source_sequence_no","checksum_algorithm","checksum","retention_until","redaction_state","created_at"],
      insert_columns: [],
      update_columns: [],
      delete_allowed: false,
      writer_kind: "immutable_append",
    },
    {
      table_name: "trigger_snapshot_pending_events",
      select_columns: ["id","trigger_process_id","source_service","source_event_id","source_sequence_no","append_type","payload_ref","payload_hash","status","idempotency_key","next_retry_at","last_error","created_at","updated_at"],
      insert_columns: [],
      update_columns: [],
      delete_allowed: false,
      writer_kind: "state_transition",
    },
    {
      table_name: "trigger_snapshot_append_audits",
      select_columns: ["id","trigger_process_id","snapshot_id","source_service","source_event_id","source_sequence_no","append_sequence_no","previous_snapshot_version","next_snapshot_version","previous_snapshot_hash","next_snapshot_hash","result","error","created_at"],
      insert_columns: [],
      update_columns: [],
      delete_allowed: false,
      writer_kind: "immutable_append",
    },
    {
      table_name: "trigger_snapshot_repair_jobs",
      select_columns: ["id","trigger_process_id","repair_type","idempotency_key","request_hash","previous_snapshot_id","next_snapshot_id","meta_job_id","status","next_retry_at","last_error","created_at","updated_at"],
      insert_columns: [],
      update_columns: [],
      delete_allowed: false,
      writer_kind: "state_transition",
    },
    {
      table_name: "trigger_snapshot_append_cursors",
      select_columns: ["trigger_process_id","last_append_sequence_no","last_sequence_by_source","updated_at"],
      insert_columns: [],
      update_columns: [],
      delete_allowed: false,
      writer_kind: "pointer_cas",
    },
    {
      table_name: "trigger_submit_attempts",
      select_columns: ["id","claimed_workspace_id","claimed_bot_id","claimed_owner_agent_id","claimed_deployment_environment","claimed_release_channel","claimed_source","claimed_actor_type","claimed_actor_id","claimed_dedupe_key","request_hash","canonical_audit_hash","verified_principal_type","verified_principal_id","verified_workload_issuer","verified_workload_subject","verified_workload_kid","verified_workspace_id","verified_bot_id","verified_owner_agent_id","verified_deployment_environment","verified_release_channel","verified_permission_scope","stage","outcome","result_code","retryable","trigger_id","trace_id","audit_payload","created_at"],
      insert_columns: [],
      update_columns: [],
      delete_allowed: false,
      writer_kind: "immutable_append",
    },
    {
      table_name: "weak_trigger_groups",
      select_columns: ["id","workspace_id","bot_id","owner_agent_id","deployment_environment","release_channel","source","actor_type","actor_id","normalized_topic_hint","cooldown_process_id","merge_group_key","first_item_at","merge_window_until","max_queue_age_expires_at","status","canonical_process_id","summary","created_at","updated_at"],
      insert_columns: [],
      update_columns: [],
      delete_allowed: false,
      writer_kind: "state_transition",
    },
    {
      table_name: "trigger_confirmation_challenges",
      select_columns: ["challenge_id","trigger_process_id","workspace_id","bot_id","owner_agent_id","deployment_environment","release_channel","intent_ref","intent_version","structured_intent_hash","policy_input_hash","action_step_ids","allowed_principal_type","allowed_principal_id","status","expires_at","request_hash","response_hash","confirmation_hash","stage_execute_work_id","idempotency_key","responded_by","responded_at","created_at","updated_at"],
      insert_columns: [],
      update_columns: [],
      delete_allowed: false,
      writer_kind: "state_transition",
    },
    ownerEventingTransportEpochTablePermissionV1(),
    ],
    mutable_writers: [
      ...TRIGGER_EVENT_DLQ_RESOLUTION_V1.mutable_writers,
      ...TRIGGER_COMMAND_DLQ_RESOLUTION_V1.mutable_writers,
      ...TRIGGER_EVENT_RECONCILIATION_V1.mutable_writers,
      "create_trigger_admission_v1",
      "record_trigger_submit_attempt_v1",
      "upsert_bot_authority_projection_v1",
      "advance_trigger_stage_v1",
      "schedule_trigger_stage_retry_v1",
      "upsert_trigger_meta_projection_v1",
      "finalize_trigger_meta_projection_v1",
      "create_runtime_start_reservation_v1",
      "record_runtime_started_v1",
      "record_runtime_start_uncertain_v1",
      "schedule_runtime_start_recompose_v1",
      "request_runtime_preempt_v1",
      "create_trigger_confirmation_challenge_v1",
      "accept_trigger_confirmation_v1",
      "reject_trigger_confirmation_v1",
      "expire_trigger_confirmation_v1",
      "request_trigger_cancel_v1",
      "requeue_failed_runtime_cancel_command_v1",
      "transition_trigger_cancel_request_v1",
      "enter_trigger_cooldown_v1",
      "finalize_trigger_runtime_terminal_v1",
      "apply_runtime_control_handled_v1",
      "enqueue_trigger_meta_job_v1",
      "claim_trigger_process_work_v1",
      "ack_trigger_process_work_v1",
      "claim_weak_trigger_queue_v1",
      "retry_weak_trigger_queue_item_v1",
      "complete_weak_trigger_queue_item_v1",
      "transition_weak_trigger_group_v1",
      "promote_weak_trigger_queue_head_v1",
      "promote_strong_fifo_head_v1",
      "cas_bot_intent_policy_current_v1",
      "release_bot_foreground_slot_v1",
      "append_trigger_snapshot_v1",
      "transition_trigger_snapshot_pending_event_v1",
      "schedule_trigger_snapshot_repair_v1",
      "dispatch_trigger_snapshot_repair_v1",
      "transition_trigger_snapshot_repair_job_v1",
      "claim_trigger_event_outbox_v1",
      "ack_trigger_event_outbox_v1",
      "claim_trigger_command_outbox_v1",
      "ack_trigger_command_outbox_v1",
      "activate_eventing_transport_epoch_v1",
    ],
    function_signatures: [
      ...TRIGGER_EVENT_DLQ_RESOLUTION_V1.function_signatures,
      ...TRIGGER_COMMAND_DLQ_RESOLUTION_V1.function_signatures,
      ...TRIGGER_EVENT_RECONCILIATION_V1.function_signatures,
      ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "create_trigger_admission_v1",
      primary_table: "triggers",
      writer_kind: "state_transition",
      arguments: [
        ["p_trigger_id", "text"], ["p_process_id", "text"],
        ["p_scope", "jsonb"], ["p_source", "text"], ["p_actor", "jsonb"],
        ["p_payload", "jsonb"], ["p_dedupe_key", "text"],
        ["p_request_hash", "text"], ["p_authenticated_context", "jsonb"],
        ["p_admission_request", "jsonb"], ["p_idempotency_key", "text"],
        ["p_trace_id", "text"],
      ],
      reads_tables: [
        "bots", "bot_permission_bindings", "bot_foreground_slots", "triggers",
        "trigger_processes", "weak_trigger_groups", "trigger_submit_attempts",
      ],
      writes_tables: [
        "triggers", "trigger_processes", "trigger_process_transitions",
        "weak_trigger_queue_items", "trigger_submit_attempts",
        "weak_trigger_groups", "trigger_process_work_items",
        "trigger_event_outbox", "trigger_command_outbox",
      ],
      effects: [
        { table_name: "triggers", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_processes", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_processes", operation: "transition", concurrency_control: "idempotency_key" },
        { table_name: "trigger_process_transitions", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "weak_trigger_queue_items", operation: "enqueue", concurrency_control: "slot_and_process_state_fence" },
        { table_name: "trigger_submit_attempts", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "weak_trigger_groups", operation: "append", concurrency_control: "slot_and_process_state_fence" },
        { table_name: "weak_trigger_groups", operation: "transition", concurrency_control: "slot_and_process_state_fence" },
        { table_name: "trigger_process_work_items", operation: "enqueue", concurrency_control: "idempotency_key" },
        { table_name: "trigger_event_outbox", operation: "enqueue", concurrency_control: "idempotency_key" },
        { table_name: "trigger_command_outbox", operation: "enqueue", concurrency_control: "idempotency_key" },
      ],
      returns: "jsonb",
    }),
    ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "record_trigger_submit_attempt_v1",
      primary_table: "trigger_submit_attempts",
      writer_kind: "immutable_append",
      arguments: [
        ["p_attempt_id", "text"],
        ["p_claimed_scope", "jsonb"],
        ["p_claimed_source", "text", { nullable: true }],
        ["p_claimed_actor", "jsonb"],
        ["p_claimed_dedupe_key", "text", { nullable: true }],
        ["p_audit_request_hash", "text", { nullable: true }],
        ["p_outcome", "text"],
        ["p_result_code", "text"],
        ["p_retryable", "boolean"],
        ["p_authenticated_context", "jsonb", { nullable: true }],
        ["p_audit_payload", "jsonb"],
        ["p_trace_id", "text"],
      ],
      reads_tables: ["trigger_submit_attempts"],
      writes_tables: ["trigger_submit_attempts"],
      effects: [
        {
          table_name: "trigger_submit_attempts",
          operation: "append",
          concurrency_control: "idempotency_key",
        },
      ],
      returns: "jsonb",
    }),
    ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "upsert_bot_authority_projection_v1",
      primary_table: "bots",
      writer_kind: "projection_upsert",
      arguments: [
        ["p_bot_id", "text"], ["p_expected_source_version", "bigint"],
        ["p_bot", "jsonb"], ["p_permission_bindings", "jsonb"],
        ["p_source_event", "jsonb"],
        ["p_idempotency_key", "text"], ["p_payload_hash", "text"],
        ["p_semantic_hash", "text"], ["p_scope_fingerprint", "text"],
        ["p_trace_id", "text"],
      ],
      reads_tables: ["bots", "bot_permission_bindings", "trigger_event_inbox"],
      writes_tables: ["bots", "bot_permission_bindings", "trigger_event_inbox", "trigger_event_dlq", "trigger_event_outbox"],
      effects: [
        { table_name: "bots", operation: "upsert", concurrency_control: "expected_version" },
        { table_name: "bot_permission_bindings", operation: "upsert", concurrency_control: "expected_version" },
        { table_name: "trigger_event_inbox", operation: "append", concurrency_control: "durable_event_identity" },
        { table_name: "trigger_event_dlq", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_event_outbox", operation: "enqueue", concurrency_control: "idempotency_key" },
      ],
      returns: "jsonb",
    }),
    ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "advance_trigger_stage_v1",
      primary_table: "trigger_processes",
      writer_kind: "state_transition",
      arguments: [
        ["p_process_id", "text"], ["p_progression", "text"],
        ["p_stage_result", "jsonb"],
        ["p_context_snapshot_ref", "text", { nullable: true }],
        ["p_context_snapshot_version", "bigint", { nullable: true }],
        ["p_context_snapshot_hash", "text", { nullable: true }],
        ["p_context_snapshot_retention_until", "timestamptz", { nullable: true }],
        ["p_context_source_outcomes", "jsonb", { nullable: true }],
        ["p_tool_permission_profile", "jsonb", { nullable: true }],
        ["p_skill_catalog_snapshot", "jsonb", { nullable: true }],
        ["p_work_item_id", "text"], ["p_claim_token", "text"],
        ["p_lease_generation", "bigint"], ["p_lease_owner", "text"],
        ["p_expected_process_state_version", "bigint"],
        ["p_result_hash", "text"],
        ["p_request_hash", "text"], ["p_trace_id", "text"],
      ],
      reads_tables: ["trigger_processes", "triggers", "bots", "trigger_context_source_outcomes", "trigger_process_work_items", "bot_intent_policy_current", "bot_intent_policy_revisions", "intent_policy_snapshots", "trigger_confirmation_challenges"],
      writes_tables: ["trigger_processes", "trigger_context_source_outcomes", "trigger_process_work_items", "intent_policy_snapshots", "trigger_confirmation_challenges", "trigger_process_transitions", "trigger_event_outbox"],
      effects: [
        { table_name: "trigger_processes", operation: "transition", concurrency_control: "expected_state_version" },
        { table_name: "trigger_context_source_outcomes", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_process_work_items", operation: "ack", concurrency_control: "lease_fence" },
        { table_name: "trigger_process_work_items", operation: "enqueue", concurrency_control: "idempotency_key" },
        { table_name: "intent_policy_snapshots", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_confirmation_challenges", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_process_transitions", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_event_outbox", operation: "enqueue", concurrency_control: "idempotency_key" },
      ],
      returns: "jsonb",
    }),
    ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "schedule_trigger_stage_retry_v1",
      primary_table: "trigger_processes",
      writer_kind: "state_transition",
      arguments: [
        ["p_process_id", "text"], ["p_expected_phase", "text"],
        ["p_expected_status", "text"], ["p_expected_updated_at", "timestamptz"],
        ["p_next_state", "jsonb"], ["p_stage_retry_scheduled_evidence", "jsonb"],
        ["p_work_item_id", "text"], ["p_claim_token", "text"],
        ["p_lease_generation", "bigint"], ["p_lease_owner", "text"],
        ["p_expected_process_state_version", "bigint"],
        ["p_result_hash", "text"],
        ["p_request_hash", "text"], ["p_trace_id", "text"],
      ],
      reads_tables: ["trigger_processes", "trigger_process_work_items"],
      writes_tables: ["trigger_processes", "trigger_process_work_items", "trigger_process_transitions", "trigger_event_outbox"],
      effects: [
        { table_name: "trigger_processes", operation: "transition", concurrency_control: "expected_state_version" },
        { table_name: "trigger_process_work_items", operation: "ack", concurrency_control: "lease_fence" },
        { table_name: "trigger_process_work_items", operation: "enqueue", concurrency_control: "idempotency_key" },
        { table_name: "trigger_process_transitions", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_event_outbox", operation: "enqueue", concurrency_control: "idempotency_key" },
      ],
      returns: "jsonb",
    }),
    ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "upsert_trigger_meta_projection_v1",
      primary_table: "trigger_process_meta_projections",
      writer_kind: "projection_upsert",
      arguments: [["p_process_id", "text"], ["p_expected_projection_version", "bigint"], ["p_projection", "jsonb"], ["p_source_event", "jsonb"], ["p_idempotency_key", "text"], ["p_payload_hash", "text"], ["p_semantic_hash", "text"], ["p_scope_fingerprint", "text"], ["p_trace_id", "text"]],
      reads_tables: ["trigger_processes", "trigger_process_meta_projections", "trigger_event_inbox"],
      writes_tables: ["trigger_process_meta_projections", "trigger_event_inbox", "trigger_event_dlq", "trigger_event_outbox"],
      effects: [
        { table_name: "trigger_process_meta_projections", operation: "upsert", concurrency_control: "expected_version" },
        { table_name: "trigger_event_inbox", operation: "append", concurrency_control: "durable_event_identity" },
        { table_name: "trigger_event_dlq", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_event_outbox", operation: "enqueue", concurrency_control: "idempotency_key" },
      ],
      returns: "jsonb",
    }),
    // Database Design revision 476, writer registry decision comments
    // 7665350795528768797: terminal Meta projection and Process closure are
    // one owner transaction, not a generic projection upsert side effect.
    ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "finalize_trigger_meta_projection_v1",
      primary_table: "trigger_processes",
      writer_kind: "state_transition",
      arguments: [
        ["p_process_id", "text"],
        ["p_expected_projection_version", "bigint"],
        ["p_expected_process_phase", "text"],
        ["p_expected_process_status", "text"],
        ["p_expected_process_updated_at", "timestamptz"],
        ["p_expected_meta_enqueue_reason", "text"],
        ["p_projection", "jsonb"],
        ["p_source_event", "jsonb"],
        ["p_meta_finalization_evidence", "jsonb"],
        ["p_idempotency_key", "text"],
        ["p_payload_hash", "text"],
        ["p_semantic_hash", "text"],
        ["p_scope_fingerprint", "text"],
        ["p_request_hash", "text"],
        ["p_trace_id", "text"],
      ],
      reads_tables: [
        "trigger_process_meta_projections",
        "trigger_processes",
        "trigger_process_transitions",
        "trigger_event_inbox",
      ],
      writes_tables: [
        "trigger_process_meta_projections",
        "trigger_processes",
        "trigger_process_transitions",
        "trigger_event_inbox",
        "trigger_event_dlq",
        "trigger_event_outbox",
      ],
      effects: [
        {
          table_name: "trigger_process_meta_projections",
          operation: "upsert",
          concurrency_control: "expected_version",
        },
        {
          table_name: "trigger_processes",
          operation: "transition",
          concurrency_control: "expected_state_version",
        },
        {
          table_name: "trigger_process_transitions",
          operation: "append",
          concurrency_control: "idempotency_key",
        },
        {
          table_name: "trigger_event_inbox",
          operation: "append",
          concurrency_control: "durable_event_identity",
        },
        {
          table_name: "trigger_event_dlq",
          operation: "append",
          concurrency_control: "idempotency_key",
        },
        {
          table_name: "trigger_event_outbox",
          operation: "enqueue",
          concurrency_control: "idempotency_key",
        },
      ],
      returns: "jsonb",
    }),
    ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "create_runtime_start_reservation_v1",
      primary_table: "runtime_start_reservations",
      writer_kind: "state_transition",
      arguments: [
        ["p_process_id", "text"], ["p_bot_id", "text"],
        ["p_start_attempt_no", "bigint"], ["p_reservation", "jsonb"],
        ["p_command", "jsonb"], ["p_idempotency_key", "text"],
        ["p_work_item_id", "text"], ["p_claim_token", "text"],
        ["p_lease_generation", "bigint"], ["p_lease_owner", "text"],
        ["p_expected_process_state_version", "bigint"],
        ["p_result_hash", "text"],
        ["p_request_hash", "text"], ["p_trace_id", "text"],
      ],
      reads_tables: ["trigger_processes", "bot_foreground_slots", "runtime_start_reservations", "intent_policy_snapshots", "trigger_process_work_items", "trigger_snapshot_append_cursors"],
      writes_tables: ["runtime_start_reservations", "bot_foreground_slots", "trigger_processes", "trigger_process_work_items", "trigger_snapshot_append_cursors", "trigger_process_transitions", "trigger_command_outbox", "trigger_event_outbox"],
      effects: [
        { table_name: "runtime_start_reservations", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "runtime_start_reservations", operation: "append", concurrency_control: "advisory_identity_lock", advisory_lock: RUNTIME_START_PROCESS_LOCK_V1 },
        { table_name: "runtime_start_reservations", operation: "append", concurrency_control: "advisory_identity_lock", advisory_lock: RUNTIME_START_ATTEMPT_LOCK_V1 },
        { table_name: "bot_foreground_slots", operation: "upsert", concurrency_control: "advisory_identity_lock", advisory_lock: RUNTIME_START_BOT_SLOT_LOCK_V1 },
        { table_name: "trigger_processes", operation: "transition", concurrency_control: "expected_state_version" },
        { table_name: "trigger_process_work_items", operation: "ack", concurrency_control: "lease_fence" },
        { table_name: "trigger_snapshot_append_cursors", operation: "upsert", concurrency_control: "idempotency_key" },
        { table_name: "trigger_process_transitions", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_command_outbox", operation: "enqueue", concurrency_control: "idempotency_key" },
        { table_name: "trigger_event_outbox", operation: "enqueue", concurrency_control: "idempotency_key" },
      ],
      returns: "jsonb",
    }),
    ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "record_runtime_started_v1",
      primary_table: "runtime_start_reservations",
      writer_kind: "state_transition",
      arguments: [["p_process_id", "text"], ["p_append_request", "jsonb"], ["p_source_event", "jsonb"], ["p_owner_event_read", "jsonb"], ["p_expected_snapshot_retention_until", "timestamptz"], ["p_expected_start_fence_generation", "bigint"], ["p_authenticated_context", "jsonb"], ["p_idempotency_key", "text"], ["p_payload_hash", "text"], ["p_semantic_hash", "text"], ["p_scope_fingerprint", "text"], ["p_request_hash", "text"], ["p_trace_id", "text"]],
      reads_tables: ["runtime_start_reservations", "trigger_processes", "trigger_snapshot_append_cursors", "trigger_process_snapshots", "trigger_event_inbox"],
      writes_tables: ["runtime_start_reservations", "trigger_processes", "trigger_process_transitions", "trigger_process_snapshots", "trigger_snapshot_overflow_refs", "trigger_snapshot_pending_events", "trigger_snapshot_append_audits", "trigger_snapshot_append_cursors", "trigger_process_event_projections", "trigger_event_inbox", "trigger_event_dlq", "trigger_event_outbox"],
      effects: [
        { table_name: "runtime_start_reservations", operation: "transition", concurrency_control: "generation_fence" },
        { table_name: "runtime_start_reservations", operation: "transition", concurrency_control: "advisory_identity_lock", advisory_lock: RUNTIME_START_PROCESS_LOCK_V1 },
        { table_name: "trigger_process_snapshots", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_process_snapshots", operation: "transition", concurrency_control: "database_row_lock" },
        { table_name: "trigger_snapshot_overflow_refs", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_snapshot_pending_events", operation: "enqueue", concurrency_control: "idempotency_key" },
        { table_name: "trigger_snapshot_append_audits", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_snapshot_append_cursors", operation: "cas", concurrency_control: "database_row_lock" },
        { table_name: "trigger_process_event_projections", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_event_inbox", operation: "append", concurrency_control: "durable_event_identity" },
        { table_name: "trigger_event_dlq", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_processes", operation: "transition", concurrency_control: "database_row_lock" },
        { table_name: "trigger_process_transitions", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_event_outbox", operation: "enqueue", concurrency_control: "idempotency_key" },
      ],
      returns: "jsonb",
    }),
    ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "record_runtime_start_uncertain_v1",
      primary_table: "runtime_start_reservations",
      writer_kind: "state_transition",
      arguments: [["p_process_id", "text"], ["p_reservation_id", "text"], ["p_expected_reservation_status", "text"], ["p_expected_reservation_updated_at", "timestamptz"], ["p_expected_start_fence_generation", "bigint"], ["p_expected_process_phase", "text"], ["p_expected_process_status", "text"], ["p_expected_process_updated_at", "timestamptz"], ["p_transport_uncertainty_ref", "text"], ["p_runtime_start_uncertain_evidence", "jsonb"], ["p_request_hash", "text"], ["p_trace_id", "text"]],
      reads_tables: ["runtime_start_reservations", "trigger_processes"],
      writes_tables: ["runtime_start_reservations", "trigger_processes", "trigger_process_transitions", "trigger_event_outbox"],
      effects: [
        { table_name: "runtime_start_reservations", operation: "transition", concurrency_control: "generation_fence" },
        { table_name: "runtime_start_reservations", operation: "transition", concurrency_control: "advisory_identity_lock", advisory_lock: RUNTIME_START_PROCESS_LOCK_V1 },
        { table_name: "trigger_processes", operation: "transition", concurrency_control: "expected_state_version" },
        { table_name: "trigger_process_transitions", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_event_outbox", operation: "enqueue", concurrency_control: "idempotency_key" },
      ],
      returns: "jsonb",
    }),
    ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "schedule_runtime_start_recompose_v1",
      primary_table: "runtime_start_reservations",
      writer_kind: "state_transition",
      arguments: [["p_process_id", "text"], ["p_reservation_id", "text"], ["p_expected_reservation_status", "text"], ["p_expected_reservation_updated_at", "timestamptz"], ["p_expected_start_fence_generation", "bigint"], ["p_expected_process_phase", "text"], ["p_expected_process_status", "text"], ["p_expected_process_updated_at", "timestamptz"], ["p_runtime_start_recompose_evidence", "jsonb"], ["p_request_hash", "text"], ["p_trace_id", "text"]],
      reads_tables: ["runtime_start_reservations", "trigger_processes", "trigger_process_work_items"],
      writes_tables: ["runtime_start_reservations", "trigger_processes", "trigger_process_work_items", "trigger_process_transitions", "trigger_event_outbox"],
      effects: [
        { table_name: "runtime_start_reservations", operation: "transition", concurrency_control: "generation_fence" },
        { table_name: "runtime_start_reservations", operation: "transition", concurrency_control: "advisory_identity_lock", advisory_lock: RUNTIME_START_PROCESS_LOCK_V1 },
        { table_name: "trigger_processes", operation: "transition", concurrency_control: "expected_state_version" },
        { table_name: "trigger_process_work_items", operation: "enqueue", concurrency_control: "idempotency_key" },
        { table_name: "trigger_process_transitions", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_event_outbox", operation: "enqueue", concurrency_control: "idempotency_key" },
      ],
      returns: "jsonb",
    }),
    ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "request_runtime_preempt_v1",
      primary_table: "trigger_processes",
      writer_kind: "state_transition",
      arguments: [["p_process_id", "text"], ["p_expected_phase", "text"], ["p_expected_status", "text"], ["p_expected_updated_at", "timestamptz"], ["p_expected_slot_fence", "jsonb"], ["p_runtime_control_requested_evidence", "jsonb"], ["p_command", "jsonb"], ["p_request_hash", "text"], ["p_trace_id", "text"]],
      reads_tables: ["trigger_processes", "bot_foreground_slots"],
      writes_tables: ["trigger_processes", "trigger_process_transitions", "trigger_command_outbox", "trigger_event_outbox"],
      effects: [
        { table_name: "trigger_processes", operation: "transition", concurrency_control: "generation_fence" },
        { table_name: "trigger_process_transitions", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_command_outbox", operation: "enqueue", concurrency_control: "idempotency_key" },
        { table_name: "trigger_event_outbox", operation: "enqueue", concurrency_control: "idempotency_key" },
      ],
      returns: "jsonb",
    }),
    ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "create_trigger_confirmation_challenge_v1",
      primary_table: "trigger_confirmation_challenges",
      writer_kind: "state_transition",
      arguments: [["p_challenge_id", "text"], ["p_process_id", "text"], ["p_expected_phase", "text"], ["p_expected_status", "text"], ["p_expected_updated_at", "timestamptz"], ["p_challenge", "jsonb"], ["p_confirmation_challenge_created_evidence", "jsonb"], ["p_request_hash", "text"], ["p_trace_id", "text"]],
      reads_tables: ["trigger_processes", "trigger_confirmation_challenges"],
      writes_tables: ["trigger_confirmation_challenges", "trigger_processes", "trigger_process_transitions", "trigger_event_outbox"],
      effects: [
        { table_name: "trigger_confirmation_challenges", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_processes", operation: "transition", concurrency_control: "expected_state_version" },
        { table_name: "trigger_process_transitions", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_event_outbox", operation: "enqueue", concurrency_control: "idempotency_key" },
      ],
      returns: "jsonb",
    }),
    ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "accept_trigger_confirmation_v1",
      primary_table: "trigger_confirmation_challenges",
      writer_kind: "state_transition",
      arguments: [["p_process_id", "text"], ["p_challenge_id", "text"], ["p_principal_type", "text"], ["p_principal_id", "text"], ["p_response", "jsonb"], ["p_request_hash", "text"], ["p_trace_id", "text"]],
      reads_tables: ["trigger_confirmation_challenges", "trigger_processes", "trigger_process_work_items"],
      writes_tables: ["trigger_confirmation_challenges", "trigger_processes", "trigger_process_work_items", "trigger_process_transitions", "trigger_event_outbox"],
      effects: [
        { table_name: "trigger_confirmation_challenges", operation: "transition", concurrency_control: "database_row_lock", lock_table_name: "trigger_confirmation_challenges" },
        { table_name: "trigger_processes", operation: "transition", concurrency_control: "database_row_lock", lock_table_name: "trigger_processes" },
        { table_name: "trigger_process_work_items", operation: "ack", concurrency_control: "database_row_lock", lock_table_name: "trigger_process_work_items" },
        { table_name: "trigger_process_transitions", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_event_outbox", operation: "enqueue", concurrency_control: "idempotency_key" },
      ],
      returns: "jsonb",
    }),
    ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "reject_trigger_confirmation_v1",
      primary_table: "trigger_confirmation_challenges",
      writer_kind: "state_transition",
      arguments: [["p_process_id", "text"], ["p_challenge_id", "text"], ["p_principal_type", "text"], ["p_principal_id", "text"], ["p_response", "jsonb"], ["p_request_hash", "text"], ["p_trace_id", "text"]],
      reads_tables: ["trigger_confirmation_challenges", "trigger_processes", "trigger_process_work_items", "bot_foreground_slots"],
      writes_tables: ["trigger_confirmation_challenges", "trigger_processes", "trigger_process_work_items", "trigger_process_transitions", "trigger_event_outbox"],
      effects: [
        { table_name: "trigger_confirmation_challenges", operation: "transition", concurrency_control: "database_row_lock", lock_table_name: "trigger_confirmation_challenges" },
        { table_name: "trigger_processes", operation: "transition", concurrency_control: "database_row_lock", lock_table_name: "trigger_processes" },
        { table_name: "trigger_process_work_items", operation: "ack", concurrency_control: "database_row_lock", lock_table_name: "trigger_process_work_items" },
        { table_name: "trigger_process_transitions", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_event_outbox", operation: "enqueue", concurrency_control: "idempotency_key" },
      ],
      returns: "jsonb",
    }),
    ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "expire_trigger_confirmation_v1",
      primary_table: "trigger_confirmation_challenges",
      writer_kind: "state_transition",
      arguments: [["p_process_id", "text"], ["p_challenge_id", "text"], ["p_request_hash", "text"], ["p_trace_id", "text"]],
      reads_tables: ["trigger_confirmation_challenges", "trigger_processes", "trigger_process_work_items", "bot_foreground_slots"],
      writes_tables: ["trigger_confirmation_challenges", "trigger_processes", "trigger_process_work_items", "trigger_process_transitions", "trigger_event_outbox"],
      effects: [
        { table_name: "trigger_confirmation_challenges", operation: "transition", concurrency_control: "database_row_lock", lock_table_name: "trigger_confirmation_challenges" },
        { table_name: "trigger_processes", operation: "transition", concurrency_control: "database_row_lock", lock_table_name: "trigger_processes" },
        { table_name: "trigger_process_work_items", operation: "ack", concurrency_control: "database_row_lock", lock_table_name: "trigger_process_work_items" },
        { table_name: "trigger_process_transitions", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_event_outbox", operation: "enqueue", concurrency_control: "idempotency_key" },
      ],
      returns: "jsonb",
    }),
    ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "request_trigger_cancel_v1",
      primary_table: "trigger_process_cancel_requests",
      writer_kind: "state_transition",
      arguments: [["p_cancel_request_id", "text"], ["p_process_id", "text"], ["p_cancel_request", "jsonb"], ["p_idempotency_key", "text"], ["p_request_hash", "text"], ["p_trace_id", "text"]],
      reads_tables: ["trigger_processes", "triggers", "trigger_process_cancel_requests", "runtime_start_reservations", "trigger_command_outbox", "bot_foreground_slots"],
      writes_tables: ["trigger_process_cancel_requests", "runtime_start_reservations", "trigger_processes", "trigger_process_transitions", "trigger_command_outbox", "trigger_event_outbox"],
      effects: [
        { table_name: "trigger_process_cancel_requests", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "runtime_start_reservations", operation: "transition", concurrency_control: "advisory_identity_lock", advisory_lock: RUNTIME_START_PROCESS_LOCK_V1 },
        { table_name: "runtime_start_reservations", operation: "transition", concurrency_control: "database_row_lock", lock_table_name: "runtime_start_reservations" },
        { table_name: "trigger_processes", operation: "transition", concurrency_control: "database_row_lock" },
        { table_name: "trigger_process_transitions", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_command_outbox", operation: "enqueue", concurrency_control: "idempotency_key" },
        { table_name: "trigger_event_outbox", operation: "enqueue", concurrency_control: "idempotency_key" },
      ],
      returns: "jsonb",
    }),
    ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "transition_trigger_cancel_request_v1",
      primary_table: "trigger_process_cancel_requests",
      writer_kind: "state_transition",
      arguments: [["p_cancel_request_id", "text"], ["p_expected_cancel_status", "text"], ["p_expected_process_phase", "text"], ["p_expected_process_status", "text"], ["p_expected_process_updated_at", "timestamptz"], ["p_next_cancel_state", "jsonb"], ["p_process_evidence", "jsonb"], ["p_request_hash", "text"], ["p_trace_id", "text"]],
      reads_tables: ["trigger_process_cancel_requests", "trigger_processes"],
      writes_tables: ["trigger_process_cancel_requests", "trigger_processes", "trigger_process_transitions", "trigger_event_outbox"],
      effects: [
        { table_name: "trigger_process_cancel_requests", operation: "transition", concurrency_control: "expected_state_version" },
        { table_name: "trigger_processes", operation: "transition", concurrency_control: "expected_state_version" },
        { table_name: "trigger_process_transitions", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_event_outbox", operation: "enqueue", concurrency_control: "idempotency_key" },
      ],
      returns: "jsonb",
    }),
    ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "requeue_failed_runtime_cancel_command_v1",
      primary_table: "trigger_command_outbox",
      writer_kind: "outbox_claim_ack",
      arguments: [
        ["p_process_id", "text"],
        ["p_command_id", "text"],
        ["p_trace_id", "text"],
      ],
      reads_tables: [
        "trigger_processes",
        "runtime_start_reservations",
        "trigger_process_cancel_requests",
        "trigger_command_outbox",
        "trigger_command_dlq",
        TRIGGER_COMMAND_DLQ_RESOLUTION_V1.resolution_table,
      ],
      writes_tables: ["trigger_command_outbox"],
      effects: [
        {
          table_name: "trigger_command_outbox",
          operation: "redrive_ack",
          concurrency_control: "advisory_identity_lock",
          advisory_lock: RUNTIME_START_PROCESS_LOCK_V1,
        },
        {
          table_name: "trigger_command_outbox",
          operation: "redrive_ack",
          concurrency_control: "database_row_lock",
          lock_table_name: "trigger_command_outbox",
        },
      ],
      returns: "jsonb",
    }),
    ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "enter_trigger_cooldown_v1",
      primary_table: "trigger_processes",
      writer_kind: "state_transition",
      arguments: [["p_process_id", "text"], ["p_append_request", "jsonb"], ["p_source_event", "jsonb"], ["p_owner_event_read", "jsonb"], ["p_expected_snapshot_retention_until", "timestamptz"], ["p_expected_start_fence_generation", "bigint"], ["p_authenticated_context", "jsonb"], ["p_idempotency_key", "text"], ["p_payload_hash", "text"], ["p_semantic_hash", "text"], ["p_scope_fingerprint", "text"], ["p_request_hash", "text"], ["p_trace_id", "text"]],
      reads_tables: ["trigger_processes", "runtime_start_reservations", "trigger_snapshot_append_cursors", "trigger_process_snapshots", "trigger_event_inbox", "trigger_process_work_items"],
      writes_tables: ["runtime_start_reservations", "trigger_event_inbox", "trigger_event_dlq", "trigger_process_snapshots", "trigger_snapshot_overflow_refs", "trigger_snapshot_pending_events", "trigger_snapshot_append_cursors", "trigger_snapshot_append_audits", "trigger_process_event_projections", "trigger_processes", "trigger_process_work_items", "trigger_process_transitions", "trigger_event_outbox"],
      effects: [
        { table_name: "runtime_start_reservations", operation: "transition", concurrency_control: "generation_fence" },
        { table_name: "runtime_start_reservations", operation: "transition", concurrency_control: "advisory_identity_lock", advisory_lock: RUNTIME_START_PROCESS_LOCK_V1 },
        { table_name: "trigger_event_inbox", operation: "append", concurrency_control: "durable_event_identity" },
        { table_name: "trigger_event_dlq", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_process_snapshots", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_process_snapshots", operation: "transition", concurrency_control: "database_row_lock" },
        { table_name: "trigger_snapshot_overflow_refs", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_snapshot_pending_events", operation: "enqueue", concurrency_control: "idempotency_key" },
        { table_name: "trigger_snapshot_append_cursors", operation: "cas", concurrency_control: "database_row_lock" },
        { table_name: "trigger_snapshot_append_audits", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_process_event_projections", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_processes", operation: "transition", concurrency_control: "database_row_lock" },
        { table_name: "trigger_process_work_items", operation: "enqueue", concurrency_control: "idempotency_key" },
        { table_name: "trigger_process_transitions", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_event_outbox", operation: "enqueue", concurrency_control: "idempotency_key" },
      ],
      returns: "jsonb",
    }),
    ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "finalize_trigger_runtime_terminal_v1",
      primary_table: "trigger_processes",
      writer_kind: "state_transition",
      arguments: [["p_process_id", "text"], ["p_append_request", "jsonb"], ["p_source_event", "jsonb"], ["p_owner_event_read", "jsonb"], ["p_expected_snapshot_retention_until", "timestamptz"], ["p_expected_start_fence_generation", "bigint"], ["p_authenticated_context", "jsonb"], ["p_idempotency_key", "text"], ["p_payload_hash", "text"], ["p_semantic_hash", "text"], ["p_scope_fingerprint", "text"], ["p_request_hash", "text"], ["p_trace_id", "text"]],
      reads_tables: ["triggers", "trigger_processes", "runtime_start_reservations", "trigger_process_cancel_requests", "trigger_snapshot_append_cursors", "trigger_process_snapshots", "trigger_event_inbox", "bot_foreground_slots"],
      writes_tables: ["runtime_start_reservations", "trigger_process_cancel_requests", "trigger_event_inbox", "trigger_event_dlq", "trigger_process_snapshots", "trigger_snapshot_overflow_refs", "trigger_snapshot_pending_events", "trigger_snapshot_append_cursors", "trigger_snapshot_append_audits", "trigger_process_event_projections", "trigger_processes", "bot_foreground_slots", "trigger_process_work_items", "trigger_process_transitions", "trigger_event_outbox"],
      effects: [
        { table_name: "runtime_start_reservations", operation: "transition", concurrency_control: "generation_fence" },
        { table_name: "runtime_start_reservations", operation: "transition", concurrency_control: "advisory_identity_lock", advisory_lock: RUNTIME_START_PROCESS_LOCK_V1 },
        { table_name: "trigger_process_cancel_requests", operation: "transition", concurrency_control: "database_row_lock" },
        { table_name: "trigger_event_inbox", operation: "append", concurrency_control: "durable_event_identity" },
        { table_name: "trigger_event_dlq", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_process_snapshots", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_process_snapshots", operation: "transition", concurrency_control: "database_row_lock" },
        { table_name: "trigger_snapshot_overflow_refs", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_snapshot_pending_events", operation: "enqueue", concurrency_control: "idempotency_key" },
        { table_name: "trigger_snapshot_append_cursors", operation: "cas", concurrency_control: "database_row_lock" },
        { table_name: "trigger_snapshot_append_audits", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_process_event_projections", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_processes", operation: "transition", concurrency_control: "database_row_lock" },
        { table_name: "bot_foreground_slots", operation: "cas", concurrency_control: "database_row_lock" },
        { table_name: "trigger_process_work_items", operation: "enqueue", concurrency_control: "idempotency_key" },
        { table_name: "trigger_process_transitions", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_event_outbox", operation: "enqueue", concurrency_control: "idempotency_key" },
      ],
      returns: "jsonb",
    }),
    ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "apply_runtime_control_handled_v1",
      primary_table: "trigger_processes",
      writer_kind: "state_transition",
      arguments: [["p_process_id", "text"], ["p_append_request", "jsonb"], ["p_source_event", "jsonb"], ["p_owner_event_read", "jsonb"], ["p_expected_snapshot_retention_until", "timestamptz"], ["p_expected_start_fence_generation", "bigint"], ["p_authenticated_context", "jsonb"], ["p_idempotency_key", "text"], ["p_payload_hash", "text"], ["p_semantic_hash", "text"], ["p_scope_fingerprint", "text"], ["p_request_hash", "text"], ["p_trace_id", "text"]],
      reads_tables: ["trigger_processes", "runtime_start_reservations", "trigger_process_cancel_requests", "trigger_snapshot_append_cursors", "trigger_process_snapshots", "trigger_event_inbox"],
      writes_tables: ["trigger_process_cancel_requests", "trigger_event_inbox", "trigger_event_dlq", "trigger_process_snapshots", "trigger_snapshot_overflow_refs", "trigger_snapshot_pending_events", "trigger_snapshot_append_cursors", "trigger_snapshot_append_audits", "trigger_process_event_projections", "trigger_processes"],
      effects: [
        { table_name: "trigger_process_cancel_requests", operation: "transition", concurrency_control: "database_row_lock" },
        { table_name: "trigger_process_cancel_requests", operation: "transition", concurrency_control: "advisory_identity_lock", advisory_lock: RUNTIME_START_PROCESS_LOCK_V1 },
        { table_name: "trigger_event_inbox", operation: "append", concurrency_control: "durable_event_identity" },
        { table_name: "trigger_event_dlq", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_process_snapshots", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_process_snapshots", operation: "transition", concurrency_control: "database_row_lock" },
        { table_name: "trigger_snapshot_overflow_refs", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_snapshot_pending_events", operation: "enqueue", concurrency_control: "idempotency_key" },
        { table_name: "trigger_snapshot_append_cursors", operation: "cas", concurrency_control: "database_row_lock" },
        { table_name: "trigger_snapshot_append_audits", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_process_event_projections", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_processes", operation: "transition", concurrency_control: "database_row_lock" },
      ],
      returns: "jsonb",
    }),
    ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "enqueue_trigger_meta_job_v1",
      primary_table: "trigger_processes",
      writer_kind: "state_transition",
      arguments: [
        ["p_process_id", "text"], ["p_enqueue_reason", "text"],
        ["p_boundary_system_event_ref", "text", { nullable: true }],
        ["p_idempotency_key", "text"],
        ["p_work_item_id", "text"], ["p_claim_token", "text"],
        ["p_lease_generation", "bigint"], ["p_lease_owner", "text"],
        ["p_expected_process_state_version", "bigint"],
        ["p_result_hash", "text"],
        ["p_request_hash", "text"], ["p_trace_id", "text"],
      ],
      reads_tables: ["trigger_processes", "trigger_process_snapshots", "trigger_snapshot_append_cursors", "trigger_process_meta_projections", "trigger_process_work_items", "trigger_command_outbox"],
      writes_tables: ["trigger_processes", "trigger_process_meta_projections", "trigger_process_work_items", "trigger_process_transitions", "trigger_command_outbox", "trigger_event_outbox"],
      effects: [
        { table_name: "trigger_processes", operation: "transition", concurrency_control: "expected_state_version" },
        { table_name: "trigger_process_meta_projections", operation: "upsert", concurrency_control: "idempotency_key" },
        { table_name: "trigger_process_work_items", operation: "ack", concurrency_control: "lease_fence" },
        { table_name: "trigger_process_transitions", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_command_outbox", operation: "enqueue", concurrency_control: "idempotency_key" },
        { table_name: "trigger_event_outbox", operation: "enqueue", concurrency_control: "idempotency_key" },
      ],
      returns: "jsonb",
    }),
    ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "claim_trigger_process_work_v1",
      primary_table: "trigger_process_work_items",
      writer_kind: "outbox_claim_ack",
      arguments: [["p_worker_id", "text"], ["p_limit", "integer"], ["p_lease_seconds", "integer"], ["p_request_hash", "text"]],
      reads_tables: ["trigger_process_work_items", "trigger_processes"],
      writes_tables: ["trigger_process_work_items"],
      effects: [
        { table_name: "trigger_process_work_items", operation: "claim", concurrency_control: "lease_fence" },
      ],
      returns: "setof jsonb",
    }),
    ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "ack_trigger_process_work_v1",
      primary_table: "trigger_process_work_items",
      writer_kind: "outbox_claim_ack",
      arguments: [
        ["p_work_item_id", "text"], ["p_claim_token", "text"],
        ["p_lease_generation", "bigint"], ["p_lease_owner", "text"],
        ["p_outcome", "text"],
        ["p_retry_delay_ms", "integer", { nullable: true }],
        ["p_error", "jsonb", { nullable: true }],
        ["p_result_hash", "text"],
        ["p_request_hash", "text"], ["p_trace_id", "text"],
      ],
      reads_tables: ["trigger_process_work_items"],
      writes_tables: ["trigger_process_work_items"],
      effects: [
        { table_name: "trigger_process_work_items", operation: "ack", concurrency_control: "lease_fence" },
      ],
      returns: "jsonb",
    }),
    ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "claim_weak_trigger_queue_v1",
      primary_table: "weak_trigger_queue_items",
      writer_kind: "state_transition",
      arguments: [["p_queue_item_id", "text"], ["p_expected_status", "text"], ["p_expected_updated_at", "timestamptz"], ["p_worker_id", "text"], ["p_lease_seconds", "integer"], ["p_request_hash", "text"]],
      reads_tables: ["weak_trigger_queue_items", "weak_trigger_groups"],
      writes_tables: ["weak_trigger_queue_items"],
      effects: [{ table_name: "weak_trigger_queue_items", operation: "transition", concurrency_control: "lease_fence" }],
      returns: "jsonb",
    }),
    ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "retry_weak_trigger_queue_item_v1",
      primary_table: "weak_trigger_queue_items",
      writer_kind: "state_transition",
      arguments: [["p_queue_item_id", "text"], ["p_expected_status", "text"], ["p_expected_updated_at", "timestamptz"], ["p_claim_token", "text"], ["p_retry_delay_ms", "integer"], ["p_error", "jsonb"], ["p_request_hash", "text"], ["p_trace_id", "text"]],
      reads_tables: ["weak_trigger_queue_items"],
      writes_tables: ["weak_trigger_queue_items", "trigger_event_outbox"],
      effects: [
        { table_name: "weak_trigger_queue_items", operation: "transition", concurrency_control: "lease_fence" },
        { table_name: "trigger_event_outbox", operation: "enqueue", concurrency_control: "idempotency_key" },
      ],
      returns: "jsonb",
    }),
    ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "complete_weak_trigger_queue_item_v1",
      primary_table: "weak_trigger_queue_items",
      writer_kind: "state_transition",
      arguments: [["p_queue_item_id", "text"], ["p_group_id", "text"], ["p_expected_status", "text"], ["p_expected_updated_at", "timestamptz"], ["p_expected_group_status", "text"], ["p_expected_group_updated_at", "timestamptz"], ["p_claim_token", "text"], ["p_result", "jsonb"], ["p_request_hash", "text"], ["p_trace_id", "text"]],
      reads_tables: ["weak_trigger_queue_items", "weak_trigger_groups"],
      writes_tables: ["weak_trigger_queue_items", "weak_trigger_groups", "trigger_event_outbox"],
      effects: [
        { table_name: "weak_trigger_queue_items", operation: "transition", concurrency_control: "lease_fence" },
        { table_name: "weak_trigger_groups", operation: "transition", concurrency_control: "expected_state_version" },
        { table_name: "trigger_event_outbox", operation: "enqueue", concurrency_control: "idempotency_key" },
      ],
      returns: "jsonb",
    }),
    ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "transition_weak_trigger_group_v1",
      primary_table: "weak_trigger_groups",
      writer_kind: "state_transition",
      arguments: [["p_group_id", "text"], ["p_expected_status", "text"], ["p_expected_updated_at", "timestamptz"], ["p_next_status", "text"], ["p_expected_head_item_id", "text"], ["p_next_state", "jsonb"], ["p_request_hash", "text"], ["p_trace_id", "text"]],
      reads_tables: ["weak_trigger_groups", "weak_trigger_queue_items"],
      writes_tables: ["weak_trigger_groups", "trigger_event_outbox"],
      effects: [
        { table_name: "weak_trigger_groups", operation: "transition", concurrency_control: "expected_state_version" },
        { table_name: "trigger_event_outbox", operation: "enqueue", concurrency_control: "idempotency_key" },
      ],
      returns: "jsonb",
    }),
    ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "promote_weak_trigger_queue_head_v1",
      primary_table: "bot_foreground_slots",
      writer_kind: "lease_fence",
      arguments: [["p_bot_id", "text"], ["p_queue_item_id", "text"], ["p_group_id", "text"], ["p_expected_queue_status", "text"], ["p_expected_queue_updated_at", "timestamptz"], ["p_expected_group_status", "text"], ["p_expected_group_updated_at", "timestamptz"], ["p_expected_process_phase", "text"], ["p_expected_process_status", "text"], ["p_expected_process_updated_at", "timestamptz"], ["p_expected_slot_fence", "jsonb"], ["p_expected_strong_fifo_revision", "bigint"], ["p_expected_strong_fifo_empty_fence", "jsonb"], ["p_strong_fifo_empty_lock_ref", "text"], ["p_worker_id", "text"], ["p_lease_seconds", "integer"], ["p_next_slot_generation", "bigint"], ["p_evidence", "jsonb"], ["p_command", "jsonb"], ["p_request_hash", "text"], ["p_trace_id", "text"]],
      reads_tables: ["weak_trigger_queue_items", "weak_trigger_groups", "trigger_processes", "bot_foreground_slots"],
      writes_tables: ["weak_trigger_queue_items", "weak_trigger_groups", "bot_foreground_slots", "trigger_processes", "trigger_process_transitions", "trigger_command_outbox", "trigger_event_outbox"],
      effects: [
        { table_name: "weak_trigger_queue_items", operation: "transition", concurrency_control: "lease_fence" },
        { table_name: "weak_trigger_groups", operation: "transition", concurrency_control: "expected_state_version" },
        { table_name: "bot_foreground_slots", operation: "cas", concurrency_control: "generation_fence" },
        { table_name: "trigger_processes", operation: "transition", concurrency_control: "expected_state_version" },
        { table_name: "trigger_process_transitions", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_command_outbox", operation: "enqueue", concurrency_control: "idempotency_key" },
        { table_name: "trigger_event_outbox", operation: "enqueue", concurrency_control: "idempotency_key" },
      ],
      returns: "jsonb",
    }),
    ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "promote_strong_fifo_head_v1",
      primary_table: "bot_foreground_slots",
      writer_kind: "lease_fence",
      arguments: [["p_bot_id", "text"], ["p_expected_slot_fence", "jsonb"], ["p_expected_strong_fifo_revision", "bigint"], ["p_expected_head_process_id", "text"], ["p_expected_head_admission_time", "timestamptz"], ["p_strong_fifo_head_lock_ref", "text"], ["p_expected_preempt_commit_fence", "jsonb"], ["p_expected_head_phase", "text"], ["p_expected_head_status", "text"], ["p_expected_head_updated_at", "timestamptz"], ["p_next_slot_generation", "bigint"], ["p_evidence", "jsonb"], ["p_command", "jsonb"], ["p_request_hash", "text"], ["p_trace_id", "text"]],
      reads_tables: ["bot_foreground_slots", "trigger_processes", "trigger_event_outbox"],
      writes_tables: ["bot_foreground_slots", "trigger_processes", "trigger_process_work_items", "trigger_process_transitions", "trigger_event_outbox"],
      effects: [
        { table_name: "bot_foreground_slots", operation: "cas", concurrency_control: "generation_fence" },
        { table_name: "trigger_processes", operation: "transition", concurrency_control: "expected_state_version" },
        { table_name: "trigger_process_work_items", operation: "enqueue", concurrency_control: "idempotency_key" },
        { table_name: "trigger_process_transitions", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_event_outbox", operation: "enqueue", concurrency_control: "idempotency_key" },
      ],
      returns: "jsonb",
    }),
    ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "cas_bot_intent_policy_current_v1",
      primary_table: "bot_intent_policy_current",
      writer_kind: "pointer_cas",
      arguments: [
        ["p_bot_id", "text"], ["p_expected_pointer_version", "bigint"],
        ["p_revision", "jsonb"], ["p_snapshot", "jsonb"],
        ["p_request_hash", "text"], ["p_trace_id", "text"],
      ],
      reads_tables: ["bot_intent_policy_current", "bot_intent_policy_revisions"],
      writes_tables: [
        "bot_intent_policy_revisions", "bot_intent_policy_current",
        "bot_intent_policy_audit_logs", "intent_policy_snapshots", "trigger_event_outbox",
      ],
      effects: [
        { table_name: "bot_intent_policy_revisions", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "bot_intent_policy_current", operation: "cas", concurrency_control: "expected_version" },
        { table_name: "bot_intent_policy_audit_logs", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "intent_policy_snapshots", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_event_outbox", operation: "enqueue", concurrency_control: "idempotency_key" },
      ],
      returns: "jsonb",
    }),
    ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "release_bot_foreground_slot_v1",
      primary_table: "bot_foreground_slots",
      writer_kind: "lease_fence",
      arguments: [
        ["p_bot_id", "text"], ["p_expected_slot_fence", "jsonb"],
        ["p_expected_process_phase", "text"], ["p_expected_process_status", "text"],
        ["p_expected_process_updated_at", "timestamptz"],
        ["p_next_generation", "bigint"], ["p_evidence", "jsonb"],
        ["p_request_hash", "text"], ["p_trace_id", "text"],
      ],
      reads_tables: ["bot_foreground_slots", "trigger_processes"],
      writes_tables: ["bot_foreground_slots", "trigger_process_transitions", "trigger_event_outbox"],
      effects: [
        { table_name: "bot_foreground_slots", operation: "cas", concurrency_control: "generation_fence" },
        { table_name: "trigger_process_transitions", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_event_outbox", operation: "enqueue", concurrency_control: "idempotency_key" },
      ],
      returns: "jsonb",
    }),
    ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "append_trigger_snapshot_v1",
      primary_table: "trigger_process_snapshots",
      writer_kind: "state_transition",
      arguments: [
        ["p_process_id", "text"], ["p_append_request", "jsonb"],
        ["p_source_event", "jsonb"], ["p_owner_event_read", "jsonb"], ["p_expected_snapshot_retention_until", "timestamptz"], ["p_expected_start_fence_generation", "bigint"], ["p_authenticated_context", "jsonb"],
        ["p_idempotency_key", "text"], ["p_payload_hash", "text"],
        ["p_semantic_hash", "text"], ["p_scope_fingerprint", "text"],
        ["p_request_hash", "text"], ["p_trace_id", "text"],
      ],
      reads_tables: ["trigger_processes", "runtime_start_reservations", "trigger_snapshot_append_cursors", "trigger_process_snapshots", "trigger_event_inbox"],
      writes_tables: [
        "trigger_process_snapshots", "trigger_snapshot_overflow_refs",
        "trigger_snapshot_pending_events", "trigger_snapshot_append_audits",
        "trigger_snapshot_append_cursors", "trigger_process_event_projections",
        "trigger_event_inbox", "trigger_event_dlq",
      ],
      effects: [
        { table_name: "trigger_process_snapshots", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_process_snapshots", operation: "append", concurrency_control: "advisory_identity_lock", advisory_lock: RUNTIME_START_PROCESS_LOCK_V1 },
        { table_name: "trigger_process_snapshots", operation: "transition", concurrency_control: "database_row_lock" },
        { table_name: "trigger_snapshot_overflow_refs", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_snapshot_pending_events", operation: "enqueue", concurrency_control: "idempotency_key" },
        { table_name: "trigger_snapshot_append_audits", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_snapshot_append_cursors", operation: "cas", concurrency_control: "database_row_lock" },
        { table_name: "trigger_process_event_projections", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_event_inbox", operation: "append", concurrency_control: "durable_event_identity" },
        { table_name: "trigger_event_dlq", operation: "append", concurrency_control: "idempotency_key" },
      ],
      returns: "jsonb",
    }),
    ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "transition_trigger_snapshot_pending_event_v1",
      primary_table: "trigger_snapshot_pending_events",
      writer_kind: "state_transition",
      arguments: [
        ["p_pending_event_id", "text"], ["p_expected_status", "text"],
        ["p_expected_updated_at", "timestamptz"], ["p_next_status", "text"],
        ["p_worker_id", "text"], ["p_retry_delay_ms", "integer", { nullable: true }],
        ["p_last_error", "jsonb"],
      ],
      reads_tables: [
        "trigger_snapshot_pending_events", "trigger_processes",
        "trigger_snapshot_append_cursors", "trigger_process_snapshots",
        "runtime_start_reservations",
      ],
      writes_tables: [
        "trigger_snapshot_pending_events", "trigger_snapshot_append_audits",
        "trigger_process_snapshots", "trigger_snapshot_append_cursors",
        "trigger_process_event_projections", "trigger_processes",
        "trigger_snapshot_repair_jobs", "trigger_process_work_items",
        "trigger_event_dlq",
      ],
      effects: [
        { table_name: "trigger_snapshot_pending_events", operation: "transition", concurrency_control: "expected_state_version" },
        { table_name: "trigger_snapshot_append_audits", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_process_snapshots", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_process_snapshots", operation: "transition", concurrency_control: "database_row_lock" },
        { table_name: "trigger_snapshot_append_cursors", operation: "cas", concurrency_control: "database_row_lock" },
        { table_name: "trigger_process_event_projections", operation: "append", concurrency_control: "idempotency_key" },
        { table_name: "trigger_processes", operation: "transition", concurrency_control: "database_row_lock" },
        { table_name: "trigger_snapshot_repair_jobs", operation: "enqueue", concurrency_control: "idempotency_key" },
        { table_name: "trigger_process_work_items", operation: "enqueue", concurrency_control: "idempotency_key" },
        { table_name: "trigger_event_dlq", operation: "append", concurrency_control: "idempotency_key" },
      ],
      returns: "jsonb",
    }),
    ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "schedule_trigger_snapshot_repair_v1",
      primary_table: "trigger_snapshot_repair_jobs",
      writer_kind: "state_transition",
      arguments: [["p_repair_job_id", "text"], ["p_process_id", "text"], ["p_expected_snapshot_version", "bigint"], ["p_repair_job", "jsonb"], ["p_idempotency_key", "text"], ["p_request_hash", "text"], ["p_trace_id", "text"]],
      reads_tables: ["trigger_processes", "trigger_process_snapshots", "trigger_snapshot_repair_jobs", "trigger_process_work_items"],
      writes_tables: ["trigger_snapshot_repair_jobs", "trigger_process_work_items", "trigger_event_outbox"],
      effects: [
        { table_name: "trigger_snapshot_repair_jobs", operation: "enqueue", concurrency_control: "idempotency_key" },
        { table_name: "trigger_process_work_items", operation: "enqueue", concurrency_control: "idempotency_key" },
        { table_name: "trigger_event_outbox", operation: "enqueue", concurrency_control: "idempotency_key" },
      ],
      returns: "jsonb",
    }),
    ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "dispatch_trigger_snapshot_repair_v1",
      primary_table: "trigger_snapshot_repair_jobs",
      writer_kind: "state_transition",
      arguments: [
        ["p_repair_job_id", "text"], ["p_process_id", "text"],
        ["p_expected_repair_status", "text"],
        ["p_repair_work", "jsonb"],
        ["p_work_item_id", "text"], ["p_claim_token", "text"],
        ["p_lease_generation", "bigint"], ["p_lease_owner", "text"],
        ["p_expected_process_state_version", "bigint"],
        ["p_result_hash", "text"],
        ["p_request_hash", "text"], ["p_trace_id", "text"],
      ],
      reads_tables: [
        "trigger_snapshot_repair_jobs",
        "trigger_processes",
        "trigger_process_snapshots",
        "trigger_process_work_items",
      ],
      writes_tables: [
        "trigger_snapshot_repair_jobs",
        "trigger_process_work_items",
        "trigger_command_outbox",
        "trigger_event_outbox",
      ],
      effects: [
        { table_name: "trigger_snapshot_repair_jobs", operation: "transition", concurrency_control: "expected_state_version" },
        { table_name: "trigger_process_work_items", operation: "ack", concurrency_control: "lease_fence" },
        { table_name: "trigger_command_outbox", operation: "enqueue", concurrency_control: "idempotency_key" },
        { table_name: "trigger_event_outbox", operation: "enqueue", concurrency_control: "idempotency_key" },
      ],
      returns: "jsonb",
    }),
    ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "transition_trigger_snapshot_repair_job_v1",
      primary_table: "trigger_snapshot_repair_jobs",
      writer_kind: "state_transition",
      arguments: [
        ["p_repair_job_id", "text"], ["p_expected_status", "text"],
        ["p_expected_updated_at", "timestamptz"], ["p_next_status", "text"],
        ["p_retry_delay_ms", "integer", { nullable: true }], ["p_last_error", "jsonb"],
      ],
      reads_tables: ["trigger_snapshot_repair_jobs"],
      writes_tables: ["trigger_snapshot_repair_jobs", "trigger_event_outbox"],
      effects: [
        { table_name: "trigger_snapshot_repair_jobs", operation: "transition", concurrency_control: "expected_state_version" },
        { table_name: "trigger_event_outbox", operation: "enqueue", concurrency_control: "idempotency_key" },
      ],
      returns: "jsonb",
    }),
    ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "claim_trigger_event_outbox_v1",
      primary_table: "trigger_event_outbox",
      writer_kind: "outbox_claim_ack",
      arguments: [["p_worker_id", "text"], ["p_limit", "integer"], ["p_lease_seconds", "integer"], ["p_now", "timestamptz"], ["p_current_transport_epoch", "text"], ["p_current_transport_generation", "bigint"]],
      reads_tables: ["trigger_event_outbox", "eventing_transport_epochs"],
      writes_tables: ["trigger_event_outbox"],
      effects: [{ table_name: "trigger_event_outbox", operation: "claim", concurrency_control: "lease_fence" }],
      returns: "setof jsonb",
    }),
    ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "ack_trigger_event_outbox_v1",
      primary_table: "trigger_event_outbox",
      writer_kind: "outbox_claim_ack",
      arguments: [["p_outbox_id", "text"], ["p_claim_token", "text"], ["p_outcome", "text"], ["p_next_retry_at", "timestamptz"], ["p_error", "jsonb"], ["p_transport_ref", "text"], ["p_transport_epoch", "text"], ["p_transport_generation", "bigint"], ["p_current_transport_epoch", "text"], ["p_current_transport_generation", "bigint"], ["p_now", "timestamptz"]],
      reads_tables: ["trigger_event_outbox", "eventing_transport_epochs"],
      writes_tables: ["trigger_event_outbox", "trigger_event_dlq"],
      effects: [
        { table_name: "trigger_event_outbox", operation: "ack", concurrency_control: "lease_fence" },
        { table_name: "trigger_event_dlq", operation: "append", concurrency_control: "idempotency_key" },
      ],
      returns: "jsonb",
    }),
    ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "claim_trigger_command_outbox_v1",
      primary_table: "trigger_command_outbox",
      writer_kind: "outbox_claim_ack",
      arguments: [["p_worker_id", "text"], ["p_limit", "integer"], ["p_lease_seconds", "integer"], ["p_now", "timestamptz"], ["p_current_transport_epoch", "text"], ["p_current_transport_generation", "bigint"]],
      reads_tables: ["trigger_command_outbox", "runtime_start_reservations", "eventing_transport_epochs"],
      writes_tables: ["trigger_command_outbox", "runtime_start_reservations"],
      effects: [
        { table_name: "trigger_command_outbox", operation: "claim", concurrency_control: "lease_fence" },
        {
          table_name: "runtime_start_reservations",
          operation: "transition",
          concurrency_control: "advisory_identity_lock",
          advisory_lock: RUNTIME_START_CLAIMED_OUTBOX_PROCESS_LOCK_V1,
        },
      ],
      returns: "setof jsonb",
    }),
    ownerFunctionSignatureV1({
      schema: "trigger_processor",
      function_name: "ack_trigger_command_outbox_v1",
      primary_table: "trigger_command_outbox",
      writer_kind: "outbox_claim_ack",
      arguments: [["p_outbox_id", "text"], ["p_claim_token", "text"], ["p_outcome", "text"], ["p_next_retry_at", "timestamptz"], ["p_error", "jsonb"], ["p_transport_ref", "text"], ["p_transport_epoch", "text"], ["p_transport_generation", "bigint"], ["p_current_transport_epoch", "text"], ["p_current_transport_generation", "bigint"], ["p_now", "timestamptz"]],
      reads_tables: ["trigger_command_outbox", "eventing_transport_epochs"],
      writes_tables: ["trigger_command_outbox", "trigger_command_dlq"],
      effects: [
        { table_name: "trigger_command_outbox", operation: "ack", concurrency_control: "lease_fence" },
        { table_name: "trigger_command_dlq", operation: "append", concurrency_control: "idempotency_key" },
      ],
      returns: "jsonb",
    }),
    ownerEventingTransportEpochActivationSignatureV1("trigger_processor"),
    ],
    // The generator imports this module under an explicit cache-busting
    // `?writer=` URL so it can attest a changed signature before the new
    // artifact exists. Normal application imports never carry that marker
    // and therefore remain fail-closed on exact artifact drift.
    ...(new URL(import.meta.url).searchParams.has("writer")
      ? {}
      : { writer_artifacts: TRIGGER_PROCESSOR_WRITER_ARTIFACTS_V1 }),
  database_columns: TRIGGER_PROCESSOR_DATABASE_COLUMNS_V1,
  database_checks: TRIGGER_PROCESSOR_DATABASE_CHECKS_V1,
  database_functions: TRIGGER_PROCESSOR_DATABASE_FUNCTIONS_V1,
  database_triggers: TRIGGER_PROCESSOR_DATABASE_TRIGGERS_V1,
  database_unique_constraints: TRIGGER_PROCESSOR_DATABASE_UNIQUE_CONSTRAINTS_V1,
  database_indexes: TRIGGER_PROCESSOR_DATABASE_INDEXES_V1,
  foreign_key_snapshot: {
    status: "complete",
    source:
      "Database Design revision 536 plus pre-admission audit decision comment 7665309975702474029 / canonical fresh 0100_trigger_processor foreign-key snapshot",
  },
  foreign_keys: TRIGGER_PROCESSOR_FOREIGN_KEYS_V1,
  append_only_tables: [
      "trigger_process_transitions",
      "trigger_context_source_outcomes",
      "trigger_process_event_projections",
      "trigger_event_outbox",
      "trigger_event_inbox",
      "trigger_event_dlq",
      TRIGGER_EVENT_DLQ_RESOLUTION_V1.resolution_table,
      "trigger_command_outbox",
      "trigger_command_dlq",
      TRIGGER_COMMAND_DLQ_RESOLUTION_V1.resolution_table,
      "bot_intent_policy_revisions",
      "bot_intent_policy_audit_logs",
      "intent_policy_snapshots",
      "trigger_snapshot_overflow_refs",
      "trigger_snapshot_append_audits",
      "trigger_submit_attempts",
    ],
    outbox_tables: ["trigger_event_outbox", "trigger_command_outbox"],
    inbox_tables: ["trigger_event_inbox"],
    dlq_tables: ["trigger_event_dlq", "trigger_command_dlq"],
    dlq_resolutions: [
      TRIGGER_EVENT_DLQ_RESOLUTION_V1.binding,
      TRIGGER_COMMAND_DLQ_RESOLUTION_V1.binding,
    ],
    object_metadata_tables: [
      "trigger_process_snapshots",
      "trigger_snapshot_overflow_refs",
    ],
  } as const);

export interface TriggerProcessorRepositoryPortV1
  extends OwnerRepositoryPortV1<
    typeof TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1
  > {}

export type TriggerProcessorUnitOfWorkPortV1 = OwnerUnitOfWorkPortV1<
  "trigger_processor",
  Readonly<{ owner: TriggerProcessorRepositoryPortV1 }>
>;

type TriggerProcessorManifestSemanticViewV1 = Readonly<{
  function_signatures: readonly Readonly<{
    function_name: string;
    arguments: readonly Readonly<{ argument_name: string }>[];
    reads_tables: readonly string[];
    writes_tables: readonly string[];
    effects: readonly Readonly<{
      table_name: string;
      operation: string;
      concurrency_control: string;
      advisory_lock?: Readonly<{
        key_prefix: string;
        identity_arguments: readonly string[];
        identity_source?: "claimed_outbox_aggregate_id";
        separator: string;
        order: number;
      }>;
    }>[];
  }>[];
  table_permissions: readonly Readonly<{
    table_name: string;
    writer_kind: string;
  }>[];
  append_only_tables: readonly string[];
  database_checks?: readonly Readonly<{
    constraint_name: string;
    semantic_constraint?: Readonly<{
      kind: string;
      column_name: string;
      allowed_values?: readonly string[];
    }>;
  }>[];
}>;

export function assertTriggerProcessorLifecycleWriterSemanticsV1(
  contract: TriggerProcessorManifestSemanticViewV1,
): void {
  const writer = (name: string) => {
    const value = contract.function_signatures.find(
      ({ function_name }) => function_name === name,
    );
    if (value === undefined) {
      throw new Error(`missing Trigger lifecycle writer: ${name}`);
    }
    return value;
  };
  const assertIncludes = (
    label: string,
    actual: readonly string[],
    expected: readonly string[],
  ) => {
    if (expected.some((value) => !actual.includes(value))) {
      throw new Error(`${label} is missing a required Trigger lifecycle fence`);
    }
  };
  const effectKey = (
    effect: Readonly<{
      table_name: string;
      operation: string;
      concurrency_control: string;
    }>,
  ) => `${effect.table_name}:${effect.operation}:${effect.concurrency_control}`;
  const assertEffects = (
    name: string,
    expected: readonly string[],
  ) => {
    const signature = writer(name);
    const actual = signature.effects.map(effectKey);
    assertIncludes(`${name}.effects`, actual, expected);
  };
  const assertExactEffects = (
    name: string,
    expected: readonly string[],
  ) => {
    const actual = writer(name).effects.map(effectKey);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(
        `${name}.effects must match its Trigger lifecycle edge exactly`,
      );
    }
  };

  assertIncludes(
    "promote_weak_trigger_queue_head_v1.arguments",
    writer("promote_weak_trigger_queue_head_v1").arguments.map(
      ({ argument_name }) => argument_name,
    ),
    [
      "p_expected_queue_status",
      "p_expected_queue_updated_at",
      "p_expected_slot_fence",
      "p_expected_strong_fifo_revision",
      "p_expected_strong_fifo_empty_fence",
      "p_strong_fifo_empty_lock_ref",
      "p_worker_id",
      "p_lease_seconds",
    ],
  );
  assertExactEffects("promote_weak_trigger_queue_head_v1", [
    "weak_trigger_queue_items:transition:lease_fence",
    "weak_trigger_groups:transition:expected_state_version",
    "bot_foreground_slots:cas:generation_fence",
    "trigger_processes:transition:expected_state_version",
    "trigger_process_transitions:append:idempotency_key",
    "trigger_command_outbox:enqueue:idempotency_key",
    "trigger_event_outbox:enqueue:idempotency_key",
  ]);
  assertIncludes(
    "promote_strong_fifo_head_v1.arguments",
    writer("promote_strong_fifo_head_v1").arguments.map(
      ({ argument_name }) => argument_name,
    ),
    [
      "p_expected_slot_fence",
      "p_expected_strong_fifo_revision",
      "p_expected_head_process_id",
      "p_expected_head_admission_time",
      "p_strong_fifo_head_lock_ref",
      "p_expected_preempt_commit_fence",
      "p_expected_head_phase",
      "p_expected_head_status",
      "p_expected_head_updated_at",
    ],
  );
  assertExactEffects("promote_strong_fifo_head_v1", [
    "bot_foreground_slots:cas:generation_fence",
    "trigger_processes:transition:expected_state_version",
    "trigger_process_work_items:enqueue:idempotency_key",
    "trigger_process_transitions:append:idempotency_key",
    "trigger_event_outbox:enqueue:idempotency_key",
  ]);

  if (
    contract.function_signatures.some(
      ({ function_name }) =>
        function_name === "transition_trigger_process_v1" ||
        function_name === "transition_trigger_process_aggregate_local_v1" ||
        function_name === "transition_trigger_confirmation_v1" ||
        function_name === "transition_weak_trigger_queue_item_v1",
    )
  ) {
    throw new Error("generic Trigger lifecycle writer is not permitted");
  }
  const processWriterAllowlist = new Set([
    "create_trigger_admission_v1",
    "advance_trigger_stage_v1",
    "schedule_trigger_stage_retry_v1",
    "create_runtime_start_reservation_v1",
    "record_runtime_started_v1",
    "finalize_trigger_runtime_terminal_v1",
    "apply_runtime_control_handled_v1",
    "record_runtime_start_uncertain_v1",
    "schedule_runtime_start_recompose_v1",
    "request_runtime_preempt_v1",
    "finalize_trigger_meta_projection_v1",
    "create_trigger_confirmation_challenge_v1",
    "accept_trigger_confirmation_v1",
    "reject_trigger_confirmation_v1",
    "expire_trigger_confirmation_v1",
    "request_trigger_cancel_v1",
    "transition_trigger_cancel_request_v1",
    "enter_trigger_cooldown_v1",
    "enqueue_trigger_meta_job_v1",
    "promote_weak_trigger_queue_head_v1",
    "promote_strong_fifo_head_v1",
    "transition_trigger_snapshot_pending_event_v1",
  ]);
  const unexpectedProcessWriters = contract.function_signatures
    .filter(
      ({ function_name, writes_tables }) =>
        writes_tables.includes("trigger_processes") &&
        !processWriterAllowlist.has(function_name),
    )
    .map(({ function_name }) => function_name);
  if (unexpectedProcessWriters.length > 0) {
    throw new Error(
      `generic Trigger process authority is forbidden: ${unexpectedProcessWriters.join(", ")}`,
    );
  }

  const processTransitionEffects = [
    "trigger_processes:transition:expected_state_version",
    "trigger_process_transitions:append:idempotency_key",
    "trigger_event_outbox:enqueue:idempotency_key",
  ] as const;
  assertIncludes(
    "finalize_trigger_meta_projection_v1.arguments",
    writer("finalize_trigger_meta_projection_v1").arguments.map(
      ({ argument_name }) => argument_name,
    ),
    [
      "p_expected_projection_version",
      "p_expected_process_phase",
      "p_expected_process_status",
      "p_expected_process_updated_at",
      "p_expected_meta_enqueue_reason",
      "p_source_event",
      "p_meta_finalization_evidence",
      "p_idempotency_key",
    ],
  );
  assertIncludes(
    "finalize_trigger_meta_projection_v1.reads_tables",
    writer("finalize_trigger_meta_projection_v1").reads_tables,
    [
      "trigger_process_meta_projections",
      "trigger_processes",
      "trigger_process_transitions",
      "trigger_event_inbox",
    ],
  );
  assertIncludes(
    "advance_trigger_stage_v1.context_completion_arguments",
    writer("advance_trigger_stage_v1").arguments.map(
      ({ argument_name }) => argument_name,
    ),
    [
      "p_context_snapshot_ref",
      "p_context_snapshot_version",
      "p_context_snapshot_hash",
      "p_context_snapshot_retention_until",
      "p_context_source_outcomes",
    ],
  );
  const coupledWriters = [
    {
      name: "advance_trigger_stage_v1",
      evidenceArgument: "p_stage_result",
      effects: [
        "trigger_processes:transition:expected_state_version",
        "trigger_context_source_outcomes:append:idempotency_key",
        "trigger_process_work_items:ack:lease_fence",
        "trigger_process_work_items:enqueue:idempotency_key",
        "intent_policy_snapshots:append:idempotency_key",
        "trigger_confirmation_challenges:append:idempotency_key",
        "trigger_process_transitions:append:idempotency_key",
        "trigger_event_outbox:enqueue:idempotency_key",
      ],
    },
    {
      name: "schedule_trigger_stage_retry_v1",
      evidenceArgument: "p_stage_retry_scheduled_evidence",
      effects: [
        "trigger_processes:transition:expected_state_version",
        "trigger_process_work_items:ack:lease_fence",
        "trigger_process_work_items:enqueue:idempotency_key",
        "trigger_process_transitions:append:idempotency_key",
        "trigger_event_outbox:enqueue:idempotency_key",
      ],
    },
    {
      name: "create_trigger_confirmation_challenge_v1",
      evidenceArgument: "p_confirmation_challenge_created_evidence",
      effects: [
        "trigger_confirmation_challenges:append:idempotency_key",
        ...processTransitionEffects,
      ],
    },
    {
      name: "create_runtime_start_reservation_v1",
      evidenceArgument: "p_reservation",
      effects: [
        "runtime_start_reservations:append:idempotency_key",
        "runtime_start_reservations:append:advisory_identity_lock",
        "runtime_start_reservations:append:advisory_identity_lock",
        "bot_foreground_slots:upsert:advisory_identity_lock",
        "trigger_processes:transition:expected_state_version",
        "trigger_process_work_items:ack:lease_fence",
        "trigger_snapshot_append_cursors:upsert:idempotency_key",
        "trigger_process_transitions:append:idempotency_key",
        "trigger_command_outbox:enqueue:idempotency_key",
        "trigger_event_outbox:enqueue:idempotency_key",
      ],
    },
    {
      name: "record_runtime_started_v1",
      evidenceArgument: "p_source_event",
      effects: [
        "runtime_start_reservations:transition:generation_fence",
        "runtime_start_reservations:transition:advisory_identity_lock",
        "trigger_process_snapshots:append:idempotency_key",
        "trigger_process_snapshots:transition:database_row_lock",
        "trigger_snapshot_overflow_refs:append:idempotency_key",
        "trigger_snapshot_pending_events:enqueue:idempotency_key",
        "trigger_snapshot_append_audits:append:idempotency_key",
        "trigger_snapshot_append_cursors:cas:database_row_lock",
        "trigger_process_event_projections:append:idempotency_key",
        "trigger_event_inbox:append:durable_event_identity",
        "trigger_event_dlq:append:idempotency_key",
        "trigger_processes:transition:database_row_lock",
        "trigger_process_transitions:append:idempotency_key",
        "trigger_event_outbox:enqueue:idempotency_key",
      ],
    },
    {
      name: "finalize_trigger_runtime_terminal_v1",
      evidenceArgument: "p_source_event",
      effects: [
        "runtime_start_reservations:transition:generation_fence",
        "runtime_start_reservations:transition:advisory_identity_lock",
        "trigger_process_cancel_requests:transition:database_row_lock",
        "trigger_event_inbox:append:durable_event_identity",
        "trigger_event_dlq:append:idempotency_key",
        "trigger_process_snapshots:append:idempotency_key",
        "trigger_process_snapshots:transition:database_row_lock",
        "trigger_snapshot_overflow_refs:append:idempotency_key",
        "trigger_snapshot_pending_events:enqueue:idempotency_key",
        "trigger_snapshot_append_cursors:cas:database_row_lock",
        "trigger_snapshot_append_audits:append:idempotency_key",
        "trigger_process_event_projections:append:idempotency_key",
        "trigger_processes:transition:database_row_lock",
        "bot_foreground_slots:cas:database_row_lock",
        "trigger_process_work_items:enqueue:idempotency_key",
        "trigger_process_transitions:append:idempotency_key",
        "trigger_event_outbox:enqueue:idempotency_key",
      ],
    },
    {
      name: "apply_runtime_control_handled_v1",
      evidenceArgument: "p_source_event",
      effects: [
        "trigger_process_cancel_requests:transition:database_row_lock",
        "trigger_process_cancel_requests:transition:advisory_identity_lock",
        "trigger_event_inbox:append:durable_event_identity",
        "trigger_event_dlq:append:idempotency_key",
        "trigger_process_snapshots:append:idempotency_key",
        "trigger_process_snapshots:transition:database_row_lock",
        "trigger_snapshot_overflow_refs:append:idempotency_key",
        "trigger_snapshot_pending_events:enqueue:idempotency_key",
        "trigger_snapshot_append_cursors:cas:database_row_lock",
        "trigger_snapshot_append_audits:append:idempotency_key",
        "trigger_process_event_projections:append:idempotency_key",
        "trigger_processes:transition:database_row_lock",
      ],
    },
    {
      name: "record_runtime_start_uncertain_v1",
      evidenceArgument: "p_runtime_start_uncertain_evidence",
      effects: [
        "runtime_start_reservations:transition:generation_fence",
        "runtime_start_reservations:transition:advisory_identity_lock",
        "trigger_processes:transition:expected_state_version",
        "trigger_process_transitions:append:idempotency_key",
        "trigger_event_outbox:enqueue:idempotency_key",
      ],
    },
    {
      name: "schedule_runtime_start_recompose_v1",
      evidenceArgument: "p_runtime_start_recompose_evidence",
      effects: [
        "runtime_start_reservations:transition:generation_fence",
        "runtime_start_reservations:transition:advisory_identity_lock",
        "trigger_processes:transition:expected_state_version",
        "trigger_process_work_items:enqueue:idempotency_key",
        "trigger_process_transitions:append:idempotency_key",
        "trigger_event_outbox:enqueue:idempotency_key",
      ],
    },
    {
      name: "request_runtime_preempt_v1",
      evidenceArgument: "p_runtime_control_requested_evidence",
      effects: [
        "trigger_processes:transition:generation_fence",
        "trigger_process_transitions:append:idempotency_key",
        "trigger_command_outbox:enqueue:idempotency_key",
        "trigger_event_outbox:enqueue:idempotency_key",
      ],
    },
    {
      name: "request_trigger_cancel_v1",
      evidenceArgument: "p_cancel_request",
      effects: [
        "trigger_process_cancel_requests:append:idempotency_key",
        "runtime_start_reservations:transition:advisory_identity_lock",
        "runtime_start_reservations:transition:database_row_lock",
        "trigger_processes:transition:database_row_lock",
        "trigger_process_transitions:append:idempotency_key",
        "trigger_command_outbox:enqueue:idempotency_key",
        "trigger_event_outbox:enqueue:idempotency_key",
      ],
    },
    {
      name: "enter_trigger_cooldown_v1",
      evidenceArgument: "p_source_event",
      effects: [
        "runtime_start_reservations:transition:generation_fence",
        "runtime_start_reservations:transition:advisory_identity_lock",
        "trigger_event_inbox:append:durable_event_identity",
        "trigger_event_dlq:append:idempotency_key",
        "trigger_process_snapshots:append:idempotency_key",
        "trigger_process_snapshots:transition:database_row_lock",
        "trigger_snapshot_overflow_refs:append:idempotency_key",
        "trigger_snapshot_pending_events:enqueue:idempotency_key",
        "trigger_snapshot_append_cursors:cas:database_row_lock",
        "trigger_snapshot_append_audits:append:idempotency_key",
        "trigger_process_event_projections:append:idempotency_key",
        "trigger_processes:transition:database_row_lock",
        "trigger_process_work_items:enqueue:idempotency_key",
        "trigger_process_transitions:append:idempotency_key",
        "trigger_event_outbox:enqueue:idempotency_key",
      ],
    },
    {
      name: "enqueue_trigger_meta_job_v1",
      evidenceArgument: "p_enqueue_reason",
      effects: [
        "trigger_processes:transition:expected_state_version",
        "trigger_process_meta_projections:upsert:idempotency_key",
        "trigger_process_work_items:ack:lease_fence",
        "trigger_process_transitions:append:idempotency_key",
        "trigger_command_outbox:enqueue:idempotency_key",
        "trigger_event_outbox:enqueue:idempotency_key",
      ],
    },
    {
      name: "finalize_trigger_meta_projection_v1",
      evidenceArgument: "p_meta_finalization_evidence",
      effects: [
        "trigger_process_meta_projections:upsert:expected_version",
        "trigger_processes:transition:expected_state_version",
        "trigger_process_transitions:append:idempotency_key",
        "trigger_event_inbox:append:durable_event_identity",
        "trigger_event_dlq:append:idempotency_key",
        "trigger_event_outbox:enqueue:idempotency_key",
      ],
    },
  ] as const;
  for (const { name, evidenceArgument, effects } of coupledWriters) {
    assertIncludes(
      `${name}.arguments`,
      writer(name).arguments.map(({ argument_name }) => argument_name),
      [evidenceArgument],
    );
    assertExactEffects(name, effects);
  }
  const runtimeStartProcessLock = {
    key_prefix: "trigger_processor:runtime_start_reservation_process:",
    identity_arguments: ["p_process_id"],
    separator: ":",
    order: 1,
  } as const;
  const runtimeStartAttemptLock = {
    key_prefix: "trigger_processor:runtime_start_reservation:",
    identity_arguments: ["p_process_id", "p_start_attempt_no"],
    separator: ":",
    order: 2,
  } as const;
  const runtimeStartClaimedOutboxProcessLock = {
    key_prefix: "trigger_processor:runtime_start_reservation_process:",
    identity_arguments: [],
    identity_source: "claimed_outbox_aggregate_id",
    separator: ":",
    order: 1,
  } as const;
  const runtimeStartBotSlotLock = {
    key_prefix: "trigger_processor:foreground_slot:",
    identity_arguments: ["p_bot_id"],
    separator: ":",
    order: 3,
  } as const;
  const advisoryLockMatches = (
    actual: Readonly<{
      key_prefix: string;
      identity_arguments: readonly string[];
      identity_source?: "claimed_outbox_aggregate_id";
      separator: string;
      order: number;
    }> | undefined,
    expected: Readonly<{
      key_prefix: string;
      identity_arguments: readonly string[];
      identity_source?: "claimed_outbox_aggregate_id";
      separator: string;
      order: number;
    }>,
  ): boolean =>
    actual !== undefined &&
    actual.key_prefix === expected.key_prefix &&
    actual.identity_source === expected.identity_source &&
    actual.separator === expected.separator &&
    actual.order === expected.order &&
    actual.identity_arguments.length ===
      expected.identity_arguments.length &&
    actual.identity_arguments.every(
      (argument, index) =>
        argument === expected.identity_arguments[index],
    );
  const runtimeStartReservationWriters = contract.function_signatures.filter(
    ({ writes_tables }) =>
      writes_tables.includes("runtime_start_reservations"),
  );
  if (runtimeStartReservationWriters.length === 0) {
    throw new Error("Runtime Start reservation writer closure is empty");
  }
  const runtimeStartProcessLockWriterNames = [
    "create_runtime_start_reservation_v1",
    "record_runtime_started_v1",
    "record_runtime_start_uncertain_v1",
    "schedule_runtime_start_recompose_v1",
    "request_trigger_cancel_v1",
    "enter_trigger_cooldown_v1",
    "finalize_trigger_runtime_terminal_v1",
    "apply_runtime_control_handled_v1",
    "append_trigger_snapshot_v1",
  ] as const;
  for (const name of runtimeStartProcessLockWriterNames) {
    const processLocks = writer(name).effects
      .filter(
        ({ concurrency_control }) =>
          concurrency_control === "advisory_identity_lock",
      )
      .map(({ advisory_lock }) => advisory_lock);
    if (
      processLocks.filter((lock) =>
        advisoryLockMatches(lock, runtimeStartProcessLock),
      ).length !== 1
    ) {
      throw new Error(`${name} must acquire the Runtime Start coarse process lock`);
    }
  }
  for (const runtimeStartWriter of runtimeStartReservationWriters) {
    const advisoryLocks = runtimeStartWriter.effects
      .filter(
        ({ table_name, concurrency_control }) =>
          table_name === "runtime_start_reservations" &&
          concurrency_control === "advisory_identity_lock",
      )
      .map(({ advisory_lock }) => advisory_lock);
    const expectedLock = runtimeStartWriter.function_name ===
      "claim_trigger_command_outbox_v1"
      ? runtimeStartClaimedOutboxProcessLock
      : runtimeStartProcessLock;
    if (advisoryLocks.filter((lock) =>
      advisoryLockMatches(lock, expectedLock),
    ).length !== 1) {
      throw new Error(
        `${runtimeStartWriter.function_name} must acquire the Runtime Start coarse process lock`,
      );
    }
    if (
      runtimeStartWriter.function_name ===
        "create_runtime_start_reservation_v1" &&
      (advisoryLocks.length !== 2 ||
        !advisoryLockMatches(
          advisoryLocks[0],
          runtimeStartProcessLock,
        ) ||
        !advisoryLockMatches(
          advisoryLocks[1],
          runtimeStartAttemptLock,
        ))
    ) {
      throw new Error(
        "create_runtime_start_reservation_v1 must acquire coarse-to-exact Runtime Start locks",
      );
    }
    if (runtimeStartWriter.function_name === "create_runtime_start_reservation_v1") {
      const botSlotLocks = runtimeStartWriter.effects
        .filter(
          ({ table_name, concurrency_control }) =>
            table_name === "bot_foreground_slots" &&
            concurrency_control === "advisory_identity_lock",
        )
        .map(({ advisory_lock }) => advisory_lock);
      if (
        botSlotLocks.length !== 1 ||
        !advisoryLockMatches(botSlotLocks[0], runtimeStartBotSlotLock)
      ) {
        throw new Error(
          "create_runtime_start_reservation_v1 must acquire the bot foreground slot lock after its reservation locks",
        );
      }
    }
  }
  for (const name of [
    "record_runtime_started_v1",
    "enter_trigger_cooldown_v1",
    "finalize_trigger_runtime_terminal_v1",
    "apply_runtime_control_handled_v1",
    "append_trigger_snapshot_v1",
  ]) {
    assertIncludes(
      `${name}.retention_arguments`,
      writer(name).arguments.map(({ argument_name }) => argument_name),
      ["p_owner_event_read", "p_expected_snapshot_retention_until"],
    );
  }
  assertExactEffects("accept_trigger_confirmation_v1", [
    "trigger_confirmation_challenges:transition:database_row_lock",
    "trigger_processes:transition:database_row_lock",
    "trigger_process_work_items:ack:database_row_lock",
    "trigger_process_transitions:append:idempotency_key",
    "trigger_event_outbox:enqueue:idempotency_key",
  ]);
  for (const name of [
    "reject_trigger_confirmation_v1",
    "expire_trigger_confirmation_v1",
  ]) {
    assertExactEffects(name, [
      "trigger_confirmation_challenges:transition:database_row_lock",
      "trigger_processes:transition:database_row_lock",
      "trigger_process_work_items:ack:database_row_lock",
      "trigger_process_transitions:append:idempotency_key",
      "trigger_event_outbox:enqueue:idempotency_key",
    ]);
  }
  assertExactEffects("transition_trigger_cancel_request_v1", [
    "trigger_process_cancel_requests:transition:expected_state_version",
    ...processTransitionEffects,
  ]);
  assertExactEffects("claim_weak_trigger_queue_v1", [
    "weak_trigger_queue_items:transition:lease_fence",
  ]);
  assertExactEffects("claim_trigger_process_work_v1", [
    "trigger_process_work_items:claim:lease_fence",
  ]);
  assertExactEffects("ack_trigger_process_work_v1", [
    "trigger_process_work_items:ack:lease_fence",
  ]);
  assertExactEffects("append_trigger_snapshot_v1", [
    "trigger_process_snapshots:append:idempotency_key",
    "trigger_process_snapshots:append:advisory_identity_lock",
    "trigger_process_snapshots:transition:database_row_lock",
    "trigger_snapshot_overflow_refs:append:idempotency_key",
    "trigger_snapshot_pending_events:enqueue:idempotency_key",
    "trigger_snapshot_append_audits:append:idempotency_key",
    "trigger_snapshot_append_cursors:cas:database_row_lock",
    "trigger_process_event_projections:append:idempotency_key",
    "trigger_event_inbox:append:durable_event_identity",
    "trigger_event_dlq:append:idempotency_key",
  ]);
  for (const name of [
    "advance_trigger_stage_v1",
    "schedule_trigger_stage_retry_v1",
    "create_runtime_start_reservation_v1",
    "enqueue_trigger_meta_job_v1",
    "dispatch_trigger_snapshot_repair_v1",
  ]) {
    assertIncludes(
      `${name}.work_claim_arguments`,
      writer(name).arguments.map(({ argument_name }) => argument_name),
      [
        "p_work_item_id",
        "p_claim_token",
        "p_lease_generation",
        "p_lease_owner",
        "p_expected_process_state_version",
        "p_result_hash",
      ],
    );
    assertIncludes(`${name}.work_claim_reads`, writer(name).reads_tables, [
      "trigger_processes",
      "trigger_process_work_items",
    ]);
    assertIncludes(`${name}.work_claim_writes`, writer(name).writes_tables, [
      "trigger_process_work_items",
    ]);
  }
  assertExactEffects("dispatch_trigger_snapshot_repair_v1", [
    "trigger_snapshot_repair_jobs:transition:expected_state_version",
    "trigger_process_work_items:ack:lease_fence",
    "trigger_command_outbox:enqueue:idempotency_key",
    "trigger_event_outbox:enqueue:idempotency_key",
  ]);
  assertExactEffects("retry_weak_trigger_queue_item_v1", [
    "weak_trigger_queue_items:transition:lease_fence",
    "trigger_event_outbox:enqueue:idempotency_key",
  ]);
  assertExactEffects("complete_weak_trigger_queue_item_v1", [
    "weak_trigger_queue_items:transition:lease_fence",
    "weak_trigger_groups:transition:expected_state_version",
    "trigger_event_outbox:enqueue:idempotency_key",
  ]);
  assertExactEffects("transition_weak_trigger_group_v1", [
    "weak_trigger_groups:transition:expected_state_version",
    "trigger_event_outbox:enqueue:idempotency_key",
  ]);
  for (const name of [
    "claim_weak_trigger_queue_v1",
    "retry_weak_trigger_queue_item_v1",
    "promote_weak_trigger_queue_head_v1",
    "transition_trigger_snapshot_pending_event_v1",
    "transition_trigger_snapshot_repair_job_v1",
  ]) {
    const callerClockArguments = writer(name).arguments
      .map(({ argument_name }) => argument_name)
      .filter((argumentName) =>
        ["p_now", "p_next_available_at", "p_next_retry_at"].includes(
          argumentName,
        ),
      );
    if (callerClockArguments.length > 0) {
      throw new Error(
        `${name} must derive lease and retry timing from PostgreSQL clock_timestamp()`,
      );
    }
  }
  assertIncludes(
    "create_trigger_admission_v1.writes_tables",
    writer("create_trigger_admission_v1").writes_tables,
    ["trigger_process_work_items", "trigger_command_outbox"],
  );

  for (const table of [
    "weak_trigger_queue_items",
    "weak_trigger_groups",
    "trigger_confirmation_challenges",
    "trigger_process_cancel_requests",
    "trigger_snapshot_pending_events",
    "trigger_snapshot_repair_jobs",
  ]) {
    if (
      contract.append_only_tables.includes(table) ||
      contract.table_permissions.find(
        ({ table_name }) => table_name === table,
      )?.writer_kind !== "state_transition"
    ) {
      throw new Error(`${table} must remain a mutable state-transition table`);
    }
  }
  const terminalCheck = contract.database_checks?.find(
    ({ constraint_name }) =>
      constraint_name === "trigger_processes_terminal_outcome_check",
  )?.semantic_constraint;
  if (
    terminalCheck?.kind !== "nullable_text_enum" ||
    terminalCheck.column_name !== "terminal_outcome" ||
    JSON.stringify(terminalCheck.allowed_values) !==
      JSON.stringify(TERMINAL_OUTCOMES_V1)
  ) {
    throw new Error("Trigger terminal_outcome CHECK must contain all nine outcomes");
  }
}

assertTriggerProcessorLifecycleWriterSemanticsV1(
  TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
);
