import {
  TriggerProcessGetResponseV1Schema,
  TriggerProcessQueryDetailsV1Schema,
  TriggerProcessSummaryV1Schema,
  TriggerProcessSseEventV1Schema,
  assertTriggerProcessQueryDetailsV1,
  assertTriggerProcessSummarySemanticBindingsV1,
  assertTriggerProcessSseEventSemanticBindingsV1,
  parseTriggerProcessSseCursorV1,
  triggerProcessSseEventIdV1,
  type TriggerProcessGetResponseV1,
  type TriggerProcessQueryDetailsV1,
  type TriggerProcessSummaryV1,
  type TriggerProcessSseEventV1,
  type TriggerProcessSseRequestV1,
} from "@pai/contracts";
import { canonicalJsonV1 } from "@pai/eventing";
import { Value } from "@sinclair/typebox/value";

const DEFAULT_HEARTBEAT_MS = 30_000;
const DEFAULT_REPLAY_PAGE_SIZE = 256;
const DEFAULT_MAX_CONNECTIONS_PER_BOT = 3;

export interface DelegatedProcessReadPrincipalV1 {
  readonly principal_type: "user" | "developer" | "operator" | "agent" | "service";
  readonly principal_id: string;
  /** Expiry of the signed ingress credential that authorized this read. */
  readonly credential_expires_at_epoch_seconds: number;
  readonly signed_bot_scope?: Readonly<{
    workspace_id: string;
    bot_id: string;
    owner_agent_id: string;
    deployment_environment: "local" | "dev" | "staging" | "prod";
    release_channel: "stable" | "canary";
  }>;
  readonly process_snapshot_identity_grant?: Readonly<{
    capability: "trigger.process.snapshot.resolve";
    purpose: "observation_replay";
  }>;
  readonly context_snapshot_identity_grant?: Readonly<{
    capability: "trigger.context_snapshot.resolve";
    purpose: "audit_replay";
  }>;
}

export type TriggerProcessAuthorizedReadV1 =
  | Readonly<{ outcome: "denied" }>
  | Readonly<{ outcome: "not_found" }>
  | Readonly<{
      outcome: "found";
      details: TriggerProcessQueryDetailsV1;
      replay_cutoff: number;
      observation_closed: boolean;
    }>;

export interface TriggerProcessEventReplayPageV1 {
  readonly outcome: "found" | "denied" | "not_found";
  readonly current_watermark: number;
  readonly replay_cutoff: number;
  readonly events: readonly TriggerProcessSseEventV1[];
  readonly observation_closed: boolean;
  readonly details: TriggerProcessQueryDetailsV1 | null;
}

export interface TriggerProcessObservationRepositoryV1 {
  readAuthorizedProcess(request: Readonly<{
    process_id: string;
    principal: DelegatedProcessReadPrincipalV1;
    permission_scope: "trigger.process.read" | "trigger.process.events.read";
  }>): Promise<TriggerProcessAuthorizedReadV1>;
  readAuthorizedEventPage(request: Readonly<{
    process_id: string;
    principal: DelegatedProcessReadPrincipalV1;
    permission_scope: "trigger.process.events.read";
    after_append_sequence_no: number;
    limit: number;
  }>): Promise<TriggerProcessEventReplayPageV1>;
}

export class TriggerProcessObservationErrorV1 extends Error {
  public constructor(
    public readonly code:
      | "invalid_replay_cursor"
      | "cursor_ahead"
      | "replay_expired"
      | "bot_permission_denied"
      | "process_not_found"
      | "rate_limited"
      | "credential_expired"
      | "projection_contract_drift",
  ) {
    super(code);
    this.name = "TriggerProcessObservationErrorV1";
  }
}

export interface TriggerProcessObservationApplicationV1 {
  getProcess(
    principal: DelegatedProcessReadPrincipalV1,
    processId: string,
    traceId: string,
  ): Promise<TriggerProcessGetResponseV1>;
  streamProcessEvents(
    principal: DelegatedProcessReadPrincipalV1,
    request: TriggerProcessSseRequestV1,
    signal: AbortSignal,
  ): Promise<AsyncIterable<string>>;
}

type GetProcessArgumentsV1 = Parameters<
  TriggerProcessObservationApplicationV1["getProcess"]
>;
type StreamProcessEventsArgumentsV1 = Parameters<
  TriggerProcessObservationApplicationV1["streamProcessEvents"]
>;

function assertIdentifier(value: string, label: string): void {
  if (value.length < 1 || value.length > 512 || /[\r\n]/u.test(value)) {
    throw new TriggerProcessObservationErrorV1(
      label === "cursor" ? "invalid_replay_cursor" : "process_not_found",
    );
  }
}

function credentialExpiredV1(
  principal: DelegatedProcessReadPrincipalV1,
  nowMs = Date.now(),
): boolean {
  if (
    !Number.isSafeInteger(
      principal.credential_expires_at_epoch_seconds,
    ) ||
    principal.credential_expires_at_epoch_seconds < 0
  ) {
    throw new TriggerProcessObservationErrorV1(
      "bot_permission_denied",
    );
  }
  return (
    nowMs >=
    principal.credential_expires_at_epoch_seconds * 1_000
  );
}

function assertCredentialActiveV1(
  principal: DelegatedProcessReadPrincipalV1,
  nowMs = Date.now(),
): void {
  if (credentialExpiredV1(principal, nowMs)) {
    throw new TriggerProcessObservationErrorV1(
      "credential_expired",
    );
  }
}

function canonicalObservationSnapshotV1<T>(
  value: unknown,
  code: TriggerProcessObservationErrorV1["code"],
): T {
  let snapshot: T;
  try {
    snapshot = JSON.parse(canonicalJsonV1(value)) as T;
  } catch {
    throw new TriggerProcessObservationErrorV1(code);
  }
  const pending: object[] = [];
  if (typeof snapshot === "object" && snapshot !== null) {
    pending.push(snapshot);
  }
  while (pending.length > 0) {
    const current = pending.pop()!;
    for (const entry of Object.values(current)) {
      if (
        typeof entry === "object" &&
        entry !== null &&
        !Object.isFrozen(entry)
      ) {
        pending.push(entry);
      }
    }
    Object.freeze(current);
  }
  return snapshot;
}

function detailsSnapshotV1(value: unknown): TriggerProcessQueryDetailsV1 {
  const snapshot =
    canonicalObservationSnapshotV1<TriggerProcessQueryDetailsV1>(
      value,
      "projection_contract_drift",
    );
  if (!Value.Check(TriggerProcessQueryDetailsV1Schema, snapshot)) {
    throw new TriggerProcessObservationErrorV1("projection_contract_drift");
  }
  try {
    assertTriggerProcessQueryDetailsV1(snapshot);
  } catch {
    throw new TriggerProcessObservationErrorV1("projection_contract_drift");
  }
  return snapshot;
}

export function delegatedSnapshotIdentityAccessV1(
  principal: DelegatedProcessReadPrincipalV1,
): Readonly<{
  process_snapshot: boolean;
  context_snapshot: boolean;
}> {
  const observationWorkload =
    principal.principal_type === "service" &&
    principal.principal_id === "observation_gateway" &&
    principal.signed_bot_scope !== undefined;
  return Object.freeze({
    process_snapshot:
      observationWorkload &&
      principal.process_snapshot_identity_grant?.capability ===
        "trigger.process.snapshot.resolve" &&
      principal.process_snapshot_identity_grant.purpose ===
        "observation_replay",
    context_snapshot:
      observationWorkload &&
      principal.context_snapshot_identity_grant?.capability ===
        "trigger.context_snapshot.resolve" &&
      principal.context_snapshot_identity_grant.purpose === "audit_replay",
  });
}

function restrictSnapshotIdentitiesV1(
  details: TriggerProcessQueryDetailsV1,
  access: ReturnType<typeof delegatedSnapshotIdentityAccessV1>,
): TriggerProcessQueryDetailsV1 {
  if (access.process_snapshot && access.context_snapshot) return details;
  return Object.freeze({
    ...details,
    ...(!access.process_snapshot
      ? { process_snapshot_identity: null }
      : {}),
    ...(!access.context_snapshot
      ? { context_snapshot_identity: null }
      : {}),
  });
}

function eventSnapshotV1(
  value: unknown,
  processId: string,
  previousSequence: number,
): TriggerProcessSseEventV1 {
  const snapshot =
    canonicalObservationSnapshotV1<TriggerProcessSseEventV1>(
      value,
      "projection_contract_drift",
    );
  if (
    !Value.Check(TriggerProcessSseEventV1Schema, snapshot) ||
    snapshot.event_type === "trigger_process.summary" ||
    snapshot.trigger_process_id !== processId ||
    snapshot.append_sequence_no <= previousSequence
  ) {
    throw new TriggerProcessObservationErrorV1("projection_contract_drift");
  }
  try {
    assertTriggerProcessSseEventSemanticBindingsV1(snapshot);
  } catch {
    throw new TriggerProcessObservationErrorV1("projection_contract_drift");
  }
  return snapshot;
}

function eventFrame(event: TriggerProcessSseEventV1): string {
  return `id: ${triggerProcessSseEventIdV1(event)}\nevent: trigger_process_event\ndata: ${canonicalJsonV1(event)}\n\n`;
}

async function waitForPollOrAbortV1(
  signal: AbortSignal,
  waitMs: number,
): Promise<void> {
  if (signal.aborted) return;
  await new Promise<void>((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, waitMs);
    signal.addEventListener("abort", finish, { once: true });
  });
}

function summaryEvent(
  details: TriggerProcessQueryDetailsV1,
): TriggerProcessSummaryV1 {
  const event: TriggerProcessSummaryV1 = {
    schema_version: "trigger_process_sse_event.v1",
    trigger_process_id: details.id,
    append_sequence_no: details.snapshot_watermark,
    event_type: "trigger_process.summary",
    occurred_at: new Date().toISOString(),
    trace_id: `summary:${details.id}:${details.snapshot_watermark}`,
    observation_summary: {
      phase: details.phase,
      status: details.status,
      reason_code: details.reason_code,
      terminal_outcome: details.terminal_outcome,
      terminal_outcome_finalized_at: details.terminal_outcome_finalized_at,
      observation_finalized: details.observation_finalized,
    },
  };
  if (!Value.Check(TriggerProcessSummaryV1Schema, event)) {
    throw new TriggerProcessObservationErrorV1(
      "projection_contract_drift",
    );
  }
  try {
    assertTriggerProcessSummarySemanticBindingsV1(event);
  } catch {
    throw new TriggerProcessObservationErrorV1(
      "projection_contract_drift",
    );
  }
  return event;
}

export function createTriggerProcessObservationApplicationV1(
  repository: TriggerProcessObservationRepositoryV1,
  options: Readonly<{
    heartbeat_interval_ms?: number;
    replay_page_size?: number;
    max_connections_per_bot?: number;
    poll_interval_ms?: number;
    now_ms?: () => number;
  }> = {},
): TriggerProcessObservationApplicationV1 {
  const heartbeatMs = options.heartbeat_interval_ms ?? DEFAULT_HEARTBEAT_MS;
  const pageSize = options.replay_page_size ?? DEFAULT_REPLAY_PAGE_SIZE;
  const connectionLimit =
    options.max_connections_per_bot ?? DEFAULT_MAX_CONNECTIONS_PER_BOT;
  const pollIntervalMs = options.poll_interval_ms ?? 250;
  const nowMs = options.now_ms ?? Date.now;
  if (
    !Number.isSafeInteger(heartbeatMs) ||
    heartbeatMs < 10_000 ||
    heartbeatMs > 120_000 ||
    !Number.isSafeInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 1_000 ||
    !Number.isSafeInteger(connectionLimit) ||
    connectionLimit < 1 ||
    connectionLimit > 100 ||
    !Number.isSafeInteger(pollIntervalMs) ||
    pollIntervalMs < 10 ||
    pollIntervalMs > 10_000 ||
    typeof nowMs !== "function"
  ) {
    throw new Error("Trigger Process observation configuration is invalid");
  }
  const activeConnections = new Map<string, number>();

  async function getAuthorized(
    principal: DelegatedProcessReadPrincipalV1,
    processId: string,
    permissionScope: "trigger.process.read" | "trigger.process.events.read",
  ): Promise<Extract<TriggerProcessAuthorizedReadV1, { outcome: "found" }>> {
    assertIdentifier(processId, "process");
    const snapshotIdentityAccess =
      delegatedSnapshotIdentityAccessV1(principal);
    const readValue = await repository.readAuthorizedProcess({
      process_id: processId,
      principal,
      permission_scope: permissionScope,
    });
    const read =
      canonicalObservationSnapshotV1<TriggerProcessAuthorizedReadV1>(
        readValue,
        "projection_contract_drift",
      );
    if (read.outcome === "denied") {
      throw new TriggerProcessObservationErrorV1("bot_permission_denied");
    }
    if (read.outcome === "not_found") {
      throw new TriggerProcessObservationErrorV1("process_not_found");
    }
    const details = detailsSnapshotV1(read.details);
    if (
      details.id !== processId ||
      !Number.isSafeInteger(read.replay_cutoff) ||
      read.replay_cutoff < 0 ||
      read.replay_cutoff > details.snapshot_watermark ||
      typeof read.observation_closed !== "boolean"
    ) {
      throw new TriggerProcessObservationErrorV1("projection_contract_drift");
    }
    return Object.freeze({
      ...read,
      details: restrictSnapshotIdentitiesV1(
        details,
        snapshotIdentityAccess,
      ),
    });
  }

  return Object.freeze({
    async getProcess(
      principal: GetProcessArgumentsV1[0],
      processId: GetProcessArgumentsV1[1],
      traceId: GetProcessArgumentsV1[2],
    ) {
      principal =
        canonicalObservationSnapshotV1<DelegatedProcessReadPrincipalV1>(
          principal,
          "bot_permission_denied",
        );
      assertCredentialActiveV1(principal, nowMs());
      assertIdentifier(traceId, "trace");
      const read = await getAuthorized(
        principal,
        processId,
        "trigger.process.read",
      );
      assertCredentialActiveV1(principal, nowMs());
      const response: TriggerProcessGetResponseV1 = {
        code: "trigger_process_found",
        message: "trigger process found",
        retryable: false,
        trace_id: traceId,
        details: read.details,
      };
      if (!Value.Check(TriggerProcessGetResponseV1Schema, response)) {
        throw new TriggerProcessObservationErrorV1("projection_contract_drift");
      }
      return response;
    },

    async streamProcessEvents(
      principal: StreamProcessEventsArgumentsV1[0],
      request: StreamProcessEventsArgumentsV1[1],
      signal: StreamProcessEventsArgumentsV1[2],
    ) {
      principal =
        canonicalObservationSnapshotV1<DelegatedProcessReadPrincipalV1>(
          principal,
          "bot_permission_denied",
        );
      assertCredentialActiveV1(principal, nowMs());
      request =
        canonicalObservationSnapshotV1<TriggerProcessSseRequestV1>(
          request,
          "invalid_replay_cursor",
        );
      let cursor: number | null;
      try {
        cursor = parseTriggerProcessSseCursorV1(request);
      } catch {
        throw new TriggerProcessObservationErrorV1("invalid_replay_cursor");
      }
      const initial = await getAuthorized(
        principal,
        request.trigger_process_id,
        "trigger.process.events.read",
      );
      assertCredentialActiveV1(principal, nowMs());
      if (cursor !== null && cursor > initial.details.snapshot_watermark) {
        throw new TriggerProcessObservationErrorV1("cursor_ahead");
      }
      if (cursor !== null && cursor < initial.replay_cutoff) {
        throw new TriggerProcessObservationErrorV1("replay_expired");
      }
      const botId = initial.details.bot_id;
      const active = activeConnections.get(botId) ?? 0;
      if (active >= connectionLimit) {
        throw new TriggerProcessObservationErrorV1("rate_limited");
      }
      activeConnections.set(botId, active + 1);

      async function* stream(): AsyncIterable<string> {
        let after = cursor ?? initial.details.snapshot_watermark;
        let finalSummarySent = false;
        try {
          if (cursor === null) {
            if (credentialExpiredV1(principal, nowMs())) return;
            yield eventFrame(summaryEvent(initial.details));
            finalSummarySent = initial.observation_closed;
            if (finalSummarySent) return;
          }
          let lastActivityAt = nowMs();
          while (!signal.aborted) {
            if (credentialExpiredV1(principal, nowMs())) return;
            const pageValue = await repository.readAuthorizedEventPage({
              process_id: request.trigger_process_id,
              principal,
              permission_scope: "trigger.process.events.read",
              after_append_sequence_no: after,
              limit: pageSize,
            });
            if (credentialExpiredV1(principal, nowMs())) return;
            const page =
              canonicalObservationSnapshotV1<TriggerProcessEventReplayPageV1>(
                pageValue,
                "projection_contract_drift",
              );
            if (page.outcome === "denied") {
              throw new TriggerProcessObservationErrorV1("bot_permission_denied");
            }
            if (page.outcome === "not_found") {
              throw new TriggerProcessObservationErrorV1("process_not_found");
            }
            if (
              page.outcome !== "found" ||
              !Array.isArray(page.events) ||
              typeof page.observation_closed !== "boolean" ||
              (page.details !== null &&
                (typeof page.details !== "object" ||
                  Array.isArray(page.details))) ||
              !Number.isSafeInteger(page.current_watermark) ||
              !Number.isSafeInteger(page.replay_cutoff) ||
              page.current_watermark < after ||
              page.replay_cutoff < 0 ||
              page.replay_cutoff > page.current_watermark ||
              (after < page.replay_cutoff && page.events.length === 0)
            ) {
              throw new TriggerProcessObservationErrorV1("projection_contract_drift");
            }
            const pageDetails =
              page.details === null
                ? null
                : detailsSnapshotV1(page.details);
            if (
              pageDetails !== null &&
              (pageDetails.id !== request.trigger_process_id ||
                pageDetails.snapshot_watermark !==
                  page.current_watermark)
            ) {
              throw new TriggerProcessObservationErrorV1(
                "projection_contract_drift",
              );
            }
            if (
              page.events.length === 0 &&
              after < page.current_watermark
            ) {
              throw new TriggerProcessObservationErrorV1(
                after < page.replay_cutoff
                  ? "replay_expired"
                  : "projection_contract_drift",
              );
            }
            for (const eventValue of page.events) {
              if (credentialExpiredV1(principal, nowMs())) return;
              const event = eventSnapshotV1(
                eventValue,
                request.trigger_process_id,
                after,
              );
              if (event.append_sequence_no !== after + 1) {
                if (after < page.replay_cutoff) {
                  throw new TriggerProcessObservationErrorV1("replay_expired");
                }
                throw new TriggerProcessObservationErrorV1(
                  "projection_contract_drift",
                );
              }
              after = event.append_sequence_no;
              lastActivityAt = nowMs();
              yield eventFrame(event);
            }
            if (page.observation_closed && after >= page.current_watermark) {
              if (!finalSummarySent && pageDetails !== null) {
                if (credentialExpiredV1(principal, nowMs())) return;
                yield eventFrame(summaryEvent(pageDetails));
              }
              return;
            }
            if (page.events.length === 0) {
              const waitMs = Math.min(
                pollIntervalMs,
                Math.max(1, heartbeatMs - (nowMs() - lastActivityAt)),
              );
              await waitForPollOrAbortV1(signal, waitMs);
              if (
                !signal.aborted &&
                !credentialExpiredV1(principal, nowMs()) &&
                nowMs() - lastActivityAt >= heartbeatMs
              ) {
                lastActivityAt = nowMs();
                yield ":heartbeat\n\n";
              }
            }
          }
        } finally {
          const current = activeConnections.get(botId) ?? 1;
          if (current <= 1) activeConnections.delete(botId);
          else activeConnections.set(botId, current - 1);
        }
      }
      return stream();
    },
  });
}
