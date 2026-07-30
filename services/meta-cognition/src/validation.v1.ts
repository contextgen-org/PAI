import {
  assertQualitySignalSemanticBindingsV1,
  assertMetaJobCreateSemanticBindingsV1,
  KnowThatWriteItemV1Schema,
  MetaSkillCandidateV1Schema,
  MetaJobCreateRequestV1Schema,
  MemoryWriteItemV1Schema,
  QualitySignalV1Schema,
  TypedEvidenceRefV1Schema,
  type KnowThatWriteItemV1,
  type MetaResultPayloadV1,
  type MetaSkillCandidateV1,
  type MemoryWriteItemV1,
  type QualitySignalV1,
  type TypedEvidenceRefV1,
} from "@pai/contracts";
import type { TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import {
  assertBoundedMetaJsonV1,
  assertNoRuntimeTokenV1,
  snapshotCanonicalJsonV1,
} from "./canonical.v1.js";
import {
  MetaCognitionErrorV1,
  type MetaBotScopeV1,
  type MetaEvidenceBoundItemV1,
  type MetaJobCreateRequestV1,
  type MetaProviderOutputV1,
} from "./meta-types.v1.js";

const IDENTIFIER_PATTERN = /^[^\u0000-\u001f\u007f]+$/u;

function isDataRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function identifier(value: unknown, maximum = 512): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= maximum &&
    value.trim() === value &&
    IDENTIFIER_PATTERN.test(value)
  );
}

function invalidRequest(message: string): never {
  throw new MetaCognitionErrorV1(
    "invalid_request",
    message,
    false,
  );
}

export function parseMetaJobCreateRequestV1(
  value: unknown,
  now: Date,
): MetaJobCreateRequestV1 {
  try {
    assertBoundedMetaJsonV1(value);
  } catch {
    invalidRequest("Meta job create request is outside the canonical JSON boundary");
  }
  if (!Value.Check(MetaJobCreateRequestV1Schema, value)) {
    invalidRequest("Meta job create request is invalid");
  }
  try {
    assertMetaJobCreateSemanticBindingsV1(value, now.getTime());
  } catch {
    invalidRequest("Meta job create request semantic binding is invalid");
  }
  assertNoRuntimeTokenV1(value);
  return snapshotCanonicalJsonV1(value);
}

export function sameMetaScopeV1(
  left: MetaBotScopeV1,
  right: MetaBotScopeV1,
): boolean {
  return (
    left.workspace_id === right.workspace_id &&
    left.bot_id === right.bot_id &&
    left.owner_agent_id === right.owner_agent_id &&
    left.deployment_environment === right.deployment_environment &&
    left.release_channel === right.release_channel
  );
}

function parseEvidenceItemV1(
  value: unknown,
  maximumEvidenceRefs: number,
  payloadSchema: TSchema,
  expectedItemId: (payload: Readonly<Record<string, unknown>>) => string | undefined,
  payloadEvidenceRefs: (
    payload: Readonly<Record<string, unknown>>,
  ) => readonly string[],
  semanticCheck?: (payload: Readonly<Record<string, unknown>>) => void,
): MetaEvidenceBoundItemV1 {
  let payloadValid = false;
  if (isDataRecord(value) && isDataRecord(value.payload)) {
    try {
      payloadValid = Value.Check(payloadSchema, value.payload);
    } catch {
      payloadValid = false;
    }
  }
  if (
    !isDataRecord(value) ||
    !exactKeys(value, ["item_id", "payload", "evidence_refs"]) ||
    !identifier(value.item_id, 256) ||
    !isDataRecord(value.payload) ||
    !payloadValid ||
    !Array.isArray(value.evidence_refs) ||
    value.evidence_refs.length < 1 ||
    value.evidence_refs.length > maximumEvidenceRefs ||
    new Set(value.evidence_refs).size !== value.evidence_refs.length ||
    !value.evidence_refs.every(
      (entry) => Value.Check(TypedEvidenceRefV1Schema, entry),
    )
  ) {
    throw new MetaCognitionErrorV1(
      "provider_invalid",
      "Meta provider returned an invalid evidence-bound item",
      true,
    );
  }
  const boundItemId = expectedItemId(value.payload);
  const expectedEvidence = [...new Set(payloadEvidenceRefs(value.payload))].sort();
  const actualEvidence = [...value.evidence_refs].sort();
  if (
    (boundItemId !== undefined && boundItemId !== value.item_id) ||
    expectedEvidence.length !== actualEvidence.length ||
    expectedEvidence.some((entry, index) => entry !== actualEvidence[index])
  ) {
    throw new MetaCognitionErrorV1(
      "provider_invalid",
      "Meta provider item identity/evidence does not match its owner payload",
      false,
    );
  }
  try {
    semanticCheck?.(value.payload);
  } catch (error) {
    throw new MetaCognitionErrorV1(
      "provider_invalid",
      "Meta provider item violates its owner semantic contract",
      false,
      { cause: error },
    );
  }
  assertNoRuntimeTokenV1(value);
  const payload = snapshotCanonicalJsonV1(value.payload);
  return Object.freeze({
    item_id: value.item_id,
    payload,
    evidence_refs: Object.freeze([
      ...(value.evidence_refs as TypedEvidenceRefV1[]),
    ]),
  }) as MetaEvidenceBoundItemV1;
}

function memoryEvidenceRefs(
  payload: Readonly<Record<string, unknown>>,
): readonly string[] {
  const item = payload as unknown as MemoryWriteItemV1;
  return [
    item.source_info.source_ref,
    ...(item.source_info.source_refs ?? []),
    ...(item.source_info.evidence_refs ?? []),
    ...item.human_agent_relation.flatMap(
      (relation) => relation.evidence_refs ?? [],
    ),
  ];
}

function directEvidenceRefs(
  payload: Readonly<Record<string, unknown>>,
): readonly string[] {
  const refs = payload.evidence_refs;
  return Array.isArray(refs)
    ? refs.filter((entry): entry is string => typeof entry === "string")
    : [];
}

export function parseMetaProviderOutputV1(
  value: unknown,
  limits: Readonly<{
    max_output_items: number;
    max_evidence_refs: number;
  }>,
): MetaProviderOutputV1 {
  try {
    assertBoundedMetaJsonV1(value);
  } catch (error) {
    throw new MetaCognitionErrorV1(
      "provider_invalid",
      "Meta provider structured output is outside the canonical JSON boundary",
      false,
      { cause: error },
    );
  }
  if (
    !isDataRecord(value) ||
    !exactKeys(value, [
      "schema_version",
      "summary",
      "execution_summary",
      "reflection_summary",
      "evidence_refs",
      "quality_score",
      "memory_writes",
      "knowthat_candidates",
      "skill_candidates",
      "quality_signals",
    ]) ||
    value.schema_version !== "meta_provider_output.v1" ||
    !identifier(value.summary, 65_536) ||
    !isDataRecord(value.execution_summary) ||
    !identifier(value.reflection_summary, 65_536) ||
    !Array.isArray(value.evidence_refs) ||
    value.evidence_refs.length < 1 ||
    value.evidence_refs.length > limits.max_evidence_refs ||
    new Set(value.evidence_refs).size !== value.evidence_refs.length ||
    !value.evidence_refs.every((entry) => identifier(entry, 2_048)) ||
    typeof value.quality_score !== "number" ||
    !Number.isFinite(value.quality_score) ||
    value.quality_score < 0 ||
    value.quality_score > 1
  ) {
    throw new MetaCognitionErrorV1(
      "provider_invalid",
      "Meta provider structured output is invalid",
      true,
    );
  }
  const parseItems = <TPayload extends object>(
    candidate: unknown,
    payloadSchema: TSchema,
    expectedItemId: (
      payload: Readonly<Record<string, unknown>>,
    ) => string | undefined,
    evidence: (
      payload: Readonly<Record<string, unknown>>,
    ) => readonly string[],
    semanticCheck?: (
      payload: Readonly<Record<string, unknown>>,
    ) => void,
  ): readonly MetaEvidenceBoundItemV1<TPayload>[] => {
    if (
      !Array.isArray(candidate) ||
      candidate.length > limits.max_output_items
    ) {
      throw new MetaCognitionErrorV1(
        "provider_invalid",
        "Meta provider output exceeds its bounded item count",
        true,
      );
    }
    const parsed = candidate.map((entry) =>
      parseEvidenceItemV1(
        entry,
        limits.max_evidence_refs,
        payloadSchema,
        expectedItemId,
        evidence,
        semanticCheck,
      ) as MetaEvidenceBoundItemV1<TPayload>,
    );
    if (new Set(parsed.map((entry) => entry.item_id)).size !== parsed.length) {
      throw new MetaCognitionErrorV1(
        "provider_invalid",
        "Meta provider item ids must be unique per collection",
        true,
      );
    }
    return Object.freeze(parsed);
  };
  const memoryWrites = parseItems<MemoryWriteItemV1>(
    value.memory_writes,
    MemoryWriteItemV1Schema,
    (payload) =>
      typeof payload.client_item_id === "string"
        ? payload.client_item_id
        : undefined,
    memoryEvidenceRefs,
  );
  const knowthatCandidates = parseItems<KnowThatWriteItemV1>(
    value.knowthat_candidates,
    KnowThatWriteItemV1Schema,
    (payload) =>
      typeof payload.client_item_id === "string"
        ? payload.client_item_id
        : undefined,
    directEvidenceRefs,
  );
  const skillCandidates = parseItems<MetaSkillCandidateV1>(
    value.skill_candidates,
    MetaSkillCandidateV1Schema,
    (payload) =>
      typeof payload.candidate_id === "string"
        ? payload.candidate_id
        : undefined,
    directEvidenceRefs,
  );
  const qualitySignals = parseItems<QualitySignalV1>(
    value.quality_signals,
    QualitySignalV1Schema,
    () => undefined,
    directEvidenceRefs,
    (payload) =>
      assertQualitySignalSemanticBindingsV1(
        payload as unknown as QualitySignalV1,
      ),
  );
  const allItems = [
    ...memoryWrites,
    ...knowthatCandidates,
    ...skillCandidates,
    ...qualitySignals,
  ];
  const allEvidenceRefs = [
    ...value.evidence_refs,
    ...allItems.flatMap((item) => item.evidence_refs),
  ];
  if (
    allItems.length > limits.max_output_items ||
    new Set(allItems.map((item) => item.item_id)).size !== allItems.length ||
    allEvidenceRefs.length > limits.max_evidence_refs
  ) {
    throw new MetaCognitionErrorV1(
      "provider_invalid",
      "Meta provider output exceeds aggregate item/evidence limits",
      true,
    );
  }
  const result: MetaProviderOutputV1 = {
    schema_version: "meta_provider_output.v1",
    summary: value.summary,
    execution_summary: snapshotCanonicalJsonV1(
      value.execution_summary,
    ) as MetaResultPayloadV1["experience_summary"]["execution_summary"],
    reflection_summary: value.reflection_summary,
    evidence_refs: Object.freeze([
      ...(value.evidence_refs as TypedEvidenceRefV1[]),
    ]),
    quality_score: value.quality_score,
    memory_writes: memoryWrites,
    knowthat_candidates: knowthatCandidates,
    skill_candidates: skillCandidates,
    quality_signals: qualitySignals,
  };
  assertNoRuntimeTokenV1(result);
  return Object.freeze(result);
}

export function isPlainDataRecordV1(
  value: unknown,
): value is Record<string, unknown> {
  return isDataRecord(value);
}
