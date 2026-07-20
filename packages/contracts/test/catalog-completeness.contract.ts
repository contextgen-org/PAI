import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { SHARED_SCHEMA_CATALOG } from "../src/catalog.js";

const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const repositoryRoot = resolve(packageRoot, "../..");

const architectureSharedSummary = [
  "ResponseEnvelopeV1",
  "TypedEvidenceRefV1",
  "ConflictPolicyV1",
  "DirectActivePolicyV1",
  "ServiceIdV1",
  "DeploymentEnvironmentV1",
  "ReleaseChannelV1",
  "WorkloadCredentialClaimsV1",
  "DelegatedPrincipalContextV1",
].sort();

describe("Shared Architecture Contracts catalog", () => {
  it("matches the parent architecture shared summary exactly", () => {
    expect(SHARED_SCHEMA_CATALOG.map((entry) => entry.schema_name).sort()).toEqual(
      architectureSharedSummary,
    );
  });

  it("contains all seven mandatory catalog columns", () => {
    for (const entry of SHARED_SCHEMA_CATALOG) {
      expect(entry.schema_name).not.toHaveLength(0);
      expect(entry.schema_id).toBe(entry.schema.$id);
      expect(entry.version).toBe("1.0.0");
      expect(entry.owner_service).toBe("architecture-contracts");
      expect(entry.source_file).not.toHaveLength(0);
      expect(entry.generated_outputs.length).toBeGreaterThan(0);
      expect(entry.contract_tests.length).toBeGreaterThan(0);
      expect(existsSync(resolve(repositoryRoot, entry.source_file))).toBe(true);
      for (const output of entry.generated_outputs) {
        expect(existsSync(resolve(packageRoot, output))).toBe(true);
      }
      for (const contractTest of entry.contract_tests) {
        expect(existsSync(resolve(repositoryRoot, contractTest))).toBe(true);
      }
    }
  });
});
