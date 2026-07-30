import assert from "node:assert/strict";
import test from "node:test";

import {
  LOCAL_KNOWTHAT_DURABLE_OWNER_READINESS_CHECK_V1,
} from "../dist/composition.v1.js";

test("local KnowThat composition can never advertise a durable owner", async () => {
  assert.equal(
    LOCAL_KNOWTHAT_DURABLE_OWNER_READINESS_CHECK_V1.name,
    "durable_owner_repository",
  );
  await assert.rejects(
    LOCAL_KNOWTHAT_DURABLE_OWNER_READINESS_CHECK_V1.check(),
    /local in-memory owner/u,
  );
});
