import {
  RuntimePreemptContractV1Schema,
  TriggerProcessorControlTokenV1Schema,
} from "@pai/contracts";
import { Value } from "@sinclair/typebox/value";
import {
  exportJWK,
  generateKeyPair,
  jwtVerify,
  createLocalJWKSet,
} from "jose";
import { describe, expect, it } from "vitest";

import { createRuntimeControlTokenSignerV1 } from "../src/application/runtime-control-token-signer.v1.js";

const nowMs = Date.parse("2026-07-27T01:00:00.000Z");

async function fixture() {
  const pair = await generateKeyPair("Ed25519", { extractable: true });
  const publicJwk = await exportJWK(pair.publicKey);
  const signer = createRuntimeControlTokenSignerV1({
    private_key: pair.privateKey,
    key_id: "runtime-control-1",
    algorithm: "EdDSA",
    now: () => nowMs,
    generate_jti: () => "control-token-1",
  });
  const getKey = createLocalJWKSet({
    keys: [{ ...publicJwk, kid: "runtime-control-1", alg: "EdDSA", use: "sig" }],
  });
  return { signer, getKey };
}

describe("Trigger Processor runtime control token signer", () => {
  it("issues a stop-only token bound to the owner run until policy expiry plus 15 minutes", async () => {
    const { signer, getKey } = await fixture();
    const signed = await signer.sign({
      trigger_process_id: `process-${"p".repeat(180)}`,
      runtime_run_id: `run-${"r".repeat(180)}`,
      bot_id: `bot-${"b".repeat(120)}`,
      token_version: 7,
      policy_expires_at: "2026-07-27T01:30:00.000Z",
    });

    expect(signed.control_valid_until).toBe("2026-07-27T01:45:00.000Z");
    // Owner-bound asymmetric tokens can legitimately exceed the generic
    // identifier limit, but must remain inside the dedicated token bound.
    expect(signed.token.length).toBeGreaterThan(512);
    expect(signed.token.length).toBeLessThanOrEqual(8_192);
    const verified = await jwtVerify(signed.token, getKey, {
      issuer: "pai-runtime-control",
      audience: "action_runtime",
      subject: "trigger_processor",
      algorithms: ["EdDSA"],
      currentDate: new Date(nowMs),
    });
    expect(verified.payload).toMatchObject({
      trigger_process_id: `process-${"p".repeat(180)}`,
      runtime_run_id: `run-${"r".repeat(180)}`,
      bot_id: `bot-${"b".repeat(120)}`,
      token_version: 7,
      control_valid_until: "2026-07-27T01:45:00.000Z",
      jti: "control-token-1",
    });
  });

  it("accepts the signed JWT at both runtime start and control contract boundaries", async () => {
    const { signer } = await fixture();
    const signed = await signer.sign({
      trigger_process_id: "process-1",
      runtime_run_id: "run-1",
      bot_id: "bot-1",
      token_version: 1,
      policy_expires_at: "2026-07-27T01:30:00.000Z",
    });
    const preempt = {
      schema_version: "runtime_preempt.v1",
      runtime_signal_id: "signal-1",
      runtime_run_id: "run-1",
      trigger_process_id: "process-1",
      start_attempt_no: 1,
      preempt_token: signed.token,
      reason_code: "strong_preempt_active",
      requested_at: "2026-07-27T01:10:00.000Z",
      idempotency_key: "process-1:preempt:1",
      trace_id: "trace-1",
    };
    expect(Value.Check(RuntimePreemptContractV1Schema, preempt)).toBe(true);
    expect(Value.Check(TriggerProcessorControlTokenV1Schema, signed.token)).toBe(
      true,
    );
  });

  it("refuses to mint control authority for an expired or overlong policy", async () => {
    const { signer } = await fixture();
    await expect(
      signer.sign({
        trigger_process_id: "process-1",
        runtime_run_id: "run-1",
        bot_id: "bot-1",
        token_version: 1,
        policy_expires_at: "2026-07-27T00:59:59.000Z",
      }),
    ).rejects.toThrow(/signing request is invalid/u);
    await expect(
      signer.sign({
        trigger_process_id: "process-1",
        runtime_run_id: "run-1",
        bot_id: "bot-1",
        token_version: 1,
        policy_expires_at: "2026-07-28T01:00:01.000Z",
      }),
    ).rejects.toThrow(/signing request is invalid/u);
  });
});
