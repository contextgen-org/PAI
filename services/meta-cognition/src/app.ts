import { createServiceApp } from "@pai/service-kit";

export function buildMetaCognitionApp(): ReturnType<typeof createServiceApp> {
  return createServiceApp("meta_cognition");
}
