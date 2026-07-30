import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { KnowThatCandidateReviewV1Schema } from "../../src/knowthat/candidate-review.v1.js";

describe("KnowThat candidate-review catalog contract", () => {
  it("owns both the request and result branches at the documented path", () => {
    expect(
      Value.Check(KnowThatCandidateReviewV1Schema, {
        review_id: "review-1",
        suggestion_id: "suggestion-1",
        candidate_id: "candidate-1",
        target_candidate_version: 3,
        status: "accepted",
        decision: "keep_candidate",
        linkage_check_ids: [],
        candidate_version_after: 4,
        duplicate_replayed: false,
        reason_code: "review_completed",
      }),
    ).toBe(true);
  });
});
