import { createHash } from "node:crypto";

import { Value } from "@sinclair/typebox/value";

import {
  KnowThatCandidateReviewResultV1Schema,
  KnowThatLinkageRecoveryResponseV1Schema,
  KnowThatQueryResponseV1Schema,
  KnowThatWriteBatchResponseV1Schema,
  MemoryPromotionReservationAckRequestV1Schema,
  MemoryPrePromotionCheckResponseV1Schema,
  MemoryPromotionReservationAckResponseV1Schema,
  MemoryPromotionReservationReleaseRequestV1Schema,
  MemoryPromotionReservationReleaseResponseV1Schema,
  MemoryPromotionReservationV1Schema,
  assertMemoryPromotionReservationAckRequestSemanticBindingsV1,
  assertMemoryPrePromotionCheckResponseSemanticBindingsV1,
  assertMemoryPromotionReservationAckResponseSemanticBindingsV1,
  assertMemoryPromotionReservationReleaseRequestSemanticBindingsV1,
  assertMemoryPromotionReservationReleaseResponseSemanticBindingsV1,
  assertMemoryPromotionReservationSemanticBindingsV1,
  assertKnowThatCandidateReviewResultSemanticBindingsV1,
  assertKnowThatWriteBatchResponseV1,
  type KnowThatLinkageRecoveryResponseV1,
  type MemoryPrePromotionCheckResponseV1,
  type MemoryPromotionReservationAckResponseV1,
  type MemoryPromotionReservationV1,
  type MemoryPromotionReservationReleaseResponseV1,
} from "@pai/contracts";

import {
  canonicalHashV1,
  canonicalJsonV1,
  signOpaqueV1,
  snapshotCanonicalJsonV1,
  verifyOpaqueV1,
} from "./canonical.v1.js";
import type { KnowThatConfigV1 } from "./config.v1.js";
import type {
  KnowThatCandidateReviewCommitV1,
  KnowThatPromotionEvidenceV1,
  KnowThatQueryCursorTupleV1,
  KnowThatStorePortV1,
  PromotionAckCommandV1,
  PromotionReleaseCommandV1,
} from "./knowthat-store.v1.js";
import {
  KnowThatErrorV1,
  knowThatDurableFailureV1,
  type KnowThatCandidateReviewResultV1,
  type KnowThatCategoryV1,
  type KnowThatFactV1,
  type KnowThatLinkageRecoveryRequestV1,
  type KnowThatMemoryPrePromotionPortV1,
  type KnowThatQueryRequestV1,
  type KnowThatQueryResponseV1,
  type KnowThatScopeV1,
  type KnowThatWriteBatchResponseV1,
} from "./knowthat-types.v1.js";
import {
  knowThatReviewRequestHashV1,
  knowThatWriteRequestHashV1,
  parseKnowThatCandidateReviewV1,
  parseKnowThatQueryV1,
  parseKnowThatRecoveryV1,
  parseKnowThatWriteBatchV1,
  sameKnowThatScopeV1,
} from "./validation.v1.js";

interface SnapshotPayloadV1 extends KnowThatScopeV1 {
  readonly principal_fingerprint: string;
  readonly categories: readonly KnowThatCategoryV1[];
  readonly query: string | null;
  readonly first_limit: number;
  readonly query_revision: number;
  readonly as_of: string;
  readonly expires_at: string;
  readonly sort_version: "knowthat.query_sort.v1";
}

interface CursorPayloadV1 {
  readonly snapshot_hash: `sha256:${string}`;
  readonly tuple: KnowThatQueryCursorTupleV1;
}

function record(value: unknown): Readonly<Record<string, unknown>> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null
    ? (value as Readonly<Record<string, unknown>>)
    : undefined;
}

function memoryIdempotencyKey(
  operation: "check" | "reserve" | "release",
  identity: unknown,
): string {
  return `memory-${operation}:${canonicalHashV1(identity).slice(
    "sha256:".length,
  )}`;
}

function reservationTokenHashV1(token: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(token, "utf8").digest("hex")}`;
}

function snapshotKnowThatDateV1(value: Date, label: string): Date {
  let milliseconds: number;
  try {
    milliseconds = Date.prototype.getTime.call(value);
  } catch (error) {
    throw new Error(`${label} is not an intrinsic Date`, { cause: error });
  }
  if (!Number.isFinite(milliseconds)) {
    throw new Error(`${label} is not a finite instant`);
  }
  return new Date(milliseconds);
}

function promotionReservationProofV1(
  reservation: MemoryPromotionReservationV1,
): NonNullable<
  Parameters<KnowThatStorePortV1["reviewCandidate"]>[0]["promotion_reservation"]
> {
  return Object.freeze({
    schema_version: reservation.schema_version,
    reservation_id: reservation.reservation_id,
    check_id: reservation.check_id,
    check_generation: reservation.check_generation,
    candidate_fact_id: reservation.candidate_fact_id,
    fencing_generation: reservation.fencing_generation,
    reserved_points: reservation.reserved_points,
    reserved_conflicts: reservation.reserved_conflicts,
    reservation_token_hash: reservationTokenHashV1(
      reservation.reservation_token,
    ),
    reserved_at: reservation.reserved_at,
    expires_at: reservation.expires_at,
    status: reservation.status,
  });
}

function parseSnapshot(
  token: string,
  secret: string,
): SnapshotPayloadV1 {
  let payload: Readonly<Record<string, unknown>>;
  try {
    payload = verifyOpaqueV1(token, "knowthat_snapshot", secret);
  } catch (error) {
    throw new KnowThatErrorV1(
      "snapshot_expired",
      "KnowThat snapshot token is invalid",
      false,
      undefined,
      { cause: error },
    );
  }
  const categories = payload.categories;
  if (
    typeof payload.principal_fingerprint !== "string" ||
    typeof payload.workspace_id !== "string" ||
    typeof payload.bot_id !== "string" ||
    typeof payload.owner_agent_id !== "string" ||
    (payload.deployment_environment !== "local" &&
      payload.deployment_environment !== "dev" &&
      payload.deployment_environment !== "staging" &&
      payload.deployment_environment !== "prod") ||
    (payload.release_channel !== "stable" &&
      payload.release_channel !== "canary") ||
    !Array.isArray(categories) ||
    !categories.every(
      (entry) =>
        entry === "user_profile" ||
        entry === "relationship_state" ||
        entry === "world_state" ||
        entry === "self_state" ||
        entry === "project_fact" ||
        entry === "preference" ||
        entry === "rule",
    ) ||
    (typeof payload.query !== "string" && payload.query !== null) ||
    !Number.isSafeInteger(payload.first_limit) ||
    (payload.first_limit as number) < 1 ||
    (payload.first_limit as number) > 200 ||
    !Number.isSafeInteger(payload.query_revision) ||
    (payload.query_revision as number) < 1 ||
    typeof payload.as_of !== "string" ||
    !Number.isFinite(Date.parse(payload.as_of)) ||
    typeof payload.expires_at !== "string" ||
    !Number.isFinite(Date.parse(payload.expires_at)) ||
    payload.sort_version !== "knowthat.query_sort.v1"
  ) {
    throw new KnowThatErrorV1(
      "snapshot_expired",
      "KnowThat snapshot payload is invalid",
      false,
    );
  }
  return Object.freeze({
    principal_fingerprint: payload.principal_fingerprint,
    workspace_id: payload.workspace_id,
    bot_id: payload.bot_id,
    owner_agent_id: payload.owner_agent_id,
    deployment_environment: payload.deployment_environment,
    release_channel: payload.release_channel,
    categories: Object.freeze([...(categories as KnowThatCategoryV1[])]),
    query: payload.query,
    first_limit: payload.first_limit,
    query_revision: payload.query_revision,
    as_of: payload.as_of,
    expires_at: payload.expires_at,
    sort_version: "knowthat.query_sort.v1",
  }) as SnapshotPayloadV1;
}

function parseCursor(
  token: string,
  secret: string,
  expectedSnapshotHash: `sha256:${string}`,
): KnowThatQueryCursorTupleV1 {
  let payload: Readonly<Record<string, unknown>>;
  try {
    payload = verifyOpaqueV1(token, "knowthat_cursor", secret);
  } catch (error) {
    throw new KnowThatErrorV1(
      "invalid_cursor",
      "KnowThat cursor signature is invalid",
      false,
      undefined,
      { cause: error },
    );
  }
  const tuple = record(payload.tuple);
  if (
    payload.snapshot_hash !== expectedSnapshotHash ||
    tuple === undefined ||
    !Number.isSafeInteger(tuple.category_priority) ||
    !Number.isSafeInteger(tuple.query_rank) ||
    typeof tuple.updated_at !== "string" ||
    !Number.isFinite(Date.parse(tuple.updated_at)) ||
    typeof tuple.fact_id !== "string" ||
    tuple.fact_id.length === 0
  ) {
    throw new KnowThatErrorV1(
      "invalid_cursor",
      "KnowThat cursor is not bound to this snapshot",
      false,
    );
  }
  return Object.freeze({
    category_priority: tuple.category_priority as number,
    query_rank: tuple.query_rank as number,
    updated_at: tuple.updated_at,
    fact_id: tuple.fact_id,
  });
}

function normalizeQuery(value: string | undefined): string | null {
  return value === undefined ? null : value.toLocaleLowerCase("en-US");
}

function normalizeCategories(
  value: readonly KnowThatCategoryV1[] | undefined,
): readonly KnowThatCategoryV1[] {
  return Object.freeze([...(value ?? [])].sort());
}

function exactScope(value: KnowThatScopeV1): KnowThatScopeV1 {
  return Object.freeze({
    workspace_id: value.workspace_id,
    bot_id: value.bot_id,
    owner_agent_id: value.owner_agent_id,
    deployment_environment: value.deployment_environment,
    release_channel: value.release_channel,
  });
}

function snapshotMemoryOwnerResponse<T>(
  schema: Parameters<typeof Value.Check>[0],
  value: unknown,
  semanticAssertion: (response: T) => void,
  label: string,
): T {
  try {
    canonicalJsonV1(value);
  } catch {
    throw new Error(`${label} is not bounded canonical JSON`);
  }
  if (!Value.Check(schema, value)) {
    throw new Error(`${label} violates the Memory owner schema`);
  }
  try {
    semanticAssertion(value as T);
  } catch (error) {
    throw new Error(
      `${label} violates Memory semantic bindings`,
      { cause: error },
    );
  }
  return structuredClone(value) as T;
}

function snapshotKnowThatStoreResponse<T>(
  schema: Parameters<typeof Value.Check>[0],
  value: T,
  label: string,
  semanticAssertion?: (response: T) => void,
): T {
  let response: T;
  try {
    response = snapshotCanonicalJsonV1(value);
  } catch {
    throw new Error(`${label} is not bounded canonical JSON`);
  }
  if (!Value.Check(schema, response)) {
    throw new Error(`${label} violates the owner response schema`);
  }
  try {
    semanticAssertion?.(response);
  } catch (error) {
    throw new Error(`${label} violates owner response bindings`, {
      cause: error,
    });
  }
  return response;
}

function snapshotCandidateFactV1(
  value: KnowThatFactV1,
  expectedScope: KnowThatScopeV1,
  candidateId: string,
): KnowThatFactV1 {
  let fact: KnowThatFactV1;
  try {
    fact = snapshotCanonicalJsonV1(value);
  } catch {
    throw new Error("KnowThat candidate fact is not bounded canonical JSON");
  }
  if (
    fact.id !== candidateId ||
    !sameKnowThatScopeV1(fact, expectedScope) ||
    !["active", "candidate", "rejected", "expired"].includes(fact.status) ||
    !Number.isSafeInteger(fact.candidate_version) ||
    fact.candidate_version < 1 ||
    !["low", "medium", "high", "critical"].includes(fact.risk_level) ||
    ![
      "user_profile",
      "relationship_state",
      "world_state",
      "self_state",
      "project_fact",
      "preference",
      "rule",
    ].includes(fact.category) ||
    !Array.isArray(fact.evidence_refs) ||
    fact.evidence_refs.some(
      (reference) => typeof reference !== "string" || reference.length === 0,
    )
  ) {
    throw new Error("KnowThat candidate fact identity or projection drifted");
  }
  return fact;
}

const PROMOTION_ACK_COMMAND_KEYS_V1 = Object.freeze([
  "workspace_id",
  "bot_id",
  "owner_agent_id",
  "deployment_environment",
  "release_channel",
  "id",
  "command_type",
  "reservation_id",
  "candidate_fact_id",
  "fencing_generation",
  "reservation_token_hash",
  "promotion_revision_id",
  "committed_at",
  "idempotency_key",
  "request_hash",
  "request",
  "payload_hash",
  "status",
  "attempt_count",
  "next_retry_at",
  "last_error",
  "created_at",
  "updated_at",
] as const);

const PROMOTION_RELEASE_COMMAND_KEYS_V1 = Object.freeze([
  "workspace_id",
  "bot_id",
  "owner_agent_id",
  "deployment_environment",
  "release_channel",
  "id",
  "command_type",
  "reservation_id",
  "candidate_fact_id",
  "fencing_generation",
  "reservation_token_hash",
  "reservation_expires_at",
  "release_reason",
  "released_at",
  "idempotency_key",
  "request_hash",
  "request",
  "payload_hash",
  "status",
  "attempt_count",
  "next_retry_at",
  "last_error",
  "created_at",
  "updated_at",
] as const);

function hasExactKeysV1(
  value: Readonly<Record<string, unknown>>,
  expected: readonly string[],
): boolean {
  const keys = Object.keys(value);
  return (
    keys.length === expected.length &&
    expected.every((key) => Object.hasOwn(value, key))
  );
}

function validPromotionCommandSettlementV1(
  command: PromotionAckCommandV1 | PromotionReleaseCommandV1,
): boolean {
  const expectedFailureCode =
    command.command_type === "promotion_reservation_ack"
      ? "promotion_ack_unavailable"
      : "promotion_release_unavailable";
  const error = command.last_error;
  const errorValid =
    error === null ||
    (error.failure_code === expectedFailureCode &&
      typeof error.safe_summary === "string" &&
      error.safe_summary.length > 0);
  if (!errorValid) return false;
  if (command.status === "pending") {
    return (
      command.attempt_count === 0 &&
      command.next_retry_at === null &&
      command.last_error === null
    );
  }
  if (command.status === "dispatching") {
    return (
      command.attempt_count >= 1 &&
      command.next_retry_at === null &&
      command.last_error === null
    );
  }
  if (command.status === "retry_wait") {
    return (
      command.attempt_count >= 1 &&
      command.next_retry_at !== null &&
      Number.isFinite(Date.parse(command.next_retry_at)) &&
      command.last_error !== null
    );
  }
  return (
    command.attempt_count >= 1 &&
    command.next_retry_at === null &&
    (command.status === "sent"
      ? command.last_error === null
      : command.last_error !== null)
  );
}

function shouldDeliverPromotionCommandV1(
  command: PromotionAckCommandV1 | PromotionReleaseCommandV1,
): boolean {
  return (
    command.status === "pending" ||
    command.status === "dispatching" ||
    command.status === "retry_wait"
  );
}

function snapshotPromotionReleaseCommandV1(
  value: PromotionReleaseCommandV1,
  label: string,
  expected?: PromotionReleaseCommandV1,
): PromotionReleaseCommandV1 {
  let command: PromotionReleaseCommandV1;
  try {
    command = snapshotCanonicalJsonV1(value);
  } catch {
    throw new Error(`${label} is not bounded canonical JSON`);
  }
  if (
    !hasExactKeysV1(
      command as unknown as Readonly<Record<string, unknown>>,
      PROMOTION_RELEASE_COMMAND_KEYS_V1,
    ) ||
    command.command_type !== "promotion_reservation_release" ||
    typeof command.id !== "string" ||
    command.id.length === 0 ||
    typeof command.workspace_id !== "string" ||
    command.workspace_id.length === 0 ||
    typeof command.bot_id !== "string" ||
    command.bot_id.length === 0 ||
    typeof command.owner_agent_id !== "string" ||
    command.owner_agent_id.length === 0 ||
    !["local", "dev", "staging", "prod"].includes(
      command.deployment_environment,
    ) ||
    !["stable", "canary"].includes(command.release_channel) ||
    typeof command.reservation_id !== "string" ||
    command.reservation_id.length === 0 ||
    typeof command.candidate_fact_id !== "string" ||
    command.candidate_fact_id.length === 0 ||
    !Number.isSafeInteger(command.fencing_generation) ||
    command.fencing_generation < 1 ||
    typeof command.reservation_token_hash !== "string" ||
    !/^sha256:[0-9a-f]{64}$/u.test(command.reservation_token_hash) ||
    typeof command.reservation_expires_at !== "string" ||
    !Number.isFinite(Date.parse(command.reservation_expires_at)) ||
    typeof command.release_reason !== "string" ||
    typeof command.released_at !== "string" ||
    !Number.isFinite(Date.parse(command.released_at)) ||
    typeof command.idempotency_key !== "string" ||
    command.idempotency_key.length === 0 ||
    typeof command.request_hash !== "string" ||
    !/^sha256:[0-9a-f]{64}$/u.test(command.request_hash) ||
    typeof command.payload_hash !== "string" ||
    !/^sha256:[0-9a-f]{64}$/u.test(command.payload_hash) ||
    !["pending", "dispatching", "sent", "retry_wait", "failed"].includes(command.status) ||
    !Number.isSafeInteger(command.attempt_count) ||
    command.attempt_count < 0 ||
    (command.next_retry_at !== null &&
      (typeof command.next_retry_at !== "string" ||
        !Number.isFinite(Date.parse(command.next_retry_at)))) ||
    typeof command.created_at !== "string" ||
    !Number.isFinite(Date.parse(command.created_at)) ||
    typeof command.updated_at !== "string" ||
    !Number.isFinite(Date.parse(command.updated_at)) ||
    !validPromotionCommandSettlementV1(command) ||
    !Value.Check(
      MemoryPromotionReservationReleaseRequestV1Schema,
      command.request,
    )
  ) {
    throw new Error(`${label} violates the release command contract`);
  }
  try {
    assertMemoryPromotionReservationReleaseRequestSemanticBindingsV1(
      command.request,
    );
  } catch (error) {
    throw new Error(`${label} violates Memory release semantic bindings`, {
      cause: error,
    });
  }
  const requestHash = canonicalHashV1(command.request);
  if (
    command.request.bot_id !== command.bot_id ||
    command.request.reservation_id !== command.reservation_id ||
    command.request.candidate_fact_id !== command.candidate_fact_id ||
    command.request.fencing_generation !== command.fencing_generation ||
    command.request.reservation_token_hash !==
      command.reservation_token_hash ||
    command.request.release_reason !== command.release_reason ||
    command.request.released_at !== command.released_at ||
    command.request.idempotency_key !== command.idempotency_key ||
    command.request_hash !== requestHash ||
    command.payload_hash !== requestHash
  ) {
    throw new Error(`${label} identity binding drifted`);
  }
  if (
    expected !== undefined &&
    (!sameKnowThatScopeV1(command, expected) ||
      command.id !== expected.id ||
      command.reservation_id !== expected.reservation_id ||
      command.candidate_fact_id !== expected.candidate_fact_id ||
      command.fencing_generation !== expected.fencing_generation ||
      command.reservation_token_hash !== expected.reservation_token_hash ||
      command.reservation_expires_at !== expected.reservation_expires_at ||
      command.release_reason !== expected.release_reason ||
      command.released_at !== expected.released_at ||
      command.idempotency_key !== expected.idempotency_key ||
      command.request_hash !== expected.request_hash ||
      command.payload_hash !== expected.payload_hash ||
      canonicalHashV1(command.request) !== canonicalHashV1(expected.request))
  ) {
    throw new Error(`${label} no longer identifies the delivered command`);
  }
  return command;
}

function snapshotPromotionAckCommandV1(
  value: PromotionAckCommandV1,
  label: string,
  expected?: PromotionAckCommandV1,
): PromotionAckCommandV1 {
  let command: PromotionAckCommandV1;
  try {
    command = snapshotCanonicalJsonV1(value);
  } catch {
    throw new Error(`${label} is not bounded canonical JSON`);
  }
  if (
    !hasExactKeysV1(
      command as unknown as Readonly<Record<string, unknown>>,
      PROMOTION_ACK_COMMAND_KEYS_V1,
    ) ||
    command.command_type !== "promotion_reservation_ack" ||
    typeof command.id !== "string" ||
    command.id.length === 0 ||
    typeof command.workspace_id !== "string" ||
    command.workspace_id.length === 0 ||
    typeof command.bot_id !== "string" ||
    command.bot_id.length === 0 ||
    typeof command.owner_agent_id !== "string" ||
    command.owner_agent_id.length === 0 ||
    !["local", "dev", "staging", "prod"].includes(
      command.deployment_environment,
    ) ||
    !["stable", "canary"].includes(command.release_channel) ||
    typeof command.reservation_id !== "string" ||
    command.reservation_id.length === 0 ||
    typeof command.candidate_fact_id !== "string" ||
    command.candidate_fact_id.length === 0 ||
    !Number.isSafeInteger(command.fencing_generation) ||
    command.fencing_generation < 1 ||
    typeof command.reservation_token_hash !== "string" ||
    !/^sha256:[0-9a-f]{64}$/u.test(command.reservation_token_hash) ||
    typeof command.promotion_revision_id !== "string" ||
    command.promotion_revision_id.length === 0 ||
    typeof command.committed_at !== "string" ||
    !Number.isFinite(Date.parse(command.committed_at)) ||
    typeof command.idempotency_key !== "string" ||
    command.idempotency_key.length === 0 ||
    typeof command.request_hash !== "string" ||
    !/^sha256:[0-9a-f]{64}$/u.test(command.request_hash) ||
    typeof command.payload_hash !== "string" ||
    !/^sha256:[0-9a-f]{64}$/u.test(command.payload_hash) ||
    !["pending", "dispatching", "sent", "retry_wait", "failed"].includes(command.status) ||
    !Number.isSafeInteger(command.attempt_count) ||
    command.attempt_count < 0 ||
    (command.next_retry_at !== null &&
      (typeof command.next_retry_at !== "string" ||
        !Number.isFinite(Date.parse(command.next_retry_at)))) ||
    typeof command.created_at !== "string" ||
    !Number.isFinite(Date.parse(command.created_at)) ||
    typeof command.updated_at !== "string" ||
    !Number.isFinite(Date.parse(command.updated_at)) ||
    !validPromotionCommandSettlementV1(command) ||
    !Value.Check(MemoryPromotionReservationAckRequestV1Schema, command.request)
  ) {
    throw new Error(`${label} violates the ack command contract`);
  }
  try {
    assertMemoryPromotionReservationAckRequestSemanticBindingsV1(
      command.request,
    );
  } catch (error) {
    throw new Error(`${label} violates Memory ack semantic bindings`, {
      cause: error,
    });
  }
  const requestHash = canonicalHashV1(command.request);
  if (
    command.request.bot_id !== command.bot_id ||
    command.request.reservation_id !== command.reservation_id ||
    command.request.candidate_fact_id !== command.candidate_fact_id ||
    command.request.fencing_generation !== command.fencing_generation ||
    command.request.reservation_token_hash !==
      command.reservation_token_hash ||
    command.request.promotion_revision_id !== command.promotion_revision_id ||
    command.request.committed_at !== command.committed_at ||
    command.request.idempotency_key !== command.idempotency_key ||
    command.request_hash !== requestHash ||
    command.payload_hash !== requestHash
  ) {
    throw new Error(`${label} identity binding drifted`);
  }
  if (
    expected !== undefined &&
    (!sameKnowThatScopeV1(command, expected) ||
      command.id !== expected.id ||
      command.reservation_id !== expected.reservation_id ||
      command.candidate_fact_id !== expected.candidate_fact_id ||
      command.fencing_generation !== expected.fencing_generation ||
      command.reservation_token_hash !== expected.reservation_token_hash ||
      command.promotion_revision_id !== expected.promotion_revision_id ||
      command.committed_at !== expected.committed_at ||
      command.idempotency_key !== expected.idempotency_key ||
      command.request_hash !== expected.request_hash ||
      command.payload_hash !== expected.payload_hash ||
      canonicalHashV1(command.request) !== canonicalHashV1(expected.request))
  ) {
    throw new Error(`${label} no longer identifies the delivered command`);
  }
  return command;
}

function snapshotCandidateReviewCommitV1(
  value: KnowThatCandidateReviewCommitV1,
  request: Parameters<KnowThatStorePortV1["readCandidateReview"]>[0]["request"],
  candidateId: string,
  label: string,
  reservationExpectation: "required" | "forbidden" | "unknown",
): KnowThatCandidateReviewCommitV1 {
  let commit: KnowThatCandidateReviewCommitV1;
  try {
    commit = snapshotCanonicalJsonV1(value);
  } catch {
    throw new Error(`${label} is not bounded canonical JSON`);
  }
  const commitRecord = record(commit);
  if (
    commitRecord === undefined ||
    !hasExactKeysV1(commitRecord, [
      "result",
      "promotion_ack_command",
      "promotion_release_command",
    ]) ||
    !Value.Check(KnowThatCandidateReviewResultV1Schema, commit.result)
  ) {
    throw new Error(`${label} violates the candidate review commit contract`);
  }
  try {
    assertKnowThatCandidateReviewResultSemanticBindingsV1(commit.result);
  } catch (error) {
    throw new Error(`${label} violates candidate review result bindings`, {
      cause: error,
    });
  }
  if (
    commit.result.candidate_id !== candidateId ||
    commit.result.suggestion_id !== request.suggestion_id ||
    commit.result.target_candidate_version !==
      request.target_candidate_version
  ) {
    throw new Error(`${label} candidate review identity drifted`);
  }
  const ack =
    commit.promotion_ack_command === null
      ? null
      : snapshotPromotionAckCommandV1(
          commit.promotion_ack_command,
          `${label} promotion ack command`,
        );
  const release =
    commit.promotion_release_command === null
      ? null
      : snapshotPromotionReleaseCommandV1(
          commit.promotion_release_command,
          `${label} promotion release command`,
        );
  if (
    (ack !== null &&
      (!sameKnowThatScopeV1(ack, request) ||
        ack.candidate_fact_id !== candidateId)) ||
    (release !== null &&
      (!sameKnowThatScopeV1(release, request) ||
        release.candidate_fact_id !== candidateId)) ||
    (ack !== null && release !== null)
  ) {
    throw new Error(`${label} promotion handoff identity drifted`);
  }
  const promoted =
    commit.result.status === "accepted" &&
    commit.result.decision === "promote" &&
    commit.result.reason_code === "promoted";
  if (
    promoted !== (ack !== null) ||
    (reservationExpectation === "required" && ack === null && release === null) ||
    (reservationExpectation === "forbidden" && (ack !== null || release !== null))
  ) {
    throw new Error(`${label} is missing its atomic promotion handoff`);
  }
  return Object.freeze({
    result: commit.result,
    promotion_ack_command: ack,
    promotion_release_command: release,
  });
}

export interface KnowThatApplicationV1 {
  writeBatch(value: unknown, now?: Date): Promise<KnowThatWriteBatchResponseV1>;
  query(
    value: unknown,
    principalFingerprint: string,
    now?: Date,
  ): Promise<KnowThatQueryResponseV1>;
  reviewCandidate(
    candidateId: string,
    value: unknown,
    signal: AbortSignal,
    now?: Date,
  ): Promise<KnowThatCandidateReviewResultV1>;
  recoverLinkage(
    linkageJobId: string,
    value: unknown,
    now?: Date,
  ): Promise<KnowThatLinkageRecoveryResponseV1>;
  reconcilePromotionAcks(
    signal: AbortSignal,
    now?: Date,
    limit?: number,
  ): Promise<Readonly<{
    attempted: number;
    sent: number;
    retry_wait: number;
    failed: number;
  }>>;
  reconcilePromotionReleases(
    signal: AbortSignal,
    now?: Date,
    limit?: number,
  ): Promise<Readonly<{
    attempted: number;
    sent: number;
    retry_wait: number;
    failed: number;
  }>>;
  checkReadiness(signal: AbortSignal): Promise<void>;
}

export function createKnowThatApplicationV1(
  store: KnowThatStorePortV1,
  memory: KnowThatMemoryPrePromotionPortV1,
  config: KnowThatConfigV1,
): KnowThatApplicationV1 {
  const deliverPromotionRelease = async (
    commandValue: PromotionReleaseCommandV1,
    signal: AbortSignal,
    now: Date,
  ): Promise<"sent" | "retry_wait" | "failed"> => {
    const settlementNow = snapshotKnowThatDateV1(
      now,
      "KnowThat promotion release settlement clock",
    );
    const command = snapshotPromotionReleaseCommandV1(
      commandValue,
      "KnowThat promotion release command",
    );
    try {
      const response =
        snapshotMemoryOwnerResponse<MemoryPromotionReservationReleaseResponseV1>(
          MemoryPromotionReservationReleaseResponseV1Schema,
          await memory.release(command.request, signal, command),
          assertMemoryPromotionReservationReleaseResponseSemanticBindingsV1,
          "Memory promotion reservation release response",
        );
      if (
        response.reservation_id !== command.reservation_id ||
        response.candidate_fact_id !== command.candidate_fact_id ||
        response.fencing_generation !== command.fencing_generation ||
        response.status !== "released" ||
        !(
          (response.release_reason === command.release_reason &&
            response.released_at === command.released_at) ||
          (response.release_reason === "reservation_expired" &&
            response.released_at === command.reservation_expires_at)
        )
      ) {
        throw new Error(
          "Memory promotion reservation release response identity drifted",
        );
      }
      const settled = snapshotPromotionReleaseCommandV1(
        await store.settlePromotionRelease({
          command_id: command.id,
          outcome: "sent",
          error: null,
          now: settlementNow,
        }),
        "KnowThat settled promotion release command",
        command,
      );
      return settled.status === "sent" ? "sent" : "failed";
    } catch {
      const settled = snapshotPromotionReleaseCommandV1(
        await store.settlePromotionRelease({
          command_id: command.id,
          outcome: "retry_wait",
          error: knowThatDurableFailureV1(
            "promotion_release_unavailable",
          ),
          now: settlementNow,
        }),
        "KnowThat retried promotion release command",
        command,
      );
      if (settled.status === "sent") return "sent";
      return settled.status === "failed" ? "failed" : "retry_wait";
    }
  };

  const deliverPromotionAck = async (
    commandValue: PromotionAckCommandV1,
    signal: AbortSignal,
    now: Date,
  ): Promise<"sent" | "retry_wait" | "failed"> => {
    const settlementNow = snapshotKnowThatDateV1(
      now,
      "KnowThat promotion ack settlement clock",
    );
    const command = snapshotPromotionAckCommandV1(
      commandValue,
      "KnowThat promotion ack command",
    );
    try {
      const response =
        snapshotMemoryOwnerResponse<MemoryPromotionReservationAckResponseV1>(
          MemoryPromotionReservationAckResponseV1Schema,
          await memory.ack(command.request, signal, command),
          assertMemoryPromotionReservationAckResponseSemanticBindingsV1,
          "Memory promotion reservation ack response",
        );
      if (
        response.reservation_id !== command.reservation_id ||
        response.candidate_fact_id !== command.candidate_fact_id ||
        response.fencing_generation !== command.fencing_generation ||
        response.promotion_revision_id !== command.promotion_revision_id ||
        response.committed_at !== command.committed_at ||
        response.status !== "committed"
      ) {
        throw new Error(
          "Memory promotion reservation ack response identity drifted",
        );
      }
      const settled = snapshotPromotionAckCommandV1(
        await store.settlePromotionAck({
          command_id: command.id,
          outcome: "sent",
          error: null,
          now: settlementNow,
        }),
        "KnowThat settled promotion ack command",
        command,
      );
      return settled.status === "sent" ? "sent" : "failed";
    } catch {
      const settled = snapshotPromotionAckCommandV1(
        await store.settlePromotionAck({
          command_id: command.id,
          outcome: "retry_wait",
          error: knowThatDurableFailureV1("promotion_ack_unavailable"),
          now: settlementNow,
        }),
        "KnowThat retried promotion ack command",
        command,
      );
      if (settled.status === "sent") return "sent";
      return settled.status === "failed" ? "failed" : "retry_wait";
    }
  };

  return Object.freeze({
    async writeBatch(value: unknown, now?: Date) {
      const request = parseKnowThatWriteBatchV1(value);
      const response = snapshotKnowThatStoreResponse(
        KnowThatWriteBatchResponseV1Schema,
        await store.writeBatch(
          request,
          knowThatWriteRequestHashV1(request),
          snapshotKnowThatDateV1(
            now ?? new Date(),
            "KnowThat write batch clock",
          ),
        ),
        "KnowThat write batch response",
        assertKnowThatWriteBatchResponseV1,
      );
      const expectedClientIds = request.items
        .map((item) => item.client_item_id)
        .sort();
      const returnedClientIds = response.item_results
        .map((item) => item.client_item_id)
        .sort();
      if (
        expectedClientIds.length !== returnedClientIds.length ||
        canonicalHashV1(expectedClientIds) !==
          canonicalHashV1(returnedClientIds)
      ) {
        throw new Error("KnowThat write batch response identity drifted");
      }
      return response;
    },

    async query(
      value: unknown,
      principalFingerprint: string,
      now?: Date,
    ) {
      const queryNow = snapshotKnowThatDateV1(
        now ?? new Date(),
        "KnowThat query clock",
      );
      if (principalFingerprint.length === 0) {
        throw new KnowThatErrorV1(
          "scope_mismatch",
          "KnowThat query principal is missing",
          false,
        );
      }
      const request = parseKnowThatQueryV1(value);
      const scope = exactScope(request);
      let snapshot: SnapshotPayloadV1;
      let snapshotToken: string;
      let after: KnowThatQueryCursorTupleV1 | null = null;
      let limit: number;
      if ("snapshot_token" in request) {
        snapshot = parseSnapshot(
          request.snapshot_token,
          config.snapshot_hmac_secret,
        );
        if (
          snapshot.principal_fingerprint !== principalFingerprint ||
          !sameKnowThatScopeV1(scope, snapshot)
        ) {
          throw new KnowThatErrorV1(
            "scope_mismatch",
            "KnowThat snapshot principal or scope changed",
            false,
          );
        }
        if (Date.parse(snapshot.expires_at) <= queryNow.getTime()) {
          throw new KnowThatErrorV1(
            "snapshot_expired",
            "KnowThat snapshot expired",
            false,
          );
        }
        limit = request.limit ?? snapshot.first_limit;
        if (limit > snapshot.first_limit) {
          throw new KnowThatErrorV1(
            "invalid_cursor",
            "KnowThat next-page limit cannot exceed the first-page limit",
            false,
          );
        }
        after = parseCursor(
          request.cursor,
          config.snapshot_hmac_secret,
          canonicalHashV1(snapshot),
        );
        snapshotToken = request.snapshot_token;
      } else {
        limit = request.limit ?? 50;
        const queryRevision = await store.currentRevision(scope);
        snapshot = Object.freeze({
          ...scope,
          principal_fingerprint: principalFingerprint,
          categories: normalizeCategories(request.categories),
          query: normalizeQuery(request.query),
          first_limit: limit,
          query_revision: queryRevision,
          as_of: queryNow.toISOString(),
          expires_at: new Date(
            queryNow.getTime() + config.snapshot_ttl_ms,
          ).toISOString(),
          sort_version: "knowthat.query_sort.v1",
        });
        snapshotToken = signOpaqueV1(
          "knowthat_snapshot",
          snapshot as unknown as Readonly<Record<string, unknown>>,
          config.snapshot_hmac_secret,
        );
      }
      const minimum = await store.minimumReplayableRevision(scope);
      if (snapshot.query_revision < minimum) {
        throw new KnowThatErrorV1(
          "snapshot_expired",
          "KnowThat snapshot revision is no longer replayable",
          true,
        );
      }
      const page = snapshotCanonicalJsonV1(
        await store.queryAt({
          scope,
          revision: snapshot.query_revision,
          as_of: new Date(snapshot.as_of),
          categories: snapshot.categories,
          query: snapshot.query,
          limit,
          after,
        }),
      );
      if (
        page.facts.length > limit ||
        (page.next !== null && page.facts.length === 0)
      ) {
        throw new Error("KnowThat query page shape drifted");
      }
      const nextCursor =
        page.next === null
          ? undefined
          : signOpaqueV1(
              "knowthat_cursor",
              {
                snapshot_hash: canonicalHashV1(snapshot),
                tuple: page.next,
              },
              config.snapshot_hmac_secret,
            );
      return snapshotKnowThatStoreResponse(
        KnowThatQueryResponseV1Schema,
        {
          schema_version: "knowthat_query.v1" as const,
          snapshot_token: snapshotToken,
          query_revision: snapshot.query_revision,
          as_of: snapshot.as_of,
          facts: page.facts,
          ...(nextCursor === undefined ? {} : { next_cursor: nextCursor }),
        },
        "KnowThat query response",
      );
    },

    async reviewCandidate(
      candidateId: string,
      value: unknown,
      signal: AbortSignal,
      now?: Date,
    ) {
      const explicitNow =
        now === undefined
          ? undefined
          : snapshotKnowThatDateV1(
              now,
              "KnowThat candidate review clock",
            );
      const currentReviewNow = (): Date =>
        explicitNow ??
        snapshotKnowThatDateV1(
          new Date(),
          "KnowThat candidate review current clock",
        );
      const requestNow = currentReviewNow();
      const request = parseKnowThatCandidateReviewV1(candidateId, value);
      const requestHash = knowThatReviewRequestHashV1(
        candidateId,
        request,
      );
      const priorCommitValue = await store.readCandidateReview({
        request,
        request_hash: requestHash,
      });
      if (priorCommitValue !== undefined) {
        const priorCommit = snapshotCandidateReviewCommitV1(
          priorCommitValue,
          request,
          candidateId,
          "KnowThat stored candidate review commit",
          "unknown",
        );
        const priorReleaseCommand =
          priorCommit.promotion_release_command === null ||
          priorCommit.promotion_release_command === undefined
            ? null
            : snapshotPromotionReleaseCommandV1(
                priorCommit.promotion_release_command,
                "KnowThat stored promotion release command",
              );
        if (
          priorReleaseCommand !== null &&
          shouldDeliverPromotionCommandV1(priorReleaseCommand)
        ) {
          await deliverPromotionRelease(
            priorReleaseCommand,
            signal,
            currentReviewNow(),
          );
        }
        if (
          priorCommit.promotion_ack_command !== null &&
          shouldDeliverPromotionCommandV1(priorCommit.promotion_ack_command)
        ) {
          await deliverPromotionAck(
            priorCommit.promotion_ack_command,
            signal,
            currentReviewNow(),
          );
        }
        return priorCommit.result;
      }
      let reservation: MemoryPromotionReservationV1 | null = null;
      let promotionEvidence: KnowThatPromotionEvidenceV1 | null = null;
      if (request.suggested_action === "promote") {
        const candidateValue = await store.readFact(request, candidateId);
        const candidate =
          candidateValue === undefined
            ? undefined
            : snapshotCandidateFactV1(
                candidateValue,
                request,
                candidateId,
              );
        if (candidate === undefined || candidate.status !== "candidate") {
          return (
            await store.reviewCandidate({
              candidate_id: candidateId,
              request,
              request_hash: requestHash,
              promotion_evidence: null,
              promotion_reservation: null,
              now: requestNow,
            })
          ).result;
        }
        const memoryPointIds = [
          ...new Set(
            [...candidate.evidence_refs, ...request.new_evidence_refs]
              .filter((reference) =>
                reference.startsWith("memory_point:"),
              )
              .map((reference) =>
                reference.slice("memory_point:".length),
              )
              .filter((id) => id.length > 0),
          ),
        ].sort();
        if (memoryPointIds.length === 0) {
          return (
            await store.reviewCandidate({
              candidate_id: candidateId,
              request,
              request_hash: requestHash,
              promotion_evidence: null,
              promotion_reservation: null,
              now: requestNow,
            })
          ).result;
        }
        try {
          const requiredChecks = [
            "point_exists",
            "state_allowed",
            "no_unresolved_conflict",
            "not_expired",
            "provenance_integrity",
          ] as const;
          const memoryCheckIdempotencyKey = memoryIdempotencyKey(
            "check",
            {
              candidate_fact_id: candidateId,
              candidate_version: candidate.candidate_version,
              memory_point_ids: memoryPointIds,
            },
          );
          const check =
            snapshotMemoryOwnerResponse<MemoryPrePromotionCheckResponseV1>(
              MemoryPrePromotionCheckResponseV1Schema,
              await memory.check({
                schema_version: "memory.pre_promotion_check.v1",
                bot_id: request.bot_id,
                candidate_fact_id: candidateId,
                memory_point_ids: memoryPointIds,
                required_checks: [...requiredChecks],
                idempotency_key: memoryCheckIdempotencyKey,
                trace_id: request.trace_id,
              }, signal, request),
              assertMemoryPrePromotionCheckResponseSemanticBindingsV1,
              "Memory pre-promotion check response",
            );
          const checkedAt = Date.parse(check.checked_at);
          const checkExpiresAt = Date.parse(check.expires_at);
          const returnedPointIds = check.points
            .map((point) => point.memory_point_id)
            .sort();
          if (
            check.schema_version !== "memory.pre_promotion_check.v1" ||
            !["passed", "blocked", "needs_review"].includes(
              check.overall_result,
            ) ||
            check.candidate_fact_id !== candidateId ||
            check.check_id.length === 0 ||
            !Number.isSafeInteger(check.check_generation) ||
            check.check_generation < 1 ||
            check.check_token.length === 0 ||
            Buffer.byteLength(check.check_token, "utf8") > 16_384 ||
            !Number.isFinite(checkedAt) ||
            !Number.isFinite(checkExpiresAt) ||
            checkExpiresAt <= checkedAt ||
            checkExpiresAt - checkedAt > 30_000 ||
            canonicalHashV1(returnedPointIds) !==
              canonicalHashV1(memoryPointIds) ||
            new Set(returnedPointIds).size !== returnedPointIds.length ||
            canonicalHashV1([...check.required_checks].sort()) !==
              canonicalHashV1([...requiredChecks].sort())
          ) {
            throw new Error(
              "Memory returned a malformed or mismatched check snapshot",
            );
          }
          if (check.overall_result !== "passed") {
            return (
              await store.reviewCandidate({
                candidate_id: candidateId,
                request,
                request_hash: requestHash,
                promotion_evidence: null,
                promotion_reservation: null,
                now: requestNow,
              })
            ).result;
          }
          if (checkExpiresAt <= currentReviewNow().getTime()) {
            throw new Error(
              "Memory returned an expired pre-promotion check snapshot",
            );
          }
          if (
            check.summary.blocking_reasons.length !== 0 ||
            check.points.some(
              (point) =>
                !point.exists ||
                point.status !== "active" ||
                point.unresolved_conflicts.length !== 0 ||
                point.expired ||
                !point.provenance_valid ||
                point.blocking_reasons.length !== 0,
            )
          ) {
            throw new Error(
              "Memory marked an unsafe point snapshot as passed",
            );
          }
          const expectedPointVersions = check.points.map((point) => {
            if (!point.exists) {
              throw new Error(
                "Memory passed a missing pre-promotion point",
              );
            }
            return {
              memory_point_id: point.memory_point_id,
              state_version: point.state_version,
              state_hash: point.state_hash,
            };
          });
          const expectedConflictVersions = [
            ...new Map(
              check.points
                .flatMap((point) => point.unresolved_conflicts)
                .map((conflict) => [
                  conflict.conflict_id,
                  conflict,
                ]),
            ).values(),
          ];
          promotionEvidence = Object.freeze({
            check_id: check.check_id,
            check_generation: check.check_generation,
            candidate_fact_id: check.candidate_fact_id,
            check_policy_version: check.check_policy_version,
            independent_trigger_process_count:
              check.summary.independent_trigger_process_count,
            has_user_explicit_confirmation:
              check.summary.has_user_explicit_confirmation,
          });
          const requiresConfirmation =
            candidate.risk_level === "high" ||
            candidate.risk_level === "critical" ||
            candidate.category === "rule";
          const evidenceGatePassed =
            promotionEvidence.has_user_explicit_confirmation ||
            (!requiresConfirmation &&
              promotionEvidence.independent_trigger_process_count >= 2);
          if (!evidenceGatePassed) {
            return (
              await store.reviewCandidate({
                candidate_id: candidateId,
                request,
                request_hash: requestHash,
                promotion_evidence: promotionEvidence,
                promotion_reservation: null,
                now: requestNow,
              })
            ).result;
          }
          reservation =
            snapshotMemoryOwnerResponse<MemoryPromotionReservationV1>(
              MemoryPromotionReservationV1Schema,
              await memory.validate({
                schema_version: "memory.pre_promotion_validate.v1",
                bot_id: request.bot_id,
                check_token: check.check_token,
                check_id: check.check_id,
                check_generation: check.check_generation,
                candidate_fact_id: candidateId,
                expected_point_versions: expectedPointVersions,
                expected_conflict_versions: expectedConflictVersions,
                idempotency_key: memoryIdempotencyKey("reserve", {
                  check_id: check.check_id,
                  check_generation: check.check_generation,
                  candidate_fact_id: candidateId,
                  expected_point_versions: expectedPointVersions,
                  expected_conflict_versions: expectedConflictVersions,
                }),
              }, signal, request),
              assertMemoryPromotionReservationSemanticBindingsV1,
              "Memory promotion reservation response",
            );
          const reservedAt = Date.parse(reservation.reserved_at);
          const reservationExpiresAt = Date.parse(
            reservation.expires_at,
          );
          if (
            reservation.schema_version !==
              "memory.promotion_reservation.v1" ||
            reservation.check_id !== check.check_id ||
            reservation.check_generation !== check.check_generation ||
            reservation.candidate_fact_id !== candidateId ||
            reservation.status !== "active" ||
            !Number.isSafeInteger(reservation.fencing_generation) ||
            reservation.fencing_generation < 1 ||
            reservation.reservation_token.length === 0 ||
            Buffer.byteLength(
              reservation.reservation_token,
              "utf8",
            ) > 16_384 ||
            !Number.isFinite(reservedAt) ||
            !Number.isFinite(reservationExpiresAt) ||
            reservedAt < checkedAt ||
            reservedAt > checkExpiresAt ||
            reservationExpiresAt <= reservedAt ||
            reservationExpiresAt - reservedAt > 15_000 ||
            reservationExpiresAt <= currentReviewNow().getTime() ||
            canonicalHashV1(
              [...reservation.reserved_points].sort((left, right) =>
                left.memory_point_id.localeCompare(
                  right.memory_point_id,
                ),
              ),
            ) !==
              canonicalHashV1(
                [...expectedPointVersions].sort((left, right) =>
                  left.memory_point_id.localeCompare(
                    right.memory_point_id,
                  ),
                ),
              ) ||
            canonicalHashV1(
              [...reservation.reserved_conflicts].sort(
                (left, right) =>
                  left.conflict_id.localeCompare(right.conflict_id),
              ),
            ) !==
              canonicalHashV1(
                [...expectedConflictVersions].sort(
                  (left, right) =>
                    left.conflict_id.localeCompare(
                      right.conflict_id,
                    ),
                ),
              )
          ) {
            throw new Error(
              "Memory returned a stale or mismatched promotion reservation",
            );
          }
        } catch (error) {
          throw new KnowThatErrorV1(
            "promotion_reservation_unavailable",
            "KnowThat Memory check/validate/reservation is unavailable or stale",
            true,
            undefined,
            { cause: error },
          );
        }
      }
      const commitNow = new Date(
        Math.max(
          currentReviewNow().getTime(),
          reservation === null
            ? Number.NEGATIVE_INFINITY
            : Date.parse(reservation.reserved_at),
        ),
      );
      let commit: KnowThatCandidateReviewCommitV1;
      try {
        commit = snapshotCandidateReviewCommitV1(
          await store.reviewCandidate({
            candidate_id: candidateId,
            request,
            request_hash: requestHash,
            promotion_evidence: promotionEvidence,
            promotion_reservation:
              reservation === null
                ? null
                : promotionReservationProofV1(reservation),
            now: commitNow,
          }),
          request,
          candidateId,
          "KnowThat committed candidate review",
          reservation === null ? "forbidden" : "required",
        );
      } catch (error) {
        let recovered: KnowThatCandidateReviewCommitV1 | undefined;
        try {
          const recoveredValue = await store.readCandidateReview({
            request,
            request_hash: requestHash,
          });
          recovered =
            recoveredValue === undefined
              ? undefined
              : snapshotCandidateReviewCommitV1(
                  recoveredValue,
                  request,
                  candidateId,
                  "KnowThat recovered candidate review commit",
                  reservation === null ? "forbidden" : "required",
                );
        } catch (readError) {
          throw new KnowThatErrorV1(
            "promotion_retry_required",
            "KnowThat promotion commit outcome is ambiguous; reservation was not released",
            true,
            undefined,
            { cause: new AggregateError([error, readError]) },
          );
        }
        if (recovered !== undefined) {
          commit = recovered;
        } else {
          if (reservation !== null) {
            let releaseCommand: PromotionReleaseCommandV1;
            try {
              releaseCommand = snapshotPromotionReleaseCommandV1(
                await store.ensurePromotionRelease({
                  request,
                  promotion_reservation:
                    promotionReservationProofV1(reservation),
                  release_reason: "promotion_commit_failed",
                  now: commitNow,
                }),
                "KnowThat enqueued promotion release command",
              );
            } catch (releaseEnqueueError) {
              throw new KnowThatErrorV1(
                "promotion_retry_required",
                "KnowThat promotion rolled back but the durable Memory reservation release handoff failed",
                true,
                undefined,
                {
                  cause: new AggregateError([
                    error,
                    releaseEnqueueError,
                  ]),
                },
              );
            }
            try {
              if (
                shouldDeliverPromotionCommandV1(releaseCommand)
              ) {
                await deliverPromotionRelease(
                  releaseCommand,
                  signal,
                  commitNow,
                );
              }
            } catch (releaseSettlementError) {
              throw new KnowThatErrorV1(
                "promotion_retry_required",
                "KnowThat promotion rolled back and its durable Memory reservation release settlement needs retry",
                true,
                undefined,
                {
                  cause: new AggregateError([
                    error,
                    releaseSettlementError,
                  ]),
                },
              );
            }
          }
          throw error;
        }
      }
      const releaseCommand =
        commit.promotion_release_command === null ||
        commit.promotion_release_command === undefined
          ? null
          : snapshotPromotionReleaseCommandV1(
              commit.promotion_release_command,
              "KnowThat committed promotion release command",
            );
      if (
        releaseCommand !== null &&
        shouldDeliverPromotionCommandV1(releaseCommand)
      ) {
        await deliverPromotionRelease(
          releaseCommand,
          signal,
          commitNow,
        );
      }
      if (
        commit.promotion_ack_command !== null &&
        shouldDeliverPromotionCommandV1(commit.promotion_ack_command)
      ) {
        await deliverPromotionAck(
          commit.promotion_ack_command,
          signal,
          commitNow,
        );
      }
      return commit.result;
    },

    async recoverLinkage(
      linkageJobId: string,
      value: unknown,
      now?: Date,
    ) {
      const recoveryNow = snapshotKnowThatDateV1(
        now ?? new Date(),
        "KnowThat linkage recovery clock",
      );
      const request: KnowThatLinkageRecoveryRequestV1 =
        parseKnowThatRecoveryV1(linkageJobId, value);
      const recovered = snapshotCanonicalJsonV1(
        await store.recoverLinkage(request, recoveryNow),
      );
      const job = recovered.linkage_job;
      if (
        job.id !== linkageJobId ||
        !sameKnowThatScopeV1(job, request)
      ) {
        throw new Error("KnowThat linkage recovery identity drifted");
      }
      return snapshotKnowThatStoreResponse(
        KnowThatLinkageRecoveryResponseV1Schema,
        {
          duplicate_replayed: recovered.duplicate_replayed,
          linkage_job: {
            id: job.id,
            fact_id: job.fact_id,
            workspace_id: job.workspace_id,
            bot_id: job.bot_id,
            owner_agent_id: job.owner_agent_id,
            deployment_environment: job.deployment_environment,
            release_channel: job.release_channel,
            check_type: job.check_type,
            target_service: job.target_service,
            operation: job.operation,
            status: job.status,
            attempt_count: job.attempt_count,
            next_retry_at: job.next_retry_at,
            job_version: job.job_version,
            updated_at: job.updated_at,
          },
        },
        "KnowThat linkage recovery response",
      );
    },

    async reconcilePromotionAcks(
      signal: AbortSignal,
      now = new Date(),
      limit = 100,
    ) {
      const reconciliationNow = snapshotKnowThatDateV1(
        now,
        "KnowThat promotion ack reconciliation clock",
      );
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_000) {
        throw new KnowThatErrorV1(
          "schema_validation_failed",
          "promotion ack reconciliation limit is invalid",
          false,
        );
      }
      let queuedCommands: readonly PromotionAckCommandV1[];
      try {
        queuedCommands = snapshotCanonicalJsonV1(
          await store.pendingPromotionAcks({
            limit,
            now: reconciliationNow,
          }),
        );
      } catch {
        throw new Error(
          "KnowThat pending promotion ack commands are not bounded canonical JSON",
        );
      }
      const commands = queuedCommands.map((command) =>
        snapshotPromotionAckCommandV1(
          command,
          "KnowThat pending promotion ack command",
        ),
      );
      const counts = {
        attempted: commands.length,
        sent: 0,
        retry_wait: 0,
        failed: 0,
      };
      for (const command of commands) {
        const outcome = await deliverPromotionAck(
          command,
          signal,
          reconciliationNow,
        );
        counts[outcome] += 1;
      }
      return Object.freeze(counts);
    },

    async reconcilePromotionReleases(
      signal: AbortSignal,
      now = new Date(),
      limit = 100,
    ) {
      const reconciliationNow = snapshotKnowThatDateV1(
        now,
        "KnowThat promotion release reconciliation clock",
      );
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_000) {
        throw new KnowThatErrorV1(
          "schema_validation_failed",
          "promotion release reconciliation limit is invalid",
          false,
        );
      }
      let queuedCommands: readonly PromotionReleaseCommandV1[];
      try {
        queuedCommands = snapshotCanonicalJsonV1(
          await store.pendingPromotionReleases({
            limit,
            now: reconciliationNow,
          }),
        );
      } catch {
        throw new Error(
          "KnowThat pending promotion release commands are not bounded canonical JSON",
        );
      }
      const commands = queuedCommands.map((command) =>
        snapshotPromotionReleaseCommandV1(
          command,
          "KnowThat pending promotion release command",
        ),
      );
      const counts = {
        attempted: commands.length,
        sent: 0,
        retry_wait: 0,
        failed: 0,
      };
      for (const command of commands) {
        const outcome = await deliverPromotionRelease(
          command,
          signal,
          reconciliationNow,
        );
        counts[outcome] += 1;
      }
      return Object.freeze(counts);
    },

    async checkReadiness(signal: AbortSignal) {
      if (
        store.checkReadiness === undefined ||
        memory.checkReadiness === undefined
      ) {
        throw new Error(
          "KnowThat store and Memory readiness probes are required",
        );
      }
      await store.checkReadiness(signal);
      await memory.checkReadiness(signal);
    },
  });
}
