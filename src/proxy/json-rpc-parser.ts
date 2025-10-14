// Type utilities for safe JSON handling with Zod validation
import * as vals from "../validators";
import type * as types from "../types";

// Type guard to check if an unknown value is a valid JSON-RPC response using Zod
export function isJsonRpcResponse(
  value: unknown
): value is types.JsonRpcResponse {
  const result = vals.jsonRpcResponse.safeParse(value);
  return result.success;
}

// Parse and validate JSON-RPC response with Zod
export function validateJsonRpcResponse(value: unknown): types.JsonRpcResponse {
  const result = vals.jsonRpcResponse.safeParse(value);
  if (!result.success) {
    throw new Error(`Invalid JSON-RPC response: ${result.error.message}`);
  }
  return result.data;
}

// Type guard to check if an unknown value has an error property using Zod
export function hasJsonRpcError(
  value: types.JsonRpcResponse
): value is types.JsonRpcResponse & {
  error: NonNullable<types.JsonRpcResponse["error"]>;
} {
  return value.error !== undefined;
}

// Type-safe wrapper for Response.json() that handles unknown type and validates with Zod
export async function safeParseJson(
  response: Response
): Promise<types.JsonRpcResponse> {
  try {
    const json: unknown = await response.json();
    return validateJsonRpcResponse(json);
  } catch (error) {
    throw new Error(
      `Failed to parse JSON: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

// Specific typed JSON-RPC response parser with Zod validation
export async function parseTypedJsonRpcResponse<T = any>(
  response: Response
): Promise<T> {
  const jsonResponse = await safeParseJson(response);

  if (hasJsonRpcError(jsonResponse)) {
    throw new Error(jsonResponse.error.message || "Unknown error from server");
  }

  return jsonResponse.result as T;
}

// Safe JSON parser that returns typed result with Zod validation
export async function parseJsonRpcResponse(response: Response): Promise<any> {
  const jsonResponse = await safeParseJson(response);

  if (hasJsonRpcError(jsonResponse)) {
    throw new Error(jsonResponse.error.message || "Unknown error from server");
  }

  return jsonResponse.result;
}
