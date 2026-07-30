import { createHash } from "node:crypto";
import { isProxy } from "node:util/types";

import {
  SnapshotOverflowRefV1Schema,
  assertSnapshotOverflowRefSemanticBindingsV1,
  type ServiceIdV1,
  type SnapshotOverflowRefV1,
  type TriggerProcessSnapshotContentChunkV1,
  type TriggerProcessSnapshotResolvePurposeV1,
} from "@pai/contracts";
import { canonicalJsonV1 } from "@pai/eventing";
import type { ObjectRefV1, ObjectStorePortV1 } from "@pai/object-store";
import { Value } from "@sinclair/typebox/value";

import type {
  TriggerProcessSnapshotMaterializerV1,
  TriggerProcessSnapshotMetadataV1,
} from "./process-snapshot-read.v1.js";

export interface TriggerProcessSnapshotObjectReadDecisionV1 {
  readonly access_decision_ref: string;
  readonly retention_policy_version: string;
  readonly redaction_policy_version: string;
}

export interface TriggerProcessSnapshotObjectReadDecisionRequestV1 {
  readonly object_kind: "manifest";
  readonly source_service: "trigger_processor";
  readonly object_ref: string;
  readonly metadata: TriggerProcessSnapshotMetadataV1;
  readonly purpose: TriggerProcessSnapshotResolvePurposeV1;
  readonly trace_id: string;
}

export interface TriggerProcessSnapshotObjectReadDecisionResolverV1 {
  resolve(
    request: TriggerProcessSnapshotObjectReadDecisionRequestV1,
  ): Promise<TriggerProcessSnapshotObjectReadDecisionV1>;
}

/**
 * Overflow references are owner facts, not generic ObjectStore objects. The
 * concrete owner adapter must resolve runtime events, TP projections, Meta
 * events, or artifact-store references through the corresponding owner
 * boundary. For artifact_store it may use ObjectStore internally with the
 * artifact's own immutable owner binding; Trigger Processor must never invent
 * that binding from the snapshot identity.
 */
export interface TriggerProcessSnapshotOwnerOverflowReaderV1 {
  read(
    request: Readonly<{
      overflow_ref: SnapshotOverflowRefV1;
      metadata: TriggerProcessSnapshotMetadataV1;
      purpose: TriggerProcessSnapshotResolvePurposeV1;
      trace_id: string;
    }>,
  ): Promise<TriggerProcessSnapshotOwnerOverflowReadResultV1>;
}

export interface TriggerProcessSnapshotOwnerOverflowReadResultV1 {
  readonly owner_evidence: SnapshotOverflowRefV1;
  readonly object_ref: string;
  readonly version: string;
  readonly sha256: string;
  readonly size_bytes: number;
  readonly media_type: string;
  readonly retention_until: string;
  readonly body: AsyncIterable<Uint8Array>;
  readonly content_range?: string;
}

const DECISION_KEYS = [
  "access_decision_ref",
  "redaction_policy_version",
  "retention_policy_version",
] as const;

type MaterializeRequestV1 = Parameters<
  TriggerProcessSnapshotMaterializerV1["materialize"]
>[0];
type SnapshotObjectStreamResultV1 = Awaited<
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

function snapshotMaterializeRequestV1(value: unknown): MaterializeRequestV1 {
  let candidate: unknown;
  try {
    candidate = canonicalDeepSnapshotV1(value);
  } catch (error) {
    throw new Error("Trigger snapshot materialize request is invalid", {
      cause: error,
    });
  }
  if (
    typeof candidate !== "object" ||
    candidate === null ||
    Array.isArray(candidate)
  ) {
    throw new Error("Trigger snapshot materialize request is invalid");
  }
  const request = candidate as Record<string, unknown>;
  const metadata = request.metadata;
  if (
    typeof metadata !== "object" ||
    metadata === null ||
    Array.isArray(metadata) ||
    (request.purpose !== "meta_learning" &&
      request.purpose !== "observation_replay" &&
      request.purpose !== "repair" &&
      request.purpose !== "diagnostic") ||
    typeof request.trace_id !== "string" ||
    request.trace_id.length < 1
  ) {
    throw new Error("Trigger snapshot materialize request is invalid");
  }
  const record = metadata as Record<string, unknown>;
  if (
    ![
      "snapshot_ref",
      "workspace_id",
      "bot_id",
      "owner_agent_id",
      "retention_until",
    ].every(
      (field) =>
        typeof record[field] === "string" &&
        (record[field] as string).length >= 1,
    ) ||
    (record.deployment_environment !== "local" &&
      record.deployment_environment !== "dev" &&
      record.deployment_environment !== "staging" &&
      record.deployment_environment !== "prod") ||
    (record.release_channel !== "stable" &&
      record.release_channel !== "canary") ||
    !Number.isFinite(Date.parse(record.retention_until as string)) ||
    !Array.isArray(record.overflow_refs) ||
    !record.overflow_refs.every((overflow) =>
      Value.Check(SnapshotOverflowRefV1Schema, overflow),
    )
  ) {
    throw new Error("Trigger snapshot materialize metadata is invalid");
  }
  try {
    for (const overflow of record.overflow_refs as SnapshotOverflowRefV1[]) {
      assertSnapshotOverflowRefSemanticBindingsV1(overflow);
    }
  } catch (error) {
    throw new Error("Trigger snapshot materialize metadata is invalid", {
      cause: error,
    });
  }
  return candidate as MaterializeRequestV1;
}

function snapshotDecisionV1(
  value: unknown,
): TriggerProcessSnapshotObjectReadDecisionV1 {
  if (
    typeof value !== "object" ||
    value === null ||
    isProxy(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  ) {
    throw new Error("Trigger snapshot object read decision is invalid");
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (
    keys.some((key) => typeof key !== "string") ||
    keys.length !== DECISION_KEYS.length ||
    !DECISION_KEYS.every((key) => keys.includes(key))
  ) {
    throw new Error("Trigger snapshot object read decision is invalid");
  }
  const valid = DECISION_KEYS.every((key) => {
    const descriptor = descriptors[key];
    return (
      descriptor !== undefined &&
      "value" in descriptor &&
      descriptor.enumerable === true &&
      typeof descriptor.value === "string" &&
      descriptor.value.length >= 1 &&
      descriptor.value.length <= 512 &&
      !/[\r\n]/u.test(descriptor.value)
    );
  });
  if (!valid) {
    throw new Error("Trigger snapshot object read decision is invalid");
  }
  return Object.freeze({
    access_decision_ref: descriptors.access_decision_ref!.value,
    retention_policy_version: descriptors.retention_policy_version!.value,
    redaction_policy_version: descriptors.redaction_policy_version!.value,
  });
}

function copyChunkV1(value: unknown, maximumBytes: number): Uint8Array {
  if (typeof value !== "object" || value === null || isProxy(value)) {
    throw new Error("Trigger snapshot object yielded invalid bytes");
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
    throw new Error("Trigger snapshot object yielded invalid bytes", {
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
    throw new Error("Trigger snapshot object exceeds bounded size");
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
    throw new Error("Trigger snapshot stream iterator result is invalid");
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (
    keys.some((key) => typeof key !== "string") ||
    !keys.includes("done") ||
    keys.some((key) => key !== "done" && key !== "value")
  ) {
    throw new Error("Trigger snapshot stream iterator result is invalid");
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
    throw new Error("Trigger snapshot stream iterator result is invalid");
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
  owner_evidence?: unknown;
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
    throw new Error("Trigger snapshot object metadata is invalid");
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
          key !== "content_range" &&
          key !== "owner_evidence"),
    )
  ) {
    throw new Error("Trigger snapshot object metadata is invalid");
  }
  for (const key of keys as string[]) {
    const descriptor = descriptors[key];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      throw new Error("Trigger snapshot object metadata is invalid");
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
    throw new Error("Trigger snapshot object metadata is invalid");
  }
  const iteratorFactory = captureMethodV1<() => unknown>(
    descriptors.body!.value,
    Symbol.asyncIterator,
    "Trigger snapshot body async iterator",
  )!;
  const iterator = iteratorFactory();
  const next = captureMethodV1<() => Promise<unknown>>(
    iterator,
    "next",
    "Trigger snapshot stream iterator next",
  )!;
  const close = captureMethodV1<() => Promise<unknown>>(
    iterator,
    "return",
    "Trigger snapshot stream iterator return",
    true,
  );
  return Object.freeze({
    object_ref: descriptors.object_ref!.value,
    sha256: descriptors.sha256!.value,
    size_bytes: descriptors.size_bytes!.value,
    media_type: descriptors.media_type!.value,
    retention_until: descriptors.retention_until!.value,
    ...(descriptors.owner_evidence === undefined
      ? {}
      : { owner_evidence: descriptors.owner_evidence.value }),
    next,
    ...(close === undefined ? {} : { close }),
  });
}

function sha256Bytes(value: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function sha256Json(value: unknown): `sha256:${string}` {
  return `sha256:${createHash("sha256")
    .update(canonicalJsonV1(value), "utf8")
    .digest("hex")}`;
}

function scope(metadata: TriggerProcessSnapshotMetadataV1) {
  return {
    scope_kind: "bot" as const,
    workspace_id: metadata.workspace_id,
    bot_id: metadata.bot_id,
    owner_agent_id: metadata.owner_agent_id,
    deployment_environment: metadata.deployment_environment,
    release_channel: metadata.release_channel,
  };
}

export function createObjectStoreTriggerProcessSnapshotMaterializerV1(
  objectStore: Pick<ObjectStorePortV1, "getStream">,
  accessDecisions: TriggerProcessSnapshotObjectReadDecisionResolverV1,
  ownerOverflowReader: TriggerProcessSnapshotOwnerOverflowReaderV1,
  options: Readonly<{
    now?: () => Date;
    max_manifest_size_bytes?: number;
    max_overflow_object_size_bytes?: number;
    max_total_read_size_bytes?: number;
  }> = {},
): TriggerProcessSnapshotMaterializerV1 {
  if (
    typeof options !== "object" ||
    options === null ||
    isProxy(options)
  ) {
    throw new Error("Trigger snapshot materializer options are invalid");
  }
  const optionDescriptors = Object.getOwnPropertyDescriptors(options);
  const optionKeys = Reflect.ownKeys(optionDescriptors);
  const allowedOptionKeys = new Set([
    "now",
    "max_manifest_size_bytes",
    "max_overflow_object_size_bytes",
    "max_total_read_size_bytes",
  ]);
  if (
    optionKeys.some(
      (key) => typeof key !== "string" || !allowedOptionKeys.has(key),
    )
  ) {
    throw new Error("Trigger snapshot materializer options are invalid");
  }
  for (const key of optionKeys as string[]) {
    const descriptor = optionDescriptors[key];
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new Error("Trigger snapshot materializer options are invalid");
    }
  }
  const now =
    optionDescriptors.now === undefined ||
    optionDescriptors.now.value === undefined
      ? () => new Date()
      : optionDescriptors.now.value;
  if (typeof now !== "function" || isProxy(now)) {
    throw new Error("Trigger snapshot materializer clock is invalid");
  }
  const maxManifestSize =
    optionDescriptors.max_manifest_size_bytes?.value ?? 4 * 1024 * 1024;
  const maxOverflowSize =
    optionDescriptors.max_overflow_object_size_bytes?.value ??
    16 * 1024 * 1024;
  const maxTotalSize =
    optionDescriptors.max_total_read_size_bytes?.value ?? 64 * 1024 * 1024;
  for (const [label, value, maximum] of [
    ["manifest", maxManifestSize, 16 * 1024 * 1024],
    ["overflow", maxOverflowSize, 64 * 1024 * 1024],
    ["total", maxTotalSize, 256 * 1024 * 1024],
  ] as const) {
    if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
      throw new Error(`Trigger snapshot ${label} read limit is invalid`);
    }
  }
  if (maxManifestSize > maxTotalSize || maxOverflowSize > maxTotalSize) {
    throw new Error("Trigger snapshot per-object read limit exceeds total limit");
  }
  const resolveDecision = captureMethodV1<
    TriggerProcessSnapshotObjectReadDecisionResolverV1["resolve"]
  >(
    accessDecisions,
    "resolve",
    "Trigger snapshot access decision resolver",
  )!;
  const getStream = captureMethodV1<
    Pick<ObjectStorePortV1, "getStream">["getStream"]
  >(objectStore, "getStream", "Trigger snapshot ObjectStore")!;
  const readOwnerOverflow = captureMethodV1<
    TriggerProcessSnapshotOwnerOverflowReaderV1["read"]
  >(
    ownerOverflowReader,
    "read",
    "Trigger snapshot owner overflow reader",
  )!;

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
        throw new Error("Trigger snapshot materializer clock is invalid");
      }
      const milliseconds = Reflect.apply(
        Date.prototype.getTime,
        candidate,
        [],
      ) as number;
      if (!Number.isFinite(milliseconds)) {
        throw new Error("Trigger snapshot materializer clock is invalid");
      }
      return milliseconds;
    } catch (error) {
      throw new Error("Trigger snapshot materializer clock is invalid", {
        cause: error,
      });
    }
  };

  return Object.freeze({
    async materialize(requestValue: MaterializeRequestV1) {
      const { metadata, purpose, trace_id } =
        snapshotMaterializeRequestV1(requestValue);
      let totalBytes = 0;
      const readVerifiedStream = async (input: Readonly<{
        object_kind: "manifest" | "owner_overflow";
        object_ref: string;
        required_retention_until: string;
        expected_checksum?: string;
        expected_owner_evidence?: SnapshotOverflowRefV1;
        raw_result: unknown;
      }>): Promise<Uint8Array> => {
        if (
          !Number.isFinite(Date.parse(input.required_retention_until))
        ) {
          throw new Error("Trigger snapshot required retention is invalid");
        }
        const result = snapshotObjectStreamResultV1(input.raw_result);
        const perObjectLimit =
          input.object_kind === "manifest" ? maxManifestSize : maxOverflowSize;
        if (
          typeof result.object_ref !== "string" ||
          result.object_ref !== input.object_ref ||
          typeof result.sha256 !== "string" ||
          !/^sha256:[0-9a-f]{64}$/u.test(result.sha256) ||
          typeof result.media_type !== "string" ||
          !Number.isSafeInteger(result.size_bytes) ||
          result.size_bytes < 1 ||
          result.size_bytes > perObjectLimit ||
          totalBytes + result.size_bytes > maxTotalSize ||
          typeof result.retention_until !== "string" ||
          !Number.isFinite(Date.parse(result.retention_until)) ||
          Date.parse(result.retention_until) <
            Date.parse(input.required_retention_until) ||
          Date.parse(result.retention_until) <= readNowMilliseconds() ||
          (input.object_kind === "manifest" &&
            (result.media_type !== "application/json" ||
              result.owner_evidence !== undefined)) ||
          (input.expected_checksum !== undefined &&
            result.sha256 !== input.expected_checksum) ||
          (input.expected_owner_evidence !== undefined &&
            canonicalJsonV1(result.owner_evidence) !==
              canonicalJsonV1(input.expected_owner_evidence))
        ) {
          throw new Error("Trigger snapshot object metadata is invalid");
        }
        const chunks: Uint8Array[] = [];
        let objectBytes = 0;
        let complete = false;
        try {
          while (true) {
            const step = snapshotIteratorResultV1(await result.next());
            if (step.done) {
              complete = true;
              break;
            }
            const chunk = copyChunkV1(
              step.value,
              Math.min(
                result.size_bytes - objectBytes,
                perObjectLimit - objectBytes,
                maxTotalSize - totalBytes - objectBytes,
              ),
            );
            objectBytes += chunk.byteLength;
            chunks.push(chunk);
          }
        } finally {
          if (!complete && result.close !== undefined) {
            try {
              await result.close();
            } catch {
              // Preserve the primary validation failure.
            }
          }
        }
        if (objectBytes !== result.size_bytes) {
          throw new Error("Trigger snapshot object size does not match metadata");
        }
        if (Date.parse(result.retention_until) <= readNowMilliseconds()) {
          throw new Error("Trigger snapshot object metadata expired during read");
        }
        const bytes = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
        if (
          sha256Bytes(bytes) !== result.sha256 ||
          (input.expected_checksum !== undefined &&
            sha256Bytes(bytes) !== input.expected_checksum)
        ) {
          throw new Error("Trigger snapshot object physical hash mismatch");
        }
        totalBytes += objectBytes;
        return bytes;
      };

      const manifestDecision = snapshotDecisionV1(
        await resolveDecision(
          Object.freeze({
            object_kind: "manifest",
            source_service: "trigger_processor",
            object_ref: metadata.snapshot_ref,
            metadata,
            purpose,
            trace_id,
          }),
        ),
      );
      const rawManifestResult: SnapshotObjectStreamResultV1 =
        await getStream(
          Object.freeze({
            owner_service: "trigger_processor",
            owner_object_id: metadata.snapshot_id,
            owner_state_version: metadata.snapshot_version,
            scope: Object.freeze(scope(metadata)),
            // ObjectStore capability namespace is owner-object scoped and is
            // intentionally distinct from the internal HTTP route capability.
            capability: "trigger_process.snapshot.resolve",
            object_ref: metadata.snapshot_ref as ObjectRefV1,
            access_decision_ref: manifestDecision.access_decision_ref,
            retention_policy_version:
              manifestDecision.retention_policy_version,
            redaction_policy_version:
              manifestDecision.redaction_policy_version,
          }),
        );
      const manifestBytes = await readVerifiedStream({
        object_kind: "manifest",
        object_ref: metadata.snapshot_ref,
        required_retention_until: metadata.retention_until,
        raw_result: rawManifestResult,
      });
      let snapshotManifest: unknown;
      try {
        snapshotManifest = JSON.parse(
          new TextDecoder("utf-8", { fatal: true }).decode(manifestBytes),
        );
      } catch (error) {
        throw new Error("Trigger snapshot manifest is not UTF-8 JSON", {
          cause: error,
        });
      }
      if (
        Buffer.from(canonicalJsonV1(snapshotManifest), "utf8").compare(
          Buffer.from(manifestBytes),
        ) !== 0
      ) {
        throw new Error("Trigger snapshot manifest bytes are not canonical JSON");
      }
      if (
        typeof snapshotManifest !== "object" ||
        snapshotManifest === null ||
        Array.isArray(snapshotManifest)
      ) {
        throw new Error("Trigger snapshot manifest shape is invalid");
      }

      const overflowChunks: TriggerProcessSnapshotContentChunkV1[] = [];
      // Read sequentially so the aggregate byte budget is authoritative even
      // when individual owner streams are slow or adversarial.
      for (const overflow of metadata.overflow_refs) {
        const rawOverflowResult =
          await readOwnerOverflow(
            Object.freeze({
              overflow_ref: overflow,
              metadata,
              purpose,
              trace_id,
            }),
          );
        await readVerifiedStream({
          object_kind: "owner_overflow",
          object_ref: overflow.object_ref,
          required_retention_until: overflow.retention_until,
          expected_checksum: overflow.checksum,
          expected_owner_evidence: overflow,
          raw_result: rawOverflowResult,
        });
        overflowChunks.push({
          source_service: overflow.source_service,
          first_append_sequence_no: overflow.first_append_sequence_no,
          last_append_sequence_no: overflow.last_append_sequence_no,
          checksum_algorithm: overflow.checksum_algorithm,
          checksum: overflow.checksum,
          owner_content_ref: overflow.object_ref,
          retention_until: overflow.retention_until,
          redaction_state: overflow.redaction_state,
        });
      }

      const rawEventTrace = (snapshotManifest as Record<string, unknown>)
        .event_trace;
      if (
        rawEventTrace !== undefined &&
        (!Array.isArray(rawEventTrace) ||
          rawEventTrace.some(
            (event) =>
              typeof event !== "object" ||
              event === null ||
              Array.isArray(event) ||
              typeof (event as Record<string, unknown>).source_service !==
                "string" ||
              !Number.isSafeInteger(
                (event as Record<string, unknown>).append_sequence_no,
              ) ||
              ((event as Record<string, unknown>)
                .append_sequence_no as number) < 1,
          ))
      ) {
        throw new Error("Trigger snapshot manifest event trace is invalid");
      }
      const eventTrace = (rawEventTrace ?? []) as readonly Readonly<{
        source_service: ServiceIdV1;
        append_sequence_no: number;
      }>[];
      const inlineChunks = eventTrace.map((event) => ({
        source_service: event.source_service,
        first_append_sequence_no: event.append_sequence_no,
        last_append_sequence_no: event.append_sequence_no,
        checksum_algorithm: "sha256" as const,
        checksum: sha256Json(event),
        inline_content: event,
        retention_until: metadata.retention_until,
        redaction_state: "not_required" as const,
      } satisfies TriggerProcessSnapshotContentChunkV1));
      const contentChunks = [...inlineChunks, ...overflowChunks].sort(
        (left, right) =>
          left.first_append_sequence_no - right.first_append_sequence_no ||
          left.last_append_sequence_no - right.last_append_sequence_no ||
          left.source_service.localeCompare(right.source_service),
      );
      return deepFreezeJsonV1({
        snapshot_manifest: snapshotManifest,
        content_chunks: contentChunks,
      });
    },
  });
}
