import {
  CANONICAL_JSON_LIMITS_V1,
  CanonicalJsonViolationV1,
  assertCanonicalJsonBoundaryV1,
  type CanonicalJsonBoundsV1,
} from "./canonical-json.v1.js";

export const PURE_JSON_DEFAULT_MAX_BYTES_V1 =
  CANONICAL_JSON_LIMITS_V1.maxBytes;
export const PURE_JSON_DEFAULT_MAX_DEPTH_V1 =
  CANONICAL_JSON_LIMITS_V1.maxDepth;
export const PURE_JSON_DEFAULT_MAX_NODES_V1 =
  CANONICAL_JSON_LIMITS_V1.maxNodes;
export const PURE_JSON_DEFAULT_MAX_CONTAINER_ENTRIES_V1 =
  CANONICAL_JSON_LIMITS_V1.maxContainerEntries;

export type PureJsonBoundaryOptionsV1 = CanonicalJsonBoundsV1;
export { CanonicalJsonViolationV1 as PureJsonBoundaryErrorV1 };

/**
 * Iteratively validates an already parsed JSON graph before schema assertions,
 * semantic hashing, or recursive canonical encoding.
 *
 * Repeated acyclic references are permitted and encoded at every occurrence;
 * only an active-path cycle is rejected.
 */
export function assertBoundedPureJsonV1(
  value: unknown,
  options: PureJsonBoundaryOptionsV1 = {},
): void {
  assertCanonicalJsonBoundaryV1(value, options);
}
