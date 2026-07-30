import type { VerifiedOwnerPostgresCompositionV1 } from "@pai/persistence";
import type {
  MetaExperienceQueryResponseV1,
  MetaJobQueryDetailsV1,
  MetaResultAuditQueryResponseV1,
  QualitySignalListDetailsV1,
} from "@pai/contracts";

import { sha256CanonicalV1 } from "../canonical.v1.js";
import {
  MetaQueryErrorV1,
  type MetaQueryBotScopeV1,
  type MetaQueryRepositoryV1,
} from "../meta-query.v1.js";
import { META_COGNITION_REPOSITORY_CONTRACT_V1 } from "./permission-manifest.v1.js";

type CompositionV1 = Pick<
  VerifiedOwnerPostgresCompositionV1<typeof META_COGNITION_REPOSITORY_CONTRACT_V1>,
  "postgres" | "checkReadiness"
>;

type RowV1 = Readonly<Record<string, unknown>>;

function textV1(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new MetaQueryErrorV1("owner_contract_drift", true);
  }
  return value;
}

function nullableTextV1(value: unknown, label: string): string | null {
  return value === null ? null : textV1(value, label);
}

function integerV1(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new MetaQueryErrorV1("owner_contract_drift", true);
  }
  return parsed;
}

function timestampV1(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(date.getTime())) {
    throw new MetaQueryErrorV1("owner_contract_drift", true);
  }
  return date.toISOString();
}

function jsonObjectV1(value: unknown): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new MetaQueryErrorV1("owner_contract_drift", true);
  }
  return value as Readonly<Record<string, unknown>>;
}

function stringArrayV1(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.length === 0)) {
    throw new MetaQueryErrorV1("owner_contract_drift", true);
  }
  return Object.freeze([...value] as string[]);
}

function scopeFromRowV1(row: RowV1): MetaQueryBotScopeV1 {
  const deploymentEnvironment = textV1(row.deployment_environment, "deployment_environment");
  const releaseChannel = textV1(row.release_channel, "release_channel");
  if (
    !["local", "dev", "staging", "prod"].includes(deploymentEnvironment) ||
    !["stable", "canary"].includes(releaseChannel)
  ) {
    throw new MetaQueryErrorV1("owner_contract_drift", true);
  }
  return Object.freeze({
    workspace_id: textV1(row.workspace_id, "workspace_id"),
    bot_id: textV1(row.bot_id, "bot_id"),
    owner_agent_id: textV1(row.owner_agent_id, "owner_agent_id"),
    deployment_environment: deploymentEnvironment as MetaQueryBotScopeV1["deployment_environment"],
    release_channel: releaseChannel as MetaQueryBotScopeV1["release_channel"],
  });
}

function sameScopeV1(left: MetaQueryBotScopeV1, right: MetaQueryBotScopeV1): boolean {
  return (
    left.workspace_id === right.workspace_id &&
    left.bot_id === right.bot_id &&
    left.owner_agent_id === right.owner_agent_id &&
    left.deployment_environment === right.deployment_environment &&
    left.release_channel === right.release_channel
  );
}

function cursorFingerprintV1(kind: "quality" | "audit", value: Readonly<Record<string, unknown>>): string {
  return sha256CanonicalV1({ schema_version: `meta_${kind}_cursor.v1`, ...value }).slice(7, 31);
}

function encodeCursorV1(fingerprint: string, id: string): string {
  return `mqc1.${fingerprint}.${Buffer.from(id).toString("base64url")}`;
}

function decodeCursorV1(value: string | null, fingerprint: string): string | null {
  if (value === null) return null;
  const [prefix, actualFingerprint, encodedId, extra] = value.split(".");
  if (prefix !== "mqc1" || actualFingerprint !== fingerprint || encodedId === undefined || encodedId.length === 0 || extra !== undefined) {
    throw new MetaQueryErrorV1("invalid_cursor");
  }
  const id = Buffer.from(encodedId, "base64url").toString();
  if (id.length === 0 || id.length > 512 || Buffer.from(id).toString("base64url") !== encodedId) {
    throw new MetaQueryErrorV1("invalid_cursor");
  }
  return id;
}

function safePayloadSummaryV1(payload: Readonly<Record<string, unknown>>): Readonly<Record<string, string | number | boolean | null | readonly (string | number | boolean | null)[]>> {
  const result: Record<string, string | number | boolean | null | readonly (string | number | boolean | null)[]> = {};
  for (const [key, value] of Object.entries(payload).slice(0, 128)) {
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      result[key] = value;
    } else if (
      Array.isArray(value) &&
      value.length <= 256 &&
      value.every((item) => item === null || typeof item === "string" || typeof item === "number" || typeof item === "boolean")
    ) {
      result[key] = Object.freeze([...value] as (string | number | boolean | null)[]);
    }
  }
  return Object.freeze(result);
}

function jobDetailsV1(job: RowV1, result: RowV1 | undefined): MetaJobQueryDetailsV1 {
  const status = textV1(job.status, "job.status");
  const visibleStatus = status === "leased" ? "running" : status;
  if (!["queued", "running", "retry_wait", "completed", "failed"].includes(visibleStatus)) {
    throw new MetaQueryErrorV1("owner_contract_drift", true);
  }
  const error = job.error === null
    ? null
    : (() => {
        const value = jsonObjectV1(job.error);
        return Object.freeze({
          code: textV1(value.code, "job.error.code"),
          message: textV1(value.message, "job.error.message"),
          retryable: value.retryable === true,
        });
      })();
  if (result === undefined) {
    return Object.freeze({
      job_id: textV1(job.id, "job.id"),
      trigger_process_id: textV1(job.trigger_process_id, "job.trigger_process_id"),
      bot_id: textV1(job.bot_id, "job.bot_id"),
      status: visibleStatus as MetaJobQueryDetailsV1["status"],
      result_status: null,
      attempt_count: integerV1(job.attempt_count),
      next_retry_at: nullableTextV1(job.next_retry_at, "job.next_retry_at"),
      summary: null,
      error,
      created_at: timestampV1(job.created_at),
      updated_at: timestampV1(job.updated_at),
      trace_id: textV1(job.trace_id, "job.trace_id"),
    }) as MetaJobQueryDetailsV1;
  }
  const payload = jsonObjectV1(result.payload);
  const experience = jsonObjectV1(payload.experience_summary);
  const resultStatus = textV1(payload.result_status, "result.payload.result_status");
  if (!["complete", "partial_pending", "partial_failed"].includes(resultStatus)) {
    throw new MetaQueryErrorV1("owner_contract_drift", true);
  }
  const candidateReviewResults = Array.isArray(payload.candidate_review_results)
    ? payload.candidate_review_results
    : [];
  const candidateReviewRefs = candidateReviewResults.map((item, index) => {
    const object = jsonObjectV1(item);
    return typeof object.review_id === "string" && object.review_id.length > 0
      ? object.review_id
      : `candidate_review:${index + 1}`;
  });
  const partialFailures = Array.isArray(payload.partial_failures) ? payload.partial_failures : [];
  const qualitySignals = Array.isArray(payload.quality_signals) ? payload.quality_signals : [];
  const suggestions = Array.isArray(payload.personality_suggestions) ? payload.personality_suggestions : [];
  return Object.freeze({
    job_id: textV1(job.id, "job.id"),
    trigger_process_id: textV1(job.trigger_process_id, "job.trigger_process_id"),
    bot_id: textV1(job.bot_id, "job.bot_id"),
    status: visibleStatus as MetaJobQueryDetailsV1["status"],
    result_status: resultStatus as NonNullable<MetaJobQueryDetailsV1["result_status"]>,
    attempt_count: integerV1(job.attempt_count),
    next_retry_at: nullableTextV1(job.next_retry_at, "job.next_retry_at"),
    summary: Object.freeze({
      experience_summary: Object.freeze({
        summary: textV1(experience.summary, "result.payload.experience_summary.summary"),
        reflection_summary: experience.reflection_summary === null
          ? null
          : textV1(experience.reflection_summary, "result.payload.experience_summary.reflection_summary"),
        evidence_refs: stringArrayV1(experience.evidence_refs),
      }),
      result_status: resultStatus,
      partial_failures_count: partialFailures.length,
      quality_signals_count: qualitySignals.length,
      memory_write_refs: stringArrayV1(result.memory_write_refs),
      knowthat_write_refs: stringArrayV1(result.knowthat_write_refs),
      candidate_review_refs: Object.freeze(candidateReviewRefs),
      skill_candidate_refs: stringArrayV1(result.skill_candidate_refs),
      personality_suggestion_refs: Object.freeze(suggestions.map((item) => textV1(jsonObjectV1(item).suggestion_id, "personality_suggestion.suggestion_id"))),
    }),
    error,
    created_at: timestampV1(job.created_at),
    updated_at: timestampV1(job.updated_at),
    trace_id: textV1(job.trace_id, "job.trace_id"),
  }) as MetaJobQueryDetailsV1;
}

function qualityItemV1(row: RowV1) {
  const sourceKind = textV1(row.source_kind, "quality.source_kind");
  const common = {
    id: textV1(row.id, "quality.id"),
    signal_type: textV1(row.signal_type, "quality.signal_type"),
    severity: textV1(row.severity, "quality.severity"),
    source_ref: textV1(row.source_ref, "quality.source_ref"),
    evidence_refs: stringArrayV1(row.evidence_refs),
    recommended_action: nullableTextV1(row.recommended_action, "quality.recommended_action"),
    payload_summary: safePayloadSummaryV1(jsonObjectV1(row.payload)),
    created_at: timestampV1(row.created_at),
  };
  if (sourceKind === "service") {
    return Object.freeze({ ...common, source_kind: sourceKind, source_service: textV1(row.source_service, "quality.source_service"), actor_principal: null, actor_role: null });
  }
  if (!["manual", "operator", "offline_repair"].includes(sourceKind)) {
    throw new MetaQueryErrorV1("owner_contract_drift", true);
  }
  return Object.freeze({
    ...common,
    source_kind: sourceKind,
    source_service: null,
    actor_principal: nullableTextV1(row.actor_principal, "quality.actor_principal"),
    actor_role: nullableTextV1(row.actor_role, "quality.actor_role"),
  });
}

function fallbackResultAuditV1(result: RowV1, job: RowV1) {
  const payload = jsonObjectV1(result.payload);
  const partialFailures = Array.isArray(payload.partial_failures) ? payload.partial_failures : [];
  return Object.freeze({
    audit_id: `meta_result_audit:${textV1(result.id, "result.id")}:${integerV1(result.result_version)}`,
    result_version: integerV1(result.result_version),
    previous_result_status: null,
    result_status: textV1(payload.result_status, "result.payload.result_status"),
    operation: "created",
    changed_failure_ids: Object.freeze(partialFailures.map((failure) => textV1(jsonObjectV1(failure).failure_id, "result.partial_failure.failure_id"))),
    actor_kind: "service" as const,
    actor_ref: "meta_cognition",
    payload_summary: Object.freeze({
      active_compensation_count: partialFailures.filter((failure) => {
        const status = jsonObjectV1(failure).status;
        return status === "pending" || status === "retrying";
      }).length,
    }),
    created_at: timestampV1(job.updated_at),
  });
}

const JOB_COLUMNS_V1 = `id, trigger_process_id, workspace_id, bot_id, owner_agent_id,
  deployment_environment, release_channel, status, attempt_count, next_retry_at,
  error, created_at, updated_at, trace_id`;

/** Direct reads are scope-filtered before response construction; all Meta writes
 * remain pinned owner writers.  Query cursors use the exact documented
 * `(created_at DESC, id DESC)` ordering and never trust a caller cursor. */
export function createPostgresMetaQueryRepositoryV1(
  composition: CompositionV1,
): MetaQueryRepositoryV1 {
  const repository: MetaQueryRepositoryV1 = {
    async readAuthorizedJob({ meta_job_id, principal }) {
      const result = await composition.postgres.query<RowV1>(
        `SELECT ${JOB_COLUMNS_V1} FROM meta_cognition.meta_jobs WHERE id = $1`,
        [meta_job_id],
      );
      const job = result.rows[0];
      if (job === undefined) return Object.freeze({ outcome: "not_found" as const });
      const scope = scopeFromRowV1(job);
      if (!sameScopeV1(scope, principal.scope)) return Object.freeze({ outcome: "denied" as const });
      const resultRow = await composition.postgres.query<RowV1>(
        `SELECT id, result_version, memory_write_refs, knowthat_write_refs,
           skill_candidate_refs, payload
           FROM meta_cognition.meta_results WHERE meta_job_id = $1`,
        [meta_job_id],
      );
      return Object.freeze({
        outcome: "found" as const,
        authoritative_scope: scope,
        details: jobDetailsV1(job, resultRow.rows[0]),
      });
    },

    async listAuthorizedQualitySignals(request) {
      const jobs = await composition.postgres.query<RowV1>(
        `SELECT ${JOB_COLUMNS_V1} FROM meta_cognition.meta_jobs WHERE trigger_process_id = $1`,
        [request.trigger_process_id],
      );
      const job = jobs.rows[0];
      if (job === undefined) return Object.freeze({ outcome: "not_found" as const });
      const scope = scopeFromRowV1(job);
      if (!sameScopeV1(scope, request.principal.scope)) return Object.freeze({ outcome: "denied" as const });
      const fingerprint = cursorFingerprintV1("quality", {
        ...request.principal.scope,
        trigger_process_id: request.trigger_process_id,
        severity: request.severity,
        signal_type: request.signal_type,
      });
      const cursorId = decodeCursorV1(request.cursor, fingerprint);
      let cursorCreatedAt: string | null = null;
      if (cursorId !== null) {
        const cursor = await composition.postgres.query<RowV1>(
          `SELECT id, created_at FROM meta_cognition.quality_signals
             WHERE id = $1 AND trigger_process_id = $2
               AND workspace_id = $3 AND bot_id = $4 AND owner_agent_id = $5
               AND deployment_environment = $6 AND release_channel = $7
               AND ($8::text IS NULL OR severity = $8)
               AND ($9::text IS NULL OR signal_type = $9)`,
          [cursorId, request.trigger_process_id, scope.workspace_id, scope.bot_id, scope.owner_agent_id, scope.deployment_environment, scope.release_channel, request.severity, request.signal_type],
        );
        const row = cursor.rows[0];
        if (row === undefined) throw new MetaQueryErrorV1("invalid_cursor");
        cursorCreatedAt = timestampV1(row.created_at);
      }
      const signals = await composition.postgres.query<RowV1>(
        `SELECT id, signal_type, severity, source_kind, source_service,
           actor_principal, actor_role, source_ref, evidence_refs,
           recommended_action, payload, created_at
           FROM meta_cognition.quality_signals
          WHERE trigger_process_id = $1
            AND workspace_id = $2 AND bot_id = $3 AND owner_agent_id = $4
            AND deployment_environment = $5 AND release_channel = $6
            AND ($7::text IS NULL OR severity = $7)
            AND ($8::text IS NULL OR signal_type = $8)
            AND ($9::timestamptz IS NULL OR (created_at, id) < ($9::timestamptz, $10::text))
          ORDER BY created_at DESC, id DESC
          LIMIT $11`,
        [request.trigger_process_id, scope.workspace_id, scope.bot_id, scope.owner_agent_id, scope.deployment_environment, scope.release_channel, request.severity, request.signal_type, cursorCreatedAt, cursorId, request.limit + 1],
      );
      const all = signals.rows.map(qualityItemV1);
      const hasMore = all.length > request.limit;
      const items = all.slice(0, request.limit) as QualitySignalListDetailsV1["items"];
      return Object.freeze({
        outcome: "found" as const,
        authoritative_scope: scope,
        details: Object.freeze({
          trigger_process_id: request.trigger_process_id,
          bot_id: scope.bot_id,
          items,
          next_cursor: hasMore ? encodeCursorV1(fingerprint, items.at(-1)!.id) : null,
          has_more: hasMore,
          trace_id: request.trace_id,
        }) as QualitySignalListDetailsV1,
      });
    },

    async readAuthorizedExperience({ trigger_process_id, principal, trace_id }) {
      const jobs = await composition.postgres.query<RowV1>(
        `SELECT ${JOB_COLUMNS_V1} FROM meta_cognition.meta_jobs WHERE trigger_process_id = $1`,
        [trigger_process_id],
      );
      const job = jobs.rows[0];
      if (job === undefined) return Object.freeze({ outcome: "not_found" as const });
      const scope = scopeFromRowV1(job);
      if (!sameScopeV1(scope, principal.scope)) return Object.freeze({ outcome: "denied" as const });
      const experiences = await composition.postgres.query<RowV1>(
        `SELECT id, summary, execution_summary, evidence_refs, quality_score, created_at
           FROM meta_cognition.experience_records
          WHERE trigger_process_id = $1 AND workspace_id = $2 AND bot_id = $3
            AND owner_agent_id = $4 AND deployment_environment = $5 AND release_channel = $6
          ORDER BY created_at DESC, id DESC LIMIT 1`,
        [trigger_process_id, scope.workspace_id, scope.bot_id, scope.owner_agent_id, scope.deployment_environment, scope.release_channel],
      );
      const experience = experiences.rows[0];
      const details = (experience === undefined
        ? Object.freeze({
            trigger_process_id,
            bot_id: scope.bot_id,
            trace_id,
            experience_record_id: null,
            status: job.status === "completed" ? "not_found" : "pending",
            summary: null,
            execution_summary: null,
            evidence_refs: Object.freeze([]),
            quality_score: null,
            created_at: null,
          })
        : Object.freeze({
            trigger_process_id,
            bot_id: scope.bot_id,
            trace_id,
            experience_record_id: textV1(experience.id, "experience.id"),
            status: "available" as const,
            summary: textV1(experience.summary, "experience.summary"),
            execution_summary: jsonObjectV1(experience.execution_summary),
            evidence_refs: stringArrayV1(experience.evidence_refs),
            quality_score: experience.quality_score === null ? null : Number(experience.quality_score),
            created_at: timestampV1(experience.created_at),
          })) as MetaExperienceQueryResponseV1;
      return Object.freeze({ outcome: "found" as const, authoritative_scope: scope, details });
    },

    async listAuthorizedResultAudit(request) {
      const results = await composition.postgres.query<RowV1>(
        `SELECT id, meta_job_id, trigger_process_id, workspace_id, bot_id,
           owner_agent_id, deployment_environment, release_channel,
           result_version, payload
           FROM meta_cognition.meta_results WHERE id = $1`,
        [request.meta_result_id],
      );
      const result = results.rows[0];
      if (result === undefined) return Object.freeze({ outcome: "not_found" as const });
      const scope = scopeFromRowV1(result);
      if (!sameScopeV1(scope, request.principal.scope)) return Object.freeze({ outcome: "denied" as const });
      const jobs = await composition.postgres.query<RowV1>(
        `SELECT ${JOB_COLUMNS_V1} FROM meta_cognition.meta_jobs WHERE id = $1`,
        [textV1(result.meta_job_id, "result.meta_job_id")],
      );
      const job = jobs.rows[0];
      if (job === undefined || !sameScopeV1(scopeFromRowV1(job), scope)) {
        throw new MetaQueryErrorV1("owner_contract_drift", true);
      }
      const fingerprint = cursorFingerprintV1("audit", {
        ...request.principal.scope,
        meta_result_id: textV1(result.id, "result.id"),
        result_version: integerV1(result.result_version),
      });
      if (decodeCursorV1(request.cursor, fingerprint) !== null) {
        throw new MetaQueryErrorV1("invalid_cursor");
      }
      const item = fallbackResultAuditV1(result, job);
      return Object.freeze({
        outcome: "found" as const,
        authoritative_scope: scope,
        details: Object.freeze({
          meta_result_id: textV1(result.id, "result.id"),
          trigger_process_id: textV1(result.trigger_process_id, "result.trigger_process_id"),
          bot_id: scope.bot_id,
          result_version: integerV1(result.result_version),
          result_status: textV1(jsonObjectV1(result.payload).result_status, "result.payload.result_status") as MetaResultAuditQueryResponseV1["result_status"],
          items: [item] as unknown as MetaResultAuditQueryResponseV1["items"],
          next_cursor: null,
          has_more: false,
          redacted_field_count: 0,
          trace_id: request.trace_id,
        }) as MetaResultAuditQueryResponseV1,
      });
    },

    async checkReadiness(signal) {
      signal?.throwIfAborted();
      await composition.checkReadiness(signal ?? new AbortController().signal);
      signal?.throwIfAborted();
    },
  };
  return Object.freeze(repository);
}
