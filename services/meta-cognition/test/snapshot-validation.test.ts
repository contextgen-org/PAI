import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";

import type {
  TriggerProcessSnapshotResolverPortV1,
} from "../src/index.js";
import {
  canonicalJsonV1,
  MetaCognitionErrorV1,
} from "../src/index.js";
import {
  AT,
  createAndLease,
  createHarness,
  createRequest,
  providerOutput,
  RETENTION,
  SNAPSHOT_HASH,
  snapshotHashForFixtureV1,
  validSnapshotRead,
} from "./fixtures.js";

describe("Meta Cognition fixed snapshot boundary", () => {
  it.each([
    [
      "reference",
      validSnapshotRead({ read: { snapshot_ref: "other-snapshot" } }),
    ],
    [
      "hash",
      validSnapshotRead({
        snapshot: { snapshot_hash: `sha256:${"9".repeat(64)}` },
      }),
    ],
    [
      "manifest bytes behind a stale self-reported hash",
      validSnapshotRead({
        snapshot: { open_loops: ["tampered-open-loop"] },
      }),
    ],
    [
      "scope",
      validSnapshotRead({ snapshot: { bot_id: "other-bot" } }),
    ],
    [
      "cooldown boundary",
      validSnapshotRead({
        snapshot: { cooldown_until: "2026-07-23T00:11:00.000Z" },
      }),
    ],
    [
      "range",
      validSnapshotRead({
        snapshot: {
          input_event_range: {
            first_append_sequence_no: 1,
            last_append_sequence_no: 2,
          },
          last_append_sequence_no: 2,
        },
      }),
    ],
    [
      "overflow/redaction",
      validSnapshotRead({
        snapshot: {
          input_event_range: {
            first_append_sequence_no: 1,
            last_append_sequence_no: 1,
          },
          last_append_sequence_no: 1,
          overflow_refs: [
            {
              schema_version: "snapshot_overflow_ref.v1",
              source_service: "action_runtime",
              store_type: "runtime_events",
              object_ref: "overflow-1",
              first_append_sequence_no: 1,
              last_append_sequence_no: 1,
              checksum_algorithm: "sha256",
              checksum: `sha256:${"3".repeat(64)}`,
              retention_until: RETENTION,
              redaction_state: "pending",
            },
          ],
        },
        read: {
          content_chunks: [
            {
              source_service: "action_runtime",
              first_append_sequence_no: 1,
              last_append_sequence_no: 1,
              checksum_algorithm: "sha256",
              checksum: `sha256:${"3".repeat(64)}`,
              owner_content_ref: "overflow-1",
              retention_until: RETENTION,
              redaction_state: "pending",
            },
          ],
        },
      }),
    ],
    [
      "runtime token",
      validSnapshotRead({
        snapshot: { runtime: { token: "must-not-persist" } },
      }),
    ],
    [
      "additional manifest property",
      validSnapshotRead({
        snapshot: { undeclared_owner_fact: "must-not-enter-prompt" },
      }),
    ],
  ])("fails closed on snapshot %s drift", async (_name, read) => {
    let providerCalls = 0;
    const harness = createHarness({
      snapshot_resolver: {
        async resolve() {
          return read;
        },
      },
      provider: {
        async generate() {
          providerCalls += 1;
          return providerOutput();
        },
      },
    });
    const { lease } = await createAndLease(harness);
    const response = await harness.application.runJob(lease);
    expect(response).toMatchObject({
      outcome: "failed",
      failure: { source: "snapshot", retryable: false },
    });
    expect(providerCalls).toBe(0);
  });

  it("rejects inline snapshot content whose bytes do not match the owner checksum", async () => {
    const originalInlineContent = {
      schema_version: "runtime_event.v1",
      value: "original",
    };
    const checksum =
      `sha256:${createHash("sha256")
        .update(canonicalJsonV1(originalInlineContent), "utf8")
        .digest("hex")}` as `sha256:${string}`;
    const read = validSnapshotRead({
      snapshot: {
        event_trace: [
          {
            source_service: "action_runtime",
            source_event_id: "runtime-event-1",
            source_sequence_no: 1,
            append_sequence_no: 1,
            payload_ref: "runtime-event-ref-1",
            payload_hash: checksum,
            created_at: AT,
            event_type: "runtime.step.completed",
            schema_version: "runtime.step.completed.v1",
            occurred_at: AT,
            runtime_run_id: null,
            artifact_refs: [],
          },
        ],
        input_event_range: {
          first_append_sequence_no: 1,
          last_append_sequence_no: 1,
        },
        last_append_sequence_no: 1,
        last_sequence_by_source: { action_runtime: 1 },
      },
      read: {
        content_chunks: [
          {
            source_service: "action_runtime",
            first_append_sequence_no: 1,
            last_append_sequence_no: 1,
            checksum_algorithm: "sha256",
            checksum,
            inline_content: {
              schema_version: "runtime_event.v1",
              value: "tampered-after-checksum",
            },
            retention_until: RETENTION,
            redaction_state: "complete",
          },
        ],
      },
    });
    read.snapshot_manifest.snapshot_hash = snapshotHashForFixtureV1(
      read.snapshot_manifest,
    );
    let providerCalls = 0;
    const harness = createHarness({
      snapshot_resolver: {
        async resolve() {
          return read;
        },
      },
      provider: {
        async generate() {
          providerCalls += 1;
          return providerOutput();
        },
      },
    });
    const created = await harness.application.createJob(
      createRequest({ snapshot_hash: read.snapshot_manifest.snapshot_hash }),
    );
    const lease = await harness.application.acquireLease({
      job_id: created.job_id,
      owner_id: "worker-1",
      expected_generation: 0,
      trace_id: "lease-inline-checksum",
    });

    await expect(harness.application.runJob(lease)).resolves.toMatchObject({
      outcome: "failed",
      failure: { code: "snapshot_invalid", retryable: false },
    });
    expect(providerCalls).toBe(0);
  });

  it("rejects deeply nested owner data before recursive schema validation", async () => {
    let deeplyNested: unknown = { value: "leaf" };
    for (let depth = 0; depth < 70; depth += 1) {
      deeplyNested = { child: deeplyNested };
    }
    const read = validSnapshotRead({
      read: { undeclared_deep_value: deeplyNested },
    });
    let providerCalls = 0;
    const harness = createHarness({
      snapshot_resolver: {
        async resolve() {
          return read;
        },
      },
      provider: {
        async generate() {
          providerCalls += 1;
          return providerOutput();
        },
      },
    });
    const { lease } = await createAndLease(harness);

    await expect(harness.application.runJob(lease)).resolves.toMatchObject({
      outcome: "failed",
      failure: { code: "snapshot_invalid", retryable: false },
    });
    expect(providerCalls).toBe(0);
  });

  it("rejects accessor-bearing owner data without invoking the accessor", async () => {
    const read = validSnapshotRead();
    let getterCalls = 0;
    Object.defineProperty(read, "undeclared_owner_fact", {
      configurable: true,
      enumerable: true,
      get() {
        getterCalls += 1;
        return "must not be observed";
      },
    });
    const harness = createHarness({
      snapshot_resolver: {
        async resolve() {
          return read;
        },
      },
    });
    const { lease } = await createAndLease(harness);

    await expect(harness.application.runJob(lease)).resolves.toMatchObject({
      outcome: "failed",
      failure: { code: "snapshot_invalid", retryable: false },
    });
    expect(getterCalls).toBe(0);
  });

  it("maps transient owner overflow failure to retry_wait", async () => {
    const error = Object.assign(new Error("overflow unavailable"), {
      code: "snapshot_overflow_unreadable",
    });
    const resolver: TriggerProcessSnapshotResolverPortV1 = {
      async resolve() {
        throw error;
      },
    };
    const harness = createHarness({ snapshot_resolver: resolver });
    const { lease } = await createAndLease(harness);
    await expect(harness.application.runJob(lease)).resolves.toMatchObject({
      outcome: "retry_wait",
      failure: {
        code: "snapshot_overflow_unreadable",
        retryable: true,
      },
    });
  });

  it("never persists a provider error containing credentials, URLs, or prompts", async () => {
    const secretError =
      "POST https://user:password@provider.invalid/v1 Authorization: Bearer provider-token prompt=private-user-content";
    const harness = createHarness({
      provider: {
        async generate() {
          throw new Error(secretError);
        },
      },
    });
    const { lease } = await createAndLease(harness);

    await expect(harness.application.runJob(lease)).resolves.toMatchObject({
      outcome: "retry_wait",
      failure: {
        code: "meta_job_failed",
        message: "Meta job execution failed",
        retryable: true,
      },
      job: {
        error: {
          code: "meta_job_failed",
          message: "Meta job execution failed",
        },
      },
    });
    expect(JSON.stringify(harness.repository.inspect())).not.toContain(
      secretError,
    );
    expect(JSON.stringify(harness.repository.inspect())).not.toContain(
      "provider-token",
    );
    expect(JSON.stringify(harness.repository.inspect())).not.toContain(
      "private-user-content",
    );
  });

  it("never persists a downstream contract error message supplied by an adapter", async () => {
    const secretError =
      "POST https://user:password@memory.invalid Authorization: Bearer memory-token prompt=private-memory";
    const harness = createHarness({
      memory: {
        async writeBatch() {
          throw new MetaCognitionErrorV1(
            "downstream_invalid",
            secretError,
            false,
          );
        },
      },
    });
    const { lease } = await createAndLease(harness);

    await expect(harness.application.runJob(lease)).resolves.toMatchObject({
      outcome: "failed",
      failure: {
        code: "downstream_invalid",
        message: "Memory returned an invalid owner response",
        retryable: false,
      },
      job: {
        error: {
          code: "downstream_invalid",
          message: "Memory returned an invalid owner response",
        },
      },
    });
    const durableState = JSON.stringify(harness.repository.inspect());
    expect(durableState).not.toContain(secretError);
    expect(durableState).not.toContain("memory-token");
    expect(durableState).not.toContain("private-memory");
  });

  it("rejects a fixed snapshot after its retained-until instant", async () => {
    const retention = "2026-07-23T00:00:30.000Z";
    const harness = createHarness({
      snapshot_resolver: {
        async resolve() {
          return validSnapshotRead({
            snapshot: {
              snapshot_retention_until: retention,
              cooldown_until: "2026-07-23T00:00:10.000Z",
            },
          });
        },
      },
    });
    const created = await harness.application.createJob(
      createRequest({
        snapshot_hash: SNAPSHOT_HASH,
        snapshot_retention_until: retention,
        cooldown_until: "2026-07-23T00:00:10.000Z",
      }),
    );
    const lease = await harness.application.acquireLease({
      job_id: created.job_id,
      owner_id: "worker-1",
      expected_generation: 0,
      trace_id: "lease-1",
    });
    harness.advance(31_000);
    const response = await harness.application.runJob(lease);
    expect(response).toMatchObject({
      outcome: "failed",
      failure: { code: "snapshot_invalid" },
    });
  });

  it("rejects provider evidence that is absent from the resolved snapshot", async () => {
    const harness = createHarness({
      provider: {
        async generate() {
          return providerOutput({
            evidence_refs: ["artifact:invented-evidence"],
            memory_writes: [
              {
                item_id: "memory-1",
                payload: {
                  client_item_id: "memory-1",
                  content_summary: "bad evidence",
                  subject_refs: [
                    { subject_type: "user", canonical_id: "user-1" },
                  ],
                  human_agent_relation: [],
                  keyword_tags: [],
                  scene_tags: ["implementation"],
                  emotion_tags: ["neutral"],
                  source_info: {
                    source_type: "trigger_snapshot",
                    source_ref: "artifact:invented-evidence",
                    actor_type: "system",
                  },
                  confidence_score: 0.5,
                  occurred_at: AT,
                },
                evidence_refs: ["artifact:invented-evidence"],
              },
            ],
          });
        },
      },
    });
    const { lease } = await createAndLease(harness);
    const response = await harness.application.runJob(lease);
    expect(response).toMatchObject({
      outcome: "failed",
      failure: {
        code: "evidence_invalid",
        retryable: false,
      },
    });
    expect(harness.counts().memory).toBe(0);
  });
});
