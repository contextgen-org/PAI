import { randomUUID } from "node:crypto";

import type {
  MetaCognitionDomainEventV1,
  MetaLlmRunMetadataV1,
  MetaSolidifiedEventRefV1,
} from "@pai/contracts";

import {
  assertNoRuntimeTokenV1,
  sha256CanonicalV1,
} from "./canonical.v1.js";
import {
  MetaCognitionErrorV1,
  type MetaCompensationCommandV1,
  type MetaEvidenceArtifactV1,
  type MetaExperienceRecordV1,
  type MetaFailureV1,
  type MetaJobAuditV1,
  type MetaJobCreateRequestV1,
  type MetaJobRecordV1,
  type MetaLeaseFenceV1,
  type MetaLeaseGrantV1,
  type MetaProviderOutputV1,
  type MetaResultV1,
} from "./meta-types.v1.js";

export interface MetaTerminalArtifactsV1 {
  readonly result: MetaResultV1;
  readonly experience: MetaExperienceRecordV1;
  readonly skill_candidates: readonly Readonly<{
    candidate: MetaResultV1["payload"]["skill_candidates"][number];
    evidence_artifacts: readonly MetaEvidenceArtifactV1[];
  }>[];
  readonly events: readonly MetaCognitionDomainEventV1[];
  readonly compensation_commands: readonly MetaCompensationCommandV1[];
  readonly commit_hash: `sha256:${string}`;
}

export type MetaCreateOrReuseResultV1 =
  | Readonly<{ outcome: "created"; job: MetaJobRecordV1 }>
  | Readonly<{ outcome: "reused"; job: MetaJobRecordV1 }>;

export interface MetaProviderOutputCheckpointV1 {
  readonly request_hash: `sha256:${string}`;
  readonly output_hash: `sha256:${string}`;
  readonly output: MetaProviderOutputV1;
  readonly solidified_event_range: Readonly<{
    first_append_sequence_no: number;
    last_append_sequence_no: number;
  }>;
  readonly llm_run_metadata: MetaLlmRunMetadataV1;
  readonly solidified_event_refs: readonly MetaSolidifiedEventRefV1[];
  readonly evidence_artifacts: readonly MetaEvidenceArtifactV1[];
}

export interface MetaJobRepositoryPortV1 {
  createOrReuse(input: Readonly<{
    job_id: string;
    request: MetaJobCreateRequestV1;
    request_hash: `sha256:${string}`;
    created_event: MetaCognitionDomainEventV1;
    now: Date;
  }>): Promise<MetaCreateOrReuseResultV1>;
  readJob(jobId: string): Promise<MetaJobRecordV1 | undefined>;
  readResult(jobId: string): Promise<MetaResultV1 | undefined>;
  readProviderOutput(
    jobId: string,
  ): Promise<MetaProviderOutputCheckpointV1 | undefined>;
  checkpointProviderOutput(input: Readonly<{
    fence: MetaLeaseFenceV1;
    output: MetaProviderOutputV1;
    output_hash: `sha256:${string}`;
    solidified_event_range: Readonly<{
      first_append_sequence_no: number;
      last_append_sequence_no: number;
    }>;
    llm_run_metadata: MetaLlmRunMetadataV1;
    solidified_event_refs: readonly MetaSolidifiedEventRefV1[];
    evidence_artifacts: readonly MetaEvidenceArtifactV1[];
    now: Date;
  }>): Promise<Readonly<{
    outcome: "stored" | "replayed";
    checkpoint: MetaProviderOutputCheckpointV1;
  }>>;
  acquireLease(input: Readonly<{
    job_id: string;
    owner_id: string;
    expected_generation: number;
    now: Date;
    lease_ttl_ms: number;
    takeover_grace_ms: number;
    trace_id: string;
  }>): Promise<MetaLeaseGrantV1>;
  heartbeatLease(input: Readonly<{
    fence: MetaLeaseFenceV1;
    now: Date;
    lease_ttl_ms: number;
    trace_id: string;
  }>): Promise<MetaLeaseGrantV1>;
  startJob(input: Readonly<{
    fence: MetaLeaseFenceV1;
    now: Date;
    trace_id: string;
    event: MetaCognitionDomainEventV1;
  }>): Promise<MetaJobRecordV1>;
  checkpointOutboundEvents(input: Readonly<{
    fence: MetaLeaseFenceV1;
    events: readonly MetaCognitionDomainEventV1[];
    now: Date;
    trace_id: string;
  }>): Promise<readonly MetaCognitionDomainEventV1[]>;
  isLeaseCurrent(fence: MetaLeaseFenceV1, now: Date): Promise<boolean>;
  recordStaleAttempt(input: Readonly<{
    job_id: string;
    owner_id: string;
    lease_generation: number;
    now: Date;
    trace_id: string;
    reason_code: string;
  }>): Promise<void>;
  commitRetryWait(input: Readonly<{
    fence: MetaLeaseFenceV1;
    failure: MetaFailureV1;
    next_retry_at: Date;
    events: readonly MetaCognitionDomainEventV1[];
    compensation_commands: readonly MetaCompensationCommandV1[];
    result_artifacts?: MetaTerminalArtifactsV1;
    now: Date;
    trace_id: string;
  }>): Promise<MetaJobRecordV1>;
  commitFailed(input: Readonly<{
    fence: MetaLeaseFenceV1;
    failure: MetaFailureV1;
    events: readonly MetaCognitionDomainEventV1[];
    compensation_commands: readonly MetaCompensationCommandV1[];
    result_artifacts?: MetaTerminalArtifactsV1;
    now: Date;
    trace_id: string;
  }>): Promise<MetaJobRecordV1>;
  commitCompleted(input: Readonly<{
    fence: MetaLeaseFenceV1;
    artifacts: MetaTerminalArtifactsV1;
    now: Date;
    trace_id: string;
  }>): Promise<Readonly<{
    outcome: "completed" | "replayed";
    job: MetaJobRecordV1;
    result: MetaResultV1;
  }>>;
  checkReadiness?(signal: AbortSignal): Promise<void>;
}

interface MutableLeaseV1 {
  job_id: string;
  lease_id: string;
  lease_generation: number;
  owner_id: string;
  lease_expires_at: string;
  heartbeat_at: string;
  attempt: number;
  released: boolean;
}

interface StoredTerminalV1 {
  readonly commit_hash: `sha256:${string}`;
  readonly result: MetaResultV1;
  readonly experience: MetaExperienceRecordV1;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function immutable<T>(value: T): T {
  return Object.freeze(clone(value));
}

function safeNextGeneration(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value >= Number.MAX_SAFE_INTEGER) {
    throw new Error("Meta job lease generation exhausted");
  }
  return value + 1;
}

function leaseGrant(
  lease: MutableLeaseV1,
  takeover: boolean,
): MetaLeaseGrantV1 {
  return immutable({
    job_id: lease.job_id,
    lease_id: lease.lease_id,
    lease_generation: lease.lease_generation,
    owner_id: lease.owner_id,
    lease_expires_at: lease.lease_expires_at,
    heartbeat_at: lease.heartbeat_at,
    attempt: lease.attempt,
    takeover,
  });
}

export interface InMemoryMetaJobRepositoryInspectionV1 {
  readonly jobs: readonly MetaJobRecordV1[];
  readonly audits: readonly MetaJobAuditV1[];
  readonly events: readonly MetaCognitionDomainEventV1[];
  readonly compensation_commands: readonly MetaCompensationCommandV1[];
  readonly experiences: readonly MetaExperienceRecordV1[];
  readonly results: readonly MetaResultV1[];
}

export function createInMemoryMetaJobRepositoryV1(
  options: Readonly<{ id_factory?: () => string }> = {},
): MetaJobRepositoryPortV1 & {
  inspect(): InMemoryMetaJobRepositoryInspectionV1;
} {
  const idFactory = options.id_factory ?? randomUUID;
  const jobs = new Map<string, MetaJobRecordV1>();
  const jobByIdempotency = new Map<string, string>();
  const leases = new Map<string, MutableLeaseV1>();
  const audits: MetaJobAuditV1[] = [];
  const events: MetaCognitionDomainEventV1[] = [];
  const commands: MetaCompensationCommandV1[] = [];
  const terminal = new Map<string, StoredTerminalV1>();
  const providerOutputs = new Map<string, MetaProviderOutputCheckpointV1>();
  const durableEventHashes = new Map<string, `sha256:${string}`>();
  const durableCommandHashes = new Map<string, `sha256:${string}`>();

  const audit = (
    job: MetaJobRecordV1,
    input: Omit<
      MetaJobAuditV1,
      "audit_id" | "meta_job_id" | "created_at"
    >,
    now: Date,
  ) => {
    audits.push(
      immutable({
        audit_id: `meta_audit_${idFactory()}`,
        meta_job_id: job.id,
        ...input,
        created_at: now.toISOString(),
      }),
    );
  };

  const currentJob = (jobId: string): MetaJobRecordV1 => {
    const job = jobs.get(jobId);
    if (job === undefined) {
      throw new MetaCognitionErrorV1(
        "job_not_found",
        "Meta job was not found",
        false,
      );
    }
    return job;
  };

  const exactLease = (
    fence: MetaLeaseFenceV1,
    now: Date,
  ): MutableLeaseV1 => {
    const lease = leases.get(fence.job_id);
    if (
      lease === undefined ||
      lease.lease_id !== fence.lease_id ||
      lease.lease_generation !== fence.lease_generation ||
      lease.owner_id !== fence.owner_id ||
      lease.released ||
      Date.parse(lease.lease_expires_at) <= now.getTime()
    ) {
      throw new MetaCognitionErrorV1(
        "stale_lease",
        "Meta job lease is stale",
        false,
      );
    }
    return lease;
  };

  const durableEventsByIdempotency = new Map<
    string,
    MetaCognitionDomainEventV1
  >();

  const eventReplayHash = (
    event: MetaCognitionDomainEventV1,
  ): `sha256:${string}` => {
    const { occurred_at: _occurredAt, ...stableEvent } = event;
    return sha256CanonicalV1(stableEvent);
  };

  const appendDurable = (
    durableEvents: readonly MetaCognitionDomainEventV1[],
    durableCommands: readonly MetaCompensationCommandV1[],
  ): readonly MetaCognitionDomainEventV1[] => {
    for (const value of [...durableEvents, ...durableCommands]) {
      assertNoRuntimeTokenV1(value);
    }
    const stagedEventHashes = new Map(durableEventHashes);
    const stagedCommandHashes = new Map(durableCommandHashes);
    const newEvents: MetaCognitionDomainEventV1[] = [];
    const newCommands: MetaCompensationCommandV1[] = [];
    const canonicalEvents: MetaCognitionDomainEventV1[] = [];
    for (const event of durableEvents) {
      const hash = eventReplayHash(event);
      const existing = stagedEventHashes.get(event.idempotency_key);
      if (existing !== undefined && existing !== hash) {
        throw new MetaCognitionErrorV1(
          "commit_drift",
          "Meta durable event idempotency drifted",
          false,
        );
      }
      if (existing === undefined) {
        stagedEventHashes.set(event.idempotency_key, hash);
        newEvents.push(event);
        canonicalEvents.push(event);
      } else {
        const canonical = durableEventsByIdempotency.get(
          event.idempotency_key,
        );
        if (canonical === undefined) {
          throw new MetaCognitionErrorV1(
            "commit_drift",
            "Meta durable event index is incomplete",
            false,
          );
        }
        canonicalEvents.push(canonical);
      }
    }
    for (const command of durableCommands) {
      const hash = sha256CanonicalV1(command);
      const existing = stagedCommandHashes.get(command.idempotency_key);
      if (existing !== undefined && existing !== hash) {
        throw new MetaCognitionErrorV1(
          "commit_drift",
          "Meta durable command idempotency drifted",
          false,
        );
      }
      if (existing === undefined) {
        stagedCommandHashes.set(command.idempotency_key, hash);
        newCommands.push(command);
      }
    }
    for (const event of newEvents) {
      durableEventHashes.set(
        event.idempotency_key,
        stagedEventHashes.get(event.idempotency_key)!,
      );
      const stored = immutable(event);
      durableEventsByIdempotency.set(event.idempotency_key, stored);
      events.push(stored);
    }
    for (const command of newCommands) {
      durableCommandHashes.set(
        command.idempotency_key,
        stagedCommandHashes.get(command.idempotency_key)!,
      );
      commands.push(immutable(command));
    }
    return Object.freeze(canonicalEvents.map((event) => immutable(event)));
  };

  const sameScope = (
    job: MetaJobRecordV1,
    value: Readonly<{
      workspace_id: string;
      bot_id: string;
      owner_agent_id: string;
      deployment_environment: string;
      release_channel: string;
    }>,
  ): boolean =>
    job.workspace_id === value.workspace_id &&
    job.bot_id === value.bot_id &&
    job.owner_agent_id === value.owner_agent_id &&
    job.deployment_environment === value.deployment_environment &&
    job.release_channel === value.release_channel;

  const assertDurableBindings = (
    job: MetaJobRecordV1,
    fence: MetaLeaseFenceV1,
    durableEvents: readonly MetaCognitionDomainEventV1[],
    durableCommands: readonly MetaCompensationCommandV1[],
  ): void => {
    if (
      new Set(durableEvents.map((event) => event.event_id)).size !==
        durableEvents.length ||
      new Set(durableEvents.map((event) => event.idempotency_key)).size !==
        durableEvents.length ||
      durableEvents.some(
        (event) =>
          event.producer !== "meta_cognition" ||
          event.schema_version !== "meta_cognition_event.v1" ||
          event.payload.meta_job_id !== job.id ||
          event.payload.trigger_process_id !== job.trigger_process_id ||
          !sameScope(job, event.payload) ||
          (event.event_type === "meta.job.started" &&
            event.payload.lease_generation !== fence.lease_generation) ||
          !event.idempotency_key.startsWith(`${job.id}:`),
      ) ||
      new Set(durableCommands.map((command) => command.command_id)).size !==
        durableCommands.length ||
      new Set(
        durableCommands.map((command) => command.idempotency_key),
      ).size !== durableCommands.length ||
      durableCommands.some(
        (command) =>
          command.meta_job_id !== job.id ||
          command.lease_generation !== fence.lease_generation ||
          !sameScope(job, command) ||
          command.request_payload_hash !==
            sha256CanonicalV1(command.request_payload) ||
          !command.idempotency_key.startsWith(`${job.id}:`),
      )
    ) {
      throw new MetaCognitionErrorV1(
        "commit_drift",
        "Meta durable artifacts are not bound to their job and lease",
        false,
      );
    }
  };

  const assertTerminalCompensationBindings = (
    artifacts: MetaTerminalArtifactsV1,
  ): void => {
    const activeFailures = artifacts.result.payload.partial_failures.filter(
      (failure) =>
        failure.status === "pending" || failure.status === "retrying",
    );
    const commandsById = new Map(
      artifacts.compensation_commands.map((command) => [
        command.command_id,
        command,
      ]),
    );
    const exactActiveBindings =
      activeFailures.length === artifacts.compensation_commands.length &&
      activeFailures.every((failure) => {
        const commandId = failure.compensation_outbox_id;
        if (
          commandId === undefined ||
          failure.compensation_ref !== commandId
        ) {
          return false;
        }
        const command = commandsById.get(commandId);
        const summaryFailure = artifacts.result.partial_failures.find(
          (candidate) =>
            candidate.source === failure.target_service &&
            candidate.item_id ===
              command?.request_payload.failed_item.client_item_id,
        );
        return (
          command !== undefined &&
          summaryFailure !== undefined &&
          summaryFailure.compensation_required &&
          summaryFailure.mode ===
            (failure.blocking ? "blocking" : "nonblocking") &&
          command.target_service === failure.target_service &&
          command.request_payload.target_service === failure.target_service &&
          command.request_payload.item_id ===
            command.request_payload.failed_item.client_item_id
        );
      });
    if (
      (artifacts.result.result_status === "partial_pending" &&
        !exactActiveBindings) ||
      (artifacts.result.result_status !== "partial_pending" &&
        (activeFailures.length !== 0 ||
          artifacts.compensation_commands.length !== 0))
    ) {
      throw new MetaCognitionErrorV1(
        "commit_drift",
        "Meta terminal compensation is not exactly bound to active result failures",
        false,
      );
    }
  };

  const assertTerminalSkillCandidateBindings = (
    artifacts: MetaTerminalArtifactsV1,
  ): void => {
    const expected = artifacts.result.payload.skill_candidates;
    if (
      expected.length !== artifacts.skill_candidates.length ||
      expected.length !== artifacts.result.skill_candidate_refs.length ||
      expected.some(
        (candidate, index) =>
          artifacts.skill_candidates[index]?.candidate.candidate_id !==
            candidate.candidate_id ||
          artifacts.result.skill_candidate_refs[index] !== candidate.candidate_id,
      )
    ) {
      throw new MetaCognitionErrorV1(
        "commit_drift",
        "Meta terminal Skill candidate identity drifted",
        false,
      );
    }
    for (const entry of artifacts.skill_candidates) {
      const keys = entry.evidence_artifacts.map(
        ({ ref, hash }) => `${ref}\u0000${hash}`,
      );
      if (
        entry.candidate.evidence_refs.length !==
          entry.evidence_artifacts.length ||
        new Set(keys).size !== keys.length ||
        entry.evidence_artifacts.some(
          ({ ref, hash }, index) =>
            entry.candidate.evidence_refs[index] !== ref ||
            !/^sha256:[0-9a-f]{64}$/u.test(hash),
        )
      ) {
        throw new MetaCognitionErrorV1(
          "commit_drift",
          "Meta terminal Skill candidate evidence binding drifted",
          false,
        );
      }
    }
  };

  const validateResultArtifacts = (
    job: MetaJobRecordV1,
    fence: MetaLeaseFenceV1,
    artifacts: MetaTerminalArtifactsV1,
  ): StoredTerminalV1 => {
    if (
      artifacts.result.meta_job_id !== job.id ||
      artifacts.result.trigger_process_id !== job.trigger_process_id ||
      artifacts.experience.trigger_process_id !== job.trigger_process_id ||
      !sameScope(job, artifacts.result) ||
      !sameScope(job, artifacts.experience) ||
      artifacts.experience.snapshot_ref !== job.snapshot_ref ||
      artifacts.experience.snapshot_version !== job.snapshot_version ||
      artifacts.experience.snapshot_hash !== job.snapshot_hash ||
      !Number.isSafeInteger(artifacts.result.result_version) ||
      artifacts.result.result_version < 1 ||
      sha256CanonicalV1({
        result: artifacts.result,
        experience: artifacts.experience,
        skill_candidates: artifacts.skill_candidates,
        events: artifacts.events,
        compensation_commands: artifacts.compensation_commands,
      }) !== artifacts.commit_hash
    ) {
      throw new MetaCognitionErrorV1(
        "commit_drift",
        "Meta result artifacts are not bound to their job and commit hash",
        false,
      );
    }
    assertDurableBindings(
      job,
      fence,
      artifacts.events,
      artifacts.compensation_commands,
    );
    assertTerminalSkillCandidateBindings(artifacts);
    assertTerminalCompensationBindings(artifacts);
    const previous = terminal.get(job.id);
    if (
      (previous === undefined &&
        artifacts.result.result_version !== 1) ||
      (previous !== undefined &&
        (artifacts.result.id !== previous.result.id ||
          artifacts.experience.id !== previous.experience.id ||
          sha256CanonicalV1(artifacts.experience) !==
            sha256CanonicalV1(previous.experience) ||
          artifacts.result.result_version !==
            safeNextGeneration(previous.result.result_version)))
    ) {
      throw new MetaCognitionErrorV1(
        "commit_drift",
        "Meta result version or experience identity drifted",
        false,
      );
    }
    assertNoRuntimeTokenV1(artifacts);
    return immutable({
      commit_hash: artifacts.commit_hash,
      result: artifacts.result,
      experience: artifacts.experience,
    });
  };

  const repository: MetaJobRepositoryPortV1 & {
    inspect(): InMemoryMetaJobRepositoryInspectionV1;
  } = {
    async createOrReuse({
      job_id,
      request,
      request_hash,
      created_event,
      now,
    }) {
      const existingId = jobByIdempotency.get(request.idempotency_key);
      if (existingId !== undefined) {
        const existing = currentJob(existingId);
        if (!sameScope(existing, request)) {
          throw new MetaCognitionErrorV1(
            "authorization_scope_mismatch",
            "Meta job scope does not match the existing Trigger Process",
            false,
          );
        }
        if (existing.request_hash !== request_hash) {
          throw new MetaCognitionErrorV1(
            "idempotency_conflict",
            "Meta job idempotency key was reused with a different request",
            false,
          );
        }
        audit(
          existing,
          {
            previous_status: existing.status,
            next_status: existing.status,
            owner_id: null,
            lease_generation: null,
            action: "reused",
            reason_code: "idempotent_replay",
            trace_id: request.trace_id,
          },
          now,
        );
        return { outcome: "reused", job: immutable(existing) };
      }
      if (jobs.has(job_id)) {
        throw new MetaCognitionErrorV1(
          "idempotency_conflict",
          "Meta job identity collided with another request",
          false,
        );
      }
      if (
        created_event.event_type !== "meta.job.created" ||
        created_event.payload.meta_job_id !== job_id ||
        created_event.payload.trigger_process_id !== request.trigger_process_id ||
        created_event.idempotency_key !== `${job_id}:meta.job.created:created` ||
        created_event.payload.snapshot_ref !== request.snapshot_ref ||
        created_event.payload.snapshot_version !== request.snapshot_version ||
        created_event.payload.snapshot_hash !== request.snapshot_hash ||
        created_event.payload.workspace_id !== request.workspace_id ||
        created_event.payload.bot_id !== request.bot_id ||
        created_event.payload.owner_agent_id !== request.owner_agent_id ||
        created_event.payload.deployment_environment !==
          request.deployment_environment ||
        created_event.payload.release_channel !== request.release_channel
      ) {
        throw new MetaCognitionErrorV1(
          "commit_drift",
          "Meta job created event is not bound to its request",
          false,
        );
      }
      const job: MetaJobRecordV1 = immutable({
        ...request,
        id: job_id,
        request_hash,
        status: "queued",
        lease_previous_status: null,
        attempt_count: 0,
        next_retry_at: null,
        error: null,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      });
      appendDurable([created_event], []);
      jobs.set(job.id, job);
      jobByIdempotency.set(request.idempotency_key, job.id);
      audit(
        job,
        {
          previous_status: "queued",
          next_status: "queued",
          owner_id: null,
          lease_generation: null,
          action: "created",
          reason_code: "meta_job_created",
          trace_id: request.trace_id,
        },
        now,
      );
      return { outcome: "created", job: immutable(job) };
    },

    async readJob(jobId) {
      const value = jobs.get(jobId);
      return value === undefined ? undefined : immutable(value);
    },

    async readResult(jobId) {
      const value = terminal.get(jobId)?.result;
      return value === undefined ? undefined : immutable(value);
    },

    async readProviderOutput(jobId) {
      const value = providerOutputs.get(jobId);
      return value === undefined ? undefined : immutable(value);
    },

    async checkpointProviderOutput({
      fence,
      output,
      output_hash,
      solidified_event_range,
      llm_run_metadata,
      solidified_event_refs,
      evidence_artifacts,
      now,
    }) {
      exactLease(fence, now);
      const job = currentJob(fence.job_id);
      if (job.status !== "running") {
        throw new MetaCognitionErrorV1(
          "invalid_job_state",
          "Meta provider output checkpoint requires running state",
          false,
        );
      }
      const existing = providerOutputs.get(job.id);
      if (existing !== undefined) {
        if (
          existing.request_hash !== job.request_hash ||
          sha256CanonicalV1(existing.solidified_event_range) !==
            sha256CanonicalV1(solidified_event_range) ||
          sha256CanonicalV1(existing.llm_run_metadata) !==
            sha256CanonicalV1(llm_run_metadata) ||
          sha256CanonicalV1(existing.solidified_event_refs) !==
            sha256CanonicalV1(solidified_event_refs) ||
          sha256CanonicalV1(existing.evidence_artifacts) !==
            sha256CanonicalV1(evidence_artifacts)
        ) {
          throw new MetaCognitionErrorV1(
            "commit_drift",
            "Meta provider output checkpoint request drifted",
            false,
          );
        }
        return { outcome: "replayed", checkpoint: immutable(existing) };
      }
      assertNoRuntimeTokenV1(output);
      if (sha256CanonicalV1(output) !== output_hash) {
        throw new MetaCognitionErrorV1(
          "commit_drift",
          "Meta provider output checkpoint hash drifted",
          false,
        );
      }
      const checkpoint = immutable({
        request_hash: job.request_hash,
        output_hash,
        output,
        solidified_event_range,
        llm_run_metadata,
        solidified_event_refs,
        evidence_artifacts,
      });
      providerOutputs.set(job.id, checkpoint);
      return { outcome: "stored", checkpoint: immutable(checkpoint) };
    },

    async acquireLease(input) {
      const job = currentJob(input.job_id);
      if (job.status === "completed" || job.status === "failed") {
        throw new MetaCognitionErrorV1(
          "invalid_job_state",
          "A terminal Meta job cannot be leased",
          false,
        );
      }
      if (
        job.status === "retry_wait" &&
        terminal.get(job.id)?.result.result_status === "partial_pending"
      ) {
        throw new MetaCognitionErrorV1(
          "invalid_job_state",
          "A Meta job with active durable compensation is reconciler-owned",
          false,
        );
      }
      if (
        job.status === "retry_wait" &&
        (job.next_retry_at === null ||
          Date.parse(job.next_retry_at) > input.now.getTime())
      ) {
        throw new MetaCognitionErrorV1(
          "job_not_due",
          "Meta job retry is not due",
          true,
        );
      }
      const previousLease = leases.get(job.id);
      const currentGeneration = previousLease?.lease_generation ?? 0;
      if (input.expected_generation !== currentGeneration) {
        throw new MetaCognitionErrorV1(
          "stale_lease",
          "Meta job lease generation changed",
          false,
        );
      }
      if (
        previousLease !== undefined &&
        !previousLease.released &&
        Date.parse(previousLease.lease_expires_at) +
          input.takeover_grace_ms >
          input.now.getTime()
      ) {
        throw new MetaCognitionErrorV1(
          "lease_busy",
          "Meta job is already leased",
          true,
        );
      }
      const generation = safeNextGeneration(currentGeneration);
      const nextLease: MutableLeaseV1 = {
        job_id: job.id,
        lease_id: `meta_lease_${idFactory()}`,
        lease_generation: generation,
        owner_id: input.owner_id,
        lease_expires_at: new Date(
          input.now.getTime() + input.lease_ttl_ms,
        ).toISOString(),
        heartbeat_at: input.now.toISOString(),
        attempt: job.attempt_count + 1,
        released: false,
      };
      const nextJob: MetaJobRecordV1 = immutable({
        ...job,
        status: "leased",
        lease_previous_status:
          job.status === "leased" ? job.lease_previous_status : job.status,
        attempt_count: nextLease.attempt,
        next_retry_at: null,
        error: null,
        updated_at: input.now.toISOString(),
      });
      leases.set(job.id, nextLease);
      jobs.set(job.id, nextJob);
      audit(
        nextJob,
        {
          previous_status: job.status,
          next_status: "leased",
          owner_id: input.owner_id,
          lease_generation: generation,
          action:
            previousLease === undefined || previousLease.released
              ? "leased"
              : "taken_over",
          reason_code:
            previousLease === undefined || previousLease.released
              ? "lease_acquired"
              : "lease_taken_over",
          trace_id: input.trace_id,
        },
        input.now,
      );
      return leaseGrant(
        nextLease,
        previousLease !== undefined && !previousLease.released,
      );
    },

    async heartbeatLease({ fence, now, lease_ttl_ms, trace_id }) {
      const lease = exactLease(fence, now);
      const job = currentJob(fence.job_id);
      if (job.status !== "leased" && job.status !== "running") {
        throw new MetaCognitionErrorV1(
          "invalid_job_state",
          "Meta job cannot heartbeat outside leased/running",
          false,
        );
      }
      lease.heartbeat_at = now.toISOString();
      lease.lease_expires_at = new Date(
        now.getTime() + lease_ttl_ms,
      ).toISOString();
      audit(
        job,
        {
          previous_status: job.status,
          next_status: job.status,
          owner_id: fence.owner_id,
          lease_generation: fence.lease_generation,
          action: "heartbeat",
          reason_code: "lease_heartbeat",
          trace_id,
        },
        now,
      );
      return leaseGrant(lease, false);
    },

    async startJob({ fence, now, trace_id, event }) {
      exactLease(fence, now);
      const job = currentJob(fence.job_id);
      if (job.status === "running") return immutable(job);
      if (job.status !== "leased") {
        throw new MetaCognitionErrorV1(
          "invalid_job_state",
          "Meta job cannot start from its current state",
          false,
        );
      }
      assertDurableBindings(job, fence, [event], []);
      if (event.event_type !== "meta.job.started") {
        throw new MetaCognitionErrorV1(
          "commit_drift",
          "Meta job start event is invalid",
          false,
        );
      }
      const next: MetaJobRecordV1 = immutable({
        ...job,
        status: "running",
        lease_previous_status: null,
        updated_at: now.toISOString(),
      });
      appendDurable([event], []);
      jobs.set(job.id, next);
      audit(
        next,
        {
          previous_status: job.status,
          next_status: "running",
          owner_id: fence.owner_id,
          lease_generation: fence.lease_generation,
          action: "started",
          reason_code: "meta_job_started",
          trace_id,
        },
        now,
      );
      return immutable(next);
    },

    async checkpointOutboundEvents({ fence, events: values, now, trace_id }) {
      exactLease(fence, now);
      const job = currentJob(fence.job_id);
      if (
        job.status !== "running" ||
        values.length < 1 ||
        values.some(
          (event) =>
            event.event_type !== "meta.memory.write_requested" &&
            event.event_type !== "meta.knowthat.write_requested" &&
            event.event_type !== "meta.candidate.review_requested" &&
            event.event_type !==
              "meta.skill.candidate_application_requested" &&
            event.event_type !== "meta.feedback.required",
        )
      ) {
        throw new MetaCognitionErrorV1(
          "invalid_job_state",
          "Meta outbound checkpoint requires running command events",
          false,
        );
      }
      assertDurableBindings(job, fence, values, []);
      const canonicalEvents = appendDurable(values, []);
      audit(
        job,
        {
          previous_status: "running",
          next_status: "running",
          owner_id: fence.owner_id,
          lease_generation: fence.lease_generation,
          action: "outbound_checkpointed",
          reason_code: "outbound_events_checkpointed",
          trace_id,
        },
        now,
      );
      return canonicalEvents;
    },

    async isLeaseCurrent(fence, now) {
      try {
        exactLease(fence, now);
        const job = currentJob(fence.job_id);
        return job.status === "leased" || job.status === "running";
      } catch {
        return false;
      }
    },

    async recordStaleAttempt(input) {
      const job = currentJob(input.job_id);
      audit(
        job,
        {
          previous_status: job.status,
          next_status: job.status,
          owner_id: input.owner_id,
          lease_generation: input.lease_generation,
          action: "stale_worker_rejected",
          reason_code: input.reason_code,
          trace_id: input.trace_id,
        },
        input.now,
      );
    },

    async commitRetryWait(input) {
      exactLease(input.fence, input.now);
      const job = currentJob(input.fence.job_id);
      if (job.status !== "running") {
        throw new MetaCognitionErrorV1(
          "invalid_job_state",
          "Meta job retry requires running state",
          false,
        );
      }
      assertDurableBindings(
        job,
        input.fence,
        input.events,
        input.compensation_commands,
      );
      if (
        input.events.filter(
          (event) => event.event_type === "meta.job.retry_wait",
        ).length !== 1 ||
        input.events.some(
          (event) =>
            event.event_type === "meta.job.failed" ||
            event.event_type === "meta.job.completed",
        )
      ) {
        throw new MetaCognitionErrorV1(
          "commit_drift",
          "Meta retry transition has invalid durable events",
          false,
        );
      }
      let storedResult: StoredTerminalV1 | undefined;
      if (input.result_artifacts !== undefined) {
        storedResult = validateResultArtifacts(
          job,
          input.fence,
          input.result_artifacts,
        );
        if (
          input.result_artifacts.result.result_status !==
            "partial_pending" ||
          input.result_artifacts.result.finalized_at !== null ||
          input.result_artifacts.compensation_commands.length < 1 ||
          !input.result_artifacts.result.payload.partial_failures.some(
            (failure) =>
              failure.blocking &&
              (failure.status === "pending" ||
                failure.status === "retrying") &&
              failure.compensation_outbox_id !== undefined,
          ) ||
          sha256CanonicalV1(input.events) !==
            sha256CanonicalV1(input.result_artifacts.events) ||
          sha256CanonicalV1(input.compensation_commands) !==
            sha256CanonicalV1(
              input.result_artifacts.compensation_commands,
            ) ||
          input.events.filter(
            (event) => event.event_type === "meta.result.updated",
          ).length !== 1 ||
          input.events.some(
            (event) =>
              event.event_type === "meta.result.finalized" ||
              event.event_type === "meta.job.completed" ||
              event.event_type === "meta.job.failed",
          )
        ) {
          throw new MetaCognitionErrorV1(
            "commit_drift",
            "Meta retry result is not an active partial_pending handoff",
            false,
          );
        }
      }
      const next: MetaJobRecordV1 = immutable({
        ...job,
        status: "retry_wait",
        lease_previous_status: null,
        next_retry_at: input.next_retry_at.toISOString(),
        error: input.failure,
        updated_at: input.now.toISOString(),
      });
      appendDurable(input.events, input.compensation_commands);
      jobs.set(job.id, next);
      if (storedResult !== undefined) {
        terminal.set(job.id, storedResult);
      }
      const lease = leases.get(job.id);
      if (lease !== undefined) {
        lease.lease_expires_at = input.now.toISOString();
        lease.released = true;
      }
      audit(
        next,
        {
          previous_status: job.status,
          next_status: "retry_wait",
          owner_id: input.fence.owner_id,
          lease_generation: input.fence.lease_generation,
          action: "retry_wait",
          reason_code: input.failure.code,
          trace_id: input.trace_id,
        },
        input.now,
      );
      return immutable(next);
    },

    async commitFailed(input) {
      exactLease(input.fence, input.now);
      const job = currentJob(input.fence.job_id);
      if (job.status !== "running") {
        throw new MetaCognitionErrorV1(
          "invalid_job_state",
          "Meta job failure requires running state",
          false,
        );
      }
      assertDurableBindings(
        job,
        input.fence,
        input.events,
        input.compensation_commands,
      );
      if (
        input.compensation_commands.length !== 0 ||
        input.events.filter((event) => event.event_type === "meta.job.failed")
          .length !== 1 ||
        input.events.some(
          (event) =>
            event.event_type === "meta.job.retry_wait" ||
            event.event_type === "meta.job.completed",
        )
      ) {
        throw new MetaCognitionErrorV1(
          "commit_drift",
          "Meta failure transition has invalid durable events",
          false,
        );
      }
      let storedResult: StoredTerminalV1 | undefined;
      if (input.result_artifacts !== undefined) {
        storedResult = validateResultArtifacts(
          job,
          input.fence,
          input.result_artifacts,
        );
        if (
          input.result_artifacts.result.result_status !==
            "partial_failed" ||
          input.result_artifacts.result.finalized_at === null ||
          input.result_artifacts.compensation_commands.length !== 0 ||
          sha256CanonicalV1(input.events) !==
            sha256CanonicalV1(input.result_artifacts.events) ||
          input.events.filter(
            (event) => event.event_type === "meta.result.updated",
          ).length !== 1 ||
          input.events.filter(
            (event) => event.event_type === "meta.result.finalized",
          ).length !== 1 ||
          input.events.some(
            (event) =>
              event.event_type === "meta.job.retry_wait" ||
              event.event_type === "meta.job.completed",
          )
        ) {
          throw new MetaCognitionErrorV1(
            "commit_drift",
            "Meta failed result is not a finalized partial_failed handoff",
            false,
          );
        }
      }
      const next: MetaJobRecordV1 = immutable({
        ...job,
        status: "failed",
        lease_previous_status: null,
        next_retry_at: null,
        error: input.failure,
        updated_at: input.now.toISOString(),
      });
      appendDurable(input.events, input.compensation_commands);
      jobs.set(job.id, next);
      if (storedResult !== undefined) {
        terminal.set(job.id, storedResult);
      }
      const lease = leases.get(job.id);
      if (lease !== undefined) {
        lease.lease_expires_at = input.now.toISOString();
        lease.released = true;
      }
      audit(
        next,
        {
          previous_status: job.status,
          next_status: "failed",
          owner_id: input.fence.owner_id,
          lease_generation: input.fence.lease_generation,
          action: "failed",
          reason_code: input.failure.code,
          trace_id: input.trace_id,
        },
        input.now,
      );
      return immutable(next);
    },

    async commitCompleted(input) {
      const existing = terminal.get(input.fence.job_id);
      if (existing !== undefined) {
        if (existing.commit_hash !== input.artifacts.commit_hash) {
          throw new MetaCognitionErrorV1(
            "commit_drift",
            "Meta terminal commit replay drifted",
            false,
          );
        }
        return {
          outcome: "replayed",
          job: immutable(currentJob(input.fence.job_id)),
          result: immutable(existing.result),
        };
      }
      exactLease(input.fence, input.now);
      const job = currentJob(input.fence.job_id);
      if (job.status !== "running") {
        throw new MetaCognitionErrorV1(
          "invalid_job_state",
          "Meta result commit requires running state",
          false,
        );
      }
      if (
        !Number.isSafeInteger(
          input.artifacts.result.result_version,
        ) ||
        input.artifacts.result.result_version < 1 ||
        input.artifacts.result.meta_job_id !== job.id ||
        input.artifacts.result.trigger_process_id !== job.trigger_process_id ||
        input.artifacts.experience.trigger_process_id !== job.trigger_process_id ||
        !sameScope(job, input.artifacts.result) ||
        !sameScope(job, input.artifacts.experience) ||
        input.artifacts.experience.snapshot_ref !== job.snapshot_ref ||
        input.artifacts.experience.snapshot_version !== job.snapshot_version ||
        input.artifacts.experience.snapshot_hash !== job.snapshot_hash ||
        sha256CanonicalV1({
          result: input.artifacts.result,
          experience: input.artifacts.experience,
          skill_candidates: input.artifacts.skill_candidates,
          events: input.artifacts.events,
          compensation_commands: input.artifacts.compensation_commands,
        }) !== input.artifacts.commit_hash
      ) {
        throw new MetaCognitionErrorV1(
          "commit_drift",
          "Meta terminal artifacts are not bound to their commit hash",
          false,
        );
      }
      assertDurableBindings(
        job,
        input.fence,
        input.artifacts.events,
        input.artifacts.compensation_commands,
      );
      assertTerminalSkillCandidateBindings(input.artifacts);
      assertTerminalCompensationBindings(input.artifacts);
      for (const requiredType of [
        "meta.experience.created",
        "meta.result.updated",
        "meta.job.completed",
      ] as const) {
        if (
          input.artifacts.events.filter(
            (event) => event.event_type === requiredType,
          ).length !== 1
        ) {
          throw new MetaCognitionErrorV1(
            "commit_drift",
            `Meta terminal commit is missing ${requiredType}`,
            false,
          );
        }
      }
      const finalizedEventCount = input.artifacts.events.filter(
        (event) => event.event_type === "meta.result.finalized",
      ).length;
      if (
        (input.artifacts.result.finalized_at === null &&
          (input.artifacts.result.result_status !== "partial_pending" ||
            input.artifacts.compensation_commands.length < 1 ||
            finalizedEventCount !== 0)) ||
        (input.artifacts.result.finalized_at !== null &&
          (input.artifacts.result.result_status === "partial_pending" ||
            input.artifacts.compensation_commands.length !== 0 ||
            finalizedEventCount !== 1))
      ) {
        throw new MetaCognitionErrorV1(
          "commit_drift",
          "Meta result finalization does not match active compensation",
          false,
        );
      }
      if (
        input.artifacts.events.some(
          (event) =>
            event.event_type === "meta.job.retry_wait" ||
            event.event_type === "meta.job.failed",
        )
      ) {
        throw new MetaCognitionErrorV1(
          "commit_drift",
          "Meta terminal commit includes a failure transition",
          false,
        );
      }
      assertNoRuntimeTokenV1(input.artifacts);
      const next: MetaJobRecordV1 = immutable({
        ...job,
        status: "completed",
        lease_previous_status: null,
        next_retry_at: null,
        error: null,
        updated_at: input.now.toISOString(),
      });
      appendDurable(
        input.artifacts.events,
        input.artifacts.compensation_commands,
      );
      jobs.set(job.id, next);
      const lease = leases.get(job.id);
      if (lease !== undefined) {
        lease.lease_expires_at = input.now.toISOString();
        lease.released = true;
      }
      terminal.set(
        job.id,
        immutable({
          commit_hash: input.artifacts.commit_hash,
          result: input.artifacts.result,
          experience: input.artifacts.experience,
        }),
      );
      audit(
        next,
        {
          previous_status: job.status,
          next_status: "completed",
          owner_id: input.fence.owner_id,
          lease_generation: input.fence.lease_generation,
          action: "completed",
          reason_code: "meta_job_completed",
          trace_id: input.trace_id,
        },
        input.now,
      );
      return {
        outcome: "completed",
        job: immutable(next),
        result: immutable(input.artifacts.result),
      };
    },

    async checkReadiness() {},

    inspect() {
      return Object.freeze({
        jobs: Object.freeze([...jobs.values()].map(immutable)),
        audits: Object.freeze(audits.map(immutable)),
        events: Object.freeze(events.map(immutable)),
        compensation_commands: Object.freeze(commands.map(immutable)),
        experiences: Object.freeze(
          [...terminal.values()].map((entry) => immutable(entry.experience)),
        ),
        results: Object.freeze(
          [...terminal.values()].map((entry) => immutable(entry.result)),
        ),
      });
    },
  };
  return Object.freeze(repository);
}
