import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@pai\/contracts$/u,
        replacement: fileURLToPath(
          new URL("../../packages/contracts/src/index.ts", import.meta.url),
        ),
      },
      {
        find: /^@pai\/contracts\/(.*)$/u,
        replacement: fileURLToPath(
          new URL("../../packages/contracts/src/$1.ts", import.meta.url),
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
        find: /^@pai\/action-runtime\/db\/permission-manifest\.v1$/u,
        replacement: fileURLToPath(
          new URL(
            "../action-runtime/src/db/permission-manifest.v1.ts",
            import.meta.url,
          ),
        ),
      },
      {
        find: /^@pai\/knowthat\/db\/permission-manifest\.v1$/u,
        replacement: fileURLToPath(
          new URL(
            "../knowthat/src/db/permission-manifest.v1.ts",
            import.meta.url,
          ),
        ),
      },
      {
        find: /^@pai\/memory\/db\/permission-manifest\.v1$/u,
        replacement: fileURLToPath(
          new URL(
            "../memory/src/db/permission-manifest.v1.ts",
            import.meta.url,
          ),
        ),
      },
      {
        find: /^@pai\/meta-cognition\/db\/permission-manifest\.v1$/u,
        replacement: fileURLToPath(
          new URL(
            "../meta-cognition/src/db/permission-manifest.v1.ts",
            import.meta.url,
          ),
        ),
      },
      {
        find: /^@pai\/skill-registry\/db\/permission-manifest\.v1$/u,
        replacement: fileURLToPath(
          new URL(
            "../skill-registry/src/db/permission-manifest.v1.ts",
            import.meta.url,
          ),
        ),
      },
      {
        find: /^@pai\/timer-trigger-app\/db\/permission-manifest\.v1$/u,
        replacement: fileURLToPath(
          new URL(
            "../timer-trigger-app/src/db/permission-manifest.v1.ts",
            import.meta.url,
          ),
        ),
      },
      {
        find: /^@pai\/trigger-processor\/db\/permission-manifest\.v1$/u,
        replacement: fileURLToPath(
          new URL(
            "../trigger-processor/src/db/permission-manifest.v1.ts",
            import.meta.url,
          ),
        ),
      },
    ],
  },
  test: { include: ["test/**/*.test.ts"] },
});
