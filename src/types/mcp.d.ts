import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type * as wpCoreTypes from "@rnaga/wp-node/types";
import type { Context } from "@rnaga/wp-node/core/context";

export type McpDecoratorOptions = {
  title: string;
  description: string;
  capabilities?:
    | wpCoreTypes.Capabilities[]
    | ((wp: Context) => Promise<wpCoreTypes.Capabilities[]>);
  roles?:
    | wpCoreTypes.RoleNames[]
    | ((wp: Context) => Promise<wpCoreTypes.RoleNames[]>);
  multisite?: boolean;
};

export type McpOptions = McpDecoratorOptions & {
  name: string;
};

export type McpMeta = Omit<
  McpDecoratorOptions,
  "capabilities" | "multisite"
> & {
  name: string;
};

export type McpBindFunction = (
  server: McpServer,
  username: string | undefined,
  meta: McpMeta
) => McpServer;

export type McpBindParameters = Parameters<McpBindFunction>;
