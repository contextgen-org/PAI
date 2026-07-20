import {
  ResponseEnvelopeV1Schema,
  type ResponseEnvelopeV1,
} from "@pai/contracts";
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
  readonly fetchImpl?: typeof fetch;
  readonly sleep?: (milliseconds: number) => Promise<void>;
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

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function validatePolicy(options: InternalJsonRequestOptions): number {
  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1) {
    throw new Error("timeoutMs must be a positive integer");
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
    Object.keys(options.headers).some((name) => name.toLowerCase() === "authorization")
  ) {
    throw new Error("authorization headers must be supplied as workloadCredential");
  }
  const pathname = new URL(options.url).pathname;
  if (pathname.startsWith("/internal/")) {
    if (
      options.workloadCredential === undefined ||
      !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(
        options.workloadCredential,
      )
    ) {
      throw new Error("a compact workloadCredential is required for internal requests");
    }
  } else if (options.workloadCredential !== undefined) {
    throw new Error("workloadCredential may only be sent to /internal/** routes");
  }
  return maxRetries;
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
): Promise<InternalJsonResponse<T>> {
  const maxRetries = validatePolicy(options);
  const traceId = options.traceId ?? createTraceId();
  assertSafeTraceId(traceId);
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const retryDelayMs = options.retryDelayMs ?? 50;
  if (!Number.isInteger(retryDelayMs) || retryDelayMs < 0 || retryDelayMs > 10_000) {
    throw new Error("retryDelayMs must be an integer between 0 and 10000");
  }

  for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);
    timer.unref();
    let clientError: InternalClientError;

    try {
      const headers: Record<string, string> = {
        accept: "application/json",
        ...options.headers,
        "x-trace-id": traceId,
      };
      propagation.inject(context.active(), headers);
      if (headers.traceparent === undefined) {
        const traceparent = toTraceparent(traceId);
        if (traceparent !== undefined) headers.traceparent = traceparent;
      }
      if (options.json !== undefined) headers["content-type"] = "application/json";
      if (options.workloadCredential !== undefined) {
        headers.authorization = `Bearer ${options.workloadCredential}`;
      }

      const requestInit: RequestInit = {
        method: options.method ?? "GET",
        headers,
        signal: controller.signal,
      };
      if (options.json !== undefined) {
        requestInit.body = JSON.stringify(options.json);
      }
      const response = await fetchImpl(options.url, requestInit);
      const body = await parseJson(response);
      if (response.ok) {
        return {
          status: response.status,
          body: body as T,
          traceId,
          attempts: attempt,
        };
      }

      clientError = isResponseEnvelope(body)
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
    } catch (error: unknown) {
      clientError = new InternalClientError({
        code: controller.signal.aborted
          ? "upstream_timeout"
          : "upstream_unavailable",
        message: controller.signal.aborted
          ? "upstream request timed out"
          : "upstream request failed",
        retryable: true,
        traceId,
        cause: error,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!shouldRetry(clientError, attempt, maxRetries)) throw clientError;
    await sleep(retryDelayMs * attempt);
  }

  throw new Error("unreachable retry state");
}

export async function requestInternalJson<T>(
  options: InternalJsonRequestOptions,
): Promise<InternalJsonResponse<T>> {
  const activeContext = context.active();
  const activeSpanContext = trace.getSpanContext(activeContext);
  const activeTraceId =
    activeSpanContext !== undefined && isSpanContextValid(activeSpanContext)
      ? activeSpanContext.traceId
      : undefined;
  if (
    options.traceId !== undefined &&
    activeTraceId !== undefined &&
    options.traceId !== activeTraceId
  ) {
    throw new Error("traceId must match the active OpenTelemetry trace");
  }
  const traceId = options.traceId ?? activeTraceId ?? createTraceId();
  assertSafeTraceId(traceId);
  const parentContext =
    activeTraceId === undefined ? contextForTraceId(traceId) : activeContext;
  return internalClientTracer.startActiveSpan(
    "pai.internal.request",
    {
      kind: SpanKind.CLIENT,
      attributes: { "http.request.method": options.method ?? "GET" },
    },
    parentContext,
    async (span) => {
      try {
        const response = await executeInternalJsonRequest<T>({
          ...options,
          traceId,
        });
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
