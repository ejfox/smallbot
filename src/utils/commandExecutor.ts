/**
 * Command executor utility
 * Parses and executes XML commands in AI responses
 */

export interface ExecutionResult {
  command: string;
  success: boolean;
  output?: string;
  error?: string;
}

// Use Smallweb environment variables instead of hardcoded paths
// These are automatically injected by Smallweb
const SMALLWEB_ROOT = Deno.env.get("SMALLWEB_DIR") || "/Users/ejfox/smallweb";
// Use the app's domain from environment variables or fallback
const BASE_DOMAIN = Deno.env.get("SMALLWEB_DOMAIN") || "tools.ejfox.com";
// Maximum number of lines to read from a file
const MAX_READ_LINES = 420;

/**
 * Execute commands embedded in the AI response
 * @param response The AI response containing XML commands
 * @returns The processed response and execution results
 */
export async function executeCommands(response: string): Promise<{
  processedResponse: string;
  executionResults: ExecutionResult[];
  hasErrors: boolean;
  errorSummary: string;
}> {
  const executionResults: ExecutionResult[] = [];
  let processedResponse = response;
  let hasErrors = false;
  let errorMessages: string[] = [];

  // Process <newfile> commands
  processedResponse = await processNewFileCommands(
    processedResponse,
    executionResults,
    errorMessages
  );

  // Process <mkdir> commands
  processedResponse = await processMkdirCommands(
    processedResponse,
    executionResults,
    errorMessages
  );

  // Process <fetch> commands
  processedResponse = await processFetchCommands(
    processedResponse,
    executionResults,
    errorMessages
  );

  // Process <read> commands
  processedResponse = await processReadFileCommands(
    processedResponse,
    executionResults,
    errorMessages
  );

  // Process <command> commands - disabled for security in this version
  // processedResponse = await processShellCommands(processedResponse, executionResults);

  // Check if there were any errors
  hasErrors = executionResults.some((result) => !result.success);

  // Create a summary of errors for the AI to fix
  const errorSummary =
    errorMessages.length > 0
      ? `I encountered the following errors while executing your commands:\n\n${errorMessages.join(
          "\n"
        )}\n\nPlease fix these issues and try again.`
      : "";

  return { processedResponse, executionResults, hasErrors, errorSummary };
}

/**
 * Process <newfile> commands in the response
 */
async function processNewFileCommands(
  response: string,
  results: ExecutionResult[],
  errorMessages: string[]
): Promise<string> {
  const newFileRegex = /<newfile\s+name="([^"]+)">([\s\S]*?)<\/newfile>/g;
  let match;
  let processedResponse = response;

  while ((match = newFileRegex.exec(response)) !== null) {
    const [fullMatch, fileName, fileContent] = match;
    const result: ExecutionResult = {
      command: `Create file: ${fileName}`,
      success: false,
    };

    try {
      // Normalize the file path - remove any leading ~/ or absolute paths
      const normalizedFileName = fileName
        .replace(/^~\/smallweb\//, "")
        .replace(/^\/Users\/[^\/]+\/smallweb\//, "");

      // Create the full path to the file in the smallweb root directory
      const fullPath = `${SMALLWEB_ROOT}/${normalizedFileName}`;

      // Ensure the directory exists
      const dirPath = normalizedFileName.includes("/")
        ? normalizedFileName.substring(0, normalizedFileName.lastIndexOf("/"))
        : "";

      if (dirPath) {
        await Deno.mkdir(`${SMALLWEB_ROOT}/${dirPath}`, { recursive: true });
      }

      // Write the file
      await Deno.writeTextFile(fullPath, fileContent);
      result.success = true;
      result.output = `File created: ${normalizedFileName}`;

      // Replace the command with a success message in the response
      processedResponse = processedResponse.replace(
        fullMatch,
        `✅ File created: ${normalizedFileName}`
      );
    } catch (error) {
      result.error = error.message;

      // Add detailed error message for the AI
      errorMessages.push(`Error creating file "${fileName}": ${error.message}`);

      // Replace the command with an error message in the response
      processedResponse = processedResponse.replace(
        fullMatch,
        `❌ Failed to create file ${fileName}: ${error.message}`
      );
    }

    results.push(result);
  }

  return processedResponse;
}

/**
 * Process <mkdir> commands in the response
 */
async function processMkdirCommands(
  response: string,
  results: ExecutionResult[],
  errorMessages: string[]
): Promise<string> {
  const mkdirRegex = /<mkdir\s+path="([^"]+)">/g;
  let match;
  let processedResponse = response;

  while ((match = mkdirRegex.exec(response)) !== null) {
    const [fullMatch, dirPath] = match;
    const result: ExecutionResult = {
      command: `Create directory: ${dirPath}`,
      success: false,
    };

    try {
      // Normalize the directory path - remove any leading ~/ or absolute paths
      const normalizedDirPath = dirPath
        .replace(/^~\/smallweb\//, "")
        .replace(/^\/Users\/[^\/]+\/smallweb\//, "");

      // Create the full path to the directory in the smallweb root directory
      const fullPath = `${SMALLWEB_ROOT}/${normalizedDirPath}`;

      await Deno.mkdir(fullPath, { recursive: true });
      result.success = true;
      result.output = `Directory created: ${normalizedDirPath}`;

      // Replace the command with a success message in the response
      processedResponse = processedResponse.replace(
        fullMatch,
        `✅ Directory created: ${normalizedDirPath}`
      );
    } catch (error) {
      result.error = error.message;

      // Add detailed error message for the AI
      errorMessages.push(
        `Error creating directory "${dirPath}": ${error.message}`
      );

      // Replace the command with an error message in the response
      processedResponse = processedResponse.replace(
        fullMatch,
        `❌ Failed to create directory ${dirPath}: ${error.message}`
      );
    }

    results.push(result);
  }

  return processedResponse;
}

/**
 * Process <fetch> commands in the response
 * This allows the AI to check the results of its work by fetching URLs
 */
async function processFetchCommands(
  response: string,
  results: ExecutionResult[],
  errorMessages: string[]
): Promise<string> {
  const fetchRegex = /<fetch\s+url="([^"]+)">/g;
  let match;
  let processedResponse = response;

  while ((match = fetchRegex.exec(response)) !== null) {
    const [fullMatch, url] = match;
    const result: ExecutionResult = {
      command: `Fetch URL: ${url}`,
      success: false,
    };

    try {
      // Normalize the URL - if it's just an app name, convert to full URL
      let normalizedUrl = url;
      if (!url.startsWith("http")) {
        // If it's just an app name without a domain
        if (!url.includes(".")) {
          normalizedUrl = `https://${url}.${BASE_DOMAIN}`;
        }
        // If it doesn't have a protocol
        else if (!url.startsWith("https://") && !url.startsWith("http://")) {
          normalizedUrl = `https://${url}`;
        }
      }

      // Fetch the URL
      const fetchResponse = await fetch(normalizedUrl);
      const status = fetchResponse.status;

      // Get the response text, but limit it to a reasonable size
      const responseText = await fetchResponse.text();
      const truncatedResponse =
        responseText.length > 500
          ? responseText.substring(0, 500) + "... (truncated)"
          : responseText;

      result.success = fetchResponse.ok;
      result.output = `Status: ${status}\nResponse: ${truncatedResponse}`;

      // Replace the command with the fetch result in the response
      if (fetchResponse.ok) {
        processedResponse = processedResponse.replace(
          fullMatch,
          `✅ Fetched ${normalizedUrl} - Status: ${status}\n\`\`\`\n${truncatedResponse}\n\`\`\``
        );
      } else {
        processedResponse = processedResponse.replace(
          fullMatch,
          `⚠️ Fetch ${normalizedUrl} - Status: ${status}\n\`\`\`\n${truncatedResponse}\n\`\`\``
        );
        errorMessages.push(
          `Error fetching URL "${normalizedUrl}": Received status code ${status}`
        );
      }
    } catch (error) {
      result.error = error.message;

      // Add detailed error message for the AI
      errorMessages.push(`Error fetching URL "${url}": ${error.message}`);

      // Replace the command with an error message in the response
      processedResponse = processedResponse.replace(
        fullMatch,
        `❌ Failed to fetch ${url}: ${error.message}`
      );
    }

    results.push(result);
  }

  return processedResponse;
}

/**
 * Process <read> commands in the response
 * This allows the AI to read file contents
 */
async function processReadFileCommands(
  response: string,
  results: ExecutionResult[],
  errorMessages: string[]
): Promise<string> {
  // Match both full file reads: <read file="path/to/file.js">
  // And line range reads: <read file="path/to/file.js" lines="1-50">
  const readFileRegex =
    /<read\s+file="([^"]+)"(?:\s+lines="(\d+)-(\d+)")?\s*>/g;
  let match;
  let processedResponse = response;

  while ((match = readFileRegex.exec(response)) !== null) {
    const [fullMatch, filePath, startLineStr, endLineStr] = match;
    const result: ExecutionResult = {
      command: `Read file: ${filePath}${
        startLineStr ? ` (lines ${startLineStr}-${endLineStr})` : ""
      }`,
      success: false,
    };

    try {
      // Normalize the file path - remove any leading ~/ or absolute paths
      const normalizedFilePath = filePath
        .replace(/^~\/smallweb\//, "")
        .replace(/^\/Users\/[^\/]+\/smallweb\//, "");

      // Create the full path to the file in the smallweb root directory
      const fullPath = `${SMALLWEB_ROOT}/${normalizedFilePath}`;

      // Read the file
      const fileContent = await Deno.readTextFile(fullPath);
      const fileLines = fileContent.split("\n");
      const totalLines = fileLines.length;

      let contentToShow: string;
      let contentHeader: string;

      if (startLineStr && endLineStr) {
        // Read specific line range
        const startLine = Math.max(1, parseInt(startLineStr, 10));
        const endLine = Math.min(totalLines, parseInt(endLineStr, 10));

        // Ensure we don't read more than MAX_READ_LINES
        const actualEndLine = Math.min(endLine, startLine + MAX_READ_LINES - 1);

        // Extract the requested lines (adjusting for 0-based array indices)
        contentToShow = fileLines
          .slice(startLine - 1, actualEndLine)
          .join("\n");
        contentHeader = `Lines ${startLine}-${actualEndLine} of ${totalLines} from ${normalizedFilePath}:`;
      } else {
        // Read entire file (truncated if necessary)
        const maxLines = Math.min(totalLines, MAX_READ_LINES);
        contentToShow = fileLines.slice(0, maxLines).join("\n");

        contentHeader =
          maxLines < totalLines
            ? `First ${maxLines} lines of ${totalLines} from ${normalizedFilePath} (truncated):`
            : `${normalizedFilePath} (${totalLines} lines):`;
      }

      result.success = true;
      result.output = contentToShow;

      // Replace the command with the file content in the response
      const fileExtension = normalizedFilePath.split(".").pop() || "";
      processedResponse = processedResponse.replace(
        fullMatch,
        `📄 ${contentHeader}\n\`\`\`${fileExtension}\n${contentToShow}\n\`\`\``
      );
    } catch (error) {
      result.error = error.message;

      // Add detailed error message for the AI
      errorMessages.push(`Error reading file "${filePath}": ${error.message}`);

      // Replace the command with an error message in the response
      processedResponse = processedResponse.replace(
        fullMatch,
        `❌ Failed to read file ${filePath}: ${error.message}`
      );
    }

    results.push(result);
  }

  return processedResponse;
}

/**
 * Process <command> commands in the response
 * Note: This function is currently disabled for security reasons
 */
async function processShellCommands(
  response: string,
  results: ExecutionResult[]
): Promise<string> {
  const commandRegex = /<command>([\s\S]*?)<\/command>/g;
  let match;
  let processedResponse = response;

  while ((match = commandRegex.exec(response)) !== null) {
    const [fullMatch, cmdText] = match;
    const result: ExecutionResult = {
      command: cmdText,
      success: false,
    };

    // For now, we'll just acknowledge the command but not execute it
    result.output = "Command execution is disabled for security reasons";
    processedResponse = processedResponse.replace(
      fullMatch,
      `⚠️ Command not executed (disabled): ${cmdText}`
    );

    results.push(result);
  }

  return processedResponse;
}
