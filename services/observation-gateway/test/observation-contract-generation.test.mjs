import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  OBSERVATION_HTTP_OPERATIONS_V1,
  OBSERVATION_OWNER_SCHEMA_CATALOG_V1,
  OBSERVATION_ROUTES_V1,
  OBSERVATION_SCHEMA_CATALOG_COLUMNS_V1,
  buildObservationGatewayApp,
  observationOwnerSchemaV1,
} from "../dist/index.js";

const execFileAsync = promisify(execFile);
const packageRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
);
const workspaceRoot = resolve(packageRoot, "../..");
const expectedSchemaNames = [
  "ObservationSnapshotResponse",
  "ObservationEvent",
  "ObservationSseControlV1",
  "ObservationSseError",
  "ObservationToolInvocationList",
  "ObservationQualitySignalList",
];

function workspacePath(path) {
  return resolve(workspaceRoot, path);
}

function openApiPath(path) {
  return path.replace(/:([a-z_][a-z0-9_]*)/giu, "{$1}");
}

function concretePath(path) {
  return path.replace(/:([a-z_][a-z0-9_]*)/giu, (_match, name) => {
    if (name === "runtime_run_id") return "run-1";
    if (name === "meta_job_id") return "job-1";
    return "process-1";
  });
}

test("the owner catalog has exactly the documented six schemas and seven metadata columns", async () => {
  assert.deepEqual(
    OBSERVATION_OWNER_SCHEMA_CATALOG_V1.map(
      (entry) => entry.schema_name,
    ),
    expectedSchemaNames,
  );
  assert.equal(
    new Set(
      OBSERVATION_OWNER_SCHEMA_CATALOG_V1.map(
        (entry) => entry.schema_name,
      ),
    ).size,
    OBSERVATION_OWNER_SCHEMA_CATALOG_V1.length,
  );
  assert.equal(
    new Set(
      OBSERVATION_OWNER_SCHEMA_CATALOG_V1.map(
        (entry) => entry.schema_id,
      ),
    ).size,
    OBSERVATION_OWNER_SCHEMA_CATALOG_V1.length,
  );
  assert.deepEqual(OBSERVATION_SCHEMA_CATALOG_COLUMNS_V1, [
    "schema_name",
    "schema_id",
    "version",
    "owner_service",
    "source_file",
    "generated_outputs",
    "contract_tests",
  ]);

  for (const entry of OBSERVATION_OWNER_SCHEMA_CATALOG_V1) {
    assert.deepEqual(
      Object.keys(entry),
      OBSERVATION_SCHEMA_CATALOG_COLUMNS_V1,
    );
    assert.equal(observationOwnerSchemaV1(entry).$id, entry.schema_id);
    assert.equal(entry.version, "1.0.0");
    assert.equal(entry.owner_service, "observation-gateway");
    assert.ok(entry.generated_outputs.length >= 3);
    await access(workspacePath(entry.source_file));
    for (const output of entry.generated_outputs) {
      await access(resolve(packageRoot, output));
    }
    for (const contractTest of entry.contract_tests) {
      await access(workspacePath(contractTest));
    }
  }

  assert.equal(
    OBSERVATION_OWNER_SCHEMA_CATALOG_V1.some((entry) =>
      /RuntimeDetails|MetaDetails/u.test(entry.schema_name),
    ),
    false,
  );
});

test("generated JSON Schemas, OpenAPI, AsyncAPI, and declarations match the catalog and route matrix", async () => {
  for (const entry of OBSERVATION_OWNER_SCHEMA_CATALOG_V1) {
    const schemaOutput = entry.generated_outputs.find((output) =>
      output.startsWith("generated/schema/"),
    );
    assert.ok(schemaOutput);
    const generated = JSON.parse(
      await readFile(resolve(packageRoot, schemaOutput), "utf8"),
    );
    assert.equal(
      JSON.stringify(generated),
      JSON.stringify(observationOwnerSchemaV1(entry)),
    );
  }

  const openApi = JSON.parse(
    await readFile(
      resolve(
        packageRoot,
        "generated/openapi/observation-gateway.openapi.json",
      ),
      "utf8",
    ),
  );
  assert.equal(openApi.openapi, "3.1.0");
  assert.deepEqual(
    Object.keys(openApi.components.schemas),
    expectedSchemaNames,
  );
  assert.equal(
    "ObservationRuntimeDetailsResponseV1" in openApi.components.schemas,
    false,
  );
  assert.equal(
    "ObservationMetaDetailsResponseV1" in openApi.components.schemas,
    false,
  );
  for (const operation of OBSERVATION_HTTP_OPERATIONS_V1) {
    const generated =
      openApi.paths[openApiPath(operation.path)][
        operation.method.toLowerCase()
      ];
    assert.equal(generated.operationId, operation.operation_id);
    assert.equal(
      generated["x-pai-required-capability"],
      operation.required_capability,
    );
    assert.deepEqual(
      generated["x-pai-allowed-callers"],
      operation.allowed_callers,
    );
  }
  const runtimeResponse =
    openApi.paths[
      openApiPath(OBSERVATION_ROUTES_V1.runtimeDetails)
    ].get.responses["200"].content["application/json"].schema;
  const metaResponse =
    openApi.paths[openApiPath(OBSERVATION_ROUTES_V1.metaDetails)].get
      .responses["200"].content["application/json"].schema;
  assert.equal("$ref" in runtimeResponse, false);
  assert.equal("$ref" in metaResponse, false);

  const asyncApi = JSON.parse(
    await readFile(
      resolve(
        packageRoot,
        "generated/asyncapi/observation-gateway-sse.yaml",
      ),
      "utf8",
    ),
  );
  assert.equal(asyncApi.asyncapi, "3.0.0");
  assert.equal(
    asyncApi.channels.observation_process_events.address,
    openApiPath(OBSERVATION_ROUTES_V1.events),
  );
  assert.deepEqual(
    asyncApi.channels.observation_process_events[
      "x-pai-allowed-callers"
    ],
    [],
  );
  assert.equal(
    asyncApi.components.messages.ObservationEvent["x-pai-durable"],
    true,
  );
  assert.equal(
    asyncApi.components.messages.RuntimeTokenSseEventV1[
      "x-pai-sse-event-id"
    ],
    false,
  );
  assert.equal(
    "id" in
      asyncApi.components.messages.RuntimeTokenSseEventV1.payload
        .properties,
    false,
  );

  const declarations = await readFile(
    resolve(
      packageRoot,
      "generated/types/observation-gateway.d.ts",
    ),
    "utf8",
  );
  for (const schemaName of [
    "ObservationEventV1Schema",
    "ObservationQualitySignalListV1Schema",
    "ObservationSnapshotResponseV1Schema",
    "ObservationSseControlV1Schema",
    "ObservationSseErrorV1Schema",
    "ObservationToolInvocationListV1Schema",
  ]) {
    assert.equal(declarations.includes(schemaName), true);
  }
  assert.equal(declarations.includes("RuntimeDetails"), false);
  assert.equal(declarations.includes("MetaDetails"), false);
});

test("the app registers every cataloged path with the cataloged caller and capability policy", async () => {
  const capturedRequirements = [];
  const allowedCallers = ["action_runtime"];
  const verifier = {
    async verify(_token, requirements) {
      capturedRequirements.push(structuredClone(requirements));
      throw new Error("stop after policy capture");
    },
  };
  const app = buildObservationGatewayApp(
    { logger: false, auth: { verifier } },
    { observation: {} },
    { allowed_callers: allowedCallers },
  );

  assert.deepEqual(
    new Set(
      OBSERVATION_HTTP_OPERATIONS_V1.map(
        (operation) => operation.path,
      ),
    ),
    new Set(Object.values(OBSERVATION_ROUTES_V1)),
  );
  for (const operation of OBSERVATION_HTTP_OPERATIONS_V1) {
    assert.equal(
      app.hasRoute({
        method: operation.method,
        url: operation.path,
      }),
      true,
    );
    const previousCaptures = capturedRequirements.length;
    await app.inject({
      method: operation.method,
      url: concretePath(operation.path),
      headers: { authorization: "Bearer aaa.bbb.ccc" },
    });
    assert.equal(capturedRequirements.length, previousCaptures + 1);
    assert.deepEqual(
      capturedRequirements.at(-1).requiredCapabilities,
      [operation.required_capability],
    );
    assert.deepEqual(
      capturedRequirements.at(-1).allowedCallers,
      allowedCallers,
    );
    assert.deepEqual(operation.allowed_callers, []);
  }
  await app.close();
});

test("production composition denies all callers and stays unready until an explicit ingress allowlist is bound", async () => {
  let durablePolicyEnabled = false;
  let readinessCalled = false;
  const observation = {
    requireDurableAuditHandoffV1() {
      durablePolicyEnabled = true;
    },
    async checkReadiness() {
      readinessCalled = true;
    },
  };
  const app = buildObservationGatewayApp(
    { logger: false },
    { observation },
    {
      require_complete_pipeline: true,
      require_durable_audit: true,
    },
  );
  const readiness = await app.inject({ method: "GET", url: "/ready" });
  assert.equal(readiness.statusCode, 503);
  assert.equal(durablePolicyEnabled, true);
  assert.equal(readinessCalled, false);
  await app.close();

  assert.throws(
    () =>
      buildObservationGatewayApp(
        { logger: false },
        { observation },
        { allowed_callers: ["observation_gateway"] },
      ),
    /registered ingress services/u,
  );
});

test("the checked-in generated tree has no missing, stale, or unexpected output", async () => {
  await execFileAsync(
    process.execPath,
    [resolve(packageRoot, "scripts/generate.mjs"), "--check"],
    { cwd: packageRoot },
  );
});
