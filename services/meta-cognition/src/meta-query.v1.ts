import {
  MetaExperienceQueryResponseV1Schema,
  MetaJobQueryDetailsV1Schema,
  MetaResultAuditQueryResponseV1Schema,
  QualitySignalListDetailsV1Schema,
  assertMetaResultAuditQueryResponseSemanticBindingsV1,
  assertMetaJobQueryDetailsSemanticBindingsV1,
  assertQualitySignalListDetailsSemanticBindingsV1,
  type DelegatedPrincipalContextV1,
  type MetaExperienceQueryResponseV1,
  type MetaJobQueryDetailsV1,
  type MetaResultAuditQueryResponseV1,
  type QualitySignalV1,
  type QualitySignalListDetailsV1,
} from "@pai/contracts";
import { Value } from "@sinclair/typebox/value";

import {
  sha256CanonicalV1,
  snapshotCanonicalJsonV1,
} from "./canonical.v1.js";
import type {
  MetaExperienceRecordV1,
  MetaJobRecordV1,
  MetaResultV1,
} from "./meta-types.v1.js";

export interface MetaQueryBotScopeV1 {
  readonly workspace_id: string;
  readonly bot_id: string;
  readonly owner_agent_id: string;
  readonly deployment_environment: "local" | "dev" | "staging" | "prod";
  readonly release_channel: "stable" | "canary";
}

export interface MetaQueryPrincipalV1 {
  readonly workload_service: "observation_gateway";
  readonly delegated_principal: DelegatedPrincipalContextV1;
  readonly scope: MetaQueryBotScopeV1;
}

type MetaQueryOutcomeV1<T> =
  | Readonly<{ outcome: "denied" }>
  | Readonly<{ outcome: "not_found" }>
  | Readonly<{
      outcome: "found";
      authoritative_scope: MetaQueryBotScopeV1;
      details: T;
    }>;

export interface MetaQueryRepositoryV1 {
  readAuthorizedJob(request: Readonly<{
    meta_job_id: string;
    principal: MetaQueryPrincipalV1;
  }>): Promise<MetaQueryOutcomeV1<MetaJobQueryDetailsV1>>;
  listAuthorizedQualitySignals(request: Readonly<{
    trigger_process_id: string;
    principal: MetaQueryPrincipalV1;
    cursor: string | null;
    limit: number;
    severity: "info" | "warning" | "error" | "critical" | null;
    signal_type: string | null;
    trace_id: string;
  }>): Promise<MetaQueryOutcomeV1<QualitySignalListDetailsV1>>;
  readAuthorizedExperience(request: Readonly<{
    trigger_process_id: string;
    principal: MetaQueryPrincipalV1;
    trace_id: string;
  }>): Promise<MetaQueryOutcomeV1<MetaExperienceQueryResponseV1>>;
  listAuthorizedResultAudit(request: Readonly<{
    meta_result_id: string;
    principal: MetaQueryPrincipalV1;
    cursor: string | null;
    limit: number;
    trace_id: string;
  }>): Promise<MetaQueryOutcomeV1<MetaResultAuditQueryResponseV1>>;
  checkReadiness(signal?: AbortSignal): Promise<void>;
}

export class MetaQueryErrorV1 extends Error {
  public constructor(
    public readonly code:
      | "meta_job_not_found"
      | "trigger_process_not_found"
      | "meta_result_not_found"
      | "authorization_denied"
      | "invalid_cursor"
      | "schema_validation_failed"
      | "owner_contract_drift",
    public readonly retryable = false,
  ) {
    super(code);
    this.name = "MetaQueryErrorV1";
  }
}

export interface MetaQueryApplicationV1 {
  getJob(
    principal: MetaQueryPrincipalV1,
    metaJobId: string,
    traceId: string,
  ): Promise<
    Readonly<{
      code: "meta_job_found";
      message: "meta job found";
      retryable: false;
      trace_id: string;
      details: MetaJobQueryDetailsV1;
    }>
  >;
  listQualitySignals(
    principal: MetaQueryPrincipalV1,
    triggerProcessId: string,
    query: Readonly<{
      cursor?: string;
      limit?: number;
      severity?: "info" | "warning" | "error" | "critical";
      signal_type?: string;
    }>,
    traceId: string,
  ): Promise<
    Readonly<{
      code: "quality_signals_found";
      message: "quality signals found";
      retryable: false;
      trace_id: string;
      details: QualitySignalListDetailsV1;
    }>
  >;
  getExperience(
    principal: MetaQueryPrincipalV1,
    triggerProcessId: string,
    traceId: string,
  ): Promise<MetaExperienceQueryResponseV1>;
  listResultAudit(
    principal: MetaQueryPrincipalV1,
    metaResultId: string,
    query: Readonly<{ cursor?: string; limit?: number }>,
    traceId: string,
  ): Promise<MetaResultAuditQueryResponseV1>;
  checkReadiness(signal?: AbortSignal): Promise<void>;
}

const QUALITY_SIGNAL_TYPES = new Set([
  "snapshot_missing",
  "snapshot_incomplete",
  "snapshot_schema_incompatible",
  "snapshot_hash_mismatch",
  "artifact_unreadable",
  "redaction_incomplete",
  "llm_parse_failed",
  "schema_validation_failed",
  "memory_write_partial_failed",
  "knowthat_conflict_detected",
  "tool_execution_failed",
  "user_dissatisfied",
  "low_confidence_extraction",
  "feedback_required",
  "downstream_operation_failed",
]);

function assertIdentifier(
  value: unknown,
  errorCode: "invalid_cursor" | "schema_validation_failed",
): asserts value is string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 512 ||
    /[\r\n]/u.test(value)
  ) {
    throw new MetaQueryErrorV1(errorCode);
  }
}

function sameScope(
  left: MetaQueryBotScopeV1,
  right: MetaQueryBotScopeV1,
): boolean {
  return (
    left.workspace_id === right.workspace_id &&
    left.bot_id === right.bot_id &&
    left.owner_agent_id === right.owner_agent_id &&
    left.deployment_environment === right.deployment_environment &&
    left.release_channel === right.release_channel
  );
}

function ownerScope(
  owner: MetaQueryBotScopeV1,
): MetaQueryBotScopeV1 {
  return Object.freeze({
    workspace_id: owner.workspace_id,
    bot_id: owner.bot_id,
    owner_agent_id: owner.owner_agent_id,
    deployment_environment: owner.deployment_environment,
    release_channel: owner.release_channel,
  });
}

function hasExactKeys(
  value: Readonly<Record<string, unknown>>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  const allowed = new Set([...required, ...optional]);
  const keys = Object.keys(value);
  return (
    required.every((key) => Object.hasOwn(value, key)) &&
    keys.every((key) => allowed.has(key))
  );
}

function validScopeFields(
  scope: Readonly<Record<string, unknown>>,
): boolean {
  return (
    typeof scope["workspace_id"] === "string" &&
    scope["workspace_id"].length > 0 &&
    typeof scope["bot_id"] === "string" &&
    scope["bot_id"].length > 0 &&
    typeof scope["owner_agent_id"] === "string" &&
    scope["owner_agent_id"].length > 0 &&
    ["local", "dev", "staging", "prod"].includes(
      String(scope["deployment_environment"]),
    ) &&
    ["stable", "canary"].includes(String(scope["release_channel"]))
  );
}

function validScopeShape(value: unknown): value is MetaQueryBotScopeV1 {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }
  const scope = value as Readonly<Record<string, unknown>>;
  return (
    hasExactKeys(scope, [
      "workspace_id",
      "bot_id",
      "owner_agent_id",
      "deployment_environment",
      "release_channel",
    ]) && validScopeFields(scope)
  );
}

function snapshotPrincipal(
  value: MetaQueryPrincipalV1,
): MetaQueryPrincipalV1 {
  let principal: MetaQueryPrincipalV1;
  try {
    principal = snapshotCanonicalJsonV1(value, {
      max_bytes: 65_536,
      max_depth: 16,
      max_nodes: 1_024,
      max_container_entries: 256,
    });
  } catch {
    throw new MetaQueryErrorV1("authorization_denied");
  }
  if (
    typeof principal !== "object" ||
    principal === null ||
    Array.isArray(principal) ||
    !hasExactKeys(
      principal as unknown as Readonly<Record<string, unknown>>,
      ["workload_service", "delegated_principal", "scope"],
    ) ||
    principal.workload_service !== "observation_gateway" ||
    !validScopeShape(principal.scope)
  ) {
    throw new MetaQueryErrorV1("authorization_denied");
  }
  const delegated = principal.delegated_principal;
  if (
    typeof delegated !== "object" ||
    delegated === null ||
    Array.isArray(delegated) ||
    !hasExactKeys(
      delegated as unknown as Readonly<Record<string, unknown>>,
      [
        "principal_type",
        "principal_id",
        "roles",
        "source_issuer",
        "source_subject",
        "auth_time",
        "scope_kind",
        "workspace_id",
        "bot_id",
        "owner_agent_id",
        "deployment_environment",
        "release_channel",
      ],
    ) ||
    !["user", "developer", "operator"].includes(
      delegated.principal_type,
    ) ||
    typeof delegated.principal_id !== "string" ||
    delegated.principal_id.length === 0 ||
    !Array.isArray(delegated.roles) ||
    delegated.roles.length !== new Set(delegated.roles).size ||
    delegated.roles.some(
      (role) => typeof role !== "string" || role.length === 0,
    ) ||
    typeof delegated.source_issuer !== "string" ||
    delegated.source_issuer.length === 0 ||
    typeof delegated.source_subject !== "string" ||
    delegated.source_subject.length === 0 ||
    !Number.isSafeInteger(delegated.auth_time) ||
    delegated.auth_time < 0 ||
    delegated.scope_kind !== "bot" ||
    !validScopeFields(
      delegated as unknown as Readonly<Record<string, unknown>>,
    )
  ) {
    throw new MetaQueryErrorV1("authorization_denied");
  }
  if (
    delegated.workspace_id !== principal.scope.workspace_id ||
    delegated.bot_id !== principal.scope.bot_id ||
    delegated.owner_agent_id !== principal.scope.owner_agent_id ||
    delegated.deployment_environment !==
      principal.scope.deployment_environment ||
    delegated.release_channel !== principal.scope.release_channel
  ) {
    throw new MetaQueryErrorV1("authorization_denied");
  }
  return principal;
}

function snapshotQuery<T>(
  value: T,
  allowedKeys: readonly string[],
): T {
  let query: T;
  try {
    query = snapshotCanonicalJsonV1(value, {
      max_bytes: 16_384,
      max_depth: 8,
      max_nodes: 128,
      max_container_entries: 16,
    });
  } catch {
    throw new MetaQueryErrorV1("schema_validation_failed");
  }
  if (
    typeof query !== "object" ||
    query === null ||
    Array.isArray(query) ||
    !hasExactKeys(
      query as Readonly<Record<string, unknown>>,
      [],
      allowedKeys,
    )
  ) {
    throw new MetaQueryErrorV1("schema_validation_failed");
  }
  return query;
}

function immutableSnapshot<T>(value: T): T {
  return snapshotCanonicalJsonV1(value);
}

type QueryResultV1 = MetaResultV1;
type QueryAuditItemV1 =
  MetaResultAuditQueryResponseV1["items"][number];

export interface InMemoryMetaQuerySourceV1 {
  inspect(): Readonly<{
    jobs: readonly MetaJobRecordV1[];
    experiences: readonly MetaExperienceRecordV1[];
    results: readonly QueryResultV1[];
  }>;
}

export interface InMemoryMetaResultAuditSourceV1 {
  inspect(): Readonly<{
    jobs: readonly MetaJobRecordV1[];
    results: readonly QueryResultV1[];
    result_audits: readonly Readonly<{
      meta_result_id: string;
      audit: QueryAuditItemV1;
    }>[];
  }>;
}

function cursorFingerprint(
  kind: "quality" | "audit",
  value: Readonly<Record<string, unknown>>,
): string {
  return sha256CanonicalV1({
    schema_version: `meta_${kind}_cursor.v1`,
    ...value,
  }).slice(7, 31);
}

function encodeCursor(fingerprint: string, id: string): string {
  return `mqc1.${fingerprint}.${Buffer.from(id).toString("base64url")}`;
}

function decodeCursor(
  value: string | null,
  fingerprint: string,
): string | null {
  if (value === null) return null;
  const [prefix, actualFingerprint, encodedId, extra] =
    value.split(".");
  if (
    prefix !== "mqc1" ||
    actualFingerprint !== fingerprint ||
    encodedId === undefined ||
    encodedId.length === 0 ||
    extra !== undefined
  ) {
    throw new MetaQueryErrorV1("invalid_cursor");
  }
  try {
    const id = Buffer.from(encodedId, "base64url").toString();
    assertIdentifier(id, "invalid_cursor");
    if (Buffer.from(id).toString("base64url") !== encodedId) {
      throw new Error("non-canonical cursor");
    }
    return id;
  } catch {
    throw new MetaQueryErrorV1("invalid_cursor");
  }
}

type SafeSummaryScalarV1 = string | number | boolean | null;

function isSafeSummaryScalar(
  value: unknown,
): value is SafeSummaryScalarV1 {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function safePayloadSummary(
  payload: Readonly<Record<string, unknown>>,
): Readonly<
  Record<string, SafeSummaryScalarV1 | SafeSummaryScalarV1[]>
> {
  const summary: Record<
    string,
    SafeSummaryScalarV1 | SafeSummaryScalarV1[]
  > = {};
  for (const [key, value] of Object.entries(payload).slice(0, 128)) {
    if (isSafeSummaryScalar(value)) {
      summary[key] = value;
    } else if (
      Array.isArray(value) &&
      value.length <= 256 &&
      value.every(isSafeSummaryScalar)
    ) {
      summary[key] = [...value];
      Object.freeze(summary[key]);
    }
  }
  return Object.freeze(summary);
}

function qualityProjection(
  signal: QualitySignalV1,
  id: string,
  createdAt: string,
): QualitySignalListDetailsV1["items"][number] {
  const common = {
    id,
    signal_type: signal.signal_type,
    severity: signal.severity,
    source_ref: signal.source_ref,
    evidence_refs: [...signal.evidence_refs],
    recommended_action: signal.recommended_action,
    payload_summary: safePayloadSummary(signal.payload),
    created_at: createdAt,
  };
  return signal.source_kind === "service"
    ? {
        ...common,
        source_kind: "service",
        source_service: signal.source_service,
        actor_principal: null,
        actor_role: null,
      }
    : {
        ...common,
        source_kind: signal.source_kind,
        source_service: null,
        actor_principal: signal.actor_principal,
        actor_role: signal.actor_role,
      };
}

export function createInMemoryMetaQueryRepositoryV1(
  source: InMemoryMetaQuerySourceV1,
  auditSource?: InMemoryMetaResultAuditSourceV1,
): MetaQueryRepositoryV1 {
  const snapshot = () => {
    const primary = source.inspect();
    const secondary = auditSource?.inspect();
    const jobs = new Map(
      primary.jobs.map((job) => [job.id, job]),
    );
    for (const job of secondary?.jobs ?? []) {
      jobs.set(job.id, job);
    }
    const results = new Map(
      primary.results.map((result) => [result.id, result]),
    );
    for (const result of secondary?.results ?? []) {
      results.set(result.id, result);
    }
    return {
      ...primary,
      jobs: [...jobs.values()],
      results: [...results.values()],
      result_audits: secondary?.result_audits ?? [],
    };
  };
  const visible = (
    owner: MetaQueryBotScopeV1,
    principal: MetaQueryPrincipalV1,
  ) => sameScope(owner, principal.scope);
  const repository: MetaQueryRepositoryV1 = {
    async readAuthorizedJob({ meta_job_id, principal }) {
      const state = snapshot();
      const job = state.jobs.find(({ id }) => id === meta_job_id);
      if (job === undefined) return { outcome: "not_found" };
      if (!visible(job, principal)) return { outcome: "denied" };
      const result = state.results.find(
        ({ meta_job_id: ownerJobId }) => ownerJobId === job.id,
      );
      const summary =
        result === undefined
          ? null
          : {
              experience_summary: {
                summary: result.payload.experience_summary.summary,
                reflection_summary:
                  result.payload.experience_summary.reflection_summary ??
                  null,
                evidence_refs: [
                  ...result.payload.experience_summary.evidence_refs,
                ],
              },
              result_status: result.result_status,
              partial_failures_count:
                result.payload.partial_failures.length,
              quality_signals_count:
                result.payload.quality_signals.length,
              memory_write_refs: [...result.memory_write_refs],
              knowthat_write_refs: [...result.knowthat_write_refs],
              candidate_review_refs:
                result.payload.candidate_review_results.map(
                  (review, index) =>
                    "review_id" in review
                      ? String(review.review_id)
                      : `candidate_review:${index + 1}`,
                ),
              skill_candidate_refs: [
                ...result.skill_candidate_refs,
              ],
              personality_suggestion_refs:
                result.payload.personality_suggestions.map(
                  ({ suggestion_id }) => suggestion_id,
                ),
            };
      const details: MetaJobQueryDetailsV1 = {
        job_id: job.id,
        trigger_process_id: job.trigger_process_id,
        bot_id: job.bot_id,
        status: job.status === "leased" ? "running" : job.status,
        result_status: result?.result_status ?? null,
        attempt_count: job.attempt_count,
        next_retry_at: job.next_retry_at,
        summary,
        error:
          job.error === null
            ? null
            : {
                code: job.error.code,
                message: job.error.message,
                retryable: job.error.retryable,
              },
        created_at: job.created_at,
        updated_at: job.updated_at,
        trace_id: job.trace_id,
      };
      return {
        outcome: "found",
        authoritative_scope: ownerScope(job),
        details,
      };
    },

    async listAuthorizedQualitySignals(request) {
      const state = snapshot();
      const matchingJobs = state.jobs.filter(
        ({ trigger_process_id }) =>
          trigger_process_id === request.trigger_process_id,
      );
      if (matchingJobs.length === 0) return { outcome: "not_found" };
      const jobs = matchingJobs.filter((job) =>
        visible(job, request.principal),
      );
      if (jobs.length === 0) {
        return { outcome: "denied" };
      }
      const owner = jobs[0]!;
      const jobById = new Map(jobs.map((job) => [job.id, job]));
      const all = state.results
        .filter(
          (result) =>
            result.trigger_process_id ===
              request.trigger_process_id &&
            visible(result, request.principal),
        )
        .flatMap((result) => {
          const job = jobById.get(result.meta_job_id);
          return result.payload.quality_signals.map((signal, index) =>
            qualityProjection(
              signal,
              result.quality_signal_refs[index] ??
                `quality_signal:${result.id}:${index + 1}`,
              job?.updated_at ?? owner.updated_at,
            ),
          );
        })
        .filter(
          (signal) =>
            (request.severity === null ||
              signal.severity === request.severity) &&
            (request.signal_type === null ||
              signal.signal_type === request.signal_type),
        )
        .sort(
          (left, right) =>
            right.created_at.localeCompare(left.created_at) ||
            right.id.localeCompare(left.id),
        );
      if (new Set(all.map(({ id }) => id)).size !== all.length) {
        throw new MetaQueryErrorV1("owner_contract_drift", true);
      }
      const fingerprint = cursorFingerprint("quality", {
        ...request.principal.scope,
        trigger_process_id: request.trigger_process_id,
        severity: request.severity,
        signal_type: request.signal_type,
      });
      const afterId = decodeCursor(request.cursor, fingerprint);
      const offset =
        afterId === null
          ? 0
          : all.findIndex(({ id }) => id === afterId) + 1;
      if (afterId !== null && offset === 0) {
        throw new MetaQueryErrorV1("invalid_cursor");
      }
      const items = all.slice(offset, offset + request.limit);
      const hasMore = offset + items.length < all.length;
      const response: QualitySignalListDetailsV1 = {
        trigger_process_id: request.trigger_process_id,
        bot_id: owner.bot_id,
        items,
        next_cursor:
          hasMore && items.at(-1) !== undefined
            ? encodeCursor(fingerprint, items.at(-1)!.id)
            : null,
        has_more: hasMore,
        trace_id: request.trace_id,
      };
      return {
        outcome: "found",
        authoritative_scope: ownerScope(owner),
        details: response,
      };
    },

    async readAuthorizedExperience({
      trigger_process_id,
      principal,
      trace_id,
    }) {
      const state = snapshot();
      const matchingJobs = state.jobs.filter(
        (candidate) =>
          candidate.trigger_process_id === trigger_process_id,
      );
      if (matchingJobs.length === 0) return { outcome: "not_found" };
      const job = matchingJobs.find((candidate) =>
        visible(candidate, principal),
      );
      if (job === undefined) return { outcome: "denied" };
      const experience = [...state.experiences]
        .filter(
          (candidate) =>
            candidate.trigger_process_id === trigger_process_id &&
            visible(candidate, principal),
        )
        .sort(
          (left, right) =>
            right.created_at.localeCompare(left.created_at) ||
            right.id.localeCompare(left.id),
        )[0];
      const details: MetaExperienceQueryResponseV1 =
        experience === undefined
          ? {
              trigger_process_id,
              bot_id: job.bot_id,
              trace_id,
              experience_record_id: null,
              status:
                job.status === "completed" ? "not_found" : "pending",
              summary: null,
              execution_summary: null,
              evidence_refs: [],
              quality_score: null,
              created_at: null,
            }
          : {
              trigger_process_id,
              bot_id: experience.bot_id,
              trace_id,
              experience_record_id: experience.id,
              status: "available",
              summary: experience.summary,
              execution_summary: {
                task_stages: [],
                major_results: [experience.summary],
                failure_summaries: [],
                artifact_refs: [...experience.evidence_refs],
              },
              evidence_refs: [...experience.evidence_refs],
              quality_score: experience.quality_score,
              created_at: experience.created_at,
            };
      return {
        outcome: "found",
        authoritative_scope: ownerScope(job),
        details,
      };
    },

    async listAuthorizedResultAudit(request) {
      const state = snapshot();
      const result = state.results.find(
        ({ id }) => id === request.meta_result_id,
      );
      if (result === undefined) return { outcome: "not_found" };
      if (!visible(result, request.principal)) {
        return { outcome: "denied" };
      }
      const job = state.jobs.find(
        ({ id }) => id === result.meta_job_id,
      );
      if (job === undefined || !visible(job, request.principal)) {
        return { outcome: "denied" };
      }
      const matching = state.result_audits
        .filter(
          ({ meta_result_id, audit }) =>
            meta_result_id === result.id &&
            audit.result_version <= result.result_version,
        )
        .map(({ audit }) => audit)
        .sort(
          (left, right) =>
            left.result_version - right.result_version ||
            left.audit_id.localeCompare(right.audit_id),
        );
      const all =
        matching.length > 0
          ? matching
          : [
              {
                audit_id:
                  `meta_result_audit:${result.id}:${result.result_version}`,
                result_version: result.result_version,
                previous_result_status: null,
                result_status: result.result_status,
                operation: "created",
                changed_failure_ids:
                  result.payload.partial_failures.map(
                    ({ failure_id }) => failure_id,
                  ),
                actor_kind: "service" as const,
                actor_ref: "meta_cognition",
                payload_summary: {
                  active_compensation_count:
                    result.payload.partial_failures.filter(
                      ({ status }) =>
                        status === "pending" ||
                        status === "retrying",
                    ).length,
                },
                created_at: job.updated_at,
              },
            ];
      if (
        new Set(all.map(({ audit_id }) => audit_id)).size !==
        all.length
      ) {
        throw new MetaQueryErrorV1("owner_contract_drift", true);
      }
      const fingerprint = cursorFingerprint("audit", {
        ...request.principal.scope,
        meta_result_id: result.id,
        result_version: result.result_version,
      });
      const afterId = decodeCursor(request.cursor, fingerprint);
      const offset =
        afterId === null
          ? 0
          : all.findIndex(({ audit_id }) => audit_id === afterId) + 1;
      if (afterId !== null && offset === 0) {
        throw new MetaQueryErrorV1("invalid_cursor");
      }
      const items = all.slice(offset, offset + request.limit);
      const hasMore = offset + items.length < all.length;
      const details: MetaResultAuditQueryResponseV1 = {
        meta_result_id: result.id,
        trigger_process_id: result.trigger_process_id,
        bot_id: result.bot_id,
        result_version: result.result_version,
        result_status: result.result_status,
        items,
        next_cursor:
          hasMore && items.at(-1) !== undefined
            ? encodeCursor(fingerprint, items.at(-1)!.audit_id)
            : null,
        has_more: hasMore,
        redacted_field_count: 0,
        trace_id: request.trace_id,
      };
      return {
        outcome: "found",
        authoritative_scope: ownerScope(result),
        details,
      };
    },

    async checkReadiness() {},
  };
  return Object.freeze(repository);
}

function resolve<T>(
  outcomeValue: MetaQueryOutcomeV1<T>,
  notFoundCode:
    | "meta_job_not_found"
    | "trigger_process_not_found"
    | "meta_result_not_found",
  principal: MetaQueryPrincipalV1,
): T {
  let outcome: MetaQueryOutcomeV1<T>;
  try {
    outcome = snapshotCanonicalJsonV1(outcomeValue);
  } catch {
    throw new MetaQueryErrorV1("owner_contract_drift");
  }
  if (
    typeof outcome !== "object" ||
    outcome === null ||
    Array.isArray(outcome)
  ) {
    throw new MetaQueryErrorV1("owner_contract_drift");
  }
  const record = outcome as unknown as Readonly<
    Record<string, unknown>
  >;
  if (
    outcome.outcome === "denied" &&
    hasExactKeys(record, ["outcome"])
  ) {
    throw new MetaQueryErrorV1("authorization_denied");
  }
  if (
    outcome.outcome === "not_found" &&
    hasExactKeys(record, ["outcome"])
  ) {
    throw new MetaQueryErrorV1(notFoundCode);
  }
  if (
    outcome.outcome !== "found" ||
    !hasExactKeys(record, [
      "outcome",
      "authoritative_scope",
      "details",
    ]) ||
    !validScopeShape(outcome.authoritative_scope) ||
    !sameScope(outcome.authoritative_scope, principal.scope)
  ) {
    throw new MetaQueryErrorV1("owner_contract_drift");
  }
  return outcome.details;
}

export function createMetaQueryApplicationV1(
  repository: MetaQueryRepositoryV1,
): MetaQueryApplicationV1 {
  const readinessProbe = repository.checkReadiness;
  if (typeof readinessProbe !== "function") {
    throw new Error("Meta query repository readiness probe is required");
  }
  const checkRepositoryReadiness = readinessProbe.bind(repository);
  const application: MetaQueryApplicationV1 = {
    async getJob(principal, metaJobId, traceId) {
      const safePrincipal = snapshotPrincipal(principal);
      assertIdentifier(metaJobId, "schema_validation_failed");
      assertIdentifier(traceId, "schema_validation_failed");
      const details = resolve(
        await repository.readAuthorizedJob(
          immutableSnapshot({
            meta_job_id: metaJobId,
            principal: safePrincipal,
          }),
        ),
        "meta_job_not_found",
        safePrincipal,
      );
      if (
        !Value.Check(MetaJobQueryDetailsV1Schema, details) ||
        details.job_id !== metaJobId ||
        details.bot_id !== safePrincipal.scope.bot_id
      ) {
        throw new MetaQueryErrorV1("owner_contract_drift");
      }
      try {
        assertMetaJobQueryDetailsSemanticBindingsV1(details);
      } catch {
        throw new MetaQueryErrorV1("owner_contract_drift");
      }
      return Object.freeze({
        code: "meta_job_found" as const,
        message: "meta job found" as const,
        retryable: false as const,
        trace_id: traceId,
        details: immutableSnapshot(details),
      });
    },

    async listQualitySignals(
      principal,
      triggerProcessId,
      query,
      traceId,
    ) {
      const safePrincipal = snapshotPrincipal(principal);
      const safeQuery = snapshotQuery(query, [
        "cursor",
        "limit",
        "severity",
        "signal_type",
      ]);
      assertIdentifier(triggerProcessId, "schema_validation_failed");
      assertIdentifier(traceId, "schema_validation_failed");
      const cursor = safeQuery.cursor ?? null;
      if (cursor !== null) assertIdentifier(cursor, "invalid_cursor");
      const limit = safeQuery.limit ?? 50;
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200) {
        throw new MetaQueryErrorV1("schema_validation_failed");
      }
      const severity = safeQuery.severity ?? null;
      if (
        severity !== null &&
        !["info", "warning", "error", "critical"].includes(severity)
      ) {
        throw new MetaQueryErrorV1("schema_validation_failed");
      }
      const signalType = safeQuery.signal_type ?? null;
      if (signalType !== null) {
        assertIdentifier(signalType, "schema_validation_failed");
        if (!QUALITY_SIGNAL_TYPES.has(signalType)) {
          throw new MetaQueryErrorV1("schema_validation_failed");
        }
      }
      const details = resolve(
        await repository.listAuthorizedQualitySignals(
          immutableSnapshot({
            trigger_process_id: triggerProcessId,
            principal: safePrincipal,
            cursor,
            limit,
            severity,
            signal_type: signalType,
            trace_id: traceId,
          }),
        ),
        "trigger_process_not_found",
        safePrincipal,
      );
      if (
        !Value.Check(QualitySignalListDetailsV1Schema, details) ||
        details.trigger_process_id !== triggerProcessId ||
        details.bot_id !== safePrincipal.scope.bot_id ||
        details.trace_id !== traceId
      ) {
        throw new MetaQueryErrorV1("owner_contract_drift");
      }
      try {
        assertQualitySignalListDetailsSemanticBindingsV1(details);
      } catch {
        throw new MetaQueryErrorV1("owner_contract_drift");
      }
      return Object.freeze({
        code: "quality_signals_found" as const,
        message: "quality signals found" as const,
        retryable: false as const,
        trace_id: traceId,
        details: immutableSnapshot(details),
      });
    },

    async getExperience(principal, triggerProcessId, traceId) {
      const safePrincipal = snapshotPrincipal(principal);
      assertIdentifier(triggerProcessId, "schema_validation_failed");
      assertIdentifier(traceId, "schema_validation_failed");
      const response = resolve(
        await repository.readAuthorizedExperience(
          immutableSnapshot({
            trigger_process_id: triggerProcessId,
            principal: safePrincipal,
            trace_id: traceId,
          }),
        ),
        "trigger_process_not_found",
        safePrincipal,
      );
      if (
        !Value.Check(MetaExperienceQueryResponseV1Schema, response) ||
        response.trigger_process_id !== triggerProcessId ||
        response.bot_id !== safePrincipal.scope.bot_id ||
        response.trace_id !== traceId
      ) {
        throw new MetaQueryErrorV1("owner_contract_drift");
      }
      return immutableSnapshot(response);
    },

    async listResultAudit(
      principal,
      metaResultId,
      query,
      traceId,
    ) {
      const safePrincipal = snapshotPrincipal(principal);
      const safeQuery = snapshotQuery(query, ["cursor", "limit"]);
      assertIdentifier(metaResultId, "schema_validation_failed");
      assertIdentifier(traceId, "schema_validation_failed");
      const cursor = safeQuery.cursor ?? null;
      if (cursor !== null) assertIdentifier(cursor, "invalid_cursor");
      const limit = safeQuery.limit ?? 50;
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200) {
        throw new MetaQueryErrorV1("schema_validation_failed");
      }
      const response = resolve(
        await repository.listAuthorizedResultAudit(
          immutableSnapshot({
            meta_result_id: metaResultId,
            principal: safePrincipal,
            cursor,
            limit,
            trace_id: traceId,
          }),
        ),
        "meta_result_not_found",
        safePrincipal,
      );
      if (
        !Value.Check(MetaResultAuditQueryResponseV1Schema, response) ||
        response.meta_result_id !== metaResultId ||
        response.bot_id !== safePrincipal.scope.bot_id ||
        response.trace_id !== traceId
      ) {
        throw new MetaQueryErrorV1("owner_contract_drift");
      }
      try {
        assertMetaResultAuditQueryResponseSemanticBindingsV1(response);
      } catch {
        throw new MetaQueryErrorV1("owner_contract_drift");
      }
      return immutableSnapshot(response);
    },

    async checkReadiness(signal) {
      await checkRepositoryReadiness(signal);
    },
  };
  return Object.freeze(application);
}
