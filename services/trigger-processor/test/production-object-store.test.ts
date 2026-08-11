import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { openTriggerProcessorObjectStoreV1 } from "../src/production-object-store.v1.js";

describe("Trigger Processor production ObjectStore", () => {
  beforeEach(() => {
    vi.stubEnv("PAI_DEPLOYMENT_ENVIRONMENT", "local");
    vi.stubEnv("PAI_LOCAL_DOCKER_TRANSPORT", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fails before opening PostgreSQL when local Storage receives a cloud API key", async () => {
    await expect(
      openTriggerProcessorObjectStoreV1({
        database_url: "postgresql://invalid",
        reconciler_database_url: "postgresql://invalid",
        supabase_url: "http://storage-edge-runtime:8080",
        supabase_secret_key: "sb_secret_not_a_local_storage_jwt",
        worker_id: "trigger-object-store-test",
        access_policy: {} as never,
      }),
    ).rejects.toThrow(
      "PAI_SUPABASE_SECRET_KEY must be an HS256 service-role JWT for local Storage",
    );
  });
});
