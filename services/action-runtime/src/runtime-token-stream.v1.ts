import {
  RUNTIME_TOKEN_SSE_FORBIDDEN_DURABLE_FIELDS_V1,
  RuntimeTokenSseEventV1Schema,
  type RuntimeTokenSseEventV1,
} from "@pai/contracts";
import { canonicalJsonV1 } from "@pai/eventing";
import { Value } from "@sinclair/typebox/value";

import {
  RuntimeQueryErrorV1,
  snapshotRuntimeQueryPrincipalV1,
  type RuntimeQueryApplicationV1,
  type RuntimeQueryBotScopeV1,
  type RuntimeQueryPrincipalV1,
} from "./runtime-query.v1.js";

export class RuntimeTokenStreamErrorV1 extends Error {
  public constructor(
    public readonly code:
      | "authorization_denied"
      | "runtime_run_not_found"
      | "runtime_token_stream_not_live"
      | "owner_contract_drift"
      | "token_source_unavailable",
    public readonly retryable: boolean,
  ) {
    super(code);
    this.name = "RuntimeTokenStreamErrorV1";
  }
}

export interface RuntimeTokenLiveSourceV1 {
  stream(
    input: Readonly<{
      runtime_run_id: string;
      trigger_process_id: string;
      scope: RuntimeQueryBotScopeV1;
    }>,
    signal: AbortSignal,
  ): AsyncIterable<unknown>;
  checkReadiness(signal?: AbortSignal): Promise<void>;
}

export interface RuntimeTokenStreamApplicationV1 {
  prepare(
    principal: RuntimeQueryPrincipalV1,
    runtimeRunId: string,
    signal: AbortSignal,
  ): Promise<
    Readonly<{
      runtime_run_id: string;
      trigger_process_id: string;
      frames: AsyncIterable<RuntimeTokenSseEventV1>;
    }>
  >;
  checkReadiness(signal?: AbortSignal): Promise<void>;
}

function mapQueryError(error: unknown): never {
  if (!(error instanceof RuntimeQueryErrorV1)) {
    throw new RuntimeTokenStreamErrorV1(
      "token_source_unavailable",
      true,
    );
  }
  if (error.code === "authorization_denied") {
    throw new RuntimeTokenStreamErrorV1(
      "authorization_denied",
      false,
    );
  }
  if (error.code === "runtime_run_not_found") {
    throw new RuntimeTokenStreamErrorV1(
      "runtime_run_not_found",
      false,
    );
  }
  throw new RuntimeTokenStreamErrorV1("owner_contract_drift", false);
}

function tokenFrame(
  value: unknown,
  runtimeRunId: string,
  triggerProcessId: string,
): RuntimeTokenSseEventV1 {
  let snapshot: unknown;
  try {
    snapshot = JSON.parse(canonicalJsonV1(value));
  } catch {
    throw new RuntimeTokenStreamErrorV1("owner_contract_drift", false);
  }
  if (!Value.Check(RuntimeTokenSseEventV1Schema, snapshot)) {
    throw new RuntimeTokenStreamErrorV1("owner_contract_drift", false);
  }
  const candidate =
    snapshot as unknown as Readonly<Record<string, unknown>>;
  if (
    RUNTIME_TOKEN_SSE_FORBIDDEN_DURABLE_FIELDS_V1.some(
      (field) => Object.hasOwn(candidate, field),
    ) ||
    snapshot.runtime_run_id !== runtimeRunId ||
    snapshot.trigger_process_id !== triggerProcessId
  ) {
    throw new RuntimeTokenStreamErrorV1("owner_contract_drift", false);
  }
  return Object.freeze(snapshot);
}

export function createRuntimeTokenStreamApplicationV1(
  runtimeQuery: RuntimeQueryApplicationV1,
  source: RuntimeTokenLiveSourceV1,
): RuntimeTokenStreamApplicationV1 {
  return Object.freeze({
    async prepare(
      principalValue: RuntimeQueryPrincipalV1,
      runtimeRunId: string,
      signal: AbortSignal,
    ) {
      const principal =
        snapshotRuntimeQueryPrincipalV1(principalValue);
      let run;
      try {
        run = (
          await runtimeQuery.getRun(
            principal,
            runtimeRunId,
            `runtime-token:${runtimeRunId}`,
          )
        ).details.runtime_run;
      } catch (error) {
        mapQueryError(error);
      }
      if (run.status !== "running") {
        throw new RuntimeTokenStreamErrorV1(
          "runtime_token_stream_not_live",
          false,
        );
      }
      let stream: AsyncIterable<unknown>;
      try {
        stream = source.stream(
          Object.freeze({
            runtime_run_id: runtimeRunId,
            trigger_process_id: run.trigger_process_id,
            scope: principal.scope,
          }),
          signal,
        );
      } catch {
        throw new RuntimeTokenStreamErrorV1(
          "token_source_unavailable",
          true,
        );
      }
      return Object.freeze({
        runtime_run_id: runtimeRunId,
        trigger_process_id: run.trigger_process_id,
        frames: Object.freeze({
          async *[Symbol.asyncIterator]() {
            let frameNo = 0;
            try {
              for await (const value of stream) {
                if (signal.aborted) return;
                frameNo += 1;
                let current;
                try {
                  current = (
                    await runtimeQuery.getRun(
                      principal,
                      runtimeRunId,
                      `runtime-token:${runtimeRunId}:${frameNo}`,
                    )
                  ).details.runtime_run;
                } catch (error) {
                  mapQueryError(error);
                }
                if (
                  current.status !== "running" ||
                  current.trigger_process_id !== run.trigger_process_id
                ) {
                  return;
                }
                yield tokenFrame(
                  value,
                  runtimeRunId,
                  run.trigger_process_id,
                );
              }
            } catch (error) {
              if (signal.aborted) return;
              if (error instanceof RuntimeTokenStreamErrorV1) throw error;
              throw new RuntimeTokenStreamErrorV1(
                "token_source_unavailable",
                true,
              );
            }
          },
        }),
      });
    },

    async checkReadiness(signal?: AbortSignal) {
      await Promise.all([
        runtimeQuery.checkReadiness(signal),
        source.checkReadiness(signal),
      ]);
    },
  });
}
