import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  SKILL_REGISTRY_DOMAIN_EVENT_BRANCH_SCHEMAS_V1,
  SKILL_REGISTRY_DOMAIN_EVENT_CONTRACT_VERSION_V1,
  SKILL_REGISTRY_DOMAIN_EVENT_CONSUMERS_V1,
  SKILL_REGISTRY_DOMAIN_EVENT_TYPES_V1,
  SKILL_REGISTRY_DOMAIN_EVENT_V1_DATABASE_CHECK,
  SkillRegistryDomainEventV1Schema,
} from "../../src/index.js";

const hash = `sha256:${"1".repeat(64)}` as const;
const envelope = {
  event_id: "event_01",
  schema_version: "skill_registry_event.v1",
  producer: "skill_registry",
  occurred_at: "2026-07-24T00:00:00.000Z",
  idempotency_key: "version:version_01:published:1",
  trace_id: "trace_01",
} as const;

describe("SkillRegistryDomainEventV1", () => {
  it("uses exactly eight top-level fields and rejects global scope spoofing", () => {
    const event = {
      ...envelope,
      event_type: "skill.version.published",
      payload: {
        scope_kind: "global",
        actor_principal_id: "principal_01",
        reason_code: "published",
        skill_id: "skill_01",
        skill_key: "lark-doc",
        version_id: "version_01",
        version: "1.4.0",
        lifecycle_version: 1,
        package_digest: hash,
        manifest_digest: hash,
        published_at: envelope.occurred_at,
      },
    } as const;
    expect(Value.Check(SkillRegistryDomainEventV1Schema, event)).toBe(true);
    expect(Object.keys(event)).toHaveLength(8);
    expect(
      Value.Check(
        SKILL_REGISTRY_DOMAIN_EVENT_BRANCH_SCHEMAS_V1[
          "skill.version.published"
        ],
        {
          ...event,
          payload: { ...event.payload, workspace_id: "ws_01" },
        },
      ),
    ).toBe(false);
  });

  it("requires scoped identity and complete candidate five-tuple provenance", () => {
    const scopedSchema =
      SKILL_REGISTRY_DOMAIN_EVENT_BRANCH_SCHEMAS_V1["skill.catalog.changed"];
    expect(
      Value.Check(scopedSchema, {
        ...envelope,
        event_type: "skill.catalog.changed",
        payload: {
          scope_kind: "scoped",
          actor_principal_id: "principal_01",
          reason_code: "activation_changed",
          catalog_revision_id: "catalog_revision_01",
          catalog_version: "cat_184",
          catalog_as_of: envelope.occurred_at,
          changed_skill_keys: [],
          security_revocation_epoch: 1,
        },
      }),
    ).toBe(false);
    const candidateSchema =
      SKILL_REGISTRY_DOMAIN_EVENT_BRANCH_SCHEMAS_V1[
        "skill.candidate.application.updated"
      ];
    const candidate = {
      ...envelope,
      event_type: "skill.candidate.application.updated",
      payload: {
        scope_kind: "provenance",
        workspace_id: "ws_01",
        bot_id: "bot_01",
        owner_agent_id: "agent_01",
        deployment_environment: "prod",
        release_channel: "stable",
        actor_principal_id: "principal_01",
        reason_code: "received",
        application_id: "application_01",
        candidate_id: "candidate_01",
        review_version: 1,
        candidate_type: "new_skill",
        skill_key: "new-skill",
        status: "received",
        response_ref: "response_01",
        response_hash: hash,
      },
    } as const;
    expect(Value.Check(candidateSchema, candidate)).toBe(true);
    const { owner_agent_id: _ownerAgentId, ...incomplete } = candidate.payload;
    expect(
      Value.Check(candidateSchema, { ...candidate, payload: incomplete }),
    ).toBe(false);
  });

  it("publishes the complete union, exact routes and database CHECK parity", () => {
    expect(SKILL_REGISTRY_DOMAIN_EVENT_CONTRACT_VERSION_V1).toBe("1.1.0");
    expect(Object.keys(SKILL_REGISTRY_DOMAIN_EVENT_CONSUMERS_V1)).toEqual(
      SKILL_REGISTRY_DOMAIN_EVENT_TYPES_V1,
    );
    expect(
      Object.values(SKILL_REGISTRY_DOMAIN_EVENT_CONSUMERS_V1)
        .flat()
        .includes("observation_gateway" as never),
    ).toBe(false);
    expect(
      SKILL_REGISTRY_DOMAIN_EVENT_CONSUMERS_V1[
        "skill.package.retention.changed"
      ],
    ).toEqual([]);
    for (const eventType of SKILL_REGISTRY_DOMAIN_EVENT_TYPES_V1) {
      expect(SKILL_REGISTRY_DOMAIN_EVENT_V1_DATABASE_CHECK).toContain(
        `'${eventType}'`,
      );
    }
  });

  it("binds ObjectStore deletion decisions to the shared safe-integer domain", () => {
    const schema =
      SKILL_REGISTRY_DOMAIN_EVENT_BRANCH_SCHEMAS_V1[
        "skill.package.retention.changed"
      ];
    const event = {
      ...envelope,
      event_type: "skill.package.retention.changed",
      payload: {
        scope_kind: "global",
        actor_principal_id: "principal_01",
        reason_code: "object_deleted",
        skill_id: "skill_01",
        version_id: "version_01",
        package_id: "package_01",
        previous_retention_state: "deletion_pending",
        retention_state: "deleted",
        previous_state_version: 1,
        state_version: 2,
        object_store_deletion_decision_version: Number.MAX_SAFE_INTEGER,
      },
    } as const;

    expect(Value.Check(schema, event)).toBe(true);
    expect(
      Value.Check(schema, {
        ...event,
        payload: {
          ...event.payload,
          object_store_deletion_decision_version: 0,
        },
      }),
    ).toBe(false);
    expect(
      Value.Check(schema, {
        ...event,
        payload: {
          ...event.payload,
          object_store_deletion_decision_version:
            Number.MAX_SAFE_INTEGER + 1,
        },
      }),
    ).toBe(false);
    expect(
      Value.Check(schema, {
        ...event,
        payload: {
          ...event.payload,
          object_store_deletion_decision_version: "1",
        },
      }),
    ).toBe(false);
  });

  it("requires the complete scoped activation-disabled provenance", () => {
    const schema =
      SKILL_REGISTRY_DOMAIN_EVENT_BRANCH_SCHEMAS_V1[
        "skill.activation.disabled"
      ];
    const event = {
      ...envelope,
      event_type: "skill.activation.disabled",
      idempotency_key: "activation:activation_02:disabled",
      payload: {
        scope_kind: "scoped",
        workspace_id: "ws_01",
        bot_id: "bot_01",
        deployment_environment: "prod",
        release_channel: "stable",
        actor_principal_id: "principal_01",
        reason_code: "disable",
        skill_id: "skill_01",
        skill_key: "lark-doc",
        version_id: "version_01",
        version: "1.4.0",
        activation_revision_id: "activation_02",
        previous_activation_revision_id: "activation_01",
        catalog_version: "cat_185",
        disabled_at: envelope.occurred_at,
      },
    } as const;
    expect(Value.Check(schema, event)).toBe(true);
    expect(
      Value.Check(schema, {
        ...event,
        payload: {
          ...event.payload,
          owner_agent_id: "forbidden_owner_scope",
        },
      }),
    ).toBe(false);
    const {
      previous_activation_revision_id: _previous,
      ...missingPrevious
    } = event.payload;
    expect(
      Value.Check(schema, { ...event, payload: missingPrevious }),
    ).toBe(false);
    expect(
      SKILL_REGISTRY_DOMAIN_EVENT_CONSUMERS_V1[
        "skill.activation.disabled"
      ],
    ).toEqual([
      "trigger_processor",
      "action_runtime",
      "meta_cognition",
    ]);
  });
});
