import { createHash, timingSafeEqual } from "node:crypto";

import {
  RuntimeStartReservationValidateRequestV1Schema,
  RuntimeStartReservationValidateResponseV1Schema,
  assertRuntimeStartReservationValidatePathBindingsV1,
  type RuntimeStartReservationValidateErrorCodeV1,
  type RuntimeStartReservationValidateRequestV1,
  type RuntimeStartReservationValidateResponseV1,
} from "@pai/contracts";
import { canonicalJsonV1 } from "@pai/eventing";
import { Value } from "@sinclair/typebox/value";

export type RuntimeStartReservationStatusV1 =
  | "reserved"
  | "dispatching"
  | "queued"
  | "started"
  | "failed"
  | "cancel_requested"
  | "cancelled_before_dispatch"
  | "cancelled_after_dispatch"
  | "completed";

export interface RuntimeStartReservationValidationRowV1 {
  readonly trigger_process_id: string;
  readonly runtime_run_id: string;
  readonly start_attempt_no: number;
  readonly start_fence_generation: number;
  readonly start_fence_token_hash: string;
  readonly request_hash: string;
  readonly status: RuntimeStartReservationStatusV1;
  readonly current_runtime_run_id: string | null;
  readonly process_phase: string;
  readonly process_status: string;
  readonly is_current_fence: boolean;
  readonly has_tombstone: boolean;
  readonly workspace_id: string;
  readonly bot_id: string;
  readonly owner_agent_id: string;
  readonly deployment_environment: "local" | "dev" | "staging" | "prod";
  readonly release_channel: "stable" | "canary";
}

export type RuntimeStartReservationValidationReadV1 =
  | Readonly<{ outcome: "not_found" }>
  | Readonly<{
      outcome: "found";
      reservation: RuntimeStartReservationValidationRowV1;
    }>;

export interface RuntimeStartReservationValidationRepositoryV1 {
  /**
   * The inspector runs synchronously while the repository still owns the
   * attempt-scoped validator advisory lock and the fresh READ COMMITTED
   * statement snapshot. This lock serializes validators only; owner-state
   * races after the response are closed by the staged Action claim/start gate.
   */
  withLockedExactReservation(
    request: Readonly<{
      trigger_process_id: string;
      start_attempt_no: number;
    }>,
    inspect: (
      read: RuntimeStartReservationValidationReadV1,
    ) => RuntimeStartReservationValidateResponseV1,
  ): Promise<RuntimeStartReservationValidateResponseV1>;
}

export interface RuntimeStartReservationValidationPrincipalV1 {
  readonly sub: "action_runtime";
  readonly aud: "trigger_processor";
  readonly capability: readonly string[];
  readonly scope_kind: "bot";
  readonly workspace_id: string;
  readonly bot_id: string;
  readonly owner_agent_id: string;
  readonly deployment_environment: "local" | "dev" | "staging" | "prod";
  readonly release_channel: "stable" | "canary";
}

export class RuntimeStartReservationValidationErrorV1 extends Error {
  public constructor(
    public readonly code: RuntimeStartReservationValidateErrorCodeV1,
  ) {
    super(code);
    this.name = "RuntimeStartReservationValidationErrorV1";
  }
}

export interface RuntimeStartReservationValidationApplicationV1 {
  validate(
    principal: RuntimeStartReservationValidationPrincipalV1,
    path: Readonly<{
      trigger_process_id: string;
      start_attempt_no: number;
    }>,
    request: unknown,
  ): Promise<RuntimeStartReservationValidateResponseV1>;
}

function tokenHash(token: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(token, "utf8").digest("hex")}`;
}

function constantTimeHashEquals(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, "utf8");
  const rightBytes = Buffer.from(right, "utf8");
  return (
    leftBytes.byteLength === rightBytes.byteLength &&
    timingSafeEqual(leftBytes, rightBytes)
  );
}

function scopeMatches(
  principal: RuntimeStartReservationValidationPrincipalV1,
  reservation: RuntimeStartReservationValidationRowV1,
): boolean {
  return (
    principal.workspace_id === reservation.workspace_id &&
    principal.bot_id === reservation.bot_id &&
    principal.owner_agent_id === reservation.owner_agent_id &&
    principal.deployment_environment === reservation.deployment_environment &&
    principal.release_channel === reservation.release_channel
  );
}

function fail(code: RuntimeStartReservationValidateErrorCodeV1): never {
  throw new RuntimeStartReservationValidationErrorV1(code);
}

function deepFreezeCanonicalSnapshotV1<T>(value: unknown): T {
  const parsed = JSON.parse(canonicalJsonV1(value)) as unknown;
  const stack: object[] =
    typeof parsed === "object" && parsed !== null ? [parsed] : [];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const entry of Object.values(current)) {
      if (
        typeof entry === "object" &&
        entry !== null &&
        !Object.isFrozen(entry)
      ) {
        stack.push(entry);
      }
    }
    Object.freeze(current);
  }
  return parsed as T;
}

export function createRuntimeStartReservationValidationApplicationV1(
  repository: RuntimeStartReservationValidationRepositoryV1,
): RuntimeStartReservationValidationApplicationV1 {
  return Object.freeze({
    async validate(
      principal: RuntimeStartReservationValidationPrincipalV1,
      path: Readonly<{
        trigger_process_id: string;
        start_attempt_no: number;
      }>,
      requestValue: unknown,
    ) {
      let pathSnapshot: Readonly<{
        trigger_process_id: string;
        start_attempt_no: number;
      }>;
      try {
        pathSnapshot = deepFreezeCanonicalSnapshotV1(path);
        assertRuntimeStartReservationValidatePathBindingsV1(
          pathSnapshot.trigger_process_id,
          pathSnapshot.start_attempt_no,
        );
      } catch {
        fail("schema_validation_failed");
      }
      let request: RuntimeStartReservationValidateRequestV1;
      try {
        request =
          deepFreezeCanonicalSnapshotV1<RuntimeStartReservationValidateRequestV1>(
            requestValue,
          );
      } catch {
        fail("schema_validation_failed");
      }
      if (
        !Value.Check(
          RuntimeStartReservationValidateRequestV1Schema,
          request,
        )
      ) {
        fail("schema_validation_failed");
      }
      let principalSnapshot: RuntimeStartReservationValidationPrincipalV1;
      try {
        principalSnapshot =
          deepFreezeCanonicalSnapshotV1<RuntimeStartReservationValidationPrincipalV1>(
            principal,
          );
      } catch {
        fail("authorization_scope_mismatch");
      }
      if (
        typeof principalSnapshot !== "object" ||
        principalSnapshot === null ||
        principalSnapshot.sub !== "action_runtime" ||
        principalSnapshot.aud !== "trigger_processor" ||
        principalSnapshot.scope_kind !== "bot" ||
        !Array.isArray(principalSnapshot.capability) ||
        !principalSnapshot.capability.every(
          (capability) => typeof capability === "string",
        ) ||
        !principalSnapshot.capability.includes(
          "trigger.runtime_start.reservation.validate",
        )
      ) {
        fail("authorization_scope_mismatch");
      }
      return repository.withLockedExactReservation(
        pathSnapshot,
        (read) => {
          try {
            canonicalJsonV1(read);
          } catch {
            fail("internal_error");
          }
          if (read.outcome === "not_found") fail("reservation_terminal");
          const reservation = read.reservation;
          if (!scopeMatches(principalSnapshot, reservation)) {
            fail("authorization_scope_mismatch");
          }
          if (
            reservation.trigger_process_id !==
              pathSnapshot.trigger_process_id ||
            reservation.start_attempt_no !== pathSnapshot.start_attempt_no ||
            reservation.runtime_run_id !== request.runtime_run_id ||
            reservation.request_hash !== request.request_hash
          ) {
            fail("idempotency_conflict");
          }
          if (
            !constantTimeHashEquals(
              reservation.start_fence_token_hash,
              request.validation_stage === "before_running"
                ? request.start_fence_token_hash
                : tokenHash(request.start_fence_token),
            )
          ) {
            fail("stale_start_fence");
          }
          if (
            reservation.status === "cancel_requested" ||
            reservation.status === "cancelled_before_dispatch" ||
            reservation.status === "cancelled_after_dispatch"
          ) {
            fail("start_cancelled");
          }
          if (reservation.has_tombstone) {
            fail("start_cancelled");
          }
          const isPrePublicationReservation =
            (reservation.status === "reserved" ||
              reservation.status === "dispatching" ||
              reservation.status === "queued") &&
            reservation.current_runtime_run_id === null &&
            reservation.process_phase === "execution" &&
            reservation.process_status === "waiting";
          // A replacement worker must revalidate the same immutable Start
          // fence before it can reclaim an expired Runtime lease.  At that
          // point Trigger has already published the run, so the only valid
          // owner state is the exact started/running pair below.  Do not make
          // this state available to the earlier Start stages: they run before
          // publication and must remain fenced by the pre-publication shape.
          const isExpiredRunRecovery =
            request.validation_stage === "before_running" &&
            reservation.status === "started" &&
            reservation.current_runtime_run_id === reservation.runtime_run_id &&
            reservation.process_phase === "execution" &&
            reservation.process_status === "running";
          if (
            (!isPrePublicationReservation && !isExpiredRunRecovery) ||
            !reservation.is_current_fence
          ) {
            fail("reservation_terminal");
          }
          const response: RuntimeStartReservationValidateResponseV1 = {
            schema_version:
              "runtime_start_reservation_validate_response.v1",
            validation_result: "valid",
            reservation_status: reservation.status,
            validated_fence_generation:
              reservation.start_fence_generation,
            validation_stage: request.validation_stage,
            // The endpoint is read-only by contract. A repeated validation is
            // a fresh authoritative read, not a replayed mutable result.
            duplicate_replayed: false,
            trace_id: request.trace_id,
          };
          if (
            !Value.Check(
              RuntimeStartReservationValidateResponseV1Schema,
              response,
            )
          ) {
            fail("internal_error");
          }
          return Object.freeze(response);
        },
      );
    },
  });
}
