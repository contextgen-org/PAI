import {
  MetaFeedbackAnswerRequestV1Schema,
  MetaFeedbackAnswerResponseV1Schema,
  MetaFeedbackRequestListResponseV1Schema,
  MetaSkillCandidateReviewRequestV1Schema,
  MetaSkillCandidateReviewResponseV1Schema,
  MetaSnapshotRepairRequestV1Schema,
  MetaSnapshotRepairResponseV1Schema,
  SkillCandidateApplicationRequestV1Schema,
  assertMetaFeedbackAnswerPathBindingV1,
  assertMetaFeedbackRequestListResponseSemanticBindingsV1,
  assertMetaSkillCandidateReviewSemanticBindingsV1,
  assertMetaSnapshotRepairRequestSemanticBindingsV1,
  type MetaFeedbackAnswerRequestV1,
  type MetaFeedbackAnswerResponseV1,
  type MetaFeedbackRequestListResponseV1,
  type MetaSkillCandidateReviewRequestV1,
  type MetaSkillCandidateReviewResponseV1,
  type MetaSnapshotRepairRequestV1,
  type MetaSnapshotRepairResponseV1,
  type SkillCandidateApplicationRequestV1,
} from "@pai/contracts";
import type { VerifiedOwnerPostgresCompositionV1 } from "@pai/persistence";
import { Value } from "@sinclair/typebox/value";

import {
  assertBoundedMetaJsonV1,
  sha256CanonicalV1,
  snapshotCanonicalJsonV1,
} from "../canonical.v1.js";
import {
  MetaOwnerOperationsErrorV1,
  type MetaOperationsPrincipalV1,
  type MetaOwnerOperationsApplicationV1,
} from "../meta-owner-operations.v1.js";
import type { MetaBotScopeV1 } from "../meta-types.v1.js";
import { META_COGNITION_REPOSITORY_CONTRACT_V1 } from "./permission-manifest.v1.js";

type CompositionV1 = Pick<
  VerifiedOwnerPostgresCompositionV1<typeof META_COGNITION_REPOSITORY_CONTRACT_V1>,
  "postgres" | "unit_of_work" | "checkReadiness"
>;
type RowV1 = Readonly<Record<string, unknown>>;

const REPAIRABLE_REASONS_V1 = new Set([
  "snapshot_missing",
  "snapshot_incomplete",
  "snapshot_schema_incompatible",
  "snapshot_hash_mismatch",
  "artifact_unreadable",
  "redaction_incomplete",
]);

function failV1(
  code:
    | "invalid_request"
    | "authorization_scope_mismatch"
    | "not_found"
    | "idempotency_conflict"
    | "stale_fence"
    | "dependency_unavailable",
  message: string = code,
): never {
  throw new MetaOwnerOperationsErrorV1(code, message);
}

function textV1(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    failV1("dependency_unavailable", `Meta PostgreSQL ${label} drifted`);
  }
  return value;
}

function nullableTextV1(value: unknown, label: string): string | null {
  return value === null ? null : textV1(value, label);
}

function integerV1(value: unknown, label: string, minimum = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum) {
    failV1("dependency_unavailable", `Meta PostgreSQL ${label} drifted`);
  }
  return parsed;
}

function timestampV1(value: unknown, label: string): string {
  const date = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(date.getTime())) {
    failV1("dependency_unavailable", `Meta PostgreSQL ${label} drifted`);
  }
  return date.toISOString();
}

function jsonObjectV1(value: unknown, label: string): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    failV1("dependency_unavailable", `Meta PostgreSQL ${label} drifted`);
  }
  return value as Readonly<Record<string, unknown>>;
}

function jsonArrayV1(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    failV1("dependency_unavailable", `Meta PostgreSQL ${label} drifted`);
  }
  return value;
}

function hashV1(value: unknown, label: string): `sha256:${string}` {
  const hash = textV1(value, label);
  if (!/^sha256:[0-9a-f]{64}$/u.test(hash)) {
    failV1("dependency_unavailable", `Meta PostgreSQL ${label} drifted`);
  }
  return hash as `sha256:${string}`;
}

function scopeFromRowV1(row: RowV1): MetaBotScopeV1 {
  const environment = textV1(row.deployment_environment, "deployment_environment");
  const channel = textV1(row.release_channel, "release_channel");
  if (
    !["local", "dev", "staging", "prod"].includes(environment) ||
    !["stable", "canary"].includes(channel)
  ) {
    failV1("dependency_unavailable", "Meta PostgreSQL scope drifted");
  }
  return Object.freeze({
    workspace_id: textV1(row.workspace_id, "workspace_id"),
    bot_id: textV1(row.bot_id, "bot_id"),
    owner_agent_id: textV1(row.owner_agent_id, "owner_agent_id"),
    deployment_environment: environment as MetaBotScopeV1["deployment_environment"],
    release_channel: channel as MetaBotScopeV1["release_channel"],
  });
}

function sameScopeV1(left: MetaBotScopeV1, right: MetaBotScopeV1): boolean {
  return (
    left.workspace_id === right.workspace_id &&
    left.bot_id === right.bot_id &&
    left.owner_agent_id === right.owner_agent_id &&
    left.deployment_environment === right.deployment_environment &&
    left.release_channel === right.release_channel
  );
}

function requirePrincipalV1(
  principal: MetaOperationsPrincipalV1,
  caller: MetaOperationsPrincipalV1["caller"],
  capability: string,
  scope: MetaBotScopeV1,
): void {
  if (
    principal.caller !== caller ||
    !principal.capabilities.includes(capability) ||
    !sameScopeV1(principal.scope, scope)
  ) {
    failV1("authorization_scope_mismatch");
  }
}

function inputV1<T>(
  value: unknown,
  schema: Parameters<typeof Value.Check>[0],
  message: string,
): T {
  try {
    assertBoundedMetaJsonV1(value);
    const snapshot = snapshotCanonicalJsonV1(value);
    if (!Value.Check(schema, snapshot)) failV1("invalid_request", message);
    return snapshot as T;
  } catch (error) {
    if (error instanceof MetaOwnerOperationsErrorV1) throw error;
    failV1("invalid_request", message);
  }
}

function requestHashV1(value: Readonly<Record<string, unknown>>): `sha256:${string}` {
  const { trace_id: _traceId, ...semantic } = value;
  return sha256CanonicalV1(semantic);
}

function translateWriterErrorV1(error: unknown): never {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : "";
  if (code === "23505") failV1("idempotency_conflict");
  if (code === "40001") failV1("stale_fence");
  failV1("dependency_unavailable", "Meta owner writer failed");
}

function feedbackCursorFingerprintV1(
  principal: MetaOperationsPrincipalV1,
  assignee: string,
): string {
  return sha256CanonicalV1({
    schema_version: "meta_feedback_cursor.v1",
    ...principal.scope,
    assignee,
    status: "open",
  }).slice(7, 23);
}

function decodeCursorV1(value: string | undefined, fingerprint: string): string | null {
  if (value === undefined) return null;
  const [prefix, actualFingerprint, encodedId, extra] = value.split(".");
  if (prefix !== "mfc1" || actualFingerprint !== fingerprint || encodedId === undefined || encodedId.length === 0 || extra !== undefined) {
    failV1("invalid_request", "feedback cursor is invalid");
  }
  const decoded = Buffer.from(encodedId, "base64url").toString();
  if (decoded.length === 0 || decoded.length > 512 || Buffer.from(decoded).toString("base64url") !== encodedId) {
    failV1("invalid_request", "feedback cursor is invalid");
  }
  return decoded;
}

function repairAuditIdV1(repairId: string): string {
  return `meta_snapshot_repair:${repairId}`;
}

function repairReceiptV1(value: unknown, requestHash: string): MetaSnapshotRepairResponseV1 | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const receipt = value as Readonly<Record<string, unknown>>;
  if (receipt.request_hash !== requestHash || !Value.Check(MetaSnapshotRepairResponseV1Schema, receipt.response)) {
    return undefined;
  }
  return receipt.response as MetaSnapshotRepairResponseV1;
}

function candidateEvidenceV1(row: RowV1): readonly Readonly<{ ref: string; hash: `sha256:${string}` }>[] {
  const values = jsonArrayV1(row.evidence_artifacts, "skill_candidates.evidence_artifacts");
  const refs = jsonArrayV1(row.evidence_refs, "skill_candidates.evidence_refs").map(
    (value) => textV1(value, "skill_candidates.evidence_refs[]"),
  );
  const bindings = values.map((value, index) => {
    const binding = jsonObjectV1(value, "skill_candidates.evidence_artifacts[]");
    const ref = textV1(binding.ref, "skill_candidates.evidence_artifacts[].ref");
    if (refs[index] !== ref) {
      failV1("dependency_unavailable", "candidate evidence ordering drifted");
    }
    return Object.freeze({ ref, hash: hashV1(binding.hash, "skill_candidates.evidence_artifacts[].hash") });
  });
  if (bindings.length === 0 || bindings.length !== refs.length) {
    failV1("dependency_unavailable", "candidate evidence binding drifted");
  }
  return Object.freeze(bindings);
}

function candidateProposalRefV1(row: RowV1): string {
  return textV1(
    jsonObjectV1(row.proposal_payload, "skill_candidates.proposal_payload").proposal_ref,
    "skill_candidates.proposal_payload.proposal_ref",
  );
}

export function createPostgresMetaOwnerOperationsApplicationV1(
  composition: CompositionV1,
): MetaOwnerOperationsApplicationV1 {
  const readFeedback = async (id: string): Promise<RowV1 | undefined> => {
    const result = await composition.postgres.query<RowV1>(
      "SELECT id, workspace_id, bot_id, owner_agent_id, deployment_environment, release_channel, source_kind, request_hash, question_payload_ref, status, answered_by_trigger_id, answer_payload, target_actor_ref, delivery_mode, delivery_status, delivery_version, expires_at, created_at, updated_at FROM meta_cognition.feedback_requests WHERE id = $1",
      [id],
    );
    return result.rows[0];
  };

  const application: MetaOwnerOperationsApplicationV1 = {
    async answerFeedback(principal, pathFeedbackRequestId, value) {
      const request = inputV1<MetaFeedbackAnswerRequestV1>(value, MetaFeedbackAnswerRequestV1Schema, "feedback answer schema mismatch");
      try {
        assertMetaFeedbackAnswerPathBindingV1(pathFeedbackRequestId, request);
      } catch {
        failV1("invalid_request", "feedback answer path/body mismatch");
      }
      const row = await readFeedback(request.feedback_request_id);
      if (row === undefined) failV1("not_found");
      const scope = scopeFromRowV1(row);
      requirePrincipalV1(principal, "trigger_processor", "meta.feedback.answer", scope);
      if (request.bot_id !== scope.bot_id) failV1("authorization_scope_mismatch");
      const status = textV1(row.status, "feedback_requests.status");
      const now = new Date().toISOString();
      if (status === "answered") {
        const answeredBy = nullableTextV1(row.answered_by_trigger_id, "feedback_requests.answered_by_trigger_id");
        const answer = jsonObjectV1(row.answer_payload, "feedback_requests.answer_payload");
        const priorHash = requestHashV1({
          schema_version: "meta_feedback_answer.v1",
          feedback_request_id: request.feedback_request_id,
          trigger_id: answeredBy ?? "",
          bot_id: request.bot_id,
          answer_payload: answer,
        });
        if (answeredBy === request.trigger_id && priorHash === requestHashV1(request)) {
          return { feedback_request_id: request.feedback_request_id, status: "answered", answered_by_trigger_id: request.trigger_id, duplicate_replayed: true };
        }
        return { feedback_request_id: request.feedback_request_id, status: "answered", code: "idempotency_conflict", answered_by_trigger_id: answeredBy, duplicate_replayed: false };
      }
      const expired = Date.parse(timestampV1(row.expires_at, "feedback_requests.expires_at")) <= Date.now();
      const nextStatus = expired ? "expired" : status === "open" ? "answered" : status;
      if (nextStatus !== "answered" && nextStatus !== "expired") {
        return { feedback_request_id: request.feedback_request_id, status: nextStatus as "cancelled" | "superseded", code: "feedback_request_closed", answered_by_trigger_id: nullableTextV1(row.answered_by_trigger_id, "feedback_requests.answered_by_trigger_id"), duplicate_replayed: false };
      }
      try {
        await composition.unit_of_work.withTransaction(
          { operation: "meta_feedback_answer", idempotency_key: request.feedback_request_id, trace_id: request.trace_id, isolation: "serializable", retry: "serialization_failures" },
          async (transaction, { owner }) => owner.executeWriter(transaction, {
            writer: "transition_feedback_request_v1",
            arguments: {
              p_request_id: request.feedback_request_id,
              p_expected_status: status,
              p_expected_delivery_version: String(integerV1(row.delivery_version, "feedback_requests.delivery_version", 1)),
              p_expected_updated_at: timestampV1(row.updated_at, "feedback_requests.updated_at"),
              p_next_status: nextStatus,
              p_feedback: {
                feedback_requests: {
                  // p_request_hash is a writer attestation input, while this
                  // column belongs to the original feedback source. Preserve
                  // it explicitly so answering a meta-job row cannot violate
                  // the source-kind CHECK by accidentally writing the answer
                  // request hash into it.
                  request_hash: row.request_hash,
                  status: nextStatus,
                  ...(nextStatus === "answered" ? { answered_by_trigger_id: request.trigger_id, answer_payload: request.answer_payload } : {}),
                  updated_at: now,
                },
                meta_job_audit_logs: [],
                meta_event_outbox: [],
              },
              p_request_hash: requestHashV1(request),
              p_trace_id: request.trace_id,
            }, expected_rows: 1,
          }),
        );
      } catch (error) { translateWriterErrorV1(error); }
      return nextStatus === "answered"
        ? { feedback_request_id: request.feedback_request_id, status: "answered", answered_by_trigger_id: request.trigger_id, duplicate_replayed: false }
        : { feedback_request_id: request.feedback_request_id, status: "expired", code: "feedback_request_closed", answered_by_trigger_id: null, duplicate_replayed: false };
    },

    async listFeedback(principal, query) {
      let normalized: Readonly<Record<string, unknown>>;
      try {
        assertBoundedMetaJsonV1(query);
        normalized = snapshotCanonicalJsonV1(query) as Readonly<Record<string, unknown>>;
      } catch {
        failV1("invalid_request", "feedback list query is invalid");
      }
      if (normalized.status !== "open" || typeof normalized.assignee !== "string" || normalized.assignee.length === 0) failV1("invalid_request", "feedback list query is invalid");
      requirePrincipalV1(principal, "observation_gateway", "meta.feedback_requests.read", principal.scope);
      if (principal.principal_id !== normalized.assignee && !principal.capabilities.includes("meta.feedback_requests.read_all")) failV1("authorization_scope_mismatch");
      const limit = normalized.limit === undefined ? 50 : integerV1(normalized.limit, "feedback list limit", 1);
      if (limit > 200) failV1("invalid_request", "feedback list limit is invalid");
      const fingerprint = feedbackCursorFingerprintV1(principal, normalized.assignee);
      const afterId = decodeCursorV1(typeof normalized.cursor === "string" ? normalized.cursor : undefined, fingerprint);
      const result = await composition.postgres.query<RowV1>(
        "SELECT id, bot_id, dedupe_scope_ref, question_key, question_payload_ref, target_actor_ref, delivery_mode, delivery_status, created_at, expires_at FROM meta_cognition.feedback_requests WHERE workspace_id = $1 AND bot_id = $2 AND owner_agent_id = $3 AND deployment_environment = $4 AND release_channel = $5 AND status = 'open' AND target_actor_ref = $6 AND expires_at > clock_timestamp() ORDER BY created_at ASC, id ASC",
        [principal.scope.workspace_id, principal.scope.bot_id, principal.scope.owner_agent_id, principal.scope.deployment_environment, principal.scope.release_channel, normalized.assignee],
      );
      const rows = result.rows;
      const offset = afterId === null ? 0 : rows.findIndex(({ id }) => id === afterId) + 1;
      if (afterId !== null && offset === 0) failV1("invalid_request", "feedback cursor row no longer exists");
      const selected = rows.slice(offset, offset + limit);
      const last = selected.at(-1);
      const response: MetaFeedbackRequestListResponseV1 = {
        assignee: normalized.assignee,
        items: selected.map((row) => ({
          feedback_request_id: textV1(row.id, "feedback_requests.id"), bot_id: textV1(row.bot_id, "feedback_requests.bot_id"), dedupe_scope_ref: { kind: textV1(row.dedupe_scope_ref, "feedback_requests.dedupe_scope_ref").split(":", 1)[0] as "conflict" | "candidate" | "schedule", ref: textV1(row.dedupe_scope_ref, "feedback_requests.dedupe_scope_ref") }, question_key: textV1(row.question_key, "feedback_requests.question_key"), question_ref: textV1(row.question_payload_ref, "feedback_requests.question_payload_ref"), status: "open", assignee: textV1(row.target_actor_ref, "feedback_requests.target_actor_ref"), delivery_mode: textV1(row.delivery_mode, "feedback_requests.delivery_mode") as "proactive" | "internal_queue", delivery_status: textV1(row.delivery_status, "feedback_requests.delivery_status") as MetaFeedbackRequestListResponseV1["items"][number]["delivery_status"], created_at: timestampV1(row.created_at, "feedback_requests.created_at"), expires_at: timestampV1(row.expires_at, "feedback_requests.expires_at"),
        })),
        next_cursor: offset + selected.length < rows.length && last !== undefined ? `mfc1.${fingerprint}.${Buffer.from(textV1(last.id, "feedback_requests.id")).toString("base64url")}` : null,
        has_more: offset + selected.length < rows.length,
        trace_id: typeof normalized.trace_id === "string" ? normalized.trace_id : "trace_feedback_list",
      };
      if (!Value.Check(MetaFeedbackRequestListResponseV1Schema, response)) failV1("dependency_unavailable", "feedback list response drifted");
      assertMetaFeedbackRequestListResponseSemanticBindingsV1(response);
      return response;
    },

    async repairSnapshot(principal, pathMetaJobId, value) {
      const request = inputV1<MetaSnapshotRepairRequestV1>(value, MetaSnapshotRepairRequestV1Schema, "snapshot repair schema mismatch");
      if (request.meta_job_id !== pathMetaJobId) failV1("invalid_request", "snapshot repair path/body mismatch");
      try { assertMetaSnapshotRepairRequestSemanticBindingsV1(request); } catch { failV1("invalid_request", "snapshot repair semantic mismatch"); }
      const requestHash = requestHashV1(request);
      const receipt = await composition.postgres.query<RowV1>("SELECT error FROM meta_cognition.meta_job_audit_logs WHERE id = $1", [repairAuditIdV1(request.repair_id)]);
      if (receipt.rows[0] !== undefined) {
        const prior = repairReceiptV1(receipt.rows[0].error, requestHash);
        if (prior === undefined) failV1("idempotency_conflict");
        return { ...prior, duplicate_replayed: true } as MetaSnapshotRepairResponseV1;
      }
      const jobResult = await composition.postgres.query<RowV1>(
        "SELECT id, trigger_process_id, workspace_id, bot_id, owner_agent_id, deployment_environment, release_channel, snapshot_ref, snapshot_version, snapshot_hash, snapshot_retention_until, request_hash, status, input_revision, updated_at FROM meta_cognition.meta_jobs WHERE id = $1",
        [request.meta_job_id],
      );
      const job = jobResult.rows[0];
      if (job === undefined) failV1("not_found");
      const scope = scopeFromRowV1(job);
      requirePrincipalV1(principal, "trigger_processor", "meta.snapshot_repair", scope);
      const revision = integerV1(job.input_revision, "meta_jobs.input_revision", 1);
      const status = textV1(job.status, "meta_jobs.status");
      const repairable = REPAIRABLE_REASONS_V1.has(request.reason_code) &&
        textV1(job.trigger_process_id, "meta_jobs.trigger_process_id") === request.trigger_process_id &&
        textV1(job.snapshot_ref, "meta_jobs.snapshot_ref") === request.previous_snapshot_ref &&
        integerV1(job.snapshot_version, "meta_jobs.snapshot_version", 1) === request.previous_snapshot_version &&
        hashV1(job.snapshot_hash, "meta_jobs.snapshot_hash") === request.previous_snapshot_hash &&
        ["queued", "retry_wait", "failed"].includes(status);
      const now = new Date().toISOString();
      const response: MetaSnapshotRepairResponseV1 = repairable
        ? { job_id: request.meta_job_id, repair_id: request.repair_id, input_revision: revision + 1, snapshot_version: request.next_snapshot_version, status: "accepted", next_retry_at: now, accepted_at: now, duplicate_replayed: false }
        : { job_id: request.meta_job_id, repair_id: request.repair_id, input_revision: revision, snapshot_version: integerV1(job.snapshot_version, "meta_jobs.snapshot_version", 1), status: "rejected", next_retry_at: null, accepted_at: null, reason_code: "snapshot_repair_not_allowed", duplicate_replayed: false };
      const audit = { id: repairAuditIdV1(request.repair_id), meta_job_id: request.meta_job_id, previous_status: status, next_status: repairable ? "retry_wait" : status, previous_recovery_state: null, next_recovery_state: null, owner_id: principal.principal_id, actor: "trigger_processor", trace_id: request.trace_id, scope, expanded_fields: [], source_kind: "system", source_service: "trigger_processor", source_ref: request.repair_id, audit_action: "snapshot_repair_receipt", reason_code: request.reason_code, reason: requestHash, error: { request_hash: requestHash, response }, evidence_refs: [], schema_version: "meta_job_audit.v1", created_at: now };
      try {
        await composition.unit_of_work.withTransaction(
          { operation: "meta_snapshot_repair", idempotency_key: request.repair_id, trace_id: request.trace_id, isolation: "serializable", retry: "serialization_failures" },
          async (transaction, { owner }) => owner.executeWriter(transaction, {
            writer: "transition_meta_job_v1",
            arguments: { p_job_id: request.meta_job_id, p_expected_status: status, p_expected_input_revision: String(revision), p_expected_updated_at: timestampV1(job.updated_at, "meta_jobs.updated_at"), p_next_status: repairable ? "retry_wait" : status, p_result: { meta_jobs: repairable ? { snapshot_ref: request.next_snapshot_ref, snapshot_version: request.next_snapshot_version, snapshot_hash: request.next_snapshot_hash, snapshot_retention_until: request.snapshot_retention_until, request_hash: hashV1(job.request_hash, "meta_jobs.request_hash"), status: "retry_wait", lease_previous_status: null, next_retry_at: now, error: null, input_revision: revision + 1, updated_at: now } : { request_hash: hashV1(job.request_hash, "meta_jobs.request_hash"), updated_at: now }, meta_job_audit_logs: [audit], meta_event_outbox: [] }, p_request_hash: requestHash, p_trace_id: request.trace_id }, expected_rows: 1,
          }),
        );
      } catch (error) { translateWriterErrorV1(error); }
      return response;
    },

    async reviewSkillCandidate(principal, pathCandidateId, value) {
      const request = inputV1<MetaSkillCandidateReviewRequestV1>(value, MetaSkillCandidateReviewRequestV1Schema, "candidate review schema mismatch");
      if (request.candidate_id !== pathCandidateId || request.reviewer_principal_id !== principal.principal_id) failV1("authorization_scope_mismatch", "candidate review identity mismatch");
      const requestHash = requestHashV1(request);
      const existing = await composition.postgres.query<RowV1>("SELECT id, review_request_hash, review_response_payload FROM meta_cognition.skill_candidates WHERE review_idempotency_key = $1", [request.idempotency_key]);
      if (existing.rows[0] !== undefined) {
        const prior = existing.rows[0];
        if (prior.id !== request.candidate_id || prior.review_request_hash !== requestHash || !Value.Check(MetaSkillCandidateReviewResponseV1Schema, prior.review_response_payload)) failV1("idempotency_conflict");
        return { ...(prior.review_response_payload as MetaSkillCandidateReviewResponseV1), duplicate_replayed: true };
      }
      const result = await composition.postgres.query<RowV1>(
        "SELECT c.*, j.trigger_process_id FROM meta_cognition.skill_candidates c JOIN meta_cognition.meta_jobs j ON j.id = c.meta_job_id WHERE c.id = $1",
        [request.candidate_id],
      );
      const candidate = result.rows[0];
      if (candidate === undefined) failV1("not_found");
      const scope = scopeFromRowV1(candidate);
      requirePrincipalV1(principal, "meta_cognition", "meta.skill_candidate.review", scope);
      const status = textV1(candidate.status, "skill_candidates.status");
      const reviewVersion = integerV1(candidate.review_version, "skill_candidates.review_version");
      const updatedAt = timestampV1(candidate.updated_at, "skill_candidates.updated_at");
      if (status !== request.expected_status || reviewVersion !== request.expected_review_version || updatedAt !== request.expected_updated_at) failV1("stale_fence");
      if (reviewVersion >= Number.MAX_SAFE_INTEGER - 1) failV1("stale_fence", "candidate review version exhausted");
      const nextVersion = reviewVersion + 1;
      const nextStatus = request.decision === "accept" ? "accepted" : request.decision === "reject" ? "rejected" : "superseded";
      const applicationId = nextStatus === "accepted" ? `skill_candidate_application:${request.candidate_id}:${nextVersion}` : null;
      const deliveryId = nextStatus === "accepted" ? `meta_skill_delivery:${request.candidate_id}:${nextVersion}` : null;
      const response: MetaSkillCandidateReviewResponseV1 = { candidate_id: request.candidate_id, status: nextStatus, review_version: nextVersion, application_id: applicationId, delivery_id: deliveryId, duplicate_replayed: false };
      try { assertMetaSkillCandidateReviewSemanticBindingsV1(pathCandidateId, request, response, principal.principal_id); } catch { failV1("dependency_unavailable", "candidate review response drifted"); }
      const now = new Date().toISOString();
      const evidence = candidateEvidenceV1(candidate);
      const command = applicationId === null ? [] : (() => {
        const payload: SkillCandidateApplicationRequestV1 = { schema_version: "skill_candidate_application.v1", application_id: applicationId, candidate_id: request.candidate_id, review_version: nextVersion, candidate_type: textV1(candidate.candidate_type, "skill_candidates.candidate_type") === "skill_deprecation" ? "deprecation" : textV1(candidate.candidate_type, "skill_candidates.candidate_type") as "new_skill" | "skill_update", skill_key: textV1(candidate.skill_key, "skill_candidates.skill_key"), ...scope, baseline_catalog_version: textV1(candidate.baseline_catalog_version, "skill_candidates.baseline_catalog_version"), proposal_ref: candidateProposalRefV1(candidate), proposal_hash: hashV1(candidate.proposal_hash, "skill_candidates.proposal_hash"), evidence_refs: [...evidence], reviewer_principal_id: request.reviewer_principal_id, idempotency_key: applicationId, trace_id: request.trace_id };
        if (!Value.Check(SkillCandidateApplicationRequestV1Schema, payload)) failV1("dependency_unavailable", "candidate delivery contract drifted");
        const payloadHash = sha256CanonicalV1(payload);
        return [{ id: deliveryId!, meta_job_id: textV1(candidate.meta_job_id, "skill_candidates.meta_job_id"), command_type: "skill_candidate_application", target_service: "skill_registry", dispatch_mode: "original_request_replay", owner_request: payload, owner_request_hash: payloadHash, failed_client_item_id: request.candidate_id, item_hash: payloadHash, source_owner_request_hash: payloadHash, source_idempotency_key: applicationId, idempotency_key: applicationId, lease_generation: nextVersion, status: "pending", attempt_count: 0, next_retry_at: null, owner_response_schema_version: null, owner_response: null, owner_response_hash: null, owner_item_set_hash: null, last_error: null, trace_id: request.trace_id, settled_at: null, created_at: now, updated_at: now }];
      })();
      try {
        await composition.unit_of_work.withTransaction(
          { operation: "meta_skill_candidate_review", idempotency_key: request.idempotency_key, trace_id: request.trace_id, isolation: "serializable", retry: "serialization_failures" },
          async (transaction, { owner }) => owner.executeWriter(transaction, {
            writer: "transition_skill_candidate_v1",
            arguments: { p_candidate_id: request.candidate_id, p_expected_status: status, p_expected_review_version: String(reviewVersion), p_expected_updated_at: updatedAt, p_next_status: nextStatus, p_candidate: { skill_candidates: { status: nextStatus, downstream_status: nextStatus === "accepted" ? "pending" : "not_applicable", review_version: nextVersion, review_idempotency_key: request.idempotency_key, review_request_hash: requestHash, review_response_payload: response, review_owner_service: "skill_registry", reviewed_by: principal.principal_id, reviewed_at: now, review_reason: request.reason_code, registry_application_id: applicationId, downstream_ref: deliveryId, delivery_attempt_count: 0, delivery_last_error: null, updated_at: now }, meta_command_outbox: command, meta_job_audit_logs: [], meta_event_outbox: [] }, p_request_hash: requestHash, p_trace_id: request.trace_id }, expected_rows: 1,
          }),
        );
      } catch (error) { translateWriterErrorV1(error); }
      return response;
    },

    async claimCommands(_principal, _value) { failV1("dependency_unavailable", "Meta command claiming is not yet composed"); },
    async settleCommand(_principal, _pathCommandId, _value) { failV1("dependency_unavailable", "Meta command settlement is not yet composed"); },
    async checkReadiness(signal?: AbortSignal) {
      await composition.checkReadiness(signal ?? new AbortController().signal);
      signal?.throwIfAborted();
      await composition.postgres.query<RowV1>("SELECT 1 FROM meta_cognition.feedback_requests LIMIT 1");
    },
  };
  return Object.freeze(application);
}
