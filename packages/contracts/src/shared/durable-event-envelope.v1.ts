import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import { ServiceIdV1Schema } from "./service-id.v1.js";

const opaqueEventIdentifier = Type.String({ minLength: 1, maxLength: 256 });
const eventType = Type.String({
  minLength: 3,
  maxLength: 160,
  pattern: "^[a-z][a-z0-9]*(?:[._][a-z0-9]+)+$",
});
const jsonValue = Type.Recursive((This) =>
  Type.Union([
    Type.Null(),
    Type.Boolean(),
    Type.Number(),
    Type.String(),
    Type.Array(This),
    Type.Record(Type.String(), This),
  ]),
);

/**
 * Canonical wire envelope for every durable cross-service event.
 *
 * Delivery fields such as target, status, attempts, claim tokens and errors
 * intentionally do not belong to this schema. They remain outbox storage
 * metadata and must never leak into the wire event.
 */
export const DurableEventEnvelopeV1Schema = Type.Object(
  {
    event_id: opaqueEventIdentifier,
    event_type: eventType,
    schema_version: Type.String({ minLength: 1, maxLength: 128 }),
    producer: ServiceIdV1Schema,
    occurred_at: Type.String({
      minLength: 20,
      maxLength: 35,
      pattern:
        "^\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])T(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d{1,9})?(?:Z|[+-](?:[01]\\d|2[0-3]):[0-5]\\d)$",
    }),
    idempotency_key: Type.String({ minLength: 1, maxLength: 512 }),
    trace_id: Type.String({ minLength: 1, maxLength: 256 }),
    payload: Type.Record(Type.String(), jsonValue),
  },
  {
    $id: "urn:pai:shared:durable-event-envelope:v1",
    additionalProperties: false,
  },
);

export type DurableEventEnvelopeV1 = Static<
  typeof DurableEventEnvelopeV1Schema
>;

export class DurableEventEnvelopeValidationErrorV1 extends Error {
  public constructor(public readonly issues: readonly string[]) {
    super(`invalid durable event envelope: ${issues.join("; ")}`);
    this.name = "DurableEventEnvelopeValidationErrorV1";
  }
}

function isCalendarTimestamp(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})T/u.exec(value);
  if (match === null) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return (
    day <= (daysInMonth[month - 1] ?? 0) &&
    Number.isFinite(Date.parse(value))
  );
}

export function assertDurableEventEnvelopeV1(
  value: unknown,
): asserts value is DurableEventEnvelopeV1 {
  const schemaValid = Value.Check(DurableEventEnvelopeV1Schema, value);
  const occurredAt =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>).occurred_at
      : undefined;
  if (
    schemaValid &&
    typeof occurredAt === "string" &&
    isCalendarTimestamp(occurredAt)
  ) {
    return;
  }
  const issues = [...Value.Errors(DurableEventEnvelopeV1Schema, value)].map(
    (issue) => `${issue.path || "/"}: ${issue.message}`,
  );
  if (schemaValid) issues.push("/occurred_at: must be a real calendar timestamp");
  throw new DurableEventEnvelopeValidationErrorV1(issues);
}
