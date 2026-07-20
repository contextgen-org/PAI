import { Type, type Static } from "@sinclair/typebox";

export const ResponseEnvelopeV1Schema = Type.Object(
  {
    code: Type.String({ minLength: 1 }),
    message: Type.String({ minLength: 1 }),
    retryable: Type.Boolean(),
    details: Type.Unknown(),
    trace_id: Type.String({ minLength: 1 }),
  },
  {
    $id: "urn:pai:shared:response-envelope:v1",
    additionalProperties: false,
  },
);

export type ResponseEnvelopeV1 = Static<typeof ResponseEnvelopeV1Schema>;
