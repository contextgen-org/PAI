import type { ExecuteOwnerWriterRequestV1 } from "../src/index.js";
import { TIMER_REPOSITORY_CONTRACT_V1 } from "../../../services/timer-trigger-app/src/db/permission-manifest.v1.js";

type CasTimerScheduleRequest = ExecuteOwnerWriterRequestV1<
  typeof TIMER_REPOSITORY_CONTRACT_V1,
  "cas_timer_schedule_v1"
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

const emptyArgumentsAreForbidden: CasTimerScheduleRequest = {
  writer: "cas_timer_schedule_v1",
  // @ts-expect-error Every argument is derived from the selected function signature.
  arguments: {},
  expected_rows: 1,
};

void validRequest;
void emptyArgumentsAreForbidden;
