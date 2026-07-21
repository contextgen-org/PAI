import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@pai/auth": fileURLToPath(
        new URL("../../packages/auth/src/index.ts", import.meta.url),
      ),
      "@pai/contracts": fileURLToPath(
        new URL("../../packages/contracts/src/index.ts", import.meta.url),
      ),
      "@pai/eventing": fileURLToPath(
        new URL("../../packages/eventing/src/index.ts", import.meta.url),
      ),
      "@pai/persistence": fileURLToPath(
        new URL("../../packages/persistence/src/index.ts", import.meta.url),
      ),
      "@pai/service-kit": fileURLToPath(
        new URL("../../packages/service-kit/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
  },
});
