import {
  createLocalJWKSet,
  errors,
  type JSONWebKeySet,
} from "jose";

import { snapshotVerifiedJwtJsonV1 } from "./jwt-policy.js";

export interface JwksProvider {
  load(): Promise<JSONWebKeySet>;
}

export interface JwksCacheOptions {
  readonly provider: JwksProvider;
  readonly maxAgeMs?: number;
  readonly unknownKidRefreshCooldownMs?: number;
  readonly now?: () => number;
}

type LocalJwkSet = ReturnType<typeof createLocalJWKSet>;
const MAX_JWKS_CACHE_AGE_MS = 3_600_000;
const MAX_UNKNOWN_KID_REFRESH_COOLDOWN_MS = 60_000;
const MAX_JWKS_TIMEOUT_MS = 30_000;
const MAX_JWKS_KEYS = 128;
const JWKS_REFRESH_FAILURE_BASE_DELAY_MS = 250;
const MAX_JWKS_REFRESH_FAILURE_BACKOFF_MS = 30_000;

function snapshotOptionsV1(
  value: unknown,
  allowedKeys: ReadonlySet<string>,
  label: string,
): Readonly<Record<string, unknown>> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  ) {
    throw new Error(`${label} are invalid`);
  }
  const snapshot: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || !allowedKeys.has(key)) {
      throw new Error(`${label} are invalid`);
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      throw new Error(`${label} are invalid`);
    }
    Object.defineProperty(snapshot, key, {
      value: descriptor.value,
      enumerable: true,
      configurable: false,
      writable: false,
    });
  }
  return Object.freeze(snapshot);
}

function assertJwks(value: unknown): asserts value is JSONWebKeySet {
  if (
    typeof value !== "object" ||
    value === null ||
    !("keys" in value) ||
    !Array.isArray(value.keys) ||
    value.keys.length === 0 ||
    value.keys.length > MAX_JWKS_KEYS
  ) {
    throw new Error("JWKS response must contain from 1 to 128 keys");
  }
}

/** Bounded JWKS cache. An unknown kid forces one refresh for smooth rotation. */
export class JwksCache {
  readonly #load: JwksProvider["load"];
  readonly #maxAgeMs: number;
  readonly #unknownKidRefreshCooldownMs: number;
  readonly #now: () => number;
  #loadedAt = Number.NEGATIVE_INFINITY;
  #lastUnknownKidRefreshAt = Number.NEGATIVE_INFINITY;
  #consecutiveRefreshFailures = 0;
  #refreshBackoffUntil = Number.NEGATIVE_INFINITY;
  #local: LocalJwkSet | undefined;
  #inFlight: Promise<LocalJwkSet> | undefined;

  public constructor(options: JwksCacheOptions) {
    const stableOptions = snapshotOptionsV1(
      options,
      new Set([
        "maxAgeMs",
        "now",
        "provider",
        "unknownKidRefreshCooldownMs",
      ]),
      "JWKS cache options",
    );
    const provider = stableOptions.provider as JwksProvider | undefined;
    const load = provider?.load;
    if (
      typeof load !== "function" ||
      (stableOptions.now !== undefined && typeof stableOptions.now !== "function")
    ) {
      throw new Error("JWKS cache options are invalid");
    }
    const maxAgeMsValue = stableOptions.maxAgeMs ?? 60_000;
    if (
      typeof maxAgeMsValue !== "number" ||
      !Number.isSafeInteger(maxAgeMsValue) ||
      maxAgeMsValue < 1 ||
      maxAgeMsValue > MAX_JWKS_CACHE_AGE_MS
    ) {
      throw new Error("JWKS maxAgeMs must be an integer from 1 to 3600000");
    }
    const maxAgeMs = maxAgeMsValue;
    this.#load = load.bind(provider);
    this.#maxAgeMs = maxAgeMs;
    const unknownKidRefreshCooldownMsValue =
      stableOptions.unknownKidRefreshCooldownMs ?? 5_000;
    if (
      typeof unknownKidRefreshCooldownMsValue !== "number" ||
      !Number.isSafeInteger(unknownKidRefreshCooldownMsValue) ||
      unknownKidRefreshCooldownMsValue < 1 ||
      unknownKidRefreshCooldownMsValue >
        MAX_UNKNOWN_KID_REFRESH_COOLDOWN_MS
    ) {
      throw new Error(
        "JWKS unknownKidRefreshCooldownMs must be an integer from 1 to 60000",
      );
    }
    this.#unknownKidRefreshCooldownMs = unknownKidRefreshCooldownMsValue;
    this.#now = (stableOptions.now as (() => number) | undefined) ?? Date.now;
  }

  #time(): number {
    const now = this.#now();
    if (!Number.isSafeInteger(now) || now < 0) {
      throw new Error("JWKS cache clock must return a non-negative safe integer");
    }
    return now;
  }

  async #refresh(): Promise<LocalJwkSet> {
    if (this.#inFlight !== undefined) return this.#inFlight;
    if (this.#time() < this.#refreshBackoffUntil) {
      throw new Error("JWKS refresh is temporarily unavailable");
    }

    // Defer provider invocation until after #inFlight is published so even a
    // synchronously rejected provider is covered by the single-flight guard.
    const refresh = Promise.resolve()
      .then(() => this.#load())
      .then((jwks) => {
        const stableJwks = snapshotVerifiedJwtJsonV1(
          jwks as unknown as Readonly<Record<string, unknown>>,
        ) as unknown as JSONWebKeySet;
        assertJwks(stableJwks);
        const local = createLocalJWKSet(stableJwks);
        const loadedAt = this.#time();
        this.#local = local;
        this.#loadedAt = loadedAt;
        this.#consecutiveRefreshFailures = 0;
        this.#refreshBackoffUntil = Number.NEGATIVE_INFINITY;
        return local;
      })
      .catch((error: unknown) => {
        const failedAt = this.#time();
        this.#consecutiveRefreshFailures = Math.min(
          this.#consecutiveRefreshFailures + 1,
          31,
        );
        const delayMs = Math.min(
          JWKS_REFRESH_FAILURE_BASE_DELAY_MS *
            2 ** (this.#consecutiveRefreshFailures - 1),
          MAX_JWKS_REFRESH_FAILURE_BACKOFF_MS,
        );
        this.#refreshBackoffUntil = failedAt + delayMs;
        throw error;
      });
    this.#inFlight = refresh;
    try {
      return await refresh;
    } finally {
      if (this.#inFlight === refresh) this.#inFlight = undefined;
    }
  }

  async #current(): Promise<LocalJwkSet> {
    const age = this.#time() - this.#loadedAt;
    if (
      this.#local === undefined ||
      age < 0 ||
      age >= this.#maxAgeMs
    ) {
      return this.#refresh();
    }
    return this.#local;
  }

  public readonly getKey: LocalJwkSet = async (protectedHeader, token) => {
    const current = await this.#current();
    try {
      return await current(protectedHeader, token);
    } catch (error: unknown) {
      if (!(error instanceof errors.JWKSNoMatchingKey)) throw error;
      const now = this.#time();
      if (
        now - this.#lastUnknownKidRefreshAt <
        this.#unknownKidRefreshCooldownMs
      ) {
        throw error;
      }
      this.#lastUnknownKidRefreshAt = now;
      const refreshed = await this.#refresh();
      return refreshed(protectedHeader, token);
    }
  };
}

export interface RemoteJwksProviderOptions {
  readonly url: string | URL;
  readonly timeoutMs?: number;
  readonly fetchImpl?: typeof fetch;
}

const MAX_JWKS_RESPONSE_BYTES = 1_048_576;

async function readBoundedJwksResponse(response: Response): Promise<unknown> {
  const declaredLength = response.headers.get("content-length");
  if (
    declaredLength !== null &&
    /^\d+$/.test(declaredLength) &&
    Number(declaredLength) > MAX_JWKS_RESPONSE_BYTES
  ) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error("JWKS response exceeds the maximum size");
  }
  if (response.body === null) throw new Error("JWKS response body is missing");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > MAX_JWKS_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("JWKS response exceeds the maximum size");
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch (error) {
    throw new Error("JWKS response is not valid UTF-8 JSON", { cause: error });
  }
}

export class RemoteJwksProvider implements JwksProvider {
  readonly #url: URL;
  readonly #timeoutMs: number;
  readonly #fetch: typeof fetch;

  public constructor(options: RemoteJwksProviderOptions) {
    const stableOptions = snapshotOptionsV1(
      options,
      new Set(["fetchImpl", "timeoutMs", "url"]),
      "remote JWKS provider options",
    );
    if (
      (typeof stableOptions.url !== "string" &&
        !(stableOptions.url instanceof URL)) ||
      (stableOptions.fetchImpl !== undefined &&
        typeof stableOptions.fetchImpl !== "function")
    ) {
      throw new Error("remote JWKS provider options are invalid");
    }
    this.#url = new URL(stableOptions.url);
    const isLoopback = ["localhost", "127.0.0.1", "[::1]"].includes(
      this.#url.hostname,
    );
    if (
      (this.#url.protocol !== "https:" &&
        !(this.#url.protocol === "http:" && isLoopback)) ||
      this.#url.username.length > 0 ||
      this.#url.password.length > 0 ||
      this.#url.search.length > 0 ||
      this.#url.hash.length > 0 ||
      this.#url.href.length > 2_048
    ) {
      throw new Error(
        "JWKS URL must use HTTPS except for loopback and cannot contain credentials, a query, or a fragment",
      );
    }
    this.#timeoutMs = (stableOptions.timeoutMs as number | undefined) ?? 3_000;
    if (
      !Number.isSafeInteger(this.#timeoutMs) ||
      this.#timeoutMs < 1 ||
      this.#timeoutMs > MAX_JWKS_TIMEOUT_MS
    ) {
      throw new Error("JWKS timeoutMs must be an integer from 1 to 30000");
    }
    this.#fetch = (stableOptions.fetchImpl as typeof fetch | undefined) ?? fetch;
  }

  public async load(): Promise<JSONWebKeySet> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#timeoutMs);
    timer.unref();
    try {
      const response = await this.#fetch(this.#url, {
        headers: { accept: "application/json" },
        redirect: "error",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("JWKS endpoint returned a non-success status");
      const value = await readBoundedJwksResponse(response);
      const stableJwks = snapshotVerifiedJwtJsonV1(
        value as Readonly<Record<string, unknown>>,
      ) as unknown as JSONWebKeySet;
      assertJwks(stableJwks);
      return stableJwks;
    } finally {
      clearTimeout(timer);
    }
  }
}
