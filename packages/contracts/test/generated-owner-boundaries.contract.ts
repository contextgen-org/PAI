import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  PENDING_OWNER_SCHEMA_GENERATION,
  SHARED_SCHEMA_CATALOG,
  TRIGGER_PROCESSOR_HTTP_OPERATIONS_V1,
  TRIGGER_PROCESSOR_SCHEMA_CATALOG,
} from "../src/catalog.js";

const packageRoot = fileURLToPath(new URL("../", import.meta.url));

async function readGenerated(relativePath: string): Promise<string> {
  return readFile(resolve(packageRoot, relativePath), "utf8");
}

describe("generated contract owner boundaries", () => {
  it("keeps Shared OpenAPI free of Trigger Processor and pending-owner schemas", async () => {
    const document = JSON.parse(
      await readGenerated("generated/openapi/shared.yaml"),
    ) as {
      paths: Record<string, unknown>;
      components: { schemas: Record<string, unknown> };
    };
    const expectedSharedSchemas = SHARED_SCHEMA_CATALOG.filter((entry) =>
      entry.generated_outputs.includes("generated/openapi/shared.yaml"),
    )
      .map((entry) => entry.schema_name)
      .sort();

    expect(document.paths).toEqual({});
    expect(Object.keys(document.components.schemas).sort()).toEqual(
      expectedSharedSchemas,
    );
    for (const entry of [
      ...TRIGGER_PROCESSOR_SCHEMA_CATALOG,
      ...PENDING_OWNER_SCHEMA_GENERATION,
    ]) {
      expect(document.components.schemas).not.toHaveProperty(entry.schema_name);
    }
  });

  it("emits Trigger Processor routes and schemas only to its internal OpenAPI", async () => {
    const document = JSON.parse(
      await readGenerated(
        "generated/openapi/trigger-processor-internal.yaml",
      ),
    ) as {
      paths: Record<string, unknown>;
      components: { schemas: Record<string, unknown> };
    };

    expect(Object.keys(document.paths).sort()).toEqual(
      TRIGGER_PROCESSOR_HTTP_OPERATIONS_V1.map((operation) => operation.path).sort(),
    );
    expect(Object.keys(document.components.schemas).sort()).toEqual(
      TRIGGER_PROCESSOR_SCHEMA_CATALOG.map((entry) => entry.schema_name).sort(),
    );
  });

  it("does not re-export the package root or Trigger Processor from Shared types", async () => {
    const sharedTypes = await readGenerated("generated/types/shared.d.ts");
    const triggerProcessorTypes = await readGenerated(
      "generated/types/trigger-processor.d.ts",
    );

    expect(sharedTypes).not.toContain("../../dist/index.js");
    expect(sharedTypes).not.toContain("trigger-processor");
    expect(triggerProcessorTypes).toContain(
      '../../dist/trigger-processor/trigger-admission.v1.js',
    );
    expect(triggerProcessorTypes).toContain(
      '../../dist/trigger-processor/trigger-process-state.v1.js',
    );
  });
});
