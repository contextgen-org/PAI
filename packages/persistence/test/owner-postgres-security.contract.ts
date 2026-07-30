import { describe, expect, it } from "vitest";

import {
  assertOwnerPostgresTransportSecurityV1,
  openVerifiedOwnerPostgresCompositionV1,
} from "../src/index.js";

describe("verified owner PostgreSQL transport security", () => {
  it.each([
    "postgresql://runtime:secret@127.0.0.1:5432/pai",
    "postgresql://runtime:secret@127.255.255.254:5432/pai?sslmode=disable",
    "postgresql://runtime:secret@[::1]:5432/pai",
    "postgresql://runtime:secret@localhost:5432/pai",
    "postgresql://runtime:secret@/pai?host=%2Fvar%2Frun%2Fpostgresql",
    "socket:/var/run/postgresql?db=pai",
    "/var/run/postgresql pai",
  ])("permits an explicit loopback or Unix socket DSN: %s", (databaseUrl) => {
    expect(assertOwnerPostgresTransportSecurityV1(databaseUrl)).toBe("local");
  });

  it("permits only the explicitly opted-in local Docker postgres service", () => {
    const databaseUrl = "postgresql://runtime:secret@postgres:5432/pai";
    expect(() => assertOwnerPostgresTransportSecurityV1(databaseUrl)).toThrow(
      /requires sslmode=verify-full/u,
    );
    expect(
      assertOwnerPostgresTransportSecurityV1(databaseUrl, {
        allow_local_docker_postgres: true,
      }),
    ).toBe("local");
    expect(() =>
      assertOwnerPostgresTransportSecurityV1(
        "postgresql://runtime:secret@postgres.example/pai",
        { allow_local_docker_postgres: true },
      )
    ).toThrow(/requires sslmode=verify-full/u);
  });

  it.each([
    "postgresql://runtime:secret@db.internal/pai",
    "postgresql://runtime:secret@db.internal/pai?sslmode=disable",
    "postgresql://runtime:secret@db.internal/pai?sslmode=allow",
    "postgresql://runtime:secret@db.internal/pai?sslmode=prefer",
    "postgresql://runtime:secret@db.internal/pai?sslmode=require",
    "postgresql://runtime:secret@db.internal/pai?sslmode=verify-ca",
    "postgresql://runtime:secret@db.internal/pai?sslmode=no-verify",
    "postgresql://runtime:secret@127.0.0.1/pai?host=db.internal&sslmode=require",
    "postgresql://runtime:secret@db.internal/pai?host=%252Fvar%252Frun%252Fpostgresql",
  ])("rejects a remote DSN without full certificate verification: %s", (databaseUrl) => {
    expect(() => assertOwnerPostgresTransportSecurityV1(databaseUrl)).toThrow(
      /requires sslmode=verify-full/u,
    );
  });

  it("accepts only one explicit verify-full mode for remote TCP", () => {
    expect(
      assertOwnerPostgresTransportSecurityV1(
        "postgresql://runtime:secret@db.internal/pai?sslmode=verify-full",
      ),
    ).toBe("tls_verified");
    expect(() =>
      assertOwnerPostgresTransportSecurityV1(
        "postgresql://runtime:secret@db.internal/pai?sslmode=verify-full&sslmode=disable",
      ),
    ).toThrow(/requires sslmode=verify-full/u);
  });

  it("fails before opening an insecure composition and never echoes credentials", async () => {
    const password = "do-not-echo-this-password";
    const attempt = openVerifiedOwnerPostgresCompositionV1(
      {} as never,
      `postgresql://runtime:${password}@db.internal/pai?sslmode=require`,
    );
    await expect(attempt).rejects.toThrow(/requires sslmode=verify-full/u);
    await attempt.catch((error: unknown) => {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain(password);
    });
  });
});
