import { AsyncLocalStorage } from "node:async_hooks";

import {
  context,
  isSpanContextValid,
  ROOT_CONTEXT,
  trace,
  TraceFlags,
  type Context,
  type ContextManager,
  type Span,
  type SpanContext,
  type Tracer,
  type TracerProvider,
} from "@opentelemetry/api";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createServiceApp, requestInternalJson } from "../src/index.js";

class TestContextManager implements ContextManager {
  readonly #storage = new AsyncLocalStorage<Context>();

  active(): Context {
    return this.#storage.getStore() ?? ROOT_CONTEXT;
  }

  with<A extends unknown[], F extends (...args: A) => ReturnType<F>>(
    activeContext: Context,
    fn: F,
    thisArg?: ThisParameterType<F>,
    ...args: A
  ): ReturnType<F> {
    return this.#storage.run(activeContext, () => fn.apply(thisArg, args));
  }

  bind<T>(activeContext: Context, target: T): T {
    if (typeof target !== "function") return target;
    const manager = this;
    const bound = function (this: unknown, ...args: unknown[]) {
      return manager.with(activeContext, target as (...values: unknown[]) => unknown, this, ...args);
    };
    return bound as T;
  }

  enable(): this {
    return this;
  }

  disable(): this {
    this.#storage.disable();
    return this;
  }
}

interface RecordedSpan {
  readonly name: string;
  readonly context: SpanContext;
  readonly parent_span_id: string | undefined;
  ended: boolean;
}

const recordedSpans: RecordedSpan[] = [];
let nextSpanId = 1;
let nextTraceId = 1;

function hexadecimalId(value: number, length: number): string {
  return value.toString(16).padStart(length, "0");
}

function createRecordingSpan(
  name: string,
  parentContext: Context,
): Span {
  const parent = trace.getSpanContext(parentContext);
  const validParent = parent !== undefined && isSpanContextValid(parent);
  const spanContext: SpanContext = {
    traceId: validParent ? parent.traceId : hexadecimalId(nextTraceId++, 32),
    spanId: hexadecimalId(nextSpanId++, 16),
    traceFlags: TraceFlags.SAMPLED,
  };
  const record: RecordedSpan = {
    name,
    context: spanContext,
    parent_span_id: validParent ? parent.spanId : undefined,
    ended: false,
  };
  recordedSpans.push(record);

  let span: Span;
  span = {
    spanContext: () => spanContext,
    setAttribute: () => span,
    setAttributes: () => span,
    addEvent: () => span,
    addLink: () => span,
    addLinks: () => span,
    setStatus: () => span,
    updateName: () => span,
    end: () => {
      record.ended = true;
    },
    isRecording: () => true,
    recordException: () => undefined,
  };
  return span;
}

const recordingTracer = {
  startSpan(name: string, _options = {}, parentContext = context.active()) {
    return createRecordingSpan(name, parentContext);
  },
  startActiveSpan(name: string, ...args: unknown[]) {
    const fn = args.at(-1) as (span: Span) => unknown;
    const explicitContext =
      args.length === 3 ? (args[1] as Context) : context.active();
    const span = createRecordingSpan(name, explicitContext);
    return context.with(trace.setSpan(explicitContext, span), fn, undefined, span);
  },
} as Tracer;

const recordingProvider: TracerProvider = {
  getTracer: () => recordingTracer,
};

context.setGlobalContextManager(new TestContextManager().enable());
trace.setGlobalTracerProvider(recordingProvider);

const apps: ReturnType<typeof createServiceApp>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
  recordedSpans.length = 0;
});

describe("OpenTelemetry parentage", () => {
  it("keeps the internal CLIENT span under the active SERVER span", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ accepted: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const app = createServiceApp("trigger_processor");
    apps.push(app);
    app.get("/parentage", async () => {
      const activeServerContext = trace.getSpanContext(context.active());
      const downstream = await requestInternalJson<{ accepted: boolean }>({
        url: "http://action-runtime.test/internal/work",
        workloadCredential: "header.payload.signature",
        timeoutMs: 100,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      return {
        active_server_span_id: activeServerContext?.spanId,
        downstream_trace_id: downstream.traceId,
      };
    });

    const traceId = "4bf92f3577b34da6a3ce929d0e0e4736";
    const response = await app.inject({
      method: "GET",
      url: "/parentage",
      headers: {
        traceparent: `00-${traceId}-00f067aa0ba902b7-01`,
      },
    });
    expect(response.statusCode).toBe(200);

    const server = recordedSpans.find((span) => span.name === "pai.http.request");
    const client = recordedSpans.find((span) => span.name === "pai.internal.request");
    expect(server).toBeDefined();
    expect(client).toBeDefined();
    expect(response.json()).toEqual({
      active_server_span_id: server?.context.spanId,
      downstream_trace_id: traceId,
    });
    expect(client?.context.traceId).toBe(server?.context.traceId);
    expect(client?.parent_span_id).toBe(server?.context.spanId);
    expect(server?.ended).toBe(true);
    expect(client?.ended).toBe(true);
  });
});
