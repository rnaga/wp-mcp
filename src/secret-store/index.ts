import fs from "fs";
import os from "os";
import path from "path";

import { Config } from "../config";
import { mcpLogger } from "../logger";
import * as vals from "../validators";

import type * as types from "../types";

export let ENV_BASE_PATH =
  process.env.WP_MCP_ENV_BASE_PATH || path.join(os.homedir(), ".wp-mcp");
export let SECRET_ENV_FILE = process.env.WP_MCP_SECRET_ENV_FILE || ".env.local";

// Configuration: Define which keys go where
const STORAGE_CONFIG = {
  // Keys stored in SQLite (temporary, auto-managed)
  sqlite: [
    "remote.oauth.access_token",
    "remote.oauth.refresh_token",
    "remote.oauth.expires_at",
  ],
  // Keys stored in .env (persistent, user-configured)
  env: [
    "remote.auth_url",
    "remote.token_type",
    "remote.password.username",
    "remote.password.password",
    "local.db_environment",
    "local.db_host",
    "local.db_port",
    "local.db_name",
    "local.db_user",
    "local.db_password",
    "local.multisite",
    "local.default_blog_id",
    "local.default_site_id",
    "local.ssl_enabled",
    "local.ssl_ca",
    "local.ssl_cert",
    "local.ssl_key",
  ],
};

// Mapping between flat keys and env var names
const ENV_VAR_MAP: Record<string, string> = {
  "remote.auth_url": "REMOTE_AUTH_URL",
  "remote.password.username": "REMOTE_USERNAME",
  "remote.password.password": "REMOTE_PASSWORD",
  "local.db_environment": "DB_ENVIRONMENT",
  "local.db_host": "WP_DB_HOST",
  "local.db_port": "WP_DB_PORT",
  "local.db_name": "WP_DB_NAME",
  "local.db_user": "WP_DB_USER",
  "local.db_password": "WP_DB_PASSWORD",
  "local.multisite": "LOCAL_MULTISITE",
  "local.default_blog_id": "LOCAL_DEFAULT_BLOG_ID",
  "local.default_site_id": "LOCAL_DEFAULT_SITE_ID",
  "local.ssl_enabled": "LOCAL_SSL_ENABLED",
  "local.ssl_ca": "LOCAL_SSL_CA_FILEPATH",
  "local.ssl_cert": "LOCAL_SSL_CERT_FILEPATH",
  "local.ssl_key": "LOCAL_SSL_KEY_FILEPATH",
};

// Create config instance
const secretConfig = new Config<types.Secret>({
  STORAGE_CONFIG,
  ENV_VAR_MAP,
  validator: vals.secretValidator,
  namespace: "local-secrets",
  dbPath:
    process.env.WP_MCP_SECRET_DB_PATH || path.join(ENV_BASE_PATH, "secrets.db"),
});

export const getEnvFilePath = () => {
  return path.join(ENV_BASE_PATH, SECRET_ENV_FILE);
};

export const loadSecret = async () => {
  // Create env base path if not exists
  const secretFile = getEnvFilePath();

  // First get without env file to load from sqlite only
  let secret = await secretConfig.get();

  // If env is empty, which means env were not loaded or passed through process.env or command line,
  // load from env file
  if (
    Object.keys(secret).length === 0 ||
    (Object.keys(secret).length === 1 && secret.remote)
  ) {
    secret = await secretConfig.loadFromEnvFile(secretFile);
  }

  return secret;
};

export const getSecret = async (args?: {
  mask: boolean;
}): Promise<types.Secret> => {
  try {
    const mask = args?.mask || false;
    const secret = await secretConfig.get();
    const parsed = vals.secretValidator.safeParse(secret);

    if (!parsed.success) {
      return {} as types.Secret;
    }

    // Recursively mask sensitive values
    const sensitiveKeys = ["password", "access_token"];
    const maskPasswords = (obj: any): any => {
      if (!obj || typeof obj !== "object") return obj;

      if (Array.isArray(obj)) return obj.map(maskPasswords);

      return Object.fromEntries(
        Object.entries(obj).map(([key, value]) => [
          key,
          sensitiveKeys.some((sensitive) =>
            key.toLowerCase().includes(sensitive)
          ) && typeof value === "string"
            ? "***"
            : maskPasswords(value),
        ])
      );
    };

    return mask ? maskPasswords(parsed.data) : parsed.data;
  } catch (error) {
    mcpLogger.error("Error getting secret:", error);
    return {} as types.Secret;
  }
};

export const saveSecret = async (secret: types.Secret): Promise<void> => {
  // Get existing secrets
  const existingSecret = await getSecret();

  // get Auth type and make sure it's all lowercase if exists
  if (secret.remote?.token_type) {
    secret.remote.token_type = secret.remote.token_type.toLowerCase() as
      | "bearer"
      | "basic";
  }

  // Validate the secret
  let parsed = vals.secretValidator.safeParse(secret);
  if (!parsed.success) {
    mcpLogger.error("Invalid secret format:", parsed.error);
    throw new Error("Invalid secret format");
  }

  const newSecret: types.Secret = {
    remote: {
      auth_url: secret.remote?.auth_url ?? existingSecret.remote?.auth_url,
      oauth: secret.remote?.oauth ?? existingSecret.remote?.oauth,
      password: secret.remote?.password ?? existingSecret.remote?.password,
    },
    local: secret.local ?? existingSecret.local ?? undefined,
  };

  // Create base path if not exists with secure permissions (700)
  if (!fs.existsSync(ENV_BASE_PATH)) {
    fs.mkdirSync(ENV_BASE_PATH, { recursive: true, mode: 0o700 });
  }

  await secretConfig.save(newSecret, getEnvFilePath(), 0o600);
};

export const updateSecret = async (
  updates: Partial<types.Secret>
): Promise<void> => {
  await secretConfig.update(updates);
};

export const destroySecret = async (
  // arg to inficate "remote" or "local" or undefined (both)
  section?: "remote" | "local"
): Promise<void> => {
  if (section) {
    const existingSecret = await getSecret();
    if (!existingSecret[section]) {
      // Nothing to delete
      return;
    }
    const updates: Partial<types.Secret> = {};
    updates[section] = undefined;
    await secretConfig.update(updates);
    return;
  }

  await secretConfig.deleteAll();

  // Delete env file if exists
  const secretFile = getEnvFilePath();
  if (fs.existsSync(secretFile)) {
    fs.unlinkSync(secretFile);
  }
};
