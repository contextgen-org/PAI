import { describe, expect, it, vi } from "vitest";

import {
  InternalClientError,
  requestInternalJson,
  requestWorkloadJson,
} from "../src/index.js";

const WORKLOAD_CREDENTIAL = "header.payload.signature";
const TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736";

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
            trace_id: TRACE_ID,
          },
          503,
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ accepted: true }, 200));

    const response = await requestInternalJson<{ accepted: boolean }>({
      url: "https://service.test/internal/work",
      workloadCredential: WORKLOAD_CREDENTIAL,
      timeoutMs: 100,
      idempotent: true,
      maxRetries: 1,
      traceId: TRACE_ID,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: async () => undefined,
    });

    expect(response).toMatchObject({ body: { accepted: true }, attempts: 2 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0]?.[1]?.headers).toMatchObject({
      "x-trace-id": "4bf92f3577b34da6a3ce929d0e0e4736",
    });
  });

  it("snapshots identity, managed headers, method, and body across retries", async () => {
    let finishFirst!: (response: Response) => void;
    const firstResponse = new Promise<Response>((resolve) => {
      finishFirst = resolve;
    });
    const fetchImpl = vi
      .fn()
      .mockImplementationOnce(async () => firstResponse)
      .mockResolvedValueOnce(jsonResponse({ accepted: true }, 200));
    const originalHeaders: Record<string, string> = { "x-client": "original" };
    const originalBody = { action: "original" };
    const mutableRequest: Record<string, unknown> = {
      url: "https://service.test/internal/work",
      method: "POST",
      headers: originalHeaders,
      workloadCredential: WORKLOAD_CREDENTIAL,
      json: originalBody,
      timeoutMs: 1_000,
      idempotent: true,
      maxRetries: 1,
      traceId: TRACE_ID,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: async () => undefined,
    };

    const pending = requestInternalJson<{ accepted: boolean }>(
      mutableRequest as never,
    );
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    originalHeaders["x-client"] = "mutated";
    originalHeaders.authorization = "Bearer attacker";
    originalBody.action = "mutated";
    mutableRequest.method = "DELETE";
    mutableRequest.workloadCredential = "attacker.payload.signature";
    finishFirst(
      jsonResponse(
        {
          code: "dependency_unavailable",
          message: "try later",
          retryable: true,
          details: {},
          trace_id: TRACE_ID,
        },
        503,
      ),
    );

    await expect(pending).resolves.toMatchObject({ attempts: 2 });
    for (const call of fetchImpl.mock.calls) {
      const init = call[1] as RequestInit;
      expect(init.method).toBe("POST");
      expect(init.body).toBe('{"action":"original"}');
      expect(init.headers).toMatchObject({
        authorization: `Bearer ${WORKLOAD_CREDENTIAL}`,
        "x-client": "original",
      });
    }
  });

  it("rejects accessor-backed request options and headers without invoking them", async () => {
    let optionGetterCalls = 0;
    const request = {
      url: "https://service.test/internal/work",
      workloadCredential: WORKLOAD_CREDENTIAL,
      timeoutMs: 100,
    } as Record<string, unknown>;
    Object.defineProperty(request, "workloadCredential", {
      configurable: true,
      enumerable: true,
      get() {
        optionGetterCalls += 1;
        return WORKLOAD_CREDENTIAL;
      },
    });
    await expect(requestInternalJson(request as never)).rejects.toThrow(
      "own data properties",
    );
    expect(optionGetterCalls).toBe(0);

    let headerGetterCalls = 0;
    const headers: Record<string, string> = {};
    Object.defineProperty(headers, "x-client", {
      configurable: true,
      enumerable: true,
      get() {
        headerGetterCalls += 1;
        return "safe";
      },
    });
    await expect(
      requestInternalJson({
        url: "https://service.test/internal/work",
        workloadCredential: WORKLOAD_CREDENTIAL,
        headers,
        timeoutMs: 100,
      }),
    ).rejects.toThrow("own string data properties");
    expect(headerGetterCalls).toBe(0);

    let optionProxyTrapCalls = 0;
    const proxyRequest = new Proxy(
      {
        url: "https://service.test/internal/work",
        workloadCredential: WORKLOAD_CREDENTIAL,
        timeoutMs: 100,
      },
      {
        getOwnPropertyDescriptor() {
          optionProxyTrapCalls += 1;
          throw new Error("proxy trap must not run");
        },
        getPrototypeOf() {
          optionProxyTrapCalls += 1;
          throw new Error("proxy trap must not run");
        },
        ownKeys() {
          optionProxyTrapCalls += 1;
          throw new Error("proxy trap must not run");
        },
      },
    );
    await expect(requestInternalJson(proxyRequest as never)).rejects.toThrow(
      "own data properties",
    );
    expect(optionProxyTrapCalls).toBe(0);
  });

  it("preflights outbound JSON before recursive serialization or network I/O", async () => {
    const fetchImpl = vi.fn();
    let getterCalls = 0;
    const accessorBody: Record<string, unknown> = {};
    Object.defineProperty(accessorBody, "secret", {
      configurable: true,
      enumerable: true,
      get() {
        getterCalls += 1;
        return "must-not-run";
      },
    });

    await expect(
      requestInternalJson({
        url: "https://service.test/internal/work",
        workloadCredential: WORKLOAD_CREDENTIAL,
        method: "POST",
        json: accessorBody,
        timeoutMs: 100,
        traceId: TRACE_ID,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow();
    expect(getterCalls).toBe(0);

    let proxyTrapCalls = 0;
    const proxyBody = new Proxy(
      { action: "must-not-read" },
      {
        getOwnPropertyDescriptor() {
          proxyTrapCalls += 1;
          throw new Error("proxy trap must not run");
        },
        ownKeys() {
          proxyTrapCalls += 1;
          throw new Error("proxy trap must not run");
        },
      },
    );
    await expect(
      requestInternalJson({
        url: "https://service.test/internal/work",
        workloadCredential: WORKLOAD_CREDENTIAL,
        method: "POST",
        json: proxyBody,
        timeoutMs: 100,
        traceId: TRACE_ID,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow();
    expect(proxyTrapCalls).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not retry non-idempotent requests by default", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          code: "dependency_unavailable",
          message: "try later",
          retryable: true,
          details: {},
          trace_id: TRACE_ID,
        },
        503,
      ),
    );

    await expect(
      requestInternalJson({
        url: "https://service.test/internal/work",
        workloadCredential: WORKLOAD_CREDENTIAL,
        method: "POST",
        json: { action: "create" },
        timeoutMs: 100,
        traceId: TRACE_ID,
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
        url: "https://service.test/internal/work",
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
        url: "https://service.test/internal/work",
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
        url: "https://service.test/internal/work",
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
        url: "https://service.test/internal/work",
        timeoutMs: 100,
      }),
    ).rejects.toThrow("workloadCredential is required");

    await expect(
      requestInternalJson({
        url: "https://service.test/internal/work",
        headers: { Authorization: "Bearer raw-user-token" },
        workloadCredential: WORKLOAD_CREDENTIAL,
        timeoutMs: 100,
      }),
    ).rejects.toThrow("protocol-owned headers");
  });

  it("treats the exact /internal route as protected", async () => {
    await expect(
      requestInternalJson({
        url: "https://service.test/internal",
        timeoutMs: 100,
      }),
    ).rejects.toThrow("workloadCredential is required");
  });

  it("sends the workload credential only to internal routes", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ accepted: true }, 200));
    await requestInternalJson({
      url: "https://service.test/internal/work",
      workloadCredential: WORKLOAD_CREDENTIAL,
      timeoutMs: 100,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(fetchImpl.mock.calls[0]?.[1]?.headers).toMatchObject({
      authorization: `Bearer ${WORKLOAD_CREDENTIAL}`,
    });

    await expect(
      requestInternalJson({
        url: "https://service.test/v1/public",
        workloadCredential: WORKLOAD_CREDENTIAL,
        timeoutMs: 100,
      }),
    ).rejects.toThrow("only be sent to /internal/**");
  });

  it("sends workload credentials to versioned mixed-ingress API routes only", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ accepted: true }, 200));
    await requestWorkloadJson({
      url: "https://service.test/v1/work",
      workloadCredential: WORKLOAD_CREDENTIAL,
      timeoutMs: 100,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(fetchImpl.mock.calls[0]?.[1]?.headers).toMatchObject({
      authorization: `Bearer ${WORKLOAD_CREDENTIAL}`,
    });

    await expect(
      requestWorkloadJson({
        url: "https://service.test/internal/work",
        workloadCredential: WORKLOAD_CREDENTIAL,
        timeoutMs: 100,
      }),
    ).rejects.toThrow("only be sent to /v1/**");
    await expect(
      requestWorkloadJson({
        url: "https://service.test/v1/work",
        timeoutMs: 100,
      }),
    ).rejects.toThrow("workloadCredential is required");
  });

  it("refuses redirects without forwarding the workload credential", async () => {
    const fetchImpl = vi.fn().mockImplementation(
      async (_url: string | URL | Request, init?: RequestInit) => {
        expect(init?.redirect).toBe("manual");
        return new Response(undefined, {
          status: 302,
          headers: { location: "/public" },
        });
      },
    );

    await expect(
      requestInternalJson({
        url: "https://service.test/internal/work",
        workloadCredential: WORKLOAD_CREDENTIAL,
        timeoutMs: 100,
        idempotent: true,
        maxRetries: 2,
        fetchImpl: fetchImpl as unknown as typeof fetch,
        sleep: async () => undefined,
      }),
    ).rejects.toMatchObject<Partial<InternalClientError>>({
      code: "redirect_rejected",
      retryable: false,
      status: 302,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("rejects oversized, malformed, or trace-confused responses without retrying", async () => {
    const oversized = vi.fn().mockResolvedValue(
      new Response("{}", {
        status: 200,
        headers: { "content-length": "3" },
      }),
    );
    await expect(
      requestInternalJson({
        url: "https://service.test/internal/work",
        workloadCredential: WORKLOAD_CREDENTIAL,
        timeoutMs: 100,
        maxResponseBytes: 2,
        idempotent: true,
        maxRetries: 2,
        traceId: TRACE_ID,
        fetchImpl: oversized as unknown as typeof fetch,
        sleep: async () => undefined,
      }),
    ).rejects.toMatchObject({ code: "invalid_upstream_response", retryable: false });
    expect(oversized).toHaveBeenCalledTimes(1);

    const malformed = vi.fn().mockResolvedValue(
      new Response("not-json", { status: 200 }),
    );
    await expect(
      requestInternalJson({
        url: "https://service.test/internal/work",
        workloadCredential: WORKLOAD_CREDENTIAL,
        timeoutMs: 100,
        traceId: TRACE_ID,
        fetchImpl: malformed as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ code: "invalid_upstream_response" });

    const confusedTrace = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          code: "dependency_unavailable",
          message: "try later",
          retryable: true,
          details: {},
          trace_id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
        503,
      ),
    );
    await expect(
      requestInternalJson({
        url: "https://service.test/internal/work",
        workloadCredential: WORKLOAD_CREDENTIAL,
        timeoutMs: 100,
        idempotent: true,
        maxRetries: 2,
        traceId: TRACE_ID,
        fetchImpl: confusedTrace as unknown as typeof fetch,
        sleep: async () => undefined,
      }),
    ).rejects.toMatchObject({ code: "invalid_upstream_error", retryable: false });
    expect(confusedTrace).toHaveBeenCalledTimes(1);
  });

  it("rejects an over-deep upstream JSON graph before response schema traversal", async () => {
    let deep: Record<string, unknown> = { accepted: true };
    for (let depth = 0; depth < 129; depth += 1) {
      deep = { next: deep };
    }
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(deep), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(
      requestInternalJson({
        url: "https://service.test/internal/work",
        workloadCredential: WORKLOAD_CREDENTIAL,
        timeoutMs: 100,
        traceId: TRACE_ID,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({
      code: "invalid_upstream_response",
      retryable: false,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("rejects URL userinfo and generic credential-bearing headers", async () => {
    await expect(
      requestInternalJson({
        url: "https://user:secret@service.test/internal/work",
        workloadCredential: WORKLOAD_CREDENTIAL,
        timeoutMs: 100,
      }),
    ).rejects.toThrow("cannot contain userinfo");
    await expect(
      requestInternalJson({
        url: "https://service.test/internal/work",
        workloadCredential: WORKLOAD_CREDENTIAL,
        headers: { cookie: "session=secret" },
        timeoutMs: 100,
      }),
    ).rejects.toThrow("protocol-owned headers");
    await expect(
      requestInternalJson({
        url: "https://service.test/internal/work",
        workloadCredential: WORKLOAD_CREDENTIAL,
        headers: { traceparent: `00-${TRACE_ID}-00f067aa0ba902b7-01` },
        timeoutMs: 100,
      }),
    ).rejects.toThrow("protocol-owned headers");
    for (const headers of [
      { host: "attacker.invalid" },
      { forwarded: "host=attacker.invalid;proto=http" },
      { "x-forwarded-host": "attacker.invalid" },
      { "x-forwarded-client-cert": "By=spiffe://attacker.invalid" },
      { "x-forwarded-prefix": "/admin" },
      { "x-original-url": "/internal/admin" },
      { "x-http-method-override": "DELETE" },
      { "x-real-ip": "203.0.113.1" },
      { "cf-connecting-ip": "203.0.113.2" },
      { "content-length": "0" },
    ]) {
      await expect(
        requestInternalJson({
          url: "https://service.test/internal/work",
          workloadCredential: WORKLOAD_CREDENTIAL,
          headers,
          timeoutMs: 100,
        }),
      ).rejects.toThrow("protocol-owned headers");
    }
  });

  it("does not send internal bearer credentials over non-loopback HTTP", async () => {
    await expect(
      requestInternalJson({
        url: "http://service.test/internal/work",
        workloadCredential: WORKLOAD_CREDENTIAL,
        timeoutMs: 100,
      }),
    ).rejects.toThrow("HTTPS except for loopback");
  });

  it("permits only the fixed local Docker origins after explicit local opt-in", async () => {
    vi.stubEnv("PAI_DEPLOYMENT_ENVIRONMENT", "local");
    vi.stubEnv("PAI_LOCAL_DOCKER_TRANSPORT", "true");
    try {
      const fetchImpl = vi.fn<typeof fetch>(async () =>
        jsonResponse({ accepted: true }, 200),
      );
      await expect(
        requestInternalJson({
          url: "http://trigger-processor:3001/internal/work",
          workloadCredential: WORKLOAD_CREDENTIAL,
          timeoutMs: 100,
          fetchImpl,
        }),
      ).resolves.toMatchObject({ body: { accepted: true }, status: 200 });
      await expect(
        requestInternalJson({
          url: "http://jwks:8080/internal/work",
          workloadCredential: WORKLOAD_CREDENTIAL,
          timeoutMs: 100,
          fetchImpl,
        }),
      ).resolves.toMatchObject({ body: { accepted: true }, status: 200 });
      await expect(
        requestInternalJson({
          url: "http://outside.example/internal/work",
          workloadCredential: WORKLOAD_CREDENTIAL,
          timeoutMs: 100,
        }),
      ).rejects.toThrow("HTTPS except for loopback");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("propagates caller abort and does not retry an interrupted request", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(init.signal?.reason),
          { once: true },
        );
      });
    });
    const request = requestInternalJson({
      url: "https://service.test/internal/work",
      workloadCredential: WORKLOAD_CREDENTIAL,
      timeoutMs: 10_000,
      idempotent: true,
      maxRetries: 2,
      traceId: TRACE_ID,
      signal: controller.signal,
      fetchImpl,
    });
    controller.abort(new Error("caller stopped"));
    await expect(request).rejects.toMatchObject({
      code: "upstream_aborted",
      retryable: false,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
