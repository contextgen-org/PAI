import { describe, expect, it } from "vitest";

import {
  InvalidProcessControlRequestV1,
  createTriggerProcessControlApplicationV1,
} from "../src/application/process-control.v1.js";
import type { TriggerProcessorOwnerDatabaseV1 } from "../src/application/trigger-admission.v1.js";

const ingress = {
  authentication_kind: "supabase_ingress",
  credential: {
    principal: {
      principal_type: "developer",
      principal_id: "developer-1",
      roles: ["developer"],
      source_issuer: "https://supabase.test/auth/v1",
      source_subject: "developer-1",
      auth_time: 1,
    },
    claims: { sub: "developer-1" },
  },
} as const;

function database(calls: Array<Record<string, unknown>>): TriggerProcessorOwnerDatabaseV1 {
  return {
    deployment: {} as never,
    repository: {} as never,
    unit_of_work: {
      owner_service: "trigger_processor",
      async withTransaction(request, work) {
        calls.push({ transaction: request });
        return work({} as never, {
          owner: {
            async executeWriter(_transaction: unknown, writer: Readonly<Record<string, unknown>>) {
              calls.push({ writer });
              return {
                code: "cancel_pending",
                message: "pending",
                retryable: false,
                trace_id: "trace-1",
                details: {
                  trigger_process_id: "process-1",
                  idempotency_key: "cancel-1",
                  duplicate_replayed: false,
                  phase: "execution",
                  status: "cancelling",
                  cancellation_status: "pending",
                  cancel_requested_at: "2026-07-29T00:00:00.000Z",
                  runtime_signal_id: "signal-1",
                },
              };
            },
          } as never,
        });
      },
    },
  } as TriggerProcessorOwnerDatabaseV1;
}

describe("Trigger Process control application", () => {
  it("derives actor and persists cancel decision in one serializable owner transaction", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const application = createTriggerProcessControlApplicationV1(database(calls), {
      generateId: () => "cancel-request-1",
    });
    await expect(
      application.cancel(
        ingress,
        "process-1",
        { idempotency_key: "cancel-1", reason: "user_requested" },
        "trace-1",
      ),
    ).resolves.toMatchObject({ code: "cancel_pending" });
    expect(calls[0]).toEqual({
      transaction: {
        operation: "request_trigger_cancel",
        idempotency_key: "process-1:cancel-1",
        trace_id: "trace-1",
        isolation: "serializable",
        retry: "serialization_failures",
      },
    });
    expect(calls[1]).toMatchObject({
      writer: {
        writer: "request_trigger_cancel_v1",
        arguments: {
          p_cancel_request_id: "cancel-request-1",
          p_process_id: "process-1",
          p_cancel_request: {
            authenticated_principal_id: "developer-1",
            authenticated_role: "developer",
            normalized_reason: "user_requested",
          },
        },
      },
    });
  });

  it("pins cancellation request and verified ingress before transaction acquisition", async () => {
    const calls: Array<Record<string, unknown>> = [];
    let releaseTransaction!: () => void;
    const transactionGate = new Promise<void>((resolve) => {
      releaseTransaction = resolve;
    });
    const gatedDatabase = database(calls);
    const originalWithTransaction =
      gatedDatabase.unit_of_work.withTransaction.bind(
        gatedDatabase.unit_of_work,
      );
    gatedDatabase.unit_of_work.withTransaction = (async (
      request: Parameters<typeof originalWithTransaction>[0],
      work: Parameters<typeof originalWithTransaction>[1],
    ) => {
      await transactionGate;
      return originalWithTransaction(request, work);
    }) as typeof gatedDatabase.unit_of_work.withTransaction;
    const application = createTriggerProcessControlApplicationV1(
      gatedDatabase,
      { generateId: () => "cancel-request-pinned" },
    );
    const mutableIngress = structuredClone(ingress);
    const mutableRequest = {
      idempotency_key: "cancel-pinned",
      reason: "user_requested",
    };
    const pending = application.cancel(
      mutableIngress,
      "process-1",
      mutableRequest,
      "trace-1",
    );
    mutableIngress.credential.principal.principal_id = "mutated-principal";
    mutableRequest.idempotency_key = "cancel-mutated";
    mutableRequest.reason = "mutated_reason";
    releaseTransaction();

    await expect(pending).resolves.toMatchObject({ code: "cancel_pending" });
    expect(calls[1]).toMatchObject({
      writer: {
        arguments: {
          p_idempotency_key: "cancel-pinned",
          p_cancel_request: {
            authenticated_principal_id: "developer-1",
            normalized_reason: "user_requested",
          },
        },
      },
    });
  });

  it("rejects workload and bot principals before owner mutation", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const application = createTriggerProcessControlApplicationV1(database(calls));
    await expect(
      application.cancel(
        { authentication_kind: "pai_workload_jwt", credential: {} as never },
        "process-1",
        { idempotency_key: "cancel-1", reason: "user_requested" },
        "trace-1",
      ),
    ).rejects.toEqual(
      expect.objectContaining<Partial<InvalidProcessControlRequestV1>>({
        kind: "authorization_denied",
      }),
    );
    expect(calls).toHaveLength(0);
  });
});
