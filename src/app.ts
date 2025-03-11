import { Hono } from "jsr:@hono/hono";
import { loggerMiddleware } from "./middleware/logger.ts";
import { corsMiddleware } from "./middleware/cors.ts";
import { staticFileHandler } from "./handlers/staticFiles.ts";
import { chatApiHandler } from "./handlers/chatApi.ts";
import { getLogs } from "./utils/logStorage.ts";

/**
 * Main application setup
 */
export function createApp() {
  const app = new Hono();

  // Add middleware
  app.use("*", loggerMiddleware);
  app.use("*", corsMiddleware);

  // Handle OPTIONS requests for CORS
  app.options("*", (c) => c.text("", 204));

  // Serve static files
  app.get("/*", staticFileHandler);

  // Chat API endpoint
  app.post("/api/chat", chatApiHandler);

  // Add logs endpoint
  app.get("/api/logs", (c) => {
    return c.json({ logs: getLogs() });
  });

  // Error handling middleware
  app.onError((err, c) => {
    console.error(`${c.req.method} ${c.req.url}: ${err}`);
    return c.json({ error: err.message }, 500);
  });

  return app;
}
