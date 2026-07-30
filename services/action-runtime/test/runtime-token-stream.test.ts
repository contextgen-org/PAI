import { EventEmitter } from "node:events";

import { describe, expect, it } from "vitest";

import {
  bindRuntimeTokenStreamAbortV1,
  buildActionRuntimeApp,
  writeRuntimeTokenFrameV1,
} from "../src/app.js";
import {
  RuntimeTokenStreamErrorV1,
  createRuntimeTokenStreamApplicationV1,
} from "../src/runtime-token-stream.v1.js";
import type {
  RuntimeQueryApplicationV1,
  RuntimeQueryPrincipalV1,
} from "../src/runtime-query.v1.js";

const scope = Object.freeze({
  workspace_id: "workspace-1",
  bot_id: "bot-1",
  owner_agent_id: "owner-1",
  deployment_environment: "dev" as const,
  release_channel: "stable" as const,
});

const principal = Object.freeze({
  workload_service: "observation_gateway" as const,
  delegated_principal: Object.freeze({
    principal_type: "developer" as const,
    principal_id: "developer-1",
    roles: Object.freeze(["observation.debug_viewer"]),
    source_issuer: "test",
    source_subject: "developer-1",
    auth_time: 1,
    scope_kind: "bot" as const,
    ...scope,
  }),
  scope,
}) satisfies RuntimeQueryPrincipalV1;

function query(status = "running"): RuntimeQueryApplicationV1 {
  return {
    async getRun(_principal, runtimeRunId, traceId) {
      return {
        code: "runtime_run_found",
        message: "runtime run found",
        retryable: false,
        trace_id: traceId,
        details: {
          runtime_run: {
            runtime_run_id: runtimeRunId,
            trigger_process_id: "process-1",
            ...scope,
            status: status as "running",
            start_attempt_no: 1,
            policy_snapshot_id: "policy-1",
            requested_catalog_version: "catalog-1",
            effective_catalog_version: "catalog-1",
            created_at: "2026-07-23T00:00:00.000Z",
            started_at: "2026-07-23T00:00:01.000Z",
            completed_at: null,
            terminal_reason: null,
          },
        },
      };
    },
    async listToolInvocations() {
      throw new Error("not used");
    },
    async checkReadiness() {},
  };
}

function source(frames: readonly unknown[]) {
  return {
    async *stream() {
      yield* frames;
    },
    async checkReadiness() {},
  };
}

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const values: T[] = [];
  for await (const value of iterable) values.push(value);
  return values;
}

const frame = Object.freeze({
  schema_version: "runtime_token_sse_event.v1",
  runtime_run_id: "run-1",
  trigger_process_id: "process-1",
  token: "next",
  emitted_at: "2026-07-23T00:00:02.000Z",
});

describe("Runtime live token SSE", () => {
  it("binds stream lifetime to request abort and response close, not request completion", () => {
    const request = new EventEmitter();
    const response = new EventEmitter();
    const controller = new AbortController();
    const unbind = bindRuntimeTokenStreamAbortV1(
      request,
      response,
      controller,
    );

    request.emit("close");
    expect(controller.signal.aborted).toBe(false);
    response.emit("close");
    expect(controller.signal.aborted).toBe(true);
    expect(request.listenerCount("aborted")).toBe(1);
    unbind();
    expect(request.listenerCount("aborted")).toBe(0);
    expect(response.listenerCount("close")).toBe(0);
  });

  it("removes the losing backpressure listener after every frame", async () => {
    class BackpressuredResponse extends EventEmitter {
      readonly frames: string[] = [];

      write(value: string): boolean {
        this.frames.push(value);
        return false;
      }
    }

    const response = new BackpressuredResponse();
    for (let index = 0; index < 64; index += 1) {
      const pending = writeRuntimeTokenFrameV1(
        response as unknown as NodeJS.WritableStream,
        { index },
      );
      expect(response.listenerCount("drain")).toBe(1);
      expect(response.listenerCount("close")).toBe(1);
      response.emit(index % 2 === 0 ? "drain" : "close");
      await pending;
      expect(response.listenerCount("drain")).toBe(0);
      expect(response.listenerCount("close")).toBe(0);
    }
    expect(response.frames).toHaveLength(64);
  });

  it("cancels a backpressure wait when stream authorization expires", async () => {
    class BackpressuredResponse extends EventEmitter {
      write(): boolean {
        return false;
      }
    }

    const response = new BackpressuredResponse();
    const controller = new AbortController();
    const pending = writeRuntimeTokenFrameV1(
      response as unknown as NodeJS.WritableStream,
      frame,
      controller.signal,
    );
    expect(response.listenerCount("drain")).toBe(1);
    expect(response.listenerCount("close")).toBe(1);

    controller.abort(new Error("credential_expired"));
    await expect(pending).resolves.toBeUndefined();
    expect(response.listenerCount("drain")).toBe(0);
    expect(response.listenerCount("close")).toBe(0);
  });

  it("authorizes the owner run before opening a non-durable bound stream", async () => {
    const application = createRuntimeTokenStreamApplicationV1(
      query(),
      source([frame]),
    );
    const prepared = await application.prepare(
      principal,
      "run-1",
      new AbortController().signal,
    );
    expect(await collect(prepared.frames)).toEqual([frame]);
  });

  it("keeps the original authorized principal across the live stream await boundary", async () => {
    const observed: RuntimeQueryPrincipalV1[] = [];
    const baseQuery = query();
    const recordingQuery: RuntimeQueryApplicationV1 = {
      ...baseQuery,
      async getRun(principalValue, runtimeRunId, traceId) {
        observed.push(principalValue);
        return baseQuery.getRun(
          principalValue,
          runtimeRunId,
          traceId,
        );
      },
    };
    const application = createRuntimeTokenStreamApplicationV1(
      recordingQuery,
      source([frame]),
    );
    const mutablePrincipal = structuredClone(principal);
    const prepared = await application.prepare(
      mutablePrincipal,
      "run-1",
      new AbortController().signal,
    );
    (
      mutablePrincipal.scope as { bot_id: string }
    ).bot_id = "bot-attacker";
    (
      mutablePrincipal.delegated_principal as {
        bot_id: string;
        roles: string[];
      }
    ).bot_id = "bot-attacker";
    (
      mutablePrincipal.delegated_principal.roles as string[]
    ).push("admin");

    expect(await collect(prepared.frames)).toEqual([frame]);
    expect(observed).toHaveLength(2);
    expect(observed[1]).toMatchObject(principal);
    expect(Object.isFrozen(observed[1])).toBe(true);
    expect(
      Object.isFrozen(observed[1]?.delegated_principal.roles),
    ).toBe(true);
  });

  it("rejects terminal runs and durable identity fields", async () => {
    const terminal = createRuntimeTokenStreamApplicationV1(
      query("completed"),
      source([frame]),
    );
    await expect(
      terminal.prepare(
        principal,
        "run-1",
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({
      code: "runtime_token_stream_not_live",
    });

    const drift = createRuntimeTokenStreamApplicationV1(
      query(),
      source([{ ...frame, event_id: "forbidden" }]),
    );
    const prepared = await drift.prepare(
      principal,
      "run-1",
      new AbortController().signal,
    );
    await expect(collect(prepared.frames)).rejects.toBeInstanceOf(
      RuntimeTokenStreamErrorV1,
    );
  });

  it("stops before emitting the next frame when the durable run becomes terminal", async () => {
    let reads = 0;
    const running = query("running");
    const terminal = query("completed");
    const changing: RuntimeQueryApplicationV1 = {
      ...running,
      async getRun(principalValue, runtimeRunId, traceId) {
        reads += 1;
        return (reads === 1 ? running : terminal).getRun(
          principalValue,
          runtimeRunId,
          traceId,
        );
      },
    };
    const application = createRuntimeTokenStreamApplicationV1(
      changing,
      source([frame]),
    );
    const prepared = await application.prepare(
      principal,
      "run-1",
      new AbortController().signal,
    );

    expect(await collect(prepared.frames)).toEqual([]);
    expect(reads).toBe(2);
  });

  it("serves frames without SSE ids and rejects Last-Event-ID", async () => {
    const application = createRuntimeTokenStreamApplicationV1(
      query(),
      source([frame]),
    );
    const now = Math.floor(Date.now() / 1_000);
    const verifier = {
      async verify() {
        return {
          protectedHeader: { alg: "EdDSA", kid: "test", typ: "JWT" },
          claims: {
            iss: "pai-workload",
            sub: "observation_gateway",
            aud: "action_runtime",
            jti: "observation-1",
            iat: now,
            nbf: now,
            exp: now + 60,
            capability: ["runtime.debug_tokens"],
            scope_kind: "bot",
            ...scope,
            delegated_principal: principal.delegated_principal,
          },
        };
      },
    };
    const app = buildActionRuntimeApp(
      { logger: false, auth: { verifier } },
      { runtime_token_stream: application },
    );
    const response = await app.inject({
      method: "GET",
      url: "/internal/runtime-runs/run-1/tokens",
      headers: { authorization: "Bearer aaa.bbb.ccc" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("event: runtime_token");
    expect(response.body).not.toContain("\nid:");

    const replay = await app.inject({
      method: "GET",
      url: "/internal/runtime-runs/run-1/tokens",
      headers: {
        authorization: "Bearer aaa.bbb.ccc",
        "last-event-id": "run-1:1",
      },
    });
    expect(replay.statusCode).toBe(400);
    await app.close();
  });
});
