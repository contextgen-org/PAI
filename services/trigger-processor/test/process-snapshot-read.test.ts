import { createHash } from "node:crypto";

import type {
  TriggerProcessSnapshotV1,
} from "@pai/contracts";
import { canonicalJsonV1 } from "@pai/eventing";
import { describe, expect, it, vi } from "vitest";

import {
  TriggerProcessSnapshotResolveErrorV1,
  createTriggerProcessSnapshotReadApplicationV1,
  type TriggerProcessSnapshotMetadataV1,
} from "../src/application/process-snapshot-read.v1.js";

const at = "2026-07-30T00:00:00.000Z";
const retention = "2026-08-30T00:00:00.000Z";
const payloadHash = `sha256:${"b".repeat(64)}` as const;

function hash(value: unknown): `sha256:${string}` {
  return `sha256:${createHash("sha256")
    .update(canonicalJsonV1(value), "utf8")
    .digest("hex")}`;
}

function snapshot(): TriggerProcessSnapshotV1 {
  const withoutHash = {
    schema_version: "trigger_process_snapshot.v1" as const,
    snapshot_id: "snapshot-1",
    snapshot_version: 1,
    trigger_process_id: "process-1",
    workspace_id: "workspace-1",
    bot_id: "bot-1",
    owner_agent_id: "agent-1",
    deployment_environment: "dev" as const,
    release_channel: "stable" as const,
    phase: "closed" as const,
    trigger: {
      trigger_id: "trigger-1",
      source: "chat" as const,
      actor_type: "user" as const,
      actor_id: "user-1",
      payload_ref: "trigger-payload:1",
      payload_hash: payloadHash,
      accepted_at: at,
    },
    context_snapshot: null,
    intent: null,
    runtime_run_id: null,
    policy_snapshot_id: null,
    runtime_state: null,
    action_trace: [],
    tool_results: [],
    event_trace: [
      {
        source_service: "trigger_processor" as const,
        source_event_id: "event-1",
        source_sequence_no: 1,
        append_sequence_no: 1,
        payload_ref: "event-payload:1",
        payload_hash: payloadHash,
        created_at: at,
        event_type: "trigger_process.closed",
        schema_version: "trigger_processor_event.v1",
        occurred_at: at,
        runtime_run_id: null,
        artifact_refs: [],
      },
    ],
    input_event_range: {
      first_append_sequence_no: 1,
      last_append_sequence_no: 1,
    },
    overflow_refs: [],
    last_append_sequence_no: 1,
    last_sequence_by_source: { trigger_processor: 1 },
    terminal_outcome: "executed" as const,
    terminal_outcome_finalized_at: at,
    canonical_process_id: null,
    successor_process_id: null,
    superseded_by_process_id: null,
    snapshot_transfer_ref: null,
    boundary_system_event_ref: null,
    canonical_reason_code: "completed",
    open_loops: [],
    created_at: at,
    updated_at: at,
    cooldown_until: null,
    snapshot_retention_until: retention,
  };
  return { ...withoutHash, snapshot_hash: hash(withoutHash) };
}

function metadata(manifest: TriggerProcessSnapshotV1): TriggerProcessSnapshotMetadataV1 {
  return {
    snapshot_id: manifest.snapshot_id,
    trigger_process_id: manifest.trigger_process_id,
    workspace_id: manifest.workspace_id,
    bot_id: manifest.bot_id,
    owner_agent_id: manifest.owner_agent_id,
    deployment_environment: manifest.deployment_environment,
    release_channel: manifest.release_channel,
    schema_version: manifest.schema_version,
    snapshot_version: manifest.snapshot_version,
    snapshot_hash: manifest.snapshot_hash,
    snapshot_ref: "snapshot-ref:1",
    first_append_sequence_no: 1,
    last_append_sequence_no: 1,
    status: "current",
    retention_until: retention,
    overflow_refs: [],
  };
}

const principal = {
  service_id: "meta_cognition" as const,
  capability: "trigger.process.snapshot.resolve" as const,
  scope: {
    workspace_id: "workspace-1",
    bot_id: "bot-1",
    owner_agent_id: "agent-1",
    deployment_environment: "dev" as const,
    release_channel: "stable" as const,
  },
};

function request(manifest: TriggerProcessSnapshotV1) {
  return {
    schema_version: "trigger_process_snapshot_resolve_request.v1",
    trigger_process_id: manifest.trigger_process_id,
    ...principal.scope,
    snapshot_ref: "snapshot-ref:1",
    expected_snapshot_version: manifest.snapshot_version,
    expected_snapshot_hash: manifest.snapshot_hash,
    purpose: "meta_learning",
    trace_id: "trace-1",
  } as const;
}

function fixture() {
  const manifest = snapshot();
  const inline = { event_id: "event-1" };
  const repository = {
    readExactSnapshot: vi.fn().mockResolvedValue({
      outcome: "found",
      metadata: metadata(manifest),
    }),
  };
  const materializer = {
    materialize: vi.fn().mockResolvedValue({
      snapshot_manifest: manifest,
      content_chunks: [
        {
          source_service: "trigger_processor",
          first_append_sequence_no: 1,
          last_append_sequence_no: 1,
          checksum_algorithm: "sha256",
          checksum: hash(inline),
          inline_content: inline,
          retention_until: retention,
          redaction_state: "not_required",
        },
      ],
    }),
  };
  return { manifest, repository, materializer };
}

describe("Trigger Process snapshot resolve", () => {
  it("returns only an exact, hash-verified and fully covered owner snapshot", async () => {
    const { manifest, repository, materializer } = fixture();
    const application = createTriggerProcessSnapshotReadApplicationV1(
      repository,
      materializer,
      { now: () => new Date(at) },
    );
    const result = await application.resolve(principal, request(manifest));
    expect(result.snapshot_manifest.snapshot_hash).toBe(manifest.snapshot_hash);
    expect(repository.readExactSnapshot).toHaveBeenCalledWith({
      trigger_process_id: "process-1",
      snapshot_ref: "snapshot-ref:1",
    });
  });

  it("fails closed on purpose/caller mismatch before touching storage", async () => {
    const { manifest, repository, materializer } = fixture();
    const application = createTriggerProcessSnapshotReadApplicationV1(
      repository,
      materializer,
    );
    await expect(
      application.resolve(
        { ...principal, service_id: "observation_gateway" },
        request(manifest),
      ),
    ).rejects.toMatchObject<Partial<TriggerProcessSnapshotResolveErrorV1>>({
      code: "snapshot_scope_mismatch",
    });
    expect(repository.readExactSnapshot).not.toHaveBeenCalled();
  });

  it("rejects manifest tampering, incomplete ranges and unreadable chunks", async () => {
    const first = fixture();
    first.materializer.materialize.mockResolvedValue({
      snapshot_manifest: {
        ...first.manifest,
        canonical_reason_code: "tampered",
      },
      content_chunks: [],
    });
    const application = createTriggerProcessSnapshotReadApplicationV1(
      first.repository,
      first.materializer,
      { now: () => new Date(at) },
    );
    await expect(
      application.resolve(principal, request(first.manifest)),
    ).rejects.toMatchObject({ code: "snapshot_hash_mismatch" });

    const second = fixture();
    second.materializer.materialize.mockRejectedValue(new Error("owner unavailable"));
    await expect(
      createTriggerProcessSnapshotReadApplicationV1(
        second.repository,
        second.materializer,
        { now: () => new Date(at) },
      ).resolve(principal, request(second.manifest)),
    ).rejects.toMatchObject({ code: "snapshot_overflow_unreadable" });
  });

  it("classifies scope, redaction and expiry drift without returning content", async () => {
    const scoped = fixture();
    scoped.materializer.materialize.mockResolvedValue({
      snapshot_manifest: { ...scoped.manifest, bot_id: "bot-other" },
      content_chunks: [],
    });
    await expect(
      createTriggerProcessSnapshotReadApplicationV1(
        scoped.repository,
        scoped.materializer,
        { now: () => new Date(at) },
      ).resolve(principal, request(scoped.manifest)),
    ).rejects.toMatchObject({ code: "snapshot_scope_mismatch" });

    const redaction = fixture();
    redaction.materializer.materialize.mockResolvedValue({
      snapshot_manifest: redaction.manifest,
      content_chunks: [
        {
          source_service: "trigger_processor",
          first_append_sequence_no: 1,
          last_append_sequence_no: 1,
          checksum_algorithm: "sha256",
          checksum: payloadHash,
          inline_content: {},
          retention_until: retention,
          redaction_state: "incomplete",
        },
      ],
    });
    await expect(
      createTriggerProcessSnapshotReadApplicationV1(
        redaction.repository,
        redaction.materializer,
        { now: () => new Date(at) },
      ).resolve(principal, request(redaction.manifest)),
    ).rejects.toMatchObject({ code: "snapshot_redaction_incomplete" });

    const expiresDuringRead = fixture();
    let clockReads = 0;
    const application = createTriggerProcessSnapshotReadApplicationV1(
      expiresDuringRead.repository,
      expiresDuringRead.materializer,
      {
        now: () =>
          new Date(
            clockReads++ === 0
              ? "2026-07-30T00:00:00.000Z"
              : retention,
          ),
      },
    );
    await expect(
      application.resolve(principal, request(expiresDuringRead.manifest)),
    ).rejects.toMatchObject({ code: "snapshot_expired" });
  });

  it("detaches request and principal before a blocked repository await", async () => {
    const { manifest, repository, materializer } = fixture();
    let releaseRead!: (
      value: ReturnType<typeof metadata> extends infer T
        ? { outcome: "found"; metadata: T }
        : never,
    ) => void;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const blocked = new Promise<{
      outcome: "found";
      metadata: TriggerProcessSnapshotMetadataV1;
    }>((resolve) => {
      releaseRead = resolve;
    });
    repository.readExactSnapshot.mockImplementation(async () => {
      markStarted();
      return blocked;
    });
    const application = createTriggerProcessSnapshotReadApplicationV1(
      repository,
      materializer,
      { now: () => new Date(at) },
    );
    const mutableRequest: Record<string, unknown> = {
      ...request(manifest),
    };
    const mutablePrincipal = {
      service_id: "meta_cognition" as
        | "meta_cognition"
        | "observation_gateway"
        | "trigger_processor",
      capability: "trigger.process.snapshot.resolve" as const,
      scope: {
        workspace_id: "workspace-1",
        bot_id: "bot-1",
        owner_agent_id: "agent-1",
        deployment_environment: "dev" as
          | "local"
          | "dev"
          | "staging"
          | "prod",
        release_channel: "stable" as "stable" | "canary",
      },
    };

    const pending = application.resolve(mutablePrincipal, mutableRequest);
    await started;
    mutableRequest.purpose = "observation_replay";
    mutableRequest.expected_snapshot_hash = `sha256:${"0".repeat(64)}`;
    mutableRequest.trace_id = "trace-mutated";
    mutablePrincipal.service_id = "observation_gateway";
    mutablePrincipal.scope.bot_id = "bot-mutated";
    releaseRead({ outcome: "found", metadata: metadata(manifest) });

    await expect(pending).resolves.toMatchObject({
      snapshot_ref: "snapshot-ref:1",
    });
    expect(materializer.materialize).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: "meta_learning",
        trace_id: "trace-1",
      }),
    );
  });

  it("captures dependency methods and returns a detached deeply frozen result", async () => {
    const manifestSource = snapshot();
    const metadataSource = { ...metadata(manifestSource) };
    const inlineSource = { event_id: "event-1" };
    const chunkSource = {
      source_service: "trigger_processor" as const,
      first_append_sequence_no: 1,
      last_append_sequence_no: 1,
      checksum_algorithm: "sha256" as const,
      checksum: hash(inlineSource),
      inline_content: inlineSource,
      retention_until: retention,
      redaction_state: "not_required" as const,
    };
    const originalRead = vi.fn().mockResolvedValue({
      outcome: "found" as const,
      metadata: metadataSource,
    });
    const originalMaterialize = vi.fn().mockResolvedValue({
      snapshot_manifest: manifestSource,
      content_chunks: [chunkSource],
    });
    const repository = { readExactSnapshot: originalRead };
    const materializer = { materialize: originalMaterialize };
    const application = createTriggerProcessSnapshotReadApplicationV1(
      repository,
      materializer,
      { now: () => new Date(at) },
    );
    repository.readExactSnapshot = vi
      .fn()
      .mockRejectedValue(new Error("method swapped"));
    materializer.materialize = vi
      .fn()
      .mockRejectedValue(new Error("method swapped"));

    const result = await application.resolve(
      principal,
      request(manifestSource),
    );
    Reflect.set(metadataSource, "snapshot_ref", "snapshot-ref:mutated");
    Reflect.set(manifestSource.event_trace[0]!, "event_type", "mutated");
    Reflect.set(inlineSource, "event_id", "mutated");

    expect(originalRead).toHaveBeenCalledOnce();
    expect(originalMaterialize).toHaveBeenCalledOnce();
    expect(result.snapshot_ref).toBe("snapshot-ref:1");
    expect(result.snapshot_manifest.event_trace[0]?.event_type).toBe(
      "trigger_process.closed",
    );
    expect(
      "inline_content" in result.content_chunks[0]!
        ? result.content_chunks[0].inline_content
        : null,
    ).toEqual({ event_id: "event-1" });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.snapshot_manifest.event_trace[0]!)).toBe(
      true,
    );
    expect(Object.isFrozen(result.content_chunks[0]!)).toBe(true);
  });

  it("rejects Proxy/accessor boundaries without invoking accessors and maps an invalid clock", async () => {
    const proxied = fixture();
    const proxiedApplication =
      createTriggerProcessSnapshotReadApplicationV1(
        proxied.repository,
        proxied.materializer,
        { now: () => new Date(at) },
      );
    await expect(
      proxiedApplication.resolve(
        principal,
        new Proxy(request(proxied.manifest), {}),
      ),
    ).rejects.toMatchObject({ code: "snapshot_schema_incompatible" });
    expect(proxied.repository.readExactSnapshot).not.toHaveBeenCalled();

    let scopeReads = 0;
    const accessorPrincipal = Object.create(null) as Record<string, unknown>;
    Object.defineProperties(accessorPrincipal, {
      service_id: { value: "meta_cognition", enumerable: true },
      capability: {
        value: "trigger.process.snapshot.resolve",
        enumerable: true,
      },
      scope: {
        enumerable: true,
        get() {
          scopeReads += 1;
          return principal.scope;
        },
      },
    });
    await expect(
      proxiedApplication.resolve(
        accessorPrincipal as unknown as typeof principal,
        request(proxied.manifest),
      ),
    ).rejects.toMatchObject({ code: "snapshot_scope_mismatch" });
    expect(scopeReads).toBe(0);

    let metadataReads = 0;
    const accessorRead = Object.create(null) as Record<string, unknown>;
    Object.defineProperties(accessorRead, {
      outcome: { value: "found", enumerable: true },
      metadata: {
        enumerable: true,
        get() {
          metadataReads += 1;
          return metadata(proxied.manifest);
        },
      },
    });
    const accessorApplication =
      createTriggerProcessSnapshotReadApplicationV1(
        {
          async readExactSnapshot() {
            return accessorRead as never;
          },
        },
        proxied.materializer,
        { now: () => new Date(at) },
      );
    await expect(
      accessorApplication.resolve(principal, request(proxied.manifest)),
    ).rejects.toMatchObject({ code: "snapshot_schema_incompatible" });
    expect(metadataReads).toBe(0);

    const invalidClock = fixture();
    await expect(
      createTriggerProcessSnapshotReadApplicationV1(
        invalidClock.repository,
        invalidClock.materializer,
        { now: () => new Date(Number.NaN) },
      ).resolve(principal, request(invalidClock.manifest)),
    ).rejects.toMatchObject({ code: "snapshot_schema_incompatible" });
  });
});
