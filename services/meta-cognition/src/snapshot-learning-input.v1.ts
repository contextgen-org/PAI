import {
  TriggerProcessSnapshotReadContractV1Schema,
  TriggerProcessSnapshotV1Schema,
  assertTriggerProcessSnapshotReadBindingsV1,
  assertTriggerProcessSnapshotSemanticBindingsV1,
  type TriggerProcessSnapshotReadContractV1,
  type TriggerProcessSnapshotResolveRequestV1,
  type TriggerProcessSnapshotV1,
} from "@pai/contracts";
import { Value } from "@sinclair/typebox/value";

import {
  assertBoundedMetaJsonV1,
  assertNoRuntimeTokenV1,
  canonicalJsonV1,
} from "./canonical.v1.js";
import type { MetaCognitionConfigV1 } from "./config.v1.js";
import {
  MetaCognitionErrorV1,
  type MetaEvidenceArtifactV1,
  type MetaJobRecordV1,
} from "./meta-types.v1.js";
import { isPlainDataRecordV1, sameMetaScopeV1 } from "./validation.v1.js";
import { createHash } from "node:crypto";

export interface MetaSnapshotLearningInputV1 {
  readonly request: TriggerProcessSnapshotResolveRequestV1;
  readonly read: TriggerProcessSnapshotReadContractV1;
  readonly allowed_evidence_refs: ReadonlySet<string>;
  readonly evidence_artifacts: readonly MetaEvidenceArtifactV1[];
  readonly prompt: string;
}

function invalidSnapshot(message: string, cause?: unknown): never {
  throw new MetaCognitionErrorV1(
    "snapshot_invalid",
    message,
    false,
    { ...(cause === undefined ? {} : { cause }) },
  );
}

export function snapshotResolveRequestForJobV1(
  job: MetaJobRecordV1,
): TriggerProcessSnapshotResolveRequestV1 {
  return Object.freeze({
    schema_version: "trigger_process_snapshot_resolve_request.v1",
    trigger_process_id: job.trigger_process_id,
    workspace_id: job.workspace_id,
    bot_id: job.bot_id,
    owner_agent_id: job.owner_agent_id,
    deployment_environment: job.deployment_environment,
    release_channel: job.release_channel,
    snapshot_ref: job.snapshot_ref,
    expected_snapshot_version: job.snapshot_version,
    expected_snapshot_hash: job.snapshot_hash,
    purpose: "meta_learning",
    trace_id: job.trace_id,
  });
}

function snapshotManifestV1(
  value: unknown,
): TriggerProcessSnapshotV1 {
  if (
    !isPlainDataRecordV1(value) ||
    !Value.Check(TriggerProcessSnapshotV1Schema, value)
  ) {
    invalidSnapshot("Trigger Process snapshot manifest shape is invalid");
  }
  return value;
}

function sha256CanonicalJsonV1(value: unknown): `sha256:${string}` {
  return `sha256:${createHash("sha256")
    .update(canonicalJsonV1(value), "utf8")
    .digest("hex")}`;
}

function snapshotManifestHashV1(
  snapshot: TriggerProcessSnapshotV1,
): `sha256:${string}` {
  return sha256CanonicalJsonV1(
    Object.fromEntries(
      Object.entries(snapshot).filter(([key]) => key !== "snapshot_hash"),
    ),
  );
}

function evidenceArtifacts(
  snapshot: TriggerProcessSnapshotV1,
  job: MetaJobRecordV1,
): readonly MetaEvidenceArtifactV1[] {
  const bindings = new Map<string, `sha256:${string}`>();
  const add = (ref: string, hash: string) => {
    if (!/^sha256:[0-9a-f]{64}$/u.test(hash)) {
      invalidSnapshot("Trigger Process evidence hash is invalid");
    }
    const prior = bindings.get(ref);
    if (prior !== undefined && prior !== hash) {
      invalidSnapshot("Trigger Process evidence ref has conflicting hashes");
    }
    bindings.set(ref, hash as `sha256:${string}`);
  };
  add(`trigger_process:${snapshot.trigger_process_id}`, snapshot.snapshot_hash);
  add(`trigger_event:${snapshot.trigger.trigger_id}`, snapshot.trigger.payload_hash);
  add(`artifact:${job.snapshot_ref}`, snapshot.snapshot_hash);
  add(`artifact:${snapshot.snapshot_id}`, snapshot.snapshot_hash);
  add(`artifact:${snapshot.trigger.payload_ref}`, snapshot.trigger.payload_hash);
  const addEntry = (entry: Readonly<Record<string, unknown>>) => {
    const sourceService = entry.source_service;
    const sourceEventId = entry.source_event_id;
    const payloadHash = entry.payload_hash;
    if (
      typeof sourceService === "string" &&
      typeof sourceEventId === "string" &&
      typeof payloadHash === "string"
    ) {
      add(`system_event:${sourceService}:${sourceEventId}`, payloadHash);
    }
    const payloadRef = entry.payload_ref;
    if (typeof payloadRef === "string" && typeof payloadHash === "string") {
      add(`artifact:${payloadRef}`, payloadHash);
    }
    const artifactRefs = entry.artifact_refs;
    if (Array.isArray(artifactRefs) && typeof payloadHash === "string") {
      for (const artifactRef of artifactRefs) {
        if (typeof artifactRef === "string") {
          add(`artifact:${artifactRef}`, payloadHash);
        }
      }
    }
    const toolInvocationId = entry.tool_invocation_id;
    if (typeof toolInvocationId === "string" && typeof payloadHash === "string") {
      add(`tool_result:${toolInvocationId}`, payloadHash);
    }
  };
  for (const entry of snapshot.event_trace) {
    addEntry(entry as unknown as Readonly<Record<string, unknown>>);
  }
  for (const entry of snapshot.action_trace) {
    addEntry(entry as unknown as Readonly<Record<string, unknown>>);
  }
  for (const entry of snapshot.tool_results) {
    addEntry(entry as unknown as Readonly<Record<string, unknown>>);
  }
  for (const overflow of snapshot.overflow_refs) {
    add(`artifact:${overflow.object_ref}`, overflow.checksum);
  }
  return Object.freeze(
    [...bindings.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([ref, hash]) => Object.freeze({ ref: ref as MetaEvidenceArtifactV1["ref"], hash })),
  );
}

export function validateSnapshotLearningInputV1(
  job: MetaJobRecordV1,
  readValue: unknown,
  config: MetaCognitionConfigV1,
  now: Date,
): MetaSnapshotLearningInputV1 {
  try {
    assertBoundedMetaJsonV1(readValue, {
      max_bytes: config.max_prompt_bytes,
    });
  } catch (error) {
    invalidSnapshot(
      "Trigger Process snapshot exceeds its bounded JSON contract",
      error,
    );
  }
  if (
    !isPlainDataRecordV1(readValue) ||
    !Value.Check(TriggerProcessSnapshotReadContractV1Schema, readValue) ||
    readValue.snapshot_ref !== job.snapshot_ref ||
    !Number.isFinite(Date.parse(readValue.resolved_at))
  ) {
    invalidSnapshot("Trigger Process snapshot read envelope is invalid");
  }
  const snapshot = snapshotManifestV1(readValue.snapshot_manifest);
  const read = readValue as unknown as TriggerProcessSnapshotReadContractV1;
  const request = snapshotResolveRequestForJobV1(job);
  try {
    assertTriggerProcessSnapshotSemanticBindingsV1(snapshot);
    assertTriggerProcessSnapshotReadBindingsV1(request, read);
  } catch (error) {
    invalidSnapshot("Trigger Process snapshot binding is invalid", error);
  }
  if (
    !sameMetaScopeV1(job, snapshot) ||
    snapshot.snapshot_version !== job.snapshot_version ||
    snapshot.snapshot_hash !== job.snapshot_hash ||
    snapshotManifestHashV1(snapshot) !== snapshot.snapshot_hash ||
    snapshot.snapshot_retention_until !== job.snapshot_retention_until ||
    snapshot.cooldown_until !== job.cooldown_until ||
    snapshot.boundary_system_event_ref !== job.boundary_system_event_ref ||
    Date.parse(snapshot.snapshot_retention_until) <= now.getTime() ||
    snapshot.overflow_refs.some(
      (entry) =>
        entry.redaction_state !== "complete" &&
        entry.redaction_state !== "not_required",
    ) ||
    read.content_chunks.some(
      (entry) =>
        entry.redaction_state !== "complete" &&
        entry.redaction_state !== "not_required" ||
        ("inline_content" in entry &&
          sha256CanonicalJsonV1(entry.inline_content) !== entry.checksum),
    )
  ) {
    invalidSnapshot("Trigger Process snapshot owner facts drifted");
  }
  try {
    assertNoRuntimeTokenV1(read);
  } catch (error) {
    invalidSnapshot("Trigger Process snapshot contains runtime.token", error);
  }
  const artifactBindings = evidenceArtifacts(snapshot, job);
  const allowedEvidenceRefs = new Set(
    artifactBindings.map(({ ref }) => ref),
  );
  if (
    allowedEvidenceRefs.size < 1 ||
    allowedEvidenceRefs.size > config.max_evidence_refs
  ) {
    invalidSnapshot("Trigger Process snapshot evidence set is outside limits");
  }
  const prompt = canonicalJsonV1({
    schema_version: "meta_learning_prompt.v1",
    purpose: "derive_experience_and_durable_candidates",
    snapshot_ref: job.snapshot_ref,
    snapshot_version: job.snapshot_version,
    snapshot_hash: job.snapshot_hash,
    scope: {
      workspace_id: job.workspace_id,
      bot_id: job.bot_id,
      owner_agent_id: job.owner_agent_id,
      deployment_environment: job.deployment_environment,
      release_channel: job.release_channel,
    },
    snapshot_manifest: snapshot,
    content_chunks: read.content_chunks,
    allowed_evidence_refs: [...allowedEvidenceRefs].sort(),
  });
  if (Buffer.byteLength(prompt, "utf8") > config.max_prompt_bytes) {
    invalidSnapshot("Meta learning prompt exceeds its byte budget");
  }
  return Object.freeze({
    request,
    read,
    allowed_evidence_refs: allowedEvidenceRefs,
    evidence_artifacts: artifactBindings,
    prompt,
  });
}
