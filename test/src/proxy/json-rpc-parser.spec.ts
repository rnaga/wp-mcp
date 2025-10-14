import {
  isJsonRpcResponse,
  validateJsonRpcResponse,
  hasJsonRpcError,
  safeParseJson,
  parseTypedJsonRpcResponse,
  parseJsonRpcResponse,
} from "@rnaga/wp-mcp/proxy/json-rpc-parser";

test("isJsonRpcResponse should return true for valid JSON-RPC response", () => {
  const validResponse = {
    jsonrpc: "2.0",
    id: 1,
    result: { success: true },
  };

  expect(isJsonRpcResponse(validResponse)).toBe(true);
});

test("isJsonRpcResponse should return false for invalid JSON-RPC response", () => {
  const invalidResponse = {
    id: 1,
    result: { success: true },
    // missing jsonrpc field
  };

  expect(isJsonRpcResponse(invalidResponse)).toBe(false);
});

test("isJsonRpcResponse should return false for non-object values", () => {
  expect(isJsonRpcResponse(null)).toBe(false);
  expect(isJsonRpcResponse("string")).toBe(false);
  expect(isJsonRpcResponse(123)).toBe(false);
  expect(isJsonRpcResponse(undefined)).toBe(false);
});

test("validateJsonRpcResponse should return validated response for valid input", () => {
  const validResponse = {
    jsonrpc: "2.0",
    id: 1,
    result: { data: "test" },
  };

  const result = validateJsonRpcResponse(validResponse);

  expect(result).toEqual(validResponse);
  expect(result.jsonrpc).toBe("2.0");
  expect(result.id).toBe(1);
});

test("validateJsonRpcResponse should throw error for invalid input", () => {
  const invalidResponse = {
    id: 1,
    result: { data: "test" },
  };

  expect(() => validateJsonRpcResponse(invalidResponse)).toThrow(
    "Invalid JSON-RPC response"
  );
});

test("hasJsonRpcError should return true when error exists", () => {
  const responseWithError = {
    jsonrpc: "2.0",
    id: 1,
    error: {
      code: -32600,
      message: "Invalid request",
    },
  };

  expect(hasJsonRpcError(responseWithError)).toBe(true);
});

test("hasJsonRpcError should return false when error is undefined", () => {
  const responseWithoutError = {
    jsonrpc: "2.0",
    id: 1,
    result: { success: true },
  };

  expect(hasJsonRpcError(responseWithoutError)).toBe(false);
});

test("safeParseJson should parse valid JSON-RPC response", async () => {
  const mockResponse = {
    json: jest.fn().mockResolvedValue({
      jsonrpc: "2.0",
      id: 1,
      result: { data: "test" },
    }),
  } as any;

  const result = await safeParseJson(mockResponse);

  expect(result.jsonrpc).toBe("2.0");
  expect(result.result).toEqual({ data: "test" });
});

test("safeParseJson should throw error for invalid JSON-RPC response", async () => {
  const mockResponse = {
    json: jest.fn().mockResolvedValue({
      id: 1,
      // missing jsonrpc
    }),
  } as any;

  await expect(safeParseJson(mockResponse)).rejects.toThrow(
    "Failed to parse JSON"
  );
});

test("safeParseJson should throw error when response.json() fails", async () => {
  const mockResponse = {
    json: jest.fn().mockRejectedValue(new Error("Parse error")),
  } as any;

  await expect(safeParseJson(mockResponse)).rejects.toThrow(
    "Failed to parse JSON: Parse error"
  );
});

test("parseTypedJsonRpcResponse should return result for successful response", async () => {
  const mockResponse = {
    json: jest.fn().mockResolvedValue({
      jsonrpc: "2.0",
      id: 1,
      result: { items: [1, 2, 3] },
    }),
  } as any;

  const result = await parseTypedJsonRpcResponse<{ items: number[] }>(
    mockResponse
  );

  expect(result.items).toEqual([1, 2, 3]);
});

test("parseTypedJsonRpcResponse should throw error when response has error", async () => {
  const mockResponse = {
    json: jest.fn().mockResolvedValue({
      jsonrpc: "2.0",
      id: 1,
      error: {
        code: -32600,
        message: "Invalid request",
      },
    }),
  } as any;

  await expect(parseTypedJsonRpcResponse(mockResponse)).rejects.toThrow(
    "Invalid request"
  );
});

test("parseJsonRpcResponse should return result for successful response", async () => {
  const mockResponse = {
    json: jest.fn().mockResolvedValue({
      jsonrpc: "2.0",
      id: 1,
      result: { value: "success" },
    }),
  } as any;

  const result = await parseJsonRpcResponse(mockResponse);

  expect(result).toEqual({ value: "success" });
});

test("parseJsonRpcResponse should throw error when response has error", async () => {
  const mockResponse = {
    json: jest.fn().mockResolvedValue({
      jsonrpc: "2.0",
      id: 1,
      error: {
        code: -32601,
        message: "Method not found",
      },
    }),
  } as any;

  await expect(parseJsonRpcResponse(mockResponse)).rejects.toThrow(
    "Method not found"
  );
});

test("validateJsonRpcResponse should accept response with error field", () => {
  const responseWithError = {
    jsonrpc: "2.0",
    id: 1,
    error: {
      code: -32600,
      message: "Invalid request",
    },
  };

  const result = validateJsonRpcResponse(responseWithError);

  expect(result.error).toBeDefined();
  expect(result.error?.message).toBe("Invalid request");
});
