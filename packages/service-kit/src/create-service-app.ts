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
  type FastifyRequest,
} from "fastify";

import {
  assertServiceRuntimeConfig,
  type ServiceRuntimeConfigV1,
} from "./config.js";
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
  /** Route-aware mapping into a service's published error envelope. */
  readonly errorMapper?: (
    error: unknown,
    request: FastifyRequest,
  ) => ServiceError | undefined | Promise<ServiceError | undefined>;
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

interface ReadinessExecutionState {
  inFlight?: Promise<void>;
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
  executionState: ReadinessExecutionState,
  timeoutMs: number,
): Promise<ReadinessResult> {
  const startedAt = performance.now();
  let execution = executionState.inFlight;
  if (execution === undefined) {
    const controller = new AbortController();
    const timeoutError = new Error("readiness check timed out");
    let deadlineExceeded = false;
    const executionTimer = setTimeout(() => {
      deadlineExceeded = true;
      controller.abort(timeoutError);
    }, timeoutMs);
    executionTimer.unref();

    const currentExecution = Promise.resolve()
      .then(() => readinessCheck.check(controller.signal))
      .then(() => {
        if (deadlineExceeded) throw timeoutError;
      })
      .finally(() => {
        clearTimeout(executionTimer);
        if (executionState.inFlight === currentExecution) {
          delete executionState.inFlight;
        }
      });
    executionState.inFlight = currentExecution;
    // A probe can time out before an uncooperative dependency eventually
    // rejects. Keep that late rejection observed while retaining the task as
    // the single shared bulkhead until it actually settles.
    void currentExecution.catch(() => undefined);
    execution = currentExecution;
  }

  let observerTimer: NodeJS.Timeout | undefined;

  try {
    await Promise.race([
      execution,
      new Promise<never>((_resolve, reject) => {
        observerTimer = setTimeout(() => {
          reject(new Error("readiness check timed out"));
        }, timeoutMs);
        observerTimer.unref();
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
    if (observerTimer !== undefined) clearTimeout(observerTimer);
  }
}

export function beginServiceShutdown(app: FastifyInstance): void {
  const lifecycle = lifecycleStates.get(app);
  if (lifecycle !== undefined) lifecycle.acceptingTraffic = false;
}

function snapshotServiceAppOptions(value: unknown): ServiceAppOptions {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("service app options must contain only own data properties");
  }
  let prototype: object | null;
  let descriptors: PropertyDescriptorMap;
  try {
    prototype = Object.getPrototypeOf(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    throw new Error("service app options must contain only own data properties");
  }
  const allowedKeys = new Set([
    "auth",
    "errorMapper",
    "logger",
    "loggerStream",
    "readinessChecks",
    "runtimeConfig",
  ]);
  const keys = Reflect.ownKeys(descriptors);
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    keys.some((key) => typeof key !== "string") ||
    (keys as string[]).some((key) => !allowedKeys.has(key))
  ) {
    throw new Error("service app options must contain only own data properties");
  }
  const snapshot = Object.create(null) as Record<string, unknown>;
  for (const key of keys as string[]) {
    const descriptor = descriptors[key];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      throw new Error("service app options must contain only own data properties");
    }
    snapshot[key] = descriptor.value;
  }
  const logger = snapshot.logger;
  const errorMapper = snapshot.errorMapper;
  const loggerStream = snapshot.loggerStream;
  const loggerWrite =
    typeof loggerStream === "object" && loggerStream !== null
      ? (loggerStream as Partial<ServiceLoggerStreamDestination>).write
      : undefined;
  if (
    (logger !== undefined && typeof logger !== "boolean") ||
    (errorMapper !== undefined && typeof errorMapper !== "function") ||
    (loggerStream !== undefined &&
      (typeof loggerStream !== "object" ||
        loggerStream === null ||
        typeof loggerWrite !== "function"))
  ) {
    throw new Error("invalid service app options");
  }
  const runtimeConfig =
    snapshot.runtimeConfig === undefined
      ? undefined
      : assertServiceRuntimeConfig(snapshot.runtimeConfig);
  const capturedLoggerStream =
    loggerStream === undefined
      ? undefined
      : Object.freeze({
          write: loggerWrite!.bind(loggerStream),
        });
  return Object.freeze({
    ...(logger === undefined ? {} : { logger }),
    ...(capturedLoggerStream === undefined
      ? {}
      : { loggerStream: capturedLoggerStream }),
    ...(runtimeConfig === undefined ? {} : { runtimeConfig }),
    ...(snapshot.readinessChecks === undefined
      ? {}
      : { readinessChecks: snapshot.readinessChecks as readonly ReadinessCheck[] }),
    ...(snapshot.auth === undefined
      ? {}
      : { auth: snapshot.auth as WorkloadAuthOptions }),
    ...(errorMapper === undefined
      ? {}
      : { errorMapper: errorMapper.bind(value) }),
  });
}

function snapshotReadinessChecks(value: unknown): readonly ReadinessCheck[] {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value)) {
    throw new Error(
      "readiness check names must be unique low-cardinality identifiers",
    );
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const lengthDescriptor = Object.getOwnPropertyDescriptor(
    descriptors,
    "length",
  )?.value as PropertyDescriptor | undefined;
  const lengthValue = lengthDescriptor?.value as unknown;
  if (
    typeof lengthValue !== "number" ||
    !Number.isSafeInteger(lengthValue) ||
    lengthValue < 0 ||
    lengthValue > 64
  ) {
    throw new Error(
      "readiness check names must be unique low-cardinality identifiers",
    );
  }
  const expectedKeys = new Set([
    "length",
    ...Array.from({ length: lengthValue }, (_entry, index) => String(index)),
  ]);
  const keys = Reflect.ownKeys(descriptors);
  if (
    keys.some((key) => typeof key !== "string") ||
    (keys as string[]).some((key) => !expectedKeys.has(key)) ||
    keys.length !== expectedKeys.size
  ) {
    throw new Error(
      "readiness check names must be unique low-cardinality identifiers",
    );
  }
  const checks: ReadinessCheck[] = [];
  for (let index = 0; index < lengthValue; index += 1) {
    const elementDescriptor = descriptors[String(index)];
    if (
      elementDescriptor === undefined ||
      !("value" in elementDescriptor) ||
      elementDescriptor.enumerable !== true
    ) {
      throw new Error(
        "readiness check names must be unique low-cardinality identifiers",
      );
    }
    const checkValue = elementDescriptor.value as unknown;
    if (
      typeof checkValue !== "object" ||
      checkValue === null ||
      Array.isArray(checkValue)
    ) {
      throw new Error(
        "readiness check names must be unique low-cardinality identifiers",
      );
    }
    let checkPrototype: object | null;
    let checkDescriptors: PropertyDescriptorMap;
    try {
      checkPrototype = Object.getPrototypeOf(checkValue);
      checkDescriptors = Object.getOwnPropertyDescriptors(checkValue);
    } catch {
      throw new Error(
        "readiness check names must be unique low-cardinality identifiers",
      );
    }
    const checkKeys = Reflect.ownKeys(checkDescriptors);
    const nameDescriptor = checkDescriptors.name;
    const methodDescriptor = checkDescriptors.check;
    if (
      (checkPrototype !== Object.prototype && checkPrototype !== null) ||
      checkKeys.some((key) => typeof key !== "string") ||
      (checkKeys as string[]).sort().join(",") !== "check,name" ||
      nameDescriptor === undefined ||
      !("value" in nameDescriptor) ||
      nameDescriptor.enumerable !== true ||
      typeof nameDescriptor.value !== "string" ||
      methodDescriptor === undefined ||
      !("value" in methodDescriptor) ||
      methodDescriptor.enumerable !== true ||
      typeof methodDescriptor.value !== "function"
    ) {
      throw new Error(
        "readiness check names must be unique low-cardinality identifiers",
      );
    }
    checks.push(
      Object.freeze({
        name: nameDescriptor.value,
        check: methodDescriptor.value.bind(checkValue),
      }),
    );
  }
  const names = new Set(checks.map((check) => check.name));
  if (
    names.size !== checks.length ||
    checks.some((check) => !/^[a-z][a-z0-9_.-]{0,63}$/.test(check.name))
  ) {
    throw new Error(
      "readiness check names must be unique low-cardinality identifiers",
    );
  }
  return Object.freeze(checks);
}

export function createServiceApp(
  serviceId: ServiceIdV1,
  options: ServiceAppOptions = {},
): FastifyInstance {
  const appOptions = snapshotServiceAppOptions(options);
  const readinessChecks = snapshotReadinessChecks(appOptions.readinessChecks);
  const readinessExecutionStates = readinessChecks.map(
    (): ReadinessExecutionState => ({}),
  );
  const readinessTimeoutMs =
    appOptions.runtimeConfig?.readiness_timeout_ms ?? 2_000;
  const errorMapper = appOptions.errorMapper;

  const logger =
    appOptions.logger === false
      ? false
      : appOptions.logger === true
        ? secureLoggerOptions(appOptions.runtimeConfig, appOptions.loggerStream)
        : defaultLogger(appOptions.runtimeConfig, appOptions.loggerStream);
  const app = Fastify({
    logger,
    logController: new LogController({ disableRequestLogging: true }),
    requestTimeout: appOptions.runtimeConfig?.request_timeout_ms ?? 30_000,
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

  installWorkloadAuth(app, serviceId, appOptions.auth);

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
      readinessChecks.map(async (check, index) =>
        runReadinessCheck(
          check,
          readinessExecutionStates[index]!,
          readinessTimeoutMs,
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

  app.setErrorHandler(async (error, request, reply) => {
    const details = validationDetails(error);
    const serviceError =
      (await errorMapper?.(error, request)) ??
      (error instanceof ServiceError
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
            }));
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
    return reply.code(serviceError.statusCode).send(envelope);
  });

  return app;
}
