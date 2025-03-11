/**
 * Log storage utility
 * Stores and retrieves operation logs
 */

import { ExecutionResult } from "./commandExecutor.ts";

interface LogEntry {
  timestamp: string;
  userMessage: string;
  executionResults: ExecutionResult[];
}

// In-memory storage for logs (will be lost on server restart)
// For persistence, this could be replaced with file storage
const logs: LogEntry[] = [];

/**
 * Add a new log entry
 * @param userMessage The user message that triggered the operations
 * @param executionResults The results of the operations
 */
export function addLogEntry(
  userMessage: string,
  executionResults: ExecutionResult[]
): void {
  // Only log if there were actual operations
  if (executionResults.length > 0) {
    logs.unshift({
      timestamp: new Date().toISOString(),
      userMessage,
      executionResults,
    });

    // Limit log size to prevent memory issues
    if (logs.length > 100) {
      logs.pop();
    }
  }
}

/**
 * Get all log entries
 * @returns Array of log entries
 */
export function getLogs(): LogEntry[] {
  return logs;
}

/**
 * Clear all logs
 */
export function clearLogs(): void {
  logs.length = 0;
}
