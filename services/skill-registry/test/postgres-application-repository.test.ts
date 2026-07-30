import { describe, expect, it } from "vitest";
import type { ObjectRefV1 } from "@pai/object-store";
import {
  verifyOwnerRepositoryDeploymentFromPostgresV1,
  type PostgresQueryPortV1,
} from "@pai/persistence";

import {
  canonicalHashV1,
  sha256BytesV1,
} from "../src/canonical.v1.js";
import {
  SkillRegistryDurableValidationRepositoryV1,
  createSkillRegistryPostgresApplicationRepositoryV1,
  type SkillRegistryValidationTerminalStorePortV1,
  type SkillValidationTerminalFactV1,
} from "../src/db/postgres-application-repository.v1.js";
import { SKILL_REGISTRY_REPOSITORY_CONTRACT_V1 } from "../src/db/permission-manifest.v1.js";
import {
  SkillRegistryApplicationErrorV1,
  type SkillPackageManifestV1,
  type SkillValidateRequestV1,
} from "../src/skill-registry-application.v1.js";

const packageDigest = sha256BytesV1("durable skill package");
const skillManifest = Object.freeze({
  schema_version: "skill_package_manifest.v1",
  runtime_target: "filesystem_bundle.v1",
  files: Object.freeze([
    Object.freeze({
      path: "SKILL.md",
      mode: "0644",
      size_bytes: 32,
      sha256: sha256BytesV1("skill instructions"),
    }),
  ]),
} satisfies SkillPackageManifestV1);
const manifestDigest = canonicalHashV1(skillManifest);
const createdAt = "2026-07-27T03:00:00.000Z";
const expiresAt = "2026-07-27T03:30:00.000Z";

function validationRequest(
  overrides: Partial<SkillValidateRequestV1> = {},
): SkillValidateRequestV1 {
  return Object.freeze({
    schema_version: "skill_validate_request.v1",
    artifact_ref:
      "oref_skill_validation_restart" as ObjectRefV1,
    content_digest: packageDigest,
    media_type: "application/vnd.pai.skill+tar",
    size_bytes: 21,
    idempotency_key: `validate:${packageDigest}`,
    trace_id: "trace_skill_validation_restart",
    ...overrides,
  });
}

function approvedCommit(
  repository: SkillRegistryDurableValidationRepositoryV1,
  request = validationRequest(),
): Parameters<
  SkillRegistryDurableValidationRepositoryV1["commitValidation"]
>[0] {
  return {
    request,
    request_hash: canonicalHashV1(request),
    artifact: {
      artifact_ref: request.artifact_ref as ObjectRefV1,
      object_access_decision_ref: "oad_skill_upload_1",
      owner_object_id: "skill_upload_reservation_1",
      owner_state_version: 1,
      skill_id: "skill_lark_doc",
      skill_name: "lark-doc",
      proposed_version: "1.0.0",
      media_type: request.media_type,
      provenance: { source: "test" },
      validation_result: { malware_scan: "passed" },
      scanner_versions: { clamav: "1.4.2" },
      diagnostics: [],
    },
    package_digest: packageDigest,
    manifest_digest: manifestDigest,
    manifest: skillManifest,
    size_bytes: request.size_bytes,
    expires_at: expiresAt,
    actor_principal_id: "skill_validator",
    now: createdAt,
  };
}

function rejectedCommit(
  request = validationRequest(),
): Parameters<
  SkillRegistryDurableValidationRepositoryV1["recordValidationFailure"]
>[0] {
  return {
    request,
    request_hash: canonicalHashV1(request),
    error: {
      code: "invalid_skill_package",
      message: "package manifest is unsafe or non-canonical",
      details: {
        diagnostics: [
          {
            severity: "error",
            code: "unsafe_entry",
            path: "payload/link",
            message: "links are forbidden",
          },
        ],
      },
    },
    expires_at: expiresAt,
    actor_principal_id: "skill_validator",
    now: createdAt,
  };
}

class SharedDurableValidationStoreV1
  implements SkillRegistryValidationTerminalStorePortV1
{
  public readonly durability = "postgresql" as const;
  public readonly terminals = new Map<
    string,
    SkillValidationTerminalFactV1
  >();
  public readonly validations = new Map<string, unknown>();
  public settleCount = 0;
  public disconnectAfterNextCommit = false;

  public async checkReadiness(): Promise<void> {}

  public async readTerminal(
    idempotencyKey: string,
  ): Promise<unknown | undefined> {
    const fact = this.terminals.get(idempotencyKey);
    return fact === undefined ? undefined : structuredClone(fact);
  }

  public async settleTerminal(
    candidate: SkillValidationTerminalFactV1,
  ): Promise<unknown> {
    this.settleCount += 1;
    const existing = this.terminals.get(candidate.idempotency_key);
    const settled = existing ?? structuredClone(candidate);
    if (existing === undefined) {
      this.terminals.set(candidate.idempotency_key, settled);
      if (settled.outcome === "approved") {
        this.validations.set(
          settled.validation_record.validation_id,
          structuredClone(settled.validation_record),
        );
      }
    }
    if (this.disconnectAfterNextCommit) {
      this.disconnectAfterNextCommit = false;
      throw new Error("simulated commit-then-disconnect");
    }
    return structuredClone(settled);
  }

  public async readValidation(
    validationId: string,
  ): Promise<unknown | undefined> {
    const validation = this.validations.get(validationId);
    return validation === undefined
      ? undefined
      : structuredClone(validation);
  }
}

async function expectApplicationCode(
  promise: Promise<unknown>,
  code: string,
): Promise<SkillRegistryApplicationErrorV1> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(
      SkillRegistryApplicationErrorV1,
    );
    expect(
      (error as SkillRegistryApplicationErrorV1).code,
    ).toBe(code);
    return error as SkillRegistryApplicationErrorV1;
  }
  throw new Error(`expected ${code}`);
}

describe("Skill Registry durable PostgreSQL validation boundary", () => {
  it("replays an exact approved terminal after a new instance and commit-then-disconnect", async () => {
    const store = new SharedDurableValidationStoreV1();
    const beforeRestart =
      new SkillRegistryDurableValidationRepositoryV1(store);
    const commit = approvedCommit(beforeRestart);
    store.disconnectAfterNextCommit = true;

    await expect(
      beforeRestart.commitValidation(commit),
    ).rejects.toThrow("simulated commit-then-disconnect");

    const afterRestart =
      new SkillRegistryDurableValidationRepositoryV1(store);
    const replay = await afterRestart.replayValidation(
      commit.request,
      commit.request_hash,
      commit.actor_principal_id,
      "2026-07-27T03:05:00.000Z",
    );
    expect(replay).toMatchObject({
      package_digest: packageDigest,
      manifest_digest: manifestDigest,
      expires_at: expiresAt,
    });
    expect(store.settleCount).toBe(1);

    const validation = await afterRestart.readValidation(
      replay!.validation_id,
    );
    expect(validation).toMatchObject({
      validation_id: replay!.validation_id,
      owner_object_id: "skill_upload_reservation_1",
      owner_state_version: 1,
      staging_state_version: 1,
      status: "approved",
    });
  });

  it("replays the exact rejected evidence after restart without rescanning", async () => {
    const store = new SharedDurableValidationStoreV1();
    const first =
      new SkillRegistryDurableValidationRepositoryV1(store);
    const commit = rejectedCommit();
    const firstError = await expectApplicationCode(
      first.recordValidationFailure(commit),
      "invalid_skill_package",
    );

    const restarted =
      new SkillRegistryDurableValidationRepositoryV1(store);
    const replayError = await expectApplicationCode(
      restarted.replayValidation(
        commit.request,
        commit.request_hash,
        commit.actor_principal_id,
        "2026-07-27T03:05:00.000Z",
      ),
      "invalid_skill_package",
    );
    expect(replayError.message).toBe(firstError.message);
    expect(replayError.details).toEqual(firstError.details);
    expect(store.settleCount).toBe(1);
  });

  it("rejects request-hash drift and malformed terminal branches", async () => {
    const store = new SharedDurableValidationStoreV1();
    const repository =
      new SkillRegistryDurableValidationRepositoryV1(store);
    const commit = approvedCommit(repository);
    await repository.commitValidation(commit);
    const driftedRequest = validationRequest({
      trace_id: "trace_drifted",
    });
    await expectApplicationCode(
      repository.replayValidation(
        driftedRequest,
        canonicalHashV1(driftedRequest),
        commit.actor_principal_id,
        "2026-07-27T03:05:00.000Z",
      ),
      "idempotency_conflict",
    );

    const stored = store.terminals.get(
      commit.request.idempotency_key,
    )!;
    store.terminals.set(
      commit.request.idempotency_key,
      {
        ...stored,
        unexpected_branch: "caller-controlled",
      } as unknown as SkillValidationTerminalFactV1,
    );
    await expect(
      repository.replayValidation(
        commit.request,
        commit.request_hash,
        commit.actor_principal_id,
        "2026-07-27T03:05:00.000Z",
      ),
    ).rejects.toThrow("non-exact success branch");
  });

  it("rejects cross-principal replay before returning cached validation evidence", async () => {
    const store = new SharedDurableValidationStoreV1();
    const repository =
      new SkillRegistryDurableValidationRepositoryV1(store);
    const commit = approvedCommit(repository);
    await repository.commitValidation(commit);

    await expectApplicationCode(
      repository.replayValidation(
        commit.request,
        commit.request_hash,
        "different_skill_validator",
        "2026-07-27T03:05:00.000Z",
      ),
      "idempotency_conflict",
    );
  });

  it("rejects malformed production dependencies after writer artifacts are pinned", () => {
    expect(() =>
      createSkillRegistryPostgresApplicationRepositoryV1(
        {} as never,
      ),
    ).toThrow("dependencies are not durable owner capabilities");
  });

  it("continues into live PostgreSQL verification once writer artifacts are pinned", async () => {
    let queryCount = 0;
    const postgres: PostgresQueryPortV1 = {
      async query() {
        queryCount += 1;
        throw new Error("catalog query must not run");
      },
    };
    await expect(
      verifyOwnerRepositoryDeploymentFromPostgresV1(
        SKILL_REGISTRY_REPOSITORY_CONTRACT_V1,
        postgres,
        {
          expected_schema_owner: "pai_migrator",
          runtime_postgres: postgres,
        },
      ),
    ).rejects.toThrow("catalog query must not run");
    expect(queryCount).toBeGreaterThan(0);
  });

  it("pins validation settlement, staging CAS, and immutable DLQ resolution ABIs", () => {
    const settle =
      SKILL_REGISTRY_REPOSITORY_CONTRACT_V1.function_signatures.find(
        ({ function_name }) =>
          function_name === "settle_skill_validation_v1",
      );
    expect(settle).toMatchObject({
      primary_table: "skill_validation_attempts",
      writer_kind: "immutable_append",
      reads_tables: [
        "skill_validation_attempts",
        "skill_version_staging",
      ],
      writes_tables: [
        "skill_validation_attempts",
        "skill_version_staging",
        "skill_audit_logs",
      ],
    });
    expect(
      settle!.arguments.map(({ argument_name }) => argument_name),
    ).toEqual([
      "p_attempt_id",
      "p_outcome",
      "p_request",
      "p_request_hash",
      "p_validation_record",
      "p_success",
      "p_error",
      "p_response_hash",
      "p_terminal_fingerprint",
      "p_idempotency_key",
      "p_expires_at",
      "p_actor_principal_id",
      "p_trace_id",
    ]);

    const publish =
      SKILL_REGISTRY_REPOSITORY_CONTRACT_V1.function_signatures.find(
        ({ function_name }) =>
          function_name === "publish_skill_version_v1",
      );
    expect(
      publish!.arguments.map(({ argument_name }) => argument_name),
    ).toContain("p_expected_staging_state_version");
    expect(
      publish!.arguments.map(({ argument_name }) => argument_name),
    ).not.toContain("p_expected_staging_updated_at");
    expect(
      SKILL_REGISTRY_REPOSITORY_CONTRACT_V1.dlq_resolutions,
    ).toEqual([
      {
        dlq_table: "skill_event_dlq",
        resolution_table: "skill_event_dlq_resolutions",
        resolve_writer: "resolve_skill_event_dlq_v1",
      },
    ]);
  });
});
