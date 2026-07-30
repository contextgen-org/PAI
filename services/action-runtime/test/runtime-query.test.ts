import { describe, expect, it, vi } from "vitest";

import {
  RuntimeQueryErrorV1,
  createRuntimeQueryApplicationV1,
  type RuntimeQueryPrincipalV1,
  type RuntimeQueryRepositoryV1,
} from "../src/runtime-query.v1.js";

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

const run = {
  runtime_run: {
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
    requested_catalog_version: "cat_01",
    effective_catalog_version: "cat_01",
    created_at: "2026-07-13T12:00:00.000Z",
    started_at: "2026-07-13T12:00:01.000Z",
    completed_at: "2026-07-13T12:00:02.000Z",
    terminal_reason: "completed",
  },
} as const;

const page = {
  runtime_run_id: "run_01",
  items: [
    {
      tool_invocation_id: "tool_01",
      tool_name: "memory.read",
      status: "completed",
      side_effect_status: "none",
      input_ref: "artifact:input_01",
      output_ref: "artifact:output_01",
      failure_class: null,
      started_at: "2026-07-13T12:00:01.000Z",
      completed_at: "2026-07-13T12:00:02.000Z",
    },
  ],
  next_cursor: null,
  has_more: false,
} as const;

function repository(
  overrides: Partial<RuntimeQueryRepositoryV1> = {},
): RuntimeQueryRepositoryV1 {
  return {
    async readAuthorizedRun() {
      return { outcome: "found", details: run };
    },
    async listAuthorizedToolInvocations() {
      return { outcome: "found", details: { run, page } };
    },
    async checkReadiness() {},
    ...overrides,
  };
}

describe("Action Runtime owner queries", () => {
  it("pins and deep-freezes the authorized principal before repository I/O", async () => {
    let entered!: () => void;
    const repositoryEntered = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let release!: () => void;
    const repositoryGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let observedPrincipal: RuntimeQueryPrincipalV1 | undefined;
    const application = createRuntimeQueryApplicationV1(
      repository({
        async readAuthorizedRun(request) {
          observedPrincipal = request.principal;
          entered();
          await repositoryGate;
          return { outcome: "found", details: run };
        },
      }),
    );
    const mutablePrincipal = structuredClone(principal);
    const responsePromise = application.getRun(
      mutablePrincipal,
      "run_01",
      "trace_01",
    );
    await repositoryEntered;
    mutablePrincipal.scope.bot_id = "bot_attacker";
    mutablePrincipal.delegated_principal.bot_id = "bot_attacker";
    mutablePrincipal.delegated_principal.roles.push("admin");
    release();

    const response = await responsePromise;
    expect(observedPrincipal).toMatchObject(principal);
    expect(Object.isFrozen(observedPrincipal)).toBe(true);
    expect(Object.isFrozen(observedPrincipal?.scope)).toBe(true);
    expect(
      Object.isFrozen(observedPrincipal?.delegated_principal.roles),
    ).toBe(true);
    expect(response.details.runtime_run.bot_id).toBe("bot_01");
    expect(Object.isFrozen(response.details)).toBe(true);
    expect(Object.isFrozen(response.details.runtime_run)).toBe(true);
  });

  it("authorizes the owner run before returning a redacted stable tool page", async () => {
    const list = vi.fn(async () => ({
      outcome: "found" as const,
      details: { run, page },
    }));
    const application = createRuntimeQueryApplicationV1(
      repository({ listAuthorizedToolInvocations: list }),
    );
    await expect(
      application.getRun(principal, "run_01", "trace_01"),
    ).resolves.toMatchObject({
      code: "runtime_run_found",
      details: run,
    });
    await expect(
      application.listToolInvocations(
        principal,
        "run_01",
        { limit: 50, status: "completed" },
        "trace_02",
      ),
    ).resolves.toMatchObject({
      code: "tool_invocations_found",
      details: page,
    });
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({
        runtime_run_id: "run_01",
        principal,
        cursor: null,
        limit: 50,
        status: "completed",
      }),
    );
  });

  it("fails closed on authorization, scope drift, or invalid cursor", async () => {
    const denied = createRuntimeQueryApplicationV1(
      repository({
        async readAuthorizedRun() {
          return { outcome: "denied" };
        },
      }),
    );
    await expect(
      denied.getRun(principal, "run_01", "trace_01"),
    ).rejects.toMatchObject<Partial<RuntimeQueryErrorV1>>({
      code: "authorization_denied",
    });

    const drifted = createRuntimeQueryApplicationV1(
      repository({
        async readAuthorizedRun() {
          return {
            outcome: "found",
            details: {
              runtime_run: { ...run.runtime_run, bot_id: "bot_other" },
            },
          };
        },
      }),
    );
    await expect(
      drifted.getRun(principal, "run_01", "trace_01"),
    ).rejects.toMatchObject<Partial<RuntimeQueryErrorV1>>({
      code: "owner_contract_drift",
    });

    await expect(
      createRuntimeQueryApplicationV1(repository()).listToolInvocations(
        principal,
        "run_01",
        { cursor: "\n" },
        "trace_01",
      ),
    ).rejects.toMatchObject<Partial<RuntimeQueryErrorV1>>({
      code: "invalid_cursor",
    });
  });
});
