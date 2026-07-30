import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  ClaimExpiredObjectReconcileRequestV1Schema,
  FinalizeObjectOperationRequestV1Schema,
  GetObjectOperationResultRequestV1Schema,
  MarkObjectOperationCommitUnknownRequestV1Schema,
  OBJECT_METADATA_OWNER_SERVICE_IDS_V1,
  OBJECT_STORE_METADATA_CONTRACT_V1,
  ObjectMetadataGcEligibilityV1Schema,
  ObjectMetadataReservationV1Schema,
  ObjectOperationAttemptV1Schema,
  ObjectOperationResultV1Schema,
  ObjectReconcileClaimV1Schema,
  ObjectReconcileJobV1Schema,
  ObjectTerminalProofV1Schema,
  ReserveObjectOperationRequestV1Schema,
  RenewObjectReconcileClaimRequestV1Schema,
  SettleObjectReconcileRequestV1Schema,
  StartObjectOperationAttemptRequestV1Schema,
  isFinalizeObjectOperationRequestV1,
  isObjectMetadataGcEligibilityV1,
  isObjectMetadataReservationV1,
  isObjectOperationAttemptV1,
  isObjectOperationResultV1,
  isObjectReconcileJobV1,
  isObjectTerminalProofV1,
  isReserveObjectOperationRequestV1,
  isRenewObjectReconcileClaimRequestV1,
  isSettleObjectReconcileRequestV1,
} from "../src/db/metadata-contract.v1.js";

const hash = `sha256:${"a".repeat(64)}`;
const anotherHash = `sha256:${"b".repeat(64)}`;
const objectRef = `objv1_${"c".repeat(32)}`;
const failure = {
  schema_version: "object_store_failure.v1",
  error_code: "storage_unavailable",
  retryable: true,
  failure_hash: hash,
} as const;
const tombstone = {
  schema_version: "object_delete_tombstone.v1",
  object_fingerprint: anotherHash,
  deletion_decision_version: 3,
  result: "deleted",
  observed_at: "2026-07-24T01:02:00.000Z",
} as const;

const globalScope = {
  scope_kind: "global",
} as const;

const globalRowScope = {
  scope_kind: "global",
  workspace_id: null,
  bot_id: null,
  owner_agent_id: null,
  deployment_environment: null,
  release_channel: null,
} as const;

const botScope = {
  scope_kind: "bot",
  workspace_id: "workspace-1",
  bot_id: "bot-1",
  owner_agent_id: "agent-1",
  deployment_environment: "prod",
  release_channel: "stable",
} as const;

function reservation(
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  return {
    id: "reservation-1",
    contract_version: "object_store_metadata.v1",
    operation: "put_immutable",
    owner_service: "trigger_processor",
    owner_object_id: "process-1",
    owner_state_version: 7,
    object_class: "trigger_snapshot",
    ...globalRowScope,
    idempotency_key: "snapshot:process-1:7",
    request_hash: hash,
    object_fingerprint: anotherHash,
    expected_digest: hash,
    expected_size_bytes: 1024,
    media_type: "application/json",
    retention_until: "2027-01-01T00:00:00.000Z",
    deletion_decision_version: null,
    foreground_lease_token_hash: anotherHash,
    foreground_lease_expires_at: "2026-07-24T01:05:00.000Z",
    generation: 1,
    current_attempt_no: 0,
    status: "reserved",
    opaque_ref: null,
    physical_object_fingerprint: null,
    terminal_proof_hash: null,
    gc_not_before: "2027-01-01T00:00:00.000Z",
    created_at: "2026-07-24T01:00:00.000Z",
    updated_at: "2026-07-24T01:00:00.000Z",
    ...overrides,
  };
}

function attempt(
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  return {
    id: "attempt-1",
    reservation_id: "reservation-1",
    operation: "put_immutable",
    attempt_no: 1,
    actor_kind: "foreground",
    attempt_token_hash: hash,
    claim_token_hash: null,
    claim_generation: null,
    status: "started",
    provider_request_id: null,
    provider_receipt_hash: null,
    physical_object_fingerprint: null,
    result_digest: null,
    result_size_bytes: null,
    error: null,
    started_at: "2026-07-24T01:01:00.000Z",
    completed_at: null,
    ...overrides,
  };
}

function terminalProof(
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  return {
    id: "proof-1",
    reservation_id: "reservation-1",
    attempt_id: "attempt-1",
    operation: "put_immutable",
    proof_kind: "put_receipt",
    opaque_ref: objectRef,
    provider_receipt_hash: hash,
    physical_object_fingerprint: anotherHash,
    result_digest: hash,
    result_size_bytes: 1024,
    result_media_type: "application/json",
    provider_terminal_disposition: null,
    tombstone: null,
    proof_hash: anotherHash,
    completed_at: "2026-07-24T01:02:00.000Z",
    created_at: "2026-07-24T01:02:00.000Z",
    ...overrides,
  };
}

function reconcileJob(
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  return {
    id: "reconcile-1",
    reservation_id: "reservation-1",
    status: "pending",
    claim_token_hash: null,
    claim_generation: null,
    claim_lease_expires_at: null,
    retry_count: 0,
    next_retry_at: "2026-07-24T01:05:00.000Z",
    last_error: null,
    dlq_reason: null,
    dlq_at: null,
    created_at: "2026-07-24T01:03:00.000Z",
    updated_at: "2026-07-24T01:03:00.000Z",
    ...overrides,
  };
}

describe("object_store_metadata.v1 row contracts", () => {
  it("covers every canonical 0050 column in the four durable row schemas", () => {
    const reservationProperties =
      ObjectMetadataReservationV1Schema.anyOf[0]!.properties;
    expect(Object.keys(reservationProperties).sort()).toEqual(
      [
        "id",
        "contract_version",
        "operation",
        "owner_service",
        "owner_object_id",
        "owner_state_version",
        "object_class",
        "scope_kind",
        "workspace_id",
        "bot_id",
        "owner_agent_id",
        "deployment_environment",
        "release_channel",
        "idempotency_key",
        "request_hash",
        "object_fingerprint",
        "expected_digest",
        "expected_size_bytes",
        "media_type",
        "retention_until",
        "deletion_decision_version",
        "foreground_lease_token_hash",
        "foreground_lease_expires_at",
        "generation",
        "current_attempt_no",
        "status",
        "opaque_ref",
        "physical_object_fingerprint",
        "terminal_proof_hash",
        "gc_not_before",
        "created_at",
        "updated_at",
      ].sort(),
    );
    expect(Object.keys(ObjectOperationAttemptV1Schema.properties).sort()).toEqual(
      [
        "id",
        "reservation_id",
        "operation",
        "attempt_no",
        "actor_kind",
        "attempt_token_hash",
        "claim_token_hash",
        "claim_generation",
        "status",
        "provider_request_id",
        "provider_receipt_hash",
        "physical_object_fingerprint",
        "result_digest",
        "result_size_bytes",
        "error",
        "started_at",
        "completed_at",
      ].sort(),
    );
    expect(Object.keys(ObjectTerminalProofV1Schema.properties).sort()).toEqual(
      [
        "id",
        "reservation_id",
        "attempt_id",
        "operation",
        "proof_kind",
        "opaque_ref",
        "provider_receipt_hash",
        "physical_object_fingerprint",
        "result_digest",
        "result_size_bytes",
        "result_media_type",
        "provider_terminal_disposition",
        "tombstone",
        "proof_hash",
        "completed_at",
        "created_at",
      ].sort(),
    );
    expect(Object.keys(ObjectReconcileJobV1Schema.properties).sort()).toEqual(
      [
        "id",
        "reservation_id",
        "status",
        "claim_token_hash",
        "claim_generation",
        "claim_lease_expires_at",
        "retry_count",
        "next_retry_at",
        "last_error",
        "dlq_reason",
        "dlq_at",
        "created_at",
        "updated_at",
      ].sort(),
    );
  });

  it("restricts durable ownership to the three documented ObjectStore owners", () => {
    expect(OBJECT_METADATA_OWNER_SERVICE_IDS_V1).toEqual([
      "trigger_processor",
      "action_runtime",
      "skill_registry",
    ]);
    expect(
      Value.Check(
        ObjectMetadataReservationV1Schema,
        reservation({ owner_service: "memory" }),
      ),
    ).toBe(false);
  });

  it("accepts canonical global/bot reservations and enforces safe integers", () => {
    expect(isObjectMetadataReservationV1(reservation())).toBe(true);
    expect(
      isObjectMetadataReservationV1(
        reservation({
          ...botScope,
          owner_service: "action_runtime",
          owner_object_id: "runtime-1",
        }),
      ),
    ).toBe(true);
    expect(
      isObjectMetadataReservationV1(
        reservation({ owner_state_version: Number.MAX_SAFE_INTEGER + 1 }),
      ),
    ).toBe(false);
    expect(
      isObjectMetadataReservationV1(
        reservation({ scope_kind: "global", workspace_id: "leak" }),
      ),
    ).toBe(false);
  });

  it("enforces operation, lease, GC, and immutable terminal invariants", () => {
    expect(
      isObjectMetadataReservationV1(
        reservation({ expected_digest: null }),
      ),
    ).toBe(false);
    expect(
      isObjectMetadataReservationV1(
        reservation({
          operation: "delete_if_eligible",
          deletion_decision_version: null,
        }),
      ),
    ).toBe(false);
    expect(
      isObjectMetadataReservationV1(
        reservation({
          foreground_lease_expires_at: "2026-07-24T00:59:59.000Z",
        }),
      ),
    ).toBe(false);
    expect(
      isObjectMetadataReservationV1(
        reservation({ gc_not_before: "2026-12-31T23:59:59.000Z" }),
      ),
    ).toBe(false);
    expect(
      isObjectMetadataReservationV1(
        reservation({
          status: "succeeded",
          opaque_ref: objectRef,
          terminal_proof_hash: anotherHash,
        }),
      ),
    ).toBe(true);
    expect(
      isObjectMetadataReservationV1(
        reservation({ status: "succeeded", opaque_ref: objectRef }),
      ),
    ).toBe(false);
    expect(
      isObjectMetadataReservationV1(
        reservation({
          status: "tombstoned",
          opaque_ref: objectRef,
          terminal_proof_hash: anotherHash,
        }),
      ),
    ).toBe(false);
  });

  it("requires exactly one foreground or reconciler attempt fence", () => {
    expect(isObjectOperationAttemptV1(attempt())).toBe(true);
    expect(
      isObjectOperationAttemptV1(
        attempt({
          actor_kind: "reconciler",
          attempt_token_hash: null,
          claim_token_hash: hash,
          claim_generation: 2,
        }),
      ),
    ).toBe(true);
    expect(
      isObjectOperationAttemptV1(
        attempt({ claim_token_hash: hash, claim_generation: 1 }),
      ),
    ).toBe(false);
    expect(
      isObjectOperationAttemptV1(
        attempt({ status: "succeeded", completed_at: null }),
      ),
    ).toBe(false);
    expect(
      Value.Check(ObjectOperationAttemptV1Schema, {
        ...attempt(),
        attempt_no: Number.MAX_SAFE_INTEGER + 1,
      }),
    ).toBe(false);
  });

  it("never invokes accessors while validating persisted JSONB", () => {
    let invoked = false;
    const hostile = {
      ...attempt(),
      get error() {
        invoked = true;
        return { secret: "plaintext" };
      },
    };
    expect(isObjectOperationAttemptV1(hostile)).toBe(false);
    expect(invoked).toBe(false);

    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(
      isObjectOperationAttemptV1(attempt({ error: cyclic })),
    ).toBe(false);

    let deep: unknown = failure;
    for (let depth = 0; depth < 40; depth += 1) {
      deep = { nested: deep };
    }
    expect(isObjectOperationAttemptV1(attempt({ error: deep }))).toBe(false);
  });

  it("binds proof kind to operation and requires a real receipt/tombstone", () => {
    expect(isObjectTerminalProofV1(terminalProof())).toBe(true);
    expect(
      isObjectTerminalProofV1(
        terminalProof({
          operation: "delete_if_eligible",
          proof_kind: "delete_tombstone",
          opaque_ref: null,
          result_digest: null,
          result_size_bytes: null,
          result_media_type: null,
          tombstone,
        }),
      ),
    ).toBe(true);
    expect(
      isObjectTerminalProofV1(
        terminalProof({
          operation: "put_immutable",
          proof_kind: "delete_tombstone",
          opaque_ref: null,
          result_digest: null,
          result_size_bytes: null,
          result_media_type: null,
          tombstone,
        }),
      ),
    ).toBe(false);
    expect(
      isObjectTerminalProofV1(
        terminalProof({
          operation: "delete_if_eligible",
          proof_kind: "delete_tombstone",
          opaque_ref: null,
          result_digest: null,
          result_size_bytes: null,
          result_media_type: null,
          tombstone: {
            ...tombstone,
            signed_url: "https://storage.example/secret",
          },
        }),
      ),
    ).toBe(false);
    for (const field of [
      "provider_receipt_hash",
      "physical_object_fingerprint",
      "result_digest",
      "result_size_bytes",
      "result_media_type",
    ]) {
      expect(
        isObjectTerminalProofV1(
          terminalProof({
            [field]: null,
          }),
        ),
      ).toBe(false);
    }
    expect(
      isObjectTerminalProofV1(
        terminalProof({
          tombstone,
        }),
      ),
    ).toBe(false);
    expect(
      isObjectTerminalProofV1(
        terminalProof({
          operation: "put_immutable",
          proof_kind: "terminal_failure",
          opaque_ref: null,
          provider_receipt_hash: hash,
          physical_object_fingerprint: null,
          result_digest: null,
          result_size_bytes: null,
          result_media_type: null,
          provider_terminal_disposition: "rejected_before_commit",
          tombstone: null,
        }),
      ),
    ).toBe(true);
    expect(
      isObjectTerminalProofV1(
        terminalProof({
          operation: "put_immutable",
          proof_kind: "terminal_failure",
          opaque_ref: null,
          provider_receipt_hash: null,
          physical_object_fingerprint: null,
          result_digest: null,
          result_size_bytes: null,
          result_media_type: null,
          provider_terminal_disposition: "rejected_before_commit",
          tombstone: null,
        }),
      ),
    ).toBe(false);
    expect(
      isObjectTerminalProofV1(
        terminalProof({
          operation: "delete_if_eligible",
          proof_kind: "terminal_failure",
          opaque_ref: null,
          physical_object_fingerprint: null,
          result_digest: hash,
          result_size_bytes: null,
          result_media_type: null,
          provider_terminal_disposition: "verified_absent",
          tombstone: null,
        }),
      ),
    ).toBe(false);
    expect(
      Value.Check(ObjectTerminalProofV1Schema, {
        ...terminalProof(),
        proof_hash: "not-a-canonical-hash",
      }),
    ).toBe(false);
  });

  it("requires complete claim triples, retry schedules, and DLQ evidence", () => {
    expect(isObjectReconcileJobV1(reconcileJob())).toBe(true);
    expect(
      isObjectReconcileJobV1(
        reconcileJob({
          status: "claimed",
          claim_token_hash: hash,
          claim_generation: 2,
          claim_lease_expires_at: "2026-07-24T01:10:00.000Z",
        }),
      ),
    ).toBe(true);
    expect(
      isObjectReconcileJobV1(
        reconcileJob({ status: "claimed", claim_token_hash: hash }),
      ),
    ).toBe(false);
    expect(
      isObjectReconcileJobV1(
        reconcileJob({ status: "retry_wait", next_retry_at: null }),
      ),
    ).toBe(false);
    expect(
      isObjectReconcileJobV1(
        reconcileJob({
          status: "dlq",
          dlq_reason: "retry_exhausted",
          dlq_at: null,
        }),
      ),
    ).toBe(false);
  });

  it("exposes GC eligibility without weakening owner retention authority", () => {
    const valid = {
        reservation_id: "reservation-1",
        owner_service: "skill_registry",
        owner_object_id: "package-1",
        owner_state_version: 2,
        object_class: "skill_package",
        operation: "put_immutable",
        scope: botScope,
        terminal_status: "succeeded",
        reservation_generation: 1,
        terminal_proof_hash: hash,
        retention_until: "2027-01-01T00:00:00.000Z",
        gc_not_before: "2027-02-01T00:00:00.000Z",
      };
    expect(Value.Check(ObjectMetadataGcEligibilityV1Schema, valid)).toBe(true);
    expect(isObjectMetadataGcEligibilityV1(valid)).toBe(true);
    expect(
      isObjectMetadataGcEligibilityV1({
        ...valid,
        gc_not_before: "2026-12-31T23:59:59.000Z",
      }),
    ).toBe(false);
    expect(
      isObjectMetadataGcEligibilityV1({
        ...valid,
        terminal_status: "dlq",
        terminal_proof_hash: null,
      }),
    ).toBe(false);
  });
});

describe("object_store_metadata.v1 eight-writer request contracts", () => {
  const identity = {
    contract_version: "object_store_metadata.v1",
    owner_service: "trigger_processor",
    owner_object_id: "process-1",
    owner_state_version: 7,
    object_class: "trigger_snapshot",
    scope: globalScope,
    idempotency_key: "snapshot:process-1:7",
    request_hash: hash,
    object_fingerprint: anotherHash,
  } as const;
  const putDurableIdentity = {
    ...identity,
    operation: "put_immutable",
    expected_digest: hash,
    expected_size_bytes: 1024,
    media_type: "application/json",
    retention_until: "2027-01-01T00:00:00.000Z",
    deletion_decision_version: null,
    gc_not_before: "2027-01-01T00:00:00.000Z",
  } as const;

  it("requires owner object/version and keeps global wire scope minimal", () => {
    const valid = {
      ...identity,
      operation: "put_immutable",
      expected_digest: hash,
      expected_size_bytes: 1024,
      media_type: "application/json",
      retention_until: "2027-01-01T00:00:00.000Z",
      foreground_lease_token: "foreground-token",
      foreground_lease_seconds: 60,
      gc_not_before: "2027-01-01T00:00:00.000Z",
    };
    expect(Value.Check(ReserveObjectOperationRequestV1Schema, valid)).toBe(
      true,
    );
    expect(isReserveObjectOperationRequestV1(valid)).toBe(true);
    const putWithoutExpectedBytes = { ...valid } as Record<string, unknown>;
    delete putWithoutExpectedBytes.expected_digest;
    delete putWithoutExpectedBytes.expected_size_bytes;
    delete putWithoutExpectedBytes.media_type;
    expect(
      isReserveObjectOperationRequestV1(putWithoutExpectedBytes),
    ).toBe(false);
    expect(
      Value.Check(ReserveObjectOperationRequestV1Schema, {
        ...valid,
        scope: globalRowScope,
      }),
    ).toBe(false);
    expect(
      isReserveObjectOperationRequestV1({
        ...valid,
        gc_not_before: "2026-12-31T23:59:59.000Z",
      }),
    ).toBe(false);
    expect(
      Value.Check(ReserveObjectOperationRequestV1Schema, {
        ...valid,
        owner_state_version: Number.MAX_SAFE_INTEGER + 1,
      }),
    ).toBe(false);
  });

  it("requires exact generation and mutually exclusive actor fences", () => {
    const base = {
      ...putDurableIdentity,
      reservation_id: "reservation-1",
      expected_generation: 1,
    } as const;
    expect(
      Value.Check(StartObjectOperationAttemptRequestV1Schema, {
        ...base,
        actor: { actor_kind: "foreground", attempt_token: "attempt-token" },
      }),
    ).toBe(true);
    expect(
      Value.Check(StartObjectOperationAttemptRequestV1Schema, {
        ...base,
        actor: {
          actor_kind: "reconciler",
          claim_token: "claim-token",
          claim_generation: 2,
        },
      }),
    ).toBe(true);
    expect(
      Value.Check(StartObjectOperationAttemptRequestV1Schema, {
        ...base,
        actor: {
          actor_kind: "foreground",
          attempt_token: "attempt-token",
          claim_token: "claim-token",
        },
      }),
    ).toBe(false);
  });

  it("keeps commit-unknown and finalization tied to the same attempt", () => {
    const base = {
      ...putDurableIdentity,
      reservation_id: "reservation-1",
      attempt_id: "attempt-1",
      expected_generation: 1,
      actor: {
        actor_kind: "foreground",
        attempt_token: "attempt-token",
      },
    } as const;
    expect(
      Value.Check(MarkObjectOperationCommitUnknownRequestV1Schema, {
        ...base,
        provider_receipt_hash: hash,
      }),
    ).toBe(true);
    expect(
      Value.Check(FinalizeObjectOperationRequestV1Schema, {
        ...base,
        outcome: {
          operation: "put_immutable",
          proof_kind: "put_receipt",
          opaque_ref: objectRef,
          provider_receipt_hash: hash,
          physical_object_fingerprint: anotherHash,
          result_digest: hash,
          result_size_bytes: 1024,
          result_media_type: "application/json",
          proof_hash: anotherHash,
        },
      }),
    ).toBe(true);
    expect(
      isFinalizeObjectOperationRequestV1({
        ...base,
        outcome: {
          operation: "put_immutable",
          proof_kind: "put_receipt",
          opaque_ref: objectRef,
          provider_receipt_hash: hash,
          physical_object_fingerprint: anotherHash,
          result_digest: anotherHash,
          result_size_bytes: 1024,
          result_media_type: "application/json",
          proof_hash: anotherHash,
        },
      }),
    ).toBe(false);
    expect(
      isFinalizeObjectOperationRequestV1({
        ...base,
        outcome: {
          operation: "put_immutable",
          proof_kind: "terminal_failure",
          provider_receipt_hash: hash,
          provider_terminal_disposition: "rejected_before_commit",
          error: failure,
          proof_hash: anotherHash,
        },
      }),
    ).toBe(true);
    expect(
      isFinalizeObjectOperationRequestV1({
        ...base,
        outcome: {
          operation: "put_immutable",
          proof_kind: "terminal_failure",
          provider_terminal_disposition: "rejected_before_commit",
          error: failure,
          proof_hash: anotherHash,
        },
      }),
    ).toBe(false);
    expect(
      isFinalizeObjectOperationRequestV1({
        ...base,
        outcome: {
          operation: "delete_if_eligible",
          proof_kind: "delete_tombstone",
          provider_receipt_hash: hash,
          tombstone,
          proof_hash: anotherHash,
        },
      }),
    ).toBe(false);
  });

  it("bounds claims and fences every reconciliation settlement", () => {
    expect(
      Value.Check(ClaimExpiredObjectReconcileRequestV1Schema, {
        contract_version: "object_store_metadata.v1",
        worker_id: "worker-1",
        limit: 100,
        lease_seconds: 30,
      }),
    ).toBe(true);
    expect(
      Value.Check(ClaimExpiredObjectReconcileRequestV1Schema, {
        contract_version: "object_store_metadata.v1",
        worker_id: "worker-1",
        limit: 101,
        lease_seconds: 30,
      }),
    ).toBe(false);
    const claim = {
      ...putDurableIdentity,
      reservation_id: "reservation-1",
      claim_token: "claim-token",
      claim_generation: 2,
      claim_lease_expires_at: "2026-07-24T01:10:00.000Z",
      database_now: "2026-07-24T01:00:00.000Z",
      reservation_generation: 2,
    } as const;
    expect(Value.Check(ObjectReconcileClaimV1Schema, claim)).toBe(true);
    expect(
      isRenewObjectReconcileClaimRequestV1({
        ...putDurableIdentity,
        reservation_id: claim.reservation_id,
        claim_token: claim.claim_token,
        claim_generation: claim.claim_generation,
        expected_generation: claim.reservation_generation,
        expected_claim_lease_expires_at: claim.claim_lease_expires_at,
        lease_seconds: 30,
      }),
    ).toBe(true);
    expect(
      Value.Check(RenewObjectReconcileClaimRequestV1Schema, {
        ...putDurableIdentity,
        reservation_id: claim.reservation_id,
        claim_token: claim.claim_token,
        claim_generation: claim.claim_generation,
        expected_generation: claim.reservation_generation,
        expected_claim_lease_expires_at: claim.claim_lease_expires_at,
        lease_seconds: 0,
      }),
    ).toBe(false);
    expect(
      Value.Check(ObjectReconcileClaimV1Schema, {
        ...claim,
        operation: "delete_if_eligible",
        deletion_decision_version: null,
      }),
    ).toBe(false);
    expect(
      Value.Check(ObjectReconcileClaimV1Schema, {
        ...claim,
        operation: "delete_if_eligible",
        deletion_decision_version: 3,
      }),
    ).toBe(true);
    expect(
      Value.Check(SettleObjectReconcileRequestV1Schema, {
        ...putDurableIdentity,
        reservation_id: "reservation-1",
        operation: "delete_if_eligible",
        deletion_decision_version: 3,
        claim_token: "claim-token",
        claim_generation: 2,
        expected_generation: 2,
        settlement: {
          kind: "dlq",
          reason: "retry_exhausted",
          error: failure,
        },
      }),
    ).toBe(true);
    expect(
      isSettleObjectReconcileRequestV1({
        ...putDurableIdentity,
        reservation_id: "reservation-1",
        claim_token: "claim-token",
        claim_generation: 2,
        expected_generation: 2,
        settlement: {
          kind: "terminal",
          attempt_id: "attempt-2",
          outcome: {
            operation: "delete_if_eligible",
            proof_kind: "delete_tombstone",
            provider_receipt_hash: hash,
            tombstone,
            proof_hash: anotherHash,
          },
        },
      }),
    ).toBe(false);
  });

  it("partitions foreground result identity from reconciler claims", () => {
    expect(
      Value.Check(GetObjectOperationResultRequestV1Schema, {
        ...putDurableIdentity,
        caller_kind: "foreground",
      }),
    ).toBe(true);
    expect(
      Value.Check(GetObjectOperationResultRequestV1Schema, {
        ...putDurableIdentity,
        caller_kind: "foreground",
        owner_object_id: undefined,
      }),
    ).toBe(false);
    expect(
      Value.Check(GetObjectOperationResultRequestV1Schema, {
        ...putDurableIdentity,
        caller_kind: "reconciler",
        reservation_id: "reservation-1",
        claim_token: "claim-token",
        claim_generation: 2,
      }),
    ).toBe(true);
    expect(
      Value.Check(GetObjectOperationResultRequestV1Schema, {
        ...putDurableIdentity,
        caller_kind: "reconciler",
        reservation_id: "reservation-1",
        claim_token: "claim-token",
        claim_generation: 2,
        object_fingerprint: undefined,
      }),
    ).toBe(false);
  });

  it("does not expose a bucket, key, provider URL, or plaintext token", () => {
    const serialized = JSON.stringify(ObjectOperationResultV1Schema);
    for (const forbidden of [
      "bucket",
      "physical_key",
      "provider_url",
      "signed_url",
      "claim_token",
      "attempt_token",
      "foreground_lease_token",
    ]) {
      expect(serialized).not.toContain(`"${forbidden}"`);
    }
  });

  it("binds terminal result proof to reservation, operation, and payload", () => {
    const proof = terminalProof();
    const result = {
      ...putDurableIdentity,
      reservation_id: "reservation-1",
      status: "succeeded",
      generation: 1,
      opaque_ref: objectRef,
      result_digest: hash,
      result_size_bytes: 1024,
      terminal_proof: proof,
      commit_unknown_evidence: null,
      reconcile_settlement: null,
    };
    expect(isObjectOperationResultV1(result)).toBe(true);
    expect(
      isObjectOperationResultV1({
        ...result,
        reservation_id: "different-reservation",
      }),
    ).toBe(false);
    expect(
      isObjectOperationResultV1({
        ...result,
        result_digest: anotherHash,
      }),
    ).toBe(false);
    expect(
      isObjectOperationResultV1({
        ...result,
        expected_size_bytes: 2048,
      }),
    ).toBe(false);
    expect(
      isObjectOperationResultV1({
        ...result,
        media_type: "text/plain",
      }),
    ).toBe(false);
  });

  it("publishes all row and writer schemas from one versioned authority", () => {
    expect(OBJECT_STORE_METADATA_CONTRACT_V1).toMatchObject({
      contract_version: "object_store_metadata.v1",
      source: "packages/object-store/src/db/metadata-contract.v1.ts",
      fresh_migration: "0050_object_store",
    });
    expect(Object.keys(OBJECT_STORE_METADATA_CONTRACT_V1.writers)).toEqual([
      "reserve_object_operation_v1",
      "start_object_operation_attempt_v1",
      "mark_object_operation_commit_unknown_v1",
      "finalize_object_operation_v1",
      "claim_expired_object_reconcile_v1",
      "renew_object_reconcile_claim_v1",
      "settle_object_reconcile_v1",
      "get_object_operation_result_v1",
    ]);
    expect(Value.Check(ObjectReconcileJobV1Schema, reconcileJob())).toBe(true);
  });
});
