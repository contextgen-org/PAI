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

function fakeSupabaseClient(): SupabaseClient {
  const objects = new Map<string, FakeStoredObject>();
  const storage = {
    from(bucket: string) {
      const identity = (key: string): string => `${bucket}/${key}`;
      return {
        async upload(
          key: string,
          body: Uint8Array,
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
          const object: FakeStoredObject = {
            id: randomUUID(),
            version: randomUUID(),
            body: body.slice(),
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

function createHarness(kind: "memory" | "supabase"): Harness {
  const metadata = new InMemoryObjectMetadataRepositoryV1();
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
          createClientMock.mockReturnValueOnce(fakeSupabaseClient());
          return new SupabaseStorageAdapter({
            ...options,
            url: "https://storage.test.invalid",
            secretKey: "test-secret",
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
