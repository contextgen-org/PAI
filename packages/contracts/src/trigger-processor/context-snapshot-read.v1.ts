import { Type, type Static } from "@sinclair/typebox";

import { DeploymentEnvironmentV1Schema } from "../shared/deployment-environment.v1.js";
import { ReleaseChannelV1Schema } from "../shared/release-channel.v1.js";
import { ContextSnapshotV1Schema } from "./context-compose.v1.js";
import {
  TriggerProcessorPositiveVersionV1Schema,
  TriggerProcessorSha256V1Schema,
} from "./contract-primitives.v1.js";

const ContextSnapshotIdentityV1Schema = Type.String({
  minLength: 1,
  maxLength: 256,
});

const ContextSnapshotRefV1Schema = Type.String({
  minLength: 1,
  maxLength: 512,
});

const ContextSnapshotScopeV1Properties = {
  workspace_id: ContextSnapshotIdentityV1Schema,
  bot_id: ContextSnapshotIdentityV1Schema,
  owner_agent_id: ContextSnapshotIdentityV1Schema,
  deployment_environment: DeploymentEnvironmentV1Schema,
  release_channel: ReleaseChannelV1Schema,
} as const;

export const CONTEXT_SNAPSHOT_CONSUMER_SERVICES_V1 = [
  "trigger_processor",
  "action_runtime",
  "observation_gateway",
] as const;

export const CONTEXT_SNAPSHOT_RESOLVE_PURPOSES_V1 = [
  "intent_synthesis",
  "runtime_start",
  "audit_replay",
] as const;

export const CONTEXT_SNAPSHOT_RESOLVE_ERROR_CODES_V1 = [
  "context_not_found",
  "expired",
  "hash_mismatch",
  "scope_mismatch",
  "schema_incompatible",
] as const;

export const ContextSnapshotResolveRequestV1Schema = Type.Object(
  {
    schema_version: Type.Literal("context_snapshot_resolve_request.v1"),
    consumer_service: Type.Union(
      CONTEXT_SNAPSHOT_CONSUMER_SERVICES_V1.map((service) =>
        Type.Literal(service),
      ),
    ),
    trigger_process_id: ContextSnapshotIdentityV1Schema,
    ...ContextSnapshotScopeV1Properties,
    context_snapshot_ref: ContextSnapshotRefV1Schema,
    context_snapshot_version: TriggerProcessorPositiveVersionV1Schema,
    context_snapshot_hash: TriggerProcessorSha256V1Schema,
    purpose: Type.Union(
      CONTEXT_SNAPSHOT_RESOLVE_PURPOSES_V1.map((purpose) =>
        Type.Literal(purpose),
      ),
    ),
    trace_id: ContextSnapshotIdentityV1Schema,
  },
  {
    $id: "urn:pai:trigger-processor:context-snapshot-resolve-request:v1",
    additionalProperties: false,
  },
);

export const ContextSnapshotContentChunkV1Schema = Type.Object(
  {
    ordinal: Type.Integer({ minimum: 0, maximum: 255 }),
    byte_offset: Type.Integer({ minimum: 0, maximum: 16_777_215 }),
    byte_length: Type.Integer({ minimum: 1, maximum: 65_536 }),
    canonical_bytes_base64: Type.String({
      minLength: 4,
      maxLength: 87_384,
    }),
    chunk_sha256: TriggerProcessorSha256V1Schema,
  },
  { additionalProperties: false },
);

const ContextSnapshotReadCommonV1Properties = {
  schema_version: Type.Literal("context_snapshot_read.v1"),
  context_snapshot_ref: ContextSnapshotRefV1Schema,
  context_snapshot_version: TriggerProcessorPositiveVersionV1Schema,
  context_snapshot_hash: TriggerProcessorSha256V1Schema,
  canonical_bytes_sha256: TriggerProcessorSha256V1Schema,
  content_length_bytes: Type.Integer({
    minimum: 1,
    maximum: 16_777_216,
  }),
  retention_until: Type.String({ format: "date-time" }),
  redaction_state: Type.Union([
    Type.Literal("not_required"),
    Type.Literal("complete"),
  ]),
  resolved_at: Type.String({ format: "date-time" }),
  trace_id: ContextSnapshotIdentityV1Schema,
} as const;

export const ContextSnapshotReadContractV1Schema = Type.Union(
  [
    Type.Object(
      {
        ...ContextSnapshotReadCommonV1Properties,
        delivery_mode: Type.Literal("inline"),
        context_snapshot: ContextSnapshotV1Schema,
        chunks: Type.Null(),
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        ...ContextSnapshotReadCommonV1Properties,
        delivery_mode: Type.Literal("chunked"),
        context_snapshot: Type.Null(),
        chunks: Type.Array(ContextSnapshotContentChunkV1Schema, {
          minItems: 1,
          maxItems: 256,
        }),
      },
      { additionalProperties: false },
    ),
  ],
  { $id: "urn:pai:trigger-processor:context-snapshot-read:v1" },
);

export const ContextSnapshotReadErrorV1Schema = Type.Object(
  {
    schema_version: Type.Literal("context_snapshot_read_error.v1"),
    code: Type.Union(
      CONTEXT_SNAPSHOT_RESOLVE_ERROR_CODES_V1.map((code) =>
        Type.Literal(code),
      ),
    ),
    message: Type.String({ minLength: 1, maxLength: 512 }),
    retryable: Type.Literal(false),
    trace_id: ContextSnapshotIdentityV1Schema,
    details: Type.Object(
      {
        trigger_process_id: ContextSnapshotIdentityV1Schema,
        context_snapshot_ref: ContextSnapshotRefV1Schema,
        context_snapshot_version: TriggerProcessorPositiveVersionV1Schema,
      },
      { additionalProperties: false },
    ),
  },
  {
    $id: "urn:pai:trigger-processor:context-snapshot-read-error:v1",
    additionalProperties: false,
  },
);

export type ContextSnapshotConsumerServiceV1 =
  (typeof CONTEXT_SNAPSHOT_CONSUMER_SERVICES_V1)[number];
export type ContextSnapshotResolvePurposeV1 =
  (typeof CONTEXT_SNAPSHOT_RESOLVE_PURPOSES_V1)[number];
export type ContextSnapshotResolveErrorCodeV1 =
  (typeof CONTEXT_SNAPSHOT_RESOLVE_ERROR_CODES_V1)[number];
export type ContextSnapshotResolveRequestV1 = Static<
  typeof ContextSnapshotResolveRequestV1Schema
>;
export type ContextSnapshotReadContractV1 = Static<
  typeof ContextSnapshotReadContractV1Schema
>;
export type ContextSnapshotContentChunkV1 = Static<
  typeof ContextSnapshotContentChunkV1Schema
>;
export type ContextSnapshotReadErrorV1 = Static<
  typeof ContextSnapshotReadErrorV1Schema
>;

export function assertContextSnapshotReadBindingsV1(
  request: ContextSnapshotResolveRequestV1,
  response: ContextSnapshotReadContractV1,
): void {
  if (
    response.context_snapshot_ref !== request.context_snapshot_ref ||
    response.context_snapshot_version !== request.context_snapshot_version ||
    response.context_snapshot_hash !== request.context_snapshot_hash ||
    response.trace_id !== request.trace_id
  ) {
    throw new Error("Context snapshot read identity binding mismatch");
  }
  if (response.delivery_mode === "chunked") return;
  const snapshot = response.context_snapshot;
  if (
    snapshot.trigger_process_id !== request.trigger_process_id ||
    snapshot.workspace_id !== request.workspace_id ||
    snapshot.bot_id !== request.bot_id ||
    snapshot.owner_agent_id !== request.owner_agent_id ||
    snapshot.deployment_environment !== request.deployment_environment ||
    snapshot.release_channel !== request.release_channel ||
    snapshot.context_version !== request.context_snapshot_version ||
    snapshot.snapshot_hash !== request.context_snapshot_hash
  ) {
    throw new Error("Context snapshot read identity binding mismatch");
  }
}
