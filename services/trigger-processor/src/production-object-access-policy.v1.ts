import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { canonicalJsonV1 } from "@pai/eventing";
import type {
  ObjectAccessPolicyVerifierV1,
  VerifyObjectAccessDecisionInputV1,
} from "@pai/object-store/composition";
import type { ObjectScopeV1 } from "@pai/object-store";
import type { PostgresQueryPortV1 } from "@pai/persistence";

import type { ContextSnapshotResolveRequestV1 } from "./application/context-snapshot-resolver.v1.js";
import type {
  TriggerProcessSnapshotMetadataV1,
} from "./application/process-snapshot-read.v1.js";
import type {
  TriggerProcessSnapshotObjectReadDecisionResolverV1,
} from "./application/process-snapshot-object-store-materializer.v1.js";

const RETENTION_POLICY_VERSION_V1 = "tp-retention-v1";
const REDACTION_POLICY_VERSION_V1 = "tp-redaction-v1";
const DECISION_TTL_SECONDS_V1 = 90;

interface ContextSnapshotOwnerRowV1 extends Record<string, unknown> {
  readonly retention_until: Date | string;
}

interface SnapshotOwnerRowV1 extends Record<string, unknown> {
  readonly retention_until: Date | string;
}

interface DecisionBindingV1 {
  readonly operation: "get";
  readonly object_ref: string;
  readonly owner_object_id: string;
  readonly owner_state_version: number;
  readonly scope: ObjectScopeV1;
  readonly capability: string;
  readonly retention_policy_version: typeof RETENTION_POLICY_VERSION_V1;
  readonly redaction_policy_version: typeof REDACTION_POLICY_VERSION_V1;
}

export interface TriggerObjectAccessPolicyV1 {
  readonly verifier: ObjectAccessPolicyVerifierV1;
  readonly context_snapshots: Readonly<{
    resolve(
      request: ContextSnapshotResolveRequestV1,
    ): Promise<Readonly<{
      access_decision_ref: string;
      retention_policy_version: string;
      redaction_policy_version: string;
      redaction_state: "not_required" | "complete";
    }>>;
  }>;
  readonly snapshot_manifest: TriggerProcessSnapshotObjectReadDecisionResolverV1;
}

function timestampV1(value: Date | string, label: string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error(`${label} is invalid`);
  return date.toISOString();
}

function assertSecretV1(secret: string): void {
  if (
    Buffer.byteLength(secret, "utf8") < 32 ||
    Buffer.byteLength(secret, "utf8") > 16_384 ||
    /[\r\n\u0000]/u.test(secret)
  ) {
    throw new Error("PAI_TRIGGER_OBJECT_ACCESS_HMAC_SECRET is invalid");
  }
}

function sameScopeV1(left: ObjectScopeV1, right: ObjectScopeV1): boolean {
  if (left.scope_kind !== "bot" || right.scope_kind !== "bot") return false;
  return (
    left.workspace_id === right.workspace_id &&
    left.bot_id === right.bot_id &&
    left.owner_agent_id === right.owner_agent_id &&
    left.deployment_environment === right.deployment_environment &&
    left.release_channel === right.release_channel
  );
}

function stableBindingHashV1(binding: DecisionBindingV1): string {
  return createHash("sha256")
    .update(canonicalJsonV1(binding), "utf8")
    .digest("base64url");
}

function macV1(secret: string, expirationSeconds: number, hash: string): string {
  return createHmac("sha256", secret)
    .update(`tpod1:${expirationSeconds}:${hash}`, "utf8")
    .digest("base64url");
}

function issueV1(secret: string, binding: DecisionBindingV1, now: Date): string {
  const expirationSeconds = Math.floor(now.getTime() / 1_000) + DECISION_TTL_SECONDS_V1;
  const hash = stableBindingHashV1(binding);
  return `tpod1.${expirationSeconds}.${hash}.${macV1(secret, expirationSeconds, hash)}`;
}

function verifyTokenV1(
  secret: string,
  token: string,
  binding: DecisionBindingV1,
  now: Date,
): void {
  const match = /^tpod1\.([1-9][0-9]{0,11})\.([A-Za-z0-9_-]{43})\.([A-Za-z0-9_-]{43})$/u.exec(token);
  if (match === null) throw new Error("object decision token is malformed");
  const expirationSeconds = Number(match[1]);
  if (!Number.isSafeInteger(expirationSeconds) || expirationSeconds < Math.floor(now.getTime() / 1_000)) {
    throw new Error("object decision token is expired");
  }
  const hash = stableBindingHashV1(binding);
  const expected = macV1(secret, expirationSeconds, hash);
  const actualMac = Buffer.from(match[3]!, "base64url");
  const expectedMac = Buffer.from(expected, "base64url");
  if (
    match[2] !== hash ||
    actualMac.byteLength !== expectedMac.byteLength ||
    !timingSafeEqual(actualMac, expectedMac)
  ) {
    throw new Error("object decision token binding mismatch");
  }
}

function botScopeV1(request: Readonly<{
  workspace_id: string;
  bot_id: string;
  owner_agent_id: string;
  deployment_environment: "local" | "dev" | "staging" | "prod";
  release_channel: "stable" | "canary";
}>): ObjectScopeV1 {
  // Callers include transport and resource-binding fields such as
  // `purpose`, `trigger_process_id`, and `snapshot_ref`. They must be bound
  // by the decision itself, but are not ObjectScope fields. Spreading a
  // richer request here signs those extraneous fields into the decision while
  // ObjectStore later verifies against the canonical, six-field bot scope.
  // That makes a valid Context snapshot unreadable at the Intent stage.
  return Object.freeze({
    scope_kind: "bot" as const,
    workspace_id: request.workspace_id,
    bot_id: request.bot_id,
    owner_agent_id: request.owner_agent_id,
    deployment_environment: request.deployment_environment,
    release_channel: request.release_channel,
  });
}

/**
 * Issues compact HMAC-bound read decisions and rechecks the Trigger-owned
 * canonical row at verification time.  Decisions are therefore useless when
 * copied to another process, version, object, scope, capability, or after
 * retention changes; no generic ObjectStore read is exposed.
 */
export function createTriggerObjectAccessPolicyV1(options: Readonly<{
  postgres: PostgresQueryPortV1;
  hmac_secret: string;
  now?: () => Date;
}>): TriggerObjectAccessPolicyV1 {
  assertSecretV1(options.hmac_secret);
  const now = options.now ?? (() => new Date());

  const contextBinding = (request: ContextSnapshotResolveRequestV1): DecisionBindingV1 =>
    Object.freeze({
      operation: "get",
      object_ref: request.context_snapshot_ref,
      owner_object_id: request.trigger_process_id,
      owner_state_version: request.context_snapshot_version,
      scope: botScopeV1(request),
      capability: "trigger_process.snapshot.resolve",
      retention_policy_version: RETENTION_POLICY_VERSION_V1,
      redaction_policy_version: REDACTION_POLICY_VERSION_V1,
    });

  const snapshotBinding = (metadata: TriggerProcessSnapshotMetadataV1): DecisionBindingV1 =>
    Object.freeze({
      operation: "get",
      object_ref: metadata.snapshot_ref,
      owner_object_id: metadata.trigger_process_id,
      owner_state_version: metadata.snapshot_version,
      scope: botScopeV1(metadata),
      capability: "trigger.process.snapshot.resolve",
      retention_policy_version: RETENTION_POLICY_VERSION_V1,
      redaction_policy_version: REDACTION_POLICY_VERSION_V1,
    });

  const readContextRetention = async (binding: DecisionBindingV1): Promise<string> => {
    if (binding.scope.scope_kind !== "bot") throw new Error("Trigger object scope is invalid");
    const scope = binding.scope;
    const result = await options.postgres.query<ContextSnapshotOwnerRowV1>(
      `SELECT p.context_snapshot_retention_until AS retention_until
         FROM trigger_processor.trigger_processes AS p
        WHERE p.id = $1::text
          AND p.workspace_id = $2::text
          AND p.bot_id = $3::text
          AND p.owner_agent_id = $4::text
          AND p.deployment_environment = $5::text
          AND p.release_channel = $6::text
          AND p.context_snapshot_ref = $7::text
          AND p.context_snapshot_version = $8::bigint
          AND p.context_snapshot_retention_until > pg_catalog.clock_timestamp()
        LIMIT 2`,
      [
        binding.owner_object_id,
        scope.workspace_id,
        scope.bot_id,
        scope.owner_agent_id,
        scope.deployment_environment,
        scope.release_channel,
        binding.object_ref,
        binding.owner_state_version,
      ],
    );
    if (result.rows.length !== 1) throw new Error("Trigger context object is not canonical");
    return timestampV1(result.rows[0]!.retention_until, "Trigger context retention");
  };

  const readSnapshotRetention = async (binding: DecisionBindingV1): Promise<string> => {
    if (binding.scope.scope_kind !== "bot") throw new Error("Trigger object scope is invalid");
    const scope = binding.scope;
    const result = await options.postgres.query<SnapshotOwnerRowV1>(
      `SELECT s.retention_until
         FROM trigger_processor.trigger_process_snapshots AS s
        WHERE s.trigger_process_id = $1::text
          AND s.workspace_id = $2::text
          AND s.bot_id = $3::text
          AND s.owner_agent_id = $4::text
          AND s.deployment_environment = $5::text
          AND s.release_channel = $6::text
          AND s.snapshot_ref = $7::text
          AND s.snapshot_version = $8::bigint
          AND s.status IN ('current', 'superseded')
          AND s.retention_until > pg_catalog.clock_timestamp()
        LIMIT 2`,
      [
        binding.owner_object_id,
        scope.workspace_id,
        scope.bot_id,
        scope.owner_agent_id,
        scope.deployment_environment,
        scope.release_channel,
        binding.object_ref,
        binding.owner_state_version,
      ],
    );
    if (result.rows.length !== 1) throw new Error("Trigger snapshot object is not canonical");
    return timestampV1(result.rows[0]!.retention_until, "Trigger snapshot retention");
  };

  const issueDecision = (binding: DecisionBindingV1) => Object.freeze({
    access_decision_ref: issueV1(options.hmac_secret, binding, now()),
    retention_policy_version: RETENTION_POLICY_VERSION_V1,
    redaction_policy_version: REDACTION_POLICY_VERSION_V1,
  });

  return Object.freeze({
    context_snapshots: Object.freeze({
      async resolve(request: ContextSnapshotResolveRequestV1) {
        await readContextRetention(contextBinding(request));
        return Object.freeze({
          ...issueDecision(contextBinding(request)),
          redaction_state: "not_required" as const,
        });
      },
    }),
    snapshot_manifest: Object.freeze({
      async resolve(
        request: Parameters<TriggerProcessSnapshotObjectReadDecisionResolverV1["resolve"]>[0],
      ) {
        if (
          request.object_kind !== "manifest" ||
          request.source_service !== "trigger_processor" ||
          request.object_ref !== request.metadata.snapshot_ref
        ) {
          throw new Error("Trigger snapshot ObjectStore read decision is invalid");
        }
        await readSnapshotRetention(snapshotBinding(request.metadata));
        return issueDecision(snapshotBinding(request.metadata));
      },
    }),
    verifier: Object.freeze({
      async verify(input: VerifyObjectAccessDecisionInputV1) {
        if (
          input.operation !== "get" ||
          input.owner_service !== "trigger_processor" ||
          input.retention_policy_version !== RETENTION_POLICY_VERSION_V1 ||
          input.redaction_policy_version !== REDACTION_POLICY_VERSION_V1 ||
          input.scope.scope_kind !== "bot"
        ) {
          throw new Error("Trigger ObjectStore operation is denied");
        }
        const binding: DecisionBindingV1 = Object.freeze({
          operation: "get",
          object_ref: input.object_ref,
          owner_object_id: input.owner_object_id,
          owner_state_version: input.owner_state_version,
          scope: input.scope,
          capability: input.capability,
          retention_policy_version: RETENTION_POLICY_VERSION_V1,
          redaction_policy_version: REDACTION_POLICY_VERSION_V1,
        });
        verifyTokenV1(options.hmac_secret, input.access_decision_ref, binding, now());
        const retentionUntil =
          input.capability === "trigger_process.snapshot.resolve"
            ? await readContextRetention(binding)
            : input.capability === "trigger.process.snapshot.resolve"
              ? await readSnapshotRetention(binding)
              : (() => { throw new Error("Trigger ObjectStore capability is denied"); })();
        if (Date.parse(retentionUntil) <= now().getTime()) {
          throw new Error("Trigger ObjectStore retention is expired");
        }
        return Object.freeze({ ...input, authorized: true as const, retention_until: retentionUntil });
      },
    }),
  });
}
