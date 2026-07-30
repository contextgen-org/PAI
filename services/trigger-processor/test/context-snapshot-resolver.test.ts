import { createHash } from "node:crypto";

import type { ContextSnapshotV1 } from "@pai/contracts";
import {
  canonicalJsonV1,
  materializeContextSnapshotReadV1,
} from "@pai/eventing";
import type { ObjectRefV1 } from "@pai/object-store";
import { describe, expect, it, vi } from "vitest";

import { createContextSnapshotResolverV1 } from "../src/application/context-snapshot-resolver.v1.js";
import {
  createContextSnapshotReadApplicationV1,
  type ContextSnapshotReadPrincipalV1,
} from "../src/application/context-snapshot-read.v1.js";
import type { ContextSnapshotResolverV1 } from "../src/application/context-snapshot-resolver.v1.js";

const at = "2026-07-30T00:00:00.000Z";
const retention = "2026-08-30T00:00:00.000Z";

function digest(value: Uint8Array | string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

async function* byteBody(value: Uint8Array): AsyncIterable<Uint8Array> {
  yield value;
}

function snapshot(): ContextSnapshotV1 {
  const partial = {
    schema_version: "context_snapshot.v1" as const,
    trigger_process_id: "process-1",
    context_version: 1,
    workspace_id: "workspace-1",
    bot_id: "bot-1",
    owner_agent_id: "agent-1",
    deployment_environment: "dev" as const,
    release_channel: "stable" as const,
    pinned_facts: [],
    memory_context: [],
    skill_catalog: {
      catalog_version: "cat_1",
      catalog_as_of: at,
      items: [],
    },
    environment: {
      captured_at: at,
      channel: "chat",
      timezone: "Asia/Shanghai",
      capability_summary_ref: "capabilities:1",
    },
    history: [],
    source_status: [
      { source: "knowthat" as const, status: "empty" as const, retrieved_at: at, source_as_of: at, source_version: "knowthat.v1", latency_ms: 1, result_count: 0, failure_reason: null },
      { source: "memory" as const, status: "empty" as const, retrieved_at: at, source_as_of: at, source_version: "memory.v1", latency_ms: 1, result_count: 0, failure_reason: null },
      { source: "skill" as const, status: "empty" as const, retrieved_at: at, source_as_of: at, source_version: "cat_1", latency_ms: 1, result_count: 0, failure_reason: null },
      { source: "environment" as const, status: "ok" as const, retrieved_at: at, source_as_of: at, source_version: "environment.v1", latency_ms: 1, result_count: 1, failure_reason: null },
      { source: "history" as const, status: "empty" as const, retrieved_at: at, source_as_of: at, source_version: "history.v1", latency_ms: 1, result_count: 0, failure_reason: null },
    ],
    assembly_notes: [],
  };
  return { ...partial, snapshot_hash: digest(canonicalJsonV1(partial)) };
}

function request(value = snapshot()) {
  return {
    trigger_process_id: value.trigger_process_id,
    workspace_id: value.workspace_id,
    bot_id: value.bot_id,
    owner_agent_id: value.owner_agent_id,
    deployment_environment: value.deployment_environment,
    release_channel: value.release_channel,
    context_snapshot_ref: "object:context-1",
    context_snapshot_version: value.context_version,
    context_snapshot_hash: value.snapshot_hash,
    purpose: "runtime_start" as const,
  };
}

function ownerRequest(value = snapshot(), traceId = "trace-1") {
  return {
    schema_version: "context_snapshot_resolve_request.v1" as const,
    consumer_service: "action_runtime" as const,
    ...request(value),
    trace_id: traceId,
  };
}

function ownerPrincipal(): ContextSnapshotReadPrincipalV1 {
  return {
    service_id: "action_runtime",
    aud: "trigger_processor",
    capability: ["trigger.context_snapshot.resolve"],
    scope: {
      workspace_id: "workspace-1",
      bot_id: "bot-1",
      owner_agent_id: "agent-1",
      deployment_environment: "dev",
      release_channel: "stable",
    },
  };
}

function ownerRead(value = snapshot()) {
  const canonicalBytes = Uint8Array.from(
    Buffer.from(canonicalJsonV1(value), "utf8"),
  );
  return {
    snapshot: value,
    canonical_bytes: canonicalBytes,
    canonical_bytes_sha256: digest(canonicalBytes),
    content_length_bytes: canonicalBytes.byteLength,
    retention_until: "2026-08-30T00:00:00.000Z",
    redaction_state: "complete" as const,
  };
}

function directResolver(
  resolveOwnerRead: ContextSnapshotResolverV1["resolveOwnerRead"],
  value = snapshot(),
): ContextSnapshotResolverV1 {
  return {
    async resolve() {
      return value;
    },
    resolveOwnerRead,
  };
}

function resolver(
  value = snapshot(),
  overrides: Record<string, unknown> = {},
  canonical = true,
) {
  const bytes = Buffer.from(canonicalJsonV1(value), "utf8");
  const reads: unknown[] = [];
  return {
    reads,
    resolver: createContextSnapshotResolverV1(
      {
        async getStream(input) {
          reads.push(input);
          return {
            object_ref: "object:context-1" as ObjectRefV1,
            version: "1",
            sha256: digest(bytes),
            size_bytes: bytes.byteLength,
            media_type: "application/json",
            retention_until: "2026-08-30T00:00:00.000Z",
            body: (async function* () { yield bytes; })(),
            ...overrides,
          };
        },
      },
      {
        async resolve() {
          return {
            access_decision_ref: "decision:1",
            retention_policy_version: "retention.v1",
            redaction_policy_version: "redaction.v1",
            redaction_state: "complete" as const,
          };
        },
      },
      {
        async isCanonicalReference() {
          return canonical;
        },
      },
      { now: () => new Date(at) },
    ),
  };
}

describe("ContextSnapshot owner resolver", () => {
  it("reads canonical ObjectStore bytes and binds physical, logical and bot identity", async () => {
    const harness = resolver();
    await expect(
      harness.resolver.resolve(request(), new AbortController().signal),
    ).resolves.toMatchObject({ snapshot_hash: request().context_snapshot_hash });
    expect(harness.reads).toEqual([
      expect.objectContaining({
        owner_service: "trigger_processor",
        capability: "trigger_process.snapshot.resolve",
        object_ref: "object:context-1",
        scope: expect.objectContaining({
          workspace_id: "workspace-1",
          bot_id: "bot-1",
        }),
      }),
    ]);
  });

  it("rejects physical corruption, expiry and request scope drift", async () => {
    const corrupted = resolver(snapshot(), { sha256: `sha256:${"0".repeat(64)}` });
    await expect(
      corrupted.resolver.resolve(request(), new AbortController().signal),
    ).rejects.toThrow(/physical hash/u);

    const expired = resolver(snapshot(), { retention_until: at });
    await expect(
      expired.resolver.resolve(request(), new AbortController().signal),
    ).rejects.toThrow(/metadata/u);

    const valid = resolver();
    await expect(
      valid.resolver.resolve(
        { ...request(), bot_id: "bot-other" },
        new AbortController().signal,
      ),
    ).rejects.toThrow(/identity or logical hash/u);

    const prettyBytes = Buffer.from(JSON.stringify(snapshot(), null, 2), "utf8");
    const nonCanonical = resolver(snapshot(), {
      sha256: digest(prettyBytes),
      size_bytes: prettyBytes.byteLength,
      body: (async function* () { yield prettyBytes; })(),
    });
    await expect(
      nonCanonical.resolver.resolve(request(), new AbortController().signal),
    ).rejects.toThrow(/canonical JSON/u);

    const unowned = resolver(snapshot(), {}, false);
    await expect(
      unowned.resolver.resolve(request(), new AbortController().signal),
    ).rejects.toThrow(/not canonical/u);
    expect(unowned.reads).toEqual([]);
  });

  it("detaches owner request/results across awaits and captures dependency methods", async () => {
    const value = snapshot();
    const bytes = Buffer.from(canonicalJsonV1(value), "utf8");
    const decisionSource = {
      access_decision_ref: "decision:1",
      retention_policy_version: "retention.v1",
      redaction_policy_version: "redaction.v1",
      redaction_state: "complete" as const,
    };
    let releaseDecision!: (value: typeof decisionSource) => void;
    let markDecisionStarted!: () => void;
    const decisionStarted = new Promise<void>((resolve) => {
      markDecisionStarted = resolve;
    });
    const decisionGate = new Promise<typeof decisionSource>((resolve) => {
      releaseDecision = resolve;
    });
    let releaseBody!: () => void;
    let markBodyStarted!: () => void;
    const bodyStarted = new Promise<void>((resolve) => {
      markBodyStarted = resolve;
    });
    const bodyGate = new Promise<void>((resolve) => {
      releaseBody = resolve;
    });
    const resultSource = {
      object_ref: "object:context-1" as ObjectRefV1,
      version: "1",
      sha256: digest(bytes),
      size_bytes: bytes.byteLength,
      media_type: "application/json",
      retention_until: "2026-08-30T00:00:00.000Z",
      body: (async function* () {
        markBodyStarted();
        await bodyGate;
        yield bytes;
      })(),
    };
    const originalGetStream = vi.fn(async () => resultSource);
    const originalDecision = vi.fn(async () => {
      markDecisionStarted();
      return decisionGate;
    });
    const originalCanonical = vi.fn(async () => true);
    const objectStore = { getStream: originalGetStream };
    const decisions = { resolve: originalDecision };
    const canonicalReferences = {
      isCanonicalReference: originalCanonical,
    };
    const contextResolver = createContextSnapshotResolverV1(
      objectStore as never,
      decisions,
      canonicalReferences,
      { now: () => new Date(at) },
    );
    objectStore.getStream = vi
      .fn()
      .mockRejectedValue(new Error("method swapped"));
    decisions.resolve = vi
      .fn()
      .mockRejectedValue(new Error("method swapped"));
    canonicalReferences.isCanonicalReference = vi
      .fn()
      .mockRejectedValue(new Error("method swapped"));
    const mutableRequest = request(value);

    const pending = contextResolver.resolve(
      mutableRequest,
      new AbortController().signal,
    );
    await decisionStarted;
    Reflect.set(mutableRequest, "context_snapshot_ref", "object:mutated");
    Reflect.set(mutableRequest, "bot_id", "bot-mutated");
    Reflect.set(
      mutableRequest,
      "context_snapshot_hash",
      `sha256:${"0".repeat(64)}`,
    );
    releaseDecision(decisionSource);
    await bodyStarted;
    Reflect.set(decisionSource, "access_decision_ref", "decision:mutated");
    Reflect.set(resultSource, "size_bytes", 1);
    Reflect.set(resultSource, "sha256", `sha256:${"f".repeat(64)}`);
    Reflect.set(resultSource, "retention_until", at);
    Reflect.set(resultSource, "body", byteBody(Buffer.from("{}")));
    releaseBody();

    await expect(pending).resolves.toMatchObject({
      trigger_process_id: "process-1",
      bot_id: "bot-1",
    });
    expect(originalCanonical).toHaveBeenCalledOnce();
    expect(originalDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        context_snapshot_ref: "object:context-1",
        bot_id: "bot-1",
      }),
    );
    expect(originalGetStream).toHaveBeenCalledWith(
      expect.objectContaining({
        object_ref: "object:context-1",
        access_decision_ref: "decision:1",
      }),
    );
  });

  it("rejects decision/metadata accessors and typed-array Proxy chunks without executing traps", async () => {
    const value = snapshot();
    const bytes = Buffer.from(canonicalJsonV1(value), "utf8");
    let decisionReads = 0;
    const accessorDecision = Object.create(null) as Record<string, unknown>;
    Object.defineProperties(accessorDecision, {
      access_decision_ref: {
        enumerable: true,
        get() {
          decisionReads += 1;
          return "decision:1";
        },
      },
      retention_policy_version: {
        value: "retention.v1",
        enumerable: true,
      },
      redaction_policy_version: {
        value: "redaction.v1",
        enumerable: true,
      },
      redaction_state: { value: "complete", enumerable: true },
    });
    const accessorDecisionResolver = createContextSnapshotResolverV1(
      {
        async getStream() {
          throw new Error("must not read");
        },
      } as never,
      { async resolve() { return accessorDecision as never; } },
      { async isCanonicalReference() { return true; } },
      { now: () => new Date(at) },
    );
    await expect(
      accessorDecisionResolver.resolve(
        request(value),
        new AbortController().signal,
      ),
    ).rejects.toThrow(/decision is invalid/u);
    expect(decisionReads).toBe(0);

    let retentionReads = 0;
    const accessorMetadata = Object.create(null) as Record<string, unknown>;
    Object.defineProperties(accessorMetadata, {
      object_ref: {
        value: "object:context-1" as ObjectRefV1,
        enumerable: true,
      },
      version: { value: "1", enumerable: true },
      sha256: { value: digest(bytes), enumerable: true },
      size_bytes: { value: bytes.byteLength, enumerable: true },
      media_type: { value: "application/json", enumerable: true },
      retention_until: {
        enumerable: true,
        get() {
          retentionReads += 1;
          return retention;
        },
      },
      body: { value: byteBody(bytes), enumerable: true },
    });
    const accessorMetadataResolver = createContextSnapshotResolverV1(
      { async getStream() { return accessorMetadata as never; } } as never,
      {
        async resolve() {
          return {
            access_decision_ref: "decision:1",
            retention_policy_version: "retention.v1",
            redaction_policy_version: "redaction.v1",
            redaction_state: "complete" as const,
          };
        },
      },
      { async isCanonicalReference() { return true; } },
      { now: () => new Date(at) },
    );
    await expect(
      accessorMetadataResolver.resolve(
        request(value),
        new AbortController().signal,
      ),
    ).rejects.toThrow(/metadata is invalid/u);
    expect(retentionReads).toBe(0);

    const proxyChunkResolver = createContextSnapshotResolverV1(
      {
        async getStream() {
          return {
            object_ref: "object:context-1" as ObjectRefV1,
            version: "1",
            sha256: digest(bytes),
            size_bytes: bytes.byteLength,
            media_type: "application/json",
            retention_until: retention,
            body: (async function* () {
              yield new Proxy(Uint8Array.from(bytes), {});
            })(),
          };
        },
      } as never,
      {
        async resolve() {
          return {
            access_decision_ref: "decision:1",
            retention_policy_version: "retention.v1",
            redaction_policy_version: "redaction.v1",
            redaction_state: "complete" as const,
          };
        },
      },
      { async isCanonicalReference() { return true; } },
      { now: () => new Date(at) },
    );
    await expect(
      proxyChunkResolver.resolve(
        request(value),
        new AbortController().signal,
      ),
    ).rejects.toThrow(/invalid bytes/u);
  });

  it("fails closed when the injected resolver clock is invalid", async () => {
    const value = snapshot();
    const bytes = Buffer.from(canonicalJsonV1(value), "utf8");
    const contextResolver = createContextSnapshotResolverV1(
      {
        async getStream() {
          return {
            object_ref: "object:context-1" as ObjectRefV1,
            version: "1",
            sha256: digest(bytes),
            size_bytes: bytes.byteLength,
            media_type: "application/json",
            retention_until: retention,
            body: byteBody(bytes),
          };
        },
      } as never,
      {
        async resolve() {
          return {
            access_decision_ref: "decision:1",
            retention_policy_version: "retention.v1",
            redaction_policy_version: "redaction.v1",
            redaction_state: "complete" as const,
          };
        },
      },
      { async isCanonicalReference() { return true; } },
      { now: () => new Date(Number.NaN) },
    );
    await expect(
      contextResolver.resolve(
        request(value),
        new AbortController().signal,
      ),
    ).rejects.toThrow(/clock is invalid/u);

    let clockReads = 0;
    const expiresDuringRead = createContextSnapshotResolverV1(
      {
        async getStream() {
          return {
            object_ref: "object:context-1" as ObjectRefV1,
            version: "1",
            sha256: digest(bytes),
            size_bytes: bytes.byteLength,
            media_type: "application/json",
            retention_until: retention,
            body: byteBody(bytes),
          };
        },
      } as never,
      {
        async resolve() {
          return {
            access_decision_ref: "decision:1",
            retention_policy_version: "retention.v1",
            redaction_policy_version: "redaction.v1",
            redaction_state: "complete" as const,
          };
        },
      },
      { async isCanonicalReference() { return true; } },
      {
        now: () =>
          new Date(clockReads++ === 0 ? at : retention),
      },
    );
    await expect(
      expiresDuringRead.resolve(
        request(value),
        new AbortController().signal,
      ),
    ).rejects.toThrow(/expired during read/u);
  });

  it("does not expose resolver options as clock this and validates ObjectStore version", async () => {
    const value = snapshot();
    const bytes = Buffer.from(canonicalJsonV1(value), "utf8");
    let clockReceiver: unknown = "not-called";
    const makeResolver = (version: string) =>
      createContextSnapshotResolverV1(
        {
          async getStream() {
            return {
              object_ref: "object:context-1" as ObjectRefV1,
              version,
              sha256: digest(bytes),
              size_bytes: bytes.byteLength,
              media_type: "application/json",
              retention_until: retention,
              body: byteBody(bytes),
            };
          },
        } as never,
        {
          async resolve() {
            return {
              access_decision_ref: "decision:1",
              retention_policy_version: "retention.v1",
              redaction_policy_version: "redaction.v1",
              redaction_state: "complete" as const,
            };
          },
        },
        { async isCanonicalReference() { return true; } },
        {
          now: function (this: unknown) {
            clockReceiver = this;
            return new Date(at);
          },
        },
      );
    await expect(
      makeResolver("1").resolve(
        request(value),
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({ trigger_process_id: "process-1" });
    expect(clockReceiver).toBeUndefined();
    await expect(
      makeResolver("").resolve(
        request(value),
        new AbortController().signal,
      ),
    ).rejects.toThrow(/metadata is invalid/u);
  });

  it("exposes the frozen owner read contract only to the caller/purpose matrix", async () => {
    const harness = resolver();
    const app = createContextSnapshotReadApplicationV1(harness.resolver, {
      now: () => new Date(at),
    });
    const ownerRequest = {
      schema_version: "context_snapshot_resolve_request.v1",
      consumer_service: "action_runtime",
      ...request(),
      trace_id: "trace-1",
    } as const;
    const principal = {
      service_id: "action_runtime" as const,
      aud: "trigger_processor" as const,
      capability: ["trigger.context_snapshot.resolve"],
      scope: {
        workspace_id: "workspace-1",
        bot_id: "bot-1",
        owner_agent_id: "agent-1",
        deployment_environment: "dev" as const,
        release_channel: "stable" as const,
      },
    };
    await expect(app.resolve(principal, ownerRequest)).resolves.toMatchObject({
      schema_version: "context_snapshot_read.v1",
      context_snapshot_ref: "object:context-1",
      context_snapshot_version: 1,
      canonical_bytes_sha256: expect.stringMatching(/^sha256:/u),
      content_length_bytes: expect.any(Number),
      delivery_mode: "inline",
      redaction_state: "complete",
    });
    await expect(
      app.resolve(
        { ...principal, service_id: "trigger_processor" },
        ownerRequest,
      ),
    ).rejects.toMatchObject({ code: "scope_mismatch" });
    await expect(
      app.resolve(
        principal,
        { ...ownerRequest, consumer_service: "observation_gateway" },
      ),
    ).rejects.toMatchObject({ code: "scope_mismatch" });
  });

  it("emits deterministic contiguous chunks above the bounded inline threshold", async () => {
    const base = snapshot();
    const { snapshot_hash: _, ...withoutHash } = base;
    const pinnedFacts = Array.from({ length: 5 }, (_, index) => ({
      ref: `fact:${index}`,
      version: "1",
      summary: `${index}`.repeat(16_000),
    }));
    const largeWithoutHash = {
      ...withoutHash,
      pinned_facts: pinnedFacts,
      source_status: withoutHash.source_status.map((outcome) =>
        outcome.source === "knowthat"
          ? { ...outcome, status: "ok" as const, result_count: 5 }
          : outcome,
      ),
    };
    const large = {
      ...largeWithoutHash,
      snapshot_hash: digest(canonicalJsonV1(largeWithoutHash)),
    };
    const harness = resolver(large);
    const app = createContextSnapshotReadApplicationV1(harness.resolver, {
      now: () => new Date(at),
    });
    const ownerRequest = {
      schema_version: "context_snapshot_resolve_request.v1",
      consumer_service: "action_runtime",
      ...request(large),
      trace_id: "trace-large",
    } as const;
    const principal = {
      service_id: "action_runtime" as const,
      aud: "trigger_processor" as const,
      capability: ["trigger.context_snapshot.resolve"],
      scope: {
        workspace_id: "workspace-1",
        bot_id: "bot-1",
        owner_agent_id: "agent-1",
        deployment_environment: "dev" as const,
        release_channel: "stable" as const,
      },
    };
    const read = await app.resolve(principal, ownerRequest);
    expect(read.delivery_mode).toBe("chunked");
    if (read.delivery_mode !== "chunked") throw new Error("test fixture");
    expect(read.context_snapshot).toBeNull();
    expect(read.chunks.length).toBeGreaterThan(1);
    let offset = 0;
    for (const [ordinal, chunk] of read.chunks.entries()) {
      expect(chunk.ordinal).toBe(ordinal);
      expect(chunk.byte_offset).toBe(offset);
      expect(Buffer.from(chunk.canonical_bytes_base64, "base64")).toHaveLength(
        chunk.byte_length,
      );
      offset += chunk.byte_length;
    }
    expect(offset).toBe(read.content_length_bytes);
    expect(
      materializeContextSnapshotReadV1(ownerRequest, read, {
        now: () => new Date(at),
      }),
    ).toEqual(large);
  });

  it("does not trust a resolver that reports bytes unrelated to its snapshot", async () => {
    const value = snapshot();
    const bytes = Buffer.from(canonicalJsonV1(value), "utf8");
    const app = createContextSnapshotReadApplicationV1(
      {
        async resolve() {
          return value;
        },
        async resolveOwnerRead() {
          return {
            snapshot: value,
            canonical_bytes: Buffer.from("{}"),
            canonical_bytes_sha256: digest(Buffer.from("{}")),
            content_length_bytes: 2,
            retention_until: "2026-08-30T00:00:00.000Z",
            redaction_state: "complete" as const,
          };
        },
      },
      { now: () => new Date(at) },
    );
    await expect(
      app.resolve(
        {
          service_id: "action_runtime",
          aud: "trigger_processor",
          capability: ["trigger.context_snapshot.resolve"],
          scope: {
            workspace_id: "workspace-1",
            bot_id: "bot-1",
            owner_agent_id: "agent-1",
            deployment_environment: "dev",
            release_channel: "stable",
          },
        },
        {
          schema_version: "context_snapshot_resolve_request.v1",
          consumer_service: "action_runtime",
          ...request(value),
          trace_id: "trace-forged",
        },
      ),
    ).rejects.toMatchObject({ code: "hash_mismatch" });
    expect(bytes.byteLength).toBeGreaterThan(2);
  });

  it("detaches request/principal before await, captures the resolver method, and detaches its result", async () => {
    const value = snapshot();
    const ownerResult = ownerRead(value);
    let releaseRead!: (read: typeof ownerResult) => void;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const blocked = new Promise<typeof ownerResult>((resolve) => {
      releaseRead = resolve;
    });
    const originalResolveOwnerRead = vi.fn(async () => {
      markStarted();
      return blocked;
    });
    const resolverPort = directResolver(originalResolveOwnerRead, value);
    const application = createContextSnapshotReadApplicationV1(resolverPort, {
      now: () => new Date(at),
    });
    resolverPort.resolveOwnerRead = vi
      .fn()
      .mockRejectedValue(new Error("method swapped"));
    const mutableRequest: Record<string, unknown> = {
      ...ownerRequest(value),
    };
    const mutablePrincipal = {
      service_id: "action_runtime" as
        | "trigger_processor"
        | "action_runtime"
        | "observation_gateway",
      aud: "trigger_processor" as const,
      capability: ["trigger.context_snapshot.resolve"],
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
    mutableRequest.consumer_service = "observation_gateway";
    mutableRequest.context_snapshot_hash = `sha256:${"0".repeat(64)}`;
    mutableRequest.trace_id = "trace-mutated";
    mutablePrincipal.service_id = "observation_gateway";
    mutablePrincipal.scope.bot_id = "bot-mutated";
    releaseRead(ownerResult);

    const result = await pending;
    Reflect.set(value.environment, "timezone", "UTC");
    ownerResult.canonical_bytes[0] =
      (ownerResult.canonical_bytes[0] ?? 0) ^ 0xff;

    expect(originalResolveOwnerRead).toHaveBeenCalledOnce();
    expect(result.trace_id).toBe("trace-1");
    expect(result.context_snapshot_hash).toBe(request(value).context_snapshot_hash);
    expect(result.delivery_mode).toBe("inline");
    if (result.delivery_mode !== "inline") throw new Error("test fixture");
    expect(result.context_snapshot.environment.timezone).toBe("Asia/Shanghai");
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.context_snapshot)).toBe(true);
    expect(Object.isFrozen(result.context_snapshot.environment)).toBe(true);
  });

  it("rejects Proxy/accessor inputs and owner reads without invoking accessors", async () => {
    const value = snapshot();
    const validRead = ownerRead(value);
    const ownerReadMethod = vi.fn().mockResolvedValue(validRead);
    const application = createContextSnapshotReadApplicationV1(
      directResolver(ownerReadMethod, value),
      { now: () => new Date(at) },
    );

    await expect(
      application.resolve(
        ownerPrincipal(),
        new Proxy(ownerRequest(value), {}),
      ),
    ).rejects.toMatchObject({ code: "schema_incompatible" });
    expect(ownerReadMethod).not.toHaveBeenCalled();

    let scopeReads = 0;
    const accessorPrincipal = Object.create(null) as Record<string, unknown>;
    Object.defineProperties(accessorPrincipal, {
      service_id: { value: "action_runtime", enumerable: true },
      aud: { value: "trigger_processor", enumerable: true },
      capability: {
        value: ["trigger.context_snapshot.resolve"],
        enumerable: true,
      },
      scope: {
        enumerable: true,
        get() {
          scopeReads += 1;
          return ownerPrincipal().scope;
        },
      },
    });
    await expect(
      application.resolve(
        accessorPrincipal as unknown as ContextSnapshotReadPrincipalV1,
        ownerRequest(value),
      ),
    ).rejects.toMatchObject({ code: "scope_mismatch" });
    expect(scopeReads).toBe(0);

    let snapshotReads = 0;
    const accessorOwnerRead = Object.create(null) as Record<string, unknown>;
    Object.defineProperties(accessorOwnerRead, {
      snapshot: {
        enumerable: true,
        get() {
          snapshotReads += 1;
          return value;
        },
      },
      canonical_bytes: {
        value: validRead.canonical_bytes,
        enumerable: true,
      },
      canonical_bytes_sha256: {
        value: validRead.canonical_bytes_sha256,
        enumerable: true,
      },
      content_length_bytes: {
        value: validRead.content_length_bytes,
        enumerable: true,
      },
      retention_until: {
        value: validRead.retention_until,
        enumerable: true,
      },
      redaction_state: {
        value: validRead.redaction_state,
        enumerable: true,
      },
    });
    const accessorApplication = createContextSnapshotReadApplicationV1(
      directResolver(async () => accessorOwnerRead as never, value),
      { now: () => new Date(at) },
    );
    await expect(
      accessorApplication.resolve(ownerPrincipal(), ownerRequest(value)),
    ).rejects.toMatchObject({ code: "schema_incompatible" });
    expect(snapshotReads).toBe(0);

    const proxyApplication = createContextSnapshotReadApplicationV1(
      directResolver(
        async () => new Proxy(ownerRead(value), {}) as never,
        value,
      ),
      { now: () => new Date(at) },
    );
    await expect(
      proxyApplication.resolve(ownerPrincipal(), ownerRequest(value)),
    ).rejects.toMatchObject({ code: "schema_incompatible" });
  });

  it("maps an invalid clock result to schema_incompatible", async () => {
    const value = snapshot();
    const application = createContextSnapshotReadApplicationV1(
      directResolver(async () => ownerRead(value), value),
      { now: () => new Date(Number.NaN) },
    );
    await expect(
      application.resolve(ownerPrincipal(), ownerRequest(value)),
    ).rejects.toMatchObject({ code: "schema_incompatible" });
  });
});
