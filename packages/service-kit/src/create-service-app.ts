import {
  ServiceIdV1Schema,
  type ResponseEnvelopeV1,
  type ServiceIdV1,
} from "@pai/contracts";
import Fastify, { type FastifyInstance } from "fastify";

export interface ServiceAppOptions {
  readonly logger?: boolean;
}

export function createServiceApp(
  serviceId: ServiceIdV1,
  options: ServiceAppOptions = {},
): FastifyInstance {
  const app = Fastify({
    logger: options.logger ?? false,
    genReqId: () => crypto.randomUUID(),
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

  app.setErrorHandler((error, request, reply) => {
    const validation =
      typeof error === "object" &&
      error !== null &&
      "validation" in error &&
      Array.isArray(error.validation)
        ? (error.validation as readonly { readonly instancePath?: string }[])
        : undefined;
    const envelope: ResponseEnvelopeV1 = {
      code: validation === undefined ? "internal_error" : "schema_validation_failed",
      message: validation === undefined ? "internal service error" : "request validation failed",
      retryable: false,
      details:
        validation === undefined
          ? {}
          : {
              schema_version: "1.0.0",
              field_paths: validation.map((issue) => issue.instancePath ?? "/"),
            },
      trace_id: request.id,
    };
    void reply
      .code(validation === undefined ? 500 : 400)
      .send(envelope);
  });

  return app;
}
