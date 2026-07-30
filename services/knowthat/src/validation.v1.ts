import {
  EVIDENCE_REF_TYPES,
  type TypedEvidenceRefV1,
} from "@pai/contracts";

import {
  canonicalHashV1,
  canonicalJsonV1,
  snapshotCanonicalJsonV1,
} from "./canonical.v1.js";
import {
  KnowThatErrorV1,
  type KnowThatCandidateReviewRequestV1,
  type KnowThatCategoryV1,
  type KnowThatLinkageRecoveryRequestV1,
  type KnowThatQueryRequestV1,
  type KnowThatScopeV1,
  type KnowThatSourceEventV1,
  type KnowThatWriteBatchRequestV1,
  type KnowThatWriteItemV1,
} from "./knowthat-types.v1.js";

const CATEGORIES = new Set([
  "user_profile",
  "relationship_state",
  "world_state",
  "self_state",
  "project_fact",
  "preference",
  "rule",
]);
const SOURCES = new Set([
  "explicit_feedback",
  "super_user_explicit",
  "approved_artifact",
  "system_event_tool_result",
  "user_explicit",
  "developer_note",
  "agent_observation",
  "meta_inference",
]);
const RISK_LEVELS = new Set(["low", "medium", "high", "critical"]);
const EXPLICITNESS = new Set([
  "explicit_statement",
  "strong_implication",
  "weak_implication",
  "inferred",
]);
const EVIDENCE_PREFIXES = new Set(EVIDENCE_REF_TYPES);

function record(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return undefined;
  return value as Record<string, unknown>;
}

function exact(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  const keys = Object.keys(value);
  return (
    required.every((key) => Object.hasOwn(value, key)) &&
    keys.every((key) => required.includes(key) || optional.includes(key)) &&
    keys.length >= required.length
  );
}

function string(
  value: unknown,
  maxBytes = 256,
): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value &&
    Buffer.byteLength(value, "utf8") <= maxBytes &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

function timestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 20 &&
    value.length <= 35 &&
    Number.isFinite(Date.parse(value))
  );
}

function positive(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function scope(value: Record<string, unknown>): boolean {
  return (
    string(value.workspace_id) &&
    string(value.bot_id) &&
    string(value.owner_agent_id) &&
    (value.deployment_environment === "local" ||
      value.deployment_environment === "dev" ||
      value.deployment_environment === "staging" ||
      value.deployment_environment === "prod") &&
    (value.release_channel === "stable" ||
      value.release_channel === "canary")
  );
}

export function sameKnowThatScopeV1(
  left: KnowThatScopeV1,
  right: KnowThatScopeV1,
): boolean {
  return (
    left.workspace_id === right.workspace_id &&
    left.bot_id === right.bot_id &&
    left.owner_agent_id === right.owner_agent_id &&
    left.deployment_environment === right.deployment_environment &&
    left.release_channel === right.release_channel
  );
}

export function knowThatScopeFingerprintV1(
  value: KnowThatScopeV1,
): `sha256:${string}` {
  return canonicalHashV1({
    workspace_id: value.workspace_id,
    bot_id: value.bot_id,
    owner_agent_id: value.owner_agent_id,
    deployment_environment: value.deployment_environment,
    release_channel: value.release_channel,
  });
}

function fail(message: string, fieldPath?: string): never {
  throw new KnowThatErrorV1(
    "schema_validation_failed",
    message,
    false,
    fieldPath,
  );
}

function assertCanonicalInputV1(value: unknown, label: string): void {
  try {
    canonicalJsonV1(value);
  } catch {
    fail(`${label} is not bounded canonical JSON`);
  }
}

function evidenceRef(value: unknown): value is TypedEvidenceRefV1 {
  if (!string(value, 2_048)) return false;
  const separator = value.indexOf(":");
  return (
    separator > 0 &&
    separator < value.length - 1 &&
    EVIDENCE_PREFIXES.has(value.slice(0, separator) as never)
  );
}

function parseItem(value: unknown, index: number): KnowThatWriteItemV1 {
  const item = record(value);
  const path = `/items/${index}`;
  const required = [
    "client_item_id",
    "text",
    "subject",
    "predicate",
    "object",
    "category",
    "proposed_status",
    "direct_active_hint",
    "risk_level",
    "explicitness",
    "confidence",
    "source",
    "source_ref",
    "evidence_refs",
    "evidence_pending",
  ];
  const optional = [
    "semantic_key_candidate",
    "direct_active_reason",
    "valid_from",
    "valid_until",
    "evidence_pending_reason",
  ];
  if (item === undefined || !exact(item, required, optional)) {
    fail("KnowThat write item shape is invalid", path);
  }
  if (
    !string(item.client_item_id) ||
    !string(item.text, 16_384) ||
    !string(item.subject, 4_096) ||
    !string(item.predicate, 4_096) ||
    !string(item.object, 4_096) ||
    !CATEGORIES.has(item.category as string) ||
    (item.semantic_key_candidate !== undefined &&
      !string(item.semantic_key_candidate, 4_096)) ||
    (item.proposed_status !== "candidate" &&
      item.proposed_status !== "active") ||
    typeof item.direct_active_hint !== "boolean" ||
    (item.direct_active_reason !== undefined &&
      item.direct_active_reason !== "user_explicit" &&
      item.direct_active_reason !== "low_risk" &&
      item.direct_active_reason !== "multi_source" &&
      item.direct_active_reason !== "system_event") ||
    !RISK_LEVELS.has(item.risk_level as string) ||
    !EXPLICITNESS.has(item.explicitness as string) ||
    typeof item.confidence !== "number" ||
    !Number.isFinite(item.confidence) ||
    item.confidence < 0 ||
    item.confidence > 1 ||
    !SOURCES.has(item.source as string) ||
    !evidenceRef(item.source_ref) ||
    !Array.isArray(item.evidence_refs) ||
    item.evidence_refs.length < 1 ||
    item.evidence_refs.length > 64 ||
    new Set(item.evidence_refs).size !== item.evidence_refs.length ||
    !item.evidence_refs.every(evidenceRef) ||
    !item.evidence_refs.includes(item.source_ref) ||
    (item.valid_from !== undefined && !timestamp(item.valid_from)) ||
    (item.valid_until !== undefined && !timestamp(item.valid_until)) ||
    (item.valid_from !== undefined &&
      item.valid_until !== undefined &&
      Date.parse(item.valid_from) >= Date.parse(item.valid_until)) ||
    typeof item.evidence_pending !== "boolean" ||
    (item.evidence_pending_reason !== undefined &&
      !string(item.evidence_pending_reason, 4_096))
  ) {
    fail("KnowThat write item value is invalid", path);
  }
  if (
    (item.direct_active_hint && item.direct_active_reason === undefined) ||
    (item.proposed_status === "candidate" && item.direct_active_hint) ||
    (item.evidence_pending &&
      (item.evidence_pending_reason === undefined ||
        item.proposed_status !== "candidate" ||
        item.direct_active_hint)) ||
    (!item.evidence_pending && item.evidence_pending_reason !== undefined)
  ) {
    fail("KnowThat write item conditional binding is invalid", path);
  }
  if (Buffer.byteLength(canonicalJsonV1(item), "utf8") > 65_536) {
    throw new KnowThatErrorV1(
      "item_too_large",
      "KnowThat write item exceeds 64 KiB",
      false,
      path,
    );
  }
  return snapshotCanonicalJsonV1(item) as unknown as KnowThatWriteItemV1;
}

const SCOPE_KEYS = [
  "workspace_id",
  "bot_id",
  "owner_agent_id",
  "deployment_environment",
  "release_channel",
] as const;

export function parseKnowThatWriteBatchV1(
  value: unknown,
): KnowThatWriteBatchRequestV1 {
  assertCanonicalInputV1(value, "KnowThat write batch");
  const request = record(value);
  if (request === undefined) {
    fail("KnowThat write batch is invalid");
  }
  if (Buffer.byteLength(canonicalJsonV1(request), "utf8") > 2_097_152) {
    throw new KnowThatErrorV1(
      "payload_too_large",
      "KnowThat write batch exceeds 2 MiB",
      false,
    );
  }
  const required = [
    "schema_version",
    ...SCOPE_KEYS,
    "trigger_process_id",
    "source_meta_job_id",
    "idempotency_key",
    "trace_id",
    "items",
  ];
  if (
    request === undefined ||
    !exact(request, required) ||
    request.schema_version !== "knowthat.write_batch.v1" ||
    !scope(request) ||
    !string(request.trigger_process_id) ||
    !string(request.source_meta_job_id) ||
    !string(request.idempotency_key, 128) ||
    !string(request.trace_id) ||
    !Array.isArray(request.items) ||
    request.items.length < 1
  ) {
    fail("KnowThat write batch is invalid");
  }
  if (request.items.length > 100) {
    throw new KnowThatErrorV1(
      "too_many_items",
      "KnowThat write batch exceeds 100 items",
      false,
    );
  }
  const items = request.items.map(parseItem);
  if (new Set(items.map((item) => item.client_item_id)).size !== items.length) {
    fail("KnowThat client_item_id values must be unique", "/items");
  }
  return snapshotCanonicalJsonV1({
    ...request,
    items,
  }) as unknown as KnowThatWriteBatchRequestV1;
}

export function knowThatWriteRequestHashV1(
  request: KnowThatWriteBatchRequestV1,
): `sha256:${string}` {
  const { trace_id: _traceId, ...semantic } = request;
  return canonicalHashV1(semantic);
}

export function parseKnowThatQueryV1(value: unknown): KnowThatQueryRequestV1 {
  assertCanonicalInputV1(value, "KnowThat query request");
  const request = record(value);
  if (
    request === undefined ||
    request.schema_version !== "knowthat_query.v1" ||
    !scope(request)
  ) {
    fail("KnowThat query request is invalid");
  }
  const next = Object.hasOwn(request, "snapshot_token");
  const required = next
    ? ["schema_version", ...SCOPE_KEYS, "snapshot_token", "cursor"]
    : ["schema_version", ...SCOPE_KEYS];
  const optional = next ? ["limit"] : ["categories", "query", "limit"];
  if (!exact(request, required, optional)) {
    fail("KnowThat query request shape is invalid");
  }
  if (
    (request.limit !== undefined &&
      (!positive(request.limit) || (request.limit as number) > 200)) ||
    (next &&
      (!string(request.snapshot_token, 8_192) ||
        !string(request.cursor, 8_192))) ||
    (!next &&
      ((request.categories !== undefined &&
        (!Array.isArray(request.categories) ||
          request.categories.length > CATEGORIES.size ||
          new Set(request.categories).size !== request.categories.length ||
          !request.categories.every((entry) =>
            CATEGORIES.has(entry as string),
          ))) ||
        (request.query !== undefined && !string(request.query, 4_096))))
  ) {
    fail("KnowThat query request value is invalid");
  }
  return snapshotCanonicalJsonV1(
    request,
  ) as unknown as KnowThatQueryRequestV1;
}

function parseSourceEvent(
  value: unknown,
  expectedScope: KnowThatScopeV1,
): KnowThatSourceEventV1 {
  const event = record(value);
  const required = [
    ...SCOPE_KEYS,
    "source",
    "event_id",
    "idempotency_key",
    "payload_hash",
    "semantic_hash",
    "scope_fingerprint",
    "payload",
  ];
  if (
    event === undefined ||
    !exact(event, required) ||
    !scope(event) ||
    !sameKnowThatScopeV1(expectedScope, event as unknown as KnowThatScopeV1) ||
    event.source !== "meta_cognition" ||
    !string(event.event_id) ||
    !string(event.idempotency_key) ||
    typeof event.payload_hash !== "string" ||
    typeof event.semantic_hash !== "string" ||
    typeof event.scope_fingerprint !== "string" ||
    record(event.payload) === undefined ||
    event.payload_hash !== canonicalHashV1(event.payload) ||
    event.semantic_hash !==
      canonicalHashV1({
        source: event.source,
        idempotency_key: event.idempotency_key,
        payload: event.payload,
      }) ||
    event.scope_fingerprint !== knowThatScopeFingerprintV1(expectedScope)
  ) {
    fail("KnowThat review source event is invalid", "/source_event");
  }
  return snapshotCanonicalJsonV1(
    event,
  ) as unknown as KnowThatSourceEventV1;
}

export function parseKnowThatCandidateReviewV1(
  candidateId: string,
  value: unknown,
): KnowThatCandidateReviewRequestV1 {
  if (!string(candidateId)) fail("KnowThat candidate id is invalid");
  assertCanonicalInputV1(value, "KnowThat candidate review request");
  const request = record(value);
  const required = [
    "schema_version",
    ...SCOPE_KEYS,
    "candidate_id",
    "suggestion_id",
    "source_meta_job_id",
    "target_candidate_version",
    "suggested_action",
    "reason",
    "new_evidence_refs",
    "risk_level",
    "confidence_delta",
    "validation_profile",
    "idempotency_key",
    "trace_id",
    "source_event",
  ];
  if (
    request === undefined ||
    !exact(request, required) ||
    request.schema_version !== "knowthat.candidate_review.v1" ||
    !scope(request) ||
    request.candidate_id !== candidateId ||
    !string(request.suggestion_id) ||
    !string(request.source_meta_job_id) ||
    !positive(request.target_candidate_version) ||
    (request.suggested_action !== "promote" &&
      request.suggested_action !== "keep_candidate" &&
      request.suggested_action !== "reject" &&
      request.suggested_action !== "expire" &&
      request.suggested_action !== "request_feedback") ||
    !string(request.reason, 4_096) ||
    !Array.isArray(request.new_evidence_refs) ||
    request.new_evidence_refs.length > 64 ||
    new Set(request.new_evidence_refs).size !==
      request.new_evidence_refs.length ||
    !request.new_evidence_refs.every(evidenceRef) ||
    !RISK_LEVELS.has(request.risk_level as string) ||
    typeof request.confidence_delta !== "number" ||
    !Number.isFinite(request.confidence_delta) ||
    request.confidence_delta < -1 ||
    request.confidence_delta > 1 ||
    (request.validation_profile !== "standard" &&
      request.validation_profile !== "confirmed_low_risk") ||
    !string(request.idempotency_key, 512) ||
    request.idempotency_key !==
      `candidate_review:${request.source_meta_job_id as string}:${request.suggestion_id as string}` ||
    !string(request.trace_id)
  ) {
    fail("KnowThat candidate review request is invalid");
  }
  const typedScope = request as unknown as KnowThatScopeV1;
  const sourceEvent = parseSourceEvent(request.source_event, typedScope);
  if (
    sourceEvent.payload.candidate_id !== candidateId ||
    sourceEvent.payload.suggestion_id !== request.suggestion_id ||
    sourceEvent.payload.source_meta_job_id !== request.source_meta_job_id
  ) {
    fail("KnowThat source event is not bound to the review", "/source_event");
  }
  return snapshotCanonicalJsonV1({
    ...request,
    source_event: sourceEvent,
  }) as unknown as KnowThatCandidateReviewRequestV1;
}

export function knowThatReviewRequestHashV1(
  candidateId: string,
  request: KnowThatCandidateReviewRequestV1,
): `sha256:${string}` {
  if (request.candidate_id !== candidateId) {
    fail("KnowThat candidate id is not bound to the review");
  }
  const { trace_id: _traceId, ...semantic } = request;
  return canonicalHashV1(semantic);
}

export function parseKnowThatRecoveryV1(
  linkageJobId: string,
  value: unknown,
): KnowThatLinkageRecoveryRequestV1 {
  assertCanonicalInputV1(value, "KnowThat linkage recovery request");
  const request = record(value);
  const required = [
    "schema_version",
    ...SCOPE_KEYS,
    "linkage_job_id",
    "expected_job_version",
    "recovery_action",
    "reason",
    "idempotency_key",
    "request_hash",
    "trace_id",
  ];
  if (
    !string(linkageJobId) ||
    request === undefined ||
    !exact(request, required) ||
    request.schema_version !== "knowthat.linkage_recovery.v1" ||
    !scope(request) ||
    request.linkage_job_id !== linkageJobId ||
    !positive(request.expected_job_version) ||
    (request.recovery_action !== "replay" &&
      request.recovery_action !== "repair") ||
    !string(request.reason, 4_096) ||
    !string(request.idempotency_key, 512) ||
    typeof request.request_hash !== "string" ||
    !string(request.trace_id)
  ) {
    fail("KnowThat linkage recovery request is invalid");
  }
  const semantic = {
    schema_version: request.schema_version,
    ...Object.fromEntries(SCOPE_KEYS.map((key) => [key, request[key]])),
    linkage_job_id: request.linkage_job_id,
    expected_job_version: request.expected_job_version,
    recovery_action: request.recovery_action,
    reason: request.reason,
    idempotency_key: request.idempotency_key,
  };
  if (request.request_hash !== canonicalHashV1(semantic)) {
    fail("KnowThat linkage recovery request hash is invalid", "/request_hash");
  }
  return snapshotCanonicalJsonV1(
    request,
  ) as unknown as KnowThatLinkageRecoveryRequestV1;
}
