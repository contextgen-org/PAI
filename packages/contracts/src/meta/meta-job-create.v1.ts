import { Type, type Static } from "@sinclair/typebox";

import { DEPLOYMENT_ENVIRONMENTS } from "../shared/deployment-environment.v1.js";
import { RELEASE_CHANNELS } from "../shared/release-channel.v1.js";
import {
  TriggerProcessorIdentifierV1Schema,
  TriggerProcessorPositiveVersionV1Schema,
  TriggerProcessorSha256V1Schema,
  TriggerProcessorTimestampV1Schema,
} from "../trigger-processor/index-internal.v1.js";

// These value schemas deliberately omit `$id`: the create request is a
// discriminated union, so embedding the catalog-owned shared schemas in every
// branch would register the same `$id` multiple times in Fastify/Ajv.
const deploymentEnvironmentValueV1Schema = Type.Union(
  DEPLOYMENT_ENVIRONMENTS.map((environment) => Type.Literal(environment)),
);
const releaseChannelValueV1Schema = Type.Union(
  RELEASE_CHANNELS.map((channel) => Type.Literal(channel)),
);

const metaJobCreateBase = {
  schema_version: Type.Literal("meta_job_create.v1"),
  trigger_process_id: TriggerProcessorIdentifierV1Schema,
  workspace_id: TriggerProcessorIdentifierV1Schema,
  bot_id: TriggerProcessorIdentifierV1Schema,
  owner_agent_id: TriggerProcessorIdentifierV1Schema,
  deployment_environment: deploymentEnvironmentValueV1Schema,
  release_channel: releaseChannelValueV1Schema,
  snapshot_ref: TriggerProcessorIdentifierV1Schema,
  snapshot_version: TriggerProcessorPositiveVersionV1Schema,
  snapshot_hash: TriggerProcessorSha256V1Schema,
  snapshot_retention_until: TriggerProcessorTimestampV1Schema,
  learnable_snapshot_ready: Type.Literal(true),
  idempotency_key: TriggerProcessorIdentifierV1Schema,
  trace_id: TriggerProcessorIdentifierV1Schema,
} as const;

export const MetaJobCreateRequestV1Schema = Type.Union(
  [
    Type.Object(
      {
        ...metaJobCreateBase,
        cooldown_until: TriggerProcessorTimestampV1Schema,
        enqueue_reason: Type.Literal("cooldown_expired"),
        boundary_system_event_ref: Type.Null(),
      },
      { additionalProperties: false },
    ),
    ...(["user_retracted", "system_interrupted"] as const).map((reason) =>
      Type.Object(
        {
          ...metaJobCreateBase,
          cooldown_until: Type.Null(),
          enqueue_reason: Type.Literal(reason),
          boundary_system_event_ref: TriggerProcessorIdentifierV1Schema,
        },
        { additionalProperties: false },
      ),
    ),
    Type.Object(
      {
        ...metaJobCreateBase,
        cooldown_until: Type.Null(),
        enqueue_reason: Type.Literal("failed_with_learnable_snapshot"),
        boundary_system_event_ref: Type.Null(),
      },
      { additionalProperties: false },
    ),
  ],
  { $id: "urn:pai:meta:meta-job-create-request:v1" },
);

export const MetaJobCreateResponseV1Schema = Type.Object(
  {
    job_id: TriggerProcessorIdentifierV1Schema,
    status: Type.Union([
      Type.Literal("queued"),
      Type.Literal("leased"),
      Type.Literal("running"),
      Type.Literal("retry_wait"),
      Type.Literal("completed"),
      Type.Literal("failed"),
    ]),
    duplicate_replayed: Type.Boolean(),
    created_at: TriggerProcessorTimestampV1Schema,
  },
  { additionalProperties: false },
);

export const MetaJobCreateContractV1Schema = Type.Union(
  [MetaJobCreateRequestV1Schema, MetaJobCreateResponseV1Schema],
  { $id: "urn:pai:meta:meta-job-create:v1" },
);

export type MetaJobCreateRequestV1 = Static<
  typeof MetaJobCreateRequestV1Schema
>;
export type MetaJobCreateResponseV1 = Static<
  typeof MetaJobCreateResponseV1Schema
>;

export function assertMetaJobCreateSemanticBindingsV1(
  request: MetaJobCreateRequestV1,
  nowMs = Date.now(),
): void {
  if (
    request.idempotency_key !== request.trigger_process_id ||
    !Number.isFinite(nowMs) ||
    Date.parse(request.snapshot_retention_until) <= nowMs ||
    (request.enqueue_reason === "cooldown_expired" &&
      (request.cooldown_until === null ||
        Date.parse(request.snapshot_retention_until) <=
          Date.parse(request.cooldown_until)))
  ) {
    throw new Error("MetaJobCreateContractV1 semantic binding mismatch");
  }
}
