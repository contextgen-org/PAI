import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import type { ObjectStorePortV1 } from "../src/object-store-port.v1.js";
import { PAI_OBJECT_CLASS_POLICY_BASES_V1 } from "../src/object-store-policy.v1.js";
import {
  DurableSupabaseObjectStoreV1,
  createDurableSupabaseObjectStoreAdapterV1,
} from "../src/supabase-tus-object-store-adapter.v1.js";

const policy = {
  ...PAI_OBJECT_CLASS_POLICY_BASES_V1.trigger_process_snapshot,
  max_size_bytes: 16 * 1024 * 1024,
  media_types: ["application/octet-stream"],
};

const scope = Object.freeze({
  scope_kind: "bot" as const,
  workspace_id: "workspace-1",
  bot_id: "bot-1",
  owner_agent_id: "agent-1",
  deployment_environment: "dev",
  release_channel: "stable",
});

async function* bodyV1(value: Uint8Array): AsyncIterable<Uint8Array> {
  yield value;
}

function digestV1(value: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function putRequestV1(
  body: Uint8Array,
): Parameters<ObjectStorePortV1["putImmutable"]>[0] {
  return {
    owner_service: "trigger_processor",
    owner_object_id: "trigger-process-1",
    owner_state_version: 1,
    object_class: "trigger_process_snapshot",
    scope,
    capability: "trigger_process.snapshot.manage",
    idempotency_key: `put-${body.byteLength}`,
    expected_sha256: digestV1(body),
    size_bytes: body.byteLength,
    media_type: "application/octet-stream",
    retention_until: "2026-07-28T00:00:00.000Z",
    body: bodyV1(body),
  };
}

function decodeTusMetadataV1(value: string): Record<string, string> {
  return Object.fromEntries(
    value.split(",").map((entry) => {
      const separator = entry.indexOf(" ");
      return [
        entry.slice(0, separator),
        Buffer.from(entry.slice(separator + 1), "base64").toString("utf8"),
      ];
    }),
  );
}

function createHarnessV1(
  options: Readonly<{ failInfo?: boolean; failMark?: boolean }> = {},
) {
  const events: string[] = [];
  let stored:
    | Readonly<{
        bucket: string;
        key: string;
        body: Uint8Array;
        metadata: Record<string, unknown>;
      }>
    | undefined;
  let pending:
    | Readonly<{
        bucket: string;
        key: string;
        metadata: Record<string, unknown>;
        expectedSize: number | undefined;
        body: Uint8Array;
      }>
    | undefined;

  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input.toString());
    const method = init?.method ?? "GET";
    const headers = new Headers(init?.headers);

    if (method === "POST" && url.pathname === "/storage/v1/upload/resumable") {
      events.push("tus.post");
      expect(headers.get("upload-defer-length")).toBe("1");
      expect(headers.has("upload-length")).toBe(false);
      const tus = decodeTusMetadataV1(headers.get("upload-metadata") ?? "");
      const wrapper = JSON.parse(tus.metadata) as { pai: string };
      pending = {
        bucket: tus.bucketName,
        key: tus.objectName,
        metadata: { pai: wrapper.pai },
        expectedSize: undefined,
        body: new Uint8Array(),
      };
      return new Response(null, {
        status: 201,
        headers: {
          location: "https://storage.test.invalid/storage/v1/upload/resumable/upload-1",
        },
      });
    }

    if (method === "PATCH" && url.pathname.endsWith("/upload-1")) {
      events.push("tus.patch");
      expect(pending).toBeDefined();
      const bytes = new Uint8Array(await new Response(init?.body).arrayBuffer());
      const expectedSize = Number(headers.get("upload-length"));
      expect(Number.isSafeInteger(expectedSize)).toBe(true);
      pending = { ...pending!, expectedSize, body: bytes };
      expect(bytes.byteLength).toBe(expectedSize);
      stored = {
        bucket: pending.bucket,
        key: pending.key,
        body: bytes,
        metadata: pending.metadata,
      };
      return new Response(null, {
        status: 204,
        headers: { "upload-offset": String(bytes.byteLength) },
      });
    }

    if (method === "DELETE" && url.pathname.endsWith("/upload-1")) {
      events.push("tus.delete");
      pending = undefined;
      return new Response(null, { status: 204 });
    }

    const objectUploadMarker = "/storage/v1/object/";
    if (method === "POST" && url.pathname.includes(objectUploadMarker)) {
      events.push("storage.zero.put");
      expect(pending).toBeUndefined();
      const path = url.pathname.slice(url.pathname.indexOf(objectUploadMarker) + objectUploadMarker.length);
      const separator = path.indexOf("/");
      const metadataHeader = headers.get("x-metadata");
      expect(separator).toBeGreaterThan(0);
      expect(metadataHeader).not.toBeNull();
      const uploaded = new Uint8Array(await new Response(init?.body).arrayBuffer());
      expect(uploaded.byteLength).toBe(0);
      stored = {
        bucket: path.slice(0, separator),
        key: path.slice(separator + 1),
        body: uploaded,
        metadata: JSON.parse(Buffer.from(metadataHeader!, "base64").toString("utf8")) as Record<string, unknown>,
      };
      return Response.json({ Id: "object-1", Key: path });
    }

    const infoMarker = "/storage/v1/object/info/";
    if (method === "GET" && url.pathname.includes(infoMarker)) {
      events.push("storage.info");
      if (options.failInfo === true) {
        return Response.json({ message: "provider unavailable" }, { status: 503 });
      }
      if (stored === undefined) {
        return Response.json({ message: "not found" }, { status: 404 });
      }
      const canonical = JSON.parse(stored.metadata.pai as string) as {
        media_type: string;
      };
      return Response.json({
        id: "object-1",
        name: stored.key,
        bucket_id: stored.bucket,
        version: "version-1",
        size: stored.body.byteLength,
        content_type: canonical.media_type,
        metadata: stored.metadata,
      });
    }

    const getMarker = "/storage/v1/object/authenticated/";
    if (method === "GET" && url.pathname.includes(getMarker)) {
      events.push("storage.get");
      return stored === undefined
        ? new Response(null, { status: 404 })
        : new Response(stored.body, {
            status: 200,
            headers: { "content-length": String(stored.body.byteLength) },
          });
    }

    throw new Error(`unexpected Supabase request: ${method} ${url.pathname}`);
  }) as typeof fetch;

  const repository = {
    kind: "postgres.v1",
    deploymentReadiness: "unverified_pai_infra",
    ownerService: "trigger_processor",
    expectedRole: "pai_trigger_processor_app",
    expectedReconcilerRole: "pai_object_store_reconciler_app",
    reconcilerReady: true,
    async reserveObjectOperation(request: Record<string, unknown>) {
      events.push("db.reserve");
      expect(request).not.toHaveProperty("deletion_decision_version");
      return { kind: "reserved", reservation_id: "reservation-1", generation: 1 };
    },
    async startObjectOperationAttempt() {
      events.push("db.start");
      return { attempt_id: "attempt-1", generation: 2 };
    },
    async markObjectOperationCommitUnknown() {
      events.push("db.mark");
      if (options.failMark === true) throw new Error("mark unavailable");
      return { generation: 3 };
    },
    async finalizeObjectOperation(request: {
      outcome: { opaque_ref?: string };
    }) {
      events.push("db.finalize");
      return {
        status: "succeeded",
        opaque_ref: request.outcome.opaque_ref ?? null,
      };
    },
    async getObjectOperationResult() {
      events.push("db.result");
      return { commit_unknown_evidence: null };
    },
  };

  const adapterOptions = {
    url: "https://storage.test.invalid",
    secretKey: "test-secret",
    metadataRepository: repository as never,
    terminalProofReadiness: { async reconcileTerminalProofs() {} },
    accessPolicyVerifier: {
      async verify() {
        throw new Error("unused");
      },
    },
    policies: [policy],
    now: () => new Date("2026-07-27T00:00:00.000Z"),
    fetch: fetchImpl,
  } as const;
  const adapter = new DurableSupabaseObjectStoreV1(adapterOptions);
  const store = createDurableSupabaseObjectStoreAdapterV1(adapterOptions);

  return { adapter, events, store };
}

describe("durable Supabase TUS ObjectStore", () => {
  it.each([
    ["non-empty", new TextEncoder().encode("abc")],
    ["zero-byte", new Uint8Array()],
  ])("durably binds the unique upload URL before the first %s PATCH", async (_name, body) => {
    const harness = createHarnessV1();
    const result = await harness.store.putImmutable(putRequestV1(body));

    expect(result).toMatchObject({
      replayed: false,
      size_bytes: body.byteLength,
      sha256: digestV1(body),
    });
    expect(harness.events).toEqual([
      "db.reserve",
      "db.start",
      "tus.post",
      "db.mark",
      ...(body.byteLength === 0 ? ["tus.delete", "storage.zero.put"] : ["tus.patch"]),
      "storage.info",
      "storage.get",
      "db.finalize",
    ]);
  });

  it("terminalizes the deferred TUS upload and never PATCHes bytes when PG binding fails", async () => {
    const harness = createHarnessV1({ failMark: true });

    await expect(
      harness.store.putImmutable(putRequestV1(new TextEncoder().encode("abc"))),
    ).rejects.toMatchObject({
      code: "storage_unavailable",
      details: { reconciliation_required: true },
    });
    expect(harness.events).toEqual([
      "db.reserve",
      "db.start",
      "tus.post",
      "db.mark",
      "tus.delete",
    ]);
  });

  it("retries when provider HEAD is unavailable instead of proving false absence", async () => {
    const harness = createHarnessV1({ failInfo: true });
    const hash = (character: string) => `sha256:${character.repeat(64)}` as const;
    const settlement = await harness.adapter.reconcileClaim({
      contract_version: "object_store_metadata.v1",
      operation: "put_immutable",
      owner_service: "trigger_processor",
      owner_object_id: "trigger-process-1",
      owner_state_version: 1,
      object_class: "trigger_process_snapshot",
      scope,
      idempotency_key: "put-reconcile-1",
      request_hash: hash("a"),
      object_fingerprint: hash("b"),
      expected_digest: hash("c"),
      expected_size_bytes: 3,
      media_type: "application/octet-stream",
      retention_until: "2026-07-28T00:00:00.000Z",
      deletion_decision_version: null,
      gc_not_before: "2026-07-28T00:00:00.000Z",
      reservation_id: "reservation-1",
      claim_token: "claim-1",
      claim_generation: 1,
      claim_lease_expires_at: "2026-07-27T00:01:00.000Z",
      database_now: "2026-07-27T00:00:00.000Z",
      reservation_generation: 2,
    });

    expect(settlement).toMatchObject({
      kind: "retry_wait",
      error: { error_code: "physical_object_head_unavailable", retryable: true },
    });
    expect(harness.events).toEqual(["db.result", "storage.info"]);
  });
});
