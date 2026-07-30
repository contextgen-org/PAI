import { Type, type Static } from "@sinclair/typebox";

export const TERMINAL_OUTCOMES_V1 = [
  "executed",
  "merged_and_executed",
  "superseded_by_later_trigger",
  "deferred_then_executed",
  "expired_with_audit_record",
  "cancelled_with_reason",
  "failed_with_reason",
  "preempted_and_handed_off",
  "interrupted_with_reason",
] as const;

export const TerminalOutcomeV1Schema = Type.Union(
  TERMINAL_OUTCOMES_V1.map((outcome) => Type.Literal(outcome)),
  { $id: "urn:pai:trigger-processor:terminal-outcome:v1" },
);

export const TERMINAL_OUTCOME_V1_DATABASE_CHECK =
  `CHECK (terminal_outcome IS NULL OR terminal_outcome IN (${TERMINAL_OUTCOMES_V1.map(
    (outcome) => `'${outcome}'`,
  ).join(", ")}))` as const;

export type TerminalOutcomeV1 = Static<typeof TerminalOutcomeV1Schema>;
