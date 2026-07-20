import { createHash, randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock("@supabase/supabase-js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@supabase/supabase-js")>()),
  createClient: createClientMock,
}));

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
  type ObjectAccessOperationV1,
  type ObjectAccessPolicyVerifierV1,
  type ObjectClassPolicyV1,
  type VerifiedObjectAccessDecisionV1,
  type VerifyObjectAccessDecisionInputV1,
} from "../src/composition.js";
import { InMemoryObjectStoreAdapterV1 } from "../src/in-memory-object-store-adapter.v1.js";
import { InMemoryObjectMetadataRepositoryV1 } from "../src/object-metadata-repository.v1.js";
import {
  InMemoryObjectStorageBackendV1,
  ObjectStorageBackendErrorV1,
  type PutBackendObjectV1,
} from "../src/object-storage-backend.v1.js";
import { objectScopeFingerprintV1 } from "../src/object-store-adapter-core.v1.js";

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
            metadata: { sha256: string };
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
            sha256: options.metadata.sha256,
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
                sha256: object.sha256,
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
      ...request,
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
          createClientMock.mockReturnValueOnce(fakeSupabaseClient(objects));
          return new SupabaseStorageAdapter({
            ...options,
            url: "https://storage.test.invalid",
            secretKey: "test-secret",
            fetch: fakeSupabaseFetch(objects),
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

    it("rejects corrupt or partial input without consuming the idempotency key", async () => {
      const { store } = createHarness(kind);
      const expected = new TextEncoder().encode("complete");
      const partial = new TextEncoder().encode("partial");
      await expect(
        store.putImmutable(
          putRequest(partial, {
            expected_sha256: digest(expected),
            size_bytes: expected.byteLength,
          }),
        ),
      ).rejects.toSatisfy(expectCode("integrity_mismatch"));

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
  });
}

describe("ObjectStore adapter policy validation", () => {
  it("rejects owner to bucket drift", () => {
    expect(
      () =>
        new InMemoryObjectStoreAdapterV1({
          policies: [{ ...policy, bucket: "ar-artifacts" }],
          accessPolicyVerifier: new TestObjectAccessPolicyVerifierV1(),
        }),
    ).toThrow(/cannot use bucket/);
  });

  it("keeps physical adapters, buckets, and policies out of the root API", async () => {
    const exports = await import("../src/index.js");
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
  });

  it("snapshots policy configuration so later mutation cannot expand access", async () => {
    const mutablePolicy = structuredClone(policy) as ObjectClassPolicyV1;
    const adapter = new InMemoryObjectStoreAdapterV1({
      policies: [mutablePolicy],
      accessPolicyVerifier: new TestObjectAccessPolicyVerifierV1(),
    });
    (mutablePolicy.capabilities.put as string[]).push("attacker.object.put");
    const body = new TextEncoder().encode("policy-snapshot");
    await expect(
      adapter.putImmutable(
        putRequest(body, { capability: "attacker.object.put" }),
      ),
    ).rejects.toSatisfy(expectCode("authorization_scope_mismatch"));
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

class CommitDeleteThenThrowRepository extends InMemoryObjectMetadataRepositoryV1 {
  public override async completeDelete(reservationId: string) {
    const result = await super.completeDelete(reservationId);
    throw Object.assign(new Error("injected post-commit disconnect"), { result });
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

class FailFirstIntegrityCleanupBackend extends InMemoryObjectStorageBackendV1 {
  #corruptNextHead = true;
  #failNextDelete = true;

  public override async putIfAbsent(request: PutBackendObjectV1) {
    const head = await super.putIfAbsent(request);
    if (!this.#corruptNextHead) return head;
    this.#corruptNextHead = false;
    return { ...head, sha256: `sha256:${"0".repeat(64)}` };
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

describe("ObjectStore ambiguous finalization recovery", () => {
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
