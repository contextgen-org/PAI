import { createHash } from "node:crypto";
import { isProxy } from "node:util/types";
import { assertCanonicalJsonBoundaryV1 } from "@pai/contracts";

import type {
  DeleteFinalizationV1,
  ObjectMetadataRecordV1,
  ObjectMetadataRepositoryV1,
  ObjectReconciliationClaimV1,
  PutFinalizationV1,
  ReserveDeleteResultV1,
  ReservePutResultV1,
} from "./object-metadata-repository.v1.js";
import type {
  ObjectAccessOperationV1,
  ObjectAccessPolicyVerifierV1,
  VerifiedObjectAccessDecisionV1,
} from "./object-access-policy.v1.js";
import {
  ObjectStorageBackendErrorV1,
  type BackendObjectHeadV1,
  type BackendObjectStreamV1,
  type FinalizeAbandonedPutAttemptResultV1,
  type ObjectStorageBackendV1,
} from "./object-storage-backend.v1.js";
import type { ObjectClassPolicyV1 } from "./object-store-policy.v1.js";
import { validateObjectClassPoliciesV1 } from "./object-store-policy.v1.js";
import {
  ObjectStoreErrorV1,
  type DeleteIfEligibleRequestV1,
  type DeleteIfEligibleResultV1,
  type IssueReadGrantRequestV1,
  type ObjectAuthorizationV1,
  type ObjectHeadV1,
  type ObjectRangeReadRequestV1,
  type ObjectReadGrantV1,
  type ObjectReadRequestV1,
  type ObjectRefV1,
  type ObjectScopeV1,
  type ObjectStorePortV1,
  type ObjectStoreReconciliationPortV1,
  type ReconcileObjectStoreRequestV1,
  type ReconcileObjectStoreResultV1,
  type ObjectStreamResultV1,
  type PutImmutableRequestV1,
  type PutImmutableResultV1,
} from "./object-store-port.v1.js";

type ObjectOperationV1 = "put" | ObjectAccessOperationV1;

const sha256Pattern = /^sha256:[0-9a-f]{64}$/;
const tokenPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/;
const mediaTypePattern = /^[^\s/]+\/[^\s/]+$/;
const foregroundUploadLeaseMs = 5 * 60_000;
const expiredUploadCleanupGraceMs = 5 * 60_000;
const maxBackendReadGrantLength = 8 * 1024;
const backendReadGrantCharacterPattern = /^[\x21-\x7e]+$/u;
const typedArrayPrototypeV1 = Object.getPrototypeOf(
  Uint8Array.prototype,
) as object;
const typedArrayBufferGetterV1 = Object.getOwnPropertyDescriptor(
  typedArrayPrototypeV1,
  "buffer",
)!.get!;
const typedArrayByteLengthGetterV1 = Object.getOwnPropertyDescriptor(
  typedArrayPrototypeV1,
  "byteLength",
)!.get!;
const typedArrayByteOffsetGetterV1 = Object.getOwnPropertyDescriptor(
  typedArrayPrototypeV1,
  "byteOffset",
)!.get!;
const typedArrayTagGetterV1 = Object.getOwnPropertyDescriptor(
  typedArrayPrototypeV1,
  Symbol.toStringTag,
)!.get!;
const arrayBufferByteLengthGetterV1 = Object.getOwnPropertyDescriptor(
  ArrayBuffer.prototype,
  "byteLength",
)!.get!;
const typedArraySetV1 = Uint8Array.prototype.set;

function boundedIdentity(value: unknown, maxLength = 512): value is string {
  return (
    typeof value === "string" && value.length > 0 && value.length <= maxLength
  );
}

function fail(
  code: ObjectStoreErrorV1["code"],
  message: string,
  retryable = false,
  details: Readonly<Record<string, unknown>> = {},
): never {
  throw new ObjectStoreErrorV1(code, message, retryable, details);
}

/**
 * Detaches an untrusted byte chunk from its producer before hashing or handing
 * it to another component. All observations and the copy use captured
 * intrinsics, so Proxy/accessor-backed lookalikes cannot substitute a different
 * view between the size check and the copy.
 */
function detachedBoundedByteChunkV1(
  value: unknown,
  maxBytes: number,
  code: ObjectStoreErrorV1["code"],
  message: string,
  overflowCode = code,
  overflowMessage = message,
): Uint8Array {
  if (
    typeof value !== "object" ||
    value === null ||
    isProxy(value) ||
    !Number.isSafeInteger(maxBytes) ||
    maxBytes < 0
  ) {
    fail(code, message);
  }

  let buffer: unknown;
  let byteLength: number;
  let byteOffset: number;
  let tag: unknown;
  try {
    for (const key of [
      "buffer",
      "byteLength",
      "byteOffset",
      Symbol.toStringTag,
    ] as const) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        descriptor !== undefined &&
        (!("value" in descriptor) ||
          typeof descriptor.get === "function" ||
          typeof descriptor.set === "function")
      ) {
        fail(code, message);
      }
    }
    buffer = typedArrayBufferGetterV1.call(value);
    byteLength = typedArrayByteLengthGetterV1.call(value);
    byteOffset = typedArrayByteOffsetGetterV1.call(value);
    tag = typedArrayTagGetterV1.call(value);
  } catch (error) {
    if (error instanceof ObjectStoreErrorV1) throw error;
    fail(code, message);
  }

  if (
    tag !== "Uint8Array" ||
    !Number.isSafeInteger(byteLength) ||
    !Number.isSafeInteger(byteOffset) ||
    byteLength < 1 ||
    byteOffset < 0
  ) {
    fail(code, message);
  }
  if (byteLength > maxBytes) {
    fail(overflowCode, overflowMessage);
  }

  let bufferByteLength: number;
  try {
    // The ArrayBuffer intrinsic rejects SharedArrayBuffer and forged buffers.
    bufferByteLength = arrayBufferByteLengthGetterV1.call(buffer);
  } catch {
    fail(code, message);
  }
  if (
    !Number.isSafeInteger(bufferByteLength) ||
    byteOffset > bufferByteLength ||
    byteLength > bufferByteLength - byteOffset
  ) {
    fail(code, message);
  }

  const detached = new Uint8Array(byteLength);
  try {
    typedArraySetV1.call(detached, value as Uint8Array);
  } catch {
    fail(code, message);
  }
  return detached;
}

function closedObjectReconciliationFailureV1(error: unknown): string {
  if (error instanceof ObjectStorageBackendErrorV1) {
    return `object_storage_backend_${error.code}`;
  }
  if (error instanceof ObjectStoreErrorV1) {
    return `object_store_${error.code}`;
  }
  return "object_reconciliation_failed";
}

function plainObject(value: unknown): value is Readonly<Record<string, unknown>> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    isProxy(value)
  ) {
    return false;
  }
  let prototype: object | null;
  try {
    prototype = Object.getPrototypeOf(value);
  } catch {
    return false;
  }
  return prototype === Object.prototype || prototype === null;
}

function ownDataValuesV1(
  value: unknown,
): Readonly<Record<string, unknown>> | undefined {
  if (!plainObject(value)) return undefined;
  let descriptors: PropertyDescriptorMap;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    return undefined;
  }
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some((key) => typeof key !== "string")) return undefined;
  const snapshot = Object.create(null) as Record<string, unknown>;
  for (const key of keys as string[]) {
    const descriptor = descriptors[key];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      return undefined;
    }
    snapshot[key] = descriptor.value;
  }
  return Object.freeze(snapshot);
}

function exactKeys(
  value: Readonly<Record<string, unknown>>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function ownDataRecordV1(
  value: unknown,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[] = [],
): Readonly<Record<string, unknown>> | undefined {
  const data = ownDataValuesV1(value);
  if (
    data === undefined ||
    requiredKeys.some((key) => !Object.hasOwn(data, key)) ||
    Object.keys(data).some(
      (key) => !requiredKeys.includes(key) && !optionalKeys.includes(key),
    )
  ) {
    return undefined;
  }
  return data;
}

function snapshotObjectScopeV1(value: unknown): ObjectScopeV1 {
  const data = ownDataValuesV1(value);
  if (data === undefined) {
    fail("precondition_failed", "object scope is invalid");
  }
  const scopeKind = data.scope_kind;
  if (scopeKind === "global" && exactKeys(data, ["scope_kind"])) {
    return Object.freeze({ scope_kind: "global" });
  }
  if (!exactKeys(data, [
    "bot_id",
    "deployment_environment",
    "owner_agent_id",
    "release_channel",
    "scope_kind",
    "workspace_id",
  ])) {
    fail("precondition_failed", "object scope is invalid");
  }
  const workspaceId = data.workspace_id;
  const botId = data.bot_id;
  const ownerAgentId = data.owner_agent_id;
  const deploymentEnvironment = data.deployment_environment;
  const releaseChannel = data.release_channel;
  if (
    scopeKind !== "bot" ||
    typeof workspaceId !== "string" ||
    workspaceId.length === 0 ||
    typeof botId !== "string" ||
    botId.length === 0 ||
    typeof ownerAgentId !== "string" ||
    ownerAgentId.length === 0 ||
    (deploymentEnvironment !== "local" &&
      deploymentEnvironment !== "dev" &&
      deploymentEnvironment !== "staging" &&
      deploymentEnvironment !== "prod") ||
    (releaseChannel !== "stable" && releaseChannel !== "canary")
  ) {
    fail("precondition_failed", "object scope is invalid");
  }
  return Object.freeze({
    scope_kind: "bot",
    workspace_id: workspaceId,
    bot_id: botId,
    owner_agent_id: ownerAgentId,
    deployment_environment: deploymentEnvironment,
    release_channel: releaseChannel,
  });
}

function snapshotByteStreamV1(value: unknown): AsyncIterable<Uint8Array> {
  if (typeof value !== "object" || value === null || isProxy(value)) {
    fail("precondition_failed", "object body must be an async byte stream");
  }
  const iterable = value as AsyncIterable<Uint8Array>;
  let iteratorFactory: unknown;
  try {
    iteratorFactory = iterable[Symbol.asyncIterator];
  } catch {
    fail("precondition_failed", "object body must be an async byte stream");
  }
  if (typeof iteratorFactory !== "function") {
    fail("precondition_failed", "object body must be an async byte stream");
  }
  const createIterator = iteratorFactory.bind(iterable);
  return Object.freeze({
    [Symbol.asyncIterator]: createIterator,
  });
}

export function snapshotPutRequestV1(value: unknown): PutImmutableRequestV1 {
  const data = ownDataRecordV1(value, [
    "body",
    "capability",
    "expected_sha256",
    "idempotency_key",
    "media_type",
    "object_class",
    "owner_object_id",
    "owner_service",
    "owner_state_version",
    "retention_until",
    "scope",
    "size_bytes",
  ]);
  const ownerService = data?.owner_service;
  const ownerObjectId = data?.owner_object_id;
  const ownerStateVersion = data?.owner_state_version;
  const objectClass = data?.object_class;
  const capability = data?.capability;
  const idempotencyKey = data?.idempotency_key;
  const expectedSha256 = data?.expected_sha256;
  const sizeBytes = data?.size_bytes;
  const mediaType = data?.media_type;
  const retentionUntil = data?.retention_until;
  if (
    data === undefined ||
    typeof ownerService !== "string" ||
    !boundedIdentity(ownerObjectId) ||
    !Number.isSafeInteger(ownerStateVersion) ||
    (ownerStateVersion as number) < 1 ||
    typeof objectClass !== "string" ||
    typeof capability !== "string" ||
    typeof idempotencyKey !== "string" ||
    typeof expectedSha256 !== "string" ||
    typeof sizeBytes !== "number" ||
    typeof mediaType !== "string" ||
    typeof retentionUntil !== "string"
  ) {
    fail("precondition_failed", "put request is invalid");
  }
  const scope = snapshotObjectScopeV1(data.scope);
  try {
    assertCanonicalJsonBoundaryV1({
      owner_service: ownerService,
      owner_object_id: ownerObjectId,
      owner_state_version: ownerStateVersion,
      object_class: objectClass,
      scope,
      capability,
      idempotency_key: idempotencyKey,
      expected_sha256: expectedSha256,
      size_bytes: sizeBytes,
      media_type: mediaType,
      retention_until: retentionUntil,
    });
  } catch {
    fail(
      "precondition_failed",
      "put request metadata is outside the bounded canonical JSON contract",
    );
  }
  return Object.freeze({
    owner_service: ownerService as PutImmutableRequestV1["owner_service"],
    owner_object_id: ownerObjectId,
    owner_state_version: ownerStateVersion as number,
    object_class: objectClass,
    scope,
    capability,
    idempotency_key: idempotencyKey,
    expected_sha256: expectedSha256,
    size_bytes: sizeBytes,
    media_type: mediaType,
    retention_until: retentionUntil,
    body: snapshotByteStreamV1(data.body),
  });
}

const readRequestKeys = [
  "access_decision_ref",
  "capability",
  "object_ref",
  "owner_object_id",
  "owner_service",
  "owner_state_version",
  "redaction_policy_version",
  "retention_policy_version",
  "scope",
] as const;

function readRequestFromDataV1(
  data: Readonly<Record<string, unknown>> | undefined,
): ObjectReadRequestV1 {
  const ownerService = data?.owner_service;
  const ownerObjectId = data?.owner_object_id;
  const ownerStateVersion = data?.owner_state_version;
  const capability = data?.capability;
  const objectRef = data?.object_ref;
  const accessDecisionRef = data?.access_decision_ref;
  const retentionPolicyVersion = data?.retention_policy_version;
  const redactionPolicyVersion = data?.redaction_policy_version;
  if (
    data === undefined ||
    typeof ownerService !== "string" ||
    !boundedIdentity(ownerObjectId) ||
    !Number.isSafeInteger(ownerStateVersion) ||
    (ownerStateVersion as number) < 1 ||
    typeof capability !== "string" ||
    !boundedIdentity(objectRef) ||
    typeof accessDecisionRef !== "string" ||
    typeof retentionPolicyVersion !== "string" ||
    typeof redactionPolicyVersion !== "string"
  ) {
    fail("precondition_failed", "object read request is invalid");
  }
  const request = Object.freeze({
    owner_service: ownerService as ObjectReadRequestV1["owner_service"],
    owner_object_id: ownerObjectId,
    owner_state_version: ownerStateVersion as number,
    scope: snapshotObjectScopeV1(data.scope),
    capability,
    object_ref: objectRef as ObjectRefV1,
    access_decision_ref: accessDecisionRef,
    retention_policy_version: retentionPolicyVersion,
    redaction_policy_version: redactionPolicyVersion,
  });
  try {
    assertCanonicalJsonBoundaryV1(request);
  } catch {
    fail(
      "precondition_failed",
      "object read request is outside the bounded canonical JSON contract",
    );
  }
  return request;
}

export function snapshotReadRequestV1(value: unknown): ObjectReadRequestV1 {
  return readRequestFromDataV1(ownDataRecordV1(value, readRequestKeys));
}

export function snapshotRangeReadRequestV1(value: unknown): ObjectRangeReadRequestV1 {
  const data = ownDataRecordV1(value, readRequestKeys, ["range"]);
  const request = readRequestFromDataV1(data);
  const range = data?.range;
  if (range === undefined) return request;
  const rangeData = ownDataRecordV1(range, ["length", "offset"]);
  const offset = rangeData?.offset;
  const length = rangeData?.length;
  if (typeof offset !== "number" || typeof length !== "number") {
    fail("precondition_failed", "invalid object byte range");
  }
  const snapshot = Object.freeze({
    ...request,
    range: Object.freeze({ offset, length }),
  });
  try {
    assertCanonicalJsonBoundaryV1(snapshot);
  } catch {
    fail(
      "precondition_failed",
      "object range request is outside the bounded canonical JSON contract",
    );
  }
  return snapshot;
}

export function snapshotGrantRequestV1(value: unknown): IssueReadGrantRequestV1 {
  const data = ownDataRecordV1(value, [...readRequestKeys, "ttl_seconds"]);
  const request = readRequestFromDataV1(data);
  const ttlSeconds = data?.ttl_seconds;
  if (typeof ttlSeconds !== "number") {
    fail("precondition_failed", "invalid read grant constraints");
  }
  const snapshot = Object.freeze({
    ...request,
    ttl_seconds: ttlSeconds,
  });
  try {
    assertCanonicalJsonBoundaryV1(snapshot);
  } catch {
    fail(
      "precondition_failed",
      "read grant request is outside the bounded canonical JSON contract",
    );
  }
  return snapshot;
}

export function snapshotDeleteRequestV1(value: unknown): DeleteIfEligibleRequestV1 {
  const data = ownDataRecordV1(value, [
    ...readRequestKeys,
    "deletion_decision_version",
    "idempotency_key",
  ]);
  const request = readRequestFromDataV1(data);
  const deletionDecisionVersion = data?.deletion_decision_version;
  const idempotencyKey = data?.idempotency_key;
  if (
    typeof deletionDecisionVersion !== "number" ||
    typeof idempotencyKey !== "string"
  ) {
    fail("precondition_failed", "invalid deletion decision identity");
  }
  const snapshot = Object.freeze({
    ...request,
    deletion_decision_version: deletionDecisionVersion,
    idempotency_key: idempotencyKey,
  });
  try {
    assertCanonicalJsonBoundaryV1(snapshot);
  } catch {
    fail(
      "precondition_failed",
      "delete request is outside the bounded canonical JSON contract",
    );
  }
  return snapshot;
}

function snapshotReconcileRequestV1(value: unknown): ReconcileObjectStoreRequestV1 {
  const data = ownDataRecordV1(
    value,
    ["lease_seconds", "limit", "worker_id"],
    ["reservation_id"],
  );
  const workerId = data?.worker_id;
  const limit = data?.limit;
  const leaseSeconds = data?.lease_seconds;
  const reservationId = data?.reservation_id;
  if (
    data === undefined ||
    typeof workerId !== "string" ||
    typeof limit !== "number" ||
    typeof leaseSeconds !== "number" ||
    (reservationId !== undefined && !boundedIdentity(reservationId))
  ) {
    fail("precondition_failed", "invalid reconciliation claim request");
  }
  const snapshot = Object.freeze({
    worker_id: workerId,
    limit,
    lease_seconds: leaseSeconds,
    ...(reservationId === undefined ? {} : { reservation_id: reservationId }),
  });
  try {
    assertCanonicalJsonBoundaryV1(snapshot);
  } catch {
    fail(
      "precondition_failed",
      "reconciliation request is outside the bounded canonical JSON contract",
    );
  }
  return snapshot;
}

function snapshotMetadataRecordV1(value: unknown): ObjectMetadataRecordV1 {
  const requiredKeys = [
    "idempotency_key",
    "legal_hold",
    "media_type",
    "object_class",
    "object_ref",
    "owner_object_id",
    "owner_service",
    "owner_state_version",
    "request_fingerprint",
    "retention_until",
    "scope",
    "scope_fingerprint",
    "sha256",
    "size_bytes",
    "state",
    "version",
  ];
  const optionalKeys = new Set([
    "deletion_decision_version",
    "deletion_idempotency_key",
  ]);
  const data = ownDataRecordV1(value, requiredKeys, [...optionalKeys]);
  const objectRef = data?.object_ref;
  const ownerService = data?.owner_service;
  const ownerObjectId = data?.owner_object_id;
  const ownerStateVersion = data?.owner_state_version;
  const objectClass = data?.object_class;
  const scopeFingerprint = data?.scope_fingerprint;
  const idempotencyKey = data?.idempotency_key;
  const requestFingerprint = data?.request_fingerprint;
  const version = data?.version;
  const objectSha256 = data?.sha256;
  const sizeBytes = data?.size_bytes;
  const mediaType = data?.media_type;
  const retentionUntil = data?.retention_until;
  const state = data?.state;
  const legalHold = data?.legal_hold;
  const deletionDecisionVersion = data?.deletion_decision_version;
  const deletionIdempotencyKey = data?.deletion_idempotency_key;
  if (
    data === undefined ||
    !boundedIdentity(objectRef) ||
    typeof ownerService !== "string" ||
    !boundedIdentity(ownerObjectId) ||
    !Number.isSafeInteger(ownerStateVersion) ||
    (ownerStateVersion as number) < 1 ||
    typeof objectClass !== "string" ||
    typeof scopeFingerprint !== "string" ||
    typeof idempotencyKey !== "string" ||
    typeof requestFingerprint !== "string" ||
    typeof version !== "string" ||
    version.length === 0 ||
    typeof objectSha256 !== "string" ||
    !sha256Pattern.test(objectSha256) ||
    !Number.isSafeInteger(sizeBytes) ||
    (sizeBytes as number) < 0 ||
    typeof mediaType !== "string" ||
    typeof retentionUntil !== "string" ||
    !Number.isFinite(Date.parse(retentionUntil)) ||
    (state !== "put_pending" &&
      state !== "available" &&
      state !== "delete_pending" &&
      state !== "deleted") ||
    typeof legalHold !== "boolean" ||
    (deletionDecisionVersion !== undefined &&
      (!Number.isSafeInteger(deletionDecisionVersion) ||
        (deletionDecisionVersion as number) < 1)) ||
    (deletionIdempotencyKey !== undefined &&
      typeof deletionIdempotencyKey !== "string")
  ) {
    fail("integrity_mismatch", "owner object metadata is malformed");
  }
  let scope: ObjectScopeV1;
  try {
    scope = snapshotObjectScopeV1(data.scope);
  } catch {
    fail("integrity_mismatch", "owner object scope metadata is malformed");
  }
  return Object.freeze({
    object_ref: objectRef as ObjectRefV1,
    owner_service: ownerService as ObjectMetadataRecordV1["owner_service"],
    owner_object_id: ownerObjectId,
    owner_state_version: ownerStateVersion as number,
    object_class: objectClass,
    scope,
    scope_fingerprint: scopeFingerprint,
    idempotency_key: idempotencyKey,
    request_fingerprint: requestFingerprint,
    version,
    sha256: objectSha256,
    size_bytes: sizeBytes as number,
    media_type: mediaType,
    retention_until: retentionUntil,
    state,
    legal_hold: legalHold,
    ...(deletionDecisionVersion === undefined
      ? {}
      : { deletion_decision_version: deletionDecisionVersion as number }),
    ...(deletionIdempotencyKey === undefined
      ? {}
      : { deletion_idempotency_key: deletionIdempotencyKey }),
  });
}

function snapshotReservePutResultV1(value: unknown): ReservePutResultV1 {
  const data = ownDataValuesV1(value);
  const kind = data?.kind;
  if (data === undefined || typeof kind !== "string") {
    throw new Error("put reservation result is malformed");
  }
  switch (kind) {
    case "claimed":
      {
        const foregroundLeaseToken = data.foreground_lease_token;
        const objectRef = data.object_ref;
        const reservationId = data.reservation_id;
        const uploadAttemptToken = data.upload_attempt_token;
      if (
        !exactKeys(data, [
          "foreground_lease_token",
          "kind",
          "object_ref",
          "reservation_id",
          "upload_attempt_token",
        ]) ||
        !boundedIdentity(foregroundLeaseToken) ||
        !boundedIdentity(objectRef) ||
        !boundedIdentity(reservationId) ||
        !boundedIdentity(uploadAttemptToken)
      ) {
        throw new Error("put reservation result is malformed");
      }
      return Object.freeze({
        kind: "claimed",
        foreground_lease_token: foregroundLeaseToken,
        object_ref: objectRef as ObjectRefV1,
        reservation_id: reservationId,
        upload_attempt_token: uploadAttemptToken,
      });
      }
    case "replay":
      if (!exactKeys(data, ["kind", "record"])) {
        throw new Error("put reservation result is malformed");
      }
      return Object.freeze({
        kind: "replay",
        record: snapshotMetadataRecordV1(data.record),
      });
    case "pending":
      {
      const reservationId = data.reservation_id;
      if (
        !exactKeys(data, ["kind", "reservation_id"]) ||
        !boundedIdentity(reservationId)
      ) {
        throw new Error("put reservation result is malformed");
      }
      return Object.freeze({
        kind: "pending",
        reservation_id: reservationId,
      });
      }
    case "conflict":
    case "busy":
      if (!exactKeys(data, ["kind"])) {
        throw new Error("put reservation result is malformed");
      }
      return Object.freeze({ kind });
    default:
      throw new Error("put reservation result is malformed");
  }
}

function snapshotReserveDeleteResultV1(value: unknown): ReserveDeleteResultV1 {
  const data = ownDataValuesV1(value);
  const kind = data?.kind;
  if (data === undefined || typeof kind !== "string") {
    throw new Error("delete reservation result is malformed");
  }
  switch (kind) {
    case "claimed":
    case "pending":
      {
      const reservationId = data.reservation_id;
      if (
        !exactKeys(data, ["kind", "reservation_id"]) ||
        !boundedIdentity(reservationId)
      ) {
        throw new Error("delete reservation result is malformed");
      }
      return Object.freeze({
        kind,
        reservation_id: reservationId,
      });
      }
    case "replay":
      if (!exactKeys(data, ["kind", "record"])) {
        throw new Error("delete reservation result is malformed");
      }
      return Object.freeze({
        kind: "replay",
        record: snapshotMetadataRecordV1(data.record),
      });
    case "retention_active":
      {
      const retentionUntil = data.retention_until;
      if (
        !exactKeys(data, ["kind", "retention_until"]) ||
        typeof retentionUntil !== "string"
      ) {
        throw new Error("delete reservation result is malformed");
      }
      return Object.freeze({
        kind: "retention_active",
        retention_until: retentionUntil,
      });
      }
    case "hold_active":
    case "conflict":
    case "busy":
    case "not_found":
      if (!exactKeys(data, ["kind"])) {
        throw new Error("delete reservation result is malformed");
      }
      return Object.freeze({ kind });
    default:
      throw new Error("delete reservation result is malformed");
  }
}

function snapshotPutFinalizationV1(value: unknown): PutFinalizationV1 {
  const data = ownDataValuesV1(value);
  const kind = data?.kind;
  if (data === undefined || typeof kind !== "string") {
    throw new Error("put finalization result is malformed");
  }
  if (kind === "committed" && exactKeys(data, ["kind", "record"])) {
    return Object.freeze({
      kind: "committed",
      record: snapshotMetadataRecordV1(data.record),
    });
  }
  const objectRef = data.object_ref;
  if (
    kind === "pending" &&
    exactKeys(data, ["kind", "object_ref"]) &&
    boundedIdentity(objectRef)
  ) {
    return Object.freeze({
      kind: "pending",
      object_ref: objectRef as ObjectRefV1,
    });
  }
  if (kind === "aborted_or_unknown" && exactKeys(data, ["kind"])) {
    return Object.freeze({ kind: "aborted_or_unknown" });
  }
  throw new Error("put finalization result is malformed");
}

function snapshotDeleteFinalizationV1(value: unknown): DeleteFinalizationV1 {
  const data = ownDataValuesV1(value);
  const kind = data?.kind;
  if (data === undefined || typeof kind !== "string") {
    throw new Error("delete finalization result is malformed");
  }
  if (kind === "committed" && exactKeys(data, ["kind", "record"])) {
    return Object.freeze({
      kind: "committed",
      record: snapshotMetadataRecordV1(data.record),
    });
  }
  const objectRef = data.object_ref;
  if (
    kind === "pending" &&
    exactKeys(data, ["kind", "object_ref"]) &&
    boundedIdentity(objectRef)
  ) {
    return Object.freeze({
      kind: "pending",
      object_ref: objectRef as ObjectRefV1,
    });
  }
  if (kind === "aborted_or_unknown" && exactKeys(data, ["kind"])) {
    return Object.freeze({ kind: "aborted_or_unknown" });
  }
  throw new Error("delete finalization result is malformed");
}

export function snapshotAccessDecisionV1(
  value: unknown,
): VerifiedObjectAccessDecisionV1 {
  const keys = [
    "access_decision_ref",
    "authorized",
    "capability",
    "object_ref",
    "operation",
    "owner_object_id",
    "owner_service",
    "owner_state_version",
    "redaction_policy_version",
    "retention_policy_version",
    "retention_until",
    "scope",
    "scope_fingerprint",
  ];
  const data = ownDataRecordV1(value, keys);
  const authorized = data?.authorized;
  const operation = data?.operation;
  const accessDecisionRef = data?.access_decision_ref;
  const capability = data?.capability;
  const objectRef = data?.object_ref;
  const ownerService = data?.owner_service;
  const ownerObjectId = data?.owner_object_id;
  const ownerStateVersion = data?.owner_state_version;
  const redactionPolicyVersion = data?.redaction_policy_version;
  const retentionPolicyVersion = data?.retention_policy_version;
  const retentionUntil = data?.retention_until;
  const scopeFingerprint = data?.scope_fingerprint;
  if (
    data === undefined ||
    authorized !== true ||
    (operation !== "head" &&
      operation !== "get" &&
      operation !== "grant" &&
      operation !== "delete") ||
    [
      accessDecisionRef,
      capability,
      objectRef,
      ownerObjectId,
      ownerService,
      redactionPolicyVersion,
      retentionPolicyVersion,
      retentionUntil,
      scopeFingerprint,
    ].some((entry) => typeof entry !== "string") ||
    !boundedIdentity(objectRef) ||
    !boundedIdentity(ownerObjectId) ||
    !Number.isSafeInteger(ownerStateVersion) ||
    (ownerStateVersion as number) < 1
  ) {
    throw new Error("object access decision is malformed");
  }
  const scope = snapshotObjectScopeV1(data.scope);
  return Object.freeze({
    access_decision_ref: accessDecisionRef as string,
    authorized: true,
    capability: capability as string,
    object_ref: objectRef as ObjectRefV1,
    operation,
    owner_object_id: ownerObjectId as string,
    owner_service: ownerService as VerifiedObjectAccessDecisionV1["owner_service"],
    owner_state_version: ownerStateVersion as number,
    redaction_policy_version: redactionPolicyVersion as string,
    retention_policy_version: retentionPolicyVersion as string,
    retention_until: retentionUntil as string,
    scope,
    scope_fingerprint: scopeFingerprint as string,
  });
}

function snapshotBackendHeadV1(value: unknown): BackendObjectHeadV1 {
  const data = ownDataRecordV1(value, [
    "media_type",
    "sha256",
    "size_bytes",
    "version",
  ]);
  const version = data?.version;
  const objectSha256 = data?.sha256;
  const sizeBytes = data?.size_bytes;
  const mediaType = data?.media_type;
  if (
    data === undefined ||
    typeof version !== "string" ||
    typeof objectSha256 !== "string" ||
    !Number.isSafeInteger(sizeBytes) ||
    typeof mediaType !== "string"
  ) {
    fail("integrity_mismatch", "object storage returned malformed metadata");
  }
  return Object.freeze({
    version,
    sha256: objectSha256,
    size_bytes: sizeBytes as number,
    media_type: mediaType,
  });
}

function snapshotBackendStreamV1(value: unknown): BackendObjectStreamV1 {
  const data = ownDataRecordV1(value, [
    "body",
    "length",
    "offset",
    "total_size_bytes",
  ]);
  const offset = data?.offset;
  const length = data?.length;
  const totalSizeBytes = data?.total_size_bytes;
  if (
    data === undefined ||
    !Number.isSafeInteger(offset) ||
    !Number.isSafeInteger(length) ||
    !Number.isSafeInteger(totalSizeBytes)
  ) {
    fail("integrity_mismatch", "object storage returned malformed stream metadata");
  }
  return Object.freeze({
    body: snapshotByteStreamV1(data.body),
    offset: offset as number,
    length: length as number,
    total_size_bytes: totalSizeBytes as number,
  });
}

function snapshotBackendReadGrantV1(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maxBackendReadGrantLength ||
    !backendReadGrantCharacterPattern.test(value)
  ) {
    fail("integrity_mismatch", "object storage returned a malformed read grant");
  }
  return value;
}

function snapshotFinalizeAbandonedPutAttemptResultV1(
  value: unknown,
): FinalizeAbandonedPutAttemptResultV1 {
  const data = ownDataValuesV1(value);
  if (
    data?.kind === "active_or_unknown" &&
    exactKeys(data, ["kind"])
  ) {
    return Object.freeze({ kind: "active_or_unknown" });
  }
  if (data?.kind !== "terminal" || !exactKeys(data, ["kind", "receipt"])) {
    fail("integrity_mismatch", "object storage returned a malformed terminal receipt");
  }
  const receipt = ownDataRecordV1(data.receipt, [
    "terminal_at",
    "upload_attempt_token",
  ]);
  const uploadAttemptToken = receipt?.upload_attempt_token;
  const terminalAt = receipt?.terminal_at;
  if (
    receipt === undefined ||
    !boundedIdentity(uploadAttemptToken) ||
    typeof terminalAt !== "string" ||
    terminalAt.length > 64 ||
    !Number.isFinite(Date.parse(terminalAt))
  ) {
    fail("integrity_mismatch", "object storage returned a malformed terminal receipt");
  }
  return Object.freeze({
    kind: "terminal",
    receipt: Object.freeze({
      upload_attempt_token: uploadAttemptToken,
      terminal_at: terminalAt,
    }),
  });
}

function snapshotReconciliationClaimV1(
  value: unknown,
): ObjectReconciliationClaimV1 {
  const requiredKeys = [
    "attempt",
    "claim_generation",
    "claim_token",
    "foreground_upload_may_still_arrive",
    "operation",
    "record",
    "reservation_id",
  ];
  const optionalKeys = new Set([
    "cleanup_not_before",
    "foreground_upload_terminal_at",
    "upload_attempt_token",
  ]);
  const data = ownDataRecordV1(value, requiredKeys, [...optionalKeys]);
  const reservationId = data?.reservation_id;
  const claimToken = data?.claim_token;
  const claimGeneration = data?.claim_generation;
  const operation = data?.operation;
  const attempt = data?.attempt;
  const foregroundUploadMayStillArrive =
    data?.foreground_upload_may_still_arrive;
  const uploadAttemptToken = data?.upload_attempt_token;
  const cleanupNotBefore = data?.cleanup_not_before;
  const foregroundUploadTerminalAt = data?.foreground_upload_terminal_at;
  if (
    data === undefined ||
    !boundedIdentity(reservationId) ||
    !boundedIdentity(claimToken) ||
    !Number.isSafeInteger(claimGeneration) ||
    (claimGeneration as number) < 1 ||
    typeof operation !== "string" ||
    !Number.isSafeInteger(attempt) ||
    typeof foregroundUploadMayStillArrive !== "boolean" ||
    (uploadAttemptToken !== undefined &&
      !boundedIdentity(uploadAttemptToken)) ||
    (cleanupNotBefore !== undefined && typeof cleanupNotBefore !== "string") ||
    (foregroundUploadTerminalAt !== undefined &&
      typeof foregroundUploadTerminalAt !== "string")
  ) {
    throw new Error("ObjectStore reconciliation claim is malformed");
  }
  return Object.freeze({
    reservation_id: reservationId,
    claim_token: claimToken,
    claim_generation: claimGeneration as number,
    operation: operation as ObjectReconciliationClaimV1["operation"],
    record: snapshotMetadataRecordV1(data.record),
    attempt: attempt as number,
    foreground_upload_may_still_arrive: foregroundUploadMayStillArrive,
    ...(uploadAttemptToken === undefined
      ? {}
      : { upload_attempt_token: uploadAttemptToken }),
    ...(cleanupNotBefore === undefined
      ? {}
      : { cleanup_not_before: cleanupNotBefore }),
    ...(foregroundUploadTerminalAt === undefined
      ? {}
      : { foreground_upload_terminal_at: foregroundUploadTerminalAt }),
  });
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function objectScopeFingerprintV1(scope: ObjectScopeV1): string {
  const canonical =
    scope.scope_kind === "global"
      ? JSON.stringify(["global"])
      : JSON.stringify([
          "bot",
          scope.workspace_id,
          scope.bot_id,
          scope.owner_agent_id,
          scope.deployment_environment,
          scope.release_channel,
        ]);
  return sha256(canonical);
}

function physicalObjectKey(record: {
  readonly scope: ObjectScopeV1;
  readonly scope_fingerprint: string;
  readonly object_class: string;
  readonly object_ref: ObjectRefV1;
}): string {
  return [
    "v1",
    record.scope.scope_kind,
    record.scope_fingerprint,
    record.object_class,
    record.object_ref,
  ].join("/");
}

function requestFingerprint(
  request: PutImmutableRequestV1,
  scopeFingerprint: string,
): string {
  return sha256(
    JSON.stringify([
      request.owner_service,
      request.owner_object_id,
      request.owner_state_version,
      request.object_class,
      scopeFingerprint,
      request.idempotency_key,
      request.expected_sha256,
      request.size_bytes,
      request.media_type,
      request.retention_until,
    ]),
  );
}

function resultFromRecord(
  record: ObjectMetadataRecordV1,
  replayed: boolean,
): PutImmutableResultV1 {
  return {
    object_ref: record.object_ref,
    version: record.version,
    sha256: record.sha256,
    size_bytes: record.size_bytes,
    media_type: record.media_type,
    retention_until: record.retention_until,
    replayed,
  };
}

function assertPutRecordBindingV1(
  record: ObjectMetadataRecordV1,
  request: PutImmutableRequestV1,
  scopeFingerprint: string,
  putRequestFingerprint: string,
  expected?: Readonly<{
    object_ref: ObjectRefV1;
    version: string;
  }>,
): void {
  if (
    record.owner_service !== request.owner_service ||
    record.owner_object_id !== request.owner_object_id ||
    record.owner_state_version !== request.owner_state_version ||
    record.object_class !== request.object_class ||
    record.scope_fingerprint !== scopeFingerprint ||
    objectScopeFingerprintV1(record.scope) !== scopeFingerprint ||
    record.idempotency_key !== request.idempotency_key ||
    record.request_fingerprint !== putRequestFingerprint ||
    record.sha256 !== request.expected_sha256 ||
    record.size_bytes !== request.size_bytes ||
    record.media_type !== request.media_type ||
    record.retention_until !== request.retention_until ||
    record.state !== "available" ||
    (expected !== undefined &&
      (record.object_ref !== expected.object_ref ||
        record.version !== expected.version))
  ) {
    fail("integrity_mismatch", "owner put result is not bound to the request");
  }
}

function assertDeleteRecordBindingV1(
  deletedRecord: ObjectMetadataRecordV1,
  authorizedRecord: ObjectMetadataRecordV1,
  request: DeleteIfEligibleRequestV1,
): void {
  if (
    deletedRecord.object_ref !== authorizedRecord.object_ref ||
    deletedRecord.owner_service !== authorizedRecord.owner_service ||
    deletedRecord.owner_object_id !== authorizedRecord.owner_object_id ||
    deletedRecord.owner_state_version !== authorizedRecord.owner_state_version ||
    deletedRecord.object_class !== authorizedRecord.object_class ||
    deletedRecord.scope_fingerprint !== authorizedRecord.scope_fingerprint ||
    objectScopeFingerprintV1(deletedRecord.scope) !==
      authorizedRecord.scope_fingerprint ||
    deletedRecord.idempotency_key !== authorizedRecord.idempotency_key ||
    deletedRecord.request_fingerprint !== authorizedRecord.request_fingerprint ||
    deletedRecord.version !== authorizedRecord.version ||
    deletedRecord.sha256 !== authorizedRecord.sha256 ||
    deletedRecord.size_bytes !== authorizedRecord.size_bytes ||
    deletedRecord.media_type !== authorizedRecord.media_type ||
    deletedRecord.retention_until !== authorizedRecord.retention_until ||
    deletedRecord.legal_hold !== authorizedRecord.legal_hold ||
    deletedRecord.state !== "deleted" ||
    deletedRecord.deletion_decision_version !==
      request.deletion_decision_version ||
    deletedRecord.deletion_idempotency_key !== request.idempotency_key
  ) {
    fail("integrity_mismatch", "owner delete result is not bound to the request");
  }
}

function assertReconciliationRecordBindingV1(
  completedRecord: ObjectMetadataRecordV1,
  claimedRecord: ObjectMetadataRecordV1,
  expectedState: "available" | "deleted",
  expectedVersion: string,
): void {
  if (
    completedRecord.object_ref !== claimedRecord.object_ref ||
    completedRecord.owner_service !== claimedRecord.owner_service ||
    completedRecord.owner_object_id !== claimedRecord.owner_object_id ||
    completedRecord.owner_state_version !== claimedRecord.owner_state_version ||
    completedRecord.object_class !== claimedRecord.object_class ||
    completedRecord.scope_fingerprint !== claimedRecord.scope_fingerprint ||
    objectScopeFingerprintV1(completedRecord.scope) !==
      claimedRecord.scope_fingerprint ||
    completedRecord.idempotency_key !== claimedRecord.idempotency_key ||
    completedRecord.request_fingerprint !== claimedRecord.request_fingerprint ||
    completedRecord.version !== expectedVersion ||
    completedRecord.sha256 !== claimedRecord.sha256 ||
    completedRecord.size_bytes !== claimedRecord.size_bytes ||
    completedRecord.media_type !== claimedRecord.media_type ||
    completedRecord.retention_until !== claimedRecord.retention_until ||
    completedRecord.legal_hold !== claimedRecord.legal_hold ||
    completedRecord.state !== expectedState ||
    completedRecord.deletion_decision_version !==
      claimedRecord.deletion_decision_version ||
    completedRecord.deletion_idempotency_key !==
      claimedRecord.deletion_idempotency_key
  ) {
    fail(
      "integrity_mismatch",
      "owner reconciliation result is not bound to the claimed record",
    );
  }
}

function verifyingUploadStream(
  body: AsyncIterable<Uint8Array>,
  expectedSha256: string,
  expectedSize: number,
): {
  readonly body: AsyncIterable<Uint8Array>;
  assertComplete(): void;
  failure(): unknown;
  completed(): boolean;
} {
  const digest = createHash("sha256");
  let total = 0;
  let completed = false;
  let streamFailure: unknown;
  const stream = async function* (): AsyncIterable<Uint8Array> {
    try {
      for await (const chunk of body) {
        const detached = detachedBoundedByteChunkV1(
          chunk,
          expectedSize - total,
          "precondition_failed",
          "object body must yield bounded Uint8Array chunks",
          "integrity_mismatch",
          "object body is larger than declared size",
        );
        total += detached.byteLength;
        digest.update(detached);
        yield detached;
      }
      completed = true;
    } catch (error) {
      streamFailure = error;
      throw error;
    }
  };
  return {
    body: stream(),
    assertComplete() {
      if (streamFailure !== undefined) throw streamFailure;
      const actualSha256 = completed
        ? `sha256:${digest.digest("hex")}`
        : "incomplete";
      if (!completed || total !== expectedSize || actualSha256 !== expectedSha256) {
        streamFailure = new ObjectStoreErrorV1(
          "integrity_mismatch",
          "object body does not match declared integrity",
          false,
        );
        throw streamFailure;
      }
    },
    failure: () => streamFailure,
    completed: () => completed,
  };
}

async function* verifiedReadStream(
  body: AsyncIterable<Uint8Array>,
  expectedLength: number,
  expectedSha256?: string,
): AsyncIterable<Uint8Array> {
  const digest = expectedSha256 === undefined ? undefined : createHash("sha256");
  let total = 0;
  try {
    for await (const chunk of body) {
      const detached = detachedBoundedByteChunkV1(
        chunk,
        expectedLength - total,
        "integrity_mismatch",
        "object storage returned a malformed or oversized byte chunk",
      );
      total += detached.byteLength;
      digest?.update(detached);
      yield detached;
    }
  } catch (error) {
    if (error instanceof ObjectStoreErrorV1) throw error;
    fail("storage_unavailable", "object storage stream failed", true);
  }
  if (
    total !== expectedLength ||
    (digest !== undefined && `sha256:${digest.digest("hex")}` !== expectedSha256)
  ) {
    fail("integrity_mismatch", "stored object bytes failed integrity verification");
  }
}

function validatePutRequest(request: PutImmutableRequestV1, now: Date): void {
  if (
    !boundedIdentity(request.owner_object_id) ||
    !Number.isSafeInteger(request.owner_state_version) ||
    request.owner_state_version < 1
  ) {
    fail("precondition_failed", "invalid owner object identity");
  }
  if (!tokenPattern.test(request.idempotency_key)) {
    fail("precondition_failed", "invalid idempotency key");
  }
  if (!sha256Pattern.test(request.expected_sha256)) {
    fail("precondition_failed", "expected_sha256 must use canonical sha256:<hex>");
  }
  if (!Number.isSafeInteger(request.size_bytes) || request.size_bytes < 0) {
    fail("precondition_failed", "size_bytes must be a non-negative safe integer");
  }
  if (!mediaTypePattern.test(request.media_type)) {
    fail("precondition_failed", "invalid media type");
  }
  const retention = Date.parse(request.retention_until);
  if (!Number.isFinite(retention) || retention <= now.getTime()) {
    fail("precondition_failed", "retention_until must be a future instant");
  }
}

function validateBackendHead(
  record: ObjectMetadataRecordV1,
  head: BackendObjectHeadV1,
): void {
  if (
    head.version !== record.version ||
    head.sha256 !== record.sha256 ||
    head.size_bytes !== record.size_bytes ||
    head.media_type !== record.media_type
  ) {
    fail("integrity_mismatch", "stored object metadata does not match owner metadata");
  }
}

function publicHead(record: ObjectMetadataRecordV1): ObjectHeadV1 {
  return {
    object_ref: record.object_ref,
    version: record.version,
    sha256: record.sha256,
    size_bytes: record.size_bytes,
    media_type: record.media_type,
    retention_until: record.retention_until,
  };
}

function snapshotDenseArrayV1(
  value: unknown,
  label: string,
  maxLength: number,
): readonly unknown[] {
  if (!Array.isArray(value) || isProxy(value)) {
    throw new Error(`${label} must be an array`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const lengthDescriptor = Object.getOwnPropertyDescriptor(
    descriptors,
    "length",
  )?.value as PropertyDescriptor | undefined;
  const length = lengthDescriptor?.value as unknown;
  if (
    typeof length !== "number" ||
    !Number.isSafeInteger(length) ||
    length < 0 ||
    length > maxLength
  ) {
    throw new Error(`${label} is outside the bounded contract`);
  }
  const expectedKeys = new Set([
    "length",
    ...Array.from({ length }, (_entry, index) => String(index)),
  ]);
  const keys = Reflect.ownKeys(descriptors);
  if (
    keys.some((key) => typeof key !== "string") ||
    (keys as string[]).some((key) => !expectedKeys.has(key)) ||
    keys.length !== expectedKeys.size
  ) {
    throw new Error(`${label} must be a dense own-data array`);
  }
  const snapshot: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      throw new Error(`${label} must be a dense own-data array`);
    }
    snapshot.push(descriptor.value);
  }
  return Object.freeze(snapshot);
}

export interface ObjectStoreAdapterOptionsV1 {
  readonly backend: ObjectStorageBackendV1;
  readonly metadataRepository: ObjectMetadataRepositoryV1;
  readonly accessPolicyVerifier: ObjectAccessPolicyVerifierV1;
  readonly policies: readonly ObjectClassPolicyV1[];
  readonly now?: () => Date;
}

function snapshotPolicy(policy: ObjectClassPolicyV1): ObjectClassPolicyV1 {
  const data = ownDataRecordV1(policy, [
    "bucket",
    "capabilities",
    "max_size_bytes",
    "media_types",
    "object_class",
    "owner_service",
    "scope_kinds",
  ]);
  const capabilities = ownDataRecordV1(data?.capabilities, [
    "delete",
    "get",
    "grant",
    "head",
    "put",
  ]);
  if (data === undefined || capabilities === undefined) {
    throw new Error("object class policy must contain only own data properties");
  }
  return Object.freeze({
    owner_service: data.owner_service as ObjectClassPolicyV1["owner_service"],
    object_class: data.object_class as string,
    bucket: data.bucket as ObjectClassPolicyV1["bucket"],
    max_size_bytes: data.max_size_bytes as number,
    scope_kinds: snapshotDenseArrayV1(
      data.scope_kinds,
      "object scope kinds",
      2,
    ) as ObjectClassPolicyV1["scope_kinds"],
    media_types: snapshotDenseArrayV1(
      data.media_types,
      "object media types",
      128,
    ) as ObjectClassPolicyV1["media_types"],
    capabilities: Object.freeze({
      put: snapshotDenseArrayV1(
        capabilities.put,
        "object put capabilities",
        64,
      ) as readonly string[],
      head: snapshotDenseArrayV1(
        capabilities.head,
        "object head capabilities",
        64,
      ) as readonly string[],
      get: snapshotDenseArrayV1(
        capabilities.get,
        "object get capabilities",
        64,
      ) as readonly string[],
      grant: snapshotDenseArrayV1(
        capabilities.grant,
        "object grant capabilities",
        64,
      ) as readonly string[],
      delete: snapshotDenseArrayV1(
        capabilities.delete,
        "object delete capabilities",
        64,
      ) as readonly string[],
    }),
  });
}

export class ObjectStoreAdapterCoreV1
  implements ObjectStorePortV1, ObjectStoreReconciliationPortV1
{
  readonly #backend: ObjectStorageBackendV1;
  readonly #metadata: ObjectMetadataRepositoryV1;
  readonly #accessPolicyVerifier: ObjectAccessPolicyVerifierV1;
  readonly #policies: ReadonlyMap<string, ObjectClassPolicyV1>;
  readonly #now: () => Date;

  public constructor(options: ObjectStoreAdapterOptionsV1) {
    const policies = snapshotDenseArrayV1(
      options.policies,
      "object class policies",
      256,
    ).map((policy) => snapshotPolicy(policy as ObjectClassPolicyV1));
    validateObjectClassPoliciesV1(policies);
    this.#backend = options.backend;
    this.#metadata = options.metadataRepository;
    this.#accessPolicyVerifier = options.accessPolicyVerifier;
    this.#policies = new Map(
      policies.map((policy) => [
        `${policy.owner_service}:${policy.object_class}`,
        policy,
      ]),
    );
    this.#now = options.now ?? (() => new Date());
  }

  #currentTime(): Date {
    const value = this.#now();
    const milliseconds =
      value instanceof Date ? value.getTime() : Number.NaN;
    if (!Number.isFinite(milliseconds)) {
      fail("storage_unavailable", "object store clock is unavailable", true);
    }
    // Do not retain a mutable Date supplied by composition code across an
    // authorization or persistence boundary.
    return new Date(milliseconds);
  }

  #policy(ownerService: string, objectClass: string): ObjectClassPolicyV1 {
    const policy = this.#policies.get(`${ownerService}:${objectClass}`);
    if (policy === undefined) {
      fail("authorization_scope_mismatch", "object class is not owned by caller");
    }
    return policy;
  }

  #authorize(
    policy: ObjectClassPolicyV1,
    authorization: ObjectAuthorizationV1,
    operation: ObjectOperationV1,
  ): void {
    if (
      authorization.owner_service !== policy.owner_service ||
      !policy.capabilities[operation].includes(authorization.capability)
    ) {
      fail("authorization_scope_mismatch", "object authorization was rejected");
    }
  }

  async #authorizedRecord(
    request: ObjectReadRequestV1,
    operation: ObjectAccessOperationV1,
    allowDeleted = false,
  ): Promise<{ record: ObjectMetadataRecordV1; policy: ObjectClassPolicyV1 }> {
    const scopeFingerprint = objectScopeFingerprintV1(request.scope);
    let accessDecision: VerifiedObjectAccessDecisionV1;
    try {
      accessDecision = snapshotAccessDecisionV1(
        await this.#accessPolicyVerifier.verify({
          access_decision_ref: request.access_decision_ref,
          operation,
          object_ref: request.object_ref,
          owner_service: request.owner_service,
          owner_object_id: request.owner_object_id,
          owner_state_version: request.owner_state_version,
          scope: request.scope,
          scope_fingerprint: scopeFingerprint,
          capability: request.capability,
          retention_policy_version: request.retention_policy_version,
          redaction_policy_version: request.redaction_policy_version,
        }),
      );
    } catch {
      fail("authorization_scope_mismatch", "object authorization was rejected");
    }
    if (
      accessDecision.authorized !== true ||
      accessDecision.access_decision_ref !== request.access_decision_ref ||
      accessDecision.operation !== operation ||
      accessDecision.object_ref !== request.object_ref ||
      accessDecision.owner_service !== request.owner_service ||
      accessDecision.owner_object_id !== request.owner_object_id ||
      accessDecision.owner_state_version !== request.owner_state_version ||
      accessDecision.scope_fingerprint !== scopeFingerprint ||
      objectScopeFingerprintV1(accessDecision.scope) !== scopeFingerprint ||
      accessDecision.capability !== request.capability ||
      accessDecision.retention_policy_version !==
        request.retention_policy_version ||
      accessDecision.redaction_policy_version !== request.redaction_policy_version ||
      !tokenPattern.test(request.access_decision_ref) ||
      !tokenPattern.test(request.retention_policy_version) ||
      !tokenPattern.test(request.redaction_policy_version)
    ) {
      fail("authorization_scope_mismatch", "object authorization was rejected");
    }
    let returnedRecord: ObjectMetadataRecordV1 | undefined;
    try {
      returnedRecord = await this.#metadata.findByRef(request.object_ref);
    } catch {
      fail("storage_unavailable", "owner metadata is unavailable", true);
    }
    const record =
      returnedRecord === undefined
        ? undefined
        : snapshotMetadataRecordV1(returnedRecord);
    if (record === undefined || (!allowDeleted && record.state === "deleted")) {
      fail("object_not_found", "object was not found");
    }
    if (
      record.state !== "available" &&
      !(allowDeleted &&
        (record.state === "deleted" || record.state === "delete_pending"))
    ) {
      fail("precondition_failed", "object is not available", true);
    }
    const policy = this.#policy(record.owner_service, record.object_class);
    this.#authorize(policy, request, operation);
    if (objectScopeFingerprintV1(record.scope) !== record.scope_fingerprint) {
      fail("integrity_mismatch", "owner object scope metadata is inconsistent");
    }
    if (objectScopeFingerprintV1(request.scope) !== record.scope_fingerprint) {
      fail("authorization_scope_mismatch", "object scope does not match caller");
    }
    if (
      record.owner_object_id !== request.owner_object_id ||
      record.owner_state_version !== request.owner_state_version ||
      accessDecision.retention_until !== record.retention_until ||
      !Number.isFinite(Date.parse(accessDecision.retention_until))
    ) {
      fail("authorization_scope_mismatch", "object retention decision is stale");
    }
    return { record, policy };
  }

  async #backendHead(
    record: ObjectMetadataRecordV1,
    policy: ObjectClassPolicyV1,
  ): Promise<BackendObjectHeadV1> {
    try {
      const head = snapshotBackendHeadV1(
        await this.#backend.head(policy.bucket, physicalObjectKey(record)),
      );
      validateBackendHead(record, head);
      return head;
    } catch (error) {
      if (error instanceof ObjectStoreErrorV1) throw error;
      fail("storage_unavailable", "object storage is unavailable", true);
    }
  }

  async #readBackVerifiedPhysicalHead(
    record: Pick<
      ObjectMetadataRecordV1,
      "sha256" | "size_bytes" | "media_type"
    >,
    policy: ObjectClassPolicyV1,
    key: string,
  ): Promise<BackendObjectHeadV1> {
    const head = snapshotBackendHeadV1(
      await this.#backend.head(policy.bucket, key),
    );
    const streamed = snapshotBackendStreamV1(
      await this.#backend.get(policy.bucket, key),
    );
    if (
      head.version.length === 0 ||
      head.size_bytes !== record.size_bytes ||
      head.media_type !== record.media_type ||
      streamed.offset !== 0 ||
      streamed.length !== record.size_bytes ||
      streamed.total_size_bytes !== record.size_bytes
    ) {
      fail("integrity_mismatch", "stored object metadata failed read-back verification");
    }
    const digest = createHash("sha256");
    let total = 0;
    for await (const chunk of streamed.body) {
      const detached = detachedBoundedByteChunkV1(
        chunk,
        record.size_bytes - total,
        "integrity_mismatch",
        "stored object returned a malformed or oversized byte chunk",
      );
      total += detached.byteLength;
      digest.update(detached);
    }
    const actualSha256 = `sha256:${digest.digest("hex")}`;
    if (total !== record.size_bytes || actualSha256 !== record.sha256) {
      fail("integrity_mismatch", "stored object bytes failed read-back verification");
    }
    return { ...head, sha256: actualSha256 };
  }

  #startPutForegroundLeaseHeartbeat(input: {
    readonly reservation_id: string;
    readonly foreground_lease_token: string;
  }): Readonly<{ stop(): Promise<unknown> }> {
    let stopped = false;
    let renewalFailure: unknown;
    let inFlight = Promise.resolve();
    let timer: NodeJS.Timeout | undefined;
    const schedule = (): void => {
      if (stopped || renewalFailure !== undefined) return;
      timer = setTimeout(() => {
        timer = undefined;
        inFlight = Promise.resolve().then(async () => {
          try {
            const now = this.#currentTime();
            await this.#metadata.renewPutForegroundLease({
              ...input,
              now,
              foreground_lease_until: new Date(
                now.getTime() + foregroundUploadLeaseMs,
              ),
            });
          } catch (error) {
            renewalFailure = error;
          }
        }).finally(schedule);
      }, 30_000);
      timer.unref();
    };
    schedule();
    return Object.freeze({
      async stop(): Promise<unknown> {
        if (!stopped) {
          stopped = true;
          if (timer !== undefined) {
            clearTimeout(timer);
            timer = undefined;
          }
        }
        await inFlight;
        return renewalFailure;
      },
    });
  }

  public async reconcilePending(
    request: ReconcileObjectStoreRequestV1,
    signal?: AbortSignal,
  ): Promise<ReconcileObjectStoreResultV1> {
    request = snapshotReconcileRequestV1(request);
    signal?.throwIfAborted();
    if (
      !tokenPattern.test(request.worker_id) ||
      !Number.isSafeInteger(request.limit) ||
      request.limit < 1 ||
      request.limit > 100 ||
      !Number.isSafeInteger(request.lease_seconds) ||
      request.lease_seconds < 1 ||
      request.lease_seconds > 300
    ) {
      fail("precondition_failed", "invalid reconciliation claim request");
    }
    const now = this.#currentTime();
    const lockedUntil = new Date(now.getTime() + request.lease_seconds * 1_000);
    let claims;
    try {
      claims = await this.#metadata.claimReconciliation({
        worker_id: request.worker_id,
        now,
        locked_until: lockedUntil,
        limit: request.limit,
        expired_upload_cleanup_not_before: new Date(
          now.getTime() + expiredUploadCleanupGraceMs,
        ),
        ...(request.reservation_id === undefined
          ? {}
          : { reservation_id: request.reservation_id }),
      });
    } catch {
      fail("storage_unavailable", "reconciliation claim is unavailable", true);
    }
    try {
      claims = snapshotDenseArrayV1(
        claims,
        "ObjectStore reconciliation claims",
        request.limit,
      ).map(snapshotReconciliationClaimV1);
    } catch {
      fail(
        "storage_unavailable",
        "reconciliation claim metadata is malformed or exceeded the bounded requested batch",
        true,
      );
    }
    const reservationIds = new Set<string>();
    const claimTokens = new Set<string>();
    for (const claim of claims) {
      if (
        typeof claim.reservation_id !== "string" ||
        claim.reservation_id.length === 0 ||
        claim.reservation_id.length > 512 ||
        typeof claim.claim_token !== "string" ||
        claim.claim_token.length === 0 ||
        claim.claim_token.length > 512 ||
        reservationIds.has(claim.reservation_id) ||
        claimTokens.has(claim.claim_token)
      ) {
        fail(
          "storage_unavailable",
          "reconciliation claim identities are invalid or duplicated",
          true,
        );
      }
      reservationIds.add(claim.reservation_id);
      claimTokens.add(claim.claim_token);
    }
    let completed = 0;
    let retryScheduled = 0;
    for (const claim of claims) {
      try {
        // Abort only before a claim's physical/metadata convergence starts. If
        // cancellation arrives during a sink operation, finish its fenced ACK
        // rather than pretending the external side effect was rolled back.
        signal?.throwIfAborted();
        if (
          !Number.isSafeInteger(claim.attempt) ||
          claim.attempt < 1 ||
          !Number.isSafeInteger(claim.claim_generation) ||
          claim.claim_generation < 1 ||
          typeof claim.foreground_upload_may_still_arrive !== "boolean"
        ) {
          throw new Error(
            "ObjectStore reconciliation claim metadata is invalid",
          );
        }
        const putOperation =
          claim.operation === "put_finalize" ||
          claim.operation === "put_cleanup";
        if (
          !putOperation &&
          claim.operation !== "delete_finalize"
        ) {
          throw new Error("unsupported ObjectStore reconciliation operation");
        }
        if (
          (putOperation && claim.record.state !== "put_pending") ||
          (claim.operation === "delete_finalize" &&
            claim.record.state !== "delete_pending")
        ) {
          throw new Error(
            "ObjectStore reconciliation operation does not match metadata state",
          );
        }
        if (
          claim.foreground_upload_may_still_arrive &&
          claim.operation === "delete_finalize"
        ) {
          throw new Error(
            "ObjectStore late-upload provenance is invalid for delete reconciliation",
          );
        }
        if (
          claim.foreground_upload_may_still_arrive &&
          (claim.upload_attempt_token === undefined ||
            !tokenPattern.test(claim.upload_attempt_token) ||
            claim.foreground_upload_terminal_at === undefined ||
            !Number.isFinite(Date.parse(claim.foreground_upload_terminal_at)))
        ) {
          throw new Error(
            "ObjectStore late-upload reconciliation provenance is incomplete",
          );
        }
        if (
          objectScopeFingerprintV1(claim.record.scope) !==
          claim.record.scope_fingerprint
        ) {
          throw new Error(
            "ObjectStore reconciliation record has inconsistent scope metadata",
          );
        }
        const policy = this.#policy(
          claim.record.owner_service,
          claim.record.object_class,
        );
        const key = physicalObjectKey(claim.record);
        if (claim.operation === "put_finalize") {
          let head: BackendObjectHeadV1 | undefined;
          try {
            head = await this.#readBackVerifiedPhysicalHead(
              claim.record,
              policy,
              key,
            );
          } catch (error) {
            if (
              error instanceof ObjectStorageBackendErrorV1 &&
              error.code === "not_found"
            ) {
              await this.#metadata.redirectReconciliation({
                reservation_id: claim.reservation_id,
                claim_token: claim.claim_token,
                claim_generation: claim.claim_generation,
                operation: "put_cleanup",
                last_error: "pending_put_not_visible",
                ...(claim.foreground_upload_may_still_arrive
                  ? {
                      next_retry_at: new Date(
                        now.getTime() + expiredUploadCleanupGraceMs,
                      ),
                    }
                  : {}),
              });
              retryScheduled += 1;
              continue;
            }
            if (
              error instanceof ObjectStoreErrorV1 &&
              error.code === "integrity_mismatch"
            ) {
              await this.#metadata.redirectReconciliation({
                reservation_id: claim.reservation_id,
                claim_token: claim.claim_token,
                claim_generation: claim.claim_generation,
                operation: "put_cleanup",
                last_error: "pending_put_integrity_mismatch",
                ...(claim.foreground_upload_may_still_arrive
                  ? {
                      next_retry_at: new Date(
                        now.getTime() + expiredUploadCleanupGraceMs,
                      ),
                    }
                  : {}),
              });
              retryScheduled += 1;
              continue;
            }
            throw error;
          }
          if (
            head.version.length === 0 ||
            head.sha256 !== claim.record.sha256 ||
            head.size_bytes !== claim.record.size_bytes ||
            head.media_type !== claim.record.media_type
          ) {
            await this.#metadata.redirectReconciliation({
              reservation_id: claim.reservation_id,
              claim_token: claim.claim_token,
              claim_generation: claim.claim_generation,
              operation: "put_cleanup",
              last_error: "pending_put_integrity_mismatch",
              ...(claim.foreground_upload_may_still_arrive
                ? {
                    next_retry_at: new Date(
                      now.getTime() + expiredUploadCleanupGraceMs,
                    ),
                  }
                : {}),
            });
            retryScheduled += 1;
            continue;
          }
          const completedRecord = await this.#metadata.completeReconciliation({
            reservation_id: claim.reservation_id,
            claim_token: claim.claim_token,
            claim_generation: claim.claim_generation,
            version: head.version,
          });
          if (completedRecord === undefined) {
            fail(
              "integrity_mismatch",
              "owner reconciliation omitted the committed put record",
            );
          }
          assertReconciliationRecordBindingV1(
            snapshotMetadataRecordV1(completedRecord),
            claim.record,
            "available",
            head.version,
          );
        } else if (
          claim.operation === "put_cleanup" ||
          claim.operation === "delete_finalize"
        ) {
          if (claim.foreground_upload_may_still_arrive) {
            const terminalAt =
              claim.foreground_upload_terminal_at === undefined
                ? Number.NaN
                : Date.parse(claim.foreground_upload_terminal_at);
            const uploadAttemptToken = claim.upload_attempt_token;
            if (!Number.isFinite(terminalAt) || now.getTime() < terminalAt) {
              await this.#metadata.releaseReconciliation({
                reservation_id: claim.reservation_id,
                claim_token: claim.claim_token,
                claim_generation: claim.claim_generation,
                last_error: "foreground_upload_not_terminal",
                next_retry_at: new Date(
                  Math.max(
                    now.getTime() + expiredUploadCleanupGraceMs,
                    Number.isFinite(terminalAt) ? terminalAt : now.getTime(),
                  ),
                ),
              });
              retryScheduled += 1;
              continue;
            }
            if (
              uploadAttemptToken === undefined ||
              this.#backend.finalizeAbandonedPutAttempt === undefined
            ) {
              await this.#metadata.releaseReconciliation({
                reservation_id: claim.reservation_id,
                claim_token: claim.claim_token,
                claim_generation: claim.claim_generation,
                last_error: "foreground_upload_terminality_unavailable",
                next_retry_at: new Date(
                  now.getTime() + expiredUploadCleanupGraceMs,
                ),
              });
              retryScheduled += 1;
              continue;
            }
            const terminal = snapshotFinalizeAbandonedPutAttemptResultV1(
              await this.#backend.finalizeAbandonedPutAttempt({
                bucket: policy.bucket,
                key,
                upload_attempt_token: uploadAttemptToken,
              }),
            );
            if (terminal.kind !== "terminal") {
              await this.#metadata.releaseReconciliation({
                reservation_id: claim.reservation_id,
                claim_token: claim.claim_token,
                claim_generation: claim.claim_generation,
                last_error: "foreground_upload_not_terminal",
                next_retry_at: new Date(
                  now.getTime() + expiredUploadCleanupGraceMs,
                ),
              });
              retryScheduled += 1;
              continue;
            }
            const receiptTerminalAt = Date.parse(terminal.receipt.terminal_at);
            if (
              terminal.receipt.upload_attempt_token !== uploadAttemptToken ||
              receiptTerminalAt <
                Date.parse(claim.foreground_upload_terminal_at as string)
            ) {
              throw new Error(
                "ObjectStore terminal receipt is not bound to the abandoned upload",
              );
            }
            const cleanupResult = await this.#metadata.completeReconciliation({
              reservation_id: claim.reservation_id,
              claim_token: claim.claim_token,
              claim_generation: claim.claim_generation,
              backend_put_terminal_receipt: terminal.receipt,
            });
            if (cleanupResult !== undefined) {
              fail(
                "integrity_mismatch",
                "owner reconciliation returned a record for put cleanup",
              );
            }
          } else {
            try {
              await this.#backend.delete(policy.bucket, key);
            } catch (error) {
              if (
                !(error instanceof ObjectStorageBackendErrorV1) ||
                error.code !== "not_found"
              ) {
                throw error;
              }
            }
            const completedRecord = await this.#metadata.completeReconciliation({
              reservation_id: claim.reservation_id,
              claim_token: claim.claim_token,
              claim_generation: claim.claim_generation,
            });
            if (claim.operation === "put_cleanup") {
              if (completedRecord !== undefined) {
                fail(
                  "integrity_mismatch",
                  "owner reconciliation returned a record for put cleanup",
                );
              }
            } else {
              if (completedRecord === undefined) {
                fail(
                  "integrity_mismatch",
                  "owner reconciliation omitted the committed delete record",
                );
              }
              assertReconciliationRecordBindingV1(
                snapshotMetadataRecordV1(completedRecord),
                claim.record,
                "deleted",
                claim.record.version,
              );
            }
          }
        }
        completed += 1;
      } catch (error) {
        retryScheduled += 1;
        const retryAttempt =
          Number.isSafeInteger(claim.attempt) && claim.attempt >= 1
            ? claim.attempt
            : 1;
        await this.#metadata.releaseReconciliation({
          reservation_id: claim.reservation_id,
          claim_token: claim.claim_token,
          claim_generation: claim.claim_generation,
          last_error: closedObjectReconciliationFailureV1(error),
          next_retry_at: new Date(
            now.getTime() + Math.min(60_000, retryAttempt * 1_000),
          ),
        });
      }
    }
    return {
      claimed: claims.length,
      completed,
      retry_scheduled: retryScheduled,
    };
  }

  public async putImmutable(
    request: PutImmutableRequestV1,
  ): Promise<PutImmutableResultV1> {
    request = snapshotPutRequestV1(request);
    const now = this.#currentTime();
    validatePutRequest(request, now);
    const policy = this.#policy(request.owner_service, request.object_class);
    this.#authorize(policy, request, "put");
    if (
      !policy.scope_kinds.includes(request.scope.scope_kind) ||
      request.size_bytes > policy.max_size_bytes ||
      !policy.media_types.includes(request.media_type)
    ) {
      fail("precondition_failed", "object violates class size or media policy");
    }
    const upload = verifyingUploadStream(
      request.body,
      request.expected_sha256,
      request.size_bytes,
    );
    const scopeFingerprint = objectScopeFingerprintV1(request.scope);
    const fingerprint = requestFingerprint(request, scopeFingerprint);

    const reservePut = async () =>
      snapshotReservePutResultV1(
        await this.#metadata.reservePut({
          owner_service: request.owner_service,
          owner_object_id: request.owner_object_id,
          owner_state_version: request.owner_state_version,
          object_class: request.object_class,
          scope: request.scope,
          scope_fingerprint: scopeFingerprint,
          idempotency_key: request.idempotency_key,
          request_fingerprint: fingerprint,
          sha256: request.expected_sha256,
          size_bytes: request.size_bytes,
          media_type: request.media_type,
          retention_until: request.retention_until,
          now,
          foreground_lease_until: new Date(
            now.getTime() + foregroundUploadLeaseMs,
          ),
        }),
      );
    let reservation;
    try {
      reservation = await reservePut();
    } catch {
      fail("storage_unavailable", "owner metadata is unavailable", true);
    }
    if (reservation.kind === "conflict") {
      fail("idempotency_conflict", "idempotency key was reused with different input");
    }
    if (reservation.kind === "pending") {
      await this.reconcilePending({
        worker_id: "inline-put-retry",
        limit: 1,
        lease_seconds: 30,
        reservation_id: reservation.reservation_id,
      });
      try {
        reservation = await reservePut();
      } catch {
        fail("storage_unavailable", "owner metadata is unavailable", true);
      }
    }
    if (reservation.kind === "pending" || reservation.kind === "busy") {
      fail("precondition_failed", "object reconciliation is still pending", true);
    }
    if (reservation.kind === "conflict") {
      fail("idempotency_conflict", "idempotency key was reused with different input");
    }
    if (reservation.kind === "replay") {
      assertPutRecordBindingV1(
        reservation.record,
        request,
        scopeFingerprint,
        fingerprint,
      );
      return resultFromRecord(reservation.record, true);
    }

    const key = physicalObjectKey({
      scope: request.scope,
      scope_fingerprint: scopeFingerprint,
      object_class: request.object_class,
      object_ref: reservation.object_ref,
    });
    const foregroundLeaseHeartbeat =
      this.#startPutForegroundLeaseHeartbeat({
        reservation_id: reservation.reservation_id,
        foreground_lease_token: reservation.foreground_lease_token,
      });
    let head: BackendObjectHeadV1;
    let backendPutCompleted = false;
    try {
      head = snapshotBackendHeadV1(
        await this.#backend.putIfAbsent({
          bucket: policy.bucket,
          key,
          upload_attempt_token: reservation.upload_attempt_token,
          body: upload.body,
          size_bytes: request.size_bytes,
          media_type: request.media_type,
          sha256: request.expected_sha256,
        }),
      );
      backendPutCompleted = true;
      upload.assertComplete();
      head = await this.#readBackVerifiedPhysicalHead(
        {
          sha256: request.expected_sha256,
          size_bytes: request.size_bytes,
          media_type: request.media_type,
        },
        policy,
        key,
      );
      const renewalFailure = await foregroundLeaseHeartbeat.stop();
      if (renewalFailure !== undefined) throw renewalFailure;
    } catch (error) {
      await foregroundLeaseHeartbeat.stop();
      if (upload.failure() === undefined && upload.completed()) {
        try {
          upload.assertComplete();
        } catch {
          // The classified integrity failure is handled by the branch below.
        }
      }
      const integrityFailure =
        upload.failure() instanceof ObjectStoreErrorV1
          ? upload.failure()
          : error instanceof ObjectStoreErrorV1 &&
              error.code === "integrity_mismatch"
            ? error
            : undefined;
      if (integrityFailure instanceof ObjectStoreErrorV1) {
        const foregroundUploadMayStillArrive = !backendPutCompleted;
        try {
          await this.#metadata.handoffPutReconciliation(
            reservation.reservation_id,
            "put_cleanup",
            reservation.foreground_lease_token,
            foregroundUploadMayStillArrive
              ? new Date(
                  this.#currentTime().getTime() + expiredUploadCleanupGraceMs,
                )
              : undefined,
            foregroundUploadMayStillArrive,
          );
        } catch {
          fail("storage_unavailable", "integrity cleanup requires reconciliation", true, {
            reconciliation_required: true,
            reservation_id: reservation.reservation_id,
            reconciliation_operation: "put_cleanup",
          });
        }
        let physicalCleanupComplete = false;
        try {
          await this.#backend.delete(policy.bucket, key);
          physicalCleanupComplete = true;
        } catch (cleanupError) {
          if (
            cleanupError instanceof ObjectStorageBackendErrorV1 &&
            cleanupError.code === "not_found"
          ) {
            physicalCleanupComplete = true;
          }
        }
        if (physicalCleanupComplete && backendPutCompleted) {
          try {
            await this.#metadata.abortPut(
              reservation.reservation_id,
              reservation.foreground_lease_token,
            );
          } catch {
            fail("storage_unavailable", "integrity cleanup requires reconciliation", true, {
              reconciliation_required: true,
              reservation_id: reservation.reservation_id,
              reconciliation_operation: "put_cleanup",
            });
          }
          throw integrityFailure;
        } else {
          fail("storage_unavailable", "integrity cleanup requires reconciliation", true, {
            reconciliation_required: true,
            reservation_id: reservation.reservation_id,
            reconciliation_operation: "put_cleanup",
          });
        }
      }
      if (
        error instanceof ObjectStorageBackendErrorV1 &&
        error.code === "already_exists"
      ) {
        await this.#metadata
          .handoffPutReconciliation(
            reservation.reservation_id,
            "put_finalize",
            reservation.foreground_lease_token,
          )
          .catch(() => undefined);
        fail(
          "storage_unavailable",
          "pre-existing physical object requires reconciliation",
          true,
          {
            reconciliation_required: true,
            reservation_id: reservation.reservation_id,
            reconciliation_operation: "put_finalize",
          },
        );
      }
      await this.#metadata
        .handoffPutReconciliation(
          reservation.reservation_id,
          "put_finalize",
          reservation.foreground_lease_token,
          new Date(this.#currentTime().getTime() + foregroundUploadLeaseMs),
          !backendPutCompleted,
        )
        .catch(() => undefined);
      fail("storage_unavailable", "object storage outcome requires reconciliation", true, {
        reconciliation_required: true,
        reservation_id: reservation.reservation_id,
      });
    }

    if (
      head.version.length === 0 ||
      head.sha256 !== request.expected_sha256 ||
      head.size_bytes !== request.size_bytes ||
      head.media_type !== request.media_type
    ) {
      try {
        await this.#metadata.handoffPutReconciliation(
          reservation.reservation_id,
          "put_cleanup",
          reservation.foreground_lease_token,
        );
        await this.#backend.delete(policy.bucket, key);
        await this.#metadata.abortPut(
          reservation.reservation_id,
          reservation.foreground_lease_token,
        );
        fail("integrity_mismatch", "stored object does not match put request");
      } catch (cleanupError) {
        if (cleanupError instanceof ObjectStoreErrorV1) throw cleanupError;
        fail("storage_unavailable", "integrity cleanup requires reconciliation", true, {
          reconciliation_required: true,
          reservation_id: reservation.reservation_id,
          reconciliation_operation: "put_cleanup",
        });
      }
    }
    try {
      const record = snapshotMetadataRecordV1(
        await this.#metadata.completePut({
          reservation_id: reservation.reservation_id,
          foreground_lease_token: reservation.foreground_lease_token,
          version: head.version,
        }),
      );
      assertPutRecordBindingV1(record, request, scopeFingerprint, fingerprint, {
        object_ref: reservation.object_ref,
        version: head.version,
      });
      return resultFromRecord(record, false);
    } catch (error) {
      const finalization = await this.#metadata
        .findPutFinalization(reservation.reservation_id)
        .then(snapshotPutFinalizationV1)
        .catch(() => ({ kind: "aborted_or_unknown" as const }));
      if (finalization.kind === "committed") {
        assertPutRecordBindingV1(
          finalization.record,
          request,
          scopeFingerprint,
          fingerprint,
          {
            object_ref: reservation.object_ref,
            version: head.version,
          },
        );
        return resultFromRecord(finalization.record, false);
      }
      await this.#metadata
        .handoffPutReconciliation(
          reservation.reservation_id,
          "put_finalize",
          reservation.foreground_lease_token,
        )
        .catch(() => undefined);
      fail("storage_unavailable", "owner metadata finalization requires reconciliation", true, {
        reconciliation_required: true,
        reservation_id: reservation.reservation_id,
        finalization_state: finalization.kind,
      });
    }
  }

  public async head(request: ObjectReadRequestV1): Promise<ObjectHeadV1> {
    request = snapshotReadRequestV1(request);
    const { record, policy } = await this.#authorizedRecord(request, "head");
    await this.#backendHead(record, policy);
    return publicHead(record);
  }

  public async getStream(
    request: ObjectRangeReadRequestV1,
  ): Promise<ObjectStreamResultV1> {
    request = snapshotRangeReadRequestV1(request);
    const { record, policy } = await this.#authorizedRecord(request, "get");
    await this.#backendHead(record, policy);
    let range: { readonly offset: number; readonly length: number } | undefined;
    if (request.range !== undefined) {
      const { offset, length } = request.range;
      if (
        !Number.isSafeInteger(offset) || !Number.isSafeInteger(length) ||
        offset < 0 || length <= 0 || offset >= record.size_bytes
      ) {
        fail("precondition_failed", "invalid object byte range");
      }
      range = { offset, length: Math.min(length, record.size_bytes - offset) };
    }
    let streamed;
    try {
      streamed = snapshotBackendStreamV1(
        await this.#backend.get(
          policy.bucket,
          physicalObjectKey(record),
          range,
        ),
      );
    } catch {
      fail("storage_unavailable", "object storage is unavailable", true);
    }
    if (
      streamed.total_size_bytes !== record.size_bytes ||
      streamed.offset !== (range?.offset ?? 0) ||
      streamed.length !== (range?.length ?? record.size_bytes)
    ) {
      fail("integrity_mismatch", "object storage returned inconsistent range metadata");
    }
    const contentRange = range === undefined
      ? undefined
      : `bytes ${range.offset}-${range.offset + range.length - 1}/${record.size_bytes}`;
    return {
      ...publicHead(record),
      body: verifiedReadStream(
        streamed.body,
        streamed.length,
        range === undefined ? record.sha256 : undefined,
      ),
      ...(contentRange === undefined ? {} : { content_range: contentRange }),
    };
  }

  public async issueReadGrant(
    request: IssueReadGrantRequestV1,
  ): Promise<ObjectReadGrantV1> {
    request = snapshotGrantRequestV1(request);
    if (
      !Number.isSafeInteger(request.ttl_seconds) ||
      request.ttl_seconds < 1 ||
      request.ttl_seconds > 300 ||
      !tokenPattern.test(request.redaction_policy_version) ||
      !tokenPattern.test(request.retention_policy_version)
    ) {
      fail("precondition_failed", "invalid read grant constraints");
    }
    const { record, policy } = await this.#authorizedRecord(request, "grant");
    await this.#backendHead(record, policy);
    const issuedAt = this.#currentTime();
    const objectRef = record.object_ref;
    const expiresAt = new Date(
      issuedAt.getTime() + request.ttl_seconds * 1_000,
    ).toISOString();
    let backendGrant: unknown;
    try {
      backendGrant = await this.#backend.issueReadGrant(
        policy.bucket,
        physicalObjectKey(record),
        request.ttl_seconds,
      );
    } catch {
      fail("storage_unavailable", "object storage is unavailable", true);
    }
    const grant = snapshotBackendReadGrantV1(backendGrant);
    return Object.freeze({
      grant,
      object_ref: objectRef,
      expires_at: expiresAt,
    });
  }

  public async deleteIfEligible(
    request: DeleteIfEligibleRequestV1,
  ): Promise<DeleteIfEligibleResultV1> {
    request = snapshotDeleteRequestV1(request);
    if (
      !Number.isSafeInteger(request.deletion_decision_version) ||
      request.deletion_decision_version < 1 ||
      !tokenPattern.test(request.idempotency_key)
    ) {
      fail("precondition_failed", "invalid deletion decision identity");
    }
    const { record, policy } = await this.#authorizedRecord(
      request,
      "delete",
      true,
    );
    const reserveDelete = async () =>
      snapshotReserveDeleteResultV1(
        await this.#metadata.reserveDelete({
          object_ref: record.object_ref,
          owner_service: request.owner_service,
          owner_object_id: request.owner_object_id,
          owner_state_version: request.owner_state_version,
          object_class: record.object_class,
          scope: request.scope,
          scope_fingerprint: record.scope_fingerprint,
          request_fingerprint: record.request_fingerprint,
          deletion_decision_version: request.deletion_decision_version,
          idempotency_key: request.idempotency_key,
          now: this.#currentTime(),
        }),
      );
    let reservation;
    try {
      reservation = await reserveDelete();
    } catch {
      fail("storage_unavailable", "owner metadata is unavailable", true);
    }
    if (reservation.kind === "not_found") {
      fail("object_not_found", "object was not found");
    }
    if (reservation.kind === "retention_active") {
      fail("retention_active", "object retention is still active", false, {
        retention_until: reservation.retention_until,
      });
    }
    if (reservation.kind === "hold_active") {
      fail("precondition_failed", "object is protected by a legal hold");
    }
    if (reservation.kind === "conflict") {
      fail("idempotency_conflict", "deletion identity conflicts with prior decision");
    }
    if (reservation.kind === "pending") {
      await this.reconcilePending({
        worker_id: "inline-delete-retry",
        limit: 1,
        lease_seconds: 30,
        reservation_id: reservation.reservation_id,
      });
      try {
        reservation = await reserveDelete();
      } catch {
        fail("storage_unavailable", "owner metadata is unavailable", true);
      }
    }
    if (reservation.kind === "pending" || reservation.kind === "busy") {
      fail("precondition_failed", "object reconciliation is still pending", true);
    }
    if (reservation.kind === "conflict") {
      fail("idempotency_conflict", "deletion identity conflicts with prior decision");
    }
    if (reservation.kind === "not_found") {
      fail("object_not_found", "object was not found");
    }
    if (reservation.kind === "retention_active") {
      fail("retention_active", "object retention is still active", false, {
        retention_until: reservation.retention_until,
      });
    }
    if (reservation.kind === "hold_active") {
      fail("precondition_failed", "object is protected by a legal hold");
    }
    if (reservation.kind === "replay") {
      assertDeleteRecordBindingV1(reservation.record, record, request);
      return { object_ref: record.object_ref, deleted: true, replayed: true };
    }

    try {
      await this.#backend.delete(policy.bucket, physicalObjectKey(record));
    } catch (error) {
      if (
        !(error instanceof ObjectStorageBackendErrorV1) ||
        error.code !== "not_found"
      ) {
        await this.#metadata
          .handoffDeleteReconciliation(reservation.reservation_id)
          .catch(() => undefined);
        fail("storage_unavailable", "object deletion outcome requires reconciliation", true, {
          reconciliation_required: true,
          reservation_id: reservation.reservation_id,
        });
      }
    }
    try {
      const completedRecord = snapshotMetadataRecordV1(
        await this.#metadata.completeDelete(reservation.reservation_id),
      );
      assertDeleteRecordBindingV1(completedRecord, record, request);
    } catch {
      const finalization = await this.#metadata
        .findDeleteFinalization(reservation.reservation_id)
        .then(snapshotDeleteFinalizationV1)
        .catch(() => ({ kind: "aborted_or_unknown" as const }));
      if (finalization.kind === "committed") {
        assertDeleteRecordBindingV1(finalization.record, record, request);
        return { object_ref: record.object_ref, deleted: true, replayed: false };
      }
      await this.#metadata
        .handoffDeleteReconciliation(reservation.reservation_id)
        .catch(() => undefined);
      fail("storage_unavailable", "owner metadata finalization requires reconciliation", true, {
        reconciliation_required: true,
        reservation_id: reservation.reservation_id,
        finalization_state: finalization.kind,
      });
    }
    return { object_ref: record.object_ref, deleted: true, replayed: false };
  }
}
