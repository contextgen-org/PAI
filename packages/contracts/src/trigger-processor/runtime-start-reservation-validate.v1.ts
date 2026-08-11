import { Type, type Static } from "@sinclair/typebox";

import {
  TriggerProcessorPositiveVersionV1Schema,
  TriggerProcessorSha256V1Schema,
} from "./contract-primitives.v1.js";

const RuntimeStartReservationIdentifierV1Schema = Type.String({
  minLength: 1,
  maxLength: 256,
});

const RuntimeStartReservationFenceTokenV1Schema = Type.String({
  minLength: 1,
  maxLength: 4_096,
});

export const RUNTIME_START_RESERVATION_VALIDATION_STAGES_V1 = [
  "request_received",
  "preflight_completed",
  "before_running",
] as const;

export const RUNTIME_START_RESERVATION_VALIDATE_ERROR_CODES_V1 = [
  "authorization_scope_mismatch",
  "stale_start_fence",
  "start_cancelled",
  "reservation_terminal",
  "idempotency_conflict",
  "schema_validation_failed",
  "storage_unavailable",
  "internal_error",
] as const;

const runtimeStartReservationValidateRequestBaseV1 = {
  schema_version: Type.Literal(
    "runtime_start_reservation_validate_request.v1",
  ),
  runtime_run_id: RuntimeStartReservationIdentifierV1Schema,
  request_hash: TriggerProcessorSha256V1Schema,
  trace_id: RuntimeStartReservationIdentifierV1Schema,
} as const;

/**
 * The plaintext fence is accepted only while Action Runtime is authenticating
 * the inbound Start command. Once the attempt is durable, before_running is
 * bound exclusively to the persisted hash; the hash is never accepted as a
 * credential without the authenticated Action Runtime workload principal.
 */
export const RuntimeStartReservationValidateRequestV1Schema = Type.Union(
  [
    Type.Object(
      {
        ...runtimeStartReservationValidateRequestBaseV1,
        start_fence_token: RuntimeStartReservationFenceTokenV1Schema,
        validation_stage: Type.Literal("request_received"),
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        ...runtimeStartReservationValidateRequestBaseV1,
        start_fence_token: RuntimeStartReservationFenceTokenV1Schema,
        validation_stage: Type.Literal("preflight_completed"),
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        ...runtimeStartReservationValidateRequestBaseV1,
        start_fence_token_hash: TriggerProcessorSha256V1Schema,
        validation_stage: Type.Literal("before_running"),
      },
      { additionalProperties: false },
    ),
  ],
  {
    $id: "urn:pai:trigger-processor:runtime-start-reservation-validate-request:v1",
  },
);

export const RuntimeStartReservationValidateResponseV1Schema = Type.Object(
  {
    schema_version: Type.Literal(
      "runtime_start_reservation_validate_response.v1",
    ),
    validation_result: Type.Literal("valid"),
    reservation_status: Type.Union([
      Type.Literal("reserved"),
      Type.Literal("dispatching"),
      Type.Literal("queued"),
      // Returned only for a `before_running` revalidation of the exact
      // published run when a replacement worker takes an expired lease.
      Type.Literal("started"),
    ]),
    validated_fence_generation: TriggerProcessorPositiveVersionV1Schema,
    validation_stage: Type.Union(
      RUNTIME_START_RESERVATION_VALIDATION_STAGES_V1.map((stage) =>
        Type.Literal(stage),
      ),
    ),
    duplicate_replayed: Type.Literal(false),
    trace_id: RuntimeStartReservationIdentifierV1Schema,
  },
  {
    additionalProperties: false,
    $id: "urn:pai:trigger-processor:runtime-start-reservation-validate-response:v1",
  },
);

const runtimeStartReservationValidateErrorCommonV1 = {
  schema_version: Type.Literal(
    "runtime_start_reservation_validate_error.v1",
  ),
  message: Type.String({ minLength: 1, maxLength: 512 }),
  trace_id: RuntimeStartReservationIdentifierV1Schema,
} as const;

const runtimeStartReservationValidateStageV1 = Type.Union(
  RUNTIME_START_RESERVATION_VALIDATION_STAGES_V1.map((stage) =>
    Type.Literal(stage),
  ),
);

const runtimeStartReservationValidateBoundDetailsV1 = {
  trigger_process_id: RuntimeStartReservationIdentifierV1Schema,
  start_attempt_no: TriggerProcessorPositiveVersionV1Schema,
  validation_stage: runtimeStartReservationValidateStageV1,
} as const;

export const RuntimeStartReservationValidateErrorV1Schema = Type.Union(
  [
    Type.Object(
      {
        ...runtimeStartReservationValidateErrorCommonV1,
        code: Type.Union(
          [
            "authorization_scope_mismatch",
            "stale_start_fence",
            "start_cancelled",
            "reservation_terminal",
            "idempotency_conflict",
          ].map((code) => Type.Literal(code)),
        ),
        retryable: Type.Literal(false),
        details: Type.Object(
          runtimeStartReservationValidateBoundDetailsV1,
          { additionalProperties: false },
        ),
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        ...runtimeStartReservationValidateErrorCommonV1,
        code: Type.Literal("schema_validation_failed"),
        retryable: Type.Literal(false),
        details: Type.Object(
          {
            trigger_process_id: Type.Union([
              RuntimeStartReservationIdentifierV1Schema,
              Type.Null(),
            ]),
            start_attempt_no: Type.Union([
              TriggerProcessorPositiveVersionV1Schema,
              Type.Null(),
            ]),
            validation_stage: Type.Union([
              runtimeStartReservationValidateStageV1,
              Type.Null(),
            ]),
            field_path: Type.String({ minLength: 1, maxLength: 256 }),
            reason: Type.Union([
              Type.Literal("malformed_path"),
              Type.Literal("malformed_request"),
              Type.Literal("canonical_boundary_violation"),
            ]),
          },
          { additionalProperties: false },
        ),
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        ...runtimeStartReservationValidateErrorCommonV1,
        code: Type.Literal("storage_unavailable"),
        retryable: Type.Literal(true),
        details: Type.Object(
          {
            ...runtimeStartReservationValidateBoundDetailsV1,
            diagnostic_ref: Type.String({ minLength: 1, maxLength: 256 }),
          },
          { additionalProperties: false },
        ),
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        ...runtimeStartReservationValidateErrorCommonV1,
        code: Type.Literal("internal_error"),
        retryable: Type.Literal(false),
        details: Type.Object(
          {
            trigger_process_id: Type.Union([
              RuntimeStartReservationIdentifierV1Schema,
              Type.Null(),
            ]),
            start_attempt_no: Type.Union([
              TriggerProcessorPositiveVersionV1Schema,
              Type.Null(),
            ]),
            validation_stage: Type.Union([
              runtimeStartReservationValidateStageV1,
              Type.Null(),
            ]),
            diagnostic_ref: Type.String({ minLength: 1, maxLength: 256 }),
          },
          { additionalProperties: false },
        ),
      },
      { additionalProperties: false },
    ),
  ],
  {
    $id: "urn:pai:trigger-processor:runtime-start-reservation-validate-error:v1",
  },
);

export const RuntimeStartReservationValidateContractV1Schema = Type.Union(
  [
    RuntimeStartReservationValidateRequestV1Schema,
    RuntimeStartReservationValidateResponseV1Schema,
    RuntimeStartReservationValidateErrorV1Schema,
  ],
  {
    $id: "urn:pai:trigger-processor:runtime-start-reservation-validate:v1",
  },
);

export type RuntimeStartReservationValidationStageV1 =
  (typeof RUNTIME_START_RESERVATION_VALIDATION_STAGES_V1)[number];
export type RuntimeStartReservationValidateErrorCodeV1 =
  (typeof RUNTIME_START_RESERVATION_VALIDATE_ERROR_CODES_V1)[number];
export type RuntimeStartReservationValidateRequestV1 = Static<
  typeof RuntimeStartReservationValidateRequestV1Schema
>;
export type RuntimeStartReservationValidateResponseV1 = Static<
  typeof RuntimeStartReservationValidateResponseV1Schema
>;
export type RuntimeStartReservationValidateErrorV1 = Static<
  typeof RuntimeStartReservationValidateErrorV1Schema
>;

export function assertRuntimeStartReservationValidatePathBindingsV1(
  triggerProcessId: string,
  startAttemptNo: number,
): void {
  if (
    triggerProcessId.length < 1 ||
    triggerProcessId.length > 256 ||
    !Number.isSafeInteger(startAttemptNo) ||
    startAttemptNo < 1
  ) {
    throw new Error("Runtime Start reservation validate path is invalid");
  }
}
