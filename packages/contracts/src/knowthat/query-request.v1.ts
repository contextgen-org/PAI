import { Type, type Static } from "@sinclair/typebox";

import {
  KnowThatCategoryV1Schema,
  KnowThatScopeV1Schema,
  assertKnowThatSchemaV1,
} from "./primitives.v1.js";

const limit = Type.Optional(
  Type.Integer({ minimum: 1, maximum: 200, default: 50 }),
);
const opaqueToken = Type.String({ minLength: 16, maxLength: 8_192 });

export const KnowThatQueryFirstPageRequestV1Schema = Type.Object(
  {
    schema_version: Type.Literal("knowthat_query.v1"),
    ...KnowThatScopeV1Schema.properties,
    categories: Type.Optional(
      Type.Array(KnowThatCategoryV1Schema, {
        maxItems: 7,
        uniqueItems: true,
      }),
    ),
    query: Type.Optional(Type.String({ minLength: 1, maxLength: 4_096 })),
    limit,
  },
  { additionalProperties: false },
);

export const KnowThatQueryNextPageRequestV1Schema = Type.Object(
  {
    schema_version: Type.Literal("knowthat_query.v1"),
    ...KnowThatScopeV1Schema.properties,
    snapshot_token: opaqueToken,
    cursor: opaqueToken,
    limit,
  },
  { additionalProperties: false },
);

export const KnowThatQueryRequestV1Schema = Type.Union(
  [
    KnowThatQueryFirstPageRequestV1Schema,
    KnowThatQueryNextPageRequestV1Schema,
  ],
  { $id: "urn:pai:knowthat:query-request:v1" },
);

export type KnowThatQueryFirstPageRequestV1 = Static<
  typeof KnowThatQueryFirstPageRequestV1Schema
>;
export type KnowThatQueryNextPageRequestV1 = Static<
  typeof KnowThatQueryNextPageRequestV1Schema
>;
export type KnowThatQueryRequestV1 = Static<
  typeof KnowThatQueryRequestV1Schema
>;

export function isKnowThatQueryNextPageRequestV1(
  request: KnowThatQueryRequestV1,
): request is KnowThatQueryNextPageRequestV1 {
  return "snapshot_token" in request;
}

export function assertKnowThatQueryRequestV1(
  value: unknown,
): asserts value is KnowThatQueryRequestV1 {
  assertKnowThatSchemaV1(
    KnowThatQueryRequestV1Schema,
    value,
    "KnowThat query request",
  );
}
