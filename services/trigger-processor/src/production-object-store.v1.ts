import type {
  ObjectStorePortV1,
  ObjectStoreReconciliationPortV1,
} from "@pai/object-store";
import {
  ObjectStoreReconciliationWorkerV1,
  createPostgresObjectMetadataRepositoryV1,
  createSupabaseStorageAdapterV1,
} from "@pai/object-store/composition";
import { isTrustedLocalDockerHttpOriginV1 } from "@pai/service-kit";
import { Pool } from "pg";

import type { TriggerObjectAccessPolicyV1 } from "./production-object-access-policy.v1.js";

export interface TriggerProcessorObjectStoreOptionsV1 {
  readonly database_url: string;
  readonly reconciler_database_url: string;
  readonly supabase_url: string;
  readonly supabase_secret_key: string;
  readonly worker_id: string;
  readonly access_policy: TriggerObjectAccessPolicyV1;
  readonly reconciliation_interval_ms?: number;
  readonly fetch?: typeof fetch;
  readonly now?: () => Date;
}

export interface TriggerProcessorObjectStoreCompositionV1 {
  readonly object_store: ObjectStorePortV1;
  start(): void;
  checkReadiness(signal: AbortSignal): Promise<void>;
  close(): Promise<void>;
}

const identifierPatternV1 = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;

function storageBaseUrlV1(raw: string): string {
  const url = new URL(raw);
  const loopback =
    url.hostname === "127.0.0.1" ||
    url.hostname === "[::1]" ||
    url.hostname === "localhost";
  if (
    (url.protocol !== "https:" &&
      !(url.protocol === "http:" &&
        (loopback || isTrustedLocalDockerHttpOriginV1(url)))) ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.search.length > 0 ||
    url.hash.length > 0
  ) {
    throw new Error("PAI_SUPABASE_URL is invalid");
  }
  return url.toString().replace(/\/$/u, "");
}

function safeSecretV1(value: string): string {
  if (
    typeof value !== "string" ||
    value.length < 16 ||
    value.length > 16_384 ||
    /[\r\n\u0000]/u.test(value)
  ) {
    throw new Error("PAI_SUPABASE_SECRET_KEY is invalid");
  }
  return value;
}

export async function openTriggerProcessorObjectStoreV1(
  options: TriggerProcessorObjectStoreOptionsV1,
): Promise<TriggerProcessorObjectStoreCompositionV1> {
  if (!identifierPatternV1.test(options.worker_id)) {
    throw new Error("Trigger Processor ObjectStore worker_id is invalid");
  }
  const intervalMs = options.reconciliation_interval_ms ?? 5_000;
  if (!Number.isSafeInteger(intervalMs) || intervalMs < 100 || intervalMs > 300_000) {
    throw new Error("Trigger Processor ObjectStore interval is invalid");
  }
  const supabaseUrl = storageBaseUrlV1(options.supabase_url);
  const secretKey = safeSecretV1(options.supabase_secret_key);
  const allowInsecureLocalDockerTransport = isTrustedLocalDockerHttpOriginV1(
    new URL(supabaseUrl),
  );
  const fetchImpl = options.fetch ?? fetch;
  const clock = options.now ?? (() => new Date());
  const foregroundPool = new Pool({
    connectionString: options.database_url,
    application_name: "pai_trigger_processor_object_store",
    max: 4,
    connectionTimeoutMillis: 5_000,
  });
  const reconcilerPool = new Pool({
    connectionString: options.reconciler_database_url,
    application_name: "pai_trigger_processor_object_store_reconciler",
    max: 2,
    connectionTimeoutMillis: 5_000,
  });
  let closed = false;

  const checkStorageV1 = async (signal?: AbortSignal): Promise<void> => {
    signal?.throwIfAborted();
    const response = await fetchImpl(`${supabaseUrl}/storage/v1/status`, {
      method: "GET",
      redirect: "error",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${secretKey}`,
        apikey: secretKey,
      },
      ...(signal === undefined ? {} : { signal }),
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw new Error("Supabase Storage readiness endpoint is unavailable");
    }
    const declaredLength = response.headers.get("content-length");
    if (declaredLength !== null && Number(declaredLength) > 65_536) {
      await response.body?.cancel().catch(() => undefined);
      throw new Error("Supabase Storage readiness response is oversized");
    }
    await response.body?.cancel().catch(() => undefined);
    signal?.throwIfAborted();
  };

  const checkDatabaseV1 = async (signal?: AbortSignal): Promise<void> => {
    signal?.throwIfAborted();
    const [foreground, reconciler] = await Promise.all([
      foregroundPool.query<{ function_count: string | number; all_granted: boolean }>(`SELECT
        count(*)::text AS function_count,
        COALESCE(bool_and(pg_catalog.has_function_privilege(current_user, p.oid, 'EXECUTE')), false) AS all_granted
      FROM pg_catalog.pg_proc AS p
      JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
      WHERE n.nspname = 'object_store'
        AND p.proname IN ('reserve_object_operation_v1','finalize_object_operation_v1')`),
      reconcilerPool.query<{ function_count: string | number; all_granted: boolean }>(`SELECT
        count(*)::text AS function_count,
        COALESCE(bool_and(pg_catalog.has_function_privilege(current_user, p.oid, 'EXECUTE')), false) AS all_granted
      FROM pg_catalog.pg_proc AS p
      JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
      WHERE n.nspname = 'object_store'
        AND p.proname IN ('claim_expired_object_reconcile_v1','settle_object_reconcile_v1')`),
    ]);
    signal?.throwIfAborted();
    const foregroundRow = foreground.rows[0];
    const reconcilerRow = reconciler.rows[0];
    if (
      Number(foregroundRow?.function_count) !== 2 ||
      foregroundRow?.all_granted !== true ||
      Number(reconcilerRow?.function_count) !== 2 ||
      reconcilerRow?.all_granted !== true
    ) {
      throw new Error("ObjectStore PostgreSQL runtime grants are incomplete");
    }
  };

  try {
    await checkDatabaseV1();
    await checkStorageV1();
    const metadataRepository = createPostgresObjectMetadataRepositoryV1({
      pool: foregroundPool,
      reconcilerPool,
      ownerService: "trigger_processor",
      clock,
    });
    const terminalProofReconciler = Object.freeze({
      kind: "object-store-terminal-proof-reconciler.v1" as const,
      async reconcileTerminalProofs(): Promise<void> {
        await checkDatabaseV1();
        await checkStorageV1();
      },
    });
    const adapter = createSupabaseStorageAdapterV1({
      url: supabaseUrl,
      secretKey,
      allow_insecure_local_docker_transport: allowInsecureLocalDockerTransport,
      metadataRepository,
      terminalProofReconciler,
      accessPolicyVerifier: options.access_policy.verifier,
      policies: [
        {
          owner_service: "trigger_processor",
          object_class: "trigger_process_snapshot",
          bucket: "tp-snapshots",
          scope_kinds: ["bot"],
          max_size_bytes: 16 * 1024 * 1024,
          media_types: ["application/json"],
          capabilities: {
            put: ["trigger_process.snapshot.manage"],
            head: ["trigger_process.snapshot.resolve"],
            get: ["trigger_process.snapshot.resolve"],
            grant: ["trigger_process.snapshot.resolve"],
            delete: ["trigger_process.snapshot.manage"],
          },
        },
      ],
      now: clock,
      fetch: fetchImpl,
    });
    const reconciliation = adapter as ObjectStorePortV1 & ObjectStoreReconciliationPortV1;
    const worker = new ObjectStoreReconciliationWorkerV1({
      reconciliation,
      worker_id: options.worker_id,
      interval_ms: intervalMs,
      batch_limit: 25,
      lease_seconds: 30,
    });
    return Object.freeze({
      object_store: adapter,
      start() {
        if (closed) throw new Error("Trigger Processor ObjectStore is closed");
        worker.start();
      },
      async checkReadiness(signal: AbortSignal) {
        if (closed) throw new Error("Trigger Processor ObjectStore is closed");
        await Promise.all([checkDatabaseV1(signal), checkStorageV1(signal)]);
        signal.throwIfAborted();
      },
      async close() {
        if (closed) return;
        closed = true;
        try {
          await worker.stop();
        } finally {
          await Promise.allSettled([foregroundPool.end(), reconcilerPool.end()]);
        }
      },
    });
  } catch (error) {
    closed = true;
    await Promise.allSettled([foregroundPool.end(), reconcilerPool.end()]);
    throw error;
  }
}
