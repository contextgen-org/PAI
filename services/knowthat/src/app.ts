import { createServiceApp } from "@pai/service-kit";

export function buildKnowThatApp(): ReturnType<typeof createServiceApp> {
  return createServiceApp("knowthat");
}
