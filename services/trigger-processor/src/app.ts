import type { BotAuthorizationScopeV1 } from "@pai/auth";
import {
  AdmitTriggerRequestBodyV1Schema,
  AdmitTriggerResponseV1Schema,
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

const admissionRoutes = [
  {
    source: "chat",
    route: "/internal/v1/triggers/admit/chat",
    capability: "trigger.submit.chat",
    caller: "observation_gateway",
  },
  {
    source: "notification",
    route: "/internal/v1/triggers/admit/notification",
    capability: "trigger.submit.notification",
    caller: "observation_gateway",
  },
  {
    source: "timer",
    route: "/internal/v1/triggers/admit/timer",
    capability: "trigger.submit.timer",
    caller: "timer_trigger_app",
  },
] as const;

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
    ({ route, capability, caller }) => ({
      method: "POST",
      route,
      requiredCapabilities: [capability],
      allowedCallers: [caller],
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
  const denied = error.kind === "authorization_denied";
  return new ServiceError({
    code: denied ? "authorization_scope_mismatch" : "invalid_request",
    message: denied ? "workload authorization failed" : "request validation failed",
    statusCode: denied ? 403 : 400,
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
): 200 | 409 | 500 | 503 {
  switch (response.code) {
    case "trigger_accepted":
    case "trigger_rejected":
      return 200;
    case "idempotency_conflict":
    case "stale_admission_fence":
      return 409;
    case "serialization_retry_exhausted":
    case "transient_database_error":
    case "service_unavailable":
      return 503;
    case "invalid_request":
    case "unauthenticated":
    case "authorization_denied":
    case "capability_denied":
    case "authorization_scope_mismatch":
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
    for (const { source, route } of admissionRoutes) {
      app.post(
        route,
        {
          schema: {
            body: AdmitTriggerRequestBodyV1Schema,
            response: {
              200: AdmitTriggerResponseV1Schema,
              400: AdmitTriggerResponseV1Schema,
              401: AdmitTriggerResponseV1Schema,
              403: AdmitTriggerResponseV1Schema,
              409: AdmitTriggerResponseV1Schema,
              500: AdmitTriggerResponseV1Schema,
              503: AdmitTriggerResponseV1Schema,
            },
          },
        },
        async (request, reply) => {
          try {
            const response = await triggerAdmission.admit(
              getWorkloadAuthContext(request),
              withAuthenticatedRouteContext(request.body, source, request.id),
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
