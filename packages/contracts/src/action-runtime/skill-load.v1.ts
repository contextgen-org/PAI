import { Type, type Static } from "@sinclair/typebox";

import {
  SkillRegistryIdentifierV1Schema,
  SkillRegistrySha256V1Schema,
  SkillRegistrySkillNameV1Schema,
} from "../skill-registry/primitives.v1.js";

export const RuntimeSkillLoadRequestV1Schema = Type.Object(
  {
    skill_name: SkillRegistrySkillNameV1Schema,
    runtime_run_id: SkillRegistryIdentifierV1Schema,
    idempotency_key: SkillRegistryIdentifierV1Schema,
  },
  { additionalProperties: false },
);

export const RuntimeSkillLoadResponseV1Schema = Type.Object(
  {
    code: Type.Literal("skill_loaded"),
    message: Type.String({ minLength: 1, maxLength: 4_096 }),
    retryable: Type.Literal(false),
    trace_id: SkillRegistryIdentifierV1Schema,
    details: Type.Object(
      {
        skill_name: SkillRegistrySkillNameV1Schema,
        resolution_id: SkillRegistryIdentifierV1Schema,
        version_id: SkillRegistryIdentifierV1Schema,
        package_digest: SkillRegistrySha256V1Schema,
        manifest_digest: SkillRegistrySha256V1Schema,
        digest_verified: Type.Literal(true),
        runtime_target: Type.Literal("filesystem_bundle.v1"),
        entrypoint: Type.String({
          pattern: "^\\.claude/skills/[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?/SKILL\\.md$",
          maxLength: 96,
        }),
        source: Type.Union([
          Type.Literal("skill_registry"),
          Type.Literal("registry_cache"),
        ]),
        materialization_status: Type.Literal("loaded"),
        audit_event_id: SkillRegistryIdentifierV1Schema,
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

export const RuntimeSkillLoadContractV1Schema = Type.Union(
  [RuntimeSkillLoadRequestV1Schema, RuntimeSkillLoadResponseV1Schema],
  { $id: "urn:pai:action-runtime:skill-load:v1" },
);

export type RuntimeSkillLoadRequestV1 = Static<
  typeof RuntimeSkillLoadRequestV1Schema
>;
export type RuntimeSkillLoadResponseV1 = Static<
  typeof RuntimeSkillLoadResponseV1Schema
>;

export function assertRuntimeSkillLoadBindingsV1(
  request: RuntimeSkillLoadRequestV1,
  response: RuntimeSkillLoadResponseV1,
): void {
  if (
    request.idempotency_key !==
      `${request.runtime_run_id}:skill:${request.skill_name}` ||
    response.details.skill_name !== request.skill_name ||
    response.details.entrypoint !==
      `.claude/skills/${request.skill_name}/SKILL.md`
  ) {
    throw new Error("RuntimeSkillLoadContractV1 binding mismatch");
  }
}
