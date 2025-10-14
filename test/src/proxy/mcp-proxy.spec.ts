jest.mock("node-fetch");
jest.mock("../../../src/secret-store");
jest.mock("../../../src/logger");

import { McpProxy } from "@rnaga/wp-mcp/proxy/mcp-proxy";
import fetch from "node-fetch";
import { getSecret } from "../../../src/secret-store";

const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

beforeEach(() => {
  jest.clearAllMocks();
  (getSecret as jest.Mock).mockResolvedValue({});
});

const createMockResponse = (result: any, status = 200, ok = true) => ({
  ok,
  status,
  statusText: ok ? "OK" : "Error",
  text: jest.fn().mockResolvedValue(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      result,
    })
  ),
  headers: {
    get: jest.fn().mockReturnValue(null),
  },
});

test("should create McpProxy instance with config", () => {
  const config = {
    remoteUrl: "https://example.com/mcp",
    authType: "password" as const,
    username: "user",
    password: "pass",
  };

  const proxy = new McpProxy(config);

  expect(proxy).toBeInstanceOf(McpProxy);
});

test("should forward request with password auth", async () => {
  const config = {
    remoteUrl: "https://example.com/mcp",
    authType: "password" as const,
    username: "testuser",
    password: "testpass",
  };

  const proxy = new McpProxy(config);

  mockFetch.mockResolvedValue(
    createMockResponse({ tools: [] }) as any
  );

  const result = await (proxy as any).forwardRequest("tools/list");

  expect(mockFetch).toHaveBeenCalledWith(
    "https://example.com/mcp",
    expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        "Content-Type": "application/json",
        Authorization: expect.stringContaining("Basic"),
      }),
    })
  );

  expect(result.jsonResponse).toEqual({ tools: [] });
});

test("should forward request with oauth auth", async () => {
  const config = {
    remoteUrl: "https://example.com/mcp",
    authType: "oauth" as const,
  };

  (getSecret as jest.Mock).mockResolvedValue({
    remote: {
      oauth: {
        access_token: "test-oauth-token",
      },
    },
  });

  const proxy = new McpProxy(config);

  mockFetch.mockResolvedValue(
    createMockResponse({ tools: [] }) as any
  );

  await (proxy as any).forwardRequest("tools/list");

  expect(mockFetch).toHaveBeenCalledWith(
    "https://example.com/mcp",
    expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: "Bearer test-oauth-token",
      }),
    })
  );
});

test("should include session ID in headers when available", async () => {
  const config = {
    remoteUrl: "https://example.com/mcp",
    authType: "password" as const,
    username: "user",
    password: "pass",
  };

  const proxy = new McpProxy(config);
  (proxy as any).sessionId = "session-123";

  mockFetch.mockResolvedValue(
    createMockResponse({ result: "ok" }) as any
  );

  await (proxy as any).forwardRequest("test/method");

  expect(mockFetch).toHaveBeenCalledWith(
    "https://example.com/mcp",
    expect.objectContaining({
      headers: expect.objectContaining({
        "MCP-Session-ID": "session-123",
      }),
    })
  );
});

test("should include custom headers when provided", async () => {
  const config = {
    remoteUrl: "https://example.com/mcp",
    authType: "password" as const,
    username: "user",
    password: "pass",
    customHeaders: {
      "X-Custom-Header": "custom-value",
    },
  };

  const proxy = new McpProxy(config);

  mockFetch.mockResolvedValue(
    createMockResponse({ result: "ok" }) as any
  );

  await (proxy as any).forwardRequest("test/method");

  expect(mockFetch).toHaveBeenCalledWith(
    "https://example.com/mcp",
    expect.objectContaining({
      headers: expect.objectContaining({
        "X-Custom-Header": "custom-value",
      }),
    })
  );
});

test("should forward request with method and params", async () => {
  const config = {
    remoteUrl: "https://example.com/mcp",
    authType: "password" as const,
    username: "user",
    password: "pass",
  };

  const proxy = new McpProxy(config);
  const params = { name: "test-tool", arguments: {} };

  mockFetch.mockResolvedValue(
    createMockResponse({ content: [] }) as any
  );

  await (proxy as any).forwardRequest("tools/call", params);

  expect(mockFetch).toHaveBeenCalledWith(
    "https://example.com/mcp",
    expect.objectContaining({
      body: expect.stringContaining('"method":"tools/call"'),
    })
  );

  const callArgs = mockFetch.mock.calls[0][1];
  const body = JSON.parse(callArgs?.body as string);
  expect(body.params).toEqual(params);
});

test("should throw error when HTTP response is not ok", async () => {
  const config = {
    remoteUrl: "https://example.com/mcp",
    authType: "password" as const,
    username: "user",
    password: "pass",
  };

  const proxy = new McpProxy(config);

  mockFetch.mockResolvedValue(
    createMockResponse(null, 500, false) as any
  );

  await expect(
    (proxy as any).forwardRequest("test/method")
  ).rejects.toThrow("HTTP 500: Error");
});

test("should throw error when JSON-RPC response contains error", async () => {
  const config = {
    remoteUrl: "https://example.com/mcp",
    authType: "password" as const,
    username: "user",
    password: "pass",
  };

  const proxy = new McpProxy(config);

  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    text: jest.fn().mockResolvedValue(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        error: {
          code: -32600,
          message: "Invalid request",
        },
      })
    ),
    headers: {
      get: jest.fn().mockReturnValue(null),
    },
  } as any);

  await expect(
    (proxy as any).forwardRequest("test/method")
  ).rejects.toThrow("Invalid request");
});

test("should store session ID from response headers", async () => {
  const config = {
    remoteUrl: "https://example.com/mcp",
    authType: "password" as const,
    username: "user",
    password: "pass",
  };

  const proxy = new McpProxy(config);

  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    text: jest.fn().mockResolvedValue(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        result: { capabilities: {} },
      })
    ),
    headers: {
      get: jest.fn((key: string) => 
        key === "mcp-session-id" ? "new-session-123" : null
      ),
    },
  } as any);

  const result = await (proxy as any).forwardRequest("initialize");

  expect((proxy as any).sessionId).toBeUndefined(); // sessionId is only set in initialize handler
  expect(result.responseHeaders.get("mcp-session-id")).toBe("new-session-123");
});

test("should throw error for unsupported auth type", async () => {
  const config = {
    remoteUrl: "https://example.com/mcp",
    authType: "unsupported" as any,
  };

  const proxy = new McpProxy(config);

  await expect(
    (proxy as any).forwardRequest("test/method")
  ).rejects.toThrow("Unsupported auth type: unsupported");
});
