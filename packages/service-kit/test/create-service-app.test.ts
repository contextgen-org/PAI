import { afterEach, describe, expect, it } from "vitest";

import {
  beginServiceShutdown,
  createServiceApp,
  ServiceError,
} from "../src/index.js";

const apps = [] as ReturnType<typeof createServiceApp>[];

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
});

describe("createServiceApp", () => {
  it("keeps liveness separate from readiness", async () => {
    const app = createServiceApp("trigger_processor", {
      readinessChecks: [
        { name: "postgres", check: async () => undefined },
        {
          name: "redis",
          check: async () => {
            throw new Error("unavailable");
          },
        },
      ],
    });
    apps.push(app);

    const health = await app.inject({ method: "GET", url: "/health" });
    const ready = await app.inject({ method: "GET", url: "/ready" });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toEqual({
      status: "ok",
      service_id: "trigger_processor",
    });
    expect(ready.statusCode).toBe(503);
    expect(ready.json()).toMatchObject({
      status: "not_ready",
      checks: [
        { name: "postgres", status: "up" },
        { name: "redis", status: "down" },
      ],
    });
  });

  it("inherits W3C trace ids and uses the shared error envelope", async () => {
    const app = createServiceApp("trigger_processor");
    apps.push(app);
    app.get("/failure", async () => {
      throw new ServiceError({
        code: "dependency_unavailable",
        message: "dependency unavailable",
        statusCode: 503,
        retryable: true,
      });
    });

    const traceId = "4bf92f3577b34da6a3ce929d0e0e4736";
    const response = await app.inject({
      method: "GET",
      url: "/failure",
      headers: {
        traceparent: `00-${traceId}-00f067aa0ba902b7-01`,
      },
    });
    expect(response.statusCode).toBe(503);
    expect(response.headers["x-trace-id"]).toBe(traceId);
    expect(response.json()).toEqual({
      code: "dependency_unavailable",
      message: "dependency unavailable",
      retryable: true,
      details: {},
      trace_id: traceId,
    });
  });

  it("replaces non-OpenTelemetry trace identifiers", async () => {
    const app = createServiceApp("observation_gateway");
    apps.push(app);
    const response = await app.inject({
      method: "GET",
      url: "/health",
      headers: { "x-trace-id": "unsafe custom request id" },
    });

    expect(response.headers["x-trace-id"]).toMatch(/^[0-9a-f]{32}$/);
    expect(response.headers["x-trace-id"]).not.toBe("unsafe custom request id");
  });

  it("restarts invalid W3C traceparent values instead of trusting their trace id", async () => {
    const app = createServiceApp("observation_gateway");
    apps.push(app);
    const suppliedTraceId = "4bf92f3577b34da6a3ce929d0e0e4736";
    const invalidTraceparents = [
      `00-${suppliedTraceId}-0000000000000000-01`,
      `ff-${suppliedTraceId}-00f067aa0ba902b7-01`,
      `00-${suppliedTraceId}-00f067aa0ba902b7-01-extra`,
      `00-${suppliedTraceId.toUpperCase()}-00f067aa0ba902b7-01`,
    ];

    for (const traceparent of invalidTraceparents) {
      const response = await app.inject({
        method: "GET",
        url: "/health",
        headers: { traceparent },
      });
      expect(response.headers["x-trace-id"]).toMatch(/^[0-9a-f]{32}$/);
      expect(response.headers["x-trace-id"]).not.toBe(suppliedTraceId);
    }
  });

  it("rejects new traffic while draining but keeps probes available", async () => {
    const app = createServiceApp("memory");
    apps.push(app);
    app.get("/work", async () => ({ accepted: true }));

    beginServiceShutdown(app);

    const work = await app.inject({ method: "GET", url: "/work" });
    const health = await app.inject({ method: "GET", url: "/health" });
    const ready = await app.inject({ method: "GET", url: "/ready" });
    expect(work.statusCode).toBe(503);
    expect(work.json()).toMatchObject({
      code: "service_unavailable",
      retryable: true,
    });
    expect(health.statusCode).toBe(200);
    expect(ready.statusCode).toBe(503);
  });

  it("maps schema failures without reflecting rejected values", async () => {
    const app = createServiceApp("knowthat");
    apps.push(app);
    app.post(
      "/items",
      {
        schema: {
          body: {
            type: "object",
            additionalProperties: false,
            required: ["name"],
            properties: { name: { type: "string", minLength: 1 } },
          },
        },
      },
      async () => ({ accepted: true }),
    );

    const response = await app.inject({
      method: "POST",
      url: "/items",
      payload: { token: "must-never-be-reflected" },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: "invalid_request",
      retryable: false,
      details: { schema_version: "1.0.0" },
    });
    expect(response.body).not.toContain("must-never-be-reflected");
  });
});
