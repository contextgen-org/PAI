import { createHash } from "node:crypto";

export class CanonicalJsonValidationErrorV1 extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "CanonicalJsonValidationErrorV1";
  }
}

function assertUnicodeScalarString(value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        throw new CanonicalJsonValidationErrorV1(
          "canonical JSON rejects unpaired UTF-16 surrogates",
        );
      }
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      throw new CanonicalJsonValidationErrorV1(
        "canonical JSON rejects unpaired UTF-16 surrogates",
      );
    }
  }
}

function canonicalJsonValueV1(value: unknown, ancestors: Set<object>): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new CanonicalJsonValidationErrorV1(
        "canonical JSON rejects non-finite numbers",
      );
    }
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    assertUnicodeScalarString(value);
    return JSON.stringify(value);
  }
  if (typeof value !== "object") {
    throw new CanonicalJsonValidationErrorV1(
      `canonical JSON rejects ${typeof value} values`,
    );
  }
  if (ancestors.has(value)) {
    throw new CanonicalJsonValidationErrorV1(
      "canonical JSON rejects cyclic values",
    );
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      const entries: string[] = [];
      for (let index = 0; index < value.length; index += 1) {
        if (!(index in value)) {
          throw new CanonicalJsonValidationErrorV1(
            "canonical JSON rejects sparse arrays",
          );
        }
        entries.push(canonicalJsonValueV1(value[index], ancestors));
      }
      return `[${entries.join(",")}]`;
    }
    const prototype = Object.getPrototypeOf(value) as object | null;
    if (prototype !== Object.prototype && prototype !== null) {
      throw new CanonicalJsonValidationErrorV1(
        "canonical JSON accepts only plain JSON objects",
      );
    }
    const symbols = Object.getOwnPropertySymbols(value);
    if (symbols.length > 0) {
      throw new CanonicalJsonValidationErrorV1(
        "canonical JSON rejects symbol properties",
      );
    }
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .sort()
      .map((key) => {
        assertUnicodeScalarString(key);
        return `${JSON.stringify(key)}:${canonicalJsonValueV1(record[key], ancestors)}`;
      });
    return `{${entries.join(",")}}`;
  } finally {
    ancestors.delete(value);
  }
}

/** RFC 8785-compatible canonical JSON for already validated JSON values. */
export function canonicalJsonV1(value: unknown): string {
  return canonicalJsonValueV1(value, new Set());
}

export function canonicalPayloadHashV1(payload: unknown): string {
  return `sha256:${createHash("sha256")
    .update(canonicalJsonV1(payload), "utf8")
    .digest("hex")}`;
}
