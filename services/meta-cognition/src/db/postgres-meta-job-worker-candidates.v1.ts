import type { VerifiedOwnerPostgresCompositionV1 } from "@pai/persistence";

import type { MetaJobWorkerCandidateSourceV1 } from "../meta-job-worker.v1.js";
import { META_COGNITION_REPOSITORY_CONTRACT_V1 } from "./permission-manifest.v1.js";

type MetaPostgresCompositionV1 = Pick<
  VerifiedOwnerPostgresCompositionV1<typeof META_COGNITION_REPOSITORY_CONTRACT_V1>,
  "postgres" | "checkReadiness"
>;

type CandidateRowV1 = Readonly<{
  id: unknown;
  lease_generation: unknown;
  trace_id: unknown;
}>;

function textV1(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Meta job worker ${label} is invalid`);
  }
  return value;
}

function generationV1(value: unknown): number {
  const result = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(result) || result < 0 || result > Number.MAX_SAFE_INTEGER) {
    throw new Error("Meta job worker lease generation is invalid");
  }
  return result;
}

export function createPostgresMetaJobWorkerCandidateSourceV1(
  composition: MetaPostgresCompositionV1,
  takeoverGraceMs: number,
): MetaJobWorkerCandidateSourceV1 {
  if (!Number.isSafeInteger(takeoverGraceMs) || takeoverGraceMs < 0 || takeoverGraceMs > 300_000) {
    throw new Error("Meta job worker takeover grace is invalid");
  }
  return Object.freeze({
    async claimable(limit: number) {
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
        throw new Error("Meta job worker batch size is invalid");
      }
      const result = await composition.postgres.query<CandidateRowV1>(
        `SELECT job.id, COALESCE(lease.lease_generation, 0) AS lease_generation, job.trace_id
           FROM meta_cognition.meta_jobs AS job
      LEFT JOIN meta_cognition.meta_job_leases AS lease
             ON lease.job_id = job.id
          WHERE job.status = 'queued'
             OR (job.status = 'retry_wait' AND job.next_retry_at <= clock_timestamp())
             OR (
               job.status IN ('leased', 'running')
               AND (
                 lease.job_id IS NULL
                 OR lease.lease_expires_at <=
                   clock_timestamp() - make_interval(msecs => $2::integer)
               )
             )
          ORDER BY job.created_at ASC, job.id ASC
          LIMIT $1`,
        [limit, takeoverGraceMs],
      );
      return Object.freeze(result.rows.map((row) => Object.freeze({
        job_id: textV1(row.id, "job id"),
        expected_lease_generation: generationV1(row.lease_generation),
        trace_id: textV1(row.trace_id, "trace id"),
      })));
    },
    checkReadiness: composition.checkReadiness,
  });
}
