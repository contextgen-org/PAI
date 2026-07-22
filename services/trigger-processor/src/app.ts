import {
  matchesAuthorizationScope,
  snapshotVerifiedSupabaseIngressV1,
  snapshotVerifiedWorkloadCredentialV1,
  type BotAuthorizationScopeV1,
  type SupabaseIngressVerifier,
  type WorkloadCredentialVerifierPort,
} from "@pai/auth";
import {
  TRIGGER_PROCESSOR_HTTP_OPERATIONS_V1,
  TriggerSubmitRequestV1Schema,
  type AdmitTriggerWriterResponseV1,
} from "@pai/contracts";
import { OwnerRepositoryTransientErrorV1 } from "@pai/persistence";
import {
  createServiceApp,
  ServiceError,
  type ServiceAppOptions,
} from "@pai/service-kit";

import {
  InvalidAdmitTriggerCommandError,
  type TriggerAdmissionApplicationV1,
  type VerifiedTriggerIngressV1,
} from "./application/trigger-admission.v1.js";

const admissionRoutes = TRIGGER_PROCESSOR_HTTP_OPERATIONS_V1;

function claimedSource(request: { readonly body?: unknown }):
  | "chat"
  | "notification"
  | "timer"
  | undefined {
  const body = request.body;
  if (typeof body !== "object" || body === null || !("source" in body)) {
    return undefined;
  }
  const source = body.source;
  return source === "chat" || source === "notification" || source === "timer"
    ? source
    : undefined;
}

function permissionScopeForSource(
  source: "chat" | "notification" | "timer" | undefined,
): string {
  return source === undefined ? "trigger.submit" : `trigger.submit.${source}`;
}

function requiredAdmissionScope(request: {
  readonly body?: unknown;
}): BotAuthorizationScopeV1 {
  const body = request.body;
  if (
    typeof body !== "object" ||
    body === null ||
    !("workspace_id" in body) ||
    !("bot_id" in body) ||
    !("owner_agent_id" in body) ||
    !("deployment_environment" in body) ||
    !("release_channel" in body)
  ) {
    throw new ServiceError({
      code: "invalid_request",
      message: "admission command bot scope is required",
      statusCode: 400,
      retryable: false,
      details: { schema_version: "trigger_submit_request.v1" },
    });
  }
  return {
    scope_kind: "bot",
    workspace_id: body.workspace_id,
    bot_id: body.bot_id,
    owner_agent_id: body.owner_agent_id,
    deployment_environment: body.deployment_environment,
    release_channel: body.release_channel,
  } as BotAuthorizationScopeV1;
}

type SupabaseIngressVerifierPort = Pick<SupabaseIngressVerifier, "verify">;

export interface TriggerProcessorAppOptionsV1 extends ServiceAppOptions {
  readonly supabaseIngressVerifier?: SupabaseIngressVerifierPort;
}

const triggerProcessorAppOptionKeys = new Set([
  "auth",
  "errorMapper",
  "logger",
  "loggerStream",
  "readinessChecks",
  "runtimeConfig",
  "supabaseIngressVerifier",
]);

function ownEnumerableDataSnapshot(
  value: unknown,
  allowedKeys: ReadonlySet<string>,
  message: string,
): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
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
  const keys = Reflect.ownKeys(descriptors);
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    keys.some((key) => typeof key !== "string") ||
    (keys as string[]).some((key) => !allowedKeys.has(key))
  ) {
    throw new Error(message);
  }
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

function snapshotTriggerProcessorAppOptionsV1(
  value: unknown,
): TriggerProcessorAppOptionsV1 {
  const data = ownEnumerableDataSnapshot(
    value,
    triggerProcessorAppOptionKeys,
    "Trigger Processor app options must contain only own data properties",
  );
  const auth =
    data.auth === undefined
      ? undefined
      : ownEnumerableDataSnapshot(
          data.auth,
          new Set(["policies", "verifier"]),
          "Trigger Processor auth options must contain only own data properties",
        );
  return Object.freeze({
    ...data,
    ...(auth === undefined ? {} : { auth }),
  }) as unknown as TriggerProcessorAppOptionsV1;
}

function captureVerifyPort<T extends { verify: (...args: never[]) => unknown }>(
  value: T | undefined,
  label: string,
): T | undefined {
  if (value === undefined) return undefined;
  if ((typeof value !== "object" && typeof value !== "function") || value === null) {
    throw new Error(`${label} is invalid`);
  }
  let cursor: object | null = value;
  for (let depth = 0; cursor !== null && depth < 16; depth += 1) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(cursor, "verify");
      cursor = Object.getPrototypeOf(cursor);
    } catch {
      throw new Error(`${label} is invalid`);
    }
    if (descriptor === undefined) continue;
    if (!("value" in descriptor) || typeof descriptor.value !== "function") {
      throw new Error(`${label} must expose verify as a data method`);
    }
    return Object.freeze({
      verify: descriptor.value.bind(value),
    }) as T;
  }
  throw new Error(`${label} must expose verify as a data method`);
}

function declaresMixedIngressPolicy(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  let descriptors: PropertyDescriptorMap;
  try {
    descriptors = Object.getOwnPropertyDescriptors(
      value,
    ) as unknown as PropertyDescriptorMap;
  } catch {
    return false;
  }
  const length = descriptors.length?.value;
  if (!Number.isSafeInteger(length) || (length as number) < 0 || (length as number) > 256) {
    return false;
  }
  for (let index = 0; index < (length as number); index += 1) {
    const element = descriptors[String(index)];
    if (element === undefined || !("value" in element)) continue;
    const policy = element.value;
    if (typeof policy !== "object" || policy === null) continue;
    let method: PropertyDescriptor | undefined;
    let route: PropertyDescriptor | undefined;
    try {
      method = Object.getOwnPropertyDescriptor(policy, "method");
      route = Object.getOwnPropertyDescriptor(policy, "route");
    } catch {
      continue;
    }
    if (
      method !== undefined &&
      "value" in method &&
      typeof method.value === "string" &&
      method.value.toUpperCase() === "POST" &&
      route !== undefined &&
      "value" in route &&
      route.value === "/v1/triggers"
    ) {
      return true;
    }
  }
  return false;
}

const triggerIngressContexts = new WeakMap<object, VerifiedTriggerIngressV1>();

function triggerBearerToken(request: {
  readonly headers: Readonly<{ authorization?: unknown }>;
}): string {
  const authorization = request.headers.authorization;
  if (typeof authorization !== "string") {
    throw new ServiceError({
      code: "unauthenticated",
      message: "Trigger ingress credential is required",
      statusCode: 401,
      retryable: false,
      details: { submit_attempt_id: null },
    });
  }
  const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(
    authorization,
  );
  if (match?.[1] === undefined) {
    throw new ServiceError({
      code: "unauthenticated",
      message: "Trigger ingress credential is malformed",
      statusCode: 401,
      retryable: false,
      details: { submit_attempt_id: null },
    });
  }
  return match[1];
}

async function verifyTriggerIngress(
  token: string,
  workloadVerifier: WorkloadCredentialVerifierPort | undefined,
  supabaseVerifier: SupabaseIngressVerifierPort | undefined,
): Promise<VerifiedTriggerIngressV1> {
  if (workloadVerifier !== undefined) {
    try {
      const credential = await workloadVerifier.verify(token, {
        audience: "trigger_processor",
        requiredCapabilities: [],
      });
      return Object.freeze({
        authentication_kind: "pai_workload_jwt",
        credential: snapshotVerifiedWorkloadCredentialV1(credential),
      });
    } catch {
      // The exact issuer/audience verifier remains authoritative. A token that
      // is not a workload JWT may still be a valid public Supabase credential.
    }
  }
  if (supabaseVerifier !== undefined) {
    try {
      const credential = await supabaseVerifier.verify(token);
      return Object.freeze({
        authentication_kind: "supabase_ingress",
        credential: snapshotVerifiedSupabaseIngressV1(credential),
      });
    } catch {
      // Both independently configured verifiers must fail closed below.
    }
  }
  throw new ServiceError({
    code: "unauthenticated",
    message: "Trigger ingress credential was rejected",
    statusCode: 401,
    retryable: false,
    details: { submit_attempt_id: null },
  });
}

function getTriggerIngressContext(request: object): VerifiedTriggerIngressV1 {
  const context = triggerIngressContexts.get(request);
  if (context === undefined) {
    throw new ServiceError({
      code: "unauthenticated",
      message: "Trigger ingress context is unavailable",
      statusCode: 401,
      retryable: false,
      details: { submit_attempt_id: null },
    });
  }
  return context;
}

function tryGetTriggerIngressContext(
  request: object,
): VerifiedTriggerIngressV1 | undefined {
  return triggerIngressContexts.get(request);
}

function sourceAuthorizationError(
  source: "chat" | "notification" | "timer",
  scopeMismatch = false,
): ServiceError {
  const timer = source === "timer";
  const code = timer
    ? scopeMismatch
      ? "timer_owner_binding_mismatch"
      : "timer_source_caller_denied"
    : "bot_permission_denied";
  return new ServiceError({
    code,
    message: timer
      ? scopeMismatch
        ? "timer owner scope does not match"
        : "timer source caller is not authorized"
      : "public Trigger ingress identity is not authorized",
    statusCode: 403,
    retryable: false,
    details: {
      permission_scope: permissionScopeForSource(source),
      policy: timer
        ? scopeMismatch
          ? "timer_owner_binding_v1"
          : "timer_source_caller_v1"
        : "supabase_ingress_principal_v1",
      reason_code: code,
      submit_attempt_id: null,
    },
  });
}

function assertSourceAuthentication(
  ingress: VerifiedTriggerIngressV1,
  body: unknown,
): void {
  const source = claimedSource({ body });
  if (source === undefined) {
    throw new ServiceError({
      code: "invalid_request",
      message: "validated Trigger submit source is unavailable",
      statusCode: 400,
      retryable: false,
      details: { schema_version: "trigger_submit_request.v1" },
    });
  }
  if (source !== "timer") {
    if (ingress.authentication_kind !== "supabase_ingress") {
      throw sourceAuthorizationError(source);
    }
    return;
  }
  if (ingress.authentication_kind !== "pai_workload_jwt") {
    throw sourceAuthorizationError(source);
  }
  const { claims } = ingress.credential;
  if (
    claims.sub !== "timer_trigger_app" ||
    !claims.capability.includes("trigger.submit.timer") ||
    claims.delegated_principal !== undefined
  ) {
    throw sourceAuthorizationError(source);
  }
  const scope = requiredAdmissionScope({ body });
  if (
    claims.aud !== "trigger_processor" ||
    claims.scope_kind !== "bot" ||
    !matchesAuthorizationScope(claims, scope)
  ) {
    throw sourceAuthorizationError(source, true);
  }
}

function admissionError(error: InvalidAdmitTriggerCommandError): ServiceError {
  if (error.kind === "server_invariant") {
    return new ServiceError({
      code: "internal_error",
      message: "admission writer violated its canonical response contract",
      statusCode: 500,
      retryable: false,
      details: {
        schema_version: "trigger_submit_response.v1",
      },
      cause: error,
    });
  }
  if (
    error.kind === "capability_denied" ||
    error.kind === "authorization_denied" ||
    error.kind === "authorization_scope_mismatch"
  ) {
    const timer = error.source === "timer";
    const scopeMismatch = error.kind === "authorization_scope_mismatch";
    const code = timer
      ? scopeMismatch
        ? "timer_owner_binding_mismatch"
        : "timer_source_caller_denied"
      : "bot_permission_denied";
    return new ServiceError({
      code,
      message: timer
        ? scopeMismatch
          ? "timer owner scope does not match"
          : "timer source caller is not authorized"
        : "public Trigger ingress identity is not authorized",
      statusCode: 403,
      retryable: false,
      details: {
        permission_scope: permissionScopeForSource(error.source),
        policy: timer
          ? scopeMismatch
            ? "timer_owner_binding_v1"
            : "timer_source_caller_v1"
          : scopeMismatch
            ? "supabase_owner_binding_v1"
            : "supabase_actor_binding_v1",
        reason_code: code,
        submit_attempt_id: null,
      },
      cause: error,
    });
  }
  return new ServiceError({
    code: "invalid_request",
    message: "request validation failed",
    statusCode: 400,
    retryable: false,
    details: {
      schema_version: "trigger_submit_request.v1",
      field_errors: [
        {
          field_path: "/",
          message: "request violates the canonical Trigger submit contract",
          expected: "TriggerSubmitRequestV1",
          actual: "rejected_value",
        },
      ],
      submit_attempt_id: null,
    },
    cause: error,
  });
}

function admissionResponseStatusCode(
  response: AdmitTriggerWriterResponseV1,
): 200 | 202 | 400 | 401 | 403 | 404 | 409 | 429 | 500 | 503 {
  switch (response.code) {
    case "trigger_accepted":
      return 202;
    case "trigger_rejected":
    case "duplicate_replayed":
      return 200;
    case "idempotency_conflict":
    case "preempt_conflict":
      return 409;
    case "bot_permission_denied":
    case "timer_source_caller_denied":
    case "timer_owner_binding_mismatch":
      return 403;
    case "bot_not_found":
      return 404;
    case "rate_limited":
      return 429;
    case "storage_unavailable":
    case "degraded_mode":
      return 503;
  }
}

function ownerRepositoryTransientError(
  error: OwnerRepositoryTransientErrorV1,
): ServiceError {
  return new ServiceError({
    code: "storage_unavailable",
    message: "owner repository operation should be retried",
    statusCode: 503,
    retryable: true,
    details: {
      submit_attempt_id: null,
    },
    cause: error,
  });
}

function isOwnerRepositoryTransientError(
  error: unknown,
): error is OwnerRepositoryTransientErrorV1 {
  return (
    error instanceof OwnerRepositoryTransientErrorV1 ||
    (typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "OwnerRepositoryTransientErrorV1" &&
      "code" in error &&
      (error.code === "serialization_retry_exhausted" ||
        error.code === "transient_database_error"))
  );
}

function triggerAdmissionHttpError(
  error: unknown,
  route: string | undefined,
): ServiceError | undefined {
  if (route !== "/v1/triggers") return undefined;
  if (error instanceof ServiceError) {
    if (error.statusCode === 503 && error.code !== "storage_unavailable" && error.code !== "degraded_mode") {
      return new ServiceError({
        code: "degraded_mode",
        message: "trigger admission is temporarily unavailable",
        statusCode: 503,
        retryable: true,
        details: { submit_attempt_id: null },
        cause: error,
      });
    }
    if (
      error.statusCode >= 500 &&
      error.statusCode !== 503 &&
      error.code !== "internal_error"
    ) {
      return new ServiceError({
        code: "internal_error",
        message: "internal trigger admission error",
        statusCode: 500,
        retryable: false,
        details: { schema_version: "trigger_submit_response.v1" },
        cause: error,
      });
    }
    return error;
  }
  if (isTriggerSubmitBodyParserError(error)) {
    return new ServiceError({
      code: "invalid_request",
      message: "request validation failed",
      statusCode: 400,
      retryable: false,
      details: {
        schema_version: "trigger_submit_request.v1",
        field_errors: [
          {
            field_path: "/",
            message: "request body is not valid canonical JSON",
            expected: "application/json TriggerSubmitRequestV1",
            actual: "malformed_or_unsupported_body",
          },
        ],
        submit_attempt_id: null,
      },
      cause: error,
    });
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "validation" in error &&
    Array.isArray(error.validation)
  ) {
    const fieldErrors = error.validation.slice(0, 100).map((issue: unknown) => {
      const value =
        typeof issue === "object" && issue !== null
          ? (issue as Record<string, unknown>)
          : {};
      return {
        field_path:
          typeof value.instancePath === "string" && value.instancePath.length > 0
            ? value.instancePath
            : "/",
        message:
          typeof value.message === "string"
            ? value.message
            : "request value was rejected",
        expected:
          typeof value.schemaPath === "string"
            ? value.schemaPath
            : typeof value.keyword === "string"
              ? value.keyword
              : "TriggerSubmitRequestV1",
        actual: "rejected_value",
      };
    });
    return new ServiceError({
      code: "invalid_request",
      message: "request validation failed",
      statusCode: 400,
      retryable: false,
      details: {
        schema_version: "trigger_submit_request.v1",
        field_errors:
          fieldErrors.length > 0
            ? fieldErrors
            : [
                {
                  field_path: "/",
                  message: "request value was rejected",
                  expected: "TriggerSubmitRequestV1",
                  actual: "rejected_value",
                },
              ],
        submit_attempt_id: null,
      },
      cause: error,
    });
  }
  return new ServiceError({
    code: "internal_error",
    message: "internal trigger admission error",
    statusCode: 500,
    retryable: false,
    details: { schema_version: "trigger_submit_response.v1" },
    cause: error,
  });
}

const triggerSubmitBodyParserErrorCodes = new Set([
  "FST_ERR_CTP_BODY_TOO_LARGE",
  "FST_ERR_CTP_INVALID_MEDIA_TYPE",
  "FST_ERR_CTP_INVALID_CONTENT_LENGTH",
  "FST_ERR_CTP_EMPTY_JSON_BODY",
  "FST_ERR_CTP_INVALID_JSON_BODY",
]);

function isTriggerSubmitBodyParserError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    triggerSubmitBodyParserErrorCodes.has(error.code)
  );
}

function preAdmissionFailure(
  error: ServiceError,
): Readonly<{
  result_code:
    | "invalid_request"
    | "unauthenticated"
    | "bot_permission_denied"
    | "timer_source_caller_denied"
    | "timer_owner_binding_mismatch";
  outcome: "schema_invalid" | "identity_invalid";
}> | undefined {
  switch (error.code) {
    case "invalid_request":
      return { result_code: error.code, outcome: "schema_invalid" };
    case "unauthenticated":
    case "bot_permission_denied":
    case "timer_source_caller_denied":
    case "timer_owner_binding_mismatch":
      return { result_code: error.code, outcome: "identity_invalid" };
    default:
      return undefined;
  }
}

function withSubmitAttemptId(error: ServiceError, attemptId: string): ServiceError {
  const details =
    typeof error.details === "object" &&
    error.details !== null &&
    !Array.isArray(error.details)
      ? error.details
      : {};
  return new ServiceError({
    code: error.code,
    message: error.message,
    statusCode: error.statusCode,
    retryable: error.retryable,
    details: { ...details, submit_attempt_id: attemptId },
    cause: error,
  });
}

export function buildTriggerProcessorApp(
  options: TriggerProcessorAppOptionsV1 = {},
  triggerAdmission?: TriggerAdmissionApplicationV1,
): ReturnType<typeof createServiceApp> {
  const stableOptions = snapshotTriggerProcessorAppOptionsV1(options);
  const {
    supabaseIngressVerifier: suppliedSupabaseIngressVerifier,
    ...suppliedServiceOptions
  } = stableOptions;
  const workloadIngressVerifier = captureVerifyPort(
    suppliedServiceOptions.auth?.verifier,
    "Trigger Processor workload verifier",
  );
  const supabaseIngressVerifier = captureVerifyPort(
    suppliedSupabaseIngressVerifier,
    "Trigger Processor Supabase ingress verifier",
  );
  const serviceOptions = Object.freeze({
    ...suppliedServiceOptions,
    ...(suppliedServiceOptions.auth === undefined
      ? {}
      : {
          auth: Object.freeze({
            ...suppliedServiceOptions.auth,
            ...(workloadIngressVerifier === undefined
              ? {}
              : { verifier: workloadIngressVerifier }),
          }),
        }),
  });
  if (
    declaresMixedIngressPolicy(serviceOptions.auth?.policies)
  ) {
    throw new Error(
      "POST /v1/triggers authentication is owned by Trigger Processor mixed ingress",
    );
  }
  const app = createServiceApp("trigger_processor", {
    ...serviceOptions,
    async errorMapper(error, request) {
      const canonical = triggerAdmissionHttpError(
        error,
        request.routeOptions.url,
      );
      if (canonical === undefined) {
        return serviceOptions.errorMapper?.(error, request);
      }
      const failure = preAdmissionFailure(canonical);
      if (failure === undefined || triggerAdmission === undefined) {
        return canonical;
      }
      try {
        const credential = tryGetTriggerIngressContext(request);
        const submitAttemptId = await triggerAdmission.recordPreAdmissionFailure({
          trace_id: request.id,
          result_code: failure.result_code,
          outcome: failure.outcome,
          request_body: request.body,
          ...(credential === undefined ? {} : { credential }),
        });
        return withSubmitAttemptId(canonical, submitAttemptId);
      } catch (auditError) {
        if (isOwnerRepositoryTransientError(auditError)) {
          return ownerRepositoryTransientError(auditError);
        }
        return new ServiceError({
          code: "internal_error",
          message: "pre-admission audit could not be persisted",
          statusCode: 500,
          retryable: false,
          details: { schema_version: "trigger_submit_response.v1" },
          cause: auditError,
        });
      }
    },
  });
  if (triggerAdmission !== undefined) {
    app.addHook("onRequest", async (request) => {
      if (
        request.method !== "POST" ||
        request.routeOptions.url !== "/v1/triggers"
      ) {
        return;
      }
      const ingress = await verifyTriggerIngress(
        triggerBearerToken(request),
        workloadIngressVerifier,
        supabaseIngressVerifier,
      );
      triggerIngressContexts.set(request, ingress);
    });
    app.addHook("preHandler", async (request) => {
      if (
        request.method !== "POST" ||
        request.routeOptions.url !== "/v1/triggers"
      ) {
        return;
      }
      assertSourceAuthentication(getTriggerIngressContext(request), request.body);
    });
    app.decorate("triggerAdmission", triggerAdmission);
    for (const operation of admissionRoutes) {
      app.post(
        operation.path,
        {
          schema: {
            body: TriggerSubmitRequestV1Schema,
            response: operation.response_schemas_by_status,
          },
        },
        async (request, reply) => {
          try {
            const response = await triggerAdmission.admit(
              getTriggerIngressContext(request),
              withAuthenticatedRouteContext(
                request.body,
                request.id,
              ),
            );
            return reply.code(admissionResponseStatusCode(response)).send(response);
          } catch (error) {
            if (error instanceof InvalidAdmitTriggerCommandError) {
              throw admissionError(error);
            }
            if (isOwnerRepositoryTransientError(error)) {
              throw ownerRepositoryTransientError(error);
            }
            throw error;
          }
        },
      );
    }
  }
  return app;
}

function withAuthenticatedRouteContext(
  body: unknown,
  traceId: string,
): unknown {
  return typeof body === "object" && body !== null
    ? { ...body, trace_id: traceId }
    : body;
}
