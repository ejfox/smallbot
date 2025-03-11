import { Context, Next } from "jsr:@hono/hono";

/**
 * Middleware for request logging
 * Logs the method, URL, and response time for each request
 */
export async function loggerMiddleware(c: Context, next: Next) {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`${c.req.method} ${c.req.url} - ${ms}ms`);
}
