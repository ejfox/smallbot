// Simple Smallbot server for Smallweb applications
// No complex frameworks, just simple web technologies

import { createApp } from "./src/app.ts";

const app = createApp();

// Export the Hono app's fetch handler
export default {
  fetch: app.fetch,
};

console.log("Server running at http://localhost:8000");
