import { createHash } from "node:crypto";

import type { SnapshotOverflowRefV1 } from "@pai/contracts";
import { canonicalJsonV1 } from "@pai/eventing";
import type { ObjectRefV1 } from "@pai/object-store";
import { describe, expect, it, vi } from "vitest";

import { createObjectStoreTriggerProcessSnapshotMaterializerV1 } from "../src/application/process-snapshot-object-store-materializer.v1.js";
import type { TriggerProcessSnapshotMetadataV1 } from "../src/application/process-snapshot-read.v1.js";

const at = "2026-07-30T00:00:00.000Z";
const retention = "2026-08-30T00:00:00.000Z";

function hash(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

async function* body(bytes: Uint8Array): AsyncIterable<Uint8Array> {
  yield bytes;
}

function fixture() {
  const event = {
    source_service: "trigger_processor" as const,
    append_sequence_no: 1,
    source_event_id: "event-1",
  };
  const manifest = { event_trace: [event] };
  const manifestBytes = Buffer.from(canonicalJsonV1(manifest), "utf8");
  const overflowBytes = Buffer.from("owner durable bytes", "utf8");
  const metadata: TriggerProcessSnapshotMetadataV1 = {
    snapshot_id: "snapshot-1",
    trigger_process_id: "process-1",
    workspace_id: "workspace-1",
    bot_id: "bot-1",
    owner_agent_id: "agent-1",
    deployment_environment: "dev",
    release_channel: "stable",
    schema_version: "trigger_process_snapshot.v1",
    snapshot_version: 1,
    snapshot_hash: `sha256:${"a".repeat(64)}`,
    snapshot_ref: "snapshot-ref:1",
    first_append_sequence_no: 1,
    last_append_sequence_no: 2,
    status: "current",
    retention_until: retention,
    overflow_refs: [
      {
        schema_version: "snapshot_overflow_ref.v1",
        source_service: "action_runtime",
        store_type: "runtime_events",
        object_ref: "runtime-event-ref:2",
        first_append_sequence_no: 2,
        last_append_sequence_no: 2,
        source_sequence_range: {
          first_source_sequence_no: 2,
          last_source_sequence_no: 2,
        },
        checksum_algorithm: "sha256",
        checksum: hash(overflowBytes),
        retention_until: retention,
        redaction_state: "complete",
      },
    ],
  };
  const getStream = vi.fn(async (request: Readonly<{ object_ref: string }>) => {
    const bytes = manifestBytes;
    return {
      object_ref: request.object_ref as ObjectRefV1,
      version: "1",
      sha256: hash(bytes),
      size_bytes: bytes.byteLength,
      media_type: "application/json",
      retention_until: retention,
      body: body(bytes),
    };
  });
  const overflowReader = {
    read: vi.fn(async (request: Readonly<{
      overflow_ref: SnapshotOverflowRefV1;
    }>) => ({
      owner_evidence: request.overflow_ref,
      object_ref: request.overflow_ref.object_ref,
      version: "1",
      sha256: hash(overflowBytes),
      size_bytes: overflowBytes.byteLength,
      media_type: "application/octet-stream",
      retention_until: retention,
      body: body(overflowBytes),
    })),
  };
  const decisions = {
    resolve: vi.fn(async () => ({
      access_decision_ref: "decision-1",
      retention_policy_version: "retention-v1",
      redaction_policy_version: "redaction-v1",
    })),
  };
  return {
    metadata,
    manifest,
    manifestBytes,
    overflowBytes,
    getStream,
    overflowReader,
    decisions,
  };
}

describe("ObjectStore-backed Trigger Process snapshot materializer", () => {
  it("reads canonical TP manifest bytes and verifies every owner overflow object", async () => {
    const value = fixture();
    const materializer = createObjectStoreTriggerProcessSnapshotMaterializerV1(
      { getStream: value.getStream } as never,
      value.decisions,
      value.overflowReader,
      { now: () => new Date(at) },
    );
    const result = await materializer.materialize({
      metadata: value.metadata,
      purpose: "meta_learning",
      trace_id: "trace-1",
    });
    expect(result.snapshot_manifest).toEqual(value.manifest);
    expect(result.content_chunks).toEqual([
      expect.objectContaining({
        first_append_sequence_no: 1,
        inline_content: value.manifest.event_trace[0],
      }),
      expect.objectContaining({
        first_append_sequence_no: 2,
        owner_content_ref: "runtime-event-ref:2",
        checksum: hash(value.overflowBytes),
      }),
    ]);
    expect(value.getStream).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        owner_service: "trigger_processor",
        object_ref: "snapshot-ref:1",
        capability: "trigger_process.snapshot.resolve",
      }),
    );
    expect(value.overflowReader.read).toHaveBeenCalledWith(
      expect.objectContaining({
        overflow_ref: expect.objectContaining({
          source_service: "action_runtime",
          store_type: "runtime_events",
          object_ref: "runtime-event-ref:2",
        }),
      }),
    );
    expect(value.getStream).toHaveBeenCalledTimes(1);
    expect(value.decisions.resolve).toHaveBeenCalledTimes(1);
  });

  it("routes durable-owner and artifact-store overflows through owner boundaries instead of inventing ObjectStore ownership", async () => {
    const value = fixture();
    const artifactBytes = Buffer.from("skill artifact bytes", "utf8");
    const metadata = structuredClone(value.metadata);
    metadata.last_append_sequence_no = 3;
    metadata.overflow_refs.push({
      schema_version: "snapshot_overflow_ref.v1",
      source_service: "skill_registry",
      store_type: "artifact_store",
      object_ref: "skill-artifact-ref:3",
      first_append_sequence_no: 3,
      last_append_sequence_no: 3,
      source_sequence_range: {
        first_source_sequence_no: 7,
        last_source_sequence_no: 7,
      },
      checksum_algorithm: "sha256",
      checksum: hash(artifactBytes),
      retention_until: retention,
      redaction_state: "complete",
    });
    value.overflowReader.read.mockImplementation(
      async (request: Readonly<{
        overflow_ref: SnapshotOverflowRefV1;
      }>) => {
        const bytes =
          request.overflow_ref.object_ref === "skill-artifact-ref:3"
            ? artifactBytes
            : value.overflowBytes;
        return {
          owner_evidence: request.overflow_ref,
          object_ref: request.overflow_ref.object_ref,
          version: "owner-version-1",
          sha256: hash(bytes),
          size_bytes: bytes.byteLength,
          media_type: "application/octet-stream",
          retention_until: retention,
          body: body(bytes),
        };
      },
    );

    await expect(
      createObjectStoreTriggerProcessSnapshotMaterializerV1(
        { getStream: value.getStream } as never,
        value.decisions,
        value.overflowReader,
        { now: () => new Date(at) },
      ).materialize({
        metadata,
        purpose: "repair",
        trace_id: "trace-owner-routing",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        content_chunks: expect.arrayContaining([
          expect.objectContaining({
            owner_content_ref: "runtime-event-ref:2",
          }),
          expect.objectContaining({
            owner_content_ref: "skill-artifact-ref:3",
          }),
        ]),
      }),
    );
    expect(value.getStream).toHaveBeenCalledTimes(1);
    expect(value.overflowReader.read).toHaveBeenCalledTimes(2);
    expect(value.overflowReader.read).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        overflow_ref: expect.objectContaining({
          source_service: "skill_registry",
          store_type: "artifact_store",
          object_ref: "skill-artifact-ref:3",
        }),
      }),
    );
  });

  it("rejects a source/store confused-deputy reference before any owner I/O", async () => {
    const value = fixture();
    const metadata = structuredClone(value.metadata);
    metadata.overflow_refs[0]!.source_service = "memory";

    await expect(
      createObjectStoreTriggerProcessSnapshotMaterializerV1(
        { getStream: value.getStream } as never,
        value.decisions,
        value.overflowReader,
        { now: () => new Date(at) },
      ).materialize({
        metadata,
        purpose: "repair",
        trace_id: "trace-confused-deputy",
      }),
    ).rejects.toThrow(/metadata is invalid/u);
    expect(value.getStream).not.toHaveBeenCalled();
    expect(value.decisions.resolve).not.toHaveBeenCalled();
    expect(value.overflowReader.read).not.toHaveBeenCalled();
  });

  it("rejects non-canonical manifests and owner checksum drift", async () => {
    const nonCanonical = fixture();
    const prettyBytes = Buffer.from(
      JSON.stringify(nonCanonical.manifest, null, 2),
      "utf8",
    );
    nonCanonical.getStream.mockResolvedValueOnce({
      object_ref: "snapshot-ref:1" as ObjectRefV1,
      version: "1",
      sha256: hash(prettyBytes),
      size_bytes: prettyBytes.byteLength,
      media_type: "application/json",
      retention_until: retention,
      body: body(prettyBytes),
    });
    await expect(
      createObjectStoreTriggerProcessSnapshotMaterializerV1(
        { getStream: nonCanonical.getStream } as never,
        nonCanonical.decisions,
        nonCanonical.overflowReader,
        { now: () => new Date(at) },
      ).materialize({
        metadata: nonCanonical.metadata,
        purpose: "diagnostic",
        trace_id: "trace-1",
      }),
    ).rejects.toThrow(/canonical JSON/u);

    const drift = fixture();
    drift.getStream.mockResolvedValueOnce({
      object_ref: "snapshot-ref:1" as ObjectRefV1,
      version: "1",
      sha256: hash(drift.manifestBytes),
      size_bytes: drift.manifestBytes.byteLength,
      media_type: "application/json",
      retention_until: retention,
      body: body(drift.manifestBytes),
    });
    drift.overflowReader.read.mockResolvedValueOnce({
        owner_evidence: drift.metadata.overflow_refs[0]!,
        object_ref: "runtime-event-ref:2",
        version: "2",
        sha256: `sha256:${"f".repeat(64)}`,
        size_bytes: drift.overflowBytes.byteLength,
        media_type: "application/octet-stream",
        retention_until: retention,
        body: body(drift.overflowBytes),
      });
    await expect(
      createObjectStoreTriggerProcessSnapshotMaterializerV1(
        { getStream: drift.getStream } as never,
        drift.decisions,
        drift.overflowReader,
        { now: () => new Date(at) },
      ).materialize({
        metadata: drift.metadata,
        purpose: "repair",
        trace_id: "trace-2",
      }),
    ).rejects.toThrow(/metadata is invalid|physical hash mismatch/u);

    const evidenceDrift = fixture();
    evidenceDrift.overflowReader.read.mockImplementationOnce(
      async (request) => ({
        owner_evidence: {
          ...request.overflow_ref,
          redaction_state: "not_required",
        },
        object_ref: request.overflow_ref.object_ref,
        version: "owner-version-2",
        sha256: hash(evidenceDrift.overflowBytes),
        size_bytes: evidenceDrift.overflowBytes.byteLength,
        media_type: "application/octet-stream",
        retention_until: retention,
        body: body(evidenceDrift.overflowBytes),
      }),
    );
    await expect(
      createObjectStoreTriggerProcessSnapshotMaterializerV1(
        { getStream: evidenceDrift.getStream } as never,
        evidenceDrift.decisions,
        evidenceDrift.overflowReader,
        { now: () => new Date(at) },
      ).materialize({
        metadata: evidenceDrift.metadata,
        purpose: "repair",
        trace_id: "trace-owner-evidence-drift",
      }),
    ).rejects.toThrow(/metadata is invalid/u);
  });

  it("detaches its request/result across awaits and captures dependency methods", async () => {
    const value = fixture();
    const mutableMetadata = structuredClone(value.metadata);
    let releaseManifestBody!: () => void;
    let markManifestBodyStarted!: () => void;
    const manifestBodyStarted = new Promise<void>((resolve) => {
      markManifestBodyStarted = resolve;
    });
    const manifestBodyGate = new Promise<void>((resolve) => {
      releaseManifestBody = resolve;
    });
    const manifestResult = {
      object_ref: value.metadata.snapshot_ref as ObjectRefV1,
      version: "1",
      sha256: hash(value.manifestBytes),
      size_bytes: value.manifestBytes.byteLength,
      media_type: "application/json",
      retention_until: retention,
      body: (async function* () {
        markManifestBodyStarted();
        await manifestBodyGate;
        yield value.manifestBytes;
      })(),
    };
    const originalGetStream = vi.fn(async () => manifestResult);
    const originalOverflowRead = vi.fn(
      async (request: Readonly<{
        overflow_ref: SnapshotOverflowRefV1;
      }>) => ({
        owner_evidence: request.overflow_ref,
        object_ref: request.overflow_ref.object_ref,
        version: "1",
        sha256: hash(value.overflowBytes),
        size_bytes: value.overflowBytes.byteLength,
        media_type: "application/octet-stream",
        retention_until: retention,
        body: body(value.overflowBytes),
      }),
    );
    const originalDecision = vi.fn(async () => ({
      access_decision_ref: "decision-1",
      retention_policy_version: "retention-v1",
      redaction_policy_version: "redaction-v1",
    }));
    const objectStore = { getStream: originalGetStream };
    const decisions = { resolve: originalDecision };
    const overflowReader = { read: originalOverflowRead };
    const materializer = createObjectStoreTriggerProcessSnapshotMaterializerV1(
      objectStore as never,
      decisions,
      overflowReader,
      { now: () => new Date(at) },
    );
    objectStore.getStream = vi
      .fn()
      .mockRejectedValue(new Error("method swapped"));
    decisions.resolve = vi
      .fn()
      .mockRejectedValue(new Error("method swapped"));
    overflowReader.read = vi
      .fn()
      .mockRejectedValue(new Error("method swapped"));
    const mutableRequest = {
      metadata: mutableMetadata,
      purpose: "meta_learning" as const,
      trace_id: "trace-1",
    };

    const pending = materializer.materialize(mutableRequest);
    await manifestBodyStarted;
    Reflect.set(mutableRequest, "purpose", "diagnostic");
    Reflect.set(mutableRequest, "trace_id", "trace-mutated");
    Reflect.set(mutableMetadata, "snapshot_ref", "snapshot-ref:mutated");
    Reflect.set(mutableMetadata, "bot_id", "bot-mutated");
    Reflect.set(
      mutableMetadata.overflow_refs[0]!,
      "object_ref",
      "overflow-ref:mutated",
    );
    Reflect.set(manifestResult, "size_bytes", 1);
    Reflect.set(manifestResult, "sha256", `sha256:${"f".repeat(64)}`);
    Reflect.set(manifestResult, "retention_until", at);
    Reflect.set(manifestResult, "body", body(Buffer.from("{}")));
    releaseManifestBody();

    const result = await pending;
    expect(originalDecision).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        object_ref: "snapshot-ref:1",
        purpose: "meta_learning",
        trace_id: "trace-1",
        metadata: expect.objectContaining({ bot_id: "bot-1" }),
      }),
    );
    expect(originalOverflowRead).toHaveBeenCalledWith(
      expect.objectContaining({
        overflow_ref: expect.objectContaining({
          object_ref: "runtime-event-ref:2",
        }),
      }),
    );
    expect(originalGetStream).toHaveBeenCalledTimes(1);
    expect(result.snapshot_manifest).toEqual(value.manifest);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.snapshot_manifest)).toBe(true);
    expect(Object.isFrozen(result.content_chunks[0]!)).toBe(true);
  });

  it("rejects Proxy/accessor owner boundaries without executing accessors", async () => {
    const value = fixture();
    const untouchedDecisions = {
      resolve: vi.fn(async () => ({
        access_decision_ref: "decision-1",
        retention_policy_version: "retention-v1",
        redaction_policy_version: "redaction-v1",
      })),
    };
    const inputApplication =
      createObjectStoreTriggerProcessSnapshotMaterializerV1(
        { getStream: value.getStream } as never,
        untouchedDecisions,
        value.overflowReader,
        { now: () => new Date(at) },
      );
    await expect(
      inputApplication.materialize(
        new Proxy(
          {
            metadata: value.metadata,
            purpose: "meta_learning" as const,
            trace_id: "trace-1",
          },
          {},
        ),
      ),
    ).rejects.toThrow(/request is invalid/u);
    expect(untouchedDecisions.resolve).not.toHaveBeenCalled();

    let decisionReads = 0;
    const accessorDecision = Object.create(null) as Record<string, unknown>;
    Object.defineProperties(accessorDecision, {
      access_decision_ref: {
        enumerable: true,
        get() {
          decisionReads += 1;
          return "decision-1";
        },
      },
      retention_policy_version: {
        value: "retention-v1",
        enumerable: true,
      },
      redaction_policy_version: {
        value: "redaction-v1",
        enumerable: true,
      },
    });
    const accessorDecisionApplication =
      createObjectStoreTriggerProcessSnapshotMaterializerV1(
        { getStream: value.getStream } as never,
        { async resolve() { return accessorDecision as never; } },
        value.overflowReader,
        { now: () => new Date(at) },
      );
    await expect(
      accessorDecisionApplication.materialize({
        metadata: value.metadata,
        purpose: "meta_learning",
        trace_id: "trace-1",
      }),
    ).rejects.toThrow(/decision is invalid/u);
    expect(decisionReads).toBe(0);

    let retentionReads = 0;
    const accessorMetadata = Object.create(null) as Record<string, unknown>;
    Object.defineProperties(accessorMetadata, {
      object_ref: {
        value: value.metadata.snapshot_ref as ObjectRefV1,
        enumerable: true,
      },
      version: { value: "1", enumerable: true },
      sha256: { value: hash(value.manifestBytes), enumerable: true },
      size_bytes: {
        value: value.manifestBytes.byteLength,
        enumerable: true,
      },
      media_type: { value: "application/json", enumerable: true },
      retention_until: {
        enumerable: true,
        get() {
          retentionReads += 1;
          return retention;
        },
      },
      body: { value: body(value.manifestBytes), enumerable: true },
    });
    const accessorMetadataApplication =
      createObjectStoreTriggerProcessSnapshotMaterializerV1(
        { async getStream() { return accessorMetadata as never; } } as never,
        value.decisions,
        value.overflowReader,
        { now: () => new Date(at) },
      );
    await expect(
      accessorMetadataApplication.materialize({
        metadata: value.metadata,
        purpose: "meta_learning",
        trace_id: "trace-1",
      }),
    ).rejects.toThrow(/metadata is invalid/u);
    expect(retentionReads).toBe(0);

    const proxyChunkApplication =
      createObjectStoreTriggerProcessSnapshotMaterializerV1(
        {
          async getStream(request: Readonly<{ object_ref: string }>) {
            const bytes =
              request.object_ref === value.metadata.snapshot_ref
                ? value.manifestBytes
                : value.overflowBytes;
            return {
              object_ref: request.object_ref as ObjectRefV1,
              version: "1",
              sha256: hash(bytes),
              size_bytes: bytes.byteLength,
              media_type:
                request.object_ref === value.metadata.snapshot_ref
                  ? "application/json"
                  : "application/octet-stream",
              retention_until: retention,
              body: (async function* () {
                yield new Proxy(Uint8Array.from(bytes), {});
              })(),
            };
          },
        } as never,
        value.decisions,
        value.overflowReader,
        { now: () => new Date(at) },
      );
    await expect(
      proxyChunkApplication.materialize({
        metadata: value.metadata,
        purpose: "meta_learning",
        trace_id: "trace-1",
      }),
    ).rejects.toThrow(/invalid bytes/u);
  });

  it("fails closed when the injected materializer clock is invalid", async () => {
    const value = fixture();
    const materializer = createObjectStoreTriggerProcessSnapshotMaterializerV1(
      { getStream: value.getStream } as never,
      value.decisions,
      value.overflowReader,
      { now: () => new Date(Number.NaN) },
    );
    await expect(
      materializer.materialize({
        metadata: value.metadata,
        purpose: "meta_learning",
        trace_id: "trace-1",
      }),
    ).rejects.toThrow(/clock is invalid/u);

    const expires = fixture();
    let clockReads = 0;
    await expect(
      createObjectStoreTriggerProcessSnapshotMaterializerV1(
        { getStream: expires.getStream } as never,
        expires.decisions,
        expires.overflowReader,
        {
          now: () =>
            new Date(clockReads++ === 0 ? at : retention),
        },
      ).materialize({
        metadata: expires.metadata,
        purpose: "meta_learning",
        trace_id: "trace-expiry",
      }),
    ).rejects.toThrow(/expired during read/u);
  });

  it("does not expose mutable options as clock this and validates ObjectStore version", async () => {
    const value = fixture();
    let clockReceiver: unknown = "not-called";
    const materializer = createObjectStoreTriggerProcessSnapshotMaterializerV1(
      { getStream: value.getStream } as never,
      value.decisions,
      value.overflowReader,
      {
        now: function (this: unknown) {
          clockReceiver = this;
          return new Date(at);
        },
      },
    );
    await expect(
      materializer.materialize({
        metadata: value.metadata,
        purpose: "meta_learning",
        trace_id: "trace-1",
      }),
    ).resolves.toBeDefined();
    expect(clockReceiver).toBeUndefined();

    const invalidVersion = fixture();
    invalidVersion.getStream.mockResolvedValueOnce({
      object_ref: "snapshot-ref:1" as ObjectRefV1,
      version: "",
      sha256: hash(invalidVersion.manifestBytes),
      size_bytes: invalidVersion.manifestBytes.byteLength,
      media_type: "application/json",
      retention_until: retention,
      body: body(invalidVersion.manifestBytes),
    });
    await expect(
      createObjectStoreTriggerProcessSnapshotMaterializerV1(
        { getStream: invalidVersion.getStream } as never,
        invalidVersion.decisions,
        invalidVersion.overflowReader,
        { now: () => new Date(at) },
      ).materialize({
        metadata: invalidVersion.metadata,
        purpose: "meta_learning",
        trace_id: "trace-version",
      }),
    ).rejects.toThrow(/metadata is invalid/u);
  });
});
