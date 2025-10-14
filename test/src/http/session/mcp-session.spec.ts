jest.mock("cache-manager");

import {
  McpSession,
  initializeMcpSessions,
  getMcpSession,
  getTransportMcpSession,
} from "@rnaga/wp-mcp/http/session/mcp-session";
import { MemoryCache } from "@rnaga/wp-mcp/http/cache/memory-cache";
import type * as types from "@rnaga/wp-mcp/types";

// Mock the MCP SDK transports
class MockSSEServerTransport {
  constructor(public id: string = "sse-transport") {}
}

class MockStreamableHTTPServerTransport {
  constructor(public id: string = "http-transport") {}
}

// Mock the instances variable to reset between tests
const originalInstances = (global as any).mcpSessionInstances;

beforeEach(() => {
  // Reset singleton instances before each test
  (global as any).mcpSessionInstances = {
    httpSession: null,
    sseSession: null,
  };
});

afterEach(() => {
  // Restore original instances
  (global as any).mcpSessionInstances = originalInstances;
});

test("McpSession constructor initializes with cache", async () => {
  const cache = MemoryCache.getInstance<types.McpSessionData<"http-stream">>();
  const session = new McpSession<"http-stream">(cache);

  expect(session).toBeInstanceOf(McpSession);
});

test("McpSession storeSession stores session data correctly", async () => {
  const cache = MemoryCache.getInstance<types.McpSessionData<"http-stream">>();
  const session = new McpSession<"http-stream">(cache);
  const transport = new MockStreamableHTTPServerTransport() as any;
  const sessionId = "test-session-123";
  const metadata = { userId: "user123", role: "admin" };

  await session.storeSession(sessionId, transport, 3600, metadata);

  const retrievedSession = await session.getSession(sessionId);
  console.log(retrievedSession);
  expect(retrievedSession).not.toBeNull();
  expect(retrievedSession?.sessionId).toBe(sessionId);
  expect(retrievedSession?.metadata).toEqual(metadata);
  expect(retrievedSession?.transport).toBe(transport);
});

test("McpSession storeSession stores SSE session data correctly", async () => {
  const cache = MemoryCache.getInstance<types.McpSessionData<"sse">>();
  const session = new McpSession<"sse">(cache);
  const transport = new MockSSEServerTransport() as any;
  const sessionId = "sse-session-456";

  await session.storeSession(sessionId, transport, 1800);

  const retrievedSession = await session.getSession(sessionId);
  expect(retrievedSession).not.toBeNull();
  expect(retrievedSession?.sessionId).toBe(sessionId);
  expect(retrievedSession?.transport).toBe(transport);
});

test("McpSession getSession returns null for non-existent session", async () => {
  const cache = MemoryCache.getInstance<types.McpSessionData<"http-stream">>();
  const session = new McpSession<"http-stream">(cache);

  const result = await session.getSession("non-existent-session");
  expect(result).toBeNull();
});

test("McpSession validateSession returns true for existing session", async () => {
  const cache = MemoryCache.getInstance<types.McpSessionData<"http-stream">>();
  const session = new McpSession<"http-stream">(cache);
  const transport = new MockStreamableHTTPServerTransport() as any;
  const sessionId = "valid-session";

  await session.storeSession(sessionId, transport);

  const isValid = await session.validateSession(sessionId);
  expect(isValid).toBe(true);
});

test("McpSession validateSession returns false for non-existent session", async () => {
  const cache = MemoryCache.getInstance<types.McpSessionData<"http-stream">>();
  const session = new McpSession<"http-stream">(cache);

  const isValid = await session.validateSession("invalid-session");
  expect(isValid).toBe(false);
});

test("McpSession removeSession removes existing session", async () => {
  const cache = MemoryCache.getInstance<types.McpSessionData<"http-stream">>();
  const session = new McpSession<"http-stream">(cache);
  const transport = new MockStreamableHTTPServerTransport() as any;
  const sessionId = "session-to-remove";

  await session.storeSession(sessionId, transport);
  expect(await session.validateSession(sessionId)).toBe(true);

  const removed = await session.removeSession(sessionId);
  expect(removed).toBe(true);
  expect(await session.validateSession(sessionId)).toBe(false);
});

test("McpSession clear removes all sessions", async () => {
  const cache = MemoryCache.getInstance<types.McpSessionData<"http-stream">>();
  const session = new McpSession<"http-stream">(cache);
  const transport = new MockStreamableHTTPServerTransport() as any;

  await session.storeSession("session1", transport);
  await session.storeSession("session2", transport);

  expect(await session.getSession("session1")).not.toBeNull();

  await session.clear();

  expect(await session.getSession("session1")).toBeNull();
  expect(await session.getSession("session2")).toBeNull();
});

test("initializeMcpSessions creates HTTP session singleton", () => {
  const httpSession = initializeMcpSessions("http-stream", MemoryCache);
  expect(httpSession).toBeInstanceOf(McpSession);

  // Test singleton behavior
  const httpSession2 = initializeMcpSessions("http-stream", MemoryCache);
  expect(httpSession2).toBe(httpSession);
});

test("initializeMcpSessions creates SSE session singleton", () => {
  const sseSession = initializeMcpSessions("sse", MemoryCache);
  expect(sseSession).toBeInstanceOf(McpSession);

  // Test singleton behavior
  const sseSession2 = initializeMcpSessions("sse", MemoryCache);
  expect(sseSession2).toBe(sseSession);
});

test("initializeMcpSessions throws error for unsupported session type", () => {
  expect(() => {
    initializeMcpSessions("invalid-type" as any, MemoryCache);
  }).toThrow("Unsupported MCP session data type: invalid-type");
});

test("getMcpSession returns initialized HTTP session", () => {
  const httpSession = initializeMcpSessions("http-stream", MemoryCache);
  const retrievedSession = getMcpSession("http-stream");

  expect(retrievedSession).toBe(httpSession);
});

test("getMcpSession returns initialized SSE session", () => {
  const sseSession = initializeMcpSessions("sse", MemoryCache);
  const retrievedSession = getMcpSession("sse");

  expect(retrievedSession).toBe(sseSession);
});

test("getMcpSession throws error for unsupported session type", () => {
  expect(() => {
    getMcpSession("invalid-type" as any);
  }).toThrow("Unsupported MCP session data type: invalid-type");
});

test("getTransportMcpSession returns transport for existing session", async () => {
  const httpSession = initializeMcpSessions("http-stream", MemoryCache);
  const transport = new MockStreamableHTTPServerTransport() as any;
  const sessionId = "transport-test-session";

  await httpSession.storeSession(sessionId, transport);

  const retrievedTransport = await getTransportMcpSession(
    "http-stream",
    sessionId
  );
  expect(retrievedTransport).toBe(transport);
});

test("getTransportMcpSession returns undefined for non-existent session", async () => {
  initializeMcpSessions("http-stream", MemoryCache);

  const retrievedTransport = await getTransportMcpSession(
    "http-stream",
    "non-existent"
  );
  expect(retrievedTransport).toBeUndefined();
});

test("getTransportMcpSession returns undefined when no sessionId provided", async () => {
  initializeMcpSessions("http-stream", MemoryCache);

  const retrievedTransport = await getTransportMcpSession("http-stream");
  expect(retrievedTransport).toBeUndefined();
});

test("getTransportMcpSession works with SSE sessions", async () => {
  const sseSession = initializeMcpSessions("sse", MemoryCache);
  const transport = new MockSSEServerTransport() as any;
  const sessionId = "sse-transport-test";

  await sseSession.storeSession(sessionId, transport);

  const retrievedTransport = await getTransportMcpSession("sse", sessionId);
  expect(retrievedTransport).toBe(transport);
});

test("McpSession handles default TTL when not provided", async () => {
  const cache = MemoryCache.getInstance<types.McpSessionData<"http-stream">>();
  const session = new McpSession<"http-stream">(cache);
  const transport = new MockStreamableHTTPServerTransport() as any;
  const sessionId = "default-ttl-session";

  // Store without explicit TTL (should use default)
  await session.storeSession(sessionId, transport);

  const retrievedSession = await session.getSession(sessionId);
  expect(retrievedSession).not.toBeNull();
  expect(retrievedSession?.sessionId).toBe(sessionId);
});

test("McpSession createSessionKey creates proper key format", async () => {
  const cache = MemoryCache.getInstance<types.McpSessionData<"http-stream">>();
  const session = new McpSession<"http-stream">(cache);

  // Access private method through bracket notation for testing
  const sessionKey = (session as any).createSessionKey("test-session");
  expect(sessionKey).toBe("mcp_session:test-session");
});
