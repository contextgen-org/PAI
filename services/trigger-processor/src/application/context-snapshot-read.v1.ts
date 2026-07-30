import { createHash } from "node:crypto";
import { isProxy } from "node:util/types";

import {
  ContextSnapshotReadContractV1Schema,
  ContextSnapshotResolveRequestV1Schema,
  ContextSnapshotV1Schema,
  assertContextSnapshotReadBindingsV1,
  assertContextSnapshotSemanticBindingsV1,
  type ContextSnapshotReadContractV1,
  type ContextSnapshotResolveErrorCodeV1,
  type ContextSnapshotResolvePurposeV1,
  type ContextSnapshotResolveRequestV1,
  type ContextSnapshotV1,
} from "@pai/contracts";
import { canonicalJsonV1 } from "@pai/eventing";
import { ObjectStoreErrorV1 } from "@pai/object-store";
import { Value } from "@sinclair/typebox/value";

import type { ContextSnapshotResolverV1 } from "./context-snapshot-resolver.v1.js";

export interface ContextSnapshotReadPrincipalV1 {
  readonly service_id:
    | "trigger_processor"
    | "action_runtime"
    | "observation_gateway";
  readonly aud: "trigger_processor";
  readonly capability: readonly string[];
  readonly scope: Readonly<{
    workspace_id: string;
    bot_id: string;
    owner_agent_id: string;
    deployment_environment: "local" | "dev" | "staging" | "prod";
    release_channel: "stable" | "canary";
  }>;
}

export class ContextSnapshotResolveErrorV1 extends Error {
  public constructor(
    public readonly code: ContextSnapshotResolveErrorCodeV1,
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = "ContextSnapshotResolveErrorV1";
  }
}

export interface ContextSnapshotReadApplicationV1 {
  resolve(
    principal: ContextSnapshotReadPrincipalV1,
    request: unknown,
  ): Promise<ContextSnapshotReadContractV1>;
}

const CALLER_BY_PURPOSE = Object.freeze({
  intent_synthesis: "trigger_processor",
  runtime_start: "action_runtime",
  audit_replay: "observation_gateway",
} satisfies Readonly<Record<ContextSnapshotResolvePurposeV1, string>>);

const CONTEXT_SNAPSHOT_INLINE_MAX_BYTES_V1 = 65_536;
const CONTEXT_SNAPSHOT_CHUNK_BYTES_V1 = 65_536;
const CONTEXT_SNAPSHOT_MAX_BYTES_V1 = 16_777_216;
const OWNER_READ_FIELDS_V1 = Object.freeze([
  "canonical_bytes",
  "canonical_bytes_sha256",
  "content_length_bytes",
  "redaction_state",
  "retention_until",
  "snapshot",
] as const);

type ContextSnapshotOwnerReadV1 = Awaited<
  ReturnType<ContextSnapshotResolverV1["resolveOwnerRead"]>
>;

function captureMethodV1<TMethod>(
  port: unknown,
  methodName: string,
  label: string,
): TMethod {
  if (
    (typeof port !== "object" && typeof port !== "function") ||
    port === null ||
    isProxy(port)
  ) {
    throw new Error(`${label} must be a non-Proxy object`);
  }
  let cursor: object | null = port;
  while (cursor !== null) {
    if (isProxy(cursor)) throw new Error(`${label} must not use Proxy prototypes`);
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(cursor, methodName);
    } catch {
      throw new Error(`${label}.${methodName} cannot be inspected`);
    }
    if (descriptor !== undefined) {
      if (
        !("value" in descriptor) ||
        typeof descriptor.value !== "function" ||
        isProxy(descriptor.value)
      ) {
        throw new Error(`${label}.${methodName} must be a data method`);
      }
      return Reflect.apply(
        Function.prototype.bind,
        descriptor.value,
        [port],
      ) as TMethod;
    }
    try {
      cursor = Object.getPrototypeOf(cursor) as object | null;
    } catch {
      throw new Error(`${label}.${methodName} prototype cannot be inspected`);
    }
  }
  throw new Error(`${label}.${methodName} is required`);
}

function captureClockV1(options: Readonly<{ now?: () => Date }>): () => Date {
  if (
    typeof options !== "object" ||
    options === null ||
    isProxy(options)
  ) {
    throw new Error("context snapshot read options must be a non-Proxy object");
  }
  const descriptor = Object.getOwnPropertyDescriptor(options, "now");
  if (descriptor === undefined) return () => new Date();
  if (
    !("value" in descriptor) ||
    descriptor.value === undefined ||
    typeof descriptor.value !== "function" ||
    isProxy(descriptor.value)
  ) {
    throw new Error("context snapshot read clock must be a data method");
  }
  return descriptor.value as () => Date;
}

function deepFreezeJsonV1<T>(value: T): T {
  if (typeof value !== "object" || value === null) return value;
  const pending: object[] = [value];
  const visited = new WeakSet<object>();
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const entry of Object.values(current)) {
      if (typeof entry === "object" && entry !== null) pending.push(entry);
    }
    Object.freeze(current);
  }
  return value;
}

function canonicalDeepSnapshotV1<T>(
  value: unknown,
  maxBytes?: number,
): T {
  return deepFreezeJsonV1(
    JSON.parse(
      canonicalJsonV1(
        value,
        maxBytes === undefined ? {} : { max_bytes: maxBytes },
      ),
    ) as T,
  );
}

function principalSnapshotV1(value: unknown): ContextSnapshotReadPrincipalV1 {
  let snapshot: unknown;
  try {
    snapshot = canonicalDeepSnapshotV1(value);
  } catch (error) {
    fail("scope_mismatch", error);
  }
  if (
    typeof snapshot !== "object" ||
    snapshot === null ||
    Array.isArray(snapshot) ||
    !Array.isArray((snapshot as Record<string, unknown>).capability) ||
    typeof (snapshot as Record<string, unknown>).scope !== "object" ||
    (snapshot as Record<string, unknown>).scope === null ||
    Array.isArray((snapshot as Record<string, unknown>).scope)
  ) {
    fail("scope_mismatch");
  }
  return snapshot as ContextSnapshotReadPrincipalV1;
}

function copyCanonicalBytesV1(value: unknown): Uint8Array {
  if (typeof value !== "object" || value === null || isProxy(value)) {
    throw new Error("context snapshot canonical bytes must be a Uint8Array");
  }
  const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
  const byteLengthGetter = Object.getOwnPropertyDescriptor(
    typedArrayPrototype,
    "byteLength",
  )?.get;
  const bufferGetter = Object.getOwnPropertyDescriptor(
    typedArrayPrototype,
    "buffer",
  )?.get;
  if (byteLengthGetter === undefined || bufferGetter === undefined) {
    throw new Error("Uint8Array intrinsics are unavailable");
  }
  let byteLength: number;
  let buffer: ArrayBufferLike;
  try {
    byteLength = Reflect.apply(byteLengthGetter, value, []) as number;
    buffer = Reflect.apply(bufferGetter, value, []) as ArrayBufferLike;
  } catch (error) {
    throw new Error("context snapshot canonical bytes are invalid", {
      cause: error,
    });
  }
  if (
    !Number.isSafeInteger(byteLength) ||
    byteLength < 1 ||
    byteLength > CONTEXT_SNAPSHOT_MAX_BYTES_V1 ||
    (typeof SharedArrayBuffer !== "undefined" &&
      buffer instanceof SharedArrayBuffer)
  ) {
    throw new Error("context snapshot canonical bytes are not bounded");
  }
  const copy = new Uint8Array(byteLength);
  try {
    Reflect.apply(Uint8Array.prototype.set, copy, [value as Uint8Array]);
  } catch (error) {
    throw new Error("context snapshot canonical bytes cannot be copied", {
      cause: error,
    });
  }
  return copy;
}

function snapshotOwnerReadV1(value: unknown): ContextSnapshotOwnerReadV1 {
  if (
    typeof value !== "object" ||
    value === null ||
    isProxy(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  ) {
    throw new Error("context snapshot owner read must be a plain object");
  }
  let descriptors: PropertyDescriptorMap;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch (error) {
    throw new Error("context snapshot owner read cannot be inspected", {
      cause: error,
    });
  }
  const names = Reflect.ownKeys(descriptors);
  if (
    names.some((name) => typeof name !== "string") ||
    names.length !== OWNER_READ_FIELDS_V1.length ||
    !OWNER_READ_FIELDS_V1.every((name) => names.includes(name))
  ) {
    throw new Error("context snapshot owner read fields are invalid");
  }
  for (const name of OWNER_READ_FIELDS_V1) {
    const descriptor = descriptors[name];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      throw new Error("context snapshot owner read fields must be data properties");
    }
  }
  const snapshot = canonicalDeepSnapshotV1<ContextSnapshotV1>(
    descriptors.snapshot!.value,
    CONTEXT_SNAPSHOT_MAX_BYTES_V1,
  );
  const canonicalBytes = copyCanonicalBytesV1(
    descriptors.canonical_bytes!.value,
  );
  const canonicalBytesSha256 = descriptors.canonical_bytes_sha256!.value;
  const contentLengthBytes = descriptors.content_length_bytes!.value;
  const retentionUntil = descriptors.retention_until!.value;
  const redactionState = descriptors.redaction_state!.value;
  if (
    typeof canonicalBytesSha256 !== "string" ||
    !/^sha256:[0-9a-f]{64}$/u.test(canonicalBytesSha256) ||
    !Number.isSafeInteger(contentLengthBytes) ||
    (contentLengthBytes as number) < 1 ||
    (contentLengthBytes as number) > CONTEXT_SNAPSHOT_MAX_BYTES_V1 ||
    typeof retentionUntil !== "string" ||
    !Number.isFinite(Date.parse(retentionUntil)) ||
    (redactionState !== "not_required" && redactionState !== "complete")
  ) {
    throw new Error("context snapshot owner read metadata is invalid");
  }
  return Object.freeze({
    snapshot,
    canonical_bytes: canonicalBytes,
    canonical_bytes_sha256: canonicalBytesSha256,
    content_length_bytes: contentLengthBytes,
    retention_until: retentionUntil,
    redaction_state: redactionState,
  }) as ContextSnapshotOwnerReadV1;
}

function sha256Bytes(value: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function logicalHash(snapshot: ContextSnapshotV1): `sha256:${string}` {
  const withoutHash: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(snapshot)) {
    if (key !== "snapshot_hash") withoutHash[key] = value;
  }
  return `sha256:${createHash("sha256")
    .update(canonicalJsonV1(withoutHash), "utf8")
    .digest("hex")}`;
}

function fail(
  code: ContextSnapshotResolveErrorCodeV1,
  cause?: unknown,
): never {
  throw new ContextSnapshotResolveErrorV1(
    code,
    cause === undefined ? undefined : { cause },
  );
}

function scopeMatches(
  principal: ContextSnapshotReadPrincipalV1,
  request: ContextSnapshotResolveRequestV1,
): boolean {
  return (
    principal.scope.workspace_id === request.workspace_id &&
    principal.scope.bot_id === request.bot_id &&
    principal.scope.owner_agent_id === request.owner_agent_id &&
    principal.scope.deployment_environment === request.deployment_environment &&
    principal.scope.release_channel === request.release_channel
  );
}

function mapReadError(error: unknown): never {
  if (error instanceof ContextSnapshotResolveErrorV1) throw error;
  if (error instanceof ObjectStoreErrorV1) {
    if (error.code === "object_not_found") fail("context_not_found");
    if (error.code === "authorization_scope_mismatch") fail("scope_mismatch");
    if (error.code === "integrity_mismatch") fail("hash_mismatch");
  }
  const message = error instanceof Error ? error.message : "";
  if (/expired|retention/iu.test(message)) fail("expired");
  if (/hash|integrity|size does not match/iu.test(message)) {
    fail("hash_mismatch");
  }
  if (/scope|identity/iu.test(message)) fail("scope_mismatch");
  fail("schema_incompatible");
}

export function createContextSnapshotReadApplicationV1(
  resolver: ContextSnapshotResolverV1,
  options: Readonly<{ now?: () => Date }> = {},
): ContextSnapshotReadApplicationV1 {
  const resolveOwnerRead = captureMethodV1<
    ContextSnapshotResolverV1["resolveOwnerRead"]
  >(resolver, "resolveOwnerRead", "context snapshot resolver");
  const now = captureClockV1(options);

  const readNow = (): Date => {
    let candidate: unknown;
    try {
      candidate = now();
      if (
        typeof candidate !== "object" ||
        candidate === null ||
        isProxy(candidate) ||
        Object.getPrototypeOf(candidate) !== Date.prototype
      ) {
        fail("schema_incompatible");
      }
      const milliseconds = Reflect.apply(
        Date.prototype.getTime,
        candidate,
        [],
      ) as number;
      if (!Number.isFinite(milliseconds)) fail("schema_incompatible");
      return new Date(milliseconds);
    } catch (error) {
      if (error instanceof ContextSnapshotResolveErrorV1) throw error;
      fail("schema_incompatible", error);
    }
  };

  return Object.freeze({
    async resolve(
      principalValue: ContextSnapshotReadPrincipalV1,
      requestValue: unknown,
    ) {
      let request: ContextSnapshotResolveRequestV1;
      try {
        request =
          canonicalDeepSnapshotV1<ContextSnapshotResolveRequestV1>(
            requestValue,
          );
      } catch (error) {
        fail("schema_incompatible", error);
      }
      if (!Value.Check(ContextSnapshotResolveRequestV1Schema, request)) {
        fail("schema_incompatible");
      }
      const principal = principalSnapshotV1(principalValue);
      if (
        principal.aud !== "trigger_processor" ||
        !principal.capability.includes("trigger.context_snapshot.resolve") ||
        request.consumer_service !== principal.service_id ||
        CALLER_BY_PURPOSE[request.purpose] !== principal.service_id ||
        !scopeMatches(principal, request)
      ) {
        fail("scope_mismatch");
      }
      let rawRead: ContextSnapshotOwnerReadV1;
      try {
        rawRead = await resolveOwnerRead(
          request,
          new AbortController().signal,
        );
      } catch (error) {
        mapReadError(error);
      }
      let read: ContextSnapshotOwnerReadV1;
      try {
        read = snapshotOwnerReadV1(rawRead);
      } catch (error) {
        fail("schema_incompatible", error);
      }
      const resolvedAt = readNow();
      if (Date.parse(read.retention_until) <= resolvedAt.getTime()) {
        fail("expired");
      }
      const canonicalBytes = Buffer.from(read.canonical_bytes);
      if (
        canonicalBytes.byteLength < 1 ||
        canonicalBytes.byteLength > CONTEXT_SNAPSHOT_MAX_BYTES_V1 ||
        read.content_length_bytes !== canonicalBytes.byteLength ||
        read.canonical_bytes_sha256 !== sha256Bytes(canonicalBytes) ||
        Buffer.from(canonicalJsonV1(read.snapshot), "utf8").compare(
          canonicalBytes,
        ) !== 0
      ) {
        fail("hash_mismatch");
      }
      if (!Value.Check(ContextSnapshotV1Schema, read.snapshot)) {
        fail("schema_incompatible");
      }
      try {
        assertContextSnapshotSemanticBindingsV1(read.snapshot);
      } catch (error) {
        fail("schema_incompatible", error);
      }
      if (
        read.snapshot.trigger_process_id !== request.trigger_process_id ||
        read.snapshot.workspace_id !== request.workspace_id ||
        read.snapshot.bot_id !== request.bot_id ||
        read.snapshot.owner_agent_id !== request.owner_agent_id ||
        read.snapshot.deployment_environment !==
          request.deployment_environment ||
        read.snapshot.release_channel !== request.release_channel
      ) {
        fail("scope_mismatch");
      }
      if (
        read.snapshot.context_version !== request.context_snapshot_version ||
        read.snapshot.snapshot_hash !== request.context_snapshot_hash ||
        logicalHash(read.snapshot) !== request.context_snapshot_hash
      ) {
        fail("hash_mismatch");
      }
      const common = {
        schema_version: "context_snapshot_read.v1",
        context_snapshot_ref: request.context_snapshot_ref,
        context_snapshot_version: request.context_snapshot_version,
        context_snapshot_hash: request.context_snapshot_hash,
        canonical_bytes_sha256: read.canonical_bytes_sha256,
        content_length_bytes: read.content_length_bytes,
        retention_until: read.retention_until,
        redaction_state: read.redaction_state,
        resolved_at: resolvedAt.toISOString(),
        trace_id: request.trace_id,
      } as const;
      const responseValue: ContextSnapshotReadContractV1 =
        canonicalBytes.byteLength <= CONTEXT_SNAPSHOT_INLINE_MAX_BYTES_V1
          ? {
              ...common,
              delivery_mode: "inline",
              context_snapshot: read.snapshot,
              chunks: null,
            }
          : {
              ...common,
              delivery_mode: "chunked",
              context_snapshot: null,
              chunks: Array.from(
                  {
                    length: Math.ceil(
                      canonicalBytes.byteLength /
                        CONTEXT_SNAPSHOT_CHUNK_BYTES_V1,
                    ),
                  },
                  (_, ordinal) => {
                    const byteOffset =
                      ordinal * CONTEXT_SNAPSHOT_CHUNK_BYTES_V1;
                    const bytes = canonicalBytes.subarray(
                      byteOffset,
                      Math.min(
                        canonicalBytes.byteLength,
                        byteOffset + CONTEXT_SNAPSHOT_CHUNK_BYTES_V1,
                      ),
                    );
                    return Object.freeze({
                      ordinal,
                      byte_offset: byteOffset,
                      byte_length: bytes.byteLength,
                      canonical_bytes_base64: bytes.toString("base64"),
                      chunk_sha256: sha256Bytes(bytes),
                    });
                  },
              ),
            };
      let response: ContextSnapshotReadContractV1;
      try {
        response =
          canonicalDeepSnapshotV1<ContextSnapshotReadContractV1>(
            responseValue,
          );
      } catch (error) {
        fail("schema_incompatible", error);
      }
      if (!Value.Check(ContextSnapshotReadContractV1Schema, response)) {
        fail("schema_incompatible");
      }
      try {
        assertContextSnapshotReadBindingsV1(request, response);
      } catch {
        fail("hash_mismatch");
      }
      return response;
    },
  });
}
