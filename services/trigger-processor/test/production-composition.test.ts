import { describe, expect, it } from "vitest";

import { openProductionTriggerProcessorCompositionV1 } from "../src/production-composition.v1.js";

describe("Trigger Processor production composition", () => {
  it("fails closed before any database connection when the DeepSeek native credential is not configured", async () => {
    const env = {
      PAI_DATABASE_URL: "postgresql://invalid",
      PAI_OBJECT_STORE_RECONCILER_DATABASE_URL: "postgresql://invalid",
      PAI_SUPABASE_URL: "https://storage.example.test",
      PAI_SUPABASE_SECRET_KEY: "x".repeat(32),
      PAI_TRIGGER_OBJECT_ACCESS_HMAC_SECRET: "x".repeat(32),
      PAI_TRIGGER_RECOVERY_WORKER_ID: "trigger-worker-1",
      PAI_ACTION_RUNTIME_URL: "https://action.example.test",
      PAI_META_COGNITION_URL: "https://meta.example.test",
      PAI_SKILL_REGISTRY_URL: "https://skill.example.test",
      PAI_MEMORY_URL: "https://memory.example.test",
      PAI_KNOWTHAT_URL: "https://knowthat.example.test",
      PAI_TIMER_TRIGGER_APP_URL: "https://timer.example.test",
      PAI_TRIGGER_INTENT_MODEL: "deepseek-chat",
      PAI_TRIGGER_INTENT_SDK_CWD: "/tmp",
      PAI_TRIGGER_CONTEXT_RETENTION_SECONDS: "3600",
      PATH: "/usr/bin:/bin",
    } as NodeJS.ProcessEnv;

    await expect(
      openProductionTriggerProcessorCompositionV1({
        deployment_environment: "prod",
        release_channel: "stable",
        env,
      }),
    ).rejects.toThrow("DEEPSEEK_API_KEY is required");
  });
});
