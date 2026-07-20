import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { ObjectMetadataRepositoryV1 } from "./object-metadata-repository.v1.js";
import type { ObjectAccessPolicyVerifierV1 } from "./object-access-policy.v1.js";
import { ObjectStoreAdapterCoreV1 } from "./object-store-adapter-core.v1.js";
import {
  ObjectStorageBackendErrorV1,
  type BackendObjectHeadV1,
  type BackendObjectRangeV1,
  type BackendObjectStreamV1,
  type ObjectStorageBackendV1,
  type PutBackendObjectV1,
} from "./object-storage-backend.v1.js";
import type {
  ObjectClassPolicyV1,
  ObjectStoreBucketV1,
} from "./object-store-policy.v1.js";

interface SupabaseErrorShape {
  readonly message?: unknown;
  readonly status?: unknown;
  readonly statusCode?: unknown;
}

function asErrorShape(error: unknown): SupabaseErrorShape {
  return typeof error === "object" && error !== null
    ? (error as SupabaseErrorShape)
    : {};
}

function backendFailure(error: unknown): ObjectStorageBackendErrorV1 {
  const value = asErrorShape(error);
  const status = typeof value.status === "number" ? value.status : undefined;
  const code = typeof value.statusCode === "string" ? value.statusCode : "";
  const message = typeof value.message === "string" ? value.message : "";
  if (status === 404 || /not.?found/i.test(`${code} ${message}`)) {
    return new ObjectStorageBackendErrorV1(
      "not_found",
      "Supabase object was not found",
      { cause: error },
    );
  }
  if (
    status === 409 ||
    /already.?exists|duplicate|resourcealreadyexists/i.test(`${code} ${message}`)
  ) {
    return new ObjectStorageBackendErrorV1(
      "already_exists",
      "Supabase object already exists",
      { cause: error },
    );
  }
  return new ObjectStorageBackendErrorV1(
    "unavailable",
    "Supabase Storage request failed",
    { cause: error },
  );
}

class SupabaseObjectStorageBackendV1 implements ObjectStorageBackendV1 {
  public constructor(
    private readonly client: SupabaseClient,
    private readonly url: string,
    private readonly secretKey: string,
    private readonly fetchImpl: typeof fetch,
  ) {}

  public async putIfAbsent(
    request: PutBackendObjectV1,
  ): Promise<BackendObjectHeadV1> {
    const iterator = request.body[Symbol.asyncIterator]();
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const next = await iterator.next();
          if (next.done) controller.close();
          else controller.enqueue(next.value);
        } catch (error) {
          controller.error(error);
        }
      },
      async cancel() {
        await iterator.return?.();
      },
    });
    const { error } = await this.client.storage
      .from(request.bucket)
      .upload(request.key, stream, {
        cacheControl: "3600",
        contentType: request.media_type,
        upsert: false,
        // This is only an expected digest for diagnostics. The adapter never
        // treats caller-controlled custom metadata as proof of stored bytes.
        metadata: { expected_sha256: request.sha256 },
      });
    if (error !== null) throw backendFailure(error);
    return this.head(request.bucket, request.key);
  }

  public async head(
    bucket: ObjectStoreBucketV1,
    key: string,
  ): Promise<BackendObjectHeadV1> {
    const { data, error } = await this.client.storage.from(bucket).info(key);
    if (error !== null) throw backendFailure(error);
    const size = data.size ?? data.metadata?.size;
    const mediaType = data.contentType ?? data.metadata?.mimetype;
    const sha256 = data.metadata?.expected_sha256;
    if (
      data.version.length === 0 ||
      typeof size !== "number" ||
      !Number.isSafeInteger(size) ||
      typeof mediaType !== "string" ||
      typeof sha256 !== "string"
    ) {
      throw new ObjectStorageBackendErrorV1(
        "unavailable",
        "Supabase object metadata is incomplete",
      );
    }
    return {
      version: data.version,
      size_bytes: size,
      media_type: mediaType,
      sha256,
    };
  }

  public async get(
    bucket: ObjectStoreBucketV1,
    key: string,
    range?: BackendObjectRangeV1,
  ): Promise<BackendObjectStreamV1> {
    const encodedKey = key.split("/").map(encodeURIComponent).join("/");
    const response = await this.fetchImpl(
      `${this.url.replace(/\/$/, "")}/storage/v1/object/authenticated/${encodeURIComponent(bucket)}/${encodedKey}`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${this.secretKey}`,
          apikey: this.secretKey,
          ...(range === undefined
            ? {}
            : { range: `bytes=${range.offset}-${range.offset + range.length - 1}` }),
        },
      },
    ).catch((error: unknown) => {
      throw backendFailure(error);
    });
    if (!response.ok || response.body === null) {
      throw backendFailure({ status: response.status, message: response.statusText });
    }
    const contentRange = response.headers.get("content-range");
    const parsedRange = contentRange?.match(/^bytes (\d+)-(\d+)\/(\d+)$/);
    const offset = parsedRange === undefined || parsedRange === null
      ? 0
      : Number(parsedRange[1]);
    const totalSize = parsedRange === undefined || parsedRange === null
      ? Number(response.headers.get("content-length"))
      : Number(parsedRange[3]);
    const length = parsedRange === undefined || parsedRange === null
      ? totalSize
      : Number(parsedRange[2]) - offset + 1;
    if (![offset, length, totalSize].every(Number.isSafeInteger)) {
      throw new ObjectStorageBackendErrorV1(
        "unavailable",
        "Supabase range metadata is incomplete",
      );
    }
    const reader = response.body.getReader();
    const body = async function* (): AsyncIterable<Uint8Array> {
      try {
        while (true) {
          const next = await reader.read();
          if (next.done) return;
          yield next.value;
        }
      } finally {
        reader.releaseLock();
      }
    };
    return { body: body(), offset, length, total_size_bytes: totalSize };
  }

  public async issueReadGrant(
    bucket: ObjectStoreBucketV1,
    key: string,
    ttlSeconds: number,
  ): Promise<string> {
    const { data, error } = await this.client.storage
      .from(bucket)
      .createSignedUrl(key, ttlSeconds);
    if (error !== null) throw backendFailure(error);
    return data.signedUrl;
  }

  public async delete(
    bucket: ObjectStoreBucketV1,
    key: string,
  ): Promise<void> {
    const { error } = await this.client.storage.from(bucket).remove([key]);
    if (error !== null) throw backendFailure(error);
  }
}

export interface SupabaseStorageAdapterOptionsV1 {
  readonly url: string;
  readonly secretKey: string;
  readonly metadataRepository: ObjectMetadataRepositoryV1;
  readonly accessPolicyVerifier: ObjectAccessPolicyVerifierV1;
  readonly policies: readonly ObjectClassPolicyV1[];
  readonly now?: () => Date;
  readonly fetch?: typeof fetch;
}

/** The only production ObjectStore adapter allowed by the parent contract. */
export class SupabaseStorageAdapter extends ObjectStoreAdapterCoreV1 {
  public constructor(options: SupabaseStorageAdapterOptionsV1) {
    const client = createClient(options.url, options.secretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      ...(options.fetch === undefined
        ? {}
        : { global: { fetch: options.fetch } }),
    });
    super({
      backend: new SupabaseObjectStorageBackendV1(
        client,
        options.url,
        options.secretKey,
        options.fetch ?? globalThis.fetch,
      ),
      metadataRepository: options.metadataRepository,
      accessPolicyVerifier: options.accessPolicyVerifier,
      policies: options.policies,
      ...(options.now === undefined ? {} : { now: options.now }),
    });
  }
}
