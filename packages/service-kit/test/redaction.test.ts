import { describe, expect, it } from "vitest";

import {
  createServiceApp,
  REDACTED_VALUE,
  redactSensitiveValue,
} from "../src/index.js";

describe("structured log redaction", () => {
  it("removes header, token, prompt, tool and object payload secrets", () => {
    const redacted = redactSensitiveValue({
      req: {
        headers: {
          authorization: "Bearer header-secret",
          cookie: "session=cookie-secret",
        },
      },
      runtime: { token: "runtime-secret" },
      provider_secret: "provider-secret",
      prompt: "prompt-secret",
      tool_arguments: { query: "tool-secret" },
      object_content: "object-secret",
      safe: { event: "runtime.started" },
    });
    const serialized = JSON.stringify(redacted);

    for (const secret of [
      "header-secret",
      "cookie-secret",
      "runtime-secret",
      "provider-secret",
      "prompt-secret",
      "tool-secret",
      "object-secret",
    ]) {
      expect(serialized).not.toContain(secret);
    }
    expect(serialized).toContain(REDACTED_VALUE);
    expect(serialized).toContain("runtime.started");
  });

  it("redacts JWT-shaped values even under an innocuous key", () => {
    const redacted = redactSensitiveValue({
      note: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature",
    });
    expect(redacted).toEqual({ note: REDACTED_VALUE });
  });

  it("normalizes camelCase and acronym-style secret keys before matching", () => {
    expect(
      redactSensitiveValue({
        accessToken: "opaque-access-token",
        refreshToken: "opaque-refresh-token",
        clientSecret: "opaque-client-secret",
        privateKey: "opaque-private-key",
        APIKey: "opaque-api-key",
        toolArguments: { command: "sensitive-command" },
        objectContent: "raw-object-content",
      }),
    ).toEqual({
      accessToken: REDACTED_VALUE,
      refreshToken: REDACTED_VALUE,
      clientSecret: REDACTED_VALUE,
      privateKey: REDACTED_VALUE,
      APIKey: REDACTED_VALUE,
      toolArguments: REDACTED_VALUE,
      objectContent: REDACTED_VALUE,
    });
  });

  it("redacts nested values in the actual Fastify logger pipeline", async () => {
    const output: string[] = [];
    const app = createServiceApp("action_runtime", {
      logger: true,
      loggerStream: {
        write(line) {
          output.push(line);
        },
      },
    });

    app.log.info(
      {
        runtime: { token: "runtime-pipeline-secret" },
        provider_secret: "provider-pipeline-secret",
        nested: { authorization: "Bearer authorization-pipeline-secret" },
        safe: "runtime.started",
      },
      "pipeline redaction",
    );
    app.log
      .child({ nested: { token: "child-binding-secret" } })
      .info("child binding redaction");
    await app.close();

    const serialized = output.join("\n");
    expect(serialized).not.toContain("runtime-pipeline-secret");
    expect(serialized).not.toContain("provider-pipeline-secret");
    expect(serialized).not.toContain("authorization-pipeline-secret");
    expect(serialized).not.toContain("child-binding-secret");
    expect(serialized).toContain(REDACTED_VALUE);
    expect(serialized).toContain("runtime.started");
  });

  it("redacts ObjectStore grants, decisions, and signed URLs in the logger pipeline", async () => {
    const output: string[] = [];
    const app = createServiceApp("action_runtime", {
      logger: true,
      loggerStream: {
        write(line) {
          output.push(line);
        },
      },
    });

    app.log.info({
      result: {
        grant: "https://storage.invalid/read?token=live-grant-token",
        object_ref: "object:visible-reference",
        expires_at: "2026-07-20T01:00:00.000Z",
      },
      accessDecisionRef: "decision-live-secret",
      innocuousUrl:
        "https://storage.invalid/read?x-amz-signature=signed-query-secret",
    });
    await app.close();

    const serialized = output.join("\n");
    expect(serialized).not.toContain("live-grant-token");
    expect(serialized).not.toContain("decision-live-secret");
    expect(serialized).not.toContain("signed-query-secret");
    expect(serialized).toContain("object:visible-reference");
    expect(serialized).toContain(REDACTED_VALUE);
  });
});
