import { createHash } from "node:crypto";

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
  readonly request_timeout_ms?: number;
  readonly fetch?: typeof fetch;
}

export type ActionRuntimeToolPortV1 = RuntimeToolPortV1 & Readonly<{
  checkReadiness(signal: AbortSignal): Promise<void>;
}>;

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
});

type ToolRouteNameV1 = keyof typeof toolRoutesV1;
type TimerMethodV1 = Exclude<
  (typeof toolRoutesV1)[ToolRouteNameV1]["method"],
  "memory.deep_recall"
>;

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
  if (error instanceof InternalClientError) {
    const commitUnknown = sideEffecting && error.status === undefined;
    return Object.freeze({
      outcome: "failed" as const,
      retryable: commitUnknown ? false : error.retryable,
      side_effect_status: commitUnknown ? "unknown" as const : "none" as const,
      external_error_ref: `internal:${error.traceId}:${error.code}`,
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
      external_response_ref: `memory:${response.body.details.request_id}`,
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

async function timerWriteV1(
  method: TimerMethodV1,
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
    const shape = timerCommandShapeV1(method);
    if (shape === undefined) throw new Error("Timer write route is unknown");
    const credential = await options.signer.sign({
      audience: "timer_trigger_app",
      capabilities: ["timer.write"],
      scope: botScopeV1(context),
    });
    const request = {
      ...args,
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
      url: `${options.base_url}${shape.route(args)}`,
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
      external_response_ref: `timer:${response.body.timer_command_request_id}`,
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
      external_response_ref: `timer:${method}:${context.idempotency_key}`,
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
  const timeoutMs = boundedTimeoutV1(options.request_timeout_ms ?? 10_000);
  const fetchImpl = options.fetch ?? fetch;
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
      });
    },
    async checkReadiness(signal: AbortSignal) {
      signal.throwIfAborted();
      await Promise.all([
        checkServiceLiveV1(memoryUrl, "Memory", signal),
        checkServiceLiveV1(timerUrl, "Timer", signal),
      ]);
      signal.throwIfAborted();
    },
  });
}
