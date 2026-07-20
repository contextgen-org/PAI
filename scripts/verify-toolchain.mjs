import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const expected = Object.freeze({
  node: "24.18.0",
  pnpm: "11.13.1",
  typescript: "7.0.2",
});

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)));

const actual = {
  node: process.versions.node,
  pnpm: execFileSync("pnpm", ["--version"], { encoding: "utf8" }).trim(),
  typescript: packageJson.devDependencies?.typescript,
};

if (packageJson.packageManager !== `pnpm@${expected.pnpm}`) {
  console.error(
    `packageManager mismatch: expected pnpm@${expected.pnpm}, received ${packageJson.packageManager}`,
  );
  process.exitCode = 1;
}
if (packageJson.engines?.node !== expected.node) {
  console.error(
    `engines.node mismatch: expected ${expected.node}, received ${packageJson.engines?.node}`,
  );
  process.exitCode = 1;
}

const mismatches = Object.entries(expected).filter(
  ([name, version]) => actual[name] !== version,
);

if (mismatches.length > 0) {
  for (const [name, version] of mismatches) {
    console.error(
      `toolchain mismatch: ${name} expected ${version}, received ${actual[name]}`,
    );
  }
  process.exitCode = 1;
} else if (process.exitCode !== 1) {
  console.log(
    `toolchain verified: node=${actual.node} pnpm=${actual.pnpm} typescript=${actual.typescript}`,
  );
}
