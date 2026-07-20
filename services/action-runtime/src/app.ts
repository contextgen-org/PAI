import { createServiceApp } from "@pai/service-kit";

export function buildActionRuntimeApp(): ReturnType<typeof createServiceApp> {
  return createServiceApp("action_runtime");
}
