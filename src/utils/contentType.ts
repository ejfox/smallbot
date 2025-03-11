/**
 * Helper function to determine content type based on file extension
 */
export function getContentType(filePath: string): string {
  const extension = filePath.split(".").pop()?.toLowerCase() || "";

  const contentTypes: Record<string, string> = {
    html: "text/html",
    css: "text/css",
    js: "text/javascript",
    json: "application/json",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    ico: "image/x-icon",
  };

  return contentTypes[extension] || "text/plain";
}
