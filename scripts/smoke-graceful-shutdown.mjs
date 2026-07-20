import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";
import { resolve } from "node:path";

const workspaceRoot = resolve(import.meta.dirname, "..");

async function reservePort() {
  const server = createServer();
  server.unref();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("failed to reserve an IPv4 test port");
  }
  const port = address.port;
  server.close();
  await once(server, "close");
  return port;
}

async function waitUntilReady(url, child) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error("service exited before readiness");
    try {
      const response = await fetch(url);
      if (response.status === 200) return;
    } catch {
      // The listener may not be bound yet.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 25));
  }
  throw new Error("service did not become ready within 5 seconds");
}

async function waitForExit(child, timeoutMs, message) {
  let deadlineTimer;
  return Promise.race([
    once(child, "exit"),
    new Promise((_, reject) => {
      deadlineTimer = setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]).finally(() => clearTimeout(deadlineTimer));
}

const port = await reservePort();
const child = spawn(
  process.execPath,
  [resolve(workspaceRoot, "services/trigger-processor/dist/main.js")],
  {
    cwd: workspaceRoot,
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      PAI_LOG_LEVEL: "silent",
      PAI_SHUTDOWN_GRACE_MS: "2000",
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

try {
  await waitUntilReady(`http://127.0.0.1:${port}/ready`, child);
  const signalAt = performance.now();
  child.kill("SIGTERM");
  const exit = await waitForExit(
    child,
    3_000,
    "SIGTERM shutdown exceeded 3 seconds",
  );
  const [exitCode, signal] = exit;
  const elapsedMs = Math.round(performance.now() - signalAt);
  if (exitCode !== 0 || signal !== null) {
    throw new Error(`unexpected exit: code=${exitCode}, signal=${signal}\n${output}`);
  }
  console.log(
    JSON.stringify({ service_id: "trigger_processor", signal: "SIGTERM", exit_code: 0, elapsed_ms: elapsedMs }),
  );
} catch (error) {
  if (child.exitCode === null) child.kill("SIGKILL");
  throw error;
}


const forcedScript = String.raw`
  import { createServiceApp, installSignalHandlers } from "./packages/service-kit/dist/index.js";
  const app = createServiceApp("trigger_processor", { logger: false });
  app.addHook("onClose", async () => new Promise(() => undefined));
  await app.listen({ host: "127.0.0.1", port: 0 });
  installSignalHandlers(app, { shutdown_grace_ms: 1000 });
  console.log("forced-shutdown-ready");
`;
const forcedChild = spawn(
  process.execPath,
  ["--input-type=module", "--eval", forcedScript],
  {
    cwd: workspaceRoot,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let forcedOutput = "";
forcedChild.stdout.on("data", (chunk) => {
  forcedOutput += chunk.toString();
});
forcedChild.stderr.on("data", (chunk) => {
  forcedOutput += chunk.toString();
});

try {
  const readyDeadline = Date.now() + 3_000;
  while (!forcedOutput.includes("forced-shutdown-ready")) {
    if (forcedChild.exitCode !== null) {
      throw new Error(`forced child exited before readiness\n${forcedOutput}`);
    }
    if (Date.now() >= readyDeadline) {
      throw new Error(`forced child did not become ready\n${forcedOutput}`);
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 10));
  }

  const signalAt = performance.now();
  forcedChild.kill("SIGTERM");
  const [exitCode, signal] = await waitForExit(
    forcedChild,
    2_500,
    "forced SIGTERM path exceeded 2.5 seconds",
  );
  const elapsedMs = Math.round(performance.now() - signalAt);
  if (exitCode !== 1 || signal !== null) {
    throw new Error(
      `unexpected forced exit: code=${exitCode}, signal=${signal}\n${forcedOutput}`,
    );
  }
  if (elapsedMs < 900) {
    throw new Error(
      `forced exit happened before the shutdown deadline: elapsed=${elapsedMs}ms\n${forcedOutput}`,
    );
  }
  console.log(
    JSON.stringify({
      service_id: "trigger_processor",
      signal: "SIGTERM",
      forced: true,
      exit_code: 1,
      elapsed_ms: elapsedMs,
    }),
  );
} catch (error) {
  if (forcedChild.exitCode === null) forcedChild.kill("SIGKILL");
  throw error;
}
