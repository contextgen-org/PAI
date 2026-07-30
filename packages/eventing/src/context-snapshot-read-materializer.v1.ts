import { createHash } from "node:crypto";

import {
  ContextSnapshotReadContractV1Schema,
  ContextSnapshotV1Schema,
  assertContextSnapshotReadBindingsV1,
  assertContextSnapshotSemanticBindingsV1,
  type ContextSnapshotReadContractV1,
  type ContextSnapshotResolveRequestV1,
  type ContextSnapshotV1,
} from "@pai/contracts";
import { Value } from "@sinclair/typebox/value";

import { canonicalJsonV1 } from "./canonical-json.v1.js";

const BASE64_PATTERN =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;

function sha256Bytes(value: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function decodeCanonicalBase64(value: string): Uint8Array {
  if (
    value.length === 0 ||
    value.length % 4 !== 0 ||
    !BASE64_PATTERN.test(value)
  ) {
    throw new Error("Context snapshot chunk is not canonical base64");
  }
  const decoded = Buffer.from(value, "base64");
  if (decoded.toString("base64") !== value) {
    throw new Error("Context snapshot chunk is not canonical base64");
  }
  return decoded;
}

function materializeChunkedBytes(
  response: Extract<
    ContextSnapshotReadContractV1,
    { readonly delivery_mode: "chunked" }
  >,
): Uint8Array {
  const chunks = [...response.chunks].sort(
    (left, right) => left.ordinal - right.ordinal,
  );
  const decoded: Uint8Array[] = [];
  let expectedOffset = 0;
  for (const [index, chunk] of chunks.entries()) {
    if (
      chunk.ordinal !== index ||
      chunk.byte_offset !== expectedOffset
    ) {
      throw new Error("Context snapshot chunks are not contiguous");
    }
    const bytes = decodeCanonicalBase64(chunk.canonical_bytes_base64);
    if (
      bytes.byteLength !== chunk.byte_length ||
      sha256Bytes(bytes) !== chunk.chunk_sha256
    ) {
      throw new Error("Context snapshot chunk integrity mismatch");
    }
    expectedOffset += bytes.byteLength;
    if (expectedOffset > 16_777_216) {
      throw new Error("Context snapshot chunks exceed the bounded size");
    }
    decoded.push(bytes);
  }
  return Buffer.concat(decoded.map((chunk) => Buffer.from(chunk)));
}

function logicalSnapshotHash(
  snapshot: ContextSnapshotV1,
): `sha256:${string}` {
  const value = Object.fromEntries(
    Object.entries(snapshot).filter(([key]) => key !== "snapshot_hash"),
  );
  return `sha256:${createHash("sha256")
    .update(canonicalJsonV1(value), "utf8")
    .digest("hex")}`;
}

function deepFreezeParsedJsonV1<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  if (Array.isArray(value)) {
    for (const entry of value) deepFreezeParsedJsonV1(entry);
  } else {
    for (const entry of Object.values(value)) deepFreezeParsedJsonV1(entry);
  }
  return Object.freeze(value);
}

/**
 * Materializes and verifies the TP-owned ContextSnapshot read wire.
 *
 * This is a consumer-side verifier. It verifies both the physical canonical
 * bytes and the ContextSnapshot logical hash; neither digest substitutes for
 * the other.
 */
export function materializeContextSnapshotReadV1(
  request: ContextSnapshotResolveRequestV1,
  responseValue: unknown,
  options: Readonly<{ now?: () => Date }> = {},
): ContextSnapshotV1 {
  canonicalJsonV1(request);
  canonicalJsonV1(responseValue);
  if (!Value.Check(ContextSnapshotReadContractV1Schema, responseValue)) {
    throw new Error("Context snapshot read schema is incompatible");
  }
  const response = responseValue as ContextSnapshotReadContractV1;
  assertContextSnapshotReadBindingsV1(request, response);

  const now = options.now ?? (() => new Date());
  if (
    !Number.isFinite(Date.parse(response.retention_until)) ||
    Date.parse(response.retention_until) <= now().getTime()
  ) {
    throw new Error("Context snapshot read is expired");
  }

  const bytes =
    response.delivery_mode === "inline"
      ? Buffer.from(canonicalJsonV1(response.context_snapshot), "utf8")
      : materializeChunkedBytes(response);
  if (
    bytes.byteLength !== response.content_length_bytes ||
    sha256Bytes(bytes) !== response.canonical_bytes_sha256
  ) {
    throw new Error("Context snapshot canonical bytes integrity mismatch");
  }

  let snapshotValue: unknown;
  try {
    snapshotValue = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
  } catch (error) {
    throw new Error("Context snapshot canonical bytes are not valid JSON", {
      cause: error,
    });
  }
  if (
    Buffer.from(canonicalJsonV1(snapshotValue), "utf8").compare(
      Buffer.from(bytes),
    ) !== 0 ||
    !Value.Check(ContextSnapshotV1Schema, snapshotValue)
  ) {
    throw new Error("Context snapshot canonical bytes are schema incompatible");
  }
  const snapshot = snapshotValue as ContextSnapshotV1;
  assertContextSnapshotSemanticBindingsV1(snapshot);
  if (
    snapshot.trigger_process_id !== request.trigger_process_id ||
    snapshot.workspace_id !== request.workspace_id ||
    snapshot.bot_id !== request.bot_id ||
    snapshot.owner_agent_id !== request.owner_agent_id ||
    snapshot.deployment_environment !== request.deployment_environment ||
    snapshot.release_channel !== request.release_channel ||
    snapshot.context_version !== request.context_snapshot_version ||
    snapshot.snapshot_hash !== request.context_snapshot_hash ||
    logicalSnapshotHash(snapshot) !== request.context_snapshot_hash
  ) {
    throw new Error("Context snapshot identity or logical hash mismatch");
  }
  return deepFreezeParsedJsonV1(snapshot);
}
