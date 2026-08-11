import type { RuntimeFinalResultReadContractV1 } from "@pai/contracts";
import { InternalClientError } from "@pai/service-kit";

import type {
  DelegatedProcessReadPrincipalV1,
  TriggerProcessObservationApplicationV1,
} from "./process-observation.v1.js";

export interface RuntimeFinalResultReadPortV1 {
  read(
    request: Readonly<{
      runtime_run_id: string;
      workspace_id: string;
      bot_id: string;
      owner_agent_id: string;
      deployment_environment: "local" | "dev" | "staging" | "prod";
      release_channel: "stable" | "canary";
      trace_id: string;
    }>,
    signal: AbortSignal,
  ): Promise<RuntimeFinalResultReadContractV1>;
}

export class TriggerProcessFinalResponseErrorV1 extends Error {
  public constructor(
    public readonly code:
      | "final_response_not_ready"
      | "final_response_owner_mismatch"
      | "final_response_unavailable",
    public readonly retryable: boolean,
  ) {
    super(code);
    this.name = "TriggerProcessFinalResponseErrorV1";
  }
}

export interface TriggerProcessFinalResponseApplicationV1 {
  read(
    principal: DelegatedProcessReadPrincipalV1,
    processId: string,
    traceId: string,
    signal?: AbortSignal,
  ): Promise<Readonly<{
    process_id: string;
    runtime_run_id: string;
    content_type: "text/plain";
    content: string;
  }>>;
}

export function createTriggerProcessFinalResponseApplicationV1(
  processObservation: TriggerProcessObservationApplicationV1,
  runtimeFinalResults: RuntimeFinalResultReadPortV1,
): TriggerProcessFinalResponseApplicationV1 {
  return Object.freeze({
    async read(
      principal: DelegatedProcessReadPrincipalV1,
      processId: string,
      traceId: string,
      signal = new AbortController().signal,
    ) {
      signal.throwIfAborted();
      const process = await processObservation.getProcess(
        principal,
        processId,
        traceId,
      );
      const details = process.details;
      if (details.runtime_run_id === null) {
        throw new TriggerProcessFinalResponseErrorV1(
          "final_response_not_ready",
          true,
        );
      }
      let result: RuntimeFinalResultReadContractV1;
      try {
        result = await runtimeFinalResults.read(
          {
            runtime_run_id: details.runtime_run_id,
            workspace_id: details.workspace_id,
            bot_id: details.bot_id,
            owner_agent_id: details.owner_agent_id,
            deployment_environment: details.deployment_environment,
            release_channel: details.release_channel,
            trace_id: traceId,
          },
          signal,
        );
      } catch (error) {
        // A Runtime completion callback may arrive just before its terminal
        // record becomes visible to the final-result reader.  Preserve that
        // bounded, expected race as a retryable public result rather than
        // leaking an internal client error as HTTP 500.
        if (
          error instanceof InternalClientError &&
          (error.status === 409 || error.status === 503)
        ) {
          throw new TriggerProcessFinalResponseErrorV1(
            "final_response_not_ready",
            true,
          );
        }
        throw error;
      }
      if (
        result.trigger_process_id !== processId ||
        result.runtime_run_id !== details.runtime_run_id ||
        result.content_type !== "text/plain"
      ) {
        throw new TriggerProcessFinalResponseErrorV1(
          "final_response_owner_mismatch",
          false,
        );
      }
      return Object.freeze({
        process_id: processId,
        runtime_run_id: result.runtime_run_id,
        content_type: "text/plain" as const,
        content: result.content,
      });
    },
  });
}
