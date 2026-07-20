CHECK ((status = 'waiting') = (wait_reason IS NOT NULL)),
CHECK ((phase = 'closed') = (terminal_reason IS NOT NULL)),
CHECK (
  (phase = 'admission' AND status = 'running' AND wait_reason IS NULL)
  OR (phase = 'admission' AND status = 'waiting' AND wait_reason IN ('weak_queue', 'preempt_commit', 'deferred_strong_queue', 'stage_retry_wait'))
  OR (phase = 'context' AND status = 'running' AND wait_reason IS NULL)
  OR (phase = 'context' AND status = 'waiting' AND wait_reason IN ('runtime_start_recompose', 'stage_retry_wait'))
  OR (phase = 'intent' AND status = 'running' AND wait_reason IS NULL)
  OR (phase = 'intent' AND status = 'waiting' AND wait_reason IN ('external_confirmation', 'stage_retry_wait'))
  OR (phase = 'execution' AND status = 'waiting' AND wait_reason IN ('runtime_start', 'runtime_start_reconcile', 'stage_retry_wait'))
  OR (phase = 'execution' AND status IN ('running', 'preempt_requested', 'cancelling') AND wait_reason IS NULL)
  OR (phase = 'cooldown' AND status = 'waiting' AND wait_reason = 'cooldown_until')
  OR (phase = 'meta_enqueued' AND status = 'waiting' AND wait_reason = 'meta_enqueue_wait')
  OR (phase = 'closed' AND status IN ('completed', 'failed', 'preempted', 'cancelled') AND wait_reason IS NULL)
)
