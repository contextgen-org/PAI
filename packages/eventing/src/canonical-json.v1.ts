import { createHash } from "node:crypto";

import {
  CanonicalJsonViolationV1,
  canonicalJsonV1 as sharedCanonicalJsonV1,
  ownerDurableEventContractV1,
  type CanonicalJsonBoundsV1,
  type CanonicalJsonViolationReasonV1,
  type DurableEventEnvelopeV1,
} from "@pai/contracts";

export type { CanonicalJsonBoundsV1 } from "@pai/contracts";

/**
 * Compatibility error for Eventing callers. Canonical validation and encoding
 * are owned by @pai/contracts; Eventing only maps the shared failure type.
 */
export class CanonicalJsonValidationErrorV1 extends CanonicalJsonViolationV1 {
  public constructor(
    message: string,
    reason: CanonicalJsonViolationReasonV1 = "invalid_value",
  ) {
    super(reason, message);
    this.name = "CanonicalJsonValidationErrorV1";
  }
}

/** Delegates to the single Shared Architecture Contracts implementation. */
export function canonicalJsonV1(
  value: unknown,
  options: CanonicalJsonBoundsV1 = {},
): string {
  try {
    return sharedCanonicalJsonV1(value, options);
  } catch (error) {
    if (error instanceof CanonicalJsonViolationV1) {
      throw new CanonicalJsonValidationErrorV1(
        error.message,
        error.reason,
      );
    }
    throw error;
  }
}

export function canonicalPayloadHashV1(payload: unknown): string {
  return `sha256:${createHash("sha256")
    .update(canonicalJsonV1(payload), "utf8")
    .digest("hex")}`;
}

function sha256Canonical(value: unknown): string {
  return `sha256:${createHash("sha256")
    .update(canonicalJsonV1(value), "utf8")
    .digest("hex")}`;
}

/**
 * Hashes the complete canonical durable envelope received by an inbox.
 *
 * This is intentionally distinct from `canonicalPayloadHashV1`, which remains
 * the outbox/transport payload-only hash. Inbox `payload_hash` binds every
 * envelope byte represented by the owner contract, including occurred_at and
 * trace_id, so a replay cannot silently rewrite transport provenance.
 */
export function canonicalDurableEventEnvelopePayloadHashV1(
  envelope: DurableEventEnvelopeV1,
): string {
  return sha256Canonical(envelope);
}

export function canonicalDurableEventEnvelopeSemanticHashV1(
  envelope: DurableEventEnvelopeV1,
): string {
  canonicalJsonV1(envelope);
  return sha256Canonical({
    producer: envelope.producer,
    event_type: envelope.event_type,
    schema_version: envelope.schema_version,
    payload: envelope.payload,
  });
}

export function durableEventScopeFingerprintV1(
  envelope: DurableEventEnvelopeV1,
): string {
  canonicalJsonV1(envelope);
  const payload = envelope.payload as Readonly<Record<string, unknown>>;
  if (payload.scope_kind === "bot") {
    return sha256Canonical({
      scope_kind: "bot",
      workspace_id: payload.workspace_id,
      bot_id: payload.bot_id,
      owner_agent_id: payload.owner_agent_id,
      deployment_environment: payload.deployment_environment,
      release_channel: payload.release_channel,
    });
  }
  if (payload.scope_kind === "global") {
    return sha256Canonical({
      scope_kind: "global",
    });
  }
  if (payload.scope_kind === "scoped") {
    return sha256Canonical({
      scope_kind: "scoped",
      workspace_id: payload.workspace_id,
      bot_id: payload.bot_id,
      deployment_environment: payload.deployment_environment,
      release_channel: payload.release_channel,
    });
  }
  if (payload.scope_kind === "provenance") {
    return sha256Canonical({
      scope_kind: "provenance",
      workspace_id: payload.workspace_id,
      bot_id: payload.bot_id,
      owner_agent_id: payload.owner_agent_id,
      deployment_environment: payload.deployment_environment,
      release_channel: payload.release_channel,
    });
  }
  const contract = ownerDurableEventContractV1(
    envelope.producer,
    envelope.event_type,
  );
  if (contract?.payload_scope === "bot") {
    const completeFiveTuple =
      typeof payload.workspace_id === "string" &&
      typeof payload.bot_id === "string" &&
      typeof payload.owner_agent_id === "string" &&
      typeof payload.deployment_environment === "string" &&
      typeof payload.release_channel === "string";
    if (!completeFiveTuple) {
      throw new CanonicalJsonValidationErrorV1(
        "durable bot event scope requires workspace_id, bot_id, owner_agent_id, deployment_environment, and release_channel",
      );
    }
    return sha256Canonical({
      scope_kind: "bot",
      workspace_id: payload.workspace_id,
      bot_id: payload.bot_id,
      owner_agent_id: payload.owner_agent_id,
      deployment_environment: payload.deployment_environment,
      release_channel: payload.release_channel,
    });
  }
  throw new CanonicalJsonValidationErrorV1(
    "durable event scope fingerprint requires bot or global scope_kind",
  );
}
