import { createPrivateKey } from "node:crypto";

import {
  WorkloadJwtSigner,
  normalizePrivateKeyPemEnvironmentValueV1,
  type AuthorizationScopeV1,
  type WorkloadCredentialSignerPort,
} from "@pai/auth";
import {
  ContextSnapshotReadContractV1Schema,
  RuntimeStartReservationValidateResponseV1Schema,
  SkillContentResponseV1Schema,
  SkillResolveResponseV1Schema,
  assertContextSnapshotReadBindingsV1,
  assertSkillContentResponseSemanticBindingsV1,
  assertSkillResolveResponseSemanticBindingsV1,
  type ContextSnapshotReadContractV1,
  type ContextSnapshotResolveRequestV1,
  type RuntimeStartReservationValidateResponseV1,
  type SkillContentResponseV1,
  type SkillResolveRequestV1,
  type SkillResolveResponseV1,
} from "@pai/contracts";
import {
  isTrustedLocalDockerHttpOriginV1,
  requestInternalJson,
} from "@pai/service-kit";
import { materializeSkillTarV1 } from "@pai/skill-package";
import { Value } from "@sinclair/typebox/value";

import {
  RuntimeExecutionErrorV1,
  type RuntimeContextSnapshotPortV1,
  type RuntimeSkillPortV1,
  type RuntimeStartReservationValidationPortV1,
} from "./runtime-execution.v1.js";

export interface ActionRuntimeHttpPortsOptionsV1 {
  readonly trigger_processor_url: string;
  readonly skill_registry_url: string;
  readonly signer: WorkloadCredentialSignerPort;
  readonly request_timeout_ms?: number;
  readonly content_max_bytes?: number;
  readonly fetch?: typeof fetch;
  readonly now?: () => Date;
}

export interface ActionRuntimeHttpPortsV1 {
  readonly reservation: RuntimeStartReservationValidationPortV1;
  readonly context_snapshots: RuntimeContextSnapshotPortV1;
  readonly skills: RuntimeSkillPortV1;
  checkReadiness(signal: AbortSignal): Promise<void>;
}

function baseUrlV1(raw: string, label: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${label} must be an absolute URL`);
  }
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
    throw new Error(`${label} must use HTTPS except on loopback and must not contain credentials, query, or fragment`);
  }
  return url.toString().replace(/\/$/u, "");
}

function botScopeV1(scope: Readonly<{
  workspace_id: string;
  bot_id: string;
  owner_agent_id: string;
  deployment_environment: "local" | "dev" | "staging" | "prod";
  release_channel: "stable" | "canary";
}>): AuthorizationScopeV1 {
  return Object.freeze({ scope_kind: "bot" as const, ...scope });
}

async function boundedResponseBytesV1(
  response: Response,
  maximum: number,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  if (!response.ok || response.body === null) {
    throw new RuntimeExecutionErrorV1(
      "skill_content_mismatch",
      "Skill content grant could not be downloaded",
      response.status >= 500,
    );
  }
  const declared = response.headers.get("content-length");
  if (declared !== null) {
    const size = Number(declared);
    if (!Number.isSafeInteger(size) || size < 1 || size > maximum) {
      throw new RuntimeExecutionErrorV1(
        "skill_content_mismatch",
        "Skill content length is outside the bounded package contract",
      );
    }
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      signal?.throwIfAborted();
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > maximum) {
        await reader.cancel();
        throw new RuntimeExecutionErrorV1(
          "skill_content_mismatch",
          "Skill content exceeded the bounded package contract",
        );
      }
      chunks.push(next.value.slice());
    }
  } finally {
    reader.releaseLock();
  }
  if (size === 0) {
    throw new RuntimeExecutionErrorV1(
      "skill_content_mismatch",
      "Skill content grant returned an empty package",
    );
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function signedContentUrlV1(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new RuntimeExecutionErrorV1(
      "skill_content_mismatch",
      "Skill content grant URL is not absolute",
    );
  }
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
    url.hash.length > 0
  ) {
    throw new RuntimeExecutionErrorV1(
      "skill_content_mismatch",
      "Skill content grant URL must use HTTPS except on loopback and must not contain credentials or a fragment",
    );
  }
  // Supabase Storage signed URLs carry their capability token in the query
  // string. Preserve the exact grant URL; never normalize away its signature.
  return url.toString();
}

export function createActionRuntimeWorkloadSignerFromEnvV1(
  env: NodeJS.ProcessEnv,
): WorkloadCredentialSignerPort {
  const pem = env.PAI_WORKLOAD_SIGNING_PRIVATE_KEY_PEM;
  const keyId = env.PAI_WORKLOAD_SIGNING_KEY_ID;
  const algorithm = env.PAI_WORKLOAD_SIGNING_ALGORITHM;
  if (pem === undefined || keyId === undefined || algorithm === undefined) {
    throw new Error(
      "PAI_WORKLOAD_SIGNING_PRIVATE_KEY_PEM, PAI_WORKLOAD_SIGNING_KEY_ID, and PAI_WORKLOAD_SIGNING_ALGORITHM are required",
    );
  }
  if (algorithm !== "EdDSA" && algorithm !== "ES256" && algorithm !== "RS256") {
    throw new Error("PAI_WORKLOAD_SIGNING_ALGORITHM must be EdDSA, ES256, or RS256");
  }
  return new WorkloadJwtSigner({
    subject: "action_runtime",
    privateKey: createPrivateKey(normalizePrivateKeyPemEnvironmentValueV1(pem)),
    keyId,
    algorithm,
  });
}

export function createActionRuntimeHttpPortsV1(
  options: ActionRuntimeHttpPortsOptionsV1,
): ActionRuntimeHttpPortsV1 {
  const triggerProcessorUrl = baseUrlV1(
    options.trigger_processor_url,
    "Trigger Processor URL",
  );
  const skillRegistryUrl = baseUrlV1(
    options.skill_registry_url,
    "Skill Registry URL",
  );
  const timeoutMs = options.request_timeout_ms ?? 10_000;
  const contentMaximum = options.content_max_bytes ?? 31_457_280;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 300_000) {
    throw new Error("Action Runtime internal request timeout is outside bounds");
  }
  if (
    !Number.isSafeInteger(contentMaximum) ||
    contentMaximum < 1 ||
    contentMaximum > 31_457_280
  ) {
    throw new Error("Action Runtime Skill content limit is outside bounds");
  }
  const fetchImpl = options.fetch ?? fetch;
  const now = options.now ?? (() => new Date());

  const checkServiceLiveV1 = async (
    serviceUrl: string,
    label: string,
    signal: AbortSignal,
  ): Promise<void> => {
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const combinedSignal = AbortSignal.any([signal, timeoutSignal]);
    const response = await fetchImpl(`${serviceUrl}/health`, {
      method: "GET",
      redirect: "error",
      signal: combinedSignal,
    });
    await response.body?.cancel().catch(() => undefined);
    signal.throwIfAborted();
    if (!response.ok) throw new Error(`${label} is not live`);
  };

  const reservation: RuntimeStartReservationValidationPortV1 = Object.freeze({
    async validate(
      principal: Parameters<RuntimeStartReservationValidationPortV1["validate"]>[0],
      path: Parameters<RuntimeStartReservationValidationPortV1["validate"]>[1],
      request: Parameters<RuntimeStartReservationValidationPortV1["validate"]>[2],
      signal?: AbortSignal,
    ) {
      const credential = await options.signer.sign({
        audience: "trigger_processor",
        capabilities: ["trigger.runtime_start.reservation.validate"],
        scope: botScopeV1({
          workspace_id: principal.workspace_id,
          bot_id: principal.bot_id,
          owner_agent_id: principal.owner_agent_id,
          deployment_environment: principal.deployment_environment,
          release_channel: principal.release_channel,
        }),
      });
      signal?.throwIfAborted();
      const response = await requestInternalJson<RuntimeStartReservationValidateResponseV1>({
        url: `${triggerProcessorUrl}/internal/trigger-processes/${encodeURIComponent(path.trigger_process_id)}/runtime-start-reservations/${path.start_attempt_no}/validate`,
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
        !Value.Check(RuntimeStartReservationValidateResponseV1Schema, response.body) ||
        response.body.validation_stage !== request.validation_stage ||
        response.body.trace_id !== request.trace_id
      ) {
        throw new RuntimeExecutionErrorV1(
          "reservation_unavailable",
          "Trigger Processor returned an invalid reservation validation response",
          true,
        );
      }
      return response.body;
    },
  });

  const contextSnapshots: RuntimeContextSnapshotPortV1 = Object.freeze({
    async resolve(request: ContextSnapshotResolveRequestV1, signal?: AbortSignal) {
      const credential = await options.signer.sign({
        audience: "trigger_processor",
        capabilities: ["trigger.context_snapshot.resolve"],
        scope: botScopeV1({
          workspace_id: request.workspace_id,
          bot_id: request.bot_id,
          owner_agent_id: request.owner_agent_id,
          deployment_environment: request.deployment_environment,
          release_channel: request.release_channel,
        }),
      });
      signal?.throwIfAborted();
      const response = await requestInternalJson<ContextSnapshotReadContractV1>({
        url: `${triggerProcessorUrl}/internal/context-snapshots:resolve`,
        method: "POST",
        workloadCredential: credential,
        json: request,
        timeoutMs,
        idempotent: true,
        maxRetries: 2,
        maxResponseBytes: 16_777_216,
        ...(signal === undefined ? {} : { signal }),
        fetchImpl,
      });
      if (!Value.Check(ContextSnapshotReadContractV1Schema, response.body)) {
        throw new RuntimeExecutionErrorV1(
          "context_snapshot_unavailable",
          "Trigger Processor returned an invalid context snapshot",
          true,
        );
      }
      try {
        assertContextSnapshotReadBindingsV1(request, response.body);
      } catch (error) {
        throw new RuntimeExecutionErrorV1(
          "context_snapshot_mismatch",
          "Trigger Processor context snapshot identity drifted",
          false,
        );
      }
      return response.body;
    },
  });

  const skills: RuntimeSkillPortV1 = Object.freeze({
    async resolve(request: SkillResolveRequestV1, signal?: AbortSignal) {
      const credential = await options.signer.sign({
        audience: "skill_registry",
        capabilities: ["skill.resolve"],
        scope: botScopeV1({
          workspace_id: request.workspace_id,
          bot_id: request.bot_id,
          owner_agent_id: request.owner_agent_id,
          deployment_environment: request.deployment_environment,
          release_channel: request.release_channel,
        }),
      });
      signal?.throwIfAborted();
      const response = await requestInternalJson<SkillResolveResponseV1>({
        url: `${skillRegistryUrl}/internal/skill-registry/skills/resolve`,
        method: "POST",
        workloadCredential: credential,
        json: request,
        timeoutMs,
        idempotent: true,
        maxRetries: 2,
        ...(signal === undefined ? {} : { signal }),
        fetchImpl,
      });
      if (!Value.Check(SkillResolveResponseV1Schema, response.body)) {
        throw new RuntimeExecutionErrorV1(
          "catalog_version_mismatch",
          "Skill Registry returned an invalid resolution response",
        );
      }
      try {
        assertSkillResolveResponseSemanticBindingsV1(
          request,
          response.body,
          response.body.details.valid_until,
        );
      } catch (error) {
        throw new RuntimeExecutionErrorV1(
          "catalog_version_mismatch",
          "Skill Registry resolution bindings drifted",
          false,
        );
      }
      return response.body;
    },

    async load(
      resolution: Parameters<RuntimeSkillPortV1["load"]>[0],
      context: Parameters<RuntimeSkillPortV1["load"]>[1],
      signal?: AbortSignal,
    ) {
      const issuedAt = now();
      const request = {
        schema_version: "skill_content_request.v1" as const,
        resolution_id: resolution.resolution_id,
        runtime_run_id: context.runtime_run_id,
        ...context.scope,
        expected_package_digest: resolution.package_digest,
        expected_manifest_digest: resolution.manifest_digest,
        security_revocation_epoch: resolution.security_revocation_epoch,
        trace_id: context.trace_id,
      };
      const credential = await options.signer.sign({
        audience: "skill_registry",
        capabilities: ["skill.content.read"],
        scope: botScopeV1(context.scope),
      });
      signal?.throwIfAborted();
      const response = await requestInternalJson<SkillContentResponseV1>({
        url: `${skillRegistryUrl}/internal/skill-registry/resolutions/${encodeURIComponent(resolution.resolution_id)}/content`,
        method: "POST",
        workloadCredential: credential,
        json: request,
        timeoutMs,
        idempotent: true,
        maxRetries: 2,
        ...(signal === undefined ? {} : { signal }),
        fetchImpl,
      });
      if (!Value.Check(SkillContentResponseV1Schema, response.body)) {
        throw new RuntimeExecutionErrorV1(
          "skill_content_mismatch",
          "Skill Registry returned an invalid content grant",
        );
      }
      try {
        assertSkillContentResponseSemanticBindingsV1(
          request,
          response.body,
          resolution.valid_until,
          issuedAt.getTime(),
        );
      } catch (error) {
        throw new RuntimeExecutionErrorV1(
          "skill_content_mismatch",
          "Skill Registry content grant bindings drifted",
          false,
        );
      }
      if (response.body.details.content_type !== "application/vnd.pai.skill+tar") {
        throw new RuntimeExecutionErrorV1(
          "skill_content_mismatch",
          "Runtime accepts only the canonical bounded Skill tar package",
        );
      }
      signal?.throwIfAborted();
      const contentResponse = await fetchImpl(
        signedContentUrlV1(response.body.details.content_ref),
        {
          method: "GET",
          redirect: "error",
          ...(signal === undefined ? {} : { signal }),
        },
      );
      const bytes = await boundedResponseBytesV1(
        contentResponse,
        Math.min(contentMaximum, response.body.details.size_bytes),
        signal,
      );
      const materialized = materializeSkillTarV1(bytes);
      if (
        materialized.package_digest !== resolution.package_digest ||
        materialized.manifest_digest !== resolution.manifest_digest ||
        materialized.bytes.byteLength !== response.body.details.size_bytes
      ) {
        throw new RuntimeExecutionErrorV1(
          "skill_content_mismatch",
          "Downloaded Skill bytes or canonical manifest differ from the frozen resolution",
        );
      }
      return Object.freeze({ ...materialized, source: "skill_registry" as const });
    },
  });

  return Object.freeze({
    reservation,
    context_snapshots: contextSnapshots,
    skills,
    async checkReadiness(signal: AbortSignal) {
      signal.throwIfAborted();
      await Promise.all([
        checkServiceLiveV1(triggerProcessorUrl, "Trigger Processor", signal),
        checkServiceLiveV1(skillRegistryUrl, "Skill Registry", signal),
      ]);
      signal.throwIfAborted();
    },
  });
}
