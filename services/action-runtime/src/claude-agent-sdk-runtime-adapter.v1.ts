import { createHash, randomUUID } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { isAbsolute, join, resolve, sep } from "node:path";
import { createRequire } from "node:module";
import { types as nodeUtilTypes } from "node:util";

import {
  createSdkMcpServer,
  query as claudeAgentSdkQuery,
  tool as claudeAgentSdkTool,
  type CanUseTool,
  type McpServerConfig,
  type Options as ClaudeAgentSdkOptions,
  type Query,
  type SDKControlReloadSkillsResponse,
  type SDKAssistantMessageError,
  type SDKMessage,
  type SDKResultError,
  type SdkMcpToolDefinition,
} from "@anthropic-ai/claude-agent-sdk";
import {
  RuntimeSkillLoadRequestV1Schema,
  RuntimeSkillLoadResponseV1Schema,
  SKILL_ENTRYPOINT_MAX_BYTES_V1,
  SKILL_PACKAGE_MAX_BYTES_V1,
  SKILL_PACKAGE_MAX_FILES_V1,
  assertRuntimeSkillLoadBindingsV1,
  type RuntimeSkillLoadRequestV1,
  type RuntimeSkillLoadResponseV1,
} from "@pai/contracts";
import {
  canonicalJsonV1,
  immutableBoundedJsonSnapshotV1,
} from "@pai/eventing";
import { Value } from "@sinclair/typebox/value";

import {
  RuntimeExecutionErrorV1,
  assertRuntimeSkillMaterializationManifestV1,
  type RuntimeAdapterContextV1,
  type RuntimeAdapterPortV1,
  type RuntimeAdapterSessionV1,
  type RuntimeAdapterStartRequestV1,
  type RuntimeAdapterTurnV1,
  type RuntimeSkillMaterializationV1,
  type RuntimeToolResultV1,
} from "./runtime-execution.v1.js";
import type {
  RuntimeTokenPublisherV1,
  RuntimeTokenPublishInputV1,
} from "./runtime-token-live-bus.v1.js";

const SDK_PACKAGE_V1 = "@anthropic-ai/claude-agent-sdk" as const;
const SDK_VERSION_V1 = "0.3.212" as const;
const ADAPTER_ID_V1 = "ClaudeAgentSdkRuntimeAdapter" as const;
const MCP_SERVER_NAME_V1 = "pai_runtime";
const SKILL_LOAD_TOOL_V1 = "skill.load";
const MAX_PROVIDER_PROMPT_BYTES_V1 = 4 * 1024 * 1024;
const MAX_PROVIDER_RESULT_BYTES_V1 = 16 * 1024 * 1024;
const MAX_TOOL_INPUT_BYTES_V1 = 1024 * 1024;
const MAX_TOOL_INPUT_DEPTH_V1 = 32;
const MAX_TOOL_INPUT_NODES_V1 = 10_000;
const MAX_TOOL_COLLECTION_ITEMS_V1 = 1_000;
const MAX_BRIDGE_ENTRIES_V1 = 128;
const MAX_TURN_QUEUE_V1 = 128;
const MAX_TURN_WAITERS_V1 = 16;
const DEFAULT_ARTIFACT_RETENTION_MS_V1 = 30 * 24 * 60 * 60 * 1_000;
const RUN_DIRECTORY_PREFIX_V1 = "pai-run-";
const RUN_OWNER_MARKER_V1 = ".pai-action-runtime-owned.v1";
const RUN_OWNER_MARKER_CONTENT_V1 =
  "project-pai:action-runtime:claude-agent-sdk:0.3.212\n";
const RUN_OWNER_MARKER_BYTES_V1 = Buffer.byteLength(
  RUN_OWNER_MARKER_CONTENT_V1,
  "utf8",
);
const SKILL_ROOT_RELATIVE_V1 = join(".claude", "skills");
const CONFIG_ROOT_RELATIVE_V1 = ".claude-config";

const ALLOWED_PROVIDER_ENV_V1 = new Set([
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "ANTHROPIC_BASE_URL",
  "HTTPS_PROXY",
  "HTTP_PROXY",
  "NO_PROXY",
  "NODE_EXTRA_CA_CERTS",
  "PATH",
  "SSL_CERT_FILE",
]);

const ADAPTER_OPTION_KEYS_V1 = new Set([
  "model",
  "sandbox_cwd",
  "provider_env",
  "max_sdk_turns",
  "max_budget_usd",
  "artifact_retention_ms",
  "now",
  "id_factory",
  "query_factory",
  "tool_factory",
  "mcp_server_factory",
  "remove_run_directory",
  "token_publisher",
]);

function ownEnumerableDataSnapshotV1(
  value: unknown,
  allowedKeys: ReadonlySet<string>,
  label: string,
): Readonly<Record<string, unknown>> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    nodeUtilTypes.isProxy(value)
  ) {
    throw new Error(`${label} must be a plain inspectable object`);
  }
  let descriptors: PropertyDescriptorMap;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    throw new Error(`${label} cannot be snapshotted`);
  }
  const keys = Reflect.ownKeys(descriptors);
  const unsupported = keys.find(
    (key) => typeof key !== "string" || !allowedKeys.has(key),
  );
  if (unsupported !== undefined) {
    throw new Error(
      `${label} contains unsupported property ${String(unsupported)}`,
    );
  }
  const snapshot: Record<string, unknown> = {};
  for (const key of keys as string[]) {
    const descriptor = descriptors[key];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      throw new Error(
        `${label} must contain only enumerable own data properties`,
      );
    }
    snapshot[key] = descriptor.value;
  }
  return Object.freeze(snapshot);
}

function snapshotProviderEnvironmentV1(
  value: unknown,
): Readonly<Record<string, string>> {
  const snapshot = ownEnumerableDataSnapshotV1(
    value,
    ALLOWED_PROVIDER_ENV_V1,
    "Claude Agent SDK provider environment",
  );
  for (const [key, entry] of Object.entries(snapshot)) {
    if (
      typeof entry !== "string" ||
      entry.length === 0 ||
      entry.includes("\u0000")
    ) {
      throw new Error(`Claude Agent SDK provider environment rejects ${key}`);
    }
  }
  return Object.freeze({ ...snapshot }) as Readonly<
    Record<string, string>
  >;
}

function snapshotAdapterOptionsV1(
  value: unknown,
): ClaudeAgentSdkRuntimeAdapterOptionsV1 {
  const snapshot = ownEnumerableDataSnapshotV1(
    value,
    ADAPTER_OPTION_KEYS_V1,
    "Claude Agent SDK adapter options",
  );
  if (
    !Object.hasOwn(snapshot, "model") ||
    !Object.hasOwn(snapshot, "sandbox_cwd") ||
    !Object.hasOwn(snapshot, "provider_env")
  ) {
    throw new Error("Claude Agent SDK adapter options are incomplete");
  }
  const functionKeys = [
    "now",
    "id_factory",
    "query_factory",
    "tool_factory",
    "mcp_server_factory",
    "remove_run_directory",
  ] as const;
  if (
    functionKeys.some(
      (key) =>
        snapshot[key] !== undefined &&
        typeof snapshot[key] !== "function",
    )
  ) {
    throw new Error("Claude Agent SDK adapter seam is invalid");
  }
  return Object.freeze({
    model: snapshot.model as string,
    sandbox_cwd: snapshot.sandbox_cwd as string,
    provider_env: snapshotProviderEnvironmentV1(
      snapshot.provider_env,
    ),
    ...(snapshot.max_sdk_turns === undefined
      ? {}
      : { max_sdk_turns: snapshot.max_sdk_turns as number }),
    ...(snapshot.max_budget_usd === undefined
      ? {}
      : { max_budget_usd: snapshot.max_budget_usd as number }),
    ...(snapshot.artifact_retention_ms === undefined
      ? {}
      : {
          artifact_retention_ms:
            snapshot.artifact_retention_ms as number,
        }),
    ...(snapshot.now === undefined
      ? {}
      : { now: snapshot.now as () => Date }),
    ...(snapshot.id_factory === undefined
      ? {}
      : { id_factory: snapshot.id_factory as () => string }),
    ...(snapshot.query_factory === undefined
      ? {}
      : {
          query_factory:
            snapshot.query_factory as ClaudeAgentSdkQueryFactoryV1,
        }),
    ...(snapshot.tool_factory === undefined
      ? {}
      : {
          tool_factory:
            snapshot.tool_factory as RuntimeSdkToolFactoryV1,
        }),
    ...(snapshot.mcp_server_factory === undefined
      ? {}
      : {
          mcp_server_factory:
            snapshot.mcp_server_factory as typeof createSdkMcpServer,
        }),
    ...(snapshot.remove_run_directory === undefined
      ? {}
      : {
          remove_run_directory:
            snapshot.remove_run_directory as (
              path: string,
            ) => Promise<void>,
        }),
    ...(snapshot.token_publisher === undefined
      ? {}
      : {
          token_publisher: snapshotRuntimeTokenPublisherV1(
            snapshot.token_publisher,
          ),
        }),
  });
}

function snapshotRuntimeTokenPublisherV1(
  value: unknown,
): RuntimeTokenPublisherV1 {
  if (
    typeof value !== "object" ||
    value === null ||
    nodeUtilTypes.isProxy(value)
  ) {
    throw new Error("Runtime token publisher must be a non-Proxy object");
  }
  let current: object | null = value;
  let descriptor: PropertyDescriptor | undefined;
  for (let depth = 0; current !== null && depth < 16; depth += 1) {
    if (nodeUtilTypes.isProxy(current)) {
      throw new Error("Runtime token publisher has a Proxy prototype");
    }
    descriptor = Object.getOwnPropertyDescriptor(current, "publish");
    if (descriptor !== undefined) break;
    current = Object.getPrototypeOf(current);
  }
  if (
    descriptor === undefined ||
    !("value" in descriptor) ||
    typeof descriptor.value !== "function" ||
    nodeUtilTypes.isProxy(descriptor.value)
  ) {
    throw new Error("Runtime token publisher.publish must be a data method");
  }
  const publish = descriptor.value as RuntimeTokenPublisherV1["publish"];
  return Object.freeze({
    publish: (
      input: RuntimeTokenPublishInputV1,
      signal?: AbortSignal,
    ) => Reflect.apply(publish, value, [input, signal]),
  });
}

async function hasExactRunOwnerMarkerV1(
  runDirectory: string,
): Promise<boolean> {
  let markerHandle: Awaited<ReturnType<typeof open>> | undefined;
  let owned = false;
  try {
    markerHandle = await open(
      join(runDirectory, RUN_OWNER_MARKER_V1),
      fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
    );
    const markerStat = await markerHandle.stat();
    if (
      markerStat.isFile() &&
      !markerStat.isSymbolicLink() &&
      markerStat.size === RUN_OWNER_MARKER_BYTES_V1
    ) {
      owned =
        (await markerHandle.readFile({ encoding: "utf8" })) ===
        RUN_OWNER_MARKER_CONTENT_V1;
    }
  } catch {
    owned = false;
  }
  if (markerHandle !== undefined) {
    try {
      await markerHandle.close();
    } catch {
      return false;
    }
  }
  return owned;
}

interface MinimalZodValueV1 {
  min(value: number): MinimalZodValueV1;
  max(value: number): MinimalZodValueV1;
}

interface MinimalZodV1 {
  string(): MinimalZodValueV1;
  unknown(): unknown;
}

type McpResultV1 = Readonly<{
  content: readonly Readonly<{ type: "text"; text: string }>[];
  isError?: boolean;
}>;

type RuntimeSdkToolFactoryV1 = (
  name: string,
  description: string,
  inputSchema: Readonly<Record<string, unknown>>,
  handler: (
    args: Readonly<Record<string, unknown>>,
    extra: unknown,
  ) => Promise<McpResultV1>,
) => SdkMcpToolDefinition;

export type ClaudeAgentSdkQueryFactoryV1 = (
  parameters: Readonly<{
    prompt: string;
    options?: ClaudeAgentSdkOptions;
  }>,
) => Pick<Query, "close" | "interrupt"> &
  Partial<Pick<Query, "reloadSkills">> &
  AsyncIterable<SDKMessage>;

export interface ClaudeAgentSdkRuntimeAdapterOptionsV1 {
  readonly model: string;
  readonly sandbox_cwd: string;
  /**
   * Replaces, rather than merges, the SDK subprocess environment. Unknown
   * keys are rejected so a caller cannot accidentally expose application
   * secrets to the provider process.
   */
  readonly provider_env: Readonly<Record<string, string>>;
  readonly max_sdk_turns?: number;
  readonly max_budget_usd?: number;
  readonly artifact_retention_ms?: number;
  readonly now?: () => Date;
  readonly id_factory?: () => string;
  readonly query_factory?: ClaudeAgentSdkQueryFactoryV1;
  /** Test seam for exercising the real bridge without a provider call. */
  readonly tool_factory?: RuntimeSdkToolFactoryV1;
  /** Test seam for inspecting the isolated in-process MCP registration. */
  readonly mcp_server_factory?: typeof createSdkMcpServer;
  /** Test seam and bounded cleanup handoff for isolated run directories. */
  readonly remove_run_directory?: (path: string) => Promise<void>;
  readonly token_publisher?: RuntimeTokenPublisherV1;
}

interface DeferredV1<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
}

type PendingBridgeV1 =
  | {
      readonly kind: "tool_call";
      readonly id: string;
      readonly turn: Extract<RuntimeAdapterTurnV1, { kind: "tool_call" }>;
      readonly deferred: DeferredV1<McpResultV1>;
      delivered: boolean;
      settled: boolean;
    }
  | {
      readonly kind: "skill_load";
      readonly id: string;
      readonly turn: Extract<RuntimeAdapterTurnV1, { kind: "skill_load" }>;
      readonly request: RuntimeSkillLoadRequestV1;
      readonly deferred: DeferredV1<McpResultV1>;
      delivered: boolean;
      settled: boolean;
    };

interface AdapterSessionStateV1 {
  readonly session_id: string;
  readonly request: RuntimeAdapterStartRequestV1;
  readonly runtime_run_id: string;
  readonly trigger_process_id: string;
  readonly lease_generation: number;
  readonly run_cwd: string;
  readonly provider_prompt: string;
  readonly source_signal: AbortSignal;
  readonly controller: AbortController;
  readonly turns: RuntimeAdapterTurnV1[];
  readonly turn_waiters: Array<(turn: RuntimeAdapterTurnV1) => void>;
  readonly bridge: PendingBridgeV1[];
  readonly permission_ids: Map<string, string[]>;
  readonly materialized_skills: Map<
    string,
    Readonly<{
      resolution_id: string;
      version_id: string;
      package_digest: string;
      manifest_digest: string;
      entrypoint: string;
      entry_hashes: Readonly<Record<string, string>>;
    }>
  >;
  readonly abort_listener: () => void;
  query?: ReturnType<ClaudeAgentSdkQueryFactoryV1>;
  query_parameters?: Readonly<{
    prompt: string;
    options: ClaudeAgentSdkOptions;
  }>;
  provider_session_id: string | undefined;
  latest_assistant_error: SDKAssistantMessageError | undefined;
  awaiting_artifact_id: string | undefined;
  terminal_enqueued: boolean;
  retry_pending: boolean;
  business_tool_dispatched: boolean;
  closed: boolean;
  cleanup_started: boolean;
  cleanup_promise?: Promise<void>;
  cleanup_error?: RuntimeExecutionErrorV1;
}

function deferredV1<T>(): DeferredV1<T> {
  let resolvePromise: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return {
    promise,
    resolve(value) {
      resolvePromise?.(value);
    },
  };
}

function sha256BytesV1(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function sha256TextV1(value: string): `sha256:${string}` {
  return sha256BytesV1(new TextEncoder().encode(value));
}

function utf8SizeV1(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function boundedCanonicalJsonSnapshotV1(
  value: unknown,
): unknown | undefined {
  try {
    const snapshot = immutableBoundedJsonSnapshotV1(value);
    canonicalJsonV1(snapshot, {
      max_bytes: MAX_TOOL_INPUT_BYTES_V1,
      max_depth: MAX_TOOL_INPUT_DEPTH_V1,
      max_nodes: MAX_TOOL_INPUT_NODES_V1,
      max_container_entries: MAX_TOOL_COLLECTION_ITEMS_V1,
    });
    return snapshot;
  } catch {
    return undefined;
  }
}

function safeErrorSummaryV1(value: unknown): string {
  void value;
  return "Claude Agent SDK execution failed";
}

function sdkToolNameV1(logicalName: string): string {
  return `mcp__${MCP_SERVER_NAME_V1}__${logicalName}`;
}

function permissionIdentityV1(
  toolName: string,
  input: Readonly<Record<string, unknown>>,
): string {
  try {
    return canonicalJsonV1({ tool_name: toolName, input });
  } catch {
    return `${toolName}\u0000invalid`;
  }
}

function mcpTextV1(value: unknown, isError = false): McpResultV1 {
  let text: string;
  try {
    text = canonicalJsonV1(value);
  } catch {
    text = canonicalJsonV1({
      code: "tool_result_not_json",
      message: "The runtime tool result was not canonical JSON",
    });
    isError = true;
  }
  if (utf8SizeV1(text) > MAX_PROVIDER_RESULT_BYTES_V1) {
    return {
      content: [
        {
          type: "text",
          text: canonicalJsonV1({
            code: "tool_result_too_large",
            message: "The runtime tool result exceeded the provider bridge limit",
          }),
        },
      ],
      isError: true,
    };
  }
  return {
    content: [{ type: "text", text }],
    ...(isError ? { isError: true } : {}),
  };
}

function toolResultForProviderV1(result: RuntimeToolResultV1): McpResultV1 {
  return mcpTextV1(
    {
      outcome: result.outcome,
      retryable: result.retryable,
      side_effect_status: result.side_effect_status,
      ...(result.output === undefined ? {} : { output: result.output }),
      ...(result.error === undefined
        ? {}
        : {
            error: {
              code: "tool_execution_failed",
              message: "The durable tool execution failed",
            },
          }),
    },
    result.outcome === "failed",
  );
}

function safeSkillEntryPathV1(path: string): boolean {
  if (
    path.length === 0 ||
    path.length > 4_096 ||
    path.includes("\u0000") ||
    path.includes("\\") ||
    path.startsWith("/") ||
    path.endsWith("/")
  ) {
    return false;
  }
  const segments = path.split("/");
  return segments.every(
    (segment) =>
      segment.length > 0 &&
      segment !== "." &&
      segment !== "..",
  );
}

function exactEntryHashesV1(
  materialization: RuntimeSkillMaterializationV1,
): Readonly<Record<string, string>> {
  return Object.freeze(
    Object.fromEntries(
      materialization.entries
        .map((entry) => [entry.path, entry.sha256] as const)
        .sort(([left], [right]) => left.localeCompare(right)),
    ),
  );
}

function sameEntryHashesV1(
  left: Readonly<Record<string, string>>,
  right: Readonly<Record<string, string>>,
): boolean {
  return canonicalJsonV1(left) === canonicalJsonV1(right);
}

function skillReloadContainsExactV1(
  response: SDKControlReloadSkillsResponse,
  skillKey: string,
): boolean {
  let snapshot: unknown;
  try {
    snapshot = JSON.parse(
      canonicalJsonV1(response, {
        max_bytes: MAX_PROVIDER_RESULT_BYTES_V1,
      }),
    );
  } catch {
    return false;
  }
  if (typeof snapshot !== "object" || snapshot === null) {
    return false;
  }
  const skills = (
    snapshot as Readonly<{ skills?: unknown }>
  ).skills;
  return (
    Array.isArray(skills) &&
    skills.some(
      (skill) =>
        typeof skill === "object" &&
        skill !== null &&
        skill.name === skillKey,
    )
  );
}

function retryableSdkResultV1(
  result: SDKResultError,
  assistantError: SDKAssistantMessageError | undefined,
): boolean {
  if (
    assistantError === "rate_limit" ||
    assistantError === "overloaded" ||
    assistantError === "server_error"
  ) {
    return true;
  }
  return (
    result.subtype === "error_during_execution" &&
    (result.terminal_reason === "api_error" ||
      result.terminal_reason === "turn_setup_failed")
  );
}

function errorCodeForSdkResultV1(result: SDKResultError): string {
  if (result.subtype === "error_max_turns") return "sdk_max_turns";
  if (result.subtype === "error_max_budget_usd") return "sdk_budget_exhausted";
  if (result.subtype === "error_max_structured_output_retries") {
    return "sdk_structured_output_invalid";
  }
  return "sdk_execution_failed";
}

function providerPromptV1(
  request: RuntimeAdapterStartRequestV1,
  context: RuntimeAdapterContextV1,
): string {
  const prompt = canonicalJsonV1({
    schema_version: "pai_claude_agent_runtime_prompt.v1",
    runtime_run_id: request.runtime_run_id,
    trigger_process_id: request.trigger_process_id,
    intent_ref: request.intent_ref,
    intent_version: request.intent_version,
    structured_intent_hash: request.structured_intent_hash,
    structured_intent: request.structured_intent,
    context_snapshot_ref: request.context_snapshot_ref,
    context_snapshot_version: request.context_snapshot_version,
    context_snapshot_hash: request.context_snapshot_hash,
    context_snapshot: context.context_snapshot,
    allowed_tools: request.allowed_tools,
    allowed_skills: request.allowed_skills,
    response_style: request.structured_intent.response_style,
    deadline_at: context.deadline_at,
  });
  if (utf8SizeV1(prompt) > MAX_PROVIDER_PROMPT_BYTES_V1) {
    throw new RuntimeExecutionErrorV1(
      "runtime_adapter_failed",
      "The canonical provider prompt exceeded the bounded adapter input",
    );
  }
  return prompt;
}

function providerSystemPromptV1(): string {
  return [
    "You execute one Project PAI StructuredIntent inside a fenced runtime run.",
    "Use only the tools exposed by the pai_runtime MCP server and the native Skill tool.",
    "For a business tool, pass only its JSON arguments; authorization is frozen by the runtime and is never model-supplied.",
    "Before using an allowed skill, call skill.load with its exact key; after it succeeds, invoke that skill through the native Skill tool.",
    "skill.load returns only immutable package identity and entrypoint metadata, never instruction contents.",
    "Never invent credentials, object references, tool outcomes, or authorization.",
    "Do not ask for interactive approval; a denied operation must be reported as a final failure.",
    "Return the final user-facing result as plain text.",
  ].join("\n");
}

function validateOptionsV1(
  options: ClaudeAgentSdkRuntimeAdapterOptionsV1,
): void {
  if (
    typeof options.model !== "string" ||
    typeof options.sandbox_cwd !== "string" ||
    options.model.length === 0 ||
    options.model.length > 256 ||
    !isAbsolute(options.sandbox_cwd) ||
    options.sandbox_cwd === "/"
  ) {
    throw new Error("Claude Agent SDK adapter model or sandbox is invalid");
  }
  const maxTurns = options.max_sdk_turns ?? 128;
  const retention =
    options.artifact_retention_ms ?? DEFAULT_ARTIFACT_RETENTION_MS_V1;
  if (
    !Number.isSafeInteger(maxTurns) ||
    maxTurns < 1 ||
    maxTurns > 1_000 ||
    !Number.isSafeInteger(retention) ||
    retention < 60_000 ||
    retention > 365 * 24 * 60 * 60 * 1_000 ||
    (options.max_budget_usd !== undefined &&
      (!Number.isFinite(options.max_budget_usd) ||
        options.max_budget_usd <= 0))
  ) {
    throw new Error("Claude Agent SDK adapter limits are invalid");
  }
}

export function createClaudeAgentSdkPermissionHookV1(
  allowedToolNames: ReadonlySet<string>,
  onAllowed?: (
    toolName: string,
    input: Readonly<Record<string, unknown>>,
    toolUseId: string,
  ) => void,
): CanUseTool {
  const allowedToolSnapshot = new Set(allowedToolNames);
  return async (toolName, input, options) => {
    const inputSnapshot = boundedCanonicalJsonSnapshotV1(input);
    if (
      options.signal.aborted ||
      !allowedToolSnapshot.has(toolName) ||
      inputSnapshot === undefined ||
      typeof inputSnapshot !== "object" ||
      inputSnapshot === null ||
      Array.isArray(inputSnapshot)
    ) {
      return {
        behavior: "deny",
        message: "Tool is outside the frozen RuntimePolicySnapshot",
        interrupt: false,
        toolUseID: options.toolUseID,
        decisionClassification: "user_reject",
      };
    }
    const frozenInput = inputSnapshot as Readonly<
      Record<string, unknown>
    >;
    onAllowed?.(toolName, frozenInput, options.toolUseID);
    return {
      behavior: "allow",
      updatedInput: frozenInput,
      toolUseID: options.toolUseID,
      decisionClassification: "user_temporary",
    };
  };
}

export class ClaudeAgentSdkRuntimeAdapter
  implements RuntimeAdapterPortV1
{
  public readonly adapter_id = ADAPTER_ID_V1;
  public readonly sdk_package = SDK_PACKAGE_V1;
  public readonly sdk_version = SDK_VERSION_V1;
  public readonly model: string;

  readonly #options: ClaudeAgentSdkRuntimeAdapterOptionsV1;
  readonly #now: () => Date;
  readonly #idFactory: () => string;
  readonly #queryFactory: ClaudeAgentSdkQueryFactoryV1;
  readonly #toolFactory: RuntimeSdkToolFactoryV1;
  readonly #mcpServerFactory: typeof createSdkMcpServer;
  readonly #removeRunDirectory: (path: string) => Promise<void>;
  readonly #sessions = new Map<string, AdapterSessionStateV1>();
  readonly #zod: MinimalZodV1;
  #sandboxReconciliation: Promise<void> | undefined;

  public constructor(optionsValue: ClaudeAgentSdkRuntimeAdapterOptionsV1) {
    const options = snapshotAdapterOptionsV1(optionsValue);
    validateOptionsV1(options);
    // Composition snapshots adapter identity without invoking accessors.
    // Keep the selected model as immutable own data like the pinned package
    // identity fields above.
    this.model = options.model;
    Object.defineProperties(this, {
      adapter_id: {
        value: ADAPTER_ID_V1,
        enumerable: true,
        writable: false,
        configurable: false,
      },
      sdk_package: {
        value: SDK_PACKAGE_V1,
        enumerable: true,
        writable: false,
        configurable: false,
      },
      sdk_version: {
        value: SDK_VERSION_V1,
        enumerable: true,
        writable: false,
        configurable: false,
      },
      model: {
        value: options.model,
        enumerable: true,
        writable: false,
        configurable: false,
      },
    });
    this.#options = options;
    this.#now = options.now ?? (() => new Date());
    this.#idFactory = options.id_factory ?? randomUUID;
    this.#queryFactory = options.query_factory ?? claudeAgentSdkQuery;
    this.#toolFactory =
      options.tool_factory ??
      (claudeAgentSdkTool as unknown as RuntimeSdkToolFactoryV1);
    this.#mcpServerFactory =
      options.mcp_server_factory ?? createSdkMcpServer;
    this.#removeRunDirectory =
      options.remove_run_directory ??
      (async (path) =>
        rm(path, {
          recursive: true,
          force: true,
        }));
    const requireFromSdk = createRequire(
      import.meta.resolve(SDK_PACKAGE_V1),
    );
    const peer = requireFromSdk("zod") as Readonly<{
      z: MinimalZodV1;
    }>;
    this.#zod = peer.z;
  }

  async #ensureSandboxReconciledV1(): Promise<void> {
    this.#sandboxReconciliation ??= (async () => {
      await mkdir(this.#options.sandbox_cwd, {
        recursive: true,
        mode: 0o700,
      });
      const sandboxStat = await lstat(this.#options.sandbox_cwd);
      if (!sandboxStat.isDirectory() || sandboxStat.isSymbolicLink()) {
        throw new RuntimeExecutionErrorV1(
          "runtime_adapter_failed",
          "Claude Agent SDK sandbox root is not an isolated directory",
        );
      }
      const entries = await readdir(this.#options.sandbox_cwd, {
        withFileTypes: true,
      });
      for (const entry of entries) {
        if (
          !entry.name.startsWith(RUN_DIRECTORY_PREFIX_V1) ||
          !entry.isDirectory() ||
          entry.isSymbolicLink()
        ) {
          continue;
        }
        const residual = resolve(
          this.#options.sandbox_cwd,
          entry.name,
        );
        if (
          !residual.startsWith(
            `${resolve(this.#options.sandbox_cwd)}${sep}`,
          )
        ) {
          throw new RuntimeExecutionErrorV1(
            "runtime_adapter_failed",
            "Residual SDK run directory escaped the sandbox root",
          );
        }
        // Prefixes and symlink-followed marker contents are not ownership
        // proofs. Never recursively delete a directory unless an exact,
        // bounded regular marker was opened with O_NOFOLLOW.
        if (!(await hasExactRunOwnerMarkerV1(residual))) continue;
        try {
          await this.#removeRunDirectory(residual);
        } catch {
          throw new RuntimeExecutionErrorV1(
            "runtime_adapter_failed",
            "Residual SDK run directory cleanup failed",
            true,
          );
        }
      }
    })();
    return this.#sandboxReconciliation;
  }

  public async start(
    requestValue: RuntimeAdapterStartRequestV1,
    contextValue: RuntimeAdapterContextV1,
  ): Promise<RuntimeAdapterSessionV1> {
    let request: RuntimeAdapterStartRequestV1;
    let contextSnapshot: RuntimeAdapterContextV1["context_snapshot"];
    try {
      request = immutableBoundedJsonSnapshotV1(
        requestValue,
      ) as RuntimeAdapterStartRequestV1;
      contextSnapshot = immutableBoundedJsonSnapshotV1(
        contextValue.context_snapshot,
      ) as RuntimeAdapterContextV1["context_snapshot"];
    } catch {
      throw new RuntimeExecutionErrorV1(
        "runtime_adapter_failed",
        "Claude Agent SDK start input is not bounded canonical JSON",
      );
    }
    const context = Object.freeze({
      runtime_run_id: contextValue.runtime_run_id,
      trigger_process_id: contextValue.trigger_process_id,
      lease_generation: contextValue.lease_generation,
      deadline_at: contextValue.deadline_at,
      signal: contextValue.signal,
      context_snapshot: contextSnapshot,
    }) satisfies RuntimeAdapterContextV1;
    if (
      context.signal.aborted ||
      context.runtime_run_id !== request.runtime_run_id ||
      context.trigger_process_id !== request.trigger_process_id ||
      context.context_snapshot.snapshot_hash !==
        request.context_snapshot_hash ||
      Date.parse(context.deadline_at) <= this.#now().getTime()
    ) {
      throw new RuntimeExecutionErrorV1(
        "runtime_adapter_failed",
        "Claude Agent SDK start context is stale or identity-mismatched",
      );
    }
    const authorizationEntries = Object.entries(request.tool_authorizations);
    if (
      authorizationEntries.length !== request.allowed_tools.length ||
      request.allowed_tools.some(
        (toolName) =>
          typeof request.tool_authorizations[toolName] !== "string" ||
          request.tool_authorizations[toolName]!.length === 0 ||
          request.tool_authorizations[toolName]!.length > 512 ||
          /[\r\n]/u.test(request.tool_authorizations[toolName]!),
      ) ||
      authorizationEntries.some(
        ([toolName]) => !request.allowed_tools.includes(toolName),
      )
    ) {
      throw new RuntimeExecutionErrorV1(
        "runtime_adapter_failed",
        "Frozen tool authorization mapping does not match the executable tool set",
      );
    }
    if (
      request.allowed_tools.includes(SKILL_LOAD_TOOL_V1) ||
      request.allowed_tools.some(
        (toolName) =>
          !/^[A-Za-z0-9_.-]{1,128}$/u.test(toolName),
      )
    ) {
      throw new RuntimeExecutionErrorV1(
        "runtime_adapter_failed",
        "Frozen tool names are not compatible with the isolated MCP bridge",
      );
    }
    const sessionId = this.#idFactory();
    if (sessionId.length === 0 || this.#sessions.has(sessionId)) {
      throw new RuntimeExecutionErrorV1(
        "runtime_adapter_failed",
        "Claude Agent SDK session identity is invalid",
      );
    }
    const providerPrompt = providerPromptV1(request, context);
    await this.#ensureSandboxReconciledV1();
    const runCwd = await mkdtemp(
      join(this.#options.sandbox_cwd, RUN_DIRECTORY_PREFIX_V1),
    );
    try {
      await chmod(runCwd, 0o700);
      await writeFile(
        join(runCwd, RUN_OWNER_MARKER_V1),
        RUN_OWNER_MARKER_CONTENT_V1,
        { flag: "wx", mode: 0o600 },
      );
      await Promise.all([
        mkdir(join(runCwd, CONFIG_ROOT_RELATIVE_V1), {
          recursive: true,
          mode: 0o700,
        }),
        mkdir(join(runCwd, ".tmp"), {
          recursive: true,
          mode: 0o700,
        }),
        mkdir(join(runCwd, SKILL_ROOT_RELATIVE_V1), {
          recursive: true,
          mode: 0o700,
        }),
      ]);
    } catch {
      try {
        await this.#removeRunDirectory(runCwd);
      } catch {
        throw new RuntimeExecutionErrorV1(
          "runtime_adapter_failed",
          "Claude Agent SDK isolated directory initialization cleanup failed",
          true,
        );
      }
      throw new RuntimeExecutionErrorV1(
        "runtime_adapter_failed",
        "Claude Agent SDK isolated directory initialization failed",
        true,
      );
    }
    const controller = new AbortController();
    let state: AdapterSessionStateV1;
    const abortListener = () => {
      controller.abort(context.signal.reason);
      void this.#closeSessionV1(state, "sdk_interrupted").catch(
        (error: unknown) => {
          state.cleanup_error =
            error instanceof RuntimeExecutionErrorV1
              ? error
              : new RuntimeExecutionErrorV1(
                  "runtime_adapter_failed",
                  "SDK run directory cleanup failed",
                  true,
                );
        },
      );
    };
    state = {
      session_id: sessionId,
      request,
      runtime_run_id: request.runtime_run_id,
      trigger_process_id: request.trigger_process_id,
      lease_generation: context.lease_generation,
      run_cwd: runCwd,
      provider_prompt: providerPrompt,
      source_signal: context.signal,
      controller,
      turns: [],
      turn_waiters: [],
      bridge: [],
      permission_ids: new Map(),
      materialized_skills: new Map(),
      abort_listener: abortListener,
      provider_session_id: undefined,
      latest_assistant_error: undefined,
      awaiting_artifact_id: undefined,
      terminal_enqueued: false,
      retry_pending: false,
      business_tool_dispatched: false,
      closed: false,
      cleanup_started: false,
    };
    context.signal.addEventListener("abort", state.abort_listener, {
      once: true,
    });
    this.#sessions.set(sessionId, state);
    if (context.signal.aborted) {
      await this.#closeSessionV1(state, "sdk_interrupted");
      throw new RuntimeExecutionErrorV1(
        "runtime_adapter_failed",
        "Claude Agent SDK start was interrupted",
      );
    }
    this.#startQueryV1(state);
    return Object.freeze({ session_id: sessionId });
  }

  public async next(
    session: RuntimeAdapterSessionV1,
    context: RuntimeAdapterContextV1,
  ): Promise<RuntimeAdapterTurnV1> {
    const state = this.#requireSessionV1(session, context);
    if (state.retry_pending) {
      state.retry_pending = false;
      state.latest_assistant_error = undefined;
      state.provider_session_id = undefined;
      state.query?.close();
      this.#startQueryV1(state);
    }
    await this.#settleBridgeV1(state, context);
    if (
      state.awaiting_artifact_id !== undefined &&
      context.last_artifact_id === state.awaiting_artifact_id &&
      context.last_artifact_ref !== undefined
    ) {
      state.awaiting_artifact_id = undefined;
      this.#enqueueTurnV1(state, {
        kind: "complete",
        terminal_artifact_ref: context.last_artifact_ref,
      });
    }
    const bridgeTurn = state.bridge.find(
      (entry) => !entry.delivered && !entry.settled,
    );
    if (bridgeTurn !== undefined) {
      bridgeTurn.delivered = true;
      if (bridgeTurn.kind === "tool_call") {
        state.business_tool_dispatched = true;
      }
      return bridgeTurn.turn;
    }
    const queued = state.turns.shift();
    if (queued !== undefined) {
      if (queued.kind === "failed" && queued.retryable) {
        state.retry_pending = true;
      } else if (queued.kind === "complete" || queued.kind === "failed") {
        await this.#closeSessionV1(state);
      }
      return queued;
    }
    if (state.closed) {
      return {
        kind: "failed",
        retryable: false,
        reason_code: "sdk_session_closed",
        error_summary: "Claude Agent SDK session closed before a terminal result",
      };
    }
    if (state.turn_waiters.length >= MAX_TURN_WAITERS_V1) {
      throw new RuntimeExecutionErrorV1(
        "runtime_adapter_failed",
        "Concurrent SDK turn waiters exceeded the bounded adapter limit",
      );
    }
    return new Promise<RuntimeAdapterTurnV1>((resolve) => {
      let waiter: (turn: RuntimeAdapterTurnV1) => void;
      const onAbort = () => {
        const index = state.turn_waiters.indexOf(waiter);
        if (index >= 0) state.turn_waiters.splice(index, 1);
        state.controller.abort(context.signal.reason);
        void this.#closeSessionV1(state, "sdk_interrupted").then(
          () =>
            resolve({
              kind: "failed",
              retryable: false,
              reason_code: "sdk_interrupted",
              error_summary: "Claude Agent SDK session was interrupted",
            }),
          () =>
            resolve({
              kind: "failed",
              retryable: true,
              reason_code: "sdk_cleanup_failed",
              error_summary:
                "Claude Agent SDK isolated directory cleanup failed",
            }),
        );
      };
      waiter = (turn) => {
        context.signal.removeEventListener("abort", onAbort);
        if (turn.kind === "failed" && turn.retryable) {
          state.retry_pending = true;
        } else if (turn.kind === "complete" || turn.kind === "failed") {
          void this.#closeSessionV1(state).then(
            () => resolve(turn),
            () =>
              resolve({
                kind: "failed",
                retryable: true,
                reason_code: "sdk_cleanup_failed",
                error_summary:
                  "Claude Agent SDK isolated directory cleanup failed",
              }),
          );
          return;
        }
        resolve(turn);
      };
      if (context.signal.aborted) {
        onAbort();
        return;
      }
      context.signal.addEventListener("abort", onAbort, { once: true });
      state.turn_waiters.push(waiter);
    });
  }

  public async cancel(
    session: RuntimeAdapterSessionV1,
    _reason: string,
    signal?: AbortSignal,
  ): Promise<void> {
    const state = this.#sessions.get(session.session_id);
    if (state === undefined) return;
    if (state.closed) {
      if (state.cleanup_error !== undefined) throw state.cleanup_error;
      await state.cleanup_promise;
      return;
    }
    if (signal?.aborted === true) {
      await this.#closeSessionV1(state);
      return;
    }
    state.controller.abort(new Error("runtime_control_interrupt"));
    try {
      await state.query?.interrupt();
    } catch {
      // The durable Runtime control fact owns the outcome. Adapter transport
      // interruption is best-effort and the query is force-closed below.
    } finally {
      state.query?.close();
      await this.#closeSessionV1(state);
    }
  }

  #requireSessionV1(
    session: RuntimeAdapterSessionV1,
    context: RuntimeAdapterContextV1,
  ): AdapterSessionStateV1 {
    const state = this.#sessions.get(session.session_id);
    if (
      state === undefined ||
      state.runtime_run_id !== context.runtime_run_id ||
      state.trigger_process_id !== context.trigger_process_id ||
      state.lease_generation !== context.lease_generation
    ) {
      throw new RuntimeExecutionErrorV1(
        "runtime_adapter_failed",
        "Claude Agent SDK session is missing or fenced",
      );
    }
    return state;
  }

  #permissionIdV1(
    state: AdapterSessionStateV1,
    logicalToolName: string,
    input: Readonly<Record<string, unknown>>,
  ): string | undefined {
    const identity = permissionIdentityV1(
      sdkToolNameV1(logicalToolName),
      input,
    );
    const ids = state.permission_ids.get(identity);
    const id = ids?.shift();
    if (ids?.length === 0) state.permission_ids.delete(identity);
    return id;
  }

  #enqueueToolBridgeV1(
    state: AdapterSessionStateV1,
    toolName: string,
    args: Readonly<Record<string, unknown>>,
  ): Promise<McpResultV1> {
    const argsSnapshot = boundedCanonicalJsonSnapshotV1(args);
    if (
      state.closed ||
      state.controller.signal.aborted ||
      argsSnapshot === undefined ||
      typeof argsSnapshot !== "object" ||
      argsSnapshot === null ||
      Array.isArray(argsSnapshot) ||
      state.bridge.length >= MAX_BRIDGE_ENTRIES_V1 ||
      !state.request.allowed_tools.includes(toolName)
    ) {
      return Promise.resolve(
        mcpTextV1(
          {
            code: "tool_policy_denied",
            message: "Tool call is outside the frozen adapter contract",
          },
          true,
        ),
      );
    }
    const frozenArgs = argsSnapshot as Readonly<
      Record<string, unknown>
    >;
    const capability = state.request.tool_authorizations[toolName];
    if (
      typeof capability !== "string" ||
      Object.keys(frozenArgs).length !== 1 ||
      !Object.hasOwn(frozenArgs, "arguments")
    ) {
      return Promise.resolve(
        mcpTextV1(
          {
            code: "tool_policy_denied",
            message: "Tool call is outside the frozen adapter contract",
          },
          true,
        ),
      );
    }
    const id = this.#permissionIdV1(
      state,
      toolName,
      frozenArgs,
    );
    if (id === undefined) {
      return Promise.resolve(
        mcpTextV1(
          {
            code: "tool_permission_hook_missing",
            message:
              "The SDK tool use was not bound to an allowed canUseTool decision",
          },
          true,
        ),
      );
    }
    const deferred = deferredV1<McpResultV1>();
    state.bridge.push({
      kind: "tool_call",
      id,
      turn: {
        kind: "tool_call",
        call: {
          tool_call_id: id,
          tool_name: toolName,
          capability,
          arguments: frozenArgs.arguments,
        },
      },
      deferred,
      delivered: false,
      settled: false,
    });
    this.#wakeTurnWaiterV1(state);
    return deferred.promise;
  }

  #enqueueSkillBridgeV1(
    state: AdapterSessionStateV1,
    args: Readonly<Record<string, unknown>>,
  ): Promise<McpResultV1> {
    const argsSnapshot = boundedCanonicalJsonSnapshotV1(args);
    if (
      state.closed ||
      state.controller.signal.aborted ||
      argsSnapshot === undefined ||
      typeof argsSnapshot !== "object" ||
      argsSnapshot === null ||
      Array.isArray(argsSnapshot) ||
      state.bridge.length >= MAX_BRIDGE_ENTRIES_V1
    ) {
      return Promise.resolve(
        mcpTextV1(
          {
            code: "skill_policy_denied",
            message: "Skill is outside the frozen RuntimePolicySnapshot",
          },
          true,
        ),
      );
    }
    const request = argsSnapshot as RuntimeSkillLoadRequestV1;
    const skillKey = request.skill_name;
    if (
      !Value.Check(RuntimeSkillLoadRequestV1Schema, request) ||
      request.runtime_run_id !== state.runtime_run_id ||
      request.idempotency_key !==
        `${state.runtime_run_id}:skill:${skillKey}` ||
      !state.request.allowed_skills.includes(skillKey)
    ) {
      return Promise.resolve(
        mcpTextV1(
          {
            code: "skill_policy_denied",
            message: "Skill is outside the frozen RuntimePolicySnapshot",
          },
          true,
        ),
      );
    }
    const id = this.#permissionIdV1(state, SKILL_LOAD_TOOL_V1, args);
    if (id === undefined) {
      return Promise.resolve(
        mcpTextV1(
          {
            code: "skill_permission_hook_missing",
            message:
              "The SDK skill load was not bound to an allowed canUseTool decision",
          },
          true,
        ),
      );
    }
    const deferred = deferredV1<McpResultV1>();
    state.bridge.push({
      kind: "skill_load",
      id,
      turn: { kind: "skill_load", skill_key: skillKey },
      request,
      deferred,
      delivered: false,
      settled: false,
    });
    this.#wakeTurnWaiterV1(state);
    return deferred.promise;
  }

  async #materializeSkillV1(
    state: AdapterSessionStateV1,
    request: RuntimeSkillLoadRequestV1,
    resolution: NonNullable<RuntimeAdapterContextV1["last_skill"]>,
    materialization: RuntimeSkillMaterializationV1,
    auditEventId: string,
  ): Promise<McpResultV1> {
    assertRuntimeSkillMaterializationManifestV1(materialization);
    const skillKey = resolution.skill_key;
    const entryPaths = materialization.entry_paths;
    const uniqueEntryPaths = new Set(entryPaths);
    const entriesByPath = new Map(
      materialization.entries.map((entry) => [entry.path, entry] as const),
    );
    const totalEntryBytes = materialization.entries.reduce(
      (total, entry) => total + entry.bytes.byteLength,
      0,
    );
    const entryHashes = exactEntryHashesV1(materialization);
    const current = state.materialized_skills.get(skillKey);
    if (
      !state.request.allowed_skills.includes(skillKey) ||
      resolution.resolution_id.length === 0 ||
      resolution.version_id.length === 0 ||
      !Number.isFinite(Date.parse(resolution.valid_until)) ||
      Date.parse(resolution.valid_until) <= this.#now().getTime() ||
      resolution.runtime_target !== "filesystem_bundle.v1" ||
      materialization.runtime_target !== "filesystem_bundle.v1" ||
      (materialization.source !== "skill_registry" &&
        materialization.source !== "registry_cache") ||
      request.skill_name !== skillKey ||
      !/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/u.test(skillKey) ||
      auditEventId.length < 1 ||
      auditEventId.length > 512 ||
      !(materialization.bytes instanceof Uint8Array) ||
      materialization.bytes.byteLength === 0 ||
      materialization.bytes.byteLength > SKILL_PACKAGE_MAX_BYTES_V1 ||
      !(materialization.manifest_bytes instanceof Uint8Array) ||
      materialization.manifest_bytes.byteLength === 0 ||
      materialization.media_type.length === 0 ||
      materialization.media_type.length > 256 ||
      materialization.package_digest !== resolution.package_digest ||
      materialization.manifest_digest !== resolution.manifest_digest ||
      sha256BytesV1(materialization.bytes) !== resolution.package_digest ||
      sha256BytesV1(materialization.manifest_bytes) !==
        resolution.manifest_digest ||
      entryPaths.length === 0 ||
      entryPaths.length > SKILL_PACKAGE_MAX_FILES_V1 ||
      uniqueEntryPaths.size !== entryPaths.length ||
      !uniqueEntryPaths.has("SKILL.md") ||
      materialization.entries.length !== entryPaths.length ||
      entriesByPath.size !== materialization.entries.length ||
      totalEntryBytes < 1 ||
      totalEntryBytes > SKILL_PACKAGE_MAX_BYTES_V1 ||
      entryPaths.some(
        (path) =>
          !safeSkillEntryPathV1(path) || !entriesByPath.has(path),
      ) ||
      materialization.entries.some(
        (entry) =>
          !safeSkillEntryPathV1(entry.path) ||
          !(entry.bytes instanceof Uint8Array) ||
          entry.bytes.byteLength === 0 ||
          (entry.path === "SKILL.md" &&
            entry.bytes.byteLength > SKILL_ENTRYPOINT_MAX_BYTES_V1) ||
          !/^sha256:[0-9a-f]{64}$/u.test(entry.sha256) ||
          sha256BytesV1(entry.bytes) !== entry.sha256,
      )
    ) {
      throw new RuntimeExecutionErrorV1(
        "skill_content_mismatch",
        "Skill materialization does not match the exact frozen filesystem bundle",
      );
    }
    if (current !== undefined) {
      if (
        current.resolution_id !== resolution.resolution_id ||
        current.version_id !== resolution.version_id ||
        current.package_digest !== materialization.package_digest ||
        current.manifest_digest !== materialization.manifest_digest ||
        !sameEntryHashesV1(current.entry_hashes, entryHashes)
      ) {
        throw new RuntimeExecutionErrorV1(
          "skill_content_mismatch",
          "A loaded skill key was replayed with different immutable content",
        );
      }
      const response: RuntimeSkillLoadResponseV1 = {
        code: "skill_loaded",
        message: "skill loaded",
        retryable: false,
        trace_id: state.request.trace_id,
        details: {
          skill_name: skillKey,
          resolution_id: current.resolution_id,
          version_id: current.version_id,
          package_digest: current.package_digest,
          manifest_digest: current.manifest_digest,
          digest_verified: true,
          runtime_target: "filesystem_bundle.v1",
          entrypoint: current.entrypoint,
          source: materialization.source,
          materialization_status: "loaded",
          audit_event_id: auditEventId,
        },
      };
      if (!Value.Check(RuntimeSkillLoadResponseV1Schema, response)) {
        throw new RuntimeExecutionErrorV1(
          "skill_content_mismatch",
          "Skill load response is outside the canonical owner contract",
        );
      }
      assertRuntimeSkillLoadBindingsV1(request, response);
      return mcpTextV1(response);
    }

    const skillRoot = resolve(state.run_cwd, SKILL_ROOT_RELATIVE_V1);
    const finalDirectory = resolve(
      skillRoot,
      skillKey,
    );
    if (!finalDirectory.startsWith(`${skillRoot}${sep}`)) {
      throw new RuntimeExecutionErrorV1(
        "skill_content_mismatch",
        "Skill materialization escaped the isolated run directory",
      );
    }
    await mkdir(skillRoot, { recursive: true, mode: 0o700 });
    const stagingDirectory = await mkdtemp(
      join(skillRoot, ".staging-"),
    );
    await chmod(stagingDirectory, 0o700);
    let renamed = false;
    try {
      for (const entry of materialization.entries) {
        const target = resolve(stagingDirectory, entry.path);
        if (!target.startsWith(`${stagingDirectory}${sep}`)) {
          throw new RuntimeExecutionErrorV1(
            "skill_content_mismatch",
            "Skill entry escaped its isolated staging directory",
          );
        }
        const parent = resolve(target, "..");
        await mkdir(parent, { recursive: true, mode: 0o700 });
        await writeFile(target, entry.bytes, {
          flag: "wx",
          mode: 0o600,
        });
      }
      await rename(stagingDirectory, finalDirectory);
      renamed = true;
      if (
        state.query === undefined ||
        typeof state.query.reloadSkills !== "function"
      ) {
        throw new RuntimeExecutionErrorV1(
          "skill_content_mismatch",
          "Pinned Claude Agent SDK query cannot reload materialized skills",
        );
      }
      const reloaded = await state.query.reloadSkills();
      if (!skillReloadContainsExactV1(reloaded, skillKey)) {
        throw new RuntimeExecutionErrorV1(
          "skill_content_mismatch",
          "Pinned Claude Agent SDK did not discover the exact materialized skill",
        );
      }
      const entrypoint = join(
        SKILL_ROOT_RELATIVE_V1,
        skillKey,
        "SKILL.md",
      );
      state.materialized_skills.set(
        skillKey,
        Object.freeze({
          resolution_id: resolution.resolution_id,
          version_id: resolution.version_id,
          package_digest: materialization.package_digest,
          manifest_digest: materialization.manifest_digest,
          entrypoint,
          entry_hashes: entryHashes,
        }),
      );
      const response: RuntimeSkillLoadResponseV1 = {
        code: "skill_loaded",
        message: "skill loaded",
        retryable: false,
        trace_id: state.request.trace_id,
        details: {
          skill_name: skillKey,
          resolution_id: resolution.resolution_id,
          version_id: resolution.version_id,
          package_digest: materialization.package_digest,
          manifest_digest: materialization.manifest_digest,
          digest_verified: true,
          runtime_target: "filesystem_bundle.v1",
          entrypoint,
          source: materialization.source,
          materialization_status: "loaded",
          audit_event_id: auditEventId,
        },
      };
      if (!Value.Check(RuntimeSkillLoadResponseV1Schema, response)) {
        throw new RuntimeExecutionErrorV1(
          "skill_content_mismatch",
          "Skill load response is outside the canonical owner contract",
        );
      }
      assertRuntimeSkillLoadBindingsV1(request, response);
      return mcpTextV1(response);
    } catch (error) {
      await rm(
        renamed ? finalDirectory : stagingDirectory,
        { recursive: true, force: true },
      );
      if (error instanceof RuntimeExecutionErrorV1) throw error;
      throw new RuntimeExecutionErrorV1(
        "skill_content_mismatch",
        "Skill materialization failed inside the isolated run directory",
      );
    }
  }

  async #settleBridgeV1(
    state: AdapterSessionStateV1,
    context: RuntimeAdapterContextV1,
  ): Promise<void> {
    for (const entry of state.bridge) {
      if (!entry.delivered || entry.settled) continue;
      if (
        entry.kind === "tool_call" &&
        context.last_tool_call_id === entry.id &&
        context.last_tool_result !== undefined
      ) {
        entry.settled = true;
        entry.deferred.resolve(
          toolResultForProviderV1(context.last_tool_result),
        );
      } else if (
        entry.kind === "skill_load" &&
        context.last_skill?.skill_key === entry.turn.skill_key &&
        context.last_skill_materialization !== undefined &&
        context.last_skill_audit_event_id !== undefined
      ) {
        try {
          const providerResult = await this.#materializeSkillV1(
            state,
            entry.request,
            context.last_skill,
            context.last_skill_materialization,
            context.last_skill_audit_event_id,
          );
          entry.settled = true;
          entry.deferred.resolve(providerResult);
        } catch (error) {
          entry.settled = true;
          entry.deferred.resolve(
            mcpTextV1(
              {
                code: "skill_content_mismatch",
                message:
                  "The exact frozen skill package could not be loaded",
              },
              true,
            ),
          );
          for (
            let index = state.bridge.length - 1;
            index >= 0;
            index -= 1
          ) {
            if (state.bridge[index]?.settled === true) {
              state.bridge.splice(index, 1);
            }
          }
          throw error;
        }
      }
    }
    for (
      let index = state.bridge.length - 1;
      index >= 0;
      index -= 1
    ) {
      if (state.bridge[index]?.settled === true) {
        state.bridge.splice(index, 1);
      }
    }
  }

  #enqueueTurnV1(
    state: AdapterSessionStateV1,
    turn: RuntimeAdapterTurnV1,
  ): void {
    if (state.closed || state.terminal_enqueued) return;
    if (
      state.turn_waiters.length === 0 &&
      state.turns.length >= MAX_TURN_QUEUE_V1
    ) {
      state.turns.splice(0);
      state.terminal_enqueued = true;
      state.turns.push({
        kind: "failed",
        retryable: false,
        reason_code: "sdk_turn_queue_exhausted",
        error_summary:
          "Claude Agent SDK exceeded the bounded turn queue",
      });
      state.query?.close();
      return;
    }
    if (
      turn.kind === "complete" ||
      (turn.kind === "failed" && !turn.retryable)
    ) {
      state.terminal_enqueued = true;
    }
    const waiter = state.turn_waiters.shift();
    if (waiter === undefined) state.turns.push(turn);
    else waiter(turn);
  }

  #wakeTurnWaiterV1(state: AdapterSessionStateV1): void {
    const waiter = state.turn_waiters.shift();
    const bridgeTurn = state.bridge.find(
      (entry) => !entry.delivered && !entry.settled,
    );
    if (waiter === undefined || bridgeTurn === undefined) {
      if (waiter !== undefined) state.turn_waiters.unshift(waiter);
      return;
    }
    bridgeTurn.delivered = true;
    if (bridgeTurn.kind === "tool_call") {
      state.business_tool_dispatched = true;
    }
    waiter(bridgeTurn.turn);
  }

  #queryParametersV1(
    state: AdapterSessionStateV1,
  ): Readonly<{
    prompt: string;
    options: ClaudeAgentSdkOptions;
  }> {
    const toolDefinitions = state.request.allowed_tools.map(
      (toolName) =>
        this.#toolFactory(
          toolName,
          `Invoke the frozen Project PAI tool ${toolName}. The runtime enforces capability and argument policy before dispatch.`,
          {
            arguments: this.#zod.unknown(),
          },
          async (args) =>
            this.#enqueueToolBridgeV1(state, toolName, args),
        ),
    );
    if (state.request.allowed_skills.length > 0) {
      toolDefinitions.push(
        this.#toolFactory(
          SKILL_LOAD_TOOL_V1,
          "Materialize one exact pre-resolved skill package into the isolated SDK project directory.",
          {
            skill_name: this.#zod.string().min(1).max(64),
            runtime_run_id: this.#zod.string().min(1).max(512),
            idempotency_key: this.#zod.string().min(1).max(512),
          },
          async (args) => this.#enqueueSkillBridgeV1(state, args),
        ),
      );
    }
    const mcpServer = this.#mcpServerFactory({
      name: MCP_SERVER_NAME_V1,
      version: "1.0.0",
      instructions:
        "All calls cross the Project PAI durable permission, audit, idempotency, and fencing bridge.",
      tools:
        toolDefinitions as unknown as NonNullable<
          Parameters<typeof createSdkMcpServer>[0]["tools"]
        >,
      alwaysLoad: true,
    });
    const mcpToolNames = new Set(
      [
        ...state.request.allowed_tools,
        ...(state.request.allowed_skills.length === 0
          ? []
          : [SKILL_LOAD_TOOL_V1]),
      ].map(sdkToolNameV1),
    );
    const allowedSdkTools = new Set(mcpToolNames);
    if (state.request.allowed_skills.length > 0) {
      allowedSdkTools.add("Skill");
    }
    const canUseTool = createClaudeAgentSdkPermissionHookV1(
      allowedSdkTools,
      (toolName, input, toolUseId) => {
        if (!mcpToolNames.has(toolName)) return;
        const identity = permissionIdentityV1(toolName, input);
        const ids = state.permission_ids.get(identity) ?? [];
        ids.push(toolUseId);
        state.permission_ids.set(identity, ids);
      },
    );
    // The official SDK normalizes its private env copy in place (it removes
    // NODE_OPTIONS/DEBUG and sets CLAUDE_CODE_ENTRYPOINT). Give it a fresh
    // detached object per query; freezing this consumer-owned copy would break
    // the pinned SDK even though the validated adapter options stay frozen.
    const environment = {
      ...this.#options.provider_env,
      HOME: state.run_cwd,
      CLAUDE_CONFIG_DIR: join(
        state.run_cwd,
        CONFIG_ROOT_RELATIVE_V1,
      ),
      TMPDIR: join(state.run_cwd, ".tmp"),
      CLAUDE_AGENT_SDK_CLIENT_APP:
        "project-pai-action-runtime/1.0.0",
    };
    const options: ClaudeAgentSdkOptions = {
      abortController: state.controller,
      cwd: state.run_cwd,
      env: environment,
      model: this.#options.model,
      maxTurns: this.#options.max_sdk_turns ?? 128,
      ...(this.#options.max_budget_usd === undefined
        ? {}
        : { maxBudgetUsd: this.#options.max_budget_usd }),
      tools:
        state.request.allowed_skills.length === 0 ? [] : ["Skill"],
      skills: [...state.request.allowed_skills],
      plugins: [],
      mcpServers: {
        [MCP_SERVER_NAME_V1]: mcpServer as McpServerConfig,
      },
      strictMcpConfig: true,
      settingSources: ["project"],
      persistSession: false,
      permissionMode: "dontAsk",
      canUseTool,
      systemPrompt: providerSystemPromptV1(),
      includePartialMessages: this.#options.token_publisher !== undefined,
      includeHookEvents: false,
    };
    return Object.freeze({
      prompt: state.provider_prompt,
      options,
    });
  }

  #startQueryV1(state: AdapterSessionStateV1): void {
    if (
      state.closed ||
      state.controller.signal.aborted
    ) {
      return;
    }
    try {
      state.permission_ids.clear();
      const parameters = this.#queryParametersV1(state);
      state.query_parameters = parameters;
      state.query = this.#queryFactory(parameters);
    } catch (error) {
      this.#enqueueTurnV1(state, {
        kind: "failed",
        retryable: false,
        reason_code: "sdk_start_failed",
        error_summary: safeErrorSummaryV1(error),
      });
      return;
    }
    void this.#pumpSdkV1(state);
  }

  async #pumpSdkV1(state: AdapterSessionStateV1): Promise<void> {
    const query = state.query;
    if (query === undefined) return;
    try {
      for await (const upstreamMessage of query) {
        if (
          state.closed ||
          state.controller.signal.aborted ||
          state.query !== query
        ) {
          return;
        }
        let message: SDKMessage;
        try {
          message = JSON.parse(
            canonicalJsonV1(upstreamMessage, {
              max_bytes: MAX_PROVIDER_RESULT_BYTES_V1,
            }),
          ) as SDKMessage;
        } catch {
          this.#enqueueTurnV1(state, {
            kind: "failed",
            retryable: false,
            reason_code: "sdk_shape_drift",
            error_summary:
              "Claude Agent SDK emitted a non-canonical message",
          });
          return;
        }
        if (
          typeof message !== "object" ||
          message === null ||
          typeof message.type !== "string"
        ) {
          this.#enqueueTurnV1(state, {
            kind: "failed",
            retryable: false,
            reason_code: "sdk_shape_drift",
            error_summary: "Claude Agent SDK emitted an unknown message shape",
          });
          return;
        }
        if (
          "session_id" in message &&
          typeof message.session_id === "string"
        ) {
          if (
            state.provider_session_id !== undefined &&
            state.provider_session_id !== message.session_id
          ) {
            this.#enqueueTurnV1(state, {
              kind: "failed",
              retryable: false,
              reason_code: "sdk_session_drift",
              error_summary: "Claude Agent SDK changed session identity mid-run",
            });
            return;
          }
          state.provider_session_id = message.session_id;
        }
        if (message.type === "stream_event") {
          const event = message.event as unknown as Readonly<
            Record<string, unknown>
          >;
          const delta = event.delta as Readonly<Record<string, unknown>> | undefined;
          if (
            event.type === "content_block_delta" &&
            delta?.type === "text_delta" &&
            typeof delta.text === "string" &&
            delta.text.length > 0
          ) {
            try {
              await this.#options.token_publisher?.publish(
                Object.freeze({
                  runtime_run_id: state.runtime_run_id,
                  trigger_process_id: state.trigger_process_id,
                  scope: Object.freeze({
                    workspace_id: state.request.workspace_id,
                    bot_id: state.request.bot_id,
                    owner_agent_id: state.request.owner_agent_id,
                    deployment_environment:
                      state.request.deployment_environment,
                    release_channel: state.request.release_channel,
                  }),
                  token: delta.text,
                  emitted_at: this.#now().toISOString(),
                }),
                state.controller.signal,
              );
            } catch {
              // Token frames are explicitly ephemeral. A side-stream outage
              // must not rewrite or terminalize the durable Runtime result.
            }
          }
          continue;
        }
        if (message.type === "assistant" && message.error !== undefined) {
          state.latest_assistant_error = message.error;
          continue;
        }
        if (message.type !== "result") continue;
        if (
          ![
            "success",
            "error_during_execution",
            "error_max_turns",
            "error_max_budget_usd",
            "error_max_structured_output_retries",
          ].includes(message.subtype)
        ) {
          this.#enqueueTurnV1(state, {
            kind: "failed",
            retryable: false,
            reason_code: "sdk_shape_drift",
            error_summary: "Claude Agent SDK emitted an unknown result subtype",
          });
          return;
        }
        if (message.subtype !== "success") {
          this.#enqueueTurnV1(state, {
            kind: "failed",
            retryable:
              !state.business_tool_dispatched &&
              retryableSdkResultV1(
                message,
                state.latest_assistant_error,
              ),
            reason_code: errorCodeForSdkResultV1(message),
            error_summary: `Claude Agent SDK ended with ${message.subtype}`,
          });
          return;
        }
        if (typeof message.result !== "string") {
          this.#enqueueTurnV1(state, {
            kind: "failed",
            retryable: false,
            reason_code: "sdk_shape_drift",
            error_summary: "Claude Agent SDK success result was not textual",
          });
          return;
        }
        let finalValue: string;
        try {
          finalValue =
            message.structured_output === undefined
              ? message.result
              : canonicalJsonV1(message.structured_output);
        } catch {
          this.#enqueueTurnV1(state, {
            kind: "failed",
            retryable: false,
            reason_code: "sdk_shape_drift",
            error_summary: "Claude Agent SDK structured output was not canonical JSON",
          });
          return;
        }
        if (finalValue.length === 0) {
          this.#enqueueTurnV1(state, {
            kind: "complete",
            terminal_artifact_ref: null,
          });
          return;
        }
        if (utf8SizeV1(finalValue) > MAX_PROVIDER_RESULT_BYTES_V1) {
          this.#enqueueTurnV1(state, {
            kind: "failed",
            retryable: false,
            reason_code: "sdk_result_too_large",
            error_summary: "Claude Agent SDK final result exceeded the artifact limit",
          });
          return;
        }
        // Normalize line endings so retries on different hosts converge on the
        // same immutable artifact hash and idempotency key.
        finalValue = finalValue
          .replaceAll("\r\n", "\n")
          .replaceAll("\r", "\n");
        const body = new TextEncoder().encode(finalValue);
        const artifactId = `${state.runtime_run_id}:sdk-final`;
        state.awaiting_artifact_id = artifactId;
        this.#enqueueTurnV1(state, {
          kind: "artifact",
          artifact: {
            artifact_id: artifactId,
            artifact_kind: "runtime-final-result",
            media_type:
              message.structured_output === undefined
                ? "text/plain; charset=utf-8"
                : "application/json",
            body,
            expected_sha256: sha256BytesV1(body),
            retention_until: new Date(
              Date.parse(state.request.policy.expires_at) +
                (this.#options.artifact_retention_ms ??
                  DEFAULT_ARTIFACT_RETENTION_MS_V1),
            ).toISOString(),
          },
        });
        return;
      }
      if (state.query !== query) return;
      this.#enqueueTurnV1(state, {
        kind: "failed",
        retryable: !state.business_tool_dispatched,
        reason_code: "sdk_stream_ended",
        error_summary: "Claude Agent SDK stream ended without a result",
      });
    } catch (error) {
      if (
        state.controller.signal.aborted ||
        state.closed ||
        state.query !== query
      ) {
        return;
      }
      this.#enqueueTurnV1(state, {
        kind: "failed",
        retryable: !state.business_tool_dispatched,
        reason_code: "sdk_transport_failed",
        error_summary: safeErrorSummaryV1(error),
      });
    }
  }

  async #closeSessionV1(
    state: AdapterSessionStateV1,
    waiterReasonCode = "sdk_session_closed",
  ): Promise<void> {
    if (state.closed) {
      if (state.cleanup_error !== undefined) throw state.cleanup_error;
      await state.cleanup_promise;
      return;
    }
    state.closed = true;
    state.source_signal.removeEventListener(
      "abort",
      state.abort_listener,
    );
    state.query?.close();
    for (const entry of state.bridge) {
      if (!entry.settled) {
        entry.settled = true;
        entry.deferred.resolve(
          mcpTextV1(
            {
              code: "runtime_interrupted",
              message: "The durable runtime run ended before tool completion",
            },
            true,
          ),
        );
      }
    }
    state.bridge.length = 0;
    const waiterTurn: RuntimeAdapterTurnV1 = {
      kind: "failed",
      retryable: false,
      reason_code: waiterReasonCode,
      error_summary:
        waiterReasonCode === "sdk_interrupted"
          ? "Claude Agent SDK session was interrupted"
          : "Claude Agent SDK session closed before a terminal result",
    };
    for (const waiter of state.turn_waiters.splice(0)) {
      waiter(waiterTurn);
    }
    if (!state.cleanup_started) {
      state.cleanup_started = true;
      state.cleanup_promise = (async () => {
        try {
          await this.#removeRunDirectory(state.run_cwd);
          this.#sessions.delete(state.session_id);
        } catch {
          const cleanupError = new RuntimeExecutionErrorV1(
            "runtime_adapter_failed",
            "Claude Agent SDK isolated directory cleanup failed",
            true,
          );
          state.cleanup_error = cleanupError;
          throw cleanupError;
        }
      })();
    }
    await state.cleanup_promise;
  }
}
