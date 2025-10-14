import cors from "cors";
import express from "express";

import Application from "@rnaga/wp-node/application";

import { initializeOAuthProvider } from "../auth/providers";
import { MemoryCache } from "../cache/memory-cache";
import { getEnv } from "../env";
import { initializeAuthSession } from "../session/auth-session";
import { useDeviceAuth } from "./auth";
import { useOAuthMetadata } from "./middleware";
import { useMcpTransport } from "./transport";
import { Cache } from "../cache/cache";

import { Mcp } from "../../mcp/mcp";
import { Mcps } from "../../mcp/mcps";
import { OAuthProvider } from "../auth/oauth-provider";

export const createHttpServer = (args: {
  cacheClass?: typeof Cache;
  mcps: Mcp[];
  oauthProvider?: typeof OAuthProvider;
}) => {
  Mcps.register(args.mcps);

  const app = express();
  app.use(express.json());

  const cacheClass = (args?.cacheClass || MemoryCache) as typeof Cache;

  // Use app.user to store the WP context in the Express app
  app.use(async (req, res, next) => {
    const wp = await Application.getContext();
    req.wp = wp;
    next();
  });

  const env = getEnv();

  initializeAuthSession(cacheClass);
  initializeOAuthProvider(args.oauthProvider);

  useDeviceAuth(app);

  app.use(useOAuthMetadata());
  useMcpTransport(app, cacheClass);

  app.use(
    cors({
      origin: env.allowedCorsOrigins || "*",
      exposedHeaders: ["Mcp-Session-Id"],
      allowedHeaders: ["Content-Type", "mcp-session-id"],
    })
  );

  return app;
};
