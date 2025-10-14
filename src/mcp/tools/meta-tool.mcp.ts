import { z } from "zod";

import { mcp, mcpBind } from "@rnaga/wp-mcp/decorators";
import { Context } from "@rnaga/wp-node/core/context";

import * as vals from "../../validators";
import { Mcp } from "../mcp";
import { Mcps } from "../mcps";

import type * as types from "../../types";
import type * as wpCoreTypes from "@rnaga/wp-node/types";

const roles = async (wp: Context): Promise<wpCoreTypes.RoleNames[]> => {
  if (wp.config.isMultiSite()) {
    return ["superadmin"];
  }

  return ["administrator"];
};

@mcp("meta_tool", {
  description: "A tool to operate CRUD operations on WP metadata.",
  version: "1.0.0",
})
export class MetaToolMcp implements Mcp {
  @mcpBind("meta_list", {
    title: "List Metadata",
    description:
      "Returns a list of WordPress metadata with filtering and pagination options.",
    roles,
  })
  list(...args: types.McpBindParameters) {
    const [server, username, meta] = args;

    server.registerTool(
      meta.name,
      {
        title: meta.title,
        description: meta.description,
        inputSchema: {
          //table: z.enum(["post", "comment", "blog", "term", "user", "site"]),
          table: vals.mcpMetaTable,
          ...vals.mcpMetaList,
        },
      },
      async (input) => {
        const wp = await Mcps.getWpContext(username);

        const { table } = input;

        const metas = await wp.utils.crud.meta.list(
          input.table as wpCoreTypes.MetaTable,
          {
            page: input.page,
            per_page: input.per_page,
            search: input.search,
            exclude: input.exclude?.length ? input.exclude : undefined,
            include: input.include?.length ? input.include : undefined,
            order: input.order,
            orderby: input.orderby || undefined,
          }
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(metas, null, 2),
            },
          ],
        };
      }
    );

    return server;
  }

  @mcpBind("meta_get", {
    title: "Get Metadata",
    description: "Retrieves a specific WordPress metadata by ID.",
    roles,
  })
  get(...args: types.McpBindParameters) {
    const [server, username, meta] = args;

    server.registerTool(
      meta.name,
      {
        title: meta.title,
        description: meta.description,
        inputSchema: {
          table: vals.mcpMetaTable,
          objectId: z.number().nonnegative(),
          keys: z.array(z.string()).optional(),
        },
      },
      async (input) => {
        const wp = await Mcps.getWpContext(username);

        const meta = await wp.utils.crud.meta.get(
          input.table,
          input.objectId,
          input.keys
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(meta, null, 2),
            },
          ],
        };
      }
    );

    return server;
  }

  @mcpBind("meta_create", {
    title: "Create Metadata",
    description: "Creates a new WordPress metadata.",
    roles,
  })
  create(...args: types.McpBindParameters) {
    const [server, username, meta] = args;

    server.registerTool(
      meta.name,
      {
        title: meta.title,
        description: meta.description,
        inputSchema: {
          table: vals.mcpMetaTable,
          objectId: z.number().nonnegative(),
          data: z.record(z.string(), z.string()),
        },
      },
      async (input) => {
        const wp = await Mcps.getWpContext(username);

        try {
          const result = await wp.utils.crud.meta.create(
            input.table,
            input.objectId,
            input.data
          );

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  { success: result.data > 0, meta_id: result.data },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (e) {
          return {
            content: [
              {
                type: "text",
                text: `Error updating metadata: ${username} ${
                  e instanceof Error ? e.message : String(e)
                }`,
              },
            ],
          };
        }
      }
    );
    return server;
  }

  @mcpBind("meta_update", {
    title: "Update Metadata",
    description: "Updates an existing WordPress metadata.",
    roles,
  })
  update(...args: types.McpBindParameters) {
    const [server, username, meta] = args;

    server.registerTool(
      meta.name,
      {
        title: meta.title,
        description: meta.description,
        inputSchema: {
          table: vals.mcpMetaTable,
          objectId: z.number().nonnegative(),
          data: z.record(z.string(), z.string()),
        },
      },
      async (input) => {
        const wp = await Mcps.getWpContext(username);

        try {
          const result = await wp.utils.crud.meta.update(
            input.table,
            input.objectId,
            input.data
          );

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  { success: result.data === true },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (e) {
          return {
            content: [
              {
                type: "text",
                text: `Error updating metadata: ${username} ${
                  e instanceof Error ? e.message : String(e)
                }`,
              },
            ],
          };
        }
      }
    );

    return server;
  }

  @mcpBind("meta_delete", {
    title: "Delete Metadata",
    description: "Deletes a WordPress metadata by ID.",
    roles,
  })
  delete(...args: types.McpBindParameters) {
    const [server, username, meta] = args;

    server.registerTool(
      meta.name,
      {
        title: meta.title,
        description: meta.description,
        inputSchema: {
          table: vals.mcpMetaTable,
          objectId: z.number().nonnegative(),
          keys: z.array(z.string()),
        },
      },
      async (input) => {
        const wp = await Mcps.getWpContext(username);

        try {
          const result = await wp.utils.crud.meta.delete(
            input.table,
            input.objectId,
            input.keys
          );

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ success: result.data > 0 }, null, 2),
              },
            ],
          };
        } catch (e) {
          return {
            content: [
              {
                type: "text",
                text: `Error deleting metadata: ${username} ${
                  e instanceof Error ? e.message : String(e)
                }`,
              },
            ],
          };
        }
      }
    );

    return server;
  }
}
