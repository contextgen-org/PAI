CHECK (
  schema_version = 'trigger_processor_command.v1'
  AND producer = 'trigger_processor'
  AND jsonb_typeof(payload) = 'object'
  AND (
    (command_type = 'runtime.start' AND target = 'action_runtime' AND payload->>'schema_version' = 'runtime_start.v1.2')
    OR (command_type = 'runtime.cancel' AND target = 'action_runtime' AND payload->>'schema_version' = 'runtime_cancel.v1')
    OR (command_type = 'runtime.preempt' AND target = 'action_runtime' AND payload->>'schema_version' = 'runtime_preempt.v1')
    OR (command_type = 'runtime.user_retract' AND target = 'action_runtime' AND payload->>'schema_version' = 'runtime_user_retract.v1')
    OR (command_type = 'meta.job.create' AND target = 'meta_cognition' AND payload->>'schema_version' = 'meta_job_create.v1')
    OR (command_type = 'meta.snapshot_repair' AND target = 'meta_cognition' AND payload->>'schema_version' = 'meta_snapshot_repair.v1')
    OR (command_type = 'meta.feedback_answer' AND target = 'meta_cognition' AND payload->>'schema_version' = 'meta_feedback_answer.v1')
  )
)
