import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const workspaceRoot = path.resolve(import.meta.dirname, "..");
const infraRoot = path.resolve(
  process.env.PAI_INFRA_REPO ?? path.join(workspaceRoot, "..", "pai-infra"),
);
const runtimeCompose = path.join(infraRoot, "deploy", "docker-compose.runtime.yml");
const validationCompose = path.join(infraRoot, "docker-compose.validation.yml");
const environmentFile = path.resolve(
  process.env.PAI_RUNTIME_ENV_FILE ?? path.join(infraRoot, ".env"),
);

for (const requiredPath of [infraRoot, validationCompose, runtimeCompose, environmentFile]) {
  if (!existsSync(requiredPath)) {
    throw new Error(`required runtime deployment path is missing: ${requiredPath}`);
  }
}

const environmentText = readFileSync(environmentFile, "utf8");
if (/^\s*[A-Z][A-Z0-9_]*\s*=.*(?:CHANGE_ME|<[^>]+>)/mu.test(environmentText)) {
  throw new Error(
    "runtime environment contains an unresolved placeholder; copy runtime.env.example and replace every CHANGE_ME value",
  );
}

const requested = process.argv.slice(2);
const command = requested.length === 0
  ? ["up", "--build", "--remove-orphans"]
  : requested;
const result = spawnSync(
  "docker",
  [
    "compose",
    "--project-directory",
    infraRoot,
    "--env-file",
    environmentFile,
    "-f",
    validationCompose,
    "-f",
    runtimeCompose,
    "--profile",
    "object-store",
    ...command,
  ],
  { cwd: workspaceRoot, stdio: "inherit", env: process.env },
);

if (result.error !== undefined) throw result.error;
process.exitCode = result.status ?? 1;
