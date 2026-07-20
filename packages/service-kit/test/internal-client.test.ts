import { describe, expect, it, vi } from "vitest";

import {
  InternalClientError,
  requestInternalJson,
} from "../src/index.js";

const WORKLOAD_CREDENTIAL = "header.payload.signature";

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("internal JSON client", () => {
  it("retries a declared idempotent request only when owner says retryable", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            code: "dependency_unavailable",
            message: "try later",
            retryable: true,
            details: {},
            trace_id: "upstream-trace",
          },
          503,
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ accepted: true }, 200));

    const response = await requestInternalJson<{ accepted: boolean }>({
      url: "http://service.test/internal/work",
      workloadCredential: WORKLOAD_CREDENTIAL,
      timeoutMs: 100,
      idempotent: true,
      maxRetries: 1,
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: async () => undefined,
    });

    expect(response).toMatchObject({ body: { accepted: true }, attempts: 2 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0]?.[1]?.headers).toMatchObject({
      "x-trace-id": "4bf92f3577b34da6a3ce929d0e0e4736",
    });
  });

  it("does not retry non-idempotent requests by default", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          code: "dependency_unavailable",
          message: "try later",
          retryable: true,
          details: {},
          trace_id: "upstream-trace",
        },
        503,
      ),
    );

    await expect(
      requestInternalJson({
        url: "http://service.test/internal/work",
        workloadCredential: WORKLOAD_CREDENTIAL,
        method: "POST",
        json: { action: "create" },
        timeoutMs: 100,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject<Partial<InternalClientError>>({
      code: "dependency_unavailable",
      retryable: true,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("rejects retry configuration on a non-idempotent request", async () => {
    await expect(
      requestInternalJson({
        url: "http://service.test/internal/work",
        workloadCredential: WORKLOAD_CREDENTIAL,
        timeoutMs: 100,
        maxRetries: 1,
      }),
    ).rejects.toThrow("non-idempotent requests cannot enable retries");
  });

  it("does not infer retryability from HTTP status", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: "unavailable" }, 503));

    await expect(
      requestInternalJson({
        url: "http://service.test/internal/work",
        workloadCredential: WORKLOAD_CREDENTIAL,
        timeoutMs: 100,
        idempotent: true,
        maxRetries: 2,
        fetchImpl: fetchImpl as unknown as typeof fetch,
        sleep: async () => undefined,
      }),
    ).rejects.toMatchObject({
      code: "invalid_upstream_error",
      retryable: false,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("rejects schema-invalid upstream envelopes without retrying", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          code: "",
          message: "",
          retryable: true,
          details: {},
          trace_id: "upstream-trace",
          extra: "not-allowed",
        },
        503,
      ),
    );

    await expect(
      requestInternalJson({
        url: "http://service.test/internal/work",
        workloadCredential: WORKLOAD_CREDENTIAL,
        timeoutMs: 100,
        idempotent: true,
        maxRetries: 2,
        fetchImpl: fetchImpl as unknown as typeof fetch,
        sleep: async () => undefined,
      }),
    ).rejects.toMatchObject({
      code: "invalid_upstream_error",
      retryable: false,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("requires workload credentials and owns the Authorization header", async () => {
    await expect(
      requestInternalJson({
        url: "http://service.test/internal/work",
        timeoutMs: 100,
      }),
    ).rejects.toThrow("workloadCredential is required");

    await expect(
      requestInternalJson({
        url: "http://service.test/internal/work",
        headers: { Authorization: "Bearer raw-user-token" },
        workloadCredential: WORKLOAD_CREDENTIAL,
        timeoutMs: 100,
      }),
    ).rejects.toThrow("must be supplied as workloadCredential");
  });

  it("sends the workload credential only to internal routes", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ accepted: true }, 200));
    await requestInternalJson({
      url: "http://service.test/internal/work",
      workloadCredential: WORKLOAD_CREDENTIAL,
      timeoutMs: 100,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(fetchImpl.mock.calls[0]?.[1]?.headers).toMatchObject({
      authorization: `Bearer ${WORKLOAD_CREDENTIAL}`,
    });

    await expect(
      requestInternalJson({
        url: "http://service.test/v1/public",
        workloadCredential: WORKLOAD_CREDENTIAL,
        timeoutMs: 100,
      }),
    ).rejects.toThrow("only be sent to /internal/**");
  });
});
