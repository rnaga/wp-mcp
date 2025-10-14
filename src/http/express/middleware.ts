import express, { RequestHandler } from "express";

import {
  InvalidTokenError,
  ServerError,
} from "@modelcontextprotocol/sdk/server/auth/errors.js";
import { metadataHandler } from "@modelcontextprotocol/sdk/server/auth/handlers/metadata.js";

import { logger } from "../../logger";
import { getProtectedResourceMetadata } from "../auth/oauth-metadata";
import { PasswordProvider } from "../auth/password-provider";
import { getOAuthProvider } from "../auth/providers";
import { getEnv } from "../env";
import { getTransportMcpSession } from "../session/mcp-session";
import { checkSecureUrl } from "../utils";

import type * as wpCoreTypes from "@rnaga/wp-node/types";

// Resource Server middleware - returns 401 for API endpoints expecting Bearer tokens or API keys
export const authenticate = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  try {
    // Get WP Context
    const wp = req.wp;
    if (!wp) {
      throw new ServerError("WP Context not available in request");
    }

    const header = req.headers.authorization;
    if (!header) {
      throw new InvalidTokenError("Missing Authorization header");
    }

    const [type, token] = header.split(" ");
    let wpUser: wpCoreTypes.WpUsers | undefined = undefined;

    switch (type.toLowerCase()) {
      case "basic":
        // This is application password, decode and verify
        const decoded = Buffer.from(token, "base64").toString("utf-8");
        const [username, password] = decoded.split(":");

        const passwordProvider = new PasswordProvider();
        wpUser = await passwordProvider.authenticate(wp, username, password);

        if (!wpUser) {
          throw new InvalidTokenError("Invalid username or password");
        }

        // Assume user
        await wp.current.assumeUser(wpUser?.ID || 0);

        req.username = wpUser.user_login;

        break;
      case "bearer":
        if (!token) {
          throw new InvalidTokenError(
            `Invalid Authorization header format, expected 'Bearer TOKEN'`
          );
        }

        // TODO: add validation here if you need to verify access token
        const provider = getOAuthProvider();
        if (!provider) {
          throw new InvalidTokenError("No OAuth provider configured");
        }

        wpUser = await provider.authenticate(wp, token);

        if (!wpUser) {
          throw new InvalidTokenError("Invalid token");
        }

        // Assume user
        await wp.current.assumeUser(wpUser.ID);

        req.username = wpUser.user_login;

        break;

      default:
        throw new InvalidTokenError(`Unsupported authorization type: ${type}`);
    }

    next();
  } catch (error) {
    const env = getEnv();
    if (error instanceof InvalidTokenError) {
      // RFC 6750 Standard Parameters for WWW-Authenticate header
      // https://datatracker.ietf.org/doc/html/rfc6750#section-3
      // The WWW-Authenticate header field indicates the authentication scheme(s)
      // and parameters applicable to the target resource. For OAuth 2.0 Bearer tokens,
      // it includes error codes, descriptions, and optional parameters like
      // authorization_uri and scope to help clients recover from authentication failures.
      res.set(
        "WWW-Authenticate",
        `Bearer error="${error.errorCode}", error_description="${error.message}"` +
          `, authorization_uri="${env.authorizationUrl}"` +
          `, scope="${env.scopesSupported?.join(" ")}"`
      );
      res.status(401).json(error.toResponseObject());
    } else {
      logger.error("Unexpected error authenticating bearer token:", error);
      res
        .status(500)
        .json(new ServerError("Internal Server Error").toResponseObject());
    }
  }
};

export const validateMcpSession = async (
  req: express.Request,
  res: express.Response
) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId) {
    // || !transportsMCP[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }

  const transport = await getTransportMcpSession("http-stream", sessionId);
  if (!transport) {
    res.status(400).send("Invalid MCP session transport");
    return;
  }

  await transport.handleRequest(req, res);
};

export const useOAuthMetadata = (): RequestHandler => {
  const router = express.Router();
  const env = getEnv();

  if (!env.resourceUrl || !env.authorizationUrl) {
    logger.info(
      "OAuth Resource URL or Authorization URL not configured, skipping OAuth metadata endpoints"
    );
    return router;
  }

  checkSecureUrl(env.resourceUrl);

  const protectedResourceMetadata = getProtectedResourceMetadata();

  router.use(
    "/.well-known/oauth-protected-resource",
    metadataHandler(protectedResourceMetadata)
  );

  return router;
};
