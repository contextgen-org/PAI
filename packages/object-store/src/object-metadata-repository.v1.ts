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
}

export type ReservePutResultV1 =
  | {
      readonly kind: "claimed";
      readonly reservation_id: string;
      readonly object_ref: ObjectRefV1;
    }
  | { readonly kind: "replay"; readonly record: ObjectMetadataRecordV1 }
  | { readonly kind: "conflict" }
  | { readonly kind: "busy" };

export interface CompletePutInputV1 {
  readonly reservation_id: string;
  readonly version: string;
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
  | { readonly kind: "busy" }
  | { readonly kind: "not_found" };

/**
 * Implementations live in each owner schema. They must make every reserve/commit
 * transition atomic and never persist a bucket, physical key, or signed URL.
 */
export interface ObjectMetadataRepositoryV1 {
  reservePut(input: ReservePutInputV1): Promise<ReservePutResultV1>;
  completePut(input: CompletePutInputV1): Promise<ObjectMetadataRecordV1>;
  findPutFinalization(reservationId: string): Promise<PutFinalizationV1>;
  abortPut(reservationId: string): Promise<void>;
  findByRef(objectRef: ObjectRefV1): Promise<ObjectMetadataRecordV1 | undefined>;
  reserveDelete(input: ReserveDeleteInputV1): Promise<ReserveDeleteResultV1>;
  completeDelete(reservationId: string): Promise<ObjectMetadataRecordV1>;
  findDeleteFinalization(reservationId: string): Promise<DeleteFinalizationV1>;
  abortDelete(reservationId: string): Promise<void>;
}

interface PendingPut {
  readonly reservationId: string;
  readonly identityKey: string;
  readonly record: ObjectMetadataRecordV1;
}

interface PendingDelete {
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
      return { kind: "busy" };
    }

    const reservationId = randomUUID();
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
    });
    return {
      kind: "claimed",
      reservation_id: reservationId,
      object_ref: objectRef,
    };
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

  public async abortPut(reservationId: string): Promise<void> {
    const pending = this.#pendingPuts.get(reservationId);
    if (pending === undefined) return;
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

  public setLegalHold(objectRef: ObjectRefV1, legalHold: boolean): void {
    const record = this.#records.get(objectRef);
    if (record === undefined) throw new Error("unknown object ref");
    this.#records.set(objectRef, { ...record, legal_hold: legalHold });
  }
}
