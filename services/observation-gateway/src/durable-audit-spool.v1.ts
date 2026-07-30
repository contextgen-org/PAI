import { constants as fsConstants } from "node:fs";
import { lstat, mkdir, open } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";

import { canonicalJsonV1 } from "@pai/eventing";

import type {
  ObservationAccessAuditRecordV1,
  ObservationAccessAuditSpoolPortV1,
} from "./observation-application.v1.js";

const DEFAULT_MAX_BYTES = 1_073_741_824;

async function assertRegularNonSymlinkV1(path: string): Promise<void> {
  try {
    const metadata = await lstat(path);
    if (metadata.isSymbolicLink() || !metadata.isFile()) {
      throw new Error("Observation audit spool must be a regular file");
    }
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return;
    }
    throw error;
  }
}

export class FileObservationAccessAuditSpoolV1
  implements ObservationAccessAuditSpoolPortV1
{
  public readonly durability = "durable_spool" as const;
  readonly #path: string;
  readonly #maximumBytes: number;
  readonly #knownAuditIds = new Set<string>();
  #initialized = false;
  #sizeBytes = 0;
  #queue: Promise<void> = Promise.resolve();

  public constructor(input: Readonly<{
    path: string;
    maximum_bytes?: number;
  }>) {
    if (!isAbsolute(input.path)) {
      throw new Error("Observation audit spool path must be absolute");
    }
    const maximumBytes = input.maximum_bytes ?? DEFAULT_MAX_BYTES;
    if (
      !Number.isSafeInteger(maximumBytes) ||
      maximumBytes < 1_048_576 ||
      maximumBytes > 17_179_869_184
    ) {
      throw new Error("Observation audit spool maximum is outside bounds");
    }
    this.#path = resolve(input.path);
    this.#maximumBytes = maximumBytes;
  }

  async #exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.#queue;
    let release!: () => void;
    this.#queue = new Promise<void>((resolveQueue) => {
      release = resolveQueue;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  async #initialize(): Promise<void> {
    if (this.#initialized) return;
    await mkdir(dirname(this.#path), { recursive: true, mode: 0o700 });
    await assertRegularNonSymlinkV1(this.#path);
    const handle = await open(
      this.#path,
      fsConstants.O_APPEND |
        fsConstants.O_CREAT |
        fsConstants.O_RDONLY |
        fsConstants.O_NOFOLLOW,
      0o600,
    );
    try {
      const metadata = await handle.stat();
      if (!metadata.isFile() || metadata.size > this.#maximumBytes) {
        throw new Error("Observation audit spool is invalid or over capacity");
      }
      const text = await handle.readFile({ encoding: "utf8" });
      for (const line of text.split("\n")) {
        if (line.length === 0) continue;
        let record: unknown;
        try {
          record = JSON.parse(line) as unknown;
        } catch {
          throw new Error("Observation audit spool contains invalid JSONL");
        }
        if (
          typeof record !== "object" ||
          record === null ||
          !("audit_id" in record) ||
          typeof record.audit_id !== "string" ||
          this.#knownAuditIds.has(record.audit_id)
        ) {
          throw new Error("Observation audit spool contains invalid audit identity");
        }
        this.#knownAuditIds.add(record.audit_id);
      }
      this.#sizeBytes = metadata.size;
      this.#initialized = true;
    } finally {
      await handle.close();
    }
  }

  public async checkReadiness(): Promise<void> {
    await this.#exclusive(async () => {
      await this.#initialize();
      await assertRegularNonSymlinkV1(this.#path);
      const handle = await open(
        this.#path,
        fsConstants.O_APPEND | fsConstants.O_WRONLY | fsConstants.O_NOFOLLOW,
      );
      try {
        const metadata = await handle.stat();
        if (!metadata.isFile() || metadata.size !== this.#sizeBytes) {
          throw new Error("Observation audit spool changed outside its owner");
        }
        await handle.sync();
      } finally {
        await handle.close();
      }
    });
  }

  public async enqueue(
    record: ObservationAccessAuditRecordV1,
    signal?: AbortSignal,
  ): Promise<"durable" | "commit_unknown" | "unavailable" | "capacity_exceeded"> {
    if (signal?.aborted === true) return "unavailable";
    try {
      return await this.#exclusive(async () => {
        await this.#initialize();
        if (this.#knownAuditIds.has(record.audit_id)) return "durable";
        const bytes = Buffer.from(`${canonicalJsonV1(record)}\n`, "utf8");
        if (this.#sizeBytes + bytes.byteLength > this.#maximumBytes) {
          return "capacity_exceeded";
        }
        if (signal?.aborted === true) return "unavailable";
        await assertRegularNonSymlinkV1(this.#path);
        const handle = await open(
          this.#path,
          fsConstants.O_APPEND | fsConstants.O_WRONLY | fsConstants.O_NOFOLLOW,
        );
        try {
          const metadata = await handle.stat();
          if (!metadata.isFile() || metadata.size !== this.#sizeBytes) {
            return "commit_unknown";
          }
          await handle.writeFile(bytes);
          await handle.sync();
        } finally {
          await handle.close();
        }
        this.#sizeBytes += bytes.byteLength;
        this.#knownAuditIds.add(record.audit_id);
        return "durable";
      });
    } catch {
      return "unavailable";
    }
  }

  public async replay(): Promise<void> {
    await this.checkReadiness();
  }
}

export function createFileObservationAccessAuditSpoolFromEnvV1(
  env: NodeJS.ProcessEnv,
): FileObservationAccessAuditSpoolV1 {
  const path = env.PAI_OBSERVATION_AUDIT_SPOOL_PATH;
  if (path === undefined) {
    throw new Error("PAI_OBSERVATION_AUDIT_SPOOL_PATH is required");
  }
  return new FileObservationAccessAuditSpoolV1({
    path,
    ...(env.PAI_OBSERVATION_AUDIT_SPOOL_MAX_BYTES === undefined
      ? {}
      : { maximum_bytes: Number(env.PAI_OBSERVATION_AUDIT_SPOOL_MAX_BYTES) }),
  });
}
