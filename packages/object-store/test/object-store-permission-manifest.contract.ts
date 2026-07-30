import { describe, expect, it } from "vitest";

import {
  OBJECT_STORE_FOREGROUND_ROLE_BINDINGS_V1,
  OBJECT_STORE_FUNCTION_MANIFESTS_V1,
  OBJECT_STORE_GENERATED_PERMISSION_SQL_V1,
  OBJECT_STORE_PERMISSION_MANIFEST_V1,
  OBJECT_STORE_PERMISSION_MANIFEST_FINGERPRINT_V1,
  OBJECT_STORE_RECONCILER_ROLE_V1,
  OBJECT_STORE_REQUIRED_INDEXES_V1,
  OBJECT_STORE_ROLE_OPERATION_ALLOWLIST_V1,
  OBJECT_STORE_TABLES_V1,
  OBJECT_STORE_TABLE_COLUMNS_V1,
  OBJECT_STORE_TABLE_PERMISSIONS_V1,
  OBJECT_STORE_WRITER_NAMES_V1,
  assertObjectStorePermissionManifestV1,
  objectStoreOwnerServiceForRoleV1,
  type ObjectStorePermissionManifestV1,
} from "../src/db/permission-manifest.v1.js";

describe("0050 object_store permission manifest", () => {
  it("covers the four canonical tables with zero direct table/sequence access", () => {
    expect(OBJECT_STORE_TABLES_V1).toEqual([
      "object_metadata_reservations",
      "object_operation_attempts",
      "object_terminal_proofs",
      "object_reconcile_jobs",
    ]);
    expect(OBJECT_STORE_TABLE_PERMISSIONS_V1).toHaveLength(4);
    for (const permission of OBJECT_STORE_TABLE_PERMISSIONS_V1) {
      expect(permission).toMatchObject({
        select_columns: [],
        insert_columns: [],
        update_columns: [],
        delete_allowed: false,
        sequence_usage_allowed: false,
        granted_roles: [],
      });
    }
  });

  it("registers exactly eight fixed-path SECURITY DEFINER ABIs", () => {
    expect(
      OBJECT_STORE_FUNCTION_MANIFESTS_V1.map(
        ({ function_name }) => function_name,
      ),
    ).toEqual(OBJECT_STORE_WRITER_NAMES_V1);
    expect(new Set(OBJECT_STORE_WRITER_NAMES_V1).size).toBe(8);
    for (const writer of OBJECT_STORE_FUNCTION_MANIFESTS_V1) {
      expect(writer).toMatchObject({
        atomicity: "single_transaction",
        outbox_effect: "none",
        schema: "object_store",
        security_definer: true,
        search_path: ["pg_catalog", "object_store", "pg_temp"],
      });
      expect(writer.request_schema_id).toMatch(
        /^urn:pai:object-store:.+:v1$/u,
      );
      expect(writer.response_schema_id).toMatch(
        /^urn:pai:object-store:.+:v1$/u,
      );
      expect(writer.lock_order).toEqual(
        expect.arrayContaining(writer.reads_tables),
      );
      expect(writer.lock_order).toEqual(
        expect.arrayContaining(writer.writes_tables),
      );
      expect(
        new Set(writer.arguments.map(({ argument_name }) => argument_name)).size,
      ).toBe(writer.arguments.length);
      for (const table of writer.writes_tables) {
        expect(writer.effects.some((effect) => effect.table_name === table)).toBe(
          true,
        );
      }
      for (const effect of writer.effects) {
        expect(effect.columns.length).toBeGreaterThan(0);
        expect(new Set(effect.columns).size).toBe(effect.columns.length);
        expect(
          effect.columns.every((column) =>
            OBJECT_STORE_TABLE_COLUMNS_V1[effect.table_name].includes(
              column as never,
            )
          ),
        ).toBe(true);
      }
    }
    expect(OBJECT_STORE_PERMISSION_MANIFEST_FINGERPRINT_V1).toMatch(
      /^sha256:[a-f0-9]{64}$/u,
    );
  });

  it("grants foreground roles only owner-bound foreground/result functions", () => {
    for (const { role, owner_service } of OBJECT_STORE_FOREGROUND_ROLE_BINDINGS_V1) {
      expect(objectStoreOwnerServiceForRoleV1(role)).toBe(owner_service);
      const binding = OBJECT_STORE_ROLE_OPERATION_ALLOWLIST_V1.find(
        (candidate) => candidate.role === role,
      );
      expect(binding).toEqual({
        role,
        owner_service,
        operations: ["put_immutable", "delete_if_eligible"],
        execute_functions: [
          "reserve_object_operation_v1",
          "start_object_operation_attempt_v1",
          "mark_object_operation_commit_unknown_v1",
          "finalize_object_operation_v1",
          "get_object_operation_result_v1",
        ],
      });
      expect(binding?.execute_functions).not.toContain(
        "claim_expired_object_reconcile_v1",
      );
      expect(binding?.execute_functions).not.toContain(
        "settle_object_reconcile_v1",
      );
    }
  });

  it("grants the reconciler only claim, settle, and scoped result read", () => {
    const binding = OBJECT_STORE_ROLE_OPERATION_ALLOWLIST_V1.find(
      (candidate) => candidate.role === OBJECT_STORE_RECONCILER_ROLE_V1,
    );
    expect(binding).toEqual({
      role: "pai_object_store_reconciler_app",
      owner_service: null,
      operations: ["put_immutable", "delete_if_eligible"],
      execute_functions: [
        "claim_expired_object_reconcile_v1",
        "renew_object_reconcile_claim_v1",
        "settle_object_reconcile_v1",
        "get_object_operation_result_v1",
      ],
    });
    expect(binding?.execute_functions).not.toContain(
      "reserve_object_operation_v1",
    );
    expect(binding?.execute_functions).not.toContain(
      "finalize_object_operation_v1",
    );
  });

  it("declares semantic effects instead of table-name-only coverage", () => {
    const byName = new Map(
      OBJECT_STORE_FUNCTION_MANIFESTS_V1.map((writer) => [
        writer.function_name,
        writer,
      ]),
    );
    expect(
      byName.get("reserve_object_operation_v1")?.effects,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table_name: "object_metadata_reservations",
          operation: "create_or_replay",
          concurrency_control: "idempotency_identity",
        }),
        expect.objectContaining({
          table_name: "object_reconcile_jobs",
          operation: "create_or_replay",
          concurrency_control: "foreground_lease",
          columns: expect.arrayContaining([
            "reservation_id",
            "next_retry_at",
          ]),
        }),
      ]),
    );
    expect(
      byName.get("renew_object_reconcile_claim_v1")?.effects,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table_name: "object_reconcile_jobs",
          operation: "transition",
          concurrency_control: "claim_generation",
          columns: ["claim_lease_expires_at", "updated_at"],
        }),
      ]),
    );
    expect(
      byName.get("mark_object_operation_commit_unknown_v1")?.effects,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table_name: "object_reconcile_jobs",
          operation: "create_or_replay",
          concurrency_control: "attempt_fence",
        }),
      ]),
    );
    expect(byName.get("settle_object_reconcile_v1")?.effects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table_name: "object_terminal_proofs",
          operation: "immutable_proof",
          concurrency_control: "terminal_immutability",
        }),
        expect.objectContaining({
          table_name: "object_reconcile_jobs",
          operation: "settle",
          concurrency_control: "claim_generation",
        }),
        expect.objectContaining({
          table_name: "object_terminal_proofs",
          operation: "immutable_proof",
          concurrency_control: "claim_generation",
        }),
      ]),
    );
    expect(byName.get("finalize_object_operation_v1")?.effects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table_name: "object_terminal_proofs",
          operation: "immutable_proof",
          concurrency_control: "attempt_fence",
        }),
      ]),
    );
    expect(
      byName.get("get_object_operation_result_v1")?.writes_tables,
    ).toEqual([]);
    expect(
      OBJECT_STORE_REQUIRED_INDEXES_V1.find(
        ({ index_name }) => index_name === "object_metadata_reconcile_scan_idx",
      )?.predicate,
    ).toBe(
      "status IN ('reserved', 'executing', 'commit_unknown', 'reconcile_required')",
    );
  });

  it("classifies plaintext tokens as input-only and persists only hash columns", () => {
    const secretArguments = OBJECT_STORE_FUNCTION_MANIFESTS_V1.flatMap(
      (writer) =>
        writer.arguments
          .filter(({ sensitivity }) => sensitivity === "secret_input")
          .map(({ argument_name }) => argument_name),
    );
    expect(secretArguments.length).toBeGreaterThan(0);
    expect(
      secretArguments.every(
        (name) => name.endsWith("_token") && !name.endsWith("_token_hash"),
      ),
    ).toBe(true);

    expect(
      OBJECT_STORE_TABLE_PERMISSIONS_V1.flatMap(
        ({ select_columns }) => select_columns,
      ),
    ).toEqual([]);
  });

  it("fails closed on writer grants, table permissions, or authority drift", () => {
    const roleDrift = structuredClone(
      OBJECT_STORE_PERMISSION_MANIFEST_V1,
    ) as unknown as ObjectStorePermissionManifestV1;
    (
      roleDrift.function_manifests[0] as unknown as {
        granted_roles: string[];
      }
    ).granted_roles.push("pai_memory_app");
    expect(() => assertObjectStorePermissionManifestV1(roleDrift)).toThrow(
      "invalid object-store writer contract",
    );

    const tableDrift = structuredClone(
      OBJECT_STORE_PERMISSION_MANIFEST_V1,
    ) as unknown as ObjectStorePermissionManifestV1;
    (
      tableDrift.table_permissions[0] as unknown as {
        select_columns: string[];
      }
    ).select_columns.push("foreground_lease_token_hash");
    expect(() => assertObjectStorePermissionManifestV1(tableDrift)).toThrow(
      "writer-only",
    );

    const sourceDrift = structuredClone(
      OBJECT_STORE_PERMISSION_MANIFEST_V1,
    ) as unknown as ObjectStorePermissionManifestV1;
    (
      sourceDrift as unknown as { generated_permission_sql: string }
    ).generated_permission_sql =
      "packages/object-store/generated/0050_object_store.sql";
    expect(() => assertObjectStorePermissionManifestV1(sourceDrift)).toThrow(
      "authority or default-deny drift",
    );

    const effectColumnDrift = structuredClone(
      OBJECT_STORE_PERMISSION_MANIFEST_V1,
    ) as unknown as ObjectStorePermissionManifestV1;
    (
      effectColumnDrift.function_manifests[0]!.effects[0] as unknown as {
        columns: string[];
      }
    ).columns.push("nonexistent_column");
    expect(() =>
      assertObjectStorePermissionManifestV1(effectColumnDrift)
    ).toThrow("invalid object-store writer contract");

    const lockOrderDrift = structuredClone(
      OBJECT_STORE_PERMISSION_MANIFEST_V1,
    ) as unknown as ObjectStorePermissionManifestV1;
    (
      lockOrderDrift.function_manifests[3] as unknown as {
        lock_order: string[];
      }
    ).lock_order.reverse();
    expect(() => assertObjectStorePermissionManifestV1(lockOrderDrift)).toThrow(
      "invalid object-store writer contract",
    );
  });

  it("names pai-infra artifacts without claiming they were delivered here", () => {
    expect(OBJECT_STORE_PERMISSION_MANIFEST_V1).toMatchObject({
      fresh_migration: "0050_object_store",
      migration_owner_repository: "pai-infra",
      manifest_source:
        "packages/object-store/src/db/permission-manifest.v1.ts",
      metadata_contract_source:
        "packages/object-store/src/db/metadata-contract.v1.ts",
      generated_permission_sql: OBJECT_STORE_GENERATED_PERMISSION_SQL_V1,
      public_roles: ["PUBLIC", "anon", "authenticated"],
      public_schema_usage: false,
      public_function_execute: false,
      runtime_table_dml: false,
      runtime_sequence_usage: false,
    });
  });
});
