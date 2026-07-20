import {
  InMemoryObjectMetadataRepositoryV1,
  type ObjectMetadataRepositoryV1,
} from "./object-metadata-repository.v1.js";
import {
  ObjectStoreAdapterCoreV1,
  type ObjectStoreAdapterOptionsV1,
} from "./object-store-adapter-core.v1.js";
import {
  InMemoryObjectStorageBackendV1,
  type ObjectStorageBackendV1,
} from "./object-storage-backend.v1.js";

export interface InMemoryObjectStoreAdapterOptionsV1
  extends Omit<ObjectStoreAdapterOptionsV1, "backend" | "metadataRepository"> {
  readonly metadataRepository?: ObjectMetadataRepositoryV1;
  readonly backend?: ObjectStorageBackendV1;
}

/** Test/dev fake. Production wiring must use SupabaseStorageAdapter. */
export class InMemoryObjectStoreAdapterV1 extends ObjectStoreAdapterCoreV1 {
  public constructor(options: InMemoryObjectStoreAdapterOptionsV1) {
    super({
      ...options,
      backend: options.backend ?? new InMemoryObjectStorageBackendV1(),
      metadataRepository:
        options.metadataRepository ?? new InMemoryObjectMetadataRepositoryV1(),
    });
  }
}
