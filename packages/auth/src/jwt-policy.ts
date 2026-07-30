import { assertCanonicalJsonBoundaryV1 } from "@pai/contracts";

export const ASYMMETRIC_JWT_ALGORITHMS = [
  "EdDSA",
  "ES256",
  "RS256",
] as const;

export type AsymmetricJwtAlgorithm =
  (typeof ASYMMETRIC_JWT_ALGORITHMS)[number];

export const MAX_JWT_CLOCK_TOLERANCE_SECONDS = 5;
export const MAX_COMPACT_JWT_LENGTH = 16_384;
const MAX_JWT_JSON_DEPTH = 64;
const MAX_JWT_JSON_NODES = 4_096;

const asymmetricJwtAlgorithms = new Set<string>(ASYMMETRIC_JWT_ALGORITHMS);

export function assertBoundedCompactJwt(token: unknown): asserts token is string {
  if (
    typeof token !== "string" ||
    token.length === 0 ||
    token.length > MAX_COMPACT_JWT_LENGTH
  ) {
    throw new Error("JWT credential exceeds the bounded compact token size");
  }
}

/**
 * Takes an immutable, own-data snapshot of a verified JWT payload.  A verified
 * signature must not be turned back into mutable or accessor-backed authority
 * when the credential crosses into application code.
 */
export function snapshotVerifiedJwtJsonV1<
  T extends Readonly<Record<string, unknown>>,
>(value: T): T {
  assertCanonicalJsonBoundaryV1(value, {
    max_bytes: MAX_COMPACT_JWT_LENGTH,
    max_depth: MAX_JWT_JSON_DEPTH,
    max_nodes: MAX_JWT_JSON_NODES,
    max_container_entries: MAX_JWT_JSON_NODES,
  });
  const state = { nodes: 0 };
  const snapshot = (entry: unknown, depth: number): unknown => {
    state.nodes += 1;
    if (depth > MAX_JWT_JSON_DEPTH || state.nodes > MAX_JWT_JSON_NODES) {
      throw new Error("verified JWT payload exceeds its bounded JSON contract");
    }
    if (
      entry === null ||
      typeof entry === "string" ||
      typeof entry === "boolean"
    ) {
      return entry;
    }
    if (typeof entry === "number") {
      if (!Number.isFinite(entry)) {
        throw new Error("verified JWT payload contains a non-JSON number");
      }
      return entry;
    }
    if (typeof entry !== "object" || ArrayBuffer.isView(entry)) {
      throw new Error("verified JWT payload contains a non-JSON value");
    }
    const prototype = Object.getPrototypeOf(entry);
    if (Array.isArray(entry)) {
      const lengthDescriptor = Object.getOwnPropertyDescriptor(entry, "length");
      const length = lengthDescriptor?.value;
      const keys = Reflect.ownKeys(entry);
      if (
        lengthDescriptor === undefined ||
        !("value" in lengthDescriptor) ||
        !Number.isSafeInteger(length) ||
        (length as number) < 0 ||
        (length as number) > MAX_JWT_JSON_NODES ||
        keys.length !== (length as number) + 1
      ) {
        throw new Error("verified JWT payload arrays must be dense");
      }
      const result: unknown[] = new Array(length as number);
      for (const key of keys) {
        if (key === "length") continue;
        if (typeof key !== "string") {
          throw new Error("verified JWT payload arrays must use JSON indexes");
        }
        const index = Number(key);
        const descriptor = Object.getOwnPropertyDescriptor(entry, key);
        if (
          !Number.isSafeInteger(index) ||
          index < 0 ||
          index >= (length as number) ||
          String(index) !== key ||
          descriptor === undefined ||
          !("value" in descriptor) ||
          descriptor.enumerable !== true
        ) {
          throw new Error("verified JWT payload arrays must use own data values");
        }
        result[index] = snapshot(descriptor.value, depth + 1);
      }
      return Object.freeze(result);
    }
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error("verified JWT payload must contain plain JSON objects");
    }
    const keys = Reflect.ownKeys(entry);
    if (keys.length > MAX_JWT_JSON_NODES) {
      throw new Error("verified JWT payload exceeds its bounded JSON contract");
    }
    const result: Record<string, unknown> = {};
    for (const key of keys) {
      if (typeof key !== "string") {
        throw new Error("verified JWT payload must use string JSON keys");
      }
      const descriptor = Object.getOwnPropertyDescriptor(entry, key);
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        descriptor.enumerable !== true
      ) {
        throw new Error("verified JWT payload must use own data properties");
      }
      Object.defineProperty(result, key, {
        value: snapshot(descriptor.value, depth + 1),
        enumerable: true,
        configurable: false,
        writable: false,
      });
    }
    return Object.freeze(result);
  };
  const result = snapshot(value, 0);
  if (typeof result !== "object" || result === null || Array.isArray(result)) {
    throw new Error("verified JWT payload must be a JSON object");
  }
  return result as T;
}

export function normalizeAsymmetricJwtAlgorithms(
  algorithms: readonly AsymmetricJwtAlgorithm[] | undefined,
  defaults: readonly AsymmetricJwtAlgorithm[],
): readonly AsymmetricJwtAlgorithm[] {
  const selected = [...(algorithms ?? defaults)];
  if (
    selected.length === 0 ||
    selected.some((algorithm) => !asymmetricJwtAlgorithms.has(algorithm))
  ) {
    throw new Error(
      "JWT algorithms must be a non-empty subset of EdDSA, ES256, and RS256",
    );
  }
  if (new Set(selected).size !== selected.length) {
    throw new Error("JWT algorithms must not contain duplicates");
  }
  return Object.freeze(selected);
}

export function normalizeJwtClockToleranceSeconds(
  value: number | undefined,
): number {
  const tolerance = value ?? 0;
  if (
    !Number.isInteger(tolerance) ||
    tolerance < 0 ||
    tolerance > MAX_JWT_CLOCK_TOLERANCE_SECONDS
  ) {
    throw new Error(
      `JWT clock tolerance must be an integer from 0 to ${MAX_JWT_CLOCK_TOLERANCE_SECONDS} seconds`,
    );
  }
  return tolerance;
}
