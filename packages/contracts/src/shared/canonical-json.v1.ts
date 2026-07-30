import { isProxy } from "node:util/types";

export const CANONICAL_JSON_LIMITS_V1 = Object.freeze({
  maxBytes: 67_108_864,
  maxDepth: 128,
  maxNodes: 1_000_000,
  maxContainerEntries: 100_000,
} as const);

export const CANONICAL_JSON_VIOLATION_REASONS_V1 = [
  "invalid_value",
  "unpaired_surrogate",
  "proxy_object",
  "accessor_property",
  "hidden_property",
  "symbol_key",
  "sparse_array",
  "array_extra_key",
  "non_plain_object",
  "cycle_detected",
  "max_bytes_exceeded",
  "max_depth_exceeded",
  "max_nodes_exceeded",
  "max_container_entries_exceeded",
] as const;

export type CanonicalJsonViolationReasonV1 =
  (typeof CANONICAL_JSON_VIOLATION_REASONS_V1)[number];

export interface CanonicalJsonBoundsV1 {
  readonly max_bytes?: number;
  readonly max_depth?: number;
  readonly max_nodes?: number;
  readonly max_container_entries?: number;
}

export class CanonicalJsonViolationV1 extends Error {
  public constructor(
    public readonly reason: CanonicalJsonViolationReasonV1,
    message: string,
  ) {
    super(message);
    this.name = "CanonicalJsonViolationV1";
  }
}

function violation(
  reason: CanonicalJsonViolationReasonV1,
  message: string,
): never {
  throw new CanonicalJsonViolationV1(reason, message);
}

function effectivePositiveLimit(
  value: number | undefined,
  maximum: number,
  field: string,
): number {
  if (value === undefined) return maximum;
  if (!Number.isSafeInteger(value) || value < 1) {
    violation("invalid_value", `${field} must be a positive safe integer`);
  }
  return Math.min(value, maximum);
}

function effectiveDepthLimit(value: number | undefined): number {
  if (value === undefined) return CANONICAL_JSON_LIMITS_V1.maxDepth;
  if (!Number.isSafeInteger(value) || value < 0) {
    violation(
      "invalid_value",
      "max_depth must be a non-negative safe integer",
    );
  }
  return Math.min(value, CANONICAL_JSON_LIMITS_V1.maxDepth);
}

function assertUnicodeScalarString(value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        violation(
          "unpaired_surrogate",
          "canonical JSON rejects unpaired UTF-16 surrogates",
        );
      }
      index += 1;
      continue;
    }
    if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      violation(
        "unpaired_surrogate",
        "canonical JSON rejects unpaired UTF-16 surrogates",
      );
    }
  }
}

function utf8Bytes(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function encodedScalar(value: null | boolean | number | string): string {
  if (typeof value === "number" && !Number.isFinite(value)) {
    violation("invalid_value", "canonical JSON rejects non-finite numbers");
  }
  if (typeof value === "string") assertUnicodeScalarString(value);
  const encoded = JSON.stringify(value);
  if (encoded === undefined) {
    violation("invalid_value", "canonical JSON accepts JSON values only");
  }
  return encoded;
}

type BoundaryFrameV1 =
  | Readonly<{ kind: "value"; value: unknown; depth: number }>
  | Readonly<{ kind: "leave"; value: object }>;

/**
 * Synchronously validates an already parsed object graph before recursive
 * schema validation, normalization, comparison, hashing, or serialization.
 * Repeated acyclic aliases are counted and encoded at every occurrence.
 */
export function assertCanonicalJsonBoundaryV1(
  value: unknown,
  options: CanonicalJsonBoundsV1 = {},
): void {
  const maximumBytes = effectivePositiveLimit(
    options.max_bytes,
    CANONICAL_JSON_LIMITS_V1.maxBytes,
    "max_bytes",
  );
  const maximumDepth = effectiveDepthLimit(options.max_depth);
  const maximumNodes = effectivePositiveLimit(
    options.max_nodes,
    CANONICAL_JSON_LIMITS_V1.maxNodes,
    "max_nodes",
  );
  const maximumContainerEntries = effectivePositiveLimit(
    options.max_container_entries,
    CANONICAL_JSON_LIMITS_V1.maxContainerEntries,
    "max_container_entries",
  );

  const stack: BoundaryFrameV1[] = [
    { kind: "value", value, depth: 0 },
  ];
  const activePath = new WeakSet<object>();
  let encodedBytes = 0;
  let nodeCount = 0;
  const addBytes = (count: number): void => {
    encodedBytes += count;
    if (encodedBytes > maximumBytes) {
      violation(
        "max_bytes_exceeded",
        "canonical JSON exceeds the maximum encoded byte size",
      );
    }
  };

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current.kind === "leave") {
      activePath.delete(current.value);
      continue;
    }

    nodeCount += 1;
    if (nodeCount > maximumNodes) {
      violation(
        "max_nodes_exceeded",
        "canonical JSON exceeds the maximum node count",
      );
    }
    if (current.depth > maximumDepth) {
      violation(
        "max_depth_exceeded",
        "canonical JSON exceeds the maximum depth",
      );
    }

    const entry = current.value;
    if (
      entry === null ||
      typeof entry === "boolean" ||
      typeof entry === "number" ||
      typeof entry === "string"
    ) {
      addBytes(utf8Bytes(encodedScalar(entry)));
      continue;
    }
    if (typeof entry !== "object") {
      violation(
        "invalid_value",
        `canonical JSON rejects ${typeof entry} values`,
      );
    }
    if (isProxy(entry)) {
      violation("proxy_object", "canonical JSON rejects proxy objects");
    }
    if (activePath.has(entry)) {
      violation("cycle_detected", "canonical JSON rejects cyclic values");
    }

    let prototype: object | null;
    let descriptors: PropertyDescriptorMap;
    try {
      prototype = Object.getPrototypeOf(entry);
      descriptors = Object.getOwnPropertyDescriptors(entry);
    } catch {
      violation(
        "invalid_value",
        "canonical JSON could not inspect the supplied object",
      );
    }
    const ownKeys = Reflect.ownKeys(descriptors);
    activePath.add(entry);

    if (Array.isArray(entry)) {
      if (prototype !== Array.prototype) {
        violation(
          "non_plain_object",
          "canonical JSON accepts only ordinary arrays",
        );
      }
      const symbolKey = ownKeys.find((key) => typeof key === "symbol");
      if (symbolKey !== undefined) {
        violation("symbol_key", "canonical JSON rejects symbol properties");
      }
      const lengthDescriptor = descriptors["length"];
      const length =
        lengthDescriptor !== undefined &&
        "value" in lengthDescriptor &&
        Number.isSafeInteger(lengthDescriptor.value) &&
        lengthDescriptor.value >= 0
          ? (lengthDescriptor.value as number)
          : -1;
      if (length < 0) {
        violation("invalid_value", "canonical JSON array length is invalid");
      }
      if (length > maximumContainerEntries) {
        violation(
          "max_container_entries_exceeded",
          "canonical JSON array exceeds the maximum entry count",
        );
      }
      const extraKey = ownKeys.find(
        (key) =>
          typeof key === "string" &&
          key !== "length" &&
          !/^(?:0|[1-9][0-9]*)$/u.test(key),
      );
      if (extraKey !== undefined) {
        violation(
          "array_extra_key",
          "canonical JSON rejects array extra properties",
        );
      }
      if (ownKeys.length !== length + 1) {
        violation("sparse_array", "canonical JSON rejects sparse arrays");
      }

      addBytes(2 + Math.max(0, length - 1));
      stack.push({ kind: "leave", value: entry });
      for (let index = length - 1; index >= 0; index -= 1) {
        const descriptor = descriptors[String(index)];
        if (descriptor === undefined) {
          violation("sparse_array", "canonical JSON rejects sparse arrays");
        }
        if (!("value" in descriptor)) {
          violation(
            "accessor_property",
            "canonical JSON rejects accessor-backed arrays",
          );
        }
        if (descriptor.enumerable !== true) {
          violation(
            "hidden_property",
            "canonical JSON rejects hidden array entries",
          );
        }
        stack.push({
          kind: "value",
          value: descriptor.value,
          depth: current.depth + 1,
        });
      }
      continue;
    }

    if (prototype !== Object.prototype && prototype !== null) {
      violation(
        "non_plain_object",
        "canonical JSON accepts only plain JSON objects",
      );
    }
    const symbolKey = ownKeys.find((key) => typeof key === "symbol");
    if (symbolKey !== undefined) {
      violation("symbol_key", "canonical JSON rejects symbol properties");
    }
    if (ownKeys.length > maximumContainerEntries) {
      violation(
        "max_container_entries_exceeded",
        "canonical JSON object exceeds the maximum entry count",
      );
    }

    addBytes(2 + Math.max(0, ownKeys.length - 1));
    stack.push({ kind: "leave", value: entry });
    for (let index = ownKeys.length - 1; index >= 0; index -= 1) {
      const key = ownKeys[index] as string;
      assertUnicodeScalarString(key);
      const descriptor = descriptors[key];
      if (descriptor === undefined) {
        violation("invalid_value", "canonical JSON property disappeared");
      }
      if (!("value" in descriptor)) {
        violation(
          "accessor_property",
          "canonical JSON rejects accessor properties",
        );
      }
      if (descriptor.enumerable !== true) {
        violation(
          "hidden_property",
          "canonical JSON rejects hidden properties",
        );
      }
      addBytes(utf8Bytes(JSON.stringify(key)) + 1);
      stack.push({
        kind: "value",
        value: descriptor.value,
        depth: current.depth + 1,
      });
    }
  }
}

function encodeCanonicalValueV1(
  value: unknown,
  activePath: Set<object>,
): string {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return encodedScalar(value);
  }
  if (typeof value !== "object") {
    violation("invalid_value", "canonical JSON accepts JSON values only");
  }
  if (activePath.has(value)) {
    violation("cycle_detected", "canonical JSON rejects cyclic values");
  }
  activePath.add(value);
  try {
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Array.isArray(value)) {
      const lengthDescriptor = descriptors["length"];
      const length =
        lengthDescriptor !== undefined &&
        "value" in lengthDescriptor &&
        Number.isSafeInteger(lengthDescriptor.value) &&
        lengthDescriptor.value >= 0
          ? (lengthDescriptor.value as number)
          : -1;
      if (length < 0) {
        violation("invalid_value", "canonical JSON array length is invalid");
      }
      const entries: string[] = [];
      for (let index = 0; index < length; index += 1) {
        const descriptor = descriptors[String(index)];
        if (descriptor === undefined) {
          violation("sparse_array", "canonical JSON rejects sparse arrays");
        }
        if (!("value" in descriptor)) {
          violation(
            "accessor_property",
            "canonical JSON rejects accessor-backed arrays",
          );
        }
        entries.push(encodeCanonicalValueV1(descriptor.value, activePath));
      }
      return `[${entries.join(",")}]`;
    }
    const entries = Object.keys(descriptors)
      .sort()
      .map((key) => {
        const descriptor = descriptors[key]!;
        if (!("value" in descriptor)) {
          violation(
            "accessor_property",
            "canonical JSON rejects accessor properties",
          );
        }
        return `${JSON.stringify(key)}:${encodeCanonicalValueV1(
          descriptor.value,
          activePath,
        )}`;
      });
    return `{${entries.join(",")}}`;
  } finally {
    activePath.delete(value);
  }
}

/** RFC 8785-compatible canonical JSON after the mandatory pure-data preflight. */
export function canonicalJsonV1(
  value: unknown,
  options: CanonicalJsonBoundsV1 = {},
): string {
  assertCanonicalJsonBoundaryV1(value, options);
  return encodeCanonicalValueV1(value, new Set<object>());
}
