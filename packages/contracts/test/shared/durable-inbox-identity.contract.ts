import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  DurableInboxIdentityV1Schema,
  assertDurableInboxIdentityV1,
} from "../../src/index.js";

const fingerprint = `sha256:${"a".repeat(64)}`;
const identity = {
  source: "trigger_processor",
  event_id: "event-1",
  idempotency_key: "business-key-1",
  payload_hash: fingerprint,
  semantic_hash: fingerprint,
  scope_fingerprint: fingerprint,
} as const;

describe("DurableInboxIdentityV1", () => {
  it("owns the exact source and event delivery identity with four replay fingerprints", () => {
    expect(DurableInboxIdentityV1Schema.$id).toBe(
      "urn:pai:shared:durable-inbox-identity:v1",
    );
    expect(Value.Check(DurableInboxIdentityV1Schema, identity)).toBe(true);
    expect(() => assertDurableInboxIdentityV1(identity)).not.toThrow();
  });

  it.each([
    { ...identity, source: "unknown_service" },
    { ...identity, event_id: "" },
    { ...identity, idempotency_key: "" },
    { ...identity, payload_hash: "caller-reported" },
    { ...identity, semantic_hash: `sha256:${"A".repeat(64)}` },
    { ...identity, scope_fingerprint: `${fingerprint}00` },
    { ...identity, extra: true },
  ])("rejects identity or fingerprint drift", (candidate) => {
    expect(Value.Check(DurableInboxIdentityV1Schema, candidate)).toBe(false);
    expect(() => assertDurableInboxIdentityV1(candidate)).toThrow(
      /DurableInboxIdentityV1/u,
    );
  });
});
