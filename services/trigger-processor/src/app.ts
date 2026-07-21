import type { BotAuthorizationScopeV1 } from "@pai/auth";
import {
  AdmitTriggerRequestBodyV1Schema,
  AdmitTriggerResponseV1Schema,
  type TriggerSourceV1,
} from "@pai/contracts";
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
              202: AdmitTriggerResponseV1Schema,
            },
          },
        },
        async (request) => {
          try {
            return await triggerAdmission.admit(
              getWorkloadAuthContext(request),
              withAuthenticatedRouteContext(request.body, source, request.id),
            );
          } catch (error) {
            if (error instanceof InvalidAdmitTriggerCommandError) {
              throw admissionError(error);
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
