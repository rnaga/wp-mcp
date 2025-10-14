import Application from "@rnaga/wp-node/application";
import * as configs from "@rnaga/wp-node/common/config";

import { mcpLogger } from "../../logger";
import { Mcps } from "../../mcp/mcps";
import { getSecret, loadSecret } from "../../secret-store";
import { readSslCert } from "../utils";
import { Init } from "../wp/init.hook";

export const createLocalWPContext = async (args: {
  configFile?: string;
  username?: string;
}) => {
  const { configFile, username } = args;

  await loadSecret();

  // get secret from keychain.
  const secrets = await getSecret();

  // Throw error if local config is missing
  if (!secrets.local) {
    throw new Error(
      "Local database configuration not found. Please run 'local config-set' command first."
    );
  }

  const localConfig = secrets.local;

  // Set env variables for database connection
  process.env.DB_NAME = localConfig.db_name;
  process.env.DB_USER = localConfig.db_user;
  process.env.DB_PASSWORD = localConfig.db_password;
  process.env.DB_HOST = localConfig.db_host;
  process.env.DB_PORT = localConfig.db_port?.toString() ?? "3306";

  process.env.MULTISITE = localConfig.multisite ? "true" : "false";

  process.env.DEFAULT_BLOG_ID = `${localConfig.default_blog_id || "1"}`;
  process.env.DEFAULT_SITE_ID = `${localConfig.default_site_id || "1"}`;

  const ssl =
    localConfig.ssl_enabled !== true
      ? {}
      : {
          ca: readSslCert(localConfig.ssl_ca),
          cert: readSslCert(localConfig.ssl_cert),
          key: readSslCert(localConfig.ssl_key),
          rejectUnauthorized: localConfig.db_environment === "production",
        };

  // Default config
  const config = configs.defineWPConfig({
    staticAssetsPath: "public",
    multisite: {
      enabled: process.env.MULTISITE === "true",
      defaultBlogId: parseInt(`${process.env.DEFAULT_BLOG_ID}`, 10),
      defaultSiteId: parseInt(`${process.env.DEFAULT_SITE_ID}`, 10),
    },
    database: {
      client: "mysql2",
      connection: {
        database: process.env.DB_NAME,
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || "3306", 10),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        charset: "utf8mb4",
        ...(localConfig.ssl_enabled ? { ssl } : {}),
      },
    },
  });

  Application.config = config;

  // Set config file path for init hook.
  if (configFile) {
    mcpLogger.info("Using config file:", configFile);
    Init.localWPConfigFile = configFile;
  }

  Application.registerHooks([Init]);

  // Initialize WordPress application and get context (triggers init hook execution)
  const wp = await Mcps.getWpContext(username);

  return { wp, localConfig };
};
