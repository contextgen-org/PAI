import { Type, type Static } from "@sinclair/typebox";

const nonEmptyOpaqueId = "[^\\r\\n:][^\\r\\n]*";

export const FeedbackDedupeScopeRefValueV1Schema = Type.Union([
    Type.Object(
      {
        kind: Type.Literal("conflict"),
        ref: Type.String({
          minLength: 10,
          maxLength: 512,
          pattern: `^conflict:${nonEmptyOpaqueId}$`,
        }),
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        kind: Type.Literal("candidate"),
        ref: Type.String({
          minLength: 11,
          maxLength: 512,
          pattern: `^candidate:${nonEmptyOpaqueId}$`,
        }),
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        kind: Type.Literal("schedule"),
        ref: Type.String({
          minLength: 10,
          maxLength: 512,
          pattern: `^schedule:${nonEmptyOpaqueId}$`,
        }),
      },
      { additionalProperties: false },
    ),
  ],
);

export const FeedbackDedupeScopeRefV1Schema = Type.Union(
  FeedbackDedupeScopeRefValueV1Schema.anyOf,
  { $id: "urn:pai:meta:feedback-dedupe-scope-ref:v1" },
);

export type FeedbackDedupeScopeRefV1 = Static<
  typeof FeedbackDedupeScopeRefV1Schema
>;
