import { describe, expect, it, vi } from "vitest";

import type { PostgresQueryPortV1 } from "@pai/persistence";

import { createPostgresRuntimeQueryRepositoryV1 } from "../src/db/runtime-query-repository.v1.js";
import type { RuntimeQueryPrincipalV1 } from "../src/runtime-query.v1.js";

const principal: RuntimeQueryPrincipalV1 = {
  workload_service: "observation_gateway",
  delegated_principal: {
    principal_type: "operator",
    principal_id: "operator_01",
    roles: ["operator"],
    source_issuer: "https://auth.example.test",
    source_subject: "operator_01",
    auth_time: 1_784_000_000,
    scope_kind: "bot",
    workspace_id: "ws_01",
    bot_id: "bot_01",
    owner_agent_id: "agent_01",
    deployment_environment: "prod",
    release_channel: "stable",
  },
  scope: {
    workspace_id: "ws_01",
    bot_id: "bot_01",
    owner_agent_id: "agent_01",
    deployment_environment: "prod",
    release_channel: "stable",
  },
};

const runRow = {
  runtime_run_id: "run_01",
  trigger_process_id: "tp_01",
  workspace_id: "ws_01",
  bot_id: "bot_01",
  owner_agent_id: "agent_01",
  deployment_environment: "prod",
  release_channel: "stable",
  status: "completed",
  start_attempt_no: 1,
  policy_snapshot_id: "policy_01",
  requested_catalog_version: "catalog_01",
  effective_catalog_version: "catalog_01",
  created_at: "2026-07-27T12:00:00.000000Z",
  started_at: "2026-07-27T12:00:01.000000Z",
  completed_at: "2026-07-27T12:00:04.000000Z",
  terminal_reason: "completed",
} as const;

const toolRows = [
  {
    tool_invocation_id: "tool_03",
    tool_name: "search",
    status: "completed",
    side_effect_status: "produced",
    input_ref: "artifact:input_03",
    output_ref: "artifact:output_03",
    failure_class: null,
    started_at: "2026-07-27T12:00:03.000000Z",
    completed_at: "2026-07-27T12:00:04.000000Z",
  },
  {
    tool_invocation_id: "tool_02",
    tool_name: "memory.read",
    status: "completed",
    side_effect_status: "none",
    input_ref: "artifact:input_02",
    output_ref: "artifact:output_02",
    failure_class: null,
    started_at: "2026-07-27T12:00:02.000000Z",
    completed_at: "2026-07-27T12:00:03.000000Z",
  },
  {
    tool_invocation_id: "tool_01",
    tool_name: "timer.read",
    status: "completed",
    side_effect_status: "none",
    input_ref: "artifact:input_01",
    output_ref: "artifact:output_01",
    failure_class: null,
    started_at: "2026-07-27T12:00:01.000000Z",
    completed_at: "2026-07-27T12:00:02.000000Z",
  },
] as const;

function postgresWithRows() {
  const query = vi.fn(async (sql: string) => ({
    rows: sql.includes("FROM action_runtime.tool_invocations")
      ? toolRows
      : [runRow],
  }));
  return {
    postgres: { query } as unknown as PostgresQueryPortV1,
    query,
  };
}

describe("Action Runtime PostgreSQL owner query repository", () => {
  it("authorizes the exact five-tuple before projecting a run", async () => {
    const { postgres } = postgresWithRows();
    const repository = createPostgresRuntimeQueryRepositoryV1(postgres);

    await expect(
      repository.readAuthorizedRun({
        runtime_run_id: "run_01",
        principal,
      }),
    ).resolves.toMatchObject({
      outcome: "found",
      details: { runtime_run: { runtime_run_id: "run_01" } },
    });
    await expect(
      repository.readAuthorizedRun({
        runtime_run_id: "run_01",
        principal: {
          ...principal,
          scope: { ...principal.scope, bot_id: "bot_other" },
        },
      }),
    ).resolves.toEqual({ outcome: "denied" });
  });

  it("uses a query-bound keyset cursor and fetches only one lookahead row", async () => {
    const { postgres, query } = postgresWithRows();
    const repository = createPostgresRuntimeQueryRepositoryV1(postgres);

    const first = await repository.listAuthorizedToolInvocations({
      runtime_run_id: "run_01",
      principal,
      cursor: null,
      limit: 2,
      status: "completed",
    });
    expect(first).toMatchObject({
      outcome: "found",
      details: {
        page: {
          has_more: true,
          items: [
            { tool_invocation_id: "tool_03" },
            { tool_invocation_id: "tool_02" },
          ],
        },
      },
    });
    if (first.outcome !== "found") throw new Error("expected owner page");
    expect(first.details.page.next_cursor).toEqual(expect.any(String));
    expect(query.mock.calls.at(-1)?.[1]).toEqual([
      "run_01",
      "completed",
      false,
      null,
      null,
      3,
    ]);

    await repository.listAuthorizedToolInvocations({
      runtime_run_id: "run_01",
      principal,
      cursor: first.details.page.next_cursor,
      limit: 2,
      status: "completed",
    });
    expect(query.mock.calls.at(-1)?.[1]).toEqual([
      "run_01",
      "completed",
      true,
      "2026-07-27T12:00:02.000000Z",
      "tool_02",
      3,
    ]);

    await expect(
      repository.listAuthorizedToolInvocations({
        runtime_run_id: "run_01",
        principal,
        cursor: first.details.page.next_cursor,
        limit: 2,
        status: "failed",
      }),
    ).rejects.toMatchObject({ code: "invalid_cursor" });
  });

  it("honors an already-aborted readiness lease without touching PostgreSQL", async () => {
    const { postgres, query } = postgresWithRows();
    const repository = createPostgresRuntimeQueryRepositoryV1(postgres);
    const controller = new AbortController();
    controller.abort(new Error("probe expired"));
    await expect(
      repository.checkReadiness(controller.signal),
    ).rejects.toThrow("probe expired");
    expect(query).not.toHaveBeenCalled();
  });
});
