import type { VerifiedOwnerPostgresCompositionV1 } from "@pai/persistence";

import {
  canonicalHashV1,
  canonicalJsonV1,
  deterministicIdV1,
  snapshotCanonicalJsonV1,
} from "./canonical.v1.js";
import type { KnowThatConfigV1 } from "./config.v1.js";
import { KNOWTHAT_REPOSITORY_CONTRACT_V1 } from "./db/permission-manifest.v1.js";
import {
  createInMemoryKnowThatStoreV1,
  type KnowThatCandidateReviewCommitV1,
  type KnowThatEventDispatchClaimV1,
  type KnowThatPromotionReservationProofV1,
  type KnowThatQueryCursorTupleV1,
  type KnowThatStorePortV1,
  type KnowThatStoreSeedV1,
  type PromotionAckCommandV1,
  type PromotionReleaseCommandV1,
} from "./knowthat-store.v1.js";
import {
  KnowThatErrorV1,
  knowThatDurableFailureV1,
  type KnowThatConflictV1,
  type KnowThatDurableFailureV1,
  type KnowThatEventV1,
  type KnowThatFactRevisionV1,
  type KnowThatFactV1,
  type KnowThatLinkageFenceV1,
  type KnowThatLinkageJobV1,
  type KnowThatQueryFactV1,
  type KnowThatScopeV1,
  type KnowThatSourceEventV1,
  type KnowThatWriteBatchRequestV1,
} from "./knowthat-types.v1.js";
import { sameKnowThatScopeV1 } from "./validation.v1.js";

type CompositionV1 = VerifiedOwnerPostgresCompositionV1<
  typeof KNOWTHAT_REPOSITORY_CONTRACT_V1
>;

interface JsonRowV1 extends Record<string, unknown> {
  readonly row: Readonly<Record<string, unknown>>;
}

interface CurrentProjectionRowV1 extends Record<string, unknown> {
  readonly fact_id: string;
  readonly visible_from_revision: string | number;
  readonly search_vector: string;
  readonly projection_payload: Readonly<Record<string, unknown>>;
  readonly status: string;
  readonly category: string;
  readonly semantic_key: string;
  readonly updated_at: string | Date;
  readonly valid_from: string | Date | null;
  readonly valid_until: string | Date | null;
}

export interface PostgresKnowThatStoreOptionsV1 {
  readonly memory_command_worker_id: string;
  readonly memory_command_transport_epoch: string;
  readonly memory_command_transport_generation: number;
  readonly memory_command_lease_seconds?: number;
  readonly event_transport_epoch?: string;
  readonly event_transport_generation?: number;
  readonly event_lease_seconds?: number;
}

const OWNER_SCOPE_METADATA_KEY_V1 = "__pai_owner_scope_v1";
const OWNER_SCOPE_PAYLOAD_KEY_V1 = "owner_scope_v1";

function textV1(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`KnowThat PostgreSQL ${label} is invalid`);
  }
  return value;
}

function nullableTextV1(value: unknown, label: string): string | null {
  return value === null || value === undefined ? null : textV1(value, label);
}

function numberV1(value: unknown, label: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`KnowThat PostgreSQL ${label} is invalid`);
  }
  return parsed;
}

function scoreV1(value: unknown, label: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`KnowThat PostgreSQL ${label} is invalid`);
  }
  return parsed;
}

function instantV1(value: unknown, label: string): string {
  const parsed =
    typeof value === "string" || value instanceof Date
      ? new Date(value)
      : null;
  if (parsed === null || !Number.isFinite(parsed.getTime())) {
    throw new Error(`KnowThat PostgreSQL ${label} is invalid`);
  }
  return parsed.toISOString();
}

function nullableInstantV1(value: unknown, label: string): string | null {
  return value === null || value === undefined ? null : instantV1(value, label);
}

function recordV1(
  value: unknown,
  label: string,
): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`KnowThat PostgreSQL ${label} is invalid`);
  }
  return value as Readonly<Record<string, unknown>>;
}

function stringArrayV1(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`KnowThat PostgreSQL ${label} is invalid`);
  }
  return Object.freeze([...value]);
}

function optionalStringArrayV1(value: unknown, label: string): readonly string[] {
  if (value === null || value === undefined) return Object.freeze([]);
  return stringArrayV1(value, label);
}

function scopeKeyV1(scope: KnowThatScopeV1): string {
  return [
    scope.workspace_id,
    scope.bot_id,
    scope.owner_agent_id,
    scope.deployment_environment,
    scope.release_channel,
  ].join("\u0000");
}

function scopeFromRecordV1(value: unknown, label: string): KnowThatScopeV1 {
  const scope = recordV1(value, label);
  const result: KnowThatScopeV1 = {
    workspace_id: textV1(scope.workspace_id, `${label}.workspace_id`),
    bot_id: textV1(scope.bot_id, `${label}.bot_id`),
    owner_agent_id: textV1(scope.owner_agent_id, `${label}.owner_agent_id`),
    deployment_environment: textV1(
      scope.deployment_environment,
      `${label}.deployment_environment`,
    ) as KnowThatScopeV1["deployment_environment"],
    release_channel: textV1(
      scope.release_channel,
      `${label}.release_channel`,
    ) as KnowThatScopeV1["release_channel"],
  };
  return Object.freeze(result);
}

function ownerScopePayloadV1(scope: KnowThatScopeV1): KnowThatScopeV1 {
  const result: KnowThatScopeV1 = {
    workspace_id: scope.workspace_id,
    bot_id: scope.bot_id,
    owner_agent_id: scope.owner_agent_id,
    deployment_environment: scope.deployment_environment,
    release_channel: scope.release_channel,
  };
  return Object.freeze(result);
}

function exactScopeV1(value: unknown, expected: KnowThatScopeV1): KnowThatScopeV1 {
  const result = scopeFromRecordV1(value, "owner_scope");
  if (!sameKnowThatScopeV1(result, expected)) {
    throw new Error("KnowThat PostgreSQL owner scope mismatch");
  }
  return result;
}

function optionalEmbeddedScopeV1(
  payload: Readonly<Record<string, unknown>>,
  expected: KnowThatScopeV1 | undefined,
  label: string,
): KnowThatScopeV1 {
  const embedded = payload[OWNER_SCOPE_PAYLOAD_KEY_V1];
  if (expected === undefined) {
    return scopeFromRecordV1(embedded, `${label}.${OWNER_SCOPE_PAYLOAD_KEY_V1}`);
  }
  if (embedded !== undefined) {
    exactScopeV1(embedded, expected);
  }
  return expected;
}

function searchVectorLiteralV1(text: string): string {
  return (text.toLowerCase().match(/[a-z0-9_]+/gu) ?? [])
    .slice(0, 256)
    .map((token, index) => `'${token}':${index + 1}`)
    .join(" ");
}

function factFromRowV1(
  row: Readonly<Record<string, unknown>>,
  scope: KnowThatScopeV1,
): KnowThatFactV1 {
  if (row.bot_id !== scope.bot_id) {
    throw new Error("KnowThat PostgreSQL fact bot scope mismatch");
  }
  const raw = recordV1(
    row.semantic_components_raw,
    "fact.semantic_components_raw",
  );
  if (raw[OWNER_SCOPE_METADATA_KEY_V1] !== undefined) {
    exactScopeV1(raw[OWNER_SCOPE_METADATA_KEY_V1], scope);
  }
  const result: KnowThatFactV1 = {
    ...scope,
    id: textV1(row.id, "fact.id"),
    text: textV1(row.text, "fact.text"),
    subject: textV1(row.subject, "fact.subject"),
    predicate: textV1(row.predicate, "fact.predicate"),
    object: textV1(row.object, "fact.object"),
    normalized_object: textV1(row.normalized_object, "fact.normalized_object"),
    object_hash: textV1(row.object_hash, "fact.object_hash") as `sha256:${string}`,
    canonicalization_version: "knowthat.semantic_key.v1",
    semantic_key_display: textV1(
      row.semantic_key_display,
      "fact.semantic_key_display",
    ),
    semantic_key: textV1(row.semantic_key, "fact.semantic_key"),
    category: textV1(row.category, "fact.category") as KnowThatFactV1["category"],
    status: textV1(row.status, "fact.status") as KnowThatFactV1["status"],
    confidence: scoreV1(row.confidence, "fact.confidence"),
    source: textV1(row.source, "fact.source") as KnowThatFactV1["source"],
    source_ref: textV1(row.source_ref, "fact.source_ref"),
    evidence_refs: optionalStringArrayV1(row.evidence_refs, "fact.evidence_refs"),
    valid_from: nullableInstantV1(row.valid_from, "fact.valid_from"),
    valid_until: nullableInstantV1(row.valid_until, "fact.valid_until"),
    evidence_pending:
      recordV1(row.semantic_components_normalized, "fact.normalized")
        .evidence_pending === true,
    evidence_pending_reason: nullableTextV1(
      recordV1(row.semantic_components_normalized, "fact.normalized")
        .evidence_pending_reason,
      "fact.evidence_pending_reason",
    ),
    risk_level:
      (recordV1(row.semantic_components_normalized, "fact.normalized")
        .risk_level as KnowThatFactV1["risk_level"] | undefined) ?? "low",
    explicitness:
      (recordV1(row.semantic_components_normalized, "fact.normalized")
        .explicitness as KnowThatFactV1["explicitness"] | undefined) ??
      "explicit_statement",
    origin_write_batch_id: textV1(
      recordV1(row.semantic_components_normalized, "fact.normalized")
        .origin_write_batch_id,
      "fact.origin_write_batch_id",
    ),
    origin_client_item_id: textV1(
      recordV1(row.semantic_components_normalized, "fact.normalized")
        .origin_client_item_id,
      "fact.origin_client_item_id",
    ),
    state_version: numberV1(row.state_version, "fact.state_version"),
    candidate_version: numberV1(row.candidate_version, "fact.candidate_version"),
    created_at: instantV1(row.created_at, "fact.created_at"),
    updated_at: instantV1(row.updated_at, "fact.updated_at"),
  };
  return Object.freeze(result);
}

function revisionFromRowV1(
  row: Readonly<Record<string, unknown>>,
): KnowThatFactRevisionV1 {
  return Object.freeze({
    id: textV1(row.id, "revision.id"),
    fact_id: textV1(row.fact_id, "revision.fact_id"),
    revision_no: numberV1(row.revision_no, "revision.revision_no"),
    patch: recordV1(row.patch, "revision.patch"),
    reason: textV1(row.reason, "revision.reason"),
    actor: textV1(row.actor, "revision.actor"),
    created_at: instantV1(row.created_at, "revision.created_at"),
  });
}

function linkageFromRowV1(
  row: Readonly<Record<string, unknown>>,
  scope: KnowThatScopeV1 | undefined,
): KnowThatLinkageJobV1 {
  const affectedQuery = recordV1(row.affected_query, "linkage.affected_query");
  const effectiveScope = optionalEmbeddedScopeV1(
    affectedQuery,
    scope,
    "linkage.affected_query",
  );
  if (row.bot_id !== effectiveScope.bot_id) {
    throw new Error("KnowThat PostgreSQL linkage bot scope mismatch");
  }
  return Object.freeze({
    ...effectiveScope,
    id: textV1(row.id, "linkage.id"),
    fact_id: textV1(row.fact_id, "linkage.fact_id"),
    check_type: "post_promotion_linkage_propagation",
    target_service: "memory",
    operation: textV1(row.action, "linkage.action") as KnowThatLinkageJobV1["operation"],
    evidence_refs: optionalStringArrayV1(
      row.evidence_refs,
      "linkage.evidence_refs",
    ),
    idempotency_key: textV1(row.idempotency_key, "linkage.idempotency_key"),
    status: textV1(row.status, "linkage.status") as KnowThatLinkageJobV1["status"],
    attempt_count: numberV1(row.attempt_count, "linkage.attempt_count"),
    next_retry_at: nullableInstantV1(row.next_retry_at, "linkage.next_retry_at"),
    lease_generation: numberV1(row.lease_generation, "linkage.lease_generation"),
    claim_token: nullableTextV1(row.claim_token, "linkage.claim_token"),
    locked_by: nullableTextV1(row.locked_by, "linkage.locked_by"),
    locked_until: nullableInstantV1(row.locked_until, "linkage.locked_until"),
    last_error:
      row.last_error === null || row.last_error === undefined
        ? null
        : (recordV1(row.last_error, "linkage.last_error") as KnowThatDurableFailureV1),
    job_version: numberV1(row.job_version, "linkage.job_version"),
    created_at: instantV1(row.created_at, "linkage.created_at"),
    updated_at: instantV1(row.updated_at, "linkage.updated_at"),
  });
}

function eventFromRowV1(
  row: Readonly<Record<string, unknown>>,
  scope: KnowThatScopeV1,
): KnowThatEventV1 {
  if (row.bot_id !== scope.bot_id) {
    throw new Error("KnowThat PostgreSQL event bot scope mismatch");
  }
  return Object.freeze({
    ...scope,
    event_id: textV1(row.id, "event.id"),
    event_type: textV1(row.event_type, "event.event_type") as KnowThatEventV1["event_type"],
    schema_version: "knowthat_event.v1",
    producer: "knowthat",
    occurred_at: instantV1(row.occurred_at, "event.occurred_at"),
    idempotency_key: textV1(row.idempotency_key, "event.idempotency_key"),
    trace_id: textV1(row.trace_id, "event.trace_id"),
    payload: recordV1(row.payload, "event.payload"),
    payload_hash: textV1(row.payload_hash, "event.payload_hash") as `sha256:${string}`,
    target: textV1(row.target, "event.target") as KnowThatEventV1["target"],
    status: textV1(row.status, "event.status") as KnowThatEventV1["status"],
    attempt_count: numberV1(row.attempt_count, "event.attempt_count"),
    next_retry_at: nullableInstantV1(row.next_retry_at, "event.next_retry_at"),
    claim_token: nullableTextV1(row.claim_token, "event.claim_token"),
    locked_until: nullableInstantV1(row.locked_until, "event.locked_until"),
  });
}

function commandFromRowV1(
  row: Readonly<Record<string, unknown>>,
  scope?: KnowThatScopeV1,
): PromotionAckCommandV1 | PromotionReleaseCommandV1 {
  const payload = { ...recordV1(row.payload, "command.payload") };
  const effectiveScope = optionalEmbeddedScopeV1(
    payload,
    scope,
    "command.payload",
  );
  delete payload.reason_code;
  delete payload[OWNER_SCOPE_PAYLOAD_KEY_V1];
  if (row.bot_id !== effectiveScope.bot_id) {
    throw new Error("KnowThat PostgreSQL command bot scope mismatch");
  }
  const common = {
    ...effectiveScope,
    id: textV1(row.id, "command.id"),
    reservation_id: textV1(row.reservation_id, "command.reservation_id"),
    candidate_fact_id: textV1(
      row.candidate_fact_id,
      "command.candidate_fact_id",
    ),
    fencing_generation: numberV1(
      row.fencing_generation,
      "command.fencing_generation",
    ),
    reservation_token_hash: textV1(
      row.reservation_token_hash,
      "command.reservation_token_hash",
    ) as `sha256:${string}`,
    idempotency_key: textV1(row.idempotency_key, "command.idempotency_key"),
    request_hash: textV1(row.request_hash, "command.request_hash") as `sha256:${string}`,
    payload_hash: textV1(row.request_hash, "command.payload_hash") as `sha256:${string}`,
    status: textV1(row.status, "command.status") as
      | "pending"
      | "dispatching"
      | "sent"
      | "retry_wait"
      | "failed",
    attempt_count: numberV1(row.attempt_count, "command.attempt_count"),
    next_retry_at: nullableInstantV1(row.next_retry_at, "command.next_retry_at"),
    last_error:
      row.last_error === null || row.last_error === undefined
        ? null
        : (recordV1(row.last_error, "command.last_error") as KnowThatDurableFailureV1),
    created_at: instantV1(row.created_at, "command.created_at"),
    updated_at: instantV1(row.updated_at, "command.updated_at"),
  };
  if (row.command_type === "promotion_reservation_ack") {
    return Object.freeze({
      ...common,
      command_type: "promotion_reservation_ack" as const,
      promotion_revision_id: textV1(
        row.promotion_revision_id,
        "command.promotion_revision_id",
      ),
      committed_at: instantV1(row.committed_at, "command.committed_at"),
      request: snapshotCanonicalJsonV1(payload) as PromotionAckCommandV1["request"],
    });
  }
  return Object.freeze({
    ...common,
    command_type: "promotion_reservation_release" as const,
    reservation_expires_at: instantV1(
      row.reservation_expires_at,
      "command.reservation_expires_at",
    ),
    release_reason: textV1(
      row.release_reason,
      "command.release_reason",
    ) as PromotionReleaseCommandV1["release_reason"],
    released_at: instantV1(row.released_at, "command.released_at"),
    request: snapshotCanonicalJsonV1(payload) as PromotionReleaseCommandV1["request"],
  });
}

function ownerWriterSourceEventV1(
  event: KnowThatSourceEventV1,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    ...event,
    producer: event.source,
  });
}

function factRowV1(fact: KnowThatFactV1): Readonly<Record<string, unknown>> {
  return {
    id: fact.id,
    bot_id: fact.bot_id,
    text: fact.text,
    subject: fact.subject,
    predicate: fact.predicate,
    object: fact.object,
    normalized_object: fact.normalized_object,
    object_hash: fact.object_hash,
    canonicalization_version: fact.canonicalization_version,
    semantic_key_display: fact.semantic_key_display,
    semantic_components_raw: {
      [OWNER_SCOPE_METADATA_KEY_V1]: fact,
      subject: fact.subject,
      predicate: fact.predicate,
      object: fact.object,
    },
    semantic_components_normalized: {
      normalized_object: fact.normalized_object,
      evidence_pending: fact.evidence_pending,
      evidence_pending_reason: fact.evidence_pending_reason,
      explicitness: fact.explicitness,
      origin_client_item_id: fact.origin_client_item_id,
      origin_write_batch_id: fact.origin_write_batch_id,
      risk_level: fact.risk_level,
    },
    semantic_key: fact.semantic_key,
    category: fact.category,
    status: fact.status,
    confidence: fact.confidence,
    source: fact.source,
    source_ref: fact.source_ref,
    evidence_refs: [...fact.evidence_refs],
    valid_from: fact.valid_from,
    valid_until: fact.valid_until,
    payload_schema_version: "knowthat_fact.v1",
    candidate_version: fact.candidate_version,
    state_version: fact.state_version,
    created_at: fact.created_at,
    updated_at: fact.updated_at,
  };
}

function revisionRowV1(
  revision: KnowThatFactRevisionV1,
): Readonly<Record<string, unknown>> {
  return {
    id: revision.id,
    fact_id: revision.fact_id,
    revision_no: revision.revision_no,
    patch: revision.patch,
    reason: revision.reason,
    actor: revision.actor,
    created_at: revision.created_at,
  };
}

function queryFactV1(fact: KnowThatFactV1): KnowThatQueryFactV1 {
  return {
    id: fact.id,
    semantic_key: fact.semantic_key,
    category: fact.category,
    subject: fact.subject,
    predicate: fact.predicate,
    object: fact.object,
    confidence: fact.confidence,
    ...(fact.valid_from === null ? {} : { valid_from: fact.valid_from }),
    ...(fact.valid_until === null ? {} : { valid_until: fact.valid_until }),
    updated_at: fact.updated_at,
  };
}

function queryVersionRowV1(input: Readonly<{
  fact: KnowThatFactV1;
  visible_from_revision: number;
  visible_until_revision: number | null;
}>): Readonly<Record<string, unknown>> {
  const projection = queryFactV1(input.fact);
  return {
    bot_id: input.fact.bot_id,
    fact_id: input.fact.id,
    visible_from_revision: input.visible_from_revision,
    visible_until_revision: input.visible_until_revision,
    status: input.fact.status,
    category: input.fact.category,
    semantic_key: input.fact.semantic_key,
    updated_at: input.fact.updated_at,
    valid_from: input.fact.valid_from,
    valid_until: input.fact.valid_until,
    search_vector: searchVectorLiteralV1(input.fact.text),
    projection_payload: projection,
    created_at: input.fact.updated_at,
  };
}

function eventAggregateIdV1(event: KnowThatEventV1): string {
  const payload = event.payload;
  const value =
    payload.fact_id ??
    payload.candidate_id ??
    payload.conflict_id ??
    payload.linkage_check_id ??
    event.event_id;
  return typeof value === "string" && value.length > 0
    ? value
    : event.event_id;
}

function eventRowV1(event: KnowThatEventV1): Readonly<Record<string, unknown>> {
  return {
    id: event.event_id,
    bot_id: event.bot_id,
    aggregate_id: eventAggregateIdV1(event),
    event_type: event.event_type,
    schema_version: event.schema_version,
    producer: event.producer,
    occurred_at: event.occurred_at,
    idempotency_key: event.idempotency_key,
    trace_id: event.trace_id,
    payload: event.payload,
    payload_hash: event.payload_hash,
    target: event.target,
    status: event.status,
    attempt_count: event.attempt_count,
    next_retry_at: event.next_retry_at,
    created_at: event.occurred_at,
    updated_at: event.occurred_at,
    claimed_by: null,
    claim_token: null,
    acknowledged_claim_token: null,
    locked_until: null,
    last_error: null,
    transport_ref: null,
    transport_epoch: null,
    transport_generation: null,
    sent_at: null,
  };
}

function linkageRowV1(job: KnowThatLinkageJobV1): Readonly<Record<string, unknown>> {
  return {
    id: job.id,
    bot_id: job.bot_id,
    fact_id: job.fact_id,
    check_type: job.check_type,
    target_service: job.target_service,
    change_type: job.operation,
    affected_query: {
      [OWNER_SCOPE_PAYLOAD_KEY_V1]: ownerScopePayloadV1(job),
    },
    target_memory_point_ids: [],
    action: job.operation,
    reason: `fact_${job.operation}`,
    evidence_refs: [...job.evidence_refs],
    idempotency_key: job.idempotency_key,
    attempt_count: job.attempt_count,
    next_retry_at: job.next_retry_at,
    locked_by: job.locked_by,
    locked_until: job.locked_until,
    last_error: job.last_error,
    status: job.status,
    result: null,
    payload_schema_version: "knowthat_linkage_check.v1",
    created_at: job.created_at,
    updated_at: job.updated_at,
    lease_generation: job.lease_generation,
    claim_token: job.claim_token,
    job_version: job.job_version,
  };
}

function commandRowV1(
  command: PromotionAckCommandV1 | PromotionReleaseCommandV1,
): Readonly<Record<string, unknown>> {
  const release = command.command_type === "promotion_reservation_release";
  const payload =
    command.command_type === "promotion_reservation_release"
      ? {
          ...command.request,
          reason_code: command.release_reason,
          [OWNER_SCOPE_PAYLOAD_KEY_V1]: ownerScopePayloadV1(command),
        }
      : {
          ...command.request,
          [OWNER_SCOPE_PAYLOAD_KEY_V1]: ownerScopePayloadV1(command),
        };
  return {
    id: command.id,
    bot_id: command.bot_id,
    command_type: command.command_type,
    reservation_id: command.reservation_id,
    candidate_fact_id: command.candidate_fact_id,
    fencing_generation: command.fencing_generation,
    reservation_token_hash: command.reservation_token_hash,
    promotion_revision_id:
      command.command_type === "promotion_reservation_ack"
        ? command.promotion_revision_id
        : null,
    committed_at:
      command.command_type === "promotion_reservation_ack"
        ? command.committed_at
        : null,
    reservation_expires_at: release
      ? command.reservation_expires_at
      : null,
    release_reason: release ? command.release_reason : null,
    released_at: release ? command.released_at : null,
    idempotency_key: command.idempotency_key,
    request_hash: command.request_hash,
    payload,
    status: command.status,
    attempt_count: command.attempt_count,
    next_retry_at: command.next_retry_at,
    last_error: command.last_error,
    created_at: command.created_at,
    updated_at: command.updated_at,
    claim_token: null,
    acknowledged_claim_token: null,
    locked_by: null,
    locked_until: null,
    transport_ref: null,
    transport_epoch: null,
    transport_generation: null,
    sent_at: null,
  };
}

function changedByIdV1<T extends { readonly id: string }>(
  before: readonly T[],
  after: readonly T[],
): readonly Readonly<{ before: T | undefined; after: T }>[] {
  const prior = new Map(before.map((value) => [value.id, value]));
  return after
    .filter((value) => {
      const previous = prior.get(value.id);
      return previous === undefined ||
        canonicalHashV1(previous) !== canonicalHashV1(value);
    })
    .map((value) => Object.freeze({ before: prior.get(value.id), after: value }));
}

function addedByIdV1<T extends { readonly id: string }>(
  before: readonly T[],
  after: readonly T[],
): readonly T[] {
  const prior = new Set(before.map((value) => value.id));
  return after.filter((value) => !prior.has(value.id));
}

function addedByKeyV1<T>(
  before: readonly T[],
  after: readonly T[],
  key: (value: T) => string,
): readonly T[] {
  const prior = new Set(before.map(key));
  return after.filter((value) => !prior.has(key(value)));
}

async function loadSeedV1(
  composition: CompositionV1,
  scope: KnowThatScopeV1,
): Promise<KnowThatStoreSeedV1> {
  return composition.read_committed_postgres.withReadCommittedTransaction(
    async (transaction) => {
      const query = (sql: string, values: readonly unknown[]) =>
        transaction.query<JsonRowV1>(sql, values);
      const facts = await query(
        `SELECT to_jsonb(row) AS row
           FROM knowthat.knowthat_facts AS row
          WHERE row.bot_id = $1
          ORDER BY row.id`,
        [scope.bot_id],
      );
      const revisions = await query(
        `SELECT to_jsonb(revision) AS row
           FROM knowthat.knowthat_fact_revisions AS revision
           JOIN knowthat.knowthat_facts AS fact ON fact.id = revision.fact_id
          WHERE fact.bot_id = $1
          ORDER BY revision.fact_id, revision.revision_no`,
        [scope.bot_id],
      );
      const conflicts = await query(
        `SELECT to_jsonb(row) AS row
           FROM knowthat.knowthat_conflicts AS row
          WHERE row.bot_id = $1
          ORDER BY row.id`,
        [scope.bot_id],
      );
      const linkages = await query(
        `SELECT to_jsonb(row) AS row
           FROM knowthat.knowthat_linkage_checks AS row
          WHERE row.bot_id = $1
          ORDER BY row.id`,
        [scope.bot_id],
      );
      const revisionPointer = await transaction.query<{ current_revision: string }>(
        `SELECT current_revision
           FROM knowthat.knowthat_query_revisions
          WHERE bot_id = $1`,
        [scope.bot_id],
      );
      return Object.freeze({
        facts: facts.rows.map(({ row }) => factFromRowV1(row, scope)),
        revisions: revisions.rows.map(({ row }) => revisionFromRowV1(row)),
        conflicts: conflicts.rows.map(({ row }) => ({
          ...row,
          id: textV1(row.id, "conflict.id"),
          bot_id: scope.bot_id,
          workspace_id: scope.workspace_id,
          owner_agent_id: scope.owner_agent_id,
          deployment_environment: scope.deployment_environment,
          release_channel: scope.release_channel,
          evidence_refs: optionalStringArrayV1(
            row.evidence_refs,
            "conflict.evidence_refs",
          ),
          created_at: instantV1(row.created_at, "conflict.created_at"),
          updated_at: instantV1(row.updated_at, "conflict.updated_at"),
        })) as unknown as readonly KnowThatConflictV1[],
        events: [],
        linkage_jobs: linkages.rows.map(({ row }) => linkageFromRowV1(row, scope)),
        query_revisions: {
          [scopeKeyV1(scope)]:
            revisionPointer.rows[0] === undefined
              ? 1
              : numberV1(
                  revisionPointer.rows[0].current_revision,
                  "query_revision.current_revision",
                ),
        },
      });
    },
  );
}

async function loadCurrentProjectionRowsV1(
  composition: CompositionV1,
  botId: string,
): Promise<Map<string, CurrentProjectionRowV1>> {
  return composition.read_committed_postgres.withReadCommittedTransaction(
    async (transaction) => {
      const result = await transaction.query<CurrentProjectionRowV1>(
        `SELECT fact_id, visible_from_revision, search_vector, projection_payload, status,
                category, semantic_key, updated_at, valid_from, valid_until
           FROM knowthat.knowthat_fact_query_versions
          WHERE bot_id = $1 AND visible_until_revision IS NULL`,
        [botId],
      );
      return new Map(result.rows.map((row) => [row.fact_id, row]));
    },
  );
}

function commandErrorV1(
  error: KnowThatDurableFailureV1 | null,
): Readonly<Record<string, unknown>> | null {
  return error === null ? null : error;
}

function isOwnerFenceConflictV1(error: unknown): boolean {
  const visit = (value: unknown, depth: number): boolean => {
    if (depth > 6 || typeof value !== "object" || value === null) return false;
    const record = value as Readonly<Record<string, unknown>>;
    return (
      record.code === "40001" ||
      record.code === "23505" ||
      visit(record.cause, depth + 1)
    );
  };
  return visit(error, 0);
}

export function createPostgresKnowThatStoreV1(
  composition: CompositionV1,
  config: KnowThatConfigV1,
  options: PostgresKnowThatStoreOptionsV1,
): KnowThatStorePortV1 {
  const memoryLeaseSeconds = options.memory_command_lease_seconds ?? 30;
  const eventLeaseSeconds = options.event_lease_seconds ?? 30;
  const eventEpoch = options.event_transport_epoch ?? "bootstrap";
  const eventGeneration = options.event_transport_generation ?? 1;
  const commandClaims = new Map<string, string>();
  const bufferedAcks: PromotionAckCommandV1[] = [];
  const bufferedReleases: PromotionReleaseCommandV1[] = [];

  const currentRevision = async (scope: KnowThatScopeV1): Promise<number> => {
    const result = await composition.read_committed_postgres.withReadCommittedTransaction(
      async (transaction) =>
        transaction.query<{ current_revision: string }>(
          `SELECT current_revision
             FROM knowthat.knowthat_query_revisions
            WHERE bot_id = $1`,
          [scope.bot_id],
        ),
    );
    return result.rows[0] === undefined
      ? 1
      : numberV1(result.rows[0].current_revision, "query.current_revision");
  };

  const readCommandById = async (
    commandId: string,
  ): Promise<PromotionAckCommandV1 | PromotionReleaseCommandV1> => {
    const result =
      await composition.read_committed_postgres.withReadCommittedTransaction(
        async (transaction) =>
          transaction.query<JsonRowV1>(
            `SELECT jsonb_build_object(
                      'id', row.id,
                      'bot_id', row.bot_id,
                      'command_type', row.command_type,
                      'reservation_id', row.reservation_id,
                      'candidate_fact_id', row.candidate_fact_id,
                      'fencing_generation', row.fencing_generation,
                      'reservation_token_hash', row.reservation_token_hash,
                      'promotion_revision_id', row.promotion_revision_id,
                      'committed_at', row.committed_at,
                      'reservation_expires_at', row.reservation_expires_at,
                      'release_reason', row.release_reason,
                      'released_at', row.released_at,
                      'idempotency_key', row.idempotency_key,
                      'request_hash', row.request_hash,
                      'payload', row.payload,
                      'status', row.status,
                      'attempt_count', row.attempt_count,
                      'next_retry_at', row.next_retry_at,
                      'last_error', row.last_error,
                      'created_at', row.created_at,
                      'updated_at', row.updated_at
                    ) AS row
               FROM knowthat.knowthat_memory_command_outbox AS row
              WHERE row.id = $1`,
            [commandId],
          ),
      );
    if (result.rows[0] === undefined) {
      throw new KnowThatErrorV1(
        "invalid_state",
        "KnowThat promotion command was not found",
        false,
      );
    }
    return commandFromRowV1(result.rows[0].row);
  };

  const claimMemoryCommands = async (
    limit: number,
    now: Date,
  ): Promise<readonly (PromotionAckCommandV1 | PromotionReleaseCommandV1)[]> => {
    if (limit <= 0) return Object.freeze([]);
    const rows = await composition.outbox.claim<Readonly<Record<string, unknown>>>({
      outbox_table: "knowthat_memory_command_outbox",
      worker_id: options.memory_command_worker_id,
      limit,
      lease_seconds: memoryLeaseSeconds,
      now: now.toISOString(),
      current_transport_epoch: options.memory_command_transport_epoch,
      current_transport_generation: options.memory_command_transport_generation,
    });
    return Object.freeze(
      rows.map((row) => {
        const command = commandFromRowV1(row);
        commandClaims.set(
          command.id,
          textV1(row.claim_token, "command.claim_token"),
        );
        return command;
      }),
    );
  };

  const claimCommittedMemoryCommands = async (
    commit: KnowThatCandidateReviewCommitV1,
    now: Date,
  ): Promise<KnowThatCandidateReviewCommitV1> => {
    const expectedIds = new Set(
      [
        commit.promotion_ack_command?.id,
        commit.promotion_release_command?.id,
      ].filter((id): id is string => id !== undefined),
    );
    if (expectedIds.size === 0) return commit;
    const claimed = await claimMemoryCommands(16, now);
    let ack = commit.promotion_ack_command;
    let release = commit.promotion_release_command;
    for (const command of claimed) {
      if (command.id === commit.promotion_ack_command?.id) {
        ack = command as PromotionAckCommandV1;
        continue;
      }
      if (command.id === commit.promotion_release_command?.id) {
        release = command as PromotionReleaseCommandV1;
        continue;
      }
      if (command.command_type === "promotion_reservation_ack") {
        bufferedAcks.push(command);
      } else {
        bufferedReleases.push(command);
      }
    }
    return Object.freeze({
      ...commit,
      promotion_ack_command: ack,
      promotion_release_command: release,
    });
  };

  const commandSettlementError = (
    commandType:
      | "promotion_reservation_ack"
      | "promotion_reservation_release",
    error: KnowThatDurableFailureV1 | null,
  ): Readonly<Record<string, unknown>> =>
    commandErrorV1(error) ??
    knowThatDurableFailureV1(
      commandType === "promotion_reservation_ack"
        ? "promotion_ack_unavailable"
        : "promotion_release_unavailable",
    );

  const settlePromotionCommand = async (
    commandId: string,
    commandType:
      | "promotion_reservation_ack"
      | "promotion_reservation_release",
    outcome: "sent" | "retry_wait" | "failed",
    error: KnowThatDurableFailureV1 | null,
    now: Date,
  ): Promise<PromotionAckCommandV1 | PromotionReleaseCommandV1> => {
    const claimToken = commandClaims.get(commandId);
    if (claimToken === undefined) {
      throw new KnowThatErrorV1(
        "invalid_state",
        "KnowThat promotion command has no active claim",
        false,
      );
    }
    await composition.outbox.acknowledge({
      outbox_table: "knowthat_memory_command_outbox",
      outbox_id: commandId,
      claim_token: claimToken,
      outcome,
      next_retry_at:
        outcome === "retry_wait"
          ? new Date(now.getTime() + config.retry_base_ms).toISOString()
          : null,
      error:
        outcome === "sent"
          ? null
          : commandSettlementError(commandType, error),
      transport_ref: outcome === "sent" ? `memory:${commandId}` : null,
      transport_epoch:
        outcome === "sent" ? options.memory_command_transport_epoch : null,
      transport_generation:
        outcome === "sent"
          ? options.memory_command_transport_generation
          : null,
      current_transport_epoch: options.memory_command_transport_epoch,
      current_transport_generation: options.memory_command_transport_generation,
      now: now.toISOString(),
    });
    commandClaims.delete(commandId);
    const settled = await readCommandById(commandId);
    if (settled.command_type !== commandType) {
      throw new KnowThatErrorV1(
        "invalid_state",
        "KnowThat promotion command type drifted after settlement",
        false,
      );
    }
    return settled;
  };

  const store: KnowThatStorePortV1 = {
    async writeBatch(request, requestHash, now) {
      const existing =
        await composition.read_committed_postgres.withReadCommittedTransaction(
          async (transaction) =>
            transaction.query<JsonRowV1>(
              `SELECT to_jsonb(row) AS row
                 FROM knowthat.knowthat_write_batches AS row
                WHERE bot_id = $1 AND idempotency_key = $2`,
              [request.bot_id, request.idempotency_key],
            ),
        );
      if (existing.rows[0] !== undefined) {
        const row = existing.rows[0].row;
        if (row.request_hash !== requestHash) {
          throw new KnowThatErrorV1(
            "idempotency_conflict",
            "KnowThat batch idempotency key drifted",
            false,
          );
        }
        const response = recordV1(row.response_payload, "batch.response_payload");
        return snapshotCanonicalJsonV1({
          ...response,
          duplicate_replayed: true,
          item_results: Array.isArray(response.item_results)
            ? response.item_results.map((item) =>
                typeof item === "object" &&
                item !== null &&
                (item as { status?: unknown }).status === "succeeded"
                  ? { ...item, duplicate_replayed: true }
                  : item,
              )
            : response.item_results,
        }) as ReturnType<KnowThatStorePortV1["writeBatch"]> extends Promise<infer T>
          ? T
          : never;
      }

      const seed = await loadSeedV1(composition, request);
      const memory = createInMemoryKnowThatStoreV1(config, seed);
      const before = memory.inspect();
      const beforeRevision = seed.query_revisions?.[scopeKeyV1(request)] ?? 1;
      const response = await memory.writeBatch(request, requestHash, now);
      const after = memory.inspect();
      const factChanges = changedByIdV1(before.facts, after.facts);
      const newRevisions = addedByIdV1(before.revisions, after.revisions);
      const newConflicts = addedByIdV1(before.conflicts, after.conflicts);
      const newEvents = addedByKeyV1(
        before.events,
        after.events,
        (event) => event.event_id,
      );
      const newLinkages = addedByIdV1(before.linkage_jobs, after.linkage_jobs);
      const afterRevision = after.query_revisions[scopeKeyV1(request)] ?? beforeRevision;
      const projectionRows = await loadCurrentProjectionRowsV1(
        composition,
        request.bot_id,
      );
      const eventsByAggregate = new Map<string, KnowThatEventV1[]>();
      for (const event of newEvents) {
        const id = eventAggregateIdV1(event);
        const list = eventsByAggregate.get(id) ?? [];
        list.push(event);
        eventsByAggregate.set(id, list);
      }

      await composition.unit_of_work.withTransaction(
        {
          operation: "knowthat_write_batch_commit",
          idempotency_key: request.idempotency_key,
          trace_id: request.trace_id,
          isolation: "serializable",
          retry: "none",
        },
        async (transaction, { owner }) => {
          for (const { before: prior, after: fact } of factChanges) {
            const revision = newRevisions.find((entry) => entry.fact_id === fact.id);
            if (revision === undefined) continue;
            const payload = {
              knowthat_facts: factRowV1(fact),
              knowthat_fact_revisions: revisionRowV1(revision),
              knowthat_event_outbox: (eventsByAggregate.get(fact.id) ?? []).map(eventRowV1),
            };
            if (prior === undefined) {
              await owner.executeWriter(transaction, {
                writer: "create_knowthat_fact_v1",
                arguments: {
                  p_fact_id: fact.id,
                  p_fact: payload,
                  p_initial_revision: payload,
                  p_idempotency_key: `${request.idempotency_key}:fact:${fact.id}`,
                  p_request_hash: canonicalHashV1(payload),
                  p_trace_id: request.trace_id,
                },
                expected_rows: 1,
              });
            } else {
              await owner.executeWriter(transaction, {
                writer: "transition_knowthat_fact_v1",
                arguments: {
                  p_fact_id: fact.id,
                  p_expected_status: prior.status,
                  p_expected_state_version: String(prior.state_version),
                  p_expected_updated_at: prior.updated_at,
                  p_next_status: fact.status,
                  p_fact_revision: payload,
                  p_request_hash: canonicalHashV1(payload),
                  p_trace_id: request.trace_id,
                },
                expected_rows: 1,
              });
            }
          }
          for (const conflict of newConflicts) {
            const payload = {
              knowthat_conflicts: {
                ...conflict,
                field_path: null,
                payload_schema_version: "knowthat_conflict.v1",
              },
              knowthat_event_outbox: (eventsByAggregate.get(conflict.id) ?? []).map(eventRowV1),
            };
            await owner.executeWriter(transaction, {
              writer: "append_knowthat_conflict_v1",
              arguments: {
                p_conflict_id: conflict.id,
                p_fact_id: conflict.right_fact_id,
                p_conflict: payload,
                p_idempotency_key: `${request.idempotency_key}:conflict:${conflict.id}`,
                p_request_hash: canonicalHashV1(payload),
                p_trace_id: request.trace_id,
              },
              expected_rows: 1,
            });
          }
          for (const linkage of newLinkages) {
            const payload = {
              knowthat_linkage_checks: linkageRowV1(linkage),
              knowthat_event_outbox: (eventsByAggregate.get(linkage.id) ?? []).map(eventRowV1),
            };
            await owner.executeWriter(transaction, {
              writer: "enqueue_knowthat_linkage_check_v1",
              arguments: {
                p_linkage_check_id: linkage.id,
                p_fact_id: linkage.fact_id,
                p_linkage_check: payload,
                p_idempotency_key: linkage.idempotency_key,
                p_request_hash: canonicalHashV1(payload),
                p_trace_id: request.trace_id,
              },
              expected_rows: 1,
            });
          }
          if (afterRevision > beforeRevision) {
            const queryVersions = factChanges.flatMap(({ before: prior, after: fact }) => {
              const rows: Readonly<Record<string, unknown>>[] = [];
              const existing = projectionRows.get(fact.id);
              if (prior !== undefined && existing !== undefined) {
                rows.push({
                  bot_id: request.bot_id,
                  fact_id: fact.id,
                  visible_from_revision: numberV1(
                    existing.visible_from_revision,
                    "projection.visible_from_revision",
                  ),
                  visible_until_revision: afterRevision,
                  status: existing.status,
                  category: existing.category,
                  semantic_key: existing.semantic_key,
                  updated_at: instantV1(existing.updated_at, "projection.updated_at"),
                  valid_from: nullableInstantV1(
                    existing.valid_from,
                    "projection.valid_from",
                  ),
                  valid_until: nullableInstantV1(
                    existing.valid_until,
                    "projection.valid_until",
                  ),
                  search_vector: textV1(existing.search_vector, "projection.search_vector"),
                  projection_payload: existing.projection_payload,
                });
              }
              rows.push(queryVersionRowV1({
                fact,
                visible_from_revision: afterRevision,
                visible_until_revision: null,
              }));
              return rows;
            });
            await owner.executeWriter(transaction, {
              writer: "cas_knowthat_query_revision_v1",
              arguments: {
                p_query_key: request.bot_id,
                p_expected_revision: String(beforeRevision),
                p_query_revision: {
                  knowthat_query_revisions: {
                    bot_id: request.bot_id,
                    current_revision: afterRevision,
                    updated_at: now.toISOString(),
                  },
                  knowthat_fact_query_versions: queryVersions,
                },
                p_aliases: {},
                p_request_hash: canonicalHashV1(queryVersions),
                p_trace_id: request.trace_id,
              },
              expected_rows: 1,
            });
          }
          await owner.executeWriter(transaction, {
            writer: "create_knowthat_write_batch_v1",
            arguments: {
              p_batch_id: response.write_batch_id,
              p_batch: {
                knowthat_write_batches: {
                  id: response.write_batch_id,
                  bot_id: request.bot_id,
                  trigger_process_id: request.trigger_process_id,
                  source_meta_job_id: request.source_meta_job_id,
                  idempotency_key: request.idempotency_key,
                  request_hash: requestHash,
                  trace_id: request.trace_id,
                  request_payload: { owner_scope_v1: request, request },
                  response_payload: response,
                  status: response.batch_status,
                  payload_schema_version: "knowthat.write_batch.v1",
                  created_at: now.toISOString(),
                  updated_at: now.toISOString(),
                },
              },
              p_idempotency_key: request.idempotency_key,
              p_request_hash: requestHash,
              p_trace_id: request.trace_id,
            },
            expected_rows: 1,
          });
        },
      );
      return response;
    },

    async readFact(scope, factId) {
      const result =
        await composition.read_committed_postgres.withReadCommittedTransaction(
          async (transaction) =>
            transaction.query<JsonRowV1>(
              `SELECT to_jsonb(row) AS row
                 FROM knowthat.knowthat_facts AS row
                WHERE row.bot_id = $1 AND row.id = $2`,
              [scope.bot_id, factId],
            ),
        );
      return result.rows[0] === undefined
        ? undefined
        : factFromRowV1(result.rows[0].row, scope);
    },

    currentRevision,

    async minimumReplayableRevision(scope) {
      return Math.max(
        1,
        (await currentRevision(scope)) - config.replay_revision_window + 1,
      );
    },

    async queryAt(input) {
      const current = await currentRevision(input.scope);
      const minimum = Math.max(1, current - config.replay_revision_window + 1);
      if (input.revision < minimum || input.revision > current) {
        throw new KnowThatErrorV1(
          "snapshot_expired",
          "KnowThat query revision is not replayable",
          true,
        );
      }
      const result =
        await composition.read_committed_postgres.withReadCommittedTransaction(
          async (transaction) =>
            transaction.query<{
              projection_payload: Readonly<Record<string, unknown>>;
              category_priority: number;
              query_rank: number;
              updated_at: string | Date;
              fact_id: string;
            }>(
              `SELECT projection_payload,
                      CASE category
                        WHEN 'rule' THEN 7
                        WHEN 'project_fact' THEN 6
                        WHEN 'preference' THEN 5
                        WHEN 'user_profile' THEN 4
                        WHEN 'relationship_state' THEN 3
                        WHEN 'self_state' THEN 2
                        ELSE 1
                      END AS category_priority,
                      CASE
                        WHEN $5::text IS NULL THEN 0
                        WHEN lower((projection_payload->>'subject') || E'\n' ||
                                   (projection_payload->>'predicate') || E'\n' ||
                                   (projection_payload->>'object')) LIKE '%' || $5 || '%'
                          THEN 1
                        ELSE 0
                      END AS query_rank,
                      updated_at,
                      fact_id
                 FROM knowthat.knowthat_fact_query_versions
                WHERE bot_id = $1
                  AND visible_from_revision <= $2
                  AND (visible_until_revision IS NULL OR visible_until_revision > $2)
                  AND status = 'active'
                  AND ($3::text[] IS NULL OR category = ANY($3::text[]))
                  AND (valid_from IS NULL OR valid_from <= $4)
                  AND (valid_until IS NULL OR valid_until > $4)
                  AND ($5::text IS NULL OR lower(projection_payload::text) LIKE '%' || $5 || '%')
                ORDER BY category_priority DESC, query_rank DESC, updated_at DESC, fact_id ASC
                LIMIT $6`,
              [
                input.scope.bot_id,
                input.revision,
                input.categories.length === 0 ? null : [...input.categories],
                input.as_of.toISOString(),
                input.query,
                input.limit + 1,
              ],
            ),
        );
      const all = result.rows.map((row) => ({
        fact: snapshotCanonicalJsonV1(row.projection_payload) as unknown as KnowThatQueryFactV1,
        tuple: {
          category_priority: row.category_priority,
          query_rank: row.query_rank,
          updated_at: instantV1(row.updated_at, "query.updated_at"),
          fact_id: row.fact_id,
        },
      }));
      const afterIndex =
        input.after === null
          ? 0
          : all.findIndex(
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
      const page = all.slice(afterIndex, afterIndex + input.limit + 1);
      const hasMore = page.length > input.limit;
      const selected = hasMore ? page.slice(0, input.limit) : page;
      return Object.freeze({
        facts: Object.freeze(selected.map(({ fact }) => fact)),
        next: hasMore
          ? (selected.at(-1)!.tuple as KnowThatQueryCursorTupleV1)
          : null,
      });
    },

    async reviewCandidate(input) {
      const seed = await loadSeedV1(composition, input.request);
      const memory = createInMemoryKnowThatStoreV1(config, seed);
      const before = memory.inspect();
      const commit = await memory.reviewCandidate(input);
      const after = memory.inspect();
      const result = commit.result;
      const factChanges = changedByIdV1(before.facts, after.facts);
      const newRevisions = addedByIdV1(before.revisions, after.revisions);
      const newLinkages = addedByIdV1(before.linkage_jobs, after.linkage_jobs);
      const newEvents = addedByKeyV1(
        before.events,
        after.events,
        (event) => event.event_id,
      );
      const beforeRevision = seed.query_revisions?.[scopeKeyV1(input.request)] ?? 1;
      const afterRevision = after.query_revisions[scopeKeyV1(input.request)] ?? beforeRevision;
      const projectionRows = await loadCurrentProjectionRowsV1(
        composition,
        input.request.bot_id,
      );
      const eventsByAggregate = new Map<string, KnowThatEventV1[]>();
      for (const event of newEvents) {
        const id = eventAggregateIdV1(event);
        const list = eventsByAggregate.get(id) ?? [];
        list.push(event);
        eventsByAggregate.set(id, list);
      }
      const reviewRow = {
        id: result.review_id,
        fact_id: input.candidate_id,
        decision: result.decision,
        reason: input.request.reason,
        evidence_refs: [...input.request.new_evidence_refs],
        evidence_set_hash: canonicalHashV1(input.request.new_evidence_refs),
        source_meta_job_id: input.request.source_meta_job_id,
        target_candidate_version: input.request.target_candidate_version,
        reviewed_by: "meta_cognition",
        suggestion_id: input.request.suggestion_id,
        suggested_action: input.request.suggested_action,
        idempotency_key: input.request.idempotency_key,
        request_hash: input.request_hash,
        outcome: result.status,
        reason_code: result.reason_code,
        response_payload: result,
        promotion_reservation_id:
          input.promotion_reservation?.reservation_id ?? null,
        promotion_fence_generation:
          input.promotion_reservation?.fencing_generation ?? null,
        promotion_reservation_token_hash:
          input.promotion_reservation?.reservation_token_hash ?? null,
        promotion_reservation_expires_at:
          input.promotion_reservation?.expires_at ?? null,
        promotion_committed_at:
          commit.promotion_ack_command?.committed_at ?? null,
        created_at: input.now.toISOString(),
      };
      const inboxRow = {
        id: deterministicIdV1("knowthat_inbox", {
          source: input.request.source_event.source,
          event_id: input.request.source_event.event_id,
        }),
        source: input.request.source_event.source,
        event_id: input.request.source_event.event_id,
        idempotency_key: input.request.source_event.idempotency_key,
        payload_hash: input.request.source_event.payload_hash,
        semantic_hash: input.request.source_event.semantic_hash,
        scope_fingerprint: input.request.source_event.scope_fingerprint,
        processed_at: input.now.toISOString(),
        created_at: input.now.toISOString(),
      };
      const changedFact = factChanges.find(({ after: fact }) => fact.id === input.candidate_id);
      const queryVersions =
        afterRevision > beforeRevision
          ? factChanges.flatMap(({ before: prior, after: fact }) => {
              const rows: Readonly<Record<string, unknown>>[] = [];
              const existing = projectionRows.get(fact.id);
              if (prior !== undefined && existing !== undefined) {
                rows.push({
                  bot_id: input.request.bot_id,
                  fact_id: fact.id,
                  visible_from_revision: numberV1(
                    existing.visible_from_revision,
                    "projection.visible_from_revision",
                  ),
                  visible_until_revision: afterRevision,
                  status: existing.status,
                  category: existing.category,
                  semantic_key: existing.semantic_key,
                  updated_at: instantV1(existing.updated_at, "projection.updated_at"),
                  valid_from: nullableInstantV1(
                    existing.valid_from,
                    "projection.valid_from",
                  ),
                  valid_until: nullableInstantV1(
                    existing.valid_until,
                    "projection.valid_until",
                  ),
                  search_vector: textV1(existing.search_vector, "projection.search_vector"),
                  projection_payload: existing.projection_payload,
                });
              }
              rows.push(queryVersionRowV1({
                fact,
                visible_from_revision: afterRevision,
                visible_until_revision: null,
              }));
              return rows;
            })
          : [];
      const payload = {
        knowthat_facts:
          changedFact === undefined ? [] : factRowV1(changedFact.after),
        knowthat_fact_revisions: newRevisions.map(revisionRowV1),
        knowthat_candidate_reviews: reviewRow,
        knowthat_linkage_checks: newLinkages.map(linkageRowV1),
        knowthat_event_inbox: inboxRow,
        knowthat_event_dlq: [],
        knowthat_audit_logs: [],
        knowthat_query_revisions: [],
        knowthat_fact_query_versions: [],
        knowthat_memory_command_outbox: [
          ...(commit.promotion_ack_command === null
            ? []
            : [commandRowV1(commit.promotion_ack_command)]),
          ...(commit.promotion_release_command === null
            ? []
            : [commandRowV1(commit.promotion_release_command)]),
        ],
        knowthat_event_outbox: newEvents.map(eventRowV1),
      };
      await composition.unit_of_work.withTransaction(
        {
          operation: "knowthat_candidate_review_commit",
          idempotency_key: input.request.idempotency_key,
          trace_id: input.request.trace_id,
          isolation: "serializable",
          retry: "none",
        },
        async (transaction, { owner }) => {
          await owner.executeWriter(transaction, {
            writer: "record_knowthat_candidate_review_v1",
            arguments: {
              p_review_id: result.review_id,
              p_fact_id: input.candidate_id,
              p_source_meta_job_id: input.request.source_meta_job_id,
              p_suggestion_id: input.request.suggestion_id,
              p_expected_candidate_version:
                input.request.target_candidate_version,
              p_suggested_action: input.request.suggested_action,
              p_review: payload,
              p_promotion_evidence: input.promotion_evidence ?? null,
              p_promotion_reservation: input.promotion_reservation ?? null,
              p_memory_ack_command: commit.promotion_ack_command ?? null,
              p_memory_release_command: commit.promotion_release_command ?? null,
              p_source_event: ownerWriterSourceEventV1(
                input.request.source_event,
              ),
              p_idempotency_key: input.request.idempotency_key,
              p_request_hash: input.request_hash,
              p_payload_hash: canonicalHashV1(result),
              p_semantic_hash: input.request.source_event.semantic_hash,
              p_scope_fingerprint: input.request.source_event.scope_fingerprint,
              p_trace_id: input.request.trace_id,
            },
            expected_rows: 1,
          });
          if (afterRevision > beforeRevision) {
            await owner.executeWriter(transaction, {
              writer: "cas_knowthat_query_revision_v1",
              arguments: {
                p_query_key: input.request.bot_id,
                p_expected_revision: String(beforeRevision),
                p_query_revision: {
                  knowthat_query_revisions: {
                    bot_id: input.request.bot_id,
                    current_revision: afterRevision,
                    updated_at: input.now.toISOString(),
                  },
                  knowthat_fact_query_versions: queryVersions,
                },
                p_aliases: {},
                p_request_hash: canonicalHashV1(queryVersions),
                p_trace_id: input.request.trace_id,
              },
              expected_rows: 1,
            });
          }
        },
      );
      return claimCommittedMemoryCommands(commit, input.now);
    },

    async readCandidateReview({ request, request_hash }) {
      const result =
        await composition.read_committed_postgres.withReadCommittedTransaction(
          async (transaction) =>
            transaction.query<JsonRowV1>(
              `SELECT to_jsonb(row) AS row
                 FROM knowthat.knowthat_candidate_reviews AS row
                WHERE idempotency_key = $1`,
              [request.idempotency_key],
            ),
        );
      const row = result.rows[0]?.row;
      if (row === undefined) return undefined;
      if (row.request_hash !== request_hash) {
        throw new KnowThatErrorV1(
          "idempotency_conflict",
          "KnowThat candidate review idempotency key drifted",
          false,
        );
      }
      const commands =
        await composition.read_committed_postgres.withReadCommittedTransaction(
          async (transaction) =>
            transaction.query<JsonRowV1>(
              `SELECT jsonb_build_object(
                        'id', row.id,
                        'bot_id', row.bot_id,
                        'command_type', row.command_type,
                        'reservation_id', row.reservation_id,
                        'candidate_fact_id', row.candidate_fact_id,
                        'fencing_generation', row.fencing_generation,
                        'reservation_token_hash', row.reservation_token_hash,
                        'promotion_revision_id', row.promotion_revision_id,
                        'committed_at', row.committed_at,
                        'reservation_expires_at', row.reservation_expires_at,
                        'release_reason', row.release_reason,
                        'released_at', row.released_at,
                        'idempotency_key', row.idempotency_key,
                        'request_hash', row.request_hash,
                        'payload', row.payload,
                        'status', row.status,
                        'attempt_count', row.attempt_count,
                        'next_retry_at', row.next_retry_at,
                        'last_error', row.last_error,
                        'created_at', row.created_at,
                        'updated_at', row.updated_at
                      ) AS row
                 FROM knowthat.knowthat_memory_command_outbox AS row
                WHERE candidate_fact_id = $1
                  AND reservation_id = $2
                ORDER BY created_at, id`,
              [
                row.fact_id,
                row.promotion_reservation_id === null
                  ? ""
                  : row.promotion_reservation_id,
              ],
            ),
        );
      const mapped = commands.rows.map(({ row: commandRow }) =>
        commandFromRowV1(commandRow, request),
      );
      return Object.freeze({
        result: snapshotCanonicalJsonV1(
          row.response_payload,
        ) as KnowThatCandidateReviewCommitV1["result"],
        promotion_ack_command:
          mapped.find(
            (command): command is PromotionAckCommandV1 =>
              command.command_type === "promotion_reservation_ack",
          ) ?? null,
        promotion_release_command:
          mapped.find(
            (command): command is PromotionReleaseCommandV1 =>
              command.command_type === "promotion_reservation_release",
          ) ?? null,
      });
    },

    async pendingPromotionAcks({ limit, now }) {
      const selected = bufferedAcks.splice(0, limit);
      if (selected.length < limit) {
        const claimed = await claimMemoryCommands(limit - selected.length, now);
        for (const command of claimed) {
          if (command.command_type === "promotion_reservation_ack") {
            selected.push(command);
          } else {
            bufferedReleases.push(command);
          }
        }
      }
      return Object.freeze(selected);
    },

    async settlePromotionAck({ command_id, outcome, error, now }) {
      return settlePromotionCommand(
        command_id,
        "promotion_reservation_ack",
        outcome,
        error,
        now,
      ) as Promise<PromotionAckCommandV1>;
    },

    async ensurePromotionRelease(input) {
      const existingReview =
        await composition.read_committed_postgres.withReadCommittedTransaction(
          async (transaction) =>
            transaction.query<{ id: string }>(
              `SELECT id
                 FROM knowthat.knowthat_candidate_reviews
                WHERE idempotency_key = $1
                LIMIT 1`,
              [input.request.idempotency_key],
            ),
        );
      if (existingReview.rows[0] !== undefined) {
        throw new KnowThatErrorV1(
          "promotion_retry_required",
          "KnowThat candidate review committed before the release handoff",
          true,
        );
      }
      const command = await createInMemoryKnowThatStoreV1(config)
        .ensurePromotionRelease(input);
      await composition.unit_of_work.withTransaction(
        {
          operation: "knowthat_promotion_release_enqueue",
          idempotency_key: command.idempotency_key,
          trace_id: input.request.trace_id,
          isolation: "serializable",
          retry: "none",
        },
        async (transaction, { owner }) => {
          await owner.executeWriter(transaction, {
            writer: "enqueue_knowthat_promotion_release_v1",
            arguments: {
              p_command: {
                knowthat_memory_command_outbox: commandRowV1(command),
              },
              p_idempotency_key: command.idempotency_key,
              p_request_hash: command.request_hash,
              p_trace_id: input.request.trace_id,
            },
            expected_rows: 1,
          });
        },
      );
      return command;
    },

    async pendingPromotionReleases({ limit, now }) {
      const selected = bufferedReleases.splice(0, limit);
      if (selected.length < limit) {
        const claimed = await claimMemoryCommands(limit - selected.length, now);
        for (const command of claimed) {
          if (command.command_type === "promotion_reservation_release") {
            selected.push(command);
          } else {
            bufferedAcks.push(command);
          }
        }
      }
      return Object.freeze(selected);
    },

    async settlePromotionRelease({ command_id, outcome, error, now }) {
      return settlePromotionCommand(
        command_id,
        "promotion_reservation_release",
        outcome,
        error,
        now,
      ) as Promise<PromotionReleaseCommandV1>;
    },

    async expireDue() {
      return Object.freeze([]);
    },

    async claimLinkage(input) {
      const candidates =
        await composition.read_committed_postgres.withReadCommittedTransaction(
          async (transaction) =>
            transaction.query<JsonRowV1>(
              `SELECT to_jsonb(row) AS row
                 FROM knowthat.knowthat_linkage_checks AS row
                WHERE row.status = 'pending'
                   OR (
                     row.status = 'retry_wait'
                     AND (row.next_retry_at IS NULL OR row.next_retry_at <= $2)
                   )
                   OR (
                     row.status = 'running'
                     AND row.locked_until IS NOT NULL
                     AND row.locked_until <= $2
                   )
                ORDER BY row.updated_at, row.id
                LIMIT $1`,
              [input.limit, input.now.toISOString()],
            ),
        );
      const claimed: Array<Readonly<{
        fence: KnowThatLinkageFenceV1;
        job: KnowThatLinkageJobV1;
      }>> = [];
      for (const { row } of candidates.rows) {
        const candidate = linkageFromRowV1(row, undefined);
        const result = await composition.unit_of_work
          .withTransaction(
            {
              operation: "knowthat_linkage_claim",
              idempotency_key: `${input.worker_id}:${candidate.id}:${candidate.job_version}`,
              trace_id: candidate.id,
              isolation: "serializable",
              retry: "none",
            },
            async (transaction, { owner }) =>
              owner.executeWriter(transaction, {
                writer: "claim_knowthat_linkage_check_v1",
                arguments: {
                  p_linkage_check_id: candidate.id,
                  p_expected_status: candidate.status,
                  p_expected_job_version: String(candidate.job_version),
                  p_expected_updated_at: candidate.updated_at,
                  p_worker_id: input.worker_id,
                  p_lease_seconds: Math.max(
                    1,
                    Math.ceil(config.linkage_lease_ms / 1_000),
                  ),
                  p_now: input.now.toISOString(),
                  p_trace_id: candidate.id,
                },
                expected_rows: 1,
              }),
          )
          .catch((error: unknown) => {
            if (isOwnerFenceConflictV1(error)) return undefined;
            throw error;
          });
        if (result === undefined) continue;
        const job = linkageFromRowV1(
          result as Readonly<Record<string, unknown>>,
          undefined,
        );
        claimed.push(Object.freeze({
          fence: Object.freeze({
            linkage_job_id: job.id,
            lease_generation: job.lease_generation,
            claim_token: textV1(job.claim_token, "linkage.claim_token"),
            worker_id: input.worker_id,
          }),
          job,
        }));
      }
      return Object.freeze(claimed);
    },

    async settleLinkage(input) {
      const current =
        await composition.read_committed_postgres.withReadCommittedTransaction(
          async (transaction) =>
            transaction.query<JsonRowV1>(
              `SELECT to_jsonb(row) AS row
                 FROM knowthat.knowthat_linkage_checks AS row
                WHERE row.id = $1`,
              [input.fence.linkage_job_id],
            ),
        );
      const currentRow = current.rows[0]?.row;
      if (currentRow === undefined) {
        throw new KnowThatErrorV1(
          "fact_not_found",
          "KnowThat linkage job was not found",
          false,
        );
      }
      const currentJob = linkageFromRowV1(currentRow, undefined);
      let outcome = input.outcome;
      if (
        outcome === "retry_wait" &&
        currentJob.attempt_count >= config.max_linkage_attempts
      ) {
        outcome = "failed";
      }
      const result = await composition.unit_of_work.withTransaction(
        {
          operation: "knowthat_linkage_settle",
          idempotency_key: `${input.fence.linkage_job_id}:${input.fence.lease_generation}:${outcome}`,
          trace_id: input.fence.linkage_job_id,
          isolation: "serializable",
          retry: "none",
        },
        async (transaction, { owner }) =>
          owner.executeWriter(transaction, {
            writer: "transition_knowthat_linkage_check_v1",
            arguments: {
              p_linkage_check_id: input.fence.linkage_job_id,
              p_expected_lease_generation: String(
                input.fence.lease_generation,
              ),
              p_claim_token: input.fence.claim_token,
              p_worker_id: input.fence.worker_id,
              p_next_status: outcome,
              p_result: {
                knowthat_linkage_checks: {
                  status: outcome,
                  result: input.result,
                  next_retry_at:
                    outcome === "retry_wait"
                      ? new Date(
                          input.now.getTime() + config.retry_base_ms,
                        ).toISOString()
                      : null,
                  last_error:
                    outcome === "retry_wait"
                      ? knowThatDurableFailureV1("linkage_retry_required")
                      : outcome === "failed"
                        ? knowThatDurableFailureV1("linkage_failed")
                        : null,
                  claim_token: null,
                  locked_by: null,
                  locked_until: null,
                  lease_generation: input.fence.lease_generation,
                  job_version: currentJob.job_version + 1,
                },
              },
              p_memory_command: {},
              p_request_hash: canonicalHashV1({
                outcome,
                result: input.result,
                error: input.error,
              }),
              p_trace_id: input.fence.linkage_job_id,
            },
            expected_rows: 1,
          }),
      );
      return linkageFromRowV1(
        result as Readonly<Record<string, unknown>>,
        undefined,
      );
    },

    async recoverLinkage(request) {
      const receipt = {
        id: deterministicIdV1("knowthat_linkage_recovery", {
          linkage_job_id: request.linkage_job_id,
          idempotency_key: request.idempotency_key,
        }),
        bot_id: request.bot_id,
        linkage_check_id: request.linkage_job_id,
        idempotency_key: request.idempotency_key,
        request_hash: request.request_hash,
      };
      const response = await composition.unit_of_work.withTransaction(
        {
          operation: "knowthat_linkage_recover",
          idempotency_key: request.idempotency_key,
          trace_id: request.trace_id,
          isolation: "serializable",
          retry: "none",
        },
        async (transaction, { owner }) =>
          owner.executeWriter(transaction, {
            writer: "recover_knowthat_linkage_check_v1",
            arguments: {
              p_linkage_check_id: request.linkage_job_id,
              p_expected_job_version: String(request.expected_job_version),
              p_recovery_action: request.recovery_action,
              p_reason: request.reason,
              p_receipt: receipt,
              p_idempotency_key: request.idempotency_key,
              p_request_hash: request.request_hash,
              p_trace_id: request.trace_id,
            },
            expected_rows: 1,
          }),
      );
      const responseRecord = recordV1(response, "recovery.response");
      return Object.freeze({
        duplicate_replayed: responseRecord.duplicate_replayed === true,
        linkage_job: linkageFromRowV1(
          recordV1(responseRecord.linkage_job_row, "recovery.linkage_job_row"),
          request,
        ),
      });
    },

    async claimEvents(input) {
      const claims = await composition.outbox.claim<Readonly<Record<string, unknown>>>({
        outbox_table: "knowthat_event_outbox",
        worker_id: input.worker_id,
        limit: input.limit,
        lease_seconds: eventLeaseSeconds,
        now: input.now.toISOString(),
        current_transport_epoch: eventEpoch,
        current_transport_generation: eventGeneration,
      });
      return Object.freeze(
        claims.map((row): KnowThatEventDispatchClaimV1 => {
          const payload = recordV1(row.payload, "event.payload");
          const scope = scopeFromRecordV1(payload, "event.payload");
          const event = eventFromRowV1(row, scope);
          return Object.freeze({
            fence: Object.freeze({
              event_id: event.event_id,
              claim_token: textV1(row.claim_token, "event.claim_token"),
            }),
            event: Object.freeze({
              event_id: event.event_id,
              event_type: event.event_type,
              schema_version: event.schema_version,
              producer: event.producer,
              occurred_at: event.occurred_at,
              idempotency_key: event.idempotency_key,
              trace_id: event.trace_id,
              payload: event.payload as KnowThatEventDispatchClaimV1["event"]["payload"],
            }),
            target: event.target,
            payload_hash: event.payload_hash,
            attempt_count: event.attempt_count,
          });
        }),
      );
    },

    async ackEvent(input) {
      await composition.outbox.acknowledge({
        outbox_table: "knowthat_event_outbox",
        outbox_id: input.event_id,
        claim_token: input.claim_token,
        outcome: input.outcome,
        next_retry_at:
          input.outcome === "retry_wait"
            ? new Date(input.now.getTime() + config.retry_base_ms).toISOString()
            : null,
        error:
          input.outcome === "sent"
            ? null
            : { failure_code: "event_dispatch_failed" },
        transport_ref:
          input.outcome === "sent" ? `redis_stream:${input.event_id}` : null,
        transport_epoch: input.outcome === "sent" ? eventEpoch : null,
        transport_generation: input.outcome === "sent" ? eventGeneration : null,
        current_transport_epoch: eventEpoch,
        current_transport_generation: eventGeneration,
        now: input.now.toISOString(),
      });
      const result =
        await composition.read_committed_postgres.withReadCommittedTransaction(
          async (transaction) =>
            transaction.query<JsonRowV1>(
              `SELECT jsonb_build_object(
                        'id', row.id,
                        'bot_id', row.bot_id,
                        'event_type', row.event_type,
                        'schema_version', row.schema_version,
                        'producer', row.producer,
                        'occurred_at', row.occurred_at,
                        'idempotency_key', row.idempotency_key,
                        'trace_id', row.trace_id,
                        'payload', row.payload,
                        'payload_hash', row.payload_hash,
                        'target', row.target,
                        'status', row.status,
                        'attempt_count', row.attempt_count,
                        'next_retry_at', row.next_retry_at,
                        'claim_token', NULL,
                        'locked_until', NULL
                      ) AS row
                 FROM knowthat.knowthat_event_outbox AS row
                WHERE row.id = $1`,
              [input.event_id],
            ),
        );
      const row = result.rows[0]?.row;
      if (row === undefined) {
        throw new KnowThatErrorV1(
          "invalid_state",
          "KnowThat event outbox row was not found after acknowledgement",
          false,
        );
      }
      return eventFromRowV1(
        row,
        scopeFromRecordV1(recordV1(row.payload, "event.payload"), "event.payload"),
      );
    },

    async checkReadiness(signal) {
      await composition.checkReadiness(signal);
    },
  };
  return Object.freeze(store);
}
