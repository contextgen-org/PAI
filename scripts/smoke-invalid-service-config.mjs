import { spawn } from "node:child_process";
import { once } from "node:events";
import { resolve } from "node:path";

const workspaceRoot = resolve(import.meta.dirname, "..");
const mainPath = resolve(
  workspaceRoot,
  "services/trigger-processor/dist/main.js",
);
const { PAI_DATABASE_URL: _databaseUrl, ...environmentWithoutDatabase } =
  process.env;

async function expectStartupFailure(env, expectedMessage, label) {
  const child = spawn(process.execPath, [mainPath], {
    cwd: workspaceRoot,
    env: {
      ...environmentWithoutDatabase,
      PAI_LOG_LEVEL: "silent",
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  let deadlineTimer;
  const [exitCode, signal] = await Promise.race([
    once(child, "exit"),
    new Promise((_, reject) => {
      deadlineTimer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error(`${label} did not stop startup`));
      }, 2_000);
    }),
  ]).finally(() => clearTimeout(deadlineTimer));

  if (
    exitCode === 0 ||
    signal !== null ||
    !output.includes(expectedMessage)
  ) {
    throw new Error(
      `${label} produced an unexpected exit: code=${exitCode}, signal=${signal}\n${output}`,
    );
  }
  return exitCode;
}

const invalidPortExit = await expectStartupFailure(
  {
    PORT: "3001junk",
    NODE_ENV: "development",
    PAI_DEPLOYMENT_ENVIRONMENT: "local",
  },
  "PORT must be an integer",
  "invalid configuration",
);
const missingProductionDatabaseExit = await expectStartupFailure(
  { PAI_DEPLOYMENT_ENVIRONMENT: "prod", NODE_ENV: "development" },
  "PAI_DATABASE_URL is required",
  "missing production owner database",
);

console.log(
  JSON.stringify({
    service_id: "trigger_processor",
    invalid_config: { PORT: invalidPortExit },
    missing_production_database: missingProductionDatabaseExit,
  }),
);
