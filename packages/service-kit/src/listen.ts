import type { FastifyInstance } from "fastify";
import {
  JwksCache,
  RemoteJwksProvider,
  WorkloadJwtVerifier,
  type WorkloadCredentialVerifierPort,
} from "@pai/auth";
import type { ServiceIdV1 } from "@pai/contracts";

import {
  loadServiceRuntimeConfig,
  type ServiceRuntimeConfigV1,
} from "./config.js";
import {
  beginServiceShutdown,
  type ServiceAppOptions,
} from "./create-service-app.js";
import type { InternalRouteAuthPolicy } from "./workload-auth.js";

export type ShutdownResult = "closed" | "forced";
export type ExitProcess = (code: number) => void;

const defaultExitProcess: ExitProcess = (code) => process.exit(code);

function forceCloseConnections(app: FastifyInstance): void {
  const server = app.server as typeof app.server & {
    closeAllConnections?: () => void;
    closeIdleConnections?: () => void;
  };
  server.closeIdleConnections?.();
  server.closeAllConnections?.();
}

function flushAndExit(
  app: FastifyInstance,
  exitProcess: ExitProcess,
  code: number,
): void {
  const logger = app.log as typeof app.log & { flush?: () => void };
  try {
    logger.flush?.();
  } finally {
    exitProcess(code);
  }
}

export async function shutdownService(
  app: FastifyInstance,
  graceMs: number,
  reason = "shutdown",
): Promise<ShutdownResult> {
  beginServiceShutdown(app);
  app.log.info({ event: "service_shutdown_started", reason }, "shutdown started");

  let timer: NodeJS.Timeout | undefined;
  const closePromise = app.close().then(() => "closed" as const);
  const timeoutPromise = new Promise<"forced">((resolve) => {
    timer = setTimeout(() => resolve("forced"), graceMs);
  });
  let result: ShutdownResult;
  try {
    result = await Promise.race([closePromise, timeoutPromise]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }

  if (result === "forced") {
    forceCloseConnections(app);
    app.log.error(
      { event: "service_shutdown_forced", reason, grace_ms: graceMs },
      "shutdown deadline exceeded",
    );
  }
  return result;
}

export function installSignalHandlers(
  app: FastifyInstance,
  config: ServiceRuntimeConfigV1,
  exitProcess: ExitProcess = defaultExitProcess,
): () => void {
  let shuttingDown = false;
  const onSignal = (signal: NodeJS.Signals): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    cleanup();
    void shutdownService(app, config.shutdown_grace_ms, signal)
      .then((result) => {
        if (result === "forced") flushAndExit(app, exitProcess, 1);
      })
      .catch(() => {
        app.log.error(
          { event: "service_shutdown_failed", reason: signal },
          "shutdown failed",
        );
        forceCloseConnections(app);
        flushAndExit(app, exitProcess, 1);
      });
  };
  const onSigterm = (): void => onSignal("SIGTERM");
  const onSigint = (): void => onSignal("SIGINT");
  const cleanup = (): void => {
    process.off("SIGTERM", onSigterm);
    process.off("SIGINT", onSigint);
  };

  process.once("SIGTERM", onSigterm);
  process.once("SIGINT", onSigint);
  return cleanup;
}

export async function listen(
  app: FastifyInstance,
  config: ServiceRuntimeConfigV1,
): Promise<void> {
  await app.listen({ host: config.host, port: config.port });
  installSignalHandlers(app, config);
}

export interface StartServiceOptions {
  readonly serviceId: ServiceIdV1;
  readonly defaultPort: number;
  readonly buildApp: (options: ServiceAppOptions) => FastifyInstance;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly workloadVerifier?: WorkloadCredentialVerifierPort;
  readonly internalRouteAuthPolicies?: readonly InternalRouteAuthPolicy[];
}

export function createWorkloadVerifierFromEnv(
  env: Readonly<Record<string, string | undefined>>,
): WorkloadCredentialVerifierPort | undefined {
  const jwksUrl = env.PAI_WORKLOAD_JWKS_URL;
  if (jwksUrl === undefined || jwksUrl.length === 0) return undefined;
  const provider = new RemoteJwksProvider({ url: jwksUrl });
  const cache = new JwksCache({ provider });
  return new WorkloadJwtVerifier({ getKey: cache.getKey });
}

/** The single production startup path used by all eight PAI services. */
export async function startService(options: StartServiceOptions): Promise<void> {
  const env = options.env ?? process.env;
  const config = loadServiceRuntimeConfig(
    { port: options.defaultPort },
    env,
  );
  const verifier =
    options.workloadVerifier ?? createWorkloadVerifierFromEnv(env);
  if (
    (options.internalRouteAuthPolicies?.length ?? 0) > 0 &&
    verifier === undefined
  ) {
    throw new Error(
      "PAI_WORKLOAD_JWKS_URL or an explicit workload verifier is required when internal routes are configured",
    );
  }
  const app = options.buildApp({
    runtimeConfig: config,
    auth: {
      ...(verifier === undefined ? {} : { verifier }),
      policies: options.internalRouteAuthPolicies ?? [],
    },
  });
  await listen(app, config);
}
