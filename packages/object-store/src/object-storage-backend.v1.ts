import { randomUUID } from "node:crypto";

import type { ObjectStoreBucketV1 } from "./object-store-policy.v1.js";

export type ObjectStorageBackendErrorCodeV1 =
  | "not_found"
  | "already_exists"
  | "unavailable";

export class ObjectStorageBackendErrorV1 extends Error {
  public constructor(
    public readonly code: ObjectStorageBackendErrorCodeV1,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ObjectStorageBackendErrorV1";
  }
}

export interface BackendObjectHeadV1 {
  readonly version: string;
  readonly size_bytes: number;
  readonly media_type: string;
  readonly sha256: string;
}

export interface PutBackendObjectV1 {
  readonly bucket: ObjectStoreBucketV1;
  readonly key: string;
  readonly body: Uint8Array;
  readonly media_type: string;
  readonly sha256: string;
}

export interface ObjectStorageBackendV1 {
  putIfAbsent(request: PutBackendObjectV1): Promise<BackendObjectHeadV1>;
  head(bucket: ObjectStoreBucketV1, key: string): Promise<BackendObjectHeadV1>;
  get(bucket: ObjectStoreBucketV1, key: string): Promise<Uint8Array>;
  issueReadGrant(
    bucket: ObjectStoreBucketV1,
    key: string,
    ttlSeconds: number,
  ): Promise<string>;
  delete(bucket: ObjectStoreBucketV1, key: string): Promise<void>;
}

interface InMemoryBackendObject extends BackendObjectHeadV1 {
  readonly body: Uint8Array;
}

export class InMemoryObjectStorageBackendV1 implements ObjectStorageBackendV1 {
  readonly #objects = new Map<string, InMemoryBackendObject>();

  #key(bucket: ObjectStoreBucketV1, key: string): string {
    return `${bucket}/${key}`;
  }

  public async putIfAbsent(
    request: PutBackendObjectV1,
  ): Promise<BackendObjectHeadV1> {
    const key = this.#key(request.bucket, request.key);
    if (this.#objects.has(key)) {
      throw new ObjectStorageBackendErrorV1(
        "already_exists",
        "object already exists",
      );
    }
    const object: InMemoryBackendObject = {
      version: `mem_${randomUUID()}`,
      size_bytes: request.body.byteLength,
      media_type: request.media_type,
      sha256: request.sha256,
      body: request.body.slice(),
    };
    this.#objects.set(key, object);
    return object;
  }

  public async head(
    bucket: ObjectStoreBucketV1,
    key: string,
  ): Promise<BackendObjectHeadV1> {
    const object = this.#objects.get(this.#key(bucket, key));
    if (object === undefined) {
      throw new ObjectStorageBackendErrorV1("not_found", "object not found");
    }
    return object;
  }

  public async get(
    bucket: ObjectStoreBucketV1,
    key: string,
  ): Promise<Uint8Array> {
    const object = this.#objects.get(this.#key(bucket, key));
    if (object === undefined) {
      throw new ObjectStorageBackendErrorV1("not_found", "object not found");
    }
    return object.body.slice();
  }

  public async issueReadGrant(
    bucket: ObjectStoreBucketV1,
    key: string,
    ttlSeconds: number,
  ): Promise<string> {
    await this.head(bucket, key);
    return `memory-grant://${bucket}/${encodeURIComponent(key)}?ttl=${ttlSeconds}`;
  }

  public async delete(
    bucket: ObjectStoreBucketV1,
    key: string,
  ): Promise<void> {
    if (!this.#objects.delete(this.#key(bucket, key))) {
      throw new ObjectStorageBackendErrorV1("not_found", "object not found");
    }
  }
}
