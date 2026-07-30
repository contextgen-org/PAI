import type { ExecuteOwnerWriterRequestV1 } from "../src/index.js";
import { ownerFunctionSignatureV1 } from "../src/index.js";
import { TIMER_REPOSITORY_CONTRACT_V1 } from "../../../services/timer-trigger-app/src/db/permission-manifest.v1.js";
import { ACTION_RUNTIME_REPOSITORY_CONTRACT_V1 } from "../../../services/action-runtime/src/db/permission-manifest.v1.js";

type CasTimerScheduleRequest = ExecuteOwnerWriterRequestV1<
  typeof TIMER_REPOSITORY_CONTRACT_V1,
  "cas_timer_schedule_v1"
>;

type AdvanceTimerScannerCheckpointRequest = ExecuteOwnerWriterRequestV1<
  typeof TIMER_REPOSITORY_CONTRACT_V1,
  "advance_timer_scanner_checkpoint_v1"
>;

type ClaimRuntimeArtifactReconciliationRequest =
  ExecuteOwnerWriterRequestV1<
    typeof ACTION_RUNTIME_REPOSITORY_CONTRACT_V1,
    "claim_runtime_artifact_reconciliation_v1"
  >;

const validRequest: CasTimerScheduleRequest = {
  writer: "cas_timer_schedule_v1",
  arguments: {
    p_schedule_id: "schedule-1",
    p_expected_schedule_version: "7",
    p_schedule_patch: { enabled: true },
    p_request_hash: "sha256:request",
    p_trace_id: "trace-1",
  },
  expected_rows: 1,
};

const validScannerCommit: AdvanceTimerScannerCheckpointRequest = {
  writer: "advance_timer_scanner_checkpoint_v1",
  arguments: {
    p_scanner_checkpoint_id: "timer-scan:scope-1",
    p_scanner_name: "timer-due-scanner",
    p_expected_scanned_until: "2026-07-24T00:00:00.000Z",
    p_next_scanned_until: "2026-07-24T00:01:00.000Z",
    p_lock_token: "scanner-lock-1",
    p_workspace_id: "workspace-1",
    p_bot_id: "bot-1",
    p_owner_agent_id: "agent-1",
    p_deployment_environment: "prod",
    p_release_channel: "stable",
    p_expected_schedule_versions: [
      { schedule_id: "schedule-1", expected_schedule_version: "7" },
    ],
    p_schedule_transitions: [
      { schedule_id: "schedule-1", next_fire_at: "2026-07-24T00:02:00.000Z" },
    ],
    p_occurrences: [
      { occurrence_id: "occurrence-1", schedule_id: "schedule-1" },
    ],
    p_catch_up_batches: [],
    p_idempotency_key: "timer-scan:scope-1:2026-07-24T00:01:00.000Z",
    p_request_hash: "sha256:request",
    p_trace_id: "trace-1",
  },
  expected_rows: 1,
};

const validRuntimeArtifactClaim:
  ClaimRuntimeArtifactReconciliationRequest = {
    writer: "claim_runtime_artifact_reconciliation_v1",
    arguments: {
      p_worker_id: "runtime-artifact-reconciler-1",
      p_limit: 16,
      p_lease_seconds: 30,
      p_now: "2026-07-24T00:00:00.000Z",
    },
    expected_rows: "zero_or_more",
  };

const runtimeArtifactClaimCannotOmitLease:
  ClaimRuntimeArtifactReconciliationRequest = {
    writer: "claim_runtime_artifact_reconciliation_v1",
    // @ts-expect-error Claim arguments are derived from the exact owner signature.
    arguments: {
      p_worker_id: "runtime-artifact-reconciler-1",
      p_limit: 16,
      p_now: "2026-07-24T00:00:00.000Z",
    },
    expected_rows: "zero_or_more",
  };

const emptyArgumentsAreForbidden: CasTimerScheduleRequest = {
  writer: "cas_timer_schedule_v1",
  // @ts-expect-error Every argument is derived from the selected function signature.
  arguments: {},
  expected_rows: 1,
};

const nullFenceIsForbidden: CasTimerScheduleRequest = {
  writer: "cas_timer_schedule_v1",
  arguments: {
    p_schedule_id: "schedule-1",
    // @ts-expect-error Fence arguments are non-null unless explicitly declared nullable.
    p_expected_schedule_version: null,
    p_schedule_patch: { enabled: true },
    p_request_hash: "sha256:request",
    p_trace_id: "trace-1",
  },
  expected_rows: 1,
};

const nullableSignature = ownerFunctionSignatureV1({
  schema: "timer",
  function_name: "nullable_test_v1",
  primary_table: "timer_schedules",
  writer_kind: "state_transition",
  arguments: [
    ["p_required", "text"],
    ["p_optional", "text", { nullable: true }],
  ],
  reads_tables: ["timer_schedules"],
  writes_tables: ["timer_schedules"],
  effects: [
    {
      table_name: "timer_schedules",
      operation: "transition",
      concurrency_control: "idempotency_key",
    },
  ],
  returns: "jsonb",
});

const nullableContract = {
  ...TIMER_REPOSITORY_CONTRACT_V1,
  mutable_writers: ["nullable_test_v1"],
  function_signatures: [nullableSignature],
} as const;

type NullableRequest = ExecuteOwnerWriterRequestV1<
  typeof nullableContract,
  "nullable_test_v1"
>;

const explicitNullableArgumentIsAllowed: NullableRequest = {
  writer: "nullable_test_v1",
  arguments: { p_required: "required", p_optional: null },
  expected_rows: 1,
};

const requiredArgumentStillRejectsNull: NullableRequest = {
  writer: "nullable_test_v1",
  arguments: {
    // @ts-expect-error Only p_optional carries explicit nullable metadata.
    p_required: null,
    p_optional: "optional",
  },
  expected_rows: 1,
};

void validRequest;
void validScannerCommit;
void validRuntimeArtifactClaim;
void runtimeArtifactClaimCannotOmitLease;
void emptyArgumentsAreForbidden;
void nullFenceIsForbidden;
void explicitNullableArgumentIsAllowed;
void requiredArgumentStillRejectsNull;
