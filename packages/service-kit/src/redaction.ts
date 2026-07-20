export const REDACTED_VALUE = "[REDACTED]";

const SENSITIVE_KEY_PATTERN =
  /(?:^|_)(?:authorization|cookie|set_cookie|jwt|token|secret|password|private_key|api_key|signing_key|encryption_key|credential|prompt|tool_args?|tool_arguments?|tool_results?|artifact|object_content|provider_key)(?:$|_)/i;
const SENSITIVE_STRING_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9._~+/=-]+/i,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
] as const;

export const PINO_REDACTION_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "res.headers.set-cookie",
  "authorization",
  "cookie",
  "token",
  "secret",
  "password",
  "private_key",
  "prompt",
  "tool_args",
  "tool_arguments",
  "tool_result",
  "artifact",
  "object_content",
] as const;

function normalizeKey(key: string): string {
  return key
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replaceAll("-", "_")
    .replaceAll(".", "_")
    .toLowerCase();
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(normalizeKey(key));
}

function isSensitiveString(value: string): boolean {
  return SENSITIVE_STRING_PATTERNS.some((pattern) => pattern.test(value));
}

function redact(
  value: unknown,
  seen: WeakSet<object>,
  depth: number,
): unknown {
  if (typeof value === "string") {
    return isSensitiveString(value) ? REDACTED_VALUE : value;
  }
  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "undefined"
  ) {
    return value;
  }
  if (typeof value === "bigint") return value.toString();
  if (typeof value !== "object") return String(value);
  if (depth >= 12) return "[MAX_DEPTH]";
  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redact(item, seen, depth + 1));
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: isSensitiveString(value.message)
        ? REDACTED_VALUE
        : value.message,
    };
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      isSensitiveKey(key)
        ? REDACTED_VALUE
        : redact(item, seen, depth + 1),
    ]),
  );
}

export function redactSensitiveValue(value: unknown): unknown {
  return redact(value, new WeakSet<object>(), 0);
}
