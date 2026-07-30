import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { isProxy } from "node:util/types";

const rawFieldSummarySchemaVersion =
  "eventing.raw_field_summary.v1" as const;
const durableFailureCodePattern = /^[a-z][a-z0-9_]{0,63}$/u;
const sha256Pattern = /^sha256:[0-9a-f]{64}$/u;
const canonicalRedisFieldNames = new Set([
  "event_id",
  "event_type",
  "schema_version",
  "producer",
  "occurred_at",
  "idempotency_key",
  "trace_id",
  "payload",
]);
const maxRawFieldSummaryElements = 64;
const maxRawFieldSummarySerializedBytes = 16_384;

type RawFieldRoleV1 = "field_name" | "field_value";

type RawFieldValueSummaryV1 = Readonly<{
  schema_version: typeof rawFieldSummarySchemaVersion;
  kind: "string";
  position: number;
  role: RawFieldRoleV1;
  field_name: string | null;
  utf8_bytes: number;
  sha256: `sha256:${string}`;
}>;

type RawFieldNonStringSummaryV1 = Readonly<{
  schema_version: typeof rawFieldSummarySchemaVersion;
  kind: "non_string";
  position: number;
  role: RawFieldRoleV1;
}>;

type RawFieldOmittedSummaryV1 = Readonly<{
  schema_version: typeof rawFieldSummarySchemaVersion;
  kind: "omitted";
  omitted_count: number;
}>;

type RawFieldSummaryV1 =
  | RawFieldValueSummaryV1
  | RawFieldNonStringSummaryV1
  | RawFieldOmittedSummaryV1;

function plainDataRecord(
  value: unknown,
): Readonly<Record<string, unknown>> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  if (isProxy(value)) return undefined;
  let prototype: object | null;
  let descriptors: PropertyDescriptorMap;
  try {
    prototype = Object.getPrototypeOf(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    return undefined;
  }
  if (prototype !== Object.prototype && prototype !== null) return undefined;
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some((key) => typeof key !== "string")) return undefined;
  const snapshot = Object.create(null) as Record<string, unknown>;
  for (const key of keys as string[]) {
    const descriptor = descriptors[key];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.get !== undefined ||
      descriptor.set !== undefined
    ) {
      return undefined;
    }
    snapshot[key] = descriptor.value;
  }
  return snapshot;
}

function exactKeys(
  value: Readonly<Record<string, unknown>>,
  expected: readonly string[],
): boolean {
  const keys = Object.keys(value);
  return (
    keys.length === expected.length &&
    expected.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  );
}

function existingRawFieldSummary(
  value: unknown,
): RawFieldSummaryV1 | undefined {
  const record = plainDataRecord(value);
  if (
    record === undefined ||
    record.schema_version !== rawFieldSummarySchemaVersion
  ) {
    return undefined;
  }
  if (
    record.kind === "omitted" &&
    exactKeys(record, ["schema_version", "kind", "omitted_count"]) &&
    Number.isSafeInteger(record.omitted_count) &&
    (record.omitted_count as number) >= 1
  ) {
    return Object.freeze({
      schema_version: rawFieldSummarySchemaVersion,
      kind: "omitted",
      omitted_count: record.omitted_count as number,
    });
  }
  if (
    record.kind === "non_string" &&
    exactKeys(record, ["schema_version", "kind", "position", "role"]) &&
    Number.isSafeInteger(record.position) &&
    (record.position as number) >= 0 &&
    (record.role === "field_name" || record.role === "field_value")
  ) {
    return Object.freeze({
      schema_version: rawFieldSummarySchemaVersion,
      kind: "non_string",
      position: record.position as number,
      role: record.role,
    });
  }
  if (
    record.kind === "string" &&
    exactKeys(record, [
      "schema_version",
      "kind",
      "position",
      "role",
      "field_name",
      "utf8_bytes",
      "sha256",
    ]) &&
    Number.isSafeInteger(record.position) &&
    (record.position as number) >= 0 &&
    (record.role === "field_name" || record.role === "field_value") &&
    (record.field_name === null ||
      (typeof record.field_name === "string" &&
        canonicalRedisFieldNames.has(record.field_name))) &&
    (record.role === "field_name" || record.field_name === null) &&
    Number.isSafeInteger(record.utf8_bytes) &&
    (record.utf8_bytes as number) >= 0 &&
    typeof record.sha256 === "string" &&
    sha256Pattern.test(record.sha256)
  ) {
    return Object.freeze({
      schema_version: rawFieldSummarySchemaVersion,
      kind: "string",
      position: record.position as number,
      role: record.role,
      field_name: record.field_name as string | null,
      utf8_bytes: record.utf8_bytes as number,
      sha256: record.sha256 as `sha256:${string}`,
    });
  }
  return undefined;
}

function rawFieldRole(position: number): RawFieldRoleV1 {
  return position % 2 === 0 ? "field_name" : "field_value";
}

function summarizeString(
  value: string,
  position: number,
): RawFieldValueSummaryV1 {
  const role = rawFieldRole(position);
  return Object.freeze({
    schema_version: rawFieldSummarySchemaVersion,
    kind: "string",
    position,
    role,
    field_name:
      role === "field_name" && canonicalRedisFieldNames.has(value)
        ? value
        : null,
    utf8_bytes: Buffer.byteLength(value, "utf8"),
    sha256: `sha256:${createHash("sha256")
      .update("pai-eventing-raw-field-v1", "utf8")
      .update("\0", "utf8")
      .update(role, "utf8")
      .update("\0", "utf8")
      .update(value, "utf8")
      .digest("hex")}`,
  });
}

function snapshotArrayLength(value: readonly unknown[]): number | undefined {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(value, "length");
  } catch {
    return undefined;
  }
  return descriptor !== undefined &&
    "value" in descriptor &&
    Number.isSafeInteger(descriptor.value) &&
    descriptor.value >= 0
    ? (descriptor.value as number)
    : undefined;
}

/**
 * Produces idempotent forensic metadata for malformed Redis fields without
 * retaining a field value. Canonical field names are useful for diagnosis;
 * unknown names and every value are represented only by length and a
 * domain-separated digest.
 */
export function summarizeDurableRawFieldsV1(
  value: unknown,
): readonly RawFieldSummaryV1[] {
  if (
    typeof value !== "object" ||
    value === null ||
    isProxy(value) ||
    !Array.isArray(value)
  ) {
    return Object.freeze([]);
  }
  const length = snapshotArrayLength(value);
  if (length === undefined) return Object.freeze([]);

  const existing: RawFieldSummaryV1[] = [];
  let allExisting = length <= maxRawFieldSummaryElements;
  if (allExisting) {
    for (let position = 0; position < length; position += 1) {
      let descriptor: PropertyDescriptor | undefined;
      try {
        descriptor = Object.getOwnPropertyDescriptor(value, String(position));
      } catch {
        allExisting = false;
        break;
      }
      const summary =
        descriptor !== undefined && "value" in descriptor
          ? existingRawFieldSummary(descriptor.value)
          : undefined;
      if (
        summary === undefined ||
        (summary.kind === "omitted"
          ? position !== length - 1
          : summary.position !== position ||
            summary.role !== rawFieldRole(position))
      ) {
        allExisting = false;
        break;
      }
      existing.push(summary);
    }
  }
  if (
    allExisting &&
    Buffer.byteLength(JSON.stringify(existing), "utf8") <=
      maxRawFieldSummarySerializedBytes
  ) {
    return Object.freeze(existing);
  }

  const summaries: RawFieldSummaryV1[] = [];
  for (let position = 0; position < length; position += 1) {
    if (summaries.length >= maxRawFieldSummaryElements - 1) break;
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, String(position));
    } catch {
      descriptor = undefined;
    }
    const summary =
      descriptor !== undefined &&
      "value" in descriptor &&
      typeof descriptor.value === "string"
        ? summarizeString(descriptor.value, position)
        : Object.freeze({
            schema_version: rawFieldSummarySchemaVersion,
            kind: "non_string" as const,
            position,
            role: rawFieldRole(position),
          });
    const remaining = length - position - 1;
    const candidate =
      remaining > 0
        ? [
            ...summaries,
            summary,
            {
              schema_version: rawFieldSummarySchemaVersion,
              kind: "omitted" as const,
              omitted_count: remaining,
            },
          ]
        : [...summaries, summary];
    if (
      Buffer.byteLength(JSON.stringify(candidate), "utf8") >
      maxRawFieldSummarySerializedBytes
    ) {
      break;
    }
    summaries.push(summary);
  }
  const omittedCount = length - summaries.length;
  if (omittedCount > 0) {
    summaries.push(
      Object.freeze({
        schema_version: rawFieldSummarySchemaVersion,
        kind: "omitted",
        omitted_count: omittedCount,
      }),
    );
  }
  return Object.freeze(summaries);
}

/**
 * Durable failure text is deliberately no richer than a validated code.
 * Diagnostic Error objects remain process-local and may contain credentials,
 * URLs, prompts, SQL, or upstream response bodies.
 */
export function closedDurableFailureMessageV1(
  code: string,
  fallback = "durable_failure",
): string {
  if (durableFailureCodePattern.test(code)) return code;
  return durableFailureCodePattern.test(fallback)
    ? fallback
    : "durable_failure";
}
