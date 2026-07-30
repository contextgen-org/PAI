import { randomUUID } from "node:crypto";

import type {
  ObjectStorePortV1,
  ObjectStoreReconciliationPortV1,
} from "@pai/object-store";
import {
  ObjectStoreReconciliationWorkerV1,
  createPostgresObjectMetadataRepositoryV1,
  createSupabaseStorageAdapterV1,
  type ObjectAccessPolicyVerifierV1,
  type VerifyObjectAccessDecisionInputV1,
} from "@pai/object-store/composition";
import type {
  VerifiedOwnerPostgresCompositionV1,
} from "@pai/persistence";
import { isTrustedLocalDockerHttpOriginV1 } from "@pai/service-kit";
import { Pool } from "pg";

import { canonicalHashV1 } from "./canonical.v1.js";
import { SKILL_REGISTRY_REPOSITORY_CONTRACT_V1 } from "./db/permission-manifest.v1.js";
import type {
  SkillObjectAccessDecisionRequestV1,
  SkillObjectAccessDecisionResolverPortV1,
} from "./skill-registry-application.v1.js";

const RETENTION_POLICY_VERSION_V1 = "skill-package-retention.v1";
const REDACTION_POLICY_VERSION_V1 = "skill-package-no-redaction.v1";
const DECISION_TTL_MILLISECONDS_V1 = 90_000;
const SKILL_REGISTRY_ADAPTER_READINESS_TIMEOUT_MS_V1 = 25_000;

type SkillRegistryPostgresCompositionV1 = VerifiedOwnerPostgresCompositionV1<
  typeof SKILL_REGISTRY_REPOSITORY_CONTRACT_V1
>;

export interface SkillRegistryObjectStoreOptionsV1 {
  readonly database_url: string;
  readonly reconciler_database_url: string;
  readonly supabase_url: string;
  readonly supabase_secret_key: string;
  readonly worker_id: string;
  readonly composition: SkillRegistryPostgresCompositionV1;
  readonly reconciliation_interval_ms?: number;
  readonly fetch?: typeof fetch;
  readonly now?: () => Date;
}

export interface SkillRegistryObjectStoreCompositionV1 {
  readonly object_store: ObjectStorePortV1;
  readonly object_access_decisions: SkillObjectAccessDecisionResolverPortV1;
  start(): void;
  checkReadiness(signal: AbortSignal): Promise<void>;
  close(): Promise<void>;
}

interface CanonicalRetentionRowV1 extends Record<string, unknown> {
  readonly retention_until: Date | string;
}

interface DecisionRowV1 extends Record<string, unknown> {
  readonly id: string;
  readonly owner_object_id: string;
  readonly owner_state_version: number | string;
  readonly object_ref: string;
  readonly operation: string;
  readonly purpose: string;
  readonly capability: string;
  readonly scope_kind: string;
  readonly prior_access_decision_ref: string;
  readonly retention_policy_version: string;
  readonly redaction_policy_version: string;
  readonly decision: string;
  readonly expires_at: Date | string;
}

const identifierPatternV1 = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;

function storageBaseUrlV1(raw: string): string {
  const url = new URL(raw);
  const loopback =
    url.hostname === "127.0.0.1" ||
    url.hostname === "[::1]" ||
    url.hostname === "localhost";
  if (
    (url.protocol !== "https:" &&
      !(url.protocol === "http:" &&
        (loopback || isTrustedLocalDockerHttpOriginV1(url)))) ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.search.length > 0 ||
    url.hash.length > 0
  ) {
    throw new Error("PAI_SUPABASE_URL is invalid");
  }
  return url.toString().replace(/\/$/u, "");
}

function safeSecretV1(value: string): string {
  if (
    typeof value !== "string" ||
    value.length < 16 ||
    value.length > 16_384 ||
    /[\r\n\u0000]/u.test(value)
  ) {
    throw new Error("PAI_SUPABASE_SECRET_KEY is invalid");
  }
  return value;
}

function canonicalTimestampV1(value: Date | string, label: string): string {
  const instant = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(instant.getTime())) {
    throw new Error(`${label} is invalid`);
  }
  return instant.toISOString();
}

function assertDecisionRequestV1(
  request: SkillObjectAccessDecisionRequestV1,
): void {
  if (
    request.owner_service !== "skill_registry" ||
    request.scope.scope_kind !== "global" ||
    request.capability !== "skill.content.read" ||
    !["head", "get", "grant"].includes(request.operation) ||
    !["publish_integrity_check", "runtime_content_read"].includes(
      request.purpose,
    ) ||
    typeof request.owner_object_id !== "string" ||
    request.owner_object_id.length === 0 ||
    !Number.isSafeInteger(request.owner_state_version) ||
    request.owner_state_version < 1 ||
    typeof request.object_ref !== "string" ||
    request.object_ref.length === 0 ||
    typeof request.prior_access_decision_ref !== "string" ||
    request.prior_access_decision_ref.length === 0 ||
    typeof request.trace_id !== "string" ||
    request.trace_id.length === 0
  ) {
    throw new Error("Skill Registry ObjectStore access decision is invalid");
  }
  if (
    request.purpose === "publish_integrity_check" &&
    request.operation !== "get"
  ) {
    throw new Error("Skill validation may only issue a package get decision");
  }
}

async function readCanonicalRetentionV1(
  composition: SkillRegistryPostgresCompositionV1,
  request: SkillObjectAccessDecisionRequestV1,
): Promise<string> {
  const result = await composition.read_committed_postgres
    .withReadCommittedTransaction(async (transaction) => {
      if (request.purpose === "publish_integrity_check") {
        return transaction.query<CanonicalRetentionRowV1>(
          `SELECT staging.validation_expires_at AS retention_until
             FROM skill_registry.skill_version_staging AS staging
            WHERE staging.owner_object_id = $1::text
              AND staging.owner_state_version = $2::bigint
              AND staging.artifact_ref = $3::text
              AND staging.object_access_decision_ref = $4::text
              AND staging.status IN ('draft', 'validating', 'review_pending')
              AND staging.validation_expires_at > pg_catalog.clock_timestamp()
            LIMIT 2`,
          [
            request.owner_object_id,
            request.owner_state_version,
            request.object_ref,
            request.prior_access_decision_ref,
          ],
        );
      }
      return transaction.query<CanonicalRetentionRowV1>(
        `SELECT package.retention_until
           FROM skill_registry.skill_packages AS package
           JOIN skill_registry.skill_versions AS version
             ON version.id = package.version_id
           JOIN skill_registry.skill_version_staging AS staging
             ON staging.id = version.validation_id
          WHERE package.owner_object_id = $1::text
            AND package.owner_state_version = $2::bigint
            AND package.package_ref = $3::text
            AND package.object_access_decision_ref = $4::text
            AND package.retention_state = 'retained'
            AND package.retention_until > pg_catalog.clock_timestamp()
          LIMIT 2`,
        [
          request.owner_object_id,
          request.owner_state_version,
          request.object_ref,
          request.prior_access_decision_ref,
        ],
      );
    });
  if (result.rows.length !== 1) {
    throw new Error("Skill package is not a canonical readable owner object");
  }
  return canonicalTimestampV1(result.rows[0]!.retention_until, "Skill package retention");
}

function decisionAuditRowV1(
  decisionId: string,
  request: SkillObjectAccessDecisionRequestV1,
  createdAt: string,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    id: `skill_object_access_audit:${decisionId}`,
    skill_id: null,
    version_id: null,
    runtime_run_id: null,
    application_id: null,
    actor: "skill_registry",
    action: "object_access_decision_issued",
    decision: "allow",
    reason_code: request.purpose,
    evidence_refs: [request.prior_access_decision_ref],
    payload: {
      decision_id: decisionId,
      operation: request.operation,
      object_ref: request.object_ref,
      owner_object_id: request.owner_object_id,
      owner_state_version: request.owner_state_version,
    },
    trace_id: request.trace_id,
    created_at: createdAt,
  });
}

function createObjectAccessDecisionsV1(options: Readonly<{
  composition: SkillRegistryPostgresCompositionV1;
  now: () => Date;
}>): SkillObjectAccessDecisionResolverPortV1 {
  return Object.freeze({
    durability: "durable" as const,
    async checkReadiness(): Promise<void> {
      await options.composition.checkReadiness(
        AbortSignal.timeout(SKILL_REGISTRY_ADAPTER_READINESS_TIMEOUT_MS_V1),
      );
      await options.composition.read_committed_postgres
        .withReadCommittedTransaction(async (transaction) => {
          const result = await transaction.query<{ relation: string | null }>(
            "SELECT to_regclass('skill_registry.skill_object_access_decisions')::text AS relation",
          );
          if (result.rows.length !== 1 || result.rows[0]?.relation !== "skill_registry.skill_object_access_decisions") {
            throw new Error("Skill ObjectStore decision table is unavailable");
          }
        });
    },
    async resolve(request: SkillObjectAccessDecisionRequestV1) {
      assertDecisionRequestV1(request);
      const retentionUntil = await readCanonicalRetentionV1(
        options.composition,
        request,
      );
      const createdAt = options.now();
      const expiresAtMs = Math.min(
        Date.parse(retentionUntil),
        createdAt.getTime() + DECISION_TTL_MILLISECONDS_V1,
      );
      if (!Number.isFinite(expiresAtMs) || expiresAtMs <= createdAt.getTime()) {
        throw new Error("Skill package retention expires before access can be issued");
      }
      const decisionId = `skill_object_access_${randomUUID()}`;
      const expiresAt = new Date(expiresAtMs).toISOString();
      const decision = Object.freeze({
        id: decisionId,
        owner_object_id: request.owner_object_id,
        owner_state_version: request.owner_state_version,
        object_ref: request.object_ref,
        operation: request.operation,
        purpose: request.purpose,
        capability: request.capability,
        scope_kind: "global",
        prior_access_decision_ref: request.prior_access_decision_ref,
        retention_policy_version: RETENTION_POLICY_VERSION_V1,
        redaction_policy_version: REDACTION_POLICY_VERSION_V1,
        decision: "allow",
        expires_at: expiresAt,
        trace_id: request.trace_id,
        skill_audit_logs: [
          decisionAuditRowV1(decisionId, request, createdAt.toISOString()),
        ],
      });
      await options.composition.unit_of_work.withTransaction(
        {
          operation: "skill_object_access_decision",
          idempotency_key: decisionId,
          trace_id: request.trace_id,
          isolation: "serializable",
          retry: "serialization_failures",
        },
        async (transaction, { owner }) => {
          await owner.executeWriter<unknown, "record_skill_object_access_decision_v1">(
            transaction,
            {
              writer: "record_skill_object_access_decision_v1",
              arguments: {
                p_decision_id: decisionId,
                p_decision: decision,
                p_idempotency_key: decisionId,
                p_request_hash: canonicalHashV1(decision),
                p_trace_id: request.trace_id,
              },
              expected_rows: 1,
            },
          );
        },
      );
      return Object.freeze({
        access_decision_ref: decisionId,
        retention_policy_version: RETENTION_POLICY_VERSION_V1,
        redaction_policy_version: REDACTION_POLICY_VERSION_V1,
      });
    },
  });
}

function createObjectAccessVerifierV1(options: Readonly<{
  composition: SkillRegistryPostgresCompositionV1;
  now: () => Date;
}>): ObjectAccessPolicyVerifierV1 {
  return Object.freeze({
    async verify(input: VerifyObjectAccessDecisionInputV1) {
      if (
        input.owner_service !== "skill_registry" ||
        input.scope.scope_kind !== "global" ||
        input.capability !== "skill.content.read" ||
        (input.operation !== "head" &&
          input.operation !== "get" &&
          input.operation !== "grant") ||
        input.retention_policy_version !== RETENTION_POLICY_VERSION_V1 ||
        input.redaction_policy_version !== REDACTION_POLICY_VERSION_V1
      ) {
        throw new Error("Skill ObjectStore operation is denied");
      }
      const decisionResult = await options.composition.read_committed_postgres
        .withReadCommittedTransaction((transaction) =>
          transaction.query<DecisionRowV1>(
            `SELECT id, owner_object_id, owner_state_version, object_ref, operation,
                    purpose, capability, scope_kind, prior_access_decision_ref,
                    retention_policy_version, redaction_policy_version, decision, expires_at
               FROM skill_registry.skill_object_access_decisions
              WHERE id = $1::text
                AND owner_object_id = $2::text
                AND owner_state_version = $3::bigint
                AND object_ref = $4::text
                AND operation = $5::text
                AND capability = $6::text
                AND scope_kind = 'global'
                AND retention_policy_version = $7::text
                AND redaction_policy_version = $8::text
                AND decision = 'allow'
                AND expires_at > pg_catalog.clock_timestamp()
              LIMIT 2`,
            [
              input.access_decision_ref,
              input.owner_object_id,
              input.owner_state_version,
              input.object_ref,
              input.operation,
              input.capability,
              input.retention_policy_version,
              input.redaction_policy_version,
            ],
          ),
        );
      if (decisionResult.rows.length !== 1) {
        throw new Error("Skill ObjectStore access decision is absent, expired, or unbound");
      }
      const row = decisionResult.rows[0]!;
      const retentionRequest: SkillObjectAccessDecisionRequestV1 = {
        operation: input.operation,
        owner_service: "skill_registry",
        owner_object_id: input.owner_object_id,
        owner_state_version: input.owner_state_version,
        scope: { scope_kind: "global" },
        capability: "skill.content.read",
        object_ref: input.object_ref,
        prior_access_decision_ref: row.prior_access_decision_ref,
        purpose: row.purpose === "publish_integrity_check"
          ? "publish_integrity_check"
          : "runtime_content_read",
        trace_id: "skill_object_access_verifier",
      };
      const retentionUntil = await readCanonicalRetentionV1(
        options.composition,
        retentionRequest,
      );
      const expiresAt = Date.parse(canonicalTimestampV1(row.expires_at, "Skill access decision expiry"));
      if (
        !Number.isFinite(expiresAt) ||
        expiresAt <= options.now().getTime() ||
        Date.parse(retentionUntil) <= options.now().getTime()
      ) {
        throw new Error("Skill ObjectStore access decision has expired");
      }
      return Object.freeze({
        ...input,
        authorized: true as const,
        retention_until: retentionUntil,
      });
    },
  });
}

export async function openSkillRegistryObjectStoreV1(
  options: SkillRegistryObjectStoreOptionsV1,
): Promise<SkillRegistryObjectStoreCompositionV1> {
  if (!identifierPatternV1.test(options.worker_id)) {
    throw new Error("Skill Registry ObjectStore worker_id is invalid");
  }
  const intervalMs = options.reconciliation_interval_ms ?? 5_000;
  if (!Number.isSafeInteger(intervalMs) || intervalMs < 100 || intervalMs > 300_000) {
    throw new Error("Skill Registry ObjectStore interval is invalid");
  }
  const supabaseUrl = storageBaseUrlV1(options.supabase_url);
  const secretKey = safeSecretV1(options.supabase_secret_key);
  const allowInsecureLocalDockerTransport = isTrustedLocalDockerHttpOriginV1(
    new URL(supabaseUrl),
  );
  const fetchImpl = options.fetch ?? fetch;
  const now = options.now ?? (() => new Date());
  const foregroundPool = new Pool({
    connectionString: options.database_url,
    application_name: "pai_skill_registry_object_store",
    max: 4,
    connectionTimeoutMillis: 5_000,
  });
  const reconcilerPool = new Pool({
    connectionString: options.reconciler_database_url,
    application_name: "pai_skill_registry_object_store_reconciler",
    max: 2,
    connectionTimeoutMillis: 5_000,
  });
  let closed = false;

  const checkStorageV1 = async (signal?: AbortSignal): Promise<void> => {
    signal?.throwIfAborted();
    const response = await fetchImpl(`${supabaseUrl}/storage/v1/status`, {
      method: "GET",
      redirect: "error",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${secretKey}`,
        apikey: secretKey,
      },
      ...(signal === undefined ? {} : { signal }),
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw new Error("Supabase Storage readiness endpoint is unavailable");
    }
    await response.body?.cancel().catch(() => undefined);
    signal?.throwIfAborted();
  };

  const checkDatabaseV1 = async (signal?: AbortSignal): Promise<void> => {
    signal?.throwIfAborted();
    const [foreground, reconciler] = await Promise.all([
      foregroundPool.query<{ function_count: string | number; all_granted: boolean }>(`SELECT
        count(*)::text AS function_count,
        COALESCE(bool_and(pg_catalog.has_function_privilege(current_user, p.oid, 'EXECUTE')), false) AS all_granted
      FROM pg_catalog.pg_proc AS p
      JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
      WHERE n.nspname = 'object_store'
        AND p.proname IN ('reserve_object_operation_v1','finalize_object_operation_v1')`),
      reconcilerPool.query<{ function_count: string | number; all_granted: boolean }>(`SELECT
        count(*)::text AS function_count,
        COALESCE(bool_and(pg_catalog.has_function_privilege(current_user, p.oid, 'EXECUTE')), false) AS all_granted
      FROM pg_catalog.pg_proc AS p
      JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
      WHERE n.nspname = 'object_store'
        AND p.proname IN ('claim_expired_object_reconcile_v1','settle_object_reconcile_v1')`),
    ]);
    const foregroundRow = foreground.rows[0];
    const reconcilerRow = reconciler.rows[0];
    if (
      Number(foregroundRow?.function_count) !== 2 ||
      foregroundRow?.all_granted !== true ||
      Number(reconcilerRow?.function_count) !== 2 ||
      reconcilerRow?.all_granted !== true
    ) {
      throw new Error("ObjectStore PostgreSQL runtime grants are incomplete");
    }
    signal?.throwIfAborted();
  };

  try {
    await checkDatabaseV1();
    await checkStorageV1();
    const objectAccessDecisions = createObjectAccessDecisionsV1({
      composition: options.composition,
      now,
    });
    const verifier = createObjectAccessVerifierV1({
      composition: options.composition,
      now,
    });
    await objectAccessDecisions.checkReadiness();
    const metadataRepository = createPostgresObjectMetadataRepositoryV1({
      pool: foregroundPool,
      reconcilerPool,
      ownerService: "skill_registry",
      clock: now,
    });
    const terminalProofReconciler = Object.freeze({
      kind: "object-store-terminal-proof-reconciler.v1" as const,
      async reconcileTerminalProofs(): Promise<void> {
        await Promise.all([checkDatabaseV1(), checkStorageV1()]);
      },
    });
    const adapter = createSupabaseStorageAdapterV1({
      url: supabaseUrl,
      secretKey,
      allow_insecure_local_docker_transport: allowInsecureLocalDockerTransport,
      metadataRepository,
      terminalProofReconciler,
      accessPolicyVerifier: verifier,
      policies: [
        {
          owner_service: "skill_registry",
          object_class: "skill_package",
          bucket: "skill-packages",
          scope_kinds: ["global"],
          max_size_bytes: 64 * 1024 * 1024,
          media_types: ["application/vnd.pai.skill-bundle"],
          capabilities: {
            put: ["skill.package.write"],
            head: ["skill.content.read"],
            get: ["skill.content.read"],
            grant: ["skill.content.read"],
            delete: ["skill.package.delete"],
          },
        },
      ],
      now,
      fetch: fetchImpl,
    });
    const reconciliation = adapter as ObjectStorePortV1 & ObjectStoreReconciliationPortV1;
    const worker = new ObjectStoreReconciliationWorkerV1({
      reconciliation,
      worker_id: options.worker_id,
      interval_ms: intervalMs,
      batch_limit: 25,
      lease_seconds: 30,
    });
    return Object.freeze({
      object_store: adapter,
      object_access_decisions: objectAccessDecisions,
      start() {
        if (closed) throw new Error("Skill Registry ObjectStore is closed");
        worker.start();
      },
      async checkReadiness(signal: AbortSignal) {
        if (closed) throw new Error("Skill Registry ObjectStore is closed");
        await Promise.all([
          checkDatabaseV1(signal),
          checkStorageV1(signal),
          objectAccessDecisions.checkReadiness(),
        ]);
        signal.throwIfAborted();
      },
      async close() {
        if (closed) return;
        closed = true;
        try {
          await worker.stop();
        } finally {
          await Promise.allSettled([foregroundPool.end(), reconcilerPool.end()]);
        }
      },
    });
  } catch (error) {
    closed = true;
    await Promise.allSettled([foregroundPool.end(), reconcilerPool.end()]);
    throw error;
  }
}
