import { Type, type Static } from "@sinclair/typebox";

import {
  AdmitTriggerAcceptedResponseV1Schema,
  AdmitTriggerOkResponseV1Schema,
} from "./trigger-admission.v1.js";

/**
 * Canonical owner response for successful, business-rejected, and replayed
 * POST /v1/triggers submissions. HTTP errors keep the Shared response envelope
 * and are deliberately not registered as a Trigger Processor owner schema.
 */
export const TriggerSubmitResponseV1Schema = Type.Union(
  [AdmitTriggerAcceptedResponseV1Schema, AdmitTriggerOkResponseV1Schema],
  { $id: "urn:pai:trigger-processor:trigger-submit-response:v1" },
);

export type TriggerSubmitResponseV1 = Static<
  typeof TriggerSubmitResponseV1Schema
>;
