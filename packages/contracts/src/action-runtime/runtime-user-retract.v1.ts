import { type Static } from "@sinclair/typebox";

import { runtimeControlRequestV1Schema } from "./runtime-control-primitives.v1.js";

export const RuntimeUserRetractContractV1Schema =
  runtimeControlRequestV1Schema("user_retract");
RuntimeUserRetractContractV1Schema.$id =
  "urn:pai:action-runtime:runtime-user-retract:v1";

export type RuntimeUserRetractContractV1 = Static<
  typeof RuntimeUserRetractContractV1Schema
>;
