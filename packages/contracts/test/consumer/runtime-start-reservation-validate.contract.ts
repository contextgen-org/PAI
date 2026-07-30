import {
  RuntimeStartReservationValidateContractV1Schema,
  RuntimeStartReservationValidateErrorV1Schema,
  RuntimeStartReservationValidateRequestV1Schema,
  RuntimeStartReservationValidateResponseV1Schema,
  TRIGGER_PROCESSOR_SCHEMA_CATALOG,
  assertRuntimeStartReservationValidatePathBindingsV1,
} from "../../src/index.js";
import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

const plaintextRequest = {
  schema_version: "runtime_start_reservation_validate_request.v1",
  runtime_run_id: "run-1",
  start_fence_token: "fence-token-1",
  request_hash: `sha256:${"a".repeat(64)}`,
  validation_stage: "request_received",
  trace_id: "trace-1",
} as const;

describe("TP to Runtime Start reservation validation contract", () => {
  it("registers the live v1.1.0 owner contract revision", () => {
    expect(
      TRIGGER_PROCESSOR_SCHEMA_CATALOG.find(
        ({ schema_name }) =>
          schema_name === "RuntimeStartReservationValidateContractV1",
      )?.version,
    ).toBe("1.1.0");
  });

  it("freezes stage-exclusive fence proof and the exact success shape", () => {
    for (const validation_stage of [
      "request_received",
      "preflight_completed",
    ] as const) {
      expect(
        Value.Check(RuntimeStartReservationValidateRequestV1Schema, {
          ...plaintextRequest,
          validation_stage,
        }),
      ).toBe(true);
      for (const reservation_status of [
        "reserved",
        "dispatching",
        "queued",
      ] as const) {
        expect(
          Value.Check(RuntimeStartReservationValidateResponseV1Schema, {
            schema_version:
              "runtime_start_reservation_validate_response.v1",
            validation_result: "valid",
            reservation_status,
            validated_fence_generation: 7,
            validation_stage,
            duplicate_replayed: false,
            trace_id: "trace-1",
          }),
        ).toBe(true);
      }
      expect(
        Value.Check(RuntimeStartReservationValidateResponseV1Schema, {
          schema_version:
            "runtime_start_reservation_validate_response.v1",
          validation_result: "valid",
          reservation_status: "dispatching",
          validated_fence_generation: 7,
          validation_stage,
          duplicate_replayed: false,
          trace_id: "trace-1",
        }),
      ).toBe(true);
    }
    const beforeRunning = {
      schema_version: "runtime_start_reservation_validate_request.v1",
      runtime_run_id: "run-1",
      start_fence_token_hash: `sha256:${"b".repeat(64)}`,
      request_hash: plaintextRequest.request_hash,
      validation_stage: "before_running",
      trace_id: "trace-1",
    } as const;
    expect(
      Value.Check(
        RuntimeStartReservationValidateRequestV1Schema,
        beforeRunning,
      ),
    ).toBe(true);
    expect(
      Value.Check(RuntimeStartReservationValidateContractV1Schema, beforeRunning),
    ).toBe(true);
    expect(
      Value.Check(RuntimeStartReservationValidateResponseV1Schema, {
        schema_version: "runtime_start_reservation_validate_response.v1",
        validation_result: "valid",
        reservation_status: "dispatching",
        validated_fence_generation: 7,
        validation_stage: "before_running",
        duplicate_replayed: false,
        trace_id: "trace-1",
      }),
    ).toBe(true);
    expect(
      Value.Check(RuntimeStartReservationValidateResponseV1Schema, {
        schema_version: "runtime_start_reservation_validate_response.v1",
        validation_result: "valid",
        reservation_status: "dispatching",
        validated_fence_generation: 7,
        validation_stage: "before_running",
        duplicate_replayed: true,
        trace_id: "trace-1",
      }),
    ).toBe(false);
  });

  it("freezes the exact owner error envelope", () => {
    const businessError = {
      schema_version: "runtime_start_reservation_validate_error.v1",
      code: "stale_start_fence",
      message: "Runtime Start reservation validation failed",
      retryable: false,
      trace_id: "trace-1",
      details: {
        trigger_process_id: "process-1",
        start_attempt_no: 1,
        validation_stage: "preflight_completed",
      },
    } as const;
    expect(
      Value.Check(
        RuntimeStartReservationValidateErrorV1Schema,
        businessError,
      ),
    ).toBe(true);
    expect(
      Value.Check(
        RuntimeStartReservationValidateContractV1Schema,
        businessError,
      ),
    ).toBe(true);
    expect(
      Value.Check(RuntimeStartReservationValidateErrorV1Schema, {
        ...businessError,
        details: { ...businessError.details, unexpected: true },
      }),
    ).toBe(false);

    const schemaError = {
      schema_version: "runtime_start_reservation_validate_error.v1",
      code: "schema_validation_failed",
      message: "Runtime Start reservation validation request is invalid",
      retryable: false,
      trace_id: "trace-1",
      details: {
        trigger_process_id: "process-1",
        start_attempt_no: 1,
        validation_stage: null,
        field_path: "/body/validation_stage",
        reason: "malformed_request",
      },
    } as const;
    expect(
      Value.Check(
        RuntimeStartReservationValidateErrorV1Schema,
        schemaError,
      ),
    ).toBe(true);
    expect(
      Value.Check(RuntimeStartReservationValidateErrorV1Schema, {
        ...schemaError,
        details: {
          ...schemaError.details,
          validation_stage: "invented_stage",
        },
      }),
    ).toBe(false);

    const storageError = {
      schema_version: "runtime_start_reservation_validate_error.v1",
      code: "storage_unavailable",
      message: "Runtime Start reservation validation is unavailable",
      retryable: true,
      trace_id: "trace-1",
      details: {
        trigger_process_id: "process-1",
        start_attempt_no: 1,
        validation_stage: "request_received",
        diagnostic_ref: "runtime_start_reservation_validation:postgres",
      },
    } as const;
    expect(
      Value.Check(
        RuntimeStartReservationValidateErrorV1Schema,
        storageError,
      ),
    ).toBe(true);
    expect(
      Value.Check(RuntimeStartReservationValidateErrorV1Schema, {
        ...storageError,
        retryable: false,
      }),
    ).toBe(false);

    expect(
      Value.Check(RuntimeStartReservationValidateErrorV1Schema, {
        schema_version: "runtime_start_reservation_validate_error.v1",
        code: "internal_error",
        message: "Runtime Start reservation validation failed internally",
        retryable: false,
        trace_id: "trace-1",
        details: {
          trigger_process_id: null,
          start_attempt_no: null,
          validation_stage: null,
          diagnostic_ref: "runtime_start_reservation_validation:internal",
        },
      }),
    ).toBe(true);
  });

  it("rejects plaintext/hash mixing and the wrong proof for each stage", () => {
    expect(
      Value.Check(RuntimeStartReservationValidateRequestV1Schema, {
        ...plaintextRequest,
        start_fence_token_hash: `sha256:${"b".repeat(64)}`,
      }),
    ).toBe(false);
    expect(
      Value.Check(RuntimeStartReservationValidateRequestV1Schema, {
        ...plaintextRequest,
        validation_stage: "before_running",
      }),
    ).toBe(false);
    expect(
      Value.Check(RuntimeStartReservationValidateRequestV1Schema, {
        ...plaintextRequest,
        start_fence_token_hash: `sha256:${"b".repeat(64)}`,
        validation_stage: "before_running",
      }),
    ).toBe(false);
    expect(
      Value.Check(RuntimeStartReservationValidateRequestV1Schema, {
        schema_version: "runtime_start_reservation_validate_request.v1",
        runtime_run_id: "run-1",
        start_fence_token_hash: `sha256:${"b".repeat(64)}`,
        request_hash: plaintextRequest.request_hash,
        validation_stage: "request_received",
        trace_id: "trace-1",
      }),
    ).toBe(false);
    expect(
      Value.Check(
        RuntimeStartReservationValidateContractV1Schema,
        plaintextRequest,
      ),
    ).toBe(true);
  });

  it("rejects body/path aliases, unsafe attempts and additional properties", () => {
    expect(
      Value.Check(RuntimeStartReservationValidateRequestV1Schema, {
        ...plaintextRequest,
        trigger_process_id: "process-1",
      }),
    ).toBe(false);
    expect(() =>
      assertRuntimeStartReservationValidatePathBindingsV1(
        "process-1",
        Number.MAX_SAFE_INTEGER + 1,
      ),
    ).toThrow(/path is invalid/u);
    expect(() =>
      assertRuntimeStartReservationValidatePathBindingsV1("", 1),
    ).toThrow(/path is invalid/u);
    expect(() =>
      assertRuntimeStartReservationValidatePathBindingsV1(
        "p".repeat(257),
        1,
      ),
    ).toThrow(/path is invalid/u);
    expect(
      Value.Check(RuntimeStartReservationValidateRequestV1Schema, {
        ...plaintextRequest,
        start_fence_token: "f".repeat(4_097),
      }),
    ).toBe(false);
  });
});
