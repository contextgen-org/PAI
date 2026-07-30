import { describe, expect, it, vi } from "vitest";

import { createRuntimeStartReservationValidationRepositoryV1 } from "../src/db/runtime-start-reservation-validation-repository.v1.js";

const validResponse = Object.freeze({
  schema_version: "runtime_start_reservation_validate_response.v1" as const,
  validation_result: "valid" as const,
  reservation_status: "dispatching" as const,
  validated_fence_generation: 7,
  validation_stage: "request_received" as const,
  duplicate_replayed: false as const,
  trace_id: "trace-1",
});

describe("Runtime Start reservation validation repository", () => {
  it("selects the exact process/attempt row and preserves its owner scope", async () => {
    const query = vi.fn();
    const transactionQuery = vi.fn(async (sql: string) =>
      sql.includes("pg_advisory_xact_lock")
        ? { rows: [{ acquired: null }] }
        : {
            rows: [
              {
                trigger_process_id: "process-1",
                reserved_runtime_run_id: "run-1",
                start_attempt_no: "3",
                start_fence_generation: "7",
                start_fence_token_hash: `sha256:${"a".repeat(64)}`,
                request_hash: `sha256:${"b".repeat(64)}`,
                status: "dispatching",
                current_runtime_run_id: null,
                process_phase: "execution",
                process_status: "waiting",
                is_current_fence: true,
                has_tombstone: false,
                workspace_id: "workspace-1",
                bot_id: "bot-1",
                owner_agent_id: "agent-1",
                deployment_environment: "dev",
                release_channel: "stable",
              },
            ],
          },
    );
    const withReadCommittedTransaction = vi.fn(async (work) =>
      work({ query: transactionQuery }),
    );
    const repository = createRuntimeStartReservationValidationRepositoryV1({
      query,
      withReadCommittedTransaction,
    } as never);
    let inspectedRead: unknown;
    await expect(
      repository.withLockedExactReservation(
        {
          trigger_process_id: "process-1",
          start_attempt_no: 3,
        },
        (read) => {
          inspectedRead = read;
          return validResponse;
        },
      ),
    ).resolves.toBe(validResponse);
    expect(inspectedRead).toMatchObject({
      outcome: "found",
      reservation: {
        runtime_run_id: "run-1",
        start_attempt_no: 3,
        start_fence_generation: 7,
        current_runtime_run_id: null,
        process_phase: "execution",
        process_status: "waiting",
        is_current_fence: true,
        has_tombstone: false,
        workspace_id: "workspace-1",
        bot_id: "bot-1",
      },
    });
    expect(withReadCommittedTransaction).toHaveBeenCalledTimes(1);
    expect(transactionQuery).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("pg_catalog.pg_advisory_xact_lock"),
      ["process-1"],
    );
    expect(transactionQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("pg_catalog.pg_advisory_xact_lock"),
      ["process-1", 3],
    );
    expect(transactionQuery).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("r.start_attempt_no = $2::bigint"),
      ["process-1", 3],
    );
    expect(transactionQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(
        "'trigger_processor:runtime_start_reservation:'::pg_catalog.text",
      ),
      ["process-1", 3],
    );
    expect(transactionQuery.mock.calls[0]?.[0]).toContain(
      "'trigger_processor:runtime_start_reservation_process:'::pg_catalog.text",
    );
    expect(transactionQuery.mock.calls[1]?.[0]).toContain(
      "$2::pg_catalog.text",
    );
    expect(transactionQuery.mock.calls[2]?.[0]).toContain(
      "NOT EXISTS",
    );
    expect(transactionQuery.mock.calls[2]?.[0]).toContain(
      "p.cancellation_status <> 'none'",
    );
    expect(transactionQuery.mock.calls[2]?.[0]).not.toContain(
      "p.cancellation_status IS NOT NULL",
    );
    expect(transactionQuery.mock.calls[2]?.[0]).not.toMatch(
      /\bFOR\s+(?:UPDATE|NO\s+KEY\s+UPDATE|SHARE|KEY\s+SHARE)\b/iu,
    );
    expect(query).not.toHaveBeenCalled();
  });

  it("rejects bigint values that cannot round-trip through the V1 JSON wire", async () => {
    const repository = createRuntimeStartReservationValidationRepositoryV1({
      async query() {
        return { rows: [] };
      },
      async withReadCommittedTransaction(work) {
        return work({
          async query(sql: string) {
            if (sql.includes("pg_advisory_xact_lock")) {
              return { rows: [{ acquired: null }] };
            }
            return {
              rows: [
                {
                  trigger_process_id: "process-1",
                  reserved_runtime_run_id: "run-1",
                  start_attempt_no: "9007199254740992",
                  start_fence_generation: "7",
                  start_fence_token_hash: `sha256:${"a".repeat(64)}`,
                  request_hash: `sha256:${"b".repeat(64)}`,
                  status: "dispatching",
                  current_runtime_run_id: null,
                  process_phase: "execution",
                  process_status: "waiting",
                  is_current_fence: true,
                  has_tombstone: false,
                  workspace_id: "workspace-1",
                  bot_id: "bot-1",
                  owner_agent_id: "agent-1",
                  deployment_environment: "dev",
                  release_channel: "stable",
                },
              ],
            };
          },
        });
      },
    } as never);
    await expect(
      repository.withLockedExactReservation(
        {
          trigger_process_id: "process-1",
          start_attempt_no: 1,
        },
        () => validResponse,
      ),
    ).rejects.toThrow(/wire integer range/u);
  });

  it("captures the transaction method and snapshots selectors before a queued lock wait", async () => {
    let releaseTransaction!: () => void;
    const transactionMayRun = new Promise<void>((resolve) => {
      releaseTransaction = resolve;
    });
    let observedReceiver: unknown;
    const transactionQuery = vi.fn(async (sql: string) =>
      sql.includes("pg_advisory_xact_lock")
        ? { rows: [{ acquired: null }] }
        : {
            rows: [
              {
                trigger_process_id: "process-1",
                reserved_runtime_run_id: "run-1",
                start_attempt_no: "3",
                start_fence_generation: "7",
                start_fence_token_hash: `sha256:${"a".repeat(64)}`,
                request_hash: `sha256:${"b".repeat(64)}`,
                status: "dispatching",
                current_runtime_run_id: null,
                process_phase: "execution",
                process_status: "waiting",
                is_current_fence: true,
                has_tombstone: false,
                workspace_id: "workspace-1",
                bot_id: "bot-1",
                owner_agent_id: "agent-1",
                deployment_environment: "dev",
                release_channel: "stable",
              },
            ],
          },
    );
    const originalTransactionMethod = vi.fn(async function (
      this: unknown,
      work: (transaction: {
        query: typeof transactionQuery;
      }) => Promise<unknown>,
    ) {
      observedReceiver = this;
      await transactionMayRun;
      return work({ query: transactionQuery });
    });
    const replacementTransactionMethod = vi.fn(async () => {
      throw new Error("replacement method must not run");
    });
    const postgres = {
      async query() {
        return { rows: [] };
      },
      withReadCommittedTransaction: originalTransactionMethod,
    };
    const repository =
      createRuntimeStartReservationValidationRepositoryV1(postgres as never);
    postgres.withReadCommittedTransaction = replacementTransactionMethod;
    const mutableRequest = {
      trigger_process_id: "process-1",
      start_attempt_no: 3,
    };
    let inspectedRead: unknown;
    const pending = repository.withLockedExactReservation(
      mutableRequest,
      (read) => {
        inspectedRead = read;
        return validResponse;
      },
    );
    mutableRequest.trigger_process_id = "process-other";
    mutableRequest.start_attempt_no = 99;
    releaseTransaction();

    await expect(pending).resolves.toBe(validResponse);
    expect(inspectedRead).toMatchObject({
      outcome: "found",
      reservation: {
        trigger_process_id: "process-1",
        start_attempt_no: 3,
      },
    });
    expect(observedReceiver).toBe(postgres);
    expect(originalTransactionMethod).toHaveBeenCalledTimes(1);
    expect(replacementTransactionMethod).not.toHaveBeenCalled();
    expect(transactionQuery).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("pg_advisory_xact_lock"),
      ["process-1"],
    );
    expect(transactionQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("pg_advisory_xact_lock"),
      ["process-1", 3],
    );
    expect(transactionQuery).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("r.start_attempt_no = $2::bigint"),
      ["process-1", 3],
    );
  });

  it("rejects Proxy ports and selectors without invoking their traps", async () => {
    const portTrap = vi.fn(() => {
      throw new Error("port trap must not run");
    });
    const proxyPort = new Proxy(
      {
        async withReadCommittedTransaction() {
          return undefined;
        },
      },
      {
        getOwnPropertyDescriptor: portTrap,
        getPrototypeOf: portTrap,
      },
    );
    expect(() =>
      createRuntimeStartReservationValidationRepositoryV1(
        proxyPort as never,
      ),
    ).toThrow(/non-Proxy/u);
    expect(portTrap).not.toHaveBeenCalled();

    const repository =
      createRuntimeStartReservationValidationRepositoryV1({
        async withReadCommittedTransaction() {
          throw new Error("transaction must not start");
        },
      } as never);
    const selectorTrap = vi.fn(() => {
      throw new Error("selector trap must not run");
    });
    const selector = new Proxy(
      {
        trigger_process_id: "process-1",
        start_attempt_no: 1,
      },
      {
        getOwnPropertyDescriptor: selectorTrap,
        getPrototypeOf: selectorTrap,
      },
    );
    await expect(
      repository.withLockedExactReservation(
        selector,
        () => validResponse,
      ),
    ).rejects.toThrow(/invalid/u);
    expect(selectorTrap).not.toHaveBeenCalled();
  });

  it("invokes the inspector before the validator transaction releases its advisory lock", async () => {
    let transactionActive = false;
    let inspectedWhileActive = false;
    const repository =
      createRuntimeStartReservationValidationRepositoryV1({
        async withReadCommittedTransaction(work) {
          transactionActive = true;
          try {
            return await work({
              async query(sql: string) {
                if (sql.includes("pg_advisory_xact_lock")) {
                  return { rows: [{ acquired: null }] };
                }
                return {
                  rows: [
                    {
                      trigger_process_id: "process-1",
                      reserved_runtime_run_id: "run-1",
                      start_attempt_no: "3",
                      start_fence_generation: "7",
                      start_fence_token_hash: `sha256:${"a".repeat(64)}`,
                      request_hash: `sha256:${"b".repeat(64)}`,
                      status: "dispatching",
                      current_runtime_run_id: null,
                      process_phase: "execution",
                      process_status: "waiting",
                      is_current_fence: true,
                      has_tombstone: false,
                      workspace_id: "workspace-1",
                      bot_id: "bot-1",
                      owner_agent_id: "agent-1",
                      deployment_environment: "dev",
                      release_channel: "stable",
                    },
                  ],
                };
              },
            });
          } finally {
            transactionActive = false;
          }
        },
      } as never);

    await expect(
      repository.withLockedExactReservation(
        {
          trigger_process_id: "process-1",
          start_attempt_no: 3,
        },
        () => {
          inspectedWhileActive = transactionActive;
          return validResponse;
        },
      ),
    ).resolves.toBe(validResponse);
    expect(inspectedWhileActive).toBe(true);
    expect(transactionActive).toBe(false);
  });

  it("takes the shared process lock before the exact process/attempt lock", async () => {
    const lockArguments: unknown[][] = [];
    const repository =
      createRuntimeStartReservationValidationRepositoryV1({
        async withReadCommittedTransaction(work) {
          return work({
            async query(sql: string, values?: readonly unknown[]) {
              if (sql.includes("pg_advisory_xact_lock")) {
                lockArguments.push([...(values ?? [])]);
                return { rows: [{ acquired: null }] };
              }
              return { rows: [] };
            },
          });
        },
      } as never);

    for (const [trigger_process_id, start_attempt_no] of [
      ["process-1", 1],
      ["process-1", 1],
      ["process-1", 2],
      ["process-2", 1],
    ] as const) {
      await repository.withLockedExactReservation(
        {
          trigger_process_id,
          start_attempt_no,
        },
        () => validResponse,
      );
    }
    expect(lockArguments).toEqual([
      ["process-1"],
      ["process-1", 1],
      ["process-1"],
      ["process-1", 1],
      ["process-1"],
      ["process-1", 2],
      ["process-2"],
      ["process-2", 1],
    ]);
  });

  it("rejects an accessor-backed transaction capability without invoking it", () => {
    let getterCalls = 0;
    const postgres = {
      async query() {
        return { rows: [] };
      },
    };
    Object.defineProperty(postgres, "withReadCommittedTransaction", {
      enumerable: true,
      configurable: true,
      get() {
        getterCalls += 1;
        return async () => undefined;
      },
    });
    expect(() =>
      createRuntimeStartReservationValidationRepositoryV1(postgres as never),
    ).toThrow(/data method/u);
    expect(getterCalls).toBe(0);
  });
});
