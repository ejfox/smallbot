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

// Path to the smallweb root directory
const SMALLWEB_ROOT = "/Users/ejfox/smallweb";
// Base domain for Smallweb apps
const BASE_DOMAIN = "tools.ejfox.com";

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
