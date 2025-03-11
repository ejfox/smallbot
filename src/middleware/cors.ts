import { Context, Next } from "jsr:@hono/hono";

/**
 * Middleware for handling CORS headers
 * Adds appropriate headers to allow cross-origin requests
 */
export async function corsMiddleware(c: Context, next: Next) {
  await next();
  c.header("Access-Control-Allow-Origin", "*");
  c.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
}
