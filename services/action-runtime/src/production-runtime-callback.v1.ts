import {
  RuntimeDomainEventV1Schema,
  RuntimeEventAppendRequestV1Schema,
  RuntimeEventAppendResponseV1Schema,
  assertRuntimeDomainEventSemanticBindingsV1,
  assertRuntimeEventAppendBindingsV1,
  assertRuntimeObservationSummaryBindingsV1,
  type RuntimeDomainEventV1,
  type RuntimeEventAppendRequestV1,
  type RuntimeEventAppendResponseV1,
} from "@pai/contracts";
import type { WorkloadCredentialSignerPort } from "@pai/auth";
import { canonicalPayloadHashV1 } from "@pai/eventing";
import {
  isTrustedLocalDockerHttpOriginV1,
  requestInternalJson,
} from "@pai/service-kit";
import { Value } from "@sinclair/typebox/value";

import {
  RuntimeExecutionErrorV1,
  type RuntimeEventCallbackPortV1,
} from "./runtime-execution.v1.js";

export interface ActionRuntimeCallbackOptionsV1 {
  readonly trigger_processor_url: string;
  readonly signer: WorkloadCredentialSignerPort;
  readonly worker_id: string;
  readonly lease_seconds: number;
  readonly transport_epoch: string;
  readonly transport_generation: number;
  readonly request_timeout_ms?: number;
  readonly fetch?: typeof fetch;
}

export type ActionRuntimeCallbackV1 = RuntimeEventCallbackPortV1 & Readonly<{
  checkReadiness(signal: AbortSignal): Promise<void>;
}>;

const identifierPatternV1 = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,511}$/u;

function baseUrlV1(raw: string): string {
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
    throw new Error("Trigger Processor URL is invalid");
  }
  return url.toString().replace(/\/$/u, "");
}

function integerV1(
  value: number,
  minimum: number,
  maximum: number,
  label: string,
): number {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} is outside its supported range`);
  }
  return value;
}

function recordV1(value: unknown): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new RuntimeExecutionErrorV1(
      "runtime_adapter_failed",
      "Runtime callback event payload is invalid",
    );
  }
  return value as Readonly<Record<string, unknown>>;
}

function nullableStringV1(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function nullableDurationV1(value: unknown): number | null {
  return Number.isSafeInteger(value) && (value as number) >= 0
    ? (value as number)
    : null;
}

function observationSummaryV1(
  event: RuntimeDomainEventV1,
): RuntimeEventAppendRequestV1["observation_summary"] {
  const payload = recordV1(event.payload);
  const common = {
    status:
      typeof payload.status === "string" ? payload.status : event.event_type,
    duration_ms: nullableDurationV1(payload.duration_ms),
    reason_code: nullableStringV1(payload.reason_code),
    error_summary: nullableStringV1(payload.error_summary),
  };
  if (event.event_type.startsWith("runtime.run.")) {
    return {
      ...common,
      runtime_run_id: String(payload.runtime_run_id),
      artifact_ref: nullableStringV1(payload.terminal_artifact_ref),
    };
  }
  if (event.event_type.startsWith("runtime.tool.")) {
    return {
      ...common,
      tool_invocation_id: String(payload.tool_invocation_id),
      tool_name: String(payload.tool_name),
      artifact_ref: nullableStringV1(payload.artifact_ref),
    };
  }
  if (event.event_type.startsWith("runtime.control_signal.")) {
    return {
      ...common,
      runtime_signal_id: String(payload.runtime_signal_id),
      safe_point_ref: nullableStringV1(payload.safe_point_ref),
      isolation_proof_ref: nullableStringV1(payload.isolation_proof_ref),
      artifact_ref: null,
    };
  }
  if (event.event_type.startsWith("runtime.skill.load.")) {
    return {
      ...common,
      skill_key: String(payload.skill_key),
      skill_version: nullableStringV1(payload.skill_version),
      artifact_ref: nullableStringV1(payload.materialized_artifact_ref),
    };
  }
  return {
    ...common,
    runtime_run_id: String(payload.runtime_run_id),
    artifact_ref: nullableStringV1(payload.artifact_ref),
  };
}

function appendRequestV1(event: RuntimeDomainEventV1): RuntimeEventAppendRequestV1 {
  const payload = recordV1(event.payload);
  const request: RuntimeEventAppendRequestV1 = {
    trigger_process_id: String(payload.trigger_process_id),
    runtime_run_id: String(payload.runtime_run_id),
    source_event_id: event.event_id,
    source_service: "action_runtime",
    source_sequence_no: Number(payload.sequence_no),
    event_type: event.event_type,
    schema_version: event.schema_version,
    occurred_at: event.occurred_at,
    trace_id: event.trace_id,
    append_type: "runtime_event",
    payload_ref: `runtime_event:${event.event_id}`,
    payload_hash: canonicalPayloadHashV1(event),
    observation_summary: observationSummaryV1(event),
    idempotency_key: `action_runtime:${event.event_id}`,
  };
  if (!Value.Check(RuntimeEventAppendRequestV1Schema, request)) {
    throw new RuntimeExecutionErrorV1(
      "runtime_adapter_failed",
      "Runtime callback append request violates the owner contract",
    );
  }
  assertRuntimeEventAppendBindingsV1(request, "action_runtime", event);
  assertRuntimeObservationSummaryBindingsV1(request, event);
  return Object.freeze(request);
}

export function createActionRuntimeCallbackV1(
  options: ActionRuntimeCallbackOptionsV1,
): ActionRuntimeCallbackV1 {
  const triggerProcessorUrl = baseUrlV1(options.trigger_processor_url);
  if (
    !identifierPatternV1.test(options.worker_id) ||
    !identifierPatternV1.test(options.transport_epoch)
  ) {
    throw new Error("Action Runtime callback identity is invalid");
  }
  const leaseSeconds = integerV1(
    options.lease_seconds,
    15,
    300,
    "callback lease_seconds",
  );
  const generation = integerV1(
    options.transport_generation,
    1,
    Number.MAX_SAFE_INTEGER,
    "callback transport_generation",
  );
  const timeoutMs = integerV1(
    options.request_timeout_ms ?? 10_000,
    100,
    300_000,
    "callback request_timeout_ms",
  );
  const fetchImpl = options.fetch ?? fetch;

  return Object.freeze({
    worker_id: options.worker_id,
    lease_seconds: leaseSeconds,
    transport_epoch: options.transport_epoch,
    transport_generation: generation,
    async deliver(
      eventValue: Parameters<RuntimeEventCallbackPortV1["deliver"]>[0],
      claim: Parameters<RuntimeEventCallbackPortV1["deliver"]>[1],
      signal?: AbortSignal,
    ) {
      signal?.throwIfAborted();
      if (
        claim.transport_epoch !== options.transport_epoch ||
        claim.transport_generation !== generation
      ) {
        throw new RuntimeExecutionErrorV1(
          "runtime_adapter_failed",
          "Runtime callback claim transport fence is stale",
        );
      }
      if (!Value.Check(RuntimeDomainEventV1Schema, eventValue)) {
        throw new RuntimeExecutionErrorV1(
          "runtime_adapter_failed",
          "Runtime callback received an invalid owner event",
        );
      }
      assertRuntimeDomainEventSemanticBindingsV1(eventValue);
      const event = eventValue as RuntimeDomainEventV1;
      const payload = recordV1(event.payload);
      const request = appendRequestV1(event);
      const credential = await options.signer.sign({
        audience: "trigger_processor",
        capabilities: ["trigger.process.snapshot.append"],
        scope: {
          scope_kind: "bot",
          workspace_id: String(payload.workspace_id),
          bot_id: String(payload.bot_id),
          owner_agent_id: String(payload.owner_agent_id),
          deployment_environment: payload.deployment_environment as
            | "local"
            | "dev"
            | "staging"
            | "prod",
          release_channel: payload.release_channel as "stable" | "canary",
        },
      });
      signal?.throwIfAborted();
      const response = await requestInternalJson<RuntimeEventAppendResponseV1>({
        url: `${triggerProcessorUrl}/internal/trigger-processes/${encodeURIComponent(request.trigger_process_id)}/runtime-events`,
        method: "POST",
        workloadCredential: credential,
        json: request,
        timeoutMs,
        idempotent: true,
        maxRetries: 2,
        ...(signal === undefined ? {} : { signal }),
        fetchImpl,
      });
      if (
        !Value.Check(RuntimeEventAppendResponseV1Schema, response.body) ||
        response.body.trace_id !== request.trace_id ||
        response.body.details.trigger_process_id !== request.trigger_process_id
      ) {
        throw new RuntimeExecutionErrorV1(
          "runtime_adapter_failed",
          "Trigger Processor returned an invalid runtime callback receipt",
          true,
        );
      }
      if (response.body.code === "snapshot_pending_gap") {
        // The Trigger owner has durably recorded the callback, but it cannot
        // advance the per-source cursor until its bounded gap timeout has
        // elapsed.  ACKing Action Runtime's outbox here would strand that
        // source event forever: no producer retry would remain to replay it
        // once the owner appends the explicit gap marker.  Retain the event
        // under the existing fenced outbox retry protocol instead.
        throw new RuntimeExecutionErrorV1(
          "runtime_adapter_failed",
          "Trigger Processor queued the runtime callback behind a source gap",
          true,
        );
      }
      const version =
        "snapshot_version" in response.body.details
          ? response.body.details.snapshot_version
          : request.source_sequence_no;
      return Object.freeze({
        transport_ref:
          `trigger_processor:${response.body.code}:` +
          `${request.source_event_id}:${version}:${claim.attempt_count}`,
      });
    },
    async checkReadiness(signal: AbortSignal) {
      signal.throwIfAborted();
      const response = await fetchImpl(`${triggerProcessorUrl}/health`, {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
      });
      await response.body?.cancel().catch(() => undefined);
      signal.throwIfAborted();
      if (!response.ok) throw new Error("Trigger Processor is not live");
    },
  });
}
