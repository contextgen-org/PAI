import { afterEach, describe, expect, it, vi } from "vitest";

import { createServiceApp, shutdownService } from "../src/index.js";

const apps = [] as ReturnType<typeof createServiceApp>[];

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
});

describe("graceful shutdown", () => {
  it("closes normally before the deadline", async () => {
    const app = createServiceApp("skill_registry");
    const close = vi.spyOn(app, "close");
    expect(await shutdownService(app, 1_000, "test")).toBe("closed");
    expect(close).toHaveBeenCalledOnce();
  });

  it("forces connection closure when the deadline is exceeded", async () => {
    const app = createServiceApp("timer_trigger_app");
    apps.push(app);
    const originalClose = app.close.bind(app);
    const close = vi
      .spyOn(app, "close")
      .mockImplementation(async () => new Promise<void>(() => undefined));

    expect(await shutdownService(app, 5, "test-timeout")).toBe("forced");
    close.mockRestore();
    await originalClose();
    apps.splice(apps.indexOf(app), 1);
  });
});
