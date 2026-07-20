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
  let handlerCalls = 0;
  app.get("/internal/auth-smoke", async () => {
    handlerCalls += 1;
    return { accepted: true };
  });
  try {
    const response = await app.inject({
      method: "GET",
      url: "/internal/auth-smoke",
    });
    if (response.statusCode !== 401 || response.json().code !== "unauthenticated") {
      throw new Error(
        `${serviceId} did not fail closed: status=${response.statusCode}`,
      );
    }
    if (handlerCalls !== 0) {
      throw new Error(`${serviceId} invoked a protected handler`);
    }
    evidence.push({ service_id: serviceId, unauthenticated: 401, handler_calls: 0 });
  } finally {
    await app.close();
  }
}

console.log(JSON.stringify({ services: evidence }, null, 2));
