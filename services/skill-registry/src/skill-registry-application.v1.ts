import { Buffer } from "node:buffer";
import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { types as nodeUtilTypes } from "node:util";

import {
  RUNTIME_POLICY_MAX_LIFETIME_MS_V1,
  SKILL_CATALOG_QUERY_MAX_LIMIT_V1,
  SKILL_CONTENT_GRANT_MAX_TTL_SECONDS_V1,
  SKILL_ENTRYPOINT_MAX_BYTES_V1,
  SKILL_INVALID_RUNTIME_POLICY_REASONS_V1,
  SKILL_PACKAGE_MAX_BYTES_V1,
  SKILL_PACKAGE_MAX_FILES_V1,
  SKILL_RUNTIME_TARGET_V1,
  SKILL_VALIDATION_DIAGNOSTIC_MAX_ITEMS_V1,
  SKILL_VALIDATION_RECORD_TTL_SECONDS_V1,
  SkillCatalogQueryRequestV1Schema,
  SkillCatalogQueryDetailsV1Schema,
  SkillContextCatalogDetailsV1Schema,
  SkillContextCatalogRequestV1Schema,
  SkillManagementCommandRequestV1Schema,
  SkillManagementCommandResponseV1Schema,
  SkillRollbackCommandV1Schema,
  SkillPermissionGrantCommandV1Schema,
  SkillPermissionRevokeCommandV1Schema,
  SkillDeprecateCommandV1Schema,
  SkillRevokeCommandV1Schema,
  SkillValidateRequestV1Schema,
  SkillValidateDetailsV1Schema,
  SkillActivateCommandV1Schema,
  SkillCandidateApplicationDetailsV1Schema,
  SkillCandidateApplicationRequestV1Schema,
  SkillContentDetailsV1Schema,
  SkillContentRequestV1Schema,
  SkillPackageManifestV1Schema,
  SkillPermissionSummaryV1Schema,
  SkillRegistryDomainEventV1Schema,
  SkillValidationDiagnosticV1Schema,
  SkillPublishDetailsV1Schema,
  SkillPublishRequestV1Schema,
  ResolvedSkillV1Schema,
  SkillResolveDetailsV1Schema,
  SkillResolveRequestV1Schema,
  assertSkillCatalogCursorBindingsV1,
  assertSkillCatalogQuerySemanticBindingsV1,
  assertSkillCandidateApplicationSemanticBindingsV1,
  assertSkillContentResponseSemanticBindingsV1,
  assertSkillManagementCommandSemanticBindingsV1,
  assertSkillPublishRequestSemanticBindingsV1,
  assertSkillPublishSemanticBindingsV1,
  assertSkillRegistryDomainEventSemanticBindingsV1,
  assertSkillValidateRequestSemanticBindingsV1,
  assertSkillValidateResponseSemanticBindingsV1,
  assertSkillResolveResponseSemanticBindingsV1,
  assertStrictlySortedUniqueStringsV1,
  skillManagementIdempotencyNamespaceV1,
  type ResolvedSkillV1 as ContractResolvedSkillV1,
  type DeploymentEnvironmentV1,
  type ReleaseChannelV1,
  type SkillActivateCommandV1 as ContractSkillActivateCommandV1,
  type SkillCandidateApplicationDetailsV1,
  type SkillCandidateApplicationRequestV1,
  type SkillCatalogCursorBindingsV1,
  type SkillCatalogItemV1,
  type SkillCatalogQueryDetailsV1,
  type SkillCatalogQueryRequestV1 as ContractSkillCatalogQueryRequestV1,
  type SkillContextCatalogDetailsV1,
  type SkillContextCatalogRequestV1,
  type SkillContentRequestV1 as ContractSkillContentRequestV1,
  type SkillManagementCommandRequestV1,
  type SkillManagementCommandResponseV1,
  type SkillDisableCommandV1 as ContractSkillDisableCommandV1,
  type SkillRollbackCommandV1 as ContractSkillRollbackCommandV1,
  type SkillPermissionGrantCommandV1 as ContractSkillPermissionGrantCommandV1,
  type SkillPermissionRevokeCommandV1 as ContractSkillPermissionRevokeCommandV1,
  type SkillDeprecateCommandV1 as ContractSkillDeprecateCommandV1,
  type SkillRevokeCommandV1 as ContractSkillRevokeCommandV1,
  type SkillPackageManifestV1 as ContractSkillPackageManifestV1,
  type SkillPermissionSummaryEntryV1 as ContractSkillPermissionSummaryEntryV1,
  type SkillPermissionSummaryV1 as ContractSkillPermissionSummaryV1,
  type SkillPublishRequestV1 as ContractSkillPublishRequestV1,
  type SkillResolveDetailsV1 as ContractSkillResolveDetailsV1,
  type SkillResolveItemRequestV1,
  type SkillResolveRequestV1 as ContractSkillResolveRequestV1,
  type SkillValidateDetailsV1,
  type SkillValidateRequestV1 as ContractSkillValidateRequestV1,
  type SkillValidationDiagnosticV1,
  type SkillRegistryDomainEventV1,
} from "@pai/contracts";
import {
  RuntimePolicyInputReadArtifactV1Schema,
  type RuntimePolicyInputReadArtifactV1,
} from "@pai/contracts/action-runtime/runtime-policy-input-read.v1";
import type { TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import type {
  ObjectRefV1,
  ObjectStorePortV1,
} from "@pai/object-store";

import {
  canonicalHashV1,
  canonicalJsonV1,
  sha256BytesV1,
} from "./canonical.v1.js";
import {
  resolveSkillRegistryConfigV1,
  type SkillRegistryConfigV1,
} from "./config.v1.js";

export {
  RUNTIME_POLICY_MAX_LIFETIME_MS_V1,
  SKILL_CONTENT_GRANT_MAX_TTL_SECONDS_V1,
  SKILL_ENTRYPOINT_MAX_BYTES_V1,
  SKILL_PACKAGE_MAX_BYTES_V1,
  SKILL_PACKAGE_MAX_FILES_V1,
  SKILL_RUNTIME_TARGET_V1,
} from "@pai/contracts";

export type SkillRegistryErrorCodeV1 =
  | "invalid_request"
  | "invalid_cursor"
  | "invalid_skill_package"
  | "package_scan_failed"
  | "authorization_scope_mismatch"
  | "invalid_runtime_policy"
  | "catalog_version_conflict"
  | "permission_denied"
  | "version_revoked"
  | "required_skill_unavailable"
  | "idempotency_conflict"
  | "validation_not_found"
  | "validation_expired"
  | "validation_already_published"
  | "content_integrity_mismatch"
  | "version_not_publishable"
  | "activation_conflict"
  | "permission_conflict"
  | "lifecycle_conflict"
  | "invalid_state_transition"
  | "resolution_not_found"
  | "resolution_expired"
  | "content_unavailable"
  | "storage_unavailable"
  | "registry_unavailable";

const RETRYABLE_ERROR_CODES = new Set<SkillRegistryErrorCodeV1>([
  "storage_unavailable",
  "registry_unavailable",
]);

export class SkillRegistryApplicationErrorV1 extends Error {
  public readonly retryable: boolean;
  public readonly details: Readonly<Record<string, unknown>>;

  public constructor(
    public readonly code: SkillRegistryErrorCodeV1,
    message: string,
    details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = "SkillRegistryApplicationErrorV1";
    this.retryable = RETRYABLE_ERROR_CODES.has(code);
    let safeDetails: Readonly<Record<string, unknown>> =
      Object.freeze({});
    try {
      const candidate =
        canonicalSnapshotV1<Readonly<Record<string, unknown>>>(
          details,
        );
      if (
        typeof candidate === "object" &&
        candidate !== null &&
        !Array.isArray(candidate)
      ) {
        safeDetails = candidate;
      }
    } catch {
      // Error details are never allowed to turn an owner failure into a
      // caller-controlled exception or leak an unsafe boundary value.
    }
    if (code === "invalid_cursor") {
      const reason =
        safeDetails.reason === "context_changed" ||
        safeDetails.reason === "expired"
          ? safeDetails.reason
          : "malformed";
      this.details = Object.freeze({
        reason,
        restart_from_first_page: true,
      });
    } else {
      this.details = safeDetails;
    }
  }
}

export interface SkillCatalogScopeV1 {
  readonly workspace_id: string;
  readonly bot_id: string;
  readonly deployment_environment: DeploymentEnvironmentV1;
  readonly release_channel: ReleaseChannelV1;
}

export interface SkillRuntimeScopeV1 extends SkillCatalogScopeV1 {
  readonly owner_agent_id: string;
}

export type SkillRegistryPrincipalV1 =
  | {
      readonly caller: "skill_registry";
      readonly scope: { readonly scope_kind: "global" };
      readonly capabilities: readonly string[];
      readonly principal_id: string;
    }
  | {
      readonly caller:
        | "action_runtime"
        | "meta_cognition"
        | "skill_registry"
        | "trigger_processor";
      readonly scope: {
        readonly scope_kind: "bot";
      } & SkillRuntimeScopeV1;
      readonly capabilities: readonly string[];
      readonly principal_id: string;
    };

export type SkillPackageManifestV1 = ContractSkillPackageManifestV1;

export interface SkillValidationRecordV1 {
  readonly validation_id: string;
  /** Owner-row CAS version; distinct from ObjectStore owner_state_version. */
  readonly staging_state_version: number;
  readonly skill_id: string;
  readonly skill_name: string;
  readonly proposed_version: string;
  readonly artifact_ref: ObjectRefV1;
  readonly object_access_decision_ref: string;
  readonly owner_object_id: string;
  readonly owner_state_version: number;
  readonly package_digest: string;
  readonly manifest_digest: string;
  readonly manifest: SkillPackageManifestV1;
  readonly runtime_target: typeof SKILL_RUNTIME_TARGET_V1;
  readonly status: "approved" | "draft" | "validating" | "review_pending" | "rejected";
  readonly expires_at: string;
  readonly media_type: string;
  readonly size_bytes: number;
  readonly provenance: Readonly<Record<string, unknown>>;
  readonly validation_result: Readonly<Record<string, unknown>>;
  readonly scanner_versions: Readonly<Record<string, unknown>>;
  readonly created_by: string;
}

export type SkillPublishRequestV1 = ContractSkillPublishRequestV1;

export interface SkillPublishResultV1 {
  readonly skill_version_id: string;
  readonly skill_name: string;
  readonly version: string;
  readonly state: "published";
  readonly package_digest: string;
  readonly manifest_digest: string;
  readonly runtime_target: typeof SKILL_RUNTIME_TARGET_V1;
  readonly created_at: string;
  readonly duplicate_replayed: boolean;
}

export type SkillActivateRequestV1 = ContractSkillActivateCommandV1;

export interface SkillActivateResultV1 extends SkillCatalogScopeV1 {
  readonly scope_kind: "scoped";
  readonly operation: "activate";
  readonly command_id: string;
  readonly previous_revision: string;
  readonly new_revision: string;
  readonly catalog_version: string;
  readonly security_revocation_epoch: number;
  readonly duplicate_replayed: boolean;
}

export type SkillCatalogQueryRequestV1 =
  ContractSkillCatalogQueryRequestV1;
export type SkillCatalogQueryResultV1 = SkillCatalogQueryDetailsV1;
export type SkillValidateRequestV1 = ContractSkillValidateRequestV1;
export type SkillManagementRequestV1 =
  SkillManagementCommandRequestV1;
export type SkillManagementResultV1 =
  SkillManagementCommandResponseV1;
export type SkillRollbackRequestV1 =
  ContractSkillRollbackCommandV1;
export type SkillDisableRequestV1 =
  ContractSkillDisableCommandV1;
export type SkillPermissionGrantRequestV1 =
  ContractSkillPermissionGrantCommandV1;
export type SkillPermissionRevokeRequestV1 =
  ContractSkillPermissionRevokeCommandV1;
export type SkillDeprecateRequestV1 =
  ContractSkillDeprecateCommandV1;
export type SkillRevokeRequestV1 = ContractSkillRevokeCommandV1;

export type SkillResolveRequestV1 = ContractSkillResolveRequestV1;
export type ResolvedSkillV1 = ContractResolvedSkillV1;

export interface SkillDegradationV1 {
  readonly skill_key: string;
  readonly reason:
    | "not_found"
    | "activation_disabled"
    | "permission_denied"
    | "version_revoked";
}

export type SkillResolveResultV1 = ContractSkillResolveDetailsV1;

export type SkillContentRequestV1 = ContractSkillContentRequestV1;

export interface SkillContentResultV1 {
  readonly content_ref: string;
  readonly content_type: string;
  readonly size_bytes: number;
  readonly package_digest: string;
  readonly manifest_digest: string;
  readonly entrypoint: "SKILL.md";
  readonly expires_at: string;
  readonly runtime_target: typeof SKILL_RUNTIME_TARGET_V1;
}

export type RuntimePolicyInputArtifactV1 =
  RuntimePolicyInputReadArtifactV1;

export interface RuntimePolicyInputReaderPortV1 {
  readonly durability: "durable" | "memory";
  checkReadiness(): Promise<void>;
  /**
   * The owner read is scoped to the exact resolve request. A policy reference
   * is opaque and cannot safely be dereferenced by a production HTTP port
   * without the signed bot scope that owns it.
   */
  readPolicyInput(
    request: Pick<
      SkillResolveRequestV1,
      | "policy_input_ref"
      | "runtime_run_id"
      | "start_attempt_no"
      | "workspace_id"
      | "bot_id"
      | "owner_agent_id"
      | "deployment_environment"
      | "release_channel"
      | "trace_id"
    >,
  ): Promise<RuntimePolicyInputArtifactV1>;
}

export interface SkillPackageInspectorPortV1 {
  /**
   * Production implementations must inspect in an isolated, resource-bounded
   * environment, reject links/special files/nested archives/escapes, and
   * promptly settle when the shared validation AbortSignal is aborted.
   */
  readonly execution_kind: "isolated" | "in_process";
  readonly cancellation_kind: "abort_signal";
  checkReadiness(): Promise<void>;
  inspectPackage(
    bytes: Uint8Array,
    signal: AbortSignal,
  ): Promise<SkillPackageInspectionV1>;
}

export interface SkillPackageInspectionV1 {
  readonly package_root_name: string;
  readonly frontmatter: Readonly<{
    readonly name: string;
    readonly description: string;
  }>;
  readonly manifest: SkillPackageManifestV1;
}

export interface SkillValidationArtifactReadV1 {
  readonly artifact_ref: ObjectRefV1;
  readonly object_access_decision_ref: string;
  readonly owner_object_id: string;
  readonly owner_state_version: number;
  readonly skill_id: string;
  readonly skill_name: string;
  readonly proposed_version: string;
  readonly media_type: string;
  readonly body: AsyncIterable<Uint8Array>;
  readonly provenance: Readonly<Record<string, unknown>>;
  readonly validation_result: Readonly<Record<string, unknown>>;
  readonly scanner_versions: Readonly<Record<string, unknown>>;
  readonly diagnostics: readonly SkillValidationDiagnosticV1[];
}

/**
 * Allowlisted staging-reader boundary. Production implementations must read a
 * durable owner record and the exact immutable artifact referenced by it.
 * Both readArtifact and the returned body must promptly settle/close after
 * the supplied AbortSignal is aborted; ignoring cancellation is a port
 * conformance failure because it would detach work from the request deadline.
 */
export interface SkillValidationArtifactReaderPortV1 {
  readonly durability: "durable" | "memory";
  readonly cancellation_kind: "abort_signal";
  checkReadiness(): Promise<void>;
  readArtifact(
    request: SkillValidateRequestV1,
    signal: AbortSignal,
  ): Promise<SkillValidationArtifactReadV1>;
}

export type SkillObjectAccessOperationV1 = "get" | "head" | "grant";

export interface SkillObjectAccessDecisionRequestV1 {
  readonly operation: SkillObjectAccessOperationV1;
  readonly owner_service: "skill_registry";
  readonly owner_object_id: string;
  readonly owner_state_version: number;
  readonly scope: Readonly<{ readonly scope_kind: "global" }>;
  readonly capability: "skill.content.read";
  readonly object_ref: ObjectRefV1;
  /**
   * Historical decision evidence attached to the durable staging/package row.
   * The resolver may use it as an audit source, but must issue a fresh
   * operation-bound decision rather than replaying it across get/head/grant.
   */
  readonly prior_access_decision_ref: string;
  readonly purpose: "publish_integrity_check" | "runtime_content_read";
  readonly trace_id: string;
}

export interface SkillObjectAccessDecisionV1 {
  readonly access_decision_ref: string;
  readonly retention_policy_version: string;
  readonly redaction_policy_version: string;
}

export interface SkillObjectAccessDecisionResolverPortV1 {
  readonly durability: "durable" | "memory";
  checkReadiness(): Promise<void>;
  resolve(
    request: SkillObjectAccessDecisionRequestV1,
  ): Promise<SkillObjectAccessDecisionV1>;
}

export type SkillPermissionSummaryEntryV1 =
  ContractSkillPermissionSummaryEntryV1;
export type SkillPermissionSummaryV1 = ContractSkillPermissionSummaryV1;

export interface SkillVersionSnapshotV1 {
  readonly skill_id: string;
  readonly skill_key: string;
  readonly skill_name: string;
  readonly version_id: string;
  readonly version: string;
  readonly lifecycle_state: "published" | "deprecated" | "revoked";
  readonly lifecycle_version: number;
  readonly package_digest: string;
  readonly manifest_digest: string;
  readonly runtime_target: typeof SKILL_RUNTIME_TARGET_V1;
  readonly package_ref: ObjectRefV1;
  readonly object_access_decision_ref: string;
  /**
   * Immutable ObjectStore owner binding inherited from the staging upload.
   * Publishing a Registry version does not transfer physical object ownership.
   */
  readonly owner_object_id: string;
  readonly owner_state_version: number;
  readonly media_type: string;
  readonly size_bytes: number;
  readonly retention_state: "retained" | "deletion_pending" | "deleted" | "delete_failed";
}

interface VerifiedPublishArtifactV1 {
  readonly package_digest: string;
  readonly manifest_digest: string;
  readonly size_bytes: number;
}

interface PublishCommitV1 {
  readonly request: SkillPublishRequestV1;
  readonly request_hash: string;
  readonly validation: SkillValidationRecordV1;
  readonly verified: VerifiedPublishArtifactV1;
  readonly actor_principal_id: string;
  readonly now: string;
}

interface ResolutionCommitV1 {
  readonly request: SkillResolveRequestV1;
  readonly request_hash: string;
  readonly policy: RuntimePolicyInputArtifactV1;
  readonly summary: SkillPermissionSummaryV1;
  readonly now: string;
}

interface CandidateApplicationCommitV1 {
  readonly request: SkillCandidateApplicationRequestV1;
  readonly request_hash: string;
  readonly actor_principal_id: string;
  readonly now: string;
}

interface ValidationCommitV1 {
  readonly request: SkillValidateRequestV1;
  readonly request_hash: string;
  readonly artifact: Omit<SkillValidationArtifactReadV1, "body">;
  readonly package_digest: string;
  readonly manifest_digest: string;
  readonly manifest: SkillPackageManifestV1;
  readonly size_bytes: number;
  readonly expires_at: string;
  readonly actor_principal_id: string;
  readonly now: string;
}

interface ValidationFailureCommitV1 {
  readonly request: SkillValidateRequestV1;
  readonly request_hash: string;
  readonly error: Readonly<{
    code: Extract<
      SkillRegistryErrorCodeV1,
      | "content_integrity_mismatch"
      | "invalid_skill_package"
      | "package_scan_failed"
    >;
    message: string;
    details: Readonly<Record<string, unknown>>;
  }>;
  readonly expires_at: string;
  readonly actor_principal_id: string;
  readonly now: string;
}

interface CatalogQueryCommitV1 {
  readonly request: SkillCatalogQueryRequestV1;
  readonly principal_id: string;
  readonly authorization_context_hash: string;
  readonly now: string;
  readonly page_size: number;
  readonly cursor_ttl_seconds: number;
}

interface ContextCatalogReadCommitV1 {
  readonly request: SkillContextCatalogRequestV1;
  readonly now: string;
}

interface ManagementCommitV1 {
  readonly request: SkillManagementRequestV1;
  readonly skill_key: string;
  readonly request_hash: string;
  readonly actor_principal_id: string;
  readonly now: string;
}

export interface SkillContentAuthorizationV1 {
  readonly version: SkillVersionSnapshotV1;
  readonly resolution: ResolvedSkillV1;
  readonly valid_until: string;
}

export interface SkillRegistryApplicationRepositoryPortV1 {
  readonly persistence_kind: "postgresql" | "memory";
  checkReadiness(): Promise<void>;
  replayValidation(
    request: SkillValidateRequestV1,
    requestHash: string,
    actorPrincipalId: string,
    now: string,
  ): Promise<SkillValidateDetailsV1 | undefined>;
  commitValidation(commit: ValidationCommitV1): Promise<SkillValidateDetailsV1>;
  recordValidationFailure(
    commit: ValidationFailureCommitV1,
  ): Promise<SkillValidateDetailsV1 | undefined>;
  replayPublish(
    request: SkillPublishRequestV1,
    requestHash: string,
  ): Promise<SkillPublishResultV1 | undefined>;
  readValidation(validationId: string): Promise<SkillValidationRecordV1 | undefined>;
  publishVersion(commit: PublishCommitV1): Promise<SkillPublishResultV1>;
  executeManagement(
    commit: ManagementCommitV1,
  ): Promise<SkillManagementResultV1>;
  queryCatalog(
    commit: CatalogQueryCommitV1,
  ): Promise<SkillCatalogQueryResultV1>;
  readContextCatalog(
    commit: ContextCatalogReadCommitV1,
  ): Promise<SkillContextCatalogDetailsV1>;
  readPermissionSummary(reference: string): Promise<SkillPermissionSummaryV1 | undefined>;
  replayResolutionAttempt(
    request: SkillResolveRequestV1,
    requestHash: string,
  ): Promise<SkillResolveResultV1 | undefined>;
  recordResolutionFailure(
    request: SkillResolveRequestV1,
    requestHash: string,
    error: SkillRegistryApplicationErrorV1,
  ): Promise<SkillResolveResultV1>;
  resolveAttempt(commit: ResolutionCommitV1): Promise<SkillResolveResultV1>;
  authorizeContent(
    request: SkillContentRequestV1,
    now: string,
  ): Promise<SkillContentAuthorizationV1>;
  recordContentAudit(
    request: SkillContentRequestV1,
    decision: "allow" | "deny",
    reasonCode: string,
  ): Promise<void>;
  applyCandidateApplication(
    commit: CandidateApplicationCommitV1,
  ): Promise<SkillCandidateApplicationDetailsV1>;
}

export interface SkillRegistryApplicationDependenciesV1 {
  readonly repository: SkillRegistryApplicationRepositoryPortV1;
  readonly object_store: ObjectStorePortV1;
  readonly object_store_metadata_kind: "postgresql" | "memory";
  readonly object_store_readiness?: () => Promise<void>;
  readonly object_access_decisions?:
    SkillObjectAccessDecisionResolverPortV1;
  readonly package_inspector: SkillPackageInspectorPortV1;
  readonly validation_artifact_reader?: SkillValidationArtifactReaderPortV1;
  readonly policy_input_reader: RuntimePolicyInputReaderPortV1;
  readonly deployment_mode?: "test" | "development" | "production";
  readonly now?: () => Date;
  readonly signed_content_ttl_seconds?: number;
  readonly config?: unknown;
}

function fail(
  code: SkillRegistryErrorCodeV1,
  message: string,
  details: Readonly<Record<string, unknown>> = {},
): never {
  throw new SkillRegistryApplicationErrorV1(code, message, details);
}

function safePortDetailStringV1(
  value: unknown,
  maximumLength = 512,
): string | undefined {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximumLength &&
    !/[\u0000-\u001f\u007f]/u.test(value)
    ? value
    : undefined;
}

function sanitizedPortErrorDetailsV1(
  error: SkillRegistryApplicationErrorV1,
): Readonly<Record<string, unknown>> {
  const details = error.details;
  if (error.code === "invalid_cursor") {
    return Object.freeze({
      reason:
        details.reason === "context_changed" ||
        details.reason === "expired"
          ? details.reason
          : "malformed",
    });
  }
  if (error.code === "invalid_request") {
    const fieldPath = safePortDetailStringV1(
      details.field_path,
      1_024,
    );
    return fieldPath === undefined
      ? Object.freeze({})
      : Object.freeze({ field_path: fieldPath });
  }
  if (error.code === "invalid_runtime_policy") {
    const reasonCode = safePortDetailStringV1(details.reason_code);
    return reasonCode !== undefined &&
      SKILL_INVALID_RUNTIME_POLICY_REASONS_V1.some(
        (candidate) => candidate === reasonCode,
      )
      ? Object.freeze({ reason_code: reasonCode })
      : Object.freeze({});
  }
  if (error.code === "catalog_version_conflict") {
    const requestedCatalogVersion =
      details.requested_catalog_version === null
        ? null
        : safePortDetailStringV1(
            details.requested_catalog_version,
          );
    const currentCatalogVersion =
      details.current_catalog_version === null
        ? null
        : safePortDetailStringV1(
            details.current_catalog_version,
          );
    const conflictReason = safePortDetailStringV1(
      details.conflict_reason,
    );
    const requestedAsOf =
      details.requested_as_of === null
        ? null
        : safePortDetailStringV1(details.requested_as_of);
    const recoveryAction = safePortDetailStringV1(
      details.recovery_action,
    );
    return Object.freeze({
      ...(requestedCatalogVersion === undefined
        ? {}
        : {
            requested_catalog_version:
              requestedCatalogVersion,
          }),
      ...(currentCatalogVersion === undefined
        ? {}
        : { current_catalog_version: currentCatalogVersion }),
      ...(conflictReason === undefined
        ? {}
        : { conflict_reason: conflictReason }),
      ...(requestedAsOf === undefined
        ? {}
        : { requested_as_of: requestedAsOf }),
      ...(recoveryAction === undefined
        ? {}
        : { recovery_action: recoveryAction }),
    });
  }
  if (
    error.code === "permission_denied" ||
    error.code === "version_revoked"
  ) {
    const reasonCode = safePortDetailStringV1(details.reason_code);
    const skillKey = safePortDetailStringV1(details.skill_key);
    return Object.freeze({
      ...(reasonCode === undefined ? {} : { reason_code: reasonCode }),
      ...(skillKey === undefined ? {} : { skill_key: skillKey }),
    });
  }
  if (error.code === "required_skill_unavailable") {
    const skillKey = safePortDetailStringV1(details.skill_key);
    const reason =
      details.reason === "not_found" ||
      details.reason === "activation_disabled" ||
      details.reason === "permission_denied" ||
      details.reason === "version_revoked"
        ? details.reason
        : undefined;
    return skillKey === undefined || reason === undefined
      ? Object.freeze({})
      : Object.freeze({
          skill_key: skillKey,
          reason,
          failed_items: Object.freeze([
            Object.freeze({ skill_key: skillKey, reason }),
          ]),
        });
  }
  if (error.code === "package_scan_failed") {
    const diagnostics = (
      Array.isArray(details.diagnostics)
        ? details.diagnostics
        : []
    )
      .map((diagnostic) =>
        canonicalSchemaSnapshotV1<SkillValidationDiagnosticV1>(
          SkillValidationDiagnosticV1Schema,
          diagnostic,
        ),
      )
      .filter(
        (diagnostic): diagnostic is SkillValidationDiagnosticV1 =>
          diagnostic !== undefined,
      )
      .slice(0, SKILL_VALIDATION_DIAGNOSTIC_MAX_ITEMS_V1);
    return diagnostics.length === 0
      ? Object.freeze({})
      : Object.freeze({
          diagnostics: sanitizedDiagnosticsV1(diagnostics),
        });
  }
  return Object.freeze({});
}

function sanitizedPortApplicationErrorV1(
  error: SkillRegistryApplicationErrorV1,
): SkillRegistryApplicationErrorV1 {
  const message = (() => {
    switch (error.code) {
      case "invalid_request":
        return "owner rejected the request";
      case "invalid_cursor":
        return "catalog cursor is invalid";
      case "invalid_skill_package":
        return "skill package is invalid";
      case "package_scan_failed":
        return "package scanner rejected the artifact";
      case "authorization_scope_mismatch":
        return "authenticated scope does not authorize the operation";
      case "invalid_runtime_policy":
        return "runtime policy input is invalid";
      case "catalog_version_conflict":
        return "catalog version conflict";
      case "permission_denied":
        return "skill permission was denied";
      case "version_revoked":
        return "skill version was revoked";
      case "required_skill_unavailable":
        return "required skill is unavailable";
      case "idempotency_conflict":
        return "idempotency identity conflict";
      case "validation_not_found":
        return "validation was not found";
      case "validation_expired":
        return "validation has expired";
      case "validation_already_published":
        return "validation was already published";
      case "content_integrity_mismatch":
        return "content integrity check failed";
      case "version_not_publishable":
        return "skill version is not publishable";
      case "activation_conflict":
        return "activation revision conflict";
      case "permission_conflict":
        return "permission revision conflict";
      case "lifecycle_conflict":
        return "lifecycle revision conflict";
      case "invalid_state_transition":
        return "skill lifecycle transition is invalid";
      case "resolution_not_found":
        return "skill resolution was not found";
      case "resolution_expired":
        return "skill resolution has expired";
      case "content_unavailable":
        return "skill content is unavailable";
      case "storage_unavailable":
        return "object storage is unavailable";
      case "registry_unavailable":
        return "Skill Registry dependency is unavailable";
    }
  })();
  if (message === undefined) {
    return new SkillRegistryApplicationErrorV1(
      "registry_unavailable",
      "Skill Registry dependency is unavailable",
    );
  }
  return new SkillRegistryApplicationErrorV1(
    error.code,
    message,
    sanitizedPortErrorDetailsV1(error),
  );
}

function canonicalValueCheckV1(schema: TSchema, value: unknown): boolean {
  try {
    canonicalJsonV1(value);
  } catch {
    return false;
  }
  return Value.Check(schema, value);
}

/**
 * Every typed port result is still an untrusted runtime value. Reparse the
 * Shared-canonical representation and freeze the resulting plain JSON tree so
 * downstream validation and semantic checks never inspect a caller-owned
 * Proxy, accessor, alias, or subsequently mutable object.
 */
function canonicalSnapshotV1<T>(value: unknown): T {
  const snapshot = JSON.parse(canonicalJsonV1(value)) as T;
  const pending: object[] = [];
  if (typeof snapshot === "object" && snapshot !== null) {
    pending.push(snapshot);
  }
  while (pending.length > 0) {
    const current = pending.pop()!;
    for (const entry of Object.values(current)) {
      if (
        typeof entry === "object" &&
        entry !== null &&
        !Object.isFrozen(entry)
      ) {
        pending.push(entry);
      }
    }
    Object.freeze(current);
  }
  return snapshot;
}

function canonicalSchemaSnapshotV1<T>(
  schema: TSchema,
  value: unknown,
): T | undefined {
  try {
    const snapshot = canonicalSnapshotV1<T>(value);
    return Value.Check(schema, snapshot) ? snapshot : undefined;
  } catch {
    return undefined;
  }
}

function canonicalPrincipalSnapshotV1(
  value: SkillRegistryPrincipalV1,
): SkillRegistryPrincipalV1 {
  let snapshot: unknown;
  try {
    snapshot = canonicalSnapshotV1<unknown>(value);
  } catch {
    fail(
      "authorization_scope_mismatch",
      "authenticated principal is outside the owner contract",
    );
  }
  if (
    typeof snapshot !== "object" ||
    snapshot === null ||
    Array.isArray(snapshot)
  ) {
    fail(
      "authorization_scope_mismatch",
      "authenticated principal is outside the owner contract",
    );
  }
  const candidate = snapshot as Record<string, unknown>;
  const scope = candidate.scope;
  if (
    typeof candidate.caller !== "string" ||
    typeof candidate.principal_id !== "string" ||
    !Array.isArray(candidate.capabilities) ||
    candidate.capabilities.some((entry) => typeof entry !== "string") ||
    typeof scope !== "object" ||
    scope === null ||
    Array.isArray(scope) ||
    typeof (scope as Record<string, unknown>).scope_kind !== "string"
  ) {
    fail(
      "authorization_scope_mismatch",
      "authenticated principal is outside the owner contract",
    );
  }
  return snapshot as SkillRegistryPrincipalV1;
}

function canonicalRequestSnapshotV1<T>(
  schema: TSchema,
  value: unknown,
  message: string,
): T {
  const snapshot = canonicalSchemaSnapshotV1<T>(schema, value);
  if (snapshot === undefined) {
    fail("invalid_request", message);
  }
  return snapshot;
}

function canonicalAuthorizationInputSnapshotV1<T>(
  value: unknown,
): T {
  let snapshot: unknown;
  try {
    snapshot = canonicalSnapshotV1<unknown>(value);
  } catch {
    // Bot-scoped methods deliberately authenticate the complete scope before
    // exposing any more specific request-validation result.
    fail(
      "authorization_scope_mismatch",
      "request scope is not bound to the authenticated workload",
    );
  }
  if (
    typeof snapshot !== "object" ||
    snapshot === null ||
    Array.isArray(snapshot)
  ) {
    fail(
      "authorization_scope_mismatch",
      "request scope is not bound to the authenticated workload",
    );
  }
  return snapshot as T;
}

function ownerSchemaSnapshotV1<T>(
  schema: TSchema,
  value: unknown,
  message: string,
): T {
  const snapshot = canonicalSchemaSnapshotV1<T>(schema, value);
  if (snapshot === undefined) {
    throw new Error(message);
  }
  return snapshot;
}

function plainDataPropertiesV1(
  value: unknown,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[] = [],
): Readonly<Record<string, unknown>> {
  if (
    typeof value !== "object" ||
    value === null ||
    nodeUtilTypes.isProxy(value) ||
    Array.isArray(value)
  ) {
    throw new Error("boundary result must be a non-proxy plain object");
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error("boundary result must have a plain prototype");
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.getOwnPropertySymbols(value).length !== 0) {
    throw new Error("boundary result must not contain symbol properties");
  }
  const allowed = new Set([...requiredKeys, ...optionalKeys]);
  const keys = Object.keys(descriptors);
  if (
    requiredKeys.some((key) => !Object.hasOwn(descriptors, key)) ||
    keys.some((key) => !allowed.has(key))
  ) {
    throw new Error("boundary result fields do not match the owner contract");
  }
  const result: Record<string, unknown> = Object.create(null);
  for (const key of keys) {
    const descriptor = descriptors[key]!;
    if (
      !Object.hasOwn(descriptor, "value") ||
      descriptor.enumerable !== true
    ) {
      throw new Error(
        "boundary result must contain only enumerable data properties",
      );
    }
    result[key] = descriptor.value;
  }
  return Object.freeze(result);
}

const OBJECT_ACCESS_TOKEN_PATTERN_V1 =
  /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u;

function objectAccessDecisionSnapshotV1(
  value: unknown,
): SkillObjectAccessDecisionV1 {
  let fields: Readonly<Record<string, unknown>>;
  try {
    fields = plainDataPropertiesV1(value, [
      "access_decision_ref",
      "retention_policy_version",
      "redaction_policy_version",
    ]);
  } catch {
    fail(
      "storage_unavailable",
      "object access owner returned an unsafe decision boundary",
    );
  }
  const accessDecisionRef = fields["access_decision_ref"];
  const retentionPolicyVersion =
    fields["retention_policy_version"];
  const redactionPolicyVersion =
    fields["redaction_policy_version"];
  if (
    typeof accessDecisionRef !== "string" ||
    typeof retentionPolicyVersion !== "string" ||
    typeof redactionPolicyVersion !== "string" ||
    !OBJECT_ACCESS_TOKEN_PATTERN_V1.test(accessDecisionRef) ||
    !OBJECT_ACCESS_TOKEN_PATTERN_V1.test(
      retentionPolicyVersion,
    ) ||
    !OBJECT_ACCESS_TOKEN_PATTERN_V1.test(
      redactionPolicyVersion,
    )
  ) {
    fail(
      "storage_unavailable",
      "object access owner returned an invalid decision",
    );
  }
  return Object.freeze({
    access_decision_ref: accessDecisionRef,
    retention_policy_version: retentionPolicyVersion,
    redaction_policy_version: redactionPolicyVersion,
  });
}

function dataMethodV1(
  value: object,
  key: PropertyKey,
): ((...args: readonly unknown[]) => unknown) | undefined {
  let current: object | null = value;
  while (current !== null) {
    if (nodeUtilTypes.isProxy(current)) {
      throw new Error("stream boundary must not contain a Proxy");
    }
    const descriptor = Object.getOwnPropertyDescriptor(current, key);
    if (descriptor !== undefined) {
      if (
        !Object.hasOwn(descriptor, "value") ||
        typeof descriptor.value !== "function"
      ) {
        throw new Error("stream boundary method must be a data property");
      }
      return descriptor.value as (...args: readonly unknown[]) => unknown;
    }
    current = Object.getPrototypeOf(current) as object | null;
  }
  return undefined;
}

function iteratorResultV1(
  value: unknown,
): Readonly<{ done: boolean; value?: unknown }> {
  const fields = plainDataPropertiesV1(value, ["done"], ["value"]);
  if (typeof fields["done"] !== "boolean") {
    throw new Error("stream iterator returned an invalid completion flag");
  }
  return Object.freeze({
    done: fields["done"],
    ...(Object.hasOwn(fields, "value")
      ? { value: fields["value"] }
      : {}),
  });
}

const nativePromiseThenV1 = Promise.prototype.then;

function settleNativePromiseV1(
  value: unknown,
): Promise<Readonly<{ value: unknown }>> {
  if (
    typeof value !== "object" ||
    value === null ||
    nodeUtilTypes.isProxy(value) ||
    !nodeUtilTypes.isPromise(value)
  ) {
    throw new Error("stream iterator must return a native Promise");
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (
    Object.values(descriptors).some(
      (descriptor) => !Object.hasOwn(descriptor, "value"),
    )
  ) {
    throw new Error(
      "stream iterator Promise must not contain accessors",
    );
  }
  return new Promise<Readonly<{ value: unknown }>>(
    (resolve, reject) => {
      nativePromiseThenV1.call(
        value,
        (settled) => {
          resolve(Object.freeze({ value: settled }));
        },
        reject,
      );
    },
  );
}

/**
 * Capture an untrusted AsyncIterable without ever reading a caller-owned
 * property. The returned iterable owns all property lookup and clones every
 * byte chunk before it reaches hashing or package inspection.
 */
function trustedByteStreamV1(value: unknown): AsyncIterable<Uint8Array> {
  if (
    typeof value !== "object" ||
    value === null ||
    nodeUtilTypes.isProxy(value)
  ) {
    throw new Error("byte stream must be a non-proxy object");
  }
  const asyncIterator = dataMethodV1(value, Symbol.asyncIterator);
  if (asyncIterator === undefined) {
    throw new Error("byte stream must implement AsyncIterable");
  }
  return Object.freeze({
    async *[Symbol.asyncIterator](): AsyncGenerator<Uint8Array> {
      const iteratorValue = asyncIterator.call(value);
      if (
        typeof iteratorValue !== "object" ||
        iteratorValue === null ||
        nodeUtilTypes.isProxy(iteratorValue)
      ) {
        throw new Error("byte stream returned an invalid iterator");
      }
      const next = dataMethodV1(iteratorValue, "next");
      if (next === undefined) {
        throw new Error("byte stream iterator does not implement next");
      }
      const close = dataMethodV1(iteratorValue, "return");
      let completed = false;
      try {
        while (!completed) {
          const pendingResult = next.call(iteratorValue);
          const settled = await settleNativePromiseV1(
            pendingResult,
          );
          const step = iteratorResultV1(settled.value);
          completed = step.done;
          if (!completed) {
            if (!nodeUtilTypes.isUint8Array(step.value)) {
              throw new Error("byte stream yielded a non-byte chunk");
            }
            yield Uint8Array.prototype.slice.call(step.value) as Uint8Array;
          }
        }
      } finally {
        if (!completed && close !== undefined) {
          const pendingClose = close.call(iteratorValue);
          await settleNativePromiseV1(pendingClose);
        }
      }
    },
  });
}

const VALIDATION_ARTIFACT_REQUIRED_KEYS_V1 = Object.freeze([
  "artifact_ref",
  "object_access_decision_ref",
  "owner_object_id",
  "owner_state_version",
  "skill_id",
  "skill_name",
  "proposed_version",
  "media_type",
  "body",
  "provenance",
  "validation_result",
  "scanner_versions",
  "diagnostics",
] as const);

function validationArtifactSnapshotV1(
  value: unknown,
): SkillValidationArtifactReadV1 {
  let fields: Readonly<Record<string, unknown>>;
  try {
    fields = plainDataPropertiesV1(
      value,
      VALIDATION_ARTIFACT_REQUIRED_KEYS_V1,
    );
    const body = trustedByteStreamV1(fields["body"]);
    const metadata = canonicalSnapshotV1<
      Omit<SkillValidationArtifactReadV1, "body">
    >({
      artifact_ref: fields["artifact_ref"],
      object_access_decision_ref:
        fields["object_access_decision_ref"],
      owner_object_id: fields["owner_object_id"],
      owner_state_version: fields["owner_state_version"],
      skill_id: fields["skill_id"],
      skill_name: fields["skill_name"],
      proposed_version: fields["proposed_version"],
      media_type: fields["media_type"],
      provenance: fields["provenance"],
      validation_result: fields["validation_result"],
      scanner_versions: fields["scanner_versions"],
      diagnostics: fields["diagnostics"],
    });
    return Object.freeze({ ...metadata, body });
  } catch {
    fail(
      "registry_unavailable",
      "validation artifact reader returned an unsafe boundary value",
    );
  }
}

function sanitizedDiagnosticsV1(
  diagnostics: readonly SkillValidationDiagnosticV1[],
): readonly SkillValidationDiagnosticV1[] {
  return Object.freeze(
    diagnostics.map((diagnostic) =>
      Object.freeze({
        severity: diagnostic.severity,
        code: diagnostic.code,
        path: diagnostic.path,
        message:
          diagnostic.severity === "error"
            ? "package scanner reported an error"
            : diagnostic.severity === "warning"
              ? "package scanner reported a warning"
              : "package scanner reported an informational diagnostic",
      }),
    ),
  );
}

function objectStreamSnapshotV1(value: unknown): Readonly<{
  object_ref: ObjectRefV1;
  version: string;
  sha256: string;
  size_bytes: number;
  media_type: string;
  retention_until: string;
  content_range?: string;
  body: AsyncIterable<Uint8Array>;
}> {
  try {
    const fields = plainDataPropertiesV1(
      value,
      [
        "object_ref",
        "version",
        "sha256",
        "size_bytes",
        "media_type",
        "retention_until",
        "body",
      ],
      ["content_range"],
    );
    const body = trustedByteStreamV1(fields["body"]);
    const metadata = canonicalSnapshotV1<{
      object_ref: ObjectRefV1;
      version: string;
      sha256: string;
      size_bytes: number;
      media_type: string;
      retention_until: string;
      content_range?: string;
    }>({
      object_ref: fields["object_ref"],
      version: fields["version"],
      sha256: fields["sha256"],
      size_bytes: fields["size_bytes"],
      media_type: fields["media_type"],
      retention_until: fields["retention_until"],
      ...(Object.hasOwn(fields, "content_range")
        ? { content_range: fields["content_range"] }
        : {}),
    });
    return Object.freeze({ ...metadata, body });
  } catch {
    fail(
      "storage_unavailable",
      "object store returned an unsafe stream boundary value",
    );
  }
}

function contentAuthorizationSnapshotV1(
  value: unknown,
): SkillContentAuthorizationV1 {
  let snapshot: SkillContentAuthorizationV1;
  try {
    const fields = plainDataPropertiesV1(value, [
      "version",
      "resolution",
      "valid_until",
    ]);
    snapshot = canonicalSnapshotV1<SkillContentAuthorizationV1>({
      version: fields["version"],
      resolution: fields["resolution"],
      valid_until: fields["valid_until"],
    });
  } catch {
    fail(
      "registry_unavailable",
      "content authorization owner returned an unsafe boundary value",
    );
  }
  if (
    typeof snapshot !== "object" ||
    snapshot === null ||
    Array.isArray(snapshot) ||
    typeof snapshot.valid_until !== "string" ||
    !Number.isFinite(Date.parse(snapshot.valid_until)) ||
    typeof snapshot.version !== "object" ||
    snapshot.version === null ||
    Array.isArray(snapshot.version) ||
    typeof snapshot.resolution !== "object" ||
    snapshot.resolution === null ||
    Array.isArray(snapshot.resolution)
  ) {
    fail(
      "registry_unavailable",
      "content authorization owner returned an invalid boundary value",
    );
  }
  const version = snapshot.version;
  const resolution = snapshot.resolution;
  if (
    [
      version.skill_id,
      version.skill_key,
      version.skill_name,
      version.version_id,
      version.version,
      version.package_digest,
      version.manifest_digest,
      version.package_ref,
      version.object_access_decision_ref,
      version.owner_object_id,
      version.media_type,
      resolution.resolution_id,
      resolution.skill_key,
      resolution.skill_id,
      resolution.version_id,
      resolution.version,
      resolution.package_digest,
      resolution.manifest_digest,
    ].some(
      (entry) => typeof entry !== "string" || entry.length === 0,
    ) ||
    !isSha256(version.package_digest) ||
    !isSha256(version.manifest_digest) ||
    !isSha256(resolution.package_digest) ||
    !isSha256(resolution.manifest_digest) ||
    !Number.isSafeInteger(version.size_bytes) ||
    version.size_bytes < 0 ||
    !Number.isSafeInteger(version.owner_state_version) ||
    version.owner_state_version < 1 ||
    version.runtime_target !== SKILL_RUNTIME_TARGET_V1 ||
    resolution.runtime_target !== SKILL_RUNTIME_TARGET_V1
  ) {
    fail(
      "registry_unavailable",
      "content authorization owner returned an invalid boundary value",
    );
  }
  const versionSnapshot: SkillVersionSnapshotV1 = Object.freeze({
    skill_id: version.skill_id,
    skill_key: version.skill_key,
    skill_name: version.skill_name,
    version_id: version.version_id,
    version: version.version,
    lifecycle_state: version.lifecycle_state,
    lifecycle_version: version.lifecycle_version,
    package_digest: version.package_digest,
    manifest_digest: version.manifest_digest,
    runtime_target: version.runtime_target,
    package_ref: version.package_ref,
    object_access_decision_ref:
      version.object_access_decision_ref,
    owner_object_id: version.owner_object_id,
    owner_state_version: version.owner_state_version,
    media_type: version.media_type,
    size_bytes: version.size_bytes,
    retention_state: version.retention_state,
  });
  const resolutionSnapshot =
    canonicalSchemaSnapshotV1<ResolvedSkillV1>(
      ResolvedSkillV1Schema,
      {
        resolution_id: resolution.resolution_id,
        skill_id: resolution.skill_id,
        skill_key: resolution.skill_key,
        version_id: resolution.version_id,
        version: resolution.version,
        package_digest: resolution.package_digest,
        manifest_digest: resolution.manifest_digest,
        runtime_target: resolution.runtime_target,
        granted_capability_refs:
          resolution.granted_capability_refs,
        required: resolution.required,
        valid_until: resolution.valid_until,
      },
    );
  if (
    resolutionSnapshot === undefined ||
    ![
      "published",
      "deprecated",
      "revoked",
    ].includes(versionSnapshot.lifecycle_state) ||
    !Number.isSafeInteger(versionSnapshot.lifecycle_version) ||
    versionSnapshot.lifecycle_version < 1 ||
    ![
      "retained",
      "deletion_pending",
      "deleted",
      "delete_failed",
    ].includes(versionSnapshot.retention_state)
  ) {
    fail(
      "registry_unavailable",
      "content authorization owner returned an invalid boundary value",
    );
  }
  return Object.freeze({
    version: versionSnapshot,
    resolution: resolutionSnapshot,
    valid_until: snapshot.valid_until,
  });
}

function objectHeadSnapshotV1(value: unknown): Readonly<{
  object_ref: ObjectRefV1;
  version: string;
  sha256: string;
  size_bytes: number;
  media_type: string;
  retention_until: string;
}> {
  let snapshot: {
    object_ref: ObjectRefV1;
    version: string;
    sha256: string;
    size_bytes: number;
    media_type: string;
    retention_until: string;
  };
  try {
    const fields = plainDataPropertiesV1(value, [
      "object_ref",
      "version",
      "sha256",
      "size_bytes",
      "media_type",
      "retention_until",
    ]);
    snapshot = canonicalSnapshotV1({
      object_ref: fields["object_ref"],
      version: fields["version"],
      sha256: fields["sha256"],
      size_bytes: fields["size_bytes"],
      media_type: fields["media_type"],
      retention_until: fields["retention_until"],
    });
  } catch {
    fail(
      "storage_unavailable",
      "object store returned an unsafe metadata boundary value",
    );
  }
  if (
    typeof snapshot !== "object" ||
    snapshot === null ||
    Array.isArray(snapshot) ||
    [
      snapshot.object_ref,
      snapshot.version,
      snapshot.sha256,
      snapshot.media_type,
      snapshot.retention_until,
    ].some(
      (entry) => typeof entry !== "string" || entry.length === 0,
    ) ||
    !isSha256(snapshot.sha256) ||
    !Number.isSafeInteger(snapshot.size_bytes) ||
    snapshot.size_bytes < 0 ||
    !Number.isFinite(Date.parse(snapshot.retention_until))
  ) {
    fail(
      "storage_unavailable",
      "object store returned invalid metadata",
    );
  }
  return snapshot;
}

function objectReadGrantSnapshotV1(value: unknown): Readonly<{
  grant: string;
  object_ref: ObjectRefV1;
  expires_at: string;
}> {
  let snapshot: {
    grant: string;
    object_ref: ObjectRefV1;
    expires_at: string;
  };
  try {
    const fields = plainDataPropertiesV1(value, [
      "grant",
      "object_ref",
      "expires_at",
    ]);
    snapshot = canonicalSnapshotV1({
      grant: fields["grant"],
      object_ref: fields["object_ref"],
      expires_at: fields["expires_at"],
    });
  } catch {
    fail(
      "storage_unavailable",
      "object store returned an unsafe read grant boundary value",
    );
  }
  if (
    typeof snapshot !== "object" ||
    snapshot === null ||
    Array.isArray(snapshot) ||
    typeof snapshot.grant !== "string" ||
    snapshot.grant.length === 0 ||
    snapshot.grant.length > 512 ||
    typeof snapshot.object_ref !== "string" ||
    snapshot.object_ref.length === 0 ||
    typeof snapshot.expires_at !== "string" ||
    !Number.isFinite(Date.parse(snapshot.expires_at))
  ) {
    fail("storage_unavailable", "object store issued an invalid read grant");
  }
  return snapshot;
}

function nextSkillCounterV1(value: number, label: string): number {
  if (
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value >= Number.MAX_SAFE_INTEGER
  ) {
    throw new Error(`${label} is exhausted or corrupt`);
  }
  return value + 1;
}

function assertNonempty(value: string, field: string): void {
  if (value.length === 0) fail("invalid_request", `${field} is required`, { field_path: field });
}

function isSha256(value: string): boolean {
  return /^sha256:[0-9a-f]{64}$/u.test(value);
}

function assertSha256(value: string, field: string): void {
  if (!isSha256(value)) {
    fail("invalid_request", `${field} must be a lowercase SHA-256 digest`, {
      field_path: field,
    });
  }
}

function scopeKey(scope: SkillCatalogScopeV1): string {
  // Never hash a structural supertype directly: command/request fields would
  // otherwise leak into the catalog identity and split one four-tuple scope.
  return canonicalJsonV1({
    workspace_id: scope.workspace_id,
    bot_id: scope.bot_id,
    deployment_environment: scope.deployment_environment,
    release_channel: scope.release_channel,
  });
}

function permissionStorageKey(
  scope: SkillCatalogScopeV1,
  skillId: string,
  ownerAgentId?: string,
): string {
  return `${scopeKey(scope)}\u0000${skillId}\u0000${ownerAgentId ?? "*"}`;
}

function activationStorageKey(
  scope: SkillCatalogScopeV1,
  skillKey: string,
): string {
  return `${scopeKey(scope)}\u0000${skillKey}`;
}

function runtimeScopeMatches(
  left: SkillRuntimeScopeV1,
  right: SkillRuntimeScopeV1,
): boolean {
  return (
    left.workspace_id === right.workspace_id &&
    left.bot_id === right.bot_id &&
    left.owner_agent_id === right.owner_agent_id &&
    left.deployment_environment === right.deployment_environment &&
    left.release_channel === right.release_channel
  );
}

function catalogScopeMatches(
  left: SkillCatalogScopeV1,
  right: SkillCatalogScopeV1,
): boolean {
  return (
    left.workspace_id === right.workspace_id &&
    left.bot_id === right.bot_id &&
    left.deployment_environment === right.deployment_environment &&
    left.release_channel === right.release_channel
  );
}

function hasCapability(
  principal: SkillRegistryPrincipalV1,
  capability: string,
): boolean {
  return principal.capabilities.includes(capability);
}

function assertPrincipalIdentity(
  principal: SkillRegistryPrincipalV1,
): void {
  if (
    principal.principal_id.length < 1 ||
    principal.principal_id.length > 512 ||
    principal.capabilities.some(
      (capability) =>
        capability.length < 1 || capability.length > 256,
    )
  ) {
    fail(
      "authorization_scope_mismatch",
      "authenticated principal identity is outside the owner contract",
    );
  }
}

export function skillPermissionScopeHashV1(
  request: SkillCatalogScopeV1 & {
    readonly skill_id: string;
    readonly owner_agent_id?: string;
  },
): string {
  return canonicalHashV1({
    workspace_id: request.workspace_id,
    bot_id: request.bot_id,
    deployment_environment: request.deployment_environment,
    release_channel: request.release_channel,
    skill_id: request.skill_id,
    owner_agent_id: request.owner_agent_id ?? null,
  });
}

function assertGlobalPrincipal(
  principal: SkillRegistryPrincipalV1,
  capability: string,
): void {
  assertPrincipalIdentity(principal);
  if (
    principal.scope.scope_kind !== "global" ||
    principal.caller !== "skill_registry" ||
    !hasCapability(principal, capability)
  ) {
    fail(
      "authorization_scope_mismatch",
      "operation requires an authenticated global registry principal",
    );
  }
}

function assertBotPrincipal(
  principal: SkillRegistryPrincipalV1,
  request: SkillCatalogScopeV1 & { readonly owner_agent_id?: string },
  capability: string,
  caller?: SkillRegistryPrincipalV1["caller"],
): void {
  assertPrincipalIdentity(principal);
  if (
    principal.scope.scope_kind !== "bot" ||
    (caller !== undefined && principal.caller !== caller) ||
    !catalogScopeMatches(principal.scope, request) ||
    (request.owner_agent_id !== undefined &&
      principal.scope.owner_agent_id !== request.owner_agent_id) ||
    !hasCapability(principal, capability)
  ) {
    fail(
      "authorization_scope_mismatch",
      "request scope is not bound to the authenticated workload",
    );
  }
}

function assertCatalogPrincipal(
  principal: SkillRegistryPrincipalV1,
  request: SkillCatalogScopeV1 & {
    readonly owner_agent_id?: string;
  },
  capability: string,
): void {
  assertPrincipalIdentity(principal);
  if (
    principal.scope.scope_kind !== "bot" ||
    principal.caller !== "skill_registry" ||
    !catalogScopeMatches(principal.scope, request) ||
    (request.owner_agent_id !== undefined &&
      principal.scope.owner_agent_id !== request.owner_agent_id) ||
    !hasCapability(principal, capability)
  ) {
    fail(
      "authorization_scope_mismatch",
      "catalog scope is not bound to the authenticated release principal",
    );
  }
}

function validateManifest(
  value: unknown,
): SkillPackageManifestV1 {
  const manifest =
    canonicalSchemaSnapshotV1<SkillPackageManifestV1>(
      SkillPackageManifestV1Schema,
      value,
    );
  if (manifest === undefined) {
    fail("content_integrity_mismatch", "manifest contract or runtime target drifted");
  }
  if (
    manifest.files.length === 0 ||
    manifest.files.length > SKILL_PACKAGE_MAX_FILES_V1
  ) {
    fail("content_integrity_mismatch", "manifest file count is outside the hard limit");
  }
  let previousPath: string | undefined;
  let entrypointCount = 0;
  let expandedSize = 0;
  for (const file of manifest.files) {
    const normalized = file.path.normalize("NFC");
    if (
      file.path !== normalized ||
      file.path.startsWith("/") ||
      file.path.includes("\\") ||
      /[\u0000-\u001f\u007f]/u.test(file.path) ||
      file.path.split("/").some((segment) => segment === "" || segment === "." || segment === "..") ||
      (previousPath !== undefined && previousPath >= file.path) ||
      !/^(?:0[0-7]{3})$/u.test(file.mode) ||
      !Number.isSafeInteger(file.size_bytes) ||
      file.size_bytes < 0 ||
      !isSha256(file.sha256)
    ) {
      fail("content_integrity_mismatch", "manifest contains an unsafe or non-canonical file");
    }
    expandedSize += file.size_bytes;
    if (
      !Number.isSafeInteger(expandedSize) ||
      expandedSize > SKILL_PACKAGE_MAX_BYTES_V1
    ) {
      fail("content_integrity_mismatch", "expanded package exceeds the hard limit");
    }
    if (file.path === "SKILL.md") {
      entrypointCount += 1;
      if (file.size_bytes > SKILL_ENTRYPOINT_MAX_BYTES_V1) {
        fail("content_integrity_mismatch", "SKILL.md exceeds the hard size limit");
      }
    }
    previousPath = file.path;
  }
  if (entrypointCount !== 1) {
    fail("content_integrity_mismatch", "manifest must contain one top-level SKILL.md");
  }
  return manifest;
}

function validatePackageInspection(
  value: unknown,
  expectedSkillName: string,
): SkillPackageManifestV1 {
  let inspection: SkillPackageInspectionV1;
  try {
    inspection = canonicalSnapshotV1<SkillPackageInspectionV1>(value);
  } catch {
    fail(
      "content_integrity_mismatch",
      "package inspector returned an invalid result",
    );
  }
  if (
    typeof inspection !== "object" ||
    inspection === null ||
    Array.isArray(inspection)
  ) {
    fail(
      "content_integrity_mismatch",
      "package inspector returned an invalid result",
    );
  }
  const description = inspection.frontmatter?.description;
  const frontmatterName = inspection.frontmatter?.name;
  if (
    inspection.package_root_name !== expectedSkillName ||
    frontmatterName !== expectedSkillName ||
    typeof description !== "string" ||
    description.trim().length === 0 ||
    description.length > 1_024 ||
    /<\s*(?:\/\s*)?[A-Za-z_:][^>]*>/u.test(description) ||
    /<!--[\s\S]*?-->/u.test(description)
  ) {
    fail(
      "content_integrity_mismatch",
      "package root and SKILL.md frontmatter do not match the staging reservation",
    );
  }
  return validateManifest(inspection.manifest);
}

function ownerValidationRecordSnapshotV1(
  value: unknown,
): SkillValidationRecordV1 {
  let record: SkillValidationRecordV1;
  try {
    record = canonicalSnapshotV1<SkillValidationRecordV1>(value);
  } catch {
    throw new Error(
      "Skill Registry owner returned an invalid validation record",
    );
  }
  if (
    typeof record !== "object" ||
    record === null ||
    Array.isArray(record)
  ) {
    throw new Error(
      "Skill Registry owner returned an invalid validation record",
    );
  }
  const recordValues = [
    record.validation_id,
    record.skill_id,
    record.skill_name,
    record.proposed_version,
    record.artifact_ref,
    record.object_access_decision_ref,
    record.owner_object_id,
    record.package_digest,
    record.manifest_digest,
    record.expires_at,
    record.media_type,
    record.created_by,
  ];
  if (
    recordValues.some(
      (entry) => typeof entry !== "string" || entry.length === 0,
    ) ||
    !Number.isSafeInteger(record.owner_state_version) ||
    record.owner_state_version < 1 ||
    !Number.isSafeInteger(record.staging_state_version) ||
    record.staging_state_version < 1 ||
    !isSha256(record.package_digest) ||
    !isSha256(record.manifest_digest) ||
    record.runtime_target !== SKILL_RUNTIME_TARGET_V1 ||
    ![
      "approved",
      "draft",
      "validating",
      "review_pending",
      "rejected",
    ].includes(record.status) ||
    !Number.isSafeInteger(record.size_bytes) ||
    record.size_bytes < 0 ||
    record.size_bytes > SKILL_PACKAGE_MAX_BYTES_V1 ||
    !Number.isFinite(Date.parse(record.expires_at)) ||
    typeof record.provenance !== "object" ||
    record.provenance === null ||
    Array.isArray(record.provenance) ||
    typeof record.validation_result !== "object" ||
    record.validation_result === null ||
    Array.isArray(record.validation_result) ||
    typeof record.scanner_versions !== "object" ||
    record.scanner_versions === null ||
    Array.isArray(record.scanner_versions)
  ) {
    throw new Error(
      "Skill Registry owner returned an invalid validation record",
    );
  }
  let manifest: SkillPackageManifestV1;
  try {
    manifest = validateManifest(record.manifest);
  } catch {
    throw new Error(
      "Skill Registry owner returned an invalid validation record",
    );
  }
  return Object.freeze({ ...record, manifest });
}

async function digestStream(
  stream: AsyncIterable<Uint8Array>,
  maximumBytes = SKILL_PACKAGE_MAX_BYTES_V1,
  signal?: AbortSignal,
  boundaryFailureCode: Extract<
    SkillRegistryErrorCodeV1,
    "registry_unavailable" | "storage_unavailable"
  > = "storage_unavailable",
): Promise<{
  readonly bytes: Uint8Array;
  readonly digest: string;
  readonly size_bytes: number;
}> {
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    signal?.throwIfAborted();
    for await (const chunk of stream) {
      signal?.throwIfAborted();
      if (!(chunk instanceof Uint8Array)) {
        fail(boundaryFailureCode, "byte stream returned a non-byte chunk");
      }
      size += chunk.byteLength;
      if (size > maximumBytes) {
        fail("content_integrity_mismatch", "package exceeds the 30 MiB hard limit");
      }
      chunks.push(chunk);
    }
    signal?.throwIfAborted();
    const bytes = Buffer.concat(chunks, size);
    return {
      bytes,
      digest: sha256BytesV1(bytes),
      size_bytes: size,
    };
  } catch (error) {
    if (error instanceof SkillRegistryApplicationErrorV1) {
      throw sanitizedPortApplicationErrorV1(error);
    }
    fail(boundaryFailureCode, "byte stream could not be consumed");
  }
}

function summaryHash(summary: SkillPermissionSummaryV1): string {
  const { summary_hash: _summaryHash, ...hashable } = summary;
  return canonicalHashV1(hashable);
}

function validateCommonResolveRequest(request: SkillResolveRequestV1): void {
  if (
    request.schema_version !== "skill_resolution_request.v1" ||
    !Number.isSafeInteger(request.start_attempt_no) ||
    request.start_attempt_no < 1 ||
    request.skills.length === 0
  ) {
    fail("invalid_request", "resolve request shape is invalid");
  }
  for (const field of [
    request.runtime_run_id,
    request.workspace_id,
    request.bot_id,
    request.owner_agent_id,
    request.expected_catalog_version,
    request.policy_input_ref,
  ]) {
    if (field.length === 0) fail("invalid_request", "resolve identity is incomplete");
  }
  if (!Number.isFinite(Date.parse(request.catalog_as_of))) {
    fail("invalid_request", "catalog_as_of must be a timestamp");
  }
  const expectedIdempotency =
    `${request.runtime_run_id}:skill-resolution:attempt:${request.start_attempt_no}`;
  if (request.idempotency_key !== expectedIdempotency) {
    fail("invalid_request", "resolve idempotency key is not derived from attempt identity");
  }
  assertSha256(request.policy_input_hash, "policy_input_hash");
  const names = new Set<string>();
  for (const item of request.skills) {
    if (
      item.name.length === 0 ||
      item.version_constraint !== "catalog_revision" ||
      names.has(item.name)
    ) {
      fail("invalid_request", "resolve skills must be unique catalog_revision items");
    }
    names.add(item.name);
  }
}

function validatePolicy(
  request: SkillResolveRequestV1,
  policy: RuntimePolicyInputArtifactV1,
  nowMs: number,
): void {
  const invalid = (reason_code: string): never =>
    fail("invalid_runtime_policy", "runtime policy input is invalid", {
      reason_code,
    });
  if (!runtimeScopeMatches(request, policy) || policy.runtime_run_id !== request.runtime_run_id) {
    return invalid("ref_hash_mismatch");
  }
  if (policy.expected_catalog_version !== request.expected_catalog_version ||
      policy.catalog_as_of !== request.catalog_as_of) {
    return invalid("ref_hash_mismatch");
  }
  if (
    policy.policy_input_ref !== request.policy_input_ref ||
    policy.policy_input_hash !== request.policy_input_hash ||
    policy.start_attempt_no !== request.start_attempt_no ||
    policy.intent_policy_snapshot_ref !==
      policy.intent_policy_snapshot.snapshot_ref ||
    policy.intent_policy_snapshot_hash !==
      policy.intent_policy_snapshot.snapshot_hash ||
    policy.policy.intent_policy_snapshot_ref !==
      policy.intent_policy_snapshot.snapshot_ref ||
    policy.policy.intent_policy_snapshot_hash !==
      policy.intent_policy_snapshot.snapshot_hash ||
    !runtimeScopeMatches(policy, policy.intent_policy_snapshot) ||
    policy.expected_catalog_version !==
      policy.intent_policy_snapshot.catalog_version ||
    policy.catalog_as_of !== policy.intent_policy_snapshot.catalog_as_of ||
    policy.skill_permission_summary_ref !==
      policy.intent_policy_snapshot.skill_permission_summary_ref ||
    policy.skill_permission_summary_hash !==
      policy.intent_policy_snapshot.skill_permission_summary_hash
  ) {
    return invalid("ref_hash_mismatch");
  }
  const {
    snapshot_hash: _snapshotHash,
    ...snapshotHashable
  } = policy.intent_policy_snapshot;
  if (canonicalHashV1(snapshotHashable) !== policy.intent_policy_snapshot_hash) {
    return invalid("ref_hash_mismatch");
  }
  const createdAt = Date.parse(policy.policy.created_at);
  const expiresAt = Date.parse(policy.policy.expires_at);
  if (!Number.isFinite(expiresAt)) return invalid("expires_at_missing");
  if (!Number.isFinite(createdAt) || expiresAt <= nowMs) return invalid("expired");
  if (
    createdAt > nowMs ||
    expiresAt <= createdAt ||
    expiresAt - createdAt > RUNTIME_POLICY_MAX_LIFETIME_MS_V1
  ) {
    return invalid("lifetime_exceeded");
  }
  if (
    policy.skill_permission_summary_ref.length === 0 ||
    !isSha256(policy.skill_permission_summary_hash)
  ) {
    return invalid("skill_permission_summary_missing");
  }
}

function validateSummary(
  request: SkillResolveRequestV1,
  policy: RuntimePolicyInputArtifactV1,
  value: unknown,
): SkillPermissionSummaryV1 {
  if (value === undefined) {
    fail("invalid_runtime_policy", "permission summary is missing", {
      reason_code: "skill_permission_summary_missing",
    });
  }
  const summary =
    canonicalSchemaSnapshotV1<SkillPermissionSummaryV1>(
      SkillPermissionSummaryV1Schema,
      value,
    );
  if (summary === undefined) {
    fail("invalid_runtime_policy", "permission summary schema is invalid", {
      reason_code: "skill_permission_summary_ref_hash_mismatch",
    });
  }
  if (
    summary.summary_ref !== policy.skill_permission_summary_ref ||
    summary.summary_hash !== policy.skill_permission_summary_hash ||
    summaryHash(summary) !== summary.summary_hash
  ) {
    fail("invalid_runtime_policy", "permission summary integrity check failed", {
      reason_code: "skill_permission_summary_ref_hash_mismatch",
    });
  }
  if (
    summary.security_revocation_epoch !==
    policy.intent_policy_snapshot.security_revocation_epoch
  ) {
    fail("invalid_runtime_policy", "permission summary epoch binding failed", {
      reason_code: "skill_permission_summary_ref_hash_mismatch",
    });
  }
  let previousSkillId: string | undefined;
  for (const entry of summary.entries) {
    if (
      (previousSkillId !== undefined && previousSkillId >= entry.skill_id) ||
      entry.capability_refs.some(
        (capability, index) =>
          index > 0 && entry.capability_refs[index - 1]! >= capability,
      )
    ) {
      fail("invalid_runtime_policy", "permission summary is non-canonical", {
        reason_code: "skill_permission_summary_ref_hash_mismatch",
      });
    }
    previousSkillId = entry.skill_id;
  }
  if (!runtimeScopeMatches(request, summary)) {
    fail("invalid_runtime_policy", "permission summary scope does not match", {
      reason_code: "skill_permission_summary_scope_mismatch",
    });
  }
  if (
    summary.catalog_version !== request.expected_catalog_version ||
    summary.catalog_as_of !== request.catalog_as_of
  ) {
    fail("catalog_version_conflict", "permission summary catalog drifted", {
      requested_catalog_version: request.expected_catalog_version,
      current_catalog_version: summary.catalog_version,
      conflict_reason: "skill_permission_summary_catalog_mismatch",
      recovery_action: "recompose_context",
    });
  }
  return summary;
}

function errorFromUnknown(error: unknown): never {
  if (error instanceof SkillRegistryApplicationErrorV1) throw error;
  fail("storage_unavailable", "object storage operation failed");
}

async function settlePortCallV1<T>(
  operation: () => Promise<T>,
  failureCode: Extract<
    SkillRegistryErrorCodeV1,
    "registry_unavailable" | "storage_unavailable"
  >,
  failureMessage: string,
): Promise<T> {
  try {
    const settled = await settleNativePromiseV1(operation());
    return settled.value as T;
  } catch (error) {
    if (error instanceof SkillRegistryApplicationErrorV1) {
      throw sanitizedPortApplicationErrorV1(error);
    }
    fail(failureCode, failureMessage);
  }
}

async function beforeDeadline<T>(
  operation: Promise<T>,
  deadlineMs: number,
  controller: AbortController,
): Promise<T> {
  const remainingMs = deadlineMs - Date.now();
  if (remainingMs <= 0) {
    controller.abort(
      new SkillRegistryApplicationErrorV1(
        "registry_unavailable",
        "package validation timed out",
      ),
    );
    fail("registry_unavailable", "package validation timed out");
  }
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const settled = await Promise.race([
      settleNativePromiseV1(operation),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          const timeoutError = new SkillRegistryApplicationErrorV1(
            "registry_unavailable",
            "package validation timed out",
          );
          controller.abort(timeoutError);
          reject(timeoutError);
        }, remainingMs);
      }),
    ]);
    return settled.value as T;
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

function assertGeneratedManagementResult(
  request: SkillManagementRequestV1,
  result: SkillManagementResultV1,
): void {
  if (!canonicalValueCheckV1(SkillManagementCommandResponseV1Schema, result)) {
    throw new Error(
      "Skill Registry owner generated an invalid management result",
    );
  }
  assertSkillManagementCommandSemanticBindingsV1(request, result);
}

export class SkillRegistryApplicationV1 {
  readonly #repository: SkillRegistryApplicationRepositoryPortV1;
  readonly #objectStore: ObjectStorePortV1;
  readonly #objectStoreMetadataKind: "postgresql" | "memory";
  readonly #objectStoreReadiness: (() => Promise<void>) | undefined;
  readonly #objectAccessDecisions:
    | SkillObjectAccessDecisionResolverPortV1
    | undefined;
  readonly #packageInspector: SkillPackageInspectorPortV1;
  readonly #validationArtifactReader:
    | SkillValidationArtifactReaderPortV1
    | undefined;
  readonly #policyReader: RuntimePolicyInputReaderPortV1;
  readonly #deploymentMode: "test" | "development" | "production";
  readonly #now: () => Date;
  readonly #contentTtlSeconds: number;
  readonly #config: Readonly<SkillRegistryConfigV1>;

  public constructor(dependencies: SkillRegistryApplicationDependenciesV1) {
    this.#repository = dependencies.repository;
    this.#objectStore = dependencies.object_store;
    this.#objectStoreMetadataKind = dependencies.object_store_metadata_kind;
    this.#objectStoreReadiness = dependencies.object_store_readiness;
    this.#objectAccessDecisions =
      dependencies.object_access_decisions;
    this.#packageInspector = dependencies.package_inspector;
    this.#validationArtifactReader =
      dependencies.validation_artifact_reader;
    this.#policyReader = dependencies.policy_input_reader;
    this.#deploymentMode = dependencies.deployment_mode ?? "production";
    this.#now = dependencies.now ?? (() => new Date());
    const resolvedConfig = resolveSkillRegistryConfigV1(
      dependencies.config,
    );
    this.#config =
      dependencies.signed_content_ttl_seconds === undefined
        ? resolvedConfig
        : resolveSkillRegistryConfigV1({
            ...resolvedConfig,
            signed_content_token_ttl_seconds:
              dependencies.signed_content_ttl_seconds,
          });
    this.#contentTtlSeconds =
      this.#config.signed_content_token_ttl_seconds;
  }

  async #resolveObjectAccessDecision(
    request: SkillObjectAccessDecisionRequestV1,
  ): Promise<SkillObjectAccessDecisionV1> {
    const ownerRequest =
      canonicalSnapshotV1<SkillObjectAccessDecisionRequestV1>(
        request,
      );
    if (this.#objectAccessDecisions === undefined) {
      if (this.#deploymentMode === "production") {
        fail(
          "storage_unavailable",
          "durable object access decision resolver is not configured",
        );
      }
      // Test/development compatibility only. Production readiness and the
      // runtime path both fail closed without an operation-bound resolver.
      return Object.freeze({
        access_decision_ref:
          ownerRequest.prior_access_decision_ref,
        retention_policy_version:
          "skill-package-retention.v1",
        redaction_policy_version:
          "skill-package-no-redaction.v1",
      });
    }
    return objectAccessDecisionSnapshotV1(
      await settlePortCallV1(
        () =>
          this.#objectAccessDecisions!.resolve(
            ownerRequest,
          ),
        "storage_unavailable",
        "object access decision could not be resolved",
      ),
    );
  }

  public async checkReadiness(): Promise<void> {
    await this.#repository.checkReadiness();
    await this.#policyReader.checkReadiness();
    await this.#packageInspector.checkReadiness();
    if (this.#validationArtifactReader !== undefined) {
      await this.#validationArtifactReader.checkReadiness();
    }
    if (this.#objectStoreReadiness !== undefined) {
      await this.#objectStoreReadiness();
    }
    if (this.#objectAccessDecisions !== undefined) {
      await this.#objectAccessDecisions.checkReadiness();
    }
    if (
      this.#deploymentMode === "production" &&
      (this.#repository.persistence_kind !== "postgresql" ||
        this.#objectStoreMetadataKind !== "postgresql" ||
        this.#objectStoreReadiness === undefined ||
        this.#objectAccessDecisions?.durability !== "durable" ||
        this.#policyReader.durability !== "durable" ||
        this.#validationArtifactReader?.durability !== "durable" ||
        this.#validationArtifactReader?.cancellation_kind !==
          "abort_signal" ||
        this.#packageInspector.cancellation_kind !==
          "abort_signal" ||
        this.#packageInspector.execution_kind !== "isolated")
    ) {
      throw new Error(
        "Skill Registry production requires PostgreSQL owner state, durable policy/object-access reads, isolated package inspection, and PostgreSQL ObjectStore metadata",
      );
    }
  }

  public async validate(
    principal: SkillRegistryPrincipalV1,
    request: SkillValidateRequestV1,
  ): Promise<SkillValidateDetailsV1> {
    principal = canonicalPrincipalSnapshotV1(principal);
    assertGlobalPrincipal(principal, "skill.package.validate");
    request = canonicalRequestSnapshotV1<SkillValidateRequestV1>(
      SkillValidateRequestV1Schema,
      request,
      "validate request does not match owner contract",
    );
    let durableDiagnostics: readonly SkillValidationDiagnosticV1[] =
      Object.freeze([]);
    try {
      assertSkillValidateRequestSemanticBindingsV1(request);
    } catch {
      fail("invalid_request", "validate idempotency identity is invalid");
    }
    const requestHash = canonicalHashV1(request);
    const replayValue = await settlePortCallV1(
      () =>
        this.#repository.replayValidation(
          request,
          requestHash,
          principal.principal_id,
          this.#now().toISOString(),
        ),
      "registry_unavailable",
      "validation replay could not be read",
    );
    if (replayValue !== undefined) {
      const replay = ownerSchemaSnapshotV1<SkillValidateDetailsV1>(
        SkillValidateDetailsV1Schema,
        replayValue,
        "Skill Registry owner replayed an invalid validation response",
      );
      try {
        assertSkillValidateResponseSemanticBindingsV1(request, {
          code: "skill_package_validated",
          message: "skill package validated",
          retryable: false,
          trace_id: request.trace_id,
          details: replay,
        });
      } catch {
        throw new Error(
          "Skill Registry owner replayed a semantically unbound validation response",
        );
      }
      return replay;
    }
    if (request.size_bytes > this.#config.package_max_bytes) {
      return this.#recordRejectedValidation(
        principal,
        request,
        requestHash,
        {
          code: "invalid_skill_package",
          message: "package exceeds configured hard limit",
          details: {},
        },
        [],
      );
    }
    const validationDeadlineMs =
      Date.now() + this.#config.validation_timeout_seconds * 1_000;
    const validationController = new AbortController();
    const reader = this.#validationArtifactReader;
    if (reader === undefined) {
      fail(
        "registry_unavailable",
        "durable validation artifact reader is not composed",
      );
    }
    let artifactValue: SkillValidationArtifactReadV1;
    try {
      artifactValue = await beforeDeadline(
        reader.readArtifact(
          request,
          validationController.signal,
        ),
        validationDeadlineMs,
        validationController,
      );
    } catch (error) {
      if (error instanceof SkillRegistryApplicationErrorV1) {
        throw sanitizedPortApplicationErrorV1(error);
      }
      fail(
        "registry_unavailable",
        "validation artifact could not be read",
      );
    }
    const artifact = validationArtifactSnapshotV1(artifactValue);
    try {
      if (
        typeof artifact.artifact_ref !== "string" ||
        artifact.artifact_ref !== request.artifact_ref ||
        typeof artifact.media_type !== "string" ||
        artifact.media_type !== request.media_type ||
        typeof artifact.object_access_decision_ref !== "string" ||
        artifact.object_access_decision_ref.length === 0 ||
        typeof artifact.owner_object_id !== "string" ||
        artifact.owner_object_id.length === 0 ||
        !Number.isSafeInteger(artifact.owner_state_version) ||
        artifact.owner_state_version < 1 ||
        typeof artifact.skill_id !== "string" ||
        artifact.skill_id.length === 0 ||
        typeof artifact.skill_name !== "string" ||
        !/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/u.test(
          artifact.skill_name,
        ) ||
        /(?:anthropic|claude)/u.test(artifact.skill_name) ||
        typeof artifact.proposed_version !== "string" ||
        !/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u.test(
          artifact.proposed_version,
        ) ||
        typeof artifact.provenance !== "object" ||
        artifact.provenance === null ||
        Array.isArray(artifact.provenance) ||
        typeof artifact.validation_result !== "object" ||
        artifact.validation_result === null ||
        Array.isArray(artifact.validation_result) ||
        typeof artifact.scanner_versions !== "object" ||
        artifact.scanner_versions === null ||
        Array.isArray(artifact.scanner_versions) ||
        !Array.isArray(artifact.diagnostics) ||
        artifact.diagnostics.length >
          SKILL_VALIDATION_DIAGNOSTIC_MAX_ITEMS_V1 ||
        artifact.diagnostics.some(
          (diagnostic) =>
            !canonicalValueCheckV1(
              SkillValidationDiagnosticV1Schema,
              diagnostic,
            ),
        )
      ) {
        fail(
          "invalid_skill_package",
          "validation artifact metadata is outside the owner contract",
        );
      }
      durableDiagnostics = sanitizedDiagnosticsV1(
        artifact.diagnostics,
      );
      if (
        durableDiagnostics.some(
          (diagnostic) => diagnostic.severity === "error",
        )
      ) {
        fail("package_scan_failed", "package scanner rejected the artifact");
      }
      const actual = await beforeDeadline(
        digestStream(
          artifact.body,
          this.#config.package_max_bytes,
          validationController.signal,
          "registry_unavailable",
        ),
        validationDeadlineMs,
        validationController,
      );
      if (
        actual.digest !== request.content_digest ||
        actual.size_bytes !== request.size_bytes
      ) {
        fail(
          "content_integrity_mismatch",
          "staging artifact bytes do not match the validate request",
        );
      }
      let inspection: SkillPackageInspectionV1;
      const inspectionBytes = Uint8Array.prototype.slice.call(
        actual.bytes,
      ) as Uint8Array;
      try {
        inspection = await beforeDeadline(
          this.#packageInspector.inspectPackage(
            inspectionBytes,
            validationController.signal,
          ),
          validationDeadlineMs,
          validationController,
        );
      } catch (error) {
        if (error instanceof SkillRegistryApplicationErrorV1) {
          throw sanitizedPortApplicationErrorV1(error);
        }
        fail("package_scan_failed", "package could not be safely inspected");
      }
      if (sha256BytesV1(inspectionBytes) !== actual.digest) {
        fail(
          "package_scan_failed",
          "package inspector mutated its immutable input",
        );
      }
      let inspectedManifest: SkillPackageManifestV1;
      try {
        inspectedManifest = validatePackageInspection(
          inspection,
          artifact.skill_name,
        );
      } catch (error) {
        if (
          error instanceof SkillRegistryApplicationErrorV1 &&
          error.code === "content_integrity_mismatch"
        ) {
          fail(
            "invalid_skill_package",
            "package manifest is unsafe or non-canonical",
          );
        }
        throw error;
      }
      const manifestBytes = Buffer.byteLength(
        canonicalJsonV1(inspectedManifest),
        "utf8",
      );
      if (manifestBytes > this.#config.manifest_max_bytes) {
        fail(
          "invalid_skill_package",
          "normalized manifest exceeds the hard limit",
        );
      }
      const manifestDigest = canonicalHashV1(inspectedManifest);
      const now = this.#now();
      const resultValue = await settlePortCallV1(
        () =>
          this.#repository.commitValidation({
            request,
            request_hash: requestHash,
            artifact: {
              artifact_ref: artifact.artifact_ref,
              object_access_decision_ref:
                artifact.object_access_decision_ref,
              owner_object_id: artifact.owner_object_id,
              owner_state_version: artifact.owner_state_version,
              skill_id: artifact.skill_id,
              skill_name: artifact.skill_name,
              proposed_version: artifact.proposed_version,
              media_type: artifact.media_type,
              provenance: structuredClone(artifact.provenance),
              validation_result: structuredClone(
                artifact.validation_result,
              ),
              scanner_versions: structuredClone(
                artifact.scanner_versions,
              ),
              diagnostics: durableDiagnostics,
            },
            package_digest: actual.digest,
            manifest_digest: manifestDigest,
            manifest: inspectedManifest,
            size_bytes: actual.size_bytes,
            // This is a versioned schema constant, not a hot configuration knob.
            expires_at: new Date(
              now.getTime() +
                SKILL_VALIDATION_RECORD_TTL_SECONDS_V1 * 1_000,
            ).toISOString(),
            actor_principal_id: principal.principal_id,
            now: now.toISOString(),
          }),
        "registry_unavailable",
        "validation owner commit failed",
      );
      const result = ownerSchemaSnapshotV1<SkillValidateDetailsV1>(
        SkillValidateDetailsV1Schema,
        resultValue,
        "Skill Registry owner returned an invalid validation response",
      );
      try {
        assertSkillValidateResponseSemanticBindingsV1(request, {
          code: "skill_package_validated",
          message: "skill package validated",
          retryable: false,
          trace_id: request.trace_id,
          details: result,
        });
      } catch {
        throw new Error(
          "Skill Registry owner returned a semantically unbound validation response",
        );
      }
      return result;
    } catch (error) {
      if (
        !(error instanceof SkillRegistryApplicationErrorV1) ||
        (error.code !== "content_integrity_mismatch" &&
          error.code !== "invalid_skill_package" &&
          error.code !== "package_scan_failed")
      ) {
        throw error;
      }
      return this.#recordRejectedValidation(
        principal,
        request,
        requestHash,
        {
          code: error.code,
          message: error.message,
          details: error.details,
        },
        durableDiagnostics,
      );
    }
  }

  async #recordRejectedValidation(
    principal: SkillRegistryPrincipalV1,
    request: SkillValidateRequestV1,
    requestHash: string,
    error: ValidationFailureCommitV1["error"],
    diagnostics: unknown,
  ): Promise<SkillValidateDetailsV1> {
    const safeDiagnostics = (Array.isArray(diagnostics) ? diagnostics : [])
      .map((diagnostic) =>
        canonicalSchemaSnapshotV1<SkillValidationDiagnosticV1>(
          SkillValidationDiagnosticV1Schema,
          diagnostic,
        ),
      )
      .filter(
        (diagnostic): diagnostic is SkillValidationDiagnosticV1 =>
          diagnostic !== undefined,
      )
      .slice(0, SKILL_VALIDATION_DIAGNOSTIC_MAX_ITEMS_V1)
      .map((diagnostic) => diagnostic);
    const durableError = new SkillRegistryApplicationErrorV1(
      error.code,
      error.message,
      Object.freeze({
        ...structuredClone(error.details),
        diagnostics: Object.freeze(safeDiagnostics),
      }),
    );
    const now = this.#now();
    const concurrentSuccessValue = await settlePortCallV1(
      () =>
        this.#repository.recordValidationFailure({
          request,
          request_hash: requestHash,
          error: {
            code: error.code,
            message: durableError.message,
            details: durableError.details,
          },
          expires_at: new Date(
            now.getTime() +
              SKILL_VALIDATION_RECORD_TTL_SECONDS_V1 * 1_000,
          ).toISOString(),
          actor_principal_id: principal.principal_id,
          now: now.toISOString(),
        }),
      "registry_unavailable",
      "validation rejection could not be recorded",
    );
    if (concurrentSuccessValue !== undefined) {
      const concurrentSuccess =
        ownerSchemaSnapshotV1<SkillValidateDetailsV1>(
          SkillValidateDetailsV1Schema,
          concurrentSuccessValue,
          "Skill Registry owner returned an invalid concurrent validation response",
        );
      try {
        assertSkillValidateResponseSemanticBindingsV1(request, {
          code: "skill_package_validated",
          message: "skill package validated",
          retryable: false,
          trace_id: request.trace_id,
          details: concurrentSuccess,
        });
      } catch {
        throw new Error(
          "Skill Registry owner returned a semantically unbound concurrent validation response",
        );
      }
      return concurrentSuccess;
    }
    throw durableError;
  }

  public async queryCatalog(
    principal: SkillRegistryPrincipalV1,
    request: SkillCatalogQueryRequestV1,
  ): Promise<SkillCatalogQueryResultV1> {
    principal = canonicalPrincipalSnapshotV1(principal);
    request =
      canonicalAuthorizationInputSnapshotV1<SkillCatalogQueryRequestV1>(
        request,
      );
    assertBotPrincipal(
      principal,
      request,
      "skill.catalog.read",
    );
    request = canonicalRequestSnapshotV1<SkillCatalogQueryRequestV1>(
      SkillCatalogQueryRequestV1Schema,
      request,
      "catalog query does not match owner contract",
    );
    if (
      principal.caller !== "trigger_processor" &&
      principal.caller !== "meta_cognition"
    ) {
      fail(
        "authorization_scope_mismatch",
        "catalog query is limited to Trigger Processor and Meta Cognition",
      );
    }
    if (
      request.as_of !== undefined &&
      new Date(request.as_of).toISOString() !== request.as_of
    ) {
      fail("invalid_request", "catalog as_of must be canonical UTC milliseconds");
    }
    const normalizedCapabilities = [...new Set(principal.capabilities)].sort();
    const resultValue = await settlePortCallV1(
      () =>
        this.#repository.queryCatalog({
          request,
          principal_id: principal.principal_id,
          authorization_context_hash: canonicalHashV1({
            caller: principal.caller,
            principal_id: principal.principal_id,
            scope: principal.scope,
            capabilities: normalizedCapabilities,
          }),
          now: this.#now().toISOString(),
          page_size: this.#config.catalog_page_size,
          cursor_ttl_seconds: 900,
        }),
      "registry_unavailable",
      "catalog owner query failed",
    );
    const result = ownerSchemaSnapshotV1<SkillCatalogQueryResultV1>(
      SkillCatalogQueryDetailsV1Schema,
      resultValue,
      "Skill Registry owner returned an invalid catalog response",
    );
    try {
      assertSkillCatalogQuerySemanticBindingsV1(request, {
        code: "skill_catalog_found",
        message: "skill catalog found",
        retryable: false,
        trace_id: request.trace_id,
        details: result,
      });
    } catch {
      throw new Error(
        "Skill Registry owner returned a semantically unbound catalog response",
      );
    }
    return result;
  }

  /**
   * Trigger Processor freezes this owner view into its Context Snapshot. It is
   * deliberately separate from policy catalog pagination: context needs the
   * immutable package and manifest identities for every active skill.
   */
  public async readContextCatalog(
    principal: SkillRegistryPrincipalV1,
    request: SkillContextCatalogRequestV1,
  ): Promise<SkillContextCatalogDetailsV1> {
    principal = canonicalPrincipalSnapshotV1(principal);
    request = canonicalAuthorizationInputSnapshotV1<
      SkillContextCatalogRequestV1
    >(request);
    assertBotPrincipal(
      principal,
      request,
      "skill.context_catalog.read",
      "trigger_processor",
    );
    request = canonicalRequestSnapshotV1<SkillContextCatalogRequestV1>(
      SkillContextCatalogRequestV1Schema,
      request,
      "context catalog request does not match owner contract",
    );
    const resultValue = await settlePortCallV1(
      () =>
        this.#repository.readContextCatalog({
          request,
          now: this.#now().toISOString(),
        }),
      "registry_unavailable",
      "context catalog owner query failed",
    );
    const result = ownerSchemaSnapshotV1<SkillContextCatalogDetailsV1>(
      SkillContextCatalogDetailsV1Schema,
      resultValue,
      "Skill Registry owner returned an invalid context catalog response",
    );
    if (
      result.workspace_id !== request.workspace_id ||
      result.bot_id !== request.bot_id ||
      result.owner_agent_id !== request.owner_agent_id ||
      result.deployment_environment !== request.deployment_environment ||
      result.release_channel !== request.release_channel ||
      result.items.length > request.limit
    ) {
      throw new Error(
        "Skill Registry owner returned a semantically unbound context catalog response",
      );
    }
    let previousKey: string | undefined;
    for (const item of result.items) {
      if (previousKey !== undefined && previousKey >= item.skill_key) {
        throw new Error(
          "Skill Registry owner returned a non-canonical context catalog order",
        );
      }
      previousKey = item.skill_key;
    }
    return result;
  }

  public async publish(
    principal: SkillRegistryPrincipalV1,
    pathSkillName: string,
    request: SkillPublishRequestV1,
  ): Promise<SkillPublishResultV1> {
    principal = canonicalPrincipalSnapshotV1(principal);
    assertGlobalPrincipal(principal, "skill.version.publish");
    request = canonicalRequestSnapshotV1<SkillPublishRequestV1>(
      SkillPublishRequestV1Schema,
      request,
      "publish request does not match owner contract",
    );
    try {
      assertSkillPublishRequestSemanticBindingsV1(request);
    } catch {
      fail("invalid_request", "publish idempotency identity is invalid");
    }
    if (
      request.schema_version !== "skill_publish_request.v1" ||
      pathSkillName !== request.skill_name ||
      request.artifact_ref.length === 0 ||
      request.validation_id.length === 0 ||
      request.idempotency_key.length === 0 ||
      request.trace_id.length === 0 ||
      !/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/u.test(
        request.skill_name,
      ) ||
      /(?:anthropic|claude)/u.test(request.skill_name) ||
      !/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u.test(
        request.semver,
      )
    ) {
      fail("invalid_request", "publish path and request bindings are invalid");
    }
    assertSha256(request.package_digest, "package_digest");
    assertSha256(request.manifest_digest, "manifest_digest");
    const requestHash = canonicalHashV1(request);
    const replayValue = await settlePortCallV1(
      () => this.#repository.replayPublish(request, requestHash),
      "registry_unavailable",
      "publish replay could not be read",
    );
    if (replayValue !== undefined) {
      const replay = ownerSchemaSnapshotV1<SkillPublishResultV1>(
        SkillPublishDetailsV1Schema,
        replayValue,
        "Skill Registry owner replayed an invalid publish response",
      );
      try {
        assertSkillPublishSemanticBindingsV1(request, {
          code: "skill_version_published",
          message: "skill version published",
          retryable: false,
          trace_id: request.trace_id,
          details: replay,
        });
      } catch {
        throw new Error(
          "Skill Registry owner replayed a semantically unbound publish response",
        );
      }
      return replay;
    }
    const validationValue = await settlePortCallV1(
      () =>
        this.#repository.readValidation(request.validation_id),
      "registry_unavailable",
      "approved validation could not be read",
    );
    if (validationValue === undefined) {
      fail("validation_not_found", "approved validation was not found");
    }
    const validation =
      ownerValidationRecordSnapshotV1(validationValue);
    const now = this.#now();
    if (validation.status !== "approved") {
      fail("version_not_publishable", "validation is not approved");
    }
    if (Date.parse(validation.expires_at) <= now.getTime()) {
      fail("validation_expired", "validation has expired");
    }
    if (
      validation.skill_name !== request.skill_name ||
      validation.proposed_version !== request.semver ||
      validation.artifact_ref !== request.artifact_ref ||
      validation.package_digest !== request.package_digest ||
      validation.manifest_digest !== request.manifest_digest ||
      validation.runtime_target !== SKILL_RUNTIME_TARGET_V1
    ) {
      fail("content_integrity_mismatch", "publish request does not match validation");
    }
    if (canonicalHashV1(validation.manifest) !== validation.manifest_digest) {
      fail("content_integrity_mismatch", "validated manifest digest drifted");
    }
    let stream: ReturnType<typeof objectStreamSnapshotV1>;
    try {
      const objectAccess =
        await this.#resolveObjectAccessDecision({
          operation: "get",
          owner_service: "skill_registry",
          owner_object_id: validation.owner_object_id,
          owner_state_version: validation.owner_state_version,
          scope: { scope_kind: "global" },
          capability: "skill.content.read",
          object_ref: validation.artifact_ref,
          prior_access_decision_ref:
            validation.object_access_decision_ref,
          purpose: "publish_integrity_check",
          trace_id: request.trace_id,
        });
      const streamValue = await settlePortCallV1(
        () =>
          this.#objectStore.getStream({
            owner_service: "skill_registry",
            owner_object_id: validation.owner_object_id,
            owner_state_version: validation.owner_state_version,
            scope: { scope_kind: "global" },
            capability: "skill.content.read",
            object_ref: validation.artifact_ref,
            access_decision_ref:
              objectAccess.access_decision_ref,
            retention_policy_version:
              objectAccess.retention_policy_version,
            redaction_policy_version:
              objectAccess.redaction_policy_version,
          }),
        "storage_unavailable",
        "object storage stream could not be read",
      );
      stream = objectStreamSnapshotV1(streamValue);
    } catch (error) {
      return errorFromUnknown(error);
    }
    const publishInspectionController = new AbortController();
    const publishInspectionDeadlineMs =
      Date.now() + this.#config.validation_timeout_seconds * 1_000;
    const actual = await beforeDeadline(
      digestStream(
        stream.body,
        this.#config.package_max_bytes,
        publishInspectionController.signal,
      ),
      publishInspectionDeadlineMs,
      publishInspectionController,
    );
    let inspection: SkillPackageInspectionV1;
    const inspectionBytes = Uint8Array.prototype.slice.call(
      actual.bytes,
    ) as Uint8Array;
    try {
      inspection = await beforeDeadline(
        this.#packageInspector.inspectPackage(
          inspectionBytes,
          publishInspectionController.signal,
        ),
        publishInspectionDeadlineMs,
        publishInspectionController,
      );
    } catch (error) {
      if (error instanceof SkillRegistryApplicationErrorV1) {
        throw sanitizedPortApplicationErrorV1(error);
      }
      fail("content_integrity_mismatch", "package could not be safely inspected");
    }
    if (sha256BytesV1(inspectionBytes) !== actual.digest) {
      fail(
        "content_integrity_mismatch",
        "package inspector mutated its immutable input",
      );
    }
    const inspectedManifest = validatePackageInspection(
      inspection,
      validation.skill_name,
    );
    const inspectedManifestDigest = canonicalHashV1(inspectedManifest);
    if (
      stream.object_ref !== validation.artifact_ref ||
      stream.sha256 !== request.package_digest ||
      stream.size_bytes !== actual.size_bytes ||
      stream.media_type !== validation.media_type ||
      actual.digest !== request.package_digest ||
      actual.size_bytes !== validation.size_bytes ||
      inspectedManifestDigest !== request.manifest_digest ||
      canonicalJsonV1(inspectedManifest) !== canonicalJsonV1(validation.manifest)
    ) {
      fail("content_integrity_mismatch", "object bytes do not match approved validation");
    }
    const resultValue = await settlePortCallV1(
      () =>
        this.#repository.publishVersion({
          request,
          request_hash: requestHash,
          validation,
          verified: {
            package_digest: actual.digest,
            manifest_digest: inspectedManifestDigest,
            size_bytes: actual.size_bytes,
          },
          actor_principal_id: principal.principal_id,
          // Re-sample at the owner commit boundary so a validation that expires
          // during a slow ObjectStore read cannot be published.
          now: this.#now().toISOString(),
        }),
      "registry_unavailable",
      "publish owner commit failed",
    );
    const result = ownerSchemaSnapshotV1<SkillPublishResultV1>(
      SkillPublishDetailsV1Schema,
      resultValue,
      "Skill Registry owner returned an invalid publish response",
    );
    try {
      assertSkillPublishSemanticBindingsV1(request, {
        code: "skill_version_published",
        message: "skill version published",
        retryable: false,
        trace_id: request.trace_id,
        details: result,
      });
    } catch {
      throw new Error(
        "Skill Registry owner returned a semantically unbound publish response",
      );
    }
    return result;
  }

  public async applyCandidate(
    principal: SkillRegistryPrincipalV1,
    request: SkillCandidateApplicationRequestV1,
  ): Promise<SkillCandidateApplicationDetailsV1> {
    principal = canonicalPrincipalSnapshotV1(principal);
    request =
      canonicalAuthorizationInputSnapshotV1<SkillCandidateApplicationRequestV1>(
        request,
      );
    assertBotPrincipal(
      principal,
      request,
      "skill.candidate.apply",
      "meta_cognition",
    );
    request =
      canonicalRequestSnapshotV1<SkillCandidateApplicationRequestV1>(
        SkillCandidateApplicationRequestV1Schema,
        request,
        "candidate application does not match owner contract",
      );
    if (request.reviewer_principal_id !== principal.principal_id) {
      fail(
        "authorization_scope_mismatch",
        "candidate reviewer is not bound to the signed delegated principal",
      );
    }
    if (
      request.schema_version !== "skill_candidate_application.v1" ||
      request.evidence_refs.some(
        (entry, index) =>
          request.evidence_refs.findIndex(
            (candidate) =>
              candidate.ref === entry.ref &&
              candidate.hash === entry.hash,
          ) !== index,
      )
    ) {
      fail("invalid_request", "candidate application bindings are invalid");
    }
    const resultValue = await settlePortCallV1(
      () =>
        this.#repository.applyCandidateApplication({
          request,
          request_hash: canonicalHashV1(request),
          actor_principal_id: principal.principal_id,
          now: this.#now().toISOString(),
        }),
      "registry_unavailable",
      "candidate application owner commit failed",
    );
    const result =
      ownerSchemaSnapshotV1<SkillCandidateApplicationDetailsV1>(
        SkillCandidateApplicationDetailsV1Schema,
        resultValue,
        "Skill Registry owner returned an invalid candidate application response",
      );
    try {
      assertSkillCandidateApplicationSemanticBindingsV1(
        request,
        {
          code: "skill_candidate_application_updated",
          message: "skill candidate application updated",
          retryable: false,
          trace_id: request.trace_id,
          details: result,
        },
        principal.principal_id,
      );
    } catch {
      throw new Error(
        "Skill Registry owner returned a semantically unbound candidate application response",
      );
    }
    return result;
  }

  public async activate(
    principal: SkillRegistryPrincipalV1,
    pathSkillKey: string,
    request: SkillActivateRequestV1,
  ): Promise<SkillActivateResultV1> {
    return (await this.#executeManagement(
      principal,
      pathSkillKey,
      undefined,
      request,
      "activate",
      "skill.version.activate",
    )) as SkillActivateResultV1;
  }

  public async rollback(
    principal: SkillRegistryPrincipalV1,
    pathSkillKey: string,
    request: SkillRollbackRequestV1,
  ): Promise<Extract<SkillManagementResultV1, { operation: "rollback" }>> {
    return (await this.#executeManagement(
      principal,
      pathSkillKey,
      undefined,
      request,
      "rollback",
      "skill.version.rollback",
    )) as Extract<SkillManagementResultV1, { operation: "rollback" }>;
  }

  public async disable(
    principal: SkillRegistryPrincipalV1,
    pathSkillKey: string,
    request: SkillDisableRequestV1,
  ): Promise<Extract<SkillManagementResultV1, { operation: "disable" }>> {
    return (await this.#executeManagement(
      principal,
      pathSkillKey,
      undefined,
      request,
      "disable",
      "skill.activation.disable",
    )) as Extract<SkillManagementResultV1, { operation: "disable" }>;
  }

  public async grantPermission(
    principal: SkillRegistryPrincipalV1,
    pathSkillKey: string,
    request: SkillPermissionGrantRequestV1,
  ): Promise<
    Extract<SkillManagementResultV1, { operation: "permission_grant" }>
  > {
    return (await this.#executeManagement(
      principal,
      pathSkillKey,
      undefined,
      request,
      "permission_grant",
      "skill.permission.grant",
    )) as Extract<
      SkillManagementResultV1,
      { operation: "permission_grant" }
    >;
  }

  public async revokePermission(
    principal: SkillRegistryPrincipalV1,
    pathSkillKey: string,
    request: SkillPermissionRevokeRequestV1,
  ): Promise<
    Extract<SkillManagementResultV1, { operation: "permission_revoke" }>
  > {
    return (await this.#executeManagement(
      principal,
      pathSkillKey,
      undefined,
      request,
      "permission_revoke",
      "skill.permission.revoke",
    )) as Extract<
      SkillManagementResultV1,
      { operation: "permission_revoke" }
    >;
  }

  public async deprecate(
    principal: SkillRegistryPrincipalV1,
    pathSkillKey: string,
    pathVersionId: string,
    request: SkillDeprecateRequestV1,
  ): Promise<Extract<SkillManagementResultV1, { operation: "deprecate" }>> {
    return (await this.#executeManagement(
      principal,
      pathSkillKey,
      pathVersionId,
      request,
      "deprecate",
      "skill.version.deprecate",
    )) as Extract<SkillManagementResultV1, { operation: "deprecate" }>;
  }

  public async revoke(
    principal: SkillRegistryPrincipalV1,
    pathSkillKey: string,
    pathVersionId: string,
    request: SkillRevokeRequestV1,
  ): Promise<Extract<SkillManagementResultV1, { operation: "revoke" }>> {
    return (await this.#executeManagement(
      principal,
      pathSkillKey,
      pathVersionId,
      request,
      "revoke",
      "skill.version.revoke",
    )) as Extract<SkillManagementResultV1, { operation: "revoke" }>;
  }

  async #executeManagement(
    principal: SkillRegistryPrincipalV1,
    pathSkillKey: string,
    pathVersionId: string | undefined,
    request: SkillManagementRequestV1,
    expectedOperation: SkillManagementRequestV1["operation"],
    capability: string,
  ): Promise<SkillManagementResultV1> {
    principal = canonicalPrincipalSnapshotV1(principal);
    if (expectedOperation === "deprecate" || expectedOperation === "revoke") {
      assertGlobalPrincipal(principal, capability);
      request = canonicalRequestSnapshotV1<SkillManagementRequestV1>(
        SkillManagementCommandRequestV1Schema,
        request,
        "management command bindings are invalid",
      );
    } else {
      request =
        canonicalAuthorizationInputSnapshotV1<SkillManagementRequestV1>(
          request,
        );
      assertCatalogPrincipal(
        principal,
        request as SkillCatalogScopeV1,
        capability,
      );
      request = canonicalRequestSnapshotV1<SkillManagementRequestV1>(
        SkillManagementCommandRequestV1Schema,
        request,
        "management command bindings are invalid",
      );
    }
    if (
      !canonicalValueCheckV1(
        SkillManagementCommandRequestV1Schema,
        request,
      ) ||
      request.operation !== expectedOperation ||
      pathSkillKey.length === 0 ||
      request.skill_id.length === 0 ||
      request.reason.length === 0 ||
      request.idempotency_key.length === 0 ||
      request.trace_id.length === 0
    ) {
      fail("invalid_request", "management command bindings are invalid");
    }
    if (
      request.scope_kind === "global" &&
      (pathVersionId === undefined ||
        request.version_id !== pathVersionId)
    ) {
      fail(
        "invalid_request",
        "global lifecycle path and version identity do not match",
      );
    }
    if (
      request.operation === "permission_grant" ||
      request.operation === "permission_revoke"
    ) {
      try {
        assertStrictlySortedUniqueStringsV1(
          request.capability_refs,
          "capability_refs",
        );
      } catch {
        fail(
          "invalid_request",
          "permission capabilities must be sorted and unique",
        );
      }
      if (request.scope_hash !== skillPermissionScopeHashV1(request)) {
        fail(
          "authorization_scope_mismatch",
          "permission scope hash is not bound to the authenticated scope",
        );
      }
    }
    const resultValue = await settlePortCallV1(
      () =>
        this.#repository.executeManagement({
          request,
          skill_key: pathSkillKey,
          request_hash: canonicalHashV1({
            path_skill_key: pathSkillKey,
            path_version_id: pathVersionId ?? null,
            request,
          }),
          actor_principal_id: principal.principal_id,
          now: this.#now().toISOString(),
        }),
      "registry_unavailable",
      "management owner commit failed",
    );
    const result = ownerSchemaSnapshotV1<SkillManagementResultV1>(
      SkillManagementCommandResponseV1Schema,
      resultValue,
      "Skill Registry owner returned an invalid management response",
    );
    try {
      assertSkillManagementCommandSemanticBindingsV1(request, result);
    } catch {
      throw new Error(
        "Skill Registry owner returned a semantically unbound management response",
      );
    }
    return result;
  }

  public async resolve(
    principal: SkillRegistryPrincipalV1,
    request: SkillResolveRequestV1,
  ): Promise<SkillResolveResultV1> {
    // The documented precedence requires authentication before every other
    // lookup, so an attacker cannot use policy/catalog errors as an oracle.
    principal = canonicalPrincipalSnapshotV1(principal);
    request =
      canonicalAuthorizationInputSnapshotV1<SkillResolveRequestV1>(
        request,
      );
    assertBotPrincipal(principal, request, "skill.resolve", "action_runtime");
    request = canonicalRequestSnapshotV1<SkillResolveRequestV1>(
      SkillResolveRequestV1Schema,
      request,
      "resolve request does not match owner contract",
    );
    validateCommonResolveRequest(request);
    const requestHash = canonicalHashV1(request);
    const replayValue = await settlePortCallV1(
      () =>
        this.#repository.replayResolutionAttempt(
          request,
          requestHash,
        ),
      "registry_unavailable",
      "resolution replay could not be read",
    );
    if (replayValue !== undefined) {
      const replay = ownerSchemaSnapshotV1<SkillResolveResultV1>(
        SkillResolveDetailsV1Schema,
        replayValue,
        "Skill Registry owner replayed an invalid resolution response",
      );
      try {
        assertSkillResolveResponseSemanticBindingsV1(
          request,
          {
            code: "skill_resolution_succeeded",
            message: "skills resolved",
            retryable: false,
            trace_id: request.trace_id,
            details: replay,
          },
          replay.valid_until,
        );
      } catch {
        throw new Error(
          "Skill Registry owner replayed a semantically unbound resolution response",
        );
      }
      return replay;
    }
    try {
      let policy: RuntimePolicyInputArtifactV1;
      try {
        const policyValue = await settlePortCallV1(
          () =>
            this.#policyReader.readPolicyInput(
              request,
            ),
          "registry_unavailable",
          "runtime policy input could not be read",
        );
        const policySnapshot =
          canonicalSchemaSnapshotV1<RuntimePolicyInputArtifactV1>(
            RuntimePolicyInputReadArtifactV1Schema,
            policyValue,
          );
        if (policySnapshot === undefined) {
          fail(
            "invalid_runtime_policy",
            "runtime policy artifact schema is invalid",
            {
              reason_code: "ref_hash_mismatch",
            },
          );
        }
        policy = policySnapshot;
      } catch (error) {
        if (error instanceof SkillRegistryApplicationErrorV1) {
          throw sanitizedPortApplicationErrorV1(error);
        }
        fail("registry_unavailable", "runtime policy input could not be read");
      }
      if (
        canonicalHashV1(policy.policy) !== request.policy_input_hash ||
        policy.policy_input_hash !== request.policy_input_hash
      ) {
        fail("invalid_runtime_policy", "runtime policy hash does not match", {
          reason_code: "ref_hash_mismatch",
        });
      }
      const now = this.#now();
      validatePolicy(request, policy, now.getTime());
      const summaryValue = await settlePortCallV1(
        () =>
          this.#repository.readPermissionSummary(
            policy.skill_permission_summary_ref,
          ),
        "registry_unavailable",
        "permission summary could not be read",
      );
      const summary = validateSummary(
        request,
        policy,
        summaryValue,
      );
      const resultValue = await settlePortCallV1(
        () =>
          this.#repository.resolveAttempt({
            request,
            request_hash: requestHash,
            policy,
            summary,
            now: now.toISOString(),
          }),
        "registry_unavailable",
        "resolution owner commit failed",
      );
      const result = ownerSchemaSnapshotV1<SkillResolveResultV1>(
        SkillResolveDetailsV1Schema,
        resultValue,
        "Skill Registry owner returned an invalid resolution response",
      );
      try {
        assertSkillResolveResponseSemanticBindingsV1(
          request,
          {
            code: "skill_resolution_succeeded",
            message: "skills resolved",
            retryable: false,
            trace_id: request.trace_id,
            details: result,
          },
          policy.policy.expires_at,
        );
      } catch {
        throw new Error(
          "Skill Registry owner returned a semantically unbound resolution response",
        );
      }
      return result;
    } catch (error) {
      if (
        error instanceof SkillRegistryApplicationErrorV1 &&
        !error.retryable &&
        error.code !== "idempotency_conflict"
      ) {
        const failureRaceValue = await settlePortCallV1(
          () =>
            this.#repository.recordResolutionFailure(
              request,
              requestHash,
              error,
            ),
          "registry_unavailable",
          "resolution failure could not be recorded",
        );
        return ownerSchemaSnapshotV1<SkillResolveResultV1>(
          SkillResolveDetailsV1Schema,
          failureRaceValue,
          "Skill Registry owner returned an invalid concurrent resolution response",
        );
      }
      throw error;
    }
  }

  async #recordContentAudit(
    request: SkillContentRequestV1,
    decision: "allow" | "deny",
    reasonCode: string,
  ): Promise<void> {
    await settlePortCallV1(
      () =>
        this.#repository.recordContentAudit(
          request,
          decision,
          reasonCode,
        ),
      "registry_unavailable",
      "content authorization audit could not be recorded",
    );
  }

  public async getContent(
    principal: SkillRegistryPrincipalV1,
    pathResolutionId: string,
    request: SkillContentRequestV1,
  ): Promise<SkillContentResultV1> {
    principal = canonicalPrincipalSnapshotV1(principal);
    request =
      canonicalAuthorizationInputSnapshotV1<SkillContentRequestV1>(
        request,
      );
    assertBotPrincipal(
      principal,
      request,
      "skill.content.read",
      "action_runtime",
    );
    request = canonicalRequestSnapshotV1<SkillContentRequestV1>(
      SkillContentRequestV1Schema,
      request,
      "content request does not match owner contract",
    );
    if (principal.scope.scope_kind !== "bot") {
      fail("authorization_scope_mismatch", "content requires a bot scope");
    }
    const boundRequest: SkillContentRequestV1 & {
      readonly owner_agent_id: string;
    } = {
      ...request,
      owner_agent_id:
        request.owner_agent_id ?? principal.scope.owner_agent_id,
    };
    if (
      request.schema_version !== "skill_content_request.v1" ||
      request.resolution_id !== pathResolutionId ||
      request.runtime_run_id.length === 0 ||
      request.trace_id.length === 0
    ) {
      fail("invalid_request", "content path and request bindings are invalid");
    }
    assertSha256(request.expected_package_digest, "expected_package_digest");
    assertSha256(request.expected_manifest_digest, "expected_manifest_digest");
    try {
    const now = this.#now();
    const authorization = contentAuthorizationSnapshotV1(
      await settlePortCallV1(
        () =>
          this.#repository.authorizeContent(
            boundRequest,
            now.toISOString(),
          ),
        "registry_unavailable",
        "content authorization could not be read",
      ),
    );
    const { version, resolution } = authorization;
    if (
      resolution.resolution_id !== request.resolution_id ||
      resolution.valid_until !== authorization.valid_until ||
      request.expected_package_digest !== resolution.package_digest ||
      request.expected_manifest_digest !== resolution.manifest_digest ||
      version.package_digest !== resolution.package_digest ||
      version.manifest_digest !== resolution.manifest_digest ||
      version.version_id !== resolution.version_id ||
      version.runtime_target !== resolution.runtime_target
    ) {
      fail("content_integrity_mismatch", "resolution content binding drifted");
    }
    const authorizationFingerprint =
      canonicalHashV1(authorization);
    let head: ReturnType<typeof objectHeadSnapshotV1>;
    try {
      const headAccess =
        await this.#resolveObjectAccessDecision({
          operation: "head",
          owner_service: "skill_registry",
          owner_object_id: version.owner_object_id,
          owner_state_version: version.owner_state_version,
          scope: { scope_kind: "global" },
          capability: "skill.content.read",
          object_ref: version.package_ref,
          prior_access_decision_ref:
            version.object_access_decision_ref,
          purpose: "runtime_content_read",
          trace_id: request.trace_id,
        });
      const headValue = await settlePortCallV1(
        () =>
          this.#objectStore.head({
            owner_service: "skill_registry",
            owner_object_id: version.owner_object_id,
            owner_state_version: version.owner_state_version,
            scope: { scope_kind: "global" },
            capability: "skill.content.read",
            object_ref: version.package_ref,
            access_decision_ref:
              headAccess.access_decision_ref,
            retention_policy_version:
              headAccess.retention_policy_version,
            redaction_policy_version:
              headAccess.redaction_policy_version,
          }),
        "storage_unavailable",
        "object storage metadata could not be read",
      );
      head = objectHeadSnapshotV1(headValue);
    } catch (error) {
      return errorFromUnknown(error);
    }
    if (
      head.object_ref !== version.package_ref ||
      head.sha256 !== version.package_digest ||
      head.size_bytes !== version.size_bytes ||
      head.media_type !== version.media_type
    ) {
      fail("content_integrity_mismatch", "object metadata does not match resolution");
    }
    // Close the permission/activation/revoke race opened by the metadata read.
    const preGrantAuthorization = contentAuthorizationSnapshotV1(
      await settlePortCallV1(
        () =>
          this.#repository.authorizeContent(
            boundRequest,
            this.#now().toISOString(),
          ),
        "registry_unavailable",
        "content authorization recheck failed",
      ),
    );
    if (
      canonicalHashV1(preGrantAuthorization) !==
      authorizationFingerprint
    ) {
      fail("content_integrity_mismatch", "content authorization drifted before grant");
    }
    const grantStartedAt = this.#now();
    const validUntilMs = Date.parse(preGrantAuthorization.valid_until);
    const ttlSeconds = Math.min(
      this.#contentTtlSeconds,
      Math.floor((validUntilMs - grantStartedAt.getTime()) / 1_000),
    );
    if (ttlSeconds < 1) {
      fail("resolution_expired", "resolution has expired");
    }
    let grant: ReturnType<typeof objectReadGrantSnapshotV1>;
    try {
      const grantAccess =
        await this.#resolveObjectAccessDecision({
          operation: "grant",
          owner_service: "skill_registry",
          owner_object_id: version.owner_object_id,
          owner_state_version: version.owner_state_version,
          scope: { scope_kind: "global" },
          capability: "skill.content.read",
          object_ref: version.package_ref,
          prior_access_decision_ref:
            version.object_access_decision_ref,
          purpose: "runtime_content_read",
          trace_id: request.trace_id,
        });
      const grantValue = await settlePortCallV1(
        () =>
          this.#objectStore.issueReadGrant({
            owner_service: "skill_registry",
            owner_object_id: version.owner_object_id,
            owner_state_version: version.owner_state_version,
            scope: { scope_kind: "global" },
            capability: "skill.content.read",
            object_ref: version.package_ref,
            access_decision_ref:
              grantAccess.access_decision_ref,
            retention_policy_version:
              grantAccess.retention_policy_version,
            redaction_policy_version:
              grantAccess.redaction_policy_version,
            ttl_seconds: ttlSeconds,
          }),
        "storage_unavailable",
        "object storage read grant could not be issued",
      );
      grant = objectReadGrantSnapshotV1(grantValue);
    } catch (error) {
      return errorFromUnknown(error);
    }
    const grantExpiry = Date.parse(grant.expires_at);
    const maximumExpiry = grantStartedAt.getTime() + ttlSeconds * 1_000;
    const finalizedAt = this.#now();
    const finalAuthorization = contentAuthorizationSnapshotV1(
      await settlePortCallV1(
        () =>
          this.#repository.authorizeContent(
            boundRequest,
            finalizedAt.toISOString(),
          ),
        "registry_unavailable",
        "content authorization finalization failed",
      ),
    );
    if (
      grant.object_ref !== version.package_ref ||
      canonicalHashV1(finalAuthorization) !==
        authorizationFingerprint ||
      !Number.isFinite(grantExpiry) ||
      grantExpiry <= finalizedAt.getTime() ||
      grantExpiry > maximumExpiry ||
      grantExpiry > validUntilMs ||
      grantExpiry >
        Date.parse(finalAuthorization.valid_until)
    ) {
      fail("storage_unavailable", "object store issued an invalid read grant");
    }
    const result = Object.freeze({
      content_ref: grant.grant,
      content_type: version.media_type,
      size_bytes: version.size_bytes,
      package_digest: version.package_digest,
      manifest_digest: version.manifest_digest,
      entrypoint: "SKILL.md",
      expires_at: grant.expires_at,
      runtime_target: SKILL_RUNTIME_TARGET_V1,
    });
    if (!canonicalValueCheckV1(SkillContentDetailsV1Schema, result)) {
      throw new Error(
        "Skill Registry owner returned an invalid content response",
      );
    }
    try {
      assertSkillContentResponseSemanticBindingsV1(
        request,
        {
          code: "skill_content_authorized",
          message: "skill content issued",
          retryable: false,
          trace_id: request.trace_id,
          details: result,
        },
        finalAuthorization.valid_until,
        grantStartedAt.getTime(),
      );
    } catch {
      throw new Error(
        "Skill Registry owner returned a semantically unbound content response",
      );
    }
    await this.#recordContentAudit(
      boundRequest,
      "allow",
      "content_issued",
    );
    return result;
    } catch (error) {
      await this.#recordContentAudit(
        boundRequest,
        "deny",
        error instanceof SkillRegistryApplicationErrorV1
          ? error.code
          : "registry_unavailable",
      );
      throw error;
    }
  }
}

interface StoredVersionV1 extends SkillVersionSnapshotV1 {
  readonly created_at: string;
  readonly validation_id: string;
}

interface StoredValidationFailureV1 {
  readonly validation_id: string;
  readonly artifact_ref: ObjectRefV1;
  readonly declared_package_digest: string;
  readonly media_type: string;
  readonly size_bytes: number;
  readonly status: "rejected";
  readonly error_code: ValidationFailureCommitV1["error"]["code"];
  readonly error_details: Readonly<Record<string, unknown>>;
  readonly expires_at: string;
  readonly created_by: string;
  readonly created_at: string;
}

interface StoredActivationV1 {
  readonly activation_revision_id: string;
  readonly skill_id: string;
  readonly skill_key: string;
  readonly version_id: string;
  readonly state: "active" | "disabled";
  readonly revision_no: number;
  readonly previous_activation_revision_id?: string;
}

interface StoredCatalogV1 {
  readonly catalog_revision_id: string;
  readonly catalog_version: string;
  readonly catalog_as_of: string;
  readonly entries: ReadonlyMap<string, StoredActivationV1>;
}

export interface SkillPermissionGrantV1 {
  readonly decision: "grant" | "deny";
  readonly owner_agent_condition?: string;
  readonly capability_refs: readonly string[];
}

interface StoredPermissionStateV1 extends SkillPermissionGrantV1 {
  readonly permission_revision_id: string;
  readonly revision_no: number;
  readonly scope_hash: string;
}

interface StoredCatalogCursorV1 {
  readonly cursor_id: string;
  readonly token_mac: string;
  readonly bindings: SkillCatalogCursorBindingsV1;
  readonly catalog_revision_id: string;
  readonly items: readonly SkillCatalogItemV1[];
  readonly items_hash: string;
  readonly page_size: number;
  readonly offset: number;
  readonly expires_at: string;
}

interface StoredIdempotencyV1<T> {
  readonly request_hash: string;
  readonly result: T;
}

type StoredValidationAttemptV1 = Readonly<{
  request_hash: string;
  actor_principal_id: string;
  expires_at: string;
  outcome:
    | Readonly<{ ok: true; result: SkillValidateDetailsV1 }>
    | Readonly<{
        ok: false;
        error: Readonly<{
          code: ValidationFailureCommitV1["error"]["code"];
          message: string;
          details: Readonly<Record<string, unknown>>;
        }>;
      }>;
}>;

type StoredResolutionAttemptV1 = Readonly<{
  request_hash: string;
  outcome:
    | Readonly<{ ok: true; result: SkillResolveResultV1 }>
    | Readonly<{
        ok: false;
        error: Readonly<{
          code: SkillRegistryErrorCodeV1;
          message: string;
          details: Readonly<Record<string, unknown>>;
        }>;
      }>;
}>;

interface StoredResolutionV1 extends ResolvedSkillV1 {
  readonly runtime_run_id: string;
  readonly scope: SkillRuntimeScopeV1;
  readonly security_revocation_epoch: number;
  readonly activation_revision_id: string;
}

interface StoredCandidateApplicationV1 {
  readonly request_hash: string;
  readonly idempotency_key: string;
  readonly result: SkillCandidateApplicationDetailsV1;
}

function replayed<T extends { readonly duplicate_replayed: boolean }>(
  value: T,
): T {
  return Object.freeze({ ...value, duplicate_replayed: true });
}

/**
 * Deterministic transactional conformance adapter. It is intentionally marked
 * memory so production composition cannot accidentally pass readiness.
 */
export class InMemorySkillRegistryRepositoryV1
  implements SkillRegistryApplicationRepositoryPortV1
{
  public readonly persistence_kind = "memory" as const;
  readonly #validations = new Map<string, SkillValidationRecordV1>();
  readonly #validationFailures = new Map<
    string,
    StoredValidationFailureV1
  >();
  readonly #validationConsumers = new Map<string, string>();
  readonly #versions = new Map<string, StoredVersionV1>();
  readonly #versionsBySkillAndSemver = new Map<string, string>();
  readonly #publishIdempotency = new Map<string, StoredIdempotencyV1<SkillPublishResultV1>>();
  readonly #validationIdempotency = new Map<
    string,
    StoredValidationAttemptV1
  >();
  readonly #managementIdempotency = new Map<
    string,
    StoredIdempotencyV1<SkillManagementResultV1>
  >();
  readonly #catalogCurrent = new Map<string, string>();
  readonly #catalogRevisions = new Map<string, StoredCatalogV1>();
  readonly #activationRevisions = new Map<string, StoredActivationV1>();
  readonly #activationCurrent = new Map<string, string>();
  readonly #permissions = new Map<string, StoredPermissionStateV1>();
  readonly #permissionRevisions = new Map<
    string,
    StoredPermissionStateV1
  >();
  readonly #summaries = new Map<string, SkillPermissionSummaryV1>();
  readonly #resolutionAttempts = new Map<string, StoredResolutionAttemptV1>();
  readonly #resolutions = new Map<string, StoredResolutionV1>();
  readonly #candidateApplications = new Map<
    string,
    StoredCandidateApplicationV1
  >();
  readonly #candidateApplicationIdempotency = new Map<string, string>();
  readonly #candidateReviewOwners = new Map<string, string>();
  readonly #catalogCursors = new Map<string, StoredCatalogCursorV1>();
  readonly #audit: unknown[] = [];
  readonly #outbox: SkillRegistryDomainEventV1[] = [];
  readonly #cursorMacKey = randomBytes(32);
  #securityEpoch = 0;
  #sequence = 0;
  #tail: Promise<void> = Promise.resolve();

  public async checkReadiness(): Promise<void> {}

  async #locked<T>(operation: () => T | Promise<T>): Promise<T> {
    let release!: () => void;
    const previous = this.#tail;
    this.#tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  #id(prefix: string): string {
    this.#sequence = nextSkillCounterV1(
      this.#sequence,
      "repository sequence",
    );
    return `${prefix}_${this.#sequence}`;
  }

  #domainEvent(
    eventType: SkillRegistryDomainEventV1["event_type"],
    idempotencyKey: string,
    occurredAt: string,
    traceId: string,
    payload: Readonly<Record<string, unknown>>,
  ): SkillRegistryDomainEventV1 {
    const candidate = {
      event_id: this.#id("skill_event"),
      event_type: eventType,
      schema_version: "skill_registry_event.v1",
      producer: "skill_registry",
      occurred_at: occurredAt,
      idempotency_key: idempotencyKey,
      trace_id: traceId,
      payload,
    };
    if (
      !canonicalValueCheckV1(
        SkillRegistryDomainEventV1Schema,
        candidate,
      )
    ) {
      throw new Error(
        `Skill Registry owner generated an invalid ${eventType} event`,
      );
    }
    const event = candidate as SkillRegistryDomainEventV1;
    assertSkillRegistryDomainEventSemanticBindingsV1(event);
    return structuredClone(event);
  }

  #cursorMac(input: {
    readonly cursor_id: string;
    readonly bindings: SkillCatalogCursorBindingsV1;
    readonly catalog_revision_id: string;
    readonly items_hash: string;
    readonly page_size: number;
    readonly offset: number;
    readonly expires_at: string;
  }): string {
    return createHmac("sha256", this.#cursorMacKey)
      .update(canonicalJsonV1(input))
      .digest("hex");
  }

  #prepareCursor(
    bindings: SkillCatalogCursorBindingsV1,
    catalogRevisionId: string,
    items: readonly SkillCatalogItemV1[],
    pageSize: number,
    offset: number,
    expiresAt: string,
  ): Readonly<{
    token: string;
    cursor: StoredCatalogCursorV1;
  }> {
    const cursorId = `catalog_cursor_${randomBytes(18).toString("hex")}`;
    const itemsHash = canonicalHashV1(items);
    const tokenMac = this.#cursorMac({
      cursor_id: cursorId,
      bindings,
      catalog_revision_id: catalogRevisionId,
      items_hash: itemsHash,
      page_size: pageSize,
      offset,
      expires_at: expiresAt,
    });
    return Object.freeze({
      token: `${cursorId}.${tokenMac}`,
      cursor: Object.freeze({
        cursor_id: cursorId,
        token_mac: tokenMac,
        bindings: Object.freeze({ ...bindings }),
        catalog_revision_id: catalogRevisionId,
        items: Object.freeze(items.map((item) => Object.freeze({
          ...item,
          capability_refs: [...item.capability_refs],
        }))),
        items_hash: itemsHash,
        page_size: pageSize,
        offset,
        expires_at: expiresAt,
      }),
    });
  }

  #readCursor(token: string, now: string): StoredCatalogCursorV1 {
    const separator = token.lastIndexOf(".");
    if (
      separator <= 0 ||
      separator === token.length - 1 ||
      token.indexOf(".") !== separator
    ) {
      fail("invalid_cursor", "catalog cursor is malformed", {
        reason: "malformed",
        restart_from_first_page: true,
      });
    }
    const cursorId = token.slice(0, separator);
    const presentedMac = token.slice(separator + 1);
    const cursor = this.#catalogCursors.get(cursorId);
    if (
      cursor === undefined ||
      !/^[0-9a-f]{64}$/u.test(presentedMac)
    ) {
      fail("invalid_cursor", "catalog cursor is malformed", {
        reason: "malformed",
        restart_from_first_page: true,
      });
    }
    const expectedMac = this.#cursorMac({
      cursor_id: cursor.cursor_id,
      bindings: cursor.bindings,
      catalog_revision_id: cursor.catalog_revision_id,
      items_hash: cursor.items_hash,
      page_size: cursor.page_size,
      offset: cursor.offset,
      expires_at: cursor.expires_at,
    });
    const presentedBytes = Buffer.from(presentedMac, "hex");
    const expectedBytes = Buffer.from(expectedMac, "hex");
    if (
      presentedBytes.byteLength !== expectedBytes.byteLength ||
      !timingSafeEqual(presentedBytes, expectedBytes) ||
      presentedMac !== cursor.token_mac ||
      canonicalHashV1(cursor.items) !== cursor.items_hash
    ) {
      fail("invalid_cursor", "catalog cursor is malformed", {
        reason: "malformed",
        restart_from_first_page: true,
      });
    }
    if (Date.parse(cursor.expires_at) <= Date.parse(now)) {
      this.#catalogCursors.delete(cursorId);
      fail("invalid_cursor", "catalog cursor expired", {
        reason: "expired",
        restart_from_first_page: true,
      });
    }
    return cursor;
  }

  #effectivePermission(
    scope: SkillRuntimeScopeV1,
    skillId: string,
  ): StoredPermissionStateV1 | undefined {
    const general = this.#permissions.get(
      permissionStorageKey(scope, skillId),
    );
    const ownerSpecific = this.#permissions.get(
      permissionStorageKey(scope, skillId, scope.owner_agent_id),
    );
    if (general?.decision === "deny") return general;
    if (ownerSpecific?.decision === "deny") return ownerSpecific;
    return ownerSpecific ?? general;
  }

  public seedValidation(record: SkillValidationRecordV1): void {
    this.#validations.set(record.validation_id, structuredClone(record));
  }

  public seedCatalog(
    scope: SkillCatalogScopeV1,
    catalogVersion: string,
    catalogAsOf: string,
  ): void {
    const key = scopeKey(scope);
    const catalog: StoredCatalogV1 = {
      catalog_revision_id: this.#id("catalog_revision"),
      catalog_version: catalogVersion,
      catalog_as_of: catalogAsOf,
      entries: new Map(),
    };
    this.#catalogRevisions.set(`${key}\u0000${catalogVersion}`, catalog);
    this.#catalogCurrent.set(key, catalogVersion);
  }

  public seedActivationState(
    scope: SkillCatalogScopeV1,
    skillKey: string,
    state: StoredActivationV1["state"],
    catalogVersion: string,
    catalogAsOf: string,
  ): void {
    const key = scopeKey(scope);
    const currentCatalogVersion = this.#catalogCurrent.get(key);
    const currentCatalog =
      currentCatalogVersion === undefined
        ? undefined
        : this.#catalogRevisions.get(
            `${key}\u0000${currentCatalogVersion}`,
          );
    const activationKey = activationStorageKey(scope, skillKey);
    const currentActivationId = this.#activationCurrent.get(activationKey);
    const currentActivation =
      currentActivationId === undefined
        ? currentCatalog?.entries.get(skillKey)
        : this.#activationRevisions.get(currentActivationId);
    if (currentCatalog === undefined || currentActivation === undefined) {
      throw new Error("activation fixture was not found");
    }
    const activation = Object.freeze({
      ...currentActivation,
      activation_revision_id: this.#id("activation_revision"),
      state,
      previous_activation_revision_id:
        currentActivation.activation_revision_id,
      revision_no: nextSkillCounterV1(
        currentActivation.revision_no,
        "activation revision",
      ),
    });
    const entries = new Map(currentCatalog.entries);
    if (state === "active") entries.set(skillKey, activation);
    else entries.delete(skillKey);
    const catalog = Object.freeze({
      catalog_revision_id: this.#id("catalog_revision"),
      catalog_version: catalogVersion,
      catalog_as_of: catalogAsOf,
      entries,
    });
    this.#activationRevisions.set(
      activation.activation_revision_id,
      activation,
    );
    this.#activationCurrent.set(
      activationKey,
      activation.activation_revision_id,
    );
    this.#catalogRevisions.set(`${key}\u0000${catalogVersion}`, catalog);
    this.#catalogCurrent.set(key, catalogVersion);
  }

  public catalogIdentity(scope: SkillCatalogScopeV1): Readonly<{
    catalog_revision_id: string;
    catalog_version: string;
    catalog_as_of: string;
  }> {
    const key = scopeKey(scope);
    const currentVersion = this.#catalogCurrent.get(key);
    const catalog =
      currentVersion === undefined
        ? undefined
        : this.#catalogRevisions.get(`${key}\u0000${currentVersion}`);
    if (catalog === undefined) throw new Error("catalog not found");
    return Object.freeze({
      catalog_revision_id: catalog.catalog_revision_id,
      catalog_version: catalog.catalog_version,
      catalog_as_of: catalog.catalog_as_of,
    });
  }

  public seedPermission(
    scope: SkillCatalogScopeV1,
    skillId: string,
    permission: SkillPermissionGrantV1,
  ): void {
    const key = permissionStorageKey(
      scope,
      skillId,
      permission.owner_agent_condition,
    );
    const current = this.#permissions.get(key);
    const revision: StoredPermissionStateV1 = Object.freeze({
      ...structuredClone(permission),
      permission_revision_id: this.#id("permission_revision"),
      revision_no: nextSkillCounterV1(
        current?.revision_no ?? 0,
        "permission revision",
      ),
      scope_hash: skillPermissionScopeHashV1({
        ...scope,
        skill_id: skillId,
        ...(permission.owner_agent_condition === undefined
          ? {}
          : { owner_agent_id: permission.owner_agent_condition }),
      }),
    });
    this.#permissionRevisions.set(
      revision.permission_revision_id,
      revision,
    );
    this.#permissions.set(key, revision);
  }

  public seedPermissionSummary(
    summaryWithoutHash: Omit<SkillPermissionSummaryV1, "summary_hash">,
  ): SkillPermissionSummaryV1 {
    const summary: SkillPermissionSummaryV1 = {
      ...structuredClone(summaryWithoutHash),
      summary_hash: canonicalHashV1(summaryWithoutHash),
    };
    this.#summaries.set(summary.summary_ref, summary);
    return structuredClone(summary);
  }

  public setVersionLifecycle(
    versionId: string,
    lifecycleState: StoredVersionV1["lifecycle_state"],
  ): void {
    const version = this.#versions.get(versionId);
    if (version === undefined) throw new Error("version not found");
    const nextLifecycleVersion = nextSkillCounterV1(
      version.lifecycle_version,
      "skill lifecycle version",
    );
    const nextSecurityEpoch =
      lifecycleState === "revoked"
        ? nextSkillCounterV1(
            this.#securityEpoch,
            "security revocation epoch",
          )
        : this.#securityEpoch;
    this.#versions.set(versionId, {
      ...version,
      lifecycle_state: lifecycleState,
      lifecycle_version: nextLifecycleVersion,
    });
    this.#securityEpoch = nextSecurityEpoch;
  }

  public setSecurityRevocationEpoch(epoch: number): void {
    if (!Number.isSafeInteger(epoch) || epoch < this.#securityEpoch) {
      throw new Error("security epoch must be monotonic");
    }
    this.#securityEpoch = epoch;
  }

  public get auditRecords(): readonly unknown[] {
    return structuredClone(this.#audit);
  }

  public get outboxRecords(): readonly SkillRegistryDomainEventV1[] {
    return structuredClone(this.#outbox);
  }

  public get activationCount(): number {
    let count = 0;
    for (const [key, version] of this.#catalogCurrent) {
      count +=
        this.#catalogRevisions.get(`${key}\u0000${version}`)?.entries.size ??
        0;
    }
    return count;
  }

  public get permissionRevisionCount(): number {
    return this.#permissionRevisions.size;
  }

  public get validationFailureCount(): number {
    return this.#validationFailures.size;
  }

  public async replayValidation(
    request: SkillValidateRequestV1,
    requestHash: string,
    actorPrincipalId: string,
    now: string,
  ): Promise<SkillValidateDetailsV1 | undefined> {
    return this.#locked(() => {
      const existing = this.#validationIdempotency.get(
        request.idempotency_key,
      );
      if (existing === undefined) return undefined;
      if (
        existing.request_hash !== requestHash ||
        existing.actor_principal_id !== actorPrincipalId
      ) {
        fail("idempotency_conflict", "validation idempotency body drift");
      }
      if (Date.parse(now) >= Date.parse(existing.expires_at)) {
        fail(
          "validation_expired",
          "validation idempotency outcome has expired",
        );
      }
      if (!existing.outcome.ok) {
        throw new SkillRegistryApplicationErrorV1(
          existing.outcome.error.code,
          existing.outcome.error.message,
          existing.outcome.error.details,
        );
      }
      return structuredClone(existing.outcome.result);
    });
  }

  public async commitValidation(
    commit: ValidationCommitV1,
  ): Promise<SkillValidateDetailsV1> {
    return this.#locked(() => {
      const existing = this.#validationIdempotency.get(
        commit.request.idempotency_key,
      );
      if (existing !== undefined) {
        if (
          existing.request_hash !== commit.request_hash ||
          existing.actor_principal_id !== commit.actor_principal_id
        ) {
          fail("idempotency_conflict", "validation idempotency body drift");
        }
        if (Date.parse(commit.now) >= Date.parse(existing.expires_at)) {
          fail(
            "validation_expired",
            "validation idempotency outcome has expired",
          );
        }
        if (!existing.outcome.ok) {
          throw new SkillRegistryApplicationErrorV1(
            existing.outcome.error.code,
            existing.outcome.error.message,
            existing.outcome.error.details,
          );
        }
        return structuredClone(existing.outcome.result);
      }
      if (
        commit.request.artifact_ref !== commit.artifact.artifact_ref ||
        commit.request.content_digest !== commit.package_digest ||
        commit.request.media_type !== commit.artifact.media_type ||
        commit.request.size_bytes !== commit.size_bytes ||
        Date.parse(commit.expires_at) <= Date.parse(commit.now)
      ) {
        fail(
          "content_integrity_mismatch",
          "validated artifact drifted before owner commit",
        );
      }
      const validationId = this.#id("sval");
      const record: SkillValidationRecordV1 = Object.freeze({
        validation_id: validationId,
        staging_state_version: 1,
        skill_id: commit.artifact.skill_id,
        skill_name: commit.artifact.skill_name,
        proposed_version: commit.artifact.proposed_version,
        artifact_ref: commit.artifact.artifact_ref,
        object_access_decision_ref:
          commit.artifact.object_access_decision_ref,
        owner_object_id: commit.artifact.owner_object_id,
        owner_state_version: commit.artifact.owner_state_version,
        package_digest: commit.package_digest,
        manifest_digest: commit.manifest_digest,
        manifest: structuredClone(commit.manifest),
        runtime_target: SKILL_RUNTIME_TARGET_V1,
        status: "approved",
        expires_at: commit.expires_at,
        media_type: commit.artifact.media_type,
        size_bytes: commit.size_bytes,
        provenance: structuredClone(commit.artifact.provenance),
        validation_result: structuredClone(
          commit.artifact.validation_result,
        ),
        scanner_versions: structuredClone(
          commit.artifact.scanner_versions,
        ),
        created_by: commit.actor_principal_id,
      });
      const result: SkillValidateDetailsV1 = Object.freeze({
        validation_id: validationId,
        package_digest: commit.package_digest,
        manifest_digest: commit.manifest_digest,
        normalized_manifest: structuredClone(commit.manifest),
        diagnostics: commit.artifact.diagnostics.map((diagnostic) => ({
          ...diagnostic,
        })),
        expires_at: commit.expires_at,
      });
      if (!canonicalValueCheckV1(SkillValidateDetailsV1Schema, result)) {
        throw new Error(
          "Skill Registry owner generated an invalid validation result",
        );
      }
      assertSkillValidateResponseSemanticBindingsV1(commit.request, {
        code: "skill_package_validated",
        message: "skill package validated",
        retryable: false,
        trace_id: commit.request.trace_id,
        details: result,
      });
      this.#validations.set(validationId, record);
      this.#validationIdempotency.set(commit.request.idempotency_key, {
        request_hash: commit.request_hash,
        actor_principal_id: commit.actor_principal_id,
        expires_at: commit.expires_at,
        outcome: { ok: true, result },
      });
      this.#audit.push({
        action: "skill.package.validated",
        validation_id: validationId,
        artifact_ref: commit.artifact.artifact_ref,
        package_digest: commit.package_digest,
        manifest_digest: commit.manifest_digest,
        actor_principal_id: commit.actor_principal_id,
        trace_id: commit.request.trace_id,
      });
      return structuredClone(result);
    });
  }

  public async recordValidationFailure(
    commit: ValidationFailureCommitV1,
  ): Promise<SkillValidateDetailsV1 | undefined> {
    return this.#locked(() => {
      const existing = this.#validationIdempotency.get(
        commit.request.idempotency_key,
      );
      if (existing !== undefined) {
        if (
          existing.request_hash !== commit.request_hash ||
          existing.actor_principal_id !== commit.actor_principal_id
        ) {
          fail("idempotency_conflict", "validation idempotency body drift");
        }
        if (Date.parse(commit.now) >= Date.parse(existing.expires_at)) {
          fail(
            "validation_expired",
            "validation idempotency outcome has expired",
          );
        }
        if (existing.outcome.ok) {
          return structuredClone(existing.outcome.result);
        }
        throw new SkillRegistryApplicationErrorV1(
          existing.outcome.error.code,
          existing.outcome.error.message,
          structuredClone(existing.outcome.error.details),
        );
      }

      const validationId = this.#id("sval");
      const storedError = Object.freeze({
        code: commit.error.code,
        message: commit.error.message,
        details: Object.freeze(structuredClone(commit.error.details)),
      });
      this.#validationFailures.set(
        validationId,
        Object.freeze({
          validation_id: validationId,
          artifact_ref: commit.request.artifact_ref as ObjectRefV1,
          declared_package_digest: commit.request.content_digest,
          media_type: commit.request.media_type,
          size_bytes: commit.request.size_bytes,
          status: "rejected",
          error_code: storedError.code,
          error_details: storedError.details,
          expires_at: commit.expires_at,
          created_by: commit.actor_principal_id,
          created_at: commit.now,
        }),
      );
      this.#validationIdempotency.set(commit.request.idempotency_key, {
        request_hash: commit.request_hash,
        actor_principal_id: commit.actor_principal_id,
        expires_at: commit.expires_at,
        outcome: { ok: false, error: storedError },
      });
      this.#audit.push({
        action: "skill.package.validation_rejected",
        validation_id: validationId,
        artifact_ref: commit.request.artifact_ref,
        package_digest: commit.request.content_digest,
        error_code: storedError.code,
        actor_principal_id: commit.actor_principal_id,
        trace_id: commit.request.trace_id,
      });
      return undefined;
    });
  }

  public async readValidation(
    validationId: string,
  ): Promise<SkillValidationRecordV1 | undefined> {
    const value = this.#validations.get(validationId);
    return value === undefined ? undefined : structuredClone(value);
  }

  public async applyCandidateApplication(
    commit: CandidateApplicationCommitV1,
  ): Promise<SkillCandidateApplicationDetailsV1> {
    return this.#locked(() => {
      const candidateReviewKey = canonicalJsonV1({
        workspace_id: commit.request.workspace_id,
        bot_id: commit.request.bot_id,
        owner_agent_id: commit.request.owner_agent_id,
        deployment_environment:
          commit.request.deployment_environment,
        release_channel: commit.request.release_channel,
        candidate_id: commit.request.candidate_id,
        review_version: commit.request.review_version,
      });
      const idempotentApplicationId =
        this.#candidateApplicationIdempotency.get(
          commit.request.idempotency_key,
        );
      if (
        idempotentApplicationId !== undefined &&
        idempotentApplicationId !== commit.request.application_id
      ) {
        fail(
          "idempotency_conflict",
          "candidate application idempotency identity drift",
        );
      }
      const reviewApplicationId =
        this.#candidateReviewOwners.get(candidateReviewKey);
      if (
        reviewApplicationId !== undefined &&
        reviewApplicationId !== commit.request.application_id
      ) {
        fail(
          "idempotency_conflict",
          "candidate review version already owns another application",
        );
      }
      const existing = this.#candidateApplications.get(
        commit.request.application_id,
      );
      if (existing !== undefined) {
        if (
          existing.idempotency_key !== commit.request.idempotency_key ||
          existing.request_hash !== commit.request_hash
        ) {
          fail(
            "idempotency_conflict",
            "candidate application request body drift",
          );
        }
        return replayed(existing.result);
      }
      const currentCatalogVersion = this.#catalogCurrent.get(
        scopeKey(commit.request),
      );
      if (
        currentCatalogVersion === undefined ||
        currentCatalogVersion !==
          commit.request.baseline_catalog_version
      ) {
        fail(
          "catalog_version_conflict",
          "candidate application baseline catalog is stale",
          {
            requested_catalog_version:
              commit.request.baseline_catalog_version,
            current_catalog_version:
              currentCatalogVersion ?? null,
            conflict_reason: "candidate_baseline_stale",
          },
        );
      }

      const responseRef =
        `skill-candidate-response:${commit.request.application_id}:${commit.request.review_version}`;
      const lifecycle =
        commit.request.candidate_type === "deprecation"
          ? {
              status: "deprecation_review_created" as const,
              review_ref:
                `skill-deprecation-review:${commit.request.application_id}`,
            }
          : {
              // A proposal reference is not a validated Skill package. Keep
              // the application received until a durable validation worker
              // has fetched, scanned, inspected and committed the staging
              // artifact through the owner writer.
              status: "received" as const,
            };
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
      const result: SkillCandidateApplicationDetailsV1 = Object.freeze({
        application_id: commit.request.application_id,
        ...lifecycle,
        response_ref: responseRef,
        response_hash: responseHash,
        duplicate_replayed: false,
      });
      const candidateEvent = this.#domainEvent(
        "skill.candidate.application.updated",
        `skill_candidate_application_updated:${commit.request.application_id}:${commit.request.review_version}`,
        commit.now,
        commit.request.trace_id,
        {
          scope_kind: "provenance",
          workspace_id: commit.request.workspace_id,
          bot_id: commit.request.bot_id,
          owner_agent_id: commit.request.owner_agent_id,
          deployment_environment:
            commit.request.deployment_environment,
          release_channel: commit.request.release_channel,
          actor_principal_id: commit.actor_principal_id,
          reason_code: "candidate_application",
          application_id: commit.request.application_id,
          candidate_id: commit.request.candidate_id,
          review_version: commit.request.review_version,
          candidate_type: commit.request.candidate_type,
          skill_key: commit.request.skill_key,
          status: result.status,
          ...(result.staging_version_id === undefined
            ? {}
            : {
                staging_version_id:
                  result.staging_version_id,
              }),
          ...(result.review_ref === undefined
            ? {}
            : { review_ref: result.review_ref }),
          response_ref: result.response_ref,
          response_hash: result.response_hash,
        },
      );
      this.#candidateApplications.set(commit.request.application_id, {
        request_hash: commit.request_hash,
        idempotency_key: commit.request.idempotency_key,
        result,
      });
      this.#candidateApplicationIdempotency.set(
        commit.request.idempotency_key,
        commit.request.application_id,
      );
      this.#candidateReviewOwners.set(
        candidateReviewKey,
        commit.request.application_id,
      );
      this.#audit.push({
        action: "skill.candidate.application.updated",
        application_id: commit.request.application_id,
        candidate_id: commit.request.candidate_id,
        actor_principal_id: commit.actor_principal_id,
        trace_id: commit.request.trace_id,
      });
      this.#outbox.push(candidateEvent);
      return result;
    });
  }

  public async replayPublish(
    request: SkillPublishRequestV1,
    requestHash: string,
  ): Promise<SkillPublishResultV1 | undefined> {
    return this.#locked(() => {
      const existing = this.#publishIdempotency.get(request.idempotency_key);
      if (existing === undefined) return undefined;
      if (existing.request_hash !== requestHash) {
        fail("idempotency_conflict", "publish idempotency body drift");
      }
      return replayed(existing.result);
    });
  }

  public async publishVersion(
    commit: PublishCommitV1,
  ): Promise<SkillPublishResultV1> {
    return this.#locked(() => {
      const existing = this.#publishIdempotency.get(commit.request.idempotency_key);
      if (existing !== undefined) {
        if (existing.request_hash !== commit.request_hash) {
          fail("idempotency_conflict", "publish idempotency body drift");
        }
        return replayed(existing.result);
      }
      const currentValidation = this.#validations.get(commit.validation.validation_id);
      if (currentValidation === undefined) {
        fail("validation_not_found", "approved validation was not found");
      }
      if (
        canonicalHashV1(currentValidation) !== canonicalHashV1(commit.validation) ||
        currentValidation.status !== "approved" ||
        Date.parse(currentValidation.expires_at) <= Date.parse(commit.now)
      ) {
        fail("validation_expired", "validation changed or expired before commit");
      }
      if (
        currentValidation.skill_name !== commit.request.skill_name ||
        currentValidation.proposed_version !== commit.request.semver ||
        currentValidation.artifact_ref !==
          commit.request.artifact_ref ||
        currentValidation.package_digest !==
          commit.request.package_digest ||
        currentValidation.manifest_digest !==
          commit.request.manifest_digest
      ) {
        fail(
          "content_integrity_mismatch",
          "publish request drifted from the approved validation",
        );
      }
      const consumer = this.#validationConsumers.get(currentValidation.validation_id);
      if (consumer !== undefined) {
        fail("validation_already_published", "validation was consumed by another request", {
          skill_version_id: consumer,
        });
      }
      if (
        commit.verified.package_digest !== currentValidation.package_digest ||
        commit.verified.manifest_digest !== currentValidation.manifest_digest ||
        commit.verified.size_bytes !== currentValidation.size_bytes
      ) {
        fail("content_integrity_mismatch", "verified artifact drifted before commit");
      }
      const versionKey = `${currentValidation.skill_id}\u0000${commit.request.semver}`;
      if (this.#versionsBySkillAndSemver.has(versionKey)) {
        fail("version_not_publishable", "skill version already exists");
      }
      const versionId = this.#id("skv");
      const version: StoredVersionV1 = {
        skill_id: currentValidation.skill_id,
        skill_key: currentValidation.skill_name,
        skill_name: currentValidation.skill_name,
        version_id: versionId,
        version: commit.request.semver,
        lifecycle_state: "published",
        lifecycle_version: 1,
        package_digest: currentValidation.package_digest,
        manifest_digest: currentValidation.manifest_digest,
        runtime_target: SKILL_RUNTIME_TARGET_V1,
        package_ref: currentValidation.artifact_ref,
        object_access_decision_ref: currentValidation.object_access_decision_ref,
        owner_object_id: currentValidation.owner_object_id,
        owner_state_version: currentValidation.owner_state_version,
        media_type: currentValidation.media_type,
        size_bytes: currentValidation.size_bytes,
        retention_state: "retained",
        created_at: commit.now,
        validation_id: currentValidation.validation_id,
      };
      const result: SkillPublishResultV1 = Object.freeze({
        skill_version_id: versionId,
        skill_name: currentValidation.skill_name,
        version: commit.request.semver,
        state: "published",
        package_digest: currentValidation.package_digest,
        manifest_digest: currentValidation.manifest_digest,
        runtime_target: SKILL_RUNTIME_TARGET_V1,
        created_at: commit.now,
        duplicate_replayed: false,
      });
      if (!canonicalValueCheckV1(SkillPublishDetailsV1Schema, result)) {
        throw new Error(
          "Skill Registry owner generated an invalid publish result",
        );
      }
      assertSkillPublishSemanticBindingsV1(commit.request, {
        code: "skill_version_published",
        message: "skill version published",
        retryable: false,
        trace_id: commit.request.trace_id,
        details: result,
      });
      const publishEvent = this.#domainEvent(
        "skill.version.published",
        `skill_version_published:${versionId}`,
        commit.now,
        commit.request.trace_id,
        {
          scope_kind: "global",
          actor_principal_id: commit.actor_principal_id,
          reason_code: "publish",
          skill_id: version.skill_id,
          skill_key: version.skill_key,
          version_id: version.version_id,
          version: version.version,
          lifecycle_version: version.lifecycle_version,
          package_digest: version.package_digest,
          manifest_digest: version.manifest_digest,
          published_at: commit.now,
        },
      );
      // These mutations model one owner-writer transaction.
      this.#versions.set(versionId, version);
      this.#versionsBySkillAndSemver.set(versionKey, versionId);
      this.#validationConsumers.set(currentValidation.validation_id, versionId);
      this.#audit.push({
        action: "skill.version.published",
        version_id: versionId,
        actor_principal_id: commit.actor_principal_id,
        trace_id: commit.request.trace_id,
      });
      this.#outbox.push(publishEvent);
      this.#publishIdempotency.set(commit.request.idempotency_key, {
        request_hash: commit.request_hash,
        result,
      });
      return result;
    });
  }

  public async executeManagement(
    commit: ManagementCommitV1,
  ): Promise<SkillManagementResultV1> {
    return this.#locked(() => {
      const idempotencyNamespace =
        skillManagementIdempotencyNamespaceV1(commit.request);
      const idempotencyKey =
        `${idempotencyNamespace}\u0000${commit.request.idempotency_key}`;
      const existing = this.#managementIdempotency.get(idempotencyKey);
      if (existing !== undefined) {
        if (existing.request_hash !== commit.request_hash) {
          fail("idempotency_conflict", "management idempotency body drift");
        }
        return replayed(existing.result);
      }

      if (commit.request.scope_kind === "global") {
        const version = this.#versions.get(commit.request.version_id);
        if (
          version === undefined ||
          version.skill_id !== commit.request.skill_id ||
          version.skill_key !== commit.skill_key
        ) {
          fail("version_not_publishable", "lifecycle target was not found");
        }
        if (
          version.lifecycle_version !==
          commit.request.expected_lifecycle_version
        ) {
          fail("lifecycle_conflict", "expected lifecycle version is stale", {
            current_lifecycle_version: version.lifecycle_version,
          });
        }
        if (
          (commit.request.operation === "deprecate" &&
            version.lifecycle_state !== "published") ||
          (commit.request.operation === "revoke" &&
            version.lifecycle_state === "revoked")
        ) {
          fail(
            "invalid_state_transition",
            "requested lifecycle transition is not permitted",
          );
        }
        const previousLifecycleVersion = version.lifecycle_version;
        const nextLifecycleVersion = nextSkillCounterV1(
          previousLifecycleVersion,
          "skill lifecycle version",
        );
        const lifecycleState =
          commit.request.operation === "deprecate"
            ? ("deprecated" as const)
            : ("revoked" as const);
        const previousSecurityEpoch = this.#securityEpoch;
        const nextSecurityEpoch =
          commit.request.operation === "revoke" &&
          commit.request.emergency
            ? nextSkillCounterV1(
                previousSecurityEpoch,
                "security revocation epoch",
              )
            : previousSecurityEpoch;
        const commandId = this.#id("skill_command");
        const nextVersion: StoredVersionV1 = Object.freeze({
          ...version,
          lifecycle_state: lifecycleState,
          lifecycle_version: nextLifecycleVersion,
        });
        const result = Object.freeze({
          scope_kind: "global" as const,
          operation: commit.request.operation,
          command_id: commandId,
          skill_id: version.skill_id,
          version_id: version.version_id,
          previous_lifecycle_version: previousLifecycleVersion,
          new_lifecycle_version: nextLifecycleVersion,
          lifecycle_state: lifecycleState,
          security_revocation_epoch: nextSecurityEpoch,
          duplicate_replayed: false,
        }) as SkillManagementResultV1;
        assertGeneratedManagementResult(commit.request, result);
        const versionEventType =
          commit.request.operation === "deprecate"
            ? "skill.version.deprecated"
            : "skill.version.revoked";
        const versionEvent = this.#domainEvent(
          versionEventType,
          `version:${version.version_id}:${commit.request.operation}:${nextLifecycleVersion}`,
          commit.now,
          commit.request.trace_id,
          {
            scope_kind: "global",
            skill_id: version.skill_id,
            skill_key: version.skill_key,
            version_id: version.version_id,
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
          },
        );
        const epochEvent =
          commit.request.operation === "revoke" &&
          commit.request.emergency
            ? this.#domainEvent(
                "skill.security_revocation_epoch.changed",
                `security_epoch:${nextSecurityEpoch}`,
                commit.now,
                commit.request.trace_id,
                {
                  scope_kind: "global",
                  previous_security_revocation_epoch:
                    previousSecurityEpoch,
                  security_revocation_epoch: nextSecurityEpoch,
                  affected_skill_ids: [version.skill_id],
                  affected_version_ids: [version.version_id],
                  emergency: true,
                  actor_principal_id: commit.actor_principal_id,
                  reason_code: "emergency_revoke",
                },
              )
            : undefined;

        this.#versions.set(version.version_id, nextVersion);
        this.#securityEpoch = nextSecurityEpoch;
        this.#audit.push({
          action: versionEventType,
          scope_kind: "global",
          command_id: commandId,
          skill_id: version.skill_id,
          version_id: version.version_id,
          previous_lifecycle_version: previousLifecycleVersion,
          lifecycle_version: nextLifecycleVersion,
          security_revocation_epoch: nextSecurityEpoch,
          actor_principal_id: commit.actor_principal_id,
          reason: commit.request.reason,
          trace_id: commit.request.trace_id,
        });
        this.#outbox.push(versionEvent);
        if (epochEvent !== undefined) this.#outbox.push(epochEvent);
        this.#managementIdempotency.set(idempotencyKey, {
          request_hash: commit.request_hash,
          result,
        });
        return result;
      }

      const catalogKey = scopeKey(commit.request);
      const currentCatalogVersion = this.#catalogCurrent.get(catalogKey);
      const catalog =
        currentCatalogVersion === undefined
          ? undefined
          : this.#catalogRevisions.get(
              `${catalogKey}\u0000${currentCatalogVersion}`,
            );
      if (
        catalog === undefined ||
        catalog.catalog_version !==
          commit.request.expected_catalog_version
      ) {
        fail("catalog_version_conflict", "expected catalog version is stale", {
          requested_catalog_version:
            commit.request.expected_catalog_version,
          current_catalog_version: catalog?.catalog_version ?? null,
          conflict_reason: "management_expected_catalog_stale",
        });
      }

      if (commit.request.operation === "disable") {
        const activationKey = activationStorageKey(
          commit.request,
          commit.skill_key,
        );
        const currentActivationId =
          this.#activationCurrent.get(activationKey);
        const current =
          currentActivationId === undefined
            ? catalog.entries.get(commit.skill_key)
            : this.#activationRevisions.get(currentActivationId);
        if (
          (current?.activation_revision_id ?? "none") !==
          commit.request.expected_activation_revision
        ) {
          fail("activation_conflict", "expected activation revision is stale", {
            current_activation_revision:
              current?.activation_revision_id ?? "none",
          });
        }
        if (
          current === undefined ||
          current.state !== "active" ||
          current.skill_id !== commit.request.skill_id
        ) {
          fail(
            "invalid_state_transition",
            "disable requires the current active activation",
          );
        }
        const version = this.#versions.get(current.version_id);
        if (
          version === undefined ||
          version.skill_id !== commit.request.skill_id ||
          version.skill_key !== commit.skill_key
        ) {
          fail("version_not_publishable", "active version was not found");
        }

        const activationRevisionId = this.#id("activation_revision");
        const nextActivation: StoredActivationV1 = Object.freeze({
          activation_revision_id: activationRevisionId,
          skill_id: current.skill_id,
          skill_key: current.skill_key,
          version_id: current.version_id,
          state: "disabled",
          revision_no: nextSkillCounterV1(
            current.revision_no,
            "activation revision",
          ),
          previous_activation_revision_id:
            current.activation_revision_id,
        });
        const nextCatalogVersion = this.#id("cat");
        const nextCatalogRevisionId = this.#id("catalog_revision");
        const nextEntries = new Map(catalog.entries);
        nextEntries.delete(commit.skill_key);
        const nextCatalog: StoredCatalogV1 = Object.freeze({
          catalog_revision_id: nextCatalogRevisionId,
          catalog_version: nextCatalogVersion,
          catalog_as_of: commit.now,
          entries: nextEntries,
        });
        const commandId = this.#id("skill_command");
        const result = Object.freeze({
          scope_kind: "scoped" as const,
          operation: "disable" as const,
          workspace_id: commit.request.workspace_id,
          bot_id: commit.request.bot_id,
          deployment_environment:
            commit.request.deployment_environment,
          release_channel: commit.request.release_channel,
          command_id: commandId,
          previous_revision: current.activation_revision_id,
          new_revision: activationRevisionId,
          catalog_version: nextCatalogVersion,
          security_revocation_epoch: this.#securityEpoch,
          duplicate_replayed: false,
        });
        assertGeneratedManagementResult(commit.request, result);
        const disabledEvent = this.#domainEvent(
          "skill.activation.disabled",
          `activation:${activationRevisionId}:disabled`,
          commit.now,
          commit.request.trace_id,
          {
            scope_kind: "scoped",
            workspace_id: commit.request.workspace_id,
            bot_id: commit.request.bot_id,
            deployment_environment:
              commit.request.deployment_environment,
            release_channel: commit.request.release_channel,
            skill_id: version.skill_id,
            skill_key: version.skill_key,
            version_id: version.version_id,
            version: version.version,
            activation_revision_id: activationRevisionId,
            previous_activation_revision_id:
              current.activation_revision_id,
            catalog_version: nextCatalogVersion,
            disabled_at: commit.now,
            actor_principal_id: commit.actor_principal_id,
            reason_code: "disable",
          },
        );
        const catalogEvent = this.#domainEvent(
          "skill.catalog.changed",
          `catalog:${nextCatalogRevisionId}`,
          commit.now,
          commit.request.trace_id,
          {
            scope_kind: "scoped",
            workspace_id: commit.request.workspace_id,
            bot_id: commit.request.bot_id,
            deployment_environment:
              commit.request.deployment_environment,
            release_channel: commit.request.release_channel,
            catalog_revision_id: nextCatalogRevisionId,
            previous_catalog_version: catalog.catalog_version,
            catalog_version: nextCatalogVersion,
            catalog_as_of: commit.now,
            changed_skill_keys: [commit.skill_key],
            security_revocation_epoch: this.#securityEpoch,
            actor_principal_id: commit.actor_principal_id,
            reason_code: "disable",
          },
        );

        // One owner transaction: immutable activation + current pointers,
        // Catalog exclusion, audit, and both durable events.
        this.#activationRevisions.set(
          activationRevisionId,
          nextActivation,
        );
        this.#activationCurrent.set(
          activationKey,
          activationRevisionId,
        );
        this.#catalogRevisions.set(
          `${catalogKey}\u0000${nextCatalogVersion}`,
          nextCatalog,
        );
        this.#catalogCurrent.set(catalogKey, nextCatalogVersion);
        this.#audit.push({
          action: "skill.activation.disabled",
          scope_kind: "scoped",
          workspace_id: commit.request.workspace_id,
          bot_id: commit.request.bot_id,
          deployment_environment:
            commit.request.deployment_environment,
          release_channel: commit.request.release_channel,
          actor_principal_id: commit.actor_principal_id,
          reason: commit.request.reason,
          command_id: commandId,
          activation_revision_id: activationRevisionId,
          previous_activation_revision_id:
            current.activation_revision_id,
          catalog_version: nextCatalogVersion,
          trace_id: commit.request.trace_id,
        });
        this.#outbox.push(disabledEvent, catalogEvent);
        this.#managementIdempotency.set(idempotencyKey, {
          request_hash: commit.request_hash,
          result,
        });
        return result;
      }

      if (
        commit.request.operation === "activate" ||
        commit.request.operation === "rollback"
      ) {
        const activationKey = activationStorageKey(
          commit.request,
          commit.skill_key,
        );
        const currentActivationId =
          this.#activationCurrent.get(activationKey);
        const current =
          currentActivationId === undefined
            ? catalog.entries.get(commit.skill_key)
            : this.#activationRevisions.get(currentActivationId);
        if (
          (current?.activation_revision_id ?? "none") !==
          commit.request.expected_activation_revision
        ) {
          fail("activation_conflict", "expected activation revision is stale", {
            current_activation_revision:
              current?.activation_revision_id ?? "none",
          });
        }
        if (
          commit.request.operation === "rollback" &&
          (current === undefined ||
            current.state !== "active" ||
            current.version_id === commit.request.target_version_id)
        ) {
          fail(
            "invalid_state_transition",
            "rollback requires a different current active version",
          );
        }
        const targetVersionId =
          commit.request.operation === "activate"
            ? commit.request.version_id
            : commit.request.target_version_id;
        const version = this.#versions.get(targetVersionId);
        if (
          version === undefined ||
          version.skill_id !== commit.request.skill_id ||
          version.skill_key !== commit.skill_key
        ) {
          fail("version_not_publishable", "activation target was not found");
        }
        if (version.lifecycle_state !== "published") {
          fail(
            "version_not_publishable",
            "new activation or rollback must target a published version",
          );
        }
        const activationRevisionId = this.#id("activation_revision");
        const nextActivation: StoredActivationV1 = Object.freeze({
          activation_revision_id: activationRevisionId,
          skill_id: version.skill_id,
          skill_key: version.skill_key,
          version_id: version.version_id,
          state: "active",
          revision_no: nextSkillCounterV1(
            current?.revision_no ?? 0,
            "activation revision",
          ),
          ...(current === undefined
            ? {}
            : {
                previous_activation_revision_id:
                  current.activation_revision_id,
              }),
        });
        const nextCatalogVersion = this.#id("cat");
        const nextCatalogRevisionId = this.#id("catalog_revision");
        const nextEntries = new Map(catalog.entries);
        nextEntries.set(version.skill_key, nextActivation);
        const nextCatalog: StoredCatalogV1 = Object.freeze({
          catalog_revision_id: nextCatalogRevisionId,
          catalog_version: nextCatalogVersion,
          catalog_as_of: commit.now,
          entries: nextEntries,
        });
        const commandId = this.#id("skill_command");
        const result = Object.freeze({
          scope_kind: "scoped" as const,
          operation: commit.request.operation,
          workspace_id: commit.request.workspace_id,
          bot_id: commit.request.bot_id,
          deployment_environment:
            commit.request.deployment_environment,
          release_channel: commit.request.release_channel,
          command_id: commandId,
          previous_revision:
            current?.activation_revision_id ?? "none",
          new_revision: activationRevisionId,
          catalog_version: nextCatalogVersion,
          security_revocation_epoch: this.#securityEpoch,
          duplicate_replayed: false,
        }) as SkillManagementResultV1;
        assertGeneratedManagementResult(commit.request, result);
        const operationEvent =
          commit.request.operation === "activate"
            ? this.#domainEvent(
                "skill.version.activated",
                `activation:${activationRevisionId}:activated`,
                commit.now,
                commit.request.trace_id,
                {
                  scope_kind: "scoped",
                  workspace_id: commit.request.workspace_id,
                  bot_id: commit.request.bot_id,
                  deployment_environment:
                    commit.request.deployment_environment,
                  release_channel: commit.request.release_channel,
                  skill_id: version.skill_id,
                  skill_key: version.skill_key,
                  version_id: version.version_id,
                  version: version.version,
                  activation_revision_id: activationRevisionId,
                  ...(current === undefined
                    ? {}
                    : {
                        previous_activation_revision_id:
                          current.activation_revision_id,
                      }),
                  catalog_version: nextCatalogVersion,
                  actor_principal_id: commit.actor_principal_id,
                  reason_code: "activate",
                },
              )
            : this.#domainEvent(
                "skill.activation.rolled_back",
                `activation:${activationRevisionId}:rolled_back`,
                commit.now,
                commit.request.trace_id,
                {
                  scope_kind: "scoped",
                  workspace_id: commit.request.workspace_id,
                  bot_id: commit.request.bot_id,
                  deployment_environment:
                    commit.request.deployment_environment,
                  release_channel: commit.request.release_channel,
                  skill_id: version.skill_id,
                  skill_key: version.skill_key,
                  activation_revision_id: activationRevisionId,
                  rolled_back_from_version_id: current!.version_id,
                  rolled_back_to_version_id: version.version_id,
                  catalog_version: nextCatalogVersion,
                  actor_principal_id: commit.actor_principal_id,
                  reason_code: "rollback",
                },
              );
        const catalogEvent = this.#domainEvent(
          "skill.catalog.changed",
          `catalog:${nextCatalogRevisionId}`,
          commit.now,
          commit.request.trace_id,
          {
            scope_kind: "scoped",
            workspace_id: commit.request.workspace_id,
            bot_id: commit.request.bot_id,
            deployment_environment:
              commit.request.deployment_environment,
            release_channel: commit.request.release_channel,
            catalog_revision_id: nextCatalogRevisionId,
            previous_catalog_version: catalog.catalog_version,
            catalog_version: nextCatalogVersion,
            catalog_as_of: commit.now,
            changed_skill_keys: [commit.skill_key],
            security_revocation_epoch: this.#securityEpoch,
            actor_principal_id: commit.actor_principal_id,
            reason_code: commit.request.operation,
          },
        );

        this.#catalogRevisions.set(
          `${catalogKey}\u0000${nextCatalogVersion}`,
          nextCatalog,
        );
        this.#catalogCurrent.set(catalogKey, nextCatalogVersion);
        this.#activationRevisions.set(
          activationRevisionId,
          nextActivation,
        );
        this.#activationCurrent.set(
          activationKey,
          activationRevisionId,
        );
        this.#audit.push({
          action: operationEvent.event_type,
          scope_kind: "scoped",
          workspace_id: commit.request.workspace_id,
          bot_id: commit.request.bot_id,
          deployment_environment:
            commit.request.deployment_environment,
          release_channel: commit.request.release_channel,
          actor_principal_id: commit.actor_principal_id,
          reason: commit.request.reason,
          command_id: commandId,
          activation_revision_id: activationRevisionId,
          catalog_version: nextCatalogVersion,
          trace_id: commit.request.trace_id,
        });
        this.#outbox.push(catalogEvent, operationEvent);
        this.#managementIdempotency.set(idempotencyKey, {
          request_hash: commit.request_hash,
          result,
        });
        return result;
      }

      const knownSkill = [...this.#versions.values()].some(
        (version) =>
          version.skill_id === commit.request.skill_id &&
          version.skill_key === commit.skill_key,
      );
      if (!knownSkill) {
        fail("version_not_publishable", "permission skill was not found");
      }
      if (
        commit.request.scope_hash !==
        skillPermissionScopeHashV1(commit.request)
      ) {
        fail(
          "authorization_scope_mismatch",
          "permission scope hash drifted before owner commit",
        );
      }
      const permissionKey = permissionStorageKey(
        commit.request,
        commit.request.skill_id,
        commit.request.owner_agent_id,
      );
      const currentPermission = this.#permissions.get(permissionKey);
      if (
        (currentPermission?.permission_revision_id ?? "none") !==
        commit.request.expected_permission_revision
      ) {
        fail("permission_conflict", "expected permission revision is stale", {
          current_permission_revision:
            currentPermission?.permission_revision_id ?? "none",
        });
      }
      const permissionRevisionId = this.#id("permission_revision");
      const requestedCapabilities = (
        commit.request as
          | SkillPermissionGrantRequestV1
          | SkillPermissionRevokeRequestV1
      ).capability_refs;
      const nextPermission: StoredPermissionStateV1 = Object.freeze({
        decision:
          commit.request.operation === "permission_grant"
            ? "grant"
            : "deny",
        ...(commit.request.owner_agent_id === undefined
          ? {}
          : {
              owner_agent_condition:
                commit.request.owner_agent_id,
            }),
        capability_refs: Object.freeze([
          ...requestedCapabilities,
        ]),
        permission_revision_id: permissionRevisionId,
        revision_no: nextSkillCounterV1(
          currentPermission?.revision_no ?? 0,
          "permission revision",
        ),
        scope_hash: commit.request.scope_hash,
      });
      const nextCatalogVersion = this.#id("cat");
      const nextCatalogRevisionId = this.#id("catalog_revision");
      const nextCatalog: StoredCatalogV1 = Object.freeze({
        catalog_revision_id: nextCatalogRevisionId,
        catalog_version: nextCatalogVersion,
        catalog_as_of: commit.now,
        entries: new Map(catalog.entries),
      });
      const commandId = this.#id("skill_command");
      const result = Object.freeze({
        scope_kind: "scoped" as const,
        operation: commit.request.operation,
        workspace_id: commit.request.workspace_id,
        bot_id: commit.request.bot_id,
        deployment_environment:
          commit.request.deployment_environment,
        release_channel: commit.request.release_channel,
        command_id: commandId,
        previous_revision:
          currentPermission?.permission_revision_id ?? "none",
        new_revision: permissionRevisionId,
        catalog_version: nextCatalogVersion,
        security_revocation_epoch: this.#securityEpoch,
        duplicate_replayed: false,
      }) as SkillManagementResultV1;
      assertGeneratedManagementResult(commit.request, result);
      const permissionEventType =
        commit.request.operation === "permission_grant"
          ? "skill.permission.granted"
          : "skill.permission.revoked";
      const catalogEvent = this.#domainEvent(
        "skill.catalog.changed",
        `catalog:${nextCatalogRevisionId}`,
        commit.now,
        commit.request.trace_id,
        {
          scope_kind: "scoped",
          workspace_id: commit.request.workspace_id,
          bot_id: commit.request.bot_id,
          deployment_environment:
            commit.request.deployment_environment,
          release_channel: commit.request.release_channel,
          catalog_revision_id: nextCatalogRevisionId,
          previous_catalog_version: catalog.catalog_version,
          catalog_version: nextCatalogVersion,
          catalog_as_of: commit.now,
          changed_skill_keys: [commit.skill_key],
          security_revocation_epoch: this.#securityEpoch,
          actor_principal_id: commit.actor_principal_id,
          reason_code: commit.request.operation,
        },
      );
      const permissionEvent = this.#domainEvent(
        permissionEventType,
        `permission:${permissionRevisionId}:${commit.request.operation}`,
        commit.now,
        commit.request.trace_id,
        {
          scope_kind: "scoped",
          workspace_id: commit.request.workspace_id,
          bot_id: commit.request.bot_id,
          deployment_environment:
            commit.request.deployment_environment,
          release_channel: commit.request.release_channel,
          skill_id: commit.request.skill_id,
          skill_key: commit.skill_key,
          permission_revision_id: permissionRevisionId,
          scope_hash: commit.request.scope_hash,
          ...(commit.request.owner_agent_id === undefined
            ? {}
            : { owner_agent_id: commit.request.owner_agent_id }),
          ...(commit.request.operation === "permission_grant"
            ? {
                capability_refs: [
                  ...commit.request.capability_refs,
                ],
              }
            : {
                revoked_capability_refs: [
                  ...commit.request.capability_refs,
                ],
                security_revocation_epoch: this.#securityEpoch,
              }),
          catalog_version: nextCatalogVersion,
          actor_principal_id: commit.actor_principal_id,
          reason_code: commit.request.operation,
        },
      );

      this.#permissionRevisions.set(
        permissionRevisionId,
        nextPermission,
      );
      this.#permissions.set(permissionKey, nextPermission);
      this.#catalogRevisions.set(
        `${catalogKey}\u0000${nextCatalogVersion}`,
        nextCatalog,
      );
      this.#catalogCurrent.set(catalogKey, nextCatalogVersion);
      this.#audit.push({
        action: permissionEventType,
        scope_kind: "scoped",
        workspace_id: commit.request.workspace_id,
        bot_id: commit.request.bot_id,
        deployment_environment:
          commit.request.deployment_environment,
        release_channel: commit.request.release_channel,
        actor_principal_id: commit.actor_principal_id,
        reason: commit.request.reason,
        command_id: commandId,
        permission_revision_id: permissionRevisionId,
        catalog_version: nextCatalogVersion,
        trace_id: commit.request.trace_id,
      });
      this.#outbox.push(catalogEvent, permissionEvent);
      this.#managementIdempotency.set(idempotencyKey, {
        request_hash: commit.request_hash,
        result,
      });
      return result;
    });
  }

  public async queryCatalog(
    commit: CatalogQueryCommitV1,
  ): Promise<SkillCatalogQueryResultV1> {
    return this.#locked(() => {
      const filterHash = canonicalHashV1({
        filter: commit.request.filter ?? null,
      });
      let catalog: StoredCatalogV1;
      let bindings: SkillCatalogCursorBindingsV1;
      let items: readonly SkillCatalogItemV1[];
      let offset = 0;
      let pageSize: number;
      let expiresAt: string;
      let summary: SkillPermissionSummaryV1;

      if (commit.request.cursor !== undefined) {
        const cursor = this.#readCursor(
          commit.request.cursor,
          commit.now,
        );
        try {
          assertSkillCatalogCursorBindingsV1(
            {
              ...cursor.bindings,
              workspace_id: commit.request.workspace_id,
              bot_id: commit.request.bot_id,
              owner_agent_id: commit.request.owner_agent_id,
              deployment_environment:
                commit.request.deployment_environment,
              release_channel: commit.request.release_channel,
              principal_id: commit.principal_id,
              authorization_context_hash:
                commit.authorization_context_hash,
              limit: commit.request.limit,
              filter_hash: filterHash,
              schema_version: commit.request.schema_version,
            },
            cursor.bindings,
          );
        } catch {
          fail("invalid_cursor", "catalog cursor context changed", {
            reason: "context_changed",
            restart_from_first_page: true,
          });
        }
        if (
          (commit.request.as_of !== undefined &&
            commit.request.as_of !== cursor.bindings.as_of) ||
          this.#securityEpoch !==
            cursor.bindings.security_revocation_epoch
        ) {
          fail("invalid_cursor", "catalog cursor context changed", {
            reason: "context_changed",
            restart_from_first_page: true,
          });
        }
        const catalogKey = scopeKey(commit.request);
        const frozenCatalog = this.#catalogRevisions.get(
          `${catalogKey}\u0000${cursor.bindings.catalog_version}`,
        );
        if (
          frozenCatalog === undefined ||
          frozenCatalog.catalog_revision_id !==
            cursor.catalog_revision_id ||
          frozenCatalog.catalog_as_of !== cursor.bindings.as_of
        ) {
          fail("invalid_cursor", "catalog cursor context changed", {
            reason: "context_changed",
            restart_from_first_page: true,
          });
        }
        catalog = frozenCatalog;
        summary = this.#buildPermissionSummary(
          commit.request,
          catalog,
          cursor.bindings.skill_permission_summary_ref,
          false,
        );
        if (
          summary.summary_hash !==
            cursor.bindings.skill_permission_summary_hash ||
          cursor.items.some(
            (item) =>
              this.#versions.get(item.version_id)?.lifecycle_state ===
              "revoked",
          )
        ) {
          fail("invalid_cursor", "catalog cursor context changed", {
            reason: "context_changed",
            restart_from_first_page: true,
          });
        }
        bindings = cursor.bindings;
        items = cursor.items;
        offset = cursor.offset;
        pageSize = cursor.page_size;
        expiresAt = cursor.expires_at;
      } else {
        const catalogKey = scopeKey(commit.request);
        const currentCatalogVersion =
          this.#catalogCurrent.get(catalogKey);
        const currentCatalog =
          currentCatalogVersion === undefined
            ? undefined
            : this.#catalogRevisions.get(
                `${catalogKey}\u0000${currentCatalogVersion}`,
              );
        const matchingSnapshots =
          commit.request.as_of === undefined
            ? []
            : [...this.#catalogRevisions.entries()]
                .filter(
                  ([key, value]) =>
                    key.startsWith(`${catalogKey}\u0000`) &&
                    value.catalog_as_of === commit.request.as_of,
                )
                .map(([, value]) => value);
        const selected =
          commit.request.as_of === undefined
            ? currentCatalog
            : currentCatalog?.catalog_as_of === commit.request.as_of
              ? currentCatalog
              : matchingSnapshots[matchingSnapshots.length - 1];
        if (selected === undefined) {
          fail(
            "catalog_version_conflict",
            "requested catalog snapshot is unavailable",
            {
              requested_catalog_version: null,
              current_catalog_version:
                currentCatalog?.catalog_version ?? null,
              requested_as_of: commit.request.as_of ?? null,
              conflict_reason: "catalog_snapshot_unavailable",
            },
          );
        }
        catalog = selected;
        const summaryRef = this.#id("skill_permission_summary");
        summary = this.#buildPermissionSummary(
          commit.request,
          catalog,
          summaryRef,
          false,
        );
        items = this.#catalogItems(
          commit.request,
          catalog,
          summary,
        );
        pageSize = Math.min(
          commit.request.limit,
          commit.page_size,
        );
        expiresAt = new Date(
          Date.parse(commit.now) +
            commit.cursor_ttl_seconds * 1_000,
        ).toISOString();
        bindings = Object.freeze({
          workspace_id: commit.request.workspace_id,
          bot_id: commit.request.bot_id,
          deployment_environment:
            commit.request.deployment_environment,
          release_channel: commit.request.release_channel,
          owner_agent_id: commit.request.owner_agent_id,
          principal_id: commit.principal_id,
          authorization_context_hash:
            commit.authorization_context_hash,
          catalog_version: catalog.catalog_version,
          as_of: catalog.catalog_as_of,
          security_revocation_epoch: this.#securityEpoch,
          skill_permission_summary_ref: summary.summary_ref,
          skill_permission_summary_hash: summary.summary_hash,
          limit: commit.request.limit,
          filter_hash: filterHash,
          schema_version: "skill_catalog_query.v1",
        });
      }

      const page = items.slice(
        offset,
        offset + pageSize,
      );
      const nextOffset = offset + page.length;
      const preparedCursor =
        nextOffset < items.length
          ? this.#prepareCursor(
              bindings,
              catalog.catalog_revision_id,
              items,
              pageSize,
              nextOffset,
              expiresAt,
            )
          : undefined;
      const result: SkillCatalogQueryResultV1 = Object.freeze({
        schema_version: "skill_catalog_response.v1",
        workspace_id: commit.request.workspace_id,
        bot_id: commit.request.bot_id,
        owner_agent_id: commit.request.owner_agent_id,
        deployment_environment:
          commit.request.deployment_environment,
        release_channel: commit.request.release_channel,
        catalog_revision_id: catalog.catalog_revision_id,
        catalog_version: catalog.catalog_version,
        as_of: catalog.catalog_as_of,
        security_revocation_epoch: this.#securityEpoch,
        skill_permission_summary_ref: summary.summary_ref,
        skill_permission_summary_hash: summary.summary_hash,
        items: page.map((item) => ({
          ...item,
          capability_refs: [...item.capability_refs],
        })),
        next_cursor: preparedCursor?.token ?? null,
      });
      if (!canonicalValueCheckV1(SkillCatalogQueryDetailsV1Schema, result)) {
        throw new Error(
          "Skill Registry owner generated an invalid catalog result",
        );
      }
      assertSkillCatalogQuerySemanticBindingsV1(commit.request, {
        code: "skill_catalog_found",
        message: "skill catalog found",
        retryable: false,
        trace_id: commit.request.trace_id,
        details: result,
      });
      if (commit.request.cursor === undefined) {
        this.#summaries.set(summary.summary_ref, summary);
      }
      if (preparedCursor !== undefined) {
        this.#catalogCursors.set(
          preparedCursor.cursor.cursor_id,
          preparedCursor.cursor,
        );
      }
      this.#audit.push({
        action: "skill.catalog.queried",
        principal_id: commit.principal_id,
        workspace_id: commit.request.workspace_id,
        bot_id: commit.request.bot_id,
        owner_agent_id: commit.request.owner_agent_id,
        catalog_revision_id: catalog.catalog_revision_id,
        catalog_version: catalog.catalog_version,
        as_of: catalog.catalog_as_of,
        page_offset: offset,
        page_size: page.length,
        trace_id: commit.request.trace_id,
      });
      return result;
    });
  }

  #buildPermissionSummary(
    scope: SkillRuntimeScopeV1,
    catalog: StoredCatalogV1,
    summaryRef: string,
    persist = true,
  ): SkillPermissionSummaryV1 {
    const activations = [...catalog.entries.values()].sort(
      (left, right) =>
        left.skill_id.localeCompare(right.skill_id, "en"),
    );
    const entries: SkillPermissionSummaryEntryV1[] =
      activations.map((activation) => {
        const permission = this.#effectivePermission(
          scope,
          activation.skill_id,
        );
        if (permission === undefined) {
          return {
            skill_id: activation.skill_id,
            skill_key: activation.skill_key,
            activation_revision_id:
              activation.activation_revision_id,
            version_id: activation.version_id,
            decision_source: "default_deny",
            decision: "deny",
            capability_refs: [],
          };
        }
        return {
          skill_id: activation.skill_id,
          skill_key: activation.skill_key,
          activation_revision_id:
            activation.activation_revision_id,
          version_id: activation.version_id,
          decision_source: "revision",
          permission_revision_id:
            permission.permission_revision_id,
          revision_no: permission.revision_no,
          decision: permission.decision,
          scope_hash: permission.scope_hash,
          owner_agent_condition:
            permission.owner_agent_condition ?? null,
          capability_refs: [...permission.capability_refs].sort(),
        };
      });
    for (let index = 1; index < entries.length; index += 1) {
      if (entries[index - 1]!.skill_id >= entries[index]!.skill_id) {
        throw new Error(
          "catalog contains duplicate or non-canonical skill identities",
        );
      }
    }
    const withoutHash: Omit<
      SkillPermissionSummaryV1,
      "summary_hash"
    > = {
      schema_version: "skill_permission_summary.v1",
      summary_ref: summaryRef,
      workspace_id: scope.workspace_id,
      bot_id: scope.bot_id,
      owner_agent_id: scope.owner_agent_id,
      deployment_environment: scope.deployment_environment,
      release_channel: scope.release_channel,
      catalog_revision_id: catalog.catalog_revision_id,
      catalog_version: catalog.catalog_version,
      catalog_as_of: catalog.catalog_as_of,
      security_revocation_epoch: this.#securityEpoch,
      entries,
    };
    const summary: SkillPermissionSummaryV1 = Object.freeze({
      ...withoutHash,
      summary_hash: canonicalHashV1(withoutHash),
    });
    if (persist) this.#summaries.set(summaryRef, summary);
    return summary;
  }

  #catalogItems(
    request: SkillCatalogQueryRequestV1,
    catalog: StoredCatalogV1,
    summary: SkillPermissionSummaryV1,
  ): readonly SkillCatalogItemV1[] {
    const filter = request.filter?.toLocaleLowerCase("en-US");
    const summaryBySkillId = new Map(
      summary.entries.map((entry) => [entry.skill_id, entry]),
    );
    return [...catalog.entries.values()]
      .sort((left, right) =>
        left.skill_id.localeCompare(right.skill_id, "en"),
      )
      .flatMap((activation): SkillCatalogItemV1[] => {
        const version = this.#versions.get(activation.version_id);
        const permission = summaryBySkillId.get(
          activation.skill_id,
        );
        if (
          activation.state !== "active" ||
          version === undefined ||
          version.lifecycle_state === "revoked" ||
          permission === undefined ||
          permission.decision !== "grant" ||
          ("owner_agent_condition" in permission &&
            permission.owner_agent_condition !== null &&
            permission.owner_agent_condition !==
              request.owner_agent_id)
        ) {
          return [];
        }
        if (
          filter !== undefined &&
          ![
            version.skill_id,
            version.skill_key,
            version.skill_name,
          ].some((value) =>
            value.toLocaleLowerCase("en-US").includes(filter),
          )
        ) {
          return [];
        }
        return [
          {
            skill_id: version.skill_id,
            skill_key: version.skill_key,
            skill_name: version.skill_name,
            version_id: version.version_id,
            version: version.version,
            activation_revision_id:
              activation.activation_revision_id,
            lifecycle_state: version.lifecycle_state,
            capability_refs: [...permission.capability_refs].sort(),
          },
        ];
      });
  }

  public async readContextCatalog(
    commit: ContextCatalogReadCommitV1,
  ): Promise<SkillContextCatalogDetailsV1> {
    return this.#locked(() => {
      const catalogKey = scopeKey(commit.request);
      const currentCatalogVersion = this.#catalogCurrent.get(catalogKey);
      const catalog =
        currentCatalogVersion === undefined
          ? undefined
          : this.#catalogRevisions.get(
              `${catalogKey}\u0000${currentCatalogVersion}`,
            );
      if (catalog === undefined) {
        fail(
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
      const items = [...catalog.entries.values()]
        .sort((left, right) =>
          left.skill_key.localeCompare(right.skill_key, "en"),
        )
        .flatMap((activation): SkillContextCatalogDetailsV1["items"] => {
          const version = this.#versions.get(activation.version_id);
          if (
            activation.state !== "active" ||
            version === undefined ||
            version.lifecycle_state === "revoked"
          ) {
            return [];
          }
          return [
            Object.freeze({
              skill_key: version.skill_key,
              // Legacy in-memory fixtures predate durable skill metadata. The
              // PostgreSQL owner implementation supplies its persisted title
              // and description; an empty description is still contract-valid
              // for deterministic unit fixtures.
              name: version.skill_name,
              description: "",
              active_version: version.version,
              package_digest: version.package_digest,
              manifest_digest: version.manifest_digest,
              runtime_target: version.runtime_target,
            }),
          ];
        })
        .slice(0, commit.request.limit);
      const result: SkillContextCatalogDetailsV1 = {
        schema_version: "skill_context_catalog_response.v1",
        workspace_id: commit.request.workspace_id,
        bot_id: commit.request.bot_id,
        owner_agent_id: commit.request.owner_agent_id,
        deployment_environment: commit.request.deployment_environment,
        release_channel: commit.request.release_channel,
        catalog_version: catalog.catalog_version,
        as_of: catalog.catalog_as_of,
        items,
      };
      if (!canonicalValueCheckV1(SkillContextCatalogDetailsV1Schema, result)) {
        throw new Error("Skill Registry owner generated an invalid context catalog");
      }
      return result;
    });
  }

  public async readPermissionSummary(
    reference: string,
  ): Promise<SkillPermissionSummaryV1 | undefined> {
    const summary = this.#summaries.get(reference);
    return summary === undefined ? undefined : structuredClone(summary);
  }

  public async replayResolutionAttempt(
    request: SkillResolveRequestV1,
    requestHash: string,
  ): Promise<SkillResolveResultV1 | undefined> {
    return this.#locked(() => {
      const attemptKey =
        `${request.runtime_run_id}\u0000${request.start_attempt_no}`;
      const existing = this.#resolutionAttempts.get(attemptKey);
      if (existing === undefined) return undefined;
      if (existing.request_hash !== requestHash) {
        fail("idempotency_conflict", "resolution attempt body drift");
      }
      if (!existing.outcome.ok) {
        throw new SkillRegistryApplicationErrorV1(
          existing.outcome.error.code,
          existing.outcome.error.message,
          existing.outcome.error.details,
        );
      }
      return replayed(existing.outcome.result);
    });
  }

  public async recordResolutionFailure(
    request: SkillResolveRequestV1,
    requestHash: string,
    error: SkillRegistryApplicationErrorV1,
  ): Promise<SkillResolveResultV1> {
    return this.#locked(() => {
      const attemptKey =
        `${request.runtime_run_id}\u0000${request.start_attempt_no}`;
      const existing = this.#resolutionAttempts.get(attemptKey);
      if (existing !== undefined) {
        if (existing.request_hash !== requestHash) {
          fail("idempotency_conflict", "resolution attempt body drift");
        }
        if (existing.outcome.ok) return replayed(existing.outcome.result);
        throw new SkillRegistryApplicationErrorV1(
          existing.outcome.error.code,
          existing.outcome.error.message,
          existing.outcome.error.details,
        );
      }
      this.#resolutionAttempts.set(attemptKey, {
        request_hash: requestHash,
        outcome: {
          ok: false,
          error: {
            code: error.code,
            message: error.message,
            details: structuredClone(error.details),
          },
        },
      });
      this.#audit.push({
        action: "skill.resolution.failed",
        runtime_run_id: request.runtime_run_id,
        start_attempt_no: request.start_attempt_no,
        error_code: error.code,
        trace_id: request.trace_id,
      });
      throw new SkillRegistryApplicationErrorV1(
        error.code,
        error.message,
        error.details,
      );
    });
  }

  public async resolveAttempt(
    commit: ResolutionCommitV1,
  ): Promise<SkillResolveResultV1> {
    return this.#locked(() => {
      const attemptKey =
        `${commit.request.runtime_run_id}\u0000${commit.request.start_attempt_no}`;
      const existing = this.#resolutionAttempts.get(attemptKey);
      if (existing !== undefined) {
        if (existing.request_hash !== commit.request_hash) {
          fail("idempotency_conflict", "resolution attempt body drift");
        }
        if (!existing.outcome.ok) {
          throw new SkillRegistryApplicationErrorV1(
            existing.outcome.error.code,
            existing.outcome.error.message,
            existing.outcome.error.details,
          );
        }
        return replayed(existing.outcome.result);
      }
      const requestedScopeKey = scopeKey(commit.request);
      const catalog = this.#catalogRevisions.get(
        `${requestedScopeKey}\u0000${commit.request.expected_catalog_version}`,
      );
      if (
        catalog === undefined ||
        catalog.catalog_version !== commit.request.expected_catalog_version ||
        catalog.catalog_as_of !== commit.request.catalog_as_of ||
        commit.summary.catalog_revision_id !== catalog.catalog_revision_id
      ) {
        fail(
          "catalog_version_conflict",
          "requested catalog revision is unavailable",
          {
            requested_catalog_version:
              commit.request.expected_catalog_version,
            current_catalog_version:
              this.#catalogCurrent.get(requestedScopeKey) ?? null,
            conflict_reason: "catalog_revision_unavailable",
            recovery_action: "recompose_context",
          },
        );
      }
      if (commit.summary.security_revocation_epoch !== this.#securityEpoch) {
        fail("permission_denied", "security epoch advanced after policy freeze", {
          reason_code: "security_epoch_advanced",
        });
      }
      const summaryBySkill = new Map(
        commit.summary.entries.map((entry) => [entry.skill_key, entry]),
      );
      const decisions: Array<
        | {
            readonly kind: "resolved";
            readonly item: SkillResolveItemRequestV1;
            readonly version: StoredVersionV1;
            readonly capabilities: readonly string[];
          }
        | {
            readonly kind: "unavailable";
            readonly item: SkillResolveItemRequestV1;
            readonly reason: SkillDegradationV1["reason"];
          }
      > = [];
      for (const item of commit.request.skills) {
        const activation = catalog.entries.get(item.name);
        const currentActivationId = this.#activationCurrent.get(
          activationStorageKey(commit.request, item.name),
        );
        const currentActivation =
          currentActivationId === undefined
            ? undefined
            : this.#activationRevisions.get(currentActivationId);
        const summaryEntry = summaryBySkill.get(item.name);
        if (currentActivation?.state === "disabled") {
          decisions.push({
            kind: "unavailable",
            item,
            reason: "activation_disabled",
          });
          continue;
        }
        if (activation === undefined) {
          decisions.push({ kind: "unavailable", item, reason: "not_found" });
          continue;
        }
        if (activation.state !== "active") {
          decisions.push({
            kind: "unavailable",
            item,
            reason: "activation_disabled",
          });
          continue;
        }
        if (
          summaryEntry === undefined ||
          summaryEntry.activation_revision_id !== activation.activation_revision_id ||
          summaryEntry.version_id !== activation.version_id ||
          summaryEntry.decision !== "grant" ||
          (summaryEntry.owner_agent_condition !== undefined &&
            summaryEntry.owner_agent_condition !== commit.request.owner_agent_id)
        ) {
          decisions.push({ kind: "unavailable", item, reason: "permission_denied" });
          continue;
        }
        const currentPermission = this.#effectivePermission(
          commit.request,
          activation.skill_id,
        );
        if (
          currentPermission === undefined ||
          currentPermission.decision !== "grant" ||
          (currentPermission.owner_agent_condition !== undefined &&
            currentPermission.owner_agent_condition !== commit.request.owner_agent_id)
        ) {
          decisions.push({ kind: "unavailable", item, reason: "permission_denied" });
          continue;
        }
        const version = this.#versions.get(activation.version_id);
        if (version === undefined) {
          decisions.push({ kind: "unavailable", item, reason: "not_found" });
          continue;
        }
        if (version.lifecycle_state === "revoked") {
          decisions.push({ kind: "unavailable", item, reason: "version_revoked" });
          continue;
        }
        decisions.push({
          kind: "resolved",
          item,
          version,
          capabilities: currentPermission.capability_refs
            .filter((capability) =>
              summaryEntry.capability_refs.includes(capability),
            )
            .sort(),
        });
      }
      const requiredDenied = decisions.find(
        (decision) =>
          decision.kind === "unavailable" &&
          decision.item.required &&
          decision.reason === "permission_denied",
      );
      if (requiredDenied !== undefined) {
        fail("permission_denied", "required skill permission was denied", {
          skill_key: requiredDenied.item.name,
        });
      }
      const requiredRevoked = decisions.find(
        (decision) =>
          decision.kind === "unavailable" &&
          decision.item.required &&
          decision.reason === "version_revoked",
      );
      if (requiredRevoked !== undefined) {
        fail("version_revoked", "required skill version was revoked", {
          skill_key: requiredRevoked.item.name,
        });
      }
      const requiredUnavailable = decisions.find(
        (decision) =>
          decision.kind === "unavailable" && decision.item.required,
      );
      if (
        requiredUnavailable !== undefined &&
        requiredUnavailable.kind === "unavailable"
      ) {
        fail("required_skill_unavailable", "required skill is unavailable", {
          skill_key: requiredUnavailable.item.name,
          reason: requiredUnavailable.reason,
          failed_items: [
            {
              skill_key: requiredUnavailable.item.name,
              reason: requiredUnavailable.reason,
            },
          ],
        });
      }
      const attemptId = this.#id("resolution_attempt");
      const resolvedSkills: ResolvedSkillV1[] = [];
      const storedResolutions: Array<
        readonly [string, StoredResolutionV1]
      > = [];
      const degradationNotes: SkillDegradationV1[] = [];
      for (const decision of decisions) {
        if (decision.kind === "unavailable") {
          degradationNotes.push({
            skill_key: decision.item.name,
            reason: decision.reason,
          });
          continue;
        }
        const resolutionId = this.#id("resolution");
        const resolution: ResolvedSkillV1 = Object.freeze({
          resolution_id: resolutionId,
          skill_id: decision.version.skill_id,
          skill_key: decision.version.skill_key,
          version_id: decision.version.version_id,
          version: decision.version.version,
          package_digest: decision.version.package_digest,
          manifest_digest: decision.version.manifest_digest,
          runtime_target: decision.version.runtime_target,
          granted_capability_refs: [...decision.capabilities],
          required: decision.item.required,
          valid_until: commit.policy.policy.expires_at,
        });
        resolvedSkills.push(resolution);
        storedResolutions.push([
          resolutionId,
          {
            ...resolution,
            runtime_run_id: commit.request.runtime_run_id,
            scope: {
              workspace_id: commit.request.workspace_id,
              bot_id: commit.request.bot_id,
              owner_agent_id: commit.request.owner_agent_id,
              deployment_environment:
                commit.request.deployment_environment,
              release_channel: commit.request.release_channel,
            },
            security_revocation_epoch: this.#securityEpoch,
            activation_revision_id:
              catalog.entries.get(decision.version.skill_key)!
                .activation_revision_id,
          },
        ]);
      }
      const result: SkillResolveResultV1 = Object.freeze({
        schema_version: "skill_resolution_response.v1",
        resolution_attempt_id: attemptId,
        runtime_run_id: commit.request.runtime_run_id,
        start_attempt_no: commit.request.start_attempt_no,
        workspace_id: commit.request.workspace_id,
        bot_id: commit.request.bot_id,
        owner_agent_id: commit.request.owner_agent_id,
        deployment_environment: commit.request.deployment_environment,
        release_channel: commit.request.release_channel,
        requested_catalog_version: commit.request.expected_catalog_version,
        effective_catalog_version: commit.request.expected_catalog_version,
        catalog_as_of: commit.request.catalog_as_of,
        security_revocation_epoch: this.#securityEpoch,
        policy_input_hash: commit.request.policy_input_hash,
        valid_until: commit.policy.policy.expires_at,
        resolved_skills: resolvedSkills,
        degradation_notes: degradationNotes,
        duplicate_replayed: false,
      });
      if (!canonicalValueCheckV1(SkillResolveDetailsV1Schema, result)) {
        throw new Error(
          "Skill Registry owner generated an invalid resolution result",
        );
      }
      assertSkillResolveResponseSemanticBindingsV1(
        commit.request,
        {
          code: "skill_resolution_succeeded",
          message: "skills resolved",
          retryable: false,
          trace_id: commit.request.trace_id,
          details: result,
        },
        commit.policy.policy.expires_at,
      );
      for (const [resolutionId, resolution] of storedResolutions) {
        this.#resolutions.set(resolutionId, resolution);
      }
      this.#resolutionAttempts.set(attemptKey, {
        request_hash: commit.request_hash,
        outcome: { ok: true, result },
      });
      this.#audit.push({
        action: "skill.resolution.resolved",
        resolution_attempt_id: attemptId,
        runtime_run_id: commit.request.runtime_run_id,
      });
      return result;
    });
  }

  public async authorizeContent(
    request: SkillContentRequestV1,
    now: string,
  ): Promise<SkillContentAuthorizationV1> {
    return this.#locked(() => {
      const resolution = this.#resolutions.get(request.resolution_id);
      if (
        resolution === undefined ||
        resolution.runtime_run_id !== request.runtime_run_id ||
        request.owner_agent_id === undefined ||
        !runtimeScopeMatches(
          request as SkillRuntimeScopeV1,
          resolution.scope,
        )
      ) {
        fail("resolution_not_found", "resolution was not found in this run scope");
      }
      const validUntil = Date.parse(resolution.valid_until);
      if (validUntil <= Date.parse(now)) {
        fail("resolution_expired", "resolution policy has expired");
      }
      const version = this.#versions.get(resolution.version_id);
      if (version === undefined) {
        fail("content_unavailable", "resolved version is unavailable");
      }
      if (
        request.security_revocation_epoch !== resolution.security_revocation_epoch ||
        request.security_revocation_epoch !== this.#securityEpoch
      ) {
        if (version.lifecycle_state === "revoked") {
          fail("version_revoked", "resolved version has been revoked");
        }
        fail("resolution_expired", "security epoch advanced for this run");
      }
      if (version.lifecycle_state === "revoked") {
        fail("version_revoked", "resolved version has been revoked");
      }
      const activation = this.#activationRevisions.get(
        resolution.activation_revision_id,
      );
      const currentCatalogVersion = this.#catalogCurrent.get(
        scopeKey(resolution.scope),
      );
      const currentCatalog =
        currentCatalogVersion === undefined
          ? undefined
          : this.#catalogRevisions.get(
              `${scopeKey(resolution.scope)}\u0000${currentCatalogVersion}`,
            );
      const currentActivation = currentCatalog?.entries.get(
        version.skill_key,
      );
      if (
        activation === undefined ||
        activation.state !== "active" ||
        activation.version_id !== version.version_id ||
        currentActivation === undefined ||
        currentActivation.state !== "active" ||
        currentActivation.version_id !== version.version_id
      ) {
        fail("content_unavailable", "resolved activation is no longer current");
      }
      const permission = this.#effectivePermission(
        request as SkillRuntimeScopeV1,
        version.skill_id,
      );
      if (
        permission === undefined ||
        permission.decision !== "grant" ||
        (permission.owner_agent_condition !== undefined &&
          permission.owner_agent_condition !== request.owner_agent_id)
      ) {
        fail("permission_denied", "current permission no longer grants content");
      }
      if (version.retention_state !== "retained") {
        fail("content_unavailable", "skill package is not retained");
      }
      return {
        version: structuredClone(version),
        resolution: structuredClone(resolution),
        valid_until: resolution.valid_until,
      };
    });
  }

  public async recordContentAudit(
    request: SkillContentRequestV1,
    decision: "allow" | "deny",
    reasonCode: string,
  ): Promise<void> {
    await this.#locked(() => {
      this.#audit.push({
        action: "skill.content.fetch",
        decision,
        reason_code: reasonCode,
        resolution_id: request.resolution_id,
        runtime_run_id: request.runtime_run_id,
        trace_id: request.trace_id,
      });
    });
  }
}

export class InMemoryRuntimePolicyInputReaderV1
  implements RuntimePolicyInputReaderPortV1
{
  public readonly durability = "memory" as const;
  readonly #artifacts = new Map<string, RuntimePolicyInputArtifactV1>();

  public async checkReadiness(): Promise<void> {}

  public seed(reference: string, artifact: RuntimePolicyInputArtifactV1): void {
    this.#artifacts.set(reference, structuredClone(artifact));
  }

  public async readPolicyInput(
    request: Pick<SkillResolveRequestV1, "policy_input_ref">,
  ): Promise<RuntimePolicyInputArtifactV1> {
    const artifact = this.#artifacts.get(request.policy_input_ref);
    if (artifact === undefined) {
      throw new SkillRegistryApplicationErrorV1(
        "invalid_runtime_policy",
        "runtime policy input reference was not found",
        { reason_code: "ref_hash_mismatch" },
      );
    }
    return structuredClone(artifact);
  }
}

/** Test-only durable-staging boundary with immutable byte snapshots. */
export class InMemorySkillValidationArtifactReaderV1
  implements SkillValidationArtifactReaderPortV1
{
  public readonly durability = "memory" as const;
  public readonly cancellation_kind = "abort_signal" as const;
  readonly #artifacts = new Map<
    ObjectRefV1,
    Readonly<{
      metadata: Omit<SkillValidationArtifactReadV1, "body">;
      bytes: Uint8Array;
    }>
  >();
  #readCount = 0;

  public async checkReadiness(): Promise<void> {}

  public get readCount(): number {
    return this.#readCount;
  }

  public seed(
    metadata: Omit<SkillValidationArtifactReadV1, "body">,
    bytes: Uint8Array,
  ): void {
    this.#artifacts.set(
      metadata.artifact_ref,
      Object.freeze({
        metadata: structuredClone(metadata),
        bytes: Uint8Array.from(bytes),
      }),
    );
  }

  public async readArtifact(
    request: SkillValidateRequestV1,
    signal: AbortSignal,
  ): Promise<SkillValidationArtifactReadV1> {
    signal.throwIfAborted();
    this.#readCount = nextSkillCounterV1(
      this.#readCount,
      "validation artifact read count",
    );
    const artifact = this.#artifacts.get(
      request.artifact_ref as ObjectRefV1,
    );
    if (artifact === undefined) {
      fail(
        "registry_unavailable",
        "validation staging artifact was not found",
      );
    }
    const bytes = Uint8Array.from(artifact.bytes);
    const streamSignal = signal;
    return {
      ...structuredClone(artifact.metadata),
      body: (async function* () {
        streamSignal.throwIfAborted();
        yield bytes;
        streamSignal.throwIfAborted();
      })(),
    };
  }
}

/** Test-only inspector whose manifest factory can model a hardened scanner. */
export class InProcessSkillPackageInspectorV1
  implements SkillPackageInspectorPortV1
{
  public readonly execution_kind = "in_process" as const;
  public readonly cancellation_kind = "abort_signal" as const;

  public constructor(
    private readonly inspect: (
      bytes: Uint8Array,
      signal: AbortSignal,
    ) => SkillPackageInspectionV1 | Promise<SkillPackageInspectionV1>,
  ) {}

  public async checkReadiness(): Promise<void> {}

  public async inspectPackage(
    bytes: Uint8Array,
    signal: AbortSignal,
  ): Promise<SkillPackageInspectionV1> {
    signal.throwIfAborted();
    const inspection = await this.inspect(bytes, signal);
    signal.throwIfAborted();
    return structuredClone(inspection);
  }
}

export function runtimePolicyInputHashV1(
  artifact: RuntimePolicyInputArtifactV1,
): string {
  return canonicalHashV1(artifact.policy);
}
