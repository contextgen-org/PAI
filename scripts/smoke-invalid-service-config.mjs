import { spawn } from "node:child_process";
import { once } from "node:events";
import { resolve } from "node:path";

const workspaceRoot = resolve(import.meta.dirname, "..");
const child = spawn(
  process.execPath,
  [resolve(workspaceRoot, "services/trigger-processor/dist/main.js")],
  {
    cwd: workspaceRoot,
    env: {
      ...process.env,
      PORT: "3001junk",
      PAI_LOG_LEVEL: "silent",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
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
      reject(new Error("invalid configuration did not stop startup"));
    }, 2_000);
  }),
]).finally(() => clearTimeout(deadlineTimer));

if (exitCode === 0 || signal !== null || !output.includes("PORT must be an integer")) {
  throw new Error(
    `invalid configuration produced an unexpected exit: code=${exitCode}, signal=${signal}\n${output}`,
  );
}
console.log(
  JSON.stringify({ service_id: "trigger_processor", invalid_config: "PORT", exit_code: exitCode }),
);
