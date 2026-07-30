import { Type, type Static } from "@sinclair/typebox";

import { JsonSafePositiveIntegerV1 } from "../shared/json-safe-integer.v1.js";
import { TriggerProcessorIdentifierV1Schema } from "../trigger-processor/index-internal.v1.js";
import {
  ToolPermissionProfileSelectorV1Schema,
  ToolPermissionProfileV1Schema,
} from "./tool-permission-profile.v1.js";

export const ToolPermissionProfileCurrentReadRequestV1Schema = Type.Object(
  {
    schema_version: Type.Literal(
      "tool_permission_profile_current_read_request.v1",
    ),
    selector: ToolPermissionProfileSelectorV1Schema,
    trace_id: TriggerProcessorIdentifierV1Schema,
  },
  { additionalProperties: false },
);

export const ToolPermissionProfileCurrentReadSuccessV1Schema = Type.Object(
  {
    code: Type.Literal("tool_permission_profile_current"),
    message: Type.String({ minLength: 1, maxLength: 4_096 }),
    retryable: Type.Literal(false),
    details: Type.Object(
      {
        profile: ToolPermissionProfileV1Schema,
        pointer_version: JsonSafePositiveIntegerV1,
      },
      { additionalProperties: false },
    ),
    trace_id: TriggerProcessorIdentifierV1Schema,
  },
  { additionalProperties: false },
);

export const TOOL_PERMISSION_PROFILE_CURRENT_READ_ERROR_CODES_V1 = [
  "authorization_scope_mismatch",
  "tool_permission_profile_not_found",
  "owner_contract_drift",
  "storage_unavailable",
] as const;

export const ToolPermissionProfileCurrentReadErrorV1Schema = Type.Object(
  {
    code: Type.Union(
      TOOL_PERMISSION_PROFILE_CURRENT_READ_ERROR_CODES_V1.map((code) =>
        Type.Literal(code),
      ),
    ),
    message: Type.String({ minLength: 1, maxLength: 4_096 }),
    retryable: Type.Boolean(),
    details: Type.Object({}, { additionalProperties: false }),
    trace_id: TriggerProcessorIdentifierV1Schema,
  },
  { additionalProperties: false },
);

export const ToolPermissionProfileCurrentReadContractV1Schema = Type.Union(
  [
    ToolPermissionProfileCurrentReadRequestV1Schema,
    ToolPermissionProfileCurrentReadSuccessV1Schema,
    ToolPermissionProfileCurrentReadErrorV1Schema,
  ],
  { $id: "urn:pai:action-runtime:tool-permission-profile-current-read:v1" },
);

export type ToolPermissionProfileCurrentReadRequestV1 = Static<
  typeof ToolPermissionProfileCurrentReadRequestV1Schema
>;
export type ToolPermissionProfileCurrentReadSuccessV1 = Static<
  typeof ToolPermissionProfileCurrentReadSuccessV1Schema
>;
export type ToolPermissionProfileCurrentReadErrorV1 = Static<
  typeof ToolPermissionProfileCurrentReadErrorV1Schema
>;

export function assertToolPermissionProfileCurrentReadBindingV1(
  request: ToolPermissionProfileCurrentReadRequestV1,
  response: ToolPermissionProfileCurrentReadSuccessV1,
): void {
  const selector = response.details.profile.selector;
  if (
    selector.workspace_id !== request.selector.workspace_id ||
    selector.bot_id !== request.selector.bot_id ||
    selector.owner_agent_id !== request.selector.owner_agent_id ||
    selector.deployment_environment !==
      request.selector.deployment_environment ||
    selector.release_channel !== request.selector.release_channel ||
    response.trace_id !== request.trace_id
  ) {
    throw new Error(
      "ToolPermissionProfileCurrentReadContractV1 scope binding mismatch",
    );
  }
}
