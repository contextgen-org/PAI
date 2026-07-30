import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  SKILL_CATALOG_QUERY_MAX_LIMIT_V1,
  SKILL_CATALOG_INVALID_CURSOR_REASONS_V1,
  SkillCatalogInvalidCursorV1Schema,
  SkillCatalogQueryRequestV1Schema,
  SkillCatalogQueryResponseV1Schema,
  assertSkillCatalogCursorBindingsV1,
  assertSkillCatalogQuerySemanticBindingsV1,
} from "../../src/index.js";

const hash = `sha256:${"e".repeat(64)}` as const;

describe("SkillCatalogQueryContractV1", () => {
  it("pins the first page revision, summary, epoch and five-tuple", () => {
    const request = {
      schema_version: "skill_catalog_query.v1",
      workspace_id: "ws_01",
      bot_id: "bot_01",
      owner_agent_id: "agent_01",
      deployment_environment: "prod",
      release_channel: "stable",
      as_of: "2026-07-24T00:00:00.000Z",
      filter: "lark",
      limit: 50,
      trace_id: "trace_01",
    } as const;
    const response = {
      code: "skill_catalog_found",
      message: "found",
      retryable: false,
      trace_id: "trace_01",
      details: {
        schema_version: "skill_catalog_response.v1",
        workspace_id: "ws_01",
        bot_id: "bot_01",
        owner_agent_id: "agent_01",
        deployment_environment: "prod",
        release_channel: "stable",
        catalog_revision_id: "catalog_revision_01",
        catalog_version: "cat_184",
        as_of: "2026-07-24T00:00:00.000Z",
        security_revocation_epoch: 4,
        skill_permission_summary_ref: "summary_01",
        skill_permission_summary_hash: hash,
        items: [],
        next_cursor: null,
      },
    } as const;
    expect(Value.Check(SkillCatalogQueryRequestV1Schema, request)).toBe(true);
    expect(Value.Check(SkillCatalogQueryResponseV1Schema, response)).toBe(true);
    expect(() =>
      assertSkillCatalogQuerySemanticBindingsV1(request, response),
    ).not.toThrow();
    expect(() =>
      assertSkillCatalogQuerySemanticBindingsV1(request, {
        ...response,
        trace_id: "trace_spoof",
      }),
    ).toThrow(/binding mismatch/u);
  });

  it("requires every cursor AAD binding and exposes only closed recovery reasons", () => {
    const bindings = {
      workspace_id: "ws_01",
      bot_id: "bot_01",
      owner_agent_id: "agent_01",
      deployment_environment: "prod",
      release_channel: "stable",
      principal_id: "principal_01",
      authorization_context_hash: hash,
      catalog_version: "cat_184",
      as_of: "2026-07-24T00:00:00.000Z",
      security_revocation_epoch: 4,
      skill_permission_summary_ref: "summary_01",
      skill_permission_summary_hash: hash,
      limit: 50,
      filter_hash: hash,
      schema_version: "skill_catalog_query.v1",
    } as const;
    expect(() =>
      assertSkillCatalogCursorBindingsV1(bindings, bindings),
    ).not.toThrow();
    expect(() =>
      assertSkillCatalogCursorBindingsV1(bindings, {
        ...bindings,
        skill_permission_summary_hash: `sha256:${"f".repeat(64)}`,
      }),
    ).toThrow(/context changed/u);
    expect(SKILL_CATALOG_INVALID_CURSOR_REASONS_V1).toEqual([
      "malformed",
      "context_changed",
      "expired",
    ]);
    expect(
      Value.Check(SkillCatalogInvalidCursorV1Schema, {
        code: "invalid_cursor",
        message: "restart",
        retryable: false,
        trace_id: "trace_01",
        details: {
          reason: "context_changed",
          restart_from_first_page: true,
        },
      }),
    ).toBe(true);
    expect(
      Value.Check(SkillCatalogInvalidCursorV1Schema, {
        code: "invalid_cursor",
        message: "restart",
        retryable: false,
        trace_id: "trace_01",
        reason_code: "context_changed",
        details: {
          reason: "context_changed",
          restart_from_first_page: true,
        },
      }),
    ).toBe(false);
    expect(
      Value.Check(SkillCatalogInvalidCursorV1Schema, {
        code: "invalid_cursor",
        message: "restart",
        retryable: false,
        trace_id: "trace_01",
        details: {
          reason: "context_changed",
          reason_code: "context_changed",
          restart_from_first_page: true,
        },
      }),
    ).toBe(false);
    expect(
      Value.Check(SkillCatalogInvalidCursorV1Schema, {
        code: "invalid_cursor",
        message: "restart",
        retryable: false,
        trace_id: "trace_01",
        details: {
          reason: "internal_mac_mismatch",
          restart_from_first_page: true,
        },
      }),
    ).toBe(false);
  });

  it("uses the documented 500-item hard page bound", () => {
    expect(
      Value.Check(SkillCatalogQueryRequestV1Schema, {
        schema_version: "skill_catalog_query.v1",
        workspace_id: "ws_01",
        bot_id: "bot_01",
        owner_agent_id: "agent_01",
        deployment_environment: "prod",
        release_channel: "stable",
        limit: SKILL_CATALOG_QUERY_MAX_LIMIT_V1,
        trace_id: "trace_01",
      }),
    ).toBe(true);
    expect(
      Value.Check(SkillCatalogQueryRequestV1Schema, {
        schema_version: "skill_catalog_query.v1",
        workspace_id: "ws_01",
        bot_id: "bot_01",
        owner_agent_id: "agent_01",
        deployment_environment: "prod",
        release_channel: "stable",
        limit: SKILL_CATALOG_QUERY_MAX_LIMIT_V1 + 1,
        trace_id: "trace_01",
      }),
    ).toBe(false);
  });
});
