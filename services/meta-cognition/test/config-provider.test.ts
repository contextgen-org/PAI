import { describe, expect, it } from "vitest";

import {
  canonicalJsonV1,
  createStructuredMetaProviderAdapterV1,
  metaCognitionConfigFromEnvironmentV1,
  parseMetaJobCreateRequestV1,
  resolveMetaCognitionConfigV1,
} from "../src/index.js";
import { createRequest, providerOutput } from "./fixtures.js";

describe("Meta Cognition configuration and provider adapter", () => {
  it("preserves prototype-looking keys and rejects invalid Unicode in canonical JSON", () => {
    const value = JSON.parse(
      '{"__proto__":{"polluted":true},"normal":1}',
    ) as unknown;
    expect(canonicalJsonV1(value)).toBe(
      '{"__proto__":{"polluted":true},"normal":1}',
    );
    expect(() => canonicalJsonV1({ value: "\ud800" })).toThrow(
      /surrogate/u,
    );

    const shared = { value: 1 };
    expect(canonicalJsonV1({ left: shared, right: shared })).toBe(
      '{"left":{"value":1},"right":{"value":1}}',
    );

    let proxyTrapCalls = 0;
    const proxied = new Proxy(
      { value: 1 },
      {
        getPrototypeOf() {
          proxyTrapCalls += 1;
          return Object.prototype;
        },
      },
    );
    expect(() => canonicalJsonV1(proxied)).toThrow(/proxy/u);
    expect(proxyTrapCalls).toBe(0);
  });

  it("applies defaults and rejects unsafe cross-constraints", () => {
    expect(resolveMetaCognitionConfigV1()).toMatchObject({
      lease_ttl_ms: 60_000,
      heartbeat_interval_ms: 20_000,
      llm_call_timeout_ms: 120_000,
      memory_write_timeout_ms: 30_000,
      knowthat_write_timeout_ms: 30_000,
      candidate_review_timeout_ms: 30_000,
      outbox_max_attempts: 10,
      retry_jitter: "full",
      max_job_attempts: 5,
      max_provider_parse_retries: 2,
      downstream_failure_mode: {
        memory: "nonblocking",
        knowthat: "blocking",
        skill: "nonblocking",
      },
    });
    expect(() =>
      resolveMetaCognitionConfigV1({
        lease_ttl_ms: 10_000,
        heartbeat_interval_ms: 5_000,
      }),
    ).toThrow(/cross-constraint/u);
    expect(() =>
      resolveMetaCognitionConfigV1({
        retry_jitter: "none",
      } as never),
    ).toThrow(/cross-constraint/u);
    expect(() =>
      resolveMetaCognitionConfigV1({
        retry_base_ms: 2_000,
        retry_max_ms: 1_000,
      }),
    ).toThrow(/cross-constraint/u);
  });

  it("parses bounded integer environment values fail-closed", () => {
    expect(
      metaCognitionConfigFromEnvironmentV1({
        PAI_META_LEASE_TTL_MS: "90000",
        PAI_META_HEARTBEAT_INTERVAL_MS: "10000",
        PAI_META_LLM_CALL_TIMEOUT_MS: "120000",
        PAI_META_MEMORY_WRITE_TIMEOUT_MS: "30000",
        PAI_META_KNOWTHAT_WRITE_TIMEOUT_MS: "30000",
        PAI_META_CANDIDATE_REVIEW_TIMEOUT_MS: "30000",
        PAI_META_OUTBOX_MAX_ATTEMPTS: "10",
      }),
    ).toMatchObject({
      lease_ttl_ms: 90_000,
      heartbeat_interval_ms: 10_000,
    });
    expect(() =>
      metaCognitionConfigFromEnvironmentV1({
        PAI_META_MAX_JOB_ATTEMPTS: "3.5",
      }),
    ).toThrow(/environment value/u);
  });

  it("retries parsing with the exact same prompt/schema/parser request", async () => {
    const requests: unknown[] = [];
    let attempt = 0;
    const adapter = createStructuredMetaProviderAdapterV1(
      {
        async complete(request) {
          requests.push(request);
          attempt += 1;
          return attempt < 3 ? "{broken-json" : JSON.stringify(providerOutput());
        },
      },
      undefined,
      {
        timeout_ms: 1_000,
        max_parse_retries: 2,
        max_output_items: 100,
        max_evidence_refs: 100,
      },
    );
    const result = await adapter.generate("same prompt");
    expect(result.schema_version).toBe("meta_provider_output.v1");
    expect(requests).toHaveLength(3);
    expect(requests[1]).toBe(requests[0]);
    expect(requests[2]).toBe(requests[0]);
    expect(requests[0]).toMatchObject({
      prompt: "same prompt",
      parser: "meta_provider_output_parser.v1",
      response_schema: {
        output_schema: "meta_provider_output.v1",
      },
    });
  });

  it("detaches and recursively freezes accepted request and provider JSON", async () => {
    const request = createRequest();
    const parsedRequest = parseMetaJobCreateRequestV1(
      request,
      new Date("2026-07-23T00:00:00.000Z"),
    );
    expect(parsedRequest).not.toBe(request);
    expect(Object.isFrozen(parsedRequest)).toBe(true);

    const output = providerOutput({
      execution_summary: {
        nested: { mutable_before_validation: true },
      },
    });
    const adapter = createStructuredMetaProviderAdapterV1(
      {
        async complete() {
          return output;
        },
      },
      undefined,
      {
        timeout_ms: 1_000,
        max_parse_retries: 0,
        max_output_items: 100,
        max_evidence_refs: 100,
      },
    );

    const accepted = await adapter.generate("prompt");
    expect(accepted.execution_summary).not.toBe(output.execution_summary);
    expect(Object.isFrozen(accepted.execution_summary)).toBe(true);
    expect(
      Object.isFrozen(
        (accepted.execution_summary as { nested: object }).nested,
      ),
    ).toBe(true);
    expect(Object.isFrozen(accepted.memory_writes[0]?.payload)).toBe(true);
    expect(
      Object.isFrozen(
        (
          accepted.memory_writes[0]?.payload as {
            source_info: object;
          }
        ).source_info,
      ),
    ).toBe(true);
  });

  it("stops after the configured finite parse retry budget", async () => {
    let calls = 0;
    const adapter = createStructuredMetaProviderAdapterV1(
      {
        async complete() {
          calls += 1;
          return "{invalid";
        },
      },
      undefined,
      {
        timeout_ms: 1_000,
        max_parse_retries: 1,
        max_output_items: 100,
        max_evidence_refs: 100,
      },
    );
    await expect(adapter.generate("prompt")).rejects.toMatchObject({
      code: "provider_invalid",
      retryable: true,
    });
    expect(calls).toBe(2);
  });

  it("bounds already-parsed provider JSON before recursive validation", async () => {
    let deeplyNested: unknown = { value: "leaf" };
    for (let depth = 0; depth < 70; depth += 1) {
      deeplyNested = { child: deeplyNested };
    }
    const adapter = createStructuredMetaProviderAdapterV1(
      {
        async complete() {
          return {
            ...providerOutput(),
            execution_summary: deeplyNested,
          };
        },
      },
      undefined,
      {
        timeout_ms: 1_000,
        max_parse_retries: 0,
        max_output_items: 100,
        max_evidence_refs: 100,
      },
    );

    await expect(adapter.generate("prompt")).rejects.toMatchObject({
      code: "provider_invalid",
    });
  });

  it("rejects accessor-bearing provider objects without invoking accessors", async () => {
    let getterCalls = 0;
    const output = { ...providerOutput() } as Record<string, unknown>;
    Object.defineProperty(output, "summary", {
      configurable: true,
      enumerable: true,
      get() {
        getterCalls += 1;
        return "must not be observed";
      },
    });
    const adapter = createStructuredMetaProviderAdapterV1(
      {
        async complete() {
          return output;
        },
      },
      undefined,
      {
        timeout_ms: 1_000,
        max_parse_retries: 0,
        max_output_items: 100,
        max_evidence_refs: 100,
      },
    );

    await expect(adapter.generate("prompt")).rejects.toMatchObject({
      code: "provider_invalid",
    });
    expect(getterCalls).toBe(0);
  });

  it("rejects proxy-backed provider objects without invoking proxy traps", async () => {
    let trapCalls = 0;
    const output = new Proxy(
      { ...providerOutput() },
      {
        ownKeys(target) {
          trapCalls += 1;
          return Reflect.ownKeys(target);
        },
      },
    );
    const adapter = createStructuredMetaProviderAdapterV1(
      {
        async complete() {
          return output;
        },
      },
      undefined,
      {
        timeout_ms: 1_000,
        max_parse_retries: 0,
        max_output_items: 100,
        max_evidence_refs: 100,
      },
    );

    await expect(adapter.generate("prompt")).rejects.toMatchObject({
      code: "provider_invalid",
    });
    expect(trapCalls).toBe(0);
  });

  it("applies the response byte budget to parsed provider objects", async () => {
    const adapter = createStructuredMetaProviderAdapterV1(
      {
        async complete() {
          return {
            ...providerOutput(),
            summary: "x".repeat(2_000),
          };
        },
      },
      undefined,
      {
        timeout_ms: 1_000,
        max_parse_retries: 0,
        max_output_items: 100,
        max_evidence_refs: 100,
        max_response_bytes: 1_024,
      },
    );

    await expect(adapter.generate("prompt")).rejects.toMatchObject({
      code: "provider_invalid",
    });
  });
});
