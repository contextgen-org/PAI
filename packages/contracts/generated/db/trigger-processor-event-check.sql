alter table trigger_processor.trigger_event_outbox
  drop constraint if exists trigger_event_outbox_event_schema_pair_check,
  drop constraint if exists trigger_event_outbox_payload_domain_event_v1_check,
  drop constraint if exists trigger_event_outbox_schema_version_check,
  drop constraint if exists trigger_event_outbox_domain_event_v1_check,
  add constraint trigger_event_outbox_schema_version_check
  check (schema_version = 'trigger_processor_event.v1'),
  add constraint trigger_event_outbox_domain_event_v1_check
  check (
    producer = 'trigger_processor'
    and schema_version = 'trigger_processor_event.v1'
    and event_type in ('trigger.accepted', 'trigger.rejected', 'trigger_process.phase_changed', 'trigger_process.user_message_retracted', 'trigger_process.system_interrupted', 'cooldown.expired', 'weak_trigger.merged', 'trigger_process.outcome_finalized')
  );
