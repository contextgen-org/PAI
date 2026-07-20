import { createServiceApp } from "@pai/service-kit";

export function buildMemoryApp(): ReturnType<typeof createServiceApp> {
  return createServiceApp("memory");
}
