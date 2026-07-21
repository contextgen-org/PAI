import type { BotAuthorizationScopeV1 } from "@pai/auth";
import {
  AdmitTriggerRequestBodyV1Schema,
  TRIGGER_PROCESSOR_HTTP_OPERATIONS_V1,
  type AdmitTriggerResponseV1,
  type TriggerSourceV1,
} from "@pai/contracts";
import { OwnerRepositoryTransientErrorV1 } from "@pai/persistence";
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
} from "./application/trigger-admission.v1.js";

const admissionRoutes = TRIGGER_PROCESSOR_HTTP_OPERATIONS_V1;

function requiredAdmissionScope(request: {
  readonly body?: unknown;
}): BotAuthorizationScopeV1 {
  const body = request.body;
  if (
    typeof body !== "object" ||
    body === null ||
    !("scope" in body) ||
    typeof body.scope !== "object" ||
    body.scope === null
  ) {
    throw new ServiceError({
      code: "invalid_request",
      message: "admission command bot scope is required",
      statusCode: 400,
      retryable: false,
      details: { schema_version: "admit_trigger_request_body.v1" },
    });
  }
  return body.scope as BotAuthorizationScopeV1;
}

export const TRIGGER_ADMISSION_INTERNAL_AUTH_POLICIES_V1 =
  admissionRoutes.map(
    ({ path, required_capability, allowed_caller }) => ({
      method: "POST",
      route: path,
      requiredCapabilities: [required_capability],
      allowedCallers: [allowed_caller],
      requiredScope: requiredAdmissionScope,
    }),
  ) satisfies readonly InternalRouteAuthPolicy[];

function mergeInternalPolicies(
  first: readonly InternalRouteAuthPolicy[],
  second: readonly InternalRouteAuthPolicy[],
): readonly InternalRouteAuthPolicy[] {
  const byRoute = new Map<string, InternalRouteAuthPolicy>();
  for (const policy of [...first, ...second]) {
    byRoute.set(`${policy.method.toUpperCase()} ${policy.route}`, policy);
  }
  return [...byRoute.values()];
}

function admissionError(error: InvalidAdmitTriggerCommandError): ServiceError {
  if (error.kind === "server_invariant") {
    return new ServiceError({
      code: "internal_error",
      message: "admission writer violated its canonical response contract",
      statusCode: 500,
      retryable: false,
      details: {
        schema_version: "admit_trigger_response.v1",
        reason: error.message,
      },
      cause: error,
    });
  }
  if (error.kind === "capability_denied") {
    return new ServiceError({
      code: "capability_denied",
      message: "workload capability check failed",
      statusCode: 403,
      retryable: false,
      details: {
        schema_version: "admit_trigger_command.v1",
        reason: error.message,
      },
      cause: error,
    });
  }
  if (error.kind === "authorization_denied") {
    return new ServiceError({
      code: "authorization_denied",
      message: "workload authorization failed",
      statusCode: 403,
      retryable: false,
      details: {
        schema_version: "admit_trigger_command.v1",
        reason: error.message,
      },
      cause: error,
    });
  }
  if (error.kind === "authorization_scope_mismatch") {
    return new ServiceError({
      code: "authorization_scope_mismatch",
      message: "workload authorization scope mismatch",
      statusCode: 403,
      retryable: false,
      details: {
        schema_version: "admit_trigger_command.v1",
        reason: error.message,
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
      schema_version: "admit_trigger_command.v1",
      reason: error.message,
    },
    cause: error,
  });
}

function admissionResponseStatusCode(
  response: AdmitTriggerResponseV1,
): 200 | 400 | 401 | 403 | 409 | 500 | 503 {
  switch (response.code) {
    case "trigger_accepted":
    case "trigger_rejected":
      return 200;
    case "idempotency_conflict":
    case "stale_admission_fence":
      return 409;
    case "invalid_request":
      return 400;
    case "unauthenticated":
      return 401;
    case "authorization_denied":
    case "capability_denied":
    case "authorization_scope_mismatch":
      return 403;
    case "serialization_retry_exhausted":
    case "transient_database_error":
    case "service_unavailable":
      return 503;
    case "internal_error":
      return 500;
  }
}

function ownerRepositoryTransientError(
  error: OwnerRepositoryTransientErrorV1,
): ServiceError {
  return new ServiceError({
    code: error.code,
    message: "owner repository operation should be retried",
    statusCode: 503,
    retryable: true,
    details: {
      owner_service: "trigger_processor",
      reason: error.message,
    },
    cause: error,
  });
}

export function buildTriggerProcessorApp(
  options: ServiceAppOptions = {},
  triggerAdmission?: TriggerAdmissionApplicationV1,
): ReturnType<typeof createServiceApp> {
  const app = createServiceApp("trigger_processor", {
    ...options,
    auth: {
      ...(options.auth?.verifier === undefined
        ? {}
        : { verifier: options.auth.verifier }),
      policies: mergeInternalPolicies(
        options.auth?.policies ?? [],
        TRIGGER_ADMISSION_INTERNAL_AUTH_POLICIES_V1,
      ),
    },
  });
  if (triggerAdmission !== undefined) {
    app.decorate("triggerAdmission", triggerAdmission);
    for (const operation of admissionRoutes) {
      app.post(
        operation.path,
        {
          schema: {
            body: AdmitTriggerRequestBodyV1Schema,
            response: operation.response_schemas_by_status,
          },
        },
        async (request, reply) => {
          try {
            const response = await triggerAdmission.admit(
              getWorkloadAuthContext(request),
              withAuthenticatedRouteContext(
                request.body,
                operation.source,
                request.id,
              ),
            );
            return reply.code(admissionResponseStatusCode(response)).send(response);
          } catch (error) {
            if (error instanceof InvalidAdmitTriggerCommandError) {
              throw admissionError(error);
            }
            if (error instanceof OwnerRepositoryTransientErrorV1) {
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
  source: TriggerSourceV1,
  traceId: string,
): unknown {
  return typeof body === "object" && body !== null
    ? { ...body, source, trace_id: traceId }
    : body;
}
