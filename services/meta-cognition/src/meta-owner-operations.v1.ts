import {
  FeedbackRequestV1Schema,
  MetaCognitionDomainEventV1Schema,
  MetaCommandClaimRequestV1Schema,
  MetaCommandSettlementRequestV1Schema,
  MetaCommandSettlementResponseV1Schema,
  MetaDurableCommandV1Schema,
  MemoryWriteBatchResponseV1Schema,
  assertKnowThatWriteBatchRequestV1,
  assertKnowThatWriteBatchResponseV1,
  assertMemoryWriteBatchRequestSemanticBindingsV1,
  assertMemoryWriteBatchResponseSemanticBindingsV1,
  assertMetaCompensationCommandPayloadSemanticBindingsV1,
  MetaFeedbackAnswerRequestV1Schema,
  MetaFeedbackAnswerResponseV1Schema,
  MetaFeedbackRequestListResponseV1Schema,
  MetaResultPayloadV1Schema,
  MetaResultAuditItemV1Schema,
  MetaSkillCandidateV1Schema,
  MetaSkillCandidateReviewRequestV1Schema,
  MetaSkillCandidateReviewResponseV1Schema,
  MetaSnapshotRepairRequestV1Schema,
  MetaSnapshotRepairResponseV1Schema,
  SkillCandidateApplicationRequestV1Schema,
  SkillCandidateApplicationResponseV1Schema,
  assertFeedbackRequestSemanticBindingsV1,
  assertMetaCognitionDomainEventSemanticBindingsV1,
  assertMetaCommandClaimSemanticBindingsV1,
  assertMetaCommandSettlementSemanticBindingsV1,
  assertMetaDurableCommandSemanticBindingsV1,
  assertMetaFeedbackAnswerPathBindingV1,
  assertMetaFeedbackRequestListResponseSemanticBindingsV1,
  assertMetaResultPayloadSemanticBindingsV1,
  assertMetaSkillCandidateReviewSemanticBindingsV1,
  assertMetaSnapshotRepairRequestSemanticBindingsV1,
  assertPartialFailureSemanticBindingsV1,
  assertSkillCandidateApplicationSemanticBindingsV1,
  type FeedbackRequestV1,
  type MetaFeedbackAnswerRequestV1,
  type MetaFeedbackAnswerResponseV1,
  type MetaFeedbackRequestListResponseV1,
  type MetaCognitionDomainEventV1,
  type MetaCommandClaimRequestV1,
  type MetaCommandSettlementRequestV1,
  type MetaCommandSettlementResponseV1,
  type MetaDurableCommandV1,
  type KnowThatWriteBatchRequestV1,
  type KnowThatWriteBatchResponseV1,
  type MemoryWriteBatchRequestV1,
  type MemoryWriteBatchResponseV1,
  type MetaResultPayloadV1,
  type MetaSkillCandidateV1,
  type MetaSkillCandidateReviewRequestV1,
  type MetaSkillCandidateReviewResponseV1,
  type MetaSnapshotRepairRequestV1,
  type MetaSnapshotRepairResponseV1,
  type PartialFailureV1,
  type SkillCandidateApplicationRequestV1,
  type SkillCandidateApplicationResponseV1,
} from "@pai/contracts";
import type { Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import {
  assertBoundedMetaJsonV1,
  sha256CanonicalV1,
  snapshotCanonicalJsonV1,
} from "./canonical.v1.js";
import type {
  MetaBotScopeV1,
  MetaCompensationCommandV1,
  MetaJobRecordV1,
  MetaResultV1,
} from "./meta-types.v1.js";
import type {
  MetaKnowThatCandidatePortV1,
  MetaMemoryWritePortV1,
} from "./ports.v1.js";

export interface MetaOperationsPrincipalV1 {
  readonly caller:
    | "trigger_processor"
    | "meta_cognition"
    | "observation_gateway";
  readonly capabilities: readonly string[];
  readonly principal_id: string;
  readonly scope: MetaBotScopeV1;
}

type NewMetaDurableCommandV1 =
  | Omit<
      Extract<
        MetaDurableCommandV1,
        { kind: "skill_candidate_application" }
      >,
      | "status"
      | "attempt_count"
      | "lease_generation"
      | "claimed_by"
      | "lease_expires_at"
      | "next_retry_at"
      | "settlement_id"
      | "settlement_hash"
      | "result_ref"
      | "last_error"
      | "updated_at"
    >
  | Omit<
      Extract<MetaDurableCommandV1, { kind: "compensation" }>,
      | "status"
      | "attempt_count"
      | "lease_generation"
      | "claimed_by"
      | "lease_expires_at"
      | "next_retry_at"
      | "settlement_id"
      | "settlement_hash"
      | "result_ref"
      | "last_error"
      | "updated_at"
    >;

interface StoredCandidateV1 {
  readonly candidate: MetaSkillCandidateV1;
  readonly evidence_artifacts: readonly Readonly<{
    ref: string;
    hash: `sha256:${string}`;
  }>[];
  readonly meta_job_id: string;
  readonly updated_at: string;
}

interface StoredReviewV1 {
  readonly request_hash: `sha256:${string}`;
  readonly response: MetaSkillCandidateReviewResponseV1;
}

interface StoredRepairV1 {
  readonly request_hash: `sha256:${string}`;
  readonly response: MetaSnapshotRepairResponseV1;
}

interface StoredFeedbackAnswerV1 {
  readonly request_hash: `sha256:${string}`;
  readonly response: MetaFeedbackAnswerResponseV1;
}

type MetaResultAuditItemV1 = Static<typeof MetaResultAuditItemV1Schema>;

interface StoredResultV1 {
  readonly job: MetaJobRecordV1;
  readonly result: MetaResultV1;
  readonly audits: readonly MetaResultAuditItemV1[];
}

export interface MetaOwnerOperationsInspectionV1 {
  readonly jobs: readonly MetaJobRecordV1[];
  readonly feedback_requests: readonly FeedbackRequestV1[];
  readonly candidates: readonly MetaSkillCandidateV1[];
  readonly commands: readonly MetaDurableCommandV1[];
  readonly results: readonly MetaResultV1[];
  readonly result_audits: readonly Readonly<{
    meta_result_id: string;
    audit: MetaResultAuditItemV1;
  }>[];
  readonly outbox: readonly MetaCognitionDomainEventV1[];
}

export type MetaVerifiedCommandSuccessV1 =
  | Readonly<{
      outcome: "succeeded";
      result_ref: string;
      error_code: null;
      next_retry_at: null;
      target_service: "memory";
      owner_request: MemoryWriteBatchRequestV1;
      owner_request_hash: `sha256:${string}`;
      source_owner_request_hash: `sha256:${string}`;
      owner_response: MemoryWriteBatchResponseV1;
      owner_response_hash: `sha256:${string}`;
    }>
  | Readonly<{
      outcome: "succeeded";
      result_ref: string;
      error_code: null;
      next_retry_at: null;
      target_service: "knowthat";
      owner_request: KnowThatWriteBatchRequestV1;
      owner_request_hash: `sha256:${string}`;
      source_owner_request_hash: `sha256:${string}`;
      owner_response: KnowThatWriteBatchResponseV1;
      owner_response_hash: `sha256:${string}`;
    }>
  | Readonly<{
      outcome: "succeeded";
      result_ref: string;
      error_code: null;
      next_retry_at: null;
      target_service: "skill_registry";
      owner_request: SkillCandidateApplicationRequestV1;
      owner_request_hash: `sha256:${string}`;
      source_owner_request_hash: `sha256:${string}`;
      owner_response: SkillCandidateApplicationResponseV1;
      owner_response_hash: `sha256:${string}`;
    }>;

export type MetaCommandDispatchFailureV1 = Readonly<{
  outcome: "retry_wait" | "failed";
  result_ref: null;
  error_code: string;
  next_retry_at: string | null;
}>;

export interface MetaCommandDispatcherV1 {
  dispatch(
    command: MetaDurableCommandV1,
    signal?: AbortSignal,
  ): Promise<MetaVerifiedCommandSuccessV1 | MetaCommandDispatchFailureV1>;
}

type MetaCommandDispatchOutcomeV1 = Awaited<
  ReturnType<MetaCommandDispatcherV1["dispatch"]>
>;

type MetaInternalCommandSettlementRequestV1 = Readonly<{
  worker_id: string;
  lease_generation: number;
  settlement_id: string;
  outcome: "succeeded" | "retry_wait" | "failed";
  result_ref: string | null;
  error_code: string | null;
  next_retry_at: string | null;
  trace_id: string;
}>;

export interface MetaOwnerOperationsApplicationV1 {
  answerFeedback(
    principal: MetaOperationsPrincipalV1,
    pathFeedbackRequestId: string,
    value: unknown,
  ): Promise<MetaFeedbackAnswerResponseV1>;
  listFeedback(
    principal: MetaOperationsPrincipalV1,
    query: Readonly<{
      status?: string;
      assignee?: string;
      cursor?: string;
      limit?: number;
      trace_id?: string;
    }>,
  ): Promise<MetaFeedbackRequestListResponseV1>;
  repairSnapshot(
    principal: MetaOperationsPrincipalV1,
    pathMetaJobId: string,
    value: unknown,
  ): Promise<MetaSnapshotRepairResponseV1>;
  reviewSkillCandidate(
    principal: MetaOperationsPrincipalV1,
    pathCandidateId: string,
    value: unknown,
  ): Promise<MetaSkillCandidateReviewResponseV1>;
  claimCommands(
    principal: MetaOperationsPrincipalV1,
    value: unknown,
  ): Promise<readonly MetaDurableCommandV1[]>;
  settleCommand(
    principal: MetaOperationsPrincipalV1,
    pathCommandId: string,
    value: unknown,
  ): Promise<MetaCommandSettlementResponseV1>;
  checkReadiness(signal?: AbortSignal): Promise<void>;
}

export class MetaOwnerOperationsErrorV1 extends Error {
  public constructor(
    public readonly code:
      | "invalid_request"
      | "authorization_scope_mismatch"
      | "not_found"
      | "idempotency_conflict"
      | "stale_fence"
      | "dependency_unavailable",
    message: string = code,
    public readonly retryable =
      code === "dependency_unavailable",
  ) {
    super(message);
    this.name = "MetaOwnerOperationsErrorV1";
  }
}

function error(
  code: MetaOwnerOperationsErrorV1["code"],
  message?: string,
): never {
  throw new MetaOwnerOperationsErrorV1(code, message);
}

function assertCanonicalOwnerInputV1(
  value: unknown,
  message: string,
): void {
  try {
    assertBoundedMetaJsonV1(value);
  } catch {
    error("invalid_request", message);
  }
}

function snapshotCanonicalOwnerInputV1<T>(
  value: T,
  message: string,
): T {
  assertCanonicalOwnerInputV1(value, message);
  try {
    return snapshotCanonicalJsonV1(value);
  } catch {
    error("invalid_request", message);
  }
}

function assertCanonicalOwnerSeedV1(
  value: unknown,
  message: string,
): void {
  try {
    assertBoundedMetaJsonV1(value);
  } catch (cause) {
    throw new Error(message, { cause });
  }
}

function sameScope(left: MetaBotScopeV1, right: MetaBotScopeV1) {
  return (
    left.workspace_id === right.workspace_id &&
    left.bot_id === right.bot_id &&
    left.owner_agent_id === right.owner_agent_id &&
    left.deployment_environment === right.deployment_environment &&
    left.release_channel === right.release_channel
  );
}

function requirePrincipal(
  principal: MetaOperationsPrincipalV1,
  caller: MetaOperationsPrincipalV1["caller"],
  capability: string,
  scope: MetaBotScopeV1,
) {
  if (
    principal.caller !== caller ||
    !principal.capabilities.includes(capability) ||
    !sameScope(principal.scope, scope)
  ) {
    error(
      "authorization_scope_mismatch",
      "Meta owner operation is outside authenticated authority",
    );
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function snapshotOwnerDateV1(value: Date, label: string): Date {
  let milliseconds: number;
  try {
    milliseconds = Date.prototype.getTime.call(value);
  } catch (cause) {
    throw new Error(`${label} is not an intrinsic Date`, { cause });
  }
  if (!Number.isFinite(milliseconds)) {
    throw new Error(`${label} is not a finite instant`);
  }
  return new Date(milliseconds);
}

function freezeRecursively(value: unknown): void {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return;
  }
  for (const key of Reflect.ownKeys(value)) {
    freezeRecursively(
      (value as Readonly<Record<PropertyKey, unknown>>)[key],
    );
  }
  Object.freeze(value);
}

function immutable<T>(value: T): T {
  const snapshot = clone(value);
  freezeRecursively(snapshot);
  return snapshot;
}

function requestHashWithoutTrace(
  value: Readonly<Record<string, unknown>>,
): `sha256:${string}` {
  const { trace_id: _traceId, ...semanticRequest } = value;
  return sha256CanonicalV1(semanticRequest);
}

function replay<T extends { readonly duplicate_replayed: boolean }>(
  value: T,
): T {
  return immutable({ ...value, duplicate_replayed: true });
}

function assertSafeNext(value: number, label: string): number {
  if (
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value >= Number.MAX_SAFE_INTEGER
  ) {
    error("stale_fence", `${label} exhausted`);
  }
  return value + 1;
}

function feedbackCursorFingerprint(
  principal: MetaOperationsPrincipalV1,
  assignee: string,
) {
  return sha256CanonicalV1({
    schema_version: "meta_feedback_cursor.v1",
    ...principal.scope,
    assignee,
    status: "open",
  }).slice(7, 23);
}

function durableEvent(
  job: MetaJobRecordV1,
  eventType: MetaCognitionDomainEventV1["event_type"],
  payload: Readonly<Record<string, unknown>>,
  occurredAt: string,
  suffix: string,
): MetaCognitionDomainEventV1 {
  const event = {
    event_id: `meta_event:${job.id}:${eventType}:${suffix}`,
    event_type: eventType,
    schema_version: "meta_cognition_event.v1",
    producer: "meta_cognition",
    occurred_at: occurredAt,
    idempotency_key: `${job.id}:${eventType}:${suffix}`,
    trace_id: job.trace_id,
    payload: {
      workspace_id: job.workspace_id,
      bot_id: job.bot_id,
      owner_agent_id: job.owner_agent_id,
      deployment_environment: job.deployment_environment,
      release_channel: job.release_channel,
      meta_job_id: job.id,
      trigger_process_id: job.trigger_process_id,
      ...payload,
    },
  };
  assertBoundedMetaJsonV1(event);
  if (!Value.Check(MetaCognitionDomainEventV1Schema, event)) {
    throw new Error(`Meta durable event ${eventType} contract drift`);
  }
  assertMetaCognitionDomainEventSemanticBindingsV1(
    event as MetaCognitionDomainEventV1,
  );
  return Object.freeze(
    clone(event as MetaCognitionDomainEventV1),
  );
}

const REPAIRABLE_REASONS = new Set([
  "snapshot_missing",
  "snapshot_incomplete",
  "snapshot_schema_incompatible",
  "snapshot_hash_mismatch",
  "artifact_unreadable",
  "redaction_incomplete",
]);

type MetaOwnerItemResolutionV1 =
  | Readonly<{
      outcome: "succeeded";
      result_ref: string;
      owner_request:
        | MemoryWriteBatchRequestV1
        | KnowThatWriteBatchRequestV1;
      owner_response:
        | MemoryWriteBatchResponseV1
        | KnowThatWriteBatchResponseV1;
    }>
  | Readonly<{ outcome: "rejected"; retryable: boolean }>
  | Readonly<{ outcome: "invalid" }>;

function exactOwnerItemSetV1(
  expected: readonly string[],
  actual: readonly string[],
): boolean {
  const sortedExpected = [...expected].sort();
  const sortedActual = [...actual].sort();
  return (
    sortedExpected.length === sortedActual.length &&
    sortedExpected.every(
      (itemId, index) => itemId === sortedActual[index],
    )
  );
}

function validateMemoryOwnerResultV1(
  request: MemoryWriteBatchRequestV1,
  response: MemoryWriteBatchResponseV1,
  failedItemId: string,
): MetaOwnerItemResolutionV1 {
  let responseSnapshot: MemoryWriteBatchResponseV1;
  try {
    responseSnapshot = snapshotCanonicalJsonV1(response);
    assertBoundedMetaJsonV1(responseSnapshot);
    if (!Value.Check(MemoryWriteBatchResponseV1Schema, responseSnapshot)) {
      return { outcome: "invalid" };
    }
    assertMemoryWriteBatchResponseSemanticBindingsV1(responseSnapshot);
  } catch {
    return { outcome: "invalid" };
  }
  if (
    !exactOwnerItemSetV1(
      request.items.map(({ client_item_id }) => client_item_id),
      responseSnapshot.item_results.map(
        ({ client_item_id }) => client_item_id,
      ),
    )
  ) {
    return { outcome: "invalid" };
  }
  const result = responseSnapshot.item_results.find(
    ({ client_item_id }) => client_item_id === failedItemId,
  );
  if (result === undefined) return { outcome: "invalid" };
  if (result.status === "rejected") {
    return {
      outcome: "rejected",
      retryable: result.code !== "schema_validation_failed",
    };
  }
  return {
    outcome: "succeeded",
    result_ref:
      result.memory_point_id === undefined
        ? `memory_series:${result.series_id}`
        : `memory_point:${result.memory_point_id}`,
    owner_request: snapshotCanonicalJsonV1(request),
    owner_response: responseSnapshot,
  };
}

function validateKnowThatOwnerResultV1(
  request: KnowThatWriteBatchRequestV1,
  response: KnowThatWriteBatchResponseV1,
  failedItemId: string,
): MetaOwnerItemResolutionV1 {
  let responseSnapshot: KnowThatWriteBatchResponseV1;
  try {
    responseSnapshot = snapshotCanonicalJsonV1(response);
    assertBoundedMetaJsonV1(responseSnapshot);
    assertKnowThatWriteBatchResponseV1(responseSnapshot);
  } catch {
    return { outcome: "invalid" };
  }
  if (
    !exactOwnerItemSetV1(
      request.items.map(({ client_item_id }) => client_item_id),
      responseSnapshot.item_results.map(
        ({ client_item_id }) => client_item_id,
      ),
    )
  ) {
    return { outcome: "invalid" };
  }
  const result = responseSnapshot.item_results.find(
    ({ client_item_id }) => client_item_id === failedItemId,
  );
  if (result === undefined) return { outcome: "invalid" };
  if (result.status === "rejected") {
    return {
      outcome: "rejected",
      retryable: result.code !== "schema_validation_failed",
    };
  }
  return {
    outcome: "succeeded",
    result_ref: `knowthat_fact:${result.fact_id}`,
    owner_request: snapshotCanonicalJsonV1(request),
    owner_response: responseSnapshot,
  };
}

function compensationSingleRetryIdempotencyKeyV1(
  command: Extract<MetaDurableCommandV1, { kind: "compensation" }>,
): string {
  return `meta_retry_${sha256CanonicalV1({
    command_id: command.command_id,
    item_id: command.payload.item_id,
    source_owner_request_hash:
      command.payload.failed_item.source_owner_request_hash,
  }).slice("sha256:".length, "sha256:".length + 32)}`;
}

function assertVerifiedOwnerSuccessV1(
  command: MetaDurableCommandV1,
  success: MetaVerifiedCommandSuccessV1,
): void {
  if (
    success.target_service !== command.target_service ||
    success.owner_request_hash !==
      sha256CanonicalV1(success.owner_request) ||
    success.owner_response_hash !==
      sha256CanonicalV1(success.owner_response)
  ) {
    throw new Error("verified owner settlement hash or target drift");
  }
  if (command.kind === "skill_candidate_application") {
    if (
      success.target_service !== "skill_registry" ||
      success.source_owner_request_hash !== command.payload_hash ||
      success.owner_request_hash !== command.payload_hash ||
      sha256CanonicalV1(success.owner_request) !== command.payload_hash ||
      !Value.Check(
        SkillCandidateApplicationResponseV1Schema,
        success.owner_response,
      )
    ) {
      throw new Error("verified Skill owner settlement binding drift");
    }
    assertSkillCandidateApplicationSemanticBindingsV1(
      command.payload,
      success.owner_response,
      command.payload.reviewer_principal_id,
    );
    if (
      success.owner_response.details.status === "rejected" ||
      success.owner_response.details.status === "failed" ||
      success.result_ref !==
        success.owner_response.details.response_ref
    ) {
      throw new Error("verified Skill owner settlement is not successful");
    }
    return;
  }
  if (
    success.target_service === "skill_registry" ||
    success.source_owner_request_hash !==
      command.payload.failed_item.source_owner_request_hash
  ) {
    throw new Error("verified compensation source binding drift");
  }
  assertMetaCompensationCommandPayloadSemanticBindingsV1(
    command.payload,
  );
  const sourceItem = command.payload.owner_request.items.find(
    ({ client_item_id }) =>
      client_item_id === command.payload.failed_item.client_item_id,
  );
  if (sourceItem === undefined) {
    throw new Error("verified compensation lost its source item");
  }
  const actualRequestHash = sha256CanonicalV1(success.owner_request);
  const isOriginalRequest =
    actualRequestHash === command.payload.owner_request_hash;
  const expectedSingleRetry = {
    ...command.payload.owner_request,
    idempotency_key:
      compensationSingleRetryIdempotencyKeyV1(command),
    items: [sourceItem],
  };
  const isBoundSingleRetry =
    command.payload.dispatch_mode === "original_request_replay" &&
    actualRequestHash === sha256CanonicalV1(expectedSingleRetry);
  if (!isOriginalRequest && !isBoundSingleRetry) {
    throw new Error("verified compensation request binding drift");
  }
  if (command.target_service === "memory") {
    if (
      success.target_service !== "memory" ||
      success.owner_request.schema_version !== "memory.write_batch.v1"
    ) {
      throw new Error("verified Memory target binding drift");
    }
    assertMemoryWriteBatchRequestSemanticBindingsV1(
      success.owner_request,
    );
    const resolution = validateMemoryOwnerResultV1(
      success.owner_request,
      success.owner_response,
      command.payload.item_id,
    );
    if (
      resolution.outcome !== "succeeded" ||
      resolution.result_ref !== success.result_ref
    ) {
      throw new Error("verified Memory owner response binding drift");
    }
    return;
  }
  if (
    success.target_service !== "knowthat" ||
    success.owner_request.schema_version !== "knowthat.write_batch.v1"
  ) {
    throw new Error("verified KnowThat target binding drift");
  }
  assertKnowThatWriteBatchRequestV1(success.owner_request);
  const resolution = validateKnowThatOwnerResultV1(
    success.owner_request,
    success.owner_response,
    command.payload.item_id,
  );
  if (
    resolution.outcome !== "succeeded" ||
    resolution.result_ref !== success.result_ref
  ) {
    throw new Error("verified KnowThat owner response binding drift");
  }
}

/**
 * The only dispatcher allowed to settle compensation commands. It owns the
 * Memory/KnowThat schema, semantic, item-set and response-reference checks;
 * callers cannot turn an opaque transport success into a Meta success.
 */
export class MetaOwnerCommandDispatcherV1
  implements MetaCommandDispatcherV1
{
  public constructor(
    private readonly dependencies: Readonly<{
      memory: MetaMemoryWritePortV1;
      knowthat: MetaKnowThatCandidatePortV1;
      skill_dispatcher?: MetaCommandDispatcherV1;
      now?: () => Date;
      retry_delay_ms?: number;
    }>,
  ) {}

  public async checkReadiness(signal?: AbortSignal): Promise<void> {
    const readinessSignal =
      signal ?? new AbortController().signal;
    if (
      this.dependencies.memory.checkReadiness === undefined ||
      this.dependencies.knowthat.checkReadiness === undefined
    ) {
      throw new Error(
        "Meta compensation owner readiness probes are required",
      );
    }
    await this.dependencies.memory.checkReadiness(readinessSignal);
    await this.dependencies.knowthat.checkReadiness(readinessSignal);
  }

  #now(): Date {
    return snapshotOwnerDateV1(
      this.dependencies.now?.() ?? new Date(),
      "Meta command dispatcher clock",
    );
  }

  #retry(errorCode: string): MetaCommandDispatchOutcomeV1 {
    return Object.freeze({
      outcome: "retry_wait",
      result_ref: null,
      error_code: errorCode,
      next_retry_at: new Date(
        this.#now().getTime() +
          (this.dependencies.retry_delay_ms ?? 1_000),
      ).toISOString(),
    });
  }

  #failed(errorCode: string): MetaCommandDispatchOutcomeV1 {
    return Object.freeze({
      outcome: "failed",
      result_ref: null,
      error_code: errorCode,
      next_retry_at: null,
    });
  }

  #succeeded(
    command: Extract<MetaDurableCommandV1, { kind: "compensation" }>,
    result: Extract<MetaOwnerItemResolutionV1, { outcome: "succeeded" }>,
  ): MetaVerifiedCommandSuccessV1 {
    const ownerRequest = result.owner_request;
    const ownerResponse = result.owner_response;
    const success = {
      outcome: "succeeded",
      result_ref: result.result_ref,
      error_code: null,
      next_retry_at: null,
      target_service: command.target_service,
      owner_request: ownerRequest,
      owner_request_hash: sha256CanonicalV1(ownerRequest),
      source_owner_request_hash:
        command.payload.failed_item.source_owner_request_hash,
      owner_response: ownerResponse,
      owner_response_hash: sha256CanonicalV1(ownerResponse),
    };
    return immutable(success) as MetaVerifiedCommandSuccessV1;
  }

  #singleRetryIdempotencyKey(
    command: Extract<MetaDurableCommandV1, { kind: "compensation" }>,
  ): string {
    return compensationSingleRetryIdempotencyKeyV1(command);
  }

  async #dispatchMemory(
    command: Extract<MetaDurableCommandV1, { kind: "compensation" }>,
    request: MemoryWriteBatchRequestV1,
    signal?: AbortSignal,
  ): Promise<
    MetaOwnerItemResolutionV1 | Readonly<{ outcome: "unknown" }>
  > {
    try {
      const response = await this.dependencies.memory.writeBatch(
        request,
        signal ?? new AbortController().signal,
      );
      return validateMemoryOwnerResultV1(
        request,
        response,
        command.payload.item_id,
      );
    } catch {
      return { outcome: "unknown" };
    }
  }

  async #dispatchKnowThat(
    command: Extract<MetaDurableCommandV1, { kind: "compensation" }>,
    request: KnowThatWriteBatchRequestV1,
    signal?: AbortSignal,
  ): Promise<
    MetaOwnerItemResolutionV1 | Readonly<{ outcome: "unknown" }>
  > {
    try {
      const response = await this.dependencies.knowthat.writeBatch(
        request,
        signal ?? new AbortController().signal,
      );
      return validateKnowThatOwnerResultV1(
        request,
        response,
        command.payload.item_id,
      );
    } catch {
      return { outcome: "unknown" };
    }
  }

  async #dispatchCompensation(
    command: Extract<MetaDurableCommandV1, { kind: "compensation" }>,
    signal?: AbortSignal,
  ): Promise<MetaCommandDispatchOutcomeV1> {
    try {
      assertBoundedMetaJsonV1(command);
      if (!Value.Check(MetaDurableCommandV1Schema, command)) {
        return this.#failed("compensation_contract_invalid");
      }
      assertMetaDurableCommandSemanticBindingsV1(command);
      assertMetaCompensationCommandPayloadSemanticBindingsV1(
        command.payload,
      );
    } catch {
      return this.#failed("compensation_contract_invalid");
    }
    const payload = command.payload;
    const first =
      payload.target_service === "memory"
        ? await this.#dispatchMemory(
            command,
            payload.owner_request,
            signal,
          )
        : await this.#dispatchKnowThat(
            command,
            payload.owner_request,
            signal,
          );
    if (first.outcome === "unknown") {
      return this.#retry("owner_commit_unknown");
    }
    if (first.outcome === "invalid") {
      return this.#retry("owner_response_invalid");
    }
    if (first.outcome === "succeeded") {
      return this.#succeeded(command, first);
    }
    if (
      payload.dispatch_mode === "single_item_retry" ||
      !first.retryable
    ) {
      return this.#failed("owner_item_rejected");
    }

    if (payload.target_service === "memory") {
      const sourceItem = payload.owner_request.items.find(
        ({ client_item_id }) => client_item_id === payload.item_id,
      );
      if (sourceItem === undefined) {
        return this.#failed("compensation_contract_invalid");
      }
      const retryRequest: MemoryWriteBatchRequestV1 = {
        ...payload.owner_request,
        idempotency_key:
          this.#singleRetryIdempotencyKey(command),
        items: [sourceItem],
      };
      try {
        assertMemoryWriteBatchRequestSemanticBindingsV1(
          retryRequest,
        );
      } catch {
        return this.#failed("compensation_contract_invalid");
      }
      const retry = await this.#dispatchMemory(
        command,
        retryRequest,
        signal,
      );
      if (retry.outcome === "unknown") {
        return this.#retry("owner_commit_unknown");
      }
      if (retry.outcome === "invalid") {
        return this.#retry("owner_response_invalid");
      }
      return retry.outcome === "succeeded"
        ? this.#succeeded(command, retry)
        : this.#failed("owner_item_rejected");
    }
    const sourceItem = payload.owner_request.items.find(
      ({ client_item_id }) => client_item_id === payload.item_id,
    );
    if (sourceItem === undefined) {
      return this.#failed("compensation_contract_invalid");
    }
    const retryRequest: KnowThatWriteBatchRequestV1 = {
      ...payload.owner_request,
      idempotency_key: this.#singleRetryIdempotencyKey(command),
      items: [sourceItem],
    };
    try {
      assertKnowThatWriteBatchRequestV1(retryRequest);
    } catch {
      return this.#failed("compensation_contract_invalid");
    }
    const retry = await this.#dispatchKnowThat(
      command,
      retryRequest,
      signal,
    );
    if (retry.outcome === "unknown") {
      return this.#retry("owner_commit_unknown");
    }
    if (retry.outcome === "invalid") {
      return this.#retry("owner_response_invalid");
    }
    return retry.outcome === "succeeded"
      ? this.#succeeded(command, retry)
      : this.#failed("owner_item_rejected");
  }

  public async dispatch(
    command: MetaDurableCommandV1,
    signal?: AbortSignal,
  ): Promise<MetaCommandDispatchOutcomeV1> {
    let commandSnapshot: MetaDurableCommandV1;
    try {
      commandSnapshot = snapshotCanonicalJsonV1(command);
    } catch {
      return this.#failed("compensation_contract_invalid");
    }
    if (commandSnapshot.kind === "compensation") {
      return this.#dispatchCompensation(commandSnapshot, signal);
    }
    const skillDispatcher = this.dependencies.skill_dispatcher;
    if (skillDispatcher === undefined) {
      return this.#retry("dispatcher_unavailable");
    }
    try {
      const outcome = snapshotCanonicalJsonV1(
        await skillDispatcher.dispatch(commandSnapshot, signal),
      );
      assertCanonicalOwnerSeedV1(
        outcome,
        "Skill command dispatcher returned a non-canonical result",
      );
      if (outcome.outcome === "succeeded") {
        assertVerifiedOwnerSuccessV1(commandSnapshot, outcome);
      }
      return outcome;
    } catch {
      return this.#retry("dispatcher_unavailable");
    }
  }
}

export class InMemoryMetaOwnerOperationsV1
  implements MetaOwnerOperationsApplicationV1
{
  public readonly persistence_kind = "memory" as const;
  readonly #feedback = new Map<string, FeedbackRequestV1>();
  readonly #feedbackAnswers = new Map<string, StoredFeedbackAnswerV1>();
  readonly #jobs = new Map<string, MetaJobRecordV1>();
  readonly #jobInputRevision = new Map<string, number>();
  readonly #repairs = new Map<string, StoredRepairV1>();
  readonly #candidates = new Map<string, StoredCandidateV1>();
  readonly #reviews = new Map<string, StoredReviewV1>();
  readonly #reviewIdempotency = new Map<string, string>();
  readonly #commands = new Map<string, MetaDurableCommandV1>();
  readonly #commandIdempotency = new Map<string, string>();
  readonly #commandSettlements = new Map<
    string,
    Readonly<{
      request_hash: `sha256:${string}`;
      response: MetaCommandSettlementResponseV1;
    }>
  >();
  readonly #results = new Map<string, StoredResultV1>();
  readonly #outbox: MetaCognitionDomainEventV1[] = [];
  #tail: Promise<void> = Promise.resolve();

  public constructor(
    private readonly options: Readonly<{
      now?: () => Date;
      max_command_attempts?: number;
      deployment_mode?: "test" | "development" | "production";
    }> = {},
  ) {}

  #now() {
    return snapshotOwnerDateV1(
      this.options.now?.() ?? new Date(),
      "Meta owner operations clock",
    );
  }

  async #locked<T>(operation: () => T | Promise<T>): Promise<T> {
    let release!: () => void;
    const prior = this.#tail;
    this.#tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await prior;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  public async checkReadiness(): Promise<void> {
    if (this.options.deployment_mode === "production") {
      throw new Error(
        "Meta owner operations production requires the version-pinned PostgreSQL adapter",
      );
    }
  }

  public seedFeedbackRequest(request: FeedbackRequestV1): void {
    assertCanonicalOwnerSeedV1(request, "invalid feedback seed");
    if (!Value.Check(FeedbackRequestV1Schema, request)) {
      throw new Error("invalid feedback seed");
    }
    assertFeedbackRequestSemanticBindingsV1(request);
    const existing = this.#feedback.get(request.feedback_request_id);
    if (existing !== undefined) {
      const existingUpdatedAt = Date.parse(existing.updated_at);
      const nextUpdatedAt = Date.parse(request.updated_at);
      if (existingUpdatedAt > nextUpdatedAt) return;
      if (
        existingUpdatedAt === nextUpdatedAt &&
        sha256CanonicalV1(existing) !== sha256CanonicalV1(request)
      ) {
        throw new Error("feedback seed identity drift");
      }
      if (existingUpdatedAt === nextUpdatedAt) return;
    }
    this.#feedback.set(request.feedback_request_id, clone(request));
  }

  public seedJob(job: MetaJobRecordV1, inputRevision = 1): void {
    assertCanonicalOwnerSeedV1(job, "invalid Meta job seed");
    const createdAt = Date.parse(job.created_at);
    const updatedAt = Date.parse(job.updated_at);
    if (
      !Number.isSafeInteger(inputRevision) ||
      inputRevision < 1 ||
      !Number.isFinite(createdAt) ||
      !Number.isFinite(updatedAt) ||
      createdAt > updatedAt
    ) {
      throw new Error("invalid Meta job seed");
    }
    const existing = this.#jobs.get(job.id);
    if (existing !== undefined) {
      const existingUpdatedAt = Date.parse(existing.updated_at);
      const nextUpdatedAt = Date.parse(job.updated_at);
      if (existingUpdatedAt > nextUpdatedAt) return;
      if (
        existingUpdatedAt === nextUpdatedAt &&
        sha256CanonicalV1(existing) !== sha256CanonicalV1(job)
      ) {
        throw new Error("Meta job seed identity drift");
      }
      if (existingUpdatedAt === nextUpdatedAt) return;
    }
    this.#jobs.set(job.id, clone(job));
    this.#jobInputRevision.set(job.id, inputRevision);
  }

  public seedSkillCandidate(
    candidate: MetaSkillCandidateV1,
    metaJobId: string,
    updatedAt: string,
    evidenceArtifacts: readonly Readonly<{
      ref: string;
      hash: `sha256:${string}`;
    }>[],
  ): void {
    assertCanonicalOwnerSeedV1(
      { candidate, evidence_artifacts: evidenceArtifacts },
      "candidate evidence artifact binding drift",
    );
    const job = this.#jobs.get(metaJobId);
    const artifactKeys = evidenceArtifacts.map(
      ({ ref, hash }) => `${ref}\u0000${hash}`,
    );
    if (
      !Value.Check(MetaSkillCandidateV1Schema, candidate) ||
      job === undefined ||
      !sameScope(job, candidate) ||
      !Number.isFinite(Date.parse(updatedAt)) ||
      candidate.evidence_refs.length !== evidenceArtifacts.length ||
      new Set(artifactKeys).size !== artifactKeys.length ||
      candidate.evidence_refs.some(
        (ref, index) => evidenceArtifacts[index]?.ref !== ref,
      )
    ) {
      throw new Error("candidate evidence artifact binding drift");
    }
    const next = {
      candidate: clone(candidate),
      evidence_artifacts: clone(evidenceArtifacts),
      meta_job_id: metaJobId,
      updated_at: updatedAt,
    };
    const existing = this.#candidates.get(candidate.candidate_id);
    if (existing !== undefined) {
      const existingUpdatedAt = Date.parse(existing.updated_at);
      const nextUpdatedAt = Date.parse(updatedAt);
      if (existingUpdatedAt > nextUpdatedAt) return;
      if (
        existingUpdatedAt === nextUpdatedAt &&
        sha256CanonicalV1(existing) !== sha256CanonicalV1(next)
      ) {
        throw new Error("candidate seed identity drift");
      }
      if (existingUpdatedAt === nextUpdatedAt) return;
    }
    this.#candidates.set(candidate.candidate_id, next);
  }

  public seedCompensationCommand(
    command: MetaCompensationCommandV1,
  ): void {
    assertCanonicalOwnerSeedV1(
      command,
      "invalid compensation command seed",
    );
    const job = this.#jobs.get(command.meta_job_id);
    if (
      job === undefined ||
      !sameScope(job, command) ||
      command.request_payload_hash !==
        sha256CanonicalV1(command.request_payload) ||
      command.target_service !==
        command.request_payload.target_service ||
      command.request_payload.owner_request.trigger_process_id !==
        job.trigger_process_id ||
      !Number.isSafeInteger(command.lease_generation) ||
      command.lease_generation < 1
    ) {
      throw new Error("invalid compensation command seed");
    }
    assertMetaCompensationCommandPayloadSemanticBindingsV1(
      command.request_payload,
    );
    const existing = this.#commandIdempotency.get(
      command.idempotency_key,
    );
    if (existing !== undefined && existing !== command.command_id) {
      throw new Error("compensation idempotency drift");
    }
    const existingCommand = this.#commands.get(command.command_id);
    if (existingCommand !== undefined) {
      if (
        existingCommand.kind !== "compensation" ||
        existingCommand.source_job_lease_generation !==
          command.lease_generation ||
        existingCommand.meta_job_id !== command.meta_job_id ||
        existingCommand.payload_hash !== command.request_payload_hash ||
        existingCommand.idempotency_key !== command.idempotency_key ||
        !sameScope(existingCommand.scope, command)
      ) {
        throw new Error("compensation command seed identity drift");
      }
      return;
    }
    const at = command.created_at;
    const durableCommand: MetaDurableCommandV1 = {
      command_id: command.command_id,
      kind: "compensation",
      source_job_lease_generation: command.lease_generation,
      meta_job_id: command.meta_job_id,
      scope: {
        workspace_id: command.workspace_id,
        bot_id: command.bot_id,
        owner_agent_id: command.owner_agent_id,
        deployment_environment: command.deployment_environment,
        release_channel: command.release_channel,
      },
      target_service: command.target_service,
      payload: clone(command.request_payload),
      payload_hash: command.request_payload_hash,
      idempotency_key: command.idempotency_key,
      status: "pending",
      attempt_count: 0,
      lease_generation: 0,
      claimed_by: null,
      lease_expires_at: null,
      next_retry_at: null,
      settlement_id: null,
      settlement_hash: null,
      result_ref: null,
      last_error: null,
      trace_id: command.trace_id,
      created_at: at,
      updated_at: at,
    };
    if (!Value.Check(MetaDurableCommandV1Schema, durableCommand)) {
      throw new Error("compensation command seed contract drift");
    }
    assertMetaDurableCommandSemanticBindingsV1(durableCommand);
    this.#commands.set(
      command.command_id,
      immutable(durableCommand),
    );
    this.#commandIdempotency.set(
      command.idempotency_key,
      command.command_id,
    );
  }

  public seedResult(
    job: MetaJobRecordV1,
    result: MetaResultV1,
  ): void {
    assertCanonicalOwnerSeedV1(
      { job, result },
      "invalid Meta result seed",
    );
    const activeBlocking = result.payload.partial_failures.some(
      (failure) =>
        failure.blocking &&
        (failure.status === "pending" ||
          failure.status === "retrying"),
    );
    const terminalBlocking = result.payload.partial_failures.some(
      (failure) =>
        failure.blocking &&
        (failure.status === "failed" ||
          failure.status === "abandoned" ||
          failure.status === "unknown"),
    );
    const expectedJobStatus =
      activeBlocking
        ? "retry_wait"
        : terminalBlocking
          ? "failed"
          : "completed";
    if (
      result.meta_job_id !== job.id ||
      result.trigger_process_id !== job.trigger_process_id ||
      !sameScope(job, result) ||
      !Number.isSafeInteger(result.result_version) ||
      result.result_version < 1 ||
      result.result_status !== result.payload.result_status ||
      (result.result_status === "partial_pending") !==
        (result.finalized_at === null) ||
      job.status !== expectedJobStatus ||
      !Value.Check(MetaResultPayloadV1Schema, result.payload)
    ) {
      throw new Error("invalid Meta result seed");
    }
    assertMetaResultPayloadSemanticBindingsV1(result.payload);
    const existing = this.#results.get(result.id);
    if (existing !== undefined) {
      if (existing.result.result_version > result.result_version) return;
      if (
        existing.result.result_version === result.result_version &&
        sha256CanonicalV1(existing.result) !==
          sha256CanonicalV1(result)
      ) {
        throw new Error("Meta result seed identity drift");
      }
      if (existing.result.result_version === result.result_version) {
        return;
      }
    }
    this.seedJob(
      job,
      this.#jobInputRevision.get(job.id) ?? 1,
    );
    this.#results.set(result.id, {
      job: clone(job),
      result: clone(result),
      audits: [
        {
          audit_id:
            `meta_result_audit:${result.id}:${result.result_version}`,
          result_version: result.result_version,
          previous_result_status: null,
          result_status: result.result_status,
          operation: "created",
          changed_failure_ids: result.payload.partial_failures.map(
            ({ failure_id }) => failure_id,
          ),
          actor_kind: "service",
          actor_ref: "meta_cognition",
          payload_summary: {
            active_compensation_count:
              result.payload.partial_failures.filter(
                ({ status }) =>
                  status === "pending" || status === "retrying",
              ).length,
          },
          created_at: result.finalized_at ?? job.updated_at,
        },
      ],
    });
  }

  public async answerFeedback(
    principal: MetaOperationsPrincipalV1,
    pathFeedbackRequestId: string,
    value: unknown,
  ): Promise<MetaFeedbackAnswerResponseV1> {
    const principalSnapshot = snapshotCanonicalOwnerInputV1(
      principal,
      "feedback principal is outside the canonical JSON boundary",
    );
    const requestValue = snapshotCanonicalOwnerInputV1(
      value,
      "feedback answer is outside the canonical JSON boundary",
    );
    const operationNow = this.#now();
    if (!Value.Check(MetaFeedbackAnswerRequestV1Schema, requestValue)) {
      error("invalid_request", "feedback answer schema mismatch");
    }
    const request = requestValue as MetaFeedbackAnswerRequestV1;
    try {
      assertMetaFeedbackAnswerPathBindingV1(
        pathFeedbackRequestId,
        request,
      );
    } catch {
      error("invalid_request", "feedback answer path/body mismatch");
    }
    return this.#locked(() => {
      const feedback = this.#feedback.get(
        request.feedback_request_id,
      );
      if (feedback === undefined) error("not_found");
      requirePrincipal(
        principalSnapshot,
        "trigger_processor",
        "meta.feedback.answer",
        feedback,
      );
      if (request.bot_id !== feedback.bot_id) {
        error("authorization_scope_mismatch");
      }
      const requestHash = requestHashWithoutTrace(request);
      const prior = this.#feedbackAnswers.get(
        request.feedback_request_id,
      );
      if (prior !== undefined) {
        return prior.request_hash === requestHash
          ? replay(prior.response)
          : {
              feedback_request_id: request.feedback_request_id,
              status: "answered",
              code: "idempotency_conflict",
              answered_by_trigger_id:
                prior.response.answered_by_trigger_id,
              duplicate_replayed: false,
            };
      }
      if (Date.parse(feedback.expires_at) <= operationNow.getTime()) {
        const response: MetaFeedbackAnswerResponseV1 = {
          feedback_request_id: request.feedback_request_id,
          status: "expired",
          code: "feedback_request_closed",
          answered_by_trigger_id: null,
          duplicate_replayed: false,
        };
        this.#feedback.set(request.feedback_request_id, {
          ...feedback,
          status: "expired",
          updated_at: operationNow.toISOString(),
        });
        this.#feedbackAnswers.set(request.feedback_request_id, {
          request_hash: requestHash,
          response: immutable(response),
        });
        return immutable(response);
      }
      if (feedback.status !== "open") {
        return {
          feedback_request_id: request.feedback_request_id,
          status: feedback.status,
          code: "feedback_request_closed",
          answered_by_trigger_id:
            feedback.answered_by_trigger_id,
          duplicate_replayed: false,
        };
      }
      const response: MetaFeedbackAnswerResponseV1 = Object.freeze({
        feedback_request_id: request.feedback_request_id,
        status: "answered",
        answered_by_trigger_id: request.trigger_id,
        duplicate_replayed: false,
      });
      if (!Value.Check(MetaFeedbackAnswerResponseV1Schema, response)) {
        throw new Error("feedback response owner contract drift");
      }
      this.#feedback.set(request.feedback_request_id, {
        ...feedback,
        status: "answered",
        answered_by_trigger_id: request.trigger_id,
        answer_payload: clone(request.answer_payload),
        updated_at: operationNow.toISOString(),
      });
      this.#feedbackAnswers.set(request.feedback_request_id, {
        request_hash: requestHash,
        response,
      });
      return response;
    });
  }

  public async listFeedback(
    principal: MetaOperationsPrincipalV1,
    query: Readonly<{
      status?: string;
      assignee?: string;
      cursor?: string;
      limit?: number;
      trace_id?: string;
    }>,
  ): Promise<MetaFeedbackRequestListResponseV1> {
    const principalSnapshot = snapshotCanonicalOwnerInputV1(
      principal,
      "feedback-list principal is outside the canonical JSON boundary",
    );
    const querySnapshot = snapshotCanonicalOwnerInputV1(
      query,
      "feedback list query is outside the canonical JSON boundary",
    );
    const operationNow = this.#now();
    if (
      querySnapshot.status !== "open" ||
      typeof querySnapshot.assignee !== "string" ||
      querySnapshot.assignee.length === 0
    ) {
      error("invalid_request", "feedback list query is invalid");
    }
    requirePrincipal(
      principalSnapshot,
      "observation_gateway",
      "meta.feedback_requests.read",
      principalSnapshot.scope,
    );
    if (
      principalSnapshot.principal_id !== querySnapshot.assignee &&
      !principalSnapshot.capabilities.includes(
        "meta.feedback_requests.read_all",
      )
    ) {
      error("authorization_scope_mismatch");
    }
    const limit = querySnapshot.limit ?? 50;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200) {
      error("invalid_request", "feedback list limit is invalid");
    }
    const fingerprint = feedbackCursorFingerprint(
      principalSnapshot,
      querySnapshot.assignee,
    );
    let afterId: string | null = null;
    if (querySnapshot.cursor !== undefined) {
      const [prefix, cursorFingerprint, encodedId, extra] =
        querySnapshot.cursor.split(".");
      if (
        prefix !== "mfc1" ||
        cursorFingerprint !== fingerprint ||
        encodedId === undefined ||
        encodedId.length === 0 ||
        extra !== undefined
      ) {
        error("invalid_request", "feedback cursor is invalid");
      }
      try {
        const id = Buffer.from(encodedId, "base64url").toString();
        if (
          id.length < 1 ||
          id.length > 512 ||
          Buffer.from(id).toString("base64url") !== encodedId
        ) {
          throw new Error("non-canonical cursor");
        }
        afterId = id;
      } catch {
        error("invalid_request", "feedback cursor is invalid");
      }
    }
    const all = [...this.#feedback.values()]
      .filter(
        (feedback) =>
          feedback.status === "open" &&
          Date.parse(feedback.expires_at) > operationNow.getTime() &&
          feedback.target_actor_ref === querySnapshot.assignee &&
          sameScope(principalSnapshot.scope, feedback),
      )
      .sort(
        (left, right) =>
          left.created_at.localeCompare(right.created_at) ||
          left.feedback_request_id.localeCompare(
            right.feedback_request_id,
          ),
      );
    const offset =
      afterId === null
        ? 0
        : all.findIndex(
            ({ feedback_request_id }) =>
              feedback_request_id === afterId,
          ) + 1;
    if (afterId !== null && offset === 0) {
      error("invalid_request", "feedback cursor row no longer exists");
    }
    const selected = all.slice(offset, offset + limit);
    const hasMore = offset + selected.length < all.length;
    const last = selected.at(-1);
    const response: MetaFeedbackRequestListResponseV1 = {
      assignee: querySnapshot.assignee,
      items: selected.map((feedback) => ({
        feedback_request_id: feedback.feedback_request_id,
        bot_id: feedback.bot_id,
        dedupe_scope_ref: feedback.dedupe_scope_ref,
        question_key: feedback.question_key,
        question_ref: feedback.question_payload_ref,
        status: "open",
        assignee: feedback.target_actor_ref,
        delivery_mode: feedback.delivery_mode,
        delivery_status: feedback.delivery_status,
        created_at: feedback.created_at,
        expires_at: feedback.expires_at,
      })),
      next_cursor:
        hasMore && last !== undefined
          ? `mfc1.${fingerprint}.${Buffer.from(
              last.feedback_request_id,
            ).toString("base64url")}`
          : null,
      has_more: hasMore,
      trace_id: querySnapshot.trace_id ?? "trace_feedback_list",
    };
    if (!Value.Check(MetaFeedbackRequestListResponseV1Schema, response)) {
      throw new Error("feedback list owner contract drift");
    }
    assertMetaFeedbackRequestListResponseSemanticBindingsV1(response);
    return immutable(response);
  }

  public async repairSnapshot(
    principal: MetaOperationsPrincipalV1,
    pathMetaJobId: string,
    value: unknown,
  ): Promise<MetaSnapshotRepairResponseV1> {
    const principalSnapshot = snapshotCanonicalOwnerInputV1(
      principal,
      "snapshot-repair principal is outside the canonical JSON boundary",
    );
    const requestValue = snapshotCanonicalOwnerInputV1(
      value,
      "snapshot repair is outside the canonical JSON boundary",
    );
    const operationNow = this.#now();
    if (!Value.Check(MetaSnapshotRepairRequestV1Schema, requestValue)) {
      error("invalid_request", "snapshot repair schema mismatch");
    }
    const request = requestValue as MetaSnapshotRepairRequestV1;
    if (request.meta_job_id !== pathMetaJobId) {
      error("invalid_request", "snapshot repair path/body mismatch");
    }
    try {
        assertMetaSnapshotRepairRequestSemanticBindingsV1(
          request,
          operationNow.getTime(),
      );
    } catch {
      error("invalid_request", "snapshot repair semantic mismatch");
    }
    return this.#locked(() => {
      const job = this.#jobs.get(request.meta_job_id);
      if (job === undefined) error("not_found");
      requirePrincipal(
        principalSnapshot,
        "trigger_processor",
        "meta.snapshot_repair",
        job,
      );
      const requestHash = requestHashWithoutTrace(request);
      const prior = this.#repairs.get(request.repair_id);
      if (prior !== undefined) {
        if (prior.request_hash !== requestHash) {
          error("idempotency_conflict");
        }
        return replay(prior.response);
      }
      const revision =
        this.#jobInputRevision.get(job.id) ?? 1;
      const repairable =
        REPAIRABLE_REASONS.has(request.reason_code) &&
        job.trigger_process_id === request.trigger_process_id &&
        job.snapshot_ref === request.previous_snapshot_ref &&
        job.snapshot_version ===
          request.previous_snapshot_version &&
        job.snapshot_hash === request.previous_snapshot_hash &&
        (job.status === "queued" ||
          job.status === "retry_wait" ||
          job.status === "failed");
      const at = operationNow.toISOString();
      const response: MetaSnapshotRepairResponseV1 = repairable
        ? {
            job_id: job.id,
            repair_id: request.repair_id,
            input_revision: assertSafeNext(
              revision,
              "Meta input revision",
            ),
            snapshot_version: request.next_snapshot_version,
            status: "accepted",
            next_retry_at: at,
            accepted_at: at,
            duplicate_replayed: false,
          }
        : {
            job_id: job.id,
            repair_id: request.repair_id,
            input_revision: revision,
            snapshot_version: job.snapshot_version,
            status: "rejected",
            next_retry_at: null,
            accepted_at: null,
            reason_code: "snapshot_repair_not_allowed",
            duplicate_replayed: false,
          };
      if (!Value.Check(MetaSnapshotRepairResponseV1Schema, response)) {
        throw new Error("snapshot repair owner contract drift");
      }
      if (response.status === "accepted") {
        this.#jobs.set(job.id, {
          ...job,
          snapshot_ref: request.next_snapshot_ref,
          snapshot_version: request.next_snapshot_version,
          snapshot_hash: request.next_snapshot_hash,
          snapshot_retention_until:
            request.snapshot_retention_until,
          status: "retry_wait",
          lease_previous_status: null,
          next_retry_at: at,
          error: null,
          updated_at: at,
        });
        this.#jobInputRevision.set(
          job.id,
          response.input_revision,
        );
      }
      this.#repairs.set(request.repair_id, {
        request_hash: requestHash,
        response,
      });
      return immutable(response);
    });
  }

  public async reviewSkillCandidate(
    principal: MetaOperationsPrincipalV1,
    pathCandidateId: string,
    value: unknown,
  ): Promise<MetaSkillCandidateReviewResponseV1> {
    const principalSnapshot = snapshotCanonicalOwnerInputV1(
      principal,
      "candidate-review principal is outside the canonical JSON boundary",
    );
    const requestValue = snapshotCanonicalOwnerInputV1(
      value,
      "candidate review is outside the canonical JSON boundary",
    );
    const operationNow = this.#now();
    if (
      !Value.Check(
        MetaSkillCandidateReviewRequestV1Schema,
        requestValue,
      )
    ) {
      error("invalid_request", "candidate review schema mismatch");
    }
    const request =
      requestValue as MetaSkillCandidateReviewRequestV1;
    if (
      request.candidate_id !== pathCandidateId ||
      request.reviewer_principal_id !== principalSnapshot.principal_id
    ) {
      error(
        "authorization_scope_mismatch",
        "candidate review identity mismatch",
      );
    }
    return this.#locked(() => {
      const stored = this.#candidates.get(request.candidate_id);
      if (stored === undefined) error("not_found");
      const job = this.#jobs.get(stored.meta_job_id);
      if (
        job === undefined ||
        !sameScope(job, stored.candidate)
      ) {
        error(
          "dependency_unavailable",
          "candidate owner job binding is unavailable",
        );
      }
      requirePrincipal(
        principalSnapshot,
        "meta_cognition",
        "meta.skill_candidate.review",
        stored.candidate,
      );
      const requestHash = requestHashWithoutTrace(request);
      const priorCandidateId = this.#reviewIdempotency.get(
        request.idempotency_key,
      );
      if (
        priorCandidateId !== undefined &&
        priorCandidateId !== request.candidate_id
      ) {
        error("idempotency_conflict");
      }
      const prior = this.#reviews.get(request.candidate_id);
      if (prior !== undefined) {
        if (prior.request_hash !== requestHash) {
          error("idempotency_conflict");
        }
        return replay(prior.response);
      }
      if (
        stored.candidate.status !== request.expected_status ||
        stored.candidate.review_version !==
          request.expected_review_version ||
        stored.updated_at !== request.expected_updated_at
      ) {
        error("stale_fence");
      }
      const reviewVersion = assertSafeNext(
        stored.candidate.review_version,
        "candidate review version",
      );
      const accepted = request.decision === "accept";
      const applicationId = accepted
        ? `skill_candidate_application:${request.candidate_id}:${reviewVersion}`
        : null;
      const deliveryId = accepted
        ? `meta_skill_delivery:${request.candidate_id}:${reviewVersion}`
        : null;
      const status =
        request.decision === "accept"
          ? "accepted"
          : request.decision === "reject"
            ? "rejected"
            : "superseded";
      const response: MetaSkillCandidateReviewResponseV1 = {
        candidate_id: request.candidate_id,
        status,
        review_version: reviewVersion,
        application_id: applicationId,
        delivery_id: deliveryId,
        duplicate_replayed: false,
      };
      if (
        !Value.Check(
          MetaSkillCandidateReviewResponseV1Schema,
          response,
        )
      ) {
        throw new Error("candidate review response drift");
      }
      assertMetaSkillCandidateReviewSemanticBindingsV1(
        pathCandidateId,
        request,
        response,
        principalSnapshot.principal_id,
      );
      const at = operationNow.toISOString();
      if (accepted && applicationId !== null) {
        const payload: SkillCandidateApplicationRequestV1 = {
          schema_version: "skill_candidate_application.v1",
          application_id: applicationId,
          candidate_id: stored.candidate.candidate_id,
          review_version: reviewVersion,
          candidate_type: stored.candidate.candidate_type,
          skill_key: stored.candidate.skill_key,
          workspace_id: stored.candidate.workspace_id,
          bot_id: stored.candidate.bot_id,
          owner_agent_id: stored.candidate.owner_agent_id,
          deployment_environment:
            stored.candidate.deployment_environment,
          release_channel: stored.candidate.release_channel,
          baseline_catalog_version:
            stored.candidate.baseline_catalog_version,
          proposal_ref: stored.candidate.proposal_ref,
          proposal_hash: stored.candidate.proposal_hash,
          evidence_refs: stored.evidence_artifacts.map(
            ({ ref, hash }) => ({ ref, hash }),
          ),
          reviewer_principal_id:
            request.reviewer_principal_id,
          idempotency_key: applicationId,
          trace_id: request.trace_id,
        };
        if (
          !Value.Check(
            SkillCandidateApplicationRequestV1Schema,
            payload,
          )
        ) {
          throw new Error(
            "candidate delivery violates Skill owner contract",
          );
        }
        const command = {
          command_id: deliveryId!,
          kind: "skill_candidate_application",
          meta_job_id: stored.meta_job_id,
          scope: {
            workspace_id: stored.candidate.workspace_id,
            bot_id: stored.candidate.bot_id,
            owner_agent_id: stored.candidate.owner_agent_id,
            deployment_environment:
              stored.candidate.deployment_environment,
            release_channel: stored.candidate.release_channel,
          },
          target_service: "skill_registry",
          payload,
          payload_hash: sha256CanonicalV1(payload),
          idempotency_key: applicationId,
          trace_id: request.trace_id,
          created_at: at,
        } as const;
        const eventIdempotencyKey =
          `${job.id}:meta.skill.candidate_application_requested:${applicationId}`;
        const event = durableEvent(
          job,
          "meta.skill.candidate_application_requested",
          {
            candidate_id: stored.candidate.candidate_id,
            review_version: reviewVersion,
            application_id: applicationId,
            candidate_type: stored.candidate.candidate_type,
            skill_key: stored.candidate.skill_key,
            application_payload_ref: deliveryId,
            application_payload_hash: sha256CanonicalV1(payload),
            baseline_catalog_version:
              stored.candidate.baseline_catalog_version,
            reviewer_principal_id:
              request.reviewer_principal_id,
            idempotency_key: eventIdempotencyKey,
            trace_id: job.trace_id,
            command_schema_version:
              "skill_candidate_application.v1",
          },
          at,
          applicationId,
        );
        this.#appendCommand(command);
        this.#outbox.push(event);
      }
      this.#candidates.set(request.candidate_id, {
        ...stored,
        candidate: {
          ...stored.candidate,
          status,
          review_version: reviewVersion,
          application_id: applicationId,
          delivery_id: deliveryId,
          downstream_status: accepted
            ? "pending"
            : stored.candidate.downstream_status,
        },
        updated_at: at,
      });
      this.#reviews.set(request.candidate_id, {
        request_hash: requestHash,
        response,
      });
      this.#reviewIdempotency.set(
        request.idempotency_key,
        request.candidate_id,
      );
      return immutable(response);
    });
  }

  #appendCommand(
    command: Readonly<NewMetaDurableCommandV1>,
  ) {
    const owner = this.#commandIdempotency.get(
      command.idempotency_key,
    );
    if (owner !== undefined && owner !== command.command_id) {
      error("idempotency_conflict");
    }
    const existing = this.#commands.get(command.command_id);
    if (existing !== undefined) {
      if (
        existing.kind !== command.kind ||
        existing.meta_job_id !== command.meta_job_id ||
        existing.target_service !== command.target_service ||
        existing.payload_hash !== command.payload_hash ||
        existing.idempotency_key !== command.idempotency_key ||
        !sameScope(existing.scope, command.scope)
      ) {
        error("idempotency_conflict");
      }
      return;
    }
    const pending: MetaDurableCommandV1 = {
      ...clone(command),
      status: "pending",
      attempt_count: 0,
      lease_generation: 0,
      claimed_by: null,
      lease_expires_at: null,
      next_retry_at: null,
      settlement_id: null,
      settlement_hash: null,
      result_ref: null,
      last_error: null,
      updated_at: command.created_at,
    };
    if (!Value.Check(MetaDurableCommandV1Schema, pending)) {
      throw new Error("pending command contract drift");
    }
    assertMetaDurableCommandSemanticBindingsV1(pending);
    this.#commands.set(command.command_id, immutable(pending));
    this.#commandIdempotency.set(
      command.idempotency_key,
      command.command_id,
    );
  }

  public async claimCommands(
    principal: MetaOperationsPrincipalV1,
    value: unknown,
  ): Promise<readonly MetaDurableCommandV1[]> {
    const principalSnapshot = snapshotCanonicalOwnerInputV1(
      principal,
      "command-claim principal is outside the canonical JSON boundary",
    );
    const requestValue = snapshotCanonicalOwnerInputV1(
      value,
      "command claim is outside the canonical JSON boundary",
    );
    if (!Value.Check(MetaCommandClaimRequestV1Schema, requestValue)) {
      error("invalid_request", "command claim schema mismatch");
    }
    const request = requestValue as MetaCommandClaimRequestV1;
    requirePrincipal(
      principalSnapshot,
      "meta_cognition",
      "meta.command.dispatch",
      principalSnapshot.scope,
    );
    if (request.worker_id !== principalSnapshot.principal_id) {
      error("authorization_scope_mismatch", "worker identity mismatch");
    }
    return this.#locked(() => {
      const now = this.#now();
      const eligible = [...this.#commands.values()]
        .filter(
          (command) =>
            sameScope(principalSnapshot.scope, command.scope) &&
            (command.status === "pending" ||
              (command.status === "retry_wait" &&
                command.next_retry_at !== null &&
                Date.parse(command.next_retry_at) <=
                  now.getTime()) ||
              (command.status === "claimed" &&
                command.lease_expires_at !== null &&
                Date.parse(command.lease_expires_at) <=
                  now.getTime())),
        )
        .sort(
          (left, right) =>
            left.created_at.localeCompare(right.created_at) ||
            left.command_id.localeCompare(right.command_id),
        );
      const activeJobIds = new Set(
        [...this.#commands.values()]
          .filter(
            (command) =>
              sameScope(principalSnapshot.scope, command.scope) &&
              command.status === "claimed" &&
              command.lease_expires_at !== null &&
              Date.parse(command.lease_expires_at) >
                now.getTime(),
          )
          .map(({ meta_job_id }) => meta_job_id),
      );
      const selectedJobIds = new Set<string>();
      const due: MetaDurableCommandV1[] = [];
      for (const command of eligible) {
        if (
          due.length >= request.limit ||
          selectedJobIds.has(command.meta_job_id) ||
          activeJobIds.has(command.meta_job_id)
        ) {
          continue;
        }
        selectedJobIds.add(command.meta_job_id);
        due.push(command);
      }
      const claimed = due.map((command) => {
        const claimed: MetaDurableCommandV1 = {
          ...command,
          status: "claimed",
          attempt_count: assertSafeNext(
            command.attempt_count,
            "command attempt",
          ),
          lease_generation: assertSafeNext(
            command.lease_generation,
            "command lease generation",
          ),
          claimed_by: request.worker_id,
          lease_expires_at: new Date(
            now.getTime() + request.lease_seconds * 1_000,
          ).toISOString(),
          next_retry_at: null,
          settlement_id: null,
          settlement_hash: null,
          result_ref: null,
          last_error: null,
          updated_at: now.toISOString(),
        };
        if (!Value.Check(MetaDurableCommandV1Schema, claimed)) {
          throw new Error("claimed command contract drift");
        }
        assertMetaDurableCommandSemanticBindingsV1(claimed);
        return immutable(claimed);
      });
      assertMetaCommandClaimSemanticBindingsV1(request, claimed);
      const candidateUpdates = claimed.flatMap((command) => {
        if (command.kind !== "skill_candidate_application") return [];
        const entry = [...this.#candidates.entries()].find(
          ([, stored]) =>
            stored.candidate.delivery_id === command.command_id,
        );
        if (entry === undefined) {
          throw new Error(
            "Skill delivery command lost its candidate owner binding",
          );
        }
        const [candidateId, stored] = entry;
        const candidate: MetaSkillCandidateV1 = {
          ...stored.candidate,
          downstream_status: "dispatching",
          attempt_count: command.attempt_count,
          last_error: null,
        };
        if (!Value.Check(MetaSkillCandidateV1Schema, candidate)) {
          throw new Error("claimed Skill candidate contract drift");
        }
        return [
          [
            candidateId,
            {
              ...stored,
              candidate: immutable(candidate),
              updated_at: now.toISOString(),
            },
          ] as const,
        ];
      });
      for (const command of claimed) {
        this.#commands.set(command.command_id, command);
      }
      for (const [candidateId, stored] of candidateUpdates) {
        this.#candidates.set(candidateId, stored);
      }
      return immutable(claimed);
    });
  }

  public async settleCommand(
    principal: MetaOperationsPrincipalV1,
    pathCommandId: string,
    value: unknown,
  ): Promise<MetaCommandSettlementResponseV1> {
    return this.#settleCommand(
      principal,
      pathCommandId,
      value,
      undefined,
    );
  }

  async #settleCommand(
    principal: MetaOperationsPrincipalV1,
    pathCommandId: string,
    value: unknown,
    verifiedSuccess: MetaVerifiedCommandSuccessV1 | undefined,
  ): Promise<MetaCommandSettlementResponseV1> {
    const principalSnapshot = snapshotCanonicalOwnerInputV1(
      principal,
      "command-settlement principal is outside the canonical JSON boundary",
    );
    const requestValue = snapshotCanonicalOwnerInputV1(
      value,
      "command settlement is outside the canonical JSON boundary",
    );
    const publicRequestValid = Value.Check(
      MetaCommandSettlementRequestV1Schema,
      requestValue,
    );
    const internalSuccessValid =
      verifiedSuccess !== undefined &&
      typeof requestValue === "object" &&
      requestValue !== null &&
      !Array.isArray(requestValue) &&
      Object.keys(requestValue).length === 8 &&
      Object.keys(requestValue).every((key) =>
        [
          "worker_id",
          "lease_generation",
          "settlement_id",
          "outcome",
          "result_ref",
          "error_code",
          "next_retry_at",
          "trace_id",
        ].includes(key),
      ) &&
      (requestValue as Readonly<Record<string, unknown>>).outcome ===
        "succeeded" &&
      typeof (requestValue as Readonly<Record<string, unknown>>)
        .worker_id === "string" &&
      Number.isSafeInteger(
        (requestValue as Readonly<Record<string, unknown>>)
          .lease_generation,
      ) &&
      ((requestValue as Readonly<Record<string, unknown>>)
        .lease_generation as number) >= 1 &&
      typeof (requestValue as Readonly<Record<string, unknown>>)
        .settlement_id === "string" &&
      typeof (requestValue as Readonly<Record<string, unknown>>)
        .result_ref === "string" &&
      (requestValue as Readonly<Record<string, unknown>>).error_code ===
        null &&
      (requestValue as Readonly<Record<string, unknown>>).next_retry_at ===
        null &&
      typeof (requestValue as Readonly<Record<string, unknown>>)
        .trace_id === "string";
    if (!publicRequestValid && !internalSuccessValid) {
      error("invalid_request", "command settlement schema mismatch");
    }
    const request =
      requestValue as MetaInternalCommandSettlementRequestV1;
    requirePrincipal(
      principalSnapshot,
      "meta_cognition",
      "meta.command.dispatch",
      principalSnapshot.scope,
    );
    if (request.worker_id !== principalSnapshot.principal_id) {
      error("authorization_scope_mismatch", "worker identity mismatch");
    }
    return this.#locked(() => {
      const command = this.#commands.get(pathCommandId);
      if (command === undefined) error("not_found");
      if (!sameScope(principalSnapshot.scope, command.scope)) {
        error("authorization_scope_mismatch");
      }
      if (request.outcome === "succeeded") {
        if (verifiedSuccess === undefined) {
          error(
            "invalid_request",
            "successful command settlement requires verified owner evidence",
          );
        }
        assertVerifiedOwnerSuccessV1(command, verifiedSuccess);
        if (request.result_ref !== verifiedSuccess.result_ref) {
          error(
            "invalid_request",
            "successful command settlement result reference drifted",
          );
        }
      }
      const settlementHash = requestHashWithoutTrace({
        ...request,
        ...(verifiedSuccess === undefined
          ? {}
          : {
              target_service: verifiedSuccess.target_service,
              owner_request_hash:
                verifiedSuccess.owner_request_hash,
              source_owner_request_hash:
                verifiedSuccess.source_owner_request_hash,
              owner_response_hash:
                verifiedSuccess.owner_response_hash,
            }),
      });
      const settlementKey = sha256CanonicalV1({
        command_id: command.command_id,
        settlement_id: request.settlement_id,
      });
      const priorSettlement =
        this.#commandSettlements.get(settlementKey);
      if (priorSettlement !== undefined) {
        if (priorSettlement.request_hash !== settlementHash) {
          error("idempotency_conflict");
        }
        return replay(priorSettlement.response);
      }
      const now = this.#now();
      if (
        command.status !== "claimed" ||
        command.claimed_by !== request.worker_id ||
        command.lease_generation !==
          request.lease_generation ||
        command.lease_expires_at === null ||
        Date.parse(command.lease_expires_at) <=
          now.getTime()
      ) {
        error("stale_fence");
      }
      if (
        (request.outcome === "succeeded" &&
          (request.result_ref === null ||
            request.error_code !== null ||
            request.next_retry_at !== null)) ||
        (request.outcome === "retry_wait" &&
          (request.result_ref !== null ||
            request.error_code === null ||
            request.next_retry_at === null ||
            Date.parse(request.next_retry_at) <=
              now.getTime())) ||
        (request.outcome === "failed" &&
          (request.result_ref !== null ||
            request.error_code === null ||
            request.next_retry_at !== null))
      ) {
        error("invalid_request", "command settlement binding mismatch");
      }
      const maxAttempts =
        this.options.max_command_attempts ?? 10;
      const effectiveOutcome =
        request.outcome === "retry_wait" &&
        command.attempt_count >= maxAttempts
          ? "failed"
          : request.outcome;
      const at = now.toISOString();
      const next: MetaDurableCommandV1 = {
        ...command,
        status: effectiveOutcome,
        claimed_by: null,
        lease_expires_at: null,
        next_retry_at:
          effectiveOutcome === "retry_wait"
            ? request.next_retry_at
            : null,
        settlement_id: request.settlement_id,
        settlement_hash: settlementHash,
        result_ref:
          effectiveOutcome === "succeeded"
            ? request.result_ref
            : null,
        last_error:
          effectiveOutcome === "succeeded"
            ? null
            : request.error_code,
        updated_at: at,
      };
      if (!Value.Check(MetaDurableCommandV1Schema, next)) {
        throw new Error("settled command contract drift");
      }
      assertMetaDurableCommandSemanticBindingsV1(next);
      const commandSnapshot = new Map(this.#commands);
      const jobSnapshot = new Map(this.#jobs);
      const resultSnapshot = new Map(this.#results);
      const candidateSnapshot = new Map(this.#candidates);
      const outboxLength = this.#outbox.length;
      try {
        this.#commands.set(command.command_id, immutable(next));
        this.#settleSkillCandidateDelivery(
          next,
          effectiveOutcome,
          request.error_code,
          at,
        );
        const result = this.#settlePartialPendingResult(
          next,
          effectiveOutcome,
          request.error_code,
          request.next_retry_at,
          at,
        );
        const response: MetaCommandSettlementResponseV1 = {
          command_id: command.command_id,
          status: effectiveOutcome,
          duplicate_replayed: false,
          result_status: result?.result_status ?? null,
          result_version: result?.result_version ?? null,
        };
        if (
          !Value.Check(
            MetaCommandSettlementResponseV1Schema,
            response,
          )
        ) {
          throw new Error("command settlement response contract drift");
        }
        if (request.outcome === "succeeded") {
          if (
            response.command_id !== pathCommandId ||
            response.status !== "succeeded" ||
            (response.result_status === null) !==
              (response.result_version === null)
          ) {
            throw new Error(
              "controlled command settlement response binding drift",
            );
          }
        } else {
          assertMetaCommandSettlementSemanticBindingsV1(
            pathCommandId,
            {
              ...request,
              outcome: request.outcome,
              result_ref: null,
            },
            response,
            now.getTime(),
          );
        }
        const immutableResponse = immutable(response);
        this.#commandSettlements.set(settlementKey, {
          request_hash: settlementHash,
          response: immutableResponse,
        });
        return immutableResponse;
      } catch (settlementError) {
        this.#commands.clear();
        for (const [commandId, storedCommand] of commandSnapshot) {
          this.#commands.set(commandId, storedCommand);
        }
        this.#jobs.clear();
        for (const [jobId, storedJob] of jobSnapshot) {
          this.#jobs.set(jobId, storedJob);
        }
        this.#results.clear();
        for (const [resultId, stored] of resultSnapshot) {
          this.#results.set(resultId, stored);
        }
        this.#candidates.clear();
        for (const [candidateId, stored] of candidateSnapshot) {
          this.#candidates.set(candidateId, stored);
        }
        this.#outbox.length = outboxLength;
        throw settlementError;
      }
    });
  }

  #settleSkillCandidateDelivery(
    command: MetaDurableCommandV1,
    outcome: "succeeded" | "retry_wait" | "failed",
    errorCode: string | null,
    at: string,
  ): void {
    if (command.kind !== "skill_candidate_application") return;
    const entry = [...this.#candidates.entries()].find(
      ([, stored]) =>
        stored.candidate.delivery_id === command.command_id,
    );
    if (entry === undefined) {
      throw new Error(
        "Skill delivery settlement lost its candidate owner binding",
      );
    }
    const [candidateId, stored] = entry;
    const candidate: MetaSkillCandidateV1 = {
      ...stored.candidate,
      downstream_status:
        outcome === "succeeded"
          ? "received"
          : outcome === "failed"
            ? "failed"
            : "pending",
      downstream_ref:
        outcome === "succeeded" ? command.result_ref : null,
      attempt_count: command.attempt_count,
      last_error:
        outcome === "succeeded"
          ? null
          : {
              code: errorCode ?? "skill_candidate_delivery_failed",
              retryable: outcome === "retry_wait",
            },
    };
    if (!Value.Check(MetaSkillCandidateV1Schema, candidate)) {
      throw new Error("settled Skill candidate contract drift");
    }
    this.#candidates.set(candidateId, {
      ...stored,
      candidate: immutable(candidate),
      updated_at: at,
    });
  }

  #settlePartialPendingResult(
    command: MetaDurableCommandV1,
    outcome: "succeeded" | "retry_wait" | "failed",
    errorCode: string | null,
    nextRetryAt: string | null,
    at: string,
  ): MetaResultV1 | undefined {
    if (command.kind !== "compensation") return undefined;
    const entry = [...this.#results.entries()].find(
      ([, stored]) => stored.job.id === command.meta_job_id,
    );
    if (entry === undefined) {
      throw new Error(
        "compensation settlement lost its Meta result owner binding",
      );
    }
    const [resultId, stored] = entry;
    const previous = stored.result;
    const index = previous.payload.partial_failures.findIndex(
      ({ compensation_outbox_id }) =>
        compensation_outbox_id === command.command_id,
    );
    if (index < 0) {
      throw new Error(
        "compensation command is not linked to a partial failure",
      );
    }
    const failures = [...previous.payload.partial_failures];
    const prior = failures[index]!;
    const {
      next_retry_at: _priorNextRetryAt,
      downstream_ref: _priorDownstreamRef,
      terminal_reason: _priorTerminalReason,
      resolved_at: _priorResolvedAt,
      ...failureBase
    } = prior;
    const updated: PartialFailureV1 =
      outcome === "retry_wait"
        ? {
            ...failureBase,
            status: "retrying",
            attempt_count: command.attempt_count,
            next_retry_at: nextRetryAt!,
          }
        : outcome === "succeeded"
          ? {
              ...failureBase,
              status: "succeeded",
              attempt_count: command.attempt_count,
              downstream_ref: command.result_ref!,
              resolved_at: at,
            }
          : {
              ...failureBase,
              status: "failed",
              attempt_count: command.attempt_count,
              terminal_reason:
                errorCode ?? "compensation_failed",
              resolved_at: at,
    };
    assertPartialFailureSemanticBindingsV1(updated);
    failures[index] = updated;
    const changedFailureIds = [updated.failure_id];
    if (outcome === "failed" && updated.blocking) {
      for (
        let failureIndex = 0;
        failureIndex < failures.length;
        failureIndex += 1
      ) {
        if (failureIndex === index) continue;
        const candidate = failures[failureIndex]!;
        if (
          candidate.status !== "pending" &&
          candidate.status !== "retrying"
        ) {
          continue;
        }
        const {
          next_retry_at: _nextRetryAt,
          downstream_ref: _downstreamRef,
          terminal_reason: _terminalReason,
          resolved_at: _resolvedAt,
          ...candidateBase
        } = candidate;
        const abandoned: PartialFailureV1 = {
          ...candidateBase,
          status: "abandoned",
          terminal_reason: "blocking_compensation_failed",
          resolved_at: at,
        };
        assertPartialFailureSemanticBindingsV1(abandoned);
        failures[failureIndex] = abandoned;
        changedFailureIds.push(abandoned.failure_id);
        const compensationCommandId =
          abandoned.compensation_outbox_id;
        if (compensationCommandId === undefined) continue;
        const activeCommand = this.#commands.get(
          compensationCommandId,
        );
        if (
          activeCommand === undefined ||
          activeCommand.status === "succeeded" ||
          activeCommand.status === "failed"
        ) {
          continue;
        }
        if (activeCommand.status === "claimed") {
          throw new Error(
            "blocking compensation cannot cascade across an in-flight sibling",
          );
        }
        const cascadeSettlementId =
          `meta_cascade_${sha256CanonicalV1({
            failed_command_id: command.command_id,
            abandoned_command_id: activeCommand.command_id,
            result_version: previous.result_version,
          }).slice("sha256:".length, "sha256:".length + 32)}`;
        const cascadeSettlementHash = sha256CanonicalV1({
          command_id: activeCommand.command_id,
          settlement_id: cascadeSettlementId,
          outcome: "failed",
          error_code: "blocking_compensation_failed",
        });
        const failedCommand: MetaDurableCommandV1 = {
          ...activeCommand,
          status: "failed",
          claimed_by: null,
          lease_expires_at: null,
          next_retry_at: null,
          settlement_id: cascadeSettlementId,
          settlement_hash: cascadeSettlementHash,
          result_ref: null,
          last_error: "blocking_compensation_failed",
          updated_at: at,
        };
        if (!Value.Check(MetaDurableCommandV1Schema, failedCommand)) {
          throw new Error(
            "cascaded compensation command contract drift",
          );
        }
        assertMetaDurableCommandSemanticBindingsV1(failedCommand);
        this.#commands.set(
          activeCommand.command_id,
          immutable(failedCommand),
        );
      }
    }
    const active = failures.filter(
      ({ status }) =>
        status === "pending" || status === "retrying",
    );
    const terminalFailure = failures.some(
      ({ status }) =>
        status === "failed" ||
        status === "abandoned" ||
        status === "unknown",
    );
    const resultStatus =
      active.length > 0
        ? "partial_pending"
        : terminalFailure
          ? "partial_failed"
          : "complete";
    const payload: MetaResultPayloadV1 = {
      ...previous.payload,
      result_status: resultStatus,
      partial_failures: failures,
    };
    if (!Value.Check(MetaResultPayloadV1Schema, payload)) {
      throw new Error("reconciled result payload contract drift");
    }
    assertMetaResultPayloadSemanticBindingsV1(payload);
    const resultVersion = assertSafeNext(
      previous.result_version,
      "Meta result version",
    );
    const result: MetaResultV1 = {
      ...previous,
      result_version: resultVersion,
      result_status: resultStatus,
      payload,
      finalized_at:
        resultStatus === "partial_pending" ? null : at,
    };
    const activeBlocking = failures.some(
      (failure) =>
        failure.blocking &&
        (failure.status === "pending" ||
          failure.status === "retrying"),
    );
    const terminalBlocking = failures.some(
      (failure) =>
        failure.blocking &&
        (failure.status === "failed" ||
          failure.status === "abandoned" ||
          failure.status === "unknown"),
    );
    const nextJobStatus =
      activeBlocking
        ? "retry_wait"
        : terminalBlocking
          ? "failed"
          : "completed";
    const jobNextRetryAt =
      nextJobStatus === "retry_wait"
        ? (
            failures
              .filter(
                (failure) =>
                  failure.blocking &&
                  (failure.status === "pending" ||
                    failure.status === "retrying"),
              )
              .flatMap((failure) =>
                failure.next_retry_at === undefined
                  ? []
                  : [failure.next_retry_at],
              )
              .sort()[0] ??
            stored.job.next_retry_at ??
            nextRetryAt
          )
        : null;
    if (
      nextJobStatus === "retry_wait" &&
      jobNextRetryAt === null
    ) {
      throw new Error(
        "blocking compensation retry lost its job retry clock",
      );
    }
    const nextJob: MetaJobRecordV1 = {
      ...stored.job,
      status: nextJobStatus,
      lease_previous_status: null,
      next_retry_at: jobNextRetryAt,
      error:
        nextJobStatus === "failed"
          ? {
              code: errorCode ?? "compensation_failed",
              message: "Blocking Meta compensation failed",
              retryable: false,
              source: command.target_service,
            }
          : nextJobStatus === "retry_wait"
            ? stored.job.error
            : null,
      updated_at: at,
    };
    const audit: MetaResultAuditItemV1 = {
      audit_id:
        `meta_result_audit:${result.id}:${resultVersion}`,
      result_version: resultVersion,
      previous_result_status: previous.result_status,
      result_status: resultStatus,
      operation:
        resultStatus === "partial_pending"
          ? "compensation_retry"
          : "compensation_settled",
      changed_failure_ids: changedFailureIds,
      actor_kind: "service",
      actor_ref: "meta_cognition",
      payload_summary: {
        command_id: command.command_id,
        command_status: command.status,
        active_compensation_count: active.length,
      },
      created_at: at,
    };
    this.#results.set(resultId, {
      ...stored,
      job: immutable(nextJob),
      result: immutable(result),
      audits: Object.freeze([...stored.audits, audit]),
    });
    this.#jobs.set(nextJob.id, immutable(nextJob));
    this.#outbox.push(
      durableEvent(
        stored.job,
        "meta.result.updated",
        {
          meta_result_id: result.id,
          previous_result_version: previous.result_version,
          result_version: result.result_version,
          previous_result_status: previous.result_status,
          result_status: result.result_status,
          changed_failure_ids: changedFailureIds,
          active_compensation_count: active.length,
          active_repair_count: 0,
          meta_summary_ref: null,
          updated_at: at,
        },
        at,
        `result_updated:${result.result_version}`,
      ),
    );
    if (result.finalized_at !== null) {
      const metaStatus =
        nextJob.status === "failed" ? "failed" : "completed";
      this.#outbox.push(
        durableEvent(
          stored.job,
          "meta.result.finalized",
          {
            meta_result_id: result.id,
            result_version: result.result_version,
            result_status: result.result_status,
            finalized_at: result.finalized_at,
            previous_meta_status: metaStatus,
            next_meta_status: metaStatus,
            projection_version: Math.max(
              1,
              stored.job.attempt_count * 2 + 1,
            ),
            meta_enqueue_reason: stored.job.enqueue_reason,
            active_compensation_count: 0,
            active_repair_count: 0,
            meta_summary_ref: null,
          },
          at,
          `result_finalized:${result.result_version}`,
        ),
      );
    }
    if (
      stored.job.status !== nextJob.status &&
      nextJob.status === "completed"
    ) {
      this.#outbox.push(
        durableEvent(
          nextJob,
          "meta.job.completed",
          {
            previous_meta_status:
              stored.job.status === "retry_wait"
                ? "retry_wait"
                : "running",
            next_meta_status: "completed",
            projection_version: Math.max(
              1,
              nextJob.attempt_count * 2 + 1,
            ),
            reason_code: "meta_compensation_completed",
            meta_result_id: result.id,
            result_version: result.result_version,
            result_status: result.result_status,
            completed_at: at,
            partial_failures_count: failures.length,
            meta_enqueue_reason: nextJob.enqueue_reason,
            active_compensation_count: 0,
            active_repair_count: 0,
            meta_summary_ref: null,
            result_finalized_at: result.finalized_at,
          },
          at,
          `completed:${result.result_version}`,
        ),
      );
    }
    if (
      stored.job.status !== nextJob.status &&
      nextJob.status === "failed"
    ) {
      this.#outbox.push(
        durableEvent(
          nextJob,
          "meta.job.failed",
          {
            previous_meta_status:
              stored.job.status === "retry_wait"
                ? "retry_wait"
                : "running",
            next_meta_status: "failed",
            projection_version: Math.max(
              1,
              nextJob.attempt_count * 2 + 1,
            ),
            reason_code: nextJob.error!.code,
            failed_at: at,
            attempt_count: nextJob.attempt_count,
            error: nextJob.error!,
            result_disposition: "finalized",
            meta_result_id: result.id,
            result_version: result.result_version,
            result_status: "partial_failed",
            result_finalized_at: result.finalized_at!,
            active_compensation: false,
            meta_enqueue_reason: nextJob.enqueue_reason,
          },
          at,
          `failed:${result.result_version}`,
        ),
      );
    }
    return result;
  }

  public async reconcilePendingCommands(
    principal: MetaOperationsPrincipalV1,
    dispatcher: MetaOwnerCommandDispatcherV1,
    input: MetaCommandClaimRequestV1,
    signal?: AbortSignal,
  ): Promise<Readonly<{ claimed: number; settled: number }>> {
    const principalSnapshot = snapshotCanonicalOwnerInputV1(
      principal,
      "command-reconciliation principal is outside the canonical JSON boundary",
    );
    const inputSnapshot = snapshotCanonicalOwnerInputV1(
      input,
      "command-reconciliation request is outside the canonical JSON boundary",
    );
    if (!(dispatcher instanceof MetaOwnerCommandDispatcherV1)) {
      error(
        "invalid_request",
        "compensation reconciliation requires the controlled owner dispatcher",
      );
    }
    if (!Value.Check(MetaCommandClaimRequestV1Schema, inputSnapshot)) {
      error("invalid_request", "command reconciliation schema mismatch");
    }
    let claimedCount = 0;
    let settled = 0;
    while (claimedCount < inputSnapshot.limit) {
      const claimed = await this.claimCommands(
        principalSnapshot,
        {
          worker_id: inputSnapshot.worker_id,
          limit: inputSnapshot.limit - claimedCount,
          lease_seconds: inputSnapshot.lease_seconds,
          trace_id: inputSnapshot.trace_id,
        },
      );
      if (claimed.length === 0) break;
      claimedCount += claimed.length;
      for (const command of claimed) {
        const currentCommand = this.#commands.get(
          command.command_id,
        );
        if (
          currentCommand === undefined ||
          currentCommand.status !== "claimed" ||
          currentCommand.claimed_by !== inputSnapshot.worker_id ||
          currentCommand.lease_generation !==
            command.lease_generation
        ) {
          continue;
        }
        let outcome:
          | Awaited<ReturnType<MetaCommandDispatcherV1["dispatch"]>>;
        try {
          outcome = snapshotCanonicalJsonV1(
            await dispatcher.dispatch(command, signal),
          );
          assertCanonicalOwnerSeedV1(
            outcome,
            "Meta command dispatcher returned a non-canonical result",
          );
        } catch {
          outcome = {
            outcome: "retry_wait",
            result_ref: null,
            error_code: "dispatcher_unavailable",
            next_retry_at: new Date(
              this.#now().getTime() + 1_000,
            ).toISOString(),
          };
        }
        await this.#settleCommand(
          principalSnapshot,
          command.command_id,
          {
            worker_id: inputSnapshot.worker_id,
            lease_generation: command.lease_generation,
            settlement_id:
              `${command.command_id}:g${command.lease_generation}`,
            outcome: outcome.outcome,
            result_ref: outcome.result_ref,
            error_code: outcome.error_code,
            next_retry_at: outcome.next_retry_at,
            trace_id: inputSnapshot.trace_id,
          },
          outcome.outcome === "succeeded" ? outcome : undefined,
        );
        settled += 1;
      }
    }
    return Object.freeze({ claimed: claimedCount, settled });
  }

  public inspect(): MetaOwnerOperationsInspectionV1 {
    return immutable({
      jobs: [...this.#jobs.values()],
      feedback_requests: [...this.#feedback.values()],
      candidates: [...this.#candidates.values()].map(
        ({ candidate }) => candidate,
      ),
      commands: [...this.#commands.values()],
      results: [...this.#results.values()].map(
        ({ result }) => result,
      ),
      result_audits: [...this.#results.entries()].flatMap(
        ([metaResultId, { audits }]) =>
          audits.map((audit) => ({
            meta_result_id: metaResultId,
            audit,
          })),
      ),
      outbox: this.#outbox,
    });
  }
}
