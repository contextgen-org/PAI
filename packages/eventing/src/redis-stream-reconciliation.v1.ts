import {
  assertOwnerDurableEventEnvelopeV1,
  DurableEventEnvelopeValidationErrorV1,
  isDurableEventTargetAllowedV1,
  isOwnerDurableEventTypeV1,
  type DurableEventEnvelopeV1,
  type ServiceIdV1,
} from "@pai/contracts";

import {
  canonicalPayloadHashV1,
  CanonicalJsonValidationErrorV1,
} from "./canonical-json.v1.js";
import {
  assertDurablePeriodicFullAuditGuardAckV1,
  assertDurablePeriodicFullAuditGuardRequestV1,
  assertActiveOwnerDurableEventContractV1,
  assertDurableSentOutboxPermanentFailureAckResultV1,
  DURABLE_EVENT_BATCH_MAX_V1,
  EventTransportErrorV1,
  immutableBoundedJsonSnapshotV1,
  OutboxClaimContractErrorV1,
  type DurableDeletedDeliveryReconciliationPortV1,
  type DurableEventTransportPortV1,
  type DurableEventTransportReceiptV1,
  type DurablePeriodicFullAuditGuardAckV1,
  type DurablePeriodicFullAuditGuardRequestV1,
  type DurableSentOutboxPermanentFailureAckV1,
  type DurableSentOutboxPermanentFailureAckResultV1,
} from "./durable-eventing.v1.js";

const sha256Pattern = /^sha256:[0-9a-f]{64}$/u;
const MAX_RECONCILIATION_IDENTITY_LENGTH_V1 = 256;
const MAX_RECONCILIATION_EPOCH_LENGTH_V1 = 128;
const MAX_RECONCILIATION_TRANSPORT_REF_LENGTH_V1 = 2_048;

function snapshotBoundedDenseArrayV1<T>(
  value: unknown,
  maxLength: number,
  label: string,
  snapshotEntry: (entry: unknown, index: number) => T,
): readonly T[] {
  if (!Array.isArray(value)) {
    throw new OutboxClaimContractErrorV1(`${label} must be an array`);
  }
  const length = Object.getOwnPropertyDescriptor(value, "length")?.value;
  if (
    !Number.isSafeInteger(length) ||
    (length as number) < 0 ||
    (length as number) > maxLength
  ) {
    throw new OutboxClaimContractErrorV1(`${label} exceeded its bounded batch`);
  }
  const snapshot: T[] = [];
  for (let index = 0; index < (length as number); index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new OutboxClaimContractErrorV1(
        `${label} must be dense and contain only data properties`,
      );
    }
    snapshot.push(snapshotEntry(descriptor.value, index));
  }
  if (Object.getOwnPropertyDescriptor(value, "length")?.value !== length) {
    throw new OutboxClaimContractErrorV1(
      `${label} changed while its snapshot was captured`,
    );
  }
  return Object.freeze(snapshot);
}

function snapshotOwnDataFieldsV1(
  value: unknown,
  fields: readonly string[],
  label: string,
  exact = false,
): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new OutboxClaimContractErrorV1(`${label} must be an object`);
  }
  if (exact) {
    const actualKeys = Object.keys(value).sort();
    const expectedKeys = [...fields].sort();
    if (
      actualKeys.length !== expectedKeys.length ||
      actualKeys.some((key, index) => key !== expectedKeys[index])
    ) {
      throw new OutboxClaimContractErrorV1(`${label} fields are not exact`);
    }
  }
  const snapshot: Record<string, unknown> = {};
  for (const field of fields) {
    const descriptor = Object.getOwnPropertyDescriptor(value, field);
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new OutboxClaimContractErrorV1(
        `${label}.${field} must be an own data property`,
      );
    }
    snapshot[field] = descriptor.value;
  }
  return Object.freeze(snapshot);
}

function immutableEnvelopeSnapshotOrPoisonV1(value: unknown): unknown {
  try {
    return immutableBoundedJsonSnapshotV1(value);
  } catch {
    return Object.freeze({});
  }
}

function canonicalIsoMillisecondsV1(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function exactPlainRecordV1(
  value: unknown,
  expectedKeys: readonly string[],
  label: string,
): Readonly<Record<string, unknown>> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  ) {
    throw new OutboxClaimContractErrorV1(`${label} must be a plain object`);
  }
  const keys = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (
    keys.length !== expected.length ||
    keys.some((key, index) => key !== expected[index])
  ) {
    throw new OutboxClaimContractErrorV1(`${label} fields are not exact`);
  }
  return snapshotOwnDataFieldsV1(value, expectedKeys, label, true);
}

function boundedIdentityV1(
  value: unknown,
  maxLength: number,
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maxLength
  );
}

function assertReconciliationClaimRequestV1(
  request: Parameters<
    DurableSentOutboxReconciliationStorePortV1["claimSentForReconciliation"]
  >[0],
): void {
  exactPlainRecordV1(
    request,
    [
      "current_transport_epoch",
      "current_transport_generation",
      "lease_seconds",
      "limit",
      "worker_id",
    ],
    "sent outbox reconciliation claim request",
  );
  if (
    !boundedIdentityV1(
      request.worker_id,
      MAX_RECONCILIATION_IDENTITY_LENGTH_V1,
    ) ||
    !Number.isSafeInteger(request.limit) ||
    request.limit < 1 ||
    request.limit > DURABLE_EVENT_BATCH_MAX_V1 ||
    !Number.isSafeInteger(request.lease_seconds) ||
    request.lease_seconds < 1 ||
    request.lease_seconds > 3_600 ||
    !boundedIdentityV1(
      request.current_transport_epoch,
      MAX_RECONCILIATION_EPOCH_LENGTH_V1,
    ) ||
    !Number.isSafeInteger(request.current_transport_generation) ||
    request.current_transport_generation < 1
  ) {
    throw new OutboxClaimContractErrorV1(
      "sent outbox reconciliation claim request is outside the bounded contract",
    );
  }
}

export type DurableSentOutboxReconciliationReasonV1 =
  | "generation_mismatch"
  | "reported_deleted"
  | "periodic_probe";

export interface ClaimedSentOutboxReconciliationRecordV1 {
  readonly outbox_id: unknown;
  readonly claim_token: unknown;
  readonly attempt_count: unknown;
  readonly target: unknown;
  readonly envelope: unknown;
  readonly payload_hash: unknown;
  readonly sent_at: unknown;
  readonly transport_ref: unknown;
  readonly transport_epoch: unknown;
  readonly transport_generation: unknown;
  readonly active_transport_epoch: unknown;
  readonly active_transport_generation: unknown;
  readonly reconciliation_reason: unknown;
}

const reconciliationClaimFieldsV1 = [
  "active_transport_epoch",
  "active_transport_generation",
  "attempt_count",
  "claim_token",
  "envelope",
  "outbox_id",
  "payload_hash",
  "reconciliation_reason",
  "sent_at",
  "target",
  "transport_epoch",
  "transport_generation",
  "transport_ref",
] as const;

function reconciliationRecordSnapshotV1(
  value: unknown,
): ClaimedSentOutboxReconciliationRecordV1 {
  const record = snapshotOwnDataFieldsV1(
    value,
    reconciliationClaimFieldsV1,
    "sent outbox reconciliation claim",
  );
  return Object.freeze({
    outbox_id: record.outbox_id,
    claim_token: record.claim_token,
    attempt_count: record.attempt_count,
    target: record.target,
    envelope: immutableEnvelopeSnapshotOrPoisonV1(record.envelope),
    payload_hash: record.payload_hash,
    sent_at: record.sent_at,
    transport_ref: record.transport_ref,
    transport_epoch: record.transport_epoch,
    transport_generation: record.transport_generation,
    active_transport_epoch: record.active_transport_epoch,
    active_transport_generation: record.active_transport_generation,
    reconciliation_reason: record.reconciliation_reason,
  });
}

function reconciliationBatchSnapshotV1(
  value: unknown,
  limit: number,
): readonly ClaimedSentOutboxReconciliationRecordV1[] {
  const records = snapshotBoundedDenseArrayV1(
    value,
    limit,
    "sent outbox reconciliation claim",
    (record) => reconciliationRecordSnapshotV1(record),
  );
  const outboxIds = new Set<string>();
  for (const record of records) {
    if (
      !boundedIdentityV1(
        record.outbox_id,
        MAX_RECONCILIATION_IDENTITY_LENGTH_V1,
      ) ||
      !boundedIdentityV1(
        record.claim_token,
        MAX_RECONCILIATION_IDENTITY_LENGTH_V1,
      ) ||
      outboxIds.has(record.outbox_id)
    ) {
      throw new OutboxClaimContractErrorV1(
        "sent outbox reconciliation claim identities must be bounded and outbox ids must be unique",
      );
    }
    outboxIds.add(record.outbox_id);
  }
  return records;
}

export interface DurableSentOutboxReconciliationStorePortV1
  extends DurableDeletedDeliveryReconciliationPortV1 {
  /**
   * Must durably lease old-generation, explicitly missing, and due-for-probe
   * sent rows. A persisted next_probe_at (or an equivalent durable cursor) is
   * required so every retained sent row is revisited after process restarts.
   * The PostgreSQL writer owns the claim/lease clock.
   */
  claimSentForReconciliation(request: Readonly<{
    worker_id: string;
    limit: number;
    lease_seconds: number;
    current_transport_epoch: string;
    current_transport_generation: number;
  }>): Promise<readonly ClaimedSentOutboxReconciliationRecordV1[]>;

  /**
   * CASes claim token + previous transport identity + active generation before
   * moving next_probe_at from PostgreSQL clock + probe_interval_ms. It must not
   * silently succeed when any fence differs.
   */
  acknowledgeTransportPresent(request: Readonly<{
    outbox_id: string;
    claim_token: string;
    previous_transport_ref: string;
    previous_transport_epoch: string;
    previous_transport_generation: number | null;
    current_transport_epoch: string;
    current_transport_generation: number;
    probe_interval_ms: number;
  }>): Promise<void>;

  /**
   * CASes claim token + previous transport identity + active generation before
   * installing a newly published receipt and clearing the missing marker.
   */
  acknowledgeRematerialized(request: Readonly<{
    outbox_id: string;
    claim_token: string;
    previous_transport_ref: string;
    previous_transport_epoch: string;
    previous_transport_generation: number | null;
    transport_ref: string;
    transport_epoch: string;
    transport_generation: number;
    current_transport_epoch: string;
    current_transport_generation: number;
    probe_interval_ms: number;
  }>): Promise<void>;

  /**
   * Claim/transport/generation-fenced terminalization. The owner row and an
   * audit/quarantine fact must be retained durably before this resolves.
   */
  acknowledgePermanentFailure(
    request: Readonly<DurableSentOutboxPermanentFailureAckV1>,
  ): Promise<DurableSentOutboxPermanentFailureAckResultV1>;
}

/**
 * Narrow adapter boundary for generated PostgreSQL owner writers. The
 * functions are expected to be SECURITY DEFINER writers registered in the
 * owner's verified repository contract; application code never receives raw
 * SQL or table mutation access.
 */
export interface PostgresEventingReconciliationFunctionsV1 {
  /** Raw SECURITY DEFINER result; the adapter rejects any non-exact ACK. */
  claimSentForReconciliation(
    request: Parameters<
      DurableSentOutboxReconciliationStorePortV1["claimSentForReconciliation"]
    >[0],
  ): Promise<readonly unknown[]>;
  recordDeletedTransportRefs(
    request: Parameters<
      DurableSentOutboxReconciliationStorePortV1["recordDeletedTransportRefs"]
    >[0],
  ): Promise<unknown>;
  verifyPeriodicFullAuditActive(
    request: Readonly<DurablePeriodicFullAuditGuardRequestV1>,
  ): Promise<unknown>;
  acknowledgeTransportPresent(
    request: Parameters<
      DurableSentOutboxReconciliationStorePortV1["acknowledgeTransportPresent"]
    >[0],
  ): Promise<unknown>;
  acknowledgeRematerialized(
    request: Parameters<
      DurableSentOutboxReconciliationStorePortV1["acknowledgeRematerialized"]
    >[0],
  ): Promise<unknown>;
  acknowledgePermanentFailure(
    request: Readonly<DurableSentOutboxPermanentFailureAckV1>,
  ): Promise<unknown>;
}

function nonNegativeSafeInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new OutboxClaimContractErrorV1(`${label} must be a non-negative integer`);
  }
  return value as number;
}

function deletedRecordResultV1(
  value: unknown,
  requested: number,
): Readonly<{ matched: number; already_missing: number }> {
  const result = exactPlainRecordV1(
    value,
    ["already_missing", "matched"],
    "deleted transport reference writer result",
  );
  const matched = nonNegativeSafeInteger(result.matched, "deleted ref matched");
  const alreadyMissing = nonNegativeSafeInteger(
    result.already_missing,
    "deleted ref already_missing",
  );
  if (matched + alreadyMissing !== requested) {
    throw new OutboxClaimContractErrorV1(
      "deleted transport reference writer did not atomically account for every requested reference",
    );
  }
  return Object.freeze({ matched, already_missing: alreadyMissing });
}

function assertReconciliationAckResultV1(value: unknown, label: string): void {
  const result = exactPlainRecordV1(value, ["acknowledged"], `${label} result`);
  if (result.acknowledged !== true) {
    throw new OutboxClaimContractErrorV1(
      `${label} writer did not confirm its fenced reconciliation CAS`,
    );
  }
}

function assertPermanentFailureAckRequestV1(
  request: Readonly<DurableSentOutboxPermanentFailureAckV1>,
): void {
  exactPlainRecordV1(
    request,
    [
      "claim_token",
      "current_transport_epoch",
      "current_transport_generation",
      "failure_code",
      "failure_message",
      "now",
      "outbox_id",
      "previous_transport_epoch",
      "previous_transport_generation",
      "previous_transport_ref",
    ],
    "permanent reconciliation failure ACK request",
  );
  if (
    !boundedIdentityV1(
      request.outbox_id,
      MAX_RECONCILIATION_IDENTITY_LENGTH_V1,
    ) ||
    !boundedIdentityV1(
      request.claim_token,
      MAX_RECONCILIATION_IDENTITY_LENGTH_V1,
    ) ||
    !boundedIdentityV1(
      request.previous_transport_ref,
      MAX_RECONCILIATION_TRANSPORT_REF_LENGTH_V1,
    ) ||
    !boundedIdentityV1(
      request.previous_transport_epoch,
      MAX_RECONCILIATION_EPOCH_LENGTH_V1,
    ) ||
    (request.previous_transport_generation !== null &&
      !Number.isSafeInteger(request.previous_transport_generation)) ||
    !boundedIdentityV1(
      request.current_transport_epoch,
      MAX_RECONCILIATION_EPOCH_LENGTH_V1,
    ) ||
    !Number.isSafeInteger(request.current_transport_generation) ||
    request.current_transport_generation < 1 ||
    typeof request.failure_code !== "string" ||
    !/^[a-z][a-z0-9_]{0,63}$/u.test(request.failure_code) ||
    typeof request.failure_message !== "string" ||
    request.failure_message.trim().length < 1 ||
    request.failure_message.length > 512 ||
    !canonicalIsoMillisecondsV1(request.now)
  ) {
    throw new OutboxClaimContractErrorV1(
      "permanent reconciliation failure ACK is outside the bounded fence contract",
    );
  }
}

type ReconciliationPresentAckRequestV1 = Parameters<
  DurableSentOutboxReconciliationStorePortV1["acknowledgeTransportPresent"]
>[0];
type ReconciliationRematerializedAckRequestV1 = Parameters<
  DurableSentOutboxReconciliationStorePortV1["acknowledgeRematerialized"]
>[0];

function assertReconciliationCommonAckRequestV1(
  request: ReconciliationPresentAckRequestV1,
): void {
  if (
    !boundedIdentityV1(
      request.outbox_id,
      MAX_RECONCILIATION_IDENTITY_LENGTH_V1,
    ) ||
    !boundedIdentityV1(
      request.claim_token,
      MAX_RECONCILIATION_IDENTITY_LENGTH_V1,
    ) ||
    !boundedIdentityV1(
      request.previous_transport_ref,
      MAX_RECONCILIATION_TRANSPORT_REF_LENGTH_V1,
    ) ||
    !boundedIdentityV1(
      request.previous_transport_epoch,
      MAX_RECONCILIATION_EPOCH_LENGTH_V1,
    ) ||
    (request.previous_transport_generation !== null &&
      (!Number.isSafeInteger(request.previous_transport_generation) ||
        request.previous_transport_generation < 1)) ||
    !boundedIdentityV1(
      request.current_transport_epoch,
      MAX_RECONCILIATION_EPOCH_LENGTH_V1,
    ) ||
    !Number.isSafeInteger(request.current_transport_generation) ||
    request.current_transport_generation < 1 ||
    !Number.isSafeInteger(request.probe_interval_ms) ||
    request.probe_interval_ms < 1_000 ||
    request.probe_interval_ms > 86_400_000
  ) {
    throw new OutboxClaimContractErrorV1(
      "reconciliation acknowledgment request is outside the bounded fence contract",
    );
  }
}

function assertReconciliationRematerializedAckRequestV1(
  request: ReconciliationRematerializedAckRequestV1,
): void {
  assertReconciliationCommonAckRequestV1(request);
  if (
    !boundedIdentityV1(
      request.transport_ref,
      MAX_RECONCILIATION_TRANSPORT_REF_LENGTH_V1,
    ) ||
    request.transport_epoch !== request.current_transport_epoch ||
    request.transport_generation !== request.current_transport_generation
  ) {
    throw new OutboxClaimContractErrorV1(
      "rematerialized receipt is outside the active transport fence",
    );
  }
}

/**
 * Executable runtime adapter over verified/generated PostgreSQL functions.
 * It validates the untrusted JSONB boundary before exposing the durable port.
 */
export function createPostgresSentOutboxReconciliationStoreV1(
  functions: PostgresEventingReconciliationFunctionsV1,
): DurableSentOutboxReconciliationStorePortV1 {
  const claimSentForReconciliation =
    functions.claimSentForReconciliation.bind(functions);
  const recordDeletedTransportRefs =
    functions.recordDeletedTransportRefs.bind(functions);
  const verifyPeriodicFullAuditActive =
    functions.verifyPeriodicFullAuditActive.bind(functions);
  const acknowledgeTransportPresent =
    functions.acknowledgeTransportPresent.bind(functions);
  const acknowledgeRematerialized =
    functions.acknowledgeRematerialized.bind(functions);
  const acknowledgePermanentFailure =
    functions.acknowledgePermanentFailure.bind(functions);
  return Object.freeze({
    async claimSentForReconciliation(
      request: Parameters<
        DurableSentOutboxReconciliationStorePortV1["claimSentForReconciliation"]
      >[0],
    ) {
      const claimRequest = exactPlainRecordV1(
        request,
        [
          "current_transport_epoch",
          "current_transport_generation",
          "lease_seconds",
          "limit",
          "worker_id",
        ],
        "sent outbox reconciliation claim request",
      ) as unknown as Parameters<
        DurableSentOutboxReconciliationStorePortV1["claimSentForReconciliation"]
      >[0];
      assertReconciliationClaimRequestV1(claimRequest);
      const rows = await claimSentForReconciliation(claimRequest);
      return snapshotBoundedDenseArrayV1(
        rows,
        claimRequest.limit,
        "sent outbox reconciliation claim",
        (row) => {
          snapshotOwnDataFieldsV1(
            row,
            reconciliationClaimFieldsV1,
            "sent outbox reconciliation claim",
            true,
          );
          return reconciliationRecordSnapshotV1(row);
        },
      );
    },
    async recordDeletedTransportRefs(
      request: Parameters<
        DurableSentOutboxReconciliationStorePortV1["recordDeletedTransportRefs"]
      >[0],
    ) {
      const requestFields = snapshotOwnDataFieldsV1(
        request,
        [
          "consumer_service",
          "observed_at",
          "observed_transport_epoch",
          "observed_transport_generation",
          "transport_refs",
        ],
        "deleted transport reference handoff request",
        true,
      );
      let transportRefs: readonly string[];
      try {
        transportRefs = snapshotBoundedDenseArrayV1(
          requestFields.transport_refs,
          DURABLE_EVENT_BATCH_MAX_V1,
          "deleted transport reference handoff refs",
          (entry) => entry,
        ) as readonly string[];
      } catch {
        throw new OutboxClaimContractErrorV1(
          "deleted transport reference handoff identity is invalid",
        );
      }
      const stableRequest = Object.freeze({
        consumer_service: requestFields.consumer_service,
        transport_refs: transportRefs,
        observed_transport_epoch: requestFields.observed_transport_epoch,
        observed_transport_generation:
          requestFields.observed_transport_generation,
        observed_at: requestFields.observed_at,
      }) as Parameters<
        DurableSentOutboxReconciliationStorePortV1["recordDeletedTransportRefs"]
      >[0];
      if (
        stableRequest.transport_refs.length === 0 ||
        new Set(stableRequest.transport_refs).size !==
          stableRequest.transport_refs.length ||
        !boundedIdentityV1(
          stableRequest.consumer_service,
          MAX_RECONCILIATION_IDENTITY_LENGTH_V1,
        ) ||
        stableRequest.transport_refs.some(
          (transportRef) =>
            !boundedIdentityV1(
              transportRef,
              MAX_RECONCILIATION_TRANSPORT_REF_LENGTH_V1,
            ),
        ) ||
        !boundedIdentityV1(
          stableRequest.observed_transport_epoch,
          MAX_RECONCILIATION_EPOCH_LENGTH_V1,
        ) ||
        !Number.isSafeInteger(stableRequest.observed_transport_generation) ||
        stableRequest.observed_transport_generation < 1 ||
        !canonicalIsoMillisecondsV1(stableRequest.observed_at)
      ) {
        throw new OutboxClaimContractErrorV1(
          "deleted transport reference handoff identity is invalid",
        );
      }
      const value = await recordDeletedTransportRefs(stableRequest);
      return deletedRecordResultV1(value, stableRequest.transport_refs.length);
    },
    async verifyPeriodicFullAuditActive(
      request: Readonly<DurablePeriodicFullAuditGuardRequestV1>,
    ) {
      const stableRequest = exactPlainRecordV1(
        request,
        [
          "consumer_service",
          "coverage_fingerprint",
          "request_id",
          "required_remaining_ms",
          "transport_epoch",
          "transport_generation",
        ],
        "periodic full-audit guard request",
      ) as unknown as DurablePeriodicFullAuditGuardRequestV1;
      assertDurablePeriodicFullAuditGuardRequestV1(stableRequest);
      const value = snapshotOwnDataFieldsV1(
        await verifyPeriodicFullAuditActive(stableRequest),
        [
          "acknowledged",
          "audit_fence",
          "checked_at",
          "consumer_service",
          "coverage_fingerprint",
          "expires_at",
          "heartbeat_at",
          "last_full_pass_completed_at",
          "request_id",
          "status",
          "transport_epoch",
          "transport_generation",
        ],
        "periodic full-audit guard ACK",
        true,
      ) as unknown as DurablePeriodicFullAuditGuardAckV1;
      assertDurablePeriodicFullAuditGuardAckV1(value, stableRequest, {
        max_heartbeat_age_ms: 60_000,
        max_full_audit_lag_ms: 3_600_000,
      });
      return Object.freeze({ ...value });
    },
    async acknowledgeTransportPresent(
      request: Parameters<
        DurableSentOutboxReconciliationStorePortV1["acknowledgeTransportPresent"]
      >[0],
    ) {
      const stableRequest = exactPlainRecordV1(
        request,
        [
          "claim_token",
          "current_transport_epoch",
          "current_transport_generation",
          "outbox_id",
          "previous_transport_epoch",
          "previous_transport_generation",
          "previous_transport_ref",
          "probe_interval_ms",
        ],
        "transport present acknowledgment request",
      ) as unknown as Parameters<
        DurableSentOutboxReconciliationStorePortV1["acknowledgeTransportPresent"]
      >[0];
      assertReconciliationCommonAckRequestV1(stableRequest);
      const value = snapshotOwnDataFieldsV1(
        await acknowledgeTransportPresent(stableRequest),
        ["acknowledged"],
        "transport present acknowledgment result",
        true,
      );
      assertReconciliationAckResultV1(value, "transport present acknowledgment");
    },
    async acknowledgeRematerialized(
      request: Parameters<
        DurableSentOutboxReconciliationStorePortV1["acknowledgeRematerialized"]
      >[0],
    ) {
      const stableRequest = exactPlainRecordV1(
        request,
        [
          "claim_token",
          "current_transport_epoch",
          "current_transport_generation",
          "outbox_id",
          "previous_transport_epoch",
          "previous_transport_generation",
          "previous_transport_ref",
          "probe_interval_ms",
          "transport_epoch",
          "transport_generation",
          "transport_ref",
        ],
        "rematerialization acknowledgment request",
      ) as unknown as Parameters<
        DurableSentOutboxReconciliationStorePortV1["acknowledgeRematerialized"]
      >[0];
      assertReconciliationRematerializedAckRequestV1(stableRequest);
      const value = snapshotOwnDataFieldsV1(
        await acknowledgeRematerialized(stableRequest),
        ["acknowledged"],
        "rematerialization acknowledgment result",
        true,
      );
      assertReconciliationAckResultV1(value, "rematerialization acknowledgment");
    },
    async acknowledgePermanentFailure(
      request: Readonly<DurableSentOutboxPermanentFailureAckV1>,
    ) {
      const stableRequest = exactPlainRecordV1(
        request,
        [
          "claim_token",
          "current_transport_epoch",
          "current_transport_generation",
          "failure_code",
          "failure_message",
          "now",
          "outbox_id",
          "previous_transport_epoch",
          "previous_transport_generation",
          "previous_transport_ref",
        ],
        "permanent reconciliation failure ACK request",
      ) as unknown as DurableSentOutboxPermanentFailureAckV1;
      assertPermanentFailureAckRequestV1(stableRequest);
      const rawValue = await acknowledgePermanentFailure(stableRequest);
      let value: DurableSentOutboxPermanentFailureAckResultV1;
      try {
        value = snapshotOwnDataFieldsV1(
          rawValue,
          ["acknowledged", "status"],
          "permanent failure acknowledgment result",
          true,
        ) as unknown as DurableSentOutboxPermanentFailureAckResultV1;
      } catch {
        throw new OutboxClaimContractErrorV1(
          "permanent sent-outbox failure did not receive an exact fenced quarantine ACK",
        );
      }
      assertDurableSentOutboxPermanentFailureAckResultV1(value);
      return Object.freeze({ ...value });
    },
  });
}

export interface DurableEventTransportReferenceProbePortV1 {
  probe(request: Readonly<{
    target: string;
    transport_ref: string;
    expected_envelope: DurableEventEnvelopeV1;
    expected_payload_hash: string;
  }>): Promise<Readonly<{ status: "present" | "missing" | "mismatched" }>>;
}

export interface DurableSentOutboxReconciliationSummaryV1 {
  readonly claimed: number;
  readonly probed: number;
  readonly present: number;
  readonly missing: number;
  readonly rematerialized: number;
  readonly retryable_failures: number;
  readonly permanent_failures: number;
}

interface ValidReconciliationRecordV1 {
  readonly outbox_id: string;
  readonly claim_token: string;
  readonly target: string;
  readonly envelope: DurableEventEnvelopeV1;
  readonly payload_hash: string;
  readonly transport_ref: string;
  readonly transport_epoch: string;
  readonly transport_generation: number | null;
  readonly reconciliation_reason: DurableSentOutboxReconciliationReasonV1;
}

function validReconciliationRecordV1(
  value: ClaimedSentOutboxReconciliationRecordV1,
  ownerService: ServiceIdV1,
  currentEpoch: string,
  currentGeneration: number,
): ValidReconciliationRecordV1 {
  assertOwnerDurableEventEnvelopeV1(value.envelope);
  const reason = value.reconciliation_reason;
  if (
    !boundedIdentityV1(
      value.outbox_id,
      MAX_RECONCILIATION_IDENTITY_LENGTH_V1,
    ) ||
    !boundedIdentityV1(
      value.claim_token,
      MAX_RECONCILIATION_IDENTITY_LENGTH_V1,
    ) ||
    !Number.isSafeInteger(value.attempt_count) ||
    (value.attempt_count as number) < 1 ||
    typeof value.target !== "string" ||
    value.target.trim().length === 0 ||
    typeof value.payload_hash !== "string" ||
    !sha256Pattern.test(value.payload_hash) ||
    typeof value.sent_at !== "string" ||
    value.sent_at.length > 64 ||
    !Number.isFinite(Date.parse(value.sent_at)) ||
    !boundedIdentityV1(
      value.transport_ref,
      MAX_RECONCILIATION_TRANSPORT_REF_LENGTH_V1,
    ) ||
    !boundedIdentityV1(
      value.transport_epoch,
      MAX_RECONCILIATION_EPOCH_LENGTH_V1,
    ) ||
    (value.transport_generation !== null &&
      (!Number.isSafeInteger(value.transport_generation) ||
        (value.transport_generation as number) < 1)) ||
    value.active_transport_epoch !== currentEpoch ||
    value.active_transport_generation !== currentGeneration ||
    (reason !== "generation_mismatch" &&
      reason !== "reported_deleted" &&
      reason !== "periodic_probe") ||
    value.envelope.producer !== ownerService ||
    !isOwnerDurableEventTypeV1(
      value.envelope.producer,
      value.envelope.event_type,
    ) ||
    !isDurableEventTargetAllowedV1(value.envelope, value.target) ||
    canonicalPayloadHashV1(value.envelope.payload) !== value.payload_hash
  ) {
    throw new OutboxClaimContractErrorV1(
      "sent outbox reconciliation claim is outside the retained owner contract",
    );
  }
  const currentIdentity =
    value.transport_epoch === currentEpoch &&
    value.transport_generation === currentGeneration;
  if (
    (reason === "generation_mismatch" && currentIdentity) ||
    (reason === "periodic_probe" && !currentIdentity)
  ) {
    throw new OutboxClaimContractErrorV1(
      "sent outbox reconciliation reason contradicts its transport identity",
    );
  }
  return {
    outbox_id: value.outbox_id,
    claim_token: value.claim_token,
    target: value.target,
    envelope: value.envelope,
    payload_hash: value.payload_hash,
    transport_ref: value.transport_ref,
    transport_epoch: value.transport_epoch,
    transport_generation: value.transport_generation as number | null,
    reconciliation_reason: reason,
  };
}

function assertReceiptV1(
  receipt: DurableEventTransportReceiptV1,
  expectedEpoch: string,
  expectedGeneration: number,
): void {
  if (
    typeof receipt !== "object" ||
    receipt === null ||
    Array.isArray(receipt) ||
    (Object.getPrototypeOf(receipt) !== Object.prototype &&
      Object.getPrototypeOf(receipt) !== null) ||
    Object.keys(receipt).length !== 3 ||
    !Object.prototype.hasOwnProperty.call(receipt, "transport_ref") ||
    !Object.prototype.hasOwnProperty.call(receipt, "transport_epoch") ||
    !Object.prototype.hasOwnProperty.call(receipt, "transport_generation") ||
    typeof receipt.transport_ref !== "string" ||
    receipt.transport_ref.trim().length === 0 ||
    receipt.transport_ref.length > MAX_RECONCILIATION_TRANSPORT_REF_LENGTH_V1 ||
    receipt.transport_epoch !== expectedEpoch ||
    receipt.transport_generation !== expectedGeneration
  ) {
    throw new EventTransportErrorV1(
      "transport_rejected",
      false,
      "reconciliation transport receipt identity is invalid",
    );
  }
}

function transportReceiptSnapshotV1(
  value: unknown,
): DurableEventTransportReceiptV1 {
  const receipt = snapshotOwnDataFieldsV1(
    value,
    ["transport_ref", "transport_epoch", "transport_generation"],
    "reconciliation transport receipt",
    true,
  );
  return Object.freeze({ ...receipt }) as unknown as DurableEventTransportReceiptV1;
}

function transportProbeStatusSnapshotV1(
  value: unknown,
): "present" | "missing" | "mismatched" {
  const result = snapshotOwnDataFieldsV1(
    value,
    ["status"],
    "transport reference probe result",
    true,
  );
  if (
    result.status !== "present" &&
    result.status !== "missing" &&
    result.status !== "mismatched"
  ) {
    throw new OutboxClaimContractErrorV1(
      "transport reference probe returned an invalid result",
    );
  }
  return result.status;
}

function permanentFailureAckV1(
  record: ClaimedSentOutboxReconciliationRecordV1,
  currentEpoch: string,
  currentGeneration: number,
  failureCode: string,
  error: unknown,
  now: string,
): DurableSentOutboxPermanentFailureAckV1 {
  if (
    typeof record.outbox_id !== "string" ||
    record.outbox_id.trim().length === 0 ||
    typeof record.claim_token !== "string" ||
    record.claim_token.trim().length === 0 ||
    typeof record.transport_ref !== "string" ||
    record.transport_ref.trim().length === 0 ||
    typeof record.transport_epoch !== "string" ||
    record.transport_epoch.trim().length === 0 ||
    (record.transport_generation !== null &&
      !Number.isSafeInteger(record.transport_generation)) ||
    record.active_transport_epoch !== currentEpoch ||
    record.active_transport_generation !== currentGeneration
  ) {
    throw new OutboxClaimContractErrorV1(
      "permanent reconciliation failure cannot be fenced to its claimed transport identity",
    );
  }
  const rawMessage = error instanceof Error ? error.message.trim() : "";
  return Object.freeze({
    outbox_id: record.outbox_id,
    claim_token: record.claim_token,
    previous_transport_ref: record.transport_ref,
    previous_transport_epoch: record.transport_epoch,
    previous_transport_generation:
      record.transport_generation === null
        ? null
        : (record.transport_generation as number),
    current_transport_epoch: currentEpoch,
    current_transport_generation: currentGeneration,
    failure_code: failureCode,
    failure_message: (rawMessage.length === 0 ? failureCode : rawMessage).slice(
      0,
      512,
    ),
    now,
  });
}

export function createDurableSentOutboxReconcilerV1(
  store: DurableSentOutboxReconciliationStorePortV1,
  probe: DurableEventTransportReferenceProbePortV1,
  transport: DurableEventTransportPortV1,
  config: Readonly<{
    owner_service: ServiceIdV1;
    worker_id: string;
    batch_size: number;
    lease_seconds: number;
    probe_interval_ms: number;
    current_transport_epoch: string;
    current_transport_generation: number;
  }>,
  dependencies: Readonly<{ now?: () => Date }> = {},
): Readonly<{
  reconcileBatch: () => Promise<DurableSentOutboxReconciliationSummaryV1>;
}> {
  const reconcilerConfig = exactPlainRecordV1(
    config,
    [
      "batch_size",
      "current_transport_epoch",
      "current_transport_generation",
      "lease_seconds",
      "owner_service",
      "probe_interval_ms",
      "worker_id",
    ],
    "sent outbox reconciliation configuration",
  ) as unknown as typeof config;
  assertActiveOwnerDurableEventContractV1(reconcilerConfig.owner_service);
  if (
    !boundedIdentityV1(
      reconcilerConfig.worker_id,
      MAX_RECONCILIATION_IDENTITY_LENGTH_V1,
    ) ||
    !boundedIdentityV1(
      reconcilerConfig.current_transport_epoch,
      MAX_RECONCILIATION_EPOCH_LENGTH_V1,
    ) ||
    !Number.isSafeInteger(reconcilerConfig.batch_size) ||
    reconcilerConfig.batch_size < 1 ||
    reconcilerConfig.batch_size > DURABLE_EVENT_BATCH_MAX_V1 ||
    !Number.isSafeInteger(reconcilerConfig.lease_seconds) ||
    reconcilerConfig.lease_seconds < 1 ||
    reconcilerConfig.lease_seconds > 3_600 ||
    !Number.isSafeInteger(reconcilerConfig.probe_interval_ms) ||
    reconcilerConfig.probe_interval_ms < 1_000 ||
    reconcilerConfig.probe_interval_ms > 86_400_000 ||
    !Number.isSafeInteger(reconcilerConfig.current_transport_generation) ||
    reconcilerConfig.current_transport_generation < 1
  ) {
    throw new Error("invalid sent outbox reconciliation configuration");
  }
  const now = dependencies.now ?? (() => new Date());
  const claimSentForReconciliation =
    store.claimSentForReconciliation.bind(store);
  const acknowledgeTransportPresent =
    store.acknowledgeTransportPresent.bind(store);
  const acknowledgeRematerialized =
    store.acknowledgeRematerialized.bind(store);
  const acknowledgePermanentFailure =
    store.acknowledgePermanentFailure.bind(store);
  const probeTransportReference = probe.probe.bind(probe);
  const publish = transport.publish.bind(transport);
  return Object.freeze({
    async reconcileBatch() {
      const claimedRecords = await claimSentForReconciliation({
        worker_id: reconcilerConfig.worker_id,
        limit: reconcilerConfig.batch_size,
        lease_seconds: reconcilerConfig.lease_seconds,
        current_transport_epoch: reconcilerConfig.current_transport_epoch,
        current_transport_generation:
          reconcilerConfig.current_transport_generation,
      });
      const records = reconciliationBatchSnapshotV1(
        claimedRecords,
        reconcilerConfig.batch_size,
      );
      let probed = 0;
      let present = 0;
      let missing = 0;
      let rematerialized = 0;
      let retryableFailures = 0;
      let permanentFailures = 0;
      for (const rawRecord of records) {
        let record: ValidReconciliationRecordV1;
        try {
          record = validReconciliationRecordV1(
            rawRecord,
            reconcilerConfig.owner_service,
            reconcilerConfig.current_transport_epoch,
            reconcilerConfig.current_transport_generation,
          );
        } catch (error) {
          try {
            const quarantineAck = snapshotOwnDataFieldsV1(
              await acknowledgePermanentFailure(permanentFailureAckV1(
                rawRecord,
                reconcilerConfig.current_transport_epoch,
                reconcilerConfig.current_transport_generation,
                "outbox_contract_violation",
                error,
                now().toISOString(),
              )),
              ["acknowledged", "status"],
              "permanent reconciliation failure ACK",
              true,
            ) as unknown as DurableSentOutboxPermanentFailureAckResultV1;
            assertDurableSentOutboxPermanentFailureAckResultV1(quarantineAck);
            permanentFailures += 1;
          } catch {
            // An invalid row is terminal only after its exact, claim-fenced
            // quarantine commit is confirmed.
            retryableFailures += 1;
          }
          continue;
        }
        try {
          let shouldRematerialize =
            record.reconciliation_reason !== "periodic_probe";
          if (!shouldRematerialize) {
            const probeStatus = transportProbeStatusSnapshotV1(
              await probeTransportReference({
                target: record.target,
                transport_ref: record.transport_ref,
                expected_envelope: record.envelope,
                expected_payload_hash: record.payload_hash,
              }),
            );
            probed += 1;
            if (probeStatus === "present") {
              present += 1;
              await acknowledgeTransportPresent({
                outbox_id: record.outbox_id,
                claim_token: record.claim_token,
                previous_transport_ref: record.transport_ref,
                previous_transport_epoch: record.transport_epoch,
                previous_transport_generation: record.transport_generation,
                current_transport_epoch:
                  reconcilerConfig.current_transport_epoch,
                current_transport_generation:
                  reconcilerConfig.current_transport_generation,
                probe_interval_ms: reconcilerConfig.probe_interval_ms,
              });
              continue;
            }
            missing += 1;
            shouldRematerialize = true;
          }
          if (shouldRematerialize) {
            const receipt = transportReceiptSnapshotV1(
              await publish({
                target: record.target,
                envelope: record.envelope,
                payload_hash: record.payload_hash,
                current_transport_epoch:
                  reconcilerConfig.current_transport_epoch,
                current_transport_generation:
                  reconcilerConfig.current_transport_generation,
              }),
            );
            assertReceiptV1(
              receipt,
              reconcilerConfig.current_transport_epoch,
              reconcilerConfig.current_transport_generation,
            );
            await acknowledgeRematerialized({
              outbox_id: record.outbox_id,
              claim_token: record.claim_token,
              previous_transport_ref: record.transport_ref,
              previous_transport_epoch: record.transport_epoch,
              previous_transport_generation: record.transport_generation,
              transport_ref: receipt.transport_ref,
              transport_epoch: receipt.transport_epoch,
              transport_generation: receipt.transport_generation,
              current_transport_epoch: reconcilerConfig.current_transport_epoch,
              current_transport_generation:
                reconcilerConfig.current_transport_generation,
              probe_interval_ms: reconcilerConfig.probe_interval_ms,
            });
            rematerialized += 1;
          }
        } catch {
          // Probe, publish, receipt, clock, and PostgreSQL ACK failures are
          // operational/commit-ambiguous. They cannot prove that a valid owner
          // row is poison and therefore must never terminalize it.
          retryableFailures += 1;
        }
      }
      return {
        claimed: records.length,
        probed,
        present,
        missing,
        rematerialized,
        retryable_failures: retryableFailures,
        permanent_failures: permanentFailures,
      };
    },
  });
}
