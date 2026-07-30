import { Type, type Static, type TSchema } from "@sinclair/typebox";

import { DeploymentEnvironmentV1Schema } from "../shared/deployment-environment.v1.js";
import { ReleaseChannelV1Schema } from "../shared/release-channel.v1.js";
import { TypedEvidenceRefV1Schema } from "../shared/typed-evidence-ref.v1.js";
import {
  TerminalOutcomeV1Schema,
  type TerminalOutcomeV1,
  TriggerProcessStateV1Schema,
  type TriggerProcessStateV1,
} from "./trigger-process-state.v1.js";
import {
  TriggerPriorityV1Schema,
} from "./trigger-admission.v1.js";

const eventIdSchema = Type.String({ minLength: 1, maxLength: 256 });
const idempotencyKeySchema = Type.String({ minLength: 1, maxLength: 512 });
const traceIdSchema = Type.String({ minLength: 1, maxLength: 256 });
const nonEmptyStringSchema = Type.String({ minLength: 1, maxLength: 512 });
const reasonCodeSchema = Type.String({
  minLength: 1,
  maxLength: 128,
  pattern: "^[a-z][a-z0-9_]*(?:[._-][a-z0-9_]+)*$",
});
const canonicalTimestampSchema = Type.String({
  minLength: 20,
  maxLength: 35,
  pattern:
    "^\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])T(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d{1,9})?(?:Z|[+-](?:[01]\\d|2[0-3]):[0-5]\\d)$",
});
const boundedSequenceSchema = Type.Integer({
  minimum: 0,
  maximum: Number.MAX_SAFE_INTEGER,
});

const payloadBaseProperties = {
  workspace_id: nonEmptyStringSchema,
  bot_id: nonEmptyStringSchema,
  owner_agent_id: nonEmptyStringSchema,
  deployment_environment: DeploymentEnvironmentV1Schema,
  release_channel: ReleaseChannelV1Schema,
  reason_code: reasonCodeSchema,
  source_ref: TypedEvidenceRefV1Schema,
} as const satisfies Readonly<Record<string, TSchema>>;

function payload<const T extends Record<string, TSchema>>(properties: T) {
  return Type.Object(
    {
      ...payloadBaseProperties,
      ...properties,
    },
    { additionalProperties: false },
  );
}

function event<const TType extends string, const TPayload extends TSchema>(
  eventType: TType,
  payloadSchema: TPayload,
) {
  return Type.Object(
    {
      event_id: eventIdSchema,
      event_type: Type.Literal(eventType),
      schema_version: Type.Literal("trigger_processor_event.v1"),
      producer: Type.Literal("trigger_processor"),
      occurred_at: canonicalTimestampSchema,
      idempotency_key: idempotencyKeySchema,
      trace_id: traceIdSchema,
      payload: payloadSchema,
    },
    { additionalProperties: false },
  );
}

export const TRIGGER_PROCESSOR_DOMAIN_EVENT_CONSUMERS_V1 = Object.freeze({
  "trigger.accepted": Object.freeze(["observation_gateway"]),
  "trigger.rejected": Object.freeze(["trigger_processor"]),
  "trigger_process.phase_changed": Object.freeze([
    "observation_gateway",
    "meta_cognition",
  ]),
  "trigger_process.user_message_retracted": Object.freeze([
    "observation_gateway",
    "meta_cognition",
  ]),
  "trigger_process.system_interrupted": Object.freeze([
    "observation_gateway",
    "meta_cognition",
  ]),
  "cooldown.expired": Object.freeze(["trigger_processor"]),
  "weak_trigger.merged": Object.freeze(["observation_gateway"]),
  "trigger_process.outcome_finalized": Object.freeze([
    "observation_gateway",
    "trigger_processor",
  ]),
} as const);

export const TRIGGER_PROCESSOR_DOMAIN_EVENT_TYPES_V1 = Object.freeze(
  Object.keys(TRIGGER_PROCESSOR_DOMAIN_EVENT_CONSUMERS_V1),
) as readonly [
  keyof typeof TRIGGER_PROCESSOR_DOMAIN_EVENT_CONSUMERS_V1,
  ...(keyof typeof TRIGGER_PROCESSOR_DOMAIN_EVENT_CONSUMERS_V1)[],
];

export const TRIGGER_PROCESSOR_DOMAIN_EVENT_PAYLOAD_SCHEMAS_V1 = Object.freeze({
  "trigger.accepted": payload({
    trigger_id: eventIdSchema,
    trigger_process_id: eventIdSchema,
    admission_outcome: Type.Literal("accepted"),
    priority: TriggerPriorityV1Schema,
    dedupe_key: idempotencyKeySchema,
    request_hash: nonEmptyStringSchema,
  }),
  "trigger.rejected": payload({
    submit_attempt_id: eventIdSchema,
    rejection_stage: Type.Union([
      Type.Literal("business_admission"),
      Type.Literal("safety_admission"),
    ]),
    rejection_code: reasonCodeSchema,
  }),
  "trigger_process.phase_changed": payload({
    trigger_process_id: eventIdSchema,
    previous_state: TriggerProcessStateV1Schema,
    next_state: TriggerProcessStateV1Schema,
    expected_state_version: boundedSequenceSchema,
    transition_id: eventIdSchema,
  }),
  "trigger_process.user_message_retracted": payload({
    trigger_process_id: eventIdSchema,
    source_message_ref: TypedEvidenceRefV1Schema,
    boundary_system_event_ref: TypedEvidenceRefV1Schema,
  }),
  "trigger_process.system_interrupted": payload({
    trigger_process_id: eventIdSchema,
    boundary_system_event_ref: TypedEvidenceRefV1Schema,
    interrupt_source: nonEmptyStringSchema,
  }),
  "cooldown.expired": payload({
    trigger_process_id: eventIdSchema,
    cooldown_until: canonicalTimestampSchema,
    expired_at: canonicalTimestampSchema,
  }),
  "weak_trigger.merged": payload({
    weak_group_id: eventIdSchema,
    canonical_process_id: eventIdSchema,
    merged_process_ids: Type.Array(eventIdSchema, {
      minItems: 1,
      maxItems: 10_000,
    }),
    merge_window_started_at: canonicalTimestampSchema,
  }),
  "trigger_process.outcome_finalized": payload({
    trigger_process_id: eventIdSchema,
    terminal_outcome: TerminalOutcomeV1Schema,
    canonical_reason_code: reasonCodeSchema,
    finalized_at: canonicalTimestampSchema,
    canonical_process_id: Type.Optional(eventIdSchema),
    successor_process_id: Type.Optional(eventIdSchema),
    snapshot_transfer_ref: Type.Optional(nonEmptyStringSchema),
    boundary_system_event_ref: Type.Optional(TypedEvidenceRefV1Schema),
  }),
} as const);

export const TRIGGER_PROCESSOR_DOMAIN_EVENT_BRANCH_SCHEMAS_V1 = Object.freeze({
  "trigger.accepted": event(
    "trigger.accepted",
    TRIGGER_PROCESSOR_DOMAIN_EVENT_PAYLOAD_SCHEMAS_V1["trigger.accepted"],
  ),
  "trigger.rejected": event(
    "trigger.rejected",
    TRIGGER_PROCESSOR_DOMAIN_EVENT_PAYLOAD_SCHEMAS_V1["trigger.rejected"],
  ),
  "trigger_process.phase_changed": event(
    "trigger_process.phase_changed",
    TRIGGER_PROCESSOR_DOMAIN_EVENT_PAYLOAD_SCHEMAS_V1[
      "trigger_process.phase_changed"
    ],
  ),
  "trigger_process.user_message_retracted": event(
    "trigger_process.user_message_retracted",
    TRIGGER_PROCESSOR_DOMAIN_EVENT_PAYLOAD_SCHEMAS_V1[
      "trigger_process.user_message_retracted"
    ],
  ),
  "trigger_process.system_interrupted": event(
    "trigger_process.system_interrupted",
    TRIGGER_PROCESSOR_DOMAIN_EVENT_PAYLOAD_SCHEMAS_V1[
      "trigger_process.system_interrupted"
    ],
  ),
  "cooldown.expired": event(
    "cooldown.expired",
    TRIGGER_PROCESSOR_DOMAIN_EVENT_PAYLOAD_SCHEMAS_V1["cooldown.expired"],
  ),
  "weak_trigger.merged": event(
    "weak_trigger.merged",
    TRIGGER_PROCESSOR_DOMAIN_EVENT_PAYLOAD_SCHEMAS_V1["weak_trigger.merged"],
  ),
  "trigger_process.outcome_finalized": event(
    "trigger_process.outcome_finalized",
    TRIGGER_PROCESSOR_DOMAIN_EVENT_PAYLOAD_SCHEMAS_V1[
      "trigger_process.outcome_finalized"
    ],
  ),
} as const);

export const TriggerProcessorDomainEventV1Schema = Type.Union(
  [
    TRIGGER_PROCESSOR_DOMAIN_EVENT_BRANCH_SCHEMAS_V1["trigger.accepted"],
    TRIGGER_PROCESSOR_DOMAIN_EVENT_BRANCH_SCHEMAS_V1["trigger.rejected"],
    TRIGGER_PROCESSOR_DOMAIN_EVENT_BRANCH_SCHEMAS_V1[
      "trigger_process.phase_changed"
    ],
    TRIGGER_PROCESSOR_DOMAIN_EVENT_BRANCH_SCHEMAS_V1[
      "trigger_process.user_message_retracted"
    ],
    TRIGGER_PROCESSOR_DOMAIN_EVENT_BRANCH_SCHEMAS_V1[
      "trigger_process.system_interrupted"
    ],
    TRIGGER_PROCESSOR_DOMAIN_EVENT_BRANCH_SCHEMAS_V1["cooldown.expired"],
    TRIGGER_PROCESSOR_DOMAIN_EVENT_BRANCH_SCHEMAS_V1["weak_trigger.merged"],
    TRIGGER_PROCESSOR_DOMAIN_EVENT_BRANCH_SCHEMAS_V1[
      "trigger_process.outcome_finalized"
    ],
  ],
  {
    $id: "urn:pai:trigger-processor:domain-event:v1",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    unevaluatedProperties: false,
  },
);

export type TriggerProcessorDomainEventV1 = Static<
  typeof TriggerProcessorDomainEventV1Schema
>;

const KNOWN_META_REASON_TERMINAL_OUTCOMES_V1 = Object.freeze({
  cooldown_expired: Object.freeze([
    "executed",
    "deferred_then_executed",
    "failed_with_reason",
  ]),
  user_retracted: Object.freeze(["cancelled_with_reason"]),
  system_interrupted: Object.freeze(["interrupted_with_reason"]),
  failed_with_learnable_snapshot: Object.freeze(["failed_with_reason"]),
} as const satisfies Readonly<Record<string, readonly TerminalOutcomeV1[]>>);

function parseCanonicalTimestampMs(value: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("TriggerProcessorDomainEventV1 semantic binding mismatch");
  }
  return parsed;
}

function samePhaseAndStatus(
  left: TriggerProcessStateV1,
  right: TriggerProcessStateV1,
): boolean {
  return left.phase === right.phase && left.status === right.status;
}

function assertKnownReasonOutcomeBinding(
  canonicalReasonCode: string,
  terminalOutcome: TerminalOutcomeV1,
): void {
  const allowed =
    KNOWN_META_REASON_TERMINAL_OUTCOMES_V1[
      canonicalReasonCode as keyof typeof KNOWN_META_REASON_TERMINAL_OUTCOMES_V1
    ];
  if (
    allowed !== undefined &&
    !(allowed as readonly TerminalOutcomeV1[]).includes(terminalOutcome)
  ) {
    throw new Error("TriggerProcessorDomainEventV1 semantic binding mismatch");
  }
}

export function assertTriggerProcessorDomainEventSemanticBindingsV1(
  event: TriggerProcessorDomainEventV1,
): void {
  switch (event.event_type) {
    case "trigger_process.phase_changed":
      if (
        samePhaseAndStatus(
          event.payload.previous_state,
          event.payload.next_state,
        )
      ) {
        throw new Error("TriggerProcessorDomainEventV1 semantic binding mismatch");
      }
      return;
    case "cooldown.expired":
      if (
        parseCanonicalTimestampMs(event.payload.expired_at) <
        parseCanonicalTimestampMs(event.payload.cooldown_until)
      ) {
        throw new Error("TriggerProcessorDomainEventV1 semantic binding mismatch");
      }
      return;
    case "weak_trigger.merged": {
      const merged = event.payload.merged_process_ids;
      const uniqueMerged = new Set(merged);
      if (
        uniqueMerged.size !== merged.length ||
        uniqueMerged.has(event.payload.canonical_process_id)
      ) {
        throw new Error("TriggerProcessorDomainEventV1 semantic binding mismatch");
      }
      return;
    }
    case "trigger_process.outcome_finalized":
      assertKnownReasonOutcomeBinding(
        event.payload.canonical_reason_code,
        event.payload.terminal_outcome,
      );
      return;
    case "trigger.accepted":
    case "trigger.rejected":
    case "trigger_process.user_message_retracted":
    case "trigger_process.system_interrupted":
      return;
  }
}

const quotedEventTypes = TRIGGER_PROCESSOR_DOMAIN_EVENT_TYPES_V1.map(
  (eventType) => `'${eventType}'`,
).join(", ");

export const TRIGGER_PROCESSOR_DOMAIN_EVENT_V1_DATABASE_CHECK = [
  "alter table trigger_processor.trigger_event_outbox",
  "  drop constraint if exists trigger_event_outbox_event_schema_pair_check,",
  "  drop constraint if exists trigger_event_outbox_payload_domain_event_v1_check,",
  "  drop constraint if exists trigger_event_outbox_schema_version_check,",
  "  drop constraint if exists trigger_event_outbox_domain_event_v1_check,",
  "  add constraint trigger_event_outbox_schema_version_check",
  "  check (schema_version = 'trigger_processor_event.v1'),",
  "  add constraint trigger_event_outbox_domain_event_v1_check",
  "  check (",
  "    producer = 'trigger_processor'",
  "    and schema_version = 'trigger_processor_event.v1'",
  `    and event_type in (${quotedEventTypes})`,
  "  );",
].join("\n");
