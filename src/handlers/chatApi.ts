import { Context } from "jsr:@hono/hono";
import { SYSTEM_PROMPT } from "../config/systemPrompt.ts";
import { validateResponseFormat } from "../utils/validation.ts";
import { executeCommands } from "../utils/commandExecutor.ts";
import { addLogEntry, getLogs } from "../utils/logStorage.ts";

/**
 * Handler for the chat API endpoint
 * Processes user messages and returns AI responses
 */
export async function chatApiHandler(c: Context) {
  try {
    const body = await c.req.json();
    const { message, stream = false, errorFeedback = null } = body;

    if (!message) {
      return c.json({ error: "Message is required" }, 400);
    }

    // Check if this is a request for logs
    if (message.toLowerCase() === "show logs") {
      return c.json({
        response: "Here are the recent operations:",
        logs: getLogs(),
      });
    }

    // Check if API key is set
    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) {
      console.error("OPENROUTER_API_KEY environment variable is not set");
      return c.json({
        response:
          'I\'m running in demo mode since no API key is configured. Here\'s how you would create a simple hello world Smallweb app:\n\n```\nimport { Hono } from "jsr:@hono/hono";\n\nconst app = new Hono();\n\napp.get("/", (c) => c.text("Hello Smallweb!"));\n\nexport default {\n  fetch: app.fetch,\n};\n```\n\nTo use a real API key, set the OPENROUTER_API_KEY environment variable when running the server.',
      });
    }

    // If streaming is requested, handle streaming response
    if (stream) {
      return handleStreamingResponse(c, message, apiKey, errorFeedback);
    }

    // Handle regular non-streaming response
    return handleRegularResponse(c, message, apiKey, errorFeedback);
  } catch (error) {
    console.error("Error in chat API:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return c.json({ error: errorMessage }, 500);
  }
}

/**
 * Handles streaming response from the AI
 */
async function handleStreamingResponse(
  c: Context,
  message: string,
  apiKey: string,
  errorFeedback: string | null
) {
  // Create a new ReadableStream
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Prepare messages for the AI
        const messages = [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: message,
          },
        ];

        // If there's error feedback, add it as an assistant message followed by a user request to fix
        if (errorFeedback) {
          messages.push(
            {
              role: "assistant",
              content: "I'll create those files for you.",
            },
            {
              role: "user",
              content: `${errorFeedback}\n\nPlease fix these issues and provide corrected commands.`,
            }
          );
        }

        // Call the OpenRouter API with stream=true
        const response = await fetch(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
              "HTTP-Referer": "https://smallweb.local",
              "X-Title": "Smallbot",
            },
            body: JSON.stringify({
              model: "anthropic/claude-3.7-sonnet:beta",
              messages: messages,
              stream: true,
              response_format: { type: "text" },
            }),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(
            error.error?.message || "Failed to get response from API"
          );
        }

        // Process the stream
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("Failed to get reader from response");
        }

        let fullResponse = "";
        let decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });

          // Parse the SSE data
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ") && line !== "data: [DONE]") {
              try {
                const data = JSON.parse(line.substring(6));
                if (data.choices && data.choices[0]?.delta?.content) {
                  const content = data.choices[0].delta.content;
                  fullResponse += content;

                  // Send the chunk to the client
                  controller.enqueue(
                    new TextEncoder().encode(
                      JSON.stringify({
                        chunk: content,
                        done: false,
                      }) + "\n"
                    )
                  );
                }
              } catch (e) {
                console.error("Error parsing SSE data:", e);
              }
            }
          }
        }

        // Check if the response contains XML commands
        const hasXmlCommands =
          fullResponse.includes("<newfile") ||
          fullResponse.includes("<command") ||
          fullResponse.includes("<mkdir");

        if (hasXmlCommands) {
          console.log("XML commands detected in response");

          try {
            // Execute the commands in the response
            const {
              processedResponse,
              executionResults,
              hasErrors,
              errorSummary,
            } = await executeCommands(fullResponse);

            // Store the log entry
            addLogEntry(message, executionResults);

            // If there are errors, include them in the response
            if (hasErrors) {
              // Send the final processed response with execution results and errors
              controller.enqueue(
                new TextEncoder().encode(
                  JSON.stringify({
                    chunk: "",
                    done: true,
                    fullResponse: processedResponse,
                    executionResults: executionResults,
                    hasErrors: true,
                    errorSummary: errorSummary,
                  }) + "\n"
                )
              );
            } else {
              // Send the final processed response with execution results
              controller.enqueue(
                new TextEncoder().encode(
                  JSON.stringify({
                    chunk: "",
                    done: true,
                    fullResponse: processedResponse,
                    executionResults: executionResults,
                    hasErrors: false,
                  }) + "\n"
                )
              );
            }
          } catch (commandError) {
            console.error("Error executing commands:", commandError);
            controller.enqueue(
              new TextEncoder().encode(
                JSON.stringify({
                  chunk: "",
                  done: true,
                  fullResponse: fullResponse,
                  error: `Failed to execute commands: ${commandError.message}`,
                  hasErrors: true,
                }) + "\n"
              )
            );
          }
        } else {
          // Send the final response
          controller.enqueue(
            new TextEncoder().encode(
              JSON.stringify({
                chunk: "",
                done: true,
                fullResponse: fullResponse,
                hasErrors: false,
              }) + "\n"
            )
          );
        }

        controller.close();
      } catch (error) {
        console.error("Error in streaming response:", error);
        controller.enqueue(
          new TextEncoder().encode(
            JSON.stringify({
              error: error instanceof Error ? error.message : String(error),
              done: true,
              hasErrors: true,
            }) + "\n"
          )
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

/**
 * Handles regular non-streaming response from the AI
 */
async function handleRegularResponse(
  c: Context,
  message: string,
  apiKey: string,
  errorFeedback: string | null
) {
  // Prepare messages for the AI
  const messages = [
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: message,
    },
  ];

  // If there's error feedback, add it as an assistant message followed by a user request to fix
  if (errorFeedback) {
    messages.push(
      {
        role: "assistant",
        content: "I'll create those files for you.",
      },
      {
        role: "user",
        content: `${errorFeedback}\n\nPlease fix these issues and provide corrected commands.`,
      }
    );
  }

  // Call the OpenRouter API
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://smallweb.local", // Replace with your actual domain
        "X-Title": "Smallbot",
      },
      body: JSON.stringify({
        model: "anthropic/claude-3.7-sonnet:beta", // Updated to Claude 3.7 Sonnet
        messages: messages,
        response_format: { type: "text" }, // Ensure we get text, not JSON
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to get response from API");
  }

  const data = await response.json();
  const aiResponse = data.choices[0].message.content;

  // Check if the response contains XML commands
  const hasXmlCommands =
    aiResponse.includes("<newfile") ||
    aiResponse.includes("<command") ||
    aiResponse.includes("<mkdir");

  if (hasXmlCommands) {
    console.log("XML commands detected in response");

    try {
      // Execute the commands in the response
      const { processedResponse, executionResults, hasErrors, errorSummary } =
        await executeCommands(aiResponse);

      // Store the log entry
      addLogEntry(message, executionResults);

      // Return both the processed response, execution results, and error information
      return c.json({
        response: processedResponse,
        executionResults: executionResults,
        hasErrors: hasErrors,
        errorSummary: errorSummary,
      });
    } catch (commandError) {
      console.error("Error executing commands:", commandError);
      return c.json({
        response: aiResponse,
        error: `Failed to execute commands: ${commandError.message}`,
        hasErrors: true,
      });
    }
  }

  // Validate response format for create/build/make requests
  if (
    message.toLowerCase().includes("create") ||
    message.toLowerCase().includes("build") ||
    message.toLowerCase().includes("make")
  ) {
    // Log the message for debugging
    console.log("Create/build/make request detected:", message);

    const isValidFormat = validateResponseFormat(aiResponse);

    if (!isValidFormat) {
      // If format is invalid, return a more helpful error message with XML command examples
      console.log(
        "Response validation failed, returning friendly error message with XML examples"
      );
      return c.json({
        response:
          "I apologize, but I need to format my response better. Let me try again with XML commands to create your app.\n\n" +
          "Here's how I can create files and directories for you:\n\n" +
          "1. I can create directories (using relative paths):\n" +
          '<mkdir path="app-name">\n\n' +
          "2. I can create files with content (using relative paths):\n" +
          '<newfile name="app-name/index.html">\n' +
          "<!DOCTYPE html>\n" +
          "<html>\n" +
          "<head>\n" +
          "  <title>Example App</title>\n" +
          "</head>\n" +
          "<body>\n" +
          "  <h1>Hello Smallweb!</h1>\n" +
          "</body>\n" +
          "</html>\n" +
          "</newfile>\n\n" +
          "IMPORTANT: Always use relative paths without ~/smallweb/ prefix to ensure proper file creation.\n\n" +
          "Let me create a proper response for your specific request now...",
      });
    } else {
      console.log("Response validation passed");
    }
  }

  return c.json({ response: aiResponse, hasErrors: false });
}
