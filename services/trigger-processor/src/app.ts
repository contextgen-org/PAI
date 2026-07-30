import {
  matchesAuthorizationScope,
  snapshotVerifiedSupabaseIngressV1,
  snapshotVerifiedWorkloadCredentialV1,
  type BotAuthorizationScopeV1,
  type SupabaseIngressVerifier,
  type WorkloadCredentialVerifierPort,
} from "@pai/auth";
import {
  canonicalJsonV1,
  ContextComposeRequestV1Schema,
  ContextComposeResponseV1Schema,
  ContextSnapshotReadContractV1Schema,
  ContextSnapshotReadErrorV1Schema,
  ContextSnapshotResolveRequestV1Schema,
  IntentSynthesizeRequestV1Schema,
  IntentSynthesizeResponseV1Schema,
  RuntimeEventAppendRequestV1Schema,
  RuntimeEventAppendResponseV1Schema,
  RuntimeStartReservationValidateErrorV1Schema,
  RuntimeStartReservationValidateRequestV1Schema,
  RuntimeStartReservationValidateResponseV1Schema,
  TRIGGER_PROCESSOR_HTTP_OPERATIONS_V1,
  TriggerProcessSnapshotReadContractV1Schema,
  TriggerProcessSnapshotResolveRequestV1Schema,
  TriggerProcessGetResponseV1Schema,
  TriggerProcessCancelRequestV1Schema,
  TriggerProcessCancelResponseV1Schema,
  TriggerConfirmationResponseV1Schema,
  TriggerConfirmationResponseResultV1Schema,
  TriggerProcessSseRequestV1Schema,
  TriggerSubmitRequestV1Schema,
  type AdmitTriggerWriterResponseV1,
  type RuntimeStartReservationValidateErrorV1,
  type RuntimeStartReservationValidationStageV1,
  type TriggerProcessCancelResponseV1,
} from "@pai/contracts";
import { OwnerRepositoryTransientErrorV1 } from "@pai/persistence";
import { Value } from "@sinclair/typebox/value";
import {
  createServiceApp,
  getWorkloadAuthContext,
  ServiceError,
  type InternalRouteAuthPolicy,
  type ServiceAppOptions,
} from "@pai/service-kit";

import {
  InvalidAdmitTriggerCommandError,
  type TriggerAdmissionApplicationV1,
  type VerifiedTriggerIngressV1,
} from "./application/trigger-admission.v1.js";
import {
  TriggerConfirmationResponseErrorV1,
  type TriggerConfirmationResponseApplicationV1,
} from "./application/confirmation.v1.js";
import {
  InvalidProcessControlRequestV1,
  type TriggerProcessControlApplicationV1,
} from "./application/process-control.v1.js";
import {
  TriggerProcessObservationErrorV1,
  type DelegatedProcessReadPrincipalV1,
  type TriggerProcessObservationApplicationV1,
} from "./application/process-observation.v1.js";
import {
  TriggerLifecycleStageErrorV1,
  type TriggerLifecycleApplicationV1,
  type TriggerProcessWorkClaimV1,
} from "./application/trigger-lifecycle.v1.js";
import {
  ContextSnapshotResolveErrorV1,
  type ContextSnapshotReadApplicationV1,
} from "./application/context-snapshot-read.v1.js";
import type { TriggerProcessRecoveryRunnerV1 } from "./application/trigger-recovery.v1.js";
import {
  RuntimeStartReservationValidationErrorV1,
  type RuntimeStartReservationValidationApplicationV1,
} from "./application/runtime-start-reservation-validation.v1.js";
import {
  TriggerProcessSnapshotResolveErrorV1,
  type TriggerProcessSnapshotReadApplicationV1,
} from "./application/process-snapshot-read.v1.js";

const admissionRoutes = TRIGGER_PROCESSOR_HTTP_OPERATIONS_V1;
const processCancelRoute = "/v1/trigger-processes/:id/cancel";
const processGetRoute = "/v1/trigger-processes/:id";
const processEventsRoute = "/v1/trigger-processes/:id/events";
const confirmationResponseRoute =
  "/v1/trigger-processes/:id/confirmations/:challengeId";
const contextComposeRoute = "/internal/context/compose" as const;
const contextSnapshotResolveRoute = "/internal/context-snapshots:resolve" as const;
const intentSynthesizeRoute = "/internal/intent/synthesize" as const;
const runtimeEventAppendRoute =
  "/internal/trigger-processes/:id/runtime-events" as const;
const snapshotResolveRoute = "/internal/trigger-process-snapshots:resolve" as const;
const runtimeStartReservationValidateRoute =
  "/internal/trigger-processes/:id/runtime-start-reservations/:attempt/validate" as const;

export interface TriggerProcessorInternalApplicationsV1 {
  readonly confirmation_response?: TriggerConfirmationResponseApplicationV1;
  readonly lifecycle?: TriggerLifecycleApplicationV1;
  readonly context_snapshot_read?: ContextSnapshotReadApplicationV1;
  readonly snapshot_read?: TriggerProcessSnapshotReadApplicationV1;
  readonly runtime_start_reservation_validation?:
    RuntimeStartReservationValidationApplicationV1;
  readonly recovery_runner?: TriggerProcessRecoveryRunnerV1;
}

export interface TriggerProcessorCompositionRequirementsV1 {
  /** Keep production fail-closed until every Day 8-14 owner path is wired. */
  readonly require_complete_pipeline?: boolean;
}

async function waitForDrainOrCloseV1(
  response: NodeJS.EventEmitter & Readonly<{ destroyed?: boolean }>,
  signal: AbortSignal,
): Promise<boolean> {
  if (signal.aborted || response.destroyed === true) return false;
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (drained: boolean) => {
      if (settled) return;
      settled = true;
      response.removeListener("drain", onDrain);
      response.removeListener("close", onClose);
      signal.removeEventListener("abort", onAbort);
      resolve(drained);
    };
    const onDrain = () => finish(true);
    const onClose = () => finish(false);
    const onAbort = () => finish(false);
    response.once("drain", onDrain);
    response.once("close", onClose);
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted || response.destroyed === true) finish(false);
  });
}

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

function requiredWorkClaimV1(headers: Readonly<Record<string, unknown>>):
  TriggerProcessWorkClaimV1 {
  const singleHeader = (name: string): string | undefined => {
    const value = headers[name];
    return typeof value === "string" ? value : undefined;
  };
  const leaseGeneration = Number(
    singleHeader("x-pai-work-lease-generation"),
  );
  const expectedProcessStateVersion = Number(
    singleHeader("x-pai-work-expected-process-state-version"),
  );
  const claim = {
    work_item_id: singleHeader("x-pai-work-item-id"),
    claim_token: singleHeader("x-pai-work-claim-token"),
    lease_owner: singleHeader("x-pai-work-lease-owner"),
    lease_generation: leaseGeneration,
    expected_process_state_version: expectedProcessStateVersion,
    payload_hash: singleHeader("x-pai-work-payload-hash"),
  };
  if (
    typeof claim.work_item_id !== "string" ||
    typeof claim.claim_token !== "string" ||
    typeof claim.lease_owner !== "string" ||
    !Number.isSafeInteger(claim.lease_generation) ||
    claim.lease_generation < 1 ||
    !Number.isSafeInteger(claim.expected_process_state_version) ||
    claim.expected_process_state_version < 1 ||
    typeof claim.payload_hash !== "string" ||
    !/^sha256:[0-9a-f]{64}$/u.test(claim.payload_hash)
  ) {
    throw new ServiceError({
      code: "invalid_work_claim",
      message: "a complete durable Trigger Process work claim is required",
      statusCode: 409,
      retryable: false,
      details: {},
    });
  }
  return Object.freeze(claim) as TriggerProcessWorkClaimV1;
}

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

function inlineFastifySchemaV1(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(inlineFastifySchemaV1);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "$id")
      .map(([key, entry]) => [key, inlineFastifySchemaV1(entry)]),
  );
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

function validInternalIdentityV1(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 512 &&
    !/[\r\n]/u.test(value)
  );
}

function internalBotScopeV1(value: unknown): BotAuthorizationScopeV1 {
  if (
    typeof value !== "object" ||
    value === null ||
    !("workspace_id" in value) ||
    !("bot_id" in value) ||
    !("owner_agent_id" in value) ||
    !("deployment_environment" in value) ||
    !("release_channel" in value) ||
    !validInternalIdentityV1(value.workspace_id) ||
    !validInternalIdentityV1(value.bot_id) ||
    !validInternalIdentityV1(value.owner_agent_id) ||
    (value.deployment_environment !== "local" &&
      value.deployment_environment !== "dev" &&
      value.deployment_environment !== "staging" &&
      value.deployment_environment !== "prod") ||
    (value.release_channel !== "stable" &&
      value.release_channel !== "canary")
  ) {
    throw new ServiceError({
      code: "invalid_request",
      message: "internal bot scope is required",
      statusCode: 400,
      retryable: false,
      details: {},
    });
  }
  return {
    scope_kind: "bot",
    workspace_id: value.workspace_id,
    bot_id: value.bot_id,
    owner_agent_id: value.owner_agent_id,
    deployment_environment: value.deployment_environment,
    release_channel: value.release_channel,
  };
}

function authenticatedWorkloadBotScopeV1(
  request: Parameters<typeof getWorkloadAuthContext>[0],
): BotAuthorizationScopeV1 {
  const claims = getWorkloadAuthContext(request).claims;
  if (claims.scope_kind !== "bot") {
    throw new ServiceError({
      code: "authorization_scope_mismatch",
      message: "internal route requires a bot-scoped workload",
      statusCode: 403,
      retryable: false,
      details: {},
    });
  }
  return {
    scope_kind: "bot",
    workspace_id: claims.workspace_id,
    bot_id: claims.bot_id,
    owner_agent_id: claims.owner_agent_id,
    deployment_environment: claims.deployment_environment,
    release_channel: claims.release_channel,
  };
}

function lifecycleHttpErrorV1(error: unknown): ServiceError {
  if (error instanceof ServiceError) return error;
  if (isOwnerRepositoryTransientError(error)) {
    return ownerRepositoryTransientError(error);
  }
  if (error instanceof TriggerLifecycleStageErrorV1) {
    const denied = error.reason_code.endsWith("_denied");
    const invalid = error.reason_code === "invalid_request";
    const retryable =
      error.reason_code === "deadline_exceeded" ||
      error.reason_code.endsWith("_unavailable");
    return new ServiceError({
      code: error.reason_code,
      message: `Trigger lifecycle ${error.stage} stage failed`,
      statusCode: denied ? 403 : invalid ? 400 : retryable ? 503 : 409,
      retryable,
      details: { stage: error.stage },
      cause: error,
    });
  }
  return new ServiceError({
    code: "internal_error",
    message: "internal Trigger lifecycle error",
    statusCode: 500,
    retryable: false,
    details: {},
    cause: error,
  });
}

function confirmationResponseHttpErrorV1(error: unknown): ServiceError | undefined {
  if (!(error instanceof TriggerConfirmationResponseErrorV1)) return undefined;
  const statusCode = error.code === "schema_validation_failed"
    ? 400
    : error.code === "confirmation_not_found"
      ? 404
      : error.code === "confirmation_principal_mismatch"
        ? 403
        : error.code === "confirmation_expired"
          ? 410
          : error.code === "owner_contract_drift"
            ? 500
            : 409;
  return new ServiceError({
    code: error.code,
    message: "Trigger confirmation response failed",
    statusCode,
    retryable: false,
    details: {},
    cause: error,
  });
}

function snapshotResolveHttpErrorV1(error: unknown): ServiceError {
  if (error instanceof ServiceError) return error;
  if (error instanceof TriggerProcessSnapshotResolveErrorV1) {
    const statusCode =
      error.code === "snapshot_not_found"
        ? 404
        : error.code === "snapshot_expired"
          ? 410
          : error.code === "snapshot_scope_mismatch"
            ? 403
            : error.code === "snapshot_schema_incompatible"
              ? 500
              : 409;
    return new ServiceError({
      code: error.code,
      message: "Trigger Process snapshot resolution failed",
      statusCode,
      retryable: false,
      details: {},
      cause: error,
    });
  }
  return new ServiceError({
    code: "internal_error",
    message: "internal snapshot resolution error",
    statusCode: 500,
    retryable: false,
    details: {},
    cause: error,
  });
}

function contextSnapshotResolveDomainErrorV1(
  error: unknown,
  requestValue: unknown,
): Readonly<{
  statusCode: 403 | 404 | 409 | 410 | 422;
  body: Readonly<{
    schema_version: "context_snapshot_read_error.v1";
    code:
      | "context_not_found"
      | "expired"
      | "hash_mismatch"
      | "scope_mismatch"
      | "schema_incompatible";
    message: string;
    retryable: false;
    trace_id: string;
    details: Readonly<{
      trigger_process_id: string;
      context_snapshot_ref: string;
      context_snapshot_version: number;
    }>;
  }>;
}> {
  if (
    !(error instanceof ContextSnapshotResolveErrorV1) ||
    !Value.Check(ContextSnapshotResolveRequestV1Schema, requestValue)
  ) {
    throw new ServiceError({
      code: "internal_error",
      message: "internal Context snapshot resolution error",
      statusCode: 500,
      retryable: false,
      details: {},
      cause: error,
    });
  }
  const request = requestValue as {
    readonly trigger_process_id: string;
    readonly context_snapshot_ref: string;
    readonly context_snapshot_version: number;
    readonly trace_id: string;
  };
  const statusCode =
    error.code === "context_not_found"
      ? 404
      : error.code === "expired"
        ? 410
        : error.code === "scope_mismatch"
          ? 403
          : error.code === "schema_incompatible"
            ? 422
            : 409;
  return {
    statusCode,
    body: {
      schema_version: "context_snapshot_read_error.v1",
      code: error.code,
      message: "Context snapshot resolution failed",
      retryable: false,
      trace_id: request.trace_id,
      details: {
        trigger_process_id: request.trigger_process_id,
        context_snapshot_ref: request.context_snapshot_ref,
        context_snapshot_version: request.context_snapshot_version,
      },
    },
  };
}

function runtimeStartValidationStageV1(
  body: unknown,
): RuntimeStartReservationValidationStageV1 | null {
  try {
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return null;
    }
    const descriptor = Object.getOwnPropertyDescriptor(
      body,
      "validation_stage",
    );
    if (descriptor === undefined || !("value" in descriptor)) return null;
    return descriptor.value === "request_received" ||
      descriptor.value === "preflight_completed" ||
      descriptor.value === "before_running"
      ? descriptor.value
      : null;
  } catch {
    return null;
  }
}

function runtimeStartValidationPathV1(
  params: unknown,
): Readonly<{
  trigger_process_id: string | null;
  start_attempt_no: number | null;
}> {
  try {
    if (typeof params !== "object" || params === null || Array.isArray(params)) {
      return Object.freeze({
        trigger_process_id: null,
        start_attempt_no: null,
      });
    }
    const idDescriptor = Object.getOwnPropertyDescriptor(params, "id");
    const attemptDescriptor = Object.getOwnPropertyDescriptor(
      params,
      "attempt",
    );
    const triggerProcessId =
      idDescriptor !== undefined &&
      "value" in idDescriptor &&
      typeof idDescriptor.value === "string" &&
      idDescriptor.value.length >= 1 &&
      idDescriptor.value.length <= 256
        ? idDescriptor.value
        : null;
    const parsedAttempt =
      attemptDescriptor !== undefined &&
      "value" in attemptDescriptor &&
      typeof attemptDescriptor.value === "string" &&
      /^[1-9][0-9]*$/u.test(attemptDescriptor.value)
        ? Number(attemptDescriptor.value)
        : Number.NaN;
    return Object.freeze({
      trigger_process_id: triggerProcessId,
      start_attempt_no:
        Number.isSafeInteger(parsedAttempt) && parsedAttempt >= 1
          ? parsedAttempt
          : null,
    });
  } catch {
    return Object.freeze({
      trigger_process_id: null,
      start_attempt_no: null,
    });
  }
}

function runtimeStartValidationTraceIdV1(
  body: unknown,
  serverTraceId: string,
): string {
  try {
    if (typeof body === "object" && body !== null && !Array.isArray(body)) {
      const descriptor = Object.getOwnPropertyDescriptor(body, "trace_id");
      if (
        descriptor !== undefined &&
        "value" in descriptor &&
        typeof descriptor.value === "string" &&
        descriptor.value.length >= 1 &&
        descriptor.value.length <= 256
      ) {
        return descriptor.value;
      }
    }
  } catch {
    // Fall back to the bounded server correlation id below.
  }
  return serverTraceId.length >= 1 && serverTraceId.length <= 256
    ? serverTraceId
    : "runtime-start-reservation-validation";
}

function runtimeStartReservationValidationHttpFailureV1(
  error: unknown,
  params: unknown,
  body: unknown,
  serverTraceId: string,
): Readonly<{
  statusCode: 403 | 409 | 422 | 500 | 503;
  body: RuntimeStartReservationValidateErrorV1;
}> {
  const path = runtimeStartValidationPathV1(params);
  const validationStage = runtimeStartValidationStageV1(body);
  const traceId = runtimeStartValidationTraceIdV1(body, serverTraceId);
  const bound =
    path.trigger_process_id !== null &&
    path.start_attempt_no !== null &&
    validationStage !== null;
  if (
    (isOwnerRepositoryTransientError(error) ||
      (error instanceof ServiceError && error.statusCode === 503)) &&
    bound
  ) {
    return Object.freeze({
      statusCode: 503 as const,
      body: Object.freeze({
        schema_version: "runtime_start_reservation_validate_error.v1",
        code: "storage_unavailable",
        message: "Runtime Start reservation validation is unavailable",
        retryable: true,
        trace_id: traceId,
        details: Object.freeze({
          trigger_process_id: path.trigger_process_id!,
          start_attempt_no: path.start_attempt_no!,
          validation_stage: validationStage!,
          diagnostic_ref: isOwnerRepositoryTransientError(error)
            ? "runtime_start_reservation_validation:postgres"
            : "runtime_start_reservation_validation:dependency",
        }),
      }),
    });
  }
  if (
    error instanceof RuntimeStartReservationValidationErrorV1 &&
    error.code !== "schema_validation_failed" &&
    error.code !== "storage_unavailable" &&
    error.code !== "internal_error" &&
    bound
  ) {
    return Object.freeze({
      statusCode:
        error.code === "authorization_scope_mismatch"
          ? (403 as const)
          : (409 as const),
      body: Object.freeze({
        schema_version: "runtime_start_reservation_validate_error.v1",
        code: error.code,
        message: "Runtime Start reservation validation failed",
        retryable: false,
        trace_id: traceId,
        details: Object.freeze({
          trigger_process_id: path.trigger_process_id!,
          start_attempt_no: path.start_attempt_no!,
          validation_stage: validationStage!,
        }),
      }),
    });
  }
  if (
    error instanceof RuntimeStartReservationValidationErrorV1 &&
    error.code === "schema_validation_failed"
  ) {
    return Object.freeze({
      statusCode: 422 as const,
      body: Object.freeze({
        schema_version: "runtime_start_reservation_validate_error.v1",
        code: "schema_validation_failed",
        message: "Runtime Start reservation validation request is invalid",
        retryable: false,
        trace_id: traceId,
        details: Object.freeze({
          trigger_process_id: path.trigger_process_id,
          start_attempt_no: path.start_attempt_no,
          validation_stage: validationStage,
          field_path:
            path.trigger_process_id === null || path.start_attempt_no === null
              ? "/path"
              : "/body",
          reason:
            path.trigger_process_id === null || path.start_attempt_no === null
              ? ("malformed_path" as const)
              : ("malformed_request" as const),
        }),
      }),
    });
  }
  if (
    error instanceof ServiceError &&
    (error.statusCode === 401 || error.statusCode === 403) &&
    bound
  ) {
    return Object.freeze({
      statusCode: 403 as const,
      body: Object.freeze({
        schema_version: "runtime_start_reservation_validate_error.v1",
        code: "authorization_scope_mismatch",
        message: "Runtime Start reservation validation caller is not authorized",
        retryable: false,
        trace_id: traceId,
        details: Object.freeze({
          trigger_process_id: path.trigger_process_id!,
          start_attempt_no: path.start_attempt_no!,
          validation_stage: validationStage!,
        }),
      }),
    });
  }
  if (
    !bound ||
    (error instanceof ServiceError &&
      (error.code === "invalid_canonical_json" ||
        error.code === "invalid_request")) ||
    (typeof error === "object" &&
      error !== null &&
      "validation" in error)
  ) {
    const canonicalBoundaryViolation =
      error instanceof ServiceError &&
      error.code === "invalid_canonical_json";
    return Object.freeze({
      statusCode: 422 as const,
      body: Object.freeze({
        schema_version: "runtime_start_reservation_validate_error.v1",
        code: "schema_validation_failed",
        message: "Runtime Start reservation validation request is invalid",
        retryable: false,
        trace_id: traceId,
        details: Object.freeze({
          trigger_process_id: path.trigger_process_id,
          start_attempt_no: path.start_attempt_no,
          validation_stage: validationStage,
          field_path:
            path.trigger_process_id === null || path.start_attempt_no === null
              ? "/path"
              : validationStage === null
                ? "/body/validation_stage"
                : "/body",
          reason:
            path.trigger_process_id === null || path.start_attempt_no === null
              ? ("malformed_path" as const)
              : canonicalBoundaryViolation
                ? ("canonical_boundary_violation" as const)
                : ("malformed_request" as const),
        }),
      }),
    });
  }
  return Object.freeze({
    statusCode: 500 as const,
    body: Object.freeze({
      schema_version: "runtime_start_reservation_validate_error.v1",
      code: "internal_error",
      message: "Runtime Start reservation validation failed internally",
      retryable: false,
      trace_id: traceId,
      details: Object.freeze({
        trigger_process_id: path.trigger_process_id,
        start_attempt_no: path.start_attempt_no,
        validation_stage: validationStage,
        diagnostic_ref: "runtime_start_reservation_validation:internal",
      }),
    }),
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

function processControlHttpError(
  error: unknown,
  route: string | undefined,
): ServiceError | undefined {
  if (route !== processCancelRoute) return undefined;
  if (error instanceof ServiceError) return error;
  if (isOwnerRepositoryTransientError(error)) {
    return ownerRepositoryTransientError(error);
  }
  if (error instanceof InvalidProcessControlRequestV1) {
    if (error.kind === "authorization_denied") {
      return new ServiceError({
        code: "forbidden",
        message: "process cancellation is not authorized",
        statusCode: 403,
        retryable: false,
        details: { policy: "trigger_process_cancel_principal_v1" },
        cause: error,
      });
    }
    if (error.kind === "server_invariant") {
      return new ServiceError({
        code: "internal_error",
        message: "process cancellation invariant failed",
        statusCode: 500,
        retryable: false,
        details: { schema_version: "process-cancel-response.v1" },
        cause: error,
      });
    }
    return new ServiceError({
      code: "invalid_request",
      message: "process cancellation request is invalid",
      statusCode: 400,
      retryable: false,
      details: { schema_version: "process-cancel.v1" },
      cause: error,
    });
  }
  return new ServiceError({
    code: "internal_error",
    message: "internal process cancellation error",
    statusCode: 500,
    retryable: false,
    details: { schema_version: "process-cancel-response.v1" },
    cause: error,
  });
}

function processObservationHttpError(
  error: unknown,
  route: string | undefined,
): ServiceError | undefined {
  if (route !== processGetRoute && route !== processEventsRoute) return undefined;
  if (error instanceof ServiceError) return error;
  if (isOwnerRepositoryTransientError(error)) {
    return ownerRepositoryTransientError(error);
  }
  if (error instanceof TriggerProcessObservationErrorV1) {
    const statusByCode = {
      invalid_replay_cursor: 400,
      bot_permission_denied: 403,
      process_not_found: 404,
      cursor_ahead: 409,
      replay_expired: 410,
      rate_limited: 429,
      credential_expired: 401,
      projection_contract_drift: 500,
    } as const;
    return new ServiceError({
      code: error.code,
      message:
        error.code === "bot_permission_denied" || error.code === "process_not_found"
          ? "Trigger Process is unavailable"
          : `Trigger Process observation failed: ${error.code}`,
      statusCode: statusByCode[error.code],
      retryable: error.code === "rate_limited",
      details:
        error.code === "invalid_replay_cursor"
          ? { schema_version: "trigger_process_sse_request.v1" }
          : {},
      cause: error,
    });
  }
  return new ServiceError({
    code: "internal_error",
    message: "internal Trigger Process observation error",
    statusCode: 500,
    retryable: false,
    details: {},
    cause: error,
  });
}

function delegatedReadPrincipal(
  ingress: VerifiedTriggerIngressV1,
  permissionScope: "trigger.process.read" | "trigger.process.events.read",
): DelegatedProcessReadPrincipalV1 {
  if (ingress.authentication_kind === "supabase_ingress") {
    const { claims, principal } = ingress.credential;
    const expiresAtEpochSeconds = claims.exp;
    if (
      !Number.isSafeInteger(expiresAtEpochSeconds) ||
      expiresAtEpochSeconds === undefined ||
      expiresAtEpochSeconds < 0
    ) {
      throw new TriggerProcessObservationErrorV1("bot_permission_denied");
    }
    return Object.freeze({
      principal_type:
        principal.principal_type === "bot"
          ? "agent"
          : principal.principal_type,
      principal_id: principal.principal_id,
      credential_expires_at_epoch_seconds: expiresAtEpochSeconds,
    });
  }
  const { claims } = ingress.credential;
  if (
    claims.scope_kind !== "bot" ||
    !claims.capability.includes(permissionScope) ||
    (claims.sub !== "timer_trigger_app" &&
      claims.sub !== "observation_gateway")
  ) {
    throw new TriggerProcessObservationErrorV1("bot_permission_denied");
  }
  return Object.freeze({
    principal_type: "service" as const,
    principal_id: claims.sub,
    credential_expires_at_epoch_seconds: claims.exp,
    signed_bot_scope: Object.freeze({
      workspace_id: claims.workspace_id,
      bot_id: claims.bot_id,
      owner_agent_id: claims.owner_agent_id,
      deployment_environment: claims.deployment_environment,
      release_channel: claims.release_channel,
    }),
    ...(claims.sub === "observation_gateway" &&
    claims.capability.includes("trigger.process.snapshot.resolve")
      ? {
          process_snapshot_identity_grant: Object.freeze({
            capability: "trigger.process.snapshot.resolve" as const,
            purpose: "observation_replay" as const,
          }),
        }
      : {}),
    ...(claims.sub === "observation_gateway" &&
    claims.capability.includes("trigger.context_snapshot.resolve")
      ? {
          context_snapshot_identity_grant: Object.freeze({
            capability: "trigger.context_snapshot.resolve" as const,
            purpose: "audit_replay" as const,
          }),
        }
      : {}),
  });
}

function bindCredentialExpiryAbortV1(
  expiresAtEpochSeconds: number,
  controller: AbortController,
): () => void {
  const maximumDelayMs = 2_147_483_647;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    const remainingMs = expiresAtEpochSeconds * 1_000 - Date.now();
    if (remainingMs <= 0) {
      controller.abort();
      return;
    }
    timer = setTimeout(schedule, Math.min(remainingMs, maximumDelayMs));
    timer.unref();
  };
  schedule();
  return () => {
    if (timer !== undefined) clearTimeout(timer);
  };
}

function processCancelStatusCode(
  response: TriggerProcessCancelResponseV1,
): 200 | 202 | 409 {
  switch (response.code) {
    case "cancel_pending":
      return 202;
    case "cancel_accepted":
    case "cancel_replayed":
      return 200;
    case "not_cancellable":
    case "idempotency_conflict":
      return 409;
  }
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

function triggerProcessorCanonicalBoundaryHttpError(
  error: unknown,
  route: string | undefined,
): ServiceError | undefined {
  if (
    !(error instanceof ServiceError) ||
    error.code !== "invalid_canonical_json"
  ) {
    return undefined;
  }
  return new ServiceError({
    code: "invalid_request",
    message: "request body violates the bounded canonical JSON contract",
    statusCode: 400,
    retryable: false,
    details:
      route === "/v1/triggers"
        ? {
            schema_version: "trigger_submit_request.v1",
            field_errors: [
              {
                field_path: "/",
                message: "request body is not bounded canonical JSON",
                expected: "CanonicalJsonV1",
                actual: "rejected_value",
              },
            ],
            submit_attempt_id: null,
          }
        : {},
    cause: error,
  });
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
  processControl?: TriggerProcessControlApplicationV1,
  processObservation?: TriggerProcessObservationApplicationV1,
  internalApplications: TriggerProcessorInternalApplicationsV1 = {},
  compositionRequirements: TriggerProcessorCompositionRequirementsV1 = {},
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
  const internalAuthPolicies: readonly InternalRouteAuthPolicy[] = [
    ...(internalApplications.lifecycle === undefined
      ? []
      : [
          {
            method: "POST",
            route: contextComposeRoute,
            requiredCapabilities: ["trigger.context.compose"],
            allowedCallers: ["trigger_processor"] as const,
            requiredScope: (request: { readonly body?: unknown }) =>
              internalBotScopeV1(request.body),
          },
          {
            method: "POST",
            route: intentSynthesizeRoute,
            requiredCapabilities: ["trigger.intent.synthesize"],
            allowedCallers: ["trigger_processor"] as const,
            requiredScope: (request: { readonly body?: unknown }) =>
              internalBotScopeV1(request.body),
          },
          {
            method: "POST",
            route: runtimeEventAppendRoute,
            requiredCapabilities: ["trigger.process.snapshot.append"],
            allowedCallers: ["action_runtime"] as const,
            requiredScope: authenticatedWorkloadBotScopeV1,
          },
        ]),
    ...(internalApplications.snapshot_read === undefined
      ? []
      : [
          {
            method: "POST",
            route: snapshotResolveRoute,
            requiredCapabilities: ["trigger.process.snapshot.resolve"],
            allowedCallers: [
              "meta_cognition",
              "observation_gateway",
              "trigger_processor",
            ] as const,
            requiredScope: (request: { readonly body?: unknown }) =>
              internalBotScopeV1(request.body),
          },
        ]),
    ...(internalApplications.context_snapshot_read === undefined
      ? []
      : [
          {
            method: "POST",
            route: contextSnapshotResolveRoute,
            requiredCapabilities: ["trigger.context_snapshot.resolve"],
            allowedCallers: [
              "trigger_processor",
              "action_runtime",
              "observation_gateway",
            ] as const,
            requiredScope: (request: { readonly body?: unknown }) =>
              internalBotScopeV1(request.body),
          },
        ]),
    ...(internalApplications.runtime_start_reservation_validation === undefined
      ? []
      : [
          {
            method: "POST",
            route: runtimeStartReservationValidateRoute,
            requiredCapabilities: [
              "trigger.runtime_start.reservation.validate",
            ],
            allowedCallers: ["action_runtime"] as const,
            requiredScope: authenticatedWorkloadBotScopeV1,
          },
        ]),
  ];
  const suppliedPolicies = suppliedServiceOptions.auth?.policies ?? [];
  const serviceAuth =
    suppliedServiceOptions.auth === undefined && internalAuthPolicies.length === 0
      ? undefined
      : Object.freeze({
          ...(suppliedServiceOptions.auth ?? {}),
          ...(workloadIngressVerifier === undefined
            ? {}
            : { verifier: workloadIngressVerifier }),
          policies: Object.freeze([
            ...suppliedPolicies,
            ...internalAuthPolicies,
          ]),
        });
  const missingRequiredApplications = Object.freeze([
    ...(triggerAdmission === undefined ? ["trigger_admission"] : []),
    ...(processControl === undefined ? ["process_control"] : []),
    ...(processObservation === undefined ? ["process_observation"] : []),
    ...(internalApplications.confirmation_response === undefined
      ? ["confirmation_response"]
      : []),
    ...(internalApplications.lifecycle === undefined ? ["lifecycle"] : []),
    ...(internalApplications.context_snapshot_read === undefined
      ? ["context_snapshot_read"]
      : []),
    ...(internalApplications.snapshot_read === undefined ? ["snapshot_read"] : []),
    ...(internalApplications.runtime_start_reservation_validation === undefined
      ? ["runtime_start_reservation_validation"]
      : []),
    ...(internalApplications.recovery_runner === undefined
      ? ["recovery_runner"]
      : []),
  ]);
  const serviceOptions = Object.freeze({
    ...suppliedServiceOptions,
    ...(serviceAuth === undefined ? {} : { auth: serviceAuth }),
    ...(!compositionRequirements.require_complete_pipeline &&
    internalApplications.recovery_runner === undefined
      ? {}
      : {
          readinessChecks: Object.freeze([
            ...(suppliedServiceOptions.readinessChecks ?? []),
            ...(compositionRequirements.require_complete_pipeline
              ? [
                  {
                    name: "trigger_pipeline",
                    async check() {
                      if (missingRequiredApplications.length !== 0) {
                        throw new Error(
                          `Trigger Processor pipeline dependencies are missing: ${missingRequiredApplications.join(",")}`,
                        );
                      }
                    },
                  },
                ]
              : []),
            ...(internalApplications.recovery_runner === undefined
              ? []
              : [
                  {
                    name: "trigger_recovery",
                    async check() {
                      if (internalApplications.recovery_runner?.state !== "running") {
                        throw new Error(
                          "Trigger Process recovery runner is not running",
                        );
                      }
                    },
                  },
                ]),
          ]),
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
      const canonical =
        triggerProcessorCanonicalBoundaryHttpError(
          error,
          request.routeOptions.url,
        ) ??
        processObservationHttpError(error, request.routeOptions.url) ??
        confirmationResponseHttpErrorV1(error) ??
        processControlHttpError(error, request.routeOptions.url) ??
        triggerAdmissionHttpError(error, request.routeOptions.url);
      if (canonical === undefined) {
        return serviceOptions.errorMapper?.(error, request);
      }
      if (request.routeOptions.url === processCancelRoute) {
        return canonical;
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
  app.addHook("preValidation", async (request) => {
    if (request.body === undefined) return;
    try {
      // Fastify/Ajv validation is recursive. Establish the shared bounded,
      // getter-free JSON boundary before any route schema walks the body.
      canonicalJsonV1(request.body);
    } catch (error) {
      throw new ServiceError({
        code: "invalid_request",
        message: "request body violates the bounded canonical JSON contract",
        statusCode: 400,
        retryable: false,
        details:
          request.routeOptions.url === "/v1/triggers"
            ? {
                schema_version: "trigger_submit_request.v1",
                field_errors: [
                  {
                    field_path: "/",
                    message: "request body is not bounded canonical JSON",
                    expected: "CanonicalJsonV1",
                    actual: "rejected_value",
                  },
                ],
                submit_attempt_id: null,
              }
            : {},
        cause: error,
      });
    }
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
              withServerTraceV1(
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
  if (processControl !== undefined) {
    app.addHook("onRequest", async (request) => {
      if (
        request.method !== "POST" ||
        request.routeOptions.url !== processCancelRoute
      ) {
        return;
      }
      if (supabaseIngressVerifier === undefined) {
        throw new ServiceError({
          code: "unauthenticated",
          message: "Supabase process-control ingress is unavailable",
          statusCode: 401,
          retryable: false,
          details: {},
        });
      }
      try {
        const credential = await supabaseIngressVerifier.verify(
          triggerBearerToken(request),
        );
        triggerIngressContexts.set(
          request,
          Object.freeze({
            authentication_kind: "supabase_ingress" as const,
            credential: snapshotVerifiedSupabaseIngressV1(credential),
          }),
        );
      } catch (error) {
        if (error instanceof ServiceError) throw error;
        throw new ServiceError({
          code: "unauthenticated",
          message: "process-control credential was rejected",
          statusCode: 401,
          retryable: false,
          details: {},
          cause: error,
        });
      }
    });
    app.post(
      processCancelRoute,
      {
        schema: {
          body: TriggerProcessCancelRequestV1Schema,
          response: {
            200: TriggerProcessCancelResponseV1Schema,
            202: TriggerProcessCancelResponseV1Schema,
            409: TriggerProcessCancelResponseV1Schema,
          },
        },
      },
      async (request, reply) => {
        const params = request.params as Readonly<{ id?: unknown }>;
        if (typeof params.id !== "string") {
          throw new InvalidProcessControlRequestV1(
            "process id path parameter is invalid",
          );
        }
        const response = await processControl.cancel(
          getTriggerIngressContext(request),
          params.id,
          request.body,
          request.id,
        );
        return reply.code(processCancelStatusCode(response)).send(response);
      },
    );
  }
  if (internalApplications.confirmation_response !== undefined) {
    const confirmationResponse = internalApplications.confirmation_response;
    app.addHook("onRequest", async (request) => {
      if (
        request.method !== "POST" ||
        request.routeOptions.url !== confirmationResponseRoute
      ) {
        return;
      }
      if (supabaseIngressVerifier === undefined) {
        throw new ServiceError({
          code: "unauthenticated",
          message: "Supabase confirmation ingress is unavailable",
          statusCode: 401,
          retryable: false,
          details: {},
        });
      }
      try {
        const credential = await supabaseIngressVerifier.verify(
          triggerBearerToken(request),
        );
        triggerIngressContexts.set(
          request,
          Object.freeze({
            authentication_kind: "supabase_ingress" as const,
            credential: snapshotVerifiedSupabaseIngressV1(credential),
          }),
        );
      } catch (error) {
        if (error instanceof ServiceError) throw error;
        throw new ServiceError({
          code: "unauthenticated",
          message: "confirmation credential was rejected",
          statusCode: 401,
          retryable: false,
          details: {},
          cause: error,
        });
      }
    });
    app.post(
      confirmationResponseRoute,
      {
        schema: {
          body: TriggerConfirmationResponseV1Schema,
          response: { 200: TriggerConfirmationResponseResultV1Schema },
        },
      },
      async (request, reply) => {
        const params = request.params as Readonly<{
          id?: unknown;
          challengeId?: unknown;
        }>;
        if (
          typeof params.id !== "string" ||
          typeof params.challengeId !== "string"
        ) {
          throw new TriggerConfirmationResponseErrorV1(
            "schema_validation_failed",
          );
        }
        const response = await confirmationResponse.respond(
          getTriggerIngressContext(request),
          params.id,
          params.challengeId,
          request.body,
        );
        return reply.code(200).send(response);
      },
    );
  }
  if (processObservation !== undefined) {
    app.addHook("onRequest", async (request) => {
      if (
        request.method !== "GET" ||
        (request.routeOptions.url !== processGetRoute &&
          request.routeOptions.url !== processEventsRoute)
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
    app.get(
      processGetRoute,
      {
        schema: {
          response: { 200: TriggerProcessGetResponseV1Schema },
        },
      },
      async (request, reply) => {
        const params = request.params as Readonly<{ id?: unknown }>;
        if (typeof params.id !== "string") {
          throw new TriggerProcessObservationErrorV1("process_not_found");
        }
        const principal = delegatedReadPrincipal(
          getTriggerIngressContext(request),
          "trigger.process.read",
        );
        const response = await processObservation.getProcess(
          principal,
          params.id,
          request.id,
        );
        return reply.code(200).send(response);
      },
    );
    app.get(
      processEventsRoute,
      async (request, reply) => {
        const params = request.params as Readonly<{ id?: unknown }>;
        const query = request.query as Readonly<Record<string, unknown>>;
        const queryKeys = Object.keys(query);
        if (
          typeof params.id !== "string" ||
          queryKeys.some((key) => key !== "start_after_append_sequence_no")
        ) {
          throw new TriggerProcessObservationErrorV1("invalid_replay_cursor");
        }
        const rawCursor = query.start_after_append_sequence_no;
        let queryCursor: number | undefined;
        if (rawCursor !== undefined) {
          if (
            typeof rawCursor !== "string" ||
            !/^(?:0|[1-9][0-9]*)$/u.test(rawCursor) ||
            !Number.isSafeInteger(Number(rawCursor))
          ) {
            throw new TriggerProcessObservationErrorV1("invalid_replay_cursor");
          }
          queryCursor = Number(rawCursor);
        }
        const rawLastEventId = request.headers["last-event-id"];
        if (
          rawLastEventId !== undefined &&
          typeof rawLastEventId !== "string"
        ) {
          throw new TriggerProcessObservationErrorV1("invalid_replay_cursor");
        }
        const sseRequest = {
          schema_version: "trigger_process_sse_request.v1" as const,
          trigger_process_id: params.id,
          ...(rawLastEventId === undefined
            ? {}
            : { last_event_id: rawLastEventId }),
          ...(queryCursor === undefined
            ? {}
            : { start_after_append_sequence_no: queryCursor }),
        };
        if (!Value.Check(TriggerProcessSseRequestV1Schema, sseRequest)) {
          throw new TriggerProcessObservationErrorV1("invalid_replay_cursor");
        }
        const controller = new AbortController();
        const close = () => controller.abort();
        request.raw.once("aborted", close);
        reply.raw.once("close", close);
        const principal = delegatedReadPrincipal(
          getTriggerIngressContext(request),
          "trigger.process.events.read",
        );
        const unbindCredentialExpiry = bindCredentialExpiryAbortV1(
          principal.credential_expires_at_epoch_seconds,
          controller,
        );
        try {
          const stream = await processObservation.streamProcessEvents(
            principal,
            sseRequest,
            controller.signal,
          );
          reply.hijack();
          reply.raw.writeHead(200, {
            "content-type": "text/event-stream; charset=utf-8",
            "cache-control": "no-cache, no-transform",
            connection: "keep-alive",
            "x-accel-buffering": "no",
          });
          for await (const frame of stream) {
            if (
              controller.signal.aborted ||
              Date.now() >=
                principal.credential_expires_at_epoch_seconds * 1_000
            ) {
              break;
            }
            if (!reply.raw.write(frame)) {
              if (!(await waitForDrainOrCloseV1(reply.raw, controller.signal))) {
                break;
              }
            }
          }
        } finally {
          unbindCredentialExpiry();
          controller.abort();
          if (!reply.raw.destroyed) reply.raw.end();
        }
      },
    );
  }
  if (internalApplications.lifecycle !== undefined) {
    const lifecycle = internalApplications.lifecycle;
    app.post(
      contextComposeRoute,
      {
        schema: {
          body: inlineFastifySchemaV1(ContextComposeRequestV1Schema),
          response: { 200: inlineFastifySchemaV1(ContextComposeResponseV1Schema) },
        },
      },
      async (request, reply) => {
        try {
          return reply.code(200).send(
            await lifecycle.composeContext(
              snapshotInternalRequestV1(request.body),
              requiredWorkClaimV1(request.headers),
            ),
          );
        } catch (error) {
          throw lifecycleHttpErrorV1(error);
        }
      },
    );
    app.post(
      intentSynthesizeRoute,
      {
        schema: {
          body: inlineFastifySchemaV1(IntentSynthesizeRequestV1Schema),
          response: { 200: inlineFastifySchemaV1(IntentSynthesizeResponseV1Schema) },
        },
      },
      async (request, reply) => {
        try {
          return reply.code(200).send(
            await lifecycle.synthesizeIntent(
              snapshotInternalRequestV1(request.body),
              requiredWorkClaimV1(request.headers),
            ),
          );
        } catch (error) {
          throw lifecycleHttpErrorV1(error);
        }
      },
    );
    app.post(
      runtimeEventAppendRoute,
      {
        schema: {
          body: inlineFastifySchemaV1(RuntimeEventAppendRequestV1Schema),
          response: { 200: inlineFastifySchemaV1(RuntimeEventAppendResponseV1Schema) },
        },
      },
      async (request, reply) => {
        const params = request.params as Readonly<{ id?: unknown }>;
        const body = request.body as Readonly<{ trigger_process_id?: unknown }>;
        if (
          typeof params.id !== "string" ||
          body.trigger_process_id !== params.id
        ) {
          throw new ServiceError({
            code: "invalid_request",
            message: "runtime event path and process identity differ",
            statusCode: 400,
            retryable: false,
            details: {},
          });
        }
        const credential = getWorkloadAuthContext(request);
        const claims = credential.claims;
        if (claims.scope_kind !== "bot") {
          throw new ServiceError({
            code: "authorization_scope_mismatch",
            message: "runtime event append requires a bot-scoped workload",
            statusCode: 403,
            retryable: false,
            details: {},
          });
        }
        try {
          return reply.code(200).send(
            await lifecycle.appendRuntimeEvent({
              request: snapshotInternalRequestV1(request.body),
              authenticated_principal: {
                sub: "action_runtime",
                aud: "trigger_processor",
                capability: claims.capability,
                scope_kind: "bot",
                workspace_id: claims.workspace_id,
                bot_id: claims.bot_id,
                owner_agent_id: claims.owner_agent_id,
                deployment_environment: claims.deployment_environment,
                release_channel: claims.release_channel,
              },
            }),
          );
        } catch (error) {
          throw lifecycleHttpErrorV1(error);
        }
      },
    );
  }
  if (internalApplications.snapshot_read !== undefined) {
    const snapshotRead = internalApplications.snapshot_read;
    app.post(
      snapshotResolveRoute,
      {
        schema: {
          body: inlineFastifySchemaV1(TriggerProcessSnapshotResolveRequestV1Schema),
          response: { 200: inlineFastifySchemaV1(TriggerProcessSnapshotReadContractV1Schema) },
        },
      },
      async (request, reply) => {
        const credential = getWorkloadAuthContext(request);
        const claims = credential.claims;
        if (claims.scope_kind !== "bot") {
          throw new ServiceError({
            code: "snapshot_scope_mismatch",
            message: "snapshot resolve requires a bot-scoped workload",
            statusCode: 403,
            retryable: false,
            details: {},
          });
        }
        try {
          return reply.code(200).send(
            await snapshotRead.resolve(
              {
                service_id: claims.sub as
                  | "meta_cognition"
                  | "observation_gateway"
                  | "trigger_processor",
                capability: "trigger.process.snapshot.resolve",
                scope: {
                  workspace_id: claims.workspace_id,
                  bot_id: claims.bot_id,
                  owner_agent_id: claims.owner_agent_id,
                  deployment_environment: claims.deployment_environment,
                  release_channel: claims.release_channel,
                },
              },
              snapshotInternalRequestV1(request.body),
            ),
          );
        } catch (error) {
          throw snapshotResolveHttpErrorV1(error);
        }
      },
    );
  }
  if (internalApplications.context_snapshot_read !== undefined) {
    const contextSnapshotRead = internalApplications.context_snapshot_read;
    app.post(
      contextSnapshotResolveRoute,
      {
        schema: {
          body: inlineFastifySchemaV1(ContextSnapshotResolveRequestV1Schema),
          response: {
            200: inlineFastifySchemaV1(ContextSnapshotReadContractV1Schema),
            403: inlineFastifySchemaV1(ContextSnapshotReadErrorV1Schema),
            404: inlineFastifySchemaV1(ContextSnapshotReadErrorV1Schema),
            409: inlineFastifySchemaV1(ContextSnapshotReadErrorV1Schema),
            410: inlineFastifySchemaV1(ContextSnapshotReadErrorV1Schema),
            422: inlineFastifySchemaV1(ContextSnapshotReadErrorV1Schema),
          },
        },
      },
      async (request, reply) => {
        const claims = getWorkloadAuthContext(request).claims;
        if (claims.scope_kind !== "bot") {
          throw new ServiceError({
            code: "bot_permission_denied",
            message: "Context snapshot resolve requires a bot-scoped workload",
            statusCode: 403,
            retryable: false,
            details: {},
          });
        }
        try {
          return reply.code(200).send(
            await contextSnapshotRead.resolve(
              {
                service_id: claims.sub as
                  | "trigger_processor"
                  | "action_runtime"
                  | "observation_gateway",
                aud: "trigger_processor",
                capability: claims.capability,
                scope: {
                  workspace_id: claims.workspace_id,
                  bot_id: claims.bot_id,
                  owner_agent_id: claims.owner_agent_id,
                  deployment_environment: claims.deployment_environment,
                  release_channel: claims.release_channel,
                },
              },
              snapshotInternalRequestV1(request.body),
            ),
          );
        } catch (error) {
          const mapped = contextSnapshotResolveDomainErrorV1(
            error,
            request.body,
          );
          return reply.code(mapped.statusCode).send(mapped.body);
        }
      },
    );
  }
  if (internalApplications.runtime_start_reservation_validation !== undefined) {
    const validation =
      internalApplications.runtime_start_reservation_validation;
    app.post(
      runtimeStartReservationValidateRoute,
      {
        errorHandler(error, request, reply) {
          const failure =
            runtimeStartReservationValidationHttpFailureV1(
              error,
              request.params,
              request.body,
              request.id,
            );
          return reply.code(failure.statusCode).send(failure.body);
        },
        schema: {
          params: {
            type: "object",
            additionalProperties: false,
            required: ["id", "attempt"],
            properties: {
              id: { type: "string", minLength: 1, maxLength: 256 },
              attempt: { type: "string", pattern: "^[1-9][0-9]*$" },
            },
          },
          body: inlineFastifySchemaV1(
            RuntimeStartReservationValidateRequestV1Schema,
          ),
          response: {
            200: inlineFastifySchemaV1(
              RuntimeStartReservationValidateResponseV1Schema,
            ),
            422: inlineFastifySchemaV1(
              RuntimeStartReservationValidateErrorV1Schema,
            ),
            403: inlineFastifySchemaV1(
              RuntimeStartReservationValidateErrorV1Schema,
            ),
            409: inlineFastifySchemaV1(
              RuntimeStartReservationValidateErrorV1Schema,
            ),
            500: inlineFastifySchemaV1(
              RuntimeStartReservationValidateErrorV1Schema,
            ),
            503: inlineFastifySchemaV1(
              RuntimeStartReservationValidateErrorV1Schema,
            ),
          },
        },
      },
      async (request, reply) => {
        const params = request.params as Readonly<{
          id: string;
          attempt: string;
        }>;
        const startAttemptNo = Number(params.attempt);
        if (!Number.isSafeInteger(startAttemptNo) || startAttemptNo < 1) {
          throw new RuntimeStartReservationValidationErrorV1(
            "schema_validation_failed",
          );
        }
        const claims = getWorkloadAuthContext(request).claims;
        if (claims.scope_kind !== "bot") {
          throw new RuntimeStartReservationValidationErrorV1(
            "authorization_scope_mismatch",
          );
        }
        try {
          return reply.code(200).send(
            await validation.validate(
              {
                sub: "action_runtime",
                aud: "trigger_processor",
                capability: claims.capability,
                scope_kind: "bot",
                workspace_id: claims.workspace_id,
                bot_id: claims.bot_id,
                owner_agent_id: claims.owner_agent_id,
                deployment_environment: claims.deployment_environment,
                release_channel: claims.release_channel,
              },
              {
                trigger_process_id: params.id,
                start_attempt_no: startAttemptNo,
              },
              snapshotInternalRequestV1(request.body),
            ),
          );
        } catch (error) {
          throw error;
        }
      },
    );
  }
  if (internalApplications.recovery_runner !== undefined) {
    const recoveryRunner = internalApplications.recovery_runner;
    app.addHook("onReady", () => recoveryRunner.start());
    app.addHook("onClose", () => recoveryRunner.stop());
  }
  return app;
}

function withServerTraceV1(
  body: unknown,
  traceId: string,
): unknown {
  return typeof body === "object" && body !== null
    ? { ...body, trace_id: traceId }
    : body;
}

function snapshotInternalRequestV1(body: unknown): unknown {
  return typeof body === "object" && body !== null && !Array.isArray(body)
    ? { ...body }
    : body;
}
