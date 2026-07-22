import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import Application from "@rnaga/wp-node/application";
import { Context } from "@rnaga/wp-node/core/context";
import { Constructor } from "@rnaga/wp-node/types";

import { REFLECT_METADATA_KEY_MCP_PROPD } from "../decorators";
import { mcpLogger } from "../logger";
import { Mcp } from "./mcp";

import type * as types from "../types";

export class Mcps {
  static map = new Map<string, Mcp>();
  static register(constructors: Constructor[] | Mcp[]) {
    constructors.forEach((constructor: any) => {
      Mcps.map.set(constructor.__name, constructor);
    });
  }

  static unregisterAll() {
    Mcps.map.clear();
  }

  static createServer() {
    const server = new McpServer(
      {
        name: "sse-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {}, // For tools/list and tools/call
        },
      }
    );

    return server;
  }

  static async getWpContext(username: string | number | undefined) {
    const wp = await Application.getContext();

    await wp.current.assumeUser(username);

    return wp;
  }

  static async initServer(server: McpServer, wp: Context, username?: string) {
    // Get current user from context
    const currentUser = wp.current.user;

    if (!currentUser) {
      throw new Error("No current user in context");
    }

    // Get the current blogId (wp-node returns 0 for single-site, but capability
    // checks require blogId 1 which is the default WordPress blog)
    const blogId = wp.current.blogId || 1;

    // Register all MCPs
    for (const [name, clazz] of Mcps.map) {
      const instance = new (clazz as Constructor)();

      // Get methods registered with @mcpBind
      const methodMap = Reflect.getMetadata(
        REFLECT_METADATA_KEY_MCP_PROPD,
        instance
      ) as Map<string, types.McpOptions>;

      // Register each method as a primitive
      for (const [propertyKey, options] of methodMap) {
        const isMultisite = options.multisite || false;

        // Skip if multisite is required but not enabled
        if (isMultisite && !wp.config.isMultiSite()) {
          mcpLogger.debug(
            `Skipping registration of primitive ${propertyKey} as multisite is not enabled`
          );
          continue;
        }

        // Determine roles, it can be an array or a function
        const roles =
          typeof options.roles === "function"
            ? await options.roles(wp)
            : options.roles ?? [];

        if (Array.isArray(roles) && roles.length > 0) {
          const userRoles = await wp.current.user?.roles();
          mcpLogger.debug(
            `Checking roles for ${propertyKey}: required=${JSON.stringify(roles)}, userRoles=${JSON.stringify(userRoles)}`
          );
          const hasRole = roles?.some((role) => userRoles?.includes(role));
          if (!hasRole) {
            mcpLogger.debug(
              `Skipping registration of primitive ${propertyKey} due to insufficient roles`
            );
            continue;
          }
        }

        // Determine required capabilities, it can be an array or a function
        const capabilities =
          typeof options.capabilities === "function"
            ? await options.capabilities(wp)
            : options.capabilities ?? [];

        if (Array.isArray(capabilities) && capabilities.length > 0) {
          // Check if user has required capabilities
          const hasCapabilities = await wp.utils.user.hasCapabilities(
            currentUser,
            capabilities,
            {
              blogIds: [blogId],
            }
          );

          mcpLogger.debug(
            `Checking capabilities for ${propertyKey}: required=${JSON.stringify(capabilities)}, blogId=${blogId}, hasCapabilities=${hasCapabilities}`
          );

          // Skip if user lacks capabilities
          if (!hasCapabilities) {
            mcpLogger.debug(
              `Skipping registration of primitive ${propertyKey} due to insufficient capabilities`
            );
            continue;
          }
        }

        // Prepare meta object to pass to the bind method
        const meta: types.McpMeta = {
          name: options.name,
          title: options.title,
          description: options.description || "",
        };

        // Call bind method to register primitive
        instance[propertyKey](server, username, meta);
      }
    }

    return server;
  }
}
