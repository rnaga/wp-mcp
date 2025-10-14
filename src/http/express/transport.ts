import { randomUUID } from "crypto";
import express from "express";

import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

import { logger } from "../../logger";
import { Mcps } from "../../mcp";
import { Cache } from "../cache/cache";
import { getEnv } from "../env";
import { initializeAuthSession } from "../session/auth-session";
import {
  getMcpSession,
  getTransportMcpSession,
  initializeMcpSessions,
} from "../session/mcp-session";
import { authenticate, validateMcpSession } from "./middleware";

const REQUEST_PATH_HTTP_STREAM = "/mcp";
const REQUEST_PATH_SSE = "/sse";
const REQUEST_PATH_SEE_MESSAGES = "/messages";

export const useMcpTransport = (
  app: express.Express,
  cacheClass: typeof Cache
) => {
  initializeAuthSession(cacheClass);

  useHttpStream(app, cacheClass);
  useSse(app, cacheClass);
};

const useHttpStream = (app: express.Express, cacheClass: typeof Cache) => {
  initializeMcpSessions("http-stream", cacheClass);

  // Handle POST requests for client-to-server communication
  app.post(REQUEST_PATH_HTTP_STREAM, authenticate, async (req, res) => {
    const env = getEnv();

    // Check for existing session ID
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let transport = await getTransportMcpSession("http-stream", sessionId);

    if (!transport && !sessionId && !isInitializeRequest(req.body)) {
      // Invalid request
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Bad Request: No valid session ID provided",
        },
        id: null,
      });
      return;
    }

    if (transport) {
      transport.handleRequest(req, res, req.body);
      return;
    }

    const mcpSessions = getMcpSession("http-stream");

    // New initialization request
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId) => {
        // Store the transport by session ID
        //transportsMCP[sessionId] = transport;
        logger.debug("Storing new MCP session:", sessionId);

        mcpSessions.storeSession(sessionId, transport!);
      },
      // DNS rebinding protection is disabled by default for backwards compatibility. If you are running this server
      // locally, make sure to set:
      enableDnsRebindingProtection: env.enableDnsRebindingProtection ?? false,
      allowedHosts: ["127.0.0.1", "localhost", ...(env.allowedHostnames || [])],
    });

    // Clean up transport when closed
    transport.onclose = () => {
      if (transport?.sessionId) {
        mcpSessions.removeSession(transport.sessionId);
        //delete transportsMCP[transport.sessionId];
      }
    };

    const server = Mcps.createServer();
    await Mcps.initServer(server, req.wp, req.username);

    // Connect to the MCP server
    await server.connect(transport);

    // Handle the request
    await transport.handleRequest(req, res, req.body);
  });

  // Handle GET requests for server-to-client notifications via SSE
  app.get(REQUEST_PATH_HTTP_STREAM, authenticate, validateMcpSession);

  // Handle DELETE requests for session termination
  app.delete(REQUEST_PATH_HTTP_STREAM, authenticate, validateMcpSession);
};

const useSse = (app: express.Express, cacheClass: typeof Cache) => {
  initializeMcpSessions("sse", cacheClass);

  // Legacy SSE endpoint for older clients
  app.get(REQUEST_PATH_SSE, authenticate, async (req, res) => {
    // Create SSE transport for legacy clients
    const transport = new SSEServerTransport(REQUEST_PATH_SEE_MESSAGES, res);
    const sseSessions = getMcpSession("sse");

    sseSessions.storeSession(transport.sessionId, transport);

    res.on("close", () => {
      sseSessions.removeSession(transport.sessionId);
    });

    const server = Mcps.createServer();
    await Mcps.initServer(server, req.wp, req.username);

    await server.connect(transport);
  });

  app.post(REQUEST_PATH_SEE_MESSAGES, async (req, res) => {
    const sessionId = req.query.sessionId as string;
    const transport = await getTransportMcpSession("sse", sessionId);

    if (transport) {
      await transport.handlePostMessage(req, res, req.body);
    } else {
      res.status(400).send("No transport found for sessionId");
    }
  });
};
