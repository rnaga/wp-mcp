import { CacheValue } from "./cache";
import { AuthorizationHandlerOptions } from "@modelcontextprotocol/sdk/server/auth/handlers/authorize.js";
import { ClientRegistrationHandlerOptions } from "@modelcontextprotocol/sdk/server/auth/handlers/register.js";
import { RevocationHandlerOptions } from "@modelcontextprotocol/sdk/server/auth/handlers/revoke.js";
import { TokenHandlerOptions } from "@modelcontextprotocol/sdk/server/auth/handlers/token.js";
import { ProxyOAuthServerProvider } from "@modelcontextprotocol/sdk/server/auth/providers/proxyProvider.js";
import { ProxyEndpoints } from "@modelcontextprotocol/sdk/server/auth/providers/proxyProvider.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { Context } from "@rnaga/wp-node/core/context";

declare global {
  namespace Express {
    interface Request {
      wp: Context;
      username?: string;
    }
  }
}

export type OAuthMetadataOptions = {
  // issuerUrl: string;
  resourceUrl: string;
  resourceName?: string;
  scopesSupported: string[];
  serviceDocumentationUrl?: string;
  endpoints: ProxyEndpoints;
};

export type OAuthClientOptions = {
  clientId?: string;
  clientSecret?: string;
  grantTypes?: string[];
};

type AuthRouterOptions = {
  provider: ProxyOAuthServerProvider;
  authorizationOptions?: Omit<AuthorizationHandlerOptions, "provider">;
  clientRegistrationOptions?: Omit<
    ClientRegistrationHandlerOptions,
    "clientsStore"
  >;
  revocationOptions?: Omit<RevocationHandlerOptions, "provider">;
  tokenOptions?: Omit<TokenHandlerOptions, "provider">;
};

export type McpSessionDataType = "sse" | "http-stream";

export type McpSessionData<T extends McpSessionDataType = "http-stream"> =
  CacheValue & {
    sessionId: string;
    metadata?: Record<string, any>;
    transport: T extends "sse"
      ? SSEServerTransport
      : StreamableHTTPServerTransport;
  };
