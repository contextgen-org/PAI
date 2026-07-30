import { Type, type Static } from "@sinclair/typebox";

import {
  TriggerProcessorIdentifierV1Schema,
} from "../trigger-processor/index-internal.v1.js";

/**
 * JSON-only arguments admitted by the runtime tool bridge.
 *
 * Tool-specific schemas still provide the semantic and property-level
 * validation. This owner schema closes the hashing boundary so non-JSON
 * JavaScript values cannot enter the RFC 8785 request identity.
 */
export const RuntimeToolArgumentValueV1Schema = Type.Recursive((This) =>
  Type.Union([
    Type.Null(),
    Type.Boolean(),
    Type.Number(),
    Type.String({ maxLength: 1_048_576 }),
    Type.Array(This, { maxItems: 10_000 }),
    Type.Record(
      Type.String({ minLength: 1, maxLength: 256 }),
      This,
      { maxProperties: 10_000 },
    ),
  ]),
);

export const RuntimeToolNormalizedArgumentsV1Schema = Type.Record(
  Type.String({ minLength: 1, maxLength: 256 }),
  RuntimeToolArgumentValueV1Schema,
  { maxProperties: 10_000 },
);

export const RuntimeToolInvocationRequestV1Schema = Type.Object(
  {
    schema_version: Type.Literal("runtime_tool_invocation_request.v1"),
    runtime_run_id: TriggerProcessorIdentifierV1Schema,
    adapter_tool_call_id: TriggerProcessorIdentifierV1Schema,
    tool_name: TriggerProcessorIdentifierV1Schema,
    normalized_args: RuntimeToolNormalizedArgumentsV1Schema,
  },
  {
    $id: "urn:pai:action-runtime:runtime-tool-invocation-request:v1",
    additionalProperties: false,
  },
);

export type RuntimeToolArgumentValueV1 = Static<
  typeof RuntimeToolArgumentValueV1Schema
>;
export type RuntimeToolNormalizedArgumentsV1 = Static<
  typeof RuntimeToolNormalizedArgumentsV1Schema
>;
export type RuntimeToolInvocationRequestV1 = Static<
  typeof RuntimeToolInvocationRequestV1Schema
>;
