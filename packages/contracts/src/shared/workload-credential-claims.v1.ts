import { Type, type Static } from "@sinclair/typebox";
import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";

import { DelegatedPrincipalContextV1Schema } from "./delegated-principal-context.v1.js";
import { DeploymentEnvironmentV1Schema } from "./deployment-environment.v1.js";
import { ReleaseChannelV1Schema } from "./release-channel.v1.js";
import { ServiceIdV1Schema } from "./service-id.v1.js";

const claimsProperties = {
  iss: Type.Literal("pai-workload"),
  sub: Type.Ref(ServiceIdV1Schema),
  aud: Type.Ref(ServiceIdV1Schema),
  jti: Type.String({ minLength: 1 }),
  iat: Type.Integer({ minimum: 0 }),
  nbf: Type.Integer({ minimum: 0 }),
  exp: Type.Integer({ minimum: 0 }),
  capability: Type.Array(Type.String({ minLength: 1 }), {
    minItems: 1,
    uniqueItems: true,
  }),
  delegated_principal: Type.Optional(Type.Ref(DelegatedPrincipalContextV1Schema)),
};

const botScopeProperties = {
  workspace_id: Type.String({ minLength: 1 }),
  bot_id: Type.String({ minLength: 1 }),
  owner_agent_id: Type.String({ minLength: 1 }),
  deployment_environment: Type.Ref(DeploymentEnvironmentV1Schema),
  release_channel: Type.Ref(ReleaseChannelV1Schema),
};

export const WorkloadCredentialClaimsV1Schema = Type.Union(
  [
    Type.Object(
      {
        ...claimsProperties,
        scope_kind: Type.Literal("bot"),
        ...botScopeProperties,
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        ...claimsProperties,
        scope_kind: Type.Literal("global"),
      },
      { additionalProperties: false },
    ),
  ],
  { $id: "urn:pai:shared:workload-credential-claims:v1" },
);

export type WorkloadCredentialClaimsV1 = Static<
  typeof WorkloadCredentialClaimsV1Schema
>;

export interface ContractValidationIssue {
  readonly code:
    | "schema_validation_failed"
    | "credential_ttl_exceeded"
    | "invalid_time_window"
    | "capability_not_sorted"
    | "roles_not_sorted"
    | "authorization_scope_mismatch";
  readonly fieldPath: string;
  readonly message: string;
}

export type ContractValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly ContractValidationIssue[] };

const ajv = new Ajv2020({ allErrors: true, strict: true });
ajv.addSchema(DeploymentEnvironmentV1Schema);
ajv.addSchema(ReleaseChannelV1Schema);
ajv.addSchema(ServiceIdV1Schema);
ajv.addSchema(DelegatedPrincipalContextV1Schema);
const validateShape = ajv.compile(WorkloadCredentialClaimsV1Schema);

function unicodeCodePointCompare(left: string, right: string): number {
  const leftCodePoints = Array.from(left, (value) => value.codePointAt(0) ?? 0);
  const rightCodePoints = Array.from(right, (value) => value.codePointAt(0) ?? 0);
  const length = Math.min(leftCodePoints.length, rightCodePoints.length);
  for (let index = 0; index < length; index += 1) {
    const difference = leftCodePoints[index]! - rightCodePoints[index]!;
    if (difference !== 0) return difference;
  }
  return leftCodePoints.length - rightCodePoints.length;
}

function isSortedUnique(values: readonly string[]): boolean {
  for (let index = 1; index < values.length; index += 1) {
    if (unicodeCodePointCompare(values[index - 1]!, values[index]!) >= 0) {
      return false;
    }
  }
  return true;
}

function shapeIssues(errors: readonly ErrorObject[]): ContractValidationIssue[] {
  return errors.map((error) => ({
    code: "schema_validation_failed",
    fieldPath: error.instancePath || "/",
    message: error.message ?? "schema validation failed",
  }));
}

const scopeFields = [
  "workspace_id",
  "bot_id",
  "owner_agent_id",
  "deployment_environment",
  "release_channel",
] as const;

export function validateWorkloadCredentialClaimsV1(
  value: unknown,
): ContractValidationResult<WorkloadCredentialClaimsV1> {
  if (!validateShape(value)) {
    return { ok: false, issues: shapeIssues(validateShape.errors ?? []) };
  }

  const claims = value as WorkloadCredentialClaimsV1;
  const issues: ContractValidationIssue[] = [];
  if (
    claims.iat > claims.nbf ||
    claims.exp <= claims.iat ||
    claims.nbf >= claims.exp
  ) {
    issues.push({
      code: "invalid_time_window",
      fieldPath: "/exp",
      message: "credential time must satisfy iat <= nbf < exp",
    });
  }
  if (claims.exp - claims.iat > 300) {
    issues.push({
      code: "credential_ttl_exceeded",
      fieldPath: "/exp",
      message: "workload credentials cannot live longer than 300 seconds",
    });
  }
  if (!isSortedUnique(claims.capability)) {
    issues.push({
      code: "capability_not_sorted",
      fieldPath: "/capability",
      message: "capability must be unique and sorted by Unicode code point",
    });
  }

  const principal = claims.delegated_principal;
  if (principal !== undefined) {
    if (!isSortedUnique(principal.roles)) {
      issues.push({
        code: "roles_not_sorted",
        fieldPath: "/delegated_principal/roles",
        message: "roles must be unique and sorted by Unicode code point",
      });
    }
    if (principal.scope_kind !== claims.scope_kind) {
      issues.push({
        code: "authorization_scope_mismatch",
        fieldPath: "/delegated_principal/scope_kind",
        message: "delegated principal and workload scope kinds must match",
      });
    } else if (claims.scope_kind === "bot" && principal.scope_kind === "bot") {
      for (const field of scopeFields) {
        if (claims[field] !== principal[field]) {
          issues.push({
            code: "authorization_scope_mismatch",
            fieldPath: `/delegated_principal/${field}`,
            message: `${field} must match the signed workload scope`,
          });
        }
      }
    }
  }

  return issues.length === 0
    ? { ok: true, value: claims }
    : { ok: false, issues };
}
