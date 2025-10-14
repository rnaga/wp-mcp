import { z } from "zod";

import { Config, StorageConfig } from "../config";
import { mcpLogger } from "../logger";
import { getSecret, loadSecret } from "../secret-store";
import * as vals from "../validators";

import type * as types from "../types";

const STORAGE_CONFIG: StorageConfig = {
  // NO sqlite records for proxy config
  sqlite: [],
  env: ["remoteUrl", "authType", "username", "password", "customHeaders"],
};

const ENV_VAR_MAP: Record<string, string> = {
  remoteUrl: "REMOTE_URL",
  authType: "REMOTE_AUTH_TYPE",
  username: "REMOTE_USERNAME", // This is the same key as in secret store for password auth
  password: "REMOTE_PASSWORD", // This is the same key as in secret store for password auth
  customHeaders: "REMOTE_CUSTOM_HEADERS",
};

const proxyConfig = new Config<types.ProxyConfig>({
  STORAGE_CONFIG,
  ENV_VAR_MAP,
  validator: vals.proxyConfig,
  namespace: "proxy",
});

export const getConfig = async (): Promise<
  Omit<types.ProxyConfig, "remoteUrl"> & { remoteUrl: string }
> => {
  await loadSecret();

  const config = proxyConfig.getSync();
  // Get secret store
  const secret = await getSecret();

  let { remoteUrl } = config;

  // If remoteUrl is not set in config via environment variable or config file, use from secret store
  if (!remoteUrl && !secret.remote?.auth_url) {
    throw new Error(
      "Remote URL is not configured. Please set MCP_REMOTE_URL environment variable or run 'remote login' command."
    );
  } else if (!remoteUrl) {
    mcpLogger.warn(
      "MCP_REMOTE_URL is not set in environment variables. Using auth_url from secret store:",
      secret.remote?.auth_url
    );
    remoteUrl = `${secret.remote?.auth_url}/mcp`;
  }

  return {
    ...config,
    remoteUrl,
    // Merge in any auth info from secret store if not already set
    username: config.username || secret?.remote?.password?.username,
    password: config.password || secret?.remote?.password?.password,
  };
};
