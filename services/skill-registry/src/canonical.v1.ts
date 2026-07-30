import { createHash } from "node:crypto";

import {
  CanonicalJsonViolationV1,
  SKILL_PACKAGE_MAX_BYTES_V1,
  canonicalJsonV1 as sharedCanonicalJsonV1,
} from "@pai/contracts";

export const CANONICAL_JSON_MAX_DEPTH_V1 = 64;
export const CANONICAL_JSON_MAX_NODES_V1 = 1_000_000;
export const CANONICAL_JSON_MAX_BYTES_V1 =
  SKILL_PACKAGE_MAX_BYTES_V1;
export const CANONICAL_JSON_MAX_CONTAINER_ENTRIES_V1 = 100_000;

export class CanonicalJsonErrorV1 extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CanonicalJsonErrorV1";
  }
}

/** Skill-owned limits over the Shared rev28 canonical JSON owner. */
export function canonicalJsonV1(value: unknown): string {
  try {
    return sharedCanonicalJsonV1(value, {
      max_bytes: CANONICAL_JSON_MAX_BYTES_V1,
      max_depth: CANONICAL_JSON_MAX_DEPTH_V1,
      max_nodes: CANONICAL_JSON_MAX_NODES_V1,
      max_container_entries:
        CANONICAL_JSON_MAX_CONTAINER_ENTRIES_V1,
    });
  } catch (error) {
    if (error instanceof CanonicalJsonViolationV1) {
      const message =
        error.reason === "max_bytes_exceeded"
          ? "canonical JSON exceeds the maximum byte length"
          : error.reason === "max_container_entries_exceeded"
            ? "canonical JSON exceeds the maximum node count"
          : error.reason === "accessor_property" ||
              error.reason === "hidden_property"
            ? "canonical JSON rejects accessors and non-data properties"
            : error.message;
      throw new CanonicalJsonErrorV1(message, { cause: error });
    }
    throw error;
  }
}

export function sha256BytesV1(value: Uint8Array | string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

export function canonicalHashV1(value: unknown): string {
  return sha256BytesV1(canonicalJsonV1(value));
}
