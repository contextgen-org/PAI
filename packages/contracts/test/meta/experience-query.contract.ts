import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  MetaExperienceQueryContractV1Schema,
  MetaExperienceQueryRequestV1Schema,
  MetaExperienceQueryResponseV1Schema,
} from "../../src/index.js";
import { at, scope } from "./owner-fixtures.v1.js";

describe("MetaExperienceQueryContractV1", () => {
  it("owns both five-part scoped request and redacted response", () => {
    expect(
      Value.Check(MetaExperienceQueryRequestV1Schema, {
        trigger_process_id: "process-1",
        ...scope,
        trace_id: "trace-1",
      }),
    ).toBe(true);
    const response = {
      trigger_process_id: "process-1",
      bot_id: "bot-1",
      experience_record_id: "experience-1",
      status: "available",
      summary: "Executed the requested task",
      execution_summary: {
        task_stages: ["runtime"],
        major_results: ["completed"],
        failure_summaries: [],
        artifact_refs: ["artifact:result-1"],
      },
      evidence_refs: ["trigger_process:process-1"],
      quality_score: 0.9,
      created_at: at,
      trace_id: "trace-1",
    };
    expect(Value.Check(MetaExperienceQueryResponseV1Schema, response)).toBe(
      true,
    );
    expect(Value.Check(MetaExperienceQueryContractV1Schema, response)).toBe(
      true,
    );
  });

  it("does not expose a summary before the record is available", () => {
    expect(
      Value.Check(MetaExperienceQueryResponseV1Schema, {
        trigger_process_id: "process-1",
        bot_id: "bot-1",
        experience_record_id: null,
        status: "pending",
        summary: "leak",
        execution_summary: null,
        evidence_refs: [],
        quality_score: null,
        created_at: null,
        trace_id: "trace-1",
      }),
    ).toBe(false);
  });
});
