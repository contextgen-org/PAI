import { spawn } from "node:child_process";

import { SKILL_PACKAGE_MAX_BYTES_V1 } from "@pai/contracts";

import type {
  SkillPackageInspectionV1,
  SkillPackageInspectorPortV1,
} from "./skill-registry-application.v1.js";

const DEFAULT_TIMEOUT_MS_V1 = 30_000;
const MAX_STDERR_BYTES_V1 = 8_192;
const MAX_STDOUT_BYTES_V1 = 512 * 1024;

export interface SkillRegistryPackageInspectorOptionsV1 {
  readonly timeout_ms?: number;
  readonly node_path?: string;
}

function snapshotInspectionV1(value: unknown): SkillPackageInspectionV1 {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    !Object.hasOwn(value, "package_root_name") ||
    !Object.hasOwn(value, "frontmatter") ||
    !Object.hasOwn(value, "manifest")
  ) {
    throw new Error("isolated package inspector returned an invalid result");
  }
  return structuredClone(value) as SkillPackageInspectionV1;
}

/**
 * Runs archive parsing in a one-shot subprocess.  The parent observes both
 * the request AbortSignal and its own hard timeout, then closes stdin and
 * kills the child so malformed archives never outlive the validation call.
 */
export function createSkillRegistryPackageInspectorV1(
  options: SkillRegistryPackageInspectorOptionsV1 = {},
): SkillPackageInspectorPortV1 {
  const timeoutMs = options.timeout_ms ?? DEFAULT_TIMEOUT_MS_V1;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 300_000) {
    throw new Error("Skill Registry package inspector timeout is invalid");
  }
  const nodePath = options.node_path ?? process.execPath;
  if (nodePath.length === 0 || nodePath.includes("\u0000")) {
    throw new Error("Skill Registry package inspector node path is invalid");
  }
  return Object.freeze({
    execution_kind: "isolated" as const,
    cancellation_kind: "abort_signal" as const,
    async checkReadiness(): Promise<void> {
      if (nodePath.length === 0) throw new Error("Skill Registry package inspector is unavailable");
    },
    async inspectPackage(bytes: Uint8Array, signal: AbortSignal): Promise<SkillPackageInspectionV1> {
      signal.throwIfAborted();
      if (!(bytes instanceof Uint8Array) || bytes.byteLength > SKILL_PACKAGE_MAX_BYTES_V1) {
        throw new Error("Skill package bytes exceed the hard limit");
      }
      return new Promise<SkillPackageInspectionV1>((resolve, reject) => {
        const child = spawn(
          nodePath,
          [new URL("./package-inspector-worker.v1.js", import.meta.url).pathname],
          { stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
        );
        let settled = false;
        const stdout: Buffer[] = [];
        let stdoutLength = 0;
        let stderrLength = 0;
        const finish = (error?: Error, inspection?: SkillPackageInspectionV1) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          signal.removeEventListener("abort", abort);
          if (error !== undefined) reject(error);
          else resolve(inspection!);
        };
        const abort = () => {
          child.kill("SIGKILL");
          finish(signal.reason instanceof Error ? signal.reason : new Error("package inspection aborted"));
        };
        const timeout = setTimeout(() => {
          child.kill("SIGKILL");
          finish(new Error("Skill package inspection timed out"));
        }, timeoutMs);
        signal.addEventListener("abort", abort, { once: true });
        child.once("error", (error) => finish(error));
        child.stdout.on("data", (chunk: Buffer) => {
          stdoutLength += chunk.byteLength;
          if (stdoutLength > MAX_STDOUT_BYTES_V1) {
            child.kill("SIGKILL");
            finish(new Error("Skill package inspector output is oversized"));
            return;
          }
          stdout.push(Buffer.from(chunk));
        });
        child.stderr.on("data", (chunk: Buffer) => {
          stderrLength = Math.min(MAX_STDERR_BYTES_V1, stderrLength + chunk.byteLength);
        });
        child.once("close", (code, closeSignal) => {
          if (settled) return;
          if (code !== 0 || closeSignal !== null) {
            finish(new Error("Skill package inspector rejected the archive"));
            return;
          }
          try {
            const decoded = JSON.parse(Buffer.concat(stdout, stdoutLength).toString("utf8"));
            finish(undefined, snapshotInspectionV1(decoded));
          } catch {
            finish(new Error("Skill package inspector produced invalid output"));
          }
        });
        child.stdin.once("error", (error) => finish(error));
        child.stdin.end(Buffer.from(bytes));
      });
    },
  });
}
