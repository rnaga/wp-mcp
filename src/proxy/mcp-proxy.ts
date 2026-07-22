import fetch from "../fetch";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  CompleteRequestSchema,
  GetPromptRequestSchema,
  InitializeRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  SetLevelRequestSchema,
  SubscribeRequestSchema,
  UnsubscribeRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { mcpLogger } from "../logger";
import { getSecret } from "../secret-store";
import { PROTOCOL_VERSION, SERVER_NAME, SERVER_VERSION } from "./constants";
import { hasJsonRpcError, validateJsonRpcResponse } from "./json-rpc-parser";
import { parseResponseBody, safeJSONParse } from "./response-parser";

import type * as types from "../types";

export class McpProxy {
  private server: Server;
  private config: types.GetConfig;
  private sessionId: string | undefined = undefined; // This is needed to generate unique IDs for JSON-RPC requests

  private secret: types.Secret | undefined = undefined;

  constructor(config: types.GetConfig) {
    this.config = config;
    this.server = new Server(
      {
        name: SERVER_NAME,
        version: SERVER_VERSION,
      },
      {
        capabilities: {
          // We'll dynamically populate capabilities from the target server
          completions: {},
          logging: {},
          prompts: {},
          resources: {},
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  async forwardRequest(
    method: string,
    params?: any
  ): Promise<{
    jsonResponse: Record<string, any>;
    responseHeaders: any;
  }> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      // should accept JSON response per MCP spec
      Accept: "application/json, text/event-stream",
    };

    // Check and set secret if not already set
    if (!this.secret) {
      this.secret = await getSecret();
    }

    // Get auth type from config
    const authType = this.config.authType || "password";
    switch (authType) {
      case "oauth":
        // Get Auth Token from secret store
        const accessToken = this.secret?.remote?.oauth?.access_token;
        if (accessToken) {
          headers["Authorization"] = `Bearer ${accessToken}`;
        }
        break;
      case "password":
        // Basic Auth with username and password from config
        if (this.config.username && this.config.password) {
          const basicAuth = Buffer.from(
            `${this.config.username}:${this.config.password}`
          ).toString("base64");
          headers["Authorization"] = `Basic ${basicAuth}`;
        }
        break;
      default:
        throw new Error(`Unsupported auth type: ${authType}`);
    }

    // Send session ID if available
    if (this.sessionId) {
      headers["MCP-Session-ID"] = `${this.sessionId}`;
    }

    // Add any custom headers
    if (this.config.customHeaders) {
      Object.assign(headers, this.config.customHeaders);
    }

    const body = {
      jsonrpc: "2.0",
      id: Date.now(),
      method: method,
      params: params || {},
    };

    try {
      const response = await fetch(this.config.remoteUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      const rawText = await response.text();
      mcpLogger.debug(
        "Raw response text:",
        "status",
        response.status,
        "ok",
        response.ok,
        "request:",
        body,
        "response:",
        rawText
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Parse response body (handles both SSE and JSON formats)
      const jsonData = parseResponseBody(rawText);
      const rawJson: unknown = safeJSONParse(jsonData);

      mcpLogger.debug("Parsed JSON response:", rawJson);

      const jsonResponse: types.JsonRpcResponse =
        validateJsonRpcResponse(rawJson);

      if (hasJsonRpcError(jsonResponse)) {
        throw new Error(
          jsonResponse.error.message || "Unknown error from server"
        );
      }

      mcpLogger.debug("Final JSON-RPC result:", jsonResponse.result);

      return {
        jsonResponse: jsonResponse.result,
        responseHeaders: response.headers,
      };
    } catch (error) {
      mcpLogger.warn(
        `Error forwarding request to ${this.config.remoteUrl}:`,
        "request:",
        JSON.stringify(body, null, 2),
        "error:",
        error
      );
      throw error;
    }
  }

  private setupHandlers() {
    // Initialize handler - get capabilities from target server
    this.server.setRequestHandler(InitializeRequestSchema, async (request) => {
      try {
        const { jsonResponse, responseHeaders } = await this.forwardRequest(
          "initialize",
          request.params
        );
        // Store any session-related headers if needed
        this.sessionId = responseHeaders.get("mcp-session-id");
        return jsonResponse;
      } catch (error) {
        mcpLogger.error("Failed to initialize target server:", error);
        // Return basic capabilities if target server fails
        return {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: {
            logging: {},
            prompts: {},
            resources: {},
            tools: {},
          },
          serverInfo: {
            name: SERVER_NAME,
            version: SERVER_VERSION,
          },
        };
      }
    });

    // Tools handlers
    this.server.setRequestHandler(ListToolsRequestSchema, async (request) => {
      return (await this.forwardRequest("tools/list", request.params))
        .jsonResponse;
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      return (await this.forwardRequest("tools/call", request.params))
        .jsonResponse;
    });

    // Resources handlers
    this.server.setRequestHandler(
      ListResourcesRequestSchema,
      async (request) => {
        return (await this.forwardRequest("resources/list", request.params))
          .jsonResponse;
      }
    );

    this.server.setRequestHandler(
      ListResourceTemplatesRequestSchema,
      async (request) => {
        return (
          await this.forwardRequest("resources/templates/list", request.params)
        ).jsonResponse;
      }
    );

    this.server.setRequestHandler(
      ReadResourceRequestSchema,
      async (request) => {
        return (await this.forwardRequest("resources/read", request.params))
          .jsonResponse;
      }
    );

    this.server.setRequestHandler(SubscribeRequestSchema, async (request) => {
      return (await this.forwardRequest("resources/subscribe", request.params))
        .jsonResponse;
    });

    this.server.setRequestHandler(UnsubscribeRequestSchema, async (request) => {
      return (
        await this.forwardRequest("resources/unsubscribe", request.params)
      ).jsonResponse;
    });

    // Prompts handlers
    this.server.setRequestHandler(ListPromptsRequestSchema, async (request) => {
      return (await this.forwardRequest("prompts/list", request.params))
        .jsonResponse;
    });

    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      return (await this.forwardRequest("prompts/get", request.params))
        .jsonResponse;
    });

    // Logging handler
    this.server.setRequestHandler(SetLevelRequestSchema, async (request) => {
      return (await this.forwardRequest("logging/setLevel", request.params))
        .jsonResponse;
    });

    this.server.setRequestHandler(CompleteRequestSchema, async (request) => {
      return (await this.forwardRequest("completion/complete", request.params))
        .jsonResponse;
    });

    // Note: If more handlers are needed, add them here
  }

  async start() {
    const transport = new StdioServerTransport();

    await this.server.connect(transport);

    mcpLogger.info(
      `MCP Proxy started. Forwarding requests to: ${this.config.remoteUrl}`
    );
  }
}
