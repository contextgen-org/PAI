import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { isProxy } from "node:util/types";

import { Value } from "@sinclair/typebox/value";

import {
  CanonicalJsonViolationV1,
  canonicalJsonV1 as sharedCanonicalJsonV1,
} from "@pai/contracts";
import {
  MEMORY_EMOTION_TAGS_V1,
  MEMORY_SCENE_TAGS_V1,
  MemoryWriteItemV1Schema,
  MemoryWriteBatchResponseV1Schema,
  assertMemoryWriteBatchRequestSemanticBindingsV1,
  assertMemoryWriteBatchResponseSemanticBindingsV1,
  type MemoryRelationPayloadV1 as MemoryRelationV1,
  type MemorySourceInfoV1,
  type MemorySubjectRefV1,
  type MemoryWriteBatchRequestV1,
  type MemoryWriteBatchResponseV1,
  type MemoryWriteItemV1,
  type MemoryWriteRejectedV1,
  type MemoryWriteSucceededV1,
} from "@pai/contracts/memory/write-batch.v1";
import {
  MEMORY_FAST_RECALL_PRIORITY_DIMENSIONS_V1,
  MemoryFastRecallRequestV1Schema,
  MemoryFastRecallResponseV1Schema,
  assertMemoryFastRecallRequestSemanticBindingsV1,
  assertMemoryFastRecallResponseSemanticBindingsV1,
  type MemoryFastRecallItemV1,
  type MemoryFastRecallRequestV1,
  type MemoryFastRecallResponseV1,
} from "@pai/contracts/memory/fast-recall.v1";
import {
  MemoryIntegrationCheckpointRequestV1Schema,
  MemoryIntegrationClaimRequestV1Schema,
  MemoryIntegrationClaimV1Schema,
  MemoryIntegrationFinishRequestV1Schema,
  MemoryIntegrationJobDetailsV1Schema,
  MemoryIntegrationRunRequestV1Schema,
  MemoryIntegrationRunResponseV1Schema,
  assertMemoryIntegrationCheckpointRequestSemanticBindingsV1,
  assertMemoryIntegrationFinishRequestSemanticBindingsV1,
  assertMemoryIntegrationJobSemanticBindingsV1,
  assertMemoryIntegrationRunRequestSemanticBindingsV1,
  assertMemoryIntegrationRunResponseSemanticBindingsV1,
  type MemoryIntegrationCheckpointRequestV1,
  type MemoryIntegrationClaimRequestV1,
  type MemoryIntegrationClaimV1,
  type MemoryIntegrationFinishRequestV1,
  type MemoryIntegrationJobV1,
  type MemoryIntegrationModeV1,
  type MemoryIntegrationRunRequestV1,
  type MemoryIntegrationRunResponseV1,
  type MemoryIntegrationStatusV1,
} from "@pai/contracts/memory/integration-job.v1";
import {
  MemoryEventEnvelopeV1Schema,
  assertMemoryEventEnvelopeSemanticBindingsV1,
  type MemoryEventEnvelopeV1,
} from "@pai/contracts/memory/memory-event.v1";
import {
  MEMORY_PRE_PROMOTION_CHECKS_V1,
  MEMORY_PRE_PROMOTION_POLICY_VERSION_V1,
  MemoryPrePromotionCheckRequestV1Schema,
  MemoryPrePromotionCheckResponseV1Schema,
  MemoryPrePromotionValidateRequestV1Schema,
  MemoryPromotionReservationV1Schema,
  MemoryPromotionReservationAckRequestV1Schema,
  MemoryPromotionReservationAckResponseV1Schema,
  MemoryPromotionReservationReleaseRequestV1Schema,
  MemoryPromotionReservationReleaseResponseV1Schema,
  assertMemoryPrePromotionCheckRequestSemanticBindingsV1,
  assertMemoryPrePromotionCheckResponseSemanticBindingsV1,
  assertMemoryPrePromotionValidateRequestSemanticBindingsV1,
  assertMemoryPromotionReservationSemanticBindingsV1,
  assertMemoryPromotionReservationAckRequestSemanticBindingsV1,
  assertMemoryPromotionReservationAckResponseSemanticBindingsV1,
  assertMemoryPromotionReservationReleaseRequestSemanticBindingsV1,
  assertMemoryPromotionReservationReleaseResponseSemanticBindingsV1,
  type MemoryPrePromotionCheckRequestV1,
  type MemoryPrePromotionCheckResponseV1,
  type MemoryPrePromotionValidateRequestV1,
  type MemoryPromotionReservationV1,
  type MemoryPromotionReservationAckRequestV1,
  type MemoryPromotionReservationAckResponseV1,
  type MemoryPromotionReservationReleaseRequestV1,
  type MemoryPromotionReservationReleaseResponseV1,
} from "@pai/contracts/memory/pre-promotion-check.v1";

export type {
  MemoryRelationPayloadV1,
  MemorySourceInfoV1,
  MemorySubjectRefV1,
  MemoryWriteBatchRequestV1,
  MemoryWriteBatchResponseV1,
  MemoryWriteItemV1,
  MemoryWriteRejectedV1,
  MemoryWriteSucceededV1,
} from "@pai/contracts/memory/write-batch.v1";
export type {
  MemoryFastRecallItemV1,
  MemoryFastRecallRequestV1,
  MemoryFastRecallResponseV1,
} from "@pai/contracts/memory/fast-recall.v1";
export type {
  MemoryIntegrationCheckpointRequestV1,
  MemoryIntegrationClaimRequestV1,
  MemoryIntegrationClaimV1,
  MemoryIntegrationFinishRequestV1,
  MemoryIntegrationJobV1,
  MemoryIntegrationModeV1,
  MemoryIntegrationRunRequestV1,
  MemoryIntegrationRunResponseV1,
  MemoryIntegrationStatusV1,
} from "@pai/contracts/memory/integration-job.v1";
export type {
  MemoryPrePromotionCheckRequestV1,
  MemoryPrePromotionCheckResponseV1,
  MemoryPrePromotionValidateRequestV1,
  MemoryPromotionReservationV1,
  MemoryPromotionReservationAckRequestV1,
  MemoryPromotionReservationAckResponseV1,
  MemoryPromotionReservationReleaseRequestV1,
  MemoryPromotionReservationReleaseResponseV1,
} from "@pai/contracts/memory/pre-promotion-check.v1";

export const MEMORY_EMBEDDING_PROFILE_V1 = Object.freeze({
  profile_version: "memory.summary_embedding.v2",
  profile_id: "memory.doubao_embedding_vision_251215.2048.v1",
  model_id: "doubao-embedding-vision-251215",
  model_revision: "251215",
  dimensions: 2_048,
  normalized: true,
  distance_metric: "cosine",
} as const);

export const MEMORY_RANKING_PROFILE_V1 =
  "memory.fast_recall.ranking.v1" as const;

/**
 * Versioned, conservative integration policy. It never deletes Memory facts:
 * exact duplicates are superseded, expired/old low-importance points are
 * downgraded, topic keys are canonicalized, and search projections are
 * rebuilt from owner rows.
 */
export const MEMORY_INTEGRATION_POLICY_VERSION_V1 =
  "memory.integration_policy.v1" as const;

export interface MemoryScopeV1 {
  readonly workspace_id: string;
  readonly bot_id: string;
  readonly owner_agent_id: string;
  readonly deployment_environment: "local" | "dev" | "staging" | "prod";
  readonly release_channel: "stable" | "canary";
}

export interface MemoryPrincipalV1 {
  readonly caller:
    | "action_runtime"
    | "knowthat"
    | "meta_cognition"
    | "trigger_processor"
    | "memory";
  readonly capabilities: readonly string[];
  readonly scope: MemoryScopeV1;
}

type MemoryWriteWarningV1 =
  MemoryWriteBatchResponseV1["warnings"][number];

export interface MemoryTopicIdentityV1 {
  readonly canonicalization_version: "memory.topic_key.v1";
  readonly subject_key: string;
  readonly aspect_key: string;
  readonly scope_key: string;
  readonly topic_family_key: string;
  readonly topic_key: string;
  readonly raw_components: Readonly<{
    bot_id: string;
    subject_key: string;
    aspect_key: string;
    scope_key: string;
  }>;
  readonly normalized_components: Readonly<{
    bot_id: string;
    subject_key: string;
    aspect_key: string;
    scope_key: string;
  }>;
}

export type MemorySeriesStatusV1 =
  | "active"
  | "pending_conflict"
  | "archived"
  | "merged"
  | "suppressed";

export type MemoryPointStatusV1 =
  | "active"
  | "pending_conflict"
  | "superseded"
  | "downgraded"
  | "archived"
  | "rejected";

export interface MemorySeriesV1 {
  readonly id: string;
  readonly scope: MemoryScopeV1;
  readonly topic_key: string;
  readonly topic_family_key: string;
  readonly subject_key: string;
  readonly aspect_key: string;
  readonly scope_key: string;
  readonly status: MemorySeriesStatusV1;
  readonly state_version: number;
  readonly current_version: number;
  readonly canonicalization_version: "memory.topic_key.v1";
  readonly topic_components_raw: Readonly<Record<string, string>>;
  readonly topic_components_normalized: Readonly<Record<string, string>>;
  readonly importance_score: number;
  readonly last_mentioned_at: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface MemoryPointV1 {
  readonly id: string;
  readonly scope: MemoryScopeV1;
  readonly series_id: string;
  readonly version_no: number;
  readonly content_summary: string;
  readonly human_agent_relation: readonly MemoryRelationV1[];
  readonly keyword_tags: readonly string[];
  readonly scene_tags: readonly string[];
  readonly emotion_tags: readonly string[];
  readonly source_info: MemorySourceInfoV1;
  readonly source_trigger_process_id: string;
  readonly content_hash: string;
  readonly series_decision: MemoryWriteSucceededV1["decision"];
  readonly confidence_score: number;
  readonly occurred_at: string;
  readonly evidence_valid_until: string | null;
  readonly status: MemoryPointStatusV1;
  readonly state_version: number;
  readonly embedding_profile_id: typeof MEMORY_EMBEDDING_PROFILE_V1.profile_id;
  readonly summary_embedding: readonly number[];
  readonly created_at: string;
}

export interface MemoryProjectionV1 {
  readonly memory_point_id: string;
  readonly scope: MemoryScopeV1;
  readonly series_id: string;
  readonly topic_family_key: string;
  readonly topic_key: string;
  readonly status: MemoryPointStatusV1;
  readonly state_version: number;
  readonly series_state_version: number;
  readonly ranking_profile_version: typeof MEMORY_RANKING_PROFILE_V1;
  readonly content_summary: string;
  readonly keyword_tags: readonly string[];
  readonly scene_tags: readonly string[];
  readonly emotion_tags: readonly string[];
  readonly occurred_at: string;
  readonly evidence_valid_until: string | null;
  readonly importance_score: number;
  readonly last_mentioned_at: string;
  readonly embedding_profile_id: typeof MEMORY_EMBEDDING_PROFILE_V1.profile_id;
  readonly summary_embedding: readonly number[];
  readonly updated_at: string;
}

export interface MemorySucceededItemDecisionV1 {
  readonly id: string;
  readonly scope: MemoryScopeV1;
  readonly batch_id: string;
  readonly client_item_id: string;
  readonly source_item_id: string | null;
  readonly source_trigger_process_id: string;
  readonly content_hash: string;
  readonly decision: MemoryWriteSucceededV1["decision"];
  readonly target_series_id: string;
  readonly target_memory_point_id: string | null;
  readonly conflict_id: string | null;
  readonly candidate_refs: readonly string[];
  readonly decision_reason: string;
  readonly created_at: string;
}

export interface MemoryRejectedItemDecisionV1 {
  readonly id: string;
  readonly scope: MemoryScopeV1;
  readonly batch_id: string;
  readonly client_item_id: string;
  readonly source_item_id: string | null;
  readonly source_trigger_process_id: string;
  readonly content_hash: string;
  readonly decision: "rejected";
  readonly rejection_code: string;
  readonly rejection_message: string;
  readonly field_path: string | null;
  readonly created_at: string;
}

export type MemoryItemDecisionV1 =
  | MemorySucceededItemDecisionV1
  | MemoryRejectedItemDecisionV1;

export interface MemoryEmbeddingPortV1 {
  checkReadiness(): Promise<void>;
  embed(
    inputs: readonly string[],
    profile: typeof MEMORY_EMBEDDING_PROFILE_V1,
  ): Promise<readonly (readonly number[])[]>;
}

export type MemoryApplicationErrorCodeV1 =
  | "invalid_request"
  | "schema_validation_failed"
  | "payload_too_large"
  | "too_many_items"
  | "batch_too_large"
  | "forbidden"
  | "bot_scope_mismatch"
  | "idempotency_conflict"
  | "stale_conflict_version"
  | "snapshot_expired"
  | "promotion_reserved"
  | "promotion_check_expired"
  | "stale_memory_check"
  | "promotion_reservation_not_found"
  | "promotion_stale_fence"
  | "promotion_version_drift"
  | "dependency_unavailable"
  | "integration_job_not_found"
  | "lease_conflict";

export class MemoryApplicationErrorV1 extends Error {
  public constructor(
    public readonly code: MemoryApplicationErrorCodeV1,
    message: string,
    public readonly retryable = false,
    public readonly field_path?: string,
    public readonly details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "MemoryApplicationErrorV1";
  }
}

interface StoredBatchV1 {
  request_hash: string;
  response: MemoryWriteBatchResponseV1;
}

interface StoredBatchReservationV1 {
  readonly reservation_id: string;
  readonly request_hash: string;
  readonly expected_query_revision: number;
  readonly created_at: string;
}

interface MutableMemorySeriesV1 {
  id: string;
  scope: MemoryScopeV1;
  topic_key: string;
  topic_family_key: string;
  subject_key: string;
  aspect_key: string;
  scope_key: string;
  status: MemorySeriesStatusV1;
  state_version: number;
  current_version: number;
  canonicalization_version: "memory.topic_key.v1";
  topic_components_raw: Readonly<Record<string, string>>;
  topic_components_normalized: Readonly<Record<string, string>>;
  importance_score: number;
  last_mentioned_at: string;
  created_at: string;
  updated_at: string;
}

interface MutableMemoryPointV1 extends Omit<MemoryPointV1, "scope"> {
  scope: MemoryScopeV1;
  status: MemoryPointStatusV1;
  state_version: number;
}

interface MutableMemoryProjectionV1
  extends Omit<MemoryProjectionV1, "scope"> {
  scope: MemoryScopeV1;
  status: MemoryPointStatusV1;
  state_version: number;
  series_state_version: number;
  last_mentioned_at: string;
  updated_at: string;
}

interface MemoryConflictV1 {
  readonly id: string;
  readonly scope: MemoryScopeV1;
  readonly old_series_id: string;
  readonly new_series_id: string;
  readonly conflict_type: "source_item_identity_drift";
  readonly source_item_id: string;
  readonly left_memory_point_id: string;
  readonly right_memory_point_id: string;
  readonly evidence_refs: readonly string[];
  readonly incoming_content_hash: string;
  readonly status: "open";
  readonly state_version: 1;
  readonly created_at: string;
}

interface MemoryRevisionV1 {
  readonly id: string;
  readonly aggregate_type: "memory_point";
  readonly aggregate_id: string;
  readonly previous_state_version: number;
  readonly state_version: number;
  readonly previous_status: MemoryPointStatusV1;
  readonly status: MemoryPointStatusV1;
  readonly reason_code: string;
  readonly created_at: string;
}

interface MutableIntegrationJobV1 {
  id: string;
  scope: MemoryScopeV1;
  mode: MemoryIntegrationModeV1;
  request_scope: MemoryIntegrationRunRequestV1["scope"];
  dry_run: boolean;
  idempotency_key: string;
  request_hash: string;
  expected_policy_version: string;
  state_version: number;
  status: MemoryIntegrationStatusV1;
  checkpoint_ref: string | null;
  proposed_changes: Array<MemoryIntegrationJobV1["proposed_changes"][number]>;
  applied_counts: Record<string, number>;
  failure_refs: string[];
  error: string | null;
  created_at: string;
  updated_at: string;
}

interface MutableIntegrationLeaseV1 {
  integration_job_id: string;
  lease_id: string;
  lease_generation: number;
  owner_id: string;
  lease_expires_at: string;
  heartbeat_at: string;
}

interface IntegrationFinishReceiptV1 {
  readonly lease_id: string;
  readonly lease_generation: number;
  readonly request_hash: string;
}

interface StoredPromotionCheckV1 {
  readonly scope: MemoryScopeV1;
  readonly identity: string;
  readonly request_hash: string;
  readonly check_token_hash: string;
  readonly response: Readonly<
    Omit<MemoryPrePromotionCheckResponseV1, "check_token">
  >;
}

interface PromotionTargetSnapshotV1 {
  readonly aggregate_type: "memory_point" | "memory_series" | "memory_conflict";
  readonly aggregate_id: string;
  readonly expected_state_version: number;
  readonly expected_state_hash: string;
}

interface MutablePromotionReservationStateV1 {
  readonly scope: MemoryScopeV1;
  readonly request_hash: string;
  readonly validation_idempotency_key: string;
  readonly reservation: Readonly<
    Omit<MemoryPromotionReservationV1, "reservation_token">
  >;
  readonly reservation_token_hash: string;
  readonly targets: readonly PromotionTargetSnapshotV1[];
  status: "active" | "acked" | "released" | "expired" | "invalidated";
  ack_request_hash: string | null;
  ack_response: MemoryPromotionReservationAckResponseV1 | null;
  release_request_hash: string | null;
  release_response: MemoryPromotionReservationReleaseResponseV1 | null;
  release_origin: "expiration" | "caller" | null;
}

interface RecallSnapshotV1 {
  token: string;
  scope: MemoryScopeV1;
  query_hash: string;
  query_revision: number;
  items: readonly MemoryFastRecallItemV1[];
  cursor_by_offset: Map<number, string>;
  expires_at: string;
}

const MEMORY_RECALL_SNAPSHOT_TTL_MS_V1 = 30_000;
const MEMORY_RECALL_SNAPSHOT_MAX_PER_SCOPE_V1 = 64;
const MEMORY_RECALL_SNAPSHOT_MAX_TOTAL_V1 = 512;

export interface MemoryStateV1 {
  batches: Map<string, StoredBatchV1>;
  batchReservations: Map<string, StoredBatchReservationV1>;
  decisions: Map<string, MemoryItemDecisionV1>;
  decisionKeyBySourceItem: Map<string, string>;
  series: Map<string, MutableMemorySeriesV1>;
  seriesIdByTopic: Map<string, string>;
  points: Map<string, MutableMemoryPointV1>;
  projections: Map<string, MutableMemoryProjectionV1>;
  conflicts: Map<string, MemoryConflictV1>;
  revisions: Map<string, MemoryRevisionV1>;
  recallSnapshots: Map<string, RecallSnapshotV1>;
  integrationJobs: Map<string, MutableIntegrationJobV1>;
  integrationJobIdByKey: Map<string, string>;
  integrationLeases: Map<string, MutableIntegrationLeaseV1>;
  integrationFinishReceipts: Map<string, IntegrationFinishReceiptV1>;
  promotionChecksByIdempotency: Map<string, StoredPromotionCheckV1>;
  promotionChecksByTokenHash: Map<string, StoredPromotionCheckV1>;
  promotionReservations: Map<string, MutablePromotionReservationStateV1>;
  promotionReservationIdByIdempotency: Map<string, string>;
  promotionGenerationByCandidate: Map<string, number>;
  activePromotionReservationByCandidate: Map<string, string>;
  activePromotionReservationByTarget: Map<string, string>;
  audit: Array<Readonly<Record<string, unknown>>>;
  outbox: MemoryEventEnvelopeV1[];
  queryRevision: number;
}

export interface MemoryStateRepositoryPortV1 {
  checkReadiness(): Promise<void>;
  transact<T>(
    operation: (state: MemoryStateV1) => T | Promise<T>,
    scope?: MemoryScopeV1,
  ): Promise<T>;
}

export class InMemoryMemoryStateRepositoryV1
  implements MemoryStateRepositoryPortV1
{
  #state: MemoryStateV1 = {
    batches: new Map(),
    batchReservations: new Map(),
    decisions: new Map(),
    decisionKeyBySourceItem: new Map(),
    series: new Map(),
    seriesIdByTopic: new Map(),
    points: new Map(),
    projections: new Map(),
    conflicts: new Map(),
    revisions: new Map(),
    recallSnapshots: new Map(),
    integrationJobs: new Map(),
    integrationJobIdByKey: new Map(),
    integrationLeases: new Map(),
    integrationFinishReceipts: new Map(),
    promotionChecksByIdempotency: new Map(),
    promotionChecksByTokenHash: new Map(),
    promotionReservations: new Map(),
    promotionReservationIdByIdempotency: new Map(),
    promotionGenerationByCandidate: new Map(),
    activePromotionReservationByCandidate: new Map(),
    activePromotionReservationByTarget: new Map(),
    audit: [],
    outbox: [],
    queryRevision: 1,
  };

  #tail: Promise<void> = Promise.resolve();

  public async checkReadiness(): Promise<void> {}

  public async transact<T>(
    operation: (state: MemoryStateV1) => T | Promise<T>,
    _scope?: MemoryScopeV1,
  ): Promise<T> {
    let release: (() => void) | undefined;
    const turn = new Promise<void>((resolve) => {
      release = resolve;
    });
    const previous = this.#tail;
    this.#tail = previous.then(() => turn);
    await previous;
    const rollback = structuredClone(this.#state);
    try {
      return await operation(this.#state);
    } catch (error) {
      this.#state = rollback;
      throw error;
    } finally {
      release?.();
    }
  }
}

const controlCharacterPattern = /[\p{Cc}\p{Cf}]/u;
const sceneTags = new Set<string>(MEMORY_SCENE_TAGS_V1);
const emotionTags = new Set<string>(MEMORY_EMOTION_TAGS_V1);
const priorityDimensions = new Set<string>(
  MEMORY_FAST_RECALL_PRIORITY_DIMENSIONS_V1,
);

function fail(
  code: MemoryApplicationErrorCodeV1,
  message: string,
  fieldPath?: string,
  retryable = false,
  details?: Readonly<Record<string, unknown>>,
): never {
  throw new MemoryApplicationErrorV1(
    code,
    message,
    retryable,
    fieldPath,
    details,
  );
}

function nextMemoryCounterV1(value: number, label: string): number {
  if (
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value >= Number.MAX_SAFE_INTEGER
  ) {
    fail(
      "dependency_unavailable",
      `${label} is exhausted or corrupt`,
      undefined,
      false,
    );
  }
  return value + 1;
}

function assertOwnerContract(
  assertion: () => void,
  label: string,
): void {
  try {
    assertion();
  } catch (error) {
    fail(
      "schema_validation_failed",
      `${label}: ${error instanceof Error ? error.message : "contract mismatch"}`,
    );
  }
}

function assertIdentifier(
  value: unknown,
  label: string,
): asserts value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    /[\uD800-\uDFFF]/u.test(
      [...value].filter((entry) => entry.length === 1).join(""),
    ) ||
    Buffer.byteLength(value, "utf8") > 256
  ) {
    fail("schema_validation_failed", `${label} is invalid`, `/${label}`);
  }
}

function assertObject(
  value: unknown,
  label: string,
): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail("schema_validation_failed", `${label} must be an object`, `/${label}`);
  }
}

function assertExactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
  path = "",
): void {
  const keys = Object.keys(value);
  const allowed = new Set([...required, ...optional]);
  const unknown = keys.find((key) => !allowed.has(key));
  const missing = required.find((key) => value[key] === undefined);
  if (unknown !== undefined || missing !== undefined) {
    const field = unknown ?? missing ?? "";
    fail(
      "schema_validation_failed",
      unknown === undefined
        ? `${field} is required`
        : `${field} is not allowed`,
      `${path}/${field}`,
    );
  }
}

const MEMORY_CANONICAL_MAX_DEPTH_V1 = 64;
const MEMORY_CANONICAL_MAX_NODES_V1 = 100_000;
const MEMORY_CANONICAL_MAX_BYTES_V1 = 2 * 1_024 * 1_024;

type MemoryCanonicalJsonValueV1 =
  | null
  | boolean
  | number
  | string
  | MemoryCanonicalJsonValueV1[]
  | { [key: string]: MemoryCanonicalJsonValueV1 };

type MemoryCanonicalTargetV1 =
  | MemoryCanonicalJsonValueV1[]
  | { [key: string]: MemoryCanonicalJsonValueV1 };

type MemoryCanonicalWorkV1 =
  | Readonly<{
      kind: "visit";
      value: unknown;
      depth: number;
      parent: MemoryCanonicalTargetV1 | null;
      key: string | number | null;
    }>
  | Readonly<{
      kind: "leave";
      source: object;
      target: MemoryCanonicalTargetV1;
    }>;

function snapshotMemoryCanonicalV1(
  value: unknown,
): MemoryCanonicalJsonValueV1 {
  let root: MemoryCanonicalJsonValueV1 | undefined;
  let nodeCount = 0;
  let minimumBytes = 0;
  const activePath = new WeakSet<object>();
  const work: MemoryCanonicalWorkV1[] = [
    {
      kind: "visit",
      value,
      depth: 0,
      parent: null,
      key: null,
    },
  ];

  const addMinimumBytes = (text: string): void => {
    minimumBytes += Buffer.byteLength(text, "utf8");
    if (minimumBytes > MEMORY_CANONICAL_MAX_BYTES_V1) {
      fail(
        "schema_validation_failed",
        "Memory canonical JSON byte budget exceeded",
      );
    }
  };
  const assign = (
    parent: MemoryCanonicalTargetV1 | null,
    key: string | number | null,
    entry: MemoryCanonicalJsonValueV1,
  ): void => {
    if (parent === null) {
      root = entry;
      return;
    }
    if (key === null) {
      fail("schema_validation_failed", "Memory canonical destination is invalid");
    }
    if (Array.isArray(parent)) {
      if (typeof key !== "number") {
        fail(
          "schema_validation_failed",
          "Memory canonical array destination is invalid",
        );
      }
      parent[key] = entry;
      return;
    }
    if (typeof key !== "string") {
      fail(
        "schema_validation_failed",
        "Memory canonical object destination is invalid",
      );
    }
    parent[key] = entry;
  };

  while (work.length > 0) {
    const current = work.pop();
    if (current === undefined) break;
    if (current.kind === "leave") {
      activePath.delete(current.source);
      Object.freeze(current.target);
      continue;
    }
    nodeCount += 1;
    if (nodeCount > MEMORY_CANONICAL_MAX_NODES_V1) {
      fail(
        "schema_validation_failed",
        "Memory canonical JSON node budget exceeded",
      );
    }
    if (current.depth > MEMORY_CANONICAL_MAX_DEPTH_V1) {
      fail(
        "schema_validation_failed",
        "Memory canonical JSON depth budget exceeded",
      );
    }

    const entry = current.value;
    if (
      entry === null ||
      typeof entry === "boolean" ||
      typeof entry === "string"
    ) {
      if (typeof entry === "string") addMinimumBytes(entry);
      assign(current.parent, current.key, entry);
      continue;
    }
    if (typeof entry === "number") {
      if (!Number.isFinite(entry)) {
        fail(
          "schema_validation_failed",
          "Memory canonical JSON number must be finite",
        );
      }
      assign(current.parent, current.key, Object.is(entry, -0) ? 0 : entry);
      continue;
    }
    if (typeof entry !== "object") {
      fail("schema_validation_failed", "Memory canonical value must be JSON");
    }
    if (isProxy(entry)) {
      fail(
        "schema_validation_failed",
        "Memory canonical JSON proxies are not supported",
      );
    }
    if (activePath.has(entry)) {
      fail("schema_validation_failed", "Memory canonical JSON cycle detected");
    }

    let descriptors: PropertyDescriptorMap;
    let prototype: object | null;
    try {
      descriptors = Object.getOwnPropertyDescriptors(entry);
      prototype = Object.getPrototypeOf(entry);
    } catch {
      fail(
        "schema_validation_failed",
        "Memory canonical object metadata is not inspectable",
      );
    }
    const ownKeys = Reflect.ownKeys(descriptors);
    if (ownKeys.some((key) => typeof key !== "string")) {
      fail(
        "schema_validation_failed",
        "Memory canonical JSON symbol keys are not supported",
      );
    }

    activePath.add(entry);
    if (Array.isArray(entry)) {
      if (prototype !== Array.prototype) {
        fail(
          "schema_validation_failed",
          "Memory canonical arrays must use the standard prototype",
        );
      }
      const lengthDescriptor = descriptors.length;
      if (
        lengthDescriptor === undefined ||
        !("value" in lengthDescriptor) ||
        !Number.isSafeInteger(lengthDescriptor.value) ||
        lengthDescriptor.value < 0
      ) {
        fail(
          "schema_validation_failed",
          "Memory canonical array length is invalid",
        );
      }
      const length = lengthDescriptor.value as number;
      if (
        length > MEMORY_CANONICAL_MAX_NODES_V1 ||
        ownKeys.length !== length + 1
      ) {
        fail(
          "schema_validation_failed",
          "Memory canonical arrays must be dense without extensions",
        );
      }
      const target: MemoryCanonicalJsonValueV1[] = new Array(length);
      assign(current.parent, current.key, target);
      work.push({ kind: "leave", source: entry, target });
      for (let index = length - 1; index >= 0; index -= 1) {
        const descriptor = descriptors[String(index)];
        if (
          descriptor === undefined ||
          !("value" in descriptor) ||
          descriptor.enumerable !== true
        ) {
          fail(
            "schema_validation_failed",
            "Memory canonical array entries must be enumerable data",
          );
        }
        work.push({
          kind: "visit",
          value: descriptor.value,
          depth: current.depth + 1,
          parent: target,
          key: index,
        });
      }
      continue;
    }

    if (prototype !== Object.prototype && prototype !== null) {
      fail(
        "schema_validation_failed",
        "Memory canonical objects must be plain data",
      );
    }
    const keys = ownKeys as string[];
    if (keys.length > MEMORY_CANONICAL_MAX_NODES_V1) {
      fail(
        "schema_validation_failed",
        "Memory canonical JSON node budget exceeded",
      );
    }
    keys.sort();
    const target: { [key: string]: MemoryCanonicalJsonValueV1 } =
      Object.create(null) as {
        [key: string]: MemoryCanonicalJsonValueV1;
      };
    assign(current.parent, current.key, target);
    work.push({ kind: "leave", source: entry, target });
    for (let index = keys.length - 1; index >= 0; index -= 1) {
      const key = keys[index];
      if (key === undefined) continue;
      const descriptor = descriptors[key];
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        descriptor.enumerable !== true
      ) {
        fail(
          "schema_validation_failed",
          "Memory canonical properties must be enumerable data",
        );
      }
      addMinimumBytes(key);
      work.push({
        kind: "visit",
        value: descriptor.value,
        depth: current.depth + 1,
        parent: target,
        key,
      });
    }
  }
  if (root === undefined) {
    fail("schema_validation_failed", "Memory canonical root is missing");
  }
  return root;
}

function ownJsonValue(value: unknown): unknown {
  memoryCanonicalJsonV1(value);
  const snapshot = snapshotMemoryCanonicalV1(value);
  return snapshot;
}

function deepFreezeMemoryBoundaryV1<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const entry of Object.values(value)) {
    deepFreezeMemoryBoundaryV1(entry);
  }
  return Object.freeze(value);
}

function snapshotMemoryBoundaryV1<T>(value: T): T {
  return deepFreezeMemoryBoundaryV1(ownJsonValue(value) as T);
}

export function memoryCanonicalJsonV1(value: unknown): string {
  try {
    return sharedCanonicalJsonV1(value, {
      max_bytes: MEMORY_CANONICAL_MAX_BYTES_V1,
      max_depth: MEMORY_CANONICAL_MAX_DEPTH_V1,
      max_nodes: MEMORY_CANONICAL_MAX_NODES_V1,
      max_container_entries: MEMORY_CANONICAL_MAX_NODES_V1,
    });
  } catch (error) {
    if (error instanceof CanonicalJsonViolationV1) {
      fail(
        "schema_validation_failed",
        `Memory canonical JSON rejected: ${error.reason}`,
      );
    }
    throw error;
  }
}

function sha256Base64Url(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("base64url");
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function compareMemoryIdentityV1(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function memoryEventIdV1(idempotencyKey: string): string {
  return `mev_${sha256Base64Url(idempotencyKey).slice(0, 32)}`;
}

function appendMemoryEventV1(
  state: MemoryStateV1,
  event: MemoryEventEnvelopeV1,
): void {
  memoryCanonicalJsonV1(event);
  if (!Value.Check(MemoryEventEnvelopeV1Schema, event)) {
    throw new Error("Memory producer emitted a non-canonical event envelope");
  }
  assertMemoryEventEnvelopeSemanticBindingsV1(event);
  state.outbox.push(Object.freeze(structuredClone(event)));
}

function normalizeWhitespace(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ");
}

function unicodeCaseFold(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("\u00df", "ss")
    .replaceAll("\u03c2", "\u03c3");
}

function normalizeComponent(
  value: string,
  kind: "opaque" | "symbolic" | "label",
  label: string,
): string {
  const normalized =
    kind === "opaque"
      ? value.normalize("NFKC").trim()
      : normalizeWhitespace(value);
  const folded = kind === "opaque" ? normalized : unicodeCaseFold(normalized);
  if (
    folded.length === 0 ||
    controlCharacterPattern.test(folded) ||
    Buffer.byteLength(folded, "utf8") > 256
  ) {
    fail(
      "schema_validation_failed",
      `${label} cannot be normalized`,
      `/${label}`,
    );
  }
  return kind === "label" ? `label:${folded}` : folded;
}

function snapshotScope(scope: MemoryScopeV1): MemoryScopeV1 {
  assertObject(scope, "scope");
  assertExactKeys(
    scope,
    [
      "workspace_id",
      "bot_id",
      "owner_agent_id",
      "deployment_environment",
      "release_channel",
    ],
    [],
    "/scope",
  );
  assertIdentifier(scope.workspace_id, "workspace_id");
  assertIdentifier(scope.bot_id, "bot_id");
  assertIdentifier(scope.owner_agent_id, "owner_agent_id");
  if (!["local", "dev", "staging", "prod"].includes(scope.deployment_environment)) {
    fail("schema_validation_failed", "deployment_environment is invalid");
  }
  if (!["stable", "canary"].includes(scope.release_channel)) {
    fail("schema_validation_failed", "release_channel is invalid");
  }
  return Object.freeze({ ...scope });
}

function memoryEventScopeV1(scope: MemoryScopeV1): MemoryScopeV1 {
  return Object.freeze({ ...scope });
}

function scopeKey(scope: MemoryScopeV1): string {
  return memoryCanonicalJsonV1([
    scope.workspace_id,
    scope.bot_id,
    scope.owner_agent_id,
    scope.deployment_environment,
    scope.release_channel,
  ]);
}

function sameScope(left: MemoryScopeV1, right: MemoryScopeV1): boolean {
  return scopeKey(left) === scopeKey(right);
}

function assertPrincipal(
  principal: MemoryPrincipalV1,
  caller: MemoryPrincipalV1["caller"],
  capability: string,
  botId: string,
): MemoryScopeV1 {
  if (
    principal.caller !== caller ||
    !principal.capabilities.includes(capability)
  ) {
    fail("forbidden", `${capability} is required`);
  }
  const scope = snapshotScope(principal.scope);
  if (scope.bot_id !== botId) {
    fail("bot_scope_mismatch", "bot_id does not match workload scope");
  }
  return scope;
}

function assertCanonicalMemoryProjectionV1(
  value: unknown,
  label: string,
): void {
  try {
    memoryCanonicalJsonV1(value);
  } catch {
    throw new Error(`${label} is outside the canonical JSON boundary`);
  }
}

function snapshotMemoryDependencyResultV1<T>(
  value: T,
  label: string,
): T {
  try {
    memoryCanonicalJsonV1(value);
    return structuredClone(value);
  } catch {
    throw new MemoryApplicationErrorV1(
      "dependency_unavailable",
      `${label} returned an invalid response`,
      true,
    );
  }
}

function snapshotSeries(series: MutableMemorySeriesV1): MemorySeriesV1 {
  assertCanonicalMemoryProjectionV1(series, "Memory series projection");
  return Object.freeze({
    ...series,
    scope: Object.freeze({ ...series.scope }),
    topic_components_raw: Object.freeze({ ...series.topic_components_raw }),
    topic_components_normalized: Object.freeze({
      ...series.topic_components_normalized,
    }),
  });
}

function snapshotPoint(point: MutableMemoryPointV1): MemoryPointV1 {
  assertCanonicalMemoryProjectionV1(point, "Memory point projection");
  return Object.freeze({
    ...point,
    scope: Object.freeze({ ...point.scope }),
    human_agent_relation: Object.freeze(
      structuredClone(point.human_agent_relation),
    ),
    keyword_tags: Object.freeze([...point.keyword_tags]),
    scene_tags: Object.freeze([...point.scene_tags]),
    emotion_tags: Object.freeze([...point.emotion_tags]),
    source_info: Object.freeze(structuredClone(point.source_info)),
    summary_embedding: Object.freeze([...point.summary_embedding]),
  });
}

function snapshotProjection(
  projection: MutableMemoryProjectionV1,
): MemoryProjectionV1 {
  assertCanonicalMemoryProjectionV1(
    projection,
    "Memory recall projection",
  );
  return Object.freeze({
    ...projection,
    scope: Object.freeze({ ...projection.scope }),
    keyword_tags: Object.freeze([...projection.keyword_tags]),
    scene_tags: Object.freeze([...projection.scene_tags]),
    emotion_tags: Object.freeze([...projection.emotion_tags]),
    summary_embedding: Object.freeze([...projection.summary_embedding]),
  });
}

function snapshotJob(job: MutableIntegrationJobV1): MemoryIntegrationJobV1 {
  assertCanonicalMemoryProjectionV1(
    job,
    "Memory integration job projection",
  );
  const snapshot = Object.freeze({
    ...job,
    scope: Object.freeze({ ...job.scope }),
    request_scope: Object.freeze(structuredClone(job.request_scope)),
    proposed_changes: Object.freeze(structuredClone(job.proposed_changes)),
    applied_counts: Object.freeze({ ...job.applied_counts }),
    failure_refs: Object.freeze([...job.failure_refs]),
  });
  assertCanonicalMemoryProjectionV1(
    snapshot,
    "Memory integration job response",
  );
  if (!Value.Check(MemoryIntegrationJobDetailsV1Schema, snapshot)) {
    throw new Error("integration job violates the Memory owner schema");
  }
  assertMemoryIntegrationJobSemanticBindingsV1(snapshot);
  return snapshot;
}

function primarySubject(
  item: MemoryWriteItemV1,
  compatibilityAllowed: boolean,
): Readonly<{ subject: MemorySubjectRefV1; warning: boolean }> {
  if (item.subject_refs.length === 1) {
    return { subject: item.subject_refs[0]!, warning: false };
  }
  const primary = item.subject_refs.filter((subject) => subject.primary === true);
  if (primary.length === 1) return { subject: primary[0]!, warning: false };
  if (compatibilityAllowed && item.subject_refs[0] !== undefined) {
    return { subject: item.subject_refs[0], warning: true };
  }
  fail(
    "schema_validation_failed",
    "multiple subjects require exactly one primary",
    "/items/subject_refs",
  );
}

export function memoryTopicIdentityV1(
  botId: string,
  item: MemoryWriteItemV1,
  compatibilityAllowed = false,
): Readonly<{ identity: MemoryTopicIdentityV1; warning: boolean }> {
  const { subject, warning } = primarySubject(item, compatibilityAllowed);
  const rawSubject = subject.canonical_id ?? subject.label;
  if (rawSubject === undefined) {
    fail(
      "schema_validation_failed",
      "subject requires canonical_id or label",
      "/subject_refs",
    );
  }
  const subjectKey =
    subject.canonical_id === undefined
      ? normalizeComponent(rawSubject, "label", "subject_key")
      : normalizeComponent(rawSubject, "opaque", "subject_key");
  const rawAspect = item.aspect_hint ?? item.topic_hint ?? "general";
  const rawScope = item.scope_hint ?? "global";
  const canonical = memoryCanonicalTopicKeysV1(
    botId,
    subjectKey,
    rawAspect,
    rawScope,
  );
  const identity: MemoryTopicIdentityV1 = {
    canonicalization_version: "memory.topic_key.v1",
    subject_key: canonical.subject_key,
    aspect_key: canonical.aspect_key,
    scope_key: canonical.scope_key,
    topic_family_key: canonical.topic_family_key,
    topic_key: canonical.topic_key,
    raw_components: Object.freeze({
      bot_id: botId,
      subject_key: rawSubject,
      aspect_key: rawAspect,
      scope_key: rawScope,
    }),
    normalized_components: Object.freeze({
      bot_id: canonical.bot_id,
      subject_key: canonical.subject_key,
      aspect_key: canonical.aspect_key,
      scope_key: canonical.scope_key,
    }),
  };
  return { identity: Object.freeze(identity), warning };
}

/**
 * Canonicalize an already-owned Memory series identity after a scope rekey.
 * Stored subject/aspect keys are normalized again intentionally: the
 * normalization is idempotent and keeps conflict resolution on the same
 * canonicalization algorithm as write-batch ingestion.
 */
export function memoryCanonicalTopicKeysV1(
  botId: string,
  subjectKey: string,
  aspectKey: string,
  scopeKeyValue: string,
): Readonly<{
  bot_id: string;
  subject_key: string;
  aspect_key: string;
  scope_key: string;
  topic_family_key: string;
  topic_key: string;
}> {
  const canonicalBot = normalizeComponent(botId, "opaque", "bot_id");
  const canonicalSubject = normalizeComponent(
    subjectKey,
    "opaque",
    "subject_key",
  );
  const canonicalAspect = normalizeComponent(
    aspectKey,
    "symbolic",
    "aspect_key",
  );
  const canonicalScope = normalizeComponent(
    scopeKeyValue,
    "symbolic",
    "scope_key",
  );
  const familyComponents = [canonicalBot, canonicalSubject, canonicalAspect];
  return Object.freeze({
    bot_id: canonicalBot,
    subject_key: canonicalSubject,
    aspect_key: canonicalAspect,
    scope_key: canonicalScope,
    topic_family_key: `tfk_v1_${sha256Base64Url(
      memoryCanonicalJsonV1(familyComponents),
    )}`,
    topic_key: `tk_v1_${sha256Base64Url(
      memoryCanonicalJsonV1([...familyComponents, canonicalScope]),
    )}`,
  });
}

function parseInstant(value: string, path: string): Date {
  if (
    !/^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/u.test(
      value,
    )
  ) {
    fail("schema_validation_failed", "timestamp is invalid", path);
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    fail("schema_validation_failed", "timestamp is invalid", path);
  }
  const [yearText, monthText, dayText] = value.slice(0, 10).split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > daysInMonth) {
    fail("schema_validation_failed", "timestamp is invalid", path);
  }
  return date;
}

function snapshotMemoryNowV1(value: Date, label: string): Date {
  let milliseconds: number;
  try {
    milliseconds = Date.prototype.getTime.call(value);
  } catch {
    fail("invalid_request", `${label} is invalid`);
  }
  if (!Number.isFinite(milliseconds)) {
    fail("invalid_request", `${label} is invalid`);
  }
  return new Date(milliseconds);
}

function dedupeNormalizedStrings(
  values: readonly string[],
  label: string,
): readonly string[] {
  const result = new Set<string>();
  for (const value of values) {
    if (typeof value !== "string") {
      fail("schema_validation_failed", `${label} must contain strings`);
    }
    result.add(normalizeComponent(value, "symbolic", label));
  }
  return Object.freeze([...result].sort());
}

function validateSubject(subject: MemorySubjectRefV1, path: string): void {
  assertObject(subject, path);
  assertExactKeys(
    subject,
    ["subject_type"],
    ["canonical_id", "label", "primary"],
    path,
  );
  if (
    !["user", "agent", "organization", "project", "system", "other"].includes(
      subject.subject_type,
    ) ||
    (subject.canonical_id === undefined && subject.label === undefined) ||
    (subject.canonical_id !== undefined &&
      typeof subject.canonical_id !== "string") ||
    (subject.label !== undefined && typeof subject.label !== "string") ||
    (subject.primary !== undefined && typeof subject.primary !== "boolean")
  ) {
    fail("schema_validation_failed", "subject is invalid", path);
  }
  if (subject.canonical_id !== undefined) {
    normalizeComponent(subject.canonical_id, "opaque", "canonical_id");
  }
  if (subject.label !== undefined) {
    normalizeComponent(subject.label, "label", "label");
  }
}

function validateRelation(relationValue: unknown, path: string): void {
  assertObject(relationValue, path);
  assertExactKeys(
    relationValue,
    ["relation_type", "target", "direction", "confidence_score"],
    ["evidence_refs"],
    path,
  );
  const relation = relationValue as unknown as MemoryRelationV1;
  if (
    typeof relation.relation_type !== "string" ||
    relation.relation_type.length === 0 ||
    Buffer.byteLength(relation.relation_type, "utf8") > 256 ||
    !["outbound", "inbound", "bidirectional"].includes(relation.direction) ||
    typeof relation.confidence_score !== "number" ||
    !Number.isFinite(relation.confidence_score) ||
    relation.confidence_score < 0 ||
    relation.confidence_score > 1 ||
    (relation.evidence_refs !== undefined &&
      (!Array.isArray(relation.evidence_refs) ||
        relation.evidence_refs.length > 64))
  ) {
    fail("schema_validation_failed", "relation is invalid", path);
  }
  normalizeComponent(relation.relation_type, "symbolic", "relation_type");
  validateSubject(relation.target, `${path}/target`);
  if (relation.evidence_refs !== undefined) {
    validateEvidenceRefs(relation.evidence_refs, `${path}/evidence_refs`);
  }
}

const typedEvidenceRefPattern =
  /^(?:memory_point|trigger_process|trigger_event|user_feedback|developer_note|system_event|artifact|tool_result):[^\r\n]+$/u;

function validateEvidenceRefs(values: readonly unknown[], path: string): void {
  const seen = new Set<string>();
  for (const [index, value] of values.entries()) {
    if (typeof value !== "string" || !typedEvidenceRefPattern.test(value)) {
      fail(
        "schema_validation_failed",
        "typed evidence ref is invalid",
        `${path}/${index}`,
      );
    }
    if (seen.has(value)) {
      fail(
        "schema_validation_failed",
        "typed evidence refs must be unique",
        `${path}/${index}`,
      );
    }
    seen.add(value);
  }
}

function validateSourceInfo(sourceValue: unknown, path: string): void {
  assertObject(sourceValue, path);
  assertExactKeys(
    sourceValue,
    ["source_type", "source_ref", "actor_type"],
    [
      "source_refs",
      "actor_id",
      "evidence_refs",
      "trace_id",
    ],
    path,
  );
  const source = sourceValue as unknown as MemorySourceInfoV1;
  if (
    ![
      "trigger_snapshot",
      "user_explicit",
      "agent_observation",
      "tool_result",
      "system_event",
      "import",
    ].includes(source.source_type) ||
    !["user", "agent", "system", "tool"].includes(source.actor_type) ||
    (source.source_refs !== undefined &&
      (!Array.isArray(source.source_refs) ||
        source.source_refs.length > 64)) ||
    (source.evidence_refs !== undefined &&
      (!Array.isArray(source.evidence_refs) ||
        source.evidence_refs.length > 64))
  ) {
    fail("schema_validation_failed", "source_info is invalid", path);
  }
  if (source.actor_id !== undefined) {
    assertIdentifier(source.actor_id, `${path}/actor_id`);
  }
  if (source.trace_id !== undefined) {
    assertIdentifier(source.trace_id, `${path}/trace_id`);
  }
  validateEvidenceRefs([source.source_ref], `${path}/source_ref`);
  if (source.source_refs !== undefined) {
    validateEvidenceRefs(source.source_refs, `${path}/source_refs`);
  }
  if (source.evidence_refs !== undefined) {
    validateEvidenceRefs(source.evidence_refs, `${path}/evidence_refs`);
  }
}

function validateWriteItem(
  itemValue: unknown,
  index: number,
): MemoryWriteItemV1 {
  const path = `/items/${index}`;
  assertObject(itemValue, path);
  assertExactKeys(
    itemValue,
    [
      "client_item_id",
      "content_summary",
      "subject_refs",
      "human_agent_relation",
      "keyword_tags",
      "scene_tags",
      "emotion_tags",
      "source_info",
      "confidence_score",
      "occurred_at",
    ],
    [
      "source_item_id",
      "topic_hint",
      "aspect_hint",
      "scope_hint",
      "evidence_valid_until",
    ],
    path,
  );
  const item = itemValue as unknown as MemoryWriteItemV1;
  assertIdentifier(item.client_item_id, `${path}/client_item_id`);
  if (item.source_item_id !== undefined) {
    assertIdentifier(item.source_item_id, `${path}/source_item_id`);
  }
  if (
    typeof item.content_summary !== "string" ||
    item.content_summary.length === 0 ||
    Buffer.byteLength(item.content_summary, "utf8") > 16_384
  ) {
    fail(
      "schema_validation_failed",
      "content_summary is invalid",
      `${path}/content_summary`,
    );
  }
  if (
    !Array.isArray(item.subject_refs) ||
    item.subject_refs.length < 1 ||
    item.subject_refs.length > 32
  ) {
    fail("schema_validation_failed", "subject_refs is invalid", `${path}/subject_refs`);
  }
  item.subject_refs.forEach((subject, subjectIndex) =>
    validateSubject(subject, `${path}/subject_refs/${subjectIndex}`),
  );
  if (
    !Array.isArray(item.human_agent_relation) ||
    item.human_agent_relation.length > 64 ||
    !Array.isArray(item.keyword_tags) ||
    item.keyword_tags.length > 64 ||
    !Array.isArray(item.scene_tags) ||
    item.scene_tags.length > 16 ||
    item.scene_tags.some((tag) => !sceneTags.has(tag)) ||
    !Array.isArray(item.emotion_tags) ||
    item.emotion_tags.length > 16 ||
    item.emotion_tags.some((tag) => !emotionTags.has(tag))
  ) {
    fail("schema_validation_failed", "item tags/relations are invalid", path);
  }
  item.human_agent_relation.forEach((relation, relationIndex) =>
    validateRelation(relation, `${path}/human_agent_relation/${relationIndex}`),
  );
  dedupeNormalizedStrings(item.keyword_tags, `${path}/keyword_tags`);
  if (
    typeof item.confidence_score !== "number" ||
    !Number.isFinite(item.confidence_score) ||
    item.confidence_score < 0 ||
    item.confidence_score > 1
  ) {
    fail("schema_validation_failed", "confidence_score is invalid", path);
  }
  parseInstant(item.occurred_at, `${path}/occurred_at`);
  if (item.evidence_valid_until !== undefined && item.evidence_valid_until !== null) {
    const evidenceValidUntil = parseInstant(
      item.evidence_valid_until,
      `${path}/evidence_valid_until`,
    );
    if (evidenceValidUntil.toISOString() !== item.evidence_valid_until) {
      fail(
        "schema_validation_failed",
        "evidence_valid_until must be a canonical RFC 3339 timestamp",
        `${path}/evidence_valid_until`,
      );
    }
  }
  validateSourceInfo(item.source_info, `${path}/source_info`);
  for (const key of ["topic_hint", "aspect_hint", "scope_hint"] as const) {
    const value = item[key];
    if (
      value !== undefined &&
      (typeof value !== "string" ||
        value.length === 0 ||
        Buffer.byteLength(value, "utf8") > 256)
    ) {
      fail("schema_validation_failed", `${key} is invalid`, `${path}/${key}`);
    }
  }
  const canonicalBytes = Buffer.byteLength(
    memoryCanonicalJsonV1(item),
    "utf8",
  );
  if (canonicalBytes > 65_536) {
    fail("payload_too_large", "item exceeds 64 KiB", path);
  }
  return ownJsonValue(item) as MemoryWriteItemV1;
}

interface ValidatedMemoryWriteItemV1 {
  readonly item: MemoryWriteItemV1;
  readonly original_index: number;
}

interface RejectedMemoryWriteItemV1 {
  readonly result: MemoryWriteRejectedV1;
  readonly original_index: number;
  readonly source_item_id: string | null;
  readonly content_hash: `sha256:${string}`;
}

interface ValidatedMemoryWriteRequestV1 {
  readonly request: MemoryWriteBatchRequestV1;
  readonly valid_items: readonly ValidatedMemoryWriteItemV1[];
  readonly rejected_items: readonly RejectedMemoryWriteItemV1[];
  readonly original_item_count: number;
  readonly request_hash: `sha256:${string}`;
}

function validClientItemIdV1(value: unknown): string | undefined {
  try {
    assertIdentifier(value, "client_item_id");
    return value;
  } catch {
    return undefined;
  }
}

function validateWriteRequest(
  requestValue: unknown,
  rawBodyBytes: number,
): ValidatedMemoryWriteRequestV1 {
  if (
    !Number.isSafeInteger(rawBodyBytes) ||
    rawBodyBytes < 0
  ) {
    fail("invalid_request", "raw_body_bytes is invalid");
  }
  if (rawBodyBytes > 2_097_152) {
    fail("payload_too_large", "request body exceeds 2 MiB");
  }
  const requestSnapshot = ownJsonValue(requestValue);
  assertObject(requestSnapshot, "request");
  assertExactKeys(
    requestSnapshot,
    [
      "schema_version",
      "bot_id",
      "trigger_process_id",
      "source_meta_job_id",
      "idempotency_key",
      "items",
    ],
    ["compatibility_mode"],
  );
  const record = requestSnapshot as Readonly<Record<string, unknown>>;
  if (record["schema_version"] !== "memory.write_batch.v1") {
    fail("schema_validation_failed", "schema_version is invalid", "/schema_version");
  }
  assertIdentifier(record["bot_id"], "bot_id");
  assertIdentifier(record["trigger_process_id"], "trigger_process_id");
  assertIdentifier(record["source_meta_job_id"], "source_meta_job_id");
  if (
    typeof record["idempotency_key"] !== "string" ||
    record["idempotency_key"].length === 0 ||
    Buffer.byteLength(record["idempotency_key"], "utf8") > 128
  ) {
    fail("schema_validation_failed", "idempotency_key is invalid", "/idempotency_key");
  }
  if (!Array.isArray(record["items"]) || record["items"].length < 1) {
    fail("schema_validation_failed", "items is required", "/items");
  }
  if (record["items"].length > 100) {
    fail("too_many_items", "batch contains more than 100 items", "/items");
  }
  if (
    record["compatibility_mode"] !== undefined &&
    record["compatibility_mode"] !== "legacy_subject_order"
  ) {
    fail("schema_validation_failed", "compatibility_mode is invalid");
  }
  const rawItems = record["items"] as readonly unknown[];
  const explicitClientIds = rawItems.flatMap((item) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      return [];
    }
    const clientItemId = validClientItemIdV1(
      (item as Readonly<Record<string, unknown>>)["client_item_id"],
    );
    return clientItemId === undefined ? [] : [clientItemId];
  });
  if (new Set(explicitClientIds).size !== explicitClientIds.length) {
    fail(
      "schema_validation_failed",
      "client_item_id must be unique",
      "/items",
    );
  }
  const assignedClientIds = new Set(explicitClientIds);
  const validItems: ValidatedMemoryWriteItemV1[] = [];
  const rejectedItems: RejectedMemoryWriteItemV1[] = [];
  const hashEntries: Array<
    Readonly<{ client_item_id: string; value: unknown }>
  > = [];
  for (const [index, rawItem] of rawItems.entries()) {
    const rawHash = `sha256:${sha256Hex(memoryCanonicalJsonV1(rawItem))}` as const;
    const rawRecord =
      typeof rawItem === "object" &&
      rawItem !== null &&
      !Array.isArray(rawItem)
        ? (rawItem as Readonly<Record<string, unknown>>)
        : undefined;
    const explicitClientItemId = validClientItemIdV1(
      rawRecord?.["client_item_id"],
    );
    let clientItemId = explicitClientItemId;
    if (clientItemId === undefined) {
      const baseClientItemId =
        `invalid_item_${index + 1}_${rawHash.slice("sha256:".length, 23)}`;
      clientItemId = baseClientItemId;
      let collision = 1;
      while (assignedClientIds.has(clientItemId)) {
        clientItemId = `${baseClientItemId}_${collision}`;
        collision += 1;
      }
      assignedClientIds.add(clientItemId);
    }
    hashEntries.push({ client_item_id: clientItemId, value: rawItem });
    try {
      if (!Value.Check(MemoryWriteItemV1Schema, rawItem)) {
        fail(
          "schema_validation_failed",
          "memory write item violates the owner schema",
          `/items/${index}`,
        );
      }
      validItems.push({
        item: validateWriteItem(
          rawItem as MemoryWriteItemV1,
          index,
        ),
        original_index: index,
      });
    } catch (error) {
      const rejection =
        error instanceof MemoryApplicationErrorV1
          ? error
          : new MemoryApplicationErrorV1(
              "schema_validation_failed",
              "memory write item violates the owner contract",
              false,
              `/items/${index}`,
            );
      rejectedItems.push({
        result: Object.freeze({
          client_item_id: clientItemId,
          status: "rejected",
          code: rejection.code,
          message: "memory write item was rejected",
          field_path: rejection.field_path ?? `/items/${index}`,
        }),
        original_index: index,
        source_item_id:
          validClientItemIdV1(rawRecord?.["source_item_id"]) ?? null,
        content_hash: rawHash,
      });
    }
  }
  const request: MemoryWriteBatchRequestV1 = {
    schema_version: "memory.write_batch.v1",
    bot_id: record["bot_id"],
    trigger_process_id: record["trigger_process_id"],
    source_meta_job_id: record["source_meta_job_id"],
    idempotency_key: record["idempotency_key"],
    ...(record["compatibility_mode"] === undefined
      ? {}
      : { compatibility_mode: record["compatibility_mode"] }),
    items: validItems.map(({ item }) => item),
  };
  if (request.items.length > 0) {
    assertOwnerContract(
      () => assertMemoryWriteBatchRequestSemanticBindingsV1(request),
      "memory write batch owner contract mismatch",
    );
  }
  const requestHash = `sha256:${sha256Hex(
    memoryCanonicalJsonV1({
      schema_version: request.schema_version,
      bot_id: request.bot_id,
      trigger_process_id: request.trigger_process_id,
      source_meta_job_id: request.source_meta_job_id,
      idempotency_key: request.idempotency_key,
      compatibility_mode: request.compatibility_mode ?? null,
      items: [...hashEntries].sort((left, right) =>
        compareMemoryIdentityV1(
          left.client_item_id,
          right.client_item_id,
        ),
      ),
    }),
  )}` as const;
  return Object.freeze({
    request,
    valid_items: Object.freeze(validItems),
    rejected_items: Object.freeze(rejectedItems),
    original_item_count: rawItems.length,
    request_hash: requestHash,
  });
}

function normalizedEmbeddingInput(value: string): string {
  const normalized = normalizeWhitespace(value);
  if (normalized.length === 0 || controlCharacterPattern.test(normalized)) {
    fail("schema_validation_failed", "embedding input is invalid");
  }
  return normalized;
}

export function normalizeMemoryEmbeddingV1(
  vector: readonly number[],
): readonly number[] {
  if (
    !Array.isArray(vector) ||
    vector.length !== MEMORY_EMBEDDING_PROFILE_V1.dimensions ||
    vector.some((value) => typeof value !== "number" || !Number.isFinite(value))
  ) {
    fail("dependency_unavailable", "embedding output is invalid", undefined, true);
  }
  const norm = Math.sqrt(
    vector.reduce((sum, value) => sum + value * value, 0),
  );
  if (!Number.isFinite(norm) || norm <= Number.EPSILON) {
    fail("dependency_unavailable", "embedding output is a zero vector", undefined, true);
  }
  return Object.freeze(vector.map((value) => value / norm));
}

function batchIdentity(scope: MemoryScopeV1, key: string): string {
  return memoryCanonicalJsonV1([scopeKey(scope), key]);
}

function pointContentHash(item: MemoryWriteItemV1): string {
  return `sha256:${sha256Hex(
    memoryCanonicalJsonV1({
      content_summary: normalizedEmbeddingInput(item.content_summary),
      human_agent_relation: [...item.human_agent_relation]
        .map((relation) => memoryCanonicalJsonV1(relation))
        .sort(),
      keyword_tags: dedupeNormalizedStrings(
        item.keyword_tags,
        "keyword_tags",
      ),
      scene_tags: [...new Set(item.scene_tags)].sort(),
      emotion_tags: [...new Set(item.emotion_tags)].sort(),
    }),
  )}`;
}

function validateOwnerValue<T>(
  schema: Parameters<typeof Value.Check>[0],
  value: unknown,
  assertion: (candidate: T) => void,
  label: string,
): T {
  memoryCanonicalJsonV1(value);
  if (!Value.Check(schema, value)) {
    fail("schema_validation_failed", `${label} violates the owner schema`);
  }
  try {
    assertion(value as T);
  } catch (error) {
    fail(
      "schema_validation_failed",
      `${label}: ${error instanceof Error ? error.message : "semantic mismatch"}`,
    );
  }
  return ownJsonValue(value) as T;
}

function promotionIdentity(
  scope: MemoryScopeV1,
  idempotencyKey: string,
): string {
  return memoryCanonicalJsonV1([scopeKey(scope), idempotencyKey]);
}

function promotionTokenHash(token: string): string {
  return `sha256:${sha256Hex(token)}`;
}

function promotionCheckTokenV1(
  secret: string,
  checkId: string,
  checkGeneration: number,
  requestHash: string,
  checkedAt: string,
): string {
  return `mct_${createHmac("sha256", secret)
    .update(
      memoryCanonicalJsonV1([
        "memory.pre_promotion_check_token.v1",
        checkId,
        checkGeneration,
        requestHash,
        checkedAt,
      ]),
      "utf8",
    )
    .digest("base64url")}`;
}

/**
 * The check token already contains owner-generated entropy. Binding it to the
 * exact validation request makes the reservation response replayable after a
 * commit-disconnect without persisting the bearer token itself.
 */
function promotionReservationTokenV1(
  reservationId: string,
  _fencingGeneration: number,
  requestHash: string,
  checkToken: string,
): string {
  return `mrt_${sha256Base64Url(
    memoryCanonicalJsonV1([
      "memory.promotion_reservation_token.v1",
      reservationId,
      requestHash,
      checkToken,
    ]),
  )}`;
}

function promotionRequestHashV1(
  request: Readonly<Record<string, unknown>>,
): string {
  const semanticRequest = Object.fromEntries(
    Object.entries(request).filter(([key]) => key !== "trace_id"),
  );
  return `sha256:${sha256Hex(memoryCanonicalJsonV1(semanticRequest))}`;
}

function pointStateHash(
  point: MutableMemoryPointV1,
  series: MutableMemorySeriesV1 | undefined,
): string {
  return `sha256:${sha256Hex(
    memoryCanonicalJsonV1({
      id: point.id,
      series_id: point.series_id,
      status: point.status,
      state_version: point.state_version,
      content_hash: point.content_hash,
      source_trigger_process_id: point.source_trigger_process_id,
      confidence_score: point.confidence_score,
      occurred_at: point.occurred_at,
      evidence_valid_until: point.evidence_valid_until,
      series_state:
        series === undefined
          ? null
          : {
              id: series.id,
              status: series.status,
              state_version: series.state_version,
              current_version: series.current_version,
            },
    }),
  )}`;
}

function promotionCheckSnapshotIsCurrent(
  state: MemoryStateV1,
  check: StoredPromotionCheckV1,
  now: Date,
): boolean {
  if (
    check.response.check_policy_version !==
      MEMORY_PRE_PROMOTION_POLICY_VERSION_V1 ||
    Date.parse(check.response.expires_at) <= now.getTime()
  ) {
    return false;
  }
  for (const checkedPoint of check.response.points) {
    const point = state.points.get(checkedPoint.memory_point_id);
    if (!checkedPoint.exists) {
      if (point !== undefined && sameScope(point.scope, check.scope)) {
        return false;
      }
      continue;
    }
    if (
      point === undefined ||
      !sameScope(point.scope, check.scope) ||
      point.state_version !== checkedPoint.state_version ||
      point.evidence_valid_until !==
        checkedPoint.evidence_valid_until ||
      pointStateHash(point, state.series.get(point.series_id)) !==
        checkedPoint.state_hash
    ) {
      return false;
    }
    const expired =
      point.evidence_valid_until !== null &&
      Date.parse(point.evidence_valid_until) <= now.getTime();
    if (expired !== checkedPoint.expired) return false;
    const currentConflicts = [...state.conflicts.values()]
      .filter(
        (conflict) =>
          sameScope(conflict.scope, check.scope) &&
          conflict.status === "open" &&
          (conflict.left_memory_point_id === point.id ||
            conflict.right_memory_point_id === point.id),
      )
      .map((conflict) => ({
        conflict_id: conflict.id,
        conflict_version: conflict.state_version,
      }))
      .sort((left, right) =>
        compareMemoryIdentityV1(left.conflict_id, right.conflict_id),
      );
    const checkedConflicts = [...checkedPoint.unresolved_conflicts].sort(
      (left, right) =>
        compareMemoryIdentityV1(left.conflict_id, right.conflict_id),
    );
    if (
      memoryCanonicalJsonV1(currentConflicts) !==
      memoryCanonicalJsonV1(checkedConflicts)
    ) {
      return false;
    }
  }
  return true;
}

function seriesStateHash(series: MutableMemorySeriesV1): string {
  return `sha256:${sha256Hex(
    memoryCanonicalJsonV1({
      id: series.id,
      status: series.status,
      state_version: series.state_version,
      current_version: series.current_version,
      topic_key: series.topic_key,
      topic_family_key: series.topic_family_key,
      last_mentioned_at: series.last_mentioned_at,
    }),
  )}`;
}

function conflictStateHash(conflict: MemoryConflictV1): string {
  return `sha256:${sha256Hex(
    memoryCanonicalJsonV1({
      id: conflict.id,
      status: conflict.status,
      state_version: conflict.state_version,
      old_series_id: conflict.old_series_id,
      new_series_id: conflict.new_series_id,
      left_memory_point_id: conflict.left_memory_point_id,
      right_memory_point_id: conflict.right_memory_point_id,
      incoming_content_hash: conflict.incoming_content_hash,
    }),
  )}`;
}

function promotionTargetKey(
  aggregateType: PromotionTargetSnapshotV1["aggregate_type"],
  aggregateId: string,
): string {
  return `${aggregateType}:${aggregateId}`;
}

function removeActivePromotionTargets(
  state: MemoryStateV1,
  reservation: MutablePromotionReservationStateV1,
): void {
  const candidateKey = promotionIdentity(
    reservation.scope,
    reservation.reservation.candidate_fact_id,
  );
  if (
    state.activePromotionReservationByCandidate.get(candidateKey) ===
    reservation.reservation.reservation_id
  ) {
    state.activePromotionReservationByCandidate.delete(candidateKey);
  }
  for (const target of reservation.targets) {
    const key = promotionTargetKey(
      target.aggregate_type,
      target.aggregate_id,
    );
    if (
      state.activePromotionReservationByTarget.get(key) ===
      reservation.reservation.reservation_id
    ) {
      state.activePromotionReservationByTarget.delete(key);
    }
  }
}

function expirePromotionReservations(
  state: MemoryStateV1,
  now: Date,
): void {
  for (const reservation of state.promotionReservations.values()) {
    if (
      reservation.status === "active" &&
      Date.parse(reservation.reservation.expires_at) <= now.getTime()
    ) {
      reservation.status = "expired";
      reservation.release_origin = "expiration";
      reservation.release_response = Object.freeze({
        schema_version: "memory.promotion_reservation_release.v1",
        reservation_id: reservation.reservation.reservation_id,
        candidate_fact_id: reservation.reservation.candidate_fact_id,
        fencing_generation:
          reservation.reservation.fencing_generation,
        status: "released",
        release_reason: "reservation_expired",
        released_at: reservation.reservation.expires_at,
        duplicate_replayed: false,
      });
      removeActivePromotionTargets(state, reservation);
    }
  }
}

function assertPromotionTargetsAvailable(
  state: MemoryStateV1,
  keys: readonly string[],
  now: Date,
): void {
  expirePromotionReservations(state, now);
  const reserved = keys
    .map((key) => ({
      key,
      reservation_id:
        state.activePromotionReservationByTarget.get(key),
    }))
    .find(({ reservation_id }) => reservation_id !== undefined);
  if (reserved?.reservation_id !== undefined) {
    const reservation = state.promotionReservations.get(
      reserved.reservation_id,
    );
    fail(
      "promotion_reserved",
      `Memory aggregate ${reserved.key} has an active promotion reservation`,
      undefined,
      true,
      reservation === undefined
        ? undefined
        : { retry_after: reservation.reservation.expires_at },
    );
  }
}

function pruneRecallSnapshotsV1(
  state: MemoryStateV1,
  scope: MemoryScopeV1,
  now: Date,
  makeRoom: boolean,
): void {
  for (const [token, snapshot] of state.recallSnapshots) {
    if (Date.parse(snapshot.expires_at) <= now.getTime()) {
      state.recallSnapshots.delete(token);
    }
  }
  if (!makeRoom) return;
  const oldestFirst = (entries: readonly [string, RecallSnapshotV1][]) =>
    [...entries].sort(
      (left, right) =>
        Date.parse(left[1].expires_at) - Date.parse(right[1].expires_at) ||
        compareMemoryIdentityV1(left[0], right[0]),
    );
  const scoped = oldestFirst(
    [...state.recallSnapshots.entries()].filter(([, snapshot]) =>
      sameScope(snapshot.scope, scope),
    ),
  );
  while (scoped.length >= MEMORY_RECALL_SNAPSHOT_MAX_PER_SCOPE_V1) {
    const evicted = scoped.shift();
    if (evicted !== undefined) state.recallSnapshots.delete(evicted[0]);
  }
  const global = oldestFirst([...state.recallSnapshots.entries()]);
  while (global.length >= MEMORY_RECALL_SNAPSHOT_MAX_TOTAL_V1) {
    const evicted = global.shift();
    if (evicted !== undefined) state.recallSnapshots.delete(evicted[0]);
  }
}

function assertReservationFence(
  repository: MemoryStateV1,
  state: MutablePromotionReservationStateV1,
  input: Readonly<{
    candidate_fact_id: string;
    fencing_generation: number;
  }>,
): void {
  if (
    state.reservation.candidate_fact_id !== input.candidate_fact_id ||
    state.reservation.fencing_generation !== input.fencing_generation
  ) {
    fail(
      "promotion_stale_fence",
      "promotion reservation identity or fencing generation is stale",
    );
  }
  assertCurrentPromotionGeneration(repository, state);
}

function assertReservationTokenHash(
  state: MutablePromotionReservationStateV1,
  input: Readonly<{ reservation_token_hash: string }>,
): void {
  const expected = Buffer.from(state.reservation_token_hash, "utf8");
  const actual = Buffer.from(input.reservation_token_hash, "utf8");
  if (
    expected.byteLength !== actual.byteLength ||
    !timingSafeEqual(expected, actual)
  ) {
    fail(
      "promotion_stale_fence",
      "promotion reservation token hash is stale",
    );
  }
}

function assertCurrentPromotionGeneration(
  state: MemoryStateV1,
  reservation: MutablePromotionReservationStateV1,
): void {
  const generationKey = promotionIdentity(
    reservation.scope,
    reservation.reservation.candidate_fact_id,
  );
  if (
    state.promotionGenerationByCandidate.get(generationKey) !==
    reservation.reservation.fencing_generation
  ) {
    fail(
      "promotion_stale_fence",
      "promotion reservation fencing generation has been superseded",
    );
  }
}

function assertPromotionTargetVersions(
  state: MemoryStateV1,
  reservation: MutablePromotionReservationStateV1,
): void {
  for (const target of reservation.targets) {
    let currentVersion: number | undefined;
    let currentHash: string | undefined;
    if (target.aggregate_type === "memory_point") {
      const point = state.points.get(target.aggregate_id);
      currentVersion = point?.state_version;
      currentHash =
        point === undefined
          ? undefined
          : pointStateHash(point, state.series.get(point.series_id));
    } else if (target.aggregate_type === "memory_series") {
      const series = state.series.get(target.aggregate_id);
      currentVersion = series?.state_version;
      currentHash =
        series === undefined ? undefined : seriesStateHash(series);
    } else {
      const conflict = state.conflicts.get(target.aggregate_id);
      currentVersion = conflict?.state_version;
      currentHash =
        conflict === undefined ? undefined : conflictStateHash(conflict);
    }
    if (
      currentVersion !== target.expected_state_version ||
      currentHash !== target.expected_state_hash
    ) {
      fail(
        "promotion_version_drift",
        `${target.aggregate_type} ${target.aggregate_id} changed after reservation`,
        undefined,
        true,
      );
    }
  }
  const reservedPointIds = new Set(
    reservation.reservation.reserved_points.map(
      (point) => point.memory_point_id,
    ),
  );
  const currentConflicts = [...state.conflicts.values()]
    .filter(
      (conflict) =>
        sameScope(conflict.scope, reservation.scope) &&
        conflict.status === "open" &&
        (reservedPointIds.has(conflict.left_memory_point_id) ||
          reservedPointIds.has(conflict.right_memory_point_id)),
    )
    .map((conflict) => ({
      conflict_id: conflict.id,
      conflict_version: conflict.state_version,
    }))
    .sort((left, right) =>
      compareMemoryIdentityV1(left.conflict_id, right.conflict_id),
    );
  const reservedConflicts = [
    ...reservation.reservation.reserved_conflicts,
  ].sort((left, right) =>
    compareMemoryIdentityV1(left.conflict_id, right.conflict_id),
  );
  if (
    memoryCanonicalJsonV1(currentConflicts) !==
    memoryCanonicalJsonV1(reservedConflicts)
  ) {
    fail(
      "promotion_version_drift",
      "Memory conflict set changed after promotion reservation",
      undefined,
      true,
    );
  }
}

function writeBatchId(
  scope: MemoryScopeV1,
  idempotencyKey: string,
): string {
  return `mwb_${sha256Base64Url(
    memoryCanonicalJsonV1([scopeKey(scope), idempotencyKey]),
  ).slice(0, 32)}`;
}

function cloneBatchResponse(
  response: MemoryWriteBatchResponseV1,
  replayed: boolean,
): MemoryWriteBatchResponseV1 {
  return Object.freeze({
    ...structuredClone(response),
    duplicate_replayed: replayed,
  });
}

function queryTokens(value: string): readonly string[] {
  return Object.freeze(
    [...new Set(unicodeCaseFold(normalizeWhitespace(value)).split(/\s+/u))]
      .filter((token) => token.length > 0)
      .sort(),
  );
}

function cosine(left: readonly number[], right: readonly number[]): number {
  let dot = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index]! * right[index]!;
  }
  return Math.max(-1, Math.min(1, dot));
}

export interface MemoryApplicationOptionsV1 {
  readonly max_estimated_embedding_items?: number;
  readonly integration_lease_seconds?: number;
  readonly legacy_subject_order_owner_agent_ids?: readonly string[];
  readonly promotion_token_hmac_secret?: string;
}

export class MemoryApplicationV1 {
  readonly #maxEmbeddingItems: number;
  readonly #integrationLeaseSeconds: number;
  readonly #legacySubjectOrderOwnerAgentIds: ReadonlySet<string>;
  readonly #promotionTokenHmacSecret: string;
  readonly #writeBatchInFlight = new Map<
    string,
    Readonly<{
      request_hash: string;
      promise: Promise<MemoryWriteBatchResponseV1>;
    }>
  >();

  public constructor(
    private readonly repository: MemoryStateRepositoryPortV1,
    private readonly embedding: MemoryEmbeddingPortV1,
    options: MemoryApplicationOptionsV1 = {},
  ) {
    this.#maxEmbeddingItems = options.max_estimated_embedding_items ?? 100;
    this.#integrationLeaseSeconds = options.integration_lease_seconds ?? 30;
    this.#legacySubjectOrderOwnerAgentIds = new Set(
      options.legacy_subject_order_owner_agent_ids ?? [],
    );
    this.#promotionTokenHmacSecret =
      options.promotion_token_hmac_secret ??
      "local-test-only-memory-promotion-secret-v1";
    if (Buffer.byteLength(this.#promotionTokenHmacSecret, "utf8") < 32) {
      throw new Error("Memory promotion token HMAC secret is too short");
    }
  }

  public async checkReadiness(): Promise<void> {
    await Promise.all([
      this.repository.checkReadiness(),
      this.embedding.checkReadiness(),
    ]);
  }

  public async checkPrePromotion(
    principal: MemoryPrincipalV1,
    requestValue: unknown,
    now = new Date(),
  ): Promise<MemoryPrePromotionCheckResponseV1> {
    const requestNow = snapshotMemoryNowV1(
      now,
      "pre-promotion check now",
    );
    const request = validateOwnerValue(
      MemoryPrePromotionCheckRequestV1Schema,
      requestValue,
      assertMemoryPrePromotionCheckRequestSemanticBindingsV1,
      "pre-promotion check request",
    );
    const scope = assertPrincipal(
      principal,
      "knowthat",
      "memory.pre_promotion_check",
      request.bot_id,
    );
    const requestHash = promotionRequestHashV1(request);
    const identity = promotionIdentity(scope, request.idempotency_key);
    return this.repository.transact((state) => {
      const existing = state.promotionChecksByIdempotency.get(identity);
      if (existing !== undefined) {
        if (existing.request_hash !== requestHash) {
          fail(
            "idempotency_conflict",
            "pre-promotion check idempotency key drifted",
          );
        }
        if (
          promotionCheckSnapshotIsCurrent(
            state,
            existing,
            requestNow,
          )
        ) {
          const replayToken = promotionCheckTokenV1(
            this.#promotionTokenHmacSecret,
            existing.response.check_id,
            existing.response.check_generation,
            existing.request_hash,
            existing.response.checked_at,
          );
          if (promotionTokenHash(replayToken) !== existing.check_token_hash) {
            fail(
              "dependency_unavailable",
              "the pre-promotion check replay proof is corrupt",
              undefined,
              true,
            );
          }
          return snapshotMemoryBoundaryV1({
            ...structuredClone(existing.response),
            check_token: replayToken,
            duplicate_replayed: true,
          });
        }
        state.promotionChecksByTokenHash.delete(existing.check_token_hash);
      }
      const requiredChecks = Object.freeze([
        ...(request.required_checks ?? [
          "point_exists",
          "state_allowed",
          "no_unresolved_conflict",
          "not_expired",
          "provenance_integrity",
        ]),
      ]);
      const pointRows = request.memory_point_ids.map((pointId) => {
        const point = state.points.get(pointId);
        if (point === undefined || !sameScope(point.scope, scope)) {
          return Object.freeze({
            memory_point_id: pointId,
            exists: false as const,
            state_version: null,
            state_hash: null,
            status: null,
            evidence_valid_until: null,
            unresolved_conflicts: Object.freeze([]),
            expired: false as const,
            provenance_valid: false as const,
            source_trigger_process_id: null,
            confidence_score: null,
            user_explicit_confirmation: false as const,
            blocking_reasons: Object.freeze(["point_missing"] as const),
          });
        }
        const unresolved = [...state.conflicts.values()]
          .filter(
            (conflict) =>
              sameScope(conflict.scope, scope) &&
              conflict.status === "open" &&
              (conflict.left_memory_point_id === point.id ||
                conflict.right_memory_point_id === point.id),
          )
          .map((conflict) =>
            Object.freeze({
              conflict_id: conflict.id,
              conflict_version: conflict.state_version,
            }),
          )
          .sort((left, right) =>
            compareMemoryIdentityV1(
              left.conflict_id,
              right.conflict_id,
            ),
          );
        const series = state.series.get(point.series_id);
        const expired =
          point.evidence_valid_until !== null &&
          Date.parse(point.evidence_valid_until) <= requestNow.getTime();
        const blockingReasons: string[] = [];
        if (
          requiredChecks.includes("state_allowed") &&
          (point.status !== "active" || series?.status !== "active")
        ) {
          blockingReasons.push(
            point.status === "downgraded"
              ? "point_downgraded"
              : point.status === "archived"
                ? "point_archived"
                : "point_not_active",
          );
        }
        if (
          requiredChecks.includes("no_unresolved_conflict") &&
          unresolved.length > 0
        ) {
          blockingReasons.push("unresolved_conflict");
        }
        if (requiredChecks.includes("not_expired") && expired) {
          blockingReasons.push("evidence_expired");
        }
        const provenanceValid =
          point.source_info.source_ref.length > 0 &&
          point.source_trigger_process_id.length > 0;
        if (
          requiredChecks.includes("provenance_integrity") &&
          !provenanceValid
        ) {
          blockingReasons.push("provenance_invalid");
        }
        const userConfirmed =
          point.source_info.source_type === "user_explicit" &&
          point.source_info.actor_type === "user";
        return Object.freeze({
          memory_point_id: point.id,
          exists: true as const,
          state_version: point.state_version,
          state_hash: pointStateHash(point, series),
          status: point.status,
          evidence_valid_until: point.evidence_valid_until,
          unresolved_conflicts: Object.freeze(unresolved),
          expired,
          provenance_valid: provenanceValid,
          source_trigger_process_id: point.source_trigger_process_id,
          confidence_score: point.confidence_score,
          user_explicit_confirmation: userConfirmed,
          blocking_reasons: Object.freeze(blockingReasons),
        });
      }) as MemoryPrePromotionCheckResponseV1["points"];
      const existingRows = pointRows.filter(
        (point) => point.exists === true,
      );
      const independentTriggerCount = new Set(
        existingRows.map((point) => point.source_trigger_process_id),
      ).size;
      const hasUserConfirmation = existingRows.some(
        (point) => point.user_explicit_confirmation,
      );
      const summaryReasons = new Set(
        pointRows.flatMap((point) => [...point.blocking_reasons]),
      );
      if (
        requiredChecks.includes("independent_sources") &&
        independentTriggerCount < 2
      ) {
        summaryReasons.add("insufficient_independent_sources");
      }
      if (
        requiredChecks.includes("user_confirmation") &&
        !hasUserConfirmation
      ) {
        summaryReasons.add("user_confirmation_missing");
      }
      const reviewOnlyReasons = new Set([
        "insufficient_independent_sources",
        "user_confirmation_missing",
      ]);
      const result =
        summaryReasons.size === 0
          ? "passed"
          : [...summaryReasons].every((reason) =>
                reviewOnlyReasons.has(reason),
              )
            ? "needs_review"
            : "blocked";
      const checkedAt = requestNow.toISOString();
      const checkGeneration = nextMemoryCounterV1(
        existing?.response.check_generation ?? 0,
        "pre-promotion check generation",
      );
      const checkId = `mpc_${sha256Base64Url(
        memoryCanonicalJsonV1([
          scopeKey(scope),
          request.idempotency_key,
          checkGeneration,
          requestHash,
          checkedAt,
        ]),
      ).slice(0, 32)}`;
      const checkToken = promotionCheckTokenV1(
        this.#promotionTokenHmacSecret,
        checkId,
        checkGeneration,
        requestHash,
        checkedAt,
      );
      const response = snapshotMemoryBoundaryV1({
        schema_version: "memory.pre_promotion_check.v1" as const,
        check_id: checkId,
        check_generation: checkGeneration,
        candidate_fact_id: request.candidate_fact_id,
        overall_result: result,
        checked_at: checkedAt,
        expires_at: new Date(
          requestNow.getTime() + 30_000,
        ).toISOString(),
        check_token: checkToken,
        check_policy_version: MEMORY_PRE_PROMOTION_POLICY_VERSION_V1,
        required_checks: requiredChecks,
        points: Object.freeze(pointRows),
        summary: Object.freeze({
          active_count: existingRows.filter(
            (point) => point.status === "active",
          ).length,
          independent_trigger_process_count: independentTriggerCount,
          has_user_explicit_confirmation: hasUserConfirmation,
          blocking_reasons: Object.freeze([...summaryReasons].sort()),
        }),
        duplicate_replayed: false,
      }) as MemoryPrePromotionCheckResponseV1;
      assertOwnerContract(
        () =>
          assertMemoryPrePromotionCheckResponseSemanticBindingsV1(response),
        "pre-promotion check response owner contract mismatch",
      );
      const { check_token: _checkToken, ...responseWithoutToken } = response;
      const stored = Object.freeze({
        scope,
        identity,
        request_hash: requestHash,
        check_token_hash: promotionTokenHash(checkToken),
        response: snapshotMemoryBoundaryV1(responseWithoutToken),
      });
      state.promotionChecksByIdempotency.set(identity, stored);
      state.promotionChecksByTokenHash.set(
        stored.check_token_hash,
        stored,
      );
      return response;
    }, scope);
  }

  public async validatePrePromotion(
    principal: MemoryPrincipalV1,
    requestValue: unknown,
    now = new Date(),
  ): Promise<MemoryPromotionReservationV1> {
    const requestNow = snapshotMemoryNowV1(
      now,
      "pre-promotion validation now",
    );
    const request = validateOwnerValue(
      MemoryPrePromotionValidateRequestV1Schema,
      requestValue,
      assertMemoryPrePromotionValidateRequestSemanticBindingsV1,
      "pre-promotion validation request",
    );
    const scope = assertPrincipal(
      principal,
      "knowthat",
      "memory.pre_promotion_check",
      request.bot_id,
    );
    const requestHash = `sha256:${sha256Hex(
      memoryCanonicalJsonV1(request),
    )}`;
    const identity = promotionIdentity(scope, request.idempotency_key);
    return this.repository.transact((state) => {
      const priorReservationId =
        state.promotionReservationIdByIdempotency.get(identity);
      if (priorReservationId !== undefined) {
        const prior = state.promotionReservations.get(priorReservationId);
        if (prior === undefined || prior.request_hash !== requestHash) {
          fail(
            "idempotency_conflict",
            "promotion reservation idempotency key drifted",
          );
        }
        if (
          prior.status !== "active" ||
          Date.parse(prior.reservation.expires_at) <= requestNow.getTime()
        ) {
          fail(
            "promotion_check_expired",
            "the idempotent promotion reservation is no longer active; redo check with a new attempt key",
            undefined,
            true,
          );
        }
        const reservationToken = promotionReservationTokenV1(
          prior.reservation.reservation_id,
          prior.reservation.fencing_generation,
          requestHash,
          request.check_token,
        );
        if (
          promotionTokenHash(reservationToken) !==
          prior.reservation_token_hash
        ) {
          fail(
            "dependency_unavailable",
            "the idempotent promotion reservation proof is corrupt",
            undefined,
            true,
          );
        }
        return snapshotMemoryBoundaryV1({
          ...structuredClone(prior.reservation),
          reservation_token: reservationToken,
        });
      }
      const check = state.promotionChecksByTokenHash.get(
        promotionTokenHash(request.check_token),
      );
      if (
        check === undefined ||
        !sameScope(check.scope, scope) ||
        check.response.candidate_fact_id !== request.candidate_fact_id ||
        check.response.check_id !== request.check_id ||
        check.response.check_generation !== request.check_generation
      ) {
        fail(
          "stale_memory_check",
          "pre-promotion check token, identity, or generation is stale",
          undefined,
          true,
        );
      }
      const currentCheck = state.promotionChecksByIdempotency.get(
        check.identity,
      );
      if (
        currentCheck === undefined ||
        currentCheck.response.check_id !== check.response.check_id ||
        currentCheck.response.check_generation !==
          check.response.check_generation ||
        !promotionCheckSnapshotIsCurrent(state, check, requestNow) ||
        check.response.overall_result !== "passed" ||
        Date.parse(check.response.expires_at) <= requestNow.getTime()
      ) {
        fail(
          "stale_memory_check",
          "pre-promotion check is non-current, blocked, or expired",
          undefined,
          true,
        );
      }
      const checkedPoints = check.response.points
        .filter((point) => point.exists)
        .map((point) => ({
          memory_point_id: point.memory_point_id,
          state_version: point.state_version,
          state_hash: point.state_hash,
        }))
        .sort((left, right) =>
          compareMemoryIdentityV1(
            left.memory_point_id,
            right.memory_point_id,
          ),
        );
      const expectedPoints = [...request.expected_point_versions].sort(
        (left, right) =>
          compareMemoryIdentityV1(
            left.memory_point_id,
            right.memory_point_id,
          ),
      );
      const checkedConflicts = check.response.points
        .flatMap((point) => point.unresolved_conflicts)
        .sort((left, right) =>
          compareMemoryIdentityV1(
            left.conflict_id,
            right.conflict_id,
          ),
        );
      const expectedConflicts = [...request.expected_conflict_versions].sort(
        (left, right) =>
          compareMemoryIdentityV1(
            left.conflict_id,
            right.conflict_id,
          ),
      );
      if (
        memoryCanonicalJsonV1(checkedPoints) !==
          memoryCanonicalJsonV1(expectedPoints) ||
        memoryCanonicalJsonV1(checkedConflicts) !==
          memoryCanonicalJsonV1(expectedConflicts)
      ) {
        fail(
          "promotion_version_drift",
          "validation versions do not exactly match the checked snapshot",
          undefined,
          true,
        );
      }
      const targets: PromotionTargetSnapshotV1[] = [];
      for (const expected of expectedPoints) {
        const point = state.points.get(expected.memory_point_id);
        const series =
          point === undefined
            ? undefined
            : state.series.get(point.series_id);
        if (
          point === undefined ||
          !sameScope(point.scope, scope) ||
          point.state_version !== expected.state_version ||
          pointStateHash(point, series) !== expected.state_hash ||
          (point.evidence_valid_until !== null &&
            Date.parse(point.evidence_valid_until) <=
              requestNow.getTime())
        ) {
          fail(
            "promotion_version_drift",
            `memory point ${expected.memory_point_id} changed after check`,
            undefined,
            true,
          );
        }
        targets.push({
          aggregate_type: "memory_point",
          aggregate_id: point.id,
          expected_state_version: point.state_version,
          expected_state_hash: expected.state_hash,
        });
        if (series === undefined || !sameScope(series.scope, scope)) {
          fail(
            "promotion_version_drift",
            `memory series ${point.series_id} disappeared after check`,
            undefined,
            true,
          );
        }
        if (
          !targets.some(
            (target) =>
              target.aggregate_type === "memory_series" &&
              target.aggregate_id === series.id,
          )
        ) {
          targets.push({
            aggregate_type: "memory_series",
            aggregate_id: series.id,
            expected_state_version: series.state_version,
            expected_state_hash: seriesStateHash(series),
          });
        }
      }
      const expectedPointIds = new Set(
        expectedPoints.map((point) => point.memory_point_id),
      );
      const currentConflictVersions = [...state.conflicts.values()]
        .filter(
          (conflict) =>
            sameScope(conflict.scope, scope) &&
            conflict.status === "open" &&
            (expectedPointIds.has(conflict.left_memory_point_id) ||
              expectedPointIds.has(conflict.right_memory_point_id)),
        )
        .map((conflict) => ({
          conflict_id: conflict.id,
          conflict_version: conflict.state_version,
        }))
        .sort((left, right) =>
          compareMemoryIdentityV1(
            left.conflict_id,
            right.conflict_id,
          ),
        );
      if (
        memoryCanonicalJsonV1(currentConflictVersions) !==
        memoryCanonicalJsonV1(expectedConflicts)
      ) {
        fail(
          "promotion_version_drift",
          "Memory conflict set changed after pre-promotion check",
          undefined,
          true,
        );
      }
      for (const expected of expectedConflicts) {
        const conflict = state.conflicts.get(expected.conflict_id);
        if (
          conflict === undefined ||
          !sameScope(conflict.scope, scope) ||
          conflict.state_version !== expected.conflict_version
        ) {
          fail(
            "promotion_version_drift",
            `memory conflict ${expected.conflict_id} changed after check`,
            undefined,
            true,
          );
        }
        targets.push({
          aggregate_type: "memory_conflict",
          aggregate_id: conflict.id,
          expected_state_version: conflict.state_version,
          expected_state_hash: conflictStateHash(conflict),
        });
      }
      const targetKeys = targets.map((target) =>
        promotionTargetKey(target.aggregate_type, target.aggregate_id),
      );
      assertPromotionTargetsAvailable(state, targetKeys, requestNow);
      const generationKey = promotionIdentity(
        scope,
        request.candidate_fact_id,
      );
      if (
        state.activePromotionReservationByCandidate.get(generationKey) !==
        undefined
      ) {
        const activeReservationId =
          state.activePromotionReservationByCandidate.get(generationKey)!;
        const activeReservation =
          state.promotionReservations.get(activeReservationId);
        fail(
          "promotion_reserved",
          `candidate ${request.candidate_fact_id} already has an active promotion reservation`,
          undefined,
          true,
          activeReservation === undefined
            ? undefined
            : { retry_after: activeReservation.reservation.expires_at },
        );
      }
      const generation = nextMemoryCounterV1(
        state.promotionGenerationByCandidate.get(generationKey) ?? 0,
        "promotion fencing generation",
      );
      const reservationId = `mpr_${sha256Base64Url(
        memoryCanonicalJsonV1([scopeKey(scope), request.idempotency_key]),
      ).slice(0, 32)}`;
      const reservationToken = promotionReservationTokenV1(
        reservationId,
        generation,
        requestHash,
        request.check_token,
      );
      const reservation: MemoryPromotionReservationV1 =
        snapshotMemoryBoundaryV1({
        schema_version: "memory.promotion_reservation.v1" as const,
        reservation_id: reservationId,
        check_id: check.response.check_id,
        check_generation: check.response.check_generation,
        candidate_fact_id: request.candidate_fact_id,
        fencing_generation: generation,
        reserved_points: expectedPoints.map((entry) => ({ ...entry })),
        reserved_conflicts: expectedConflicts.map((entry) => ({ ...entry })),
        reservation_token: reservationToken,
        reserved_at: requestNow.toISOString(),
        expires_at: new Date(
          requestNow.getTime() + 5_000,
        ).toISOString(),
        status: "active" as const,
      });
      assertOwnerContract(
        () =>
          assertMemoryPromotionReservationSemanticBindingsV1(reservation),
        "promotion reservation owner contract mismatch",
      );
      const stored: MutablePromotionReservationStateV1 = {
        scope,
        request_hash: requestHash,
        validation_idempotency_key: request.idempotency_key,
        reservation: snapshotMemoryBoundaryV1({
          schema_version: reservation.schema_version,
          reservation_id: reservation.reservation_id,
          check_id: reservation.check_id,
          check_generation: reservation.check_generation,
          candidate_fact_id: reservation.candidate_fact_id,
          fencing_generation: reservation.fencing_generation,
          reserved_points: reservation.reserved_points,
          reserved_conflicts: reservation.reserved_conflicts,
          reserved_at: reservation.reserved_at,
          expires_at: reservation.expires_at,
          status: reservation.status,
        }),
        reservation_token_hash: promotionTokenHash(reservationToken),
        targets: Object.freeze(
          targets.map((target) => Object.freeze({ ...target })),
        ),
        status: "active",
        ack_request_hash: null,
        ack_response: null,
        release_request_hash: null,
        release_response: null,
        release_origin: null,
      };
      state.promotionReservations.set(reservationId, stored);
      state.promotionReservationIdByIdempotency.set(
        identity,
        reservationId,
      );
      state.promotionGenerationByCandidate.set(generationKey, generation);
      state.activePromotionReservationByCandidate.set(
        generationKey,
        reservationId,
      );
      for (const key of targetKeys) {
        state.activePromotionReservationByTarget.set(key, reservationId);
      }
      return reservation;
    }, scope);
  }

  public async ackPromotionReservation(
    principal: MemoryPrincipalV1,
    requestValue: unknown,
  ): Promise<MemoryPromotionReservationAckResponseV1> {
    const request = validateOwnerValue(
      MemoryPromotionReservationAckRequestV1Schema,
      requestValue,
      assertMemoryPromotionReservationAckRequestSemanticBindingsV1,
      "promotion reservation ack request",
    );
    const scope = assertPrincipal(
      principal,
      "knowthat",
      "memory.promotion_reservation.ack",
      request.bot_id,
    );
    const requestHash = promotionRequestHashV1(request);
    return this.repository.transact((state) => {
      const stored = state.promotionReservations.get(
        request.reservation_id,
      );
      if (stored === undefined || !sameScope(stored.scope, scope)) {
        fail(
          "promotion_reservation_not_found",
          "promotion reservation was not found",
        );
      }
      assertReservationFence(state, stored, request);
      assertReservationTokenHash(stored, request);
      if (stored.ack_response !== null) {
        if (stored.ack_request_hash !== requestHash) {
          fail(
            "idempotency_conflict",
            "promotion reservation ack request drifted",
          );
        }
        return Object.freeze({
          ...structuredClone(stored.ack_response),
          duplicate_replayed: true,
        });
      }
      const expiredButCommitProven =
        stored.status === "expired" &&
        stored.release_origin === "expiration" &&
        stored.release_response?.release_reason ===
          "reservation_expired";
      if (stored.status !== "active" && !expiredButCommitProven) {
        fail(
          "promotion_stale_fence",
          "promotion reservation is no longer active",
        );
      }
      const committedAt = Date.parse(request.committed_at);
      if (
        committedAt < Date.parse(stored.reservation.reserved_at) ||
        committedAt > Date.parse(stored.reservation.expires_at)
      ) {
        fail(
          "promotion_stale_fence",
          "promotion commit did not occur within the reservation window",
        );
      }
      if (stored.status === "active") {
        assertPromotionTargetVersions(state, stored);
      }
      const response = Object.freeze({
        schema_version: "memory.promotion_reservation_ack.v1" as const,
        reservation_id: request.reservation_id,
        candidate_fact_id: request.candidate_fact_id,
        fencing_generation: request.fencing_generation,
        status: "committed" as const,
        promotion_revision_id: request.promotion_revision_id,
        committed_at: request.committed_at,
        duplicate_replayed: false,
      });
      assertOwnerContract(
        () =>
          assertMemoryPromotionReservationAckResponseSemanticBindingsV1(
            response,
          ),
        "promotion reservation ack response owner contract mismatch",
      );
      stored.status = "acked";
      stored.ack_request_hash = requestHash;
      stored.ack_response = response;
      removeActivePromotionTargets(state, stored);
      return response;
    }, scope);
  }

  public async releasePromotionReservation(
    principal: MemoryPrincipalV1,
    requestValue: unknown,
  ): Promise<MemoryPromotionReservationReleaseResponseV1> {
    const request = validateOwnerValue(
      MemoryPromotionReservationReleaseRequestV1Schema,
      requestValue,
      assertMemoryPromotionReservationReleaseRequestSemanticBindingsV1,
      "promotion reservation release request",
    );
    const scope = assertPrincipal(
      principal,
      "knowthat",
      "memory.promotion_reservation.release",
      request.bot_id,
    );
    const requestHash = promotionRequestHashV1(request);
    return this.repository.transact((state) => {
      const stored = state.promotionReservations.get(
        request.reservation_id,
      );
      if (stored === undefined || !sameScope(stored.scope, scope)) {
        fail(
          "promotion_reservation_not_found",
          "promotion reservation was not found",
        );
      }
      assertReservationFence(state, stored, request);
      assertReservationTokenHash(stored, request);
      if (stored.status === "acked") {
        fail(
          "promotion_stale_fence",
          "a committed promotion reservation cannot be released",
        );
      }
      if (stored.release_response !== null) {
        if (
          stored.release_request_hash !== null &&
          stored.release_request_hash !== requestHash
        ) {
          fail(
            "idempotency_conflict",
            "promotion reservation release request drifted",
          );
        }
        return Object.freeze({
          ...structuredClone(stored.release_response),
          duplicate_replayed: true,
        });
      }
      const response = Object.freeze({
        schema_version: "memory.promotion_reservation_release.v1" as const,
        reservation_id: request.reservation_id,
        candidate_fact_id: request.candidate_fact_id,
        fencing_generation: request.fencing_generation,
        status: "released" as const,
        release_reason: request.release_reason,
        released_at: request.released_at,
        duplicate_replayed: false,
      });
      assertOwnerContract(
        () =>
          assertMemoryPromotionReservationReleaseResponseSemanticBindingsV1(
            response,
          ),
        "promotion reservation release response owner contract mismatch",
      );
      stored.status = "released";
      stored.release_origin = "caller";
      stored.release_request_hash = requestHash;
      stored.release_response = response;
      removeActivePromotionTargets(state, stored);
      return response;
    }, scope);
  }

  public async writeBatch(
    principal: MemoryPrincipalV1,
    requestValue: unknown,
    options: Readonly<{ raw_body_bytes: number; now?: Date }>,
  ): Promise<MemoryWriteBatchResponseV1> {
    const validation = validateWriteRequest(
      requestValue,
      options.raw_body_bytes,
    );
    const request = validation.request;
    const scope = assertPrincipal(
      principal,
      "meta_cognition",
      "memory.write",
      request.bot_id,
    );
    const compatibilityRequested =
      request.compatibility_mode === "legacy_subject_order";
    const compatibilityAllowed =
      compatibilityRequested &&
      principal.capabilities.includes(
        "memory.compatibility.legacy_subject_order",
      ) &&
      this.#legacySubjectOrderOwnerAgentIds.has(scope.owner_agent_id);
    if (compatibilityRequested && !compatibilityAllowed) {
      fail("forbidden", "legacy subject order is not authorized");
    }
    if (validation.valid_items.length > this.#maxEmbeddingItems) {
      fail("batch_too_large", "batch exceeds synchronous execution budget");
    }
    const requestHash = validation.request_hash;
    const identity = batchIdentity(scope, request.idempotency_key);
    const requestNow = snapshotMemoryNowV1(
      options.now ?? new Date(),
      "write batch now",
    );
    const prepared = validation.valid_items.map(
      ({ item, original_index: originalIndex }) => {
      const topic = memoryTopicIdentityV1(
        request.bot_id,
        item,
        compatibilityAllowed,
      );
      return {
        item,
        originalIndex,
        topic,
        contentHash: pointContentHash(item),
      };
      },
    );
    const sorted = [...prepared].sort(
      (left, right) =>
        compareMemoryIdentityV1(
          left.topic.identity.topic_family_key,
          right.topic.identity.topic_family_key,
        ) ||
        Date.parse(left.item.occurred_at) -
          Date.parse(right.item.occurred_at) ||
        compareMemoryIdentityV1(
          left.item.client_item_id,
          right.item.client_item_id,
        ),
    );
    const existingFlight = this.#writeBatchInFlight.get(identity);
    if (existingFlight !== undefined) {
      if (existingFlight.request_hash !== requestHash) {
        fail(
          "idempotency_conflict",
          "idempotency key was reused with a different in-flight request",
        );
      }
      return cloneBatchResponse(await existingFlight.promise, true);
    }
    const reservationId = `mwr_${sha256Base64Url(
      memoryCanonicalJsonV1([identity, requestHash]),
    ).slice(0, 32)}`;
    const operation = (async (): Promise<MemoryWriteBatchResponseV1> => {
      try {
        const reservation = await this.repository.transact((state) => {
          const existing = state.batches.get(identity);
          if (existing !== undefined) {
            if (existing.request_hash !== requestHash) {
              fail(
                "idempotency_conflict",
                "idempotency key was reused with a different request",
              );
            }
            return {
              outcome: "replayed" as const,
              response: cloneBatchResponse(existing.response, true),
            };
          }
          const active = state.batchReservations.get(identity);
          if (
            active !== undefined &&
            active.request_hash !== requestHash
          ) {
            fail(
              "idempotency_conflict",
              "idempotency key is reserved by a different request",
            );
          }
          const reserved: StoredBatchReservationV1 = {
            reservation_id: reservationId,
            request_hash: requestHash,
            expected_query_revision: state.queryRevision,
            created_at: requestNow.toISOString(),
          };
          state.batchReservations.set(identity, reserved);
          return { outcome: "reserved" as const, reservation: reserved };
        }, scope);
        if (reservation.outcome === "replayed") {
          return reservation.response;
        }
        let embedded: readonly (readonly number[])[];
        if (sorted.length === 0) {
          embedded = Object.freeze([]);
        } else {
          try {
            embedded = snapshotMemoryDependencyResultV1(
              await this.embedding.embed(
                sorted.map(({ item }) =>
                  normalizedEmbeddingInput(item.content_summary),
                ),
                MEMORY_EMBEDDING_PROFILE_V1,
              ),
              "Memory embedding dependency",
            );
          } catch (error) {
            if (error instanceof MemoryApplicationErrorV1) throw error;
            throw new MemoryApplicationErrorV1(
              "dependency_unavailable",
              "embedding dependency is unavailable",
              true,
            );
          }
          if (embedded.length !== sorted.length) {
            fail(
              "dependency_unavailable",
              "embedding response cardinality mismatch",
              undefined,
              true,
            );
          }
        }

        return await this.repository.transact((state) => {
          const existing = state.batches.get(identity);
          if (existing !== undefined) {
            if (existing.request_hash !== requestHash) {
              fail(
                "idempotency_conflict",
                "idempotency key was reused with a different request",
              );
            }
            state.batchReservations.delete(identity);
            return cloneBatchResponse(existing.response, true);
          }
          const active = state.batchReservations.get(identity);
          if (
            active === undefined ||
            active.reservation_id !== reservationId ||
            active.request_hash !== requestHash ||
            active.expected_query_revision !== state.queryRevision
          ) {
            fail(
              "lease_conflict",
              "memory write reservation lost its query revision fence",
              undefined,
              true,
              {
                expected_query_revision:
                  reservation.reservation.expected_query_revision,
                actual_query_revision: state.queryRevision,
              },
            );
          }

          const now = requestNow;
          const batchId = writeBatchId(scope, request.idempotency_key);
          const resultByIndex = new Map<
            number,
            MemoryWriteSucceededV1 | MemoryWriteRejectedV1
          >();
          const warnings: MemoryWriteWarningV1[] = [];
          const allConflictIds = new Set<string>();
          for (const rejected of validation.rejected_items) {
            resultByIndex.set(rejected.original_index, rejected.result);
            const decisionKey = memoryCanonicalJsonV1([
              batchId,
              rejected.result.client_item_id,
            ]);
            if (state.decisions.has(decisionKey)) {
              throw new Error(
                "new batch unexpectedly contains an existing rejected item decision",
              );
            }
            const rejectedDecision: MemoryRejectedItemDecisionV1 =
              Object.freeze({
                id: `mid_${sha256Base64Url(
                  `${batchId}\u001f${rejected.result.client_item_id}`,
                ).slice(0, 32)}`,
                scope,
                batch_id: batchId,
                client_item_id: rejected.result.client_item_id,
                source_item_id: rejected.source_item_id,
                source_trigger_process_id: request.trigger_process_id,
                content_hash: rejected.content_hash,
                decision: "rejected",
                rejection_code: rejected.result.code,
                rejection_message: rejected.result.message,
                field_path: rejected.result.field_path ?? null,
                created_at: requestNow.toISOString(),
              });
            state.decisions.set(decisionKey, rejectedDecision);
          }
          for (const [sortedIndex, entry] of sorted.entries()) {
            const vector = normalizeMemoryEmbeddingV1(embedded[sortedIndex]!);
            const topicIndexKey = `${scopeKey(scope)}\u001f${entry.topic.identity.topic_key}`;
        const sourceIndexKey =
          entry.item.source_item_id === undefined
            ? undefined
            : memoryCanonicalJsonV1([
                scopeKey(scope),
                entry.item.source_item_id,
              ]);
        const indexedSourceDecision =
          sourceIndexKey === undefined
            ? undefined
            : state.decisions.get(
                state.decisionKeyBySourceItem.get(sourceIndexKey) ?? "",
              );
        if (indexedSourceDecision?.decision === "rejected") {
          throw new Error(
            "Memory source item index points to a rejected decision",
          );
        }
        const priorSourceDecision = indexedSourceDecision;
        let series =
          priorSourceDecision === undefined
            ? state.seriesIdByTopic.get(topicIndexKey) === undefined
              ? undefined
              : state.series.get(state.seriesIdByTopic.get(topicIndexKey)!)
            : state.series.get(priorSourceDecision.target_series_id);
        const existingDecision = state.decisions.get(
          memoryCanonicalJsonV1([
            batchId,
            entry.item.client_item_id,
          ]),
        );
        if (existingDecision !== undefined) {
          throw new Error("new batch unexpectedly contains an existing item decision");
        }
        const currentPoint =
          priorSourceDecision?.target_memory_point_id === null
            ? undefined
            : priorSourceDecision?.target_memory_point_id !== undefined
              ? state.points.get(priorSourceDecision.target_memory_point_id)
              : series === undefined
                ? undefined
                : [...state.points.values()].find(
                    (point) =>
                      point.series_id === series?.id &&
                      point.status === "active",
                  );
        if (
          priorSourceDecision !== undefined &&
          priorSourceDecision.content_hash !== entry.contentHash
        ) {
          fail(
            "idempotency_conflict",
            "source_item_id was reused with different content",
          );
        }
        const sameInstantHardConflict =
          priorSourceDecision === undefined &&
          currentPoint !== undefined &&
          currentPoint.content_hash !== entry.contentHash &&
          currentPoint.occurred_at === entry.item.occurred_at;
        const decision: MemoryWriteSucceededV1["decision"] =
          priorSourceDecision !== undefined
            ? "merge_existing"
            : series === undefined
            ? "new_series"
            : currentPoint?.content_hash === entry.contentHash
              ? "merge_existing"
              : sameInstantHardConflict
                ? "conflict_review"
              : "append_version";
        const mutationTargetKeys: string[] = [];
        if (series !== undefined) {
          mutationTargetKeys.push(
            promotionTargetKey("memory_series", series.id),
          );
        }
        if (currentPoint !== undefined) {
          mutationTargetKeys.push(
            promotionTargetKey("memory_point", currentPoint.id),
          );
          for (const conflict of state.conflicts.values()) {
            if (
              sameScope(conflict.scope, scope) &&
              (conflict.left_memory_point_id === currentPoint.id ||
                conflict.right_memory_point_id === currentPoint.id)
            ) {
              mutationTargetKeys.push(
                promotionTargetKey("memory_conflict", conflict.id),
              );
            }
          }
        }
        assertPromotionTargetsAvailable(
          state,
          mutationTargetKeys,
          now,
        );
        const timestamp = now.toISOString();
        let seriesEvent:
          | "memory.series.created"
          | "memory.series.updated"
          | undefined;
        let seriesPreviousStatus: MemorySeriesStatusV1 | undefined =
          series?.status;
        let eventSeries: MutableMemorySeriesV1 | undefined = series;
        let decisionSeries: MutableMemorySeriesV1 | undefined;
        let seriesReasonCode = "series_created";
        const seriesChangedPointIds: string[] = [];
        let updatedPriorPoint:
          | Readonly<{
              point: MutableMemoryPointV1;
              previous_status: MemoryPointStatusV1;
              revision_id: string;
            }>
          | undefined;
        let conflictRightPoint: MutableMemoryPointV1 | undefined;
        let conflictCreated = false;
        if (series === undefined) {
          const seriesId = `ms_${sha256Base64Url(
            `${scopeKey(scope)}\u001f${entry.topic.identity.topic_key}`,
          ).slice(0, 32)}`;
          series = {
            id: seriesId,
            scope,
            topic_key: entry.topic.identity.topic_key,
            topic_family_key: entry.topic.identity.topic_family_key,
            subject_key: entry.topic.identity.subject_key,
            aspect_key: entry.topic.identity.aspect_key,
            scope_key: entry.topic.identity.scope_key,
            status: "active",
            state_version: 1,
            current_version: 0,
            canonicalization_version: "memory.topic_key.v1",
            topic_components_raw: entry.topic.identity.raw_components,
            topic_components_normalized:
              entry.topic.identity.normalized_components,
            importance_score: Math.max(
              0,
              Math.min(1, entry.item.confidence_score),
            ),
            last_mentioned_at: entry.item.occurred_at,
            created_at: timestamp,
            updated_at: timestamp,
          };
          state.series.set(series.id, series);
          state.seriesIdByTopic.set(topicIndexKey, series.id);
          seriesEvent = "memory.series.created";
          seriesPreviousStatus = undefined;
          eventSeries = series;
        }

        let targetPoint = currentPoint;
        if (decision === "merge_existing") {
          if (
            Date.parse(entry.item.occurred_at) >
            Date.parse(series.last_mentioned_at)
          ) {
            series.last_mentioned_at = entry.item.occurred_at;
            series.updated_at = timestamp;
            series.state_version = nextMemoryCounterV1(
              series.state_version,
              "series state version",
            );
            seriesEvent = "memory.series.updated";
            seriesReasonCode = "last_mentioned_advanced";
            if (targetPoint !== undefined) {
              const projection = state.projections.get(targetPoint.id);
              if (projection !== undefined) {
                projection.last_mentioned_at = series.last_mentioned_at;
                projection.series_state_version = series.state_version;
                projection.updated_at = timestamp;
              }
            }
          }
        } else if (decision !== "conflict_review") {
          if (currentPoint !== undefined) {
            const previousStatus = currentPoint.status;
            currentPoint.status = "superseded";
            currentPoint.state_version = nextMemoryCounterV1(
              currentPoint.state_version,
              "memory point state version",
            );
            const revisionId = `mrv_${sha256Base64Url(
              `${currentPoint.id}:v${currentPoint.state_version}`,
            ).slice(0, 32)}`;
            state.revisions.set(
              revisionId,
              Object.freeze({
                id: revisionId,
                aggregate_type: "memory_point",
                aggregate_id: currentPoint.id,
                previous_state_version: currentPoint.state_version - 1,
                state_version: currentPoint.state_version,
                previous_status: previousStatus,
                status: currentPoint.status,
                reason_code: "superseded_by_new_version",
                created_at: timestamp,
              }),
            );
            updatedPriorPoint = Object.freeze({
              point: currentPoint,
              previous_status: previousStatus,
              revision_id: revisionId,
            });
            seriesChangedPointIds.push(currentPoint.id);
            const oldProjection = state.projections.get(currentPoint.id);
            if (oldProjection !== undefined) {
              oldProjection.status = "superseded";
              oldProjection.state_version = currentPoint.state_version;
              oldProjection.updated_at = timestamp;
            }
          }
          series.current_version = nextMemoryCounterV1(
            series.current_version,
            "series current version",
          );
          if (decision === "append_version") {
            series.state_version = nextMemoryCounterV1(
              series.state_version,
              "series state version",
            );
            seriesEvent = "memory.series.updated";
            seriesReasonCode = "append_version";
          }
          series.last_mentioned_at =
            Date.parse(entry.item.occurred_at) >
            Date.parse(series.last_mentioned_at)
              ? entry.item.occurred_at
              : series.last_mentioned_at;
          series.updated_at = timestamp;
          const pointId = `mp_${sha256Base64Url(
            `${batchId}\u001f${entry.item.client_item_id}`,
          ).slice(0, 32)}`;
          const keywordTags = dedupeNormalizedStrings(
            entry.item.keyword_tags,
            "keyword_tags",
          );
          const point: MutableMemoryPointV1 = {
            id: pointId,
            scope,
            series_id: series.id,
            version_no: series.current_version,
            content_summary: entry.item.content_summary,
            human_agent_relation: Object.freeze(
              structuredClone(entry.item.human_agent_relation),
            ),
            keyword_tags: keywordTags,
            scene_tags: Object.freeze([...new Set(entry.item.scene_tags)].sort()),
            emotion_tags: Object.freeze(
              [...new Set(entry.item.emotion_tags)].sort(),
            ),
            source_info: Object.freeze(structuredClone(entry.item.source_info)),
            source_trigger_process_id: request.trigger_process_id,
            content_hash: entry.contentHash,
            series_decision: decision,
            confidence_score: entry.item.confidence_score,
            occurred_at: entry.item.occurred_at,
            evidence_valid_until: entry.item.evidence_valid_until ?? null,
            status: "active",
            state_version: 1,
            embedding_profile_id: MEMORY_EMBEDDING_PROFILE_V1.profile_id,
            summary_embedding: vector,
            created_at: timestamp,
          };
          state.points.set(point.id, point);
          targetPoint = point;
          seriesChangedPointIds.push(point.id);
          const projection: MutableMemoryProjectionV1 = {
            memory_point_id: point.id,
            scope,
            series_id: series.id,
            topic_family_key: series.topic_family_key,
            topic_key: series.topic_key,
            status: point.status,
            state_version: point.state_version,
            series_state_version: series.state_version,
            ranking_profile_version: MEMORY_RANKING_PROFILE_V1,
            content_summary: point.content_summary,
            keyword_tags: point.keyword_tags,
            scene_tags: point.scene_tags,
            emotion_tags: point.emotion_tags,
            occurred_at: point.occurred_at,
            evidence_valid_until: point.evidence_valid_until,
            importance_score: series.importance_score,
            last_mentioned_at: series.last_mentioned_at,
            embedding_profile_id: MEMORY_EMBEDDING_PROFILE_V1.profile_id,
            summary_embedding: vector,
            updated_at: timestamp,
          };
          state.projections.set(point.id, projection);
        }
        if (targetPoint === undefined) {
          throw new Error(
            "merge_existing/conflict_review requires a target point",
          );
        }
        const itemConflictIds =
          decision === "conflict_review"
            ? [
                `mcf_${sha256Base64Url(
                  memoryCanonicalJsonV1([
                    scopeKey(scope),
                    entry.topic.identity.topic_key,
                    currentPoint?.id,
                    entry.item.occurred_at,
                    entry.contentHash,
                  ]),
                ).slice(0, 32)}`,
              ]
            : [];
        itemConflictIds.forEach((id) => allConflictIds.add(id));
        if (decision === "conflict_review") {
          const conflictId = itemConflictIds[0];
          if (conflictId === undefined) {
            throw new Error("source identity conflict is incomplete");
          }
          if (!state.conflicts.has(conflictId)) {
            const pendingSeriesId = `ms_${sha256Base64Url(
              `${conflictId}:pending_series`,
            ).slice(0, 32)}`;
            const pendingSeries: MutableMemorySeriesV1 = {
              id: pendingSeriesId,
              scope,
              topic_key: series.topic_key,
              topic_family_key: series.topic_family_key,
              subject_key: series.subject_key,
              aspect_key: series.aspect_key,
              scope_key: series.scope_key,
              status: "pending_conflict",
              state_version: 1,
              current_version: 1,
              canonicalization_version: series.canonicalization_version,
              topic_components_raw: series.topic_components_raw,
              topic_components_normalized:
                series.topic_components_normalized,
              importance_score: Math.max(
                0,
                Math.min(1, entry.item.confidence_score),
              ),
              last_mentioned_at: entry.item.occurred_at,
              created_at: timestamp,
              updated_at: timestamp,
            };
            state.series.set(pendingSeries.id, pendingSeries);
            decisionSeries = pendingSeries;
            eventSeries = pendingSeries;
            seriesPreviousStatus = undefined;
            seriesEvent = "memory.series.created";
            seriesReasonCode = "conflict_series_created";
            const rightPointId = `mp_${sha256Base64Url(
              `${batchId}\u001f${entry.item.client_item_id}:conflict`,
            ).slice(0, 32)}`;
            conflictRightPoint = {
              id: rightPointId,
              scope,
              series_id: pendingSeries.id,
              version_no: pendingSeries.current_version,
              content_summary: entry.item.content_summary,
              human_agent_relation: Object.freeze(
                structuredClone(entry.item.human_agent_relation),
              ),
              keyword_tags: dedupeNormalizedStrings(
                entry.item.keyword_tags,
                "keyword_tags",
              ),
              scene_tags: Object.freeze(
                [...new Set(entry.item.scene_tags)].sort(),
              ),
              emotion_tags: Object.freeze(
                [...new Set(entry.item.emotion_tags)].sort(),
              ),
              source_info: Object.freeze(structuredClone(entry.item.source_info)),
              source_trigger_process_id: request.trigger_process_id,
              content_hash: entry.contentHash,
              series_decision: decision,
              confidence_score: entry.item.confidence_score,
              occurred_at: entry.item.occurred_at,
              evidence_valid_until: entry.item.evidence_valid_until ?? null,
              status: "pending_conflict",
              state_version: 1,
              embedding_profile_id: MEMORY_EMBEDDING_PROFILE_V1.profile_id,
              summary_embedding: vector,
              created_at: timestamp,
            };
            state.points.set(conflictRightPoint.id, conflictRightPoint);
            state.projections.set(conflictRightPoint.id, {
              memory_point_id: conflictRightPoint.id,
              scope,
              series_id: pendingSeries.id,
              topic_family_key: pendingSeries.topic_family_key,
              topic_key: pendingSeries.topic_key,
              status: conflictRightPoint.status,
              state_version: conflictRightPoint.state_version,
              series_state_version: pendingSeries.state_version,
              ranking_profile_version: MEMORY_RANKING_PROFILE_V1,
              content_summary: conflictRightPoint.content_summary,
              keyword_tags: conflictRightPoint.keyword_tags,
              scene_tags: conflictRightPoint.scene_tags,
              emotion_tags: conflictRightPoint.emotion_tags,
              occurred_at: conflictRightPoint.occurred_at,
              evidence_valid_until: conflictRightPoint.evidence_valid_until,
              importance_score: pendingSeries.importance_score,
              last_mentioned_at: pendingSeries.last_mentioned_at,
              embedding_profile_id: MEMORY_EMBEDDING_PROFILE_V1.profile_id,
              summary_embedding: vector,
              updated_at: timestamp,
            });
            seriesChangedPointIds.push(conflictRightPoint.id);
            const evidenceRefs = [
              `memory_point:${targetPoint.id}`,
              `memory_point:${conflictRightPoint.id}`,
              `trigger_process:${request.trigger_process_id}`,
            ] as const;
            state.conflicts.set(
              conflictId,
              Object.freeze({
                id: conflictId,
                scope,
                old_series_id: series.id,
                new_series_id: pendingSeries.id,
                conflict_type: "source_item_identity_drift",
                source_item_id:
                  entry.item.source_item_id ??
                  `${batchId}:${entry.item.client_item_id}`,
                left_memory_point_id: targetPoint.id,
                right_memory_point_id: conflictRightPoint.id,
                evidence_refs: Object.freeze([...evidenceRefs]),
                incoming_content_hash: entry.contentHash,
                status: "open",
                state_version: 1,
                created_at: timestamp,
              }),
            );
            conflictCreated = true;
          } else {
            const existingConflict = state.conflicts.get(conflictId);
            decisionSeries =
              existingConflict === undefined
                ? undefined
                : state.series.get(existingConflict.new_series_id);
          }
        }
        decisionSeries ??= series;
        const conflictForDecision =
          decision === "conflict_review"
            ? state.conflicts.get(itemConflictIds[0] ?? "")
            : undefined;
        const decisionPoint =
          conflictForDecision === undefined
            ? targetPoint
            : state.points.get(conflictForDecision.right_memory_point_id);
        if (decisionPoint === undefined || eventSeries === undefined) {
          throw new Error("memory decision targets are incomplete");
        }
        const itemDecision: MemoryItemDecisionV1 = Object.freeze({
          id: `mid_${sha256Base64Url(
            `${batchId}\u001f${entry.item.client_item_id}`,
          ).slice(0, 32)}`,
          scope,
          batch_id: batchId,
          client_item_id: entry.item.client_item_id,
          source_item_id: entry.item.source_item_id ?? null,
          source_trigger_process_id: request.trigger_process_id,
          content_hash: entry.contentHash,
          decision,
          target_series_id: decisionSeries.id,
          target_memory_point_id: decisionPoint.id,
          conflict_id: conflictForDecision?.id ?? null,
          candidate_refs:
            currentPoint === undefined ? [] : Object.freeze([currentPoint.id]),
          decision_reason:
            decision === "new_series"
              ? "no_canonical_topic_candidate"
              : decision === "merge_existing"
                ? "same_topic_same_content_hash"
                : decision === "conflict_review"
                  ? "source_item_id_content_drift"
                  : "same_topic_content_changed",
          created_at: timestamp,
        });
        const decisionKey = memoryCanonicalJsonV1([
          batchId,
          entry.item.client_item_id,
        ]);
        if (priorSourceDecision === undefined) {
          state.decisions.set(decisionKey, itemDecision);
        }
        if (
          sourceIndexKey !== undefined &&
          priorSourceDecision === undefined
        ) {
          state.decisionKeyBySourceItem.set(sourceIndexKey, decisionKey);
        }
        if (entry.topic.warning) {
          const auditRef = `audit_${sha256Base64Url(
            `${batchId}:${entry.item.client_item_id}:legacy`,
          ).slice(0, 24)}`;
          warnings.push({
            code: "legacy_primary_fallback",
            field_path: `/items/${entry.originalIndex}/subject_refs/0`,
            compatibility_mode: "legacy_subject_order",
            audit_ref: auditRef,
            client_item_id: entry.item.client_item_id,
          });
          state.audit.push(
            Object.freeze({
              id: auditRef,
              type: "compatibility_mode_used",
              batch_id: batchId,
              client_item_id: entry.item.client_item_id,
              scope,
            }),
          );
        }
        state.audit.push(
          Object.freeze({
            type: "memory_write_item_decided",
            batch_id: batchId,
            decision_id: itemDecision.id,
            series_id: decisionSeries.id,
            point_id: decisionPoint.id,
            scope,
          }),
        );
        const traceId =
          entry.item.source_info.trace_id ?? request.source_meta_job_id;
        if (seriesEvent === "memory.series.created") {
          const idempotencyKey = `series:${eventSeries.id}:v${eventSeries.state_version}`;
          appendMemoryEventV1(state, {
            event_id: memoryEventIdV1(idempotencyKey),
            schema_version: "memory.event.v1",
            producer: "memory",
            occurred_at: timestamp,
            idempotency_key: idempotencyKey,
            trace_id: traceId,
            event_type: "memory.series.created",
            payload: {
              ...memoryEventScopeV1(scope),
              aggregate_id: eventSeries.id,
              aggregate_version: eventSeries.state_version,
              aggregate_type: "memory_series",
              series_id: eventSeries.id,
              topic_key: eventSeries.topic_key,
              topic_family_key: eventSeries.topic_family_key,
              status:
                eventSeries.status === "pending_conflict"
                  ? "pending_conflict"
                  : "active",
              state_version: eventSeries.state_version,
            },
          });
        } else if (seriesEvent === "memory.series.updated") {
          if (seriesPreviousStatus === undefined) {
            throw new Error("series update requires a previous status");
          }
          const idempotencyKey = `series:${eventSeries.id}:v${eventSeries.state_version}`;
          appendMemoryEventV1(state, {
            event_id: memoryEventIdV1(idempotencyKey),
            schema_version: "memory.event.v1",
            producer: "memory",
            occurred_at: timestamp,
            idempotency_key: idempotencyKey,
            trace_id: traceId,
            event_type: "memory.series.updated",
            payload: {
              ...memoryEventScopeV1(scope),
              aggregate_id: eventSeries.id,
              aggregate_version: eventSeries.state_version,
              aggregate_type: "memory_series",
              series_id: eventSeries.id,
              previous_status: seriesPreviousStatus,
              status: eventSeries.status,
              state_version: eventSeries.state_version,
              reason_code: seriesReasonCode,
              changed_point_ids: [...new Set(seriesChangedPointIds)].sort(),
            },
          });
        }
        if (updatedPriorPoint !== undefined) {
          const idempotencyKey = `point:${updatedPriorPoint.point.id}:v${updatedPriorPoint.point.state_version}`;
          appendMemoryEventV1(state, {
            event_id: memoryEventIdV1(idempotencyKey),
            schema_version: "memory.event.v1",
            producer: "memory",
            occurred_at: timestamp,
            idempotency_key: idempotencyKey,
            trace_id: traceId,
            event_type: "memory.point.updated",
            payload: {
              ...memoryEventScopeV1(scope),
              aggregate_id: updatedPriorPoint.point.id,
              aggregate_version: updatedPriorPoint.point.state_version,
              aggregate_type: "memory_point",
              memory_point_id: updatedPriorPoint.point.id,
              previous_status: updatedPriorPoint.previous_status,
              status: updatedPriorPoint.point.status,
              state_version: updatedPriorPoint.point.state_version,
              reason_code: "superseded_by_new_version",
              revision_refs: [
                {
                  aggregate_type: "memory_point",
                  aggregate_id: updatedPriorPoint.point.id,
                  revision_id: updatedPriorPoint.revision_id,
                },
              ],
            },
          });
        }
        if (
          decision !== "merge_existing" &&
          decision !== "conflict_review"
        ) {
          const idempotencyKey = `point:${targetPoint.id}:v${targetPoint.state_version}`;
          appendMemoryEventV1(state, {
            event_id: memoryEventIdV1(idempotencyKey),
            schema_version: "memory.event.v1",
            producer: "memory",
            occurred_at: timestamp,
            idempotency_key: idempotencyKey,
            trace_id: traceId,
            event_type: "memory.point.created",
            payload: {
              ...memoryEventScopeV1(scope),
              aggregate_id: targetPoint.id,
              aggregate_version: targetPoint.state_version,
              aggregate_type: "memory_point",
              memory_point_id: targetPoint.id,
              series_id: targetPoint.series_id,
              topic_key: eventSeries.topic_key,
              state_version: targetPoint.state_version,
              source_trigger_process_id:
                targetPoint.source_trigger_process_id,
              write_batch_id: batchId,
              redaction_status: "not_required",
            },
          });
        }
        if (decision === "conflict_review" && conflictCreated) {
          const conflictId = itemConflictIds[0];
          const conflict =
            conflictId === undefined
              ? undefined
              : state.conflicts.get(conflictId);
          if (conflict === undefined || conflictRightPoint === undefined) {
            throw new Error("conflict event requires both persisted points");
          }
          const pointKey = `point:${conflictRightPoint.id}:v${conflictRightPoint.state_version}`;
          appendMemoryEventV1(state, {
            event_id: memoryEventIdV1(pointKey),
            schema_version: "memory.event.v1",
            producer: "memory",
            occurred_at: timestamp,
            idempotency_key: pointKey,
            trace_id: traceId,
            event_type: "memory.point.created",
            payload: {
              ...memoryEventScopeV1(scope),
              aggregate_id: conflictRightPoint.id,
              aggregate_version: conflictRightPoint.state_version,
              aggregate_type: "memory_point",
              memory_point_id: conflictRightPoint.id,
              series_id: conflictRightPoint.series_id,
              topic_key: eventSeries.topic_key,
              state_version: conflictRightPoint.state_version,
              source_trigger_process_id:
                conflictRightPoint.source_trigger_process_id,
              write_batch_id: batchId,
              redaction_status: "not_required",
            },
          });
          const conflictKey = `conflict:${conflict.id}:v${conflict.state_version}`;
          appendMemoryEventV1(state, {
            event_id: memoryEventIdV1(conflictKey),
            schema_version: "memory.event.v1",
            producer: "memory",
            occurred_at: timestamp,
            idempotency_key: conflictKey,
            trace_id: traceId,
            event_type: "memory.conflict.detected",
            payload: {
              ...memoryEventScopeV1(scope),
              aggregate_id: conflict.id,
              aggregate_version: conflict.state_version,
              aggregate_type: "memory_conflict",
              conflict_id: conflict.id,
              conflict_version: conflict.state_version,
              conflict_type: conflict.conflict_type,
              left_memory_point_id: conflict.left_memory_point_id,
              right_memory_point_id: conflict.right_memory_point_id,
              evidence_refs: [...conflict.evidence_refs],
            },
          });
        }
        resultByIndex.set(entry.originalIndex, {
          client_item_id: entry.item.client_item_id,
          status: "succeeded",
          decision,
          ...(decision === "conflict_review"
            ? {}
            : { memory_point_id: targetPoint.id }),
          series_id: decisionSeries.id,
          topic_key: decisionSeries.topic_key,
          ...(decision === "conflict_review"
            ? {}
            : { version_no: targetPoint.version_no }),
          conflict_ids: itemConflictIds,
        });
      }
      state.queryRevision = nextMemoryCounterV1(
        state.queryRevision,
        "query revision",
      );
      const itemResults = Array.from(
        { length: validation.original_item_count },
        (_item, index) => {
        const result = resultByIndex.get(index);
        if (result === undefined) throw new Error("item result is missing");
        return Object.freeze(result);
        },
      );
      const rejectedResults = itemResults.filter(
        (result): result is MemoryWriteRejectedV1 =>
          result.status === "rejected",
      );
      const response: MemoryWriteBatchResponseV1 = {
        schema_version: "memory.write_batch.v1",
        write_batch_id: batchId,
        batch_status:
          rejectedResults.length === 0 ? "completed" : "partial_failed",
        item_results: [...itemResults],
        accepted_point_ids: [
          ...new Set(
            itemResults.flatMap((result) =>
              result.status === "rejected" ||
              result.memory_point_id === undefined
                ? []
                : [result.memory_point_id],
            ),
          ),
        ],
        rejected_items: [...rejectedResults],
        conflict_ids: [...allConflictIds].sort(),
        warnings: [...warnings],
        duplicate_replayed: false,
      };
      assertOwnerContract(
        () => assertMemoryWriteBatchResponseSemanticBindingsV1(response),
        "memory write batch response owner contract mismatch",
      );
      if (!Value.Check(MemoryWriteBatchResponseV1Schema, response)) {
        throw new Error("memory write response violates the owner schema");
      }
      state.batches.set(identity, {
        request_hash: requestHash,
        response: structuredClone(response),
      });
      state.batchReservations.delete(identity);
      return Object.freeze(structuredClone(response));
        }, scope);
      } catch (error) {
        await this.repository.transact((state) => {
          const active = state.batchReservations.get(identity);
          if (active?.reservation_id === reservationId) {
            state.batchReservations.delete(identity);
          }
        }, scope);
        throw error;
      }
    })();
    this.#writeBatchInFlight.set(identity, {
      request_hash: requestHash,
      promise: operation,
    });
    try {
      return await operation;
    } finally {
      if (
        this.#writeBatchInFlight.get(identity)?.promise === operation
      ) {
        this.#writeBatchInFlight.delete(identity);
      }
    }
  }

  public async fastRecall(
    principal: MemoryPrincipalV1,
    requestValue: unknown,
    now?: Date,
  ): Promise<MemoryFastRecallResponseV1> {
    const request = this.validateRecallRequest(requestValue);
    const scope = assertPrincipal(
      principal,
      "trigger_processor",
      "memory.read",
      request.bot_id,
    );
    const queryHash = `sha256:${sha256Hex(
      memoryCanonicalJsonV1({
        schema_version: request.schema_version,
        bot_id: request.bot_id,
        query: normalizedEmbeddingInput(request.query),
        query_purpose: request.query_purpose,
        topic_family_key: request.topic_family_key ?? null,
        subject_key: request.subject_key ?? null,
        priority_dimensions: request.priority_dimensions ?? [],
        include_downgraded: request.include_downgraded ?? true,
        limit: request.limit ?? 8,
      }),
    )}`;
    const limit = request.limit ?? 8;
    const explicitNow =
      now === undefined
        ? undefined
        : snapshotMemoryNowV1(now, "fast recall now");
    const requestedAt = explicitNow ?? new Date();
    let expectedQueryRevision: number | undefined;
    let preparedQueryEmbedding: readonly number[] | undefined;
    if (request.snapshot_token === undefined) {
      expectedQueryRevision = await this.repository.transact((state) => {
        pruneRecallSnapshotsV1(state, scope, requestedAt, true);
        return state.queryRevision;
      }, scope);
      try {
        const vectors = snapshotMemoryDependencyResultV1(
          await this.embedding.embed(
            [normalizedEmbeddingInput(request.query)],
            MEMORY_EMBEDDING_PROFILE_V1,
          ),
          "Memory embedding dependency",
        );
        if (vectors.length !== 1) {
          fail(
            "dependency_unavailable",
            "query embedding cardinality mismatch",
            undefined,
            true,
          );
        }
        preparedQueryEmbedding = normalizeMemoryEmbeddingV1(vectors[0]!);
      } catch (error) {
        if (error instanceof MemoryApplicationErrorV1) throw error;
        throw new MemoryApplicationErrorV1(
          "dependency_unavailable",
          "embedding dependency is unavailable",
          true,
        );
      }
    }
    const commitAt =
      explicitNow ??
      snapshotMemoryNowV1(new Date(), "fast recall commit now");
    return this.repository.transact((state) => {
      pruneRecallSnapshotsV1(
        state,
        scope,
        commitAt,
        request.snapshot_token === undefined,
      );
      let snapshot: RecallSnapshotV1;
      let offset = 0;
      if (request.snapshot_token !== undefined) {
        const existing = state.recallSnapshots.get(request.snapshot_token);
        if (
          existing === undefined ||
          !sameScope(existing.scope, scope) ||
          existing.query_hash !== queryHash ||
          Date.parse(existing.expires_at) <= commitAt.getTime()
        ) {
          fail("snapshot_expired", "recall snapshot is expired or mismatched");
        }
        const cursorEntry = [...existing.cursor_by_offset.entries()].find(
          ([, cursor]) => cursor === request.cursor,
        );
        if (cursorEntry === undefined) {
          fail("invalid_request", "cursor is invalid");
        }
        offset = cursorEntry[0];
        snapshot = existing;
      } else {
        if (
          expectedQueryRevision === undefined ||
          preparedQueryEmbedding === undefined ||
          state.queryRevision !== expectedQueryRevision
        ) {
          fail(
            "lease_conflict",
            "memory recall snapshot lost its query revision fence",
            undefined,
            true,
            {
              expected_query_revision: expectedQueryRevision ?? null,
              actual_query_revision: state.queryRevision,
            },
          );
        }
        const queryEmbedding = preparedQueryEmbedding;
        const hardFiltered = [...state.projections.values()].filter(
          (projection) =>
            sameScope(projection.scope, scope) &&
            (projection.status === "active" ||
              projection.status === "downgraded") &&
            (projection.evidence_valid_until === null ||
              Date.parse(projection.evidence_valid_until) >
                commitAt.getTime()) &&
            (request.topic_family_key === undefined ||
              projection.topic_family_key === request.topic_family_key) &&
            (request.subject_key === undefined ||
              state.series.get(projection.series_id)?.subject_key ===
                request.subject_key),
        );
        const active = hardFiltered.filter(
          (projection) => projection.status === "active",
        );
        const candidates =
          active.length >= limit || request.include_downgraded === false
            ? active
            : [
                ...active,
                ...hardFiltered.filter(
                  (projection) => projection.status === "downgraded",
                ),
              ];
        const tokens = queryTokens(request.query);
        const rawKeywordById = new Map<string, number>();
        for (const projection of candidates) {
          const searchable = unicodeCaseFold(
            `${projection.content_summary} ${projection.keyword_tags.join(" ")}`,
          );
          rawKeywordById.set(
            projection.memory_point_id,
            tokens.filter((token) => searchable.includes(token)).length,
          );
        }
        const keywordValues = [...rawKeywordById.values()];
        const maxKeyword =
          keywordValues.length === 0 ? 0 : Math.max(...keywordValues);
        const minKeyword =
          keywordValues.length === 0 ? 0 : Math.min(...keywordValues);
        const scoreById = new Map<
          string,
          MemoryFastRecallItemV1["score_breakdown"]
        >();
        for (const projection of candidates) {
          const vector = Math.max(
            0,
            Math.min(
              1,
              (cosine(queryEmbedding, projection.summary_embedding) + 1) / 2,
            ),
          );
          const rawKeyword =
            rawKeywordById.get(projection.memory_point_id) ?? 0;
          const keyword =
            maxKeyword === 0
              ? 0
              : maxKeyword === minKeyword
                ? 1
                : (rawKeyword - minKeyword) / (maxKeyword - minKeyword);
          const ageDays = Math.max(
            0,
            (commitAt.getTime() -
              Math.max(
                Date.parse(projection.occurred_at),
                Date.parse(projection.last_mentioned_at),
              )) /
              86_400_000,
          );
          const recency = 2 ** (-ageDays / 30);
          const querySet = new Set(tokens);
          const sceneMatched = projection.scene_tags.some((tag) =>
            querySet.has(unicodeCaseFold(tag)),
          );
          const emotionMatched = projection.emotion_tags.some((tag) =>
            querySet.has(unicodeCaseFold(tag)),
          );
          const tagBoost =
            (sceneMatched ? 0.025 : 0) + (emotionMatched ? 0.025 : 0);
          const statusDecay =
            projection.status === "downgraded" ? 0.5 : 1;
          const base =
            0.5 * vector +
            0.2 * keyword +
            0.15 * projection.importance_score +
            0.15 * recency;
          const finalScore =
            Math.max(0, Math.min(1, base + tagBoost)) * statusDecay;
          scoreById.set(
            projection.memory_point_id,
            Object.freeze({
              vector,
              keyword,
              importance: projection.importance_score,
              recency,
              tag_boost: tagBoost,
              status_decay: statusDecay,
              final_score: finalScore,
            }),
          );
        }
        const snapshotItems = candidates
          .map((projection): MemoryFastRecallItemV1 => {
            const score = scoreById.get(projection.memory_point_id);
            if (score === undefined) {
              throw new Error("recall score is missing");
            }
            return Object.freeze({
              memory_point_id: projection.memory_point_id,
              series_id: projection.series_id,
              topic_family_key: projection.topic_family_key,
              topic_key: projection.topic_key,
              content_summary: projection.content_summary,
              occurred_at: projection.occurred_at,
              status:
                projection.status === "active" ? "active" : "downgraded",
              score_breakdown: score,
              redaction_status: "not_required",
            });
          })
          .sort(
            (left, right) =>
            right.score_breakdown.final_score -
                left.score_breakdown.final_score ||
              Date.parse(right.occurred_at) - Date.parse(left.occurred_at) ||
              compareMemoryIdentityV1(
                left.memory_point_id,
                right.memory_point_id,
              ),
          );
        const token = `mrs_${randomUUID()}`;
        snapshot = {
          token,
          scope,
          query_hash: queryHash,
          query_revision: state.queryRevision,
          items: Object.freeze(structuredClone(snapshotItems)),
          cursor_by_offset: new Map(),
          expires_at: new Date(
            commitAt.getTime() + MEMORY_RECALL_SNAPSHOT_TTL_MS_V1,
          ).toISOString(),
        };
        state.recallSnapshots.set(token, snapshot);
      }
      const items = structuredClone(
        snapshot.items.slice(offset, offset + limit),
      );
      const nextOffset = offset + items.length;
      let nextCursor: string | undefined;
      if (nextOffset < snapshot.items.length) {
        nextCursor = snapshot.cursor_by_offset.get(nextOffset);
        if (nextCursor === undefined) {
          nextCursor = `mc_${randomUUID()}`;
          snapshot.cursor_by_offset.set(nextOffset, nextCursor);
        }
      }
      const response: MemoryFastRecallResponseV1 = {
        schema_version: "memory.fast_recall.v1",
        snapshot_token: snapshot.token,
        query_revision: snapshot.query_revision,
        ranking_profile_version: MEMORY_RANKING_PROFILE_V1,
        items,
        ...(nextCursor === undefined ? {} : { next_cursor: nextCursor }),
        is_partial: false,
      };
      assertOwnerContract(
        () => assertMemoryFastRecallResponseSemanticBindingsV1(response),
        "memory fast recall response owner contract mismatch",
      );
      if (!Value.Check(MemoryFastRecallResponseV1Schema, response)) {
        throw new Error("memory fast recall response violates the owner schema");
      }
      return Object.freeze(response);
    }, scope);
  }

  private validateRecallRequest(value: unknown): MemoryFastRecallRequestV1 {
    memoryCanonicalJsonV1(value);
    if (!Value.Check(MemoryFastRecallRequestV1Schema, value)) {
      fail(
        "schema_validation_failed",
        "memory fast recall request violates the owner schema",
      );
    }
    assertObject(value, "request");
    assertExactKeys(
      value,
      ["schema_version", "bot_id", "query", "query_purpose"],
      [
        "topic_family_key",
        "subject_key",
        "priority_dimensions",
        "include_downgraded",
        "limit",
        "snapshot_token",
        "cursor",
      ],
    );
    const request = value as unknown as MemoryFastRecallRequestV1;
    if (
      request.schema_version !== "memory.fast_recall.v1" ||
      typeof request.query !== "string" ||
      request.query.length === 0 ||
      Buffer.byteLength(request.query, "utf8") > 16_384 ||
      ![
        "context_injection",
        "user_search",
        "agent_planning",
      ].includes(request.query_purpose)
    ) {
      fail("invalid_request", "fast recall request is invalid");
    }
    assertIdentifier(request.bot_id, "bot_id");
    for (const key of ["topic_family_key", "subject_key"] as const) {
      if (request[key] !== undefined) {
        assertIdentifier(request[key], key);
      }
    }
    if (
      request.include_downgraded !== undefined &&
      typeof request.include_downgraded !== "boolean"
    ) {
      fail("invalid_request", "include_downgraded must be a boolean");
    }
    const limit = request.limit ?? 8;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) {
      fail("invalid_request", "limit must be between 1 and 50");
    }
    if (
      request.priority_dimensions !== undefined &&
      (!Array.isArray(request.priority_dimensions) ||
        new Set(request.priority_dimensions).size !==
          request.priority_dimensions.length ||
        request.priority_dimensions.some(
          (dimension) => !priorityDimensions.has(dimension),
        ))
    ) {
      fail("invalid_request", "priority_dimensions is invalid");
    }
    if (
      (request.snapshot_token === undefined) !==
        (request.cursor === undefined)
    ) {
      fail("invalid_request", "snapshot_token and cursor must be provided together");
    }
    if (request.snapshot_token !== undefined) {
      assertIdentifier(request.snapshot_token, "snapshot_token");
      assertIdentifier(request.cursor, "cursor");
    }
    const validated: MemoryFastRecallRequestV1 = {
      ...request,
      ...(request.priority_dimensions === undefined
        ? {}
        : { priority_dimensions: [...request.priority_dimensions] }),
    };
    assertOwnerContract(
      () => assertMemoryFastRecallRequestSemanticBindingsV1(validated),
      "memory fast recall owner contract mismatch",
    );
    return validated;
  }

  public async createIntegrationJob(
    principal: MemoryPrincipalV1,
    requestValue: unknown,
    now = new Date(),
  ): Promise<MemoryIntegrationRunResponseV1> {
    const requestNow = snapshotMemoryNowV1(
      now,
      "integration job creation now",
    );
    const request = this.validateIntegrationRequest(requestValue);
    const scope = assertPrincipal(
      principal,
      "memory",
      "memory.integration.run",
      request.bot_id,
    );
    if (
      request.expected_policy_version !==
      MEMORY_INTEGRATION_POLICY_VERSION_V1
    ) {
      fail(
        "invalid_request",
        `expected_policy_version must be ${MEMORY_INTEGRATION_POLICY_VERSION_V1}`,
      );
    }
    if (
      (request.mode === "rekey" || request.mode === "full") &&
      !principal.capabilities.includes("memory.integration.operator")
    ) {
      fail("forbidden", "operator capability is required for rekey/full");
    }
    const hash = `sha256:${sha256Hex(memoryCanonicalJsonV1(request))}`;
    const key = batchIdentity(scope, request.idempotency_key);
    return this.repository.transact((state) => {
      const existingId = state.integrationJobIdByKey.get(key);
      if (existingId !== undefined) {
        const existing = state.integrationJobs.get(existingId);
        if (existing === undefined) throw new Error("integration index is corrupt");
        assertCanonicalMemoryProjectionV1(
          existing,
          "Memory integration job projection",
        );
        if (existing.request_hash !== hash) {
          fail("idempotency_conflict", "integration request body drift");
        }
        return this.integrationResponse(existing, true);
      }
      const id = `mij_${sha256Base64Url(key).slice(0, 32)}`;
      const job: MutableIntegrationJobV1 = {
        id,
        scope,
        mode: request.mode,
        request_scope: Object.freeze(structuredClone(request.scope)),
        dry_run: request.dry_run,
        idempotency_key: request.idempotency_key,
        request_hash: hash,
        expected_policy_version: request.expected_policy_version,
        state_version: 1,
        status: "queued",
        checkpoint_ref: null,
        proposed_changes: [],
        applied_counts: {},
        failure_refs: [],
        error: null,
        created_at: requestNow.toISOString(),
        updated_at: requestNow.toISOString(),
      };
      state.integrationJobs.set(id, job);
      state.integrationJobIdByKey.set(key, id);
      return this.integrationResponse(job, false);
    }, scope);
  }

  public async claimIntegrationJob(
    principalValue: MemoryPrincipalV1,
    inputValue: Readonly<MemoryIntegrationClaimRequestV1>,
  ): Promise<MemoryIntegrationClaimV1> {
    const principal = snapshotMemoryBoundaryV1(principalValue);
    const input = snapshotMemoryBoundaryV1(inputValue);
    if (!Value.Check(MemoryIntegrationClaimRequestV1Schema, input)) {
      fail(
        "schema_validation_failed",
        "integration claim violates the Memory owner schema",
      );
    }
    const scope = assertPrincipal(
      principal,
      "memory",
      "memory.integration.run",
      input.bot_id,
    );
    assertIdentifier(input.integration_job_id, "integration_job_id");
    assertIdentifier(input.owner_id, "owner_id");
    const now =
      input.now === undefined ? new Date() : parseInstant(input.now, "/now");
    return this.repository.transact((state) => {
      const job = state.integrationJobs.get(input.integration_job_id);
      if (job === undefined) {
        fail("integration_job_not_found", "integration job was not found");
      }
      assertCanonicalMemoryProjectionV1(
        job,
        "Memory integration job projection",
      );
      if (!sameScope(job.scope, scope)) {
        fail("integration_job_not_found", "integration job was not found");
      }
      const existing = state.integrationLeases.get(job.id);
      if (existing !== undefined) {
        assertCanonicalMemoryProjectionV1(
          existing,
          "Memory integration lease projection",
        );
      }
      const expired =
        existing !== undefined &&
        Date.parse(existing.lease_expires_at) <= now.getTime();
      if (
        !(
          job.status === "queued" ||
          ((job.status === "leased" || job.status === "running") && expired)
        )
      ) {
        fail("lease_conflict", "integration job is not claimable");
      }
      const generation = nextMemoryCounterV1(
        existing?.lease_generation ?? 0,
        "integration lease generation",
      );
      const lease: MutableIntegrationLeaseV1 = {
        integration_job_id: job.id,
        lease_id: `memory_lease:${job.id}:${generation}`,
        lease_generation: generation,
        owner_id: input.owner_id,
        lease_expires_at: new Date(
          now.getTime() + this.#integrationLeaseSeconds * 1_000,
        ).toISOString(),
        heartbeat_at: now.toISOString(),
      };
      state.integrationLeases.set(job.id, lease);
      job.status = "leased";
      job.state_version = nextMemoryCounterV1(
        job.state_version,
        "integration job state version",
      );
      job.updated_at = now.toISOString();
      const claim = Object.freeze({
        job: snapshotJob(job),
        lease_id: lease.lease_id,
        lease_generation: lease.lease_generation,
        lease_expires_at: lease.lease_expires_at,
      });
      assertCanonicalMemoryProjectionV1(
        claim,
        "Memory integration claim response",
      );
      if (!Value.Check(MemoryIntegrationClaimV1Schema, claim)) {
        throw new Error("integration claim result violates the Memory owner schema");
      }
      return claim;
    }, scope);
  }

  public async checkpointIntegrationJob(
    principalValue: MemoryPrincipalV1,
    inputValue: Readonly<MemoryIntegrationCheckpointRequestV1>,
  ): Promise<MemoryIntegrationJobV1> {
    const principal = snapshotMemoryBoundaryV1(principalValue);
    const input = snapshotMemoryBoundaryV1(inputValue);
    if (!Value.Check(MemoryIntegrationCheckpointRequestV1Schema, input)) {
      fail(
        "schema_validation_failed",
        "integration checkpoint violates the Memory owner schema",
      );
    }
    assertOwnerContract(
      () =>
        assertMemoryIntegrationCheckpointRequestSemanticBindingsV1(input),
      "integration checkpoint owner contract mismatch",
    );
    return this.transitionLeasedJob(principal, input, (job, now) => {
      assertIdentifier(input.checkpoint_ref, "checkpoint_ref");
      job.status = "running";
      job.checkpoint_ref = input.checkpoint_ref;
      if (input.applied_counts !== undefined) {
        for (const [key, value] of Object.entries(input.applied_counts)) {
          if (!Number.isSafeInteger(value) || value < 0) {
            fail("invalid_request", "applied_counts is invalid");
          }
          job.applied_counts[key] = value;
        }
      }
      if (input.proposed_changes !== undefined) {
        job.proposed_changes = [
          ...structuredClone(input.proposed_changes),
        ];
      }
      job.state_version = nextMemoryCounterV1(
        job.state_version,
        "integration job state version",
      );
      job.updated_at = now.toISOString();
    });
  }

  public async finishIntegrationJob(
    principalValue: MemoryPrincipalV1,
    inputValue: Readonly<MemoryIntegrationFinishRequestV1>,
  ): Promise<MemoryIntegrationJobV1> {
    const principal = snapshotMemoryBoundaryV1(principalValue);
    const input = snapshotMemoryBoundaryV1(inputValue);
    if (!Value.Check(MemoryIntegrationFinishRequestV1Schema, input)) {
      fail(
        "schema_validation_failed",
        "integration finish violates the Memory owner schema",
      );
    }
    assertOwnerContract(
      () => assertMemoryIntegrationFinishRequestSemanticBindingsV1(input),
      "integration finish owner contract mismatch",
    );
    const scope = assertPrincipal(
      principal,
      "memory",
      "memory.integration.run",
      input.bot_id,
    );
    assertIdentifier(input.integration_job_id, "integration_job_id");
    assertIdentifier(input.lease_id, "lease_id");
    if (
      !Number.isSafeInteger(input.lease_generation) ||
      input.lease_generation < 1
    ) {
      fail("invalid_request", "lease_generation is invalid");
    }
    const now =
      input.now === undefined ? new Date() : parseInstant(input.now, "/now");
    const failureRefs = [...new Set(input.failure_refs ?? [])].sort();
    const requestHash = `sha256:${sha256Hex(
      memoryCanonicalJsonV1({
        status: input.status,
        failure_refs: failureRefs,
        error: input.error ?? null,
      }),
    )}`;
    return this.repository.transact((state) => {
      const job = state.integrationJobs.get(input.integration_job_id);
      if (job === undefined) {
        fail("integration_job_not_found", "integration job was not found");
      }
      assertCanonicalMemoryProjectionV1(
        job,
        "Memory integration job projection",
      );
      if (!sameScope(job.scope, scope)) {
        fail("integration_job_not_found", "integration job was not found");
      }
      const receipt = state.integrationFinishReceipts.get(job.id);
      if (receipt !== undefined) {
        assertCanonicalMemoryProjectionV1(
          receipt,
          "Memory integration finish receipt projection",
        );
      }
      if (
        receipt?.lease_id === input.lease_id &&
        receipt.lease_generation === input.lease_generation
      ) {
        if (receipt.request_hash !== requestHash) {
          fail(
            "idempotency_conflict",
            "integration finish retry body drift",
          );
        }
        return snapshotJob(job);
      }
      const lease = state.integrationLeases.get(job.id);
      if (lease !== undefined) {
        assertCanonicalMemoryProjectionV1(
          lease,
          "Memory integration lease projection",
        );
      }
      if (
        lease === undefined ||
        lease.lease_id !== input.lease_id ||
        lease.lease_generation !== input.lease_generation ||
        Date.parse(lease.lease_expires_at) <= now.getTime() ||
        (job.status !== "leased" && job.status !== "running")
      ) {
        fail("lease_conflict", "integration lease is stale or expired");
      }
      job.status = input.status;
      job.failure_refs = failureRefs;
      job.error =
        input.status === "failed" ? "memory_integration_failed" : null;
      job.state_version = nextMemoryCounterV1(
        job.state_version,
        "integration job state version",
      );
      job.updated_at = now.toISOString();
      state.integrationLeases.delete(job.id);
      state.integrationFinishReceipts.set(
        job.id,
        Object.freeze({
          lease_id: input.lease_id,
          lease_generation: input.lease_generation,
          request_hash: requestHash,
        }),
      );
      const idempotencyKey = `integration:${job.id}:v${job.state_version}`;
      appendMemoryEventV1(state, {
        event_id: memoryEventIdV1(idempotencyKey),
        schema_version: "memory.event.v1",
        producer: "memory",
        occurred_at: job.updated_at,
        idempotency_key: idempotencyKey,
        trace_id: job.id,
        event_type: "memory.integration.finished",
        payload: {
          ...memoryEventScopeV1(job.scope),
          aggregate_id: job.id,
          aggregate_version: job.state_version,
          aggregate_type: "integration_job",
          integration_job_id: job.id,
          mode: job.mode,
          status: job.status,
          ...(job.checkpoint_ref === null
            ? {}
            : { checkpoint_ref: job.checkpoint_ref }),
          applied_counts: { ...job.applied_counts },
          failure_refs: [...job.failure_refs],
        },
      });
      return snapshotJob(job);
    }, scope);
  }

  private async transitionLeasedJob(
    principal: MemoryPrincipalV1,
    input: Readonly<{
      bot_id: string;
      integration_job_id: string;
      lease_id: string;
      lease_generation: number;
      now?: string;
    }>,
    transition: (
      job: MutableIntegrationJobV1,
      now: Date,
      state: MemoryStateV1,
    ) => void,
  ): Promise<MemoryIntegrationJobV1> {
    const scope = assertPrincipal(
      principal,
      "memory",
      "memory.integration.run",
      input.bot_id,
    );
    assertIdentifier(input.integration_job_id, "integration_job_id");
    assertIdentifier(input.lease_id, "lease_id");
    if (
      !Number.isSafeInteger(input.lease_generation) ||
      input.lease_generation < 1
    ) {
      fail("invalid_request", "lease_generation is invalid");
    }
    const now =
      input.now === undefined ? new Date() : parseInstant(input.now, "/now");
    return this.repository.transact((state) => {
      const job = state.integrationJobs.get(input.integration_job_id);
      const lease = state.integrationLeases.get(input.integration_job_id);
      if (job === undefined) {
        fail("integration_job_not_found", "integration job was not found");
      }
      assertCanonicalMemoryProjectionV1(
        job,
        "Memory integration job projection",
      );
      if (!sameScope(job.scope, scope)) {
        fail("integration_job_not_found", "integration job was not found");
      }
      if (lease !== undefined) {
        assertCanonicalMemoryProjectionV1(
          lease,
          "Memory integration lease projection",
        );
      }
      if (
        lease === undefined ||
        lease.lease_id !== input.lease_id ||
        lease.lease_generation !== input.lease_generation ||
        Date.parse(lease.lease_expires_at) <= now.getTime() ||
        (job.status !== "leased" && job.status !== "running")
      ) {
        fail("lease_conflict", "integration lease is stale or expired");
      }
      transition(job, now, state);
      const retainedLease = state.integrationLeases.get(job.id);
      if (retainedLease !== undefined) {
        assertCanonicalMemoryProjectionV1(
          retainedLease,
          "Memory integration lease projection",
        );
        retainedLease.heartbeat_at = now.toISOString();
        retainedLease.lease_expires_at = new Date(
          now.getTime() + this.#integrationLeaseSeconds * 1_000,
        ).toISOString();
      }
      return snapshotJob(job);
    }, scope);
  }

  public async getIntegrationJob(
    principal: MemoryPrincipalV1,
    botId: string,
    jobId: string,
  ): Promise<MemoryIntegrationJobV1> {
    const scope = assertPrincipal(
      principal,
      "memory",
      "memory.integration.run",
      botId,
    );
    assertIdentifier(jobId, "integration_job_id");
    return this.repository.transact((state) => {
      const job = state.integrationJobs.get(jobId);
      if (job === undefined) {
        fail("integration_job_not_found", "integration job was not found");
      }
      assertCanonicalMemoryProjectionV1(
        job,
        "Memory integration job projection",
      );
      if (!sameScope(job.scope, scope)) {
        fail("integration_job_not_found", "integration job was not found");
      }
      return snapshotJob(job);
    }, scope);
  }

  private validateIntegrationRequest(
    value: unknown,
  ): MemoryIntegrationRunRequestV1 {
    memoryCanonicalJsonV1(value);
    if (!Value.Check(MemoryIntegrationRunRequestV1Schema, value)) {
      fail(
        "schema_validation_failed",
        "integration request violates the Memory owner schema",
      );
    }
    assertObject(value, "request");
    assertExactKeys(value, [
      "schema_version",
      "bot_id",
      "scope",
      "mode",
      "dry_run",
      "idempotency_key",
      "expected_policy_version",
    ]);
    const request = value as unknown as MemoryIntegrationRunRequestV1;
    if (
      request.schema_version !== "memory.integration_run.v1" ||
      ![
        "decay",
        "deduplicate",
        "rekey",
        "rebuild_projection",
        "full",
      ].includes(request.mode) ||
      typeof request.dry_run !== "boolean"
    ) {
      fail("invalid_request", "integration request is invalid");
    }
    assertIdentifier(request.bot_id, "bot_id");
    if (
      typeof request.idempotency_key !== "string" ||
      request.idempotency_key.length === 0 ||
      Buffer.byteLength(request.idempotency_key, "utf8") > 128 ||
      controlCharacterPattern.test(request.idempotency_key)
    ) {
      fail("invalid_request", "idempotency_key is invalid");
    }
    assertIdentifier(request.expected_policy_version, "expected_policy_version");
    assertObject(request.scope, "scope");
    assertExactKeys(
      request.scope,
      [],
      ["topic_family_keys", "series_ids", "before"],
      "/scope",
    );
    if (request.scope.before !== undefined) {
      parseInstant(request.scope.before, "/scope/before");
    }
    for (const key of ["topic_family_keys", "series_ids"] as const) {
      const values = request.scope[key];
      if (
        values !== undefined &&
        (!Array.isArray(values) ||
          values.length > 1_000 ||
          values.some((entry) => typeof entry !== "string"))
      ) {
        fail("invalid_request", `${key} is invalid`);
      }
      values?.forEach((entry) => assertIdentifier(entry, key));
    }
    const validated = Object.freeze({
      ...request,
      scope: Object.freeze(structuredClone(request.scope)),
    });
    assertOwnerContract(
      () => assertMemoryIntegrationRunRequestSemanticBindingsV1(validated),
      "integration run owner contract mismatch",
    );
    return validated;
  }

  private integrationResponse(
    job: MutableIntegrationJobV1,
    replayed: boolean,
  ): MemoryIntegrationRunResponseV1 {
    assertCanonicalMemoryProjectionV1(
      job,
      "Memory integration job projection",
    );
    const response = Object.freeze({
      schema_version: "memory.integration_run.v1",
      integration_job_id: job.id,
      state_version: job.state_version,
      status: job.status,
      ...(job.checkpoint_ref === null
        ? {}
        : { checkpoint_ref: job.checkpoint_ref }),
      ...(job.proposed_changes.length === 0
        ? {}
        : { proposed_changes: Object.freeze(structuredClone(job.proposed_changes)) }),
      ...(Object.keys(job.applied_counts).length === 0
        ? {}
        : { applied_counts: Object.freeze({ ...job.applied_counts }) }),
      ...(job.failure_refs.length === 0
        ? {}
        : { failure_refs: Object.freeze([...job.failure_refs]) }),
      duplicate_replayed: replayed,
    });
    assertCanonicalMemoryProjectionV1(
      response,
      "Memory integration run response",
    );
    if (!Value.Check(MemoryIntegrationRunResponseV1Schema, response)) {
      throw new Error(
        "integration response violates the Memory owner schema",
      );
    }
    assertMemoryIntegrationRunResponseSemanticBindingsV1(response);
    return response;
  }
}
