import { Type, type Static } from "@sinclair/typebox";

import {
  MemoryPointStatusV1Schema,
  MemorySha256V1Schema,
  MemoryTimestampV1Schema,
  assertTimestampOrderV1,
  assertUniqueIdsV1,
} from "./common.v1.js";
import { MemoryIdV1Schema } from "./write-batch.v1.js";

export const MEMORY_PRE_PROMOTION_CHECKS_V1 = [
  "point_exists",
  "state_allowed",
  "no_unresolved_conflict",
  "not_expired",
  "provenance_integrity",
  "independent_sources",
  "user_confirmation",
] as const;

export const MEMORY_PRE_PROMOTION_BLOCKING_REASONS_V1 = [
  "point_missing",
  "point_not_active",
  "point_downgraded",
  "point_archived",
  "unresolved_conflict",
  "evidence_expired",
  "provenance_invalid",
  "insufficient_independent_sources",
  "user_confirmation_missing",
  "policy_mismatch",
] as const;

export const MEMORY_PROMOTION_RELEASE_REASONS_V1 = [
  "promotion_commit_failed",
  "reservation_expired",
  "stale_fence",
  "point_version_drift",
  "conflict_version_drift",
  "promotion_not_applied",
] as const;

export const MEMORY_PRE_PROMOTION_POLICY_VERSION_V1 =
  "memory.pre_promotion_policy.rev309" as const;

const checkSchema = Type.Union(
  MEMORY_PRE_PROMOTION_CHECKS_V1.map((check) => Type.Literal(check)),
);
const reasonSchema = Type.Union(
  MEMORY_PRE_PROMOTION_BLOCKING_REASONS_V1.map((reason) =>
    Type.Literal(reason),
  ),
);
const releaseReasonSchema = Type.Union(
  MEMORY_PROMOTION_RELEASE_REASONS_V1.map((reason) =>
    Type.Literal(reason),
  ),
);

export const MemoryPrePromotionCheckRequestV1Schema = Type.Object(
  {
    schema_version: Type.Literal("memory.pre_promotion_check.v1"),
    bot_id: MemoryIdV1Schema,
    candidate_fact_id: MemoryIdV1Schema,
    memory_point_ids: Type.Array(MemoryIdV1Schema, {
      minItems: 1,
      maxItems: 1_000,
      uniqueItems: true,
    }),
    required_checks: Type.Optional(
      Type.Array(checkSchema, {
        minItems: 1,
        maxItems: 7,
        uniqueItems: true,
      }),
    ),
    idempotency_key: Type.String({
      minLength: 1,
      maxUtf8Bytes: 128,
    }),
    trace_id: MemoryIdV1Schema,
  },
  {
    $id: "urn:pai:memory:pre-promotion-check-request:v1",
    additionalProperties: false,
  },
);

const conflictVersionSchema = Type.Object(
  {
    conflict_id: MemoryIdV1Schema,
    conflict_version: Type.Integer({
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
  },
  { additionalProperties: false },
);

const pointCheckSchema = Type.Union([
  Type.Object(
    {
      memory_point_id: MemoryIdV1Schema,
      exists: Type.Literal(false),
      state_version: Type.Null(),
      state_hash: Type.Null(),
      status: Type.Null(),
      evidence_valid_until: Type.Null(),
      unresolved_conflicts: Type.Array(conflictVersionSchema, {
        maxItems: 0,
      }),
      expired: Type.Literal(false),
      provenance_valid: Type.Literal(false),
      source_trigger_process_id: Type.Null(),
      confidence_score: Type.Null(),
      user_explicit_confirmation: Type.Literal(false),
      blocking_reasons: Type.Array(reasonSchema, {
        minItems: 1,
        maxItems: 10,
        uniqueItems: true,
      }),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      memory_point_id: MemoryIdV1Schema,
      exists: Type.Literal(true),
      state_version: Type.Integer({
        minimum: 1,
        maximum: Number.MAX_SAFE_INTEGER,
      }),
      state_hash: MemorySha256V1Schema,
      status: MemoryPointStatusV1Schema,
      evidence_valid_until: Type.Union([
        MemoryTimestampV1Schema,
        Type.Null(),
      ]),
      unresolved_conflicts: Type.Array(conflictVersionSchema, {
        maxItems: 1_000,
      }),
      expired: Type.Boolean(),
      provenance_valid: Type.Boolean(),
      source_trigger_process_id: MemoryIdV1Schema,
      confidence_score: Type.Number({ minimum: 0, maximum: 1 }),
      user_explicit_confirmation: Type.Boolean(),
      blocking_reasons: Type.Array(reasonSchema, {
        maxItems: 10,
        uniqueItems: true,
      }),
    },
    { additionalProperties: false },
  ),
]);

export const MemoryPrePromotionCheckResponseV1Schema = Type.Object(
  {
    schema_version: Type.Literal("memory.pre_promotion_check.v1"),
    check_id: MemoryIdV1Schema,
    check_generation: Type.Integer({
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    candidate_fact_id: MemoryIdV1Schema,
    overall_result: Type.Union([
      Type.Literal("passed"),
      Type.Literal("blocked"),
      Type.Literal("needs_review"),
    ]),
    checked_at: MemoryTimestampV1Schema,
    expires_at: MemoryTimestampV1Schema,
    check_token: Type.String({ minLength: 1, maxUtf8Bytes: 16_384 }),
    check_policy_version: Type.Literal(
      MEMORY_PRE_PROMOTION_POLICY_VERSION_V1,
    ),
    required_checks: Type.Array(checkSchema, {
      minItems: 1,
      maxItems: 7,
      uniqueItems: true,
    }),
    points: Type.Array(pointCheckSchema, {
      minItems: 1,
      maxItems: 1_000,
    }),
    summary: Type.Object(
      {
        active_count: Type.Integer({
          minimum: 0,
          maximum: Number.MAX_SAFE_INTEGER,
        }),
        independent_trigger_process_count: Type.Integer({
          minimum: 0,
          maximum: Number.MAX_SAFE_INTEGER,
        }),
        has_user_explicit_confirmation: Type.Boolean(),
        blocking_reasons: Type.Array(reasonSchema, {
          maxItems: 10,
          uniqueItems: true,
        }),
      },
      { additionalProperties: false },
    ),
    duplicate_replayed: Type.Boolean(),
  },
  {
    $id: "urn:pai:memory:pre-promotion-check-response:v1",
    additionalProperties: false,
  },
);

const expectedPointSchema = Type.Object(
  {
    memory_point_id: MemoryIdV1Schema,
    state_version: Type.Integer({
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    state_hash: MemorySha256V1Schema,
  },
  { additionalProperties: false },
);

export const MemoryPrePromotionValidateRequestV1Schema = Type.Object(
  {
    schema_version: Type.Literal("memory.pre_promotion_validate.v1"),
    bot_id: MemoryIdV1Schema,
    check_token: Type.String({ minLength: 1, maxUtf8Bytes: 16_384 }),
    check_id: MemoryIdV1Schema,
    check_generation: Type.Integer({
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    candidate_fact_id: MemoryIdV1Schema,
    expected_point_versions: Type.Array(expectedPointSchema, {
      minItems: 1,
      maxItems: 1_000,
    }),
    expected_conflict_versions: Type.Array(conflictVersionSchema, {
      maxItems: 1_000,
    }),
    idempotency_key: Type.String({
      minLength: 1,
      maxUtf8Bytes: 128,
    }),
  },
  {
    $id: "urn:pai:memory:pre-promotion-validate-request:v1",
    additionalProperties: false,
  },
);

export const MemoryPromotionReservationV1Schema = Type.Object(
  {
    schema_version: Type.Literal("memory.promotion_reservation.v1"),
    reservation_id: MemoryIdV1Schema,
    check_id: MemoryIdV1Schema,
    check_generation: Type.Integer({
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    candidate_fact_id: MemoryIdV1Schema,
    fencing_generation: Type.Integer({
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    reserved_points: Type.Array(expectedPointSchema, {
      minItems: 1,
      maxItems: 1_000,
    }),
    reserved_conflicts: Type.Array(conflictVersionSchema, {
      maxItems: 1_000,
    }),
    reservation_token: Type.String({
      minLength: 1,
      maxUtf8Bytes: 16_384,
    }),
    reserved_at: MemoryTimestampV1Schema,
    expires_at: MemoryTimestampV1Schema,
    status: Type.Literal("active"),
  },
  {
    $id: "urn:pai:memory:promotion-reservation:v1",
    additionalProperties: false,
  },
);

const reservationIdentitySchema = {
  bot_id: MemoryIdV1Schema,
  reservation_id: MemoryIdV1Schema,
  candidate_fact_id: MemoryIdV1Schema,
  fencing_generation: Type.Integer({
    minimum: 1,
    maximum: Number.MAX_SAFE_INTEGER,
  }),
  reservation_token_hash: MemorySha256V1Schema,
} as const;

export const MemoryPromotionReservationAckRequestV1Schema = Type.Object(
  {
    schema_version: Type.Literal("memory.promotion_reservation_ack.v1"),
    ...reservationIdentitySchema,
    promotion_revision_id: MemoryIdV1Schema,
    committed_at: MemoryTimestampV1Schema,
    idempotency_key: Type.String({
      minLength: 1,
      maxUtf8Bytes: 128,
    }),
    trace_id: MemoryIdV1Schema,
  },
  {
    $id: "urn:pai:memory:promotion-reservation-ack-request:v1",
    additionalProperties: false,
  },
);

export const MemoryPromotionReservationAckResponseV1Schema = Type.Object(
  {
    schema_version: Type.Literal("memory.promotion_reservation_ack.v1"),
    reservation_id: MemoryIdV1Schema,
    candidate_fact_id: MemoryIdV1Schema,
    fencing_generation: Type.Integer({
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    status: Type.Literal("committed"),
    promotion_revision_id: MemoryIdV1Schema,
    committed_at: MemoryTimestampV1Schema,
    duplicate_replayed: Type.Boolean(),
  },
  {
    $id: "urn:pai:memory:promotion-reservation-ack-response:v1",
    additionalProperties: false,
  },
);

export const MemoryPromotionReservationReleaseRequestV1Schema = Type.Object(
  {
    schema_version: Type.Literal("memory.promotion_reservation_release.v1"),
    ...reservationIdentitySchema,
    release_reason: releaseReasonSchema,
    released_at: MemoryTimestampV1Schema,
    idempotency_key: Type.String({
      minLength: 1,
      maxUtf8Bytes: 128,
    }),
    trace_id: MemoryIdV1Schema,
  },
  {
    $id: "urn:pai:memory:promotion-reservation-release-request:v1",
    additionalProperties: false,
  },
);

export const MemoryPromotionReservationReleaseResponseV1Schema = Type.Object(
  {
    schema_version: Type.Literal("memory.promotion_reservation_release.v1"),
    reservation_id: MemoryIdV1Schema,
    candidate_fact_id: MemoryIdV1Schema,
    fencing_generation: Type.Integer({
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    status: Type.Literal("released"),
    release_reason: releaseReasonSchema,
    released_at: MemoryTimestampV1Schema,
    duplicate_replayed: Type.Boolean(),
  },
  {
    $id: "urn:pai:memory:promotion-reservation-release-response:v1",
    additionalProperties: false,
  },
);

export const MemoryPrePromotionCheckV1Schema = Type.Union(
  [
    MemoryPrePromotionCheckRequestV1Schema,
    MemoryPrePromotionCheckResponseV1Schema,
    MemoryPrePromotionValidateRequestV1Schema,
    MemoryPromotionReservationV1Schema,
    MemoryPromotionReservationAckRequestV1Schema,
    MemoryPromotionReservationAckResponseV1Schema,
    MemoryPromotionReservationReleaseRequestV1Schema,
    MemoryPromotionReservationReleaseResponseV1Schema,
  ],
  { $id: "urn:pai:memory:pre-promotion-check:v1" },
);

export type MemoryPrePromotionCheckRequestV1 = Static<
  typeof MemoryPrePromotionCheckRequestV1Schema
>;
export type MemoryPrePromotionCheckResponseV1 = Static<
  typeof MemoryPrePromotionCheckResponseV1Schema
>;
export type MemoryPrePromotionValidateRequestV1 = Static<
  typeof MemoryPrePromotionValidateRequestV1Schema
>;
export type MemoryPromotionReservationV1 = Static<
  typeof MemoryPromotionReservationV1Schema
>;
export type MemoryPromotionReservationAckRequestV1 = Static<
  typeof MemoryPromotionReservationAckRequestV1Schema
>;
export type MemoryPromotionReservationAckResponseV1 = Static<
  typeof MemoryPromotionReservationAckResponseV1Schema
>;
export type MemoryPromotionReservationReleaseRequestV1 = Static<
  typeof MemoryPromotionReservationReleaseRequestV1Schema
>;
export type MemoryPromotionReservationReleaseResponseV1 = Static<
  typeof MemoryPromotionReservationReleaseResponseV1Schema
>;

export function assertMemoryPrePromotionCheckRequestSemanticBindingsV1(
  request: MemoryPrePromotionCheckRequestV1,
): void {
  assertUniqueIdsV1(request.memory_point_ids, "memory_point_ids");
}

export function assertMemoryPrePromotionCheckResponseSemanticBindingsV1(
  response: MemoryPrePromotionCheckResponseV1,
): void {
  assertTimestampOrderV1(
    response.checked_at,
    response.expires_at,
    "pre-promotion check",
  );
  if (Date.parse(response.expires_at) - Date.parse(response.checked_at) > 30_000) {
    throw new Error("pre-promotion check TTL exceeds 30 seconds");
  }
  const pointIds = response.points.map((point) => point.memory_point_id);
  assertUniqueIdsV1(pointIds, "points");
  const existingPoints = response.points.filter((point) => point.exists);
  for (const point of response.points) {
    if (!point.exists) continue;
    const expired =
      point.evidence_valid_until !== null &&
      Date.parse(point.evidence_valid_until) <=
        Date.parse(response.checked_at);
    if (point.expired !== expired) {
      throw new Error(
        `pre-promotion point ${point.memory_point_id} expiry mismatch`,
      );
    }
    if (
      response.required_checks.includes("not_expired") &&
      point.expired !== point.blocking_reasons.includes("evidence_expired")
    ) {
      throw new Error(
        `pre-promotion point ${point.memory_point_id} evidence_expired reason mismatch`,
      );
    }
  }
  const activeCount = existingPoints.filter(
    (point) => point.status === "active",
  ).length;
  const independentTriggerProcessCount = new Set(
    existingPoints.map((point) => point.source_trigger_process_id),
  ).size;
  const hasUserExplicitConfirmation = existingPoints.some(
    (point) => point.user_explicit_confirmation,
  );
  if (
    response.summary.active_count !== activeCount ||
    response.summary.independent_trigger_process_count !==
      independentTriggerProcessCount ||
    response.summary.has_user_explicit_confirmation !==
      hasUserExplicitConfirmation
  ) {
    throw new Error("pre-promotion summary counters mismatch");
  }
  const reasons = new Set(
    response.points.flatMap((point) => point.blocking_reasons),
  );
  const summaryReasons = new Set(response.summary.blocking_reasons);
  const aggregateOnlyReasons = new Set([
    "insufficient_independent_sources",
    "user_confirmation_missing",
    "policy_mismatch",
  ]);
  if (
    [...reasons].some((reason) => !summaryReasons.has(reason)) ||
    [...summaryReasons].some(
      (reason) =>
        !reasons.has(reason) && !aggregateOnlyReasons.has(reason),
    )
  ) {
    throw new Error("pre-promotion blocking reason summary mismatch");
  }
  if (
    (response.overall_result === "passed") !==
    (summaryReasons.size === 0)
  ) {
    throw new Error("pre-promotion overall result mismatch");
  }
}

export function assertMemoryPrePromotionValidateRequestSemanticBindingsV1(
  request: MemoryPrePromotionValidateRequestV1,
): void {
  assertUniqueIdsV1(
    request.expected_point_versions.map((point) => point.memory_point_id),
    "expected_point_versions",
  );
  assertUniqueIdsV1(
    request.expected_conflict_versions.map(
      (conflict) => conflict.conflict_id,
    ),
    "expected_conflict_versions",
  );
}

export function assertMemoryPromotionReservationSemanticBindingsV1(
  reservation: MemoryPromotionReservationV1,
): void {
  assertTimestampOrderV1(
    reservation.reserved_at,
    reservation.expires_at,
    "promotion reservation",
  );
  const ttl =
    Date.parse(reservation.expires_at) - Date.parse(reservation.reserved_at);
  if (ttl <= 0 || ttl > 15_000) {
    throw new Error("promotion reservation TTL must be at most 15 seconds");
  }
  assertUniqueIdsV1(
    reservation.reserved_points.map((point) => point.memory_point_id),
    "reserved_points",
  );
  assertUniqueIdsV1(
    reservation.reserved_conflicts.map((entry) => entry.conflict_id),
    "reserved_conflicts",
  );
}

export function assertMemoryPromotionReservationAckRequestSemanticBindingsV1(
  request: MemoryPromotionReservationAckRequestV1,
): void {
  if (request.idempotency_key.trim().length === 0) {
    throw new Error("promotion reservation ack idempotency key is empty");
  }
}

export function assertMemoryPromotionReservationAckResponseSemanticBindingsV1(
  response: MemoryPromotionReservationAckResponseV1,
): void {
  if (response.status !== "committed") {
    throw new Error("promotion reservation ack must be committed");
  }
}

export function assertMemoryPromotionReservationReleaseRequestSemanticBindingsV1(
  request: MemoryPromotionReservationReleaseRequestV1,
): void {
  if (request.idempotency_key.trim().length === 0) {
    throw new Error("promotion reservation release idempotency key is empty");
  }
}

export function assertMemoryPromotionReservationReleaseResponseSemanticBindingsV1(
  response: MemoryPromotionReservationReleaseResponseV1,
): void {
  if (response.status !== "released") {
    throw new Error("promotion reservation release must be released");
  }
}
