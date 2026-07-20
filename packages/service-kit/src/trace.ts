import {
  context,
  isSpanContextValid,
  propagation,
  trace,
  TraceFlags,
  type Context,
} from "@opentelemetry/api";

const TRACE_ID_PATTERN = /^[0-9a-f]{32}$/;
const TRACEPARENT_PATTERN =
  /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})(.*)$/;
const ZERO_TRACE_ID = "00000000000000000000000000000000";
const ZERO_SPAN_ID = "0000000000000000";

export function createTraceId(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

function asCarrier(
  headers: Readonly<Record<string, string | readonly string[] | undefined>>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).flatMap(([key, value]) => {
      if (typeof value === "string") return [[key, value]];
      if (Array.isArray(value)) return [[key, value.join(",")]];
      return [];
    }),
  );
}

export function extractTelemetryContext(
  headers: Readonly<Record<string, string | readonly string[] | undefined>>,
): Context {
  return propagation.extract(context.active(), asCarrier(headers));
}

function traceIdFromTraceparent(traceparent: string): string | undefined {
  const match = TRACEPARENT_PATTERN.exec(traceparent);
  if (match === null) return undefined;

  const [, version, traceId, parentId, , suffix] = match;
  if (
    version === undefined ||
    version === "ff" ||
    traceId === undefined ||
    traceId === ZERO_TRACE_ID ||
    parentId === undefined ||
    parentId === ZERO_SPAN_ID
  ) {
    return undefined;
  }

  // Version 00 is fixed-width. Future versions may append fields, but the
  // first unknown field must start after a dash per W3C Trace Context 3.2.4.
  const suffixValue = suffix ?? "";
  if (
    version === "00"
      ? suffixValue !== ""
      : suffixValue !== "" && !suffixValue.startsWith("-")
  ) {
    return undefined;
  }
  return traceId;
}

export function extractInboundTraceId(
  headers: Readonly<Record<string, string | readonly string[] | undefined>>,
): string {
  const telemetryContext = extractTelemetryContext(headers);
  const telemetrySpanContext = trace.getSpanContext(telemetryContext);
  if (
    telemetrySpanContext !== undefined &&
    isSpanContextValid(telemetrySpanContext)
  ) {
    return telemetrySpanContext.traceId;
  }

  const traceparent = headers.traceparent;
  if (typeof traceparent === "string") {
    const traceId = traceIdFromTraceparent(traceparent);
    if (traceId !== undefined) return traceId;
  }

  const candidate = headers["x-trace-id"];
  if (
    typeof candidate === "string" &&
    TRACE_ID_PATTERN.test(candidate) &&
    candidate !== ZERO_TRACE_ID
  ) {
    return candidate;
  }
  return createTraceId();
}

export function contextForTraceId(traceId: string): Context {
  assertSafeTraceId(traceId);
  return trace.setSpanContext(context.active(), {
    traceId,
    spanId: crypto.randomUUID().replaceAll("-", "").slice(0, 16),
    traceFlags: TraceFlags.SAMPLED,
    isRemote: true,
  });
}

export function toTraceparent(traceId: string): string | undefined {
  if (!TRACE_ID_PATTERN.test(traceId)) return undefined;
  const spanId = crypto.randomUUID().replaceAll("-", "").slice(0, 16);
  return `00-${traceId}-${spanId}-01`;
}

export function assertSafeTraceId(traceId: string): void {
  if (
    !TRACE_ID_PATTERN.test(traceId) ||
    traceId === ZERO_TRACE_ID
  ) {
    throw new Error("trace id must be a non-zero 32-character lowercase hex value");
  }
}
