import { materializeSkillTarV1 } from "@pai/skill-package";

const MAX_INPUT_BYTES_V1 = 64 * 1024 * 1024;
const MAX_OUTPUT_BYTES_V1 = 512 * 1024;

function failV1(message: string): never {
  throw new Error(message);
}

function strictFrontmatterV1(markdown: string): Readonly<{
  name: string;
  description: string;
}> {
  const match = /^---\r?\n([\s\S]{1,16384}?)\r?\n---(?:\r?\n|$)/u.exec(markdown);
  if (match === null) failV1("SKILL.md must start with bounded YAML frontmatter");
  const values = new Map<string, string>();
  for (const line of match[1]!.split(/\r?\n/u)) {
    const entry = /^([a-z_]+):[ \t]*(.*)$/u.exec(line);
    if (entry === null || !["name", "description"].includes(entry[1]!)) {
      failV1("SKILL.md frontmatter contains an unsupported field");
    }
    if (values.has(entry[1]!)) failV1("SKILL.md frontmatter contains a duplicate field");
    const raw = entry[2]!;
    const quoted = /^(?:"((?:[^"\\]|\\["\\nt])*?)"|'([^']*)')$/u.exec(raw);
    const value = quoted === null
      ? raw
      : quoted[1] === undefined
        ? quoted[2]!
        : JSON.parse(`"${quoted[1]!}"`);
    if (
      value.length === 0 ||
      value.length > 1_024 ||
      /[\u0000-\u001f\u007f]/u.test(value)
    ) {
      failV1("SKILL.md frontmatter value is invalid");
    }
    values.set(entry[1]!, value);
  }
  const name = values.get("name");
  const description = values.get("description");
  if (name === undefined || description === undefined) {
    failV1("SKILL.md frontmatter requires name and description");
  }
  return Object.freeze({ name, description });
}

const chunks: Buffer[] = [];
let total = 0;
for await (const chunk of process.stdin) {
  if (!Buffer.isBuffer(chunk)) failV1("package inspector input chunk is invalid");
  total += chunk.byteLength;
  if (total > MAX_INPUT_BYTES_V1) failV1("package inspector input exceeds the hard limit");
  chunks.push(Buffer.from(chunk));
}
try {
  const materialized = materializeSkillTarV1(Buffer.concat(chunks, total));
  const entrypoint = materialized.entries.find(({ path }) => path === "SKILL.md");
  if (entrypoint === undefined) failV1("package manifest omitted SKILL.md");
  const frontmatter = strictFrontmatterV1(new TextDecoder("utf-8", { fatal: true }).decode(entrypoint.bytes));
  const result = JSON.stringify({
    package_root_name: frontmatter.name,
    frontmatter,
    manifest: {
      schema_version: "skill_package_manifest.v1",
      runtime_target: materialized.runtime_target,
      files: materialized.entries.map(({ path, mode, bytes, sha256 }) => ({
        path,
        mode,
        size_bytes: bytes.byteLength,
        sha256,
      })),
    },
  });
  if (Buffer.byteLength(result, "utf8") > MAX_OUTPUT_BYTES_V1) {
    failV1("package inspector output exceeds the hard limit");
  }
  process.stdout.write(result);
} catch (error) {
  process.stderr.write(error instanceof Error ? error.message : "package inspector failed");
  process.exitCode = 1;
}
