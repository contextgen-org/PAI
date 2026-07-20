import { Type, type Static } from "@sinclair/typebox";

export const RELEASE_CHANNELS = ["stable", "canary"] as const;

export const ReleaseChannelV1Schema = Type.Union(
  RELEASE_CHANNELS.map((channel) => Type.Literal(channel)),
  { $id: "urn:pai:shared:release-channel:v1" },
);

export type ReleaseChannelV1 = Static<typeof ReleaseChannelV1Schema>;
