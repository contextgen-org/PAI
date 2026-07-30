import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import { ServiceIdV1Schema } from "./service-id.v1.js";

const opaqueDeliveryIdentifier = Type.String({ minLength: 1, maxLength: 256 });
const opaqueIdempotencyKey = Type.String({ minLength: 1, maxLength: 512 });
const sha256Fingerprint = Type.String({
  pattern: "^sha256:[0-9a-f]{64}$",
});

/**
 * Canonical identity presented to every transactional durable inbox writer.
 *
 * `(source,event_id)` is the delivery identity. The remaining four values are
 * immutable replay fingerprints: `payload_hash` binds the original complete
 * canonical envelope bytes (including occurred_at and trace_id);
 * `semantic_hash` binds normalized business semantics after removing
 * transport-only provenance. The explicit business-idempotency and scope
 * fingerprints remain independently comparable. An exact duplicate must match
 * all four; any drift is durably isolated.
 */
export const DurableInboxIdentityV1Schema = Type.Object(
  {
    source: ServiceIdV1Schema,
    event_id: opaqueDeliveryIdentifier,
    idempotency_key: opaqueIdempotencyKey,
    payload_hash: sha256Fingerprint,
    semantic_hash: sha256Fingerprint,
    scope_fingerprint: sha256Fingerprint,
  },
  {
    $id: "urn:pai:shared:durable-inbox-identity:v1",
    additionalProperties: false,
  },
);

export type DurableInboxIdentityV1 = Static<
  typeof DurableInboxIdentityV1Schema
>;

export function assertDurableInboxIdentityV1(
  value: unknown,
): asserts value is DurableInboxIdentityV1 {
  if (!Value.Check(DurableInboxIdentityV1Schema, value)) {
    throw new Error("invalid DurableInboxIdentityV1");
  }
}
