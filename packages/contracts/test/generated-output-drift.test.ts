import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

// The generator helper is intentionally plain ESM so generate.mjs can run it
// before package scripts compile TypeScript sources.
// @ts-expect-error JavaScript generator helpers do not publish declarations.
import { findUnexpectedGeneratedFiles } from "../scripts/generated-output-drift.mjs";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("generated output drift", () => {
  it("rejects unregistered files even when they have no extension", async () => {
    const generatedRoot = await mkdtemp(join(tmpdir(), "pai-generated-"));
    temporaryDirectories.push(generatedRoot);
    await mkdir(join(generatedRoot, "schema"), { recursive: true });
    await writeFile(join(generatedRoot, "schema", "expected.json"), "{}\n");
    await writeFile(join(generatedRoot, "stale"), "stale\n");

    await expect(
      findUnexpectedGeneratedFiles(
        generatedRoot,
        new Set(["generated/schema/expected.json"]),
      ),
    ).resolves.toEqual(["generated/stale"]);
  });
});
