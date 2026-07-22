import { createHash, randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ObjectStoreErrorV1,
  type ObjectRefV1,
  type ObjectScopeV1,
  type ObjectStorePortV1,
  type ObjectStoreReconciliationPortV1,
} from "../src/index.js";
import {
  PAI_OBJECT_CLASS_POLICY_BASES_V1,
  SupabaseStorageAdapter,
  ObjectStoreReconciliationWorkerV1,
  type ObjectAccessOperationV1,
  type ObjectAccessPolicyVerifierV1,
  type ObjectClassPolicyV1,
  type VerifiedObjectAccessDecisionV1,
  type VerifyObjectAccessDecisionInputV1,
} from "../src/composition.js";
import { InMemoryObjectStoreAdapterV1 } from "../src/in-memory-object-store-adapter.v1.js";
import {
  InMemoryObjectMetadataRepositoryV1,
  type ObjectMetadataRepositoryV1,
} from "../src/object-metadata-repository.v1.js";
import {
  InMemoryObjectStorageBackendV1,
  ObjectStorageBackendErrorV1,
  type BackendObjectHeadV1,
  type BackendObjectRangeV1,
  type BackendObjectStreamV1,
  type ObjectStorageBackendV1,
  type PutBackendObjectV1,
} from "../src/object-storage-backend.v1.js";
import {
  ObjectStoreAdapterCoreV1,
  objectScopeFingerprintV1,
} from "../src/object-store-adapter-core.v1.js";
import { SupabaseObjectStorageBackendV1 } from "../src/supabase-storage-adapter.v1.js";

const policy: ObjectClassPolicyV1 = {
  ...PAI_OBJECT_CLASS_POLICY_BASES_V1.trigger_process_snapshot,
  max_size_bytes: 1024 * 1024,
  media_types: ["application/json", "application/octet-stream"],
};

const scope: ObjectScopeV1 = {
  scope_kind: "bot",
  workspace_id: "ws-1",
  bot_id: "bot-1",
  owner_agent_id: "agent-1",
  deployment_environment: "dev",
  release_channel: "stable",
};

const otherScope: ObjectScopeV1 = {
  ...scope,
  bot_id: "bot-2",
};

afterEach(() => {
  vi.useRealTimers();
});

function digest(body: Uint8Array): string {
  return `sha256:${createHash("sha256").update(body).digest("hex")}`;
}

async function* bytes(body: Uint8Array): AsyncIterable<Uint8Array> {
  const split = Math.floor(body.byteLength / 2);
  yield body.slice(0, split);
  yield body.slice(split);
}

async function readAll(body: AsyncIterable<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of body) {
    chunks.push(chunk);
    size += chunk.byteLength;
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

interface FakeStoredObject {
  readonly id: string;
  readonly version: string;
  readonly body: Uint8Array;
  readonly contentType: string;
  readonly sha256: string;
}

function fakeSupabaseClient(
  objects: Map<string, FakeStoredObject>,
): SupabaseClient {
  const storage = {
    from(bucket: string) {
      const identity = (key: string): string => `${bucket}/${key}`;
      return {
        async upload(
          key: string,
          body: ReadableStream<Uint8Array>,
          options: {
            contentType: string;
            metadata: { expected_sha256: string };
          },
        ) {
          const id = identity(key);
          if (objects.has(id)) {
            return {
              data: null,
              error: {
                message: "The resource already exists",
                status: 409,
                statusCode: "ResourceAlreadyExists",
              },
            };
          }
          const reader = body.getReader();
          const chunks: Uint8Array[] = [];
          let size = 0;
          while (true) {
            const next = await reader.read();
            if (next.done) break;
            chunks.push(next.value.slice());
            size += next.value.byteLength;
          }
          const storedBody = new Uint8Array(size);
          let offset = 0;
          for (const chunk of chunks) {
            storedBody.set(chunk, offset);
            offset += chunk.byteLength;
          }
          const object: FakeStoredObject = {
            id: randomUUID(),
            version: randomUUID(),
            body: storedBody,
            contentType: options.contentType,
            sha256: options.metadata.expected_sha256,
          };
          objects.set(id, object);
          return { data: { id: object.id, path: key, fullPath: id }, error: null };
        },
        async info(key: string) {
          const object = objects.get(identity(key));
          if (object === undefined) {
            return {
              data: null,
              error: { message: "not found", status: 404, statusCode: "NoSuchKey" },
            };
          }
          return {
            data: {
              id: object.id,
              version: object.version,
              name: key,
              bucketId: bucket,
              createdAt: "2026-07-20T00:00:00.000Z",
              size: object.body.byteLength,
              contentType: object.contentType,
              metadata: {
                size: object.body.byteLength,
                mimetype: object.contentType,
                expected_sha256: object.sha256,
              },
            },
            error: null,
          };
        },
        async download(key: string) {
          const object = objects.get(identity(key));
          return object === undefined
            ? {
                data: null,
                error: { message: "not found", status: 404, statusCode: "NoSuchKey" },
              }
            : { data: new Blob([object.body]), error: null };
        },
        async createSignedUrl(key: string, ttl: number) {
          return objects.has(identity(key))
            ? {
                data: {
                  signedUrl: `https://storage.invalid/read?token=fake&ttl=${ttl}`,
                },
                error: null,
              }
            : {
                data: null,
                error: { message: "not found", status: 404, statusCode: "NoSuchKey" },
              };
        },
        async remove(keys: string[]) {
          for (const key of keys) objects.delete(identity(key));
          return { data: [], error: null };
        },
      };
    },
  };
  return { storage } as unknown as SupabaseClient;
}

function fakeSupabaseFetch(
  objects: Map<string, FakeStoredObject>,
): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    expect(init?.redirect).toBe("error");
    const url = new URL(typeof input === "string" ? input : input.toString());
    const marker = "/storage/v1/object/authenticated/";
    const encodedIdentity = url.pathname.slice(url.pathname.indexOf(marker) + marker.length);
    const identity = encodedIdentity.split("/").map(decodeURIComponent).join("/");
    const object = objects.get(identity);
    if (object === undefined) return new Response(null, { status: 404, statusText: "not found" });
    const requestHeaders = new Headers(init?.headers);
    const rangeValue = requestHeaders.get("range");
    const match = rangeValue?.match(/^bytes=(\d+)-(\d+)$/);
    const start = match === null || match === undefined ? 0 : Number(match[1]);
    const requestedEnd = match === null || match === undefined
      ? object.body.byteLength - 1
      : Number(match[2]);
    const end = Math.min(requestedEnd, object.body.byteLength - 1);
    const selected = object.body.slice(start, end + 1);
    return new Response(selected, {
      status: match === undefined || match === null ? 200 : 206,
      headers: {
        "content-length": String(selected.byteLength),
        ...(match === undefined || match === null
          ? {}
          : { "content-range": `bytes ${start}-${end}/${object.body.byteLength}` }),
      },
    });
  }) as typeof fetch;
}

interface Harness {
  readonly store: ObjectStorePortV1;
  readonly metadata: InMemoryObjectMetadataRepositoryV1;
  readonly accessPolicy: TestObjectAccessPolicyVerifierV1;
  setNow(value: string): void;
}

class TestObjectAccessPolicyVerifierV1
  implements ObjectAccessPolicyVerifierV1
{
  readonly #decisions = new Map<string, VerifiedObjectAccessDecisionV1>();

  public authorize(
    input: Omit<VerifyObjectAccessDecisionInputV1, "access_decision_ref">,
    retentionUntil = "2026-07-21T00:00:00.000Z",
  ): Pick<
    VerifyObjectAccessDecisionInputV1,
    | "access_decision_ref"
    | "retention_policy_version"
    | "redaction_policy_version"
  > {
    const accessDecisionRef = `decision-${randomUUID()}`;
    this.#decisions.set(accessDecisionRef, {
      ...input,
      access_decision_ref: accessDecisionRef,
      authorized: true,
      retention_until: retentionUntil,
    });
    return {
      access_decision_ref: accessDecisionRef,
      retention_policy_version: input.retention_policy_version,
      redaction_policy_version: input.redaction_policy_version,
    };
  }

  public async verify(
    input: VerifyObjectAccessDecisionInputV1,
  ): Promise<VerifiedObjectAccessDecisionV1> {
    const decision = this.#decisions.get(input.access_decision_ref);
    if (decision === undefined) throw new Error("access decision not found");
    return decision;
  }
}

function authorizedRequest<
  T extends Pick<
    VerifyObjectAccessDecisionInputV1,
    "object_ref" | "owner_service" | "scope" | "capability"
  >,
>(
  harness: Harness,
  operation: ObjectAccessOperationV1,
  request: T,
  options: {
    readonly retentionUntil?: string;
    readonly retentionPolicyVersion?: string;
    readonly redactionPolicyVersion?: string;
  } = {},
): T &
  Pick<
    VerifyObjectAccessDecisionInputV1,
    | "access_decision_ref"
    | "retention_policy_version"
    | "redaction_policy_version"
  > {
  const retentionPolicyVersion =
    options.retentionPolicyVersion ?? "retention-v1";
  const redactionPolicyVersion =
    options.redactionPolicyVersion ?? "redaction-v1";
  const decision = harness.accessPolicy.authorize(
    {
      operation,
      object_ref: request.object_ref,
      owner_service: request.owner_service,
      scope: request.scope,
      capability: request.capability,
      scope_fingerprint: objectScopeFingerprintV1(request.scope),
      retention_policy_version: retentionPolicyVersion,
      redaction_policy_version: redactionPolicyVersion,
    },
    options.retentionUntil,
  );
  return { ...request, ...decision };
}

function createHarness(
  kind: "memory" | "supabase",
  metadata = new InMemoryObjectMetadataRepositoryV1(),
): Harness {
  const accessPolicy = new TestObjectAccessPolicyVerifierV1();
  let now = new Date("2026-07-20T00:00:00.000Z");
  const options = {
    metadataRepository: metadata,
    accessPolicyVerifier: accessPolicy,
    policies: [policy],
    now: () => now,
  };
  const store =
    kind === "memory"
      ? new InMemoryObjectStoreAdapterV1(options)
      : (() => {
          const objects = new Map<string, FakeStoredObject>();
          return new ObjectStoreAdapterCoreV1({
            ...options,
            backend: new SupabaseObjectStorageBackendV1(
              fakeSupabaseClient(objects),
              "https://storage.test.invalid",
              "test-secret",
              fakeSupabaseFetch(objects),
            ),
          });
        })();
  return {
    store,
    metadata,
    accessPolicy,
    setNow(value: string) {
      now = new Date(value);
    },
  };
}

function putRequest(
  body: Uint8Array,
  overrides: Partial<Parameters<ObjectStorePortV1["putImmutable"]>[0]> = {},
): Parameters<ObjectStorePortV1["putImmutable"]>[0] {
  return {
    owner_service: "trigger_processor",
    object_class: "trigger_process_snapshot",
    scope,
    capability: "trigger_process.snapshot.manage",
    idempotency_key: "put-1",
    expected_sha256: digest(body),
    size_bytes: body.byteLength,
    media_type: "application/json",
    retention_until: "2026-07-21T00:00:00.000Z",
    body: bytes(body),
    ...overrides,
  };
}

function expectCode(code: ObjectStoreErrorV1["code"]): (error: unknown) => boolean {
  return (error) => error instanceof ObjectStoreErrorV1 && error.code === code;
}

for (const kind of ["memory", "supabase"] as const) {
  describe(`${kind} ObjectStore adapter conformance`, () => {
    it("writes immutable bytes and supports head, full read, range, and short grant", async () => {
      const harness = createHarness(kind);
      const { store, metadata } = harness;
      const body = new TextEncoder().encode('{"state":"ready"}');
      const created = await store.putImmutable(putRequest(body));

      expect(created.replayed).toBe(false);
      expect(
        await store.head(
          authorizedRequest(harness, "head", {
            owner_service: "trigger_processor",
            scope,
            capability: "trigger_process.snapshot.resolve",
            object_ref: created.object_ref,
          }),
        ),
      ).toMatchObject({ sha256: digest(body), size_bytes: body.byteLength });

      const full = await store.getStream(
        authorizedRequest(harness, "get", {
          owner_service: "trigger_processor",
          scope,
          capability: "trigger_process.snapshot.resolve",
          object_ref: created.object_ref,
        }),
      );
      expect(await readAll(full.body)).toEqual(body);
      const ranged = await store.getStream(
        authorizedRequest(harness, "get", {
          owner_service: "trigger_processor",
          scope,
          capability: "trigger_process.snapshot.resolve",
          object_ref: created.object_ref,
          range: { offset: 2, length: 5 },
        }),
      );
      expect(await readAll(ranged.body)).toEqual(body.slice(2, 7));
      expect(ranged.content_range).toBe(`bytes 2-6/${body.byteLength}`);

      const grant = await store.issueReadGrant(
        authorizedRequest(harness, "grant", {
          owner_service: "trigger_processor",
          scope,
          capability: "trigger_process.snapshot.resolve",
          object_ref: created.object_ref,
          ttl_seconds: 300,
        }),
      );
      expect(grant.expires_at).toBe("2026-07-20T00:05:00.000Z");
      expect(grant.grant.length).toBeGreaterThan(0);

      const persisted = await metadata.findByRef(created.object_ref);
      expect(persisted).toBeDefined();
      expect(persisted).not.toHaveProperty("bucket");
      expect(persisted).not.toHaveProperty("key");
      expect(persisted).not.toHaveProperty("signed_url");
    });

    it("replays identical writes and rejects idempotency drift", async () => {
      const { store } = createHarness(kind);
      const body = new TextEncoder().encode("immutable");
      const first = await store.putImmutable(putRequest(body));
      const replay = await store.putImmutable(putRequest(body));
      expect(replay).toMatchObject({
        object_ref: first.object_ref,
        version: first.version,
        replayed: true,
      });

      await expect(
        store.putImmutable(
          putRequest(body, {
            media_type: "application/octet-stream",
            body: bytes(body),
          }),
        ),
      ).rejects.toSatisfy(expectCode("idempotency_conflict"));
    });

    it("handles corrupt or partial input without orphaning ambiguous uploads", async () => {
      const harness = createHarness(kind);
      const { store } = harness;
      const expected = new TextEncoder().encode("complete");
      const partial = new TextEncoder().encode("partial");
      const rejectedPut = expect(
        store.putImmutable(
          putRequest(partial, {
            expected_sha256: digest(expected),
            size_bytes: expected.byteLength,
          }),
        ),
      ).rejects;
      if (kind === "supabase") {
        await rejectedPut.toSatisfy(expectCode("integrity_mismatch"));
      } else {
        await rejectedPut.toSatisfy(
          (error: unknown) =>
            error instanceof ObjectStoreErrorV1 &&
            error.code === "storage_unavailable" &&
            error.details.reconciliation_required === true &&
            error.details.reconciliation_operation === "put_cleanup",
        );
        harness.setNow("2026-07-20T00:18:00.000Z");
        await expect(
          store.reconcilePending({
            worker_id: "integrity-cleanup-worker",
            limit: 1,
            lease_seconds: 30,
          }),
        ).resolves.toEqual({ claimed: 1, completed: 1, retry_scheduled: 0 });
        await expect(store.putImmutable(putRequest(expected))).resolves.toMatchObject({
          replayed: false,
        });
        return;
      }

      await expect(store.putImmutable(putRequest(expected))).resolves.toMatchObject({
        replayed: false,
      });
    });

    it("revalidates capability and exact scope on every read", async () => {
      const harness = createHarness(kind);
      const { store } = harness;
      const created = await store.putImmutable(
        putRequest(new TextEncoder().encode("scoped")),
      );
      await expect(
        store.head(
          authorizedRequest(harness, "head", {
            owner_service: "trigger_processor",
            scope: otherScope,
            capability: "trigger_process.snapshot.resolve",
            object_ref: created.object_ref,
          }),
        ),
      ).rejects.toSatisfy(expectCode("authorization_scope_mismatch"));
      await expect(
        store.head(
          authorizedRequest(harness, "head", {
            owner_service: "trigger_processor",
            scope,
            capability: "runtime.artifact.read",
            object_ref: created.object_ref,
          }),
        ),
      ).rejects.toSatisfy(expectCode("authorization_scope_mismatch"));
      await expect(
        store.issueReadGrant(
          authorizedRequest(harness, "grant", {
            owner_service: "trigger_processor",
            scope,
            capability: "trigger_process.snapshot.resolve",
            object_ref: created.object_ref,
            ttl_seconds: 301,
          }),
        ),
      ).rejects.toSatisfy(expectCode("precondition_failed"));
    });

    it("checks the owner access decision before object existence", async () => {
      const harness = createHarness(kind);
      const created = await harness.store.putImmutable(
        putRequest(new TextEncoder().encode("private")),
      );
      const unauthorized = {
        owner_service: "trigger_processor" as const,
        scope,
        capability: "trigger_process.snapshot.resolve",
        access_decision_ref: "decision-not-issued",
        retention_policy_version: "retention-v1",
        redaction_policy_version: "redaction-v1",
      };

      await expect(
        harness.store.head({
          ...unauthorized,
          object_ref: created.object_ref,
        }),
      ).rejects.toSatisfy(expectCode("authorization_scope_mismatch"));
      await expect(
        harness.store.head({
          ...unauthorized,
          object_ref: `object:${randomUUID()}` as ObjectRefV1,
        }),
      ).rejects.toSatisfy(expectCode("authorization_scope_mismatch"));
    });

    it("rejects a stale owner retention decision", async () => {
      const harness = createHarness(kind);
      const created = await harness.store.putImmutable(
        putRequest(new TextEncoder().encode("retention-bound")),
      );
      await expect(
        harness.store.head(
          authorizedRequest(
            harness,
            "head",
            {
              owner_service: "trigger_processor",
              scope,
              capability: "trigger_process.snapshot.resolve",
              object_ref: created.object_ref,
            },
            { retentionUntil: "2026-07-22T00:00:00.000Z" },
          ),
        ),
      ).rejects.toSatisfy(expectCode("authorization_scope_mismatch"));
    });

    it("keeps local, dev, staging, and prod scope identities isolated", async () => {
      const harness = createHarness(kind);
      const { store } = harness;
      const environments = ["local", "dev", "staging", "prod"] as const;
      const refs = new Map<string, ObjectRefV1>();
      for (const deployment_environment of environments) {
        const environmentScope: ObjectScopeV1 = {
          ...scope,
          deployment_environment,
        };
        const body = new TextEncoder().encode(deployment_environment);
        const created = await store.putImmutable(
          putRequest(body, {
            scope: environmentScope,
            idempotency_key: `put-${deployment_environment}`,
          }),
        );
        refs.set(deployment_environment, created.object_ref);
      }
      const prodRef = refs.get("prod");
      expect(prodRef).toBeDefined();
      await expect(
        store.head(
          authorizedRequest(harness, "head", {
            owner_service: "trigger_processor",
            scope: { ...scope, deployment_environment: "dev" },
            capability: "trigger_process.snapshot.resolve",
            object_ref: prodRef as ObjectRefV1,
          }),
        ),
      ).rejects.toSatisfy(expectCode("authorization_scope_mismatch"));
    });

    it("enforces retention and legal hold, then deletes idempotently", async () => {
      const harness = createHarness(kind);
      const created = await harness.store.putImmutable(
        putRequest(new TextEncoder().encode("retained")),
      );
      const deletion = authorizedRequest(harness, "delete", {
        owner_service: "trigger_processor" as const,
        scope,
        capability: "trigger_process.snapshot.manage",
        object_ref: created.object_ref,
        deletion_decision_version: "decision-v1",
        idempotency_key: "delete-1",
      });
      await expect(
        harness.store.deleteIfEligible(deletion),
      ).rejects.toSatisfy(expectCode("retention_active"));

      harness.setNow("2026-07-22T00:00:00.000Z");
      harness.metadata.setLegalHold(created.object_ref, true);
      await expect(
        harness.store.deleteIfEligible(deletion),
      ).rejects.toSatisfy(expectCode("precondition_failed"));
      harness.metadata.setLegalHold(created.object_ref, false);

      await expect(harness.store.deleteIfEligible(deletion)).resolves.toEqual({
        object_ref: created.object_ref,
        deleted: true,
        replayed: false,
      });
      await expect(harness.store.deleteIfEligible(deletion)).resolves.toEqual({
        object_ref: created.object_ref,
        deleted: true,
        replayed: true,
      });
      await expect(
        harness.store.head(
          authorizedRequest(harness, "head", {
            owner_service: "trigger_processor",
            scope,
            capability: "trigger_process.snapshot.resolve",
            object_ref: created.object_ref,
          }),
        ),
      ).rejects.toSatisfy(expectCode("object_not_found"));
    });

    it("fails closed instead of bypassing retention when the clock is invalid", async () => {
      const harness = createHarness(kind);
      const created = await harness.store.putImmutable(
        putRequest(new TextEncoder().encode("invalid-clock-retained")),
      );
      const deletion = authorizedRequest(harness, "delete", {
        owner_service: "trigger_processor" as const,
        scope,
        capability: "trigger_process.snapshot.manage",
        object_ref: created.object_ref,
        deletion_decision_version: "invalid-clock-decision-v1",
        idempotency_key: "invalid-clock-delete-1",
      });

      harness.setNow("not-a-date");
      await expect(
        harness.store.deleteIfEligible(deletion),
      ).rejects.toSatisfy(expectCode("storage_unavailable"));
      expect((await harness.metadata.findByRef(created.object_ref))?.state).toBe(
        "available",
      );

      harness.setNow("2026-07-20T00:00:00.000Z");
      await expect(
        harness.store.head(
          authorizedRequest(harness, "head", {
            owner_service: "trigger_processor",
            scope,
            capability: "trigger_process.snapshot.resolve",
            object_ref: created.object_ref,
          }),
        ),
      ).resolves.toMatchObject({ object_ref: created.object_ref });
    });
  });
}

describe("ObjectStore adapter policy validation", () => {
  it("persists late-arrival provenance across an explicit uncertain handoff", async () => {
    const metadata = new InMemoryObjectMetadataRepositoryV1();
    const reserved = await metadata.reservePut({
      owner_service: "trigger_processor",
      object_class: "trigger_process_snapshot",
      scope,
      scope_fingerprint: objectScopeFingerprintV1(scope),
      idempotency_key: "uncertain-upload",
      request_fingerprint: "request-uncertain-upload",
      sha256: digest(new Uint8Array()),
      size_bytes: 0,
      media_type: "application/octet-stream",
      retention_until: "2026-07-21T00:00:00.000Z",
      now: new Date("2026-07-20T00:00:00.000Z"),
      foreground_lease_until: new Date("2026-07-20T00:05:00.000Z"),
    });
    expect(reserved.kind).toBe("claimed");
    if (reserved.kind !== "claimed") throw new Error("reservation was not claimed");
    await metadata.handoffPutReconciliation(
      reserved.reservation_id,
      "put_finalize",
      reserved.foreground_lease_token,
      new Date("2026-07-20T00:05:00.000Z"),
      true,
    );
    const first = await metadata.claimReconciliation({
      worker_id: "uncertain-worker-1",
      now: new Date("2026-07-20T00:06:00.000Z"),
      locked_until: new Date("2026-07-20T00:06:30.000Z"),
      limit: 1,
      expired_upload_cleanup_not_before: new Date(
        "2026-07-20T00:11:00.000Z",
      ),
    });
    expect(first[0]).toMatchObject({
      foreground_upload_may_still_arrive: true,
      upload_attempt_token: reserved.upload_attempt_token,
      cleanup_not_before: "2026-07-20T00:05:00.000Z",
    });
    await metadata.releaseReconciliation({
      reservation_id: reserved.reservation_id,
      claim_token: first[0]!.claim_token,
      last_error: "transient read-back failure",
      next_retry_at: new Date("2026-07-20T00:07:00.000Z"),
    });
    const reclaimed = await metadata.claimReconciliation({
      worker_id: "uncertain-worker-2",
      now: new Date("2026-07-20T00:08:00.000Z"),
      locked_until: new Date("2026-07-20T00:08:30.000Z"),
      limit: 1,
      expired_upload_cleanup_not_before: new Date(
        "2026-07-20T00:13:00.000Z",
      ),
    });
    expect(reclaimed[0]).toMatchObject({
      foreground_upload_may_still_arrive: true,
      upload_attempt_token: reserved.upload_attempt_token,
      cleanup_not_before: "2026-07-20T00:05:00.000Z",
    });
  });

  it("requires a matching post-horizon backend receipt before completing a late-upload cleanup tombstone", async () => {
    const metadata = new InMemoryObjectMetadataRepositoryV1();
    const reserved = await metadata.reservePut({
      owner_service: "trigger_processor",
      object_class: "trigger_process_snapshot",
      scope,
      scope_fingerprint: objectScopeFingerprintV1(scope),
      idempotency_key: "receipt-gated-upload",
      request_fingerprint: "request-receipt-gated-upload",
      sha256: digest(new Uint8Array()),
      size_bytes: 0,
      media_type: "application/octet-stream",
      retention_until: "2026-07-21T00:00:00.000Z",
      now: new Date("2026-07-20T00:00:00.000Z"),
      foreground_lease_until: new Date("2026-07-20T00:05:00.000Z"),
    });
    expect(reserved.kind).toBe("claimed");
    if (reserved.kind !== "claimed") throw new Error("reservation was not claimed");
    await metadata.handoffPutReconciliation(
      reserved.reservation_id,
      "put_cleanup",
      reserved.foreground_lease_token,
      new Date("2026-07-20T00:05:00.000Z"),
      true,
    );
    const claimed = await metadata.claimReconciliation({
      worker_id: "receipt-worker",
      now: new Date("2026-07-20T00:06:00.000Z"),
      locked_until: new Date("2026-07-20T00:06:30.000Z"),
      limit: 1,
      expired_upload_cleanup_not_before: new Date(
        "2026-07-20T00:11:00.000Z",
      ),
    });
    expect(claimed[0]).toMatchObject({
      operation: "put_cleanup",
      foreground_upload_may_still_arrive: true,
      upload_attempt_token: reserved.upload_attempt_token,
    });
    await expect(
      metadata.completeReconciliation({
        reservation_id: reserved.reservation_id,
        claim_token: claimed[0]!.claim_token,
      }),
    ).rejects.toThrow(/terminal receipt/);
    await expect(
      metadata.completeReconciliation({
        reservation_id: reserved.reservation_id,
        claim_token: claimed[0]!.claim_token,
        backend_put_terminal_receipt: {
          upload_attempt_token: "wrong-attempt",
          terminal_at: "2026-07-20T00:06:00.000Z",
        },
      }),
    ).rejects.toThrow(/terminal receipt/);
    await expect(
      metadata.completeReconciliation({
        reservation_id: reserved.reservation_id,
        claim_token: claimed[0]!.claim_token,
        backend_put_terminal_receipt: {
          upload_attempt_token: reserved.upload_attempt_token,
          terminal_at: "2026-07-20T00:06:00.000Z",
        },
      }),
    ).rejects.toThrow(/terminal receipt/);
    await expect(
      metadata.completeReconciliation({
        reservation_id: reserved.reservation_id,
        claim_token: claimed[0]!.claim_token,
        backend_put_terminal_receipt: {
          upload_attempt_token: reserved.upload_attempt_token,
          terminal_at: "2026-07-20T00:15:00.000Z",
        },
      }),
    ).resolves.toBeUndefined();
  });

  it("does not let foreground delete operations clear or bypass a reconciliation claim", async () => {
    const metadata = new InMemoryObjectMetadataRepositoryV1();
    const reserved = await metadata.reservePut({
      owner_service: "trigger_processor",
      object_class: "trigger_process_snapshot",
      scope,
      scope_fingerprint: objectScopeFingerprintV1(scope),
      idempotency_key: "delete-claim-fence-put",
      request_fingerprint: "delete-claim-fence-request",
      sha256: digest(new Uint8Array()),
      size_bytes: 0,
      media_type: "application/octet-stream",
      retention_until: "2026-07-20T00:01:00.000Z",
      now: new Date("2026-07-20T00:00:00.000Z"),
      foreground_lease_until: new Date("2026-07-20T00:05:00.000Z"),
    });
    expect(reserved.kind).toBe("claimed");
    if (reserved.kind !== "claimed") throw new Error("reservation was not claimed");
    await metadata.completePut({
      reservation_id: reserved.reservation_id,
      foreground_lease_token: reserved.foreground_lease_token,
      version: "version-delete-claim-fence",
    });
    const deletion = await metadata.reserveDelete({
      object_ref: reserved.object_ref,
      deletion_decision_version: "delete-claim-fence-v1",
      idempotency_key: "delete-claim-fence",
      now: new Date("2026-07-20T00:02:00.000Z"),
    });
    expect(deletion.kind).toBe("claimed");
    if (deletion.kind !== "claimed") throw new Error("deletion was not claimed");
    const [claim] = await metadata.claimReconciliation({
      worker_id: "delete-claim-worker-1",
      now: new Date("2026-07-20T00:02:00.000Z"),
      locked_until: new Date("2026-07-20T00:02:30.000Z"),
      limit: 1,
      reservation_id: deletion.reservation_id,
      expired_upload_cleanup_not_before: new Date(
        "2026-07-20T00:07:00.000Z",
      ),
    });
    expect(claim).toMatchObject({ operation: "delete_finalize" });

    await expect(
      metadata.completeDelete(deletion.reservation_id),
    ).rejects.toThrow(/stale delete foreground claim/);
    await expect(
      metadata.abortDelete(deletion.reservation_id),
    ).rejects.toThrow(/stale delete foreground claim/);
    await expect(
      metadata.handoffDeleteReconciliation(deletion.reservation_id),
    ).rejects.toThrow(/stale delete foreground claim/);
    await expect(
      metadata.claimReconciliation({
        worker_id: "delete-claim-worker-2",
        now: new Date("2026-07-20T00:02:01.000Z"),
        locked_until: new Date("2026-07-20T00:02:31.000Z"),
        limit: 1,
        reservation_id: deletion.reservation_id,
        expired_upload_cleanup_not_before: new Date(
          "2026-07-20T00:07:01.000Z",
        ),
      }),
    ).resolves.toEqual([]);
    await expect(
      metadata.completeReconciliation({
        reservation_id: deletion.reservation_id,
        claim_token: claim!.claim_token,
      }),
    ).resolves.toMatchObject({ state: "deleted" });
  });

  it("runs reconciliation continuously without overlapping the same worker", async () => {
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const requests: unknown[] = [];
    const worker = new ObjectStoreReconciliationWorkerV1({
      reconciliation: {
        async reconcilePending(request) {
          requests.push(request);
          await blocked;
          return { claimed: 0, completed: 0, retry_scheduled: 0 };
        },
      },
      worker_id: "object-worker-1",
      interval_ms: 100,
      batch_limit: 7,
      lease_seconds: 11,
    });
    worker.start();
    const first = worker.runOnce();
    const duplicate = worker.runOnce();
    expect(duplicate).toBe(first);
    await Promise.resolve();
    expect(requests).toEqual([
      { worker_id: "object-worker-1", limit: 7, lease_seconds: 11 },
    ]);
    release();
    await worker.stop();
  });

  it("rejects malformed reconciliation summaries instead of resetting backoff", async () => {
    const malformed = new ObjectStoreReconciliationWorkerV1({
      reconciliation: {
        async reconcilePending() {
          return { claimed: 2, completed: 1, retry_scheduled: 0 };
        },
      },
      worker_id: "object-worker-malformed-summary",
      batch_limit: 2,
    });
    await expect(malformed.runOnce()).rejects.toThrow("inconsistent summary");
  });

  it("binds the reconciliation port and rejects accessor-backed summaries", async () => {
    let configuredCalls = 0;
    let replacementCalls = 0;
    const reconciliation = {
      async reconcilePending() {
        configuredCalls += 1;
        return { claimed: 0, completed: 0, retry_scheduled: 0 };
      },
    };
    const worker = new ObjectStoreReconciliationWorkerV1({
      reconciliation,
      worker_id: "object-worker-bound-port",
    });
    reconciliation.reconcilePending = async () => {
      replacementCalls += 1;
      return { claimed: 0, completed: 0, retry_scheduled: 0 };
    };
    await expect(worker.runOnce()).resolves.toEqual({
      claimed: 0,
      completed: 0,
      retry_scheduled: 0,
    });
    expect({ configuredCalls, replacementCalls }).toEqual({
      configuredCalls: 1,
      replacementCalls: 0,
    });

    let getterCalls = 0;
    const accessorSummary = {
      claimed: 0,
      completed: 0,
      retry_scheduled: 0,
    } as Record<string, unknown>;
    Object.defineProperty(accessorSummary, "claimed", {
      configurable: true,
      enumerable: true,
      get() {
        getterCalls += 1;
        return 0;
      },
    });
    const accessorWorker = new ObjectStoreReconciliationWorkerV1({
      reconciliation: {
        async reconcilePending() {
          return accessorSummary as never;
        },
      },
      worker_id: "object-worker-accessor-summary",
    });
    await expect(accessorWorker.runOnce()).rejects.toThrow("malformed summary");
    expect(getterCalls).toBe(0);
  });

  it("turns synchronous reconciliation failures into rejections and isolates a throwing reporter", async () => {
    let calls = 0;
    let reports = 0;
    const failure = new Error("synchronous reconciliation failure");
    const worker = new ObjectStoreReconciliationWorkerV1({
      reconciliation: {
        reconcilePending() {
          calls += 1;
          throw failure;
        },
      },
      worker_id: "object-worker-sync-failure",
      interval_ms: 100,
      async on_error(error) {
        reports += 1;
        expect(error).toBe(failure);
        await Promise.resolve();
        throw new Error("broken reconciliation reporter");
      },
    });

    expect(() => worker.runOnce()).not.toThrow();
    await expect(worker.runOnce()).rejects.toBe(failure);
    worker.start();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await worker.stop();

    expect(calls).toBeGreaterThanOrEqual(2);
    expect(reports).toBeGreaterThanOrEqual(1);
  });

  it("installs the reconciliation single-flight promise before synchronous re-entry", async () => {
    let worker!: ObjectStoreReconciliationWorkerV1;
    let calls = 0;
    let nested: Promise<unknown> | undefined;
    worker = new ObjectStoreReconciliationWorkerV1({
      reconciliation: {
        reconcilePending() {
          calls += 1;
          if (calls === 1) nested = worker.runOnce();
          return Promise.resolve({
            claimed: 0,
            completed: 0,
            retry_scheduled: 0,
          });
        },
      },
      worker_id: "object-worker-reentry",
      interval_ms: 100,
    });

    const outer = worker.runOnce();
    await Promise.resolve();

    expect(nested).toBe(outer);
    await expect(outer).resolves.toMatchObject({ claimed: 0 });
    expect(calls).toBe(1);
  });

  it("linearizes reconciliation stop against start and permits a later restart", async () => {
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    const worker = new ObjectStoreReconciliationWorkerV1({
      reconciliation: {
        async reconcilePending() {
          calls += 1;
          if (calls === 1) await blocked;
          return { claimed: 0, completed: 0, retry_scheduled: 0 };
        },
      },
      worker_id: "object-worker-stop-race",
      interval_ms: 100,
    });

    worker.start();
    await Promise.resolve();
    const stopping = worker.stop();
    expect(() => worker.start()).toThrow(
      "ObjectStore reconciliation worker is stopping",
    );
    expect(worker.stop()).toBe(stopping);
    release();
    await stopping;
    await new Promise<void>((resolve) => setTimeout(resolve, 120));
    expect(calls).toBe(1);

    worker.start();
    await Promise.resolve();
    await Promise.resolve();
    expect(calls).toBe(2);
    await worker.stop();
  });

  it("backs off persistent reconciliation failures and bounds a hanging reporter", async () => {
    vi.useFakeTimers();
    let calls = 0;
    let reports = 0;
    const never = new Promise<void>(() => undefined);
    const worker = new ObjectStoreReconciliationWorkerV1({
      reconciliation: {
        async reconcilePending() {
          calls += 1;
          throw new Error("metadata unavailable");
        },
      },
      worker_id: "object-worker-backoff",
      interval_ms: 100,
      retry_base_delay_ms: 200,
      retry_max_delay_ms: 800,
      random: () => 0,
      on_error() {
        reports += 1;
        return never;
      },
    });

    worker.start();
    await vi.advanceTimersByTimeAsync(0);
    expect({ calls, reports }).toEqual({ calls: 1, reports: 1 });

    await vi.advanceTimersByTimeAsync(99);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect({ calls, reports }).toEqual({ calls: 2, reports: 1 });

    await vi.advanceTimersByTimeAsync(199);
    expect(calls).toBe(2);
    await vi.advanceTimersByTimeAsync(1);
    expect({ calls, reports }).toEqual({ calls: 3, reports: 1 });

    await worker.stop();
  });

  it("aborts hanging reconciliation and rejects bounded stop until it settles", async () => {
    vi.useFakeTimers();
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    let observedSignal: AbortSignal | undefined;
    const worker = new ObjectStoreReconciliationWorkerV1({
      reconciliation: {
        async reconcilePending(_request, signal) {
          observedSignal = signal;
          await blocked;
          return { claimed: 0, completed: 0, retry_scheduled: 0 };
        },
      },
      worker_id: "object-worker-hanging-stop",
      interval_ms: 100,
      batch_timeout_ms: 300_000,
      stop_timeout_ms: 100,
    });

    worker.start();
    await vi.advanceTimersByTimeAsync(0);
    const stopping = worker.stop();
    const stopFailure = expect(stopping).rejects.toThrow(
      "did not stop within 100ms",
    );
    expect(observedSignal?.aborted).toBe(true);
    expect(() => worker.start()).toThrow(
      "ObjectStore reconciliation worker is stopping",
    );
    await vi.advanceTimersByTimeAsync(100);
    await stopFailure;
    expect(() => worker.start()).toThrow(
      "ObjectStore reconciliation worker is stopping",
    );

    release();
    await vi.advanceTimersByTimeAsync(0);
    worker.start();
    await vi.advanceTimersByTimeAsync(0);
    await worker.stop();
  });

  it("requests cooperative abort when reconciliation exceeds its deadline", async () => {
    vi.useFakeTimers();
    let aborts = 0;
    const worker = new ObjectStoreReconciliationWorkerV1({
      reconciliation: {
        reconcilePending(_request, signal) {
          return new Promise<never>((_resolve, reject) => {
            signal?.addEventListener("abort", () => {
              aborts += 1;
              reject(signal.reason);
            }, { once: true });
          });
        },
      },
      worker_id: "object-worker-batch-timeout",
      interval_ms: 100,
      batch_timeout_ms: 100,
      random: () => 0,
    });

    worker.start();
    await vi.advanceTimersByTimeAsync(100);
    expect(aborts).toBe(1);
    await worker.stop();
  });

  it("rejects owner to bucket drift", () => {
    expect(
      () =>
        new InMemoryObjectStoreAdapterV1({
          policies: [{ ...policy, bucket: "ar-artifacts" }],
          accessPolicyVerifier: new TestObjectAccessPolicyVerifierV1(),
        }),
    ).toThrow(/cannot use bucket/);
  });

  it("requires durable metadata for the production Supabase adapter", () => {
    expect(
      () =>
        new SupabaseStorageAdapter({
          metadataRepository: new InMemoryObjectMetadataRepositoryV1(),
          accessPolicyVerifier: new TestObjectAccessPolicyVerifierV1(),
          policies: [policy],
          url: "https://storage.test.invalid",
          secretKey: "test-secret",
          fetch: fakeSupabaseFetch(new Map()),
        }),
    ).toThrow(/transactional Postgres metadata repository/);

    expect(
      () =>
        new SupabaseStorageAdapter({
          metadataRepository: new InMemoryObjectMetadataRepositoryV1(),
          accessPolicyVerifier: new TestObjectAccessPolicyVerifierV1(),
          policies: [policy],
          url: "https://storage.test.invalid",
          secretKey: "test-secret",
          fetch: fakeSupabaseFetch(new Map()),
          allowVolatileMetadataRepositoryForTests: true,
        } as never),
    ).toThrow(/transactional Postgres metadata repository/);

    const selfReportedTransactionalRepository = new Proxy(
      new InMemoryObjectMetadataRepositoryV1(),
      {
        get(target, property, receiver) {
          if (property === "durability") return "transactional_postgres";
          return Reflect.get(target, property, receiver);
        },
      },
    ) as ObjectMetadataRepositoryV1;
    expect(
      () =>
        new SupabaseStorageAdapter({
          metadataRepository: selfReportedTransactionalRepository,
          accessPolicyVerifier: new TestObjectAccessPolicyVerifierV1(),
          policies: [policy],
          url: "https://storage.test.invalid",
          secretKey: "test-secret",
          fetch: fakeSupabaseFetch(new Map()),
        }),
    ).toThrow(/transactional Postgres metadata repository/);
  });

  it("keeps physical adapters, buckets, and policies out of the root API", async () => {
    const exports = await import("../src/index.js");
    const compositionExports = await import("../src/composition.js");
    expect(Object.keys(exports)).toEqual(["ObjectStoreErrorV1"]);
    expect(exports).not.toHaveProperty("OBJECT_STORE_BUCKETS_V1");
    expect(exports).not.toHaveProperty("PAI_OBJECT_CLASS_POLICY_BASES_V1");
    expect(exports).not.toHaveProperty("SupabaseStorageAdapter");
    expect(exports).not.toHaveProperty("FileSystemStorageAdapter");
    expect(exports).not.toHaveProperty("S3StorageAdapter");
    expect(exports).not.toHaveProperty("UrlStorageAdapter");
    expect(exports).not.toHaveProperty("InMemoryObjectStoreAdapterV1");
    expect(exports).not.toHaveProperty("ObjectStoreAdapterCoreV1");
    expect(exports).not.toHaveProperty("SupabaseObjectStorageBackendV1");
    expect(exports).not.toHaveProperty("InMemoryObjectStorageBackendV1");
    expect(exports).not.toHaveProperty("createSupabaseStorageClientV1");
    expect(compositionExports).not.toHaveProperty(
      "createSupabaseStorageAdapterForTestsV1",
    );
  });

  it("never reaches a destructive backend sink for a malformed reconciliation operation", async () => {
    const baseMetadata = new InMemoryObjectMetadataRepositoryV1();
    const releaseReconciliation = vi.fn(async () => undefined);
    const malformedRecord = {
      object_ref: "objv1_malformedoperation" as ObjectRefV1,
      owner_service: "trigger_processor" as const,
      object_class: "trigger_process_snapshot",
      scope,
      scope_fingerprint: objectScopeFingerprintV1(scope),
      idempotency_key: "malformed-operation-put",
      request_fingerprint: "malformed-operation-fingerprint",
      version: "pending",
      sha256: digest(new Uint8Array()),
      size_bytes: 0,
      media_type: "application/json",
      retention_until: "2026-07-21T00:00:00.000Z",
      state: "put_pending" as const,
      legal_hold: false,
    };
    const claimReconciliation = vi.fn(async () => [
      {
        reservation_id: "malformed-operation-reservation",
        claim_token: "malformed-operation-claim",
        operation: "malformed_operation" as never,
        record: malformedRecord,
        attempt: 1,
        foreground_upload_may_still_arrive: false,
      },
      {
        reservation_id: "wrong-state-operation-reservation",
        claim_token: "wrong-state-operation-claim",
        operation: "put_cleanup" as const,
        record: { ...malformedRecord, state: "available" as const },
        attempt: 1,
        foreground_upload_may_still_arrive: false,
      },
      {
        reservation_id: "wrong-provenance-operation-reservation",
        claim_token: "wrong-provenance-operation-claim",
        operation: "delete_finalize" as const,
        record: { ...malformedRecord, state: "delete_pending" as const },
        attempt: 1,
        foreground_upload_may_still_arrive: true,
        upload_attempt_token: "wrong-provenance-upload-attempt",
        foreground_upload_terminal_at: "2026-07-20T00:30:00.000Z",
      },
    ]);
    const metadata = new Proxy(baseMetadata, {
      get(target, property) {
        if (property === "claimReconciliation") return claimReconciliation;
        if (property === "releaseReconciliation") return releaseReconciliation;
        const value = Reflect.get(target, property, target) as unknown;
        return typeof value === "function" ? value.bind(target) : value;
      },
    }) as ObjectMetadataRepositoryV1;
    const backend = new InMemoryObjectStorageBackendV1();
    const deleteObject = vi.spyOn(backend, "delete");
    const finalizeAbandonedPutAttempt = vi.spyOn(
      backend,
      "finalizeAbandonedPutAttempt",
    );
    const store = new ObjectStoreAdapterCoreV1({
      backend,
      metadataRepository: metadata,
      accessPolicyVerifier: new TestObjectAccessPolicyVerifierV1(),
      policies: [policy],
      now: () => new Date("2026-07-20T00:00:00.000Z"),
    });

    await expect(
      store.reconcilePending({
        worker_id: "malformed-operation-worker",
        limit: 3,
        lease_seconds: 30,
      }),
    ).resolves.toEqual({ claimed: 3, completed: 0, retry_scheduled: 3 });
    expect(deleteObject).not.toHaveBeenCalled();
    expect(finalizeAbandonedPutAttempt).not.toHaveBeenCalled();
    expect(releaseReconciliation).toHaveBeenCalledWith(
      expect.objectContaining({
        reservation_id: "malformed-operation-reservation",
        claim_token: "malformed-operation-claim",
        last_error: "unsupported ObjectStore reconciliation operation",
      }),
    );
    expect(releaseReconciliation).toHaveBeenCalledWith(
      expect.objectContaining({
        reservation_id: "wrong-state-operation-reservation",
        claim_token: "wrong-state-operation-claim",
        last_error:
          "ObjectStore reconciliation operation does not match metadata state",
      }),
    );
    expect(releaseReconciliation).toHaveBeenCalledWith(
      expect.objectContaining({
        reservation_id: "wrong-provenance-operation-reservation",
        claim_token: "wrong-provenance-operation-claim",
        last_error:
          "ObjectStore late-upload provenance is invalid for delete reconciliation",
      }),
    );
  });

  it("never invokes a caller-owned reconciliation claim iterator or reaches a backend sink", async () => {
    const baseMetadata = new InMemoryObjectMetadataRepositoryV1();
    const record = {
      object_ref: "objv1_claimiterator" as ObjectRefV1,
      owner_service: "trigger_processor" as const,
      object_class: "trigger_process_snapshot",
      scope,
      scope_fingerprint: objectScopeFingerprintV1(scope),
      idempotency_key: "claim-iterator-put",
      request_fingerprint: "claim-iterator-fingerprint",
      version: "version-1",
      sha256: digest(new Uint8Array()),
      size_bytes: 0,
      media_type: "application/json",
      retention_until: "2026-07-21T00:00:00.000Z",
      state: "delete_pending" as const,
      legal_hold: false,
    };
    const claim = {
      reservation_id: "claim-iterator-reservation",
      claim_token: "claim-iterator-token",
      operation: "delete_finalize" as const,
      record,
      attempt: 1,
      foreground_upload_may_still_arrive: false,
    };
    const claims = [claim];
    let iteratorCalls = 0;
    Object.defineProperty(claims, Symbol.iterator, {
      configurable: true,
      value: function* maliciousClaimIterator() {
        iteratorCalls += 1;
        while (true) yield claim;
      },
    });
    const metadata = new Proxy(baseMetadata, {
      get(target, property) {
        if (property === "claimReconciliation") return async () => claims;
        const value = Reflect.get(target, property, target) as unknown;
        return typeof value === "function" ? value.bind(target) : value;
      },
    }) as ObjectMetadataRepositoryV1;
    const backend = new InMemoryObjectStorageBackendV1();
    const deleteObject = vi.spyOn(backend, "delete");
    const store = new ObjectStoreAdapterCoreV1({
      backend,
      metadataRepository: metadata,
      accessPolicyVerifier: new TestObjectAccessPolicyVerifierV1(),
      policies: [policy],
      now: () => new Date("2026-07-20T00:00:00.000Z"),
    });

    await expect(
      store.reconcilePending({
        worker_id: "claim-iterator-worker",
        limit: 1,
        lease_seconds: 30,
      }),
    ).rejects.toMatchObject({
      code: "storage_unavailable",
      retryable: true,
    });
    expect(iteratorCalls).toBe(0);
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it("rejects an oversized reconciliation claim batch before any backend sink", async () => {
    const baseMetadata = new InMemoryObjectMetadataRepositoryV1();
    const record = {
      object_ref: "objv1_oversizedclaimbatch" as ObjectRefV1,
      owner_service: "trigger_processor" as const,
      object_class: "trigger_process_snapshot",
      scope,
      scope_fingerprint: objectScopeFingerprintV1(scope),
      idempotency_key: "oversized-claim-batch-put",
      request_fingerprint: "oversized-claim-batch-fingerprint",
      version: "pending",
      sha256: digest(new Uint8Array()),
      size_bytes: 0,
      media_type: "application/json",
      retention_until: "2026-07-21T00:00:00.000Z",
      state: "put_pending" as const,
      legal_hold: false,
    };
    const metadata = new Proxy(baseMetadata, {
      get(target, property) {
        if (property === "claimReconciliation") {
          return async () => [
            {
              reservation_id: "oversized-claim-reservation-1",
              claim_token: "oversized-claim-token-1",
              operation: "put_cleanup" as const,
              record,
              attempt: 1,
              foreground_upload_may_still_arrive: false,
            },
            {
              reservation_id: "oversized-claim-reservation-2",
              claim_token: "oversized-claim-token-2",
              operation: "put_cleanup" as const,
              record,
              attempt: 1,
              foreground_upload_may_still_arrive: false,
            },
          ];
        }
        const value = Reflect.get(target, property, target) as unknown;
        return typeof value === "function" ? value.bind(target) : value;
      },
    }) as ObjectMetadataRepositoryV1;
    const backend = new InMemoryObjectStorageBackendV1();
    const deleteObject = vi.spyOn(backend, "delete");
    const store = new ObjectStoreAdapterCoreV1({
      backend,
      metadataRepository: metadata,
      accessPolicyVerifier: new TestObjectAccessPolicyVerifierV1(),
      policies: [policy],
      now: () => new Date("2026-07-20T00:00:00.000Z"),
    });

    await expect(
      store.reconcilePending({
        worker_id: "oversized-claim-worker",
        limit: 1,
        lease_seconds: 30,
      }),
    ).rejects.toMatchObject({
      code: "storage_unavailable",
      retryable: true,
    });
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it("snapshots policy configuration so later mutation cannot expand access", async () => {
    const mutablePolicy = structuredClone(policy) as ObjectClassPolicyV1;
    const adapter = new InMemoryObjectStoreAdapterV1({
      policies: [mutablePolicy],
      accessPolicyVerifier: new TestObjectAccessPolicyVerifierV1(),
      now: () => new Date("2026-07-20T00:00:00.000Z"),
    });
    (mutablePolicy.capabilities.put as string[]).push("attacker.object.put");
    const body = new TextEncoder().encode("policy-snapshot");
    await expect(
      adapter.putImmutable(
        putRequest(body, { capability: "attacker.object.put" }),
      ),
    ).rejects.toSatisfy(expectCode("authorization_scope_mismatch"));
  });

  it("rejects accessor-backed policy configuration without invoking getters", () => {
    let policyGetterCalls = 0;
    const accessorPolicy = structuredClone(policy) as unknown as Record<
      string,
      unknown
    >;
    Object.defineProperty(accessorPolicy, "capabilities", {
      configurable: true,
      enumerable: true,
      get() {
        policyGetterCalls += 1;
        return policy.capabilities;
      },
    });
    expect(
      () =>
        new InMemoryObjectStoreAdapterV1({
          policies: [accessorPolicy as unknown as ObjectClassPolicyV1],
          accessPolicyVerifier: new TestObjectAccessPolicyVerifierV1(),
        }),
    ).toThrow("own data properties");
    expect(policyGetterCalls).toBe(0);

    let arrayGetterCalls = 0;
    const policies = [policy];
    Object.defineProperty(policies, "0", {
      configurable: true,
      enumerable: true,
      get() {
        arrayGetterCalls += 1;
        return policy;
      },
    });
    expect(
      () =>
        new InMemoryObjectStoreAdapterV1({
          policies,
          accessPolicyVerifier: new TestObjectAccessPolicyVerifierV1(),
        }),
    ).toThrow("dense own-data array");
    expect(arrayGetterCalls).toBe(0);
  });
});

describe("ObjectStore async-boundary snapshots", () => {
  it("keeps a put bound to the request and scope validated before reserve", async () => {
    let enteredReserve!: () => void;
    let releaseReserve!: () => void;
    const reserveEntered = new Promise<void>((resolve) => {
      enteredReserve = resolve;
    });
    const reserveGate = new Promise<void>((resolve) => {
      releaseReserve = resolve;
    });
    class GatedReserveRepository extends InMemoryObjectMetadataRepositoryV1 {
      public override async reservePut(
        input: Parameters<InMemoryObjectMetadataRepositoryV1["reservePut"]>[0],
      ) {
        enteredReserve();
        await reserveGate;
        return super.reservePut(input);
      }
    }
    const metadata = new GatedReserveRepository();
    const body = new TextEncoder().encode("snapshotted-put-request");
    const mutableScope = { ...scope };
    const mutableRequest = putRequest(body, { scope: mutableScope }) as unknown as
      Record<string, unknown>;
    const store = new InMemoryObjectStoreAdapterV1({
      metadataRepository: metadata,
      policies: [policy],
      accessPolicyVerifier: new TestObjectAccessPolicyVerifierV1(),
      now: () => new Date("2026-07-20T00:00:00.000Z"),
    });

    const pending = store.putImmutable(mutableRequest as never);
    await reserveEntered;
    mutableScope.bot_id = "mutated-bot";
    mutableRequest.owner_service = "action_runtime";
    mutableRequest.object_class = "runtime_artifact";
    mutableRequest.capability = "attacker.object.put";
    mutableRequest.expected_sha256 = digest(
      new TextEncoder().encode("different"),
    );
    mutableRequest.size_bytes = 999_999;
    releaseReserve();

    const created = await pending;
    const record = await metadata.findByRef(created.object_ref);
    expect(record).toMatchObject({
      owner_service: "trigger_processor",
      object_class: "trigger_process_snapshot",
      scope: { bot_id: "bot-1" },
      sha256: digest(body),
      size_bytes: body.byteLength,
    });
  });

  it("keeps grant TTL, authorization, and delete identity stable across verifier awaits", async () => {
    const metadata = new InMemoryObjectMetadataRepositoryV1();
    const backend = new InMemoryObjectStorageBackendV1();
    const initial = new InMemoryObjectStoreAdapterV1({
      metadataRepository: metadata,
      backend,
      policies: [policy],
      accessPolicyVerifier: new TestObjectAccessPolicyVerifierV1(),
      now: () => new Date("2026-07-20T00:00:00.000Z"),
    });
    const created = await initial.putImmutable(
      putRequest(new TextEncoder().encode("snapshot-grant-delete")),
    );

    const gates: Array<{ entered: Promise<void>; release(): void }> = [];
    const verifier: ObjectAccessPolicyVerifierV1 = {
      async verify(input) {
        let markEntered!: () => void;
        let release!: () => void;
        const entered = new Promise<void>((resolve) => {
          markEntered = resolve;
        });
        const wait = new Promise<void>((resolve) => {
          release = resolve;
        });
        gates.push({ entered, release });
        markEntered();
        await wait;
        return {
          ...input,
          authorized: true,
          retention_until: "2026-07-21T00:00:00.000Z",
        };
      },
    };
    let now = new Date("2026-07-20T00:00:00.000Z");
    const issueGrant = vi.spyOn(backend, "issueReadGrant");
    const store = new InMemoryObjectStoreAdapterV1({
      metadataRepository: metadata,
      backend,
      policies: [policy],
      accessPolicyVerifier: verifier,
      now: () => now,
    });
    const grantScope = { ...scope };
    const grantRequest: Record<string, unknown> = {
      owner_service: "trigger_processor",
      scope: grantScope,
      capability: "trigger_process.snapshot.resolve",
      object_ref: created.object_ref,
      access_decision_ref: "grant-snapshot-decision",
      retention_policy_version: "retention-v1",
      redaction_policy_version: "redaction-v1",
      ttl_seconds: 300,
    };
    const grantPending = store.issueReadGrant(grantRequest as never);
    await gates[0]!.entered;
    grantScope.bot_id = "mutated-bot";
    grantRequest.capability = "attacker.object.read";
    grantRequest.object_ref = "objv1_attacker";
    grantRequest.ttl_seconds = 86_400;
    gates[0]!.release();
    await expect(grantPending).resolves.toMatchObject({
      object_ref: created.object_ref,
      expires_at: "2026-07-20T00:05:00.000Z",
    });
    expect(issueGrant).toHaveBeenCalledWith(
      "tp-snapshots",
      expect.any(String),
      300,
    );

    now = new Date("2026-07-22T00:00:00.000Z");
    const deleteScope = { ...scope };
    const deleteRequest: Record<string, unknown> = {
      owner_service: "trigger_processor",
      scope: deleteScope,
      capability: "trigger_process.snapshot.manage",
      object_ref: created.object_ref,
      access_decision_ref: "delete-snapshot-decision",
      retention_policy_version: "retention-v1",
      redaction_policy_version: "redaction-v1",
      deletion_decision_version: "delete-decision-original",
      idempotency_key: "delete-original",
    };
    const deletePending = store.deleteIfEligible(deleteRequest as never);
    await gates[1]!.entered;
    deleteScope.bot_id = "mutated-bot";
    deleteRequest.capability = "attacker.object.delete";
    deleteRequest.deletion_decision_version = "delete-decision-mutated";
    deleteRequest.idempotency_key = "delete-mutated";
    gates[1]!.release();
    await expect(deletePending).resolves.toMatchObject({
      object_ref: created.object_ref,
      deleted: true,
    });
    expect(await metadata.findByRef(created.object_ref)).toMatchObject({
      deletion_decision_version: "delete-decision-original",
      deletion_idempotency_key: "delete-original",
    });
  });

  it("snapshots verifier decisions and owner records before later sinks await", async () => {
    const metadata = new InMemoryObjectMetadataRepositoryV1();
    const backend = new InMemoryObjectStorageBackendV1();
    const initial = new InMemoryObjectStoreAdapterV1({
      metadataRepository: metadata,
      backend,
      policies: [policy],
      accessPolicyVerifier: new TestObjectAccessPolicyVerifierV1(),
      now: () => new Date("2026-07-20T00:00:00.000Z"),
    });
    const body = new TextEncoder().encode("mutable-port-returns");
    const created = await initial.putImmutable(putRequest(body));

    let releaseFind!: () => void;
    let enteredFind!: () => void;
    const findEntered = new Promise<void>((resolve) => {
      enteredFind = resolve;
    });
    const findGate = new Promise<void>((resolve) => {
      releaseFind = resolve;
    });
    let returnedRecord: Record<string, unknown> | undefined;
    const gatedMetadata = new Proxy(metadata, {
      get(target, property) {
        if (property === "findByRef") {
          return async (objectRef: ObjectRefV1) => {
            const record = await target.findByRef(objectRef);
            returnedRecord = {
              ...record,
              scope: record === undefined ? undefined : { ...record.scope },
            };
            enteredFind();
            await findGate;
            return returnedRecord;
          };
        }
        const value = Reflect.get(target, property, target) as unknown;
        return typeof value === "function" ? value.bind(target) : value;
      },
    }) as ObjectMetadataRepositoryV1;
    let returnedDecision: Record<string, unknown> | undefined;
    const verifier: ObjectAccessPolicyVerifierV1 = {
      async verify(input) {
        returnedDecision = {
          ...input,
          authorized: true,
          retention_until: "2026-07-21T00:00:00.000Z",
        };
        return returnedDecision as unknown as VerifiedObjectAccessDecisionV1;
      },
    };
    let releaseHead!: () => void;
    let enteredHead!: () => void;
    const headEntered = new Promise<void>((resolve) => {
      enteredHead = resolve;
    });
    const headGate = new Promise<void>((resolve) => {
      releaseHead = resolve;
    });
    const gatedBackend = new Proxy(backend, {
      get(target, property) {
        if (property === "head") {
          return async (...args: Parameters<ObjectStorageBackendV1["head"]>) => {
            const head = await target.head(...args);
            enteredHead();
            await headGate;
            return head;
          };
        }
        const value = Reflect.get(target, property, target) as unknown;
        return typeof value === "function" ? value.bind(target) : value;
      },
    }) as ObjectStorageBackendV1;
    const store = new InMemoryObjectStoreAdapterV1({
      metadataRepository: gatedMetadata,
      backend: gatedBackend,
      policies: [policy],
      accessPolicyVerifier: verifier,
      now: () => new Date("2026-07-20T00:00:00.000Z"),
    });
    const pending = store.head({
      owner_service: "trigger_processor",
      scope,
      capability: "trigger_process.snapshot.resolve",
      object_ref: created.object_ref,
      access_decision_ref: "mutable-decision",
      retention_policy_version: "retention-v1",
      redaction_policy_version: "redaction-v1",
    });

    await findEntered;
    returnedDecision!.retention_until = "2099-01-01T00:00:00.000Z";
    returnedDecision!.capability = "attacker.object.read";
    releaseFind();
    await headEntered;
    returnedRecord!.version = "mutated-version";
    returnedRecord!.object_class = "runtime_artifact";
    (returnedRecord!.scope as Record<string, unknown>).bot_id = "mutated-bot";
    releaseHead();

    await expect(pending).resolves.toMatchObject({
      object_ref: created.object_ref,
      version: created.version,
      sha256: digest(body),
    });
  });

  it("snapshots reconciliation claims before physical completion awaits", async () => {
    const record = {
      object_ref: "objv1_claimsnapshot" as ObjectRefV1,
      owner_service: "trigger_processor" as const,
      object_class: "trigger_process_snapshot",
      scope: { ...scope },
      scope_fingerprint: objectScopeFingerprintV1(scope),
      idempotency_key: "claim-snapshot-put",
      request_fingerprint: "claim-snapshot-fingerprint",
      version: "version-1",
      sha256: digest(new Uint8Array()),
      size_bytes: 0,
      media_type: "application/json",
      retention_until: "2026-07-21T00:00:00.000Z",
      state: "delete_pending" as const,
      legal_hold: false,
    };
    const claim = {
      reservation_id: "claim-snapshot-reservation",
      claim_token: "claim-snapshot-token",
      operation: "delete_finalize" as const,
      record,
      attempt: 1,
      foreground_upload_may_still_arrive: false,
    };
    const completedRecord = {
      ...record,
      scope: { ...record.scope },
      state: "deleted" as const,
    };
    const completeReconciliation = vi.fn(async () => completedRecord);
    const baseMetadata = new InMemoryObjectMetadataRepositoryV1();
    const metadata = new Proxy(baseMetadata, {
      get(target, property) {
        if (property === "claimReconciliation") return async () => [claim];
        if (property === "completeReconciliation") {
          return completeReconciliation;
        }
        const value = Reflect.get(target, property, target) as unknown;
        return typeof value === "function" ? value.bind(target) : value;
      },
    }) as ObjectMetadataRepositoryV1;
    let enteredDelete!: () => void;
    let releaseDelete!: () => void;
    const deleteEntered = new Promise<void>((resolve) => {
      enteredDelete = resolve;
    });
    const deleteGate = new Promise<void>((resolve) => {
      releaseDelete = resolve;
    });
    const baseBackend = new InMemoryObjectStorageBackendV1();
    const backend = new Proxy(baseBackend, {
      get(target, property) {
        if (property === "delete") {
          return async () => {
            enteredDelete();
            await deleteGate;
          };
        }
        const value = Reflect.get(target, property, target) as unknown;
        return typeof value === "function" ? value.bind(target) : value;
      },
    }) as ObjectStorageBackendV1;
    const store = new ObjectStoreAdapterCoreV1({
      backend,
      metadataRepository: metadata,
      accessPolicyVerifier: new TestObjectAccessPolicyVerifierV1(),
      policies: [policy],
      now: () => new Date("2026-07-22T00:00:00.000Z"),
    });
    const pending = store.reconcilePending({
      worker_id: "claim-snapshot-worker",
      limit: 1,
      lease_seconds: 30,
    });
    await deleteEntered;
    claim.reservation_id = "mutated-reservation";
    claim.claim_token = "mutated-token";
    record.object_ref = "objv1_mutated" as ObjectRefV1;
    releaseDelete();

    await expect(pending).resolves.toEqual({
      claimed: 1,
      completed: 1,
      retry_scheduled: 0,
    });
    expect(completeReconciliation).toHaveBeenCalledWith({
      reservation_id: "claim-snapshot-reservation",
      claim_token: "claim-snapshot-token",
    });
  });

  it("rejects accessor-backed public requests and scopes without invoking getters", async () => {
    const { store } = createHarness("memory");
    const body = new TextEncoder().encode("accessor-request");
    let requestGetterCalls = 0;
    const requestWithGetter = putRequest(body) as unknown as Record<
      string,
      unknown
    >;
    Object.defineProperty(requestWithGetter, "owner_service", {
      configurable: true,
      enumerable: true,
      get() {
        requestGetterCalls += 1;
        return "trigger_processor";
      },
    });

    await expect(store.putImmutable(requestWithGetter as never)).rejects.toSatisfy(
      expectCode("precondition_failed"),
    );
    expect(requestGetterCalls).toBe(0);

    let scopeGetterCalls = 0;
    const scopeWithGetter = { ...scope } as unknown as Record<string, unknown>;
    Object.defineProperty(scopeWithGetter, "bot_id", {
      configurable: true,
      enumerable: true,
      get() {
        scopeGetterCalls += 1;
        return "bot-1";
      },
    });
    await expect(
      store.putImmutable(
        putRequest(body, {
          idempotency_key: "accessor-scope",
          scope: scopeWithGetter as unknown as ObjectScopeV1,
        }),
      ),
    ).rejects.toSatisfy(expectCode("precondition_failed"));
    expect(scopeGetterCalls).toBe(0);
  });

  it("rejects accessor-backed decisions, metadata, and claims without invoking getters", async () => {
    const metadata = new InMemoryObjectMetadataRepositoryV1();
    const backend = new InMemoryObjectStorageBackendV1();
    const initial = new InMemoryObjectStoreAdapterV1({
      metadataRepository: metadata,
      backend,
      policies: [policy],
      accessPolicyVerifier: new TestObjectAccessPolicyVerifierV1(),
      now: () => new Date("2026-07-20T00:00:00.000Z"),
    });
    const created = await initial.putImmutable(
      putRequest(new TextEncoder().encode("accessor-port-return")),
    );
    const storedRecord = await metadata.findByRef(created.object_ref);
    expect(storedRecord).toBeDefined();
    const readRequest = {
      owner_service: "trigger_processor" as const,
      scope,
      capability: "trigger_process.snapshot.resolve",
      object_ref: created.object_ref,
      access_decision_ref: "accessor-decision",
      retention_policy_version: "retention-v1",
      redaction_policy_version: "redaction-v1",
    };

    let decisionGetterCalls = 0;
    const accessorDecisionVerifier: ObjectAccessPolicyVerifierV1 = {
      async verify(input) {
        const decision = {
          ...input,
          authorized: true as const,
          retention_until: "2026-07-21T00:00:00.000Z",
        } as unknown as Record<string, unknown>;
        Object.defineProperty(decision, "capability", {
          configurable: true,
          enumerable: true,
          get() {
            decisionGetterCalls += 1;
            return input.capability;
          },
        });
        return decision as unknown as VerifiedObjectAccessDecisionV1;
      },
    };
    const decisionStore = new InMemoryObjectStoreAdapterV1({
      metadataRepository: metadata,
      backend,
      policies: [policy],
      accessPolicyVerifier: accessorDecisionVerifier,
      now: () => new Date("2026-07-20T00:00:00.000Z"),
    });
    await expect(decisionStore.head(readRequest)).rejects.toSatisfy(
      expectCode("authorization_scope_mismatch"),
    );
    expect(decisionGetterCalls).toBe(0);

    let metadataGetterCalls = 0;
    const recordWithGetter = {
      ...storedRecord!,
      scope: { ...storedRecord!.scope },
    } as unknown as Record<string, unknown>;
    Object.defineProperty(recordWithGetter, "version", {
      configurable: true,
      enumerable: true,
      get() {
        metadataGetterCalls += 1;
        return storedRecord!.version;
      },
    });
    const metadataWithAccessor = new Proxy(metadata, {
      get(target, property) {
        if (property === "findByRef") return async () => recordWithGetter;
        const member = Reflect.get(target, property, target) as unknown;
        return typeof member === "function" ? member.bind(target) : member;
      },
    }) as ObjectMetadataRepositoryV1;
    const metadataStore = new InMemoryObjectStoreAdapterV1({
      metadataRepository: metadataWithAccessor,
      backend,
      policies: [policy],
      accessPolicyVerifier: {
        async verify(input) {
          return {
            ...input,
            authorized: true,
            retention_until: "2026-07-21T00:00:00.000Z",
          };
        },
      },
      now: () => new Date("2026-07-20T00:00:00.000Z"),
    });
    await expect(metadataStore.head(readRequest)).rejects.toSatisfy(
      expectCode("integrity_mismatch"),
    );
    expect(metadataGetterCalls).toBe(0);

    let claimGetterCalls = 0;
    const claim = {
      reservation_id: "accessor-claim-reservation",
      claim_token: "accessor-claim-token",
      operation: "delete_finalize" as const,
      record: { ...storedRecord!, state: "delete_pending" as const },
      attempt: 1,
      foreground_upload_may_still_arrive: false,
    } as unknown as Record<string, unknown>;
    Object.defineProperty(claim, "claim_token", {
      configurable: true,
      enumerable: true,
      get() {
        claimGetterCalls += 1;
        return "accessor-claim-token";
      },
    });
    const claimsWithAccessor = new Proxy(metadata, {
      get(target, property) {
        if (property === "claimReconciliation") return async () => [claim];
        const member = Reflect.get(target, property, target) as unknown;
        return typeof member === "function" ? member.bind(target) : member;
      },
    }) as ObjectMetadataRepositoryV1;
    const claimStore = new InMemoryObjectStoreAdapterV1({
      metadataRepository: claimsWithAccessor,
      backend,
      policies: [policy],
      accessPolicyVerifier: new TestObjectAccessPolicyVerifierV1(),
      now: () => new Date("2026-07-22T00:00:00.000Z"),
    });
    await expect(
      claimStore.reconcilePending({
        worker_id: "accessor-claim-worker",
        limit: 1,
        lease_seconds: 30,
      }),
    ).rejects.toSatisfy(expectCode("storage_unavailable"));
    expect(claimGetterCalls).toBe(0);
  });
});

describe("ObjectStore owner-repository result binding", () => {
  it("rejects an oversized claimed reservation before reaching the physical backend", async () => {
    const baseMetadata = new InMemoryObjectMetadataRepositoryV1();
    const metadata = new Proxy(baseMetadata, {
      get(target, property) {
        if (property === "reservePut") {
          return async () => ({
            kind: "claimed" as const,
            reservation_id: "r".repeat(513),
            object_ref: "objv1_oversized_reservation" as ObjectRefV1,
            foreground_lease_token: "foreground-lease",
            upload_attempt_token: "upload-attempt",
          });
        }
        const member = Reflect.get(target, property, target) as unknown;
        return typeof member === "function" ? member.bind(target) : member;
      },
    }) as ObjectMetadataRepositoryV1;
    const backend = new InMemoryObjectStorageBackendV1();
    const putIfAbsent = vi.spyOn(backend, "putIfAbsent");
    const store = new InMemoryObjectStoreAdapterV1({
      metadataRepository: metadata,
      backend,
      policies: [policy],
      accessPolicyVerifier: new TestObjectAccessPolicyVerifierV1(),
      now: () => new Date("2026-07-20T00:00:00.000Z"),
    });

    await expect(
      store.putImmutable(
        putRequest(new TextEncoder().encode("oversized-reservation")),
      ),
    ).rejects.toSatisfy(expectCode("storage_unavailable"));
    expect(putIfAbsent).not.toHaveBeenCalled();
  });

  it("rejects a replay record that is not bound to the put request", async () => {
    const metadata = new InMemoryObjectMetadataRepositoryV1();
    const backend = new InMemoryObjectStorageBackendV1();
    const body = new TextEncoder().encode("put-replay-binding");
    const options = {
      metadataRepository: metadata,
      backend,
      policies: [policy],
      accessPolicyVerifier: new TestObjectAccessPolicyVerifierV1(),
      now: () => new Date("2026-07-20T00:00:00.000Z"),
    };
    await new InMemoryObjectStoreAdapterV1(options).putImmutable(putRequest(body));
    const putIfAbsent = vi.spyOn(backend, "putIfAbsent");
    const maliciousMetadata = new Proxy(metadata, {
      get(target, property) {
        if (property === "reservePut") {
          return async (
            input: Parameters<ObjectMetadataRepositoryV1["reservePut"]>[0],
          ) => {
            const result = await target.reservePut(input);
            return result.kind === "replay"
              ? {
                  kind: "replay" as const,
                  record: {
                    ...result.record,
                    object_class: "runtime_artifact",
                  },
                }
              : result;
          };
        }
        const member = Reflect.get(target, property, target) as unknown;
        return typeof member === "function" ? member.bind(target) : member;
      },
    }) as ObjectMetadataRepositoryV1;
    const store = new InMemoryObjectStoreAdapterV1({
      ...options,
      metadataRepository: maliciousMetadata,
    });

    await expect(store.putImmutable(putRequest(body))).rejects.toSatisfy(
      expectCode("integrity_mismatch"),
    );
    expect(putIfAbsent).not.toHaveBeenCalled();
  });

  it("rejects an unbound put record from both completion and ambiguity lookup", async () => {
    class UnboundPutFinalizationRepository extends InMemoryObjectMetadataRepositoryV1 {
      public override async completePut(
        input: Parameters<InMemoryObjectMetadataRepositoryV1["completePut"]>[0],
      ) {
        const record = await super.completePut(input);
        return {
          ...record,
          object_ref: "objv1_wrong_put_completion" as ObjectRefV1,
        };
      }

      public override async findPutFinalization(reservationId: string) {
        const result = await super.findPutFinalization(reservationId);
        return result.kind === "committed"
          ? {
              kind: "committed" as const,
              record: {
                ...result.record,
                object_ref: "objv1_wrong_put_lookup" as ObjectRefV1,
              },
            }
          : result;
      }
    }
    const harness = createHarness("memory", new UnboundPutFinalizationRepository());

    await expect(
      harness.store.putImmutable(
        putRequest(new TextEncoder().encode("put-finalization-binding")),
      ),
    ).rejects.toSatisfy(expectCode("integrity_mismatch"));
  });

  it("rejects a replayed deletion record whose immutable version changed", async () => {
    class UnboundDeleteReplayRepository extends InMemoryObjectMetadataRepositoryV1 {
      public override async reserveDelete(
        input: Parameters<InMemoryObjectMetadataRepositoryV1["reserveDelete"]>[0],
      ) {
        const result = await super.reserveDelete(input);
        return result.kind === "replay"
          ? {
              kind: "replay" as const,
              record: { ...result.record, version: "wrong-delete-replay-version" },
            }
          : result;
      }
    }
    const harness = createHarness("memory", new UnboundDeleteReplayRepository());
    const created = await harness.store.putImmutable(
      putRequest(new TextEncoder().encode("delete-replay-binding")),
    );
    harness.setNow("2026-07-22T00:00:00.000Z");
    const request = authorizedRequest(harness, "delete", {
      owner_service: "trigger_processor" as const,
      scope,
      capability: "trigger_process.snapshot.manage",
      object_ref: created.object_ref,
      deletion_decision_version: "delete-replay-binding-v1",
      idempotency_key: "delete-replay-binding-1",
    });
    await expect(harness.store.deleteIfEligible(request)).resolves.toMatchObject({
      deleted: true,
      replayed: false,
    });

    await expect(harness.store.deleteIfEligible(request)).rejects.toSatisfy(
      expectCode("integrity_mismatch"),
    );
  });

  it("rejects an unbound delete record from both completion and ambiguity lookup", async () => {
    class UnboundDeleteFinalizationRepository extends InMemoryObjectMetadataRepositoryV1 {
      public override async completeDelete(reservationId: string) {
        const record = await super.completeDelete(reservationId);
        return { ...record, version: "wrong-delete-completion-version" };
      }

      public override async findDeleteFinalization(reservationId: string) {
        const result = await super.findDeleteFinalization(reservationId);
        return result.kind === "committed"
          ? {
              kind: "committed" as const,
              record: { ...result.record, version: "wrong-delete-lookup-version" },
            }
          : result;
      }
    }
    const harness = createHarness(
      "memory",
      new UnboundDeleteFinalizationRepository(),
    );
    const created = await harness.store.putImmutable(
      putRequest(new TextEncoder().encode("delete-finalization-binding")),
    );
    harness.setNow("2026-07-22T00:00:00.000Z");
    const request = authorizedRequest(harness, "delete", {
      owner_service: "trigger_processor" as const,
      scope,
      capability: "trigger_process.snapshot.manage",
      object_ref: created.object_ref,
      deletion_decision_version: "delete-finalization-binding-v1",
      idempotency_key: "delete-finalization-binding-1",
    });

    await expect(harness.store.deleteIfEligible(request)).rejects.toSatisfy(
      expectCode("integrity_mismatch"),
    );
  });
});

class CommitPutThenThrowRepository extends InMemoryObjectMetadataRepositoryV1 {
  public override async completePut(
    input: Parameters<InMemoryObjectMetadataRepositoryV1["completePut"]>[0],
  ) {
    const result = await super.completePut(input);
    throw Object.assign(new Error("injected post-commit disconnect"), { result });
  }
}

class CommitReservePutThenThrowRepository extends InMemoryObjectMetadataRepositoryV1 {
  #disconnectNext = true;

  public override async reservePut(
    input: Parameters<InMemoryObjectMetadataRepositoryV1["reservePut"]>[0],
  ) {
    const result = await super.reservePut(input);
    if (this.#disconnectNext && result.kind === "claimed") {
      this.#disconnectNext = false;
      throw new Error("injected reserve-put post-commit disconnect");
    }
    return result;
  }
}

class RejectPutFinalizationRepository extends InMemoryObjectMetadataRepositoryV1 {
  #rejectNext = true;

  public override async completePut(
    input: Parameters<InMemoryObjectMetadataRepositoryV1["completePut"]>[0],
  ) {
    if (this.#rejectNext) {
      this.#rejectNext = false;
      throw new Error("injected pre-commit failure");
    }
    return super.completePut(input);
  }
}

class CommitReconciliationThenThrowRepository extends RejectPutFinalizationRepository {
  #disconnectNext = true;

  public override async completeReconciliation(
    input: Parameters<
      InMemoryObjectMetadataRepositoryV1["completeReconciliation"]
    >[0],
  ) {
    const result = await super.completeReconciliation(input);
    if (this.#disconnectNext) {
      this.#disconnectNext = false;
      throw new Error("injected reconciliation post-commit disconnect");
    }
    return result;
  }
}

class UnboundPutReconciliationRepository extends RejectPutFinalizationRepository {
  public override async completeReconciliation(
    input: Parameters<
      InMemoryObjectMetadataRepositoryV1["completeReconciliation"]
    >[0],
  ) {
    const record = await super.completeReconciliation(input);
    return record === undefined
      ? undefined
      : {
          ...record,
          object_ref: "objv1_wrong_put_reconciliation" as ObjectRefV1,
        };
  }
}

class CommitDeleteThenThrowRepository extends InMemoryObjectMetadataRepositoryV1 {
  public override async completeDelete(reservationId: string) {
    const result = await super.completeDelete(reservationId);
    throw Object.assign(new Error("injected post-commit disconnect"), { result });
  }
}

class CommitReserveDeleteThenThrowRepository extends InMemoryObjectMetadataRepositoryV1 {
  #disconnectNext = true;

  public override async reserveDelete(
    input: Parameters<InMemoryObjectMetadataRepositoryV1["reserveDelete"]>[0],
  ) {
    const result = await super.reserveDelete(input);
    if (this.#disconnectNext && result.kind === "claimed") {
      this.#disconnectNext = false;
      throw new Error("injected reserve-delete post-commit disconnect");
    }
    return result;
  }
}

class RejectDeleteFinalizationRepository extends InMemoryObjectMetadataRepositoryV1 {
  #rejectNext = true;

  public override async completeDelete(reservationId: string) {
    if (this.#rejectNext) {
      this.#rejectNext = false;
      throw new Error("injected pre-commit delete finalization failure");
    }
    return super.completeDelete(reservationId);
  }
}

class UnboundDeleteReconciliationRepository extends RejectDeleteFinalizationRepository {
  public override async completeReconciliation(
    input: Parameters<
      InMemoryObjectMetadataRepositoryV1["completeReconciliation"]
    >[0],
  ) {
    const record = await super.completeReconciliation(input);
    return record === undefined
      ? undefined
      : { ...record, version: "wrong-delete-reconciliation-version" };
  }
}

class MismatchedTerminalReceiptBackend extends InMemoryObjectStorageBackendV1 {
  public override async finalizeAbandonedPutAttempt() {
    return {
      kind: "terminal" as const,
      receipt: {
        upload_attempt_token: "different-upload-attempt",
        terminal_at: "2099-01-01T00:00:00.000Z",
      },
    };
  }
}

class PutMetadataOutageRepository extends InMemoryObjectMetadataRepositoryV1 {
  #failComplete = true;
  #failLookup = true;
  #failHandoff = true;

  public override async completePut(
    input: Parameters<InMemoryObjectMetadataRepositoryV1["completePut"]>[0],
  ) {
    if (this.#failComplete) {
      this.#failComplete = false;
      throw new Error("injected metadata outage during put finalization");
    }
    return super.completePut(input);
  }

  public override async findPutFinalization(reservationId: string) {
    if (this.#failLookup) {
      this.#failLookup = false;
      throw new Error("injected metadata outage during put lookup");
    }
    return super.findPutFinalization(reservationId);
  }

  public override async handoffPutReconciliation(
    reservationId: string,
    operation: "put_finalize" | "put_cleanup",
    foregroundLeaseToken: string,
    notBefore?: Date,
    foregroundUploadMayStillArrive?: boolean,
  ): Promise<void> {
    if (this.#failHandoff) {
      this.#failHandoff = false;
      throw new Error("injected metadata outage during put handoff");
    }
    return super.handoffPutReconciliation(
      reservationId,
      operation,
      foregroundLeaseToken,
      notBefore,
      foregroundUploadMayStillArrive,
    );
  }
}

class DeleteMetadataOutageRepository extends InMemoryObjectMetadataRepositoryV1 {
  #failComplete = true;
  #failLookup = true;
  #failHandoff = true;

  public override async completeDelete(reservationId: string) {
    if (this.#failComplete) {
      this.#failComplete = false;
      throw new Error("injected metadata outage during delete finalization");
    }
    return super.completeDelete(reservationId);
  }

  public override async findDeleteFinalization(reservationId: string) {
    if (this.#failLookup) {
      this.#failLookup = false;
      throw new Error("injected metadata outage during delete lookup");
    }
    return super.findDeleteFinalization(reservationId);
  }

  public override async handoffDeleteReconciliation(
    reservationId: string,
  ): Promise<void> {
    if (this.#failHandoff) {
      this.#failHandoff = false;
      throw new Error("injected metadata outage during delete handoff");
    }
    return super.handoffDeleteReconciliation(reservationId);
  }
}

class FailFirstIntegrityCleanupBackend extends InMemoryObjectStorageBackendV1 {
  #corruptNextUpload = true;
  #failNextDelete = true;

  public override async putIfAbsent(request: PutBackendObjectV1) {
    if (!this.#corruptNextUpload) return super.putIfAbsent(request);
    this.#corruptNextUpload = false;
    const original = await readAll(request.body);
    const corrupted = original.slice();
    if (corrupted.byteLength > 0) corrupted[0] = (corrupted[0] ?? 0) ^ 0xff;
    return super.putIfAbsent({ ...request, body: bytes(corrupted) });
  }

  public override async delete(
    ...input: Parameters<InMemoryObjectStorageBackendV1["delete"]>
  ): Promise<void> {
    if (this.#failNextDelete) {
      this.#failNextDelete = false;
      throw new ObjectStorageBackendErrorV1("unavailable", "injected delete failure");
    }
    return super.delete(...input);
  }
}

class AmbiguousIntegrityDeleteBackend extends InMemoryObjectStorageBackendV1 {
  #corruptNextUpload = true;
  #failNextDelete = true;
  #transientHeadNotFound = false;
  #lastRequest: PutBackendObjectV1 | undefined;

  public override async putIfAbsent(request: PutBackendObjectV1) {
    this.#lastRequest = request;
    if (!this.#corruptNextUpload) return super.putIfAbsent(request);
    this.#corruptNextUpload = false;
    const original = await readAll(request.body);
    const corrupted = original.slice();
    if (corrupted.byteLength > 0) corrupted[0] = (corrupted[0] ?? 0) ^ 0xff;
    return super.putIfAbsent({ ...request, body: bytes(corrupted) });
  }

  public override async delete(
    ...input: Parameters<InMemoryObjectStorageBackendV1["delete"]>
  ): Promise<void> {
    if (this.#failNextDelete) {
      this.#failNextDelete = false;
      this.#transientHeadNotFound = true;
      throw new ObjectStorageBackendErrorV1(
        "unavailable",
        "injected ambiguous delete failure",
      );
    }
    this.#transientHeadNotFound = false;
    return super.delete(...input);
  }

  public override async head(
    ...input: Parameters<InMemoryObjectStorageBackendV1["head"]>
  ) {
    if (this.#transientHeadNotFound) {
      this.#transientHeadNotFound = false;
      throw new ObjectStorageBackendErrorV1(
        "not_found",
        "injected transient not-found probe",
      );
    }
    return super.head(...input);
  }

  public async physicalObjectExists(): Promise<boolean> {
    const request = this.#lastRequest;
    if (request === undefined) return false;
    try {
      await super.head(request.bucket, request.key);
      return true;
    } catch (error) {
      if (
        error instanceof ObjectStorageBackendErrorV1 &&
        error.code === "not_found"
      ) {
        return false;
      }
      throw error;
    }
  }
}

class PausedCorruptForegroundReadBackend extends InMemoryObjectStorageBackendV1 {
  readonly foregroundReadStarted: Promise<void>;
  #markForegroundReadStarted!: () => void;
  readonly #resumeForegroundRead: Promise<void>;
  #resume!: () => void;
  #getCount = 0;
  #objectRef: ObjectRefV1 | undefined;

  public constructor() {
    super();
    this.foregroundReadStarted = new Promise((resolve) => {
      this.#markForegroundReadStarted = resolve;
    });
    this.#resumeForegroundRead = new Promise((resolve) => {
      this.#resume = resolve;
    });
  }

  public override async putIfAbsent(request: PutBackendObjectV1) {
    this.#objectRef = request.key.split("/").at(-1) as ObjectRefV1;
    return super.putIfAbsent(request);
  }

  public override async get(
    ...input: Parameters<InMemoryObjectStorageBackendV1["get"]>
  ) {
    const result = await super.get(...input);
    this.#getCount += 1;
    if (this.#getCount !== 1) return result;
    const original = await readAll(result.body);
    const corrupted = original.slice();
    if (corrupted.byteLength > 0) corrupted[0] = (corrupted[0] ?? 0) ^ 0xff;
    const markStarted = this.#markForegroundReadStarted;
    const resume = this.#resumeForegroundRead;
    const pausedBody = async function* (): AsyncIterable<Uint8Array> {
      markStarted();
      await resume;
      yield corrupted;
    };
    return { ...result, body: pausedBody() };
  }

  public releaseForegroundRead(): void {
    this.#resume();
  }

  public objectRef(): ObjectRefV1 {
    if (this.#objectRef === undefined) throw new Error("object ref was not captured");
    return this.#objectRef;
  }
}

class MismatchOnFirstReconciliationReadBackend extends InMemoryObjectStorageBackendV1 {
  #readCount = 0;

  public override async get(
    ...input: Parameters<InMemoryObjectStorageBackendV1["get"]>
  ) {
    const result = await super.get(...input);
    this.#readCount += 1;
    if (this.#readCount !== 2) return result;
    const original = await readAll(result.body);
    const corrupted = original.slice();
    if (corrupted.byteLength > 0) corrupted[0] = (corrupted[0] ?? 0) ^ 0xff;
    return { ...result, body: bytes(corrupted) };
  }
}

class FailFirstPutCleanupHandoffRepository extends InMemoryObjectMetadataRepositoryV1 {
  #failCleanupHandoff = true;

  public override async handoffPutReconciliation(
    reservationId: string,
    operation: "put_finalize" | "put_cleanup",
    foregroundLeaseToken: string,
    notBefore?: Date,
    foregroundUploadMayStillArrive?: boolean,
  ): Promise<void> {
    if (operation === "put_cleanup" && this.#failCleanupHandoff) {
      this.#failCleanupHandoff = false;
      throw new Error("injected cleanup handoff outage");
    }
    return super.handoffPutReconciliation(
      reservationId,
      operation,
      foregroundLeaseToken,
      notBefore,
      foregroundUploadMayStillArrive,
    );
  }
}

class PausedPutBackend extends InMemoryObjectStorageBackendV1 {
  readonly started: Promise<void>;
  #markStarted!: () => void;
  #resume!: () => void;
  readonly #resumed: Promise<void>;
  #request: PutBackendObjectV1 | undefined;
  #released = false;
  public deleteCount = 0;
  public terminalFinalizeCount = 0;

  public constructor() {
    super();
    this.started = new Promise((resolve) => {
      this.#markStarted = resolve;
    });
    this.#resumed = new Promise((resolve) => {
      this.#resume = resolve;
    });
  }

  public release(): void {
    this.#released = true;
    this.#resume();
  }

  public override async putIfAbsent(request: PutBackendObjectV1) {
    this.#request = request;
    this.#markStarted();
    await this.#resumed;
    return super.putIfAbsent(request);
  }

  public override async delete(
    ...input: Parameters<InMemoryObjectStorageBackendV1["delete"]>
  ): Promise<void> {
    this.deleteCount += 1;
    return super.delete(...input);
  }

  public override async finalizeAbandonedPutAttempt(
    ...input: Parameters<InMemoryObjectStorageBackendV1["finalizeAbandonedPutAttempt"]>
  ) {
    this.terminalFinalizeCount += 1;
    if (!this.#released) return { kind: "active_or_unknown" as const };
    return super.finalizeAbandonedPutAttempt(...input);
  }

  public async hasPublishedObject(): Promise<boolean> {
    if (this.#request === undefined) return false;
    try {
      await super.head(this.#request.bucket, this.#request.key);
      return true;
    } catch (error) {
      if (
        error instanceof ObjectStorageBackendErrorV1 &&
        error.code === "not_found"
      ) {
        return false;
      }
      throw error;
    }
  }
}

class UnknownTerminalLatePublishBackend implements ObjectStorageBackendV1 {
  #request: PutBackendObjectV1 | undefined;
  #body: Uint8Array | undefined;
  #published = false;

  public async putIfAbsent(
    request: PutBackendObjectV1,
  ): Promise<BackendObjectHeadV1> {
    this.#request = request;
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for await (const chunk of request.body) {
        chunks.push(chunk.slice());
        size += chunk.byteLength;
      }
    } catch (error) {
      const body = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.byteLength;
      }
      this.#body = body;
      throw error;
    }
    throw new ObjectStorageBackendErrorV1(
      "unavailable",
      "expected source failure after declared prefix",
    );
  }

  public publishLate(): void {
    if (this.#request === undefined || this.#body === undefined) {
      throw new Error("late upload was not captured");
    }
    this.#published = true;
  }

  public async head(
    bucket: Parameters<ObjectStorageBackendV1["head"]>[0],
    key: string,
  ): Promise<BackendObjectHeadV1> {
    if (
      !this.#published ||
      this.#request === undefined ||
      this.#body === undefined ||
      this.#request.bucket !== bucket ||
      this.#request.key !== key
    ) {
      throw new ObjectStorageBackendErrorV1("not_found", "object not found");
    }
    return {
      version: "late-version",
      size_bytes: this.#body.byteLength,
      media_type: this.#request.media_type,
      sha256: this.#request.sha256,
    };
  }

  public async get(
    bucket: Parameters<ObjectStorageBackendV1["get"]>[0],
    key: string,
    _range?: BackendObjectRangeV1,
  ): Promise<BackendObjectStreamV1> {
    await this.head(bucket, key);
    const body = this.#body;
    if (body === undefined) throw new Error("late body missing");
    return {
      body: bytes(body),
      offset: 0,
      length: body.byteLength,
      total_size_bytes: body.byteLength,
    };
  }

  public async issueReadGrant(
    bucket: Parameters<ObjectStorageBackendV1["issueReadGrant"]>[0],
    key: string,
    _ttlSeconds: number,
  ): Promise<string> {
    await this.head(bucket, key);
    return `late-grant://${bucket}/${key}`;
  }

  public async delete(
    bucket: Parameters<ObjectStorageBackendV1["delete"]>[0],
    key: string,
  ): Promise<void> {
    await this.head(bucket, key);
    this.#published = false;
  }
}

describe("ObjectStore ambiguous finalization recovery", () => {
  it("recovers a durable put reservation created before a reserve response disconnect", async () => {
    const metadata = new CommitReservePutThenThrowRepository();
    const harness = createHarness("memory", metadata);
    const body = new TextEncoder().encode("reserve-put-commit-disconnect");
    await expect(harness.store.putImmutable(putRequest(body))).rejects.toSatisfy(
      expectCode("storage_unavailable"),
    );

    harness.setNow("2026-07-20T00:06:00.000Z");
    await expect(
      harness.store.reconcilePending({
        worker_id: "reserve-put-finalizer",
        limit: 1,
        lease_seconds: 30,
      }),
    ).resolves.toEqual({ claimed: 1, completed: 0, retry_scheduled: 1 });
    harness.setNow("2026-07-20T00:16:00.000Z");
    await expect(
      harness.store.reconcilePending({
        worker_id: "reserve-put-cleaner",
        limit: 1,
        lease_seconds: 30,
      }),
    ).resolves.toEqual({ claimed: 1, completed: 1, retry_scheduled: 0 });
    await expect(harness.store.putImmutable(putRequest(body))).resolves.toMatchObject({
      replayed: false,
      sha256: digest(body),
    });
  });

  it("recovers a durable delete reservation created before a reserve response disconnect", async () => {
    const metadata = new CommitReserveDeleteThenThrowRepository();
    const harness = createHarness("memory", metadata);
    const created = await harness.store.putImmutable(
      putRequest(new TextEncoder().encode("reserve-delete-commit-disconnect")),
    );
    harness.setNow("2026-07-22T00:00:00.000Z");
    const request = authorizedRequest(harness, "delete", {
      owner_service: "trigger_processor",
      scope,
      capability: "trigger_process.snapshot.manage",
      object_ref: created.object_ref,
      deletion_decision_version: "reserve-delete-v1",
      idempotency_key: "reserve-delete-1",
    });
    await expect(harness.store.deleteIfEligible(request)).rejects.toSatisfy(
      expectCode("storage_unavailable"),
    );
    await expect(harness.store.deleteIfEligible(request)).resolves.toEqual({
      object_ref: created.object_ref,
      deleted: true,
      replayed: true,
    });
  });

  it("recovers a put when finalize, lookup, and handoff all fail", async () => {
    const harness = createHarness("memory", new PutMetadataOutageRepository());
    const body = new TextEncoder().encode("full-put-metadata-outage");
    await expect(harness.store.putImmutable(putRequest(body))).rejects.toSatisfy(
      expectCode("storage_unavailable"),
    );
    await expect(harness.store.putImmutable(putRequest(body))).rejects.toSatisfy(
      expectCode("precondition_failed"),
    );
    harness.setNow("2026-07-20T00:06:00.000Z");
    await expect(harness.store.putImmutable(putRequest(body))).resolves.toMatchObject({
      replayed: true,
      sha256: digest(body),
    });
  });

  it("recovers a delete when finalize, lookup, and handoff all fail", async () => {
    const metadata = new DeleteMetadataOutageRepository();
    const harness = createHarness("memory", metadata);
    const created = await harness.store.putImmutable(
      putRequest(new TextEncoder().encode("full-delete-metadata-outage")),
    );
    harness.setNow("2026-07-22T00:00:00.000Z");
    const request = authorizedRequest(harness, "delete", {
      owner_service: "trigger_processor",
      scope,
      capability: "trigger_process.snapshot.manage",
      object_ref: created.object_ref,
      deletion_decision_version: "decision-outage",
      idempotency_key: "delete-outage",
    });
    await expect(harness.store.deleteIfEligible(request)).rejects.toSatisfy(
      expectCode("storage_unavailable"),
    );
    await expect(harness.store.deleteIfEligible(request)).resolves.toMatchObject({
      deleted: true,
      replayed: true,
    });
  });

  it("queries a put reservation after commit-then-throw and never compensates the committed object", async () => {
    const harness = createHarness("memory", new CommitPutThenThrowRepository());
    const body = new TextEncoder().encode("commit-survives-disconnect");
    const created = await harness.store.putImmutable(putRequest(body));
    expect(created.replayed).toBe(false);
    await expect(
      harness.store.head(
        authorizedRequest(harness, "head", {
          owner_service: "trigger_processor",
          scope,
          capability: "trigger_process.snapshot.resolve",
          object_ref: created.object_ref,
        }),
      ),
    ).resolves.toMatchObject({ sha256: digest(body) });
  });

  it("keeps a pre-commit put pending for reconciliation instead of deleting unknown physical state", async () => {
    const harness = createHarness("memory", new RejectPutFinalizationRepository());
    const body = new TextEncoder().encode("pending-reconciliation");
    await expect(harness.store.putImmutable(putRequest(body))).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof ObjectStoreErrorV1 &&
        error.code === "storage_unavailable" &&
        error.details.reconciliation_required === true &&
        error.details.finalization_state === "pending",
    );
    await expect(harness.store.putImmutable(putRequest(body))).resolves.toMatchObject({
      replayed: true,
    });
    await expect(
      (harness.store as ObjectStorePortV1 & ObjectStoreReconciliationPortV1)
        .reconcilePending({ worker_id: "duplicate-worker", limit: 10, lease_seconds: 30 }),
    ).resolves.toEqual({ claimed: 0, completed: 0, retry_scheduled: 0 });
  });

  it("converges after reconciliation commits before its response disconnects", async () => {
    const harness = createHarness(
      "memory",
      new CommitReconciliationThenThrowRepository(),
    );
    const body = new TextEncoder().encode("reconciliation-commit-disconnect");
    await expect(harness.store.putImmutable(putRequest(body))).rejects.toSatisfy(
      expectCode("storage_unavailable"),
    );

    await expect(
      harness.store.reconcilePending({
        worker_id: "post-commit-disconnect-worker",
        limit: 1,
        lease_seconds: 30,
      }),
    ).resolves.toEqual({ claimed: 1, completed: 0, retry_scheduled: 1 });
    await expect(harness.store.putImmutable(putRequest(body))).resolves.toMatchObject({
      replayed: true,
      sha256: digest(body),
    });
    await expect(
      harness.store.reconcilePending({
        worker_id: "post-commit-confirmation-worker",
        limit: 1,
        lease_seconds: 30,
      }),
    ).resolves.toEqual({ claimed: 0, completed: 0, retry_scheduled: 0 });
  });

  it("does not report completion for an unbound put reconciliation record", async () => {
    const harness = createHarness(
      "memory",
      new UnboundPutReconciliationRepository(),
    );
    const body = new TextEncoder().encode("unbound-put-reconciliation");
    await expect(harness.store.putImmutable(putRequest(body))).rejects.toSatisfy(
      expectCode("storage_unavailable"),
    );

    await expect(
      harness.store.reconcilePending({
        worker_id: "unbound-put-reconciliation-worker",
        limit: 1,
        lease_seconds: 30,
      }),
    ).resolves.toEqual({ claimed: 1, completed: 0, retry_scheduled: 1 });
    await expect(harness.store.putImmutable(putRequest(body))).resolves.toMatchObject({
      replayed: true,
      sha256: digest(body),
    });
  });

  it("does not report completion for an unbound delete reconciliation record", async () => {
    const metadata = new UnboundDeleteReconciliationRepository();
    const harness = createHarness("memory", metadata);
    const created = await harness.store.putImmutable(
      putRequest(new TextEncoder().encode("unbound-delete-reconciliation")),
    );
    harness.setNow("2026-07-22T00:00:00.000Z");
    const request = authorizedRequest(harness, "delete", {
      owner_service: "trigger_processor" as const,
      scope,
      capability: "trigger_process.snapshot.manage",
      object_ref: created.object_ref,
      deletion_decision_version: "unbound-delete-reconciliation-v1",
      idempotency_key: "unbound-delete-reconciliation-1",
    });
    await expect(harness.store.deleteIfEligible(request)).rejects.toSatisfy(
      expectCode("storage_unavailable"),
    );

    await expect(
      harness.store.reconcilePending({
        worker_id: "unbound-delete-reconciliation-worker",
        limit: 1,
        lease_seconds: 30,
      }),
    ).resolves.toEqual({ claimed: 1, completed: 0, retry_scheduled: 1 });
    await expect(harness.store.deleteIfEligible(request)).resolves.toMatchObject({
      deleted: true,
      replayed: true,
    });
  });

  it("rejects a terminal receipt that is not bound to the abandoned upload", async () => {
    const metadata = new CommitReservePutThenThrowRepository();
    const backend = new MismatchedTerminalReceiptBackend();
    let now = new Date("2026-07-20T00:00:00.000Z");
    const store = new InMemoryObjectStoreAdapterV1({
      metadataRepository: metadata,
      backend,
      policies: [policy],
      accessPolicyVerifier: new TestObjectAccessPolicyVerifierV1(),
      now: () => now,
    });
    const body = new TextEncoder().encode("mismatched-terminal-receipt");
    await expect(store.putImmutable(putRequest(body))).rejects.toSatisfy(
      expectCode("storage_unavailable"),
    );
    const completeReconciliation = vi.spyOn(metadata, "completeReconciliation");

    now = new Date("2026-07-20T00:06:00.000Z");
    await expect(
      store.reconcilePending({
        worker_id: "terminal-receipt-redirector",
        limit: 1,
        lease_seconds: 30,
      }),
    ).resolves.toEqual({ claimed: 1, completed: 0, retry_scheduled: 1 });
    now = new Date("2026-07-20T00:16:00.000Z");
    await expect(
      store.reconcilePending({
        worker_id: "terminal-receipt-validator",
        limit: 1,
        lease_seconds: 30,
      }),
    ).resolves.toEqual({ claimed: 1, completed: 0, retry_scheduled: 1 });
    expect(completeReconciliation).not.toHaveBeenCalled();
  });

  it("queries a delete reservation after commit-then-throw and reports the committed delete", async () => {
    const metadata = new CommitDeleteThenThrowRepository();
    const harness = createHarness("memory", metadata);
    const created = await harness.store.putImmutable(
      putRequest(new TextEncoder().encode("delete-finalization")),
    );
    harness.setNow("2026-07-22T00:00:00.000Z");
    await expect(
      harness.store.deleteIfEligible(
        authorizedRequest(harness, "delete", {
          owner_service: "trigger_processor",
          scope,
          capability: "trigger_process.snapshot.manage",
          object_ref: created.object_ref,
          deletion_decision_version: "decision-v1",
          idempotency_key: "delete-finalize-1",
        }),
      ),
    ).resolves.toMatchObject({ deleted: true, replayed: false });
    expect((await metadata.findByRef(created.object_ref))?.state).toBe("deleted");
  });

  it("keeps metadata delete_pending when bytes are gone but DB finalization fails", async () => {
    const metadata = new RejectDeleteFinalizationRepository();
    const harness = createHarness("memory", metadata);
    const created = await harness.store.putImmutable(
      putRequest(new TextEncoder().encode("delete-pending")),
    );
    harness.setNow("2026-07-22T00:00:00.000Z");
    await expect(
      harness.store.deleteIfEligible(
        authorizedRequest(harness, "delete", {
          owner_service: "trigger_processor",
          scope,
          capability: "trigger_process.snapshot.manage",
          object_ref: created.object_ref,
          deletion_decision_version: "decision-v2",
          idempotency_key: "delete-finalize-2",
        }),
      ),
    ).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof ObjectStoreErrorV1 &&
        error.code === "storage_unavailable" &&
        error.details.reconciliation_required === true &&
        error.details.finalization_state === "pending",
    );
    expect((await metadata.findByRef(created.object_ref))?.state).toBe(
      "delete_pending",
    );
    await expect(
      harness.store.deleteIfEligible(
        authorizedRequest(harness, "delete", {
          owner_service: "trigger_processor",
          scope,
          capability: "trigger_process.snapshot.manage",
          object_ref: created.object_ref,
          deletion_decision_version: "decision-v2",
          idempotency_key: "delete-finalize-2",
        }),
      ),
    ).resolves.toMatchObject({ deleted: true, replayed: true });
  });

  it("recovers a durable pending put after adapter restart", async () => {
    const metadata = new RejectPutFinalizationRepository();
    const backend = new InMemoryObjectStorageBackendV1();
    const accessPolicy = new TestObjectAccessPolicyVerifierV1();
    const options = {
      metadataRepository: metadata,
      backend,
      accessPolicyVerifier: accessPolicy,
      policies: [policy],
      now: () => new Date("2026-07-20T00:00:00.000Z"),
    };
    const body = new TextEncoder().encode("restart-reconciliation");
    const beforeRestart = new InMemoryObjectStoreAdapterV1(options);
    await expect(beforeRestart.putImmutable(putRequest(body))).rejects.toSatisfy(
      expectCode("storage_unavailable"),
    );
    const afterRestart = new InMemoryObjectStoreAdapterV1(options);
    await expect(afterRestart.putImmutable(putRequest(body))).resolves.toMatchObject({
      replayed: true,
    });
  });

  it("keeps metadata traceability when integrity cleanup initially fails", async () => {
    const metadata = new InMemoryObjectMetadataRepositoryV1();
    const backend = new FailFirstIntegrityCleanupBackend();
    const store = new InMemoryObjectStoreAdapterV1({
      metadataRepository: metadata,
      backend,
      accessPolicyVerifier: new TestObjectAccessPolicyVerifierV1(),
      policies: [policy],
      now: () => new Date("2026-07-20T00:00:00.000Z"),
    });
    const body = new TextEncoder().encode("cleanup-reconciliation");
    await expect(store.putImmutable(putRequest(body))).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof ObjectStoreErrorV1 &&
        error.details.reconciliation_operation === "put_cleanup",
    );
    await expect(store.putImmutable(putRequest(body))).resolves.toMatchObject({
      replayed: false,
      sha256: digest(body),
    });
  });

  it("does not treat a transient HEAD 404 as terminal proof after an ambiguous cleanup delete", async () => {
    const metadata = new InMemoryObjectMetadataRepositoryV1();
    const backend = new AmbiguousIntegrityDeleteBackend();
    const store = new InMemoryObjectStoreAdapterV1({
      metadataRepository: metadata,
      backend,
      accessPolicyVerifier: new TestObjectAccessPolicyVerifierV1(),
      policies: [policy],
      now: () => new Date("2026-07-20T00:00:00.000Z"),
    });
    const body = new TextEncoder().encode("ambiguous-delete-orphan-guard");
    await expect(store.putImmutable(putRequest(body))).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof ObjectStoreErrorV1 &&
        error.code === "storage_unavailable" &&
        error.details.reconciliation_operation === "put_cleanup",
    );
    expect(await backend.physicalObjectExists()).toBe(true);

    await expect(
      store.reconcilePending({
        worker_id: "ambiguous-delete-cleaner",
        limit: 1,
        lease_seconds: 30,
      }),
    ).resolves.toEqual({ claimed: 1, completed: 1, retry_scheduled: 0 });
    expect(await backend.physicalObjectExists()).toBe(false);
    await expect(store.putImmutable(putRequest(body))).resolves.toMatchObject({
      replayed: false,
      sha256: digest(body),
    });
  });

  it("does not delete bytes after a reconciler finalizes during a stale foreground integrity read", async () => {
    const metadata = new InMemoryObjectMetadataRepositoryV1();
    const backend = new PausedCorruptForegroundReadBackend();
    const accessPolicy = new TestObjectAccessPolicyVerifierV1();
    let now = new Date("2026-07-20T00:00:00.000Z");
    const store = new InMemoryObjectStoreAdapterV1({
      metadataRepository: metadata,
      backend,
      accessPolicyVerifier: accessPolicy,
      policies: [policy],
      now: () => now,
    });
    const harness: Harness = {
      store,
      metadata,
      accessPolicy,
      setNow(value: string) {
        now = new Date(value);
      },
    };
    const body = new TextEncoder().encode("foreground-integrity-race");
    const foregroundPut = store.putImmutable(putRequest(body));
    await backend.foregroundReadStarted;

    harness.setNow("2026-07-20T00:06:00.000Z");
    await expect(
      store.reconcilePending({
        worker_id: "integrity-race-finalizer",
        limit: 1,
        lease_seconds: 30,
      }),
    ).resolves.toEqual({ claimed: 1, completed: 1, retry_scheduled: 0 });

    backend.releaseForegroundRead();
    await expect(foregroundPut).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof ObjectStoreErrorV1 &&
        error.code === "storage_unavailable" &&
        error.details.reconciliation_operation === "put_cleanup",
    );
    const objectRef = backend.objectRef();
    await expect(metadata.findByRef(objectRef)).resolves.toMatchObject({
      state: "available",
      sha256: digest(body),
    });
    const streamed = await store.getStream(
      authorizedRequest(harness, "get", {
        owner_service: "trigger_processor",
        scope,
        capability: "trigger_process.snapshot.resolve",
        object_ref: objectRef,
      }),
    );
    await expect(readAll(streamed.body)).resolves.toEqual(body);
  });

  it("does not let a reconciler claim a foreground upload before its lease expires", async () => {
    const metadata = new InMemoryObjectMetadataRepositoryV1();
    const backend = new PausedPutBackend();
    const store = new InMemoryObjectStoreAdapterV1({
      metadataRepository: metadata,
      backend,
      accessPolicyVerifier: new TestObjectAccessPolicyVerifierV1(),
      policies: [policy],
      now: () => new Date("2026-07-20T00:00:00.000Z"),
    });
    const body = new TextEncoder().encode("slow-foreground-upload");
    const pendingPut = store.putImmutable(putRequest(body));
    await backend.started;
    await expect(
      store.reconcilePending({
        worker_id: "early-worker",
        limit: 1,
        lease_seconds: 30,
      }),
    ).resolves.toEqual({ claimed: 0, completed: 0, retry_scheduled: 0 });
    backend.release();
    await expect(pendingPut).resolves.toMatchObject({
      replayed: false,
      sha256: digest(body),
    });
  });

  it("requires an upload-attempt terminal receipt before clearing an expired-upload tombstone", async () => {
    const metadata = new InMemoryObjectMetadataRepositoryV1();
    const backend = new PausedPutBackend();
    let now = new Date("2026-07-20T00:00:00.000Z");
    const store = new InMemoryObjectStoreAdapterV1({
      metadataRepository: metadata,
      backend,
      accessPolicyVerifier: new TestObjectAccessPolicyVerifierV1(),
      policies: [policy],
      now: () => now,
    });
    const body = new TextEncoder().encode("late-upload-after-not-found-cleanup");
    const foregroundPut = store.putImmutable(putRequest(body));
    await backend.started;

    now = new Date("2026-07-20T00:06:00.000Z");
    await expect(
      store.reconcilePending({
        worker_id: "expired-finalizer",
        limit: 1,
        lease_seconds: 30,
      }),
    ).resolves.toEqual({ claimed: 1, completed: 0, retry_scheduled: 1 });

    now = new Date("2026-07-20T00:12:00.000Z");
    await expect(
      store.reconcilePending({
        worker_id: "not-found-cleaner",
        limit: 1,
        lease_seconds: 30,
      }),
    ).resolves.toEqual({ claimed: 1, completed: 0, retry_scheduled: 1 });
    expect(await backend.hasPublishedObject()).toBe(false);

    now = new Date("2026-07-20T00:18:00.000Z");
    await expect(
      store.reconcilePending({
        worker_id: "terminal-not-found-cleaner",
        limit: 1,
        lease_seconds: 30,
      }),
    ).resolves.toEqual({ claimed: 1, completed: 0, retry_scheduled: 1 });
    expect(await backend.hasPublishedObject()).toBe(false);
    expect(backend.terminalFinalizeCount).toBe(1);
    expect(backend.deleteCount).toBe(0);

    backend.release();
    await expect(foregroundPut).rejects.toSatisfy(
      expectCode("storage_unavailable"),
    );
    expect(await backend.hasPublishedObject()).toBe(true);

    now = new Date("2026-07-20T00:24:00.000Z");
    await expect(
      store.reconcilePending({
        worker_id: "late-byte-cleaner",
        limit: 1,
        lease_seconds: 30,
      }),
    ).resolves.toEqual({ claimed: 1, completed: 1, retry_scheduled: 0 });
    expect(await backend.hasPublishedObject()).toBe(false);
    expect(backend.terminalFinalizeCount).toBe(2);
    expect(backend.deleteCount).toBe(0);
    await expect(store.putImmutable(putRequest(body))).resolves.toMatchObject({
      replayed: false,
      sha256: digest(body),
    });
  });

  it("treats source failure after the declared prefix as an unknown PUT outcome", async () => {
    const metadata = new InMemoryObjectMetadataRepositoryV1();
    const backend = new UnknownTerminalLatePublishBackend();
    let now = new Date("2026-07-20T00:00:00.000Z");
    const store = new InMemoryObjectStoreAdapterV1({
      metadataRepository: metadata,
      backend,
      accessPolicyVerifier: new TestObjectAccessPolicyVerifierV1(),
      policies: [policy],
      now: () => now,
    });
    const declared = new TextEncoder().encode("declared-prefix");
    const extra = new TextEncoder().encode("-extra");
    async function* declaredThenExtra(): AsyncIterable<Uint8Array> {
      yield declared;
      yield extra;
    }
    await expect(
      store.putImmutable(
        putRequest(declared, {
          body: declaredThenExtra(),
          expected_sha256: digest(declared),
          size_bytes: declared.byteLength,
        }),
      ),
    ).rejects.toSatisfy(expectCode("storage_unavailable"));

    now = new Date("2026-07-20T00:12:00.000Z");
    await expect(
      store.reconcilePending({
        worker_id: "unknown-terminal-cleaner",
        limit: 1,
        lease_seconds: 30,
      }),
    ).resolves.toEqual({ claimed: 1, completed: 0, retry_scheduled: 1 });
    await expect(store.putImmutable(putRequest(declared))).rejects.toSatisfy(
      expectCode("precondition_failed"),
    );

    backend.publishLate();
    now = new Date("2026-07-20T00:18:00.000Z");
    await expect(
      store.reconcilePending({
        worker_id: "still-unknown-cleaner",
        limit: 1,
        lease_seconds: 30,
      }),
    ).resolves.toEqual({ claimed: 1, completed: 0, retry_scheduled: 1 });
  });

  it("uses trusted read-back after an expired upload lease when delete and cleanup handoff both fail", async () => {
    const metadata = new FailFirstPutCleanupHandoffRepository();
    const backend = new FailFirstIntegrityCleanupBackend();
    let now = new Date("2026-07-20T00:00:00.000Z");
    const store = new InMemoryObjectStoreAdapterV1({
      metadataRepository: metadata,
      backend,
      accessPolicyVerifier: new TestObjectAccessPolicyVerifierV1(),
      policies: [policy],
      now: () => now,
    });
    const body = new TextEncoder().encode("declared-hash-is-not-proof");
    await expect(store.putImmutable(putRequest(body))).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof ObjectStoreErrorV1 &&
        error.code === "storage_unavailable" &&
        error.details.reconciliation_operation === "put_cleanup",
    );

    now = new Date("2026-07-20T00:06:00.000Z");
    await expect(
      store.reconcilePending({
        worker_id: "expired-upload-worker",
        limit: 1,
        lease_seconds: 30,
      }),
    ).resolves.toEqual({ claimed: 1, completed: 0, retry_scheduled: 1 });
    expect([...await metadata.claimReconciliation({
      worker_id: "too-early-cleanup",
      now,
      locked_until: new Date("2026-07-20T00:06:30.000Z"),
      limit: 1,
      expired_upload_cleanup_not_before: new Date(
        "2026-07-20T00:11:00.000Z",
      ),
    })]).toHaveLength(0);

    now = new Date("2026-07-20T00:12:00.000Z");
    await expect(
      store.reconcilePending({
        worker_id: "cleanup-worker",
        limit: 1,
        lease_seconds: 30,
      }),
    ).resolves.toEqual({ claimed: 1, completed: 0, retry_scheduled: 1 });
    await expect(store.putImmutable(putRequest(body))).rejects.toSatisfy(
      expectCode("precondition_failed"),
    );

    now = new Date("2026-07-20T00:18:00.000Z");
    await expect(
      store.reconcilePending({
        worker_id: "terminal-cleanup",
        limit: 1,
        lease_seconds: 30,
      }),
    ).resolves.toEqual({ claimed: 1, completed: 1, retry_scheduled: 0 });
    await expect(store.putImmutable(putRequest(body))).resolves.toMatchObject({
      replayed: false,
      sha256: digest(body),
    });
  });

  it("redirects a terminal put-finalize mismatch to cleanup instead of retrying forever", async () => {
    const metadata = new RejectPutFinalizationRepository();
    const backend = new MismatchOnFirstReconciliationReadBackend();
    const store = new InMemoryObjectStoreAdapterV1({
      metadataRepository: metadata,
      backend,
      accessPolicyVerifier: new TestObjectAccessPolicyVerifierV1(),
      policies: [policy],
      now: () => new Date("2026-07-20T00:00:00.000Z"),
    });
    const body = new TextEncoder().encode("terminal-reconciliation-mismatch");
    await expect(store.putImmutable(putRequest(body))).rejects.toSatisfy(
      expectCode("storage_unavailable"),
    );
    await expect(
      store.reconcilePending({ worker_id: "mismatch-worker", limit: 1, lease_seconds: 30 }),
    ).resolves.toEqual({ claimed: 1, completed: 0, retry_scheduled: 1 });
    await expect(
      store.reconcilePending({ worker_id: "cleanup-worker", limit: 1, lease_seconds: 30 }),
    ).resolves.toEqual({ claimed: 1, completed: 1, retry_scheduled: 0 });
    await expect(store.putImmutable(putRequest(body))).resolves.toMatchObject({
      replayed: false,
      sha256: digest(body),
    });
  });
});

describe("ObjectStore streaming", () => {
  it("moves a multi-megabyte object in bounded chunks and performs range reads at the backend", async () => {
    const largePolicy = { ...policy, max_size_bytes: 8 * 1024 * 1024 };
    const metadata = new InMemoryObjectMetadataRepositoryV1();
    const accessPolicy = new TestObjectAccessPolicyVerifierV1();
    const store = new InMemoryObjectStoreAdapterV1({
      metadataRepository: metadata,
      accessPolicyVerifier: accessPolicy,
      policies: [largePolicy],
      now: () => new Date("2026-07-20T00:00:00.000Z"),
    });
    const harness: Harness = { store, metadata, accessPolicy, setNow() {} };
    const body = new Uint8Array(4 * 1024 * 1024);
    body.fill(0x5a);
    let producedChunks = 0;
    async function* chunked(): AsyncIterable<Uint8Array> {
      for (let offset = 0; offset < body.byteLength; offset += 64 * 1024) {
        producedChunks += 1;
        yield body.subarray(offset, offset + 64 * 1024);
      }
    }
    const created = await store.putImmutable(
      putRequest(body, { body: chunked(), idempotency_key: "large-stream" }),
    );
    expect(producedChunks).toBe(64);
    const range = await store.getStream(
      authorizedRequest(harness, "get", {
        owner_service: "trigger_processor",
        scope,
        capability: "trigger_process.snapshot.resolve",
        object_ref: created.object_ref,
        range: { offset: 2 * 1024 * 1024, length: 128 * 1024 },
      }),
    );
    expect((await readAll(range.body)).byteLength).toBe(128 * 1024);
    expect(range.content_range).toBe(
      `bytes 2097152-2228223/${body.byteLength}`,
    );
  });
});
