import type { ObjectStorePortV1 } from "@pai/object-store";
import type { VerifiedOwnerPostgresCompositionV1 } from "@pai/persistence";

import { SKILL_REGISTRY_REPOSITORY_CONTRACT_V1 } from "./db/permission-manifest.v1.js";
import type {
  SkillObjectAccessDecisionResolverPortV1,
  SkillValidateRequestV1,
  SkillValidationArtifactReaderPortV1,
} from "./skill-registry-application.v1.js";

const SKILL_REGISTRY_ADAPTER_READINESS_TIMEOUT_MS_V1 = 25_000;

type SkillRegistryPostgresCompositionV1 = VerifiedOwnerPostgresCompositionV1<
  typeof SKILL_REGISTRY_REPOSITORY_CONTRACT_V1
>;

interface StagingArtifactRowV1 extends Record<string, unknown> {
  readonly artifact_ref: string;
  readonly object_access_decision_ref: string;
  readonly owner_object_id: string;
  readonly owner_state_version: number | string;
  readonly skill_id: string;
  readonly skill_name: string;
  readonly proposed_version: string;
  readonly media_type: string;
  readonly provenance: Record<string, unknown>;
  readonly validation_result: Record<string, unknown>;
  readonly scanner_versions: Record<string, unknown>;
}

function positiveSafeIntegerV1(value: number | string, label: string): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${label} is not a positive safe integer`);
  }
  return parsed;
}

function plainRecordV1(value: unknown, label: string): Readonly<Record<string, unknown>> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null
  ) {
    throw new Error(`${label} is not a plain JSON object`);
  }
  return structuredClone(value) as Readonly<Record<string, unknown>>;
}

async function* abortableBodyV1(
  body: AsyncIterable<Uint8Array>,
  signal: AbortSignal,
): AsyncIterable<Uint8Array> {
  const iterator = body[Symbol.asyncIterator]();
  try {
    for (;;) {
      signal.throwIfAborted();
      const next = await iterator.next();
      signal.throwIfAborted();
      if (next.done) return;
      if (!(next.value instanceof Uint8Array)) {
        throw new Error("ObjectStore returned a non-byte validation chunk");
      }
      yield next.value.slice();
    }
  } finally {
    await iterator.return?.().catch(() => undefined);
  }
}

/**
 * Reads the only validation input the owner recognizes: a durable staging row
 * matched to the request's opaque artifact reference, followed by a newly
 * issued get decision for that exact owner object.  No storage key is ever
 * dereferenced directly from an HTTP request.
 */
export function createSkillRegistryValidationArtifactReaderV1(options: Readonly<{
  composition: SkillRegistryPostgresCompositionV1;
  object_store: ObjectStorePortV1;
  object_access_decisions: SkillObjectAccessDecisionResolverPortV1;
}>): SkillValidationArtifactReaderPortV1 {
  return Object.freeze({
    durability: "durable" as const,
    cancellation_kind: "abort_signal" as const,
    async checkReadiness(): Promise<void> {
      await Promise.all([
        options.composition.checkReadiness(
          AbortSignal.timeout(SKILL_REGISTRY_ADAPTER_READINESS_TIMEOUT_MS_V1),
        ),
        options.object_access_decisions.checkReadiness(),
      ]);
    },
    async readArtifact(request: SkillValidateRequestV1, signal: AbortSignal) {
      signal.throwIfAborted();
      const rowResult = await options.composition.read_committed_postgres
        .withReadCommittedTransaction((transaction) =>
          transaction.query<StagingArtifactRowV1>(
            `SELECT artifact_ref, object_access_decision_ref, owner_object_id,
                    owner_state_version, skill_id, skill_name, proposed_version,
                    media_type, provenance, validation_result, scanner_versions
               FROM skill_registry.skill_version_staging
              WHERE artifact_ref = $1::text
                AND media_type = $2::text
                AND status IN ('draft', 'validating', 'review_pending')
                AND validation_expires_at > pg_catalog.clock_timestamp()
              LIMIT 2`,
            [request.artifact_ref, request.media_type],
          ),
        );
      signal.throwIfAborted();
      if (rowResult.rows.length !== 1) {
        throw new Error("Skill validation artifact is not a readable staged owner object");
      }
      const row = rowResult.rows[0]!;
      const ownerStateVersion = positiveSafeIntegerV1(
        row.owner_state_version,
        "skill_version_staging.owner_state_version",
      );
      const access = await options.object_access_decisions.resolve({
        operation: "get",
        owner_service: "skill_registry",
        owner_object_id: row.owner_object_id,
        owner_state_version: ownerStateVersion,
        scope: { scope_kind: "global" },
        capability: "skill.content.read",
        object_ref: row.artifact_ref as never,
        prior_access_decision_ref: row.object_access_decision_ref,
        purpose: "publish_integrity_check",
        trace_id: request.trace_id,
      });
      signal.throwIfAborted();
      const stream = await options.object_store.getStream({
        owner_service: "skill_registry",
        owner_object_id: row.owner_object_id,
        owner_state_version: ownerStateVersion,
        scope: { scope_kind: "global" },
        capability: "skill.content.read",
        object_ref: row.artifact_ref as never,
        access_decision_ref: access.access_decision_ref,
        retention_policy_version: access.retention_policy_version,
        redaction_policy_version: access.redaction_policy_version,
      });
      signal.throwIfAborted();
      if (
        stream.object_ref !== row.artifact_ref ||
        stream.media_type !== row.media_type ||
        stream.media_type !== request.media_type ||
        stream.size_bytes !== request.size_bytes ||
        stream.sha256 !== request.content_digest
      ) {
        await stream.body[Symbol.asyncIterator]().return?.().catch(() => undefined);
        throw new Error("Skill validation artifact metadata does not bind the request");
      }
      const diagnostics = Array.isArray(row.validation_result.diagnostics)
        ? structuredClone(row.validation_result.diagnostics)
        : [];
      return Object.freeze({
        artifact_ref: row.artifact_ref as never,
        object_access_decision_ref: row.object_access_decision_ref,
        owner_object_id: row.owner_object_id,
        owner_state_version: ownerStateVersion,
        skill_id: row.skill_id,
        skill_name: row.skill_name,
        proposed_version: row.proposed_version,
        media_type: row.media_type,
        body: abortableBodyV1(stream.body, signal),
        provenance: plainRecordV1(row.provenance, "skill_version_staging.provenance"),
        validation_result: plainRecordV1(row.validation_result, "skill_version_staging.validation_result"),
        scanner_versions: plainRecordV1(row.scanner_versions, "skill_version_staging.scanner_versions"),
        diagnostics,
      });
    },
  });
}
