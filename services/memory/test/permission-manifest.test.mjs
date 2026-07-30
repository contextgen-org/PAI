import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  createProductionMemoryCompositionV1,
} from "../dist/composition.v1.js";
import {
  MEMORY_REPOSITORY_CONTRACT_V1,
} from "../dist/db/permission-manifest.v1.js";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));

function writer(functionName) {
  const signature = MEMORY_REPOSITORY_CONTRACT_V1.function_signatures.find(
    ({ function_name }) => function_name === functionName,
  );
  assert.notEqual(signature, undefined, `missing writer ${functionName}`);
  return signature;
}

function effectIdentities(signature) {
  return signature.effects.map(
    ({ table_name, operation, concurrency_control }) =>
      `${table_name}:${operation}:${concurrency_control}`,
  );
}

test("mutable Memory points use one compatible lifecycle writer kind", () => {
  const permission = MEMORY_REPOSITORY_CONTRACT_V1.table_permissions.find(
    ({ table_name }) => table_name === "memory_points",
  );
  assert.equal(permission?.writer_kind, "state_transition");
  assert.equal(
    MEMORY_REPOSITORY_CONTRACT_V1.append_only_tables.includes(
      "memory_points",
    ),
    false,
  );
  assert.equal(
    writer("append_memory_point_v1").writer_kind,
    "state_transition",
  );
});

test("conflict resolution declares its complete atomic aggregate effects", () => {
  const signature = writer("transition_memory_conflict_v1");
  assert.deepEqual(
    signature.arguments.map(({ argument_name }) => argument_name),
    [
      "p_conflict_id",
      "p_expected_status",
      "p_expected_conflict_version",
      "p_expected_versions",
      "p_next_status",
      "p_resolution",
      "p_request_hash",
      "p_trace_id",
    ],
  );
  assert.deepEqual(signature.writes_tables, [
    "memory_conflicts",
    "memory_series",
    "memory_points",
    "memory_state_revisions",
    "memory_point_search_index",
    "topic_key_aliases",
    "memory_audit_logs",
    "memory_event_outbox",
    "memory_command_outbox",
  ]);
  assert.deepEqual(effectIdentities(signature), [
    "memory_conflicts:transition:expected_state_version",
    "memory_conflicts:transition:promotion_reservation_fence",
    "memory_series:transition:expected_state_version",
    "memory_points:transition:expected_state_version",
    "memory_state_revisions:append:expected_version",
    "memory_point_search_index:upsert:expected_version",
    "topic_key_aliases:append:idempotency_key",
    "memory_audit_logs:append:idempotency_key",
    "memory_event_outbox:enqueue:idempotency_key",
    "memory_command_outbox:enqueue:idempotency_key",
  ]);
});

test("direct feedback declares target, revision, projection, and evidence effects", () => {
  const signature = writer("append_memory_feedback_v1");
  assert.deepEqual(
    signature.arguments.map(({ argument_name }) => argument_name),
    [
      "p_feedback_id",
      "p_target_type",
      "p_target_id",
      "p_expected_state_version",
      "p_feedback",
      "p_request_hash",
      "p_trace_id",
    ],
  );
  assert.deepEqual(signature.writes_tables, [
    "memory_feedback_events",
    "memory_feedback_revision_refs",
    "memory_feedback_audit_refs",
    "memory_feedback_event_refs",
    "memory_points",
    "memory_series",
    "memory_conflicts",
    "memory_state_revisions",
    "memory_point_search_index",
    "memory_audit_logs",
    "memory_event_outbox",
  ]);
  assert.deepEqual(effectIdentities(signature), [
    "memory_feedback_events:append:idempotency_key",
    "memory_feedback_events:append:promotion_reservation_fence",
    "memory_feedback_revision_refs:append:idempotency_key",
    "memory_feedback_audit_refs:append:idempotency_key",
    "memory_feedback_event_refs:append:idempotency_key",
    "memory_points:transition:expected_state_version",
    "memory_series:transition:expected_state_version",
    "memory_conflicts:transition:expected_state_version",
    "memory_state_revisions:append:expected_version",
    "memory_point_search_index:upsert:expected_version",
    "memory_audit_logs:append:idempotency_key",
    "memory_event_outbox:enqueue:idempotency_key",
  ]);
});

test("promotion creation lets the owner allocate a fence and transitions require it", () => {
  const createSignature = writer(
    "record_memory_promotion_reservation_v1",
  );
  assert.equal(
    createSignature.reads_tables.includes(
      "memory_conflicts",
    ),
    true,
  );
  assert.equal(
    createSignature.arguments.some(
      ({ argument_name, postgres_type }) =>
        argument_name === "p_expected_fencing_generation" &&
        postgres_type === "bigint",
    ),
    false,
  );
  assert.equal(
    effectIdentities(createSignature).includes(
      "memory_promotion_reservations:append:generation_fence",
    ),
    false,
  );
  const signature = writer("transition_memory_promotion_v1");
  assert.equal(
    signature.arguments.some(
      ({ argument_name, postgres_type }) =>
        argument_name === "p_expected_fencing_generation" &&
        postgres_type === "bigint",
    ),
    true,
  );
  assert.equal(
    effectIdentities(signature).includes(
      "memory_promotion_reservations:transition:generation_fence",
    ),
    true,
  );
  const activeCandidateIndex =
    MEMORY_REPOSITORY_CONTRACT_V1.database_indexes?.find(
      ({ index_name }) =>
        index_name ===
        "memory_promotion_reservations_one_active_candidate_idx",
    );
  assert.equal(activeCandidateIndex?.unique, true);
  assert.match(activeCandidateIndex?.definition ?? "", /bot_id,\s*candidate_fact_id/u);
  assert.match(activeCandidateIndex?.definition ?? "", /status\s*=\s*'active'/u);
});

test("every point, series, or conflict mutator reads the active promotion fence", () => {
  const mutators = [
    "create_memory_series_v1",
    "transition_memory_series_v1",
    "append_memory_point_v1",
    "upsert_memory_relationship_projection_v1",
    "transition_memory_conflict_v1",
    "append_memory_feedback_v1",
  ];
  for (const name of mutators) {
    const signature = writer(name);
    assert.equal(
      signature.reads_tables.includes("memory_promotion_reservations"),
      true,
      `${name} does not inspect active promotion reservations`,
    );
    assert.equal(
      signature.reads_tables.includes(
        "memory_promotion_reservation_targets",
      ),
      true,
      `${name} does not inspect reserved aggregate targets`,
    );
  }
  for (const name of [
    "create_memory_series_v1",
    "transition_memory_series_v1",
    "append_memory_point_v1",
    "transition_memory_conflict_v1",
    "append_memory_feedback_v1",
  ]) {
    assert.equal(
      writer(name).effects.some(
        ({ concurrency_control, promotion_reservation_targets }) =>
          concurrency_control === "promotion_reservation_fence" &&
          (promotion_reservation_targets?.length ?? 0) > 0,
      ),
      true,
      `${name} does not declare exact promotion reservation target bindings`,
    );
  }
  assert.equal(
    writer("append_memory_pre_promotion_check_v1").writes_tables.includes(
      "memory_pre_promotion_checks",
    ),
    true,
  );
});

test("state-version effects are backed by a physical state_version column", () => {
  const columnsByTable = new Map(
    MEMORY_REPOSITORY_CONTRACT_V1.table_permissions.map(
      ({ table_name, select_columns }) => [
        table_name,
        new Set(select_columns),
      ],
    ),
  );
  for (const signature of MEMORY_REPOSITORY_CONTRACT_V1.function_signatures) {
    for (const effect of signature.effects) {
      if (effect.concurrency_control === "expected_state_version") {
        assert.equal(
          columnsByTable.get(effect.table_name)?.has("state_version"),
          true,
          `${signature.function_name} declares a nonexistent state_version fence on ${effect.table_name}`,
        );
      }
    }
  }
  assert.equal(
    effectIdentities(writer("transition_memory_linkage_operation_v1")).includes(
      "memory_linkage_operations:transition:database_row_lock",
    ),
    true,
  );
  assert.equal(
    MEMORY_REPOSITORY_CONTRACT_V1.mutable_writers.includes(
      "finalize_memory_write_batch_v1",
    ),
    false,
    "Memory batch write is a synchronous terminal transaction, not a two-phase state machine",
  );
});

test("version-fenced effects have a persisted version or revision column", () => {
  const columnsByTable = new Map(
    MEMORY_REPOSITORY_CONTRACT_V1.table_permissions.map(
      ({ table_name, select_columns }) => [
        table_name,
        select_columns,
      ],
    ),
  );
  for (const signature of MEMORY_REPOSITORY_CONTRACT_V1.function_signatures) {
    for (const effect of signature.effects) {
      if (effect.concurrency_control === "expected_version") {
        assert.equal(
          columnsByTable
            .get(effect.table_name)
            ?.some((column) => /(?:version|revision)/u.test(column)),
          true,
          `${signature.function_name} declares a nonexistent version fence on ${effect.table_name}`,
        );
      }
    }
  }
  const projection = writer("upsert_memory_relationship_projection_v1");
  assert.equal(
    projection.arguments.some(
      ({ argument_name }) => argument_name === "p_idempotency_key",
    ),
    true,
  );
  assert.deepEqual(effectIdentities(projection).slice(0, 2), [
    "role_memories:upsert:idempotency_key",
    "relationship_edges:upsert:idempotency_key",
  ]);
});

test("production composition requires a live database even when SQL artifacts are external", async () => {
  const availableArtifacts =
    MEMORY_REPOSITORY_CONTRACT_V1.generated_permission_sql.filter(
      (artifact) => existsSync(`${repositoryRoot}/${artifact}`),
    );
  assert.deepEqual(availableArtifacts, []);
  await assert.rejects(
    createProductionMemoryCompositionV1({
      deployment_environment: "prod",
      release_channel: "stable",
      env: {},
    }),
    /PAI_DATABASE_URL is required/u,
  );
});
