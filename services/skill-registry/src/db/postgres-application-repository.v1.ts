import { randomUUID } from "node:crypto";

import {
  SKILL_RUNTIME_TARGET_V1,
  SkillValidateDetailsV1Schema,
  SkillValidateRequestV1Schema,
  assertSkillValidateResponseSemanticBindingsV1,
  type SkillValidateDetailsV1,
} from "@pai/contracts";
import type {
  SkillCatalogQueryDetailsV1,
  SkillContextCatalogDetailsV1,
  SkillPermissionSummaryV1,
} from "@pai/contracts";
import type {
  VerifiedOwnerPostgresCompositionV1,
} from "@pai/persistence";
import { Value } from "@sinclair/typebox/value";

import {
  canonicalHashV1,
  canonicalJsonV1,
} from "../canonical.v1.js";
import {
  SkillRegistryApplicationErrorV1,
  skillPermissionScopeHashV1,
  type SkillRegistryApplicationRepositoryPortV1,
  type SkillRegistryErrorCodeV1,
  type SkillContentAuthorizationV1,
  type SkillContentRequestV1,
  type SkillManagementResultV1,
  type SkillResolveResultV1,
  type ResolvedSkillV1,
  type SkillValidateRequestV1,
  type SkillValidationRecordV1,
} from "../skill-registry-application.v1.js";
import { SKILL_REGISTRY_REPOSITORY_CONTRACT_V1 } from "./permission-manifest.v1.js";

type ValidationCommitV1 = Parameters<
  SkillRegistryApplicationRepositoryPortV1["commitValidation"]
>[0];
type ValidationFailureCommitV1 = Parameters<
  SkillRegistryApplicationRepositoryPortV1["recordValidationFailure"]
>[0];
type PublishCommitV1 = Parameters<
  SkillRegistryApplicationRepositoryPortV1["publishVersion"]
>[0];
type ManagementCommitV1 = Parameters<
  SkillRegistryApplicationRepositoryPortV1["executeManagement"]
>[0];
type CatalogQueryCommitV1 = Parameters<
  SkillRegistryApplicationRepositoryPortV1["queryCatalog"]
>[0];
type ContextCatalogReadCommitV1 = Parameters<
  SkillRegistryApplicationRepositoryPortV1["readContextCatalog"]
>[0];
type ResolutionCommitV1 = Parameters<
  SkillRegistryApplicationRepositoryPortV1["resolveAttempt"]
>[0];
type CandidateApplicationCommitV1 = Parameters<
  SkillRegistryApplicationRepositoryPortV1["applyCandidateApplication"]
>[0];

const VALIDATION_FAILURE_CODES_V1 = new Set<SkillRegistryErrorCodeV1>([
  "content_integrity_mismatch",
  "invalid_skill_package",
  "package_scan_failed",
]);

// Published packages remain owner-readable while their immutable version can
// be activated or resolved.  The object-store implementation enforces this
// owner-retention fence on every read; GC can only transition it after this
// explicit initial retention window and the package-reference checks pass.
const PUBLISHED_SKILL_PACKAGE_RETENTION_MILLISECONDS_V1 =
  365 * 24 * 60 * 60 * 1_000;
const SKILL_REGISTRY_ADAPTER_READINESS_TIMEOUT_MS_V1 = 25_000;

export interface SkillValidationFailureEvidenceV1 {
  readonly code:
    | "content_integrity_mismatch"
    | "invalid_skill_package"
    | "package_scan_failed";
  readonly message: string;
  readonly details: Readonly<Record<string, unknown>>;
}

interface SkillValidationTerminalBaseV1 {
  readonly schema_version: "skill_validation_terminal.v1";
  readonly attempt_id: string;
  readonly idempotency_key: string;
  readonly request_hash: string;
  readonly request: SkillValidateRequestV1;
  readonly response_hash: string;
  readonly terminal_fingerprint: string;
  readonly expires_at: string;
  readonly actor_principal_id: string;
  readonly trace_id: string;
  readonly created_at: string;
}

export type SkillValidationTerminalFactV1 =
  | Readonly<
      SkillValidationTerminalBaseV1 & {
        readonly outcome: "approved";
        readonly validation_record: SkillValidationRecordV1;
        readonly success: SkillValidateDetailsV1;
      }
    >
  | Readonly<
      SkillValidationTerminalBaseV1 & {
        readonly outcome: "rejected";
        readonly error: SkillValidationFailureEvidenceV1;
      }
    >;

/**
 * Durable boundary used by both the verified PostgreSQL writer adapter and
 * restart/conformance tests. Implementations must return owner facts as
 * untrusted values; the repository validates every hash and semantic binding.
 */
export interface SkillRegistryValidationTerminalStorePortV1 {
  readonly durability: "postgresql";
  checkReadiness(): Promise<void>;
  readTerminal(idempotencyKey: string): Promise<unknown | undefined>;
  settleTerminal(candidate: SkillValidationTerminalFactV1): Promise<unknown>;
  readValidation(validationId: string): Promise<unknown | undefined>;
}

function terminalFingerprintV1(
  fact: Readonly<{
    idempotency_key: string;
    request_hash: string;
    actor_principal_id: string;
    outcome: "approved" | "rejected";
    response_hash: string;
    expires_at: string;
  }>,
): string {
  return canonicalHashV1({
    schema_version: "skill_validation_terminal_fingerprint.v1",
    idempotency_key: fact.idempotency_key,
    request_hash: fact.request_hash,
    actor_principal_id: fact.actor_principal_id,
    outcome: fact.outcome,
    response_hash: fact.response_hash,
    expires_at: fact.expires_at,
  });
}

function canonicalBoundarySnapshotV1<T>(value: unknown): T {
  return JSON.parse(canonicalJsonV1(value)) as T;
}

function validTimestampV1(value: unknown): value is string {
  return (
    typeof value === "string" &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

function validSha256V1(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^sha256:[0-9a-f]{64}$/u.test(value)
  );
}

function hasExactKeysV1(
  value: Readonly<Record<string, unknown>>,
  expected: readonly string[],
): boolean {
  return (
    Object.keys(value).sort().join("\u0000") ===
    [...expected].sort().join("\u0000")
  );
}

function validationRecordSnapshotV1(
  value: unknown,
  expectedStatus?: "approved",
): SkillValidationRecordV1 {
  const record =
    canonicalBoundarySnapshotV1<SkillValidationRecordV1>(value);
  if (
    typeof record !== "object" ||
    record === null ||
    !hasExactKeysV1(
      record as unknown as Readonly<Record<string, unknown>>,
      [
        "validation_id",
        "skill_id",
        "skill_name",
        "proposed_version",
        "artifact_ref",
        "object_access_decision_ref",
        "owner_object_id",
        "owner_state_version",
        "staging_state_version",
        "package_digest",
        "manifest_digest",
        "manifest",
        "runtime_target",
        "status",
        "expires_at",
        "media_type",
        "size_bytes",
        "provenance",
        "validation_result",
        "scanner_versions",
        "created_by",
      ],
    ) ||
    typeof record.validation_id !== "string" ||
    record.validation_id.length === 0 ||
    typeof record.skill_id !== "string" ||
    record.skill_id.length === 0 ||
    typeof record.skill_name !== "string" ||
    record.skill_name.length === 0 ||
    typeof record.proposed_version !== "string" ||
    record.proposed_version.length === 0 ||
    typeof record.artifact_ref !== "string" ||
    record.artifact_ref.length === 0 ||
    typeof record.object_access_decision_ref !== "string" ||
    record.object_access_decision_ref.length === 0 ||
    typeof record.owner_object_id !== "string" ||
    record.owner_object_id.length === 0 ||
    !Number.isSafeInteger(record.owner_state_version) ||
    record.owner_state_version < 1 ||
    !Number.isSafeInteger(record.staging_state_version) ||
    record.staging_state_version < 1 ||
    !validSha256V1(record.package_digest) ||
    !validSha256V1(record.manifest_digest) ||
    record.runtime_target !== SKILL_RUNTIME_TARGET_V1 ||
    ![
      "approved",
      "draft",
      "validating",
      "review_pending",
      "rejected",
    ].includes(record.status) ||
    (expectedStatus !== undefined &&
      record.status !== expectedStatus) ||
    !validTimestampV1(record.expires_at) ||
    typeof record.media_type !== "string" ||
    record.media_type.length === 0 ||
    !Number.isSafeInteger(record.size_bytes) ||
    record.size_bytes < 0 ||
    typeof record.provenance !== "object" ||
    record.provenance === null ||
    Array.isArray(record.provenance) ||
    typeof record.validation_result !== "object" ||
    record.validation_result === null ||
    Array.isArray(record.validation_result) ||
    typeof record.scanner_versions !== "object" ||
    record.scanner_versions === null ||
    Array.isArray(record.scanner_versions) ||
    typeof record.created_by !== "string" ||
    record.created_by.length === 0 ||
    canonicalHashV1(record.manifest) !== record.manifest_digest
  ) {
    throw new Error(
      "Skill Registry validation owner returned an invalid staging record",
    );
  }
  return Object.freeze(record);
}

function terminalFactSnapshotV1(
  value: unknown,
): SkillValidationTerminalFactV1 {
  const fact =
    canonicalBoundarySnapshotV1<SkillValidationTerminalFactV1>(value);
  const baseKeys = [
    "schema_version",
    "attempt_id",
    "idempotency_key",
    "request_hash",
    "request",
    "outcome",
    "response_hash",
    "terminal_fingerprint",
    "expires_at",
    "actor_principal_id",
    "trace_id",
    "created_at",
  ] as const;
  if (
    typeof fact !== "object" ||
    fact === null ||
    fact.schema_version !== "skill_validation_terminal.v1" ||
    typeof fact.attempt_id !== "string" ||
    fact.attempt_id.length === 0 ||
    typeof fact.idempotency_key !== "string" ||
    fact.idempotency_key.length === 0 ||
    !validSha256V1(fact.request_hash) ||
    !Value.Check(SkillValidateRequestV1Schema, fact.request) ||
    canonicalHashV1(fact.request) !== fact.request_hash ||
    fact.request.idempotency_key !== fact.idempotency_key ||
    !validSha256V1(fact.response_hash) ||
    !validSha256V1(fact.terminal_fingerprint) ||
    !validTimestampV1(fact.expires_at) ||
    typeof fact.actor_principal_id !== "string" ||
    fact.actor_principal_id.length === 0 ||
    fact.trace_id !== fact.request.trace_id ||
    !validTimestampV1(fact.created_at) ||
    terminalFingerprintV1(fact) !== fact.terminal_fingerprint
  ) {
    throw new Error(
      "Skill Registry validation owner returned invalid terminal evidence",
    );
  }
  if (fact.outcome === "approved") {
    if (
      !hasExactKeysV1(
        fact as unknown as Readonly<Record<string, unknown>>,
        [...baseKeys, "validation_record", "success"],
      )
    ) {
      throw new Error(
        "Skill Registry validation owner returned a non-exact success branch",
      );
    }
    const record = validationRecordSnapshotV1(
      fact.validation_record,
      "approved",
    );
    if (
      !Value.Check(SkillValidateDetailsV1Schema, fact.success) ||
      canonicalHashV1(fact.success) !== fact.response_hash ||
      record.validation_id !== fact.success.validation_id ||
      record.artifact_ref !== fact.request.artifact_ref ||
      record.package_digest !== fact.request.content_digest ||
      record.package_digest !== fact.success.package_digest ||
      record.manifest_digest !== fact.success.manifest_digest ||
      record.media_type !== fact.request.media_type ||
      record.size_bytes !== fact.request.size_bytes ||
      record.expires_at !== fact.expires_at ||
      record.created_by !== fact.actor_principal_id ||
      canonicalJsonV1(record.manifest) !==
        canonicalJsonV1(fact.success.normalized_manifest)
    ) {
      throw new Error(
        "Skill Registry validation owner returned unbound success evidence",
      );
    }
    assertSkillValidateResponseSemanticBindingsV1(fact.request, {
      code: "skill_package_validated",
      message: "skill package validated",
      retryable: false,
      trace_id: fact.trace_id,
      details: fact.success,
    });
    return Object.freeze({
      ...fact,
      validation_record: record,
    });
  }
  if (
    fact.outcome !== "rejected" ||
    !hasExactKeysV1(
      fact as unknown as Readonly<Record<string, unknown>>,
      [...baseKeys, "error"],
    ) ||
    typeof fact.error !== "object" ||
    fact.error === null ||
    !hasExactKeysV1(
      fact.error as unknown as Readonly<Record<string, unknown>>,
      ["code", "message", "details"],
    ) ||
    !VALIDATION_FAILURE_CODES_V1.has(fact.error.code) ||
    typeof fact.error.message !== "string" ||
    fact.error.message.length === 0 ||
    fact.error.message.length > 4_096 ||
    typeof fact.error.details !== "object" ||
    fact.error.details === null ||
    Array.isArray(fact.error.details) ||
    canonicalHashV1(fact.error) !== fact.response_hash
  ) {
    throw new Error(
      "Skill Registry validation owner returned unbound rejection evidence",
    );
  }
  return Object.freeze(fact);
}

function assertRequestBindingV1(
  fact: SkillValidationTerminalFactV1,
  request: SkillValidateRequestV1,
  requestHash: string,
  actorPrincipalId: string,
): void {
  if (
    fact.idempotency_key !== request.idempotency_key ||
    fact.request_hash !== requestHash ||
    fact.actor_principal_id !== actorPrincipalId
  ) {
    throw new SkillRegistryApplicationErrorV1(
      "idempotency_conflict",
      "validation idempotency body drift",
    );
  }
}

function assertNotExpiredV1(
  fact: SkillValidationTerminalFactV1,
  now: string,
): void {
  if (
    !validTimestampV1(now) ||
    Date.parse(now) >= Date.parse(fact.expires_at)
  ) {
    throw new SkillRegistryApplicationErrorV1(
      "validation_expired",
      "validation idempotency outcome has expired",
    );
  }
}

function terminalOutcomeV1(
  fact: SkillValidationTerminalFactV1,
): SkillValidateDetailsV1 {
  if (fact.outcome === "rejected") {
    throw new SkillRegistryApplicationErrorV1(
      fact.error.code,
      fact.error.message,
      fact.error.details,
    );
  }
  return canonicalBoundarySnapshotV1(fact.success);
}

function newOwnerIdentityV1(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

/**
 * Implements the validate/replay/read slice over an independently durable
 * store. It contains no process-local idempotency state, so a newly created
 * instance converges on the same committed owner fact after restart or a
 * commit-then-disconnect outcome.
 */
export class SkillRegistryDurableValidationRepositoryV1 {
  public constructor(
    private readonly store: SkillRegistryValidationTerminalStorePortV1,
  ) {}

  public async checkReadiness(): Promise<void> {
    await this.store.checkReadiness();
  }

  public async replayValidation(
    request: SkillValidateRequestV1,
    requestHash: string,
    actorPrincipalId: string,
    now: string,
  ): Promise<SkillValidateDetailsV1 | undefined> {
    const value = await this.store.readTerminal(request.idempotency_key);
    if (value === undefined) return undefined;
    const fact = terminalFactSnapshotV1(value);
    assertRequestBindingV1(
      fact,
      request,
      requestHash,
      actorPrincipalId,
    );
    assertNotExpiredV1(fact, now);
    return terminalOutcomeV1(fact);
  }

  public async commitValidation(
    commit: ValidationCommitV1,
  ): Promise<SkillValidateDetailsV1> {
    if (
      canonicalHashV1(commit.request) !== commit.request_hash ||
      commit.request.artifact_ref !== commit.artifact.artifact_ref ||
      commit.request.content_digest !== commit.package_digest ||
      commit.request.media_type !== commit.artifact.media_type ||
      commit.request.size_bytes !== commit.size_bytes ||
      !validTimestampV1(commit.now) ||
      !validTimestampV1(commit.expires_at) ||
      Date.parse(commit.expires_at) <= Date.parse(commit.now) ||
      canonicalHashV1(commit.manifest) !== commit.manifest_digest
    ) {
      throw new SkillRegistryApplicationErrorV1(
        "content_integrity_mismatch",
        "validated artifact drifted before owner commit",
      );
    }
    const validationId = newOwnerIdentityV1("sval");
    const result = canonicalBoundarySnapshotV1<SkillValidateDetailsV1>({
      validation_id: validationId,
      package_digest: commit.package_digest,
      manifest_digest: commit.manifest_digest,
      normalized_manifest: commit.manifest,
      diagnostics: commit.artifact.diagnostics,
      expires_at: commit.expires_at,
    });
    if (!Value.Check(SkillValidateDetailsV1Schema, result)) {
      throw new Error(
        "Skill Registry generated invalid validation success evidence",
      );
    }
    const validationRecord = validationRecordSnapshotV1(
      {
        validation_id: validationId,
        skill_id: commit.artifact.skill_id,
        skill_name: commit.artifact.skill_name,
        proposed_version: commit.artifact.proposed_version,
        artifact_ref: commit.artifact.artifact_ref,
        object_access_decision_ref:
          commit.artifact.object_access_decision_ref,
        owner_object_id: commit.artifact.owner_object_id,
        owner_state_version: commit.artifact.owner_state_version,
        staging_state_version: 1,
        package_digest: commit.package_digest,
        manifest_digest: commit.manifest_digest,
        manifest: commit.manifest,
        runtime_target: SKILL_RUNTIME_TARGET_V1,
        status: "approved",
        expires_at: commit.expires_at,
        media_type: commit.artifact.media_type,
        size_bytes: commit.size_bytes,
        provenance: commit.artifact.provenance,
        validation_result: commit.artifact.validation_result,
        scanner_versions: commit.artifact.scanner_versions,
        created_by: commit.actor_principal_id,
      },
      "approved",
    );
    const responseHash = canonicalHashV1(result);
    const fact = terminalFactSnapshotV1({
      schema_version: "skill_validation_terminal.v1",
      attempt_id: newOwnerIdentityV1("sval_attempt"),
      idempotency_key: commit.request.idempotency_key,
      request_hash: commit.request_hash,
      request: commit.request,
      outcome: "approved",
      validation_record: validationRecord,
      success: result,
      response_hash: responseHash,
      terminal_fingerprint: terminalFingerprintV1({
        idempotency_key: commit.request.idempotency_key,
        request_hash: commit.request_hash,
        actor_principal_id: commit.actor_principal_id,
        outcome: "approved",
        response_hash: responseHash,
        expires_at: commit.expires_at,
      }),
      expires_at: commit.expires_at,
      actor_principal_id: commit.actor_principal_id,
      trace_id: commit.request.trace_id,
      created_at: commit.now,
    });
    const settled = terminalFactSnapshotV1(
      await this.store.settleTerminal(fact),
    );
    assertRequestBindingV1(
      settled,
      commit.request,
      commit.request_hash,
      commit.actor_principal_id,
    );
    assertNotExpiredV1(settled, commit.now);
    return terminalOutcomeV1(settled);
  }

  public async recordValidationFailure(
    commit: ValidationFailureCommitV1,
  ): Promise<SkillValidateDetailsV1 | undefined> {
    if (
      canonicalHashV1(commit.request) !== commit.request_hash ||
      !VALIDATION_FAILURE_CODES_V1.has(commit.error.code) ||
      !validTimestampV1(commit.now) ||
      !validTimestampV1(commit.expires_at) ||
      Date.parse(commit.expires_at) <= Date.parse(commit.now)
    ) {
      throw new Error(
        "Skill Registry received invalid validation failure evidence",
      );
    }
    const error = canonicalBoundarySnapshotV1<
      SkillValidationFailureEvidenceV1
    >(commit.error);
    const responseHash = canonicalHashV1(error);
    const fact = terminalFactSnapshotV1({
      schema_version: "skill_validation_terminal.v1",
      attempt_id: newOwnerIdentityV1("sval_attempt"),
      idempotency_key: commit.request.idempotency_key,
      request_hash: commit.request_hash,
      request: commit.request,
      outcome: "rejected",
      error,
      response_hash: responseHash,
      terminal_fingerprint: terminalFingerprintV1({
        idempotency_key: commit.request.idempotency_key,
        request_hash: commit.request_hash,
        actor_principal_id: commit.actor_principal_id,
        outcome: "rejected",
        response_hash: responseHash,
        expires_at: commit.expires_at,
      }),
      expires_at: commit.expires_at,
      actor_principal_id: commit.actor_principal_id,
      trace_id: commit.request.trace_id,
      created_at: commit.now,
    });
    const settled = terminalFactSnapshotV1(
      await this.store.settleTerminal(fact),
    );
    assertRequestBindingV1(
      settled,
      commit.request,
      commit.request_hash,
      commit.actor_principal_id,
    );
    assertNotExpiredV1(settled, commit.now);
    if (settled.outcome === "approved") {
      return terminalOutcomeV1(settled);
    }
    throw new SkillRegistryApplicationErrorV1(
      settled.error.code,
      settled.error.message,
      settled.error.details,
    );
  }

  public async readValidation(
    validationId: string,
  ): Promise<SkillValidationRecordV1 | undefined> {
    const value = await this.store.readValidation(validationId);
    return value === undefined
      ? undefined
      : validationRecordSnapshotV1(value);
  }
}

type SkillRegistryPostgresCompositionV1 = Pick<
  VerifiedOwnerPostgresCompositionV1<
    typeof SKILL_REGISTRY_REPOSITORY_CONTRACT_V1
  >,
  | "deployment"
  | "read_committed_postgres"
  | "unit_of_work"
  | "checkReadiness"
>;

class OwnerWriterSkillValidationTerminalStoreV1
  implements SkillRegistryValidationTerminalStorePortV1
{
  public readonly durability = "postgresql" as const;

  public constructor(
    private readonly composition: SkillRegistryPostgresCompositionV1,
  ) {}

  public async checkReadiness(): Promise<void> {
    await this.composition.checkReadiness(
      AbortSignal.timeout(SKILL_REGISTRY_ADAPTER_READINESS_TIMEOUT_MS_V1),
    );
  }

  public async readTerminal(
    idempotencyKey: string,
  ): Promise<unknown | undefined> {
    return this.composition.read_committed_postgres
      .withReadCommittedTransaction(async (transaction) => {
        const result = await transaction.query<{
          terminal_fact: unknown;
        }>(
          `SELECT jsonb_build_object(
             'schema_version', 'skill_validation_terminal.v1',
             'attempt_id', attempt_id,
             'idempotency_key', idempotency_key,
             'request_hash', request_hash,
             'request', request_payload,
             'outcome', outcome,
             'response_hash', response_hash,
             'terminal_fingerprint', terminal_fingerprint,
             'expires_at', to_char(expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') || 'T' || to_char(expires_at AT TIME ZONE 'UTC', 'HH24:MI:SS.MS') || 'Z',
             'actor_principal_id', actor_principal_id,
             'trace_id', trace_id,
             'created_at', to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') || 'T' || to_char(created_at AT TIME ZONE 'UTC', 'HH24:MI:SS.MS') || 'Z'
           ) || CASE outcome
                  WHEN 'approved' THEN jsonb_build_object(
                    'validation_record', validation_record,
                    'success', success_payload
                  )
                  WHEN 'rejected' THEN jsonb_build_object(
                    'error', error_payload
                  )
                  ELSE '{}'::jsonb
                END AS terminal_fact
             FROM skill_registry.skill_validation_attempts
            WHERE idempotency_key = $1`,
          [idempotencyKey],
        );
        if (result.rows.length > 1) {
          throw new Error(
            "Skill Registry validation idempotency uniqueness drift",
          );
        }
        return result.rows[0]?.terminal_fact;
      });
  }

  public async settleTerminal(
    candidate: SkillValidationTerminalFactV1,
  ): Promise<unknown> {
    return this.composition.unit_of_work.withTransaction(
      {
        operation: "settle_skill_validation",
        idempotency_key: candidate.idempotency_key,
        trace_id: candidate.trace_id,
        isolation: "serializable",
        retry: "serialization_failures",
      },
      async (transaction, { owner }) =>
        owner.executeWriter<unknown, "settle_skill_validation_v1">(
          transaction,
          {
            writer: "settle_skill_validation_v1",
            arguments: {
              p_attempt_id: candidate.attempt_id,
              p_outcome: candidate.outcome,
              p_request: candidate.request,
              p_request_hash: candidate.request_hash,
              p_validation_record:
                candidate.outcome === "approved"
                  ? candidate.validation_record
                  : null,
              p_success:
                candidate.outcome === "approved"
                  ? candidate.success
                  : null,
              p_error:
                candidate.outcome === "rejected"
                  ? candidate.error
                  : null,
              p_response_hash: candidate.response_hash,
              p_terminal_fingerprint:
                candidate.terminal_fingerprint,
              p_idempotency_key: candidate.idempotency_key,
              p_expires_at: candidate.expires_at,
              p_actor_principal_id:
                candidate.actor_principal_id,
              p_trace_id: candidate.trace_id,
            },
            expected_rows: 1,
          },
        ),
    );
  }

  public async readValidation(
    validationId: string,
  ): Promise<unknown | undefined> {
    return this.composition.read_committed_postgres
      .withReadCommittedTransaction(async (transaction) => {
        const result = await transaction.query<{
          validation_record: unknown;
        }>(
          `SELECT jsonb_build_object(
             'validation_id', id,
             'skill_id', skill_id,
             'skill_name', skill_name,
             'proposed_version', proposed_version,
             'artifact_ref', artifact_ref,
             'object_access_decision_ref', object_access_decision_ref,
             'owner_object_id', owner_object_id,
             'owner_state_version', owner_state_version,
             'staging_state_version', staging_state_version,
             'package_digest', package_digest,
             'manifest_digest', manifest_digest,
             'manifest', manifest,
             'runtime_target', runtime_target,
             'status', status,
             'expires_at', to_char(validation_expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') || 'T' || to_char(validation_expires_at AT TIME ZONE 'UTC', 'HH24:MI:SS.MS') || 'Z',
             'media_type', media_type,
             'size_bytes', size_bytes,
             'provenance', provenance,
             'validation_result', validation_result,
             'scanner_versions', scanner_versions,
             'created_by', created_by
           ) AS validation_record
             FROM skill_registry.skill_version_staging
            WHERE id = $1`,
          [validationId],
        );
        if (result.rows.length > 1) {
          throw new Error(
            "Skill Registry validation identity uniqueness drift",
          );
        }
        return result.rows[0]?.validation_record;
      });
  }
}

class SkillRegistryPostgresApplicationRepositoryV1
  implements SkillRegistryApplicationRepositoryPortV1
{
  public readonly persistence_kind = "postgresql" as const;

  public constructor(
    private readonly validation:
      SkillRegistryDurableValidationRepositoryV1,
    private readonly delegate:
      SkillRegistryApplicationRepositoryPortV1,
  ) {}

  public async checkReadiness(): Promise<void> {
    await Promise.all([
      this.validation.checkReadiness(),
      this.delegate.checkReadiness(),
    ]);
  }

  public replayValidation(
    ...args: Parameters<
      SkillRegistryApplicationRepositoryPortV1["replayValidation"]
    >
  ): ReturnType<
    SkillRegistryApplicationRepositoryPortV1["replayValidation"]
  > {
    return this.validation.replayValidation(...args);
  }

  public commitValidation(
    commit: ValidationCommitV1,
  ): Promise<SkillValidateDetailsV1> {
    return this.validation.commitValidation(commit);
  }

  public recordValidationFailure(
    commit: ValidationFailureCommitV1,
  ): Promise<SkillValidateDetailsV1 | undefined> {
    return this.validation.recordValidationFailure(commit);
  }

  public readValidation(
    validationId: string,
  ): Promise<SkillValidationRecordV1 | undefined> {
    return this.validation.readValidation(validationId);
  }

  public replayPublish(
    ...args: Parameters<
      SkillRegistryApplicationRepositoryPortV1["replayPublish"]
    >
  ): ReturnType<
    SkillRegistryApplicationRepositoryPortV1["replayPublish"]
  > {
    return this.delegate.replayPublish(...args);
  }

  public publishVersion(
    commit: PublishCommitV1,
  ): ReturnType<
    SkillRegistryApplicationRepositoryPortV1["publishVersion"]
  > {
    return this.delegate.publishVersion(commit);
  }

  public executeManagement(
    commit: ManagementCommitV1,
  ): ReturnType<
    SkillRegistryApplicationRepositoryPortV1["executeManagement"]
  > {
    return this.delegate.executeManagement(commit);
  }

  public queryCatalog(
    commit: CatalogQueryCommitV1,
  ): ReturnType<
    SkillRegistryApplicationRepositoryPortV1["queryCatalog"]
  > {
    return this.delegate.queryCatalog(commit);
  }

  public readContextCatalog(
    commit: ContextCatalogReadCommitV1,
  ): ReturnType<
    SkillRegistryApplicationRepositoryPortV1["readContextCatalog"]
  > {
    return this.delegate.readContextCatalog(commit);
  }

  public readPermissionSummary(
    ...args: Parameters<
      SkillRegistryApplicationRepositoryPortV1["readPermissionSummary"]
    >
  ): ReturnType<
    SkillRegistryApplicationRepositoryPortV1["readPermissionSummary"]
  > {
    return this.delegate.readPermissionSummary(...args);
  }

  public replayResolutionAttempt(
    ...args: Parameters<
      SkillRegistryApplicationRepositoryPortV1["replayResolutionAttempt"]
    >
  ): ReturnType<
    SkillRegistryApplicationRepositoryPortV1["replayResolutionAttempt"]
  > {
    return this.delegate.replayResolutionAttempt(...args);
  }

  public recordResolutionFailure(
    ...args: Parameters<
      SkillRegistryApplicationRepositoryPortV1["recordResolutionFailure"]
    >
  ): ReturnType<
    SkillRegistryApplicationRepositoryPortV1["recordResolutionFailure"]
  > {
    return this.delegate.recordResolutionFailure(...args);
  }

  public resolveAttempt(
    commit: ResolutionCommitV1,
  ): ReturnType<
    SkillRegistryApplicationRepositoryPortV1["resolveAttempt"]
  > {
    return this.delegate.resolveAttempt(commit);
  }

  public authorizeContent(
    ...args: Parameters<
      SkillRegistryApplicationRepositoryPortV1["authorizeContent"]
    >
  ): ReturnType<
    SkillRegistryApplicationRepositoryPortV1["authorizeContent"]
  > {
    return this.delegate.authorizeContent(...args);
  }

  public recordContentAudit(
    ...args: Parameters<
      SkillRegistryApplicationRepositoryPortV1["recordContentAudit"]
    >
  ): ReturnType<
    SkillRegistryApplicationRepositoryPortV1["recordContentAudit"]
  > {
    return this.delegate.recordContentAudit(...args);
  }

  public applyCandidateApplication(
    commit: CandidateApplicationCommitV1,
  ): ReturnType<
    SkillRegistryApplicationRepositoryPortV1["applyCandidateApplication"]
  > {
    return this.delegate.applyCandidateApplication(commit);
  }
}

interface PostgresCatalogRowV1 extends Record<string, unknown> {
  readonly catalog_revision_id: string;
  readonly catalog_version: string;
  readonly catalog_as_of: string;
  readonly security_revocation_epoch: number | string;
}

interface PostgresCatalogEntryRowV1 extends Record<string, unknown> {
  readonly skill_id: string;
  readonly skill_key: string;
  readonly skill_name: string;
  readonly description: string;
  readonly activation_revision_id: string;
  readonly activation_state: string;
  readonly version_id: string;
  readonly version: string;
  readonly lifecycle_state: string;
  readonly package_digest: string;
  readonly manifest_digest: string;
}

interface PostgresPermissionRowV1 extends Record<string, unknown> {
  readonly skill_id: string;
  readonly permission_revision_id: string;
  readonly revision_no: number | string;
  readonly decision: string;
  readonly capability_refs: readonly string[];
  readonly scope_hash: string;
  readonly owner_agent_id: string | null;
}

interface PostgresVersionRowV1 extends Record<string, unknown> {
  readonly id: string;
  readonly skill_id: string;
  readonly skill_key: string;
  readonly version: string;
  readonly package_digest: string;
  readonly manifest_digest: string;
  readonly lifecycle_state: "published" | "deprecated" | "revoked";
  readonly lifecycle_version: number | string;
  readonly revocation_epoch: number | string;
}

interface PostgresActivationRowV1 extends Record<string, unknown> {
  readonly id: string;
  readonly skill_id: string;
  readonly version_id: string | null;
  readonly state: "active" | "disabled";
  readonly revision_no: number | string;
}

interface PostgresResolutionAttemptV1 {
  readonly id: string;
  readonly runtime_run_id: string;
  readonly start_attempt_no: number;
  readonly request_hash: string;
  readonly idempotency_key: string;
  readonly status: "resolving" | "resolved" | "failed";
  readonly error_code: string | null;
  readonly requested_catalog_version: string;
  readonly catalog_revision_id: string | null;
  readonly security_revocation_epoch: number;
  readonly policy_input_hash: string;
  readonly skill_permission_summary_ref: string;
  readonly skill_permission_summary_hash: string;
  readonly response_payload: unknown;
  readonly valid_until: string | null;
}

/**
 * Production delegate for all registry workflows whose durable PostgreSQL
 * ownership is implemented here. Validation is deliberately supplied by the
 * dedicated validation repository in the outer composition; no workflow may
 * fall back to process-local state.
 */
class SkillRegistryPostgresDelegateV1
  implements SkillRegistryApplicationRepositoryPortV1
{
  public readonly persistence_kind = "postgresql" as const;

  public constructor(
    private readonly composition: SkillRegistryPostgresCompositionV1,
  ) {}

  public async checkReadiness(): Promise<void> {
    await this.composition.checkReadiness(
      AbortSignal.timeout(SKILL_REGISTRY_ADAPTER_READINESS_TIMEOUT_MS_V1),
    );
  }

  #unsupported(operation: string): never {
    throw new SkillRegistryApplicationErrorV1(
      "registry_unavailable",
      `Skill Registry durable ${operation} transaction is unavailable`,
      { operation },
    );
  }

  async #readCatalog(
    scope: Readonly<{
      workspace_id: string;
      bot_id: string;
      deployment_environment: string;
      release_channel: string;
    }>,
    asOf?: string,
  ): Promise<Readonly<{
    catalog_revision_id: string;
    catalog_version: string;
    catalog_as_of: string;
    security_revocation_epoch: number;
  }> | undefined> {
    const result = await this.composition.read_committed_postgres
      .withReadCommittedTransaction((transaction) =>
        transaction.query<PostgresCatalogRowV1>(
          `SELECT revision.id AS catalog_revision_id,
                  revision.catalog_version,
                  to_char(revision.catalog_as_of AT TIME ZONE 'UTC', 'YYYY-MM-DD')
                    || 'T' || to_char(revision.catalog_as_of AT TIME ZONE 'UTC', 'HH24:MI:SS.MS')
                    || 'Z' AS catalog_as_of,
                  security.security_revocation_epoch
             FROM skill_registry.skill_catalog_revisions AS revision
             LEFT JOIN skill_registry.skill_catalog_current AS current
               ON current.catalog_revision_id = revision.id
             JOIN skill_registry.skill_security_state AS security
               ON security.singleton_key = TRUE
            WHERE revision.workspace_id = $1::text
              AND revision.bot_id = $2::text
              AND revision.deployment_environment = $3::text
              AND revision.release_channel = $4::text
              AND (
                ($5::timestamptz IS NULL AND current.catalog_revision_id = revision.id)
                OR ($5::timestamptz IS NOT NULL AND revision.catalog_as_of = $5::timestamptz)
              )
            ORDER BY revision.catalog_as_of DESC
            LIMIT 2`,
          [
            scope.workspace_id,
            scope.bot_id,
            scope.deployment_environment,
            scope.release_channel,
            asOf ?? null,
          ],
        ),
      );
    if (result.rows.length !== 1) return undefined;
    const row = result.rows[0]!;
    const epoch = Number(row.security_revocation_epoch);
    if (!Number.isSafeInteger(epoch) || epoch < 0) {
      throw new Error("Skill Registry security epoch is invalid");
    }
    return Object.freeze({
      catalog_revision_id: row.catalog_revision_id,
      catalog_version: row.catalog_version,
      catalog_as_of: row.catalog_as_of,
      security_revocation_epoch: epoch,
    });
  }

  async #readCatalogEntries(
    catalogRevisionId: string,
  ): Promise<readonly PostgresCatalogEntryRowV1[]> {
    const result = await this.composition.read_committed_postgres
      .withReadCommittedTransaction((transaction) =>
        transaction.query<PostgresCatalogEntryRowV1>(
          `SELECT entry.skill_id, skill.skill_key, skill.name AS skill_name,
                  skill.description, entry.activation_revision_id,
                  activation.state AS activation_state, entry.version_id,
                  version.version, version.lifecycle_state,
                  entry.package_digest, entry.manifest_digest
             FROM skill_registry.skill_catalog_revision_entries AS entry
             JOIN skill_registry.skills AS skill ON skill.id = entry.skill_id
             JOIN skill_registry.skill_activation_revisions AS activation
               ON activation.id = entry.activation_revision_id
             JOIN skill_registry.skill_versions AS version
               ON version.id = entry.version_id
            WHERE entry.catalog_revision_id = $1::text
            ORDER BY entry.skill_id ASC`,
          [catalogRevisionId],
        ),
      );
    return Object.freeze(result.rows.map((row) => Object.freeze({ ...row })));
  }

  async #readPermissions(
    scope: Readonly<{
      workspace_id: string;
      bot_id: string;
      owner_agent_id: string;
      deployment_environment: string;
      release_channel: string;
    }>,
  ): Promise<ReadonlyMap<string, Readonly<{
    general?: PostgresPermissionRowV1;
    specific?: PostgresPermissionRowV1;
  }>>> {
    // The hash includes the skill id. Query all current revisions in this
    // four-tuple and classify each row from its persisted owner condition;
    // recomputing per skill below detects any corrupted scope hash.
    const result = await this.composition.read_committed_postgres
      .withReadCommittedTransaction((transaction) =>
        transaction.query<PostgresPermissionRowV1>(
          `SELECT current.skill_id, revision.id AS permission_revision_id,
                  revision.revision_no, revision.decision,
                  revision.capability_refs, revision.scope_hash,
                  revision.owner_agent_id
             FROM skill_registry.skill_permission_current AS current
             JOIN skill_registry.skill_permission_revisions AS revision
               ON revision.id = current.permission_revision_id
            WHERE current.workspace_id = $1::text
              AND current.bot_id = $2::text
              AND current.deployment_environment = $3::text
              AND current.release_channel = $4::text
              AND (
                revision.owner_agent_id IS NULL
                OR revision.owner_agent_id = $5::text
              )`,
          [
            scope.workspace_id,
            scope.bot_id,
            scope.deployment_environment,
            scope.release_channel,
            scope.owner_agent_id,
          ],
        ),
      );
    const bySkill = new Map<string, { general?: PostgresPermissionRowV1; specific?: PostgresPermissionRowV1 }>();
    for (const row of result.rows) {
      const expected = canonicalHashV1({
        workspace_id: scope.workspace_id,
        bot_id: scope.bot_id,
        deployment_environment: scope.deployment_environment,
        release_channel: scope.release_channel,
        skill_id: row.skill_id,
        owner_agent_id: row.owner_agent_id,
      });
      if (row.scope_hash !== expected) {
        throw new Error("Skill Registry permission scope hash drift");
      }
      const existing = bySkill.get(row.skill_id) ?? {};
      if (row.owner_agent_id === null) existing.general = row;
      else existing.specific = row;
      bySkill.set(row.skill_id, existing);
    }
    return bySkill;
  }

  async #readSummary(
    reference: string,
  ): Promise<SkillPermissionSummaryV1 | undefined> {
    const snapshot = await this.composition.read_committed_postgres
      .withReadCommittedTransaction(async (transaction) => {
        const headers = await transaction.query<{
          summary_ref: string;
          workspace_id: string;
          bot_id: string;
          owner_agent_id: string;
          deployment_environment: string;
          release_channel: string;
          catalog_revision_id: string;
          catalog_version: string;
          catalog_as_of: string;
          security_revocation_epoch: number | string;
          summary_hash: string;
        }>(
          `SELECT summary_ref, workspace_id, bot_id, owner_agent_id,
                  deployment_environment, release_channel, catalog_revision_id,
                  catalog_version,
                  to_char(catalog_as_of AT TIME ZONE 'UTC', 'YYYY-MM-DD') || 'T' || to_char(catalog_as_of AT TIME ZONE 'UTC', 'HH24:MI:SS.MS') || 'Z' AS catalog_as_of,
                  security_revocation_epoch, summary_hash
             FROM skill_registry.skill_permission_summary_snapshots
            WHERE summary_ref = $1::text
            LIMIT 2`,
          [reference],
        );
        if (headers.rows.length !== 1) return undefined;
        const entries = await transaction.query<{
          skill_id: string;
          skill_key: string;
          activation_revision_id: string;
          version_id: string;
          decision: "grant" | "deny";
          decision_source: "revision" | "default_deny";
          permission_revision_id: string | null;
          revision_no: number | string | null;
          scope_hash: string | null;
          owner_agent_condition: string | null;
          capability_refs: readonly string[];
        }>(
          `SELECT skill_id, skill_key, activation_revision_id, version_id,
                  decision, decision_source, permission_revision_id,
                  revision_no, scope_hash, owner_agent_condition, capability_refs
             FROM skill_registry.skill_permission_summary_entries
            WHERE summary_ref = $1::text
            ORDER BY skill_id ASC`,
          [reference],
        );
        return { header: headers.rows[0]!, entries: entries.rows };
      });
    if (snapshot === undefined) return undefined;
    const epoch = Number(snapshot.header.security_revocation_epoch);
    const entries = snapshot.entries.map((entry) => {
      if (entry.decision_source === "default_deny") {
        return Object.freeze({
          skill_id: entry.skill_id,
          skill_key: entry.skill_key,
          activation_revision_id: entry.activation_revision_id,
          version_id: entry.version_id,
          decision_source: "default_deny" as const,
          decision: "deny" as const,
          capability_refs: [],
        });
      }
      const revisionNo = Number(entry.revision_no);
      if (!Number.isSafeInteger(revisionNo) || revisionNo < 1 ||
          entry.permission_revision_id === null || entry.scope_hash === null) {
        throw new Error("Skill Registry permission summary revision is invalid");
      }
      return Object.freeze({
        skill_id: entry.skill_id,
        skill_key: entry.skill_key,
        activation_revision_id: entry.activation_revision_id,
        version_id: entry.version_id,
        decision_source: "revision" as const,
        permission_revision_id: entry.permission_revision_id,
        revision_no: revisionNo,
        decision: entry.decision,
        scope_hash: entry.scope_hash,
        owner_agent_condition: entry.owner_agent_condition,
        capability_refs: [...entry.capability_refs].sort(),
      });
    });
    if (!Number.isSafeInteger(epoch) || epoch < 0) {
      throw new Error("Skill Registry permission summary epoch is invalid");
    }
    const summary = Object.freeze({
      schema_version: "skill_permission_summary.v1" as const,
      summary_ref: snapshot.header.summary_ref,
      workspace_id: snapshot.header.workspace_id,
      bot_id: snapshot.header.bot_id,
      owner_agent_id: snapshot.header.owner_agent_id,
      deployment_environment: snapshot.header.deployment_environment as "local" | "dev" | "staging" | "prod",
      release_channel: snapshot.header.release_channel as "stable" | "canary",
      catalog_revision_id: snapshot.header.catalog_revision_id,
      catalog_version: snapshot.header.catalog_version,
      catalog_as_of: snapshot.header.catalog_as_of,
      security_revocation_epoch: epoch,
      entries,
      summary_hash: snapshot.header.summary_hash,
    }) as SkillPermissionSummaryV1;
    const { summary_hash: storedHash, ...hashable } = summary;
    if (canonicalHashV1(hashable) !== storedHash) {
      throw new Error("Skill Registry permission summary hash drift");
    }
    return summary;
  }

  async #loadOrCreateSummary(
    catalog: Readonly<{
      catalog_revision_id: string;
      catalog_version: string;
      catalog_as_of: string;
      security_revocation_epoch: number;
    }>,
    scope: Readonly<{
      workspace_id: string;
      bot_id: string;
      owner_agent_id: string;
      deployment_environment: string;
      release_channel: string;
    }>,
    traceId: string,
  ): Promise<SkillPermissionSummaryV1> {
    const existing = await this.composition.read_committed_postgres
      .withReadCommittedTransaction((transaction) =>
        transaction.query<{ summary_ref: string }>(
          `SELECT summary_ref
             FROM skill_registry.skill_permission_summary_snapshots
            WHERE workspace_id = $1::text AND bot_id = $2::text
              AND owner_agent_id = $3::text
              AND deployment_environment = $4::text AND release_channel = $5::text
              AND catalog_revision_id = $6::text
            LIMIT 2`,
          [scope.workspace_id, scope.bot_id, scope.owner_agent_id,
            scope.deployment_environment, scope.release_channel,
            catalog.catalog_revision_id],
        ),
      );
    if (existing.rows.length === 1) {
      const summary = await this.#readSummary(existing.rows[0]!.summary_ref);
      if (summary === undefined) throw new Error("Skill Registry permission summary disappeared");
      return summary;
    }
    if (existing.rows.length > 1) throw new Error("Skill Registry permission summary uniqueness drift");

    const entries = await this.#readCatalogEntries(catalog.catalog_revision_id);
    const permissions = await this.#readPermissions(scope);
    const summaryRef = `skill_permission_summary_${randomUUID()}`;
    const summaryEntries = entries
      .slice()
      .sort((left, right) => left.skill_id.localeCompare(right.skill_id, "en"))
      .map((entry) => {
        const state = permissions.get(entry.skill_id);
        const effective = state?.general?.decision === "deny"
          ? state.general
          : state?.specific?.decision === "deny"
            ? state.specific
            : state?.specific ?? state?.general;
        if (effective === undefined) {
          return Object.freeze({
            skill_id: entry.skill_id,
            skill_key: entry.skill_key,
            activation_revision_id: entry.activation_revision_id,
            version_id: entry.version_id,
            decision_source: "default_deny" as const,
            decision: "deny" as const,
            capability_refs: [],
          });
        }
        const revisionNo = Number(effective.revision_no);
        if (!Number.isSafeInteger(revisionNo) || revisionNo < 1) {
          throw new Error("Skill Registry permission revision is invalid");
        }
        return Object.freeze({
          skill_id: entry.skill_id,
          skill_key: entry.skill_key,
          activation_revision_id: entry.activation_revision_id,
          version_id: entry.version_id,
          decision_source: "revision" as const,
          permission_revision_id: effective.permission_revision_id,
          revision_no: revisionNo,
          decision: effective.decision === "allow" ? "grant" as const : "deny" as const,
          scope_hash: effective.scope_hash,
          owner_agent_condition: effective.owner_agent_id,
          capability_refs: [...effective.capability_refs].sort(),
        });
      });
    const hashable = {
      schema_version: "skill_permission_summary.v1" as const,
      summary_ref: summaryRef,
      workspace_id: scope.workspace_id,
      bot_id: scope.bot_id,
      owner_agent_id: scope.owner_agent_id,
      deployment_environment:
        scope.deployment_environment as "local" | "dev" | "staging" | "prod",
      release_channel:
        scope.release_channel as "stable" | "canary",
      catalog_revision_id: catalog.catalog_revision_id,
      catalog_version: catalog.catalog_version,
      catalog_as_of: catalog.catalog_as_of,
      security_revocation_epoch: catalog.security_revocation_epoch,
      entries: summaryEntries,
    };
    const summary: SkillPermissionSummaryV1 = Object.freeze({
      ...hashable,
      summary_hash: canonicalHashV1(hashable),
    });
    const canonicalBytes = `\\x${Buffer.from(canonicalJsonV1(hashable), "utf8").toString("hex")}`;
    const writerPayload = {
      skill_permission_summary_snapshots: {
        ...summary,
        canonical_bytes: canonicalBytes,
      },
      skill_permission_summary_entries: summary.entries.map((entry, index) => ({
        ...entry,
        ordinal: index + 1,
        decision: entry.decision,
        decision_source: entry.decision_source,
      })),
      skill_audit_logs: [{
        id: `skill_permission_summary_audit:${summaryRef}`,
        actor: "skill_registry",
        action: "skill.permission_summary.snapshotted",
        decision: "allow",
        reason_code: "catalog_query",
        payload: { summary_ref: summaryRef, catalog_revision_id: catalog.catalog_revision_id },
        trace_id: traceId,
      }],
    };
    await this.composition.unit_of_work.withTransaction(
      {
        operation: "create_skill_permission_summary_snapshot",
        idempotency_key: summaryRef,
        trace_id: traceId,
        isolation: "serializable",
        retry: "serialization_failures",
      },
      (transaction, { owner }) => owner.executeWriter<unknown, "create_skill_permission_summary_snapshot_v1">(
        transaction,
        {
          writer: "create_skill_permission_summary_snapshot_v1",
          arguments: {
            p_summary_ref: summaryRef,
            p_summary: writerPayload,
            p_idempotency_key: summaryRef,
            p_request_hash: summary.summary_hash,
            p_trace_id: traceId,
          },
          expected_rows: 1,
        },
      ),
    );
    const persisted = await this.#readSummary(summaryRef);
    if (persisted === undefined) throw new Error("Skill Registry permission summary was not persisted");
    return persisted;
  }

  #resolutionAttemptId(runtimeRunId: string, startAttemptNo: number): string {
    return `sres_attempt_${canonicalHashV1({
      runtime_run_id: runtimeRunId,
      start_attempt_no: startAttemptNo,
    }).slice("sha256:".length)}`;
  }

  #resolutionId(attemptId: string, skillKey: string): string {
    return `sres_${canonicalHashV1({
      resolution_attempt_id: attemptId,
      skill_key: skillKey,
    }).slice("sha256:".length)}`;
  }

  async #readAttempt(
    runtimeRunId: string,
    startAttemptNo: number,
  ): Promise<PostgresResolutionAttemptV1 | undefined> {
    const result = await this.composition.read_committed_postgres
      .withReadCommittedTransaction((transaction) =>
        transaction.query<{
          id: string;
          runtime_run_id: string;
          start_attempt_no: number | string;
          request_hash: string;
          idempotency_key: string;
          status: "resolving" | "resolved" | "failed";
          error_code: string | null;
          requested_catalog_version: string;
          catalog_revision_id: string | null;
          security_revocation_epoch: number | string | null;
          policy_input_hash: string;
          skill_permission_summary_ref: string;
          skill_permission_summary_hash: string;
          response_payload: unknown;
          valid_until: string | null;
        }>(
          `SELECT attempt.id, attempt.runtime_run_id, attempt.start_attempt_no,
                  attempt.request_hash, attempt.idempotency_key,
                  attempt.status, attempt.error_code,
                  attempt.requested_catalog_version,
                  revision.id AS catalog_revision_id,
                  attempt.security_revocation_epoch,
                  attempt.policy_input_hash,
                  attempt.skill_permission_summary_ref,
                  attempt.skill_permission_summary_hash,
                  attempt.response_payload,
                  CASE WHEN attempt.valid_until IS NULL THEN NULL
                    ELSE to_char(attempt.valid_until AT TIME ZONE 'UTC', 'YYYY-MM-DD') || 'T' || to_char(attempt.valid_until AT TIME ZONE 'UTC', 'HH24:MI:SS.MS') || 'Z'
                  END AS valid_until
             FROM skill_registry.skill_resolution_attempts AS attempt
             LEFT JOIN skill_registry.skill_catalog_revisions AS revision
               ON revision.workspace_id = attempt.workspace_id
              AND revision.bot_id = attempt.bot_id
              AND revision.deployment_environment = attempt.deployment_environment
              AND revision.release_channel = attempt.release_channel
              AND revision.catalog_version = attempt.requested_catalog_version
              AND revision.catalog_as_of = attempt.catalog_as_of
            WHERE attempt.runtime_run_id = $1::text
              AND attempt.start_attempt_no = $2::integer
            LIMIT 2`,
          [runtimeRunId, startAttemptNo],
        ),
      );
    if (result.rows.length === 0) return undefined;
    if (result.rows.length !== 1) {
      throw new Error("Skill resolution attempt uniqueness drift");
    }
    const row = result.rows[0]!;
    const epoch = Number(row.security_revocation_epoch);
    const persistedStartAttemptNo = Number(row.start_attempt_no);
    if (!Number.isSafeInteger(epoch) || epoch < 0) {
      throw new Error("Skill resolution attempt security epoch is invalid");
    }
    if (!Number.isSafeInteger(persistedStartAttemptNo) || persistedStartAttemptNo < 1) {
      throw new Error("Skill resolution attempt number is invalid");
    }
    return Object.freeze({
      ...row,
      start_attempt_no: persistedStartAttemptNo,
      security_revocation_epoch: epoch,
    });
  }

  async #ensureResolvingAttempt(
    commit: ResolutionCommitV1,
    catalog: Readonly<{
      catalog_revision_id: string;
      catalog_version: string;
      catalog_as_of: string;
      security_revocation_epoch: number;
    }>,
  ): Promise<PostgresResolutionAttemptV1> {
    const attemptId = this.#resolutionAttemptId(
      commit.request.runtime_run_id,
      commit.request.start_attempt_no,
    );
    const idempotencyKey = `skill_resolution:${commit.request.runtime_run_id}:${commit.request.start_attempt_no}`;
    const existing = await this.#readAttempt(
      commit.request.runtime_run_id,
      commit.request.start_attempt_no,
    );
    if (existing !== undefined) {
      if (existing.request_hash !== commit.request_hash) {
        throw new SkillRegistryApplicationErrorV1(
          "idempotency_conflict",
          "resolution attempt body drift",
        );
      }
      return existing;
    }
    const payload = {
      skill_resolution_attempts: {
        id: attemptId,
        runtime_run_id: commit.request.runtime_run_id,
        start_attempt_no: commit.request.start_attempt_no,
        workspace_id: commit.request.workspace_id,
        bot_id: commit.request.bot_id,
        owner_agent_id: commit.request.owner_agent_id,
        deployment_environment: commit.request.deployment_environment,
        release_channel: commit.request.release_channel,
        policy_input_ref: commit.request.policy_input_ref,
        policy_input_hash: commit.request.policy_input_hash,
        policy_input_created_at: commit.policy.policy.created_at,
        policy_expires_at: commit.policy.policy.expires_at,
        requested_catalog_version: commit.request.expected_catalog_version,
        catalog_as_of: commit.request.catalog_as_of,
        security_revocation_epoch: catalog.security_revocation_epoch,
        skill_permission_summary_ref: commit.summary.summary_ref,
        skill_permission_summary_hash: commit.summary.summary_hash,
        request_hash: commit.request_hash,
        idempotency_key: idempotencyKey,
        status: "resolving",
        trace_id: commit.request.trace_id,
      },
      skill_audit_logs: [{
        id: `skill_resolution_started:${attemptId}`,
        runtime_run_id: commit.request.runtime_run_id,
        actor: "skill_registry",
        action: "skill.resolution.started",
        decision: "allow",
        reason_code: "resolve",
        payload: {
          resolution_attempt_id: attemptId,
          request_hash: commit.request_hash,
          catalog_revision_id: catalog.catalog_revision_id,
        },
        trace_id: commit.request.trace_id,
      }],
    };
    await this.composition.unit_of_work.withTransaction(
      {
        operation: "create_skill_resolution_attempt",
        idempotency_key: idempotencyKey,
        trace_id: commit.request.trace_id,
        isolation: "serializable",
        retry: "serialization_failures",
      },
      (transaction, { owner }) => owner.executeWriter<unknown, "create_skill_resolution_attempt_v1">(
        transaction,
        {
          writer: "create_skill_resolution_attempt_v1",
          arguments: {
            p_attempt_id: attemptId,
            p_attempt: payload,
            p_idempotency_key: idempotencyKey,
            p_request_hash: commit.request_hash,
            p_trace_id: commit.request.trace_id,
          },
          expected_rows: 1,
        },
      ),
    );
    const persisted = await this.#readAttempt(
      commit.request.runtime_run_id,
      commit.request.start_attempt_no,
    );
    if (persisted === undefined) {
      throw new Error("Skill resolution attempt was not persisted");
    }
    if (persisted.request_hash !== commit.request_hash ||
        persisted.id !== attemptId || persisted.status !== "resolving") {
      throw new Error("Skill resolution attempt persistence drift");
    }
    return persisted;
  }

  async #failResolutionAttempt(
    attempt: PostgresResolutionAttemptV1,
    error: SkillRegistryApplicationErrorV1,
    traceId: string,
  ): Promise<void> {
    if (attempt.catalog_revision_id === null) {
      throw new Error("Skill resolution attempt catalog revision is unavailable");
    }
    const completion = {
      skill_resolution_attempts: {
        id: attempt.id,
        status: "failed",
        error_code: error.code,
        completed_at: new Date().toISOString(),
      },
      skill_catalog_revisions: { id: attempt.catalog_revision_id },
      skill_security_state: { singleton_key: true },
      skill_audit_logs: [{
        id: `skill_resolution_failed:${attempt.id}`,
        runtime_run_id: attempt.runtime_run_id,
        actor: "skill_registry",
        action: "skill.resolution.failed",
        decision: "deny",
        reason_code: error.code,
        payload: {
          resolution_attempt_id: attempt.id,
          error_code: error.code,
          details: error.details,
        },
        trace_id: traceId,
      }],
    };
    await this.composition.unit_of_work.withTransaction(
      {
        operation: "fail_skill_resolution_attempt",
        idempotency_key: attempt.idempotency_key,
        trace_id: traceId,
        isolation: "serializable",
        retry: "serialization_failures",
      },
      (transaction, { owner }) => owner.executeWriter<unknown, "fail_skill_resolution_attempt_v1">(
        transaction,
        {
          writer: "fail_skill_resolution_attempt_v1",
          arguments: {
            p_attempt_id: attempt.id,
            p_expected_status: "resolving",
            p_expected_catalog_version: attempt.requested_catalog_version,
            p_expected_security_revocation_epoch: String(attempt.security_revocation_epoch),
            p_error_code: error.code,
            p_failure: completion,
            p_request_hash: attempt.request_hash,
            p_trace_id: traceId,
          },
          expected_rows: 1,
        },
      ),
    );
  }

  async #completeResolutionAttempt(
    attempt: PostgresResolutionAttemptV1,
    catalog: Readonly<{
      catalog_revision_id: string;
      catalog_version: string;
      catalog_as_of: string;
      security_revocation_epoch: number;
    }>,
    commit: ResolutionCommitV1,
    result: SkillResolveResultV1,
  ): Promise<void> {
    const completion = {
      skill_resolution_attempts: {
        id: attempt.id,
        status: "resolved",
        effective_catalog_version: catalog.catalog_version,
        security_revocation_epoch: catalog.security_revocation_epoch,
        response_payload: result,
        valid_until: commit.policy.policy.expires_at,
        completed_at: commit.now,
      },
      skill_catalog_revisions: { id: catalog.catalog_revision_id },
      skill_security_state: { singleton_key: true },
      skill_audit_logs: [{
        id: `skill_resolution_resolved:${attempt.id}`,
        runtime_run_id: commit.request.runtime_run_id,
        actor: "skill_registry",
        action: "skill.resolution.resolved",
        decision: "allow",
        reason_code: "resolved",
        payload: {
          resolution_attempt_id: attempt.id,
          response_hash: canonicalHashV1(result),
          resolved_skill_count: result.resolved_skills.length,
        },
        trace_id: commit.request.trace_id,
      }],
    };
    if (result.resolved_skills.length === 0) {
      await this.composition.unit_of_work.withTransaction(
        {
          operation: "complete_empty_skill_resolution_attempt",
          idempotency_key: attempt.idempotency_key,
          trace_id: commit.request.trace_id,
          isolation: "serializable",
          retry: "serialization_failures",
        },
        (transaction, { owner }) => owner.executeWriter<unknown, "complete_empty_skill_resolution_attempt_v1">(
          transaction,
          {
            writer: "complete_empty_skill_resolution_attempt_v1",
            arguments: {
              p_attempt_id: attempt.id,
              p_expected_status: "resolving",
              p_expected_catalog_version: catalog.catalog_version,
              p_expected_security_revocation_epoch: String(catalog.security_revocation_epoch),
              p_completion: completion,
              p_request_hash: attempt.request_hash,
              p_trace_id: commit.request.trace_id,
            },
            expected_rows: 1,
          },
        ),
      );
      return;
    }
    const resolutionRows = result.resolved_skills.map((resolution) => ({
      id: resolution.resolution_id,
      resolution_attempt_id: attempt.id,
      runtime_run_id: commit.request.runtime_run_id,
      start_attempt_no: commit.request.start_attempt_no,
      skill_id: resolution.skill_id,
      skill_key: resolution.skill_key,
      required: resolution.required,
      version_id: resolution.version_id,
      package_digest: resolution.package_digest,
      manifest_digest: resolution.manifest_digest,
      runtime_target: resolution.runtime_target,
      permission_decision: "allow",
      granted_capability_refs: resolution.granted_capability_refs,
      status: "resolved",
      resolution_token_hash: canonicalHashV1({
        resolution_attempt_id: attempt.id,
        resolution_id: resolution.resolution_id,
        policy_input_hash: commit.request.policy_input_hash,
      }),
      valid_until: resolution.valid_until,
      trace_id: commit.request.trace_id,
    }));
    await this.composition.unit_of_work.withTransaction(
      {
        operation: "complete_skill_resolution_attempt",
        idempotency_key: attempt.idempotency_key,
        trace_id: commit.request.trace_id,
        isolation: "serializable",
        retry: "serialization_failures",
      },
      (transaction, { owner }) => owner.executeWriter<unknown, "transition_skill_resolution_attempt_v1">(
        transaction,
        {
          writer: "transition_skill_resolution_attempt_v1",
          arguments: {
            p_attempt_id: attempt.id,
            p_expected_status: "resolving",
            p_next_status: "resolved",
            p_expected_catalog_version: catalog.catalog_version,
            p_catalog_as_of: catalog.catalog_as_of,
            p_expected_security_revocation_epoch: String(catalog.security_revocation_epoch),
            p_policy_input_hash: commit.request.policy_input_hash,
            p_skill_permission_summary_ref: commit.summary.summary_ref,
            p_skill_permission_summary_hash: commit.summary.summary_hash,
            p_resolution: { ...completion, skill_resolutions: resolutionRows },
            p_idempotency_key: attempt.idempotency_key,
            p_request_hash: attempt.request_hash,
            p_trace_id: commit.request.trace_id,
          },
          expected_rows: 1,
        },
      ),
    );
  }

  public async replayValidation(): Promise<never> { return this.#unsupported("validation replay"); }
  public async commitValidation(): Promise<never> { return this.#unsupported("validation commit"); }
  public async recordValidationFailure(): Promise<never> { return this.#unsupported("validation failure recording"); }
  public async replayPublish(
    request: Parameters<SkillRegistryApplicationRepositoryPortV1["replayPublish"]>[0],
    requestHash: string,
  ): Promise<ReturnType<SkillRegistryApplicationRepositoryPortV1["replayPublish"]> extends Promise<infer T> ? T : never> {
    const result = await this.composition.read_committed_postgres
      .withReadCommittedTransaction((transaction) =>
        transaction.query<{
          publish_request_hash: string;
          skill_version_id: string;
          skill_name: string;
          version: string;
          package_digest: string;
          manifest_digest: string;
          runtime_target: string;
          created_at: string;
        }>(
          `SELECT audit.payload ->> 'publish_request_hash' AS publish_request_hash,
                  version.id AS skill_version_id, staging.skill_name,
                  version.version, version.package_digest, version.manifest_digest,
                  version.runtime_target,
                  to_char(version.published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') || 'T' || to_char(version.published_at AT TIME ZONE 'UTC', 'HH24:MI:SS.MS') || 'Z' AS created_at
             FROM skill_registry.skill_audit_logs AS audit
             JOIN skill_registry.skill_versions AS version ON version.id = audit.version_id
             JOIN skill_registry.skill_version_staging AS staging
               ON staging.id = version.validation_id
            WHERE audit.action = 'skill.version.published'
              AND audit.payload ->> 'publish_idempotency_key' = $1::text
            ORDER BY audit.created_at DESC
            LIMIT 2`,
          [request.idempotency_key],
        ),
      );
    if (result.rows.length === 0) return undefined as never;
    if (result.rows.length !== 1) {
      throw new Error("Skill publish idempotency uniqueness drift");
    }
    const row = result.rows[0]!;
    if (row.publish_request_hash !== requestHash) {
      throw new SkillRegistryApplicationErrorV1(
        "idempotency_conflict",
        "publish idempotency body drift",
      );
    }
    if (row.skill_name !== request.skill_name || row.version !== request.semver ||
        row.package_digest !== request.package_digest ||
        row.manifest_digest !== request.manifest_digest ||
        row.runtime_target !== SKILL_RUNTIME_TARGET_V1) {
      throw new Error("Skill publish terminal evidence is invalid");
    }
    return Object.freeze({
      skill_version_id: row.skill_version_id,
      skill_name: row.skill_name,
      version: row.version,
      state: "published" as const,
      package_digest: row.package_digest,
      manifest_digest: row.manifest_digest,
      runtime_target: SKILL_RUNTIME_TARGET_V1,
      created_at: row.created_at,
      duplicate_replayed: true,
    }) as never;
  }
  public async readValidation(): Promise<never> { return this.#unsupported("validation read"); }
  public async publishVersion(
    commit: PublishCommitV1,
  ): Promise<ReturnType<SkillRegistryApplicationRepositoryPortV1["publishVersion"]> extends Promise<infer T> ? T : never> {
    const replay = await this.replayPublish(commit.request, commit.request_hash);
    if (replay !== undefined) return replay as never;
    const nowMs = Date.parse(commit.now);
    if (!Number.isFinite(nowMs)) {
      throw new Error("Skill publish commit timestamp is invalid");
    }
    const stageResult = await this.composition.read_committed_postgres
      .withReadCommittedTransaction((transaction) =>
        transaction.query<{
          id: string;
          skill_id: string;
          skill_name: string;
          proposed_version: string;
          artifact_ref: string;
          object_access_decision_ref: string;
          owner_object_id: string;
          owner_state_version: number | string;
          package_digest: string;
          manifest_digest: string;
          manifest: unknown;
          runtime_target: string;
          media_type: string;
          size_bytes: number | string;
          provenance: unknown;
          validation_result: unknown;
          scanner_versions: unknown;
          validation_expires_at: string;
          status: string;
          staging_state_version: number | string;
          idempotency_key: string;
          request_hash: string;
          created_by: string;
          existing_version_id: string | null;
        }>(
          `SELECT staging.id, staging.skill_id, staging.skill_name,
                  staging.proposed_version, staging.artifact_ref,
                  staging.object_access_decision_ref, staging.owner_object_id,
                  staging.owner_state_version, staging.package_digest,
                  staging.manifest_digest, staging.manifest, staging.runtime_target,
                  staging.media_type, staging.size_bytes, staging.provenance,
                  staging.validation_result, staging.scanner_versions,
                  to_char(staging.validation_expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') || 'T' || to_char(staging.validation_expires_at AT TIME ZONE 'UTC', 'HH24:MI:SS.MS') || 'Z' AS validation_expires_at,
                  staging.status, staging.staging_state_version,
                  staging.idempotency_key, staging.request_hash, staging.created_by,
                  version.id AS existing_version_id
             FROM skill_registry.skill_version_staging AS staging
             LEFT JOIN skill_registry.skill_versions AS version
               ON version.validation_id = staging.id
            WHERE staging.id = $1::text
            LIMIT 2`,
          [commit.validation.validation_id],
        ),
      );
    if (stageResult.rows.length === 0) {
      throw new SkillRegistryApplicationErrorV1(
        "validation_not_found", "approved validation was not found",
      );
    }
    if (stageResult.rows.length !== 1) {
      throw new Error("Skill validation identity uniqueness drift");
    }
    const staging = stageResult.rows[0]!;
    const stageSize = Number(staging.size_bytes);
    const stageOwnerVersion = Number(staging.owner_state_version);
    const stageStateVersion = Number(staging.staging_state_version);
    if (!Number.isSafeInteger(stageSize) || stageSize < 0 ||
        !Number.isSafeInteger(stageOwnerVersion) || stageOwnerVersion < 1 ||
        !Number.isSafeInteger(stageStateVersion) || stageStateVersion < 1 ||
        Date.parse(staging.validation_expires_at) <= nowMs) {
      throw new SkillRegistryApplicationErrorV1(
        "validation_expired", "validation changed or expired before commit",
      );
    }
    if (staging.status !== "approved") {
      throw new SkillRegistryApplicationErrorV1(
        "version_not_publishable", "validation is not approved",
      );
    }
    if (staging.existing_version_id !== null) {
      const raced = await this.replayPublish(commit.request, commit.request_hash);
      if (raced !== undefined) return raced as never;
      throw new SkillRegistryApplicationErrorV1(
        "validation_already_published",
        "validation was consumed by another request",
        { skill_version_id: staging.existing_version_id },
      );
    }
    if (staging.skill_id !== commit.validation.skill_id ||
        staging.skill_name !== commit.validation.skill_name ||
        staging.skill_name !== commit.request.skill_name ||
        staging.proposed_version !== commit.validation.proposed_version ||
        staging.proposed_version !== commit.request.semver ||
        staging.artifact_ref !== commit.validation.artifact_ref ||
        staging.artifact_ref !== commit.request.artifact_ref ||
        staging.object_access_decision_ref !== commit.validation.object_access_decision_ref ||
        staging.owner_object_id !== commit.validation.owner_object_id ||
        stageOwnerVersion !== commit.validation.owner_state_version ||
        staging.package_digest !== commit.validation.package_digest ||
        staging.package_digest !== commit.request.package_digest ||
        staging.manifest_digest !== commit.validation.manifest_digest ||
        staging.manifest_digest !== commit.request.manifest_digest ||
        staging.runtime_target !== SKILL_RUNTIME_TARGET_V1 ||
        stageSize !== commit.validation.size_bytes ||
        staging.media_type !== commit.validation.media_type ||
        canonicalHashV1(staging.manifest) !== staging.manifest_digest ||
        canonicalJsonV1(staging.manifest) !== canonicalJsonV1(commit.validation.manifest) ||
        commit.verified.package_digest !== staging.package_digest ||
        commit.verified.manifest_digest !== staging.manifest_digest ||
        commit.verified.size_bytes !== stageSize) {
      throw new SkillRegistryApplicationErrorV1(
        "content_integrity_mismatch",
        "publish request drifted from the approved validation",
      );
    }
    const versionId = `skv_${canonicalHashV1({
      validation_id: staging.id,
      idempotency_key: commit.request.idempotency_key,
    }).slice("sha256:".length)}`;
    const packageId = `skpkg_${canonicalHashV1({ version_id: versionId }).slice("sha256:".length)}`;
    const retentionUntil = new Date(
      nowMs + PUBLISHED_SKILL_PACKAGE_RETENTION_MILLISECONDS_V1,
    ).toISOString();
    const result = Object.freeze({
      skill_version_id: versionId,
      skill_name: staging.skill_name,
      version: staging.proposed_version,
      state: "published" as const,
      package_digest: staging.package_digest,
      manifest_digest: staging.manifest_digest,
      runtime_target: SKILL_RUNTIME_TARGET_V1,
      created_at: commit.now,
      duplicate_replayed: false,
    });
    const eventPayload = {
      scope_kind: "global" as const,
      actor_principal_id: commit.actor_principal_id,
      reason_code: "publish",
      skill_id: staging.skill_id,
      skill_key: staging.skill_name,
      version_id: versionId,
      version: staging.proposed_version,
      lifecycle_version: 1,
      package_digest: staging.package_digest,
      manifest_digest: staging.manifest_digest,
      published_at: commit.now,
    };
    const eventRows = [
      ["trigger_processor.skill_projection", "trigger_processor"],
      ["action_runtime.skill_projection", "action_runtime"],
    ].map(([target, consumer]) => ({
      id: `skill_publish_event:${versionId}:${consumer}`,
      event_type: "skill.version.published",
      schema_version: "skill_registry_event.v1",
      producer: "skill_registry",
      occurred_at: commit.now,
      idempotency_key: `skill_version_published:${versionId}:${consumer}`,
      trace_id: commit.request.trace_id,
      payload: eventPayload,
      payload_hash: canonicalHashV1(eventPayload),
      target,
      status: "pending",
    }));
    const versionPayload = {
      skill_version_staging: {
        id: staging.id,
        idempotency_key: staging.idempotency_key,
        request_hash: staging.request_hash,
        status: "approved",
        staging_state_version: stageStateVersion,
        updated_at: commit.now,
      },
      skill_versions: {
        id: versionId,
        skill_id: staging.skill_id,
        version: staging.proposed_version,
        package_digest: staging.package_digest,
        manifest_digest: staging.manifest_digest,
        runtime_target: SKILL_RUNTIME_TARGET_V1,
        lifecycle_state: "published",
        lifecycle_version: 1,
        provenance: staging.provenance,
        validation_result: staging.validation_result,
        scanner_versions: staging.scanner_versions,
        validation_id: staging.id,
        published_at: commit.now,
        revocation_epoch: 0,
        created_by: commit.actor_principal_id,
        created_at: commit.now,
      },
      skill_audit_logs: [{
        id: `skill_publish_audit:${versionId}`,
        skill_id: staging.skill_id,
        version_id: versionId,
        actor: commit.actor_principal_id,
        action: "skill.version.published",
        decision: "allow",
        reason_code: "publish",
        evidence_refs: [staging.id, staging.object_access_decision_ref],
        payload: {
          publish_idempotency_key: commit.request.idempotency_key,
          publish_request_hash: commit.request_hash,
          result,
        },
        trace_id: commit.request.trace_id,
        created_at: commit.now,
      }],
      skill_event_outbox: eventRows,
    };
    const packagePayload = {
      skill_packages: {
        id: packageId,
        version_id: versionId,
        package_ref: staging.artifact_ref,
        object_access_decision_ref: staging.object_access_decision_ref,
        owner_object_id: staging.owner_object_id,
        owner_state_version: stageOwnerVersion,
        media_type: staging.media_type,
        size_bytes: stageSize,
        file_count: commit.validation.manifest.files.length,
        package_digest: staging.package_digest,
        manifest_digest: staging.manifest_digest,
        manifest: commit.validation.manifest,
        scan_result: staging.validation_result,
        retention_state: "retained",
        retention_until: retentionUntil,
        state_version: 1,
        created_at: commit.now,
        updated_at: commit.now,
      },
    };
    await this.composition.unit_of_work.withTransaction(
      {
        operation: "publish_skill_version",
        idempotency_key: commit.request.idempotency_key,
        trace_id: commit.request.trace_id,
        isolation: "serializable",
        retry: "serialization_failures",
      },
      (transaction, { owner }) => owner.executeWriter<unknown, "publish_skill_version_v1">(
        transaction,
        {
          writer: "publish_skill_version_v1",
          arguments: {
            p_skill_version_id: versionId,
            p_package_id: packageId,
            p_staging_id: staging.id,
            p_expected_staging_status: "approved",
            p_expected_staging_state_version: String(stageStateVersion),
            p_version: versionPayload,
            p_package: packagePayload,
            p_idempotency_key: commit.request.idempotency_key,
            p_request_hash: commit.request_hash,
            p_trace_id: commit.request.trace_id,
          },
          expected_rows: 1,
        },
      ),
    );
    return result as never;
  }

  #managementId(prefix: string, value: unknown): string {
    return `${prefix}_${canonicalHashV1(value).slice("sha256:".length)}`;
  }

  #scopedCatalogKey(scope: Readonly<{
    workspace_id: string;
    bot_id: string;
    deployment_environment: string;
    release_channel: string;
  }>): string {
    return canonicalHashV1({
      workspace_id: scope.workspace_id,
      bot_id: scope.bot_id,
      deployment_environment: scope.deployment_environment,
      release_channel: scope.release_channel,
    });
  }

  #initialCatalogVersion(scope: Readonly<{
    workspace_id: string;
    bot_id: string;
    deployment_environment: string;
    release_channel: string;
  }>): string {
    return this.#managementId("skcat_initial", this.#scopedCatalogKey(scope));
  }

  async #readSecurityEpoch(): Promise<number> {
    const result = await this.composition.read_committed_postgres
      .withReadCommittedTransaction((transaction) =>
        transaction.query<{ security_revocation_epoch: number | string }>(
          `SELECT security_revocation_epoch
             FROM skill_registry.skill_security_state
            WHERE singleton_key = TRUE
            LIMIT 2`,
        ),
      );
    if (result.rows.length !== 1) {
      throw new Error("Skill Registry security state uniqueness drift");
    }
    const epoch = Number(result.rows[0]!.security_revocation_epoch);
    if (!Number.isSafeInteger(epoch) || epoch < 0) {
      throw new Error("Skill Registry security epoch is invalid");
    }
    return epoch;
  }

  async #readManagementResult(
    commit: ManagementCommitV1,
    duplicateReplayed: boolean,
  ): Promise<SkillManagementResultV1 | undefined> {
    const result = await this.composition.read_committed_postgres
      .withReadCommittedTransaction((transaction) =>
        transaction.query<{
          id: string;
          request_hash: string;
          response_payload: unknown;
        }>(
          `SELECT id, request_hash, response_payload
             FROM skill_registry.skill_management_commands
            WHERE scope_kind = $1::text
              AND operation = $2::text
              AND idempotency_key = $3::text
            LIMIT 2`,
          [
            commit.request.scope_kind,
            commit.request.operation,
            commit.request.idempotency_key,
          ],
        ),
      );
    if (result.rows.length === 0) return undefined;
    if (result.rows.length !== 1) {
      throw new Error("Skill management idempotency uniqueness drift");
    }
    const row = result.rows[0]!;
    if (row.request_hash !== commit.request_hash) {
      throw new SkillRegistryApplicationErrorV1(
        "idempotency_conflict",
        "management idempotency body drift",
      );
    }
    if (
      typeof row.response_payload !== "object" ||
      row.response_payload === null ||
      Array.isArray(row.response_payload)
    ) {
      throw new Error("Skill management terminal response is invalid");
    }
    return Object.freeze({
      ...(row.response_payload as Record<string, unknown>),
      command_id: row.id,
      duplicate_replayed: duplicateReplayed,
    }) as SkillManagementResultV1;
  }

  async #readVersion(
    versionId: string,
  ): Promise<PostgresVersionRowV1 | undefined> {
    const result = await this.composition.read_committed_postgres
      .withReadCommittedTransaction((transaction) =>
        transaction.query<PostgresVersionRowV1>(
          `SELECT version.id, version.skill_id, skill.skill_key, version.version,
                  version.package_digest, version.manifest_digest,
                  version.lifecycle_state, version.lifecycle_version,
                  version.revocation_epoch
             FROM skill_registry.skill_versions AS version
             JOIN skill_registry.skills AS skill ON skill.id = version.skill_id
            WHERE version.id = $1::text
            LIMIT 2`,
          [versionId],
        ),
      );
    if (result.rows.length === 0) return undefined;
    if (result.rows.length !== 1) {
      throw new Error("Skill version identity uniqueness drift");
    }
    return Object.freeze({ ...result.rows[0]! });
  }

  async #skillExists(
    skillId: string,
    skillKey: string,
  ): Promise<boolean> {
    const result = await this.composition.read_committed_postgres
      .withReadCommittedTransaction((transaction) =>
        transaction.query<{ id: string }>(
          `SELECT id
             FROM skill_registry.skills
            WHERE id = $1::text AND skill_key = $2::text
            LIMIT 2`,
          [skillId, skillKey],
        ),
      );
    if (result.rows.length > 1) {
      throw new Error("Skill identity uniqueness drift");
    }
    return result.rows.length === 1;
  }

  async #readActivation(
    scope: Readonly<{
      workspace_id: string;
      bot_id: string;
      deployment_environment: string;
      release_channel: string;
    }>,
    skillId: string,
  ): Promise<PostgresActivationRowV1 | undefined> {
    const result = await this.composition.read_committed_postgres
      .withReadCommittedTransaction((transaction) =>
        transaction.query<PostgresActivationRowV1>(
          `SELECT revision.id, revision.skill_id, revision.version_id,
                  revision.state, revision.revision_no
             FROM skill_registry.skill_activation_current AS current
             JOIN skill_registry.skill_activation_revisions AS revision
               ON revision.id = current.activation_revision_id
            WHERE current.skill_id = $1::text
              AND current.workspace_id = $2::text
              AND current.bot_id = $3::text
              AND current.deployment_environment = $4::text
              AND current.release_channel = $5::text
            LIMIT 2`,
          [
            skillId,
            scope.workspace_id,
            scope.bot_id,
            scope.deployment_environment,
            scope.release_channel,
          ],
        ),
      );
    if (result.rows.length === 0) return undefined;
    if (result.rows.length !== 1) {
      throw new Error("Skill activation pointer uniqueness drift");
    }
    return Object.freeze({ ...result.rows[0]! });
  }

  async #readPermission(
    scope: Readonly<{
      workspace_id: string;
      bot_id: string;
      deployment_environment: string;
      release_channel: string;
    }>,
    skillId: string,
    scopeHash: string,
  ): Promise<PostgresPermissionRowV1 | undefined> {
    const result = await this.composition.read_committed_postgres
      .withReadCommittedTransaction((transaction) =>
        transaction.query<PostgresPermissionRowV1>(
          `SELECT revision.skill_id, revision.id AS permission_revision_id,
                  revision.revision_no, revision.decision,
                  revision.capability_refs, revision.scope_hash,
                  revision.owner_agent_id
             FROM skill_registry.skill_permission_current AS current
             JOIN skill_registry.skill_permission_revisions AS revision
               ON revision.id = current.permission_revision_id
            WHERE current.skill_id = $1::text
              AND current.workspace_id = $2::text
              AND current.bot_id = $3::text
              AND current.deployment_environment = $4::text
              AND current.release_channel = $5::text
              AND current.scope_hash = $6::text
            LIMIT 2`,
          [
            skillId,
            scope.workspace_id,
            scope.bot_id,
            scope.deployment_environment,
            scope.release_channel,
            scopeHash,
          ],
        ),
      );
    if (result.rows.length === 0) return undefined;
    if (result.rows.length !== 1) {
      throw new Error("Skill permission pointer uniqueness drift");
    }
    return Object.freeze({ ...result.rows[0]! });
  }

  async #bootstrapCatalog(
    commit: ManagementCommitV1 & { readonly request: Extract<ManagementCommitV1["request"], { readonly scope_kind: "scoped" }> },
  ): Promise<Readonly<{
    catalog_revision_id: string;
    catalog_version: string;
    catalog_as_of: string;
    security_revocation_epoch: number;
  }>> {
    const scope = commit.request;
    const initialCatalogVersion = this.#initialCatalogVersion(scope);
    const catalogRevisionId = this.#managementId("skcatrev_initial", this.#scopedCatalogKey(scope));
    const epoch = await this.#readSecurityEpoch();
    const catalogPayload = {
      skill_catalog_revisions: {
        id: catalogRevisionId,
        workspace_id: scope.workspace_id,
        bot_id: scope.bot_id,
        deployment_environment: scope.deployment_environment,
        release_channel: scope.release_channel,
        catalog_version: initialCatalogVersion,
        catalog_as_of: commit.now,
        security_revocation_epoch: epoch,
        created_at: commit.now,
      },
      skill_catalog_current: {
        workspace_id: scope.workspace_id,
        bot_id: scope.bot_id,
        deployment_environment: scope.deployment_environment,
        release_channel: scope.release_channel,
        catalog_revision_id: catalogRevisionId,
        updated_at: commit.now,
      },
    };
    await this.composition.unit_of_work.withTransaction(
      {
        operation: "bootstrap_skill_catalog",
        idempotency_key: initialCatalogVersion,
        trace_id: commit.request.trace_id,
        isolation: "serializable",
        retry: "serialization_failures",
      },
      (transaction, { owner }) => owner.executeWriter<unknown, "cas_skill_catalog_current_v1">(
        transaction,
        {
          writer: "cas_skill_catalog_current_v1",
          arguments: {
            p_catalog_key: this.#scopedCatalogKey(scope),
            p_expected_catalog_version: "none",
            p_catalog_revision: catalogPayload,
            p_entries: { skill_catalog_revision_entries: [] },
            p_request_hash: canonicalHashV1({
              operation: "bootstrap_skill_catalog.v1",
              scope: this.#scopedCatalogKey(scope),
            }),
            p_trace_id: commit.request.trace_id,
          },
          expected_rows: 1,
        },
      ),
    );
    const catalog = await this.#readCatalog(scope);
    if (catalog === undefined || catalog.catalog_version !== initialCatalogVersion) {
      throw new Error("Skill catalog bootstrap did not persist the initial snapshot");
    }
    return catalog;
  }

  async #managementCatalog(
    commit: ManagementCommitV1 & { readonly request: Extract<ManagementCommitV1["request"], { readonly scope_kind: "scoped" }> },
  ): Promise<Readonly<{
    catalog_revision_id: string;
    catalog_version: string;
    catalog_as_of: string;
    security_revocation_epoch: number;
  }>> {
    let catalog = await this.#readCatalog(commit.request);
    if (catalog === undefined) {
      if (commit.request.expected_catalog_version !== "none") {
        throw new SkillRegistryApplicationErrorV1(
          "catalog_version_conflict",
          "expected catalog version is stale",
          {
            requested_catalog_version: commit.request.expected_catalog_version,
            current_catalog_version: null,
            conflict_reason: "management_expected_catalog_stale",
          },
        );
      }
      catalog = await this.#bootstrapCatalog(commit);
    }
    const initialCatalogVersion = this.#initialCatalogVersion(commit.request);
    if (
      catalog.catalog_version !== commit.request.expected_catalog_version &&
      !(
        commit.request.expected_catalog_version === "none" &&
        catalog.catalog_version === initialCatalogVersion
      )
    ) {
      throw new SkillRegistryApplicationErrorV1(
        "catalog_version_conflict",
        "expected catalog version is stale",
        {
          requested_catalog_version: commit.request.expected_catalog_version,
          current_catalog_version: catalog.catalog_version,
          conflict_reason: "management_expected_catalog_stale",
        },
      );
    }
    return catalog;
  }

  #eventRows(
    eventType: string,
    eventKey: string,
    occurredAt: string,
    traceId: string,
    payload: Readonly<Record<string, unknown>>,
    targets: readonly string[],
  ): readonly Record<string, unknown>[] {
    const payloadHash = canonicalHashV1(payload);
    return targets.map((target) => Object.freeze({
      id: this.#managementId("sk_event", { eventKey, target }),
      event_type: eventType,
      schema_version: "skill_registry_event.v1",
      producer: "skill_registry",
      occurred_at: occurredAt,
      idempotency_key: `${eventKey}:${target}`,
      trace_id: traceId,
      payload,
      payload_hash: payloadHash,
      target,
      status: "pending",
    }));
  }

  #catalogEntriesPayload(
    catalogRevisionId: string,
    scope: Readonly<{
      workspace_id: string;
      bot_id: string;
      deployment_environment: string;
      release_channel: string;
    }>,
    entries: readonly PostgresCatalogEntryRowV1[],
  ): Readonly<Record<string, unknown>> {
    return {
      skill_catalog_revision_entries: entries.map((entry) => ({
        catalog_revision_id: catalogRevisionId,
        workspace_id: scope.workspace_id,
        bot_id: scope.bot_id,
        deployment_environment: scope.deployment_environment,
        release_channel: scope.release_channel,
        skill_id: entry.skill_id,
        activation_revision_id: entry.activation_revision_id,
        version_id: entry.version_id,
        package_digest: entry.package_digest,
        manifest_digest: entry.manifest_digest,
        runtime_target: SKILL_RUNTIME_TARGET_V1,
      })),
    };
  }

  #catalogRevisionPayload(
    catalogRevisionId: string,
    catalogVersion: string,
    catalog: Readonly<{ security_revocation_epoch: number }>,
    scope: Readonly<{
      workspace_id: string;
      bot_id: string;
      deployment_environment: string;
      release_channel: string;
    }>,
    now: string,
  ): Readonly<Record<string, unknown>> {
    return {
      skill_catalog_revisions: {
        id: catalogRevisionId,
        workspace_id: scope.workspace_id,
        bot_id: scope.bot_id,
        deployment_environment: scope.deployment_environment,
        release_channel: scope.release_channel,
        catalog_version: catalogVersion,
        catalog_as_of: now,
        security_revocation_epoch: catalog.security_revocation_epoch,
        created_at: now,
      },
      skill_catalog_current: {
        workspace_id: scope.workspace_id,
        bot_id: scope.bot_id,
        deployment_environment: scope.deployment_environment,
        release_channel: scope.release_channel,
        catalog_revision_id: catalogRevisionId,
        updated_at: now,
      },
    };
  }

  #positiveCounter(
    value: number | string,
    name: string,
  ): number {
    const numberValue = Number(value);
    if (!Number.isSafeInteger(numberValue) || numberValue < 1) {
      throw new Error(`Skill Registry ${name} is invalid`);
    }
    return numberValue;
  }

  async #permissionSummaryPayload(
    commit: ManagementCommitV1 & {
      readonly request: Extract<
        ManagementCommitV1["request"],
        { readonly operation: "permission_grant" | "permission_revoke" }
      >;
    },
    catalogRevision: Readonly<{
      catalog_revision_id: string;
      catalog_version: string;
      catalog_as_of: string;
      security_revocation_epoch: number;
    }>,
    entries: readonly PostgresCatalogEntryRowV1[],
    permission: Readonly<{
      permission_revision_id: string;
      revision_no: number;
      decision: "allow" | "deny";
      scope_hash: string;
      owner_agent_id: string | null;
      capability_refs: readonly string[];
    }>,
  ): Promise<Readonly<Record<string, unknown>>> {
    // A command with no owner condition affects every runtime owner.  The
    // writer still requires an immutable, concrete summary snapshot, so use
    // the authenticated command actor as the demonstrably bound representative
    // subject. Runtime reads create their own owner-specific snapshots.
    const summaryOwnerAgentId =
      commit.request.owner_agent_id ?? commit.actor_principal_id;
    const scope = {
      workspace_id: commit.request.workspace_id,
      bot_id: commit.request.bot_id,
      owner_agent_id: summaryOwnerAgentId,
      deployment_environment: commit.request.deployment_environment,
      release_channel: commit.request.release_channel,
    };
    const permissions = await this.#readPermissions(scope);
    const summaryRef = this.#managementId("skill_permission_summary", {
      catalog_revision_id: catalogRevision.catalog_revision_id,
      owner_agent_id: summaryOwnerAgentId,
      permission_revision_id: permission.permission_revision_id,
    });
    const summaryEntries = entries
      .slice()
      .sort((left, right) => left.skill_id.localeCompare(right.skill_id, "en"))
      .map((entry) => {
        const current = permissions.get(entry.skill_id);
        let general = current?.general;
        let specific = current?.specific;
        if (entry.skill_id === commit.request.skill_id) {
          const changed: PostgresPermissionRowV1 = {
            skill_id: entry.skill_id,
            permission_revision_id: permission.permission_revision_id,
            revision_no: permission.revision_no,
            decision: permission.decision,
            capability_refs: permission.capability_refs,
            scope_hash: permission.scope_hash,
            owner_agent_id: permission.owner_agent_id,
          };
          if (permission.owner_agent_id === null) general = changed;
          else if (permission.owner_agent_id === summaryOwnerAgentId) {
            specific = changed;
          }
        }
        const effective = general?.decision === "deny"
          ? general
          : specific?.decision === "deny"
            ? specific
            : specific ?? general;
        if (effective === undefined) {
          return Object.freeze({
            skill_id: entry.skill_id,
            skill_key: entry.skill_key,
            activation_revision_id: entry.activation_revision_id,
            version_id: entry.version_id,
            decision_source: "default_deny" as const,
            decision: "deny" as const,
            capability_refs: [],
          });
        }
        const revisionNo = this.#positiveCounter(
          effective.revision_no,
          "permission revision",
        );
        return Object.freeze({
          skill_id: entry.skill_id,
          skill_key: entry.skill_key,
          activation_revision_id: entry.activation_revision_id,
          version_id: entry.version_id,
          decision_source: "revision" as const,
          permission_revision_id: effective.permission_revision_id,
          revision_no: revisionNo,
          decision: effective.decision === "allow" ? "grant" as const : "deny" as const,
          scope_hash: effective.scope_hash,
          owner_agent_condition: effective.owner_agent_id,
          capability_refs: [...effective.capability_refs].sort(),
        });
      });
    const hashable = {
      schema_version: "skill_permission_summary.v1" as const,
      summary_ref: summaryRef,
      workspace_id: scope.workspace_id,
      bot_id: scope.bot_id,
      owner_agent_id: scope.owner_agent_id,
      deployment_environment: scope.deployment_environment,
      release_channel: scope.release_channel,
      catalog_revision_id: catalogRevision.catalog_revision_id,
      catalog_version: catalogRevision.catalog_version,
      catalog_as_of: catalogRevision.catalog_as_of,
      security_revocation_epoch: catalogRevision.security_revocation_epoch,
      entries: summaryEntries,
    };
    const summaryHash = canonicalHashV1(hashable);
    const canonicalBytes = `\\x${Buffer.from(
      canonicalJsonV1(hashable),
      "utf8",
    ).toString("hex")}`;
    return {
      skill_permission_summary_snapshots: {
        ...hashable,
        canonical_bytes: canonicalBytes,
        summary_hash: summaryHash,
        created_at: commit.now,
      },
      skill_permission_summary_entries: summaryEntries.map((entry, index) => ({
        ...entry,
        summary_ref: summaryRef,
        ordinal: index + 1,
      })),
    };
  }

  public async executeManagement(
    commit: ManagementCommitV1,
  ): Promise<SkillManagementResultV1> {
    const replay = await this.#readManagementResult(commit, true);
    if (replay !== undefined) return replay;

    if (commit.request.scope_kind === "global") {
      return this.#executeGlobalManagement(commit as ManagementCommitV1 & {
        readonly request: Extract<
          ManagementCommitV1["request"],
          { readonly scope_kind: "global" }
        >;
      });
    }
    return this.#executeScopedManagement(commit as ManagementCommitV1 & {
      readonly request: Extract<
        ManagementCommitV1["request"],
        { readonly scope_kind: "scoped" }
      >;
    });
  }

  async #executeGlobalManagement(
    commit: ManagementCommitV1 & {
      readonly request: Extract<
        ManagementCommitV1["request"],
        { readonly scope_kind: "global" }
      >;
    },
  ): Promise<SkillManagementResultV1> {
    const version = await this.#readVersion(commit.request.version_id);
    if (
      version === undefined ||
      version.skill_id !== commit.request.skill_id ||
      version.skill_key !== commit.skill_key
    ) {
      throw new SkillRegistryApplicationErrorV1(
        "version_not_publishable",
        "lifecycle target was not found",
      );
    }
    const previousLifecycleVersion = this.#positiveCounter(
      version.lifecycle_version,
      "lifecycle version",
    );
    if (previousLifecycleVersion !== commit.request.expected_lifecycle_version) {
      throw new SkillRegistryApplicationErrorV1(
        "lifecycle_conflict",
        "expected lifecycle version is stale",
        { current_lifecycle_version: previousLifecycleVersion },
      );
    }
    if (
      (commit.request.operation === "deprecate" &&
        version.lifecycle_state !== "published") ||
      (commit.request.operation === "revoke" &&
        version.lifecycle_state === "revoked")
    ) {
      throw new SkillRegistryApplicationErrorV1(
        "invalid_state_transition",
        "requested lifecycle transition is not permitted",
      );
    }
    const previousSecurityEpoch = await this.#readSecurityEpoch();
    const nextLifecycleVersion = previousLifecycleVersion + 1;
    const nextLifecycleState = commit.request.operation === "deprecate"
      ? "deprecated" as const
      : "revoked" as const;
    const nextSecurityEpoch =
      commit.request.operation === "revoke" && commit.request.emergency
        ? previousSecurityEpoch + 1
        : previousSecurityEpoch;
    const commandId = this.#managementId("skill_command", {
      scope_kind: "global",
      operation: commit.request.operation,
      idempotency_key: commit.request.idempotency_key,
    });
    const result = Object.freeze({
      scope_kind: "global" as const,
      operation: commit.request.operation,
      command_id: commandId,
      skill_id: version.skill_id,
      version_id: version.id,
      previous_lifecycle_version: previousLifecycleVersion,
      new_lifecycle_version: nextLifecycleVersion,
      lifecycle_state: nextLifecycleState,
      security_revocation_epoch: nextSecurityEpoch,
      duplicate_replayed: false,
    });
    const versionEventType = commit.request.operation === "deprecate"
      ? "skill.version.deprecated"
      : "skill.version.revoked";
    const versionEventPayload = {
      scope_kind: "global" as const,
      skill_id: version.skill_id,
      skill_key: version.skill_key,
      version_id: version.id,
      version: version.version,
      previous_lifecycle_version: previousLifecycleVersion,
      lifecycle_version: nextLifecycleVersion,
      actor_principal_id: commit.actor_principal_id,
      reason_code: commit.request.operation,
      ...(commit.request.operation === "deprecate"
        ? { deprecated_at: commit.now }
        : {
            revoked_at: commit.now,
            security_revocation_epoch: nextSecurityEpoch,
            emergency: commit.request.emergency,
          }),
    };
    const versionEvents = this.#eventRows(
      versionEventType,
      `skill_version:${version.id}:${commit.request.operation}:${nextLifecycleVersion}`,
      commit.now,
      commit.request.trace_id,
      versionEventPayload,
      [
        "trigger_processor.skill_projection",
        "action_runtime.skill_projection",
        "meta_cognition.skill_projection",
      ],
    );
    const epochEvents = commit.request.operation === "revoke" &&
      commit.request.emergency
      ? this.#eventRows(
          "skill.security_revocation_epoch.changed",
          `skill_security_epoch:${nextSecurityEpoch}`,
          commit.now,
          commit.request.trace_id,
          {
            scope_kind: "global" as const,
            previous_security_revocation_epoch: previousSecurityEpoch,
            security_revocation_epoch: nextSecurityEpoch,
            affected_skill_ids: [version.skill_id],
            affected_version_ids: [version.id],
            emergency: true,
            actor_principal_id: commit.actor_principal_id,
            reason_code: "emergency_revoke",
          },
          [
            "trigger_processor.skill_projection",
            "action_runtime.skill_projection",
            "meta_cognition.skill_projection",
          ],
        )
      : undefined;
    const versionPayload = {
      skill_versions: {
        id: version.id,
        lifecycle_state: nextLifecycleState,
        lifecycle_version: nextLifecycleVersion,
        ...(nextLifecycleState === "deprecated"
          ? { deprecated_at: commit.now }
          : {
              revoked_at: commit.now,
              revocation_epoch: nextSecurityEpoch,
            }),
      },
      skill_security_state: {
        singleton_key: true,
        security_revocation_epoch: nextSecurityEpoch,
        updated_at: commit.now,
      },
      skill_management_commands: {
        id: commandId,
        operation: commit.request.operation,
        scope_kind: "global",
        skill_id: version.skill_id,
        version_id: version.id,
        expected_lifecycle_version: previousLifecycleVersion,
        emergency: commit.request.operation === "revoke"
          ? commit.request.emergency
          : undefined,
        request_hash: commit.request_hash,
        idempotency_key: commit.request.idempotency_key,
        actor_principal_id: commit.actor_principal_id,
        actor_role: "registry_operator",
        reason: commit.request.reason,
        status: "completed",
        previous_lifecycle_version: previousLifecycleVersion,
        new_lifecycle_version: nextLifecycleVersion,
        result_security_revocation_epoch: nextSecurityEpoch,
        response_payload: result,
        trace_id: commit.request.trace_id,
        created_at: commit.now,
        completed_at: commit.now,
      },
      skill_audit_logs: [{
        id: this.#managementId("skill_audit", { command_id: commandId }),
        skill_id: version.skill_id,
        version_id: version.id,
        actor: commit.actor_principal_id,
        action: versionEventType,
        decision: "allow",
        reason_code: commit.request.operation,
        evidence_refs: [commandId],
        payload: { command_id: commandId, result },
        trace_id: commit.request.trace_id,
        created_at: commit.now,
      }],
    };
    try {
      await this.composition.unit_of_work.withTransaction(
        {
          operation: `skill_${commit.request.operation}`,
          idempotency_key: commit.request.idempotency_key,
          trace_id: commit.request.trace_id,
          isolation: "serializable",
          retry: "serialization_failures",
        },
        (transaction, { owner }) => owner.executeWriter<unknown, "transition_skill_version_lifecycle_v1">(
          transaction,
          {
            writer: "transition_skill_version_lifecycle_v1",
            arguments: {
              p_skill_version_id: version.id,
              p_expected_lifecycle_state: version.lifecycle_state,
              p_expected_lifecycle_version: String(previousLifecycleVersion),
              p_expected_security_revocation_epoch: String(previousSecurityEpoch),
              p_next_lifecycle_state: nextLifecycleState,
              p_version: versionPayload,
              p_management_command: {},
              p_version_event: { skill_event_outbox: versionEvents },
              p_epoch_event: epochEvents === undefined
                ? null
                : { skill_event_outbox: epochEvents },
              p_idempotency_key: commit.request.idempotency_key,
              p_request_hash: commit.request_hash,
              p_trace_id: commit.request.trace_id,
            },
            expected_rows: 1,
          },
        ),
      );
    } catch (error) {
      const raced = await this.#readManagementResult(commit, true);
      if (raced !== undefined) return raced;
      throw error;
    }
    const persisted = await this.#readManagementResult(commit, false);
    if (persisted === undefined) {
      throw new Error("Skill management command was not persisted");
    }
    return persisted;
  }

  async #executeScopedManagement(
    commit: ManagementCommitV1 & {
      readonly request: Extract<
        ManagementCommitV1["request"],
        { readonly scope_kind: "scoped" }
      >;
    },
  ): Promise<SkillManagementResultV1> {
    if (
      commit.request.operation === "permission_grant" ||
      commit.request.operation === "permission_revoke"
    ) {
      return this.#executePermissionManagement(commit as ManagementCommitV1 & {
        readonly request: Extract<
          ManagementCommitV1["request"],
          { readonly operation: "permission_grant" | "permission_revoke" }
        >;
      });
    }

    const activationCommit = commit as ManagementCommitV1 & {
      readonly request: Extract<
        ManagementCommitV1["request"],
        { readonly operation: "activate" | "rollback" | "disable" }
      >;
    };
    const catalog = await this.#managementCatalog(activationCommit);
    const scope = activationCommit.request;
    const entries = await this.#readCatalogEntries(catalog.catalog_revision_id);
    const current = await this.#readActivation(scope, scope.skill_id);
    const currentRevisionId = current?.id ?? "none";
    if (currentRevisionId !== scope.expected_activation_revision) {
      throw new SkillRegistryApplicationErrorV1(
        "activation_conflict",
        "expected activation revision is stale",
        { current_activation_revision: currentRevisionId },
      );
    }

    const operation = scope.operation;
    if (operation === "disable" && (
      current === undefined ||
      current.state !== "active" ||
      current.version_id === null ||
      current.skill_id !== scope.skill_id
    )) {
      throw new SkillRegistryApplicationErrorV1(
        "invalid_state_transition",
        "disable requires the current active activation",
      );
    }
    if (operation === "rollback" && (
      current === undefined ||
      current.state !== "active" ||
      current.version_id === scope.target_version_id
    )) {
      throw new SkillRegistryApplicationErrorV1(
        "invalid_state_transition",
        "rollback requires a different current active version",
      );
    }

    const targetVersionId = operation === "activate"
      ? scope.version_id
      : operation === "rollback"
        ? scope.target_version_id
        : current!.version_id!;
    const version = await this.#readVersion(targetVersionId);
    if (
      version === undefined ||
      version.skill_id !== scope.skill_id ||
      version.skill_key !== activationCommit.skill_key ||
      (operation !== "disable" && version.lifecycle_state !== "published")
    ) {
      throw new SkillRegistryApplicationErrorV1(
        "version_not_publishable",
        operation === "disable"
          ? "active version was not found"
          : "activation target was not found or is not published",
      );
    }

    const priorRevisionNo = current === undefined
      ? 0
      : this.#positiveCounter(current.revision_no, "activation revision");
    const activationRevisionId = this.#managementId("skill_activation", {
      operation,
      idempotency_key: scope.idempotency_key,
      skill_id: scope.skill_id,
      scope: this.#scopedCatalogKey(scope),
    });
    const nextCatalogVersion = this.#managementId("skill_catalog", {
      previous_catalog_version: catalog.catalog_version,
      operation,
      idempotency_key: scope.idempotency_key,
    });
    const nextCatalogRevisionId = this.#managementId("skill_catalog_revision", {
      catalog_version: nextCatalogVersion,
      scope: this.#scopedCatalogKey(scope),
    });
    const nextActivationState = operation === "disable" ? "disabled" as const : "active" as const;
    const nextEntriesBySkill = new Map(entries.map((entry) => [entry.skill_id, entry]));
    if (operation === "disable") {
      nextEntriesBySkill.delete(scope.skill_id);
    } else {
      nextEntriesBySkill.set(scope.skill_id, {
        skill_id: version.skill_id,
        skill_key: version.skill_key,
        skill_name: version.skill_key,
        description: "",
        activation_revision_id: activationRevisionId,
        activation_state: "active",
        version_id: version.id,
        version: version.version,
        lifecycle_state: version.lifecycle_state,
        package_digest: version.package_digest,
        manifest_digest: version.manifest_digest,
      });
    }
    const nextEntries = [...nextEntriesBySkill.values()];
    const commandId = this.#managementId("skill_command", {
      scope_kind: "scoped",
      operation,
      idempotency_key: scope.idempotency_key,
    });
    const result = Object.freeze({
      scope_kind: "scoped" as const,
      operation,
      workspace_id: scope.workspace_id,
      bot_id: scope.bot_id,
      deployment_environment: scope.deployment_environment,
      release_channel: scope.release_channel,
      command_id: commandId,
      previous_revision: currentRevisionId,
      new_revision: activationRevisionId,
      catalog_version: nextCatalogVersion,
      security_revocation_epoch: catalog.security_revocation_epoch,
      duplicate_replayed: false,
    });
    const operationEventType = operation === "activate"
      ? "skill.version.activated"
      : operation === "rollback"
        ? "skill.activation.rolled_back"
        : "skill.activation.disabled";
    const operationEventPayload = operation === "disable"
      ? {
          scope_kind: "scoped" as const,
          workspace_id: scope.workspace_id,
          bot_id: scope.bot_id,
          deployment_environment: scope.deployment_environment,
          release_channel: scope.release_channel,
          skill_id: version.skill_id,
          skill_key: version.skill_key,
          version_id: version.id,
          version: version.version,
          activation_revision_id: activationRevisionId,
          previous_activation_revision_id: current!.id,
          catalog_version: nextCatalogVersion,
          disabled_at: commit.now,
          actor_principal_id: commit.actor_principal_id,
          reason_code: "disable",
        }
      : operation === "activate"
        ? {
            scope_kind: "scoped" as const,
            workspace_id: scope.workspace_id,
            bot_id: scope.bot_id,
            deployment_environment: scope.deployment_environment,
            release_channel: scope.release_channel,
            skill_id: version.skill_id,
            skill_key: version.skill_key,
            version_id: version.id,
            version: version.version,
            activation_revision_id: activationRevisionId,
            ...(current === undefined ? {} : {
              previous_activation_revision_id: current.id,
            }),
            catalog_version: nextCatalogVersion,
            actor_principal_id: commit.actor_principal_id,
            reason_code: "activate",
          }
        : {
            scope_kind: "scoped" as const,
            workspace_id: scope.workspace_id,
            bot_id: scope.bot_id,
            deployment_environment: scope.deployment_environment,
            release_channel: scope.release_channel,
            skill_id: version.skill_id,
            skill_key: version.skill_key,
            activation_revision_id: activationRevisionId,
            rolled_back_from_version_id: current!.version_id!,
            rolled_back_to_version_id: version.id,
            catalog_version: nextCatalogVersion,
            actor_principal_id: commit.actor_principal_id,
            reason_code: "rollback",
          };
    const catalogEventPayload = {
      scope_kind: "scoped" as const,
      workspace_id: scope.workspace_id,
      bot_id: scope.bot_id,
      deployment_environment: scope.deployment_environment,
      release_channel: scope.release_channel,
      catalog_revision_id: nextCatalogRevisionId,
      previous_catalog_version: catalog.catalog_version,
      catalog_version: nextCatalogVersion,
      catalog_as_of: commit.now,
      changed_skill_keys: [activationCommit.skill_key],
      security_revocation_epoch: catalog.security_revocation_epoch,
      actor_principal_id: commit.actor_principal_id,
      reason_code: operation,
    };
    const activationPayload = {
      skill_activation_revisions: {
        id: activationRevisionId,
        skill_id: version.skill_id,
        workspace_id: scope.workspace_id,
        bot_id: scope.bot_id,
        deployment_environment: scope.deployment_environment,
        release_channel: scope.release_channel,
        version_id: version.id,
        state: nextActivationState,
        revision_no: priorRevisionNo + 1,
        previous_revision_id: current?.id,
        actor_principal_id: commit.actor_principal_id,
        reason: scope.reason,
        created_at: commit.now,
      },
      skill_activation_current: {
        skill_id: version.skill_id,
        workspace_id: scope.workspace_id,
        bot_id: scope.bot_id,
        deployment_environment: scope.deployment_environment,
        release_channel: scope.release_channel,
        activation_revision_id: activationRevisionId,
        updated_at: commit.now,
      },
    };
    const catalogPayload = this.#catalogRevisionPayload(
      nextCatalogRevisionId,
      nextCatalogVersion,
      catalog,
      scope,
      commit.now,
    );
    const commandPayload = {
      skill_management_commands: {
        id: commandId,
        operation,
        scope_kind: "scoped",
        workspace_id: scope.workspace_id,
        bot_id: scope.bot_id,
        deployment_environment: scope.deployment_environment,
        release_channel: scope.release_channel,
        skill_id: version.skill_id,
        ...(operation === "activate" ? { version_id: version.id } : {}),
        ...(operation === "rollback" ? { target_version_id: version.id } : {}),
        expected_catalog_version: catalog.catalog_version,
        expected_activation_revision: currentRevisionId,
        request_hash: activationCommit.request_hash,
        idempotency_key: scope.idempotency_key,
        actor_principal_id: commit.actor_principal_id,
        actor_role: "registry_operator",
        reason: scope.reason,
        status: "completed",
        result_revision: activationRevisionId,
        result_catalog_version: nextCatalogVersion,
        result_security_revocation_epoch: catalog.security_revocation_epoch,
        response_payload: result,
        trace_id: scope.trace_id,
        created_at: commit.now,
        completed_at: commit.now,
      },
      skill_audit_logs: [{
        id: this.#managementId("skill_audit", { command_id: commandId }),
        skill_id: version.skill_id,
        version_id: version.id,
        actor: commit.actor_principal_id,
        action: operationEventType,
        decision: "allow",
        reason_code: operation,
        evidence_refs: [commandId, activationRevisionId],
        payload: { command_id: commandId, result },
        trace_id: scope.trace_id,
        created_at: commit.now,
      }],
    };
    try {
      await this.composition.unit_of_work.withTransaction(
        {
          operation: `skill_${operation}`,
          idempotency_key: scope.idempotency_key,
          trace_id: scope.trace_id,
          isolation: "serializable",
          retry: "serialization_failures",
        },
        (transaction, { owner }) => owner.executeWriter<unknown, "cas_skill_activation_current_v1">(
          transaction,
          {
            writer: "cas_skill_activation_current_v1",
            arguments: {
              p_skill_id: version.skill_id,
              p_operation: operation,
              p_expected_activation_revision_id: currentRevisionId,
              p_expected_catalog_version: catalog.catalog_version,
              p_activation_revision: activationPayload,
              p_catalog_revision: catalogPayload,
              p_catalog_entries: this.#catalogEntriesPayload(
                nextCatalogRevisionId,
                scope,
                nextEntries,
              ),
              p_management_command: commandPayload,
              p_activation_event: {
                skill_event_outbox: this.#eventRows(
                  operationEventType,
                  `skill_activation:${activationRevisionId}:${operation}`,
                  commit.now,
                  scope.trace_id,
                  operationEventPayload,
                  [
                    "trigger_processor.skill_projection",
                    "action_runtime.skill_projection",
                    "meta_cognition.skill_projection",
                  ],
                ),
              },
              p_catalog_event: {
                skill_event_outbox: this.#eventRows(
                  "skill.catalog.changed",
                  `skill_catalog:${nextCatalogRevisionId}`,
                  commit.now,
                  scope.trace_id,
                  catalogEventPayload,
                  [
                    "trigger_processor.skill_projection",
                    "action_runtime.skill_projection",
                    "meta_cognition.skill_projection",
                  ],
                ),
              },
              p_idempotency_key: scope.idempotency_key,
              p_request_hash: activationCommit.request_hash,
              p_trace_id: scope.trace_id,
            },
            expected_rows: 1,
          },
        ),
      );
    } catch (error) {
      const raced = await this.#readManagementResult(commit, true);
      if (raced !== undefined) return raced;
      throw error;
    }
    const persisted = await this.#readManagementResult(commit, false);
    if (persisted === undefined) {
      throw new Error("Skill activation management command was not persisted");
    }
    return persisted;
  }

  async #executePermissionManagement(
    commit: ManagementCommitV1 & {
      readonly request: Extract<
        ManagementCommitV1["request"],
        { readonly operation: "permission_grant" | "permission_revoke" }
      >;
    },
  ): Promise<SkillManagementResultV1> {
    const catalog = await this.#managementCatalog(commit);
    const scope = commit.request;
    if (!(await this.#skillExists(scope.skill_id, commit.skill_key))) {
      throw new SkillRegistryApplicationErrorV1(
        "version_not_publishable",
        "permission skill was not found",
      );
    }
    if (scope.scope_hash !== skillPermissionScopeHashV1(scope)) {
      throw new SkillRegistryApplicationErrorV1(
        "authorization_scope_mismatch",
        "permission scope hash drifted before owner commit",
      );
    }
    const current = await this.#readPermission(
      scope,
      scope.skill_id,
      scope.scope_hash,
    );
    const currentRevisionId = current?.permission_revision_id ?? "none";
    if (currentRevisionId !== scope.expected_permission_revision) {
      throw new SkillRegistryApplicationErrorV1(
        "permission_conflict",
        "expected permission revision is stale",
        { current_permission_revision: currentRevisionId },
      );
    }
    const currentRevisionNo = current === undefined
      ? 0
      : this.#positiveCounter(current.revision_no, "permission revision");
    const permissionRevisionId = this.#managementId("skill_permission", {
      operation: scope.operation,
      idempotency_key: scope.idempotency_key,
      skill_id: scope.skill_id,
      scope_hash: scope.scope_hash,
    });
    const nextCatalogVersion = this.#managementId("skill_catalog", {
      previous_catalog_version: catalog.catalog_version,
      operation: scope.operation,
      idempotency_key: scope.idempotency_key,
    });
    const nextCatalogRevisionId = this.#managementId("skill_catalog_revision", {
      catalog_version: nextCatalogVersion,
      scope: this.#scopedCatalogKey(scope),
    });
    const nextDecision = scope.operation === "permission_grant"
      ? "allow" as const
      : "deny" as const;
    const permission = {
      permission_revision_id: permissionRevisionId,
      revision_no: currentRevisionNo + 1,
      decision: nextDecision,
      scope_hash: scope.scope_hash,
      owner_agent_id: scope.owner_agent_id ?? null,
      capability_refs: [...scope.capability_refs],
    };
    const entries = await this.#readCatalogEntries(catalog.catalog_revision_id);
    const commandId = this.#managementId("skill_command", {
      scope_kind: "scoped",
      operation: scope.operation,
      idempotency_key: scope.idempotency_key,
    });
    const result = Object.freeze({
      scope_kind: "scoped" as const,
      operation: scope.operation,
      workspace_id: scope.workspace_id,
      bot_id: scope.bot_id,
      deployment_environment: scope.deployment_environment,
      release_channel: scope.release_channel,
      command_id: commandId,
      previous_revision: currentRevisionId,
      new_revision: permissionRevisionId,
      catalog_version: nextCatalogVersion,
      security_revocation_epoch: catalog.security_revocation_epoch,
      duplicate_replayed: false,
    });
    const permissionEventType = scope.operation === "permission_grant"
      ? "skill.permission.granted"
      : "skill.permission.revoked";
    const permissionEventPayload = {
      scope_kind: "scoped" as const,
      workspace_id: scope.workspace_id,
      bot_id: scope.bot_id,
      deployment_environment: scope.deployment_environment,
      release_channel: scope.release_channel,
      skill_id: scope.skill_id,
      skill_key: commit.skill_key,
      permission_revision_id: permissionRevisionId,
      scope_hash: scope.scope_hash,
      ...(scope.owner_agent_id === undefined
        ? {}
        : { owner_agent_id: scope.owner_agent_id }),
      ...(scope.operation === "permission_grant"
        ? { capability_refs: [...scope.capability_refs] }
        : {
            revoked_capability_refs: [...scope.capability_refs],
            security_revocation_epoch: catalog.security_revocation_epoch,
          }),
      catalog_version: nextCatalogVersion,
      actor_principal_id: commit.actor_principal_id,
      reason_code: scope.operation,
    };
    const catalogEventPayload = {
      scope_kind: "scoped" as const,
      workspace_id: scope.workspace_id,
      bot_id: scope.bot_id,
      deployment_environment: scope.deployment_environment,
      release_channel: scope.release_channel,
      catalog_revision_id: nextCatalogRevisionId,
      previous_catalog_version: catalog.catalog_version,
      catalog_version: nextCatalogVersion,
      catalog_as_of: commit.now,
      changed_skill_keys: [commit.skill_key],
      security_revocation_epoch: catalog.security_revocation_epoch,
      actor_principal_id: commit.actor_principal_id,
      reason_code: scope.operation,
    };
    const catalogRevision = {
      catalog_revision_id: nextCatalogRevisionId,
      catalog_version: nextCatalogVersion,
      catalog_as_of: commit.now,
      security_revocation_epoch: catalog.security_revocation_epoch,
    };
    const summaryPayload = await this.#permissionSummaryPayload(
      commit,
      catalogRevision,
      entries,
      permission,
    );
    const permissionPayload = {
      skill_permission_revisions: {
        id: permissionRevisionId,
        skill_id: scope.skill_id,
        workspace_id: scope.workspace_id,
        bot_id: scope.bot_id,
        deployment_environment: scope.deployment_environment,
        release_channel: scope.release_channel,
        owner_agent_id: permission.owner_agent_id,
        decision: nextDecision,
        capability_refs: permission.capability_refs,
        scope_hash: scope.scope_hash,
        revision_no: permission.revision_no,
        previous_revision_id: current?.permission_revision_id,
        actor_principal_id: commit.actor_principal_id,
        reason: scope.reason,
        created_at: commit.now,
      },
      skill_permission_current: {
        skill_id: scope.skill_id,
        workspace_id: scope.workspace_id,
        bot_id: scope.bot_id,
        deployment_environment: scope.deployment_environment,
        release_channel: scope.release_channel,
        scope_hash: scope.scope_hash,
        permission_revision_id: permissionRevisionId,
        updated_at: commit.now,
      },
    };
    const catalogPayload = this.#catalogRevisionPayload(
      nextCatalogRevisionId,
      nextCatalogVersion,
      catalog,
      scope,
      commit.now,
    );
    const commandPayload = {
      skill_management_commands: {
        id: commandId,
        operation: scope.operation,
        scope_kind: "scoped",
        workspace_id: scope.workspace_id,
        bot_id: scope.bot_id,
        deployment_environment: scope.deployment_environment,
        release_channel: scope.release_channel,
        skill_id: scope.skill_id,
        owner_agent_id: permission.owner_agent_id,
        capability_refs: permission.capability_refs,
        scope_hash: scope.scope_hash,
        expected_catalog_version: catalog.catalog_version,
        expected_permission_revision: currentRevisionId,
        request_hash: commit.request_hash,
        idempotency_key: scope.idempotency_key,
        actor_principal_id: commit.actor_principal_id,
        actor_role: "registry_operator",
        reason: scope.reason,
        status: "completed",
        result_revision: permissionRevisionId,
        result_catalog_version: nextCatalogVersion,
        result_security_revocation_epoch: catalog.security_revocation_epoch,
        response_payload: result,
        trace_id: scope.trace_id,
        created_at: commit.now,
        completed_at: commit.now,
      },
      skill_audit_logs: [{
        id: this.#managementId("skill_audit", { command_id: commandId }),
        skill_id: scope.skill_id,
        actor: commit.actor_principal_id,
        action: permissionEventType,
        decision: "allow",
        reason_code: scope.operation,
        evidence_refs: [commandId, permissionRevisionId],
        payload: { command_id: commandId, result },
        trace_id: scope.trace_id,
        created_at: commit.now,
      }],
    };
    try {
      await this.composition.unit_of_work.withTransaction(
        {
          operation: `skill_${scope.operation}`,
          idempotency_key: scope.idempotency_key,
          trace_id: scope.trace_id,
          isolation: "serializable",
          retry: "serialization_failures",
        },
        (transaction, { owner }) => owner.executeWriter<unknown, "cas_skill_permission_current_v1">(
          transaction,
          {
            writer: "cas_skill_permission_current_v1",
            arguments: {
              p_skill_id: scope.skill_id,
              p_operation: scope.operation,
              p_expected_permission_revision_id: currentRevisionId,
              p_expected_catalog_version: catalog.catalog_version,
              p_permission_revision: permissionPayload,
              p_catalog_revision: catalogPayload,
              p_catalog_entries: this.#catalogEntriesPayload(
                nextCatalogRevisionId,
                scope,
                entries,
              ),
              p_summary: summaryPayload,
              p_management_command: commandPayload,
              p_permission_event: {
                skill_event_outbox: this.#eventRows(
                  permissionEventType,
                  `skill_permission:${permissionRevisionId}:${scope.operation}`,
                  commit.now,
                  scope.trace_id,
                  permissionEventPayload,
                  [
                    "action_runtime.skill_projection",
                    "trigger_processor.skill_projection",
                  ],
                ),
              },
              p_catalog_event: {
                skill_event_outbox: this.#eventRows(
                  "skill.catalog.changed",
                  `skill_catalog:${nextCatalogRevisionId}`,
                  commit.now,
                  scope.trace_id,
                  catalogEventPayload,
                  [
                    "trigger_processor.skill_projection",
                    "action_runtime.skill_projection",
                    "meta_cognition.skill_projection",
                  ],
                ),
              },
              p_idempotency_key: scope.idempotency_key,
              p_request_hash: commit.request_hash,
              p_trace_id: scope.trace_id,
            },
            expected_rows: 1,
          },
        ),
      );
    } catch (error) {
      const raced = await this.#readManagementResult(commit, true);
      if (raced !== undefined) return raced;
      throw error;
    }
    const persisted = await this.#readManagementResult(commit, false);
    if (persisted === undefined) {
      throw new Error("Skill permission management command was not persisted");
    }
    return persisted;
  }
  public async queryCatalog(
    commit: CatalogQueryCommitV1,
  ): Promise<SkillCatalogQueryDetailsV1> {
    if (commit.request.cursor !== undefined) {
      // There is deliberately no process-local cursor fallback. Cursor
      // persistence is a separate durable owner capability; until it exists,
      // callers must restart from the first page instead of receiving an
      // unstable continuation token.
      throw new SkillRegistryApplicationErrorV1(
        "invalid_cursor",
        "durable catalog cursors are unavailable",
        { reason: "malformed", restart_from_first_page: true },
      );
    }
    const catalog = await this.#readCatalog(
      commit.request,
      commit.request.as_of,
    );
    if (catalog === undefined) {
      throw new SkillRegistryApplicationErrorV1(
        "catalog_version_conflict",
        "requested catalog snapshot is unavailable",
        {
          requested_catalog_version: null,
          current_catalog_version: null,
          requested_as_of: commit.request.as_of ?? null,
          conflict_reason: "catalog_snapshot_unavailable",
        },
      );
    }
    const summary = await this.#loadOrCreateSummary(
      catalog,
      commit.request,
      commit.request.trace_id,
    );
    const entries = await this.#readCatalogEntries(catalog.catalog_revision_id);
    const decisions = new Map(summary.entries.map((entry) => [entry.skill_id, entry]));
    const filter = commit.request.filter?.toLocaleLowerCase("en-US");
    const items = entries
      .filter((entry) => {
        const permission = decisions.get(entry.skill_id);
        return entry.activation_state === "active" &&
          entry.lifecycle_state !== "revoked" &&
          permission?.decision === "grant" &&
          (permission.owner_agent_condition === undefined ||
            permission.owner_agent_condition === null ||
            permission.owner_agent_condition === commit.request.owner_agent_id) &&
          (filter === undefined ||
            [entry.skill_id, entry.skill_key, entry.skill_name].some((value) =>
              value.toLocaleLowerCase("en-US").includes(filter),
            ));
      })
      .map((entry) => ({
        skill_id: entry.skill_id,
        skill_key: entry.skill_key,
        skill_name: entry.skill_name,
        version_id: entry.version_id,
        version: entry.version,
        activation_revision_id: entry.activation_revision_id,
        lifecycle_state: entry.lifecycle_state as "published" | "deprecated",
        capability_refs: [...(decisions.get(entry.skill_id)?.capability_refs ?? [])],
      }))
      .sort((left, right) => left.skill_id.localeCompare(right.skill_id, "en"))
      .slice(0, commit.page_size);
    return Object.freeze({
      schema_version: "skill_catalog_response.v1",
      workspace_id: commit.request.workspace_id,
      bot_id: commit.request.bot_id,
      owner_agent_id: commit.request.owner_agent_id,
      deployment_environment: commit.request.deployment_environment,
      release_channel: commit.request.release_channel,
      catalog_revision_id: catalog.catalog_revision_id,
      catalog_version: catalog.catalog_version,
      as_of: catalog.catalog_as_of,
      security_revocation_epoch: catalog.security_revocation_epoch,
      skill_permission_summary_ref: summary.summary_ref,
      skill_permission_summary_hash: summary.summary_hash,
      items,
      next_cursor: null,
    });
  }

  public async readContextCatalog(
    commit: ContextCatalogReadCommitV1,
  ): Promise<SkillContextCatalogDetailsV1> {
    const catalog = await this.#readCatalog(commit.request);
    if (catalog === undefined) {
      throw new SkillRegistryApplicationErrorV1(
        "catalog_version_conflict",
        "current context catalog is unavailable",
        {
          requested_catalog_version: null,
          current_catalog_version: null,
          requested_as_of: null,
          conflict_reason: "catalog_snapshot_unavailable",
        },
      );
    }
    const items = (await this.#readCatalogEntries(catalog.catalog_revision_id))
      .filter((entry) =>
        entry.activation_state === "active" && entry.lifecycle_state !== "revoked",
      )
      .sort((left, right) => left.skill_key.localeCompare(right.skill_key, "en"))
      .slice(0, commit.request.limit)
      .map((entry) => Object.freeze({
        skill_key: entry.skill_key,
        name: entry.skill_name,
        description: entry.description,
        active_version: entry.version,
        package_digest: entry.package_digest,
        manifest_digest: entry.manifest_digest,
        runtime_target: SKILL_RUNTIME_TARGET_V1,
      }));
    return Object.freeze({
      schema_version: "skill_context_catalog_response.v1",
      workspace_id: commit.request.workspace_id,
      bot_id: commit.request.bot_id,
      owner_agent_id: commit.request.owner_agent_id,
      deployment_environment: commit.request.deployment_environment,
      release_channel: commit.request.release_channel,
      catalog_version: catalog.catalog_version,
      as_of: catalog.catalog_as_of,
      items,
    });
  }

  public async readPermissionSummary(
    reference: string,
  ): Promise<SkillPermissionSummaryV1 | undefined> {
    return this.#readSummary(reference);
  }
  public async replayResolutionAttempt(
    request: Parameters<SkillRegistryApplicationRepositoryPortV1["replayResolutionAttempt"]>[0],
    requestHash: string,
  ): Promise<SkillResolveResultV1 | undefined> {
    const result = await this.composition.read_committed_postgres
      .withReadCommittedTransaction((transaction) =>
        transaction.query<{
          request_hash: string;
          status: string;
          error_code: string | null;
          response_payload: unknown;
        }>(
          `SELECT request_hash, status, error_code, response_payload
             FROM skill_registry.skill_resolution_attempts
            WHERE runtime_run_id = $1::text AND start_attempt_no = $2::integer
            LIMIT 2`,
          [request.runtime_run_id, request.start_attempt_no],
        ),
      );
    if (result.rows.length === 0) return undefined;
    if (result.rows.length !== 1) throw new Error("Skill resolution attempt uniqueness drift");
    const row = result.rows[0]!;
    if (row.request_hash !== requestHash) {
      throw new SkillRegistryApplicationErrorV1(
        "idempotency_conflict", "resolution attempt body drift",
      );
    }
    if (row.status === "resolving") {
      throw new SkillRegistryApplicationErrorV1(
        "registry_unavailable", "resolution attempt is still settling",
      );
    }
    if (row.status === "failed") {
      throw new SkillRegistryApplicationErrorV1(
        (row.error_code ?? "registry_unavailable") as SkillRegistryErrorCodeV1,
        "resolution attempt previously failed",
      );
    }
    if (row.status !== "resolved" || typeof row.response_payload !== "object" ||
        row.response_payload === null || Array.isArray(row.response_payload)) {
      throw new Error("Skill Registry resolution terminal evidence is invalid");
    }
    return Object.freeze({
      ...(structuredClone(row.response_payload) as SkillResolveResultV1),
      duplicate_replayed: true,
    });
  }

  public async recordResolutionFailure(
    request: Parameters<SkillRegistryApplicationRepositoryPortV1["recordResolutionFailure"]>[0],
    requestHash: string,
    error: SkillRegistryApplicationErrorV1,
  ): Promise<never> {
    const attempt = await this.#readAttempt(request.runtime_run_id, request.start_attempt_no);
    if (attempt === undefined) throw error;
    if (attempt.request_hash !== requestHash) {
      throw new SkillRegistryApplicationErrorV1("idempotency_conflict", "resolution attempt body drift");
    }
    if (attempt.status === "resolved") {
      const replay = await this.replayResolutionAttempt(request, requestHash);
      if (replay !== undefined) return replay as never;
    }
    if (attempt.status === "resolving") {
      await this.#failResolutionAttempt(attempt, error, request.trace_id);
    }
    throw error;
  }

  public async resolveAttempt(
    commit: ResolutionCommitV1,
  ): Promise<SkillResolveResultV1> {
    const replay = await this.replayResolutionAttempt(commit.request, commit.request_hash);
    if (replay !== undefined) return replay;
    const catalog = await this.#readCatalog(commit.request, commit.request.catalog_as_of);
    if (catalog === undefined || catalog.catalog_version !== commit.request.expected_catalog_version ||
        catalog.catalog_as_of !== commit.request.catalog_as_of ||
        catalog.catalog_revision_id !== commit.summary.catalog_revision_id) {
      throw new SkillRegistryApplicationErrorV1(
        "catalog_version_conflict", "requested catalog revision is unavailable",
        { requested_catalog_version: commit.request.expected_catalog_version,
          current_catalog_version: catalog?.catalog_version ?? null,
          conflict_reason: "catalog_revision_unavailable", recovery_action: "recompose_context" },
      );
    }
    if (catalog.security_revocation_epoch !== commit.summary.security_revocation_epoch) {
      throw new SkillRegistryApplicationErrorV1(
        "permission_denied", "security epoch advanced after policy freeze",
        { reason_code: "security_epoch_advanced" },
      );
    }
    const attempt = await this.#ensureResolvingAttempt(commit, catalog);
    if (attempt.status !== "resolving") {
      const replay = await this.replayResolutionAttempt(
        commit.request,
        commit.request_hash,
      );
      if (replay !== undefined) return replay;
      throw new SkillRegistryApplicationErrorV1(
        "registry_unavailable",
        "resolution attempt reached an invalid terminal state",
      );
    }
    const entries = await this.#readCatalogEntries(catalog.catalog_revision_id);
    const entryByKey = new Map(entries.map((entry) => [entry.skill_key, entry]));
    const summaryByKey = new Map(commit.summary.entries.map((entry) => [entry.skill_key, entry]));
    const permissions = await this.#readPermissions(commit.request);
    const resolved: ResolvedSkillV1[] = [];
    const degradation: Array<{ skill_key: string; reason: "not_found" | "activation_disabled" | "permission_denied" | "version_revoked" }> = [];
    let terminalError: SkillRegistryApplicationErrorV1 | undefined;
    for (const item of commit.request.skills) {
      const entry = entryByKey.get(item.name);
      const summary = summaryByKey.get(item.name);
      const permissionState = entry === undefined ? undefined : permissions.get(entry.skill_id);
      const permission = permissionState?.general?.decision === "deny"
        ? permissionState.general
        : permissionState?.specific?.decision === "deny"
          ? permissionState.specific
          : permissionState?.specific ?? permissionState?.general;
      let reason: "not_found" | "activation_disabled" | "permission_denied" | "version_revoked" | undefined;
      if (entry === undefined) reason = "not_found";
      else if (entry.activation_state !== "active") reason = "activation_disabled";
      else if (entry.lifecycle_state === "revoked") reason = "version_revoked";
      else if (summary === undefined || summary.decision !== "grant" ||
        summary.activation_revision_id !== entry.activation_revision_id ||
        summary.version_id !== entry.version_id || permission === undefined ||
        permission.decision !== "allow" ||
        (permission.owner_agent_id !== null && permission.owner_agent_id !== commit.request.owner_agent_id)) {
        reason = "permission_denied";
      }
      if (reason !== undefined) {
        degradation.push({ skill_key: item.name, reason });
        if (item.required && terminalError === undefined) {
          terminalError = new SkillRegistryApplicationErrorV1(
            reason === "permission_denied" ? "permission_denied" :
              reason === "version_revoked" ? "version_revoked" : "required_skill_unavailable",
            "required skill is unavailable", { skill_key: item.name, reason },
          );
        }
        continue;
      }
      if (entry === undefined || summary === undefined || permission === undefined) {
        throw new Error("Skill resolution decision drift");
      }
      resolved.push(Object.freeze({
        resolution_id: this.#resolutionId(attempt.id, item.name), skill_id: entry.skill_id,
        skill_key: entry.skill_key, version_id: entry.version_id, version: entry.version,
        package_digest: entry.package_digest, manifest_digest: entry.manifest_digest,
        runtime_target: SKILL_RUNTIME_TARGET_V1,
        granted_capability_refs: [...permission!.capability_refs]
          .filter((capability) => summary!.capability_refs.includes(capability)).sort(),
        required: item.required, valid_until: commit.policy.policy.expires_at,
      }));
    }
    if (terminalError !== undefined) {
      await this.#failResolutionAttempt(attempt, terminalError, commit.request.trace_id);
      throw terminalError;
    }
    if (resolved.length === 0) {
      const error = new SkillRegistryApplicationErrorV1(
        "required_skill_unavailable",
        "no requested skill can be persisted as a resolution",
        { reason: "not_found" },
      );
      await this.#failResolutionAttempt(attempt, error, commit.request.trace_id);
      throw error;
    }
    const result: SkillResolveResultV1 = Object.freeze({
      schema_version: "skill_resolution_response.v1", resolution_attempt_id: attempt.id,
      runtime_run_id: commit.request.runtime_run_id, start_attempt_no: commit.request.start_attempt_no,
      workspace_id: commit.request.workspace_id, bot_id: commit.request.bot_id,
      owner_agent_id: commit.request.owner_agent_id,
      deployment_environment: commit.request.deployment_environment,
      release_channel: commit.request.release_channel,
      requested_catalog_version: commit.request.expected_catalog_version,
      effective_catalog_version: commit.request.expected_catalog_version,
      catalog_as_of: commit.request.catalog_as_of,
      security_revocation_epoch: catalog.security_revocation_epoch,
      policy_input_hash: commit.request.policy_input_hash,
      valid_until: commit.policy.policy.expires_at,
      resolved_skills: resolved, degradation_notes: degradation,
      duplicate_replayed: false,
    });
    await this.#completeResolutionAttempt(attempt, catalog, commit, result);
    return result;
  }
  public async authorizeContent(
    request: SkillContentRequestV1,
    now: string,
  ): Promise<SkillContentAuthorizationV1> {
    if (request.owner_agent_id === undefined) {
      throw new SkillRegistryApplicationErrorV1(
        "resolution_not_found",
        "resolution was not found in this run scope",
      );
    }
    const rowResult = await this.composition.read_committed_postgres
      .withReadCommittedTransaction((transaction) =>
        transaction.query<Record<string, unknown>>(
          `SELECT resolution.id AS resolution_id, resolution.runtime_run_id,
                  resolution.skill_id, resolution.skill_key, resolution.required,
                  resolution.version_id, resolution.package_digest AS resolution_package_digest,
                  resolution.manifest_digest AS resolution_manifest_digest,
                  resolution.runtime_target AS resolution_runtime_target,
                  resolution.granted_capability_refs,
                  to_char(resolution.valid_until AT TIME ZONE 'UTC', 'YYYY-MM-DD') || 'T' || to_char(resolution.valid_until AT TIME ZONE 'UTC', 'HH24:MI:SS.MS') || 'Z' AS valid_until,
                  attempt.workspace_id, attempt.bot_id, attempt.owner_agent_id,
                  attempt.deployment_environment, attempt.release_channel,
                  attempt.security_revocation_epoch AS resolution_security_epoch,
                  version.version, version.lifecycle_state, version.lifecycle_version,
                  version.package_digest, version.manifest_digest,
                  package.package_ref, package.object_access_decision_ref,
                  package.owner_object_id, package.owner_state_version,
                  package.media_type, package.size_bytes, package.retention_state,
                  security.security_revocation_epoch AS current_security_epoch
             FROM skill_registry.skill_resolutions AS resolution
             JOIN skill_registry.skill_resolution_attempts AS attempt
               ON attempt.id = resolution.resolution_attempt_id
              AND attempt.runtime_run_id = resolution.runtime_run_id
              AND attempt.start_attempt_no = resolution.start_attempt_no
             JOIN skill_registry.skill_versions AS version ON version.id = resolution.version_id
             JOIN skill_registry.skill_packages AS package ON package.version_id = version.id
             JOIN skill_registry.skill_security_state AS security ON security.singleton_key = TRUE
            WHERE resolution.id = $1::text
              AND resolution.runtime_run_id = $2::text
              AND resolution.status = 'resolved'
              AND attempt.status = 'resolved'
              AND attempt.workspace_id = $3::text AND attempt.bot_id = $4::text
              AND attempt.owner_agent_id = $5::text
              AND attempt.deployment_environment = $6::text
              AND attempt.release_channel = $7::text
            LIMIT 2`,
          [request.resolution_id, request.runtime_run_id, request.workspace_id,
            request.bot_id, request.owner_agent_id, request.deployment_environment,
            request.release_channel],
        ),
      );
    if (rowResult.rows.length !== 1) {
      throw new SkillRegistryApplicationErrorV1(
        "resolution_not_found",
        "resolution was not found in this run scope",
      );
    }
    const row = rowResult.rows[0]!;
    const validUntil = String(row.valid_until);
    if (!Number.isFinite(Date.parse(validUntil)) || Date.parse(validUntil) <= Date.parse(now)) {
      throw new SkillRegistryApplicationErrorV1(
        "resolution_expired",
        "resolution policy has expired",
      );
    }
    if (row.lifecycle_state === "revoked") {
      throw new SkillRegistryApplicationErrorV1(
        "version_revoked",
        "resolved version has been revoked",
      );
    }
    const resolutionEpoch = Number(row.resolution_security_epoch);
    const currentEpoch = Number(row.current_security_epoch);
    if (request.security_revocation_epoch !== resolutionEpoch ||
        request.security_revocation_epoch !== currentEpoch) {
      throw new SkillRegistryApplicationErrorV1(
        "resolution_expired",
        "security epoch advanced for this run",
      );
    }
    if (row.retention_state !== "retained") {
      throw new SkillRegistryApplicationErrorV1(
        "content_unavailable",
        "skill package is not retained",
      );
    }
    if (row.package_digest !== request.expected_package_digest ||
        row.manifest_digest !== request.expected_manifest_digest ||
        row.resolution_package_digest !== row.package_digest ||
        row.resolution_manifest_digest !== row.manifest_digest ||
        row.resolution_runtime_target !== SKILL_RUNTIME_TARGET_V1) {
      throw new SkillRegistryApplicationErrorV1(
        "content_unavailable",
        "resolved package identity no longer matches the request",
      );
    }
    const currentCatalog = await this.#readCatalog(request);
    if (currentCatalog === undefined) {
      throw new SkillRegistryApplicationErrorV1(
        "content_unavailable",
        "current catalog is unavailable",
      );
    }
    const currentEntry = (await this.#readCatalogEntries(currentCatalog.catalog_revision_id))
      .find((entry) => entry.skill_id === row.skill_id);
    if (currentEntry === undefined || currentEntry.activation_state !== "active" ||
        currentEntry.version_id !== row.version_id || row.lifecycle_state === "revoked") {
      throw new SkillRegistryApplicationErrorV1(
        "content_unavailable",
        "resolved activation is no longer current",
      );
    }
    const permissions = await this.#readPermissions({
      workspace_id: request.workspace_id,
      bot_id: request.bot_id,
      owner_agent_id: request.owner_agent_id,
      deployment_environment: request.deployment_environment,
      release_channel: request.release_channel,
    });
    const permissionState = permissions.get(String(row.skill_id));
    const permission = permissionState?.general?.decision === "deny"
      ? permissionState.general
      : permissionState?.specific?.decision === "deny"
        ? permissionState.specific
        : permissionState?.specific ?? permissionState?.general;
    if (permission === undefined || permission.decision !== "allow" ||
        (permission.owner_agent_id !== null && permission.owner_agent_id !== request.owner_agent_id)) {
      throw new SkillRegistryApplicationErrorV1(
        "permission_denied",
        "current permission no longer grants content",
      );
    }
    const safeInteger = (value: unknown, label: string): number => {
      const parsed = Number(value);
      if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`${label} is invalid`);
      return parsed;
    };
    const resolution: ResolvedSkillV1 = Object.freeze({
      resolution_id: String(row.resolution_id), skill_id: String(row.skill_id),
      skill_key: String(row.skill_key), version_id: String(row.version_id),
      version: String(row.version), package_digest: String(row.package_digest),
      manifest_digest: String(row.manifest_digest), runtime_target: SKILL_RUNTIME_TARGET_V1,
      granted_capability_refs: [...(row.granted_capability_refs as readonly string[])].sort(),
      required: row.required === true, valid_until: validUntil,
    });
    return Object.freeze({
      version: Object.freeze({
        skill_id: String(row.skill_id), skill_key: String(row.skill_key),
        skill_name: currentEntry.skill_name, version_id: String(row.version_id),
        version: String(row.version),
        lifecycle_state: row.lifecycle_state as "published" | "deprecated" | "revoked",
        lifecycle_version: safeInteger(row.lifecycle_version, "lifecycle version"),
        package_digest: String(row.package_digest), manifest_digest: String(row.manifest_digest),
        runtime_target: SKILL_RUNTIME_TARGET_V1,
        package_ref: String(row.package_ref) as never,
        object_access_decision_ref: String(row.object_access_decision_ref),
        owner_object_id: String(row.owner_object_id),
        owner_state_version: safeInteger(row.owner_state_version, "owner state version"),
        media_type: String(row.media_type), size_bytes: safeInteger(row.size_bytes, "size bytes"),
        retention_state: row.retention_state as "retained" | "deletion_pending" | "deleted" | "delete_failed",
      }),
      resolution,
      valid_until: validUntil,
    });
  }

  public async recordContentAudit(
    request: SkillContentRequestV1,
    decision: "allow" | "deny",
    reasonCode: string,
  ): Promise<void> {
    const auditId = `skill_content_audit_${randomUUID()}`;
    const audit = {
      skill_audit_logs: [{
        id: auditId, runtime_run_id: request.runtime_run_id,
        actor: "skill_registry", action: "skill.content.fetch", decision,
        reason_code: reasonCode, evidence_refs: [request.resolution_id],
        payload: { resolution_id: request.resolution_id, request_hash: canonicalHashV1(request) },
        trace_id: request.trace_id,
      }],
    };
    await this.composition.unit_of_work.withTransaction(
      { operation: "record_skill_content_audit", idempotency_key: auditId,
        trace_id: request.trace_id, isolation: "serializable", retry: "serialization_failures" },
      (transaction, { owner }) => owner.executeWriter<unknown, "record_skill_content_audit_v1">(
        transaction,
        { writer: "record_skill_content_audit_v1", arguments: {
          p_audit_id: auditId, p_audit: audit, p_idempotency_key: auditId,
          p_request_hash: canonicalHashV1(audit), p_trace_id: request.trace_id,
        }, expected_rows: 1 },
      ),
    );
  }
  public async applyCandidateApplication(
    commit: CandidateApplicationCommitV1,
  ): Promise<ReturnType<SkillRegistryApplicationRepositoryPortV1["applyCandidateApplication"]> extends Promise<infer T> ? T : never> {
    const existing = await this.composition.read_committed_postgres
      .withReadCommittedTransaction((transaction) =>
        transaction.query<{
          request_hash: string;
          id: string;
          status: "received" | "deprecation_review_created";
          review_ref: string | null;
          response_ref: string;
          response_hash: string;
        }>(
          `SELECT request_hash, id, status, review_ref, response_ref, response_hash
             FROM skill_registry.skill_candidate_applications
            WHERE idempotency_key = $1::text
            LIMIT 2`,
          [commit.request.idempotency_key],
        ),
      );
    if (existing.rows.length > 1) {
      throw new Error("Skill candidate application idempotency uniqueness drift");
    }
    if (existing.rows.length === 1) {
      const row = existing.rows[0]!;
      if (row.request_hash !== commit.request_hash || row.id !== commit.request.application_id) {
        throw new SkillRegistryApplicationErrorV1(
          "idempotency_conflict",
          "candidate application request body drift",
        );
      }
      return Object.freeze({
        application_id: row.id,
        status: row.status,
        ...(row.review_ref === null ? {} : { review_ref: row.review_ref }),
        response_ref: row.response_ref,
        response_hash: row.response_hash,
        duplicate_replayed: true,
      }) as never;
    }
    const catalog = await this.#readCatalog(commit.request);
    if (catalog === undefined ||
        catalog.catalog_version !== commit.request.baseline_catalog_version) {
      throw new SkillRegistryApplicationErrorV1(
        "catalog_version_conflict",
        "candidate application baseline catalog is stale",
        {
          requested_catalog_version: commit.request.baseline_catalog_version,
          current_catalog_version: catalog?.catalog_version ?? null,
          conflict_reason: "candidate_baseline_stale",
        },
      );
    }
    const lifecycle = commit.request.candidate_type === "deprecation"
      ? {
          status: "deprecation_review_created" as const,
          review_ref: `skill-deprecation-review:${commit.request.application_id}`,
        }
      : { status: "received" as const };
    // The external registry contract deliberately uses the concise
    // `deprecation` value, while the shared Skill/Meta persistence taxonomy
    // stores it as `skill_deprecation`.  Translate only at this persistence
    // boundary; the response and emitted event retain the public contract.
    const storageCandidateType = commit.request.candidate_type === "deprecation"
      ? "skill_deprecation"
      : commit.request.candidate_type;
    const responseRef =
      `skill-candidate-response:${commit.request.application_id}:${commit.request.review_version}`;
    const responseHash = canonicalHashV1({
      schema_version: "skill_candidate_application_response_artifact.v1",
      application_id: commit.request.application_id,
      candidate_id: commit.request.candidate_id,
      review_version: commit.request.review_version,
      candidate_type: commit.request.candidate_type,
      skill_key: commit.request.skill_key,
      ...lifecycle,
      response_ref: responseRef,
      created_at: commit.now,
    });
    const result = Object.freeze({
      application_id: commit.request.application_id,
      ...lifecycle,
      response_ref: responseRef,
      response_hash: responseHash,
      duplicate_replayed: false,
    });
    const eventPayload = {
      scope_kind: "provenance" as const,
      workspace_id: commit.request.workspace_id,
      bot_id: commit.request.bot_id,
      owner_agent_id: commit.request.owner_agent_id,
      deployment_environment: commit.request.deployment_environment,
      release_channel: commit.request.release_channel,
      actor_principal_id: commit.actor_principal_id,
      reason_code: "candidate_application",
      application_id: commit.request.application_id,
      candidate_id: commit.request.candidate_id,
      review_version: commit.request.review_version,
      candidate_type: commit.request.candidate_type,
      skill_key: commit.request.skill_key,
      status: result.status,
      ...(result.review_ref === undefined ? {} : { review_ref: result.review_ref }),
      response_ref: result.response_ref,
      response_hash: result.response_hash,
    };
    const payload = {
      skill_candidate_applications: {
        id: commit.request.application_id,
        candidate_id: commit.request.candidate_id,
        workspace_id: commit.request.workspace_id,
        bot_id: commit.request.bot_id,
        owner_agent_id: commit.request.owner_agent_id,
        deployment_environment: commit.request.deployment_environment,
        release_channel: commit.request.release_channel,
        review_version: commit.request.review_version,
        candidate_type: storageCandidateType,
        skill_key: commit.request.skill_key,
        baseline_catalog_version: commit.request.baseline_catalog_version,
        proposal_ref: commit.request.proposal_ref,
        proposal_hash: commit.request.proposal_hash,
        evidence_refs: commit.request.evidence_refs.map(({ ref }) => ref),
        reviewed_by: commit.request.reviewer_principal_id,
        schema_version: commit.request.schema_version,
        idempotency_key: commit.request.idempotency_key,
        request_hash: commit.request_hash,
        ...lifecycle,
        response_ref: responseRef,
        response_hash: responseHash,
        trace_id: commit.request.trace_id,
        created_at: commit.now,
        updated_at: commit.now,
      },
      skill_audit_logs: [{
        id: `skill_candidate_application_audit:${commit.request.application_id}`,
        application_id: commit.request.application_id,
        actor: commit.actor_principal_id,
        action: "skill.candidate.application.updated",
        decision: "allow",
        reason_code: "candidate_application",
        evidence_refs: commit.request.evidence_refs.map(({ ref }) => ref),
        payload: { request_hash: commit.request_hash, result },
        trace_id: commit.request.trace_id,
        created_at: commit.now,
      }],
      skill_event_outbox: [{
        id: `skill_candidate_application_event:${commit.request.application_id}:${commit.request.review_version}`,
        event_type: "skill.candidate.application.updated",
        schema_version: "skill_registry_event.v1",
        producer: "skill_registry",
        occurred_at: commit.now,
        idempotency_key: `skill_candidate_application_updated:${commit.request.application_id}:${commit.request.review_version}`,
        trace_id: commit.request.trace_id,
        payload: eventPayload,
        payload_hash: canonicalHashV1(eventPayload),
        target: "meta_cognition.skill_projection",
        status: "pending",
      }],
    };
    await this.composition.unit_of_work.withTransaction(
      {
        operation: "apply_skill_candidate_application",
        idempotency_key: commit.request.idempotency_key,
        trace_id: commit.request.trace_id,
        isolation: "serializable",
        retry: "serialization_failures",
      },
      (transaction, { owner }) => owner.executeWriter<unknown, "transition_skill_candidate_application_v1">(
        transaction,
        {
          writer: "transition_skill_candidate_application_v1",
          arguments: {
            p_application_id: commit.request.application_id,
            p_workspace_id: commit.request.workspace_id,
            p_bot_id: commit.request.bot_id,
            p_deployment_environment: commit.request.deployment_environment,
            p_release_channel: commit.request.release_channel,
            p_baseline_catalog_version: commit.request.baseline_catalog_version,
            p_application: payload,
            p_idempotency_key: commit.request.idempotency_key,
            p_request_hash: commit.request_hash,
            p_trace_id: commit.request.trace_id,
          },
          expected_rows: 1,
        },
      ),
    );
    return result as never;
  }
}

export function createSkillRegistryPostgresDelegateV1(
  composition: SkillRegistryPostgresCompositionV1,
): SkillRegistryApplicationRepositoryPortV1 {
  return new SkillRegistryPostgresDelegateV1(composition);
}

function assertVersionPinnedSkillRegistryWritersV1(): void {
  const contract =
    SKILL_REGISTRY_REPOSITORY_CONTRACT_V1 as typeof SKILL_REGISTRY_REPOSITORY_CONTRACT_V1 & {
      readonly writer_artifacts?: readonly Readonly<{
        readonly function_name: string;
        readonly function_body_sha256: string;
      }>[];
    };
  if (
    contract.writer_artifacts === undefined ||
    contract.writer_artifacts.length !==
      contract.function_signatures.length ||
    !contract.writer_artifacts.some(
      ({ function_name, function_body_sha256 }) =>
        function_name === "settle_skill_validation_v1" &&
        /^sha256:[0-9a-f]{64}$/u.test(function_body_sha256),
    )
  ) {
    throw new Error(
      "Skill Registry PostgreSQL application repository requires version-pinned pai-infra writer artifacts; 0450_skill_registry is not composable",
    );
  }
}

/** Production factory bound to an exact verified owner deployment. */
export function createSkillRegistryPostgresApplicationRepositoryV1(
  input: Readonly<{
    composition: SkillRegistryPostgresCompositionV1;
    delegate: SkillRegistryApplicationRepositoryPortV1;
  }>,
): SkillRegistryApplicationRepositoryPortV1 {
  assertVersionPinnedSkillRegistryWritersV1();
  if (
    typeof input !== "object" ||
    input === null ||
    typeof input.composition !== "object" ||
    input.composition === null ||
    typeof input.delegate !== "object" ||
    input.delegate === null ||
    input.composition.deployment.owner_service !== "skill_registry" ||
    input.delegate.persistence_kind !== "postgresql"
  ) {
    throw new Error(
      "Skill Registry PostgreSQL application repository dependencies are not durable owner capabilities",
    );
  }
  const store =
    new OwnerWriterSkillValidationTerminalStoreV1(
      input.composition,
    );
  return new SkillRegistryPostgresApplicationRepositoryV1(
    new SkillRegistryDurableValidationRepositoryV1(store),
    input.delegate,
  );
}
