import { createPrivateKey } from "node:crypto";

import {
  WorkloadJwtSigner,
  normalizePrivateKeyPemEnvironmentValueV1,
  type AuthorizationScopeV1,
  type WorkloadCredentialSignerPort,
} from "@pai/auth";
import {
  KnowThatWriteBatchResponseV1Schema,
  MemoryWriteBatchResponseV1Schema,
  TriggerProcessSnapshotReadContractV1Schema,
  assertKnowThatWriteBatchResponseV1,
  assertMemoryWriteBatchResponseSemanticBindingsV1,
  assertTriggerProcessSnapshotReadBindingsV1,
  type KnowThatWriteBatchRequestV1,
  type KnowThatWriteBatchResponseV1,
  type MemoryWriteBatchRequestV1,
  type MemoryWriteBatchResponseV1,
  type TriggerProcessSnapshotReadContractV1,
  type TriggerProcessSnapshotResolveRequestV1,
} from "@pai/contracts";
import {
  isTrustedLocalDockerHttpOriginV1,
  requestInternalJson,
} from "@pai/service-kit";
import { Value } from "@sinclair/typebox/value";

import type { MetaJobRecordV1, TriggerProcessSnapshotResolverPortV1 } from "./meta-types.v1.js";
import type { MetaKnowThatCandidatePortV1, MetaMemoryWritePortV1 } from "./ports.v1.js";

export interface MetaProductionHttpPortsV1 {
  readonly snapshot_resolver: TriggerProcessSnapshotResolverPortV1;
  readonly memory: MetaMemoryWritePortV1;
  readonly knowthat: MetaKnowThatCandidatePortV1;
  checkReadiness(signal: AbortSignal): Promise<void>;
}

export interface MetaProductionHttpPortsOptionsV1 {
  readonly trigger_processor_url: string;
  readonly memory_url: string;
  readonly knowthat_url: string;
  readonly signer: WorkloadCredentialSignerPort;
  /**
   * Memory's write-batch wire schema deliberately omits scope fields. The
   * scope must therefore come from the durable Meta job selected by the
   * worker, never from a caller-controlled request body.
   */
  readonly read_meta_job: (jobId: string) => Promise<MetaJobRecordV1 | undefined>;
  readonly request_timeout_ms?: number;
  readonly fetch?: typeof fetch;
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
  return Object.freeze({ scope_kind: "bot" as const, ...scope });
}

function validTimeoutV1(timeoutMs: number): number {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 300_000) {
    throw new Error("Meta internal request timeout is outside bounds");
  }
  return timeoutMs;
}

async function assertLiveV1(
  url: string,
  label: string,
  timeoutMs: number,
  fetchImpl: typeof fetch,
  signal: AbortSignal,
): Promise<void> {
  signal.throwIfAborted();
  const response = await fetchImpl(`${url}/health`, {
    method: "GET",
    redirect: "error",
    signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
  });
  await response.body?.cancel().catch(() => undefined);
  signal.throwIfAborted();
  if (!response.ok) throw new Error(`${label} is not live`);
}

export function createMetaWorkloadSignerFromEnvV1(
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
    subject: "meta_cognition",
    privateKey: createPrivateKey(normalizePrivateKeyPemEnvironmentValueV1(pem)),
    keyId,
    algorithm,
  });
}

export function createMetaProductionHttpPortsV1(
  options: MetaProductionHttpPortsOptionsV1,
): MetaProductionHttpPortsV1 {
  const triggerProcessorUrl = baseUrlV1(
    options.trigger_processor_url,
    "PAI_TRIGGER_PROCESSOR_URL",
  );
  const memoryUrl = baseUrlV1(options.memory_url, "PAI_MEMORY_URL");
  const knowThatUrl = baseUrlV1(options.knowthat_url, "PAI_KNOWTHAT_URL");
  const timeoutMs = validTimeoutV1(options.request_timeout_ms ?? 30_000);
  const fetchImpl = options.fetch ?? fetch;

  const scopeForMemoryRequest = async (
    request: MemoryWriteBatchRequestV1,
  ): Promise<MetaJobRecordV1> => {
    const job = await options.read_meta_job(request.source_meta_job_id);
    if (
      job === undefined ||
      job.bot_id !== request.bot_id ||
      job.trigger_process_id !== request.trigger_process_id
    ) {
      throw new Error("Memory request is not bound to a durable Meta job");
    }
    return job;
  };

  return Object.freeze({
    snapshot_resolver: Object.freeze({
      async resolve(request: TriggerProcessSnapshotResolveRequestV1, signal: AbortSignal) {
        const credential = await options.signer.sign({
          audience: "trigger_processor",
          capabilities: ["trigger.process.snapshot.resolve"],
          scope: botScopeV1(request),
        });
        signal.throwIfAborted();
        const response = await requestInternalJson<TriggerProcessSnapshotReadContractV1>({
          url: `${triggerProcessorUrl}/internal/trigger-process-snapshots:resolve`,
          method: "POST",
          workloadCredential: credential,
          json: request,
          timeoutMs,
          idempotent: true,
          maxRetries: 2,
          maxResponseBytes: 16 * 1_048_576,
          signal,
          fetchImpl,
        });
        if (!Value.Check(TriggerProcessSnapshotReadContractV1Schema, response.body)) {
          throw new Error("Trigger Processor returned an invalid Meta snapshot response");
        }
        assertTriggerProcessSnapshotReadBindingsV1(request, response.body);
        return response.body;
      },
      async checkReadiness(signal: AbortSignal) {
        await assertLiveV1(triggerProcessorUrl, "Trigger Processor", timeoutMs, fetchImpl, signal);
      },
    }),
    memory: Object.freeze({
      async writeBatch(request: MemoryWriteBatchRequestV1, signal: AbortSignal) {
        const job = await scopeForMemoryRequest(request);
        const credential = await options.signer.sign({
          audience: "memory",
          capabilities: ["memory.write"],
          scope: botScopeV1(job),
        });
        signal.throwIfAborted();
        const response = await requestInternalJson<MemoryWriteBatchResponseV1>({
          url: `${memoryUrl}/internal/memory/write-batch`,
          method: "POST",
          workloadCredential: credential,
          json: request,
          timeoutMs,
          idempotent: true,
          maxRetries: 2,
          signal,
          fetchImpl,
        });
        if (!Value.Check(MemoryWriteBatchResponseV1Schema, response.body)) {
          throw new Error("Memory returned an invalid Meta write response");
        }
        assertMemoryWriteBatchResponseSemanticBindingsV1(response.body);
        return response.body;
      },
      async checkReadiness(signal: AbortSignal) {
        await assertLiveV1(memoryUrl, "Memory", timeoutMs, fetchImpl, signal);
      },
    }),
    knowthat: Object.freeze({
      async writeBatch(request: KnowThatWriteBatchRequestV1, signal: AbortSignal) {
        const credential = await options.signer.sign({
          audience: "knowthat",
          capabilities: ["knowthat.fact.write"],
          scope: botScopeV1(request),
        });
        signal.throwIfAborted();
        const response = await requestInternalJson<KnowThatWriteBatchResponseV1>({
          url: `${knowThatUrl}/internal/knowthat/write-batch`,
          method: "POST",
          workloadCredential: credential,
          json: request,
          timeoutMs,
          idempotent: true,
          maxRetries: 2,
          signal,
          fetchImpl,
        });
        if (!Value.Check(KnowThatWriteBatchResponseV1Schema, response.body)) {
          throw new Error("KnowThat returned an invalid Meta write response");
        }
        assertKnowThatWriteBatchResponseV1(response.body);
        return response.body;
      },
      async checkReadiness(signal: AbortSignal) {
        await assertLiveV1(knowThatUrl, "KnowThat", timeoutMs, fetchImpl, signal);
      },
    }),
    async checkReadiness(signal: AbortSignal) {
      await assertLiveV1(triggerProcessorUrl, "Trigger Processor", timeoutMs, fetchImpl, signal);
      await assertLiveV1(memoryUrl, "Memory", timeoutMs, fetchImpl, signal);
      await assertLiveV1(knowThatUrl, "KnowThat", timeoutMs, fetchImpl, signal);
    },
  });
}
