import { afterEach, describe, expect, it } from "vitest";

import { createServiceApp } from "../src/index.js";

const apps = [] as ReturnType<typeof createServiceApp>[];

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
});

describe("createServiceApp", () => {
  it("returns an owner-identifying health response without a success envelope", async () => {
    const app = createServiceApp("trigger_processor");
    apps.push(app);
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "ok",
      service_id: "trigger_processor",
    });
  });
});
