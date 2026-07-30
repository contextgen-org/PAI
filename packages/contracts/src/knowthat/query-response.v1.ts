import { Type, type Static } from "@sinclair/typebox";

import {
  KnowThatCategoryV1Schema,
  KnowThatIdV1Schema,
  KnowThatTimestampV1Schema,
  assertKnowThatSchemaV1,
} from "./primitives.v1.js";

export const KnowThatQueryFactV1Schema = Type.Object(
  {
    id: KnowThatIdV1Schema,
    semantic_key: Type.String({ minLength: 1, maxLength: 256 }),
    category: KnowThatCategoryV1Schema,
    subject: Type.String({ minLength: 1, maxLength: 4_096 }),
    predicate: Type.String({ minLength: 1, maxLength: 4_096 }),
    object: Type.String({ minLength: 1, maxLength: 4_096 }),
    confidence: Type.Number({ minimum: 0, maximum: 1 }),
    valid_from: Type.Optional(KnowThatTimestampV1Schema),
    valid_until: Type.Optional(KnowThatTimestampV1Schema),
    updated_at: KnowThatTimestampV1Schema,
  },
  { additionalProperties: false },
);

export const KnowThatQueryResponseV1Schema = Type.Object(
  {
    schema_version: Type.Literal("knowthat_query.v1"),
    snapshot_token: Type.String({ minLength: 16, maxLength: 8_192 }),
    query_revision: Type.Integer({
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    as_of: KnowThatTimestampV1Schema,
    facts: Type.Array(KnowThatQueryFactV1Schema, { maxItems: 200 }),
    next_cursor: Type.Optional(
      Type.String({ minLength: 16, maxLength: 8_192 }),
    ),
  },
  {
    $id: "urn:pai:knowthat:query-response:v1",
    additionalProperties: false,
  },
);

export type KnowThatQueryFactV1 = Static<typeof KnowThatQueryFactV1Schema>;
export type KnowThatQueryResponseV1 = Static<
  typeof KnowThatQueryResponseV1Schema
>;

export function assertKnowThatQueryResponseV1(
  value: unknown,
): asserts value is KnowThatQueryResponseV1 {
  assertKnowThatSchemaV1(
    KnowThatQueryResponseV1Schema,
    value,
    "KnowThat query response",
  );
}
