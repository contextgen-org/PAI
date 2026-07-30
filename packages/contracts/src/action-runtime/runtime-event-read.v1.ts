import { FormatRegistry, Type, type Static } from "@sinclair/typebox";

import { DeploymentEnvironmentV1Schema } from "../shared/deployment-environment.v1.js";
import { ReleaseChannelV1Schema } from "../shared/release-channel.v1.js";
import { RuntimeDomainEventV1Schema } from "./runtime-events.v1.js";

const IdentifierV1Schema = Type.String({ minLength: 1, maxLength: 256 });
const PayloadRefV1Schema = Type.String({ minLength: 1, maxLength: 512 });
const Sha256DigestV1Schema = Type.String({
  pattern: "^sha256:[0-9a-f]{64}$",
});
const TimestampV1Schema = Type.String({ format: "date-time" });

if (!FormatRegistry.Has("date-time")) {
  FormatRegistry.Set(
    "date-time",
    (value) =>
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.test(
        value,
      ) && Number.isFinite(Date.parse(value)),
  );
}

export const RUNTIME_EVENT_READ_ERROR_CODES_V1 = Object.freeze([
  "event_not_found",
  "event_scope_mismatch",
  "event_hash_mismatch",
  "event_schema_incompatible",
  "event_expired",
  "event_redaction_incomplete",
] as const);

export const RuntimeEventResolveRequestV1Schema = Type.Object(
  {
    schema_version: Type.Literal("runtime_event_resolve_request.v1"),
    source_event_id: IdentifierV1Schema,
    payload_ref: PayloadRefV1Schema,
    runtime_run_id: IdentifierV1Schema,
    trigger_process_id: IdentifierV1Schema,
    source_sequence_no: Type.Integer({
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    expected_payload_hash: Sha256DigestV1Schema,
    workspace_id: IdentifierV1Schema,
    bot_id: IdentifierV1Schema,
    owner_agent_id: IdentifierV1Schema,
    deployment_environment: DeploymentEnvironmentV1Schema,
    release_channel: ReleaseChannelV1Schema,
    purpose: Type.Literal("trigger_snapshot_append"),
    trace_id: IdentifierV1Schema,
  },
  {
    $id: "urn:pai:action-runtime:runtime-event-resolve-request:v1",
    additionalProperties: false,
  },
);

export const RuntimeEventReadContractV1Schema = Type.Object(
  {
    schema_version: Type.Literal("runtime_event_read.v1"),
    source_event_id: IdentifierV1Schema,
    payload_ref: PayloadRefV1Schema,
    payload_hash: Sha256DigestV1Schema,
    runtime_run_id: IdentifierV1Schema,
    trigger_process_id: IdentifierV1Schema,
    source_sequence_no: Type.Integer({
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    workspace_id: IdentifierV1Schema,
    bot_id: IdentifierV1Schema,
    owner_agent_id: IdentifierV1Schema,
    deployment_environment: DeploymentEnvironmentV1Schema,
    release_channel: ReleaseChannelV1Schema,
    purpose: Type.Literal("trigger_snapshot_append"),
    runtime_event: Type.Ref(RuntimeDomainEventV1Schema),
    retention_until: TimestampV1Schema,
    redaction_state: Type.Union([
      Type.Literal("not_required"),
      Type.Literal("complete"),
    ]),
    resolved_at: TimestampV1Schema,
    trace_id: IdentifierV1Schema,
  },
  {
    $id: "urn:pai:action-runtime:runtime-event-read:v1",
    additionalProperties: false,
  },
);

export const RuntimeEventReadErrorV1Schema = Type.Object(
  {
    schema_version: Type.Literal("runtime_event_read_error.v1"),
    code: Type.Union(
      RUNTIME_EVENT_READ_ERROR_CODES_V1.map((code) => Type.Literal(code)),
    ),
    message: Type.String({ minLength: 1, maxLength: 512 }),
    retryable: Type.Literal(false),
    trace_id: IdentifierV1Schema,
    details: Type.Object(
      {
        source_event_id: IdentifierV1Schema,
        payload_ref: PayloadRefV1Schema,
        runtime_run_id: IdentifierV1Schema,
        source_sequence_no: Type.Integer({
          minimum: 1,
          maximum: Number.MAX_SAFE_INTEGER,
        }),
      },
      { additionalProperties: false },
    ),
  },
  {
    $id: "urn:pai:action-runtime:runtime-event-read-error:v1",
    additionalProperties: false,
  },
);

export type RuntimeEventReadErrorCodeV1 =
  (typeof RUNTIME_EVENT_READ_ERROR_CODES_V1)[number];
export type RuntimeEventResolveRequestV1 = Static<
  typeof RuntimeEventResolveRequestV1Schema
>;
export type RuntimeEventReadContractV1 = Static<
  typeof RuntimeEventReadContractV1Schema
>;
export type RuntimeEventReadErrorV1 = Static<
  typeof RuntimeEventReadErrorV1Schema
>;

export function assertRuntimeEventReadBindingsV1(
  request: RuntimeEventResolveRequestV1,
  response: RuntimeEventReadContractV1,
): void {
  const event = response.runtime_event;
  if (
    response.source_event_id !== request.source_event_id ||
    response.payload_ref !== request.payload_ref ||
    response.payload_hash !== request.expected_payload_hash ||
    response.runtime_run_id !== request.runtime_run_id ||
    response.trigger_process_id !== request.trigger_process_id ||
    response.source_sequence_no !== request.source_sequence_no ||
    response.workspace_id !== request.workspace_id ||
    response.bot_id !== request.bot_id ||
    response.owner_agent_id !== request.owner_agent_id ||
    response.deployment_environment !== request.deployment_environment ||
    response.release_channel !== request.release_channel ||
    response.purpose !== request.purpose ||
    response.trace_id !== request.trace_id ||
    response.payload_ref !== `runtime_event:${response.source_event_id}` ||
    event.event_id !== response.source_event_id ||
    event.producer !== "action_runtime" ||
    event.payload.sequence_no !== response.source_sequence_no ||
    event.payload.runtime_run_id !== response.runtime_run_id ||
    event.payload.trigger_process_id !== response.trigger_process_id ||
    event.payload.workspace_id !== response.workspace_id ||
    event.payload.bot_id !== response.bot_id ||
    event.payload.owner_agent_id !== response.owner_agent_id ||
    event.payload.deployment_environment !== response.deployment_environment ||
    event.payload.release_channel !== response.release_channel
  ) {
    throw new Error("Runtime event read identity binding mismatch");
  }
}
