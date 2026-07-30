import { SERVICE_IDS, type ServiceIdV1 } from "@pai/contracts";

import { createFileObservationAccessAuditSpoolFromEnvV1 } from "./durable-audit-spool.v1.js";
import { ObservationApplicationV1 } from "./observation-application.v1.js";
import {
  createObservationProductionHttpPortsV1,
  createObservationWorkloadSignerFromEnvV1,
} from "./production-http-ports.v1.js";

function requiredEnvV1(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is required for Observation composition`);
  }
  return value;
}

export function parseObservationAllowedCallersV1(
  raw: string,
): readonly ServiceIdV1[] {
  const values = raw.split(",").map((value) => value.trim());
  if (
    values.length === 0 ||
    values.some(
      (value) =>
        value.length === 0 ||
        value === "observation_gateway" ||
        !SERVICE_IDS.includes(value as ServiceIdV1),
    ) ||
    new Set(values).size !== values.length
  ) {
    throw new Error(
      "PAI_OBSERVATION_ALLOWED_CALLERS must be a unique comma-separated registered service list",
    );
  }
  return Object.freeze(values as ServiceIdV1[]);
}

export function createObservationProductionCompositionV1(
  env: NodeJS.ProcessEnv,
): Readonly<{
  application: ObservationApplicationV1;
  allowed_callers: readonly ServiceIdV1[];
}> {
  const signer = createObservationWorkloadSignerFromEnvV1(env);
  const ports = createObservationProductionHttpPortsV1({
    trigger_processor_url: requiredEnvV1(env, "PAI_TRIGGER_PROCESSOR_URL"),
    action_runtime_url: requiredEnvV1(env, "PAI_ACTION_RUNTIME_URL"),
    meta_cognition_url: requiredEnvV1(env, "PAI_META_COGNITION_URL"),
    signer,
    ...(env.PAI_OBSERVATION_UPSTREAM_TIMEOUT_MS === undefined
      ? {}
      : { request_timeout_ms: Number(env.PAI_OBSERVATION_UPSTREAM_TIMEOUT_MS) }),
  });
  const audit = createFileObservationAccessAuditSpoolFromEnvV1(env);
  return Object.freeze({
    application: new ObservationApplicationV1(
      ports.trigger_processor,
      ports.runtime,
      ports.meta,
      audit,
      {
        owner_reads: ports.owner_reads,
        require_durable_audit_handoff: true,
      },
    ),
    allowed_callers: parseObservationAllowedCallersV1(
      requiredEnvV1(env, "PAI_OBSERVATION_ALLOWED_CALLERS"),
    ),
  });
}
