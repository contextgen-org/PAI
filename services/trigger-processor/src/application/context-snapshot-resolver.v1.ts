import { createHash } from "node:crypto";
import { isProxy } from "node:util/types";

import {
  ContextSnapshotV1Schema,
  assertContextSnapshotSemanticBindingsV1,
  type ContextSnapshotResolveRequestV1 as ContextSnapshotOwnerResolveRequestV1,
  type ContextSnapshotV1,
} from "@pai/contracts";
import { canonicalJsonV1 } from "@pai/eventing";
import type { ObjectRefV1, ObjectStorePortV1 } from "@pai/object-store";
import { Value } from "@sinclair/typebox/value";

export interface ContextSnapshotResolveRequestV1 {
  readonly trigger_process_id: string;
  readonly workspace_id: string;
  readonly bot_id: string;
  readonly owner_agent_id: string;
  readonly deployment_environment: "local" | "dev" | "staging" | "prod";
  readonly release_channel: "stable" | "canary";
  readonly context_snapshot_ref: string;
  readonly context_snapshot_version: number;
  readonly context_snapshot_hash: string;
  readonly purpose: "intent_synthesis" | "runtime_start" | "audit_replay";
}

export interface ContextSnapshotResolverV1 {
  resolve(
    request: ContextSnapshotResolveRequestV1,
    signal: AbortSignal,
  ): Promise<ContextSnapshotV1>;
  resolveOwnerRead(
    request: ContextSnapshotOwnerResolveRequestV1,
    signal: AbortSignal,
  ): Promise<Readonly<{
    snapshot: ContextSnapshotV1;
    canonical_bytes: Uint8Array;
    canonical_bytes_sha256: `sha256:${string}`;
    content_length_bytes: number;
    retention_until: string;
    redaction_state: "not_required" | "complete";
  }>>;
}

export interface ContextSnapshotReadDecisionV1 {
  readonly access_decision_ref: string;
  readonly retention_policy_version: string;
  readonly redaction_policy_version: string;
  readonly redaction_state: "not_required" | "complete";
}

export interface ContextSnapshotCanonicalReferenceRepositoryV1 {
  isCanonicalReference(
    request: ContextSnapshotResolveRequestV1,
  ): Promise<boolean>;
}

type ContextSnapshotObjectStreamResultV1 = Awaited<
  ReturnType<Pick<ObjectStorePortV1, "getStream">["getStream"]>
>;

function captureMethodV1<TMethod>(
  port: unknown,
  methodName: PropertyKey,
  label: string,
  optional = false,
): TMethod | undefined {
  if (
    (typeof port !== "object" && typeof port !== "function") ||
    port === null ||
    isProxy(port)
  ) {
    throw new Error(`${label} must be a non-Proxy object`);
  }
  let cursor: object | null = port;
  while (cursor !== null) {
    if (isProxy(cursor)) {
      throw new Error(`${label} must not use Proxy prototypes`);
    }
    const descriptor = Object.getOwnPropertyDescriptor(cursor, methodName);
    if (descriptor !== undefined) {
      if (
        !("value" in descriptor) ||
        typeof descriptor.value !== "function" ||
        isProxy(descriptor.value)
      ) {
        throw new Error(`${label} method must be a non-Proxy data method`);
      }
      return Reflect.apply(
        Function.prototype.bind,
        descriptor.value,
        [port],
      ) as TMethod;
    }
    cursor = Object.getPrototypeOf(cursor) as object | null;
  }
  if (optional) return undefined;
  throw new Error(`${label} method is required`);
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

function canonicalDeepSnapshotV1<T>(value: unknown): T {
  return deepFreezeJsonV1(JSON.parse(canonicalJsonV1(value)) as T);
}

function snapshotRequestV1(value: unknown): ContextSnapshotResolveRequestV1 {
  let candidate: unknown;
  try {
    candidate = canonicalDeepSnapshotV1(value);
  } catch (error) {
    throw new Error("Context snapshot request is invalid", { cause: error });
  }
  if (
    typeof candidate !== "object" ||
    candidate === null ||
    Array.isArray(candidate)
  ) {
    throw new Error("Context snapshot request is invalid");
  }
  const request = candidate as Record<string, unknown>;
  if (
    ![
      "trigger_process_id",
      "workspace_id",
      "bot_id",
      "owner_agent_id",
      "context_snapshot_ref",
    ].every(
      (field) =>
        typeof request[field] === "string" &&
        (request[field] as string).length >= 1 &&
        (request[field] as string).length <= 512,
    ) ||
    (request.deployment_environment !== "local" &&
      request.deployment_environment !== "dev" &&
      request.deployment_environment !== "staging" &&
      request.deployment_environment !== "prod") ||
    (request.release_channel !== "stable" &&
      request.release_channel !== "canary") ||
    !Number.isSafeInteger(request.context_snapshot_version) ||
    (request.context_snapshot_version as number) < 1 ||
    typeof request.context_snapshot_hash !== "string" ||
    !/^sha256:[0-9a-f]{64}$/u.test(request.context_snapshot_hash) ||
    (request.purpose !== "intent_synthesis" &&
      request.purpose !== "runtime_start" &&
      request.purpose !== "audit_replay")
  ) {
    throw new Error("Context snapshot request is invalid");
  }
  return Object.freeze({
    trigger_process_id: request.trigger_process_id as string,
    workspace_id: request.workspace_id as string,
    bot_id: request.bot_id as string,
    owner_agent_id: request.owner_agent_id as string,
    deployment_environment:
      request.deployment_environment as ContextSnapshotResolveRequestV1["deployment_environment"],
    release_channel:
      request.release_channel as ContextSnapshotResolveRequestV1["release_channel"],
    context_snapshot_ref: request.context_snapshot_ref as string,
    context_snapshot_version: request.context_snapshot_version as number,
    context_snapshot_hash: request.context_snapshot_hash,
    purpose: request.purpose,
  });
}

function snapshotDecisionV1(
  value: unknown,
): ContextSnapshotReadDecisionV1 {
  if (
    typeof value !== "object" ||
    value === null ||
    isProxy(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  ) {
    throw new Error("Context snapshot read decision is invalid");
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  const expected = [
    "access_decision_ref",
    "redaction_policy_version",
    "redaction_state",
    "retention_policy_version",
  ] as const;
  if (
    keys.some((key) => typeof key !== "string") ||
    keys.length !== expected.length ||
    !expected.every((key) => keys.includes(key))
  ) {
    throw new Error("Context snapshot read decision is invalid");
  }
  for (const key of expected) {
    const descriptor = descriptors[key];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      throw new Error("Context snapshot read decision is invalid");
    }
  }
  const accessDecisionRef = descriptors.access_decision_ref!.value;
  const retentionPolicyVersion = descriptors.retention_policy_version!.value;
  const redactionPolicyVersion = descriptors.redaction_policy_version!.value;
  const redactionState = descriptors.redaction_state!.value;
  if (
    ![accessDecisionRef, retentionPolicyVersion, redactionPolicyVersion].every(
      (entry) =>
        typeof entry === "string" &&
        entry.length >= 1 &&
        entry.length <= 512 &&
        !/[\r\n]/u.test(entry),
    ) ||
    (redactionState !== "not_required" && redactionState !== "complete")
  ) {
    throw new Error("Context snapshot read decision is invalid");
  }
  return Object.freeze({
    access_decision_ref: accessDecisionRef as string,
    retention_policy_version: retentionPolicyVersion as string,
    redaction_policy_version: redactionPolicyVersion as string,
    redaction_state: redactionState,
  });
}

function captureAbortCheckV1(signal: unknown): () => boolean {
  if (typeof signal !== "object" || signal === null || isProxy(signal)) {
    throw new Error("Context snapshot signal is invalid");
  }
  const abortedGetter = Object.getOwnPropertyDescriptor(
    AbortSignal.prototype,
    "aborted",
  )?.get;
  if (abortedGetter === undefined) {
    throw new Error("AbortSignal intrinsic is unavailable");
  }
  try {
    abortedGetter.call(signal);
  } catch (error) {
    throw new Error("Context snapshot signal is invalid", { cause: error });
  }
  return () => abortedGetter.call(signal) as boolean;
}

function copyChunkV1(value: unknown, maximumBytes: number): Uint8Array {
  if (typeof value !== "object" || value === null || isProxy(value)) {
    throw new Error("Context snapshot stream yielded invalid bytes");
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
    throw new Error("Context snapshot stream yielded invalid bytes", {
      cause: error,
    });
  }
  if (
    !Number.isSafeInteger(byteLength) ||
    byteLength < 1 ||
    byteLength > maximumBytes ||
    (typeof SharedArrayBuffer !== "undefined" &&
      buffer instanceof SharedArrayBuffer)
  ) {
    throw new Error("Context snapshot stream exceeds its bounded size");
  }
  const copy = new Uint8Array(byteLength);
  Reflect.apply(Uint8Array.prototype.set, copy, [value as Uint8Array]);
  return copy;
}

function snapshotIteratorResultV1(value: unknown): Readonly<{
  done: boolean;
  value: unknown;
}> {
  if (
    typeof value !== "object" ||
    value === null ||
    isProxy(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  ) {
    throw new Error("Context snapshot stream iterator result is invalid");
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (
    keys.some((key) => typeof key !== "string") ||
    !keys.includes("done") ||
    keys.some((key) => key !== "done" && key !== "value")
  ) {
    throw new Error("Context snapshot stream iterator result is invalid");
  }
  const done = descriptors.done;
  const entry = descriptors.value;
  if (
    done === undefined ||
    !("value" in done) ||
    done.enumerable !== true ||
    typeof done.value !== "boolean" ||
    (entry !== undefined &&
      (!("value" in entry) || entry.enumerable !== true))
  ) {
    throw new Error("Context snapshot stream iterator result is invalid");
  }
  return Object.freeze({
    done: done.value,
    value: entry !== undefined && "value" in entry ? entry.value : undefined,
  });
}

function snapshotObjectStreamResultV1(
  value: unknown,
): Readonly<{
  object_ref: string;
  sha256: string;
  size_bytes: number;
  media_type: string;
  retention_until: string;
  next: () => Promise<unknown>;
  close?: () => Promise<unknown>;
}> {
  if (
    typeof value !== "object" ||
    value === null ||
    isProxy(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  ) {
    throw new Error("Context snapshot object metadata is invalid");
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const required = [
    "body",
    "media_type",
    "object_ref",
    "retention_until",
    "sha256",
    "size_bytes",
    "version",
  ] as const;
  const keys = Reflect.ownKeys(descriptors);
  if (
    keys.some((key) => typeof key !== "string") ||
    !required.every((key) => keys.includes(key)) ||
    keys.some(
      (key) =>
        typeof key !== "string" ||
        (!required.includes(key as (typeof required)[number]) &&
          key !== "content_range"),
    )
  ) {
    throw new Error("Context snapshot object metadata is invalid");
  }
  for (const key of keys as string[]) {
    const descriptor = descriptors[key];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      throw new Error("Context snapshot object metadata is invalid");
    }
  }
  const version = descriptors.version!.value;
  const contentRange = descriptors.content_range?.value;
  if (
    typeof version !== "string" ||
    version.length < 1 ||
    version.length > 512 ||
    (contentRange !== undefined &&
      (typeof contentRange !== "string" ||
        contentRange.length < 1 ||
        contentRange.length > 512))
  ) {
    throw new Error("Context snapshot object metadata is invalid");
  }
  const iteratorFactory = captureMethodV1<() => unknown>(
    descriptors.body!.value,
    Symbol.asyncIterator,
    "Context snapshot body async iterator",
  )!;
  const iterator = iteratorFactory();
  const next = captureMethodV1<() => Promise<unknown>>(
    iterator,
    "next",
    "Context snapshot stream iterator next",
  )!;
  const close = captureMethodV1<() => Promise<unknown>>(
    iterator,
    "return",
    "Context snapshot stream iterator return",
    true,
  );
  return Object.freeze({
    object_ref: descriptors.object_ref!.value,
    sha256: descriptors.sha256!.value,
    size_bytes: descriptors.size_bytes!.value,
    media_type: descriptors.media_type!.value,
    retention_until: descriptors.retention_until!.value,
    next,
    ...(close === undefined ? {} : { close }),
  });
}

function sha256Bytes(value: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function logicalHash(snapshot: ContextSnapshotV1): `sha256:${string}` {
  const value = Object.fromEntries(
    Object.entries(snapshot).filter(([key]) => key !== "snapshot_hash"),
  );
  return `sha256:${createHash("sha256")
    .update(canonicalJsonV1(value), "utf8")
    .digest("hex")}`;
}

export function createContextSnapshotResolverV1(
  objectStore: Pick<ObjectStorePortV1, "getStream">,
  accessDecisions: Readonly<{
    resolve(
      request: ContextSnapshotResolveRequestV1,
    ): Promise<ContextSnapshotReadDecisionV1>;
  }>,
  canonicalReferences: ContextSnapshotCanonicalReferenceRepositoryV1,
  options: Readonly<{
    now?: () => Date;
    max_size_bytes?: number;
  }> = {},
): ContextSnapshotResolverV1 {
  if (
    typeof options !== "object" ||
    options === null ||
    isProxy(options)
  ) {
    throw new Error("Context snapshot resolver options are invalid");
  }
  const optionDescriptors = Object.getOwnPropertyDescriptors(options);
  const optionKeys = Reflect.ownKeys(optionDescriptors);
  if (
    optionKeys.some(
      (key) =>
        typeof key !== "string" ||
        (key !== "now" && key !== "max_size_bytes"),
    )
  ) {
    throw new Error("Context snapshot resolver options are invalid");
  }
  for (const key of optionKeys as string[]) {
    const descriptor = optionDescriptors[key];
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new Error("Context snapshot resolver options are invalid");
    }
  }
  const nowDescriptor = optionDescriptors.now;
  const now =
    nowDescriptor === undefined || nowDescriptor.value === undefined
      ? () => new Date()
      : nowDescriptor.value;
  if (typeof now !== "function" || isProxy(now)) {
    throw new Error("Context snapshot resolver clock is invalid");
  }
  const maxSizeBytes =
    optionDescriptors.max_size_bytes?.value ?? 4 * 1024 * 1024;
  if (
    !Number.isSafeInteger(maxSizeBytes) ||
    maxSizeBytes < 1 ||
    maxSizeBytes > 16 * 1024 * 1024
  ) {
    throw new Error("Context snapshot resolver size limit is invalid");
  }
  const isCanonicalReference = captureMethodV1<
    ContextSnapshotCanonicalReferenceRepositoryV1["isCanonicalReference"]
  >(
    canonicalReferences,
    "isCanonicalReference",
    "Context snapshot canonical reference repository",
  )!;
  const resolveDecision = captureMethodV1<
    (typeof accessDecisions)["resolve"]
  >(accessDecisions, "resolve", "Context snapshot access decision resolver")!;
  const getStream = captureMethodV1<
    Pick<ObjectStorePortV1, "getStream">["getStream"]
  >(objectStore, "getStream", "Context snapshot ObjectStore")!;

  const readNowMilliseconds = (): number => {
    let candidate: unknown;
    try {
      candidate = Reflect.apply(now, undefined, []);
      if (
        typeof candidate !== "object" ||
        candidate === null ||
        isProxy(candidate) ||
        Object.getPrototypeOf(candidate) !== Date.prototype
      ) {
        throw new Error("Context snapshot resolver clock is invalid");
      }
      const milliseconds = Date.prototype.getTime.call(candidate) as number;
      if (!Number.isFinite(milliseconds)) {
        throw new Error("Context snapshot resolver clock is invalid");
      }
      return milliseconds;
    } catch (error) {
      throw new Error("Context snapshot resolver clock is invalid", {
        cause: error,
      });
    }
  };

  const readSnapshot = async (
    requestValue: ContextSnapshotResolveRequestV1,
    signalValue: AbortSignal,
  ) => {
    const request = snapshotRequestV1(requestValue);
    const isAborted = captureAbortCheckV1(signalValue);
    if (isAborted()) throw new Error("context_snapshot_read_aborted");
    if ((await isCanonicalReference(request)) !== true) {
      throw new Error("Context snapshot ref is not canonical for the process");
    }
    if (isAborted()) throw new Error("context_snapshot_read_aborted");
    const decision = snapshotDecisionV1(await resolveDecision(request));
    if (isAborted()) throw new Error("context_snapshot_read_aborted");
    const rawResult: ContextSnapshotObjectStreamResultV1 = await getStream(
      Object.freeze({
        owner_service: "trigger_processor",
        owner_object_id: request.trigger_process_id,
        owner_state_version: request.context_snapshot_version,
        scope: Object.freeze({
          scope_kind: "bot" as const,
          workspace_id: request.workspace_id,
          bot_id: request.bot_id,
          owner_agent_id: request.owner_agent_id,
          deployment_environment: request.deployment_environment,
          release_channel: request.release_channel,
        }),
        capability: "trigger_process.snapshot.resolve",
        object_ref: request.context_snapshot_ref as ObjectRefV1,
        access_decision_ref: decision.access_decision_ref,
        retention_policy_version: decision.retention_policy_version,
        redaction_policy_version: decision.redaction_policy_version,
      }),
    );
    const result = snapshotObjectStreamResultV1(rawResult);
    if (
      typeof result.object_ref !== "string" ||
      result.object_ref !== request.context_snapshot_ref ||
      result.media_type !== "application/json" ||
      typeof result.sha256 !== "string" ||
      !/^sha256:[0-9a-f]{64}$/u.test(result.sha256) ||
      !Number.isSafeInteger(result.size_bytes) ||
      result.size_bytes < 1 ||
      result.size_bytes > maxSizeBytes ||
      typeof result.retention_until !== "string" ||
      !Number.isFinite(Date.parse(result.retention_until)) ||
      Date.parse(result.retention_until) <= readNowMilliseconds()
    ) {
      throw new Error("Context snapshot object metadata is invalid");
    }
    const chunks: Uint8Array[] = [];
    let size = 0;
    let complete = false;
    try {
      while (true) {
        const step = snapshotIteratorResultV1(await result.next());
        if (step.done) {
          complete = true;
          break;
        }
        if (isAborted()) throw new Error("context_snapshot_read_aborted");
        const chunk = copyChunkV1(
          step.value,
          Math.min(result.size_bytes - size, maxSizeBytes - size),
        );
        size += chunk.byteLength;
        chunks.push(chunk);
      }
    } finally {
      if (!complete && result.close !== undefined) {
        try {
          await result.close();
        } catch {
          // Preserve the primary validation/abort failure.
        }
      }
    }
    if (size !== result.size_bytes) {
      throw new Error("Context snapshot stream size does not match metadata");
    }
    if (Date.parse(result.retention_until) <= readNowMilliseconds()) {
      throw new Error("Context snapshot object metadata expired during read");
    }
    const bytes = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
    if (sha256Bytes(bytes) !== result.sha256) {
      throw new Error("Context snapshot physical hash mismatch");
    }
    let snapshot: unknown;
    try {
      snapshot = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      );
    } catch (error) {
      throw new Error("Context snapshot bytes are not canonical JSON", {
        cause: error,
      });
    }
    if (
      Buffer.from(canonicalJsonV1(snapshot), "utf8").compare(bytes) !== 0
    ) {
      throw new Error("Context snapshot bytes are not canonical JSON");
    }
    if (!Value.Check(ContextSnapshotV1Schema, snapshot)) {
      throw new Error("Context snapshot schema is incompatible");
    }
    const typed = deepFreezeJsonV1(snapshot as ContextSnapshotV1);
    assertContextSnapshotSemanticBindingsV1(typed);
    if (
      typed.trigger_process_id !== request.trigger_process_id ||
      typed.workspace_id !== request.workspace_id ||
      typed.bot_id !== request.bot_id ||
      typed.owner_agent_id !== request.owner_agent_id ||
      typed.deployment_environment !== request.deployment_environment ||
      typed.release_channel !== request.release_channel ||
      typed.context_version !== request.context_snapshot_version ||
      typed.snapshot_hash !== request.context_snapshot_hash ||
      logicalHash(typed) !== typed.snapshot_hash
    ) {
      throw new Error("Context snapshot identity or logical hash mismatch");
    }
    return Object.freeze({
      snapshot: typed,
      canonical_bytes: Uint8Array.from(bytes),
      canonical_bytes_sha256: result.sha256 as `sha256:${string}`,
      content_length_bytes: bytes.byteLength,
      retention_until: result.retention_until,
      redaction_state: decision.redaction_state,
    });
  };

  return Object.freeze({
    async resolve(
      request: ContextSnapshotResolveRequestV1,
      signal: AbortSignal,
    ) {
      return (await readSnapshot(request, signal)).snapshot;
    },
    async resolveOwnerRead(
      request: ContextSnapshotOwnerResolveRequestV1,
      signal: AbortSignal,
    ) {
      return readSnapshot(request, signal);
    },
  });
}
