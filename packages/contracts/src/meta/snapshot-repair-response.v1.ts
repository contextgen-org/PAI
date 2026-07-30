import { Type, type Static } from "@sinclair/typebox";

import {
  MetaIdentifierV1Schema,
  MetaReasonCodeV1Schema,
  MetaSafeVersionV1Schema,
  MetaTimestampV1Schema,
} from "./primitives.v1.js";

const responseBase = {
  job_id: MetaIdentifierV1Schema,
  repair_id: MetaIdentifierV1Schema,
  input_revision: MetaSafeVersionV1Schema,
  snapshot_version: MetaSafeVersionV1Schema,
  duplicate_replayed: Type.Boolean(),
} as const;

export const MetaSnapshotRepairResponseV1Schema = Type.Union(
  [
    Type.Object(
      {
        ...responseBase,
        status: Type.Literal("accepted"),
        next_retry_at: MetaTimestampV1Schema,
        accepted_at: MetaTimestampV1Schema,
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        ...responseBase,
        status: Type.Literal("rejected"),
        next_retry_at: Type.Null(),
        accepted_at: Type.Null(),
        reason_code: MetaReasonCodeV1Schema,
      },
      { additionalProperties: false },
    ),
  ],
  { $id: "urn:pai:meta:snapshot-repair-response:v1" },
);

export type MetaSnapshotRepairResponseV1 = Static<
  typeof MetaSnapshotRepairResponseV1Schema
>;
