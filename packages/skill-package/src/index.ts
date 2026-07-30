import { createHash } from "node:crypto";

import {
  SKILL_ENTRYPOINT_MAX_BYTES_V1,
  SKILL_PACKAGE_MAX_BYTES_V1,
  SKILL_PACKAGE_MAX_FILES_V1,
  SkillPackageManifestV1Schema,
  assertSkillPackageManifestSemanticBindingsV1,
  skillRegistryCanonicalJsonV1,
  type SkillPackageManifestV1,
} from "@pai/contracts";
import { Value } from "@sinclair/typebox/value";

export interface MaterializedSkillPackageEntryV1 {
  readonly path: string;
  readonly mode: "0600";
  readonly bytes: Uint8Array;
  readonly sha256: `sha256:${string}`;
}

export interface MaterializedSkillPackageV1 {
  readonly bytes: Uint8Array;
  readonly manifest_bytes: Uint8Array;
  readonly media_type: "application/vnd.pai.skill+tar";
  readonly package_digest: `sha256:${string}`;
  readonly manifest_digest: `sha256:${string}`;
  readonly runtime_target: "filesystem_bundle.v1";
  readonly entry_paths: readonly string[];
  readonly entries: readonly MaterializedSkillPackageEntryV1[];
}

const encoderV1 = new TextEncoder();
const fatalDecoderV1 = new TextDecoder("utf-8", { fatal: true });
const TAR_BLOCK_BYTES_V1 = 512;

function digestV1(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function nullTerminatedUtf8V1(bytes: Uint8Array, label: string): string {
  const nullIndex = bytes.indexOf(0);
  const slice = nullIndex === -1 ? bytes : bytes.subarray(0, nullIndex);
  let value: string;
  try {
    value = fatalDecoderV1.decode(slice);
  } catch {
    throw new Error(`Skill tar ${label} is not UTF-8`);
  }
  if (value !== value.normalize("NFC")) {
    throw new Error(`Skill tar ${label} is not NFC-normalized`);
  }
  return value;
}

function octalV1(bytes: Uint8Array, label: string): number {
  const value = nullTerminatedUtf8V1(bytes, label).trim();
  if (!/^[0-7]+$/u.test(value)) {
    throw new Error(`Skill tar ${label} is not canonical octal`);
  }
  const parsed = Number.parseInt(value, 8);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Skill tar ${label} exceeds safe integer bounds`);
  }
  return parsed;
}

function isZeroBlockV1(block: Uint8Array): boolean {
  return block.every((value) => value === 0);
}

function assertHeaderChecksumV1(block: Uint8Array): void {
  const recorded = octalV1(block.subarray(148, 156), "checksum");
  let sum = 0;
  for (let index = 0; index < block.length; index += 1) {
    sum += index >= 148 && index < 156 ? 32 : block[index]!;
  }
  if (recorded !== sum) throw new Error("Skill tar header checksum mismatch");
}

function safeArchivePathV1(value: string): string {
  if (
    value.length < 1 ||
    value.length > 4_096 ||
    value.startsWith("/") ||
    value.includes("\\") ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw new Error("Skill tar contains an unsafe path");
  }
  const normalized = value.replace(/\/+$/u, "");
  if (
    normalized.length === 0 ||
    normalized
      .split("/")
      .some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new Error("Skill tar contains an unsafe path segment");
  }
  return normalized;
}

function looksLikeNestedArchiveV1(path: string, bytes: Uint8Array): boolean {
  const lower = path.toLowerCase();
  return (
    /\.(?:zip|tar|tgz|tar\.gz|gz|bz2|xz|7z)$/u.test(lower) ||
    (bytes[0] === 0x50 && bytes[1] === 0x4b) ||
    (bytes[0] === 0x1f && bytes[1] === 0x8b) ||
    (bytes.length >= 262 &&
      fatalDecoderV1.decode(bytes.subarray(257, 262)) === "ustar")
  );
}

interface RawTarFileV1 {
  readonly path: string;
  readonly bytes: Uint8Array;
}

function parseTarFilesV1(packageBytes: Uint8Array): readonly RawTarFileV1[] {
  if (
    packageBytes.byteLength < TAR_BLOCK_BYTES_V1 * 3 ||
    packageBytes.byteLength > SKILL_PACKAGE_MAX_BYTES_V1 ||
    packageBytes.byteLength % TAR_BLOCK_BYTES_V1 !== 0
  ) {
    throw new Error("Skill tar byte length is outside the bounded contract");
  }
  const files: RawTarFileV1[] = [];
  let offset = 0;
  let terminalZeroBlocks = 0;
  let expandedBytes = 0;
  while (offset + TAR_BLOCK_BYTES_V1 <= packageBytes.byteLength) {
    const header = packageBytes.subarray(offset, offset + TAR_BLOCK_BYTES_V1);
    offset += TAR_BLOCK_BYTES_V1;
    if (isZeroBlockV1(header)) {
      terminalZeroBlocks += 1;
      if (terminalZeroBlocks === 2) {
        if (!packageBytes.subarray(offset).every((value) => value === 0)) {
          throw new Error("Skill tar has data after its terminal records");
        }
        break;
      }
      continue;
    }
    if (terminalZeroBlocks !== 0) {
      throw new Error("Skill tar has a partial terminal record");
    }
    assertHeaderChecksumV1(header);
    const name = nullTerminatedUtf8V1(header.subarray(0, 100), "name");
    const prefix = nullTerminatedUtf8V1(header.subarray(345, 500), "prefix");
    const path = safeArchivePathV1(prefix.length === 0 ? name : `${prefix}/${name}`);
    const size = octalV1(header.subarray(124, 136), "size");
    const type = header[156] ?? 0;
    if (size > SKILL_PACKAGE_MAX_BYTES_V1 || offset + size > packageBytes.byteLength) {
      throw new Error("Skill tar entry exceeds its bounded package");
    }
    const body = packageBytes.slice(offset, offset + size);
    const paddedSize = Math.ceil(size / TAR_BLOCK_BYTES_V1) * TAR_BLOCK_BYTES_V1;
    offset += paddedSize;
    if (offset > packageBytes.byteLength) {
      throw new Error("Skill tar entry padding is truncated");
    }
    if (type === 53) {
      if (size !== 0) throw new Error("Skill tar directory contains data");
      continue;
    }
    if (type !== 0 && type !== 48) {
      throw new Error("Skill tar contains a link, device, extension, or special entry");
    }
    if (size === 0) throw new Error("Skill tar contains an empty regular file");
    expandedBytes += size;
    if (
      !Number.isSafeInteger(expandedBytes) ||
      expandedBytes > SKILL_PACKAGE_MAX_BYTES_V1 ||
      files.length >= SKILL_PACKAGE_MAX_FILES_V1
    ) {
      throw new Error("Skill tar expanded content exceeds the hard limit");
    }
    if (looksLikeNestedArchiveV1(path, body)) {
      throw new Error("Skill tar contains a nested archive");
    }
    files.push(Object.freeze({ path, bytes: body }));
  }
  if (terminalZeroBlocks < 2 || files.length === 0) {
    throw new Error("Skill tar is missing files or terminal records");
  }
  return Object.freeze(files);
}

function normalizePackageRootV1(files: readonly RawTarFileV1[]): readonly RawTarFileV1[] {
  const hasRootEntrypoint = files.some(({ path }) => path === "SKILL.md");
  if (hasRootEntrypoint) return files;
  const firstSegments = files.map(({ path }) => path.split("/")[0]!);
  const root = firstSegments[0];
  if (
    root === undefined ||
    firstSegments.some((segment) => segment !== root) ||
    files.some(({ path }) => !path.includes("/"))
  ) {
    throw new Error("Skill tar must have one package root containing SKILL.md");
  }
  return Object.freeze(
    files.map(({ path, bytes }) =>
      Object.freeze({ path: safeArchivePathV1(path.slice(root.length + 1)), bytes }),
    ),
  );
}

export function materializeSkillTarV1(
  packageBytesValue: Uint8Array,
): MaterializedSkillPackageV1 {
  if (!(packageBytesValue instanceof Uint8Array)) {
    throw new Error("Skill package must be a Uint8Array");
  }
  const packageBytes = packageBytesValue.slice();
  const normalized = normalizePackageRootV1(parseTarFilesV1(packageBytes));
  const exactPaths = new Set<string>();
  const foldedPaths = new Set<string>();
  const entries = normalized
    .map(({ path, bytes }) => {
      const normalizedPath = safeArchivePathV1(path);
      const folded = normalizedPath.toLocaleLowerCase("en-US");
      if (exactPaths.has(normalizedPath) || foldedPaths.has(folded)) {
        throw new Error("Skill tar contains a normalized path collision");
      }
      exactPaths.add(normalizedPath);
      foldedPaths.add(folded);
      return Object.freeze({
        path: normalizedPath,
        mode: "0600" as const,
        bytes: bytes.slice(),
        sha256: digestV1(bytes),
      });
    })
    .sort((left, right) =>
      left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
    );
  const entrypoint = entries.find(({ path }) => path === "SKILL.md");
  if (
    entrypoint === undefined ||
    entrypoint.bytes.byteLength > SKILL_ENTRYPOINT_MAX_BYTES_V1
  ) {
    throw new Error("Skill tar requires a bounded top-level SKILL.md");
  }
  try {
    fatalDecoderV1.decode(entrypoint.bytes);
  } catch {
    throw new Error("Skill tar SKILL.md is not UTF-8");
  }
  const manifest: SkillPackageManifestV1 = {
    schema_version: "skill_package_manifest.v1",
    runtime_target: "filesystem_bundle.v1",
    files: entries.map(({ path, mode, bytes, sha256 }) => ({
      path,
      mode,
      size_bytes: bytes.byteLength,
      sha256,
    })),
  };
  if (!Value.Check(SkillPackageManifestV1Schema, manifest)) {
    throw new Error("Skill package manifest does not match the owner schema");
  }
  assertSkillPackageManifestSemanticBindingsV1(manifest);
  const manifestBytes = encoderV1.encode(skillRegistryCanonicalJsonV1(manifest));
  return Object.freeze({
    bytes: packageBytes,
    manifest_bytes: manifestBytes,
    media_type: "application/vnd.pai.skill+tar" as const,
    package_digest: digestV1(packageBytes),
    manifest_digest: digestV1(manifestBytes),
    runtime_target: "filesystem_bundle.v1" as const,
    entry_paths: Object.freeze(entries.map(({ path }) => path)),
    entries: Object.freeze(entries),
  });
}
