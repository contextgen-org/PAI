import type { RuntimeFinalResultReadContractV1 } from "@pai/contracts";
import { InternalClientError } from "@pai/service-kit";
import { describe, expect, it } from "vitest";

import {
  TriggerProcessFinalResponseErrorV1,
  createTriggerProcessFinalResponseApplicationV1,
} from "../src/application/process-final-response.v1.js";

const principal = {
  principal_id: "demo-user",
  actor_type: "user" as const,
  authentication_kind: "supabase_ingress" as const,
};

const processDetails = {
  runtime_run_id: "runtime-run-1",
  workspace_id: "demo-workspace",
  bot_id: "demo-bot",
  owner_agent_id: "demo-owner",
  deployment_environment: "local" as const,
  release_channel: "stable" as const,
};

function subject(
  read: () => Promise<RuntimeFinalResultReadContractV1>,
) {
  return createTriggerProcessFinalResponseApplicationV1(
    {
      async getProcess() {
        return { details: processDetails } as never;
      },
    },
    { read: async () => read() },
  );
}

describe("Trigger process final response", () => {
  it.each([409, 503])(
    "maps a transient Action Runtime %i result to final_response_not_ready",
    async (status) => {
      const application = subject(async () => {
        throw new InternalClientError({
          code: "runtime_not_completed",
          message: "runtime_not_completed",
          retryable: true,
          traceId: "11111111111111111111111111111111",
          status,
        });
      });

      await expect(
        application.read(
          principal,
          "process-1",
          "11111111111111111111111111111111",
        ),
      ).rejects.toEqual(
        expect.objectContaining({
          name: "TriggerProcessFinalResponseErrorV1",
          code: "final_response_not_ready",
          retryable: true,
        } satisfies Partial<TriggerProcessFinalResponseErrorV1>),
      );
    },
  );

  it("does not hide a non-transient Action Runtime failure", async () => {
    const error = new InternalClientError({
      code: "authorization_scope_mismatch",
      message: "authorization_scope_mismatch",
      retryable: false,
      traceId: "11111111111111111111111111111111",
      status: 403,
    });
    const application = subject(async () => {
      throw error;
    });

    await expect(
      application.read(principal, "process-1", "11111111111111111111111111111111"),
    ).rejects.toBe(error);
  });
});
