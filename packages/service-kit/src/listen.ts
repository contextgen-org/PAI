import type { FastifyInstance } from "fastify";

export async function listen(
  app: FastifyInstance,
  defaultPort: number,
): Promise<void> {
  const port = Number.parseInt(process.env.PORT ?? String(defaultPort), 10);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }
  await app.listen({ host: process.env.HOST ?? "127.0.0.1", port });
}
