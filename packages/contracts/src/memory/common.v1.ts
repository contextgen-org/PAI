import { FormatRegistry, Type, type Static } from "@sinclair/typebox";

import { MemoryIdV1Schema } from "./write-batch.v1.js";

function utf8ByteLengthV1(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit <= 0x7f) bytes += 1;
    else if (codeUnit <= 0x7ff) bytes += 2;
    else if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const low = value.charCodeAt(index + 1);
      if (low < 0xdc00 || low > 0xdfff) {
        throw new Error("memory JSON rejects unpaired UTF-16 surrogates");
      }
      bytes += 4;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      throw new Error("memory JSON rejects unpaired UTF-16 surrogates");
    } else bytes += 3;
  }
  return bytes;
}

if (!FormatRegistry.Has("date-time")) {
  FormatRegistry.Set(
    "date-time",
    (value) =>
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.test(
        value,
      ) && Number.isFinite(Date.parse(value)),
  );
}

export const MemoryTimestampV1Schema = Type.String({
  format: "date-time",
  maxUtf8Bytes: 64,
});

export const MemorySha256V1Schema = Type.String({
  pattern: "^sha256:[0-9a-f]{64}$",
  maxUtf8Bytes: 71,
});

export const MemorySeriesStatusV1Schema = Type.Union([
  Type.Literal("active"),
  Type.Literal("pending_conflict"),
  Type.Literal("archived"),
  Type.Literal("merged"),
  Type.Literal("suppressed"),
]);

export const MemoryPointStatusV1Schema = Type.Union([
  Type.Literal("active"),
  Type.Literal("pending_conflict"),
  Type.Literal("superseded"),
  Type.Literal("downgraded"),
  Type.Literal("archived"),
  Type.Literal("rejected"),
]);

export const MemoryConflictStatusV1Schema = Type.Union([
  Type.Literal("open"),
  Type.Literal("auto_resolved"),
  Type.Literal("feedback_requested"),
  Type.Literal("resolved"),
  Type.Literal("ignored"),
]);

export const MemoryRevisionRefV1Schema = Type.Object(
  {
    aggregate_type: Type.Union([
      Type.Literal("memory_point"),
      Type.Literal("memory_series"),
      Type.Literal("memory_conflict"),
    ]),
    aggregate_id: MemoryIdV1Schema,
    revision_id: MemoryIdV1Schema,
  },
  { additionalProperties: false },
);

export const MemoryBotScopeV1Schema = Type.Object(
  {
    workspace_id: MemoryIdV1Schema,
    bot_id: MemoryIdV1Schema,
    owner_agent_id: MemoryIdV1Schema,
    deployment_environment: Type.Union([
      Type.Literal("local"),
      Type.Literal("dev"),
      Type.Literal("staging"),
      Type.Literal("prod"),
    ]),
    release_channel: Type.Union([
      Type.Literal("stable"),
      Type.Literal("canary"),
    ]),
  },
  { additionalProperties: false },
);

export const MemoryJsonSummaryV1Schema = Type.Record(
  Type.String({ minLength: 1, maxUtf8Bytes: 128 }),
  Type.Unknown(),
  { maxProperties: 128 },
);

export const MemoryAppliedCountsV1Schema = Type.Record(
  Type.String({ minLength: 1, maxUtf8Bytes: 128 }),
  Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }),
  { maxProperties: 128 },
);

export type MemorySeriesStatusV1 = Static<
  typeof MemorySeriesStatusV1Schema
>;
export type MemoryPointStatusV1 = Static<typeof MemoryPointStatusV1Schema>;
export type MemoryConflictStatusV1 = Static<
  typeof MemoryConflictStatusV1Schema
>;
export type MemoryRevisionRefV1 = Static<typeof MemoryRevisionRefV1Schema>;
export type MemoryBotScopeV1 = Static<typeof MemoryBotScopeV1Schema>;

export function assertSortedUniqueStringsV1(
  values: readonly string[],
  field: string,
): void {
  for (let index = 1; index < values.length; index += 1) {
    if (values[index - 1]!.localeCompare(values[index]!) >= 0) {
      throw new Error(`${field} must be sorted and unique`);
    }
  }
}

export function assertTimestampOrderV1(
  earlier: string,
  later: string,
  field: string,
): void {
  if (Date.parse(earlier) > Date.parse(later)) {
    throw new Error(`${field} timestamp order mismatch`);
  }
}

export function assertUniqueIdsV1(
  values: readonly string[],
  field: string,
): void {
  if (new Set(values).size !== values.length) {
    throw new Error(`${field} contains duplicate ids`);
  }
}

export function assertMemoryJsonSummaryV1(
  value: Readonly<Record<string, unknown>>,
  field: string,
): void {
  let visited = 0;
  const ancestors = new Set<object>();
  const visit = (entry: unknown, depth: number): void => {
    visited += 1;
    if (visited > 10_000 || depth > 16) {
      throw new Error(`${field} exceeds bounded JSON complexity`);
    }
    if (
      entry === null ||
      typeof entry === "string" ||
      typeof entry === "boolean"
    ) {
      return;
    }
    if (typeof entry === "number") {
      if (!Number.isFinite(entry)) {
        throw new Error(`${field} contains a non-finite number`);
      }
      return;
    }
    if (typeof entry !== "object") {
      throw new Error(`${field} must contain JSON values only`);
    }
    if (ancestors.has(entry)) {
      throw new Error(`${field} cannot contain cyclic values`);
    }
    ancestors.add(entry);
    try {
      if (Array.isArray(entry)) {
        if (entry.length > 1_000) {
          throw new Error(`${field} contains an oversized JSON array`);
        }
        entry.forEach((item) => visit(item, depth + 1));
        return;
      }
      const prototype = Object.getPrototypeOf(entry);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new Error(`${field} must contain plain JSON objects`);
      }
      const keys = Object.keys(entry);
      if (keys.length > 128) {
        throw new Error(`${field} contains an oversized JSON object`);
      }
      for (const key of keys) {
        if (
          key.length === 0 ||
          utf8ByteLengthV1(key) > 128
        ) {
          throw new Error(`${field} contains an invalid JSON key`);
        }
        visit((entry as Readonly<Record<string, unknown>>)[key], depth + 1);
      }
    } finally {
      ancestors.delete(entry);
    }
  };
  visit(value, 0);
}
