import assert from "node:assert/strict";
import test from "node:test";

import { MEMORY_EMBEDDING_PROFILE_V1 } from "../dist/memory-application.v1.js";
import {
  VolcengineMultimodalMemoryEmbeddingProviderV1,
} from "../dist/production-embedding.v1.js";

const endpoint = "https://ark.cn-beijing.volces.com/api/v3/embeddings/multimodal";

function vector(seed) {
  const result = Array.from({ length: 2_048 }, () => 0);
  result[seed] = 1;
  return result;
}

test("Volcengine multimodal provider submits one text payload per Memory vector in caller order", async () => {
  const requests = [];
  const provider = new VolcengineMultimodalMemoryEmbeddingProviderV1({
    url: endpoint,
    api_key: "test-key",
    model_id: MEMORY_EMBEDDING_PROFILE_V1.model_id,
    model_revision: MEMORY_EMBEDDING_PROFILE_V1.model_revision,
    fetch: async (_url, init) => {
      const request = JSON.parse(init.body);
      requests.push(request);
      return Response.json({
        object: "list",
        model: MEMORY_EMBEDDING_PROFILE_V1.model_id,
        data: { object: "embedding", embedding: vector(requests.length - 1) },
      });
    },
  });

  const result = await provider.embed(["first-memory", "second-memory"], MEMORY_EMBEDDING_PROFILE_V1);

  assert.deepEqual(
    requests.map((request) => request.input),
    [
      [{ type: "text", text: "first-memory" }],
      [{ type: "text", text: "second-memory" }],
    ],
  );
  assert.equal(result.length, 2);
  assert.equal(result[0].length, 2_048);
  assert.equal(result[1].length, 2_048);
  assert.equal(result[0][0], 1);
  assert.equal(result[1][1], 1);
});

test("Volcengine multimodal provider rejects a non-canonical endpoint and vector dimensions", async () => {
  assert.throws(
    () =>
      new VolcengineMultimodalMemoryEmbeddingProviderV1({
        url: "https://ark.cn-beijing.volces.com/api/v3/embeddings",
        api_key: "test-key",
        model_id: MEMORY_EMBEDDING_PROFILE_V1.model_id,
        model_revision: MEMORY_EMBEDDING_PROFILE_V1.model_revision,
      }),
    /pinned Volcengine multimodal/u,
  );

  const provider = new VolcengineMultimodalMemoryEmbeddingProviderV1({
    url: endpoint,
    api_key: "test-key",
    model_id: MEMORY_EMBEDDING_PROFILE_V1.model_id,
    model_revision: MEMORY_EMBEDDING_PROFILE_V1.model_revision,
    fetch: async () =>
      Response.json({
        model: MEMORY_EMBEDDING_PROFILE_V1.model_id,
        data: { object: "embedding", embedding: Array.from({ length: 1_024 }, () => 0) },
      }),
  });

  await assert.rejects(
    provider.embed(["wrong-dimension"], MEMORY_EMBEDDING_PROFILE_V1),
    /invalid vector/u,
  );
});
