import { describe, expect, it, vi } from "vitest";

import {
  createPostgresObjectMetadataReconciliationAdapterV1,
  createPostgresObjectMetadataRepositoryV1,
  createPostgresObjectMetadataRuntimeV1,
  createSupabaseStorageAdapterV1,
  type PostgresObjectMetadataRepositoryV1,
} from "../src/composition.js";
import type {
  FinalizeObjectOperationRequestV1,
  ObjectOperationDurableIdentityV1,
  ObjectOperationResultV1,
  ObjectReconcileClaimV1,
  ReserveObjectOperationRequestV1,
  SettleObjectReconcileRequestV1,
  StartObjectOperationAttemptRequestV1,
} from "../src/db/metadata-contract.v1.js";

const hashA = `sha256:${"a".repeat(64)}` as const;
const hashB = `sha256:${"b".repeat(64)}` as const;
const hashC = `sha256:${"c".repeat(64)}` as const;
const opaqueRef = `objv1_${"d".repeat(32)}` as const;
const now = "2026-07-20T00:00:00.000Z";

const durableIdentity = Object.freeze({
  contract_version: "object_store_metadata.v1",
  operation: "put_immutable",
  owner_service: "trigger_processor",
  owner_object_id: "trigger-process-1",
  owner_state_version: 7,
  object_class: "trigger_process_snapshot",
  scope: Object.freeze({ scope_kind: "global" as const }),
  idempotency_key: "put-1",
  request_hash: hashA,
  object_fingerprint: hashB,
  expected_digest: hashC,
  expected_size_bytes: 11,
  media_type: "application/json",
  retention_until: "2026-07-21T00:00:00.000Z",
  deletion_decision_version: null,
  gc_not_before: "2026-07-22T00:00:00.000Z",
} as const satisfies ObjectOperationDurableIdentityV1);

const reservePutRequest = Object.freeze({
  contract_version: "object_store_metadata.v1",
  operation: "put_immutable",
  owner_service: durableIdentity.owner_service,
  owner_object_id: durableIdentity.owner_object_id,
  owner_state_version: durableIdentity.owner_state_version,
  object_class: durableIdentity.object_class,
  scope: durableIdentity.scope,
  idempotency_key: durableIdentity.idempotency_key,
  request_hash: durableIdentity.request_hash,
  object_fingerprint: durableIdentity.object_fingerprint,
  expected_digest: durableIdentity.expected_digest,
  expected_size_bytes: durableIdentity.expected_size_bytes,
  media_type: durableIdentity.media_type,
  retention_until: durableIdentity.retention_until,
  foreground_lease_token: "foreground-token-1",
  foreground_lease_seconds: 300,
  gc_not_before: durableIdentity.gc_not_before,
} as const satisfies ReserveObjectOperationRequestV1);

const putOutcome = Object.freeze({
  operation: "put_immutable",
  proof_kind: "put_receipt",
  opaque_ref: opaqueRef,
  provider_receipt_hash: hashA,
  physical_object_fingerprint: hashB,
  result_digest: hashC,
  result_size_bytes: 11,
  result_media_type: "application/json",
  proof_hash: hashB,
} as const);

function reservedResult(
  identity: ObjectOperationDurableIdentityV1 = durableIdentity,
) {
  return {
    ...identity,
    kind: "reserved",
    reservation_id: "reservation-1",
    status: "reserved",
    generation: 1,
    foreground_lease_expires_at: "2026-07-20T00:05:00.000Z",
    opaque_ref: null,
  } as const;
}

function terminalProof(
  attemptId = "attempt-1",
): NonNullable<ObjectOperationResultV1["terminal_proof"]> {
  return {
    id: "proof-1",
    reservation_id: "reservation-1",
    attempt_id: attemptId,
    operation: "put_immutable",
    proof_kind: "put_receipt",
    opaque_ref: opaqueRef,
    provider_receipt_hash: hashA,
    physical_object_fingerprint: hashB,
    result_digest: hashC,
    result_size_bytes: 11,
    result_media_type: "application/json",
    provider_terminal_disposition: null,
    tombstone: null,
    proof_hash: hashB,
    completed_at: "2026-07-20T00:01:00.000Z",
    created_at: "2026-07-20T00:01:00.000Z",
  };
}

function operationResult(
  overrides: Partial<ObjectOperationResultV1> = {},
): ObjectOperationResultV1 {
  return {
    ...durableIdentity,
    reservation_id: "reservation-1",
    status: "reserved",
    generation: 1,
    opaque_ref: null,
    result_digest: null,
    result_size_bytes: null,
    terminal_proof: null,
    commit_unknown_evidence: null,
    reconcile_settlement: null,
    ...overrides,
  };
}

function succeededResult(
  overrides: Partial<ObjectOperationResultV1> = {},
): ObjectOperationResultV1 {
  return operationResult({
    status: "succeeded",
    generation: 4,
    opaque_ref: opaqueRef,
    result_digest: hashC,
    result_size_bytes: 11,
    terminal_proof: terminalProof(),
    ...overrides,
  });
}

function startRequest(
  overrides: Partial<StartObjectOperationAttemptRequestV1> = {},
): StartObjectOperationAttemptRequestV1 {
  return {
    ...durableIdentity,
    reservation_id: "reservation-1",
    expected_generation: 1,
    actor: {
      actor_kind: "foreground",
      attempt_token: "attempt-token-1",
    },
    ...overrides,
  };
}

function finalizeRequest(
  overrides: Partial<FinalizeObjectOperationRequestV1> = {},
): FinalizeObjectOperationRequestV1 {
  return {
    ...durableIdentity,
    reservation_id: "reservation-1",
    attempt_id: "attempt-1",
    expected_generation: 3,
    actor: {
      actor_kind: "foreground",
      attempt_token: "attempt-token-1",
    },
    outcome: putOutcome,
    ...overrides,
  };
}

function claim(): ObjectReconcileClaimV1 {
  return {
    ...durableIdentity,
    reservation_id: "reservation-1",
    claim_token: "claim-token-1",
    claim_generation: 2,
    claim_lease_expires_at: "2026-07-20T00:00:30.000Z",
    database_now: now,
    reservation_generation: 4,
  };
}

function settleRequest(
  overrides: Partial<SettleObjectReconcileRequestV1> = {},
): SettleObjectReconcileRequestV1 {
  return {
    ...durableIdentity,
    reservation_id: "reservation-1",
    claim_token: "claim-token-1",
    claim_generation: 2,
    expected_generation: 4,
    settlement: {
      kind: "retry_wait",
      retry_delay_seconds: 30,
      error: {
        schema_version: "object_store_failure.v1",
        error_code: "provider_unavailable",
        retryable: true,
        failure_hash: hashA,
      },
    },
    ...overrides,
  };
}

function repositoryWithQueries(
  ownerQuery: (sql: string, values: unknown[]) => Promise<unknown>,
  reconcilerQuery: (sql: string, values: unknown[]) => Promise<unknown> =
    ownerQuery,
): PostgresObjectMetadataRepositoryV1 {
  return createPostgresObjectMetadataRepositoryV1({
    pool: { query: ownerQuery } as never,
    reconcilerPool: { query: reconcilerQuery } as never,
    ownerService: "trigger_processor",
    clock: () => new Date(now),
  });
}

describe("createPostgresObjectMetadataRepositoryV1", () => {
  it("binds owner and separately authenticated reconciler roles", async () => {
    const ownerQuery = vi.fn(async () => ({
      rows: [{ result: reservedResult() }],
    }));
    const reconcilerQuery = vi.fn(async () => ({ rows: [] }));
    const repository = repositoryWithQueries(ownerQuery, reconcilerQuery);

    await expect(
      repository.reserveObjectOperation(reservePutRequest),
    ).resolves.toEqual(reservedResult());
    expect(repository).toMatchObject({
      kind: "postgres.v1",
      deploymentReadiness: "unverified_pai_infra",
      ownerService: "trigger_processor",
      expectedRole: "pai_trigger_processor_app",
      expectedReconcilerRole: "pai_object_store_reconciler_app",
      reconcilerReady: true,
    });
    expect(ownerQuery).toHaveBeenCalledTimes(1);
    expect(reconcilerQuery).not.toHaveBeenCalled();
    const [sql, values] = ownerQuery.mock.calls[0]!;
    expect(sql).toMatch(
      /^SELECT object_store\.reserve_object_operation_v1\(\$1, \$2,/u,
    );
    expect(sql).not.toMatch(/\b(?:insert|update|delete|from)\b/iu);
    expect(values).toContain(String(durableIdentity.owner_state_version));
    expect(values).toContain(durableIdentity.object_fingerprint);
  });

  it("rejects cross-owner requests and every durable-identity response drift", async () => {
    const query = vi.fn(async () => ({
      rows: [{
        result: operationResult({ owner_state_version: 8 }),
      }],
    }));
    const repository = repositoryWithQueries(query);

    await expect(
      repository.reserveObjectOperation({
        ...reservePutRequest,
        owner_service: "action_runtime",
      }),
    ).rejects.toThrow(/owner_service does not match/);
    expect(query).not.toHaveBeenCalled();

    await expect(
      repository.getObjectOperationResult({
        ...durableIdentity,
        caller_kind: "foreground",
      }),
    ).rejects.toThrow(/foreground identity/);
  });

  it("compares PostgreSQL timestamptz identities by instant, not text form", async () => {
    const offsetRequest = {
      ...reservePutRequest,
      retention_until: "2026-07-21T08:00:00+08:00",
      gc_not_before: "2026-07-22T08:00:00+08:00",
    } as const satisfies ReserveObjectOperationRequestV1;
    const normalizedIdentity = {
      ...durableIdentity,
      retention_until: "2026-07-21T00:00:00.000Z",
      gc_not_before: "2026-07-22T00:00:00.000Z",
    } as const satisfies ObjectOperationDurableIdentityV1;
    const query = vi.fn(async () => ({
      rows: [{ result: reservedResult(normalizedIdentity) }],
    }));
    const repository = repositoryWithQueries(query);

    await expect(
      repository.reserveObjectOperation(offsetRequest),
    ).resolves.toEqual(reservedResult(normalizedIdentity));
    expect(query.mock.calls[0]![1]).toContain(
      "2026-07-21T08:00:00+08:00",
    );
  });

  it("snapshots requests and writer rows without invoking accessors or proxies", async () => {
    const query = vi.fn(async () => ({
      rows: [{ result: reservedResult() }],
    }));
    const repository = repositoryWithQueries(query);
    let getterCalls = 0;
    const accessorRequest = { ...reservePutRequest } as Record<string, unknown>;
    Object.defineProperty(accessorRequest, "owner_object_id", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return "attacker";
      },
    });
    await expect(
      repository.reserveObjectOperation(accessorRequest as never),
    ).rejects.toThrow(/own enumerable data fields/);
    await expect(
      repository.reserveObjectOperation(
        new Proxy({ ...reservePutRequest }, {}) as never,
      ),
    ).rejects.toThrow(/non-proxied JSON/);
    expect(getterCalls).toBe(0);
    expect(query).not.toHaveBeenCalled();
  });

  it("enforces deletion decision positive-safe-integer boundaries", async () => {
    const deletionIdentity = {
      ...durableIdentity,
      operation: "delete_if_eligible" as const,
      deletion_decision_version: Number.MAX_SAFE_INTEGER,
    };
    const query = vi.fn(async () => ({
      rows: [{ result: reservedResult(deletionIdentity) }],
    }));
    const repository = repositoryWithQueries(query);
    const deletion = {
      ...reservePutRequest,
      operation: "delete_if_eligible" as const,
      deletion_decision_version: Number.MAX_SAFE_INTEGER,
    };
    await expect(
      repository.reserveObjectOperation(deletion),
    ).resolves.toEqual(reservedResult(deletionIdentity));
    expect(query.mock.calls[0]![1]).toContain(
      String(Number.MAX_SAFE_INTEGER),
    );
    await expect(
      repository.reserveObjectOperation({
        ...deletion,
        deletion_decision_version: 0,
      }),
    ).rejects.toThrow(/request drift/);
    await expect(
      repository.reserveObjectOperation({
        ...deletion,
        deletion_decision_version: Number.MAX_SAFE_INTEGER + 1,
      }),
    ).rejects.toThrow(/request drift/);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("executes and validates all eight fixed writer ABIs", async () => {
    const ownerCalls: string[] = [];
    const reconcilerCalls: string[] = [];
    const markRequest = {
      ...durableIdentity,
      reservation_id: "reservation-1",
      attempt_id: "attempt-1",
      expected_generation: 2,
      actor: {
        actor_kind: "foreground" as const,
        attempt_token: "attempt-token-1",
      },
      provider_request_id: "provider-request-1",
      provider_receipt_hash: hashA,
      physical_object_fingerprint: hashB,
    };
    const markEvidence = {
      attempt_id: "attempt-1",
      expected_generation: 2,
      provider_request_id: "provider-request-1",
      provider_receipt_hash: hashA,
      physical_object_fingerprint: hashB,
      error: null,
    };
    const retry = settleRequest();
    const ownerQuery = vi.fn(async (sql: string) => {
      ownerCalls.push(sql);
      if (sql.includes("reserve_object_operation_v1")) {
        return { rows: [{ result: reservedResult() }] };
      }
      if (sql.includes("start_object_operation_attempt_v1")) {
        return {
          rows: [{
            result: {
              ...durableIdentity,
              reservation_id: "reservation-1",
              operation: "put_immutable",
              attempt_id: "attempt-1",
              attempt_no: 1,
              generation: 2,
            },
          }],
        };
      }
      if (sql.includes("mark_object_operation_commit_unknown_v1")) {
        return {
          rows: [{
            result: {
              result: operationResult({
                status: "reconcile_required",
                generation: 3,
                commit_unknown_evidence: markEvidence,
              }),
              ...markEvidence,
            },
          }],
        };
      }
      if (sql.includes("finalize_object_operation_v1")) {
        return {
          rows: [{
            result: {
              result: succeededResult(),
              attempt_id: "attempt-1",
              expected_generation: 3,
              outcome: putOutcome,
            },
          }],
        };
      }
      if (sql.includes("get_object_operation_result_v1")) {
        return { rows: [{ result: succeededResult() }] };
      }
      throw new Error("unexpected owner writer");
    });
    const reconcilerQuery = vi.fn(async (sql: string) => {
      reconcilerCalls.push(sql);
      if (sql.includes("claim_expired_object_reconcile_v1")) {
        return { rows: [{ result: claim() }] };
      }
      if (sql.includes("renew_object_reconcile_claim_v1")) {
        return { rows: [{ result: claim() }] };
      }
      if (sql.includes("settle_object_reconcile_v1")) {
        return {
          rows: [{
            result: {
              result: operationResult({
                status: "reconcile_required",
                generation: 5,
                reconcile_settlement: retry.settlement,
              }),
              claim_generation: 2,
              expected_generation: 4,
              settlement: retry.settlement,
            },
          }],
        };
      }
      throw new Error("unexpected reconciler writer");
    });
    const repository = repositoryWithQueries(ownerQuery, reconcilerQuery);

    await repository.reserveObjectOperation(reservePutRequest);
    await repository.startObjectOperationAttempt(startRequest());
    await repository.markObjectOperationCommitUnknown(markRequest);
    await repository.finalizeObjectOperation(finalizeRequest());
    await repository.claimExpiredObjectReconcile({
      contract_version: "object_store_metadata.v1",
      worker_id: "worker-1",
      limit: 1,
      lease_seconds: 30,
    });
    await repository.renewObjectReconcileClaim({
      ...durableIdentity,
      reservation_id: "reservation-1",
      claim_token: "claim-token-1",
      claim_generation: 2,
      expected_generation: 4,
      expected_claim_lease_expires_at: "2026-07-20T00:00:30.000Z",
      lease_seconds: 30,
    });
    await repository.settleObjectReconcile(retry);
    await repository.getObjectOperationResult({
      ...durableIdentity,
      caller_kind: "foreground",
    });

    const allSql = [...ownerCalls, ...reconcilerCalls].join("\n");
    for (const writer of [
      "reserve_object_operation_v1",
      "start_object_operation_attempt_v1",
      "mark_object_operation_commit_unknown_v1",
      "finalize_object_operation_v1",
      "claim_expired_object_reconcile_v1",
      "renew_object_reconcile_claim_v1",
      "settle_object_reconcile_v1",
      "get_object_operation_result_v1",
    ]) {
      expect(allSql).toContain(`object_store.${writer}`);
    }
    expect(allSql).not.toMatch(
      /\b(?:insert|update|delete|object_metadata_reservations)\b/iu,
    );
  });

  it("recovers with a new repository instance and no process identity cache", async () => {
    let finalized = false;
    const sharedQuery = vi.fn(async (sql: string) => {
      if (sql.includes("reserve_object_operation_v1")) {
        return { rows: [{ result: reservedResult() }] };
      }
      if (sql.includes("start_object_operation_attempt_v1")) {
        return {
          rows: [{
            result: {
              ...durableIdentity,
              reservation_id: "reservation-1",
              attempt_id: "attempt-1",
              attempt_no: 1,
              generation: 2,
            },
          }],
        };
      }
      if (sql.includes("finalize_object_operation_v1")) {
        finalized = true;
        throw new Error("commit_then_disconnect");
      }
      if (sql.includes("get_object_operation_result_v1") && finalized) {
        return {
          rows: [{
            result: succeededResult({ generation: 3 }),
          }],
        };
      }
      throw new Error("unexpected writer");
    });
    const firstProcess = repositoryWithQueries(sharedQuery);
    await firstProcess.reserveObjectOperation(reservePutRequest);

    const restartedProcess = repositoryWithQueries(sharedQuery);
    await expect(
      restartedProcess.startObjectOperationAttempt(startRequest()),
    ).resolves.toMatchObject({
      reservation_id: "reservation-1",
      attempt_id: "attempt-1",
    });
    await expect(
      restartedProcess.finalizeObjectOperation(
        finalizeRequest({ expected_generation: 2 }),
      ),
    ).resolves.toEqual(succeededResult({ generation: 3 }));
  });

  it("replays a claim renewal after commit-then-disconnect", async () => {
    let renewCalls = 0;
    const reconcilerQuery = vi.fn(async (sql: string) => {
      if (!sql.includes("renew_object_reconcile_claim_v1")) {
        throw new Error("unexpected reconciler writer");
      }
      renewCalls += 1;
      if (renewCalls === 1) throw new Error("commit_then_disconnect");
      return { rows: [{ result: claim() }] };
    });
    const repository = repositoryWithQueries(
      async () => {
        throw new Error("foreground pool must not be used");
      },
      reconcilerQuery,
    );

    await expect(
      repository.renewObjectReconcileClaim({
        ...durableIdentity,
        reservation_id: "reservation-1",
        claim_token: "claim-token-1",
        claim_generation: 2,
        expected_generation: 4,
        expected_claim_lease_expires_at:
          "2026-07-20T00:00:30.000Z",
        lease_seconds: 30,
      }),
    ).resolves.toEqual(claim());
    expect(renewCalls).toBe(2);
  });

  it("recovers a reserved operation after reserve commit-then-disconnect", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("reserve_object_operation_v1")) {
        throw new Error("commit_then_disconnect");
      }
      if (sql.includes("get_object_operation_result_v1")) {
        return { rows: [{ result: operationResult() }] };
      }
      throw new Error("unexpected writer");
    });
    const firstProcess = repositoryWithQueries(query);

    await expect(
      firstProcess.reserveObjectOperation(reservePutRequest),
    ).resolves.toEqual({
      kind: "replay",
      result: {
        ...durableIdentity,
        reservation_id: "reservation-1",
        status: "reserved",
        generation: 1,
        opaque_ref: null,
        terminal_proof: null,
      },
    });
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("composes durable claim-handler-settle reconciliation without local state", async () => {
    const retry = settleRequest();
    const reconcilerSql: string[] = [];
    const ownerQuery = async () => {
        throw new Error("foreground pool must not be used");
      };
    const reconcilerQuery = async (sql: string) => {
        reconcilerSql.push(sql);
        if (sql.includes("claim_expired_object_reconcile_v1")) {
          return { rows: [{ result: claim() }] };
        }
        if (sql.includes("renew_object_reconcile_claim_v1")) {
          return { rows: [{ result: claim() }] };
        }
        if (sql.includes("settle_object_reconcile_v1")) {
          return {
            rows: [{
              result: {
                result: operationResult({
                  status: "reconcile_required",
                  generation: 5,
                  reconcile_settlement: retry.settlement,
                }),
                claim_generation: 2,
                expected_generation: 4,
                settlement: retry.settlement,
              },
            }],
          };
        }
        throw new Error("unexpected reconciler writer");
      };
    const runtime = createPostgresObjectMetadataRuntimeV1({
      pool: { query: ownerQuery } as never,
      reconcilerPool: { query: reconcilerQuery } as never,
      ownerService: "trigger_processor",
      clock: () => new Date(now),
      handler: {
        kind: "object-metadata-reconcile-handler.v1",
        async reconcile(receivedClaim) {
          expect(receivedClaim).toEqual(claim());
          return retry.settlement;
        },
      },
    });
    expect(runtime).toMatchObject({
      kind: "postgres-object-metadata-runtime.v1",
      repository: { reconcilerReady: true },
    });
    await expect(
      runtime.reconciliation.reconcilePending({
        worker_id: "worker-1",
        limit: 1,
        lease_seconds: 30,
      }),
    ).resolves.toEqual({
      claimed: 1,
      completed: 0,
      retry_scheduled: 1,
    });
    expect(reconcilerSql).toEqual([
      expect.stringContaining(
        "object_store.claim_expired_object_reconcile_v1",
      ),
      expect.stringContaining("object_store.renew_object_reconcile_claim_v1"),
      expect.stringContaining("object_store.renew_object_reconcile_claim_v1"),
      expect.stringContaining("object_store.settle_object_reconcile_v1"),
    ]);
  });

  it("does not settle or continue a physical handler after the PostgreSQL claim lease is lost", async () => {
    vi.useFakeTimers();
    try {
      let renewCalls = 0;
      let settleCalls = 0;
      let releaseHandler!: (
        value: SettleObjectReconcileRequestV1["settlement"],
      ) => void;
      let markHandlerStarted!: () => void;
      const handlerStarted = new Promise<void>((resolve) => {
        markHandlerStarted = resolve;
      });
      const pendingHandler = new Promise<
        SettleObjectReconcileRequestV1["settlement"]
      >((resolve) => {
        releaseHandler = resolve;
      });
      const reconcilerQuery = vi.fn(async (sql: string) => {
        if (sql.includes("claim_expired_object_reconcile_v1")) {
          return { rows: [{ result: claim() }] };
        }
        if (sql.includes("renew_object_reconcile_claim_v1")) {
          renewCalls += 1;
          if (renewCalls > 1) throw new Error("claim_stolen");
          return { rows: [{ result: claim() }] };
        }
        if (sql.includes("settle_object_reconcile_v1")) {
          settleCalls += 1;
          throw new Error("stale claim must never settle");
        }
        throw new Error("unexpected reconciler writer");
      });
      const runtime = createPostgresObjectMetadataRuntimeV1({
        pool: {
          async query() {
            throw new Error("foreground pool must not be used");
          },
        } as never,
        reconcilerPool: { query: reconcilerQuery } as never,
        ownerService: "trigger_processor",
        clock: () => new Date(now),
        handler: {
          kind: "object-metadata-reconcile-handler.v1",
          async reconcile() {
            markHandlerStarted();
            return pendingHandler;
          },
        },
      });

      const running = runtime.reconciliation.reconcilePending({
        worker_id: "worker-1",
        limit: 1,
        lease_seconds: 30,
      });
      const rejected = expect(running).rejects.toThrow(/claim lease was lost/);
      await handlerStarted;
      await vi.advanceTimersByTimeAsync(10_000);
      await rejected;
      expect(renewCalls).toBe(3);
      expect(settleCalls).toBe(0);
      releaseHandler(settleRequest().settlement);
      await Promise.resolve();
    } finally {
      vi.useRealTimers();
    }
  });

  it("watchdogs a hung claim renewal before the live lease can expire", async () => {
    vi.useFakeTimers();
    try {
      let renewCalls = 0;
      let settleCalls = 0;
      let releaseHandler!: (
        value: SettleObjectReconcileRequestV1["settlement"],
      ) => void;
      let markHandlerStarted!: () => void;
      const handlerStarted = new Promise<void>((resolve) => {
        markHandlerStarted = resolve;
      });
      const pendingHandler = new Promise<
        SettleObjectReconcileRequestV1["settlement"]
      >((resolve) => {
        releaseHandler = resolve;
      });
      const never = new Promise<never>(() => undefined);
      const reconcilerQuery = vi.fn(async (sql: string) => {
        if (sql.includes("claim_expired_object_reconcile_v1")) {
          return { rows: [{ result: claim() }] };
        }
        if (sql.includes("renew_object_reconcile_claim_v1")) {
          renewCalls += 1;
          if (renewCalls > 1) return never;
          return { rows: [{ result: claim() }] };
        }
        if (sql.includes("settle_object_reconcile_v1")) {
          settleCalls += 1;
          throw new Error("expired claim must never settle");
        }
        throw new Error("unexpected reconciler writer");
      });
      const runtime = createPostgresObjectMetadataRuntimeV1({
        pool: {
          async query() {
            throw new Error("foreground pool must not be used");
          },
        } as never,
        reconcilerPool: { query: reconcilerQuery } as never,
        ownerService: "trigger_processor",
        clock: () => new Date(now),
        handler: {
          kind: "object-metadata-reconcile-handler.v1",
          async reconcile() {
            markHandlerStarted();
            return pendingHandler;
          },
        },
      });

      const running = runtime.reconciliation.reconcilePending({
        worker_id: "worker-1",
        limit: 1,
        lease_seconds: 30,
      });
      const rejected = expect(running).rejects.toThrow(/claim lease was lost/);
      await handlerStarted;
      await vi.advanceTimersByTimeAsync(27_001);
      await rejected;
      expect(renewCalls).toBe(2);
      expect(settleCalls).toBe(0);
      releaseHandler(settleRequest().settlement);
      await Promise.resolve();
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects schema-valid but attempt/outcome/settlement-unbound responses", async () => {
    const forgedFinalize = succeededResult({
      terminal_proof: terminalProof("different-attempt"),
    });
    const finalizeRepository = repositoryWithQueries(async (sql) => {
      if (sql.includes("finalize_object_operation_v1")) {
        return {
          rows: [{
            result: {
              result: forgedFinalize,
              attempt_id: "attempt-1",
              expected_generation: 3,
              outcome: putOutcome,
            },
          }],
        };
      }
      throw new Error("unexpected writer");
    });
    await expect(
      finalizeRepository.finalizeObjectOperation(finalizeRequest()),
    ).rejects.toThrow(/terminal proof attempt or outcome drift/);

    const startRepository = repositoryWithQueries(async (sql) => {
      if (sql.includes("start_object_operation_attempt_v1")) {
        return {
          rows: [{
            result: {
              ...durableIdentity,
              reservation_id: "reservation-1",
              attempt_id: "attempt-1",
              attempt_no: 1,
              operation: "put_immutable",
              generation: 3,
            },
          }],
        };
      }
      throw new Error("unexpected writer");
    });
    await expect(
      startRepository.startObjectOperationAttempt(startRequest()),
    ).rejects.toThrow(/identity or generation drift/);

    const markRequest = {
      ...durableIdentity,
      reservation_id: "reservation-1",
      attempt_id: "attempt-1",
      expected_generation: 2,
      actor: {
        actor_kind: "foreground" as const,
        attempt_token: "attempt-token-1",
      },
      provider_request_id: "provider-request-1",
      provider_receipt_hash: hashA,
      physical_object_fingerprint: hashB,
    };
    const commitUnknownEvidence = {
      attempt_id: "attempt-1",
      expected_generation: 2,
      provider_request_id: "provider-request-1",
      provider_receipt_hash: hashA,
      physical_object_fingerprint: hashB,
      error: null,
    };
    const markRepository = repositoryWithQueries(async (sql) => {
      if (sql.includes("mark_object_operation_commit_unknown_v1")) {
        return {
          rows: [{
            result: {
              result: operationResult({
                status: "reconcile_required",
                generation: 3,
                commit_unknown_evidence: commitUnknownEvidence,
              }),
              ...commitUnknownEvidence,
              provider_request_id: "different-provider-request",
            },
          }],
        };
      }
      throw new Error("unexpected writer");
    });
    await expect(
      markRepository.markObjectOperationCommitUnknown(markRequest),
    ).rejects.toThrow(/response evidence drift/);

    const retry = settleRequest();
    const forgedSettlement = {
      ...retry.settlement,
      retry_delay_seconds: 31,
    };
    const settleRepository = repositoryWithQueries(
      async () => {
        throw new Error("foreground pool must not be used");
      },
      async (sql) => {
        if (sql.includes("settle_object_reconcile_v1")) {
          return {
            rows: [{
              result: {
                result: operationResult({
                  status: "reconcile_required",
                  generation: 5,
                  reconcile_settlement: forgedSettlement,
                }),
                claim_generation: retry.claim_generation,
                expected_generation: retry.expected_generation,
                settlement: retry.settlement,
              },
            }],
          };
        }
        throw new Error("unexpected writer");
      },
    );
    await expect(
      settleRepository.settleObjectReconcile(retry),
    ).rejects.toThrow(/durable evidence drift/);
  });

  it("keeps missing reconciler pools fail-closed and validates production storage policy", async () => {
    const repository = createPostgresObjectMetadataRepositoryV1({
      pool: { query: async () => ({ rows: [] }) } as never,
      ownerService: "trigger_processor",
      clock: () => new Date(now),
    });
    expect(repository.reconcilerReady).toBe(false);
    await expect(
      repository.claimExpiredObjectReconcile({
        contract_version: "object_store_metadata.v1",
        worker_id: "worker-1",
        limit: 1,
        lease_seconds: 30,
      }),
    ).rejects.toThrow(/reconciler pool is not configured/);
    expect(() =>
      createPostgresObjectMetadataReconciliationAdapterV1({
        repository,
        handler: {
          kind: "object-metadata-reconcile-handler.v1",
          async reconcile() {
            return settleRequest().settlement;
          },
        },
      })
    ).toThrow(/separate reconciler pool/);
    const readyRepository = repositoryWithQueries(async () => ({
      rows: [],
    }));
    expect(() =>
      createSupabaseStorageAdapterV1({
        url: "https://storage.invalid",
        secretKey: "secret",
        metadataRepository: readyRepository,
        terminalProofReconciler: {
          kind: "object-store-terminal-proof-reconciler.v1",
          async reconcileTerminalProofs() {},
        },
        accessPolicyVerifier: {
          async verify() {
            throw new Error("unused");
          },
        },
        policies: [],
      })
    ).toThrow(/at least one object class policy/);
  });
});
