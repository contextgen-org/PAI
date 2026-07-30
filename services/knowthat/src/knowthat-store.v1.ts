import {
  type ConflictPolicyV1,
  type MemoryPromotionReservationV1,
  type MemoryPromotionReservationAckRequestV1,
  type MemoryPromotionReservationReleaseRequestV1,
} from "@pai/contracts";

import {
  canonicalHashV1,
  canonicalJsonV1,
  deepFreezeJsonV1,
  deterministicIdV1,
  semanticIdentityV1,
} from "./canonical.v1.js";
import type { KnowThatConfigV1 } from "./config.v1.js";
import {
  KnowThatErrorV1,
  knowThatDurableFailureV1,
  type KnowThatAcceptedItemV1,
  type KnowThatCandidateReviewRequestV1,
  type KnowThatCandidateReviewResultV1,
  type KnowThatCategoryV1,
  type KnowThatConflictV1,
  type KnowThatDurableFailureV1,
  type KnowThatEventV1,
  type KnowThatEventEnvelopeV1,
  type KnowThatFactRevisionV1,
  type KnowThatFactV1,
  type KnowThatLinkageFenceV1,
  type KnowThatLinkageJobV1,
  type KnowThatLinkageRecoveryRequestV1,
  type KnowThatQueryFactV1,
  type KnowThatRejectedItemV1,
  type KnowThatScopeV1,
  type KnowThatSourceEventV1,
  type KnowThatWriteBatchRequestV1,
  type KnowThatWriteBatchResponseV1,
  type KnowThatWriteItemV1,
} from "./knowthat-types.v1.js";
import {
  knowThatScopeFingerprintV1,
  sameKnowThatScopeV1,
} from "./validation.v1.js";
import {
  evaluateKnowThatCanonicalConflictV1,
  evaluateKnowThatDirectActivePolicyV1,
  knowThatCanonicalSourceRankV1,
} from "./policy.v1.js";

interface ProjectionVersionV1 {
  fact: KnowThatFactV1;
  visible_from_revision: number;
  visible_until_revision: number | null;
}

interface StoredBatchV1 {
  request_hash: `sha256:${string}`;
  request: KnowThatWriteBatchRequestV1;
  response: KnowThatWriteBatchResponseV1;
}

interface StoredReviewV1 {
  request_hash: `sha256:${string}`;
  result: KnowThatCandidateReviewResultV1;
  promotion_ack_command: PromotionAckCommandV1 | null;
  promotion_release_command: PromotionReleaseCommandV1 | null;
}

interface StoredInboxV1 {
  source: "meta_cognition";
  event_id: string;
  idempotency_key: string;
  payload_hash: `sha256:${string}`;
  semantic_hash: `sha256:${string}`;
  scope_fingerprint: `sha256:${string}`;
  processed_at: string;
}

interface LinkageMemoryCommandV1 extends KnowThatScopeV1 {
  id: string;
  command_type: "linkage";
  linkage_job_id: string;
  fact_id: string;
  idempotency_key: string;
  payload: Readonly<Record<string, unknown>>;
  payload_hash: `sha256:${string}`;
  status: "pending" | "sent" | "retry_wait" | "failed";
  created_at: string;
}

export interface PromotionAckCommandV1 extends KnowThatScopeV1 {
  readonly id: string;
  readonly command_type: "promotion_reservation_ack";
  readonly reservation_id: string;
  readonly candidate_fact_id: string;
  readonly fencing_generation: number;
  readonly reservation_token_hash: `sha256:${string}`;
  readonly promotion_revision_id: string;
  readonly committed_at: string;
  readonly idempotency_key: string;
  readonly request_hash: `sha256:${string}`;
  readonly request: MemoryPromotionReservationAckRequestV1;
  readonly payload_hash: `sha256:${string}`;
  readonly status: "pending" | "dispatching" | "sent" | "retry_wait" | "failed";
  readonly attempt_count: number;
  readonly next_retry_at: string | null;
  readonly last_error: KnowThatDurableFailureV1 | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface PromotionReleaseCommandV1 extends KnowThatScopeV1 {
  readonly id: string;
  readonly command_type: "promotion_reservation_release";
  readonly reservation_id: string;
  readonly candidate_fact_id: string;
  readonly fencing_generation: number;
  readonly reservation_token_hash: `sha256:${string}`;
  readonly reservation_expires_at: string;
  readonly release_reason:
    MemoryPromotionReservationReleaseRequestV1["release_reason"];
  readonly released_at: string;
  readonly idempotency_key: string;
  readonly request_hash: `sha256:${string}`;
  readonly request: MemoryPromotionReservationReleaseRequestV1;
  readonly payload_hash: `sha256:${string}`;
  readonly status: "pending" | "dispatching" | "sent" | "retry_wait" | "failed";
  readonly attempt_count: number;
  readonly next_retry_at: string | null;
  readonly last_error: KnowThatDurableFailureV1 | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface KnowThatPromotionReservationProofV1
  extends Omit<MemoryPromotionReservationV1, "reservation_token"> {
  readonly reservation_token_hash: `sha256:${string}`;
}

type MemoryCommandV1 =
  | LinkageMemoryCommandV1
  | PromotionAckCommandV1
  | PromotionReleaseCommandV1;

export interface KnowThatCandidateReviewCommitV1 {
  readonly result: KnowThatCandidateReviewResultV1;
  readonly promotion_ack_command: PromotionAckCommandV1 | null;
  readonly promotion_release_command: PromotionReleaseCommandV1 | null;
}

interface AuditV1 {
  id: string;
  aggregate_id: string;
  action: string;
  actor: string;
  reason: string;
  state_version: number | null;
  created_at: string;
}

interface EventDeadLetterV1 extends KnowThatScopeV1 {
  id: string;
  event_id: string;
  event_type: KnowThatEventV1["event_type"];
  idempotency_key: string;
  payload_hash: `sha256:${string}`;
  attempt_count: number;
  reason: string;
  created_at: string;
}

interface StoreStateV1 {
  facts: Map<string, KnowThatFactV1>;
  revisions: Map<string, KnowThatFactRevisionV1[]>;
  activeBySlot: Map<string, string>;
  factBySourceSlot: Map<string, string>;
  queryRevisions: Map<string, number>;
  projections: Map<string, ProjectionVersionV1[]>;
  batches: Map<string, StoredBatchV1>;
  reviews: Map<string, StoredReviewV1>;
  reviewBySuggestion: Map<string, string>;
  conflicts: Map<string, KnowThatConflictV1>;
  conflictByKey: Map<string, string>;
  inboxByEvent: Map<string, StoredInboxV1>;
  inboxByIdempotency: Map<string, StoredInboxV1>;
  events: Map<string, KnowThatEventV1>;
  eventByIdempotency: Map<string, string>;
  eventDeadLetters: Map<string, EventDeadLetterV1>;
  linkageJobs: Map<string, KnowThatLinkageJobV1>;
  linkageByIdempotency: Map<string, string>;
  memoryCommands: Map<string, MemoryCommandV1>;
  recoveryByIdempotency: Map<
    string,
    Readonly<{
      request_hash: `sha256:${string}`;
      linkage_job: KnowThatLinkageJobV1;
    }>
  >;
  audits: AuditV1[];
}

export interface KnowThatQueryCursorTupleV1 {
  readonly category_priority: number;
  readonly query_rank: number;
  readonly updated_at: string;
  readonly fact_id: string;
}

export interface KnowThatStoreInspectionV1 {
  readonly facts: readonly KnowThatFactV1[];
  readonly revisions: readonly KnowThatFactRevisionV1[];
  readonly conflicts: readonly KnowThatConflictV1[];
  readonly events: readonly KnowThatEventV1[];
  readonly linkage_jobs: readonly KnowThatLinkageJobV1[];
  readonly event_dead_letters: readonly EventDeadLetterV1[];
  readonly memory_commands: readonly MemoryCommandV1[];
  readonly inbox: readonly StoredInboxV1[];
  readonly audits: readonly AuditV1[];
  readonly query_revisions: Readonly<Record<string, number>>;
}

/**
 * Durable adapters may hydrate the deterministic in-memory decision engine
 * from their owner database before computing one atomic writer plan.  This is
 * deliberately narrower than StoreStateV1: idempotency receipts are handled
 * by the durable adapter, while the seed contains only state that participates
 * in KnowThat policy decisions.
 */
export interface KnowThatStoreSeedV1 {
  readonly facts?: readonly KnowThatFactV1[];
  readonly revisions?: readonly KnowThatFactRevisionV1[];
  readonly conflicts?: readonly KnowThatConflictV1[];
  readonly events?: readonly KnowThatEventV1[];
  readonly linkage_jobs?: readonly KnowThatLinkageJobV1[];
  readonly query_revisions?: Readonly<Record<string, number>>;
  readonly projection_versions?: readonly Readonly<{
    fact: KnowThatFactV1;
    visible_from_revision: number;
    visible_until_revision: number | null;
  }>[];
}

export interface KnowThatEventDispatchClaimV1 {
  readonly fence: Readonly<{
    event_id: string;
    claim_token: string;
  }>;
  readonly event: KnowThatEventEnvelopeV1;
  readonly target: KnowThatEventV1["target"];
  readonly payload_hash: `sha256:${string}`;
  readonly attempt_count: number;
}

export interface KnowThatPromotionEvidenceV1 {
  readonly check_id: string;
  readonly check_generation: number;
  readonly candidate_fact_id: string;
  readonly check_policy_version: "memory.pre_promotion_policy.rev309";
  readonly independent_trigger_process_count: number;
  readonly has_user_explicit_confirmation: boolean;
}

export interface KnowThatStorePortV1 {
  writeBatch(
    request: KnowThatWriteBatchRequestV1,
    requestHash: `sha256:${string}`,
    now: Date,
  ): Promise<KnowThatWriteBatchResponseV1>;
  readFact(
    scope: KnowThatScopeV1,
    factId: string,
  ): Promise<KnowThatFactV1 | undefined>;
  currentRevision(scope: KnowThatScopeV1): Promise<number>;
  minimumReplayableRevision(scope: KnowThatScopeV1): Promise<number>;
  queryAt(input: Readonly<{
    scope: KnowThatScopeV1;
    revision: number;
    as_of: Date;
    categories: readonly KnowThatCategoryV1[];
    query: string | null;
    limit: number;
    after: KnowThatQueryCursorTupleV1 | null;
  }>): Promise<Readonly<{
    facts: readonly KnowThatQueryFactV1[];
    next: KnowThatQueryCursorTupleV1 | null;
  }>>;
  reviewCandidate(input: Readonly<{
    candidate_id: string;
    request: KnowThatCandidateReviewRequestV1;
    request_hash: `sha256:${string}`;
    promotion_evidence: KnowThatPromotionEvidenceV1 | null;
    promotion_reservation: KnowThatPromotionReservationProofV1 | null;
    now: Date;
  }>): Promise<KnowThatCandidateReviewCommitV1>;
  readCandidateReview(input: Readonly<{
    request: KnowThatCandidateReviewRequestV1;
    request_hash: `sha256:${string}`;
  }>): Promise<KnowThatCandidateReviewCommitV1 | undefined>;
  pendingPromotionAcks(input: Readonly<{
    limit: number;
    now: Date;
  }>): Promise<readonly PromotionAckCommandV1[]>;
  settlePromotionAck(input: Readonly<{
    command_id: string;
    outcome: "sent" | "retry_wait" | "failed";
    error: KnowThatDurableFailureV1 | null;
    now: Date;
  }>): Promise<PromotionAckCommandV1>;
  ensurePromotionRelease(input: Readonly<{
    request: KnowThatCandidateReviewRequestV1;
    promotion_reservation: KnowThatPromotionReservationProofV1;
    release_reason:
      MemoryPromotionReservationReleaseRequestV1["release_reason"];
    now: Date;
  }>): Promise<PromotionReleaseCommandV1>;
  pendingPromotionReleases(input: Readonly<{
    limit: number;
    now: Date;
  }>): Promise<readonly PromotionReleaseCommandV1[]>;
  settlePromotionRelease(input: Readonly<{
    command_id: string;
    outcome: "sent" | "retry_wait" | "failed";
    error: KnowThatDurableFailureV1 | null;
    now: Date;
  }>): Promise<PromotionReleaseCommandV1>;
  expireDue(
    scope: KnowThatScopeV1,
    input: Readonly<{
      limit: number;
      actor: string;
      trace_id: string;
      now: Date;
    }>,
  ): Promise<readonly string[]>;
  claimLinkage(input: Readonly<{
    worker_id: string;
    limit: number;
    now: Date;
  }>): Promise<
    readonly Readonly<{
      fence: KnowThatLinkageFenceV1;
      job: KnowThatLinkageJobV1;
    }>[]
  >;
  settleLinkage(input: Readonly<{
    fence: KnowThatLinkageFenceV1;
    outcome: "completed" | "retry_wait" | "failed" | "skipped";
    result: Readonly<Record<string, unknown>>;
    error: Readonly<Record<string, unknown>> | null;
    now: Date;
  }>): Promise<KnowThatLinkageJobV1>;
  recoverLinkage(
    request: KnowThatLinkageRecoveryRequestV1,
    now: Date,
  ): Promise<Readonly<{
    duplicate_replayed: boolean;
    linkage_job: KnowThatLinkageJobV1;
  }>>;
  claimEvents(input: Readonly<{
    worker_id: string;
    limit: number;
    now: Date;
  }>): Promise<readonly KnowThatEventDispatchClaimV1[]>;
  ackEvent(input: Readonly<{
    event_id: string;
    claim_token: string;
    outcome: "sent" | "retry_wait" | "failed";
    now: Date;
  }>): Promise<KnowThatEventV1>;
  checkReadiness?(signal: AbortSignal): Promise<void>;
}

function initialState(): StoreStateV1 {
  return {
    facts: new Map(),
    revisions: new Map(),
    activeBySlot: new Map(),
    factBySourceSlot: new Map(),
    queryRevisions: new Map(),
    projections: new Map(),
    batches: new Map(),
    reviews: new Map(),
    reviewBySuggestion: new Map(),
    conflicts: new Map(),
    conflictByKey: new Map(),
    inboxByEvent: new Map(),
    inboxByIdempotency: new Map(),
    events: new Map(),
    eventByIdempotency: new Map(),
    eventDeadLetters: new Map(),
    linkageJobs: new Map(),
    linkageByIdempotency: new Map(),
    memoryCommands: new Map(),
    recoveryByIdempotency: new Map(),
    audits: [],
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function immutable<T>(value: T): T {
  return deepFreezeJsonV1(clone(value));
}

function scopeKey(scope: KnowThatScopeV1): string {
  return [
    scope.workspace_id,
    scope.bot_id,
    scope.owner_agent_id,
    scope.deployment_environment,
    scope.release_channel,
  ].join("\u0000");
}

function scopeOf(value: KnowThatScopeV1): KnowThatScopeV1 {
  return {
    workspace_id: value.workspace_id,
    bot_id: value.bot_id,
    owner_agent_id: value.owner_agent_id,
    deployment_environment: value.deployment_environment,
    release_channel: value.release_channel,
  };
}

function promotionReleaseCommandIdV1(
  request: KnowThatScopeV1,
  reservation: KnowThatPromotionReservationProofV1,
): string {
  return deterministicIdV1(
    "knowthat_memory_promotion_reservation_release",
    {
      scope: scopeOf(request),
      reservation_id: reservation.reservation_id,
      fencing_generation: reservation.fencing_generation,
    },
  );
}

function scoped(scope: KnowThatScopeV1, value: string): string {
  return `${scopeKey(scope)}\u0000${value}`;
}

function promotionReleaseCommandV1(
  request: KnowThatCandidateReviewRequestV1,
  reservation: KnowThatPromotionReservationProofV1,
  releaseReason:
    MemoryPromotionReservationReleaseRequestV1["release_reason"],
  now: Date,
): PromotionReleaseCommandV1 {
  const releaseRequest: MemoryPromotionReservationReleaseRequestV1 =
    immutable({
      schema_version: "memory.promotion_reservation_release.v1",
      bot_id: request.bot_id,
      reservation_id: reservation.reservation_id,
      candidate_fact_id: reservation.candidate_fact_id,
      fencing_generation: reservation.fencing_generation,
      reservation_token_hash: reservation.reservation_token_hash,
      release_reason: releaseReason,
      released_at: now.toISOString(),
      idempotency_key: `memory-release:${canonicalHashV1({
        scope: scopeOf(request),
        reservation_id: reservation.reservation_id,
        fencing_generation: reservation.fencing_generation,
      }).slice("sha256:".length)}`,
      trace_id: request.trace_id,
    });
  const commandId = promotionReleaseCommandIdV1(request, reservation);
  const payloadHash = canonicalHashV1(releaseRequest);
  return immutable({
    ...scopeOf(request),
    id: commandId,
    command_type: "promotion_reservation_release",
    reservation_id: reservation.reservation_id,
    candidate_fact_id: reservation.candidate_fact_id,
    fencing_generation: reservation.fencing_generation,
    reservation_token_hash: reservation.reservation_token_hash,
    reservation_expires_at: reservation.expires_at,
    release_reason: releaseReason,
    released_at: releaseRequest.released_at,
    idempotency_key: releaseRequest.idempotency_key,
    request_hash: payloadHash,
    request: releaseRequest,
    payload_hash: payloadHash,
    status: "pending",
    attempt_count: 0,
    next_retry_at: null,
    last_error: null,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  });
}

function slot(scope: KnowThatScopeV1, semanticKey: string): string {
  return scoped(scope, semanticKey);
}

function sourceSlot(
  scope: KnowThatScopeV1,
  semanticKey: string,
  sourceRef: string,
): string {
  return scoped(scope, `${semanticKey}\u0000${sourceRef}`);
}

function nextSafe(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0 || value >= Number.MAX_SAFE_INTEGER) {
    throw new Error(`KnowThat ${label} exhausted`);
  }
  return value + 1;
}

const CATEGORY_PRIORITY: Readonly<Record<KnowThatCategoryV1, number>> =
  Object.freeze({
    rule: 7,
    project_fact: 6,
    preference: 5,
    user_profile: 4,
    relationship_state: 3,
    self_state: 2,
    world_state: 1,
  });

function compareTuple(
  left: KnowThatQueryCursorTupleV1,
  right: KnowThatQueryCursorTupleV1,
): number {
  return (
    right.category_priority - left.category_priority ||
    right.query_rank - left.query_rank ||
    right.updated_at.localeCompare(left.updated_at) ||
    left.fact_id.localeCompare(right.fact_id)
  );
}

function tupleFor(
  fact: KnowThatFactV1,
  query: string | null,
): KnowThatQueryCursorTupleV1 {
  const haystack =
    `${fact.text}\n${fact.subject}\n${fact.predicate}\n${fact.object}`.toLocaleLowerCase(
      "en-US",
    );
  const queryRank =
    query === null ? 0 : haystack.includes(query.toLocaleLowerCase("en-US")) ? 1 : 0;
  return {
    category_priority: CATEGORY_PRIORITY[fact.category],
    query_rank: queryRank,
    updated_at: fact.updated_at,
    fact_id: fact.id,
  };
}

function eventFor(
  fact: KnowThatFactV1,
  eventType: KnowThatEventV1["event_type"],
  payload: Readonly<Record<string, unknown>>,
  traceId: string,
  now: Date,
  target: KnowThatEventV1["target"] = "knowthat.projection",
): KnowThatEventV1 {
  const idempotencyKey = [
    eventType,
    fact.bot_id,
    fact.id,
    fact.state_version,
    payload.revision_id ?? "",
  ].join(":");
  const inner = Object.freeze({ ...scopeOf(fact), ...payload });
  return immutable({
    ...scopeOf(fact),
    event_id: deterministicIdV1("knowthat_event", idempotencyKey),
    event_type: eventType,
    schema_version: "knowthat_event.v1",
    producer: "knowthat",
    occurred_at: now.toISOString(),
    idempotency_key: idempotencyKey,
    trace_id: traceId,
    payload: inner,
    payload_hash: canonicalHashV1(inner),
    target,
    status: "pending",
    attempt_count: 0,
    next_retry_at: null,
    claim_token: null,
    locked_until: null,
  });
}

function appendEvent(state: StoreStateV1, event: KnowThatEventV1): void {
  const existingId = state.eventByIdempotency.get(event.idempotency_key);
  if (existingId !== undefined) {
    const existing = state.events.get(existingId);
    if (existing === undefined || canonicalHashV1(existing) !== canonicalHashV1(event)) {
      throw new Error("KnowThat event idempotency drift");
    }
    return;
  }
  if (event.target === ("observation_gateway" as never)) {
    throw new Error("KnowThat observation outbox target is forbidden");
  }
  state.events.set(event.event_id, event);
  state.eventByIdempotency.set(event.idempotency_key, event.event_id);
}

function eventEnvelope(event: KnowThatEventV1): KnowThatEventEnvelopeV1 {
  return immutable({
    event_id: event.event_id,
    event_type: event.event_type,
    schema_version: event.schema_version,
    producer: event.producer,
    occurred_at: event.occurred_at,
    idempotency_key: event.idempotency_key,
    trace_id: event.trace_id,
    payload: event.payload as KnowThatEventEnvelopeV1["payload"],
  });
}

function appendAudit(
  state: StoreStateV1,
  aggregateId: string,
  action: string,
  actor: string,
  reason: string,
  stateVersion: number | null,
  now: Date,
): void {
  state.audits.push(
    immutable({
      id: deterministicIdV1("knowthat_audit", {
        aggregateId,
        action,
        actor,
        reason,
        stateVersion,
      }),
      aggregate_id: aggregateId,
      action,
      actor,
      reason,
      state_version: stateVersion,
      created_at: now.toISOString(),
    }),
  );
}

function conflictDomain(
  category: KnowThatCategoryV1,
): ConflictPolicyV1["domain"] {
  switch (category) {
    case "world_state":
      return "runtime_fact";
    case "preference":
      return "personal_preference";
    case "relationship_state":
      return "relationship_state";
    case "project_fact":
      return "project_decision";
    case "rule":
      return "rule";
    case "user_profile":
    case "self_state":
      return "unclassified";
  }
}

function projectionAtRevision(
  state: StoreStateV1,
  factId: string,
  revision: number,
): KnowThatFactV1 | undefined {
  return state.projections
    .get(factId)
    ?.find(
      (entry) =>
        entry.visible_from_revision <= revision &&
        (entry.visible_until_revision === null ||
          entry.visible_until_revision > revision),
    )?.fact;
}

export function createInMemoryKnowThatStoreV1(
  config: KnowThatConfigV1,
  seed: KnowThatStoreSeedV1 = {},
): KnowThatStorePortV1 & { inspect(): KnowThatStoreInspectionV1 } {
  let state = initialState();
  for (const fact of seed.facts ?? []) {
    const stored = immutable(fact);
    state.facts.set(stored.id, stored);
    state.factBySourceSlot.set(
      sourceSlot(stored, stored.semantic_key, stored.source_ref),
      stored.id,
    );
    if (stored.status === "active") {
      state.activeBySlot.set(slot(stored, stored.semantic_key), stored.id);
    }
  }
  for (const revision of seed.revisions ?? []) {
    const revisions = state.revisions.get(revision.fact_id) ?? [];
    revisions.push(immutable(revision));
    revisions.sort((left, right) => left.revision_no - right.revision_no);
    state.revisions.set(revision.fact_id, revisions);
  }
  for (const conflict of seed.conflicts ?? []) {
    const stored = immutable(conflict);
    state.conflicts.set(stored.id, stored);
    state.conflictByKey.set(scoped(stored, stored.conflict_key), stored.id);
  }
  for (const event of seed.events ?? []) {
    const stored = immutable(event);
    state.events.set(stored.event_id, stored);
    state.eventByIdempotency.set(stored.idempotency_key, stored.event_id);
  }
  for (const job of seed.linkage_jobs ?? []) {
    const stored = immutable(job);
    state.linkageJobs.set(stored.id, stored);
    state.linkageByIdempotency.set(
      scoped(stored, stored.idempotency_key),
      stored.id,
    );
  }
  for (const [key, revision] of Object.entries(seed.query_revisions ?? {})) {
    state.queryRevisions.set(key, revision);
  }
  for (const version of seed.projection_versions ?? []) {
    const versions = state.projections.get(version.fact.id) ?? [];
    versions.push({
      fact: immutable(version.fact),
      visible_from_revision: version.visible_from_revision,
      visible_until_revision: version.visible_until_revision,
    });
    versions.sort(
      (left, right) =>
        left.visible_from_revision - right.visible_from_revision,
    );
    state.projections.set(version.fact.id, versions);
  }
  if ((seed.projection_versions?.length ?? 0) === 0) {
    for (const fact of state.facts.values()) {
      state.projections.set(fact.id, [
        {
          fact,
          visible_from_revision: 1,
          visible_until_revision: null,
        },
      ]);
    }
  }

  const currentRevision = (candidate: StoreStateV1, scope: KnowThatScopeV1) =>
    candidate.queryRevisions.get(scopeKey(scope)) ?? 1;

  const project = (
    candidate: StoreStateV1,
    fact: KnowThatFactV1,
    revision: number,
  ) => {
    const versions = candidate.projections.get(fact.id) ?? [];
    const current = versions.find((entry) => entry.visible_until_revision === null);
    if (current !== undefined) {
      if (current.visible_from_revision === revision) {
        current.fact = immutable(fact);
        return;
      }
      current.visible_until_revision = revision;
    }
    versions.push({
      fact: immutable(fact),
      visible_from_revision: revision,
      visible_until_revision: null,
    });
    candidate.projections.set(fact.id, versions);
  };

  const appendRevision = (
    candidate: StoreStateV1,
    fact: KnowThatFactV1,
    patch: Readonly<Record<string, unknown>>,
    reason: string,
    actor: string,
    now: Date,
  ): KnowThatFactRevisionV1 => {
    const revisions = candidate.revisions.get(fact.id) ?? [];
    const revision: KnowThatFactRevisionV1 = immutable({
      id: deterministicIdV1("knowthat_revision", {
        fact_id: fact.id,
        revision_no: revisions.length + 1,
      }),
      fact_id: fact.id,
      revision_no: revisions.length + 1,
      patch: Object.freeze({ schema_version: "knowthat_fact_patch.v1", ...patch }),
      reason,
      actor,
      created_at: now.toISOString(),
    });
    revisions.push(revision);
    candidate.revisions.set(fact.id, revisions);
    return revision;
  };

  const enqueueLinkage = (
    candidate: StoreStateV1,
    fact: KnowThatFactV1,
    operation: KnowThatLinkageJobV1["operation"],
    traceId: string,
    now: Date,
  ): string => {
    const idempotencyKey = `knowthat-linkage:${fact.id}:${fact.state_version}:${operation}`;
    const existing = candidate.linkageByIdempotency.get(
      scoped(fact, idempotencyKey),
    );
    if (existing !== undefined) return existing;
    const id = deterministicIdV1("knowthat_linkage", {
      scope: scopeOf(fact),
      idempotencyKey,
    });
    const job: KnowThatLinkageJobV1 = immutable({
      ...scopeOf(fact),
      id,
      fact_id: fact.id,
      check_type: "post_promotion_linkage_propagation",
      target_service: "memory",
      operation,
      evidence_refs: fact.evidence_refs,
      idempotency_key: idempotencyKey,
      status: "pending",
      attempt_count: 0,
      next_retry_at: null,
      lease_generation: 0,
      claim_token: null,
      locked_by: null,
      locked_until: null,
      last_error: null,
      job_version: 1,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    });
    candidate.linkageJobs.set(id, job);
    candidate.linkageByIdempotency.set(scoped(fact, idempotencyKey), id);
    appendEvent(
      candidate,
      eventFor(
        fact,
        "knowthat.linkage_check.requested",
        {
          linkage_check_id: id,
          source_service: "knowthat",
          source_ref: `knowthat_linkage_check:${id}`,
          source_fact_id: fact.id,
          source_linkage_check_id: id,
          check_type: job.check_type,
          operation,
          linked_memory_point_ids: [],
          reason: `fact_${operation}`,
          evidence_refs: fact.evidence_refs,
        },
        traceId,
        now,
        "memory.linkage",
      ),
    );
    return id;
  };

  const expireFact = (
    candidate: StoreStateV1,
    fact: KnowThatFactV1,
    revision: number,
    actor: string,
    reason: string,
    traceId: string,
    now: Date,
  ): KnowThatFactV1 => {
    if (fact.status !== "active") return fact;
    const next: KnowThatFactV1 = immutable({
      ...fact,
      status: "expired",
      state_version: nextSafe(fact.state_version, "fact state version"),
      updated_at: now.toISOString(),
    });
    const factRevision = appendRevision(
      candidate,
      next,
      { previous_status: "active", current_status: "expired" },
      reason,
      actor,
      now,
    );
    candidate.facts.set(next.id, next);
    candidate.activeBySlot.delete(slot(next, next.semantic_key));
    project(candidate, next, revision);
    appendEvent(
      candidate,
      eventFor(
        next,
        "knowthat.fact.expired",
        {
          fact_id: next.id,
          semantic_key: next.semantic_key,
          category: next.category,
          previous_status: "active",
          current_status: "expired",
          revision_id: factRevision.id,
          source_ref: next.source_ref,
        },
        traceId,
        now,
      ),
    );
    enqueueLinkage(candidate, next, "mark_historical", traceId, now);
    appendAudit(
      candidate,
      next.id,
      "fact_expired",
      actor,
      reason,
      next.state_version,
      now,
    );
    return next;
  };

  const createConflict = (
    candidate: StoreStateV1,
    left: KnowThatFactV1,
    right: KnowThatFactV1,
    traceId: string,
    now: Date,
    rightDirectActiveEligible = false,
  ): KnowThatConflictV1 => {
    const conflictKey = canonicalHashV1({
      semantic_key: left.semantic_key,
      left_fact_id: left.id,
      right_fact_id: right.id,
      conflict_type: "value_contradiction",
    });
    const scopedKey = scoped(left, conflictKey);
    const existingId = candidate.conflictByKey.get(scopedKey);
    if (existingId !== undefined) return candidate.conflicts.get(existingId)!;
    const canonicalDecision = evaluateKnowThatCanonicalConflictV1(left, right);
    const policy = canonicalDecision.policy;
    const preserveExistingAutoResolution =
      left.status === "active" &&
      left.category !== "rule" &&
      policy.auto_resolution_eligible &&
      canonicalDecision.left_rank > canonicalDecision.right_rank;
    const replaceExistingAutoResolution =
      left.status === "active" &&
      right.status === "candidate" &&
      left.category !== "rule" &&
      policy.auto_resolution_eligible &&
      canonicalDecision.right_rank > canonicalDecision.left_rank &&
      rightDirectActiveEligible;
    const autoResolved =
      preserveExistingAutoResolution || replaceExistingAutoResolution;
    const id = deterministicIdV1("knowthat_conflict", {
      scope: scopeOf(left),
      conflictKey,
    });
    const conflict: KnowThatConflictV1 = immutable({
      ...scopeOf(left),
      id,
      conflict_key: conflictKey,
      semantic_key: left.semantic_key,
      left_fact_id: left.id,
      right_fact_id: right.id,
      conflict_type: "value_contradiction",
      source_priority_snapshot: Object.freeze({
        schema_version: "knowthat_conflict_priority_snapshot.v1",
        policy,
        left: {
          source: left.source,
          source_ref: left.source_ref,
          rank: canonicalDecision.left_rank,
          confidence: left.confidence,
        },
        right: {
          source: right.source,
          source_ref: right.source_ref,
          rank: canonicalDecision.right_rank,
          confidence: right.confidence,
        },
        rank_source: canonicalDecision.rank_source,
      }),
      confidence_delta: Math.abs(left.confidence - right.confidence),
      evidence_refs: Object.freeze([
        ...new Set([...left.evidence_refs, ...right.evidence_refs]),
      ]),
      status: autoResolved ? "auto_resolved" : "open",
      proposed_resolution: Object.freeze({
        schema_version: "knowthat_conflict_resolution.v1",
        action: preserveExistingAutoResolution
          ? "preserve_existing_active"
          : replaceExistingAutoResolution
            ? "expire_existing_activate_candidate"
            : "review",
        ...(left.status === "active"
          ? { preserve_active_fact_id: left.id }
          : {}),
      }),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    });
    candidate.conflicts.set(id, conflict);
    candidate.conflictByKey.set(scopedKey, id);
    appendEvent(
      candidate,
      eventFor(
        right,
        "knowthat.conflict.detected",
        {
          conflict_id: id,
          left_fact_id: left.id,
          right_fact_id: right.id,
          semantic_key: right.semantic_key,
          conflict_type: conflict.conflict_type,
          source_priority_snapshot: conflict.source_priority_snapshot,
          confidence_delta: conflict.confidence_delta,
          status: conflict.status,
          proposed_resolution: conflict.proposed_resolution,
        },
        traceId,
        now,
      ),
    );
    appendAudit(
      candidate,
      id,
      "conflict_detected",
      "knowthat",
      autoResolved
        ? replaceExistingAutoResolution
          ? "canonical_policy_replaced_existing_active"
          : "canonical_policy_preserved_existing_active"
        : "value_contradiction",
      null,
      now,
    );
    return conflict;
  };

  const createFact = (
    candidate: StoreStateV1,
    request: KnowThatWriteBatchRequestV1,
    batchId: string,
    item: KnowThatWriteItemV1,
    forcedCandidate: boolean,
    revision: number,
    now: Date,
  ): Readonly<{
    fact: KnowThatFactV1;
    decision_reason: string;
    linkage_ids: readonly string[];
  }> => {
    const identity = semanticIdentityV1({
      bot_id: request.bot_id,
      category: item.category,
      subject: item.subject,
      predicate: item.predicate,
      object: item.object,
    });
    const direct = evaluateKnowThatDirectActivePolicyV1({
      item,
      forced_candidate: forcedCandidate,
    });
    const status: "active" | "candidate" =
      forcedCandidate ? "candidate" : direct.status;
    const id = deterministicIdV1("knowthat_fact", {
      scope: scopeOf(request),
      semantic_key: identity.semantic_key,
      source_ref: item.source_ref,
    });
    const fact: KnowThatFactV1 = immutable({
      ...scopeOf(request),
      id,
      text: item.text,
      subject: item.subject,
      predicate: item.predicate,
      object: item.object,
      normalized_object: identity.normalized_object,
      object_hash: identity.object_hash,
      canonicalization_version: "knowthat.semantic_key.v1",
      semantic_key_display: identity.semantic_key_display,
      semantic_key: identity.semantic_key,
      category: item.category,
      status,
      confidence: item.confidence,
      source: item.source,
      source_ref: item.source_ref,
      evidence_refs: Object.freeze([...item.evidence_refs]),
      valid_from: item.valid_from ?? null,
      valid_until: item.valid_until ?? null,
      evidence_pending: item.evidence_pending,
      evidence_pending_reason: item.evidence_pending_reason ?? null,
      risk_level: item.risk_level,
      explicitness: item.explicitness,
      origin_write_batch_id: batchId,
      origin_client_item_id: item.client_item_id,
      state_version: 1,
      candidate_version: 1,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    });
    candidate.facts.set(id, fact);
    candidate.factBySourceSlot.set(
      sourceSlot(fact, fact.semantic_key, fact.source_ref),
      id,
    );
    if (status === "active") {
      candidate.activeBySlot.set(slot(fact, fact.semantic_key), id);
    }
    const initialRevision = appendRevision(
      candidate,
      fact,
      {
        current_status: status,
        evidence_pending: fact.evidence_pending,
        object_hash: fact.object_hash,
      },
      "fact_created",
      "meta_cognition",
      now,
    );
    project(candidate, fact, revision);
    appendEvent(
      candidate,
      eventFor(
        fact,
        "knowthat.fact.created",
        {
          fact_id: fact.id,
          semantic_key: fact.semantic_key,
          category: fact.category,
          current_status: fact.status,
          revision_id: initialRevision.id,
          source_ref: fact.source_ref,
        },
        request.trace_id,
        now,
      ),
    );
    appendAudit(
      candidate,
      fact.id,
      "fact_created",
      "meta_cognition",
      forcedCandidate ? "batch_conflict_fail_safe" : direct.reason_code,
      fact.state_version,
      now,
    );
    if (
      item.semantic_key_candidate !== undefined &&
      item.semantic_key_candidate !== identity.semantic_key_display
    ) {
      appendAudit(
        candidate,
        fact.id,
        "semantic_key_hint_mismatch",
        "meta_cognition",
        "caller_hint_did_not_match_canonical_display_key",
        fact.state_version,
        now,
      );
    }
    const linkageIds =
      status === "active"
        ? [enqueueLinkage(candidate, fact, "append_version", request.trace_id, now)]
        : [];
    return {
      fact,
      decision_reason: forcedCandidate
        ? "batch_conflict_requires_review"
        : direct.reason_code,
      linkage_ids: Object.freeze(linkageIds),
    };
  };

  const store: KnowThatStorePortV1 & {
    inspect(): KnowThatStoreInspectionV1;
  } = {
    async writeBatch(request, requestHash, now) {
      const batchKey = scoped(request, request.idempotency_key);
      const existing = state.batches.get(batchKey);
      if (existing !== undefined) {
        if (existing.request_hash !== requestHash) {
          throw new KnowThatErrorV1(
            "idempotency_conflict",
            "KnowThat batch idempotency key drifted",
            false,
          );
        }
        return immutable({
          ...existing.response,
          duplicate_replayed: true,
          item_results: existing.response.item_results.map((item) =>
            item.status === "succeeded"
              ? { ...item, duplicate_replayed: true }
              : item,
          ),
        });
      }

      const draft = clone(state);
      const batchId = deterministicIdV1("knowthat_batch", {
        scope: scopeOf(request),
        idempotency_key: request.idempotency_key,
      });
      const revision = nextSafe(
        currentRevision(draft, request),
        "query revision",
      );
      let visibleMutation = false;
      const prepared = request.items.map((item) => {
        try {
          return {
            item,
            identity: semanticIdentityV1({
              bot_id: request.bot_id,
              category: item.category,
              subject: item.subject,
              predicate: item.predicate,
              object: item.object,
            }),
          };
        } catch {
          return { item, identity: null };
        }
      });
      const distinctObjectsByKey = new Map<string, Set<string>>();
      for (const entry of prepared) {
        if (entry.identity === null) continue;
        const objects =
          distinctObjectsByKey.get(entry.identity.semantic_key) ?? new Set();
        objects.add(entry.identity.object_hash);
        distinctObjectsByKey.set(entry.identity.semantic_key, objects);
      }
      prepared.sort((left, right) => {
        const leftKey = left.identity?.semantic_key ?? `~${left.item.client_item_id}`;
        const rightKey =
          right.identity?.semantic_key ?? `~${right.item.client_item_id}`;
        const keyOrder = leftKey.localeCompare(rightKey);
        if (keyOrder !== 0 || left.identity === null || right.identity === null) {
          return (
            keyOrder ||
            left.item.client_item_id.localeCompare(right.item.client_item_id)
          );
        }
        const explicitnessRank = Object.freeze({
          explicit_statement: 4,
          strong_implication: 3,
          weak_implication: 2,
          inferred: 1,
        });
        const riskRank = Object.freeze({
          critical: 4,
          high: 3,
          medium: 2,
          low: 1,
        });
        return (
          knowThatCanonicalSourceRankV1(
            right.item.category,
            right.item.source,
          ) -
            knowThatCanonicalSourceRankV1(
              left.item.category,
              left.item.source,
            ) ||
          right.item.confidence - left.item.confidence ||
          explicitnessRank[right.item.explicitness] -
            explicitnessRank[left.item.explicitness] ||
          riskRank[right.item.risk_level] - riskRank[left.item.risk_level] ||
          left.item.client_item_id.localeCompare(right.item.client_item_id)
        );
      });

      const results: (KnowThatAcceptedItemV1 | KnowThatRejectedItemV1)[] = [];
      const batchRepresentatives = new Map<string, KnowThatFactV1>();
      for (const entry of prepared) {
        const item = entry.item;
        const identity = entry.identity;
        if (identity === null) {
          results.push({
            client_item_id: item.client_item_id,
            status: "rejected",
            code: "semantic_component_empty",
            message: "A semantic component normalized to empty",
            field_path: `/items/${item.client_item_id}`,
          });
          continue;
        }
        const sourceKey = sourceSlot(
          request,
          identity.semantic_key,
          item.source_ref,
        );
        const existingSourceId = draft.factBySourceSlot.get(sourceKey);
        if (existingSourceId !== undefined) {
          const existingFact = draft.facts.get(existingSourceId)!;
          if (
            existingFact.object_hash !== identity.object_hash ||
            (existingFact.status !== "active" &&
              existingFact.status !== "candidate")
          ) {
            results.push({
              client_item_id: item.client_item_id,
              status: "rejected",
              code:
                existingFact.status === "active" ||
                existingFact.status === "candidate"
                  ? "source_ref_object_drift"
                  : "terminal_source_identity",
              message:
                "The source identity cannot be reused for this fact value",
            });
            continue;
          }
          results.push({
            client_item_id: item.client_item_id,
            status: "succeeded",
            semantic_key: existingFact.semantic_key,
            final_status: existingFact.status,
            fact_id: existingFact.id,
            decision_reason: "exact_item_replay",
            representative_client_item_id:
              existingFact.origin_client_item_id,
            group_role: "merged",
            linkage_check_ids: [],
            duplicate_replayed: true,
          });
          continue;
        }

        const activeId = draft.activeBySlot.get(
          slot(request, identity.semantic_key),
        );
        let active = activeId === undefined ? undefined : draft.facts.get(activeId);
        if (
          active !== undefined &&
          active.valid_until !== null &&
          Date.parse(active.valid_until) <= now.getTime()
        ) {
          expireFact(
            draft,
            active,
            revision,
            "knowthat.write_batch",
            "targeted_validity_expiration",
            request.trace_id,
            now,
          );
          visibleMutation = true;
          active = undefined;
        }

        if (active !== undefined && active.object_hash === identity.object_hash) {
          const mergedEvidence = [
            ...new Set([...active.evidence_refs, ...item.evidence_refs]),
          ];
          const changed =
            mergedEvidence.length !== active.evidence_refs.length ||
            item.confidence > active.confidence;
          let merged = active;
          const linkageIds: string[] = [];
          if (changed) {
            merged = immutable({
              ...active,
              evidence_refs: Object.freeze(mergedEvidence),
              confidence: Math.max(active.confidence, item.confidence),
              state_version: nextSafe(
                active.state_version,
                "fact state version",
              ),
              updated_at: now.toISOString(),
            });
            const factRevision = appendRevision(
              draft,
              merged,
              {
                confidence: merged.confidence,
                evidence_refs: merged.evidence_refs,
              },
              "consistent_evidence_merge",
              "meta_cognition",
              now,
            );
            draft.facts.set(merged.id, merged);
            project(draft, merged, revision);
            appendEvent(
              draft,
              eventFor(
                merged,
                "knowthat.fact.updated",
                {
                  fact_id: merged.id,
                  semantic_key: merged.semantic_key,
                  category: merged.category,
                  previous_status: "active",
                  current_status: "active",
                  revision_id: factRevision.id,
                  source_ref: merged.source_ref,
                },
                request.trace_id,
                now,
              ),
            );
            linkageIds.push(
              enqueueLinkage(
                draft,
                merged,
                "append_version",
                request.trace_id,
                now,
              ),
            );
            visibleMutation = true;
          }
          draft.factBySourceSlot.set(sourceKey, merged.id);
          results.push({
            client_item_id: item.client_item_id,
            status: "succeeded",
            semantic_key: merged.semantic_key,
            final_status: "active",
            fact_id: merged.id,
            decision_reason: changed
              ? "consistent_evidence_merged"
              : "consistent_fact_replayed",
            representative_client_item_id: merged.origin_client_item_id,
            group_role: "merged",
            linkage_check_ids: Object.freeze(linkageIds),
            duplicate_replayed: !changed,
          });
          continue;
        }

        const created = createFact(
          draft,
          request,
          batchId,
          item,
          active !== undefined ||
            (distinctObjectsByKey.get(identity.semantic_key)?.size ?? 0) > 1,
          revision,
          now,
        );
        visibleMutation = true;
        let conflict: KnowThatConflictV1 | undefined;
        let finalFact = created.fact;
        const finalLinkageIds = [...created.linkage_ids];
        if (active !== undefined) {
          conflict = createConflict(
            draft,
            active,
            created.fact,
            request.trace_id,
            now,
            evaluateKnowThatDirectActivePolicyV1({
              item,
              forced_candidate: false,
            }).status === "active",
          );
          if (
            conflict.status === "auto_resolved" &&
            conflict.proposed_resolution.action ===
              "expire_existing_activate_candidate"
          ) {
            expireFact(
              draft,
              active,
              revision,
              "knowthat.write_batch",
              "canonical_conflict_supersession",
              request.trace_id,
              now,
            );
            finalFact = immutable({
              ...created.fact,
              status: "active",
              state_version: nextSafe(
                created.fact.state_version,
                "fact state version",
              ),
              candidate_version: nextSafe(
                created.fact.candidate_version,
                "candidate version",
              ),
              updated_at: now.toISOString(),
            });
            const promotionRevision = appendRevision(
              draft,
              finalFact,
              {
                previous_status: "candidate",
                current_status: "active",
                superseded_fact_id: active.id,
                conflict_id: conflict.id,
              },
              "canonical_conflict_supersession",
              "knowthat",
              now,
            );
            draft.facts.set(finalFact.id, finalFact);
            draft.activeBySlot.set(
              slot(finalFact, finalFact.semantic_key),
              finalFact.id,
            );
            project(draft, finalFact, revision);
            appendEvent(
              draft,
              eventFor(
                finalFact,
                "knowthat.candidate.promoted",
                {
                  candidate_id: finalFact.id,
                  fact_id: finalFact.id,
                  decision: "promoted",
                  reason: "canonical_conflict_supersession",
                  evidence_refs: finalFact.evidence_refs,
                },
                request.trace_id,
                now,
              ),
            );
            finalLinkageIds.push(
              enqueueLinkage(
                draft,
                finalFact,
                "append_version",
                request.trace_id,
                now,
              ),
            );
            appendAudit(
              draft,
              finalFact.id,
              "conflict_supersession_applied",
              "knowthat",
              conflict.id,
              finalFact.state_version,
              now,
            );
          }
        } else if (
          (distinctObjectsByKey.get(identity.semantic_key)?.size ?? 0) > 1
        ) {
          const representative = batchRepresentatives.get(
            identity.semantic_key,
          );
          if (
            representative !== undefined &&
            representative.object_hash !== created.fact.object_hash
          ) {
            conflict = createConflict(
              draft,
              representative,
              created.fact,
              request.trace_id,
              now,
            );
          } else if (representative === undefined) {
            batchRepresentatives.set(identity.semantic_key, created.fact);
          }
        }
        results.push({
          client_item_id: item.client_item_id,
          status: "succeeded",
          semantic_key: finalFact.semantic_key,
          final_status: finalFact.status as "active" | "candidate",
          fact_id: finalFact.id,
          decision_reason:
            finalFact.status === "active" && created.fact.status === "candidate"
              ? "canonical_conflict_supersession"
              : created.decision_reason,
          representative_client_item_id: item.client_item_id,
          group_role: conflict === undefined ? "representative" : "conflict",
          ...(conflict === undefined ? {} : { conflict_id: conflict.id }),
          linkage_check_ids: Object.freeze(finalLinkageIds),
          duplicate_replayed: false,
        });
      }

      if (visibleMutation) {
        draft.queryRevisions.set(scopeKey(request), revision);
      }
      const rejected = results.filter(
        (result): result is KnowThatRejectedItemV1 =>
          result.status === "rejected",
      );
      const accepted = results.filter(
        (result): result is KnowThatAcceptedItemV1 =>
          result.status === "succeeded",
      );
      const response: KnowThatWriteBatchResponseV1 = immutable({
        schema_version: "knowthat.write_batch.v1",
        write_batch_id: batchId,
        batch_status: rejected.length === 0 ? "completed" : "partial_failed",
        item_results: results,
        active_fact_ids: [
          ...new Set(
            accepted
              .filter((item) => item.final_status === "active")
              .map((item) => item.fact_id),
          ),
        ],
        candidate_fact_ids: [
          ...new Set(
            accepted
              .filter((item) => item.final_status === "candidate")
              .map((item) => item.fact_id),
          ),
        ],
        rejected_items: rejected,
        conflict_ids: [
          ...new Set(
            accepted.flatMap((item) =>
              item.conflict_id === undefined ? [] : [item.conflict_id],
            ),
          ),
        ],
        linkage_check_ids: [
          ...new Set(accepted.flatMap((item) => item.linkage_check_ids)),
        ],
        duplicate_replayed: false,
      });
      draft.batches.set(
        batchKey,
        immutable({ request_hash: requestHash, request, response }),
      );
      state = draft;
      return response;
    },

    async readFact(scope, factId) {
      const fact = state.facts.get(factId);
      return fact === undefined || !sameKnowThatScopeV1(scope, fact)
        ? undefined
        : immutable(fact);
    },

    async currentRevision(scope) {
      return currentRevision(state, scope);
    },

    async minimumReplayableRevision(scope) {
      return Math.max(
        1,
        currentRevision(state, scope) - config.replay_revision_window + 1,
      );
    },

    async queryAt(input) {
      const current = currentRevision(state, input.scope);
      const minimum = Math.max(
        1,
        current - config.replay_revision_window + 1,
      );
      if (input.revision < minimum || input.revision > current) {
        throw new KnowThatErrorV1(
          "snapshot_expired",
          "KnowThat query revision is not replayable",
          true,
        );
      }
      const categories = new Set(input.categories);
      const candidates: Array<{
        fact: KnowThatFactV1;
        tuple: KnowThatQueryCursorTupleV1;
      }> = [];
      for (const [factId] of state.projections) {
        const fact = projectionAtRevision(state, factId, input.revision);
        if (
          fact === undefined ||
          !sameKnowThatScopeV1(input.scope, fact) ||
          fact.status !== "active" ||
          (categories.size > 0 && !categories.has(fact.category)) ||
          (fact.valid_from !== null &&
            Date.parse(fact.valid_from) > input.as_of.getTime()) ||
          (fact.valid_until !== null &&
            Date.parse(fact.valid_until) <= input.as_of.getTime())
        ) {
          continue;
        }
        const tuple = tupleFor(fact, input.query);
        if (input.query !== null && tuple.query_rank === 0) continue;
        candidates.push({ fact, tuple });
      }
      candidates.sort((left, right) => compareTuple(left.tuple, right.tuple));
      const afterIndex =
        input.after === null
          ? 0
          : candidates.findIndex(
              (entry) =>
                canonicalHashV1(entry.tuple) === canonicalHashV1(input.after),
            ) + 1;
      if (input.after !== null && afterIndex === 0) {
        throw new KnowThatErrorV1(
          "invalid_cursor",
          "KnowThat cursor tuple is not present in the snapshot",
          false,
        );
      }
      const page = candidates.slice(afterIndex, afterIndex + input.limit + 1);
      const hasMore = page.length > input.limit;
      const selected = hasMore ? page.slice(0, input.limit) : page;
      return immutable({
        facts: selected.map(({ fact }) => ({
          id: fact.id,
          semantic_key: fact.semantic_key,
          category: fact.category,
          subject: fact.subject,
          predicate: fact.predicate,
          object: fact.object,
          confidence: fact.confidence,
          ...(fact.valid_from === null
            ? {}
            : { valid_from: fact.valid_from }),
          ...(fact.valid_until === null
            ? {}
            : { valid_until: fact.valid_until }),
          updated_at: fact.updated_at,
        })),
        next: hasMore ? selected.at(-1)!.tuple : null,
      });
    },

    async reviewCandidate({
      candidate_id,
      request,
      request_hash,
      promotion_evidence,
      promotion_reservation,
      now,
    }) {
      const reviewKey = scoped(request, request.idempotency_key);
      const existing = state.reviews.get(reviewKey);
      if (existing !== undefined) {
        if (existing.request_hash !== request_hash) {
          throw new KnowThatErrorV1(
            "idempotency_conflict",
            "KnowThat review idempotency key drifted",
            false,
          );
        }
        return immutable({
          result: {
            ...existing.result,
            duplicate_replayed: true,
          },
          promotion_ack_command:
            existing.promotion_ack_command === null
              ? null
              : ((state.memoryCommands.get(
                  existing.promotion_ack_command.id,
                ) as PromotionAckCommandV1 | undefined) ??
                existing.promotion_ack_command),
          promotion_release_command:
            existing.promotion_release_command === null ||
            existing.promotion_release_command === undefined
              ? null
              : ((state.memoryCommands.get(
                  existing.promotion_release_command.id,
                ) as PromotionReleaseCommandV1 | undefined) ??
                existing.promotion_release_command),
        });
      }
      if (promotion_reservation !== null) {
        const priorRelease = state.memoryCommands.get(
          promotionReleaseCommandIdV1(request, promotion_reservation),
        );
        if (priorRelease !== undefined) {
          if (
            priorRelease.command_type !== "promotion_reservation_release" ||
            !sameKnowThatScopeV1(priorRelease, request) ||
            priorRelease.reservation_id !==
              promotion_reservation.reservation_id ||
            priorRelease.candidate_fact_id !== candidate_id ||
            priorRelease.fencing_generation !==
              promotion_reservation.fencing_generation ||
            priorRelease.reservation_token_hash !==
              promotion_reservation.reservation_token_hash
          ) {
            throw new KnowThatErrorV1(
              "invalid_state",
              "KnowThat promotion release handoff identity drifted",
              false,
            );
          }
          throw new KnowThatErrorV1(
            "promotion_retry_required",
            "KnowThat promotion reservation already has a release handoff",
            true,
          );
        }
      }
      const suggestionKey = scoped(
        request,
        `${request.source_meta_job_id}:${request.suggestion_id}`,
      );
      const priorReviewKey = state.reviewBySuggestion.get(suggestionKey);
      if (priorReviewKey !== undefined && priorReviewKey !== reviewKey) {
        throw new KnowThatErrorV1(
          "idempotency_conflict",
          "KnowThat review suggestion was reused under another key",
          false,
        );
      }
      const draft = clone(state);
      const sourceEvent = request.source_event;
      const inboxEventKey = `${sourceEvent.source}:${sourceEvent.event_id}`;
      const inboxIdempotencyKey = `${sourceEvent.source}:${sourceEvent.idempotency_key}`;
      for (const prior of [
        draft.inboxByEvent.get(inboxEventKey),
        draft.inboxByIdempotency.get(inboxIdempotencyKey),
      ]) {
        if (
          prior !== undefined &&
          (prior.payload_hash !== sourceEvent.payload_hash ||
            prior.semantic_hash !== sourceEvent.semantic_hash ||
            prior.scope_fingerprint !== sourceEvent.scope_fingerprint)
        ) {
          throw new KnowThatErrorV1(
            "inbox_drift",
            "KnowThat review source event drifted",
            false,
          );
        }
      }
      const inbox: StoredInboxV1 = immutable({
        source: sourceEvent.source,
        event_id: sourceEvent.event_id,
        idempotency_key: sourceEvent.idempotency_key,
        payload_hash: sourceEvent.payload_hash,
        semantic_hash: sourceEvent.semantic_hash,
        scope_fingerprint: sourceEvent.scope_fingerprint,
        processed_at: now.toISOString(),
      });
      draft.inboxByEvent.set(inboxEventKey, inbox);
      draft.inboxByIdempotency.set(inboxIdempotencyKey, inbox);

      const fact = draft.facts.get(candidate_id);
      if (
        fact === undefined ||
        !sameKnowThatScopeV1(request, fact) ||
        fact.status !== "candidate"
      ) {
        throw new KnowThatErrorV1(
          "candidate_not_found",
          "KnowThat candidate was not found",
          false,
        );
      }
      const reviewId = deterministicIdV1("knowthat_review", {
        scope: scopeOf(request),
        idempotency_key: request.idempotency_key,
      });
      if (fact.candidate_version !== request.target_candidate_version) {
        const promotionReleaseCommand =
          promotion_reservation === null
            ? null
            : promotionReleaseCommandV1(
                request,
                promotion_reservation,
                "promotion_not_applied",
                now,
              );
        if (promotionReleaseCommand !== null) {
          draft.memoryCommands.set(
            promotionReleaseCommand.id,
            promotionReleaseCommand,
          );
        }
        const staleResult: KnowThatCandidateReviewResultV1 = immutable({
          review_id: reviewId,
          suggestion_id: request.suggestion_id,
          candidate_id,
          target_candidate_version: request.target_candidate_version,
          status: "stale_candidate_version",
          decision: request.suggested_action,
          linkage_check_ids: [],
          candidate_version_after: fact.candidate_version,
          duplicate_replayed: false,
          reason_code: "stale_candidate_version",
        });
        draft.reviews.set(
          reviewKey,
          immutable({
            request_hash,
            result: staleResult,
            promotion_ack_command: null,
            promotion_release_command: promotionReleaseCommand,
          }),
        );
        draft.reviewBySuggestion.set(suggestionKey, reviewKey);
        state = draft;
        return immutable({
          result: staleResult,
          promotion_ack_command: null,
          promotion_release_command: promotionReleaseCommand,
        });
      }

      const mergedEvidence = [
        ...new Set([...fact.evidence_refs, ...request.new_evidence_refs]),
      ];
      const evidenceChanged = mergedEvidence.length !== fact.evidence_refs.length;
      const effectiveConfidenceDelta = evidenceChanged
        ? request.confidence_delta
        : 0;
      const pendingCleared =
        fact.evidence_pending &&
        request.new_evidence_refs.some((ref) => ref.startsWith("memory_point:"));
      let nextStatus: KnowThatFactV1["status"] = fact.status;
      let decision: KnowThatCandidateReviewResultV1["decision"] =
        request.suggested_action;
      let reasonCode = "review_recorded";
      let promotionAllowed = false;
      if (request.suggested_action === "promote") {
        const evidencePending = fact.evidence_pending && !pendingCleared;
        const promotionEvidenceValid =
          promotion_evidence !== null &&
          promotion_evidence.candidate_fact_id === fact.id &&
          promotion_evidence.check_id.length > 0 &&
          Number.isSafeInteger(promotion_evidence.check_generation) &&
          promotion_evidence.check_generation >= 1 &&
          promotion_evidence.check_policy_version ===
            "memory.pre_promotion_policy.rev309" &&
          Number.isSafeInteger(
            promotion_evidence.independent_trigger_process_count,
          ) &&
          promotion_evidence.independent_trigger_process_count >= 0 &&
          (promotion_reservation === null ||
            (promotion_reservation.check_id ===
              promotion_evidence.check_id &&
              promotion_reservation.check_generation ===
                promotion_evidence.check_generation));
        const confirmationEvidence =
          promotionEvidenceValid &&
          promotion_evidence?.has_user_explicit_confirmation === true;
        const requiresConfirmation =
          fact.risk_level === "high" ||
          fact.risk_level === "critical" ||
          fact.category === "rule";
        const evidenceGate =
          promotionEvidenceValid &&
          (confirmationEvidence ||
            (!requiresConfirmation &&
              (promotion_evidence?.independent_trigger_process_count ??
                0) >= 2));
        const originBatch = [...draft.batches.values()].find(
          (batch) =>
            batch.response.write_batch_id === fact.origin_write_batch_id,
        );
        const originItem = originBatch?.request.items.find(
          (item) => item.client_item_id === fact.origin_client_item_id,
        );
        const fastTrack =
          originItem?.proposed_status === "active" &&
          originItem.direct_active_hint === false;
        const threshold =
          fact.risk_level === "high" ||
          fact.risk_level === "critical" ||
          fact.category === "rule"
            ? 0.9
            : fastTrack
              ? 0.8
              : 0.75;
        const hasOpenConflict = [...draft.conflicts.values()].some(
          (conflict) =>
            sameKnowThatScopeV1(fact, conflict) &&
            (conflict.left_fact_id === fact.id ||
              conflict.right_fact_id === fact.id) &&
            (conflict.status === "open" ||
              conflict.status === "feedback_requested"),
        );
        const reservedAt =
          promotion_reservation === null
            ? Number.NaN
            : Date.parse(promotion_reservation.reserved_at);
        const reservationExpiresAt =
          promotion_reservation === null
            ? Number.NaN
            : Date.parse(promotion_reservation.expires_at);
        const evidenceMemoryPointIds = mergedEvidence
          .filter((reference) =>
            reference.startsWith("memory_point:"),
          )
          .map((reference) =>
            reference.slice("memory_point:".length),
          )
          .sort();
        const reservedMemoryPointIds =
          promotion_reservation === null
            ? []
            : promotion_reservation.reserved_points
                .map((point) => point.memory_point_id)
                .sort();
        const reservationValid =
          promotion_reservation !== null &&
          promotion_reservation.status === "active" &&
          promotion_reservation.candidate_fact_id === fact.id &&
          promotion_reservation.check_id.length > 0 &&
          Number.isSafeInteger(
            promotion_reservation.check_generation,
          ) &&
          promotion_reservation.check_generation >= 1 &&
          /^sha256:[0-9a-f]{64}$/u.test(
            promotion_reservation.reservation_token_hash,
          ) &&
          Number.isSafeInteger(
            promotion_reservation.fencing_generation,
          ) &&
          promotion_reservation.fencing_generation >= 1 &&
          Number.isFinite(reservedAt) &&
          Number.isFinite(reservationExpiresAt) &&
          reservationExpiresAt > reservedAt &&
          reservationExpiresAt - reservedAt <= 15_000 &&
          reservedAt <= now.getTime() &&
          reservationExpiresAt > now.getTime() &&
          reservedMemoryPointIds.length > 0 &&
          new Set(reservedMemoryPointIds).size ===
            reservedMemoryPointIds.length &&
          canonicalHashV1(reservedMemoryPointIds) ===
            canonicalHashV1(evidenceMemoryPointIds);
        promotionAllowed =
          !evidencePending &&
          evidenceGate &&
          fact.confidence + effectiveConfidenceDelta >= threshold &&
          !hasOpenConflict &&
          reservationValid;
        if (!promotionAllowed) {
          decision =
            "keep_candidate";
          reasonCode = evidencePending
            ? "evidence_pending"
            : !evidenceGate
              ? "insufficient_independent_evidence"
              : hasOpenConflict
                ? "open_conflict"
                : promotion_reservation === null
                  ? "memory_promotion_reservation_required"
                  : !reservationValid
                    ? "memory_promotion_reservation_stale"
                    : "promotion_threshold_not_met";
        } else {
          const existingActive = draft.activeBySlot.get(
            slot(fact, fact.semantic_key),
          );
          if (existingActive !== undefined && existingActive !== fact.id) {
            decision = "keep_candidate";
            reasonCode = "active_slot_occupied";
          } else {
            nextStatus = "active";
            reasonCode = "promoted";
          }
        }
      } else if (request.suggested_action === "reject") {
        nextStatus = "rejected";
        reasonCode = "candidate_rejected";
      } else if (request.suggested_action === "expire") {
        nextStatus = "expired";
        reasonCode = "candidate_expired";
      } else if (request.suggested_action === "request_feedback") {
        reasonCode = "feedback_requested";
      } else {
        reasonCode = "candidate_kept";
      }

      const changed =
        evidenceChanged ||
        pendingCleared ||
        nextStatus !== fact.status ||
        effectiveConfidenceDelta !== 0;
      let next = fact;
      const linkageIds: string[] = [];
      let promotionAckCommand: PromotionAckCommandV1 | null = null;
      if (changed) {
        const revision = nextSafe(
          currentRevision(draft, request),
          "query revision",
        );
        next = immutable({
          ...fact,
          evidence_refs: Object.freeze(mergedEvidence),
          evidence_pending: pendingCleared ? false : fact.evidence_pending,
          evidence_pending_reason: pendingCleared
            ? null
            : fact.evidence_pending_reason,
          confidence: Math.max(
            0,
            Math.min(1, fact.confidence + effectiveConfidenceDelta),
          ),
          status: nextStatus,
          candidate_version: nextSafe(
            fact.candidate_version,
            "candidate version",
          ),
          state_version: nextSafe(fact.state_version, "fact state version"),
          updated_at: now.toISOString(),
        });
        const factRevision = appendRevision(
          draft,
          next,
          {
            evidence_refs: next.evidence_refs,
            evidence_pending: next.evidence_pending,
            confidence: next.confidence,
            previous_status: fact.status,
            current_status: next.status,
            ...(next.status === "active" &&
            promotion_reservation !== null
              ? {
                  promotion_check_id:
                    promotion_reservation.check_id,
                  promotion_check_generation:
                    promotion_reservation.check_generation,
                  promotion_reservation_id:
                    promotion_reservation.reservation_id,
                  promotion_fence_generation:
                    promotion_reservation.fencing_generation,
                  promotion_reservation_token_hash:
                    promotion_reservation.reservation_token_hash,
                  promotion_reservation_expires_at:
                    promotion_reservation.expires_at,
                  promotion_committed_at: now.toISOString(),
                }
              : {}),
          },
          reasonCode,
          "meta_cognition",
          now,
        );
        draft.facts.set(next.id, next);
        if (next.status === "active") {
          draft.activeBySlot.set(slot(next, next.semantic_key), next.id);
          appendEvent(
            draft,
            eventFor(
              next,
              "knowthat.candidate.promoted",
              {
                candidate_id: next.id,
                fact_id: next.id,
                decision: "promoted",
                review_id: reviewId,
                reason: request.reason,
                evidence_refs: next.evidence_refs,
              },
              request.trace_id,
              now,
            ),
          );
          linkageIds.push(
            enqueueLinkage(
              draft,
              next,
              "append_version",
              request.trace_id,
              now,
            ),
          );
          if (promotion_reservation === null) {
            throw new Error(
              "promotion committed without a Memory reservation",
            );
          }
          const ackRequest: MemoryPromotionReservationAckRequestV1 =
            Object.freeze({
              schema_version: "memory.promotion_reservation_ack.v1",
              bot_id: request.bot_id,
              reservation_id: promotion_reservation.reservation_id,
              candidate_fact_id: next.id,
              fencing_generation:
                promotion_reservation.fencing_generation,
              reservation_token_hash:
                promotion_reservation.reservation_token_hash,
              promotion_revision_id: factRevision.id,
              committed_at: now.toISOString(),
              idempotency_key: `memory-ack:${canonicalHashV1({
                reservation_id: promotion_reservation.reservation_id,
                fencing_generation:
                  promotion_reservation.fencing_generation,
                promotion_revision_id: factRevision.id,
              }).slice("sha256:".length)}`,
              trace_id: request.trace_id,
            });
          const commandId = deterministicIdV1(
            "knowthat_memory_promotion_reservation_ack",
            {
              reservation_id: ackRequest.reservation_id,
              promotion_revision_id: ackRequest.promotion_revision_id,
            },
          );
          const nextPromotionAckCommand: PromotionAckCommandV1 = immutable({
            ...scopeOf(request),
            id: commandId,
            command_type: "promotion_reservation_ack",
            reservation_id: ackRequest.reservation_id,
            candidate_fact_id: next.id,
            fencing_generation: ackRequest.fencing_generation,
            reservation_token_hash:
              promotion_reservation.reservation_token_hash,
            promotion_revision_id: factRevision.id,
            committed_at: ackRequest.committed_at,
            idempotency_key: ackRequest.idempotency_key,
            request: ackRequest,
            request_hash: canonicalHashV1(ackRequest),
            payload_hash: canonicalHashV1(ackRequest),
            status: "pending",
            attempt_count: 0,
            next_retry_at: null,
            last_error: null,
            created_at: now.toISOString(),
            updated_at: now.toISOString(),
          });
          promotionAckCommand = nextPromotionAckCommand;
          draft.memoryCommands.set(commandId, nextPromotionAckCommand);
        } else if (next.status === "rejected") {
          appendEvent(
            draft,
            eventFor(
              next,
              "knowthat.candidate.rejected",
              {
                candidate_id: next.id,
                fact_id: next.id,
                decision: "rejected",
                review_id: reviewId,
                reason: request.reason,
                evidence_refs: next.evidence_refs,
              },
              request.trace_id,
              now,
            ),
          );
        } else if (next.status === "expired") {
          appendEvent(
            draft,
            eventFor(
              next,
              "knowthat.fact.expired",
              {
                fact_id: next.id,
                semantic_key: next.semantic_key,
                category: next.category,
                previous_status: "candidate",
                current_status: "expired",
                revision_id: factRevision.id,
                source_ref: next.source_ref,
              },
              request.trace_id,
              now,
            ),
          );
        }
        project(draft, next, revision);
        draft.queryRevisions.set(scopeKey(request), revision);
        appendAudit(
          draft,
          next.id,
          "candidate_reviewed",
          "meta_cognition",
          reasonCode,
          next.state_version,
          now,
        );
      }
      const result: KnowThatCandidateReviewResultV1 = immutable({
        review_id: reviewId,
        suggestion_id: request.suggestion_id,
        candidate_id,
        target_candidate_version: request.target_candidate_version,
        status: "accepted",
        decision,
        linkage_check_ids: Object.freeze(linkageIds),
        ...(decision === "request_feedback"
          ? {
              feedback_request_suggestion: (() => {
                const openConflict = [...draft.conflicts.values()].find(
                  (conflict) =>
                    sameKnowThatScopeV1(next, conflict) &&
                    (conflict.left_fact_id === next.id ||
                      conflict.right_fact_id === next.id) &&
                    (conflict.status === "open" ||
                      conflict.status === "feedback_requested"),
                );
                const dedupeScopeRef =
                  openConflict === undefined
                    ? `candidate:${next.id}`
                    : `conflict:${openConflict.id}`;
                return Object.freeze({
                  candidate_id: next.id,
                  ...(openConflict === undefined
                    ? {}
                    : { conflict_id: openConflict.id }),
                  dedupe_scope_ref: dedupeScopeRef,
                  question_key: "knowthat_candidate_resolution.v1",
                  question_payload: Object.freeze({
                    candidate_id: next.id,
                    ...(openConflict === undefined
                      ? {}
                      : { conflict_id: openConflict.id }),
                    target_candidate_version: next.candidate_version,
                  }),
                  reason: request.reason,
                  evidence_refs: next.evidence_refs,
                });
              })(),
            }
          : {}),
        candidate_version_after: next.candidate_version,
        duplicate_replayed: false,
        reason_code: reasonCode,
      });
      const promotionReleaseCommand =
        promotion_reservation !== null && reasonCode !== "promoted"
          ? promotionReleaseCommandV1(
              request,
              promotion_reservation,
              "promotion_not_applied",
              now,
            )
          : null;
      if (promotionReleaseCommand !== null) {
        draft.memoryCommands.set(
          promotionReleaseCommand.id,
          promotionReleaseCommand,
        );
      }
      draft.reviews.set(
        reviewKey,
        immutable({
          request_hash,
          result,
          promotion_ack_command: promotionAckCommand,
          promotion_release_command: promotionReleaseCommand,
        }),
      );
      draft.reviewBySuggestion.set(suggestionKey, reviewKey);
      state = draft;
      return immutable({
        result,
        promotion_ack_command: promotionAckCommand,
        promotion_release_command: promotionReleaseCommand,
      });
    },

    async readCandidateReview({ request, request_hash }) {
      const existing = state.reviews.get(
        scoped(request, request.idempotency_key),
      );
      if (existing === undefined) return undefined;
      if (existing.request_hash !== request_hash) {
        throw new KnowThatErrorV1(
          "idempotency_conflict",
          "KnowThat review idempotency key drifted",
          false,
        );
      }
      return immutable({
        result: {
          ...existing.result,
          duplicate_replayed: true,
        },
        promotion_ack_command:
          existing.promotion_ack_command === null
            ? null
            : ((state.memoryCommands.get(
                existing.promotion_ack_command.id,
              ) as PromotionAckCommandV1 | undefined) ??
              existing.promotion_ack_command),
        promotion_release_command:
          existing.promotion_release_command === null ||
          existing.promotion_release_command === undefined
            ? null
            : ((state.memoryCommands.get(
                existing.promotion_release_command.id,
              ) as PromotionReleaseCommandV1 | undefined) ??
              existing.promotion_release_command),
      });
    },

    async pendingPromotionAcks({ limit, now }) {
      return immutable(
        [...state.memoryCommands.values()]
          .filter(
            (command): command is PromotionAckCommandV1 =>
              command.command_type === "promotion_reservation_ack" &&
              (command.status === "pending" ||
                (command.status === "retry_wait" &&
                  (command.next_retry_at === null ||
                    Date.parse(command.next_retry_at) <=
                      now.getTime()))),
          )
          .sort(
            (left, right) =>
              left.updated_at.localeCompare(right.updated_at) ||
              left.id.localeCompare(right.id),
          )
          .slice(0, limit),
      );
    },

    async settlePromotionAck({ command_id, outcome, error, now }) {
      const command = state.memoryCommands.get(command_id);
      if (
        command === undefined ||
        command.command_type !== "promotion_reservation_ack"
      ) {
        throw new KnowThatErrorV1(
          "invalid_state",
          "KnowThat promotion ack command was not found",
          false,
        );
      }
      if (command.status === "sent") return immutable(command);
      const attemptCount = nextSafe(
        command.attempt_count,
        "promotion ack attempt",
      );
      // A promotion ack is the durable half of an already committed
      // cross-owner protocol. Exhausting the ordinary event-outbox retry
      // budget must not strand it permanently; only an explicit operator
      // terminal outcome may stop automatic convergence.
      const terminal = outcome === "failed";
      const retryDelay = Math.min(
        config.retry_max_ms,
        config.retry_base_ms *
          2 ** Math.max(0, attemptCount - 1),
      );
      const next: PromotionAckCommandV1 = immutable({
        ...command,
        status:
          outcome === "sent"
            ? "sent"
            : terminal
              ? "failed"
              : "retry_wait",
        attempt_count: attemptCount,
        next_retry_at:
          outcome !== "sent" && !terminal
            ? new Date(now.getTime() + retryDelay).toISOString()
            : null,
        last_error: error,
        updated_at: now.toISOString(),
      });
      const draft = clone(state);
      draft.memoryCommands.set(command_id, next);
      state = draft;
      return next;
    },

    async ensurePromotionRelease({
      request,
      promotion_reservation,
      release_reason,
      now,
    }) {
      if (
        state.reviews.has(scoped(request, request.idempotency_key))
      ) {
        throw new KnowThatErrorV1(
          "promotion_retry_required",
          "KnowThat candidate review committed before the release handoff",
          true,
        );
      }
      const candidate = promotionReleaseCommandV1(
        request,
        promotion_reservation,
        release_reason,
        now,
      );
      const existing = state.memoryCommands.get(candidate.id);
      if (existing !== undefined) {
        if (
          existing.command_type !== "promotion_reservation_release" ||
          existing.reservation_id !== candidate.reservation_id ||
          existing.candidate_fact_id !== candidate.candidate_fact_id ||
          existing.fencing_generation !== candidate.fencing_generation ||
          existing.reservation_token_hash !==
            candidate.reservation_token_hash ||
          existing.reservation_expires_at !==
            candidate.reservation_expires_at ||
          !sameKnowThatScopeV1(existing, candidate)
        ) {
          throw new KnowThatErrorV1(
            "invalid_state",
            "KnowThat promotion release command identity drifted",
            false,
          );
        }
        return immutable(existing);
      }
      const draft = clone(state);
      draft.memoryCommands.set(candidate.id, candidate);
      state = draft;
      return candidate;
    },

    async pendingPromotionReleases({ limit, now }) {
      return immutable(
        [...state.memoryCommands.values()]
          .filter(
            (command): command is PromotionReleaseCommandV1 =>
              command.command_type === "promotion_reservation_release" &&
              (command.status === "pending" ||
                (command.status === "retry_wait" &&
                  (command.next_retry_at === null ||
                    Date.parse(command.next_retry_at) <=
                      now.getTime()))),
          )
          .sort(
            (left, right) =>
              left.updated_at.localeCompare(right.updated_at) ||
              left.id.localeCompare(right.id),
          )
          .slice(0, limit),
      );
    },

    async settlePromotionRelease({ command_id, outcome, error, now }) {
      const command = state.memoryCommands.get(command_id);
      if (
        command === undefined ||
        command.command_type !== "promotion_reservation_release"
      ) {
        throw new KnowThatErrorV1(
          "invalid_state",
          "KnowThat promotion release command was not found",
          false,
        );
      }
      if (command.status === "sent") return immutable(command);
      const attemptCount = nextSafe(
        command.attempt_count,
        "promotion release attempt",
      );
      const terminal = outcome === "failed";
      const retryDelay = Math.min(
        config.retry_max_ms,
        config.retry_base_ms *
          2 ** Math.max(0, attemptCount - 1),
      );
      const next: PromotionReleaseCommandV1 = immutable({
        ...command,
        status:
          outcome === "sent"
            ? "sent"
            : terminal
              ? "failed"
              : "retry_wait",
        attempt_count: attemptCount,
        next_retry_at:
          outcome !== "sent" && !terminal
            ? new Date(now.getTime() + retryDelay).toISOString()
            : null,
        last_error: error,
        updated_at: now.toISOString(),
      });
      const draft = clone(state);
      draft.memoryCommands.set(command_id, next);
      state = draft;
      return next;
    },

    async expireDue(scope, input) {
      const draft = clone(state);
      const due = [...draft.facts.values()]
        .filter(
          (fact) =>
            sameKnowThatScopeV1(scope, fact) &&
            fact.status === "active" &&
            fact.valid_until !== null &&
            Date.parse(fact.valid_until) <= input.now.getTime(),
        )
        .sort(
          (left, right) =>
            left.valid_until!.localeCompare(right.valid_until!) ||
            left.id.localeCompare(right.id),
        )
        .slice(0, input.limit);
      if (due.length === 0) return Object.freeze([]);
      const revision = nextSafe(
        currentRevision(draft, scope),
        "query revision",
      );
      for (const fact of due) {
        expireFact(
          draft,
          fact,
          revision,
          input.actor,
          "periodic_expiration_sweeper",
          input.trace_id,
          input.now,
        );
      }
      draft.queryRevisions.set(scopeKey(scope), revision);
      state = draft;
      return Object.freeze(due.map((fact) => fact.id));
    },

    async claimLinkage(input) {
      const draft = clone(state);
      const eligible = [...draft.linkageJobs.values()]
        .filter(
          (job) =>
            job.status === "pending" ||
            (job.status === "retry_wait" &&
              (job.next_retry_at === null ||
                Date.parse(job.next_retry_at) <= input.now.getTime())) ||
            (job.status === "running" &&
              job.locked_until !== null &&
              Date.parse(job.locked_until) <= input.now.getTime()),
        )
        .sort(
          (left, right) =>
            left.updated_at.localeCompare(right.updated_at) ||
            left.id.localeCompare(right.id),
        )
        .slice(0, input.limit);
      const claimed = eligible.map((job) => {
        const generation = nextSafe(
          job.lease_generation,
          "linkage lease generation",
        );
        const attempt = nextSafe(job.attempt_count, "linkage attempt");
        const token = deterministicIdV1("knowthat_linkage_claim", {
          job_id: job.id,
          generation,
          worker_id: input.worker_id,
        });
        const next: KnowThatLinkageJobV1 = immutable({
          ...job,
          status: "running",
          attempt_count: attempt,
          next_retry_at: null,
          lease_generation: generation,
          claim_token: token,
          locked_by: input.worker_id,
          locked_until: new Date(
            input.now.getTime() + config.linkage_lease_ms,
          ).toISOString(),
          job_version: nextSafe(job.job_version, "linkage job version"),
          updated_at: input.now.toISOString(),
        });
        draft.linkageJobs.set(next.id, next);
        appendAudit(
          draft,
          next.id,
          job.status === "running" ? "linkage_taken_over" : "linkage_claimed",
          input.worker_id,
          "lease_acquired",
          next.job_version,
          input.now,
        );
        return {
          fence: {
            linkage_job_id: next.id,
            lease_generation: generation,
            claim_token: token,
            worker_id: input.worker_id,
          },
          job: next,
        };
      });
      state = draft;
      return immutable(claimed);
    },

    async settleLinkage(input) {
      canonicalJsonV1(input.fence);
      canonicalJsonV1(input.result);
      if (input.error !== null) canonicalJsonV1(input.error);
      const draft = clone(state);
      const job = draft.linkageJobs.get(input.fence.linkage_job_id);
      if (
        job === undefined ||
        job.status !== "running" ||
        job.lease_generation !== input.fence.lease_generation ||
        job.claim_token !== input.fence.claim_token ||
        job.locked_by !== input.fence.worker_id ||
        job.locked_until === null ||
        Date.parse(job.locked_until) <= input.now.getTime()
      ) {
        throw new KnowThatErrorV1(
          "stale_lease",
          "KnowThat linkage lease is stale",
          false,
        );
      }
      let outcome = input.outcome;
      if (
        outcome === "retry_wait" &&
        job.attempt_count >= config.max_linkage_attempts
      ) {
        outcome = "failed";
      }
      const retryDelay = Math.min(
        config.retry_max_ms,
        config.retry_base_ms * 2 ** Math.max(0, job.attempt_count - 1),
      );
      const next: KnowThatLinkageJobV1 = immutable({
        ...job,
        status: outcome,
        next_retry_at:
          outcome === "retry_wait"
            ? new Date(input.now.getTime() + retryDelay).toISOString()
            : null,
        claim_token: null,
        locked_by: null,
        locked_until: null,
        last_error:
          outcome === "retry_wait"
            ? knowThatDurableFailureV1("linkage_retry_required")
            : outcome === "failed"
              ? knowThatDurableFailureV1("linkage_failed")
              : null,
        job_version: nextSafe(job.job_version, "linkage job version"),
        updated_at: input.now.toISOString(),
      });
      draft.linkageJobs.set(next.id, next);
      appendAudit(
        draft,
        next.id,
        `linkage_${outcome}`,
        input.fence.worker_id,
        input.error === null ? "settled" : "settled_with_error",
        next.job_version,
        input.now,
      );
      state = draft;
      return next;
    },

    async recoverLinkage(request, now) {
      const key = scoped(request, request.idempotency_key);
      const existing = state.recoveryByIdempotency.get(key);
      if (existing !== undefined) {
        if (existing.request_hash !== request.request_hash) {
          throw new KnowThatErrorV1(
            "recovery_conflict",
            "KnowThat recovery idempotency key drifted",
            false,
          );
        }
        return immutable({
          duplicate_replayed: true,
          linkage_job: existing.linkage_job,
        });
      }
      const draft = clone(state);
      const job = draft.linkageJobs.get(request.linkage_job_id);
      if (
        job === undefined ||
        !sameKnowThatScopeV1(request, job)
      ) {
        throw new KnowThatErrorV1(
          "fact_not_found",
          "KnowThat linkage job was not found",
          false,
        );
      }
      if (job.job_version !== request.expected_job_version) {
        throw new KnowThatErrorV1(
          "recovery_conflict",
          "KnowThat linkage recovery version is stale",
          false,
        );
      }
      const recoverable =
        job.status === "failed" ||
        job.status === "retry_wait" ||
        (job.status === "running" &&
          job.locked_until !== null &&
          Date.parse(job.locked_until) <= now.getTime());
      if (!recoverable) {
        throw new KnowThatErrorV1(
          "invalid_state",
          "KnowThat linkage job is not recoverable",
          false,
        );
      }
      const next: KnowThatLinkageJobV1 = immutable({
        ...job,
        status: "pending",
        next_retry_at: null,
        claim_token: null,
        locked_by: null,
        locked_until: null,
        last_error:
          request.recovery_action === "repair" ? null : job.last_error,
        job_version: nextSafe(job.job_version, "linkage job version"),
        updated_at: now.toISOString(),
      });
      draft.linkageJobs.set(next.id, next);
      draft.recoveryByIdempotency.set(
        key,
        immutable({
          request_hash: request.request_hash,
          linkage_job: next,
        }),
      );
      appendAudit(
        draft,
        next.id,
        `linkage_recovery_${request.recovery_action}`,
        "operator",
        request.reason,
        next.job_version,
        now,
      );
      state = draft;
      return immutable({
        duplicate_replayed: false,
        linkage_job: next,
      });
    },

    async claimEvents(input) {
      const draft = clone(state);
      const eligible = [...draft.events.values()]
        .filter(
          (event) =>
            event.status === "pending" ||
            (event.status === "retry_wait" &&
              (event.next_retry_at === null ||
                Date.parse(event.next_retry_at) <= input.now.getTime())) ||
            (event.status === "dispatching" &&
              event.locked_until !== null &&
              Date.parse(event.locked_until) <= input.now.getTime()),
        )
        .sort(
          (left, right) =>
            left.occurred_at.localeCompare(right.occurred_at) ||
            left.event_id.localeCompare(right.event_id),
        )
        .slice(0, input.limit);
      const claimed = eligible.map((event) => {
        const attempt = nextSafe(event.attempt_count, "event attempt");
        const token = deterministicIdV1("knowthat_event_claim", {
          event_id: event.event_id,
          attempt,
          worker_id: input.worker_id,
        });
        const next: KnowThatEventV1 = immutable({
          ...event,
          status: "dispatching",
          attempt_count: attempt,
          next_retry_at: null,
          claim_token: token,
          locked_until: new Date(
            input.now.getTime() + config.outbox_lease_ms,
          ).toISOString(),
        });
        draft.events.set(next.event_id, next);
        return {
          fence: {
            event_id: next.event_id,
            claim_token: next.claim_token!,
          },
          event: eventEnvelope(next),
          target: next.target,
          payload_hash: next.payload_hash,
          attempt_count: next.attempt_count,
        };
      });
      state = draft;
      return immutable(claimed);
    },

    async ackEvent(input) {
      const draft = clone(state);
      const event = draft.events.get(input.event_id);
      if (
        event === undefined ||
        event.status !== "dispatching" ||
        event.claim_token !== input.claim_token ||
        event.locked_until === null ||
        Date.parse(event.locked_until) <= input.now.getTime()
      ) {
        throw new KnowThatErrorV1(
          "stale_lease",
          "KnowThat event outbox claim is stale",
          false,
        );
      }
      const retryDelay = Math.min(
        config.retry_max_ms,
        config.retry_base_ms * 2 ** Math.max(0, event.attempt_count - 1),
      );
      const outcome =
        input.outcome === "retry_wait" &&
        event.attempt_count >= config.max_outbox_attempts
          ? "failed"
          : input.outcome;
      const next: KnowThatEventV1 = immutable({
        ...event,
        status: outcome,
        next_retry_at:
          outcome === "retry_wait"
            ? new Date(input.now.getTime() + retryDelay).toISOString()
            : null,
        claim_token: null,
        locked_until: null,
      });
      draft.events.set(next.event_id, next);
      if (outcome === "failed") {
        const deadLetterId = deterministicIdV1("knowthat_event_dlq", {
          event_id: next.event_id,
          idempotency_key: next.idempotency_key,
        });
        if (!draft.eventDeadLetters.has(deadLetterId)) {
          draft.eventDeadLetters.set(
            deadLetterId,
            immutable({
              ...scopeOf(next),
              id: deadLetterId,
              event_id: next.event_id,
              event_type: next.event_type,
              idempotency_key: next.idempotency_key,
              payload_hash: next.payload_hash,
              attempt_count: next.attempt_count,
              reason:
                input.outcome === "failed"
                  ? "dispatcher_terminal_failure"
                  : "retry_attempts_exhausted",
              created_at: input.now.toISOString(),
            }),
          );
        }
      }
      state = draft;
      return next;
    },

    async checkReadiness() {},

    inspect() {
      const uniqueInbox = new Map(
        [...state.inboxByEvent.values()].map((entry) => [entry.event_id, entry]),
      );
      return immutable({
        facts: [...state.facts.values()],
        revisions: [...state.revisions.values()].flat(),
        conflicts: [...state.conflicts.values()],
        events: [...state.events.values()],
        linkage_jobs: [...state.linkageJobs.values()],
        event_dead_letters: [...state.eventDeadLetters.values()],
        memory_commands: [...state.memoryCommands.values()],
        inbox: [...uniqueInbox.values()],
        audits: state.audits,
        query_revisions: Object.fromEntries(state.queryRevisions),
      });
    },
  };
  return Object.freeze(store);
}
