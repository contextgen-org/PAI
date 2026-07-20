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
  const app = buildApp({ logger: false });
  try {
    const health = await app.inject({ method: "GET", url: "/health" });
    const ready = await app.inject({ method: "GET", url: "/ready" });
    if (health.statusCode !== 200 || ready.statusCode !== 200) {
      throw new Error(
        `${serviceId} probe failed: health=${health.statusCode}, ready=${ready.statusCode}`,
      );
    }
    const healthBody = health.json();
    if (healthBody.service_id !== serviceId) {
      throw new Error(`${serviceId} returned the wrong service_id`);
    }
    evidence.push({ service_id: serviceId, health: 200, ready: 200 });
  } finally {
    await app.close();
  }
}

console.log(JSON.stringify({ services: evidence }, null, 2));
