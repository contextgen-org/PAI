import { execFileSync } from "node:child_process";
import { access } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const trackedMarkdown = execFileSync(
  "git",
  ["ls-files", "-z", "--", "*.md"],
  { cwd: repositoryRoot, encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean);

const failures = [];
const markdownLink = /!?\[[^\]]*\]\(([^)]+)\)/g;

for (const markdownPath of trackedMarkdown) {
  const absoluteMarkdownPath = resolve(repositoryRoot, markdownPath);
  const content = await import("node:fs/promises").then(({ readFile }) =>
    readFile(absoluteMarkdownPath, "utf8"),
  );
  for (const match of content.matchAll(markdownLink)) {
    const rawDestination = match[1]?.trim() ?? "";
    const destination = rawDestination.startsWith("<")
      ? rawDestination.slice(1, rawDestination.indexOf(">"))
      : rawDestination.split(/\s+/, 1)[0];
    if (
      destination.length === 0 ||
      destination.startsWith("#") ||
      /^(?:https?:|mailto:|tel:)/i.test(destination)
    ) {
      continue;
    }
    const localPath = decodeURIComponent(destination.split(/[?#]/, 1)[0]);
    const target = resolve(dirname(absoluteMarkdownPath), localPath);
    try {
      await access(target);
    } catch {
      failures.push(`${markdownPath}: missing local link target ${destination}`);
    }
  }
}

if (failures.length > 0) {
  console.error(`markdown link check failed:\n${failures.map((value) => `- ${value}`).join("\n")}`);
  process.exitCode = 1;
}
