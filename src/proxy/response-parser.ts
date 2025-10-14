// Response parsing utilities for handling various response formats

/**
 * Parses response body that can be in different formats:
 * - Server-Sent Events (SSE) format with "data: " prefix
 * - Plain JSON format
 *
 * @param rawText - The raw response text from the server
 * @returns The extracted JSON string ready for JSON.parse()
 * @throws Error if the response format is invalid or data is missing
 */
export function parseResponseBody(rawText: string): string {
  if (!rawText || !rawText.trim()) {
    throw new Error("Empty response body");
  }

  const trimmedText = rawText.trim();

  // Check if this is SSE format
  if (trimmedText.includes("data: ")) {
    return parseSSEResponse(trimmedText);
  }

  // Assume it's already JSON format
  return trimmedText;
}

/**
 * Parses Server-Sent Events (SSE) format response
 * Expected format:
 * event: message
 * data: {"jsonrpc":"2.0","id":123,"result":{...}}
 *
 * @param sseText - The SSE formatted text
 * @returns The JSON string extracted from the data field
 * @throws Error if no data field is found
 */
function parseSSEResponse(sseText: string): string {
  const lines = sseText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const dataLine = lines.find((line) => line.startsWith("data: "));

  if (!dataLine) {
    throw new Error("No data field found in SSE response");
  }

  // Extract JSON after "data: " prefix
  const jsonData = dataLine.substring(6).trim();

  if (!jsonData) {
    throw new Error("Empty data field in SSE response");
  }

  return jsonData;
}

/**
 * Validates that a string can be parsed as JSON
 *
 * @param jsonString - The string to validate
 * @returns True if the string is valid JSON
 */
export function isValidJSON(jsonString: string): boolean {
  try {
    JSON.parse(jsonString);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely parses a JSON string and returns the parsed object
 *
 * @param jsonString - The JSON string to parse
 * @returns The parsed object
 * @throws Error with descriptive message if parsing fails
 */
export function safeJSONParse(jsonString: string): unknown {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    throw new Error(
      `Failed to parse JSON: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}
