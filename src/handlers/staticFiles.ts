import { Context } from "jsr:@hono/hono";
import { getContentType } from "../utils/contentType.ts";

/**
 * Handler for serving static files from the frontend directory
 */
export async function staticFileHandler(c: Context) {
  try {
    const path = c.req.path;
    const filePath =
      path === "/" ? "./frontend/index.html" : `./frontend${path}`;

    const file = await Deno.readFile(filePath);
    const contentType = getContentType(filePath);

    c.header("Content-Type", contentType);
    return c.body(file);
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      return c.text("Not found", 404);
    }
    return c.text("Internal server error", 500);
  }
}
