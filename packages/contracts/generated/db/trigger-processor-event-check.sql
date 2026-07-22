alter table trigger_processor.trigger_event_outbox
  add constraint trigger_event_outbox_payload_domain_event_v1_check
  check (
    payload ? 'event_type'
    and payload ? 'schema_version'
    and payload ? 'producer'
    and payload ? 'payload'
    and payload->>'producer' = 'trigger_processor'
    and payload->>'schema_version' = 'trigger_processor_event.v1'
    and payload->>'event_type' in ('trigger.accepted', 'trigger.rejected', 'trigger_process.phase_changed', 'trigger_process.user_message_retracted', 'trigger_process.system_interrupted', 'cooldown.expired', 'weak_trigger.merged', 'trigger_process.outcome_finalized')
  );
