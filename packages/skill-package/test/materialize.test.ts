import { describe, expect, it } from "vitest";

import { materializeSkillTarV1 } from "../src/index.js";

const encoder = new TextEncoder();

function octal(value: number, width: number): Uint8Array {
  return encoder.encode(value.toString(8).padStart(width - 1, "0") + "\0");
}

function tar(files: readonly Readonly<{ path: string; body: string; type?: number }>[]): Uint8Array {
  const blocks: Uint8Array[] = [];
  for (const file of files) {
    const body = encoder.encode(file.body);
    const header = new Uint8Array(512);
    header.set(encoder.encode(file.path), 0);
    header.set(octal(0o600, 8), 100);
    header.set(octal(0, 8), 108);
    header.set(octal(0, 8), 116);
    header.set(octal(body.byteLength, 12), 124);
    header.set(octal(0, 12), 136);
    header.fill(32, 148, 156);
    header[156] = file.type ?? 48;
    header.set(encoder.encode("ustar\0"), 257);
    header.set(encoder.encode("00"), 263);
    let checksum = 0;
    for (const byte of header) checksum += byte;
    const checksumBytes = encoder.encode(
      checksum.toString(8).padStart(6, "0") + "\0 ",
    );
    header.set(checksumBytes, 148);
    blocks.push(header, body);
    const padding = (512 - (body.byteLength % 512)) % 512;
    if (padding > 0) blocks.push(new Uint8Array(padding));
  }
  blocks.push(new Uint8Array(1024));
  const size = blocks.reduce((sum, block) => sum + block.byteLength, 0);
  const result = new Uint8Array(size);
  let offset = 0;
  for (const block of blocks) {
    result.set(block, offset);
    offset += block.byteLength;
  }
  return result;
}

describe("canonical Skill tar materialization", () => {
  it("normalizes one package root and derives the canonical manifest", () => {
    const materialized = materializeSkillTarV1(
      tar([
        {
          path: "demo/SKILL.md",
          body: "---\nname: demo\ndescription: Use this for demos.\n---\n# Demo\n",
        },
        { path: "demo/references/readme.txt", body: "reference" },
      ]),
    );

    expect(materialized.entry_paths).toEqual([
      "SKILL.md",
      "references/readme.txt",
    ]);
    expect(materialized.package_digest).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(materialized.manifest_digest).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(JSON.parse(new TextDecoder().decode(materialized.manifest_bytes))).toMatchObject({
      schema_version: "skill_package_manifest.v1",
      runtime_target: "filesystem_bundle.v1",
    });
  });

  it("rejects links, path traversal, nested archives, and collisions", () => {
    expect(() =>
      materializeSkillTarV1(
        tar([{ path: "demo/SKILL.md", body: "x", type: 50 }]),
      ),
    ).toThrow(/link, device/u);
    expect(() =>
      materializeSkillTarV1(
        tar([{ path: "demo/../SKILL.md", body: "x" }]),
      ),
    ).toThrow(/unsafe path segment/u);
    expect(() =>
      materializeSkillTarV1(
        tar([
          { path: "demo/SKILL.md", body: "x" },
          { path: "demo/archive.zip", body: "PK" },
        ]),
      ),
    ).toThrow(/nested archive/u);
    expect(() =>
      materializeSkillTarV1(
        tar([
          { path: "demo/SKILL.md", body: "x" },
          { path: "demo/skill.md", body: "y" },
        ]),
      ),
    ).toThrow(/path collision/u);
  });
});
