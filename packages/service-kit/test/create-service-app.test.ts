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
  it("preflights parsed request graphs before route schema validation and handlers", async () => {
    const app = createServiceApp("memory", { logger: false });
    apps.push(app);
    let handlerCalls = 0;
    app.post(
      "/bounded",
      {
        schema: {
          body: {
            type: "object",
            additionalProperties: true,
          },
        },
      },
      async () => {
        handlerCalls += 1;
        return { ok: true };
      },
    );

    let deep: Record<string, unknown> = { leaf: true };
    for (let depth = 0; depth < 129; depth += 1) {
      deep = { next: deep };
    }
    const response = await app.inject({
      method: "POST",
      url: "/bounded",
      payload: deep,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: "invalid_canonical_json",
      retryable: false,
    });
    expect(handlerCalls).toBe(0);
  });

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

  it("recovers readiness in the same process after a dependency returns", async () => {
    let dependencyAvailable = true;
    const app = createServiceApp("action_runtime", {
      readinessChecks: [
        {
          name: "owner_postgres",
          check: async () => {
            if (!dependencyAvailable) throw new Error("unavailable");
          },
        },
      ],
    });
    apps.push(app);

    const healthy = await app.inject({ method: "GET", url: "/ready" });
    dependencyAvailable = false;
    const missing = await app.inject({ method: "GET", url: "/ready" });
    dependencyAvailable = true;
    const recovered = await app.inject({ method: "GET", url: "/ready" });

    expect(healthy.statusCode).toBe(200);
    expect(missing.statusCode).toBe(503);
    expect(missing.json()).toMatchObject({
      status: "not_ready",
      checks: [{ name: "owner_postgres", status: "down" }],
    });
    expect(recovered.statusCode).toBe(200);
    expect(recovered.json()).toMatchObject({
      status: "ready",
      checks: [{ name: "owner_postgres", status: "up" }],
    });
  });

  it("snapshots the validated readiness proof against options mutation", async () => {
    const mutableCheck: {
      name: string;
      check: () => Promise<void>;
    } = {
      name: "owner_postgres",
      check: async () => {
        throw new Error("database unavailable");
      },
    };
    const app = createServiceApp("trigger_processor", {
      readinessChecks: [mutableCheck],
    });
    apps.push(app);

    mutableCheck.name = "forged_ready";
    mutableCheck.check = async () => undefined;

    const ready = await app.inject({ method: "GET", url: "/ready" });
    expect(ready.statusCode).toBe(503);
    expect(ready.json()).toMatchObject({
      status: "not_ready",
      checks: [{ name: "owner_postgres", status: "down" }],
    });
  });

  it("rejects accessor-backed app options and readiness checks without invoking them", () => {
    let proxyTrapCalls = 0;
    const proxiedOptions = new Proxy(
      { logger: false },
      {
        getPrototypeOf(target) {
          proxyTrapCalls += 1;
          return Reflect.getPrototypeOf(target);
        },
      },
    );
    expect(() =>
      createServiceApp("memory", proxiedOptions),
    ).toThrow("own data properties");
    expect(proxyTrapCalls).toBe(0);

    let optionGetterCalls = 0;
    const options = {} as Record<string, unknown>;
    Object.defineProperty(options, "readinessChecks", {
      configurable: true,
      enumerable: true,
      get() {
        optionGetterCalls += 1;
        return [];
      },
    });
    expect(() => createServiceApp("memory", options as never)).toThrow(
      "own data properties",
    );
    expect(optionGetterCalls).toBe(0);

    let checkGetterCalls = 0;
    const check = {
      name: "owner_postgres",
      check: async () => undefined,
    } as Record<string, unknown>;
    Object.defineProperty(check, "check", {
      configurable: true,
      enumerable: true,
      get() {
        checkGetterCalls += 1;
        return async () => undefined;
      },
    });
    expect(() =>
      createServiceApp("memory", { readinessChecks: [check as never] }),
    ).toThrow("readiness check names");
    expect(checkGetterCalls).toBe(0);
  });

  it("aborts a timed-out readiness check so probes do not accumulate work", async () => {
    let observedAbort = false;
    const app = createServiceApp("memory", {
      runtimeConfig: {
        host: "127.0.0.1",
        port: 3004,
        log_level: "silent",
        request_timeout_ms: 30_000,
        readiness_timeout_ms: 100,
        shutdown_grace_ms: 10_000,
        deployment_environment: "local",
        release_channel: "stable",
      },
      readinessChecks: [
        {
          name: "slow_dependency",
          check: async (signal) =>
            new Promise<void>((_resolve, reject) => {
              signal.addEventListener(
                "abort",
                () => {
                  observedAbort = true;
                  reject(signal.reason);
                },
                { once: true },
              );
            }),
        },
      ],
    });
    apps.push(app);

    const ready = await app.inject({ method: "GET", url: "/ready" });

    expect(ready.statusCode).toBe(503);
    expect(observedAbort).toBe(true);
    expect(ready.json()).toMatchObject({
      checks: [{ name: "slow_dependency", status: "down" }],
    });
  });

  it("single-flights an uncooperative readiness check across concurrent probes", async () => {
    let calls = 0;
    let settleFirstCheck: (() => void) | undefined;
    const app = createServiceApp("memory", {
      runtimeConfig: {
        host: "127.0.0.1",
        port: 3004,
        log_level: "silent",
        request_timeout_ms: 30_000,
        readiness_timeout_ms: 100,
        shutdown_grace_ms: 10_000,
        deployment_environment: "local",
        release_channel: "stable",
      },
      readinessChecks: [
        {
          name: "uncooperative_dependency",
          check: async () => {
            calls += 1;
            if (calls !== 1) return;
            await new Promise<void>((resolve) => {
              settleFirstCheck = resolve;
            });
          },
        },
      ],
    });
    apps.push(app);

    const firstWave = await Promise.all(
      Array.from({ length: 20 }, async () =>
        app.inject({ method: "GET", url: "/ready" }),
      ),
    );
    expect(firstWave.every(({ statusCode }) => statusCode === 503)).toBe(true);
    expect(calls).toBe(1);

    const secondWave = await Promise.all(
      Array.from({ length: 5 }, async () =>
        app.inject({ method: "GET", url: "/ready" }),
      ),
    );
    expect(secondWave.every(({ statusCode }) => statusCode === 503)).toBe(true);
    expect(calls).toBe(1);

    settleFirstCheck?.();
    await new Promise<void>((resolve) => setImmediate(resolve));
    const recovered = await app.inject({ method: "GET", url: "/ready" });
    expect(recovered.statusCode).toBe(200);
    expect(calls).toBe(2);
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

  it("rejects rather than mutating requests to satisfy a route schema", async () => {
    const app = createServiceApp("knowthat");
    apps.push(app);
    let handlerCalls = 0;
    app.post(
      "/strict",
      {
        schema: {
          body: {
            type: "object",
            additionalProperties: false,
            required: ["count", "mode"],
            properties: {
              count: { type: "integer" },
              mode: { type: "string", default: "implicit" },
            },
          },
        },
      },
      async () => {
        handlerCalls += 1;
        return { accepted: true };
      },
    );

    for (const payload of [
      { count: 1, mode: "explicit", unexpected: "must-not-be-removed" },
      { count: "1", mode: "explicit" },
      { count: 1 },
    ]) {
      const response = await app.inject({
        method: "POST",
        url: "/strict",
        payload,
      });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        code: "invalid_request",
        retryable: false,
      });
    }
    expect(handlerCalls).toBe(0);
  });

  it("coerces only textual transport scalars while rejecting unknown query fields", async () => {
    const app = createServiceApp("knowthat");
    apps.push(app);
    app.get(
      "/query",
      {
        schema: {
          querystring: {
            type: "object",
            additionalProperties: false,
            required: ["limit"],
            properties: {
              limit: { type: "integer", minimum: 1, maximum: 200 },
            },
          },
        },
      },
      async (request) => ({
        limit: (request.query as Readonly<{ limit: number }>).limit,
      }),
    );

    const accepted = await app.inject({
      method: "GET",
      url: "/query?limit=50",
    });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json()).toEqual({ limit: 50 });

    const rejected = await app.inject({
      method: "GET",
      url: "/query?limit=50&unexpected=must-not-be-removed",
    });
    expect(rejected.statusCode).toBe(400);
    expect(rejected.json()).toMatchObject({
      code: "invalid_request",
      retryable: false,
    });
  });

  it("executes the shared UTF-8, canonical JSON, identity and conditional keywords", async () => {
    const app = createServiceApp("memory");
    apps.push(app);
    app.post(
      "/memory-batch",
      {
        schema: {
          body: {
            type: "object",
            additionalProperties: false,
            required: ["id", "subjects", "items"],
            properties: {
              compatibility_mode: {
                type: "string",
                const: "legacy_subject_order",
              },
              id: { type: "string", maxUtf8Bytes: 4 },
              subjects: {
                type: "array",
                minItems: 1,
                exactlyOnePrimary: "required_when_multiple",
                items: {
                  type: "object",
                  additionalProperties: false,
                  atLeastOneOf: ["canonical_id", "label"],
                  properties: {
                    canonical_id: { type: "string" },
                    label: { type: "string" },
                    primary: { type: "boolean" },
                  },
                },
              },
              items: {
                type: "array",
                uniqueByCanonicalIdentity: "id",
                items: {
                  type: "object",
                  required: ["id"],
                  properties: { id: { type: "string" } },
                },
              },
            },
            maxCanonicalJsonBytes: 512,
          },
        },
      },
      async () => ({ accepted: true }),
    );

    const valid = await app.inject({
      method: "POST",
      url: "/memory-batch",
      payload: {
        compatibility_mode: "legacy_subject_order",
        id: "界",
        subjects: [
          { canonical_id: "user-1" },
          { label: "project" },
        ],
        items: [{ id: "one" }, { id: "two" }],
      },
    });
    expect(valid.statusCode).toBe(200);

    for (const payload of [
      {
        id: "界界",
        subjects: [{ canonical_id: "user-1", primary: true }],
        items: [{ id: "one" }],
      },
      {
        id: "ok",
        subjects: [{ primary: true }],
        items: [{ id: "one" }],
      },
      {
        id: "ok",
        subjects: [
          { canonical_id: "user-1" },
          { label: "project" },
        ],
        items: [{ id: "one" }],
      },
      {
        id: "ok",
        subjects: [{ canonical_id: "user-1", primary: true }],
        items: [{ id: "same" }, { id: "same" }],
      },
    ]) {
      const response = await app.inject({
        method: "POST",
        url: "/memory-batch",
        payload,
      });
      expect(response.statusCode).toBe(400);
    }
  });
});
