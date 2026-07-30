import type {
  DeploymentEnvironmentV1,
  ReleaseChannelV1,
  ServiceIdV1,
} from "@pai/contracts";

declare const opaqueObjectRef: unique symbol;

export type ObjectRefV1 = string & { readonly [opaqueObjectRef]: "ObjectRefV1" };

export type ObjectByteStreamV1 = AsyncIterable<Uint8Array>;

export interface BotObjectScopeV1 {
  readonly scope_kind: "bot";
  readonly workspace_id: string;
  readonly bot_id: string;
  readonly owner_agent_id: string;
  readonly deployment_environment: DeploymentEnvironmentV1;
  readonly release_channel: ReleaseChannelV1;
}

export interface GlobalObjectScopeV1 {
  readonly scope_kind: "global";
}

export type ObjectScopeV1 = BotObjectScopeV1 | GlobalObjectScopeV1;

export type ObjectStoreErrorCodeV1 =
  | "object_not_found"
  | "integrity_mismatch"
  | "authorization_scope_mismatch"
  | "retention_active"
  | "precondition_failed"
  | "idempotency_conflict"
  | "storage_unavailable";

export class ObjectStoreErrorV1 extends Error {
  public constructor(
    public readonly code: ObjectStoreErrorCodeV1,
    message: string,
    public readonly retryable: boolean,
    public readonly details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = "ObjectStoreErrorV1";
  }
}

export interface ObjectAuthorizationV1 {
  readonly owner_service: ServiceIdV1;
  /**
   * Durable owner-row identity. The ObjectStore adapter must never infer this
   * from an opaque ref, object class, scope, or idempotency key.
   */
  readonly owner_object_id: string;
  /** Exact positive safe-integer owner state observed by the caller. */
  readonly owner_state_version: number;
  readonly scope: ObjectScopeV1;
  readonly capability: string;
}

export interface PutImmutableRequestV1 extends ObjectAuthorizationV1 {
  readonly object_class: string;
  readonly idempotency_key: string;
  readonly expected_sha256: string;
  readonly size_bytes: number;
  readonly media_type: string;
  readonly retention_until: string;
  readonly body: ObjectByteStreamV1;
}

export interface PutImmutableResultV1 {
  readonly object_ref: ObjectRefV1;
  readonly version: string;
  readonly sha256: string;
  readonly size_bytes: number;
  readonly media_type: string;
  readonly retention_until: string;
  readonly replayed: boolean;
}

export interface ObjectReadRequestV1 extends ObjectAuthorizationV1 {
  readonly object_ref: ObjectRefV1;
  /** Opaque owner-issued decision; the adapter resolves it before metadata lookup. */
  readonly access_decision_ref: string;
  readonly retention_policy_version: string;
  readonly redaction_policy_version: string;
}

export interface ObjectRangeReadRequestV1 extends ObjectReadRequestV1 {
  readonly range?: {
    readonly offset: number;
    readonly length: number;
  };
}

export interface ObjectHeadV1 {
  readonly object_ref: ObjectRefV1;
  readonly version: string;
  readonly sha256: string;
  readonly size_bytes: number;
  readonly media_type: string;
  readonly retention_until: string;
}

export interface ObjectStreamResultV1 extends ObjectHeadV1 {
  readonly body: ObjectByteStreamV1;
  readonly content_range?: string;
}

export interface IssueReadGrantRequestV1 extends ObjectReadRequestV1 {
  readonly ttl_seconds: number;
}

export interface ObjectReadGrantV1 {
  readonly grant: string;
  readonly object_ref: ObjectRefV1;
  readonly expires_at: string;
}

export interface DeleteIfEligibleRequestV1 extends ObjectReadRequestV1 {
  readonly deletion_decision_version: number;
  readonly idempotency_key: string;
}

export interface DeleteIfEligibleResultV1 {
  readonly object_ref: ObjectRefV1;
  readonly deleted: boolean;
  readonly replayed: boolean;
}

export interface ObjectStorePortV1 {
  putImmutable(request: PutImmutableRequestV1): Promise<PutImmutableResultV1>;
  head(request: ObjectReadRequestV1): Promise<ObjectHeadV1>;
  getStream(request: ObjectRangeReadRequestV1): Promise<ObjectStreamResultV1>;
  issueReadGrant(request: IssueReadGrantRequestV1): Promise<ObjectReadGrantV1>;
  deleteIfEligible(
    request: DeleteIfEligibleRequestV1,
  ): Promise<DeleteIfEligibleResultV1>;
}

export interface ReconcileObjectStoreRequestV1 {
  readonly worker_id: string;
  readonly limit: number;
  readonly lease_seconds: number;
  readonly reservation_id?: string;
}

export interface ReconcileObjectStoreResultV1 {
  readonly claimed: number;
  readonly completed: number;
  readonly retry_scheduled: number;
}

export interface ObjectStoreReconciliationPortV1 {
  reconcilePending(
    request: ReconcileObjectStoreRequestV1,
    /** Cooperative only; implementations must not claim rollback until settled. */
    signal?: AbortSignal,
  ): Promise<ReconcileObjectStoreResultV1>;
}
