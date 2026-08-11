import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import type {
  ObjectAccessPolicyVerifierV1,
  VerifyObjectAccessDecisionInputV1,
} from "@pai/object-store/composition";
import type { ObjectScopeV1 } from "@pai/object-store";
import type { PostgresQueryPortV1 } from "@pai/persistence";

const RETENTION_POLICY_VERSION_V1 = "ar-final-result-retention-v1";
const REDACTION_POLICY_VERSION_V1 = "ar-final-result-redaction-v1";
const DECISION_TTL_SECONDS_V1 = 60;

interface DecisionBindingV1 {
  readonly operation: "get";
  readonly object_ref: string;
  readonly owner_object_id: string;
  readonly owner_state_version: number;
  readonly scope: ObjectScopeV1;
  readonly capability: "runtime.artifact.read";
  readonly retention_policy_version: typeof RETENTION_POLICY_VERSION_V1;
  readonly redaction_policy_version: typeof REDACTION_POLICY_VERSION_V1;
}

type FinalResultResolveRequestV1 = Readonly<{
  artifact_ref: string;
  artifact_id: string;
  start_fence_generation: number;
  scope: Extract<ObjectScopeV1, { readonly scope_kind: "bot" }>;
}>;

export interface ActionRuntimeFinalResultObjectAccessPolicyV1 {
  readonly verifier: ObjectAccessPolicyVerifierV1;
  readonly final_results: Readonly<{
    resolve(request: FinalResultResolveRequestV1): Promise<Readonly<{
      access_decision_ref: string;
      retention_policy_version: string;
      redaction_policy_version: string;
    }>>;
  }>;
}

function assertSecretV1(secret: string): void {
  if (
    Buffer.byteLength(secret, "utf8") < 32 ||
    Buffer.byteLength(secret, "utf8") > 16_384 ||
    /[\r\n\u0000]/u.test(secret)
  ) {
    throw new Error("PAI_ACTION_RUNTIME_OBJECT_ACCESS_HMAC_SECRET is invalid");
  }
}

function canonicalScopeV1(scope: ObjectScopeV1): string {
  return scope.scope_kind === "global"
    ? JSON.stringify(["global"])
    : JSON.stringify([
        "bot",
        scope.workspace_id,
        scope.bot_id,
        scope.owner_agent_id,
        scope.deployment_environment,
        scope.release_channel,
      ]);
}

function sameScopeV1(left: ObjectScopeV1, right: ObjectScopeV1): boolean {
  return canonicalScopeV1(left) === canonicalScopeV1(right);
}

function stableBindingHashV1(binding: DecisionBindingV1): string {
  return createHash("sha256")
    .update(JSON.stringify([
      binding.operation,
      binding.object_ref,
      binding.owner_object_id,
      binding.owner_state_version,
      canonicalScopeV1(binding.scope),
      binding.capability,
      binding.retention_policy_version,
      binding.redaction_policy_version,
    ]), "utf8")
    .digest("base64url");
}

function tokenMacV1(secret: string, expirationSeconds: number, hash: string): string {
  return createHmac("sha256", secret)
    .update(`arfr1:${expirationSeconds}:${hash}`, "utf8")
    .digest("base64url");
}

function issueV1(secret: string, binding: DecisionBindingV1, now: Date): string {
  const expirationSeconds = Math.floor(now.getTime() / 1_000) + DECISION_TTL_SECONDS_V1;
  const hash = stableBindingHashV1(binding);
  return `arfr1.${expirationSeconds}.${hash}.${tokenMacV1(secret, expirationSeconds, hash)}`;
}

function verifyTokenV1(
  secret: string,
  token: string,
  binding: DecisionBindingV1,
  now: Date,
): void {
  const match = /^arfr1\.([1-9][0-9]{0,11})\.([A-Za-z0-9_-]{43})\.([A-Za-z0-9_-]{43})$/u.exec(token);
  if (match === null || Number(match[1]) < Math.floor(now.getTime() / 1_000)) {
    throw new Error("Action Runtime final-result decision is expired or malformed");
  }
  const expectedHash = stableBindingHashV1(binding);
  const expectedMac = Buffer.from(tokenMacV1(secret, Number(match[1]), expectedHash), "base64url");
  const actualMac = Buffer.from(match[3]!, "base64url");
  if (
    match[2] !== expectedHash ||
    actualMac.byteLength !== expectedMac.byteLength ||
    !timingSafeEqual(actualMac, expectedMac)
  ) {
    throw new Error("Action Runtime final-result decision binding mismatch");
  }
}

function timestampV1(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("Action Runtime artifact retention is invalid");
  return date.toISOString();
}

export function createActionRuntimeFinalResultObjectAccessPolicyV1(options: Readonly<{
  postgres: PostgresQueryPortV1;
  hmac_secret: string;
  now?: () => Date;
}>): ActionRuntimeFinalResultObjectAccessPolicyV1 {
  assertSecretV1(options.hmac_secret);
  const now = options.now ?? (() => new Date());

  const readRetention = async (binding: DecisionBindingV1): Promise<string> => {
    if (binding.scope.scope_kind !== "bot") throw new Error("Action Runtime object scope is invalid");
    const scope = binding.scope;
    const result = await options.postgres.query<Readonly<{ retention_until: Date | string }>>(
      `SELECT artifact.retention_until
         FROM action_runtime.runtime_artifacts AS artifact
         JOIN action_runtime.runtime_runs AS run ON run.id = artifact.runtime_run_id
        WHERE artifact.id = $1::text
          AND artifact.artifact_ref = $2::text
          AND artifact.artifact_type = 'runtime-final-result'
          AND artifact.status = 'available'
          AND artifact.media_type = 'text/plain'
          AND (artifact.metadata ->> 'start_fence_generation')::bigint = $3::bigint
          AND run.status = 'completed'
          AND run.workspace_id = $4::text
          AND run.bot_id = $5::text
          AND run.owner_agent_id = $6::text
          AND run.deployment_environment = $7::text
          AND run.release_channel = $8::text
          AND artifact.retention_until > pg_catalog.clock_timestamp()
        LIMIT 2`,
      [
        binding.owner_object_id,
        binding.object_ref,
        binding.owner_state_version,
        scope.workspace_id,
        scope.bot_id,
        scope.owner_agent_id,
        scope.deployment_environment,
        scope.release_channel,
      ],
    );
    if (result.rows.length !== 1) {
      throw new Error("Action Runtime final result is not a current owner object");
    }
    return timestampV1(result.rows[0]!.retention_until);
  };

  const bindingFor = (input: FinalResultResolveRequestV1): DecisionBindingV1 => Object.freeze({
    operation: "get",
    object_ref: input.artifact_ref,
    owner_object_id: input.artifact_id,
    owner_state_version: input.start_fence_generation,
    scope: input.scope,
    capability: "runtime.artifact.read",
    retention_policy_version: RETENTION_POLICY_VERSION_V1,
    redaction_policy_version: REDACTION_POLICY_VERSION_V1,
  });

  return Object.freeze({
    final_results: Object.freeze({
      async resolve(request: FinalResultResolveRequestV1) {
        const binding = bindingFor(request);
        await readRetention(binding);
        return Object.freeze({
          access_decision_ref: issueV1(options.hmac_secret, binding, now()),
          retention_policy_version: RETENTION_POLICY_VERSION_V1,
          redaction_policy_version: REDACTION_POLICY_VERSION_V1,
        });
      },
    }),
    verifier: Object.freeze({
      async verify(input: VerifyObjectAccessDecisionInputV1) {
        if (
          input.operation !== "get" ||
          input.owner_service !== "action_runtime" ||
          input.capability !== "runtime.artifact.read" ||
          input.retention_policy_version !== RETENTION_POLICY_VERSION_V1 ||
          input.redaction_policy_version !== REDACTION_POLICY_VERSION_V1 ||
          input.scope.scope_kind !== "bot"
        ) {
          throw new Error("Action Runtime ObjectStore operation is denied");
        }
        const binding: DecisionBindingV1 = Object.freeze({
          operation: "get",
          object_ref: input.object_ref,
          owner_object_id: input.owner_object_id,
          owner_state_version: input.owner_state_version,
          scope: input.scope,
          capability: "runtime.artifact.read",
          retention_policy_version: RETENTION_POLICY_VERSION_V1,
          redaction_policy_version: REDACTION_POLICY_VERSION_V1,
        });
        verifyTokenV1(options.hmac_secret, input.access_decision_ref, binding, now());
        const retentionUntil = await readRetention(binding);
        if (Date.parse(retentionUntil) <= now().getTime() || !sameScopeV1(binding.scope, input.scope)) {
          throw new Error("Action Runtime final result retention is expired");
        }
        return Object.freeze({ ...input, authorized: true as const, retention_until: retentionUntil });
      },
    }),
  });
}
