import { Type, type Static, type TLiteral, type TSchema } from "@sinclair/typebox";

import { DurableEventEnvelopeV1Schema } from "../shared/durable-event-envelope.v1.js";
import {
  SkillCatalogScopeV1Properties,
  SkillRuntimeScopeV1Properties,
  SkillRegistryCapabilityRefV1Schema,
  SkillRegistryIdentifierV1Schema,
  SkillRegistryNonNegativeIntegerV1Schema,
  SkillRegistryPositiveIntegerV1Schema,
  SkillRegistrySecurityEpochV1Schema,
  SkillRegistrySemverV1Schema,
  SkillRegistrySha256V1Schema,
  SkillRegistryTimestampV1Schema,
  assertStrictlySortedUniqueStringsV1,
} from "./primitives.v1.js";
import {
  SkillCandidateApplicationStatusV1Schema,
  SkillCandidateTypeV1Schema,
} from "./candidate-application.v1.js";

export const SKILL_REGISTRY_DOMAIN_EVENT_TYPES_V1 = Object.freeze([
  "skill.version.published",
  "skill.catalog.changed",
  "skill.version.activated",
  "skill.activation.disabled",
  "skill.activation.rolled_back",
  "skill.version.deprecated",
  "skill.version.revoked",
  "skill.permission.granted",
  "skill.permission.revoked",
  "skill.security_revocation_epoch.changed",
  "skill.candidate.application.updated",
  "skill.package.retention.changed",
  "skill.package.retention_hold.changed",
] as const);

export const SKILL_REGISTRY_DOMAIN_EVENT_CONTRACT_VERSION_V1 = "1.1.0";

export const SKILL_REGISTRY_DOMAIN_EVENT_CONSUMERS_V1 = Object.freeze({
  "skill.version.published": Object.freeze([
    "trigger_processor",
    "action_runtime",
  ]),
  "skill.catalog.changed": Object.freeze([
    "trigger_processor",
    "action_runtime",
    "meta_cognition",
  ]),
  "skill.version.activated": Object.freeze([
    "trigger_processor",
    "action_runtime",
    "meta_cognition",
  ]),
  "skill.activation.disabled": Object.freeze([
    "trigger_processor",
    "action_runtime",
    "meta_cognition",
  ]),
  "skill.activation.rolled_back": Object.freeze([
    "trigger_processor",
    "action_runtime",
    "meta_cognition",
  ]),
  "skill.version.deprecated": Object.freeze([
    "trigger_processor",
    "action_runtime",
    "meta_cognition",
  ]),
  "skill.version.revoked": Object.freeze([
    "action_runtime",
    "trigger_processor",
    "meta_cognition",
  ]),
  "skill.permission.granted": Object.freeze([
    "action_runtime",
    "trigger_processor",
  ]),
  "skill.permission.revoked": Object.freeze([
    "action_runtime",
    "trigger_processor",
  ]),
  "skill.security_revocation_epoch.changed": Object.freeze([
    "action_runtime",
    "trigger_processor",
    "meta_cognition",
  ]),
  "skill.candidate.application.updated": Object.freeze(["meta_cognition"]),
  // The owner document names only an internal Registry lifecycle/GC
  // projection. It does not authorize a cross-service target, so the durable
  // route is intentionally fail-closed.
  "skill.package.retention.changed": Object.freeze([]),
  "skill.package.retention_hold.changed": Object.freeze([]),
} as const);

const actorReason = {
  actor_principal_id: SkillRegistryIdentifierV1Schema,
  reason_code: SkillRegistryIdentifierV1Schema,
} as const;
const globalPayload = {
  scope_kind: Type.Literal("global"),
  ...actorReason,
} as const;
const scopedPayload = {
  scope_kind: Type.Literal("scoped"),
  ...SkillCatalogScopeV1Properties,
  ...actorReason,
} as const;
const provenancePayload = {
  scope_kind: Type.Literal("provenance"),
  ...SkillRuntimeScopeV1Properties,
  ...actorReason,
} as const;
const skillVersionIdentity = {
  skill_id: SkillRegistryIdentifierV1Schema,
  skill_key: SkillRegistryIdentifierV1Schema,
  version_id: SkillRegistryIdentifierV1Schema,
  version: SkillRegistrySemverV1Schema,
} as const;

const payload = <const T extends Record<string, TSchema>>(
  common: Record<string, TSchema>,
  properties: T,
) =>
  Type.Object(
    {
      ...common,
      ...properties,
    },
    { additionalProperties: false },
  );

export const SKILL_REGISTRY_DOMAIN_EVENT_PAYLOAD_SCHEMAS_V1 = Object.freeze({
  "skill.version.published": payload(globalPayload, {
    ...skillVersionIdentity,
    lifecycle_version: SkillRegistryPositiveIntegerV1Schema,
    package_digest: SkillRegistrySha256V1Schema,
    manifest_digest: SkillRegistrySha256V1Schema,
    published_at: SkillRegistryTimestampV1Schema,
  }),
  "skill.catalog.changed": payload(scopedPayload, {
    catalog_revision_id: SkillRegistryIdentifierV1Schema,
    previous_catalog_version: Type.Optional(SkillRegistryIdentifierV1Schema),
    catalog_version: SkillRegistryIdentifierV1Schema,
    catalog_as_of: SkillRegistryTimestampV1Schema,
    changed_skill_keys: Type.Array(SkillRegistryIdentifierV1Schema, {
      maxItems: 100_000,
    }),
    security_revocation_epoch: SkillRegistrySecurityEpochV1Schema,
  }),
  "skill.version.activated": payload(scopedPayload, {
    ...skillVersionIdentity,
    activation_revision_id: SkillRegistryIdentifierV1Schema,
    previous_activation_revision_id: Type.Optional(
      SkillRegistryIdentifierV1Schema,
    ),
    catalog_version: SkillRegistryIdentifierV1Schema,
  }),
  "skill.activation.disabled": payload(scopedPayload, {
    ...skillVersionIdentity,
    activation_revision_id: SkillRegistryIdentifierV1Schema,
    previous_activation_revision_id: SkillRegistryIdentifierV1Schema,
    catalog_version: SkillRegistryIdentifierV1Schema,
    disabled_at: SkillRegistryTimestampV1Schema,
  }),
  "skill.activation.rolled_back": payload(scopedPayload, {
    skill_id: SkillRegistryIdentifierV1Schema,
    skill_key: SkillRegistryIdentifierV1Schema,
    activation_revision_id: SkillRegistryIdentifierV1Schema,
    rolled_back_from_version_id: SkillRegistryIdentifierV1Schema,
    rolled_back_to_version_id: SkillRegistryIdentifierV1Schema,
    catalog_version: SkillRegistryIdentifierV1Schema,
  }),
  "skill.version.deprecated": payload(globalPayload, {
    ...skillVersionIdentity,
    previous_lifecycle_version: SkillRegistryPositiveIntegerV1Schema,
    lifecycle_version: SkillRegistryPositiveIntegerV1Schema,
    deprecated_at: SkillRegistryTimestampV1Schema,
  }),
  "skill.version.revoked": payload(globalPayload, {
    ...skillVersionIdentity,
    previous_lifecycle_version: SkillRegistryPositiveIntegerV1Schema,
    lifecycle_version: SkillRegistryPositiveIntegerV1Schema,
    revoked_at: SkillRegistryTimestampV1Schema,
    security_revocation_epoch: SkillRegistrySecurityEpochV1Schema,
    emergency: Type.Boolean(),
  }),
  "skill.permission.granted": payload(scopedPayload, {
    skill_id: SkillRegistryIdentifierV1Schema,
    skill_key: SkillRegistryIdentifierV1Schema,
    permission_revision_id: SkillRegistryIdentifierV1Schema,
    scope_hash: SkillRegistrySha256V1Schema,
    owner_agent_id: Type.Optional(SkillRegistryIdentifierV1Schema),
    capability_refs: Type.Array(SkillRegistryCapabilityRefV1Schema, {
      minItems: 1,
      maxItems: 1_024,
    }),
    catalog_version: SkillRegistryIdentifierV1Schema,
  }),
  "skill.permission.revoked": payload(scopedPayload, {
    skill_id: SkillRegistryIdentifierV1Schema,
    skill_key: SkillRegistryIdentifierV1Schema,
    permission_revision_id: SkillRegistryIdentifierV1Schema,
    scope_hash: SkillRegistrySha256V1Schema,
    owner_agent_id: Type.Optional(SkillRegistryIdentifierV1Schema),
    revoked_capability_refs: Type.Array(
      SkillRegistryCapabilityRefV1Schema,
      { minItems: 1, maxItems: 1_024 },
    ),
    catalog_version: SkillRegistryIdentifierV1Schema,
    security_revocation_epoch: SkillRegistrySecurityEpochV1Schema,
  }),
  "skill.security_revocation_epoch.changed": payload(globalPayload, {
    previous_security_revocation_epoch:
      SkillRegistrySecurityEpochV1Schema,
    security_revocation_epoch: SkillRegistrySecurityEpochV1Schema,
    affected_skill_ids: Type.Array(SkillRegistryIdentifierV1Schema, {
      maxItems: 100_000,
    }),
    affected_version_ids: Type.Array(SkillRegistryIdentifierV1Schema, {
      maxItems: 100_000,
    }),
    emergency: Type.Boolean(),
  }),
  "skill.candidate.application.updated": payload(provenancePayload, {
    application_id: SkillRegistryIdentifierV1Schema,
    candidate_id: SkillRegistryIdentifierV1Schema,
    review_version: SkillRegistryPositiveIntegerV1Schema,
    candidate_type: SkillCandidateTypeV1Schema,
    skill_key: SkillRegistryIdentifierV1Schema,
    status: SkillCandidateApplicationStatusV1Schema,
    staging_version_id: Type.Optional(SkillRegistryIdentifierV1Schema),
    review_ref: Type.Optional(SkillRegistryIdentifierV1Schema),
    response_ref: SkillRegistryIdentifierV1Schema,
    response_hash: SkillRegistrySha256V1Schema,
  }),
  "skill.package.retention.changed": payload(globalPayload, {
    skill_id: SkillRegistryIdentifierV1Schema,
    version_id: SkillRegistryIdentifierV1Schema,
    package_id: SkillRegistryIdentifierV1Schema,
    previous_retention_state: Type.Union([
      Type.Literal("retained"),
      Type.Literal("deletion_pending"),
      Type.Literal("delete_failed"),
    ]),
    retention_state: Type.Union([
      Type.Literal("deletion_pending"),
      Type.Literal("deleted"),
      Type.Literal("delete_failed"),
    ]),
    previous_state_version: SkillRegistryNonNegativeIntegerV1Schema,
    state_version: SkillRegistryPositiveIntegerV1Schema,
    object_store_deletion_decision_version: Type.Optional(
      SkillRegistryPositiveIntegerV1Schema,
    ),
  }),
  "skill.package.retention_hold.changed": payload(globalPayload, {
    package_id: SkillRegistryIdentifierV1Schema,
    hold_id: SkillRegistryIdentifierV1Schema,
    hold_type: Type.Union([Type.Literal("audit"), Type.Literal("legal")]),
    active: Type.Boolean(),
    expires_at: Type.Optional(SkillRegistryTimestampV1Schema),
  }),
} as const);

function event<const TEvent extends string, const TPayload extends TSchema>(
  eventType: TLiteral<TEvent>,
  eventPayload: TPayload,
) {
  return Type.Object(
    {
      event_id: DurableEventEnvelopeV1Schema.properties.event_id,
      event_type: eventType,
      schema_version: Type.Literal("skill_registry_event.v1"),
      producer: Type.Literal("skill_registry"),
      occurred_at: DurableEventEnvelopeV1Schema.properties.occurred_at,
      idempotency_key:
        DurableEventEnvelopeV1Schema.properties.idempotency_key,
      trace_id: DurableEventEnvelopeV1Schema.properties.trace_id,
      payload: eventPayload,
    },
    { additionalProperties: false },
  );
}

export const SKILL_REGISTRY_DOMAIN_EVENT_BRANCH_SCHEMAS_V1 = Object.freeze(
  Object.fromEntries(
    SKILL_REGISTRY_DOMAIN_EVENT_TYPES_V1.map((eventType) => [
      eventType,
      event(
        Type.Literal(eventType),
        SKILL_REGISTRY_DOMAIN_EVENT_PAYLOAD_SCHEMAS_V1[eventType],
      ),
    ]),
  ) as Readonly<
    Record<
      (typeof SKILL_REGISTRY_DOMAIN_EVENT_TYPES_V1)[number],
      ReturnType<typeof event>
    >
  >,
);

export const SkillRegistryDomainEventV1Schema = Type.Union(
  SKILL_REGISTRY_DOMAIN_EVENT_TYPES_V1.map(
    (eventType) =>
      SKILL_REGISTRY_DOMAIN_EVENT_BRANCH_SCHEMAS_V1[eventType],
  ),
  { $id: "urn:pai:skill-registry:domain-event:v1" },
);

export const SKILL_REGISTRY_DOMAIN_EVENT_V1_DATABASE_CHECK =
  `CHECK (event_type IN (${SKILL_REGISTRY_DOMAIN_EVENT_TYPES_V1.map((eventType) => `'${eventType}'`).join(", ")}))`;

export type SkillRegistryDomainEventV1 = Static<
  typeof SkillRegistryDomainEventV1Schema
>;

export function assertSkillRegistryDomainEventSemanticBindingsV1(
  eventValue: SkillRegistryDomainEventV1,
): void {
  const payloadValue = eventValue.payload;
  if (
    ("previous_lifecycle_version" in payloadValue &&
      "lifecycle_version" in payloadValue &&
      payloadValue.lifecycle_version <= payloadValue.previous_lifecycle_version) ||
    ("previous_security_revocation_epoch" in payloadValue &&
      payloadValue.security_revocation_epoch <=
        payloadValue.previous_security_revocation_epoch) ||
    ("previous_state_version" in payloadValue &&
      payloadValue.state_version <= payloadValue.previous_state_version)
  ) {
    throw new Error("SkillRegistryDomainEventV1 version is not monotonic");
  }
  for (const field of [
    "changed_skill_keys",
    "capability_refs",
    "revoked_capability_refs",
    "affected_skill_ids",
    "affected_version_ids",
  ] as const) {
    if (field in payloadValue) {
      assertStrictlySortedUniqueStringsV1(
        payloadValue[field],
        field,
      );
    }
  }
}
