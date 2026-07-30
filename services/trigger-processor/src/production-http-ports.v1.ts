import { createPrivateKey } from "node:crypto";

import {
  WorkloadJwtSigner,
  normalizePrivateKeyPemEnvironmentValueV1,
  type AuthorizationScopeV1,
  type WorkloadCredentialSignerPort,
} from "@pai/auth";
import {
  KnowThatQueryResponseV1Schema,
  MemoryFastRecallResponseV1Schema,
  SkillCatalogQueryResponseV1Schema,
  SkillContextCatalogResponseV1Schema,
  ToolPermissionProfileCurrentReadSuccessV1Schema,
  assertKnowThatQueryResponseV1,
  assertSkillCatalogQuerySemanticBindingsV1,
  assertSkillContextCatalogBindingsV1,
  assertToolPermissionProfileCurrentReadBindingV1,
  type ContextComposeRequestV1,
  type IntentSynthesizeRequestV1,
  type KnowThatQueryResponseV1,
  type MemoryFastRecallResponseV1,
  type RuntimeEventReadContractV1,
  type RuntimeEventResolveRequestV1,
  type SkillCatalogQueryDetailsV1,
  type SkillCatalogQueryRequestV1,
  type SkillContextCatalogDetailsV1,
  type SkillContextCatalogRequestV1,
  type ToolPermissionProfileV1,
} from "@pai/contracts";
import {
  isTrustedLocalDockerHttpOriginV1,
  requestInternalJson,
  requestWorkloadJson,
} from "@pai/service-kit";
import { Value } from "@sinclair/typebox/value";

import type {
  ContextSourceAdaptersV1,
  TriggerLifecycleDependenciesV1,
} from "./application/trigger-lifecycle.v1.js";

const DEFAULT_TIMEOUT_MS_V1 = 5_000;
const MAX_CONTEXT_QUERY_BYTES_V1 = 16_384;

export interface TriggerContextQueryPortV1 {
  readQuery(
    request: ContextComposeRequestV1,
    signal: AbortSignal,
  ): Promise<string>;
}

export interface TriggerProcessorHttpPortsOptionsV1 {
  readonly action_runtime_url: string;
  readonly skill_registry_url: string;
  readonly memory_url: string;
  readonly knowthat_url: string;
  readonly signer: WorkloadCredentialSignerPort;
  readonly context_query: TriggerContextQueryPortV1;
  readonly request_timeout_ms?: number;
  readonly fetch?: typeof fetch;
}

export interface TriggerProcessorHttpPortsV1 {
  readonly context_sources: Pick<
    ContextSourceAdaptersV1,
    "knowthat" | "memory" | "skill"
  >;
  readonly intent_policy_sources: TriggerLifecycleDependenciesV1["intent_policy_sources"];
  readonly runtime_events: TriggerLifecycleDependenciesV1["runtime_events"];
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
    throw new Error(
      `${label} must use HTTPS except on loopback and must not contain credentials, query, or fragment`,
    );
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
  // Callers such as context-catalog requests carry transport-only fields
  // (schema_version, trace_id, and limit). Workload credentials accept the
  // exact canonical authorization scope only; spreading a request here turns
  // those fields into an invalid scope and prevents the request from being
  // signed at all.
  return Object.freeze({
    scope_kind: "bot" as const,
    workspace_id: scope.workspace_id,
    bot_id: scope.bot_id,
    owner_agent_id: scope.owner_agent_id,
    deployment_environment: scope.deployment_environment,
    release_channel: scope.release_channel,
  });
}

function readSourceTimestampV1(value: string | null): string {
  if (
    value === null ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  ) {
    throw new Error("owner source_as_of header is missing or invalid");
  }
  return value;
}

function queryStringV1(value: Record<string, string | number>): string {
  const params = new URLSearchParams();
  for (const [key, field] of Object.entries(value)) params.set(key, String(field));
  return params.toString();
}

export function createTriggerProcessorWorkloadSignerFromEnvV1(
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
    subject: "trigger_processor",
    privateKey: createPrivateKey(normalizePrivateKeyPemEnvironmentValueV1(pem)),
    keyId,
    algorithm,
  });
}

export function createTriggerProcessorHttpPortsV1(
  options: TriggerProcessorHttpPortsOptionsV1,
): TriggerProcessorHttpPortsV1 {
  const actionRuntimeUrl = baseUrlV1(options.action_runtime_url, "Action Runtime URL");
  const skillRegistryUrl = baseUrlV1(options.skill_registry_url, "Skill Registry URL");
  const memoryUrl = baseUrlV1(options.memory_url, "Memory URL");
  const knowThatUrl = baseUrlV1(options.knowthat_url, "KnowThat URL");
  const timeoutMs = options.request_timeout_ms ?? DEFAULT_TIMEOUT_MS_V1;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 300_000) {
    throw new Error("Trigger Processor internal request timeout is outside bounds");
  }
  const fetchImpl = options.fetch ?? fetch;

  const credential = async (
    audience: "action_runtime" | "skill_registry" | "memory" | "knowthat",
    capabilities: readonly string[],
    scope: Readonly<{
      workspace_id: string;
      bot_id: string;
      owner_agent_id: string;
      deployment_environment: "local" | "dev" | "staging" | "prod";
      release_channel: "stable" | "canary";
    }>,
  ): Promise<string> =>
    options.signer.sign({ audience, capabilities, scope: botScopeV1(scope) });

  const readPolicyProfile = async (
    request: Readonly<{
      workspace_id: string;
      bot_id: string;
      owner_agent_id: string;
      deployment_environment: "local" | "dev" | "staging" | "prod";
      release_channel: "stable" | "canary";
      trace_id: string;
    }>,
    signal: AbortSignal,
  ): Promise<ToolPermissionProfileV1> => {
    const selector = {
      workspace_id: request.workspace_id,
      bot_id: request.bot_id,
      owner_agent_id: request.owner_agent_id,
      deployment_environment: request.deployment_environment,
      release_channel: request.release_channel,
    };
    const workloadCredential = await credential(
      "action_runtime",
      ["runtime.tool_permission_profile.current.read"],
      selector,
    );
    signal.throwIfAborted();
    const response = await requestInternalJson<unknown>({
      url: `${actionRuntimeUrl}/internal/runtime/tool-permission-profiles/current?${queryStringV1(selector)}`,
      method: "GET",
      workloadCredential,
      traceId: request.trace_id,
      timeoutMs,
      idempotent: true,
      maxRetries: 1,
      signal,
      fetchImpl,
    });
    if (!Value.Check(ToolPermissionProfileCurrentReadSuccessV1Schema, response.body)) {
      throw new Error("Action Runtime returned an invalid ToolPermissionProfile response");
    }
    assertToolPermissionProfileCurrentReadBindingV1(
      {
        schema_version: "tool_permission_profile_current_read_request.v1",
        selector,
        trace_id: request.trace_id,
      },
      response.body,
    );
    return response.body.details.profile;
  };

  const readPolicyCatalog = async (
    request: Readonly<{
      workspace_id: string;
      bot_id: string;
      owner_agent_id: string;
      deployment_environment: "local" | "dev" | "staging" | "prod";
      release_channel: "stable" | "canary";
      trace_id: string;
    }>,
    signal: AbortSignal,
  ): Promise<SkillCatalogQueryDetailsV1> => {
    const query: SkillCatalogQueryRequestV1 = {
      schema_version: "skill_catalog_query.v1",
      workspace_id: request.workspace_id,
      bot_id: request.bot_id,
      owner_agent_id: request.owner_agent_id,
      deployment_environment: request.deployment_environment,
      release_channel: request.release_channel,
      limit: 500,
      trace_id: request.trace_id,
    };
    const workloadCredential = await credential(
      "skill_registry",
      ["skill.catalog.read"],
      query,
    );
    signal.throwIfAborted();
    const response = await requestInternalJson<unknown>({
      url: `${skillRegistryUrl}/internal/skill-registry/catalog?${queryStringV1(query)}`,
      method: "GET",
      workloadCredential,
      traceId: query.trace_id,
      timeoutMs,
      idempotent: true,
      maxRetries: 1,
      signal,
      fetchImpl,
    });
    if (!Value.Check(SkillCatalogQueryResponseV1Schema, response.body)) {
      throw new Error("Skill Registry returned an invalid policy catalog response");
    }
    assertSkillCatalogQuerySemanticBindingsV1(query, response.body);
    return response.body.details;
  };

  return Object.freeze({
    context_sources: Object.freeze({
      knowthat: Object.freeze({
        async fetch(request: ContextComposeRequestV1, signal: AbortSignal) {
          const query = await options.context_query.readQuery(request, signal);
          if (Buffer.byteLength(query, "utf8") > MAX_CONTEXT_QUERY_BYTES_V1) {
            throw new Error("Trigger context query exceeds KnowThat owner limit");
          }
          const body = {
            schema_version: "knowthat_query.v1" as const,
            workspace_id: request.workspace_id,
            bot_id: request.bot_id,
            owner_agent_id: request.owner_agent_id,
            deployment_environment: request.deployment_environment,
            release_channel: request.release_channel,
            query,
            limit: 200,
          };
          const workloadCredential = await credential(
            "knowthat",
            ["knowthat.fact.query"],
            body,
          );
          signal.throwIfAborted();
          const response = await requestWorkloadJson<unknown>({
            url: `${knowThatUrl}/v1/knowthat/query`,
            method: "POST",
            workloadCredential,
            json: body,
            traceId: request.trace_id,
            timeoutMs,
            idempotent: true,
            maxRetries: 1,
            signal,
            fetchImpl,
          });
          if (!Value.Check(KnowThatQueryResponseV1Schema, response.body)) {
            throw new Error("KnowThat returned an invalid context response");
          }
          assertKnowThatQueryResponseV1(response.body);
          const details = response.body as KnowThatQueryResponseV1;
          return Object.freeze({
            source_as_of: details.as_of,
            source_version: `knowthat:${details.query_revision}`,
            pinned_facts: details.facts.map((fact) => ({
              ref: `knowthat:${fact.id}`,
              version: `knowthat:${details.query_revision}`,
              summary: `${fact.subject} ${fact.predicate} ${fact.object}`,
            })),
          });
        },
      }),
      memory: Object.freeze({
        async fetch(request: ContextComposeRequestV1, signal: AbortSignal) {
          const query = await options.context_query.readQuery(request, signal);
          if (Buffer.byteLength(query, "utf8") > MAX_CONTEXT_QUERY_BYTES_V1) {
            throw new Error("Trigger context query exceeds Memory owner limit");
          }
          const body = {
            schema_version: "memory.fast_recall.v1" as const,
            bot_id: request.bot_id,
            query,
            query_purpose: "context_injection" as const,
            limit: 50,
          };
          const workloadCredential = await credential(
            "memory",
            ["memory.read"],
            {
              workspace_id: request.workspace_id,
              bot_id: request.bot_id,
              owner_agent_id: request.owner_agent_id,
              deployment_environment: request.deployment_environment,
              release_channel: request.release_channel,
            },
          );
          let sourceAsOf: string | null = null;
          const captureHeaderFetch: typeof fetch = async (input, init) => {
            const response = await fetchImpl(input, init);
            const candidate = response.headers.get("x-pai-memory-source-as-of");
            if (candidate !== null) sourceAsOf = candidate;
            return response;
          };
          signal.throwIfAborted();
          const response = await requestWorkloadJson<unknown>({
            url: `${memoryUrl}/v1/memory/fast-recall`,
            method: "POST",
            workloadCredential,
            json: body,
            traceId: request.trace_id,
            timeoutMs,
            idempotent: true,
            maxRetries: 1,
            signal,
            fetchImpl: captureHeaderFetch,
          });
          if (!Value.Check(MemoryFastRecallResponseV1Schema, response.body)) {
            throw new Error("Memory returned an invalid context response");
          }
          const details = response.body as MemoryFastRecallResponseV1;
          const asOf = readSourceTimestampV1(sourceAsOf);
          return Object.freeze({
            source_as_of: asOf,
            source_version: `memory:${details.query_revision}`,
            memory_context: details.items.map((item) => ({
              ref: `memory:${item.memory_point_id}`,
              version: `memory:${details.query_revision}`,
              summary: item.content_summary,
            })),
          });
        },
      }),
      skill: Object.freeze({
        async fetch(request: ContextComposeRequestV1, signal: AbortSignal) {
          const body: SkillContextCatalogRequestV1 = {
            schema_version: "skill_context_catalog_request.v1",
            workspace_id: request.workspace_id,
            bot_id: request.bot_id,
            owner_agent_id: request.owner_agent_id,
            deployment_environment: request.deployment_environment,
            release_channel: request.release_channel,
            limit: 500,
            trace_id: request.trace_id,
          };
          const workloadCredential = await credential(
            "skill_registry",
            ["skill.context_catalog.read"],
            body,
          );
          signal.throwIfAborted();
          const response = await requestInternalJson<unknown>({
            url: `${skillRegistryUrl}/internal/skill-registry/context-catalog`,
            method: "POST",
            workloadCredential,
            json: body,
            traceId: request.trace_id,
            timeoutMs,
            idempotent: true,
            maxRetries: 1,
            signal,
            fetchImpl,
          });
          if (!Value.Check(SkillContextCatalogResponseV1Schema, response.body)) {
            throw new Error("Skill Registry context catalog is unavailable or invalid");
          }
          assertSkillContextCatalogBindingsV1(body, response.body);
          const details = response.body.details as SkillContextCatalogDetailsV1;
          return Object.freeze({
            source_as_of: details.as_of,
            source_version: details.catalog_version,
            skill_catalog: Object.freeze({
              catalog_version: details.catalog_version,
              catalog_as_of: details.as_of,
              items: details.items.map((item) => ({
                skill_key: item.skill_key,
                name: item.name,
                description: item.description,
                active_version: item.active_version,
                package_digest: item.package_digest,
                manifest_digest: item.manifest_digest,
                runtime_target: item.runtime_target,
              })),
            }),
          });
        },
      }),
    }),
    intent_policy_sources: Object.freeze({
      tool_permissions: Object.freeze({ readCurrent: readPolicyProfile }),
      skill_catalog: Object.freeze({ readFirstPage: readPolicyCatalog }),
    }),
    runtime_events: Object.freeze({
      async resolve(request: RuntimeEventResolveRequestV1, signal: AbortSignal): Promise<RuntimeEventReadContractV1> {
        const workloadCredential = await credential(
          "action_runtime",
          ["runtime.event.resolve"],
          request,
        );
        signal.throwIfAborted();
        const response = await requestInternalJson<RuntimeEventReadContractV1>({
          url: `${actionRuntimeUrl}/internal/runtime-events::resolve`,
          method: "POST",
          workloadCredential,
          json: request,
          traceId: request.trace_id,
          timeoutMs,
          idempotent: true,
          maxRetries: 1,
          signal,
          fetchImpl,
        });
        return response.body;
      },
    }),
    async checkReadiness(signal: AbortSignal) {
      const services = [
        [actionRuntimeUrl, "Action Runtime"],
        [skillRegistryUrl, "Skill Registry"],
        [memoryUrl, "Memory"],
        [knowThatUrl, "KnowThat"],
      ] as const;
      await Promise.all(services.map(async ([url, label]) => {
        const timeoutSignal = AbortSignal.timeout(timeoutMs);
        const response = await fetchImpl(`${url}/health`, {
          method: "GET",
          redirect: "error",
          signal: AbortSignal.any([signal, timeoutSignal]),
        });
        await response.body?.cancel().catch(() => undefined);
        if (!response.ok) throw new Error(`${label} is not live`);
      }));
      signal.throwIfAborted();
    },
  });
}
