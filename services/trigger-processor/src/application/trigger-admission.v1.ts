import {
  matchesAuthorizationScope,
  type BotAuthorizationScopeV1,
  type VerifiedWorkloadCredential,
} from "@pai/auth";
import {
  TriggerSourceV1Schema,
  type TriggerActorTypeV1,
  type TriggerSourceV1,
} from "@pai/contracts";
import type { OwnerDatabaseApplicationDependenciesV1 } from "@pai/persistence";
import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import { TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1 } from "../db/permission-manifest.v1.js";

export type TriggerProcessorOwnerDatabaseV1 =
  OwnerDatabaseApplicationDependenciesV1<
    typeof TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1
  >;

const botScopeProperties = {
  scope_kind: Type.Literal("bot"),
  workspace_id: Type.String({ minLength: 1 }),
  bot_id: Type.String({ minLength: 1 }),
  owner_agent_id: Type.String({ minLength: 1 }),
  deployment_environment: Type.Union([
    Type.Literal("local"), Type.Literal("dev"), Type.Literal("staging"),
    Type.Literal("prod"),
  ]),
  release_channel: Type.Union([
    Type.Literal("stable"), Type.Literal("canary"),
  ]),
};

export const AdmitTriggerCommandV1Schema = Type.Object(
  {
    trigger_id: Type.String({ minLength: 1 }),
    process_id: Type.String({ minLength: 1 }),
    scope: Type.Object(botScopeProperties, { additionalProperties: false }),
    source: TriggerSourceV1Schema,
    payload: Type.Record(Type.String(), Type.Unknown()),
    dedupe_key: Type.String({ minLength: 1 }),
    request_hash: Type.String({ minLength: 1 }),
    idempotency_key: Type.String({ minLength: 1 }),
    trace_id: Type.String({ minLength: 1 }),
    is_catch_up: Type.Boolean(),
    explicit_interrupt: Type.Boolean(),
  },
  { additionalProperties: false },
);

export type AdmitTriggerCommandV1 = Static<typeof AdmitTriggerCommandV1Schema>;

export class InvalidAdmitTriggerCommandError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "InvalidAdmitTriggerCommandError";
  }
}

const capabilityBySource = Object.freeze({
  chat: "trigger.submit.chat",
  notification: "trigger.submit.notification",
  timer: "trigger.submit.timer",
} satisfies Readonly<Record<TriggerSourceV1, string>>);

function authenticatedActor(
  credential: VerifiedWorkloadCredential,
  source: TriggerSourceV1,
): Readonly<{ actor_type: TriggerActorTypeV1; actor_id: string }> {
  const { claims } = credential;
  const requiredCapability = capabilityBySource[source];
  if (!claims.capability.includes(requiredCapability)) {
    throw new InvalidAdmitTriggerCommandError(
      `verified workload credential lacks ${requiredCapability}`,
    );
  }
  if (source === "timer") {
    if (claims.sub !== "timer_trigger_app" || claims.delegated_principal !== undefined) {
      throw new InvalidAdmitTriggerCommandError(
        "timer admission requires timer_trigger_app without delegated identity",
      );
    }
    return Object.freeze({ actor_type: "system", actor_id: claims.sub });
  }
  const principal = claims.delegated_principal;
  if (claims.sub !== "observation_gateway" || principal === undefined) {
    throw new InvalidAdmitTriggerCommandError(
      `${source} admission requires observation_gateway and a signed delegated principal`,
    );
  }
  const actorType: TriggerActorTypeV1 =
    principal.roles.includes("super_user")
      ? "super_user"
      : principal.principal_type === "developer"
        ? "developer"
        : "user";
  return Object.freeze({
    actor_type: actorType,
    actor_id: principal.principal_id,
  });
}

export interface TriggerAdmissionApplicationV1 {
  admit<TResult>(
    credential: VerifiedWorkloadCredential,
    command: unknown,
  ): Promise<TResult>;
}

/**
 * The production admission mutation boundary. The generated owner writer must
 * derive bot authority, safety, priority and admission state while locking the
 * canonical bot slot and process rows before it writes Trigger, Process, audit,
 * and outbox. Application callers cannot submit those trusted facts.
 */
export function createTriggerAdmissionApplicationV1(
  database: TriggerProcessorOwnerDatabaseV1,
): TriggerAdmissionApplicationV1 {
  return Object.freeze({
    async admit<TResult>(
      credential: VerifiedWorkloadCredential,
      commandValue: unknown,
    ): Promise<TResult> {
      if (!Value.Check(AdmitTriggerCommandV1Schema, commandValue)) {
        throw new InvalidAdmitTriggerCommandError(
          "admission command violates AdmitTriggerCommandV1",
        );
      }
      const command = commandValue as AdmitTriggerCommandV1;
      if (
        credential.claims.aud !== "trigger_processor" ||
        credential.claims.scope_kind !== "bot" ||
        !matchesAuthorizationScope(
          credential.claims,
          command.scope as BotAuthorizationScopeV1,
        )
      ) {
        throw new InvalidAdmitTriggerCommandError(
          "verified workload credential does not match the complete bot scope",
        );
      }
      const actor = authenticatedActor(credential, command.source);
      const requiredCapability = capabilityBySource[command.source];
      return database.unit_of_work.withTransaction(
        {
          operation: "admit_trigger",
          idempotency_key: command.idempotency_key,
          trace_id: command.trace_id,
          isolation: "serializable",
          retry: "serialization_failures",
        },
        async (transaction, { owner }) =>
          owner.executeWriter<TResult, "admit_trigger_v1">(transaction, {
            writer: "admit_trigger_v1",
            arguments: {
              p_trigger_id: command.trigger_id,
              p_process_id: command.process_id,
              p_scope: command.scope,
              p_source: command.source,
              p_actor: actor,
              p_payload: command.payload,
              p_dedupe_key: command.dedupe_key,
              p_request_hash: command.request_hash,
              p_authenticated_context: {
                workload_subject: credential.claims.sub,
                credential_jti: credential.claims.jti,
                credential_kid: credential.protectedHeader.kid,
                capability: requiredCapability,
                delegated_principal:
                  credential.claims.delegated_principal ?? null,
              },
              p_admission_request: {
                is_catch_up: command.is_catch_up,
                explicit_interrupt: command.explicit_interrupt,
              },
              p_idempotency_key: command.idempotency_key,
              p_trace_id: command.trace_id,
            },
            expected_rows: 1,
          }),
      );
    },
  });
}
