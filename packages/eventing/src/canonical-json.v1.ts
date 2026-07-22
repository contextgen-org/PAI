import { createHash } from "node:crypto";

import {
  ownerDurableEventContractV1,
  type DurableEventEnvelopeV1,
} from "@pai/contracts";

export class CanonicalJsonValidationErrorV1 extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "CanonicalJsonValidationErrorV1";
  }
}

function assertUnicodeScalarString(value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        throw new CanonicalJsonValidationErrorV1(
          "canonical JSON rejects unpaired UTF-16 surrogates",
        );
      }
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      throw new CanonicalJsonValidationErrorV1(
        "canonical JSON rejects unpaired UTF-16 surrogates",
      );
    }
  }
}

function canonicalJsonValueV1(value: unknown, ancestors: Set<object>): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new CanonicalJsonValidationErrorV1(
        "canonical JSON rejects non-finite numbers",
      );
    }
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    assertUnicodeScalarString(value);
    return JSON.stringify(value);
  }
  if (typeof value !== "object") {
    throw new CanonicalJsonValidationErrorV1(
      `canonical JSON rejects ${typeof value} values`,
    );
  }
  if (ancestors.has(value)) {
    throw new CanonicalJsonValidationErrorV1(
      "canonical JSON rejects cyclic values",
    );
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      const entries: string[] = [];
      for (let index = 0; index < value.length; index += 1) {
        if (!(index in value)) {
          throw new CanonicalJsonValidationErrorV1(
            "canonical JSON rejects sparse arrays",
          );
        }
        entries.push(canonicalJsonValueV1(value[index], ancestors));
      }
      return `[${entries.join(",")}]`;
    }
    const prototype = Object.getPrototypeOf(value) as object | null;
    if (prototype !== Object.prototype && prototype !== null) {
      throw new CanonicalJsonValidationErrorV1(
        "canonical JSON accepts only plain JSON objects",
      );
    }
    const symbols = Object.getOwnPropertySymbols(value);
    if (symbols.length > 0) {
      throw new CanonicalJsonValidationErrorV1(
        "canonical JSON rejects symbol properties",
      );
    }
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .sort()
      .map((key) => {
        assertUnicodeScalarString(key);
        return `${JSON.stringify(key)}:${canonicalJsonValueV1(record[key], ancestors)}`;
      });
    return `{${entries.join(",")}}`;
  } finally {
    ancestors.delete(value);
  }
}

/** RFC 8785-compatible canonical JSON for already validated JSON values. */
export function canonicalJsonV1(value: unknown): string {
  return canonicalJsonValueV1(value, new Set());
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

export function canonicalDurableEventEnvelopeSemanticHashV1(
  envelope: DurableEventEnvelopeV1,
): string {
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
      deployment_environment: payload.deployment_environment,
      release_channel: payload.release_channel,
    });
  }
  const contract = ownerDurableEventContractV1(
    envelope.producer,
    envelope.event_type,
  );
  if (contract?.payload_scope === "bot") {
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
