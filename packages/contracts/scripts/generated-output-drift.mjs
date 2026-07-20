import { readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";

export async function findUnexpectedGeneratedFiles(
  generatedRoot,
  expectedOutputs,
) {
  const unexpectedOutputs = [];
  const existingOutputs = await readdir(generatedRoot, { recursive: true });
  for (const output of existingOutputs) {
    const outputStats = await stat(resolve(generatedRoot, output));
    if (!outputStats.isFile()) continue;

    const relativePath = `generated/${output}`;
    if (!expectedOutputs.has(relativePath)) unexpectedOutputs.push(relativePath);
  }
  return unexpectedOutputs.sort();
}
