import type {
  SnapshotOverflowRefV1,
} from "@pai/contracts";
import {
  SnapshotOverflowRefV1Schema,
  assertSnapshotOverflowRefSemanticBindingsV1,
} from "@pai/contracts";
import type { PostgresQueryPortV1 } from "@pai/persistence";
import { Value } from "@sinclair/typebox/value";

import type {
  TriggerProcessSnapshotMetadataRepositoryV1,
  TriggerProcessSnapshotMetadataV1,
} from "../application/process-snapshot-read.v1.js";

interface SnapshotMetadataRowV1 extends Record<string, unknown> {
  readonly snapshot_id: string;
  readonly trigger_process_id: string;
  readonly workspace_id: string;
  readonly bot_id: string;
  readonly owner_agent_id: string;
  readonly deployment_environment: "local" | "dev" | "staging" | "prod";
  readonly release_channel: "stable" | "canary";
  readonly schema_version: string;
  readonly snapshot_version: string | number;
  readonly snapshot_hash: string;
  readonly snapshot_ref: string;
  readonly first_append_sequence_no: string | number;
  readonly last_append_sequence_no: string | number;
  readonly status: "current" | "superseded" | "invalid" | "expired";
  readonly retention_until: Date | string;
  readonly overflow_refs: readonly SnapshotOverflowRefV1[] | null;
}

function safeSequence(value: string | number): number {
  const sequence = typeof value === "string" ? Number(value) : value;
  if (!Number.isSafeInteger(sequence) || sequence < 0) {
    throw new Error("Snapshot metadata sequence exceeds JavaScript bounds");
  }
  return sequence;
}

function timestamp(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new Error("Snapshot metadata timestamp is invalid");
  }
  return date.toISOString();
}

function boundedIdentity(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 512 &&
    !/[\r\n]/u.test(value)
  );
}

export function createTriggerProcessSnapshotMetadataRepositoryV1(
  postgres: PostgresQueryPortV1,
): TriggerProcessSnapshotMetadataRepositoryV1 {
  type ReadRequestV1 = Parameters<
    TriggerProcessSnapshotMetadataRepositoryV1["readExactSnapshot"]
  >[0];
  return Object.freeze({
    async readExactSnapshot(request: ReadRequestV1) {
      const result = await postgres.query<SnapshotMetadataRowV1>(
        `SELECT
           s.id AS snapshot_id,
           s.trigger_process_id,
           s.workspace_id,
           s.bot_id,
           s.owner_agent_id,
           s.deployment_environment,
           s.release_channel,
           s.schema_version,
           s.snapshot_version,
           s.snapshot_hash,
           s.snapshot_ref,
           s.first_append_sequence_no,
           s.last_append_sequence_no,
           s.status,
           s.retention_until,
           COALESCE(jsonb_agg(
             jsonb_strip_nulls(jsonb_build_object(
               'schema_version', o.schema_version,
               'source_service', o.source_service,
               'store_type', o.store_type,
               'object_ref', o.object_ref,
               'first_append_sequence_no', o.first_append_sequence_no,
               'last_append_sequence_no', o.last_append_sequence_no,
               'source_sequence_range', CASE
                 WHEN o.first_source_sequence_no IS NULL THEN NULL
                 ELSE jsonb_build_object(
                   'first_source_sequence_no', o.first_source_sequence_no,
                   'last_source_sequence_no', o.last_source_sequence_no
                 )
               END,
               'checksum_algorithm', o.checksum_algorithm,
               'checksum', o.checksum,
               'retention_until', o.retention_until,
               'redaction_state', o.redaction_state
             )) ORDER BY o.first_append_sequence_no,
                        o.last_append_sequence_no,
                        o.source_service,
                        o.object_ref
           ) FILTER (WHERE o.id IS NOT NULL), '[]'::jsonb) AS overflow_refs
         FROM trigger_processor.trigger_process_snapshots AS s
         LEFT JOIN trigger_processor.trigger_snapshot_overflow_refs AS o
           ON o.snapshot_id = s.id
         WHERE s.trigger_process_id = $1::text
           AND s.snapshot_ref = $2::text
         GROUP BY s.id`,
        [request.trigger_process_id, request.snapshot_ref],
      );
      if (result.rows.length === 0) return Object.freeze({ outcome: "not_found" as const });
      if (result.rows.length !== 1) {
        throw new Error("Snapshot ref resolved to multiple owner rows");
      }
      const row = result.rows[0]!;
      const overflowRefs = row.overflow_refs ?? [];
      if (
        ![
          row.snapshot_id,
          row.trigger_process_id,
          row.workspace_id,
          row.bot_id,
          row.owner_agent_id,
          row.schema_version,
          row.snapshot_ref,
        ].every(boundedIdentity) ||
        !["local", "dev", "staging", "prod"].includes(
          row.deployment_environment,
        ) ||
        !["stable", "canary"].includes(row.release_channel) ||
        !["current", "superseded", "invalid", "expired"].includes(row.status) ||
        !/^sha256:[a-f0-9]{64}$/u.test(row.snapshot_hash) ||
        !Array.isArray(overflowRefs) ||
        overflowRefs.some(
          (overflow) => !Value.Check(SnapshotOverflowRefV1Schema, overflow),
        )
      ) {
        throw new Error("Snapshot metadata owner row is invalid");
      }
      for (const overflow of overflowRefs) {
        assertSnapshotOverflowRefSemanticBindingsV1(overflow);
      }
      const metadata: TriggerProcessSnapshotMetadataV1 = Object.freeze({
        snapshot_id: row.snapshot_id,
        trigger_process_id: row.trigger_process_id,
        workspace_id: row.workspace_id,
        bot_id: row.bot_id,
        owner_agent_id: row.owner_agent_id,
        deployment_environment: row.deployment_environment,
        release_channel: row.release_channel,
        schema_version: row.schema_version,
        snapshot_version: safeSequence(row.snapshot_version),
        snapshot_hash: row.snapshot_hash,
        snapshot_ref: row.snapshot_ref,
        first_append_sequence_no: safeSequence(row.first_append_sequence_no),
        last_append_sequence_no: safeSequence(row.last_append_sequence_no),
        status: row.status,
        retention_until: timestamp(row.retention_until),
        overflow_refs: Object.freeze([...overflowRefs]),
      });
      if (
        metadata.snapshot_version < 1 ||
        metadata.first_append_sequence_no > metadata.last_append_sequence_no
      ) {
        throw new Error("Snapshot metadata owner sequence range is invalid");
      }
      return Object.freeze({ outcome: "found" as const, metadata });
    },
  });
}
