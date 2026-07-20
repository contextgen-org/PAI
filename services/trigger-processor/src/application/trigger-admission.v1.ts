import type { OwnerDatabaseApplicationDependenciesV1 } from "@pai/persistence";

import { TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1 } from "../db/permission-manifest.v1.js";
import {
  decideTriggerAdmissionV1,
  type TrustedAdmissionFactsV1,
} from "../domain/admission.js";

export type TriggerProcessorOwnerDatabaseV1 =
  OwnerDatabaseApplicationDependenciesV1<
    typeof TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1
  >;

export interface AdmitTriggerCommandV1 {
  readonly trigger_id: string;
  readonly process_id: string;
  readonly scope: Readonly<Record<string, unknown>>;
  readonly actor: Readonly<Record<string, unknown>>;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly dedupe_key: string;
  readonly request_hash: string;
  readonly idempotency_key: string;
  readonly trace_id: string;
  readonly facts: TrustedAdmissionFactsV1;
}

export interface TriggerAdmissionApplicationV1 {
  admit<TResult>(command: AdmitTriggerCommandV1): Promise<TResult>;
}

/**
 * The production admission mutation boundary. The generated owner writer must
 * lock and re-check the persisted slot/process facts represented by
 * admission_precondition before it writes Trigger, Process, audit, and outbox.
 */
export function createTriggerAdmissionApplicationV1(
  database: TriggerProcessorOwnerDatabaseV1,
): TriggerAdmissionApplicationV1 {
  return Object.freeze({
    async admit<TResult>(command: AdmitTriggerCommandV1): Promise<TResult> {
      const decision = decideTriggerAdmissionV1(command.facts);
      return database.unit_of_work.withTransaction(
        {
          operation: "admit_trigger",
          idempotency_key: command.idempotency_key,
          trace_id: command.trace_id,
          isolation: "serializable",
          retry: "serialization_failures",
        },
        async (transaction, { owner }) =>
          owner.executeWriter<TResult, "admit_trigger_v1">(transaction, {
            writer: "admit_trigger_v1",
            arguments: {
              p_trigger_id: command.trigger_id,
              p_process_id: command.process_id,
              p_scope: command.scope,
              p_source: command.facts.source,
              p_actor: command.actor,
              p_payload: command.payload,
              p_dedupe_key: command.dedupe_key,
              p_request_hash: command.request_hash,
              p_priority: decision.priority,
              p_admission_precondition:
                decision.trigger_status === "accepted"
                  ? decision.admission_precondition
                  : null,
              p_admission_decision: decision,
              p_idempotency_key: command.idempotency_key,
              p_trace_id: command.trace_id,
            },
            expected_rows: 1,
          }),
      );
    },
  });
}
