import { createHash } from "node:crypto";

import {
  RuntimeFinalResultReadContractV1Schema,
  type RuntimeFinalResultReadContractV1,
} from "@pai/contracts";
import type { ObjectStorePortV1 } from "@pai/object-store";
import { Value } from "@sinclair/typebox/value";

import type { ActionRuntimeFinalResultObjectAccessPolicyV1 } from "./production-final-result-object-access-policy.v1.js";
import type {
  RuntimeExecutionStoreV1,
  RuntimeRunRecordV1,
} from "./runtime-execution.v1.js";

const MAX_FINAL_RESULT_BYTES_V1 = 1_048_576;

export interface RuntimeFinalResultReadPrincipalV1 {
  readonly sub: "trigger_processor";
  readonly aud: "action_runtime";
  readonly capability: readonly string[];
  readonly scope: Readonly<{
    workspace_id: string;
    bot_id: string;
    owner_agent_id: string;
    deployment_environment: "local" | "dev" | "staging" | "prod";
    release_channel: "stable" | "canary";
  }>;
}

export class RuntimeFinalResultReadErrorV1 extends Error {
  public constructor(
    public readonly code:
      | "authorization_scope_mismatch"
      | "runtime_not_found"
      | "runtime_not_completed"
      | "final_result_unavailable"
      | "final_result_integrity_mismatch",
    public readonly retryable: boolean,
  ) {
    super(code);
    this.name = "RuntimeFinalResultReadErrorV1";
  }
}

export interface RuntimeFinalResultReadApplicationV1 {
  read(
    principal: RuntimeFinalResultReadPrincipalV1,
    runtimeRunId: string,
    traceId: string,
    signal?: AbortSignal,
  ): Promise<RuntimeFinalResultReadContractV1>;
}

function scopeMatchesV1(
  principal: RuntimeFinalResultReadPrincipalV1,
  run: RuntimeRunRecordV1,
): boolean {
  return (
    principal.sub === "trigger_processor" &&
    principal.aud === "action_runtime" &&
    principal.capability.includes("runtime.final_result.read") &&
    principal.scope.workspace_id === run.request.workspace_id &&
    principal.scope.bot_id === run.request.bot_id &&
    principal.scope.owner_agent_id === run.request.owner_agent_id &&
    principal.scope.deployment_environment === run.request.deployment_environment &&
    principal.scope.release_channel === run.request.release_channel
  );
}

function terminalArtifactRefV1(run: RuntimeRunRecordV1): string | undefined {
  const completed = [...run.events].reverse().find(
    (event) => event.event_type === "runtime.run.completed",
  );
  const payload = completed?.payload as unknown;
  const ref =
    typeof payload === "object" &&
    payload !== null &&
    "terminal_artifact_ref" in payload
      ? (payload as Readonly<{ terminal_artifact_ref?: unknown }>).
          terminal_artifact_ref
      : undefined;
  return typeof ref === "string" && ref.length > 0 ? ref : undefined;
}

async function collectUtf8V1(
  body: AsyncIterable<Uint8Array>,
  expectedSize: number,
  signal: AbortSignal,
): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of body) {
    signal.throwIfAborted();
    if (!(chunk instanceof Uint8Array) || total + chunk.byteLength > expectedSize) {
      throw new RuntimeFinalResultReadErrorV1("final_result_integrity_mismatch", false);
    }
    total += chunk.byteLength;
    chunks.push(Uint8Array.from(chunk));
  }
  if (total !== expectedSize) {
    throw new RuntimeFinalResultReadErrorV1("final_result_integrity_mismatch", false);
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

export function createRuntimeFinalResultReadApplicationV1(dependencies: Readonly<{
  store: Pick<RuntimeExecutionStoreV1, "readRun" | "readArtifactByReference">;
  object_store: Pick<ObjectStorePortV1, "getStream">;
  access_policy: ActionRuntimeFinalResultObjectAccessPolicyV1;
  now?: () => Date;
}>): RuntimeFinalResultReadApplicationV1 {
  const now = dependencies.now ?? (() => new Date());
  return Object.freeze({
    async read(
      principal: RuntimeFinalResultReadPrincipalV1,
      runtimeRunId: string,
      traceId: string,
      signal = new AbortController().signal,
    ) {
      if (runtimeRunId.length < 1 || runtimeRunId.length > 512 || traceId.length < 1 || traceId.length > 512) {
        throw new RuntimeFinalResultReadErrorV1("runtime_not_found", false);
      }
      signal.throwIfAborted();
      const run = await dependencies.store.readRun(runtimeRunId);
      if (run === undefined) throw new RuntimeFinalResultReadErrorV1("runtime_not_found", false);
      if (!scopeMatchesV1(principal, run)) {
        throw new RuntimeFinalResultReadErrorV1("authorization_scope_mismatch", false);
      }
      if (run.status !== "completed") {
        throw new RuntimeFinalResultReadErrorV1("runtime_not_completed", true);
      }
      const artifactRef = terminalArtifactRefV1(run);
      if (artifactRef === undefined) {
        throw new RuntimeFinalResultReadErrorV1("final_result_unavailable", false);
      }
      const artifact = await dependencies.store.readArtifactByReference(runtimeRunId, artifactRef);
      if (
        artifact === undefined ||
        artifact.status !== "available" ||
        artifact.artifact_ref !== artifactRef ||
        artifact.artifact_kind !== "runtime-final-result" ||
        artifact.media_type !== "text/plain" ||
        artifact.size_bytes < 1 ||
        artifact.size_bytes > MAX_FINAL_RESULT_BYTES_V1 ||
        Date.parse(artifact.retention_until) <= now().getTime()
      ) {
        throw new RuntimeFinalResultReadErrorV1("final_result_unavailable", false);
      }
      const scope = {
        scope_kind: "bot" as const,
        workspace_id: run.request.workspace_id,
        bot_id: run.request.bot_id,
        owner_agent_id: run.request.owner_agent_id,
        deployment_environment: run.request.deployment_environment,
        release_channel: run.request.release_channel,
      };
      const access = await dependencies.access_policy.final_results.resolve({
        artifact_ref: artifactRef,
        artifact_id: artifact.artifact_id,
        start_fence_generation: artifact.start_fence_generation,
        scope,
      });
      signal.throwIfAborted();
      const stream = await dependencies.object_store.getStream({
        owner_service: "action_runtime",
        owner_object_id: artifact.artifact_id,
        owner_state_version: artifact.start_fence_generation,
        scope,
        capability: "runtime.artifact.read",
        object_ref: artifactRef as never,
        ...access,
      });
      if (
        stream.object_ref !== artifactRef ||
        stream.media_type !== "text/plain" ||
        stream.size_bytes !== artifact.size_bytes ||
        stream.sha256 !== artifact.content_hash ||
        stream.retention_until !== artifact.retention_until ||
        Date.parse(stream.retention_until) <= now().getTime()
      ) {
        throw new RuntimeFinalResultReadErrorV1("final_result_integrity_mismatch", false);
      }
      const bytes = await collectUtf8V1(stream.body, artifact.size_bytes, signal);
      const digest = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
      if (digest !== artifact.content_hash) {
        throw new RuntimeFinalResultReadErrorV1("final_result_integrity_mismatch", false);
      }
      let content: string;
      try {
        content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch {
        throw new RuntimeFinalResultReadErrorV1("final_result_integrity_mismatch", false);
      }
      const response: RuntimeFinalResultReadContractV1 = {
        schema_version: "runtime_final_result_read.v1",
        runtime_run_id: run.request.runtime_run_id,
        trigger_process_id: run.request.trigger_process_id,
        workspace_id: run.request.workspace_id,
        bot_id: run.request.bot_id,
        owner_agent_id: run.request.owner_agent_id,
        deployment_environment: run.request.deployment_environment,
        release_channel: run.request.release_channel,
        artifact_ref: artifactRef,
        content_hash: artifact.content_hash,
        retention_until: artifact.retention_until,
        content_type: "text/plain",
        content,
        trace_id: traceId,
      };
      if (!Value.Check(RuntimeFinalResultReadContractV1Schema, response)) {
        throw new RuntimeFinalResultReadErrorV1("final_result_integrity_mismatch", false);
      }
      return Object.freeze(response);
    },
  });
}
