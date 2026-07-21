import { buildActionRuntimeApp } from "../services/action-runtime/dist/app.js";
import { buildKnowThatApp } from "../services/knowthat/dist/app.js";
import { buildMemoryApp } from "../services/memory/dist/app.js";
import { buildMetaCognitionApp } from "../services/meta-cognition/dist/app.js";
import { buildObservationGatewayApp } from "../services/observation-gateway/dist/app.js";
import { buildSkillRegistryApp } from "../services/skill-registry/dist/app.js";
import { buildTimerTriggerApp } from "../services/timer-trigger-app/dist/app.js";
import { buildTriggerProcessorApp } from "../services/trigger-processor/dist/app.js";

const serviceBuilders = [
  ["trigger_processor", buildTriggerProcessorApp],
  ["action_runtime", buildActionRuntimeApp],
  ["meta_cognition", buildMetaCognitionApp],
  ["memory", buildMemoryApp],
  ["knowthat", buildKnowThatApp],
  ["timer_trigger_app", buildTimerTriggerApp],
  ["skill_registry", buildSkillRegistryApp],
  ["observation_gateway", buildObservationGatewayApp],
];

const evidence = [];
for (const [serviceId, buildApp] of serviceBuilders) {
  let dependencyAvailable = true;
  const app = buildApp({
    logger: false,
    readinessChecks: [
      {
        name: "day6_dependency",
        check: async () => {
          if (!dependencyAvailable) throw new Error("dependency unavailable");
        },
      },
    ],
  });
  try {
    const health = await app.inject({ method: "GET", url: "/health" });
    const healthyReady = await app.inject({ method: "GET", url: "/ready" });
    if (health.statusCode !== 200 || healthyReady.statusCode !== 200) {
      throw new Error(
        `${serviceId} healthy probe failed: health=${health.statusCode}, ready=${healthyReady.statusCode}`,
      );
    }
    const healthBody = health.json();
    if (healthBody.service_id !== serviceId) {
      throw new Error(`${serviceId} returned the wrong service_id`);
    }

    dependencyAvailable = false;
    const healthWhileMissing = await app.inject({
      method: "GET",
      url: "/health",
    });
    const missingReady = await app.inject({ method: "GET", url: "/ready" });
    if (
      healthWhileMissing.statusCode !== 200 ||
      missingReady.statusCode !== 503 ||
      missingReady.json().checks?.[0]?.status !== "down"
    ) {
      throw new Error(
        `${serviceId} missing-dependency probe failed: health=${healthWhileMissing.statusCode}, ready=${missingReady.statusCode}`,
      );
    }

    dependencyAvailable = true;
    const recoveredReady = await app.inject({ method: "GET", url: "/ready" });
    if (
      recoveredReady.statusCode !== 200 ||
      recoveredReady.json().checks?.[0]?.status !== "up"
    ) {
      throw new Error(
        `${serviceId} recovery probe failed: ready=${recoveredReady.statusCode}`,
      );
    }

    evidence.push({
      service_id: serviceId,
      healthy: { health: 200, ready: 200 },
      dependency_missing: { health: 200, ready: 503 },
      dependency_recovered: { ready: 200 },
    });
  } finally {
    await app.close();
  }
}

console.log(JSON.stringify({ services: evidence }, null, 2));
