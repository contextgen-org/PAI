import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { validateWorkloadCredentialClaimsV1 } from "../src/index.js";

const packageRoot = fileURLToPath(new URL("../", import.meta.url));

async function fixture(relativePath: string): Promise<Record<string, unknown>> {
  return JSON.parse(
    await readFile(resolve(packageRoot, relativePath), "utf8"),
  ) as Record<string, unknown>;
}

describe("generated auth fixtures", () => {
  it("keeps every declared positive and negative workload case aligned with the canonical validator", async () => {
    const cases = await fixture(
      "generated/fixtures/auth/workload-credential-claims.v1.json",
    );
    for (const [name, value] of Object.entries(cases)) {
      expect(validateWorkloadCredentialClaimsV1(value).ok, name).toBe(
        name.startsWith("valid_"),
      );
    }
  });

  it("keeps delegated principal fixture polarity aligned with signed workload scope validation", async () => {
    const workloadCases = await fixture(
      "generated/fixtures/auth/workload-credential-claims.v1.json",
    );
    const delegatedCases = await fixture(
      "generated/fixtures/auth/delegated-principal-context.v1.json",
    );
    const base = workloadCases.valid_bot_scope as Record<string, unknown>;

    for (const [name, delegatedPrincipal] of Object.entries(delegatedCases)) {
      expect(
        validateWorkloadCredentialClaimsV1({
          ...base,
          delegated_principal: delegatedPrincipal,
        }).ok,
        name,
      ).toBe(name.startsWith("valid_"));
    }
  });
});
