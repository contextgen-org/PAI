import { Type, type Static } from "@sinclair/typebox";

import {
  TriggerProcessorIdentifierV1Schema,
  TriggerProcessorReasonCodeV1Schema,
  TriggerProcessorSha256V1Schema,
} from "./contract-primitives.v1.js";

export {
  TriggerProcessCancelResponseV1Schema,
  type TriggerProcessCancelResponseV1,
} from "./process-cancel-response.v1.js";

export const TriggerProcessCancelRequestV1Schema = Type.Object(
  {
    idempotency_key: TriggerProcessorIdentifierV1Schema,
    reason: TriggerProcessorReasonCodeV1Schema,
  },
  {
    $id: "urn:pai:trigger-processor:process-cancel-request:v1",
    additionalProperties: false,
  },
);

export const TriggerProcessCancelCommandV1Schema = Type.Object(
  {
    schema_version: Type.Literal("trigger_process_cancel_command.v1"),
    trigger_process_id: TriggerProcessorIdentifierV1Schema,
    idempotency_key: TriggerProcessorIdentifierV1Schema,
    normalized_reason: TriggerProcessorReasonCodeV1Schema,
    authenticated_principal_id: TriggerProcessorIdentifierV1Schema,
    authenticated_role: Type.Union([
      Type.Literal("user"),
      Type.Literal("developer"),
      Type.Literal("operator"),
      Type.Literal("super_user"),
    ]),
    request_hash: TriggerProcessorSha256V1Schema,
    trace_id: TriggerProcessorIdentifierV1Schema,
  },
  { additionalProperties: false },
);

export type TriggerProcessCancelRequestV1 = Static<
  typeof TriggerProcessCancelRequestV1Schema
>;
export type TriggerProcessCancelCommandV1 = Static<
  typeof TriggerProcessCancelCommandV1Schema
>;
