import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import {
  RuntimeStartReservationValidationErrorV1,
  createRuntimeStartReservationValidationApplicationV1,
  type RuntimeStartReservationStatusV1,
  type RuntimeStartReservationValidationReadV1,
  type RuntimeStartReservationValidationRepositoryV1,
  type RuntimeStartReservationValidationRowV1,
} from "../src/application/runtime-start-reservation-validation.v1.js";

const token = "fence-token-1";
const requestHash = `sha256:${"a".repeat(64)}`;
const tokenHash = `sha256:${createHash("sha256").update(token).digest("hex")}`;
const path = { trigger_process_id: "process-1", start_attempt_no: 1 } as const;
const request = {
  schema_version: "runtime_start_reservation_validate_request.v1",
  runtime_run_id: "run-1",
  start_fence_token: token,
  request_hash: requestHash,
  validation_stage: "request_received",
  trace_id: "trace-1",
} as const;
const principal = {
  sub: "action_runtime" as const,
  aud: "trigger_processor" as const,
  capability: ["trigger.runtime_start.reservation.validate"],
  scope_kind: "bot" as const,
  workspace_id: "workspace-1",
  bot_id: "bot-1",
  owner_agent_id: "agent-1",
  deployment_environment: "dev" as const,
  release_channel: "stable" as const,
};

function row(
  status: RuntimeStartReservationStatusV1 = "dispatching",
): RuntimeStartReservationValidationRowV1 {
  return Object.freeze({
    trigger_process_id: "process-1",
    runtime_run_id: "run-1",
    start_attempt_no: 1,
    start_fence_generation: 7,
    start_fence_token_hash: tokenHash,
    request_hash: requestHash,
    status,
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
  });
}

function repositoryFromRead(
  read: (
    selector: Readonly<{
      trigger_process_id: string;
      start_attempt_no: number;
    }>,
  ) =>
    | Promise<RuntimeStartReservationValidationReadV1>
    | RuntimeStartReservationValidationReadV1,
): RuntimeStartReservationValidationRepositoryV1 {
  return Object.freeze({
    async withLockedExactReservation(selector, inspect) {
      return inspect(await read(selector));
    },
  });
}

describe("Runtime Start reservation validation", () => {
  it("returns the owner row fence and re-reads every validation stage", async () => {
    const readExactReservation = vi.fn(async () => ({
      outcome: "found" as const,
      reservation: row(),
    }));
    const app = createRuntimeStartReservationValidationApplicationV1(
      repositoryFromRead(readExactReservation),
    );
    for (const validation_stage of [
      "request_received",
      "preflight_completed",
      "before_running",
    ] as const) {
      const stageRequest =
        validation_stage === "before_running"
          ? {
              schema_version:
                "runtime_start_reservation_validate_request.v1" as const,
              runtime_run_id: request.runtime_run_id,
              start_fence_token_hash: tokenHash,
              request_hash: request.request_hash,
              validation_stage,
              trace_id: request.trace_id,
            }
          : { ...request, validation_stage };
      await expect(
        app.validate(principal, path, stageRequest),
      ).resolves.toMatchObject({
        validation_result: "valid",
        reservation_status: "dispatching",
        validated_fence_generation: 7,
        validation_stage,
        duplicate_replayed: false,
      });
    }
    expect(readExactReservation).toHaveBeenCalledTimes(3);
  });

  it("fails closed on scope, request hash, stale fence, cancel and terminal rows", async () => {
    const create = (reservation: ReturnType<typeof row>) =>
      createRuntimeStartReservationValidationApplicationV1(
        repositoryFromRead(async () => {
          return { outcome: "found", reservation };
        }),
      );
    await expect(
      create(row()).validate(
        { ...principal, bot_id: "bot-other" },
        path,
        request,
      ),
    ).rejects.toMatchObject<Partial<RuntimeStartReservationValidationErrorV1>>({
      code: "authorization_scope_mismatch",
    });
    await expect(
      create(row()).validate(principal, path, {
        ...request,
        request_hash: `sha256:${"b".repeat(64)}`,
      }),
    ).rejects.toMatchObject({ code: "idempotency_conflict" });
    await expect(
      create({ ...row(), start_fence_token_hash: `sha256:${"c".repeat(64)}` }).validate(
        principal,
        path,
        request,
      ),
    ).rejects.toMatchObject({ code: "stale_start_fence" });
    await expect(
      create(row("cancel_requested")).validate(principal, path, request),
    ).rejects.toMatchObject({ code: "start_cancelled" });
    await expect(
      create(row("started")).validate(principal, path, request),
    ).rejects.toMatchObject({ code: "reservation_terminal" });
  });

  it("returns each active status only before run publication and on the current process fence", async () => {
    for (const status of ["reserved", "dispatching", "queued"] as const) {
      const app = createRuntimeStartReservationValidationApplicationV1(
        repositoryFromRead(async () => {
          return { outcome: "found", reservation: row(status) };
        }),
      );
      await expect(
        app.validate(principal, path, {
          ...request,
          validation_stage: "preflight_completed",
        }),
      ).resolves.toMatchObject({ reservation_status: status });
    }
    for (const reservation of [
      { ...row(), current_runtime_run_id: "run-other" },
      { ...row(), process_phase: "closed", process_status: "failed" },
      { ...row(), is_current_fence: false },
    ]) {
      await expect(
        createRuntimeStartReservationValidationApplicationV1(
          repositoryFromRead(async () => {
            return { outcome: "found", reservation };
          }),
        ).validate(principal, path, request),
      ).rejects.toMatchObject({ code: "reservation_terminal" });
    }
  });

  it("re-reads and rejects a tombstone committed between validation stages", async () => {
    let readNo = 0;
    const app = createRuntimeStartReservationValidationApplicationV1(
      repositoryFromRead(async () => {
        readNo += 1;
        return {
          outcome: "found",
          reservation:
            readNo === 1 ? row() : { ...row(), has_tombstone: true },
        };
      }),
    );
    await expect(app.validate(principal, path, request)).resolves.toMatchObject({
      validation_stage: "request_received",
      duplicate_replayed: false,
    });
    await expect(
      app.validate(principal, path, {
        schema_version: "runtime_start_reservation_validate_request.v1",
        runtime_run_id: "run-1",
        start_fence_token_hash: `sha256:${"f".repeat(64)}`,
        request_hash: requestHash,
        validation_stage: "before_running",
        trace_id: "trace-1",
      }),
    ).rejects.toMatchObject({ code: "stale_start_fence" });
    await expect(
      app.validate(principal, path, {
        ...request,
        validation_stage: "preflight_completed",
      }),
    ).rejects.toMatchObject({ code: "start_cancelled" });
  });

  it("accepts only the persisted hash at before_running", async () => {
    const app = createRuntimeStartReservationValidationApplicationV1(
      repositoryFromRead(async () => {
        return { outcome: "found", reservation: row() };
      }),
    );
    await expect(
      app.validate(principal, path, {
        schema_version: "runtime_start_reservation_validate_request.v1",
        runtime_run_id: "run-1",
        start_fence_token_hash: tokenHash,
        request_hash: requestHash,
        validation_stage: "before_running",
        trace_id: "trace-1",
      }),
    ).resolves.toMatchObject({
      validation_stage: "before_running",
      duplicate_replayed: false,
    });
    await expect(
      app.validate(principal, path, {
        ...request,
        validation_stage: "before_running",
      }),
    ).rejects.toMatchObject({ code: "schema_validation_failed" });
  });

  it("deep-snapshots path, principal and request before the repository wait", async () => {
    let releaseRead!: () => void;
    let readStarted!: () => void;
    const mayReturn = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });
    const started = new Promise<void>((resolve) => {
      readStarted = resolve;
    });
    const readExactReservation = vi.fn(async (selector) => {
      readStarted();
      await mayReturn;
      return { outcome: "found" as const, reservation: row() };
    });
    const app = createRuntimeStartReservationValidationApplicationV1(
      repositoryFromRead(readExactReservation),
    );
    const mutablePrincipal = {
      ...principal,
      capability: [...principal.capability],
    };
    const mutablePath = { ...path };
    const mutableRequest = { ...request };

    const pending = app.validate(mutablePrincipal, mutablePath, mutableRequest);
    await started;
    Reflect.set(mutablePrincipal, "bot_id", "bot-other");
    mutablePrincipal.capability.splice(0, 1, "unrelated.capability");
    Reflect.set(mutablePath, "trigger_process_id", "process-other");
    Reflect.set(mutablePath, "start_attempt_no", 99);
    Reflect.set(mutableRequest, "runtime_run_id", "run-other");
    Reflect.set(
      mutableRequest,
      "request_hash",
      `sha256:${"f".repeat(64)}`,
    );
    Reflect.set(mutableRequest, "start_fence_token", "mutated-token");
    Reflect.set(mutableRequest, "trace_id", "mutated-trace");
    releaseRead();

    await expect(pending).resolves.toMatchObject({
      validation_result: "valid",
      validation_stage: "request_received",
      trace_id: "trace-1",
    });
    expect(readExactReservation).toHaveBeenCalledWith({
      trigger_process_id: "process-1",
      start_attempt_no: 1,
    });
  });

  it("validates and builds the response before the owner lock is released", async () => {
    let lockHeld = false;
    let inspectorReturnedWhileLocked = false;
    const app = createRuntimeStartReservationValidationApplicationV1({
      async withLockedExactReservation(selector, inspect) {
        expect(selector).toEqual(path);
        lockHeld = true;
        try {
          const response = inspect({
            outcome: "found",
            reservation: row(),
          });
          inspectorReturnedWhileLocked = lockHeld;
          return response;
        } finally {
          lockHeld = false;
        }
      },
    });

    await expect(app.validate(principal, path, request)).resolves.toMatchObject({
      validation_result: "valid",
      duplicate_replayed: false,
    });
    expect(inspectorReturnedWhileLocked).toBe(true);
    expect(lockHeld).toBe(false);
  });
});
