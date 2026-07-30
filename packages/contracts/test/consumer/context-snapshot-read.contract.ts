import {
  ContextSnapshotContentChunkV1Schema,
  ContextSnapshotReadContractV1Schema,
  ContextSnapshotReadErrorV1Schema,
  ContextSnapshotResolveRequestV1Schema,
  assertContextSnapshotReadBindingsV1,
  type ContextSnapshotV1,
} from "../../src/index.js";
import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

const at = "2026-07-30T00:00:00.000Z";
const snapshotHash = `sha256:${"a".repeat(64)}` as const;

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
  return { ...partial, snapshot_hash: snapshotHash };
}

describe("Context snapshot owner read contract", () => {
  it("binds the exact ref/version/hash, scope and trace", () => {
    const value = snapshot();
    const request = {
      schema_version: "context_snapshot_resolve_request.v1" as const,
      consumer_service: "action_runtime" as const,
      trigger_process_id: value.trigger_process_id,
      workspace_id: value.workspace_id,
      bot_id: value.bot_id,
      owner_agent_id: value.owner_agent_id,
      deployment_environment: value.deployment_environment,
      release_channel: value.release_channel,
      context_snapshot_ref: "context:1",
      context_snapshot_version: value.context_version,
      context_snapshot_hash: value.snapshot_hash,
      purpose: "runtime_start" as const,
      trace_id: "trace-1",
    };
    const response = {
      schema_version: "context_snapshot_read.v1" as const,
      context_snapshot_ref: request.context_snapshot_ref,
      context_snapshot_version: request.context_snapshot_version,
      context_snapshot_hash: request.context_snapshot_hash,
      canonical_bytes_sha256: `sha256:${"b".repeat(64)}` as const,
      content_length_bytes: 1024,
      delivery_mode: "inline" as const,
      context_snapshot: value,
      chunks: null,
      retention_until: "2026-08-30T00:00:00.000Z",
      redaction_state: "complete" as const,
      resolved_at: at,
      trace_id: request.trace_id,
    };
    expect(Value.Check(ContextSnapshotResolveRequestV1Schema, request)).toBe(true);
    expect(Value.Check(ContextSnapshotReadContractV1Schema, response)).toBe(true);
    expect(() => assertContextSnapshotReadBindingsV1(request, response)).not.toThrow();
    expect(() =>
      assertContextSnapshotReadBindingsV1(request, {
        ...response,
        context_snapshot_hash: `sha256:${"0".repeat(64)}`,
      }),
    ).toThrow(/identity binding/u);
  });

  it("requires the closed consumer_service binding and rejects owner URI aliases", () => {
    const value = snapshot();
    const request = {
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
    expect(Value.Check(ContextSnapshotResolveRequestV1Schema, request)).toBe(
      true,
    );
    const { consumer_service: _, ...withoutConsumer } = request;
    expect(
      Value.Check(ContextSnapshotResolveRequestV1Schema, withoutConsumer),
    ).toBe(false);
    expect(
      Value.Check(ContextSnapshotResolveRequestV1Schema, {
        ...request,
        consumer_service: "meta_cognition",
      }),
    ).toBe(false);
    expect(
      Value.Check(ContextSnapshotResolveRequestV1Schema, {
        ...request,
        owner_uri: "s3://bucket/context.json",
      }),
    ).toBe(false);
  });

  it("publishes an exclusive bounded chunk wire and the five-code error envelope", () => {
    const chunk = {
      ordinal: 0,
      byte_offset: 0,
      byte_length: 3,
      canonical_bytes_base64: "e30K",
      chunk_sha256: `sha256:${"c".repeat(64)}`,
    };
    expect(Value.Check(ContextSnapshotContentChunkV1Schema, chunk)).toBe(true);
    expect(
      Value.Check(ContextSnapshotContentChunkV1Schema, {
        ...chunk,
        ordinal: 256,
      }),
    ).toBe(false);

    expect(
      Value.Check(ContextSnapshotReadContractV1Schema, {
        schema_version: "context_snapshot_read.v1",
        context_snapshot_ref: "context:1",
        context_snapshot_version: 1,
        context_snapshot_hash: snapshotHash,
        canonical_bytes_sha256: `sha256:${"b".repeat(64)}`,
        content_length_bytes: 3,
        delivery_mode: "chunked",
        context_snapshot: null,
        chunks: [chunk],
        retention_until: "2026-08-30T00:00:00.000Z",
        redaction_state: "complete",
        resolved_at: at,
        trace_id: "trace-1",
      }),
    ).toBe(true);
    expect(
      Value.Check(ContextSnapshotReadErrorV1Schema, {
        schema_version: "context_snapshot_read_error.v1",
        code: "hash_mismatch",
        message: "Context snapshot hash mismatch",
        retryable: false,
        trace_id: "trace-1",
        details: {
          trigger_process_id: "process-1",
          context_snapshot_ref: "context:1",
          context_snapshot_version: 1,
        },
      }),
    ).toBe(true);
    expect(
      Value.Check(ContextSnapshotReadErrorV1Schema, {
        schema_version: "context_snapshot_read_error.v1",
        code: "dependency_unavailable",
        message: "not part of the closed set",
        retryable: true,
        trace_id: "trace-1",
        details: {},
      }),
    ).toBe(false);
  });
});
