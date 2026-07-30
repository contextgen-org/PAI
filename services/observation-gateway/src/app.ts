import {
  QualitySignalSeverityV1Schema,
  QualitySignalTypeV1Schema,
  SERVICE_IDS,
  ToolInvocationQueryStatusV1Schema,
  type ServiceIdV1,
} from "@pai/contracts";
import {
  createServiceApp,
  getWorkloadAuthContext,
  ServiceError,
  type InternalRouteAuthPolicy,
  type ServiceAppOptions,
} from "@pai/service-kit";
import { Type } from "@sinclair/typebox";

import {
  OBSERVATION_HTTP_OPERATIONS_V1,
  OBSERVATION_ROUTES_V1,
} from "./catalog.v1.js";
import {
  ObservationMetaDetailsResponseV1Schema,
  ObservationQualitySignalListV1Schema,
  ObservationRuntimeDetailsResponseV1Schema,
  ObservationSnapshotResponseV1Schema,
  ObservationToolInvocationListV1Schema,
} from "./contracts/observation.v1.js";
import {
  ObservationApplicationErrorV1,
  type ObservationApplicationV1,
  type ObservationPrincipalV1,
  type ObservationStreamFrameV1,
} from "./observation-application.v1.js";

export {
  OBSERVATION_HTTP_OPERATIONS_V1,
  OBSERVATION_ROUTES_V1,
} from "./catalog.v1.js";

export interface ObservationGatewayApplicationsV1 {
  readonly observation?: ObservationApplicationV1;
}

export interface ObservationGatewayBuildOptionsV1 {
  readonly require_complete_pipeline?: boolean;
  readonly require_durable_audit?: boolean;
  readonly allowed_callers?: readonly ServiceIdV1[];
}

const idSchema = Type.String({ minLength: 1, maxLength: 512 });
const paramsSchema = Type.Object(
  { id: idSchema },
  { additionalProperties: false },
);
const emptyQuerySchema = Type.Object({}, { additionalProperties: false });
const runtimeDetailsParamsSchema = Type.Object(
  {
    trigger_process_id: idSchema,
    runtime_run_id: idSchema,
  },
  { additionalProperties: false },
);
const metaDetailsParamsSchema = Type.Object(
  {
    trigger_process_id: idSchema,
    meta_job_id: idSchema,
  },
  { additionalProperties: false },
);
const eventsQuerySchema = Type.Object(
  {
    include_ephemeral_tokens: Type.Optional(Type.Boolean()),
    runtime_run_id: Type.Optional(idSchema),
  },
  { additionalProperties: false },
);
const toolsQuerySchema = Type.Object(
  {
    runtime_run_id: Type.Optional(idSchema),
    cursor: Type.Optional(idSchema),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200 })),
    status: Type.Optional(ToolInvocationQueryStatusV1Schema),
  },
  { additionalProperties: false },
);
const qualityQuerySchema = Type.Object(
  {
    cursor: Type.Optional(idSchema),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200 })),
    severity: Type.Optional(QualitySignalSeverityV1Schema),
    signal_type: Type.Optional(QualitySignalTypeV1Schema),
  },
  { additionalProperties: false },
);

function inlineSchema<T>(schema: T): T {
  const copy = structuredClone(schema) as unknown;
  const visit = (value: unknown): void => {
    if (typeof value !== "object" || value === null) return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const item = value as Record<string, unknown>;
    delete item["$id"];
    Object.values(item).forEach(visit);
  };
  visit(copy);
  return copy as T;
}

function workloadScope(
  request: Parameters<typeof getWorkloadAuthContext>[0],
) {
  const claims = getWorkloadAuthContext(request).claims;
  if (claims.scope_kind !== "bot") {
    throw new ObservationApplicationErrorV1(
      "bot_permission_denied",
      "Observation Gateway requires a bot-scoped workload",
      false,
    );
  }
  return Object.freeze({
    scope_kind: "bot" as const,
    workspace_id: claims.workspace_id,
    bot_id: claims.bot_id,
    owner_agent_id: claims.owner_agent_id,
    deployment_environment: claims.deployment_environment,
    release_channel: claims.release_channel,
  });
}

function principal(
  request: Parameters<typeof getWorkloadAuthContext>[0],
): ObservationPrincipalV1 {
  const claims = getWorkloadAuthContext(request).claims;
  const scope = workloadScope(request);
  const delegated = claims.delegated_principal;
  if (
    delegated === undefined ||
    delegated.scope_kind !== "bot" ||
    delegated.workspace_id !== scope.workspace_id ||
    delegated.bot_id !== scope.bot_id ||
    delegated.owner_agent_id !== scope.owner_agent_id ||
    delegated.deployment_environment !== scope.deployment_environment ||
    delegated.release_channel !== scope.release_channel
  ) {
    throw new ObservationApplicationErrorV1(
      "bot_permission_denied",
      "a matching signed delegated principal is required",
      false,
    );
  }
  const roles = delegated.roles.filter(
    (
      role,
    ): role is "observation.viewer" | "observation.debug_viewer" =>
      role === "observation.viewer" ||
      role === "observation.debug_viewer",
  );
  return Object.freeze({
    service_id: claims.sub,
    actor_id: `${delegated.principal_type}:${delegated.principal_id}`,
    roles: Object.freeze(roles),
    capabilities: Object.freeze([...claims.capability]),
    credential_expires_at_epoch_seconds: claims.exp,
    delegated_principal: Object.freeze(structuredClone(delegated)),
    scope: Object.freeze({
      workspace_id: scope.workspace_id,
      bot_id: scope.bot_id,
      owner_agent_id: scope.owner_agent_id,
      deployment_environment: scope.deployment_environment,
      release_channel: scope.release_channel,
    }),
  });
}

function boundPathIds(
  value: unknown,
  resourceField: "runtime_run_id" | "meta_job_id",
): Readonly<{
  trigger_process_id: string;
  resource_id: string;
}> {
  const candidate =
    typeof value === "object" && value !== null
      ? (value as Readonly<Record<string, unknown>>)
      : undefined;
  if (
    candidate === undefined ||
    typeof candidate["trigger_process_id"] !== "string" ||
    typeof candidate[resourceField] !== "string"
  ) {
    throw new ObservationApplicationErrorV1(
      "invalid_request",
      `trigger_process_id and ${resourceField} are required`,
      false,
    );
  }
  return Object.freeze({
    trigger_process_id: candidate["trigger_process_id"],
    resource_id: candidate[resourceField],
  });
}

function policies(
  allowedCallers: readonly ServiceIdV1[],
): readonly InternalRouteAuthPolicy[] {
  return Object.freeze(
    OBSERVATION_HTTP_OPERATIONS_V1.map((operation) =>
      Object.freeze({
        method: operation.method,
        route: operation.path,
        requiredCapabilities: [
          operation.required_capability,
        ] as const,
        allowedCallers,
        requiredScope: workloadScope,
      }),
    ),
  );
}

function statusCode(
  code: ObservationApplicationErrorV1["code"],
): 400 | 403 | 404 | 409 | 410 | 429 | 502 | 503 {
  switch (code) {
    case "invalid_request":
      return 400;
    case "bot_permission_denied":
    case "debug_permission_denied":
      return 403;
    case "process_not_found":
      return 404;
    case "runtime_run_mismatch":
    case "replay_cursor_ahead":
      return 409;
    case "replay_expired":
      return 410;
    case "rate_limited":
      return 429;
    case "upstream_schema_mismatch":
      return 502;
    default:
      return 503;
  }
}

function httpError(error: ObservationApplicationErrorV1): ServiceError {
  return new ServiceError({
    code: error.code,
    message: error.message,
    statusCode: statusCode(error.code),
    retryable: error.retryable,
    details: error.details,
    cause: error,
  });
}

function isFastifySchemaValidationErrorV1(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "validation" in error &&
    Array.isArray(error.validation)
  );
}

function pathId(value: unknown): string {
  if (
    typeof value !== "object" ||
    value === null ||
    !("id" in value) ||
    typeof value.id !== "string"
  ) {
    throw new ObservationApplicationErrorV1(
      "invalid_request",
      "trigger_process_id is required",
      false,
    );
  }
  return value.id;
}

function query(value: unknown): Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null
    ? (value as Readonly<Record<string, unknown>>)
    : {};
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function isObservationDownstreamClosedV1(
  request: Readonly<{
    raw: Readonly<{ aborted: boolean; destroyed: boolean }>;
  }>,
  reply: Readonly<{
    raw: Readonly<{
      closed: boolean;
      destroyed: boolean;
      writableEnded: boolean;
    }>;
  }>,
  signal: AbortSignal,
): boolean {
  return (
    signal.aborted ||
    request.raw.aborted ||
    request.raw.destroyed ||
    reply.raw.closed ||
    reply.raw.destroyed ||
    reply.raw.writableEnded
  );
}

async function writeSseFrame(
  response: NodeJS.WritableStream,
  frame: ObservationStreamFrameV1,
  signal?: AbortSignal,
): Promise<void> {
  let wire: string;
  if (frame.comment === "heartbeat") {
    wire = ":heartbeat\n\n";
  } else {
    wire = [
      ...(frame.id === undefined ? [] : [`id: ${frame.id}`]),
      ...(frame.event === undefined ? [] : [`event: ${frame.event}`]),
      `data: ${JSON.stringify(frame.data ?? null)}`,
      "",
      "",
    ].join("\n");
  }
  if (response.write(wire)) return;
  await new Promise<void>((resolve, reject) => {
    const cleanup = (): void => {
      response.removeListener("drain", onDrain);
      response.removeListener("close", onClose);
      signal?.removeEventListener("abort", onAbort);
    };
    const onDrain = (): void => {
      cleanup();
      resolve();
    };
    const onClose = (): void => {
      cleanup();
      reject(new Error("observation SSE downstream closed"));
    };
    const onAbort = (): void => {
      cleanup();
      reject(
        signal?.reason ??
          new Error("observation SSE downstream aborted"),
      );
    };
    if (signal?.aborted === true) {
      onAbort();
      return;
    }
    response.once("drain", onDrain);
    response.once("close", onClose);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export function buildObservationGatewayApp(
  options: ServiceAppOptions = {},
  applications: ObservationGatewayApplicationsV1 = {},
  buildOptions: ObservationGatewayBuildOptionsV1 = {},
): ReturnType<typeof createServiceApp> {
  const observation = applications.observation;
  const configuredAllowedCallers = Object.freeze([
    ...(buildOptions.allowed_callers ?? []),
  ]);
  if (
    configuredAllowedCallers.length !==
      new Set(configuredAllowedCallers).size ||
    configuredAllowedCallers.some(
      (caller) =>
        !SERVICE_IDS.includes(caller) ||
        caller === "observation_gateway",
    )
  ) {
    throw new Error(
      "Observation Gateway allowed callers must be unique registered ingress services",
    );
  }
  if (
    observation !== undefined &&
    buildOptions.require_durable_audit === true
  ) {
    observation.requireDurableAuditHandoffV1();
  }
  const app = createServiceApp("observation_gateway", {
    ...options,
    auth: {
      ...(options.auth?.verifier === undefined
        ? {}
        : { verifier: options.auth.verifier }),
      policies:
        observation === undefined ||
        configuredAllowedCallers.length === 0
          ? options.auth?.policies ?? []
          : [
              ...(options.auth?.policies ?? []),
              ...policies(configuredAllowedCallers),
            ],
    },
    readinessChecks: [
      ...(options.readinessChecks ?? []),
      ...(buildOptions.require_complete_pipeline === true
        ? [
            {
              name: "observation_pipeline",
              async check() {
                if (observation === undefined) {
                  throw new Error(
                    "Observation Gateway dependencies are not composed",
                  );
                }
                if (configuredAllowedCallers.length === 0) {
                  throw new Error(
                    "Observation Gateway production requires an explicit ingress caller allowlist",
                  );
                }
                await observation.checkReadiness(
                  buildOptions.require_durable_audit === true,
                  true,
                );
              },
            },
          ]
        : []),
    ],
    async errorMapper(error, request) {
      if (error instanceof ObservationApplicationErrorV1) {
        return httpError(error);
      }
      if (
        (error instanceof ServiceError &&
          error.code === "invalid_canonical_json") ||
        isFastifySchemaValidationErrorV1(error)
      ) {
        return httpError(
          new ObservationApplicationErrorV1(
            "invalid_request",
            "Observation request validation failed",
            false,
          ),
        );
      }
      return options.errorMapper?.(error, request);
    },
  });

  if (
    observation === undefined ||
    configuredAllowedCallers.length === 0
  ) {
    return app;
  }

  app.get(
    OBSERVATION_ROUTES_V1.snapshot,
    {
      schema: {
        params: paramsSchema,
        querystring: emptyQuerySchema,
        response: {
          200: inlineSchema(ObservationSnapshotResponseV1Schema),
        },
      },
    },
    async (request, reply) =>
      reply.send(
        await observation.getSnapshot(
          principal(request),
          pathId(request.params),
          request.id,
        ),
      ),
  );

  app.get(
    OBSERVATION_ROUTES_V1.toolInvocations,
    {
      schema: {
        params: paramsSchema,
        querystring: toolsQuerySchema,
        response: {
          200: inlineSchema(ObservationToolInvocationListV1Schema),
        },
      },
    },
    async (request, reply) => {
      const values = query(request.query);
      return reply.send(
        await observation.listToolInvocations(
          principal(request),
          pathId(request.params),
          {
            ...(optionalString(values["runtime_run_id"]) === undefined
              ? {}
              : {
                  runtime_run_id: optionalString(
                    values["runtime_run_id"],
                  ) as string,
                }),
            ...(optionalString(values["cursor"]) === undefined
              ? {}
              : { cursor: optionalString(values["cursor"]) as string }),
            ...(typeof values["limit"] === "number"
              ? { limit: values["limit"] }
              : {}),
            ...(optionalString(values["status"]) === undefined
              ? {}
              : { status: optionalString(values["status"]) as string }),
            trace_id: request.id,
          },
        ),
      );
    },
  );

  app.get(
    OBSERVATION_ROUTES_V1.qualitySignals,
    {
      schema: {
        params: paramsSchema,
        querystring: qualityQuerySchema,
        response: {
          200: inlineSchema(ObservationQualitySignalListV1Schema),
        },
      },
    },
    async (request, reply) => {
      const values = query(request.query);
      return reply.send(
        await observation.listQualitySignals(
          principal(request),
          pathId(request.params),
          {
            ...(optionalString(values["cursor"]) === undefined
              ? {}
              : { cursor: optionalString(values["cursor"]) as string }),
            ...(typeof values["limit"] === "number"
              ? { limit: values["limit"] }
              : {}),
            ...(optionalString(values["severity"]) === undefined
              ? {}
              : { severity: optionalString(values["severity"]) as string }),
            ...(optionalString(values["signal_type"]) === undefined
              ? {}
              : {
                  signal_type: optionalString(
                    values["signal_type"],
                  ) as string,
                }),
            trace_id: request.id,
          },
        ),
      );
    },
  );

  app.get(
    OBSERVATION_ROUTES_V1.runtimeDetails,
    {
      schema: {
        params: runtimeDetailsParamsSchema,
        querystring: emptyQuerySchema,
        response: {
          200: inlineSchema(ObservationRuntimeDetailsResponseV1Schema),
        },
      },
    },
    async (request, reply) => {
      const ids = boundPathIds(request.params, "runtime_run_id");
      return reply.send(
        await observation.getRuntimeDetails(
          principal(request),
          ids.trigger_process_id,
          ids.resource_id,
          request.id,
        ),
      );
    },
  );

  app.get(
    OBSERVATION_ROUTES_V1.metaDetails,
    {
      schema: {
        params: metaDetailsParamsSchema,
        querystring: emptyQuerySchema,
        response: {
          200: inlineSchema(ObservationMetaDetailsResponseV1Schema),
        },
      },
    },
    async (request, reply) => {
      const ids = boundPathIds(request.params, "meta_job_id");
      return reply.send(
        await observation.getMetaDetails(
          principal(request),
          ids.trigger_process_id,
          ids.resource_id,
          request.id,
        ),
      );
    },
  );

  app.get(
    OBSERVATION_ROUTES_V1.events,
    {
      schema: {
        params: paramsSchema,
        querystring: eventsQuerySchema,
      },
    },
    async (request, reply) => {
      const values = query(request.query);
      const header = request.headers["last-event-id"];
      if (
        header !== undefined &&
        (typeof header !== "string" || header.length === 0)
      ) {
        throw new ObservationApplicationErrorV1(
          "invalid_request",
          "Last-Event-ID is invalid",
          false,
        );
      }
      const downstreamAbort = new AbortController();
      const onDownstreamClose = (): void => downstreamAbort.abort();
      reply.raw.once("close", onDownstreamClose);
      request.raw.once("aborted", onDownstreamClose);
      if (
        isObservationDownstreamClosedV1(
          request,
          reply,
          downstreamAbort.signal,
        )
      ) {
        onDownstreamClose();
      }
      let hijacked = false;
      try {
        const prepared = await observation.prepareEventStream(
          principal(request),
          pathId(request.params),
          {
            ...(header === undefined ? {} : { last_event_id: header }),
            ...(values["include_ephemeral_tokens"] === true
              ? { include_ephemeral_tokens: true }
              : {}),
            ...(optionalString(values["runtime_run_id"]) === undefined
              ? {}
              : {
                  runtime_run_id: optionalString(
                    values["runtime_run_id"],
                  ) as string,
                }),
            trace_id: request.id,
          },
          downstreamAbort.signal,
        );
        if (
          isObservationDownstreamClosedV1(
            request,
            reply,
            downstreamAbort.signal,
          )
        ) {
          downstreamAbort.abort();
          const iterator = observation
            .streamPreparedEvents(prepared, downstreamAbort.signal)
            [Symbol.asyncIterator]();
          await iterator.next();
          return reply;
        }
        reply.hijack();
        hijacked = true;
        reply.raw.writeHead(200, {
          "cache-control": "no-cache, no-transform",
          connection: "keep-alive",
          "content-type": "text/event-stream; charset=utf-8",
          "x-accel-buffering": "no",
        });
        try {
          for await (const frame of observation.streamPreparedEvents(
            prepared,
            downstreamAbort.signal,
          )) {
            if (
              isObservationDownstreamClosedV1(
                request,
                reply,
                downstreamAbort.signal,
              )
            ) {
              break;
            }
            await writeSseFrame(
              reply.raw,
              frame,
              downstreamAbort.signal,
            );
          }
        } catch (error) {
          if (
            !isObservationDownstreamClosedV1(
              request,
              reply,
              downstreamAbort.signal,
            )
          ) {
            const mapped =
              error instanceof ObservationApplicationErrorV1
                ? error
                : new ObservationApplicationErrorV1(
                    "upstream_unavailable",
                    "observation stream failed",
                    true,
                  );
            await writeSseFrame(
              reply.raw,
              {
                event: "observation.error",
                data: {
                  schema_version: "1.0.0",
                  code: "observation.error",
                  error_code: mapped.code,
                  retryable: mapped.retryable,
                  trace_id: request.id,
                },
                durable: false,
              },
              downstreamAbort.signal,
            );
          }
        }
      } finally {
        reply.raw.removeListener("close", onDownstreamClose);
        request.raw.removeListener("aborted", onDownstreamClose);
        downstreamAbort.abort();
        if (
          hijacked &&
          !reply.raw.destroyed &&
          !reply.raw.writableEnded
        ) {
          reply.raw.end();
        }
      }
    },
  );

  return app;
}
