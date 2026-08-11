import { type Static, type TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import {
  TimerDispatchRequestV1Schema,
  TimerDispatchResponseV1Schema,
} from "@pai/contracts/timer/dispatch-request.v1";
import {
  TimerCatchUpAdvanceRequestV1Schema,
  TimerCatchUpAdvanceResponseV1Schema,
  TimerCatchUpCreateRequestV1Schema,
  TimerCatchUpCreateResponseV1Schema,
  TimerIdPathParamsV1Schema,
  TimerOccurrenceClaimRequestV1Schema,
  TimerOccurrenceClaimResponseV1Schema,
  TimerScanDueRequestV1Schema,
  TimerScanDueResponseV1Schema,
  TimerScheduleHistoryQueryParamsV1Schema,
  TimerScheduleListQueryParamsV1Schema,
  TimerScheduleReadQueryParamsV1Schema,
} from "@pai/contracts/timer/http-routes.v1";
import {
  TimerOccurrenceSnoozeCommandV1Schema,
  TimerOccurrenceSnoozeResponseV1Schema,
  TimerScheduleCancelCommandV1Schema,
  TimerScheduleCancelResponseV1Schema,
  TimerScheduleCreateCommandV1Schema,
  TimerScheduleCreateResponseV1Schema,
  TimerSchedulePauseCommandV1Schema,
  TimerSchedulePauseResponseV1Schema,
  TimerScheduleResumeCommandV1Schema,
  TimerScheduleResumeResponseV1Schema,
  TimerScheduleUpdateCommandV1Schema,
  TimerScheduleUpdateResponseV1Schema,
} from "@pai/contracts/timer/schedule-command.v1";
import { TimerScheduleQueryResponseV1Schema } from "@pai/contracts/timer/schedule-query-response.v1";
import {
  createServiceApp,
  getWorkloadAuthContext,
  ServiceError,
  type InternalRouteAuthPolicy,
  type ServiceAppOptions,
} from "@pai/service-kit";

import {
  canonicalJsonV1,
  TimerApplicationErrorV1,
  type TimerApplicationV1,
  type TimerPrincipalV1,
} from "./timer-application.v1.js";
import {
  timerOwnerIdentityFromPrincipalV1,
  toTimerApplicationCatchUpAdvanceV1,
  toTimerApplicationCatchUpCreateV1,
  toTimerApplicationCommandV1,
  toTimerApplicationDispatchV1,
  toTimerApplicationOccurrenceClaimV1,
  toTimerApplicationQueryV1,
  toTimerApplicationScanRequestV1,
  toTimerOwnerCommandResponseV1,
  toTimerOwnerCatchUpAdvanceResponseV1,
  toTimerOwnerCatchUpBatchV1,
  toTimerOwnerDispatchResponseV1,
  toTimerOwnerOccurrenceClaimV1,
  toTimerOwnerOccurrenceV1,
  toTimerOwnerQueryResponseV1,
} from "./timer-owner-contract-adapter.v1.js";

const routes = Object.freeze({
  create: "/internal/agent-timers",
  update: "/internal/agent-timers/:id",
  pause: "/internal/agent-timers/:id/pause",
  resume: "/internal/agent-timers/:id/resume",
  cancel: "/internal/agent-timers/:id/cancel",
  snooze: "/internal/timer-occurrences/:id/snooze",
  list: "/internal/agent-timers",
  get: "/internal/agent-timers/:id",
  history: "/internal/agent-timers/:id/history",
  scan: "/internal/timers/scan-due",
  claim: "/internal/timer-occurrences/:id/claim",
  dispatch: "/internal/timer-occurrences/:id/dispatch",
  catchUpCreate: "/internal/timer-catch-up-batches",
  catchUpAdvance: "/internal/timer-catch-up-batches/:id/advance",
} as const);

export interface TimerTriggerApplicationsV1 {
  readonly timer?: TimerApplicationV1;
}

export interface TimerTriggerBuildOptionsV1 {
  readonly require_complete_pipeline?: boolean;
}

function verifiedScope(request: Parameters<typeof getWorkloadAuthContext>[0]) {
  const claims = getWorkloadAuthContext(request).claims;
  if (claims.scope_kind !== "bot") {
    throw new Error("Timer requires a bot-scoped workload");
  }
  return {
    scope_kind: "bot" as const,
    workspace_id: claims.workspace_id,
    bot_id: claims.bot_id,
    owner_agent_id: claims.owner_agent_id,
    deployment_environment: claims.deployment_environment,
    release_channel: claims.release_channel,
  };
}

function principal(
  request: Parameters<typeof getWorkloadAuthContext>[0],
): TimerPrincipalV1 {
  const claims = getWorkloadAuthContext(request).claims;
  if (
    claims.scope_kind !== "bot" ||
    (claims.sub !== "action_runtime" &&
      claims.sub !== "timer_trigger_app" &&
      claims.sub !== "trigger_processor")
  ) {
    throw new TimerApplicationErrorV1(
      "forbidden",
      "unsupported Timer workload identity",
    );
  }
  return Object.freeze({
    caller: claims.sub,
    capabilities: Object.freeze([...claims.capability]),
    scope: Object.freeze({
      workspace_id: claims.workspace_id,
      bot_id: claims.bot_id,
      owner_agent_id: claims.owner_agent_id,
      deployment_environment: claims.deployment_environment,
      release_channel: claims.release_channel,
    }),
  });
}

function policies(): readonly InternalRouteAuthPolicy[] {
  const policy = (
    method: string,
    route: InternalRouteAuthPolicy["route"],
    capability: string,
    callers: readonly ("action_runtime" | "timer_trigger_app" | "trigger_processor")[],
  ): InternalRouteAuthPolicy =>
    Object.freeze({
      method,
      route,
      requiredCapabilities: Object.freeze([capability]),
      allowedCallers: Object.freeze([...callers]),
      requiredScope: verifiedScope,
    });
  return Object.freeze([
    policy("POST", routes.create, "timer.write", ["action_runtime"]),
    policy("PATCH", routes.update, "timer.write", ["action_runtime"]),
    policy("POST", routes.pause, "timer.write", ["action_runtime"]),
    policy("POST", routes.resume, "timer.write", ["action_runtime"]),
    policy("POST", routes.cancel, "timer.write", ["action_runtime"]),
    policy("POST", routes.snooze, "timer.write", ["action_runtime"]),
    // Trigger only receives the scoped read capability on behalf of a
    // browser principal already authorized to read the originating process.
    // It cannot create, update, or dispatch timers.
    policy("GET", routes.list, "timer.read", ["action_runtime", "trigger_processor"]),
    policy("GET", routes.get, "timer.read", ["action_runtime", "trigger_processor"]),
    policy("GET", routes.history, "timer.read", ["action_runtime", "trigger_processor"]),
    policy("POST", routes.scan, "timer.worker.scan", ["timer_trigger_app"]),
    policy(
      "POST",
      routes.claim,
      "timer.worker.dispatch",
      ["timer_trigger_app"],
    ),
    policy(
      "POST",
      routes.dispatch,
      "timer.worker.dispatch",
      ["timer_trigger_app"],
    ),
    policy(
      "POST",
      routes.catchUpCreate,
      "timer.worker.catch_up",
      ["timer_trigger_app"],
    ),
    policy(
      "POST",
      routes.catchUpAdvance,
      "timer.worker.catch_up",
      ["timer_trigger_app"],
    ),
  ]);
}

const statusByTimerError = Object.freeze({
  invalid_request: 400,
  forbidden: 403,
  schedule_not_found: 404,
  occurrence_not_found: 404,
  idempotency_conflict: 409,
  version_conflict: 409,
  invalid_state: 409,
  claim_conflict: 409,
  payload_too_large: 413,
  catch_up_conflict: 409,
  catch_up_not_found: 404,
} as const);

const safeMessageByTimerError = Object.freeze({
  invalid_request: "Timer request is invalid",
  forbidden: "Timer request is forbidden",
  schedule_not_found: "Timer schedule was not found",
  occurrence_not_found: "Timer occurrence was not found",
  idempotency_conflict: "Timer request conflicts with a prior request",
  version_conflict: "Timer owner version changed",
  invalid_state: "Timer owner state does not allow this operation",
  claim_conflict: "Timer occurrence claim is stale or unavailable",
  payload_too_large: "Timer payload is too large",
  catch_up_conflict: "Timer catch-up state changed",
  catch_up_not_found: "Timer catch-up batch was not found",
} as const);

function inlineFastifySchemaV1(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(inlineFastifySchemaV1);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "$id")
      .map(([key, entry]) => [key, inlineFastifySchemaV1(entry)]),
  );
}

function validatedRouteValueV1<T extends TSchema>(
  schema: T,
  value: unknown,
  label: string,
): Static<T> {
  canonicalJsonV1(value);
  if (!Value.Check(schema, value)) {
    throw new TimerApplicationErrorV1(
      "invalid_request",
      `${label} does not match the Timer HTTP contract`,
    );
  }
  return value;
}

function assertOnlyRouteKeysV1(
  value: unknown,
  allowedKeys: ReadonlySet<string>,
  label: string,
): void {
  const record = bodyRecord(value);
  if (Object.keys(record).some((key) => !allowedKeys.has(key))) {
    throw new TimerApplicationErrorV1(
      "invalid_request",
      `${label} contains an unsupported field`,
    );
  }
}

function strictBodyPreValidationV1<T extends TSchema>(
  schema: T,
  label: string,
) {
  return async (request: Readonly<{ body: unknown }>): Promise<void> => {
    validatedRouteValueV1(schema, request.body, label);
  };
}

function bodyRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TimerApplicationErrorV1(
      "invalid_request",
      "request body must be an object",
    );
  }
  return { ...value };
}

function pathId(value: unknown): string {
  const params = bodyRecord(value);
  const id = params["id"];
  if (typeof id !== "string") {
    throw new TimerApplicationErrorV1("invalid_request", "path id is required");
  }
  return id;
}

function bodyWithBoundField(
  body: unknown,
  field: "schedule_id" | "occurrence_id",
  value: string,
): Record<string, unknown> {
  const record = bodyRecord(body);
  if (record[field] !== undefined && record[field] !== value) {
    throw new TimerApplicationErrorV1(
      "invalid_request",
      `${field} does not match the path`,
    );
  }
  return { ...record, [field]: value };
}

export function buildTimerTriggerApp(
  options: ServiceAppOptions = {},
  applications: TimerTriggerApplicationsV1 = {},
  buildOptions: TimerTriggerBuildOptionsV1 = {},
): ReturnType<typeof createServiceApp> {
  const timer = applications.timer;
  const existingPolicies = options.auth?.policies ?? [];
  const existingErrorMapper = options.errorMapper;
  const app = createServiceApp("timer_trigger_app", {
    ...options,
    auth: {
      ...(options.auth?.verifier === undefined
        ? {}
        : { verifier: options.auth.verifier }),
      policies:
        timer === undefined
          ? existingPolicies
          : [...existingPolicies, ...policies()],
    },
    errorMapper: async (error, request) => {
      if (error instanceof TimerApplicationErrorV1) {
        return new ServiceError({
          code: error.code,
          message: safeMessageByTimerError[error.code],
          statusCode: statusByTimerError[error.code],
          retryable: false,
          cause: error,
        });
      }
      return existingErrorMapper?.(error, request);
    },
    readinessChecks: [
      ...(options.readinessChecks ?? []),
      ...(buildOptions.require_complete_pipeline === true
        ? [
            {
              name: "timer_repository_trigger_processor_pipeline",
              async check(signal: AbortSignal) {
                if (timer === undefined) {
                  throw new Error(
                    "Timer PostgreSQL repository and Trigger Processor client are not composed",
                  );
                }
                await timer.checkReadiness(signal);
              },
            },
          ]
        : []),
    ],
  });

  if (timer === undefined) return app;

  app.post(
    routes.create,
    {
      preValidation: strictBodyPreValidationV1(
        TimerScheduleCreateCommandV1Schema,
        "schedule create request",
      ),
      schema: {
        body: inlineFastifySchemaV1(TimerScheduleCreateCommandV1Schema),
        response: {
          200: inlineFastifySchemaV1(
            TimerScheduleCreateResponseV1Schema,
          ),
        },
      },
    },
    async (request, reply) => {
      const caller = principal(request);
      const command = toTimerApplicationCommandV1(request.body, caller);
      const result = await timer.executeCommand(caller, command.internal);
      return reply
        .code(200)
        .send(toTimerOwnerCommandResponseV1(command.owner, result));
    },
  );

  app.patch(
    routes.update,
    {
      preValidation: strictBodyPreValidationV1(
        TimerScheduleUpdateCommandV1Schema,
        "schedule update request",
      ),
      schema: {
        params: inlineFastifySchemaV1(TimerIdPathParamsV1Schema),
        body: inlineFastifySchemaV1(TimerScheduleUpdateCommandV1Schema),
        response: {
          200: inlineFastifySchemaV1(
            TimerScheduleUpdateResponseV1Schema,
          ),
        },
      },
    },
    async (request, reply) => {
      const caller = principal(request);
      const command = toTimerApplicationCommandV1(
        bodyWithBoundField(
          request.body,
          "schedule_id",
          pathId(request.params),
        ),
        caller,
      );
      const result = await timer.executeCommand(caller, command.internal);
      return reply
        .code(200)
        .send(toTimerOwnerCommandResponseV1(command.owner, result));
    },
  );

  for (const [route, bodySchema, responseSchema] of [
    [
      routes.pause,
      TimerSchedulePauseCommandV1Schema,
      TimerSchedulePauseResponseV1Schema,
    ],
    [
      routes.resume,
      TimerScheduleResumeCommandV1Schema,
      TimerScheduleResumeResponseV1Schema,
    ],
    [
      routes.cancel,
      TimerScheduleCancelCommandV1Schema,
      TimerScheduleCancelResponseV1Schema,
    ],
  ] as const) {
    app.post(
      route,
      {
        preValidation: strictBodyPreValidationV1(
          bodySchema,
          "schedule transition request",
        ),
        schema: {
          params: inlineFastifySchemaV1(TimerIdPathParamsV1Schema),
          body: inlineFastifySchemaV1(bodySchema),
          response: { 200: inlineFastifySchemaV1(responseSchema) },
        },
      },
      async (request, reply) => {
        const caller = principal(request);
        const command = toTimerApplicationCommandV1(
          bodyWithBoundField(
            request.body,
            "schedule_id",
            pathId(request.params),
          ),
          caller,
        );
        const result = await timer.executeCommand(caller, command.internal);
        return reply
          .code(200)
          .send(toTimerOwnerCommandResponseV1(command.owner, result));
      },
    );
  }

  app.post(
    routes.snooze,
    {
      preValidation: strictBodyPreValidationV1(
        TimerOccurrenceSnoozeCommandV1Schema,
        "occurrence snooze request",
      ),
      schema: {
        params: inlineFastifySchemaV1(TimerIdPathParamsV1Schema),
        body: inlineFastifySchemaV1(TimerOccurrenceSnoozeCommandV1Schema),
        response: {
          200: inlineFastifySchemaV1(
            TimerOccurrenceSnoozeResponseV1Schema,
          ),
        },
      },
    },
    async (request, reply) => {
      const caller = principal(request);
      const command = toTimerApplicationCommandV1(
        bodyWithBoundField(
          request.body,
          "occurrence_id",
          pathId(request.params),
        ),
        caller,
      );
      const result = await timer.executeCommand(caller, command.internal);
      return reply
        .code(200)
        .send(toTimerOwnerCommandResponseV1(command.owner, result));
    },
  );

  app.get(
    routes.list,
    {
      preValidation: async (request) => {
        assertOnlyRouteKeysV1(
          request.query,
          new Set([
            "runtime_run_id",
            "trace_id",
            "status",
            "limit",
            "cursor",
          ]),
          "schedule list query",
        );
      },
      schema: {
        querystring: inlineFastifySchemaV1(
          TimerScheduleListQueryParamsV1Schema,
        ),
        response: {
          200: inlineFastifySchemaV1(
            TimerScheduleQueryResponseV1Schema,
          ),
        },
      },
    },
    async (request, reply) => {
      const caller = principal(request);
      const routeQuery = validatedRouteValueV1(
        TimerScheduleListQueryParamsV1Schema,
        request.query,
        "schedule list query",
      );
      const ownerQuery = {
        ...routeQuery,
        schema_version: "timer.schedule_query.v1",
        ...timerOwnerIdentityFromPrincipalV1(caller),
        method: "timer.list",
      } as const;
      const query = toTimerApplicationQueryV1(ownerQuery, caller);
      const result = await timer.query(caller, query.internal);
      return reply
        .code(200)
        .send(toTimerOwnerQueryResponseV1(query.owner, result));
    },
  );

  for (const [route, method] of [
    [routes.get, "timer.get"],
    [routes.history, "timer.history"],
  ] as const) {
    const querySchema =
      method === "timer.history"
        ? TimerScheduleHistoryQueryParamsV1Schema
        : TimerScheduleReadQueryParamsV1Schema;
    const allowedQueryKeys =
      method === "timer.history"
        ? new Set(["runtime_run_id", "trace_id", "limit", "cursor"])
        : new Set(["runtime_run_id", "trace_id"]);
    app.get(
      route,
      {
        preValidation: async (request) => {
          assertOnlyRouteKeysV1(
            request.query,
            allowedQueryKeys,
            "schedule read query",
          );
        },
        schema: {
          params: inlineFastifySchemaV1(TimerIdPathParamsV1Schema),
          querystring: inlineFastifySchemaV1(
            querySchema,
          ),
          response: {
            200: inlineFastifySchemaV1(
              TimerScheduleQueryResponseV1Schema,
            ),
          },
        },
      },
      async (request, reply) => {
        const caller = principal(request);
        const routeQuery = validatedRouteValueV1(
          querySchema,
          request.query,
          "schedule read query",
        );
        const ownerQuery = {
          ...routeQuery,
          schema_version: "timer.schedule_query.v1",
          ...timerOwnerIdentityFromPrincipalV1(caller),
          method,
          schedule_id: pathId(request.params),
        } as const;
        const query = toTimerApplicationQueryV1(ownerQuery, caller);
        const result = await timer.query(caller, query.internal);
        return reply
          .code(200)
          .send(toTimerOwnerQueryResponseV1(query.owner, result));
      },
    );
  }

  app.post(
    routes.scan,
    {
      preValidation: strictBodyPreValidationV1(
        TimerScanDueRequestV1Schema,
        "scan request",
      ),
      schema: {
        body: inlineFastifySchemaV1(TimerScanDueRequestV1Schema),
        response: {
          200: inlineFastifySchemaV1(TimerScanDueResponseV1Schema),
        },
      },
    },
    async (request, reply) => {
      const caller = principal(request);
      const scan = toTimerApplicationScanRequestV1(
        request.body,
        caller,
      );
      const occurrences = await timer.scanDue(caller, scan.internal);
      return reply.code(200).send({
        code: "timer_scan_completed",
        occurrences: occurrences.map(toTimerOwnerOccurrenceV1),
        trace_id: scan.http.trace_id,
      });
    },
  );

  app.post(
    routes.dispatch,
    {
      preValidation: strictBodyPreValidationV1(
        TimerDispatchRequestV1Schema,
        "dispatch request",
      ),
      schema: {
        params: inlineFastifySchemaV1(TimerIdPathParamsV1Schema),
        body: inlineFastifySchemaV1(TimerDispatchRequestV1Schema),
        response: {
          200: inlineFastifySchemaV1(TimerDispatchResponseV1Schema),
        },
      },
    },
    async (request, reply) => {
      const caller = principal(request);
      const dispatch = toTimerApplicationDispatchV1(
        bodyWithBoundField(
          request.body,
          "occurrence_id",
          pathId(request.params),
        ),
        caller,
      );
      const result = await timer.dispatchOccurrence(
        caller,
        dispatch.internal,
      );
      return reply
        .code(200)
        .send(toTimerOwnerDispatchResponseV1(dispatch.owner, result));
    },
  );

  app.post(
    routes.claim,
    {
      preValidation: strictBodyPreValidationV1(
        TimerOccurrenceClaimRequestV1Schema,
        "claim request",
      ),
      schema: {
        params: inlineFastifySchemaV1(TimerIdPathParamsV1Schema),
        body: inlineFastifySchemaV1(
          TimerOccurrenceClaimRequestV1Schema,
        ),
        response: {
          200: inlineFastifySchemaV1(
            TimerOccurrenceClaimResponseV1Schema,
          ),
        },
      },
    },
    async (request, reply) => {
      const caller = principal(request);
      const claimRequest = toTimerApplicationOccurrenceClaimV1(
        request.body,
        pathId(request.params),
        caller,
      );
      const claim = await timer.claimOccurrence(
        caller,
        claimRequest.internal,
      );
      return reply.code(200).send(toTimerOwnerOccurrenceClaimV1(claim));
    },
  );

  app.post(
    routes.catchUpCreate,
    {
      preValidation: strictBodyPreValidationV1(
        TimerCatchUpCreateRequestV1Schema,
        "catch-up create request",
      ),
      schema: {
        body: inlineFastifySchemaV1(
          TimerCatchUpCreateRequestV1Schema,
        ),
        response: {
          200: inlineFastifySchemaV1(
            TimerCatchUpCreateResponseV1Schema,
          ),
        },
      },
    },
    async (request, reply) => {
      const caller = principal(request);
      const create = toTimerApplicationCatchUpCreateV1(
        request.body,
        caller,
      );
      const batch = await timer.createCatchUpBatch(
        caller,
        create.internal,
      );
      return reply.code(200).send(toTimerOwnerCatchUpBatchV1(batch));
    },
  );

  app.post(
    routes.catchUpAdvance,
    {
      preValidation: strictBodyPreValidationV1(
        TimerCatchUpAdvanceRequestV1Schema,
        "catch-up advance request",
      ),
      schema: {
        params: inlineFastifySchemaV1(TimerIdPathParamsV1Schema),
        body: inlineFastifySchemaV1(
          TimerCatchUpAdvanceRequestV1Schema,
        ),
        response: {
          200: inlineFastifySchemaV1(
            TimerCatchUpAdvanceResponseV1Schema,
          ),
        },
      },
    },
    async (request, reply) => {
      const caller = principal(request);
      const advance = toTimerApplicationCatchUpAdvanceV1(
        request.body,
        pathId(request.params),
        caller,
      );
      const result = await timer.advanceCatchUpBatch(
        caller,
        advance.internal,
      );
      return reply
        .code(200)
        .send(toTimerOwnerCatchUpAdvanceResponseV1(result));
    },
  );

  return app;
}
