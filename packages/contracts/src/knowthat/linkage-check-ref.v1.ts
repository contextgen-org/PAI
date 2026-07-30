import { Type, type Static } from "@sinclair/typebox";

export const KnowThatLinkageCheckRefV1Schema = Type.String({
  $id: "urn:pai:knowthat:linkage-check-ref:v1",
  minLength: 24,
  maxLength: 1_024,
  pattern: "^knowthat_linkage_check:[^\\r\\n]+$",
});

export type KnowThatLinkageCheckRefV1 = Static<
  typeof KnowThatLinkageCheckRefV1Schema
>;
