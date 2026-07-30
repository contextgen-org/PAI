import {
  MEMORY_EMBEDDING_PROFILE_V1,
  type MemoryEmbeddingPortV1,
} from "./memory-application.v1.js";

export interface MemoryEmbeddingProviderOptionsV1 {
  readonly url: string;
  readonly api_key?: string;
  readonly model_id: string;
  readonly model_revision: string;
  readonly timeout_ms?: number;
  readonly fetch?: typeof fetch;
}

function endpointV1(value: string): URL {
  const url = new URL(value);
  const loopback = url.hostname === "127.0.0.1" || url.hostname === "[::1]" || url.hostname === "localhost";
  if (
    (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.search.length > 0 ||
    url.hash.length > 0
  ) {
    throw new Error("PAI_MEMORY_EMBEDDING_URL must be HTTPS or loopback HTTP without credentials, query, or fragment");
  }
  return url;
}

function timeoutV1(value: number | undefined): number {
  const timeout = value ?? 10_000;
  if (!Number.isSafeInteger(timeout) || timeout < 100 || timeout > 300_000) {
    throw new Error("Memory embedding timeout must be an integer from 100 to 300000 ms");
  }
  return timeout;
}

function normalizeVectorV1(value: unknown): readonly number[] {
  if (
    !Array.isArray(value) ||
    value.length !== MEMORY_EMBEDDING_PROFILE_V1.dimensions ||
    value.some((entry) => typeof entry !== "number" || !Number.isFinite(entry))
  ) {
    throw new Error("Memory embedding provider returned an invalid vector");
  }
  const vector = value as number[];
  const magnitude = Math.sqrt(vector.reduce((sum, entry) => sum + entry * entry, 0));
  if (!Number.isFinite(magnitude) || magnitude <= 0) {
    throw new Error("Memory embedding provider returned a zero or invalid vector");
  }
  return Object.freeze(vector.map((entry) => entry / magnitude));
}

function responseVectorsV1(value: unknown, count: number, modelId: string): readonly (readonly number[])[] {
  if (Array.isArray(value)) {
    if (value.length !== count) throw new Error("Memory embedding provider returned the wrong vector count");
    return Object.freeze(value.map(normalizeVectorV1));
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Memory embedding provider response is invalid");
  }
  const response = value as Readonly<Record<string, unknown>>;
  if (response.model !== undefined && response.model !== modelId) {
    throw new Error("Memory embedding provider model identity drift");
  }
  if (!Array.isArray(response.data) || response.data.length !== count) {
    throw new Error("Memory embedding provider returned the wrong vector count");
  }
  const ordered = [...response.data].sort((left, right) => {
    const leftIndex = typeof left === "object" && left !== null && "index" in left ? Number(left.index) : Number.NaN;
    const rightIndex = typeof right === "object" && right !== null && "index" in right ? Number(right.index) : Number.NaN;
    return leftIndex - rightIndex;
  });
  return Object.freeze(
    ordered.map((entry, index) => {
      if (
        typeof entry !== "object" ||
        entry === null ||
        !("index" in entry) ||
        Number(entry.index) !== index ||
        !("embedding" in entry)
      ) {
        throw new Error("Memory embedding provider response ordering is invalid");
      }
      return normalizeVectorV1(entry.embedding);
    }),
  );
}

const VOLCENGINE_MULTIMODAL_EMBEDDING_ENDPOINT_V1 =
  "https://ark.cn-beijing.volces.com/api/v3/embeddings/multimodal";

function volcengineMultimodalEndpointV1(value: string): URL {
  const url = endpointV1(value);
  if (url.href !== VOLCENGINE_MULTIMODAL_EMBEDDING_ENDPOINT_V1) {
    throw new Error(
      "PAI_MEMORY_EMBEDDING_URL must be the pinned Volcengine multimodal embeddings endpoint",
    );
  }
  return url;
}

function volcengineMultimodalVectorV1(value: unknown, modelId: string): readonly number[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Volcengine multimodal embedding response is invalid");
  }
  const response = value as Readonly<Record<string, unknown>>;
  if (response.model !== modelId) {
    throw new Error("Volcengine multimodal embedding model identity drift");
  }
  const data = response.data;
  if (typeof data !== "object" || data === null || Array.isArray(data) || !("embedding" in data)) {
    throw new Error("Volcengine multimodal embedding response data is invalid");
  }
  return normalizeVectorV1(data.embedding);
}

export class HttpMemoryEmbeddingProviderV1 implements MemoryEmbeddingPortV1 {
  readonly #url: URL;
  readonly #timeoutMs: number;
  readonly #fetch: typeof fetch;

  public constructor(private readonly options: MemoryEmbeddingProviderOptionsV1) {
    this.#url = endpointV1(options.url);
    this.#timeoutMs = timeoutV1(options.timeout_ms);
    this.#fetch = options.fetch ?? fetch;
    if (
      options.model_id !== MEMORY_EMBEDDING_PROFILE_V1.model_id ||
      options.model_revision !== MEMORY_EMBEDDING_PROFILE_V1.model_revision
    ) {
      throw new Error("Memory embedding provider is not pinned to the canonical model revision");
    }
  }

  public async checkReadiness(): Promise<void> {
    await this.embed(["pai-memory-readiness"], MEMORY_EMBEDDING_PROFILE_V1);
  }

  public async embed(
    inputs: readonly string[],
    profile: typeof MEMORY_EMBEDDING_PROFILE_V1,
  ): Promise<readonly (readonly number[])[]> {
    if (profile.profile_id !== MEMORY_EMBEDDING_PROFILE_V1.profile_id) {
      throw new Error("Memory embedding profile identity drift");
    }
    if (inputs.length === 0) return Object.freeze([]);
    const response = await this.#fetch(this.#url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.options.api_key === undefined
          ? {}
          : { authorization: `Bearer ${this.options.api_key}` }),
      },
      body: JSON.stringify({
        model: this.options.model_id,
        input: inputs,
        encoding_format: "float",
      }),
      signal: AbortSignal.timeout(this.#timeoutMs),
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw new Error(`Memory embedding provider returned HTTP ${response.status}`);
    }
    const contentLength = Number(response.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > 32 * 1024 * 1024) {
      await response.body?.cancel().catch(() => undefined);
      throw new Error("Memory embedding provider response exceeds 32 MiB");
    }
    return responseVectorsV1(await response.json(), inputs.length, this.options.model_id);
  }
}

/**
 * Volcengine's multimodal endpoint returns exactly one fused vector for each
 * input payload. Memory has one vector per text, so every text is submitted as
 * its own text-only multimodal payload and responses retain caller order.
 */
export class VolcengineMultimodalMemoryEmbeddingProviderV1 implements MemoryEmbeddingPortV1 {
  readonly #url: URL;
  readonly #timeoutMs: number;
  readonly #fetch: typeof fetch;

  public constructor(private readonly options: MemoryEmbeddingProviderOptionsV1) {
    this.#url = volcengineMultimodalEndpointV1(options.url);
    this.#timeoutMs = timeoutV1(options.timeout_ms);
    this.#fetch = options.fetch ?? fetch;
    if (options.api_key === undefined || options.api_key.length === 0) {
      throw new Error("PAI_MEMORY_EMBEDDING_API_KEY is required for Volcengine multimodal embedding");
    }
    if (
      options.model_id !== MEMORY_EMBEDDING_PROFILE_V1.model_id ||
      options.model_revision !== MEMORY_EMBEDDING_PROFILE_V1.model_revision
    ) {
      throw new Error("Memory embedding provider is not pinned to the canonical model revision");
    }
  }

  public async checkReadiness(): Promise<void> {
    await this.embed(["pai-memory-readiness"], MEMORY_EMBEDDING_PROFILE_V1);
  }

  async #embedOne(input: string): Promise<readonly number[]> {
    const response = await this.#fetch(this.#url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.options.api_key}`,
      },
      body: JSON.stringify({
        model: this.options.model_id,
        encoding_format: "float",
        input: [{ type: "text", text: input }],
      }),
      signal: AbortSignal.timeout(this.#timeoutMs),
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw new Error(`Volcengine multimodal embedding provider returned HTTP ${response.status}`);
    }
    const contentLength = Number(response.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > 32 * 1024 * 1024) {
      await response.body?.cancel().catch(() => undefined);
      throw new Error("Volcengine multimodal embedding response exceeds 32 MiB");
    }
    return volcengineMultimodalVectorV1(await response.json(), this.options.model_id);
  }

  public async embed(
    inputs: readonly string[],
    profile: typeof MEMORY_EMBEDDING_PROFILE_V1,
  ): Promise<readonly (readonly number[])[]> {
    if (profile.profile_id !== MEMORY_EMBEDDING_PROFILE_V1.profile_id) {
      throw new Error("Memory embedding profile identity drift");
    }
    if (inputs.length === 0) return Object.freeze([]);
    const vectors: (readonly number[])[] = [];
    for (const input of inputs) {
      vectors.push(await this.#embedOne(input));
    }
    return Object.freeze(vectors);
  }
}

export function createMemoryEmbeddingProviderFromEnvV1(
  env: NodeJS.ProcessEnv = process.env,
): VolcengineMultimodalMemoryEmbeddingProviderV1 {
  const required = (key: string): string => {
    const value = env[key];
    if (typeof value !== "string" || value.length === 0 || value.includes("\u0000")) {
      throw new Error(`${key} is required`);
    }
    return value;
  };
  const timeoutRaw = env.PAI_MEMORY_EMBEDDING_TIMEOUT_MS;
  return new VolcengineMultimodalMemoryEmbeddingProviderV1({
    url: required("PAI_MEMORY_EMBEDDING_URL"),
    api_key: required("PAI_MEMORY_EMBEDDING_API_KEY"),
    model_id: required("PAI_MEMORY_EMBEDDING_MODEL_ID"),
    model_revision: required("PAI_MEMORY_EMBEDDING_MODEL_REVISION"),
    ...(timeoutRaw === undefined ? {} : { timeout_ms: Number(timeoutRaw) }),
  });
}
