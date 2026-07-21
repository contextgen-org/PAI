import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  PENDING_OWNER_SCHEMA_GENERATION,
  SHARED_SCHEMA_CATALOG,
} from "../src/catalog.js";

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

  it("does not promote parent-only capabilities without an owner catalog row", () => {
    expect(
      SHARED_SCHEMA_CATALOG.some(
        (entry) => entry.schema_name === "DurableEventEnvelopeV1",
      ),
    ).toBe(false);
    expect(PENDING_OWNER_SCHEMA_GENERATION).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          schema_name: "DurableEventEnvelopeV1",
          registration_status: "pending_owner_catalog_row",
          generated_outputs: [
            "generated/schema/shared/durable-event-envelope.v1.json",
          ],
        }),
        expect.objectContaining({
          schema_name: "OwnerDurableEventEnvelopeV1",
          registration_status: "pending_owner_catalog_row",
          generated_outputs: [
            "generated/schema/shared/owner-durable-event-envelope.v1.json",
          ],
        }),
      ]),
    );
    const registeredNames = new Set(
      SHARED_SCHEMA_CATALOG.map((entry) => entry.schema_name),
    );
    for (const entry of PENDING_OWNER_SCHEMA_GENERATION) {
      expect(registeredNames.has(entry.schema_name)).toBe(false);
      expect(entry.schema_id).toBe(entry.schema.$id);
      expect(entry.version).toBe("1.0.0");
      expect(entry.registration_status).toBe("pending_owner_catalog_row");
      expect(existsSync(resolve(repositoryRoot, entry.source_file))).toBe(true);
      for (const output of entry.generated_outputs) {
        expect(existsSync(resolve(packageRoot, output))).toBe(true);
        expect(output).not.toMatch(/generated\/(?:openapi|types)\//u);
      }
      for (const contractTest of entry.contract_tests) {
        expect(existsSync(resolve(repositoryRoot, contractTest))).toBe(true);
      }
    }
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
