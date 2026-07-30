import { createHash } from "node:crypto";
import { isProxy } from "node:util/types";

import {
  SnapshotOverflowRefV1Schema,
  TriggerProcessSnapshotReadContractV1Schema,
  TriggerProcessSnapshotResolveRequestV1Schema,
  TriggerProcessSnapshotV1Schema,
  assertTriggerProcessSnapshotReadBindingsV1,
  assertTriggerProcessSnapshotSemanticBindingsV1,
  type SnapshotOverflowRefV1,
  type TriggerProcessSnapshotContentChunkV1,
  type TriggerProcessSnapshotReadContractV1,
  type TriggerProcessSnapshotResolveErrorCodeV1,
  type TriggerProcessSnapshotResolvePurposeV1,
  type TriggerProcessSnapshotResolveRequestV1,
  type TriggerProcessSnapshotV1,
} from "@pai/contracts";
import { canonicalJsonV1 } from "@pai/eventing";
import { Value } from "@sinclair/typebox/value";

export interface TriggerProcessSnapshotResolvePrincipalV1 {
  readonly service_id:
    | "meta_cognition"
    | "observation_gateway"
    | "trigger_processor";
  readonly capability: "trigger.process.snapshot.resolve";
  readonly scope: Readonly<{
    workspace_id: string;
    bot_id: string;
    owner_agent_id: string;
    deployment_environment: "local" | "dev" | "staging" | "prod";
    release_channel: "stable" | "canary";
  }>;
}

export interface TriggerProcessSnapshotMetadataV1 {
  readonly snapshot_id: string;
  readonly trigger_process_id: string;
  readonly workspace_id: string;
  readonly bot_id: string;
  readonly owner_agent_id: string;
  readonly deployment_environment: "local" | "dev" | "staging" | "prod";
  readonly release_channel: "stable" | "canary";
  readonly schema_version: string;
  readonly snapshot_version: number;
  readonly snapshot_hash: string;
  readonly snapshot_ref: string;
  readonly first_append_sequence_no: number;
  readonly last_append_sequence_no: number;
  readonly status: "current" | "superseded" | "invalid" | "expired";
  readonly retention_until: string;
  readonly overflow_refs: readonly SnapshotOverflowRefV1[];
}

export type TriggerProcessSnapshotMetadataReadV1 =
  | Readonly<{ outcome: "not_found" }>
  | Readonly<{ outcome: "found"; metadata: TriggerProcessSnapshotMetadataV1 }>;

export interface TriggerProcessSnapshotMetadataRepositoryV1 {
  readExactSnapshot(request: Readonly<{
    trigger_process_id: string;
    snapshot_ref: string;
  }>): Promise<TriggerProcessSnapshotMetadataReadV1>;
}

export interface TriggerProcessSnapshotMaterializerV1 {
  materialize(request: Readonly<{
    metadata: TriggerProcessSnapshotMetadataV1;
    purpose: TriggerProcessSnapshotResolvePurposeV1;
    trace_id: string;
  }>): Promise<Readonly<{
    snapshot_manifest: unknown;
    content_chunks: unknown;
  }>>;
}

export class TriggerProcessSnapshotResolveErrorV1 extends Error {
  public constructor(
    public readonly code: TriggerProcessSnapshotResolveErrorCodeV1,
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = "TriggerProcessSnapshotResolveErrorV1";
  }
}

export interface TriggerProcessSnapshotReadApplicationV1 {
  resolve(
    principal: TriggerProcessSnapshotResolvePrincipalV1,
    request: unknown,
  ): Promise<TriggerProcessSnapshotReadContractV1>;
}

const ALLOWED_CALLER_BY_PURPOSE = Object.freeze({
  meta_learning: new Set(["meta_cognition"]),
  observation_replay: new Set(["observation_gateway"]),
  repair: new Set(["trigger_processor"]),
  diagnostic: new Set(["trigger_processor"]),
} satisfies Readonly<
  Record<TriggerProcessSnapshotResolvePurposeV1, ReadonlySet<string>>
>);

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
    throw new Error("snapshot read options must be a non-Proxy object");
  }
  const descriptor = Object.getOwnPropertyDescriptor(options, "now");
  if (descriptor === undefined) return () => new Date();
  if (
    !("value" in descriptor) ||
    descriptor.value === undefined ||
    typeof descriptor.value !== "function" ||
    isProxy(descriptor.value)
  ) {
    throw new Error("snapshot read clock must be a data method");
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

function canonicalDeepSnapshotV1<T>(value: unknown): T {
  return deepFreezeJsonV1(JSON.parse(canonicalJsonV1(value)) as T);
}

function principalSnapshotV1(
  value: unknown,
): TriggerProcessSnapshotResolvePrincipalV1 {
  let snapshot: unknown;
  try {
    snapshot = canonicalDeepSnapshotV1(value);
  } catch (error) {
    fail("snapshot_scope_mismatch", error);
  }
  if (
    typeof snapshot !== "object" ||
    snapshot === null ||
    Array.isArray(snapshot) ||
    typeof (snapshot as Record<string, unknown>).scope !== "object" ||
    (snapshot as Record<string, unknown>).scope === null ||
    Array.isArray((snapshot as Record<string, unknown>).scope)
  ) {
    fail("snapshot_scope_mismatch");
  }
  return snapshot as TriggerProcessSnapshotResolvePrincipalV1;
}

function validMetadataV1(
  value: unknown,
): value is TriggerProcessSnapshotMetadataV1 {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const metadata = value as Record<string, unknown>;
  return (
    [
      "snapshot_id",
      "trigger_process_id",
      "workspace_id",
      "bot_id",
      "owner_agent_id",
      "schema_version",
      "snapshot_hash",
      "snapshot_ref",
      "retention_until",
    ].every(
      (field) =>
        typeof metadata[field] === "string" &&
        (metadata[field] as string).length > 0,
    ) &&
    (metadata.deployment_environment === "local" ||
      metadata.deployment_environment === "dev" ||
      metadata.deployment_environment === "staging" ||
      metadata.deployment_environment === "prod") &&
    (metadata.release_channel === "stable" ||
      metadata.release_channel === "canary") &&
    Number.isSafeInteger(metadata.snapshot_version) &&
    (metadata.snapshot_version as number) > 0 &&
    Number.isSafeInteger(metadata.first_append_sequence_no) &&
    (metadata.first_append_sequence_no as number) >= 0 &&
    Number.isSafeInteger(metadata.last_append_sequence_no) &&
    (metadata.last_append_sequence_no as number) >=
      (metadata.first_append_sequence_no as number) &&
    (metadata.status === "current" ||
      metadata.status === "superseded" ||
      metadata.status === "invalid" ||
      metadata.status === "expired") &&
    Number.isFinite(Date.parse(metadata.retention_until as string)) &&
    Array.isArray(metadata.overflow_refs) &&
    metadata.overflow_refs.every((overflow) =>
      Value.Check(SnapshotOverflowRefV1Schema, overflow),
    )
  );
}

function scopeMatches(
  left: TriggerProcessSnapshotResolvePrincipalV1["scope"],
  right: TriggerProcessSnapshotResolveRequestV1,
): boolean {
  return (
    left.workspace_id === right.workspace_id &&
    left.bot_id === right.bot_id &&
    left.owner_agent_id === right.owner_agent_id &&
    left.deployment_environment === right.deployment_environment &&
    left.release_channel === right.release_channel
  );
}

function metadataScopeMatches(
  metadata: TriggerProcessSnapshotMetadataV1,
  request: TriggerProcessSnapshotResolveRequestV1,
): boolean {
  return (
    metadata.trigger_process_id === request.trigger_process_id &&
    metadata.workspace_id === request.workspace_id &&
    metadata.bot_id === request.bot_id &&
    metadata.owner_agent_id === request.owner_agent_id &&
    metadata.deployment_environment === request.deployment_environment &&
    metadata.release_channel === request.release_channel
  );
}

function manifestScopeMatchesMetadata(
  snapshot: TriggerProcessSnapshotV1,
  metadata: TriggerProcessSnapshotMetadataV1,
): boolean {
  return (
    snapshot.trigger_process_id === metadata.trigger_process_id &&
    snapshot.workspace_id === metadata.workspace_id &&
    snapshot.bot_id === metadata.bot_id &&
    snapshot.owner_agent_id === metadata.owner_agent_id &&
    snapshot.deployment_environment === metadata.deployment_environment &&
    snapshot.release_channel === metadata.release_channel
  );
}

function hasExplicitIncompleteRedaction(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  return value.some(
    (candidate) =>
      typeof candidate === "object" &&
      candidate !== null &&
      "redaction_state" in candidate &&
      candidate.redaction_state !== "not_required" &&
      candidate.redaction_state !== "complete",
  );
}

function manifestHash(snapshot: TriggerProcessSnapshotV1): string {
  const manifest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(snapshot)) {
    if (key !== "snapshot_hash") manifest[key] = value;
  }
  return `sha256:${createHash("sha256")
    .update(canonicalJsonV1(manifest), "utf8")
    .digest("hex")}`;
}

function fail(
  code: TriggerProcessSnapshotResolveErrorCodeV1,
  cause?: unknown,
): never {
  throw new TriggerProcessSnapshotResolveErrorV1(code, {
    ...(cause === undefined ? {} : { cause }),
  });
}

export function createTriggerProcessSnapshotReadApplicationV1(
  repository: TriggerProcessSnapshotMetadataRepositoryV1,
  materializer: TriggerProcessSnapshotMaterializerV1,
  options: Readonly<{ now?: () => Date }> = {},
): TriggerProcessSnapshotReadApplicationV1 {
  const readExactSnapshot = captureMethodV1<
    TriggerProcessSnapshotMetadataRepositoryV1["readExactSnapshot"]
  >(repository, "readExactSnapshot", "snapshot metadata repository");
  const materialize = captureMethodV1<
    TriggerProcessSnapshotMaterializerV1["materialize"]
  >(materializer, "materialize", "snapshot materializer");
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
        fail("snapshot_schema_incompatible");
      }
      const milliseconds = Reflect.apply(
        Date.prototype.getTime,
        candidate,
        [],
      ) as number;
      if (!Number.isFinite(milliseconds)) {
        fail("snapshot_schema_incompatible");
      }
      return new Date(milliseconds);
    } catch (error) {
      if (error instanceof TriggerProcessSnapshotResolveErrorV1) throw error;
      fail("snapshot_schema_incompatible", error);
    }
  };

  return Object.freeze({
    async resolve(
      principalValue: TriggerProcessSnapshotResolvePrincipalV1,
      requestValue: unknown,
    ) {
      let request: TriggerProcessSnapshotResolveRequestV1;
      try {
        request =
          canonicalDeepSnapshotV1<TriggerProcessSnapshotResolveRequestV1>(
            requestValue,
          );
      } catch (error) {
        fail("snapshot_schema_incompatible", error);
      }
      if (!Value.Check(TriggerProcessSnapshotResolveRequestV1Schema, request)) {
        fail("snapshot_schema_incompatible");
      }
      const principal = principalSnapshotV1(principalValue);
      if (
        principal.capability !== "trigger.process.snapshot.resolve" ||
        !ALLOWED_CALLER_BY_PURPOSE[request.purpose]?.has(principal.service_id) ||
        !scopeMatches(principal.scope, request)
      ) {
        fail("snapshot_scope_mismatch");
      }

      const rawRead = await readExactSnapshot(
        Object.freeze({
          trigger_process_id: request.trigger_process_id,
          snapshot_ref: request.snapshot_ref,
        }),
      );
      let read: TriggerProcessSnapshotMetadataReadV1;
      try {
        read =
          canonicalDeepSnapshotV1<TriggerProcessSnapshotMetadataReadV1>(
            rawRead,
          );
      } catch (error) {
        fail("snapshot_schema_incompatible", error);
      }
      if (
        typeof read !== "object" ||
        read === null ||
        (read.outcome !== "not_found" && read.outcome !== "found")
      ) {
        fail("snapshot_schema_incompatible");
      }
      if (read.outcome === "not_found") fail("snapshot_not_found");
      const metadata = read.metadata;
      if (!validMetadataV1(metadata)) {
        fail("snapshot_schema_incompatible");
      }
      if (!metadataScopeMatches(metadata, request)) {
        fail("snapshot_scope_mismatch");
      }
      if (
        metadata.snapshot_version !== request.expected_snapshot_version ||
        metadata.snapshot_hash !== request.expected_snapshot_hash
      ) {
        fail("snapshot_hash_mismatch");
      }
      if (
        metadata.status === "expired" ||
        Date.parse(metadata.retention_until) <= readNow().getTime()
      ) {
        fail("snapshot_expired");
      }
      if (
        metadata.status === "invalid" ||
        metadata.schema_version !== "trigger_process_snapshot.v1"
      ) {
        fail("snapshot_schema_incompatible");
      }
      if (
        metadata.overflow_refs.some(
          (overflow) =>
            overflow.redaction_state !== "not_required" &&
            overflow.redaction_state !== "complete",
        )
      ) {
        fail("snapshot_redaction_incomplete");
      }

      let rawMaterialized: Awaited<
        ReturnType<TriggerProcessSnapshotMaterializerV1["materialize"]>
      >;
      try {
        rawMaterialized = await materialize(
          Object.freeze({
            metadata,
            purpose: request.purpose,
            trace_id: request.trace_id,
          }),
        );
      } catch (error) {
        fail("snapshot_overflow_unreadable", error);
      }
      let materialized: Awaited<
        ReturnType<TriggerProcessSnapshotMaterializerV1["materialize"]>
      >;
      try {
        materialized = canonicalDeepSnapshotV1(rawMaterialized);
      } catch (error) {
        fail("snapshot_schema_incompatible", error);
      }
      if (
        typeof materialized !== "object" ||
        materialized === null ||
        !Object.hasOwn(materialized, "snapshot_manifest") ||
        !Object.hasOwn(materialized, "content_chunks")
      ) {
        fail("snapshot_schema_incompatible");
      }
      const rawManifest = materialized.snapshot_manifest;
      if (
        typeof rawManifest === "object" &&
        rawManifest !== null &&
        "overflow_refs" in rawManifest &&
        hasExplicitIncompleteRedaction(rawManifest.overflow_refs)
      ) {
        fail("snapshot_redaction_incomplete");
      }
      if (hasExplicitIncompleteRedaction(materialized.content_chunks)) {
        fail("snapshot_redaction_incomplete");
      }
      if (
        !Value.Check(
          TriggerProcessSnapshotV1Schema,
          materialized.snapshot_manifest,
        ) ||
        !Array.isArray(materialized.content_chunks)
      ) {
        fail("snapshot_schema_incompatible");
      }
      const snapshot = materialized.snapshot_manifest as TriggerProcessSnapshotV1;
      if (!manifestScopeMatchesMetadata(snapshot, metadata)) {
        fail("snapshot_scope_mismatch");
      }
      try {
        assertTriggerProcessSnapshotSemanticBindingsV1(snapshot);
      } catch (error) {
        fail("snapshot_range_gap", error);
      }
      if (
        manifestHash(snapshot) !== snapshot.snapshot_hash ||
        snapshot.snapshot_hash !== metadata.snapshot_hash ||
        snapshot.snapshot_id !== metadata.snapshot_id ||
        snapshot.input_event_range.first_append_sequence_no !==
          metadata.first_append_sequence_no ||
        snapshot.input_event_range.last_append_sequence_no !==
          metadata.last_append_sequence_no ||
        snapshot.snapshot_retention_until !== metadata.retention_until ||
        canonicalJsonV1(snapshot.overflow_refs) !==
          canonicalJsonV1(metadata.overflow_refs)
      ) {
        fail("snapshot_hash_mismatch");
      }

      const resolvedAt = readNow();
      if (Date.parse(metadata.retention_until) <= resolvedAt.getTime()) {
        fail("snapshot_expired");
      }
      let result: TriggerProcessSnapshotReadContractV1;
      try {
        result = canonicalDeepSnapshotV1<TriggerProcessSnapshotReadContractV1>({
          schema_version: "trigger_process_snapshot_read.v1" as const,
          snapshot_ref: metadata.snapshot_ref,
          snapshot_manifest: snapshot,
          content_chunks:
            materialized.content_chunks as readonly TriggerProcessSnapshotContentChunkV1[],
          resolved_at: resolvedAt.toISOString(),
        });
      } catch (error) {
        fail("snapshot_schema_incompatible", error);
      }
      if (!Value.Check(TriggerProcessSnapshotReadContractV1Schema, result)) {
        fail("snapshot_schema_incompatible");
      }
      for (const chunk of result.content_chunks) {
        if (
          "inline_content" in chunk &&
          `sha256:${createHash("sha256")
            .update(canonicalJsonV1(chunk.inline_content), "utf8")
            .digest("hex")}` !== chunk.checksum
        ) {
          fail("snapshot_overflow_unreadable");
        }
      }
      try {
        assertTriggerProcessSnapshotReadBindingsV1(request, result);
      } catch (error) {
        fail("snapshot_range_gap", error);
      }
      return result;
    },
  });
}
