import { createHash } from "node:crypto";

import {
  assertBoundedPureJsonV1,
  canonicalJsonV1 as sharedCanonicalJsonV1,
  type CanonicalJsonBoundsV1,
} from "@pai/contracts";

const META_JSON_DEFAULT_MAX_BYTES_V1 = 16 * 1_048_576;
const META_JSON_DEFAULT_MAX_DEPTH_V1 = 64;
const META_JSON_DEFAULT_MAX_NODES_V1 = 100_000;
const META_JSON_DEFAULT_MAX_CONTAINER_ENTRIES_V1 = 10_000;

export interface MetaJsonBoundsV1 {
  readonly max_bytes?: number;
  readonly max_depth?: number;
  readonly max_nodes?: number;
  readonly max_container_entries?: number;
}

function positiveSafeInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`Meta Cognition JSON ${name} bound is invalid`);
  }
  return value;
}

function effectiveBoundsV1(
  options: MetaJsonBoundsV1,
): CanonicalJsonBoundsV1 {
  return Object.freeze({
    max_bytes: positiveSafeInteger(
      options.max_bytes ?? META_JSON_DEFAULT_MAX_BYTES_V1,
      "max_bytes",
    ),
    max_depth: positiveSafeInteger(
      options.max_depth ?? META_JSON_DEFAULT_MAX_DEPTH_V1,
      "max_depth",
    ),
    max_nodes: positiveSafeInteger(
      options.max_nodes ?? META_JSON_DEFAULT_MAX_NODES_V1,
      "max_nodes",
    ),
    max_container_entries: positiveSafeInteger(
      options.max_container_entries ??
        META_JSON_DEFAULT_MAX_CONTAINER_ENTRIES_V1,
      "max_container_entries",
    ),
  });
}

function metaCanonicalError(error: unknown): Error {
  const message =
    error instanceof Error
      ? error.message
      : "canonical JSON validation failed";
  return new Error(`Meta Cognition JSON rejected value: ${message}`, {
    cause: error,
  });
}

/**
 * Meta keeps service-specific budgets, but Shared canonicalJsonV1 is the only
 * implementation of graph validation and canonical encoding.
 */
export function assertBoundedMetaJsonV1(
  value: unknown,
  options: MetaJsonBoundsV1 = {},
): void {
  const bounds = effectiveBoundsV1(options);
  try {
    assertBoundedPureJsonV1(value, bounds);
  } catch (error) {
    throw metaCanonicalError(error);
  }
}

export function canonicalJsonV1(
  value: unknown,
  options: MetaJsonBoundsV1 = {},
): string {
  const bounds = effectiveBoundsV1(options);
  try {
    return sharedCanonicalJsonV1(value, bounds);
  } catch (error) {
    throw metaCanonicalError(error);
  }
}

function deepFreezeParsedJsonV1(value: unknown): unknown {
  if (typeof value !== "object" || value === null) return value;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      value[index] = deepFreezeParsedJsonV1(value[index]);
    }
    return Object.freeze(value);
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    record[key] = deepFreezeParsedJsonV1(record[key]);
  }
  return Object.freeze(record);
}

/**
 * Detaches a bounded JSON value from the caller and recursively freezes the
 * resulting graph. Validation alone is insufficient at async boundaries
 * because a caller could otherwise mutate nested request/provider data after
 * its hash and schema were accepted.
 */
export function snapshotCanonicalJsonV1<T>(
  value: T,
  options: MetaJsonBoundsV1 = {},
): T {
  return deepFreezeParsedJsonV1(
    JSON.parse(canonicalJsonV1(value, options)) as unknown,
  ) as T;
}

export function sha256CanonicalV1(value: unknown): `sha256:${string}` {
  return `sha256:${createHash("sha256")
    .update(canonicalJsonV1(value), "utf8")
    .digest("hex")}`;
}

function containsRuntimeTokenUncheckedV1(
  value: unknown,
  parentKey: string,
  activePath: Set<object>,
): boolean {
  if (typeof value !== "object" || value === null) return false;
  if (activePath.has(value)) return true;
  activePath.add(value);
  try {
    if (Array.isArray(value)) {
      return value.some((entry) =>
        containsRuntimeTokenUncheckedV1(entry, parentKey, activePath),
      );
    }
    for (const [key, entry] of Object.entries(value)) {
      const normalized = key.toLowerCase().replaceAll("_", ".");
      if (
        normalized === "runtime.token" ||
        (parentKey === "runtime" && normalized === "token")
      ) {
        return true;
      }
      if (
        containsRuntimeTokenUncheckedV1(
          entry,
          normalized === "runtime" ? "runtime" : "",
          activePath,
        )
      ) {
        return true;
      }
    }
    return false;
  } finally {
    activePath.delete(value);
  }
}

export function containsRuntimeTokenV1(value: unknown): boolean {
  assertBoundedMetaJsonV1(value);
  return containsRuntimeTokenUncheckedV1(value, "", new Set<object>());
}

export function assertNoRuntimeTokenV1(value: unknown): void {
  assertBoundedMetaJsonV1(value);
  if (containsRuntimeTokenUncheckedV1(value, "", new Set<object>())) {
    throw new Error("runtime.token must never enter Meta durable data");
  }
}
