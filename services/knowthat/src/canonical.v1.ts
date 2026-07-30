import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import {
  CanonicalJsonViolationV1,
  canonicalJsonV1 as sharedCanonicalJsonV1,
} from "@pai/contracts";

const KNOWTHAT_CANONICAL_MAX_DEPTH_V1 = 64;
const KNOWTHAT_CANONICAL_MAX_NODES_V1 = 100_000;
const KNOWTHAT_CANONICAL_MAX_BYTES_V1 = 2 * 1_024 * 1_024;

function canonicalFailureV1(message: string): never {
  throw new Error(`invalid canonical value: ${message}`);
}

export function canonicalJsonV1(value: unknown): string {
  try {
    return sharedCanonicalJsonV1(value, {
      max_bytes: KNOWTHAT_CANONICAL_MAX_BYTES_V1,
      max_depth: KNOWTHAT_CANONICAL_MAX_DEPTH_V1,
      max_nodes: KNOWTHAT_CANONICAL_MAX_NODES_V1,
      max_container_entries: KNOWTHAT_CANONICAL_MAX_NODES_V1,
    });
  } catch (error) {
    if (error instanceof CanonicalJsonViolationV1) {
      canonicalFailureV1(error.reason);
    }
    throw error;
  }
}

export function deepFreezeJsonV1<T>(value: T): T {
  const visited = new WeakSet<object>();
  const freeze = (entry: unknown): unknown => {
    if (typeof entry !== "object" || entry === null) return entry;
    if (visited.has(entry)) return entry;
    visited.add(entry);
    if (Array.isArray(entry)) {
      for (let index = 0; index < entry.length; index += 1) {
        entry[index] = freeze(entry[index]);
      }
      return Object.freeze(entry);
    }
    const record = entry as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      record[key] = freeze(record[key]);
    }
    return Object.freeze(entry);
  };
  return freeze(value) as T;
}

export function snapshotCanonicalJsonV1<T>(value: T): T {
  return deepFreezeJsonV1(
    JSON.parse(canonicalJsonV1(value)) as unknown,
  ) as T;
}

export function canonicalHashV1(value: unknown): `sha256:${string}` {
  return `sha256:${createHash("sha256")
    .update(canonicalJsonV1(value), "utf8")
    .digest("hex")}`;
}

export function deterministicIdV1(prefix: string, value: unknown): string {
  return `${prefix}_${createHash("sha256")
    .update(canonicalJsonV1(value), "utf8")
    .digest("hex")
    .slice(0, 32)}`;
}

export function normalizeSemanticSegmentV1(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[\s_-]+/gu, "_")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

export function semanticIdentityV1(input: Readonly<{
  bot_id: string;
  category: string;
  subject: string;
  predicate: string;
  object: string;
}>): Readonly<{
  semantic_key: string;
  semantic_key_display: string;
  normalized_subject: string;
  normalized_predicate: string;
  normalized_object: string;
  object_hash: `sha256:${string}`;
}> {
  const normalizedSubject = normalizeSemanticSegmentV1(input.subject);
  const normalizedPredicate = normalizeSemanticSegmentV1(input.predicate);
  const normalizedObject = normalizeSemanticSegmentV1(input.object);
  if (
    normalizedSubject.length === 0 ||
    normalizedPredicate.length === 0 ||
    normalizedObject.length === 0
  ) {
    throw new Error("semantic component normalized to empty");
  }
  const components = [
    input.bot_id,
    input.category,
    normalizedSubject,
    normalizedPredicate,
  ];
  const digest = createHash("sha256")
    .update(canonicalJsonV1(components), "utf8")
    .digest("base64url");
  return Object.freeze({
    semantic_key: `sk_v1_${digest}`,
    semantic_key_display: `${input.bot_id}:${input.category}:${normalizedSubject}:${normalizedPredicate}`,
    normalized_subject: normalizedSubject,
    normalized_predicate: normalizedPredicate,
    normalized_object: normalizedObject,
    object_hash: canonicalHashV1(normalizedObject),
  });
}

export function signOpaqueV1(
  kind: string,
  payload: Readonly<Record<string, unknown>>,
  secret: string,
): string {
  const body = Buffer.from(
    canonicalJsonV1({ ...payload, kind, version: 1 }),
    "utf8",
  ).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(body, "utf8")
    .digest("base64url");
  return `${body}.${signature}`;
}

export function verifyOpaqueV1(
  token: string,
  kind: string,
  secret: string,
): Readonly<Record<string, unknown>> {
  const [body, signature, extra] = token.split(".");
  if (
    body === undefined ||
    signature === undefined ||
    extra !== undefined ||
    body.length === 0 ||
    signature.length === 0
  ) {
    throw new Error("opaque token shape is invalid");
  }
  const expected = createHmac("sha256", secret)
    .update(body, "utf8")
    .digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(signature, "base64url");
  } catch {
    throw new Error("opaque token signature is invalid");
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new Error("opaque token signature is invalid");
  }
  const decoded = JSON.parse(
    Buffer.from(body, "base64url").toString("utf8"),
  ) as unknown;
  if (
    typeof decoded !== "object" ||
    decoded === null ||
    Array.isArray(decoded) ||
    (decoded as Record<string, unknown>).kind !== kind ||
    (decoded as Record<string, unknown>).version !== 1
  ) {
    throw new Error("opaque token payload is invalid");
  }
  return deepFreezeJsonV1(decoded as Record<string, unknown>);
}
