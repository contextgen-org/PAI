import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@pai/contracts": fileURLToPath(
        new URL("../../packages/contracts/src/index.ts", import.meta.url),
      ),
      "@pai/eventing": fileURLToPath(
        new URL("../../packages/eventing/src/index.ts", import.meta.url),
      ),
      "@pai/persistence": fileURLToPath(
        new URL("../../packages/persistence/src/index.ts", import.meta.url),
      ),
    },
  },
  test: { include: ["test/**/*.test.ts"] },
});
