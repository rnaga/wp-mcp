import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { Cache } from "../cache/cache";

import type * as types from "../../types";
let instances = {
  httpSession: null as McpSession<any> | null,
  sseSession: null as McpSession<any> | null,
};

export const initializeMcpSessions = <T extends types.McpSessionDataType>(
  dataType: T,
  clazz: typeof Cache
) => {
  if (dataType === "http-stream") {
    if (!instances.httpSession) {
      instances.httpSession = new McpSession<T>(
        clazz.getInstance<types.McpSessionData<T>>()
      );
    }
    return instances.httpSession;
  } else if (dataType === "sse") {
    if (!instances.sseSession) {
      instances.sseSession = new McpSession<T>(
        clazz.getInstance<types.McpSessionData<T>>()
      );
    }
    return instances.sseSession;
  } else {
    throw new Error(`Unsupported MCP session data type: ${dataType}`);
  }
};

export const getMcpSession = <T extends types.McpSessionDataType>(
  dataType: T
) => {
  if (dataType === "http-stream") {
    if (!instances.httpSession) {
      throw new Error("HTTP MCP Session not initialized");
    }
    return instances.httpSession as McpSession<T>;
  } else if (dataType === "sse") {
    if (!instances.sseSession) {
      throw new Error("SSE MCP Session not initialized");
    }
    return instances.sseSession as McpSession<T>;
  } else {
    throw new Error(`Unsupported MCP session data type: ${dataType}`);
  }
};

export const getTransportMcpSession = async <
  T extends types.McpSessionDataType
>(
  dataType: T,
  sessionId?: string
): Promise<
  T extends "http-stream"
    ? StreamableHTTPServerTransport | undefined
    : SSEServerTransport | undefined
> => {
  const mcpSession = getMcpSession<T>(dataType);
  if (sessionId) {
    return (await mcpSession.getSession(sessionId))
      ?.transport as T extends "http-stream"
      ? StreamableHTTPServerTransport
      : SSEServerTransport;
  }
  return undefined;
};

/**
 * MCP Session ID Manager
 * Manages MCP session identifiers and related data
 */
export class McpSession<T extends types.McpSessionDataType> {
  private cache: Cache<types.McpSessionData<T>>;

  constructor(cache: Cache<types.McpSessionData<T>>) {
    this.cache = cache;
  }

  /**
   * Create session key
   */
  private createSessionKey(sessionId: string): string {
    return this.cache["createKey"]("mcp_session", sessionId);
  }

  /**
   * Store MCP session data
   */
  async storeSession(
    //sessionData: types.McpSessionData<T>,
    sessionId: string,
    transport: T extends "sse"
      ? SSEServerTransport
      : StreamableHTTPServerTransport,
    ttl: number = 60 * 60,
    metadata?: Record<string, any>
  ): Promise<void> {
    const sessionData: types.McpSessionData<T> = {
      sessionId,
      metadata,
      transport,
    } as types.McpSessionData<T>;

    const key = this.createSessionKey(sessionData.sessionId);
    await this.cache.set(key, sessionData, ttl);
  }

  /**
   * Get MCP session data
   */
  async getSession(sessionId: string): Promise<types.McpSessionData<T> | null> {
    const key = this.createSessionKey(sessionId);
    return await this.cache.get(key);
  }

  /**
   * Validate session and check if it's active
   */
  async validateSession(sessionId: string): Promise<boolean> {
    const sessionData = await this.getSession(sessionId);
    return sessionData !== null;
  }

  /**
   * Remove MCP session
   */
  async removeSession(sessionId: string): Promise<boolean> {
    const key = this.createSessionKey(sessionId);
    return await this.cache.remove(key);
  }

  // /**
  //  * Get all active MCP sessions
  //  */
  // async getActiveSessions(): Promise<string[]> {
  //   const keys = await this.cache.keys();
  //   console.log("MCP Session Keys:", keys);
  //   return keys
  //     .filter((key) => key.startsWith("mcp_session:"))
  //     .map((key) => key.replace("mcp_session:", ""));
  // }

  async clear() {
    await this.cache.clear();
  }
}
