import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@pai\/auth$/u,
        replacement: fileURLToPath(
          new URL("../../packages/auth/src/index.ts", import.meta.url),
        ),
      },
      {
        find: /^@pai\/contracts$/u,
        replacement: fileURLToPath(
          new URL("../../packages/contracts/src/index.ts", import.meta.url),
        ),
      },
      {
        find: /^@pai\/eventing$/u,
        replacement: fileURLToPath(
          new URL("../../packages/eventing/src/index.ts", import.meta.url),
        ),
      },
      {
        find: /^@pai\/persistence$/u,
        replacement: fileURLToPath(
          new URL("../../packages/persistence/src/index.ts", import.meta.url),
        ),
      },
      {
        find: /^@pai\/service-kit$/u,
        replacement: fileURLToPath(
          new URL("../../packages/service-kit/src/index.ts", import.meta.url),
        ),
      },
    ],
  },
  test: {
    include: ["test/**/*.test.ts", "test/**/*.contract.ts"],
  },
});
