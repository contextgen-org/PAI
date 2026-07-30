import { createHash } from "node:crypto";

import type {
  ContextSnapshotReadContractV1,
  ContextSnapshotResolveRequestV1,
  ContextSnapshotV1,
} from "@pai/contracts";
import { describe, expect, it } from "vitest";

import {
  canonicalJsonV1,
  canonicalPayloadHashV1,
  materializeContextSnapshotReadV1,
} from "../src/index.js";

const at = "2026-07-30T00:00:00.000Z";
const retention = "2026-08-30T00:00:00.000Z";

function sha256(value: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function snapshot(): ContextSnapshotV1 {
  const value = {
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
    skill_catalog: null,
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
      { source: "skill" as const, status: "failed" as const, retrieved_at: at, source_as_of: null, source_version: null, latency_ms: 1, result_count: 0, failure_reason: "skill_unavailable" },
      { source: "environment" as const, status: "ok" as const, retrieved_at: at, source_as_of: at, source_version: "environment.v1", latency_ms: 1, result_count: 1, failure_reason: null },
      { source: "history" as const, status: "empty" as const, retrieved_at: at, source_as_of: at, source_version: "history.v1", latency_ms: 1, result_count: 0, failure_reason: null },
    ],
    assembly_notes: ["skill_unavailable"],
  };
  return { ...value, snapshot_hash: canonicalPayloadHashV1(value) };
}

function request(value = snapshot()): ContextSnapshotResolveRequestV1 {
  return {
    schema_version: "context_snapshot_resolve_request.v1",
    consumer_service: "action_runtime",
    trigger_process_id: value.trigger_process_id,
    workspace_id: value.workspace_id,
    bot_id: value.bot_id,
    owner_agent_id: value.owner_agent_id,
    deployment_environment: value.deployment_environment,
    release_channel: value.release_channel,
    context_snapshot_ref: "context:1",
    context_snapshot_version: value.context_version,
    context_snapshot_hash: value.snapshot_hash,
    purpose: "runtime_start",
    trace_id: "trace-1",
  };
}

function inlineRead(value = snapshot()): ContextSnapshotReadContractV1 {
  const bytes = Buffer.from(canonicalJsonV1(value), "utf8");
  return {
    schema_version: "context_snapshot_read.v1",
    context_snapshot_ref: "context:1",
    context_snapshot_version: value.context_version,
    context_snapshot_hash: value.snapshot_hash,
    canonical_bytes_sha256: sha256(bytes),
    content_length_bytes: bytes.byteLength,
    delivery_mode: "inline",
    context_snapshot: value,
    chunks: null,
    retention_until: retention,
    redaction_state: "complete",
    resolved_at: at,
    trace_id: "trace-1",
  };
}

function chunkedRead(value = snapshot()): ContextSnapshotReadContractV1 {
  const bytes = Buffer.from(canonicalJsonV1(value), "utf8");
  const boundary = Math.floor(bytes.byteLength / 2);
  const parts = [bytes.subarray(0, boundary), bytes.subarray(boundary)];
  let offset = 0;
  const chunks = parts.map((part, ordinal) => {
    const chunk = {
      ordinal,
      byte_offset: offset,
      byte_length: part.byteLength,
      canonical_bytes_base64: part.toString("base64"),
      chunk_sha256: sha256(part),
    };
    offset += part.byteLength;
    return chunk;
  });
  return {
    schema_version: "context_snapshot_read.v1",
    context_snapshot_ref: "context:1",
    context_snapshot_version: value.context_version,
    context_snapshot_hash: value.snapshot_hash,
    canonical_bytes_sha256: sha256(bytes),
    content_length_bytes: bytes.byteLength,
    delivery_mode: "chunked",
    context_snapshot: null,
    chunks: chunks.reverse(),
    retention_until: retention,
    redaction_state: "complete",
    resolved_at: at,
    trace_id: "trace-1",
  };
}

describe("ContextSnapshot owner-read materializer", () => {
  it("verifies inline and ordinal-sorted chunked canonical bytes", () => {
    const value = snapshot();
    expect(
      materializeContextSnapshotReadV1(request(value), inlineRead(value), {
        now: () => new Date(at),
      }),
    ).toEqual(value);
    expect(
      materializeContextSnapshotReadV1(request(value), chunkedRead(value), {
        now: () => new Date(at),
      }),
    ).toEqual(value);
  });

  it("deep-freezes the verified snapshot before handing it to a consumer", () => {
    const value = snapshot();
    const materialized = materializeContextSnapshotReadV1(
      request(value),
      inlineRead(value),
      { now: () => new Date(at) },
    );

    expect(Object.isFrozen(materialized)).toBe(true);
    expect(Object.isFrozen(materialized.environment)).toBe(true);
    expect(Object.isFrozen(materialized.source_status)).toBe(true);
    expect(Object.isFrozen(materialized.source_status[0])).toBe(true);
    expect(() => {
      (
        materialized.source_status as unknown as Array<
          ContextSnapshotV1["source_status"][number]
        >
      ).push(materialized.source_status[0]!);
    }).toThrow(TypeError);
    expect(materialized.source_status).toHaveLength(5);
  });

  it("fails closed on chunk gaps, physical digest drift and expiry", () => {
    const value = snapshot();
    const chunked = chunkedRead(value);
    if (chunked.delivery_mode !== "chunked") throw new Error("test fixture");
    expect(() =>
      materializeContextSnapshotReadV1(
        request(value),
        {
          ...chunked,
          chunks: chunked.chunks.map((chunk) =>
            chunk.ordinal === 1 ? { ...chunk, byte_offset: 0 } : chunk,
          ),
        },
        { now: () => new Date(at) },
      ),
    ).toThrow(/contiguous/u);
    expect(() =>
      materializeContextSnapshotReadV1(
        request(value),
        {
          ...inlineRead(value),
          canonical_bytes_sha256: `sha256:${"0".repeat(64)}`,
        },
        { now: () => new Date(at) },
      ),
    ).toThrow(/integrity/u);
    expect(() =>
      materializeContextSnapshotReadV1(
        request(value),
        { ...inlineRead(value), retention_until: at },
        { now: () => new Date(at) },
      ),
    ).toThrow(/expired/u);
  });

  it("does not let a valid physical digest substitute for the logical hash", () => {
    const value = snapshot();
    const tampered = {
      ...value,
      assembly_notes: [...value.assembly_notes, "tampered"],
    };
    const response = inlineRead(tampered);
    expect(() =>
      materializeContextSnapshotReadV1(request(value), response, {
        now: () => new Date(at),
      }),
    ).toThrow(/logical hash/u);
  });
});
