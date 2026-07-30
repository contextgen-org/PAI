import { describe, expect, it, vi } from "vitest";
import { Value } from "@sinclair/typebox/value";
import { SkillRegistryDomainEventV1Schema } from "@pai/contracts";
import type {
  ObjectRefV1,
  ObjectStorePortV1,
} from "@pai/object-store";

import { buildSkillRegistryApp, SKILL_REGISTRY_ROUTES_V1 } from "../src/app.js";
import { canonicalHashV1, sha256BytesV1 } from "../src/canonical.v1.js";
import { SKILL_REGISTRY_REPOSITORY_CONTRACT_V1 } from "../src/db/permission-manifest.v1.js";
import {
  InMemoryRuntimePolicyInputReaderV1,
  InMemorySkillRegistryRepositoryV1,
  InMemorySkillValidationArtifactReaderV1,
  InProcessSkillPackageInspectorV1,
  SkillRegistryApplicationErrorV1,
  SkillRegistryApplicationV1,
  runtimePolicyInputHashV1,
  skillPermissionScopeHashV1,
  type RuntimePolicyInputArtifactV1,
  type SkillActivateRequestV1,
  type SkillCatalogQueryRequestV1,
  type SkillCatalogScopeV1,
  type SkillContentRequestV1,
  type SkillDisableRequestV1,
  type SkillPackageInspectionV1,
  type SkillPackageInspectorPortV1,
  type SkillPackageManifestV1,
  type SkillObjectAccessDecisionRequestV1,
  type SkillObjectAccessDecisionResolverPortV1,
  type SkillPublishRequestV1,
  type SkillRegistryPrincipalV1,
  type SkillResolveRequestV1,
  type SkillRuntimeScopeV1,
  type SkillValidateRequestV1,
  type SkillValidationArtifactReaderPortV1,
  type SkillValidationRecordV1,
} from "../src/skill-registry-application.v1.js";

const packageBytes = Buffer.from("immutable skill package bytes", "utf8");
const packageDigest = sha256BytesV1(packageBytes);
const manifest = Object.freeze({
  schema_version: "skill_package_manifest.v1",
  runtime_target: "filesystem_bundle.v1",
  files: Object.freeze([
    Object.freeze({
      path: "SKILL.md",
      mode: "0644",
      size_bytes: 128,
      sha256: sha256BytesV1("skill markdown"),
    }),
  ]),
} satisfies SkillPackageManifestV1);
const inspection = Object.freeze({
  package_root_name: "lark-doc",
  frontmatter: Object.freeze({
    name: "lark-doc",
    description:
      "Read and update Lark documents when a workflow needs document access.",
  }),
  manifest,
} satisfies SkillPackageInspectionV1);
const manifestDigest = canonicalHashV1(manifest);
const objectRef = "oref_skill_package_1" as ObjectRefV1;

const catalogScope = Object.freeze({
  workspace_id: "ws_1",
  bot_id: "bot_1",
  deployment_environment: "prod",
  release_channel: "stable",
} satisfies SkillCatalogScopeV1);
const runtimeScope = Object.freeze({
  ...catalogScope,
  owner_agent_id: "agent_1",
} satisfies SkillRuntimeScopeV1);

const globalPrincipal = Object.freeze({
  caller: "skill_registry",
  scope: Object.freeze({ scope_kind: "global" }),
  capabilities: Object.freeze(["skill.version.publish"]),
  principal_id: "admin_global",
} satisfies SkillRegistryPrincipalV1);

const validationPrincipal = Object.freeze({
  ...globalPrincipal,
  capabilities: Object.freeze(["skill.package.validate"]),
} satisfies SkillRegistryPrincipalV1);

const releasePrincipal = Object.freeze({
  caller: "skill_registry",
  scope: Object.freeze({ scope_kind: "bot", ...runtimeScope }),
  capabilities: Object.freeze(["skill.version.activate"]),
  principal_id: "release_admin",
} satisfies SkillRegistryPrincipalV1);

const runtimePrincipal = Object.freeze({
  caller: "action_runtime",
  scope: Object.freeze({ scope_kind: "bot", ...runtimeScope }),
  capabilities: Object.freeze(["skill.resolve", "skill.content.read"]),
  principal_id: "runtime_workload",
} satisfies SkillRegistryPrincipalV1);

const metaPrincipal = Object.freeze({
  caller: "meta_cognition",
  scope: Object.freeze({ scope_kind: "bot", ...runtimeScope }),
  capabilities: Object.freeze(["skill.candidate.apply"]),
  principal_id: "reviewer_01",
} satisfies SkillRegistryPrincipalV1);

const catalogPrincipal = Object.freeze({
  caller: "trigger_processor",
  scope: Object.freeze({ scope_kind: "bot", ...runtimeScope }),
  capabilities: Object.freeze(["skill.catalog.read"]),
  principal_id: "trigger_processor_catalog",
} satisfies SkillRegistryPrincipalV1);

const contextCatalogPrincipal = Object.freeze({
  caller: "trigger_processor",
  scope: Object.freeze({ scope_kind: "bot", ...runtimeScope }),
  capabilities: Object.freeze(["skill.context_catalog.read"]),
  principal_id: "trigger_processor_context_catalog",
} satisfies SkillRegistryPrincipalV1);

const managementPrincipal = Object.freeze({
  caller: "skill_registry",
  scope: Object.freeze({ scope_kind: "bot", ...runtimeScope }),
  capabilities: Object.freeze([
    "skill.version.activate",
    "skill.version.rollback",
    "skill.activation.disable",
    "skill.permission.grant",
    "skill.permission.revoke",
  ]),
  principal_id: "registry_release_admin",
} satisfies SkillRegistryPrincipalV1);

const lifecyclePrincipal = Object.freeze({
  ...globalPrincipal,
  capabilities: Object.freeze([
    "skill.version.deprecate",
    "skill.version.revoke",
  ]),
} satisfies SkillRegistryPrincipalV1);

function candidateApplication(
  overrides: Readonly<Record<string, unknown>> = {},
) {
  return {
    schema_version: "skill_candidate_application.v1",
    application_id: "application_01",
    candidate_id: "candidate_01",
    review_version: 1,
    candidate_type: "new_skill",
    skill_key: "candidate-skill",
    ...runtimeScope,
    baseline_catalog_version: "cat_0",
    proposal_ref: "proposal_01",
    proposal_hash: sha256BytesV1("proposal"),
    evidence_refs: [
      {
        ref: "evidence_01",
        hash: sha256BytesV1("evidence"),
      },
    ],
    reviewer_principal_id: "reviewer_01",
    idempotency_key: "candidate:application_01:1",
    trace_id: "trace_candidate",
    ...overrides,
  } as const;
}

class FakeObjectStoreV1 implements ObjectStorePortV1 {
  public unavailable = false;
  public grantCount = 0;
  public readonly headRequests: Parameters<ObjectStorePortV1["head"]>[0][] = [];
  public readonly getRequests: Parameters<ObjectStorePortV1["getStream"]>[0][] =
    [];
  public readonly grantRequests: Parameters<
    ObjectStorePortV1["issueReadGrant"]
  >[0][] = [];

  public constructor(private readonly now: () => Date) {}

  public async putImmutable(): Promise<never> {
    throw new Error("not used");
  }

  public async head(
    request: Parameters<ObjectStorePortV1["head"]>[0],
  ) {
    if (this.unavailable) throw new Error("storage unavailable");
    this.headRequests.push(structuredClone(request));
    return {
      object_ref: objectRef,
      version: "object_version_1",
      sha256: packageDigest,
      size_bytes: packageBytes.byteLength,
      media_type: "application/zip",
      retention_until: "2030-01-01T00:00:00.000Z",
    };
  }

  public async getStream(
    request: Parameters<ObjectStorePortV1["getStream"]>[0],
  ) {
    if (this.unavailable) throw new Error("storage unavailable");
    this.getRequests.push(structuredClone(request));
    return {
      object_ref: objectRef,
      version: "object_version_1",
      sha256: packageDigest,
      size_bytes: packageBytes.byteLength,
      media_type: "application/zip",
      retention_until: "2030-01-01T00:00:00.000Z",
      body: (async function* () {
        yield packageBytes;
      })(),
    };
  }

  public async issueReadGrant(
    request: Parameters<ObjectStorePortV1["issueReadGrant"]>[0],
  ) {
    if (this.unavailable) throw new Error("storage unavailable");
    this.grantCount += 1;
    this.grantRequests.push(structuredClone(request));
    return {
      grant: `signed-content-${this.grantCount}`,
      object_ref: objectRef,
      expires_at: new Date(
        this.now().getTime() + request.ttl_seconds * 1_000,
      ).toISOString(),
    };
  }

  public async deleteIfEligible(): Promise<never> {
    throw new Error("not used");
  }
}

class FakeSkillObjectAccessDecisionResolverV1
  implements SkillObjectAccessDecisionResolverPortV1
{
  public readonly durability = "memory" as const;
  public readonly requests:
    SkillObjectAccessDecisionRequestV1[] = [];
  #sequence = 0;

  public async checkReadiness(): Promise<void> {}

  public async resolve(
    request: SkillObjectAccessDecisionRequestV1,
  ) {
    this.requests.push(structuredClone(request));
    this.#sequence += 1;
    return {
      access_decision_ref:
        `decision-${request.operation}-${this.#sequence}`,
      retention_policy_version:
        "skill-package-retention.v1",
      redaction_policy_version:
        "skill-package-no-redaction.v1",
    };
  }
}

interface Harness {
  readonly app: SkillRegistryApplicationV1;
  readonly repository: InMemorySkillRegistryRepositoryV1;
  readonly policies: InMemoryRuntimePolicyInputReaderV1;
  readonly validationArtifacts: InMemorySkillValidationArtifactReaderV1;
  readonly objectStore: FakeObjectStoreV1;
  readonly objectAccessDecisions:
    FakeSkillObjectAccessDecisionResolverV1;
  readonly clock: { now: Date };
  readonly validation: SkillValidationRecordV1;
}

function harness(): Harness {
  const clock = { now: new Date("2026-07-24T00:01:00.000Z") };
  const repository = new InMemorySkillRegistryRepositoryV1();
  repository.seedCatalog(
    catalogScope,
    "cat_0",
    "2026-07-24T00:00:00.000Z",
  );
  const validation: SkillValidationRecordV1 = Object.freeze({
    validation_id: "validation_1",
    staging_state_version: 1,
    skill_id: "skill_1",
    skill_name: "lark-doc",
    proposed_version: "1.0.0",
    artifact_ref: objectRef,
    object_access_decision_ref: "decision_publish_1",
    owner_object_id: "skill-staging-1",
    owner_state_version: 1,
    package_digest: packageDigest,
    manifest_digest: manifestDigest,
    manifest,
    runtime_target: "filesystem_bundle.v1",
    status: "approved",
    expires_at: "2026-07-24T01:00:00.000Z",
    media_type: "application/zip",
    size_bytes: packageBytes.byteLength,
    provenance: Object.freeze({ source: "ci" }),
    validation_result: Object.freeze({ accepted: true }),
    scanner_versions: Object.freeze({ scanner: "1" }),
    created_by: "ci",
  });
  repository.seedValidation(validation);
  const policies = new InMemoryRuntimePolicyInputReaderV1();
  const validationArtifacts =
    new InMemorySkillValidationArtifactReaderV1();
  validationArtifacts.seed(
    {
      artifact_ref: objectRef,
      object_access_decision_ref: "decision_staging_1",
      owner_object_id: "skill-staging-1",
      owner_state_version: 1,
      skill_id: "skill_1",
      skill_name: "lark-doc",
      proposed_version: "1.0.0",
      media_type: "application/zip",
      provenance: Object.freeze({ source: "ci" }),
      validation_result: Object.freeze({ accepted: true }),
      scanner_versions: Object.freeze({ scanner: "1" }),
      diagnostics: Object.freeze([]),
    },
    packageBytes,
  );
  const objectStore = new FakeObjectStoreV1(() => clock.now);
  const objectAccessDecisions =
    new FakeSkillObjectAccessDecisionResolverV1();
  const app = new SkillRegistryApplicationV1({
    repository,
    object_store: objectStore,
    object_store_metadata_kind: "memory",
    object_access_decisions: objectAccessDecisions,
    package_inspector: new InProcessSkillPackageInspectorV1(
      () => inspection,
    ),
    validation_artifact_reader: validationArtifacts,
    policy_input_reader: policies,
    deployment_mode: "test",
    now: () => clock.now,
  });
  return {
    app,
    repository,
    policies,
    validationArtifacts,
    objectStore,
    objectAccessDecisions,
    clock,
    validation,
  };
}

function publishRequest(
  overrides: Partial<SkillPublishRequestV1> = {},
): SkillPublishRequestV1 {
  return {
    schema_version: "skill_publish_request.v1",
    skill_name: "lark-doc",
    semver: "1.0.0",
    validation_id: "validation_1",
    package_digest: packageDigest,
    manifest_digest: manifestDigest,
    artifact_ref: objectRef,
    idempotency_key:
      `publish:lark-doc:1.0.0:${packageDigest}`,
    trace_id: "trace_publish",
    ...overrides,
  };
}

function activateRequest(
  versionId: string,
  overrides: Partial<SkillActivateRequestV1> = {},
): SkillActivateRequestV1 {
  return {
    schema_version: "skill.management-command.v1",
    operation: "activate",
    scope_kind: "scoped",
    ...catalogScope,
    skill_id: "skill_1",
    version_id: versionId,
    expected_catalog_version: "cat_0",
    expected_activation_revision: "none",
    reason: "release",
    idempotency_key: "activate:lark-doc:1",
    trace_id: "trace_activate",
    ...overrides,
  };
}

function disableRequest(
  expectedCatalogVersion: string,
  expectedActivationRevision: string,
  overrides: Partial<SkillDisableRequestV1> = {},
): SkillDisableRequestV1 {
  return {
    schema_version: "skill.management-command.v1",
    operation: "disable",
    scope_kind: "scoped",
    ...catalogScope,
    skill_id: "skill_1",
    expected_catalog_version: expectedCatalogVersion,
    expected_activation_revision: expectedActivationRevision,
    reason: "disable release",
    idempotency_key: "disable:lark-doc:1",
    trace_id: "trace_disable",
    ...overrides,
  };
}

function validateRequest(
  overrides: Partial<SkillValidateRequestV1> = {},
): SkillValidateRequestV1 {
  return {
    schema_version: "skill_validate_request.v1",
    artifact_ref: objectRef,
    content_digest: packageDigest,
    media_type: "application/zip",
    size_bytes: packageBytes.byteLength,
    idempotency_key: `validate:${packageDigest}`,
    trace_id: "trace_validate",
    ...overrides,
  };
}

function catalogRequest(
  overrides: Partial<SkillCatalogQueryRequestV1> = {},
): SkillCatalogQueryRequestV1 {
  return {
    schema_version: "skill_catalog_query.v1",
    ...runtimeScope,
    limit: 100,
    trace_id: "trace_catalog",
    ...overrides,
  };
}

async function seedAndPublishVersion(
  input: Harness,
  options: Readonly<{
    validationId: string;
    skillId: string;
    skillName: string;
    semver: string;
  }>,
) {
  input.repository.seedValidation({
    ...input.validation,
    validation_id: options.validationId,
    skill_id: options.skillId,
    skill_name: options.skillName,
    proposed_version: options.semver,
  });
  const publishingApp = new SkillRegistryApplicationV1({
    repository: input.repository,
    object_store: input.objectStore,
    object_store_metadata_kind: "memory",
    object_access_decisions: input.objectAccessDecisions,
    package_inspector: new InProcessSkillPackageInspectorV1(
      () => ({
        ...inspection,
        package_root_name: options.skillName,
        frontmatter: {
          ...inspection.frontmatter,
          name: options.skillName,
        },
      }),
    ),
    validation_artifact_reader: input.validationArtifacts,
    policy_input_reader: input.policies,
    deployment_mode: "test",
    now: () => input.clock.now,
  });
  return publishingApp.publish(globalPrincipal, options.skillName, {
    ...publishRequest(),
    skill_name: options.skillName,
    semver: options.semver,
    validation_id: options.validationId,
    idempotency_key:
      `publish:${options.skillName}:${options.semver}:${packageDigest}`,
  });
}

async function publishedAndActivated(input: Harness) {
  const published = await input.app.publish(
    globalPrincipal,
    "lark-doc",
    publishRequest(),
  );
  const activated = await input.app.activate(
    releasePrincipal,
    "lark-doc",
    activateRequest(published.skill_version_id),
  );
  return { published, activated };
}

function seedPolicyAndSummary(
  input: Harness,
  activation: Awaited<ReturnType<typeof publishedAndActivated>>,
  overrides: Partial<RuntimePolicyInputArtifactV1> = {},
) {
  const catalog = input.repository.catalogIdentity(catalogScope);
  input.repository.seedPermission(catalogScope, "skill_1", {
    decision: "grant",
    owner_agent_condition: "agent_1",
    capability_refs: Object.freeze(["docs.read", "docs.write"]),
  });
  input.repository.setSecurityRevocationEpoch(1);
  const summary = input.repository.seedPermissionSummary({
    schema_version: "skill_permission_summary.v1",
    summary_ref: "summary_1",
    ...runtimeScope,
    catalog_revision_id: catalog.catalog_revision_id,
    catalog_version: catalog.catalog_version,
    catalog_as_of: catalog.catalog_as_of,
    security_revocation_epoch: 1,
    entries: Object.freeze([
      Object.freeze({
        skill_id: "skill_1",
        skill_key: "lark-doc",
        activation_revision_id: activation.activated.new_revision,
        version_id: activation.published.skill_version_id,
        decision: "grant",
        decision_source: "revision",
        permission_revision_id: "permission_revision_1",
        revision_no: 1,
        scope_hash: sha256BytesV1("scope"),
        owner_agent_condition: "agent_1",
        capability_refs: Object.freeze(["docs.read", "docs.write"]),
      }),
    ]),
  });
  const snapshotWithoutHash = {
    schema_version: "intent_policy_input_snapshot.v1" as const,
    snapshot_ref: "intent-policy:process_1:1",
    ...runtimeScope,
    bot_policy_revision_id: "bot-policy-r1",
    personality_ref: "personality:1",
    personality_version: 1,
    personality_hash: sha256BytesV1("personality"),
    safety_boundaries_ref: "safety:1",
    safety_boundaries_version: 1,
    safety_boundaries_hash: sha256BytesV1("safety"),
    tool_permission_profile_ref: "tool-profile:1",
    tool_permission_profile_revision: 1,
    tool_permission_profile_hash: sha256BytesV1("tool-profile"),
    tool_policy_epoch: 1,
    catalog_version: catalog.catalog_version,
    catalog_as_of: catalog.catalog_as_of,
    security_revocation_epoch: 1,
    skill_permission_summary_ref: summary.summary_ref,
    skill_permission_summary_hash: summary.summary_hash,
  };
  const snapshotHash = canonicalHashV1(snapshotWithoutHash);
  const canonicalPolicy = {
    schema_version: "runtime_policy_input.v1" as const,
    intent_policy_snapshot_ref: snapshotWithoutHash.snapshot_ref,
    intent_policy_snapshot_hash: snapshotHash,
    created_at: "2026-07-24T00:00:00.000Z",
    expires_at: "2026-07-24T00:06:00.000Z",
  };
  const policy: RuntimePolicyInputArtifactV1 = {
    schema_version: "runtime_policy_input_read_artifact.v1",
    policy_input_ref: "policy_1",
    policy_input_hash: canonicalHashV1(canonicalPolicy),
    trigger_process_id: "process_1",
    runtime_run_id: "run_1",
    start_attempt_no: 1,
    ...runtimeScope,
    expected_catalog_version: catalog.catalog_version,
    catalog_as_of: catalog.catalog_as_of,
    intent_policy_snapshot_ref: snapshotWithoutHash.snapshot_ref,
    intent_policy_snapshot_hash: snapshotHash,
    intent_policy_snapshot: {
      ...snapshotWithoutHash,
      snapshot_hash: snapshotHash,
    },
    skill_permission_summary_ref: summary.summary_ref,
    skill_permission_summary_hash: summary.summary_hash,
    policy: canonicalPolicy,
    ...overrides,
  };
  input.policies.seed("policy_1", policy);
  return policy;
}

function resolveRequest(
  policy: RuntimePolicyInputArtifactV1,
  overrides: Partial<SkillResolveRequestV1> = {},
): SkillResolveRequestV1 {
  return {
    schema_version: "skill_resolution_request.v1",
    runtime_run_id: policy.runtime_run_id,
    start_attempt_no: 1,
    ...runtimeScope,
    expected_catalog_version: policy.expected_catalog_version,
    catalog_as_of: policy.catalog_as_of,
    policy_input_ref: "policy_1",
    policy_input_hash: runtimePolicyInputHashV1(policy),
    skills: Object.freeze([
      Object.freeze({
        name: "lark-doc",
        version_constraint: "catalog_revision",
        required: true,
      }),
    ]),
    idempotency_key: "run_1:skill-resolution:attempt:1",
    trace_id: "trace_resolve",
    ...overrides,
  };
}

async function expectCode(
  promise: Promise<unknown>,
  code: SkillRegistryApplicationErrorV1["code"],
) {
  await expect(promise).rejects.toMatchObject({ code });
}

describe("Skill Registry Day18 application", () => {
  it("returns Trigger Processor a scope-bound active context catalog", async () => {
    const input = harness();
    const activation = await publishedAndActivated(input);
    const result = await input.app.readContextCatalog(
      contextCatalogPrincipal,
      {
        schema_version: "skill_context_catalog_request.v1",
        ...runtimeScope,
        limit: 500,
        trace_id: "trace_context_catalog",
      },
    );

    expect(result).toMatchObject({
      schema_version: "skill_context_catalog_response.v1",
      ...runtimeScope,
    });
    expect(result.items).toEqual([
      expect.objectContaining({
        skill_key: "lark-doc",
        active_version: activation.published.version,
        package_digest: activation.published.package_digest,
        manifest_digest: activation.published.manifest_digest,
      }),
    ]);
    await expectCode(
      input.app.readContextCatalog(
        {
          ...contextCatalogPrincipal,
          capabilities: Object.freeze(["skill.catalog.read"]),
        },
        {
          schema_version: "skill_context_catalog_request.v1",
          ...runtimeScope,
          limit: 500,
          trace_id: "trace_context_catalog_denied",
        },
      ),
      "authorization_scope_mismatch",
    );
  });

  it("publishes verified ObjectStore bytes without implicitly activating", async () => {
    const input = harness();
    const result = await input.app.publish(
      globalPrincipal,
      "lark-doc",
      publishRequest(),
    );

    expect(result).toMatchObject({
      state: "published",
      package_digest: packageDigest,
      manifest_digest: manifestDigest,
      duplicate_replayed: false,
    });
    expect(input.repository.activationCount).toBe(0);
    expect(input.repository.outboxRecords).toEqual([
      expect.objectContaining({ event_type: "skill.version.published" }),
    ]);
    expect(input.objectStore.getRequests).toEqual([
      expect.objectContaining({
        owner_service: "skill_registry",
        owner_object_id: "skill-staging-1",
        owner_state_version: 1,
        capability: "skill.content.read",
        object_ref: objectRef,
        access_decision_ref: "decision-get-1",
      }),
    ]);
    expect(input.objectAccessDecisions.requests).toEqual([
      expect.objectContaining({
        operation: "get",
        purpose: "publish_integrity_check",
        prior_access_decision_ref: "decision_publish_1",
        owner_object_id: "skill-staging-1",
        owner_state_version: 1,
      }),
    ]);
  });

  it("replays publish before storage access and rejects body drift", async () => {
    const input = harness();
    const first = await input.app.publish(
      globalPrincipal,
      "lark-doc",
      publishRequest(),
    );
    input.objectStore.unavailable = true;

    await expect(
      input.app.publish(globalPrincipal, "lark-doc", publishRequest()),
    ).resolves.toMatchObject({
      skill_version_id: first.skill_version_id,
      duplicate_replayed: true,
    });
    await expectCode(
      input.app.publish(
        globalPrincipal,
        "lark-doc",
        publishRequest({ trace_id: "trace_publish_body_drift" }),
      ),
      "idempotency_conflict",
    );
  });

  it("converges concurrent canonical publish retries on one version", async () => {
    const input = harness();
    const results = await Promise.all([
      input.app.publish(
        globalPrincipal,
        "lark-doc",
        publishRequest(),
      ),
      input.app.publish(
        globalPrincipal,
        "lark-doc",
        publishRequest(),
      ),
    ]);

    expect(
      new Set(results.map((entry) => entry.skill_version_id)).size,
    ).toBe(1);
    expect(
      results.filter((entry) => entry.duplicate_replayed),
    ).toHaveLength(1);
    expect(
      input.repository.outboxRecords.filter(
        (event) => event.event_type === "skill.version.published",
      ),
    ).toHaveLength(1);
  });

  it("atomically fences concurrent activation by catalog and activation CAS", async () => {
    const input = harness();
    const published = await input.app.publish(
      globalPrincipal,
      "lark-doc",
      publishRequest(),
    );
    const settled = await Promise.allSettled([
      input.app.activate(
        releasePrincipal,
        "lark-doc",
        activateRequest(published.skill_version_id, {
          idempotency_key: "activate-a",
        }),
      ),
      input.app.activate(
        releasePrincipal,
        "lark-doc",
        activateRequest(published.skill_version_id, {
          idempotency_key: "activate-b",
        }),
      ),
    ]);

    expect(settled.filter((entry) => entry.status === "fulfilled")).toHaveLength(1);
    const rejected = settled.find(
      (entry): entry is PromiseRejectedResult => entry.status === "rejected",
    );
    expect(["catalog_version_conflict", "activation_conflict"]).toContain(
      rejected?.reason.code,
    );
  });

  it("atomically disables the current activation, excludes Catalog, and emits both events", async () => {
    const input = harness();
    const activation = await publishedAndActivated(input);
    const beforeOutbox = input.repository.outboxRecords.length;
    const request = disableRequest(
      activation.activated.catalog_version,
      activation.activated.new_revision,
    );

    const disabled = await input.app.disable(
      managementPrincipal,
      "lark-doc",
      request,
    );
    expect(disabled).toMatchObject({
      operation: "disable",
      scope_kind: "scoped",
      previous_revision: activation.activated.new_revision,
      duplicate_replayed: false,
    });
    expect(input.repository.activationCount).toBe(0);
    const emitted = input.repository.outboxRecords.slice(beforeOutbox);
    expect(emitted.map((event) => event.event_type).sort()).toEqual([
      "skill.activation.disabled",
      "skill.catalog.changed",
    ]);
    expect(
      emitted.find(
        (event) => event.event_type === "skill.activation.disabled",
      ),
    ).toMatchObject({
      idempotency_key: `activation:${disabled.new_revision}:disabled`,
      payload: {
        skill_id: "skill_1",
        skill_key: "lark-doc",
        version_id: activation.published.skill_version_id,
        activation_revision_id: disabled.new_revision,
        previous_activation_revision_id:
          activation.activated.new_revision,
        catalog_version: disabled.catalog_version,
      },
    });

    await expect(
      input.app.disable(managementPrincipal, "lark-doc", request),
    ).resolves.toMatchObject({
      command_id: disabled.command_id,
      duplicate_replayed: true,
    });
    expect(input.repository.outboxRecords).toHaveLength(beforeOutbox + 2);

    await expectCode(
      input.app.disable(
        managementPrincipal,
        "lark-doc",
        disableRequest(disabled.catalog_version, disabled.new_revision, {
          idempotency_key: "disable:lark-doc:already-disabled",
        }),
      ),
      "invalid_state_transition",
    );
    expect(input.repository.outboxRecords).toHaveLength(beforeOutbox + 2);
  });

  it("does not permit a new activation to target deprecated content", async () => {
    const input = harness();
    const published = await input.app.publish(
      globalPrincipal,
      "lark-doc",
      publishRequest(),
    );
    input.repository.setVersionLifecycle(
      published.skill_version_id,
      "deprecated",
    );

    await expectCode(
      input.app.activate(
        releasePrincipal,
        "lark-doc",
        activateRequest(published.skill_version_id),
      ),
      "version_not_publishable",
    );
  });

  it("resolves the exact frozen catalog with capability intersection", async () => {
    const input = harness();
    const activation = await publishedAndActivated(input);
    const policy = seedPolicyAndSummary(input, activation);
    const result = await input.app.resolve(
      runtimePrincipal,
      resolveRequest(policy),
    );

    expect(result).toMatchObject({
      requested_catalog_version: activation.activated.catalog_version,
      effective_catalog_version: activation.activated.catalog_version,
      security_revocation_epoch: 1,
      valid_until: policy.policy.expires_at,
    });
    expect(result.resolved_skills[0]).toMatchObject({
      version_id: activation.published.skill_version_id,
      granted_capability_refs: ["docs.read", "docs.write"],
    });
  });

  it("checks authenticated scope before policy and catalog errors", async () => {
    const input = harness();
    const activation = await publishedAndActivated(input);
    const policy = seedPolicyAndSummary(input, activation);
    const wrongPrincipal: SkillRegistryPrincipalV1 = {
      ...runtimePrincipal,
      scope: {
        ...runtimePrincipal.scope,
        workspace_id: "ws_other",
      },
    };

    await expectCode(
      input.app.resolve(wrongPrincipal, resolveRequest(policy)),
      "authorization_scope_mismatch",
    );
  });

  it("replays an attempt after policy expiry and rejects same-attempt drift", async () => {
    const input = harness();
    const activation = await publishedAndActivated(input);
    const policy = seedPolicyAndSummary(input, activation);
    const request = resolveRequest(policy);
    const first = await input.app.resolve(runtimePrincipal, request);
    input.clock.now = new Date("2026-07-24T00:10:00.000Z");

    await expect(input.app.resolve(runtimePrincipal, request)).resolves.toMatchObject({
      resolution_attempt_id: first.resolution_attempt_id,
      duplicate_replayed: true,
    });
    await expectCode(
      input.app.resolve(runtimePrincipal, {
        ...request,
        skills: [{ ...request.skills[0]!, required: false }],
      }),
      "idempotency_conflict",
    );
  });

  it("omits optional denied skills but fails required denial", async () => {
    const input = harness();
    const activation = await publishedAndActivated(input);
    const policy = seedPolicyAndSummary(input, activation);
    input.repository.seedPermission(catalogScope, "skill_1", {
      decision: "deny",
      capability_refs: [],
    });

    await expectCode(
      input.app.resolve(runtimePrincipal, resolveRequest(policy)),
      "permission_denied",
    );
    const optional = resolveRequest(policy, {
      start_attempt_no: 2,
      idempotency_key: "run_1:skill-resolution:attempt:2",
      skills: [
        {
          name: "lark-doc",
          version_constraint: "catalog_revision",
          required: false,
        },
      ],
    });
    input.policies.seed("policy_1", {
      ...policy,
      start_attempt_no: 2,
    });
    await expect(input.app.resolve(runtimePrincipal, optional)).resolves.toMatchObject({
      resolved_skills: [],
      degradation_notes: [
        { skill_key: "lark-doc", reason: "permission_denied" },
      ],
    });
    input.repository.seedPermission(catalogScope, "skill_1", {
      decision: "grant",
      owner_agent_condition: "agent_1",
      capability_refs: ["docs.read"],
    });
    await expectCode(
      input.app.resolve(runtimePrincipal, resolveRequest(policy)),
      "permission_denied",
    );
  });

  it("reports a persisted disabled activation distinctly from not found", async () => {
    const input = harness();
    const activation = await publishedAndActivated(input);
    input.repository.seedActivationState(
      catalogScope,
      "lark-doc",
      "disabled",
      "cat_disabled",
      "2026-07-24T00:01:30.000Z",
    );
    const policy = seedPolicyAndSummary(input, activation);

    await expect(
      input.app.resolve(runtimePrincipal, resolveRequest(policy)),
    ).rejects.toMatchObject({
      code: "required_skill_unavailable",
      details: {
        reason: "activation_disabled",
        failed_items: [
          {
            skill_key: "lark-doc",
            reason: "activation_disabled",
          },
        ],
      },
    });
  });

  it("re-signs only the frozen package after full current-state recheck", async () => {
    const input = harness();
    const activation = await publishedAndActivated(input);
    const policy = seedPolicyAndSummary(input, activation);
    // A later activation/catalog revision must not rewrite the run's frozen
    // catalog or invalidate the immutable activation revision it references.
    await input.app.activate(
      releasePrincipal,
      "lark-doc",
      activateRequest(activation.published.skill_version_id, {
        expected_catalog_version: activation.activated.catalog_version,
        expected_activation_revision: activation.activated.new_revision,
        idempotency_key: "activate:lark-doc:2",
      }),
    );
    const resolved = await input.app.resolve(
      runtimePrincipal,
      resolveRequest(policy),
    );
    const skill = resolved.resolved_skills[0]!;
    const request: SkillContentRequestV1 = {
      schema_version: "skill_content_request.v1",
      resolution_id: skill.resolution_id,
      runtime_run_id: "run_1",
      ...runtimeScope,
      expected_package_digest: skill.package_digest,
      expected_manifest_digest: skill.manifest_digest,
      security_revocation_epoch: resolved.security_revocation_epoch,
      trace_id: "trace_content",
    };

    const first = await input.app.getContent(
      runtimePrincipal,
      skill.resolution_id,
      request,
    );
    const second = await input.app.getContent(
      runtimePrincipal,
      skill.resolution_id,
      request,
    );
    const { owner_agent_id: _ownerAgentId, ...requestWithoutAgentCondition } =
      request;
    const withoutAgentCondition = await input.app.getContent(
      runtimePrincipal,
      skill.resolution_id,
      requestWithoutAgentCondition,
    );
    expect(first.content_ref).not.toBe(second.content_ref);
    expect(first.package_digest).toBe(second.package_digest);
    expect(withoutAgentCondition.package_digest).toBe(second.package_digest);
    expect(input.objectStore.headRequests).toEqual(
      Array.from({ length: 3 }, () =>
        expect.objectContaining({
          owner_service: "skill_registry",
          owner_object_id: "skill-staging-1",
          owner_state_version: 1,
          capability: "skill.content.read",
          object_ref: objectRef,
        }),
      ),
    );
    expect(input.objectStore.grantRequests).toEqual(
      Array.from({ length: 3 }, () =>
        expect.objectContaining({
          owner_service: "skill_registry",
          owner_object_id: "skill-staging-1",
          owner_state_version: 1,
          capability: "skill.content.read",
          object_ref: objectRef,
        }),
      ),
    );
    expect(
      input.objectAccessDecisions.requests.map(
        ({ operation }) => operation,
      ),
    ).toEqual([
      "get",
      "head",
      "grant",
      "head",
      "grant",
      "head",
      "grant",
    ]);
    const issuedAccessRefs = [
      ...input.objectStore.getRequests,
      ...input.objectStore.headRequests,
      ...input.objectStore.grantRequests,
    ].map(({ access_decision_ref }) => access_decision_ref);
    expect(new Set(issuedAccessRefs).size).toBe(
      issuedAccessRefs.length,
    );
    expect(
      input.objectStore.headRequests.every(({ access_decision_ref }) =>
        access_decision_ref.startsWith("decision-head-"),
      ),
    ).toBe(true);
    expect(
      input.objectStore.grantRequests.every(
        ({ access_decision_ref }) =>
          access_decision_ref.startsWith("decision-grant-"),
      ),
    ).toBe(true);
    expect(Date.parse(first.expires_at)).toBeLessThanOrEqual(
      Date.parse(policy.policy.expires_at),
    );

    const revoked = await input.app.revoke(
      lifecyclePrincipal,
      "lark-doc",
      activation.published.skill_version_id,
      {
        schema_version: "skill.management-command.v1",
        operation: "revoke",
        scope_kind: "global",
        skill_id: "skill_1",
        version_id: activation.published.skill_version_id,
        expected_lifecycle_version: 1,
        emergency: false,
        reason: "ordinary content revoke",
        idempotency_key: "revoke:content:1",
        trace_id: "trace_revoke_content",
      },
    );
    expect(revoked.security_revocation_epoch).toBe(
      resolved.security_revocation_epoch,
    );
    await expectCode(
      input.app.getContent(
        runtimePrincipal,
        skill.resolution_id,
        request,
      ),
      "version_revoked",
    );
  });

  it("rejects a read grant when the final authorization snapshot drifts", async () => {
    const input = harness();
    const activation = await publishedAndActivated(input);
    const policy = seedPolicyAndSummary(input, activation);
    const resolved = await input.app.resolve(
      runtimePrincipal,
      resolveRequest(policy),
    );
    const skill = resolved.resolved_skills[0]!;
    const request: SkillContentRequestV1 = {
      schema_version: "skill_content_request.v1",
      resolution_id: skill.resolution_id,
      runtime_run_id: "run_1",
      ...runtimeScope,
      expected_package_digest: skill.package_digest,
      expected_manifest_digest: skill.manifest_digest,
      security_revocation_epoch: resolved.security_revocation_epoch,
      trace_id: "trace_content_final_drift",
    };
    const authorize = input.repository.authorizeContent.bind(
      input.repository,
    );
    let calls = 0;
    vi.spyOn(
      input.repository,
      "authorizeContent",
    ).mockImplementation(async (...arguments_) => {
      const authorization = await authorize(...arguments_);
      calls += 1;
      if (calls !== 3) return authorization;
      const shortened = "2026-07-24T00:01:30.000Z";
      return {
        ...authorization,
        valid_until: shortened,
        resolution: {
          ...authorization.resolution,
          valid_until: shortened,
        },
      };
    });

    await expectCode(
      input.app.getContent(
        runtimePrincipal,
        skill.resolution_id,
        request,
      ),
      "storage_unavailable",
    );
    expect(input.objectStore.grantCount).toBe(1);
    vi.restoreAllMocks();
  });

  it("rejects first materialization after the active version changes", async () => {
    const input = harness();
    const first = await publishedAndActivated(input);
    const policy = seedPolicyAndSummary(input, first);
    const resolved = await input.app.resolve(
      runtimePrincipal,
      resolveRequest(policy),
    );
    const frozenSkill = resolved.resolved_skills[0]!;
    const second = await seedAndPublishVersion(input, {
      validationId: "validation_2",
      skillId: "skill_1",
      skillName: "lark-doc",
      semver: "2.0.0",
    });
    await input.app.activate(
      releasePrincipal,
      "lark-doc",
      activateRequest(second.skill_version_id, {
        expected_catalog_version: first.activated.catalog_version,
        expected_activation_revision: first.activated.new_revision,
        idempotency_key: "activate:lark-doc:2.0.0",
      }),
    );

    await expectCode(
      input.app.getContent(
        runtimePrincipal,
        frozenSkill.resolution_id,
        {
          schema_version: "skill_content_request.v1",
          resolution_id: frozenSkill.resolution_id,
          runtime_run_id: "run_1",
          ...runtimeScope,
          expected_package_digest: frozenSkill.package_digest,
          expected_manifest_digest: frozenSkill.manifest_digest,
          security_revocation_epoch:
            resolved.security_revocation_epoch,
          trace_id: "trace_content_after_activation_change",
        },
      ),
      "content_unavailable",
    );
    expect(input.objectStore.grantCount).toBe(0);
  });

  it("fails production readiness for memory owner/object metadata/inspector", async () => {
    const input = harness();
    const production = new SkillRegistryApplicationV1({
      repository: input.repository,
      object_store: input.objectStore,
      object_store_metadata_kind: "memory",
      package_inspector: new InProcessSkillPackageInspectorV1(
        () => inspection,
      ),
      policy_input_reader: input.policies,
      deployment_mode: "production",
      now: () => input.clock.now,
    });

    await expect(production.checkReadiness()).rejects.toThrow(
      /production requires PostgreSQL owner state/u,
    );
  });

  it("applies an accepted Meta candidate once without publishing or activating it", async () => {
    const input = harness();
    const request = candidateApplication();
    const first = await input.app.applyCandidate(metaPrincipal, request);
    const replay = await input.app.applyCandidate(metaPrincipal, request);

    expect(first).toMatchObject({
      application_id: request.application_id,
      status: "received",
      duplicate_replayed: false,
    });
    expect(first.staging_version_id).toBeUndefined();
    expect(replay).toEqual({
      ...first,
      duplicate_replayed: true,
    });
    expect(input.repository.activationCount).toBe(0);
    expect(input.repository.outboxRecords).toContainEqual(
      expect.objectContaining({
        event_type: "skill.candidate.application.updated",
        payload: expect.objectContaining({
          application_id: request.application_id,
        }),
      }),
    );

    await expectCode(
      input.app.applyCandidate(
        metaPrincipal,
        candidateApplication({ proposal_ref: "proposal_drift" }),
      ),
      "idempotency_conflict",
    );
    await expectCode(
      input.app.applyCandidate(
        metaPrincipal,
        candidateApplication({
          application_id: "application_duplicate_review",
          idempotency_key: "candidate:duplicate-review:1",
        }),
      ),
      "idempotency_conflict",
    );
    await expectCode(
      input.app.applyCandidate(
        runtimePrincipal,
        candidateApplication({
          application_id: "application_unauthorized",
          idempotency_key: "candidate:unauthorized:1",
        }),
      ),
      "authorization_scope_mismatch",
    );
    await expectCode(
      input.app.applyCandidate(
        metaPrincipal,
        candidateApplication({
          application_id: "application_reviewer_spoof",
          candidate_id: "candidate_reviewer_spoof",
          reviewer_principal_id: "attacker",
          idempotency_key: "candidate:reviewer-spoof:1",
        }),
      ),
      "authorization_scope_mismatch",
    );
    await expectCode(
      input.app.applyCandidate(
        metaPrincipal,
        candidateApplication({
          application_id: "application_stale_catalog",
          candidate_id: "candidate_stale_catalog",
          baseline_catalog_version: "catalog-stale",
          idempotency_key: "candidate:stale-catalog:1",
        }),
      ),
      "catalog_version_conflict",
    );
  });

  it("routes deprecation candidates into review instead of a staging version", async () => {
    const input = harness();
    const result = await input.app.applyCandidate(
      metaPrincipal,
      candidateApplication({
        application_id: "application_deprecation",
        candidate_id: "candidate_deprecation",
        candidate_type: "deprecation",
        idempotency_key: "candidate:deprecation:1",
      }),
    );

    expect(result).toMatchObject({
      status: "deprecation_review_created",
      review_ref: "skill-deprecation-review:application_deprecation",
    });
    expect(result.staging_version_id).toBeUndefined();
  });

  it("rehashes staged bytes and commits an idempotent durable validation record", async () => {
    const input = harness();
    const request = validateRequest();
    const first = await input.app.validate(
      validationPrincipal,
      request,
    );
    const replay = await input.app.validate(
      validationPrincipal,
      request,
    );

    expect(first).toMatchObject({
      package_digest: packageDigest,
      manifest_digest: manifestDigest,
      diagnostics: [],
      expires_at: "2026-07-24T00:31:00.000Z",
    });
    expect(replay).toEqual(first);
    expect(input.validationArtifacts.readCount).toBe(1);
    await expectCode(
      input.app.validate(
        {
          ...validationPrincipal,
          principal_id: "different_skill_validator",
        },
        request,
      ),
      "idempotency_conflict",
    );
    expect(input.validationArtifacts.readCount).toBe(1);
    await expectCode(
      input.app.validate(validationPrincipal, {
        ...request,
        size_bytes: request.size_bytes + 1,
      }),
      "idempotency_conflict",
    );
    await expectCode(
      input.app.validate(globalPrincipal, request),
      "authorization_scope_mismatch",
    );
    input.clock.now = new Date("2026-07-24T00:31:00.000Z");
    await expectCode(
      input.app.validate(validationPrincipal, request),
      "validation_expired",
    );
    expect(input.validationArtifacts.readCount).toBe(1);
  });

  it("pins caller-owned request and principal values before the first await", async () => {
    const validationInput = harness();
    const validationRequest = { ...validateRequest() };
    const validationActor = {
      ...validationPrincipal,
      scope: { ...validationPrincipal.scope },
      capabilities: [...validationPrincipal.capabilities],
    };
    const expectedValidationRequest = structuredClone(validationRequest);
    const validationCommit = vi.spyOn(
      validationInput.repository,
      "commitValidation",
    );
    const pendingValidation = validationInput.app.validate(
      validationActor,
      validationRequest,
    );
    validationRequest.trace_id = "trace_mutated_after_validate_started";
    validationActor.principal_id = "mutated_validation_actor";
    validationActor.capabilities.length = 0;
    await pendingValidation;
    expect(validationCommit).toHaveBeenCalledTimes(1);
    expect(validationCommit.mock.calls[0]![0]).toMatchObject({
      request: expectedValidationRequest,
      request_hash: canonicalHashV1(expectedValidationRequest),
      actor_principal_id: validationPrincipal.principal_id,
    });
    expect(Object.isFrozen(validationCommit.mock.calls[0]![0].request)).toBe(
      true,
    );

    const publishInput = harness();
    const mutablePublishRequest = { ...publishRequest() };
    const expectedPublishRequest = structuredClone(mutablePublishRequest);
    const publishCommit = vi.spyOn(
      publishInput.repository,
      "publishVersion",
    );
    const pendingPublish = publishInput.app.publish(
      { ...globalPrincipal, capabilities: [...globalPrincipal.capabilities] },
      "lark-doc",
      mutablePublishRequest,
    );
    mutablePublishRequest.trace_id = "trace_mutated_after_publish_started";
    await pendingPublish;
    expect(publishCommit).toHaveBeenCalledTimes(1);
    expect(publishCommit.mock.calls[0]![0]).toMatchObject({
      request: expectedPublishRequest,
      request_hash: canonicalHashV1(expectedPublishRequest),
    });
    expect(Object.isFrozen(publishCommit.mock.calls[0]![0].request)).toBe(
      true,
    );

    const resolutionInput = harness();
    const activation = await publishedAndActivated(resolutionInput);
    const policy = seedPolicyAndSummary(resolutionInput, activation);
    const mutableResolveRequest = { ...resolveRequest(policy) };
    const expectedResolveRequest = structuredClone(mutableResolveRequest);
    const resolveCommit = vi.spyOn(
      resolutionInput.repository,
      "resolveAttempt",
    );
    const pendingResolve = resolutionInput.app.resolve(
      {
        ...runtimePrincipal,
        scope: { ...runtimePrincipal.scope },
        capabilities: [...runtimePrincipal.capabilities],
      },
      mutableResolveRequest,
    );
    mutableResolveRequest.trace_id = "trace_mutated_after_resolve_started";
    await pendingResolve;
    expect(resolveCommit).toHaveBeenCalledTimes(1);
    expect(resolveCommit.mock.calls[0]![0]).toMatchObject({
      request: expectedResolveRequest,
      request_hash: canonicalHashV1(expectedResolveRequest),
    });
    expect(Object.isFrozen(resolveCommit.mock.calls[0]![0].request)).toBe(
      true,
    );
  });

  it("durably rejects package identity drift and replays the first outcome", async () => {
    const input = harness();
    const request = validateRequest();
    const invalid = new SkillRegistryApplicationV1({
      repository: input.repository,
      object_store: input.objectStore,
      object_store_metadata_kind: "memory",
      package_inspector: new InProcessSkillPackageInspectorV1(
        () => ({
          ...inspection,
          frontmatter: {
            ...inspection.frontmatter,
            name: "different-skill",
          },
        }),
      ),
      validation_artifact_reader: input.validationArtifacts,
      policy_input_reader: input.policies,
      deployment_mode: "test",
      now: () => input.clock.now,
    });

    await expectCode(
      invalid.validate(validationPrincipal, request),
      "invalid_skill_package",
    );
    expect(input.repository.validationFailureCount).toBe(1);
    expect(input.validationArtifacts.readCount).toBe(1);
    await expectCode(
      input.app.validate(validationPrincipal, request),
      "invalid_skill_package",
    );
    expect(input.repository.validationFailureCount).toBe(1);
    expect(input.validationArtifacts.readCount).toBe(1);
    await expectCode(
      input.app.validate(validationPrincipal, {
        ...request,
        size_bytes: request.size_bytes + 1,
      }),
      "idempotency_conflict",
    );
    input.clock.now = new Date("2026-07-24T00:31:00.000Z");
    await expectCode(
      input.app.validate(validationPrincipal, request),
      "validation_expired",
    );
    expect(input.validationArtifacts.readCount).toBe(1);
  });

  it("persists scanner diagnostics with a rejected validation outcome", async () => {
    const input = harness();
    const request = validateRequest();
    const diagnostic = Object.freeze({
      severity: "error" as const,
      code: "malware_signature",
      path: "SKILL.md",
      message: "scanner rejected bearer super-secret-value",
    });
    const durableDiagnostic = Object.freeze({
      ...diagnostic,
      message: "package scanner reported an error",
    });
    input.validationArtifacts.seed(
      {
        artifact_ref: objectRef,
        object_access_decision_ref: "decision_staging_1",
        owner_object_id: "skill-staging-1",
        owner_state_version: 1,
        skill_id: "skill_1",
        skill_name: "lark-doc",
        proposed_version: "1.0.0",
        media_type: "application/zip",
        provenance: Object.freeze({ source: "ci" }),
        validation_result: Object.freeze({ accepted: false }),
        scanner_versions: Object.freeze({ scanner: "1" }),
        diagnostics: Object.freeze([diagnostic]),
      },
      packageBytes,
    );

    await expect(
      input.app.validate(validationPrincipal, request),
    ).rejects.toMatchObject({
      code: "package_scan_failed",
      details: { diagnostics: [durableDiagnostic] },
    });
    expect(input.repository.validationFailureCount).toBe(1);
    expect(input.validationArtifacts.readCount).toBe(1);

    input.validationArtifacts.seed(
      {
        artifact_ref: objectRef,
        object_access_decision_ref: "decision_staging_1",
        owner_object_id: "skill-staging-1",
        owner_state_version: 1,
        skill_id: "skill_1",
        skill_name: "lark-doc",
        proposed_version: "1.0.0",
        media_type: "application/zip",
        provenance: Object.freeze({ source: "ci" }),
        validation_result: Object.freeze({ accepted: true }),
        scanner_versions: Object.freeze({ scanner: "2" }),
        diagnostics: Object.freeze([]),
      },
      packageBytes,
    );
    await expect(
      input.app.validate(validationPrincipal, request),
    ).rejects.toMatchObject({
      code: "package_scan_failed",
      details: { diagnostics: [durableDiagnostic] },
    });
    await expect(
      input.app.validate(validationPrincipal, request),
    ).rejects.not.toSatisfy((error: unknown) =>
      JSON.stringify(error).includes("super-secret-value"),
    );
    expect(input.validationArtifacts.readCount).toBe(1);
  });

  it("rejects validation artifact Proxy and accessor boundaries without triggering traps", async () => {
    for (const boundaryKind of ["proxy", "accessor"] as const) {
      const input = harness();
      let trapCount = 0;
      const body = (async function* () {
        yield packageBytes;
      })();
      const metadata = {
        artifact_ref: objectRef,
        object_access_decision_ref: "decision_staging_1",
        owner_object_id: "skill-staging-1",
        owner_state_version: 1,
        skill_id: "skill_1",
        skill_name: "lark-doc",
        proposed_version: "1.0.0",
        media_type: "application/zip",
        provenance: { source: "ci" },
        validation_result: { accepted: true },
        scanner_versions: { scanner: "1" },
        diagnostics: [],
      };
      const boundary =
        boundaryKind === "proxy"
          ? new Proxy(
              { ...metadata, body },
              {
                get(_target, property) {
                  if (property === "then") return undefined;
                  trapCount += 1;
                  throw new Error("proxy getter must not run");
                },
                getPrototypeOf() {
                  trapCount += 1;
                  throw new Error(
                    "proxy prototype trap must not run",
                  );
                },
                ownKeys() {
                  trapCount += 1;
                  throw new Error("proxy ownKeys must not run");
                },
              },
            )
          : (() => {
              const value = { ...metadata } as Record<
                string,
                unknown
              >;
              Object.defineProperty(value, "body", {
                enumerable: true,
                get() {
                  trapCount += 1;
                  return body;
                },
              });
              return value;
            })();
      const reader: SkillValidationArtifactReaderPortV1 = {
        durability: "memory",
        cancellation_kind: "abort_signal",
        async checkReadiness() {},
        async readArtifact() {
          return boundary as never;
        },
      };
      const app = new SkillRegistryApplicationV1({
        repository: input.repository,
        object_store: input.objectStore,
        object_store_metadata_kind: "memory",
        package_inspector: new InProcessSkillPackageInspectorV1(
          () => inspection,
        ),
        validation_artifact_reader: reader,
        policy_input_reader: input.policies,
        deployment_mode: "test",
        now: () => input.clock.now,
      });

      await expect(app.validate(validationPrincipal, validateRequest()))
        .rejects.toMatchObject({
          code: "registry_unavailable",
          message:
            "validation artifact reader returned an unsafe boundary value",
        });
      expect(trapCount).toBe(0);
    }
  });

  it("contains malicious stream iterator results and raw iterator failures", async () => {
    for (const mode of ["accessor_result", "raw_failure"] as const) {
      const input = harness();
      let trapCount = 0;
      const body = {
        [Symbol.asyncIterator]() {
          let first = true;
          return {
            async next() {
              if (!first) return { done: true, value: undefined };
              first = false;
              if (mode === "raw_failure") {
                throw new Error(
                  "storage-password-must-not-escape",
                );
              }
              const result: Record<string, unknown> = {
                value: packageBytes,
              };
              Object.defineProperty(result, "done", {
                enumerable: true,
                get() {
                  trapCount += 1;
                  return false;
                },
              });
              return result;
            },
          };
        },
      };
      const reader: SkillValidationArtifactReaderPortV1 = {
        durability: "memory",
        cancellation_kind: "abort_signal",
        async checkReadiness() {},
        async readArtifact() {
          return {
            artifact_ref: objectRef,
            object_access_decision_ref: "decision_staging_1",
            owner_object_id: "skill-staging-1",
            owner_state_version: 1,
            skill_id: "skill_1",
            skill_name: "lark-doc",
            proposed_version: "1.0.0",
            media_type: "application/zip",
            body,
            provenance: { source: "ci" },
            validation_result: { accepted: true },
            scanner_versions: { scanner: "1" },
            diagnostics: [],
          };
        },
      };
      const app = new SkillRegistryApplicationV1({
        repository: input.repository,
        object_store: input.objectStore,
        object_store_metadata_kind: "memory",
        package_inspector: new InProcessSkillPackageInspectorV1(
          () => inspection,
        ),
        validation_artifact_reader: reader,
        policy_input_reader: input.policies,
        deployment_mode: "test",
        now: () => input.clock.now,
      });

      const error = await app
        .validate(validationPrincipal, validateRequest())
        .catch((reason: unknown) => reason);
      expect(error).toMatchObject({
        code: "registry_unavailable",
        message: "byte stream could not be consumed",
      });
      expect(JSON.stringify(error)).not.toContain(
        "storage-password-must-not-escape",
      );
      expect(trapCount).toBe(0);
    }
  });

  it("preflights inspector, owner, policy, ObjectStore metadata, and grant returns", async () => {
    const proxyBoundary = () => {
      let trapCount = 0;
      const value = new Proxy(
        {},
        {
          get(_target, property) {
            if (property === "then") return undefined;
            trapCount += 1;
            throw new Error("typed port getter must not run");
          },
          getPrototypeOf() {
            trapCount += 1;
            throw new Error("typed port prototype trap must not run");
          },
          ownKeys() {
            trapCount += 1;
            throw new Error("typed port ownKeys must not run");
          },
        },
      );
      return {
        value,
        traps: () => trapCount,
      };
    };

    const inspectorInput = harness();
    const inspectorBoundary = proxyBoundary();
    const inspector: SkillPackageInspectorPortV1 = {
      execution_kind: "in_process",
      cancellation_kind: "abort_signal",
      async checkReadiness() {},
      async inspectPackage() {
        return inspectorBoundary.value as never;
      },
    };
    const inspectorApp = new SkillRegistryApplicationV1({
      repository: inspectorInput.repository,
      object_store: inspectorInput.objectStore,
      object_store_metadata_kind: "memory",
      package_inspector: inspector,
      validation_artifact_reader:
        inspectorInput.validationArtifacts,
      policy_input_reader: inspectorInput.policies,
      deployment_mode: "test",
      now: () => inspectorInput.clock.now,
    });
    await expectCode(
      inspectorApp.validate(validationPrincipal, validateRequest()),
      "invalid_skill_package",
    );
    expect(inspectorBoundary.traps()).toBe(0);

    const ownerInput = harness();
    const ownerBoundary = proxyBoundary();
    vi.spyOn(ownerInput.repository, "queryCatalog").mockResolvedValue(
      ownerBoundary.value as never,
    );
    await expect(
      ownerInput.app.queryCatalog(
        catalogPrincipal,
        catalogRequest(),
      ),
    ).rejects.toThrow(
      "Skill Registry owner returned an invalid catalog response",
    );
    expect(ownerBoundary.traps()).toBe(0);

    const policyInput = harness();
    const activation = await publishedAndActivated(policyInput);
    const policy = seedPolicyAndSummary(policyInput, activation);
    const policyBoundary = proxyBoundary();
    vi.spyOn(policyInput.policies, "readPolicyInput").mockResolvedValue(
      policyBoundary.value as never,
    );
    await expectCode(
      policyInput.app.resolve(
        runtimePrincipal,
        resolveRequest(policy),
      ),
      "invalid_runtime_policy",
    );
    expect(policyBoundary.traps()).toBe(0);

    vi.restoreAllMocks();
    const contentInput = harness();
    const contentActivation =
      await publishedAndActivated(contentInput);
    const contentPolicy = seedPolicyAndSummary(
      contentInput,
      contentActivation,
    );
    const resolution = await contentInput.app.resolve(
      runtimePrincipal,
      resolveRequest(contentPolicy),
    );
    const resolvedSkill = resolution.resolved_skills[0]!;
    const contentRequest: SkillContentRequestV1 = {
      schema_version: "skill_content_request.v1",
      resolution_id: resolvedSkill.resolution_id,
      runtime_run_id: "run_1",
      ...runtimeScope,
      expected_package_digest: resolvedSkill.package_digest,
      expected_manifest_digest: resolvedSkill.manifest_digest,
      security_revocation_epoch:
        resolution.security_revocation_epoch,
      trace_id: "trace_content_boundary",
    };
    const headBoundary = proxyBoundary();
    const headSpy = vi
      .spyOn(contentInput.objectStore, "head")
      .mockResolvedValue(headBoundary.value as never);
    await expectCode(
      contentInput.app.getContent(
        runtimePrincipal,
        resolvedSkill.resolution_id,
        contentRequest,
      ),
      "storage_unavailable",
    );
    expect(headBoundary.traps()).toBe(0);
    headSpy.mockRestore();

    const grantBoundary = proxyBoundary();
    vi.spyOn(
      contentInput.objectStore,
      "issueReadGrant",
    ).mockResolvedValue(grantBoundary.value as never);
    await expectCode(
      contentInput.app.getContent(
        runtimePrincipal,
        resolvedSkill.resolution_id,
        contentRequest,
      ),
      "storage_unavailable",
    );
    expect(grantBoundary.traps()).toBe(0);
    vi.restoreAllMocks();
  });

  it("projects dependency error details onto a safe per-code shape", async () => {
    const input = harness();
    vi.spyOn(input.repository, "queryCatalog").mockRejectedValue(
      new SkillRegistryApplicationErrorV1(
        "registry_unavailable",
        "postgres://admin:secret@database.internal/registry",
        {
          backend_dsn:
            "postgres://admin:secret@database.internal/registry",
          stack_fragment: "super-secret-port-stack",
        },
      ),
    );

    const error = await input.app
      .queryCatalog(catalogPrincipal, catalogRequest())
      .catch((reason: unknown) => reason);
    expect(error).toMatchObject({
      code: "registry_unavailable",
      message: "Skill Registry dependency is unavailable",
      details: {},
    });
    expect(error.details).toEqual({});
    expect(JSON.stringify(error)).not.toContain("secret");
    vi.restoreAllMocks();
  });

  it("rejects package inspectors that mutate their byte snapshot", async () => {
    const validationInput = harness();
    const mutatingInspector = new InProcessSkillPackageInspectorV1(
      (bytes) => {
        bytes[0] = (bytes[0] ?? 0) ^ 0xff;
        return inspection;
      },
    );
    const validationApp = new SkillRegistryApplicationV1({
      repository: validationInput.repository,
      object_store: validationInput.objectStore,
      object_store_metadata_kind: "memory",
      package_inspector: mutatingInspector,
      validation_artifact_reader:
        validationInput.validationArtifacts,
      policy_input_reader: validationInput.policies,
      deployment_mode: "test",
      now: () => validationInput.clock.now,
    });
    await expect(validationApp.validate(
      validationPrincipal,
      validateRequest(),
    )).rejects.toMatchObject({
      code: "package_scan_failed",
      message: "package inspector mutated its immutable input",
    });
    expect(validationInput.repository.validationFailureCount).toBe(1);

    const publishInput = harness();
    const publishApp = new SkillRegistryApplicationV1({
      repository: publishInput.repository,
      object_store: publishInput.objectStore,
      object_store_metadata_kind: "memory",
      package_inspector: mutatingInspector,
      validation_artifact_reader:
        publishInput.validationArtifacts,
      policy_input_reader: publishInput.policies,
      deployment_mode: "test",
      now: () => publishInput.clock.now,
    });
    await expectCode(
      publishApp.publish(
        globalPrincipal,
        "lark-doc",
        publishRequest(),
      ),
      "content_integrity_mismatch",
    );
  });

  it("returns immutable canonical snapshots for replayed owner results", async () => {
    const input = harness();
    const ownerReplay = {
      skill_version_id: "skill_version_replayed",
      skill_name: "lark-doc",
      version: "1.0.0",
      state: "published" as const,
      package_digest: packageDigest,
      manifest_digest: manifestDigest,
      runtime_target: "filesystem_bundle.v1" as const,
      created_at: "2026-07-24T00:00:00.000Z",
      duplicate_replayed: true,
    };
    vi.spyOn(input.repository, "replayPublish").mockResolvedValue(
      ownerReplay,
    );

    const replay = await input.app.publish(
      globalPrincipal,
      "lark-doc",
      publishRequest(),
    );
    ownerReplay.skill_name = "mutated-after-return";
    expect(replay.skill_name).toBe("lark-doc");
    expect(Object.isFrozen(replay)).toBe(true);
    expect(() => {
      (replay as { skill_name: string }).skill_name = "mutate";
    }).toThrow();
    vi.restoreAllMocks();
  });

  it("keeps the first terminal validation outcome across approval and rejection races", async () => {
    const rejectedFirst = harness();
    let releaseApproval!: () => void;
    let signalApprovalStarted!: () => void;
    const approvalGate = new Promise<void>((resolve) => {
      releaseApproval = resolve;
    });
    const approvalStarted = new Promise<void>((resolve) => {
      signalApprovalStarted = resolve;
    });
    const delayedApproval = new SkillRegistryApplicationV1({
      repository: rejectedFirst.repository,
      object_store: rejectedFirst.objectStore,
      object_store_metadata_kind: "memory",
      package_inspector: new InProcessSkillPackageInspectorV1(
        async () => {
          signalApprovalStarted();
          await approvalGate;
          return inspection;
        },
      ),
      validation_artifact_reader:
        rejectedFirst.validationArtifacts,
      policy_input_reader: rejectedFirst.policies,
      deployment_mode: "test",
      now: () => rejectedFirst.clock.now,
    });
    const rejecting = new SkillRegistryApplicationV1({
      repository: rejectedFirst.repository,
      object_store: rejectedFirst.objectStore,
      object_store_metadata_kind: "memory",
      package_inspector: new InProcessSkillPackageInspectorV1(
        () => ({
          ...inspection,
          package_root_name: "different-skill",
        }),
      ),
      validation_artifact_reader:
        rejectedFirst.validationArtifacts,
      policy_input_reader: rejectedFirst.policies,
      deployment_mode: "test",
      now: () => rejectedFirst.clock.now,
    });
    const lateApproval = delayedApproval.validate(
      validationPrincipal,
      validateRequest(),
    );
    await approvalStarted;
    await expectCode(
      rejecting.validate(validationPrincipal, validateRequest()),
      "invalid_skill_package",
    );
    releaseApproval();
    await expectCode(lateApproval, "invalid_skill_package");
    expect(rejectedFirst.repository.validationFailureCount).toBe(1);

    const approvedFirst = harness();
    let releaseRejection!: () => void;
    let signalRejectionStarted!: () => void;
    const rejectionGate = new Promise<void>((resolve) => {
      releaseRejection = resolve;
    });
    const rejectionStarted = new Promise<void>((resolve) => {
      signalRejectionStarted = resolve;
    });
    const delayedRejection = new SkillRegistryApplicationV1({
      repository: approvedFirst.repository,
      object_store: approvedFirst.objectStore,
      object_store_metadata_kind: "memory",
      package_inspector: new InProcessSkillPackageInspectorV1(
        async () => {
          signalRejectionStarted();
          await rejectionGate;
          return {
            ...inspection,
            package_root_name: "different-skill",
          };
        },
      ),
      validation_artifact_reader:
        approvedFirst.validationArtifacts,
      policy_input_reader: approvedFirst.policies,
      deployment_mode: "test",
      now: () => approvedFirst.clock.now,
    });
    const lateRejection = delayedRejection.validate(
      validationPrincipal,
      validateRequest(),
    );
    await rejectionStarted;
    const approval = await approvedFirst.app.validate(
      validationPrincipal,
      validateRequest(),
    );
    releaseRejection();
    await expect(lateRejection).resolves.toEqual(approval);
    expect(approvedFirst.repository.validationFailureCount).toBe(0);
  });

  it("aborts a staging read when the total validation deadline expires", async () => {
    vi.useFakeTimers();
    try {
      const input = harness();
      let aborted = false;
      const blockedReader = {
        durability: "memory",
        cancellation_kind: "abort_signal",
        async checkReadiness() {},
        async readArtifact(
          _request: SkillValidateRequestV1,
          signal: AbortSignal,
        ) {
          return new Promise<never>((_resolve, reject) => {
            signal.addEventListener(
              "abort",
              () => {
                aborted = true;
                reject(signal.reason);
              },
              { once: true },
            );
          });
        },
      } satisfies SkillValidationArtifactReaderPortV1;
      const app = new SkillRegistryApplicationV1({
        repository: input.repository,
        object_store: input.objectStore,
        object_store_metadata_kind: "memory",
        package_inspector: new InProcessSkillPackageInspectorV1(
          () => inspection,
        ),
        validation_artifact_reader: blockedReader,
        policy_input_reader: input.policies,
        deployment_mode: "test",
        config: { validation_timeout_seconds: 5 },
        now: () => input.clock.now,
      });
      const pending = app.validate(
        validationPrincipal,
        validateRequest(),
      );
      const rejection = expect(pending).rejects.toMatchObject({
        code: "registry_unavailable",
      });

      await vi.advanceTimersByTimeAsync(5_001);
      await rejection;
      expect(aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("aborts isolated package inspection at the same validation deadline", async () => {
    vi.useFakeTimers();
    try {
      const input = harness();
      let aborted = false;
      const blockedInspector = {
        execution_kind: "in_process",
        cancellation_kind: "abort_signal",
        async checkReadiness() {},
        async inspectPackage(
          _bytes: Uint8Array,
          signal: AbortSignal,
        ) {
          return new Promise<never>((_resolve, reject) => {
            signal.addEventListener(
              "abort",
              () => {
                aborted = true;
                reject(signal.reason);
              },
              { once: true },
            );
          });
        },
      } satisfies SkillPackageInspectorPortV1;
      const app = new SkillRegistryApplicationV1({
        repository: input.repository,
        object_store: input.objectStore,
        object_store_metadata_kind: "memory",
        package_inspector: blockedInspector,
        validation_artifact_reader: input.validationArtifacts,
        policy_input_reader: input.policies,
        deployment_mode: "test",
        config: { validation_timeout_seconds: 5 },
        now: () => input.clock.now,
      });
      const pending = app.validate(
        validationPrincipal,
        validateRequest(),
      );
      const rejection = expect(pending).rejects.toMatchObject({
        code: "registry_unavailable",
      });

      await vi.advanceTimersByTimeAsync(5_001);
      await rejection;
      expect(aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("fences rollback races and keeps lifecycle replay and emergency epoch atomic", async () => {
    const input = harness();
    const first = await publishedAndActivated(input);
    const second = await seedAndPublishVersion(input, {
      validationId: "validation_2",
      skillId: "skill_1",
      skillName: "lark-doc",
      semver: "2.0.0",
    });
    const catalogAfterFirst = input.repository.catalogIdentity(
      catalogScope,
    );
    const secondActivation = await input.app.activate(
      managementPrincipal,
      "lark-doc",
      activateRequest(second.skill_version_id, {
        expected_catalog_version:
          catalogAfterFirst.catalog_version,
        expected_activation_revision:
          first.activated.new_revision,
        idempotency_key: "activate:lark-doc:2.0.0",
      }),
    );
    const rollbackRequest = {
      schema_version: "skill.management-command.v1",
      operation: "rollback",
      scope_kind: "scoped",
      ...catalogScope,
      skill_id: "skill_1",
      target_version_id: first.published.skill_version_id,
      expected_catalog_version:
        secondActivation.catalog_version,
      expected_activation_revision:
        secondActivation.new_revision,
      reason: "rollback race",
      idempotency_key: "rollback-a",
      trace_id: "trace_rollback",
    } as const;
    const rollbackRace = await Promise.allSettled([
      input.app.rollback(
        managementPrincipal,
        "lark-doc",
        rollbackRequest,
      ),
      input.app.rollback(
        managementPrincipal,
        "lark-doc",
        { ...rollbackRequest, idempotency_key: "rollback-b" },
      ),
    ]);
    expect(
      rollbackRace.filter((entry) => entry.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      (
        rollbackRace.find(
          (entry): entry is PromiseRejectedResult =>
            entry.status === "rejected",
        )?.reason as SkillRegistryApplicationErrorV1
      ).code,
    ).toMatch(/^(?:activation|catalog_version)_conflict$/u);

    const deprecated = await input.app.deprecate(
      lifecyclePrincipal,
      "lark-doc",
      first.published.skill_version_id,
      {
        schema_version: "skill.management-command.v1",
        operation: "deprecate",
        scope_kind: "global",
        skill_id: "skill_1",
        version_id: first.published.skill_version_id,
        expected_lifecycle_version: 1,
        reason: "sunset",
        idempotency_key: "deprecate:lark-doc:1",
        trace_id: "trace_deprecate",
      },
    );
    const outboxAfterDeprecate =
      input.repository.outboxRecords.length;
    await expect(
      input.app.deprecate(
        lifecyclePrincipal,
        "lark-doc",
        first.published.skill_version_id,
        {
          schema_version: "skill.management-command.v1",
          operation: "deprecate",
          scope_kind: "global",
          skill_id: "skill_1",
          version_id: first.published.skill_version_id,
          expected_lifecycle_version: 1,
          reason: "sunset",
          idempotency_key: "deprecate:lark-doc:1",
          trace_id: "trace_deprecate",
        },
      ),
    ).resolves.toMatchObject({
      command_id: deprecated.command_id,
      duplicate_replayed: true,
    });
    expect(input.repository.outboxRecords).toHaveLength(
      outboxAfterDeprecate,
    );

    const ordinaryRevoked = await input.app.revoke(
      lifecyclePrincipal,
      "lark-doc",
      first.published.skill_version_id,
      {
        schema_version: "skill.management-command.v1",
        operation: "revoke",
        scope_kind: "global",
        skill_id: "skill_1",
        version_id: first.published.skill_version_id,
        expected_lifecycle_version: 2,
        emergency: false,
        reason: "ordinary revoke",
        idempotency_key: "revoke:lark-doc:1",
        trace_id: "trace_revoke",
      },
    );
    expect(ordinaryRevoked.security_revocation_epoch).toBe(0);
    const emergencyRevoked = await input.app.revoke(
      lifecyclePrincipal,
      "lark-doc",
      second.skill_version_id,
      {
        schema_version: "skill.management-command.v1",
        operation: "revoke",
        scope_kind: "global",
        skill_id: "skill_1",
        version_id: second.skill_version_id,
        expected_lifecycle_version: 1,
        emergency: true,
        reason: "emergency revoke",
        idempotency_key: "revoke:lark-doc:2",
        trace_id: "trace_emergency_revoke",
      },
    );
    expect(emergencyRevoked.security_revocation_epoch).toBe(1);
    const outboxAfterEmergency =
      input.repository.outboxRecords.length;
    await expect(
      input.app.revoke(
        lifecyclePrincipal,
        "lark-doc",
        second.skill_version_id,
        {
          schema_version: "skill.management-command.v1",
          operation: "revoke",
          scope_kind: "global",
          skill_id: "skill_1",
          version_id: second.skill_version_id,
          expected_lifecycle_version: 1,
          emergency: true,
          reason: "emergency revoke",
          idempotency_key: "revoke:lark-doc:2",
          trace_id: "trace_emergency_revoke",
        },
      ),
    ).resolves.toMatchObject({
      command_id: emergencyRevoked.command_id,
      security_revocation_epoch: 1,
      duplicate_replayed: true,
    });
    expect(input.repository.outboxRecords).toHaveLength(
      outboxAfterEmergency,
    );
    expect(
      input.repository.outboxRecords.every((event) =>
        Value.Check(SkillRegistryDomainEventV1Schema, event),
      ),
    ).toBe(true);
  });

  it("freezes catalog pagination AAD and invalidates forged, cross-principal, and permission-drift cursors", async () => {
    const input = harness();
    const first = await publishedAndActivated(input);
    const firstScopeHash = skillPermissionScopeHashV1({
      ...catalogScope,
      skill_id: "skill_1",
      owner_agent_id: "agent_1",
    });
    const firstGrant = await input.app.grantPermission(
      managementPrincipal,
      "lark-doc",
      {
        schema_version: "skill.management-command.v1",
        operation: "permission_grant",
        scope_kind: "scoped",
        ...catalogScope,
        owner_agent_id: "agent_1",
        skill_id: "skill_1",
        capability_refs: ["docs.read"],
        scope_hash: firstScopeHash,
        expected_catalog_version:
          first.activated.catalog_version,
        expected_permission_revision: "none",
        reason: "grant docs",
        idempotency_key: "permission:grant:skill-1",
        trace_id: "trace_permission_grant",
      },
    );
    const second = await seedAndPublishVersion(input, {
      validationId: "validation_drive",
      skillId: "skill_2",
      skillName: "lark-drive",
      semver: "1.0.0",
    });
    const secondActivation = await input.app.activate(
      managementPrincipal,
      "lark-drive",
      {
        schema_version: "skill.management-command.v1",
        operation: "activate",
        scope_kind: "scoped",
        ...catalogScope,
        skill_id: "skill_2",
        version_id: second.skill_version_id,
        expected_catalog_version: firstGrant.catalog_version,
        expected_activation_revision: "none",
        reason: "activate drive",
        idempotency_key: "activate:lark-drive:1",
        trace_id: "trace_activate_drive",
      },
    );
    const secondScopeHash = skillPermissionScopeHashV1({
      ...catalogScope,
      skill_id: "skill_2",
      owner_agent_id: "agent_1",
    });
    await input.app.grantPermission(
      managementPrincipal,
      "lark-drive",
      {
        schema_version: "skill.management-command.v1",
        operation: "permission_grant",
        scope_kind: "scoped",
        ...catalogScope,
        owner_agent_id: "agent_1",
        skill_id: "skill_2",
        capability_refs: ["drive.read"],
        scope_hash: secondScopeHash,
        expected_catalog_version:
          secondActivation.catalog_version,
        expected_permission_revision: "none",
        reason: "grant drive",
        idempotency_key: "permission:grant:skill-2",
        trace_id: "trace_permission_drive",
      },
    );

    const firstPage = await input.app.queryCatalog(
      catalogPrincipal,
      catalogRequest({ limit: 1 }),
    );
    const contractMaximumPage = await input.app.queryCatalog(
      catalogPrincipal,
      catalogRequest({
        limit: 500,
        trace_id: "trace_catalog_contract_max",
      }),
    );
    expect(contractMaximumPage.items).toHaveLength(2);
    const explicitAsOfPage = await input.app.queryCatalog(
      catalogPrincipal,
      catalogRequest({
        as_of: firstPage.as_of,
        limit: 1,
        trace_id: "trace_catalog_as_of",
      }),
    );
    expect(explicitAsOfPage.catalog_version).toBe(
      firstPage.catalog_version,
    );
    expect(firstPage.items).toHaveLength(1);
    expect(firstPage.next_cursor).not.toBeNull();
    const secondPage = await input.app.queryCatalog(
      catalogPrincipal,
      catalogRequest({
        limit: 1,
        cursor: firstPage.next_cursor!,
      }),
    );
    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.catalog_version).toBe(
      firstPage.catalog_version,
    );
    expect(secondPage.as_of).toBe(firstPage.as_of);
    expect(secondPage.skill_permission_summary_hash).toBe(
      firstPage.skill_permission_summary_hash,
    );
    const permissionDriftPage = await input.app.queryCatalog(
      catalogPrincipal,
      catalogRequest({ limit: 1, trace_id: "trace_catalog_drift" }),
    );

    await expect(
      input.app.queryCatalog(
        catalogPrincipal,
        catalogRequest({
          limit: 1,
          cursor: `${firstPage.next_cursor!}0`,
        }),
      ),
    ).rejects.toMatchObject({
      code: "invalid_cursor",
      details: {
        reason: "malformed",
        restart_from_first_page: true,
      },
    });
    await expect(
      input.app.queryCatalog(
        {
          ...catalogPrincipal,
          principal_id: "another_catalog_principal",
        },
        catalogRequest({
          limit: 1,
          cursor: firstPage.next_cursor!,
        }),
      ),
    ).rejects.toMatchObject({
      code: "invalid_cursor",
      details: { reason: "context_changed" },
    });
    input.clock.now = new Date("2026-07-24T00:17:00.000Z");
    await expect(
      input.app.queryCatalog(
        catalogPrincipal,
        catalogRequest({
          limit: 1,
          cursor: firstPage.next_cursor!,
        }),
      ),
    ).rejects.toMatchObject({
      code: "invalid_cursor",
      details: { reason: "expired" },
    });
    input.clock.now = new Date("2026-07-24T00:01:00.000Z");

    const currentCatalog =
      input.repository.catalogIdentity(catalogScope);
    await input.app.revokePermission(
      managementPrincipal,
      "lark-doc",
      {
        schema_version: "skill.management-command.v1",
        operation: "permission_revoke",
        scope_kind: "scoped",
        ...catalogScope,
        owner_agent_id: "agent_1",
        skill_id: "skill_1",
        capability_refs: ["docs.read"],
        scope_hash: firstScopeHash,
        expected_catalog_version:
          currentCatalog.catalog_version,
        expected_permission_revision: firstGrant.new_revision,
        reason: "revoke docs",
        idempotency_key: "permission:revoke:skill-1",
        trace_id: "trace_permission_revoke",
      },
    );
    expect(input.repository.permissionRevisionCount).toBe(3);
    await expect(
      input.app.queryCatalog(
        catalogPrincipal,
        catalogRequest({
          limit: 1,
          cursor: permissionDriftPage.next_cursor!,
        }),
      ),
    ).rejects.toMatchObject({
      code: "invalid_cursor",
      details: { reason: "context_changed" },
    });
    await expectCode(
      input.app.grantPermission(
        managementPrincipal,
        "lark-doc",
        {
          schema_version: "skill.management-command.v1",
          operation: "permission_grant",
          scope_kind: "scoped",
          ...catalogScope,
          owner_agent_id: "agent_1",
          skill_id: "skill_1",
          capability_refs: ["docs.write"],
          scope_hash: firstScopeHash,
          expected_catalog_version:
            currentCatalog.catalog_version,
          expected_permission_revision: firstGrant.new_revision,
          reason: "stale grant",
          idempotency_key: "permission:stale:skill-1",
          trace_id: "trace_permission_stale",
        },
      ),
      "catalog_version_conflict",
    );
    expect(
      input.repository.outboxRecords.every((event) =>
        Value.Check(SkillRegistryDomainEventV1Schema, event),
      ),
    ).toBe(true);
  });

  it("normalizes invalid_cursor recovery details and strips reason_code aliases", () => {
    const malformed = new SkillRegistryApplicationErrorV1(
      "invalid_cursor",
      "cursor failed",
      {
        reason: "internal_mac_mismatch",
        reason_code: "secret_branch",
        restart_from_first_page: false,
      },
    );
    expect(malformed.details).toEqual({
      reason: "malformed",
      restart_from_first_page: true,
    });
    const contextChanged = new SkillRegistryApplicationErrorV1(
      "invalid_cursor",
      "cursor context changed",
      {
        reason: "context_changed",
        reason_code: "forbidden_alias",
      },
    );
    expect(contextChanged.details).toEqual({
      reason: "context_changed",
      restart_from_first_page: true,
    });
    expect(contextChanged.details).not.toHaveProperty("reason_code");
  });

  it("rejects management actor injection and scope-hash spoofing before owner state changes", async () => {
    const input = harness();
    const activation = await publishedAndActivated(input);
    const before = input.repository.outboxRecords.length;
    await expectCode(
      input.app.grantPermission(
        managementPrincipal,
        "lark-doc",
        {
          schema_version: "skill.management-command.v1",
          operation: "permission_grant",
          scope_kind: "scoped",
          ...catalogScope,
          skill_id: "skill_1",
          capability_refs: ["docs.read"],
          scope_hash: sha256BytesV1("spoofed-scope"),
          expected_catalog_version:
            activation.activated.catalog_version,
          expected_permission_revision: "none",
          reason: "spoof",
          idempotency_key: "permission:spoof",
          trace_id: "trace_spoof",
        },
      ),
      "authorization_scope_mismatch",
    );
    await expectCode(
      input.app.activate(
        managementPrincipal,
        "lark-doc",
        {
          ...activateRequest(activation.published.skill_version_id, {
            expected_catalog_version:
              activation.activated.catalog_version,
            expected_activation_revision:
              activation.activated.new_revision,
            idempotency_key: "activate:actor-spoof",
          }),
          actor_principal_id: "attacker",
        } as SkillActivateRequestV1,
      ),
      "invalid_request",
    );
    const crossOwnerRequest = {
      schema_version: "skill.management-command.v1" as const,
      operation: "permission_grant" as const,
      scope_kind: "scoped" as const,
      ...catalogScope,
      owner_agent_id: "agent_2",
      skill_id: "skill_1",
      capability_refs: ["docs.read"],
      scope_hash: skillPermissionScopeHashV1({
        ...catalogScope,
        owner_agent_id: "agent_2",
        skill_id: "skill_1",
      }),
      expected_catalog_version:
        activation.activated.catalog_version,
      expected_permission_revision: "none",
      reason: "cross-owner spoof",
      idempotency_key: "permission:cross-owner-spoof",
      trace_id: "trace_cross_owner_spoof",
    };
    await expectCode(
      input.app.grantPermission(
        managementPrincipal,
        "lark-doc",
        crossOwnerRequest,
      ),
      "authorization_scope_mismatch",
    );
    expect(input.repository.outboxRecords).toHaveLength(before);
  });

  it("registers every documented route and fail-closed readiness", async () => {
    const input = harness();
    const routedApp = buildSkillRegistryApp(
      { logger: false },
      { registry: input.app },
    );
    const routes = routedApp.printRoutes();
    expect(routes).toContain("internal/skill-registry/");
    expect(routes).toContain("resolve (POST)");
    expect(routes).toContain("activations:");
    expect(routes).toContain("activate (POST)");
    expect(routes).toContain("rollback (POST)");
    expect(routes).toContain("disable (POST)");
    expect(routes).toContain("permissions:");
    expect(routes).toContain("talog (GET");
    expect(routes).toContain("validate (POST)");
    expect(routes).toContain("::deprecate");
    expect(routes).toContain("::revoke");
    expect(routes).toContain("resolutions/");
    expect(routes).toContain("ndidate-applications");
    expect(SKILL_REGISTRY_ROUTES_V1.publish).toContain(":name/versions");
    await routedApp.close();

    const incompleteApp = buildSkillRegistryApp(
      { logger: false },
      {},
      { require_complete_pipeline: true },
    );
    const readiness = await incompleteApp.inject({
      method: "GET",
      url: "/ready",
    });
    expect(readiness.statusCode).toBe(503);
    await incompleteApp.close();
  });

  it("replays validation idempotently after the workload JWT is renewed", async () => {
    const input = harness();
    const now = Math.floor(Date.now() / 1_000);
    let jti = "registry-validation-token-1";
    const app = buildSkillRegistryApp(
      {
        logger: false,
        auth: {
          verifier: {
            async verify() {
              return {
                protectedHeader: {
                  alg: "EdDSA",
                  kid: "test",
                  typ: "JWT",
                },
                claims: {
                  iss: "pai-workload",
                  sub: "skill_registry",
                  aud: "skill_registry",
                  jti,
                  iat: now,
                  nbf: now,
                  exp: now + 60,
                  capability: ["skill.package.validate"],
                  scope_kind: "global",
                },
              };
            },
          },
        },
      },
      { registry: input.app },
    );
    const first = await app.inject({
      method: "POST",
      url: SKILL_REGISTRY_ROUTES_V1.validate,
      headers: { authorization: "Bearer aaa.bbb.ccc" },
      payload: validateRequest(),
    });
    expect(first.statusCode).toBe(200);

    jti = "registry-validation-token-2";
    const replay = await app.inject({
      method: "POST",
      url: SKILL_REGISTRY_ROUTES_V1.validate,
      headers: { authorization: "Bearer aaa.bbb.ccc" },
      payload: validateRequest(),
    });
    expect(replay.statusCode).toBe(200);
    expect(replay.json().details).toEqual(first.json().details);
    await app.close();
  });

  it("binds activation CAS to operation and both atomic outbox payloads", () => {
    const writer =
      SKILL_REGISTRY_REPOSITORY_CONTRACT_V1.function_signatures.find(
        ({ function_name }) =>
          function_name === "cas_skill_activation_current_v1",
      );
    expect(writer).toBeDefined();
    expect(
      writer!.arguments.map(({ argument_name }) => argument_name),
    ).toEqual(
      expect.arrayContaining([
        "p_operation",
        "p_activation_event",
        "p_catalog_event",
      ]),
    );
    expect(writer!.reads_tables).toContain(
      "skill_catalog_revision_entries",
    );
    expect(writer!.writes_tables).toEqual(
      expect.arrayContaining([
        "skill_activation_revisions",
        "skill_activation_current",
        "skill_catalog_revisions",
        "skill_catalog_revision_entries",
        "skill_catalog_current",
        "skill_management_commands",
        "skill_audit_logs",
        "skill_event_outbox",
      ]),
    );
  });

  it("uses the ObjectStore deletion decision bigint ABI", () => {
    const writer =
      SKILL_REGISTRY_REPOSITORY_CONTRACT_V1.function_signatures.find(
        ({ function_name }) =>
          function_name === "transition_skill_package_retention_v1",
      );
    expect(writer).toBeDefined();
    expect(
      writer!.arguments.find(
        ({ argument_name }) =>
          argument_name === "p_object_store_deletion_decision_version",
      ),
    ).toEqual({
      argument_name: "p_object_store_deletion_decision_version",
      postgres_type: "bigint",
      mode: "in",
      nullable: true,
    });
  });

  it("binds permission CAS to permission, catalog, command, and event effects", () => {
    const writer =
      SKILL_REGISTRY_REPOSITORY_CONTRACT_V1.function_signatures.find(
        ({ function_name }) =>
          function_name === "cas_skill_permission_current_v1",
      );
    expect(writer).toBeDefined();
    expect(
      writer!.arguments.map(({ argument_name }) => argument_name),
    ).toEqual(
      expect.arrayContaining([
        "p_operation",
        "p_expected_permission_revision_id",
        "p_expected_catalog_version",
        "p_permission_revision",
        "p_catalog_revision",
        "p_catalog_entries",
        "p_summary",
        "p_management_command",
        "p_permission_event",
        "p_catalog_event",
        "p_idempotency_key",
      ]),
    );
    expect(writer!.writes_tables).toEqual(
      expect.arrayContaining([
        "skill_permission_revisions",
        "skill_permission_current",
        "skill_permission_summary_snapshots",
        "skill_permission_summary_entries",
        "skill_catalog_revisions",
        "skill_catalog_revision_entries",
        "skill_catalog_current",
        "skill_management_commands",
        "skill_audit_logs",
        "skill_event_outbox",
      ]),
    );
    expect(writer!.effects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table_name: "skill_permission_current",
          operation: "cas",
        }),
        expect.objectContaining({
          table_name: "skill_catalog_current",
          operation: "cas",
        }),
        expect.objectContaining({
          table_name: "skill_management_commands",
          operation: "append",
        }),
        expect.objectContaining({
          table_name: "skill_event_outbox",
          operation: "enqueue",
        }),
      ]),
    );
  });

  it("consumes validated staging atomically with version publication", () => {
    const writer =
      SKILL_REGISTRY_REPOSITORY_CONTRACT_V1.function_signatures.find(
        ({ function_name }) =>
          function_name === "publish_skill_version_v1",
      );
    expect(writer).toBeDefined();
    expect(writer!.reads_tables).toContain("skill_version_staging");
    expect(writer!.writes_tables).toEqual(
      expect.arrayContaining([
        "skill_version_staging",
        "skill_versions",
        "skill_packages",
        "skill_audit_logs",
        "skill_event_outbox",
      ]),
    );
    expect(writer!.effects).toEqual(
      expect.arrayContaining([
        {
          table_name: "skill_version_staging",
          operation: "transition",
          concurrency_control: "expected_state_version",
        },
        expect.objectContaining({
          table_name: "skill_versions",
          operation: "append",
        }),
        expect.objectContaining({
          table_name: "skill_packages",
          operation: "append",
        }),
      ]),
    );

    const stagingPermission =
      SKILL_REGISTRY_REPOSITORY_CONTRACT_V1.table_permissions.find(
        ({ table_name }) => table_name === "skill_version_staging",
      );
    const packagePermission =
      SKILL_REGISTRY_REPOSITORY_CONTRACT_V1.table_permissions.find(
        ({ table_name }) => table_name === "skill_packages",
      );
    for (const permission of [stagingPermission, packagePermission]) {
      expect(permission).toBeDefined();
      expect(permission!.select_columns).toEqual(
        expect.arrayContaining([
          "object_access_decision_ref",
          "owner_object_id",
          "owner_state_version",
        ]),
      );
    }
  });

  it("fences resolution against every frozen decision input", () => {
    const writer =
      SKILL_REGISTRY_REPOSITORY_CONTRACT_V1.function_signatures.find(
        ({ function_name }) =>
          function_name === "transition_skill_resolution_attempt_v1",
      );
    expect(writer).toBeDefined();
    expect(
      writer!.arguments.map(({ argument_name }) => argument_name),
    ).toEqual(
      expect.arrayContaining([
        "p_expected_catalog_version",
        "p_catalog_as_of",
        "p_expected_security_revocation_epoch",
        "p_policy_input_hash",
        "p_skill_permission_summary_ref",
        "p_skill_permission_summary_hash",
        "p_idempotency_key",
      ]),
    );
    expect(writer!.reads_tables).toEqual(
      expect.arrayContaining([
        "skill_activation_revisions",
        "skill_activation_current",
        "skill_permission_revisions",
        "skill_permission_current",
        "skill_catalog_revisions",
        "skill_catalog_revision_entries",
        "skill_catalog_current",
        "skill_permission_summary_snapshots",
        "skill_permission_summary_entries",
        "skill_security_state",
      ]),
    );
  });

  it("binds lifecycle transitions to command, events, and idempotency", () => {
    const writer =
      SKILL_REGISTRY_REPOSITORY_CONTRACT_V1.function_signatures.find(
        ({ function_name }) =>
          function_name === "transition_skill_version_lifecycle_v1",
      );
    expect(writer).toBeDefined();
    expect(
      writer!.arguments.map(({ argument_name }) => argument_name),
    ).toEqual(
      expect.arrayContaining([
        "p_management_command",
        "p_version_event",
        "p_epoch_event",
        "p_idempotency_key",
      ]),
    );
    expect(writer!.writes_tables).toEqual(
      expect.arrayContaining([
        "skill_versions",
        "skill_security_state",
        "skill_management_commands",
        "skill_audit_logs",
        "skill_event_outbox",
      ]),
    );
    expect(writer!.effects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table_name: "skill_versions",
          operation: "transition",
        }),
        expect.objectContaining({
          table_name: "skill_management_commands",
          operation: "append",
        }),
        expect.objectContaining({
          table_name: "skill_security_state",
          operation: "upsert",
        }),
        expect.objectContaining({
          table_name: "skill_event_outbox",
          operation: "enqueue",
        }),
      ]),
    );
  });

  it("requires the signed delegated management actor and operation role", async () => {
    const input = harness();
    const published = await input.app.publish(
      globalPrincipal,
      "lark-doc",
      publishRequest(),
    );
    const now = Math.floor(Date.now() / 1_000);
    let delegatedRole: string | undefined;
    let managementCapabilities = ["skill.version.activate"];
    const verifier = {
      async verify() {
        return {
          protectedHeader: { alg: "EdDSA", kid: "test", typ: "JWT" },
          claims: {
            iss: "pai-workload",
            sub: "skill_registry",
            aud: "skill_registry",
            jti: "registry-management-dispatch-1",
            iat: now,
            nbf: now,
            exp: now + 60,
            capability: managementCapabilities,
            scope_kind: "bot",
            ...runtimeScope,
            ...(delegatedRole === undefined
              ? {}
              : {
                  delegated_principal: {
                    principal_type: "operator",
                    principal_id: "release-operator-1",
                    roles: [delegatedRole],
                    source_issuer: "test",
                    source_subject: "release-operator-1",
                    auth_time: now,
                    scope_kind: "bot",
                    ...runtimeScope,
                  },
                }),
          },
        };
      },
    };
    const app = buildSkillRegistryApp(
      { logger: false, auth: { verifier } },
      { registry: input.app },
    );
    const request = activateRequest(published.skill_version_id);
    const url =
      "/internal/skill-registry/skills/lark-doc/activations:activate";

    const missingActor = await app.inject({
      method: "POST",
      url,
      headers: { authorization: "Bearer aaa.bbb.ccc" },
      payload: request,
    });
    expect(missingActor.statusCode).toBe(403);
    delegatedRole = "workspace_skill_admin";
    const wrongRole = await app.inject({
      method: "POST",
      url,
      headers: { authorization: "Bearer aaa.bbb.ccc" },
      payload: request,
    });
    expect(wrongRole.statusCode).toBe(403);
    delegatedRole = "registry_release_admin";
    const accepted = await app.inject({
      method: "POST",
      url,
      headers: { authorization: "Bearer aaa.bbb.ccc" },
      payload: request,
    });
    expect(accepted.statusCode).toBe(200);
    expect(
      input.repository.outboxRecords.some(
        (event) =>
          event.event_type === "skill.version.activated" &&
          event.payload.actor_principal_id ===
            "release-operator-1",
      ),
    ).toBe(true);

    const activation = accepted.json().details;
    const disablePayload = disableRequest(
      activation.catalog_version,
      activation.new_revision,
      { idempotency_key: "disable:http:lark-doc:1" },
    );
    const disableUrl =
      "/internal/skill-registry/skills/lark-doc/activations:disable";
    const missingCapability = await app.inject({
      method: "POST",
      url: disableUrl,
      headers: { authorization: "Bearer aaa.bbb.ccc" },
      payload: disablePayload,
    });
    expect(missingCapability.statusCode).toBe(403);
    managementCapabilities = ["skill.activation.disable"];
    const disabled = await app.inject({
      method: "POST",
      url: disableUrl,
      headers: { authorization: "Bearer aaa.bbb.ccc" },
      payload: disablePayload,
    });
    expect(disabled.statusCode).toBe(200);
    expect(disabled.json().details).toMatchObject({
      operation: "disable",
      previous_revision: activation.new_revision,
    });
    await app.close();
  });

  it("requires a global security_admin actor for lifecycle revoke", async () => {
    const input = harness();
    const published = await input.app.publish(
      globalPrincipal,
      "lark-doc",
      publishRequest(),
    );
    const now = Math.floor(Date.now() / 1_000);
    let delegatedRole = "registry_release_admin";
    const verifier = {
      async verify() {
        return {
          protectedHeader: { alg: "EdDSA", kid: "test", typ: "JWT" },
          claims: {
            iss: "pai-workload",
            sub: "skill_registry",
            aud: "skill_registry",
            jti: "registry-security-dispatch-1",
            iat: now,
            nbf: now,
            exp: now + 60,
            capability: ["skill.version.revoke"],
            scope_kind: "global",
            delegated_principal: {
              principal_type: "operator",
              principal_id: "security-operator-1",
              roles: [delegatedRole],
              source_issuer: "test",
              source_subject: "security-operator-1",
              auth_time: now,
              scope_kind: "global",
            },
          },
        };
      },
    };
    const app = buildSkillRegistryApp(
      { logger: false, auth: { verifier } },
      { registry: input.app },
    );
    const url =
      `/internal/skill-registry/skills/lark-doc/versions/` +
      `${published.skill_version_id}:revoke`;
    const payload = {
      schema_version: "skill.management-command.v1",
      operation: "revoke",
      scope_kind: "global",
      skill_id: "skill_1",
      version_id: published.skill_version_id,
      expected_lifecycle_version: 1,
      emergency: false,
      reason: "security revoke",
      idempotency_key: "revoke:http:lark-doc:1",
      trace_id: "trace_http_revoke",
    };

    const wrongRole = await app.inject({
      method: "POST",
      url,
      headers: { authorization: "Bearer aaa.bbb.ccc" },
      payload,
    });
    expect(wrongRole.statusCode).toBe(403);
    delegatedRole = "security_admin";
    const accepted = await app.inject({
      method: "POST",
      url,
      headers: { authorization: "Bearer aaa.bbb.ccc" },
      payload,
    });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json().details).toMatchObject({
      lifecycle_state: "revoked",
      duplicate_replayed: false,
    });
    expect(
      input.repository.outboxRecords.some(
        (event) =>
          event.event_type === "skill.version.revoked" &&
          event.payload.actor_principal_id ===
            "security-operator-1",
      ),
    ).toBe(true);
    await app.close();
  });

  it("binds candidate reviewer identity to a signed delegated principal", async () => {
    const input = harness();
    const now = Math.floor(Date.now() / 1_000);
    let includeDelegatedReviewer = false;
    const verifier = {
      async verify() {
        return {
          protectedHeader: { alg: "EdDSA", kid: "test", typ: "JWT" },
          claims: {
            iss: "pai-workload",
            sub: "meta_cognition",
            aud: "skill_registry",
            jti: "meta-dispatch-1",
            iat: now,
            nbf: now,
            exp: now + 60,
            capability: [
              "skill.candidate.apply",
              "skill.catalog.read",
            ],
            scope_kind: "bot",
            ...runtimeScope,
            ...(includeDelegatedReviewer
              ? {
                  delegated_principal: {
                    principal_type: "user",
                    principal_id: "reviewer_01",
                    roles: ["skill.candidate.reviewer"],
                    source_issuer: "test",
                    source_subject: "reviewer_01",
                    auth_time: now,
                    scope_kind: "bot",
                    ...runtimeScope,
                  },
                }
              : {}),
          },
        };
      },
    };
    const app = buildSkillRegistryApp(
      { logger: false, auth: { verifier } },
      { registry: input.app },
    );
    const denied = await app.inject({
      method: "POST",
      url: SKILL_REGISTRY_ROUTES_V1.candidate_application,
      headers: { authorization: "Bearer aaa.bbb.ccc" },
      payload: candidateApplication(),
    });
    expect(denied.statusCode).toBe(403);
    const catalogWithoutDelegation = await app.inject({
      method: "GET",
      url:
        `${SKILL_REGISTRY_ROUTES_V1.catalog}?` +
        new URLSearchParams({
          ...runtimeScope,
          limit: "1",
          trace_id: "trace_catalog_meta",
        }).toString(),
      headers: { authorization: "Bearer aaa.bbb.ccc" },
    });
    expect(catalogWithoutDelegation.statusCode).toBe(200);

    includeDelegatedReviewer = true;
    const accepted = await app.inject({
      method: "POST",
      url: SKILL_REGISTRY_ROUTES_V1.candidate_application,
      headers: { authorization: "Bearer aaa.bbb.ccc" },
      payload: candidateApplication(),
    });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json().details.status).toBe("received");
    await app.close();
  });

  it("exposes context catalog only to Trigger Processor with its dedicated capability", async () => {
    const input = harness();
    await publishedAndActivated(input);
    const now = Math.floor(Date.now() / 1_000);
    let capabilities = ["skill.context_catalog.read"];
    const verifier = {
      async verify() {
        return {
          protectedHeader: { alg: "EdDSA", kid: "test", typ: "JWT" },
          claims: {
            iss: "pai-workload",
            sub: "trigger_processor",
            aud: "skill_registry",
            jti: "trigger-context-catalog-1",
            iat: now,
            nbf: now,
            exp: now + 60,
            capability: capabilities,
            scope_kind: "bot",
            ...runtimeScope,
          },
        };
      },
    };
    const app = buildSkillRegistryApp(
      { logger: false, auth: { verifier } },
      { registry: input.app },
    );
    const payload = {
      schema_version: "skill_context_catalog_request.v1",
      ...runtimeScope,
      limit: 500,
      trace_id: "trace_http_context_catalog",
    };
    const accepted = await app.inject({
      method: "POST",
      url: SKILL_REGISTRY_ROUTES_V1.context_catalog,
      headers: { authorization: "Bearer aaa.bbb.ccc" },
      payload,
    });
    expect(accepted.statusCode, accepted.body).toBe(200);
    expect(accepted.json()).toMatchObject({
      code: "skill_context_catalog_found",
      details: {
        catalog_version: expect.any(String),
        items: [expect.objectContaining({ skill_key: "lark-doc" })],
      },
    });
    capabilities = ["skill.catalog.read"];
    const denied = await app.inject({
      method: "POST",
      url: SKILL_REGISTRY_ROUTES_V1.context_catalog,
      headers: { authorization: "Bearer aaa.bbb.ccc" },
      payload,
    });
    expect(denied.statusCode).toBe(403);
    await app.close();
  });

  it("maps Shared canonical boundary failures into the Skill error union", async () => {
    const input = harness();
    const now = Math.floor(Date.now() / 1_000);
    const verifier = {
      async verify() {
        return {
          protectedHeader: {
            alg: "EdDSA",
            kid: "test",
            typ: "JWT",
          },
          claims: {
            iss: "pai-workload",
            sub: "skill_registry",
            aud: "skill_registry",
            jti: "registry-validation-dispatch-1",
            iat: now,
            nbf: now,
            exp: now + 60,
            capability: ["skill.package.validate"],
            scope_kind: "global",
          },
        };
      },
    };
    const app = buildSkillRegistryApp(
      { logger: false, auth: { verifier } },
      { registry: input.app },
    );
    const malformed = await app.inject({
      method: "POST",
      url: SKILL_REGISTRY_ROUTES_V1.validate,
      headers: {
        authorization: "Bearer aaa.bbb.ccc",
        "content-type": "application/json",
      },
      payload: JSON.stringify({
        ...validateRequest(),
        trace_id: "\ud800",
      }),
    });
    expect(malformed.statusCode).toBe(400);
    expect(malformed.json()).toMatchObject({
      code: "invalid_request",
      retryable: false,
      details: { field_path: "/" },
    });

    let nested: unknown = "leaf";
    for (let depth = 0; depth < 140; depth += 1) {
      nested = { child: nested };
    }
    const tooDeep = await app.inject({
      method: "POST",
      url: SKILL_REGISTRY_ROUTES_V1.validate,
      headers: {
        authorization: "Bearer aaa.bbb.ccc",
        "content-type": "application/json",
      },
      payload: JSON.stringify({
        ...validateRequest(),
        extra: nested,
      }),
    });
    expect(tooDeep.statusCode).toBe(400);
    expect(tooDeep.json()).toMatchObject({
      code: "invalid_request",
      retryable: false,
      details: { field_path: "/" },
    });

    for (const payload of [
      { ...validateRequest(), unexpected: true },
      { ...validateRequest(), size_bytes: "not-an-integer" },
    ]) {
      const invalidSchema = await app.inject({
        method: "POST",
        url: SKILL_REGISTRY_ROUTES_V1.validate,
        headers: {
          authorization: "Bearer aaa.bbb.ccc",
          "content-type": "application/json",
        },
        payload,
      });
      expect(invalidSchema.statusCode).toBe(400);
      expect(invalidSchema.json()).toMatchObject({
        code: "invalid_request",
        retryable: false,
      });
    }
    await app.close();
  });
});
