import { type Static } from "@sinclair/typebox";

import { runtimeControlRequestV1Schema } from "./runtime-control-primitives.v1.js";

export const RuntimePreemptContractV1Schema = runtimeControlRequestV1Schema(
  "preempt",
);
RuntimePreemptContractV1Schema.$id = "urn:pai:action-runtime:runtime-preempt:v1";

export type RuntimePreemptContractV1 = Static<
  typeof RuntimePreemptContractV1Schema
>;
