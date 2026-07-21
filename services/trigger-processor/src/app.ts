import type { BotAuthorizationScopeV1 } from "@pai/auth";
import type { TriggerSourceV1 } from "@pai/contracts";
import {
  createServiceApp,
  getWorkloadAuthContext,
  type InternalRouteAuthPolicy,
  type ServiceAppOptions,
} from "@pai/service-kit";

import {
  type TriggerAdmissionApplicationV1,
} from "./application/trigger-admission.v1.js";

export function buildTriggerProcessorApp(
  options: ServiceAppOptions = {},
  triggerAdmission?: TriggerAdmissionApplicationV1,
): ReturnType<typeof createServiceApp> {
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
  const requiredScope = (request: {
    readonly body?: unknown;
  }): BotAuthorizationScopeV1 => {
    const body = request.body;
    if (
      typeof body !== "object" ||
      body === null ||
      !("scope" in body) ||
      typeof body.scope !== "object" ||
      body.scope === null
    ) {
      throw new Error("admission command bot scope is required");
    }
    return body.scope as BotAuthorizationScopeV1;
  };
  const policies: InternalRouteAuthPolicy[] = admissionRoutes.map(
    ({ route, capability, caller }) => ({
      method: "POST",
      route,
      requiredCapabilities: [capability],
      allowedCallers: [caller],
      requiredScope,
    }),
  );
  const app = createServiceApp("trigger_processor", {
    ...options,
    auth: {
      ...(options.auth?.verifier === undefined
        ? {}
        : { verifier: options.auth.verifier }),
      policies: [...(options.auth?.policies ?? []), ...policies],
    },
  });
  if (triggerAdmission !== undefined) {
    app.decorate("triggerAdmission", triggerAdmission);
    for (const { source, route } of admissionRoutes) {
      app.post(route, async (request) =>
        triggerAdmission.admit(
          getWorkloadAuthContext(request),
          withAuthenticatedSource(request.body, source),
        ),
      );
    }
  }
  return app;
}

function withAuthenticatedSource(
  body: unknown,
  source: TriggerSourceV1,
): unknown {
  return typeof body === "object" && body !== null
    ? { ...body, source }
    : body;
}
