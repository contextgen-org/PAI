import { createHash } from "node:crypto";

import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  canonicalJsonV1,
  MetaCommandClaimContractV1Schema,
  MetaCommandClaimRequestV1Schema,
  MetaCommandClaimResponseV1Schema,
  MetaCommandSettlementContractV1Schema,
  MetaCommandSettlementRequestV1Schema,
  MetaCommandSettlementResponseV1Schema,
  MetaDurableCommandV1Schema,
  assertMetaCommandClaimSemanticBindingsV1,
  assertMetaCommandSettlementSemanticBindingsV1,
  assertMetaDurableCommandSemanticBindingsV1,
} from "../../src/index.js";
import {
  at,
  hashA,
  later,
  scope,
} from "./owner-fixtures.v1.js";

function hash(value: unknown): `sha256:${string}` {
  return `sha256:${createHash("sha256")
    .update(canonicalJsonV1(value), "utf8")
    .digest("hex")}`;
}

const memoryItem = {
  client_item_id: "memory-item-1",
  content_summary: "A durable memory item",
  subject_refs: [{ subject_type: "project", canonical_id: "project-1" }],
  human_agent_relation: [],
  keyword_tags: ["meta"],
  scene_tags: ["implementation"],
  emotion_tags: ["neutral"],
  source_info: {
    source_type: "trigger_snapshot",
    source_ref: "trigger_process:process-1",
    actor_type: "system",
  },
  confidence_score: 0.9,
  occurred_at: at,
} as const;

const memoryOwnerRequest = {
  schema_version: "memory.write_batch.v1",
  bot_id: scope.bot_id,
  trigger_process_id: "process-1",
  source_meta_job_id: "job-1",
  idempotency_key: "memory-original-1",
  items: [memoryItem],
} as const;

const pendingCommand = {
  command_id: "command-1",
  kind: "compensation",
  source_job_lease_generation: 7,
  meta_job_id: "job-1",
  scope,
  target_service: "memory",
  payload: {
    schema_version: "meta_compensation_request.v1",
    target_service: "memory",
    item_id: "memory-item-1",
    reason_code: "memory_write_failed",
    retryable: true,
    dispatch_mode: "original_request_replay",
    failed_item: {
      client_item_id: "memory-item-1",
      item_hash: hash(memoryItem),
      source_owner_request_hash: hash(memoryOwnerRequest),
      source_idempotency_key: memoryOwnerRequest.idempotency_key,
    },
    owner_request: memoryOwnerRequest,
    owner_request_hash: hash(memoryOwnerRequest),
  },
  payload_hash: hashA,
  idempotency_key: "job-1:compensate:memory:memory-item-1",
  status: "pending",
  attempt_count: 0,
  lease_generation: 0,
  claimed_by: null,
  lease_expires_at: null,
  next_retry_at: null,
  settlement_id: null,
  settlement_hash: null,
  result_ref: null,
  last_error: null,
  trace_id: "trace-1",
  created_at: at,
  updated_at: at,
} as const;

const claimRequest = {
  worker_id: "worker-1",
  limit: 10,
  lease_seconds: 60,
  trace_id: "trace-claim-1",
} as const;

const claimedCommand = {
  ...pendingCommand,
  status: "claimed",
  attempt_count: 1,
  lease_generation: 1,
  claimed_by: claimRequest.worker_id,
  lease_expires_at: later,
  updated_at: at,
} as const;

const pendingSkillCommand = {
  command_id: "skill-delivery-1",
  kind: "skill_candidate_application",
  meta_job_id: pendingCommand.meta_job_id,
  scope,
  target_service: "skill_registry",
  payload: {
    schema_version: "skill_candidate_application.v1",
    application_id: "skill-application-1",
    candidate_id: "candidate-1",
    review_version: 2,
    candidate_type: "new_skill",
    skill_key: "candidate-skill",
    ...scope,
    baseline_catalog_version: "catalog-1",
    proposal_ref: "proposal-1",
    proposal_hash: hashA,
    evidence_refs: [{ ref: "evidence-1", hash: hashA }],
    reviewer_principal_id: "reviewer-1",
    idempotency_key: "skill-application-1",
    trace_id: "trace-1",
  },
  payload_hash: hashA,
  idempotency_key: "skill-application-1",
  status: "pending",
  attempt_count: 0,
  lease_generation: 0,
  claimed_by: null,
  lease_expires_at: null,
  next_retry_at: null,
  settlement_id: null,
  settlement_hash: null,
  result_ref: null,
  last_error: null,
  trace_id: "trace-1",
  created_at: at,
  updated_at: at,
} as const;

describe("Meta durable command owner contracts", () => {
  it("accepts a bound pending command and rejects kind/payload drift", () => {
    expect(Value.Check(MetaDurableCommandV1Schema, pendingCommand)).toBe(
      true,
    );
    expect(() =>
      assertMetaDurableCommandSemanticBindingsV1(pendingCommand),
    ).not.toThrow();
    expect(
      Value.Check(MetaDurableCommandV1Schema, {
        ...pendingCommand,
        kind: "skill_candidate_application",
        target_service: "skill_registry",
      }),
    ).toBe(false);
    expect(() =>
      assertMetaDurableCommandSemanticBindingsV1({
        ...pendingCommand,
        target_service: "knowthat",
      }),
    ).toThrow(/semantic binding/u);
    for (const removedAlias of [
      "commit_unknown_replay",
      "explicit_item_retry",
    ]) {
      expect(
        Value.Check(MetaDurableCommandV1Schema, {
          ...pendingCommand,
          payload: {
            ...pendingCommand.payload,
            dispatch_mode: removedAlias,
          },
        }),
      ).toBe(false);
    }
    expect(
      Value.Check(MetaDurableCommandV1Schema, pendingSkillCommand),
    ).toBe(true);
    expect(() =>
      assertMetaDurableCommandSemanticBindingsV1(pendingSkillCommand),
    ).not.toThrow();
    expect(() =>
      assertMetaDurableCommandSemanticBindingsV1({
        ...pendingSkillCommand,
        scope: {
          ...scope,
          workspace_id: "other-workspace",
        },
      }),
    ).toThrow(/semantic binding/u);
  });

  it("binds claimed commands to the worker, limit, unique command, and idempotency identities", () => {
    expect(
      Value.Check(MetaCommandClaimRequestV1Schema, claimRequest),
    ).toBe(true);
    expect(
      Value.Check(MetaCommandClaimResponseV1Schema, [claimedCommand]),
    ).toBe(true);
    expect(
      Value.Check(MetaCommandClaimContractV1Schema, claimRequest),
    ).toBe(true);
    expect(
      Value.Check(MetaCommandClaimContractV1Schema, [claimedCommand]),
    ).toBe(true);
    expect(() =>
      assertMetaCommandClaimSemanticBindingsV1(
        claimRequest,
        [claimedCommand],
      ),
    ).not.toThrow();

    expect(() =>
      assertMetaCommandClaimSemanticBindingsV1(
        { ...claimRequest, limit: 1 },
        [
          claimedCommand,
          {
            ...claimedCommand,
            command_id: "command-2",
            idempotency_key: "command-2-key",
          },
        ],
      ),
    ).toThrow(/semantic binding/u);
    expect(() =>
      assertMetaCommandClaimSemanticBindingsV1(claimRequest, [
        { ...claimedCommand, claimed_by: "other-worker" },
      ]),
    ).toThrow(/semantic binding/u);
  });

  it.each([
    [
      {
        worker_id: "worker-1",
        lease_generation: 1,
        settlement_id: "settlement-retry-1",
        outcome: "retry_wait",
        result_ref: null,
        error_code: "dependency_unavailable",
        next_retry_at: later,
        trace_id: "trace-settle-2",
      },
      {
        command_id: "command-1",
        status: "retry_wait",
        duplicate_replayed: false,
        result_status: "partial_pending",
        result_version: 2,
      },
    ],
    [
      {
        worker_id: "worker-1",
        lease_generation: 1,
        settlement_id: "settlement-failed-1",
        outcome: "failed",
        result_ref: null,
        error_code: "attempt_budget_exhausted",
        next_retry_at: null,
        trace_id: "trace-settle-3",
      },
      {
        command_id: "command-1",
        status: "failed",
        duplicate_replayed: true,
        result_status: "partial_failed",
        result_version: 3,
      },
    ],
  ] as const)(
    "validates settlement request/response semantics",
    (settlementRequest, settlementResponse) => {
      expect(
        Value.Check(
          MetaCommandSettlementRequestV1Schema,
          settlementRequest,
        ),
      ).toBe(true);
      expect(
        Value.Check(
          MetaCommandSettlementResponseV1Schema,
          settlementResponse,
        ),
      ).toBe(true);
      expect(
        Value.Check(
          MetaCommandSettlementContractV1Schema,
          settlementRequest,
        ),
      ).toBe(true);
      expect(() =>
        assertMetaCommandSettlementSemanticBindingsV1(
          "command-1",
          settlementRequest,
          settlementResponse,
          Date.parse(at),
        ),
      ).not.toThrow();
    },
  );

  it("closes the public opaque-success settlement bypass", () => {
    expect(
      Value.Check(MetaCommandSettlementRequestV1Schema, {
        worker_id: "worker-1",
        lease_generation: 1,
        settlement_id: "settlement-success-1",
        outcome: "succeeded",
        result_ref: "memory-result-1",
        error_code: null,
        next_retry_at: null,
        trace_id: "trace-settle-1",
      }),
    ).toBe(false);
  });

  it("rejects settlement path, outcome field, retry clock, and result pair drift", () => {
    const retryRequest = {
      worker_id: "worker-1",
      lease_generation: 1,
      settlement_id: "settlement-retry-1",
      outcome: "retry_wait",
      result_ref: null,
      error_code: "dependency_unavailable",
      next_retry_at: later,
      trace_id: "trace-settle-2",
    } as const;
    const retryResponse = {
      command_id: "command-1",
      status: "retry_wait",
      duplicate_replayed: false,
      result_status: "partial_pending",
      result_version: 2,
    } as const;

    expect(() =>
      assertMetaCommandSettlementSemanticBindingsV1(
        "other-command",
        retryRequest,
        retryResponse,
        Date.parse(at),
      ),
    ).toThrow(/semantic binding/u);
    expect(() =>
      assertMetaCommandSettlementSemanticBindingsV1(
        "command-1",
        { ...retryRequest, next_retry_at: at },
        retryResponse,
        Date.parse(at),
      ),
    ).toThrow(/semantic binding/u);
    expect(() =>
      assertMetaCommandSettlementSemanticBindingsV1(
        "command-1",
        retryRequest,
        { ...retryResponse, result_version: null },
        Date.parse(at),
      ),
    ).toThrow(/semantic binding/u);
  });
});
