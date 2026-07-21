import { createHash } from "node:crypto";

import {
  matchesAuthorizationScope,
  type BotAuthorizationScopeV1,
  type VerifiedWorkloadCredential,
} from "@pai/auth";
import {
  AdmitTriggerCommandV1Schema,
  AdmitTriggerResponseV1Schema,
  type AdmitTriggerCommandV1,
  type AdmitTriggerResponseV1,
  type TriggerActorTypeV1,
  type TriggerSourceV1,
} from "@pai/contracts";
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
    public readonly kind: "invalid_request" | "authorization_denied" =
      "invalid_request",
  ) {
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
      "authorization_denied",
    );
  }
  if (source === "timer") {
    if (claims.sub !== "timer_trigger_app" || claims.delegated_principal !== undefined) {
      throw new InvalidAdmitTriggerCommandError(
        "timer admission requires timer_trigger_app without delegated identity",
        "authorization_denied",
      );
    }
    return Object.freeze({ actor_type: "system", actor_id: claims.sub });
  }
  const principal = claims.delegated_principal;
  if (claims.sub !== "observation_gateway" || principal === undefined) {
    throw new InvalidAdmitTriggerCommandError(
      `${source} admission requires observation_gateway and a signed delegated principal`,
      "authorization_denied",
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
  admit(
    credential: VerifiedWorkloadCredential,
    command: unknown,
  ): Promise<AdmitTriggerResponseV1>;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function canonicalAdmissionRequestHash(command: AdmitTriggerCommandV1): string {
  return `sha256:${createHash("sha256")
    .update(
      canonicalJson({
        dedupe_key: command.dedupe_key,
        explicit_interrupt: command.explicit_interrupt,
        idempotency_key: command.idempotency_key,
        is_catch_up: command.is_catch_up,
        payload: command.payload,
        process_id: command.process_id,
        scope: command.scope,
        source: command.source,
        trigger_id: command.trigger_id,
      }),
    )
    .digest("hex")}`;
}

function trustedExplicitInterrupt(
  credential: VerifiedWorkloadCredential,
  actor: Readonly<{ actor_type: TriggerActorTypeV1 }>,
  requested: boolean,
): boolean {
  if (!requested) return false;
  if (
    credential.claims.capability.includes("trigger.interrupt") &&
    actor.actor_type === "super_user"
  ) {
    return true;
  }
  throw new InvalidAdmitTriggerCommandError(
    "explicit interrupt requires trigger.interrupt and super_user delegation",
    "authorization_denied",
  );
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
    async admit(
      credential: VerifiedWorkloadCredential,
      commandValue: unknown,
    ): Promise<AdmitTriggerResponseV1> {
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
          "authorization_denied",
        );
      }
      const actor = authenticatedActor(credential, command.source);
      const requiredCapability = capabilityBySource[command.source];
      const trustedInterrupt = trustedExplicitInterrupt(
        credential,
        actor,
        command.explicit_interrupt,
      );
      const requestHash = canonicalAdmissionRequestHash(command);
      if (command.request_hash !== requestHash) {
        throw new InvalidAdmitTriggerCommandError(
          "request_hash does not match the canonical route-injected admission request",
        );
      }
      return database.unit_of_work.withTransaction(
        {
          operation: "admit_trigger",
          idempotency_key: command.idempotency_key,
          trace_id: command.trace_id,
          isolation: "serializable",
          retry: "serialization_failures",
        },
        async (transaction, { owner }) => {
          const result = await owner.executeWriter<
            AdmitTriggerResponseV1,
            "admit_trigger_v1"
          >(transaction, {
            writer: "admit_trigger_v1",
            arguments: {
              p_trigger_id: command.trigger_id,
              p_process_id: command.process_id,
              p_scope: command.scope,
              p_source: command.source,
              p_actor: actor,
              p_payload: command.payload,
              p_dedupe_key: command.dedupe_key,
              p_request_hash: requestHash,
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
                explicit_interrupt: trustedInterrupt,
                requested_explicit_interrupt: command.explicit_interrupt,
              },
              p_idempotency_key: command.idempotency_key,
              p_trace_id: command.trace_id,
            },
            expected_rows: 1,
          });
          if (!Value.Check(AdmitTriggerResponseV1Schema, result)) {
            throw new InvalidAdmitTriggerCommandError(
              "admit_trigger_v1 returned a non-canonical response",
            );
          }
          return result;
        },
      );
    },
  });
}
