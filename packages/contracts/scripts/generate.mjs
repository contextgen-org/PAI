import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  PENDING_OWNER_SCHEMA_GENERATION,
  SHARED_SCHEMA_CATALOG,
  TRIGGER_PROCESSOR_SCHEMA_CATALOG,
  TRIGGER_PROCESSOR_HTTP_OPERATIONS_V1,
} from "../dist/catalog.js";
import {
  TRIGGER_PROCESS_STATE_V1_DATABASE_CHECK,
} from "../dist/trigger-processor/trigger-process-state.v1.js";
import {
  TRIGGER_PROCESSOR_DOMAIN_EVENT_BRANCH_SCHEMAS_V1,
  TRIGGER_PROCESSOR_DOMAIN_EVENT_CONSUMERS_V1,
  TRIGGER_PROCESSOR_DOMAIN_EVENT_TYPES_V1,
  TRIGGER_PROCESSOR_DOMAIN_EVENT_V1_DATABASE_CHECK,
} from "../dist/trigger-processor/events.v1.js";
import {
  validateWorkloadCredentialClaimsV1,
} from "../dist/shared/workload-credential-claims.v1.js";
import { evaluateConflictPolicyV1 } from "../dist/policy/conflict-policy.v1.js";
import { evaluateDirectActivePolicyV1 } from "../dist/policy/direct-active-policy.v1.js";
import { findUnexpectedGeneratedFiles } from "./generated-output-drift.mjs";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const checkMode = process.argv.includes("--check");
const expectedOutputs = new Set();
const driftedOutputs = [];

async function emitGeneratedFile(outputPath, content) {
  const relativePath = relative(packageRoot, outputPath);
  expectedOutputs.add(relativePath);
  if (checkMode) {
    try {
      const existing = await readFile(outputPath, "utf8");
      if (existing !== content) driftedOutputs.push(relativePath);
    } catch {
      driftedOutputs.push(relativePath);
    }
    return;
  }
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, content);
}

const schemaCatalog = [
  ...SHARED_SCHEMA_CATALOG,
  ...PENDING_OWNER_SCHEMA_GENERATION,
  ...TRIGGER_PROCESSOR_SCHEMA_CATALOG,
];

const schemaByName = new Map(
  schemaCatalog.map((entry) => [entry.schema_name, entry.schema]),
);

function openApiOperation(operation) {
  const requestSchema = schemaByName.get(operation.request_schema_name);
  const responseSchema = schemaByName.get(operation.response_schema_name);
  if (requestSchema === undefined || responseSchema === undefined) {
    throw new Error(`unknown schema for OpenAPI operation ${operation.operation_id}`);
  }
  return {
    [operation.method]: {
      operationId: operation.operation_id,
      tags: ["trigger_processor"],
      summary: `Admit a ${operation.source} trigger`,
      description:
        `Route injects source=${operation.source}; callers must be ${operation.allowed_caller} with ${operation.required_capability}.`,
      security: [{ PaiWorkloadJwt: [operation.required_capability] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: requestSchema,
          },
        },
      },
      responses: Object.fromEntries(
        operation.responses.map((status) => [
          String(status),
          {
            description:
              status === 200
                ? "Admission decision"
                : "Canonical error envelope",
            content: {
              "application/json": {
                schema: operation.response_schemas_by_status[status] ?? responseSchema,
              },
            },
          },
        ]),
      ),
    },
  };
}

const triggerProcessorOpenApiPaths = Object.fromEntries(
  TRIGGER_PROCESSOR_HTTP_OPERATIONS_V1.map((operation) => [
    operation.path,
    openApiOperation(operation),
  ]),
);

for (const entry of schemaCatalog) {
  const schemaOutput = entry.generated_outputs.find((output) =>
    output.startsWith("generated/schema/"),
  );
  if (schemaOutput === undefined) continue;
  const outputPath = resolve(packageRoot, schemaOutput);
  await emitGeneratedFile(outputPath, `${JSON.stringify(entry.schema, null, 2)}\n`);
}

const openApiPath = resolve(packageRoot, "generated/openapi/shared.yaml");
await emitGeneratedFile(
  openApiPath,
  `${JSON.stringify(
    {
      openapi: "3.1.0",
      info: { title: "PAI Shared Contracts", version: "1.0.0" },
      paths: {},
      components: {
        schemas: Object.fromEntries(
          SHARED_SCHEMA_CATALOG.filter((entry) =>
            entry.generated_outputs.includes("generated/openapi/shared.yaml"),
          ).map((entry) => [entry.schema_name, entry.schema]),
        ),
      },
    },
    null,
    2,
  )}\n`,
);

const triggerProcessorOpenApiPath = resolve(
  packageRoot,
  "generated/openapi/trigger-processor-internal.yaml",
);
await emitGeneratedFile(
  triggerProcessorOpenApiPath,
  `${JSON.stringify(
    {
      openapi: "3.1.0",
      info: { title: "PAI Trigger Processor Internal API", version: "1.0.0" },
      paths: triggerProcessorOpenApiPaths,
      components: {
        securitySchemes: {
          PaiWorkloadJwt: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
        schemas: Object.fromEntries(
          TRIGGER_PROCESSOR_SCHEMA_CATALOG.map((entry) => [
            entry.schema_name,
            entry.schema,
          ]),
        ),
      },
    },
    null,
    2,
  )}\n`,
);

const triggerProcessorDomainEventSchema = schemaByName.get(
  "TriggerProcessorDomainEventV1",
);
if (triggerProcessorDomainEventSchema === undefined) {
  throw new Error("TriggerProcessorDomainEventV1 missing from schema catalog");
}

const triggerProcessorAsyncApiPath = resolve(
  packageRoot,
  "generated/asyncapi/trigger-processor.yaml",
);
const triggerProcessorEventMessageName = (eventType) =>
  `TriggerProcessor${eventType
    .split(/[^a-z0-9]+/u)
    .filter(Boolean)
    .map((segment) => `${segment[0].toUpperCase()}${segment.slice(1)}`)
    .join("")}EventV1`;
await emitGeneratedFile(
  triggerProcessorAsyncApiPath,
  `${JSON.stringify(
    {
      asyncapi: "3.0.0",
      info: {
        title: "PAI Trigger Processor Domain Events",
        version: "1.0.0",
      },
      channels: Object.fromEntries(
        TRIGGER_PROCESSOR_DOMAIN_EVENT_TYPES_V1.map((eventType) => [
          `trigger_processor.${eventType}`,
          {
            address: `trigger_processor.${eventType}`,
            messages: {
              [triggerProcessorEventMessageName(eventType)]: {
                $ref: `#/components/messages/${triggerProcessorEventMessageName(eventType)}`,
              },
            },
            "x-pai-consumer-services":
              TRIGGER_PROCESSOR_DOMAIN_EVENT_CONSUMERS_V1[eventType],
          },
        ]),
      ),
      operations: Object.fromEntries(
        TRIGGER_PROCESSOR_DOMAIN_EVENT_TYPES_V1.map((eventType) => [
          `publish_${eventType.replace(/[^a-z0-9]+/gu, "_")}_v1`,
          {
            action: "send",
            channel: {
              $ref: `#/channels/trigger_processor.${eventType}`,
            },
          },
        ]),
      ),
      components: {
        messages: {
          ...Object.fromEntries(
            TRIGGER_PROCESSOR_DOMAIN_EVENT_TYPES_V1.map((eventType) => [
              triggerProcessorEventMessageName(eventType),
              {
                name: triggerProcessorEventMessageName(eventType),
                title: `Trigger Processor ${eventType} domain event envelope`,
                payload: TRIGGER_PROCESSOR_DOMAIN_EVENT_BRANCH_SCHEMAS_V1[
                  eventType
                ],
              },
            ]),
          ),
        },
      },
    },
    null,
    2,
  )}\n`,
);

function declarationExportsFor(output, catalog) {
  const sources = new Set(
    catalog
      .filter((entry) => entry.generated_outputs.includes(output))
      .map((entry) => entry.source_file),
  );
  return [
    ...[...sources]
      .sort()
      .map((source) => {
        const distModule = source
          .replace(/^packages\/contracts\/src\//, "../../dist/")
          .replace(/\.ts$/, ".js");
        return `export * from "${distModule}";`;
      }),
    "",
  ].join("\n");
}

const typesPath = resolve(packageRoot, "generated/types/shared.d.ts");
await emitGeneratedFile(
  typesPath,
  declarationExportsFor("generated/types/shared.d.ts", SHARED_SCHEMA_CATALOG),
);

const triggerProcessorTypesPath = resolve(
  packageRoot,
  "generated/types/trigger-processor.d.ts",
);
await emitGeneratedFile(
  triggerProcessorTypesPath,
  declarationExportsFor(
    "generated/types/trigger-processor.d.ts",
    TRIGGER_PROCESSOR_SCHEMA_CATALOG,
  ),
);

const triggerProcessorEventTypesPath = resolve(
  packageRoot,
  "generated/types/trigger-processor-events.d.ts",
);
await emitGeneratedFile(
  triggerProcessorEventTypesPath,
  declarationExportsFor(
    "generated/types/trigger-processor-events.d.ts",
    TRIGGER_PROCESSOR_SCHEMA_CATALOG,
  ),
);

const policyTypesPath = resolve(packageRoot, "generated/types/shared-policy.d.ts");
await emitGeneratedFile(
  policyTypesPath,
  declarationExportsFor(
    "generated/types/shared-policy.d.ts",
    SHARED_SCHEMA_CATALOG,
  ),
);

const authTypesPath = resolve(packageRoot, "generated/types/shared-auth.d.ts");
await emitGeneratedFile(
  authTypesPath,
  declarationExportsFor(
    "generated/types/shared-auth.d.ts",
    SHARED_SCHEMA_CATALOG,
  ),
);

const triggerProcessCheckPath = resolve(
  packageRoot,
  "generated/sql/trigger-processor/trigger-process-state.v1.check.sql",
);
await emitGeneratedFile(
  triggerProcessCheckPath,
  `${TRIGGER_PROCESS_STATE_V1_DATABASE_CHECK.trim()}\n`,
);

const triggerProcessorEventCheckPath = resolve(
  packageRoot,
  "generated/db/trigger-processor-event-check.sql",
);
await emitGeneratedFile(
  triggerProcessorEventCheckPath,
  `${TRIGGER_PROCESSOR_DOMAIN_EVENT_V1_DATABASE_CHECK.trim()}\n`,
);

const policyFixtures = [
  [
    "generated/fixtures/policy/conflict-policy.v1.truth-table.json",
    [
      evaluateConflictPolicyV1({
        domain: "project_decision",
        sameActorScope: true,
        authorityGatePassed: true,
        leftRank: 5,
        rightRank: 3,
        leftConfidence: 0.7,
        rightConfidence: 0.9,
      }),
      evaluateConflictPolicyV1({
        domain: "unclassified",
        sameActorScope: true,
        authorityGatePassed: true,
        leftRank: 5,
        rightRank: 1,
        leftConfidence: 1,
        rightConfidence: 1,
      }),
    ],
  ],
  [
    "generated/fixtures/policy/direct-active-policy.v1.truth-table.json",
    [
      evaluateDirectActivePolicyV1({
        proposedStatus: "active",
        directActiveHint: true,
        riskLevel: "low",
        evidencePending: false,
        explicitness: "explicit_statement",
        confidence: 0.9,
        sourceAndEvidenceValid: true,
        hasOpenConflict: false,
        categoryGatePassed: true,
        validityGatePassed: true,
        category: "project_fact",
        ruleAllowlisted: false,
        changesProtectedBoundary: false,
      }),
      evaluateDirectActivePolicyV1({
        proposedStatus: "active",
        directActiveHint: true,
        riskLevel: "low",
        evidencePending: false,
        explicitness: "strong_implication",
        confidence: 1,
        sourceAndEvidenceValid: true,
        hasOpenConflict: false,
        categoryGatePassed: true,
        validityGatePassed: true,
        category: "project_fact",
        ruleAllowlisted: false,
        changesProtectedBoundary: false,
      }),
    ],
  ],
];

for (const [relativePath, fixtures] of policyFixtures) {
  const outputPath = resolve(packageRoot, relativePath);
  await emitGeneratedFile(outputPath, `${JSON.stringify(fixtures, null, 2)}\n`);
}

const validWorkloadCredentialFixture = {
  iss: "pai-workload",
  sub: "trigger_processor",
  aud: "action_runtime",
  jti: "jti_fixture_01",
  iat: 100,
  nbf: 100,
  exp: 400,
  capability: ["runtime.read", "runtime.start"],
  scope_kind: "bot",
  workspace_id: "workspace_01",
  bot_id: "bot_01",
  owner_agent_id: "agent_01",
  deployment_environment: "dev",
  release_channel: "stable",
};
const validDelegatedPrincipalFixture = {
  principal_type: "developer",
  principal_id: "developer_01",
  roles: ["developer"],
  source_issuer: "supabase",
  source_subject: "user_01",
  auth_time: 100,
  scope_kind: "bot",
  workspace_id: "workspace_01",
  bot_id: "bot_01",
  owner_agent_id: "agent_01",
  deployment_environment: "dev",
  release_channel: "stable",
};
const workloadCredentialFixtures = {
  valid_bot_scope: validWorkloadCredentialFixture,
  invalid_array_audience: {
    ...validWorkloadCredentialFixture,
    aud: ["action_runtime"],
  },
  invalid_service_alias: {
    ...validWorkloadCredentialFixture,
    sub: "trigger-processor",
  },
};
const delegatedPrincipalFixtures = {
  valid_bot_scope: validDelegatedPrincipalFixture,
  invalid_unsigned_sidecar: {
    ...validDelegatedPrincipalFixture,
    unsigned_sidecar: true,
  },
  invalid_scope_drift: {
    ...validDelegatedPrincipalFixture,
    bot_id: "bot_02",
  },
  invalid_principal_type: {
    ...validDelegatedPrincipalFixture,
    principal_type: "service",
  },
};

if (!validateWorkloadCredentialClaimsV1(validWorkloadCredentialFixture).ok) {
  throw new Error("generated valid workload credential fixture is invalid");
}
for (const [name, fixture] of Object.entries(workloadCredentialFixtures)) {
  if (
    name.startsWith("invalid_") &&
    validateWorkloadCredentialClaimsV1(fixture).ok
  ) {
    throw new Error(`generated invalid workload credential fixture passed: ${name}`);
  }
}
for (const [name, principal] of Object.entries(delegatedPrincipalFixtures)) {
  const result = validateWorkloadCredentialClaimsV1({
    ...validWorkloadCredentialFixture,
    delegated_principal: principal,
  });
  if ((name === "valid_bot_scope") !== result.ok) {
    throw new Error(`generated delegated principal fixture polarity drift: ${name}`);
  }
}

const authFixtureDirectory = resolve(packageRoot, "generated/fixtures/auth");
await emitGeneratedFile(
  resolve(authFixtureDirectory, "workload-credential-claims.v1.json"),
  `${JSON.stringify(workloadCredentialFixtures, null, 2)}\n`,
);
await emitGeneratedFile(
  resolve(authFixtureDirectory, "delegated-principal-context.v1.json"),
  `${JSON.stringify(delegatedPrincipalFixtures, null, 2)}\n`,
);

if (checkMode) {
  const generatedRoot = resolve(packageRoot, "generated");
  driftedOutputs.push(
    ...(await findUnexpectedGeneratedFiles(generatedRoot, expectedOutputs)),
  );
  if (driftedOutputs.length > 0) {
    const uniqueOutputs = [...new Set(driftedOutputs)].sort();
    console.error(
      `generated contract drift detected:\n${uniqueOutputs.map((output) => `- ${output}`).join("\n")}\nRun pnpm --filter @pai/contracts build and commit the generated outputs.`,
    );
    process.exitCode = 1;
  }
}
