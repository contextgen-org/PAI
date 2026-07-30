import { createHash } from "node:crypto";

import {
  CONTEXT_SOURCE_NAMES_V1,
  ContextComposeRequestV1Schema,
  ContextComposeResponseV1Schema,
  ContextSnapshotV1Schema,
  IntentSynthesizeRequestV1Schema,
  IntentSynthesizeResponseV1Schema,
  SkillCatalogQueryDetailsV1Schema,
  ToolPermissionProfileV1Schema,
  MetaJobCreateRequestV1Schema,
  RuntimeDomainEventV1Schema,
  RuntimeEventReadContractV1Schema,
  RuntimeEventResolveRequestV1Schema,
  RuntimeEventAppendRequestV1Schema,
  RuntimeEventAppendResponseV1Schema,
  RuntimeStartRequestV1Schema,
  assertRuntimeDomainEventSemanticBindingsV1,
  assertRuntimeEventReadBindingsV1,
  assertContextComposeRequestBindingsV1,
  assertContextSnapshotSemanticBindingsV1,
  assertContextSourceOutcomesV1,
  assertIntentSynthesizeRequestBindingsV1,
  assertToolPermissionProfileSemanticBindingsV1,
  assertStructuredIntentSemanticBindingsV1,
  assertMetaJobCreateSemanticBindingsV1,
  assertRuntimeEventAppendBindingsV1,
  assertRuntimeObservationSummaryBindingsV1,
  assertRuntimeStartSemanticBindingsV1,
  type ContextComposeRequestV1,
  type ContextComposeResponseV1,
  type ContextSnapshotV1,
  type ContextSourceNameV1,
  type ContextSourceOutcomeV1,
  type IntentSynthesizeRequestV1,
  type IntentSynthesizeResponseV1,
  type SkillCatalogQueryDetailsV1,
  type ToolPermissionProfileV1,
  type MetaEnqueueReasonV1,
  type MetaJobCreateRequestV1,
  type RuntimeDomainEventV1,
  type RuntimeEventReadContractV1,
  type RuntimeEventResolveRequestV1,
  type RuntimeEventAppendRequestV1,
  type RuntimeEventAppendResponseV1,
  type RuntimeStartRequestV1,
} from "@pai/contracts";
import { canonicalJsonV1 } from "@pai/eventing";
import type { ObjectStorePortV1 } from "@pai/object-store";
import { Value } from "@sinclair/typebox/value";

import type { TriggerProcessorOwnerDatabaseV1 } from "./trigger-admission.v1.js";
import type { AcceptedTriggerConfirmationVerifierV1 } from "./confirmation.v1.js";

const CONTEXT_TIMEOUT_MS = 5_000;
// Intent synthesis includes an authorized Context snapshot and a strict JSON
// schema. The production DeepSeek composition exceeded the previous 55-second
// ceiling with its full context even though its schema-only probe completed
// quickly. Keep an explicit finite cap while allowing one complete bounded
// provider response plus host validation before the recovery lease expires.
const INTENT_TIMEOUT_MS = 120_000;

function sha256(value: unknown): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(canonicalJsonV1(value)).digest("hex")}`;
}

function timestampNanosecondsV1(value: string): bigint | undefined {
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/u.exec(
    value,
  );
  if (match === null) return undefined;
  const wholeSecondMs = Date.parse(`${match[1]}${match[3]}`);
  if (!Number.isFinite(wholeSecondMs)) return undefined;
  const fraction = (match[2] ?? "").padEnd(9, "0");
  return BigInt(wholeSecondMs) * 1_000_000n + BigInt(fraction);
}

function withoutHash<T extends Readonly<Record<string, unknown>>>(
  value: T,
  key: keyof T,
): Omit<T, keyof T> & Readonly<Record<string, unknown>> {
  const result: Record<string, unknown> = {};
  for (const [field, fieldValue] of Object.entries(value)) {
    if (field !== key) result[field] = fieldValue;
  }
  return result as Omit<T, keyof T> & Readonly<Record<string, unknown>>;
}

async function* oneChunk(body: Uint8Array): AsyncIterable<Uint8Array> {
  yield body;
}

async function withDeadline<T>(
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new Error("deadline_exceeded"));
    }, timeoutMs);
  });
  try {
    return await Promise.race([operation(controller.signal), deadline]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

interface SourceMetadataV1 {
  readonly source_as_of: string | null;
  readonly source_version: string | null;
  readonly degraded_reason?: string;
}

export interface ContextSourceAdaptersV1 {
  readonly knowthat: {
    fetch(
      request: ContextComposeRequestV1,
      signal: AbortSignal,
    ): Promise<SourceMetadataV1 & {
      pinned_facts: ContextSnapshotV1["pinned_facts"];
    }>;
  };
  readonly memory: {
    fetch(
      request: ContextComposeRequestV1,
      signal: AbortSignal,
    ): Promise<SourceMetadataV1 & {
      memory_context: ContextSnapshotV1["memory_context"];
    }>;
  };
  readonly skill: {
    fetch(
      request: ContextComposeRequestV1,
      signal: AbortSignal,
    ): Promise<SourceMetadataV1 & {
      skill_catalog: NonNullable<ContextSnapshotV1["skill_catalog"]>;
    }>;
  };
  readonly environment: {
    fetch(
      request: ContextComposeRequestV1,
      signal: AbortSignal,
    ): Promise<SourceMetadataV1 & {
      environment: NonNullable<ContextSnapshotV1["environment"]>;
    }>;
  };
  readonly history: {
    fetch(
      request: ContextComposeRequestV1,
      signal: AbortSignal,
    ): Promise<SourceMetadataV1 & {
      history: ContextSnapshotV1["history"];
    }>;
  };
}

type ContextContributionV1 =
  | Awaited<ReturnType<ContextSourceAdaptersV1["knowthat"]["fetch"]>>
  | Awaited<ReturnType<ContextSourceAdaptersV1["memory"]["fetch"]>>
  | Awaited<ReturnType<ContextSourceAdaptersV1["skill"]["fetch"]>>
  | Awaited<ReturnType<ContextSourceAdaptersV1["environment"]["fetch"]>>
  | Awaited<ReturnType<ContextSourceAdaptersV1["history"]["fetch"]>>;

interface ContextFetchResultV1 {
  readonly outcome: ContextSourceOutcomeV1;
  readonly contribution?: ContextContributionV1;
}

export interface TriggerProcessSnapshotRetentionReadRequestV1 {
  readonly trigger_process_id: string;
  readonly workspace_id: string;
  readonly bot_id: string;
  readonly owner_agent_id: string;
  readonly deployment_environment: ContextComposeRequestV1["deployment_environment"];
  readonly release_channel: ContextComposeRequestV1["release_channel"];
}

export interface TriggerProcessSnapshotRetentionRepositoryV1 {
  readCurrent(
    request: TriggerProcessSnapshotRetentionReadRequestV1,
    signal: AbortSignal,
  ): Promise<string>;
}

export interface TriggerLifecycleDependenciesV1 {
  /**
   * Reads and verifies the accepted TP owner challenge before a Runtime Start
   * reservation can be created. It is optional only for no-confirmation flows;
   * any request carrying a confirmation fails closed when this port is absent.
   */
  readonly confirmations?: AcceptedTriggerConfirmationVerifierV1;
  readonly context_sources: ContextSourceAdaptersV1;
  /**
   * Reads immutable owner facts used to freeze IntentPolicyInputSnapshotV1.
   * Implementations must call the Action Runtime current-profile API and the
   * Skill Registry first Catalog page with workload-authenticated five-part
   * scope. Callers and model payloads are never policy authorities.
   */
  readonly intent_policy_sources: {
    readonly tool_permissions: {
      readCurrent(
        request: Readonly<{
          workspace_id: string;
          bot_id: string;
          owner_agent_id: string;
          deployment_environment: ContextComposeRequestV1["deployment_environment"];
          release_channel: ContextComposeRequestV1["release_channel"];
          trace_id: string;
        }>,
        signal: AbortSignal,
      ): Promise<ToolPermissionProfileV1>;
    };
    readonly skill_catalog: {
      readFirstPage(
        request: Readonly<{
          workspace_id: string;
          bot_id: string;
          owner_agent_id: string;
          deployment_environment: ContextComposeRequestV1["deployment_environment"];
          release_channel: ContextComposeRequestV1["release_channel"];
          trace_id: string;
        }>,
        signal: AbortSignal,
      ): Promise<SkillCatalogQueryDetailsV1>;
    };
  };
  readonly intent_engine: {
    synthesize(
      request: IntentSynthesizeRequestV1,
      signal: AbortSignal,
    ): Promise<IntentSynthesizeResponseV1>;
  };
  readonly object_store: Pick<ObjectStorePortV1, "putImmutable">;
  /**
   * Owner-backed resolver for the immutable ContextSnapshot bytes. Callers may
   * supply only the expected identity; this port must read the canonical
   * object and fail closed instead of reconstructing it from request fields.
   */
  readonly context_snapshots: {
    resolve(
      request: Readonly<{
        trigger_process_id: string;
        workspace_id: string;
        bot_id: string;
        owner_agent_id: string;
        deployment_environment: ContextComposeRequestV1["deployment_environment"];
        release_channel: ContextComposeRequestV1["release_channel"];
        context_snapshot_ref: string;
        context_snapshot_version: number;
        context_snapshot_hash: string;
        purpose: "intent_synthesis" | "runtime_start";
      }>,
      signal: AbortSignal,
    ): Promise<ContextSnapshotV1>;
  };
  /** Reads the Action Runtime owner's durable event behind payload_ref. */
  readonly runtime_events: {
    resolve(
      request: RuntimeEventResolveRequestV1,
      signal: AbortSignal,
    ): Promise<RuntimeEventReadContractV1>;
  };
  /**
   * Reads the current Process retention boundary from Trigger Processor's
   * owner row. The lifecycle performs an early comparison and also passes the
   * value to the owner writer for an under-lock equality/retention check.
   */
  readonly process_snapshot_retention: TriggerProcessSnapshotRetentionRepositoryV1;
  readonly now?: () => Date;
  readonly context_retention_until: (request: ContextComposeRequestV1) => string;
}

export class TriggerLifecycleStageErrorV1 extends Error {
  public constructor(
    public readonly stage: "context" | "intent" | "runtime" | "snapshot" | "meta",
    public readonly reason_code: string,
    options?: ErrorOptions,
    public readonly owner_commit_completed = false,
  ) {
    super(`${stage} stage failed: ${reason_code}`, options);
    this.name = "TriggerLifecycleStageErrorV1";
  }
}

export interface TriggerProcessWorkClaimV1 {
  readonly work_item_id: string;
  readonly claim_token: string;
  readonly lease_generation: number;
  readonly lease_owner: string;
  readonly expected_process_state_version: number;
  readonly payload_hash: `sha256:${string}`;
}

export interface TriggerLifecycleApplicationV1 {
  composeContext(
    request: unknown,
    workClaim?: unknown,
  ): Promise<ContextComposeResponseV1>;
  synthesizeIntent(
    request: unknown,
    workClaim?: unknown,
  ): Promise<IntentSynthesizeResponseV1>;
  reserveRuntimeStart(request: unknown, workClaim?: unknown): Promise<void>;
  appendRuntimeEvent(input: Readonly<{
    request: unknown;
    authenticated_principal: Readonly<{
      sub: "action_runtime";
      aud: "trigger_processor";
      capability: readonly string[];
      scope_kind: "bot";
      workspace_id: string;
      bot_id: string;
      owner_agent_id: string;
      deployment_environment: ContextComposeRequestV1["deployment_environment"];
      release_channel: ContextComposeRequestV1["release_channel"];
    }>;
  }>): Promise<RuntimeEventAppendResponseV1>;
  enqueueMeta(input: Readonly<{
    request: unknown;
    boundary_system_event_ref: string | null;
  }>, workClaim?: unknown): Promise<void>;
}

type RuntimeEventAppendInputV1 = Parameters<
  TriggerLifecycleApplicationV1["appendRuntimeEvent"]
>[0];
type MetaEnqueueInputV1 = Parameters<
  TriggerLifecycleApplicationV1["enqueueMeta"]
>[0];

function assertCanonicalJsonBoundaryV1(
  value: unknown,
  stage: TriggerLifecycleStageErrorV1["stage"],
  reasonCode: string,
): void {
  canonicalSnapshotForStageV1(value, stage, reasonCode);
}

function canonicalSnapshotForStageV1<T>(
  value: unknown,
  stage: TriggerLifecycleStageErrorV1["stage"],
  reasonCode: string,
): T {
  let snapshot: T;
  try {
    snapshot = JSON.parse(canonicalJsonV1(value)) as T;
  } catch (error) {
    throw new TriggerLifecycleStageErrorV1(stage, reasonCode, {
      cause: error,
    });
  }
  const pending: object[] = [];
  if (typeof snapshot === "object" && snapshot !== null) {
    pending.push(snapshot);
  }
  while (pending.length > 0) {
    const current = pending.pop()!;
    for (const entry of Object.values(current)) {
      if (
        typeof entry === "object" &&
        entry !== null &&
        !Object.isFrozen(entry)
      ) {
        pending.push(entry);
      }
    }
    Object.freeze(current);
  }
  return snapshot;
}

function assertWorkClaimV1(value: unknown): TriggerProcessWorkClaimV1 {
  const snapshot = canonicalSnapshotForStageV1<unknown>(
    value,
    "runtime",
    "work_claim_invalid",
  );
  if (
    typeof snapshot !== "object" ||
    snapshot === null ||
    Array.isArray(snapshot)
  ) {
    throw new TriggerLifecycleStageErrorV1(
      "runtime",
      "work_claim_required",
    );
  }
  const claim = snapshot as Partial<TriggerProcessWorkClaimV1>;
  if (
    typeof claim.work_item_id !== "string" ||
    claim.work_item_id.length < 1 ||
    claim.work_item_id.length > 512 ||
    typeof claim.claim_token !== "string" ||
    claim.claim_token.length < 1 ||
    claim.claim_token.length > 4096 ||
    typeof claim.lease_owner !== "string" ||
    claim.lease_owner.length < 1 ||
    claim.lease_owner.length > 512 ||
    !Number.isSafeInteger(claim.lease_generation) ||
    (claim.lease_generation ?? 0) < 1 ||
    !Number.isSafeInteger(claim.expected_process_state_version) ||
    (claim.expected_process_state_version ?? 0) < 1 ||
    typeof claim.payload_hash !== "string" ||
    !/^sha256:[0-9a-f]{64}$/u.test(claim.payload_hash) ||
    Object.keys(snapshot).sort().join(",") !==
      "claim_token,expected_process_state_version,lease_generation,lease_owner,payload_hash,work_item_id"
  ) {
    throw new TriggerLifecycleStageErrorV1(
      "runtime",
      "work_claim_invalid",
    );
  }
  return snapshot as TriggerProcessWorkClaimV1;
}

interface TriggerProcessWorkClaimWriterArgumentsV1 {
  readonly p_work_item_id: string;
  readonly p_claim_token: string;
  readonly p_lease_generation: string;
  readonly p_lease_owner: string;
  readonly p_expected_process_state_version: string;
  readonly p_result_hash: `sha256:${string}`;
}

function workClaimWriterArgumentsV1(
  claim: TriggerProcessWorkClaimV1,
  result: unknown,
): TriggerProcessWorkClaimWriterArgumentsV1 {
  return Object.freeze({
    p_work_item_id: claim.work_item_id,
    p_claim_token: claim.claim_token,
    p_lease_generation: String(claim.lease_generation),
    p_lease_owner: claim.lease_owner,
    p_expected_process_state_version: String(
      claim.expected_process_state_version,
    ),
    p_result_hash: sha256({
      work_item_id: claim.work_item_id,
      payload_hash: claim.payload_hash,
      result,
    }),
  });
}

function assertResolvedContextSnapshotV1(
  snapshot: ContextSnapshotV1,
  expected: Readonly<{
    trigger_process_id: string;
    workspace_id: string;
    bot_id: string;
    owner_agent_id: string;
    deployment_environment: ContextSnapshotV1["deployment_environment"];
    release_channel: ContextSnapshotV1["release_channel"];
    context_snapshot_version: number;
    context_snapshot_hash: string;
  }>,
): void {
  assertCanonicalJsonBoundaryV1(
    snapshot,
    "context",
    "context_snapshot_binding_mismatch",
  );
  if (
    !Value.Check(ContextSnapshotV1Schema, snapshot) ||
    snapshot.trigger_process_id !== expected.trigger_process_id ||
    snapshot.workspace_id !== expected.workspace_id ||
    snapshot.bot_id !== expected.bot_id ||
    snapshot.owner_agent_id !== expected.owner_agent_id ||
    snapshot.deployment_environment !== expected.deployment_environment ||
    snapshot.release_channel !== expected.release_channel ||
    snapshot.context_version !== expected.context_snapshot_version ||
    snapshot.snapshot_hash !== expected.context_snapshot_hash ||
    sha256(withoutHash(snapshot, "snapshot_hash")) !== snapshot.snapshot_hash
  ) {
    throw new TriggerLifecycleStageErrorV1(
      "context",
      "context_snapshot_binding_mismatch",
    );
  }
  assertContextSnapshotSemanticBindingsV1(snapshot);
}

function assertIntentUsesContextCatalogV1(
  snapshot: ContextSnapshotV1,
  response: IntentSynthesizeResponseV1,
): void {
  const intent = response.details.structured_intent;
  if (snapshot.skill_catalog === null) {
    if (
      intent.required_skills.length !== 0 ||
      intent.action_plan.some((step) => step.candidate_skill !== undefined)
    ) {
      throw new TriggerLifecycleStageErrorV1(
        "intent",
        "unavailable_catalog_widened_intent",
      );
    }
    return;
  }
  const policy = response.details.intent_policy_snapshot;
  if (
    policy.catalog_version !== snapshot.skill_catalog.catalog_version ||
    policy.catalog_as_of !== snapshot.skill_catalog.catalog_as_of
  ) {
    throw new TriggerLifecycleStageErrorV1(
      "intent",
      "context_catalog_binding_mismatch",
    );
  }
}

function resultCount(
  source: ContextSourceNameV1,
  contribution: ContextContributionV1,
): number {
  switch (source) {
    case "knowthat":
      return "pinned_facts" in contribution
        ? contribution.pinned_facts.length
        : 0;
    case "memory":
      return "memory_context" in contribution
        ? contribution.memory_context.length
        : 0;
    case "skill":
      return "skill_catalog" in contribution
        ? contribution.skill_catalog.items.length
        : 0;
    case "environment":
      return "environment" in contribution ? 1 : 0;
    case "history":
      return "history" in contribution ? contribution.history.length : 0;
  }
}

function sourceFailureReason(error: unknown): string {
  return error instanceof Error && error.message === "deadline_exceeded"
    ? "source_timeout"
    : "source_failed";
}

function immutableObjectResultSnapshotV1(
  value: unknown,
  expected: Readonly<{
    sha256: string;
    size_bytes: number;
    media_type: string;
    retention_until: string;
  }>,
): Readonly<{
  object_ref: string;
  version: string;
  sha256: string;
  size_bytes: number;
  media_type: string;
  retention_until: string;
  replayed: boolean;
}> {
  const snapshot = canonicalSnapshotForStageV1<unknown>(
    value,
    "context",
    "object_store_result_binding_mismatch",
  );
  if (
    typeof snapshot !== "object" ||
    snapshot === null ||
    Array.isArray(snapshot) ||
    Object.keys(snapshot).sort().join(",") !==
      "media_type,object_ref,replayed,retention_until,sha256,size_bytes,version" ||
    !("object_ref" in snapshot) ||
    typeof snapshot.object_ref !== "string" ||
    snapshot.object_ref.length < 1 ||
    snapshot.object_ref.length > 512 ||
    /[\r\n]/u.test(snapshot.object_ref) ||
    !("version" in snapshot) ||
    typeof snapshot.version !== "string" ||
    snapshot.version.length < 1 ||
    snapshot.version.length > 512 ||
    !("replayed" in snapshot) ||
    typeof snapshot.replayed !== "boolean" ||
    !("sha256" in snapshot) ||
    snapshot.sha256 !== expected.sha256 ||
    !("size_bytes" in snapshot) ||
    snapshot.size_bytes !== expected.size_bytes ||
    !("media_type" in snapshot) ||
    snapshot.media_type !== expected.media_type ||
    !("retention_until" in snapshot) ||
    snapshot.retention_until !== expected.retention_until
  ) {
    throw new TriggerLifecycleStageErrorV1(
      "context",
      "object_store_result_binding_mismatch",
    );
  }
  return snapshot as Readonly<{
    object_ref: string;
    version: string;
    sha256: string;
    size_bytes: number;
    media_type: string;
    retention_until: string;
    replayed: boolean;
  }>;
}

export function createTriggerLifecycleApplicationV1(
  database: TriggerProcessorOwnerDatabaseV1,
  dependencies: TriggerLifecycleDependenciesV1,
): TriggerLifecycleApplicationV1 {
  const now = dependencies.now ?? (() => new Date());

  async function fetchContextSource(
    request: ContextComposeRequestV1,
    source: ContextSourceNameV1,
  ): Promise<ContextFetchResultV1> {
    const skip = request.source_policy.skip_decisions.find(
      (decision) => decision.source === source,
    );
    if (skip !== undefined) {
      const retrievedAt = now().toISOString();
      return {
        outcome: {
          source,
          status: "skipped_by_policy",
          retrieved_at: retrievedAt,
          source_as_of: null,
          source_version: null,
          latency_ms: 0,
          result_count: 0,
          failure_reason: null,
          policy_id: skip.policy_id,
          reason_code: skip.reason_code,
          source_owner: skip.source_owner,
        },
      };
    }
    const startedAt = now().getTime();
    try {
      const adapter = dependencies.context_sources[source];
      const contributionValue = await withDeadline(CONTEXT_TIMEOUT_MS, (signal) =>
        adapter.fetch(request, signal) as Promise<ContextContributionV1>,
      );
      const contribution = canonicalSnapshotForStageV1<ContextContributionV1>(
        contributionValue,
        "context",
        "context_source_payload_invalid",
      );
      const count = resultCount(source, contribution);
      const retrievedAt = now().toISOString();
      return {
        contribution,
        outcome: {
          source,
          status:
            contribution.degraded_reason === undefined
              ? count === 0
                ? "empty"
                : "ok"
              : "degraded",
          retrieved_at: retrievedAt,
          source_as_of: contribution.source_as_of,
          source_version: contribution.source_version,
          latency_ms: Math.max(0, now().getTime() - startedAt),
          result_count: count,
          failure_reason: contribution.degraded_reason ?? null,
        },
      };
    } catch (error) {
      const reason = sourceFailureReason(error);
      const retrievedAt = now().toISOString();
      return {
        outcome: {
          source,
          status: reason === "source_timeout" ? "timeout" : "failed",
          retrieved_at: retrievedAt,
          source_as_of: null,
          source_version: null,
          latency_ms: Math.max(0, now().getTime() - startedAt),
          result_count: 0,
          failure_reason: reason,
        },
      };
    }
  }

  async function persistContextOutcomes(
    request: ContextComposeRequestV1,
    outcomes: readonly ContextSourceOutcomeV1[],
    stageResult:
      | Readonly<{
          status: "composed";
          context_snapshot_ref: string;
          context_snapshot_version: number;
          context_snapshot_hash: string;
          context_snapshot_retention_until: string;
          physical_object_hash: string;
        }>
      | Readonly<{
          status: "failed";
          reason_code: string;
          source_status: readonly ContextSourceOutcomeV1[];
        }>,
    workClaim: TriggerProcessWorkClaimV1,
    policyFacts?: Readonly<{
      tool_permission_profile: ToolPermissionProfileV1;
      skill_catalog_snapshot: SkillCatalogQueryDetailsV1;
    }>,
  ): Promise<void> {
    const requestHash = sha256(withoutHash(request, "trace_id"));
    await database.unit_of_work.withTransaction(
      {
        operation: "complete_context_compose",
        idempotency_key: request.idempotency_key,
        trace_id: request.trace_id,
        isolation: "serializable",
        retry: "serialization_failures",
      },
      async (transaction, { owner }) => {
        const contextCompleted = stageResult.status === "composed";
        await owner.executeWriter(transaction, {
          writer: "advance_trigger_stage_v1",
          arguments: {
            p_process_id: request.trigger_process_id,
            p_progression:
              stageResult.status === "composed"
                ? "context_to_intent"
                : "context_failed",
            p_stage_result: stageResult,
            p_context_snapshot_ref:
              contextCompleted ? stageResult.context_snapshot_ref : null,
            p_context_snapshot_version:
              contextCompleted
                ? String(stageResult.context_snapshot_version)
                : null,
            p_context_snapshot_hash:
              contextCompleted ? stageResult.context_snapshot_hash : null,
            p_context_snapshot_retention_until:
              contextCompleted
                ? stageResult.context_snapshot_retention_until
                : null,
            p_context_source_outcomes: outcomes,
            p_tool_permission_profile:
              policyFacts?.tool_permission_profile ?? null,
            p_skill_catalog_snapshot:
              policyFacts?.skill_catalog_snapshot ?? null,
            ...workClaimWriterArgumentsV1(workClaim, {
              progression:
                stageResult.status === "composed"
                  ? "context_to_intent"
                  : "context_failed",
              stage_result: stageResult,
            }),
            p_request_hash: requestHash,
            p_trace_id: request.trace_id,
          },
          expected_rows: 1,
        });
      },
    );
  }

  return Object.freeze({
    async composeContext(requestValue: unknown, workClaimValue?: unknown) {
      const requestSnapshot = canonicalSnapshotForStageV1<unknown>(
        requestValue,
        "context",
        "invalid_request",
      );
      if (!Value.Check(ContextComposeRequestV1Schema, requestSnapshot)) {
        throw new TriggerLifecycleStageErrorV1("context", "invalid_request");
      }
      const request = requestSnapshot as ContextComposeRequestV1;
      const workClaim = assertWorkClaimV1(workClaimValue);
      assertContextComposeRequestBindingsV1(request);
      const results = await Promise.all(
        CONTEXT_SOURCE_NAMES_V1.map((source) =>
          fetchContextSource(request, source),
        ),
      );
      const outcomes = results.map(({ outcome }) => outcome);
      assertContextSourceOutcomesV1(outcomes);
      const environment = results.find(
        ({ outcome }) => outcome.source === "environment",
      );
      const requiredFailure = outcomes.find(
        (outcome) =>
          request.source_policy.required_sources.includes(outcome.source) &&
          (outcome.status === "failed" ||
            outcome.status === "timeout" ||
            outcome.status === "skipped_by_policy"),
      );
      if (
        environment?.outcome.status === "failed" ||
        environment?.outcome.status === "timeout" ||
        requiredFailure !== undefined
      ) {
        await persistContextOutcomes(request, outcomes, {
          status: "failed",
          reason_code:
            environment?.outcome.status === "failed" ||
            environment?.outcome.status === "timeout"
              ? "environment_unavailable"
              : "required_context_source_unavailable",
          source_status: outcomes,
        }, workClaim);
        throw new TriggerLifecycleStageErrorV1(
          "context",
          environment?.outcome.status === "failed" ||
            environment?.outcome.status === "timeout"
            ? "environment_unavailable"
            : "required_context_source_unavailable",
          undefined,
          true,
        );
      }

      const contribution = (source: ContextSourceNameV1) =>
        results.find(({ outcome }) => outcome.source === source)?.contribution;
      const environmentContribution = contribution("environment");
      const environmentOutcome = outcomes.find(
        (outcome) => outcome.source === "environment",
      );
      if (
        (environmentContribution === undefined ||
          !("environment" in environmentContribution)) &&
        environmentOutcome?.status !== "skipped_by_policy"
      ) {
        throw new TriggerLifecycleStageErrorV1(
          "context",
          "environment_missing",
        );
      }
      const partial = {
        schema_version: "context_snapshot.v1" as const,
        trigger_process_id: request.trigger_process_id,
        context_version: request.context_version,
        workspace_id: request.workspace_id,
        bot_id: request.bot_id,
        owner_agent_id: request.owner_agent_id,
        deployment_environment: request.deployment_environment,
        release_channel: request.release_channel,
        pinned_facts:
          (contribution("knowthat") as
            | Awaited<ReturnType<ContextSourceAdaptersV1["knowthat"]["fetch"]>>
            | undefined)?.pinned_facts ?? [],
        memory_context:
          (contribution("memory") as
            | Awaited<ReturnType<ContextSourceAdaptersV1["memory"]["fetch"]>>
            | undefined)?.memory_context ?? [],
        skill_catalog:
          (contribution("skill") as
            | Awaited<ReturnType<ContextSourceAdaptersV1["skill"]["fetch"]>>
            | undefined)?.skill_catalog ?? null,
        environment:
          environmentContribution !== undefined &&
          "environment" in environmentContribution
            ? environmentContribution.environment
            : null,
        history:
          (contribution("history") as
            | Awaited<ReturnType<ContextSourceAdaptersV1["history"]["fetch"]>>
            | undefined)?.history ?? [],
        source_status: outcomes,
        assembly_notes: outcomes.flatMap((outcome) =>
          outcome.status === "ok" || outcome.status === "empty"
            ? []
            : [
                outcome.status === "skipped_by_policy"
                  ? outcome.reason_code
                  : (outcome.failure_reason ?? `${outcome.source}_degraded`),
              ],
        ),
      };
      const snapshot: ContextSnapshotV1 = {
        ...partial,
        snapshot_hash: sha256(partial),
      };
      if (!Value.Check(ContextSnapshotV1Schema, snapshot)) {
        throw new TriggerLifecycleStageErrorV1(
          "context",
          "assembled_snapshot_invalid",
        );
      }
      assertContextSnapshotSemanticBindingsV1(snapshot);
      let policyFacts: Readonly<{
        tool_permission_profile: ToolPermissionProfileV1;
        skill_catalog_snapshot: SkillCatalogQueryDetailsV1;
      }>;
      try {
        const policyRequest = Object.freeze({
          workspace_id: request.workspace_id,
          bot_id: request.bot_id,
          owner_agent_id: request.owner_agent_id,
          deployment_environment: request.deployment_environment,
          release_channel: request.release_channel,
          trace_id: request.trace_id,
        });
        const [profileValue, catalogValue] = await Promise.all([
          withDeadline(CONTEXT_TIMEOUT_MS, (signal) =>
            dependencies.intent_policy_sources.tool_permissions.readCurrent(
              policyRequest,
              signal,
            ),
          ),
          withDeadline(CONTEXT_TIMEOUT_MS, (signal) =>
            dependencies.intent_policy_sources.skill_catalog.readFirstPage(
              policyRequest,
              signal,
            ),
          ),
        ]);
        const toolPermissionProfile =
          canonicalSnapshotForStageV1<ToolPermissionProfileV1>(
            profileValue,
            "context",
            "intent_policy_owner_unavailable",
          );
        const skillCatalogSnapshot =
          canonicalSnapshotForStageV1<SkillCatalogQueryDetailsV1>(
            catalogValue,
            "context",
            "intent_policy_owner_unavailable",
          );
        if (
          !Value.Check(ToolPermissionProfileV1Schema, toolPermissionProfile) ||
          !Value.Check(SkillCatalogQueryDetailsV1Schema, skillCatalogSnapshot)
        ) {
          throw new Error("owner_contract_drift");
        }
        assertToolPermissionProfileSemanticBindingsV1(
          toolPermissionProfile,
          (canonicalUtf8) =>
            `sha256:${createHash("sha256").update(canonicalUtf8, "utf8").digest("hex")}`,
        );
        const profileScope = toolPermissionProfile.selector;
        if (
          profileScope.workspace_id !== request.workspace_id ||
          profileScope.bot_id !== request.bot_id ||
          profileScope.owner_agent_id !== request.owner_agent_id ||
          profileScope.deployment_environment !==
            request.deployment_environment ||
          profileScope.release_channel !== request.release_channel ||
          skillCatalogSnapshot.workspace_id !== request.workspace_id ||
          skillCatalogSnapshot.bot_id !== request.bot_id ||
          skillCatalogSnapshot.owner_agent_id !== request.owner_agent_id ||
          skillCatalogSnapshot.deployment_environment !==
            request.deployment_environment ||
          skillCatalogSnapshot.release_channel !== request.release_channel ||
          (snapshot.skill_catalog !== null &&
            (skillCatalogSnapshot.catalog_version !==
              snapshot.skill_catalog.catalog_version ||
              skillCatalogSnapshot.as_of !== snapshot.skill_catalog.catalog_as_of))
        ) {
          throw new Error("owner_scope_or_catalog_binding_mismatch");
        }
        policyFacts = Object.freeze({
          tool_permission_profile: toolPermissionProfile,
          skill_catalog_snapshot: skillCatalogSnapshot,
        });
      } catch (error) {
        throw new TriggerLifecycleStageErrorV1(
          "context",
          "intent_policy_owner_unavailable",
          { cause: error },
        );
      }
      const body = Buffer.from(canonicalJsonV1(snapshot), "utf8");
      const physicalHash = `sha256:${createHash("sha256").update(body).digest("hex")}`;
      const retentionUntil = dependencies.context_retention_until(request);
      if (
        !Number.isFinite(Date.parse(retentionUntil)) ||
        Date.parse(retentionUntil) <= now().getTime()
      ) {
        throw new TriggerLifecycleStageErrorV1(
          "context",
          "context_retention_invalid",
        );
      }
      const storedValue = await dependencies.object_store.putImmutable({
        owner_service: "trigger_processor",
        owner_object_id: request.trigger_process_id,
        // The physical object's immutable owner binding is the context
        // snapshot identity. The process state version is only the database
        // transition fence and may advance independently.
        owner_state_version: request.context_version,
        scope: {
          scope_kind: "bot",
          workspace_id: request.workspace_id,
          bot_id: request.bot_id,
          owner_agent_id: request.owner_agent_id,
          deployment_environment: request.deployment_environment,
          release_channel: request.release_channel,
        },
        capability: "trigger_process.snapshot.manage",
        object_class: "trigger_process_snapshot",
        // A failed DB finalization may retry after owner data has advanced.
        // Keep physical immutable writes content-addressed; the owner writer's
        // context-version/idempotency fence still chooses the one canonical
        // logical snapshot and ObjectStore reconciliation can collect the
        // unreferenced attempt without wedging the base request key.
        idempotency_key: `${request.idempotency_key}:${snapshot.snapshot_hash}`,
        expected_sha256: physicalHash,
        size_bytes: body.byteLength,
        media_type: "application/json",
        retention_until: retentionUntil,
        body: oneChunk(body),
      });
      const stored = immutableObjectResultSnapshotV1(storedValue, {
        sha256: physicalHash,
        size_bytes: body.byteLength,
        media_type: "application/json",
        retention_until: retentionUntil,
      });
      const response: ContextComposeResponseV1 = {
        code: "context_composed",
        message: "context composed",
        retryable: false,
        trace_id: request.trace_id,
        details: {
          context_snapshot_ref: stored.object_ref,
          context_snapshot_version: request.context_version,
          context_snapshot_hash: snapshot.snapshot_hash,
          source_status: outcomes,
          assembly_notes: snapshot.assembly_notes,
        },
      };
      if (!Value.Check(ContextComposeResponseV1Schema, response)) {
        throw new TriggerLifecycleStageErrorV1(
          "context",
          "response_invalid",
        );
      }
      await persistContextOutcomes(request, outcomes, {
        status: "composed",
        context_snapshot_ref: stored.object_ref,
        context_snapshot_version: request.context_version,
        context_snapshot_hash: snapshot.snapshot_hash,
        context_snapshot_retention_until: retentionUntil,
        physical_object_hash: stored.sha256,
      }, workClaim, policyFacts);
      return response;
    },

    async synthesizeIntent(requestValue: unknown, workClaimValue?: unknown) {
      const requestSnapshot = canonicalSnapshotForStageV1<unknown>(
        requestValue,
        "intent",
        "invalid_request",
      );
      if (!Value.Check(IntentSynthesizeRequestV1Schema, requestSnapshot)) {
        throw new TriggerLifecycleStageErrorV1("intent", "invalid_request");
      }
      const request = requestSnapshot as IntentSynthesizeRequestV1;
      const workClaim = assertWorkClaimV1(workClaimValue);
      assertIntentSynthesizeRequestBindingsV1(request);
      if (
        sha256(withoutHash(request.intent_policy_snapshot, "snapshot_hash")) !==
          request.intent_policy_snapshot.snapshot_hash
      ) {
        throw new TriggerLifecycleStageErrorV1(
          "intent",
          "policy_snapshot_binding_mismatch",
        );
      }
      let contextSnapshot: ContextSnapshotV1;
      try {
        const contextSnapshotValue = await withDeadline(CONTEXT_TIMEOUT_MS, (signal) =>
          dependencies.context_snapshots.resolve(
            {
              trigger_process_id: request.trigger_process_id,
              workspace_id: request.workspace_id,
              bot_id: request.bot_id,
              owner_agent_id: request.owner_agent_id,
              deployment_environment: request.deployment_environment,
              release_channel: request.release_channel,
              context_snapshot_ref: request.context_snapshot_ref,
              context_snapshot_version: request.context_snapshot_version,
              context_snapshot_hash: request.context_snapshot_hash,
              purpose: "intent_synthesis",
            },
            signal,
          ),
        );
        contextSnapshot = canonicalSnapshotForStageV1<ContextSnapshotV1>(
          contextSnapshotValue,
          "intent",
          "context_snapshot_unavailable",
        );
      } catch (error) {
        throw new TriggerLifecycleStageErrorV1(
          "intent",
          "context_snapshot_unavailable",
          { cause: error },
        );
      }
      assertResolvedContextSnapshotV1(contextSnapshot, request);
      let response: IntentSynthesizeResponseV1;
      try {
        const responseValue = await withDeadline(INTENT_TIMEOUT_MS, (signal) =>
          dependencies.intent_engine.synthesize(request, signal),
        );
        response = canonicalSnapshotForStageV1<IntentSynthesizeResponseV1>(
          responseValue,
          "intent",
          "response_binding_mismatch",
        );
      } catch (error) {
        throw new TriggerLifecycleStageErrorV1(
          "intent",
          "intent_provider_unavailable",
          { cause: error },
        );
      }
      assertCanonicalJsonBoundaryV1(
        response,
        "intent",
        "response_binding_mismatch",
      );
      if (
        !Value.Check(IntentSynthesizeResponseV1Schema, response) ||
        response.trace_id !== request.trace_id ||
        response.details.intent_version !== request.intent_version ||
        response.details.intent_policy_snapshot.snapshot_hash !==
          request.intent_policy_snapshot.snapshot_hash ||
        response.details.structured_intent_hash !==
          sha256(response.details.structured_intent)
      ) {
        throw new TriggerLifecycleStageErrorV1(
          "intent",
          "response_binding_mismatch",
        );
      }
      assertStructuredIntentSemanticBindingsV1(
        response.details.structured_intent,
      );
      assertIntentUsesContextCatalogV1(contextSnapshot, response);
      let runtimeToolPermissionProfile: ToolPermissionProfileV1 | null = null;
      if (response.details.policy_decision !== "deny") {
        try {
          const profileValue = await withDeadline(
            CONTEXT_TIMEOUT_MS,
            (signal) =>
              dependencies.intent_policy_sources.tool_permissions.readCurrent(
                {
                  workspace_id: request.workspace_id,
                  bot_id: request.bot_id,
                  owner_agent_id: request.owner_agent_id,
                  deployment_environment: request.deployment_environment,
                  release_channel: request.release_channel,
                  trace_id: request.trace_id,
                },
                signal,
              ),
          );
          const profile = canonicalSnapshotForStageV1<ToolPermissionProfileV1>(
            profileValue,
            "intent",
            "tool_permission_profile_unavailable",
          );
          if (!Value.Check(ToolPermissionProfileV1Schema, profile)) {
            throw new Error("owner_contract_drift");
          }
          assertToolPermissionProfileSemanticBindingsV1(
            profile,
            (canonicalUtf8) =>
              `sha256:${createHash("sha256").update(canonicalUtf8, "utf8").digest("hex")}`,
          );
          const policy = request.intent_policy_snapshot;
          if (
            profile.selector.workspace_id !== request.workspace_id ||
            profile.selector.bot_id !== request.bot_id ||
            profile.selector.owner_agent_id !== request.owner_agent_id ||
            profile.selector.deployment_environment !==
              request.deployment_environment ||
            profile.selector.release_channel !== request.release_channel ||
            profile.profile_ref !== policy.tool_permission_profile_ref ||
            profile.revision !== policy.tool_permission_profile_revision ||
            profile.profile_hash !== policy.tool_permission_profile_hash ||
            profile.policy_epoch !== policy.tool_policy_epoch
          ) {
            throw new Error("owner_binding_changed");
          }
          runtimeToolPermissionProfile = profile;
        } catch (error) {
          throw new TriggerLifecycleStageErrorV1(
            "intent",
            "tool_permission_profile_unavailable",
            { cause: error },
          );
        }
      }
      await database.unit_of_work.withTransaction(
        {
          operation: "complete_intent_synthesis",
          idempotency_key: request.idempotency_key,
          trace_id: request.trace_id,
          isolation: "serializable",
          retry: "serialization_failures",
        },
        async (transaction, { owner }) =>
          owner.executeWriter(transaction, {
            writer: "advance_trigger_stage_v1",
            arguments: {
              p_process_id: request.trigger_process_id,
              p_progression: "intent_synthesized",
              p_stage_result: response.details,
              p_context_snapshot_ref: null,
              p_context_snapshot_version: null,
              p_context_snapshot_hash: null,
              p_context_snapshot_retention_until: null,
              p_context_source_outcomes: null,
              p_tool_permission_profile: runtimeToolPermissionProfile,
              p_skill_catalog_snapshot: contextSnapshot.skill_catalog,
              ...workClaimWriterArgumentsV1(workClaim, {
                progression: "intent_synthesized",
                stage_result: response.details,
              }),
              p_request_hash: sha256(withoutHash(request, "trace_id")),
              p_trace_id: request.trace_id,
            },
            expected_rows: 1,
          }),
      );
      return response;
    },

    async reserveRuntimeStart(requestValue: unknown, workClaimValue?: unknown) {
      const requestSnapshot = canonicalSnapshotForStageV1<unknown>(
        requestValue,
        "runtime",
        "invalid_request",
      );
      if (!Value.Check(RuntimeStartRequestV1Schema, requestSnapshot)) {
        throw new TriggerLifecycleStageErrorV1("runtime", "invalid_request");
      }
      const request = requestSnapshot as RuntimeStartRequestV1;
      const workClaim = assertWorkClaimV1(workClaimValue);
      assertRuntimeStartSemanticBindingsV1(request, now().getTime());
      if (
        sha256(request.structured_intent) !== request.structured_intent_hash ||
        sha256(request.policy) !== request.policy_input_hash ||
        sha256(
          withoutHash(request.intent_policy_snapshot, "snapshot_hash"),
        ) !== request.intent_policy_snapshot_hash
      ) {
        throw new TriggerLifecycleStageErrorV1(
          "runtime",
          "runtime_start_artifact_hash_mismatch",
        );
      }
      if (request.confirmation_ref !== null) {
        if (
          request.confirmation_hash === null ||
          dependencies.confirmations === undefined
        ) {
          throw new TriggerLifecycleStageErrorV1(
            "runtime",
            "confirmation_owner_unavailable",
          );
        }
        try {
          await withDeadline(CONTEXT_TIMEOUT_MS, (signal) =>
            dependencies.confirmations!.assertAccepted(
              {
                confirmation_ref: request.confirmation_ref!,
                confirmation_hash: request.confirmation_hash!,
                trigger_process_id: request.trigger_process_id,
                workspace_id: request.workspace_id,
                bot_id: request.bot_id,
                owner_agent_id: request.owner_agent_id,
                deployment_environment: request.deployment_environment,
                release_channel: request.release_channel,
                intent_ref: request.intent_ref,
                intent_version: request.intent_version,
                structured_intent_hash: request.structured_intent_hash,
                policy_input_hash: request.policy_input_hash,
              },
              signal,
            ),
          );
        } catch (error) {
          throw new TriggerLifecycleStageErrorV1(
            "runtime",
            "confirmation_not_accepted_or_mismatched",
            { cause: error },
          );
        }
      }
      let contextSnapshot: ContextSnapshotV1;
      try {
        const contextSnapshotValue = await withDeadline(CONTEXT_TIMEOUT_MS, (signal) =>
          dependencies.context_snapshots.resolve(
            {
              trigger_process_id: request.trigger_process_id,
              workspace_id: request.workspace_id,
              bot_id: request.bot_id,
              owner_agent_id: request.owner_agent_id,
              deployment_environment: request.deployment_environment,
              release_channel: request.release_channel,
              context_snapshot_ref: request.context_snapshot_ref,
              context_snapshot_version: request.context_snapshot_version,
              context_snapshot_hash: request.context_snapshot_hash,
              purpose: "runtime_start",
            },
            signal,
          ),
        );
        contextSnapshot = canonicalSnapshotForStageV1<ContextSnapshotV1>(
          contextSnapshotValue,
          "runtime",
          "context_snapshot_unavailable",
        );
      } catch (error) {
        throw new TriggerLifecycleStageErrorV1(
          "runtime",
          "context_snapshot_unavailable",
          { cause: error },
        );
      }
      assertResolvedContextSnapshotV1(contextSnapshot, request);
      if (
        contextSnapshot.skill_catalog === null ||
        contextSnapshot.skill_catalog.catalog_version !==
          request.expected_catalog_version ||
        contextSnapshot.skill_catalog.catalog_as_of !== request.catalog_as_of
      ) {
        throw new TriggerLifecycleStageErrorV1(
          "runtime",
          "context_catalog_unavailable_or_mismatched",
        );
      }
      const requestHash = sha256(withoutHash(request, "trace_id"));
      await database.unit_of_work.withTransaction(
        {
          operation: "reserve_runtime_start",
          idempotency_key: request.idempotency_key,
          trace_id: request.trace_id,
          isolation: "serializable",
          retry: "serialization_failures",
        },
        async (transaction, { owner }) =>
          owner.executeWriter(transaction, {
            writer: "create_runtime_start_reservation_v1",
            arguments: {
              p_process_id: request.trigger_process_id,
              p_bot_id: request.bot_id,
              p_start_attempt_no: String(request.start_attempt_no),
              p_reservation: {
                runtime_run_id: request.runtime_run_id,
                start_attempt_no: request.start_attempt_no,
                start_fence_token: request.start_fence_token,
                policy_input_ref: request.policy_input_ref,
                policy_input_hash: request.policy_input_hash,
              },
              p_command: request,
              p_idempotency_key: request.idempotency_key,
              ...workClaimWriterArgumentsV1(workClaim, {
                runtime_run_id: request.runtime_run_id,
                start_attempt_no: request.start_attempt_no,
                start_fence_token: request.start_fence_token,
              }),
              p_request_hash: requestHash,
              p_trace_id: request.trace_id,
            },
            expected_rows: 1,
          }),
      );
    },

    async appendRuntimeEvent(input: RuntimeEventAppendInputV1) {
      const inputSnapshot =
        canonicalSnapshotForStageV1<RuntimeEventAppendInputV1>(
          input,
          "snapshot",
          "invalid_request",
        );
      if (!Value.Check(RuntimeEventAppendRequestV1Schema, inputSnapshot.request)) {
        throw new TriggerLifecycleStageErrorV1("snapshot", "invalid_request");
      }
      const request = inputSnapshot.request as RuntimeEventAppendRequestV1;
      const principal = inputSnapshot.authenticated_principal;
      assertCanonicalJsonBoundaryV1(
        principal,
        "snapshot",
        "invalid_request",
      );
      if (
        principal.sub !== "action_runtime" ||
        principal.aud !== "trigger_processor" ||
        principal.scope_kind !== "bot" ||
        !principal.capability.includes("trigger.process.snapshot.append")
      ) {
        throw new TriggerLifecycleStageErrorV1(
          "snapshot",
          "runtime_event_principal_denied",
        );
      }
      const resolveRequest: RuntimeEventResolveRequestV1 = {
        schema_version: "runtime_event_resolve_request.v1",
        source_event_id: request.source_event_id,
        payload_ref: request.payload_ref,
        runtime_run_id: request.runtime_run_id,
        trigger_process_id: request.trigger_process_id,
        source_sequence_no: request.source_sequence_no,
        expected_payload_hash: request.payload_hash,
        workspace_id: principal.workspace_id,
        bot_id: principal.bot_id,
        owner_agent_id: principal.owner_agent_id,
        deployment_environment: principal.deployment_environment,
        release_channel: principal.release_channel,
        purpose: "trigger_snapshot_append",
        trace_id: request.trace_id,
      };
      if (!Value.Check(RuntimeEventResolveRequestV1Schema, resolveRequest)) {
        throw new TriggerLifecycleStageErrorV1(
          "snapshot",
          "runtime_event_owner_request_invalid",
        );
      }
      let ownerRead: RuntimeEventReadContractV1;
      try {
        const ownerReadValue = await withDeadline(2_000, (signal) =>
          dependencies.runtime_events.resolve(resolveRequest, signal),
        );
        ownerRead = canonicalSnapshotForStageV1<RuntimeEventReadContractV1>(
          ownerReadValue,
          "snapshot",
          "runtime_event_owner_payload_invalid",
        );
      } catch (error) {
        throw new TriggerLifecycleStageErrorV1(
          "snapshot",
          "runtime_event_owner_unavailable",
          { cause: error },
        );
      }
      assertCanonicalJsonBoundaryV1(
        ownerRead,
        "snapshot",
        "runtime_event_owner_payload_invalid",
      );
      if (
        !Value.Check(
          RuntimeEventReadContractV1Schema,
          [RuntimeDomainEventV1Schema],
          ownerRead,
        )
      ) {
        throw new TriggerLifecycleStageErrorV1(
          "snapshot",
          "runtime_event_owner_payload_invalid",
        );
      }
      try {
        assertRuntimeEventReadBindingsV1(resolveRequest, ownerRead);
      } catch (error) {
        throw new TriggerLifecycleStageErrorV1(
          "snapshot",
          "runtime_event_owner_payload_invalid",
          { cause: error },
        );
      }
      let expectedSnapshotRetentionUntil: string;
      try {
        expectedSnapshotRetentionUntil = await withDeadline(2_000, (signal) =>
          dependencies.process_snapshot_retention.readCurrent(
            {
              trigger_process_id: request.trigger_process_id,
              workspace_id: principal.workspace_id,
              bot_id: principal.bot_id,
              owner_agent_id: principal.owner_agent_id,
              deployment_environment: principal.deployment_environment,
              release_channel: principal.release_channel,
            },
            signal,
          ),
        );
      } catch (error) {
        throw new TriggerLifecycleStageErrorV1(
          "snapshot",
          "process_snapshot_retention_unavailable",
          { cause: error },
        );
      }
      const ownerRetentionNs = timestampNanosecondsV1(ownerRead.retention_until);
      const snapshotRetentionNs = timestampNanosecondsV1(
        expectedSnapshotRetentionUntil,
      );
      if (
        ownerRetentionNs === undefined ||
        snapshotRetentionNs === undefined ||
        ownerRetentionNs < snapshotRetentionNs
      ) {
        throw new TriggerLifecycleStageErrorV1(
          "snapshot",
          "runtime_event_owner_retention_insufficient",
        );
      }
      const sourceEvent = ownerRead.runtime_event;
      if (!Value.Check(RuntimeDomainEventV1Schema, sourceEvent)) {
        throw new TriggerLifecycleStageErrorV1(
          "snapshot",
          "runtime_event_owner_payload_invalid",
        );
      }
      try {
        assertRuntimeDomainEventSemanticBindingsV1(sourceEvent);
      } catch (error) {
        throw new TriggerLifecycleStageErrorV1(
          "snapshot",
          "runtime_event_owner_payload_invalid",
          { cause: error },
        );
      }
      assertRuntimeEventAppendBindingsV1(
        request,
        principal.sub,
        sourceEvent,
      );
      assertRuntimeObservationSummaryBindingsV1(request, sourceEvent);
      const payloadHash = sha256(sourceEvent);
      if (payloadHash !== request.payload_hash) {
        throw new TriggerLifecycleStageErrorV1(
          "snapshot",
          "payload_hash_mismatch",
        );
      }
      const requestHash = sha256(withoutHash(request, "trace_id"));
      const scopeFingerprint = sha256({
        source: request.source_service,
        trigger_process_id: request.trigger_process_id,
        runtime_run_id: request.runtime_run_id,
        workspace_id: principal.workspace_id,
        bot_id: principal.bot_id,
        owner_agent_id: principal.owner_agent_id,
        deployment_environment: principal.deployment_environment,
        release_channel: principal.release_channel,
      });
      const lifecycleWriter = (() => {
        switch (request.event_type) {
          case "runtime.run.started":
            return "record_runtime_started_v1" as const;
          case "runtime.run.completed":
            return "enter_trigger_cooldown_v1" as const;
          case "runtime.run.failed":
          case "runtime.run.cancelled":
          case "runtime.run.preempted":
            return "finalize_trigger_runtime_terminal_v1" as const;
          case "runtime.control_signal.handled":
            return "apply_runtime_control_handled_v1" as const;
          default:
            return "append_trigger_snapshot_v1" as const;
        }
      })();
      const resultValue = await database.unit_of_work.withTransaction(
        {
          operation: `append_runtime_event:${request.event_type}`,
          idempotency_key: request.idempotency_key,
          trace_id: request.trace_id,
          isolation: "serializable",
          retry: "serialization_failures",
        },
        async (transaction, { owner }) =>
          owner.executeWriter(transaction, {
            writer: lifecycleWriter,
            arguments: {
                  p_process_id: request.trigger_process_id,
                  p_append_request: request,
                  p_source_event: sourceEvent,
                  p_owner_event_read: ownerRead,
                  p_expected_snapshot_retention_until:
                    expectedSnapshotRetentionUntil,
                  p_expected_start_fence_generation:
                    String(sourceEvent.payload.start_fence_generation),
                  p_authenticated_context: {
                    producer: principal.sub,
                    audience: principal.aud,
                    capability: [...principal.capability],
                    scope_kind: principal.scope_kind,
                    workspace_id: principal.workspace_id,
                    bot_id: principal.bot_id,
                    owner_agent_id: principal.owner_agent_id,
                    deployment_environment:
                      principal.deployment_environment,
                    release_channel: principal.release_channel,
                  },
                  p_idempotency_key: request.idempotency_key,
                  p_payload_hash: payloadHash,
                  p_semantic_hash: requestHash,
                  p_scope_fingerprint: scopeFingerprint,
                  p_request_hash: requestHash,
                  p_trace_id: request.trace_id,
            },
            expected_rows: 1,
          }),
      );
      const result =
        canonicalSnapshotForStageV1<RuntimeEventAppendResponseV1>(
        resultValue,
        "snapshot",
        "writer_response_invalid",
      );
      if (
        !Value.Check(RuntimeEventAppendResponseV1Schema, result) ||
        result.trace_id !== request.trace_id ||
        result.details.trigger_process_id !==
          request.trigger_process_id
      ) {
        throw new TriggerLifecycleStageErrorV1(
          "snapshot",
          "writer_response_invalid",
        );
      }
      return result;
    },

    async enqueueMeta(
      input: MetaEnqueueInputV1,
      workClaimValue?: unknown,
    ) {
      const inputSnapshot = canonicalSnapshotForStageV1<MetaEnqueueInputV1>(
        input,
        "meta",
        "invalid_request",
      );
      if (!Value.Check(MetaJobCreateRequestV1Schema, inputSnapshot.request)) {
        throw new TriggerLifecycleStageErrorV1("meta", "invalid_request");
      }
      const request = inputSnapshot.request as MetaJobCreateRequestV1;
      const workClaim = assertWorkClaimV1(workClaimValue);
      assertMetaJobCreateSemanticBindingsV1(request, now().getTime());
      if (
        request.boundary_system_event_ref !==
        inputSnapshot.boundary_system_event_ref
      ) {
        throw new TriggerLifecycleStageErrorV1(
          "meta",
          "boundary_event_binding_mismatch",
        );
      }
      const requestHash = sha256(withoutHash(request, "trace_id"));
      await database.unit_of_work.withTransaction(
        {
          operation: "enqueue_trigger_meta_job",
          idempotency_key: request.idempotency_key,
          trace_id: request.trace_id,
          isolation: "serializable",
          retry: "serialization_failures",
        },
        async (transaction, { owner }) =>
          owner.executeWriter(transaction, {
            writer: "enqueue_trigger_meta_job_v1",
            arguments: {
              p_process_id: request.trigger_process_id,
              p_enqueue_reason: request.enqueue_reason as MetaEnqueueReasonV1,
              p_boundary_system_event_ref:
                request.boundary_system_event_ref,
              p_idempotency_key: request.idempotency_key,
              ...workClaimWriterArgumentsV1(workClaim, {
                idempotency_key: request.idempotency_key,
                enqueue_reason: request.enqueue_reason,
                boundary_system_event_ref:
                  request.boundary_system_event_ref,
              }),
              p_request_hash: requestHash,
              p_trace_id: request.trace_id,
            },
            expected_rows: 1,
          }),
      );
    },
  });
}
