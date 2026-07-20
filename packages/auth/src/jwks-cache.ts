import {
  createLocalJWKSet,
  errors,
  type JSONWebKeySet,
} from "jose";

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

function assertJwks(value: unknown): asserts value is JSONWebKeySet {
  if (
    typeof value !== "object" ||
    value === null ||
    !("keys" in value) ||
    !Array.isArray(value.keys) ||
    value.keys.length === 0
  ) {
    throw new Error("JWKS response must contain at least one key");
  }
}

/** Bounded JWKS cache. An unknown kid forces one refresh for smooth rotation. */
export class JwksCache {
  readonly #provider: JwksProvider;
  readonly #maxAgeMs: number;
  readonly #unknownKidRefreshCooldownMs: number;
  readonly #now: () => number;
  #loadedAt = Number.NEGATIVE_INFINITY;
  #lastUnknownKidRefreshAt = Number.NEGATIVE_INFINITY;
  #local: LocalJwkSet | undefined;
  #inFlight: Promise<LocalJwkSet> | undefined;

  public constructor(options: JwksCacheOptions) {
    if (!Number.isInteger(options.maxAgeMs ?? 60_000) || (options.maxAgeMs ?? 60_000) < 1) {
      throw new Error("JWKS maxAgeMs must be a positive integer");
    }
    this.#provider = options.provider;
    this.#maxAgeMs = options.maxAgeMs ?? 60_000;
    this.#unknownKidRefreshCooldownMs =
      options.unknownKidRefreshCooldownMs ?? 5_000;
    if (
      !Number.isInteger(this.#unknownKidRefreshCooldownMs) ||
      this.#unknownKidRefreshCooldownMs < 1
    ) {
      throw new Error(
        "JWKS unknownKidRefreshCooldownMs must be a positive integer",
      );
    }
    this.#now = options.now ?? Date.now;
  }

  async #refresh(): Promise<LocalJwkSet> {
    if (this.#inFlight !== undefined) return this.#inFlight;
    this.#inFlight = this.#provider.load().then((jwks) => {
      assertJwks(jwks);
      const local = createLocalJWKSet(jwks);
      this.#local = local;
      this.#loadedAt = this.#now();
      return local;
    });
    try {
      return await this.#inFlight;
    } finally {
      this.#inFlight = undefined;
    }
  }

  async #current(): Promise<LocalJwkSet> {
    if (
      this.#local === undefined ||
      this.#now() - this.#loadedAt >= this.#maxAgeMs
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
      if (
        this.#now() - this.#lastUnknownKidRefreshAt <
        this.#unknownKidRefreshCooldownMs
      ) {
        throw error;
      }
      this.#lastUnknownKidRefreshAt = this.#now();
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

export class RemoteJwksProvider implements JwksProvider {
  readonly #url: URL;
  readonly #timeoutMs: number;
  readonly #fetch: typeof fetch;

  public constructor(options: RemoteJwksProviderOptions) {
    this.#url = new URL(options.url);
    const isLoopback = ["localhost", "127.0.0.1", "::1"].includes(
      this.#url.hostname,
    );
    if (this.#url.protocol !== "https:" && !(this.#url.protocol === "http:" && isLoopback)) {
      throw new Error("JWKS URL must use HTTPS except for loopback development");
    }
    this.#timeoutMs = options.timeoutMs ?? 3_000;
    if (!Number.isInteger(this.#timeoutMs) || this.#timeoutMs < 1) {
      throw new Error("JWKS timeoutMs must be a positive integer");
    }
    this.#fetch = options.fetchImpl ?? fetch;
  }

  public async load(): Promise<JSONWebKeySet> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#timeoutMs);
    timer.unref();
    try {
      const response = await this.#fetch(this.#url, {
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("JWKS endpoint returned a non-success status");
      const value: unknown = await response.json();
      assertJwks(value);
      return value;
    } finally {
      clearTimeout(timer);
    }
  }
}
