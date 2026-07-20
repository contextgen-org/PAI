import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { ACTION_RUNTIME_REPOSITORY_CONTRACT_V1 } from "../../../services/action-runtime/src/db/permission-manifest.v1.js";
import { KNOWTHAT_REPOSITORY_CONTRACT_V1 } from "../../../services/knowthat/src/db/permission-manifest.v1.js";
import { MEMORY_REPOSITORY_CONTRACT_V1 } from "../../../services/memory/src/db/permission-manifest.v1.js";
import { META_COGNITION_REPOSITORY_CONTRACT_V1 } from "../../../services/meta-cognition/src/db/permission-manifest.v1.js";
import { SKILL_REGISTRY_REPOSITORY_CONTRACT_V1 } from "../../../services/skill-registry/src/db/permission-manifest.v1.js";
import { TIMER_REPOSITORY_CONTRACT_V1 } from "../../../services/timer-trigger-app/src/db/permission-manifest.v1.js";
import { TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1 } from "../../../services/trigger-processor/src/db/permission-manifest.v1.js";
import {
  defineOwnerRepositoryContractV1,
  OWNER_DATABASE_TARGETS_V1,
} from "../src/index.js";

const contracts = [
  TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
  ACTION_RUNTIME_REPOSITORY_CONTRACT_V1,
  TIMER_REPOSITORY_CONTRACT_V1,
  META_COGNITION_REPOSITORY_CONTRACT_V1,
  SKILL_REGISTRY_REPOSITORY_CONTRACT_V1,
  KNOWTHAT_REPOSITORY_CONTRACT_V1,
  MEMORY_REPOSITORY_CONTRACT_V1,
] as const;

const writerKinds = new Set([
  "immutable_append",
  "projection_upsert",
  "state_transition",
  "pointer_cas",
  "lease_fence",
  "queue_claim_ack",
  "outbox_claim_ack",
]);

describe("owner repository contracts", () => {
  it("covers all and only the seven database owners", () => {
    expect(contracts.map((contract) => contract.owner_service).sort()).toEqual(
      Object.keys(OWNER_DATABASE_TARGETS_V1).sort(),
    );
    expect(contracts.map((contract) => contract.owner_service)).not.toContain(
      "observation_gateway",
    );
  });

  it("binds every owner to one schema, app role, source, and generated SQL", () => {
    for (const contract of contracts) {
      expect(contract.schema).toBe(
        OWNER_DATABASE_TARGETS_V1[contract.owner_service].schema,
      );
      expect(contract.app_role).toBe(
        OWNER_DATABASE_TARGETS_V1[contract.owner_service].app_role,
      );
      expect(contract.manifest_source).toMatch(
        new RegExp(`^services/.+/src/db/permission-manifest\\.v1\\.ts$`),
      );
      expect(contract.generated_permission_sql).not.toHaveLength(0);
      expect(contract.generated_permission_sql.every((path) =>
        path.startsWith("pai-infra/supabase/generated/permissions/"),
      )).toBe(true);
      expect(contract.outbox_tables.every((table) =>
        contract.tables.includes(table),
      )).toBe(true);
      expect(contract.inbox_tables.every((table) =>
        contract.tables.includes(table),
      )).toBe(true);
      expect(contract.dlq_tables.every((table) =>
        contract.tables.includes(table),
      )).toBe(true);
      expect([
        ...contract.outbox_tables,
        ...contract.inbox_tables,
        ...contract.dlq_tables,
      ].every((table) => contract.append_only_tables.includes(table))).toBe(
        true,
      );
      expect(Object.isFrozen(contract)).toBe(true);
      expect(Object.isFrozen(contract.tables)).toBe(true);
    }
  });

  it("declares exact writer-only permissions for every fresh table", () => {
    for (const contract of contracts) {
      expect(contract.table_permissions.map(({ table_name }) => table_name)).toEqual(
        contract.tables,
      );
      for (const permission of contract.table_permissions) {
        expect(permission.select_columns.length).toBeGreaterThan(0);
        expect(permission.select_columns).not.toContain("*");
        expect(new Set(permission.select_columns).size).toBe(
          permission.select_columns.length,
        );
        expect(permission.insert_columns).toEqual([]);
        expect(permission.update_columns).toEqual([]);
        expect(permission.delete_allowed).toBe(false);
        expect(writerKinds.has(permission.writer_kind)).toBe(true);
        expect(Object.isFrozen(permission)).toBe(true);
        expect(Object.isFrozen(permission.select_columns)).toBe(true);
      }
    }
  });

  it("binds every named writer to a full SECURITY DEFINER signature", () => {
    for (const contract of contracts) {
      expect(
        contract.function_signatures.map(({ function_name }) => function_name),
      ).toEqual(contract.mutable_writers);
      for (const signature of contract.function_signatures) {
        const permission = contract.table_permissions.find(
          ({ table_name }) => table_name === signature.primary_table,
        );
        expect(permission?.writer_kind).toBe(signature.writer_kind);
        expect(signature.schema).toBe(contract.schema);
        expect(signature.security_definer).toBe(true);
        expect(signature.search_path).toEqual([contract.schema, "pg_temp"]);
        expect(signature.arguments.length).toBeGreaterThan(0);
        expect(signature.arguments.every(({ mode }) => mode === "in")).toBe(true);
        expect(new Set(signature.arguments.map(({ argument_name }) => argument_name)).size)
          .toBe(signature.arguments.length);
        expect(Object.isFrozen(signature)).toBe(true);
        expect(Object.isFrozen(signature.arguments)).toBe(true);
        expect(Object.isFrozen(signature.reads_tables)).toBe(true);
        expect(Object.isFrozen(signature.writes_tables)).toBe(true);
        expect(signature.writes_tables).toContain(signature.primary_table);
        expect(signature.reads_tables.every((table) => contract.tables.includes(table)))
          .toBe(true);
        expect(signature.writes_tables.every((table) => contract.tables.includes(table)))
          .toBe(true);
      }
      const writableTables = new Set(
        contract.function_signatures.flatMap(({ writes_tables }) => writes_tables),
      );
      expect(contract.tables.every((table) => writableTables.has(table))).toBe(true);
    }
  });

  it("uses the parent-owned timer service path and never creates an apps alias", () => {
    expect(TIMER_REPOSITORY_CONTRACT_V1.manifest_source).toBe(
      "services/timer-trigger-app/src/db/permission-manifest.v1.ts",
    );
  });

  it("models trigger admission as one slot-fenced state/audit/outbox transaction", () => {
    const signature = TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1.function_signatures
      .find(({ function_name }) => function_name === "admit_trigger_v1");
    expect(signature?.arguments.map(({ argument_name }) => argument_name)).toEqual(
      expect.arrayContaining([
        "p_dedupe_key",
        "p_trigger_id",
        "p_process_id",
        "p_expected_slot_process_id",
        "p_expected_slot_generation",
        "p_admission_decision",
      ]),
    );
    expect(signature?.writes_tables).toEqual(
      expect.arrayContaining([
        "triggers",
        "trigger_processes",
        "trigger_process_transitions",
        "bot_foreground_slots",
        "weak_trigger_queue_items",
        "trigger_submit_attempts",
        "trigger_event_outbox",
      ]),
    );
  });

  it("binds mutable queue and memory lifecycle tables to narrow semantic effects", () => {
    expect(
      TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1.append_only_tables,
    ).not.toContain("trigger_snapshot_pending_events");
    const pendingWriter =
      TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1.function_signatures.find(
        ({ function_name }) =>
          function_name === "transition_trigger_snapshot_pending_event_v1",
      );
    expect(pendingWriter?.writer_kind).toBe("queue_claim_ack");
    expect(pendingWriter?.effects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table_name: "trigger_snapshot_pending_events",
          operation: "transition",
          concurrency_control: "expected_state_version",
        }),
      ]),
    );

    const seriesWriter = MEMORY_REPOSITORY_CONTRACT_V1.function_signatures.find(
      ({ function_name }) => function_name === "transition_memory_series_v1",
    );
    expect(seriesWriter?.writes_tables).toEqual([
      "memory_series",
      "memory_audit_logs",
      "memory_event_outbox",
    ]);
    expect(seriesWriter?.writes_tables).not.toContain("memory_feedback_events");
    expect(seriesWriter?.writes_tables).not.toContain(
      "memory_promotion_reservations",
    );
    expect(seriesWriter?.writes_tables).not.toContain("memory_graph_builds");
  });

  it("fails closed on schema or role drift", () => {
    expect(() =>
      defineOwnerRepositoryContractV1({
        ...TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        schema: "memory",
      } as never),
    ).toThrow(/owner database target drift/);
  });

  it("fails closed on permission coverage, direct writes, or writer signature drift", () => {
    expect(() =>
      defineOwnerRepositoryContractV1({
        ...TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        table_permissions:
          TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1.table_permissions.slice(1),
      } as never),
    ).toThrow(/table_permissions must cover/);

    expect(() =>
      defineOwnerRepositoryContractV1({
        ...TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        table_permissions: [
          {
            ...TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1.table_permissions[0],
            insert_columns: ["id"],
          },
          ...TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1.table_permissions.slice(1),
        ],
      } as never),
    ).toThrow(/writer-only V1 permissions/);

    expect(() =>
      defineOwnerRepositoryContractV1({
        ...TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        function_signatures: [
          {
            ...TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1.function_signatures[0],
            search_path: ["public", "pg_temp"],
          },
          ...TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1.function_signatures.slice(1),
        ],
      } as never),
    ).toThrow(/invalid generated writer signature/);

    const tableWithoutPrimaryWriter = "bot_permission_bindings";
    expect(() =>
      defineOwnerRepositoryContractV1({
        ...TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        function_signatures:
          TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1.function_signatures.map(
            (signature) => ({
              ...signature,
              writes_tables: signature.writes_tables.filter(
                (table) => table !== tableWithoutPrimaryWriter,
              ),
            }),
          ),
      } as never),
    ).toThrow(/semantic effect|tables without an atomic writer/);

    expect(() =>
      defineOwnerRepositoryContractV1({
        ...TIMER_REPOSITORY_CONTRACT_V1,
        function_signatures: [
          {
            ...TIMER_REPOSITORY_CONTRACT_V1.function_signatures[0],
            arguments: [
              ...TIMER_REPOSITORY_CONTRACT_V1.function_signatures[0].arguments,
              { argument_name: "p_schedule_id", postgres_type: "text", mode: "in" },
            ],
          },
          ...TIMER_REPOSITORY_CONTRACT_V1.function_signatures.slice(1),
        ],
      } as never),
    ).toThrow(/arguments must contain unique SQL identifiers/);
  });

});

describe("SDK import boundary", () => {
  it("allows Supabase JS only in the object-store adapter package", async () => {
    const repositoryRoot = resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../../..",
    );
    const packageFiles = [
      "packages/auth/package.json",
      "packages/contracts/package.json",
      "packages/persistence/package.json",
      "packages/service-kit/package.json",
      "services/action-runtime/package.json",
      "services/knowthat/package.json",
      "services/memory/package.json",
      "services/meta-cognition/package.json",
      "services/observation-gateway/package.json",
      "services/skill-registry/package.json",
      "services/timer-trigger-app/package.json",
      "services/trigger-processor/package.json",
    ];
    for (const path of packageFiles) {
      const manifest = await readFile(resolve(repositoryRoot, path), "utf8");
      expect(manifest, path).not.toContain("@supabase/supabase-js");
      expect(manifest, path).not.toContain("@supabase/storage-js");
    }
  });
});
