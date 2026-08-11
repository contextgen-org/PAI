import { createHash } from "node:crypto";
import { isIP } from "node:net";

import type { WorkloadCredentialSignerPort } from "@pai/auth";
import {
  MemoryDeepRecallRequestV1Schema,
  MemoryDeepRecallResponseV1Schema,
  TimerOccurrenceSnoozeCommandV1Schema,
  TimerOccurrenceSnoozeResponseV1Schema,
  TimerScheduleCancelCommandV1Schema,
  TimerScheduleCancelResponseV1Schema,
  TimerScheduleCommandResponseV1Schema,
  TimerScheduleCreateCommandV1Schema,
  TimerSchedulePauseCommandV1Schema,
  TimerSchedulePauseResponseV1Schema,
  TimerScheduleQueryResponseV1Schema,
  TimerScheduleResumeCommandV1Schema,
  TimerScheduleResumeResponseV1Schema,
  TimerScheduleUpdateCommandV1Schema,
  TimerScheduleUpdateResponseV1Schema,
  assertTimerScheduleQueryResponseBindingsV1,
  assertMemoryDeepRecallRequestSemanticBindingsV1,
  assertMemoryDeepRecallResponseSemanticBindingsV1,
  type MemoryDeepRecallRequestV1,
  type MemoryDeepRecallResponseV1,
  type TimerScheduleCommandResponseV1,
  type TimerScheduleQueryResponseV1,
} from "@pai/contracts";
import {
  TimerScheduleHistoryQueryParamsV1Schema,
  TimerScheduleListQueryParamsV1Schema,
  TimerScheduleReadQueryParamsV1Schema,
} from "@pai/contracts/timer/http-routes.v1";
import { canonicalJsonV1 } from "@pai/eventing";
import {
  InternalClientError,
  isTrustedLocalDockerHttpOriginV1,
  requestInternalJson,
} from "@pai/service-kit";
import { Value } from "@sinclair/typebox/value";

import type {
  RuntimeToolCallV1,
  RuntimeToolPortV1,
  RuntimeToolResultV1,
} from "./runtime-execution.v1.js";

export interface ActionRuntimeToolPortOptionsV1 {
  readonly memory_url: string;
  readonly timer_url: string;
  readonly signer: WorkloadCredentialSignerPort;
  /**
   * Optional Amazon Bedrock AgentCore Gateway bridge.  The bearer credential
   * remains in the Action Runtime process and is never placed in an SDK prompt,
   * a ToolPermissionProfile, or a model-visible MCP configuration.
   */
  readonly agentcore_web?: AgentCoreWebToolsOptionsV1;
  /**
   * Optional fixed personal-assistant MCP bridge.  This is deliberately a
   * named allowlist, rather than a generic "run any MCP tool" escape hatch:
   * configuration can select a remote implementation for a PAI logical tool,
   * but cannot create new PAI capabilities.
   */
  readonly personal_assistant_mcp?: PersonalAssistantMcpToolsOptionsV1;
  readonly request_timeout_ms?: number;
  readonly fetch?: typeof fetch;
  /** Injectable only to make relative reminder scheduling deterministic in tests. */
  readonly now?: () => Date;
}

export type ActionRuntimeToolPortV1 = RuntimeToolPortV1 & Readonly<{
  checkReadiness(signal: AbortSignal): Promise<void>;
}>;

export interface AgentCoreWebToolsOptionsV1 {
  /** Exact HTTPS AgentCore Gateway MCP endpoint, including its `/mcp` path. */
  readonly mcp_url: string;
  /** Server-only Gateway inbound-authorization bearer token. */
  readonly bearer_token: string;
  /** Exact Gateway tool names discovered during readiness. */
  readonly tools: Readonly<{
    readonly search: string;
    readonly fetch: string;
    readonly browser: string;
  }>;
}

const PERSONAL_ASSISTANT_TOOL_ROUTES_V1 = Object.freeze({
  "lark.message.search": Object.freeze({ capability: "lark.message.search", side_effecting: false }),
  "lark.message.send": Object.freeze({ capability: "lark.message.send", side_effecting: true }),
  "lark.doc.search": Object.freeze({ capability: "lark.doc.search", side_effecting: false }),
  "lark.doc.read": Object.freeze({ capability: "lark.doc.read", side_effecting: false }),
  "lark.calendar.list": Object.freeze({ capability: "lark.calendar.list", side_effecting: false }),
  "lark.calendar.freebusy": Object.freeze({ capability: "lark.calendar.freebusy", side_effecting: false }),
  "lark.calendar.create": Object.freeze({ capability: "lark.calendar.create", side_effecting: true }),
  "lark.calendar.update": Object.freeze({ capability: "lark.calendar.update", side_effecting: true }),
  "lark.calendar.cancel": Object.freeze({ capability: "lark.calendar.cancel", side_effecting: true }),
  "lark.drive.search": Object.freeze({ capability: "lark.drive.search", side_effecting: false }),
  "lark.drive.read": Object.freeze({ capability: "lark.drive.read", side_effecting: false }),
  "mail.search": Object.freeze({ capability: "mail.search", side_effecting: false }),
  "mail.read": Object.freeze({ capability: "mail.read", side_effecting: false }),
  "mail.send": Object.freeze({ capability: "mail.send", side_effecting: true }),
  "google.calendar.list": Object.freeze({ capability: "google.calendar.list", side_effecting: false }),
  "google.calendar.freebusy": Object.freeze({ capability: "google.calendar.freebusy", side_effecting: false }),
  "google.calendar.create": Object.freeze({ capability: "google.calendar.create", side_effecting: true }),
  "google.calendar.update": Object.freeze({ capability: "google.calendar.update", side_effecting: true }),
  "google.calendar.cancel": Object.freeze({ capability: "google.calendar.cancel", side_effecting: true }),
  "google.drive.search": Object.freeze({ capability: "google.drive.search", side_effecting: false }),
  "google.drive.read": Object.freeze({ capability: "google.drive.read", side_effecting: false }),
  "notion.search": Object.freeze({ capability: "notion.search", side_effecting: false }),
  "notion.read": Object.freeze({ capability: "notion.read", side_effecting: false }),
  "notion.create": Object.freeze({ capability: "notion.create", side_effecting: true }),
  "notion.update": Object.freeze({ capability: "notion.update", side_effecting: true }),
  // `document.extract` accepts only a PAI-managed immutable artifact_ref; it
  // never accepts a local path or a remote URL from a model or web page.
  "document.extract": Object.freeze({ capability: "document.extract", side_effecting: false }),
  // Image generation produces a PAI artifact but does not send or mutate a
  // third-party resource, so it is intentionally not a confirmation action.
  "image.generate": Object.freeze({ capability: "image.generate", side_effecting: false }),
});

export type PersonalAssistantMcpToolNameV1 =
  keyof typeof PERSONAL_ASSISTANT_TOOL_ROUTES_V1;

export interface PersonalAssistantMcpToolsOptionsV1 {
  /** Exact HTTPS MCP endpoint, including its `/mcp` path. */
  readonly mcp_url: string;
  /** Server-only inbound authorization bearer credential. */
  readonly bearer_token: string;
  /**
   * Mapping from a fixed PAI logical tool to an exact remote MCP name.  An
   * absent logical name is not granted and fails closed at invocation.
   */
  readonly tools: Readonly<
    Partial<Record<PersonalAssistantMcpToolNameV1, string>>
  >;
}

type RuntimeToolInvokeContextV1 = Parameters<RuntimeToolPortV1["invoke"]>[1];

const toolRoutesV1 = Object.freeze({
  "memory.deepRecall": Object.freeze({
    method: "memory.deep_recall" as const,
    capability: "memory.deep_recall" as const,
  }),
  "memory.deep_recall": Object.freeze({
    method: "memory.deep_recall" as const,
    capability: "memory.deep_recall" as const,
  }),
  "timer.create": Object.freeze({ method: "timer.create" as const, capability: "timer.write" as const }),
  "timer.remind_after": Object.freeze({ method: "timer.remind_after" as const, capability: "timer.write" as const }),
  "timer.remindAfter": Object.freeze({ method: "timer.remind_after" as const, capability: "timer.write" as const }),
  "timer.remind_at": Object.freeze({ method: "timer.remind_at" as const, capability: "timer.write" as const }),
  "timer.remindAt": Object.freeze({ method: "timer.remind_at" as const, capability: "timer.write" as const }),
  "timer.create_recurring": Object.freeze({ method: "timer.create_recurring" as const, capability: "timer.write" as const }),
  "timer.createRecurring": Object.freeze({ method: "timer.create_recurring" as const, capability: "timer.write" as const }),
  "timer.update": Object.freeze({ method: "timer.update" as const, capability: "timer.write" as const }),
  "timer.pause": Object.freeze({ method: "timer.pause" as const, capability: "timer.write" as const }),
  "timer.resume": Object.freeze({ method: "timer.resume" as const, capability: "timer.write" as const }),
  "timer.cancel": Object.freeze({ method: "timer.cancel" as const, capability: "timer.write" as const }),
  "timer.snooze": Object.freeze({ method: "timer.snooze" as const, capability: "timer.write" as const }),
  "timer.list": Object.freeze({ method: "timer.list" as const, capability: "timer.read" as const }),
  "timer.get": Object.freeze({ method: "timer.get" as const, capability: "timer.read" as const }),
  "timer.history": Object.freeze({ method: "timer.history" as const, capability: "timer.read" as const }),
  "weather.current": Object.freeze({
    method: "weather.current" as const,
    capability: "weather.read" as const,
  }),
  "web.search": Object.freeze({
    method: "web.search" as const,
    capability: "web.search" as const,
  }),
  "web.fetch": Object.freeze({
    method: "web.fetch" as const,
    capability: "web.fetch" as const,
  }),
  "web.browser": Object.freeze({
    method: "web.browser" as const,
    capability: "web.browser" as const,
  }),
  ...Object.fromEntries(
    Object.entries(PERSONAL_ASSISTANT_TOOL_ROUTES_V1).map(
      ([method, route]) => [
        method,
        Object.freeze({ method, capability: route.capability }),
      ],
    ),
  ),
});

type ToolRouteNameV1 = keyof typeof toolRoutesV1;
type TimerMethodV1 = Extract<
  (typeof toolRoutesV1)[ToolRouteNameV1]["method"],
  `timer.${string}`
>;
type AgentCoreWebMethodV1 = Extract<
  (typeof toolRoutesV1)[ToolRouteNameV1]["method"],
  `web.${string}`
>;

const WEATHER_GEOCODING_URL_V1 = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_FORECAST_URL_V1 = "https://api.open-meteo.com/v1/forecast";
const MAX_WEATHER_RESPONSE_BYTES_V1 = 128 * 1024;
const MAX_AGENTCORE_RESPONSE_BYTES_V1 = 512 * 1024;
const MAX_REMIND_AFTER_SECONDS_V1 = 31 * 24 * 60 * 60;
const REMIND_AFTER_ARGUMENT_KEYS_V1 = new Set([
  "after_seconds",
  "name",
  "message",
  "timezone",
  "end_time",
  "catch_up",
  "payload",
  "priority_hint",
  "intent_hint",
]);

class WeatherToolErrorV1 extends Error {
  public constructor(
    readonly code: "weather_location_not_found" | "weather_provider_unavailable" | "weather_provider_invalid_response",
    readonly retryable: boolean,
  ) {
    super(code);
  }
}

class AgentCoreWebToolErrorV1 extends Error {
  public constructor(
    readonly code:
      | "agentcore_web_not_configured"
      | "agentcore_web_auth_denied"
      | "agentcore_web_tool_missing"
      | "agentcore_web_gateway_unavailable"
      | "agentcore_web_gateway_invalid_response"
      | "agentcore_web_tool_denied",
    readonly retryable: boolean,
  ) {
    super(code);
  }
}

class PersonalAssistantMcpToolErrorV1 extends Error {
  public constructor(
    readonly code:
      | "personal_assistant_mcp_not_configured"
      | "personal_assistant_mcp_auth_denied"
      | "personal_assistant_mcp_tool_missing"
      | "personal_assistant_mcp_gateway_unavailable"
      | "personal_assistant_mcp_gateway_invalid_response"
      | "personal_assistant_mcp_tool_denied"
      | "personal_assistant_mcp_unsafe_arguments",
    readonly retryable: boolean,
  ) {
    super(code);
  }
}

function baseUrlV1(raw: string, label: string): string {
  const url = new URL(raw);
  const loopback =
    url.hostname === "127.0.0.1" ||
    url.hostname === "[::1]" ||
    url.hostname === "localhost";
  if (
    (url.protocol !== "https:" &&
      !(url.protocol === "http:" &&
        (loopback || isTrustedLocalDockerHttpOriginV1(url)))) ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.search.length > 0 ||
    url.hash.length > 0
  ) {
    throw new Error(`${label} is invalid`);
  }
  return url.toString().replace(/\/$/u, "");
}

function agentCoreToolNameV1(value: string, label: string): string {
  if (
    value.length === 0 ||
    value.length > 256 ||
    !/^[A-Za-z0-9_.:-]+$/u.test(value)
  ) {
    throw new Error(`${label} is invalid`);
  }
  return value;
}

function agentCoreWebConfigurationV1(
  value: AgentCoreWebToolsOptionsV1,
): Readonly<AgentCoreWebToolsOptionsV1> {
  const endpoint = new URL(baseUrlV1(value.mcp_url, "AgentCore MCP URL"));
  if (endpoint.protocol !== "https:" || !endpoint.pathname.endsWith("/mcp")) {
    throw new Error("AgentCore MCP URL must be an HTTPS /mcp endpoint");
  }
  if (
    typeof value.bearer_token !== "string" ||
    value.bearer_token.length === 0 ||
    value.bearer_token.length > 16_384 ||
    /[\r\n\u0000]/u.test(value.bearer_token)
  ) {
    throw new Error("AgentCore MCP bearer token is invalid");
  }
  return Object.freeze({
    mcp_url: endpoint.toString(),
    bearer_token: value.bearer_token,
    tools: Object.freeze({
      search: agentCoreToolNameV1(value.tools.search, "AgentCore search tool name"),
      fetch: agentCoreToolNameV1(value.tools.fetch, "AgentCore fetch tool name"),
      browser: agentCoreToolNameV1(value.tools.browser, "AgentCore browser tool name"),
    }),
  });
}

function isPersonalAssistantMcpToolNameV1(
  value: string,
): value is PersonalAssistantMcpToolNameV1 {
  return Object.hasOwn(PERSONAL_ASSISTANT_TOOL_ROUTES_V1, value);
}

function personalAssistantMcpToolsConfigurationV1(
  value: PersonalAssistantMcpToolsOptionsV1,
): Readonly<PersonalAssistantMcpToolsOptionsV1> {
  const endpoint = new URL(baseUrlV1(value.mcp_url, "Personal assistant MCP URL"));
  if (
    (endpoint.protocol !== "https:" && !isTrustedLocalDockerHttpOriginV1(endpoint)) ||
    !endpoint.pathname.endsWith("/mcp")
  ) {
    throw new Error("Personal assistant MCP URL must be an HTTPS /mcp endpoint or an approved local Docker origin");
  }
  if (
    typeof value.bearer_token !== "string" ||
    value.bearer_token.length === 0 ||
    value.bearer_token.length > 16_384 ||
    /[\r\n\u0000]/u.test(value.bearer_token)
  ) {
    throw new Error("Personal assistant MCP bearer token is invalid");
  }
  if (
    typeof value.tools !== "object" ||
    value.tools === null ||
    Array.isArray(value.tools)
  ) {
    throw new Error("Personal assistant MCP tool mapping is invalid");
  }
  const tools: Partial<Record<PersonalAssistantMcpToolNameV1, string>> = {};
  for (const [logicalName, remoteName] of Object.entries(value.tools)) {
    if (!isPersonalAssistantMcpToolNameV1(logicalName)) {
      throw new Error("Personal assistant MCP logical tool is not allowlisted");
    }
    if (typeof remoteName !== "string") {
      throw new Error("Personal assistant MCP tool mapping is invalid");
    }
    tools[logicalName] = agentCoreToolNameV1(
      remoteName,
      "Personal assistant MCP remote tool name",
    );
  }
  if (Object.keys(tools).length === 0) {
    throw new Error("Personal assistant MCP tool mapping must not be empty");
  }
  return Object.freeze({
    mcp_url: endpoint.toString(),
    bearer_token: value.bearer_token,
    tools: Object.freeze(tools),
  });
}

function boundedTimeoutV1(value: number): number {
  if (!Number.isSafeInteger(value) || value < 100 || value > 300_000) {
    throw new Error("Action Runtime tool request timeout is outside bounds");
  }
  return value;
}

function plainArgumentsV1(value: unknown): Readonly<Record<string, unknown>> {
  const cloned = JSON.parse(canonicalJsonV1(value)) as unknown;
  if (typeof cloned !== "object" || cloned === null || Array.isArray(cloned)) {
    throw new Error("Tool arguments must be a canonical JSON object");
  }
  return Object.freeze(cloned as Readonly<Record<string, unknown>>);
}

function stableIdV1(prefix: string, value: string): string {
  return `${prefix}_${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function botScopeV1(context: RuntimeToolInvokeContextV1) {
  return Object.freeze({
    scope_kind: "bot" as const,
    ...context.actor_binding.scope,
  });
}

function resultFailureV1(
  error: unknown,
  sideEffecting: boolean,
): RuntimeToolResultV1 {
  if (error instanceof WeatherToolErrorV1) {
    return Object.freeze({
      outcome: "failed" as const,
      retryable: error.retryable,
      side_effect_status: "none" as const,
      error: Object.freeze({
        code: error.code,
        message: "The weather provider could not complete the read-only request",
      }),
    });
  }
  if (error instanceof AgentCoreWebToolErrorV1) {
    return Object.freeze({
      outcome: "failed" as const,
      retryable: error.retryable,
      side_effect_status: "none" as const,
      error: Object.freeze({
        code: error.code,
        message:
          "The configured AgentCore web tool could not complete the request",
      }),
    });
  }
  if (error instanceof PersonalAssistantMcpToolErrorV1) {
    return Object.freeze({
      outcome: "failed" as const,
      // A request that might have changed a remote provider is deliberately
      // never retried automatically.  The durable invocation is left in an
      // unknown side-effect state for explicit operator/user recovery.
      retryable: sideEffecting ? false : error.retryable,
      side_effect_status: sideEffecting ? "unknown" as const : "none" as const,
      error: Object.freeze({
        code: error.code,
        message: "The configured personal-assistant tool could not complete the request",
      }),
    });
  }
  if (error instanceof InternalClientError) {
    const commitUnknown = sideEffecting && error.status === undefined;
    return Object.freeze({
      outcome: "failed" as const,
      retryable: commitUnknown ? false : error.retryable,
      side_effect_status: commitUnknown ? "unknown" as const : "none" as const,
      // The transport trace is intentionally not presented as durable evidence.
      // Runtime execution binds a redacted immutable audit/object reference before
      // accepting the result, so a provider-specific string cannot bypass that
      // evidence boundary.
      error: Object.freeze({
        code: error.code,
        message: "The owner service rejected or could not complete the tool request",
      }),
    });
  }
  return Object.freeze({
    outcome: "failed" as const,
    retryable: false,
    side_effect_status: sideEffecting ? "unknown" as const : "none" as const,
    error: Object.freeze({
      code: "tool_contract_invalid",
      message: "The tool request or owner response violated its contract",
    }),
  });
}

async function memoryDeepRecallV1(
  call: RuntimeToolCallV1,
  context: RuntimeToolInvokeContextV1,
  options: Readonly<{
    base_url: string;
    signer: WorkloadCredentialSignerPort;
    timeout_ms: number;
    fetch: typeof fetch;
  }>,
): Promise<RuntimeToolResultV1> {
  try {
    const args = plainArgumentsV1(call.arguments);
    const credential = await options.signer.sign({
      audience: "memory",
      capabilities: ["memory.deep_recall"],
      scope: botScopeV1(context),
    });
    context.signal.throwIfAborted();
    const request: MemoryDeepRecallRequestV1 = {
      ...args,
      schema_version: "memory.deep_recall.v1",
      bot_id: context.actor_binding.scope.bot_id,
      owner_agent_id: context.actor_binding.scope.owner_agent_id,
      runtime_run_id: context.runtime_run_id,
      trigger_process_id: context.trigger_process_id,
      scope:
        args.scope === undefined
          ? { channels: ["semantic", "timeline", "relationship"] }
          : (args.scope as MemoryDeepRecallRequestV1["scope"]),
      idempotency_key: stableIdV1("ar", context.idempotency_key),
      policy_snapshot_id: context.policy_snapshot_id,
      policy_snapshot_hash: context.policy_snapshot_hash as `sha256:${string}`,
      capability_token: credential,
      capability_token_id: context.permission_id,
      graph_profile_version: "memory.deep_recall_graph.v1",
    } as MemoryDeepRecallRequestV1;
    if (!Value.Check(MemoryDeepRecallRequestV1Schema, request)) {
      throw new Error("Memory deep recall request is invalid");
    }
    assertMemoryDeepRecallRequestSemanticBindingsV1(request);
    const response = await requestInternalJson<MemoryDeepRecallResponseV1>({
      url: `${options.base_url}/internal/memory/deep-recall`,
      method: "POST",
      workloadCredential: credential,
      json: request,
      timeoutMs: options.timeout_ms,
      idempotent: true,
      maxRetries: 2,
      maxResponseBytes: 16_777_216,
      signal: context.signal,
      fetchImpl: options.fetch,
    });
    if (!Value.Check(MemoryDeepRecallResponseV1Schema, response.body)) {
      throw new Error("Memory deep recall response is invalid");
    }
    assertMemoryDeepRecallResponseSemanticBindingsV1(response.body);
    return Object.freeze({
      outcome: "completed" as const,
      retryable: false,
      output: response.body,
      side_effect_status: "none" as const,
    });
  } catch (error) {
    return resultFailureV1(error, false);
  }
}

function timerCommandShapeV1(method: TimerMethodV1): Readonly<{
  route: (args: Readonly<Record<string, unknown>>) => string;
  http_method: "POST" | "PATCH";
  command: "create" | "update" | "pause" | "resume" | "cancel" | "snooze";
  request_schema: Parameters<typeof Value.Check>[0];
  response_schema: Parameters<typeof Value.Check>[0];
}> | undefined {
  if (["timer.create", "timer.remind_after", "timer.remind_at", "timer.create_recurring"].includes(method)) {
    return { route: () => "/internal/agent-timers", http_method: "POST", command: "create", request_schema: TimerScheduleCreateCommandV1Schema, response_schema: TimerScheduleCommandResponseV1Schema };
  }
  if (method === "timer.update") {
    return { route: (args) => `/internal/agent-timers/${encodeURIComponent(String(args.schedule_id))}`, http_method: "PATCH", command: "update", request_schema: TimerScheduleUpdateCommandV1Schema, response_schema: TimerScheduleUpdateResponseV1Schema };
  }
  if (method === "timer.pause") {
    return { route: (args) => `/internal/agent-timers/${encodeURIComponent(String(args.schedule_id))}/pause`, http_method: "POST", command: "pause", request_schema: TimerSchedulePauseCommandV1Schema, response_schema: TimerSchedulePauseResponseV1Schema };
  }
  if (method === "timer.resume") {
    return { route: (args) => `/internal/agent-timers/${encodeURIComponent(String(args.schedule_id))}/resume`, http_method: "POST", command: "resume", request_schema: TimerScheduleResumeCommandV1Schema, response_schema: TimerScheduleResumeResponseV1Schema };
  }
  if (method === "timer.cancel") {
    return { route: (args) => `/internal/agent-timers/${encodeURIComponent(String(args.schedule_id))}/cancel`, http_method: "POST", command: "cancel", request_schema: TimerScheduleCancelCommandV1Schema, response_schema: TimerScheduleCancelResponseV1Schema };
  }
  if (method === "timer.snooze") {
    return { route: (args) => `/internal/timer-occurrences/${encodeURIComponent(String(args.occurrence_id))}/snooze`, http_method: "POST", command: "snooze", request_schema: TimerOccurrenceSnoozeCommandV1Schema, response_schema: TimerOccurrenceSnoozeResponseV1Schema };
  }
  return undefined;
}

function timerCommandArgumentsV1(
  method: TimerMethodV1,
  args: Readonly<Record<string, unknown>>,
  now: Date,
): Readonly<Record<string, unknown>> {
  if (method !== "timer.remind_after" || args.after_seconds === undefined) {
    return args;
  }
  if (
    Object.hasOwn(args, "schedule") ||
    Object.keys(args).some((key) => !REMIND_AFTER_ARGUMENT_KEYS_V1.has(key))
  ) {
    throw new Error("Relative reminder arguments are invalid");
  }
  const afterSeconds = args.after_seconds;
  if (
    typeof afterSeconds !== "number" ||
    !Number.isSafeInteger(afterSeconds) ||
    afterSeconds < 1 ||
    afterSeconds > MAX_REMIND_AFTER_SECONDS_V1
  ) {
    throw new Error("Relative reminder delay is outside bounds");
  }
  const fireAt = new Date(now.getTime() + afterSeconds * 1_000).toISOString();
  const schedule = Object.freeze({
    name: args.name ?? "Reminder",
    message: args.message,
    timezone: args.timezone ?? "UTC",
    // A personal relative reminder is expected to be delivered at least once.
    // A caller may explicitly opt out, but an unavailable worker must not turn
    // the default chat reminder into a silent permanent miss.
    catch_up: args.catch_up ?? true,
    schedule_type: "once" as const,
    fire_at: fireAt,
    ...(args.end_time === undefined ? {} : { end_time: args.end_time }),
    ...(args.payload === undefined ? {} : { payload: args.payload }),
    ...(args.priority_hint === undefined
      ? {}
      : { priority_hint: args.priority_hint }),
    ...(args.intent_hint === undefined ? {} : { intent_hint: args.intent_hint }),
  });
  return Object.freeze({ schedule });
}

async function timerWriteV1(
  method: TimerMethodV1,
  call: RuntimeToolCallV1,
  context: RuntimeToolInvokeContextV1,
  options: Readonly<{
    base_url: string;
    signer: WorkloadCredentialSignerPort;
    timeout_ms: number;
    fetch: typeof fetch;
    now: () => Date;
  }>,
): Promise<RuntimeToolResultV1> {
  try {
    const args = plainArgumentsV1(call.arguments);
    const commandArgs = timerCommandArgumentsV1(method, args, options.now());
    const shape = timerCommandShapeV1(method);
    if (shape === undefined) throw new Error("Timer write route is unknown");
    const credential = await options.signer.sign({
      audience: "timer_trigger_app",
      capabilities: ["timer.write"],
      scope: botScopeV1(context),
    });
    const request = {
      ...commandArgs,
      schema_version: "timer.schedule_command.v1",
      ...context.actor_binding.scope,
      runtime_run_id: context.runtime_run_id,
      trigger_process_id: context.trigger_process_id,
      client_request_id: stableIdV1("ar", context.idempotency_key),
      trace_id: context.trace_id,
      method,
      command: shape.command,
    };
    if (!Value.Check(shape.request_schema, request)) {
      throw new Error("Timer command request is invalid");
    }
    const response = await requestInternalJson<TimerScheduleCommandResponseV1>({
      url: `${options.base_url}${shape.route(commandArgs)}`,
      method: shape.http_method,
      workloadCredential: credential,
      json: request,
      timeoutMs: options.timeout_ms,
      idempotent: true,
      maxRetries: 2,
      maxResponseBytes: 1_048_576,
      signal: context.signal,
      fetchImpl: options.fetch,
    });
    if (!Value.Check(shape.response_schema, response.body)) {
      throw new Error("Timer command response is invalid");
    }
    return Object.freeze({
      outcome: "completed" as const,
      retryable: false,
      output: response.body,
      side_effect_status: "produced" as const,
    });
  } catch (error) {
    return resultFailureV1(error, true);
  }
}

async function timerReadV1(
  method: "timer.list" | "timer.get" | "timer.history",
  call: RuntimeToolCallV1,
  context: RuntimeToolInvokeContextV1,
  options: Readonly<{
    base_url: string;
    signer: WorkloadCredentialSignerPort;
    timeout_ms: number;
    fetch: typeof fetch;
  }>,
): Promise<RuntimeToolResultV1> {
  try {
    const args = plainArgumentsV1(call.arguments);
    const credential = await options.signer.sign({
      audience: "timer_trigger_app",
      capabilities: ["timer.read"],
      scope: botScopeV1(context),
    });
    const query = {
      runtime_run_id: context.runtime_run_id,
      trace_id: context.trace_id,
      ...(args.status === undefined ? {} : { status: args.status }),
      ...(args.limit === undefined ? {} : { limit: args.limit }),
      ...(args.cursor === undefined ? {} : { cursor: args.cursor }),
    };
    const schema = method === "timer.list"
      ? TimerScheduleListQueryParamsV1Schema
      : method === "timer.history"
        ? TimerScheduleHistoryQueryParamsV1Schema
        : TimerScheduleReadQueryParamsV1Schema;
    if (!Value.Check(schema, query)) throw new Error("Timer query is invalid");
    if (
      method !== "timer.list" &&
      (typeof args.schedule_id !== "string" || args.schedule_id.length === 0)
    ) {
      throw new Error("Timer schedule_id is required");
    }
    const parameters = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      parameters.set(key, String(value));
    }
    const path = method === "timer.list"
      ? "/internal/agent-timers"
      : `/internal/agent-timers/${encodeURIComponent(String(args.schedule_id))}${method === "timer.history" ? "/history" : ""}`;
    const response = await requestInternalJson<TimerScheduleQueryResponseV1>({
      url: `${options.base_url}${path}?${parameters.toString()}`,
      method: "GET",
      workloadCredential: credential,
      timeoutMs: options.timeout_ms,
      idempotent: true,
      maxRetries: 2,
      maxResponseBytes: 1_048_576,
      signal: context.signal,
      fetchImpl: options.fetch,
    });
    if (!Value.Check(TimerScheduleQueryResponseV1Schema, response.body)) {
      throw new Error("Timer query response is invalid");
    }
    assertTimerScheduleQueryResponseBindingsV1(
      response.body,
      context.actor_binding.scope,
    );
    return Object.freeze({
      outcome: "completed" as const,
      retryable: false,
      output: response.body,
      side_effect_status: "none" as const,
    });
  } catch (error) {
    return resultFailureV1(error, false);
  }
}

function safeWeatherLocationV1(value: unknown): string {
  if (typeof value !== "string") {
    throw new WeatherToolErrorV1("weather_provider_invalid_response", false);
  }
  const location = value.trim();
  if (
    location.length === 0 ||
    location.length > 128 ||
    /[\u0000-\u001f\u007f]/u.test(location)
  ) {
    throw new WeatherToolErrorV1("weather_provider_invalid_response", false);
  }
  return location;
}

async function readBoundedJsonV1(
  response: Response,
): Promise<unknown> {
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new WeatherToolErrorV1(
      "weather_provider_unavailable",
      response.status === 408 || response.status === 429 || response.status >= 500,
    );
  }
  const declaredLength = response.headers.get("content-length");
  if (
    declaredLength !== null &&
    (!/^\d+$/u.test(declaredLength) || Number(declaredLength) > MAX_WEATHER_RESPONSE_BYTES_V1)
  ) {
    await response.body?.cancel().catch(() => undefined);
    throw new WeatherToolErrorV1("weather_provider_invalid_response", false);
  }
  const reader = response.body?.getReader();
  if (reader === undefined) {
    throw new WeatherToolErrorV1("weather_provider_invalid_response", false);
  }
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > MAX_WEATHER_RESPONSE_BYTES_V1) {
        throw new WeatherToolErrorV1("weather_provider_invalid_response", false);
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(new TextDecoder().decode(Buffer.concat(chunks)));
  } catch {
    throw new WeatherToolErrorV1("weather_provider_invalid_response", false);
  }
}

function agentCoreResponseEnvelopesFromSseV1(
  text: string,
): readonly unknown[] {
  const values: unknown[] = [];
  for (const event of text.replaceAll("\r\n", "\n").split("\n\n")) {
    const data = event
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice("data:".length).replace(/^ /u, ""))
      .join("\n");
    if (data.length === 0) continue;
    try {
      values.push(JSON.parse(data));
    } catch {
      throw new AgentCoreWebToolErrorV1(
        "agentcore_web_gateway_invalid_response",
        false,
      );
    }
  }
  if (values.length === 0) {
    throw new AgentCoreWebToolErrorV1(
      "agentcore_web_gateway_invalid_response",
      false,
    );
  }
  return Object.freeze(values);
}

async function readBoundedAgentCoreEnvelopesV1(
  response: Response,
): Promise<readonly unknown[]> {
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    if (response.status === 401 || response.status === 403) {
      throw new AgentCoreWebToolErrorV1("agentcore_web_auth_denied", false);
    }
    if (response.status === 404) {
      throw new AgentCoreWebToolErrorV1("agentcore_web_tool_missing", false);
    }
    if (
      response.status === 408 ||
      response.status === 425 ||
      response.status === 429 ||
      response.status >= 500
    ) {
      throw new AgentCoreWebToolErrorV1("agentcore_web_gateway_unavailable", true);
    }
    throw new AgentCoreWebToolErrorV1(
      "agentcore_web_gateway_invalid_response",
      false,
    );
  }
  const declaredLength = response.headers.get("content-length");
  if (
    declaredLength !== null &&
    (!/^\d+$/u.test(declaredLength) ||
      Number(declaredLength) > MAX_AGENTCORE_RESPONSE_BYTES_V1)
  ) {
    await response.body?.cancel().catch(() => undefined);
    throw new AgentCoreWebToolErrorV1(
      "agentcore_web_gateway_invalid_response",
      false,
    );
  }
  const reader = response.body?.getReader();
  if (reader === undefined) {
    throw new AgentCoreWebToolErrorV1(
      "agentcore_web_gateway_invalid_response",
      false,
    );
  }
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > MAX_AGENTCORE_RESPONSE_BYTES_V1) {
        throw new AgentCoreWebToolErrorV1(
          "agentcore_web_gateway_invalid_response",
          false,
        );
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const contentType = response.headers.get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  const body = new TextDecoder().decode(Buffer.concat(chunks));
  try {
    if (contentType === "application/json") {
      return Object.freeze([JSON.parse(body)]);
    }
    if (contentType === "text/event-stream") {
      return agentCoreResponseEnvelopesFromSseV1(body);
    }
  } catch (error) {
    if (error instanceof AgentCoreWebToolErrorV1) throw error;
  }
  {
    throw new AgentCoreWebToolErrorV1(
      "agentcore_web_gateway_invalid_response",
      false,
    );
  }
}

function plainRecordV1(value: unknown): Readonly<Record<string, unknown>> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  return value as Readonly<Record<string, unknown>>;
}

function boundedAgentCoreSnapshotV1(value: unknown): unknown {
  try {
    return JSON.parse(
      canonicalJsonV1(value, { max_bytes: MAX_AGENTCORE_RESPONSE_BYTES_V1 }),
    );
  } catch {
    throw new AgentCoreWebToolErrorV1(
      "agentcore_web_gateway_invalid_response",
      false,
    );
  }
}

function agentCoreResponseResultV1(
  envelopes: readonly unknown[],
  requestId: string,
): Readonly<Record<string, unknown>> {
  const envelope = envelopes
    .map(plainRecordV1)
    .find((candidate) => candidate?.jsonrpc === "2.0" && candidate.id === requestId);
  if (envelope === undefined) {
    throw new AgentCoreWebToolErrorV1(
      "agentcore_web_gateway_invalid_response",
      false,
    );
  }
  if (plainRecordV1(envelope.error) !== undefined) {
    throw new AgentCoreWebToolErrorV1("agentcore_web_tool_denied", false);
  }
  const result = plainRecordV1(envelope.result);
  if (result === undefined) {
    throw new AgentCoreWebToolErrorV1(
      "agentcore_web_gateway_invalid_response",
      false,
    );
  }
  return result;
}

type McpConnectionOptionsV1 = Readonly<{
  mcp_url: string;
  bearer_token: string;
}>;

async function requestAgentCoreMcpV1(
  configuration: McpConnectionOptionsV1,
  requestId: string,
  method: "initialize" | "tools/list" | "tools/call",
  params: Readonly<Record<string, unknown>> | undefined,
  timeoutMs: number,
  signal: AbortSignal,
  fetchImpl: typeof fetch,
  sessionId: string | undefined,
): Promise<Readonly<{ result: Readonly<Record<string, unknown>>; session_id: string | undefined }>> {
  let response: Response;
  try {
    response = await fetchImpl(configuration.mcp_url, {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        authorization: `Bearer ${configuration.bearer_token}`,
        "content-type": "application/json",
        ...(sessionId === undefined ? {} : { "mcp-session-id": sessionId }),
      },
      body: canonicalJsonV1({
        jsonrpc: "2.0",
        id: requestId,
        method,
        ...(params === undefined ? {} : { params }),
      }),
      redirect: "error",
      signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
    });
  } catch {
    throw new AgentCoreWebToolErrorV1(
      "agentcore_web_gateway_unavailable",
      !signal.aborted,
    );
  }
  return Object.freeze({
    result: agentCoreResponseResultV1(
      await readBoundedAgentCoreEnvelopesV1(response),
      requestId,
    ),
    session_id: response.headers.get("mcp-session-id") ?? undefined,
  });
}

async function notifyAgentCoreMcpInitializedV1(
  configuration: McpConnectionOptionsV1,
  sessionId: string | undefined,
  timeoutMs: number,
  signal: AbortSignal,
  fetchImpl: typeof fetch,
): Promise<void> {
  let response: Response;
  try {
    response = await fetchImpl(configuration.mcp_url, {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        authorization: `Bearer ${configuration.bearer_token}`,
        "content-type": "application/json",
        ...(sessionId === undefined ? {} : { "mcp-session-id": sessionId }),
      },
      body: canonicalJsonV1({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }),
      redirect: "error",
      signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
    });
  } catch {
    throw new AgentCoreWebToolErrorV1(
      "agentcore_web_gateway_unavailable",
      !signal.aborted,
    );
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    if (response.status === 401 || response.status === 403) {
      throw new AgentCoreWebToolErrorV1("agentcore_web_auth_denied", false);
    }
    if (response.status === 404) {
      throw new AgentCoreWebToolErrorV1("agentcore_web_tool_missing", false);
    }
    throw new AgentCoreWebToolErrorV1(
      response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500
        ? "agentcore_web_gateway_unavailable"
        : "agentcore_web_gateway_invalid_response",
      !signal.aborted && (response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500),
    );
  }
  await response.body?.cancel().catch(() => undefined);
}

async function callAgentCoreMcpV1(
  configuration: McpConnectionOptionsV1,
  requestId: string,
  method: "tools/list" | "tools/call",
  params: Readonly<Record<string, unknown>> | undefined,
  timeoutMs: number,
  signal: AbortSignal,
  fetchImpl: typeof fetch,
): Promise<Readonly<Record<string, unknown>>> {
  const initialized = await requestAgentCoreMcpV1(
    configuration,
    stableIdV1("agentcore", `${requestId}:initialize`),
    "initialize",
    Object.freeze({
      protocolVersion: "2025-06-18",
      capabilities: Object.freeze({}),
      clientInfo: Object.freeze({ name: "pai-action-runtime", version: "1" }),
    }),
    timeoutMs,
    signal,
    fetchImpl,
    undefined,
  );
  await notifyAgentCoreMcpInitializedV1(
    configuration,
    initialized.session_id,
    timeoutMs,
    signal,
    fetchImpl,
  );
  return (
    await requestAgentCoreMcpV1(
      configuration,
      requestId,
      method,
      params,
      timeoutMs,
      signal,
      fetchImpl,
      initialized.session_id,
    )
  ).result;
}

function remoteAgentCoreToolNameV1(
  method: AgentCoreWebMethodV1,
  configuration: Readonly<AgentCoreWebToolsOptionsV1>,
): string {
  if (method === "web.search") return configuration.tools.search;
  if (method === "web.fetch") return configuration.tools.fetch;
  return configuration.tools.browser;
}

async function agentCoreWebToolV1(
  method: AgentCoreWebMethodV1,
  call: RuntimeToolCallV1,
  context: RuntimeToolInvokeContextV1,
  options: Readonly<{
    configuration: Readonly<AgentCoreWebToolsOptionsV1> | undefined;
    timeout_ms: number;
    fetch: typeof fetch;
  }>,
): Promise<RuntimeToolResultV1> {
  try {
    if (options.configuration === undefined) {
      throw new AgentCoreWebToolErrorV1(
        "agentcore_web_not_configured",
        false,
      );
    }
    const args = plainArgumentsV1(call.arguments);
    assertPublicWebArgumentsV1(args);
    const remoteTool = remoteAgentCoreToolNameV1(method, options.configuration);
    const result = await callAgentCoreMcpV1(
      options.configuration,
      stableIdV1("agentcore", `${context.idempotency_key}:${method}`),
      "tools/call",
      Object.freeze({ name: remoteTool, arguments: args }),
      options.timeout_ms,
      context.signal,
      options.fetch,
    );
    if (result.isError === true || !Array.isArray(result.content)) {
      throw new AgentCoreWebToolErrorV1("agentcore_web_tool_denied", false);
    }
    return Object.freeze({
      outcome: "completed" as const,
      retryable: false,
      side_effect_status: "none" as const,
      output: Object.freeze({
        provider: "amazon-bedrock-agentcore-gateway",
        remote_tool: remoteTool,
        // Web text, links, and browser snapshots are untrusted input.  The
        // adapter system prompt names that trust boundary before any model can
        // consume this durable tool result.
        content: boundedAgentCoreSnapshotV1(result.content),
      }),
    });
  } catch (error) {
    return resultFailureV1(error, false);
  }
}

function privateOrLocalHostV1(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/u, "");
  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal")
  ) {
    return true;
  }
  const family = isIP(normalized);
  if (family === 6) return true;
  if (family !== 4) return false;
  const octets = normalized.split(".").map(Number);
  const [first, second] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    first === 169 && second === 254 ||
    first === 172 && second !== undefined && second >= 16 && second <= 31 ||
    first === 192 && second === 168 ||
    first === 100 && second !== undefined && second >= 64 && second <= 127 ||
    first === 198 && second === 18 ||
    first === 198 && second === 19
  );
}

function assertPublicWebArgumentsV1(
  value: unknown,
  key = "",
): void {
  if (Array.isArray(value)) {
    for (const item of value) assertPublicWebArgumentsV1(item, key);
    return;
  }
  const record = plainRecordV1(value);
  if (record !== undefined) {
    for (const [childKey, childValue] of Object.entries(record)) {
      assertPublicWebArgumentsV1(childValue, childKey);
    }
    return;
  }
  if (
    typeof value !== "string" ||
    !/(?:url|uri|origin|host|hostname|domain|address|endpoint|target)/iu.test(key)
  ) {
    return;
  }
  let url: URL;
  try {
    url = new URL(
      /^(?:url|uri|origin|endpoint|target)$/iu.test(key)
        ? value
        : `https://${value}`,
    );
  } catch {
    throw new AgentCoreWebToolErrorV1(
      "agentcore_web_gateway_invalid_response",
      false,
    );
  }
  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    privateOrLocalHostV1(url.hostname)
  ) {
    throw new AgentCoreWebToolErrorV1("agentcore_web_tool_denied", false);
  }
}

function assertNoCredentialArgumentsV1(
  value: unknown,
  key = "",
): void {
  const normalizedKey = key.toLowerCase();
  if (
    /(?:authorization|bearer|credential|secret|password|api[_-]?key|cookie|session)/u.test(
      normalizedKey,
    )
  ) {
    throw new PersonalAssistantMcpToolErrorV1(
      "personal_assistant_mcp_unsafe_arguments",
      false,
    );
  }
  if (Array.isArray(value)) {
    for (const item of value) assertNoCredentialArgumentsV1(item, key);
    return;
  }
  const record = plainRecordV1(value);
  if (record === undefined) return;
  for (const [childKey, childValue] of Object.entries(record)) {
    assertNoCredentialArgumentsV1(childValue, childKey);
  }
}

/**
 * Personal-assistant providers resolve their own opaque resource ids.  PAI
 * deliberately does not let a model turn a mail/document/calendar request
 * into a provider-side arbitrary URL, host, path, or endpoint request.  Text
 * being sent after a user confirmation is not itself a network target, so the
 * guard is keyed to transport-like field names rather than scanning values.
 */
function assertNoIndirectNetworkTargetArgumentsV1(
  value: unknown,
  key = "",
): void {
  const normalizedKey = key
    .replace(/([a-z0-9])([A-Z])/gu, "$1_$2")
    .toLowerCase();
  if (
    /(?:^|[_-])(?:url|uri|origin|host|hostname|domain|address|endpoint|target|path|file_path)(?:$|[_-])/iu.test(
      normalizedKey,
    )
  ) {
    throw new PersonalAssistantMcpToolErrorV1(
      "personal_assistant_mcp_unsafe_arguments",
      false,
    );
  }
  if (Array.isArray(value)) {
    for (const item of value) assertNoIndirectNetworkTargetArgumentsV1(item, key);
    return;
  }
  const record = plainRecordV1(value);
  if (record === undefined) return;
  for (const [childKey, childValue] of Object.entries(record)) {
    assertNoIndirectNetworkTargetArgumentsV1(childValue, childKey);
  }
}

function assertPersonalAssistantArgumentsV1(
  method: PersonalAssistantMcpToolNameV1,
  args: Readonly<Record<string, unknown>>,
): void {
  assertNoCredentialArgumentsV1(args);
  assertNoIndirectNetworkTargetArgumentsV1(args);
  if (method === "document.extract") {
    const artifactRef = args.artifact_ref;
    if (
      typeof artifactRef !== "string" ||
      !/^objv1_[a-f0-9]{64}$/u.test(artifactRef) ||
      Object.keys(args).some((key) => key !== "artifact_ref" && key !== "options")
    ) {
      throw new PersonalAssistantMcpToolErrorV1(
        "personal_assistant_mcp_unsafe_arguments",
        false,
      );
    }
  }
}

/**
 * The Action Runtime, not the model, binds every personal-assistant request
 * to the delegated user whose Trigger started this durable run.  This travels
 * in JSON-RPC `_meta`, rather than tool `arguments`, so it cannot collide with
 * a provider schema or be manufactured by a prompt/tool result.  The gateway
 * still authenticates Action Runtime with its own deployment bearer token.
 */
function personalAssistantRequestMetaV1(
  context: RuntimeToolInvokeContextV1,
): Readonly<Record<string, unknown>> {
  const delegated = context.actor_binding.delegated_principal;
  if (delegated === null) {
    throw new PersonalAssistantMcpToolErrorV1(
      "personal_assistant_mcp_tool_denied",
      false,
    );
  }
  return Object.freeze({
    "io.pai.personal-assistant": Object.freeze({
      principal_id: delegated.principal_id,
      principal_type: delegated.principal_type,
      scope: Object.freeze({ ...context.actor_binding.scope }),
      actor_binding_hash: context.actor_binding_hash,
    }),
  });
}

function personalAssistantErrorFromMcpV1(
  error: unknown,
): PersonalAssistantMcpToolErrorV1 {
  if (error instanceof PersonalAssistantMcpToolErrorV1) return error;
  if (error instanceof AgentCoreWebToolErrorV1) {
    const code = error.code === "agentcore_web_auth_denied"
      ? "personal_assistant_mcp_auth_denied"
      : error.code === "agentcore_web_tool_missing"
        ? "personal_assistant_mcp_tool_missing"
        : error.code === "agentcore_web_gateway_unavailable"
          ? "personal_assistant_mcp_gateway_unavailable"
          : error.code === "agentcore_web_tool_denied"
            ? "personal_assistant_mcp_tool_denied"
            : "personal_assistant_mcp_gateway_invalid_response";
    return new PersonalAssistantMcpToolErrorV1(code, error.retryable);
  }
  return new PersonalAssistantMcpToolErrorV1(
    "personal_assistant_mcp_gateway_invalid_response",
    false,
  );
}

async function personalAssistantMcpToolV1(
  method: PersonalAssistantMcpToolNameV1,
  call: RuntimeToolCallV1,
  context: RuntimeToolInvokeContextV1,
  options: Readonly<{
    configuration: Readonly<PersonalAssistantMcpToolsOptionsV1> | undefined;
    timeout_ms: number;
    fetch: typeof fetch;
  }>,
): Promise<RuntimeToolResultV1> {
  const route = PERSONAL_ASSISTANT_TOOL_ROUTES_V1[method];
  try {
    if (options.configuration === undefined) {
      throw new PersonalAssistantMcpToolErrorV1(
        "personal_assistant_mcp_not_configured",
        false,
      );
    }
    const remoteTool = options.configuration.tools[method];
    if (remoteTool === undefined) {
      throw new PersonalAssistantMcpToolErrorV1(
        "personal_assistant_mcp_not_configured",
        false,
      );
    }
    const args = plainArgumentsV1(call.arguments);
    assertPersonalAssistantArgumentsV1(method, args);
    const result = await callAgentCoreMcpV1(
      options.configuration,
      stableIdV1("personal-assistant", `${context.idempotency_key}:${method}`),
      "tools/call",
      Object.freeze({
        name: remoteTool,
        arguments: args,
        _meta: personalAssistantRequestMetaV1(context),
      }),
      options.timeout_ms,
      context.signal,
      options.fetch,
    );
    if (result.isError === true || !Array.isArray(result.content)) {
      throw new PersonalAssistantMcpToolErrorV1(
        "personal_assistant_mcp_tool_denied",
        false,
      );
    }
    return Object.freeze({
      outcome: "completed" as const,
      retryable: false,
      side_effect_status: route.side_effecting ? "produced" as const : "none" as const,
      output: Object.freeze({
        provider: "personal-assistant-mcp",
        remote_tool: remoteTool,
        logical_tool: method,
        // Provider text and embedded links are inert, untrusted data.  The
        // Agent SDK prompt is explicitly prohibited from treating them as
        // instructions, credentials, or network authority.
        content: boundedAgentCoreSnapshotV1(result.content),
      }),
    });
  } catch (error) {
    return resultFailureV1(
      personalAssistantErrorFromMcpV1(error),
      route.side_effecting,
    );
  }
}

async function checkPersonalAssistantMcpToolsV1(
  configuration: Readonly<PersonalAssistantMcpToolsOptionsV1>,
  timeoutMs: number,
  signal: AbortSignal,
  fetchImpl: typeof fetch,
): Promise<void> {
  try {
    const result = await callAgentCoreMcpV1(
      configuration,
      stableIdV1("personal-assistant", "readiness:tools/list"),
      "tools/list",
      undefined,
      timeoutMs,
      signal,
      fetchImpl,
    );
    const tools = result.tools;
    if (!Array.isArray(tools)) {
      throw new PersonalAssistantMcpToolErrorV1(
        "personal_assistant_mcp_gateway_invalid_response",
        false,
      );
    }
    const names = new Set(
      tools.flatMap((tool) => {
        const record = plainRecordV1(tool);
        return typeof record?.name === "string" ? [record.name] : [];
      }),
    );
    for (const expected of Object.values(configuration.tools)) {
      if (expected !== undefined && !names.has(expected)) {
        throw new PersonalAssistantMcpToolErrorV1(
          "personal_assistant_mcp_tool_missing",
          false,
        );
      }
    }
  } catch (error) {
    throw personalAssistantErrorFromMcpV1(error);
  }
}

async function checkAgentCoreWebToolsV1(
  configuration: Readonly<AgentCoreWebToolsOptionsV1>,
  timeoutMs: number,
  signal: AbortSignal,
  fetchImpl: typeof fetch,
): Promise<void> {
  const result = await callAgentCoreMcpV1(
    configuration,
    stableIdV1("agentcore", "readiness:tools/list"),
    "tools/list",
    undefined,
    timeoutMs,
    signal,
    fetchImpl,
  );
  const tools = result.tools;
  if (!Array.isArray(tools)) {
    throw new AgentCoreWebToolErrorV1(
      "agentcore_web_gateway_invalid_response",
      false,
    );
  }
  const names = new Set(
    tools.flatMap((tool) => {
      const record = plainRecordV1(tool);
      return typeof record?.name === "string" ? [record.name] : [];
    }),
  );
  for (const expected of Object.values(configuration.tools)) {
    if (!names.has(expected)) {
      throw new AgentCoreWebToolErrorV1("agentcore_web_tool_missing", false);
    }
  }
}

function finiteNumberV1(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

async function weatherCurrentV1(
  call: RuntimeToolCallV1,
  context: RuntimeToolInvokeContextV1,
  options: Readonly<{ timeout_ms: number; fetch: typeof fetch }>,
): Promise<RuntimeToolResultV1> {
  try {
    const args = plainArgumentsV1(call.arguments);
    const location = safeWeatherLocationV1(args.location);
    const signal = AbortSignal.any([
      context.signal,
      AbortSignal.timeout(options.timeout_ms),
    ]);
    let geocodingResponse: Response;
    try {
      const url = new URL(WEATHER_GEOCODING_URL_V1);
      url.searchParams.set("name", location);
      url.searchParams.set("count", "1");
      url.searchParams.set("language", "zh");
      url.searchParams.set("format", "json");
      geocodingResponse = await options.fetch(url, {
        headers: { accept: "application/json" },
        redirect: "error",
        signal,
      });
    } catch {
      throw new WeatherToolErrorV1(
        "weather_provider_unavailable",
        !context.signal.aborted,
      );
    }
    const geocoding = await readBoundedJsonV1(geocodingResponse);
    const match =
      typeof geocoding === "object" && geocoding !== null &&
      Array.isArray((geocoding as { results?: unknown }).results)
        ? (geocoding as { results: unknown[] }).results[0]
        : undefined;
    if (typeof match !== "object" || match === null) {
      throw new WeatherToolErrorV1("weather_location_not_found", false);
    }
    const latitude = finiteNumberV1((match as { latitude?: unknown }).latitude);
    const longitude = finiteNumberV1((match as { longitude?: unknown }).longitude);
    const name = (match as { name?: unknown }).name;
    if (
      latitude === undefined || longitude === undefined ||
      typeof name !== "string" || name.length === 0 || name.length > 256
    ) {
      throw new WeatherToolErrorV1("weather_provider_invalid_response", false);
    }
    let forecastResponse: Response;
    try {
      const url = new URL(WEATHER_FORECAST_URL_V1);
      url.searchParams.set("latitude", String(latitude));
      url.searchParams.set("longitude", String(longitude));
      url.searchParams.set(
        "current",
        "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,is_day",
      );
      url.searchParams.set("timezone", "auto");
      url.searchParams.set("forecast_days", "1");
      forecastResponse = await options.fetch(url, {
        headers: { accept: "application/json" },
        redirect: "error",
        signal,
      });
    } catch {
      throw new WeatherToolErrorV1(
        "weather_provider_unavailable",
        !context.signal.aborted,
      );
    }
    const forecast = await readBoundedJsonV1(forecastResponse);
    const current =
      typeof forecast === "object" && forecast !== null
        ? (forecast as { current?: unknown }).current
        : undefined;
    if (typeof current !== "object" || current === null) {
      throw new WeatherToolErrorV1("weather_provider_invalid_response", false);
    }
    const observedAt = (current as { time?: unknown }).time;
    const temperature = finiteNumberV1((current as { temperature_2m?: unknown }).temperature_2m);
    const weatherCode = finiteNumberV1((current as { weather_code?: unknown }).weather_code);
    if (typeof observedAt !== "string" || !Number.isFinite(Date.parse(observedAt)) || temperature === undefined || weatherCode === undefined) {
      throw new WeatherToolErrorV1("weather_provider_invalid_response", false);
    }
    const optional = (key: string) => finiteNumberV1((current as Record<string, unknown>)[key]);
    const locationField = (key: "country" | "admin1" | "timezone") => {
      const value = (match as Record<string, unknown>)[key];
      return typeof value === "string" && value.length <= 256 ? value : undefined;
    };
    return Object.freeze({
      outcome: "completed" as const,
      retryable: false,
      side_effect_status: "none" as const,
      output: Object.freeze({
        provider: "open-meteo",
        location: Object.freeze({
          name,
          latitude,
          longitude,
          ...(locationField("country") === undefined ? {} : { country: locationField("country") }),
          ...(locationField("admin1") === undefined ? {} : { admin1: locationField("admin1") }),
          ...(locationField("timezone") === undefined ? {} : { timezone: locationField("timezone") }),
        }),
        current: Object.freeze({
          observed_at: observedAt,
          temperature_c: temperature,
          weather_code: weatherCode,
          ...(optional("apparent_temperature") === undefined ? {} : { apparent_temperature_c: optional("apparent_temperature") }),
          ...(optional("relative_humidity_2m") === undefined ? {} : { relative_humidity_percent: optional("relative_humidity_2m") }),
          ...(optional("precipitation") === undefined ? {} : { precipitation_mm: optional("precipitation") }),
          ...(optional("wind_speed_10m") === undefined ? {} : { wind_speed_kmh: optional("wind_speed_10m") }),
          ...(optional("wind_direction_10m") === undefined ? {} : { wind_direction_degrees: optional("wind_direction_10m") }),
          ...(optional("is_day") === undefined ? {} : { is_day: optional("is_day") === 1 }),
        }),
      }),
    });
  } catch (error) {
    return resultFailureV1(error, false);
  }
}

export function createActionRuntimeToolPortV1(
  options: ActionRuntimeToolPortOptionsV1,
): ActionRuntimeToolPortV1 {
  const memoryUrl = baseUrlV1(options.memory_url, "Memory URL");
  const timerUrl = baseUrlV1(options.timer_url, "Timer URL");
  const agentCoreWeb =
    options.agentcore_web === undefined
      ? undefined
      : agentCoreWebConfigurationV1(options.agentcore_web);
  const personalAssistantMcp =
    options.personal_assistant_mcp === undefined
      ? undefined
      : personalAssistantMcpToolsConfigurationV1(options.personal_assistant_mcp);
  const timeoutMs = boundedTimeoutV1(options.request_timeout_ms ?? 10_000);
  const fetchImpl = options.fetch ?? fetch;
  const now = options.now ?? (() => new Date());
  const checkServiceLiveV1 = async (
    serviceUrl: string,
    label: string,
    signal: AbortSignal,
  ): Promise<void> => {
    const response = await fetchImpl(`${serviceUrl}/health`, {
      method: "GET",
      redirect: "error",
      signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
    });
    await response.body?.cancel().catch(() => undefined);
    signal.throwIfAborted();
    if (!response.ok) throw new Error(`${label} is not live`);
  };
  return Object.freeze({
    capabilityFor(toolName: string): string {
      const route = toolRoutesV1[toolName as ToolRouteNameV1];
      if (route === undefined) throw new Error("Unknown trusted tool route");
      return route.capability;
    },
    async invoke(
      call: Parameters<RuntimeToolPortV1["invoke"]>[0],
      context: Parameters<RuntimeToolPortV1["invoke"]>[1],
    ) {
      const route = toolRoutesV1[call.tool_name as ToolRouteNameV1];
      if (route === undefined || route.capability !== call.capability) {
        return resultFailureV1(new Error("Tool authorization route drift"), false);
      }
      if (route.method === "memory.deep_recall") {
        return memoryDeepRecallV1(call, context, {
          base_url: memoryUrl,
          signer: options.signer,
          timeout_ms: timeoutMs,
          fetch: fetchImpl,
        });
      }
      if (route.method === "weather.current") {
        return weatherCurrentV1(call, context, {
          timeout_ms: timeoutMs,
          fetch: fetchImpl,
        });
      }
      if (
        route.method === "web.search" ||
        route.method === "web.fetch" ||
        route.method === "web.browser"
      ) {
        return agentCoreWebToolV1(route.method, call, context, {
          configuration: agentCoreWeb,
          timeout_ms: timeoutMs,
          fetch: fetchImpl,
        });
      }
      if (isPersonalAssistantMcpToolNameV1(call.tool_name)) {
        return personalAssistantMcpToolV1(call.tool_name, call, context, {
          configuration: personalAssistantMcp,
          timeout_ms: timeoutMs,
          fetch: fetchImpl,
        });
      }
      if (
        route.method === "timer.list" ||
        route.method === "timer.get" ||
        route.method === "timer.history"
      ) {
        return timerReadV1(route.method, call, context, {
          base_url: timerUrl,
          signer: options.signer,
          timeout_ms: timeoutMs,
          fetch: fetchImpl,
        });
      }
      return timerWriteV1(route.method, call, context, {
        base_url: timerUrl,
        signer: options.signer,
        timeout_ms: timeoutMs,
        fetch: fetchImpl,
        now,
      });
    },
    async checkReadiness(signal: AbortSignal) {
      signal.throwIfAborted();
      await Promise.all([
        checkServiceLiveV1(memoryUrl, "Memory", signal),
        checkServiceLiveV1(timerUrl, "Timer", signal),
        ...(agentCoreWeb === undefined
          ? []
          : [
              checkAgentCoreWebToolsV1(
                agentCoreWeb,
                timeoutMs,
                signal,
                fetchImpl,
              ),
            ]),
        ...(personalAssistantMcp === undefined
          ? []
          : [
              checkPersonalAssistantMcpToolsV1(
                personalAssistantMcp,
                timeoutMs,
                signal,
                fetchImpl,
              ),
            ]),
      ]);
      signal.throwIfAborted();
    },
  });
}
