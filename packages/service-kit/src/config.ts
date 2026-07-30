import {
  DeploymentEnvironmentV1Schema,
  ReleaseChannelV1Schema,
  type DeploymentEnvironmentV1,
  type ReleaseChannelV1,
} from "@pai/contracts";
import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

export const LOG_LEVELS = [
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
  "silent",
] as const;

export const ServiceRuntimeConfigV1Schema = Type.Object(
  {
    host: Type.String({ minLength: 1, maxLength: 253, pattern: "^[^\\s/]+$" }),
    port: Type.Integer({ minimum: 1, maximum: 65_535 }),
    log_level: Type.Union(LOG_LEVELS.map((level) => Type.Literal(level))),
    request_timeout_ms: Type.Integer({ minimum: 100, maximum: 300_000 }),
    readiness_timeout_ms: Type.Integer({ minimum: 100, maximum: 30_000 }),
    shutdown_grace_ms: Type.Integer({ minimum: 1_000, maximum: 60_000 }),
    deployment_environment: DeploymentEnvironmentV1Schema,
    release_channel: ReleaseChannelV1Schema,
  },
  {
    $id: "urn:pai:service-kit:service-runtime-config:v1",
    additionalProperties: false,
  },
);

export type ServiceRuntimeConfigV1 = Static<
  typeof ServiceRuntimeConfigV1Schema
>;

export interface ServiceRuntimeConfigDefaults {
  readonly port: number;
  readonly host?: string;
  readonly log_level?: (typeof LOG_LEVELS)[number];
  readonly request_timeout_ms?: number;
  readonly readiness_timeout_ms?: number;
  readonly shutdown_grace_ms?: number;
  readonly deployment_environment?: DeploymentEnvironmentV1;
  readonly release_channel?: ReleaseChannelV1;
}

export class ServiceConfigError extends Error {
  public readonly issues: readonly string[];

  public constructor(issues: readonly string[]) {
    super(`invalid service configuration: ${issues.join("; ")}`);
    this.name = "ServiceConfigError";
    this.issues = issues;
  }
}

function parseInteger(
  name: string,
  value: string | undefined,
  fallback: number,
): number {
  if (value === undefined) return fallback;
  if (!/^-?\d+$/.test(value)) {
    throw new ServiceConfigError([`${name} must be an integer`]);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new ServiceConfigError([`${name} must be a safe integer`]);
  }
  return parsed;
}

export function assertServiceRuntimeConfig(
  value: unknown,
): ServiceRuntimeConfigV1 {
  let candidate: unknown = value;
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    let prototype: object | null;
    let descriptors: PropertyDescriptorMap;
    try {
      prototype = Object.getPrototypeOf(value);
      descriptors = Object.getOwnPropertyDescriptors(value);
    } catch {
      prototype = null;
      descriptors = {};
    }
    const expectedKeys = [
      "deployment_environment",
      "host",
      "log_level",
      "port",
      "readiness_timeout_ms",
      "release_channel",
      "request_timeout_ms",
      "shutdown_grace_ms",
    ];
    const keys = Reflect.ownKeys(descriptors);
    if (
      (prototype === Object.prototype || prototype === null) &&
      keys.every((key) => typeof key === "string") &&
      (keys as string[]).sort().join(",") === expectedKeys.join(",") &&
      expectedKeys.every((key) => {
        const descriptor = descriptors[key];
        return (
          descriptor !== undefined &&
          "value" in descriptor &&
          descriptor.enumerable === true
        );
      })
    ) {
      candidate = Object.freeze({
        host: descriptors.host!.value,
        port: descriptors.port!.value,
        log_level: descriptors.log_level!.value,
        request_timeout_ms: descriptors.request_timeout_ms!.value,
        readiness_timeout_ms: descriptors.readiness_timeout_ms!.value,
        shutdown_grace_ms: descriptors.shutdown_grace_ms!.value,
        deployment_environment: descriptors.deployment_environment!.value,
        release_channel: descriptors.release_channel!.value,
      });
    } else {
      candidate = undefined;
    }
  }
  if (Value.Check(ServiceRuntimeConfigV1Schema, candidate)) {
    return candidate as ServiceRuntimeConfigV1;
  }

  const issues = [...Value.Errors(ServiceRuntimeConfigV1Schema, candidate)].map(
    (issue) => `${issue.path || "/"}: ${issue.message}`,
  );
  throw new ServiceConfigError(issues);
}

/**
 * Reads only the service-kit's declared variables. Unrelated process variables
 * are deliberately ignored; owner packages validate their own strict config.
 */
export function loadServiceRuntimeConfig(
  defaults: ServiceRuntimeConfigDefaults,
  env: Readonly<Record<string, string | undefined>> = process.env,
): ServiceRuntimeConfigV1 {
  const candidate = {
    host: env.HOST ?? defaults.host ?? "127.0.0.1",
    port: parseInteger("PORT", env.PORT, defaults.port),
    log_level: env.PAI_LOG_LEVEL ?? defaults.log_level ?? "info",
    request_timeout_ms: parseInteger(
      "PAI_REQUEST_TIMEOUT_MS",
      env.PAI_REQUEST_TIMEOUT_MS,
      defaults.request_timeout_ms ?? 30_000,
    ),
    readiness_timeout_ms: parseInteger(
      "PAI_READINESS_TIMEOUT_MS",
      env.PAI_READINESS_TIMEOUT_MS,
      defaults.readiness_timeout_ms ?? 2_000,
    ),
    shutdown_grace_ms: parseInteger(
      "PAI_SHUTDOWN_GRACE_MS",
      env.PAI_SHUTDOWN_GRACE_MS,
      defaults.shutdown_grace_ms ?? 10_000,
    ),
    deployment_environment:
      env.PAI_DEPLOYMENT_ENVIRONMENT ??
      defaults.deployment_environment ??
      "local",
    release_channel:
      env.PAI_RELEASE_CHANNEL ?? defaults.release_channel ?? "stable",
  };

  return assertServiceRuntimeConfig(candidate);
}

/**
 * Production-like dependency gates use the typed PAI environment as authority
 * and retain NODE_ENV=production as a fail-closed compatibility signal.
 * Staging must exercise the same durable adapters as production; otherwise a
 * staging deployment could become ready on an in-memory or partial pipeline.
 */
export function requiresProductionDependenciesV1(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return (
    env.PAI_DEPLOYMENT_ENVIRONMENT === "staging" ||
    env.PAI_DEPLOYMENT_ENVIRONMENT === "prod" ||
    env.NODE_ENV === "production"
  );
}
