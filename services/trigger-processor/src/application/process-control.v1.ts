import { createHash, randomUUID } from "node:crypto";

import type { VerifiedSupabaseIngress } from "@pai/auth";
import {
  TriggerProcessCancelCommandV1Schema,
  TriggerProcessCancelRequestV1Schema,
  TriggerProcessCancelResponseV1Schema,
  type TriggerProcessCancelCommandV1,
  type TriggerProcessCancelRequestV1,
  type TriggerProcessCancelResponseV1,
} from "@pai/contracts";
import { canonicalJsonV1 } from "@pai/eventing";
import { Value } from "@sinclair/typebox/value";

import type {
  TriggerProcessorOwnerDatabaseV1,
  VerifiedTriggerIngressV1,
} from "./trigger-admission.v1.js";

export class InvalidProcessControlRequestV1 extends Error {
  public constructor(
    message: string,
    public readonly kind:
      | "invalid_request"
      | "authorization_denied"
      | "server_invariant" = "invalid_request",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "InvalidProcessControlRequestV1";
  }
}

export interface TriggerProcessControlApplicationV1 {
  cancel(
    ingress: VerifiedTriggerIngressV1,
    processId: string,
    request: unknown,
    traceId: string,
  ): Promise<TriggerProcessCancelResponseV1>;
}

function canonicalControlSnapshotV1<T>(
  value: unknown,
  message: string,
  kind: InvalidProcessControlRequestV1["kind"],
): T {
  let snapshot: T;
  try {
    snapshot = JSON.parse(canonicalJsonV1(value)) as T;
  } catch (error) {
    throw new InvalidProcessControlRequestV1(message, kind, {
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

function authenticatedRole(
  ingress: VerifiedSupabaseIngress,
): TriggerProcessCancelCommandV1["authenticated_role"] {
  const { principal } = ingress;
  if (principal.principal_type === "bot") {
    throw new InvalidProcessControlRequestV1(
      "bot principals cannot cancel a user Trigger Process",
      "authorization_denied",
    );
  }
  if (principal.roles.includes("super_user")) return "super_user";
  if (
    principal.principal_type === "operator" ||
    principal.roles.includes("operator")
  ) {
    return "operator";
  }
  if (
    principal.principal_type === "developer" ||
    principal.roles.includes("developer")
  ) {
    return "developer";
  }
  return "user";
}

function normalizeCancellationReason(reason: string): string {
  return reason.normalize("NFKC").trim().toLowerCase();
}

export function canonicalCancellationRequestHashV1(
  command: Pick<
    TriggerProcessCancelCommandV1,
    | "trigger_process_id"
    | "authenticated_principal_id"
    | "authenticated_role"
    | "normalized_reason"
  >,
): `sha256:${string}` {
  const canonical = canonicalJsonV1({
    schema_version: "trigger_process_cancel_request.v1",
    path_trigger_process_id: command.trigger_process_id,
    authenticated_principal_id: command.authenticated_principal_id,
    authenticated_role: command.authenticated_role,
    normalized_reason: command.normalized_reason,
  });
  return `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
}

export function createTriggerProcessControlApplicationV1(
  database: TriggerProcessorOwnerDatabaseV1,
  dependencies: Readonly<{ generateId?: () => string }> = {},
): TriggerProcessControlApplicationV1 {
  const generateId = dependencies.generateId ?? randomUUID;
  return Object.freeze({
    async cancel(
      ingress: VerifiedTriggerIngressV1,
      processId: string,
      requestValue: unknown,
      traceId: string,
    ): Promise<TriggerProcessCancelResponseV1> {
      const ingressSnapshot =
        canonicalControlSnapshotV1<VerifiedTriggerIngressV1>(
          ingress,
          "verified cancellation ingress is outside the bounded canonical JSON contract",
          "authorization_denied",
        );
      if (ingressSnapshot.authentication_kind !== "supabase_ingress") {
        throw new InvalidProcessControlRequestV1(
          "process cancellation requires Supabase ingress",
          "authorization_denied",
        );
      }
      const requestSnapshot =
        canonicalControlSnapshotV1<unknown>(
          requestValue,
          "process cancellation request is outside the bounded canonical JSON contract",
          "invalid_request",
        );
      if (
        !Value.Check(TriggerProcessCancelRequestV1Schema, requestSnapshot) ||
        processId.trim().length === 0 ||
        processId.length > 512 ||
        /[\r\n]/u.test(processId) ||
        traceId.trim().length === 0
      ) {
        throw new InvalidProcessControlRequestV1(
          "process cancellation request is invalid",
          "invalid_request",
        );
      }
      const request = requestSnapshot as TriggerProcessCancelRequestV1;
      const credential = ingressSnapshot.credential;
      const principal = credential.principal;
      const commandWithoutHash = {
        schema_version: "trigger_process_cancel_command.v1" as const,
        trigger_process_id: processId,
        idempotency_key: request.idempotency_key,
        normalized_reason: normalizeCancellationReason(request.reason),
        authenticated_principal_id: principal.principal_id,
        authenticated_role: authenticatedRole(credential),
        trace_id: traceId,
      };
      const requestHash = canonicalCancellationRequestHashV1(
        commandWithoutHash,
      );
      const command: TriggerProcessCancelCommandV1 = {
        ...commandWithoutHash,
        request_hash: requestHash,
      };
      if (!Value.Check(TriggerProcessCancelCommandV1Schema, command)) {
        throw new InvalidProcessControlRequestV1(
          "authenticated cancellation command is invalid",
          "server_invariant",
        );
      }
      const cancelRequestId = generateId();
      if (
        cancelRequestId.trim().length === 0 ||
        cancelRequestId.length > 512 ||
        /[\r\n]/u.test(cancelRequestId)
      ) {
        throw new InvalidProcessControlRequestV1(
          "generated cancel request identity is invalid",
          "server_invariant",
        );
      }
      return database.unit_of_work.withTransaction(
        {
          operation: "request_trigger_cancel",
          idempotency_key: `${processId}:${request.idempotency_key}`,
          trace_id: traceId,
          isolation: "serializable",
          retry: "serialization_failures",
        },
        async (transaction, { owner }) => {
          const resultValue = await owner.executeWriter<
            TriggerProcessCancelResponseV1,
            "request_trigger_cancel_v1"
          >(transaction, {
            writer: "request_trigger_cancel_v1",
            arguments: {
              p_cancel_request_id: cancelRequestId,
              p_process_id: processId,
              p_cancel_request: command,
              p_idempotency_key: request.idempotency_key,
              p_request_hash: requestHash,
              p_trace_id: traceId,
            },
            expected_rows: 1,
          });
          const result =
            canonicalControlSnapshotV1<TriggerProcessCancelResponseV1>(
              resultValue,
              "request_trigger_cancel_v1 returned non-canonical JSON",
              "server_invariant",
            );
          if (
            !Value.Check(TriggerProcessCancelResponseV1Schema, result) ||
            result.trace_id !== traceId ||
            result.details.trigger_process_id !== processId
          ) {
            throw new InvalidProcessControlRequestV1(
              "request_trigger_cancel_v1 returned a non-canonical response",
              "server_invariant",
            );
          }
          return result;
        },
      );
    },
  });
}
