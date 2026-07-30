import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  assertMetaResultPayloadSemanticBindingsV1,
  MetaResultPayloadV1Schema,
} from "../../src/index.js";
import {
  metaResultPayload,
  partialFailure,
} from "./owner-fixtures.v1.js";

describe("MetaResultPayloadV1", () => {
  it("accepts the single complete top-level result schema", () => {
    const payload = metaResultPayload();
    expect(Value.Check(MetaResultPayloadV1Schema, payload)).toBe(true);
    expect(() =>
      assertMetaResultPayloadSemanticBindingsV1(payload as never),
    ).not.toThrow();
  });

  it("requires partial_pending to have active durable compensation", () => {
    const payload = metaResultPayload({
      result_status: "partial_pending",
      partial_failures: [partialFailure()],
    });
    expect(Value.Check(MetaResultPayloadV1Schema, payload)).toBe(true);
    expect(() =>
      assertMetaResultPayloadSemanticBindingsV1(payload as never),
    ).not.toThrow();
    expect(() =>
      assertMetaResultPayloadSemanticBindingsV1(
        {
          ...payload,
          result_status: "complete",
        } as never,
      ),
    ).toThrow(/semantic binding/);
  });

  it("requires Catalog metadata whenever a Skill candidate exists", () => {
    const payload = metaResultPayload({
      skill_candidates: [
        {
          candidate_id: "candidate-1",
          candidate_type: "new_skill",
          skill_key: "summarize",
          workspace_id: "workspace-1",
          bot_id: "bot-1",
          owner_agent_id: "agent-1",
          deployment_environment: "dev",
          release_channel: "stable",
          baseline_catalog_version: "cat-1",
          proposal_ref: "proposal-1",
          proposal_hash:
            "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          evidence_refs: ["artifact:proposal-1"],
          status: "proposed",
          review_version: 1,
          delivery_id: null,
          application_id: null,
          downstream_ref: null,
          downstream_status: "pending",
          attempt_count: 0,
          last_error: null,
        },
      ],
    });
    expect(Value.Check(MetaResultPayloadV1Schema, payload)).toBe(true);
    expect(() =>
      assertMetaResultPayloadSemanticBindingsV1(payload as never),
    ).toThrow(/semantic binding/);
  });
});
