import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

function source(relativePath: string): string {
  return fileURLToPath(new URL(relativePath, import.meta.url));
}

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@pai\/action-runtime$/u, replacement: source("../../services/action-runtime/src/index.ts") },
      { find: /^@pai\/auth$/u, replacement: source("../auth/src/index.ts") },
      { find: /^@pai\/contracts$/u, replacement: source("../contracts/src/index.ts") },
      { find: /^@pai\/eventing$/u, replacement: source("../eventing/src/index.ts") },
      { find: /^@pai\/knowthat$/u, replacement: source("../../services/knowthat/src/index.ts") },
      { find: /^@pai\/memory$/u, replacement: source("../../services/memory/src/index.ts") },
      { find: /^@pai\/meta-cognition$/u, replacement: source("../../services/meta-cognition/src/index.ts") },
      { find: /^@pai\/object-store$/u, replacement: source("../object-store/src/index.ts") },
      { find: /^@pai\/observation-gateway$/u, replacement: source("../../services/observation-gateway/src/index.ts") },
      { find: /^@pai\/persistence$/u, replacement: source("../persistence/src/index.ts") },
      { find: /^@pai\/service-kit$/u, replacement: source("../service-kit/src/index.ts") },
      { find: /^@pai\/timer-trigger-app$/u, replacement: source("../../services/timer-trigger-app/src/index.ts") },
      { find: /^@pai\/trigger-processor$/u, replacement: source("../../services/trigger-processor/src/index.ts") },
    ],
  },
  test: {
    include: ["test/**/*.e2e.ts"],
    testTimeout: 10_000,
  },
});
