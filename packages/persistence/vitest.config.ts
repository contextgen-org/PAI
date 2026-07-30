import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@pai\/contracts$/u,
        replacement: fileURLToPath(
          new URL("../contracts/src/index.ts", import.meta.url),
        ),
      },
      {
        find: /^@pai\/persistence$/u,
        replacement: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
      },
    ],
  },
  test: {
    include: ["test/**/*.contract.ts", "test/**/*.test.ts"],
    fileParallelism: false,
    minWorkers: 1,
    maxWorkers: 1,
    sequence: {
      concurrent: false,
    },
  },
});
