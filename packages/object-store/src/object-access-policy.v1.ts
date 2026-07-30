import type { ServiceIdV1 } from "@pai/contracts";

import type {
  ObjectRefV1,
  ObjectScopeV1,
} from "./object-store-port.v1.js";

export type ObjectAccessOperationV1 =
  | "head"
  | "get"
  | "grant"
  | "delete";

export interface VerifyObjectAccessDecisionInputV1 {
  readonly access_decision_ref: string;
  readonly operation: ObjectAccessOperationV1;
  readonly object_ref: ObjectRefV1;
  readonly owner_service: ServiceIdV1;
  readonly owner_object_id: string;
  readonly owner_state_version: number;
  readonly scope: ObjectScopeV1;
  readonly scope_fingerprint: string;
  readonly capability: string;
  readonly retention_policy_version: string;
  readonly redaction_policy_version: string;
}

export interface VerifiedObjectAccessDecisionV1
  extends VerifyObjectAccessDecisionInputV1 {
  readonly authorized: true;
  readonly retention_until: string;
}

/**
 * Owner implementations must resolve the current durable decision, reject stale
 * retention/redaction versions, and bind every returned field to the opaque ref.
 */
export interface ObjectAccessPolicyVerifierV1 {
  verify(
    input: VerifyObjectAccessDecisionInputV1,
  ): Promise<VerifiedObjectAccessDecisionV1>;
}
