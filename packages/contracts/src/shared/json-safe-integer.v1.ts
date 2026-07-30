import { Type } from "@sinclair/typebox";

export const JSON_SAFE_INTEGER_MAX_V1 = Number.MAX_SAFE_INTEGER;

export const JsonSafeNonNegativeIntegerV1 = Type.Integer({
  minimum: 0,
  maximum: JSON_SAFE_INTEGER_MAX_V1,
});

export const JsonSafePositiveIntegerV1 = Type.Integer({
  minimum: 1,
  maximum: JSON_SAFE_INTEGER_MAX_V1,
});
