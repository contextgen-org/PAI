CREATE TABLE skill_registry.skill_permission_summary_snapshots (
  summary_ref text PRIMARY KEY,
  schema_version text NOT NULL
    CONSTRAINT skill_permission_summary_snapshots_schema_version_check
    CHECK (schema_version = 'skill_permission_summary.v1'),
  workspace_id text NOT NULL,
  bot_id text NOT NULL,
  owner_agent_id text NOT NULL,
  deployment_environment text NOT NULL
    CONSTRAINT skill_permission_summary_snapshots_environment_check
    CHECK (deployment_environment IN ('local', 'dev', 'staging', 'prod')),
  release_channel text NOT NULL
    CONSTRAINT skill_permission_summary_snapshots_channel_check
    CHECK (release_channel IN ('stable', 'canary')),
  catalog_revision_id text NOT NULL,
  catalog_version text NOT NULL,
  catalog_as_of timestamptz NOT NULL,
  security_revocation_epoch bigint NOT NULL
    CONSTRAINT skill_permission_summary_snapshots_security_epoch_check
    CHECK (security_revocation_epoch BETWEEN 0 AND 9007199254740991),
  canonical_bytes bytea NOT NULL
    CONSTRAINT skill_permission_summary_snapshots_canonical_bytes_check
    CHECK (octet_length(canonical_bytes) > 0),
  summary_hash text NOT NULL
    CONSTRAINT skill_permission_summary_snapshots_summary_hash_check
    CHECK (summary_hash ~ '^sha256:[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT skill_permission_summary_snap_catalog_revision_id_workspac_fkey
    FOREIGN KEY (catalog_revision_id, workspace_id, bot_id, deployment_environment, release_channel)
    REFERENCES skill_registry.skill_catalog_revisions
      (id, workspace_id, bot_id, deployment_environment, release_channel),
  CONSTRAINT skill_permission_summary_snapshots_scope_catalog_key
    UNIQUE (workspace_id, bot_id, owner_agent_id, deployment_environment, release_channel, catalog_revision_id),
  CONSTRAINT skill_permission_summary_snapshots_ref_hash_key
    UNIQUE (summary_ref, summary_hash)
);

CREATE TABLE skill_registry.skill_permission_summary_entries (
  summary_ref text NOT NULL,
  ordinal bigint NOT NULL
    CONSTRAINT skill_permission_summary_entries_ordinal_check
    CHECK (ordinal BETWEEN 1 AND 9007199254740991),
  skill_id text NOT NULL,
  skill_key text NOT NULL,
  activation_revision_id text NOT NULL,
  version_id text NOT NULL,
  decision text NOT NULL
    CONSTRAINT skill_permission_summary_entries_decision_check
    CHECK (decision IN ('grant', 'deny')),
  decision_source text NOT NULL
    CONSTRAINT skill_permission_summary_entries_decision_source_check
    CHECK (decision_source IN ('revision', 'default_deny')),
  permission_revision_id text,
  revision_no bigint
    CONSTRAINT skill_permission_summary_entries_revision_no_check
    CHECK (revision_no BETWEEN 1 AND 9007199254740991),
  scope_hash text
    CONSTRAINT skill_permission_summary_entries_scope_hash_check
    CHECK (scope_hash ~ '^sha256:[0-9a-f]{64}$'),
  owner_agent_condition text,
  capability_refs text[] NOT NULL DEFAULT '{}'::text[]
    CONSTRAINT skill_permission_summary_entries_capability_refs_check
    CHECK (
      cardinality(capability_refs) <= 1024
      AND array_position(capability_refs, NULL) IS NULL
    ),
  CONSTRAINT skill_permission_summary_entries_pkey
    PRIMARY KEY (summary_ref, skill_id),
  CONSTRAINT skill_permission_summary_entries_summary_ordinal_key
    UNIQUE (summary_ref, ordinal),
  CONSTRAINT skill_permission_summary_entries_summary_ref_fkey
    FOREIGN KEY (summary_ref)
    REFERENCES skill_registry.skill_permission_summary_snapshots (summary_ref)
    ON DELETE RESTRICT,
  CONSTRAINT skill_permission_summary_entries_skill_id_fkey
    FOREIGN KEY (skill_id)
    REFERENCES skill_registry.skills (id),
  CONSTRAINT skill_permission_summary_entries_branch_check CHECK (
    (
      decision_source = 'revision'
      AND permission_revision_id IS NOT NULL
      AND revision_no IS NOT NULL
      AND scope_hash IS NOT NULL
    )
    OR
    (
      decision_source = 'default_deny'
      AND decision = 'deny'
      AND permission_revision_id IS NULL
      AND revision_no IS NULL
      AND scope_hash IS NULL
      AND owner_agent_condition IS NULL
      AND cardinality(capability_refs) = 0
    )
  )
);

CREATE FUNCTION skill_registry.reject_skill_permission_summary_mutation_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
PARALLEL UNSAFE
SET search_path = skill_registry, pg_temp
AS $body$
BEGIN
  RAISE EXCEPTION 'skill_permission_summary_immutable'
    USING ERRCODE = '55000';
END;
$body$;

REVOKE ALL ON FUNCTION skill_registry.reject_skill_permission_summary_mutation_v1()
FROM PUBLIC;

CREATE TRIGGER skill_permission_summary_snapshots_immutable
BEFORE UPDATE OR DELETE ON skill_registry.skill_permission_summary_snapshots
FOR EACH ROW EXECUTE FUNCTION skill_registry.reject_skill_permission_summary_mutation_v1();

CREATE TRIGGER skill_permission_summary_entries_immutable
BEFORE UPDATE OR DELETE ON skill_registry.skill_permission_summary_entries
FOR EACH ROW EXECUTE FUNCTION skill_registry.reject_skill_permission_summary_mutation_v1();
