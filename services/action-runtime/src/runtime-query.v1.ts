import {
  DelegatedPrincipalContextV1Schema,
  DeploymentEnvironmentV1Schema,
  ReleaseChannelV1Schema,
  RuntimeRunQueryDetailsV1Schema,
  ToolInvocationListDetailsV1Schema,
  assertRuntimeRunQueryDetailsSemanticBindingsV1,
  assertToolInvocationListDetailsSemanticBindingsV1,
  type DelegatedPrincipalContextV1,
  type RuntimeRunQueryDetailsV1,
  type ToolInvocationListDetailsV1,
} from "@pai/contracts";
import {
  immutableBoundedJsonSnapshotV1,
} from "@pai/eventing";
import { Value } from "@sinclair/typebox/value";

export interface RuntimeQueryBotScopeV1 {
  readonly workspace_id: string;
  readonly bot_id: string;
  readonly owner_agent_id: string;
  readonly deployment_environment: "local" | "dev" | "staging" | "prod";
  readonly release_channel: "stable" | "canary";
}

export interface RuntimeQueryPrincipalV1 {
  readonly workload_service: "observation_gateway";
  readonly delegated_principal: DelegatedPrincipalContextV1;
  readonly scope: RuntimeQueryBotScopeV1;
}

type RuntimeQueryOwnerOutcomeV1<TDetails> =
  | Readonly<{ outcome: "denied" }>
  | Readonly<{ outcome: "not_found" }>
  | Readonly<{ outcome: "found"; details: TDetails }>;

export interface RuntimeQueryRepositoryV1 {
  readAuthorizedRun(request: Readonly<{
    runtime_run_id: string;
    principal: RuntimeQueryPrincipalV1;
  }>): Promise<RuntimeQueryOwnerOutcomeV1<RuntimeRunQueryDetailsV1>>;
  listAuthorizedToolInvocations(request: Readonly<{
    runtime_run_id: string;
    principal: RuntimeQueryPrincipalV1;
    cursor: string | null;
    limit: number;
    status:
      | "requested"
      | "running"
      | "completed"
      | "failed"
      | "cancelled"
      | null;
  }>): Promise<
    RuntimeQueryOwnerOutcomeV1<
      Readonly<{
        run: RuntimeRunQueryDetailsV1;
        page: ToolInvocationListDetailsV1;
      }>
    >
  >;
  checkReadiness(signal?: AbortSignal): Promise<void>;
}

export class RuntimeQueryErrorV1 extends Error {
  public constructor(
    public readonly code:
      | "runtime_run_not_found"
      | "authorization_denied"
      | "invalid_cursor"
      | "schema_validation_failed"
      | "owner_contract_drift",
    public readonly retryable = false,
  ) {
    super(code);
    this.name = "RuntimeQueryErrorV1";
  }
}

export interface RuntimeQueryApplicationV1 {
  getRun(
    principal: RuntimeQueryPrincipalV1,
    runtimeRunId: string,
    traceId: string,
  ): Promise<
    Readonly<{
      code: "runtime_run_found";
      message: "runtime run found";
      retryable: false;
      trace_id: string;
      details: RuntimeRunQueryDetailsV1;
    }>
  >;
  listToolInvocations(
    principal: RuntimeQueryPrincipalV1,
    runtimeRunId: string,
    query: Readonly<{
      cursor?: string;
      limit?: number;
      status?:
        | "requested"
        | "running"
        | "completed"
        | "failed"
        | "cancelled";
    }>,
    traceId: string,
  ): Promise<
    Readonly<{
      code: "tool_invocations_found";
      message: "tool invocations found";
      retryable: false;
      trace_id: string;
      details: ToolInvocationListDetailsV1;
    }>
  >;
  checkReadiness(signal?: AbortSignal): Promise<void>;
}

function assertIdentifier(value: string, label: string): void {
  if (value.length < 1 || value.length > 512 || /[\r\n]/u.test(value)) {
    throw new RuntimeQueryErrorV1(
      label === "cursor" ? "invalid_cursor" : "schema_validation_failed",
    );
  }
}

export function snapshotRuntimeQueryPrincipalV1(
  value: unknown,
): RuntimeQueryPrincipalV1 {
  let principal: unknown;
  try {
    principal = immutableBoundedJsonSnapshotV1(value);
  } catch {
    throw new RuntimeQueryErrorV1("authorization_denied");
  }
  if (
    typeof principal !== "object" ||
    principal === null ||
    Array.isArray(principal)
  ) {
    throw new RuntimeQueryErrorV1("authorization_denied");
  }
  const candidate = principal as Readonly<Record<string, unknown>>;
  const scope = candidate.scope;
  const delegated = candidate.delegated_principal;
  if (
    Object.keys(candidate).sort().join(",") !==
      "delegated_principal,scope,workload_service" ||
    candidate.workload_service !== "observation_gateway" ||
    typeof scope !== "object" ||
    scope === null ||
    Array.isArray(scope) ||
    Object.keys(scope).sort().join(",") !==
      "bot_id,deployment_environment,owner_agent_id,release_channel,workspace_id" ||
    !Value.Check(
      DelegatedPrincipalContextV1Schema,
      [DeploymentEnvironmentV1Schema, ReleaseChannelV1Schema],
      delegated,
    )
  ) {
    throw new RuntimeQueryErrorV1("authorization_denied");
  }
  const botScope = scope as RuntimeQueryBotScopeV1;
  const delegatedPrincipal = delegated as DelegatedPrincipalContextV1;
  if (
    delegatedPrincipal.scope_kind !== "bot" ||
    delegatedPrincipal.workspace_id !== botScope.workspace_id ||
    delegatedPrincipal.bot_id !== botScope.bot_id ||
    delegatedPrincipal.owner_agent_id !== botScope.owner_agent_id ||
    delegatedPrincipal.deployment_environment !==
      botScope.deployment_environment ||
    delegatedPrincipal.release_channel !== botScope.release_channel
  ) {
    throw new RuntimeQueryErrorV1("authorization_denied");
  }
  return principal as RuntimeQueryPrincipalV1;
}

function assertRunProjection(
  value: unknown,
  principal: RuntimeQueryPrincipalV1,
  runtimeRunId: string,
): asserts value is RuntimeRunQueryDetailsV1 {
  if (!Value.Check(RuntimeRunQueryDetailsV1Schema, value)) {
    throw new RuntimeQueryErrorV1("owner_contract_drift");
  }
  try {
    assertRuntimeRunQueryDetailsSemanticBindingsV1(value);
  } catch {
    throw new RuntimeQueryErrorV1("owner_contract_drift");
  }
  const run = value.runtime_run;
  if (
    run.runtime_run_id !== runtimeRunId ||
    run.workspace_id !== principal.scope.workspace_id ||
    run.bot_id !== principal.scope.bot_id ||
    run.owner_agent_id !== principal.scope.owner_agent_id ||
    run.deployment_environment !== principal.scope.deployment_environment ||
    run.release_channel !== principal.scope.release_channel
  ) {
    throw new RuntimeQueryErrorV1("owner_contract_drift");
  }
}

function resolveOutcome<T>(
  outcomeValue: RuntimeQueryOwnerOutcomeV1<T>,
): T {
  let outcome: RuntimeQueryOwnerOutcomeV1<T>;
  try {
    outcome = immutableBoundedJsonSnapshotV1(
      outcomeValue,
    ) as RuntimeQueryOwnerOutcomeV1<T>;
  } catch {
    throw new RuntimeQueryErrorV1("owner_contract_drift");
  }
  if (typeof outcome !== "object" || outcome === null) {
    throw new RuntimeQueryErrorV1("owner_contract_drift");
  }
  if (outcome.outcome === "denied") {
    throw new RuntimeQueryErrorV1("authorization_denied");
  }
  if (outcome.outcome === "not_found") {
    throw new RuntimeQueryErrorV1("runtime_run_not_found");
  }
  if (outcome.outcome !== "found" || !Object.hasOwn(outcome, "details")) {
    throw new RuntimeQueryErrorV1("owner_contract_drift");
  }
  return outcome.details;
}

export function createRuntimeQueryApplicationV1(
  repository: RuntimeQueryRepositoryV1,
): RuntimeQueryApplicationV1 {
  const application: RuntimeQueryApplicationV1 = {
    async getRun(
      principalValue: RuntimeQueryPrincipalV1,
      runtimeRunId: string,
      traceId: string,
    ) {
      const principal =
        snapshotRuntimeQueryPrincipalV1(principalValue);
      assertIdentifier(runtimeRunId, "runtime_run_id");
      assertIdentifier(traceId, "trace_id");
      const details = resolveOutcome(
        await repository.readAuthorizedRun(Object.freeze({
          runtime_run_id: runtimeRunId,
          principal,
        })),
      );
      assertRunProjection(details, principal, runtimeRunId);
      return Object.freeze({
        code: "runtime_run_found" as const,
        message: "runtime run found" as const,
        retryable: false as const,
        trace_id: traceId,
        details,
      });
    },

    async listToolInvocations(
      principalValue: RuntimeQueryPrincipalV1,
      runtimeRunId: string,
      queryValue: Readonly<{
        cursor?: string;
        limit?: number;
        status?:
          | "requested"
          | "running"
          | "completed"
          | "failed"
          | "cancelled";
      }>,
      traceId: string,
    ) {
      const principal =
        snapshotRuntimeQueryPrincipalV1(principalValue);
      let query: Readonly<{
        cursor?: string;
        limit?: number;
        status?:
          | "requested"
          | "running"
          | "completed"
          | "failed"
          | "cancelled";
      }>;
      try {
        query = immutableBoundedJsonSnapshotV1(
          queryValue,
        ) as typeof query;
      } catch {
        throw new RuntimeQueryErrorV1("schema_validation_failed");
      }
      if (
        Object.keys(query).some(
          (key) => !["cursor", "limit", "status"].includes(key),
        )
      ) {
        throw new RuntimeQueryErrorV1("schema_validation_failed");
      }
      assertIdentifier(runtimeRunId, "runtime_run_id");
      assertIdentifier(traceId, "trace_id");
      const cursor = query.cursor ?? null;
      if (cursor !== null) assertIdentifier(cursor, "cursor");
      const limit = query.limit ?? 50;
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200) {
        throw new RuntimeQueryErrorV1("schema_validation_failed");
      }
      const allowedStatuses = new Set([
        "requested",
        "running",
        "completed",
        "failed",
        "cancelled",
      ]);
      if (
        query.status !== undefined &&
        !allowedStatuses.has(query.status)
      ) {
        throw new RuntimeQueryErrorV1("schema_validation_failed");
      }
      const projection = resolveOutcome(
        await repository.listAuthorizedToolInvocations(Object.freeze({
          runtime_run_id: runtimeRunId,
          principal,
          cursor,
          limit,
          status: query.status ?? null,
        })),
      );
      assertRunProjection(projection.run, principal, runtimeRunId);
      if (
        !Value.Check(ToolInvocationListDetailsV1Schema, projection.page) ||
        projection.page.runtime_run_id !== runtimeRunId
      ) {
        throw new RuntimeQueryErrorV1("owner_contract_drift");
      }
      try {
        assertToolInvocationListDetailsSemanticBindingsV1(projection.page);
      } catch {
        throw new RuntimeQueryErrorV1("owner_contract_drift");
      }
      return Object.freeze({
        code: "tool_invocations_found" as const,
        message: "tool invocations found" as const,
        retryable: false as const,
        trace_id: traceId,
        details: projection.page,
      });
    },

    async checkReadiness(signal?: AbortSignal) {
      await repository.checkReadiness(signal);
    },
  };
  return Object.freeze(application);
}
