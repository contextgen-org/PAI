import { type Static } from "@sinclair/typebox";

import { runtimeControlRequestV1Schema } from "./runtime-control-primitives.v1.js";

export const RuntimeCancelContractV1Schema = runtimeControlRequestV1Schema(
  "cancel",
);
RuntimeCancelContractV1Schema.$id = "urn:pai:action-runtime:runtime-cancel:v1";

export type RuntimeCancelContractV1 = Static<
  typeof RuntimeCancelContractV1Schema
>;
