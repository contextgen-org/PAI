import {
  ResponseEnvelopeV1Schema,
  assertCanonicalJsonBoundaryV1,
  canonicalJsonV1,
  type ResponseEnvelopeV1,
} from "@pai/contracts";
import { isProxy } from "node:util/types";
import {
  context,
  isSpanContextValid,
  propagation,
  SpanKind,
  SpanStatusCode,
  trace,
} from "@opentelemetry/api";
import { TypeCompiler } from "@sinclair/typebox/compiler";

import {
  assertSafeTraceId,
  contextForTraceId,
  createTraceId,
  toTraceparent,
} from "./trace.js";

const DEFAULT_MAX_RETRIES = 2;
const MAX_RETRIES = 5;
const DEFAULT_MAX_RESPONSE_BYTES = 1_048_576;
const MAX_RESPONSE_BYTES = 16 * 1_048_576;
const LOCAL_DOCKER_INTERNAL_ORIGINS_V1 = new Set([
  "action-runtime:3002",
  "skill-registry:3007",
  "memory:3004",
  "knowthat:3005",
  "trigger-processor:3001",
  "timer-trigger-app:3006",
  "meta-cognition:3003",
  "observation-gateway:3008",
  "storage-edge-runtime:8080",
  "jwks:8080",
]);
const MANAGED_REQUEST_HEADERS = new Set([
  "accept",
  "authorization",
  "baggage",
  "connection",
  "content-type",
  "content-length",
  "cookie",
  "cf-connecting-ip",
  "forwarded",
  "host",
  "keep-alive",
  "proxy-authorization",
  "proxy-connection",
  "set-cookie",
  "te",
  "trailer",
  "traceparent",
  "tracestate",
  "transfer-encoding",
  "true-client-ip",
  "upgrade",
  "via",
  "x-api-key",
  "x-auth-token",
  "x-http-method",
  "x-http-method-override",
  "x-method-override",
  "x-rewrite-url",
  "x-forwarded-for",
  "x-forwarded-client-cert",
  "x-forwarded-host",
  "x-forwarded-port",
  "x-forwarded-proto",
  "x-original-forwarded-for",
  "x-real-ip",
  "x-envoy-external-address",
  "x-trace-id",
  "apikey",
]);

/**
 * The production transport remains HTTPS-only.  Local Compose has no TLS
 * sidecar, so it may opt into a closed list of Docker-internal origins.  The
 * deployment environment check makes this impossible in staging and prod.
 */
export function isTrustedLocalDockerHttpOriginV1(
  url: URL,
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return (
    env.PAI_DEPLOYMENT_ENVIRONMENT === "local" &&
    env.PAI_LOCAL_DOCKER_TRANSPORT === "true" &&
    url.protocol === "http:" &&
    LOCAL_DOCKER_INTERNAL_ORIGINS_V1.has(`${url.hostname}:${url.port}`)
  );
}
const MANAGED_REQUEST_HEADER_PREFIXES = [
  "cf-",
  "proxy-",
  "x-envoy-",
  "x-forwarded-",
  "x-original-",
] as const;
const internalClientTracer = trace.getTracer("@pai/service-kit", "0.1.0");
const responseEnvelopeValidator = TypeCompiler.Compile(ResponseEnvelopeV1Schema);

export interface InternalJsonRequestOptions {
  readonly url: string;
  readonly method?: string;
  readonly headers?: Readonly<Record<string, string>>;
  /** A short-lived pai-workload JWT. Required for every /internal/** request. */
  readonly workloadCredential?: string;
  readonly json?: unknown;
  readonly traceId?: string;
  readonly timeoutMs: number;
  readonly idempotent?: boolean;
  readonly maxRetries?: number;
  readonly retryDelayMs?: number;
  /** Bounds the decoded JSON response before it is buffered in memory. */
  readonly maxResponseBytes?: number;
  readonly fetchImpl?: typeof fetch;
  readonly sleep?: (milliseconds: number) => Promise<void>;
  /** Cancels the active request and any retry delay. */
  readonly signal?: AbortSignal;
}

export interface InternalJsonResponse<T> {
  readonly status: number;
  readonly body: T;
  readonly traceId: string;
  readonly attempts: number;
}

export interface InternalClientErrorOptions {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
  readonly traceId: string;
  readonly status?: number;
  readonly details?: unknown;
  readonly cause?: unknown;
}

const internalRequestOptionKeys = [
  "fetchImpl",
  "headers",
  "idempotent",
  "json",
  "maxResponseBytes",
  "maxRetries",
  "method",
  "retryDelayMs",
  "sleep",
  "signal",
  "timeoutMs",
  "traceId",
  "url",
  "workloadCredential",
] as const;

function ownEnumerableDataValues(
  value: unknown,
  message: string,
): Readonly<Record<string, unknown>> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    isProxy(value)
  ) {
    throw new Error(message);
  }
  let prototype: object | null;
  let descriptors: PropertyDescriptorMap;
  try {
    prototype = Object.getPrototypeOf(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    throw new Error(message);
  }
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(message);
  }
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some((key) => typeof key !== "string")) throw new Error(message);
  const snapshot = Object.create(null) as Record<string, unknown>;
  for (const key of keys as string[]) {
    const descriptor = descriptors[key];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      throw new Error(message);
    }
    snapshot[key] = descriptor.value;
  }
  return Object.freeze(snapshot);
}

function snapshotHeaders(
  value: unknown,
): Readonly<Record<string, string>> | undefined {
  if (value === undefined) return undefined;
  const data = ownEnumerableDataValues(
    value,
    "headers must contain only own string data properties",
  );
  if (Object.values(data).some((headerValue) => typeof headerValue !== "string")) {
    throw new Error("headers must contain only own string data properties");
  }
  return data as Readonly<Record<string, string>>;
}

function snapshotInternalRequestOptions(
  value: unknown,
): InternalJsonRequestOptions {
  const data = ownEnumerableDataValues(
    value,
    "internal request options must contain only own data properties",
  );
  if (
    Object.keys(data).some(
      (key) =>
        !internalRequestOptionKeys.includes(
          key as (typeof internalRequestOptionKeys)[number],
        ),
    ) ||
    !Object.hasOwn(data, "url") ||
    !Object.hasOwn(data, "timeoutMs") ||
    typeof data.url !== "string" ||
    typeof data.timeoutMs !== "number" ||
    (data.method !== undefined && typeof data.method !== "string") ||
    (data.workloadCredential !== undefined &&
      typeof data.workloadCredential !== "string") ||
    (data.traceId !== undefined && typeof data.traceId !== "string") ||
    (data.idempotent !== undefined && typeof data.idempotent !== "boolean") ||
    (data.maxRetries !== undefined && typeof data.maxRetries !== "number") ||
    (data.retryDelayMs !== undefined && typeof data.retryDelayMs !== "number") ||
    (data.maxResponseBytes !== undefined &&
      typeof data.maxResponseBytes !== "number") ||
    (data.fetchImpl !== undefined && typeof data.fetchImpl !== "function") ||
    (data.sleep !== undefined && typeof data.sleep !== "function") ||
    (data.signal !== undefined && !(data.signal instanceof AbortSignal))
  ) {
    throw new Error("invalid internal request options");
  }
  const headers = snapshotHeaders(data.headers);
  return Object.freeze({
    ...data,
    ...(headers === undefined ? {} : { headers }),
  }) as unknown as InternalJsonRequestOptions;
}

export class InternalClientError extends Error {
  public readonly code: string;
  public readonly retryable: boolean;
  public readonly traceId: string;
  public readonly status: number | undefined;
  public readonly details: unknown;

  public constructor(options: InternalClientErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = "InternalClientError";
    this.code = options.code;
    this.retryable = options.retryable;
    this.traceId = options.traceId;
    this.status = options.status;
    this.details = options.details ?? {};
  }
}

function isResponseEnvelope(value: unknown): value is ResponseEnvelopeV1 {
  return responseEnvelopeValidator.Check(value);
}

class InvalidUpstreamResponseError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "InvalidUpstreamResponseError";
  }
}

async function parseJson(
  response: Response,
  maxResponseBytes: number,
): Promise<unknown> {
  const declaredLength = response.headers.get("content-length");
  if (
    declaredLength !== null &&
    (!/^\d+$/.test(declaredLength) || Number(declaredLength) > maxResponseBytes)
  ) {
    await response.body?.cancel().catch(() => undefined);
    throw new InvalidUpstreamResponseError(
      "upstream JSON response exceeds the configured size limit",
    );
  }
  if (response.body === null) return undefined;

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > maxResponseBytes) {
        await reader.cancel();
        throw new InvalidUpstreamResponseError(
          "upstream JSON response exceeds the configured size limit",
        );
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  if (size === 0) return undefined;

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let parsed: unknown;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    parsed = JSON.parse(text) as unknown;
  } catch (error) {
    throw new InvalidUpstreamResponseError(
      error instanceof TypeError
        ? "upstream response is not valid UTF-8"
      : "upstream response is not valid JSON",
    );
  }
  try {
    assertCanonicalJsonBoundaryV1(parsed, {
      max_bytes: maxResponseBytes,
      max_depth: 128,
      max_nodes: 1_000_000,
      max_container_entries: 100_000,
    });
  } catch (error) {
    throw new InvalidUpstreamResponseError(
      "upstream response is outside the bounded canonical JSON contract",
      { cause: error },
    );
  }
  return parsed;
}

type WorkloadRoutePolicyV1 = "internal_only" | "versioned_api_only";

function validatePolicy(
  options: InternalJsonRequestOptions,
  routePolicy: WorkloadRoutePolicyV1,
): Readonly<{ maxRetries: number; maxResponseBytes: number; url: URL }> {
  if (
    !Number.isInteger(options.timeoutMs) ||
    options.timeoutMs < 1 ||
    options.timeoutMs > 300_000
  ) {
    throw new Error("timeoutMs must be an integer between 1 and 300000");
  }
  const maxRetries = options.idempotent
    ? (options.maxRetries ?? DEFAULT_MAX_RETRIES)
    : 0;
  if (!Number.isInteger(maxRetries) || maxRetries < 0 || maxRetries > MAX_RETRIES) {
    throw new Error(`maxRetries must be an integer between 0 and ${MAX_RETRIES}`);
  }
  if (options.idempotent !== true && (options.maxRetries ?? 0) !== 0) {
    throw new Error("non-idempotent requests cannot enable retries");
  }
  if (
    options.headers !== undefined &&
    Object.keys(options.headers).some((name) => {
      const normalized = name.toLowerCase();
      return (
        MANAGED_REQUEST_HEADERS.has(normalized) ||
        MANAGED_REQUEST_HEADER_PREFIXES.some((prefix) =>
          normalized.startsWith(prefix),
        )
      );
    })
  ) {
    throw new Error(
      "credential or protocol-owned headers cannot be supplied through generic headers",
    );
  }
  const url = new URL(options.url);
  const isLoopback = ["localhost", "127.0.0.1", "[::1]"].includes(
    url.hostname,
  );
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    (url.protocol === "http:" &&
      !isLoopback &&
      !isTrustedLocalDockerHttpOriginV1(url)) ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.hash.length > 0
  ) {
    throw new Error(
      "internal request URL must use HTTPS except for loopback or explicitly configured local Docker services and cannot contain userinfo or a fragment",
    );
  }
  const pathname = url.pathname;
  const isInternalRoute =
    pathname === "/internal" || pathname.startsWith("/internal/");
  const isVersionedApiRoute = pathname.startsWith("/v1/");
  if (routePolicy === "internal_only" && isInternalRoute) {
    if (
      options.workloadCredential === undefined ||
      !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(
        options.workloadCredential,
      )
    ) {
      throw new Error("a compact workloadCredential is required for internal requests");
    }
  } else if (
    routePolicy === "internal_only" &&
    options.workloadCredential !== undefined
  ) {
    throw new Error("workloadCredential may only be sent to /internal/** routes");
  } else if (routePolicy === "versioned_api_only") {
    if (!isVersionedApiRoute) {
      throw new Error("workload API credentials may only be sent to /v1/** routes");
    }
    if (
      options.workloadCredential === undefined ||
      !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(
        options.workloadCredential,
      )
    ) {
      throw new Error(
        "a compact workloadCredential is required for workload API requests",
      );
    }
  }
  const maxResponseBytes =
    options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  if (
    !Number.isSafeInteger(maxResponseBytes) ||
    maxResponseBytes < 1 ||
    maxResponseBytes > MAX_RESPONSE_BYTES
  ) {
    throw new Error(
      `maxResponseBytes must be an integer between 1 and ${MAX_RESPONSE_BYTES}`,
    );
  }
  return { maxRetries, maxResponseBytes, url };
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, milliseconds);
    timer.unref();
  });
}

function shouldRetry(
  error: InternalClientError,
  attempt: number,
  maxRetries: number,
): boolean {
  return error.retryable && attempt <= maxRetries;
}

async function executeInternalJsonRequest<T>(
  options: InternalJsonRequestOptions,
  routePolicy: WorkloadRoutePolicyV1,
): Promise<InternalJsonResponse<T>> {
  const policy = validatePolicy(options, routePolicy);
  const { maxRetries, maxResponseBytes } = policy;
  const traceId = options.traceId ?? createTraceId();
  assertSafeTraceId(traceId);
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const retryDelayMs = options.retryDelayMs ?? 50;
  if (!Number.isInteger(retryDelayMs) || retryDelayMs < 0 || retryDelayMs > 10_000) {
    throw new Error("retryDelayMs must be an integer between 0 and 10000");
  }
  const method = options.method ?? "GET";
  const timeoutMs = options.timeoutMs;
  const workloadCredential = options.workloadCredential;
  const hasJsonBody = options.json !== undefined;
  const requestBody = hasJsonBody
    ? canonicalJsonV1(options.json)
    : undefined;
  if (hasJsonBody && requestBody === undefined) {
    throw new Error("json must serialize to a request body");
  }
  const additionalHeaders = options.headers ?? {};

  const throwIfExternallyAborted = (): void => {
    if (options.signal?.aborted !== true) return;
    throw new InternalClientError({
      code: "upstream_aborted",
      message: "internal request was aborted by its caller",
      retryable: false,
      traceId,
      cause: options.signal.reason,
    });
  };

  const waitForRetry = async (milliseconds: number): Promise<void> => {
    throwIfExternallyAborted();
    const externalSignal = options.signal;
    if (externalSignal === undefined) {
      await sleep(milliseconds);
      return;
    }
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (error?: unknown): void => {
        if (settled) return;
        settled = true;
        externalSignal.removeEventListener("abort", onAbort);
        if (error === undefined) resolve();
        else reject(error);
      };
      const onAbort = (): void =>
        finish(
          new InternalClientError({
            code: "upstream_aborted",
            message: "internal request was aborted by its caller",
            retryable: false,
            traceId,
            cause: externalSignal.reason,
          }),
        );
      externalSignal.addEventListener("abort", onAbort, { once: true });
      sleep(milliseconds).then(() => finish(), finish);
      if (externalSignal.aborted) onAbort();
    });
  };

  for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
    throwIfExternallyAborted();
    const controller = new AbortController();
    let timedOut = false;
    const onExternalAbort = (): void =>
      controller.abort(options.signal?.reason);
    options.signal?.addEventListener("abort", onExternalAbort, {
      once: true,
    });
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort(new Error("internal_request_timeout"));
    }, timeoutMs);
    timer.unref();
    let clientError: InternalClientError;

    try {
      const headers: Record<string, string> = {
        accept: "application/json",
        ...additionalHeaders,
        "x-trace-id": traceId,
      };
      propagation.inject(context.active(), headers);
      if (headers.traceparent === undefined) {
        const traceparent = toTraceparent(traceId);
        if (traceparent !== undefined) headers.traceparent = traceparent;
      }
      if (hasJsonBody) headers["content-type"] = "application/json";
      if (workloadCredential !== undefined) {
        headers.authorization = `Bearer ${workloadCredential}`;
      }

      const requestInit: RequestInit = {
        method,
        headers,
        redirect: "manual",
        signal: controller.signal,
      };
      if (requestBody !== undefined) {
        requestInit.body = requestBody;
      }
      const response = await fetchImpl(policy.url, requestInit);
      if (response.status >= 300 && response.status < 400) {
        await response.body?.cancel().catch(() => undefined);
        clientError = new InternalClientError({
          code: "redirect_rejected",
          message: "internal requests must not follow redirects",
          retryable: false,
          traceId,
          status: response.status,
        });
      } else {
        const body = await parseJson(response, maxResponseBytes);
        if (response.ok) {
          if (body === undefined && response.status !== 204) {
            throw new InvalidUpstreamResponseError(
              "successful upstream response is missing its JSON body",
            );
          }
          return {
            status: response.status,
            body: body as T,
            traceId,
            attempts: attempt,
          };
        }

        clientError = isResponseEnvelope(body) && body.trace_id === traceId
          ? new InternalClientError({
              code: body.code,
              message: body.message,
              retryable: body.retryable,
              traceId: body.trace_id,
              status: response.status,
              details: body.details,
            })
          : new InternalClientError({
              code: "invalid_upstream_error",
              message: "upstream returned a non-conforming error response",
              retryable: false,
              traceId,
              status: response.status,
            });
      }
    } catch (error: unknown) {
      clientError =
        error instanceof InvalidUpstreamResponseError
          ? new InternalClientError({
              code: "invalid_upstream_response",
              message: error.message,
              retryable: false,
              traceId,
              cause: error,
            })
          : new InternalClientError({
              code:
                options.signal?.aborted === true
                  ? "upstream_aborted"
                  : timedOut
                    ? "upstream_timeout"
                    : "upstream_unavailable",
              message:
                options.signal?.aborted === true
                  ? "internal request was aborted by its caller"
                  : timedOut
                    ? "upstream request timed out"
                    : "upstream request failed",
              retryable: options.signal?.aborted !== true,
              traceId,
              cause: error,
            });
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onExternalAbort);
    }

    if (!shouldRetry(clientError, attempt, maxRetries)) throw clientError;
    await waitForRetry(retryDelayMs * attempt);
  }

  throw new Error("unreachable retry state");
}

async function requestJsonWithPolicyV1<T>(
  options: InternalJsonRequestOptions,
  routePolicy: WorkloadRoutePolicyV1,
  spanName: string,
): Promise<InternalJsonResponse<T>> {
  // The exported boundary snapshots every caller-owned option before tracing
  // or policy code reads it. Accessors are rejected without being invoked, and
  // retries cannot change identity, headers, method, payload, or callbacks.
  const requestOptions = snapshotInternalRequestOptions(options);
  const activeContext = context.active();
  const activeSpanContext = trace.getSpanContext(activeContext);
  const activeTraceId =
    activeSpanContext !== undefined && isSpanContextValid(activeSpanContext)
      ? activeSpanContext.traceId
      : undefined;
  if (
    requestOptions.traceId !== undefined &&
    activeTraceId !== undefined &&
    requestOptions.traceId !== activeTraceId
  ) {
    throw new Error("traceId must match the active OpenTelemetry trace");
  }
  const traceId = requestOptions.traceId ?? activeTraceId ?? createTraceId();
  assertSafeTraceId(traceId);
  const parentContext =
    activeTraceId === undefined ? contextForTraceId(traceId) : activeContext;
  return internalClientTracer.startActiveSpan(
    spanName,
    {
      kind: SpanKind.CLIENT,
      attributes: { "http.request.method": requestOptions.method ?? "GET" },
    },
    parentContext,
    async (span) => {
      try {
        const response = await executeInternalJsonRequest<T>(
          Object.freeze({
            ...requestOptions,
            traceId,
          }),
          routePolicy,
        );
        span.setAttribute("http.response.status_code", response.status);
        return response;
      } catch (error: unknown) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message:
            error instanceof InternalClientError
              ? error.code
              : "internal_client_error",
        });
        throw error;
      } finally {
        span.end();
      }
    },
  );
}

export async function requestInternalJson<T>(
  options: InternalJsonRequestOptions,
): Promise<InternalJsonResponse<T>> {
  return requestJsonWithPolicyV1<T>(
    options,
    "internal_only",
    "pai.internal.request",
  );
}

/**
 * Calls an authenticated mixed-ingress `/v1/**` route with a short-lived
 * workload JWT. Keeping this boundary separate from `requestInternalJson`
 * prevents credentials from being silently moved between route classes.
 */
export async function requestWorkloadJson<T>(
  options: InternalJsonRequestOptions,
): Promise<InternalJsonResponse<T>> {
  return requestJsonWithPolicyV1<T>(
    options,
    "versioned_api_only",
    "pai.workload_api.request",
  );
}
