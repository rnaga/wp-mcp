// Mock dependencies before imports
jest.mock("node-fetch");
jest.mock("@modelcontextprotocol/sdk/server/sse.js");
jest.mock("@modelcontextprotocol/sdk/server/streamableHttp.js");
jest.mock("@modelcontextprotocol/sdk/types.js");
jest.mock("../../../../src/logger");
jest.mock("../../../../src/mcp");
jest.mock("../../../../src/http/cache/cache");
jest.mock("../../../../src/http/env");
jest.mock("../../../../src/http/session/auth-session");
jest.mock("../../../../src/http/session/mcp-session");
jest.mock("../../../../src/http/express/middleware");

jest.setTimeout(10000);

import express from "express";
import request from "supertest";
import { useMcpTransport } from "../../../../src/http/express/transport";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { Mcps } from "../../../../src/mcp";
import { Cache } from "../../../../src/http/cache/cache";
import { getEnv } from "../../../../src/http/env";
import { initializeAuthSession } from "../../../../src/http/session/auth-session";
import {
  getMcpSession,
  getTransportMcpSession,
  initializeMcpSessions,
} from "../../../../src/http/session/mcp-session";
import {
  authenticate,
  validateMcpSession,
} from "../../../../src/http/express/middleware";

const MockCache = Cache as jest.Mocked<typeof Cache>;

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.wp = {} as any;
    req.username = "testuser";
    next();
  });
  return app;
};

test("should initialize MCP transport with cache class", () => {
  const app = createApp();
  (initializeAuthSession as jest.Mock).mockReturnValue(undefined);
  (initializeMcpSessions as jest.Mock).mockReturnValue(undefined);

  useMcpTransport(app, MockCache);

  expect(initializeAuthSession).toHaveBeenCalledWith(MockCache);
  expect(initializeMcpSessions).toHaveBeenCalledWith("http-stream", MockCache);
  expect(initializeMcpSessions).toHaveBeenCalledWith("sse", MockCache);
});

test("should handle HTTP stream POST with existing session", async () => {
  const mockTransport = {
    handleRequest: jest.fn().mockImplementation((_req, res) => {
      res.status(200).json({ result: "ok" });
    }),
  };
  (getTransportMcpSession as jest.Mock).mockResolvedValue(mockTransport);
  (authenticate as jest.Mock).mockImplementation((_req, _res, next) => next());

  const app = createApp();
  useMcpTransport(app, MockCache);

  const response = await request(app)
    .post("/mcp")
    .set("mcp-session-id", "session123")
    .send({ jsonrpc: "2.0", method: "test" });

  expect(getTransportMcpSession).toHaveBeenCalledWith(
    "http-stream",
    "session123"
  );
  expect(mockTransport.handleRequest).toHaveBeenCalled();
  expect(response.status).toBe(200);
});

test("should return 400 when no session ID and not initialize request", async () => {
  (getTransportMcpSession as jest.Mock).mockResolvedValue(null);
  (isInitializeRequest as unknown as jest.Mock).mockReturnValue(false);
  (authenticate as jest.Mock).mockImplementation((_req, _res, next) => next());

  const app = createApp();
  useMcpTransport(app, MockCache);

  const response = await request(app)
    .post("/mcp")
    .send({ jsonrpc: "2.0", method: "test" });

  expect(response.status).toBe(400);
  expect(response.body.error.message).toBe(
    "Bad Request: No valid session ID provided"
  );
});

test("should create new HTTP stream session on initialize request", async () => {
  const mockTransport = {
    handleRequest: jest.fn().mockImplementation((_req, res) => {
      res.status(200).json({ result: "initialized" });
    }),
    onclose: undefined,
    sessionId: "new-session-123",
  };
  const mockMcpSession = {
    storeSession: jest.fn(),
    removeSession: jest.fn(),
  };
  const mockServer = {
    connect: jest.fn().mockResolvedValue(undefined),
  };

  (getTransportMcpSession as jest.Mock).mockResolvedValue(null);
  (isInitializeRequest as unknown as jest.Mock).mockReturnValue(true);
  (getMcpSession as jest.Mock).mockReturnValue(mockMcpSession);
  (StreamableHTTPServerTransport as jest.Mock).mockImplementation((config) => {
    mockTransport.onclose = config.onclose;
    setTimeout(() => {
      const sessionId = config.sessionIdGenerator();
      config.onsessioninitialized(sessionId);
    }, 0);
    return mockTransport;
  });
  (Mcps.createServer as jest.Mock).mockReturnValue(mockServer);
  (Mcps.initServer as jest.Mock).mockResolvedValue(undefined);
  (getEnv as jest.Mock).mockReturnValue({
    enableDnsRebindingProtection: false,
    allowedHostnames: ["example.com"],
  });
  (authenticate as jest.Mock).mockImplementation((_req, _res, next) => next());

  const app = createApp();
  useMcpTransport(app, MockCache);

  const response = await request(app)
    .post("/mcp")
    .send({ jsonrpc: "2.0", method: "initialize" });

  expect(StreamableHTTPServerTransport).toHaveBeenCalled();
  expect(Mcps.createServer).toHaveBeenCalled();
  expect(mockServer.connect).toHaveBeenCalledWith(mockTransport);
  expect(response.status).toBe(200);
});

test("should handle HTTP stream GET request", async () => {
  (authenticate as jest.Mock).mockImplementation((_req, _res, next) => next());
  (validateMcpSession as jest.Mock).mockImplementation((_req, res) => {
    res.status(200).send("ok");
  });

  const app = createApp();
  useMcpTransport(app, MockCache);

  const response = await request(app)
    .get("/mcp")
    .set("mcp-session-id", "session123");

  expect(validateMcpSession).toHaveBeenCalled();
  expect(response.status).toBe(200);
});

test("should handle HTTP stream DELETE request", async () => {
  (authenticate as jest.Mock).mockImplementation((_req, _res, next) => next());
  (validateMcpSession as jest.Mock).mockImplementation((_req, res) => {
    res.status(200).send("deleted");
  });

  const app = createApp();
  useMcpTransport(app, MockCache);

  const response = await request(app)
    .delete("/mcp")
    .set("mcp-session-id", "session123");

  expect(validateMcpSession).toHaveBeenCalled();
  expect(response.status).toBe(200);
});

test("should initialize SSE transport when useMcpTransport is called", () => {
  const app = express();
  app.use(express.json());
  (initializeAuthSession as jest.Mock).mockClear();
  (initializeMcpSessions as jest.Mock).mockClear();

  useMcpTransport(app, MockCache);

  // Verify SSE session was initialized
  expect(initializeMcpSessions).toHaveBeenCalledWith("sse", MockCache);
  expect(initializeMcpSessions).toHaveBeenCalledWith("http-stream", MockCache);
});

test("should handle SSE POST messages with valid session", async () => {
  const mockTransport = {
    handlePostMessage: jest.fn().mockImplementation((_req, res) => {
      res.status(200).json({ result: "message handled" });
    }),
  };

  (getTransportMcpSession as jest.Mock).mockResolvedValue(mockTransport);

  const app = createApp();
  useMcpTransport(app, MockCache);

  const response = await request(app)
    .post("/messages?sessionId=sse-session-123")
    .send({ jsonrpc: "2.0", method: "test" });

  expect(getTransportMcpSession).toHaveBeenCalledWith("sse", "sse-session-123");
  expect(mockTransport.handlePostMessage).toHaveBeenCalled();
  expect(response.status).toBe(200);
});

test("should return 400 for SSE POST with invalid session", async () => {
  (getTransportMcpSession as jest.Mock).mockResolvedValue(null);

  const app = createApp();
  useMcpTransport(app, MockCache);

  const response = await request(app)
    .post("/messages?sessionId=invalid-session")
    .send({ jsonrpc: "2.0", method: "test" });

  expect(response.status).toBe(400);
  expect(response.text).toBe("No transport found for sessionId");
});

test("should cleanup transport on close", async () => {
  const mockMcpSession = {
    storeSession: jest.fn(),
    removeSession: jest.fn(),
  };
  let oncloseCallback: (() => void) | undefined;

  const mockTransport = {
    handleRequest: jest.fn().mockImplementation((_req, res) => {
      res.status(200).json({ result: "ok" });
    }),
    onclose: undefined,
    sessionId: "session-to-cleanup",
  };

  (getTransportMcpSession as jest.Mock).mockResolvedValue(null);
  (isInitializeRequest as unknown as jest.Mock).mockReturnValue(true);
  (getMcpSession as jest.Mock).mockReturnValue(mockMcpSession);
  (StreamableHTTPServerTransport as jest.Mock).mockImplementation((config) => {
    oncloseCallback = () => {
      if (mockTransport.onclose) {
        mockTransport.onclose();
      }
    };
    mockTransport.onclose = config.onclose;
    setTimeout(() => {
      const sessionId = config.sessionIdGenerator();
      config.onsessioninitialized(sessionId);
    }, 0);
    return mockTransport;
  });
  (Mcps.createServer as jest.Mock).mockReturnValue({
    connect: jest.fn().mockResolvedValue(undefined),
  });
  (Mcps.initServer as jest.Mock).mockResolvedValue(undefined);
  (getEnv as jest.Mock).mockReturnValue({});
  (authenticate as jest.Mock).mockImplementation((_req, _res, next) => next());

  const app = createApp();
  useMcpTransport(app, MockCache);

  await request(app)
    .post("/mcp")
    .send({ jsonrpc: "2.0", method: "initialize" });

  // Simulate close
  if (oncloseCallback) {
    oncloseCallback();
  }

  expect(mockMcpSession.removeSession).toHaveBeenCalledWith(
    "session-to-cleanup"
  );
});
