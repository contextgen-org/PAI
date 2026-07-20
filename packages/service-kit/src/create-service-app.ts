import {
  ServiceIdV1Schema,
  type ResponseEnvelopeV1,
  type ServiceIdV1,
} from "@pai/contracts";
import {
  context,
  SpanKind,
  SpanStatusCode,
  trace,
  type Span,
} from "@opentelemetry/api";
import Fastify, {
  LogController,
  type FastifyBaseLogger,
  type FastifyInstance,
  type FastifyLogFn,
  type FastifyLoggerOptions,
} from "fastify";

import type { ServiceRuntimeConfigV1 } from "./config.js";
import {
  PINO_REDACTION_PATHS,
  REDACTED_VALUE,
  redactSensitiveValue,
} from "./redaction.js";
import { ServiceError } from "./service-error.js";
import {
  contextForTraceId,
  extractInboundTraceId,
  extractTelemetryContext,
} from "./trace.js";
import {
  installWorkloadAuth,
  type WorkloadAuthOptions,
} from "./workload-auth.js";

export interface ReadinessCheck {
  readonly name: string;
  readonly check: (signal: AbortSignal) => Promise<void>;
}

export interface ServiceAppOptions {
  readonly logger?: boolean;
  readonly loggerStream?: ServiceLoggerStreamDestination;
  readonly runtimeConfig?: ServiceRuntimeConfigV1;
  readonly readinessChecks?: readonly ReadinessCheck[];
  readonly auth?: WorkloadAuthOptions;
}

export interface ServiceLoggerStreamDestination {
  write(message: string): void;
}

interface ServiceLifecycleState {
  acceptingTraffic: boolean;
}

interface ReadinessResult {
  readonly name: string;
  readonly status: "up" | "down";
  readonly latency_ms: number;
}

const lifecycleStates = new WeakMap<FastifyInstance, ServiceLifecycleState>();
const securedLoggers = new WeakSet<object>();
const serviceTracer = trace.getTracer("@pai/service-kit", "0.1.0");

function secureChildLoggerBindings(logger: FastifyBaseLogger): void {
  if (securedLoggers.has(logger)) return;
  securedLoggers.add(logger);
  const originalChild = logger.child.bind(logger);
  Object.defineProperty(logger, "child", {
    configurable: true,
    value: (
      bindings: Parameters<typeof logger.child>[0],
      options?: Parameters<typeof logger.child>[1],
    ) => {
      const child = originalChild(
        redactSensitiveValue(bindings) as Parameters<typeof logger.child>[0],
        options,
      );
      secureChildLoggerBindings(child);
      return child;
    },
    writable: true,
  });
}

type SecureLoggerOptions = FastifyLoggerOptions & {
  readonly redact: { readonly paths: string[]; readonly censor: string };
  readonly formatters: {
    readonly bindings: (
      bindings: Record<string, unknown>,
    ) => Record<string, unknown>;
  };
  readonly hooks: {
    readonly logMethod: (
      this: FastifyBaseLogger,
      args: Parameters<FastifyLogFn>,
      method: FastifyLogFn,
      level: number,
    ) => void;
  };
};

function secureLoggerOptions(
  config: ServiceRuntimeConfigV1 | undefined,
  stream: ServiceLoggerStreamDestination | undefined,
): SecureLoggerOptions {
  return {
    level: config?.log_level ?? "info",
    redact: {
      paths: [...PINO_REDACTION_PATHS],
      censor: REDACTED_VALUE,
    },
    formatters: {
      bindings(bindings) {
        return redactSensitiveValue(bindings) as Record<string, unknown>;
      },
    },
    hooks: {
      logMethod(args, method) {
        const redactedArgs = args.map((argument) =>
          redactSensitiveValue(argument),
        ) as Parameters<typeof method>;
        method.apply(this, redactedArgs);
      },
    },
    ...(stream === undefined ? {} : { stream }),
  };
}

function defaultLogger(
  config: ServiceRuntimeConfigV1 | undefined,
  stream: ServiceLoggerStreamDestination | undefined,
): boolean | SecureLoggerOptions {
  if (process.env.NODE_ENV === "test") return false;
  return secureLoggerOptions(config, stream);
}

function validationDetails(error: unknown): unknown | undefined {
  if (
    typeof error !== "object" ||
    error === null ||
    !("validation" in error) ||
    !Array.isArray(error.validation)
  ) {
    return undefined;
  }

  const issues = error.validation as readonly {
    readonly instancePath?: string;
    readonly message?: string;
    readonly keyword?: string;
    readonly schemaPath?: string;
  }[];
  return {
    schema_version: "1.0.0",
    field_errors: issues.map((issue) => ({
      path: issue.instancePath || "/",
      message: issue.message ?? "request value was rejected",
      expected: issue.schemaPath ?? issue.keyword ?? "declared request schema",
      actual: "rejected_value",
    })),
  };
}

async function runReadinessCheck(
  readinessCheck: ReadinessCheck,
  timeoutMs: number,
): Promise<ReadinessResult> {
  const startedAt = performance.now();
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;

  try {
    await Promise.race([
      readinessCheck.check(controller.signal),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("readiness check timed out"));
        }, timeoutMs);
        timer.unref();
      }),
    ]);
    return {
      name: readinessCheck.name,
      status: "up",
      latency_ms: Math.round(performance.now() - startedAt),
    };
  } catch {
    return {
      name: readinessCheck.name,
      status: "down",
      latency_ms: Math.round(performance.now() - startedAt),
    };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export function beginServiceShutdown(app: FastifyInstance): void {
  const lifecycle = lifecycleStates.get(app);
  if (lifecycle !== undefined) lifecycle.acceptingTraffic = false;
}

export function createServiceApp(
  serviceId: ServiceIdV1,
  options: ServiceAppOptions = {},
): FastifyInstance {
  const readinessChecks = options.readinessChecks ?? [];
  const readinessNames = new Set(readinessChecks.map((check) => check.name));
  if (
    readinessNames.size !== readinessChecks.length ||
    readinessChecks.some(
      (check) => !/^[a-z][a-z0-9_.-]{0,63}$/.test(check.name),
    )
  ) {
    throw new Error(
      "readiness check names must be unique low-cardinality identifiers",
    );
  }

  const logger =
    options.logger === false
      ? false
      : options.logger === true
        ? secureLoggerOptions(options.runtimeConfig, options.loggerStream)
        : defaultLogger(options.runtimeConfig, options.loggerStream);
  const app = Fastify({
    logger,
    logController: new LogController({ disableRequestLogging: true }),
    requestTimeout: options.runtimeConfig?.request_timeout_ms ?? 30_000,
    genReqId: (request) => extractInboundTraceId(request.headers),
  });
  if (logger !== false) secureChildLoggerBindings(app.log);
  const lifecycle: ServiceLifecycleState = { acceptingTraffic: true };
  const requestSpans = new WeakMap<object, Span>();
  lifecycleStates.set(app, lifecycle);

  app.addHook("onRequest", (request, reply, done) => {
    const extractedContext = extractTelemetryContext(request.headers);
    const parentContext =
      trace.getSpanContext(extractedContext) === undefined
        ? contextForTraceId(request.id)
        : extractedContext;
    const span = serviceTracer.startSpan(
      "pai.http.request",
      {
        kind: SpanKind.SERVER,
        attributes: {
          "service.name": serviceId,
          "http.request.method": request.method,
          "http.route": request.routeOptions.url,
        },
      },
      parentContext,
    );
    requestSpans.set(request, span);
    void reply.header("x-trace-id", request.id);
    const pathname = request.raw.url?.split("?", 1)[0];
    const shutdownError =
      !lifecycle.acceptingTraffic &&
      pathname !== "/health" &&
      pathname !== "/ready"
        ? new ServiceError({
            code: "service_unavailable",
            message: "service is shutting down",
            statusCode: 503,
            retryable: true,
          })
        : undefined;
    const requestContext = trace.setSpan(parentContext, span);
    context.with(requestContext, () => done(shutdownError));
  });

  installWorkloadAuth(app, serviceId, options.auth);

  app.addHook("onResponse", async (request, reply) => {
    request.log.info(
      {
        event: "http_request_completed",
        service_id: serviceId,
        trace_id: request.id,
        method: request.method,
        route: request.routeOptions.url,
        status_code: reply.statusCode,
        duration_ms: Math.round(reply.elapsedTime),
      },
      "request completed",
    );
    const span = requestSpans.get(request);
    span?.setAttribute("http.response.status_code", reply.statusCode);
    span?.setStatus({
      code:
        reply.statusCode >= 500 ? SpanStatusCode.ERROR : SpanStatusCode.UNSET,
    });
    span?.end();
    requestSpans.delete(request);
  });

  const endAbortedSpan = (request: object, reason: string): void => {
    const span = requestSpans.get(request);
    span?.setStatus({ code: SpanStatusCode.ERROR, message: reason });
    span?.end();
    requestSpans.delete(request);
  };
  app.addHook("onTimeout", async (request) => {
    endAbortedSpan(request, "request_timeout");
  });
  app.addHook("onRequestAbort", async (request) => {
    endAbortedSpan(request, "request_aborted");
  });

  app.get(
    "/health",
    {
      schema: {
        response: {
          200: {
            type: "object",
            additionalProperties: false,
            required: ["status", "service_id"],
            properties: {
              status: { const: "ok", type: "string" },
              service_id: ServiceIdV1Schema,
            },
          },
        },
      },
    },
    async () => ({ status: "ok" as const, service_id: serviceId }),
  );

  app.get("/ready", async (_request, reply) => {
    if (!lifecycle.acceptingTraffic) {
      return reply.code(503).send({
        status: "not_ready",
        service_id: serviceId,
        checks: [],
      });
    }

    const checks = await Promise.all(
      readinessChecks.map(async (check) =>
        runReadinessCheck(
          check,
          options.runtimeConfig?.readiness_timeout_ms ?? 2_000,
        ),
      ),
    );
    const ready = checks.every((check) => check.status === "up");
    return reply.code(ready ? 200 : 503).send({
      status: ready ? "ready" : "not_ready",
      service_id: serviceId,
      checks,
    });
  });

  app.setErrorHandler((error, request, reply) => {
    const details = validationDetails(error);
    const serviceError =
      error instanceof ServiceError
        ? error
        : details === undefined
          ? new ServiceError({
              code: "internal_error",
              message: "internal service error",
              statusCode: 500,
              retryable: false,
            })
          : new ServiceError({
              code: "invalid_request",
              message: "request validation failed",
              statusCode: 400,
              retryable: false,
              details,
            });
    const envelope: ResponseEnvelopeV1 = {
      code: serviceError.code,
      message: serviceError.message,
      retryable: serviceError.retryable,
      details: serviceError.details,
      trace_id: request.id,
    };

    if (serviceError.statusCode >= 500) {
      requestSpans.get(request)?.setStatus({
        code: SpanStatusCode.ERROR,
        message: serviceError.code,
      });
      request.log.error(
        {
          event: "http_request_failed",
          service_id: serviceId,
          trace_id: request.id,
          error_code: serviceError.code,
          status_code: serviceError.statusCode,
        },
        "request failed",
      );
    }
    void reply.code(serviceError.statusCode).send(envelope);
  });

  return app;
}
