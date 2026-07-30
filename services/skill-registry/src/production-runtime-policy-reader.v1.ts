import { createPrivateKey } from "node:crypto";

import {
  WorkloadJwtSigner,
  normalizePrivateKeyPemEnvironmentValueV1,
  type AuthorizationScopeV1,
  type WorkloadCredentialSignerPort,
} from "@pai/auth";
import {
  RuntimePolicyInputReadArtifactV1Schema,
  assertRuntimePolicyInputReadArtifactBindingsV1,
  type RuntimePolicyInputReadArtifactV1,
} from "@pai/contracts";
import {
  isTrustedLocalDockerHttpOriginV1,
  requestInternalJson,
} from "@pai/service-kit";
import { Value } from "@sinclair/typebox/value";

import {
  SkillRegistryApplicationErrorV1,
  type RuntimePolicyInputReaderPortV1,
  type SkillResolveRequestV1,
} from "./skill-registry-application.v1.js";

const DEFAULT_TIMEOUT_MS_V1 = 5_000;

export interface SkillRegistryRuntimePolicyReaderOptionsV1 {
  readonly action_runtime_url: string;
  readonly signer: WorkloadCredentialSignerPort;
  readonly request_timeout_ms?: number;
  readonly fetch?: typeof fetch;
}

function actionRuntimeBaseUrlV1(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("PAI_ACTION_RUNTIME_URL must be an absolute URL");
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
      "PAI_ACTION_RUNTIME_URL must use HTTPS except on loopback and must not contain credentials, query, or fragment",
    );
  }
  return url.toString().replace(/\/$/u, "");
}

function botScopeV1(
  request: Pick<
    SkillResolveRequestV1,
    | "workspace_id"
    | "bot_id"
    | "owner_agent_id"
    | "deployment_environment"
    | "release_channel"
  >,
): AuthorizationScopeV1 {
  return Object.freeze({ scope_kind: "bot" as const, ...request });
}

function assertArtifactRequestBindingsV1(
  request: Pick<
    SkillResolveRequestV1,
    | "policy_input_ref"
    | "runtime_run_id"
    | "start_attempt_no"
    | "workspace_id"
    | "bot_id"
    | "owner_agent_id"
    | "deployment_environment"
    | "release_channel"
  >,
  artifact: RuntimePolicyInputReadArtifactV1,
): void {
  if (
    artifact.policy_input_ref !== request.policy_input_ref ||
    artifact.runtime_run_id !== request.runtime_run_id ||
    artifact.start_attempt_no !== request.start_attempt_no ||
    artifact.workspace_id !== request.workspace_id ||
    artifact.bot_id !== request.bot_id ||
    artifact.owner_agent_id !== request.owner_agent_id ||
    artifact.deployment_environment !== request.deployment_environment ||
    artifact.release_channel !== request.release_channel
  ) {
    throw new Error("Action Runtime policy input response binding mismatch");
  }
  assertRuntimePolicyInputReadArtifactBindingsV1(artifact);
}

/**
 * Durable cross-owner reader.  Action Runtime remains the sole owner of a
 * Runtime Start policy input; Skill Registry supplies the full bot scope in a
 * short-lived workload JWT and independently verifies every returned binding.
 */
export function createSkillRegistryRuntimePolicyReaderV1(
  options: SkillRegistryRuntimePolicyReaderOptionsV1,
): RuntimePolicyInputReaderPortV1 {
  const actionRuntimeUrl = actionRuntimeBaseUrlV1(options.action_runtime_url);
  const timeoutMs = options.request_timeout_ms ?? DEFAULT_TIMEOUT_MS_V1;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 300_000) {
    throw new Error("Skill Registry runtime policy reader timeout is invalid");
  }
  const fetchImpl = options.fetch ?? fetch;
  const reader: RuntimePolicyInputReaderPortV1 = {
    durability: "durable" as const,
    async checkReadiness(): Promise<void> {
      const response = await fetchImpl(`${actionRuntimeUrl}/health`, {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.timeout(timeoutMs),
      });
      await response.body?.cancel().catch(() => undefined);
      if (!response.ok) {
        throw new Error("Action Runtime is not live for policy-input reads");
      }
    },
    async readPolicyInput(request) {
      try {
        const credential = await options.signer.sign({
          audience: "action_runtime",
          capabilities: ["runtime.policy_input.read"],
          scope: botScopeV1(request),
        });
        const response = await requestInternalJson<unknown>({
          url: `${actionRuntimeUrl}/internal/runtime/policy-inputs/${encodeURIComponent(request.policy_input_ref)}`,
          method: "GET",
          workloadCredential: credential,
          traceId: request.trace_id,
          timeoutMs,
          idempotent: true,
          maxRetries: 1,
          fetchImpl,
        });
        if (!Value.Check(RuntimePolicyInputReadArtifactV1Schema, response.body)) {
          throw new Error("Action Runtime returned an invalid policy input artifact");
        }
        const artifact = response.body as RuntimePolicyInputReadArtifactV1;
        assertArtifactRequestBindingsV1(request, artifact);
        return Object.freeze(structuredClone(artifact));
      } catch (error) {
        if (error instanceof SkillRegistryApplicationErrorV1) throw error;
        throw new SkillRegistryApplicationErrorV1(
          "registry_unavailable",
          "runtime policy input could not be read from Action Runtime",
        );
      }
    },
  };
  return Object.freeze(reader);
}

export function createSkillRegistryWorkloadSignerFromEnvV1(
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
    subject: "skill_registry",
    privateKey: createPrivateKey(normalizePrivateKeyPemEnvironmentValueV1(pem)),
    keyId,
    algorithm,
  });
}
