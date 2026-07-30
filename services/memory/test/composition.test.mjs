import assert from "node:assert/strict";
import test from "node:test";

import {
  LOCAL_MEMORY_DURABLE_OWNER_READINESS_CHECK_V1,
  createProductionMemoryCompositionV1,
} from "../dist/composition.v1.js";

test("local Memory composition can never advertise a durable owner", async () => {
  assert.equal(
    LOCAL_MEMORY_DURABLE_OWNER_READINESS_CHECK_V1.name,
    "durable_owner_repository",
  );
  await assert.rejects(
    LOCAL_MEMORY_DURABLE_OWNER_READINESS_CHECK_V1.check(),
    /local in-memory owner/u,
  );
});

test("production Memory composition requires an explicit PostgreSQL dependency", async () => {
  await assert.rejects(
    createProductionMemoryCompositionV1({
      deployment_environment: "prod",
      release_channel: "stable",
      env: {},
    }),
    /PAI_DATABASE_URL is required/u,
  );
});
