import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  SHARED_SCHEMA_CATALOG,
  TRIGGER_PROCESSOR_SCHEMA_CATALOG,
} from "../dist/catalog.js";
import {
  TRIGGER_PROCESS_STATE_V1_DATABASE_CHECK,
} from "../dist/trigger-processor/trigger-process-state.v1.js";
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
  ...TRIGGER_PROCESSOR_SCHEMA_CATALOG,
];

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
          schemaCatalog.map((entry) => [entry.schema_name, entry.schema]),
        ),
      },
    },
    null,
    2,
  )}\n`,
);

const typesPath = resolve(packageRoot, "generated/types/shared.d.ts");
await emitGeneratedFile(
  typesPath,
  'export * from "../../dist/index.js";\n',
);

const policyTypesPath = resolve(packageRoot, "generated/types/shared-policy.d.ts");
await emitGeneratedFile(
  policyTypesPath,
  [
    'export * from "../../dist/policy/conflict-policy.v1.js";',
    'export * from "../../dist/policy/direct-active-policy.v1.js";',
    "",
  ].join("\n"),
);

const authTypesPath = resolve(packageRoot, "generated/types/shared-auth.d.ts");
await emitGeneratedFile(
  authTypesPath,
  [
    'export * from "../../dist/shared/workload-credential-claims.v1.js";',
    'export * from "../../dist/shared/delegated-principal-context.v1.js";',
    "",
  ].join("\n"),
);

const triggerProcessCheckPath = resolve(
  packageRoot,
  "generated/sql/trigger-processor/trigger-process-state.v1.check.sql",
);
await emitGeneratedFile(
  triggerProcessCheckPath,
  `${TRIGGER_PROCESS_STATE_V1_DATABASE_CHECK.trim()}\n`,
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

const authFixtureDirectory = resolve(packageRoot, "generated/fixtures/auth");
await emitGeneratedFile(
  resolve(authFixtureDirectory, "workload-credential-claims.v1.json"),
  `${JSON.stringify(
    {
      valid_bot_scope: {
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
      },
      invalid_array_audience: ["action_runtime"],
      invalid_service_alias: "trigger-processor",
    },
    null,
    2,
  )}\n`,
);
await emitGeneratedFile(
  resolve(authFixtureDirectory, "delegated-principal-context.v1.json"),
  `${JSON.stringify(
    {
      invalid_unsigned_sidecar: true,
      invalid_scope_drift: {
        workload_bot_id: "bot_01",
        delegated_bot_id: "bot_02",
      },
      invalid_principal_type: "service",
    },
    null,
    2,
  )}\n`,
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
