import { randomUUID } from "node:crypto";

import type { ServiceIdV1 } from "@pai/contracts";

import type {
  ObjectRefV1,
  ObjectScopeV1,
} from "./object-store-port.v1.js";

export type ObjectMetadataStateV1 =
  | "put_pending"
  | "available"
  | "delete_pending"
  | "deleted";

export interface ObjectMetadataRecordV1 {
  readonly object_ref: ObjectRefV1;
  readonly owner_service: ServiceIdV1;
  readonly object_class: string;
  readonly scope: ObjectScopeV1;
  readonly scope_fingerprint: string;
  readonly idempotency_key: string;
  readonly request_fingerprint: string;
  readonly version: string;
  readonly sha256: string;
  readonly size_bytes: number;
  readonly media_type: string;
  readonly retention_until: string;
  readonly state: ObjectMetadataStateV1;
  readonly legal_hold: boolean;
  readonly deletion_decision_version?: string;
  readonly deletion_idempotency_key?: string;
}

export interface ReservePutInputV1 {
  readonly owner_service: ServiceIdV1;
  readonly object_class: string;
  readonly scope: ObjectScopeV1;
  readonly scope_fingerprint: string;
  readonly idempotency_key: string;
  readonly request_fingerprint: string;
  readonly sha256: string;
  readonly size_bytes: number;
  readonly media_type: string;
  readonly retention_until: string;
  readonly now: Date;
  readonly foreground_lease_until: Date;
}

export type ReservePutResultV1 =
  | {
      readonly kind: "claimed";
      readonly reservation_id: string;
      readonly object_ref: ObjectRefV1;
      readonly foreground_lease_token: string;
    }
  | { readonly kind: "replay"; readonly record: ObjectMetadataRecordV1 }
  | { readonly kind: "conflict" }
  | { readonly kind: "pending"; readonly reservation_id: string }
  | { readonly kind: "busy" };

export interface CompletePutInputV1 {
  readonly reservation_id: string;
  readonly foreground_lease_token: string;
  readonly version: string;
}

export interface RenewPutForegroundLeaseInputV1 {
  readonly reservation_id: string;
  readonly foreground_lease_token: string;
  readonly now: Date;
  readonly foreground_lease_until: Date;
}

export type PutFinalizationV1 =
  | { readonly kind: "pending"; readonly object_ref: ObjectRefV1 }
  | { readonly kind: "committed"; readonly record: ObjectMetadataRecordV1 }
  | { readonly kind: "aborted_or_unknown" };

export type DeleteFinalizationV1 =
  | { readonly kind: "pending"; readonly object_ref: ObjectRefV1 }
  | { readonly kind: "committed"; readonly record: ObjectMetadataRecordV1 }
  | { readonly kind: "aborted_or_unknown" };

export interface ReserveDeleteInputV1 {
  readonly object_ref: ObjectRefV1;
  readonly deletion_decision_version: string;
  readonly idempotency_key: string;
  readonly now: Date;
}

export type ReserveDeleteResultV1 =
  | { readonly kind: "claimed"; readonly reservation_id: string }
  | { readonly kind: "replay"; readonly record: ObjectMetadataRecordV1 }
  | { readonly kind: "retention_active"; readonly retention_until: string }
  | { readonly kind: "hold_active" }
  | { readonly kind: "conflict" }
  | { readonly kind: "pending"; readonly reservation_id: string }
  | { readonly kind: "busy" }
  | { readonly kind: "not_found" };

export type ObjectReconciliationOperationV1 =
  | "put_finalize"
  | "put_cleanup"
  | "delete_finalize";

export interface ObjectReconciliationClaimV1 {
  readonly reservation_id: string;
  readonly claim_token: string;
  readonly operation: ObjectReconciliationOperationV1;
  readonly record: ObjectMetadataRecordV1;
  readonly attempt: number;
  readonly foreground_lease_expired: boolean;
}

export interface ClaimObjectReconciliationInputV1 {
  readonly worker_id: string;
  readonly now: Date;
  readonly locked_until: Date;
  readonly limit: number;
  readonly reservation_id?: string;
}

export interface CompleteObjectReconciliationInputV1 {
  readonly reservation_id: string;
  readonly claim_token: string;
  readonly version?: string;
}

export interface ReleaseObjectReconciliationInputV1 {
  readonly reservation_id: string;
  readonly claim_token: string;
  readonly last_error: string;
  readonly next_retry_at: Date;
}

export interface RedirectObjectReconciliationInputV1 {
  readonly reservation_id: string;
  readonly claim_token: string;
  readonly operation: "put_cleanup";
  readonly last_error: string;
  readonly next_retry_at?: Date;
}

/**
 * Implementations live in each owner schema. They must make every reserve/commit
 * transition atomic and never persist a bucket, physical key, or signed URL.
 */
export interface ObjectMetadataRepositoryV1 {
  reservePut(input: ReservePutInputV1): Promise<ReservePutResultV1>;
  renewPutForegroundLease(input: RenewPutForegroundLeaseInputV1): Promise<void>;
  completePut(input: CompletePutInputV1): Promise<ObjectMetadataRecordV1>;
  findPutFinalization(reservationId: string): Promise<PutFinalizationV1>;
  abortPut(reservationId: string, foregroundLeaseToken: string): Promise<void>;
  findByRef(objectRef: ObjectRefV1): Promise<ObjectMetadataRecordV1 | undefined>;
  reserveDelete(input: ReserveDeleteInputV1): Promise<ReserveDeleteResultV1>;
  completeDelete(reservationId: string): Promise<ObjectMetadataRecordV1>;
  findDeleteFinalization(reservationId: string): Promise<DeleteFinalizationV1>;
  abortDelete(reservationId: string): Promise<void>;
  handoffPutReconciliation(
    reservationId: string,
    operation: "put_finalize" | "put_cleanup",
    foregroundLeaseToken: string,
    notBefore?: Date,
  ): Promise<void>;
  handoffDeleteReconciliation(reservationId: string): Promise<void>;
  claimReconciliation(
    input: ClaimObjectReconciliationInputV1,
  ): Promise<readonly ObjectReconciliationClaimV1[]>;
  completeReconciliation(
    input: CompleteObjectReconciliationInputV1,
  ): Promise<ObjectMetadataRecordV1 | undefined>;
  releaseReconciliation(
    input: ReleaseObjectReconciliationInputV1,
  ): Promise<void>;
  redirectReconciliation(
    input: RedirectObjectReconciliationInputV1,
  ): Promise<void>;
}

interface ReconciliationLease {
  operation: ObjectReconciliationOperationV1 | "put_uploading";
  claimToken?: string;
  lockedUntil?: Date;
  attempt: number;
  nextRetryAt?: Date;
  lastError?: string;
}

interface PendingPut extends ReconciliationLease {
  readonly reservationId: string;
  readonly identityKey: string;
  readonly record: ObjectMetadataRecordV1;
  foregroundLeaseToken?: string;
  foregroundLeaseUntil: Date;
}

interface PendingDelete extends ReconciliationLease {
  readonly reservationId: string;
  readonly objectRef: ObjectRefV1;
  readonly previous: ObjectMetadataRecordV1;
  readonly deletionDecisionVersion: string;
  readonly idempotencyKey: string;
}

function putIdentity(input: ReservePutInputV1): string {
  return JSON.stringify([
    input.owner_service,
    input.object_class,
    input.scope_fingerprint,
    input.idempotency_key,
  ]);
}

/** Test/dev fake; production owners provide a transactional Postgres adapter. */
export class InMemoryObjectMetadataRepositoryV1
  implements ObjectMetadataRepositoryV1
{
  readonly #records = new Map<ObjectRefV1, ObjectMetadataRecordV1>();
  readonly #identityToRef = new Map<string, ObjectRefV1>();
  readonly #pendingPuts = new Map<string, PendingPut>();
  readonly #pendingDeletes = new Map<string, PendingDelete>();
  readonly #completedPuts = new Map<string, ObjectMetadataRecordV1>();
  readonly #completedDeletes = new Map<string, ObjectMetadataRecordV1>();

  public async reservePut(
    input: ReservePutInputV1,
  ): Promise<ReservePutResultV1> {
    if (
      !Number.isFinite(input.now.getTime()) ||
      !Number.isFinite(input.foreground_lease_until.getTime()) ||
      input.foreground_lease_until <= input.now
    ) {
      throw new Error("put foreground lease must end after reservation time");
    }
    const identityKey = putIdentity(input);
    const existingRef = this.#identityToRef.get(identityKey);
    if (existingRef !== undefined) {
      const existing = this.#records.get(existingRef);
      if (existing === undefined) return { kind: "busy" };
      if (existing.request_fingerprint !== input.request_fingerprint) {
        return { kind: "conflict" };
      }
      if (existing.state === "available") {
        return { kind: "replay", record: existing };
      }
      const pending = [...this.#pendingPuts.values()].find(
        ({ record }) => record.object_ref === existing.object_ref,
      );
      if (pending !== undefined) {
        return { kind: "pending", reservation_id: pending.reservationId };
      }
      return { kind: "busy" };
    }

    const reservationId = randomUUID();
    const foregroundLeaseToken = randomUUID();
    const objectRef = `objv1_${randomUUID().replaceAll("-", "")}` as ObjectRefV1;
    const record: ObjectMetadataRecordV1 = {
      object_ref: objectRef,
      owner_service: input.owner_service,
      object_class: input.object_class,
      scope: input.scope,
      scope_fingerprint: input.scope_fingerprint,
      idempotency_key: input.idempotency_key,
      request_fingerprint: input.request_fingerprint,
      version: "pending",
      sha256: input.sha256,
      size_bytes: input.size_bytes,
      media_type: input.media_type,
      retention_until: input.retention_until,
      state: "put_pending",
      legal_hold: false,
    };
    this.#identityToRef.set(identityKey, objectRef);
    this.#records.set(objectRef, record);
    this.#pendingPuts.set(reservationId, {
      reservationId,
      identityKey,
      record,
      operation: "put_uploading",
      foregroundLeaseToken,
      foregroundLeaseUntil: input.foreground_lease_until,
      attempt: 0,
    });
    return {
      kind: "claimed",
      reservation_id: reservationId,
      object_ref: objectRef,
      foreground_lease_token: foregroundLeaseToken,
    };
  }

  public async renewPutForegroundLease(
    input: RenewPutForegroundLeaseInputV1,
  ): Promise<void> {
    const pending = this.#pendingPuts.get(input.reservation_id);
    if (
      pending === undefined ||
      pending.operation !== "put_uploading" ||
      pending.foregroundLeaseToken !== input.foreground_lease_token ||
      pending.foregroundLeaseUntil <= input.now ||
      input.foreground_lease_until <= input.now
    ) {
      throw new Error("stale put foreground lease");
    }
    if (input.foreground_lease_until > pending.foregroundLeaseUntil) {
      pending.foregroundLeaseUntil = input.foreground_lease_until;
    }
  }

  public async completePut(
    input: CompletePutInputV1,
  ): Promise<ObjectMetadataRecordV1> {
    const pending = this.#pendingPuts.get(input.reservation_id);
    if (pending === undefined) {
      const completed = this.#completedPuts.get(input.reservation_id);
      if (completed !== undefined && completed.version === input.version) {
        return completed;
      }
      throw new Error("unknown put reservation");
    }
    if (
      pending.foregroundLeaseToken !== input.foreground_lease_token ||
      pending.claimToken !== undefined ||
      (pending.operation !== "put_uploading" &&
        pending.operation !== "put_finalize")
    ) {
      throw new Error("stale put foreground lease");
    }
    const completed: ObjectMetadataRecordV1 = {
      ...pending.record,
      version: input.version,
      state: "available",
    };
    this.#records.set(completed.object_ref, completed);
    this.#pendingPuts.delete(input.reservation_id);
    this.#completedPuts.set(input.reservation_id, completed);
    return completed;
  }

  public async findPutFinalization(
    reservationId: string,
  ): Promise<PutFinalizationV1> {
    const completed = this.#completedPuts.get(reservationId);
    if (completed !== undefined) return { kind: "committed", record: completed };
    const pending = this.#pendingPuts.get(reservationId);
    return pending === undefined
      ? { kind: "aborted_or_unknown" }
      : { kind: "pending", object_ref: pending.record.object_ref };
  }

  public async abortPut(
    reservationId: string,
    foregroundLeaseToken: string,
  ): Promise<void> {
    const pending = this.#pendingPuts.get(reservationId);
    if (pending === undefined) return;
    if (
      pending.foregroundLeaseToken !== foregroundLeaseToken ||
      pending.claimToken !== undefined
    ) {
      throw new Error("stale put foreground lease");
    }
    this.#abortPendingPut(pending);
  }

  #abortPendingPut(pending: PendingPut): void {
    const reservationId = pending.reservationId;
    this.#pendingPuts.delete(reservationId);
    this.#records.delete(pending.record.object_ref);
    this.#identityToRef.delete(pending.identityKey);
  }

  public async findByRef(
    objectRef: ObjectRefV1,
  ): Promise<ObjectMetadataRecordV1 | undefined> {
    return this.#records.get(objectRef);
  }

  public async reserveDelete(
    input: ReserveDeleteInputV1,
  ): Promise<ReserveDeleteResultV1> {
    const record = this.#records.get(input.object_ref);
    if (record === undefined) return { kind: "not_found" };
    if (record.state === "deleted") {
      return record.deletion_decision_version === input.deletion_decision_version &&
        record.deletion_idempotency_key === input.idempotency_key
        ? { kind: "replay", record }
        : { kind: "conflict" };
    }
    if (record.state === "delete_pending") {
      const pending = [...this.#pendingDeletes.values()].find(
        ({ objectRef }) => objectRef === record.object_ref,
      );
      if (
        pending !== undefined &&
        pending.deletionDecisionVersion === input.deletion_decision_version &&
        pending.idempotencyKey === input.idempotency_key
      ) {
        return { kind: "pending", reservation_id: pending.reservationId };
      }
      return { kind: "busy" };
    }
    if (record.state !== "available") return { kind: "busy" };
    if (record.legal_hold) return { kind: "hold_active" };
    if (new Date(record.retention_until).getTime() > input.now.getTime()) {
      return {
        kind: "retention_active",
        retention_until: record.retention_until,
      };
    }
    if (input.deletion_decision_version.length === 0) {
      return { kind: "conflict" };
    }
    const reservationId = randomUUID();
    const pending: PendingDelete = {
      reservationId,
      objectRef: record.object_ref,
      previous: record,
      deletionDecisionVersion: input.deletion_decision_version,
      idempotencyKey: input.idempotency_key,
      operation: "delete_finalize",
      attempt: 0,
    };
    this.#pendingDeletes.set(reservationId, pending);
    this.#records.set(record.object_ref, {
      ...record,
      state: "delete_pending",
      deletion_decision_version: input.deletion_decision_version,
      deletion_idempotency_key: input.idempotency_key,
    });
    return { kind: "claimed", reservation_id: reservationId };
  }

  public async completeDelete(
    reservationId: string,
  ): Promise<ObjectMetadataRecordV1> {
    const pending = this.#pendingDeletes.get(reservationId);
    if (pending === undefined) {
      const completed = this.#completedDeletes.get(reservationId);
      if (completed !== undefined) return completed;
      throw new Error("unknown delete reservation");
    }
    const deleted: ObjectMetadataRecordV1 = {
      ...pending.previous,
      state: "deleted",
      deletion_decision_version: pending.deletionDecisionVersion,
      deletion_idempotency_key: pending.idempotencyKey,
    };
    this.#records.set(deleted.object_ref, deleted);
    this.#pendingDeletes.delete(reservationId);
    this.#completedDeletes.set(reservationId, deleted);
    return deleted;
  }

  public async findDeleteFinalization(
    reservationId: string,
  ): Promise<DeleteFinalizationV1> {
    const completed = this.#completedDeletes.get(reservationId);
    if (completed !== undefined) return { kind: "committed", record: completed };
    const pending = this.#pendingDeletes.get(reservationId);
    return pending === undefined
      ? { kind: "aborted_or_unknown" }
      : { kind: "pending", object_ref: pending.objectRef };
  }

  public async abortDelete(reservationId: string): Promise<void> {
    const pending = this.#pendingDeletes.get(reservationId);
    if (pending === undefined) return;
    this.#records.set(pending.objectRef, pending.previous);
    this.#pendingDeletes.delete(reservationId);
  }

  public async handoffPutReconciliation(
    reservationId: string,
    operation: "put_finalize" | "put_cleanup",
    foregroundLeaseToken: string,
    notBefore?: Date,
  ): Promise<void> {
    const pending = this.#pendingPuts.get(reservationId);
    if (pending === undefined) return;
    if (
      pending.foregroundLeaseToken !== foregroundLeaseToken ||
      pending.claimToken !== undefined ||
      (pending.operation !== "put_uploading" && pending.operation !== operation)
    ) {
      throw new Error("stale put foreground lease");
    }
    pending.operation = operation;
    delete pending.claimToken;
    delete pending.lockedUntil;
    if (notBefore === undefined) delete pending.nextRetryAt;
    else pending.nextRetryAt = notBefore;
  }

  public async handoffDeleteReconciliation(reservationId: string): Promise<void> {
    const pending = this.#pendingDeletes.get(reservationId);
    if (pending === undefined) return;
    pending.operation = "delete_finalize";
    delete pending.claimToken;
    delete pending.lockedUntil;
    delete pending.nextRetryAt;
  }

  public async claimReconciliation(
    input: ClaimObjectReconciliationInputV1,
  ): Promise<readonly ObjectReconciliationClaimV1[]> {
    const candidates: Array<PendingPut | PendingDelete> = [
      ...this.#pendingPuts.values(),
      ...this.#pendingDeletes.values(),
    ];
    const claims: ObjectReconciliationClaimV1[] = [];
    for (const pending of candidates) {
      let foregroundLeaseExpired = false;
      if (claims.length >= input.limit) break;
      if (
        (input.reservation_id !== undefined &&
          pending.reservationId !== input.reservation_id) ||
        (pending.nextRetryAt !== undefined && pending.nextRetryAt > input.now) ||
        (pending.lockedUntil !== undefined && pending.lockedUntil > input.now)
      ) {
        continue;
      }
      if ("record" in pending && pending.operation === "put_uploading") {
        if (pending.foregroundLeaseUntil > input.now) continue;
        foregroundLeaseExpired = true;
        pending.operation = "put_finalize";
        delete pending.foregroundLeaseToken;
      }
      pending.attempt += 1;
      pending.claimToken = `${input.worker_id}:${randomUUID()}`;
      pending.lockedUntil = input.locked_until;
      const record =
        "record" in pending
          ? pending.record
          : this.#records.get(pending.objectRef);
      if (record === undefined) continue;
      claims.push({
        reservation_id: pending.reservationId,
        claim_token: pending.claimToken,
        operation: pending.operation as ObjectReconciliationOperationV1,
        record,
        attempt: pending.attempt,
        foreground_lease_expired: foregroundLeaseExpired,
      });
    }
    return claims;
  }

  public async completeReconciliation(
    input: CompleteObjectReconciliationInputV1,
  ): Promise<ObjectMetadataRecordV1 | undefined> {
    const put = this.#pendingPuts.get(input.reservation_id);
    if (put !== undefined) {
      if (put.claimToken !== input.claim_token) {
        throw new Error("stale reconciliation claim");
      }
      if (put.operation === "put_cleanup") {
        this.#abortPendingPut(put);
        return undefined;
      }
      if (put.operation !== "put_finalize") {
        throw new Error("invalid put reconciliation completion");
      }
      if (input.version === undefined) {
        throw new Error("put finalization requires a verified physical version");
      }
      const completed: ObjectMetadataRecordV1 = {
        ...put.record,
        version: input.version,
        state: "available",
      };
      this.#records.set(completed.object_ref, completed);
      this.#pendingPuts.delete(input.reservation_id);
      this.#completedPuts.set(input.reservation_id, completed);
      return completed;
    }
    const deletion = this.#pendingDeletes.get(input.reservation_id);
    if (
      deletion === undefined ||
      deletion.claimToken !== input.claim_token ||
      deletion.operation !== "delete_finalize"
    ) {
      throw new Error("stale reconciliation claim");
    }
    return this.completeDelete(input.reservation_id);
  }

  public async releaseReconciliation(
    input: ReleaseObjectReconciliationInputV1,
  ): Promise<void> {
    const pending =
      this.#pendingPuts.get(input.reservation_id) ??
      this.#pendingDeletes.get(input.reservation_id);
    if (pending === undefined) return;
    if (pending.claimToken !== input.claim_token) {
      throw new Error("stale reconciliation claim");
    }
    delete pending.claimToken;
    delete pending.lockedUntil;
    pending.lastError = input.last_error;
    pending.nextRetryAt = input.next_retry_at;
  }

  public async redirectReconciliation(
    input: RedirectObjectReconciliationInputV1,
  ): Promise<void> {
    const pending = this.#pendingPuts.get(input.reservation_id);
    if (pending === undefined || pending.claimToken !== input.claim_token) {
      throw new Error("stale reconciliation claim");
    }
    pending.operation = input.operation;
    pending.lastError = input.last_error;
    delete pending.claimToken;
    delete pending.lockedUntil;
    if (input.next_retry_at === undefined) delete pending.nextRetryAt;
    else pending.nextRetryAt = input.next_retry_at;
  }

  public setLegalHold(objectRef: ObjectRefV1, legalHold: boolean): void {
    const record = this.#records.get(objectRef);
    if (record === undefined) throw new Error("unknown object ref");
    this.#records.set(objectRef, { ...record, legal_hold: legalHold });
  }
}
