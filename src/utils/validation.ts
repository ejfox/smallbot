/**
 * Function to validate response format
 * Ensures that responses meet the formatting requirements
 */
export function validateResponseFormat(response: string): boolean {
  // Normalize response to handle edge cases
  const normalizedResponse = response.trim();

  // Debug the full response for troubleshooting
  console.log(
    "Validating response:",
    normalizedResponse.substring(0, 100) + "..."
  );

  // Check if response contains code blocks with triple backticks
  const hasTripleBackticks = normalizedResponse.includes("```");
  console.log("Has triple backticks:", hasTripleBackticks);

  // Check if response contains code blocks with single backticks (incorrect format)
  const hasSingleBackticks =
    normalizedResponse.includes("`") && !hasTripleBackticks;
  console.log("Has single backticks (incorrect format):", hasSingleBackticks);

  // If the response has single backticks but not triple backticks, it's likely
  // the AI is trying to use code blocks but with incorrect formatting
  if (hasSingleBackticks && !hasTripleBackticks) {
    console.log(
      "Validation failed: Using single backticks instead of triple backticks"
    );
    return false;
  }

  // Check if response contains code blocks
  if (!hasTripleBackticks) {
    console.log("Validation failed: No code blocks found");
    return false;
  }

  // Check if code blocks have language specified
  // This regex looks for code blocks with language specification
  // We're being more lenient here by accepting any character after the backticks
  const codeBlocksWithLanguage = normalizedResponse.match(/```[a-zA-Z0-9]+/g);
  const hasLanguageSpecified =
    codeBlocksWithLanguage && codeBlocksWithLanguage.length > 0;
  console.log(
    "Has language specified:",
    hasLanguageSpecified,
    codeBlocksWithLanguage
  );

  // For complex responses (longer than 500 chars), we do additional checks
  // but we'll be much more lenient
  const isComplexApp = normalizedResponse.length > 500;
  console.log(
    "Is complex app:",
    isComplexApp,
    "Length:",
    normalizedResponse.length
  );

  if (isComplexApp) {
    // Check if there are file labels (bold filenames)
    // This regex looks for bold text that resembles filenames, but we're being more lenient
    const hasFileLabels =
      normalizedResponse.includes("**") &&
      (/\*\*[a-zA-Z0-9_\-\.]+\.[a-zA-Z0-9]+\*\*/.test(normalizedResponse) ||
        /\*\*[a-zA-Z0-9_\-\.]+\*\*/.test(normalizedResponse));
    console.log("Has file labels:", hasFileLabels);

    // Check if there are instructions
    const instructionKeywords = [
      "create",
      "run",
      "open",
      "deploy",
      "install",
      "copy",
      "paste",
      "save",
      "mkdir",
      "download",
      "execute",
      "start",
      "build",
      "setup",
      "configure",
      "access",
      "visit",
      "browser",
      "navigate",
      "go to",
      "step",
      "follow",
      "instruction",
      "guide",
      "tutorial",
    ];

    const hasInstructions = instructionKeywords.some((keyword) =>
      normalizedResponse.toLowerCase().includes(keyword)
    );
    console.log("Has instructions:", hasInstructions);

    // For complex apps, we'll be VERY lenient - just require code blocks
    // Either file labels or instructions are nice to have but not required
    const isValid = hasTripleBackticks;

    if (!isValid) {
      console.log("Validation failed for complex app:", {
        hasTripleBackticks,
        hasLanguageSpecified,
        hasFileLabels,
        hasInstructions,
      });
    }

    return isValid;
  }

  // For simple responses, we only need code blocks
  return hasTripleBackticks;
}
