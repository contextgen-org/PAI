import {
  TriggerProcessCancelCommandV1Schema,
  TriggerProcessCancelRequestV1Schema,
} from "@pai/contracts";
import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { canonicalCancellationRequestHashV1 } from "../../src/application/process-control.v1.js";

describe("Trigger Process cancel request contract", () => {
  it("keeps caller input minimal and binds the hash to path and authenticated actor", () => {
    expect(
      Value.Check(TriggerProcessCancelRequestV1Schema, {
        idempotency_key: "cancel-1",
        reason: "user_requested",
      }),
    ).toBe(true);
    expect(
      Value.Check(TriggerProcessCancelRequestV1Schema, {
        idempotency_key: "cancel-1",
        reason: "user_requested",
        trigger_process_id: "caller-selected",
      }),
    ).toBe(false);
    const command = {
      schema_version: "trigger_process_cancel_command.v1",
      trigger_process_id: "process-1",
      idempotency_key: "cancel-1",
      normalized_reason: "user_requested",
      authenticated_principal_id: "user-1",
      authenticated_role: "user",
      trace_id: "trace-1",
      request_hash: canonicalCancellationRequestHashV1({
        trigger_process_id: "process-1",
        authenticated_principal_id: "user-1",
        authenticated_role: "user",
        normalized_reason: "user_requested",
      }),
    } as const;
    expect(Value.Check(TriggerProcessCancelCommandV1Schema, command)).toBe(true);
    expect(command.request_hash).toBe(
      canonicalCancellationRequestHashV1({
        ...command,
        idempotency_key: "different-key",
        trace_id: "different-trace",
      }),
    );
  });
});
