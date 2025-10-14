// Mock dependencies before imports
jest.mock("node-fetch");
jest.mock("@modelcontextprotocol/sdk/server/auth/handlers/metadata.js");
jest.mock("../../../../src/logger");
jest.mock("../../../../src/http/auth/oauth-metadata");
jest.mock("../../../../src/http/auth/password-provider");
jest.mock("../../../../src/http/auth/providers");
jest.mock("../../../../src/http/env");
jest.mock("../../../../src/http/session/mcp-session");
jest.mock("../../../../src/http/utils");

import express from "express";
import request from "supertest";
import {
  authenticate,
  validateMcpSession,
  useOAuthMetadata,
} from "../../../../src/http/express/middleware";
import { PasswordProvider } from "../../../../src/http/auth/password-provider";
import { getOAuthProvider } from "../../../../src/http/auth/providers";
import { getEnv } from "../../../../src/http/env";
import { getTransportMcpSession } from "../../../../src/http/session/mcp-session";

const createMockWpContext = () => ({
  current: {
    assumeUser: jest.fn().mockResolvedValue(undefined),
  },
});

test("should authenticate with basic auth successfully", async () => {
  const mockWpUser = { ID: 1, user_login: "testuser" };
  (PasswordProvider as jest.Mock).mockImplementation(() => ({
    authenticate: jest.fn().mockResolvedValue(mockWpUser),
  }));

  const app = express();
  app.use((req, _res, next) => {
    req.wp = createMockWpContext() as any;
    next();
  });
  app.use(authenticate);
  app.get("/test", (req, res) => res.json({ username: req.username }));

  const credentials = Buffer.from("testuser:password123").toString("base64");
  const response = await request(app)
    .get("/test")
    .set("Authorization", `Basic ${credentials}`);

  expect(response.status).toBe(200);
  expect(response.body).toEqual({ username: "testuser" });
});

test("should authenticate with bearer token successfully", async () => {
  const mockWpUser = { ID: 1, user_login: "testuser" };
  const mockProvider = {
    authenticate: jest.fn().mockResolvedValue(mockWpUser),
  };
  (getOAuthProvider as jest.Mock).mockReturnValue(mockProvider);

  const app = express();
  app.use((req, _res, next) => {
    req.wp = createMockWpContext() as any;
    next();
  });
  app.use(authenticate);
  app.get("/test", (req, res) => res.json({ username: req.username }));

  const response = await request(app)
    .get("/test")
    .set("Authorization", "Bearer token123");

  expect(response.status).toBe(200);
  expect(response.body).toEqual({ username: "testuser" });
});

test("should return 401 when authorization header is missing", async () => {
  (getEnv as jest.Mock).mockReturnValue({
    authorizationUrl: "https://example.com/auth",
    scopesSupported: ["read", "write"],
  });

  const app = express();
  app.use((req, _res, next) => {
    req.wp = createMockWpContext() as any;
    next();
  });
  app.use(authenticate);
  app.get("/test", (_req, res) => res.json({ ok: true }));

  const response = await request(app).get("/test");

  expect(response.status).toBe(401);
  expect(response.body.error).toBe("invalid_token");
});

test("should return 401 when basic auth credentials are invalid", async () => {
  (PasswordProvider as jest.Mock).mockImplementation(() => ({
    authenticate: jest.fn().mockResolvedValue(null),
  }));
  (getEnv as jest.Mock).mockReturnValue({
    authorizationUrl: "https://example.com/auth",
    scopesSupported: ["read"],
  });

  const app = express();
  app.use((req, _res, next) => {
    req.wp = createMockWpContext() as any;
    next();
  });
  app.use(authenticate);
  app.get("/test", (_req, res) => res.json({ ok: true }));

  const credentials = Buffer.from("wrong:password").toString("base64");
  const response = await request(app)
    .get("/test")
    .set("Authorization", `Basic ${credentials}`);

  expect(response.status).toBe(401);
});

test("should return 401 when bearer token is invalid", async () => {
  const mockProvider = {
    authenticate: jest.fn().mockResolvedValue(null),
  };
  (getOAuthProvider as jest.Mock).mockReturnValue(mockProvider);
  (getEnv as jest.Mock).mockReturnValue({
    authorizationUrl: "https://example.com/auth",
    scopesSupported: ["read"],
  });

  const app = express();
  app.use((req, _res, next) => {
    req.wp = createMockWpContext() as any;
    next();
  });
  app.use(authenticate);
  app.get("/test", (_req, res) => res.json({ ok: true }));

  const response = await request(app)
    .get("/test")
    .set("Authorization", "Bearer invalidtoken");

  expect(response.status).toBe(401);
});

test("should return 401 when OAuth provider is not configured", async () => {
  (getOAuthProvider as jest.Mock).mockReturnValue(null);
  (getEnv as jest.Mock).mockReturnValue({
    authorizationUrl: "https://example.com/auth",
    scopesSupported: ["read"],
  });

  const app = express();
  app.use((req, _res, next) => {
    req.wp = createMockWpContext() as any;
    next();
  });
  app.use(authenticate);
  app.get("/test", (_req, res) => res.json({ ok: true }));

  const response = await request(app)
    .get("/test")
    .set("Authorization", "Bearer token123");

  expect(response.status).toBe(401);
});

test("should return 401 for unsupported authorization type", async () => {
  (getEnv as jest.Mock).mockReturnValue({
    authorizationUrl: "https://example.com/auth",
    scopesSupported: ["read"],
  });

  const app = express();
  app.use((req, _res, next) => {
    req.wp = createMockWpContext() as any;
    next();
  });
  app.use(authenticate);
  app.get("/test", (_req, res) => res.json({ ok: true }));

  const response = await request(app)
    .get("/test")
    .set("Authorization", "Digest abc123");

  expect(response.status).toBe(401);
});

test("should return 400 when session ID is missing", async () => {
  const app = express();
  app.post("/message", validateMcpSession);

  const response = await request(app).post("/message");

  expect(response.status).toBe(400);
  expect(response.text).toBe("Invalid or missing session ID");
});

test("should return 400 when MCP session transport is invalid", async () => {
  (getTransportMcpSession as jest.Mock).mockResolvedValue(null);

  const app = express();
  app.post("/message", validateMcpSession);

  const response = await request(app)
    .post("/message")
    .set("mcp-session-id", "invalid-session");

  expect(response.status).toBe(400);
  expect(response.text).toBe("Invalid MCP session transport");
});

test("should handle MCP session request successfully", async () => {
  const mockTransport = {
    handleRequest: jest.fn().mockImplementation((_req, res) => {
      res.status(200).json({ ok: true });
    }),
  };
  (getTransportMcpSession as jest.Mock).mockResolvedValue(mockTransport);

  const app = express();
  app.post("/message", validateMcpSession);

  const response = await request(app)
    .post("/message")
    .set("mcp-session-id", "valid-session");

  expect(mockTransport.handleRequest).toHaveBeenCalled();
  expect(response.status).toBe(200);
});
