import { createHash, randomUUID } from "node:crypto";

import {
  type VerifiedSupabaseIngress,
  matchesAuthorizationScope,
  type BotAuthorizationScopeV1,
  type VerifiedWorkloadCredential,
} from "@pai/auth";
import {
  AdmitTriggerCommandV1Schema,
  AdmitTriggerWriterResponseV1Schema,
  assertCanonicalTimerTriggerTimeV1,
  assertTimerTriggerBusinessPayloadV1,
  type AdmitTriggerCommandV1,
  type AdmitTriggerWriterResponseV1,
  type TriggerSubmitRequestV1,
} from "@pai/contracts";
import { canonicalJsonV1 } from "@pai/eventing";
import type { OwnerDatabaseApplicationDependenciesV1 } from "@pai/persistence";
import { Value } from "@sinclair/typebox/value";

import { TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1 } from "../db/permission-manifest.v1.js";

export type TriggerProcessorOwnerDatabaseV1 =
  OwnerDatabaseApplicationDependenciesV1<
    typeof TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1
  >;

export class InvalidAdmitTriggerCommandError extends Error {
  public constructor(
    message: string,
    public readonly kind:
      | "invalid_request"
      | "authorization_denied"
      | "authorization_scope_mismatch"
      | "capability_denied"
      | "server_invariant" = "invalid_request",
    options?: ErrorOptions,
    public readonly source?: TriggerSubmitRequestV1["source"],
  ) {
    super(message, options);
    this.name = "InvalidAdmitTriggerCommandError";
  }
}

const TIMER_SUBMIT_CAPABILITY = "trigger.submit.timer";
const MAX_TIMER_PAYLOAD_BYTES = 8 * 1_024;

function permissionScopeForSource(
  source: TriggerSubmitRequestV1["source"],
): `trigger.submit.${TriggerSubmitRequestV1["source"]}` {
  return `trigger.submit.${source}`;
}

function bindingPrincipalType(
  principalType: VerifiedSupabaseIngress["principal"]["principal_type"],
): "user" | "developer" | "agent" | "operator" {
  return principalType === "bot" ? "agent" : principalType;
}

export type VerifiedTriggerIngressV1 =
  | Readonly<{
      authentication_kind: "pai_workload_jwt";
      credential: VerifiedWorkloadCredential;
    }>
  | Readonly<{
      authentication_kind: "supabase_ingress";
      credential: VerifiedSupabaseIngress;
    }>;

interface AuthenticatedAdmissionIdentity {
  readonly actor: Readonly<{
    actor_type: "super_user" | "user" | "agent" | "developer" | "system";
    actor_id: string;
  }>;
  readonly authenticated_context: Readonly<Record<string, unknown>>;
}

function authenticatedIdentity(
  ingress: VerifiedTriggerIngressV1,
  command: AdmitTriggerCommandV1,
): AuthenticatedAdmissionIdentity {
  if (command.source === "timer") {
    if (ingress.authentication_kind !== "pai_workload_jwt") {
      throw new InvalidAdmitTriggerCommandError(
        "timer admission requires a PAI workload credential",
        "authorization_denied",
        undefined,
        command.source,
      );
    }
    const { claims } = ingress.credential;
    if (!claims.capability.includes(TIMER_SUBMIT_CAPABILITY)) {
      throw new InvalidAdmitTriggerCommandError(
        `verified workload credential lacks ${TIMER_SUBMIT_CAPABILITY}`,
        "capability_denied",
        undefined,
        command.source,
      );
    }
    if (claims.sub !== "timer_trigger_app") {
      throw new InvalidAdmitTriggerCommandError(
        "timer admission requires timer_trigger_app",
        "authorization_denied",
        undefined,
        command.source,
      );
    }
    if (claims.delegated_principal !== undefined) {
      throw new InvalidAdmitTriggerCommandError(
        "timer admission must not carry a delegated identity",
        "authorization_denied",
        undefined,
        command.source,
      );
    }
    return Object.freeze({
      actor: Object.freeze({ actor_type: "system", actor_id: "timer_app" }),
      authenticated_context: Object.freeze({
        authentication_kind: "pai_workload_jwt",
        principal_id: claims.sub,
        principal_type: "service",
        permission_scope: permissionScopeForSource(command.source),
        workload_subject: claims.sub,
        credential_jti: claims.jti,
        credential_kid: ingress.credential.protectedHeader.kid,
      }),
    });
  }

  if (ingress.authentication_kind !== "supabase_ingress") {
    throw new InvalidAdmitTriggerCommandError(
      "chat and notification admission require verified Supabase ingress",
      "authorization_denied",
      undefined,
      command.source,
    );
  }
  const principal = ingress.credential.principal;
  if (principal.principal_type === "operator") {
    throw new InvalidAdmitTriggerCommandError(
      "operator is a caller role and cannot become a Trigger actor",
      "authorization_denied",
      undefined,
      command.source,
    );
  }
  const actorType =
    principal.principal_type === "bot"
      ? ("agent" as const)
      : principal.principal_type === "developer"
        ? ("developer" as const)
        : principal.roles.includes("super_user")
          ? ("super_user" as const)
          : ("user" as const);
  const actor = Object.freeze({
    actor_type: actorType,
    actor_id: principal.principal_id,
  });
  if (
    command.actor_type !== actor.actor_type ||
    command.actor_id !== actor.actor_id
  ) {
    throw new InvalidAdmitTriggerCommandError(
      "Trigger actor must match the verified Supabase principal",
      "authorization_denied",
      undefined,
      command.source,
    );
  }
  if (
    command.priority_hint !== undefined &&
    actor.actor_type !== "developer" &&
    actor.actor_type !== "super_user"
  ) {
    throw new InvalidAdmitTriggerCommandError(
      "priority_hint requires an authenticated developer or super_user",
      "authorization_denied",
      undefined,
      command.source,
    );
  }
  return Object.freeze({
    actor,
    authenticated_context: Object.freeze({
      authentication_kind: "supabase_ingress",
      principal_id: principal.principal_id,
      principal_type: bindingPrincipalType(principal.principal_type),
      permission_scope: permissionScopeForSource(command.source),
      verified_principal: Object.freeze({
        ...principal,
        roles: [...principal.roles],
      }),
    }),
  });
}

export interface TriggerAdmissionApplicationV1 {
  admit(
    ingress: VerifiedTriggerIngressV1,
    command: unknown,
  ): Promise<AdmitTriggerWriterResponseV1>;
  recordPreAdmissionFailure(
    failure: TriggerPreAdmissionFailureV1,
  ): Promise<string>;
}

export interface TriggerPreAdmissionFailureV1 {
  readonly trace_id: string;
  readonly result_code:
    | "invalid_request"
    | "unauthenticated"
    | "bot_permission_denied"
    | "timer_source_caller_denied"
    | "timer_owner_binding_mismatch";
  readonly outcome: "schema_invalid" | "identity_invalid";
  readonly request_body: unknown;
  readonly credential?: VerifiedTriggerIngressV1;
}

function canonicalAdmissionSnapshotV1<T>(
  value: unknown,
  message: string,
  kind: InvalidAdmitTriggerCommandError["kind"],
): T {
  let snapshot: T;
  try {
    snapshot = JSON.parse(canonicalJsonV1(value)) as T;
  } catch (error) {
    throw new InvalidAdmitTriggerCommandError(message, kind, {
      cause: error,
    });
  }
  const pending: object[] = [];
  if (typeof snapshot === "object" && snapshot !== null) {
    pending.push(snapshot);
  }
  while (pending.length > 0) {
    const current = pending.pop()!;
    for (const entry of Object.values(current)) {
      if (
        typeof entry === "object" &&
        entry !== null &&
        !Object.isFrozen(entry)
      ) {
        pending.push(entry);
      }
    }
    Object.freeze(current);
  }
  return snapshot;
}

function boundedClaim(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= 256
    ? value
    : null;
}

function validServerIdentity(value: string): boolean {
  return (
    value.trim().length > 0 &&
    value.length <= 512 &&
    !/[\r\n]/u.test(value)
  );
}

function claimedRecord(value: unknown): Readonly<Record<string, unknown>> {
  try {
    const snapshot = JSON.parse(canonicalJsonV1(value)) as unknown;
    return typeof snapshot === "object" &&
      snapshot !== null &&
      !Array.isArray(snapshot)
      ? Object.freeze(snapshot as Readonly<Record<string, unknown>>)
      : {};
  } catch {
    return {};
  }
}

function preAdmissionRequestHash(
  requestBody: unknown,
): string | null {
  try {
    const snapshot = JSON.parse(canonicalJsonV1(requestBody)) as unknown;
    const canonicalValue =
      typeof snapshot === "object" &&
      snapshot !== null &&
      !Array.isArray(snapshot)
        ? (() => {
            const { trace_id: _serverTraceId, ...request } = snapshot as
              Readonly<Record<string, unknown>>;
            return request;
          })()
        : snapshot;
    const canonical = canonicalJsonV1(canonicalValue);
    return `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
  } catch {
    return null;
  }
}

function exactAttemptAck(
  value: unknown,
  expectedAttemptId: string,
): value is Readonly<{ acknowledged: true; submit_attempt_id: string }> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 2 &&
    (value as Readonly<{ acknowledged?: unknown }>).acknowledged === true &&
    (value as Readonly<{ submit_attempt_id?: unknown }>).submit_attempt_id ===
      expectedAttemptId
  );
}

function preAdmissionAuthenticatedContext(
  ingress: VerifiedTriggerIngressV1 | undefined,
  source: TriggerSubmitRequestV1["source"] | undefined,
): Readonly<Record<string, unknown>> | null {
  if (ingress === undefined) return null;
  if (ingress.authentication_kind === "pai_workload_jwt") {
    return {
      authentication_kind: ingress.authentication_kind,
      principal_id: ingress.credential.claims.sub,
      principal_type: "service",
      permission_scope:
        source === undefined ? null : permissionScopeForSource(source),
      workload_subject: ingress.credential.claims.sub,
      credential_jti: ingress.credential.claims.jti,
      credential_kid: ingress.credential.protectedHeader.kid,
      scope_kind: ingress.credential.claims.scope_kind,
    };
  }
  return {
    authentication_kind: ingress.authentication_kind,
    principal_id: ingress.credential.principal.principal_id,
    principal_type: bindingPrincipalType(
      ingress.credential.principal.principal_type,
    ),
    permission_scope:
      source === undefined ? null : permissionScopeForSource(source),
    verified_principal: {
      ...ingress.credential.principal,
      roles: [...ingress.credential.principal.roles],
    },
  };
}

function triggerSubmitRequestBody(
  command: AdmitTriggerCommandV1,
): TriggerSubmitRequestV1 {
  const { trace_id: _serverTraceId, ...request } = command;
  return request;
}

function canonicalAdmissionRequestHash(command: AdmitTriggerCommandV1): string {
  try {
    return `sha256:${createHash("sha256")
      .update(canonicalJsonV1(triggerSubmitRequestBody(command)))
      .digest("hex")}`;
  } catch (error) {
    throw new InvalidAdmitTriggerCommandError(
      "Trigger submit request is not canonical JSON",
      "invalid_request",
      { cause: error },
    );
  }
}

function botScope(command: AdmitTriggerCommandV1): BotAuthorizationScopeV1 {
  return {
    scope_kind: "bot",
    workspace_id: command.workspace_id,
    bot_id: command.bot_id,
    owner_agent_id: command.owner_agent_id,
    deployment_environment: command.deployment_environment,
    release_channel: command.release_channel,
  };
}

function assertCanonicalCommand(command: AdmitTriggerCommandV1): void {
  if (command.source !== "timer") return;
  const payload = command.payload;
  try {
    assertCanonicalTimerTriggerTimeV1(payload);
    if (payload.trigger_payload !== undefined) {
      assertTimerTriggerBusinessPayloadV1(payload.trigger_payload);
    }
  } catch (error) {
    throw new InvalidAdmitTriggerCommandError(
      "timer date/time, IANA timezone, and scheduled instant are inconsistent",
      "invalid_request",
      { cause: error },
      command.source,
    );
  }
  const scopeMatches =
    payload.workspace_id === command.workspace_id &&
    payload.bot_id === command.bot_id &&
    payload.owner_agent_id === command.owner_agent_id &&
    payload.deployment_environment === command.deployment_environment &&
    payload.release_channel === command.release_channel;
  if (!scopeMatches) {
    throw new InvalidAdmitTriggerCommandError(
      "timer top-level and payload owner scope must match exactly",
      "authorization_scope_mismatch",
      undefined,
      command.source,
    );
  }
  if (command.dedupe_key !== `timer:${payload.occurrence_key}`) {
    throw new InvalidAdmitTriggerCommandError(
      "timer dedupe_key must equal timer:{occurrence_key}",
    );
  }
  let canonicalPayload: string;
  try {
    canonicalPayload = canonicalJsonV1(payload);
  } catch (error) {
    throw new InvalidAdmitTriggerCommandError(
      "timer payload is not canonical JSON",
      "invalid_request",
      { cause: error },
    );
  }
  if (Buffer.byteLength(canonicalPayload, "utf8") > MAX_TIMER_PAYLOAD_BYTES) {
    throw new InvalidAdmitTriggerCommandError(
      "timer payload exceeds the 8KB UTF-8 canonical JSON limit",
    );
  }
}

function admissionRequest(command: AdmitTriggerCommandV1) {
  if (command.source === "timer") {
    return {
      is_catch_up: command.payload.is_catch_up,
      catch_up_batch_id: command.payload.catch_up_batch_id,
      trusted_strong_hint: false,
      priority_hint: null,
      explicit_interrupt: false,
      requested_explicit_interrupt: false,
    } as const;
  }
  return {
    is_catch_up: false,
    catch_up_batch_id: null,
    trusted_strong_hint: command.priority_hint === "strong",
    priority_hint: command.priority_hint ?? null,
    explicit_interrupt: false,
    requested_explicit_interrupt: false,
  } as const;
}

/**
 * The production admission mutation boundary. The generated owner writer must
 * derive bot authority, safety, priority and admission state while locking the
 * canonical bot slot and process rows before it writes Trigger, Process, audit,
 * and outbox. Application callers cannot submit those trusted facts.
 */
export function createTriggerAdmissionApplicationV1(
  database: TriggerProcessorOwnerDatabaseV1,
  dependencies: Readonly<{ generateId?: () => string }> = {},
): TriggerAdmissionApplicationV1 {
  const generateId = dependencies.generateId ?? randomUUID;
  return Object.freeze({
    async recordPreAdmissionFailure(
      failure: TriggerPreAdmissionFailureV1,
    ): Promise<string> {
      const attemptId = generateId();
      const traceId = failure.trace_id;
      const outcome = failure.outcome;
      const resultCode = failure.result_code;
      if (
        !validServerIdentity(attemptId) ||
        !validServerIdentity(traceId)
      ) {
        throw new InvalidAdmitTriggerCommandError(
          "server-generated submit attempt identity is invalid",
          "server_invariant",
        );
      }
      const body = claimedRecord(failure.request_body);
      const payload = claimedRecord(body.payload);
      const credential =
        failure.credential === undefined
          ? undefined
          : canonicalAdmissionSnapshotV1<VerifiedTriggerIngressV1>(
              failure.credential,
              "verified pre-admission ingress is outside the bounded canonical JSON contract",
              "authorization_denied",
            );
      const source =
        body.source === "chat" ||
        body.source === "notification" ||
        body.source === "timer"
          ? body.source
          : undefined;
      const requestHash = preAdmissionRequestHash(failure.request_body);
      const authenticatedContext =
        preAdmissionAuthenticatedContext(credential, source);
      const writerArguments = Object.freeze({
        p_attempt_id: attemptId,
        p_claimed_scope: Object.freeze({
          workspace_id: boundedClaim(body.workspace_id),
          bot_id: boundedClaim(body.bot_id),
          owner_agent_id: boundedClaim(body.owner_agent_id),
          deployment_environment: boundedClaim(
            body.deployment_environment,
          ),
          release_channel: boundedClaim(body.release_channel),
        }),
        p_claimed_source: boundedClaim(body.source),
        p_claimed_actor: Object.freeze({
          actor_type: boundedClaim(body.actor_type),
          actor_id: boundedClaim(body.actor_id),
        }),
        p_claimed_dedupe_key: boundedClaim(body.dedupe_key),
        p_audit_request_hash: requestHash,
        p_outcome: outcome,
        p_result_code: resultCode,
        p_retryable: false,
        p_authenticated_context: authenticatedContext,
        p_audit_payload: Object.freeze({
          request_body_present:
            typeof failure.request_body === "object" &&
            failure.request_body !== null,
          timer_payload_present:
            body.source === "timer" && Object.keys(payload).length > 0,
          request_hash_present: requestHash !== null,
          authenticated: credential !== undefined,
        }),
        p_trace_id: traceId,
      });
      return database.unit_of_work.withTransaction(
        {
          operation: "record_trigger_submit_attempt",
          idempotency_key: attemptId,
          trace_id: traceId,
          isolation: "read_committed",
          retry: "none",
        },
        async (transaction, { owner }) => {
          const resultValue = await owner.executeWriter<
            Readonly<{ acknowledged: true; submit_attempt_id: string }>,
            "record_trigger_submit_attempt_v1"
          >(transaction, {
            writer: "record_trigger_submit_attempt_v1",
            arguments: writerArguments,
            expected_rows: 1,
          });
          const result = canonicalAdmissionSnapshotV1<
            Readonly<{ acknowledged: true; submit_attempt_id: string }>
          >(
            resultValue,
            "record_trigger_submit_attempt_v1 returned a non-canonical response",
            "server_invariant",
          );
          if (!exactAttemptAck(result, attemptId)) {
            throw new InvalidAdmitTriggerCommandError(
              "record_trigger_submit_attempt_v1 returned a non-canonical response",
              "server_invariant",
            );
          }
          return attemptId;
        },
      );
    },
    async admit(
      ingress: VerifiedTriggerIngressV1,
      commandValue: unknown,
    ): Promise<AdmitTriggerWriterResponseV1> {
      const commandSnapshot = canonicalAdmissionSnapshotV1<unknown>(
        commandValue,
        "admission command is outside the bounded canonical JSON contract",
        "invalid_request",
      );
      if (!Value.Check(AdmitTriggerCommandV1Schema, commandSnapshot)) {
        throw new InvalidAdmitTriggerCommandError(
          "admission command violates AdmitTriggerCommandV1",
        );
      }
      const command = commandSnapshot as AdmitTriggerCommandV1;
      assertCanonicalCommand(command);
      const ingressSnapshot =
        canonicalAdmissionSnapshotV1<VerifiedTriggerIngressV1>(
          ingress,
          "verified admission ingress is outside the bounded canonical JSON contract",
          "authorization_denied",
        );
      const scope = botScope(command);
      if (ingressSnapshot.authentication_kind === "pai_workload_jwt") {
        const { claims } = ingressSnapshot.credential;
        if (
          claims.aud !== "trigger_processor" ||
          claims.scope_kind !== "bot" ||
          !matchesAuthorizationScope(claims, scope)
        ) {
          throw new InvalidAdmitTriggerCommandError(
            "verified workload credential does not match the complete bot scope",
            "authorization_scope_mismatch",
            undefined,
            command.source,
          );
        }
      }
      const identity = authenticatedIdentity(ingressSnapshot, command);
      const requestHash = canonicalAdmissionRequestHash(command);
      const triggerId = generateId();
      const processId = generateId();
      if (
        !validServerIdentity(triggerId) ||
        !validServerIdentity(processId) ||
        triggerId === processId
      ) {
        throw new InvalidAdmitTriggerCommandError(
          "server-generated trigger identity is invalid",
          "server_invariant",
        );
      }
      return database.unit_of_work.withTransaction(
        {
          operation: "admit_trigger",
          idempotency_key: command.dedupe_key,
          trace_id: command.trace_id,
          isolation: "serializable",
          retry: "serialization_failures",
        },
        async (transaction, { owner }) => {
          const resultValue = await owner.executeWriter<
            AdmitTriggerWriterResponseV1,
            "create_trigger_admission_v1"
          >(transaction, {
            writer: "create_trigger_admission_v1",
            arguments: {
              p_trigger_id: triggerId,
              p_process_id: processId,
              p_scope: { ...scope },
              p_source: command.source,
              p_actor: identity.actor,
              p_payload: command.payload,
              p_dedupe_key: command.dedupe_key,
              p_request_hash: requestHash,
              p_authenticated_context: identity.authenticated_context,
              p_admission_request: admissionRequest(command),
              p_idempotency_key: command.dedupe_key,
              p_trace_id: command.trace_id,
            },
            expected_rows: 1,
          });
          const result =
            canonicalAdmissionSnapshotV1<AdmitTriggerWriterResponseV1>(
              resultValue,
              "create_trigger_admission_v1 returned non-canonical JSON",
              "server_invariant",
            );
          if (
            !Value.Check(AdmitTriggerWriterResponseV1Schema, result) ||
            result.trace_id !== command.trace_id ||
            (result.code === "trigger_accepted" &&
              (result.details.trigger_id !== triggerId ||
                result.details.trigger_process_id !== processId)) ||
            (result.code === "trigger_rejected" &&
              result.details.trigger_id !== triggerId)
          ) {
            throw new InvalidAdmitTriggerCommandError(
              "create_trigger_admission_v1 returned a non-canonical response",
              "server_invariant",
            );
          }
          return result;
        },
      );
    },
  });
}
