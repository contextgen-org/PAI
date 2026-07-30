import { Type, type Static } from "@sinclair/typebox";

import { TriggerProcessorIdentifierV1Schema } from "./contract-primitives.v1.js";
import { TriggerProcessQueryDetailsV1Schema } from "./process-query.v1.js";

export const TriggerProcessGetResponseV1Schema = Type.Object(
  {
    code: Type.Literal("trigger_process_found"),
    message: Type.String({ minLength: 1, maxLength: 4_096 }),
    retryable: Type.Literal(false),
    trace_id: TriggerProcessorIdentifierV1Schema,
    details: TriggerProcessQueryDetailsV1Schema,
  },
  {
    $id: "urn:pai:trigger-processor:process-get-response:v1",
    additionalProperties: false,
  },
);

export type TriggerProcessGetResponseV1 = Static<
  typeof TriggerProcessGetResponseV1Schema
>;
