import { Type, type Static } from "@sinclair/typebox";

const RuntimeTokenIdentifierV1Schema = Type.String({
  minLength: 1,
  maxLength: 256,
});

export const RuntimeTokenSseEventV1Schema = Type.Object(
  {
    schema_version: Type.Literal("runtime_token_sse_event.v1"),
    runtime_run_id: RuntimeTokenIdentifierV1Schema,
    trigger_process_id: RuntimeTokenIdentifierV1Schema,
    token: Type.String({ minLength: 1, maxLength: 16_384 }),
    emitted_at: Type.String({ format: "date-time" }),
  },
  {
    $id: "urn:pai:action-runtime:runtime-token-sse-event:v1",
    additionalProperties: false,
  },
);

export type RuntimeTokenSseEventV1 = Static<
  typeof RuntimeTokenSseEventV1Schema
>;

/**
 * This live frame deliberately has no durable identity. Keeping this list in
 * the canonical source lets contract tests reject accidental replay semantics.
 */
export const RUNTIME_TOKEN_SSE_FORBIDDEN_DURABLE_FIELDS_V1 = Object.freeze([
  "event_id",
  "id",
  "idempotency_key",
  "last_event_id",
  "producer",
  "sequence_no",
] as const);
