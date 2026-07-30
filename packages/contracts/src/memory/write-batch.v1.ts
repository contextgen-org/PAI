import { Type, type Static } from "@sinclair/typebox";

import { canonicalJsonV1 } from "../shared/canonical-json.v1.js";
import { TypedEvidenceRefV1Schema } from "../shared/typed-evidence-ref.v1.js";

type JsonRecordV1 = Readonly<Record<string, unknown>>;

function utf8BytesV1(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit <= 0x7f) {
      bytes += 1;
    } else if (codeUnit <= 0x7ff) {
      bytes += 2;
    } else if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const low = value.charCodeAt(index + 1);
      if (low < 0xdc00 || low > 0xdfff) {
        throw new Error("memory contract rejects unpaired UTF-16 surrogates");
      }
      bytes += 4;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      throw new Error("memory contract rejects unpaired UTF-16 surrogates");
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

function canonicalJsonBytesV1(value: unknown): number {
  return utf8BytesV1(
    canonicalJsonV1(value, {
      max_bytes: 2_097_152,
      max_depth: 64,
      max_nodes: 100_000,
      max_container_entries: 10_000,
    }),
  );
}

function assertUtf8BytesV1(
  value: string,
  maxUtf8Bytes: number,
  field: string,
): void {
  if (utf8BytesV1(value) > maxUtf8Bytes) {
    throw new Error(`${field} exceeds ${maxUtf8Bytes} UTF-8 bytes`);
  }
}

function canonicalIdentityV1(value: unknown): string {
  return canonicalJsonV1(value, {
    max_bytes: 65_536,
    max_depth: 64,
    max_nodes: 10_000,
    max_container_entries: 10_000,
  });
}

function assertUniqueCanonicalV1(
  values: readonly unknown[],
  field: string,
  identity: (value: unknown) => string = canonicalIdentityV1,
): void {
  const seen = new Set<string>();
  for (const value of values) {
    const key = identity(value);
    if (seen.has(key)) {
      throw new Error(`${field} contains a duplicate canonical identity`);
    }
    seen.add(key);
  }
}

export const MemoryIdV1Schema = Type.String({
  minLength: 1,
  maxUtf8Bytes: 256,
});

export const MemoryHintV1Schema = Type.String({
  minLength: 1,
  maxUtf8Bytes: 256,
});

export const MemorySubjectRefV1Schema = Type.Object(
  {
    subject_type: Type.Union([
      Type.Literal("user"),
      Type.Literal("agent"),
      Type.Literal("organization"),
      Type.Literal("project"),
      Type.Literal("system"),
      Type.Literal("other"),
    ]),
    canonical_id: Type.Optional(MemoryIdV1Schema),
    label: Type.Optional(MemoryHintV1Schema),
    primary: Type.Optional(Type.Boolean()),
  },
  {
    additionalProperties: false,
    atLeastOneOf: ["canonical_id", "label"],
  },
);

export const MemoryRelationPayloadV1Schema = Type.Object(
  {
    relation_type: MemoryHintV1Schema,
    target: MemorySubjectRefV1Schema,
    direction: Type.Union([
      Type.Literal("outbound"),
      Type.Literal("inbound"),
      Type.Literal("bidirectional"),
    ]),
    confidence_score: Type.Number({ minimum: 0, maximum: 1 }),
    evidence_refs: Type.Optional(
      Type.Array(TypedEvidenceRefV1Schema, {
        maxItems: 64,
        uniqueByCanonicalIdentity: true,
      }),
    ),
  },
  { additionalProperties: false },
);

export const MemorySourceInfoV1Schema = Type.Object(
  {
    source_type: Type.Union([
      Type.Literal("trigger_snapshot"),
      Type.Literal("user_explicit"),
      Type.Literal("agent_observation"),
      Type.Literal("tool_result"),
      Type.Literal("system_event"),
      Type.Literal("import"),
    ]),
    source_ref: TypedEvidenceRefV1Schema,
    source_refs: Type.Optional(
      Type.Array(TypedEvidenceRefV1Schema, {
        maxItems: 64,
        uniqueByCanonicalIdentity: true,
      }),
    ),
    actor_type: Type.Union([
      Type.Literal("user"),
      Type.Literal("agent"),
      Type.Literal("system"),
      Type.Literal("tool"),
    ]),
    actor_id: Type.Optional(MemoryIdV1Schema),
    evidence_refs: Type.Optional(
      Type.Array(TypedEvidenceRefV1Schema, {
        maxItems: 64,
        uniqueByCanonicalIdentity: true,
      }),
    ),
    trace_id: Type.Optional(MemoryIdV1Schema),
  },
  { additionalProperties: false },
);

export const MEMORY_SCENE_TAGS_V1 = [
  "work_planning",
  "architecture_review",
  "implementation",
  "debugging",
  "decision_making",
  "follow_up",
  "personal_preference",
  "relationship",
  "other",
] as const;

export const MEMORY_EMOTION_TAGS_V1 = [
  "neutral",
  "satisfied",
  "confused",
  "frustrated",
  "urgent",
  "uncertain",
  "concerned",
  "positive",
] as const;

export const MemorySceneTagV1Schema = Type.Union(
  MEMORY_SCENE_TAGS_V1.map((tag) => Type.Literal(tag)),
);
export const MemoryEmotionTagV1Schema = Type.Union(
  MEMORY_EMOTION_TAGS_V1.map((tag) => Type.Literal(tag)),
);

export const MemoryWriteItemV1Schema = Type.Object(
  {
    client_item_id: MemoryIdV1Schema,
    source_item_id: Type.Optional(MemoryIdV1Schema),
    content_summary: Type.String({
      minLength: 1,
      maxUtf8Bytes: 16_384,
    }),
    subject_refs: Type.Array(MemorySubjectRefV1Schema, {
      minItems: 1,
      maxItems: 32,
      uniqueByCanonicalIdentity: true,
      exactlyOnePrimary: "required_when_multiple",
    }),
    topic_hint: Type.Optional(MemoryHintV1Schema),
    aspect_hint: Type.Optional(MemoryHintV1Schema),
    scope_hint: Type.Optional(MemoryHintV1Schema),
    human_agent_relation: Type.Array(MemoryRelationPayloadV1Schema, {
      maxItems: 64,
      uniqueByCanonicalIdentity: true,
    }),
    keyword_tags: Type.Array(MemoryHintV1Schema, {
      maxItems: 64,
      uniqueByCanonicalIdentity: true,
    }),
    scene_tags: Type.Array(MemorySceneTagV1Schema, {
      maxItems: 16,
      uniqueByCanonicalIdentity: true,
    }),
    emotion_tags: Type.Array(MemoryEmotionTagV1Schema, {
      maxItems: 16,
      uniqueByCanonicalIdentity: true,
    }),
    source_info: MemorySourceInfoV1Schema,
    confidence_score: Type.Number({ minimum: 0, maximum: 1 }),
    occurred_at: Type.String({
      format: "date-time",
      maxUtf8Bytes: 64,
    }),
    evidence_valid_until: Type.Optional(
      Type.Union([
        Type.String({
          format: "date-time",
          maxUtf8Bytes: 64,
        }),
        Type.Null(),
      ]),
    ),
  },
  {
    additionalProperties: false,
    maxCanonicalJsonBytes: 65_536,
  },
);

export const MemoryWriteBatchRequestV1Schema = Type.Object(
  {
    schema_version: Type.Literal("memory.write_batch.v1"),
    bot_id: MemoryIdV1Schema,
    trigger_process_id: MemoryIdV1Schema,
    source_meta_job_id: MemoryIdV1Schema,
    idempotency_key: Type.String({
      minLength: 1,
      maxUtf8Bytes: 128,
    }),
    compatibility_mode: Type.Optional(Type.Literal("legacy_subject_order")),
    items: Type.Array(MemoryWriteItemV1Schema, {
      minItems: 1,
      maxItems: 100,
      uniqueByCanonicalIdentity: "client_item_id",
    }),
  },
  {
    $id: "urn:pai:memory:write-batch-request:v1",
    additionalProperties: false,
    maxCanonicalJsonBytes: 2_097_152,
  },
);

export const MemoryWriteWarningV1Schema = Type.Object(
  {
    code: Type.Literal("legacy_primary_fallback"),
    field_path: Type.String({ maxUtf8Bytes: 256 }),
    compatibility_mode: Type.Literal("legacy_subject_order"),
    audit_ref: MemoryIdV1Schema,
    client_item_id: Type.Optional(MemoryIdV1Schema),
  },
  { additionalProperties: false },
);

export const MemoryWriteSucceededV1Schema = Type.Object(
  {
    client_item_id: MemoryIdV1Schema,
    status: Type.Literal("succeeded"),
    decision: Type.Union([
      Type.Literal("new_series"),
      Type.Literal("append_version"),
      Type.Literal("merge_existing"),
      Type.Literal("conflict_review"),
    ]),
    memory_point_id: Type.Optional(MemoryIdV1Schema),
    series_id: MemoryIdV1Schema,
    topic_key: MemoryIdV1Schema,
    version_no: Type.Optional(
      Type.Integer({
        minimum: 1,
        maximum: Number.MAX_SAFE_INTEGER,
      }),
    ),
    conflict_ids: Type.Array(MemoryIdV1Schema, {
      maxItems: 64,
      uniqueByCanonicalIdentity: true,
    }),
  },
  { additionalProperties: false },
);

export const MemoryWriteRejectedV1Schema = Type.Object(
  {
    client_item_id: MemoryIdV1Schema,
    status: Type.Literal("rejected"),
    code: Type.String({ minLength: 1, maxUtf8Bytes: 256 }),
    message: Type.String({ minLength: 1, maxUtf8Bytes: 1_024 }),
    field_path: Type.Optional(Type.String({ maxUtf8Bytes: 256 })),
  },
  { additionalProperties: false },
);

export const MemoryWriteItemResultV1Schema = Type.Union([
  MemoryWriteSucceededV1Schema,
  MemoryWriteRejectedV1Schema,
]);

export const MemoryWriteBatchResponseV1Schema = Type.Object(
  {
    schema_version: Type.Literal("memory.write_batch.v1"),
    write_batch_id: MemoryIdV1Schema,
    batch_status: Type.Union([
      Type.Literal("completed"),
      Type.Literal("partial_failed"),
    ]),
    item_results: Type.Array(MemoryWriteItemResultV1Schema, {
      minItems: 1,
      maxItems: 100,
      uniqueByCanonicalIdentity: "client_item_id",
    }),
    accepted_point_ids: Type.Array(MemoryIdV1Schema, {
      maxItems: 100,
      uniqueByCanonicalIdentity: true,
    }),
    rejected_items: Type.Array(MemoryWriteRejectedV1Schema, {
      maxItems: 100,
      uniqueByCanonicalIdentity: "client_item_id",
    }),
    conflict_ids: Type.Array(MemoryIdV1Schema, {
      maxItems: 6_400,
      uniqueByCanonicalIdentity: true,
    }),
    warnings: Type.Array(MemoryWriteWarningV1Schema, { maxItems: 100 }),
    duplicate_replayed: Type.Boolean(),
  },
  {
    $id: "urn:pai:memory:write-batch-response:v1",
    additionalProperties: false,
  },
);

export const MemoryWriteBatchV1Schema = Type.Union(
  [MemoryWriteBatchRequestV1Schema, MemoryWriteBatchResponseV1Schema],
  { $id: "urn:pai:memory:write-batch:v1" },
);

export type MemorySubjectRefV1 = Static<typeof MemorySubjectRefV1Schema>;
export type MemoryRelationPayloadV1 = Static<
  typeof MemoryRelationPayloadV1Schema
>;
export type MemorySourceInfoV1 = Static<typeof MemorySourceInfoV1Schema>;
export type MemoryWriteItemV1 = Static<typeof MemoryWriteItemV1Schema>;
export type MemoryWriteBatchRequestV1 = Static<
  typeof MemoryWriteBatchRequestV1Schema
>;
export type MemoryWriteSucceededV1 = Static<
  typeof MemoryWriteSucceededV1Schema
>;
export type MemoryWriteRejectedV1 = Static<typeof MemoryWriteRejectedV1Schema>;
export type MemoryWriteItemResultV1 = Static<
  typeof MemoryWriteItemResultV1Schema
>;
export type MemoryWriteBatchResponseV1 = Static<
  typeof MemoryWriteBatchResponseV1Schema
>;

function assertSubjectRefV1(
  subject: MemorySubjectRefV1,
  field: string,
): void {
  if (subject.canonical_id === undefined && subject.label === undefined) {
    throw new Error(`${field} requires canonical_id or label`);
  }
  if (subject.canonical_id !== undefined) {
    assertUtf8BytesV1(subject.canonical_id, 256, `${field}.canonical_id`);
  }
  if (subject.label !== undefined) {
    assertUtf8BytesV1(subject.label, 256, `${field}.label`);
  }
}

function assertWriteItemV1(
  item: MemoryWriteItemV1,
  index: number,
  compatibilityMode: MemoryWriteBatchRequestV1["compatibility_mode"],
): void {
  const field = `items/${index}`;
  if (canonicalJsonBytesV1(item) > 65_536) {
    throw new Error(`${field} exceeds 65536 canonical JSON bytes`);
  }
  assertUtf8BytesV1(item.client_item_id, 256, `${field}/client_item_id`);
  assertUtf8BytesV1(
    item.content_summary,
    16_384,
    `${field}/content_summary`,
  );
  assertUniqueCanonicalV1(item.subject_refs, `${field}/subject_refs`);
  item.subject_refs.forEach((subject, subjectIndex) =>
    assertSubjectRefV1(subject, `${field}/subject_refs/${subjectIndex}`),
  );
  const primaryCount = item.subject_refs.filter(
    (subject) => subject.primary === true,
  ).length;
  if (
    primaryCount > 1 ||
    (item.subject_refs.length > 1 &&
      primaryCount === 0 &&
      compatibilityMode !== "legacy_subject_order")
  ) {
    throw new Error(`${field}/subject_refs requires exactly one primary`);
  }
  assertUniqueCanonicalV1(
    item.human_agent_relation,
    `${field}/human_agent_relation`,
  );
  assertUniqueCanonicalV1(item.keyword_tags, `${field}/keyword_tags`);
  assertUniqueCanonicalV1(item.scene_tags, `${field}/scene_tags`);
  assertUniqueCanonicalV1(item.emotion_tags, `${field}/emotion_tags`);
  for (const relation of item.human_agent_relation) {
    assertSubjectRefV1(relation.target, `${field}/human_agent_relation/target`);
    if (relation.evidence_refs !== undefined) {
      assertUniqueCanonicalV1(
        relation.evidence_refs,
        `${field}/human_agent_relation/evidence_refs`,
      );
    }
  }
  if (item.source_info.source_refs !== undefined) {
    assertUniqueCanonicalV1(
      item.source_info.source_refs,
      `${field}/source_info/source_refs`,
    );
  }
  if (item.source_info.evidence_refs !== undefined) {
    assertUniqueCanonicalV1(
      item.source_info.evidence_refs,
      `${field}/source_info/evidence_refs`,
    );
  }
  if (!Number.isFinite(Date.parse(item.occurred_at))) {
    throw new Error(`${field}/occurred_at must be an RFC 3339 timestamp`);
  }
  if (
    item.evidence_valid_until !== undefined &&
    item.evidence_valid_until !== null &&
    (!Number.isFinite(Date.parse(item.evidence_valid_until)) ||
      new Date(Date.parse(item.evidence_valid_until)).toISOString() !==
        item.evidence_valid_until)
  ) {
    throw new Error(
      `${field}/evidence_valid_until must be null or a canonical RFC 3339 timestamp`,
    );
  }
}

export function assertMemoryWriteBatchRequestSemanticBindingsV1(
  request: MemoryWriteBatchRequestV1,
): void {
  if (canonicalJsonBytesV1(request) > 2_097_152) {
    throw new Error("memory write batch exceeds 2097152 canonical JSON bytes");
  }
  assertUtf8BytesV1(request.bot_id, 256, "bot_id");
  assertUtf8BytesV1(request.trigger_process_id, 256, "trigger_process_id");
  assertUtf8BytesV1(request.source_meta_job_id, 256, "source_meta_job_id");
  assertUtf8BytesV1(request.idempotency_key, 128, "idempotency_key");
  assertUniqueCanonicalV1(
    request.items,
    "items",
    (value) => (value as MemoryWriteItemV1).client_item_id,
  );
  request.items.forEach((item, index) =>
    assertWriteItemV1(item, index, request.compatibility_mode),
  );
}

export function assertMemoryWriteBatchResponseSemanticBindingsV1(
  response: MemoryWriteBatchResponseV1,
): void {
  assertUniqueCanonicalV1(
    response.item_results,
    "item_results",
    (value) => (value as MemoryWriteItemResultV1).client_item_id,
  );
  assertUniqueCanonicalV1(response.accepted_point_ids, "accepted_point_ids");
  assertUniqueCanonicalV1(
    response.rejected_items,
    "rejected_items",
    (value) => (value as MemoryWriteRejectedV1).client_item_id,
  );
  assertUniqueCanonicalV1(response.conflict_ids, "conflict_ids");

  const rejectedResults = response.item_results.filter(
    (result): result is MemoryWriteRejectedV1 => result.status === "rejected",
  );
  const rejectedById = new Map(
    response.rejected_items.map((result) => [
      result.client_item_id,
      canonicalIdentityV1(result),
    ]),
  );
  if (
    rejectedResults.length !== response.rejected_items.length ||
    rejectedResults.some(
      (result) =>
        rejectedById.get(result.client_item_id) !== canonicalIdentityV1(result),
    ) ||
    (rejectedResults.length === 0) !==
      (response.batch_status === "completed")
  ) {
    throw new Error("memory write batch response result projection mismatch");
  }

  const succeeded = response.item_results.filter(
    (result): result is MemoryWriteSucceededV1 =>
      result.status === "succeeded",
  );
  const accepted = new Set(response.accepted_point_ids);
  const expectedAccepted = new Set(
    succeeded.flatMap((result) =>
      result.memory_point_id === undefined ? [] : [result.memory_point_id],
    ),
  );
  if (
    accepted.size !== expectedAccepted.size ||
    [...accepted].some((id) => !expectedAccepted.has(id))
  ) {
    throw new Error("memory write batch accepted_point_ids mismatch");
  }

  const expectedConflicts = new Set(
    succeeded.flatMap((result) => result.conflict_ids),
  );
  const conflicts = new Set(response.conflict_ids);
  if (
    conflicts.size !== expectedConflicts.size ||
    [...conflicts].some((id) => !expectedConflicts.has(id))
  ) {
    throw new Error("memory write batch conflict_ids mismatch");
  }
}

export function memoryContractCanonicalIdentityV1(
  value: JsonRecordV1,
): string {
  return canonicalIdentityV1(value);
}
