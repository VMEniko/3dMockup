import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerRoutes } from "./routes";

const app = Fastify({ logger: true });

async function buildServer(): Promise<void> {
  await app.register(cors, { origin: true });
  await registerRoutes(app);
}

buildServer()
  .then(async () => {
    const port = Number(process.env.PORT ?? 3000);
    await app.listen({ port, host: "0.0.0.0" });
  })
  .catch((error) => {
    app.log.error(error, "Failed to start server");
    process.exit(1);
  });
