import { describe, expect, it } from "vitest";

import {
  OWNER_DURABLE_EVENT_TYPES_V1,
  SERVICE_IDS,
  isOwnerDurableEventTypeV1,
} from "../../src/index.js";

describe("owner durable event type unions V1", () => {
  it("covers every and only database-owning service with globally unique types", () => {
    expect(Object.keys(OWNER_DURABLE_EVENT_TYPES_V1).sort()).toEqual(
      SERVICE_IDS.filter((service) => service !== "observation_gateway").sort(),
    );
    const eventTypes = Object.values(OWNER_DURABLE_EVENT_TYPES_V1).flat();
    expect(new Set(eventTypes).size).toBe(eventTypes.length);
    expect(
      eventTypes.every((eventType) =>
        /^[a-z][a-z0-9]*(?:[._][a-z0-9]+)+$/u.test(eventType),
      ),
    ).toBe(true);
  });

  it("freezes the union map and every owner list", () => {
    expect(Object.isFrozen(OWNER_DURABLE_EVENT_TYPES_V1)).toBe(true);
    expect(
      Object.values(OWNER_DURABLE_EVENT_TYPES_V1).every(Object.isFrozen),
    ).toBe(true);
  });

  it("binds event types to their producer and rejects Observation as an owner", () => {
    expect(
      isOwnerDurableEventTypeV1(
        "timer_trigger_app",
        "timer.occurrence.due",
      ),
    ).toBe(true);
    expect(
      isOwnerDurableEventTypeV1(
        "trigger_processor",
        "timer.occurrence.due",
      ),
    ).toBe(false);
    expect(
      isOwnerDurableEventTypeV1(
        "observation_gateway",
        "timer.occurrence.due",
      ),
    ).toBe(false);
  });
});
