import { z } from "zod";

import { mcp, mcpBind } from "../../decorators";
import * as vals from "../../validators";
import { Mcps } from "../mcps";

import type * as types from "../../types";
import { Mcp } from "../mcp";

import type * as wpCoreTypes from "@rnaga/wp-node/types";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

type CallBackResult = Awaited<
  ReturnType<Parameters<McpServer["registerTool"]>[2]>
>;

@mcp("user_tool", {
  description: "A tool to operate CRUD operations on WP users.",
  version: "1.0.0",
})
export class UserToolMcp implements Mcp {
  @mcpBind("users_list", {
    title: "List Users",
    description:
      "Returns a list of WordPress users with filtering and pagination options.",
    capabilities: ["list_users"],
  })
  list(...args: types.McpBindParameters) {
    const [server, username, meta] = args;

    server.registerTool(
      meta.name,
      {
        title: meta.title,
        description: meta.description,
        inputSchema: vals.mcpUserList,
      },
      async (input, extra) => {
        const wp = await Mcps.getWpContext(username);

        const users = await wp.utils.crud.user.list({
          page: input.page,
          per_page: input.per_page,
          blog_id: input.blog_id,
          site_id: input.site_id,
          search: input.search,
          exclude: input.exclude?.length ? input.exclude : undefined,
          exclude_anonymous: input.exclude_anonymous,
          include: input.include?.length ? input.include : undefined,
          include_unregistered_users: input.include_unregistered_users,
          superadmins: input.superadmins,
          offset: input.offset,
          order: input.order,
          orderby: input.orderby,
          slug: input.slug?.length ? input.slug : undefined,
          roles: input.roles?.length ? input.roles : [],
          has_published_posts: input.has_published_posts,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(users, null, 2),
            },
          ],
        };
      }
    );

    return server;
  }

  @mcpBind("user_get", {
    title: "Get User",
    description: "Retrieves a specific WordPress user by ID.",
    capabilities: ["create_users"],
  })
  get(...args: types.McpBindParameters) {
    const [server, username, meta] = args;
    server.registerTool(
      meta.name,
      {
        title: meta.title,
        description: meta.description,
        inputSchema: {
          ID: z.number().int().positive(),
        },
      },
      async (input, extra) => {
        const wp = await Mcps.getWpContext(username);
        const currentUser = wp.current.user;

        const blogId = wp.current.blogId;

        const canEditUsers = !currentUser
          ? false
          : await wp.utils.user.hasCapabilities(currentUser, ["edit_users"], {
              blogIds: [blogId],
            });

        const returnValue = (user: any): CallBackResult => {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(user, null, 2),
              },
            ],
          };
        };

        if (canEditUsers) {
          let user = await wp.utils.crud.user.get(input.ID, {
            context: "edit",
          });

          // Unset user_pass
          user.data.user_pass = "";

          return returnValue(user);
        }

        const user = await wp.utils.crud.user.get(input.ID);
        return returnValue(user);
      }
    );

    return server;
  }

  @mcpBind("user_create", {
    title: "Create User",
    description: "Creates a new WordPress user.",
    capabilities: ["create_users"],
  })
  create(...args: types.McpBindParameters) {
    const [server, username, meta] = args;

    server.registerTool(
      meta.name,
      {
        title: meta.title,
        description: meta.description,
        inputSchema: vals.mcpUserCreate,
      },
      async (input, extra) => {
        const wp = await Mcps.getWpContext(username);

        try {
          const { data: user } = await wp.utils.crud.user.create(input);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(user, null, 2),
              },
            ],
          };
        } catch (e) {
          return {
            content: [
              {
                type: "text",
                text: `Error creating post: ${username} ${
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

  @mcpBind("user_update", {
    title: "Update User",
    description: "Updates an existing WordPress user.",
    capabilities: ["edit_users"],
  })
  update(...args: types.McpBindParameters) {
    const [server, username, meta] = args;

    server.registerTool(
      meta.name,
      {
        title: meta.title,
        description: meta.description,
        inputSchema: vals.mcpUserUpdate,
      },
      async (input, extra) => {
        const wp = await Mcps.getWpContext(username);

        const { ID, ...updateData } = input;

        try {
          const { data: userId } = await wp.utils.crud.user.update(
            ID,
            updateData
          );

          // Get the updated user data
          const result = await wp.utils.crud.user.get(userId, {
            context: "edit",
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (e) {
          return {
            content: [
              {
                type: "text",
                text: `Error updating user: ${username} ${
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

  @mcpBind("user_delete", {
    title: "Delete User",
    description: "Deletes a WordPress user by ID.",
    capabilities: ["delete_users"],
  })
  delete(...args: types.McpBindParameters) {
    const [server, username, meta] = args;
    server.registerTool(
      meta.name,
      {
        title: meta.title,
        description: meta.description,
        inputSchema: {
          ID: z.number().int().positive(),
          reassign: z.number().int().positive().optional(),
        },
      },
      async (input, extra) => {
        const wp = await Mcps.getWpContext(username);

        try {
          const { data: success } = await wp.utils.crud.user.delete(input.ID, {
            reassign: input.reassign,
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ success }, null, 2),
              },
            ],
          };
        } catch (e) {
          return {
            content: [
              {
                type: "text",
                text: `Error deleting user: ${username} ${
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
