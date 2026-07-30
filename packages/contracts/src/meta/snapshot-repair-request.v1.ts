import { Type, type Static } from "@sinclair/typebox";

import {
  MetaIdentifierV1Schema,
  MetaReasonCodeV1Schema,
  MetaSafeVersionV1Schema,
  MetaSha256V1Schema,
  MetaTimestampV1Schema,
} from "./primitives.v1.js";

export const MetaSnapshotRepairRequestV1Schema = Type.Object(
  {
    schema_version: Type.Literal("meta_snapshot_repair.v1"),
    repair_id: MetaIdentifierV1Schema,
    meta_job_id: MetaIdentifierV1Schema,
    trigger_process_id: MetaIdentifierV1Schema,
    previous_snapshot_ref: MetaIdentifierV1Schema,
    previous_snapshot_version: MetaSafeVersionV1Schema,
    previous_snapshot_hash: MetaSha256V1Schema,
    next_snapshot_ref: MetaIdentifierV1Schema,
    next_snapshot_version: MetaSafeVersionV1Schema,
    next_snapshot_hash: MetaSha256V1Schema,
    snapshot_retention_until: MetaTimestampV1Schema,
    reason_code: MetaReasonCodeV1Schema,
    idempotency_key: MetaIdentifierV1Schema,
    trace_id: MetaIdentifierV1Schema,
  },
  {
    $id: "urn:pai:meta:snapshot-repair-request:v1",
    additionalProperties: false,
  },
);

export type MetaSnapshotRepairRequestV1 = Static<
  typeof MetaSnapshotRepairRequestV1Schema
>;

export function assertMetaSnapshotRepairRequestSemanticBindingsV1(
  request: MetaSnapshotRepairRequestV1,
  nowMs = Date.now(),
): void {
  if (
    request.idempotency_key !== request.repair_id ||
    request.next_snapshot_version <= request.previous_snapshot_version ||
    Date.parse(request.snapshot_retention_until) <= nowMs
  ) {
    throw new Error("MetaSnapshotRepairRequestV1 semantic binding mismatch");
  }
}
