import * as configs from "@rnaga/wp-node/common/config";
import { Mcps } from "@rnaga/wp-mcp/mcp";

import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client";

export const DB_NAME_SINGLE = "wptest";
export const DB_NAME_MULTI = "wptest-multi";

export const getAppConfigs = () => {
  return {
    multi: configs.defineWPConfig({
      staticAssetsPath: "public",
      multisite: {
        enabled: true,
        defaultBlogId: 1,
        defaultSiteId: 1,
      },
      database: {
        client: "mysql2",
        connection: {
          database: DB_NAME_MULTI,
          host: "db",
          port: 3306,
          user: "root",
          password: "root",
          charset: "utf8mb4",
        },
      },
    }),
    single: configs.defineWPConfig({
      staticAssetsPath: "public",
      multisite: {
        enabled: false,
      },
      database: {
        client: "mysql2",
        connection: {
          database: DB_NAME_SINGLE,
          host: "db",
          port: 3306,
          user: "root",
          password: "root",
          charset: "utf8mb4",
        },
      },
    }),
  };
};

export const createTestMcpInstances = async (username: string = "wp-multi") => {
  // Create MCP server
  const mcpServer = Mcps.createServer();

  const wp = await Mcps.getWpContext(username);

  await Mcps.initServer(mcpServer, wp, username);

  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

  const client = new Client({
    name: "test client",
    version: "1.0",
  });

  await Promise.all([
    client.connect(clientTransport),
    mcpServer.connect(serverTransport),
  ]);

  return { client, mcpServer, wp };
};
